import { jsonResponse, sanitizeText, getClientIp, hashIp } from "../../_utils.js";

const NAME_MAX = 24;
const MESSAGE_MAX = 240;
const PAGE_SIZE = 50;
const RESERVED_NAMES = new Set(["admin", "slip radio"]);

const CLIENT_COOLDOWN_MS = 2000;
const IP_WINDOW_MS = 10000;
const IP_MAX_IN_WINDOW = 8;

// KV's minimum TTL is 60s, too coarse for a 2s cooldown — read the
// applicant's own last message straight out of D1 instead. clientId is a
// browser-generated uuid (localStorage), so this only slows a single tab
async function checkClientCooldown(env, clientId, now) {
  const row = await env.CHAT.prepare(
    "SELECT created_at FROM messages WHERE client_id = ?1 ORDER BY id DESC LIMIT 1"
  )
    .bind(clientId)
    .first();
  return !row || now - row.created_at >= CLIENT_COOLDOWN_MS;
}

// coarser per-IP cap so rotating clientId doesn't bypass the cooldown above —
// loose enough that a shared wifi/event doesn't throttle unrelated listeners
async function checkIpCap(env, ipHash, now) {
  const row = await env.CHAT.prepare(
    "SELECT COUNT(*) AS count FROM messages WHERE ip_hash = ?1 AND created_at > ?2"
  )
    .bind(ipHash, now - IP_WINDOW_MS)
    .first();
  return (row?.count || 0) < IP_MAX_IN_WINDOW;
}

async function isBanned(env, clientId, ipHash) {
  const [byClient, byIp] = await Promise.all([
    env.CHAT_RL.get(`ban:client:${clientId}`),
    env.CHAT_RL.get(`ban:ip:${ipHash}`),
  ]);
  return Boolean(byClient || byIp);
}

// name is fixed the moment a clientId's first message lands — later posts
// can't rename that identity, whatever the request claims the name is
async function findExisting(env, clientId) {
  return env.CHAT.prepare("SELECT name FROM messages WHERE client_id = ?1 ORDER BY id ASC LIMIT 1")
    .bind(clientId)
    .first();
}

async function insertMessage(env, { clientId, name, body, isSystem, ipHash, createdAt }) {
  const result = await env.CHAT.prepare(
    "INSERT INTO messages (client_id, name, body, is_dj, is_system, ip_hash, created_at) VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6)"
  )
    .bind(clientId, name, body, isSystem ? 1 : 0, ipHash, createdAt)
    .run();
  return { id: result.meta.last_row_id, name, body, isDj: false, isSystem: Boolean(isSystem), createdAt };
}

function toMessage(row) {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    isDj: Boolean(row.is_dj),
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at,
  };
}

// after=0 (or omitted) -> most recent page, newest last
// after=<id> -> everything newer than that id, for polling
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const after = Number(url.searchParams.get("after")) || 0;

  const rows =
    after > 0
      ? await env.CHAT.prepare(
          "SELECT id, name, body, is_dj, is_system, created_at FROM messages WHERE id > ?1 AND deleted_at IS NULL ORDER BY id ASC LIMIT ?2"
        )
          .bind(after, PAGE_SIZE)
          .all()
      : await env.CHAT.prepare(
          "SELECT id, name, body, is_dj, is_system, created_at FROM messages WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ?1"
        )
          .bind(PAGE_SIZE)
          .all();

  const ordered = after > 0 ? rows.results : rows.results.reverse();
  const latest = await env.CHAT.prepare("SELECT MAX(id) AS id FROM messages").first();

  return jsonResponse({ messages: ordered.map(toMessage), latestId: latest?.id || 0 });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const clientId = typeof payload.clientId === "string" ? payload.clientId : "";
  if (clientId.length < 8 || clientId.length > 64) {
    return jsonResponse({ error: "invalid_client" }, 400);
  }

  const providedName = sanitizeText(payload.name, NAME_MAX);
  const body = sanitizeText(payload.message, MESSAGE_MAX);
  if (!body) return jsonResponse({ error: "message_required" }, 400);

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip);

  if (await isBanned(env, clientId, ipHash)) {
    return jsonResponse({ error: "banned" }, 403);
  }

  const existing = await findExisting(env, clientId);
  const name = existing ? existing.name : providedName;
  if (!name) return jsonResponse({ error: "name_required" }, 400);
  if (!existing && RESERVED_NAMES.has(name.toLowerCase())) {
    return jsonResponse({ error: "name_reserved" }, 400);
  }

  const createdAt = Date.now();
  const [clientOk, ipOk] = await Promise.all([
    checkClientCooldown(env, clientId, createdAt),
    checkIpCap(env, ipHash, createdAt),
  ]);
  if (!clientOk || !ipOk) return jsonResponse({ error: "rate_limited" }, 429);

  const messages = [];
  if (!existing) {
    messages.push(
      await insertMessage(env, {
        clientId,
        name,
        body: `${name} has entered the chat`,
        isSystem: true,
        ipHash,
        createdAt,
      })
    );
  }
  messages.push(await insertMessage(env, { clientId, name, body, isSystem: false, ipHash, createdAt }));

  return jsonResponse({ messages }, 201);
}

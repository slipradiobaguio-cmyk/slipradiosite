import { jsonResponse, sanitizeText } from "../../../_utils.js";

const NAME_MAX = 24;
const MESSAGE_MAX = 240;

// includes ip_hash/deleted_at unlike the public feed — the admin view needs
// them to moderate and ban, listeners never see either
export async function onRequestGet({ env }) {
  const rows = await env.CHAT.prepare(
    "SELECT id, client_id, name, body, is_dj, ip_hash, created_at, deleted_at FROM messages ORDER BY id DESC LIMIT 100"
  ).all();

  return jsonResponse({
    messages: rows.results.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      body: row.body,
      isDj: Boolean(row.is_dj),
      ipHash: row.ip_hash,
      createdAt: row.created_at,
      deleted: Boolean(row.deleted_at),
    })),
  });
}

// posts into the same room tagged as the DJ — admin auth stands in for
// identity here, no separate DJ login
export async function onRequestPost({ request, env }) {
  const payload = await request.json();
  const name = sanitizeText(payload.name, NAME_MAX) || "DJ";
  const body = sanitizeText(payload.message, MESSAGE_MAX);
  if (!body) return jsonResponse({ error: "message_required" }, 400);

  const createdAt = Date.now();
  const result = await env.CHAT.prepare(
    "INSERT INTO messages (client_id, name, body, is_dj, ip_hash, created_at) VALUES ('dj', ?1, ?2, 1, NULL, ?3)"
  )
    .bind(name, body, createdAt)
    .run();

  return jsonResponse({ id: result.meta.last_row_id, name, body, isDj: true, createdAt }, 201);
}

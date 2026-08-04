import { jsonResponse } from "../../../_utils.js";

const DEFAULT_MINUTES = 60;
const MAX_MINUTES = 1440;

// bans by clientId and/or ipHash (both come off a message row in the admin
// list) — stored as KV keys with a TTL so they lift themselves automatically
export async function onRequestPost({ request, env }) {
  const { clientId, ipHash, minutes } = await request.json();
  if (!clientId && !ipHash) return jsonResponse({ error: "clientId_or_ipHash_required" }, 400);

  const ttlSeconds = Math.min(Math.max(Number(minutes) || DEFAULT_MINUTES, 1), MAX_MINUTES) * 60;

  await Promise.all([
    clientId ? env.CHAT_RL.put(`ban:client:${clientId}`, "1", { expirationTtl: ttlSeconds }) : null,
    ipHash ? env.CHAT_RL.put(`ban:ip:${ipHash}`, "1", { expirationTtl: ttlSeconds }) : null,
  ]);

  return jsonResponse({ banned: true, minutes: ttlSeconds / 60 });
}

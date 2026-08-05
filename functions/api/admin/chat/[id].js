import { jsonResponse, sanitizeText } from "../../../_utils.js";

const MESSAGE_MAX = 240;

export async function onRequestDelete({ params, env }) {
  const id = Number(params.id);
  if (!id) return jsonResponse({ error: "invalid_id" }, 400);

  await env.CHAT.prepare("UPDATE messages SET deleted_at = ?1 WHERE id = ?2")
    .bind(Date.now(), id)
    .run();

  return new Response(null, { status: 204 });
}

// only the station's own posts are editable — rewriting what a listener
// said would be a moderation-integrity problem, not just a UI nicety, so
// this is enforced here too, not just by hiding the button client-side
export async function onRequestPatch({ params, request, env }) {
  const id = Number(params.id);
  if (!id) return jsonResponse({ error: "invalid_id" }, 400);

  const payload = await request.json();
  const body = sanitizeText(payload.message, MESSAGE_MAX);
  if (!body) return jsonResponse({ error: "message_required" }, 400);

  const row = await env.CHAT.prepare("SELECT is_dj FROM messages WHERE id = ?1").bind(id).first();
  if (!row || !row.is_dj) return jsonResponse({ error: "not_editable" }, 403);

  await env.CHAT.prepare("UPDATE messages SET body = ?1 WHERE id = ?2").bind(body, id).run();
  return jsonResponse({ id, body });
}

import { jsonResponse } from "../../../_utils.js";

export async function onRequestDelete({ params, env }) {
  const id = Number(params.id);
  if (!id) return jsonResponse({ error: "invalid_id" }, 400);

  await env.CHAT.prepare("UPDATE messages SET deleted_at = ?1 WHERE id = ?2")
    .bind(Date.now(), id)
    .run();

  return new Response(null, { status: 204 });
}

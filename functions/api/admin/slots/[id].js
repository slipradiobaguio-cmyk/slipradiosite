import { jsonResponse } from "../../../_utils.js";

export async function onRequestDelete({ params, env }) {
  await env.SUBMISSIONS.delete(`slot:${params.id}`);
  return new Response(null, { status: 204 });
}

// manually free up a reserved slot (e.g. a DJ cancelled) without deleting it
// off the calendar entirely
export async function onRequestPatch({ params, env }) {
  const key = `slot:${params.id}`;
  const existing = await env.SUBMISSIONS.get(key, "json");
  if (!existing) return jsonResponse({ error: "not found" }, 404);

  const record = { ...existing, status: "open", submissionId: null };
  await env.SUBMISSIONS.put(key, JSON.stringify(record));
  return jsonResponse(record);
}

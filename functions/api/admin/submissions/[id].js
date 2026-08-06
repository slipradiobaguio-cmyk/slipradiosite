import { jsonResponse } from "../../../_utils.js";

const STATUSES = ["new", "accepted", "declined"];

// declining frees the slot back up for someone else; accepting/reverting to
// "new" leaves whatever the slot is currently doing alone
async function releaseSlot(slotId, submissionId, env) {
  if (!slotId) return;
  const slotKey = `slot:${slotId}`;
  const slot = await env.SUBMISSIONS.get(slotKey, "json");
  if (slot && slot.submissionId === submissionId) {
    await env.SUBMISSIONS.put(slotKey, JSON.stringify({ ...slot, status: "open", submissionId: null }));
  }
}

export async function onRequestPatch({ params, request, env }) {
  const key = `submission:${params.id}`;
  const existing = await env.SUBMISSIONS.get(key, "json");
  if (!existing) return jsonResponse({ error: "not found" }, 404);

  const { status } = await request.json().catch(() => ({}));
  if (!STATUSES.includes(status)) return jsonResponse({ error: "invalid status" }, 400);

  const record = { ...existing, status };
  await env.SUBMISSIONS.put(key, JSON.stringify(record));

  if (status === "declined") await releaseSlot(existing.slotId, existing.id, env);

  return jsonResponse(record);
}

export async function onRequestDelete({ params, env }) {
  const key = `submission:${params.id}`;
  const existing = await env.SUBMISSIONS.get(key, "json");
  if (existing) await releaseSlot(existing.slotId, existing.id, env);
  await env.SUBMISSIONS.delete(key);
  return new Response(null, { status: 204 });
}

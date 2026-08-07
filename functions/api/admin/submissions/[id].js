import { jsonResponse } from "../../../_utils.js";

const STATUSES = ["new", "accepted", "declined"];

// slot status tracks the submission linked to it: "pending" while under
// review, "reserved" once accepted, released back to "open" on decline/delete
const SLOT_STATUS_BY_SUBMISSION_STATUS = { new: "pending", accepted: "reserved" };

async function releaseSlot(slotId, submissionId, env) {
  if (!slotId) return;
  const slotKey = `slot:${slotId}`;
  const slot = await env.SUBMISSIONS.get(slotKey, "json");
  if (slot && slot.submissionId === submissionId) {
    await env.SUBMISSIONS.put(slotKey, JSON.stringify({ ...slot, status: "open", submissionId: null }));
  }
}

async function syncSlotStatus(slotId, submissionId, submissionStatus, env) {
  if (!slotId) return;
  const slotKey = `slot:${slotId}`;
  const slot = await env.SUBMISSIONS.get(slotKey, "json");
  if (slot && slot.submissionId === submissionId) {
    await env.SUBMISSIONS.put(slotKey, JSON.stringify({ ...slot, status: SLOT_STATUS_BY_SUBMISSION_STATUS[submissionStatus] }));
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
  else await syncSlotStatus(existing.slotId, existing.id, status, env);

  return jsonResponse(record);
}

export async function onRequestDelete({ params, env }) {
  const key = `submission:${params.id}`;
  const existing = await env.SUBMISSIONS.get(key, "json");
  if (existing) await releaseSlot(existing.slotId, existing.id, env);
  await env.SUBMISSIONS.delete(key);
  return new Response(null, { status: 204 });
}

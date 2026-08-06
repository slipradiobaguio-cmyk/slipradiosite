import { jsonResponse } from "../../../_utils.js";

export async function onRequestGet({ env }) {
  const list = await env.SUBMISSIONS.list({ prefix: "slot:" });
  const slots = await Promise.all(list.keys.map((k) => env.SUBMISSIONS.get(k.name, "json")));
  slots.sort((a, b) => `${a?.date}${a?.startTime}`.localeCompare(`${b?.date}${b?.startTime}`));
  return jsonResponse(slots.filter(Boolean));
}

export async function onRequestPost({ request, env }) {
  const payload = await request.json().catch(() => null);
  if (!payload?.date || !payload?.startTime || !payload?.endTime) {
    return jsonResponse({ error: "date, startTime, and endTime are required" }, 400);
  }

  const id = crypto.randomUUID();
  const record = {
    id,
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    status: "open",
    submissionId: null,
    createdAt: new Date().toISOString(),
  };

  await env.SUBMISSIONS.put(`slot:${id}`, JSON.stringify(record));
  return jsonResponse(record, 201);
}

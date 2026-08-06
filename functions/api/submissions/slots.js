import { jsonResponse } from "../../_utils.js";

export async function onRequestGet({ env }) {
  const list = await env.SUBMISSIONS.list({ prefix: "slot:" });
  const slots = await Promise.all(list.keys.map((k) => env.SUBMISSIONS.get(k.name, "json")));
  const open = slots.filter((s) => s && s.status === "open");
  open.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  return jsonResponse(open);
}

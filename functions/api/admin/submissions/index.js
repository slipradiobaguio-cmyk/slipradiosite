import { jsonResponse } from "../../../_utils.js";

export async function onRequestGet({ env }) {
  const list = await env.SUBMISSIONS.list({ prefix: "submission:" });
  const submissions = await Promise.all(list.keys.map((k) => env.SUBMISSIONS.get(k.name, "json")));
  submissions.sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
  return jsonResponse(submissions.filter(Boolean));
}

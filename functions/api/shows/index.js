import { jsonResponse } from "../../_utils.js";

export async function onRequestGet({ env }) {
  const list = await env.SHOWS.list({ prefix: "show:" });
  const shows = await Promise.all(list.keys.map((k) => env.SHOWS.get(k.name, "json")));

  shows.sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));

  return jsonResponse(shows.filter(Boolean));
}

import { jsonResponse } from "../../_utils.js";

export async function onRequestGet({ env }) {
  const onAir = await env.SHOWS.get("onair:slug");
  return jsonResponse({ onAir: onAir || null });
}

import { jsonResponse } from "../../../../_utils.js";

const ONAIR_KEY = "onair:slug";

export async function onRequestPost({ params, request, env }) {
  const { onAir } = await request.json();

  if (onAir) {
    const show = await env.SHOWS.get(`show:${params.slug}`, "json");
    if (!show) return jsonResponse({ error: "not found" }, 404);
    await env.SHOWS.put(ONAIR_KEY, params.slug);
    return jsonResponse({ onAir: params.slug });
  }

  const current = await env.SHOWS.get(ONAIR_KEY);
  if (current === params.slug) await env.SHOWS.delete(ONAIR_KEY);
  return jsonResponse({ onAir: null });
}

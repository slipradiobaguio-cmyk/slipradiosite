import { jsonResponse } from "../../_utils.js";

// public, read-only — writes live under /api/admin/shows/:slug so Cloudflare
// Access can gate that path without blocking public reads of this one
export async function onRequestGet({ params, env }) {
  const record = await env.SHOWS.get(`show:${params.slug}`, "json");
  if (!record) return jsonResponse({ error: "not found" }, 404);
  return jsonResponse(record);
}

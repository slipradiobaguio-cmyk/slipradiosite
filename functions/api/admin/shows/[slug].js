import { jsonResponse } from "../../../_utils.js";

// gate this whole /api/admin/* path with Cloudflare Access (dashboard config) —
// no auth logic lives here on purpose
async function upsert({ params, request, env }) {
  const payload = await request.json();
  if (!payload.title) return jsonResponse({ error: "title is required" }, 400);

  const key = `show:${params.slug}`;
  const existing = await env.SHOWS.get(key, "json");
  const now = new Date().toISOString();

  const record = {
    ...payload,
    slug: params.slug,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await env.SHOWS.put(key, JSON.stringify(record));
  return jsonResponse(record, existing ? 200 : 201);
}

export const onRequestPost = upsert;
export const onRequestPut = upsert;

export async function onRequestDelete({ params, env }) {
  await env.SHOWS.delete(`show:${params.slug}`);
  return new Response(null, { status: 204 });
}

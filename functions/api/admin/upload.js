import { jsonResponse } from "../../_utils.js";

const MAX_BYTES = 10 * 1024 * 1024;

// raster types only — no svg+xml: SVG can carry inline <script> and
// functions/media/[key].js serves files back with this same content-type,
// which would make an uploaded thumbnail executable same-origin script
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return jsonResponse({ error: "file is required" }, 400);
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return jsonResponse({ error: "file must be a JPEG, PNG, WebP, GIF, or AVIF image" }, 400);
  }
  if (file.size > MAX_BYTES) {
    return jsonResponse({ error: "file must be 10MB or smaller" }, 400);
  }

  const key = `${crypto.randomUUID()}.${ext}`;

  await env.THUMBNAILS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return jsonResponse({ url: `/media/${key}` }, 201);
}

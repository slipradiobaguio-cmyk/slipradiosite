import { jsonResponse } from "../../_utils.js";

const MAX_BYTES = 10 * 1024 * 1024;

// flat key (no "/"): functions/media/[key].js only matches a single path
// segment, a nested key would 404 when the site tries to serve it back
export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return jsonResponse({ error: "file is required" }, 400);
  }
  if (!file.type || !file.type.startsWith("image/")) {
    return jsonResponse({ error: "file must be an image" }, 400);
  }
  if (file.size > MAX_BYTES) {
    return jsonResponse({ error: "file must be 10MB or smaller" }, 400);
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const key = `sub-${crypto.randomUUID()}.${ext}`;

  await env.THUMBNAILS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return jsonResponse({ url: `/media/${key}` }, 201);
}

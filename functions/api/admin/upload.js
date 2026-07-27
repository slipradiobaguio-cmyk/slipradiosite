import { jsonResponse } from "../../_utils.js";

export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return jsonResponse({ error: "file is required" }, 400);
  }

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const key = `${crypto.randomUUID()}.${ext}`;

  await env.THUMBNAILS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  return jsonResponse({ url: `/media/${key}` }, 201);
}

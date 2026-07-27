import { jsonResponse } from "../_utils.js";

// radio streaming tool (AzuraCast or similar) isn't confirmed yet — once it is,
// set NOW_PLAYING_API_URL and map the response fields below to match its shape
export async function onRequestGet({ env }) {
  const upstreamUrl = env.NOW_PLAYING_API_URL;

  if (!upstreamUrl) {
    return jsonResponse({ live: false });
  }

  try {
    const upstream = await fetch(upstreamUrl, { cf: { cacheTtl: 5 } });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const data = await upstream.json();

    return jsonResponse({
      live: Boolean(data.live),
      title: data.title || null,
      dj: data.dj || data.artist || null,
      streamUrl: data.streamUrl || null,
      nextShow: data.nextShow || null,
    });
  } catch (err) {
    return jsonResponse({ live: false, error: "upstream_unreachable" }, 502);
  }
}

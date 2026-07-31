import { jsonResponse } from "../_utils.js";

// AzuraCast calls this on connect/disconnect events so the site doesn't
// depend on the now-playing API's is_live flag, which can lag or get stuck.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (!env.WEBHOOK_SECRET || url.searchParams.get("key") !== env.WEBHOOK_SECRET) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const data = await request.json();
  const isLive = Boolean(data.live && data.live.is_live);
  const song = data.now_playing && data.now_playing.song;

  await env.SHOWS.put(
    "live:status",
    JSON.stringify({
      live: isLive,
      title: song ? song.title : null,
      dj: isLive ? data.live.streamer_name || null : null,
      streamUrl: data.station ? data.station.listen_url : null,
      updatedAt: Date.now(),
    })
  );

  return jsonResponse({ ok: true });
}

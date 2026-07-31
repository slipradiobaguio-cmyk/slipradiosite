import { jsonResponse } from "../_utils.js";

const WEBHOOK_STALE_MS = 5 * 60 * 1000;

// AzuraCast's /api/nowplaying/{shortcode} endpoint
export async function onRequestGet({ env }) {
  const cached = await env.SHOWS.get("live:status", "json");
  if (cached && Date.now() - cached.updatedAt < WEBHOOK_STALE_MS) {
    const { updatedAt, ...body } = cached;
    return jsonResponse({ nextShow: null, ...body });
  }

  const upstreamUrl = env.NOW_PLAYING_API_URL;

  if (!upstreamUrl) {
    return jsonResponse({ live: false });
  }

  try {
    const upstream = await fetch(upstreamUrl, { cf: { cacheTtl: 5 } });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const data = await upstream.json();

    const isLive = Boolean(data.live && data.live.is_live);
    const song = data.now_playing && data.now_playing.song;

    return jsonResponse({
      live: isLive,
      title: song ? song.title : null,
      dj: isLive ? data.live.streamer_name || null : song ? song.artist || null : null,
      streamUrl: data.station ? data.station.listen_url : null,
      nextShow:
        data.playing_next && data.playing_next.song
          ? data.playing_next.song.title
          : null,
    });
  } catch (err) {
    return jsonResponse({ live: false, error: "upstream_unreachable" }, 502);
  }
}

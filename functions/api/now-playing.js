import { jsonResponse } from "../_utils.js";

const WEBHOOK_STALE_MS = 5 * 60 * 1000;

// AzuraCast's is_live flag doesn't register a source connected directly to
// the master Icecast mount, so fall back to asking Icecast itself whether
// a source is actually connected.
async function isIcecastSourceLive(streamUrl) {
  if (!streamUrl) return false;
  try {
    const listenUrl = new URL(streamUrl);
    const statusUrl = `${listenUrl.protocol}//${listenUrl.host}/status-json.xsl`;
    const res = await fetch(statusUrl, { cf: { cacheTtl: 5 } });
    if (!res.ok) return false;
    const data = await res.json();
    const sources = data.icestats && data.icestats.source;
    if (!sources) return false;
    const list = Array.isArray(sources) ? sources : [sources];
    return list.some((source) => Boolean(source && source.stream_start));
  } catch (err) {
    return false;
  }
}

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

    const streamUrl = data.station ? data.station.listen_url : null;
    const flagLive = Boolean(data.live && data.live.is_live);
    const isLive = flagLive || (await isIcecastSourceLive(streamUrl));
    const song = data.now_playing && data.now_playing.song;

    return jsonResponse({
      live: isLive,
      title: isLive ? (song && song.title) || "Live now" : null,
      dj: isLive ? (data.live && data.live.streamer_name) || (song && song.artist) || null : null,
      streamUrl,
      nextShow:
        data.playing_next && data.playing_next.song
          ? data.playing_next.song.title
          : null,
    });
  } catch (err) {
    return jsonResponse({ live: false, error: "upstream_unreachable" }, 502);
  }
}

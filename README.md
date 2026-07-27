# Slip Radio

Live-streaming DJ radio site. Static frontend, no build step, backed by Cloudflare Pages Functions for the now-playing widget and the shows admin.

## Stack

- Plain HTML/CSS/JS — no framework, no bundler
- Cloudflare Pages (static hosting, free tier)
- Cloudflare Pages Functions (`/functions`) for the API — same Workers runtime, deployed alongside the static site
- Cloudflare KV for show data, Cloudflare R2 for thumbnail images
- Cloudflare Access to gate the admin page and its API routes

## Local development

```
npm install
npm run dev
```

This runs `wrangler pages dev`, which serves the static files and the `/functions` API together with local KV/R2 emulation, matching production.

## Project structure

- `index.html`, `about.html`, `support-us.html`, `shows.html` — the four main pages
- `templates/show.html` — single-show template, served at `/shows/:slug` via the `_redirects` rewrite (kept outside `/shows/` on purpose — a file living inside `/shows/` would collide with its own clean-URL alias and the wildcard rule, causing a redirect loop)
- `admin/index.html` — show management UI (add/edit/delete, thumbnail upload)
- `css/`, `js/` — shared styles and scripts, loaded on every page
- `functions/api/` — public read endpoints (`/api/now-playing`, `/api/shows`, `/api/shows/:slug`)
- `functions/api/admin/` — write endpoints, meant to sit behind Cloudflare Access
- `functions/media/[key].js` — serves uploaded thumbnails out of R2

## Deployment

Push to `main` — Cloudflare Pages auto-deploys from there. No separate deploy step for the API; Functions ship with the same push.

## Cloudflare setup checklist (one-time, in the dashboard)

1. Create the Pages project, connect this repo, build output = repo root, no build command.
2. Create a KV namespace, bind it as `SHOWS` in Pages → Settings → Functions.
3. Create an R2 bucket (e.g. `slip-radio-thumbnails`), bind it as `THUMBNAILS`.
4. Set up a Cloudflare Access application covering `/admin/*` and `/api/admin/*` so only the team can reach the editing UI and its write endpoints. Everything else stays public.
5. Once the radio streaming tool is picked, set the `NOW_PLAYING_API_URL` environment variable to its now-playing endpoint and adjust the field mapping in `functions/api/now-playing.js` to match its response shape.

## Known local-dev limitation

`wrangler pages dev` mis-emulates `_redirects` rules that use status `200` (a rewrite) as a real `308` redirect instead — a known gap between local dev and production Cloudflare Pages (see [Cloudflare Community](https://community.cloudflare.com/t/getting-308-permanent-redirect-using-wrangler-pages-dev/674683)). That means `/shows/:slug` pretty URLs will visibly redirect and lose the slug when tested locally, even though they resolve correctly as an invisible rewrite once deployed. Verify pretty show URLs against a real Pages deployment, not just local dev; `templates/show.html` itself can still be sanity-checked directly.

## Known gaps (Figma is still in progress)

- No Color styles defined in Figma yet — the palette in `css/base.css` was pulled directly off the canvas (selection colors), not from named styles. Re-check once the designer adds them.
- Logo is in as a PNG (`assets/icons/logo.png`) with a CSS invert filter for dark pages. It's solid black on a transparent background, so a real SVG export from Figma would scale/print better, but the PNG works fine at the sizes used here.
- `/support-us` only has a Desktop frame in Figma with no content blocks yet — the current page is placeholder copy.
- The `/shows/:slug` detail template in Figma currently just repeats the listing grid rather than showing single-show content — worth flagging back to the designer.
- The now-playing widget only has a "live" state sketched in Figma (plus a loose "offline" text exploration) — loading/error states in `css/components.css` and `js/now-playing.js` are original to this build, not from the file.

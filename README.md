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

GitHub → Cloudflare Pages auto-deploy is **not** connected yet (see checklist below), so pushing to `main` only updates the repo. To actually publish:

```
git push origin main
npm run deploy
```

`npm run deploy` runs `wrangler pages deploy .`, which ships the static files and the `/functions` API together. The project name lives in `wrangler.toml` (`slipradiosite`), so no `--project-name` flag is needed.

## Cloudflare setup checklist

1. ~~Create the Pages project~~ — done (`slipradiosite`, created via `wrangler pages project create`).
2. ~~Create a KV namespace, bind it as `SHOWS`~~ — done. Binding is declared in `wrangler.toml` and Cloudflare picks it up automatically on `wrangler pages deploy` — no separate dashboard binding step needed.
3. ~~Create an R2 bucket, bind it as `THUMBNAILS`~~ — done, same auto-binding via `wrangler.toml`.
4. **Still needed:** connect the Pages project to the `slipradiobaguio-cmyk/slipradiosite` GitHub repo (Pages project → Settings → Builds & deployments → connect repository) so `git push` auto-deploys instead of relying on manual `wrangler pages deploy` runs.
5. **Still needed:** set up a Cloudflare Access application covering `/admin/*` and `/api/admin/*` so only the team can reach the editing UI and its write endpoints. Everything else stays public. Until this is done, `/admin` is unprotected on the live site.
6. Once the radio streaming tool is picked, set the `NOW_PLAYING_API_URL` environment variable (Pages project → Settings → Environment variables) to its now-playing endpoint and adjust the field mapping in `functions/api/now-playing.js` to match its response shape.

## Known local-dev limitation

`wrangler pages dev` mis-emulates `_redirects` rules that use status `200` (a rewrite) as a real `308` redirect instead — a known gap between local dev and production Cloudflare Pages (see [Cloudflare Community](https://community.cloudflare.com/t/getting-308-permanent-redirect-using-wrangler-pages-dev/674683)). That means `/shows/:slug` pretty URLs will visibly redirect and lose the slug when tested locally, even though they resolve correctly as an invisible rewrite once deployed. Verify pretty show URLs against a real Pages deployment, not just local dev; `templates/show.html` itself can still be sanity-checked directly.

## Notable UI decisions

- **No mobile menu toggle.** About/Shows/Support Us sit inline in the header next to the logo on every breakpoint, sized down on mobile so the logo stays the visual anchor. There's no hamburger and no slide-down panel — `js/nav.js` only handles current-page highlighting and the schedule clock now.
- **Single status indicator.** Live/offline/connecting/error state shows once, top-right in the header nav (dot + label, same on mobile and desktop). The bottom now-playing bar no longer has its own boxed status badge; `js/now-playing.js` still drives `.live-indicator`'s `data-state` and label text.
- **Footer stays off-screen until the page is actually scrolled to the end.** `main { min-height: 100vh }` (global, in `css/layout.css`) forces this on every page, including thin ones like `/support-us` — intentional, so it behaves the same once real content fills those pages out.
- **Home hero grid doubles as a mobile carousel.** `.shows-grid--home` (index page only) is a horizontally snapping single-card row under 768px — auto-advances every 3s, pauses while touched, and drives a thin progress scrubber (`.hero-carousel-progress`) that tracks real scroll position. At ≥768px it's a plain static grid and the progress bar just shows full.

## Known gaps (Figma is still in progress)

- No Color styles defined in Figma yet — the palette in `css/base.css` was pulled directly off the canvas (selection colors), not from named styles. Re-check once the designer adds them.
- Logo is in as a PNG (`assets/icons/logo.png`) with a CSS invert filter for dark pages. It's solid black on a transparent background, so a real SVG export from Figma would scale/print better, but the PNG works fine at the sizes used here.
- `/support-us` only has a Desktop frame in Figma with no content blocks yet — the page is intentionally empty (just a hidden `<h1>` for a11y) until that's designed and it's decided how support/donations get collected.
- The `/shows/:slug` detail template in Figma currently just repeats the listing grid rather than showing single-show content — worth flagging back to the designer.
- The now-playing widget only has a "live" state sketched in Figma (plus a loose "offline" text exploration) — loading/error states in `css/components.css` and `js/now-playing.js` are original to this build, not from the file.

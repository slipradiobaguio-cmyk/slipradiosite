(function () {
  const grid = document.querySelector(".shows-grid");
  const heroWrap = document.querySelector("[data-hero-carousel]");
  if (!grid && !heroWrap) return;

  function cardMarkup(show, placeholder, isOnAir) {
    const thumb = show.heroImage
      ? `style="background-image:url('${show.heroImage}')"`
      : "";
    const thumbClass = show.heroImage ? "show-card__thumb" : "show-card__thumb show-card__thumb--empty";
    const tag = placeholder ? "div" : "a";
    const href = placeholder ? "" : ` href="/shows/${show.slug}"`;
    const badge = isOnAir
      ? `<span class="onair-badge show-card__badge"><span class="live-dot" aria-hidden="true"></span>On air now</span>`
      : "";

    return `
      <${tag} class="show-card"${href}>
        <div class="${thumbClass}" ${thumb}>${badge}</div>
        <div class="show-card__meta">
          <div class="show-card__title">${show.title}</div>
          <div class="show-card__sub">${show.guestName || ""}</div>
        </div>
      </${tag}>
    `;
  }

  function placeholderShows(count) {
    return Array.from({ length: count }, () => ({ title: "Show Title", guestName: "Artist" }));
  }

  function initHeroCarousel(track, progressTrack, shows, onAirSlug) {
    const interval = 2500;
    let visible = getVisibleCount();
    let index = 0;
    let timer = null;

    function getVisibleCount() {
      const w = window.innerWidth;
      if (w >= 1440) return 4;
      if (w >= 768) return 2;
      return 1;
    }

    function buildProgress() {
      if (!progressTrack) return;
      progressTrack.innerHTML = shows
        .map(() => `<div class="hero-carousel-progress__seg"></div>`)
        .join("");
    }

    function applyActiveSegments() {
      if (!progressTrack || !shows.length) return;
      const total = shows.length;
      const windowSize = Math.min(visible, total);
      const segs = Array.from(progressTrack.children);
      segs.forEach((seg, i) => {
        const inWindow = Array.from({ length: windowSize }, (_, k) => (index + k) % total).includes(i);
        seg.classList.toggle("is-active", inWindow);
      });
    }

    function applyPosition(animate) {
      const total = shows.length;
      if (!total) return;
      track.style.transition = animate ? "" : "none";
      const extendedLen = total > visible ? total + visible : total;
      track.style.transform = `translateX(-${(index / extendedLen) * 100}%)`;
      if (!animate) track.offsetHeight;
      applyActiveSegments();
    }

    function advance() {
      if (shows.length <= visible) return;
      index++;
      applyPosition(true);
      if (index >= shows.length) {
        setTimeout(() => {
          index = index % shows.length;
          applyPosition(false);
        }, 720);
      }
    }

    function start() {
      stop();
      if (shows.length > visible) timer = setInterval(advance, interval);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function render() {
      if (!shows.length) {
        track.innerHTML = placeholderShows(visible).map((show) => cardMarkup(show, true)).join("");
        buildProgress();
        return;
      }
      const extended = shows.length > visible ? shows.concat(shows.slice(0, visible)) : shows;
      track.innerHTML = extended.map((show) => cardMarkup(show, false, show.slug === onAirSlug)).join("");
      buildProgress();
      applyPosition(false);
    }

    function handleResize() {
      const next = getVisibleCount();
      if (next === visible) return;
      visible = next;
      index = 0;
      render();
      start();
    }

    window.addEventListener("resize", handleResize);
    render();
    start();
  }

  async function load() {
    const target = heroWrap || grid;
    target.setAttribute("aria-busy", "true");
    const limit = grid && grid.dataset.limit ? parseInt(grid.dataset.limit, 10) : null;
    try {
      const [showsRes, nowPlaying] = await Promise.all([
        fetch("/api/shows", { cache: "no-store" }),
        fetch("/api/now-playing", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      if (!showsRes.ok) throw new Error(`shows ${showsRes.status}`);
      let shows = await showsRes.json();
      if (limit) shows = shows.slice(0, limit);
      const onAirSlug = nowPlaying && nowPlaying.live ? nowPlaying.slug : null;

      if (heroWrap) {
        const track = heroWrap.querySelector("[data-hero-track]");
        const progressTrack = document.querySelector("[data-hero-progress]");
        initHeroCarousel(track, progressTrack, shows, onAirSlug);
        return;
      }

      if (!shows.length) {
        grid.innerHTML = placeholderShows(limit || 8).map((show) => cardMarkup(show, true)).join("");
        return;
      }
      grid.innerHTML = shows.map((show) => cardMarkup(show, false, show.slug === onAirSlug)).join("");
    } catch (err) {
      target.innerHTML = `<p class="admin-status" data-tone="error">Couldn't load shows right now.</p>`;
    } finally {
      target.removeAttribute("aria-busy");
    }
  }

  load();
})();

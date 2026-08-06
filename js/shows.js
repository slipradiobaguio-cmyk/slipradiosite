(function () {
  const grid = document.querySelector(".shows-grid");
  if (!grid) {
    if (window.__srHeroCarouselCleanup) {
      window.__srHeroCarouselCleanup();
      window.__srHeroCarouselCleanup = null;
    }
    return;
  }

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

  function initHeroCarousel() {
    if (window.__srHeroCarouselCleanup) {
      window.__srHeroCarouselCleanup();
      window.__srHeroCarouselCleanup = null;
    }
    if (!grid.classList.contains("shows-grid--home")) return;
    const progressTrack = grid.parentElement.querySelector("[data-hero-progress]");
    const interval = 3000;
    let timer = null;
    let cards = [];
    let segments = [];
    let index = 0;

    function buildSegments() {
      if (!progressTrack) return;
      progressTrack.innerHTML = cards
        .map(() => `<div class="hero-carousel-progress__seg"></div>`)
        .join("");
      segments = Array.from(progressTrack.children);
    }

    function applyActive() {
      cards.forEach((card, i) => card.classList.toggle("is-active", i === index));
      segments.forEach((seg, i) => seg.classList.toggle("is-active", i === index));
    }

    function goTo(i) {
      if (!cards.length) return;
      index = ((i % cards.length) + cards.length) % cards.length;
      applyActive();
    }

    function advance() {
      goTo(index + 1);
    }

    function start() {
      stop();
      if (cards.length > 1) timer = setInterval(advance, interval);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function sync() {
      cards = Array.from(grid.querySelectorAll(".show-card"));
      buildSegments();
      index = 0;
      applyActive();
      start();
    }

    sync();

    window.__srHeroCarouselCleanup = () => {
      stop();
    };
  }

  async function load() {
    grid.setAttribute("aria-busy", "true");
    const limit = grid.dataset.limit ? parseInt(grid.dataset.limit, 10) : null;
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
      if (!shows.length) {
        grid.innerHTML = placeholderShows(limit || 8).map((show) => cardMarkup(show, true)).join("");
        return;
      }
      grid.innerHTML = shows.map((show) => cardMarkup(show, false, show.slug === onAirSlug)).join("");
    } catch (err) {
      grid.innerHTML = `<p class="admin-status" data-tone="error">Couldn't load shows right now.</p>`;
    } finally {
      grid.removeAttribute("aria-busy");
      initHeroCarousel();
    }
  }

  load();
})();

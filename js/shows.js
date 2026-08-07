(function () {
  const grid = document.querySelector(".shows-grid");
  const heroWrap = document.querySelector("[data-hero-carousel]");
  if (!grid && !heroWrap) return;

  function cardMarkup(show, placeholder, isOnAir, extraClass) {
    const thumb = show.heroImage
      ? `style="background-image:url('${show.heroImage}')"`
      : "";
    const thumbClass = show.heroImage ? "show-card__thumb" : "show-card__thumb show-card__thumb--empty";
    const tag = placeholder ? "div" : "a";
    const href = placeholder ? "" : ` href="/shows/${show.slug}"`;
    const cardClass = extraClass ? `show-card ${extraClass}` : "show-card";
    const badge = isOnAir
      ? `<span class="onair-badge show-card__badge"><span class="live-dot" aria-hidden="true"></span>On air now</span>`
      : "";

    return `
      <${tag} class="${cardClass}"${href}>
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

  // fades each visible slot's card in place — no sliding, so nothing ever
  // gets clipped by the container edge. Shows are dealt round-robin into
  // `visible` slots, and every slot advances to its next card together.
  function initHeroCarousel(track, progressTrack, shows, onAirSlug) {
    const interval = 2500;
    let visible = getVisibleCount();
    let slots = [];
    let pageIndex = 0;
    let timer = null;

    function getVisibleCount() {
      const w = window.innerWidth;
      if (w >= 1440) return 4;
      if (w >= 768) return 2;
      return 1;
    }

    function partition() {
      const groups = Array.from({ length: visible }, () => []);
      shows.forEach((show, i) => groups[i % visible].push({ show, originalIndex: i }));
      return groups;
    }

    function buildProgress() {
      if (!progressTrack) return;
      progressTrack.innerHTML = shows
        .map(() => `<div class="hero-carousel-progress__seg"></div>`)
        .join("");
    }

    function applyActiveSegments() {
      if (!progressTrack || !shows.length) return;
      const activeIndices = new Set(
        slots.map((cards) => (cards.length ? cards[pageIndex % cards.length].originalIndex : -1))
      );
      Array.from(progressTrack.children).forEach((seg, i) => {
        seg.classList.toggle("is-active", activeIndices.has(i));
      });
    }

    function render() {
      if (!shows.length) {
        track.innerHTML = placeholderShows(visible)
          .map((show) => `<div class="hero-carousel__slot">${cardMarkup(show, true)}</div>`)
          .join("");
        buildProgress();
        return;
      }
      slots = partition();
      pageIndex = 0;
      track.innerHTML = slots
        .map((cards) => {
          const cardsHtml = cards
            .map((c, p) => cardMarkup(c.show, false, c.show.slug === onAirSlug, p === 0 ? "is-active" : ""))
            .join("");
          return `<div class="hero-carousel__slot">${cardsHtml}</div>`;
        })
        .join("");
      buildProgress();
      applyActiveSegments();
    }

    function maxSlotLength() {
      return slots.reduce((max, cards) => Math.max(max, cards.length), 0);
    }

    function advance() {
      if (maxSlotLength() <= 1) return;
      pageIndex++;
      Array.from(track.children).forEach((slotEl, i) => {
        const cards = slots[i];
        if (!cards.length) return;
        const cardEls = Array.from(slotEl.children);
        cardEls.forEach((el) => el.classList.remove("is-active"));
        cardEls[pageIndex % cards.length].classList.add("is-active");
      });
      applyActiveSegments();
    }

    function start() {
      stop();
      if (maxSlotLength() > 1) timer = setInterval(advance, interval);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function handleResize() {
      const next = getVisibleCount();
      if (next === visible) return;
      visible = next;
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

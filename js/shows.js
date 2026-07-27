(function () {
  const grid = document.querySelector(".shows-grid");
  if (!grid) return;

  function cardMarkup(show, placeholder) {
    const thumb = show.heroImage
      ? `style="background-image:url('${show.heroImage}')"`
      : "";
    const thumbClass = show.heroImage ? "show-card__thumb" : "show-card__thumb show-card__thumb--empty";
    const tag = placeholder ? "div" : "a";
    const href = placeholder ? "" : ` href="/shows/${show.slug}"`;

    return `
      <${tag} class="show-card"${href}>
        <div class="${thumbClass}" ${thumb}></div>
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
    if (!grid.classList.contains("shows-grid--home")) return;
    const progressFill = grid.parentElement.querySelector(".hero-carousel-progress__fill");
    const mq = window.matchMedia("(max-width: 767.98px)");
    let timer = null;

    function advance() {
      const cards = grid.querySelectorAll(".show-card");
      if (cards.length < 2) return;
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      const step = cards[0].getBoundingClientRect().width + gap;
      const atEnd = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 1;
      grid.scrollTo({ left: atEnd ? 0 : grid.scrollLeft + step, behavior: "smooth" });
    }

    function updateProgress() {
      if (!progressFill) return;
      if (!mq.matches) {
        progressFill.style.transform = "scaleX(1)";
        return;
      }
      const scrollable = grid.scrollWidth - grid.clientWidth;
      const ratio = scrollable > 0 ? grid.scrollLeft / scrollable : 1;
      progressFill.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
    }

    function start() {
      stop();
      timer = setInterval(advance, 3000);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function sync() {
      if (mq.matches) start();
      else stop();
      updateProgress();
    }

    grid.addEventListener("scroll", updateProgress, { passive: true });
    grid.addEventListener("touchstart", stop, { passive: true });
    grid.addEventListener("touchend", () => sync(), { passive: true });
    mq.addEventListener("change", sync);
    sync();
  }

  async function load() {
    grid.setAttribute("aria-busy", "true");
    const limit = grid.dataset.limit ? parseInt(grid.dataset.limit, 10) : null;
    try {
      const res = await fetch("/api/shows", { cache: "no-store" });
      if (!res.ok) throw new Error(`shows ${res.status}`);
      let shows = await res.json();
      if (limit) shows = shows.slice(0, limit);
      if (!shows.length) {
        grid.innerHTML = placeholderShows(limit || 8).map((show) => cardMarkup(show, true)).join("");
        return;
      }
      grid.innerHTML = shows.map((show) => cardMarkup(show, false)).join("");
    } catch (err) {
      grid.innerHTML = `<p class="admin-status" data-tone="error">Couldn't load shows right now.</p>`;
    } finally {
      grid.removeAttribute("aria-busy");
      initHeroCarousel();
    }
  }

  load();
})();

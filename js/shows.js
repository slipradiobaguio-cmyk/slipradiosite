(function () {
  const grid = document.querySelector(".shows-grid");
  if (!grid) return;

  function cardMarkup(show) {
    const thumb = show.heroImage
      ? `style="background-image:url('${show.heroImage}')"`
      : "";
    const thumbClass = show.heroImage ? "show-card__thumb" : "show-card__thumb show-card__thumb--empty";

    return `
      <a class="show-card" href="/shows/${show.slug}">
        <div class="${thumbClass}" ${thumb}></div>
        <div class="show-card__meta">
          <div class="show-card__title">${show.title}</div>
          <div class="show-card__sub">${show.guestName || ""}</div>
        </div>
      </a>
    `;
  }

  async function load() {
    grid.setAttribute("aria-busy", "true");
    try {
      const res = await fetch("/api/shows", { cache: "no-store" });
      if (!res.ok) throw new Error(`shows ${res.status}`);
      let shows = await res.json();
      const limit = grid.dataset.limit ? parseInt(grid.dataset.limit, 10) : null;
      if (limit) shows = shows.slice(0, limit);
      if (!shows.length) {
        grid.innerHTML = `<p class="admin-status">No shows posted yet.</p>`;
        return;
      }
      grid.innerHTML = shows.map(cardMarkup).join("");
    } catch (err) {
      grid.innerHTML = `<p class="admin-status" data-tone="error">Couldn't load shows right now.</p>`;
    } finally {
      grid.removeAttribute("aria-busy");
    }
  }

  load();
})();

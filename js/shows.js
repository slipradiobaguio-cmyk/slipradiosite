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
    }
  }

  load();
})();

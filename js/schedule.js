(function () {
  const container = document.querySelector("[data-schedule-rows]");
  if (!container) return;

  function todayISO() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function parseTimeRange(time) {
    const match = (time || "").match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const [, sh, sm, eh, em] = match;
    return {
      startMin: Number(sh) * 60 + Number(sm),
      endMin: Number(eh) * 60 + Number(em),
    };
  }

  function rowMarkup(show, isLive) {
    return `
      <a class="schedule__row${isLive ? " schedule__row--live" : ""}" href="/shows/${show.slug}">
        <span class="schedule__time">${show.time || "TBA"}</span>
        <span class="schedule__show">
          <span class="schedule__show-title">${show.title}</span>
          <span class="schedule__artist">${show.guestName || ""}</span>
        </span>
        <span class="schedule__genres">${show.genres || ""}</span>
      </a>
    `;
  }

  async function load() {
    try {
      const res = await fetch("/api/shows", { cache: "no-store" });
      if (!res.ok) throw new Error(`shows ${res.status}`);
      const shows = await res.json();
      const today = todayISO();
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

      const todaysShows = shows
        .filter((show) => show.date === today)
        .map((show) => ({ show, range: parseTimeRange(show.time) }))
        .sort((a, b) => (a.range?.startMin ?? 0) - (b.range?.startMin ?? 0));

      if (!todaysShows.length) {
        container.innerHTML = `<p class="schedule__empty">No shows scheduled today.</p>`;
        return;
      }

      container.innerHTML = todaysShows
        .map(({ show, range }) => {
          const isLive = range ? nowMin >= range.startMin && nowMin < range.endMin : false;
          return rowMarkup(show, isLive);
        })
        .join("");
    } catch (err) {
      container.innerHTML = `<p class="schedule__empty">Couldn't load today's schedule.</p>`;
    } finally {
      container.removeAttribute("aria-busy");
    }
  }

  load();
})();

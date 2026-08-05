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

  function formatDateShort(dateStr) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function to12Hour(hStr, mStr) {
    const h = Number(hStr);
    const m = Number(mStr);
    const period = h < 12 ? "AM" : "PM";
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return { h12, m, period };
  }

  function formatTimeRange(time) {
    if (!time) return "TBA";
    const match = time.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
    if (!match) return time;
    const [, sh, sm, eh, em] = match;
    const start = to12Hour(sh, sm);
    const end = to12Hour(eh, em);
    const showMinutes = start.m !== 0 || end.m !== 0;
    const startStr = showMinutes ? `${start.h12}:${String(start.m).padStart(2, "0")}` : `${start.h12}`;
    const endStr = showMinutes ? `${end.h12}:${String(end.m).padStart(2, "0")}` : `${end.h12}`;
    return start.period === end.period
      ? `${startStr}–${endStr} ${end.period}`
      : `${startStr} ${start.period}–${endStr} ${end.period}`;
  }

  function rowMarkup(show, isLive) {
    const time = formatTimeRange(show.time);
    return `
      <a class="schedule__row${isLive ? " schedule__row--live" : ""}" href="/shows/${show.slug}">
        <span class="schedule__time">${time}</span>
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

      const upcomingShows = shows
        .filter((show) => show.date > today)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1;
          return (parseTimeRange(a.time)?.startMin ?? 0) - (parseTimeRange(b.time)?.startMin ?? 0);
        })
        .slice(0, 5);

      if (!todaysShows.length && !upcomingShows.length) {
        container.innerHTML = `<p class="schedule__empty">No shows scheduled.</p>`;
        return;
      }

      let html = todaysShows.length
        ? todaysShows
            .map(({ show, range }) => {
              const isLive = range ? nowMin >= range.startMin && nowMin < range.endMin : false;
              return rowMarkup(show, isLive);
            })
            .join("")
        : `<p class="schedule__empty">No shows scheduled today.</p>`;

      if (upcomingShows.length) {
        html += `<div class="schedule__group">Upcoming</div>`;
        let lastDate = null;
        upcomingShows.forEach((show) => {
          if (show.date !== lastDate) {
            html += `<div class="schedule__date">${formatDateShort(show.date)}</div>`;
            lastDate = show.date;
          }
          html += rowMarkup(show, false);
        });
      }

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<p class="schedule__empty">Couldn't load today's schedule.</p>`;
    } finally {
      container.removeAttribute("aria-busy");
    }
  }

  load();
})();

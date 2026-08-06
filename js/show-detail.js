(function () {
  const root = document.querySelector("[data-show-detail]");
  if (!root) return;

  const slug = window.location.pathname.replace(/^\/shows\//, "").replace(/\/$/, "");

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  // show.time is free text like "16:00 - 18:00" from the admin form —
  // convert for display only
  function fmtTime(time) {
    if (!time) return "";
    const match = time.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
    if (!match) return time;
    const [, sh, sm, eh, em] = match;
    const to12 = (hStr, mStr) => {
      const h = Number(hStr);
      const m = Number(mStr);
      const period = h < 12 ? "AM" : "PM";
      let h12 = h % 12;
      if (h12 === 0) h12 = 12;
      return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
    };
    return `${to12(sh, sm)} – ${to12(eh, em)}`;
  }

  async function load() {
    root.setAttribute("aria-busy", "true");
    try {
      const [res, nowPlaying] = await Promise.all([
        fetch(`/api/shows/${encodeURIComponent(slug)}`, { cache: "no-store" }),
        fetch("/api/now-playing", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      if (!res.ok) throw new Error(`show ${res.status}`);
      const show = await res.json();

      const isOnAir = Boolean(nowPlaying && nowPlaying.live && nowPlaying.slug === slug);
      root.querySelector("[data-field='onair']").hidden = !isOnAir;

      root.querySelector("[data-field='hero']").style.backgroundImage = show.heroImage
        ? `url('${show.heroImage}')`
        : "";
      root.querySelector("[data-field='title']").textContent = show.title || "";
      root.querySelector("[data-field='guestName']").textContent = show.guestName || "";
      root.querySelector("[data-field='dateTime']").textContent = [fmtDate(show.date), fmtTime(show.time)]
        .filter(Boolean)
        .join(" · ");
      root.querySelector("[data-field='genres']").textContent = show.genres || "";
      root.querySelector("[data-field='description']").textContent = show.description || "";

      const socialLink = root.querySelector("[data-field='socialLink']");
      if (show.socialLink) {
        socialLink.href = show.socialLink;
        socialLink.hidden = false;
      } else {
        socialLink.hidden = true;
      }
    } catch (err) {
      root.innerHTML = `<p class="admin-status" data-tone="error">Couldn't load this show.</p>`;
    } finally {
      root.removeAttribute("aria-busy");
    }
  }

  load();
})();

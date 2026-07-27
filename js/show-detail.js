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

  async function load() {
    root.setAttribute("aria-busy", "true");
    try {
      const res = await fetch(`/api/shows/${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`show ${res.status}`);
      const show = await res.json();

      root.querySelector("[data-field='hero']").style.backgroundImage = show.heroImage
        ? `url('${show.heroImage}')`
        : "";
      root.querySelector("[data-field='title']").textContent = show.title || "";
      root.querySelector("[data-field='guestName']").textContent = show.guestName || "";
      root.querySelector("[data-field='dateTime']").textContent = [fmtDate(show.date), show.time]
        .filter(Boolean)
        .join(" · ");
      root.querySelector("[data-field='genres']").textContent = show.genres || "";
      root.querySelector("[data-field='shortDescription']").textContent = show.shortDescription || "";
      root.querySelector("[data-field='longDescription']").textContent = show.longDescription || "";
      root.querySelector("[data-field='bio']").textContent = show.bio || "";

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

(function () {
  const form = document.querySelector("[data-admin-form]");
  if (!form) return;

  const statusEl = document.querySelector("[data-admin-status]");
  const listEmptyEl = document.querySelector("[data-list-empty]");
  const formTitleEl = document.querySelector("[data-form-title]");
  const tabButtons = document.querySelectorAll("[data-tab-button]");
  const tabPanels = document.querySelectorAll("[data-tab-panel]");
  const groups = {
    today: document.querySelector("[data-group='today']"),
    upcoming: document.querySelector("[data-group='upcoming']"),
    past: document.querySelector("[data-group='past']"),
  };
  const lists = {
    today: document.querySelector("[data-admin-list='today']"),
    upcoming: document.querySelector("[data-admin-list='upcoming']"),
    past: document.querySelector("[data-admin-list='past']"),
  };
  const groupCounts = {
    today: document.querySelector("[data-group-count='today']"),
    upcoming: document.querySelector("[data-group-count='upcoming']"),
    past: document.querySelector("[data-group-count='past']"),
  };

  const fields = ["title", "slug", "genres", "date", "time", "guestName", "socialLink", "description"];
  let editingSlug = null;
  let onAirSlug = null;
  let cachedShows = [];

  const banner = document.querySelector("[data-onair-banner]");
  const bannerLabel = document.querySelector("[data-onair-banner-label]");

  const ICONS = {
    view: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2"/></svg>',
    edit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M11 2l3 3-8 8-3.5.5.5-3.5 8-8z"/></svg>',
    live: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M8 2v12M4.5 5a5 5 0 000 6M11.5 5a5 5 0 010 6M2.3 3a8 8 0 000 10M13.7 3a8 8 0 010 10"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>',
    delete: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M6 4V2.5h4V4M4 4l.6 9a1 1 0 001 .9h4.8a1 1 0 001-.9L12 4"/></svg>',
  };

  const timeInput = form.elements.namedItem("time");
  const timePreset = form.querySelector("[data-time-preset]");

  function syncTimeInputVisibility() {
    timeInput.hidden = timePreset.value !== "custom";
  }

  timePreset.addEventListener("change", () => {
    if (timePreset.value && timePreset.value !== "custom") {
      timeInput.value = timePreset.value;
    }
    syncTimeInputVisibility();
    if (timePreset.value === "custom") timeInput.focus();
  });
  syncTimeInputVisibility();

  function showTab(name) {
    tabPanels.forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== name;
    });
    tabButtons.forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.tabButton === name));
    });
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.tabButton === "form" && !editingSlug) resetForm();
      showTab(button.dataset.tabButton);
    });
  });

  function setStatus(message, tone) {
    statusEl.textContent = message || "";
    if (tone) statusEl.dataset.tone = tone;
    else statusEl.removeAttribute("data-tone");
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function todayISO() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function cardMarkup(show) {
    const thumb = show.heroImage ? `style="background-image:url('${show.heroImage}')"` : "";
    const isOnAir = show.slug === onAirSlug;
    const badge = isOnAir
      ? `<span class="admin-card__badge"><span class="live-dot" aria-hidden="true"></span>On air</span>`
      : "";
    return `
      <article class="admin-card" data-slug="${show.slug}">
        <div class="admin-card__thumb${show.heroImage ? "" : " admin-card__thumb--empty"}" ${thumb}>${badge}</div>
        <div class="admin-card__meta">
          <div class="admin-card__title">${show.title}</div>
          <div class="admin-card__sub">${show.guestName || ""} · ${show.date || "no date"}${show.time ? ` · ${show.time}` : ""}</div>
        </div>
        <div class="admin-card__actions">
          <a class="icon-btn" href="/shows/${show.slug}" target="_blank" rel="noopener" aria-label="View show page">${ICONS.view}<span class="visually-hidden">View</span></a>
          <button type="button" class="icon-btn" data-action="edit" aria-label="Edit show">${ICONS.edit}<span class="visually-hidden">Edit</span></button>
          <button type="button" class="icon-btn icon-btn--live" data-action="toggle-live" aria-pressed="${isOnAir}" aria-label="${isOnAir ? "Clear on-air status" : "Mark this show on air"}">${ICONS.live}<span class="visually-hidden">${isOnAir ? "On air" : "Go live"}</span></button>
          <button type="button" class="icon-btn icon-btn--danger" data-action="delete" aria-label="Delete show">${ICONS.delete}<span class="visually-hidden">Delete</span></button>
        </div>
      </article>
    `;
  }

  function updateBanner() {
    if (!banner) return;
    const onAirShow = cachedShows.find((show) => show.slug === onAirSlug);
    banner.dataset.state = onAirShow ? "live" : "offline";
    bannerLabel.textContent = onAirShow ? `On air — ${onAirShow.title}` : "Nothing marked on air";
  }

  async function loadOnAirStatus() {
    const res = await fetch("/api/admin/live", { cache: "no-store" });
    if (!res.ok) throw new Error(`live ${res.status}`);
    const { onAir } = await res.json();
    onAirSlug = onAir;
  }

  function renderLists() {
    const today = todayISO();

    const buckets = { today: [], upcoming: [], past: [] };
    cachedShows.forEach((show) => {
      if (show.date === today) buckets.today.push(show);
      else if (show.date && show.date < today) buckets.past.push(show);
      else buckets.upcoming.push(show);
    });

    buckets.today.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    buckets.upcoming.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    buckets.past.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    listEmptyEl.hidden = cachedShows.length > 0;

    Object.keys(buckets).forEach((key) => {
      const items = buckets[key];
      groups[key].hidden = items.length === 0;
      lists[key].innerHTML = items.map(cardMarkup).join("");
      if (groupCounts[key]) groupCounts[key].textContent = items.length;
    });

    updateBanner();
  }

  async function loadList() {
    const [, res] = await Promise.all([
      loadOnAirStatus().catch(() => {}),
      fetch("/api/shows", { cache: "no-store" }),
    ]);
    if (!res.ok) throw new Error(`shows ${res.status}`);
    cachedShows = await res.json();
    renderLists();
  }

  function fillForm(show) {
    fields.forEach((key) => {
      const input = form.elements.namedItem(key);
      if (input) input.value = show[key] || "";
    });
    const matchingPreset = [...timePreset.options].some((opt) => opt.value === show.time);
    timePreset.value = show.time ? (matchingPreset ? show.time : "custom") : "";
    syncTimeInputVisibility();
    form.querySelector("[data-field='heroImagePreview']").style.backgroundImage = show.heroImage
      ? `url('${show.heroImage}')`
      : "";
    form.dataset.heroImage = show.heroImage || "";
    editingSlug = show.slug;
    formTitleEl.textContent = `Edit "${show.title}"`;
    setStatus("");
    showTab("form");
  }

  function resetForm() {
    form.reset();
    form.querySelector("[data-field='heroImagePreview']").style.backgroundImage = "";
    form.dataset.heroImage = "";
    editingSlug = null;
    formTitleEl.textContent = "Add a show";
    setStatus("");
    syncTimeInputVisibility();
  }

  form.elements.namedItem("title").addEventListener("input", (e) => {
    if (!editingSlug) {
      form.elements.namedItem("slug").value = slugify(e.target.value);
    }
  });

  const fileInput = form.querySelector("input[type='file']");
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    setStatus("Uploading thumbnail…");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      const { url } = await res.json();
      form.dataset.heroImage = url;
      form.querySelector("[data-field='heroImagePreview']").style.backgroundImage = `url('${url}')`;
      setStatus("Thumbnail uploaded.");
    } catch (err) {
      setStatus("Thumbnail upload failed.", "error");
    }
  });

  async function findExisting(slug) {
    const res = await fetch(`/api/shows/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {};
    fields.forEach((key) => {
      payload[key] = form.elements.namedItem(key).value.trim();
    });
    payload.heroImage = form.dataset.heroImage || "";

    if (!payload.title || !payload.slug) {
      setStatus("Title and slug are required.", "error");
      return;
    }

    if (payload.slug !== editingSlug) {
      const existing = await findExisting(payload.slug);
      if (existing) {
        const proceed = confirm(
          `A show already exists at slug "${payload.slug}" ("${existing.title}"). Save anyway and overwrite it?`
        );
        if (!proceed) {
          setStatus("Save cancelled — pick a different slug.", "error");
          return;
        }
      }
    }

    setStatus("Saving…");
    try {
      const res = await fetch(`/api/admin/shows/${encodeURIComponent(payload.slug)}`, {
        method: editingSlug ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`save ${res.status}`);

      if (editingSlug && editingSlug !== payload.slug) {
        await fetch(`/api/admin/shows/${encodeURIComponent(editingSlug)}`, { method: "DELETE" });
      }

      setStatus("Saved.");
      resetForm();
      showTab("list");
      await loadList();
    } catch (err) {
      console.error(err);
      setStatus("Couldn't save — try again.", "error");
    }
  });

  form.querySelector("[data-action='cancel']").addEventListener("click", () => {
    resetForm();
    showTab("list");
  });

  Object.values(lists).forEach((list) => {
    list.addEventListener("click", async (e) => {
      const button = e.target.closest("button[data-action]");
      if (!button) return;
      const row = button.closest("[data-slug]");
      const slug = row.dataset.slug;

      if (button.dataset.action === "edit") {
        const res = await fetch(`/api/shows/${encodeURIComponent(slug)}`);
        if (res.ok) fillForm(await res.json());
        return;
      }

      if (button.dataset.action === "toggle-live") {
        const goingLive = slug !== onAirSlug;
        button.disabled = true;
        try {
          const res = await fetch(`/api/admin/shows/${encodeURIComponent(slug)}/live`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ onAir: goingLive }),
          });
          if (!res.ok) throw new Error(`live ${res.status}`);
          const { onAir } = await res.json();
          onAirSlug = onAir;
          renderLists();
          setStatus(goingLive ? `Marked "${row.querySelector(".admin-card__title").textContent}" on air.` : "Cleared on-air status.");
        } catch (err) {
          setStatus("Couldn't update on-air status — try again.", "error");
        } finally {
          button.disabled = false;
        }
        return;
      }

      if (button.dataset.action === "delete") {
        if (!confirm(`Delete "${slug}"? This can't be undone.`)) return;
        setStatus("Deleting…");
        try {
          const res = await fetch(`/api/admin/shows/${encodeURIComponent(slug)}`, { method: "DELETE" });
          if (!res.ok) throw new Error(`delete ${res.status}`);
          setStatus("Deleted.");
          await loadList();
        } catch (err) {
          setStatus("Couldn't delete — try again.", "error");
        }
      }
    });
  });

  loadList().catch(() => setStatus("Couldn't load shows.", "error"));
})();

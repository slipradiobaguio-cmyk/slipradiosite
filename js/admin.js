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
    kebab: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="8" cy="13" r="1.3"/></svg>',
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

  function scheduleRowMarkup(show) {
    const thumb = show.heroImage ? `style="background-image:url('${show.heroImage}')"` : "";
    const isOnAir = show.slug === onAirSlug;
    return `
      <tr data-slug="${show.slug}">
        <td><div class="admin-thumb admin-schedule__thumb${show.heroImage ? "" : " admin-thumb--empty"}" ${thumb}></div></td>
        <td class="admin-schedule__title">${show.title}</td>
        <td>${show.guestName || ""}</td>
        <td>${show.date || "no date"}${show.time ? ` · ${show.time}` : ""}</td>
        <td class="admin-schedule__status">${isOnAir ? "● On air" : ""}</td>
        <td>
          <div class="admin-schedule__actions">
            <a class="icon-btn" href="/shows/${show.slug}" target="_blank" rel="noopener" aria-label="View show page">${ICONS.view}</a>
            <button type="button" class="icon-btn" data-action="edit" aria-label="Edit show">${ICONS.edit}</button>
            <button type="button" class="icon-btn icon-btn--live" data-action="toggle-live" aria-pressed="${isOnAir}" aria-label="${isOnAir ? "Clear on-air status" : "Mark this show on air"}">${ICONS.live}</button>
            <button type="button" class="icon-btn icon-btn--danger" data-action="delete" aria-label="Delete show">${ICONS.delete}</button>
          </div>
        </td>
      </tr>
    `;
  }

  function compactRowMarkup(show) {
    const thumb = show.heroImage ? `style="background-image:url('${show.heroImage}')"` : "";
    const isOnAir = show.slug === onAirSlug;
    const meta = `${show.guestName || ""} · ${show.date || "no date"}${show.time ? ` · ${show.time}` : ""}`;
    return `
      <div class="admin-compact-row" data-slug="${show.slug}">
        <div class="admin-thumb admin-compact-row__thumb${show.heroImage ? "" : " admin-thumb--empty"}" ${thumb}></div>
        <div class="admin-compact-row__body">
          <div class="admin-compact-row__title">${show.title}</div>
          <div class="admin-compact-row__meta${isOnAir ? " admin-compact-row__meta--live" : ""}">${isOnAir ? "● On air · " : ""}${meta}</div>
        </div>
        <button type="button" class="kebab-btn" data-action="menu-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Show actions for ${show.title}">${ICONS.kebab}</button>
        <div class="kebab-menu" hidden>
          <a class="kebab-menu__item" href="/shows/${show.slug}" target="_blank" rel="noopener">View</a>
          <button type="button" class="kebab-menu__item" data-action="edit">Edit</button>
          <button type="button" class="kebab-menu__item kebab-menu__item--live" data-action="toggle-live" aria-pressed="${isOnAir}">${isOnAir ? "Clear on air" : "Mark on air"}</button>
          <button type="button" class="kebab-menu__item kebab-menu__item--danger" data-action="delete">Delete</button>
        </div>
      </div>
    `;
  }

  function closeAllMenus() {
    document.querySelectorAll(".kebab-menu").forEach((menu) => {
      menu.hidden = true;
      const btn = menu.previousElementSibling;
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
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
      lists[key].innerHTML = `
        <table class="admin-schedule">
          <thead><tr><th></th><th>Show</th><th>Guest</th><th>When</th><th>Status</th><th></th></tr></thead>
          <tbody>${items.map(scheduleRowMarkup).join("")}</tbody>
        </table>
        <div class="admin-compact-list">${items.map(compactRowMarkup).join("")}</div>
      `;
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

  const MAX_THUMB_DIMENSION = 1600;
  const THUMB_WEBP_QUALITY = 0.82;

  async function prepareThumbnail(file) {
    if (!("createImageBitmap" in window) || typeof OffscreenCanvas === "undefined") {
      return file;
    }
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return file;
    }
    const scale = Math.min(1, MAX_THUMB_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    try {
      const blob = await canvas.convertToBlob({ type: "image/webp", quality: THUMB_WEBP_QUALITY });
      if (blob.type !== "image/webp") return file;
      return blob;
    } catch {
      return file;
    }
  }

  const fileInput = form.querySelector("input[type='file']");
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    setStatus("Uploading thumbnail…");
    try {
      const upload = await prepareThumbnail(file);
      const body = new FormData();
      body.append("file", upload, upload === file ? file.name : "thumbnail.webp");
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

      if (button.dataset.action === "menu-toggle") {
        const menu = button.nextElementSibling;
        const willOpen = menu.hidden;
        closeAllMenus();
        menu.hidden = !willOpen;
        button.setAttribute("aria-expanded", String(willOpen));
        return;
      }

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
          const show = cachedShows.find((s) => s.slug === slug);
          renderLists();
          setStatus(goingLive ? `Marked "${show ? show.title : slug}" on air.` : "Cleared on-air status.");
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

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".admin-compact-row")) closeAllMenus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllMenus();
  });

  loadList().catch(() => setStatus("Couldn't load shows.", "error"));
})();

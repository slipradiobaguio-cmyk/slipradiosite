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

  const chatFeed = document.querySelector("[data-admin-chat-feed]");
  const chatForm = document.querySelector("[data-admin-chat-form]");
  const chatInput = document.querySelector("[data-admin-chat-input]");
  let chatPollTimer = null;
  let cachedChatMessages = [];

  const banner = document.querySelector("[data-onair-banner]");
  const bannerLabel = document.querySelector("[data-onair-banner-label]");

  const submissionsList = document.querySelector("[data-submissions-list]");
  const submissionsEmpty = document.querySelector("[data-submissions-empty]");
  const submissionsBadge = document.querySelector("[data-submissions-badge]");
  let cachedSubmissions = [];

  const slotForm = document.querySelector("[data-slot-form]");
  const slotsList = document.querySelector("[data-slots-list]");
  const slotsEmpty = document.querySelector("[data-slots-empty]");
  let cachedSlots = [];

  const slotTimePreset = slotForm.querySelector("[data-slot-time-preset]");
  const slotCustomTime = slotForm.querySelector("[data-slot-custom-time]");
  const slotStartInput = slotForm.elements.namedItem("startTime");
  const slotEndInput = slotForm.elements.namedItem("endTime");

  function syncSlotTimeVisibility() {
    slotCustomTime.hidden = slotTimePreset.value !== "custom";
  }

  slotTimePreset.addEventListener("change", () => {
    if (slotTimePreset.value && slotTimePreset.value !== "custom") {
      const [start, end] = slotTimePreset.value.split(" - ");
      slotStartInput.value = start;
      slotEndInput.value = end;
    }
    syncSlotTimeVisibility();
    if (slotTimePreset.value === "custom") slotStartInput.focus();
  });
  syncSlotTimeVisibility();

  const ICONS = {
    view: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2"/></svg>',
    edit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M11 2l3 3-8 8-3.5.5.5-3.5 8-8z"/></svg>',
    live: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M8 2v12M4.5 5a5 5 0 000 6M11.5 5a5 5 0 010 6M2.3 3a8 8 0 000 10M13.7 3a8 8 0 010 10"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>',
    delete: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M6 4V2.5h4V4M4 4l.6 9a1 1 0 001 .9h4.8a1 1 0 001-.9L12 4"/></svg>',
    kebab: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="8" cy="13" r="1.3"/></svg>',
    ban: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M3.8 3.8l8.4 8.4"/></svg>',
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

    if (name === "chat") {
      loadChat().catch(() => setStatus("Couldn't load chat.", "error"));
      if (!chatPollTimer) chatPollTimer = setInterval(() => loadChat().catch(() => {}), 4000);
    } else if (chatPollTimer) {
      clearInterval(chatPollTimer);
      chatPollTimer = null;
    }

    if (name === "submissions") loadSubmissions().catch(() => setStatus("Couldn't load submissions.", "error"));
    if (name === "schedule") loadSlots().catch(() => setStatus("Couldn't load the schedule.", "error"));
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

  const SETUP_LABELS = { digital: "Digital", vinyl: "Vinyl", hybrid: "Hybrid" };

  // personalized per submission + its current status, so the compose panel
  // opens with a relevant draft instead of a blank/generic one every time
  function composeDefaults(sub) {
    const showName = sub.showName || sub.djName;
    const slotText = sub.slotDate ? `${sub.slotDate}, ${sub.slotStart}–${sub.slotEnd}` : "your requested time";

    if (sub.status === "accepted") {
      return {
        subject: `You're confirmed — "${showName}" on slip radio`,
        message: `Hi ${sub.djName},\n\nYou're confirmed to play "${showName}" on ${slotText}. We'll follow up with studio details soon.\n\n— slip radio`,
      };
    }
    if (sub.status === "declined") {
      return {
        subject: `About your "${showName}" submission`,
        message: `Hi ${sub.djName},\n\nThanks so much for applying to play "${showName}" — we're not able to fit it in this time around, but we'd love to hear from you again for a future season.\n\n— slip radio`,
      };
    }
    return {
      subject: `Re: your "${showName}" submission`,
      message: `Hi ${sub.djName},\n\n`,
    };
  }

  function submissionRowMarkup(sub) {
    const slotText = sub.slotDate ? `${sub.slotDate} · ${sub.slotStart}–${sub.slotEnd}` : "No timeslot";
    const photo = sub.photoUrl ? `style="background-image:url('${sub.photoUrl}')"` : "";
    const draft = composeDefaults(sub);
    return `
      <div class="sub-row" data-id="${sub.id}">
        <button type="button" class="sub-row__summary" data-action="toggle">
          <span class="admin-thumb sub-row__thumb${sub.photoUrl ? "" : " admin-thumb--empty"}" ${photo}></span>
          <span class="sub-row__name">${escapeHtml(sub.showName || sub.djName)}</span>
          <span class="sub-row__meta">by ${escapeHtml(sub.djName)} · ${escapeHtml(slotText)} · ${SETUP_LABELS[sub.setup] || escapeHtml(sub.setup)}</span>
          <span class="sub-row__status sub-row__status--${sub.status}">${sub.status}</span>
          <span class="sub-row__chevron" aria-hidden="true">▾</span>
        </button>
        <div class="sub-row__detail" data-detail hidden>
          <div class="admin-submission__meta">${escapeHtml(sub.email)} · ${escapeHtml(sub.phone)} · ${escapeHtml(sub.location)}</div>
          <div class="admin-submission__meta">IG: ${escapeHtml(sub.instagram)} · Genres: ${escapeHtml(sub.genres)}</div>
          ${sub.mixLink ? `<div class="admin-submission__meta"><a href="${escapeHtml(sub.mixLink)}" target="_blank" rel="noopener">Mix link ↗</a></div>` : ""}
          <p class="admin-submission__bio">${escapeHtml(sub.bio)}</p>
          <div class="admin-submission__actions">
            ${sub.status !== "accepted" ? `<button type="button" class="btn" data-action="accept">Accept</button>` : ""}
            ${sub.status !== "declined" ? `<button type="button" class="btn" data-action="decline">Decline</button>` : ""}
            <button type="button" class="btn" data-action="email">Email</button>
            <button type="button" class="btn btn--danger" data-action="delete">Delete</button>
          </div>
          <form class="admin-compose" data-compose hidden>
            <div>
              <label>To</label>
              <input type="text" value="${escapeHtml(sub.email)}" disabled>
            </div>
            <div>
              <label>Subject</label>
              <input type="text" name="subject" value="${escapeHtml(draft.subject)}" required>
            </div>
            <div>
              <label>Message</label>
              <textarea name="message" required>${escapeHtml(draft.message)}</textarea>
            </div>
            <p class="admin-compose__status" data-compose-status></p>
            <div class="admin-compose__actions">
              <button type="submit" class="btn btn--primary">Send</button>
              <button type="button" class="btn" data-action="compose-cancel">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderSubmissions() {
    submissionsEmpty.hidden = cachedSubmissions.length > 0;
    submissionsList.innerHTML = cachedSubmissions.map(submissionRowMarkup).join("");
    const newCount = cachedSubmissions.filter((s) => s.status === "new").length;
    if (submissionsBadge) {
      submissionsBadge.textContent = String(newCount);
      submissionsBadge.hidden = newCount === 0;
    }
  }

  async function loadSubmissions() {
    const res = await fetch("/api/admin/submissions", { cache: "no-store" });
    if (!res.ok) throw new Error(`submissions ${res.status}`);
    cachedSubmissions = await res.json();
    renderSubmissions();
  }

  submissionsList.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest("[data-id]");
    const id = row.dataset.id;
    const sub = cachedSubmissions.find((s) => s.id === id);
    const action = button.dataset.action;

    if (action === "toggle") {
      const detail = row.querySelector("[data-detail]");
      const willOpen = detail.hidden;
      detail.hidden = !willOpen;
      row.classList.toggle("sub-row--open", willOpen);
      return;
    }

    if (action === "accept" || action === "decline") {
      const status = action === "accept" ? "accepted" : "declined";
      try {
        const res = await fetch(`/api/admin/submissions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        await loadSubmissions();
        setStatus(`Marked "${sub ? sub.showName || sub.djName : id}" ${status}.`);
      } catch (err) {
        setStatus("Couldn't update submission — try again.", "error");
      }
      return;
    }

    if (action === "delete") {
      if (!confirm(`Delete ${sub ? `"${sub.showName || sub.djName}"` : "this"} submission? This can't be undone.`)) return;
      try {
        const res = await fetch(`/api/admin/submissions/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`delete ${res.status}`);
        await loadSubmissions();
        setStatus("Deleted.");
      } catch (err) {
        setStatus("Couldn't delete — try again.", "error");
      }
      return;
    }

    if (action === "email") {
      const panel = row.querySelector("[data-compose]");
      panel.hidden = !panel.hidden;
      if (!panel.hidden) panel.querySelector("input[name='subject']").focus();
      return;
    }

    if (action === "compose-cancel") {
      row.querySelector("[data-compose]").hidden = true;
    }
  });

  submissionsList.addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-compose]");
    if (!form) return;
    e.preventDefault();

    const row = form.closest("[data-id]");
    const sub = cachedSubmissions.find((s) => s.id === row.dataset.id);
    const composeStatus = form.querySelector("[data-compose-status]");
    const sendBtn = form.querySelector("button[type='submit']");
    const subject = form.elements.namedItem("subject").value.trim();
    const message = form.elements.namedItem("message").value.trim();
    if (!subject || !message || !sub) return;

    sendBtn.disabled = true;
    composeStatus.textContent = "Sending…";
    composeStatus.removeAttribute("data-tone");
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: sub.email, subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `email ${res.status}`);
      composeStatus.textContent = "";
      form.hidden = true;
      setStatus(`Email sent to ${sub.email}.`);
    } catch (err) {
      composeStatus.textContent = err.message || "Couldn't send — try again.";
      composeStatus.dataset.tone = "error";
    } finally {
      sendBtn.disabled = false;
    }
  });

  function slotRowMarkup(slot) {
    const reservedSub = slot.submissionId ? cachedSubmissions.find((s) => s.id === slot.submissionId) : null;
    const statusLabel = slot.status === "reserved" ? `Reserved${reservedSub ? " — " + escapeHtml(reservedSub.djName) : ""}` : "Open";
    return `
      <div class="admin-slot" data-id="${slot.id}">
        <div class="admin-slot__body">
          <span class="admin-slot__when">${slot.date} · ${slot.startTime}–${slot.endTime}</span>
          <span class="admin-slot__status admin-slot__status--${slot.status}">${statusLabel}</span>
        </div>
        <div class="admin-slot__actions">
          ${slot.status === "reserved" ? `<button type="button" class="btn" data-action="release">Release</button>` : ""}
          <button type="button" class="btn btn--danger" data-action="delete-slot">Delete</button>
        </div>
      </div>
    `;
  }

  function renderSlots() {
    slotsEmpty.hidden = cachedSlots.length > 0;
    slotsList.innerHTML = cachedSlots.map(slotRowMarkup).join("");
  }

  async function loadSlots() {
    const [slotsRes] = await Promise.all([
      fetch("/api/admin/slots", { cache: "no-store" }),
      cachedSubmissions.length ? Promise.resolve() : loadSubmissions().catch(() => {}),
    ]);
    if (!slotsRes.ok) throw new Error(`slots ${slotsRes.status}`);
    cachedSlots = await slotsRes.json();
    renderSlots();
  }

  slotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      date: slotForm.elements.namedItem("date").value,
      startTime: slotForm.elements.namedItem("startTime").value,
      endTime: slotForm.elements.namedItem("endTime").value,
    };
    if (!payload.date || !payload.startTime || !payload.endTime) return;
    if (payload.endTime <= payload.startTime) {
      setStatus("End time must be after start time.", "error");
      return;
    }
    try {
      const res = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`slot ${res.status}`);
      slotForm.reset();
      syncSlotTimeVisibility();
      setStatus("Timeslot added.");
      await loadSlots();
    } catch (err) {
      setStatus("Couldn't add timeslot — try again.", "error");
    }
  });

  slotsList.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest("[data-id]");
    const id = row.dataset.id;

    if (button.dataset.action === "release") {
      try {
        const res = await fetch(`/api/admin/slots/${id}`, { method: "PATCH" });
        if (!res.ok) throw new Error(`release ${res.status}`);
        await loadSlots();
        setStatus("Timeslot released.");
      } catch (err) {
        setStatus("Couldn't release timeslot — try again.", "error");
      }
      return;
    }

    if (button.dataset.action === "delete-slot") {
      if (!confirm("Delete this timeslot?")) return;
      try {
        const res = await fetch(`/api/admin/slots/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`delete ${res.status}`);
        await loadSlots();
        setStatus("Timeslot deleted.");
      } catch (err) {
        setStatus("Couldn't delete timeslot — try again.", "error");
      }
    }
  });

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

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function formatChatTime(ts) {
    return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function chatRowMarkup(msg) {
    if (msg.isSystem) {
      return `<div class="admin-chat__row admin-chat__row--system">${escapeHtml(msg.body)} — ${formatChatTime(msg.createdAt)}</div>`;
    }

    let actions = "";
    if (msg.isDj) {
      if (!msg.deleted) {
        actions = `
          <div class="admin-chat__actions">
            <button type="button" data-action="chat-edit" aria-label="Edit message">${ICONS.edit}</button>
            <button type="button" data-action="chat-delete" aria-label="Delete message">${ICONS.delete}</button>
          </div>
        `;
      }
    } else {
      actions = `
        <div class="admin-chat__actions">
          ${msg.deleted ? "" : `<button type="button" data-action="chat-delete" aria-label="Delete message">${ICONS.delete}</button>`}
          <button type="button" data-action="chat-ban" aria-label="Ban sender">${ICONS.ban}</button>
        </div>
      `;
    }

    return `
      <div class="admin-chat__row${msg.deleted ? " admin-chat__row--deleted" : ""}" data-id="${msg.id}" data-client-id="${escapeHtml(msg.clientId)}" data-ip-hash="${escapeHtml(msg.ipHash || "")}">
        <div class="admin-chat__body">
          <div class="admin-chat__meta">
            <span class="admin-chat__name">${escapeHtml(msg.name)}</span>
            <span class="admin-chat__time">${formatChatTime(msg.createdAt)}</span>
            ${msg.deleted ? '<span class="admin-chat__flag">Deleted</span>' : ""}
          </div>
          <div class="admin-chat__text">${escapeHtml(msg.body)}</div>
        </div>
        ${actions}
      </div>
    `;
  }

  async function loadChat() {
    const res = await fetch("/api/admin/chat", { cache: "no-store" });
    if (!res.ok) throw new Error(`chat ${res.status}`);
    const { messages } = await res.json();
    cachedChatMessages = messages;
    const ordered = [...messages].reverse();
    const wasAtBottom = chatFeed.scrollHeight - chatFeed.scrollTop - chatFeed.clientHeight < 24;
    chatFeed.innerHTML = ordered.length
      ? ordered.map(chatRowMarkup).join("")
      : '<p class="admin-status">No messages yet.</p>';
    if (wasAtBottom) chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;
    chatInput.disabled = true;
    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(`chat ${res.status}`);
      chatInput.value = "";
      await loadChat();
    } catch (err) {
      setStatus("Couldn't send — try again.", "error");
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  });

  chatFeed.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest("[data-id]");
    const id = row.dataset.id;
    const clientId = row.dataset.clientId;
    const ipHash = row.dataset.ipHash;

    if (button.dataset.action === "chat-edit") {
      const current = cachedChatMessages.find((m) => m.id === Number(id));
      const next = prompt("Edit message", current ? current.body : "");
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed) return;
      try {
        const res = await fetch(`/api/admin/chat/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        if (!res.ok) throw new Error(`edit ${res.status}`);
        await loadChat();
      } catch (err) {
        setStatus("Couldn't edit message — try again.", "error");
      }
      return;
    }

    if (button.dataset.action === "chat-delete") {
      if (!confirm("Delete this message?")) return;
      try {
        const res = await fetch(`/api/admin/chat/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`delete ${res.status}`);
        await loadChat();
      } catch (err) {
        setStatus("Couldn't delete message — try again.", "error");
      }
      return;
    }

    if (button.dataset.action === "chat-ban") {
      const minutesStr = prompt("Ban for how many minutes?", "60");
      if (!minutesStr) return;
      const minutes = Number(minutesStr) || 60;
      try {
        const res = await fetch("/api/admin/chat/ban", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, ipHash: ipHash || undefined, minutes }),
        });
        if (!res.ok) throw new Error(`ban ${res.status}`);
        setStatus(`Banned for ${minutes} min.`);
      } catch (err) {
        setStatus("Couldn't ban — try again.", "error");
      }
    }
  });

  loadList().catch(() => setStatus("Couldn't load shows.", "error"));
  loadSubmissions().catch(() => {});
})();

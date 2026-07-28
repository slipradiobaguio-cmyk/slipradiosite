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

  const fields = ["title", "slug", "genres", "date", "time", "guestName", "socialLink", "bio", "shortDescription", "longDescription"];
  let editingSlug = null;

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

  function rowMarkup(show) {
    const thumb = show.heroImage ? `style="background-image:url('${show.heroImage}')"` : "";
    return `
      <div class="admin-list__row" data-slug="${show.slug}">
        <div class="admin-list__thumb" ${thumb}></div>
        <div class="admin-list__meta">
          <div class="admin-list__title">${show.title}</div>
          <div class="admin-list__sub">${show.guestName || ""} · ${show.date || "no date"}${show.time ? ` · ${show.time}` : ""}</div>
        </div>
        <div class="admin-list__actions">
          <a class="btn" href="/shows/${show.slug}" target="_blank" rel="noopener">View</a>
          <button type="button" class="btn" data-action="edit">Edit</button>
          <button type="button" class="btn btn--danger" data-action="delete">Delete</button>
        </div>
      </div>
    `;
  }

  async function loadList() {
    const res = await fetch("/api/shows", { cache: "no-store" });
    if (!res.ok) throw new Error(`shows ${res.status}`);
    const shows = await res.json();
    const today = todayISO();

    const buckets = { today: [], upcoming: [], past: [] };
    shows.forEach((show) => {
      if (show.date === today) buckets.today.push(show);
      else if (show.date && show.date < today) buckets.past.push(show);
      else buckets.upcoming.push(show);
    });

    buckets.today.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    buckets.upcoming.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    buckets.past.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    listEmptyEl.hidden = shows.length > 0;

    Object.keys(buckets).forEach((key) => {
      const items = buckets[key];
      groups[key].hidden = items.length === 0;
      lists[key].innerHTML = items.map(rowMarkup).join("");
    });
  }

  function fillForm(show) {
    fields.forEach((key) => {
      const input = form.elements.namedItem(key);
      if (input) input.value = show[key] || "";
    });
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

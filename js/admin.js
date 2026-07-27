(function () {
  const listEl = document.querySelector("[data-admin-list]");
  const form = document.querySelector("[data-admin-form]");
  const statusEl = document.querySelector("[data-admin-status]");
  if (!listEl || !form) return;

  const fields = ["title", "slug", "genres", "date", "time", "guestName", "socialLink", "bio", "shortDescription", "longDescription"];
  const formTitleEl = document.querySelector("[data-form-title]");
  let editingSlug = null;

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

  function rowMarkup(show) {
    const thumb = show.heroImage ? `style="background-image:url('${show.heroImage}')"` : "";
    return `
      <div class="admin-list__row" data-slug="${show.slug}">
        <div class="admin-list__thumb" ${thumb}></div>
        <div class="admin-list__meta">
          <div class="admin-list__title">${show.title}</div>
          <div class="admin-list__sub">${show.guestName || ""} · ${show.date || "no date"}</div>
        </div>
        <div class="admin-list__actions">
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
    listEl.innerHTML = shows.length
      ? shows.map(rowMarkup).join("")
      : `<p class="admin-status">No shows yet — add one below.</p>`;
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
  }

  function resetForm() {
    form.reset();
    form.querySelector("[data-field='heroImagePreview']").style.backgroundImage = "";
    form.dataset.heroImage = "";
    editingSlug = null;
    formTitleEl.textContent = "Add a show";
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

    setStatus("Saving…");
    try {
      const res = await fetch(`/api/admin/shows/${encodeURIComponent(payload.slug)}`, {
        method: editingSlug ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`save ${res.status}`);
      setStatus("Saved.");
      resetForm();
      await loadList();
    } catch (err) {
      console.error(err);
      setStatus("Couldn't save — try again.", "error");
    }
  });

  form.querySelector("[data-action='cancel']").addEventListener("click", resetForm);

  listEl.addEventListener("click", async (e) => {
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

  loadList().catch(() => setStatus("Couldn't load shows.", "error"));
})();

(function () {
  const form = document.querySelector("[data-dj-form]");
  if (!form) return;

  const statusEl = form.querySelector("[data-dj-status]");
  const submitBtn = form.querySelector("[data-dj-submit]");
  const slotSelect = form.querySelector("[data-slot-select]");
  const photoInput = form.querySelector("[data-photo-input]");
  const photoPreview = form.querySelector("[data-field='photoPreview']");
  const successEl = document.querySelector("[data-dj-success]");

  function setStatus(message, tone) {
    statusEl.textContent = message || "";
    if (tone) statusEl.dataset.tone = tone;
    else statusEl.removeAttribute("data-tone");
  }

  function formatSlot(slot) {
    const date = new Date(`${slot.date}T00:00:00`);
    const dateLabel = date.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${dateLabel} · ${slot.startTime}–${slot.endTime}`;
  }

  async function loadSlots() {
    try {
      const res = await fetch("/api/submissions/slots", { cache: "no-store" });
      if (!res.ok) throw new Error(`slots ${res.status}`);
      const slots = await res.json();

      if (!slots.length) {
        slotSelect.innerHTML = '<option value="">No open timeslots right now — check back soon</option>';
        slotSelect.disabled = true;
        submitBtn.disabled = true;
        return;
      }

      slotSelect.innerHTML =
        '<option value="">Choose a timeslot…</option>' +
        slots.map((slot) => `<option value="${slot.id}">${formatSlot(slot)}</option>`).join("");
      slotSelect.disabled = false;
      submitBtn.disabled = false;
    } catch (err) {
      slotSelect.innerHTML = '<option value="">Couldn\'t load timeslots</option>';
      setStatus("Couldn't load available timeslots — refresh to try again.", "error");
    }
  }

  const MAX_PHOTO_DIMENSION = 1600;
  const PHOTO_WEBP_QUALITY = 0.82;

  async function preparePhoto(file) {
    if (!("createImageBitmap" in window) || typeof OffscreenCanvas === "undefined") return file;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return file;
    }
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    try {
      const blob = await canvas.convertToBlob({ type: "image/webp", quality: PHOTO_WEBP_QUALITY });
      if (blob.type !== "image/webp") return file;
      return blob;
    } catch {
      return file;
    }
  }

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;
    setStatus("Uploading photo…");
    submitBtn.disabled = true;
    try {
      const upload = await preparePhoto(file);
      const body = new FormData();
      body.append("file", upload, upload === file ? file.name : "photo.webp");
      const res = await fetch("/api/submissions/upload", { method: "POST", body });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      const { url } = await res.json();
      form.dataset.photoUrl = url;
      photoPreview.style.backgroundImage = `url('${url}')`;
      setStatus("");
    } catch (err) {
      setStatus("Photo upload failed — try a different file.", "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadSlots();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!form.dataset.photoUrl) {
      setStatus("Please upload a profile photo first.", "error");
      return;
    }

    const payload = {
      website: form.elements.namedItem("website").value,
      email: form.elements.namedItem("email").value.trim(),
      djName: form.elements.namedItem("djName").value.trim(),
      showName: form.elements.namedItem("showName").value.trim(),
      bio: form.elements.namedItem("bio").value.trim(),
      instagram: form.elements.namedItem("instagram").value.trim(),
      phone: form.elements.namedItem("phone").value.trim(),
      location: form.elements.namedItem("location").value.trim(),
      genres: form.elements.namedItem("genres").value.trim(),
      mixLink: form.elements.namedItem("mixLink").value.trim(),
      photoUrl: form.dataset.photoUrl,
      slotId: form.elements.namedItem("slotId").value,
      setup: form.elements.namedItem("setup").value,
    };

    if (!payload.slotId) {
      setStatus("Please choose a timeslot.", "error");
      return;
    }
    if (!payload.setup) {
      setStatus("Please choose a preferred set-up.", "error");
      return;
    }

    submitBtn.disabled = true;
    setStatus("Submitting…");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `submit ${res.status}`);

      form.hidden = true;
      successEl.hidden = false;
    } catch (err) {
      setStatus(err.message || "Couldn't submit — try again.", "error");
      submitBtn.disabled = false;
    }
  });
})();

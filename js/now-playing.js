(function () {
  const bar = document.querySelector(".now-playing");
  if (!bar) return;

  const liveIndicator = document.querySelector(".live-indicator");
  const statusEl = bar.querySelector(".now-playing__status");
  const titleEl = bar.querySelector(".now-playing__title");
  const artistEl = bar.querySelector(".now-playing__artist");
  const toggleBtn = bar.querySelector(".now-playing__toggle");
  const volumeSlider = bar.querySelector(".now-playing__volume input");

  const POLL_INTERVAL_MS = 30000;
  const audio = new Audio();
  audio.preload = "none";

  const STATUS_LABEL = {
    loading: "connecting",
    live: "live",
    offline: "offline",
    error: "unavailable",
  };

  function setState(state, data) {
    bar.dataset.state = state;
    if (liveIndicator) {
      liveIndicator.dataset.state = state;
      const label = liveIndicator.querySelector(".live-indicator__label");
      if (label) label.textContent = (STATUS_LABEL[state] || state).toUpperCase();
    }
    statusEl.textContent = STATUS_LABEL[state] || state;

    if (state === "live" && data) {
      titleEl.textContent = data.title || "Untitled set";
      artistEl.textContent = data.dj || data.artist || "";
      toggleBtn.disabled = false;
      audio.src = data.streamUrl || "";
    } else if (state === "offline") {
      titleEl.textContent = "No one's live right now";
      artistEl.textContent = data && data.nextShow ? `Next: ${data.nextShow}` : "";
      toggleBtn.disabled = true;
      pause();
    } else if (state === "loading") {
      titleEl.textContent = "Connecting to stream…";
      artistEl.textContent = "";
      toggleBtn.disabled = true;
    } else {
      titleEl.textContent = "Stream unavailable";
      artistEl.textContent = "Check back shortly";
      toggleBtn.disabled = true;
      pause();
    }
  }

  function pause() {
    audio.pause();
    toggleBtn.setAttribute("aria-label", "Play");
    toggleBtn.dataset.playing = "false";
  }

  function play() {
    audio.play().catch(() => setState("error"));
    toggleBtn.setAttribute("aria-label", "Pause");
    toggleBtn.dataset.playing = "true";
  }

  toggleBtn.addEventListener("click", () => {
    if (audio.paused) play();
    else pause();
  });

  if (volumeSlider) {
    audio.volume = Number(volumeSlider.value) || 0.8;
    volumeSlider.addEventListener("input", () => {
      audio.volume = Number(volumeSlider.value);
    });
  }

  async function poll() {
    try {
      const res = await fetch("/api/now-playing", { cache: "no-store" });
      if (!res.ok) throw new Error(`now-playing ${res.status}`);
      const data = await res.json();
      setState(data.live ? "live" : "offline", data);
    } catch (err) {
      setState("error");
    }
  }

  setState("loading");
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
})();

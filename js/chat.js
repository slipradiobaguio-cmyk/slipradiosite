(function () {
  const widget = document.querySelector(".chat-widget");
  if (!widget) return;

  const CLIENT_KEY = "sr_chat_client";
  const NAME_KEY = "sr_chat_name";
  const NAME_MAX = 24;
  const MESSAGE_MAX = 240;
  const POLL_INTERVAL_MS = 4000;
  const RESERVED_NAMES = new Set(["admin", "slip radio"]);
  const DAY_REVEAL_THRESHOLD = 120;

  const fab = widget.querySelector(".chat-fab");
  const badge = widget.querySelector("[data-chat-badge]");
  const closeBtn = widget.querySelector("[data-chat-close]");
  const feed = widget.querySelector("[data-chat-feed]");
  const input = widget.querySelector("[data-chat-input]");
  const actionBtn = widget.querySelector("[data-chat-action]");
  const reminder = widget.querySelector(".chat-reminder");
  const REMINDER_DURATION_MS = 10000;

  function getClientId() {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  }

  const clientId = getClientId();
  let myName = localStorage.getItem(NAME_KEY) || "";
  let lastId = 0;
  let unread = 0;
  let sending = false;

  function updateActionUI() {
    if (myName) {
      input.placeholder = "Say something…";
      input.maxLength = MESSAGE_MAX;
      actionBtn.textContent = "Send";
    } else {
      input.placeholder = "Enter a name to join…";
      input.maxLength = NAME_MAX;
      actionBtn.textContent = "Join";
    }
    actionBtn.disabled = input.value.trim().length === 0;
  }

  function setUnread(count) {
    unread = count;
    if (count > 0) {
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function clearFeedEmptyState() {
    const placeholder = feed.querySelector(".chat-feed__empty");
    if (placeholder) placeholder.remove();
  }

  function showFeedEmptyState() {
    if (feed.querySelector(".chat-feed__empty")) return;
    const placeholder = document.createElement("div");
    placeholder.className = "chat-feed__empty";
    placeholder.textContent = "no one's said anything yet — be the first";
    feed.appendChild(placeholder);
  }

  function isScrolledToBottom() {
    return feed.scrollHeight - feed.scrollTop - feed.clientHeight < 24;
  }

  // day headers stay out of sight until the reader actually scrolls back
  // into history — if there's nothing to scroll (a short log), there's
  // nothing to hide behind, so they just show as normal
  function updateDayVisibility() {
    const canScroll = feed.scrollHeight > feed.clientHeight + 4;
    const scrolledUp = feed.scrollHeight - feed.scrollTop - feed.clientHeight;
    const revealed = !canScroll || scrolledUp > DAY_REVEAL_THRESHOLD;
    feed.querySelectorAll(".chat-day").forEach((day) => {
      day.classList.toggle("chat-day--hidden", !revealed);
    });
  }

  const AVATAR_TINTS = 5;

  function avatarTint(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % AVATAR_TINTS;
  }

  // the log is split into per-day groups so a long history doesn't read as
  // one endless wall — only the most recent day renders flat with no header,
  // matching today's chat exactly; anything older sits behind a collapsed
  // "day rail" the reader only meets by scrolling back into it
  let currentDayKey = null;
  let currentContainer = null;

  function dayKeyOf(createdAt) {
    const d = new Date(createdAt);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function dayLabelOf(createdAt) {
    return new Date(createdAt).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function freezeCurrentIntoDayGroup() {
    const dayGroup = document.createElement("div");
    dayGroup.className = "chat-day";
    dayGroup.dataset.open = "false";
    dayGroup.innerHTML = `
      <button type="button" class="chat-day__head">
        <span class="chat-day__date">${currentContainer.dataset.label}</span>
        <span class="chat-day__chevron" aria-hidden="true">▾</span>
      </button>
    `;
    currentContainer.className = "chat-day__rows";
    dayGroup.appendChild(currentContainer);
    feed.insertBefore(dayGroup, null);
  }

  function ensureCurrentContainer(msg) {
    const dayKey = dayKeyOf(msg.createdAt);
    if (currentContainer && currentDayKey === dayKey) return currentContainer;

    if (currentContainer) freezeCurrentIntoDayGroup();

    currentContainer = document.createElement("div");
    currentContainer.className = "chat-feed__current";
    currentContainer.dataset.label = dayLabelOf(msg.createdAt);
    feed.appendChild(currentContainer);
    currentDayKey = dayKey;
    return currentContainer;
  }

  function buildMessageNode(msg, mine) {
    if (msg.isSystem) {
      const systemRow = document.createElement("div");
      systemRow.className = "chat-msg--system";
      systemRow.textContent = msg.body;
      return systemRow;
    }

    const row = document.createElement("div");
    row.className = "chat-msg" + (msg.isDj ? " chat-msg--dj" : mine ? " chat-msg--mine" : "");

    const avatar = document.createElement("div");
    avatar.className = "chat-avatar chat-avatar--" + avatarTint(msg.name);
    avatar.textContent = msg.name.charAt(0).toUpperCase();

    const body = document.createElement("div");
    body.className = "chat-msg__body";

    const meta = document.createElement("div");
    meta.className = "chat-msg__meta";
    const nameEl = document.createElement("span");
    nameEl.className = "chat-msg__name";
    nameEl.textContent = msg.name;
    const timeEl = document.createElement("span");
    timeEl.className = "chat-msg__time";
    timeEl.textContent = new Date(msg.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    meta.append(nameEl, timeEl);

    const textEl = document.createElement("div");
    textEl.className = "chat-msg__text";
    textEl.textContent = msg.body;

    body.append(meta, textEl);
    row.append(avatar, body);
    return row;
  }

  function renderMessage(msg, mine) {
    clearFeedEmptyState();
    const container = ensureCurrentContainer(msg);
    container.appendChild(buildMessageNode(msg, mine));
    if (msg.id > lastId) lastId = msg.id;
  }

  function scrollToBottom() {
    feed.scrollTop = feed.scrollHeight;
    updateDayVisibility();
  }

  async function loadInitial() {
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      if (!res.ok) throw new Error(`chat ${res.status}`);
      const data = await res.json();
      if (data.messages.length === 0) {
        showFeedEmptyState();
      } else {
        data.messages.forEach((msg) => renderMessage(msg, false));
      }
      lastId = data.latestId || lastId;
      scrollToBottom();
    } catch (err) {
      showFeedEmptyState();
    }
  }

  async function poll() {
    try {
      const res = await fetch(`/api/chat?after=${lastId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.messages.length) return;

      const wasAtBottom = isScrolledToBottom();
      data.messages.forEach((msg) => renderMessage(msg, false));

      if (widget.dataset.open === "true") {
        if (wasAtBottom) scrollToBottom();
        else updateDayVisibility();
      } else {
        setUnread(unread + data.messages.length);
      }
    } catch (err) {
      // network hiccup — next interval retries, nothing to show for it
    }
  }

  async function sendMessage(text) {
    sending = true;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, name: myName, message: text }),
      });
      if (!res.ok) {
        input.value = text;
        updateActionUI();
        return;
      }
      const data = await res.json();
      data.messages.forEach((msg, i) => renderMessage(msg, i === data.messages.length - 1));
      scrollToBottom();
    } catch (err) {
      input.value = text;
      updateActionUI();
    } finally {
      sending = false;
    }
  }

  function showNameError(message) {
    input.value = "";
    input.classList.add("chat-action-row__input--error");
    input.placeholder = message;
    window.setTimeout(() => {
      input.classList.remove("chat-action-row__input--error");
      updateActionUI();
    }, 2200);
  }

  function handleAction() {
    if (sending) return;
    const value = input.value.trim();
    if (!value) return;

    if (!myName) {
      const candidate = value.slice(0, NAME_MAX);
      if (RESERVED_NAMES.has(candidate.toLowerCase())) {
        showNameError("that name's reserved — try another");
        return;
      }
      myName = candidate;
      localStorage.setItem(NAME_KEY, myName);
      input.value = "";
      updateActionUI();
      input.focus();
      return;
    }

    input.value = "";
    updateActionUI();
    sendMessage(value.slice(0, MESSAGE_MAX));
  }

  function openWidget() {
    widget.dataset.open = "true";
    setUnread(0);
    scrollToBottom();
    input.focus();
  }

  function closeWidget() {
    widget.dataset.open = "false";
  }

  fab.addEventListener("click", openWidget);
  closeBtn.addEventListener("click", closeWidget);
  actionBtn.addEventListener("click", handleAction);
  feed.addEventListener("click", (e) => {
    const head = e.target.closest(".chat-day__head");
    if (!head) return;
    const group = head.closest(".chat-day");
    group.dataset.open = group.dataset.open === "true" ? "false" : "true";
  });
  feed.addEventListener("scroll", updateDayVisibility);
  input.addEventListener("input", updateActionUI);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAction();
    }
  });

  updateActionUI();
  setUnread(0);
  window.setTimeout(() => reminder.classList.add("chat-reminder--hidden"), REMINDER_DURATION_MS);
  loadInitial().then(() => {
    setInterval(poll, POLL_INTERVAL_MS);
  });
})();

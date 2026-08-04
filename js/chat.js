(function () {
  const widget = document.querySelector(".chat-widget");
  if (!widget) return;

  const CLIENT_KEY = "sr_chat_client";
  const NAME_KEY = "sr_chat_name";
  const NAME_MAX = 24;
  const MESSAGE_MAX = 240;
  const POLL_INTERVAL_MS = 4000;

  const fab = widget.querySelector(".chat-fab");
  const badge = widget.querySelector("[data-chat-badge]");
  const minimizeBtn = widget.querySelector("[data-chat-minimize]");
  const closeBtn = widget.querySelector("[data-chat-close]");
  const feed = widget.querySelector("[data-chat-feed]");
  const input = widget.querySelector("[data-chat-input]");
  const actionBtn = widget.querySelector("[data-chat-action]");

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

  function renderMessage(msg, mine) {
    clearFeedEmptyState();

    const row = document.createElement("div");
    row.className = "chat-msg" + (msg.isDj ? " chat-msg--dj" : mine ? " chat-msg--mine" : "");

    const avatar = document.createElement("div");
    avatar.className = "chat-avatar";
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
    feed.appendChild(row);

    if (msg.id > lastId) lastId = msg.id;
  }

  function scrollToBottom() {
    feed.scrollTop = feed.scrollHeight;
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
      const msg = await res.json();
      renderMessage(msg, true);
      scrollToBottom();
    } catch (err) {
      input.value = text;
      updateActionUI();
    } finally {
      sending = false;
    }
  }

  function handleAction() {
    if (sending) return;
    const value = input.value.trim();
    if (!value) return;

    if (!myName) {
      myName = value.slice(0, NAME_MAX);
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
  minimizeBtn.addEventListener("click", closeWidget);
  closeBtn.addEventListener("click", closeWidget);
  actionBtn.addEventListener("click", handleAction);
  input.addEventListener("input", updateActionUI);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAction();
    }
  });

  updateActionUI();
  setUnread(0);
  loadInitial().then(() => {
    setInterval(poll, POLL_INTERVAL_MS);
  });
})();

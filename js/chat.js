(function () {
  const widget = document.querySelector(".chat-widget");
  if (!widget) return;

  const CLIENT_KEY = "sr_chat_client";
  const NAME_KEY = "sr_chat_name";
  const NAME_MAX = 24;
  const MESSAGE_MAX = 240;
  const POLL_INTERVAL_MS = 4000;
  const RESERVED_NAMES = new Set(["admin", "slip radio"]);

  const fab = widget.querySelector(".chat-fab");
  const panel = widget.querySelector(".chat-panel");
  const head = widget.querySelector(".chat-panel__head");
  const badge = widget.querySelector("[data-chat-badge]");
  const closeBtn = widget.querySelector("[data-chat-close]");
  const expandBtn = widget.querySelector("[data-chat-expand]");
  const feed = widget.querySelector("[data-chat-feed]");
  const input = widget.querySelector("[data-chat-input]");
  const actionBtn = widget.querySelector("[data-chat-action]");
  const reminder = widget.querySelector(".chat-reminder");
  const jumpBtn = widget.querySelector("[data-chat-jump]");
  const REMINDER_DURATION_MS = 10000;
  const MOBILE_QUERY = window.matchMedia("(max-width: 767.98px)");

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

  const AVATAR_TINTS = 5;

  function avatarTint(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % AVATAR_TINTS;
  }

  // the log is split into per-day segments so a long history doesn't read
  // as one endless wall — only the most recent day renders flat with no
  // label, matching today's chat exactly; anything older gets a plain date
  // label above it as it's revealed, no grouping or collapsing
  let currentDayKey = null;
  let currentContainer = null;

  // tracks the oldest day segment currently in the feed, so scrolling to
  // the top can fetch older history and prepend it in the right place:
  // merged into this segment if it's the same day, or as a new one before it
  let earliestDayKey = null;
  let earliestRowsEl = null;
  let earliestAnchorEl = null;

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
    const label = document.createElement("div");
    label.className = "chat-day__label";
    label.textContent = currentContainer.dataset.label;
    currentContainer.className = "chat-day__rows";
    dayGroup.append(label, currentContainer);
    feed.insertBefore(dayGroup, null);

    if (currentContainer === earliestRowsEl) earliestAnchorEl = dayGroup;
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

    if (!earliestRowsEl) {
      earliestDayKey = dayKey;
      earliestRowsEl = currentContainer;
      earliestAnchorEl = currentContainer;
    }
    return currentContainer;
  }

  // messages ascending oldest -> newest, all older than anything already
  // loaded (guaranteed by the `before` query). Walk backwards in same-day
  // chunks so each chunk lands right before the current earliest group.
  function prependMessages(messages) {
    let i = messages.length - 1;
    while (i >= 0) {
      const dayKey = dayKeyOf(messages[i].createdAt);
      let j = i;
      while (j >= 0 && dayKeyOf(messages[j].createdAt) === dayKey) j--;
      const dayMessages = messages.slice(j + 1, i + 1);

      if (dayKey === earliestDayKey) {
        const frag = document.createDocumentFragment();
        dayMessages.forEach((msg) => frag.appendChild(buildMessageNode(msg, false)));
        earliestRowsEl.insertBefore(frag, earliestRowsEl.firstChild);
      } else {
        const rows = document.createElement("div");
        rows.className = "chat-day__rows";
        dayMessages.forEach((msg) => rows.appendChild(buildMessageNode(msg, false)));

        const dayGroup = document.createElement("div");
        dayGroup.className = "chat-day";
        const label = document.createElement("div");
        label.className = "chat-day__label";
        label.textContent = dayLabelOf(dayMessages[0].createdAt);
        dayGroup.append(label, rows);
        feed.insertBefore(dayGroup, earliestAnchorEl);

        earliestDayKey = dayKey;
        earliestRowsEl = rows;
        earliestAnchorEl = dayGroup;
      }
      i = j;
    }
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
  }

  // a deliberate jump back to the latest messages reads better as the
  // thread sliding into place than as an instant cut — everywhere else
  // (initial load, sending, opening) still snaps, since animating those
  // would just make ordinary actions feel sluggish
  function slideToBottom() {
    feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  }

  let firstId = 0;
  let hasMoreOlder = true;
  let loadingOlder = false;
  let olderControlEl = null;

  // tapped, not auto-triggered by scroll — a short list of collapsed
  // headers loading in one go read as a wall dumped on the user, not a
  // natural reveal
  function ensureOlderControl() {
    if (!hasMoreOlder || olderControlEl) return;
    olderControlEl = document.createElement("button");
    olderControlEl.type = "button";
    olderControlEl.className = "chat-feed__older";
    olderControlEl.textContent = "Show earlier messages";
    olderControlEl.addEventListener("click", loadOlder);
    feed.insertBefore(olderControlEl, feed.firstChild);
  }

  async function loadOlder() {
    if (loadingOlder || !hasMoreOlder || !firstId) return;
    loadingOlder = true;
    if (olderControlEl) {
      olderControlEl.disabled = true;
      olderControlEl.textContent = "Loading…";
    }
    try {
      const res = await fetch(`/api/chat?before=${firstId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      hasMoreOlder = Boolean(data.hasMore);
      if (data.messages.length) {
        const prevScrollHeight = feed.scrollHeight;
        const prevScrollTop = feed.scrollTop;
        prependMessages(data.messages);
        firstId = data.messages[0].id;
        feed.scrollTop = prevScrollTop + (feed.scrollHeight - prevScrollHeight);
      }
    } catch (err) {
      // network hiccup — tapping the control again retries
    } finally {
      loadingOlder = false;
      if (!hasMoreOlder && olderControlEl) {
        olderControlEl.remove();
        olderControlEl = null;
      } else if (olderControlEl) {
        olderControlEl.disabled = false;
        olderControlEl.textContent = "Show earlier messages";
      }
    }
  }

  const JUMP_IDLE_MS = 900;
  let jumpHideTimer = null;
  let jumpSuppressed = false;

  function hideJumpBtn() {
    jumpBtn.hidden = true;
    if (jumpHideTimer) {
      clearTimeout(jumpHideTimer);
      jumpHideTimer = null;
    }
  }

  // the arrow tracks active backreading only — it appears while scrolling
  // away from the bottom and fades back out shortly after the scroll
  // stops, rather than sitting on screen for the whole time you're up there
  function handleFeedScroll() {
    if (isScrolledToBottom()) {
      hideJumpBtn();
      jumpSuppressed = false;
      return;
    }
    // a smooth jump-to-latest passes through non-bottom scroll positions
    // on its way down — ignore those so the arrow doesn't flicker back on
    // during its own animation
    if (jumpSuppressed) return;
    jumpBtn.hidden = false;
    if (jumpHideTimer) clearTimeout(jumpHideTimer);
    jumpHideTimer = window.setTimeout(hideJumpBtn, JUMP_IDLE_MS);
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
        firstId = data.messages[0].id;
      }
      hasMoreOlder = Boolean(data.hasMore);
      ensureOlderControl();
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
      const data = await res.json();
      data.messages.forEach((msg, i) => renderMessage(msg, i === data.messages.length - 1));
      scrollToBottom();
      hideJumpBtn();
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

  // the tray's timings live in CSS (--chat-open-ms / --chat-close-ms on the
  // widget) — read the close one back out so the timer below can never
  // drift from the transition it's waiting on
  function closeDurationMs() {
    const ms = parseFloat(getComputedStyle(widget).getPropertyValue("--chat-close-ms"));
    return Number.isFinite(ms) ? ms : 0;
  }

  let closeTimer = null;

  // the mobile burger + tab drawer live in nav.js's territory; while the chat
  // is expanded the drawer is laid over the chat's header strip (see
  // components.css), and this is the only place chat.js reaches into it —
  // closing it exactly the way nav.js's own burger click does
  const navBurger = document.querySelector("[data-nav-burger]");
  const navDrawer = document.querySelector("[data-nav-drawer]");

  function navDrawerIsOpen() {
    return Boolean(navDrawer) && navDrawer.getAttribute("data-open") === "true";
  }

  function closeNavDrawer() {
    if (!navBurger || !navDrawer) return;
    navBurger.setAttribute("aria-expanded", "false");
    navDrawer.setAttribute("data-open", "false");
  }

  // how long the drawer's own (in-flow, chat closed) close transition takes,
  // read from CSS so it never has to be kept in sync by hand
  function navDrawerCloseMs() {
    if (!navDrawer) return 0;
    const s = parseFloat(getComputedStyle(navDrawer).transitionDuration);
    return Number.isFinite(s) ? s * 1000 : 0;
  }

  let navReadyTimer = null;

  // offsetHeight, not getBoundingClientRect — the header/announce bar get
  // pinned with position:fixed the moment chat-expanded is added (see
  // components.css), so their natural height is what matters, not their
  // current on-screen position, which depends on wherever the page
  // happened to be scrolled when chat was opened
  function measureExpandTop() {
    const announce = document.querySelector(".announce-bar");
    const header = document.querySelector(".site-header");
    const announceH = announce ? announce.offsetHeight : 0;
    const headerH = header ? header.offsetHeight : 0;
    document.documentElement.style.setProperty("--chat-announce-height", `${announceH}px`);
    return announceH + headerH;
  }

  function setExpanded(expanded) {
    widget.dataset.expanded = expanded ? "true" : "false";
    // expanded state's icon doubles as "close" — tapping it never drops
    // back to the small panel, it closes the whole widget (see the click
    // handler below), so the label should say what actually happens
    expandBtn.setAttribute("aria-label", expanded ? "Close chat" : "Expand chat");
    if (expanded) {
      document.documentElement.style.setProperty("--chat-expand-top", `${measureExpandTop()}px`);
      // only a scrolled page needs the header/announce bar faded in and out
      // (see components.css) — at scroll 0 they're already where they get pinned
      document.body.classList.toggle("chat-pin-fade", window.scrollY > 1);
      document.body.classList.add("chat-expanded");
      // the tab drawer's transitions are only enabled a beat later, so its
      // jump from its in-flow pose to the lifted-out one isn't itself animated
      if (!navReadyTimer && !document.body.classList.contains("chat-nav-ready")) {
        navReadyTimer = window.setTimeout(() => {
          document.body.classList.add("chat-nav-ready");
          navReadyTimer = null;
        }, 60);
      }
    } else {
      if (navReadyTimer) {
        clearTimeout(navReadyTimer);
        navReadyTimer = null;
      }
      document.body.classList.remove("chat-expanded", "chat-pin-fade", "chat-nav-ready");
    }
  }

  function openWidget() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    widget.dataset.open = "true";
    // the panel stays mounted while closed, so it has to be told it's out
    // of play (no focus, no taps) — and the launcher, which is only faded
    // out while open, has to be kept out of the tab order the same way
    panel.inert = false;
    fab.inert = true;
    fab.setAttribute("aria-expanded", "true");
    setUnread(0);
    if (MOBILE_QUERY.matches) {
      // mobile skips the small panel entirely and opens straight to
      // full-screen — don't auto-focus there, it pops the keyboard
      // immediately on open, which nobody asked for. expanded first so the
      // panel has its final size before the feed is scrolled to the bottom
      setExpanded(true);
    }
    scrollToBottom();
    hideJumpBtn();
    if (!MOBILE_QUERY.matches) input.focus({ preventScroll: true });
  }

  function closeWidget() {
    if (widget.dataset.open !== "true") return;
    widget.dataset.open = "false";
    panel.inert = true;
    fab.inert = false;
    fab.setAttribute("aria-expanded", "false");
    // the tab strip goes with it, sliding out while the tray drops
    closeNavDrawer();
    // focus that was inside the panel would otherwise be dropped to <body>
    if (panel.contains(document.activeElement)) fab.focus({ preventScroll: true });
    // unpinning the header and unlocking scroll waits for the tray to finish
    // dropping into the player — doing it up front makes the page jump
    // underneath a chat that's still on screen
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      setExpanded(false);
      closeTimer = null;
    }, closeDurationMs());
  }

  panel.inert = true;
  fab.setAttribute("aria-expanded", "false");

  // Esc peels back one layer at a time: the tab strip first, then the chat
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || widget.dataset.open !== "true") return;
    if (navDrawerIsOpen()) closeNavDrawer();
    else closeWidget();
  });

  // a tab tap while the chat is open leaves the chat: navigation only swaps
  // <main>, and the chat sits in front of it, so a chat left open would hide
  // the new page and look like nothing happened. no preventDefault — the
  // click still reaches pjax.js, which does the navigating
  if (navDrawer) {
    navDrawer.addEventListener("click", (e) => {
      if (widget.dataset.open === "true" && e.target.closest("a")) closeWidget();
    });
  }

  // drag the header down to dismiss — a long pull or a quick flick closes
  // it, anything less springs back. skipped under reduced motion, where the
  // panel doesn't travel so there'd be nothing to drag
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)");
  const DRAG_CLOSE_PX = 90;
  const DRAG_CLOSE_VELOCITY = 0.6;
  let drag = null;

  head.addEventListener("pointerdown", (e) => {
    if (widget.dataset.open !== "true" || REDUCED_MOTION.matches || e.target.closest("button")) return;
    drag = { startY: e.clientY, dy: 0, lastY: e.clientY, lastT: performance.now(), v: 0 };
    head.setPointerCapture(e.pointerId);
    widget.classList.add("chat-dragging");
  });

  head.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const now = performance.now();
    drag.v = (e.clientY - drag.lastY) / (now - drag.lastT || 1);
    drag.lastY = e.clientY;
    drag.lastT = now;
    drag.dy = Math.max(0, e.clientY - drag.startY);
    widget.style.setProperty("--chat-drag", `${drag.dy}px`);
  });

  function endDrag() {
    if (!drag) return;
    const { dy, v } = drag;
    drag = null;
    widget.classList.remove("chat-dragging");
    widget.style.setProperty("--chat-drag", "0px");
    if (dy > DRAG_CLOSE_PX || v > DRAG_CLOSE_VELOCITY) closeWidget();
  }

  head.addEventListener("pointerup", endDrag);
  head.addEventListener("pointercancel", endDrag);

  fab.addEventListener("click", () => {
    // an open drawer is pushing the page down in the flow; let it finish
    // closing before the chat pins the header, or the page snaps up under
    // the rising tray
    if (navDrawerIsOpen()) {
      closeNavDrawer();
      window.setTimeout(openWidget, navDrawerCloseMs() + 20);
    } else {
      openWidget();
    }
  });
  closeBtn.addEventListener("click", closeWidget);
  expandBtn.addEventListener("click", () => {
    // small panel -> expand; expanded -> close outright (skips back to
    // the small panel on purpose, since the close button is gone on mobile)
    if (widget.dataset.expanded === "true") {
      closeWidget();
    } else {
      setExpanded(true);
    }
  });
  actionBtn.addEventListener("click", handleAction);
  feed.addEventListener("scroll", handleFeedScroll);
  jumpBtn.addEventListener("click", () => {
    jumpSuppressed = true;
    slideToBottom();
    hideJumpBtn();
  });
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

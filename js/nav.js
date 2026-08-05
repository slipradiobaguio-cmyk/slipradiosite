(function () {
  const path = window.location.pathname.replace(/\/index\.html$/, "/");
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === path || (href !== "/" && path.startsWith(href))) {
      link.setAttribute("aria-current", "page");
    }
  });

  const burger = document.querySelector("[data-nav-burger]");
  const drawer = document.querySelector("[data-nav-drawer]");
  if (burger && drawer) {
    burger.setAttribute("aria-expanded", "false");
    drawer.setAttribute("data-open", "false");

    if (!burger.dataset.bound) {
      burger.dataset.bound = "1";
      burger.addEventListener("click", () => {
        const open = burger.getAttribute("aria-expanded") === "true";
        burger.setAttribute("aria-expanded", String(!open));
        drawer.setAttribute("data-open", String(!open));
      });
    }
  }

  if (window.__srClockInterval) clearInterval(window.__srClockInterval);

  const clock = document.querySelector("[data-clock]");
  if (clock) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const update = () => {
      const now = new Date();
      const hour24 = now.getHours();
      const hour = hour24 % 12 || 12;
      const minute = String(now.getMinutes()).padStart(2, "0");
      const ampm = hour24 < 12 ? "AM" : "PM";
      clock.textContent = `${months[now.getMonth()]} ${now.getDate()} · ${hour}:${minute} ${ampm}`;
    };
    update();
    window.__srClockInterval = setInterval(update, 30000);
  }
})();

(function () {
  const path = window.location.pathname.replace(/\/index\.html$/, "/");
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === path || (href !== "/" && path.startsWith(href))) {
      link.setAttribute("aria-current", "page");
    }
  });

  const clock = document.querySelector("[data-clock]");
  if (clock) {
    const update = () => {
      clock.textContent = new Date().toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      });
    };
    update();
    setInterval(update, 30000);
  }
})();

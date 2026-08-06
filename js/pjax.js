(function () {
  const main = document.querySelector("main");
  if (!main) return;

  const CONTENT_SCRIPTS = ["/js/nav.js", "/js/shows.js", "/js/schedule.js", "/js/show-detail.js", "/js/program.js"];

  function isPjaxable(link) {
    if (!link || !link.href) return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (!/^https?:$/.test(url.protocol)) return false;
    if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api")) return false;
    if (url.pathname === window.location.pathname && url.hash) return false;
    return true;
  }

  async function runContentScripts() {
    for (const src of CONTENT_SCRIPTS) {
      await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = resolve;
        document.body.appendChild(script);
        script.remove();
      });
    }
  }

  async function navigate(url, { push }) {
    let html;
    try {
      const res = await fetch(url, { headers: { "X-Pjax": "1" } });
      if (!res.ok) throw new Error(`navigate ${res.status}`);
      html = await res.text();
    } catch (err) {
      window.location.href = url;
      return;
    }

    const parsed = new DOMParser().parseFromString(html, "text/html");
    const newMain = parsed.querySelector("main");
    if (!newMain) {
      window.location.href = url;
      return;
    }

    document.title = parsed.title;
    document.querySelector("main").replaceWith(document.importNode(newMain, true));

    if (push) window.history.pushState({}, "", url);
    window.scrollTo(0, 0);

    document.querySelectorAll("[data-nav-link][aria-current]").forEach((el) => el.removeAttribute("aria-current"));
    await runContentScripts();
  }

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest("a");
    if (!isPjaxable(link)) return;
    e.preventDefault();
    if (link.href === window.location.href) return;
    navigate(link.href, { push: true });
  });

  window.addEventListener("popstate", () => {
    navigate(window.location.href, { push: false });
  });
})();

(function () {
  var STORAGE_KEY = "sr_unlocked";
  var PASSWORD_HASH = "d07de405ee79c959a4950b8b2952d1ee8bd5a9d1d35bd0c7fb5c3fcccbd34dbd";

  if (localStorage.getItem(STORAGE_KEY) === "1") return;

  async function sha256Hex(text) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map(function (b) { return b.toString(16).padStart(2, "0"); })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var overlay = document.createElement("div");
    overlay.className = "site-gate";
    overlay.innerHTML =
      '<div class="site-gate__panel">' +
        '<p class="site-gate__eyebrow">Under construction</p>' +
        '<h1 class="site-gate__title">slip radio is getting ready</h1>' +
        '<p class="site-gate__copy">We’re still building this. Check back soon.</p>' +
        '<form class="site-gate__form">' +
          '<input type="password" class="site-gate__input" placeholder="Password" autocomplete="off" aria-label="Password">' +
          '<button type="submit" class="site-gate__submit">Enter</button>' +
        "</form>" +
        '<p class="site-gate__error" hidden>Incorrect password</p>' +
      "</div>";

    document.body.appendChild(overlay);
    document.body.classList.add("site-gate-active");

    var form = overlay.querySelector(".site-gate__form");
    var input = overlay.querySelector(".site-gate__input");
    var error = overlay.querySelector(".site-gate__error");

    input.focus();

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var hash = await sha256Hex(input.value);
      if (hash === PASSWORD_HASH) {
        localStorage.setItem(STORAGE_KEY, "1");
        document.body.classList.remove("site-gate-active");
        overlay.remove();
      } else {
        error.hidden = false;
        input.value = "";
        input.focus();
      }
    });
  });
})();

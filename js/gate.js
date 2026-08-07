(function () {
  var STORAGE_KEY = "sr_unlocked";

  if (localStorage.getItem(STORAGE_KEY) === "1") return;

  document.addEventListener("DOMContentLoaded", function () {
    var overlay = document.createElement("div");
    overlay.className = "site-gate";
    overlay.setAttribute("role", "button");
    overlay.setAttribute("tabindex", "0");
    overlay.setAttribute("aria-label", "Enter site");
    overlay.innerHTML =
      '<img class="site-gate__sign" src="/assets/images/warning.png" alt="">' +
      '<p class="site-gate__date">8.9.26</p>';

    document.body.appendChild(overlay);
    document.body.classList.add("site-gate-active");

    function unlock() {
      localStorage.setItem(STORAGE_KEY, "1");
      document.body.classList.remove("site-gate-active");
      overlay.remove();
    }

    overlay.addEventListener("click", unlock);
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        unlock();
      }
    });
  });
})();

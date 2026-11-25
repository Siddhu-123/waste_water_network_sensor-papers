// Light/dark theme. Loaded in <head> so the saved theme applies before first paint.
// Dark is the default; the choice is shared by the library and the PDF viewer.
(function () {
  var KEY = "library_theme";
  var root = document.documentElement;

  function saved() {
    try { return localStorage.getItem(KEY) === "light" ? "light" : "dark"; } catch (e) { return "dark"; }
  }

  function syncButtons(theme) {
    var next = theme === "light" ? "dark" : "light";
    var label = "Switch to " + next + " theme";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);
      btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
      btn.textContent = theme === "light" ? "☾" : "☀";
    });
  }

  function apply(theme) {
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    syncButtons(theme);
  }

  window.toggleTheme = function () {
    var theme = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    apply(theme);
  };

  apply(saved());
  document.addEventListener("DOMContentLoaded", function () {
    syncButtons(saved());
    document.addEventListener("click", function (event) {
      if (event.target.closest && event.target.closest("[data-theme-toggle]")) window.toggleTheme();
    });
  });
  // Another tab changed the theme.
  window.addEventListener("storage", function (event) {
    if (event.key === KEY) apply(saved());
  });
})();

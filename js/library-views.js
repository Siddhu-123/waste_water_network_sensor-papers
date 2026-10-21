// ==========================================
// Library display modes: List / Tiles
// ==========================================
// Only toggles data attributes and button state. Records, actions and
// annotation IDs are rendered elsewhere and are never touched here.

(function () {
  const VIEWS = ["list", "tiles"];
  const SECTIONS = [
    {
      name: "academic",
      storageKey: "libraryView.v4.academic",
      fallback: "list",
      targetId: "papersTableContainer",
    },
    {
      name: "grey",
      storageKey: "libraryView.v4.grey",
      fallback: "tiles",
      targetId: "greyLitGrid",
    },
  ];

  function readPreference(section) {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get(section.name + "View") || (section.name === "grey" ? params.get("view") : "");
      if (urlView && VIEWS.indexOf(urlView) !== -1) {
        return urlView;
      }
      const saved = window.localStorage.getItem(section.storageKey);
      return VIEWS.indexOf(saved) !== -1 ? saved : section.fallback;
    } catch (err) {
      return section.fallback;
    }
  }

  function savePreference(section, view) {
    try {
      window.localStorage.setItem(section.storageKey, view);
    } catch (err) {
      // Storage disabled or full: the choice still applies for this visit.
    }
  }

  function applyView(section, toggle, view) {
    const target = document.getElementById(section.targetId);
    if (target) target.dataset.view = view;
    toggle.querySelectorAll("[data-view-option]").forEach((btn) => {
      btn.setAttribute(
        "aria-pressed",
        btn.dataset.viewOption === view ? "true" : "false",
      );
    });
  }

  // Tiles use grid/flex display, which can drop native table semantics in
  // some browsers, so the roles are stated explicitly on the existing nodes.
  function setTableRoles() {
    const table = document.getElementById("papersTable");
    if (!table) return;
    table.setAttribute("role", "table");
    table
      .querySelectorAll("thead, tbody")
      .forEach((el) => el.setAttribute("role", "rowgroup"));
    table.querySelectorAll("tr").forEach((el) => el.setAttribute("role", "row"));
    table
      .querySelectorAll("th")
      .forEach((el) => el.setAttribute("role", "columnheader"));
    table.querySelectorAll("td").forEach((el) => el.setAttribute("role", "cell"));
  }

  function watchTableRows() {
    const body = document.getElementById("tableBody");
    if (!body || typeof MutationObserver === "undefined") return;
    new MutationObserver(setTableRoles).observe(body, { childList: true });
  }

  SECTIONS.forEach((section) => {
    const toggle = document.querySelector(
      '[data-library-view="' + section.name + '"]',
    );
    if (!toggle) return;
    applyView(section, toggle, readPreference(section));
    toggle.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-view-option]");
      if (!btn || !toggle.contains(btn)) return;
      const view = btn.dataset.viewOption;
      if (VIEWS.indexOf(view) === -1) return;
      applyView(section, toggle, view);
      savePreference(section, view);
    });
  });

  setTableRoles();
  watchTableRows();
})();

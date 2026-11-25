// Click handling for buttons built from templates. Buttons name a function with
// data-action (and an optional data-arg) instead of an inline onclick, so the
// page can run under a security policy that blocks inline script.
(function () {
  "use strict";
  const ALLOWED = new Set(["openSummary", "openGreyLitSummary", "toggleTakeaways", "resetGreyLitFilters", "setInstructorStudent"]);
  document.addEventListener("click", (event) => {
    const el = event.target.closest && event.target.closest("[data-action]");
    if (!el || !ALLOWED.has(el.dataset.action)) return;
    const fn = window[el.dataset.action];
    if (typeof fn !== "function") return;
    const raw = el.dataset.arg;
    if (raw === undefined) fn();
    else fn(el.dataset.argType === "number" ? Number(raw) : raw);
  });
})();

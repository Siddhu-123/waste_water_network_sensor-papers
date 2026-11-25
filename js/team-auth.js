// Team password gate for the shared annotation backend. Loaded only by the
// contributor editor (pdf-viewer.html) and the library page; public pages never
// call it. A team member types the password once; the backend returns a signed
// token that is kept in this browser's localStorage and sent with each request.
(function () {
  "use strict";
  const KEY = "library_team_token";
  let pending = null;

  function token() {
    try { return localStorage.getItem(KEY) || ""; } catch (_e) { return ""; }
  }

  function headers(extra) {
    const out = Object.assign({}, extra || {});
    const t = token();
    if (t) out.Authorization = "Bearer " + t;
    return out;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (_e) {}
  }

  // The worker on the live site; any host can override via annotation-config.js.
  function loginUrl() {
    const base = String(window.ANNOTATION_API_BASE || "https://pdf-annotations.sidcode3535.workers.dev").replace(/\/+$/, "");
    return base + "/api/login";
  }

  // Team members by first name; the value is the key the library's data uses.
  function teamOptions() {
    const team = (window.TeamNames && window.TeamNames.list) || [];
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    return team.map((p) => '<option value="' + esc(p.key) + '">' + esc(p.first) + "</option>").join("");
  }

  function buildDialog(askName) {
    const dialog = document.createElement("dialog");
    dialog.className = "team-auth-dialog";
    dialog.style.cssText = "position:fixed;inset:0;margin:auto;height:fit-content;max-width:340px;width:calc(100% - 32px);padding:20px;border-radius:12px;border:1px solid rgba(128,128,128,.4);background:Canvas;color:CanvasText;font:14px/1.4 Inter,system-ui,sans-serif";
    dialog.innerHTML =
      '<form method="dialog" style="display:grid;gap:10px;margin:0">' +
      '<strong style="font-size:15px">' + (askName ? "Team login" : "Team password") + '</strong>' +
      '<span style="opacity:.75">Shared notes and highlights are for the project team. Enter the password once on this browser.</span>' +
      (askName ? '<select name="author" required style="padding:8px 10px;border-radius:8px;border:1px solid rgba(128,128,128,.5);font:inherit;background:Field;color:FieldText"><option value="">Your name</option>' + teamOptions() + "</select>" : "") +
      '<input type="password" name="password" placeholder="Team password" autocomplete="current-password" required style="padding:8px 10px;border-radius:8px;border:1px solid rgba(128,128,128,.5);font:inherit;background:Field;color:FieldText">' +
      '<span class="team-auth-error" role="alert" style="color:#d33;min-height:1.2em"></span>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button type="button" value="skip" style="padding:7px 12px;border-radius:8px;font:inherit">Read without notes</button>' +
      '<button type="submit" value="unlock" style="padding:7px 14px;border-radius:8px;font:inherit;font-weight:600">Unlock</button>' +
      "</div></form>";
    document.body.appendChild(dialog);
    return dialog;
  }

  // Shows the password dialog and resolves true once a token is saved, false if skipped.
  // With { askName: true } it also asks for the author name and resolves { name } instead.
  function unlock(url, options) {
    const askName = Boolean(options && options.askName);
    if (pending) return pending;
    pending = new Promise((resolve) => {
      const dialog = buildDialog(askName);
      const form = dialog.querySelector("form");
      const input = form.elements.password;
      const author = form.elements.author;
      const error = dialog.querySelector(".team-auth-error");
      const submit = form.querySelector('button[type="submit"]');
      const finish = (ok) => { dialog.close(); dialog.remove(); pending = null; resolve(ok); };
      const skip = form.querySelector('button[value="skip"]');
      if (askName) skip.textContent = "Cancel";
      skip.addEventListener("click", () => finish(false));
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(false); });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;
        error.textContent = "";
        try {
          const res = await fetch(url || loginUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: input.value }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.token) throw new Error(data.error || "Login failed (HTTP " + res.status + ")");
          try { localStorage.setItem(KEY, data.token); } catch (_e) {}
          finish(askName ? { name: author.value } : true);
        } catch (err) {
          error.textContent = err.message || "Login failed.";
          input.select();
        } finally {
          submit.disabled = false;
        }
      });
      dialog.showModal();
      (author || input).focus();
    });
    return pending;
  }

  // Footer "Team login" on the public page: name + password, then the team view.
  async function login() {
    const result = await unlock(loginUrl(), { askName: true });
    if (!result || !result.name) return;
    // Public mode blocks saving a name, so lift it for this one write before leaving the page.
    window.PUBLIC_MODE = false;
    if (window.BrowserIdentity) window.BrowserIdentity.setName(result.name);
    location.href = "index.html?public=0";
  }

  // Log out: forget the token, the saved name and the cached team notes on this
  // browser, then show the public library.
  function logout() {
    clear();
    if (window.BrowserIdentity) window.BrowserIdentity.setName("");
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("capstone_annotations"))
        .forEach((k) => localStorage.removeItem(k));
    } catch (_e) {}
    location.href = "index.html?public=1";
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest) return;
    const trigger = event.target.closest("[data-team-login],[data-team-logout]");
    if (!trigger) return;
    event.preventDefault();
    if (trigger.hasAttribute("data-team-logout")) logout();
    else login();
  });

  window.TeamAuth = { token, headers, clear, unlock, login, logout, loginUrl };
})();

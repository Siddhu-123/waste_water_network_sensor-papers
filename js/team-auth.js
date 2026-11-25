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

  function buildDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "team-auth-dialog";
    dialog.style.cssText = "max-width:340px;width:calc(100% - 32px);padding:20px;border-radius:12px;border:1px solid rgba(128,128,128,.4);background:Canvas;color:CanvasText;font:14px/1.4 Inter,system-ui,sans-serif";
    dialog.innerHTML =
      '<form method="dialog" style="display:grid;gap:10px;margin:0">' +
      '<strong style="font-size:15px">Team password</strong>' +
      '<span style="opacity:.75">Shared notes and highlights are for the project team. Enter the password once on this browser.</span>' +
      '<input type="password" name="password" autocomplete="current-password" required style="padding:8px 10px;border-radius:8px;border:1px solid rgba(128,128,128,.5);font:inherit;background:Field;color:FieldText">' +
      '<span class="team-auth-error" role="alert" style="color:#d33;min-height:1.2em"></span>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button type="button" value="skip" style="padding:7px 12px;border-radius:8px;font:inherit">Read without notes</button>' +
      '<button type="submit" value="unlock" style="padding:7px 14px;border-radius:8px;font:inherit;font-weight:600">Unlock</button>' +
      "</div></form>";
    document.body.appendChild(dialog);
    return dialog;
  }

  // Shows the password dialog and resolves true once a token is saved, false if skipped.
  function unlock(loginUrl) {
    if (pending) return pending;
    pending = new Promise((resolve) => {
      const dialog = buildDialog();
      const form = dialog.querySelector("form");
      const input = form.elements.password;
      const error = dialog.querySelector(".team-auth-error");
      const submit = form.querySelector('button[type="submit"]');
      const finish = (ok) => { dialog.close(); dialog.remove(); pending = null; resolve(ok); };
      form.querySelector('button[value="skip"]').addEventListener("click", () => finish(false));
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(false); });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;
        error.textContent = "";
        try {
          const res = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: input.value }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.token) throw new Error(data.error || "Login failed (HTTP " + res.status + ")");
          try { localStorage.setItem(KEY, data.token); } catch (_e) {}
          finish(true);
        } catch (err) {
          error.textContent = err.message || "Login failed.";
          input.select();
        } finally {
          submit.disabled = false;
        }
      });
      dialog.showModal();
      input.focus();
    });
    return pending;
  }

  window.TeamAuth = { token, headers, clear, unlock };
})();

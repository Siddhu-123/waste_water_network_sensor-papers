// Public read-only view. A browser that has never picked a contributor name
// (for example a phone that scanned a printed QR code) gets it automatically,
// even when the link carries ?user=<name>. ?public=1 forces it; ?public=0 is the
// team entry and shows the normal page so a name can be picked. Public visitors
// get no sign-in, editing or contributor sections, the read-only reader instead of
// the annotation editor, and the pages make no backend calls for them.
(function (global) {
  function hasSavedName() {
    try {
      const store = global.localStorage;
      const legacy = store.getItem("capstone_user_name") || store.getItem("pdf_active_user") || "";
      if (legacy.trim() && legacy.trim().toLowerCase() !== "unknown user") return true;
      const map = JSON.parse(store.getItem("capstone_browser_identity_map") || "null");
      const id = store.getItem("capstone_device_id");
      return Boolean(map && id && map.map && map.map[id] && map.map[id].name);
    } catch (e) {
      return false;
    }
  }

  let flag = null;
  try {
    flag = new URLSearchParams(global.location.search).get("public");
  } catch (e) {
    flag = null;
  }
  const on = flag === "1" || (flag !== "0" && !hasSavedName());
  global.PUBLIC_MODE = on;
  if (!on) return;

  global.document.documentElement.classList.add("public-view");

  // The annotation editor is team-only: public visitors get the read-only reader.
  function readerUrl(url) {
    const reader = new URL("./view.html", url);
    ["pdf", "title", "page"].forEach((key) => {
      const value = url.searchParams.get(key);
      if (value) reader.searchParams.set(key, value);
    });
    return reader;
  }
  if (/\/pdf-viewer\.html$/.test(global.location.pathname)) {
    global.location.replace(readerUrl(new URL(global.location.href)).href);
    return;
  }

  // Viewer links are built in several places; add the flag when one is followed.
  function keepPublic(event) {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link) return;
    const url = new URL(link.getAttribute("href"), global.location.href);
    if (url.origin !== global.location.origin || !/\/pdf-viewer\.html$/.test(url.pathname)) return;
    link.href = readerUrl(url).href;
  }
  global.document.addEventListener("click", keepPublic, true);
  global.document.addEventListener("auxclick", keepPublic, true);
})(window);

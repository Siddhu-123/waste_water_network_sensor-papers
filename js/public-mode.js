// Public read-only view. A browser that has never picked a contributor name
// (for example a phone that scanned a printed QR code) gets it automatically,
// even when the link carries ?user=<name>. ?public=1 forces it; ?public=0 is the
// contributor sign-in entry and shows the normal page so a name can be picked.
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

  // Viewer links are built in several places; add the flag when one is followed.
  function keepPublic(event) {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link) return;
    const url = new URL(link.getAttribute("href"), global.location.href);
    if (url.origin !== global.location.origin || !/\/pdf-viewer\.html$/.test(url.pathname)) return;
    url.searchParams.delete("user");
    url.searchParams.set("public", "1");
    link.href = url.href;
  }
  global.document.addEventListener("click", keepPublic, true);
  global.document.addEventListener("auxclick", keepPublic, true);
})(window);

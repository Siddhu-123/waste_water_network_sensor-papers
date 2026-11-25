// Public read-only view. Every browser gets it unless it holds a team token from
// the footer "Team login" (for example a phone that scanned a printed QR code).
// ?public=1 forces it even for the team. Public visitors
// get no sign-in, editing or contributor sections, the read-only reader instead of
// the annotation editor, and the pages make no backend calls for them.
(function (global) {
  let flag = null;
  try {
    flag = new URLSearchParams(global.location.search).get("public");
  } catch (e) {
    flag = null;
  }
  // The team view needs a team token (from the footer Team login). A saved name
  // alone, or ?public=0, is not enough.
  function hasTeamToken() {
    try { return Boolean(global.localStorage.getItem("library_team_token")); } catch (e) { return false; }
  }
  const on = flag === "1" || !hasTeamToken();
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

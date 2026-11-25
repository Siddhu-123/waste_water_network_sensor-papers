// Annotation API Configuration
// Cloudflare is the shared annotation store; localhost may use a local API.

// 1. Live Cloudflare Worker URL:
window.CLOUDFLARE_WORKER_URL = "https://pdf-annotations.sidcode3535.workers.dev";

// 2. Computed API Base with priority:
// Explicit custom API > saved custom API > Cloudflare. Retired Vercel links use Cloudflare.
window.ANNOTATION_API_BASE = (function () {
  // Overrides may only point at the live worker or a local test server, so a
  // crafted link cannot send the team password or token anywhere else.
  function activeApi(value) {
    const base = String(value || "").trim().replace(/\/+$/, "");
    try {
      const url = new URL(base);
      const local = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
      if (local || url.origin === window.CLOUDFLARE_WORKER_URL) return url.origin;
    } catch (_e) {}
    return window.CLOUDFLARE_WORKER_URL;
  }
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const queryApi = urlParams.get("api");
    if (queryApi) return activeApi(queryApi);
  } catch (_e) {}

  try {
    const custom = localStorage.getItem("custom_annotation_api_base");
    if (custom) return activeApi(custom);
  } catch (_e) {}

  if (window.CLOUDFLARE_WORKER_URL && String(window.CLOUDFLARE_WORKER_URL).trim()) {
    return String(window.CLOUDFLARE_WORKER_URL).trim().replace(/\/+$/, "");
  }

  return "";
})();

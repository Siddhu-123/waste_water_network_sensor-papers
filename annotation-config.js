// Annotation API Configuration
// Supports Cloudflare Workers (recommended) and Vercel/local fallbacks.

// 1. Live Cloudflare Worker URL:
window.CLOUDFLARE_WORKER_URL = "https://pdf-annotations.sidcode3535.workers.dev";

// 2. Computed API Base with priority:
// Query Param (?api=...) > LocalStorage > Cloudflare Worker > Vercel fallback > Same origin
window.ANNOTATION_API_BASE = (function () {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const queryApi = urlParams.get("api");
    if (queryApi) return queryApi.trim().replace(/\/+$/, "");
  } catch (_e) {}

  try {
    const custom = localStorage.getItem("custom_annotation_api_base");
    if (custom) return custom.trim().replace(/\/+$/, "");
  } catch (_e) {}

  if (window.CLOUDFLARE_WORKER_URL && String(window.CLOUDFLARE_WORKER_URL).trim()) {
    return String(window.CLOUDFLARE_WORKER_URL).trim().replace(/\/+$/, "");
  }

  if (window.location.hostname === "siddhu-123.github.io") {
    return "https://waste-water-network-sensor-papers-two.vercel.app";
  }

  return "";
})();

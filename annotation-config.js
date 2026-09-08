// GitHub Pages hosts the public library, while Vercel hosts the shared API.
// Keep the Vercel-hosted viewer same-origin and route only GitHub Pages through
// the Vercel API.
window.ANNOTATION_API_BASE = window.location.hostname === "siddhu-123.github.io"
  ? "https://waste-water-network-sensor-papers-two.vercel.app"
  : "";

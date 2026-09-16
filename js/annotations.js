// ==========================================
// Annotations: Badge Counts & Live Summary
// ==========================================

// Shared Annotations Summary for live table badges
let annotationsSummary = null;

async function loadAnnotationsSummary() {
  const host = window.location.hostname;
  const configuredApi = String(
    window.ANNOTATION_API_BASE ||
      (host === "siddhu-123.github.io"
        ? "https://waste-water-network-sensor-papers-two.vercel.app"
        : ""),
  ).trim().replace(/\/+$/, "");
  const sameOriginApi = host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
  const apiBase = configuredApi || (sameOriginApi ? "" : null);

  // Instant local cache
  try {
    const cached = localStorage.getItem("capstone_annotations_cache");
    if (cached) {
      annotationsSummary = JSON.parse(cached);
      updateAllPaperBadges();
    }
  } catch (_e) {}

  if (apiBase !== null) {
    try {
      const res = await fetch(apiBase + "/api/annotations", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object") {
          annotationsSummary = data;
          localStorage.setItem("capstone_annotations_cache", JSON.stringify(data));
          updateAllPaperBadges();
        }
      }
    } catch (_err) {}
  }
}

function updateAllPaperBadges() {
  if (!annotationsSummary || !annotationsSummary.papers) return;
  Object.keys(annotationsSummary.papers).forEach((pid) => {
    const info = annotationsSummary.papers[pid];
    const badge = document.getElementById(`paper-badge-${pid}`);
    const pdfBtn = document.getElementById(`paper-pdf-btn-${pid}`);
    if (badge) {
      const count = info.count || 0;
      if (count > 0) {
        badge.style.display = "inline-flex";
        badge.textContent = `💬 ${count}`;
        const authorsList = info.authors && info.authors.length ? info.authors.join(", ") : "Team";
        if (pdfBtn) {
          pdfBtn.title = `Read PDF (${count} note${count === 1 ? "" : "s"} by ${authorsList})`;
        }
      } else {
        badge.style.display = "none";
        if (pdfBtn) {
          pdfBtn.title = "Read paper & annotate PDF";
        }
      }
    }
  });
}

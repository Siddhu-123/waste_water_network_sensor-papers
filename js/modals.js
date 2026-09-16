// ==========================================
// Modals: 8-Step Research Summary Dialog
// ==========================================

let currentSummaryPaperId = null;
let sharedSummaryData = {};
let sharedSummaryLoadState = "loading";

const stepLabels = [
  { num: 1, key: "citation", label: "Citation" },
  { num: 2, key: "intro", label: "Introduction" },
  { num: 3, key: "methods", label: "Aims & Research Methods" },
  { num: 4, key: "scope", label: "Scope" },
  {
    num: 5,
    key: "usefulness",
    label: "Usefulness (To Wastewater Sensing / Research)",
  },
  {
    num: 6,
    key: "limitations",
    label: "Limitations & Operational Constraints",
  },
  { num: 7, key: "conclusions", label: "Conclusions" },
  {
    num: 8,
    key: "reflection",
    label: "Reflection (How it Fits into Paper 1 / Thesis)",
  },
];

function getSummarySteps(paper) {
  const sharedSteps =
    sharedSummaryData[String(paper.id)] ||
    sharedSummaryData[paper.id] ||
    {};
  return {
    ...paper.steps,
    ...sharedSteps,
  };
}

function openSummary(id) {
  const paper = papersData.find((p) => p.id === id);
  if (!paper) return;

  currentSummaryPaperId = id;
  document.getElementById("modalPaperTitle").innerText = paper.title;
  document.getElementById("modalPaperMeta").innerText =
    `${paper.authors} — ${paper.journal}`;
  document.getElementById("modalPdfLink").href = getPdfViewerUrl(paper);
  renderSummary();
  document.getElementById("summaryStatus").innerText =
    sharedSummaryLoadState === "loaded"
      ? "Shared summaries loaded from GitHub."
      : sharedSummaryLoadState === "loading"
        ? "Loading shared summaries from GitHub..."
        : "Shared file unavailable; showing bundled fallback.";
  document.getElementById("summaryModal").style.display = "flex";
}

function renderSummary() {
  const paper = papersData.find((p) => p.id === currentSummaryPaperId);
  if (!paper) return;

  const steps = getSummarySteps(paper);
  let html = "";
  stepLabels.forEach((step) => {
    const text = steps[step.key] || "";
    html += `
              <div class="step-item">
                  <div class="step-badge">${step.num}</div>
                  <div class="step-content">
                      <div class="step-label">${escapeHtml(step.label)}</div>
                      <div class="step-text">${escapeHtml(text)}</div>
                  </div>
              </div>
          `;
  });

  document.getElementById("modalBodyContent").innerHTML = html;
}

function closeModal() {
  document.getElementById("summaryModal").style.display = "none";
}

function closeModalOnOverlay(e) {
  if (e.target.id === "summaryModal") {
    closeModal();
  }
}

// ===============================================================
// Grey Literature & Utility Reports: Logic, Filters & Rendering
// ===============================================================

let greyLitData = [];
let filteredGreyLitData = [];
let activeContributorFilter = "all";
let greyMajor = "all";
let greySub = "all";
let greyLitSearchQuery = "";
let findingsMarkdownCache = "";
let openTakeawaysId = null;

// Distinct color styling for major water utilities & engineering bodies
const UTILITY_THEMES = {
  "Sydney Water": { bg: "rgba(2, 132, 199, 0.15)", border: "rgba(56, 189, 248, 0.4)", text: "#38bdf8" },
  "SA Water": { bg: "rgba(13, 148, 136, 0.18)", border: "rgba(45, 212, 191, 0.45)", text: "#2dd4bf" },
  "WSAA": { bg: "rgba(99, 102, 241, 0.18)", border: "rgba(129, 140, 248, 0.4)", text: "#a5b4fc" },
  "Icon Water": { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(52, 211, 153, 0.4)", text: "#6ee7b7" },
  "Melbourne Water": { bg: "rgba(14, 165, 233, 0.15)", border: "rgba(56, 189, 248, 0.4)", text: "#7dd3fc" },
  "Hunter Water": { bg: "rgba(6, 182, 212, 0.15)", border: "rgba(34, 211, 238, 0.4)", text: "#67e8f9" },
  "TasWater": { bg: "rgba(20, 184, 166, 0.15)", border: "rgba(45, 212, 191, 0.4)", text: "#5eead4" },
  "Yarra Valley Water": { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(96, 165, 250, 0.4)", text: "#93c5fd" },
  "Unitywater": { bg: "rgba(168, 85, 247, 0.15)", border: "rgba(192, 132, 252, 0.4)", text: "#d8b4fe" },
  "Watercare": { bg: "rgba(14, 116, 144, 0.2)", border: "rgba(6, 182, 212, 0.45)", text: "#22d3ee" },
  "US EPA": { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(251, 191, 36, 0.4)", text: "#fcd34d" },
  "EPA": { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(251, 191, 36, 0.4)", text: "#fcd34d" },
  "Siemens": { bg: "rgba(0, 153, 153, 0.18)", border: "rgba(0, 204, 204, 0.45)", text: "#2dd4bf" },
  "Pulsar": { bg: "rgba(234, 88, 12, 0.16)", border: "rgba(251, 146, 60, 0.45)", text: "#fb923c" },
  "Innovyze": { bg: "rgba(14, 165, 233, 0.18)", border: "rgba(56, 189, 248, 0.45)", text: "#38bdf8" },
  "CSIRO": { bg: "rgba(16, 185, 129, 0.16)", border: "rgba(52, 211, 153, 0.45)", text: "#34d399" },
  "WRF": { bg: "rgba(99, 102, 241, 0.18)", border: "rgba(129, 140, 248, 0.45)", text: "#818cf8" },
  "Water Research Foundation": { bg: "rgba(99, 102, 241, 0.18)", border: "rgba(129, 140, 248, 0.45)", text: "#818cf8" },
  "WERF": { bg: "rgba(139, 92, 246, 0.16)", border: "rgba(167, 139, 250, 0.4)", text: "#c4b5fd" },
  "YSI": { bg: "rgba(6, 182, 212, 0.18)", border: "rgba(34, 211, 238, 0.45)", text: "#22d3ee" },
  "Xylem": { bg: "rgba(6, 182, 212, 0.18)", border: "rgba(34, 211, 238, 0.45)", text: "#22d3ee" },
  "ASTM": { bg: "rgba(168, 85, 247, 0.16)", border: "rgba(192, 132, 252, 0.45)", text: "#c084fc" },
  "ISO": { bg: "rgba(168, 85, 247, 0.16)", border: "rgba(192, 132, 252, 0.45)", text: "#c084fc" },
  "ASCE": { bg: "rgba(37, 99, 235, 0.18)", border: "rgba(96, 165, 250, 0.4)", text: "#60a5fa" },
  "Water UK": { bg: "rgba(147, 51, 234, 0.16)", border: "rgba(192, 132, 252, 0.4)", text: "#c084fc" },
  "UKWIR": { bg: "rgba(147, 51, 234, 0.16)", border: "rgba(192, 132, 252, 0.4)", text: "#c084fc" },
  "Ofwat": { bg: "rgba(126, 34, 206, 0.18)", border: "rgba(168, 85, 247, 0.4)", text: "#d8b4fe" },
  "Tokyo Bureau of Sewerage": { bg: "rgba(225, 29, 72, 0.15)", border: "rgba(251, 113, 133, 0.4)", text: "#fda4af" },
  "King County": { bg: "rgba(30, 64, 175, 0.2)", border: "rgba(96, 165, 250, 0.4)", text: "#93c5fd" },
  "Metro Vancouver": { bg: "rgba(15, 118, 110, 0.2)", border: "rgba(45, 212, 191, 0.4)", text: "#5eead4" },
  "DC Water": { bg: "rgba(37, 99, 235, 0.18)", border: "rgba(96, 165, 250, 0.4)", text: "#60a5fa" },
  "United Utilities": { bg: "rgba(139, 92, 246, 0.18)", border: "rgba(167, 139, 250, 0.4)", text: "#c4b5fd" }
};

function getUtilityTheme(orgName) {
  for (const [key, theme] of Object.entries(UTILITY_THEMES)) {
    if (orgName.toLowerCase().includes(key.toLowerCase())) {
      return theme;
    }
  }
  return { bg: "rgba(100, 116, 139, 0.15)", border: "rgba(148, 163, 184, 0.3)", text: "#cbd5e1" };
}

function getCountryFlag(country) {
  const flags = {
    "Australia": "🇦🇺",
    "United Kingdom": "🇬🇧",
    "United States": "🇺🇸",
    "New Zealand": "🇳🇿",
    "Japan": "🇯🇵",
    "Canada": "🇨🇦",
    "Ireland": "🇮🇪",
    "Hong Kong": "🇭🇰",
    "Brazil": "🇧🇷",
    "Denmark": "🇩🇰",
    "Germany": "🇩🇪",
    "Switzerland": "🇨🇭",
    "Global": "🌐",
    "International": "🌐"
  };
  return flags[country] || "🌐";
}

// -------------------------------------------------------------
// Data Loader: Fetches grey-literature catalog from manifest
// -------------------------------------------------------------
async function loadGreyLiterature() {
  // 1. Immediately hydrate from bundled data if available
  if (window.__BUNDLED_DATA__ && Array.isArray(window.__BUNDLED_DATA__.greyLiterature) && greyLitData.length === 0) {
    greyLitData = [...window.__BUNDLED_DATA__.greyLiterature];
    const tabCountEl = document.getElementById("greyLitTabCount");
    if (tabCountEl) {
      tabCountEl.innerText = greyLitData.length;
    }
    populateGreyLitFilters();
    filterAndRenderGreyLit();
  }

  // 2. Fetch live data if served via HTTP / HTTPS
  try {
    const manifestResponse = await fetch("./contributors/manifest.json", { cache: "no-store" });
    if (!manifestResponse.ok) return;
    const manifest = await manifestResponse.json();

    const fetchPromises = [];
    if (manifest.contributors && Array.isArray(manifest.contributors)) {
      manifest.contributors.forEach((contributor) => {
        if (contributor.greyLiteratureFile) {
          const fileUrl = new URL(contributor.greyLiteratureFile, new URL("./contributors/manifest.json", window.location.href));
          fetchPromises.push(
            fetch(fileUrl, { cache: "no-store" })
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data && Array.isArray(data.greyLiterature)) {
                  return data.greyLiterature;
                }
                return [];
              })
              .catch((err) => {
                console.warn(`Could not load grey literature for ${contributor.name}:`, err);
                return [];
              })
          );
        }
      });
    }

    const results = await Promise.all(fetchPromises);
    const liveData = results.flat();
    if (liveData.length > 0) {
      greyLitData = liveData;
      const tabCountEl = document.getElementById("greyLitTabCount");
      if (tabCountEl) {
        tabCountEl.innerText = greyLitData.length;
      }
      populateGreyLitFilters();
      filterAndRenderGreyLit();
    }
  } catch (err) {
    console.warn("Could not fetch live grey literature (using bundled data):", err);
    if (greyLitData.length === 0 && window.__BUNDLED_DATA__ && Array.isArray(window.__BUNDLED_DATA__.greyLiterature)) {
      greyLitData = [...window.__BUNDLED_DATA__.greyLiterature];
      populateGreyLitFilters();
      filterAndRenderGreyLit();
    }
  }
}

// -------------------------------------------------------------
// Populate Contributor & Group Controls
// -------------------------------------------------------------
function populateGreyLitFilters() {
  const contributorSelect = document.getElementById("greyLitContributorFilter");

  const contributors = new Set();

  greyLitData.forEach((item) => {
    if (item.assignedTo) contributors.add(item.assignedTo);
  });

  // Populate contributor dropdown
  if (contributorSelect) {
    const prevVal = contributorSelect.value;
    contributorSelect.innerHTML = '<option value="all">Contributor: All Contributors</option>';
    Array.from(contributors).sort().forEach((contrib) => {
      const opt = document.createElement("option");
      opt.value = contrib;
      const count = greyLitData.filter((g) => g.assignedTo === contrib).length;
      opt.textContent = `${contrib} (${count})`;
      contributorSelect.appendChild(opt);
    });
    if (prevVal && (prevVal === "all" || contributors.has(prevVal))) {
      contributorSelect.value = prevVal;
    }
  }

  renderCategoryBar("grey", greyLitData, setGreyLitMajor);
  renderCategorySubBar("grey", greyLitData, greyMajor, setGreyLitSub);
  updateGreyLitCategorySelection();
}

function updateGreyLitCategorySelection() {
  markCategorySelection(document.getElementById("greyCategoryBar"), "major", greyMajor);
  markCategorySelection(document.getElementById("greySubBar"), "sub", greySub);
}

function setGreyLitMajor(major) {
  greyMajor = major;
  greySub = "all";
  renderCategorySubBar("grey", greyLitData, major, setGreyLitSub);
  updateGreyLitCategorySelection();
  filterAndRenderGreyLit();
}

function setGreyLitSub(sub) {
  greySub = sub;
  updateGreyLitCategorySelection();
  filterAndRenderGreyLit();
}

// Retain the category entry point for existing callers.
function setGreyLitCategory(category) {
  if (category === "all") {
    setGreyLitMajor("all");
    return;
  }
  const record = greyLitData.find((item) => item.category === category);
  if (!record) return;
  const { group, sub } = categoryGroupOf("grey", record);
  greyMajor = group.key;
  greySub = sub.key;
  renderCategorySubBar("grey", greyLitData, greyMajor, setGreyLitSub);
  updateGreyLitCategorySelection();
  filterAndRenderGreyLit();
}

// -------------------------------------------------------------
// Filter & Search Logic
// -------------------------------------------------------------
function filterAndRenderGreyLit() {
  const searchInput = document.getElementById("greyLitSearchInput");
  greyLitSearchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";

  const contributorSelect = document.getElementById("greyLitContributorFilter");
  activeContributorFilter = contributorSelect ? contributorSelect.value : "all";

  filteredGreyLitData = greyLitData.filter((item) => {
    // Contributor filter
    if (activeContributorFilter !== "all" && item.assignedTo !== activeContributorFilter) {
      return false;
    }

    const { group, sub } = categoryGroupOf("grey", item);
    if (greyMajor !== "all" && group.key !== greyMajor) return false;
    if (greySub !== "all" && sub.key !== greySub) return false;

    // Search query match
    if (greyLitSearchQuery) {
      const matchText = [
        item.title || "",
        item.organization || "",
        item.category || "",
        item.summary || "",
        item.assignedTo || "",
        Array.isArray(item.keyTakeaways) ? item.keyTakeaways.join(" ") : "",
        item.steps ? Object.values(item.steps).join(" ") : ""
      ].join(" ").toLowerCase();

      if (!matchText.includes(greyLitSearchQuery)) {
        return false;
      }
    }

    return true;
  });

  const summary = document.getElementById("greyResultsSummary");
  if (summary) {
    const selection = greyMajor === "all" ? "All reports" : categorySelectionLabel("grey", greyLitData, greyMajor, greySub);
    const user = activeContributorFilter === "all" ? "" : ` · ${activeContributorFilter}`;
    const filtered = greyMajor !== "all" || activeContributorFilter !== "all" || Boolean(greyLitSearchQuery);
    summary.textContent = `${selection}${user} · ${filteredGreyLitData.length}${filtered ? ` of ${greyLitData.length}` : ""}`;
  }
  renderGreyLitCards();
}

function resetGreyLitFilters() {
  const searchInput = document.getElementById("greyLitSearchInput");
  if (searchInput) searchInput.value = "";
  const contributorSelect = document.getElementById("greyLitContributorFilter");
  if (contributorSelect) contributorSelect.value = "all";
  activeContributorFilter = "all";
  setGreyLitMajor("all");
}

// -------------------------------------------------------------
// Card Rendering
// -------------------------------------------------------------
function renderGreyLitCards() {
  const grid = document.getElementById("greyLitGrid");
  if (!grid) return;
  openTakeawaysId = null;

  const header = `<div class="grey-list-header">
    <span>#</span><span>Title &amp; Organisation</span><span>Category</span><span>Contributor</span><span>Actions</span>
  </div>`;

  if (filteredGreyLitData.length === 0) {
    grid.innerHTML = header + `
      <div class="grey-lit-empty library-empty">
        <div class="library-empty-icon">🔍</div>
        <h3>No matching grey literature found</h3>
        <p>Try clearing your search query or selecting a different category.</p>
        <button class="btn-action btn-scholar library-empty-reset" onclick="resetGreyLitFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  let html = header;
  const sort = document.getElementById("greySort")?.value || "newest";
  sortLibraryItems(filteredGreyLitData, sort).forEach((item, index) => {
    const theme = getUtilityTheme(item.organization || "");
    const { group, sub } = window.categoryGroupOf("grey", item);
    const isPdf = Boolean(item.pdfUrl && item.pdfUrl !== "#");
    const externalLink = item.url || item.externalUrl;
    const hasExternal = Boolean(externalLink);
    const hasTakeaways = Array.isArray(item.keyTakeaways) && item.keyTakeaways.length > 0;

    const pdfViewerUrl = isPdf
      ? `./pdf-viewer.html?paper=${encodeURIComponent(item.id)}&pdf=${encodeURIComponent(item.pdfUrl)}&title=${encodeURIComponent(item.title)}&topic=Grey%20Literature`
      : "#";

    html += `
      <article class="grey-lit-card" id="card-${item.id}" data-user="${escapeHtml(item.assignedTo || "")}" data-year="${getLibraryYear(item)}" data-title="${escapeHtml(getLibraryTitle(item.title))}" title="Record ${escapeHtml(item.id)}">
        <span class="col-num grey-lit-num">${String(index + 1).padStart(2, "0")}</span>
        <div class="grey-lit-header library-tile-top">
          <span class="category-tag" title="${escapeHtml(item.category || "General")}"><i class="category-dot" style="background:${escapeHtml(group.color)}" aria-hidden="true"></i>${escapeHtml(sub.label)}</span>
          <span class="year-badge">${item.year || "Report"}</span>
        </div>
        <div class="grey-lit-main">
          <h3 class="grey-lit-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
          <div class="library-byline">
            <span class="org-badge" style="background: ${theme.bg}; border-color: ${theme.border}; color: ${theme.text};">${escapeHtml(item.organization || "Industry Body")}</span><span class="library-list-year">${item.year || "Report"}</span>
          </div>
        </div>

        <p class="grey-lit-summary">${escapeHtml(item.summary || "")}</p>

        <span class="doctype-pill library-contributor" style="opacity: 0.85;">👤 ${escapeHtml(item.assignedTo || "Contributor")}</span>
        ${
          hasTakeaways
            ? `
          <div class="grey-lit-takeaways-container" id="takeaways-${item.id}" style="display: none;">
            <div class="takeaways-header">
              <span class="takeaways-label">💡 Key Findings <span class="ai-badge" title="AI-Synthesized Analysis">AI</span>:</span>
            </div>
            <ul class="takeaways-list">
              ${item.keyTakeaways.map((t) => `<li><span class="ai-chip">AI</span><span>${escapeHtml(t)}</span></li>`).join("")}
            </ul>
          </div>
        `
            : ""
        }

        <div class="grey-lit-footer">
          <div class="grey-lit-meta">
            ${item.pages ? `<span>📄 ${item.pages}p</span>` : ""}
          </div>
          <div class="grey-lit-actions">
            <button type="button" class="btn-action btn-summary" onclick="openGreyLitSummary('${item.id}')" title="Open 8-step summary" aria-label="Summary">
              <span aria-hidden="true">📝</span><span class="action-label">Summary</span>
            </button>
            ${
              isPdf
                ? `<a href="${escapeHtml(pdfViewerUrl)}" target="_blank" rel="noopener" class="btn-action btn-pdf" title="Open PDF in Viewer with Sticky Notes" aria-label="PDF">
                    <span aria-hidden="true">📄</span><span class="action-label">PDF</span>
                   </a>`
                : ""
            }
            ${
              hasExternal
                ? `<a href="${escapeHtml(externalLink)}" target="_blank" rel="noopener" class="btn-action btn-scholar" title="Open the publisher's page" aria-label="Source">
                    <span aria-hidden="true">🔗</span><span class="action-label">Source</span>
                   </a>`
                : ""
            }
            ${
              hasTakeaways
                ? `<button type="button" class="btn-action btn-scholar" id="btn-takeaways-${item.id}" onclick="toggleTakeaways('${item.id}')" title="Toggle AI Key Findings" aria-label="Details" aria-expanded="false" aria-controls="takeaways-${item.id}">
                    <span aria-hidden="true">💡</span><span class="action-label">Details <span class="ai-badge-sm">AI</span></span>
                   </button>`
                : ""
            }
          </div>
        </div>
      </article>
    `;
  });

  grid.innerHTML = html;
}

function fitOpenTakeaways() {
  if (!openTakeawaysId) return;
  const card = document.getElementById(`card-${openTakeawaysId}`);
  const grid = document.getElementById("greyLitGrid");
  const container = document.getElementById(`takeaways-${openTakeawaysId}`);
  if (!card || !grid || !container) return;

  // Measure the unexpanded grid slot again after a resize or a view change.
  delete card.dataset.expand;
  card.style.removeProperty("--tile-width");
  card.style.removeProperty("--tile-height");
  container.style.display = "none";
  if (grid.dataset.view === "tiles" && grid.offsetWidth) {
    const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    if (columns > 1) {
      const bounds = card.getBoundingClientRect();
      const gridBounds = grid.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      card.style.setProperty("--tile-width", `${bounds.width}px`);
      card.style.setProperty("--tile-height", `${bounds.height}px`);
      card.dataset.expand = bounds.right + bounds.width + gap > gridBounds.right + 1
        ? "left" : "right";
    }
  }
  container.style.display = "block";
}

function toggleTakeaways(id) {
  const container = document.getElementById(`takeaways-${id}`);
  const btn = document.getElementById(`btn-takeaways-${id}`);
  if (!container) return;
  const isHidden = container.style.display === "none" || !container.style.display;
  if (isHidden) {
    if (openTakeawaysId && openTakeawaysId !== id) toggleTakeaways(openTakeawaysId);
    openTakeawaysId = id;
    fitOpenTakeaways();
    if (btn) {
      btn.innerHTML = `<span aria-hidden="true">✕</span><span class="action-label">Hide Details <span class="ai-badge-sm">AI</span></span>`;
      btn.setAttribute("aria-expanded", "true");
      btn.classList.add("active");
    }
  } else {
    container.style.display = "none";
    const card = document.getElementById(`card-${id}`);
    if (card) {
      delete card.dataset.expand;
      card.style.removeProperty("--tile-width");
      card.style.removeProperty("--tile-height");
    }
    if (openTakeawaysId === id) openTakeawaysId = null;
    if (btn) {
      btn.innerHTML = `<span aria-hidden="true">💡</span><span class="action-label">Details <span class="ai-badge-sm">AI</span></span>`;
      btn.setAttribute("aria-expanded", "false");
      btn.classList.remove("active");
    }
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openTakeawaysId) toggleTakeaways(openTakeawaysId);
});

let takeawaysResizeFrame = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(takeawaysResizeFrame);
  takeawaysResizeFrame = requestAnimationFrame(fitOpenTakeaways);
});

const takeawaysGrid = document.getElementById("greyLitGrid");
if (takeawaysGrid) {
  new MutationObserver(fitOpenTakeaways).observe(takeawaysGrid, {
    attributes: true,
    attributeFilter: ["data-view"],
  });
}

// -------------------------------------------------------------
// 8-Step Summary Modal for Grey Literature
// -------------------------------------------------------------
function openGreyLitSummary(id) {
  const item = greyLitData.find((g) => g.id === id);
  if (!item) return;

  const modal = document.getElementById("summaryModal");
  if (!modal) return;

  const titleEl = document.getElementById("modalPaperTitle");
  const metaEl = document.getElementById("modalPaperMeta");
  const pdfLink = document.getElementById("modalPdfLink");
  const editGithubLink = document.getElementById("modalEditGithubLink");
  const bodyContent = document.getElementById("modalBodyContent");
  const statusEl = document.getElementById("summaryStatus");

  if (titleEl) titleEl.innerText = item.title;
  if (metaEl) {
    metaEl.innerText = `${item.organization || 'Industry Body'} (${item.year || 'Report'}) — Category: ${item.category || 'General'} — Contributor: ${item.assignedTo || 'Team'}`;
  }

  // Handle PDF / external link
  const isPdf = Boolean(item.pdfUrl && item.pdfUrl !== "#");
  const externalLink = item.url || item.externalUrl;
  if (pdfLink) {
    if (isPdf) {
      pdfLink.href = item.pdfUrl.startsWith("./")
        ? `./pdf-viewer.html?paper=${encodeURIComponent(item.id)}&pdf=${encodeURIComponent(item.pdfUrl)}&title=${encodeURIComponent(item.title)}&topic=Grey%20Literature`
        : item.pdfUrl;
      pdfLink.style.display = "inline-flex";
      pdfLink.innerHTML = "📄 Open PDF + Notes";
    } else if (externalLink) {
      pdfLink.href = externalLink;
      pdfLink.style.display = "inline-flex";
      pdfLink.innerHTML = "🔗 Agency Portal";
    } else {
      pdfLink.style.display = "none";
    }
  }

  // Handle GitHub edit link
  if (editGithubLink) {
    if (item.assignedTo === "Satya Siddhartha") {
      editGithubLink.href = "https://github.com/Siddhu-123/waste_water_network_sensor-papers/edit/main/contributors/satya-siddhartha/grey-literature.json";
      editGithubLink.style.display = "inline-flex";
    } else if (item.assignedTo === "Rijoy John") {
      editGithubLink.href = "https://github.com/Siddhu-123/waste_water_network_sensor-papers/edit/main/contributors/rijoy-john/grey-literature.json";
      editGithubLink.style.display = "inline-flex";
    } else {
      editGithubLink.style.display = "none";
    }
  }

  // Build steps HTML
  const steps = item.steps || {};
  let html = "";
  if (steps.citation || steps.intro || steps.methods || steps.scope || steps.usefulness || steps.limitations || steps.conclusions || steps.reflection) {
    const glStepLabels = typeof stepLabels !== "undefined" ? stepLabels : [
      { num: 1, key: "citation", label: "Citation" },
      { num: 2, key: "intro", label: "Introduction" },
      { num: 3, key: "methods", label: "Aims & Research Methods" },
      { num: 4, key: "scope", label: "Scope" },
      { num: 5, key: "usefulness", label: "Usefulness (To Wastewater Sensing / Research)" },
      { num: 6, key: "limitations", label: "Limitations & Operational Constraints" },
      { num: 7, key: "conclusions", label: "Conclusions" },
      { num: 8, key: "reflection", label: "Reflection (How it Fits into Paper 1 / Thesis)" }
    ];

    glStepLabels.forEach((step) => {
      const text = steps[step.key] || "";
      if (text) {
        html += `
          <div class="step-item">
            <div class="step-badge">${step.num}</div>
            <div class="step-content">
              <div class="step-label">${escapeHtml(step.label)}</div>
              <div class="step-text">${escapeHtml(text)}</div>
            </div>
          </div>
        `;
      }
    });
  }

  // Fallback if no 8-step structure: show executive summary + key takeaways
  if (!html) {
    if (item.summary) {
      html += `
        <div class="step-item">
          <div class="step-badge">1</div>
          <div class="step-content">
            <div class="step-label">Executive Summary</div>
            <div class="step-text">${escapeHtml(item.summary)}</div>
          </div>
        </div>
      `;
    }
    if (Array.isArray(item.keyTakeaways) && item.keyTakeaways.length > 0) {
      html += `
        <div class="step-item">
          <div class="step-badge">2</div>
          <div class="step-content">
            <div class="step-label">Key Empirical Findings & Takeaways</div>
            <div class="step-text">
              <ul style="margin: 0; padding-left: 20px;">
                ${item.keyTakeaways.map((t) => `<li style="margin-bottom: 6px;">${escapeHtml(t)}</li>`).join("")}
              </ul>
            </div>
          </div>
        </div>
      `;
    }
    if (item.topic) {
      html += `
        <div class="step-item">
          <div class="step-badge">3</div>
          <div class="step-content">
            <div class="step-label">Core Focus Area</div>
            <div class="step-text">${escapeHtml(item.topic)}</div>
          </div>
        </div>
      `;
    }
  }

  if (bodyContent) bodyContent.innerHTML = html;

  if (statusEl) {
    statusEl.innerText = `Industry & Utility Report • Contributor: ${item.assignedTo || "Team"}`;
  }

  modal.style.display = "flex";
}

// -------------------------------------------------------------
// Executive Findings Reader Modal
// -------------------------------------------------------------
async function openFindingsModal() {
  const modal = document.getElementById("findingsModal");
  const bodyContent = document.getElementById("findingsModalBody");
  if (!modal || !bodyContent) return;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";

  if (!findingsMarkdownCache) {
    if (window.__BUNDLED_DATA__ && window.__BUNDLED_DATA__.findingsMarkdown) {
      findingsMarkdownCache = window.__BUNDLED_DATA__.findingsMarkdown;
    }

    try {
      const res = await fetch("./contributors/rijoy-john/compiled-papers/GREY_LITERATURE_FINDINGS.md", { cache: "no-store" });
      if (res.ok) {
        findingsMarkdownCache = await res.text();
      }
    } catch (err) {
      console.warn("Could not fetch live findings markdown (using bundled):", err);
    }
  }

  if (findingsMarkdownCache) {
    bodyContent.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding: 10px 14px; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 8px;">
        <span style="font-size: var(--fs-ui);">🤖</span>
        <span style="font-size: var(--fs-body); color: #d8b4fe; font-weight: 500;">
          <strong>AI-Assisted Cross-Utility Synthesis:</strong> The following matrix and findings have been extracted and synthesized with AI assistance from primary utility reports and design standards.
        </span>
        <span class="ai-badge" style="margin-left: auto;">AI</span>
      </div>
    ` + renderMarkdownToHtml(findingsMarkdownCache);
  } else {
    bodyContent.innerHTML = `
      <div style="padding: 30px; color: #f87171;">
        <h3>Failed to load findings document</h3>
        <p>Could not retrieve synthesis document.</p>
      </div>
    `;
  }
}

function closeFindingsModal() {
  const modal = document.getElementById("findingsModal");
  if (!modal) return;
  modal.style.display = "none";
  document.body.style.overflow = "";
}

function closeFindingsOnOverlay(e) {
  if (e.target.id === "findingsModal") {
    closeFindingsModal();
  }
}

// -------------------------------------------------------------
// Lightweight, Robust Markdown -> HTML Renderer
// Converts tables, headers, blockquotes, code, and bold text
// -------------------------------------------------------------
function renderMarkdownToHtml(md) {
  if (!md) return "";

  // Split into lines
  const lines = md.split("\n");
  let html = "";
  let inTable = false;
  let tableHeaderParsed = false;
  let tableHeaders = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Check table row
    if (line.startsWith("|") && line.endsWith("|")) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      if (!inTable) {
        inTable = true;
        tableHeaderParsed = false;
        tableHeaders = [];
        html += '<div class="findings-table-wrap"><table class="findings-table">\n';
      }

      // Check if it's separator row |---|---|
      if (line.match(/^\|(?:\s*:?-+:?\s*\|)+$/)) {
        tableHeaderParsed = true;
        continue;
      }

      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      if (!tableHeaderParsed) {
        tableHeaders = cells.map((c) => {
          const header = document.createElement("span");
          header.innerHTML = formatInlineMarkdown(c);
          return header.textContent;
        });
        html += "  <thead><tr>\n";
        cells.forEach((c) => {
          html += `    <th scope="col">${formatInlineMarkdown(c)}</th>\n`;
        });
        html += "  </tr></thead>\n  <tbody>\n";
      } else {
        html += "  <tr>\n";
        cells.forEach((c, index) => {
          html += `    <td data-label="${escapeHtml(tableHeaders[index] || "")}">${formatInlineMarkdown(c)}</td>\n`;
        });
        html += "  </tr>\n";
      }
      continue;
    } else if (inTable) {
      inTable = false;
      html += "  </tbody>\n</table></div>\n";
    }

    // List item
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        html += '<ul class="findings-list">\n';
        inList = true;
      }
      const itemText = line.replace(/^[-*]\s+/, "");
      html += `  <li>${formatInlineMarkdown(itemText)}</li>\n`;
      continue;
    } else if (line.match(/^\d+\.\s+/)) {
      if (!inList) {
        html += '<ol class="findings-list">\n';
        inList = true;
      }
      const itemText = line.replace(/^\d+\.\s+/, "");
      html += `  <li>${formatInlineMarkdown(itemText)}</li>\n`;
      continue;
    } else if (inList && line === "") {
      html += inList === true ? "</ul>\n" : "</ol>\n";
      inList = false;
    }

    // Headers
    if (line.startsWith("### ")) {
      const title = line.slice(4);
      html += `<h3>${formatInlineMarkdown(title)}</h3>\n`;
      continue;
    }
    if (line.startsWith("## ")) {
      const title = line.slice(3);
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      html += `<h2 id="${id}">${formatInlineMarkdown(title)}</h2>\n`;
      continue;
    }
    if (line.startsWith("# ")) {
      const title = line.slice(2);
      html += `<h1>${formatInlineMarkdown(title)}</h1>\n`;
      continue;
    }

    // Horizontal Rule
    if (line === "---" || line === "***") {
      html += '<hr class="findings-divider" />\n';
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      html += `<blockquote class="findings-quote">${formatInlineMarkdown(line.slice(2))}</blockquote>\n`;
      continue;
    }

    // Empty line
    if (line === "") {
      continue;
    }

    // Regular paragraph
    html += `<p class="findings-p">${formatInlineMarkdown(line)}</p>\n`;
  }

  if (inTable) {
    html += "  </tbody>\n</table></div>\n";
  }
  if (inList) {
    html += "</ul>\n";
  }

  return html;
}

function formatInlineMarkdown(text) {
  let res = escapeHtml(text);
  // Bold **text**
  res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic *text*
  res = res.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Inline code `code`
  res = res.replace(/`([^`]+)`/g, "<code>$1</code>");
  return res;
}

// -------------------------------------------------------------
// Tab Switching: Academic vs Grey Literature vs Instructor Mode
// -------------------------------------------------------------
function switchLibraryTab(tabName) {
  const academicSection = document.getElementById("academicSection");
  const greyLitSection = document.getElementById("greyLitSection");
  const instructorSection = document.getElementById("instructorSection");

  const tabAcademic = document.getElementById("tabAcademic");
  const tabGreyLit = document.getElementById("tabGreyLit");
  const tabInstructor = document.getElementById("tabInstructor");

  if (!academicSection || !greyLitSection) return;

  // Reset all tabs & sections
  academicSection.style.display = "none";
  greyLitSection.style.display = "none";
  if (instructorSection) instructorSection.style.display = "none";

  if (tabAcademic) {
    tabAcademic.classList.remove("active");
    tabAcademic.setAttribute("aria-selected", "false");
  }
  if (tabGreyLit) {
    tabGreyLit.classList.remove("active");
    tabGreyLit.setAttribute("aria-selected", "false");
  }
  if (tabInstructor) {
    tabInstructor.classList.remove("active");
    tabInstructor.setAttribute("aria-selected", "false");
  }

  if (tabName === "grey-literature" || tabName === "grey-lit") {
    greyLitSection.style.display = "block";
    if (tabGreyLit) {
      tabGreyLit.classList.add("active");
      tabGreyLit.setAttribute("aria-selected", "true");
    }
    history.replaceState(null, "", "#grey-literature");
  } else if (tabName === "instructor") {
    const activeUser = typeof getActiveUser === "function" ? getActiveUser() : "";
    if (typeof isInstructorUser === "function" && !isInstructorUser(activeUser)) {
      switchLibraryTab("academic");
      return;
    }
    if (instructorSection) instructorSection.style.display = "block";
    if (tabInstructor) {
      tabInstructor.classList.add("active");
      tabInstructor.setAttribute("aria-selected", "true");
    }
    if (typeof updateInstructorPills === "function") {
      updateInstructorPills();
    }
    if (typeof renderInstructorDashboard === "function") {
      renderInstructorDashboard();
    }
    history.replaceState(null, "", "#instructor");
  } else {
    academicSection.style.display = "block";
    if (tabAcademic) {
      tabAcademic.classList.add("active");
      tabAcademic.setAttribute("aria-selected", "true");
    }
    history.replaceState(null, "", "#academic");
  }
}

// Check URL Hash or Param on load
window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get("tab") || "";
  const hash = window.location.hash || "";
  if (hash === "#grey-literature" || hash === "#grey-lit" || tabParam === "grey-literature" || tabParam === "grey-lit") {
    switchLibraryTab("grey-literature");
  } else if (hash.startsWith("#instructor") || tabParam === "instructor") {
    const activeUser = typeof getActiveUser === "function" ? getActiveUser() : "";
    if (typeof isInstructorUser === "function" && !isInstructorUser(activeUser)) {
      switchLibraryTab("academic");
      return;
    }
    if (hash.includes("?")) {
      const q = new URLSearchParams(hash.split("?")[1] || "");
      const s = q.get("student");
      if (s) {
        currentInstructorStudent = s;
      }
    }
    switchLibraryTab("instructor");
  }
});


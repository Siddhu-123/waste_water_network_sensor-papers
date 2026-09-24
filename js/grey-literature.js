// ===============================================================
// Grey Literature & Utility Reports: Logic, Filters & Rendering
// ===============================================================

let greyLitData = [];
let filteredGreyLitData = [];
let activeOrgFilter = "all";
let activeRegionFilter = "all";
let activeDocTypeFilter = "all";
let activeContributorFilter = "all";
let greyLitSearchQuery = "";
let findingsMarkdownCache = "";

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
    greyLitData = results.flat();

    // Update Tab count
    const tabCountEl = document.getElementById("greyLitTabCount");
    if (tabCountEl) {
      tabCountEl.innerText = greyLitData.length;
    }

    populateGreyLitFilters();
    filterAndRenderGreyLit();
  } catch (err) {
    console.error("Error loading grey literature:", err);
  }
}

// -------------------------------------------------------------
// Populate Filter Dropdowns dynamically based on data
// -------------------------------------------------------------
function populateGreyLitFilters() {
  const contributorSelect = document.getElementById("greyLitContributorFilter");
  const orgSelect = document.getElementById("greyLitOrgFilter");
  const regionSelect = document.getElementById("greyLitRegionFilter");
  const docTypeSelect = document.getElementById("greyLitDocTypeFilter");

  if (!orgSelect || !regionSelect || !docTypeSelect) return;

  const contributors = new Set();
  const orgs = new Set();
  const regions = new Set();
  const docTypes = new Set();

  greyLitData.forEach((item) => {
    if (item.assignedTo) contributors.add(item.assignedTo);
    if (item.organization) orgs.add(item.organization);
    if (item.region || item.country) regions.add(item.region || item.country);
    if (item.docType) docTypes.add(item.docType);
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

  // Keep first "All" option and re-populate
  orgSelect.innerHTML = '<option value="all">Utility: All Organizations</option>';
  Array.from(orgs).sort().forEach((org) => {
    const opt = document.createElement("option");
    opt.value = org;
    opt.textContent = org;
    orgSelect.appendChild(opt);
  });

  regionSelect.innerHTML = '<option value="all">Region: All Jurisdictions</option>';
  Array.from(regions).sort().forEach((reg) => {
    const opt = document.createElement("option");
    opt.value = reg;
    opt.textContent = reg;
    regionSelect.appendChild(opt);
  });

  docTypeSelect.innerHTML = '<option value="all">Type: All Document Types</option>';
  Array.from(docTypes).sort().forEach((dt) => {
    const opt = document.createElement("option");
    opt.value = dt;
    opt.textContent = dt;
    docTypeSelect.appendChild(opt);
  });
}

// -------------------------------------------------------------
// Filter & Search Logic
// -------------------------------------------------------------
function filterAndRenderGreyLit() {
  const searchInput = document.getElementById("greyLitSearchInput");
  greyLitSearchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";

  const contributorSelect = document.getElementById("greyLitContributorFilter");
  activeContributorFilter = contributorSelect ? contributorSelect.value : "all";

  const orgSelect = document.getElementById("greyLitOrgFilter");
  activeOrgFilter = orgSelect ? orgSelect.value : "all";

  const regionSelect = document.getElementById("greyLitRegionFilter");
  activeRegionFilter = regionSelect ? regionSelect.value : "all";

  const docTypeSelect = document.getElementById("greyLitDocTypeFilter");
  activeDocTypeFilter = docTypeSelect ? docTypeSelect.value : "all";

  filteredGreyLitData = greyLitData.filter((item) => {
    // Contributor filter
    if (activeContributorFilter !== "all" && item.assignedTo !== activeContributorFilter) {
      return false;
    }

    // Search query match
    if (greyLitSearchQuery) {
      const matchText = [
        item.title || "",
        item.organization || "",
        item.country || "",
        item.region || "",
        item.docType || "",
        item.topic || "",
        item.summary || "",
        item.assignedTo || "",
        Array.isArray(item.keyTakeaways) ? item.keyTakeaways.join(" ") : ""
      ].join(" ").toLowerCase();

      if (!matchText.includes(greyLitSearchQuery)) {
        return false;
      }
    }

    // Org filter
    if (activeOrgFilter !== "all" && item.organization !== activeOrgFilter) {
      return false;
    }

    // Region filter
    if (activeRegionFilter !== "all" && (item.region !== activeRegionFilter && item.country !== activeRegionFilter)) {
      return false;
    }

    // Doc type filter
    if (activeDocTypeFilter !== "all" && item.docType !== activeDocTypeFilter) {
      return false;
    }

    return true;
  });

  // Update counter
  const countEl = document.getElementById("greyLitResultsCount");
  if (countEl) {
    countEl.innerHTML = `Showing <strong>${filteredGreyLitData.length}</strong> of ${greyLitData.length} industry reports and utility documents`;
  }

  renderGreyLitCards();
}

function resetGreyLitFilters() {
  const searchInput = document.getElementById("greyLitSearchInput");
  if (searchInput) searchInput.value = "";
  const contributorSelect = document.getElementById("greyLitContributorFilter");
  if (contributorSelect) contributorSelect.value = "all";
  const orgSelect = document.getElementById("greyLitOrgFilter");
  if (orgSelect) orgSelect.value = "all";
  const regionSelect = document.getElementById("greyLitRegionFilter");
  if (regionSelect) regionSelect.value = "all";
  const docTypeSelect = document.getElementById("greyLitDocTypeFilter");
  if (docTypeSelect) docTypeSelect.value = "all";
  filterAndRenderGreyLit();
}

// -------------------------------------------------------------
// Card Rendering
// -------------------------------------------------------------
function renderGreyLitCards() {
  const grid = document.getElementById("greyLitGrid");
  if (!grid) return;

  if (filteredGreyLitData.length === 0) {
    grid.innerHTML = `
      <div class="grey-lit-empty">
        <div style="font-size: 32px; margin-bottom: 12px;">🔍</div>
        <h3>No matching grey literature found</h3>
        <p>Try clearing your search query or adjusting your filters.</p>
        <button class="btn-action btn-scholar" style="margin-top: 14px;" onclick="resetGreyLitFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  let html = "";
  filteredGreyLitData.forEach((item) => {
    const theme = getUtilityTheme(item.organization || "");
    const flag = getCountryFlag(item.country || item.region || "");
    const isPdf = item.mediaType === "pdf" && item.pdfUrl;
    const hasExternal = Boolean(item.externalUrl);
    const hasTakeaways = Array.isArray(item.keyTakeaways) && item.keyTakeaways.length > 0;
    const hasSteps = Boolean(item.steps && (item.steps.citation || item.steps.intro || item.steps.methods || item.steps.usefulness));

    const pdfViewerUrl = isPdf
      ? `./pdf-viewer.html?paper=${encodeURIComponent(item.id)}&pdf=${encodeURIComponent(item.pdfUrl)}&title=${encodeURIComponent(item.title)}&topic=Grey%20Literature`
      : "#";

    html += `
      <article class="grey-lit-card" id="card-${item.id}">
        <div class="grey-lit-header">
          <div class="grey-lit-badges">
            <span class="org-badge" style="background: ${theme.bg}; border-color: ${theme.border}; color: ${theme.text};">
              ${escapeHtml(item.organization || "Utility")}
            </span>
            <span class="region-badge" title="${escapeHtml(item.country || item.region || '')}">
              ${flag} ${escapeHtml(item.region || item.country || "Global")}
            </span>
            <span class="year-badge">${item.year || "Report"}</span>
          </div>
          <span class="doctype-pill">${escapeHtml(item.docType || "Report")}</span>
        </div>

        <h3 class="grey-lit-title">${escapeHtml(item.title)}</h3>

        <div class="grey-lit-topic">
          <span>🎯 <strong>Focus:</strong> ${escapeHtml(item.topic || "Network Planning & Overflows")}</span>
        </div>

        <p class="grey-lit-summary">${escapeHtml(item.summary || "")}</p>

        ${
          hasTakeaways
            ? `
          <div class="grey-lit-takeaways-container" id="takeaways-${item.id}">
            <div class="takeaways-header">
              <span class="takeaways-label">💡 Key Empirical Findings & Takeaways:</span>
            </div>
            <ul class="takeaways-list">
              ${item.keyTakeaways.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
            </ul>
          </div>
        `
            : ""
        }

        <div class="grey-lit-footer">
          <div class="grey-lit-meta">
            ${item.pages ? `<span>📄 ${item.pages} ${item.pages === 1 ? 'page' : 'pages'}</span>` : ""}
            ${item.size ? `<span>💾 ${escapeHtml(item.size)}</span>` : ""}
            <span style="opacity: 0.7;">👤 ${escapeHtml(item.assignedTo || "Contributor")}</span>
          </div>
          <div class="grey-lit-actions">
            ${
              isPdf
                ? `<a href="${escapeHtml(pdfViewerUrl)}" target="_blank" rel="noopener" class="btn-action btn-pdf" title="Open PDF in Viewer with Sticky Notes">
                    📄 Read PDF
                   </a>`
                : ""
            }
            ${
              hasExternal
                ? `<a href="${escapeHtml(item.externalUrl)}" target="_blank" rel="noopener" class="btn-action btn-scholar" title="Visit Agency Source Portal">
                    🔗 Agency Portal
                   </a>`
                : ""
            }
            <button type="button" class="btn-action btn-summary" onclick="openGreyLitSummary('${item.id}')" title="Open Detailed 8-Step Summary">
              📝 ${hasSteps ? "8-Step Summary" : "Summary"}
            </button>
            ${
              hasTakeaways
                ? `<button type="button" class="btn-action btn-scholar" onclick="toggleTakeaways('${item.id}')" title="Toggle Quick Takeaways View">
                    💡 Details
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

function toggleTakeaways(id) {
  const container = document.getElementById(`takeaways-${id}`);
  if (!container) return;
  if (container.style.display === "none") {
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
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
    metaEl.innerText = `${item.organization} (${item.year || 'Report'}) — ${item.region || item.country || 'Global'} — ${item.docType || 'Grey Literature'}`;
  }

  // Handle PDF / external link
  if (pdfLink) {
    const isPdf = item.mediaType === "pdf" && item.pdfUrl && item.pdfUrl !== "#";
    if (isPdf) {
      pdfLink.href = item.pdfUrl.startsWith("./")
        ? `./pdf-viewer.html?paper=${encodeURIComponent(item.id)}&pdf=${encodeURIComponent(item.pdfUrl)}&title=${encodeURIComponent(item.title)}&topic=Grey%20Literature`
        : item.pdfUrl;
      pdfLink.style.display = "inline-flex";
      pdfLink.innerHTML = "📄 Open PDF + Notes";
    } else if (item.externalUrl) {
      pdfLink.href = item.externalUrl;
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
    bodyContent.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
        <div class="loading-spinner" style="margin: 0 auto 16px;"></div>
        <p>Loading full synthesis report from <code>GREY_LITERATURE_FINDINGS.md</code>...</p>
      </div>
    `;

    try {
      const res = await fetch("./contributors/rijoy-john/compiled-papers/GREY_LITERATURE_FINDINGS.md", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      findingsMarkdownCache = await res.text();
    } catch (err) {
      console.error("Could not load findings markdown:", err);
      bodyContent.innerHTML = `
        <div style="padding: 30px; color: #f87171;">
          <h3>Failed to load findings document</h3>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
      return;
    }
  }

  bodyContent.innerHTML = renderMarkdownToHtml(findingsMarkdownCache);
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
        html += "  <thead><tr>\n";
        cells.forEach((c) => {
          html += `    <th>${formatInlineMarkdown(c)}</th>\n`;
        });
        html += "  </tr></thead>\n  <tbody>\n";
      } else {
        html += "  <tr>\n";
        cells.forEach((c) => {
          html += `    <td>${formatInlineMarkdown(c)}</td>\n`;
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
// Tab Switching: Academic vs Grey Literature
// -------------------------------------------------------------
function switchLibraryTab(tabName) {
  const academicSection = document.getElementById("academicSection");
  const greyLitSection = document.getElementById("greyLitSection");
  const tabAcademic = document.getElementById("tabAcademic");
  const tabGreyLit = document.getElementById("tabGreyLit");

  if (!academicSection || !greyLitSection || !tabAcademic || !tabGreyLit) return;

  if (tabName === "grey-literature" || tabName === "grey-lit") {
    academicSection.style.display = "none";
    greyLitSection.style.display = "block";
    tabAcademic.classList.remove("active");
    tabAcademic.setAttribute("aria-selected", "false");
    tabGreyLit.classList.add("active");
    tabGreyLit.setAttribute("aria-selected", "true");
    history.replaceState(null, "", "#grey-literature");
  } else {
    greyLitSection.style.display = "none";
    academicSection.style.display = "block";
    tabGreyLit.classList.remove("active");
    tabGreyLit.setAttribute("aria-selected", "false");
    tabAcademic.classList.add("active");
    tabAcademic.setAttribute("aria-selected", "true");
    history.replaceState(null, "", "#academic");
  }
}

// Check URL Hash on load
window.addEventListener("DOMContentLoaded", () => {
  if (window.location.hash === "#grey-literature" || window.location.hash === "#grey-lit") {
    switchLibraryTab("grey-literature");
  }
});

let papersData = [];
const CONTRIBUTOR_MANIFEST_URL = "./contributors/manifest.json";
let compiledPapersData = [];

function applyPaperMetadata(sharedMetadata = {}) {
  papersData.forEach((paper) => {
    const shared =
      sharedMetadata[String(paper.id)] || sharedMetadata[paper.id] || {};
    if (shared.assignedTo || shared.user) {
      paper.assignedTo = shared.assignedTo || shared.user;
    }
    if (shared.topic) {
      paper.topic = shared.topic;
    }
    if (shared.filterCategory || shared.category) {
      paper.filterCategory = shared.filterCategory || shared.category;
    }
  });
}

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;

function normalizeDoi(value) {
  const match = String(value || "").match(DOI_PATTERN);
  return match ? match[0].toLowerCase().replace(/[.,;:)>]+$/, "") : "";
}

function normalizeIdentityText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPaperSummaryRecord(paper) {
  return (
    sharedSummaryData[String(paper.id)] ||
    sharedSummaryData[paper.id] ||
    {}
  );
}

function getPaperIdentityKey(paper) {
  const summary = getPaperSummaryRecord(paper);
  const doi = normalizeDoi(
    paper.doi ||
      paper.doiUrl ||
      paper.steps?.citation ||
      summary.doi ||
      summary.citation ||
      paper.scholarUrl,
  );
  if (doi) return `doi:${doi}`;

  const title = normalizeIdentityText(paper.title);
  const authors = normalizeIdentityText(paper.authors);
  const yearMatch = String(
    paper.year || paper.authors || summary.citation || "",
  ).match(/\b(?:19|20)\d{2}\b/);
  if (!title || !authors) return "";
  return `title:${title}|author:${authors.split(" ")[0]}|year:${
    yearMatch ? yearMatch[0] : ""
  }`;
}

function findDuplicateResearchPaper(paper, id) {
  const identityKey = getPaperIdentityKey(paper);
  if (!identityKey) return null;
  const existing = papersData.find(
    (candidate) =>
      Number(candidate.id) !== id &&
      getPaperIdentityKey(candidate) === identityKey,
  );
  if (!existing) return null;
  return {
    paper: existing,
    matchType: identityKey.startsWith("doi:")
      ? "DOI"
      : "title, first author, and year",
  };
}

function mergeContributorPapers(records) {
  const papersById = new Map(
    papersData.map((paper) => [Number(paper.id), paper]),
  );
  let added = 0;

  records.forEach((rawPaper) => {
    const id = Number(rawPaper && rawPaper.id);
    if (!Number.isInteger(id) || id < 1) return;

    const existing = papersById.get(id);
    const incomingOwner = String(
      rawPaper.assignedTo || rawPaper.user || "",
    ).trim();

    if (existing) {
      if (
        incomingOwner &&
        existing.assignedTo &&
        incomingOwner !== existing.assignedTo
      ) {
        console.warn(
          `Skipped duplicate paper id ${id} from ${incomingOwner}; paper IDs must be unique.`,
        );
        return;
      }

      Object.assign(existing, rawPaper, { id });
      existing.steps = {
        ...(existing.steps || {}),
        ...(rawPaper.steps || {}),
      };
      return;
    }

    if (!rawPaper.title) {
      console.warn(`Skipped contributor paper ${id}: title is required.`);
      return;
    }

    const duplicate = findDuplicateResearchPaper(rawPaper, id);
    const paperRecord = duplicate
      ? {
          ...rawPaper,
          duplicateOf: {
            id: duplicate.paper.id,
            assignedTo:
              duplicate.paper.assignedTo ||
              duplicate.paper.user ||
              "Unknown contributor",
            matchType: duplicate.matchType,
          },
        }
      : rawPaper;

    if (duplicate) {
      console.warn(
        `Possible duplicate research paper ${id}; it matches paper ${duplicate.paper.id} by ${duplicate.matchType}.`,
      );
    }

    const paper = {
      ...paperRecord,
      id,
      title: paperRecord.title,
      authors: paperRecord.authors || "Authors not provided",
      journal: paperRecord.journal || "Publication details not provided",
      categoryKey: paperRecord.categoryKey || "other",
      categoryLabel:
        paperRecord.categoryLabel || paperRecord.filterCategory || "Other",
      size: paperRecord.size || "",
      pages: paperRecord.pages || "",
      pdfUrl: paperRecord.pdfUrl || "#",
      scholarUrl: paperRecord.scholarUrl || "#",
      steps: paperRecord.steps || {},
    };

    papersData.push(paper);
    papersById.set(id, paper);
    added += 1;
  });

  papersData.sort((a, b) => Number(a.id) - Number(b.id));
  return added;
}

function mergeCompiledPapers(records) {
  const compiledById = new Map(
    compiledPapersData.map((paper) => [String(paper.id), paper]),
  );

  records.forEach((rawPaper) => {
    if (
      !rawPaper ||
      !rawPaper.id ||
      !rawPaper.title ||
      !rawPaper.topic ||
      !rawPaper.pdfUrl
    ) {
      console.warn(
        "Skipped compiled paper: id, title, topic, and pdfUrl are required.",
      );
      return;
    }

    const id = String(rawPaper.id);
    const existing = compiledById.get(id);
    const incomingOwner = String(
      rawPaper.assignedTo || rawPaper.user || "",
    ).trim();

    if (
      existing &&
      incomingOwner &&
      existing.assignedTo &&
      incomingOwner !== existing.assignedTo
    ) {
      console.warn(
        `Skipped duplicate compiled paper id ${id}; compiled paper IDs must be unique.`,
      );
      return;
    }

    if (existing) {
      Object.assign(existing, rawPaper, { id });
      return;
    }

    const compiledPaper = {
      ...rawPaper,
      id,
      assignedTo: rawPaper.assignedTo || rawPaper.user || "Unassigned",
      description: rawPaper.description || "",
    };
    compiledPapersData.push(compiledPaper);
    compiledById.set(id, compiledPaper);
  });
}

function renderTable() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  papersData.forEach((paper) => {
    const tr = document.createElement("tr");
    tr.dataset.user = paper.assignedTo;
    tr.dataset.topic = paper.topic;
    tr.dataset.filterCategory = paper.filterCategory;
    tr.innerHTML = `
              <td class="col-num" style="color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">${String(paper.id).padStart(2, "0")}</td>
              <td class="col-main">
                  <div class="mobile-card-header">
                      <span class="mobile-num">#${String(paper.id).padStart(2, "0")}</span>
                      <div class="mobile-badges">
                          <span class="badge-tag">${paper.categoryLabel}</span>
                      </div>
                  </div>
                  <div class="paper-title">${paper.title}${duplicateIndicatorHtml(paper)}</div>
                  <div class="paper-meta">
                      <span>${paper.authors}</span> &bull; 
                      <span><em>${paper.journal}</em></span>
                  </div>
                  <div class="paper-meta" style="margin-top: 7px">
                      <span class="meta-chip">User: ${escapeHtml(paper.assignedTo)}</span>
                      <span class="meta-chip topic-chip">Topic: ${escapeHtml(paper.topic)}</span>
                      <span class="meta-chip filter-chip">Filter: ${escapeHtml(paper.filterCategory)}</span>
                      ${paper.pages ? `<span class="meta-chip info-chip">📄 ${paper.pages}p</span>` : ""}
                      ${paper.size ? `<span class="meta-chip info-chip">💾 ${escapeHtml(paper.size)}</span>` : ""}
                  </div>
              </td>
              <td class="col-cat"><span class="badge-tag">${paper.categoryLabel}</span></td>
              <td class="col-actions">
                  <div class="action-btns mobile-actions">
                      <button class="btn-action btn-summary" onclick="openSummary(${paper.id})" title="View 8-Step Research Summary">📝 Summary</button>
                      <a class="btn-action btn-pdf" id="paper-pdf-btn-${paper.id}" href="${escapeHtml(getPdfViewerUrl(paper))}" target="_blank" rel="noopener" title="Read paper and annotations">📄 PDF <span class="notes-count-pill" id="paper-badge-${paper.id}" style="display:none;"></span></a>
                      <a class="btn-action btn-scholar" href="${paper.scholarUrl}" target="_blank" rel="noopener" title="Search on Google Scholar">🔍 Scholar</a>
                  </div>
              </td>
          `;
    tbody.appendChild(tr);
  });
}

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPdfViewerUrl(paper) {
  const viewerUrl = new URL("./pdf-viewer.html", window.location.href);
  viewerUrl.searchParams.set("paper", String(paper.id));
  viewerUrl.searchParams.set("pdf", paper.pdfUrl || "");
  if (paper.title) viewerUrl.searchParams.set("title", paper.title);
  if (paper.topic) viewerUrl.searchParams.set("topic", paper.topic);
  const activeUser = typeof getActiveUser === "function" ? getActiveUser() : null;
  if (activeUser) {
    viewerUrl.searchParams.set("user", activeUser);
  } else if (paper.assignedTo) {
    viewerUrl.searchParams.set(
      "user",
      contributorDisplayName(paper.assignedTo),
    );
  }
  return viewerUrl.href;
}

function contributorDisplayName(value) {
  return Array.isArray(value)
    ? value.join(", ")
    : String(value || "Unknown contributor");
}

function duplicateIndicatorHtml(paper) {
  if (!paper.duplicateOf) return "";

  const existingId = paper.duplicateOf.id ?? "?";
  const uploader = contributorDisplayName(
    paper.duplicateOf.assignedTo || paper.duplicateOf.user,
  );
  const matchType = paper.duplicateOf.matchType || "paper metadata";
  const label = `⚠ Possible duplicate · Existing paper #${existingId} · Uploaded by ${uploader}`;
  const title = `Possible duplicate matched by ${matchType}. Existing paper #${existingId} was uploaded by ${uploader}.`;

  return `<span class="duplicate-indicator" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
}

let currentTopic = "all";
let currentFilterCategory = "all";

function papersInSelectedTopic() {
  return currentTopic === "all"
    ? papersData
    : papersData.filter((paper) => paper.topic === currentTopic);
}

function compiledPapersInSelectedTopic() {
  return currentTopic === "all"
    ? compiledPapersData
    : compiledPapersData.filter((paper) => paper.topic === currentTopic);
}

function populateTopicOptions() {
  const topicFilter = document.getElementById("topicFilter");
  const topics = [
    ...new Set(
      [...papersData, ...compiledPapersData]
        .map((paper) => paper.topic)
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

  topicFilter.innerHTML =
    '<option value="all">Topic: All</option>' +
    topics
      .map(
        (topic) =>
          `<option value="${escapeHtml(topic)}">Topic: ${escapeHtml(topic)}</option>`,
      )
      .join("");
  currentTopic = topics.includes(currentTopic) ? currentTopic : "all";
  topicFilter.value = currentTopic;
}

function isTeamPaper(paper) {
  if (!paper) return false;
  if (paper.isTeam) return true;
  const assigned = Array.isArray(paper.assignedTo)
    ? paper.assignedTo
    : String(paper.assignedTo || "")
        .split(",")
        .map((s) => s.trim().toLowerCase());
  return assigned.includes("team") || assigned.includes("all");
}

function getPaperContributors(paper) {
  if (!paper || !paper.assignedTo) return [];
  if (Array.isArray(paper.assignedTo)) {
    return paper.assignedTo.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(paper.assignedTo)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function paperMatchesUser(paper, user) {
  if (!user || user === "all") return true;
  return getPaperContributors(paper).includes(user);
}

function formatAuthors(paper) {
  if (isTeamPaper(paper)) return "Team";
  const contributors = getPaperContributors(paper);
  return contributors.length ? contributors.join(", ") : "Unassigned";
}

function populateUserOptions() {
  const userFilter = document.getElementById("userFilter");
  const selectedUser = userFilter.value || "all";
  const allUsers = new Set();

  [
    ...papersInSelectedTopic(),
    ...compiledPapersInSelectedTopic(),
  ].forEach((paper) => {
    if (isTeamPaper(paper)) return;
    getPaperContributors(paper).forEach((u) => {
      if (u.toLowerCase() !== "team" && u.toLowerCase() !== "all") {
        allUsers.add(u);
      }
    });
  });

  const users = [...allUsers].sort((a, b) => a.localeCompare(b));
  userFilter.innerHTML =
    '<option value="all">User: All</option>' +
    users
      .map(
        (user) =>
          `<option value="${escapeHtml(user)}">User: ${escapeHtml(user)}</option>`,
      )
      .join("");
  userFilter.value = users.includes(selectedUser) ? selectedUser : "all";
}

function renderCompiledPaperCard(paper) {
  const isTeam = isTeamPaper(paper);
  const authors = formatAuthors(paper);
  const teamBadge = isTeam
    ? '<span class="badge-tag" style="background: rgba(37, 99, 235, 0.15); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.3); font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600;">👥 Team Compiled</span>'
    : "";

  return `
    <article class="compiled-paper-card"${isTeam ? ' style="border-left: 3px solid #3b82f6;"' : ""}>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <h3 style="margin-bottom: 4px;">${escapeHtml(paper.title)}</h3>
        ${teamBadge}
      </div>
      <div class="compiled-paper-meta">
        ${escapeHtml(authors)} · ${escapeHtml(paper.topic)}${
          paper.filterCategory
            ? ` · ${escapeHtml(paper.filterCategory)}`
            : ""
        }${paper.pages ? ` · 📄 ${paper.pages}p` : ""}${
          paper.size ? ` · 💾 ${escapeHtml(paper.size)}` : ""
        }
      </div>
      <p class="compiled-paper-description">${escapeHtml(
        paper.description || "Compiled paper for this topic.",
      )}</p>
      <a class="btn-action btn-pdf" href="${escapeHtml(
        getPdfViewerUrl(paper),
      )}" target="_blank" rel="noopener">📄 PDF</a>
    </article>
  `;
}

function renderCompiledPapers() {
  const panel = document.getElementById("compiledPapersPanel");
  const list = document.getElementById("compiledPapersList");
  const title = document.getElementById("compiledPapersTitle");
  const count = document.getElementById("compiledPapersCount");
  const query = document
    .getElementById("searchInput")
    .value.toLowerCase();
  const selectedUser = document.getElementById("userFilter").value;

  // Filter papers by current topic and query:
  const topicMatches = compiledPapersData.filter((paper) => {
    const matchesTopic =
      currentTopic === "all" || paper.topic === currentTopic;
    if (!matchesTopic) return false;

    const authors = getPaperContributors(paper).join(" ");
    const searchableText = [
      paper.title,
      paper.topic,
      authors,
      paper.description,
      isTeamPaper(paper) ? "team all" : "",
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

  let teamPapers = [];
  let individualPapers = [];

  if (selectedUser === "all") {
    // "All users": top shelf has team papers, bottom shelf has individual papers
    teamPapers = topicMatches.filter(isTeamPaper);
    individualPapers = topicMatches.filter((p) => !isTeamPaper(p));
  } else {
    // Filtering a particular user: REMOVE the team paper!
    // Only show compiled papers where this teammate is assigned (supports 1, 2, or 3 co-authors)
    teamPapers = [];
    individualPapers = topicMatches.filter(
      (p) => !isTeamPaper(p) && paperMatchesUser(p, selectedUser),
    );
  }

  const totalCount = teamPapers.length + individualPapers.length;
  if (!totalCount) {
    panel.hidden = true;
    list.innerHTML = "";
    return;
  }

  const topicLabel = currentTopic === "all" ? "All topics" : currentTopic;
  const userLabel = selectedUser === "all" ? "" : ` by ${selectedUser}`;
  panel.hidden = false;
  title.textContent = `${topicLabel}${userLabel} compiled papers`;
  count.textContent = `${totalCount} available`;

  if (selectedUser === "all") {
    let html = "";
    if (teamPapers.length) {
      html += `
        <div class="compiled-shelf">
          <div class="compiled-shelf-label">👥 Team Compiled Paper</div>
          <div class="compiled-papers-grid">
            ${teamPapers.map(renderCompiledPaperCard).join("")}
          </div>
        </div>
      `;
    }
    if (individualPapers.length) {
      html += `
        <div class="compiled-shelf">
          <div class="compiled-shelf-label">📄 Contributor Compiled Papers</div>
          <div class="compiled-papers-grid">
            ${individualPapers.map(renderCompiledPaperCard).join("")}
          </div>
        </div>
      `;
    }
    list.innerHTML = html;
  } else {
    // Particular user filtered: simple grid of their papers
    list.innerHTML = `
      <div class="compiled-papers-grid">
        ${individualPapers.map(renderCompiledPaperCard).join("")}
      </div>
    `;
  }
  updateCompiledSqueezeState();
}

let isCompiledSqueezed = false;

function toggleCompiledSection() {
  isCompiledSqueezed = !isCompiledSqueezed;
  updateCompiledSqueezeState();
}

function updateCompiledSqueezeState() {
  const panel = document.getElementById("compiledPapersPanel");
  const icon = document.getElementById("squeezeIcon");
  const text = document.getElementById("squeezeText");
  if (!panel) return;

  if (isCompiledSqueezed) {
    panel.classList.add("is-squeezed");
    if (icon) icon.textContent = "▼";
    if (text) text.textContent = "Expand";
  } else {
    panel.classList.remove("is-squeezed");
    if (icon) icon.textContent = "▲";
    if (text) text.textContent = "Squeeze";
  }
}

let isFiltersSqueezed = false;

function toggleFilterSection() {
  isFiltersSqueezed = !isFiltersSqueezed;
  updateFilterSqueezeState();
}

function updateFilterSqueezeState() {
  const panel = document.getElementById("filterPanel");
  const icon = document.getElementById("filterSqueezeIcon");
  const text = document.getElementById("filterSqueezeText");
  const button = document.getElementById("toggleFiltersBtn");
  if (!panel) return;

  panel.classList.toggle("is-squeezed", isFiltersSqueezed);
  if (icon) icon.textContent = isFiltersSqueezed ? "▼" : "▲";
  if (text) {
    text.textContent = isFiltersSqueezed
      ? "Expand filters"
      : "Squeeze filters";
  }
  if (button) {
    button.setAttribute("aria-expanded", String(!isFiltersSqueezed));
  }
}

function updateFilterSummary() {
  const summary = document.getElementById("filterPanelSummary");
  const userFilter = document.getElementById("userFilter");
  if (!summary) return;

  const selectedUser = userFilter?.value || "all";
  const topicLabel = currentTopic === "all" ? "All topics" : currentTopic;
  const userLabel = selectedUser === "all" ? "All users" : selectedUser;
  const categoryLabel =
    currentFilterCategory === "all"
      ? "All categories"
      : currentFilterCategory;
  summary.textContent = `${topicLabel} · ${userLabel} · ${categoryLabel}`;
}

function makeFilterButton(label, category) {
  const button = document.createElement("button");
  button.className = `filter-btn${
    currentFilterCategory === category ? " active" : ""
  }`;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => setFilterCategory(category));
  return button;
}

function renderNestedFilters() {
  const group = document.getElementById("nestedFilterGroup");
  const topicPapers = papersInSelectedTopic();
  const categories = [
    ...new Set(topicPapers.map((paper) => paper.filterCategory)),
  ].sort((a, b) => a.localeCompare(b));

  if (!categories.includes(currentFilterCategory)) {
    currentFilterCategory = "all";
  }

  group.innerHTML = "";
  group.appendChild(
    makeFilterButton(
      `All ${currentTopic === "all" ? "papers" : currentTopic} (${topicPapers.length})`,
      "all",
    ),
  );
  categories.forEach((category) => {
    const count = topicPapers.filter(
      (paper) => paper.filterCategory === category,
    ).length;
    group.appendChild(
      makeFilterButton(`${category} (${count})`, category),
    );
  });
}

function refreshNestedFilters() {
  populateTopicOptions();
  populateUserOptions();
  renderNestedFilters();
}

function setTopic(topic) {
  currentTopic = topic;
  currentFilterCategory = "all";
  populateUserOptions();
  renderNestedFilters();
  filterTable();
}

function setFilterCategory(category) {
  currentFilterCategory = category;
  renderNestedFilters();
  filterTable();
}

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

async function loadSharedSummaries() {
  try {
    const response = await fetch("./summaries.json", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const parsed = await response.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("summaries.json must contain an object");
    }

    sharedSummaryData = parsed;
    applyPaperMetadata(parsed);
    refreshNestedFilters();
    renderTable();
    filterTable();
    sharedSummaryLoadState = "loaded";
    document.getElementById("summaryStatus").innerText =
      "Shared summaries loaded from GitHub.";

    if (
      currentSummaryPaperId !== null &&
      document.getElementById("summaryModal").style.display === "flex"
    ) {
      renderSummary();
    }
  } catch (error) {
    sharedSummaryLoadState = "fallback";
    console.warn(
      "Could not load summaries.json; using bundled fallback summaries.",
      error,
    );
    document.getElementById("summaryStatus").innerText =
      "Shared file unavailable; showing bundled fallback.";
  }
}

async function loadContributorPapers() {
  try {
    const manifestResponse = await fetch(CONTRIBUTOR_MANIFEST_URL, {
      cache: "no-store",
    });
    if (!manifestResponse.ok) {
      throw new Error(`HTTP ${manifestResponse.status}`);
    }

    const manifest = await manifestResponse.json();
    if (!manifest || !Array.isArray(manifest.contributors)) {
      throw new Error(
        "contributors/manifest.json must list contributors",
      );
    }

    const contributorRecords = await Promise.all(
      manifest.contributors.map(async (contributor) => {
        try {
          const fileUrl = new URL(
            contributor.file,
            new URL(CONTRIBUTOR_MANIFEST_URL, window.location.href),
          );
          const response = await fetch(fileUrl, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const parsed = await response.json();
          const papers = Array.isArray(parsed)
            ? parsed
            : parsed && Array.isArray(parsed.papers)
              ? parsed.papers
              : [];
          const compiledPapers =
            !Array.isArray(parsed) &&
            parsed &&
            Array.isArray(parsed.compiledPapers)
              ? parsed.compiledPapers
              : [];
          const owner =
            (parsed && parsed.contributor) ||
            contributor.name ||
            "Unassigned";

          return {
            papers: papers.map((paper) => ({
              ...paper,
              assignedTo: paper.assignedTo || paper.user || owner,
            })),
            compiledPapers: compiledPapers.map((paper) => ({
              ...paper,
              assignedTo: paper.assignedTo || paper.user || owner,
            })),
          };
        } catch (error) {
          console.warn(
            `Could not load contributor file for ${contributor.name || "unknown contributor"}.`,
            error,
          );
          return { papers: [], compiledPapers: [] };
        }
      }),
    );

    mergeContributorPapers(
      contributorRecords.flatMap((record) => record.papers),
    );
    mergeCompiledPapers(
      contributorRecords.flatMap((record) => record.compiledPapers),
    );
    if (manifest.teamCompiledPaper) {
      mergeCompiledPapers([
        {
          ...manifest.teamCompiledPaper,
          isTeam: true,
        },
      ]);
    } else {
      try {
        const teamRes = await fetch(
          "./contributors/team_compiled_paper.json",
          { cache: "no-store" },
        );
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (teamData) {
            mergeCompiledPapers([{ ...teamData, isTeam: true }]);
          }
        }
      } catch (e) {}
    }
    applyPaperMetadata(sharedSummaryData);
    refreshNestedFilters();
    renderTable();
    filterTable();
  } catch (error) {
    console.warn(
      "Could not load contributors/manifest.json; using bundled Paper 1 data.",
      error,
    );
  }
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

function filterTable() {
  const query = document
    .getElementById("searchInput")
    .value.toLowerCase();
  const selectedUser = document.getElementById("userFilter").value;
  const rows = document.querySelectorAll("#papersTable tbody tr");

  rows.forEach((row) => {
    const text = row.innerText.toLowerCase();
    const matchesSearch = text.includes(query);
    const matchesUser =
      selectedUser === "all" || row.dataset.user === selectedUser;
    const matchesTopic =
      currentTopic === "all" || row.dataset.topic === currentTopic;
    const matchesFilterCategory =
      currentFilterCategory === "all" ||
      row.dataset.filterCategory === currentFilterCategory;

    if (
      matchesSearch &&
      matchesUser &&
      matchesTopic &&
      matchesFilterCategory
    ) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });

  updateFilterSummary();
  renderCompiledPapers();
}

// Initialize table on load
refreshNestedFilters();
renderTable();
updateFilterSqueezeState();
updateFilterSummary();

// Unique Contributor Palettes
const USER_PALETTES = [
  { id: "teal", bg: "#0d9488", light: "#2dd4bf" },
  { id: "amber", bg: "#d97706", light: "#fbbf24" },
  { id: "indigo", bg: "#4f46e5", light: "#818cf8" },
  { id: "rose", bg: "#e11d48", light: "#fb7185" },
  { id: "emerald", bg: "#059669", light: "#34d399" },
  { id: "purple", bg: "#9333ea", light: "#c084fc" },
  { id: "orange", bg: "#ea580c", light: "#fb923c" },
  { id: "sky", bg: "#0284c7", light: "#38bdf8" },
  { id: "pink", bg: "#db2777", light: "#f472b6" },
  { id: "lime", bg: "#65a30d", light: "#a3e635" },
];

function getPersonPalette(name) {
  const key = String(name || "Unknown User").trim();
  if (key.toLowerCase() === "unknown user" || key.toLowerCase() === "contributor") {
    return { id: "slate", bg: "#475569", light: "#94a3b8" };
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return USER_PALETTES[Math.abs(hash) % USER_PALETTES.length];
}

// Method 1: Device Detection
function detectDevice() {
  let id = localStorage.getItem("capstone_device_id");
  if (!id) {
    id = "dev_" + (window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10));
    localStorage.setItem("capstone_device_id", id);
  }

  const ua = navigator.userAgent || "";
  let platform = "Device";
  if (/Macintosh|Mac OS X/i.test(ua)) platform = "MacBook / Mac";
  else if (/Windows/i.test(ua)) platform = "Windows PC";
  else if (/iPhone/i.test(ua)) platform = "iPhone";
  else if (/iPad/i.test(ua)) platform = "iPad";
  else if (/Android/i.test(ua)) platform = "Android";
  else if (/Linux/i.test(ua)) platform = "Linux PC";

  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  const label = `${platform} (${browser})`;
  localStorage.setItem("capstone_device_label", label);
  return { id, label };
}

const currentDevice = detectDevice();

function getActiveUser() {
  return (
    localStorage.getItem("capstone_user_name") ||
    localStorage.getItem("pdf_active_user") ||
    "Unknown User"
  );
}

function setActiveUser(name) {
  const clean = String(name || "").trim() || "Unknown User";
  localStorage.setItem("capstone_user_name", clean);
  localStorage.setItem("pdf_active_user", clean);
  updateProfileHeader();
}

function updateProfileHeader() {
  const user = getActiveUser();
  const palette = getPersonPalette(user);
  const nameEl = document.getElementById("headerProfileName");
  const dotEl = document.getElementById("headerProfileDot");
  if (nameEl) nameEl.textContent = user;
  if (dotEl) dotEl.style.background = palette.light;
}

function selectWelcomeUser(name) {
  setActiveUser(name);
  dismissWelcomeBanner();
}

function dismissWelcomeBanner() {
  const banner = document.getElementById("welcomeBanner");
  if (banner) banner.style.display = "none";
  localStorage.setItem("capstone_welcome_dismissed", "true");
}

function checkWelcomeBanner() {
  const saved = localStorage.getItem("capstone_user_name");
  const dismissed = localStorage.getItem("capstone_welcome_dismissed");
  if (!saved && !dismissed) {
    const banner = document.getElementById("welcomeBanner");
    if (banner) banner.style.display = "flex";
  }
}

function promptSwitchUser() {
  const current = getActiveUser();
  const next = prompt("Enter your contributor name:", current === "Unknown User" ? "" : current);
  if (next && next.trim()) {
    setActiveUser(next.trim());
    if (document.getElementById("profileModal").style.display === "flex") {
      openProfileModal();
    }
  }
}

// Profile Modal
function openProfileModal() {
  const user = getActiveUser();
  const palette = getPersonPalette(user);
  document.getElementById("modalProfileName").textContent = user;
  const devEl = document.getElementById("modalProfileDevice");
  if (devEl) {
    devEl.textContent = `Device: ${currentDevice.label}`;
  }

  const avatar = document.getElementById("modalProfileAvatar");
  if (avatar) {
    avatar.textContent = user.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";
    avatar.style.background = palette.light;
  }

  const allNotes = (annotationsSummary && annotationsSummary.notes) || [];
  const myNotes = allNotes.filter((n) => n.createdBy && n.createdBy.toLowerCase() === user.toLowerCase() && n.status !== "deleted");
  const reviewedPaperIds = [...new Set(myNotes.map((n) => String(n.paperId)))];
  const totalPapers = papersData.length || 23;

  let bodyHtml = `
    <div class="profile-stats-grid">
      <div class="profile-stat-box">
        <div class="profile-stat-number" style="color: ${palette.light}">${reviewedPaperIds.length}</div>
        <div class="profile-stat-label">Papers Reviewed</div>
      </div>
      <div class="profile-stat-box">
        <div class="profile-stat-number" style="color: ${palette.light}">${myNotes.length}</div>
        <div class="profile-stat-label">Notes Written</div>
      </div>
      <div class="profile-stat-box">
        <div class="profile-stat-number" style="color: #94a3b8">${totalPapers}</div>
        <div class="profile-stat-label">Total Corpus Papers</div>
      </div>
    </div>

    <div class="profile-section-title">📄 Papers Reviewed by ${escapeHtml(user)}</div>
    <div class="profile-paper-list">
  `;

  if (!reviewedPaperIds.length) {
    bodyHtml += `<div class="profile-empty-msg">No reviewed papers found for ${escapeHtml(user)} yet. Open any paper to add your notes!</div>`;
  } else {
    reviewedPaperIds.forEach((pid) => {
      const pObj = papersData.find((p) => String(p.id) === String(pid));
      const pTitle = pObj ? pObj.title : `Paper ${pid}`;
      const pNotes = myNotes.filter((n) => String(n.paperId) === String(pid));
      bodyHtml += `
        <div class="profile-paper-item">
          <div class="profile-paper-info">
            <strong>${escapeHtml(pTitle)}</strong>
            <span class="profile-paper-sub">${pNotes.length} note${pNotes.length === 1 ? "" : "s"} added by you</span>
          </div>
          <a class="btn-action btn-pdf" href="./pdf-viewer.html?paper=${encodeURIComponent(pid)}&user=${encodeURIComponent(user)}" target="_blank" rel="noopener">Open Notes</a>
        </div>
      `;
    });
  }
  bodyHtml += `</div>`;

  bodyHtml += `
    <div class="profile-section-title" style="margin-top: 20px;">📌 My Notes & Activity</div>
    <div class="profile-notes-feed">
  `;

  if (!myNotes.length) {
    bodyHtml += `<div class="profile-empty-msg">No sticky notes created yet. Click 📌 Note on any PDF page to create one!</div>`;
  } else {
    const sorted = [...myNotes].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    sorted.forEach((n) => {
      const pObj = papersData.find((p) => String(p.id) === String(n.paperId));
      const pTitle = pObj ? pObj.title : `Paper ${n.paperId}`;
      bodyHtml += `
        <div class="profile-note-card">
          <div class="profile-note-header">
            <span style="font-weight: 700; color: #ffffff;">${escapeHtml(n.title || "Note")}</span>
            <span class="profile-note-tag">P. ${n.page} · ${escapeHtml(pTitle).slice(0, 30)}…</span>
          </div>
          <div class="profile-note-snippet">${escapeHtml(n.text || "")}</div>
          <a class="profile-note-link" href="./pdf-viewer.html?paper=${encodeURIComponent(n.paperId)}&user=${encodeURIComponent(user)}" target="_blank" rel="noopener">Jump to note in PDF →</a>
        </div>
      `;
    });
  }
  bodyHtml += `</div>`;

  document.getElementById("modalProfileBody").innerHTML = bodyHtml;
  document.getElementById("profileModal").style.display = "flex";
}

function closeProfileModal() {
  document.getElementById("profileModal").style.display = "none";
}

function closeProfileModalOnOverlay(e) {
  if (e.target.id === "profileModal") {
    closeProfileModal();
  }
}

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

renderCompiledPapers();
loadSharedSummaries();
loadContributorPapers();
updateProfileHeader();
checkWelcomeBanner();
loadAnnotationsSummary();

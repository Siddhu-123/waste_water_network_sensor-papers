// ==========================================
// Data Layer: State, Normalization & Loaders
// ==========================================

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

// ==========================================
// Contributor Profile, Welcome Banner & Device
// ==========================================

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
  const id = BrowserIdentity.getBrowserId();

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
  try {
    localStorage.setItem("capstone_device_label", label);
  } catch (e) {
    // Storage unavailable: the label is only informational.
  }
  return { id, label };
}

const currentDevice = detectDevice();

function getActiveUser() {
  return BrowserIdentity.getName();
}

function setActiveUser(name) {
  BrowserIdentity.setName(name);
  updateProfileHeader();
  if (typeof syncInstructorVisibility === "function") {
    syncInstructorVisibility();
  }
}

// URL params only seed an identity when this browser has none saved.
function initActiveUserFromUrl() {
  if (BrowserIdentity.seedFromParams(window.location.search)) {
    updateProfileHeader();
  }
}
initActiveUserFromUrl();

function profileViewerUrl(paperId) {
  const url = `./pdf-viewer.html?paper=${encodeURIComponent(paperId)}`;
  return BrowserIdentity.hasName()
    ? `${url}&user=${encodeURIComponent(BrowserIdentity.getName())}`
    : url;
}

function updateProfileHeader() {
  const user = getActiveUser();
  const palette = getPersonPalette(user);
  const nameEl = document.getElementById("headerProfileName");
  const dotEl = document.getElementById("headerProfileDot");
  if (nameEl) nameEl.textContent = user;
  if (dotEl) dotEl.style.background = palette.light;
  if (typeof syncInstructorVisibility === "function") {
    syncInstructorVisibility();
  }
}

function selectWelcomeUser(name) {
  setActiveUser(name);
  dismissWelcomeBanner();
}

function dismissWelcomeBanner() {
  const banner = document.getElementById("welcomeBanner");
  if (banner) banner.style.display = "none";
  try {
    localStorage.setItem("capstone_welcome_dismissed", "true");
  } catch (e) {
    // Storage unavailable: banner stays dismissed for this page view only.
  }
}

function checkWelcomeBanner() {
  let dismissed = null;
  try {
    dismissed = localStorage.getItem("capstone_welcome_dismissed");
  } catch (e) {
    // Storage unavailable: treat as not dismissed.
  }
  if (!BrowserIdentity.hasName() && !dismissed) {
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

// Profile sheet. View state and layout listeners belong to this opening.
let profileReturnFocus = null;
let profileBodyOverflow = "";
let profileLayoutCleanup = null;
function openProfileModal(person) {
  const modal = document.getElementById("profileModal");
  if (modal.style.display !== "flex") {
    profileReturnFocus = document.activeElement;
    profileBodyOverflow = document.body.style.overflow;
  }
  profileLayoutCleanup?.();
  const sheet = modal.querySelector(".profile-sheet");
  const el = id => document.getElementById(id);
  const esc = value => escapeHtml(String(value ?? ""));
  const instructor = typeof isInstructorUser === "function" && isInstructorUser(getActiveUser());
  const contributors = [...new Set([...papersData, ...greyLitData].map(p => p.assignedTo))]
    .filter(name => name && name !== "Team");
  const drilling = instructor && contributors.includes(person);
  const team = instructor && !drilling;
  const user = team ? "Karamjit Kaur" : drilling ? person : getActiveUser();
  sheet.classList.toggle("profile-instructor", instructor);
  const belongs = name => String(name || "").trim().toLowerCase() === user.trim().toLowerCase();
  const library = {
    papers: team ? papersData : papersData.filter(p => belongs(p.assignedTo)),
    grey: team ? greyLitData : greyLitData.filter(p => belongs(p.assignedTo)),
  };
  const records = new Map([...papersData, ...greyLitData].map(p => [String(p.id), p]));
  let summary = typeof annotationsSummary !== "undefined" ? annotationsSummary : null;
  if (!summary) {
    try { summary = JSON.parse(localStorage.getItem("capstone_annotations_cache") || "null"); } catch (_) { /* Storage can be unavailable. */ }
  }
  const teamNotes = (Array.isArray(summary?.notes) ? summary.notes : [])
    .filter(n => n.status !== "deleted" && (instructor || n.createdBy));
  const notes = team ? teamNotes : teamNotes.filter(n => belongs(n.createdBy));
  const counts = new Map();
  notes.forEach(n => counts.set(String(n.paperId), (counts.get(String(n.paperId)) || 0) + 1));
  const count = id => counts.get(String(id)) || 0;
  const category = (kind, p) => window.categoryGroupOf(kind === "papers" ? "academic" : "grey", p);
  const groups = Object.fromEntries(Object.entries(library).map(([kind, list]) => {
    const tally = new Map();
    list.forEach(p => {
      const { group } = category(kind, p);
      if (!tally.has(group.key)) tally.set(group.key, { group, n: 0 });
      tally.get(group.key).n++;
    });
    return [kind, [...tally.values()].sort((a, b) => b.n - a.n)];
  }));
  const state = { tab: "library", kind: "papers", group: null, page: 0, ipage: 0, query: "", paper: null };
  const yearOf = p => p.year || (String(p.authors || "").match(/\((\d{4})\)/) || [])[1] || "";
  const pageOf = n => Math.max(1, Math.floor(Number(n.page) || 1));
  const empty = text => `<div class="profile-empty">${esc(text)}</div>`;
  const narrow = () => window.matchMedia("(max-width: 860px)").matches;
  el("modalProfileName").textContent = user;
  el("modalProfileName").title = user;
  sheet.querySelectorAll(".profile-role, .profile-back, [data-open-instructor]").forEach(node => node.remove());
  if (team) {
    el("modalProfileName").insertAdjacentHTML("afterend", '<div class="profile-role">Instructor</div>');
  } else if (drilling) {
    sheet.querySelector(".profile-who").insertAdjacentHTML("afterbegin", '<button type="button" class="profile-back"><span aria-hidden="true">←</span> Back to team</button>');
  }
  el("profileTabs").hidden = instructor;
  el("profileTeam")?.remove();
  el("profileTabTeam")?.remove();
  el("profileDashboard")?.remove();
  if (instructor) {
    el("modalProfileBody").insertAdjacentHTML("beforeend", '<section id="profileDashboard" class="profile-dashboard" aria-label="Research progress"></section>');
    ["profileRows", "profileIndexList", "profileReader", "profileLibraryPager", "profileIndexPager"].forEach(id => { el(id).innerHTML = ""; });
  }
  el("modalProfileAvatar").textContent = user.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "U";
  el("modalProfileDevice").textContent = `Device: ${currentDevice.label}`;
  el("modalProfileSecurity").textContent = BrowserIdentity.isPersistent()
    ? "Remembered in this browser (not a secure login)."
    : "This choice lasts until reload; browser storage is unavailable (not a secure login).";
  const lead = groups.papers[0]?.group || groups.grey[0]?.group;
  el("profileIdentity").style.removeProperty("--hero-tint");
  el("modalProfileAvatar").style.removeProperty("--avatar-bg");
  if (lead) {
    el("profileIdentity").style.setProperty("--hero-tint", lead.color + "22");
    const second = groups.papers[1]?.group || groups.grey[0]?.group || lead;
    el("modalProfileAvatar").style.setProperty("--avatar-bg", `linear-gradient(135deg, ${lead.color}, ${second.color})`);
  }
  const total = library.papers.length + library.grey.length;
  const annotated = new Set(notes.map(n => String(n.paperId))).size;
  const focus = groups.papers[0]
    ? ` Most of this work is on <b>${esc(groups.papers[0].group.label.toLowerCase())}</b>${groups.grey[0] ? ` and <b>${esc(groups.grey[0].group.label.toLowerCase())}</b>` : ""}.`
    : groups.grey[0] ? ` Most of this work is on <b>${esc(groups.grey[0].group.label.toLowerCase())}</b>.` : "";
  el("profileStory").innerHTML = `Added <b>${library.papers.length} papers</b> and <b>${library.grey.length} reports</b>`
    + (notes.length ? `, and wrote <b>${notes.length} notes</b> across ${annotated} of them.` : ".") + focus;
  if (team) el("profileStory").innerHTML = `The team of <b>${contributors.length}</b> added <b>${library.papers.length} papers</b> and <b>${library.grey.length} reports</b> and wrote <b>${notes.length} notes</b>.`;
  el("profileLibraryCount").textContent = total;
  el("profileNotesCount").textContent = notes.length;
  el("profileRingTotal").textContent = total;
  function ring(kind, radius) {
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return groups[kind].map(({ group, n }) => {
      const length = n / library[kind].length * circumference;
      const segment = `<circle class="seg" role="button" tabindex="0" data-kind="${kind}" data-group="${esc(group.key)}" aria-label="${esc(group.label)}: ${n} ${kind === "papers" ? "papers" : "reports"}" cx="120" cy="120" r="${radius}" stroke="${esc(group.color)}" stroke-width="20" stroke-dasharray="${Math.max(0, length - 6)} ${circumference}" stroke-dashoffset="${-offset}"><title>${esc(group.label)}: ${n}</title></circle>`;
      offset += length;
      return segment;
    }).join("");
  }
  el("profileRingsSvg").innerHTML = `<circle cx="120" cy="120" r="104" fill="none" stroke="rgba(148,163,184,.08)" stroke-width="20"/><circle cx="120" cy="120" r="78" fill="none" stroke="rgba(148,163,184,.08)" stroke-width="20"/>` + ring("papers", 104) + ring("grey", 78);
  el("profileLegend").innerHTML = ["papers", "grey"].map(kind => !library[kind].length ? "" :
    `<div><h3><span>${kind === "papers" ? "Papers · outer ring" : "Reports · inner ring"}</span><span>${library[kind].length}</span></h3>${groups[kind].map(({ group, n }) =>
      `<button type="button" class="profile-legend-row" data-kind="${kind}" data-group="${esc(group.key)}" aria-pressed="false" title="${esc(group.label)}: ${n}"><i style="background:${esc(group.color)}"></i><span>${esc(group.label)}</span><span>${n}</span></button>`).join("")}</div>`).join("");
  el("profileNotes").querySelector("input").value = "";
  el("profileNotes").querySelector("input").placeholder = team ? "Search team notes" : "Search your notes";
  el("profileNotes").querySelector("input").setAttribute("aria-label", team ? "Search team notes" : "Search your notes");

  if (instructor) renderDashboard();
  function renderDashboard() {
    const paperIds = new Set(papersData.map(p => String(p.id)));
    const notedPaperIds = new Set(teamNotes.map(n => String(n.paperId)));
    const stats = name => {
      const ownNotes = name ? teamNotes.filter(n => n.createdBy === name) : teamNotes;
      const ownPapers = name ? papersData.filter(p => p.assignedTo === name) : papersData;
      return {
        papers: ownPapers.length,
        covered: ownPapers.filter(p => notedPaperIds.has(String(p.id))).length,
        reports: name ? greyLitData.filter(p => p.assignedTo === name).length : greyLitData.length,
        notes: ownNotes.length,
        annotated: new Set(ownNotes.filter(n => paperIds.has(String(n.paperId))).map(n => String(n.paperId))).size,
        latest: ownNotes.reduce((last, n) => Math.max(last, Date.parse(n.updatedAt || n.createdAt) || 0), 0),
      };
    };
    const coverage = s => s.papers ? Math.min(100, Math.round(s.covered / s.papers * 100)) : 0;
    const meter = (n, color = "var(--accent)") => `<span class="profile-meter" aria-hidden="true"><i style="width:${Math.min(100, n)}%;background:${esc(color)}"></i></span>`;
    const current = stats(team ? null : user);
    const tiles = [
      ["papers", "Papers", current.papers], ["reports", "Reports", current.reports],
      ["notes", "Notes", current.notes], ["annotated", "Papers annotated", current.annotated],
      ...(team ? [["people", "People", contributors.length]] : []),
    ];
    let html = `<header class="profile-dashboard-head"><h2>${team ? "Team progress" : "Research progress"}</h2><p>${team ? "Select a person to explore their contributions." : "Contributions and note activity"}</p></header><div class="profile-kpis${team ? "" : " profile-kpis-person"}">${tiles.map(([key, label, value]) =>
      `<div class="profile-kpi" data-kpi="${key}" data-value="${value}"><span>${label}</span><strong>${value}${key === "annotated" ? `<small> / ${current.papers}</small>` : ""}</strong>${key === "annotated" ? `<small>${coverage(current)}% of papers have notes</small>${meter(coverage(current))}` : ""}</div>`).join("")}</div>`;
    if (team) {
      const personStats = new Map(contributors.map(name => [name, stats(name)]));
      html += `<div class="profile-table-wrap" tabindex="0" role="region" aria-label="Contributor comparison"><table class="profile-compare"><caption>Contributor comparison</caption><thead><tr>${["Person", "Papers", "Reports", "Notes", "Papers they annotated", "Their papers with notes", "Last note date"].map(label => `<th scope="col">${label}</th>`).join("")}</tr></thead><tbody>${contributors.map(name => {
        const s = personStats.get(name);
        const stamp = s.latest ? new Date(s.latest).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";
        return `<tr data-person="${esc(name)}" tabindex="0" aria-label="View ${esc(name)}'s progress"><th scope="row">${esc(name)}</th>${[["papers", "Papers"], ["reports", "Reports"], ["notes", "Notes"], ["annotated", "Annotated"]].map(([key, label]) => `<td data-col="${key}" data-value="${s[key]}" data-label="${label}">${s[key]}</td>`).join("")}<td data-col="coverage" data-value="${coverage(s)}" data-label="Their papers with notes"><span>${coverage(s)}%</span>${meter(coverage(s))}</td><td data-col="latest" data-label="Last note date"><span class="profile-last-note">Last note </span>${esc(stamp)}<span class="profile-compare-go" aria-hidden="true">›</span></td></tr>`;
      }).join("")}</tbody></table></div>`;
      html += `<div class="profile-table-wrap" tabindex="0" role="region" aria-label="Who covered what"><table class="profile-matrix"><caption>Who covered what</caption><thead><tr><th scope="col">Research group</th>${contributors.map(name => `<th scope="col" title="${esc(name)}" aria-label="${esc(name)}"><span class="profile-person-name">${esc(name)}</span><span class="profile-person-initials" aria-hidden="true">${esc(name.trim().split(/\s+/).map(part => [...part][0]).join(""))}</span></th>`).join("")}<th scope="col">All</th></tr></thead><tbody>${["papers", "grey"].map(kind => groups[kind].map(({ group, n }) => {
        const groupRecords = library[kind].filter(p => category(kind, p).group.key === group.key);
        return `<tr><th scope="row"><span class="profile-group-label"><i style="background:${esc(group.color)}"></i>${esc(group.label)}</span><small>${kind === "papers" ? "Papers" : "Reports"}</small></th>${contributors.map(name => {
          const count = groupRecords.filter(p => p.assignedTo === name).length;
          return `<td data-n="${count}" aria-label="${count}">${count || "·"}</td>`;
        }).join("")}<td>${n}</td></tr>`;
      }).join("")).join("")}</tbody></table></div>`;
    } else {
      html += ["papers", "grey"].map(kind => !groups[kind].length ? "" : `<section class="profile-group-stats"><h3>${kind === "papers" ? "Paper groups" : "Report groups"}</h3>${groups[kind].map(({ group, n }) => `<div class="profile-group-bar"><span class="profile-group-label"><i style="background:${esc(group.color)}"></i>${esc(group.label)}</span><strong>${n}</strong>${meter(n / Math.max(...groups[kind].map(g => g.n)) * 100, group.color)}</div>`).join("")}</section>`).join("");
      const months = new Map();
      notes.forEach(n => {
        const date = new Date(n.createdAt);
        if (Number.isNaN(date.getTime())) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        months.set(key, (months.get(key) || 0) + 1);
      });
      if (months.size) html += `<section class="profile-group-stats"><h3>Notes by month</h3>${[...months].sort(([a], [b]) => a.localeCompare(b)).map(([key, n]) => `<div class="profile-month"><span>${esc(new Date(key + "-01T12:00:00").toLocaleDateString("en-AU", { month: "long", year: "numeric" }))}</span><strong>${n}</strong></div>`).join("")}</section>`;
    }
    el("profileDashboard").innerHTML = html;
  }

  function moveThumb(id) {
    const control = el(id), on = control.querySelector('[aria-selected="true"]');
    if (!on || control.hidden) return;
    const thumb = control.querySelector(".profile-thumb");
    thumb.style.left = on.offsetLeft + "px";
    thumb.style.width = on.offsetWidth + "px";
  }
  function pager(id, page, pages) {
    const control = el(id);
    // Retain the pager's height even on a single page so the page size stays stable.
    control.style.visibility = pages > 1 ? "visible" : "hidden";
    control.innerHTML = `<button type="button" class="profile-arrow" data-page="prev" aria-label="Previous page" ${page === 0 ? "disabled" : ""}>‹</button><div class="profile-dots">${Array.from({ length: pages }, (_, i) => `<button type="button" data-profile-page="${i}" aria-label="Page ${i + 1}" aria-current="${i === page}"></button>`).join("")}</div><button type="button" class="profile-arrow" data-page="next" aria-label="Next page" ${page >= pages - 1 ? "disabled" : ""}>›</button>`;
  }
  function renderLibrary() {
    let list = library[state.kind];
    if (state.group) list = list.filter(p => category(state.kind, p).group.key === state.group);
    list = [...list].sort((a, b) => count(b.id) - count(a.id) || String(yearOf(b)).localeCompare(String(yearOf(a))));
    const rows = el("profileRows");
    const per = narrow() ? Math.max(5, Math.min(8, Math.floor((innerHeight - 230) / (team ? 88 : 72)))) : Math.max(1, Math.floor((rows.clientHeight - 2) / (team ? 84 : 64)));
    if (!narrow()) rows.style.setProperty("--row-h", (rows.clientHeight - 2) / per + "px");
    else rows.style.removeProperty("--row-h");
    const pages = Math.max(1, Math.ceil(list.length / per));
    state.page = Math.max(0, Math.min(state.page, pages - 1));
    const slice = list.slice(state.page * per, (state.page + 1) * per);
    const group = state.group && groups[state.kind].find(g => g.group.key === state.group)?.group;
    el("profileShelfTitle").textContent = group ? group.label : state.kind === "papers" ? "Papers added" : "Reports added";
    el("profileRange").textContent = `${list.length ? state.page * per + 1 : 0}–${state.page * per + slice.length} of ${list.length}`;
    rows.innerHTML = slice.map(p => {
      const { group, sub } = category(state.kind, p);
      const authors = String(p.authors || "");
      const meta = state.kind === "papers"
        ? [authors.replace(/\s*\(\d{4}\).*/, "").split(",").slice(0, 2).join(",").trim() + (authors.split(",").length > 2 ? " et al." : ""), yearOf(p), String(p.journal || "").split(/[,(]/)[0]].filter(Boolean).join(" · ")
        : [p.organization, yearOf(p)].filter(Boolean).join(" · ");
      return `<a class="profile-row" style="--c:${esc(group.color)}" href="${esc(profileViewerUrl(p.id))}" target="_blank" rel="noopener" title="${esc(p.title)}"><i></i><div class="profile-row-main"><div class="profile-row-title" title="${esc(p.title)}">${esc(p.title)}</div><div class="profile-row-meta" title="${esc(meta)}">${esc(meta)}</div>${team ? `<div class="profile-row-who">${esc(p.assignedTo || "Team")}</div>` : ""}</div>${narrow() ? "" : `<span class="profile-row-sub" title="${esc(group.label)} · ${esc(sub.label)}">${esc(sub.label)}</span>`}<span class="profile-row-notes">${count(p.id) ? `<span class="profile-badge" title="${count(p.id)} notes">✎ ${count(p.id)}</span>` : ""}</span><span class="profile-row-go">›</span></a>`;
    }).join("") || empty(`No ${state.kind === "papers" ? "papers" : "reports"} added yet.`);
    pager("profileLibraryPager", state.page, pages);
  }
  function renderNotes() {
    const query = state.query.trim().toLowerCase(), byPaper = new Map();
    notes.forEach(n => {
      const p = records.get(String(n.paperId));
      if (!p || (state.group && category("papers", p).group.key !== state.group)) return;
      if (query && ![n.title, n.text, p.title].some(t => String(t || "").toLowerCase().includes(query))) return;
      const id = String(p.id);
      if (!byPaper.has(id)) byPaper.set(id, { p, notes: [] });
      byPaper.get(id).notes.push(n);
    });
    const items = [...byPaper.values()].sort((a, b) => b.notes.length - a.notes.length);
    const list = el("profileIndexList");
    const per = narrow() ? 6 : Math.max(1, Math.floor(list.clientHeight / 60));
    const pages = Math.max(1, Math.ceil(items.length / per));
    state.ipage = Math.max(0, Math.min(state.ipage, pages - 1));
    const slice = items.slice(state.ipage * per, (state.ipage + 1) * per);
    if (!slice.some(({ p }) => String(p.id) === state.paper)) state.paper = slice[0] ? String(slice[0].p.id) : null;
    list.innerHTML = slice.map(({ p, notes }) => {
      const { group } = category("papers", p);
      return `<button type="button" class="profile-index-item" role="option" aria-selected="${String(p.id) === state.paper}" data-paper-id="${esc(p.id)}" style="--c:${esc(group.color)}" title="${esc(p.title)}"><i></i><span class="profile-t">${esc(p.title)}</span><span class="profile-n">${notes.length}</span></button>`;
    }).join("") || empty("No notes match.");
    pager("profileIndexPager", state.ipage, pages);
    const reader = el("profileReader"), open = byPaper.get(state.paper);
    if (!open) {
      reader.innerHTML = empty(notes.length ? "No notes match your search." : "No notes yet. Open a paper and add a note to see it here.");
      return;
    }
    const { group, sub } = category("papers", open.p);
    reader.style.setProperty("--c", group.color);
    const authors = String(open.p.authors || "").replace(/\s*\(\d{4}\).*/, "");
    reader.innerHTML = `<header class="profile-reader-head"><span class="profile-card-kicker">${esc(group.label)} · ${esc(sub.label)}</span><h2>${esc(open.p.title)}</h2><div class="profile-by"><span title="${esc(authors)}">${esc(authors)}</span><span>${esc(yearOf(open.p))}</span><a class="profile-open-pdf" href="${esc(profileViewerUrl(open.p.id))}" target="_blank" rel="noopener">Open PDF</a></div></header><div class="profile-reader-body">${[...open.notes].sort((a, b) => pageOf(a) - pageOf(b)).map(n => {
      const date = new Date(n.createdAt);
      const stamp = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
      return `<article class="profile-quote"><div class="profile-quote-top"><h4>${esc(n.title && n.title !== "Note" ? n.title : `Page ${pageOf(n)}`)}</h4><a class="profile-page-pill" href="${esc(profileViewerUrl(n.paperId) + '&page=' + pageOf(n))}" target="_blank" rel="noopener">Open p. ${pageOf(n)} ↗</a></div><p>${esc(n.text)}</p>${team ? `<span class="profile-quote-author">${esc(n.createdBy)}</span>` : ""}<time>${esc(stamp)}</time></article>`;
    }).join("")}</div>`;
  }
  function fitIdentity() {
    const rings = el("profileRings");
    rings.style.removeProperty("width");
    rings.style.removeProperty("height");
    rings.style.removeProperty("--profile-ring-number-size");
    rings.querySelector(".profile-small").hidden = false;
    rings.querySelector(".profile-big").style.removeProperty("font-size");
    if (!narrow()) {
      const identity = el("profileIdentity"), style = getComputedStyle(identity);
      const wrap = rings.parentElement;
      const room = identity.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        - identity.querySelector(".profile-who").offsetHeight - identity.querySelector(".profile-identity-foot").offsetHeight
        - el("profileLegend").offsetHeight - 2 * parseFloat(style.rowGap) - parseFloat(getComputedStyle(wrap).rowGap);
      const diameter = Math.max(80, Math.min(rings.offsetWidth, Math.floor(room)));
      rings.style.width = rings.style.height = diameter + "px";
    }
    const label = rings.querySelector(".profile-small"), number = rings.querySelector(".profile-big");
    const ring = rings.getBoundingClientRect();
    const radius = ring.width * 68 / 240 - 3;
    const cx = ring.left + ring.width / 2, cy = ring.top + ring.height / 2;
    const fits = element => {
      const b = element.getBoundingClientRect();
      return [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]]
        .every(([x, y]) => Math.hypot(x - cx, y - cy) <= radius);
    };
    if (!fits(label)) label.hidden = true;
    // Keep the total inside the same hole, including on short desktop windows.
    let size = parseFloat(getComputedStyle(number).fontSize);
    while (!fits(number) && size > 12) {
      rings.style.setProperty("--profile-ring-number-size", --size + "px");
    }
    if (!label.hidden && (!fits(label) || label.getBoundingClientRect().top < number.getBoundingClientRect().bottom + 3)) label.hidden = true;
  }
  function renderAll() {
    if (instructor) {
      el("profileLibrary").hidden = el("profileNotes").hidden = el("profileKinds").hidden = true;
      sheet.querySelector(".profile-work-head").hidden = true;
      fitIdentity();
      return;
    }
    sheet.querySelector(".profile-work-head").hidden = false;
    sheet.querySelectorAll("[data-profile-tab]").forEach(b => {
      const active = b.dataset.profileTab === state.tab;
      b.setAttribute("aria-selected", active);
      b.tabIndex = active ? 0 : -1;
    });
    ["team", "library", "notes"].forEach(tab => {
      const panel = el(tab === "team" ? "profileTeam" : tab === "library" ? "profileLibrary" : "profileNotes");
      if (!panel) return;
      panel.hidden = state.tab !== tab;
      panel.classList.toggle("active", state.tab === tab);
    });
    el("profileKinds").hidden = state.tab !== "library";
    sheet.querySelectorAll("[data-profile-kind]").forEach(b => {
      b.setAttribute("aria-pressed", b.dataset.profileKind === state.kind);
      b.setAttribute("aria-selected", b.dataset.profileKind === state.kind);
    });
    const group = state.group && groups[state.kind].find(g => g.group.key === state.group)?.group;
    const pill = el("profileFilterPill");
    pill.classList.toggle("show", !!group);
    if (group) {
      pill.querySelector("i").style.background = group.color;
      pill.querySelector("span").textContent = group.label;
      pill.querySelector("span").title = group.label;
    }
    el("profileRings").classList.toggle("dim", !!state.group);
    sheet.querySelectorAll(".seg, .profile-legend-row").forEach(b => {
      const active = b.dataset.group === state.group && b.dataset.kind === state.kind;
      b.classList.toggle("on", active);
      b.setAttribute("aria-pressed", active);
    });
    // Establish pager space before measuring the lists on the first opening.
    if (!el("profileLibraryPager").children.length) pager("profileLibraryPager", 0, 1);
    if (!el("profileIndexPager").children.length) pager("profileIndexPager", 0, 1);
    fitIdentity();
    if (state.tab === "library") renderLibrary();
    else if (state.tab === "notes") renderNotes();
    moveThumb("profileTabs");
    moveThumb("profileKinds");
  }
  function selectTab(tab) {
    state.tab = tab;
    if (tab === "notes" && state.kind === "grey") { state.group = null; state.kind = "papers"; }
    renderAll();
  }
  sheet.onclick = event => {
    const b = event.target.closest("button, .seg, tr[data-person]");
    if (!b) return;
    if (b.classList.contains("profile-back")) openProfileModal();
    else if (team && b.matches("tr[data-person]")) openProfileModal(b.dataset.person);
    else if (instructor) return;
    else if (b.dataset.group) {
      if (state.tab === "team") state.tab = "library";
      state.group = state.group === b.dataset.group && state.kind === b.dataset.kind ? null : b.dataset.group;
      state.kind = b.dataset.kind;
      state.page = state.ipage = 0;
      if (state.kind === "grey") state.tab = "library";
      renderAll();
    } else if (b.dataset.profileTab) selectTab(b.dataset.profileTab);
    else if (b.dataset.profileKind) {
      state.kind = b.dataset.profileKind; state.group = null; state.page = 0; renderAll();
    } else if (b.closest("#profileFilterPill")) {
      state.group = null; state.page = state.ipage = 0; renderAll();
    } else if (b.dataset.paperId) {
      state.paper = b.dataset.paperId; renderNotes();
      [...el("profileIndexList").querySelectorAll("[data-paper-id]")].find(item => item.dataset.paperId === state.paper)?.focus({ preventScroll: true });
    } else if (b.dataset.page || b.dataset.profilePage !== undefined) {
      const field = b.closest("#profileIndexPager") ? "ipage" : "page";
      state[field] = b.dataset.profilePage !== undefined ? Number(b.dataset.profilePage) : state[field] + (b.dataset.page === "next" ? 1 : -1);
      state.tab === "library" ? renderLibrary() : renderNotes();
      const control = el(field === "ipage" ? "profileIndexPager" : "profileLibraryPager");
      const nextFocus = control.querySelector(b.dataset.page ? `[data-page="${b.dataset.page}"]` : `[aria-current="true"]`);
      (nextFocus && !nextFocus.disabled ? nextFocus : control.querySelector('[aria-current="true"]'))?.focus({ preventScroll: true });
    }
  };
  el("profileNotes").querySelector("input").oninput = event => { state.query = event.target.value; state.ipage = 0; renderNotes(); };
  el("profileTabs").onkeydown = event => {
    const tabs = [...el("profileTabs").querySelectorAll("[role=tab]:not([hidden])")];
    const index = tabs.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : -1;
    if (next < 0) return;
    event.preventDefault(); selectTab(tabs[next].dataset.profileTab); tabs[next].focus();
  };
  modal.onkeydown = event => {
    if (event.key === "Escape") { event.preventDefault(); closeProfileModal(); }
    if (event.target.matches(".seg, tr[data-person]") && ["Enter", " "].includes(event.key)) { event.preventDefault(); event.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    if (event.key !== "Tab") return;
    const stops = [...modal.querySelectorAll('button:not(:disabled), a[href], input, [tabindex="0"]')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && e.tabIndex >= 0);
    const first = stops[0], last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  renderAll();
  let frame = 0;
  const resize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(renderAll); };
  const observer = new ResizeObserver(resize);
  observer.observe(sheet);
  window.addEventListener("resize", resize);
  const escape = event => { if (event.key === "Escape") { event.preventDefault(); closeProfileModal(); } };
  document.addEventListener("keydown", escape);
  profileLayoutCleanup = () => {
    observer.disconnect(); window.removeEventListener("resize", resize);
    document.removeEventListener("keydown", escape); cancelAnimationFrame(frame);
  };
  sheet.scrollTop = 0;
  sheet.querySelector(".profile-close").focus({ preventScroll: true });
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal.style.display !== "flex") return;
  profileLayoutCleanup?.();
  profileLayoutCleanup = null;
  modal.style.display = "none";
  document.body.style.overflow = profileBodyOverflow;
  if (profileReturnFocus?.isConnected) profileReturnFocus.focus({ preventScroll: true });
}

function closeProfileModalOnOverlay(event) {
  if (event.target.id === "profileModal") closeProfileModal();
}

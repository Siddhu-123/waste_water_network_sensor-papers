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

// Profile sheet. All view state belongs to this opening of the sheet.
let profileReturnFocus = null;
let profileBodyOverflow = "";
function openProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal.style.display !== "flex") {
    profileReturnFocus = document.activeElement;
    profileBodyOverflow = document.body.style.overflow;
  }
  const user = getActiveUser();
  const belongsToUser = (name) => String(name || "").trim().toLowerCase() === user.trim().toLowerCase();
  const esc = escapeHtml;
  const titleOf = (id) => [...papersData, ...greyLitData].find(p => String(p.id) === String(id))?.title || `Paper ${id}`;
  let summary = typeof annotationsSummary !== "undefined" ? annotationsSummary : null;
  if (!summary) {
    try { summary = JSON.parse(localStorage.getItem("capstone_annotations_cache") || "null"); } catch (_) { /* Storage may be unavailable. */ }
  }
  const notes = (Array.isArray(summary?.notes) ? summary.notes : [])
    .filter(n => n.createdBy && belongsToUser(n.createdBy) && n.status !== "deleted")
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  const noteCounts = new Map();
  notes.forEach(n => noteCounts.set(String(n.paperId), (noteCounts.get(String(n.paperId)) || 0) + 1));
  const library = {
    papers: papersData.filter(p => belongsToUser(p.assignedTo)).map(record => ({ record, ...window.categoryGroupOf("academic", record) })),
    grey: greyLitData.filter(p => belongsToUser(p.assignedTo)).map(record => ({ record, ...window.categoryGroupOf("grey", record) })),
  };
  const focus = Object.fromEntries(Object.entries(library).map(([kind, items]) => {
    const groups = new Map();
    items.forEach(({ group }) => {
      if (!groups.has(group.key)) groups.set(group.key, { ...group, count: 0 });
      groups.get(group.key).count++;
    });
    return [kind, [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))];
  }));
  const focusText = [focus.papers.length ? `Papers mostly ${focus.papers[0].label}` : "",
    focus.grey.length ? `reports mostly ${focus.grey[0].label}` : ""].filter(Boolean).join(" · ") || "Your research starts here";
  const nameEl = document.getElementById("modalProfileName");
  nameEl.textContent = user;
  nameEl.title = user;
  const focusEl = document.getElementById("modalProfileFocus");
  focusEl.textContent = focusText;
  focusEl.title = focusText;
  const avatar = document.getElementById("modalProfileAvatar");
  avatar.textContent = user.trim().split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";
  avatar.style.background = getPersonPalette(user).light;
  document.getElementById("modalProfileDevice").textContent = `Device: ${currentDevice.label}`;
  document.getElementById("modalProfileSecurity").textContent = BrowserIdentity.isPersistent()
    ? "Remembered in this browser (not a secure login)."
    : "This choice lasts until reload; browser storage is unavailable (not a secure login).";

  const pageOf = n => Math.max(1, Math.floor(Number(n.page) || 1));
  const noteUrl = n => `${profileViewerUrl(n.paperId)}&page=${pageOf(n)}`;
  const snippet = n => String(n.text || "No note text yet.").replace(/\s+/g, " ").trim();
  const empty = text => `<div class="profile-empty-msg">${esc(text)}</div>`;
  const totalItems = library.papers.length + library.grey.length;
  const annotated = papersData.filter(p => noteCounts.has(String(p.id))).length;
  const body = document.getElementById("modalProfileBody");
  body.innerHTML = `
    <div class="profile-tabs" role="tablist" aria-label="Contributor profile">
      ${["Overview", "Library", "Notes"].map((name, i) => `<button type="button" role="tab" id="profile-tab-${name.toLowerCase()}" data-profile-tab="${name.toLowerCase()}" aria-controls="profile-panel-${name.toLowerCase()}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${name}${i ? ` <span>${i === 1 ? totalItems : notes.length}</span>` : ""}</button>`).join("")}
    </div>
    <section id="profile-panel-overview" class="profile-panel" role="tabpanel" aria-labelledby="profile-tab-overview" tabindex="0">
      <div class="profile-stats-grid">
        ${[["papers", library.papers.length, "Papers"], ["reports", library.grey.length, "Reports"], ["annotated", annotated, "Annotated"], ["notes", notes.length, "Notes"]].map(([key, value, label]) => `<button type="button" class="profile-stat" data-stat="${key}"><span class="profile-stat-value">${value}</span><span class="profile-stat-label">${label}</span></button>`).join("")}
      </div>
      <h3 class="profile-section-title">Research focus</h3>
      ${totalItems ? ["papers", "grey"].filter(kind => library[kind].length).map(kind => `
        <div class="profile-focus-kind" data-focus-kind="${kind}">
          <h4 class="profile-focus-label">${kind === "papers" ? "Papers" : "Reports"}</h4>
          <div class="profile-focus-bar" aria-label="${kind === "papers" ? "Papers" : "Reports"} by research group">${focus[kind].map(g => `<span class="profile-focus-seg" style="width:${g.count / library[kind].length * 100}%;background:${esc(g.color)}" title="${esc(g.label)}: ${g.count}"></span>`).join("")}</div>
          <div class="profile-focus-legend">${focus[kind].map(g => `<div title="${esc(g.label)}: ${g.count}"><i style="background:${esc(g.color)}"></i><span class="profile-truncate">${esc(g.label)}</span><span>${g.count}</span></div>`).join("")}</div>
        </div>`).join("") : empty("Assigned papers and reports will appear here.")}
      <h3 class="profile-section-title">Recent notes</h3>
      <div class="profile-recent-list">${notes.slice(0, 3).map(n => `<a class="profile-recent-note" href="${esc(noteUrl(n))}" target="_blank" rel="noopener"><strong class="profile-truncate" title="${esc(titleOf(n.paperId))}">${esc(titleOf(n.paperId))}</strong><span class="profile-recent-text"><span>Page ${pageOf(n)}</span><span class="profile-truncate" title="${esc(snippet(n))}">${esc(snippet(n))}</span></span></a>`).join("") || empty("No notes yet. Open a paper to add your first thought.")}</div>
    </section>
    <section id="profile-panel-library" class="profile-panel" role="tabpanel" aria-labelledby="profile-tab-library" tabindex="0" hidden>
      <div class="profile-library-toggle" role="group" aria-label="Library kind">
        <button type="button" data-library-kind="papers" aria-pressed="true">Papers ${library.papers.length}</button>
        <button type="button" data-library-kind="grey" aria-pressed="false">Reports ${library.grey.length}</button>
      </div>
      <div class="profile-library-list"></div><div class="profile-library-pagination"></div>
    </section>
    <section id="profile-panel-notes" class="profile-panel" role="tabpanel" aria-labelledby="profile-tab-notes" tabindex="0" hidden>
      <input class="profile-notes-search" type="search" aria-label="Search your notes" placeholder="Search notes and paper titles…">
      <div class="profile-notes-list"></div><div class="profile-notes-pagination"></div>
    </section>`;

  let kind = "papers", libraryPage = 0, notesPage = 0;
  const pager = (page, size, total, label) => `<div class="profile-pager" aria-label="${label} pages"><span aria-live="polite">${total ? page * size + 1 : 0}–${Math.min((page + 1) * size, total)} of ${total}</span><div><button type="button" data-page="prev" aria-label="Previous ${label} page" ${page === 0 ? "disabled" : ""}>Previous</button><button type="button" data-page="next" aria-label="Next ${label} page" ${(page + 1) * size >= total ? "disabled" : ""}>Next</button></div></div>`;
  function renderLibrary() {
    const list = body.querySelector(".profile-library-list");
    const items = [...library[kind]].sort((a, b) => a.group.label.localeCompare(b.group.label) || a.record.title.localeCompare(b.record.title));
    const groups = new Map();
    items.slice(libraryPage * 8, libraryPage * 8 + 8).forEach(item => {
      if (!groups.has(item.group.key)) groups.set(item.group.key, { group: item.group, items: [] });
      groups.get(item.group.key).items.push(item);
    });
    list.innerHTML = [...groups.values()].map(({ group, items }) => `<section class="profile-lib-group"><h3 class="profile-truncate" title="${esc(group.label)}">${esc(group.label)}</h3>${items.map(({ record: r, sub }) => {
      const count = noteCounts.get(String(r.id)) || 0;
      const url = kind === "papers" ? profileViewerUrl(r.id) : r.pdfUrl && r.pdfUrl !== "#"
        ? `${profileViewerUrl(r.id)}&pdf=${encodeURIComponent(r.pdfUrl)}&title=${encodeURIComponent(r.title)}&topic=Grey%20Literature`
        : r.url || r.externalUrl;
      const meta = `${sub.label}${count ? ` · ${count} note${count === 1 ? "" : "s"}` : ""}`;
      return `<div class="profile-lib-row"><div class="profile-row-copy"><strong class="profile-truncate" title="${esc(r.title)}">${esc(r.title)}</strong><span class="profile-truncate profile-row-meta" title="${esc(meta)}">${esc(meta)}</span></div>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="Open ${esc(r.title)}">Open ↗</a>` : `<span class="profile-row-meta">No link yet</span>`}</div>`;
    }).join("")}</section>`).join("") || empty(`No ${kind === "papers" ? "papers" : "reports"} assigned yet.`);
    body.querySelector(".profile-library-pagination").innerHTML = pager(libraryPage, 8, items.length, "library");
  }
  function renderNotes() {
    const query = body.querySelector(".profile-notes-search").value.trim().toLowerCase();
    const groups = new Map();
    notes.filter(n => !query || `${n.title || ""} ${n.text || ""} ${titleOf(n.paperId)}`.toLowerCase().includes(query)).forEach(n => {
      const id = String(n.paperId);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(n);
    });
    // Search exposes all matching paper headings together; the browse view is paged.
    const size = query ? Math.max(6, groups.size) : 6;
    const visible = [...groups.entries()].slice(notesPage * size, (notesPage + 1) * size);
    body.querySelector(".profile-notes-list").classList.toggle("is-searching", Boolean(query));
    body.querySelector(".profile-notes-list").innerHTML = visible.map(([id, groupNotes], i) => {
      const title = titleOf(id);
      const pages = [...new Set(groupNotes.map(pageOf))].sort((a, b) => a - b).join(", ");
      const meta = `${groupNotes.length} note${groupNotes.length === 1 ? "" : "s"} · pages ${pages}`;
      return `<section class="profile-note-group"><button class="profile-note-heading" type="button" aria-expanded="false" aria-controls="profile-note-content-${i}"><span class="profile-row-copy"><strong class="profile-truncate" title="${esc(title)}">${esc(title)}</strong><span class="profile-row-meta profile-truncate" title="${esc(meta)}">${esc(meta)}</span></span><span class="profile-chevron" aria-hidden="true">›</span></button><div id="profile-note-content-${i}" class="profile-note-content" hidden>${groupNotes.map(n => `<article class="profile-note-card"><div class="profile-note-top"><strong class="profile-truncate" title="${esc(n.title || "Note")}">${esc(n.title || "Note")}</strong><a href="${esc(noteUrl(n))}" target="_blank" rel="noopener" aria-label="Open ${esc(n.title || "note")} at page ${pageOf(n)}">Page ${pageOf(n)} ↗</a></div><div class="profile-note-snippet profile-truncate" title="${esc(snippet(n))}">${esc(snippet(n))}</div></article>`).join("")}</div></section>`;
    }).join("") || empty(notes.length ? "No matching notes. Try a different word." : "No notes yet. Open a paper to add your first thought.");
    body.querySelector(".profile-notes-pagination").innerHTML = pager(notesPage, size, groups.size, "notes");
  }
  function selectTab(name) {
    body.querySelectorAll("[role=tab]").forEach(tab => {
      const active = tab.dataset.profileTab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    body.querySelectorAll("[role=tabpanel]").forEach(panel => { panel.hidden = panel.id !== `profile-panel-${name}`; });
    body.querySelector(`[data-profile-tab="${name}"]`).focus({ preventScroll: true });
  }
  body.onclick = event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.profileTab) selectTab(button.dataset.profileTab);
    if (button.dataset.stat) {
      const stat = button.dataset.stat;
      if (stat === "papers" || stat === "reports") {
        kind = stat === "papers" ? "papers" : "grey";
        libraryPage = 0;
        body.querySelectorAll("[data-library-kind]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.libraryKind === kind)));
        renderLibrary();
        selectTab("library");
      } else selectTab("notes");
    }
    if (button.dataset.libraryKind) {
      kind = button.dataset.libraryKind;
      libraryPage = 0;
      body.querySelectorAll("[data-library-kind]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
      renderLibrary();
    }
    if (button.dataset.page) {
      const delta = button.dataset.page === "next" ? 1 : -1;
      const panel = button.closest("[role=tabpanel]");
      if (panel.id === "profile-panel-library") { libraryPage += delta; renderLibrary(); }
      else { notesPage += delta; renderNotes(); }
      panel.scrollTop = 0;
      panel.querySelector(`[data-page="${button.dataset.page}"]`)?.focus({ preventScroll: true });
    }
    if (button.classList.contains("profile-note-heading")) {
      const expanded = button.getAttribute("aria-expanded") !== "true";
      body.querySelectorAll(".profile-note-heading").forEach(header => {
        const active = header === button && expanded;
        header.setAttribute("aria-expanded", String(active));
        document.getElementById(header.getAttribute("aria-controls")).hidden = !active;
      });
    }
  };
  body.querySelector(".profile-notes-search").oninput = () => { notesPage = 0; renderNotes(); };
  body.querySelector("[role=tablist]").onkeydown = event => {
    const tabs = [...body.querySelectorAll("[role=tab]")];
    const index = tabs.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : -1;
    if (next < 0) return;
    event.preventDefault();
    selectTab(tabs[next].dataset.profileTab);
    tabs[next].focus();
  };
  renderLibrary();
  renderNotes();
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  body.querySelector("[role=tab]").focus({ preventScroll: true });
  modal.onkeydown = event => {
    if (event.key === "Escape") { event.preventDefault(); closeProfileModal(); }
    if (event.key !== "Tab") return;
    const stops = [...modal.querySelectorAll('button:not(:disabled), a[href], input, [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = stops[0], last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
}

function closeProfileModal() {
  document.getElementById("profileModal").style.display = "none";
  document.body.style.overflow = profileBodyOverflow;
  if (profileReturnFocus?.isConnected) profileReturnFocus.focus({ preventScroll: true });
}

function closeProfileModalOnOverlay(e) {
  if (e.target.id === "profileModal") closeProfileModal();
}

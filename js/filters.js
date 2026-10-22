// ==========================================
// Filtering: Research Groups & Search
// ==========================================

let currentTopic = "all";
let academicMajor = "all";
let academicSub = "all";

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

// Shared segmented controls for the academic and grey literature taxonomies.
function countedCategoryGroups(section, records) {
  const groups = new Map(window.CATEGORY_GROUPS[section].groups.map((group) =>
    [group.key, { ...group, count: 0, subCounts: new Map() }],
  ));
  records.forEach((record) => {
    const { group, sub } = categoryGroupOf(section, record);
    if (!groups.has(group.key)) {
      groups.set(group.key, { ...group, count: 0, subCounts: new Map() });
    }
    const entry = groups.get(group.key);
    entry.count++;
    const prev = entry.subCounts.get(sub.key);
    entry.subCounts.set(sub.key, { ...sub, count: (prev?.count || 0) + 1 });
  });
  return [...groups.values()];
}

function categorySegment(label, count, kind, key, color, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "category-segment";
  button.dataset[kind] = key;
  button.setAttribute("aria-pressed", "false");
  if (color) {
    const dot = document.createElement("span");
    dot.className = "category-dot";
    dot.style.backgroundColor = color;
    dot.setAttribute("aria-hidden", "true");
    button.appendChild(dot);
  }
  button.append(document.createTextNode(`${label} `));
  const badge = document.createElement("span");
  badge.className = "category-count";
  badge.textContent = count;
  button.appendChild(badge);
  button.addEventListener("click", () => onSelect(key));
  return button;
}

function markCategorySelection(bar, kind, selected) {
  bar.querySelectorAll(`[data-${kind}]`).forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset[kind] === selected));
  });
}

function renderCategoryBar(section, records, onSelect) {
  const bar = document.getElementById(`${section}CategoryBar`);
  const groups = countedCategoryGroups(section, records);
  bar.replaceChildren(categorySegment("All", records.length, "major", "all", null, onSelect));
  const pillars = window.CATEGORY_GROUPS[section].pillars;
  if (pillars) {
    pillars.forEach((pillar) => {
      const block = document.createElement("div");
      block.className = "category-pillar";
      block.setAttribute("role", "group");
      block.setAttribute("aria-label", pillar.label);
      const label = document.createElement("span");
      label.className = "category-pillar-label";
      label.textContent = pillar.label;
      const segments = document.createElement("div");
      segments.className = "category-pillar-segments";
      groups.filter((group) => group.pillar === pillar.key).forEach((group) => {
        segments.appendChild(categorySegment(group.label, group.count, "major", group.key, group.color, onSelect));
      });
      block.append(label, segments);
      bar.appendChild(block);
    });
  }
  groups.filter((group) => !pillars || !group.pillar).forEach((group) => {
    bar.appendChild(categorySegment(group.label, group.count, "major", group.key, group.color, onSelect));
  });
}

function renderCategorySubBar(section, records, major, onSelect) {
  const bar = document.getElementById(`${section}SubBar`);
  const group = countedCategoryGroups(section, records).find((entry) => entry.key === major);
  bar.replaceChildren();
  bar.hidden = !group;
  if (!group) return;
  bar.setAttribute("aria-label", `${group.label} sub-groups`);
  bar.appendChild(categorySegment("All", group.count, "sub", "all", null, onSelect));
  // Keep taxonomy order, with any uncategorised records at the end.
  const subs = [...group.subs, ...[...group.subCounts.values()].filter((sub) =>
    !group.subs.some((defined) => defined.key === sub.key),
  )];
  subs.forEach((sub) => {
    const count = group.subCounts.get(sub.key)?.count || 0;
    bar.appendChild(categorySegment(sub.label, count, "sub", sub.key, null, onSelect));
  });
}

function categorySelectionLabel(section, records, major, sub) {
  const group = countedCategoryGroups(section, records).find((entry) => entry.key === major);
  if (!group) return "All";
  const selectedSub = group.subCounts.get(sub);
  return group.label + (selectedSub ? ` › ${selectedSub.label}` : "");
}

function updateFilterSummary(visibleCount) {
  const summary = document.getElementById("academicResultsSummary");
  if (!summary) return;
  const count = visibleCount ?? papersData.length;
  const selection = academicMajor === "all" ? "All papers" : categorySelectionLabel("academic", papersData, academicMajor, academicSub);
  const user = document.getElementById("userFilter").value;
  const filtered = academicMajor !== "all" || user !== "all" || document.getElementById("searchInput").value.length > 0;
  summary.textContent = `${selection}${user === "all" ? "" : ` · ${user}`} · ${count}${filtered ? ` of ${papersData.length}` : ""}`;
}

function syncAcademicCategorySelection() {
  markCategorySelection(document.getElementById("academicCategoryBar"), "major", academicMajor);
  markCategorySelection(document.getElementById("academicSubBar"), "sub", academicSub);
  const group = window.CATEGORY_GROUPS.academic.groups.find((entry) => entry.key === academicMajor);
  currentTopic = window.CATEGORY_GROUPS.academic.pillars.find((pillar) => pillar.key === group?.pillar)?.topic || "all";
  document.getElementById("topicFilter").value = currentTopic;
}

function setAcademicMajor(major) {
  academicMajor = major;
  academicSub = "all";
  renderCategorySubBar("academic", papersData, major, setAcademicSub);
  syncAcademicCategorySelection();
  filterTable();
}

function setAcademicSub(sub) {
  academicSub = sub;
  syncAcademicCategorySelection();
  filterTable();
}

function refreshNestedFilters() {
  populateTopicOptions();
  // Keep every contributor available when switching between major groups.
  const selectedTopic = currentTopic;
  currentTopic = "all";
  populateUserOptions();
  currentTopic = selectedTopic;
  renderCategoryBar("academic", papersData, setAcademicMajor);
  renderCategorySubBar("academic", papersData, academicMajor, setAcademicSub);
  syncAcademicCategorySelection();
}

function resetAcademicFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("userFilter").value = "all";
  setAcademicMajor("all");
}

function filterTable() {
  const query = document
    .getElementById("searchInput")
    .value.toLowerCase();
  const selectedUser = document.getElementById("userFilter").value;
  const rows = document.querySelectorAll("#papersTable tbody tr");

  const recordsById = new Map(papersData.map((paper) => [String(paper.id), paper]));
  let visibleCount = 0;
  rows.forEach((row) => {
    const text = row.innerText.toLowerCase();
    const matchesSearch = text.includes(query);
    const matchesUser =
      selectedUser === "all" || row.dataset.user === selectedUser;
    const id = row.querySelector('[id^="paper-pdf-btn-"]')?.id.slice("paper-pdf-btn-".length);
    const paper = recordsById.get(id);
    const category = paper && categoryGroupOf("academic", paper);
    const matchesGroup = academicMajor === "all" || category?.group.key === academicMajor;
    const matchesSub = academicSub === "all" || category?.sub.key === academicSub;

    if (matchesSearch && matchesUser && matchesGroup && matchesSub) {
      row.style.display = "";
      visibleCount++;
    } else {
      row.style.display = "none";
    }
  });

  document.getElementById("academicEmptyState").hidden = visibleCount > 0;
  updateFilterSummary(visibleCount);
  renderCompiledPapers();
}

// Initialize table on load
refreshNestedFilters();
renderTable();
updateFilterSummary();

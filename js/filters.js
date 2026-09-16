// ==========================================
// Filtering: Topics, Categories & Search
// ==========================================

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

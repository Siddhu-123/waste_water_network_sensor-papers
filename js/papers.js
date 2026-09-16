// ==========================================
// Papers UI: Table & Compiled Cards
// ==========================================

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

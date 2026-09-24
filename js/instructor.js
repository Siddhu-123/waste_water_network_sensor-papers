// ===============================================================
// Instructor Mode: Contributor Review Progress & Research Supervision
// ===============================================================

let currentInstructorStudent = "all";

const RESEARCH_STUDENTS = [
  { name: "Satya Siddhartha", role: "Graduate Researcher" },
  { name: "Abraham", role: "Graduate Researcher" },
  { name: "Ashis Jose", role: "Graduate Researcher" },
  { name: "Rijoy John", role: "Graduate Researcher" },
  { name: "Wimukthi", role: "Graduate Researcher" }
];

function getStudentAssignedTopics(studentName) {
  const allPapers = typeof papersData !== "undefined" ? papersData : [];
  const assigned = allPapers.filter((p) => {
    const auth = String(p.assignedTo || "").toLowerCase();
    return auth.includes(studentName.toLowerCase());
  });
  const topics = new Set();
  assigned.forEach((p) => {
    if (p.topic) topics.add(p.topic);
  });
  if (topics.size > 0) {
    return Array.from(topics).join(" · ");
  }
  return "Wastewater Network Sensing";
}

function getAllStudentNotes() {
  const liveNotes = [];
  if (typeof annotationsSummary !== "undefined" && annotationsSummary && Array.isArray(annotationsSummary.notes)) {
    annotationsSummary.notes.forEach((n) => {
      if (n.status !== "deleted" && n.text) {
        liveNotes.push({
          student: n.createdBy || "Contributor",
          paperId: Number(n.paperId) || 1,
          page: n.page || 1,
          date: n.createdAt ? n.createdAt.slice(0, 10) : "Recent",
          title: n.title || "Note",
          text: n.text
        });
      }
    });
  }
  return liveNotes;
}

function getStudentStats(studentName) {
  const allPapers = typeof papersData !== "undefined" ? papersData : [];
  const allCompiled = typeof compiledPapersData !== "undefined" ? compiledPapersData : [];
  const allGrey = typeof greyLitData !== "undefined" ? greyLitData : [];
  const allNotes = getAllStudentNotes();

  const isAll = studentName === "all";

  // Papers assigned
  const assignedPapers = isAll
    ? allPapers
    : allPapers.filter((p) => {
        const u = String(p.assignedTo || "").toLowerCase();
        return u.includes(studentName.toLowerCase());
      });

  // Notes written by student
  const studentNotes = isAll
    ? allNotes
    : allNotes.filter((n) => n.student.toLowerCase().includes(studentName.toLowerCase()));

  // Distinct papers with notes
  const reviewedPaperIds = new Set(studentNotes.map((n) => n.paperId));
  const papersReviewedCount = isAll
    ? new Set(allNotes.map((n) => n.paperId)).size
    : assignedPapers.filter((p) => reviewedPaperIds.has(p.id)).length;

  // Compiled papers authored by this researcher
  const compiled = isAll
    ? allCompiled
    : allCompiled.filter((cp) => {
        const auth = Array.isArray(cp.assignedTo) ? cp.assignedTo.join(" ") : String(cp.assignedTo || "");
        return auth.toLowerCase().includes(studentName.toLowerCase());
      });

  // Grey literature items
  const greyCount = isAll
    ? allGrey.length
    : allGrey.filter((g) => String(g.assignedTo || "").toLowerCase().includes(studentName.toLowerCase())).length;

  const totalAssigned = assignedPapers.length || (isAll ? 55 : 1);
  const progressPct = totalAssigned > 0 ? Math.min(100, Math.round((papersReviewedCount / totalAssigned) * 100)) : 0;

  // Latest worked paper (from most recent note)
  let latestWorkedPaper = null;
  if (studentNotes.length > 0) {
    const recentPid = studentNotes[0].paperId;
    latestWorkedPaper = allPapers.find((p) => p.id === recentPid) || assignedPapers[0];
  } else if (assignedPapers.length > 0) {
    latestWorkedPaper = assignedPapers[0];
  }

  // Latest compiled paper
  const latestCompiled = compiled.length > 0 ? compiled[0] : null;

  return {
    studentName,
    assignedCount: assignedPapers.length,
    reviewedCount: papersReviewedCount,
    totalNotesCount: studentNotes.length,
    compiledCount: compiled.length,
    greyCount,
    progressPct,
    notes: studentNotes,
    latestWorkedPaper,
    latestCompiled
  };
}

// -------------------------------------------------------------
// Instructor Dashboard Renderer
// -------------------------------------------------------------
function renderInstructorDashboard() {
  const container = document.getElementById("instructorDashboardContent");
  if (!container) return;

  const isAll = currentInstructorStudent === "all";
  const stats = getStudentStats(currentInstructorStudent);

  let html = `
    <!-- Summary KPI Row -->
    <div class="instructor-kpi-grid">
      <div class="instructor-kpi-card">
        <div class="kpi-icon">📋</div>
        <div class="kpi-content">
          <div class="kpi-value">${stats.assignedCount}</div>
          <div class="kpi-label">${isAll ? "Total Papers in Corpus" : "Assigned Papers"}</div>
        </div>
      </div>

      <div class="instructor-kpi-card">
        <div class="kpi-icon">📝</div>
        <div class="kpi-content">
          <div class="kpi-value" style="color: #2dd4bf;">${stats.reviewedCount} <span style="font-size: 14px; opacity: 0.7;">/ ${stats.assignedCount}</span></div>
          <div class="kpi-label">Papers with Notes</div>
        </div>
      </div>

      <div class="instructor-kpi-card">
        <div class="kpi-icon">📌</div>
        <div class="kpi-content">
          <div class="kpi-value" style="color: #38bdf8;">${stats.totalNotesCount}</div>
          <div class="kpi-label">Total Notes Logged</div>
        </div>
      </div>

      <div class="instructor-kpi-card">
        <div class="kpi-icon">📚</div>
        <div class="kpi-content">
          <div class="kpi-value" style="color: #a5b4fc;">${stats.compiledCount}</div>
          <div class="kpi-label">Compiled Review Papers</div>
        </div>
      </div>

      <div class="instructor-kpi-card">
        <div class="kpi-icon">🏢</div>
        <div class="kpi-content">
          <div class="kpi-value" style="color: #fbbf24;">${stats.greyCount}</div>
          <div class="kpi-label">Grey Literature Reviews</div>
        </div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="instructor-progress-wrap">
      <div class="instructor-progress-header">
        <span><strong>${isAll ? "Overall Review Coverage" : `${currentInstructorStudent}'s Review Coverage`}</strong>: ${stats.reviewedCount} of ${stats.assignedCount} papers annotated</span>
        <span class="instructor-progress-pct">${stats.progressPct}%</span>
      </div>
      <div class="instructor-progress-bar">
        <div class="instructor-progress-fill" style="width: ${stats.progressPct}%;"></div>
      </div>
    </div>
  `;

  if (isAll) {
    // Team Leaderboard Matrix
    html += `
      <div class="instructor-section-title" style="margin-top: 28px;">
        👥 Research Team Overview
      </div>
      <div class="instructor-table-wrap">
        <table class="instructor-table">
          <thead>
            <tr>
              <th>Researcher / Contributor</th>
              <th>Assigned Papers</th>
              <th>Reviewed with Notes</th>
              <th>Total Notes</th>
              <th>Compiled Papers</th>
              <th>Grey Literature</th>
              <th>Review Coverage</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
    `;

    RESEARCH_STUDENTS.forEach((student) => {
      const sStats = getStudentStats(student.name);
      html += `
        <tr>
          <td>
            <div class="student-name-cell">
              <span class="student-avatar-small">${student.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>${escapeHtml(student.name)}</strong>
                <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(getStudentAssignedTopics(student.name))}</div>
              </div>
            </div>
          </td>
          <td><span class="badge-number">${sStats.assignedCount}</span></td>
          <td><strong style="color: #2dd4bf;">${sStats.reviewedCount}</strong> / ${sStats.assignedCount}</td>
          <td><span class="badge-notes">${sStats.totalNotesCount} notes</span></td>
          <td>${sStats.compiledCount}</td>
          <td>${sStats.greyCount}</td>
          <td style="min-width: 140px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="instructor-table-progress-bar">
                <div class="instructor-table-progress-fill" style="width: ${sStats.progressPct}%;"></div>
              </div>
              <span style="font-size: 11px; font-weight: 600; font-family: 'JetBrains Mono', monospace;">${sStats.progressPct}%</span>
            </div>
          </td>
          <td>
            <button type="button" class="btn-action btn-scholar" style="padding: 4px 10px; font-size: 12px;" onclick="setInstructorStudent('${escapeHtml(student.name)}')">
              Inspect →
            </button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  } else {
    // Individual Student View: Spotlight Cards & Activity Feed
    html += `
      <div class="instructor-spotlight-grid" style="margin-top: 24px;">
        <!-- Spotlight: Latest Compiled Paper -->
        <div class="instructor-spotlight-card">
          <div class="spotlight-header">
            <span class="spotlight-badge" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; border: 1px solid rgba(129, 140, 248, 0.3);">
              📚 Compiled Review Paper
            </span>
          </div>
          ${
            stats.latestCompiled
              ? `
            <h4 class="spotlight-title">${escapeHtml(stats.latestCompiled.title)}</h4>
            <p class="spotlight-desc">${escapeHtml(stats.latestCompiled.description || "Synthesis on wastewater network monitoring.")}</p>
            <div class="spotlight-meta">
              ${stats.latestCompiled.pages ? `<span>📄 ${stats.latestCompiled.pages} pages</span>` : ""}
              ${stats.latestCompiled.size ? `<span>💾 ${escapeHtml(stats.latestCompiled.size)}</span>` : ""}
              <span>Topic: ${escapeHtml(stats.latestCompiled.topic || "OSP")}</span>
            </div>
            <div style="margin-top: 14px;">
              <a href="${escapeHtml(stats.latestCompiled.pdfUrl || '#')}" target="_blank" rel="noopener" class="btn-action btn-pdf" style="display: inline-flex;">
                📄 Open Compiled PDF
              </a>
            </div>
          `
              : `<p style="color: var(--text-muted); margin-top: 10px;">No compiled paper assigned yet.</p>`
          }
        </div>

        <!-- Spotlight: Current Worked Paper -->
        <div class="instructor-spotlight-card">
          <div class="spotlight-header">
            <span class="spotlight-badge" style="background: rgba(45, 212, 191, 0.15); color: #2dd4bf; border: 1px solid rgba(45, 212, 191, 0.3);">
              📌 Assigned Research Paper
            </span>
          </div>
          ${
            stats.latestWorkedPaper
              ? `
            <h4 class="spotlight-title">${escapeHtml(stats.latestWorkedPaper.title)}</h4>
            <p class="spotlight-desc">${escapeHtml(stats.latestWorkedPaper.authors || "")} — <em>${escapeHtml(stats.latestWorkedPaper.journal || "")}</em></p>
            <div class="spotlight-meta">
              <span class="meta-chip">Topic: ${escapeHtml(stats.latestWorkedPaper.topic || "Sensors")}</span>
              <span class="meta-chip">Category: ${escapeHtml(stats.latestWorkedPaper.filterCategory || "General")}</span>
              ${stats.latestWorkedPaper.pages ? `<span>📄 ${stats.latestWorkedPaper.pages}p</span>` : ""}
            </div>
            <div style="margin-top: 14px; display: flex; gap: 8px;">
              <a href="${escapeHtml(getPdfViewerUrl(stats.latestWorkedPaper))}" target="_blank" rel="noopener" class="btn-action btn-pdf" style="display: inline-flex;">
                📄 Open PDF + Notes
              </a>
              <button type="button" class="btn-action btn-summary" onclick="openSummary(${stats.latestWorkedPaper.id})">
                📝 Summary
              </button>
            </div>
          `
              : `<p style="color: var(--text-muted); margin-top: 10px;">No research paper assigned.</p>`
          }
        </div>
      </div>
    `;
  }

  // Real Annotations Feed
  html += `
    <div class="instructor-section-title" style="margin-top: 32px;">
      📌 ${isAll ? "Recent Contributor Notes & Annotations" : `Recent Notes by ${escapeHtml(currentInstructorStudent)}`}
    </div>
    <div class="instructor-activity-feed">
  `;

  if (stats.notes.length === 0) {
    html += `
      <div class="instructor-empty-activity">
        <div style="font-size: 28px; margin-bottom: 8px;">📝</div>
        <p>No notes recorded yet. Annotations created in the PDF reader will appear here.</p>
      </div>
    `;
  } else {
    stats.notes.slice(0, 10).forEach((note) => {
      const pObj = (typeof papersData !== "undefined" ? papersData : []).find((p) => p.id === note.paperId);
      const pTitle = pObj ? pObj.title : `Research Paper #${note.paperId}`;
      const pdfUrl = `./pdf-viewer.html?paper=${encodeURIComponent(note.paperId)}&user=${encodeURIComponent(note.student)}`;

      html += `
        <div class="instructor-activity-card">
          <div class="activity-card-header">
            <div class="activity-user-badge">
              <span class="activity-avatar">${note.student.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>${escapeHtml(note.student)}</strong>
                <span class="activity-action-label">added note on</span>
                <span class="activity-paper-tag">Paper #${note.paperId} (Page ${note.page})</span>
              </div>
            </div>
            <span class="activity-date">${escapeHtml(note.date)}</span>
          </div>
          <div class="activity-note-title">📌 ${escapeHtml(note.title)}</div>
          <div class="activity-note-body">"${escapeHtml(note.text)}"</div>
          <div class="activity-card-footer">
            <span class="activity-paper-sub">${escapeHtml(pTitle)}</span>
            <a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener" class="activity-jump-link">
              Jump to Note in PDF Reader →
            </a>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`;
  container.innerHTML = html;
}

function setInstructorStudent(studentName) {
  currentInstructorStudent = studentName;
  updateInstructorPills();
  renderInstructorDashboard();
  if (studentName === "all") {
    history.replaceState(null, "", "#instructor");
  } else {
    history.replaceState(null, "", `#instructor?student=${encodeURIComponent(studentName)}`);
  }
}

function updateInstructorPills() {
  const container = document.getElementById("instructorStudentPills");
  if (!container) return;

  const students = ["all", ...RESEARCH_STUDENTS.map((s) => s.name)];
  let html = "";
  students.forEach((name) => {
    const isSelected = currentInstructorStudent === name;
    const label = name === "all" ? "👥 Entire Team Overview" : name;
    html += `
      <button type="button" class="instructor-pill ${isSelected ? 'active' : ''}" onclick="setInstructorStudent('${escapeHtml(name)}')">
        ${escapeHtml(label)}
      </button>
    `;
  });
  container.innerHTML = html;
}

// -------------------------------------------------------------
// Instructor Permission & Visibility Control
// -------------------------------------------------------------
function isInstructorUser(name) {
  if (!name) return false;
  const clean = String(name).toLowerCase().replace(/[^a-z]/g, "");
  return clean.includes("karmajit") || clean.includes("karamjit");
}

function syncInstructorVisibility() {
  const activeUser = typeof getActiveUser === "function" ? getActiveUser() : "";
  const tabInstructor = document.getElementById("tabInstructor");
  const instructorSection = document.getElementById("instructorSection");
  const isInstructor = isInstructorUser(activeUser);

  if (tabInstructor) {
    tabInstructor.style.display = isInstructor ? "inline-flex" : "none";
  }

  // If instructor section is active but current user is not an instructor, revert to academic
  if (!isInstructor && instructorSection && instructorSection.style.display !== "none") {
    if (typeof switchLibraryTab === "function") {
      switchLibraryTab("academic");
    }
  }
}

// -------------------------------------------------------------
// Auto-Init Instructor Mode on Load
// -------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  updateInstructorPills();
  syncInstructorVisibility();
});

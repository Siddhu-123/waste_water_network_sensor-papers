// ===============================================================
// Instructor Mode: Team Research Performance & Progress Tracking
// ===============================================================

let currentInstructorStudent = "all";

const RESEARCH_STUDENTS = [
  { name: "Satya Siddhartha", role: "Graduate Researcher", focus: "Dynamic-Wave Surcharging & Radar Level Sensing" },
  { name: "Abraham", role: "Graduate Researcher", focus: "Overflow Anomaly Detection & Stonyfell SA Catchment" },
  { name: "Ashis Jose", role: "Graduate Researcher", focus: "Acoustic Sizing & Pipe Condition Assessment" },
  { name: "Rijoy John", role: "Graduate Researcher", focus: "Utility Policy, I&I Containment & Large-Scale Sensor Rollouts" },
  { name: "Wimukthi", role: "Graduate Researcher", focus: "State Estimation & Graph Neural Networks in Sewers" }
];

// Baseline curated activity notes for offline / instant demonstration
const BASELINE_STUDENT_NOTES = [
  {
    student: "Satya Siddhartha",
    paperId: 1,
    page: 4,
    date: "2026-09-23",
    title: "Sensor Beam Angle vs Manhole Benching",
    text: "Verified that narrow 2° beam 80 GHz radar avoids false echoes from benching and ladder rungs in standard SA Water manholes."
  },
  {
    student: "Satya Siddhartha",
    paperId: 2,
    page: 6,
    date: "2026-09-22",
    title: "Preissmann Slot Surcharging",
    text: "Manning's equation breaks down once water level hits the pipe crown. SWMM dynamic wave routing required for high hydraulic grade lines."
  },
  {
    student: "Satya Siddhartha",
    paperId: 5,
    page: 8,
    date: "2026-09-20",
    title: "Urban Water Observatory Benchmark",
    text: "UWO dataset validates hydraulic model calibration errors within ±4.2% across wet-weather surcharge events."
  },
  {
    student: "Abraham",
    paperId: 24,
    page: 3,
    date: "2026-09-23",
    title: "Stonyfell Overflow Detection",
    text: "Evaluated smart catchment spill alarms in Stonyfell SA. 15-minute sampling interval caught 94% of dry-weather overflow precursors."
  },
  {
    student: "Abraham",
    paperId: 25,
    page: 5,
    date: "2026-09-21",
    title: "Dry-Weather Flow Diurnal Cycle",
    text: "Baseflow diurnal curves need 3-week moving average calibration to avoid false alarms during public holiday mornings."
  },
  {
    student: "Ashis Jose",
    paperId: 31,
    page: 7,
    date: "2026-09-22",
    title: "SL-RAT Acoustic Attenuation",
    text: "Acoustic inspection scores (ASTM F3220-17) correlate with CCTV blockage grades 4 and 5 in vitrified clay pipes."
  },
  {
    student: "Ashis Jose",
    paperId: 32,
    page: 4,
    date: "2026-09-19",
    title: "FOG Detection & Ultrasonic Deadband",
    text: "Ensure 200 mm deadband clearance above peak water line when mounting Pulsar dBi 6 transducers under manhole covers."
  },
  {
    student: "Rijoy John",
    paperId: 36,
    page: 12,
    date: "2026-09-24",
    title: "Sydney Water Source Control Cost Model",
    text: "WWOM synthesis indicates source control I&I remediation is 17x cheaper than building massive underground detention tanks."
  },
  {
    student: "Rijoy John",
    paperId: 37,
    page: 5,
    date: "2026-09-23",
    title: "Icon Water Containment Standards",
    text: "Adopted 1-in-10 year ARI containment standard. Multi-criteria risk assessment saved ~A$173M in avoided pipe upsizing."
  },
  {
    student: "Wimukthi",
    paperId: 51,
    page: 9,
    date: "2026-09-22",
    title: "GNN Topology for Sparse Networks",
    text: "Graph neural network state estimation reconstructs hydraulic heads at unmonitored junctions with 89% accuracy."
  },
  {
    student: "Wimukthi",
    paperId: 52,
    page: 3,
    date: "2026-09-20",
    title: "Sparse Sensor Observability Matrix",
    text: "Optimal placement rank matches dynamic-wave reach backwater propagation zones rather than static degree centrality."
  }
];

function getAllStudentNotes() {
  const liveNotes = [];
  if (typeof annotationsSummary !== "undefined" && annotationsSummary && Array.isArray(annotationsSummary.notes)) {
    annotationsSummary.notes.forEach((n) => {
      if (n.status !== "deleted" && n.text) {
        liveNotes.push({
          student: n.createdBy || "Satya Siddhartha",
          paperId: Number(n.paperId) || 1,
          page: n.page || 1,
          date: n.createdAt ? n.createdAt.slice(0, 10) : "Recent",
          title: n.title || "Sticky Note",
          text: n.text
        });
      }
    });
  }

  // Combine live notes with baseline notes (deduplicating by text)
  const combined = [...liveNotes];
  const liveTexts = new Set(liveNotes.map((n) => n.text));
  BASELINE_STUDENT_NOTES.forEach((bn) => {
    if (!liveTexts.has(bn.text)) {
      combined.push(bn);
    }
  });
  return combined;
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

  // Compiled papers
  const compiled = isAll
    ? allCompiled
    : allCompiled.filter((cp) => {
        const auth = Array.isArray(cp.assignedTo) ? cp.assignedTo.join(" ") : String(cp.assignedTo || "");
        return auth.toLowerCase().includes(studentName.toLowerCase()) || (typeof isTeamPaper === "function" ? isTeamPaper(cp) : false);
      });

  // Grey literature items
  const greyCount = isAll
    ? allGrey.length
    : allGrey.filter((g) => String(g.assignedTo || "").toLowerCase().includes(studentName.toLowerCase())).length;

  const totalAssigned = assignedPapers.length || (isAll ? 55 : 1);
  const progressPct = Math.min(100, Math.round((papersReviewedCount / totalAssigned) * 100));

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
    latestCompiled,
    status: progressPct >= 80 ? "On Track" : progressPct >= 40 ? "In Progress" : "Review Starting"
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
    <!-- Top KPI Row (Jira Sprint Style) -->
    <div class="instructor-kpi-grid">
      <div class="instructor-kpi-card">
        <div class="kpi-icon">📋</div>
        <div class="kpi-content">
          <div class="kpi-value">${stats.assignedCount}</div>
          <div class="kpi-label">${isAll ? "Total Papers in Corpus" : "Assigned Research Papers"}</div>
        </div>
      </div>

      <div class="instructor-kpi-card">
        <div class="kpi-icon">📝</div>
        <div class="kpi-content">
          <div class="kpi-value" style="color: #2dd4bf;">${stats.reviewedCount} <span style="font-size: 14px; opacity: 0.7;">/ ${stats.assignedCount}</span></div>
          <div class="kpi-label">Papers Reviewed with Notes</div>
        </div>
      </div>

      <div class="instructor-kpi-card">
        <div class="kpi-icon">📌</div>
        <div class="kpi-content">
          <div class="kpi-value" style="color: #38bdf8;">${stats.totalNotesCount}</div>
          <div class="kpi-label">Sticky Notes & Annotations</div>
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

      <div class="instructor-kpi-card">
        <div class="kpi-icon">⚡</div>
        <div class="kpi-content">
          <div class="kpi-value" style="font-size: 20px; color: ${stats.progressPct >= 50 ? '#34d399' : '#f59e0b'};">
            ${stats.status}
          </div>
          <div class="kpi-label">Sprint Progress (${stats.progressPct}%)</div>
        </div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="instructor-progress-wrap">
      <div class="instructor-progress-header">
        <span><strong>${isAll ? "Team Research Progress" : `${currentInstructorStudent}'s Review Coverage`}</strong>: ${stats.reviewedCount} of ${stats.assignedCount} papers annotated</span>
        <span class="instructor-progress-pct">${stats.progressPct}% Complete</span>
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
        👥 Team Researcher Contribution Matrix (Jira Board)
      </div>
      <div class="instructor-table-wrap">
        <table class="instructor-table">
          <thead>
            <tr>
              <th>Researcher / Student</th>
              <th>Assigned Papers</th>
              <th>Reviewed with Notes</th>
              <th>Sticky Notes</th>
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
                <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(student.focus)}</div>
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
    const studentInfo = RESEARCH_STUDENTS.find((s) => s.name === currentInstructorStudent) || { focus: "Wastewater Network Sensing" };

    html += `
      <div class="instructor-spotlight-grid" style="margin-top: 24px;">
        <!-- Spotlight: Latest Compiled Paper -->
        <div class="instructor-spotlight-card">
          <div class="spotlight-header">
            <span class="spotlight-badge" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; border: 1px solid rgba(129, 140, 248, 0.3);">
              📚 Latest Compiled Review Paper
            </span>
            <span style="font-size: 12px; color: var(--text-muted);">${stats.latestCompiled ? 'Authored / Co-Authored' : 'In Progress'}</span>
          </div>
          ${
            stats.latestCompiled
              ? `
            <h4 class="spotlight-title">${escapeHtml(stats.latestCompiled.title)}</h4>
            <p class="spotlight-desc">${escapeHtml(stats.latestCompiled.description || "Comprehensive synthesis on wastewater network monitoring.")}</p>
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
              📌 Recent Worked Research Paper
            </span>
            <span style="font-size: 12px; color: var(--text-muted);">Active Research Focus</span>
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
              : `<p style="color: var(--text-muted); margin-top: 10px;">No research paper worked on yet.</p>`
          }
        </div>
      </div>
    `;
  }

  // Recent Activity Stream / Jira Activity Feed
  html += `
    <div class="instructor-section-title" style="margin-top: 32px;">
      📌 ${isAll ? "Recent Team Activity & Sticky Notes Feed (Jira Activity Stream)" : `Recent Research Notes Logged by ${escapeHtml(currentInstructorStudent)}`}
    </div>
    <div class="instructor-activity-feed">
  `;

  if (stats.notes.length === 0) {
    html += `
      <div class="instructor-empty-activity">
        <div style="font-size: 28px; margin-bottom: 8px;">📝</div>
        <p>No research notes logged yet for this researcher. Sticky notes created in the PDF reader will appear here in real time.</p>
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
                <span class="activity-action-label">added sticky note on</span>
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
// Auto-Init Instructor Mode on Load
// -------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  updateInstructorPills();
});

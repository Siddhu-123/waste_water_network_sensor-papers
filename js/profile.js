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

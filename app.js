const storageKey = "werkstattcheck-submissions-v1";
const sessionKey = "werkstattcheck-session-v1";
const users = [
  { username: "chef", password: "chef123", role: "boss", label: "Chef" },
  { username: "mitarbeiter", password: "mitarbeiter123", role: "employee", label: "Mitarbeiter" }
];

const defaultItems = [
  "Arbeitsbereich sauber und sicher hinterlassen",
  "Ausgeführte Arbeiten geprüft",
  "Material und Teile dokumentiert",
  "Kunde über Ergebnis informiert",
  "Mängel oder Folgearbeiten notiert",
  "Pool",
  "Bäume geschnitten"
];

let submissions = loadSubmissions();
let currentRole = null;
let activeChecklistId = null;
let uploadedPhotos = [];
let currentSession = loadSession();

const el = {
  authScreen: document.getElementById("authScreen"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  logoutButton: document.getElementById("logoutButton"),
  sessionUser: document.getElementById("sessionUser"),
  employeeView: document.getElementById("employeeView"),
  bossView: document.getElementById("bossView"),
  roleEyebrow: document.getElementById("roleEyebrow"),
  pageTitle: document.getElementById("pageTitle"),
  emailStatus: document.getElementById("emailStatus"),
  checklistForm: document.getElementById("checklistForm"),
  checklistItems: document.getElementById("checklistItems"),
  itemTemplate: document.getElementById("itemTemplate"),
  addItemButton: document.getElementById("addItemButton"),
  photoInput: document.getElementById("photoInput"),
  photoPreview: document.getElementById("photoPreview"),
  employeeList: document.getElementById("employeeList"),
  bossList: document.getElementById("bossList"),
  reviewPanel: document.getElementById("reviewPanel"),
  statusFilter: document.getElementById("statusFilter"),
  saveDraftButton: document.getElementById("saveDraftButton"),
  newChecklistButton: document.getElementById("newChecklistButton"),
  statDrafts: document.getElementById("statDrafts"),
  statSubmitted: document.getElementById("statSubmitted"),
  statApproved: document.getElementById("statApproved"),
  customerName: document.getElementById("customerName"),
  customerEmail: document.getElementById("customerEmail"),
  jobTitle: document.getElementById("jobTitle"),
  employeeName: document.getElementById("employeeName"),
  employeeComment: document.getElementById("employeeComment")
};

function loadSession() {
  const stored = localStorage.getItem(sessionKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function persistSession(session) {
  if (session) {
    localStorage.setItem(sessionKey, JSON.stringify(session));
  } else {
    localStorage.removeItem(sessionKey);
  }
}

function loadSubmissions() {
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return [
      {
        id: crypto.randomUUID(),
        customerName: "Musterkunde GmbH",
        customerEmail: "kunde@example.de",
        jobTitle: "Wartung der Heizungsanlage",
        employeeName: "Max Berger",
        employeeComment: "Filter gewechselt, Anlage läuft normal. Ein Ventil sollte beim nächsten Termin geprüft werden.",
        bossComment: "",
        status: "submitted",
        createdAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        approvedAt: "",
        emailSentAt: "",
        photos: [],
        items: defaultItems.map((text, index) => ({ text, checked: index !== 4 }))
      }
    ];
  }

  try {
    const parsed = JSON.parse(stored);
    return parsed.map((entry) => ({
      ...entry,
      items: (entry.items || []).map((item) => ({
        checked: Boolean(item.checked),
        text: item.text || "Unbenannter Prüfpunkt",
        comment: item.comment || ""
      }))
    }));
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(submissions));
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getStatusLabel(status) {
  const labels = {
    draft: "Entwurf",
    submitted: "Zur Prüfung",
    approved: "Freigegeben"
  };
  return labels[status] ?? status;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3300);
}

function setRole(role) {
  currentRole = role;
  el.employeeView.classList.toggle("active", role === "employee");
  el.bossView.classList.toggle("active", role === "boss");
  el.roleEyebrow.textContent = role === "employee" ? "Mitarbeiterbereich" : "Chefbereich";
  el.pageTitle.textContent = role === "employee" ? "Checkliste ausfüllen" : "Checklisten prüfen und freigeben";
  render();
}

function login(username, password) {
  const user = users.find((item) => item.username === username.toLowerCase() && item.password === password);
  if (!user) {
    showToast("Login fehlgeschlagen. Bitte Zugangsdaten prüfen.");
    return;
  }

  currentSession = { username: user.username, role: user.role, label: user.label };
  persistSession(currentSession);
  el.sessionUser.textContent = `${user.label} (${user.username})`;
  el.authScreen.classList.add("hidden");
  el.appShell.classList.remove("hidden");
  setRole(user.role);
  showToast(`Willkommen, ${user.label}.`);
}

function logout() {
  currentSession = null;
  persistSession(null);
  currentRole = null;
  el.appShell.classList.add("hidden");
  el.authScreen.classList.remove("hidden");
  el.loginForm.reset();
  showToast("Du wurdest abgemeldet.");
}

function addChecklistItem(text = "", checked = false, comment = "") {
  const node = el.itemTemplate.content.firstElementChild.cloneNode(true);
  const checkbox = node.querySelector("input");
  const label = node.querySelector("span");
  const commentField = node.querySelector(".item-comment-input");
  checkbox.checked = checked;
  label.textContent = text || "Neuer Prüfpunkt";
  commentField.value = comment;
  node.querySelector(".remove-item").addEventListener("click", () => {
    if (el.checklistItems.children.length === 1) {
      showToast("Mindestens ein Prüfpunkt muss bleiben.");
      return;
    }
    node.remove();
  });
  el.checklistItems.appendChild(node);
}

function resetForm() {
  activeChecklistId = null;
  uploadedPhotos = [];
  el.checklistForm.reset();
  el.checklistItems.innerHTML = "";
  defaultItems.forEach((item) => addChecklistItem(item));
  renderPhotoPreview();
}

function collectForm(status) {
  const items = [...el.checklistItems.querySelectorAll(".check-item")].map((item) => ({
    checked: item.querySelector("input").checked,
    text: item.querySelector("span").textContent.trim() || "Unbenannter Prüfpunkt",
    comment: item.querySelector(".item-comment-input").value.trim()
  }));

  const now = new Date().toISOString();
  const existing = submissions.find((entry) => entry.id === activeChecklistId);

  return {
    id: activeChecklistId || crypto.randomUUID(),
    customerName: el.customerName.value.trim(),
    customerEmail: el.customerEmail.value.trim(),
    jobTitle: el.jobTitle.value.trim(),
    employeeName: el.employeeName.value.trim(),
    employeeComment: el.employeeComment.value.trim(),
    bossComment: existing?.bossComment || "",
    status,
    createdAt: existing?.createdAt || now,
    submittedAt: status === "submitted" ? now : existing?.submittedAt || "",
    approvedAt: existing?.approvedAt || "",
    emailSentAt: existing?.emailSentAt || "",
    photos: uploadedPhotos,
    items
  };
}

function saveChecklist(status) {
  if (status === "submitted" && !el.checklistForm.reportValidity()) return;
  if (status === "draft" && (!el.customerName.value.trim() || !el.jobTitle.value.trim())) {
    showToast("Für einen Entwurf reichen Kunde und Auftrag.");
    return;
  }

  const entry = collectForm(status);
  const index = submissions.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    submissions[index] = entry;
  } else {
    submissions.unshift(entry);
  }
  persist();
  showToast(status === "submitted" ? "Checkliste wurde eingereicht." : "Entwurf wurde gespeichert.");
  resetForm();
  render();
}

function editChecklist(id) {
  const entry = submissions.find((item) => item.id === id);
  if (!entry) return;
  activeChecklistId = id;
  uploadedPhotos = [...entry.photos];
  el.customerName.value = entry.customerName;
  el.customerEmail.value = entry.customerEmail;
  el.jobTitle.value = entry.jobTitle;
  el.employeeName.value = entry.employeeName;
  el.employeeComment.value = entry.employeeComment;
  el.checklistItems.innerHTML = "";
  entry.items.forEach((item) => addChecklistItem(item.text, item.checked, item.comment || ""));
  renderPhotoPreview();
  setRole("employee");
}

function renderPhotoPreview() {
  el.photoPreview.innerHTML = "";
  uploadedPhotos.forEach((photo, index) => {
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    const button = document.createElement("button");
    image.src = photo.data;
    image.alt = photo.name;
    button.type = "button";
    button.setAttribute("aria-label", "Bild entfernen");
    button.textContent = "×";
    button.addEventListener("click", () => {
      uploadedPhotos.splice(index, 1);
      renderPhotoPreview();
    });
    figure.append(image, button);
    el.photoPreview.appendChild(figure);
  });
}

function handlePhotoUpload(files) {
  [...files].slice(0, 6).forEach((file) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadedPhotos.push({ name: file.name, data: reader.result });
      renderPhotoPreview();
    };
    reader.readAsDataURL(file);
  });
  el.photoInput.value = "";
}

function renderSubmissionList(target, entries, mode) {
  target.innerHTML = "";
  if (!entries.length) {
    target.innerHTML = `<div class="submission-card"><strong>Keine Einträge</strong><small>Hier erscheinen gespeicherte oder eingereichte Checklisten.</small></div>`;
    return;
  }

  entries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `submission-card ${entry.id === activeChecklistId ? "active" : ""}`;
    button.innerHTML = `
      <div>
        <strong>${escapeHtml(entry.jobTitle)}</strong>
        <small>${escapeHtml(entry.customerName)} · ${formatDate(entry.submittedAt || entry.createdAt)}</small>
      </div>
      <div class="card-meta">
        <span class="badge ${entry.status}">${getStatusLabel(entry.status)}</span>
        <span class="badge">${entry.items.filter((item) => item.checked).length}/${entry.items.length} erledigt</span>
        <span class="badge">${entry.photos.length} Bilder</span>
      </div>
    `;
    button.addEventListener("click", () => (mode === "boss" ? selectForReview(entry.id) : editChecklist(entry.id)));
    target.appendChild(button);
  });
}

function selectForReview(id) {
  activeChecklistId = id;
  renderReview();
  renderLists();
}

function approveChecklist(id) {
  const entry = submissions.find((item) => item.id === id);
  if (!entry) return;
  const commentField = document.getElementById("bossComment");
  entry.bossComment = commentField?.value.trim() || entry.bossComment;
  entry.status = "approved";
  entry.approvedAt = new Date().toISOString();
  sendCustomerEmail(entry);
  persist();
  render();
  showToast("Freigegeben. Der Kundenbericht wurde automatisch per E-Mail markiert.");
}

function sendCustomerEmail(entry) {
  entry.emailSentAt = new Date().toISOString();
  el.emailStatus.innerHTML = `<span class="dot"></span> Bericht an ${entry.customerEmail} gesendet`;
}

function reopenChecklist(id) {
  const entry = submissions.find((item) => item.id === id);
  if (!entry) return;
  entry.status = "submitted";
  entry.approvedAt = "";
  entry.emailSentAt = "";
  persist();
  render();
  showToast("Checkliste ist wieder zur Prüfung offen.");
}

function deleteChecklist(id) {
  submissions = submissions.filter((item) => item.id !== id);
  if (activeChecklistId === id) activeChecklistId = null;
  persist();
  render();
  showToast("Checkliste wurde gelöscht.");
}

function buildReportText(entry) {
  const done = entry.items.filter((item) => item.checked).length;
  const open = entry.items.length - done;
  const itemLines = entry.items.map((item) => {
    const statusMark = item.checked ? "[OK]" : "[OFFEN]";
    const commentPart = item.comment ? ` - Kommentar: ${item.comment}` : "";
    return `- ${statusMark} ${item.text}${commentPart}`;
  }).join("\n");
  return [
    `Guten Tag ${entry.customerName},`,
    "",
    `anbei erhalten Sie den Bericht zu "${entry.jobTitle}".`,
    `Ergebnis: ${done} von ${entry.items.length} Prüfpunkten erledigt, ${open} offen.`,
    "",
    "Prüfpunkte:",
    itemLines,
    entry.employeeComment ? `Kommentar Mitarbeiter: ${entry.employeeComment}` : "",
    entry.bossComment ? `Kommentar Freigabe: ${entry.bossComment}` : "",
    "",
    "Freundliche Grüße",
    "Ihr Handwerksbetrieb"
  ].filter(Boolean).join("\n");
}

function openMailDraft(entry) {
  const subject = encodeURIComponent(`Bericht: ${entry.jobTitle}`);
  const body = encodeURIComponent(buildReportText(entry));
  window.location.href = `mailto:${entry.customerEmail}?subject=${subject}&body=${body}`;
}

function renderReview() {
  const entry = submissions.find((item) => item.id === activeChecklistId);
  if (!entry) {
    el.reviewPanel.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
        <h2>Checkliste auswählen</h2>
        <p>Der Bericht, die Bilder und die Freigabe erscheinen hier.</p>
      </div>
    `;
    return;
  }

  const done = entry.items.filter((item) => item.checked).length;
  const safe = {
    jobTitle: escapeHtml(entry.jobTitle),
    customerName: escapeHtml(entry.customerName),
    customerEmail: escapeHtml(entry.customerEmail),
    employeeName: escapeHtml(entry.employeeName),
    employeeComment: escapeHtml(entry.employeeComment),
    bossComment: escapeHtml(entry.bossComment || ""),
    reportText: escapeHtml(buildReportText(entry)).replaceAll("\n", "<br>")
  };
  el.reviewPanel.innerHTML = `
    <div class="review-header">
      <div>
        <span class="badge ${entry.status}">${getStatusLabel(entry.status)}</span>
        <h2>${safe.jobTitle}</h2>
      </div>
      <div class="status-pill"><span class="dot"></span>${entry.emailSentAt ? `E-Mail gesendet: ${formatDate(entry.emailSentAt)}` : "Noch nicht gesendet"}</div>
    </div>

    <div class="info-grid">
      <div><span>Kunde</span><strong>${safe.customerName}</strong></div>
      <div><span>E-Mail</span><strong>${safe.customerEmail}</strong></div>
      <div><span>Mitarbeiter</span><strong>${safe.employeeName}</strong></div>
      <div><span>Eingereicht</span><strong>${formatDate(entry.submittedAt || entry.createdAt)}</strong></div>
    </div>

    <h3>Prüfpunkte</h3>
    <ul class="report-items">
      ${entry.items.map((item) => `
        <li>
          <span class="result-mark ${item.checked ? "ok" : ""}">${item.checked ? "✓" : "!"}</span>
          <div>
            <span>${escapeHtml(item.text)}</span>
            ${item.comment ? `<small class="item-note">Kommentar: ${escapeHtml(item.comment)}</small>` : ""}
          </div>
        </li>
      `).join("")}
    </ul>

    ${entry.employeeComment ? `<div class="report-preview"><h3>Kommentar Mitarbeiter</h3><p>${safe.employeeComment}</p></div>` : ""}

    <div class="photo-gallery">
      ${entry.photos.map((photo) => `<img src="${photo.data}" alt="${escapeHtml(photo.name)}">`).join("")}
    </div>

    <label class="review-comment">
      Kommentar Chef
      <textarea id="bossComment" rows="4" ${entry.status === "approved" ? "disabled" : ""}>${safe.bossComment}</textarea>
    </label>

    <div class="report-preview">
      <h3>Kundenbericht</h3>
      <p>${safe.reportText}</p>
    </div>

    <div class="review-actions">
      <button class="secondary-button" id="mailDraftButton" type="button">E-Mail-Entwurf öffnen</button>
      ${entry.status === "approved"
        ? `<button class="secondary-button" id="reopenButton" type="button">Erneut prüfen</button>`
        : `<button class="primary-button" id="approveButton" type="button">Freigeben und Bericht senden</button>`}
      <button class="danger-button" id="deleteButton" type="button">Löschen</button>
    </div>
  `;

  document.getElementById("mailDraftButton").addEventListener("click", () => openMailDraft(entry));
  document.getElementById("deleteButton").addEventListener("click", () => deleteChecklist(entry.id));
  document.getElementById("approveButton")?.addEventListener("click", () => approveChecklist(entry.id));
  document.getElementById("reopenButton")?.addEventListener("click", () => reopenChecklist(entry.id));

  const summary = `${done}/${entry.items.length} Prüfpunkte erledigt`;
  el.emailStatus.innerHTML = `<span class="dot"></span>${summary}`;
}

function renderLists() {
  const filter = el.statusFilter.value;
  const filteredForBoss = filter === "all" ? submissions : submissions.filter((entry) => entry.status === filter);
  renderSubmissionList(el.employeeList, submissions, "employee");
  renderSubmissionList(el.bossList, filteredForBoss, "boss");
}

function renderStats() {
  el.statDrafts.textContent = submissions.filter((entry) => entry.status === "draft").length;
  el.statSubmitted.textContent = submissions.filter((entry) => entry.status === "submitted").length;
  el.statApproved.textContent = submissions.filter((entry) => entry.status === "approved").length;
}

function render() {
  if (!currentRole) return;
  renderStats();
  renderLists();
  if (currentRole === "boss") renderReview();
}

el.addItemButton.addEventListener("click", () => addChecklistItem());
el.photoInput.addEventListener("change", (event) => handlePhotoUpload(event.target.files));
el.checklistForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveChecklist("submitted");
});
el.saveDraftButton.addEventListener("click", () => saveChecklist("draft"));
el.newChecklistButton.addEventListener("click", resetForm);
el.statusFilter.addEventListener("change", renderLists);
el.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login(el.loginUsername.value.trim(), el.loginPassword.value);
});
el.logoutButton.addEventListener("click", logout);

resetForm();
if (currentSession && users.some((user) => user.username === currentSession.username && user.role === currentSession.role)) {
  el.sessionUser.textContent = `${currentSession.label} (${currentSession.username})`;
  el.authScreen.classList.add("hidden");
  el.appShell.classList.remove("hidden");
  setRole(currentSession.role);
} else {
  persistSession(null);
}

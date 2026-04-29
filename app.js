const storageKey = "werkstattcheck-submissions-v1";
const sessionKey = "werkstattcheck-session-v1";
const scheduleKey = "werkstattcheck-staff-schedule-v1";
const customerDbKey = "werkstattcheck-customer-db-v1";
const checkpointCatalogKey = "werkstattcheck-checkpoint-catalog-v1";
const fallbackCheckpointItems = [
  "Pflanzen und Hecken geschnitten",
  "Rasen gemäht",
  "Haus sauber und zur Anreise bereit",
  "Pool sauber",
  "Pool Werte ideal",
  "Fenster gereinigt"
];
const users = [
  { username: "chef", password: "123", role: "boss", label: "Chef" },
  { username: "patrick", password: "123", role: "employee", label: "Patrick" },
  { username: "souhail", password: "123", role: "employee", label: "Souhail" },
  { username: "mohammed", password: "123", role: "employee", label: "Mohammed" }
];

let submissions = loadSubmissions();
let currentRole = null;
let activeChecklistId = null;
let uploadedPhotos = [];
let currentSession = loadSession();
let currentMailPreviewUrl = null;
let staffSchedule = loadSchedule();
let customerDb = loadCustomerDb();
let checkpointCatalog = loadCheckpointCatalog();
let selectedCalendarDate = toIsoDate(new Date());
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let activeSection = "checklist";
let lockedCustomerName = "";
let employeeChecklistUnlocked = false;
let activeAssignmentId = "";
let activeCustomerDbId = "";
let activeCheckpointEditIndex = -1;
let calendarPlanningOpen = false;
let activeCustomerId = "";

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

const el = {
  authScreen: document.getElementById("authScreen"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  loginError: document.getElementById("loginError"),
  logoutButton: document.getElementById("logoutButton"),
  sessionUser: document.getElementById("sessionUser"),
  employeeView: document.getElementById("employeeView"),
  bossView: document.getElementById("bossView"),
  checklistSection: document.getElementById("checklistSection"),
  moduleTabs: document.getElementById("moduleTabs"),
  moduleTabButtons: document.querySelectorAll(".module-tab"),
  customerDbTab: document.getElementById("customerDbTab"),
  worktimeTab: document.getElementById("worktimeTab"),
  checkpointTab: document.getElementById("checkpointTab"),
  roleEyebrow: document.getElementById("roleEyebrow"),
  pageTitle: document.getElementById("pageTitle"),
  emailStatus: document.getElementById("emailStatus"),
  checklistForm: document.getElementById("checklistForm"),
  employeeChecklistLockedHint: document.getElementById("employeeChecklistLockedHint"),
  checklistItems: document.getElementById("checklistItems"),
  itemTemplate: document.getElementById("itemTemplate"),
  addItemButton: document.getElementById("addItemButton"),
  photoInput: document.getElementById("photoInput"),
  photoPreview: document.getElementById("photoPreview"),
  employeeList: document.getElementById("employeeList"),
  bossList: document.getElementById("bossList"),
  bossSearchRow: document.getElementById("bossSearchRow"),
  bossCustomerFilter: document.getElementById("bossCustomerFilter"),
  bossProjectFilter: document.getElementById("bossProjectFilter"),
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
  employeeComment: document.getElementById("employeeComment"),
  comeButton: document.getElementById("comeButton"),
  breakStartButton: document.getElementById("breakStartButton"),
  breakEndButton: document.getElementById("breakEndButton"),
  leaveButton: document.getElementById("leaveButton"),
  comeTimeDisplay: document.getElementById("comeTimeDisplay"),
  breakStartTimeDisplay: document.getElementById("breakStartTimeDisplay"),
  breakEndTimeDisplay: document.getElementById("breakEndTimeDisplay"),
  leaveTimeDisplay: document.getElementById("leaveTimeDisplay")
  ,
  customerDbPanel: document.getElementById("customerDbPanel"),
  worktimePanel: document.getElementById("worktimePanel"),
  worktimeScope: document.getElementById("worktimeScope"),
  worktimeDate: document.getElementById("worktimeDate"),
  worktimeList: document.getElementById("worktimeList"),
  checkpointPanel: document.getElementById("checkpointPanel"),
  checkpointManager: document.getElementById("checkpointManager"),
  checkpointForm: document.getElementById("checkpointForm"),
  checkpointName: document.getElementById("checkpointName"),
  checkpointSaveButton: document.getElementById("checkpointSaveButton"),
  checkpointList: document.getElementById("checkpointList"),
  customerDbForm: document.getElementById("customerDbForm"),
  customerDbList: document.getElementById("customerDbList"),
  dbFirstName: document.getElementById("dbFirstName"),
  dbLastName: document.getElementById("dbLastName"),
  dbAddress: document.getElementById("dbAddress"),
  dbProject: document.getElementById("dbProject"),
  dbEmail: document.getElementById("dbEmail"),
  dbPhone: document.getElementById("dbPhone"),
  customerCheckpointOptions: document.getElementById("customerCheckpointOptions"),
  calendarPanel: document.getElementById("calendarPanel"),
  calendarMonthLabel: document.getElementById("calendarMonthLabel"),
  calendarGrid: document.getElementById("calendarGrid"),
  calendarSelectedLabel: document.getElementById("calendarSelectedLabel"),
  calendarStaffList: document.getElementById("calendarStaffList"),
  calendarStaffForm: document.getElementById("calendarStaffForm"),
  calendarSort: document.getElementById("calendarSort"),
  calendarNewAssignmentButton: document.getElementById("calendarNewAssignmentButton"),
  calendarEmployeeSelect: document.getElementById("calendarEmployeeSelect"),
  calendarFromTime: document.getElementById("calendarFromTime"),
  calendarToTime: document.getElementById("calendarToTime"),
  calendarCustomerSelect: document.getElementById("calendarCustomerSelect"),
  calendarStaffComment: document.getElementById("calendarStaffComment"),
  calendarPrev: document.getElementById("calendarPrev"),
  calendarNext: document.getElementById("calendarNext")
};

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadSchedule() {
  const stored = localStorage.getItem(scheduleKey);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

function persistSchedule() {
  localStorage.setItem(scheduleKey, JSON.stringify(staffSchedule));
}

function loadCustomerDb() {
  const stored = localStorage.getItem(customerDbKey);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function persistCustomerDb() {
  localStorage.setItem(customerDbKey, JSON.stringify(customerDb));
}

function loadCheckpointCatalog() {
  const stored = localStorage.getItem(checkpointCatalogKey);
  if (!stored) return [...fallbackCheckpointItems];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length
      ? parsed.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [...fallbackCheckpointItems];
  } catch {
    return [...fallbackCheckpointItems];
  }
}

function persistCheckpointCatalog() {
  localStorage.setItem(checkpointCatalogKey, JSON.stringify(checkpointCatalog));
}

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
        id: createId(),
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
        items: checkpointCatalog.map((text) => ({ text, checked: false }))
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
        comment: item.comment || "",
        photo: item.photo || null
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
  return labels[status] != null ? labels[status] : status;
}

function escapeHtml(value) {
  return String(value != null ? value : "").replace(/[&<>"']/g, (char) => ({
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

function nowTime() {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function setEmployeeTime(type) {
  const time = nowTime();
  if (type === "come") {
    if (el.comeButton.disabled) return;
    el.comeTimeDisplay.textContent = time;
    el.comeButton.disabled = true;
  }
  if (type === "breakStart") {
    if (el.breakStartButton.disabled) return;
    el.breakStartTimeDisplay.textContent = `Start: ${time}`;
    el.breakStartButton.disabled = true;
  }
  if (type === "breakEnd") {
    if (el.breakEndButton.disabled) return;
    el.breakEndTimeDisplay.textContent = `Ende: ${time}`;
    el.breakEndButton.disabled = true;
  }
  if (type === "leave") {
    if (el.leaveButton.disabled) return;
    el.leaveTimeDisplay.textContent = time;
    el.leaveButton.disabled = true;
  }
  if (type === "come") {
    if (el.customerName.value.trim()) {
      employeeChecklistUnlocked = true;
    }
    saveChecklist("draft", { resetAfterSave: false, silent: true });
    markAssignmentInProgress();
  }
}

function setRole(role) {
  currentRole = role;
  el.roleEyebrow.textContent = role === "employee" ? "Mitarbeiterbereich" : "Chefbereich";
  el.pageTitle.textContent = role === "employee" ? "Checkliste ausfüllen" : "Checklisten prüfen und freigeben";
  if (!getAvailableSections().includes(activeSection)) {
    activeSection = "checklist";
  }
  if (role !== "boss") calendarPlanningOpen = false;
  el.calendarStaffForm.classList.toggle("hidden", role !== "boss" || !calendarPlanningOpen);
  el.calendarNewAssignmentButton.classList.toggle("hidden", role !== "boss");
  el.newChecklistButton.classList.toggle("hidden", role === "employee");
  el.customerName.readOnly = role === "employee" || Boolean(lockedCustomerName);
  render();
}

function getEmployeeUsers() {
  return users.filter((user) => user.role === "employee");
}

function getAvailableSections() {
  const isChef = currentSession && currentSession.username === "chef";
  return isChef ? ["checklist", "customerDb", "calendar", "worktime", "checkpoints"] : ["checklist", "calendar"];
}

function setActiveSection(section) {
  if (!getAvailableSections().includes(section)) return;
  activeSection = section;
  renderSectionVisibility();
}

function renderSectionVisibility() {
  const isChef = currentSession && currentSession.username === "chef";
  el.customerDbTab.classList.toggle("hidden", !isChef);
  el.worktimeTab.classList.toggle("hidden", !isChef);
  el.checkpointTab.classList.toggle("hidden", !isChef);
  el.moduleTabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === activeSection);
  });

  el.checklistSection.classList.toggle("hidden", activeSection !== "checklist");
  el.customerDbPanel.classList.toggle("hidden", activeSection !== "customerDb" || !isChef);
  el.calendarPanel.classList.toggle("hidden", activeSection !== "calendar");
  el.worktimePanel.classList.toggle("hidden", activeSection !== "worktime" || !isChef);
  el.checkpointPanel.classList.toggle("hidden", activeSection !== "checkpoints" || !isChef);

  const showChecklist = activeSection === "checklist";
  el.employeeView.classList.toggle("active", showChecklist && currentRole === "employee");
  el.bossView.classList.toggle("active", showChecklist && currentRole === "boss");
  el.bossSearchRow.classList.toggle("hidden", !(showChecklist && currentRole === "boss" && isChef));

  const employeeNeedsCalendarStart = currentRole === "employee" && !employeeChecklistUnlocked && !activeChecklistId && !activeAssignmentId;
  el.checklistForm.classList.toggle("hidden", employeeNeedsCalendarStart);
  el.employeeChecklistLockedHint.classList.toggle("hidden", !employeeNeedsCalendarStart);
}

function login(username, password) {
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const user = users.find((item) => item.username === normalizedUsername && item.password === normalizedPassword);
  if (!user) {
    if (el.loginError) {
      el.loginError.textContent = "Login fehlgeschlagen. Bitte Zugangsdaten prüfen.";
      el.loginError.classList.remove("hidden");
    }
    showToast("Login fehlgeschlagen. Bitte Zugangsdaten prüfen.");
    return;
  }

  if (el.loginError) {
    el.loginError.textContent = "";
    el.loginError.classList.add("hidden");
  }
  activeChecklistId = null;
  employeeChecklistUnlocked = false;
  activeAssignmentId = "";
  lockedCustomerName = "";

  currentSession = { username: user.username, role: user.role, label: user.label };
  persistSession(currentSession);
  el.sessionUser.textContent = `${user.label} (${user.username})`;
  el.authScreen.classList.add("hidden");
  el.appShell.classList.remove("hidden");
  resetForm();
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
  if (el.loginError) {
    el.loginError.textContent = "";
    el.loginError.classList.add("hidden");
  }
  showToast("Du wurdest abgemeldet.");
}

function renderItemPhoto(node, photo) {
  const preview = node.querySelector(".item-photo-preview");
  preview.innerHTML = "";
  if (!photo || !photo.data) return;
  const image = document.createElement("img");
  image.src = photo.data;
  image.alt = photo.name || "Prüfpunkt-Bild";
  preview.appendChild(image);
}

function addChecklistItem(text = "", checked = false, comment = "", photo = null) {
  const node = el.itemTemplate.content.firstElementChild.cloneNode(true);
  const checkbox = node.querySelector("input");
  const label = node.querySelector("span");
  const commentField = node.querySelector(".item-comment-input");
  const photoInput = node.querySelector(".item-photo-input");
  const photoTrigger = node.querySelector(".item-photo-trigger");
  checkbox.checked = checked;
  label.textContent = text || "Neuer Prüfpunkt";
  commentField.value = comment;
  node._itemPhoto = photo;
  renderItemPhoto(node, node._itemPhoto);
  photoTrigger.addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      node._itemPhoto = { name: file.name, data: reader.result };
      renderItemPhoto(node, node._itemPhoto);
    };
    reader.readAsDataURL(file);
    photoInput.value = "";
  });
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
  activeAssignmentId = "";
  activeCustomerId = "";
  uploadedPhotos = [];
  employeeChecklistUnlocked = false;
  el.checklistForm.reset();
  lockedCustomerName = "";
  el.customerName.readOnly = currentRole === "employee";
  if (el.comeTimeDisplay) el.comeTimeDisplay.textContent = "-";
  if (el.breakStartTimeDisplay) el.breakStartTimeDisplay.textContent = "Start: -";
  if (el.breakEndTimeDisplay) el.breakEndTimeDisplay.textContent = "Ende: -";
  if (el.leaveTimeDisplay) el.leaveTimeDisplay.textContent = "-";
  el.comeButton.disabled = false;
  el.breakStartButton.disabled = false;
  el.breakEndButton.disabled = false;
  el.leaveButton.disabled = false;
  el.checklistItems.innerHTML = "";
  if (currentRole !== "employee") {
    checkpointCatalog.forEach((item) => addChecklistItem(item));
  }
  setChecklistEditability(true);
  renderPhotoPreview();
}

function setChecklistEditability(isEditable) {
  const editable = Boolean(isEditable);
  el.addItemButton.disabled = !editable;
  el.saveDraftButton.disabled = !editable;
  el.checklistForm.querySelector('button[type="submit"]').disabled = !editable;
  el.comeButton.disabled = !editable || el.comeButton.disabled;
  el.breakStartButton.disabled = !editable || el.breakStartButton.disabled;
  el.breakEndButton.disabled = !editable || el.breakEndButton.disabled;
  el.leaveButton.disabled = !editable || el.leaveButton.disabled;
  el.employeeComment.disabled = !editable;

  el.checklistItems.querySelectorAll(".check-item").forEach((item) => {
    item.querySelector("input[type='checkbox']").disabled = !editable;
    item.querySelector(".item-comment-input").disabled = !editable;
    item.querySelector(".item-photo-trigger").classList.toggle("hidden", !editable);
    item.querySelector(".remove-item").disabled = !editable;
    const textSpan = item.querySelector(".checkbox-line span");
    textSpan.setAttribute("contenteditable", editable ? "true" : "false");
  });
}

function resetCustomerDbForm() {
  activeCustomerDbId = "";
  el.customerDbForm.reset();
  renderCustomerCheckpointOptions([]);
}

function renderCustomerCheckpointOptions(selected = []) {
  if (!el.customerCheckpointOptions) return;
  const selectedSet = new Set(selected);
  el.customerCheckpointOptions.innerHTML = checkpointCatalog.map((item) => `
    <label>
      <input type="checkbox" value="${escapeHtml(item)}" ${selectedSet.has(item) ? "checked" : ""} />
      <span>${escapeHtml(item)}</span>
    </label>
  `).join("");
}

function getSelectedCustomerCheckpoints() {
  return [...el.customerCheckpointOptions.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value);
}

function buildSyncedChecklistItems(existingItems = [], nextCheckpointNames = [], renameMap = {}) {
  const existingByName = new Map(
    existingItems.map((item) => [item.text, item])
  );

  return nextCheckpointNames.map((name) => {
    const directMatch = existingByName.get(name);
    const renamedEntry = Object.entries(renameMap).find(([, nextName]) => nextName === name);
    const renamedFrom = renamedEntry ? renamedEntry[0] : null;
    const previousItem = directMatch || (renamedFrom ? existingByName.get(renamedFrom) : null);

    return {
      checked: previousItem && previousItem.checked != null ? previousItem.checked : false,
      text: name,
      comment: previousItem && previousItem.comment ? previousItem.comment : "",
      photo: previousItem && previousItem.photo ? previousItem.photo : null
    };
  });
}

function syncDraftSubmissionsForCustomer(customerId, nextCheckpointNames, renameMap = {}) {
  if (!customerId) return 0;

  let updatedCount = 0;
  submissions = submissions.map((submission) => {
    if (submission.customerId !== customerId || submission.status !== "draft") {
      return submission;
    }

    updatedCount += 1;
    return {
      ...submission,
      items: buildSyncedChecklistItems(submission.items || [], nextCheckpointNames, renameMap)
    };
  });

  if (updatedCount) {
    persist();
    if (activeChecklistId) {
      const activeEntry = submissions.find((item) => item.id === activeChecklistId);
      if (activeEntry) {
        editChecklist(activeEntry.id);
      }
    }
  }

  return updatedCount;
}

function resetCheckpointForm() {
  activeCheckpointEditIndex = -1;
  if (el.checkpointForm) el.checkpointForm.reset();
  if (el.checkpointSaveButton) {
    el.checkpointSaveButton.textContent = "Prüfpunkt speichern";
  }
}

function refreshCustomerCheckpointOptions() {
  const selected = getSelectedCustomerCheckpoints().filter((item) => checkpointCatalog.includes(item));
  renderCustomerCheckpointOptions(selected);
}

function renderCheckpointManager() {
  if (!el.checkpointList) return;
  if (!checkpointCatalog.length) {
    el.checkpointList.innerHTML = `<div class="checkpoint-item"><span>Noch keine Prüfpunkte vorhanden.</span></div>`;
    return;
  }

  el.checkpointList.innerHTML = "";
  checkpointCatalog.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "checkpoint-item";
    row.innerHTML = `
      <span>${escapeHtml(item)}</span>
      <div class="checkpoint-item-actions">
        <button class="secondary-button" type="button" data-edit-checkpoint="${index}">Bearbeiten</button>
        <button class="danger-button" type="button" data-delete-checkpoint="${index}">Löschen</button>
      </div>
    `;
    const editButton = row.querySelector("[data-edit-checkpoint]");
    if (editButton) editButton.addEventListener("click", () => {
      activeCheckpointEditIndex = index;
      el.checkpointName.value = item;
      el.checkpointSaveButton.textContent = "Prüfpunkt aktualisieren";
      el.checkpointName.focus();
    });
    const deleteButton = row.querySelector("[data-delete-checkpoint]");
    if (deleteButton) deleteButton.addEventListener("click", () => {
      deleteCheckpoint(index);
    });
    el.checkpointList.appendChild(row);
  });
}

function saveCheckpoint(name) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    showToast("Bitte einen Prüfpunkt eingeben.");
    return false;
  }

  const duplicateIndex = checkpointCatalog.findIndex((item) => item.toLowerCase() === normalizedName.toLowerCase());
  if (duplicateIndex >= 0 && duplicateIndex !== activeCheckpointEditIndex) {
    showToast("Dieser Prüfpunkt existiert bereits.");
    return false;
  }

  if (activeCheckpointEditIndex >= 0) {
    const previousName = checkpointCatalog[activeCheckpointEditIndex];
    checkpointCatalog[activeCheckpointEditIndex] = normalizedName;
    customerDb = customerDb.map((entry) => ({
      ...entry,
      checkpoints: (entry.checkpoints || []).map((item) => item === previousName ? normalizedName : item)
    }));
    persistCustomerDb();
    customerDb.forEach((entry) => {
      syncDraftSubmissionsForCustomer(entry.id, entry.checkpoints || [], { [previousName]: normalizedName });
    });
    showToast("Prüfpunkt aktualisiert.");
  } else {
    checkpointCatalog.unshift(normalizedName);
    showToast("Prüfpunkt gespeichert.");
  }

  persistCheckpointCatalog();
  refreshCustomerCheckpointOptions();
  renderCheckpointManager();
  renderCustomerDb();
  resetCheckpointForm();
  return true;
}

function deleteCheckpoint(index) {
  const removedName = checkpointCatalog[index];
  if (!removedName) return;
  checkpointCatalog.splice(index, 1);
  customerDb = customerDb.map((entry) => ({
    ...entry,
    checkpoints: (entry.checkpoints || []).filter((item) => item !== removedName)
  }));
  persistCheckpointCatalog();
  persistCustomerDb();
  customerDb.forEach((entry) => {
    syncDraftSubmissionsForCustomer(entry.id, entry.checkpoints || []);
  });
  refreshCustomerCheckpointOptions();
  renderCheckpointManager();
  renderCustomerDb();
  resetCheckpointForm();
  showToast("Prüfpunkt gelöscht.");
}

function collectForm(status) {
  const items = [...el.checklistItems.querySelectorAll(".check-item")].map((item) => ({
    checked: item.querySelector("input").checked,
    text: item.querySelector("span").textContent.trim() || "Unbenannter Prüfpunkt",
    comment: item.querySelector(".item-comment-input").value.trim(),
    photo: item._itemPhoto || null
  }));

  const now = new Date().toISOString();
  const existing = submissions.find((entry) => entry.id === activeChecklistId);
  const inferredCustomerId = activeCustomerId || (existing ? existing.customerId : "") || resolveCustomerIdByName(el.customerName.value.trim());

  return {
    id: activeChecklistId || createId(),
    customerName: el.customerName.value.trim(),
    customerEmail: existing ? existing.customerEmail || "" : "",
    jobTitle: el.customerName.value.trim(),
    employeeName: (currentSession ? currentSession.label : "") || (existing ? existing.employeeName || "" : "") || "Mitarbeiter",
    employeeUsername: currentSession && currentSession.role === "employee" ? currentSession.username : (existing ? existing.employeeUsername || "" : ""),
    employeeComment: el.employeeComment.value.trim(),
    attendance: {
      come: !el.comeTimeDisplay || el.comeTimeDisplay.textContent === "-" ? "" : el.comeTimeDisplay.textContent || "",
      breakStart: !el.breakStartTimeDisplay || el.breakStartTimeDisplay.textContent.replace("Start: ", "") === "-" ? "" : (el.breakStartTimeDisplay.textContent.replace("Start: ", "") || ""),
      breakEnd: !el.breakEndTimeDisplay || el.breakEndTimeDisplay.textContent.replace("Ende: ", "") === "-" ? "" : (el.breakEndTimeDisplay.textContent.replace("Ende: ", "") || ""),
      leave: !el.leaveTimeDisplay || el.leaveTimeDisplay.textContent === "-" ? "" : el.leaveTimeDisplay.textContent || ""
    },
    assignmentId: activeAssignmentId || (existing ? existing.assignmentId || "" : ""),
    customerId: inferredCustomerId || "",
    lockedCustomerName,
    bossComment: existing ? existing.bossComment || "" : "",
    status,
    createdAt: existing ? existing.createdAt || now : now,
    submittedAt: status === "submitted" ? now : (existing ? existing.submittedAt || "" : ""),
    approvedAt: existing ? existing.approvedAt || "" : "",
    emailSentAt: existing ? existing.emailSentAt || "" : "",
    photos: uploadedPhotos,
    items
  };
}

function saveChecklist(status, options = {}) {
  const { resetAfterSave = true, silent = false } = options;
  const existing = submissions.find((item) => item.id === activeChecklistId);
  if (currentRole === "employee" && !employeeChecklistUnlocked && !activeChecklistId) {
    showToast("Neue Checkliste bitte über den Kalender-Einsatz starten.");
    return;
  }
  if (currentRole === "employee" && existing && existing.status === "approved") {
    showToast("Freigegebene Checklisten können nicht mehr geändert werden.");
    return;
  }

  if (status === "submitted" && !el.checklistForm.reportValidity()) return;
  if (status === "draft" && !el.customerName.value.trim()) {
    if (!silent) showToast("Für einen Entwurf reicht ein Kunde.");
    return;
  }

  const entry = collectForm(status);
  const index = submissions.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    submissions[index] = entry;
  } else {
    submissions.unshift(entry);
    activeChecklistId = entry.id;
  }
  persist();
  if (!silent) {
    showToast(status === "submitted" ? "Checkliste wurde eingereicht." : "Entwurf wurde gespeichert.");
  }
  if (resetAfterSave) {
    resetForm();
  }
  render();
}

function editChecklist(id) {
  const entry = submissions.find((item) => item.id === id);
  if (!entry) return;
  if (currentRole === "employee" && entry.employeeUsername && (!currentSession || entry.employeeUsername !== currentSession.username)) {
    showToast("Kein Zugriff auf diese Checkliste.");
    return;
  }
  activeChecklistId = id;
  activeAssignmentId = entry.assignmentId || "";
  activeCustomerId = entry.customerId || resolveCustomerIdByName(entry.customerName);
  employeeChecklistUnlocked = true;
  uploadedPhotos = [...entry.photos];
  el.customerName.value = entry.customerName;
  if (el.customerEmail) el.customerEmail.value = entry.customerEmail;
  if (el.jobTitle) el.jobTitle.value = entry.jobTitle;
  if (el.employeeName) el.employeeName.value = entry.employeeName;
  lockedCustomerName = entry.lockedCustomerName || "";
  el.customerName.readOnly = currentRole === "employee" || Boolean(lockedCustomerName);
  el.comeTimeDisplay.textContent = entry.attendance && entry.attendance.come ? entry.attendance.come : "-";
  el.breakStartTimeDisplay.textContent = `Start: ${entry.attendance && entry.attendance.breakStart ? entry.attendance.breakStart : "-"}`;
  el.breakEndTimeDisplay.textContent = `Ende: ${entry.attendance && entry.attendance.breakEnd ? entry.attendance.breakEnd : "-"}`;
  el.leaveTimeDisplay.textContent = entry.attendance && entry.attendance.leave ? entry.attendance.leave : "-";
  el.comeButton.disabled = Boolean(entry.attendance && entry.attendance.come);
  el.breakStartButton.disabled = Boolean(entry.attendance && entry.attendance.breakStart);
  el.breakEndButton.disabled = Boolean(entry.attendance && entry.attendance.breakEnd);
  el.leaveButton.disabled = Boolean(entry.attendance && entry.attendance.leave);
  el.employeeComment.value = entry.employeeComment;
  el.checklistItems.innerHTML = "";
  entry.items.forEach((item) => addChecklistItem(item.text, item.checked, item.comment || "", item.photo || null));
  const isReadOnlyApproved = currentRole === "employee" && entry.status === "approved";
  setChecklistEditability(!isReadOnlyApproved);
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
  entry.bossComment = commentField ? commentField.value.trim() || entry.bossComment : entry.bossComment;
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
    const statusMark = item.checked ? "✓" : "!";
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
    entry.employeeComment ? `Weitere Informationen: ${entry.employeeComment}` : "",
    entry.bossComment ? `Kommentar Freigabe: ${entry.bossComment}` : "",
    "",
    "Freundliche Grüße",
    "Ihre Familie Swiderski - immer in bester Hand"
  ].filter(Boolean).join("\n");
}

function buildReportHtml(entry) {
  const done = entry.items.filter((item) => item.checked).length;
  const open = entry.items.length - done;
  return `
    <p>Guten Tag ${escapeHtml(entry.customerName)},</p>
    <p>anbei erhalten Sie den Bericht zu "${escapeHtml(entry.jobTitle)}".</p>
    <p>Ergebnis: ${done} von ${entry.items.length} Prüfpunkten erledigt, ${open} offen.</p>
    <h3>Prüfpunkte</h3>
    <ul class="report-items">
      ${entry.items.map((item) => `
        <li>
          <span class="result-mark ${item.checked ? "ok" : ""}">${item.checked ? "✓" : "!"}</span>
          <div>
            <span>${escapeHtml(item.text)}</span>
            ${item.comment ? `<small class="item-note">Kommentar: ${escapeHtml(item.comment)}</small>` : ""}
            ${item.photo && item.photo.data ? `<img src="${item.photo.data}" alt="${escapeHtml(item.photo.name || "Prüfpunkt-Bild")}" />` : ""}
          </div>
        </li>
      `).join("")}
    </ul>
    ${entry.employeeComment ? `<p><strong>Weitere Informationen:</strong> ${escapeHtml(entry.employeeComment)}</p>` : ""}
    ${entry.bossComment ? `<p><strong>Kommentar Freigabe:</strong> ${escapeHtml(entry.bossComment)}</p>` : ""}
    <p>Freundliche Grüße<br>Ihre Familie Swiderski - immer in bester Hand</p>
  `;
}

function openMailDraft(entry) {
  const subject = encodeURIComponent(`Bericht: ${entry.jobTitle}`);
  const body = encodeURIComponent(buildReportText(entry));
  return `mailto:${entry.customerEmail}?subject=${subject}&body=${body}`;
}

function buildMailPreviewUrl(entry) {
  const mailtoUrl = openMailDraft(entry);
  const previewHtml = `
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>E-Mail-Entwurf</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f4f4f4; color: #1a1a1a; }
          .card { max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #ddd2b9; border-radius: 10px; padding: 20px; }
          h1 { margin-top: 0; }
          pre { white-space: pre-wrap; background: #fafafa; border: 1px solid #e6e6e6; border-radius: 8px; padding: 12px; }
          .actions { margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap; }
          .button { display: inline-block; text-decoration: none; padding: 10px 14px; border-radius: 8px; border: 1px solid #ddd2b9; color: #1a1a1a; font-weight: 700; }
          .button.primary { background: #d49b2a; border-color: #d49b2a; color: #fff; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>E-Mail-Entwurf</h1>
          <p><strong>An:</strong> ${escapeHtml(entry.customerEmail)}</p>
          <p><strong>Betreff:</strong> Bericht: ${escapeHtml(entry.jobTitle)}</p>
          <pre>${escapeHtml(buildReportText(entry))}</pre>
          <div class="actions">
            <a class="button primary" href="${mailtoUrl}">E-Mail-App öffnen</a>
          </div>
        </div>
      </body>
    </html>
  `;

  if (currentMailPreviewUrl) {
    URL.revokeObjectURL(currentMailPreviewUrl);
  }
  currentMailPreviewUrl = URL.createObjectURL(new Blob([previewHtml], { type: "text/html" }));
  return currentMailPreviewUrl;
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
    bossComment: escapeHtml(entry.bossComment || "")
  };
  const reportHtml = buildReportHtml(entry);
  const mailDraftUrl = buildMailPreviewUrl(entry);
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

    ${entry.employeeComment ? `<div class="report-preview"><h3>Weitere Informationen</h3><p>${safe.employeeComment}</p></div>` : ""}

    <div class="photo-gallery">
      ${entry.photos.map((photo) => `<img src="${photo.data}" alt="${escapeHtml(photo.name)}">`).join("")}
    </div>

    <label class="review-comment">
      Kommentar Chef
      <textarea id="bossComment" rows="4" ${entry.status === "approved" ? "disabled" : ""}>${safe.bossComment}</textarea>
    </label>

    <div class="report-preview">
      <h3>Kundenbericht</h3>
      ${reportHtml}
    </div>

    <div class="review-actions">
      <a class="secondary-button" id="mailDraftLink" href="${mailDraftUrl}" target="_blank" rel="noopener noreferrer">E-Mail-Entwurf öffnen</a>
      ${entry.status === "approved"
        ? `<button class="secondary-button" id="reopenButton" type="button">Erneut prüfen</button>`
        : `<button class="primary-button" id="approveButton" type="button">Freigeben und Bericht senden</button>`}
      <button class="danger-button" id="deleteButton" type="button">Löschen</button>
    </div>
  `;

  document.getElementById("deleteButton").addEventListener("click", () => deleteChecklist(entry.id));
  const approveButton = document.getElementById("approveButton");
  if (approveButton) approveButton.addEventListener("click", () => approveChecklist(entry.id));
  const reopenButton = document.getElementById("reopenButton");
  if (reopenButton) reopenButton.addEventListener("click", () => reopenChecklist(entry.id));

  const summary = `${done}/${entry.items.length} Prüfpunkte erledigt`;
  el.emailStatus.innerHTML = `<span class="dot"></span>${summary}`;
}

function renderLists() {
  const filter = el.statusFilter.value;
  const customerQuery = el.bossCustomerFilter.value.trim().toLowerCase();
  const projectQuery = el.bossProjectFilter.value.trim().toLowerCase();
  const isChef = currentSession && currentSession.username === "chef";
  const filteredByStatus = filter === "all" ? submissions : submissions.filter((entry) => entry.status === filter);
  const filteredForBoss = isChef
    ? filteredByStatus.filter((entry) => {
      const matchesCustomer = !customerQuery || entry.customerName.toLowerCase().includes(customerQuery);
      const matchesProject = !projectQuery || entry.jobTitle.toLowerCase().includes(projectQuery);
      return matchesCustomer && matchesProject;
    })
    : filteredByStatus;
  const employeeEntries = currentSession && currentSession.role === "employee"
    ? submissions.filter((entry) => (
      entry.employeeUsername
        ? entry.employeeUsername === currentSession.username
        : entry.employeeName === currentSession.label
    ))
    : submissions;
  renderSubmissionList(el.employeeList, employeeEntries, "employee");
  renderSubmissionList(el.bossList, filteredForBoss, "boss");
}

function renderStats() {
  el.statDrafts.textContent = submissions.filter((entry) => entry.status === "draft").length;
  el.statSubmitted.textContent = submissions.filter((entry) => entry.status === "submitted").length;
  el.statApproved.textContent = submissions.filter((entry) => entry.status === "approved").length;
}

function render() {
  if (!currentRole) return;
  renderSectionVisibility();
  renderStats();
  renderLists();
  if (currentRole === "boss") renderReview();
  renderCustomerDb();
  renderCalendarEmployeeOptions();
  renderCalendarCustomerOptions();
  renderCalendar();
  renderWorktimeSummary();
}

function parseTimeToMinutes(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function hasScheduleOverlap(existingEntries, employeeUsername, fromTime, toTime) {
  const nextStart = parseTimeToMinutes(fromTime);
  const nextEnd = parseTimeToMinutes(toTime);
  if (nextStart === null || nextEnd === null || nextEnd <= nextStart) return true;

  return existingEntries.some((entry) => {
    if (entry.employeeUsername !== employeeUsername) return false;
    const start = parseTimeToMinutes(entry.fromTime);
    const end = parseTimeToMinutes(entry.toTime);
    if (start === null || end === null) return false;
    return nextStart < end && nextEnd > start;
  });
}

function getEntryWorkedMinutes(entry) {
  const attendance = entry.attendance || {};
  const start = parseTimeToMinutes(attendance.come);
  const end = parseTimeToMinutes(attendance.leave);
  if (start === null || end === null || end <= start) return 0;

  const breakStart = parseTimeToMinutes(attendance.breakStart);
  const breakEnd = parseTimeToMinutes(attendance.breakEnd);
  const breakMinutes = (breakStart !== null && breakEnd !== null && breakEnd > breakStart) ? breakEnd - breakStart : 0;
  return Math.max(0, end - start - breakMinutes);
}

function getPeriodBounds(scope, dateString) {
  const base = new Date(`${dateString}T00:00:00`);
  if (scope === "day") {
    const end = new Date(base);
    end.setDate(end.getDate() + 1);
    return [base, end];
  }
  if (scope === "week") {
    const day = (base.getDay() + 6) % 7;
    const start = new Date(base);
    start.setDate(start.getDate() - day);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return [start, end];
  }
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return [start, end];
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function renderWorktimeSummary() {
  if (!el.worktimeList || !currentSession || currentSession.username !== "chef") return;

  if (!el.worktimeDate.value) {
    el.worktimeDate.value = toIsoDate(new Date());
  }
  const scope = el.worktimeScope.value;
  const [periodStart, periodEnd] = getPeriodBounds(scope, el.worktimeDate.value);
  const employees = getEmployeeUsers();

  const totals = employees.map((employee) => {
    const total = submissions
      .filter((entry) => {
        const entryDate = new Date(entry.createdAt || entry.submittedAt || Date.now());
        const matchesEmployee = entry.employeeUsername
          ? entry.employeeUsername === employee.username
          : entry.employeeName === employee.label;
        return matchesEmployee && entryDate >= periodStart && entryDate < periodEnd;
      })
      .reduce((sum, entry) => sum + getEntryWorkedMinutes(entry), 0);
    return { label: employee.label, total };
  });

  el.worktimeList.innerHTML = totals.map((row) => `
    <div class="worktime-item">
      <p><strong>${escapeHtml(row.label)}</strong></p>
      <p>Gesamtzeit: ${formatMinutes(row.total)}</p>
    </div>
  `).join("");
  renderCheckpointManager();
}

function renderCustomerDb() {
  if (!el.customerDbList) return;
  if (!customerDb.length) {
    el.customerDbList.innerHTML = `<div class="customer-db-item"><p>Noch keine Kunden erfasst.</p></div>`;
    return;
  }

  el.customerDbList.innerHTML = "";
  customerDb.forEach((entry) => {
    const mapsUrl = buildGoogleMapsUrl(entry.address);
    const customerFullName = `${entry.firstName} ${entry.lastName}`.trim();
    const history = submissions
      .filter((submission) => (
        submission.customerId
          ? submission.customerId === entry.id
          : submission.customerName.trim().toLowerCase() === customerFullName.toLowerCase()
      ))
      .filter((submission) => submission.status === "approved")
      .sort((a, b) => new Date(b.createdAt || b.submittedAt || 0) - new Date(a.createdAt || a.submittedAt || 0));
    const row = document.createElement("div");
    row.className = "customer-db-item";
    const checkpoints = Array.isArray(entry.checkpoints) ? entry.checkpoints : [];
    row.innerHTML = `
      <div>
        <p><strong>${escapeHtml(entry.firstName)} ${escapeHtml(entry.lastName)}</strong></p>
        <small>${escapeHtml(entry.address)} · ${escapeHtml(entry.project)}</small>
        <small>E-Mail: ${escapeHtml(entry.email || "-")} · Tel: ${escapeHtml(entry.phone || "-")}</small>
        <div class="customer-history">
          <strong>Historie freigegebene Checklisten</strong>
          ${history.length
            ? `
              <div class="history-select-row">
                <select data-history-select="${entry.id}">
                  ${history.map((item) => `<option value="${item.id}">${formatDate(item.submittedAt || item.createdAt)} · ${escapeHtml(item.jobTitle)}</option>`).join("")}
                </select>
                <button class="text-button" type="button" data-open-history="${entry.id}">Öffnen</button>
              </div>
            `
            : `<small>Noch keine freigegebene Checkliste vorhanden.</small>`}
        </div>
        <div class="customer-db-actions">
          <a class="text-button" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">In Maps öffnen</a>
          <button class="text-button" type="button" data-toggle-checkpoints="${entry.id}">Prüfpunkte</button>
        </div>
        <div class="customer-checkpoints-list hidden" data-checkpoint-list="${entry.id}">
          ${checkpoints.length
            ? `<ul>${checkpoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>`
            : `<small>Keine Prüfpunkte ausgewählt.</small>`}
        </div>
      </div>
      <div class="customer-db-item-actions">
        <button class="secondary-button" type="button" data-edit-id="${entry.id}">Kunde bearbeiten</button>
        <button class="danger-button" type="button" data-id="${entry.id}">Löschen</button>
      </div>
    `;
    const deleteCustomerButton = row.querySelector('[data-id]');
    if (deleteCustomerButton) deleteCustomerButton.addEventListener("click", () => deleteCustomerEntry(entry.id));
    const editCustomerButton = row.querySelector('[data-edit-id]');
    if (editCustomerButton) editCustomerButton.addEventListener("click", () => startEditCustomerEntry(entry.id));
    const openHistoryButton = row.querySelector('[data-open-history]');
    if (openHistoryButton) openHistoryButton.addEventListener("click", () => {
      const historySelect = row.querySelector(`[data-history-select="${entry.id}"]`);
      const selectedId = historySelect ? historySelect.value : "";
      if (!selectedId) return;
      setActiveSection("checklist");
      selectForReview(selectedId);
    });
    const toggleCheckpointsButton = row.querySelector('[data-toggle-checkpoints]');
    if (toggleCheckpointsButton) toggleCheckpointsButton.addEventListener("click", (event) => {
      const listEl = row.querySelector(`[data-checkpoint-list="${entry.id}"]`);
      if (!listEl) return;
      listEl.classList.toggle("hidden");
      event.currentTarget.textContent = listEl.classList.contains("hidden") ? "Prüfpunkte" : "Prüfpunkte ausblenden";
    });
    el.customerDbList.appendChild(row);
  });
}

function addCustomerEntry(firstName, lastName, address, project, email, phone) {
  customerDb.unshift({
    id: createId(),
    firstName,
    lastName,
    address,
    project,
    email,
    phone,
    checkpoints: getSelectedCustomerCheckpoints()
  });
  persistCustomerDb();
  renderCustomerDb();
  renderCalendarCustomerOptions();
}

function updateCustomerEntry(id, firstName, lastName, address, project, email, phone) {
  const index = customerDb.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const nextCheckpoints = getSelectedCustomerCheckpoints();
  customerDb[index] = {
    ...customerDb[index],
    firstName,
    lastName,
    address,
    project,
    email,
    phone,
    checkpoints: nextCheckpoints
  };
  persistCustomerDb();
  syncDraftSubmissionsForCustomer(id, nextCheckpoints);
  renderCustomerDb();
  renderCalendarCustomerOptions();
}

function startEditCustomerEntry(id) {
  const entry = customerDb.find((item) => item.id === id);
  if (!entry) return;
  activeCustomerDbId = id;
  el.dbFirstName.value = entry.firstName || "";
  el.dbLastName.value = entry.lastName || "";
  el.dbAddress.value = entry.address || "";
  el.dbProject.value = entry.project || "";
  el.dbEmail.value = entry.email || "";
  el.dbPhone.value = entry.phone || "";
  renderCustomerCheckpointOptions(entry.checkpoints || []);
  showToast("Kundendaten zum Bearbeiten geladen.");
}

function deleteCustomerEntry(id) {
  customerDb = customerDb.filter((entry) => entry.id !== id);
  persistCustomerDb();
  renderCustomerDb();
  renderCalendarCustomerOptions();
}

function buildGoogleMapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function createChecklistFromAssignment(entry) {
  const dayEntries = staffSchedule[selectedCalendarDate] || [];
  const target = dayEntries.find((item) => item.id === entry.id);
  if (!target) {
    showToast("Einsatz wurde nicht gefunden.");
    return;
  }
  if (target.inProgress) {
    const existingChecklist = submissions.find((item) => item.assignmentId === target.id);
    if (existingChecklist) {
      setActiveSection("checklist");
      editChecklist(existingChecklist.id);
      showToast("Checkliste wurde geöffnet.");
      return;
    }
    target.inProgress = false;
    persistSchedule();
    renderCalendar();
    showToast("Status korrigiert. Checklist kann erneut gestartet werden.");
    return;
  }

  resetForm();
  activeAssignmentId = target.id;
  activeCustomerId = target.customerId || "";
  employeeChecklistUnlocked = true;
  setActiveSection("checklist");
  el.customerName.value = target.customerName || "";
  const customer = customerDb.find((item) => item.id === (target.customerId || activeCustomerId));
  const customerSpecificItems = customer && Array.isArray(customer.checkpoints) ? customer.checkpoints : [];
  if (!customerSpecificItems.length) {
    showToast("Für diesen Kunden sind keine Prüfpunkte hinterlegt.");
    employeeChecklistUnlocked = false;
    activeAssignmentId = "";
    activeCustomerId = "";
    lockedCustomerName = "";
    resetForm();
    renderSectionVisibility();
    return;
  }
  el.checklistItems.innerHTML = "";
  customerSpecificItems.forEach((item) => addChecklistItem(item));
  if (target.project) {
    el.jobTitle.value = target.project;
  }
  lockedCustomerName = target.customerName || "";
  el.customerName.readOnly = true;
  el.checklistForm.classList.remove("hidden");
  el.employeeChecklistLockedHint.classList.add("hidden");
  el.employeeView.classList.add("active");
  renderSectionVisibility();
  showToast("Neue Checkliste aus Einsatz erstellt.");
}

function resolveCustomerIdByName(customerName) {
  const target = customerName.trim().toLowerCase();
  if (!target) return "";
  const match = customerDb.find((customer) => `${customer.firstName} ${customer.lastName}`.trim().toLowerCase() === target);
  return match ? match.id || "" : "";
}

function markAssignmentInProgress() {
  if (!activeAssignmentId) return;
  const dayEntries = staffSchedule[selectedCalendarDate] || [];
  const target = dayEntries.find((item) => item.id === activeAssignmentId);
  if (!target || target.inProgress) return;
  target.inProgress = true;
  persistSchedule();
  renderCalendar();
}

function renderCalendar() {
  el.calendarGrid.innerHTML = "";
  el.calendarMonthLabel.textContent = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(calendarMonth);
  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  weekdays.forEach((weekday) => {
    const header = document.createElement("div");
    header.className = "calendar-weekday";
    header.textContent = weekday;
    el.calendarGrid.appendChild(header);
  });

  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const leadingEmpty = (firstDay.getDay() + 6) % 7;

  for (let i = 0; i < leadingEmpty; i += 1) {
    const empty = document.createElement("div");
    empty.className = "calendar-cell empty";
    el.calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    const iso = toIsoDate(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `calendar-cell ${iso === selectedCalendarDate ? "active" : ""} ${(staffSchedule[iso] || []).length ? "has-staff" : ""}`;
    button.textContent = String(day);
    button.addEventListener("click", () => {
      selectedCalendarDate = iso;
      renderCalendar();
      renderCalendarStaff();
    });
    el.calendarGrid.appendChild(button);
  }

  renderCalendarStaff();
}

function renderCalendarStaff() {
  const labelDate = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(selectedCalendarDate));
  el.calendarSelectedLabel.textContent = `Einsätze am ${labelDate}`;
  const entriesForDate = staffSchedule[selectedCalendarDate] || [];
  const entries = currentRole === "employee"
    ? entriesForDate.filter((entry) => (
      entry.employeeUsername
        ? entry.employeeUsername === (currentSession ? currentSession.username : "")
        : entry.name === (currentSession ? currentSession.label : "")
    ))
    : entriesForDate;
  const isBoss = currentRole === "boss";
  const sortMode = el.calendarSort.value;
  const sortedEntries = [...entries].sort((a, b) => {
    if (sortMode === "employee-asc") {
      return (a.name || "").localeCompare(b.name || "", "de");
    }
    const aStart = parseTimeToMinutes(a.fromTime) != null ? parseTimeToMinutes(a.fromTime) : 0;
    const bStart = parseTimeToMinutes(b.fromTime) != null ? parseTimeToMinutes(b.fromTime) : 0;
    if (sortMode === "time-desc") return bStart - aStart;
    return aStart - bStart;
  });
  if (!entries.length) {
    el.calendarStaffList.innerHTML = `<div class="staff-item"><span>Keine Mitarbeiter geplant.</span></div>`;
    return;
  }

  el.calendarStaffList.innerHTML = "";
  sortedEntries.forEach((entry) => {
    const customerLine = entry.customerName ? `${entry.customerName} · ${entry.project || "-"}` : "Kunde nicht gesetzt";
    const mapsButton = entry.customerAddress
      ? `<a class="text-button" href="${buildGoogleMapsUrl(entry.customerAddress)}" target="_blank" rel="noopener noreferrer">In Maps öffnen</a>`
      : "";
    const isCompleted = submissions.some((item) => item.assignmentId === entry.id && item.status === "approved");
    const checklistButton = !isBoss
      ? `<button class="primary-button" type="button" data-action="checklist" ${entry.inProgress || isCompleted ? "disabled" : ""}>${isCompleted ? "Abgeschlossen" : (entry.inProgress ? "In Arbeit" : "Checklist")}</button>`
      : "";
    const row = document.createElement("div");
    row.className = `staff-item staff-${entry.employeeUsername || "default"}`;
    row.innerHTML = `
      <div>
        <strong><span class="staff-color-dot"></span>${escapeHtml(entry.name)}</strong>
        <small>${escapeHtml(entry.fromTime || "--:--")} - ${escapeHtml(entry.toTime || "--:--")}</small>
        <small>${escapeHtml(customerLine)}</small>
        ${entry.staffComment ? `<small>Hinweis: ${escapeHtml(entry.staffComment)}</small>` : ""}
        ${entry.customerAddress ? `<small>${escapeHtml(entry.customerAddress)}</small>` : ""}
        ${mapsButton}
      </div>
      ${isBoss ? `<button class="danger-button" type="button" data-id="${entry.id}">Entfernen</button>` : checklistButton}
    `;
    const removeStaffButton = row.querySelector('[data-id]');
    if (removeStaffButton) removeStaffButton.addEventListener("click", () => removeStaffEntry(entry.id));
    const checklistActionButton = row.querySelector('[data-action="checklist"]');
    if (checklistActionButton) checklistActionButton.addEventListener("click", () => {
      if (checklistActionButton.disabled) return;
      createChecklistFromAssignment(entry);
    });
    el.calendarStaffList.appendChild(row);
  });
}

function addStaffEntry(employeeUsername, fromTime, toTime, customerId, staffComment) {
  const employee = getEmployeeUsers().find((item) => item.username === employeeUsername);
  if (!employee) {
    showToast("Bitte einen Mitarbeiter auswählen.");
    return false;
  }

  const customer = customerDb.find((entry) => entry.id === customerId);
  if (!customer) {
    showToast("Bitte einen Kunden aus der Datenbank auswählen.");
    return false;
  }
  if (!Array.isArray(customer.checkpoints) || !customer.checkpoints.length) {
    showToast("Bitte zuerst Prüfpunkte beim Kunden hinterlegen.");
    return false;
  }

  const list = staffSchedule[selectedCalendarDate] || [];
  if (hasScheduleOverlap(list, employee.username, fromTime, toTime)) {
    showToast("Fehler: Terminüberschneidung für diesen Mitarbeiter.");
    return false;
  }

  list.push({
    id: createId(),
    employeeUsername: employee.username,
    name: employee.label,
    fromTime,
    toTime,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`,
    customerAddress: customer.address,
    project: customer.project,
    staffComment: staffComment || ""
  });
  staffSchedule[selectedCalendarDate] = list;
  persistSchedule();
  renderCalendar();
  return true;
}

function renderCalendarCustomerOptions() {
  if (!el.calendarCustomerSelect) return;
  const previousValue = el.calendarCustomerSelect.value;
  el.calendarCustomerSelect.innerHTML = `<option value="">Kunde auswählen</option>`;
  customerDb.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = `${entry.firstName} ${entry.lastName} - ${entry.project}`;
    el.calendarCustomerSelect.appendChild(option);
  });
  if (customerDb.some((entry) => entry.id === previousValue)) {
    el.calendarCustomerSelect.value = previousValue;
  }
}

function renderCalendarEmployeeOptions() {
  if (!el.calendarEmployeeSelect) return;
  const previousValue = el.calendarEmployeeSelect.value;
  el.calendarEmployeeSelect.innerHTML = `<option value="">Mitarbeiter wählen</option>`;
  getEmployeeUsers().forEach((employee) => {
    const option = document.createElement("option");
    option.value = employee.username;
    option.textContent = employee.label;
    el.calendarEmployeeSelect.appendChild(option);
  });
  if (getEmployeeUsers().some((employee) => employee.username === previousValue)) {
    el.calendarEmployeeSelect.value = previousValue;
  }
}

function removeStaffEntry(id) {
  const list = staffSchedule[selectedCalendarDate] || [];
  staffSchedule[selectedCalendarDate] = list.filter((entry) => entry.id !== id);
  if (!staffSchedule[selectedCalendarDate].length) {
    delete staffSchedule[selectedCalendarDate];
  }
  persistSchedule();
  renderCalendar();
}

el.addItemButton.addEventListener("click", () => addChecklistItem());
el.photoInput.addEventListener("change", (event) => handlePhotoUpload(event.target.files));
el.checklistForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveChecklist("submitted");
});
el.saveDraftButton.addEventListener("click", () => saveChecklist("draft"));
el.newChecklistButton.addEventListener("click", () => {
  if (currentRole === "employee") return;
  resetForm();
});
el.statusFilter.addEventListener("change", renderLists);
el.bossCustomerFilter.addEventListener("input", renderLists);
el.bossProjectFilter.addEventListener("input", renderLists);
el.calendarPrev.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
});
el.calendarNext.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
});
el.calendarStaffForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const created = addStaffEntry(
    el.calendarEmployeeSelect.value,
    el.calendarFromTime.value,
    el.calendarToTime.value,
    el.calendarCustomerSelect.value,
    el.calendarStaffComment.value.trim()
  );
  if (created) {
    el.calendarStaffForm.reset();
    renderCalendarCustomerOptions();
    renderCalendarEmployeeOptions();
    calendarPlanningOpen = false;
    el.calendarStaffForm.classList.add("hidden");
  }
});
if (el.calendarSort) el.calendarSort.addEventListener("change", renderCalendarStaff);
if (el.calendarNewAssignmentButton) el.calendarNewAssignmentButton.addEventListener("click", () => {
  if (currentRole !== "boss") return;
  calendarPlanningOpen = true;
  el.calendarStaffForm.classList.remove("hidden");
  el.calendarStaffForm.reset();
  renderCalendarCustomerOptions();
  renderCalendarEmployeeOptions();
  el.calendarEmployeeSelect.focus();
});
el.customerDbForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = [
    el.dbFirstName.value.trim(),
    el.dbLastName.value.trim(),
    el.dbAddress.value.trim(),
    el.dbProject.value.trim(),
    el.dbEmail.value.trim(),
    el.dbPhone.value.trim()
  ];
  if (activeCustomerDbId) {
    updateCustomerEntry(activeCustomerDbId, ...values);
    showToast("Kundendaten aktualisiert.");
  } else {
    addCustomerEntry(...values);
    showToast("Kunde gespeichert.");
  }
  resetCustomerDbForm();
});
if (el.worktimeScope) el.worktimeScope.addEventListener("change", renderWorktimeSummary);
if (el.worktimeDate) el.worktimeDate.addEventListener("change", renderWorktimeSummary);
if (el.checkpointForm) el.checkpointForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (saveCheckpoint(el.checkpointName.value)) {
    resetCheckpointForm();
  }
});
if (el.comeButton) el.comeButton.addEventListener("click", () => setEmployeeTime("come"));
if (el.breakStartButton) el.breakStartButton.addEventListener("click", () => setEmployeeTime("breakStart"));
if (el.breakEndButton) el.breakEndButton.addEventListener("click", () => setEmployeeTime("breakEnd"));
if (el.leaveButton) el.leaveButton.addEventListener("click", () => setEmployeeTime("leave"));
el.moduleTabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveSection(button.dataset.section));
});
el.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login(el.loginUsername.value.trim(), el.loginPassword.value);
});
el.logoutButton.addEventListener("click", logout);

resetForm();
renderCustomerCheckpointOptions([]);
renderCheckpointManager();
if (currentSession && users.some((user) => user.username === currentSession.username && user.role === currentSession.role)) {
  el.sessionUser.textContent = `${currentSession.label} (${currentSession.username})`;
  el.authScreen.classList.add("hidden");
  el.appShell.classList.remove("hidden");
  setRole(currentSession.role);
} else {
  persistSession(null);
}

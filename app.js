const storageKey = "werkstattcheck-submissions-v1";
const dailyAttendanceKey = "werkstattcheck-daily-attendance-v1";
const sessionKey = "werkstattcheck-session-v1";
const scheduleKey = "werkstattcheck-staff-schedule-v1";
const recurringScheduleRulesKey = "werkstattcheck-recurring-schedule-rules-v1";
const workOrdersStateKey = "werkstattcheck-work-orders-v1";
const WORK_ORDER_ASSIGNMENT_KIND = "workOrder";
const WORK_ORDER_MAX_CHEF_PHOTOS = 3;
const WORK_ORDER_MAX_RESULT_PHOTOS = 5;
const customerDbKey = "werkstattcheck-customer-db-v1";
const guideDbKey = "werkstattcheck-guide-db-v1";
const GUIDE_PDF_LANGS = ["de", "en", "es"];
const CUSTOMER_STATUS_ACTIVE = "active";
const CUSTOMER_STATUS_INACTIVE = "inactive";
const checkpointCatalogKey = "werkstattcheck-checkpoint-catalog-v1";
const checklistTemplatesKey = "werkstattcheck-checklist-templates-v2";
const HAUS_CHECKLIST_TEMPLATE_ID = "haus_garten";
const PUTZ_CHECKLIST_TEMPLATE_ID = "putzplan_haus";
/** Nur „Haus & Garten“: Prüfpunkte sind einem Bereich zugeordnet (Persistenz im Vorlagen-Array). */
const HAUS_CHECKPOINT_ZONE_IDS = ["general", "pool", "zone_1", "zone_2", "zone_3", "zone_4"];
const DEFAULT_HAUS_CHECKPOINT_ZONE = "general";
/** Speicher-/Formularschlüssel: zone::kanonischer Text (gleicher Text in mehreren Bereichen möglich). */
const HAUS_CHECKPOINT_ROW_KEY_SEP = "::";
/** Select-Optionen neu bauen, wenn sich die Bereichsliste ändert (Cache `dataset.ready` reicht nicht). */
const HAUS_CHECKPOINT_ZONE_SELECT_BUILD = "v2-general";
const fallbackCheckpointItems = [
  "Pflanzen und Hecken geschnitten",
  "Rasen gemäht",
  "Haus sauber und zur Anreise bereit",
  "Pool sauber",
  "Pool Werte ideal",
  "Fenster gereinigt"
];
const putzplanCheckpointDefaults = [
  "Küche gereinigt (Oberflächen, Herd)",
  "Bäder und WC geputzt",
  "Böden gesaugt und gewischt",
  "Staub entfernen in allen Bereichen",
  "Müll und Behälter entsorgt, Verbrauchsmaterial ergänzt"
];
const users = [
  { username: "chef", password: "123", role: "boss", label: "Chef" },
  { username: "patrick", password: "123", role: "employee", label: "Patrick" },
  { username: "souhail", password: "123", role: "employee", label: "Souhail" },
  { username: "mohammed", password: "123", role: "employee", label: "Mohammed" },
  { username: "reinigungspaar", password: "123", role: "employee", label: "Reinigungspaar" },
  {
    username: "kristina",
    password: "123",
    role: "boss",
    label: "Kristina",
    manageEmployeeUsernames: ["reinigungspaar"],
    allowedChecklistTemplateIds: [PUTZ_CHECKLIST_TEMPLATE_ID]
  }
];

function enrichCurrentSessionFromUsers() {
  if (!currentSession) return;
  const u = users.find((x) => x.username === currentSession.username && x.role === currentSession.role);
  if (!u) return;
  currentSession.label = u.label;
  if (Array.isArray(u.manageEmployeeUsernames) && u.manageEmployeeUsernames.length) {
    currentSession.manageEmployeeUsernames = u.manageEmployeeUsernames.slice();
  } else {
    delete currentSession.manageEmployeeUsernames;
  }
  if (Array.isArray(u.allowedChecklistTemplateIds) && u.allowedChecklistTemplateIds.length) {
    currentSession.allowedChecklistTemplateIds = u.allowedChecklistTemplateIds.slice();
  } else {
    delete currentSession.allowedChecklistTemplateIds;
  }
}

function getAllowedChecklistTemplateIdsForSession() {
  if (!currentSession) return null;
  const fromSession = currentSession.allowedChecklistTemplateIds;
  if (Array.isArray(fromSession) && fromSession.length) {
    return fromSession.filter((id) => checklistTemplates.some((t) => t.id === id));
  }
  const u = users.find((x) => x.username === currentSession.username && x.role === currentSession.role);
  if (u && Array.isArray(u.allowedChecklistTemplateIds) && u.allowedChecklistTemplateIds.length) {
    return u.allowedChecklistTemplateIds.filter((id) => checklistTemplates.some((t) => t.id === id));
  }
  return null;
}

function sessionMayAccessChecklistTemplate(templateId) {
  const allowed = getAllowedChecklistTemplateIdsForSession();
  if (!allowed) return true;
  return allowed.includes(String(templateId || "").trim());
}

function getChecklistTemplatesForSession() {
  const allowed = getAllowedChecklistTemplateIdsForSession();
  if (!allowed) return checklistTemplates;
  return checklistTemplates.filter((t) => allowed.includes(t.id));
}

function getDefaultChecklistTemplateIdForSession() {
  const allowed = getAllowedChecklistTemplateIdsForSession();
  if (allowed && allowed.length) return allowed[0];
  return HAUS_CHECKLIST_TEMPLATE_ID;
}

function isFullChefSession() {
  return Boolean(currentSession && currentSession.username === "chef");
}

function getManagedEmployeeUsernamesForSession() {
  if (!currentSession || currentSession.role !== "boss") return null;
  const arr = currentSession.manageEmployeeUsernames;
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr;
}

function isRestrictedBossSession() {
  return getManagedEmployeeUsernamesForSession() != null;
}

function submissionBelongsToManagedEmployee(entry) {
  const managed = getManagedEmployeeUsernamesForSession();
  if (!managed) return true;
  const u = entry.employeeUsername;
  if (u) return managed.includes(u);
  const label = String(entry.employeeName || "").trim();
  return getEmployeeUsers().some((e) => managed.includes(e.username) && e.label === label);
}

function filterScheduleEntriesForBossViewer(entries) {
  if (!entries || !entries.length) return entries;
  if (!isRestrictedBossSession()) return entries;
  const m = getManagedEmployeeUsernamesForSession();
  if (!m || !m.length) return [];
  return entries.filter((e) => e.employeeUsername && m.includes(e.employeeUsername));
}

function getCalendarSelectableEmployees() {
  const all = getEmployeeUsers();
  if (!isRestrictedBossSession()) return all;
  const m = getManagedEmployeeUsernamesForSession();
  if (!m || !m.length) return [];
  return all.filter((e) => m.includes(e.username));
}

function bossMayManageAssignmentEmployee(employeeUsername) {
  if (!isRestrictedBossSession()) return true;
  const m = getManagedEmployeeUsernamesForSession();
  return Boolean(employeeUsername && m && m.includes(employeeUsername));
}

function isWorkOrderManagementViewer() {
  return isFullChefSession() || isRestrictedBossSession();
}

function assertBossMayAccessSubmission(entry) {
  if (!entry || currentRole !== "boss") return true;
  const tplId = entry.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID;
  if (!sessionMayAccessChecklistTemplate(tplId)) return false;
  if (!isRestrictedBossSession()) return true;
  return submissionBelongsToManagedEmployee(entry);
}

function submissionsVisibleToCurrentBoss() {
  if (!currentSession || currentSession.role !== "boss") return submissions;
  let pool = submissions;
  if (getAllowedChecklistTemplateIdsForSession()) {
    pool = pool.filter((entry) => sessionMayAccessChecklistTemplate(entry.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID));
  }
  if (isRestrictedBossSession()) {
    pool = pool.filter(submissionBelongsToManagedEmployee);
  }
  return pool;
}

const WC = typeof window !== "undefined" ? window.WerkstattCheckI18n : null;
const t = (key, vars) => (WC ? WC.t(key, vars) : key);
function intlLocaleSafe() {
  return WC ? WC.intlLocale() : "de-DE";
}
function intlLangSafe() {
  return WC ? WC.intlLang() : "de";
}

/** Parst Benutzereingaben wie `12,50`, `12.50`, `1.234,56 €`. */
function parseEuroAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/\s/g, "").replace(/€/g, "").replace(/EUR/gi, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function formatEuroCustomerAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat(intlLocaleSafe(), { style: "currency", currency: "EUR" }).format(n);
  } catch (e) {
    return `${n.toFixed(2)} €`;
  }
}

function formatMonthKeyForFilterLabel(monthKey) {
  const parts = String(monthKey || "").split("-");
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return monthKey;
  const d = new Date(y, mo - 1, 1);
  try {
    return new Intl.DateTimeFormat(intlLocaleSafe(), { month: "long", year: "numeric" }).format(d);
  } catch (e) {
    return monthKey;
  }
}

function collectLedgerMonthKeysForCustomer(customerEntry) {
  const ledger = Array.isArray(customerEntry.extraCostLedger) ? customerEntry.extraCostLedger : [];
  const set = new Set();
  ledger.forEach((row) => {
    if (row && row.monthKey) set.add(row.monthKey);
  });
  return [...set].sort().reverse();
}

function dateToMonthKey(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoDateToMonthKey(isoDate) {
  const s = String(isoDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  return "";
}

function resolveSubmissionCustomerId(submission) {
  const cid = submission && submission.customerId ? String(submission.customerId).trim() : "";
  if (cid) return cid;
  const name = submission && submission.customerName ? String(submission.customerName).trim().toLowerCase() : "";
  if (!name) return "";
  const hit = customerDb.find((c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === name);
  return hit ? hit.id : "";
}

function resolveSubmissionAssignmentDateIso(submission) {
  const aid = String(submission && submission.assignmentId || "").trim();
  if (!aid) return "";
  const keys = Object.keys(staffSchedule);
  for (let i = 0; i < keys.length; i += 1) {
    const dateIso = keys[i];
    const day = staffSchedule[dateIso];
    if (!Array.isArray(day)) continue;
    if (day.some((e) => e && e.id === aid && !isRecurringOccurrenceSkipEntry(e))) return dateIso;
  }
  return "";
}

function getSubmissionWorkTimeMonthKey(submission) {
  const fromAssignment = isoDateToMonthKey(resolveSubmissionAssignmentDateIso(submission));
  if (fromAssignment) return fromAssignment;
  return dateToMonthKey(submission.submittedAt || submission.createdAt || 0);
}

/** Netto-Minuten aus Checklisten- und Arbeitsauftrags-Zeitstempeln, allen MA summiert. */
function collectAllCustomerWorkTimeRecords() {
  const records = [];
  submissions.forEach((sub) => {
    const minutes = getChecklistAttendanceNetMinutes(sub);
    if (minutes <= 0) return;
    const customerId = resolveSubmissionCustomerId(sub);
    if (!customerId) return;
    const assignmentDate = resolveSubmissionAssignmentDateIso(sub);
    const dateIso = assignmentDate || toIsoDate(new Date(sub.submittedAt || sub.createdAt || Date.now()));
    const monthKey = getSubmissionWorkTimeMonthKey(sub);
    if (!monthKey) return;
    records.push({
      customerId,
      monthKey,
      dateIso,
      minutes,
      source: "checklist",
      employeeLabel: String(sub.employeeName || sub.employeeUsername || "").trim() || t("sub.employeeDefault"),
      detail: String(sub.checklistTemplateName || sub.jobTitle || "").trim() || t("sub.tplFallback")
    });
  });

  collectWorkOrderRowsForViewer().forEach((row) => {
    const minutes = getWorkOrderAttendanceNetMinutes(row.stateRow);
    if (minutes <= 0) return;
    const customerId = String(row.entry.customerId || "").trim();
    if (!customerId) return;
    const dateIso = String(row.dateIso || "").trim();
    const monthKey = isoDateToMonthKey(dateIso);
    if (!monthKey) return;
    const empUser = row.entry.employeeUsername || "";
    records.push({
      customerId,
      monthKey,
      dateIso,
      minutes,
      source: "workorder",
      employeeLabel: getEmployeeLabelByUsername(empUser) || row.entry.name || empUser || t("sub.employeeDefault"),
      detail: t("wo.calRowType")
    });
  });

  return records;
}

function collectCustomerWorkTimeMonthKeys(customerId, allRecords) {
  const set = new Set();
  allRecords.forEach((r) => {
    if (r.customerId === customerId && r.monthKey) set.add(r.monthKey);
  });
  return [...set].sort().reverse();
}

/**
 * Prüfpunkt mit de/en. Strings werden dupliziert.
 * Objekte mit explicit:true: keine Auffüllung leerer Seiten (Vorlage + Formular zweispaltig).
 */
function normalizeCheckpointDef(raw, opts) {
  const explicit = Boolean(opts && opts.explicit);
  if (raw == null) return { de: "", en: "" };
  if (typeof raw === "string") {
    const s = raw.trim();
    return { de: s, en: s };
  }
  if (typeof raw === "object") {
    const de = String(raw.de != null ? raw.de : "").trim();
    const en = String(raw.en != null ? raw.en : "").trim();
    const legacy = String(raw.text != null ? raw.text : "").trim();
    if (explicit) {
      if (de || en) return { de, en };
      const base = legacy;
      return { de: base, en: base };
    }
    const base = de || en || legacy;
    return {
      de: de || base,
      en: en || base
    };
  }
  return { de: "", en: "" };
}

function checkpointCanonical(raw) {
  if (typeof raw === "string") return raw.trim();
  const n = normalizeCheckpointDef(raw, { explicit: true });
  return n.de || n.en || "";
}

function checkpointLabelForDef(raw) {
  const n = typeof raw === "string"
    ? normalizeCheckpointDef(raw)
    : normalizeCheckpointDef(raw, { explicit: true });
  const lang = intlLangSafe();
  return lang === "en" ? (n.en || n.de) : (n.de || n.en);
}

/** Übersichtslisten im Chefbereich: „Deutsch / Englisch“ (nur Deutsch/Englisch einzeln wenn jeweils der andere Teil fehlt). */
function checkpointDefLabelDeSlashEn(raw) {
  const n = normalizeCheckpointDef(raw, { explicit: true });
  const d = n.de.trim();
  const e = n.en.trim();
  if (d && e) {
    return d === e ? d : `${d} / ${e}`;
  }
  return d || e || checkpointCanonical(raw) || "";
}

function isHausCheckpointZoneId(z) {
  return HAUS_CHECKPOINT_ZONE_IDS.includes(String(z || "").trim());
}

function inferHausZoneFromCheckpointLocales(loc) {
  const n = normalizeCheckpointDef(loc, { explicit: true });
  const blob = `${n.de} ${n.en}`.toLowerCase();
  if (blob.includes("pool")) return "pool";
  if (/\ballgemein\b/.test(blob) || /\bgeneral\b/.test(blob)) return "general";
  return DEFAULT_HAUS_CHECKPOINT_ZONE;
}

function hausCheckpointZoneFromDef(def) {
  if (def && typeof def === "object" && !Array.isArray(def)) {
    const z = String(def.zone || "").trim();
    if (isHausCheckpointZoneId(z)) return z;
  }
  const loc = normalizeCheckpointDef(def, { explicit: true });
  return inferHausZoneFromCheckpointLocales(loc);
}

function hausCheckpointRowKey(def) {
  const canon = checkpointCanonical(def);
  if (!canon) return "";
  return `${hausCheckpointZoneFromDef(def)}${HAUS_CHECKPOINT_ROW_KEY_SEP}${canon}`;
}

function parseHausCheckpointStoredKey(key) {
  const s = String(key || "").trim();
  const sep = HAUS_CHECKPOINT_ROW_KEY_SEP;
  const i = s.indexOf(sep);
  if (i < 0) return { zone: null, canon: s };
  const zone = s.slice(0, i);
  const canon = s.slice(i + sep.length);
  if (!isHausCheckpointZoneId(zone) || !canon) return { zone: null, canon: s };
  return { zone, canon };
}

function hausStoredKeyMatchesDef(storedKey, def) {
  const sk = String(storedKey || "").trim();
  if (!sk) return false;
  if (sk === hausCheckpointRowKey(def)) return true;
  const parsed = parseHausCheckpointStoredKey(sk);
  if (parsed.zone) {
    return parsed.zone === hausCheckpointZoneFromDef(def) && parsed.canon === checkpointCanonical(def);
  }
  return parsed.canon === checkpointCanonical(def);
}

function hausStoredKeySetHasDef(keySet, def) {
  const set = keySet instanceof Set ? keySet : new Set(keySet);
  for (const k of set) {
    if (hausStoredKeyMatchesDef(k, def)) return true;
  }
  return false;
}

function normalizeHausCustomerCheckpointKeysForSave(keys, template) {
  const cps = (template && template.checkpoints) || [];
  const out = [];
  const seen = new Set();
  (keys || []).forEach((key) => {
    const sk = String(key || "").trim();
    if (!sk) return;
    const parsed = parseHausCheckpointStoredKey(sk);
    if (parsed.zone) {
      if (!seen.has(sk)) {
        seen.add(sk);
        out.push(sk);
      }
      return;
    }
    cps.forEach((def) => {
      if (checkpointCanonical(def) !== parsed.canon) return;
      const rk = hausCheckpointRowKey(def);
      if (rk && !seen.has(rk)) {
        seen.add(rk);
        out.push(rk);
      }
    });
  });
  return out;
}

/**
 * Zeile in einer Checklisten-Vorlage: für „Haus & Garten“ immer { de, en, zone },
 * sonst nur zweisprachige Locales (wie bisher).
 */
function normalizeTemplateCheckpointRow(item, templateId) {
  const tid = String(templateId || "").trim();
  if (typeof item === "string") {
    const loc = normalizeCheckpointDef(item);
    if (!(loc.de || loc.en)) return null;
    if (tid === HAUS_CHECKLIST_TEMPLATE_ID) {
      const zone = inferHausZoneFromCheckpointLocales(loc);
      return Object.assign({}, loc, { zone });
    }
    return loc;
  }
  const loc = normalizeCheckpointDef(item, { explicit: true });
  if (!(loc.de || loc.en)) return null;
  if (tid !== HAUS_CHECKLIST_TEMPLATE_ID) {
    return loc;
  }
  let zone = item && typeof item === "object" && !Array.isArray(item) ? String(item.zone || "").trim() : "";
  if (!isHausCheckpointZoneId(zone)) zone = inferHausZoneFromCheckpointLocales(loc);
  return Object.assign({}, loc, { zone });
}

function hausCheckpointsNeedZonePersist(checkpoints) {
  if (!Array.isArray(checkpoints)) return false;
  return checkpoints.some((item) => {
    if (typeof item === "string") return true;
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return !isHausCheckpointZoneId(item.zone);
  });
}

function ensureHausGartenCheckpointZonesPersisted(normalizedTemplates, rawTemplates) {
  const rawHaus = Array.isArray(rawTemplates)
    ? rawTemplates.find((r) => r && r.id === HAUS_CHECKLIST_TEMPLATE_ID)
    : null;
  const rawCps = rawHaus && Array.isArray(rawHaus.checkpoints) ? rawHaus.checkpoints : null;
  if (!rawCps || !rawCps.length) return;
  if (!hausCheckpointsNeedZonePersist(rawCps)) return;
  bossChecklistFilterSignature = "";
  localStorage.setItem(checklistTemplatesKey, JSON.stringify(normalizedTemplates));
}

function hausZoneGroupTitle(zoneId) {
  const z = String(zoneId || "").trim();
  const keys = {
    general: "zone.general",
    pool: "zone.pool",
    zone_1: "zone.z1",
    zone_2: "zone.z2",
    zone_3: "zone.z3",
    zone_4: "zone.z4",
    other: "zone.other"
  };
  return t(keys[z] || "zone.other");
}

function createChecklistZoneGroupShell(zoneId) {
  const wrap = document.createElement("div");
  wrap.className = "checklist-zone-group";
  const title = document.createElement("h4");
  title.className = "checklist-zone-title";
  title.textContent = hausZoneGroupTitle(zoneId);
  const inner = document.createElement("div");
  inner.className = "checklist-zone-items";
  wrap.appendChild(title);
  wrap.appendChild(inner);
  return { wrap, inner };
}

/** filterCanonSet: Set von Kanon-Schlüsseln oder null = alle Punkte der Vorlage */
function appendHausGroupedChecklistItemRows(targetEl, tmpl, filterCanonSet) {
  if (!targetEl || !tmpl) return;
  const wanted = filterCanonSet instanceof Set ? filterCanonSet : null;
  HAUS_CHECKPOINT_ZONE_IDS.forEach((zoneId) => {
    const zoneDefs = (tmpl.checkpoints || []).filter((def) => {
      if (hausCheckpointZoneFromDef(def) !== zoneId) return false;
      if (wanted && !hausStoredKeySetHasDef(wanted, def)) return false;
      return true;
    });
    if (!zoneDefs.length) return;
    const { wrap, inner } = createChecklistZoneGroupShell(zoneId);
    targetEl.appendChild(wrap);
    zoneDefs.forEach((def) => {
      addChecklistItem(def, false, "", null, hausCheckpointRowKey(def), inner);
    });
  });
}

function appendHausGroupedSubmissionChecklistRows(targetEl, tmpl, entryItems) {
  if (!targetEl || !tmpl || !Array.isArray(entryItems)) return;
  const byCanon = new Map();
  entryItems.forEach((it) => {
    const c = String(it.checkpointCanon || "").trim()
      || checkpointCanonical(it.locales || it.text)
      || String(it.text || "").trim();
    if (c) byCanon.set(c, it);
  });
  const used = new Set();
  HAUS_CHECKPOINT_ZONE_IDS.forEach((zoneId) => {
    const zoneDefs = (tmpl.checkpoints || []).filter((def) => hausCheckpointZoneFromDef(def) === zoneId);
    const innerPairs = [];
    zoneDefs.forEach((def) => {
      const rowKey = hausCheckpointRowKey(def);
      const canon = checkpointCanonical(def);
      const row = byCanon.get(rowKey) || byCanon.get(canon);
      if (!row) return;
      innerPairs.push({ row, rowKey });
    });
    if (!innerPairs.length) return;
    const { wrap, inner } = createChecklistZoneGroupShell(zoneId);
    targetEl.appendChild(wrap);
    innerPairs.forEach(({ row, rowKey }) => {
      used.add(rowKey);
      const stored = String(row.checkpointCanon || "").trim();
      if (stored) used.add(stored);
      addChecklistItem(row.locales || row.text, row.checked, row.comment || "", row.photo || null, rowKey, inner);
    });
  });
  const orphans = entryItems.filter((it) => {
    const c = String(it.checkpointCanon || "").trim()
      || checkpointCanonical(it.locales || it.text)
      || String(it.text || "").trim();
    return c && !used.has(c);
  });
  if (!orphans.length) return;
  const { wrap, inner } = createChecklistZoneGroupShell("other");
  targetEl.appendChild(wrap);
  orphans.forEach((row) => {
    const c = String(row.checkpointCanon || "").trim()
      || checkpointCanonical(row.locales || row.text)
      || String(row.text || "").trim();
    addChecklistItem(row.locales || row.text, row.checked, row.comment || "", row.photo || null, c, inner);
  });
}

function getChecklistFormParentForNewItem() {
  const tid = getActiveChecklistFormTemplateIdFromUi();
  if (tid !== HAUS_CHECKLIST_TEMPLATE_ID || !el.checklistItems) return el.checklistItems;
  const zones = [...el.checklistItems.querySelectorAll(".checklist-zone-items")];
  if (zones.length) return zones[zones.length - 1];
  return el.checklistItems;
}

function itemDisplayLabelFromLocales(localesObj) {
  return checkpointLabelForDef(localesObj);
}

function itemDisplayFromStored(subItem) {
  if (subItem && subItem.locales && typeof subItem.locales === "object") {
    return itemDisplayLabelFromLocales(subItem.locales);
  }
  return checkpointLabelForDef(subItem && subItem.text != null ? subItem.text : "");
}

/** Anzeigelabel gespeicherter Checkpoint-Zeilen: Locales mit Vorlage zusammenführen (wie im Formular). */
function itemDisplayForSubmissionItem(subItem, templateId) {
  if (!subItem) return "";
  const tid = templateId || HAUS_CHECKLIST_TEMPLATE_ID;
  const canon = String(subItem.checkpointCanon || "").trim()
    || checkpointCanonical(subItem.locales || subItem.text)
    || String(subItem.text || "").trim();
  const locObj = subItem.locales && typeof subItem.locales === "object" ? subItem.locales : null;
  const merged = mergeStoredCheckpointLocales(canon, locObj, tid);
  return itemDisplayLabelFromLocales(merged);
}

function parseLocalesArg(first) {
  if (first && typeof first === "object" && !Array.isArray(first) && (first.de != null || first.en != null)) {
    return normalizeCheckpointDef(first, { explicit: true });
  }
  return normalizeCheckpointDef(first);
}

function resolveLocalesFromTemplateCanon(templateId, canon) {
  const key = String(canon || "").trim();
  if (!key) return normalizeCheckpointDef("");
  const tmpl = getChecklistTemplateById(templateId);
  if (!tmpl || !Array.isArray(tmpl.checkpoints)) return normalizeCheckpointDef(key);
  if (templateId === HAUS_CHECKLIST_TEMPLATE_ID) {
    const parsed = parseHausCheckpointStoredKey(key);
    if (parsed.zone) {
      const zHit = tmpl.checkpoints.find((def) => (
        hausCheckpointZoneFromDef(def) === parsed.zone && checkpointCanonical(def) === parsed.canon
      ));
      if (zHit) return normalizeCheckpointDef(zHit, { explicit: true });
    }
    const canonHits = tmpl.checkpoints.filter((def) => checkpointCanonical(def) === parsed.canon);
    if (canonHits.length >= 1) return normalizeCheckpointDef(canonHits[0], { explicit: true });
  }
  const hit = tmpl.checkpoints.find((def) => checkpointCanonical(def) === key);
  return hit ? normalizeCheckpointDef(hit, { explicit: true }) : normalizeCheckpointDef(key);
}

function getActiveChecklistFormTemplateIdFromUi() {
  if (el.checklistTemplateSelect && !el.checklistTemplateSelect.disabled && el.checklistTemplateSelect.value) {
    return el.checklistTemplateSelect.value;
  }
  return activeFormChecklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID;
}

/**
 * Kombiniert gespeicherte Locales mit der zweisprachigen Vorlage (Lücken wie en aus Vorlage).
 * Wenn gespeicherter Eintrag noch de/en gleich dupliziert hat: Englisch aus Vorlage nutzen.
 */
function mergeStoredCheckpointLocales(canonRaw, localesOrNull, templateId) {
  const tid = templateId || HAUS_CHECKLIST_TEMPLATE_ID;
  const canon = String(canonRaw || "").trim();
  const tpl = canon ? resolveLocalesFromTemplateCanon(tid, canon) : { de: "", en: "" };
  const curRaw = localesOrNull && typeof localesOrNull === "object"
    ? normalizeCheckpointDef(localesOrNull, { explicit: true })
    : { de: "", en: "" };
  const dRaw = curRaw.de.trim();
  const eRaw = curRaw.en.trim();
  const mirroredLegacy = Boolean(dRaw && eRaw && dRaw === eRaw);
  const curEnEffective = mirroredLegacy ? "" : eRaw;
  return normalizeCheckpointDef({
    de: dRaw || tpl.de.trim(),
    en: curEnEffective || tpl.en.trim()
  }, { explicit: true });
}

function mergeCheckpointRowLocalesWithTemplate(row) {
  return mergeStoredCheckpointLocales(
    row.dataset.checkpointCanon || "",
    row._itemLocales || null,
    getActiveChecklistFormTemplateIdFromUi()
  );
}

function checkpointFormMarkUiLangBaseline() {
  checkpointFormSyncedUiLang = intlLangSafe();
}

/** Schreibt den aktuellen Spantext in das angegebene Sprachfeld von _itemLocales (nach Merge mit Vorlage). */
function syncCheckpointItemLocalesIntoLangSlot(lang) {
  if (!el.checklistItems || (lang !== "de" && lang !== "en")) return;
  [...el.checklistItems.querySelectorAll(".check-item")].forEach((row) => {
    const span = row.querySelector(".checkbox-line span");
    if (!span) return;
    const merged = mergeCheckpointRowLocalesWithTemplate(row);
    const edited = span.textContent.trim();
    row._itemLocales = normalizeCheckpointDef(
      Object.assign({}, merged, { [lang]: edited }),
      { explicit: true }
    );
  });
}

function refreshChecklistFormItemLabels() {
  if (!el.checklistItems) return;
  [...el.checklistItems.querySelectorAll(".check-item")].forEach((row) => {
    const span = row.querySelector(".checkbox-line span");
    if (!span) return;
    row._itemLocales = mergeCheckpointRowLocalesWithTemplate(row);
    const display = itemDisplayLabelFromLocales(row._itemLocales).trim();
    span.textContent = display || t("chk.newItemDefault");
  });
}

function normalizeChecklistTemplatesFromStorage(parsed) {
  if (!Array.isArray(parsed)) return null;
  return parsed.map((raw) => {
    const tplId = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
    const checkpoints = Array.isArray(raw.checkpoints)
      ? raw.checkpoints
          .map((item) => normalizeTemplateCheckpointRow(item, tplId))
          .filter((pair) => pair && (pair.de || pair.en))
      : [];
    const assigned = Array.isArray(raw.assignedEmployeeUsernames)
      ? raw.assignedEmployeeUsernames.filter((item) => typeof item === "string" && item.trim())
      : [];
    return {
      id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `tpl-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Checkliste",
      checkpoints,
      assignedEmployeeUsernames: assigned
    };
  }).filter((item) => item.id && item.name);
}

function loadLegacyCheckpointCatalogForMigration() {
  const stored = localStorage.getItem(checkpointCatalogKey);
  if (!stored) return [...fallbackCheckpointItems];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.length) return [...fallbackCheckpointItems];
    return parsed.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  } catch (error) {
    return [...fallbackCheckpointItems];
  }
}

function buildDefaultChecklistTemplates(hausCheckpoints) {
  const haus = Array.isArray(hausCheckpoints) && hausCheckpoints.length ? hausCheckpoints : [...fallbackCheckpointItems];
  return [
    {
      id: HAUS_CHECKLIST_TEMPLATE_ID,
      name: "Haus & Garten",
      checkpoints: [...haus],
      assignedEmployeeUsernames: []
    },
    {
      id: PUTZ_CHECKLIST_TEMPLATE_ID,
      name: "Putzplan Haus",
      checkpoints: [...putzplanCheckpointDefaults],
      assignedEmployeeUsernames: []
    }
  ];
}

function loadChecklistTemplates() {
  const stored = localStorage.getItem(checklistTemplatesKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const normalized = normalizeChecklistTemplatesFromStorage(parsed);
      if (normalized && normalized.length) {
        ensureHausGartenCheckpointZonesPersisted(normalized, parsed);
        return normalized;
      }
    } catch (error) {
      /* fall through */
    }
  }
  const legacyPoints = loadLegacyCheckpointCatalogForMigration();
  const rawTemplates = buildDefaultChecklistTemplates(legacyPoints);
  const normalizedFresh = normalizeChecklistTemplatesFromStorage(rawTemplates);
  const templates = normalizedFresh && normalizedFresh.length ? normalizedFresh : rawTemplates;
  localStorage.setItem(checklistTemplatesKey, JSON.stringify(templates));
  return templates;
}

function persistChecklistTemplates() {
  bossChecklistFilterSignature = "";
  localStorage.setItem(checklistTemplatesKey, JSON.stringify(checklistTemplates));
}

function getChecklistTemplateById(id) {
  const wanted = id || HAUS_CHECKLIST_TEMPLATE_ID;
  return checklistTemplates.find((item) => item.id === wanted) || checklistTemplates[0] || null;
}

function templateAllowsEmployee(template, username) {
  if (!template || !username) return true;
  const list = template.assignedEmployeeUsernames;
  if (!Array.isArray(list) || !list.length) return true;
  return list.includes(username);
}

function managingCheckpointList() {
  const template = getChecklistTemplateById(checkpointManagerTemplateId);
  return template ? template.checkpoints : null;
}

function migrateCustomerCheckpointSetsIfNeeded(entry) {
  if (!entry) return entry;
  if (entry.checkpointSets && typeof entry.checkpointSets === "object") {
    return entry;
  }
  const legacy = Array.isArray(entry.checkpoints) ? entry.checkpoints : [];
  entry.checkpointSets = {};
  entry.checkpointSets[HAUS_CHECKLIST_TEMPLATE_ID] = [...legacy];
  return entry;
}

function getCustomerCheckpointsForTemplate(entry, templateId) {
  if (!entry) return [];
  migrateCustomerCheckpointSetsIfNeeded(entry);
  const id = templateId || HAUS_CHECKLIST_TEMPLATE_ID;
  const list = entry.checkpointSets[id];
  return Array.isArray(list) ? [...list] : [];
}

function customerHasCheckpointsForTemplate(entry, templateId) {
  return getCustomerCheckpointsForTemplate(entry, templateId).length > 0;
}

function syncCustomerLegacyCheckpointsField(entry) {
  if (!entry) return;
  migrateCustomerCheckpointSetsIfNeeded(entry);
  entry.checkpoints = [...(entry.checkpointSets[HAUS_CHECKLIST_TEMPLATE_ID] || [])];
}

function populateCustomerCheckpointTemplateSelect() {
  if (!el.customerCheckpointTemplateSelect) return;
  const previous = el.customerCheckpointTemplateSelect.value;
  el.customerCheckpointTemplateSelect.innerHTML = checklistTemplates.map((t) => `
    <option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>
  `).join("");
  if (previous && checklistTemplates.some((t) => t.id === previous)) {
    el.customerCheckpointTemplateSelect.value = previous;
  } else if (checklistTemplates[0]) {
    el.customerCheckpointTemplateSelect.value = checklistTemplates[0].id;
  }
  lastCustomerCheckpointTemplateChoice = el.customerCheckpointTemplateSelect.value;
}

function flushPendingCustomerCheckpointSelection() {
  if (!el.customerCheckpointTemplateSelect) return;
  const tid = el.customerCheckpointTemplateSelect.value;
  if (!tid) return;
  pendingCustomerCheckpointSets[tid] = getSelectedCustomerCheckpoints();
}

function initPendingCustomerCheckpointSetsBlank() {
  pendingCustomerCheckpointSets = {};
  checklistTemplates.forEach((t) => {
    pendingCustomerCheckpointSets[t.id] = [];
  });
}

function initPendingCustomerCheckpointSetsFromEntry(entry) {
  pendingCustomerCheckpointSets = {};
  migrateCustomerCheckpointSetsIfNeeded(entry);
  checklistTemplates.forEach((t) => {
    pendingCustomerCheckpointSets[t.id] = [...(entry.checkpointSets[t.id] || [])];
  });
}

function collectCheckpointSetsForCustomerSave() {
  flushPendingCustomerCheckpointSelection();
  const result = {};
  checklistTemplates.forEach((t) => {
    let list = [...(pendingCustomerCheckpointSets[t.id] || [])];
    if (t.id === HAUS_CHECKLIST_TEMPLATE_ID) {
      list = normalizeHausCustomerCheckpointKeysForSave(list, t);
    }
    result[t.id] = list;
  });
  return result;
}

function renderCustomerCheckpointOptions(selectedList) {
  if (!el.customerCheckpointOptions || !el.customerCheckpointTemplateSelect) return;
  const tid = el.customerCheckpointTemplateSelect.value;
  const template = getChecklistTemplateById(tid);
  if (!template) {
    el.customerCheckpointOptions.innerHTML = "";
    return;
  }
  const selectedSet = new Set(selectedList || []);
  if (tid === HAUS_CHECKLIST_TEMPLATE_ID) {
    const blocks = HAUS_CHECKPOINT_ZONE_IDS.map((zoneId) => {
      const rows = (template.checkpoints || []).filter((item) => hausCheckpointZoneFromDef(item) === zoneId);
      if (!rows.length) return "";
      const inner = rows.map((item) => {
        const rowKey = hausCheckpointRowKey(item);
        const labelText = checkpointDefLabelDeSlashEn(item);
        const checked = hausStoredKeySetHasDef(selectedSet, item);
        return `
    <label>
      <input type="checkbox" value="${escapeHtml(rowKey)}" ${checked ? "checked" : ""} />
      <span>${escapeHtml(labelText)}</span>
    </label>`;
      }).join("");
      return `
    <div class="customer-checkpoint-zone">
      <strong class="customer-checkpoint-zone-title">${escapeHtml(hausZoneGroupTitle(zoneId))}</strong>
      <div class="customer-checkpoint-zone-items">${inner}</div>
    </div>`;
    }).join("");
    el.customerCheckpointOptions.innerHTML = blocks || `<small>${escapeHtml(t("cust.noCpChosen"))}</small>`;
    return;
  }
  el.customerCheckpointOptions.innerHTML = template.checkpoints.map((item) => {
    const canon = checkpointCanonical(item);
    const labelText = checkpointDefLabelDeSlashEn(item);
    return `
    <label>
      <input type="checkbox" value="${escapeHtml(canon)}" ${selectedSet.has(canon) ? "checked" : ""} />
      <span>${escapeHtml(labelText)}</span>
    </label>`;
  }).join("");
}

function refreshCustomerCheckpointOptions() {
  const tid = el.customerCheckpointTemplateSelect ? el.customerCheckpointTemplateSelect.value : HAUS_CHECKLIST_TEMPLATE_ID;
  const cps = (getChecklistTemplateById(tid) || {}).checkpoints || [];
  const valid = new Set(
    tid === HAUS_CHECKLIST_TEMPLATE_ID
      ? cps.map((cp) => hausCheckpointRowKey(cp))
      : cps.map((cp) => checkpointCanonical(cp))
  );
  const selected = (pendingCustomerCheckpointSets[tid] || []).filter((name) => {
    if (valid.has(name)) return true;
    if (tid === HAUS_CHECKLIST_TEMPLATE_ID) {
      return cps.some((cp) => hausStoredKeyMatchesDef(name, cp));
    }
    return false;
  });
  renderCustomerCheckpointOptions(selected);
}

let checklistTemplates = loadChecklistTemplates();
let checkpointManagerTemplateId = HAUS_CHECKLIST_TEMPLATE_ID;
let activeFormChecklistTemplateId = HAUS_CHECKLIST_TEMPLATE_ID;
let pendingCustomerCheckpointSets = {};
let lastCustomerCheckpointTemplateChoice = HAUS_CHECKLIST_TEMPLATE_ID;
let bossChecklistFilterSignature = "";
/** Zuletzt für Checklisten-Spantexte synchrone UI-Sprache (für Locale-Wechsel). */
let checkpointFormSyncedUiLang = null;
let customerDb = loadCustomerDb();
let guideDb = loadGuideDb();
/** Wird von loadSubmissions gesetzt, wenn eine Kunden-Mail aus Stammdaten ergänzt wurde. */
let submissionEmailBackfillDirty = false;
let submissions = loadSubmissions();
if (submissionEmailBackfillDirty) {
  void persist().catch((err) => console.error(err));
}
let dailyAttendanceRecords = loadDailyAttendance();
let dailyCorrectionPanelExpanded = false;
let dailyCorrectionHydratedDate = "";
let currentRole = null;
let activeChecklistId = null;
let uploadedPhotos = [];
let currentSession = loadSession();
enrichCurrentSessionFromUsers();
let currentMailPreviewUrl = null;
let staffSchedule = loadSchedule();
let recurringScheduleRules = loadRecurringScheduleRules();
(function migrateRecurringRulesEffectiveFrom() {
  let changed = false;
  recurringScheduleRules.forEach((rule) => {
    if (!rule || String(rule.effectiveFromIso || "").trim()) return;
    rule.effectiveFromIso = toIsoDate(new Date());
    changed = true;
  });
  if (changed) persistRecurringScheduleRules();
})();
let workOrders = loadWorkOrders();
let selectedCalendarDate = toIsoDate(new Date());
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let activeSection = "checklist";
let lockedCustomerName = "";
let employeeChecklistUnlocked = false;
let activeAssignmentId = "";
let activeCustomerDbId = "";
/** Monatsfilter für Zusatzkosten je Kunden-ID (`""` = alle Monate). */
let customerDbExtraMonthByCustomerId = Object.create(null);
let customerDbWorkMonthByCustomerId = Object.create(null);
let activeCheckpointEditIndex = -1;
let calendarPlanningOpen = false;
let activeCustomerId = "";
let pendingCustomerOrientationPhoto = null;
let pendingCustomerContractPdf = null;
const MAX_CUSTOMER_CONTRACT_PDF_BYTES = 8 * 1024 * 1024;
let activeGuideDbId = "";
let pendingGuidePdfs = { de: null, en: null, es: null };
let activeRecurringRuleId = "";
let activeSingleAssignmentId = "";
let pendingCopySingleEntryId = "";
let calendarStaffFormInitialState = "";
let extraCostsPhoto = null;
/** Bilder für neuen/bearbeiteten Arbeitsauftrag (Kalender, Chef), max. {@link WORK_ORDER_MAX_CHEF_PHOTOS} */
let calendarWorkOrderPhotos = [];
/** Ausgewählter Arbeitsauftrag für Master-/Detail-Ansicht (assignmentId & Kalendertag). */
let activeWorkOrderAssignmentId = "";
let activeWorkOrderDateIso = "";
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
  localeSelectAuth: document.getElementById("localeSelectAuth"),
  localeSelectSidebar: document.getElementById("localeSelectSidebar"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  loginRemember: document.getElementById("loginRemember"),
  loginError: document.getElementById("loginError"),
  logoutButton: document.getElementById("logoutButton"),
  sessionUser: document.getElementById("sessionUser"),
  employeeView: document.getElementById("employeeView"),
  bossView: document.getElementById("bossView"),
  checklistSection: document.getElementById("checklistSection"),
  moduleTabs: document.getElementById("moduleTabs"),
  moduleTabButtons: document.querySelectorAll(".module-tab"),
  customerDbTab: document.getElementById("customerDbTab"),
  guideDbTab: document.getElementById("guideDbTab"),
  worktimeTab: document.getElementById("worktimeTab"),
  checkpointTab: document.getElementById("checkpointTab"),
  roleEyebrow: document.getElementById("roleEyebrow"),
  pageTitle: document.getElementById("pageTitle"),
  emailStatus: document.getElementById("emailStatus"),
  checklistForm: document.getElementById("checklistForm"),
  checklistTemplateRow: document.getElementById("checklistTemplateRow"),
  checklistTemplateSelect: document.getElementById("checklistTemplateSelect"),
  employeeChecklistLockedHint: document.getElementById("employeeChecklistLockedHint"),
  checklistItems: document.getElementById("checklistItems"),
  itemTemplate: document.getElementById("itemTemplate"),
  addItemButton: document.getElementById("addItemButton"),
  photoInput: document.getElementById("photoInput"),
  photoPreview: document.getElementById("photoPreview"),
  employeeList: document.getElementById("employeeList"),
  employeeChecklistStatusFilter: document.getElementById("employeeChecklistStatusFilter"),
  employeeChecklistCustomerFilter: document.getElementById("employeeChecklistCustomerFilter"),
  employeeChecklistProjectFilter: document.getElementById("employeeChecklistProjectFilter"),
  bossList: document.getElementById("bossList"),
  bossSearchRow: document.getElementById("bossSearchRow"),
  bossFilterPanel: document.getElementById("bossFilterPanel"),
  bossCustomerFilter: document.getElementById("bossCustomerFilter"),
  bossProjectFilter: document.getElementById("bossProjectFilter"),
  bossExtraCostsFilter: document.getElementById("bossExtraCostsFilter"),
  bossChecklistFilter: document.getElementById("bossChecklistFilter"),
  reviewPanel: document.getElementById("reviewPanel"),
  statusFilter: document.getElementById("statusFilter"),
  saveDraftButton: document.getElementById("saveDraftButton"),
  newChecklistButton: document.getElementById("newChecklistButton"),
  extraCostsEnabled: document.getElementById("extraCostsEnabled"),
  extraCostsFields: document.getElementById("extraCostsFields"),
  extraCostsComment: document.getElementById("extraCostsComment"),
  extraCostsEuro: document.getElementById("extraCostsEuro"),
  extraCostsPhotoInput: document.getElementById("extraCostsPhotoInput"),
  extraCostsPhotoTrigger: document.getElementById("extraCostsPhotoTrigger"),
  extraCostsPhotoPreview: document.getElementById("extraCostsPhotoPreview"),
  statDrafts: document.getElementById("statDrafts"),
  statSubmitted: document.getElementById("statSubmitted"),
  statApproved: document.getElementById("statApproved"),
  customerName: document.getElementById("customerName"),
  customerEmail: document.getElementById("customerEmail"),
  customerOrientationWrap: document.getElementById("customerOrientationWrap"),
  customerOrientationPreview: document.getElementById("customerOrientationPreview"),
  imageLightbox: document.getElementById("imageLightbox"),
  imageLightboxClose: document.getElementById("imageLightboxClose"),
  imageLightboxImage: document.getElementById("imageLightboxImage"),
  jobTitle: document.getElementById("jobTitle"),
  employeeName: document.getElementById("employeeName"),
  employeeComment: document.getElementById("employeeComment"),
  comeButton: document.getElementById("comeButton"),
  leaveButton: document.getElementById("leaveButton"),
  comeTimeDisplay: document.getElementById("comeTimeDisplay"),
  leaveTimeDisplay: document.getElementById("leaveTimeDisplay")
  ,
  customerDbPanel: document.getElementById("customerDbPanel"),
  guideDbPanel: document.getElementById("guideDbPanel"),
  guideDbForm: document.getElementById("guideDbForm"),
  guideDbList: document.getElementById("guideDbList"),
  guideNameDe: document.getElementById("guideNameDe"),
  guideNameEn: document.getElementById("guideNameEn"),
  guidePdfDe: document.getElementById("guidePdfDe"),
  guidePdfEn: document.getElementById("guidePdfEn"),
  guidePdfEs: document.getElementById("guidePdfEs"),
  guidePdfDeStatus: document.getElementById("guidePdfDeStatus"),
  guidePdfEnStatus: document.getElementById("guidePdfEnStatus"),
  guidePdfEsStatus: document.getElementById("guidePdfEsStatus"),
  guidePdfDeRemove: document.getElementById("guidePdfDeRemove"),
  guidePdfEnRemove: document.getElementById("guidePdfEnRemove"),
  guidePdfEsRemove: document.getElementById("guidePdfEsRemove"),
  guideDbSaveButton: document.getElementById("guideDbSaveButton"),
  worktimePanel: document.getElementById("worktimePanel"),
  employeeDayWorkPanel: document.getElementById("employeeDayWorkPanel"),
  chefWorktimeSummaryPanel: document.getElementById("chefWorktimeSummaryPanel"),
  employeeWorkDate: document.getElementById("employeeWorkDate"),
  employeeWorkDateHint: document.getElementById("employeeWorkDateHint"),
  dayWorkComeButton: document.getElementById("dayWorkComeButton"),
  dayWorkBreakStartButton: document.getElementById("dayWorkBreakStartButton"),
  dayWorkBreakEndButton: document.getElementById("dayWorkBreakEndButton"),
  dayWorkLeaveButton: document.getElementById("dayWorkLeaveButton"),
  dayWorkComeDisplay: document.getElementById("dayWorkComeDisplay"),
  dayWorkBreakStartDisplay: document.getElementById("dayWorkBreakStartDisplay"),
  dayWorkBreakEndDisplay: document.getElementById("dayWorkBreakEndDisplay"),
  dayWorkLeaveDisplay: document.getElementById("dayWorkLeaveDisplay"),
  worktimeScope: document.getElementById("worktimeScope"),
  worktimeSource: document.getElementById("worktimeSource"),
  worktimeSourceCaption: document.getElementById("worktimeSourceCaption"),
  worktimeDate: document.getElementById("worktimeDate"),
  worktimePeriodDisplay: document.getElementById("worktimePeriodDisplay"),
  worktimePickerFace: document.getElementById("worktimePickerFace"),
  worktimePickerHitLayer: document.getElementById("worktimePickerHitLayer"),
  worktimeList: document.getElementById("worktimeList"),
  dailyWorkCorrectionWrap: document.getElementById("dailyWorkCorrectionWrap"),
  dailyWorkCorrectionToggle: document.getElementById("dailyWorkCorrectionToggle"),
  dailyWorkCorrectionCollapsible: document.getElementById("dailyWorkCorrectionCollapsible"),
  dailyWorkCorrectionPending: document.getElementById("dailyWorkCorrectionPending"),
  dailyWorkCorrectionRejected: document.getElementById("dailyWorkCorrectionRejected"),
  dailyWorkCorrectionForm: document.getElementById("dailyWorkCorrectionForm"),
  corrSuggestedCome: document.getElementById("corrSuggestedCome"),
  corrSuggestedBreakStart: document.getElementById("corrSuggestedBreakStart"),
  corrSuggestedBreakEnd: document.getElementById("corrSuggestedBreakEnd"),
  corrSuggestedLeave: document.getElementById("corrSuggestedLeave"),
  corrEmployeeNote: document.getElementById("corrEmployeeNote"),
  dailyWorkCorrectionSubmit: document.getElementById("dailyWorkCorrectionSubmit"),
  chefDailyCorrectionsWrap: document.getElementById("chefDailyCorrectionsWrap"),
  chefDailyCorrectionsList: document.getElementById("chefDailyCorrectionsList"),
  checkpointPanel: document.getElementById("checkpointPanel"),
  checkpointManager: document.getElementById("checkpointManager"),
  checkpointForm: document.getElementById("checkpointForm"),
  checkpointNameDe: document.getElementById("checkpointNameDe"),
  checkpointNameEn: document.getElementById("checkpointNameEn"),
  checkpointHausZone: document.getElementById("checkpointHausZone"),
  checkpointHausZoneRow: document.getElementById("checkpointHausZoneRow"),
  checkpointSaveButton: document.getElementById("checkpointSaveButton"),
  checkpointManagerTemplateSelect: document.getElementById("checkpointManagerTemplateSelect"),
  checkpointEmployeeAccess: document.getElementById("checkpointEmployeeAccess"),
  checkpointAccessAllEmployees: document.getElementById("checkpointAccessAllEmployees"),
  checkpointAccessHintRestricted: document.getElementById("checkpointAccessHintRestricted"),
  checkpointList: document.getElementById("checkpointList"),
  customerDbForm: document.getElementById("customerDbForm"),
  customerDbList: document.getElementById("customerDbList"),
  dbFirstName: document.getElementById("dbFirstName"),
  dbLastName: document.getElementById("dbLastName"),
  dbAddress: document.getElementById("dbAddress"),
  dbCoordinates: document.getElementById("dbCoordinates"),
  dbProject: document.getElementById("dbProject"),
  dbEmail: document.getElementById("dbEmail"),
  dbPhone: document.getElementById("dbPhone"),
  dbOrientationPhoto: document.getElementById("dbOrientationPhoto"),
  dbOrientationPreview: document.getElementById("dbOrientationPreview"),
  dbOrientationRemove: document.getElementById("dbOrientationRemove"),
  dbContractPdf: document.getElementById("dbContractPdf"),
  dbContractStatus: document.getElementById("dbContractStatus"),
  dbContractRemove: document.getElementById("dbContractRemove"),
  customerCheckpointTemplateSelect: document.getElementById("customerCheckpointTemplateSelect"),
  customerCheckpointOptions: document.getElementById("customerCheckpointOptions"),
  calendarPanel: document.getElementById("calendarPanel"),
  calendarMonthLabel: document.getElementById("calendarMonthLabel"),
  calendarGrid: document.getElementById("calendarGrid"),
  calendarSelectedLabel: document.getElementById("calendarSelectedLabel"),
  calendarStaffList: document.getElementById("calendarStaffList"),
  calendarStaffForm: document.getElementById("calendarStaffForm"),
  calendarAssignmentType: document.getElementById("calendarAssignmentType"),
  calendarRecurringWeekday: document.getElementById("calendarRecurringWeekday"),
  calendarRecurringWeekdayWrap: document.getElementById("calendarRecurringWeekdayWrap"),
  calendarMonthlyDomHint: document.getElementById("calendarMonthlyDomHint"),
  calendarSort: document.getElementById("calendarSort"),
  calendarEmployeeFilter: document.getElementById("calendarEmployeeFilter"),
  calendarNewAssignmentButton: document.getElementById("calendarNewAssignmentButton"),
  calendarStaffSubmitButton: document.getElementById("calendarStaffSubmitButton"),
  calendarStaffCancelButton: document.getElementById("calendarStaffCancelButton"),
  calendarEmployeeCheckboxes: document.getElementById("calendarEmployeeCheckboxes"),
  calendarChecklistOwnerWrap: document.getElementById("calendarChecklistOwnerWrap"),
  calendarChecklistOwnerSelect: document.getElementById("calendarChecklistOwnerSelect"),
  calendarFromTime: document.getElementById("calendarFromTime"),
  calendarToTime: document.getElementById("calendarToTime"),
  calendarCustomerSelect: document.getElementById("calendarCustomerSelect"),
  calendarChecklistTemplateCheckboxes: document.getElementById("calendarChecklistTemplateCheckboxes"),
  calendarHausZonesWrap: document.getElementById("calendarHausZonesWrap"),
  calendarHausZoneCheckboxes: document.getElementById("calendarHausZoneCheckboxes"),
  calendarStaffComment: document.getElementById("calendarStaffComment"),
  calendarPrev: document.getElementById("calendarPrev"),
  calendarNext: document.getElementById("calendarNext"),
  calendarCopySingleDialog: document.getElementById("calendarCopySingleDialog"),
  calendarCopySingleForm: document.getElementById("calendarCopySingleForm"),
  calendarCopySingleSummary: document.getElementById("calendarCopySingleSummary"),
  calendarCopySingleDateInput: document.getElementById("calendarCopySingleDateInput"),
  calendarCopySingleCancelBtn: document.getElementById("calendarCopySingleCancelBtn"),
  calendarCopySingleConfirmBtn: document.getElementById("calendarCopySingleConfirmBtn"),
  calendarWorkOrderMode: document.getElementById("calendarWorkOrderMode"),
  calendarChecklistTplFieldWrap: document.getElementById("calendarChecklistTplFieldWrap"),
  calendarStaffCommentLabelNormal: document.getElementById("calendarStaffCommentLabelNormal"),
  calendarStaffCommentLabelWo: document.getElementById("calendarStaffCommentLabelWo"),
  workOrdersPanel: document.getElementById("workOrdersPanel"),
  workOrdersToolbar: document.getElementById("workOrdersToolbar"),
  workOrdersSearchRow: document.getElementById("workOrdersSearchRow"),
  workOrdersStatusFilter: document.getElementById("workOrdersStatusFilter"),
  workOrdersCustomerFilter: document.getElementById("workOrdersCustomerFilter"),
  workOrdersProjectFilter: document.getElementById("workOrdersProjectFilter"),
  workOrdersEmployeeFilter: document.getElementById("workOrdersEmployeeFilter"),
  workOrdersEmpFilterWrap: document.getElementById("workOrdersEmpFilterWrap"),
  workOrdersList: document.getElementById("workOrdersList"),
  workOrdersDetailPanel: document.getElementById("workOrdersDetailPanel"),
  workOrdersDetailEmpty: document.getElementById("workOrdersDetailEmpty"),
  workOrdersDetailBody: document.getElementById("workOrdersDetailBody"),
  calendarWorkOrderPhotoWrap: document.getElementById("calendarWorkOrderPhotoWrap"),
  calendarWorkOrderPhotoInput: document.getElementById("calendarWorkOrderPhotoInput"),
  calendarWorkOrderPhotoHint: document.getElementById("calendarWorkOrderPhotoHint"),
  calendarWorkOrderPhotoPreview: document.getElementById("calendarWorkOrderPhotoPreview")
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
  } catch (error) {
    return {};
  }
}

function persistSchedule() {
  localStorage.setItem(scheduleKey, JSON.stringify(staffSchedule));
}

function normalizeRecurringScheduleRule(rule) {
  if (!rule || typeof rule !== "object") return null;
  const k = rule.recurrenceKind;
  if (k === "biweekly" || k === "monthly") {
    rule.recurrenceKind = k;
  } else {
    rule.recurrenceKind = "weekly";
  }
  return rule;
}

function loadRecurringScheduleRules() {
  const stored = localStorage.getItem(recurringScheduleRulesKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => normalizeRecurringScheduleRule(r)).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function persistRecurringScheduleRules() {
  localStorage.setItem(recurringScheduleRulesKey, JSON.stringify(recurringScheduleRules));
}

function isWorkOrderAssignment(entry) {
  return Boolean(entry && entry.assignmentKind === WORK_ORDER_ASSIGNMENT_KIND);
}

/** Nur für vertrauenswürdige data:-Bilder aus eigener Upload-Pipeline */
function safeDataImageSrc(raw) {
  const s = String(raw || "").trim();
  return s.startsWith("data:image/") ? s : "";
}

function sanitizeWorkOrderChefImages(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((item) => {
    if (out.length >= WORK_ORDER_MAX_CHEF_PHOTOS) return;
    if (!item || typeof item !== "object") return;
    const data = safeDataImageSrc(item.data != null ? item.data : "");
    if (!data) return;
    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : "photo";
    out.push({ name, data });
  });
  return out;
}

function cloneWorkOrderChefImagesForStorage(raw) {
  return sanitizeWorkOrderChefImages(raw).map((p) => ({ name: p.name, data: p.data }));
}

function loadWorkOrders() {
  const stored = localStorage.getItem(workOrdersStateKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeWorkOrderStateRow).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function persistWorkOrders() {
  localStorage.setItem(workOrdersStateKey, JSON.stringify(workOrders));
}

function normalizeWorkOrderStateRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const assignmentId = String(raw.assignmentId || "").trim();
  const dateIso = String(raw.dateIso || "").trim();
  if (!assignmentId || !dateIso) return null;
  let status = raw.status === "in_progress" || raw.status === "done" ? raw.status : "submitted";
  const employeeReply = typeof raw.employeeReply === "string" ? raw.employeeReply : "";
  const employeeComeAt = typeof raw.employeeComeAt === "string" ? raw.employeeComeAt.trim() : "";
  const employeeLeaveAt = typeof raw.employeeLeaveAt === "string" ? raw.employeeLeaveAt.trim() : "";
  const updatedAt = typeof raw.updatedAt === "string" && raw.updatedAt.trim()
    ? raw.updatedAt.trim()
    : new Date().toISOString();
  let createdAt = typeof raw.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt.trim() : "";
  if (!createdAt) createdAt = updatedAt;
  const emailSentAt = typeof raw.emailSentAt === "string" ? raw.emailSentAt.trim() : "";
  const bossComment = typeof raw.bossComment === "string" ? raw.bossComment : "";
  const completedAt = typeof raw.completedAt === "string" ? raw.completedAt.trim() : "";
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createId(),
    assignmentId,
    dateIso,
    status,
    employeeReply,
    employeeComeAt,
    employeeLeaveAt,
    emailSentAt,
    bossComment,
    completedAt,
    createdAt,
    updatedAt
  };
}

function customerReportParagraphsForEntry(entry) {
  if (isWorkOrderReportEntry(entry)) {
    return [t("wo.reportIntroP1"), t("wo.reportIntroP2"), t("wo.reportIntroP3")];
  }
  return [t("preview.introP1"), t("preview.introP2"), t("preview.introP3")];
}

function isWorkOrderReportEntry(entry) {
  return Boolean(entry && entry.reportKind === "workOrder");
}

function findWorkOrderRowPayload(assignmentId, dateIso) {
  const aid = String(assignmentId || "").trim();
  const d = String(dateIso || "").trim();
  if (!aid || !d) return null;
  return collectWorkOrderRowsForViewer().find((r) => r.entry.id === aid && r.dateIso === d) || null;
}

function buildWorkOrderReportEntry(row) {
  const { dateIso, entry, stateRow, employeeReply } = row;
  const empLabel = getEmployeeLabelByUsername(entry.employeeUsername || "");
  const projectLabel = String(entry.project || "").trim()
    || String(entry.customerName || "").trim()
    || t("wo.reportTitleFallback");
  const chefPhotos = sanitizeWorkOrderChefImages(entry.workOrderImages || []);
  const resultPhotos = sanitizeWorkOrderChefImages(entry.workOrderResultImages || []);
  const completedAt = stateRow && stateRow.status === "done"
    ? (stateRow.completedAt || stateRow.updatedAt || "")
    : "";
  return {
    reportKind: "workOrder",
    jobTitle: projectLabel,
    customerName: entry.customerName || "",
    customerAddress: entry.customerAddress || "",
    customerId: entry.customerId || "",
    customerEmail: entry.customerEmail || "",
    employeeName: empLabel,
    employeeComment: employeeReply || "",
    staffInstruction: entry.staffComment || "",
    approvedAt: completedAt,
    submittedAt: stateRow ? stateRow.updatedAt : "",
    createdAt: stateRow ? stateRow.createdAt : "",
    emailSentAt: stateRow ? stateRow.emailSentAt || "" : "",
    bossComment: stateRow ? (stateRow.bossComment || "") : "",
    workOrderDateIso: dateIso,
    workOrderFromTime: entry.fromTime || "",
    workOrderToTime: entry.toTime || "",
    employeeComeAt: stateRow ? stateRow.employeeComeAt || "" : "",
    employeeLeaveAt: stateRow ? stateRow.employeeLeaveAt || "" : "",
    checklistTemplateName: t("wo.reportTypeLabel"),
    items: [],
    photos: resultPhotos.filter((ph) => ph && ph.data).map((ph) => ({ data: ph.data }))
  };
}

function getWorkOrderClosingReportText(entry) {
  return String(entry && entry.bossComment || "").trim();
}

function formatWorkOrderClosingReportHtml(closingText) {
  const raw = String(closingText || "").trim();
  if (!raw) return `<p>${escapeHtml(t("wo.reportScopeEmpty"))}</p>`;
  return raw.split(/\n/).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function persistWorkOrderBossComment(assignmentId, dateIso, text) {
  const row = ensureWorkOrderState(assignmentId, dateIso);
  row.bossComment = String(text || "").trim();
  row.updatedAt = new Date().toISOString();
  persistWorkOrders();
}

async function sendWorkOrderCustomerReport(row, options) {
  const opts = options && typeof options === "object" ? options : {};
  const reportEntry = buildWorkOrderReportEntry(row);
  const email = resolveCustomerEmailForEntry(reportEntry);
  if (!email) {
    if (!opts.silent) showToast(t("toast.customerEmailMissing"));
    return false;
  }
  reportEntry.customerEmail = email;
  let pdfBlob = null;
  try {
    pdfBlob = await generateCustomerReportPdfBlob(reportEntry);
  } catch (err) {
    console.error(err);
    if (!opts.silent) showToast(t("toast.pdfError"));
  }
  await sendCustomerEmailWithPdf(reportEntry, pdfBlob);
  const st = findWorkOrderState(row.entry.id, row.dateIso);
  if (st && reportEntry.emailSentAt) {
    st.emailSentAt = reportEntry.emailSentAt;
    if (!st.completedAt && st.status === "done") st.completedAt = new Date().toISOString();
    persistWorkOrders();
  }
  if (!opts.silent && reportEntry.emailSentAt) showToast(t("wo.toastReportSent"));
  return Boolean(reportEntry.emailSentAt);
}

function findWorkOrderState(assignmentId, dateIso) {
  const aid = String(assignmentId || "").trim();
  const d = String(dateIso || "").trim();
  return workOrders.find((w) => w.assignmentId === aid && w.dateIso === d) || null;
}

function ensureWorkOrderState(assignmentId, dateIso) {
  const aid = String(assignmentId || "").trim();
  const d = String(dateIso || "").trim();
  let row = findWorkOrderState(aid, d);
  if (row) return row;
  const stamp = new Date().toISOString();
  row = {
    id: createId(),
    assignmentId: aid,
    dateIso: d,
    status: "submitted",
    employeeReply: "",
    employeeComeAt: "",
    employeeLeaveAt: "",
    createdAt: stamp,
    updatedAt: stamp
  };
  workOrders.push(row);
  persistWorkOrders();
  return row;
}

function setWorkOrderStateStatus(assignmentId, dateIso, status) {
  const row = ensureWorkOrderState(assignmentId, dateIso);
  row.status = status;
  row.updatedAt = new Date().toISOString();
  if (status === "done") {
    if (!row.completedAt) row.completedAt = row.updatedAt;
  } else {
    row.completedAt = "";
  }
  persistWorkOrders();
}

function workOrderCreatedSortTimestamp(dateIso, fromTime, stateRow) {
  if (stateRow && stateRow.createdAt) {
    const ms = Date.parse(stateRow.createdAt);
    if (!Number.isNaN(ms)) return ms;
  }
  const parts = String(dateIso || "").split("-").map(Number);
  const fm = parseTimeToMinutes(fromTime);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return new Date(parts[0], parts[1] - 1, parts[2]).getTime() + (fm != null ? fm * 60000 : 0);
  }
  return 0;
}

function scheduleEntryIndexForAssignment(assignmentId, dateIso) {
  const aid = String(assignmentId || "").trim();
  const d = String(dateIso || "").trim();
  const list = staffSchedule[d];
  if (!Array.isArray(list)) return -1;
  return list.findIndex((e) => e && e.id === aid);
}

function persistWorkOrderResultImages(assignmentId, dateIso, imagesRaw) {
  const idx = scheduleEntryIndexForAssignment(assignmentId, dateIso);
  if (idx < 0) return false;
  const d = String(dateIso || "").trim();
  const list = staffSchedule[d];
  const next = cloneWorkOrderChefImagesForStorage(imagesRaw || []);
  const cur = Object.assign({}, list[idx], { workOrderResultImages: next });
  list[idx] = cur;
  staffSchedule[d] = list;
  persistSchedule();
  return true;
}

async function handleWorkOrderResultPhotoPick(assignmentId, dateIso, fileList) {
  const files = fileList ? [...fileList].filter((f) => f && f.type.startsWith("image/")) : [];
  if (!files.length) return;
  const idx = scheduleEntryIndexForAssignment(assignmentId, dateIso);
  const d = String(dateIso || "").trim();
  if (idx < 0 || !staffSchedule[d]) return;
  const entry = staffSchedule[d][idx];
  if (!isWorkOrderAssignment(entry)) return;
  let cur = sanitizeWorkOrderChefImages(entry.workOrderResultImages || []).slice();
  for (let fi = 0; fi < files.length; fi += 1) {
    if (cur.length >= WORK_ORDER_MAX_RESULT_PHOTOS) {
      showToast(t("wo.maxResultPhotos"));
      break;
    }
    const file = files[fi];
    await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const ph = await finalizeUploadedChecklistImage(reader.result, file.name);
          if (cur.length < WORK_ORDER_MAX_RESULT_PHOTOS) cur.push(ph);
        } catch (err) {
          console.error(err);
          const rawData = reader.result;
          if (typeof rawData === "string" && rawData.startsWith("data:image/") && cur.length < WORK_ORDER_MAX_RESULT_PHOTOS) {
            cur.push({ name: file.name, data: rawData });
          }
        }
        resolve();
      };
      reader.readAsDataURL(file);
    });
    cur = sanitizeWorkOrderChefImages(cur);
  }
  persistWorkOrderResultImages(assignmentId, dateIso, cur);
}

function removeWorkOrderResultPhotoAt(assignmentId, dateIso, index) {
  const idxEntry = scheduleEntryIndexForAssignment(assignmentId, dateIso);
  if (idxEntry < 0) return;
  const d = String(dateIso || "").trim();
  const entry = staffSchedule[d][idxEntry];
  if (!entry || !isWorkOrderAssignment(entry)) return;
  const cur = sanitizeWorkOrderChefImages(entry.workOrderResultImages || []);
  const rm = Number(index);
  if (!Number.isInteger(rm) || rm < 0 || rm >= cur.length) return;
  cur.splice(rm, 1);
  persistWorkOrderResultImages(assignmentId, dateIso, cur);
}

function setWorkOrderEmployeeReply(assignmentId, dateIso, text) {
  const row = ensureWorkOrderState(assignmentId, dateIso);
  row.employeeReply = String(text || "").trim();
  row.updatedAt = new Date().toISOString();
  persistWorkOrders();
}

function setWorkOrderEmployeeTimeStamp(assignmentId, dateIso, kind, isoStamp) {
  if (kind !== "come" && kind !== "leave") return;
  const row = ensureWorkOrderState(assignmentId, dateIso);
  const stamp = typeof isoStamp === "string" && isoStamp.trim() ? isoStamp.trim() : new Date().toISOString();
  if (kind === "come") row.employeeComeAt = stamp;
  if (kind === "leave") row.employeeLeaveAt = stamp;
  row.updatedAt = new Date().toISOString();
  persistWorkOrders();
}

function formatWorkOrderEmployeeTimeStamp(isoStamp) {
  const raw = String(isoStamp || "").trim();
  if (!raw) return t("common.emDash");
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return t("common.emDash");
  return new Intl.DateTimeFormat(intlLocaleSafe(), {
    hour: "2-digit",
    minute: "2-digit"
  }).format(dt);
}

function removeWorkOrderStateForAssignment(aid, dateIso) {
  const id = String(aid || "").trim();
  const d = String(dateIso || "").trim();
  const next = workOrders.filter((w) => !(w.assignmentId === id && w.dateIso === d));
  if (next.length !== workOrders.length) {
    workOrders = next;
    persistWorkOrders();
  }
}

function deleteWorkOrderAssignment(assignmentId, dateIso) {
  const id = String(assignmentId || "").trim();
  const d = String(dateIso || "").trim();
  if (!id || !d) return false;
  const list = staffSchedule[d];
  if (!Array.isArray(list)) return false;
  const entry = list.find((item) => item.id === id);
  if (!entry || !isWorkOrderAssignment(entry)) return false;
  if (!bossMayManageAssignmentEmployee(entry.employeeUsername || "")) {
    showToast(t("toast.managedStaffOnly"));
    return false;
  }
  removeWorkOrderStateForAssignment(id, d);
  staffSchedule[d] = list.filter((e) => e.id !== id);
  if (!staffSchedule[d].length) delete staffSchedule[d];
  persistSchedule();
  if (activeWorkOrderAssignmentId === id && activeWorkOrderDateIso === d) {
    activeWorkOrderAssignmentId = "";
    activeWorkOrderDateIso = "";
  }
  renderWorkOrdersPanel();
  renderCalendar();
  showToast(t("toast.woDeleted"));
  return true;
}

function pruneOrphanWorkOrderStates() {
  const valid = new Set();
  Object.keys(staffSchedule).forEach((dateIso) => {
    const day = staffSchedule[dateIso];
    if (!Array.isArray(day)) return;
    day.forEach((entry) => {
      if (!entry || isRecurringOccurrenceSkipEntry(entry)) return;
      if (isWorkOrderAssignment(entry)) {
        valid.add(`${dateIso}::${entry.id}`);
      }
    });
  });
  const next = workOrders.filter((w) => valid.has(`${w.dateIso}::${w.assignmentId}`));
  if (next.length !== workOrders.length) {
    workOrders = next;
    persistWorkOrders();
  }
}

function sanitizeChecklistTemplateIdsArray(raw) {
  const known = new Set((checklistTemplates || []).map((tpl) => tpl.id));
  const out = [];
  if (Array.isArray(raw)) {
    raw.forEach((id) => {
      const s = String(id || "").trim();
      if (s && known.has(s) && !out.includes(s)) out.push(s);
    });
  } else if (raw != null && String(raw).trim()) {
    const s = String(raw).trim();
    if (known.has(s)) out.push(s);
  }
  const allowed = getAllowedChecklistTemplateIdsForSession();
  if (allowed) {
    out = out.filter((id) => allowed.includes(id));
    if (!out.length) out.push(allowed[0]);
  }
  return out.length ? out : [getDefaultChecklistTemplateIdForSession()];
}

function normalizeAssignmentTemplateIds(ref) {
  if (!ref) return [HAUS_CHECKLIST_TEMPLATE_ID];
  if (isWorkOrderAssignment(ref)) return [];
  if (ref.checklistTemplateIds && ref.checklistTemplateIds.length) {
    return sanitizeChecklistTemplateIdsArray(ref.checklistTemplateIds);
  }
  return sanitizeChecklistTemplateIdsArray(ref.checklistTemplateId);
}

function validateCustomerHasCheckpointsForTemplateIds(customer, tplIds) {
  if (!customer) return false;
  const ids = sanitizeChecklistTemplateIdsArray(tplIds);
  migrateCustomerCheckpointSetsIfNeeded(customer);
  for (let i = 0; i < ids.length; i += 1) {
    if (!customerHasCheckpointsForTemplate(customer, ids[i])) {
      const meta = getChecklistTemplateById(ids[i]);
      showToast(t("toast.cpMissingTpl", { name: meta ? meta.name : ids[i] }));
      return false;
    }
  }
  return true;
}

/** Für Kalender-Einsätze / Regeln: gültige Haus-Bereiche (general, pool, zone_1 …). */
function sanitizeAssignmentHausGartenZoneIds(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return [...new Set(raw.map((z) => String(z || "").trim()).filter((z) => isHausCheckpointZoneId(z)))];
}

/** Fehlende Angabe = alle Bereiche (bestehende Einsätze ohne Feld). */
function effectiveHausGartenZonesForEntry(entry) {
  const z = sanitizeAssignmentHausGartenZoneIds(entry && entry.hausGartenZoneIds);
  if (z.length) return z;
  if (entry && normalizeAssignmentTemplateIds(entry).includes(HAUS_CHECKLIST_TEMPLATE_ID)) {
    return [...HAUS_CHECKPOINT_ZONE_IDS];
  }
  return [];
}

function filterCustomerHausCheckpointsByZones(customer, zoneIds) {
  const zones = sanitizeAssignmentHausGartenZoneIds(zoneIds);
  const tmpl = getChecklistTemplateById(HAUS_CHECKLIST_TEMPLATE_ID);
  const cust = new Set(getCustomerCheckpointsForTemplate(customer, HAUS_CHECKLIST_TEMPLATE_ID));
  if (!tmpl || !zones.length) return [...cust];
  const zoneSet = new Set(zones);
  return (tmpl.checkpoints || [])
    .filter((def) => zoneSet.has(hausCheckpointZoneFromDef(def)) && hausStoredKeySetHasDef(cust, def))
    .map((def) => hausCheckpointRowKey(def));
}

function validateCustomerHasHausCheckpointsInZones(customer, zoneIds) {
  const zones = sanitizeAssignmentHausGartenZoneIds(zoneIds);
  if (!zones.length) return false;
  const filtered = filterCustomerHausCheckpointsByZones(customer, zones);
  if (!filtered.length) {
    showToast(t("toast.cpMissingHausZones"));
    return false;
  }
  return true;
}

function migrateScheduleTemplateIdsInPlace() {
  let changed = false;
  Object.keys(staffSchedule).forEach((dateKey) => {
    const entries = staffSchedule[dateKey];
    if (!Array.isArray(entries)) return;
    entries.forEach((entry) => {
      if (!entry) return;
      if (isRecurringOccurrenceSkipEntry(entry)) return;
      if (isWorkOrderAssignment(entry)) {
        entry.checklistTemplateIds = [];
        entry.checklistTemplateId = "";
        changed = true;
        return;
      }
      if (!entry.checklistTemplateId) {
        entry.checklistTemplateId = HAUS_CHECKLIST_TEMPLATE_ID;
        changed = true;
      }
      const ids = normalizeAssignmentTemplateIds(entry);
      const joined = ids.join(",");
      const prevJoined = Array.isArray(entry.checklistTemplateIds) ? entry.checklistTemplateIds.join(",") : "";
      if (prevJoined !== joined || entry.checklistTemplateId !== ids[0]) {
        entry.checklistTemplateIds = ids;
        entry.checklistTemplateId = ids[0];
        changed = true;
      }
    });
  });
  recurringScheduleRules.forEach((rule) => {
    if (!rule) return;
    if (!rule.checklistTemplateId) {
      rule.checklistTemplateId = HAUS_CHECKLIST_TEMPLATE_ID;
      changed = true;
    }
    const ids = normalizeAssignmentTemplateIds(rule);
    const joined = ids.join(",");
    const prevJoined = Array.isArray(rule.checklistTemplateIds) ? rule.checklistTemplateIds.join(",") : "";
    if (prevJoined !== joined || rule.checklistTemplateId !== ids[0]) {
      rule.checklistTemplateIds = ids;
      rule.checklistTemplateId = ids[0];
      changed = true;
    }
  });
  if (changed) {
    persistSchedule();
    persistRecurringScheduleRules();
  }
}

function loadCustomerDb() {
  const stored = localStorage.getItem(customerDbKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) =>
      Object.assign({}, c, {
        extraCostLedger: Array.isArray(c.extraCostLedger) ? c.extraCostLedger : [],
        orientationPhoto: sanitizeStoredChecklistPhoto(c.orientationPhoto),
        contractPdf: sanitizeStoredCustomerContractPdf(c.contractPdf),
        status: sanitizeCustomerStatus(c.status)
      })
    );
  } catch (error) {
    return [];
  }
}

function persistCustomerDb() {
  localStorage.setItem(customerDbKey, JSON.stringify(customerDb));
}

function loadGuideDb() {
  const stored = localStorage.getItem(guideDbKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((g) => sanitizeGuideEntry(g));
  } catch (error) {
    return [];
  }
}

function persistGuideDb() {
  localStorage.setItem(guideDbKey, JSON.stringify(guideDb));
}

function sanitizeGuidePdfs(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  return {
    de: sanitizeStoredCustomerContractPdf(o.de),
    en: sanitizeStoredCustomerContractPdf(o.en),
    es: sanitizeStoredCustomerContractPdf(o.es)
  };
}

function sanitizeGuideEntry(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  return {
    id: typeof o.id === "string" && o.id.trim() ? o.id.trim() : createId(),
    nameDe: String(o.nameDe || "").trim().slice(0, 120),
    nameEn: String(o.nameEn || "").trim().slice(0, 120),
    pdfs: sanitizeGuidePdfs(o.pdfs)
  };
}

function guideHasAnyPdf(pdfs) {
  const p = sanitizeGuidePdfs(pdfs);
  return Boolean(p.de || p.en || p.es);
}

function getGuideDisplayName(entry) {
  const e = entry && typeof entry === "object" ? entry : {};
  if (WC && WC.getLocale() === "en") {
    const en = String(e.nameEn || "").trim();
    if (en) return en;
  }
  const de = String(e.nameDe || "").trim();
  if (de) return de;
  return String(e.nameEn || "").trim() || "—";
}

function compareGuidesForDisplay(a, b) {
  return getGuideDisplayName(a).localeCompare(getGuideDisplayName(b), "de", { sensitivity: "base" });
}

function getGuideDbEntriesForDisplay() {
  return [...guideDb].sort(compareGuidesForDisplay);
}

function readGuidePdfFile(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(String(file.name || ""));
    if (!isPdf) {
      showToast(t("toast.contractPdfType"));
      resolve(null);
      return;
    }
    if (file.size > MAX_CUSTOMER_CONTRACT_PDF_BYTES) {
      showToast(t("toast.contractPdfSize"));
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      if (!data.startsWith("data:application/pdf")) {
        showToast(t("toast.contractPdfType"));
        resolve(null);
        return;
      }
      let name = String(file.name || "anleitung.pdf").trim().slice(0, 120) || "anleitung.pdf";
      if (!name.toLowerCase().endsWith(".pdf")) name = `${name}.pdf`;
      resolve({ name, data });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function renderGuidePdfStatusInForm(lang) {
  const statusEl = el[`guidePdf${lang.charAt(0).toUpperCase()}${lang.slice(1)}Status`];
  const removeEl = el[`guidePdf${lang.charAt(0).toUpperCase()}${lang.slice(1)}Remove`];
  const pdf = pendingGuidePdfs[lang];
  if (!statusEl || !removeEl) return;
  if (!pdf || !pdf.data) {
    statusEl.innerHTML = "";
    removeEl.classList.add("hidden");
    return;
  }
  statusEl.innerHTML = `<small>${escapeHtml(t("guide.pdfStored"))} ${escapeHtml(pdf.name || "anleitung.pdf")}</small>`;
  removeEl.classList.remove("hidden");
}

function renderAllGuidePdfStatusesInForm() {
  GUIDE_PDF_LANGS.forEach((lang) => renderGuidePdfStatusInForm(lang));
}

function resetGuideDbForm() {
  activeGuideDbId = "";
  pendingGuidePdfs = { de: null, en: null, es: null };
  if (el.guideDbForm) el.guideDbForm.reset();
  GUIDE_PDF_LANGS.forEach((lang) => {
    const input = el[`guidePdf${lang.charAt(0).toUpperCase()}${lang.slice(1)}`];
    if (input) input.value = "";
  });
  renderAllGuidePdfStatusesInForm();
  if (el.guideDbSaveButton) el.guideDbSaveButton.textContent = t("guide.save");
}

function downloadGuidePdf(entry, lang) {
  const pdfs = sanitizeGuidePdfs(entry && entry.pdfs);
  const pdf = pdfs[lang];
  if (!pdf) {
    showToast(t("guide.noPdf"));
    return;
  }
  const link = document.createElement("a");
  link.href = pdf.data;
  link.download = pdf.name || "anleitung.pdf";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function renderGuideDownloadButtons(entry, includeAdmin) {
  const pdfs = sanitizeGuidePdfs(entry.pdfs);
  const langLabels = { de: "guide.downloadDe", en: "guide.downloadEn", es: "guide.downloadEs" };
  const downloads = GUIDE_PDF_LANGS.filter((lang) => pdfs[lang])
    .map((lang) => `<button class="text-button" type="button" data-download-guide="${escapeHtml(entry.id)}" data-pdf-lang="${lang}">${escapeHtml(t(langLabels[lang]))}</button>`)
    .join("");
  const admin = includeAdmin
    ? `
      <button class="text-button" type="button" data-edit-guide="${escapeHtml(entry.id)}">${escapeHtml(t("guide.edit"))}</button>
      <button class="text-button" type="button" data-delete-guide="${escapeHtml(entry.id)}">${escapeHtml(t("guide.delete"))}</button>`
    : "";
  return `<div class="guide-db-downloads">${downloads}${admin}</div>`;
}

function renderGuideDb() {
  if (!el.guideDbList) return;
  const isChef = isFullChefSession();
  if (el.guideDbForm) el.guideDbForm.classList.toggle("hidden", !isChef);
  if (!guideDb.length) {
    el.guideDbList.innerHTML = `<div class="guide-db-item"><p>${escapeHtml(t("guide.empty"))}</p></div>`;
    return;
  }

  el.guideDbList.innerHTML = getGuideDbEntriesForDisplay().map((entry) => {
    const title = getGuideDisplayName(entry);
    const namesSub = t("guide.namesSub", { de: entry.nameDe || "—", en: entry.nameEn || "—" });
    return `
      <article class="guide-db-item" data-guide-id="${escapeHtml(entry.id)}">
        <div class="guide-db-item-head">
          <strong>${escapeHtml(title)}</strong>
          ${isChef ? `<span class="guide-db-item-sub">${escapeHtml(namesSub)}</span>` : ""}
        </div>
        ${renderGuideDownloadButtons(entry, isChef)}
      </article>`;
  }).join("");

  el.guideDbList.querySelectorAll("[data-download-guide]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-download-guide");
      const lang = btn.getAttribute("data-pdf-lang");
      const entry = guideDb.find((g) => g.id === id);
      if (entry && lang) downloadGuidePdf(entry, lang);
    });
  });
  el.guideDbList.querySelectorAll("[data-edit-guide]").forEach((btn) => {
    btn.addEventListener("click", () => startEditGuideEntry(btn.getAttribute("data-edit-guide")));
  });
  el.guideDbList.querySelectorAll("[data-delete-guide]").forEach((btn) => {
    btn.addEventListener("click", () => deleteGuideEntry(btn.getAttribute("data-delete-guide")));
  });
}

function addGuideEntry(nameDe, nameEn, pdfs) {
  const record = sanitizeGuideEntry({
    id: createId(),
    nameDe,
    nameEn,
    pdfs: sanitizeGuidePdfs(pdfs)
  });
  guideDb.unshift(record);
  persistGuideDb();
  renderGuideDb();
}

function updateGuideEntry(id, nameDe, nameEn, pdfs) {
  const index = guideDb.findIndex((g) => g.id === id);
  if (index < 0) return;
  guideDb[index] = sanitizeGuideEntry(Object.assign({}, guideDb[index], {
    nameDe,
    nameEn,
    pdfs: sanitizeGuidePdfs(pdfs)
  }));
  persistGuideDb();
  renderGuideDb();
}

function startEditGuideEntry(id) {
  const entry = guideDb.find((g) => g.id === id);
  if (!entry || !isFullChefSession()) return;
  activeGuideDbId = id;
  if (el.guideNameDe) el.guideNameDe.value = entry.nameDe || "";
  if (el.guideNameEn) el.guideNameEn.value = entry.nameEn || "";
  pendingGuidePdfs = sanitizeGuidePdfs(entry.pdfs);
  GUIDE_PDF_LANGS.forEach((lang) => {
    const input = el[`guidePdf${lang.charAt(0).toUpperCase()}${lang.slice(1)}`];
    if (input) input.value = "";
  });
  renderAllGuidePdfStatusesInForm();
  if (el.guideDbSaveButton) el.guideDbSaveButton.textContent = t("guide.saveUpdate");
  showToast(t("toast.guideLoaded"));
  if (el.guideDbForm) el.guideDbForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteGuideEntry(id) {
  guideDb = guideDb.filter((g) => g.id !== id);
  persistGuideDb();
  if (activeGuideDbId === id) resetGuideDbForm();
  renderGuideDb();
  showToast(t("toast.guideDeleted"));
}

function positionGuideDbNavTab() {
  if (!el.guideDbTab || !el.moduleTabs) return;
  if (isFullChefSession() && el.customerDbTab) {
    const next = el.customerDbTab.nextElementSibling;
    if (next !== el.guideDbTab) {
      el.moduleTabs.insertBefore(el.guideDbTab, el.customerDbTab.nextSibling);
    }
    return;
  }
  if (el.moduleTabs.lastElementChild !== el.guideDbTab) {
    el.moduleTabs.appendChild(el.guideDbTab);
  }
}

/**
 * Entfernt Ledger-Einträge einer Checkliste über alle Kunden hinweg.
 * Aufruf nach erfolgreichem `persist()` beim Löschen der Checkliste.
 */
function removeExtraCostLedgerRowsForSubmission(submissionId) {
  const sid = String(submissionId || "").trim();
  if (!sid) return;
  let dirty = false;
  customerDb = customerDb.map((c) => {
    const ledger = Array.isArray(c.extraCostLedger) ? c.extraCostLedger : [];
    const next = ledger.filter((row) => row && String(row.submissionId) !== sid);
    if (next.length !== ledger.length) dirty = true;
    return Object.assign({}, c, { extraCostLedger: next });
  });
  if (dirty) persistCustomerDb();
}

/**
 * Bei Einreichung: Ledger je Kunde pflegen (pro Checkliste höchstens ein Eintrag, bei erneutem Einreichen ersetzt).
 */
function syncExtraCostLedgerForSubmittedEntry(entry) {
  if (!entry || !entry.id) return;
  const submissionId = entry.id;
  customerDb = customerDb.map((c) => {
    const ledger = Array.isArray(c.extraCostLedger) ? c.extraCostLedger : [];
    const next = ledger.filter((row) => !row || String(row.submissionId) !== String(submissionId));
    return Object.assign({}, c, { extraCostLedger: next });
  });

  const ex = entry.extraCosts;
  if (!ex || !ex.enabled) {
    persistCustomerDb();
    return;
  }
  let amt = Number.isFinite(Number(ex.amountEuro)) && Number(ex.amountEuro) > 0
    ? Number(ex.amountEuro)
    : parseEuroAmount(ex.euroRaw || "");
  if (amt == null || !(amt > 0)) {
    persistCustomerDb();
    return;
  }
  amt = Math.round(amt * 100) / 100;
  const cid = String(entry.customerId || "").trim();
  if (!cid) {
    persistCustomerDb();
    return;
  }
  const idx = customerDb.findIndex((c) => c.id === cid);
  if (idx < 0) {
    persistCustomerDb();
    return;
  }
  const prev = customerDb[idx];
  const ledger = [...(Array.isArray(prev.extraCostLedger) ? prev.extraCostLedger : [])];
  const submittedIso = entry.submittedAt || entry.createdAt || new Date().toISOString();
  const monthKey = String(submittedIso).slice(0, 7);
  ledger.push({
    id: createId(),
    submissionId: String(submissionId),
    monthKey,
    amountEuro: amt,
    recordedAt: new Date().toISOString(),
    comment: String(ex.comment || "").trim().slice(0, 500),
    checklistLabel: String(entry.checklistTemplateName || entry.jobTitle || "").trim().slice(0, 200)
  });
  customerDb[idx] = Object.assign({}, prev, { extraCostLedger: ledger });
  persistCustomerDb();
}

function loadSession() {
  const sessionStored = sessionStorage.getItem(sessionKey);
  const localStored = localStorage.getItem(sessionKey);
  const stored = sessionStored || localStored;
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (error) {
    return null;
  }
}

function persistSession(session, remember = false) {
  if (session) {
    const serialized = JSON.stringify(session);
    if (remember) {
      localStorage.setItem(sessionKey, serialized);
      sessionStorage.removeItem(sessionKey);
    } else {
      sessionStorage.setItem(sessionKey, serialized);
      localStorage.removeItem(sessionKey);
    }
  } else {
    localStorage.removeItem(sessionKey);
    sessionStorage.removeItem(sessionKey);
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
        items: (() => {
          const hausTpl = checklistTemplates.find((t) => t.id === HAUS_CHECKLIST_TEMPLATE_ID) || checklistTemplates[0];
          const pts = hausTpl && hausTpl.checkpoints && hausTpl.checkpoints.length ? hausTpl.checkpoints : [...fallbackCheckpointItems];
          return pts.map((pt) => {
            const def = typeof pt === "string"
              ? normalizeCheckpointDef(pt)
              : normalizeCheckpointDef(pt, { explicit: true });
            const canon = checkpointCanonical(def);
            return {
              checked: false,
              locales: def,
              checkpointCanon: canon,
              text: canon
            };
          });
        })(),
        checklistTemplateId: HAUS_CHECKLIST_TEMPLATE_ID,
        checklistTemplateName: (checklistTemplates.find((t) => t.id === HAUS_CHECKLIST_TEMPLATE_ID) || checklistTemplates[0] || {}).name || "Haus & Garten"
      }
    ];
  }

  try {
    submissionEmailBackfillDirty = false;
    const parsed = JSON.parse(stored);
    return parsed.map((entry) => {
      const normalizedEntry = Object.assign({}, entry);
      normalizedEntry.items = (entry.items || []).map((item) => {
        const loc = item.locales && typeof item.locales === "object"
          ? normalizeCheckpointDef(item.locales, { explicit: true })
          : normalizeCheckpointDef(item.text);
        let canonKey = String(item.checkpointCanon || "").trim()
          || loc.de
          || loc.en
          || String(item.text || "").trim();
        if (!canonKey) canonKey = t("chk.unnamed");
        const localesOut = loc.de || loc.en ? loc : normalizeCheckpointDef(canonKey);
        return {
          checked: Boolean(item.checked),
          locales: localesOut,
          checkpointCanon: canonKey,
          text: canonKey,
          comment: item.comment || "",
          photo: item.photo || null
        };
      });
      const extraCosts = entry.extraCosts || {};
      const rawEuro = extraCosts.amountEuro;
      let amountEuro =
        typeof rawEuro === "number" && Number.isFinite(rawEuro) && rawEuro > 0
          ? Math.round(rawEuro * 100) / 100
          : null;
      if (amountEuro == null) {
        const parsed = parseEuroAmount(extraCosts.euroRaw || "");
        if (parsed != null && parsed > 0) amountEuro = Math.round(parsed * 100) / 100;
      }
      normalizedEntry.extraCosts = {
        enabled: Boolean(extraCosts.enabled),
        euroRaw: typeof extraCosts.euroRaw === "string" ? extraCosts.euroRaw : "",
        amountEuro,
        comment: extraCosts.comment || "",
        photo: extraCosts.photo || null
      };
      const tplId = entry.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID;
      normalizedEntry.checklistTemplateId = tplId;
      const tplMeta = getChecklistTemplateById(tplId);
      normalizedEntry.checklistTemplateName = entry.checklistTemplateName || (tplMeta ? tplMeta.name : "");
      normalizedEntry.customerId = String(normalizedEntry.customerId || "").trim();
      let mail = normalizedEntry.customerEmail ? String(normalizedEntry.customerEmail).trim() : "";
      const prevMail = mail;
      if (!mail && normalizedEntry.customerId) {
        const custById = customerDb.find((c) => c.id === normalizedEntry.customerId);
        if (custById && custById.email) mail = String(custById.email).trim();
      }
      if (!mail && normalizedEntry.customerName) {
        const guessedId = resolveCustomerIdByName(String(normalizedEntry.customerName || ""));
        if (guessedId) {
          const cust = customerDb.find((c) => c.id === guessedId);
          if (cust && cust.email) mail = String(cust.email).trim();
        }
      }
      normalizedEntry.customerEmail = mail;
      if (mail && mail !== prevMail) submissionEmailBackfillDirty = true;
      return normalizedEntry;
    });
  } catch (error) {
    return [];
  }
}

function isQuotaExceededError(err) {
  if (!err) return false;
  return err.name === "QuotaExceededError" || err.code === 22;
}

/** Dateiname ohne riskante Pfad-Segmente, Endung `.jpg` (nach JPEG-Verdichtung). */
function compressPhotoBasename(filename) {
  const raw = String(filename || "photo").replace(/\\/g, "/").split("/").pop() || "photo";
  const stem = raw.replace(/\.[^/.]+$/, "");
  const safe = stem.trim().slice(0, 96) || "photo";
  return `${safe}.jpg`;
}

function shrinkDataUrlToJpeg(dataUrl, maxSide, quality) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(dataUrl);
          return;
        }
        let tw = w;
        let th = h;
        if (w > maxSide || h > maxSide) {
          if (w >= h) {
            tw = maxSide;
            th = Math.round(h * (maxSide / w));
          } else {
            th = maxSide;
            tw = Math.round(w * (maxSide / h));
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, tw);
        canvas.height = Math.max(1, th);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, tw, th);
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.decoding = "async";
    img.src = dataUrl;
  });
}

async function finalizeUploadedChecklistImage(readerResult, originalFilename) {
  const data = await shrinkDataUrlToJpeg(readerResult, 1680, 0.82);
  const name = compressPhotoBasename(originalFilename || "photo");
  return { name, data };
}

function sanitizeStoredChecklistPhoto(photo) {
  if (!photo || typeof photo !== "object") return null;
  const data = typeof photo.data === "string" && photo.data.startsWith("data:image/") ? photo.data : "";
  if (!data) return null;
  const name = typeof photo.name === "string" && photo.name.trim() ? photo.name.trim().slice(0, 120) : "photo.jpg";
  return { name, data };
}

function sanitizeStoredCustomerContractPdf(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = typeof raw.data === "string" && raw.data.startsWith("data:application/pdf") ? raw.data : "";
  if (!data) return null;
  let name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 120) : "Kundenvertrag.pdf";
  if (!name.toLowerCase().endsWith(".pdf")) name = `${name}.pdf`;
  return { name, data };
}

function readCustomerContractPdfFile(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(String(file.name || ""));
    if (!isPdf) {
      showToast(t("toast.contractPdfType"));
      resolve(null);
      return;
    }
    if (file.size > MAX_CUSTOMER_CONTRACT_PDF_BYTES) {
      showToast(t("toast.contractPdfSize"));
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      if (!data.startsWith("data:application/pdf")) {
        showToast(t("toast.contractPdfType"));
        resolve(null);
        return;
      }
      let name = String(file.name || "Kundenvertrag.pdf").trim().slice(0, 120) || "Kundenvertrag.pdf";
      if (!name.toLowerCase().endsWith(".pdf")) name = `${name}.pdf`;
      resolve({ name, data });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function renderCustomerContractStatusInDb() {
  if (!el.dbContractStatus || !el.dbContractRemove) return;
  if (!pendingCustomerContractPdf || !pendingCustomerContractPdf.data) {
    el.dbContractStatus.innerHTML = "";
    el.dbContractRemove.classList.add("hidden");
    return;
  }
  el.dbContractStatus.innerHTML = `<small>${escapeHtml(t("cust.contractStored"))} ${escapeHtml(pendingCustomerContractPdf.name || "Kundenvertrag.pdf")}</small>`;
  el.dbContractRemove.classList.remove("hidden");
}

function downloadCustomerContractPdf(entry) {
  const pdf = sanitizeStoredCustomerContractPdf(entry && entry.contractPdf);
  if (!pdf) return;
  const link = document.createElement("a");
  link.href = pdf.data;
  link.download = pdf.name || "Kundenvertrag.pdf";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function renderCustomerOrientationPreviewInDb() {
  if (!el.dbOrientationPreview || !el.dbOrientationRemove) return;
  if (!pendingCustomerOrientationPhoto || !pendingCustomerOrientationPhoto.data) {
    el.dbOrientationPreview.innerHTML = "";
    el.dbOrientationRemove.classList.add("hidden");
    return;
  }
  el.dbOrientationPreview.innerHTML = `
    <figure>
      <img src="${pendingCustomerOrientationPhoto.data}" alt="${escapeHtml(pendingCustomerOrientationPhoto.name || "orientation")}" />
    </figure>
  `;
  el.dbOrientationRemove.classList.remove("hidden");
}

function resolveChecklistCustomerEntry() {
  const byId = activeCustomerId ? customerDb.find((c) => c.id === activeCustomerId) : null;
  if (byId) return byId;
  const guessedId = resolveCustomerIdByName(el.customerName ? el.customerName.value.trim() : "");
  return guessedId ? (customerDb.find((c) => c.id === guessedId) || null) : null;
}

function renderChecklistCustomerOrientationPhoto() {
  if (!el.customerOrientationWrap || !el.customerOrientationPreview) return;
  const customer = resolveChecklistCustomerEntry();
  const photo = customer ? sanitizeStoredChecklistPhoto(customer.orientationPhoto) : null;
  if (!photo || !photo.data) {
    el.customerOrientationWrap.classList.add("hidden");
    el.customerOrientationPreview.innerHTML = "";
    return;
  }
  el.customerOrientationWrap.classList.remove("hidden");
  el.customerOrientationPreview.innerHTML = `
    <figure>
      <button type="button" class="customer-orientation-open-original" data-full-src="${escapeHtml(photo.data)}" data-full-name="${escapeHtml(photo.name || "orientation.jpg")}">
        <img src="${photo.data}" alt="${escapeHtml(photo.name || "orientation")}" />
      </button>
      <figcaption>${escapeHtml(t("chk.customerPhotoOpenHint"))}</figcaption>
    </figure>
  `;
}

function closeImageLightbox() {
  if (!el.imageLightbox || !el.imageLightboxImage) return;
  el.imageLightbox.classList.add("hidden");
  el.imageLightboxImage.src = "";
  el.imageLightboxImage.alt = "";
  document.body.style.overflow = "";
}

function openImageLightbox(dataUrl, fileName) {
  if (!el.imageLightbox || !el.imageLightboxImage) return false;
  if (!String(dataUrl || "").startsWith("data:image/")) return false;
  el.imageLightboxImage.src = dataUrl;
  el.imageLightboxImage.alt = fileName || "orientation";
  el.imageLightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  return true;
}

async function compactSubmissionPhotosDeep(entry, maxSide, quality) {
  if (!entry || typeof entry !== "object") return;

  const touchPhoto = async (photo) => {
    if (!photo || typeof photo !== "object" || typeof photo.data !== "string" || !photo.data.startsWith("data:image")) {
      return;
    }
    const next = await shrinkDataUrlToJpeg(photo.data, maxSide, quality);
    if (next !== photo.data && typeof photo.name === "string" && photo.name.length) {
      photo.name = compressPhotoBasename(photo.name);
    }
    photo.data = next;
  };

  if (Array.isArray(entry.items)) {
    for (const item of entry.items) {
      if (item && item.photo) await touchPhoto(item.photo);
    }
  }
  if (Array.isArray(entry.photos)) {
    for (const photo of entry.photos) {
      await touchPhoto(photo);
    }
  }
  if (entry.extraCosts && entry.extraCosts.photo) {
    await touchPhoto(entry.extraCosts.photo);
  }
}

async function compactAllSubmissionPhotos(entries, maxSide, quality) {
  for (const entry of entries) {
    await compactSubmissionPhotosDeep(entry, maxSide, quality);
  }
}

/**
 * Schreibt `submissions` in localStorage. Bei Quotenüberschreitung werden Fotos automatisch verdichtet.
 * @returns {Promise<boolean>} `true`, wenn eine Verdichtung nötig war
 */
async function persist() {
  const write = () => {
    localStorage.setItem(storageKey, JSON.stringify(submissions));
  };

  try {
    write();
    return false;
  } catch (err) {
    if (!isQuotaExceededError(err)) throw err;

    await compactAllSubmissionPhotos(submissions, 1360, 0.74);
    try {
      write();
      return true;
    } catch (err2) {
      if (!isQuotaExceededError(err2)) throw err2;

      await compactAllSubmissionPhotos(submissions, 960, 0.55);
      try {
        write();
        return true;
      } catch (err3) {
        if (!isQuotaExceededError(err3)) throw err3;

        await compactAllSubmissionPhotos(submissions, 720, 0.42);
        write();
        return true;
      }
    }
  }
}

function coerceAttendanceTime(raw) {
  const value = String(raw || "").trim();
  return /^\d{2}:\d{2}$/.test(value) ? value : "";
}

function normalizeAttendanceCorrection(raw) {
  if (!raw || typeof raw !== "object") return null;
  const status = raw.status === "pending" || raw.status === "rejected" ? raw.status : null;
  if (!status) return null;
  return {
    status,
    suggestedCome: coerceAttendanceTime(raw.suggestedCome),
    suggestedBreakStart: coerceAttendanceTime(raw.suggestedBreakStart),
    suggestedBreakEnd: coerceAttendanceTime(raw.suggestedBreakEnd),
    suggestedLeave: coerceAttendanceTime(raw.suggestedLeave),
    employeeNote: typeof raw.employeeNote === "string" ? raw.employeeNote.trim().slice(0, 2000) : "",
    requestedAt: typeof raw.requestedAt === "string" ? raw.requestedAt : new Date().toISOString(),
    reviewedAt: typeof raw.reviewedAt === "string" ? raw.reviewedAt.trim() : "",
    chefNote: typeof raw.chefNote === "string" ? raw.chefNote.trim().slice(0, 2000) : ""
  };
}

function normalizeDailyAttendanceRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : "";
  const employeeUsername = typeof raw.employeeUsername === "string" ? raw.employeeUsername.trim() : "";
  if (!date || !employeeUsername) return null;
  const correction = normalizeAttendanceCorrection(raw.correction);
  const base = {
    date,
    employeeUsername,
    come: coerceAttendanceTime(raw.come),
    breakStart: coerceAttendanceTime(raw.breakStart),
    breakEnd: coerceAttendanceTime(raw.breakEnd),
    leave: coerceAttendanceTime(raw.leave),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
  };
  if (correction) base.correction = correction;
  return base;
}

function loadDailyAttendance() {
  const stored = localStorage.getItem(dailyAttendanceKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeDailyAttendanceRecord).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function persistDailyAttendance() {
  localStorage.setItem(dailyAttendanceKey, JSON.stringify(dailyAttendanceRecords));
}

function getDailyAttendanceRecord(username, dateIso) {
  return dailyAttendanceRecords.find((r) => r.employeeUsername === username && r.date === dateIso) || null;
}

function upsertDailyAttendanceField(username, dateIso, field, timeValue) {
  let record = dailyAttendanceRecords.find((r) => r.employeeUsername === username && r.date === dateIso);
  if (record && record.correction && record.correction.status === "pending") return;
  if (!record) {
    record = {
      date: dateIso,
      employeeUsername: username,
      come: "",
      breakStart: "",
      breakEnd: "",
      leave: "",
      updatedAt: new Date().toISOString()
    };
    dailyAttendanceRecords.push(record);
  }
  record[field] = timeValue;
  record.updatedAt = new Date().toISOString();
  persistDailyAttendance();
}

function dailyAttendanceHasAnyStamp(rec) {
  if (!rec) return false;
  return Boolean(rec.come || rec.breakStart || rec.breakEnd || rec.leave);
}

function getEmployeeLabelByUsername(username) {
  const user = users.find((u) => u.username === username);
  return user && user.label ? user.label : username || t("common.emDash");
}

function formatIsoDateDeShort(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || t("common.emDash");
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function applyApprovedDailyAttendanceCorrection(record) {
  const c = record && record.correction;
  if (!c || c.status !== "pending") return false;
  const applyIf = (field, suggested) => {
    const v = coerceAttendanceTime(suggested);
    if (v) record[field] = v;
  };
  applyIf("come", c.suggestedCome);
  applyIf("breakStart", c.suggestedBreakStart);
  applyIf("breakEnd", c.suggestedBreakEnd);
  applyIf("leave", c.suggestedLeave);
  delete record.correction;
  record.updatedAt = new Date().toISOString();
  persistDailyAttendance();
  return true;
}

function rejectDailyAttendanceCorrectionRecord(record, chefNote) {
  const c = record && record.correction;
  if (!c || c.status !== "pending") return false;
  record.correction = Object.assign({}, c, {
    status: "rejected",
    reviewedAt: new Date().toISOString(),
    chefNote: String(chefNote || "").trim().slice(0, 2000)
  });
  record.updatedAt = new Date().toISOString();
  persistDailyAttendance();
  return true;
}

function formatDate(value) {
  if (!value) return "-";
  const intlLc = WC ? WC.intlLocale() : "de-DE";
  return new Intl.DateTimeFormat(intlLc, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

/** Nur Datum (z. B. PDF „Tag der Begehung“). */
function formatDateDayOnly(value) {
  if (!value) return "\u2014";
  const intlLc = WC ? WC.intlLocale() : "de-DE";
  return new Intl.DateTimeFormat(intlLc, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function getStatusLabel(status) {
  if (status === "draft") return t("status.draft");
  if (status === "submitted") return t("status.submitted");
  if (status === "approved") return t("status.approved");
  return status;
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

function escapeHtmlMultilineAsBr(text) {
  const raw = String(text != null ? text : "");
  if (!raw.trim()) return "";
  return raw.split(/\n/).map((line) => escapeHtml(line.replace(/\r$/, ""))).join("<br />");
}

function sanitizeDownloadFilename(raw) {
  const base = String(raw || "").trim() || "zusatzkosten-bild.jpg";
  return base.replace(/[/\\\x00-\x1f"<>|:?*]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3300);
}

function nowTime() {
  const intlLc = WC ? WC.intlLocale() : "de-DE";
  return new Intl.DateTimeFormat(intlLc, { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function setEmployeeTime(type) {
  const time = nowTime();
  if (type === "come") {
    if (el.comeButton.disabled) return;
    el.comeTimeDisplay.textContent = time;
    el.comeButton.disabled = true;
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
    void saveChecklist("draft", { resetAfterSave: false, silent: true }).catch((err) => console.error(err));
    markAssignmentInProgress();
  }
}

function setRole(role) {
  currentRole = role;
  el.roleEyebrow.textContent = role === "employee" ? t("roles.employee") : t("roles.chef");
  el.pageTitle.textContent = role === "employee" ? t("page.fillChecklist") : t("page.reviewChecklists");
  if (!getAvailableSections().includes(activeSection)) {
    activeSection = "checklist";
  }
  if (role !== "boss") calendarPlanningOpen = false;
  el.calendarStaffForm.classList.toggle("hidden", role !== "boss" || !calendarPlanningOpen);
  el.calendarNewAssignmentButton.classList.toggle("hidden", role !== "boss");
  if (el.calendarEmployeeFilter) el.calendarEmployeeFilter.classList.toggle("hidden", role !== "boss");
  el.newChecklistButton.classList.toggle("hidden", role === "employee");
  el.customerName.readOnly = role === "employee" || Boolean(lockedCustomerName);
  render();
}

function getEmployeeUsers() {
  return users.filter((user) => user.role === "employee");
}

function getEmployeeLabelByUsername(username) {
  const user = getEmployeeUsers().find((item) => item.username === username);
  return user ? user.label : username || "";
}

function getAvailableSections() {
  if (isFullChefSession()) return ["checklist", "workOrder", "customerDb", "guideDb", "calendar", "worktime", "checkpoints"];
  if (currentSession && currentSession.role === "employee") return ["checklist", "workOrder", "calendar", "worktime", "guideDb"];
  return ["checklist", "workOrder", "calendar", "worktime", "guideDb"];
}

function setActiveSection(section) {
  if (!getAvailableSections().includes(section)) return;
  activeSection = section;
  renderSectionVisibility();
  if (section === "worktime") {
    renderWorktimeSummary();
    renderEmployeeDailyWorkPanel();
  }
  if (section === "workOrder") {
    renderWorkOrdersPanel();
  }
  if (section === "guideDb") {
    renderGuideDb();
  }
}

function renderSectionVisibility() {
  const isFullChef = isFullChefSession();
  const isRestrictedBoss = isRestrictedBossSession();
  el.customerDbTab.classList.toggle("hidden", !isFullChef);
  if (el.guideDbTab) el.guideDbTab.classList.remove("hidden");
  positionGuideDbNavTab();
  el.worktimeTab.classList.remove("hidden");
  el.checkpointTab.classList.toggle("hidden", !isFullChef);
  el.moduleTabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === activeSection);
  });

  el.checklistSection.classList.toggle("hidden", activeSection !== "checklist");
  el.customerDbPanel.classList.toggle("hidden", activeSection !== "customerDb" || !isFullChef);
  if (el.guideDbPanel) el.guideDbPanel.classList.toggle("hidden", activeSection !== "guideDb");
  el.calendarPanel.classList.toggle("hidden", activeSection !== "calendar");
  if (el.workOrdersPanel) el.workOrdersPanel.classList.toggle("hidden", activeSection !== "workOrder");
  el.worktimePanel.classList.toggle("hidden", activeSection !== "worktime");
  el.checkpointPanel.classList.toggle("hidden", activeSection !== "checkpoints" || !isFullChef);

  const employeeDayWorkVisible = Boolean(activeSection === "worktime" && currentSession && currentSession.role === "employee");
  const chefWorktimeSummaryVisible = Boolean(
    activeSection === "worktime"
    && currentSession
    && currentSession.role === "boss"
    && (isFullChef || isRestrictedBoss)
  );
  if (el.employeeDayWorkPanel) el.employeeDayWorkPanel.classList.toggle("hidden", !employeeDayWorkVisible);
  if (el.chefWorktimeSummaryPanel) el.chefWorktimeSummaryPanel.classList.toggle("hidden", !chefWorktimeSummaryVisible);

  if (el.pageTitle && currentRole && currentSession) {
    if (activeSection === "worktime") {
      el.pageTitle.textContent = t("page.worktime");
    } else if (activeSection === "checklist") {
      el.pageTitle.textContent = currentRole === "employee" ? t("page.fillChecklist") : t("page.reviewChecklists");
    } else if (activeSection === "calendar") {
      el.pageTitle.textContent = currentSession.role === "boss" ? t("page.calendarBoss") : t("page.calendar");
    } else if (activeSection === "workOrder") {
      el.pageTitle.textContent = t("page.workOrder");
    } else if (activeSection === "customerDb") {
      el.pageTitle.textContent = t("page.customerDb");
    } else if (activeSection === "guideDb") {
      el.pageTitle.textContent = t("page.guideDb");
    } else if (activeSection === "checkpoints") {
      el.pageTitle.textContent = t("page.checkpoints");
    }
  }

  const showChecklist = activeSection === "checklist";
  el.employeeView.classList.toggle("active", showChecklist && currentRole === "employee");
  el.bossView.classList.toggle("active", showChecklist && currentRole === "boss");
  const showBossFilters = showChecklist && currentRole === "boss" && (isFullChef || isRestrictedBoss);
  if (el.bossFilterPanel) el.bossFilterPanel.classList.toggle("hidden", !showBossFilters);
  else if (el.bossSearchRow) el.bossSearchRow.classList.toggle("hidden", !showBossFilters);

  const employeeNeedsCalendarStart = currentRole === "employee" && !employeeChecklistUnlocked && !activeChecklistId && !activeAssignmentId;
  el.checklistForm.classList.toggle("hidden", employeeNeedsCalendarStart);
  el.employeeChecklistLockedHint.classList.toggle("hidden", !employeeNeedsCalendarStart);
}

function applyDefaultStatusFiltersOnLogin(role) {
  const defaultStatus = "submitted";
  if (role === "employee") {
    if (el.employeeChecklistStatusFilter) el.employeeChecklistStatusFilter.value = defaultStatus;
    if (el.workOrdersStatusFilter) el.workOrdersStatusFilter.value = defaultStatus;
    return;
  }
  if (role === "boss") {
    if (el.statusFilter) el.statusFilter.value = defaultStatus;
    if (el.workOrdersStatusFilter) el.workOrdersStatusFilter.value = defaultStatus;
  }
}

function login(username, password, remember = false) {
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const user = users.find((item) => item.username === normalizedUsername && item.password === normalizedPassword);
  if (!user) {
    if (el.loginError) {
      el.loginError.textContent = t("auth.error");
      el.loginError.classList.remove("hidden");
    }
    showToast(t("toast.loginFail"));
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
  if (Array.isArray(user.manageEmployeeUsernames) && user.manageEmployeeUsernames.length) {
    currentSession.manageEmployeeUsernames = user.manageEmployeeUsernames.slice();
  }
  if (Array.isArray(user.allowedChecklistTemplateIds) && user.allowedChecklistTemplateIds.length) {
    currentSession.allowedChecklistTemplateIds = user.allowedChecklistTemplateIds.slice();
    const defaultTpl = user.allowedChecklistTemplateIds[0];
    checkpointManagerTemplateId = defaultTpl;
    activeFormChecklistTemplateId = defaultTpl;
    lastCustomerCheckpointTemplateChoice = defaultTpl;
  }
  persistSession(currentSession, remember);
  applyDefaultStatusFiltersOnLogin(user.role);
  el.sessionUser.textContent = `${user.label} (${user.username})`;
  el.authScreen.classList.add("hidden");
  el.appShell.classList.remove("hidden");
  resetForm();
  setRole(user.role);
  showToast(t("toast.welcome", { label: user.label }));
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
  showToast(t("toast.logout"));
}

function renderItemPhoto(node, photo) {
  const preview = node.querySelector(".item-photo-preview");
  preview.innerHTML = "";
  if (!photo || !photo.data) return;
  const figure = document.createElement("figure");
  const image = document.createElement("img");
  image.src = photo.data;
  image.alt = photo.name || t("img.altCp");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "×";
  removeBtn.className = "item-photo-remove";
  removeBtn.setAttribute("aria-label", t("item.removeImgAria"));
  removeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    node._itemPhoto = null;
    renderItemPhoto(node, null);
  });
  figure.appendChild(image);
  figure.appendChild(removeBtn);
  preview.appendChild(figure);
}

function addChecklistItem(textOrLocales = "", checked = false, comment = "", photo = null, checkpointCanon = "", parentEl = null) {
  const parent = parentEl || el.checklistItems;
  if (!parent) return;
  const node = el.itemTemplate.content.firstElementChild.cloneNode(true);
  const checkbox = node.querySelector("input");
  const label = node.querySelector("span");
  const commentField = node.querySelector(".item-comment-input");
  const photoInput = node.querySelector(".item-photo-input");
  const photoTrigger = node.querySelector(".item-photo-trigger");
  checkbox.checked = checked;
  const locales = parseLocalesArg(textOrLocales);
  node._itemLocales = { ...locales };
  const canon = String(checkpointCanon || "").trim() || locales.de || locales.en || "";
  if (canon) node.dataset.checkpointCanon = canon;
  node._itemLocales = mergeCheckpointRowLocalesWithTemplate(node);
  const display = itemDisplayLabelFromLocales(node._itemLocales).trim();
  label.textContent = display ? display : t("chk.newItemDefault");
  commentField.value = comment;
  node._itemPhoto = photo;
  renderItemPhoto(node, node._itemPhoto);
  if (WC) WC.applyToScope(node);
  photoTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    photoInput.click();
  });
  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        node._itemPhoto = await finalizeUploadedChecklistImage(reader.result, file.name);
      } catch (e) {
        console.error(e);
        node._itemPhoto = { name: file.name, data: reader.result };
      }
      renderItemPhoto(node, node._itemPhoto);
    };
    reader.readAsDataURL(file);
    photoInput.value = "";
  });
  node.querySelector(".remove-item").addEventListener("click", () => {
    if (el.checklistItems.querySelectorAll(".check-item").length === 1) {
      showToast(t("toast.cpMinOne"));
      return;
    }
    node.remove();
  });
  parent.appendChild(node);
}

function renderExtraCostsPhoto() {
  if (!el.extraCostsPhotoPreview) return;
  el.extraCostsPhotoPreview.innerHTML = "";
  if (!extraCostsPhoto || !extraCostsPhoto.data) return;
  const figure = document.createElement("figure");
  const image = document.createElement("img");
  image.src = extraCostsPhoto.data;
  image.alt = extraCostsPhoto.name || t("chk.extraPhotoHead");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "×";
  removeBtn.setAttribute("aria-label", t("extra.removeAria"));
  removeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    extraCostsPhoto = null;
    renderExtraCostsPhoto();
  });
  figure.appendChild(image);
  figure.appendChild(removeBtn);
  el.extraCostsPhotoPreview.appendChild(figure);
}

function setExtraCostsEnabled(enabled) {
  const isEnabled = Boolean(enabled);
  if (el.extraCostsEnabled) el.extraCostsEnabled.checked = isEnabled;
  if (el.extraCostsFields) el.extraCostsFields.classList.toggle("hidden", !isEnabled);
  // Kein HTML5-required hier: Bei Zusatzkosten prüfen wir beim Einreichen manuell (Eurobetrag).
  // Sonst kann reportValidity() blockieren (z. B. versteckte oder gemerkte Constraints), ohne dass der Mitarbeiter es sieht.
  if (el.extraCostsComment) el.extraCostsComment.required = false;
  if (el.extraCostsEuro) el.extraCostsEuro.required = false;
  // Kein HTML5-required am File-Input: nach FileReader wird value geleert –
  // reportValidity() würde sonst immer fehlschlagen obwohl extraCostsPhoto gesetzt ist.
}

function persistCheckpointTemplateAccessFromInputs() {
  const template = getChecklistTemplateById(checkpointManagerTemplateId);
  if (!template || !el.checkpointAccessAllEmployees) return;
  if (el.checkpointAccessAllEmployees.checked) {
    template.assignedEmployeeUsernames = [];
  } else {
    const picks = [...el.checkpointEmployeeAccess.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value);
    template.assignedEmployeeUsernames = picks.length ? picks : getEmployeeUsers().map((employee) => employee.username);
  }
  persistChecklistTemplates();
}

function ensureCheckpointManagerTemplateSelectValues() {
  if (!el.checkpointManagerTemplateSelect) return;
  if (!el.checkpointManagerTemplateSelect.options.length || el.checkpointManagerTemplateSelect.options.length !== checklistTemplates.length) {
    el.checkpointManagerTemplateSelect.innerHTML = checklistTemplates.map((t) => `
      <option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>
    `).join("");
  }
  const validSelection = checklistTemplates.some((template) => template.id === checkpointManagerTemplateId);
  if (!validSelection && checklistTemplates.length) checkpointManagerTemplateId = checklistTemplates[0].id;
  el.checkpointManagerTemplateSelect.value = checkpointManagerTemplateId;
}

function refreshCheckpointStaffUi() {
  ensureCheckpointManagerTemplateSelectValues();
  renderCheckpointEmployeeAccessPanel();
  renderCheckpointManager();
  updateCheckpointHausZoneFieldVisibility();
}

function getSelectedCalendarTemplateIds() {
  if (!el.calendarChecklistTemplateCheckboxes) return [];
  return Array.from(el.calendarChecklistTemplateCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => input.value)
    .filter(Boolean);
}

function rebuildCalendarHausZoneCheckboxRows() {
  if (!el.calendarHausZoneCheckboxes) return;
  el.calendarHausZoneCheckboxes.innerHTML = "";
  HAUS_CHECKPOINT_ZONE_IDS.forEach((zoneId) => {
    const lab = document.createElement("label");
    lab.className = "calendar-haus-zone-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = zoneId;
    input.checked = true;
    const span = document.createElement("span");
    span.textContent = hausZoneGroupTitle(zoneId);
    lab.appendChild(input);
    lab.appendChild(span);
    el.calendarHausZoneCheckboxes.appendChild(lab);
  });
}

function getSelectedCalendarHausGartenZones() {
  if (!el.calendarHausZoneCheckboxes) return [];
  return Array.from(el.calendarHausZoneCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => input.value)
    .filter((id) => isHausCheckpointZoneId(id));
}

function setCalendarHausZoneCheckboxSelection(storedZoneIds) {
  if (!el.calendarHausZoneCheckboxes) return;
  const inputs = [...el.calendarHausZoneCheckboxes.querySelectorAll('input[type="checkbox"]')];
  if (!inputs.length) return;
  const valid = sanitizeAssignmentHausGartenZoneIds(storedZoneIds);
  if (!valid.length) {
    inputs.forEach((input) => {
      input.checked = true;
    });
    return;
  }
  const want = new Set(valid);
  inputs.forEach((input) => {
    input.checked = want.has(input.value);
  });
}

function updateCalendarHausZonesVisibilityUi() {
  const wo = Boolean(el.calendarWorkOrderMode && el.calendarWorkOrderMode.checked);
  const hasHaus = getSelectedCalendarTemplateIds().includes(HAUS_CHECKLIST_TEMPLATE_ID);
  if (el.calendarHausZonesWrap) el.calendarHausZonesWrap.classList.toggle("hidden", wo || !hasHaus);
}

function renderCalendarChecklistTemplateCheckboxes(preselectedIds) {
  if (!el.calendarChecklistTemplateCheckboxes) return;
  let selected;
  if (Array.isArray(preselectedIds)) {
    const known = new Set(getChecklistTemplatesForSession().map((tpl) => tpl.id));
    selected = preselectedIds.map((id) => String(id || "").trim()).filter((id) => known.has(id));
  } else {
    selected = getSelectedCalendarTemplateIds();
  }
  el.calendarChecklistTemplateCheckboxes.innerHTML = "";
  getChecklistTemplatesForSession().forEach((tmpl) => {
    const row = document.createElement("label");
    row.className = "calendar-template-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = tmpl.id;
    input.checked = selected.includes(tmpl.id);
    const caption = document.createElement("span");
    caption.textContent = tmpl.name;
    row.appendChild(input);
    row.appendChild(caption);
    el.calendarChecklistTemplateCheckboxes.appendChild(row);
  });
  if (WC) WC.applyToScope(el.calendarChecklistTemplateCheckboxes);
  el.calendarChecklistTemplateCheckboxes.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", updateCalendarHausZonesVisibilityUi);
  });
  rebuildCalendarHausZoneCheckboxRows();
  setCalendarHausZoneCheckboxSelection(null);
  updateCalendarHausZonesVisibilityUi();
  if (WC && el.calendarHausZonesWrap) WC.applyToScope(el.calendarHausZonesWrap);
}

function populateChecklistFormTemplateSelect(enabled) {
  if (!el.checklistTemplateSelect) return;
  const user = currentSession && currentSession.username;
  const allowed = checklistTemplates.filter((template) => {
    if (currentRole === "boss" && !sessionMayAccessChecklistTemplate(template.id)) return false;
    if (currentRole === "boss") return true;
    return !user || templateAllowsEmployee(template, user);
  });
  el.checklistTemplateSelect.innerHTML = allowed.map((t) => `
    <option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>
  `).join("");
  const fallbackId = activeFormChecklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID;
  const pickId = allowed.some((item) => item.id === fallbackId) ? fallbackId : (allowed[0] ? allowed[0].id : HAUS_CHECKLIST_TEMPLATE_ID);
  el.checklistTemplateSelect.value = pickId;
  activeFormChecklistTemplateId = pickId;
  el.checklistTemplateSelect.disabled = Boolean(!enabled);
}

function toggleChecklistTemplateRowVisibility(show) {
  if (el.checklistTemplateRow) el.checklistTemplateRow.classList.toggle("hidden", !show);
}

function rebuildChecklistItemsFromTemplate(templateId) {
  el.checklistItems.innerHTML = "";
  const tmpl = getChecklistTemplateById(templateId);
  const tid = templateId || HAUS_CHECKLIST_TEMPLATE_ID;
  const points = tmpl && tmpl.checkpoints && tmpl.checkpoints.length ? tmpl.checkpoints : [...fallbackCheckpointItems];
  if (tid === HAUS_CHECKLIST_TEMPLATE_ID) {
    const hausTmpl = getChecklistTemplateById(HAUS_CHECKLIST_TEMPLATE_ID);
    const effective = hausTmpl && hausTmpl.checkpoints && hausTmpl.checkpoints.length
      ? hausTmpl
      : { id: HAUS_CHECKLIST_TEMPLATE_ID, checkpoints: points.map((p) => normalizeTemplateCheckpointRow(p, HAUS_CHECKLIST_TEMPLATE_ID)).filter(Boolean) };
    appendHausGroupedChecklistItemRows(el.checklistItems, effective, null);
  } else {
    points.forEach((item) => addChecklistItem(item, false, "", null, checkpointCanonical(item)));
  }
  checkpointFormMarkUiLangBaseline();
}

function renderCheckpointEmployeeAccessPanel() {
  if (!el.checkpointEmployeeAccess || !el.checkpointAccessAllEmployees) return;
  const template = getChecklistTemplateById(checkpointManagerTemplateId);
  if (!template) return;
  const restricted = Array.isArray(template.assignedEmployeeUsernames) && template.assignedEmployeeUsernames.length > 0;
  el.checkpointAccessAllEmployees.checked = !restricted;
  el.checkpointEmployeeAccess.innerHTML = getEmployeeUsers().map((employee) => {
    const picked = restricted
      ? template.assignedEmployeeUsernames.includes(employee.username)
      : true;
    return `
      <label class="checkpoint-employee-pill">
        <input type="checkbox" value="${escapeHtml(employee.username)}" ${picked ? "checked" : ""} />
        <span>${escapeHtml(employee.label)}</span>
      </label>
    `;
  }).join("");
  el.checkpointEmployeeAccess.classList.toggle("hidden", !restricted);
  if (el.checkpointAccessHintRestricted) el.checkpointAccessHintRestricted.classList.toggle("hidden", !restricted);
}

function resetForm() {
  activeChecklistId = null;
  activeAssignmentId = "";
  activeCustomerId = "";
  uploadedPhotos = [];
  extraCostsPhoto = null;
  employeeChecklistUnlocked = false;
  activeFormChecklistTemplateId = HAUS_CHECKLIST_TEMPLATE_ID;
  el.checklistForm.reset();
  setExtraCostsEnabled(false);
  renderExtraCostsPhoto();
  lockedCustomerName = "";
  el.customerName.readOnly = currentRole === "employee";
  if (el.customerEmail) {
    el.customerEmail.readOnly = false;
  }
  if (el.comeTimeDisplay) el.comeTimeDisplay.textContent = "-";
  if (el.leaveTimeDisplay) el.leaveTimeDisplay.textContent = "-";
  el.comeButton.disabled = false;
  el.leaveButton.disabled = false;
  el.checklistItems.innerHTML = "";
  if (currentRole !== "employee") {
    populateChecklistFormTemplateSelect(true);
    toggleChecklistTemplateRowVisibility(true);
    rebuildChecklistItemsFromTemplate(activeFormChecklistTemplateId);
  } else {
    populateChecklistFormTemplateSelect(false);
    toggleChecklistTemplateRowVisibility(false);
  }
  setChecklistEditability(true);
  renderPhotoPreview();
  renderChecklistCustomerOrientationPhoto();
  checkpointFormMarkUiLangBaseline();
}

function setChecklistEditability(isEditable) {
  const editable = Boolean(isEditable);
  el.addItemButton.disabled = !editable;
  el.saveDraftButton.disabled = !editable;
  el.checklistForm.querySelector('button[type="submit"]').disabled = !editable;
  el.comeButton.disabled = !editable || el.comeButton.disabled;
  el.leaveButton.disabled = !editable || el.leaveButton.disabled;
  el.employeeComment.disabled = !editable;
  if (el.checklistTemplateSelect) {
    el.checklistTemplateSelect.disabled = Boolean(!editable || activeChecklistId || currentRole === "employee");
  }
  if (el.extraCostsEnabled) el.extraCostsEnabled.disabled = !editable;
  if (el.extraCostsEuro) el.extraCostsEuro.disabled = !editable;
  if (el.extraCostsComment) el.extraCostsComment.disabled = !editable;
  if (el.extraCostsPhotoTrigger) el.extraCostsPhotoTrigger.classList.toggle("hidden", !editable);
  if (el.extraCostsPhotoPreview) {
    el.extraCostsPhotoPreview.querySelectorAll("button[type='button']").forEach((btn) => {
      btn.classList.toggle("hidden", !editable);
      btn.disabled = !editable;
    });
  }

  el.checklistItems.querySelectorAll(".check-item").forEach((item) => {
    item.querySelector("input[type='checkbox']").disabled = !editable;
    item.querySelector(".item-comment-input").disabled = !editable;
    item.querySelector(".item-photo-trigger").classList.toggle("hidden", !editable);
    const itemPhotoPreview = item.querySelector(".item-photo-preview");
    if (itemPhotoPreview) {
      itemPhotoPreview.querySelectorAll(".item-photo-remove").forEach((btn) => {
        btn.classList.toggle("hidden", !editable);
        btn.disabled = !editable;
      });
    }
    item.querySelector(".remove-item").disabled = !editable;
    const textSpan = item.querySelector(".checkbox-line span");
    textSpan.setAttribute("contenteditable", editable ? "true" : "false");
  });
}

function resetCustomerDbForm() {
  activeCustomerDbId = "";
  pendingCustomerOrientationPhoto = null;
  pendingCustomerContractPdf = null;
  el.customerDbForm.reset();
  if (el.dbOrientationPhoto) el.dbOrientationPhoto.value = "";
  if (el.dbContractPdf) el.dbContractPdf.value = "";
  renderCustomerOrientationPreviewInDb();
  renderCustomerContractStatusInDb();
  populateCustomerCheckpointTemplateSelect();
  initPendingCustomerCheckpointSetsBlank();
  if (el.customerCheckpointTemplateSelect && el.customerCheckpointTemplateSelect.value) {
    renderCustomerCheckpointOptions(pendingCustomerCheckpointSets[el.customerCheckpointTemplateSelect.value] || []);
  } else {
    renderCustomerCheckpointOptions([]);
  }
}

function getSelectedCustomerCheckpoints() {
  if (!el.customerCheckpointOptions) return [];
  return [...el.customerCheckpointOptions.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value);
}

function buildSyncedChecklistItems(existingItems = [], nextCheckpointCanonList = [], renameMap = {}, templateId = HAUS_CHECKLIST_TEMPLATE_ID) {
  const existingByCanon = new Map(
    existingItems.map((item) => {
      const canon = String(item.checkpointCanon || "").trim()
        || checkpointCanonical(item.locales || item.text)
        || String(item.text || "").trim();
      return [canon, item];
    })
  );

  const tid = templateId || HAUS_CHECKLIST_TEMPLATE_ID;

  return nextCheckpointCanonList.map((name) => {
    const directMatch = existingByCanon.get(name);
    const renamedEntry = Object.entries(renameMap).find(([, nextName]) => nextName === name);
    const renamedFrom = renamedEntry ? renamedEntry[0] : null;
    const previousItem = directMatch || (renamedFrom ? existingByCanon.get(renamedFrom) : null);

    const tplLocales = resolveLocalesFromTemplateCanon(tid, name);
    let mergedLocales = { ...tplLocales };
    if (previousItem) {
      const prev = normalizeCheckpointDef(previousItem.locales || previousItem.text, { explicit: true });
      mergedLocales = {
        de: prev.de || tplLocales.de,
        en: prev.en || tplLocales.en
      };
    }
    mergedLocales = normalizeCheckpointDef(mergedLocales, { explicit: true });

    return {
      checked: previousItem && previousItem.checked != null ? previousItem.checked : false,
      locales: mergedLocales,
      checkpointCanon: name,
      text: name,
      comment: previousItem && previousItem.comment ? previousItem.comment : "",
      photo: previousItem && previousItem.photo ? previousItem.photo : null
    };
  });
}

function syncDraftSubmissionsForCustomer(customerId, templateId, nextCheckpointNames, renameMap = {}) {
  if (!customerId) return 0;

  const tid = templateId || HAUS_CHECKLIST_TEMPLATE_ID;
  let updatedCount = 0;
  submissions = submissions.map((submission) => {
    if (submission.customerId !== customerId || submission.status !== "draft") {
      return submission;
    }

    const subTpl = submission.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID;
    if (subTpl !== tid) return submission;

    updatedCount += 1;
    return Object.assign({}, submission, {
      items: buildSyncedChecklistItems(submission.items || [], nextCheckpointNames, renameMap, tid)
    });
  });

  if (updatedCount) {
    void persist().catch((err) => console.error(err));
    if (activeChecklistId) {
      const activeEntry = submissions.find((item) => item.id === activeChecklistId);
      if (activeEntry) {
        editChecklist(activeEntry.id);
      }
    }
  }

  return updatedCount;
}

function wireCheckpointManagerRow(row, item, index) {
  const editButton = row.querySelector("[data-edit-checkpoint]");
  if (editButton) editButton.addEventListener("click", () => {
    activeCheckpointEditIndex = index;
    const def = normalizeCheckpointDef(item, { explicit: true });
    if (el.checkpointNameDe) el.checkpointNameDe.value = def.de;
    if (el.checkpointNameEn) el.checkpointNameEn.value = def.en;
    if (el.checkpointHausZone) {
      el.checkpointHausZone.value = hausCheckpointZoneFromDef(item);
    }
    if (el.checkpointSaveButton) el.checkpointSaveButton.textContent = t("cp.update");
    if (el.checkpointNameDe) el.checkpointNameDe.focus();
  });
  const deleteButton = row.querySelector("[data-delete-checkpoint]");
  if (deleteButton) deleteButton.addEventListener("click", () => {
    deleteCheckpoint(index);
  });
}

function updateCheckpointHausZoneFieldVisibility() {
  const show = checkpointManagerTemplateId === HAUS_CHECKLIST_TEMPLATE_ID;
  if (el.checkpointHausZoneRow) el.checkpointHausZoneRow.classList.toggle("hidden", !show);
  if (show && el.checkpointHausZone && el.checkpointHausZone.dataset.zonesBuild !== HAUS_CHECKPOINT_ZONE_SELECT_BUILD) {
    el.checkpointHausZone.innerHTML = HAUS_CHECKPOINT_ZONE_IDS.map((id) => `
      <option value="${escapeHtml(id)}">${escapeHtml(hausZoneGroupTitle(id))}</option>
    `).join("");
    el.checkpointHausZone.dataset.zonesBuild = HAUS_CHECKPOINT_ZONE_SELECT_BUILD;
    el.checkpointHausZone.value = DEFAULT_HAUS_CHECKPOINT_ZONE;
  }
}

function resetCheckpointForm() {
  activeCheckpointEditIndex = -1;
  if (el.checkpointForm) el.checkpointForm.reset();
  if (el.checkpointHausZone) el.checkpointHausZone.value = DEFAULT_HAUS_CHECKPOINT_ZONE;
  if (el.checkpointSaveButton) {
    el.checkpointSaveButton.textContent = t("cp.saveNew");
  }
}

function renderCheckpointManager() {
  if (!el.checkpointList) return;
  const list = managingCheckpointList();
  if (!list || !list.length) {
    el.checkpointList.innerHTML = `<div class="checkpoint-item"><span>${escapeHtml(t("cp.empty"))}</span></div>`;
    return;
  }

  el.checkpointList.innerHTML = "";
  if (checkpointManagerTemplateId === HAUS_CHECKLIST_TEMPLATE_ID) {
    HAUS_CHECKPOINT_ZONE_IDS.forEach((zoneId) => {
      const pairs = list
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => hausCheckpointZoneFromDef(item) === zoneId);
      if (!pairs.length) return;
      const group = document.createElement("div");
      group.className = "checkpoint-manager-zone";
      const h = document.createElement("h4");
      h.className = "checkpoint-manager-zone-title";
      h.textContent = hausZoneGroupTitle(zoneId);
      group.appendChild(h);
      pairs.forEach(({ item, index }) => {
        const row = document.createElement("div");
        row.className = "checkpoint-item";
        row.innerHTML = `
      <span>${escapeHtml(checkpointDefLabelDeSlashEn(item))}</span>
      <div class="checkpoint-item-actions">
        <button class="secondary-button" type="button" data-edit-checkpoint="${index}">${escapeHtml(t("cp.edit"))}</button>
        <button class="danger-button" type="button" data-delete-checkpoint="${index}">${escapeHtml(t("cp.delete"))}</button>
      </div>
    `;
        wireCheckpointManagerRow(row, item, index);
        group.appendChild(row);
      });
      el.checkpointList.appendChild(group);
    });
    return;
  }

  list.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "checkpoint-item";
    row.innerHTML = `
      <span>${escapeHtml(checkpointDefLabelDeSlashEn(item))}</span>
      <div class="checkpoint-item-actions">
        <button class="secondary-button" type="button" data-edit-checkpoint="${index}">${escapeHtml(t("cp.edit"))}</button>
        <button class="danger-button" type="button" data-delete-checkpoint="${index}">${escapeHtml(t("cp.delete"))}</button>
      </div>
    `;
    wireCheckpointManagerRow(row, item, index);
    el.checkpointList.appendChild(row);
  });
}

function saveCheckpoint() {
  const deIn = el.checkpointNameDe ? el.checkpointNameDe.value.trim() : "";
  const enIn = el.checkpointNameEn ? el.checkpointNameEn.value.trim() : "";
  if (!deIn && !enIn) {
    showToast(t("toast.cpEnter"));
    return false;
  }

  const tplId = checkpointManagerTemplateId;
  const list = managingCheckpointList();
  if (!list) return false;

  let oldCanon = "";
  const nextDef = normalizeCheckpointDef({ de: deIn, en: enIn }, { explicit: true });

  const dedupeDe = nextDef.de.trim().toLowerCase();
  let zoneForDedupe = "";
  if (tplId === HAUS_CHECKLIST_TEMPLATE_ID) {
    zoneForDedupe = el.checkpointHausZone && el.checkpointHausZone.value
      ? el.checkpointHausZone.value.trim()
      : DEFAULT_HAUS_CHECKPOINT_ZONE;
    if (!isHausCheckpointZoneId(zoneForDedupe)) zoneForDedupe = DEFAULT_HAUS_CHECKPOINT_ZONE;
  }
  const duplicateIndex = list.findIndex((it, ix) => {
    if (ix === activeCheckpointEditIndex) return false;
    if (tplId === HAUS_CHECKLIST_TEMPLATE_ID && hausCheckpointZoneFromDef(it) !== zoneForDedupe) return false;
    const o = normalizeCheckpointDef(it, { explicit: true });
    if (dedupeDe) return o.de.trim().toLowerCase() === dedupeDe;
    return o.en.trim().toLowerCase() === nextDef.en.trim().toLowerCase();
  });
  if (duplicateIndex >= 0) {
    showToast(t("toast.cpDup"));
    return false;
  }

  let rowToStore = nextDef;
  if (tplId === HAUS_CHECKLIST_TEMPLATE_ID) {
    let z = el.checkpointHausZone && el.checkpointHausZone.value ? el.checkpointHausZone.value.trim() : DEFAULT_HAUS_CHECKPOINT_ZONE;
    if (!isHausCheckpointZoneId(z)) z = DEFAULT_HAUS_CHECKPOINT_ZONE;
    rowToStore = Object.assign({}, nextDef, { zone: z });
  }

  const newStorageKey = tplId === HAUS_CHECKLIST_TEMPLATE_ID
    ? hausCheckpointRowKey(rowToStore)
    : checkpointCanonical(nextDef);

  if (activeCheckpointEditIndex >= 0) {
    oldCanon = tplId === HAUS_CHECKLIST_TEMPLATE_ID
      ? hausCheckpointRowKey(list[activeCheckpointEditIndex])
      : checkpointCanonical(list[activeCheckpointEditIndex]);
    list[activeCheckpointEditIndex] = rowToStore;
    if (oldCanon !== newStorageKey) {
      customerDb = customerDb.map((entry) => {
        const nextEntry = Object.assign({}, entry);
        migrateCustomerCheckpointSetsIfNeeded(nextEntry);
        nextEntry.checkpointSets[tplId] = (nextEntry.checkpointSets[tplId] || []).map((point) => (
          point === oldCanon ? newStorageKey : point
        ));
        syncCustomerLegacyCheckpointsField(nextEntry);
        return nextEntry;
      });
      persistCustomerDb();
      customerDb.forEach((entry) => {
        syncDraftSubmissionsForCustomer(entry.id, tplId, entry.checkpointSets[tplId] || [], { [oldCanon]: newStorageKey });
      });
    }
    showToast(t("toast.cpUpdated"));
  } else {
    list.unshift(rowToStore);
    showToast(t("toast.cpSaved"));
  }

  persistChecklistTemplates();
  refreshCustomerCheckpointOptions();
  refreshCheckpointStaffUi();
  renderCustomerDb();
  resetCheckpointForm();
  return true;
}

function deleteCheckpoint(index) {
  const tplId = checkpointManagerTemplateId;
  const list = managingCheckpointList();
  if (!list || !list[index]) return;
  const removedName = tplId === HAUS_CHECKLIST_TEMPLATE_ID
    ? hausCheckpointRowKey(list[index])
    : checkpointCanonical(list[index]);
  list.splice(index, 1);

  customerDb = customerDb.map((entry) => {
    const nextEntry = Object.assign({}, entry);
    migrateCustomerCheckpointSetsIfNeeded(nextEntry);
    nextEntry.checkpointSets[tplId] = (nextEntry.checkpointSets[tplId] || []).filter((item) => item !== removedName);
    syncCustomerLegacyCheckpointsField(nextEntry);
    return nextEntry;
  });
  persistChecklistTemplates();
  persistCustomerDb();
  customerDb.forEach((entry) => {
    syncDraftSubmissionsForCustomer(entry.id, tplId, entry.checkpointSets[tplId] || []);
  });
  refreshCustomerCheckpointOptions();
  refreshCheckpointStaffUi();
  renderCustomerDb();
  resetCheckpointForm();
  showToast(t("toast.cpDeleted"));
}

function collectForm(status) {
  const items = [...el.checklistItems.querySelectorAll(".check-item")].map((item) => {
    const span = item.querySelector(".checkbox-line span");
    const lang = intlLangSafe();
    const merged = mergeCheckpointRowLocalesWithTemplate(item);
    const edited = span ? span.textContent.trim() : "";
    const normalized = normalizeCheckpointDef(
      Object.assign({}, merged, { [lang]: edited }),
      { explicit: true }
    );
    const canon = String(item.dataset.checkpointCanon || "").trim() || normalized.de || normalized.en || "";
    const textFallback = normalized.de || normalized.en || edited || t("chk.unnamed");
    const commentInput = item.querySelector(".item-comment-input");
    const checkInput = item.querySelector("input[type='checkbox']") || item.querySelector("input");
    return {
      checked: Boolean(checkInput && checkInput.checked),
      locales: normalized,
      checkpointCanon: canon || textFallback,
      text: textFallback,
      comment: commentInput ? commentInput.value.trim() : "",
      photo: item._itemPhoto || null
    };
  });

  const now = new Date().toISOString();
  const existing = submissions.find((entry) => entry.id === activeChecklistId);
  const inferredCustomerId = activeCustomerId || (existing ? existing.customerId : "") || resolveCustomerIdByName(el.customerName.value.trim());
  const templateIdFromUi = (
    el.checklistTemplateSelect && !el.checklistTemplateSelect.disabled && el.checklistTemplateSelect.value
      ? el.checklistTemplateSelect.value
      : (activeFormChecklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID));
  const templateMetaResolved = getChecklistTemplateById(templateIdFromUi);

  const resolveCustomerEmailPayload = () => {
    const fromInput = el.customerEmail && el.customerEmail.value.trim() ? el.customerEmail.value.trim() : "";
    const fromExisting = existing && existing.customerEmail ? String(existing.customerEmail).trim() : "";
    let out = fromInput || fromExisting;
    if (!out && inferredCustomerId) {
      const cust = customerDb.find((item) => item.id === inferredCustomerId);
      if (cust && cust.email) out = String(cust.email).trim();
    }
    if (!out) {
      const guessed = resolveCustomerIdByName(el.customerName.value.trim());
      if (guessed) {
        const cust = customerDb.find((item) => item.id === guessed);
        if (cust && cust.email) out = String(cust.email).trim();
      }
    }
    return out;
  };

  const euroRaw = el.extraCostsEuro ? el.extraCostsEuro.value.trim() : "";
  const euroParsed = parseEuroAmount(euroRaw);
  const extraAmountEuro =
    euroParsed != null && euroParsed > 0 ? Math.round(euroParsed * 100) / 100 : null;

  return {
    id: activeChecklistId || createId(),
    customerName: el.customerName.value.trim(),
    customerEmail: resolveCustomerEmailPayload(),
    jobTitle: el.customerName.value.trim(),
    employeeName: (currentSession ? currentSession.label : "") || (existing ? existing.employeeName || "" : "") || t("sub.employeeDefault"),
    employeeUsername: currentSession && currentSession.role === "employee" ? currentSession.username : (existing ? existing.employeeUsername || "" : ""),
    employeeComment: el.employeeComment ? el.employeeComment.value.trim() : "",
    attendance: {
      come: !el.comeTimeDisplay || el.comeTimeDisplay.textContent === "-" ? "" : el.comeTimeDisplay.textContent || "",
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
    extraCosts: {
      enabled: Boolean(el.extraCostsEnabled && el.extraCostsEnabled.checked),
      euroRaw,
      amountEuro: extraAmountEuro,
      comment: el.extraCostsComment ? el.extraCostsComment.value.trim() : "",
      photo: extraCostsPhoto
    },
    checklistTemplateId: templateMetaResolved ? templateIdFromUi : HAUS_CHECKLIST_TEMPLATE_ID,
    checklistTemplateName: templateMetaResolved
      ? templateMetaResolved.name
      : (existing && existing.checklistTemplateName ? existing.checklistTemplateName : ""),
    items
  };
}

async function saveChecklist(status, options = {}) {
  const { resetAfterSave = true, silent = false } = options;
  const existing = submissions.find((item) => item.id === activeChecklistId);
  const extraCostsOn = Boolean(el.extraCostsEnabled && el.extraCostsEnabled.checked);
  if (status === "submitted" && extraCostsOn) {
    const euroRaw = el.extraCostsEuro ? el.extraCostsEuro.value.trim() : "";
    const euroAmt = parseEuroAmount(euroRaw);
    if (!(euroAmt != null && euroAmt > 0)) {
      showToast(t("toast.extraEuroRequired"));
      if (el.extraCostsEuro) el.extraCostsEuro.focus();
      return;
    }
    const cidCheck =
      activeCustomerId
      || (existing && existing.customerId)
      || resolveCustomerIdByName(el.customerName.value.trim());
    if (!cidCheck) {
      showToast(t("toast.extraCostNeedCustomer"));
      if (el.customerName) el.customerName.focus();
      return;
    }
  }
  const employeeNeedsCalendarStart = currentRole === "employee"
    && !employeeChecklistUnlocked
    && !activeChecklistId
    && !activeAssignmentId;
  if (employeeNeedsCalendarStart) {
    showToast(t("toast.chkCalendar"));
    return;
  }
  if (currentRole === "employee" && existing && existing.status === "approved") {
    showToast(t("toast.chkLocked"));
    return;
  }

  if (status === "submitted" && (!el.customerName || !el.customerName.value.trim())) {
    showToast(t("toast.chkNeedCustomer"));
    if (el.customerName) el.customerName.focus();
    return;
  }
  if (status === "draft" && (!el.customerName || !el.customerName.value.trim())) {
    if (!silent) showToast(t("toast.draftCust"));
    return;
  }

  let entry;
  try {
    entry = collectForm(status);
  } catch (err) {
    console.error(err);
    showToast(t("toast.chkSaveFailed"));
    return;
  }
  const index = submissions.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    submissions[index] = entry;
  } else {
    submissions.unshift(entry);
    activeChecklistId = entry.id;
  }
  let compacted = false;
  try {
    compacted = await persist();
  } catch (err) {
    console.error(err);
    showToast(t("toast.chkPersistFailed"));
    return;
  }
  if (status === "submitted") {
    syncExtraCostLedgerForSubmittedEntry(entry);
  }
  if (!silent) {
    if (compacted) {
      showToast(t("toast.persistCompressed"));
    } else {
      showToast(status === "submitted" ? t("toast.chkSubmit") : t("toast.draftSaved"));
    }
  }
  if (resetAfterSave) {
    resetForm();
  }
  render();
}

function editChecklist(id) {
  const entry = submissions.find((item) => item.id === id);
  if (!entry) return;
  if (currentRole === "boss" && !assertBossMayAccessSubmission(entry)) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  if (currentRole === "employee" && entry.employeeUsername && (!currentSession || entry.employeeUsername !== currentSession.username)) {
    showToast(t("toast.noAccess"));
    return;
  }
  activeChecklistId = id;
  activeAssignmentId = entry.assignmentId || "";
  activeCustomerId = entry.customerId || resolveCustomerIdByName(entry.customerName);
  employeeChecklistUnlocked = true;
  uploadedPhotos = [...entry.photos];
  extraCostsPhoto = entry.extraCosts && entry.extraCosts.photo ? entry.extraCosts.photo : null;
  lockedCustomerName = entry.lockedCustomerName || "";
  el.customerName.value = entry.customerName;
  const syncedCustomerEmail = resolveCustomerEmailForEntry(entry) || "";
  if (syncedCustomerEmail) entry.customerEmail = syncedCustomerEmail;
  if (el.customerEmail) {
    let mail = syncedCustomerEmail || (entry.customerEmail ? String(entry.customerEmail).trim() : "");
    if (!mail && activeCustomerId) {
      const cidRow = customerDb.find((item) => item.id === activeCustomerId);
      if (cidRow && cidRow.email) mail = String(cidRow.email).trim();
    }
    if (!mail) {
      const cidGuess = resolveCustomerIdByName(entry.customerName || "");
      if (cidGuess) {
        const c = customerDb.find((item) => item.id === cidGuess);
        if (c && c.email) mail = String(c.email).trim();
      }
    }
    el.customerEmail.value = mail;
    el.customerEmail.readOnly = currentRole === "employee" && Boolean(lockedCustomerName);
  }
  renderChecklistCustomerOrientationPhoto();
  if (el.jobTitle) el.jobTitle.value = entry.jobTitle;
  if (el.employeeName) el.employeeName.value = entry.employeeName;
  el.customerName.readOnly = currentRole === "employee" || Boolean(lockedCustomerName);
  el.comeTimeDisplay.textContent = entry.attendance && entry.attendance.come ? entry.attendance.come : "-";
  el.leaveTimeDisplay.textContent = entry.attendance && entry.attendance.leave ? entry.attendance.leave : "-";
  el.comeButton.disabled = Boolean(entry.attendance && entry.attendance.come);
  el.leaveButton.disabled = Boolean(entry.attendance && entry.attendance.leave);
  el.employeeComment.value = entry.employeeComment;
  setExtraCostsEnabled(Boolean(entry.extraCosts && entry.extraCosts.enabled));
  if (el.extraCostsComment) {
    el.extraCostsComment.value = entry.extraCosts && entry.extraCosts.comment ? entry.extraCosts.comment : "";
  }
  if (el.extraCostsEuro) {
    const ex = entry.extraCosts;
    if (ex && typeof ex.euroRaw === "string" && ex.euroRaw.trim()) {
      el.extraCostsEuro.value = ex.euroRaw.trim();
    } else if (ex && ex.amountEuro != null && Number(ex.amountEuro) > 0) {
      el.extraCostsEuro.value = String(ex.amountEuro).replace(".", ",");
    } else {
      el.extraCostsEuro.value = "";
    }
  }
  renderExtraCostsPhoto();
  activeFormChecklistTemplateId = entry.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID;
  populateChecklistFormTemplateSelect(false);
  toggleChecklistTemplateRowVisibility(currentRole !== "employee");
  el.checklistItems.innerHTML = "";
  const editTid = entry.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID;
  const editTmpl = getChecklistTemplateById(editTid);
  if (editTid === HAUS_CHECKLIST_TEMPLATE_ID && editTmpl) {
    appendHausGroupedSubmissionChecklistRows(el.checklistItems, editTmpl, entry.items || []);
  } else {
    (entry.items || []).forEach((item) => {
      const canon = String(item.checkpointCanon || "").trim()
        || checkpointCanonical(item.locales || item.text)
        || String(item.text || "").trim();
      addChecklistItem(item.locales || item.text, item.checked, item.comment || "", item.photo || null, canon);
    });
  }
  checkpointFormMarkUiLangBaseline();
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

async function compressPhotoAttachment(readResult, fileName) {
  try {
    return await finalizeUploadedChecklistImage(readResult, fileName);
  } catch (e) {
    console.error(e);
    return { name: fileName, data: readResult };
  }
}

async function handlePhotoUpload(files) {
  const picks = [...files].slice(0, 6).filter((file) => file.type.startsWith("image/"));
  for (const file of picks) {
    const readResult = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
      reader.readAsDataURL(file);
    });
    uploadedPhotos.push(await compressPhotoAttachment(readResult, file.name));
    renderPhotoPreview();
  }
  el.photoInput.value = "";
}

function renderSubmissionList(target, entries, mode) {
  target.innerHTML = "";
  if (!entries.length) {
    target.innerHTML = `<div class="submission-card"><strong>${escapeHtml(t("sub.emptyTitle"))}</strong><small>${escapeHtml(t("sub.emptySub"))}</small></div>`;
    return;
  }

  entries.forEach((entry) => {
    const hasExtraCosts = Boolean(entry.extraCosts && entry.extraCosts.enabled);
    const wrap = document.createElement("div");
    wrap.className = "submission-card-wrap";
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
        <span class="badge">${entry.items.filter((item) => item.checked).length}/${entry.items.length} ${escapeHtml(t("sub.erledigt"))}</span>
        <span class="badge">${entry.photos.length} ${escapeHtml(t("sub.images"))}</span>
        <span class="badge">${escapeHtml((getChecklistTemplateById(entry.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID) || {}).name || entry.checklistTemplateName || t("sub.tplFallback"))}</span>
        <span class="badge">${escapeHtml(t("sub.extraLbl"))} ${hasExtraCosts ? escapeHtml(t("boss.opt.extraYes")) : escapeHtml(t("boss.opt.extraNo"))}</span>
      </div>
    `;
    button.addEventListener("click", () => (mode === "boss" ? selectForReview(entry.id) : editChecklist(entry.id)));
    wrap.appendChild(button);
    target.appendChild(wrap);
  });
}

function selectForReview(id) {
  const entry = submissions.find((item) => item.id === id);
  if (currentRole === "boss" && entry && !assertBossMayAccessSubmission(entry)) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  activeChecklistId = id;
  renderReview();
  renderLists();
}

async function approveChecklist(id) {
  const entry = submissions.find((item) => item.id === id);
  if (!entry) return;
  if (!assertBossMayAccessSubmission(entry)) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  const approveButton = document.getElementById("approveButton");
  const approveLabel = approveButton ? approveButton.textContent : "";
  if (approveButton) {
    approveButton.disabled = true;
    approveButton.textContent = t("review.approveBusy");
  }
  try {
    const commentField = document.getElementById("bossComment");
    entry.bossComment = commentField ? commentField.value.trim() || entry.bossComment : entry.bossComment;
    entry.status = "approved";
    entry.approvedAt = new Date().toISOString();

    const emailForReport = resolveCustomerEmailForEntry(entry);
    if (emailForReport) entry.customerEmail = emailForReport;

    let pdfBlob = null;
    try {
      pdfBlob = await generateCustomerReportPdfBlob(entry);
    } catch (err) {
      console.error(err);
      showToast(t("toast.pdfError"));
    }

    await sendCustomerEmailWithPdf(entry, pdfBlob);

    try {
      await persist();
      render();
      showToast(t("toast.approved"));
    } catch (persistErr) {
      console.error(persistErr);
      render();
      showToast(t("toast.chkPersistFailed"));
    }
  } finally {
    if (approveButton && approveButton.isConnected) {
      approveButton.disabled = false;
      approveButton.textContent = approveLabel || t("review.approve");
    }
  }
}

async function reopenChecklist(id) {
  const entry = submissions.find((item) => item.id === id);
  if (!entry) return;
  if (!assertBossMayAccessSubmission(entry)) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  const snap = { status: entry.status, approvedAt: entry.approvedAt, emailSentAt: entry.emailSentAt };
  entry.status = "submitted";
  entry.approvedAt = "";
  entry.emailSentAt = "";
  try {
    await persist();
  } catch (err) {
    console.error(err);
    entry.status = snap.status;
    entry.approvedAt = snap.approvedAt;
    entry.emailSentAt = snap.emailSentAt;
    showToast(t("toast.chkPersistFailed"));
    return;
  }
  render();
  showToast(t("toast.reopened"));
}

async function deleteChecklist(id) {
  const entry = submissions.find((item) => item.id === id);
  if (entry && !assertBossMayAccessSubmission(entry)) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  const backup = submissions;
  const backupActive = activeChecklistId;
  submissions = submissions.filter((item) => item.id !== id);
  if (activeChecklistId === id) activeChecklistId = null;
  try {
    await persist();
    removeExtraCostLedgerRowsForSubmission(id);
  } catch (err) {
    console.error(err);
    submissions = backup;
    activeChecklistId = backupActive;
    showToast(t("toast.chkPersistFailed"));
    return;
  }
  render();
  showToast(t("toast.deletedChk"));
}

function buildReportText(entry) {
  if (isWorkOrderReportEntry(entry)) {
    return [
      t("preview.greeting", { name: entry.customerName }),
      "",
      ...customerReportParagraphsForEntry(entry).flatMap((p) => [p, ""]),
      t("preview.team"),
      "",
      t("report.contract.sectionScope"),
      getWorkOrderClosingReportText(entry) || t("wo.reportScopeEmpty")
    ].filter(Boolean).join("\n");
  }
  const done = entry.items.filter((item) => item.checked).length;
  const open = entry.items.length - done;
  const itemLines = entry.items.map((item) => {
    const statusMark = item.checked ? "✓" : "!";
    /* Prüfpunkt-Kommentar nur Chefbereich, nicht für Kunden (E-Mail/PDF/Text). */
    return `- ${statusMark} ${itemDisplayForSubmissionItem(item, entry.checklistTemplateId)}`;
  }).join("\n");
  return [
    t("preview.greeting", { name: entry.customerName }),
    "",
    t("preview.introP1"),
    "",
    t("preview.introP2"),
    "",
    t("preview.introP3"),
    "",
    t("preview.team"),
    "",
    t("preview.summary", { done, total: entry.items.length, open }),
    "",
    t("preview.cpHeading"),
    itemLines,
    entry.bossComment ? t("preview.bossC", { t: entry.bossComment }) : ""
  ].filter(Boolean).join("\n");
}

function buildReportHtml(entry) {
  const serviceProviderName = t("report.contract.providerName");
  const serviceProviderEmail = t("report.contract.providerEmail");
  const serviceProviderPhone = t("report.contract.providerPhone");
  const customerContact = resolveCustomerContactForReport(entry);
  const customerName = customerContact.name;
  const customerAddress = customerContact.address;
  const customerPhone = customerContact.phone;
  const customerEmail = customerContact.email;
  const reportDate = formatDateDayOnly(entry.approvedAt || entry.submittedAt || entry.createdAt || new Date().toISOString());
  const checklistLabel = isWorkOrderReportEntry(entry)
    ? t("wo.reportTypeLabel")
    : ((getChecklistTemplateById(entry.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID) || {}).name
      || entry.checklistTemplateName
      || t("sub.tplFallback"));
  const customerReportParagraphs = customerReportParagraphsForEntry(entry);
  if (isWorkOrderReportEntry(entry)) {
    const closingHtml = formatWorkOrderClosingReportHtml(getWorkOrderClosingReportText(entry));
    return `
    <div class="contract-report">
      <div class="contract-report-headline-top">${escapeHtml(t("report.contract.brand"))}</div>
      <h2 class="contract-report-title">${escapeHtml(t("report.contract.title"))}</h2>
      <div class="contract-report-subtitle">${escapeHtml(checklistLabel)}</div>
      <div class="contract-report-tagline">${escapeHtml(t("preview.team"))}</div>

      <div class="contract-report-party-grid">
        <section class="contract-report-party">
          <h3>${escapeHtml(t("report.contract.providerHead"))}</h3>
          <p><strong>${escapeHtml(serviceProviderName)}</strong></p>
          <p>${escapeHtml(serviceProviderEmail)}</p>
          <p>${escapeHtml(serviceProviderPhone)}</p>
        </section>
        <section class="contract-report-party">
          <h3>${escapeHtml(t("report.contract.clientHead"))}</h3>
          <p><strong>${escapeHtml(customerName)}</strong></p>
          <p>${escapeHtml(customerAddress)}</p>
          <p>${escapeHtml(customerPhone)}</p>
          <p>${escapeHtml(customerEmail)}</p>
        </section>
      </div>

      <p class="contract-report-intro">
        ${escapeHtml(t("report.contract.performedOn", { date: reportDate }))}
      </p>

      <section class="contract-report-section">
        <h3>${escapeHtml(t("report.contract.sectionCustomerReport"))}</h3>
        ${customerReportParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      </section>

      <section class="contract-report-section contract-report-scope-closing">
        <h3>${escapeHtml(t("report.contract.sectionScope"))}</h3>
        <div class="work-order-closing-report-body">${closingHtml}</div>
      </section>
    </div>
  `;
  }
  const done = entry.items.filter((item) => item.checked).length;
  const open = entry.items.length - done;
  return `
    <div class="contract-report">
      <div class="contract-report-headline-top">${escapeHtml(t("report.contract.brand"))}</div>
      <h2 class="contract-report-title">${escapeHtml(t("report.contract.title"))}</h2>
      <div class="contract-report-subtitle">${escapeHtml(checklistLabel)}</div>
      <div class="contract-report-tagline">${escapeHtml(t("preview.team"))}</div>

      <div class="contract-report-party-grid">
        <section class="contract-report-party">
          <h3>${escapeHtml(t("report.contract.providerHead"))}</h3>
          <p><strong>${escapeHtml(serviceProviderName)}</strong></p>
          <p>${escapeHtml(serviceProviderEmail)}</p>
          <p>${escapeHtml(serviceProviderPhone)}</p>
        </section>
        <section class="contract-report-party">
          <h3>${escapeHtml(t("report.contract.clientHead"))}</h3>
          <p><strong>${escapeHtml(customerName)}</strong></p>
          <p>${escapeHtml(customerAddress)}</p>
          <p>${escapeHtml(customerPhone)}</p>
          <p>${escapeHtml(customerEmail)}</p>
        </section>
      </div>

      <p class="contract-report-intro">
        ${escapeHtml(t("report.contract.performedOn", { date: reportDate }))}
      </p>

      <section class="contract-report-section">
        <h3>${escapeHtml(t("report.contract.sectionCustomerReport"))}</h3>
        ${customerReportParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      </section>

      <section class="contract-report-section">
        <h3>${escapeHtml(t("report.contract.sectionScope"))}</h3>
        <p>${escapeHtml(t("preview.summary", { done, total: entry.items.length, open }))}</p>
        <ul class="report-items contract-report-items">
          ${entry.items.map((item) => `
            <li>
              <span class="result-mark ${item.checked ? "ok" : ""}">${item.checked ? "✓" : "!"}</span>
              <div>
                <span>${escapeHtml(itemDisplayForSubmissionItem(item, entry.checklistTemplateId))}</span>
                ${item.photo && item.photo.data ? `<img src="${item.photo.data}" alt="${escapeHtml(item.photo.name || t("img.altCp"))}" />` : ""}
              </div>
            </li>
          `).join("")}
        </ul>
      </section>

      <section class="contract-report-section">
        <h3>${escapeHtml(t("report.contract.sectionNotes"))}</h3>
        ${entry.bossComment ? `<p><strong>${escapeHtml(t("preview.htmlBossLbl"))}</strong> ${escapeHtml(entry.bossComment)}</p>` : `<p>${escapeHtml(t("preview.htmlNoComment"))}</p>`}
      </section>
    </div>
  `;
}

function openMailDraft(entry) {
  const subject = encodeURIComponent(`${t("report.subjectPrefix")} ${entry.jobTitle}`);
  const body = encodeURIComponent(buildReportText(entry));
  const email = resolveCustomerEmailForEntry(entry) || "";
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

function openMailDraftWithPdfHint(entry) {
  const subject = encodeURIComponent(`${t("report.subjectPrefix")} ${entry.jobTitle}`);
  const body = encodeURIComponent(`${t("report.pdfHintAttach")}\n\n${buildReportText(entry)}`);
  const addr = resolveCustomerEmailForEntry(entry) || "";
  return `mailto:${addr}?subject=${subject}&body=${body}`;
}

function buildCustomerReportPdfFilename(entry) {
  const iso = new Date(entry.approvedAt || entry.emailSentAt || entry.submittedAt || entry.createdAt || Date.now())
    .toISOString()
    .slice(0, 10);
  const core = `${t("report.pdfPrefix")}_${entry.jobTitle}_${iso}`.trim();
  return sanitizeDownloadFilename(`${core}.pdf`);
}

function getJsPdfConstructor() {
  return typeof window !== "undefined" && window.jspdf && window.jspdf.jsPDF
    ? window.jspdf.jsPDF
    : null;
}

function pdfMeasureNaturalSize(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ nw: img.naturalWidth || 400, nh: img.naturalHeight || 300 });
    img.onerror = () => reject(new Error("pdf img"));
    img.src = dataUrl;
  });
}

function pdfGuessImageFormat(dataUrl) {
  if (/^data:image\/png/i.test(dataUrl)) return "PNG";
  if (/^data:image\/jpe?g/i.test(dataUrl)) return "JPEG";
  return "JPEG";
}

function pdfScaledSize(nw, nh, maxW, maxH) {
  const ratio = Math.min(maxW / nw, maxH / nh, 1) || 1;
  return { w: nw * ratio, h: nh * ratio };
}

async function generateCustomerReportPdfBlob(entry) {
  const JsPDF = getJsPdfConstructor();
  if (!JsPDF) {
    throw new Error("jspdf");
  }

  const doc = new JsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  const lineH = 6.0;
  const orange = [210, 145, 30];
  const text = [40, 40, 44];
  const muted = [105, 105, 112];
  const lightBg = [249, 247, 242];
  let y = margin;

  const serviceProviderName = t("report.contract.providerName");
  const serviceProviderEmail = t("report.contract.providerEmail");
  const serviceProviderPhone = t("report.contract.providerPhone");
  const customerContact = resolveCustomerContactForReport(entry);
  const customerName = customerContact.name;
  const customerAddress = customerContact.address;
  const customerPhone = customerContact.phone;
  const customerEmail = customerContact.email;
  const customerReportParagraphs = customerReportParagraphsForEntry(entry);
  const reportDate = formatDateDayOnly(entry.approvedAt || entry.submittedAt || entry.createdAt || new Date().toISOString());
  const checklistLabel = isWorkOrderReportEntry(entry)
    ? t("wo.reportTypeLabel")
    : ((getChecklistTemplateById(entry.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID) || {}).name
      || entry.checklistTemplateName
      || t("sub.tplFallback"));
  const done = entry.items.filter((item) => item.checked).length;
  const open = entry.items.length - done;

  function ensureSpace(extra) {
    if (y + extra > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }
  function drawParagraph(txt, x, maxW, fontSize = 10, bold = false, color = text) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(String(txt || ""), maxW);
    lines.forEach((ln) => {
      ensureSpace(lineH + 0.4);
      y += lineH;
      doc.text(ln, x, y);
    });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(t("report.contract.brand"), margin, y);
  doc.setDrawColor(orange[0], orange[1], orange[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, y + 2, pageW - margin, y + 2);

  y += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(text[0], text[1], text[2]);
  doc.text(t("report.contract.title"), pageW / 2, y, { align: "center" });
  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(orange[0], orange[1], orange[2]);
  doc.text(checklistLabel.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("Mit Herz und Hand", pageW / 2, y, { align: "center" });

  y += 8;
  ensureSpace(42);
  const boxGap = 4;
  const boxW = (contentW - boxGap) / 2;
  const boxH = 34;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(214, 214, 214);
  doc.setLineWidth(0.25);
  doc.rect(margin, y, boxW, boxH, "FD");
  doc.rect(margin + boxW + boxGap, y, boxW, boxH, "FD");

  let ly = y + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(orange[0], orange[1], orange[2]);
  doc.text(t("report.contract.providerHead"), margin + 3, ly);
  ly += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(text[0], text[1], text[2]);
  doc.text(serviceProviderName, margin + 3, ly);
  ly += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(serviceProviderEmail, margin + 3, ly);
  ly += 3.8;
  doc.text(serviceProviderPhone, margin + 3, ly);

  let ry = y + 5;
  const rightX = margin + boxW + boxGap + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(orange[0], orange[1], orange[2]);
  doc.text(t("report.contract.clientHead"), rightX, ry);
  ry += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(text[0], text[1], text[2]);
  doc.text(customerName, rightX, ry);
  ry += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(doc.splitTextToSize(customerAddress, boxW - 6), rightX, ry);
  ry += 7.5;
  doc.text(customerPhone, rightX, ry);
  ry += 3.8;
  doc.text(customerEmail, rightX, ry);

  y += boxH + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(text[0], text[1], text[2]);
  drawParagraph(t("report.contract.performedOn", { date: reportDate }), margin, contentW, 10, false, text);
  y += 1;

  function sectionTitle(txt) {
    ensureSpace(13);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(text[0], text[1], text[2]);
    doc.text(txt, margin, y);
    doc.setDrawColor(orange[0], orange[1], orange[2]);
    doc.setLineWidth(0.35);
    doc.line(margin, y + 1.6, pageW - margin, y + 1.6);
  }

  sectionTitle(t("report.contract.sectionCustomerReport"));
  customerReportParagraphs.forEach((p, idx) => {
    drawParagraph(p, margin, contentW, 9.5, false, text);
    if (idx < customerReportParagraphs.length - 1) y += 2.2;
  });
  y += 3.5;

  sectionTitle(t("report.contract.sectionScope"));
  if (isWorkOrderReportEntry(entry)) {
    const closingText = getWorkOrderClosingReportText(entry) || t("wo.reportScopeEmpty");
    drawParagraph(closingText, margin, contentW, 9.5, false, text);
    y += 2.5;
  } else {
    drawParagraph(t("preview.summary", { done, total: entry.items.length, open }), margin, contentW, 9.5, false, text);
    y += 2.5;
    const items = entry.items || [];
    items.forEach((item) => {
      const label = itemDisplayForSubmissionItem(item, entry.checklistTemplateId);
      const dotColor = item.checked ? [52, 146, 74] : [196, 46, 30];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      const lines = doc.splitTextToSize(label, contentW - 13);
      lines.forEach((line, idx) => {
        ensureSpace(lineH + 0.4);
        y += lineH;
        if (idx === 0) {
          doc.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
          doc.circle(margin + 3.1, y - 1.55, 1.55, "F");
        }
        doc.text(line, margin + 8, y);
      });
      y += 2.2;
    });
  }

  if (entry.bossComment && !isWorkOrderReportEntry(entry)) {
    y += 1.5;
    sectionTitle(t("report.contract.sectionNotes"));
    drawParagraph(entry.bossComment, margin, contentW, 9.5, false, muted);
    y += 1.5;
  }

  const allPhotos = []
    .concat((entry.items || []).filter((it) => it.photo && it.photo.data).map((it) => ({ data: it.photo.data, name: itemDisplayForSubmissionItem(it, entry.checklistTemplateId) })))
    .concat((entry.photos || []).filter((p) => p && p.data).map((p) => ({ data: p.data, name: p.name || "" })));
  if (allPhotos.length) {
    drawParagraph(t("report.contract.imagesOnNextPages"), margin, contentW, 9.2, false, muted);
    y += 1.5;
  }
  if (allPhotos.length) {
    doc.addPage();
    y = margin;
    sectionTitle(t("report.contract.imagesTitle"));
    for (const ph of allPhotos) {
      if (!ph.data) continue;
      let dim;
      try {
        dim = await pdfMeasureNaturalSize(ph.data);
      } catch (e) {
        continue;
      }
      const size = pdfScaledSize(dim.nw, dim.nh, contentW, 78);
      ensureSpace(size.h + 16);
      y += 4;
      try {
        doc.addImage(ph.data, pdfGuessImageFormat(ph.data), margin, y, size.w, size.h);
      } catch (e) {
        continue;
      }
      y += size.h + 4;
      if (ph.name && !isWorkOrderReportEntry(entry)) {
        drawParagraph(ph.name, margin, contentW, 8.5, false, muted);
      }
      y += 2;
    }
  }

  return doc.output("blob");
}

async function downloadCustomerReportPdf(entry) {
  const JsPDF = getJsPdfConstructor();
  if (!JsPDF) {
    showToast(t("toast.pdfError"));
    return;
  }
  try {
    const blob = await generateCustomerReportPdfBlob(entry);
    const fileName = buildCustomerReportPdfFilename(entry);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    console.error(err);
    showToast(t("toast.pdfError"));
  }
}

const MAIL_RELAY_SESSION_KEY = "werkstattMailRelayOrigin";
const MAIL_API_TOKEN_STORAGE_KEY = "werkstattMailApiToken";

/** Wie server/index.js sanitizeEmail – vermeidet POST mit 400 invalid_recipient. */
function isValidSmtpRecipientEmail(raw) {
  const s = String(raw || "").trim();
  return (
    /^[^\s@]+@[^\s@\u0000-\u001f]+$/i.test(s)
    && !s.includes("..")
    && s.length <= 254
  );
}

/** API-Antwort /api/mail-capabilities tolerant auswerten. */
function capsRelayEnabled(caps) {
  if (!caps || typeof caps !== "object") return false;
  const r = caps.relay;
  if (r === true || r === 1) return true;
  if (typeof r === "string") return /^(true|1|yes|on)$/i.test(r.trim());
  return false;
}

/** E-Mail für Versand: Eintrag, sonst Kundenstamm per customerId / Namensauflösung. */
function resolveCustomerEmailForEntry(entry) {
  if (!entry || typeof entry !== "object") return "";
  let mail = "";
  let cid = entry.customerId ? String(entry.customerId).trim() : "";
  if (!cid) cid = resolveCustomerIdByName(String(entry.customerName || "").trim()) || "";
  if (cid) {
    const c = customerDb.find((item) => item.id === cid);
    if (c && c.email) mail = String(c.email).trim();
  }
  if (!mail) {
    const fromEntry = entry.customerEmail ? String(entry.customerEmail).trim() : "";
    if (fromEntry) mail = fromEntry;
  }
  if (!mail || !isValidSmtpRecipientEmail(mail)) return "";
  return mail;
}

function resolveCustomerContactForReport(entry) {
  const cidRaw = entry && entry.customerId ? String(entry.customerId).trim() : "";
  const cid = cidRaw || resolveCustomerIdByName(String((entry && entry.customerName) || "").trim()) || "";
  const customer = cid ? customerDb.find((item) => item.id === cid) : null;
  const dbName = customer ? `${String(customer.firstName || "").trim()} ${String(customer.lastName || "").trim()}`.trim() : "";
  return {
    name: dbName || String((entry && entry.customerName) || "—").trim() || "—",
    address: (customer && String(customer.address || "").trim()) || String((entry && entry.customerAddress) || "—").trim() || "—",
    phone: (customer && String(customer.phone || "").trim()) || "—",
    email: (customer && String(customer.email || "").trim()) || String((entry && entry.customerEmail) || "—").trim() || "—"
  };
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function getCandidateMailRelayBases() {
  const bases = [];
  const seen = new Set();
  const add = (raw) => {
    const u = String(raw || "").trim().replace(/\/$/, "");
    if (!u || /^null$/i.test(u) || !/^https?:\/\//i.test(u)) return;
    if (seen.has(u)) return;
    seen.add(u);
    bases.push(u);
  };

  try {
    if (window.location.protocol === "file:") {
      add("http://127.0.0.1:3847");
      add("http://localhost:3847");
    }
  } catch (_) {
    //
  }

  try {
    const { protocol, hostname } = window.location;
    if (hostname === "127.0.0.1" || hostname === "localhost") {
      /* HTTPS-„localhost“-Tabs: echte Mail-API läuft meist ohne TLS auf diesem Port — vor Origin probieren (Firefox oft erlaubt http→loopback). */
      add("http://127.0.0.1:3847");
      add("http://localhost:3847");
    }
    if (protocol !== "file:" && (hostname === "127.0.0.1" || hostname === "localhost")) {
      const p = Number(window.location.port) || (protocol === "https:" ? 443 : 80);
      if (p !== 3847) {
        add(`${protocol}//${hostname}:3847`);
      }
    }
  } catch (_) {
    //
  }

  try {
    add(window.location.origin);
  } catch (_) {
    //
  }

  try {
    const over = typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(MAIL_RELAY_SESSION_KEY)
      : null;
    add(over);
  } catch (_) {
    //
  }

  return bases;
}

let mailRelayState = null;

async function fetchMailRelayCapabilities(force) {
  const now = Date.now();
  /* Nur erfolgreichen Relay cachen — sonst bleiben „relay:false“-Antworten von falschem Port 60 s blockiert. */
  if (
    !force
    && mailRelayState
    && mailRelayState.caps
    && capsRelayEnabled(mailRelayState.caps)
    && mailRelayState.base
    && now - mailRelayState.at < 60000
  ) {
    return mailRelayState;
  }

  let relayExplicitFalseFromApi = false;
  let lastRelayOffDetail = null;
  const bases = getCandidateMailRelayBases().filter(Boolean);
  for (const base of bases) {
    try {
      const url = `${base}/api/mail-capabilities`;
      const res = await fetch(url, { credentials: "omit", mode: "cors", cache: "no-store" });
      if (!res.ok) continue;
      const caps = await res.json().catch(() => null);
      if (!caps || typeof caps !== "object") continue;
      /* Nicht hier abbrechen, wenn relay false — nächste URL (z. B. Mail-Server-Port 3847) kann relay true haben. */
      if (Object.prototype.hasOwnProperty.call(caps, "relay") && caps.relay === false) {
        relayExplicitFalseFromApi = true;
      }
      if (
        caps.relayOffDetail
        && typeof caps.relayOffDetail === "object"
      ) {
        lastRelayOffDetail = caps.relayOffDetail;
      }
      if (!capsRelayEnabled(caps)) continue;
      try {
        sessionStorage.setItem(MAIL_RELAY_SESSION_KEY, base);
      } catch (_) {
        //
      }
      mailRelayState = {
        base,
        caps,
        at: now,
        relayExplicitFalseFromApi: false
      };
      return mailRelayState;
    } catch (_) {
      // nächste Basis versuchen
    }
  }
  mailRelayState = {
    base: null,
    caps: Object.assign(
      { relay: false },
      lastRelayOffDetail ? { relayOffDetail: lastRelayOffDetail } : {}
    ),
    at: now,
    relayExplicitFalseFromApi
  };
  if (!capsRelayEnabled(mailRelayState.caps || {}) && !relayExplicitFalseFromApi) {
    console.info(
      "[Immobiliencheck] Mail-Relay nicht ermittelt (Server aus / falsche URL?). Kandidaten:",
      getCandidateMailRelayBases()
    );
  }
  return mailRelayState;
}

async function trySendReportViaSmtp(entry, pdfBlob, fileName) {
  /* Frisch prüfen, damit relay nach Server-Neustart / geänderter .env nicht durch alten Negativ-Cache blockiert wird. */
  const snapshot = await fetchMailRelayCapabilities(true);
  const base = snapshot.base;
  const caps = snapshot.caps || {};
  if (!base || !capsRelayEnabled(caps)) {
    showToast(t("toast.mailRelayOff"));
    console.warn("[Immobiliencheck] Kein SMTP-Relay oder keine Basis-URL.", {
      base,
      relayRaw: caps && caps.relay,
      relayExplicitFalseFromApi: snapshot.relayExplicitFalseFromApi,
      relayOffDetail: caps && caps.relayOffDetail
    });
    return false;
  }

  const toAddrResolved = resolveCustomerEmailForEntry(entry);
  if (toAddrResolved) entry.customerEmail = toAddrResolved;
  const toAddr = toAddrResolved || String(entry.customerEmail || "").trim();
  if (!isValidSmtpRecipientEmail(toAddr)) {
    showToast(t("toast.customerEmailMissing"));
    return false;
  }

  if (caps.apiTokenRequired) {
    let tok = "";
    try {
      tok = sessionStorage.getItem(MAIL_API_TOKEN_STORAGE_KEY) || "";
    } catch (_) {
      //
    }
    if (!String(tok).trim()) {
      showToast(t("toast.smtpNeedToken"));
      return false;
    }
  }

  let pdfBase64;
  try {
    pdfBase64 = arrayBufferToBase64(await pdfBlob.arrayBuffer());
  } catch (err) {
    console.warn("[Immobiliencheck] PDF konnte nicht kodieren werden:", err);
    showToast(t("toast.pdfError"));
    return false;
  }

  const headers = { "Content-Type": "application/json" };
  if (caps.apiTokenRequired) {
    headers["X-Mail-Api-Token"] = (
      sessionStorage.getItem(MAIL_API_TOKEN_STORAGE_KEY) || ""
    ).trim();
  }

  console.info("[Immobiliencheck] SMTP-Versuch:", `${base}/api/send-report`, { toAddr });

  try {
    const res = await fetch(`${base}/api/send-report`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: toAddr,
        subject: `${t("report.subjectPrefix")} ${entry.jobTitle}`.trim(),
        text: buildReportText(entry),
        pdfBase64,
        pdfFileName: fileName
      }),
      credentials: "omit",
      mode: "cors"
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.ok) {
      console.warn("send-report", res.status, payload);
      showToast(t("toast.smtpFailed"));
      return false;
    }
    return true;
  } catch (e) {
    console.warn(e);
    showToast(t("toast.smtpFailed"));
    return false;
  }
}

async function sendCustomerEmailWithPdf(entry, pdfBlob) {
  function markSent() {
    entry.emailSentAt = new Date().toISOString();
    if (el.emailStatus) {
      el.emailStatus.innerHTML = `<span class="dot"></span>${escapeHtml(t("email.sentReport", { email: entry.customerEmail }))}`;
    }
  }

  if (!pdfBlob) {
    markSent();
    window.open(openMailDraft(entry), "_blank", "noopener,noreferrer");
    return;
  }

  const fileName = buildCustomerReportPdfFilename(entry);

  if (await trySendReportViaSmtp(entry, pdfBlob, fileName)) {
    markSent();
    showToast(t("toast.smtpSent"));
    return;
  }

  try {
    const shareFile = new File([pdfBlob], fileName, { type: "application/pdf" });
    if (
      navigator.share
      && navigator.canShare
      && navigator.canShare({ files: [shareFile] })
    ) {
      try {
        await navigator.share({
          files: [shareFile],
          title: `${t("report.subjectPrefix")} ${entry.jobTitle}`.trim(),
          text: t("report.shareText")
        });
        markSent();
        return;
      } catch (shareErr) {
        if (shareErr && shareErr.name === "AbortError") return;
      }
    }
  } catch (e) {
    // Fallback unten
  }

  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  window.open(openMailDraftWithPdfHint(entry), "_blank", "noopener,noreferrer");
  markSent();
  showToast(t("toast.pdfMailFallback"));
}

function buildMailPreviewUrl(entry) {
  const mailtoUrl = openMailDraft(entry);
  const previewEmail = resolveCustomerEmailForEntry(entry) || "";
  if (previewEmail) entry.customerEmail = previewEmail;
  const htmlLang = intlLangSafe();
  const previewHtml = `
    <!doctype html>
    <html lang="${htmlLang}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(t("report.mailTitle"))}</title>
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
          <h1>${escapeHtml(t("report.mailTitle"))}</h1>
          <p><strong>${escapeHtml(t("report.mailTo"))}</strong> ${escapeHtml(previewEmail)}</p>
          <p><strong>${escapeHtml(t("report.mailSubject"))}</strong> ${escapeHtml(`${t("report.subjectPrefix")} ${entry.jobTitle}`)}</p>
          <pre>${escapeHtml(buildReportText(entry))}</pre>
          <div class="actions">
            <a class="button primary" href="${mailtoUrl}">${escapeHtml(t("report.mailOpenBtn"))}</a>
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
        <h2>${escapeHtml(t("review.pickTitle"))}</h2>
        <p>${escapeHtml(t("review.pickBody"))}</p>
      </div>
    `;
    return;
  }

  if (currentRole === "boss" && !assertBossMayAccessSubmission(entry)) {
    activeChecklistId = null;
    el.reviewPanel.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
        <h2>${escapeHtml(t("review.pickTitle"))}</h2>
        <p>${escapeHtml(t("review.pickBody"))}</p>
      </div>
    `;
    showToast(t("toast.managedStaffOnly"));
    return;
  }

  const done = entry.items.filter((item) => item.checked).length;
  const syncedReviewEmail = resolveCustomerEmailForEntry(entry) || "";
  if (syncedReviewEmail) entry.customerEmail = syncedReviewEmail;
  const tmplForReview = getChecklistTemplateById(entry.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID);
  const checklistLabelPlain = tmplForReview ? tmplForReview.name : (entry.checklistTemplateName || t("sub.tplFallback"));
  const safe = {
    jobTitle: escapeHtml(entry.jobTitle),
    customerName: escapeHtml(entry.customerName),
    customerEmail: escapeHtml(syncedReviewEmail || entry.customerEmail),
    employeeName: escapeHtml(entry.employeeName),
    employeeComment: escapeHtml(entry.employeeComment),
    checklistTemplateLabel: escapeHtml(entry.checklistTemplateName || checklistLabelPlain),
    extraCostsComment: escapeHtml((entry.extraCosts && entry.extraCosts.comment) || ""),
    bossComment: escapeHtml(entry.bossComment || "")
  };
  const reportHtml = buildReportHtml(entry);
  const mailDraftUrl = buildMailPreviewUrl(entry);
  const extraPhoto = entry.extraCosts && entry.extraCosts.photo;
  const extraPhotoHref = extraPhoto && extraPhoto.data ? extraPhoto.data : "";
  const extraPhotoDownloadName = sanitizeDownloadFilename(extraPhoto && extraPhoto.name);
  el.reviewPanel.innerHTML = `
    <div class="review-header">
      <div>
        <span class="badge ${entry.status}">${getStatusLabel(entry.status)}</span>
        <h2>${safe.jobTitle}</h2>
      </div>
      <div class="status-pill"><span class="dot"></span>${entry.emailSentAt ? `${escapeHtml(t("review.emailSentPrefix"))} ${formatDate(entry.emailSentAt)}` : escapeHtml(t("review.notSentYet"))}</div>
    </div>

    <div class="info-grid">
      <div><span>${escapeHtml(t("review.lbl.customer"))}</span><strong>${safe.customerName}</strong></div>
      <div><span>${escapeHtml(t("review.lbl.email"))}</span><strong>${safe.customerEmail}</strong></div>
      <div><span>${escapeHtml(t("review.lbl.employee"))}</span><strong>${safe.employeeName}</strong></div>
      <div><span>${escapeHtml(t("review.lbl.checklist"))}</span><strong>${safe.checklistTemplateLabel}</strong></div>
      <div><span>${escapeHtml(t("review.lbl.submitted"))}</span><strong>${formatDate(entry.submittedAt || entry.createdAt)}</strong></div>
    </div>

    <h3>${escapeHtml(t("review.pointsTitle", { label: checklistLabelPlain }))}</h3>
    <ul class="report-items">
      ${entry.items.map((item) => `
        <li>
          <span class="result-mark ${item.checked ? "ok" : ""}">${item.checked ? "✓" : "!"}</span>
          <div>
            <span>${escapeHtml(itemDisplayForSubmissionItem(item, entry.checklistTemplateId))}</span>
            ${item.comment ? `<small class="item-note">${escapeHtml(t("review.itemCommentLbl"))} ${escapeHtml(item.comment)}</small>` : ""}
            ${item.photo && item.photo.data ? `<img src="${item.photo.data}" alt="${escapeHtml(item.photo.name || t("img.altCp"))}" />` : ""}
          </div>
        </li>
      `).join("")}
    </ul>

    ${entry.employeeComment ? `<div class="report-preview"><h3>${escapeHtml(t("review.moreInfo"))}</h3><p>${safe.employeeComment}</p></div>` : ""}

    ${(entry.extraCosts && entry.extraCosts.enabled)
      ? `
        <div class="report-preview">
          <h3>${escapeHtml(t("review.extraHeading"))}</h3>
          ${Number(entry.extraCosts.amountEuro) > 0
      ? `<p><strong>${escapeHtml(t("review.extraEuroLbl"))}</strong> ${escapeHtml(formatEuroCustomerAmount(entry.extraCosts.amountEuro))}</p>`
      : ""}
          ${entry.extraCosts.comment ? `<p>${safe.extraCostsComment}</p>` : `<p>${escapeHtml(t("review.extraNoComment"))}</p>`}
          ${extraPhotoHref
      ? `
            <div class="extra-costs-review-media">
              <img src="${extraPhotoHref}" alt="${escapeHtml((extraPhoto && extraPhoto.name) || t("chk.extraPhotoHead"))}" />
              <a class="text-button extra-costs-download-link" href="${extraPhotoHref}" download="${extraPhotoDownloadName}">${escapeHtml(t("review.extraDl"))}</a>
            </div>
          `
      : `<p>${escapeHtml(t("review.extraNoPhoto"))}</p>`}
        </div>
      `
      : ""}

    <div class="photo-gallery">
      ${entry.photos.map((photo) => `<img src="${photo.data}" alt="${escapeHtml(photo.name)}">`).join("")}
    </div>

    <label class="review-comment">
      ${escapeHtml(t("review.bossComment"))}
      <textarea id="bossComment" rows="4" ${entry.status === "approved" ? "disabled" : ""}>${safe.bossComment}</textarea>
    </label>

    <details class="report-preview report-preview--collapsible">
      <summary class="report-preview-summary" title="${escapeHtml(t("review.customerReportToggleHint"))}">${escapeHtml(t("review.customerReport"))}</summary>
      <div class="report-preview-collapse-inner">
        ${reportHtml}
      </div>
    </details>

    <div class="review-actions">
      <a class="secondary-button" id="mailDraftLink" href="${mailDraftUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("review.mailDraft"))}</a>
      ${entry.status === "approved"
        ? `<button class="secondary-button" type="button" id="downloadReportPdf" aria-label="${escapeHtml(t("review.downloadPdfAria"))}">${escapeHtml(t("review.downloadPdf"))}</button>
          <button class="secondary-button" id="reopenButton" type="button">${escapeHtml(t("review.reopen"))}</button>`
        : `<button class="primary-button" id="approveButton" type="button">${escapeHtml(t("review.approve"))}</button>`}
      <button class="danger-button" id="deleteButton" type="button">${escapeHtml(t("review.delete"))}</button>
    </div>
  `;

  document.getElementById("deleteButton").addEventListener("click", () =>
    void deleteChecklist(entry.id).catch((err) => console.error(err))
  );
  const approveButton = document.getElementById("approveButton");
  if (approveButton) approveButton.addEventListener("click", () => { void approveChecklist(entry.id); });
  const dlPdf = document.getElementById("downloadReportPdf");
  if (dlPdf) dlPdf.addEventListener("click", () => { void downloadCustomerReportPdf(entry); });
  const reopenButton = document.getElementById("reopenButton");
  if (reopenButton) {
    reopenButton.addEventListener("click", () =>
      void reopenChecklist(entry.id).catch((err) => console.error(err))
    );
  }

  const summary = t("email.pointsDone", { done: String(done), total: String(entry.items.length) });
  el.emailStatus.innerHTML = `<span class="dot"></span>${escapeHtml(summary)}`;
}

function ensureBossChecklistFilterOptions() {
  if (!el.bossChecklistFilter) return;
  const signature = checklistTemplates.map((template) => `${template.id}:${template.name}`).join("|");
  if (signature === bossChecklistFilterSignature) return;
  bossChecklistFilterSignature = signature;
  const preserved = el.bossChecklistFilter.value;
  el.bossChecklistFilter.innerHTML = [
    `<option value="all">${escapeHtml(t("boss.allChecklists"))}</option>`,
    ...getChecklistTemplatesForSession().map((template) => `
      <option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>
    `)
  ].join("");
  const keepPrev = preserved === "all" || getChecklistTemplatesForSession().some((item) => item.id === preserved);
  el.bossChecklistFilter.value = keepPrev ? preserved : "all";
}

function renderLists() {
  const filter = el.statusFilter.value;
  const customerQuery = el.bossCustomerFilter.value.trim().toLowerCase();
  const projectQuery = el.bossProjectFilter.value.trim().toLowerCase();
  const extraCostsFilter = el.bossExtraCostsFilter ? el.bossExtraCostsFilter.value : "all";
  const canUseBossFilters = isFullChefSession() || isRestrictedBossSession();
  if (canUseBossFilters) ensureBossChecklistFilterOptions();
  const checklistFilterVal = el.bossChecklistFilter ? el.bossChecklistFilter.value : "all";
  const filteredByStatus = filter === "all" ? submissions : submissions.filter((entry) => entry.status === filter);
  const bossScope = canUseBossFilters
    ? filteredByStatus.filter((entry) => assertBossMayAccessSubmission(entry))
    : filteredByStatus;
  const filteredForBoss = canUseBossFilters
    ? bossScope.filter((entry) => {
      const matchesCustomer = !customerQuery || entry.customerName.toLowerCase().includes(customerQuery);
      const matchesProject = !projectQuery || entry.jobTitle.toLowerCase().includes(projectQuery);
      const hasExtraCosts = Boolean(entry.extraCosts && entry.extraCosts.enabled);
      const matchesExtraCosts = extraCostsFilter === "all"
        || (extraCostsFilter === "yes" && hasExtraCosts)
        || (extraCostsFilter === "no" && !hasExtraCosts);
      const entryTemplateId = entry.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID;
      const matchesChecklist = checklistFilterVal === "all" || entryTemplateId === checklistFilterVal;
      return matchesCustomer && matchesProject && matchesExtraCosts && matchesChecklist;
    })
    : bossScope;
  const employeeEntries = currentSession && currentSession.role === "employee"
    ? submissions.filter((entry) => (
      entry.employeeUsername
        ? entry.employeeUsername === currentSession.username
        : entry.employeeName === currentSession.label
    ))
    : submissions;
  const employeeStatusFilter = el.employeeChecklistStatusFilter && el.employeeChecklistStatusFilter.value
    ? el.employeeChecklistStatusFilter.value
    : "all";
  const employeeCustomerQuery = el.employeeChecklistCustomerFilter && el.employeeChecklistCustomerFilter.value
    ? el.employeeChecklistCustomerFilter.value.trim().toLowerCase()
    : "";
  const employeeProjectQuery = el.employeeChecklistProjectFilter && el.employeeChecklistProjectFilter.value
    ? el.employeeChecklistProjectFilter.value.trim().toLowerCase()
    : "";
  const filteredEmployeeEntries = employeeEntries.filter((entry) => {
    if (employeeStatusFilter !== "all" && entry.status !== employeeStatusFilter) return false;
    if (employeeCustomerQuery && !String(entry.customerName || "").toLowerCase().includes(employeeCustomerQuery)) return false;
    if (employeeProjectQuery && !String(entry.jobTitle || "").toLowerCase().includes(employeeProjectQuery)) return false;
    return true;
  });
  renderSubmissionList(el.employeeList, filteredEmployeeEntries, "employee");
  renderSubmissionList(el.bossList, filteredForBoss, "boss");
}

function renderStats() {
  const pool = submissionsVisibleToCurrentBoss();
  const src = currentSession && currentSession.role === "boss" && isRestrictedBossSession() ? pool : submissions;
  el.statDrafts.textContent = src.filter((entry) => entry.status === "draft").length;
  el.statSubmitted.textContent = src.filter((entry) => entry.status === "submitted").length;
  el.statApproved.textContent = src.filter((entry) => entry.status === "approved").length;
}

function render() {
  if (!currentRole) return;
  renderSectionVisibility();
  renderStats();
  renderLists();
  if (currentRole === "boss") renderReview();
  renderCustomerDb();
  renderCalendarEmployeeOptions();
  renderCalendarEmployeeFilterOptions();
  renderCalendarCustomerOptions();
  renderCalendar();
  renderWorktimeSummary();
  renderEmployeeDailyWorkPanel();
  if (activeSection === "workOrder") renderWorkOrdersPanel();
}

function collectWorkOrderRowsForViewer() {
  pruneOrphanWorkOrderStates();
  const viewer = currentSession ? currentSession.username : "";
  const managed = getManagedEmployeeUsernamesForSession();
  const rows = [];
  Object.keys(staffSchedule).forEach((dateIso) => {
    const day = staffSchedule[dateIso];
    if (!Array.isArray(day)) return;
    day.forEach((entry) => {
      if (!entry || isRecurringOccurrenceSkipEntry(entry) || !isWorkOrderAssignment(entry)) return;
      if (isFullChefSession()) {
        /* alle */
      } else if (managed && managed.length) {
        if (!managed.includes(entry.employeeUsername || "")) return;
      } else if (entry.employeeUsername !== viewer) return;
      const st = findWorkOrderState(entry.id, dateIso);
      rows.push({
        dateIso,
        entry,
        stateRow: st,
        status: (st && st.status) || "submitted",
        employeeReply: (st && typeof st.employeeReply === "string") ? st.employeeReply : ""
      });
    });
  });
  rows.sort((a, b) => {
    const tsB = workOrderCreatedSortTimestamp(b.dateIso, b.entry.fromTime, b.stateRow);
    const tsA = workOrderCreatedSortTimestamp(a.dateIso, a.entry.fromTime, a.stateRow);
    return tsB - tsA;
  });
  return rows;
}

function workOrderStatusLabel(status) {
  if (status === "in_progress") return t("wo.statusInProgress");
  if (status === "done") return t("wo.statusDone");
  return t("wo.statusSubmitted");
}

function workOrderListBadgeStatusClass(status) {
  if (status === "done") return "wo-li-done";
  if (status === "in_progress") return "wo-li-progress";
  return "wo-li-submitted";
}

function syncWorkOrdersStatusFilterDropdown() {
  const sel = el.workOrdersStatusFilter;
  if (!sel) return;
  const preserved = sel.value || "all";
  sel.innerHTML = [
    `<option value="all">${escapeHtml(t("wo.optStatusAll"))}</option>`,
    `<option value="submitted">${escapeHtml(workOrderStatusLabel("submitted"))}</option>`,
    `<option value="in_progress">${escapeHtml(workOrderStatusLabel("in_progress"))}</option>`,
    `<option value="done">${escapeHtml(workOrderStatusLabel("done"))}</option>`
  ].join("");
  sel.value = ["all", "submitted", "in_progress", "done"].includes(preserved) ? preserved : "all";
}

function syncWorkOrdersEmployeeFilterDropdown() {
  const sel = el.workOrdersEmployeeFilter;
  const wrap = el.workOrdersEmpFilterWrap;
  const managed = getManagedEmployeeUsernamesForSession();
  const showEmp = isFullChefSession() || (managed && managed.length > 1);
  if (wrap) wrap.classList.toggle("hidden", !showEmp);
  if (!sel || !showEmp) return;
  const pool = isFullChefSession() ? getEmployeeUsers() : getEmployeeUsers().filter((u) => managed.includes(u.username));
  const preserved = sel.value || "";
  sel.innerHTML = `<option value="">${escapeHtml(t("cal.allStaff"))}</option>${
    pool.map((u) => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.label)}</option>`).join("")
  }`;
  sel.value = preserved && [...sel.options].some((o) => o.value === preserved) ? preserved : "";
}

function buildWorkOrderListCardHtml(row, isSelected, showEmployeeInCard) {
  const { dateIso, entry, status } = row;
  const empLabel = getEmployeeLabelByUsername(entry.employeeUsername || "");
  const customerTitle = entry.customerName || "\u2014";
  const datePart = `${formatDateDayOnly(dateIso)}, ${entry.fromTime || ""}\u2013${entry.toTime || ""}`;
  const subLine = showEmployeeInCard ? `${empLabel} \u00b7 ${datePart}` : datePart;
  const statusBadgeCls = workOrderListBadgeStatusClass(status);
  return `
    <div class="submission-card-wrap">
      <button type="button" class="submission-card work-order-list-card ${isSelected ? "active" : ""}" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}">
        <div>
          <strong>${escapeHtml(customerTitle)}</strong>
          <small>${escapeHtml(subLine)}</small>
        </div>
        <div class="card-meta">
          <span class="badge ${statusBadgeCls}">${escapeHtml(workOrderStatusLabel(status))}</span>
        </div>
      </button>
    </div>
  `;
}

function buildWorkOrderChefReportSectionHtml(row) {
  const { dateIso, entry, stateRow, status } = row;
  if (!isWorkOrderManagementViewer() || status !== "done") return "";
  const reportEntry = buildWorkOrderReportEntry(row);
  const syncedEmail = resolveCustomerEmailForEntry(reportEntry) || "";
  if (syncedEmail) reportEntry.customerEmail = syncedEmail;
  const reportHtml = buildReportHtml(reportEntry);
  const mailDraftUrl = buildMailPreviewUrl(reportEntry);
  const bossComment = stateRow && stateRow.bossComment ? stateRow.bossComment : "";
  const emailSentAt = stateRow && stateRow.emailSentAt ? stateRow.emailSentAt : "";
  const deleteBtn = `<button class="danger-button" type="button" data-wo-action="delete-work-order" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}">${escapeHtml(t("review.delete"))}</button>`;
  const sendActions = emailSentAt
    ? `
          <a class="secondary-button" href="${mailDraftUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("review.mailDraft"))}</a>
          <button class="secondary-button" type="button" data-wo-action="download-report" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}" aria-label="${escapeHtml(t("review.downloadPdfAria"))}">${escapeHtml(t("review.downloadPdf"))}</button>
          <button class="secondary-button" type="button" data-wo-action="resend-report" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}">${escapeHtml(t("wo.resendReport"))}</button>
          ${deleteBtn}`
    : `
          <button class="primary-button" type="button" data-wo-action="send-report" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}">${escapeHtml(t("review.approve"))}</button>
          <button class="secondary-button" type="button" data-wo-action="download-report" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}" aria-label="${escapeHtml(t("review.downloadPdfAria"))}">${escapeHtml(t("review.downloadPdf"))}</button>
          ${deleteBtn}`;
  return `
        <label class="review-comment">
          ${escapeHtml(t("wo.closingReport"))}
          <textarea class="work-order-boss-comment" rows="4">${escapeHtml(bossComment)}</textarea>
        </label>
        <details class="report-preview report-preview--collapsible">
          <summary class="report-preview-summary" title="${escapeHtml(t("review.customerReportToggleHint"))}">${escapeHtml(t("review.customerReport"))}</summary>
          <div class="report-preview-collapse-inner">${reportHtml}</div>
        </details>
        <div class="review-actions">${sendActions}
        </div>`;
}

function buildWorkOrderChefReviewHeaderHtml(row) {
  const { dateIso, entry, stateRow, status } = row;
  if (!isWorkOrderManagementViewer()) return "";
  const empLabel = getEmployeeLabelByUsername(entry.employeeUsername || "");
  const projectTitle = String(entry.project || "").trim() || String(entry.customerName || "").trim() || t("wo.reportTitleFallback");
  const emailSentAt = stateRow && stateRow.emailSentAt ? stateRow.emailSentAt : "";
  const reportEntry = buildWorkOrderReportEntry(row);
  const syncedEmail = resolveCustomerEmailForEntry(reportEntry) || "";
  const statusBadgeCls = workOrderListBadgeStatusClass(status);
  return `
        <div class="review-header">
          <div>
            <span class="badge ${statusBadgeCls}">${escapeHtml(workOrderStatusLabel(status))}</span>
            <h2>${escapeHtml(projectTitle)}</h2>
          </div>
          <div class="status-pill"><span class="dot"></span>${emailSentAt ? `${escapeHtml(t("review.emailSentPrefix"))} ${formatDate(emailSentAt)}` : escapeHtml(t("review.notSentYet"))}</div>
        </div>
        <div class="info-grid">
          <div><span>${escapeHtml(t("review.lbl.customer"))}</span><strong>${escapeHtml(entry.customerName || "\u2014")}</strong></div>
          <div><span>${escapeHtml(t("review.lbl.email"))}</span><strong>${escapeHtml(syncedEmail || "\u2014")}</strong></div>
          <div><span>${escapeHtml(t("review.lbl.employee"))}</span><strong>${escapeHtml(empLabel)}</strong></div>
          <div><span>${escapeHtml(t("wo.reportTypeLabel"))}</span><strong>${escapeHtml(formatDateDayOnly(dateIso))} \u00b7 ${escapeHtml(entry.fromTime || "")}\u2013${escapeHtml(entry.toTime || "")}</strong></div>
        </div>`;
}

function buildWorkOrderArticleHtml(row) {
  const { dateIso, entry, stateRow, status, employeeReply } = row;
  const labelDate = new Intl.DateTimeFormat(intlLocaleSafe(), { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateIso));
  const isWoMgr = isWorkOrderManagementViewer();
  const empLabel = getEmployeeLabelByUsername(entry.employeeUsername || "");
  const isOwn = Boolean(!isWoMgr && entry.employeeUsername === (currentSession && currentSession.username));
  const imgs = sanitizeWorkOrderChefImages(entry.workOrderImages || []);
  const resultImgs = sanitizeWorkOrderChefImages(entry.workOrderResultImages || []);
  const chefPhotosHtml = imgs.length
    ? `<div class="work-order-chef-photos"><p class="work-order-subline"><strong>${escapeHtml(t("wo.chefPhotosLbl"))}</strong></p><div class="work-order-photo-row">${imgs.map((ph) => {
      const src = safeDataImageSrc(ph.data);
      return src
        ? `<a class="work-order-photo-link" href="${src}" target="_blank" rel="noopener noreferrer"><img class="work-order-chef-thumb" src="${src}" alt="${escapeHtml(ph.name || "photo")}" /></a>`
        : "";
    }).join("")}</div></div>`
    : "";
  let resultPhotosHtml = "";
  if (isOwn && status !== "done") {
    const tiles = resultImgs.map((ph, i) => {
      const src = safeDataImageSrc(ph.data);
      if (!src) return "";
      return `<div class="calendar-wo-photo-tile work-order-result-tile"><img src="${src}" alt="${escapeHtml(ph.name || "photo")}" /><button type="button" class="text-button calendar-wo-photo-remove" data-wo-action="remove-result-photo" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}" data-wo-photo-index="${i}" aria-label="${escapeHtml(t("wo.removePhoto"))}">\u00d7</button></div>`;
    }).join("");
    const atMax = resultImgs.length >= WORK_ORDER_MAX_RESULT_PHOTOS;
    resultPhotosHtml = `<div class="work-order-result-upload">
      <p class="work-order-subline"><strong>${escapeHtml(t("wo.resultPhotosLbl"))}</strong> <span class="muted">${escapeHtml(t("wo.resultPhotosOptional"))} (${resultImgs.length}/${WORK_ORDER_MAX_RESULT_PHOTOS})</span></p>
      <div class="calendar-wo-photo-preview work-order-result-preview">${tiles}</div>
      <input type="file" class="work-order-result-file-input" accept="image/*" multiple data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}" />
      <button type="button" class="secondary-button work-order-result-pick-btn" data-wo-action="pick-result-photos" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}" ${atMax ? "disabled" : ""}>${escapeHtml(t("wo.pickResultPhotos"))}</button>
    </div>`;
  } else if (resultImgs.length) {
    resultPhotosHtml = `<div class="work-order-chef-photos"><p class="work-order-subline"><strong>${escapeHtml(t("wo.resultPhotosLbl"))}</strong></p><div class="work-order-photo-row">${resultImgs.map((ph) => {
      const src = safeDataImageSrc(ph.data);
      return src
        ? `<a class="work-order-photo-link" href="${src}" target="_blank" rel="noopener noreferrer"><img class="work-order-chef-thumb" src="${src}" alt="${escapeHtml(ph.name || "photo")}" /></a>`
        : "";
    }).join("")}</div></div>`;
  }
  const chefSendBackHtml = isWoMgr && status === "done"
    ? `<div class="work-order-chef-sendback"><button type="button" class="secondary-button" data-wo-action="chef-send-back" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}">${escapeHtml(t("wo.chefSendBack"))}</button></div>`
    : "";
  const comeStamp = stateRow && stateRow.employeeComeAt ? stateRow.employeeComeAt : "";
  const leaveStamp = stateRow && stateRow.employeeLeaveAt ? stateRow.employeeLeaveAt : "";
  const comeCaptured = Boolean(comeStamp);
  const leaveCaptured = Boolean(leaveStamp);
  const hasAnyTimeDoc = Boolean(comeStamp || leaveStamp);
  const canEditTimeDoc = Boolean(isOwn && status !== "done");
  const workOrderTimeDocHtml = (canEditTimeDoc || hasAnyTimeDoc)
    ? `<div class="work-order-time-doc">
        <p class="work-order-subline"><strong>${escapeHtml(t("wo.timeDocLbl"))}</strong></p>
        <div class="work-order-time-doc-row">
          <span><strong>${escapeHtml(t("wo.comeLbl"))}</strong> ${escapeHtml(formatWorkOrderEmployeeTimeStamp(comeStamp))}</span>
          <span><strong>${escapeHtml(t("wo.leaveLbl"))}</strong> ${escapeHtml(formatWorkOrderEmployeeTimeStamp(leaveStamp))}</span>
        </div>
        ${canEditTimeDoc ? `<div class="work-order-time-doc-actions">
          <button type="button" class="secondary-button" data-wo-action="capture-come" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}" ${comeCaptured ? "disabled" : ""}>${escapeHtml(t("wo.captureCome"))}</button>
          <button type="button" class="secondary-button" data-wo-action="capture-leave" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}" ${leaveCaptured ? "disabled" : ""}>${escapeHtml(t("wo.captureLeave"))}</button>
        </div>` : ""}
      </div>`
    : "";
  const employeeReplyLabel = t("wo.replyLblEmployee");
  const replyChefHtml = isWoMgr
    ? `<p class="work-order-reply-display"><strong>${escapeHtml(t("wo.replyLbl"))}</strong> ${employeeReply.trim() ? escapeHtmlMultilineAsBr(employeeReply) : escapeHtml(t("common.emDash"))}</p>`
    : "";
  const replyEmployeeHtml = isOwn
    ? (status !== "done"
      ? `<div class="work-order-reply-edit">
            <label class="work-order-reply-label"><span>${escapeHtml(employeeReplyLabel)}</span>
              <textarea class="work-order-reply-input" rows="3">${escapeHtml(employeeReply || "")}</textarea>
            </label>
            <div class="work-order-reply-actions">
              <button type="button" class="secondary-button" data-wo-action="save-reply" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}">${escapeHtml(t("wo.saveReply"))}</button>
            </div>
          </div>`
      : `<p class="work-order-reply-display"><strong>${escapeHtml(employeeReplyLabel)}</strong> ${employeeReply.trim() ? escapeHtmlMultilineAsBr(employeeReply) : escapeHtml(t("common.emDash"))}</p>`)
    : "";
  const actions = isOwn
    ? (status === "submitted"
      ? `<button type="button" class="primary-button" data-wo-action="progress" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}">${escapeHtml(t("wo.btnSetInProgress"))}</button>`
      : status === "in_progress"
        ? `<button type="button" class="primary-button" data-wo-action="done" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}">${escapeHtml(t("wo.btnSetDone"))}</button>`
        : `<span class="work-order-done-note">${escapeHtml(t("wo.allDone"))}</span>`)
    : "";
  const chefMetaCell = isWoMgr
    ? `<div class="work-order-data-cell"><strong>${escapeHtml(t("wo.empLbl"))}</strong> ${escapeHtml(empLabel)}</div>`
    : "";
  const chefReviewHeader = buildWorkOrderChefReviewHeaderHtml(row);
  const chefReportSection = buildWorkOrderChefReportSectionHtml(row);
  const chefDeleteHtml = isWoMgr && status !== "done"
    ? `<div class="review-actions work-order-delete-actions"><button class="danger-button" type="button" data-wo-action="delete-work-order" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}">${escapeHtml(t("review.delete"))}</button></div>`
    : "";
  const employeeHeadHtml = isWoMgr ? "" : `
        <div class="work-order-card-head">
          <span class="work-order-status work-order-status-${escapeHtml(status)}">${escapeHtml(workOrderStatusLabel(status))}</span>
          <span class="work-order-date">${escapeHtml(labelDate)} \u00b7 ${escapeHtml(entry.fromTime || "")}\u2013${escapeHtml(entry.toTime || "")}</span>
        </div>
        <div class="work-order-data-row">
          ${chefMetaCell}
          <div class="work-order-data-cell"><strong>${escapeHtml(t("wo.nameLbl"))}</strong> ${escapeHtml(entry.customerName || "\u2014")}</div>
          <div class="work-order-data-cell"><strong>${escapeHtml(t("wo.addrLbl"))}</strong> ${escapeHtml(entry.customerAddress || "\u2014")}</div>
        </div>`;
  return `
      <article class="work-order-card work-order-detail-card${isWoMgr ? " work-order-detail-card--review" : ""}" data-wo-assignment="${escapeHtml(entry.id)}" data-wo-date="${escapeHtml(dateIso)}">
        ${isWoMgr ? chefReviewHeader : employeeHeadHtml}
        <p class="work-order-instruction"><strong>${escapeHtml(t("wo.instrLbl"))}</strong> ${escapeHtml(entry.staffComment || t("common.emDash"))}</p>
        ${workOrderTimeDocHtml}
        ${chefPhotosHtml}
        ${resultPhotosHtml}
        ${replyChefHtml}
        ${replyEmployeeHtml}
        ${chefSendBackHtml}
        ${chefReportSection}
        ${chefDeleteHtml}
        ${actions ? `<div class="actions work-order-actions">${actions}</div>` : ""}
      </article>
    `;
}

function renderWorkOrdersPanel() {
  if (!el.workOrdersList || !el.workOrdersDetailPanel || !el.workOrdersDetailBody || !el.workOrdersDetailEmpty) return;

  syncWorkOrdersStatusFilterDropdown();
  syncWorkOrdersEmployeeFilterDropdown();

  if (el.workOrdersSearchRow) {
    el.workOrdersSearchRow.classList.toggle("work-orders-search-row--full", isFullChefSession());
  }

  const allRows = collectWorkOrderRowsForViewer();
  if (!allRows.length) {
    activeWorkOrderAssignmentId = "";
    activeWorkOrderDateIso = "";
    if (el.workOrdersToolbar) el.workOrdersToolbar.classList.add("hidden");
    el.workOrdersList.innerHTML = `<div class="submission-card-wrap"><div class="submission-card"><strong>${escapeHtml(t("wo.emptyTitleShort"))}</strong><small>${escapeHtml(t("wo.empty"))}</small></div></div>`;
    el.workOrdersDetailBody.classList.add("hidden");
    el.workOrdersDetailBody.innerHTML = "";
    el.workOrdersDetailEmpty.classList.remove("hidden");
    if (WC && el.workOrdersPanel) WC.applyToScope(el.workOrdersPanel);
    return;
  }
  if (el.workOrdersToolbar) el.workOrdersToolbar.classList.remove("hidden");

  const custEl = el.workOrdersCustomerFilter;
  const projEl = el.workOrdersProjectFilter;
  const empEl = el.workOrdersEmployeeFilter;
  const statusEl = el.workOrdersStatusFilter;
  const customerQuery = custEl && custEl.value ? custEl.value.trim().toLowerCase() : "";
  const projectQuery = projEl && projEl.value ? projEl.value.trim().toLowerCase() : "";
  const managedWo = getManagedEmployeeUsernamesForSession();
  const showEmpOnWoCard = isFullChefSession() || (managedWo && managedWo.length > 1);
  const empFilter = showEmpOnWoCard && empEl && empEl.value ? String(empEl.value).trim() : "";
  const statusFilterVal = statusEl && statusEl.value ? statusEl.value : "all";

  let filtered = allRows;
  if (customerQuery) {
    filtered = filtered.filter((r) => {
      const name = String(r.entry.customerName || "").toLowerCase();
      const addr = String(r.entry.customerAddress || "").toLowerCase();
      return name.includes(customerQuery) || addr.includes(customerQuery);
    });
  }
  if (projectQuery) {
    filtered = filtered.filter((r) => String(r.entry.project || "").toLowerCase().includes(projectQuery));
  }
  if (empFilter) {
    filtered = filtered.filter((r) => String(r.entry.employeeUsername || "") === empFilter);
  }
  if (statusFilterVal && statusFilterVal !== "all") {
    filtered = filtered.filter((r) => r.status === statusFilterVal);
  }

  const selectedStillVisible = filtered.some(
    (r) => r.entry.id === activeWorkOrderAssignmentId && r.dateIso === activeWorkOrderDateIso
  );
  if (!selectedStillVisible) {
    activeWorkOrderAssignmentId = "";
    activeWorkOrderDateIso = "";
  }

  if (!filtered.length) {
    activeWorkOrderAssignmentId = "";
    activeWorkOrderDateIso = "";
    el.workOrdersList.innerHTML = `<div class="submission-card-wrap"><div class="submission-card"><strong>${escapeHtml(t("wo.noHitsTitleShort"))}</strong><small>${escapeHtml(t("wo.filterNoHits"))}</small></div></div>`;
    el.workOrdersDetailBody.classList.add("hidden");
    el.workOrdersDetailBody.innerHTML = "";
    el.workOrdersDetailEmpty.classList.remove("hidden");
    if (WC && el.workOrdersPanel) WC.applyToScope(el.workOrdersPanel);
    return;
  }

  const selectedRow = (activeWorkOrderAssignmentId && activeWorkOrderDateIso)
    ? filtered.find((r) => r.entry.id === activeWorkOrderAssignmentId && r.dateIso === activeWorkOrderDateIso)
    : null;

  el.workOrdersList.innerHTML = filtered.map((row) =>
    buildWorkOrderListCardHtml(row, Boolean(selectedRow && selectedRow.entry.id === row.entry.id && selectedRow.dateIso === row.dateIso), showEmpOnWoCard)
  ).join("");

  if (selectedRow) {
    el.workOrdersDetailEmpty.classList.add("hidden");
    el.workOrdersDetailBody.classList.remove("hidden");
    el.workOrdersDetailBody.innerHTML = buildWorkOrderArticleHtml(selectedRow);
  } else {
    el.workOrdersDetailBody.classList.add("hidden");
    el.workOrdersDetailBody.innerHTML = "";
    el.workOrdersDetailEmpty.classList.remove("hidden");
  }

  if (WC && el.workOrdersPanel) WC.applyToScope(el.workOrdersPanel);
}

function handleWorkOrdersPanelClick(event) {
  const listPick = event.target && event.target.closest ? event.target.closest("button.work-order-list-card") : null;
  if (listPick && el.workOrdersList && el.workOrdersList.contains(listPick)) {
    const assignmentId = listPick.getAttribute("data-wo-assignment");
    const dateIso = listPick.getAttribute("data-wo-date");
    if (assignmentId && dateIso) {
      activeWorkOrderAssignmentId = assignmentId;
      activeWorkOrderDateIso = dateIso;
      renderWorkOrdersPanel();
    }
    return;
  }
  const btn = event.target && event.target.closest ? event.target.closest("[data-wo-action]") : null;
  if (!btn || !el.workOrdersDetailBody || !el.workOrdersDetailBody.contains(btn)) return;
  const action = btn.getAttribute("data-wo-action");
  const assignmentId = btn.getAttribute("data-wo-assignment");
  const dateIso = btn.getAttribute("data-wo-date");
  if (!assignmentId || !dateIso) return;
  const card = btn.closest(".work-order-card");
  const replyTa = card ? card.querySelector("textarea.work-order-reply-input") : null;
  const bossCommentTa = card ? card.querySelector("textarea.work-order-boss-comment") : null;
  if (action === "delete-work-order") {
    if (!isWorkOrderManagementViewer()) return;
    deleteWorkOrderAssignment(assignmentId, dateIso);
    return;
  }
  if (action === "download-report") {
    const rowPayload = findWorkOrderRowPayload(assignmentId, dateIso);
    if (!rowPayload) return;
    if (bossCommentTa) persistWorkOrderBossComment(assignmentId, dateIso, bossCommentTa.value);
    const reportEntry = buildWorkOrderReportEntry(findWorkOrderRowPayload(assignmentId, dateIso) || rowPayload);
    void downloadCustomerReportPdf(reportEntry);
    return;
  }
  if (action === "send-report" || action === "resend-report") {
    if (!isWorkOrderManagementViewer()) return;
    let rowPayload = findWorkOrderRowPayload(assignmentId, dateIso);
    if (!rowPayload || rowPayload.status !== "done") return;
    if (bossCommentTa) persistWorkOrderBossComment(assignmentId, dateIso, bossCommentTa.value);
    rowPayload = findWorkOrderRowPayload(assignmentId, dateIso) || rowPayload;
    const sendBtn = btn;
    let prevLabel = "";
    if (sendBtn) {
      sendBtn.disabled = true;
      prevLabel = sendBtn.textContent;
      sendBtn.textContent = t("review.approveBusy");
    }
    void sendWorkOrderCustomerReport(rowPayload, { silent: true }).then((sent) => {
      if (sent) showToast(t("toast.approved"));
    }).finally(() => {
      renderWorkOrdersPanel();
      if (sendBtn && sendBtn.isConnected) {
        sendBtn.disabled = false;
        sendBtn.textContent = prevLabel || t("review.approve");
      }
    });
    return;
  }
  if (action === "pick-result-photos") {
    const inp = card ? card.querySelector(".work-order-result-file-input") : null;
    if (inp && !inp.disabled) inp.click();
    return;
  }
  if (action === "chef-send-back") {
    if (!isWorkOrderManagementViewer()) return;
    const ixEntry = scheduleEntryIndexForAssignment(assignmentId, dateIso);
    const d = String(dateIso || "").trim();
    const list = staffSchedule[d];
    const ent = ixEntry >= 0 && Array.isArray(list) ? list[ixEntry] : null;
    if (!ent || !bossMayManageAssignmentEmployee(ent.employeeUsername || "")) return;
    const st = findWorkOrderState(assignmentId, dateIso);
    if (!st || st.status !== "done") return;
    setWorkOrderStateStatus(assignmentId, dateIso, "in_progress");
    showToast(t("wo.toastChefSentBack"));
    renderWorkOrdersPanel();
    renderCalendar();
    return;
  }
  if (action === "remove-result-photo") {
    const ix = Number(btn.getAttribute("data-wo-photo-index"));
    if (!Number.isInteger(ix) || ix < 0) return;
    const viewer = currentSession ? currentSession.username : "";
    const ixEntry = scheduleEntryIndexForAssignment(assignmentId, dateIso);
    const d = String(dateIso || "").trim();
    const list = staffSchedule[d];
    const ent = ixEntry >= 0 && Array.isArray(list) ? list[ixEntry] : null;
    const stateRow = findWorkOrderState(assignmentId, dateIso);
    const st = (stateRow && stateRow.status) || "submitted";
    if (!ent || ent.employeeUsername !== viewer || st === "done") return;
    removeWorkOrderResultPhotoAt(assignmentId, dateIso, ix);
    renderWorkOrdersPanel();
    renderCalendar();
    return;
  }
  if (action === "capture-come" || action === "capture-leave") {
    const viewer = currentSession ? currentSession.username : "";
    const ixEntry = scheduleEntryIndexForAssignment(assignmentId, dateIso);
    const d = String(dateIso || "").trim();
    const list = staffSchedule[d];
    const ent = ixEntry >= 0 && Array.isArray(list) ? list[ixEntry] : null;
    const stateRow = findWorkOrderState(assignmentId, dateIso);
    const st = (stateRow && stateRow.status) || "submitted";
    if (!ent || ent.employeeUsername !== viewer || st === "done") return;
    if (action === "capture-come" && stateRow && stateRow.employeeComeAt) return;
    if (action === "capture-leave" && stateRow && stateRow.employeeLeaveAt) return;
    setWorkOrderEmployeeTimeStamp(assignmentId, dateIso, action === "capture-come" ? "come" : "leave");
    showToast(action === "capture-come" ? t("wo.toastComeCaptured") : t("wo.toastLeaveCaptured"));
    renderWorkOrdersPanel();
    return;
  }
  if (action === "progress") {
    if (replyTa) setWorkOrderEmployeeReply(assignmentId, dateIso, replyTa.value);
    setWorkOrderStateStatus(assignmentId, dateIso, "in_progress");
    showToast(t("wo.toastInProgress"));
  } else if (action === "done") {
    if (replyTa) setWorkOrderEmployeeReply(assignmentId, dateIso, replyTa.value);
    setWorkOrderStateStatus(assignmentId, dateIso, "done");
    showToast(t("wo.toastDone"));
  } else if (action === "save-reply") {
    if (!replyTa) return;
    setWorkOrderEmployeeReply(assignmentId, dateIso, replyTa.value);
    showToast(t("wo.replySaved"));
  } else {
    return;
  }
  renderWorkOrdersPanel();
  renderCalendar();
}

async function handleWorkOrderResultFileInputChange(event) {
  const inp = event.target;
  if (!inp || typeof inp.classList === "undefined" || !inp.classList.contains("work-order-result-file-input")) return;
  if (!el.workOrdersDetailBody || !el.workOrdersDetailBody.contains(inp)) return;
  const assignmentId = inp.getAttribute("data-wo-assignment");
  const dateIso = inp.getAttribute("data-wo-date");
  if (!assignmentId || !dateIso) return;
  const viewer = currentSession ? currentSession.username : "";
  const ixEntry = scheduleEntryIndexForAssignment(assignmentId, dateIso);
  const d = String(dateIso || "").trim();
  const list = staffSchedule[d];
  const ent = ixEntry >= 0 && Array.isArray(list) ? list[ixEntry] : null;
  const stateRow = findWorkOrderState(assignmentId, dateIso);
  const st = (stateRow && stateRow.status) || "submitted";
  if (!ent || ent.employeeUsername !== viewer || st === "done") {
    inp.value = "";
    return;
  }
  if (!inp.files || !inp.files.length) return;
  await handleWorkOrderResultPhotoPick(assignmentId, dateIso, inp.files);
  inp.value = "";
  renderWorkOrdersPanel();
  renderCalendar();
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

function weekdayFromIsoDate(isoDate) {
  return new Date(isoDate).getDay();
}

function isoDateIsCalendarValid(iso) {
  const parts = String(iso || "").split("-").map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function getRuleRecurrenceKind(rule) {
  const k = rule && rule.recurrenceKind;
  if (k === "biweekly" || k === "monthly") return k;
  return "weekly";
}

function isoDateToLocalMidnightMs(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d).getTime();
}

function diffCalendarDays(isoA, isoB) {
  const ms = isoDateToLocalMidnightMs(isoB) - isoDateToLocalMidnightMs(isoA);
  return Math.round(ms / 86400000);
}

function matchesMonthlyCalendarDay(isoDate, monthlyDayRaw) {
  const [y, m, day] = String(isoDate || "").split("-").map(Number);
  const dom = Number(monthlyDayRaw);
  if (!y || !m || !day || !Number.isInteger(dom) || dom < 1 || dom > 31) return false;
  const last = new Date(y, m, 0).getDate();
  const target = Math.min(dom, last);
  return day === target;
}

function ruleAppliesToIsoDate(rule, isoDate) {
  const deletedFromIso = String((rule && rule.deletedFromIso) || "").trim();
  if (deletedFromIso && isoDate >= deletedFromIso) return false;
  const effectiveFromIso = String((rule && rule.effectiveFromIso) || "").trim();
  if (effectiveFromIso && isoDate < effectiveFromIso) return false;
  const kind = getRuleRecurrenceKind(rule);
  if (kind === "weekly") {
    return Number(rule.weekday) === weekdayFromIsoDate(isoDate);
  }
  if (kind === "biweekly") {
    if (Number(rule.weekday) !== weekdayFromIsoDate(isoDate)) return false;
    const anchor = rule.anchorIso || isoDate;
    const diff = diffCalendarDays(anchor, isoDate);
    if (diff < 0) return false;
    return diff % 14 === 0;
  }
  if (kind === "monthly") {
    return matchesMonthlyCalendarDay(isoDate, rule.monthlyDay);
  }
  return false;
}

function recurrenceKindLabel(kind) {
  if (kind === "biweekly") return t("cal.ruleBiweeklyLbl");
  if (kind === "monthly") return t("cal.ruleMonthlyLbl");
  return t("cal.ruleWeeklyLbl");
}

function isRecurringOccurrenceSkipEntry(entry) {
  return Boolean(entry && entry.recurringOccurrenceSkip && entry.recurrenceRuleId);
}

function getRecurringEntriesForDate(isoDate) {
  return recurringScheduleRules
    .filter((rule) => ruleAppliesToIsoDate(rule, isoDate))
    .map((rule) => {
      const tplIds = normalizeAssignmentTemplateIds(rule);
      return ({
        id: `${rule.id}::${isoDate}`,
        recurrenceRuleId: rule.id,
        recurrenceType: getRuleRecurrenceKind(rule),
        checklistOwnerUsername: rule.checklistOwnerUsername || rule.employeeUsername,
        employeeUsername: rule.employeeUsername,
        name: rule.name,
        fromTime: rule.fromTime,
        toTime: rule.toTime,
        customerId: rule.customerId,
        customerName: rule.customerName,
        customerAddress: rule.customerAddress,
        customerCoordinates: rule.customerCoordinates || "",
        project: rule.project,
        staffComment: rule.staffComment || "",
        checklistTemplateIds: tplIds.slice(),
        checklistTemplateId: tplIds[0],
        hausGartenZoneIds: (() => {
          const hz = sanitizeAssignmentHausGartenZoneIds(rule.hausGartenZoneIds);
          if (hz.length) return hz.slice();
          return tplIds.includes(HAUS_CHECKLIST_TEMPLATE_ID) ? [...HAUS_CHECKPOINT_ZONE_IDS] : [];
        })()
      });
    });
}

function getScheduleEntriesForDate(isoDate) {
  const explicitEntries = staffSchedule[isoDate] || [];
  const visibleExplicit = explicitEntries.filter((entry) => !isRecurringOccurrenceSkipEntry(entry));
  const recurringEntries = getRecurringEntriesForDate(isoDate)
    .filter((ruleEntry) => !explicitEntries.some((explicitEntry) => explicitEntry.recurrenceRuleId === ruleEntry.recurrenceRuleId));
  return [...visibleExplicit, ...recurringEntries];
}

function getDayLoadReport(entryCount) {
  if (entryCount >= 10) {
    return { points: 3, tone: "full", label: t("cal.loadLabelFull") };
  }
  if (entryCount >= 7) {
    return { points: 3, tone: "high", label: "●●●" };
  }
  if (entryCount >= 4) {
    return { points: 2, tone: "medium", label: "●●" };
  }
  if (entryCount >= 1) {
    return { points: 1, tone: "low", label: "●" };
  }
  return { points: 0, tone: "", label: "" };
}

function getRecordedDailyBreakMinutes(rec) {
  if (!rec) return 0;
  const pauseStartMin = parseTimeToMinutes(rec.breakStart);
  const pauseEndMin = parseTimeToMinutes(rec.breakEnd);
  if (pauseStartMin === null || pauseEndMin === null || pauseEndMin <= pauseStartMin) return 0;
  return pauseEndMin - pauseStartMin;
}

function getDailyAttendanceNetMinutes(rec) {
  if (!rec) return 0;
  const start = parseTimeToMinutes(rec.come);
  const end = parseTimeToMinutes(rec.leave);
  if (start === null || end === null || end <= start) return 0;
  const grossMinutes = end - start;
  const recordedBreakMinutes = getRecordedDailyBreakMinutes(rec);
  return Math.max(0, grossMinutes - recordedBreakMinutes);
}

function getChecklistAttendanceNetMinutes(entry) {
  const attendance = entry && entry.attendance ? entry.attendance : {};
  const start = parseTimeToMinutes(attendance.come);
  const end = parseTimeToMinutes(attendance.leave);
  if (start === null || end === null || end <= start) return 0;
  return Math.max(0, end - start);
}

function getWorkOrderAttendanceNetMinutes(stateRow) {
  if (!stateRow) return 0;
  const comeRaw = String(stateRow.employeeComeAt || "").trim();
  const leaveRaw = String(stateRow.employeeLeaveAt || "").trim();
  if (!comeRaw || !leaveRaw) return 0;
  const come = new Date(comeRaw);
  const leave = new Date(leaveRaw);
  const startMs = come.getTime();
  const endMs = leave.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

function getIsoWeekYearAndNumberLocal(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const isoYear = date.getFullYear();
  const week1 = new Date(isoYear, 0, 4);
  const week = 1 + Math.round(
    ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
  return { isoYear, week };
}

function formatDateAsIsoWeekInput(d) {
  const { isoYear, week } = getIsoWeekYearAndNumberLocal(d);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function getPeriodBoundsFromIsoWeekValue(val) {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(val).trim());
  if (!match) return null;
  const isoYear = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const week1Anchor = new Date(isoYear, 0, 4);
  const day = (week1Anchor.getDay() + 6) % 7;
  const mondayWeek1 = new Date(week1Anchor);
  mondayWeek1.setDate(week1Anchor.getDate() - day);
  const start = new Date(mondayWeek1);
  start.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return [start, end];
}

function getPeriodBoundsFromMonthValue(val) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(val).trim());
  if (!match) return null;
  const y = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = new Date(y, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(y, month, 1);
  return [start, end];
}

function refreshWorktimePeriodDisplay() {
  if (!el.worktimePeriodDisplay || !el.worktimeDate || !el.worktimeScope) return;
  const scope = el.worktimeScope.value;
  const v = el.worktimeDate.value;
  if (!v) {
    el.worktimePeriodDisplay.textContent = t("common.emDash");
    return;
  }
  if (scope === "day" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, month, day] = v.split("-").map(Number);
    el.worktimePeriodDisplay.textContent = new Intl.DateTimeFormat(intlLocaleSafe(), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(y, month - 1, day));
    return;
  }
  if (scope === "week" && /^\d{4}-W\d{2}$/.test(v)) {
    const matched = /^(\d{4})-W(\d{2})$/.exec(v);
    el.worktimePeriodDisplay.textContent = matched
      ? t("wt.weekLabel", { w: String(parseInt(matched[2], 10)), y: matched[1] })
      : v;
    return;
  }
  if (scope === "month" && /^\d{4}-\d{2}$/.test(v)) {
    const [y, month] = v.split("-").map(Number);
    el.worktimePeriodDisplay.textContent = new Intl.DateTimeFormat(intlLocaleSafe(), {
      month: "long",
      year: "numeric"
    }).format(new Date(y, month - 1, 1));
    return;
  }
  el.worktimePeriodDisplay.textContent = v;
}

function readChefWorktimeStoredAsAnchorDate(raw) {
  const trimmed = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, month, day] = trimmed.split("-").map(Number);
    return new Date(y, month - 1, day);
  }
  if (/^\d{4}-W\d{2}$/.test(trimmed)) {
    const bounds = getPeriodBoundsFromIsoWeekValue(trimmed);
    return bounds ? bounds[0] : new Date();
  }
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const [y, month] = trimmed.split("-").map(Number);
    return new Date(y, month - 1, 1);
  }
  return new Date();
}

function formatChefStorageForScope(scope, anchorDate) {
  if (scope === "day") return toIsoDate(anchorDate);
  if (scope === "week") return formatDateAsIsoWeekInput(anchorDate);
  return `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, "0")}`;
}

function syncChefWorktimePeriodInput() {
  if (!el.worktimeDate || !el.worktimePickerFace || !el.worktimeScope) return;
  const scope = el.worktimeScope.value;
  const store = el.worktimeDate;
  const anchor = store.value.trim() ? readChefWorktimeStoredAsAnchorDate(store.value) : new Date();
  store.value = formatChefStorageForScope(scope, anchor);
  el.worktimePickerFace.value = toIsoDate(anchor);
  refreshWorktimePeriodDisplay();
}

function getChefWorktimePeriodBounds() {
  const scope = el.worktimeScope.value;
  const v = el.worktimeDate.value;
  if (!v) return null;
  if (scope === "day") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const start = new Date(`${v}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return [start, end];
  }
  if (scope === "week") return getPeriodBoundsFromIsoWeekValue(v);
  return getPeriodBoundsFromMonthValue(v);
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function getLocalTodayIsoDate() {
  return toIsoDate(new Date());
}

function isEmployeeDailyWorkStampDay(dateIso) {
  return String(dateIso || "").trim() === getLocalTodayIsoDate();
}

function canEmployeeStartCalendarAssignmentOnDate(dateIso) {
  if (!currentSession || currentSession.role !== "employee") return true;
  return isEmployeeDailyWorkStampDay(dateIso);
}

function syncEmployeeWorkDateInputForEmployee() {
  if (!el.employeeWorkDate) return;
  if (currentSession && currentSession.role === "employee") {
    el.employeeWorkDate.max = getLocalTodayIsoDate();
    el.employeeWorkDate.removeAttribute("min");
  } else {
    el.employeeWorkDate.removeAttribute("max");
  }
}

function hydrateEmployeeDailyWorkForm() {
  if (!currentSession || currentSession.role !== "employee") return;
  const todayIso = getLocalTodayIsoDate();
  const dateIso = el.employeeWorkDate && el.employeeWorkDate.value ? el.employeeWorkDate.value : todayIso;
  if (el.employeeWorkDate && !el.employeeWorkDate.value) el.employeeWorkDate.value = todayIso;
  const stampToday = isEmployeeDailyWorkStampDay(dateIso);
  const rec = getDailyAttendanceRecord(currentSession.username, dateIso);
  const come = rec && rec.come ? rec.come : "";
  const leave = rec && rec.leave ? rec.leave : "";
  const breakStart = rec && rec.breakStart ? rec.breakStart : "";
  const breakEnd = rec && rec.breakEnd ? rec.breakEnd : "";
  const corrPending = Boolean(rec && rec.correction && rec.correction.status === "pending");
  if (el.employeeWorkDateHint) {
    el.employeeWorkDateHint.classList.toggle("hidden", stampToday);
  }
  if (el.dayWorkComeDisplay) el.dayWorkComeDisplay.textContent = come || "-";
  if (el.dayWorkLeaveDisplay) el.dayWorkLeaveDisplay.textContent = leave || "-";
  if (el.dayWorkBreakStartDisplay) {
    el.dayWorkBreakStartDisplay.textContent = breakStart ? `${t("wt.startDisp")} ${breakStart}` : `${t("wt.startDisp")} -`;
  }
  if (el.dayWorkBreakEndDisplay) {
    el.dayWorkBreakEndDisplay.textContent = breakEnd ? `${t("wt.endDisp")} ${breakEnd}` : `${t("wt.endDisp")} -`;
  }
  if (el.dayWorkComeButton) el.dayWorkComeButton.disabled = Boolean(come || corrPending || !stampToday);
  if (el.dayWorkLeaveButton) el.dayWorkLeaveButton.disabled = Boolean(leave || corrPending || !stampToday);
  if (el.dayWorkBreakStartButton) el.dayWorkBreakStartButton.disabled = Boolean(breakStart || corrPending || !stampToday);
  if (el.dayWorkBreakEndButton) el.dayWorkBreakEndButton.disabled = Boolean(breakEnd || corrPending || !stampToday);
  hydrateEmployeeDailyCorrectionPanel();
}

function applyDailyCorrectionPanelVisualExpanded(expanded) {
  if (el.dailyWorkCorrectionCollapsible) {
    el.dailyWorkCorrectionCollapsible.classList.toggle("hidden", !expanded);
  }
}

function syncDailyCorrectionToggleLabel(expanded, correctionPending) {
  if (!el.dailyWorkCorrectionToggle) return;
  if (correctionPending) {
    el.dailyWorkCorrectionToggle.textContent = t("dc.togglePending");
    el.dailyWorkCorrectionToggle.setAttribute("aria-expanded", "false");
    return;
  }
  el.dailyWorkCorrectionToggle.textContent = expanded ? t("dc.toggleClose") : t("dc.toggleOpen");
  el.dailyWorkCorrectionToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function toggleDailyCorrectionPanel() {
  if (!currentSession || currentSession.role !== "employee") return;
  if (!el.dailyWorkCorrectionToggle || el.dailyWorkCorrectionToggle.disabled) return;
  dailyCorrectionPanelExpanded = !dailyCorrectionPanelExpanded;
  applyDailyCorrectionPanelVisualExpanded(dailyCorrectionPanelExpanded);
  syncDailyCorrectionToggleLabel(dailyCorrectionPanelExpanded, false);
}

function hydrateEmployeeDailyCorrectionPanel() {
  if (!el.dailyWorkCorrectionWrap) return;
  const isEmployee = currentSession && currentSession.role === "employee";
  if (!isEmployee) {
    el.dailyWorkCorrectionWrap.classList.add("hidden");
    return;
  }
  const dateIso = el.employeeWorkDate && el.employeeWorkDate.value ? el.employeeWorkDate.value : toIsoDate(new Date());
  const rec = getDailyAttendanceRecord(currentSession.username, dateIso);
  const hasStamp = dailyAttendanceHasAnyStamp(rec);
  el.dailyWorkCorrectionWrap.classList.toggle("hidden", !hasStamp);
  if (!hasStamp) return;

  if (dateIso !== dailyCorrectionHydratedDate) {
    dailyCorrectionHydratedDate = dateIso;
    dailyCorrectionPanelExpanded = false;
  }

  const pending = Boolean(rec && rec.correction && rec.correction.status === "pending");
  const rejected = Boolean(rec && rec.correction && rec.correction.status === "rejected");
  if (pending) dailyCorrectionPanelExpanded = false;

  if (el.dailyWorkCorrectionPending) {
    el.dailyWorkCorrectionPending.classList.toggle("hidden", !pending);
    if (pending) {
      el.dailyWorkCorrectionPending.textContent = t("dc.pendingBanner");
    }
  }
  if (el.dailyWorkCorrectionRejected) {
    el.dailyWorkCorrectionRejected.classList.toggle("hidden", !rejected);
    if (rejected) {
      let rej = t("dc.rejectedIntro");
      if (rec.correction.chefNote) rej += " " + t("dc.rejectedReason", { note: rec.correction.chefNote });
      rej += " " + t("dc.rejectedFoot");
      el.dailyWorkCorrectionRejected.textContent = rej;
    }
  }
  if (el.dailyWorkCorrectionForm) {
    el.dailyWorkCorrectionForm.classList.toggle("hidden", pending);
  }

  if (el.dailyWorkCorrectionToggle) {
    el.dailyWorkCorrectionToggle.disabled = pending;
    el.dailyWorkCorrectionToggle.title = pending ? t("dc.togglePendingTitle") : "";
  }

  const inputs = [
    ["come", el.corrSuggestedCome],
    ["breakStart", el.corrSuggestedBreakStart],
    ["breakEnd", el.corrSuggestedBreakEnd],
    ["leave", el.corrSuggestedLeave]
  ];
  inputs.forEach(([key, inp]) => {
    if (!inp) return;
    const stampedVal = rec && coerceAttendanceTime(rec[key]);
    inp.disabled = !stampedVal || pending;
    inp.required = Boolean(stampedVal);
    inp.value = stampedVal ? stampedVal : "";
  });

  if (el.corrEmployeeNote) {
    el.corrEmployeeNote.value = "";
    el.corrEmployeeNote.disabled = pending;
    el.corrEmployeeNote.required = !pending;
  }
  if (el.dailyWorkCorrectionSubmit) el.dailyWorkCorrectionSubmit.disabled = pending;
  applyDailyCorrectionPanelVisualExpanded(dailyCorrectionPanelExpanded);
  syncDailyCorrectionToggleLabel(dailyCorrectionPanelExpanded, pending);
}

function suggestedAttendanceKey(field) {
  return field === "come"
    ? "suggestedCome"
    : field === "leave"
      ? "suggestedLeave"
      : field === "breakStart"
        ? "suggestedBreakStart"
        : "suggestedBreakEnd";
}

function submitEmployeeDailyAttendanceCorrection(event) {
  event.preventDefault();
  if (!currentSession || currentSession.role !== "employee" || !el.employeeWorkDate) return;
  const dateIso = el.employeeWorkDate.value || toIsoDate(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return;
  const rec = getDailyAttendanceRecord(currentSession.username, dateIso);
  if (!rec || !dailyAttendanceHasAnyStamp(rec)) return;
  if (rec.correction && rec.correction.status === "pending") {
    showToast(t("toast.corrWait"));
    return;
  }

  const inputs = {
    come: el.corrSuggestedCome,
    breakStart: el.corrSuggestedBreakStart,
    breakEnd: el.corrSuggestedBreakEnd,
    leave: el.corrSuggestedLeave
  };
  const labels = {
    come: t("wt.come"),
    breakStart: t("wt.pauseStart"),
    breakEnd: t("wt.pauseEnd"),
    leave: t("wt.leave")
  };
  const payload = { status: "pending", requestedAt: new Date().toISOString() };
  let anyChange = false;

  for (const key of ["come", "breakStart", "breakEnd", "leave"]) {
    if (!coerceAttendanceTime(rec[key])) continue;
    const inp = inputs[key];
    if (!inp) continue;
    const sug = coerceAttendanceTime(inp.value);
    if (!sug) {
      showToast(t("toast.corrTimeReq", { label: labels[key] }));
      return;
    }
    payload[suggestedAttendanceKey(key)] = sug;
    if (rec[key] !== sug) anyChange = true;
  }

  if (!anyChange) {
    showToast(t("toast.corrOneChange"));
    return;
  }

  const employeeNote = el.corrEmployeeNote ? el.corrEmployeeNote.value.trim().slice(0, 2000) : "";
  if (!employeeNote) {
    showToast(t("toast.corrCommentReq"));
    if (el.corrEmployeeNote) el.corrEmployeeNote.focus();
    return;
  }
  payload.employeeNote = employeeNote;

  rec.correction = payload;
  rec.updatedAt = new Date().toISOString();
  persistDailyAttendance();
  dailyCorrectionPanelExpanded = false;
  showToast(t("toast.corrSent"));
  hydrateEmployeeDailyCorrectionPanel();
  renderWorktimeSummary();
}

function correctionDiffLines(record) {
  const c = record.correction;
  if (!c) return [];
  const labels = {
    come: t("wt.come"),
    leave: t("wt.leave"),
    breakStart: t("wt.pauseStart"),
    breakEnd: t("wt.pauseEnd")
  };
  const keys = ["come", "breakStart", "breakEnd", "leave"];
  return keys.reduce((lines, key) => {
    if (!coerceAttendanceTime(record[key])) return lines;
    const sk = suggestedAttendanceKey(key);
    const sug = coerceAttendanceTime(c[sk]);
    if (!sug) return lines;
    lines.push(`${labels[key]}: ${record[key]} → ${sug}`);
    return lines;
  }, []);
}

function renderChefDailyAttendanceCorrections() {
  if (!el.chefDailyCorrectionsWrap || !el.chefDailyCorrectionsList || !currentSession || currentSession.username !== "chef") {
    if (el.chefDailyCorrectionsWrap) el.chefDailyCorrectionsWrap.classList.add("hidden");
    return;
  }
  const sourceDaily = !el.worktimeSource || el.worktimeSource.value === "daily";
  if (!sourceDaily) {
    el.chefDailyCorrectionsWrap.classList.add("hidden");
    return;
  }
  el.chefDailyCorrectionsWrap.classList.remove("hidden");

  const pending = dailyAttendanceRecords
    .filter((r) => r.correction && r.correction.status === "pending")
    .sort((a, b) => String(b.correction.requestedAt).localeCompare(String(a.correction.requestedAt)));

  if (!pending.length) {
    el.chefDailyCorrectionsList.innerHTML = `<p class="chef-daily-corrections-empty">${escapeHtml(t("wt.corrEmpty"))}</p>`;
    return;
  }

  el.chefDailyCorrectionsList.innerHTML = pending
    .map((r) => {
      const label = escapeHtml(getEmployeeLabelByUsername(r.employeeUsername));
      const dateDe = escapeHtml(formatIsoDateDeShort(r.date));
      const diffs = correctionDiffLines(r).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
      const note = r.correction.employeeNote
        ? `<p class="correction-note"><strong>${escapeHtml(t("corr.cmtLbl"))}</strong> ${escapeHtml(r.correction.employeeNote)}</p>`
        : "";
      return `
        <div class="daily-correction-card">
          <p class="daily-correction-card-title"><strong>${label}</strong> · ${dateDe}</p>
          <ul class="daily-correction-diff">${diffs}</ul>
          ${note}
          <div class="daily-correction-actions">
            <button type="button" class="primary-button" data-correction-action="approve" data-correction-user="${escapeHtml(r.employeeUsername)}" data-correction-date="${escapeHtml(r.date)}">${escapeHtml(t("corr.approve"))}</button>
            <input type="text" class="chef-reject-note-input" placeholder="${escapeHtml(t("corr.rejectPh"))}" aria-label="${escapeHtml(t("corr.rejectAria"))}" data-correction-date="${escapeHtml(r.date)}" data-correction-user="${escapeHtml(r.employeeUsername)}" />
            <button type="button" class="secondary-button" data-correction-action="reject" data-correction-user="${escapeHtml(r.employeeUsername)}" data-correction-date="${escapeHtml(r.date)}">${escapeHtml(t("corr.reject"))}</button>
          </div>
        </div>`;
    })
    .join("");
}

function handleChefDailyCorrectionClick(event) {
  if (!currentSession || currentSession.username !== "chef") return;
  const approveBtn = event.target.closest("[data-correction-action=\"approve\"]");
  const rejectBtn = event.target.closest("[data-correction-action=\"reject\"]");
  const actionEl = approveBtn || rejectBtn;
  if (!actionEl) return;
  const username = actionEl.getAttribute("data-correction-user");
  const dateIso = actionEl.getAttribute("data-correction-date");
  if (!username || !dateIso) return;
  const record = getDailyAttendanceRecord(username, dateIso);
  if (!record || !record.correction || record.correction.status !== "pending") return;

  if (approveBtn) {
    if (applyApprovedDailyAttendanceCorrection(record)) {
      showToast(t("toast.corrOk"));
    }
    renderWorktimeSummary();
    return;
  }

  const card = rejectBtn.closest(".daily-correction-card");
  const noteInput = card ? card.querySelector(".chef-reject-note-input") : null;
  const chefNote = noteInput ? noteInput.value : "";
  if (rejectDailyAttendanceCorrectionRecord(record, chefNote)) {
    showToast(t("toast.corrRejected"));
  }
  renderWorktimeSummary();
}

function stampDailyAttendance(type) {
  if (!currentSession || currentSession.role !== "employee" || !el.employeeWorkDate) return;
  const dateIso = el.employeeWorkDate.value || getLocalTodayIsoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return;
  if (!isEmployeeDailyWorkStampDay(dateIso)) {
    showToast(t("toast.wtStampTodayOnly"));
    return;
  }
  const rec = getDailyAttendanceRecord(currentSession.username, dateIso);
  if (rec && rec.correction && rec.correction.status === "pending") {
    showToast(t("toast.corrBlockStamp"));
    return;
  }
  const time = nowTime();
  if (type === "come") {
    if (rec && rec.come) return;
    upsertDailyAttendanceField(currentSession.username, dateIso, "come", time);
  } else if (type === "breakStart") {
    if (rec && rec.breakStart) return;
    upsertDailyAttendanceField(currentSession.username, dateIso, "breakStart", time);
  } else if (type === "breakEnd") {
    if (rec && rec.breakEnd) return;
    upsertDailyAttendanceField(currentSession.username, dateIso, "breakEnd", time);
  } else if (type === "leave") {
    if (rec && rec.leave) return;
    upsertDailyAttendanceField(currentSession.username, dateIso, "leave", time);
  }
  hydrateEmployeeDailyWorkForm();
}

function renderEmployeeDailyWorkPanel() {
  if (!el.employeeDayWorkPanel || activeSection !== "worktime") return;
  if (!currentSession || currentSession.role !== "employee") return;
  syncEmployeeWorkDateInputForEmployee();
  if (el.employeeWorkDate && !el.employeeWorkDate.value) {
    el.employeeWorkDate.value = getLocalTodayIsoDate();
  }
  hydrateEmployeeDailyWorkForm();
}

function renderWorktimeSummary() {
  if (!el.worktimeList || !currentSession || currentSession.role !== "boss") return;
  if (!isFullChefSession() && !isRestrictedBossSession()) return;

  syncChefWorktimePeriodInput();
  let period = getChefWorktimePeriodBounds();
  if (!period && el.worktimeDate) {
    el.worktimeDate.value = "";
    syncChefWorktimePeriodInput();
    period = getChefWorktimePeriodBounds();
  }
  if (!period) {
    if (el.worktimeList) el.worktimeList.innerHTML = "";
    if (el.chefDailyCorrectionsWrap) el.chefDailyCorrectionsWrap.classList.add("hidden");
    refreshCheckpointStaffUi();
    return;
  }
  const [periodStart, periodEnd] = period;

  renderChefDailyAttendanceCorrections();
  const sourceRaw = el.worktimeSource ? String(el.worktimeSource.value || "daily") : "daily";
  const source = sourceRaw === "checklist" || sourceRaw === "workOrder" ? sourceRaw : "daily";
  const employees = getEmployeeUsers().filter((employee) => {
    if (!isRestrictedBossSession()) return true;
    const m = getManagedEmployeeUsernamesForSession();
    return m && m.includes(employee.username);
  });

  if (el.worktimeSourceCaption) {
    el.worktimeSourceCaption.textContent = source === "daily"
      ? t("wt.captionDaily")
      : (source === "workOrder" ? t("wt.captionWo") : t("wt.captionCl"));
  }

  const workOrderRows = source === "workOrder" ? collectWorkOrderRowsForViewer() : [];

  const totals = employees.map((employee) => {
    if (source === "daily") {
      const total = dailyAttendanceRecords
        .filter((record) => {
          if (record.employeeUsername !== employee.username) return false;
          const day = new Date(`${record.date}T12:00:00`);
          return day >= periodStart && day < periodEnd;
        })
        .reduce((sum, record) => sum + getDailyAttendanceNetMinutes(record), 0);
      return { label: employee.label, total };
    }
    if (source === "workOrder") {
      const total = workOrderRows.reduce((sum, row) => {
        if (!row || !row.entry || row.entry.employeeUsername !== employee.username) return sum;
        const day = new Date(`${row.dateIso}T12:00:00`);
        if (day < periodStart || day >= periodEnd) return sum;
        return sum + getWorkOrderAttendanceNetMinutes(row.stateRow);
      }, 0);
      return { label: employee.label, total };
    }

    const total = submissions.reduce((sum, entry) => {
      const entryDate = new Date(entry.createdAt || entry.submittedAt || 0);
      const matchesEmployee = entry.employeeUsername
        ? entry.employeeUsername === employee.username
        : entry.employeeName === employee.label;
      if (!matchesEmployee || entryDate < periodStart || entryDate >= periodEnd) return sum;
      return sum + getChecklistAttendanceNetMinutes(entry);
    }, 0);
    return { label: employee.label, total };
  });

  el.worktimeList.innerHTML = totals.map((row) => `
    <div class="worktime-item">
      <p><strong>${escapeHtml(row.label)}</strong></p>
      <p>${escapeHtml(t("wt.totalLabel"))} ${formatMinutes(row.total)}</p>
    </div>
  `).join("");
  refreshCheckpointStaffUi();
}

function collectOpenCustomerDbItemIds() {
  if (!el.customerDbList) return new Set();
  const open = new Set();
  el.customerDbList.querySelectorAll("details.customer-db-item[data-customer-id][open]").forEach((node) => {
    const id = node.getAttribute("data-customer-id");
    if (id) open.add(id);
  });
  return open;
}

function wireCustomerDbMonthSelects(detailsRow) {
  if (!detailsRow) return;
  detailsRow.querySelectorAll(".customer-extra-month-select").forEach((sel) => {
    sel.addEventListener("mousedown", (ev) => ev.stopPropagation());
    sel.addEventListener("click", (ev) => ev.stopPropagation());
  });
}

function collectOpenCustomerDbSubsectionKeys() {
  if (!el.customerDbList) return new Set();
  const open = new Set();
  el.customerDbList.querySelectorAll("details.customer-db-subsection[open]").forEach((node) => {
    const cid = node.getAttribute("data-customer-id");
    const kind = node.getAttribute("data-subsection");
    if (cid && kind) open.add(`${cid}::${kind}`);
  });
  return open;
}

function customerDbSubsectionShouldBeOpen(openSubsections, customerId, kind) {
  return openSubsections.has(`${customerId}::${kind}`);
}

function sanitizeCustomerStatus(raw) {
  return raw === CUSTOMER_STATUS_INACTIVE ? CUSTOMER_STATUS_INACTIVE : CUSTOMER_STATUS_ACTIVE;
}

function isCustomerActive(entry) {
  return sanitizeCustomerStatus(entry && entry.status) === CUSTOMER_STATUS_ACTIVE;
}

function compareCustomersForDbList(a, b) {
  const aActive = isCustomerActive(a);
  const bActive = isCustomerActive(b);
  if (aActive !== bActive) return aActive ? -1 : 1;
  return customerStammFullName(a).localeCompare(customerStammFullName(b), "de", { sensitivity: "base" });
}

function getCustomerDbEntriesForDisplay() {
  return [...customerDb].sort(compareCustomersForDbList);
}

function renderCustomerDb(preserveOpenCustomerId) {
  if (!el.customerDbList) return;

  if (!customerDb.length) {
    el.customerDbList.innerHTML = `<div class="customer-db-item"><p>${escapeHtml(t("cust.empty"))}</p></div>`;
    return;
  }

  const openCustomerIds = collectOpenCustomerDbItemIds();
  const keepOpenId = String(preserveOpenCustomerId || "").trim();
  if (keepOpenId) openCustomerIds.add(keepOpenId);
  const openSubsections = collectOpenCustomerDbSubsectionKeys();
  el.customerDbList.innerHTML = "";
  const allWorkTimeRecords = collectAllCustomerWorkTimeRecords();
  getCustomerDbEntriesForDisplay().forEach((entry) => {
    const customerActive = isCustomerActive(entry);
    const mapsUrl = buildCustomerMapsUrl(entry);
    const customerFullName = `${entry.firstName} ${entry.lastName}`.trim();
    const history = submissions
      .filter((submission) => (
        submission.customerId
          ? submission.customerId === entry.id
          : submission.customerName.trim().toLowerCase() === customerFullName.toLowerCase()
      ))
      .filter((submission) => submission.status === "approved")
      .sort((a, b) => new Date(b.createdAt || b.submittedAt || 0) - new Date(a.createdAt || a.submittedAt || 0));
    const ledgerAll = Array.isArray(entry.extraCostLedger) ? [...entry.extraCostLedger] : [];
    const monthsForCust = collectLedgerMonthKeysForCustomer(entry);
    const monthsForWork = collectCustomerWorkTimeMonthKeys(entry.id, allWorkTimeRecords);
    const monthsCombined = [...new Set([...monthsForCust, ...monthsForWork])].sort().reverse();
    let monthFilter = customerDbExtraMonthByCustomerId[entry.id] || "";
    if (monthFilter && !monthsCombined.includes(monthFilter)) {
      delete customerDbExtraMonthByCustomerId[entry.id];
      monthFilter = "";
    }
    let workMonthFilter = customerDbWorkMonthByCustomerId[entry.id] || "";
    if (workMonthFilter && !monthsForWork.includes(workMonthFilter)) {
      delete customerDbWorkMonthByCustomerId[entry.id];
      workMonthFilter = "";
    }
    const workMonthSelectHtml = `
          <select class="customer-extra-month-select" data-work-month="${escapeHtml(entry.id)}" aria-label="${escapeHtml(t("cust.workMonthFilterAria"))}">
            <option value="">${escapeHtml(t("cust.extraMonthAll"))}</option>
            ${monthsForWork.map((m) => `
            <option value="${escapeHtml(m)}"${m === workMonthFilter ? " selected" : ""}>${escapeHtml(formatMonthKeyForFilterLabel(m))}</option>
            `).join("")}
          </select>`;
    const workRowsAll = allWorkTimeRecords.filter((r) => r.customerId === entry.id);
    const workRowsFiltered = workMonthFilter
      ? workRowsAll.filter((r) => r.monthKey === workMonthFilter)
      : [...workRowsAll].sort((a, b) => String(`${b.dateIso}-${b.source}`).localeCompare(String(`${a.dateIso}-${a.source}`)));
    const workChecklistSum = workRowsFiltered
      .filter((r) => r.source === "checklist")
      .reduce((s, r) => s + r.minutes, 0);
    const workOrderSum = workRowsFiltered
      .filter((r) => r.source === "workorder")
      .reduce((s, r) => s + r.minutes, 0);
    const workTotalSum = workChecklistSum + workOrderSum;
    const showWorkMonthCol = !workMonthFilter;
    const workTableRows = workRowsFiltered
      .map((r) => `
        <tr>
          ${showWorkMonthCol ? `<td>${escapeHtml(formatMonthKeyForFilterLabel(r.monthKey))}</td>` : ""}
          <td>${escapeHtml(formatDateDayOnly(r.dateIso))}</td>
          <td>${escapeHtml(r.source === "workorder" ? t("cust.workSourceWorkOrder") : t("cust.workSourceChecklist"))}</td>
          <td>${escapeHtml(r.employeeLabel)}</td>
          <td>${escapeHtml(r.detail)}</td>
          <td class="customer-work-time-duration">${escapeHtml(formatMinutes(r.minutes))}</td>
        </tr>
      `)
      .join("");
    const workSubOpen = customerDbSubsectionShouldBeOpen(openSubsections, entry.id, "work");
    const workTimeSection = `
        <details class="customer-db-subsection customer-work-time customer-extra-costs" data-customer-id="${escapeHtml(entry.id)}" data-subsection="work"${workSubOpen ? " open" : ""}>
          <summary class="customer-db-subsection-summary">
            <div class="customer-extra-costs-head customer-db-subsection-head">
              <strong>${escapeHtml(t("cust.workTimeTitle"))}</strong>
              ${workMonthSelectHtml}
            </div>
          </summary>
          <div class="customer-db-subsection-body">
          ${workRowsFiltered.length
            ? `
            <table class="customer-extra-ledger-table customer-work-time-table">
              <thead>
                <tr>
                  ${showWorkMonthCol ? `<th>${escapeHtml(t("cust.extraColMonth"))}</th>` : ""}
                  <th>${escapeHtml(t("cust.workColDate"))}</th>
                  <th>${escapeHtml(t("cust.workColSource"))}</th>
                  <th>${escapeHtml(t("cust.workColEmployee"))}</th>
                  <th>${escapeHtml(t("cust.workColDetail"))}</th>
                  <th>${escapeHtml(t("cust.workColNet"))}</th>
                </tr>
              </thead>
              <tbody>${workTableRows}</tbody>
            </table>
            <p class="customer-extra-ledger-sum customer-work-time-sum">
              <strong>${escapeHtml(t("cust.workSumTotal"))}</strong> ${escapeHtml(formatMinutes(workTotalSum))}
              <span class="customer-work-time-sum-detail">(${escapeHtml(t("cust.workSumChecklist"))} ${escapeHtml(formatMinutes(workChecklistSum))} · ${escapeHtml(t("cust.workSumWorkOrder"))} ${escapeHtml(formatMinutes(workOrderSum))})</span>
            </p>`
            : `<small>${escapeHtml(t("cust.workTimeEmpty"))}</small>`
          }
          </div>
        </details>`;
    const monthFilterSelectHtml = `
          <select class="customer-extra-month-select" data-extra-month="${escapeHtml(entry.id)}" aria-label="${escapeHtml(t("cust.extraMonthFilterAria"))}">
            <option value="">${escapeHtml(t("cust.extraMonthAll"))}</option>
            ${monthsForCust.map((m) => `
            <option value="${escapeHtml(m)}"${m === monthFilter ? " selected" : ""}>${escapeHtml(formatMonthKeyForFilterLabel(m))}</option>
            `).join("")}
          </select>`;
    const ledgerFiltered = monthFilter
      ? ledgerAll.filter((r) => r && r.monthKey === monthFilter)
      : [...ledgerAll].sort((a, b) =>
          String(`${b.monthKey || ""}-${b.recordedAt || ""}`).localeCompare(String(`${a.monthKey || ""}-${a.recordedAt || ""}`))
        );
    const ledgerSum = ledgerFiltered.reduce((s, r) => s + (Number(r.amountEuro) || 0), 0);
    const showMonthCol = !monthFilter;
    const ledgerRows = ledgerFiltered
      .map((r) => `
        <tr>
          ${showMonthCol ? `<td>${escapeHtml(formatMonthKeyForFilterLabel(r.monthKey || ""))}</td>` : ""}
          <td>${escapeHtml(formatDate(r.recordedAt))}</td>
          <td class="customer-extra-ledger-amount">${escapeHtml(formatEuroCustomerAmount(r.amountEuro))}</td>
          <td>${escapeHtml(r.checklistLabel || "—")}</td>
          <td>${escapeHtml((r.comment || "").slice(0, 120))}</td>
        </tr>
      `)
      .join("");
    const extraSubOpen = customerDbSubsectionShouldBeOpen(openSubsections, entry.id, "extra");
    const ledgerSection = `
        <details class="customer-db-subsection customer-extra-costs" data-customer-id="${escapeHtml(entry.id)}" data-subsection="extra"${extraSubOpen ? " open" : ""}>
          <summary class="customer-db-subsection-summary">
            <div class="customer-extra-costs-head customer-db-subsection-head">
              <strong>${escapeHtml(t("cust.extraLedgerTitle"))}</strong>
              ${monthFilterSelectHtml}
            </div>
          </summary>
          <div class="customer-db-subsection-body">
          ${ledgerFiltered.length
            ? `
            <table class="customer-extra-ledger-table">
              <thead>
                <tr>
                  ${showMonthCol ? `<th>${escapeHtml(t("cust.extraColMonth"))}</th>` : ""}
                  <th>${escapeHtml(t("cust.extraColRecorded"))}</th>
                  <th>${escapeHtml(t("cust.extraColAmount"))}</th>
                  <th>${escapeHtml(t("cust.extraColChecklist"))}</th>
                  <th>${escapeHtml(t("cust.extraColNote"))}</th>
                </tr>
              </thead>
              <tbody>${ledgerRows}</tbody>
            </table>
            <p class="customer-extra-ledger-sum"><strong>${escapeHtml(t("cust.extraSum"))}</strong> ${escapeHtml(formatEuroCustomerAmount(ledgerSum))}</p>`
            : `<small>${escapeHtml(t("cust.extraLedgerEmpty"))}</small>`
          }
          </div>
        </details>`;
    const row = document.createElement("details");
    row.className = `customer-db-item${customerActive ? "" : " customer-db-item--inactive"}`;
    row.setAttribute("data-customer-id", entry.id);
    if (openCustomerIds.has(entry.id)) row.setAttribute("open", "");
    migrateCustomerCheckpointSetsIfNeeded(entry);
    const checkpointBlocksHtml = checklistTemplates.map((template) => {
      const pts = getCustomerCheckpointsForTemplate(entry, template.id);
      let bodyContent = "";
      if (!pts.length) {
        bodyContent = `<small>${escapeHtml(t("cust.noCpChosen"))}</small>`;
      } else if (template.id === HAUS_CHECKLIST_TEMPLATE_ID) {
        const wanted = new Set(pts);
        const blocks = HAUS_CHECKPOINT_ZONE_IDS.map((zoneId) => {
          const labels = (template.checkpoints || [])
            .filter((def) => hausCheckpointZoneFromDef(def) === zoneId && hausStoredKeySetHasDef(wanted, def))
            .map((def) => checkpointDefLabelDeSlashEn(def));
          if (!labels.length) return "";
          return `
            <div class="customer-cp-zone-block">
              <strong>${escapeHtml(hausZoneGroupTitle(zoneId))}</strong>
              <ul>${labels.map((lb) => `<li>${escapeHtml(lb)}</li>`).join("")}</ul>
            </div>`;
        }).join("");
        bodyContent = blocks || `<ul>${pts.map((point) => `<li>${escapeHtml(checkpointDefLabelDeSlashEn(resolveLocalesFromTemplateCanon(template.id, point)))}</li>`).join("")}</ul>`;
      } else {
        bodyContent = `<ul>${pts.map((point) => `<li>${escapeHtml(checkpointDefLabelDeSlashEn(resolveLocalesFromTemplateCanon(template.id, point)))}</li>`).join("")}</ul>`;
      }
      return `
        <div class="customer-checkpoints-by-template">
          <strong>${escapeHtml(template.name)}</strong>
          ${bodyContent}
        </div>`;
    }).join("");
    row.innerHTML = `
      <summary class="customer-db-summary">
        <div class="customer-db-summary-main">
          <p><strong>${escapeHtml(entry.firstName)} ${escapeHtml(entry.lastName)}</strong>${customerActive ? "" : ` <span class="customer-status-badge">${escapeHtml(t("cust.statusInactive"))}</span>`}</p>
          <small>${escapeHtml(entry.address || "-")}</small>
          <small>${escapeHtml(entry.email || "-")} · ${escapeHtml(entry.phone || "-")}</small>
        </div>
        <span class="customer-db-summary-toggle" aria-hidden="true">
          <span class="customer-db-summary-toggle-label">Ausklappen</span>
          <span class="customer-db-summary-toggle-icon">▸</span>
        </span>
      </summary>
      <div class="customer-db-body">
        <small class="customer-db-summary-meta">${escapeHtml(t("boss.projectCap"))}: ${escapeHtml(entry.project || "-")}</small>
        ${entry.coordinates ? `<small class="customer-db-summary-meta">${escapeHtml(t("cust.coordsPrefix"))} ${escapeHtml(entry.coordinates)}</small>` : ""}
        <div class="customer-history">
          ${history.length
            ? `
              <div class="customer-history-compact-row">
                <span class="customer-history-title">${escapeHtml(t("cust.historyTitle"))}</span>
                <select class="customer-history-select" data-history-select="${entry.id}" aria-label="${escapeHtml(t("cust.historyTitle"))}">
                  ${history.map((item) => {
                    const dt = formatDate(item.submittedAt || item.createdAt);
                    const jtRaw = String(item.jobTitle || "").trim();
                    const jtShort = jtRaw.length > 36 ? `${jtRaw.slice(0, 34)}…` : jtRaw;
                    return `<option value="${item.id}">${escapeHtml(dt)} · ${escapeHtml(jtShort || "—")}</option>`;
                  }).join("")}
                </select>
                <button class="customer-history-open-btn" type="button" data-open-history="${entry.id}">${escapeHtml(t("cust.open"))}</button>
              </div>
            `
            : `
              <div class="customer-history-compact-row customer-history-empty">
                <span class="customer-history-title">${escapeHtml(t("cust.historyTitle"))}</span>
                <small>${escapeHtml(t("cust.historyEmpty"))}</small>
              </div>
            `}
        </div>
        ${ledgerSection}
        ${workTimeSection}
        <div class="customer-db-actions">
          ${mapsUrl ? `<a class="text-button" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("cust.maps"))}</a>` : ""}
          <button class="text-button" type="button" data-toggle-checkpoints="${entry.id}">${escapeHtml(t("cust.checkpoints"))}</button>
          ${sanitizeStoredCustomerContractPdf(entry.contractPdf)
    ? `<button class="text-button" type="button" data-download-contract="${entry.id}">${escapeHtml(t("cust.contractDownload"))}</button>`
    : ""}
          <button class="text-button" type="button" data-edit-id="${entry.id}">${escapeHtml(t("cust.edit"))}</button>
          <button class="text-button" type="button" data-toggle-status="${entry.id}">${escapeHtml(customerActive ? t("cust.deactivate") : t("cust.reactivate"))}</button>
          <button class="text-button" type="button" data-id="${entry.id}">${escapeHtml(t("cust.delete"))}</button>
        </div>
        <div class="customer-checkpoints-list hidden" data-checkpoint-list="${entry.id}">
          ${checkpointBlocksHtml || `<small>${escapeHtml(t("cust.noCpMaintained"))}</small>`}
        </div>
      </div>
    `;
    const deleteCustomerButton = row.querySelector('[data-id]');
    if (deleteCustomerButton) deleteCustomerButton.addEventListener("click", () => deleteCustomerEntry(entry.id));
    const downloadContractButton = row.querySelector('[data-download-contract]');
    if (downloadContractButton) {
      downloadContractButton.addEventListener("click", () => downloadCustomerContractPdf(entry));
    }
    const editCustomerButton = row.querySelector('[data-edit-id]');
    if (editCustomerButton) editCustomerButton.addEventListener("click", () => startEditCustomerEntry(entry.id));
    const toggleStatusButton = row.querySelector('[data-toggle-status]');
    if (toggleStatusButton) toggleStatusButton.addEventListener("click", () => toggleCustomerEntryStatus(entry.id));
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
      event.currentTarget.textContent = listEl.classList.contains("hidden")
        ? t("cust.checkpoints")
        : t("cust.checkpointsHide");
    });
    wireCustomerDbMonthSelects(row);
    row.querySelectorAll(".customer-history-select").forEach((sel) => {
      sel.addEventListener("mousedown", (ev) => ev.stopPropagation());
      sel.addEventListener("click", (ev) => ev.stopPropagation());
    });
    el.customerDbList.appendChild(row);
  });
}

/** Vollständiger Anzeigename aus dem Stammsatz („Vorname Nachname“). */
function customerStammFullName(parts) {
  const o = parts && typeof parts === "object" ? parts : {};
  return `${String(o.firstName || "").trim()} ${String(o.lastName || "").trim()}`.trim();
}

/**
 * Überall dort, wo diese Kunden-Id gespeichert ist, den angezeigten Namen aktualisieren
 * (Checklisten, gesperrte MA-Namen wenn sie dem alten Stammdatum entsprechen,
 * Kalender-Einsätze, Serienregeln). Einträge ohne customerId aber mit gleichem bisherigen
 * Klarnamen werden angebunden und umbenannt.
 */
function syncCustomerDisplayNameAcrossApp(customerId, previousFullName, nextFullName) {
  const cid = String(customerId || "").trim();
  const next = String(nextFullName || "").trim();
  if (!cid || !next) return false;

  const prevLc = String(previousFullName || "").trim().toLowerCase();
  let touched = false;

  submissions.forEach((s) => {
    const sid = String(s.customerId || "").trim();
    const nm = String(s.customerName || "").trim();
    const nmLc = nm.toLowerCase();
    let match = sid === cid;
    if (!match && !sid && prevLc && nmLc === prevLc) {
      s.customerId = cid;
      match = true;
    }
    if (!match) return;

    touched = true;
    s.customerName = next;

    const lock = String(s.lockedCustomerName || "").trim();
    if (
      lock
      && (lock.toLowerCase() === prevLc || lock.toLowerCase() === nmLc)
    ) {
      s.lockedCustomerName = next;
    }
  });

  Object.keys(staffSchedule).forEach((dateKey) => {
    const day = staffSchedule[dateKey];
    if (!Array.isArray(day)) return;
    day.forEach((assignment) => {
      if (isRecurringOccurrenceSkipEntry(assignment)) return;
      if (String(assignment.customerId || "").trim() !== cid) return;
      assignment.customerName = next;
      touched = true;
    });
  });

  recurringScheduleRules.forEach((rule) => {
    if (String(rule.customerId || "").trim() !== cid) return;
    rule.customerName = next;
    touched = true;
  });

  if (touched) {
    void persist().catch((err) => console.error(err));
    persistSchedule();
    persistRecurringScheduleRules();
  }
  return touched;
}

function addCustomerEntry(firstName, lastName, address, coordinates, project, email, phone, orientationPhoto, contractPdf) {
  const sets = collectCheckpointSetsForCustomerSave();
  const record = {
    id: createId(),
    firstName,
    lastName,
    address,
    coordinates,
    project,
    email,
    phone,
    orientationPhoto: sanitizeStoredChecklistPhoto(orientationPhoto),
    contractPdf: sanitizeStoredCustomerContractPdf(contractPdf),
    status: CUSTOMER_STATUS_ACTIVE,
    checkpointSets: sets,
    checkpoints: [...(sets[HAUS_CHECKLIST_TEMPLATE_ID] || [])]
  };
  migrateCustomerCheckpointSetsIfNeeded(record);
  customerDb.unshift(record);
  persistCustomerDb();
  renderCustomerDb();
  renderCalendarCustomerOptions();
}

function updateCustomerEntry(id, firstName, lastName, address, coordinates, project, email, phone, orientationPhoto, contractPdf) {
  const index = customerDb.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const prev = customerDb[index];
  const previousFullName = customerStammFullName(prev);
  const sets = collectCheckpointSetsForCustomerSave();
  customerDb[index] = Object.assign({}, prev, {
    firstName,
    lastName,
    address,
    coordinates,
    project,
    email,
    phone,
    orientationPhoto: sanitizeStoredChecklistPhoto(orientationPhoto),
    contractPdf: sanitizeStoredCustomerContractPdf(contractPdf),
    checkpointSets: sets,
    checkpoints: [...(sets[HAUS_CHECKLIST_TEMPLATE_ID] || [])]
  });
  persistCustomerDb();
  checklistTemplates.forEach((template) => {
    syncDraftSubmissionsForCustomer(id, template.id, sets[template.id] || []);
  });
  const newFullName = customerStammFullName({ firstName, lastName });
  syncCustomerDisplayNameAcrossApp(id, previousFullName, newFullName);
  renderCustomerDb();
  renderCalendarCustomerOptions();
  render();
}

function startEditCustomerEntry(id) {
  const entry = customerDb.find((item) => item.id === id);
  if (!entry) return;
  activeCustomerDbId = id;
  el.dbFirstName.value = entry.firstName || "";
  el.dbLastName.value = entry.lastName || "";
  el.dbAddress.value = entry.address || "";
  el.dbCoordinates.value = entry.coordinates || "";
  el.dbProject.value = entry.project || "";
  el.dbEmail.value = entry.email || "";
  el.dbPhone.value = entry.phone || "";
  pendingCustomerOrientationPhoto = sanitizeStoredChecklistPhoto(entry.orientationPhoto);
  pendingCustomerContractPdf = sanitizeStoredCustomerContractPdf(entry.contractPdf);
  if (el.dbOrientationPhoto) el.dbOrientationPhoto.value = "";
  if (el.dbContractPdf) el.dbContractPdf.value = "";
  renderCustomerOrientationPreviewInDb();
  renderCustomerContractStatusInDb();
  populateCustomerCheckpointTemplateSelect();
  initPendingCustomerCheckpointSetsFromEntry(entry);
  renderCustomerCheckpointOptions(pendingCustomerCheckpointSets[el.customerCheckpointTemplateSelect.value] || []);
  showToast(t("toast.custLoaded"));
}

function toggleCustomerEntryStatus(id) {
  const index = customerDb.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const prev = customerDb[index];
  const nextStatus = isCustomerActive(prev) ? CUSTOMER_STATUS_INACTIVE : CUSTOMER_STATUS_ACTIVE;
  customerDb[index] = Object.assign({}, prev, { status: nextStatus });
  persistCustomerDb();
  renderCustomerDb(id);
  showToast(nextStatus === CUSTOMER_STATUS_ACTIVE ? t("toast.custStatusActive") : t("toast.custStatusInactive"));
}

function deleteCustomerEntry(id) {
  delete customerDbExtraMonthByCustomerId[id];
  delete customerDbWorkMonthByCustomerId[id];
  customerDb = customerDb.filter((entry) => entry.id !== id);
  persistCustomerDb();
  renderCustomerDb();
  renderCalendarCustomerOptions();
  renderChecklistCustomerOrientationPhoto();
}

function parseCoordinateValue(rawValue) {
  const normalized = String(rawValue || "").trim().replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseCoordinates(input) {
  const value = String(input || "").trim();
  if (!value) return null;

  const commaOrSemicolonPattern = /^(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)$/;
  const spaceSeparatedPattern = /^(-?\d+(?:[.,]\d+)?)\s+(-?\d+(?:[.,]\d+)?)$/;
  const match = value.match(commaOrSemicolonPattern) || value.match(spaceSeparatedPattern);
  if (!match) return null;

  const latitude = parseCoordinateValue(match[1]);
  const longitude = parseCoordinateValue(match[2]);
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function normalizeCoordinatesInput(value) {
  const normalizedLocation = normalizeLocationInput(value);
  const parsedCoordinates = parseCoordinates(normalizedLocation);
  if (!parsedCoordinates) return "";
  return `${parsedCoordinates.latitude},${parsedCoordinates.longitude}`;
}

function extractMapsQueryFromUrl(urlLikeValue) {
  const value = String(urlLikeValue || "").trim();
  if (!value) return "";

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch (error) {
    return "";
  }

  if (!parsedUrl.hostname.includes("google.") || !parsedUrl.pathname.includes("/maps")) {
    return "";
  }

  const query = parsedUrl.searchParams.get("query") || parsedUrl.searchParams.get("q");
  if (query && query.trim()) {
    return query.trim();
  }

  const atMatch = parsedUrl.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return `${atMatch[1]},${atMatch[2]}`;
  }

  return "";
}

function normalizeLocationInput(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const mappedQuery = extractMapsQueryFromUrl(trimmed);
  return mappedQuery || trimmed;
}

function buildGoogleMapsUrl(locationQuery) {
  const normalizedLocation = normalizeLocationInput(locationQuery);
  const parsedCoordinates = parseCoordinates(normalizedLocation);
  const query = parsedCoordinates
    ? `${parsedCoordinates.latitude},${parsedCoordinates.longitude}`
    : normalizedLocation;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildCustomerMapsUrl(customer) {
  const normalizedCoordinates = normalizeCoordinatesInput(customer && customer.coordinates);
  const mapTarget = normalizedCoordinates || normalizeLocationInput(customer && customer.address);
  return mapTarget ? buildGoogleMapsUrl(mapTarget) : "";
}

function submissionForAssignmentAndTemplate(assignmentRowId, templateId) {
  const tid = String(templateId || HAUS_CHECKLIST_TEMPLATE_ID);
  return submissions.find(
    (sub) =>
      sub.assignmentId === assignmentRowId
      && String(sub.checklistTemplateId || HAUS_CHECKLIST_TEMPLATE_ID) === tid
  );
}

function buildWorkOrderCalendarButtonHtml(entry, canOpenWorkOrder, dateIso) {
  const d = String(dateIso || selectedCalendarDate || "").trim();
  if (!d) return "";
  const st = findWorkOrderState(entry.id, d);
  const status = (st && st.status) || "submitted";
  let label = t("wo.calBtnOpen");
  if (status === "in_progress") label = t("wo.calBtnResume");
  if (status === "done") label = t("wo.calBtnClosed");
  const disabled = !canOpenWorkOrder || status === "done" || !canEmployeeStartCalendarAssignmentOnDate(d);
  const btnClass = disabled ? "secondary-button" : "primary-button";
  return `<div class="calendar-checklist-actions"><button type="button" class="${btnClass} calendar-work-order-btn" data-action="work-order-open" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button></div>`;
}

function buildEmployeeCalendarChecklistButtonsHtml(entry, canOpenChecklist, assignmentDateIso) {
  const ids = normalizeAssignmentTemplateIds(entry);
  const viewer = currentSession ? currentSession.username : "";
  const parts = [];
  ids.forEach((tid) => {
    const tmpl = getChecklistTemplateById(tid);
    if (currentRole === "employee" && viewer && tmpl && !templateAllowsEmployee(tmpl, viewer)) return;
    const sub = submissionForAssignmentAndTemplate(entry.id, tid);
    const approved = sub && sub.status === "approved";
    const pendingSubmit = sub && sub.status === "submitted";
    const draft = sub && sub.status === "draft";
    let label;
    if (approved) label = t("cal.btnTplDone", { name: tmpl ? tmpl.name : tid });
    else if (pendingSubmit) label = t("cal.btnTplPending", { name: tmpl ? tmpl.name : tid });
    else if (draft) label = t("cal.btnTplContinue", { name: tmpl ? tmpl.name : tid });
    else label = t("cal.btnTplStart", { name: tmpl ? tmpl.name : tid });
    const disabled = !canOpenChecklist || approved || pendingSubmit
      || !canEmployeeStartCalendarAssignmentOnDate(assignmentDateIso);
    const btnClass = disabled ? "secondary-button" : "primary-button";
    parts.push(
      `<button type="button" class="${btnClass} calendar-checklist-tpl-btn" data-action="checklist-tpl" data-template-id="${escapeHtml(String(tid))}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`
    );
  });
  if (!parts.length) return "";
  return `<div class="calendar-checklist-actions">${parts.join("")}</div>`;
}

function createChecklistFromAssignment(entry, templateIdExplicit) {
  if (isWorkOrderAssignment(entry)) {
    showToast(t("wo.useWorkOrderTab"));
    return;
  }
  if (!canEmployeeStartCalendarAssignmentOnDate(selectedCalendarDate)) {
    showToast(t("toast.calStartTodayOnly"));
    return;
  }
  const dayEntries = staffSchedule[selectedCalendarDate] || [];
  let target = dayEntries.find((item) => item.id === entry.id);
  if (!target && entry.recurrenceRuleId) {
    const materializedEntry = Object.assign({}, entry);
    delete materializedEntry.recurrenceType;
    const nextEntries = [...dayEntries, materializedEntry];
    staffSchedule[selectedCalendarDate] = nextEntries;
    persistSchedule();
    target = materializedEntry;
  }
  if (!target) {
    showToast(t("toast.assignMissing"));
    return;
  }

  const allowedTplIds = normalizeAssignmentTemplateIds(target);
  let templateIdFromAssignment = templateIdExplicit
    ? String(templateIdExplicit)
    : (allowedTplIds.length === 1 ? allowedTplIds[0] : "");
  if (!templateIdFromAssignment) {
    showToast(t("toast.pickChecklistTplAction"));
    return;
  }
  if (!allowedTplIds.includes(templateIdFromAssignment)) {
    showToast(t("toast.tplDenied"));
    return;
  }
  if (!sessionMayAccessChecklistTemplate(templateIdFromAssignment)) {
    showToast(t("toast.tplDenied"));
    return;
  }

  const existingSubmission = submissionForAssignmentAndTemplate(target.id, templateIdFromAssignment);
  if (existingSubmission && existingSubmission.status === "approved") {
    showToast(t("toast.chkLocked"));
    return;
  }
  if (existingSubmission && (existingSubmission.status === "draft" || existingSubmission.status === "submitted")) {
    setActiveSection("checklist");
    editChecklist(existingSubmission.id);
    showToast(t("toast.chkOpened"));
    return;
  }

  const assignmentTemplate = getChecklistTemplateById(templateIdFromAssignment);
  const viewer = currentSession && currentSession.username;
  const checklistOwnerUsername = target.checklistOwnerUsername || target.employeeUsername;
  if (currentRole === "employee" && viewer && checklistOwnerUsername && viewer !== checklistOwnerUsername) {
    showToast(t("toast.chkOnlyOwner"));
    return;
  }
  if (currentRole === "employee" && viewer && assignmentTemplate && !templateAllowsEmployee(assignmentTemplate, viewer)) {
    showToast(t("toast.tplDenied"));
    return;
  }

  resetForm();
  activeAssignmentId = target.id;
  activeCustomerId = target.customerId || "";
  employeeChecklistUnlocked = true;
  activeFormChecklistTemplateId = templateIdFromAssignment;
  populateChecklistFormTemplateSelect(false);
  toggleChecklistTemplateRowVisibility(currentRole !== "employee");
  setActiveSection("checklist");
  el.customerName.value = target.customerName || "";
  renderChecklistCustomerOrientationPhoto();
  const customer = customerDb.find((item) => item.id === (target.customerId || activeCustomerId));
  if (!customer) {
    showToast(t("toast.custMissing"));
    employeeChecklistUnlocked = false;
    activeAssignmentId = "";
    activeCustomerId = "";
    lockedCustomerName = "";
    resetForm();
    renderSectionVisibility();
    return;
  }
  migrateCustomerCheckpointSetsIfNeeded(customer);
  let customerSpecificItems = getCustomerCheckpointsForTemplate(customer, templateIdFromAssignment);
  if (templateIdFromAssignment === HAUS_CHECKLIST_TEMPLATE_ID) {
    customerSpecificItems = filterCustomerHausCheckpointsByZones(
      customer,
      effectiveHausGartenZonesForEntry(target)
    );
  }
  if (!customerSpecificItems.length) {
    showToast(t("toast.cpMissingTpl", {
      name: assignmentTemplate ? assignmentTemplate.name : t("sub.tplFallback")
    }));
    employeeChecklistUnlocked = false;
    activeAssignmentId = "";
    activeCustomerId = "";
    lockedCustomerName = "";
    resetForm();
    renderSectionVisibility();
    return;
  }
  el.checklistItems.innerHTML = "";
  const calTmpl = getChecklistTemplateById(templateIdFromAssignment);
  if (templateIdFromAssignment === HAUS_CHECKLIST_TEMPLATE_ID && calTmpl) {
    appendHausGroupedChecklistItemRows(el.checklistItems, calTmpl, new Set(customerSpecificItems));
  } else {
    customerSpecificItems.forEach((canon) => {
      const locs = resolveLocalesFromTemplateCanon(templateIdFromAssignment, canon);
      addChecklistItem(locs, false, "", null, canon);
    });
  }
  checkpointFormMarkUiLangBaseline();
  if (target.project) {
    el.jobTitle.value = target.project;
  }
  lockedCustomerName = target.customerName || "";
  el.customerName.readOnly = true;
  if (el.customerEmail) {
    const mail = customer.email ? String(customer.email).trim() : "";
    el.customerEmail.value = mail;
    el.customerEmail.readOnly = Boolean(mail);
  }
  el.checklistForm.classList.remove("hidden");
  el.employeeChecklistLockedHint.classList.add("hidden");
  el.employeeView.classList.add("active");
  renderSectionVisibility();
  showToast(t("toast.chkCreated"));
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
  el.calendarMonthLabel.textContent = new Intl.DateTimeFormat(intlLocaleSafe(), { month: "long", year: "numeric" }).format(calendarMonth);
  const weekdays = [];
  const anchorMonday = new Date(2021, 0, 4);
  anchorMonday.setHours(12, 0, 0, 0);
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(anchorMonday.getFullYear(), anchorMonday.getMonth(), anchorMonday.getDate() + i);
    weekdays.push(new Intl.DateTimeFormat(intlLocaleSafe(), { weekday: "short" }).format(day));
  }
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
    const entriesForDayRaw = getScheduleEntriesForDate(iso);
    const entriesForDay = currentRole === "boss"
      ? filterScheduleEntriesForBossViewer(entriesForDayRaw)
      : entriesForDayRaw;
    const loadReport = getDayLoadReport(entriesForDay.length);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `calendar-cell ${iso === selectedCalendarDate ? "active" : ""}`;
    const dayLabel = document.createElement("span");
    dayLabel.textContent = String(day);
    button.appendChild(dayLabel);
    if (loadReport.points > 0) {
      const indicator = document.createElement("span");
      indicator.className = `calendar-load-indicator ${loadReport.tone}`;
      indicator.textContent = loadReport.label;
      indicator.title = loadReport.tone === "full"
        ? t("cal.loadTooltipFull", { n: String(entriesForDay.length) })
        : t("cal.loadTooltipPts", { pts: String(loadReport.points), n: String(entriesForDay.length) });
      button.appendChild(indicator);
    }
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
  const labelDate = new Intl.DateTimeFormat(intlLocaleSafe(), { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(selectedCalendarDate));
  el.calendarSelectedLabel.textContent = t("cal.assignments", { date: labelDate });
  const rawForDate = getScheduleEntriesForDate(selectedCalendarDate);
  const entriesForDate = currentRole === "boss"
    ? filterScheduleEntriesForBossViewer(rawForDate)
    : rawForDate;
  const entries = currentRole === "employee"
    ? entriesForDate.filter((entry) => (
      entry.employeeUsername
        ? entry.employeeUsername === (currentSession ? currentSession.username : "")
        : entry.name === (currentSession ? currentSession.label : "")
    ))
    : entriesForDate;
  const selectedEmployeeFilter = el.calendarEmployeeFilter ? el.calendarEmployeeFilter.value : "";
  const filteredEntries = selectedEmployeeFilter
    ? entries.filter((entry) => (entry.employeeUsername || "") === selectedEmployeeFilter)
    : entries;
  const checklistScopedEntries = currentRole === "employee" && currentSession
    ? filteredEntries.filter((entry) => {
      if (isWorkOrderAssignment(entry)) {
        return (entry.employeeUsername || "") === currentSession.username;
      }
      return normalizeAssignmentTemplateIds(entry).some((tid) => {
        const tmpl = getChecklistTemplateById(tid);
        return tmpl ? templateAllowsEmployee(tmpl, currentSession.username) : true;
      });
    })
    : filteredEntries;
  const isBoss = currentRole === "boss";
  const sortMode = el.calendarSort.value;
  const sortedEntries = [...checklistScopedEntries].sort((a, b) => {
    if (sortMode === "employee-asc") {
      return (a.name || "").localeCompare(b.name || "", intlLangSafe(), { sensitivity: "base" });
    }
    const aStart = parseTimeToMinutes(a.fromTime) != null ? parseTimeToMinutes(a.fromTime) : 0;
    const bStart = parseTimeToMinutes(b.fromTime) != null ? parseTimeToMinutes(b.fromTime) : 0;
    if (sortMode === "time-desc") return bStart - aStart;
    return aStart - bStart;
  });
  if (!checklistScopedEntries.length) {
    el.calendarStaffList.innerHTML = `<div class="staff-item"><span>${escapeHtml(t("cal.noStaffPlan"))}</span></div>`;
    if (calendarPlanningOpen && el.calendarStaffForm && !el.calendarStaffForm.classList.contains("hidden")) {
      updateCalendarAssignmentTypeUi();
    }
    return;
  }

  el.calendarStaffList.innerHTML = "";
  sortedEntries.forEach((entry) => {
    const customerLine = entry.customerName ? `${entry.customerName} · ${entry.project || "-"}` : t("cal.customerMissing");
    const mapTarget = normalizeCoordinatesInput(entry.customerCoordinates) || normalizeLocationInput(entry.customerAddress);
    const mapsButton = mapTarget
      ? `<a class="text-button" href="${buildGoogleMapsUrl(mapTarget)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("cal.mapsOpen"))}</a>`
      : "";
    const checklistOwnerUsername = entry.checklistOwnerUsername || entry.employeeUsername || "";
    const checklistOwnerLabel = getEmployeeLabelByUsername(checklistOwnerUsername);
    const viewerUsername = currentSession ? currentSession.username : "";
    const canOpenChecklist = !checklistOwnerUsername || viewerUsername === checklistOwnerUsername;
    const assignedTplIds = normalizeAssignmentTemplateIds(entry).filter((tid) => sessionMayAccessChecklistTemplate(tid));
    const checklistNamesCsv = isWorkOrderAssignment(entry)
      ? t("wo.calRowType")
      : assignedTplIds
        .map((tid) => (getChecklistTemplateById(tid) || {}).name || tid)
        .join(", ");
    const checklistEmployeeActions = !isBoss
      ? (isWorkOrderAssignment(entry)
        ? buildWorkOrderCalendarButtonHtml(entry, canOpenChecklist, selectedCalendarDate)
        : buildEmployeeCalendarChecklistButtonsHtml(entry, canOpenChecklist, selectedCalendarDate))
      : "";
    const row = document.createElement("div");
    row.className = `staff-item staff-${entry.employeeUsername || "default"}`;
    row.innerHTML = `
      <div>
        <strong><span class="staff-color-dot"></span>${escapeHtml(entry.name)}</strong>
        <small>${escapeHtml(entry.fromTime || "--:--")} - ${escapeHtml(entry.toTime || "--:--")}</small>
        <small>${escapeHtml(customerLine)}</small>
        <small>${escapeHtml(t("cal.chkLbl"))} ${escapeHtml(checklistNamesCsv || t("common.emDash"))}</small>
        ${checklistOwnerUsername && checklistOwnerUsername !== (entry.employeeUsername || "")
    ? `<small>${escapeHtml(t("cal.checklistOwnerInfo", { name: checklistOwnerLabel }))}</small>`
    : ""}
        ${entry.recurrenceRuleId ? `<small>${escapeHtml(recurrenceKindLabel(entry.recurrenceType))}</small>` : ""}
        ${entry.staffComment ? `<small>${escapeHtml(t("cal.hintLbl"))} ${escapeHtml(entry.staffComment)}</small>` : ""}
        ${entry.customerAddress ? `<small>${escapeHtml(entry.customerAddress)}</small>` : ""}
        ${entry.customerCoordinates ? `<small>${escapeHtml(t("cal.coordsLbl"))} ${escapeHtml(entry.customerCoordinates)}</small>` : ""}
        ${mapsButton}
      </div>
      ${isBoss
    ? (entry.recurrenceRuleId
      ? `
        <div class="customer-db-item-actions">
          <button class="secondary-button" type="button" data-edit-rule-id="${entry.recurrenceRuleId}">${escapeHtml(t("cal.editRule"))}</button>
          <button class="secondary-button" type="button" data-delete-occurrence-rule-id="${entry.recurrenceRuleId}">${escapeHtml(t("cal.delOccurrence"))}</button>
          <button class="danger-button" type="button" data-delete-rule-id="${entry.recurrenceRuleId}">${escapeHtml(t("cal.delRule"))}</button>
        </div>
      `
      : `
        <div class="customer-db-item-actions">
          <button class="secondary-button" type="button" data-copy-single-id="${entry.id}">${escapeHtml(t("cal.copyBtn"))}</button>
          <button class="secondary-button" type="button" data-edit-single-id="${entry.id}">${escapeHtml(t("cal.editEntry"))}</button>
          <button class="danger-button" type="button" data-id="${entry.id}">${escapeHtml(t("cal.remove"))}</button>
        </div>
      `)
    : checklistEmployeeActions}
    `;
    const removeStaffButton = row.querySelector('[data-id]');
    if (removeStaffButton) removeStaffButton.addEventListener("click", () => removeStaffEntry(entry.id));
    const copySingleButton = row.querySelector('[data-copy-single-id]');
    if (copySingleButton) copySingleButton.addEventListener("click", () => openCalendarCopySingleDialog(entry));
    const editSingleButton = row.querySelector('[data-edit-single-id]');
    if (editSingleButton) editSingleButton.addEventListener("click", () => startEditSingleStaffEntry(entry.id));
    const editRuleButton = row.querySelector('[data-edit-rule-id]');
    if (editRuleButton) editRuleButton.addEventListener("click", () => startEditRecurringRule(entry.recurrenceRuleId));
    const deleteOccurrenceButton = row.querySelector("[data-delete-occurrence-rule-id]");
    if (deleteOccurrenceButton) {
      deleteOccurrenceButton.addEventListener("click", () => {
        deleteRecurringOccurrenceForDate(entry.recurrenceRuleId, selectedCalendarDate);
      });
    }
    const deleteRuleButton = row.querySelector('[data-delete-rule-id]');
    if (deleteRuleButton) deleteRuleButton.addEventListener("click", () => deleteRecurringRule(entry.recurrenceRuleId));
    row.querySelectorAll('[data-action="checklist-tpl"]').forEach((checklistTplBtn) => {
      checklistTplBtn.addEventListener("click", () => {
        if (checklistTplBtn.disabled) return;
        createChecklistFromAssignment(entry, checklistTplBtn.getAttribute("data-template-id"));
      });
    });
    row.querySelectorAll('[data-action="work-order-open"]').forEach((woBtn) => {
      woBtn.addEventListener("click", () => {
        if (woBtn.disabled) return;
        if (!canEmployeeStartCalendarAssignmentOnDate(selectedCalendarDate)) {
          showToast(t("toast.calStartTodayOnly"));
          return;
        }
        ensureWorkOrderState(entry.id, selectedCalendarDate);
        setActiveSection("workOrder");
        renderWorkOrdersPanel();
        showToast(t("wo.tabOpenedHint"));
      });
    });
    el.calendarStaffList.appendChild(row);
  });

  if (calendarPlanningOpen && el.calendarStaffForm && !el.calendarStaffForm.classList.contains("hidden")) {
    updateCalendarAssignmentTypeUi();
  }
}

function addStaffEntriesMulti(
  employeeUsernames,
  checklistOwnerUsername,
  fromTime,
  toTime,
  customerId,
  staffComment,
  checklistTemplateIds,
  hausGartenZoneIds
) {
  const selectedUsernames = Array.from(new Set((employeeUsernames || []).filter(Boolean)));
  if (!selectedUsernames.length) {
    showToast(t("toast.pickEmployee"));
    return false;
  }
  if (!checklistOwnerUsername) {
    showToast(t("toast.pickChecklistOwner"));
    return false;
  }
  if (!selectedUsernames.includes(checklistOwnerUsername)) {
    showToast(t("toast.checklistOwnerInvalid"));
    return false;
  }
  const employeeMap = new Map(getEmployeeUsers().map((item) => [item.username, item]));
  const selectedEmployees = selectedUsernames.map((username) => employeeMap.get(username)).filter(Boolean);
  if (selectedEmployees.length !== selectedUsernames.length) {
    showToast(t("toast.pickEmployee"));
    return false;
  }
  const customer = customerDb.find((entry) => entry.id === customerId);
  if (!customer) {
    showToast(t("toast.pickCustomerDb"));
    return false;
  }
  const rawTpl = Array.isArray(checklistTemplateIds) ? checklistTemplateIds.filter(Boolean) : [];
  if (!rawTpl.length) {
    showToast(t("toast.pickChecklistTpl"));
    return false;
  }
  const tplIds = sanitizeChecklistTemplateIdsArray(rawTpl);
  if (!validateCustomerHasCheckpointsForTemplateIds(customer, tplIds)) {
    return false;
  }
  if (tplIds.includes(HAUS_CHECKLIST_TEMPLATE_ID)) {
    const hz = sanitizeAssignmentHausGartenZoneIds(hausGartenZoneIds);
    if (!hz.length) {
      showToast(t("toast.hausZonesRequired"));
      return false;
    }
    if (!validateCustomerHasHausCheckpointsInZones(customer, hz)) return false;
  }

  const existingEntries = getScheduleEntriesForDate(selectedCalendarDate);
  const overlaps = selectedEmployees.some((employee) => hasScheduleOverlap(existingEntries, employee.username, fromTime, toTime));
  if (overlaps) {
    showToast(t("toast.overlap"));
    return false;
  }

  const groupId = createId();
  const list = staffSchedule[selectedCalendarDate] || [];
  const idsSnapshot = tplIds.slice();
  const hzSnap = tplIds.includes(HAUS_CHECKLIST_TEMPLATE_ID)
    ? sanitizeAssignmentHausGartenZoneIds(hausGartenZoneIds).slice()
    : null;
  selectedEmployees.forEach((employee) => {
    const row = {
      id: createId(),
      assignmentGroupId: groupId,
      checklistOwnerUsername,
      employeeUsername: employee.username,
      name: employee.label,
      fromTime,
      toTime,
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerAddress: customer.address,
      customerCoordinates: customer.coordinates || "",
      project: customer.project,
      staffComment: staffComment || "",
      checklistTemplateIds: idsSnapshot,
      checklistTemplateId: idsSnapshot[0]
    };
    if (hzSnap && hzSnap.length) row.hausGartenZoneIds = hzSnap;
    list.push(row);
  });
  staffSchedule[selectedCalendarDate] = list;
  persistSchedule();
  renderCalendar();
  return true;
}

function addStaffEntry(employeeUsername, fromTime, toTime, customerId, staffComment, checklistTemplateIds, hausGartenZoneIds) {
  const employee = getEmployeeUsers().find((item) => item.username === employeeUsername);
  if (!employee) {
    showToast(t("toast.pickEmployee"));
    return false;
  }

  const customer = customerDb.find((entry) => entry.id === customerId);
  if (!customer) {
    showToast(t("toast.pickCustomerDb"));
    return false;
  }

  const rawTpl = Array.isArray(checklistTemplateIds)
    ? checklistTemplateIds.filter(Boolean)
    : (checklistTemplateIds ? [checklistTemplateIds] : []);
  if (!rawTpl.length) {
    showToast(t("toast.pickChecklistTpl"));
    return false;
  }
  const tplIds = sanitizeChecklistTemplateIdsArray(rawTpl);
  if (!validateCustomerHasCheckpointsForTemplateIds(customer, tplIds)) return false;
  if (tplIds.includes(HAUS_CHECKLIST_TEMPLATE_ID)) {
    const hz = sanitizeAssignmentHausGartenZoneIds(hausGartenZoneIds);
    if (!hz.length) {
      showToast(t("toast.hausZonesRequired"));
      return false;
    }
    if (!validateCustomerHasHausCheckpointsInZones(customer, hz)) return false;
  }

  const list = staffSchedule[selectedCalendarDate] || [];
  const existingEntries = getScheduleEntriesForDate(selectedCalendarDate);
  if (hasScheduleOverlap(existingEntries, employee.username, fromTime, toTime)) {
    showToast(t("toast.overlap"));
    return false;
  }

  list.push(Object.assign({
    id: createId(),
    checklistOwnerUsername: employee.username,
    employeeUsername: employee.username,
    name: employee.label,
    fromTime,
    toTime,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`,
    customerAddress: customer.address,
    customerCoordinates: customer.coordinates || "",
    project: customer.project,
    staffComment: staffComment || "",
    checklistTemplateIds: tplIds.slice(),
    checklistTemplateId: tplIds[0]
  }, (() => {
    const hz = sanitizeAssignmentHausGartenZoneIds(hausGartenZoneIds);
    return tplIds.includes(HAUS_CHECKLIST_TEMPLATE_ID) && hz.length ? { hausGartenZoneIds: hz.slice() } : {};
  })()));
  staffSchedule[selectedCalendarDate] = list;
  persistSchedule();
  renderCalendar();
  return true;
}

function addWorkOrderEntriesMulti(
  employeeUsernames,
  fromTime,
  toTime,
  customerId,
  instructionText,
  chefImagesRaw
) {
  const instruction = String(instructionText || "").trim();
  const chefImages = cloneWorkOrderChefImagesForStorage(chefImagesRaw || []);
  const selectedUsernames = Array.from(new Set((employeeUsernames || []).filter(Boolean)));
  if (!selectedUsernames.length) {
    showToast(t("toast.pickEmployee"));
    return false;
  }
  const employeeMap = new Map(getEmployeeUsers().map((item) => [item.username, item]));
  const selectedEmployees = selectedUsernames.map((username) => employeeMap.get(username)).filter(Boolean);
  if (selectedEmployees.length !== selectedUsernames.length) {
    showToast(t("toast.pickEmployee"));
    return false;
  }
  const customer = customerDb.find((entry) => entry.id === customerId);
  if (!customer) {
    showToast(t("toast.pickCustomerDb"));
    return false;
  }
  if (!instruction) {
    showToast(t("toast.woInstructionRequired"));
    return false;
  }
  const existingEntries = getScheduleEntriesForDate(selectedCalendarDate);
  const overlaps = selectedEmployees.some((employee) => hasScheduleOverlap(existingEntries, employee.username, fromTime, toTime));
  if (overlaps) {
    showToast(t("toast.overlap"));
    return false;
  }

  const groupId = createId();
  const list = staffSchedule[selectedCalendarDate] || [];
  selectedEmployees.forEach((employee) => {
    const rowId = createId();
    list.push({
      id: rowId,
      assignmentGroupId: groupId,
      checklistOwnerUsername: employee.username,
      employeeUsername: employee.username,
      name: employee.label,
      fromTime,
      toTime,
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerAddress: customer.address,
      customerCoordinates: customer.coordinates || "",
      project: customer.project,
      staffComment: instruction,
      checklistTemplateIds: [],
      checklistTemplateId: "",
      assignmentKind: WORK_ORDER_ASSIGNMENT_KIND,
      workOrderImages: chefImages.slice()
    });
    ensureWorkOrderState(rowId, selectedCalendarDate);
  });
  staffSchedule[selectedCalendarDate] = list;
  persistSchedule();
  renderCalendar();
  return true;
}

function updateSingleWorkOrderStaffEntry(entryId, employeeUsername, fromTime, toTime, customerId, staffComment, chefImagesRaw) {
  const list = staffSchedule[selectedCalendarDate] || [];
  const index = list.findIndex((entry) => entry.id === entryId);
  if (index < 0) return false;
  const employee = getEmployeeUsers().find((item) => item.username === employeeUsername);
  if (!employee) {
    showToast(t("toast.pickEmployee"));
    return false;
  }
  const customer = customerDb.find((entry) => entry.id === customerId);
  if (!customer) {
    showToast(t("toast.pickCustomerDb"));
    return false;
  }
  const instruction = String(staffComment || "").trim();
  if (!instruction) {
    showToast(t("toast.woInstructionRequired"));
    return false;
  }
  const existingEntries = getScheduleEntriesForDate(selectedCalendarDate).filter((entry) => entry.id !== entryId);
  if (hasScheduleOverlap(existingEntries, employee.username, fromTime, toTime)) {
    showToast(t("toast.overlap"));
    return false;
  }

  const imgsNext = chefImagesRaw != null
    ? cloneWorkOrderChefImagesForStorage(chefImagesRaw)
    : cloneWorkOrderChefImagesForStorage(list[index].workOrderImages || []);
  list[index] = Object.assign({}, list[index], {
    checklistOwnerUsername: employee.username,
    employeeUsername: employee.username,
    name: employee.label,
    fromTime,
    toTime,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`,
    customerAddress: customer.address,
    customerCoordinates: customer.coordinates || "",
    project: customer.project,
    staffComment: instruction,
    checklistTemplateIds: [],
    checklistTemplateId: "",
    assignmentKind: WORK_ORDER_ASSIGNMENT_KIND,
    workOrderImages: imgsNext
  });
  staffSchedule[selectedCalendarDate] = list;
  persistSchedule();
  renderCalendar();
  return true;
}

function updateSingleStaffEntry(entryId, employeeUsername, fromTime, toTime, customerId, staffComment, checklistTemplateIds, hausGartenZoneIds) {
  const list = staffSchedule[selectedCalendarDate] || [];
  const index = list.findIndex((entry) => entry.id === entryId);
  if (index < 0) return false;
  if (isWorkOrderAssignment(list[index])) {
    return updateSingleWorkOrderStaffEntry(entryId, employeeUsername, fromTime, toTime, customerId, staffComment);
  }
  const employee = getEmployeeUsers().find((item) => item.username === employeeUsername);
  if (!employee) {
    showToast(t("toast.pickEmployee"));
    return false;
  }
  const customer = customerDb.find((entry) => entry.id === customerId);
  if (!customer) {
    showToast(t("toast.pickCustomerDb"));
    return false;
  }
  const rawTpl = Array.isArray(checklistTemplateIds)
    ? checklistTemplateIds.filter(Boolean)
    : (checklistTemplateIds ? [checklistTemplateIds] : []);
  if (!rawTpl.length) {
    showToast(t("toast.pickChecklistTpl"));
    return false;
  }
  const tplIds = sanitizeChecklistTemplateIdsArray(rawTpl);
  if (!validateCustomerHasCheckpointsForTemplateIds(customer, tplIds)) return false;
  if (tplIds.includes(HAUS_CHECKLIST_TEMPLATE_ID)) {
    const hz = sanitizeAssignmentHausGartenZoneIds(hausGartenZoneIds);
    if (!hz.length) {
      showToast(t("toast.hausZonesRequired"));
      return false;
    }
    if (!validateCustomerHasHausCheckpointsInZones(customer, hz)) return false;
  }
  const existingEntries = getScheduleEntriesForDate(selectedCalendarDate).filter((entry) => entry.id !== entryId);
  if (hasScheduleOverlap(existingEntries, employee.username, fromTime, toTime)) {
    showToast(t("toast.overlap"));
    return false;
  }

  const merged = Object.assign({}, list[index], {
    checklistOwnerUsername: employee.username,
    employeeUsername: employee.username,
    name: employee.label,
    fromTime,
    toTime,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`,
    customerAddress: customer.address,
    customerCoordinates: customer.coordinates || "",
    project: customer.project,
    staffComment: staffComment || "",
    checklistTemplateIds: tplIds.slice(),
    checklistTemplateId: tplIds[0]
  });
  if (tplIds.includes(HAUS_CHECKLIST_TEMPLATE_ID)) {
    merged.hausGartenZoneIds = sanitizeAssignmentHausGartenZoneIds(hausGartenZoneIds).slice();
  } else {
    delete merged.hausGartenZoneIds;
  }
  list[index] = merged;
  staffSchedule[selectedCalendarDate] = list;
  persistSchedule();
  renderCalendar();
  return true;
}

function calendarDayNumFromIso(iso) {
  const parts = String(iso || "").split("-");
  const d = Number(parts[2]);
  return Number.isInteger(d) && d >= 1 && d <= 31 ? d : 1;
}

function filterRecurringRulesForOverlapCheck({
  employeeUsername,
  weekdayNumber,
  recurrenceKind,
  monthlyDay,
  excludeRuleId
}) {
  return recurringScheduleRules.filter((entry) => {
    if (excludeRuleId && entry.id === excludeRuleId) return false;
    if (entry.deletedFromIso) return false;
    if (entry.employeeUsername !== employeeUsername) return false;
    const rk = getRuleRecurrenceKind(entry);
    if (recurrenceKind === "monthly") {
      return rk === "monthly" && Number(entry.monthlyDay) === Number(monthlyDay);
    }
    if (Number(entry.weekday) !== weekdayNumber) return false;
    return true;
  });
}

function startEditSingleStaffEntry(entryId) {
  const list = staffSchedule[selectedCalendarDate] || [];
  const entry = list.find((item) => item.id === entryId);
  if (!entry || isRecurringOccurrenceSkipEntry(entry)) return;
  if (!bossMayManageAssignmentEmployee(entry.employeeUsername || "")) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  activeSingleAssignmentId = entryId;
  activeRecurringRuleId = "";
  calendarPlanningOpen = true;
  el.calendarStaffForm.classList.remove("hidden");
  renderCalendarCustomerOptions();
  renderCalendarEmployeeOptions([entry.employeeUsername || ""]);
  el.calendarAssignmentType.value = "single";
  updateCalendarAssignmentTypeUi();
  el.calendarFromTime.value = entry.fromTime || "";
  el.calendarToTime.value = entry.toTime || "";
  el.calendarCustomerSelect.value = entry.customerId || "";
  el.calendarStaffComment.value = entry.staffComment || "";
  if (el.calendarWorkOrderMode) {
    el.calendarWorkOrderMode.checked = isWorkOrderAssignment(entry);
  }
  renderCalendarChecklistTemplateCheckboxes(normalizeAssignmentTemplateIds(entry));
  setCalendarHausZoneCheckboxSelection(entry.hausGartenZoneIds);
  updateCalendarAssignmentTypeUi();
  updateCalendarWorkOrderModeUi();
  calendarWorkOrderPhotos = isWorkOrderAssignment(entry)
    ? cloneWorkOrderChefImagesForStorage(entry.workOrderImages || [])
    : [];
  renderCalendarWorkOrderPhotos();
  updateCalendarStaffSubmitButtonLabel();
  syncCalendarStaffFormInitialState();
  showToast(t("toast.calEditLoad"));
}

function buildRecurringRulePayload(employee, customer, recurrenceKind, weekdayNumber, anchorIso, monthlyDom, checklistTemplateIds, hausGartenZoneIds) {
  const ids = sanitizeChecklistTemplateIdsArray(checklistTemplateIds);
  const hz = sanitizeAssignmentHausGartenZoneIds(hausGartenZoneIds);
  const base = {
    checklistOwnerUsername: employee.username,
    employeeUsername: employee.username,
    name: employee.label,
    weekday: weekdayNumber,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`,
    customerAddress: customer.address,
    customerCoordinates: customer.coordinates || "",
    project: customer.project,
    checklistTemplateIds: ids,
    checklistTemplateId: ids[0]
  };
  if (ids.includes(HAUS_CHECKLIST_TEMPLATE_ID) && hz.length) {
    base.hausGartenZoneIds = hz.slice();
  }
  if (recurrenceKind === "biweekly") {
    const todayIso = toIsoDate(new Date());
    const anchorCandidate = anchorIso || selectedCalendarDate;
    base.anchorIso = anchorCandidate < todayIso ? todayIso : anchorCandidate;
  }
  if (recurrenceKind === "monthly") {
    base.monthlyDay = monthlyDom;
  }
  return Object.assign({}, base, { recurrenceKind: recurrenceKind === "weekly" ? "weekly" : recurrenceKind });
}

function addRecurringStaffRule(
  employeeUsername,
  fromTime,
  toTime,
  customerId,
  staffComment,
  weekday,
  checklistTemplateIds,
  recurrenceKind,
  anchorIso,
  monthlyDay,
  hausGartenZoneIds
) {
  const rk = recurrenceKind === "biweekly" || recurrenceKind === "monthly" ? recurrenceKind : "weekly";
  const employee = getEmployeeUsers().find((item) => item.username === employeeUsername);
  if (!employee) {
    showToast(t("toast.pickEmployee"));
    return false;
  }
  const customer = customerDb.find((entry) => entry.id === customerId);
  if (!customer) {
    showToast(t("toast.pickCustomerDb"));
    return false;
  }

  const rawTpl = Array.isArray(checklistTemplateIds) ? checklistTemplateIds.filter(Boolean) : [];
  if (!rawTpl.length) {
    showToast(t("toast.pickChecklistTpl"));
    return false;
  }
  const tplIds = sanitizeChecklistTemplateIdsArray(rawTpl);
  if (!validateCustomerHasCheckpointsForTemplateIds(customer, tplIds)) return false;
  if (tplIds.includes(HAUS_CHECKLIST_TEMPLATE_ID)) {
    const hz = sanitizeAssignmentHausGartenZoneIds(hausGartenZoneIds);
    if (!hz.length) {
      showToast(t("toast.hausZonesRequired"));
      return false;
    }
    if (!validateCustomerHasHausCheckpointsInZones(customer, hz)) return false;
  }

  let weekdayNumber = Number(weekday);
  let monthlyDom = null;
  if (rk === "monthly") {
    monthlyDom = monthlyDay != null ? Number(monthlyDay) : calendarDayNumFromIso(selectedCalendarDate);
    if (!Number.isInteger(monthlyDom) || monthlyDom < 1 || monthlyDom > 31) {
      showToast(t("toast.pickWeekday"));
      return false;
    }
    weekdayNumber = weekdayFromIsoDate(selectedCalendarDate);
  } else if (!Number.isInteger(weekdayNumber) || weekdayNumber < 0 || weekdayNumber > 6) {
    showToast(t("toast.pickWeekday"));
    return false;
  }

  const overlapPeers = filterRecurringRulesForOverlapCheck({
    employeeUsername: employee.username,
    weekdayNumber,
    recurrenceKind: rk,
    monthlyDay: rk === "monthly" ? monthlyDom : undefined,
    excludeRuleId: null
  });
  if (hasScheduleOverlap(overlapPeers, employee.username, fromTime, toTime)) {
    showToast(t("toast.overlapRule"));
    return false;
  }

  const extras = buildRecurringRulePayload(employee, customer, rk, weekdayNumber, anchorIso, monthlyDom, tplIds, hausGartenZoneIds);
  recurringScheduleRules.unshift(
    Object.assign(
      {
        id: createId(),
        fromTime,
        toTime,
        staffComment: staffComment || "",
        effectiveFromIso: toIsoDate(new Date())
      },
      extras
    )
  );
  persistRecurringScheduleRules();
  renderCalendar();
  return true;
}

function updateRecurringStaffRule(
  ruleId,
  employeeUsername,
  fromTime,
  toTime,
  customerId,
  staffComment,
  weekday,
  checklistTemplateIds,
  recurrenceKind,
  anchorIso,
  monthlyDay,
  hausGartenZoneIds
) {
  const index = recurringScheduleRules.findIndex((rule) => rule.id === ruleId);
  if (index < 0) return false;
  const prev = recurringScheduleRules[index];
  const employee = getEmployeeUsers().find((item) => item.username === employeeUsername);
  if (!employee) {
    showToast(t("toast.pickEmployee"));
    return false;
  }
  const customer = customerDb.find((entry) => entry.id === customerId);
  if (!customer) {
    showToast(t("toast.pickCustomerDb"));
    return false;
  }
  const rawTpl = Array.isArray(checklistTemplateIds) ? checklistTemplateIds.filter(Boolean) : [];
  if (!rawTpl.length) {
    showToast(t("toast.pickChecklistTpl"));
    return false;
  }
  const tplIds = sanitizeChecklistTemplateIdsArray(rawTpl);
  if (!validateCustomerHasCheckpointsForTemplateIds(customer, tplIds)) return false;
  if (tplIds.includes(HAUS_CHECKLIST_TEMPLATE_ID)) {
    const hz = sanitizeAssignmentHausGartenZoneIds(hausGartenZoneIds);
    if (!hz.length) {
      showToast(t("toast.hausZonesRequired"));
      return false;
    }
    if (!validateCustomerHasHausCheckpointsInZones(customer, hz)) return false;
  }

  const rk = recurrenceKind === "biweekly" || recurrenceKind === "monthly" ? recurrenceKind : "weekly";
  let weekdayNumber = Number(weekday);
  let monthlyDom = null;
  if (rk === "monthly") {
    monthlyDom =
      monthlyDay != null ? Number(monthlyDay) : (prev.monthlyDay != null ? Number(prev.monthlyDay) : calendarDayNumFromIso(selectedCalendarDate));
    if (!Number.isInteger(monthlyDom) || monthlyDom < 1 || monthlyDom > 31) {
      showToast(t("toast.pickWeekday"));
      return false;
    }
    weekdayNumber = weekdayFromIsoDate(selectedCalendarDate);
  } else if (!Number.isInteger(weekdayNumber) || weekdayNumber < 0 || weekdayNumber > 6) {
    showToast(t("toast.pickWeekday"));
    return false;
  }

  const overlapPeers = filterRecurringRulesForOverlapCheck({
    employeeUsername: employee.username,
    weekdayNumber,
    recurrenceKind: rk,
    monthlyDay: rk === "monthly" ? monthlyDom : undefined,
    excludeRuleId: ruleId
  });
  if (hasScheduleOverlap(overlapPeers, employee.username, fromTime, toTime)) {
    showToast(t("toast.overlapRule"));
    return false;
  }

  let anchorUse;
  if (rk === "biweekly") {
    const todayIso = toIsoDate(new Date());
    const rawAnchor = anchorIso || prev.anchorIso || selectedCalendarDate;
    anchorUse = rawAnchor < todayIso ? todayIso : rawAnchor;
  }
  const extras = buildRecurringRulePayload(employee, customer, rk, weekdayNumber, anchorUse, monthlyDom, tplIds, hausGartenZoneIds);
  const nextRule = Object.assign(
    {
      id: ruleId,
      fromTime,
      toTime,
      staffComment: staffComment || ""
    },
    extras
  );
  if (prev.deletedFromIso) nextRule.deletedFromIso = prev.deletedFromIso;
  if (prev.effectiveFromIso) nextRule.effectiveFromIso = prev.effectiveFromIso;
  else nextRule.effectiveFromIso = toIsoDate(new Date());
  if (rk !== "biweekly") delete nextRule.anchorIso;
  if (rk !== "monthly") delete nextRule.monthlyDay;
  recurringScheduleRules[index] = nextRule;
  persistRecurringScheduleRules();

  const syncedRule = recurringScheduleRules[index];
  const syncedTplIds = normalizeAssignmentTemplateIds(syncedRule);
  Object.keys(staffSchedule).forEach((isoDate) => {
    const dayEntries = staffSchedule[isoDate] || [];
    const updatedEntries = dayEntries.map((entry) => {
      if (entry.recurrenceRuleId !== ruleId) return entry;
      if (isRecurringOccurrenceSkipEntry(entry)) return entry;
      const merged = Object.assign({}, entry, {
        checklistOwnerUsername: syncedRule.checklistOwnerUsername || syncedRule.employeeUsername,
        employeeUsername: syncedRule.employeeUsername,
        name: syncedRule.name,
        fromTime: syncedRule.fromTime,
        toTime: syncedRule.toTime,
        customerId: syncedRule.customerId,
        customerName: syncedRule.customerName,
        customerAddress: syncedRule.customerAddress,
        customerCoordinates: syncedRule.customerCoordinates,
        project: syncedRule.project,
        staffComment: syncedRule.staffComment,
        checklistTemplateIds: syncedTplIds.slice(),
        checklistTemplateId: syncedTplIds[0]
      });
      if (syncedTplIds.includes(HAUS_CHECKLIST_TEMPLATE_ID)) {
        const hz = sanitizeAssignmentHausGartenZoneIds(syncedRule.hausGartenZoneIds);
        merged.hausGartenZoneIds = hz.length ? hz.slice() : [...HAUS_CHECKPOINT_ZONE_IDS];
      } else {
        delete merged.hausGartenZoneIds;
      }
      return merged;
    });
    staffSchedule[isoDate] = updatedEntries;
  });
  persistSchedule();
  renderCalendar();
  return true;
}

function deleteRecurringOccurrenceForDate(ruleId, isoDate) {
  if (!ruleId || !isoDate) return;
  if (!recurringScheduleRules.some((rule) => rule.id === ruleId)) return;
  const rule = recurringScheduleRules.find((r) => r.id === ruleId);
  if (rule && !bossMayManageAssignmentEmployee(rule.employeeUsername || "")) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  if (!window.confirm(t("cal.confirmDelOccurrence"))) return;
  const prevList = staffSchedule[isoDate] || [];
  const next = prevList.filter((entry) => {
    if (entry.recurrenceRuleId !== ruleId) return true;
    return false;
  });
  next.push({
    id: createId(),
    recurrenceRuleId: ruleId,
    recurringOccurrenceSkip: true
  });
  staffSchedule[isoDate] = next;
  persistSchedule();
  renderCalendar();
  showToast(t("toast.occurrenceDeleted"));
}

function deleteRecurringRule(ruleId) {
  const rule = recurringScheduleRules.find((r) => r.id === ruleId);
  if (rule && !bossMayManageAssignmentEmployee(rule.employeeUsername || "")) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  const cutoffIso = toIsoDate(new Date());
  recurringScheduleRules = recurringScheduleRules.map((rule) => {
    if (rule.id !== ruleId) return rule;
    return Object.assign({}, rule, { deletedFromIso: cutoffIso });
  });
  persistRecurringScheduleRules();
  Object.keys(staffSchedule).forEach((isoDate) => {
    const dayEntries = staffSchedule[isoDate] || [];
    const filteredEntries = dayEntries.filter((entry) => (
      entry.recurrenceRuleId !== ruleId || isoDate < cutoffIso
    ));
    if (filteredEntries.length) {
      staffSchedule[isoDate] = filteredEntries;
    } else {
      delete staffSchedule[isoDate];
    }
  });
  persistSchedule();
  renderCalendar();
  showToast(t("toast.ruleDeleted"));
}

function startEditRecurringRule(ruleId) {
  const rule = recurringScheduleRules.find((entry) => entry.id === ruleId);
  if (!rule) return;
  if (!bossMayManageAssignmentEmployee(rule.employeeUsername || "")) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  activeRecurringRuleId = ruleId;
  activeSingleAssignmentId = "";
  calendarPlanningOpen = true;
  el.calendarStaffForm.classList.remove("hidden");
  renderCalendarCustomerOptions();
  renderCalendarEmployeeOptions([rule.employeeUsername || ""]);
  const rk = getRuleRecurrenceKind(rule);
  el.calendarAssignmentType.value = rk === "biweekly" ? "biweekly" : rk === "monthly" ? "monthly" : "weekly";
  el.calendarRecurringWeekday.value = String(rule.weekday);
  el.calendarFromTime.value = rule.fromTime || "";
  el.calendarToTime.value = rule.toTime || "";
  el.calendarCustomerSelect.value = rule.customerId || "";
  el.calendarStaffComment.value = rule.staffComment || "";
  if (el.calendarWorkOrderMode) el.calendarWorkOrderMode.checked = false;
  renderCalendarChecklistTemplateCheckboxes(normalizeAssignmentTemplateIds(rule));
  setCalendarHausZoneCheckboxSelection(rule.hausGartenZoneIds);
  updateCalendarAssignmentTypeUi();
  updateCalendarWorkOrderModeUi();
  updateCalendarStaffSubmitButtonLabel();
  syncCalendarStaffFormInitialState();
  showToast(t("toast.ruleEditLoad"));
}

function renderCalendarCustomerOptions() {
  if (!el.calendarCustomerSelect) return;
  const previousValue = el.calendarCustomerSelect.value;
  el.calendarCustomerSelect.innerHTML = `<option value="">${escapeHtml(t("cal.pickCustomer"))}</option>`;
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

function renderCalendarEmployeeOptions(preselectedUsernames) {
  if (!el.calendarEmployeeCheckboxes) return;
  const selectedValues = Array.isArray(preselectedUsernames)
    ? preselectedUsernames.filter(Boolean)
    : getSelectedCalendarEmployeeUsernames();
  el.calendarEmployeeCheckboxes.innerHTML = "";
  getCalendarSelectableEmployees().forEach((employee) => {
    const row = document.createElement("label");
    row.className = "calendar-employee-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = employee.username;
    input.checked = selectedValues.includes(employee.username);
    const caption = document.createElement("span");
    caption.textContent = employee.label;
    row.appendChild(input);
    row.appendChild(caption);
    el.calendarEmployeeCheckboxes.appendChild(row);
  });
  if (WC) WC.applyToScope(el.calendarEmployeeCheckboxes);
  updateCalendarChecklistOwnerOptions();
}

function getSelectedCalendarEmployeeUsernames() {
  if (!el.calendarEmployeeCheckboxes) return [];
  return Array.from(el.calendarEmployeeCheckboxes.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => input.value)
    .filter(Boolean);
}

function updateCalendarChecklistOwnerOptions(preferredOwner) {
  if (!el.calendarChecklistOwnerWrap || !el.calendarChecklistOwnerSelect) return;
  const selectedEmployees = getSelectedCalendarEmployeeUsernames();
  const woMode = Boolean(el.calendarWorkOrderMode && el.calendarWorkOrderMode.checked);
  const shouldShow = !woMode && selectedEmployees.length > 1;
  el.calendarChecklistOwnerWrap.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    el.calendarChecklistOwnerSelect.innerHTML = "";
    el.calendarChecklistOwnerSelect.required = false;
    return;
  }
  const previous = preferredOwner || el.calendarChecklistOwnerSelect.value;
  el.calendarChecklistOwnerSelect.innerHTML = `<option value="">${escapeHtml(t("cal.pickChecklistOwner"))}</option>`;
  selectedEmployees.forEach((username) => {
    const option = document.createElement("option");
    option.value = username;
    option.textContent = getEmployeeLabelByUsername(username);
    el.calendarChecklistOwnerSelect.appendChild(option);
  });
  const resolved = selectedEmployees.includes(previous) ? previous : "";
  el.calendarChecklistOwnerSelect.value = resolved;
  el.calendarChecklistOwnerSelect.required = true;
}

function renderCalendarEmployeeFilterOptions() {
  if (!el.calendarEmployeeFilter) return;
  const previousValue = el.calendarEmployeeFilter.value;
  el.calendarEmployeeFilter.innerHTML = `<option value="">${escapeHtml(t("cal.allStaff"))}</option>`;
  const pool = isRestrictedBossSession() ? getCalendarSelectableEmployees() : getEmployeeUsers();
  pool.forEach((employee) => {
    const option = document.createElement("option");
    option.value = employee.username;
    option.textContent = `${t("cal.staffPrefix")} ${employee.label}`;
    el.calendarEmployeeFilter.appendChild(option);
  });
  if (pool.some((employee) => employee.username === previousValue)) {
    el.calendarEmployeeFilter.value = previousValue;
  }
}

function removeStaffEntry(id) {
  const list = staffSchedule[selectedCalendarDate] || [];
  const entry = list.find((item) => item.id === id);
  if (entry && !bossMayManageAssignmentEmployee(entry.employeeUsername || "")) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  removeWorkOrderStateForAssignment(id, selectedCalendarDate);
  staffSchedule[selectedCalendarDate] = list.filter((e) => e.id !== id);
  if (!staffSchedule[selectedCalendarDate].length) {
    delete staffSchedule[selectedCalendarDate];
  }
  persistSchedule();
  renderCalendar();
}

function copySingleStaffEntryToDate(sourceIso, entryId, targetIso) {
  if (!sourceIso || !entryId || !targetIso) return false;
  if (sourceIso === targetIso) {
    showToast(t("cal.copySameDate"));
    return false;
  }
  if (!isoDateIsCalendarValid(targetIso)) {
    showToast(t("cal.copyInvalidDate"));
    return false;
  }
  const sourceList = staffSchedule[sourceIso] || [];
  const entry = sourceList.find((item) => item.id === entryId);
  if (!entry || entry.recurrenceRuleId) {
    showToast(t("toast.calCopyFailed"));
    return false;
  }
  const groupedEntries = entry.assignmentGroupId
    ? sourceList.filter((item) => item.assignmentGroupId === entry.assignmentGroupId)
    : [entry];
  if (groupedEntries.some((item) => !bossMayManageAssignmentEmployee(item.employeeUsername || ""))) {
    showToast(t("toast.managedStaffOnly"));
    return false;
  }
  const existingOnTarget = getScheduleEntriesForDate(targetIso);
  const hasAnyOverlap = groupedEntries.some((item) => hasScheduleOverlap(existingOnTarget, item.employeeUsername, item.fromTime, item.toTime));
  if (hasAnyOverlap) {
    showToast(t("toast.overlap"));
    return false;
  }
  const nextGroupId = groupedEntries.length > 1 ? createId() : (entry.assignmentGroupId || "");
  const targetList = staffSchedule[targetIso] ? [...staffSchedule[targetIso]] : [];
  groupedEntries.forEach((item) => {
    const cIds = normalizeAssignmentTemplateIds(item);
    const newId = createId();
    const base = {
      id: newId,
      assignmentGroupId: nextGroupId,
      checklistOwnerUsername: item.checklistOwnerUsername || item.employeeUsername,
      employeeUsername: item.employeeUsername,
      name: item.name,
      fromTime: item.fromTime,
      toTime: item.toTime,
      customerId: item.customerId,
      customerName: item.customerName,
      customerAddress: item.customerAddress,
      customerCoordinates: item.customerCoordinates || "",
      project: item.project,
      staffComment: item.staffComment || "",
      checklistTemplateIds: cIds.slice(),
      checklistTemplateId: cIds[0]
    };
    if (cIds.includes(HAUS_CHECKLIST_TEMPLATE_ID)) {
      const hz = sanitizeAssignmentHausGartenZoneIds(item.hausGartenZoneIds);
      if (hz.length) base.hausGartenZoneIds = hz.slice();
      else base.hausGartenZoneIds = [...HAUS_CHECKPOINT_ZONE_IDS];
    }
    if (isWorkOrderAssignment(item)) {
      base.assignmentKind = WORK_ORDER_ASSIGNMENT_KIND;
      base.checklistTemplateIds = [];
      base.checklistTemplateId = "";
      delete base.hausGartenZoneIds;
      base.workOrderImages = cloneWorkOrderChefImagesForStorage(item.workOrderImages || []);
      base.workOrderResultImages = cloneWorkOrderChefImagesForStorage(item.workOrderResultImages || []);
    }
    targetList.push(base);
    if (isWorkOrderAssignment(item)) {
      ensureWorkOrderState(newId, targetIso);
    }
  });
  staffSchedule[targetIso] = targetList;
  persistSchedule();
  const [ty, tm] = targetIso.split("-").map(Number);
  calendarMonth = new Date(ty, tm - 1, 1);
  selectedCalendarDate = targetIso;
  renderCalendar();
  showToast(t("toast.calCopied"));
  return true;
}

function openCalendarCopySingleDialog(entry) {
  if (!el.calendarCopySingleDialog || !entry || entry.recurrenceRuleId) return;
  if (!bossMayManageAssignmentEmployee(entry.employeeUsername || "")) {
    showToast(t("toast.managedStaffOnly"));
    return;
  }
  const sourceList = staffSchedule[selectedCalendarDate] || [];
  if (!sourceList.some((item) => item.id === entry.id)) {
    showToast(t("toast.calCopyFailed"));
    return;
  }
  pendingCopySingleEntryId = entry.id;
  if (el.calendarCopySingleSummary) {
    el.calendarCopySingleSummary.textContent = t("cal.copySummary", {
      employee: entry.name || "",
      fromTime: entry.fromTime || "--:--",
      toTime: entry.toTime || "--:--"
    });
  }
  if (el.calendarCopySingleDateInput) el.calendarCopySingleDateInput.value = "";
  if (WC) WC.applyToScope(el.calendarCopySingleDialog);
  try {
    el.calendarCopySingleDialog.showModal();
  } catch (e) {
    return;
  }
  requestAnimationFrame(() => {
    if (el.calendarCopySingleDateInput) el.calendarCopySingleDateInput.focus();
  });
}

function renderCalendarWorkOrderPhotos() {
  if (!el.calendarWorkOrderPhotoPreview) return;
  el.calendarWorkOrderPhotoPreview.innerHTML = calendarWorkOrderPhotos.map((ph, i) => {
    const src = safeDataImageSrc(ph.data);
    if (!src) return "";
    return `<div class="calendar-wo-photo-tile"><img src="${src}" alt="${escapeHtml(ph.name || "")}" /><button type="button" class="text-button calendar-wo-photo-remove" data-calendar-wo-photo-remove="${i}" aria-label="${escapeHtml(t("wo.removePhoto"))}">×</button></div>`;
  }).join("");
  if (el.calendarWorkOrderPhotoHint) {
    el.calendarWorkOrderPhotoHint.textContent = t("wo.photoHintCount", {
      cur: String(calendarWorkOrderPhotos.length),
      max: String(WORK_ORDER_MAX_CHEF_PHOTOS)
    });
  }
  if (el.calendarWorkOrderPhotoInput) {
    el.calendarWorkOrderPhotoInput.disabled = calendarWorkOrderPhotos.length >= WORK_ORDER_MAX_CHEF_PHOTOS;
  }
}

async function handleCalendarWorkOrderPhotoPick(fileList) {
  if (!fileList || !fileList.length) return;
  const files = [...fileList];
  for (let fi = 0; fi < files.length; fi += 1) {
    if (calendarWorkOrderPhotos.length >= WORK_ORDER_MAX_CHEF_PHOTOS) {
      showToast(t("wo.maxPhotos"));
      break;
    }
    const file = files[fi];
    if (!file.type.startsWith("image/")) continue;
    await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const ph = await finalizeUploadedChecklistImage(reader.result, file.name);
          if (calendarWorkOrderPhotos.length < WORK_ORDER_MAX_CHEF_PHOTOS) {
            calendarWorkOrderPhotos.push(ph);
          }
        } catch (err) {
          console.error(err);
          const raw = reader.result;
          if (typeof raw === "string" && raw.startsWith("data:image/") && calendarWorkOrderPhotos.length < WORK_ORDER_MAX_CHEF_PHOTOS) {
            calendarWorkOrderPhotos.push({ name: file.name, data: raw });
          }
        }
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }
  renderCalendarWorkOrderPhotos();
}

function updateCalendarWorkOrderModeUi() {
  const wo = Boolean(el.calendarWorkOrderMode && el.calendarWorkOrderMode.checked);
  if (el.calendarChecklistTplFieldWrap) el.calendarChecklistTplFieldWrap.classList.toggle("hidden", wo);
  if (el.calendarWorkOrderPhotoWrap) el.calendarWorkOrderPhotoWrap.classList.toggle("hidden", !wo);
  if (el.calendarStaffCommentLabelNormal) el.calendarStaffCommentLabelNormal.classList.toggle("hidden", wo);
  if (el.calendarStaffCommentLabelWo) el.calendarStaffCommentLabelWo.classList.toggle("hidden", !wo);
  if (el.calendarStaffComment) {
    el.calendarStaffComment.required = wo;
    el.calendarStaffComment.placeholder = t(wo ? "wo.calInstructionPh" : "cal.staffCommentPh");
  }
  if (wo) renderCalendarWorkOrderPhotos();
  if (wo && el.calendarAssignmentType && el.calendarAssignmentType.value !== "single") {
    el.calendarAssignmentType.value = "single";
    updateCalendarAssignmentTypeUi();
  }
  updateCalendarChecklistOwnerOptions();
  updateCalendarHausZonesVisibilityUi();
}

function updateCalendarAssignmentTypeUi() {
  if (!el.calendarAssignmentType || !el.calendarRecurringWeekday) return;
  const v = el.calendarAssignmentType.value;
  if (v !== "single" && el.calendarWorkOrderMode && el.calendarWorkOrderMode.checked) {
    el.calendarWorkOrderMode.checked = false;
  }
  const showWeekday = v === "weekly" || v === "biweekly";
  if (el.calendarRecurringWeekdayWrap) el.calendarRecurringWeekdayWrap.classList.toggle("hidden", !showWeekday);
  else if (el.calendarRecurringWeekday) el.calendarRecurringWeekday.classList.toggle("hidden", !showWeekday);
  if (el.calendarMonthlyDomHint) {
    const showMonth = v === "monthly";
    el.calendarMonthlyDomHint.classList.toggle("hidden", !showMonth);
    if (showMonth) {
      let dom = calendarDayNumFromIso(selectedCalendarDate);
      if (activeRecurringRuleId) {
        const rr = recurringScheduleRules.find((r) => r.id === activeRecurringRuleId);
        if (rr && rr.monthlyDay != null) dom = Number(rr.monthlyDay);
      }
      el.calendarMonthlyDomHint.textContent = t("cal.monthlyDomHint", { day: String(dom) });
    }
  }
  updateCalendarWorkOrderModeUi();
}

function updateCalendarStaffSubmitButtonLabel() {
  if (!el.calendarStaffSubmitButton) return;
  const isEditMode = Boolean(activeRecurringRuleId || activeSingleAssignmentId);
  el.calendarStaffSubmitButton.textContent = isEditMode ? t("cal.save") : t("cal.add");
}

function resetCalendarStaffFormState() {
  activeRecurringRuleId = "";
  activeSingleAssignmentId = "";
  if (el.calendarWorkOrderMode) el.calendarWorkOrderMode.checked = false;
  if (el.calendarAssignmentType) el.calendarAssignmentType.value = "single";
  if (el.calendarRecurringWeekday) {
    el.calendarRecurringWeekday.value = String(weekdayFromIsoDate(selectedCalendarDate));
  }
  if (el.calendarChecklistOwnerWrap) el.calendarChecklistOwnerWrap.classList.add("hidden");
  if (el.calendarChecklistOwnerSelect) {
    el.calendarChecklistOwnerSelect.innerHTML = "";
    el.calendarChecklistOwnerSelect.required = false;
  }
  if (el.calendarEmployeeCheckboxes) {
    el.calendarEmployeeCheckboxes.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
  }
  renderCalendarChecklistTemplateCheckboxes([HAUS_CHECKLIST_TEMPLATE_ID]);
  updateCalendarAssignmentTypeUi();
  updateCalendarWorkOrderModeUi();
  calendarWorkOrderPhotos = [];
  renderCalendarWorkOrderPhotos();
  updateCalendarStaffSubmitButtonLabel();
}

function getCalendarStaffFormState() {
  return JSON.stringify({
    assignmentType: el.calendarAssignmentType ? el.calendarAssignmentType.value : "",
    weekday: el.calendarRecurringWeekday ? el.calendarRecurringWeekday.value : "",
    employees: getSelectedCalendarEmployeeUsernames().sort(),
    workOrder: Boolean(el.calendarWorkOrderMode && el.calendarWorkOrderMode.checked),
    woPhotos: calendarWorkOrderPhotos.length,
    checklistOwner: el.calendarChecklistOwnerSelect ? el.calendarChecklistOwnerSelect.value : "",
    fromTime: el.calendarFromTime ? el.calendarFromTime.value : "",
    toTime: el.calendarToTime ? el.calendarToTime.value : "",
    customer: el.calendarCustomerSelect ? el.calendarCustomerSelect.value : "",
    comment: el.calendarStaffComment ? el.calendarStaffComment.value.trim() : "",
    checklistTpl: getSelectedCalendarTemplateIds().sort().join(","),
    hausZones: getSelectedCalendarHausGartenZones().sort().join(","),
    editingRuleId: activeRecurringRuleId || "",
    editingSingleId: activeSingleAssignmentId || ""
  });
}

function syncCalendarStaffFormInitialState() {
  calendarStaffFormInitialState = getCalendarStaffFormState();
}

function cancelCalendarStaffPlanning() {
  if (!el.calendarStaffForm) return;
  const hasUnsavedChanges = getCalendarStaffFormState() !== calendarStaffFormInitialState;
  if (hasUnsavedChanges && !window.confirm(t("cal.discardUnsaved"))) {
    return;
  }
  el.calendarStaffForm.reset();
  resetCalendarStaffFormState();
  syncCalendarStaffFormInitialState();
  calendarPlanningOpen = false;
  el.calendarStaffForm.classList.add("hidden");
}

el.addItemButton.addEventListener("click", () => addChecklistItem("", false, "", null, "", getChecklistFormParentForNewItem()));
el.photoInput.addEventListener("change", (event) => {
  void handlePhotoUpload(event.target.files).catch((err) => console.error(err));
});
if (el.customerName) {
  el.customerName.addEventListener("input", () => {
    renderChecklistCustomerOrientationPhoto();
  });
}
if (el.customerOrientationPreview) {
  el.customerOrientationPreview.addEventListener("click", (event) => {
    const trigger = event.target && event.target.closest
      ? event.target.closest(".customer-orientation-open-original")
      : null;
    if (!trigger) return;
    const src = trigger.getAttribute("data-full-src") || "";
    const name = trigger.getAttribute("data-full-name") || "";
    const ok = openImageLightbox(src, name);
    if (!ok) showToast(t("toast.chkSaveFailed"));
  });
}
if (el.imageLightboxClose) {
  el.imageLightboxClose.addEventListener("click", () => closeImageLightbox());
}
if (el.imageLightbox) {
  el.imageLightbox.addEventListener("click", (event) => {
    if (event.target === el.imageLightbox) closeImageLightbox();
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (el.imageLightbox && !el.imageLightbox.classList.contains("hidden")) {
    closeImageLightbox();
  }
});
if (el.extraCostsEnabled) el.extraCostsEnabled.addEventListener("change", () => setExtraCostsEnabled(el.extraCostsEnabled.checked));
if (el.extraCostsPhotoTrigger && el.extraCostsPhotoInput) {
  el.extraCostsPhotoTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    el.extraCostsPhotoInput.click();
  });
}
if (el.extraCostsPhotoInput) {
  el.extraCostsPhotoInput.addEventListener("change", () => {
    const file = el.extraCostsPhotoInput.files && el.extraCostsPhotoInput.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        extraCostsPhoto = await finalizeUploadedChecklistImage(reader.result, file.name);
      } catch (e) {
        console.error(e);
        extraCostsPhoto = { name: file.name, data: reader.result };
      }
      renderExtraCostsPhoto();
    };
    reader.readAsDataURL(file);
    el.extraCostsPhotoInput.value = "";
  });
}
el.checklistForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveChecklist("submitted").catch((err) => console.error(err));
});
el.saveDraftButton.addEventListener("click", () => void saveChecklist("draft").catch((err) => console.error(err)));
el.newChecklistButton.addEventListener("click", () => {
  if (currentRole === "employee") return;
  resetForm();
});
if (el.checklistTemplateSelect) {
  el.checklistTemplateSelect.addEventListener("change", () => {
    if (activeChecklistId) return;
    activeFormChecklistTemplateId = el.checklistTemplateSelect.value || HAUS_CHECKLIST_TEMPLATE_ID;
    rebuildChecklistItemsFromTemplate(activeFormChecklistTemplateId);
  });
}
if (el.customerCheckpointTemplateSelect) {
  el.customerCheckpointTemplateSelect.addEventListener("change", () => {
    pendingCustomerCheckpointSets[lastCustomerCheckpointTemplateChoice] = getSelectedCustomerCheckpoints();
    lastCustomerCheckpointTemplateChoice = el.customerCheckpointTemplateSelect.value;
    refreshCustomerCheckpointOptions();
  });
}
if (el.checkpointManagerTemplateSelect) {
  el.checkpointManagerTemplateSelect.addEventListener("change", () => {
    persistCheckpointTemplateAccessFromInputs();
    checkpointManagerTemplateId = el.checkpointManagerTemplateSelect.value || HAUS_CHECKLIST_TEMPLATE_ID;
    activeCheckpointEditIndex = -1;
    resetCheckpointForm();
    refreshCheckpointStaffUi();
  });
}
if (el.checkpointAccessAllEmployees) {
  el.checkpointAccessAllEmployees.addEventListener("change", () => {
    persistCheckpointTemplateAccessFromInputs();
    renderCheckpointEmployeeAccessPanel();
  });
}
if (el.checkpointEmployeeAccess) {
  el.checkpointEmployeeAccess.addEventListener("change", (event) => {
    const checkbox = event.target && event.target.matches && event.target.matches("input[type='checkbox']") ? event.target : null;
    if (!checkbox) return;
    if (el.checkpointAccessAllEmployees && el.checkpointAccessAllEmployees.checked) return;
    persistCheckpointTemplateAccessFromInputs();
    renderCheckpointEmployeeAccessPanel();
  });
}

el.statusFilter.addEventListener("change", renderLists);
el.bossCustomerFilter.addEventListener("input", renderLists);
el.bossProjectFilter.addEventListener("input", renderLists);
if (el.bossExtraCostsFilter) el.bossExtraCostsFilter.addEventListener("change", renderLists);
if (el.bossChecklistFilter) el.bossChecklistFilter.addEventListener("change", renderLists);
if (el.employeeChecklistStatusFilter) el.employeeChecklistStatusFilter.addEventListener("change", renderLists);
if (el.employeeChecklistCustomerFilter) el.employeeChecklistCustomerFilter.addEventListener("input", renderLists);
if (el.employeeChecklistProjectFilter) el.employeeChecklistProjectFilter.addEventListener("input", renderLists);
el.calendarPrev.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
});
el.calendarNext.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
});
if (el.calendarCopySingleDialog) {
  el.calendarCopySingleDialog.addEventListener("close", () => {
    pendingCopySingleEntryId = "";
  });
}
if (el.calendarCopySingleCancelBtn && el.calendarCopySingleDialog) {
  el.calendarCopySingleCancelBtn.addEventListener("click", () => {
    el.calendarCopySingleDialog.close();
  });
}
function submitCalendarCopySingle() {
  const targetIso = el.calendarCopySingleDateInput ? el.calendarCopySingleDateInput.value : "";
  if (!String(targetIso).trim()) {
    showToast(t("cal.copyInvalidDate"));
    return;
  }
  const ok = copySingleStaffEntryToDate(
    selectedCalendarDate,
    pendingCopySingleEntryId,
    targetIso
  );
  if (ok && el.calendarCopySingleDialog) el.calendarCopySingleDialog.close();
}
if (el.calendarCopySingleForm) {
  el.calendarCopySingleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitCalendarCopySingle();
  });
}
el.calendarStaffForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const woMode = Boolean(el.calendarWorkOrderMode && el.calendarWorkOrderMode.checked);
  const assignType = el.calendarAssignmentType ? el.calendarAssignmentType.value : "single";
  const isRecurringRule = assignType === "weekly" || assignType === "biweekly" || assignType === "monthly";
  const employeeUsernames = getSelectedCalendarEmployeeUsernames();
  const employeeUsername = employeeUsernames[0] || "";
  const checklistOwnerUsername = employeeUsernames.length > 1
    ? (el.calendarChecklistOwnerSelect ? el.calendarChecklistOwnerSelect.value : "")
    : employeeUsername;
  if (!employeeUsername) {
    showToast(t("toast.pickEmployee"));
    return;
  }
  const managedCal = getManagedEmployeeUsernamesForSession();
  if (managedCal && managedCal.length) {
    const forbidden = employeeUsernames.some((u) => !managedCal.includes(u));
    if (forbidden) {
      showToast(t("toast.managedStaffOnly"));
      return;
    }
  }
  if (!woMode) {
    if (!checklistOwnerUsername) {
      showToast(t("toast.pickChecklistOwner"));
      return;
    }
    if (!employeeUsernames.includes(checklistOwnerUsername)) {
      showToast(t("toast.checklistOwnerInvalid"));
      return;
    }
  }
  if (isRecurringRule && employeeUsernames.length > 1) {
    showToast(t("toast.multiRecurringUnsupported"));
    return;
  }
  const fromTime = el.calendarFromTime.value;
  const toTime = el.calendarToTime.value;
  const customerId = el.calendarCustomerSelect.value;
  const staffComment = el.calendarStaffComment.value.trim();
  const weekdayUi = el.calendarRecurringWeekday ? el.calendarRecurringWeekday.value : "1";
  const weekdayForRule =
    assignType === "monthly"
      ? String(weekdayFromIsoDate(selectedCalendarDate))
      : weekdayUi;
  const anchorForRule = assignType === "biweekly" ? selectedCalendarDate : null;
  let monthlyDayArg = null;
  if (assignType === "monthly") {
    if (activeRecurringRuleId) {
      const edRule = recurringScheduleRules.find((r) => r.id === activeRecurringRuleId);
      monthlyDayArg =
        edRule && edRule.monthlyDay != null ? edRule.monthlyDay : calendarDayNumFromIso(selectedCalendarDate);
    } else {
      monthlyDayArg = calendarDayNumFromIso(selectedCalendarDate);
    }
  }
  const wasEditingRule = Boolean(activeRecurringRuleId);
  const wasEditingSingle = Boolean(activeSingleAssignmentId);

  if (woMode) {
    if (isRecurringRule) {
      showToast(t("toast.woRecurringForbidden"));
      return;
    }
    if (wasEditingRule) {
      showToast(t("toast.woRecurringForbidden"));
      return;
    }
    if ((wasEditingRule || wasEditingSingle) && employeeUsernames.length > 1) {
      showToast(t("toast.checklistOwnerInvalid"));
      return;
    }
    if (!staffComment) {
      showToast(t("toast.woInstructionRequired"));
      return;
    }
    const createdWo = wasEditingSingle
      ? updateSingleWorkOrderStaffEntry(
        activeSingleAssignmentId,
        employeeUsername,
        fromTime,
        toTime,
        customerId,
        staffComment,
        calendarWorkOrderPhotos
      )
      : addWorkOrderEntriesMulti(
        employeeUsernames,
        fromTime,
        toTime,
        customerId,
        staffComment,
        calendarWorkOrderPhotos
      );
    if (createdWo) {
      el.calendarStaffForm.reset();
      resetCalendarStaffFormState();
      syncCalendarStaffFormInitialState();
      renderCalendarCustomerOptions();
      renderCalendarEmployeeOptions();
      calendarPlanningOpen = false;
      el.calendarStaffForm.classList.add("hidden");
      showToast(wasEditingSingle ? t("toast.calUpdatedSingle") : t("toast.woSaved"));
    }
    return;
  }

  const checklistTemplateIds = getSelectedCalendarTemplateIds();
  if (!checklistTemplateIds.length) {
    showToast(t("toast.pickChecklistTpl"));
    return;
  }

  const hausZonesForCalendarSave = getSelectedCalendarHausGartenZones();
  if (checklistTemplateIds.includes(HAUS_CHECKLIST_TEMPLATE_ID) && !hausZonesForCalendarSave.length) {
    showToast(t("toast.hausZonesRequired"));
    return;
  }

  if ((wasEditingRule || wasEditingSingle) && employeeUsernames.length > 1) {
    showToast(t("toast.checklistOwnerInvalid"));
    return;
  }

  const created = isRecurringRule
    ? (wasEditingRule
      ? updateRecurringStaffRule(
        activeRecurringRuleId,
        employeeUsername,
        fromTime,
        toTime,
        customerId,
        staffComment,
        weekdayForRule,
        checklistTemplateIds,
        assignType,
        anchorForRule,
        monthlyDayArg,
        hausZonesForCalendarSave
      )
      : addRecurringStaffRule(
        employeeUsername,
        fromTime,
        toTime,
        customerId,
        staffComment,
        weekdayForRule,
        checklistTemplateIds,
        assignType,
        anchorForRule,
        monthlyDayArg,
        hausZonesForCalendarSave
      ))
    : (wasEditingSingle
      ? updateSingleStaffEntry(activeSingleAssignmentId, employeeUsername, fromTime, toTime, customerId, staffComment, checklistTemplateIds, hausZonesForCalendarSave)
      : addStaffEntriesMulti(
        employeeUsernames,
        checklistOwnerUsername,
        fromTime,
        toTime,
        customerId,
        staffComment,
        checklistTemplateIds,
        hausZonesForCalendarSave
      ));
  if (created) {
    el.calendarStaffForm.reset();
    resetCalendarStaffFormState();
    syncCalendarStaffFormInitialState();
    renderCalendarCustomerOptions();
    renderCalendarEmployeeOptions();
    calendarPlanningOpen = false;
    el.calendarStaffForm.classList.add("hidden");
    showToast(
      wasEditingRule
        ? t("toast.calUpdatedRule")
        : (wasEditingSingle ? t("toast.calUpdatedSingle") : (isRecurringRule ? t("toast.calSavedWeekly") : t("toast.calSavedCombo")))
    );
  }
});
if (el.calendarSort) el.calendarSort.addEventListener("change", renderCalendarStaff);
if (el.calendarEmployeeFilter) el.calendarEmployeeFilter.addEventListener("change", renderCalendarStaff);
if (el.calendarAssignmentType) el.calendarAssignmentType.addEventListener("change", updateCalendarAssignmentTypeUi);
if (el.calendarWorkOrderMode) {
  el.calendarWorkOrderMode.addEventListener("change", () => {
    updateCalendarWorkOrderModeUi();
  });
}
if (el.calendarWorkOrderPhotoInput) {
  el.calendarWorkOrderPhotoInput.addEventListener("change", (ev) => {
    void handleCalendarWorkOrderPhotoPick(ev.target.files).catch((err) => console.error(err));
    ev.target.value = "";
  });
}
if (el.calendarStaffForm && el.calendarWorkOrderPhotoPreview) {
  el.calendarStaffForm.addEventListener("click", (event) => {
    const rm = event.target.closest("[data-calendar-wo-photo-remove]");
    if (!rm || !el.calendarWorkOrderPhotoPreview.contains(rm)) return;
    const idx = Number(rm.getAttribute("data-calendar-wo-photo-remove"));
    if (!Number.isInteger(idx) || idx < 0 || idx >= calendarWorkOrderPhotos.length) return;
    calendarWorkOrderPhotos.splice(idx, 1);
    renderCalendarWorkOrderPhotos();
  });
}
if (el.calendarEmployeeCheckboxes) {
  el.calendarEmployeeCheckboxes.addEventListener("change", () => updateCalendarChecklistOwnerOptions());
}
if (el.calendarStaffCancelButton) el.calendarStaffCancelButton.addEventListener("click", cancelCalendarStaffPlanning);
if (el.calendarNewAssignmentButton) el.calendarNewAssignmentButton.addEventListener("click", () => {
  if (currentRole !== "boss") return;
  calendarPlanningOpen = true;
  el.calendarStaffForm.classList.remove("hidden");
  el.calendarStaffForm.reset();
  resetCalendarStaffFormState();
  renderCalendarCustomerOptions();
  renderCalendarEmployeeOptions([]);
  syncCalendarStaffFormInitialState();
  if (WC && el.calendarStaffForm) WC.applyToScope(el.calendarStaffForm);
  const firstEmpCb = el.calendarEmployeeCheckboxes && el.calendarEmployeeCheckboxes.querySelector('input[type="checkbox"]');
  if (firstEmpCb) firstEmpCb.focus();
});
if (el.customerDbList) {
  el.customerDbList.addEventListener("change", (e) => {
    const target = e.target;
    if (!target || target.tagName !== "SELECT") return;
    const extraMonthId = target.getAttribute("data-extra-month");
    const workMonthId = target.getAttribute("data-work-month");
    if (extraMonthId) {
      customerDbExtraMonthByCustomerId[extraMonthId] = target.value;
      renderCustomerDb(extraMonthId);
      return;
    }
    if (workMonthId) {
      customerDbWorkMonthByCustomerId[workMonthId] = target.value;
      renderCustomerDb(workMonthId);
    }
  });
}
if (el.dbOrientationPhoto) {
  el.dbOrientationPhoto.addEventListener("change", () => {
    const file = el.dbOrientationPhoto.files && el.dbOrientationPhoto.files[0];
    if (!file || !file.type.startsWith("image/")) {
      if (el.dbOrientationPhoto) el.dbOrientationPhoto.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        pendingCustomerOrientationPhoto = await finalizeUploadedChecklistImage(reader.result, file.name);
        renderCustomerOrientationPreviewInDb();
      } catch (err) {
        console.error(err);
        showToast(t("toast.chkSaveFailed"));
      } finally {
        if (el.dbOrientationPhoto) el.dbOrientationPhoto.value = "";
      }
    };
    reader.onerror = () => {
      console.error(reader.error || new Error("FileReader failed"));
      if (el.dbOrientationPhoto) el.dbOrientationPhoto.value = "";
    };
    reader.readAsDataURL(file);
  });
}
if (el.dbOrientationRemove) {
  el.dbOrientationRemove.addEventListener("click", () => {
    pendingCustomerOrientationPhoto = null;
    renderCustomerOrientationPreviewInDb();
  });
}
if (el.dbContractPdf) {
  el.dbContractPdf.addEventListener("change", async () => {
    const file = el.dbContractPdf.files && el.dbContractPdf.files[0];
    if (!file) return;
    pendingCustomerContractPdf = await readCustomerContractPdfFile(file);
    renderCustomerContractStatusInDb();
    if (el.dbContractPdf) el.dbContractPdf.value = "";
  });
}
if (el.dbContractRemove) {
  el.dbContractRemove.addEventListener("click", () => {
    pendingCustomerContractPdf = null;
    if (el.dbContractPdf) el.dbContractPdf.value = "";
    renderCustomerContractStatusInDb();
  });
}
GUIDE_PDF_LANGS.forEach((lang) => {
  const suffix = lang.charAt(0).toUpperCase() + lang.slice(1);
  const input = el[`guidePdf${suffix}`];
  const removeBtn = el[`guidePdf${suffix}Remove`];
  if (input) {
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const uploaded = await readGuidePdfFile(file);
      if (uploaded) pendingGuidePdfs[lang] = uploaded;
      renderGuidePdfStatusInForm(lang);
      input.value = "";
    });
  }
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      pendingGuidePdfs[lang] = null;
      if (input) input.value = "";
      renderGuidePdfStatusInForm(lang);
    });
  }
});
if (el.guideDbForm) {
  el.guideDbForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isFullChefSession()) return;
    const nameDe = el.guideNameDe ? el.guideNameDe.value.trim() : "";
    const nameEn = el.guideNameEn ? el.guideNameEn.value.trim() : "";
    const pdfs = sanitizeGuidePdfs(pendingGuidePdfs);
    if (!guideHasAnyPdf(pdfs)) {
      showToast(t("toast.guidePdfRequired"));
      return;
    }
    if (activeGuideDbId) {
      updateGuideEntry(activeGuideDbId, nameDe, nameEn, pdfs);
      showToast(t("toast.guideUpd"));
    } else {
      addGuideEntry(nameDe, nameEn, pdfs);
      showToast(t("toast.guideAdd"));
    }
    resetGuideDbForm();
  });
}
el.customerDbForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const normalizedAddress = normalizeLocationInput(el.dbAddress.value);
  const normalizedCoordinates = normalizeCoordinatesInput(el.dbCoordinates.value);
  const values = [
    el.dbFirstName.value.trim(),
    el.dbLastName.value.trim(),
    normalizedAddress,
    normalizedCoordinates,
    el.dbProject.value.trim(),
    el.dbEmail.value.trim(),
    el.dbPhone.value.trim(),
    pendingCustomerOrientationPhoto,
    pendingCustomerContractPdf
  ];
  if (activeCustomerDbId) {
    updateCustomerEntry(activeCustomerDbId, ...values);
    showToast(t("toast.custUpd"));
  } else {
    addCustomerEntry(...values);
    showToast(t("toast.custAdd"));
  }
  resetCustomerDbForm();
  renderChecklistCustomerOrientationPhoto();
});
function openChefWorktimeNativePicker() {
  const input = el.worktimePickerFace;
  if (!input) return;
  input.focus({ preventScroll: true });
  try {
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
  } catch (err) {
    /* z. B. nicht unterstützt oder kein User-Gesture */
  }
  const previousPe = input.style.pointerEvents;
  input.style.pointerEvents = "auto";
  input.click();
  requestAnimationFrame(() => {
    input.style.pointerEvents = previousPe || "none";
  });
}

function onWorktimePickerFaceCommitted() {
  const face = el.worktimePickerFace;
  const store = el.worktimeDate;
  if (!face || !store || !face.value || !el.worktimeScope) return;
  const scope = el.worktimeScope.value;
  const [y, month, day] = face.value.split("-").map(Number);
  const picked = new Date(y, month - 1, day);
  if (scope === "day") {
    store.value = face.value;
  } else if (scope === "week") {
    store.value = formatDateAsIsoWeekInput(picked);
  } else {
    store.value = `${picked.getFullYear()}-${String(picked.getMonth() + 1).padStart(2, "0")}`;
  }
  refreshWorktimePeriodDisplay();
  renderWorktimeSummary();
}

if (el.worktimeScope) el.worktimeScope.addEventListener("change", renderWorktimeSummary);
if (el.worktimeSource) el.worktimeSource.addEventListener("change", renderWorktimeSummary);
if (el.worktimePickerFace) {
  el.worktimePickerFace.addEventListener("change", onWorktimePickerFaceCommitted);
}
if (el.worktimePickerHitLayer) {
  el.worktimePickerHitLayer.addEventListener("click", (event) => {
    event.preventDefault();
    openChefWorktimeNativePicker();
  });
  el.worktimePickerHitLayer.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openChefWorktimeNativePicker();
    }
  });
}
if (el.employeeWorkDate) el.employeeWorkDate.addEventListener("change", hydrateEmployeeDailyWorkForm);
if (el.dailyWorkCorrectionForm) el.dailyWorkCorrectionForm.addEventListener("submit", submitEmployeeDailyAttendanceCorrection);
if (el.dailyWorkCorrectionToggle) el.dailyWorkCorrectionToggle.addEventListener("click", toggleDailyCorrectionPanel);
if (el.chefDailyCorrectionsWrap) el.chefDailyCorrectionsWrap.addEventListener("click", handleChefDailyCorrectionClick);
if (el.dayWorkComeButton) el.dayWorkComeButton.addEventListener("click", () => stampDailyAttendance("come"));
if (el.dayWorkBreakStartButton) el.dayWorkBreakStartButton.addEventListener("click", () => stampDailyAttendance("breakStart"));
if (el.dayWorkBreakEndButton) el.dayWorkBreakEndButton.addEventListener("click", () => stampDailyAttendance("breakEnd"));
if (el.dayWorkLeaveButton) el.dayWorkLeaveButton.addEventListener("click", () => stampDailyAttendance("leave"));
if (el.checkpointForm) el.checkpointForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (saveCheckpoint()) {
    resetCheckpointForm();
  }
});
if (el.comeButton) el.comeButton.addEventListener("click", () => setEmployeeTime("come"));
if (el.leaveButton) el.leaveButton.addEventListener("click", () => setEmployeeTime("leave"));
el.moduleTabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveSection(button.dataset.section));
});
el.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login(
    el.loginUsername.value.trim(),
    el.loginPassword.value,
    Boolean(el.loginRemember && el.loginRemember.checked)
  );
});
el.logoutButton.addEventListener("click", logout);

function populateLocaleSelectOptions(sel) {
  if (!sel || !WC) return;
  const cur = WC.getLocale();
  sel.innerHTML = [
    `<option value="de">${escapeHtml(WC.t("lang.optionDe"))}</option>`,
    `<option value="en">${escapeHtml(WC.t("lang.optionEn"))}</option>`
  ].join("");
  sel.value = cur;
}

window.__wcOnLocaleChange = function () {
  if (!WC) return;
  const newLang = WC.intlLang();
  populateLocaleSelectOptions(el.localeSelectAuth);
  populateLocaleSelectOptions(el.localeSelectSidebar);
  bossChecklistFilterSignature = "";
  const prevLang = checkpointFormSyncedUiLang;
  if (prevLang !== null && prevLang !== newLang) {
    syncCheckpointItemLocalesIntoLangSlot(prevLang);
  }
  refreshChecklistFormItemLabels();
  checkpointFormMarkUiLangBaseline();
  const inApp = el.appShell && !el.appShell.classList.contains("hidden");
  if (inApp && currentRole) {
    render();
    refreshWorktimePeriodDisplay();
    hydrateEmployeeDailyCorrectionPanel();
    updateCalendarStaffSubmitButtonLabel();
    if (activeSection === "workOrder") renderWorkOrdersPanel();
    if (activeSection === "guideDb") renderGuideDb();
    if (calendarPlanningOpen && el.calendarWorkOrderMode && el.calendarWorkOrderMode.checked) {
      updateCalendarWorkOrderModeUi();
      renderCalendarWorkOrderPhotos();
    }
  }
};

if (WC) {
  WC.bindLocaleSelectors(el.localeSelectAuth, el.localeSelectSidebar);
}

if (el.workOrdersPanel) {
  el.workOrdersPanel.addEventListener("click", handleWorkOrdersPanelClick);
  el.workOrdersPanel.addEventListener("change", (e) => {
    void handleWorkOrderResultFileInputChange(e);
  });
}
if (el.workOrdersCustomerFilter) {
  el.workOrdersCustomerFilter.addEventListener("input", renderWorkOrdersPanel);
}
if (el.workOrdersProjectFilter) {
  el.workOrdersProjectFilter.addEventListener("input", renderWorkOrdersPanel);
}
if (el.workOrdersEmployeeFilter) {
  el.workOrdersEmployeeFilter.addEventListener("change", renderWorkOrdersPanel);
}
if (el.workOrdersStatusFilter) {
  el.workOrdersStatusFilter.addEventListener("change", renderWorkOrdersPanel);
}

migrateScheduleTemplateIdsInPlace();
pruneOrphanWorkOrderStates();
resetCalendarStaffFormState();
syncCalendarStaffFormInitialState();
resetForm();
resetCustomerDbForm();
resetGuideDbForm();
refreshCheckpointStaffUi();
if (currentSession && users.some((user) => user.username === currentSession.username && user.role === currentSession.role)) {
  el.sessionUser.textContent = `${currentSession.label} (${currentSession.username})`;
  el.authScreen.classList.add("hidden");
  el.appShell.classList.remove("hidden");
  setRole(currentSession.role);
} else {
  persistSession(null);
}

if (WC) {
  populateLocaleSelectOptions(el.localeSelectAuth);
  populateLocaleSelectOptions(el.localeSelectSidebar);
  WC.setUiLocale(WC.getLocale());
}

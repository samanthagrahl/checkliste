/* global window */
(function (global) {
  "use strict";

  var STORAGE_KEY = "werkstattcheck-ui-locale-v1";

  /** @type {Record<string,[string,string]>} jeder Eintrag [Deutsch, Englisch] */
  var PAIRS = {
    "meta.title": ["Immobiliencheck", "Property Check"],
    "auth.title": ["Immobiliencheck Login", "Property check login"],
    "auth.intro": [
      "Melde dich als Chef, Kristina, Patrick, Souhail, Mohammed oder Reinigungspaar an.",
      "Sign in as Chef, Kristina, Patrick, Souhail, Mohammed or Reinigungspaar."
    ],
    "auth.username": ["Benutzername", "Username"],
    "auth.password": ["Passwort", "Password"],
    "auth.placeholderUser": ["chef, kristina, patrick, souhail, mohammed, reinigungspaar", "chef, kristina, patrick, souhail, mohammed, reinigungspaar"],
    "auth.placeholderPass": ["Passwort", "Password"],
    "auth.remember": ["Angemeldet bleiben", "Stay signed in"],
    "auth.submit": ["Anmelden", "Sign in"],
    "auth.hint": ["Zugänge: chef/123, kristina/123, patrick/123, souhail/123, mohammed/123, reinigungspaar/123", "Demo: chef/123, kristina/123, patrick/123, souhail/123, mohammed/123, reinigungspaar/123"],
    "auth.error": ["Login fehlgeschlagen. Bitte Zugangsdaten prüfen.", "Login failed. Please check your credentials."],
    "lang.label": ["Sprache", "Language"],
    "lang.authAria": ["Sprache der Oberfläche", "Interface language"],
    "lang.sidebarAria": ["Sprache der Oberfläche", "Interface language"],
    "lang.optionDe": ["🇩🇪 Deutsch", "🇩🇪 Deutsch"],
    "lang.optionEn": ["🇬🇧 English", "🇬🇧 English"],
    "common.emDash": ["—", "—"],
    "sidebar.brandLine1": ["Immobiliencheck", "Property Check"],
    "sidebar.brandLine2": ["Prüfbericht von Immobilien", "Property inspection reports"],
    "sidebar.loggedInAs": ["Angemeldet als", "Signed in as"],
    "sidebar.logout": ["Abmelden", "Sign out"],
    "nav.aria": ["Bereiche", "Sections"],
    "nav.checklist": ["Checkliste", "Checklist"],
    "nav.workOrder": ["Arbeitsauftrag", "Work order"],
    "nav.customerDb": ["Kundendatenbank", "Customer database"],
    "nav.guideDb": ["Betriebsanleitungen", "Operating manuals"],
    "nav.calendar": ["Kalender", "Calendar"],
    "nav.worktime": ["Arbeitszeiten", "Working hours"],
    "nav.checkpoints": ["Prüfpunkte", "Checkpoints"],
    "stats.drafts": ["Entwürfe", "Drafts"],
    "stats.submitted": ["Zur Prüfung", "For review"],
    "stats.approved": ["Freigegeben", "Approved"],
    "topbar.emailReady": ["E-Mail-Automatik bereit", "Email automation ready"],
    "roles.employee": ["Mitarbeiterbereich", "Employee area"],
    "roles.chef": ["Chefbereich", "Management area"],
    "page.fillChecklist": ["Checkliste ausfüllen", "Fill in checklist"],
    "page.reviewChecklists": ["Checklisten prüfen und freigeben", "Review and approve checklists"],
    "page.worktime": ["Arbeitszeiten", "Working hours"],
    "page.calendarBoss": ["Mitarbeiterverwaltung (Kalender)", "Staff scheduling (calendar)"],
    "page.calendar": ["Kalender", "Calendar"],
    "page.workOrder": ["Arbeitsauftrag", "Work orders"],
    "page.customerDb": ["Kundendatenbank", "Customer database"],
    "page.guideDb": ["Betriebsanleitungen", "Operating manuals"],
    "page.checkpoints": ["Prüfpunkte", "Checkpoints"],
    "chk.tplType": ["Art der Checkliste", "Checklist type"],
    "chk.tplAria": ["Art der Checkliste", "Checklist type"],
    "chk.customer": ["Kunde", "Customer"],
    "chk.customerPh": ["z. B. Familie Schneider", "e.g. Smith family"],
    "chk.customerPhotoHint": ["Orientierungsbild (intern)", "Orientation photo (internal)"],
    "chk.customerPhotoOpenHint": ["Klick zum Öffnen in Originalgröße", "Click to open full size"],
    "chk.customerEmail": ["E-Mail des Kunden", "Customer email"],
    "chk.customerEmailPh": ["für Versand Pflicht wenn nicht im Stammdatensatz", "required for sending if missing in master record"],
    "chk.come": ["Kommen", "Arrival"],
    "chk.leave": ["Gehen", "Departure"],
    "chk.capture": ["Zeit erfassen", "Record time"],
    "chk.pointsHead": ["Prüfpunkte", "Checkpoints"],
    "chk.addPointAria": ["Prüfpunkt hinzufügen", "Add checkpoint"],
    "chk.addPointTitle": ["Prüfpunkt hinzufügen", "Add checkpoint"],
    "chk.extraCosts": ["Zusatzkosten", "Extra costs"],
    "chk.extraEuro": ["Eurobetrag", "Euro amount"],
    "chk.extraEuroPh": ["z. B. 12,50", "e.g. 12.50"],
    "chk.extraComment": ["Kommentar Zusatzkosten", "Extra costs comment"],
    "chk.extraCommentPh": ["Zusatzkosten kurz beschreiben", "Briefly describe extra costs"],
    "chk.extraPhotoHead": ["Bild Zusatzkosten", "Extra costs image"],
    "chk.pickPhotoExtra": ["Bild auswählen", "Choose image"],
    "chk.uploadPhotos": ["Bilder hochladen", "Upload images"],
    "chk.comment": ["Kommentar", "Comment"],
    "chk.commentPh": ["Besonderheiten, Mängel oder Hinweise für den Chef", "Notes, defects or remarks for management"],
    "chk.saveDraft": ["Entwurf speichern", "Save draft"],
    "chk.submit": ["Checkliste einreichen", "Submit checklist"],
    "chk.lockedTitle": ["Checkliste über Kalender starten", "Start checklist from calendar"],
    "chk.lockedP1": ["Neue Checklisten können nur über den Kalender-Einsatz gestartet werden.", "New checklists can only be started from a calendar assignment."],
    "chk.lockedP2": ["Bereits begonnene Checklisten findest du links in „Meine Checklisten“.", "Drafts and started checklists appear on the left under “My checklists”."],
    "chk.myLists": ["Meine Checklisten", "My checklists"],
    "chk.new": ["Neu", "New"],
    "tpl.pointComment": ["Kommentar zum Prüfpunkt", "Checkpoint comment"],
    "tpl.pointCommentPh": ["Optionaler Kommentar...", "Optional comment…"],
    "tpl.pointPhoto": ["Bild zum Prüfpunkt", "Checkpoint image"],
    "tpl.pickPhotoPoint": ["Bild auswählen", "Choose image"],
    "tpl.removePointTitle": ["Prüfpunkt entfernen", "Remove checkpoint"],
    "tpl.removePointAria": ["Prüfpunkt entfernen", "Remove checkpoint"],
    "boss.submittedHeading": ["Eingereichte Checklisten", "Submitted checklists"],
    "boss.filterList": ["Liste eingrenzen", "Narrow down list"],
    "boss.customerCap": ["Kunde", "Customer"],
    "boss.customerPh": ["Namen eingeben …", "Enter name …"],
    "boss.customerAria": ["Nach Kundenname filtern", "Filter by customer name"],
    "boss.projectCap": ["Projekt", "Project"],
    "boss.projectPh": ["Projekt eingeben …", "Enter project …"],
    "boss.projectAria": ["Nach Projekt filtern", "Filter by project"],
    "boss.checklistCap": ["Checkliste", "Checklist"],
    "boss.checklistAria": ["Nach Checkliste filtern", "Filter by checklist"],
    "boss.extraCostsCap": ["Zusatzkosten", "Extra costs"],
    "boss.extraCostsAria": ["Nach Zusatzkosten filtern", "Filter by extra costs"],
    "boss.statusAria": ["Status filtern", "Filter by status"],
    "boss.opt.statusAll": ["Alle Status", "All statuses"],
    "boss.opt.submitted": ["Zur Prüfung", "For review"],
    "boss.opt.approved": ["Freigegeben", "Approved"],
    "boss.opt.draft": ["Entwürfe", "Drafts"],
    "boss.opt.extraAll": ["Alle", "All"],
    "boss.opt.extraYes": ["Ja", "Yes"],
    "boss.opt.extraNo": ["Nein", "No"],
    "boss.allChecklists": ["Alle Checklisten", "All checklists"],
    "review.emptyTitle": ["Checkliste auswählen", "Select a checklist"],
    "review.emptySub": ["Der Bericht, die Bilder und die Freigabe erscheinen hier.", "Report, photos and approval appear here."],
    "cust.heading": ["Kundendatenbank", "Customer database"],
    "cust.phFirst": ["Vorname", "First name"],
    "cust.phLast": ["Nachname", "Last name"],
    "cust.phAddr": ["Adresse", "Address"],
    "cust.phCoords": ["Koordinaten (lat, lng) optional", "Coordinates (lat, lng), optional"],
    "cust.phProject": ["Projekt", "Project"],
    "cust.phEmail": ["E-Mailadresse", "Email address"],
    "cust.phPhone": ["Telefonnummer", "Phone number"],
    "cust.photoLbl": ["Orientierungsbild (intern, 1 Bild)", "Orientation photo (internal, 1 image)"],
    "cust.photoRemove": ["Bild entfernen", "Remove image"],
    "cust.contractLbl": ["Kundenvertrag (PDF)", "Customer contract (PDF)"],
    "cust.contractRemove": ["PDF entfernen", "Remove PDF"],
    "cust.contractDownload": ["Kundenvertrag", "Customer contract"],
    "cust.contractStored": ["PDF hinterlegt:", "PDF on file:"],
    "cust.detailsCp": ["Prüfpunkte je Checkliste", "Checkpoints per checklist"],
    "cust.cpTplLabel": ["Checkliste", "Checklist"],
    "cust.cpTplAria": ["Checkliste für Prüfpunkte", "Checklist for checkpoints"],
    "cust.save": ["Kunde speichern", "Save customer"],
    "cust.empty": ["Noch keine Kunden erfasst.", "No customers yet."],
    "cust.noCpChosen": ["Keine Prüfpunkte gewählt.", "No checkpoints selected."],
    "cust.noCpMaintained": ["Keine Prüfpunkte gepflegt.", "No checkpoints maintained."],
    "cust.coordsPrefix": ["Koordinaten:", "Coordinates:"],
    "cust.emailTel": ["E-Mail:", "Email:"],
    "cust.telSep": [" · Tel:", " · Tel:"],
    "cust.historyTitle": ["Historie freigegebene Checklisten", "History of approved checklists"],
    "cust.historyEmpty": ["Noch keine freigegebene Checkliste vorhanden.", "No approved checklist yet."],
    "cust.open": ["Öffnen", "Open"],
    "cust.maps": ["In Maps öffnen", "Open in Maps"],
    "cust.checkpoints": ["Prüfpunkte", "Checkpoints"],
    "cust.checkpointsHide": ["Prüfpunkte ausblenden", "Hide checkpoints"],
    "cust.edit": ["Kunde bearbeiten", "Edit customer"],
    "cust.deactivate": ["Inaktiv", "Deactivate"],
    "cust.reactivate": ["Reaktivieren", "Reactivate"],
    "cust.statusActive": ["Aktiv", "Active"],
    "cust.statusInactive": ["Inaktiv", "Inactive"],
    "cust.delete": ["Löschen", "Delete"],
    "guide.heading": ["Betriebsanleitungen", "Operating manuals"],
    "guide.intro": [
      "Betriebsanleitungen als PDF – für Mitarbeitende jederzeit abrufbar.",
      "Operating instructions as PDF – available to staff at any time."
    ],
    "guide.phNameDe": ["Bezeichnung (Deutsch)", "Title (German)"],
    "guide.phNameEn": ["Bezeichnung (Englisch)", "Title (English)"],
    "guide.pdfDe": ["PDF Deutsch", "PDF German"],
    "guide.pdfEn": ["PDF Englisch", "PDF English"],
    "guide.pdfEs": ["PDF Spanisch", "PDF Spanish"],
    "guide.pdfRemove": ["PDF entfernen", "Remove PDF"],
    "guide.pdfStored": ["PDF hinterlegt:", "PDF on file:"],
    "guide.save": ["Anleitung speichern", "Save instruction"],
    "guide.saveUpdate": ["Anleitung aktualisieren", "Update instruction"],
    "guide.empty": ["Noch keine Anleitungen hinterlegt.", "No instructions yet."],
    "guide.namesSub": ["DE: {de} · EN: {en}", "DE: {de} · EN: {en}"],
    "guide.downloadDe": ["PDF DE", "PDF DE"],
    "guide.downloadEn": ["PDF EN", "PDF EN"],
    "guide.downloadEs": ["PDF ES", "PDF ES"],
    "guide.edit": ["Bearbeiten", "Edit"],
    "guide.delete": ["Löschen", "Delete"],
    "guide.noPdf": ["Kein PDF für diese Sprache.", "No PDF for this language."],
    "cust.extraMonthFilterAria": ["Monat für Zusatzkosten filtern", "Filter month for extra costs"],
    "cust.extraMonthAll": ["Alle Monate", "All months"],
    "cust.extraLedgerTitle": ["Zusatzkosten (summiert je Einreichung)", "Extra costs (one line per submission)"],
    "cust.extraLedgerEmpty": ["Keine Einträge für diese Auswahl.", "No entries for this selection."],
    "cust.extraSum": ["Summe:", "Total:"],
    "cust.extraColMonth": ["Monat", "Month"],
    "cust.extraColRecorded": ["Erfasst am", "Recorded"],
    "cust.extraColAmount": ["Betrag", "Amount"],
    "cust.extraColChecklist": ["Checkliste / Vorgang", "Checklist / job"],
    "cust.extraColNote": ["Kommentar", "Comment"],
    "cust.workTimeTitle": ["Netto-Arbeitszeit (Checklisten & Arbeitsaufträge)", "Net working time (checklists & work orders)"],
    "cust.workMonthFilterAria": ["Monat für Arbeitszeit filtern", "Filter month for working time"],
    "cust.workTimeEmpty": ["Keine Zeitstempel für diese Auswahl.", "No time stamps for this selection."],
    "cust.workColDate": ["Einsatzdatum", "Assignment date"],
    "cust.workColSource": ["Quelle", "Source"],
    "cust.workColEmployee": ["Mitarbeiter", "Employee"],
    "cust.workColDetail": ["Vorgang", "Job"],
    "cust.workColNet": ["Netto", "Net"],
    "cust.workSourceChecklist": ["Checkliste", "Checklist"],
    "cust.workSourceWorkOrder": ["Arbeitsauftrag", "Work order"],
    "cust.workSumTotal": ["Summe netto:", "Net total:"],
    "cust.workSumChecklist": ["Checklisten", "Checklists"],
    "cust.workSumWorkOrder": ["Arbeitsaufträge", "Work orders"],
    "cal.heading": ["Mitarbeiterverwaltung (Kalender)", "Staff scheduling (calendar)"],
    "cal.assignments": ["Einsätze am {date}", "Assignments on {date}"],
    "cal.sortAria": ["Einsätze sortieren", "Sort assignments"],
    "cal.opt.timeAsc": ["Sortierung: Uhrzeit aufsteigend", "Sort: time ascending"],
    "cal.opt.timeDesc": ["Sortierung: Uhrzeit absteigend", "Sort: time descending"],
    "cal.opt.empAsc": ["Sortierung: Mitarbeiter A–Z", "Sort: staff A–Z"],
    "cal.filterEmpAria": ["Nach Mitarbeiter filtern", "Filter by staff"],
    "cal.allStaff": ["Mitarbeiter: Alle", "All staff"],
    "cal.staffPrefix": ["Mitarbeiter:", "Staff:"],
    "cal.newAssignment": ["Neuer Einsatz", "New assignment"],
    "cal.assignKindLbl": ["Einsatzart", "Assignment type"],
    "cal.weekRuleDayLbl": ["Wochentag (Regel)", "Weekday (rule)"],
    "cal.timeRangeLbl": ["Uhrzeit", "Time"],
    "cal.fromTimeAria": ["Beginn des Einsatzes", "Assignment start"],
    "cal.toTimeAria": ["Ende des Einsatzes", "Assignment end"],
    "cal.customerFieldLbl": ["Kunde", "Customer"],
    "cal.chkTplLbl": ["Checkliste", "Checklist"],
    "cal.hausZonesLbl": ["Bereiche (nur Haus & Garten)", "Areas (Haus & Garten only)"],
    "cal.hausZonesHint": [
      "Nur Prüfpunkte der gewählten Bereiche erscheinen in der Checkliste des Mitarbeiters.",
      "Only checkpoints in the selected areas appear on the employee checklist."
    ],
    "cal.commentFieldLbl": ["Kommentar", "Comment"],
    "cal.checklistOwnerExpl": ["Nur dieser Mitarbeiter sieht „Checkliste“ und kann sie starten.", "Only this staff member sees “Checklist” and can launch it."],
    "cal.optSingle": ["Einmaliger Einsatz", "One-off assignment"],
    "cal.optWeekly": ["Wöchentliche Regel", "Weekly rule"],
    "cal.optBiweekly": ["14-tägige Regel", "Every 14 days"],
    "cal.optMonthly": ["Monatliche Regel", "Monthly rule"],
    "cal.weekdayAria": ["Wochentag für Regel", "Weekday for rule"],
    "cal.pickStaff": ["Mitarbeiter wählen", "Choose staff"],
    "cal.pickStaffMultiLbl": ["Mitarbeiter auswählen", "Select employees"],
    "cal.pickStaffMultiAria": ["Mitarbeiter für Einsatz auswählen", "Select employees for assignment"],
    "cal.checklistOwnerLbl": ["Checkliste bekommt", "Checklist owner"],
    "cal.checklistOwnerAria": ["Mitarbeiter für Checkliste auswählen", "Select employee for checklist"],
    "cal.pickChecklistOwner": ["Mitarbeiter für Checkliste wählen", "Choose checklist owner"],
    "cal.checklistOwnerInfo": ["Checkliste: {name}", "Checklist: {name}"],
    "cal.pickCustomer": ["Kunde auswählen", "Choose customer"],
    "cal.checklistAria": ["Checkliste für Einsatz", "Checklist for assignment"],
    "cal.btnTplStart": ["Checkliste: {name} starten", "Start checklist: {name}"],
    "cal.btnTplContinue": ["Checkliste: {name} fortsetzen", "Continue checklist: {name}"],
    "cal.btnTplDone": ["Checkliste: {name} erledigt", "Checklist done: {name}"],
    "cal.btnTplPending": ["Checkliste: {name} eingereicht", "Checklist submitted: {name}"],
    "cal.staffCommentPh": ["Kommentar für Mitarbeiter (optional)", "Note for staff (optional)"],
    "cal.add": ["Hinzufügen", "Add"],
    "cal.cancel": ["Abbrechen", "Cancel"],
    "cal.save": ["Speichern", "Save"],
    "cal.discardUnsaved": ["Ungespeicherte Änderungen verwerfen?", "Discard unsaved changes?"],
    "cal.loadLabelFull": ["voll", "full"],
    "cal.loadTooltipFull": ["Voll bei {n} Terminen", "Full: {n} appointments"],
    "cal.loadTooltipPts": ["{pts} Punkte bei {n} Terminen", "{pts} point(s), {n} appointments"],
    "weekday.0": ["Sonntag", "Sunday"],
    "weekday.1": ["Montag", "Monday"],
    "weekday.2": ["Dienstag", "Tuesday"],
    "weekday.3": ["Mittwoch", "Wednesday"],
    "weekday.4": ["Donnerstag", "Thursday"],
    "weekday.5": ["Freitag", "Friday"],
    "weekday.6": ["Samstag", "Saturday"],
    "wt.dailyTitle": ["Tagesarbeitszeit", "Daily working time"],
    "wt.date": ["Datum", "Date"],
    "wt.dateAria": ["Datum für Arbeitszeiten", "Date for working hours"],
    "wt.overviewHint": [
      "Zeiten können nur am heutigen Tag erfasst werden. Andere Tage dienen nur der Übersicht.",
      "Times can only be recorded on today’s date. Other dates are for overview only."
    ],
    "wt.come": ["Kommen", "Arrival"],
    "wt.leave": ["Gehen", "Departure"],
    "wt.capture": ["Zeit erfassen", "Record time"],
    "wt.pause": ["Pause", "Break"],
    "wt.pauseStart": ["Pause Start", "Break start"],
    "wt.pauseEnd": ["Pause Ende", "Break end"],
    "wt.startDisp": ["Start:", "Start:"],
    "wt.endDisp": ["Ende:", "End:"],
    "dc.toggleOpen": ["Zeit korrigieren", "Correct time"],
    "dc.toggleClose": ["Schließen", "Close"],
    "dc.togglePending": ["Korrektur ausstehend", "Correction pending"],
    "dc.togglePendingTitle": ["Solange eine Korrektur auf Freigabe wartet, können Sie das Formular nicht öffnen.", "You cannot open the form while a correction is awaiting approval."],
    "dc.title": ["Zeiten korrigieren", "Correct times"],
    "dc.intro": ["Neue Uhrzeiten gelten erst nach Freigabe durch den Chef.", "New times apply only after approval by management."],
    "dc.legend": ["Korrekturvorschlag", "Correction proposal"],
    "dc.sugCome": ["Vorschlag Kommen", "Proposed arrival"],
    "dc.sugLeave": ["Vorschlag Gehen", "Proposed departure"],
    "dc.sugPauseS": ["Vorschlag Pause Start", "Proposed break start"],
    "dc.sugPauseE": ["Vorschlag Pause Ende", "Proposed break end"],
    "dc.comment": ["Kommentar", "Comment"],
    "dc.commentPh": ["Kurz begründen, warum die Zeiten angepasst werden", "Briefly explain why times should be adjusted"],
    "dc.commentAria": ["Kommentar für den Chef (Pflichtfeld)", "Comment for management (required)"],
    "dc.submit": ["Zur Freigabe senden", "Send for approval"],
    "dc.pendingBanner": [
      "Der Chef muss diese Änderung noch freigeben. Die angezeigten Zeiten bleiben bis dahin gültig.",
      "Management must still approve this change. Displayed times remain valid until then."
    ],
    "dc.rejectedIntro": ["Der letzte Korrekturvorschlag wurde abgelehnt.", "The last correction request was rejected."],
    "dc.rejectedReason": ["Ablehngrund: {note}", "Reason: {note}"],
    "dc.rejectedFoot": [
      "Über „Zeit korrigieren“ können Sie einen neuen Vorschlag senden.",
      "Use “Correct time” to send a new proposal."
    ],
    "wt.panelTitle": ["Arbeitszeiten", "Working hours"],
    "wt.scopeAria": ["Zeitraum", "Period"],
    "wt.opt.day": ["Tag", "Day"],
    "wt.opt.week": ["Woche", "Week"],
    "wt.opt.month": ["Monat", "Month"],
    "wt.sourceAria": ["Quelle der Zeiten", "Time source"],
    "wt.opt.sourceDaily": ["Tagesarbeitszeit", "Daily time tracking"],
    "wt.opt.sourceCl": ["Checkliste (am Kunden)", "Checklist (on site)"],
    "wt.opt.sourceWo": ["Arbeitsaufträge", "Work orders"],
    "wt.pickerAria": ["Kalender öffnen, Zeitraum wählen", "Open calendar, choose period"],
    "wt.captionDaily": [
      "Auswertung: freie Tageserfassung unter „Arbeitszeiten“ (Kommen bis Gehen, Pause abgezogen).",
      "Reporting: daily capture under Working hours (arrival to departure, break deducted)."
    ],
    "wt.captionCl": [
      "Auswertung: Kommen- und Gehen-Zeiten aus den Checklisten pro Kunde/Einsatz (Datum der Checklistenerstellung im gewählten Zeitraum).",
      "Reporting: arrival and departure times from checklists per customer/job (checklist creation date in the selected period)."
    ],
    "wt.captionWo": [
      "Auswertung: Kommen- und Gehen-Zeiten aus Arbeitsaufträgen pro Mitarbeiter (Kalenderdatum des Arbeitsauftrags im gewählten Zeitraum).",
      "Reporting: arrival and departure times from work orders per employee (work-order calendar date within the selected period)."
    ],
    "wt.corrHeading": ["Ausstehende Zeitkorrekturen", "Pending time corrections"],
    "wt.corrHelp": [
      "Alle Korrekturvorschläge warten auf Freigabe. Die Summen darunter nutzen weiterhin nur freigegebene Zeiten.",
      "All pending staff proposals. Totals below still use approved entries."
    ],
    "wt.corrEmpty": ["Keine ausstehenden Korrekturen.", "No pending corrections."],
    "wt.totalLabel": ["Gesamtzeit:", "Total:"],
    "wt.weekLabel": ["KW {w} · {y}", "CW {w} · {y}"],
    "cp.heading": ["Prüfpunkte", "Checkpoints"],
    "cp.manageTpl": ["Checkliste bearbeiten", "Edit checklist"],
    "cp.manageTplAria": ["Checkliste für Prüfpunkte", "Checklist for checkpoints"],
    "cp.allowAll": ["Allen Mitarbeitern diese Checkliste erlauben", "Allow this checklist for all staff"],
    "cp.restrictHint": ["Sonst hier freischalten (mehrere möglich):", "Otherwise enable here (multiple):"],
    "cp.namePh": ["Neuen Prüfpunkt eingeben", "Enter new checkpoint"],
    "cp.fieldDeLbl": ["Deutsch", "German"],
    "cp.fieldEnLbl": ["Englisch", "English"],
    "cp.nameDePh": ["Bezeichnung (Deutsch)", "Label (German)"],
    "cp.nameEnPh": ["Bezeichnung (Englisch)", "Label (English)"],
    "cp.saveNew": ["Prüfpunkt speichern", "Save checkpoint"],
    "cp.update": ["Prüfpunkt aktualisieren", "Update checkpoint"],
    "cp.empty": ["Noch keine Prüfpunkte vorhanden.", "No checkpoints yet."],
    "cp.edit": ["Bearbeiten", "Edit"],
    "cp.delete": ["Löschen", "Delete"],
    "cp.zoneLbl": ["Bereich (nur Haus & Garten)", "Area (Haus & Garten only)"],
    "cp.zoneAria": ["Bereich für den Prüfpunkt", "Checkpoint area"],
    "zone.general": ["Allgemein", "General"],
    "zone.pool": ["Pool", "Pool"],
    "zone.z1": ["Zone 1", "Zone 1"],
    "zone.z2": ["Zone 2", "Zone 2"],
    "zone.z3": ["Zone 3", "Zone 3"],
    "zone.z4": ["Zone 4", "Zone 4"],
    "zone.other": ["Sonstige", "Other"],
    "status.draft": ["Entwurf", "Draft"],
    "status.submitted": ["Zur Prüfung", "For review"],
    "status.approved": ["Freigegeben", "Approved"],
    "sub.emptyTitle": ["Keine Einträge", "No entries"],
    "sub.emptySub": ["Hier erscheinen gespeicherte oder eingereichte Checklisten.", "Saved or submitted checklists appear here."],
    "sub.erledigt": ["erledigt", "done"],
    "sub.images": ["Bilder", "Images"],
    "sub.extraLbl": ["Zusatzkosten:", "Extra costs:"],
    "sub.tplFallback": ["Checkliste", "Checklist"],
    "sub.employeeDefault": ["Mitarbeiter", "Employee"],
    "email.sentReport": ["Bericht an {email} gesendet", "Report sent to {email}"],
    "email.pointsDone": ["{done}/{total} Prüfpunkte erledigt", "{done}/{total} checkpoints completed"],
    "review.emailSentPrefix": ["E-Mail gesendet:", "Email sent:"],
    "review.notSentYet": ["Noch nicht gesendet", "Not sent yet"],
    "review.pickTitle": ["Checkliste auswählen", "Select a checklist"],
    "review.pickBody": [
      "Der Bericht, die Bilder und die Freigabe erscheinen hier.",
      "The report, photos, and approval actions appear here."
    ],
    "review.lbl.customer": ["Kunde", "Customer"],
    "review.lbl.email": ["E-Mail", "Email"],
    "review.lbl.employee": ["Mitarbeiter", "Staff"],
    "review.lbl.checklist": ["Checkliste", "Checklist"],
    "review.lbl.submitted": ["Eingereicht", "Submitted"],
    "review.pointsTitle": ["Prüfpunkte ({label})", "Checkpoints ({label})"],
    "review.itemCommentLbl": ["Kommentar:", "Comment:"],
    "review.moreInfo": ["Kommentar Mitarbeiter", "Employee comment"],
    "review.extraHeading": ["Zusatzkosten (nur intern)", "Extra costs (internal only)"],
    "review.extraNoComment": ["Kein Kommentar angegeben.", "No comment provided."],
    "review.extraDl": ["Bild herunterladen", "Download image"],
    "review.extraNoPhoto": ["Kein Bild hinterlegt.", "No image attached."],
    "review.extraEuroLbl": ["Eurobetrag:", "Euro amount:"],
    "review.bossComment": ["Kommentar Chef", "Management comment"],
    "review.customerReport": ["Kundenbericht", "Customer report"],
    "review.customerReportToggleHint": ["Kundenbericht ein- oder ausklappen", "Expand or collapse customer report"],
    "review.mailDraft": ["E-Mail-Entwurf öffnen", "Open email draft"],
    "review.reopen": ["Erneut prüfen", "Review again"],
    "review.approve": ["Freigeben und Bericht senden", "Approve and send report"],
    "review.downloadPdf": ["PDF Bericht laden", "Download PDF report"],
    "review.downloadPdfAria": ["Kundenbericht als PDF herunterladen", "Download customer report as PDF"],
    "review.approveBusy": ["Bitte warten …", "Please wait …"],
    "review.delete": ["Löschen", "Delete"],
    "report.mailTitle": ["E-Mail-Entwurf", "Email draft"],
    "report.mailTo": ["An:", "To:"],
    "report.mailSubject": ["Betreff:", "Subject:"],
    "report.mailOpenBtn": ["E-Mail-App öffnen", "Open mail app"],
    "report.subjectPrefix": ["Bericht:", "Report:"],
    "report.pdfPrefix": ["Bericht", "Report"],
    "report.shareText": ["Prüfbericht (PDF) im Anhang.", "Inspection report attached (PDF)."],
    "report.pdfHintAttach": [
      "Das PDF zum Kundenbericht liegt in Ihrem Download-Ordner. Bitte in der E-Mail-App als Anhang einfügen.",
      "The customer report PDF was saved to your downloads folder. Please attach the file in your mail app."
    ],
    "report.contract.brand": ["SWIDERSKI PROPERTY MANAGEMENT", "SWIDERSKI PROPERTY MANAGEMENT"],
    "report.contract.title": ["DIENSTLEISTUNGSBERICHT", "SERVICE REPORT"],
    "report.contract.providerHead": ["DIENSTLEISTER", "SERVICE PROVIDER"],
    "report.contract.clientHead": ["AUFTRAGGEBER", "CLIENT"],
    "report.contract.providerName": ["Swiderski Property Management S.L.", "Swiderski Property Management S.L."],
    "report.contract.providerEmail": ["patrick@swiderskipropertymanagement.com", "patrick@swiderskipropertymanagement.com"],
    "report.contract.providerPhone": ["+34 601 993 375", "+34 601 993 375"],
    "report.contract.performedOn": [
      "Dieser Bericht dokumentiert die ausgeführte Leistung am {date}.",
      "This report documents the service performed on {date}."
    ],
    "report.contract.sectionCustomerReport": ["KUNDENBERICHT", "CUSTOMER REPORT"],
    "report.contract.sectionScope": ["LEISTUNGSUMFANG", "SCOPE OF SERVICES"],
    "report.contract.sectionNotes": ["WEITERE HINWEISE", "ADDITIONAL NOTES"],
    "report.contract.imagesOnNextPages": ["Abbildungen siehe Folgeseiten.", "See following pages for images."],
    "report.contract.imagesTitle": ["BILDER", "IMAGES"],
    "preview.greeting": ["Guten Tag {name},", "Hello {name},"],
    "preview.introP1": [
      "Im Rahmen Ihres Auftrags waren wir vor Ort in Ihrer Immobilie und haben den vereinbarten Immobiliencheck durchgeführt.",
      "As part of your assignment we were on site at your property and carried out the agreed property inspection."
    ],
    "preview.introP2": [
      "Dabei haben wir verschiedene Punkte kontrolliert und – soweit erforderlich – direkt bearbeitet, damit Ihre Immobilie weiterhin gepflegt, funktionsfähig und in einem einwandfreien Zustand bleibt.",
      "We inspected various checkpoints and, where necessary, addressed them straight away so your property stays well maintained, fully functional and in excellent condition."
    ],
    "preview.introP3": [
      "Bei Fragen oder ergänzenden Wünschen stehen wir Ihnen jederzeit gerne zur Verfügung.",
      "If you have any questions or additional requests, we will be happy to assist you at any time."
    ],
    "preview.summary": [
      "Ergebnis: {done} von {total} Prüfpunkten erledigt, {open} offen.",
      "Result: {done} of {total} checkpoints completed, {open} open."
    ],
    "preview.cpHeading": ["Prüfpunkte:", "Checkpoints:"],
    "preview.itemComment": [" - Kommentar: {t}", " - Comment: {t}"],
    "preview.bossC": ["Anmerkung zum Check: {t}", "Note on the check: {t}"],
    "preview.team": ["Mit Herz und Hand - Ihre Familie Swiderski", "With heart and hand — Your Swiderski family"],
    "preview.htmlPoints": ["Prüfpunkte", "Checkpoints"],
    "preview.htmlBossLbl": ["Anmerkung zum Check:", "Note on the check:"],
    "preview.htmlNoComment": ["Kein Kommentar angegeben.", "No comment provided."],
    "img.altCp": ["Prüfpunkt-Bild", "Checkpoint image"],
    "item.removeImgAria": ["Prüfpunkt-Bild entfernen", "Remove checkpoint image"],
    "extra.removeAria": ["Zusatzkosten-Bild entfernen", "Remove extra-costs image"],
    "cal.noStaffPlan": ["Keine Mitarbeiter geplant.", "No staff scheduled."],
    "cal.customerMissing": ["Kunde nicht gesetzt", "Customer not set"],
    "cal.mapsOpen": ["In Maps öffnen", "Open in Maps"],
    "cal.chkLbl": ["Checkliste:", "Checklist:"],
    "wo.title": ["Arbeitsaufträge", "Work orders"],
    "wo.empty": ["Keine Arbeitsaufträge vorhanden.", "No work orders yet."],
    "wo.statusSubmitted": ["Eingereicht", "Submitted"],
    "wo.statusInProgress": ["In Arbeit", "In progress"],
    "wo.statusDone": ["Abgeschlossen", "Completed"],
    "wo.nameLbl": ["Kunde / Objekt:", "Customer / property:"],
    "wo.addrLbl": ["Adresse:", "Address:"],
    "wo.instrLbl": ["Anweisung:", "Instruction:"],
    "wo.empLbl": ["Mitarbeiter:", "Employee:"],
    "wo.btnSetInProgress": ["In Arbeit setzen", "Set in progress"],
    "wo.btnSetDone": ["Als abgeschlossen markieren", "Mark completed"],
    "wo.allDone": ["Dieser Auftrag ist abgeschlossen.", "This work order is completed."],
    "wo.toastInProgress": ["Status: In Arbeit.", "Status: In progress."],
    "wo.toastDone": ["Status: Abgeschlossen.", "Status: Completed."],
    "wo.toastReportSent": ["Kundenbericht wurde versendet.", "Customer report was sent."],
    "wo.reportTypeLabel": ["Arbeitsauftrag", "Work order"],
    "wo.reportTitleFallback": ["Arbeitsauftrag", "Work order"],
    "wo.reportScopeTitle": ["Ausgeführte Leistung", "Work performed"],
    "wo.reportScopeInstr": ["Anweisung: {text}", "Instruction: {text}"],
    "wo.reportScopeReply": ["Mitarbeiter-Kommentar: {text}", "Staff comment: {text}"],
    "wo.reportScopeCome": ["Kommen: {time}", "Arrival: {time}"],
    "wo.reportScopeLeave": ["Gehen: {time}", "Departure: {time}"],
    "wo.resendReport": ["Bericht erneut senden", "Resend report"],
    "toast.woDeleted": ["Arbeitsauftrag wurde gelöscht.", "Work order deleted."],
    "wo.detailEmptySub": [
      "Anweisungen, Bilder, Kommentare und Kundenbericht erscheinen hier.",
      "Instructions, images, comments and the customer report appear here."
    ],
    "wo.calRowType": ["Arbeitsauftrag (ohne Checkliste)", "Work order (no checklist)"],
    "wo.calBtnOpen": ["Arbeitsauftrag öffnen", "Open work order"],
    "wo.calBtnResume": ["Arbeitsauftrag fortsetzen", "Continue work order"],
    "wo.calBtnClosed": ["Arbeitsauftrag erledigt", "Work order done"],
    "wo.tabOpenedHint": ["Reiter „Arbeitsauftrag“ zeigt Details.", "See the “Work orders” tab for details."],
    "wo.useWorkOrderTab": ["Bitte den Arbeitsauftrag im entsprechenden Reiter öffnen.", "Please open this job in the Work orders tab."],
    "wo.calModeLbl": ["Arbeitsauftrag", "Work order"],
    "wo.calModeHint": [
      "Ohne Checkliste/Prüfpunkte – nur Anweisung im Reiter „Arbeitsauftrag“.",
      "Without checklist/checkpoints—instruction only in “Work orders”."
    ],
    "wo.calInstructionLbl": ["Arbeitsanweisung für Mitarbeiter", "Work instruction for staff"],
    "wo.calInstructionPh": [
      "Kurze Arbeitsanweisung für die zugewiesenen Mitarbeiter (Pflichtfeld)",
      "Short work instruction for assigned staff (required)"
    ],
    "toast.woInstructionRequired": ["Bitte eine Arbeitsanweisung im Kommentarfeld eintragen.", "Please enter a work instruction in the comment field."],
    "toast.woRecurringForbidden": [
      "Arbeitsaufträge sind nur als einmaliger Einsatz möglich.",
      "Work orders are only available as one-off assignments."
    ],
    "toast.woSaved": ["Arbeitsauftrag gespeichert.", "Work order saved."],
    "wo.filterAll": ["Alle Kunden", "All customers"],
    "wo.filterList": ["Liste eingrenzen", "Narrow list"],
    "wo.optStatusAll": ["Alle Status", "All statuses"],
    "wo.statusFilterAria": ["Arbeitsaufträge nach Status filtern", "Filter work orders by status"],
    "wo.detailEmptyTitle": ["Arbeitsauftrag auswählen", "Select a work order"],
    "wo.filterEmpLbl": ["Mitarbeiter", "Staff"],
    "wo.filterEmpAria": ["Arbeitsaufträge nach Mitarbeitern filtern", "Filter work orders by staff member"],
    "wo.emptyTitleShort": ["Keine Aufträge", "No work orders"],
    "wo.noHitsTitleShort": ["Keine Treffer", "No matches"],
    "wo.filterNoHits": ["Keine Arbeitsaufträge für diese Auswahl.", "No work orders for this filter."],
    "wo.filterCustLbl": ["Kunde filtern", "Filter by customer"],
    "wo.filterCustAria": ["Arbeitsaufträge nach Kunde filtern", "Filter work orders by customer"],
    "wo.filterCustPh": ["Namen eingeben …", "Enter name …"],
    "wo.chefSendBack": ["Zurück an Mitarbeiter", "Send back to staff"],
    "wo.toastChefSentBack": ["Arbeitsauftrag wurde zur Nachbearbeitung zurückgegeben.", "Work order sent back for follow-up."],
    "wo.resultPhotosLbl": ["Endergebnis — Bilder vom Mitarbeiter", "Result images from staff"],
    "wo.resultPhotosOptional": ["optional, max. 5", "optional, max. 5"],
    "wo.maxResultPhotos": ["Es sind maximal fünf Endergebnis-Bilder möglich.", "A maximum of five result images is allowed."],
    "wo.resultPhotoPdfLbl": ["Endergebnis {n}", "Result {n}"],
    "wo.closingReport": ["Abschlussbericht an Kunde", "Closing report to customer"],
    "wo.reportScopeEmpty": ["Kein Abschlussbericht hinterlegt.", "No closing report provided."],
    "wo.reportIntroP1": [
      "Im Rahmen Ihres Auftrags waren wir vor Ort in Ihrer Immobilie und haben den vereinbarten Arbeitsauftrag durchgeführt.",
      "As part of your assignment we were on site at your property and carried out the agreed work order."
    ],
    "wo.reportIntroP2": [
      "Die genauen Details der Durchführung können Sie dem unten aufgeführtem Leistungsumfang entnehmen, damit Ihre Immobilie weiterhin gepflegt, funktionsfähig und in einem einwandfreien Zustand bleibt.",
      "You will find the full details of what was done in the scope of services listed below, so your property remains well maintained, fully functional and in excellent condition."
    ],
    "wo.reportIntroP3": [
      "Bei Fragen oder ergänzenden Wünschen stehen wir Ihnen jederzeit gerne zur Verfügung.",
      "If you have any questions or additional requests, we will be happy to assist you at any time."
    ],
    "wo.pickResultPhotos": ["Endergebnis-Bilder wählen", "Pick result photos"],
    "wo.chefPhotosLbl": ["Bilder vom Chef", "Images from manager"],
    "wo.calPhotosLbl": ["Bilder für Mitarbeiter (max. 3)", "Images for staff (max. 3)"],
    "wo.photoHintCount": ["{cur} von {max} Bildern", "{cur} of {max} images"],
    "wo.removePhoto": ["Bild entfernen", "Remove image"],
    "wo.maxPhotos": ["Es sind maximal drei Bilder möglich.", "A maximum of three images is allowed."],
    "wo.replyLbl": ["Kommentar Mitarbeiter", "Staff comment"],
    "wo.replyLblEmployee": ["Kommentar zum Auftrag", "Comment on the work order"],
    "wo.saveReply": ["Kommentar speichern", "Save comment"],
    "wo.replySaved": ["Kommentar gespeichert.", "Comment saved."],
    "wo.timeDocLbl": ["Zeitdokumentation (nur Auftrag)", "Time log (work order only)"],
    "wo.comeLbl": ["Kommen:", "Come:"],
    "wo.leaveLbl": ["Gehen:", "Leave:"],
    "wo.captureCome": ["Kommen erfassen", "Capture come"],
    "wo.captureLeave": ["Gehen erfassen", "Capture leave"],
    "wo.toastComeCaptured": ["Kommen-Zeit erfasst.", "Come time captured."],
    "wo.toastLeaveCaptured": ["Gehen-Zeit erfasst.", "Leave time captured."],
    "cal.ruleWeeklyLbl": ["Regel: Wöchentlich", "Rule: Weekly"],
    "cal.ruleBiweeklyLbl": ["Regel: 14-tägig", "Rule: Biweekly"],
    "cal.ruleMonthlyLbl": ["Regel: Monatlich", "Rule: Monthly"],
    "cal.monthlyDomHint": [
      "Wiederkehrt jeden Monat am {day}. (Der Kalendertag ist der aktuell markierte Tag bei „Speichern“.)",
      "Repeats on the {day} of each month. (The calendar day is the date selected when you save.)"
    ],
    "cal.hintLbl": ["Hinweis:", "Note:"],
    "cal.coordsLbl": ["Koordinaten:", "Coordinates:"],
    "cal.editRule": ["Regel bearbeiten", "Edit rule"],
    "cal.delOccurrence": ["Termin löschen", "Delete this date"],
    "cal.confirmDelOccurrence": [
      "Nur diesen einen Termin am gewählten Tag entfernen? Die Regel bleibt bestehen. Bereits angelegte Checklisten zu diesem Termin können betroffen sein.",
      "Remove only this occurrence on the selected day? The recurring rule stays. Checklists already linked to this appointment may be affected."
    ],
    "cal.delRule": ["Regel löschen", "Delete rule"],
    "cal.editEntry": ["Einsatz bearbeiten", "Edit assignment"],
    "cal.copyBtn": ["Kopieren", "Copy"],
    "cal.copyTitle": ["Einmaligen Einsatz kopieren", "Copy one-off assignment"],
    "cal.copySummary": ["{employee} · {fromTime}–{toTime}", "{employee} · {fromTime}–{toTime}"],
    "cal.copyDateLbl": ["Zieldatum", "Target date"],
    "cal.copyDateAria": ["Datum für die Kopie", "Date for the copy"],
    "cal.copyConfirm": ["Kopieren", "Copy"],
    "cal.copySameDate": ["Bitte ein anderes Datum als den aktuellen Tag wählen.", "Pick a date other than the current day."],
    "cal.copyInvalidDate": ["Bitte ein gültiges Zieldatum wählen.", "Please choose a valid target date."],
    "cal.remove": ["Entfernen", "Remove"],
    "cal.btnDone": ["Abgeschlossen", "Completed"],
    "cal.btnProg": ["In Arbeit", "In progress"],
    "cal.btnCk": ["Checklist", "Checklist"],
    "corr.approve": ["Freigeben", "Approve"],
    "corr.rejectPh": ["Grund bei Ablehnung (optional)", "Reason if rejecting (optional)"],
    "corr.rejectAria": ["Grund bei Ablehnung", "Reason when rejecting"],
    "corr.reject": ["Ablehnen", "Reject"],
    "corr.cmtLbl": ["Kommentar:", "Comment:"],
    "toast.loginFail": ["Login fehlgeschlagen. Bitte Zugangsdaten prüfen.", "Login failed. Check your credentials."],
    "toast.managedStaffOnly": ["Kein Zugriff auf diese Mitarbeiter-Daten.", "No access to this staff member's data."],
    "toast.welcome": ["Willkommen, {label}.", "Welcome, {label}."],
    "toast.logout": ["Du wurdest abgemeldet.", "You have been signed out."],
    "toast.cpMinOne": ["Mindestens ein Prüfpunkt muss bleiben.", "At least one checkpoint must remain."],
    "toast.cpEnter": ["Bitte einen Prüfpunkt eingeben.", "Please enter a checkpoint."],
    "toast.cpDup": [
      "Dieser Prüfpunkt existiert in diesem Bereich bereits.",
      "This checkpoint already exists in this area."
    ],
    "toast.cpUpdated": ["Prüfpunkt aktualisiert.", "Checkpoint updated."],
    "toast.cpSaved": ["Prüfpunkt gespeichert.", "Checkpoint saved."],
    "toast.cpDeleted": ["Prüfpunkt gelöscht.", "Checkpoint deleted."],
    "toast.chkCalendar": ["Neue Checkliste bitte über den Kalender-Einsatz starten.", "Please start new checklists from a calendar assignment."],
    "toast.chkLocked": ["Freigegebene Checklisten können nicht mehr geändert werden.", "Approved checklists cannot be edited."],
    "toast.draftCust": ["Für einen Entwurf reicht ein Kunde.", "A draft only needs a customer name."],
    "toast.chkSubmit": ["Checkliste wurde eingereicht.", "Checklist submitted."],
    "toast.chkNeedCustomer": ["Bitte einen Kunden (Name) angeben.", "Please enter a customer name."],
    "toast.extraEuroRequired": [
      "Bei Zusatzkosten bitte einen gültigen Eurobetrag größer 0 eintragen.",
      "When extra costs are enabled, enter a valid amount greater than zero."
    ],
    "toast.extraCostNeedCustomer": [
      "Zusatzkosten nur mit Kunde aus der Stammdatenbank (Kalender-Einsatz). Bitte Kundenzuordnung prüfen.",
      "Extra costs require a customer linked from the database (calendar assignment). Please check the customer link."
    ],
    "toast.chkSaveFailed": [
      "Checkliste konnte nicht verarbeitet werden. Bitte Seite neu laden und erneut versuchen.",
      "Could not process the checklist. Please reload and try again."
    ],
    "toast.chkPersistFailed": [
      "Speichern fehlgeschlagen (z. B. Browser-Speicher voll). Alte Checklisten exportieren/löschen oder weniger Fotos.",
      "Could not save (e.g. browser storage full). Export/delete old checklists or use fewer photos."
    ],
    "toast.persistCompressed": [
      "Gespeichert – Bilder wurden verkleinert, damit alles in den Browser-Speicher passt.",
      "Saved – images were compressed so everything fits in browser storage."
    ],
    "toast.draftSaved": ["Entwurf wurde gespeichert.", "Draft saved."],
    "toast.noAccess": ["Kein Zugriff auf diese Checkliste.", "No access to this checklist."],
    "toast.approved": [
      "Freigegeben. Kundenbericht als PDF ist bereit zum Versand.",
      "Approved. Customer report PDF is ready to send."
    ],
    "toast.pdfError": ["PDF konnte nicht erzeugt werden. Bitte später erneut versuchen.", "Could not create the PDF. Please try again later."],
    "toast.pdfMailFallback": [
      "PDF wurde heruntergeladen. E-Mail-Entwurf öffnen und Datei als Anhang einfügen.",
      "PDF downloaded. Open the email draft and attach the file."
    ],
    "toast.smtpSent": ["Bericht wurde per E-Mail an den Kunden gesendet (SMTP).", "Report was emailed to the customer (SMTP)."],
    "toast.smtpFailed": ["E-Mail-Versand über den Server ist fehlgeschlagen.", "Sending email through the server failed."],
    "toast.smtpNeedToken": [
      "SMTP-Server erwartet ein API-Token — sessionStorage „werkstattMailApiToken“ setzen oder apiToken in der Konfiguration leeren.",
      "Mail server expects an API token — set sessionStorage „werkstattMailApiToken“ or leave apiToken empty in config."
    ],
    "toast.customerEmailMissing": [
      "Keine gültige Kunden-E-Mail im Eintrag. Bitte Kunden-Stammdaten (E-Mail) pflegen oder im Formular ausfüllen und Checkliste erneut speichern/einreichen.",
      "No valid customer email. Add it under customer master data or in the checklist form, then save or submit again."
    ],
    "toast.mailRelayOff": [
      "SMTP-Versand nicht möglich: relay:false, Mail-Server nicht erreichbar oder falsche Basis-URL. Im Projektstamm `.env`: MAIL_ENABLED=true und SMTP_* setzen, Node neu starten. App z. B. unter http://127.0.0.1:3847/ öffnen. Netzwerk: POST /api/send-report und relay in /api/mail-capabilities.",
      "Mail cannot be sent: relay is off, the mail API is unreachable, or the wrong base URL is used. In the project root `.env` set MAIL_ENABLED=true and SMTP_* values, then restart Node. Open the app (e.g. http://127.0.0.1:3847/). Check the network panel for relay:true on /api/mail-capabilities and POST /api/send-report."
    ],
    "toast.reopened": ["Checkliste ist wieder zur Prüfung offen.", "Checklist is open for review again."],
    "toast.deletedChk": ["Checkliste wurde gelöscht.", "Checklist deleted."],
    "toast.corrWait": ["Es wartet bereits eine Korrektur auf Freigabe.", "A correction is already awaiting approval."],
    "toast.corrTimeReq": ["Bitte die neue Zeit für „{label}“ eintragen.", 'Please enter the new time for “{label}”.'],
    "toast.corrOneChange": ["Mindestens eine erfasste Zeit muss angepasst werden.", "Change at least one recorded time."],
    "toast.corrCommentReq": ["Bitte den Kommentar ausfüllen (Pflichtfeld).", "Please fill in the comment (required)."],
    "toast.corrSent": ["Korrektur wurde an den Chef geschickt und muss noch freigegeben werden.", "Correction sent to management; approval required."],
    "toast.corrOk": ["Korrektur freigegeben – Zeiten sind übernommen.", "Correction approved – times updated."],
    "toast.corrRejected": ["Korrektur abgelehnt. Der Hinweis erscheint bei den Arbeitszeiten des Mitarbeiters.", "Correction rejected. The note appears under the employee’s working hours."],
    "toast.corrBlockStamp": ["Korrektur wartet auf Freigabe – keine weiteren Zeiten möglich.", "Correction pending – no further times allowed."],
    "toast.wtStampTodayOnly": [
      "Zeiten können nur am heutigen Tag erfasst werden.",
      "Times can only be recorded on today’s date."
    ],
    "toast.custLoaded": ["Kundendaten zum Bearbeiten geladen.", "Customer loaded for editing."],
    "toast.assignMissing": ["Einsatz wurde nicht gefunden.", "Assignment not found."],
    "toast.chkOpened": ["Checkliste wurde geöffnet.", "Checklist opened."],
    "toast.statusFixed": ["Status korrigiert. Checklist kann erneut gestartet werden.", "Status fixed. Checklist can be restarted."],
    "toast.tplDenied": ["Diese Checklisten-Art ist für dich nicht freigegeben.", "This checklist type is not enabled for your account."],
    "toast.custMissing": ["Kundenstammdaten fehlen.", "Customer master data missing."],
    "toast.cpMissingTpl": [
      'Für diesen Kunden sind keine Prüfpunkte für „{name}“ hinterlegt.',
      'No checkpoints configured for “{name}”.'
    ],
    "toast.chkCreated": ["Neue Checkliste aus Einsatz erstellt.", "New checklist created from assignment."],
    "toast.pickEmployee": ["Bitte einen Mitarbeiter auswählen.", "Please select staff."],
    "toast.pickCustomerDb": ["Bitte einen Kunden aus der Datenbank auswählen.", "Please pick a customer from the database."],
    "toast.pickChecklistTpl": ["Bitte mindestens eine Checkliste auswählen.", "Please select at least one checklist."],
    "toast.hausZonesRequired": [
      "Bitte mindestens einen Bereich für „Haus & Garten“ auswählen (Allgemein, Pool oder Zonen).",
      "Please select at least one Haus & Garten area (General, pool, or zones)."
    ],
    "toast.cpMissingHausZones": [
      "Für die gewählten Bereiche sind beim Kunden keine Prüfpunkte hinterlegt.",
      "No checkpoints are configured for the customer in the selected areas."
    ],
    "toast.cpPickFirst": ["Bitte zuerst passende Prüfpunkte für diese Checkliste beim Kunden auswählen.", "Please select checkpoints for this checklist on the customer first."],
    "toast.overlap": ["Fehler: Terminüberschneidung für diesen Mitarbeiter.", "Error: schedule overlap for this staff member."],
    "toast.pickWeekday": ["Bitte einen gültigen Wochentag wählen.", "Please choose a valid weekday."],
    "toast.overlapRule": ["Fehler: Terminüberschneidung für diesen Mitarbeiter in der Regel.", "Error: overlap in the recurring rule."],
    "toast.ruleDeleted": [
      "Wiederkehrende Regel gelöscht. Vergangene Termine und Checklisten-Historie bleiben erhalten.",
      "Recurring rule removed. Past appointments and checklist history are kept."
    ],
    "toast.occurrenceDeleted": ["Termin für diesen Tag entfernt. Die Regel bleibt aktiv.", "This date was removed. The rule is unchanged."],
    "toast.ruleEditLoad": ["Regel zum Bearbeiten geladen.", "Rule loaded for editing."],
    "toast.calSavedCombo": ["Einsatz gespeichert.", "Assignment saved."],
    "toast.calSavedWeekly": ["Wiederkehrende Regel gespeichert (wöchentlich / 14-tägig / monatlich).", "Recurring rule saved (weekly / biweekly / monthly)."],
    "toast.calUpdatedRule": ["Regel aktualisiert.", "Rule updated."],
    "toast.calUpdatedSingle": ["Einsatz aktualisiert.", "Assignment updated."],
    "toast.calEditLoad": ["Einsatz zum Bearbeiten geladen.", "Assignment loaded for editing."],
    "toast.calCopied": ["Einsatz wurde kopiert.", "Assignment was copied."],
    "toast.calCopyFailed": ["Kopieren nicht möglich.", "Cannot copy assignment."],
    "toast.pickChecklistOwner": ["Bitte auswählen, wer die Checkliste bekommt.", "Please choose who receives the checklist."],
    "toast.checklistOwnerInvalid": ["Der Checklisten-Mitarbeiter muss aus der Auswahl stammen.", "The checklist owner must be one of the selected employees."],
    "toast.multiRecurringUnsupported": ["Mehrere Mitarbeiter sind aktuell nur für einmalige Einsätze verfügbar.", "Multiple employees are currently supported only for one-off assignments."],
    "toast.chkOnlyOwner": ["Nur der ausgewählte Mitarbeiter kann die Checkliste starten.", "Only the selected employee can start this checklist."],
    "toast.custUpd": ["Kundendaten aktualisiert.", "Customer updated."],
    "toast.custAdd": ["Kunde gespeichert.", "Customer saved."],
    "toast.custStatusActive": ["Kunde ist wieder aktiv.", "Customer is active again."],
    "toast.custStatusInactive": ["Kunde wurde auf inaktiv gesetzt.", "Customer marked inactive."],
    "toast.contractPdfType": ["Bitte eine PDF-Datei wählen.", "Please choose a PDF file."],
    "toast.contractPdfSize": ["Die PDF ist zu groß (max. 8 MB).", "The PDF is too large (max. 8 MB)."],
    "toast.guidePdfRequired": ["Mindestens ein PDF (DE, EN oder ES) hochladen.", "Upload at least one PDF (DE, EN or ES)."],
    "toast.guideAdd": ["Anleitung gespeichert.", "Instruction saved."],
    "toast.guideUpd": ["Anleitung aktualisiert.", "Instruction updated."],
    "toast.guideLoaded": ["Anleitung zum Bearbeiten geladen.", "Instruction loaded for editing."],
    "toast.guideDeleted": ["Anleitung gelöscht.", "Instruction deleted."],
    "chk.newItemDefault": ["Neuer Prüfpunkt", "New checkpoint"],
    "chk.unnamed": ["Unbenannter Prüfpunkt", "Unnamed checkpoint"],
    "pdf.metaBlockTitle": ["Überblick", "Overview"],
    "pdf.fieldJob": ["Objekt / Auftrag", "Property / job"],
    "pdf.visitDay": ["Tag der Begehung", "Inspection date"],
    "pdf.legendOk": ["Grün — erledigt", "Green — done"],
    "pdf.legendOpen": ["Rot — offen", "Red — open"],
    "pdf.summaryStrip": [
      "Status: {done} von {total} Prüfpunkten erledigt · offen: {open}",
      "Status: {done} of {total} checkpoints completed · still open: {open}"
    ],
    "pdf.checkpointImagesTitle": [
      "Abbildungen zu den Prüfpunkten",
      "Checkpoint photos"
    ],
    "pdf.checkpointImagesOnNextPages": [
      "Abbildungen auf Folgeseiten",
      "Photos on the following pages"
    ]
  };

  function buildMessages() {
    var de = {};
    var en = {};
    Object.keys(PAIRS).forEach(function (key) {
      var pair = PAIRS[key];
      de[key] = pair[0];
      en[key] = pair[1];
    });
    return { de: de, en: en };
  }

  var MSGS = buildMessages();
  /** @type {"de"|"en"} */
  var locale =
    typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "de";

  function getLocale() {
    return locale;
  }

  function intlLocale() {
    return locale === "en" ? "en-GB" : "de-DE";
  }

  function intlLang() {
    return locale === "en" ? "en" : "de";
  }

  function interpolate(str, vars) {
    var out = str;
    if (!vars) return out;
    Object.keys(vars).forEach(function (k) {
      out = out.split("{" + k + "}").join(String(vars[k] != null ? vars[k] : ""));
    });
    return out;
  }

  function t(key, vars) {
    var prim = MSGS[locale] && MSGS[locale][key];
    var s = typeof prim === "string" ? prim : MSGS.de[key];
    if (typeof s !== "string") return key;
    return interpolate(s, vars);
  }

  function applyAttrs(node) {
    var ph = node.getAttribute("data-i18n-placeholder");
    if (ph) node.placeholder = t(ph);
    var ar = node.getAttribute("data-i18n-aria");
    if (ar) node.setAttribute("aria-label", t(ar));
    var ti = node.getAttribute("data-i18n-title");
    if (ti) node.title = t(ti);
  }

  function applyToScope(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      if (key) node.textContent = t(key);
    });
    root.querySelectorAll("[data-i18n-placeholder],[data-i18n-aria],[data-i18n-title]").forEach(applyAttrs);
  }

  function setUiLocale(next) {
    if (next !== "de" && next !== "en") return;
    locale = next;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch (err) {}
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale === "en" ? "en" : "de";
      document.title = t("meta.title");
      applyToScope(document);
      var selAuth = typeof global.__wcLocaleSelectAuth !== "undefined" ? global.__wcLocaleSelectAuth : null;
      var selSide = typeof global.__wcLocaleSelectSidebar !== "undefined" ? global.__wcLocaleSelectSidebar : null;
      [selAuth, selSide].forEach(function (sel) {
        if (sel) sel.value = locale;
      });
    }
    var hook = typeof global.__wcOnLocaleChange === "function" ? global.__wcOnLocaleChange : null;
    if (hook) hook();
  }

  /** Registrierung der Sprachwahl-Elemente (nach DOM) */
  function bindLocaleSelectors(authSelect, sidebarSelect) {
    global.__wcLocaleSelectAuth = authSelect || null;
    global.__wcLocaleSelectSidebar = sidebarSelect || null;
    function onChange(ev) {
      var v = ev.target && ev.target.value;
      setUiLocale(v);
    }
    [authSelect, sidebarSelect].forEach(function (sel) {
      if (!sel) return;
      sel.value = locale;
      sel.removeEventListener("change", onChange);
      sel.addEventListener("change", onChange);
    });
  }

  global.WerkstattCheckI18n = {
    t: t,
    getLocale: getLocale,
    intlLocale: intlLocale,
    intlLang: intlLang,
    setUiLocale: setUiLocale,
    applyToScope: applyToScope,
    bindLocaleSelectors: bindLocaleSelectors
  };

  /* Erste Auszeichnung ohne Hook (vor app.js render) */
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = locale === "en" ? "en" : "de";
  }
})(typeof window !== "undefined" ? window : globalThis);

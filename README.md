# WerkstattCheck

Eine Webapp fuer kleine Handwerksbetriebe:

- Mitarbeiter erfassen Checklisten, Kommentare und Bilder.
- Checklisten werden als Entwurf gespeichert oder zur Pruefung eingereicht.
- Der Chef prueft Einreichungen, hinterlegt einen Freigabekommentar und gibt den Bericht frei.
- Bei Freigabe wird der Kundenbericht automatisch als gesendet markiert. Zusaetzlich kann ein E-Mail-Entwurf per `mailto:` geoeffnet werden.
- Jeder Pruefpunkt kann einen eigenen Kurzkommentar enthalten.

## Demo-Login

- Chef: `chef` / `chef123`
- Mitarbeiter: `mitarbeiter` / `mitarbeiter123`

## Lokal starten

Oeffne `index.html` direkt im Browser.

## Mail-Server (SMTP + Webapp aus einem Prozess)

SMTP und Port liegen zentral in **`.env`** im Projektstamm (Vorlage: **`.env.example`**). Kopiere `.env.example` nach `.env` und setze `MAIL_ENABLED=true` sowie `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

Start: `npm run start:mail` im Projektroot oder `start-mail.cmd` unter Windows — Node nutzt `server/index.js` mit `dotenv`.

Die frühere Datei `mail-service.config.json` wird nicht mehr gelesen (nur noch Umgebungsvariablen / `.env`).

## GitHub Pages Deployment

Diese App ist eine statische Webseite und kann direkt ueber GitHub Pages deployed werden.

1. Repository auf GitHub anlegen (hier: `samanthagrahl/checkliste`).
2. Dateien in den `main`-Branch pushen.
3. In GitHub unter `Settings` -> `Pages`:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
4. Danach ist die App unter einer GitHub-Pages-URL erreichbar.

## Hinweis zur Datenspeicherung

Die Daten werden im `localStorage` des Browsers gespeichert. Das bedeutet:

- Daten sind pro Browser/Geraet getrennt.
- Es gibt aktuell kein zentrales Backend.

## Wenn Server aktiv ist, dann Bilder bei Checkliste durch anklicken größer machen programmieren lassen

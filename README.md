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

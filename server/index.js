"use strict";

const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const ENV_PATH = path.join(__dirname, "..", ".env");

/** JSON-kompatibel: true/false sowie gängige String-Varianten akzeptieren. */
function readMailEnabled(value) {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return (
      s === "true"
      || s === "1"
      || s === "yes"
      || s === "ja"
      || s === "on"
      || s === "aktiv"
      || s === "an"
    );
  }
  return false;
}

function parseBoolEnv(raw, defaultVal) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return defaultVal;
  return readMailEnabled(raw);
}

function parseOrigins(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Ein Konfigurationsobjekt im bisherigen JSON-Shape für SMTP, Server, CORS. */
function loadConfigFromEnv() {
  const port = Number.parseInt(String(process.env.MAIL_SERVER_PORT || "3847"), 10);
  const smtpPort = Number.parseInt(String(process.env.SMTP_PORT || "587"), 10);
  return {
    enabled:
      readMailEnabled(process.env.MAIL_ENABLED) || readMailEnabled(process.env.SMTP_ENABLED),
    smtp: {
      host: String(process.env.SMTP_HOST || "").trim(),
      port: Number.isFinite(smtpPort) && smtpPort > 0 ? smtpPort : 587,
      secure: parseBoolEnv(process.env.SMTP_SECURE, false),
      requireTLS: parseBoolEnv(process.env.SMTP_REQUIRE_TLS, true),
      auth: {
        user: String(process.env.SMTP_USER || "").trim(),
        pass: String(process.env.SMTP_PASS || "")
      },
      from: String(process.env.SMTP_FROM || "").trim()
    },
    server: {
      host: String(process.env.MAIL_SERVER_HOST || "127.0.0.1").trim() || "127.0.0.1",
      port: Number.isFinite(port) && port > 0 ? port : 3847,
      serveStaticSite: parseBoolEnv(process.env.MAIL_SERVE_STATIC, true),
      siteRootRelative: String(process.env.MAIL_SITE_ROOT || "..").trim() || "..",
      allowedOrigins: parseOrigins(process.env.MAIL_CORS_ORIGINS),
      apiToken: String(process.env.MAIL_API_TOKEN || "").trim()
    }
  };
}

/** SMTP ein: erst root `enabled`, sonst optional nur `smtp.enabled` (nicht genutzt in .env-Variante — Kompatibilität zu alter API-Form). */
function isMailRelayEnabled(rawCfg) {
  if (!rawCfg || typeof rawCfg !== "object") return false;
  if (readMailEnabled(rawCfg.enabled)) return true;
  if (rawCfg.smtp && readMailEnabled(rawCfg.smtp.enabled)) return true;
  return false;
}

function buildCorsMiddleware(cfg) {
  const list = cfg.server && Array.isArray(cfg.server.allowedOrigins)
    ? cfg.server.allowedOrigins.filter(Boolean)
    : [];
  if (!list.length) {
    return cors({
      origin: "*",
      methods: ["GET", "POST", "OPTIONS", "HEAD"],
      allowedHeaders: ["Content-Type", "X-Mail-Api-Token"]
    });
  }
  return cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (list.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true
  });
}

function sanitizeEmail(raw) {
  const s = String(raw || "").trim();
  const ok =
    /^[^\s@]+@[^\s@\u0000-\u001f]+$/i.test(s) && !s.includes("..") && s.length <= 254;
  return ok ? s : "";
}

function createTransport(cfg) {
  const s = cfg.smtp || {};
  const secure = Boolean(s.secure);
  return nodemailer.createTransport({
    host: s.host || "localhost",
    port: Number(s.port) || 587,
    secure,
    requireTLS: secure ? false : Boolean(s.requireTLS),
    auth: s.auth && s.auth.user
      ? { user: s.auth.user, pass: String(s.auth.pass || "") }
      : undefined
  });
}

function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.warn(
      `[mail] Keine Datei ${path.basename(ENV_PATH)} im Projektstamm — verwende nur Prozess-Umgebung. ` +
        `Zum lokalen Anlegen: ${path.basename(ENV_PATH)}.example nach .env kopieren.`
    );
  }

  const cfg = loadConfigFromEnv();

  const app = express();
  app.disable("x-powered-by");
  app.use(buildCorsMiddleware(cfg));
  app.use(express.json({ limit: "40mb" }));

  const serve =
    cfg.server && cfg.server.serveStaticSite !== false;
  if (serve) {
    const rel =
      (cfg.server && cfg.server.siteRootRelative) || "..";
    const siteRoot = path.resolve(__dirname, rel);
    app.use(express.static(siteRoot, { extensions: ["html"] }));
  }

  app.get("/api/mail-capabilities", (req, res) => {
    const enabled = isMailRelayEnabled(cfg);
    const tokenNow = cfg.server && String(cfg.server.apiToken || "").trim();
    const payload = {
      relay: enabled,
      apiTokenRequired: Boolean(tokenNow),
      smtpHost: enabled && cfg.smtp && cfg.smtp.host ? cfg.smtp.host : ""
    };
    if (!enabled) {
      payload.relayOffDetail = {
        configSource: "environment",
        envFilePresent: fs.existsSync(ENV_PATH),
        envFilePath: ENV_PATH,
        mailEnabled: Object.prototype.hasOwnProperty.call(process.env, "MAIL_ENABLED")
          ? process.env.MAIL_ENABLED
          : null,
        smtpEnabled: Object.prototype.hasOwnProperty.call(process.env, "SMTP_ENABLED")
          ? process.env.SMTP_ENABLED
          : null
      };
    }
    res.json(payload);
  });

  app.get("/api/send-report", (req, res) => {
    res.status(405).set("Allow", "POST").json({
      ok: false,
      error: "method_not_allowed",
      hint:
        "Der Versand läuft nur per POST (JSON mit to, subject, text, pdfBase64, pdfFileName). " +
        "Im Browser die URL so nicht aufrufen — in der App beim Freigeben auslösen."
    });
  });

  app.post("/api/send-report", async (req, res) => {
    if (!isMailRelayEnabled(cfg)) {
      return res.status(503).json({ ok: false, error: "mail_disabled" });
    }
    const tokenNow = cfg.server && String(cfg.server.apiToken || "").trim();
    if (tokenNow) {
      const got = String(req.get("x-mail-api-token") || "").trim();
      if (got !== tokenNow) {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }
    }

    const body = req.body || {};
    const to = sanitizeEmail(body.to);
    if (!to) {
      return res.status(400).json({ ok: false, error: "invalid_recipient" });
    }
    const subject = String(body.subject || "").trim().slice(0, 998);
    const text = String(body.text || "");
    const pdfFileName = String(body.pdfFileName || "bericht.pdf").replace(
      /[/\\:\u0000-\u001f]+/g,
      "-"
    ).slice(0, 200);
    const pdfBase64 = String(body.pdfBase64 || "");

    if (!subject) {
      return res.status(400).json({ ok: false, error: "missing_subject" });
    }
    if (!pdfBase64.length) {
      return res.status(400).json({ ok: false, error: "missing_pdf" });
    }

    let buf;
    try {
      buf = Buffer.from(pdfBase64, "base64");
      if (!buf.length) throw new Error("empty_pdf");
      if (buf.length > 35 * 1024 * 1024) throw new Error("pdf_too_large");
    } catch (e) {
      return res.status(400).json({ ok: false, error: "invalid_pdf_data" });
    }

    let fromAddr = cfg.smtp && cfg.smtp.from ? String(cfg.smtp.from).trim() : "";
    if (!fromAddr && cfg.smtp && cfg.smtp.auth) {
      fromAddr = String(cfg.smtp.auth.user || "").trim();
    }
    if (!fromAddr) {
      return res.status(500).json({ ok: false, error: "server_from_missing" });
    }

    try {
      const tx = createTransport(cfg);
      await tx.sendMail({
        from: fromAddr,
        to,
        subject,
        text: text.length ? text : ".",
        attachments: [
          {
            filename: pdfFileName,
            content: buf,
            contentType: "application/pdf"
          }
        ]
      });
      return res.json({ ok: true });
    } catch (e) {
      console.error("[send-report]", e.message);
      return res.status(502).json({ ok: false, error: "smtp_send_failed" });
    }
  });

  const host = cfg.server.host;
  const port = cfg.server.port;

  app.listen(port, host, () => {
    console.log(`Mail-Service hört auf http://${host}:${port}/`);
    if (serve) {
      console.log("Statische Webapp wird mit ausgeliefert (gleicher Ursprung).");
    }
    const enabledStartup = isMailRelayEnabled(cfg);
    console.log(`[mail] Konfiguration: Umgebungsvariablen (optional .env: ${ENV_PATH})`);
    if (!enabledStartup) {
      console.warn(
        "[mail] SMTP-Versand AUS — MAIL_ENABLED=true setzen und SMTP_* prüfen, dann Node neu starten."
      );
    } else {
      console.warn("[mail] SMTP-Versand EIN (.env / Umgebung)");
    }
  });
}

main();

import http from "http";
import crypto from "crypto";
import type { TLSSocket } from "tls";
import logger from "../utils/logger";
import { escapeHtml } from "./escape";
import { isDashboardOrigin } from "./api";
import UiAuth, { SESSION_COOKIE, SESSION_TTL_SEC, cookieOf } from "../lib/ui-auth";
import { isPanel, isTls } from "../proxy/request";
import { clientIp } from "../proxy/hub";

const MAX_LOGIN_BODY = 4096;

const loginPage = (nonce: string, error?: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Sign in · locadot</title>
<style nonce="${escapeHtml(nonce)}">
:root { --bg: #f6f7f9; --surface: #fff; --border: #e3e6eb; --fg: #111827; --muted: #6b7280; --accent: #2563eb; --down: #dc2626; }
@media (prefers-color-scheme: dark) { :root { --bg: #0d1117; --surface: #161b22; --border: #30363d; --fg: #e6edf3; --muted: #8b949e; --accent: #3b82f6; --down: #f87171; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
form { width: 100%; max-width: 340px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 28px; display: flex; flex-direction: column; gap: 14px; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; }
.logo { width: 24px; height: 24px; border-radius: 7px; background: var(--accent); position: relative; }
.logo::after { content: ""; position: absolute; inset: 8px; border-radius: 50%; background: #fff; }
p { margin: 0; color: var(--muted); }
label { font-weight: 600; font-size: 13px; }
input { width: 100%; padding: 9px 11px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--fg); font: inherit; }
input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
button { padding: 9px; border: 0; border-radius: 8px; background: var(--accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.error { color: var(--down); font-size: 13px; }
.hint { font-size: 12px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
code { font-family: ui-monospace, monospace; font-size: 12px; }
</style>
</head>
<body>
<form method="post" action="/login">
  <div class="brand"><span class="logo" aria-hidden="true"></span>locadot</div>
  <p>This dashboard is password protected.</p>
  <input class="sr" type="text" name="username" value="locadot" autocomplete="username" tabindex="-1" aria-hidden="true" readonly>
  <div><label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required autofocus></div>
  ${error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : ""}
  <button type="submit">Sign in</button>
  <p class="hint">Forgot it? Run <code>locadot ui:password</code> in a terminal to reset it.</p>
</form>
</body>
</html>
`;

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Through the shared dashboard every visitor arrives from cloudflared on loopback, so limit by the visitor's IP. */
export const loginIp = (req: http.IncomingMessage) => (isPanel(req) ? clientIp(req) : req.socket.remoteAddress || "");

const sameOrigin = (req: http.IncomingMessage) => {
  // Browsers send `Origin: null` on form posts under Referrer-Policy: no-referrer, so trust Sec-Fetch-Site when present.
  // "same-site" is refused: every *.localhost app is same-site with the dashboard.
  const site = req.headers["sec-fetch-site"];
  if (site) return site === "same-origin" || site === "none";
  const origin = req.headers.origin;
  if (!origin || origin === "null") return !origin;
  return isDashboardOrigin(req, origin);
};

// The shared dashboard's public URL is https even though cloudflared talks plain http to us.
const secure = (req: http.IncomingMessage) => (isPanel(req) ? isTls(req) : Boolean((req.socket as TLSSocket).encrypted));

const cookie = (req: http.IncomingMessage, value: string, maxAge: number) =>
  `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure(req) ? "; Secure" : ""}`;

const sendLogin = (res: http.ServerResponse, method: string, nonce: string, status: number, error?: string) => {
  // The dashboard's CSP forbids form posts; the login form needs one.
  res.setHeader("Content-Security-Policy", `default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(method === "HEAD" ? undefined : loginPage(nonce, error));
};

const readForm = (req: http.IncomingMessage): Promise<Record<string, string>> =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_LOGIN_BODY) chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      if (size > MAX_LOGIN_BODY) return resolve({});
      const raw = Buffer.concat(chunks).toString("utf8");
      if (String(req.headers["content-type"] || "").includes("application/json")) {
        try {
          const data = JSON.parse(raw);
          return resolve(data && typeof data === "object" ? data : {});
        } catch {
          return resolve({});
        }
      }
      resolve(Object.fromEntries(new URLSearchParams(raw)));
    });
  });

export const signedIn = (req: http.IncomingMessage) => UiAuth.validSession(cookieOf(req.headers.cookie, SESSION_COOKIE));

const hasToken = (req: http.IncomingMessage, token: string) => {
  const sent = req.headers["x-locadot-token"];
  return typeof sent === "string" && safeEqual(sent, token);
};

/** A fresh session for whoever just proved the password, so changing it from the dashboard doesn't sign them out. */
export const sessionCookie = (req: http.IncomingMessage) => cookie(req, UiAuth.issue(), SESSION_TTL_SEC);

/**
 * With a dashboard password set, the UI and its reads need a session cookie. Scripts that send the API token
 * are let through untouched. Returns true when it answered the request itself.
 */
export function gate(req: http.IncomingMessage, res: http.ServerResponse, url: URL, token: string, nonce: string): boolean {
  if (!UiAuth.enabled()) {
    if (!isPanel(req)) return false;
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("locadot: set a dashboard password to share the dashboard.\n");
    return true;
  }
  const method = req.method || "GET";
  const path = url.pathname;

  if (path === "/login") {
    if (method === "GET" || method === "HEAD") {
      if (signedIn(req)) return redirect(res, "/");
      sendLogin(res, method, nonce, 200);
      return true;
    }
    if (method !== "POST") return false;
    const ip = loginIp(req);
    if (!sameOrigin(req)) {
      sendLogin(res, method, nonce, 403, "Cross-site sign-in is not allowed.");
      return true;
    }
    if (UiAuth.limited(ip)) {
      sendLogin(res, method, nonce, 429, "Too many wrong passwords. Wait a few minutes and try again.");
      return true;
    }
    readForm(req)
      .then((form) => {
        if (!UiAuth.verify(form.password)) {
          UiAuth.fail(ip);
          logger.warn(`🔒 dashboard: wrong password from ${ip}`);
          return sendLogin(res, method, nonce, 401, "Wrong password.");
        }
        UiAuth.succeed(ip);
        res.setHeader("Set-Cookie", sessionCookie(req));
        redirect(res, "/");
      })
      .catch(() => sendLogin(res, method, nonce, 400, "Couldn't read the form."));
    return true;
  }

  if (path === "/logout" && method === "POST") {
    if (!sameOrigin(req)) {
      res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Cross-origin requests are not allowed." }));
      return true;
    }
    res.setHeader("Set-Cookie", cookie(req, "", 0));
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  if (path === "/healthz" || path === "/favicon.ico") return false;
  if (signedIn(req) || hasToken(req, token)) return false;

  if (path.startsWith("/api/")) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Sign in to the dashboard, or send X-Locadot-Token.", hint: "locadot token" }));
    return true;
  }
  if (method === "GET" || method === "HEAD") {
    if (path === "/") sendLogin(res, method, nonce, 200);
    else redirect(res, "/login");
    return true;
  }
  res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "Sign in to the dashboard." }));
  return true;
}

function redirect(res: http.ServerResponse, location: string): true {
  res.writeHead(303, { Location: location });
  res.end();
  return true;
}

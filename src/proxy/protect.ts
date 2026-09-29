import crypto from "crypto";
import http from "http";
import type { Duplex } from "stream";
import logger from "../utils/logger";
import { escapeHtml } from "../dashboard/escape";
import HostAuth, { HOST_COOKIE, HOST_SESSION_TTL_SEC } from "../lib/host-auth";
import { cookieOf } from "../lib/ui-auth";
import type { HostEntry, ProtectScope } from "../types";
import { PREFIX } from "./passthrough";
import { fromRemote, fromTunnel, isTls } from "./request";
import { clientIp } from "./hub";

/**
 * Password protection for a mapping (`protect`), on the paths in it was picked for. Visitors get a sign-in page and,
 * with the password, a cookie signed for that host; the cookie is taken off before the request goes upstream.
 */

export const LOGIN_PATH = `${PREFIX}login`;
const MAX_BODY = 4096;

export const scopeOf = (req: http.IncomingMessage): ProtectScope => (fromTunnel(req) ? "shared" : fromRemote(req) ? "remote" : "local");

const protectedHere = (req: http.IncomingMessage, entry: HostEntry) => Boolean(entry.protect?.scopes.includes(scopeOf(req)));

const signedIn = (req: http.IncomingMessage, host: string) => HostAuth.validSession(host, cookieOf(req.headers.cookie, HOST_COOKIE));

const stripCookie = (req: http.IncomingMessage) => {
  const header = req.headers.cookie;
  if (!header) return;
  const rest = header.split(";").filter((part) => part.split("=")[0].trim() !== HOST_COOKIE).join(";").trim();
  if (rest) req.headers.cookie = rest;
  else delete req.headers.cookie;
};

// Visitors on a tunnel or remote access all arrive from cloudflared, so count their failures by their own IP.
const limitKey = (req: http.IncomingMessage, host: string) => `${host}|${scopeOf(req) === "local" ? req.socket.remoteAddress || "" : clientIp(req)}`;

/** A path on this site to go back to after signing in; anything else goes to /. */
const safeNext = (value: unknown) => (typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : "/");

const shownHost = (req: http.IncomingMessage) => (req.headers.host || "").replace(/:\d+$/, "") || "this site";

const page = (nonce: string, host: string, next: string, error?: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="robots" content="noindex">
<title>Password required · ${escapeHtml(host)}</title>
<style nonce="${nonce}">
:root { --bg: #f6f7f9; --surface: #fff; --border: #e3e6eb; --fg: #111827; --muted: #6b7280; --accent: #2563eb; --accent-bg: #eff4ff; --down: #dc2626; --down-bg: #fef2f2; }
@media (prefers-color-scheme: dark) { :root { --bg: #0d1117; --surface: #161b22; --border: #30363d; --fg: #e6edf3; --muted: #8b949e; --accent: #3b82f6; --accent-bg: #172554; --down: #f87171; --down-bg: #2a1215; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
form { width: 100%; max-width: 360px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 32px 28px 24px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06); }
.icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--accent-bg); color: var(--accent); }
.icon svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
h1 { margin: 0; font-size: 18px; }
p { margin: 0; color: var(--muted); }
.host { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg); overflow-wrap: anywhere; }
label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 6px; }
input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--fg); font: inherit; }
input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
button { padding: 10px; border: 0; border-radius: 8px; background: var(--accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
button:hover { filter: brightness(1.05); }
.error { color: var(--down); background: var(--down-bg); border-radius: 8px; padding: 8px 10px; font-size: 13px; }
.foot { font-size: 12px; text-align: center; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
</head>
<body>
<form method="post" action="${LOGIN_PATH}">
  <div class="icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>
  <div>
    <h1>Password required</h1>
    <p><span class="host">${escapeHtml(host)}</span> is protected. Enter the password to continue.</p>
  </div>
  <input type="hidden" name="next" value="${escapeHtml(next)}">
  <input class="sr" type="text" name="username" value="${escapeHtml(host)}" autocomplete="username" tabindex="-1" aria-hidden="true" readonly>
  <div><label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required autofocus></div>
  ${error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : ""}
  <button type="submit">Continue</button>
  <p class="foot">Protected by locadot</p>
</form>
</body>
</html>
`;

const sendPage = (req: http.IncomingMessage, res: http.ServerResponse, status: number, next: string, error?: string) => {
  const nonce = crypto.randomBytes(16).toString("base64");
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": `default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    "X-Robots-Tag": "noindex",
  });
  res.end(req.method === "HEAD" ? undefined : page(nonce, shownHost(req), next, error));
};

const readForm = (req: http.IncomingMessage): Promise<URLSearchParams> =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_BODY) chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => resolve(new URLSearchParams(size > MAX_BODY ? "" : Buffer.concat(chunks).toString("utf8"))));
  });

// Tunnel visitors are on https even though cloudflared talks plain http to us.
const cookie = (req: http.IncomingMessage, value: string) =>
  `${HOST_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${HOST_SESSION_TTL_SEC}${isTls(req) || fromTunnel(req) ? "; Secure" : ""}`;

function login(req: http.IncomingMessage, res: http.ServerResponse, host: string, url: URL) {
  if (req.method === "GET" || req.method === "HEAD") {
    sendPage(req, res, 200, safeNext(url.searchParams.get("next")));
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "GET, POST" });
    res.end();
    return;
  }
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") {
    sendPage(req, res, 403, "/", "Sign in from this site's own page.");
    return;
  }
  const key = limitKey(req, host);
  if (HostAuth.limited(key)) {
    sendPage(req, res, 429, "/", "Too many wrong passwords. Wait a few minutes and try again.");
    return;
  }
  readForm(req)
    .then((form) => {
      const next = safeNext(form.get("next"));
      if (!HostAuth.verify(host, form.get("password"))) {
        HostAuth.fail(key);
        logger.warn(`🔒 ${host}: wrong password from ${key.split("|")[1]}`);
        return sendPage(req, res, 401, next, "Wrong password.");
      }
      HostAuth.succeed(key);
      res.writeHead(303, { Location: next, "Set-Cookie": cookie(req, HostAuth.issue(host)), "Cache-Control": "no-store" });
      res.end();
    })
    .catch(() => sendPage(req, res, 400, "/", "Couldn't read the form."));
}

/** Answers the request itself (sign-in page, 401) unless it may go through; returns whether it did. */
export function guard(req: http.IncomingMessage, res: http.ServerResponse, host: string, entry: HostEntry): boolean {
  if (!protectedHere(req, entry)) return false;
  const url = new URL(req.url || "/", "http://host.invalid");
  if (!HostAuth.has(host)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end(`locadot: ${host} is password protected but has no password set. Set one: locadot protect --host ${host}\n`);
    return true;
  }
  if (url.pathname === LOGIN_PATH) {
    login(req, res, host, url);
    return true;
  }
  if (signedIn(req, host)) {
    stripCookie(req);
    return false;
  }
  const html = (req.method === "GET" || req.method === "HEAD") && /text\/html|\*\/\*/.test(String(req.headers.accept || ""));
  if (html) {
    sendPage(req, res, 401, safeNext(req.url));
    return true;
  }
  res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end(`locadot: ${shownHost(req)} is password protected. Open it in a browser to sign in.\n`);
  return true;
}

export function guardUpgrade(req: http.IncomingMessage, socket: Duplex, host: string, entry: HostEntry): boolean {
  if (!protectedHere(req, entry)) return false;
  if (HostAuth.has(host) && signedIn(req, host)) {
    stripCookie(req);
    return false;
  }
  socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
  return true;
}

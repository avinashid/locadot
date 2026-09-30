import crypto from "crypto";
import http from "http";
import { DashboardContext, HostEntry, HostStats, ProbeResult, ProtectScope, Role, TunnelState } from "../types";
import HostAuth from "../lib/host-auth";
import { renderPage } from "./page";
import { ApiError, PEER_TOKEN, assertTrusted, readJson, route } from "./api";
import { peerOriginOf } from "../proxy/request";
import { gate, loginIp, sessionCookie } from "./login";
import UiAuth, { SESSION_COOKIE } from "../lib/ui-auth";
import { systemStatus } from "../lib/system";
import { cloudflaredInfo as cloudflared } from "../proxy/tunnel";
import { formatUrl } from "../lib/urls";
import Localhost from "../lib/localhost";
import { remoteFor } from "../proxy/remote";
import Remotes from "../lib/remotes";

interface HostRow {
  host: string;
  target: string;
  insecure: boolean;
  cors: boolean;
  allow: string[];
  tunnelDomain: string | null;
  protect: { scopes: ProtectScope[]; updatedAt: string | null } | null;
  /** null: follows the global setting. */
  httpsRedirect: boolean | null;
  createdAt: string;
  updatedAt: string;
  urls: { https: string; http: string };
  stats: HostStats | null;
  probe: ProbeResult;
  tunnel: TunnelState;
  remote?: { name: string; host: string; role: Role };
}

/** A remote mapping is only reachable through its sender, with the peer's credentials. */
function probeEntry(ctx: DashboardContext, entry: HostEntry): Promise<ProbeResult> {
  if (!entry.remote) return ctx.probe(entry.target);
  const remote = remoteFor(entry.remote.name);
  if (!remote) return Promise.resolve({ up: false, error: "disconnected" });
  return Localhost.probe(remote.url, 3000, false, { "X-Locadot-Peer": remote.token, "X-Locadot-Host": entry.remote.host });
}

function hostUrls(host: string, httpPort: number, httpsPort: number): { https: string; http: string } {
  return { https: formatUrl(host, true, httpsPort), http: formatUrl(host, false, httpPort) };
}

function setCommonHeaders(res: http.ServerResponse, nonce: string): void {
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
}

function sendBody(res: http.ServerResponse, method: string, status: number, contentType: string, body: string): void {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  if (method === "HEAD") {
    res.end();
    return;
  }
  res.end(body);
}

function sendJson(res: http.ServerResponse, method: string, status: number, data: unknown): void {
  sendBody(res, method, status, "application/json; charset=utf-8", JSON.stringify(data));
}

async function buildHosts(ctx: DashboardContext): Promise<HostRow[]> {
  const registry = ctx.getRegistry();
  const stats = ctx.getStats();
  const { httpPort, httpsPort } = ctx.proxyInfo;
  const entries = Object.entries(registry.hosts) as [string, HostEntry][];

  const rows = await Promise.all(
    entries.map(async ([host, entry]): Promise<HostRow> => {
      const probe = await probeEntry(ctx, entry);
      return {
        host,
        target: entry.target,
        insecure: !!entry.insecure,
        cors: !!entry.cors,
        allow: entry.allow ?? [],
        tunnelDomain: entry.tunnelDomain ?? null,
        protect: entry.protect ? { scopes: entry.protect.scopes, updatedAt: HostAuth.updatedAt(host) ?? null } : null,
        httpsRedirect: entry.httpsRedirect ?? null,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        urls: hostUrls(host, httpPort, httpsPort),
        stats: stats[host] ?? null,
        probe,
        tunnel: ctx.tunnel(host),
        remote: entry.remote
          ? { name: entry.remote.name, host: entry.remote.host, role: Remotes.get(entry.remote.name)?.role ?? "viewer" }
          : undefined,
      };
    })
  );

  return rows.sort((a, b) => a.host.localeCompare(b.host));
}

export function handleDashboardRequest(req: http.IncomingMessage, res: http.ServerResponse, ctx: DashboardContext): void {
  // Random per-response nonce, also used as the CSP script-src/style-src token.
  const nonce = crypto.randomBytes(16).toString("base64");
  setCommonHeaders(res, nonce);

  const method = req.method || "GET";
  const url = new URL(req.url || "/", "http://localhost");

  const fail = (error: unknown) => {
    if (res.headersSent) return res.end();
    if (error instanceof ApiError) {
      sendJson(res, method, error.status, { error: error.message, ...(error.hint ? { hint: error.hint } : {}) });
    } else {
      sendJson(res, method, 500, { error: String((error as Error)?.message || error) });
    }
  };

  if (gate(req, res, url, ctx.token, nonce)) return;

  if (url.pathname === "/api/settings/ui-password" && method === "PUT") {
    uiPassword(req, res, ctx).catch(fail);
    return;
  }

  if (url.pathname.startsWith("/api/") && !(["/api/status", "/api/hosts"].includes(url.pathname) && (method === "GET" || method === "HEAD"))) {
    route(req, url, ctx)
      .then((result) => {
        if (result) return sendJson(res, method, result.status, result.body);
        sendJson(res, method, 404, { error: "not found" });
      })
      .catch(fail);
    return;
  }

  if (method !== "GET" && method !== "HEAD") {
    sendJson(res, method, 405, { error: "method not allowed" });
    return;
  }

  switch (url.pathname) {
    case "/":
      sendBody(res, method, 200, "text/html; charset=utf-8", renderPage(nonce, peerOriginOf(req) ? PEER_TOKEN : ctx.token, UiAuth.enabled()));
      return;
    case "/favicon.ico":
      res.statusCode = 204;
      res.end();
      return;
    case "/healthz":
      sendBody(res, method, 200, "text/plain; charset=utf-8", "ok");
      return;
    case "/api/status": {
      const uptimeSec = Math.max(0, Math.round((Date.now() - new Date(ctx.proxyInfo.startedAt).getTime()) / 1000));
      systemStatus(ctx.proxyInfo.caTrusted)
        .then((system) =>
          sendJson(res, method, 200, {
            proxy: ctx.proxyInfo,
            uptimeSec,
            hosts: Object.keys(ctx.getRegistry().hosts).length,
            system: { ...system, cloudflared: cloudflared() },
            hub: ctx.hub(),
          })
        )
        .catch(fail);
      return;
    }
    case "/api/hosts":
      buildHosts(ctx)
        .then((rows) => sendJson(res, method, 200, rows))
        .catch(() => sendJson(res, method, 500, { error: "failed to load hosts" }));
      return;
    default:
      sendJson(res, method, 404, { error: "not found" });
  }
}

/** Set, change or remove the dashboard password from the dashboard; once one is set, the current one is required. */
async function uiPassword(req: http.IncomingMessage, res: http.ServerResponse, ctx: DashboardContext): Promise<void> {
  assertTrusted(req, ctx);
  const body = await readJson(req);
  const ip = loginIp(req);
  if (UiAuth.enabled()) {
    if (UiAuth.limited(ip)) throw new ApiError(429, "Too many wrong passwords. Wait a few minutes and try again.");
    if (!UiAuth.verify(body.current)) {
      UiAuth.fail(ip);
      throw new ApiError(403, "The current password is wrong.", "Forgot it? Run `locadot ui:password` in a terminal.");
    }
    UiAuth.succeed(ip);
  }
  if (body.enabled === false) {
    UiAuth.clear();
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    sendJson(res, req.method || "PUT", 200, { uiAuth: { enabled: false } });
    return;
  }
  try {
    UiAuth.set(body.password as string);
  } catch (err) {
    throw new ApiError(400, (err as Error).message);
  }
  res.setHeader("Set-Cookie", sessionCookie(req));
  sendJson(res, req.method || "PUT", 200, { uiAuth: { enabled: true } });
}

import crypto from "crypto";
import http from "http";
import { DashboardContext, HostEntry, HostStats, ProbeResult, TunnelState } from "../types";
import { renderPage } from "./page";
import { ApiError, route } from "./api";
import { systemStatus } from "../lib/system";
import { cloudflaredInfo as cloudflared } from "../lib/tunnel";

interface HostRow {
  host: string;
  target: string;
  insecure: boolean;
  cors: boolean;
  createdAt: string;
  updatedAt: string;
  urls: { https: string; http: string };
  stats: HostStats | null;
  probe: ProbeResult;
  tunnel: TunnelState;
}

function hostUrls(host: string, httpPort: number, httpsPort: number): { https: string; http: string } {
  const https = `https://${host}` + (httpsPort !== 443 ? `:${httpsPort}` : "");
  const http_ = `http://${host}` + (httpPort !== 80 ? `:${httpPort}` : "");
  return { https, http: http_ };
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
      const probe = await ctx.probe(entry.target);
      return {
        host,
        target: entry.target,
        insecure: !!entry.insecure,
        cors: !!entry.cors,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        urls: hostUrls(host, httpPort, httpsPort),
        stats: stats[host] ?? null,
        probe,
        tunnel: ctx.tunnel(host),
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
      sendBody(res, method, 200, "text/html; charset=utf-8", renderPage(nonce, ctx.token));
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
          sendJson(res, method, 200, { proxy: ctx.proxyInfo, uptimeSec, hosts: Object.keys(ctx.getRegistry().hosts).length, system: { ...system, cloudflared: cloudflared() } })
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

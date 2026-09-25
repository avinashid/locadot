import http from "http";
import type { Duplex } from "stream";
import httpProxy from "http-proxy";
import { proxyNotFound, upstreamDown } from "../constants/template";
import Constants from "../constants";
import logger from "../utils/logger";
import type { HostEntry, HostStats } from "../types";

export interface RouterContext {
  proxy: httpProxy;
  lookup(host: string): HostEntry | undefined;
  stats: Map<string, HostStats>;
  dashboard(req: http.IncomingMessage, res: http.ServerResponse): void;
}

/** Host header without port, lowercased; handles [::1]:443. */
export const hostOf = (req: http.IncomingMessage) => {
  const raw = (req.headers.host || "").trim().toLowerCase();
  if (raw.startsWith("[")) return raw.slice(1, raw.indexOf("]"));
  return raw.split(":")[0].replace(/\.$/, "");
};

const isTls = (req: http.IncomingMessage) => Boolean((req.socket as any).encrypted);

const dashboardUrl = (req: http.IncomingMessage) => {
  const tls = isTls(req);
  const port = tls ? Constants.server.httpsPort : Constants.server.httpPort;
  const standard = tls ? 443 : 80;
  return `${tls ? "https" : "http"}://localhost${port === standard ? "" : `:${port}`}/`;
};

const proxyOptions = (req: http.IncomingMessage, entry: HostEntry): httpProxy.ServerOptions => ({
  target: entry.target,
  changeOrigin: true,
  xfwd: true,
  ws: true,
  secure: !entry.insecure,
  // Keep redirects and cookies on the *.localhost name instead of bouncing
  // the browser to the upstream's real domain.
  autoRewrite: true,
  hostRewrite: req.headers.host,
  protocolRewrite: isTls(req) ? "https" : "http",
  cookieDomainRewrite: { "*": "" },
  headers: { "X-Original-Host": req.headers.host || "", ...(entry.cors ? sameOriginHeaders(req, entry) : {}) },
});

// --cors: the upstream should see a request from its own site, so origin/CSRF checks pass.
const sameOriginHeaders = (req: http.IncomingMessage, entry: HostEntry) => {
  const origin = new URL(entry.target).origin;
  const headers: Record<string, string> = {};
  if (req.headers.origin) headers.Origin = origin;
  if (req.headers.referer) {
    try {
      const referer = new URL(req.headers.referer);
      headers.Referer = origin + referer.pathname + referer.search;
    } catch {
      headers.Referer = origin + "/";
    }
  }
  return headers;
};

const isPreflight = (req: http.IncomingMessage) =>
  req.method === "OPTIONS" && !!req.headers.origin && !!req.headers["access-control-request-method"];

/** Headers that let the calling page read the response, credentials included. */
const allowOrigin = (req: http.IncomingMessage): Record<string, string> =>
  req.headers.origin
    ? { "Access-Control-Allow-Origin": req.headers.origin, "Access-Control-Allow-Credentials": "true", Vary: "Origin" }
    : { "Access-Control-Allow-Origin": "*" };

/**
 * Rewrites an upstream response for a --cors host: our CORS headers replace the upstream's,
 * and cookies become SameSite=None so a page on another origin can send them back.
 */
export const applyCors = (req: http.IncomingMessage, headers: http.IncomingHttpHeaders) => {
  for (const name of Object.keys(headers)) {
    if (name.startsWith("access-control-")) delete headers[name];
  }
  const exposed = Object.keys(headers).filter((name) => name !== "set-cookie" && name !== "vary");
  headers["access-control-allow-origin"] = req.headers.origin || "*";
  if (req.headers.origin) {
    headers["access-control-allow-credentials"] = "true";
    const vary = String(headers.vary || "");
    if (!/(^|,)\s*(origin|\*)\s*(,|$)/i.test(vary)) headers.vary = vary ? `${vary}, Origin` : "Origin";
  }
  if (exposed.length) headers["access-control-expose-headers"] = exposed.join(", ");
  if (isTls(req) && headers["set-cookie"]) {
    headers["set-cookie"] = headers["set-cookie"].map(
      (cookie) => cookie.replace(/;\s*samesite=[^;]*/gi, "").replace(/;\s*secure\b(?!=)/gi, "") + "; SameSite=None; Secure"
    );
  }
};

const record = (stats: Map<string, HostStats>, host: string, status: number, ms: number, error: boolean) => {
  const current = stats.get(host) || { hits: 0, errors: 0 };
  current.hits += 1;
  if (error) current.errors += 1;
  current.lastStatus = status;
  current.lastAccess = new Date().toISOString();
  current.avgMs = current.avgMs === undefined ? ms : Math.round(current.avgMs * 0.8 + ms * 0.2);
  stats.set(host, current);
};

export default class HttpModule {
  static requestHandler(req: http.IncomingMessage, res: http.ServerResponse, ctx: RouterContext) {
    const host = hostOf(req);
    try {
      if (Constants.dashboardHosts.includes(host)) {
        ctx.dashboard(req, res);
        return;
      }

      const entry = ctx.lookup(host);
      if (!entry) {
        res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(proxyNotFound(host, dashboardUrl(req)));
        return;
      }

      // Answered here: upstreams often reject OPTIONS or don't send the headers the browser wants.
      if (entry.cors && isPreflight(req)) {
        const requested = req.headers["access-control-request-headers"];
        res.writeHead(204, {
          ...allowOrigin(req),
          "Access-Control-Allow-Methods": String(req.headers["access-control-request-method"]),
          ...(requested ? { "Access-Control-Allow-Headers": String(requested) } : {}),
          ...(req.headers["access-control-request-private-network"] ? { "Access-Control-Allow-Private-Network": "true" } : {}),
          "Access-Control-Max-Age": "600",
          "Content-Length": "0",
        });
        res.end();
        return;
      }

      const started = Date.now();
      res.once("finish", () => {
        record(ctx.stats, host, res.statusCode, Date.now() - started, res.statusCode >= 500);
      });

      ctx.proxy.web(req, res, proxyOptions(req, entry), (err: any) => {
        logger.warn(`${host} → ${entry.target}: ${err?.code || err?.message}`);
        if (res.headersSent) {
          res.destroy();
          return;
        }
        // With --cors the page should see a 502, not a CORS error.
        res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...(entry.cors ? allowOrigin(req) : {}) });
        res.end(upstreamDown(host, entry.target, err?.code || err?.message || "error", dashboardUrl(req)));
      });
    } catch (error) {
      logger.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  }

  static requestUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer, ctx: RouterContext) {
    const host = hostOf(req);
    socket.on("error", () => socket.destroy());
    try {
      const entry = ctx.lookup(host);
      if (!entry) {
        socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
        return;
      }
      logger.debug(`WebSocket upgrade for ${host}`);
      ctx.proxy.ws(req, socket, head, proxyOptions(req, entry), (err: any) => {
        logger.warn(`${host} WebSocket → ${entry.target}: ${err?.code || err?.message}`);
        socket.destroy();
      });
    } catch (error) {
      logger.error(error);
      socket.destroy();
    }
  }
}

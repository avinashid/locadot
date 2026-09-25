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
  headers: { "X-Original-Host": req.headers.host || "" },
});

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
        res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
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

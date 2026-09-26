import http from "http";
import type { Duplex } from "stream";
import httpProxy from "http-proxy";
import { proxyNotFound, upstreamDown } from "../constants/template";
import Constants from "../constants";
import logger from "../utils/logger";
import { urlFor } from "../lib/urls";
import type { HostEntry, HostStats } from "../types";
import { allowOrigin, isPreflight, preflightHeaders, type Lookup } from "./cors";
import { proxyOptions, viaOptions, viaOrigin } from "./options";
import { isPublicHost } from "./guard";
import { SHIM_PATH, isSameOrigin, parseVia, shimScript, type Via } from "./passthrough";
import { fromTunnel, hostOf, isTls, tag } from "./request";
import { record } from "./stats";

export interface RouterContext {
  proxy: httpProxy;
  lookup: Lookup;
  stats: Map<string, HostStats>;
  dashboard(req: http.IncomingMessage, res: http.ServerResponse): void;
  /** The mapping behind a public tunnel host (xyz.trycloudflare.com), if any. */
  tunnelFor?(host: string): string | undefined;
}

/** Resolves a tunnel's public host to its mapping and tags the request, before any routing. */
const resolveHost = (req: http.IncomingMessage, ctx: RouterContext) => {
  const host = hostOf(req);
  const local = ctx.tunnelFor?.(host);
  if (local) tag(req, { host: local, tunnel: true });
  return local ?? host;
};

const dashboardUrl = (req: http.IncomingMessage) => `${urlFor("localhost", isTls(req))}/`;

const passThrough = (req: http.IncomingMessage, entry: HostEntry) => Boolean(entry.cors);

/** Same-origin only, and a tunnel visitor may only reach public hosts (see guard.ts). */
const viaAllowed = (req: http.IncomingMessage, via: Via) => isSameOrigin(req) && (!fromTunnel(req) || isPublicHost(via.host));

const reason = (err: NodeJS.ErrnoException | undefined) => err?.code || err?.message;

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse, ctx: RouterContext) {
  const host = resolveHost(req, ctx);
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
      res.writeHead(204, preflightHeaders(req));
      res.end();
      return;
    }

    if (passThrough(req, entry) && req.url?.split("?")[0] === SHIM_PATH) {
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
      res.end(shimScript);
      return;
    }
    const via = passThrough(req, entry) ? parseVia(req.url) : undefined;
    if (via && !viaAllowed(req, via)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("locadot: the pass-through only serves the page's own requests, and only public hosts through a tunnel.\n");
      return;
    }

    const started = Date.now();
    res.once("finish", () => {
      record(ctx.stats, host, res.statusCode, Date.now() - started, res.statusCode >= 500);
    });

    let options = proxyOptions(req, entry, ctx.lookup);
    if (via) {
      tag(req, { via });
      options = viaOptions(req, entry, via);
      req.url = via.path;
    }
    const upstream = via ? viaOrigin(via) : entry.target;
    ctx.proxy.web(req, res, options, (err: NodeJS.ErrnoException) => {
      logger.warn(`${host} → ${upstream}: ${reason(err)}`);
      if (res.headersSent) {
        res.destroy();
        return;
      }
      // With --cors the page should see a 502, not a CORS error.
      res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...(entry.cors ? allowOrigin(req) : {}) });
      res.end(upstreamDown(host, upstream, reason(err) || "error", dashboardUrl(req)));
    });
  } catch (error) {
    logger.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}

export function handleUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer, ctx: RouterContext) {
  const host = resolveHost(req, ctx);
  socket.on("error", () => socket.destroy());
  try {
    const entry = ctx.lookup(host);
    if (!entry) {
      socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
      return;
    }
    const via = passThrough(req, entry) ? parseVia(req.url) : undefined;
    if (via && !viaAllowed(req, via)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    logger.debug(`WebSocket upgrade for ${host}`);
    let options = proxyOptions(req, entry, ctx.lookup);
    if (via) {
      options = viaOptions(req, entry, via);
      req.url = via.path;
    }
    ctx.proxy.ws(req, socket, head, options, (err: NodeJS.ErrnoException) => {
      logger.warn(`${host} WebSocket → ${via ? viaOrigin(via) : entry.target}: ${reason(err)}`);
      socket.destroy();
    });
  } catch (error) {
    logger.error(error);
    socket.destroy();
  }
}

import http from "http";
import type { Duplex } from "stream";
import httpProxy from "http-proxy";
import { proxyNotFound, remoteLocalhost, upstreamDown } from "../constants/template";
import Constants from "../constants";
import logger from "../utils/logger";
import { urlFor } from "../lib/urls";
import type { HostEntry, HostStats, Remote } from "../types";
import type { HubDecision } from "./hub";
import { canReachLocalhost, localOptions, remoteOptions, type LocalTarget } from "./remote";
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
  /** Sender side: traffic on the hub's public hostname (see hub.ts). */
  hub?: {
    classify(req: http.IncomingMessage): HubDecision;
    api(req: http.IncomingMessage, res: http.ServerResponse): void;
    secure(): boolean;
  };
  /** Receiver side: the sender a `remote` mapping forwards to. */
  remoteFor?(name: string): Remote | undefined;
  /** Receiver side: `<domain>.localhost` / `<port>.<domain>.localhost` of an admin remote. */
  localFor?(host: string): LocalTarget | undefined;
  /** Receiver side: local names of a remote's mappings, for the landing page. */
  remoteHosts?(name: string): string[];
}

/** Resolves a tunnel's public host to its mapping and tags the request, before any routing. */
const resolveHost = (req: http.IncomingMessage, ctx: RouterContext, hub: HubDecision | undefined) => {
  if (hub?.kind === "app") {
    tag(req, { host: hub.host, remote: true, secure: ctx.hub!.secure() });
    return hub.host;
  }
  if (hub?.kind === "local") {
    const host = `localhost:${hub.port}`;
    tag(req, { host, remote: true, secure: ctx.hub!.secure() });
    return host;
  }
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

const remoteGone = (entry: HostEntry) => `the connection to ${entry.remote!.name} was removed`;

/** Sender side: an admin peer reaching one of this machine's ports. */
const localEntry = (port: number): HostEntry => ({ target: `http://localhost:${port}`, createdAt: "", updatedAt: "" });

const html = (res: http.ServerResponse, status: number, body: string) => {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
};

/** `<port>.<domain>.localhost` on this proxy's scheme and port. */
const portUrl = (req: http.IncomingMessage, domain: string) => {
  const port = (req.headers.host || "").replace(/^\[[^\]]*\]|^[^:]*/, "");
  return `${isTls(req) ? "https" : "http"}://PORT.${domain}.localhost${/^:\d{1,5}$/.test(port) ? port : ""}/`;
};

const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * `<domain>.localhost` spends this machine's admin token, so only this machine's own browser may use it: tunnels
 * (cloudflared connects from loopback but adds Cf-* headers), hub peers and LAN clients all share the listener.
 */
const localTarget = (req: http.IncomingMessage, ctx: RouterContext, host: string, hub: HubDecision | undefined) => {
  if ((hub && hub.kind !== "none") || fromTunnel(req) || !loopback.has(req.socket.remoteAddress || "")) return undefined;
  if (req.headers["cf-ray"] || req.headers["cf-connecting-ip"] || req.headers["cdn-loop"]) return undefined;
  return ctx.localFor?.(host);
};

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse, ctx: RouterContext) {
  const hub = ctx.hub?.classify(req);
  if (hub?.kind === "api") {
    ctx.hub!.api(req, res);
    return;
  }
  if (hub?.kind === "deny") {
    res.writeHead(hub.status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end(`locadot: ${hub.message}\n`);
    return;
  }
  const host = resolveHost(req, ctx, hub);
  try {
    if (Constants.dashboardHosts.includes(host)) {
      ctx.dashboard(req, res);
      return;
    }

    const entry = hub?.kind === "local" ? localEntry(hub.port) : ctx.lookup(host);
    if (!entry) {
      const local = localTarget(req, ctx, host, hub);
      if (local) {
        forwardLocal(req, res, ctx, host, local);
        return;
      }
      res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(proxyNotFound(host, dashboardUrl(req)));
      return;
    }

    if (entry.remote) {
      forwardRemote(req, res, ctx, host, entry);
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

/** Receiver side: the sender does the routing, cors and rewriting; we only add the credentials. */
function forwardRemote(req: http.IncomingMessage, res: http.ServerResponse, ctx: RouterContext, host: string, entry: HostEntry) {
  const remote = ctx.remoteFor?.(entry.remote!.name);
  if (!remote) {
    res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(upstreamDown(host, entry.target, remoteGone(entry), dashboardUrl(req)));
    return;
  }
  const started = Date.now();
  res.once("finish", () => record(ctx.stats, host, res.statusCode, Date.now() - started, res.statusCode >= 500));
  ctx.proxy.web(req, res, remoteOptions(req, entry, remote), (err: NodeJS.ErrnoException) => {
    logger.warn(`${host} → ${remote.name} (${remote.url}): ${reason(err)}`);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(upstreamDown(host, `${remote.name}: ${entry.remote!.host}`, reason(err) || "error", dashboardUrl(req)));
  });
}

/** Receiver side: the sender checks the role again and proxies to its own localhost:<port>. */
function forwardLocal(req: http.IncomingMessage, res: http.ServerResponse, ctx: RouterContext, host: string, local: LocalTarget) {
  const { remote, domain, port } = local;
  const allowed = canReachLocalhost(remote);
  if (!port || !allowed) {
    const hosts = (ctx.remoteHosts?.(remote.name) || []).map((h) => ({ local: h, url: `${urlFor(h, isTls(req))}/` }));
    const body = remoteLocalhost({ domain, name: remote.name, sender: remote.sender.hostname, allowed, hosts, portUrl: portUrl(req, domain), dashboardUrl: dashboardUrl(req) });
    html(res, port ? 403 : 200, body);
    return;
  }
  const started = Date.now();
  res.once("finish", () => record(ctx.stats, host, res.statusCode, Date.now() - started, res.statusCode >= 500));
  ctx.proxy.web(req, res, localOptions(req, remote, port), (err: NodeJS.ErrnoException) => {
    logger.warn(`${host} → ${remote.name} localhost:${port}: ${reason(err)}`);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    html(res, 502, upstreamDown(host, `${remote.name}: localhost:${port}`, reason(err) || "error", dashboardUrl(req)));
  });
}

export function handleUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer, ctx: RouterContext) {
  socket.on("error", () => socket.destroy());
  const hub = ctx.hub?.classify(req);
  if (hub?.kind === "api" || hub?.kind === "deny") {
    const status = hub.kind === "deny" ? hub.status : 400;
    socket.end(`HTTP/1.1 ${status} ${http.STATUS_CODES[status] || "Error"}\r\nConnection: close\r\n\r\n`);
    return;
  }
  const host = resolveHost(req, ctx, hub);
  try {
    const entry = hub?.kind === "local" ? localEntry(hub.port) : ctx.lookup(host);
    if (!entry) {
      const local = localTarget(req, ctx, host, hub);
      if (local?.port && canReachLocalhost(local.remote)) {
        ctx.proxy.ws(req, socket, head, localOptions(req, local.remote, local.port), (err: NodeJS.ErrnoException) => {
          logger.warn(`${host} WebSocket → ${local.remote.name} localhost:${local.port}: ${reason(err)}`);
          socket.destroy();
        });
        return;
      }
      socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
      return;
    }
    if (entry.remote) {
      const remote = ctx.remoteFor?.(entry.remote.name);
      if (!remote) {
        socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
        return;
      }
      ctx.proxy.ws(req, socket, head, remoteOptions(req, entry, remote), (err: NodeJS.ErrnoException) => {
        logger.warn(`${host} WebSocket → ${remote.name}: ${reason(err)}`);
        socket.destroy();
      });
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

import http from "http";
import net from "net";
import type { Duplex } from "stream";
import httpProxy from "http-proxy";
import { proxyNotFound, remoteLocalhost, upstreamDown } from "../constants/template";
import Constants from "../constants";
import logger from "../utils/logger";
import { urlFor } from "../lib/urls";
import type { HostEntry, HostStats, Remote } from "../types";
import type { HubDecision } from "./hub";
import { LANDING_PATH, canReachLocalhost, localOptions, remoteOptions, type LocalTarget } from "./remote";
import { allowOrigin, isPreflight, preflightHeaders, type Lookup } from "./cors";
import { proxyOptions, viaOptions, viaOrigin, type Listed } from "./options";
import { isLoopbackHost, isPublicHost, isSelfAddress } from "./guard";
import { allowMatches, splitHost } from "../lib/allow";
import { SHIM_PATH, isSameOrigin, parseVia, shimScript, type Via } from "./passthrough";
import { fromRemote, fromTunnel, hostOf, isTls, loopbackOf, tag } from "./request";
import { record } from "./stats";
import { guard, guardUpgrade } from "./protect";
import { redirectToHttps, wantsHttps } from "./https-redirect";

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
  /** Receiver side: `<domain>.localhost` (the sender's dashboard) / `<port>.<domain>.localhost` of an admin remote. */
  localFor?(host: string): LocalTarget | undefined;
  /** Receiver side: local names of a remote's mappings, for the landing page. */
  remoteHosts?(name: string): string[];
  /** The proxy's own ports, which a mapping's `allow` list can never open up. */
  ownPorts?(): number[];
  /** The global `httpsRedirect` setting; a mapping's own `httpsRedirect` wins over it. */
  httpsRedirect?(): boolean;
  httpsPort?(): number;
}

// Cloudflare swaps an origin's 502/504 for its own "bad gateway" page, so through a tunnel say 503 and the page survives.
const downStatus = (req: http.IncomingMessage) => (fromTunnel(req) || fromRemote(req) ? 503 : 502);

/** Resolves a tunnel's public host to its mapping and tags the request, before any routing. */
const resolveHost = (req: http.IncomingMessage, ctx: RouterContext, hub: HubDecision | undefined) => {
  if (hub?.kind === "app") {
    tag(req, { host: hub.host, remote: true, secure: ctx.hub!.secure(), peerNames: hub.names, loopback: hub.loopback });
    return hub.host;
  }
  if (hub?.kind === "panel") {
    tag(req, { host: "localhost", remote: true, secure: ctx.hub!.secure(), peerOrigin: (req.headers.host || "").toLowerCase(), panel: true });
    return "localhost";
  }
  if (hub?.kind === "dashboard") {
    tag(req, { host: "localhost", remote: true, secure: ctx.hub!.secure(), peerOrigin: hub.origin });
    return "localhost";
  }
  if (hub?.kind === "local") {
    // A port behind a --cors mapping is served as that mapping, cors included.
    const host = hub.host ?? `localhost:${hub.port}`;
    tag(req, { host, remote: true, secure: ctx.hub!.secure(), peerNames: hub.names, loopback: hub.loopback });
    return host;
  }
  const host = hostOf(req);
  const local = ctx.tunnelFor?.(host);
  if (local) tag(req, { host: local, tunnel: true });
  return local ?? host;
};

const dashboardUrl = (req: http.IncomingMessage) => `${urlFor("localhost", isTls(req))}/`;

const passThrough = (req: http.IncomingMessage, entry: HostEntry) => Boolean(entry.cors);

/** A hub peer reaches this machine's localhost:<port> only with localhost access, and never the proxy's own ports. */
const peerMayReach = (req: http.IncomingMessage, via: Via) => {
  if (!fromRemote(req) || !isLoopbackHost(via.host)) return true;
  const allowed = loopbackOf(req);
  const port = Number(via.host.match(/:(\d+)$/)?.[1] || (via.scheme === "https" || via.scheme === "wss" ? 443 : 80));
  return Boolean(allowed && !allowed.includes(port));
};

/**
 * An address on the mapping's `allow` list. The proxy's own ports on this machine never are (the dashboard is behind
 * them): "not-self" means the name must be checked at connect time, on the address actually dialled.
 */
const listed = (req: http.IncomingMessage, ctx: RouterContext, entry: HostEntry, via: Via): Listed => {
  if (!(fromTunnel(req) || fromRemote(req)) || !allowMatches(entry.allow, via.host, via.scheme)) return undefined;
  const { host, port } = splitHost(via.host, via.scheme);
  if (!(ctx.ownPorts?.() ?? []).includes(port)) return "open";
  return isSelfAddress(host) ? undefined : net.isIP(host) ? "open" : "not-self";
};

/**
 * Same-origin only, a tunnel visitor may only reach public hosts (see guard.ts), and a peer only its share of localhost,
 * unless the mapping's owner listed the address in `allow`.
 */
const viaAllowed = (req: http.IncomingMessage, via: Via, allowed: Listed) =>
  isSameOrigin(req) && (Boolean(allowed) || ((!fromTunnel(req) || isPublicHost(via.host)) && peerMayReach(req, via)));

/**
 * Receiver side: `<sender host>=<our URL for it>` for every mapping of this remote, so a --cors sender rewrites
 * its apps' origins to the names this machine uses rather than its own.
 */
const peerNames = (req: http.IncomingMessage, ctx: RouterContext, name: string) =>
  (ctx.remoteHosts?.(name) || [])
    .flatMap((local) => {
      const host = ctx.lookup(local)?.remote?.host;
      return host ? [`${host}=${urlFor(local, isTls(req))}`] : [];
    })
    .join(",");

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
    if (wantsHttps(req, ctx, host, hub)) {
      redirectToHttps(req, res, ctx);
      return;
    }
    if (Constants.dashboardHosts.includes(host)) {
      ctx.dashboard(req, res);
      return;
    }

    const entry = hub?.kind === "local" && !hub.host ? localEntry(hub.port) : ctx.lookup(host);
    if (!entry) {
      const local = localTarget(req, ctx, host, hub);
      if (local) {
        forwardLocal(req, res, ctx, host, local);
        return;
      }
      res.writeHead(downStatus(req), { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
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
    if (guard(req, res, host, entry)) return;
    const via = passThrough(req, entry) ? parseVia(req.url) : undefined;
    const allowed = via && listed(req, ctx, entry, via);
    if (via && !viaAllowed(req, via, allowed)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(
        `locadot: the pass-through only serves the page's own requests, and only public hosts to shared visitors. ` +
          `To let them reach ${via.host}, run \`locadot allow --host ${host} ${via.host}\` on this machine, or use Internal access on the mapping in the dashboard.\n`
      );
      return;
    }

    const started = Date.now();
    res.once("finish", () => {
      record(ctx.stats, host, res.statusCode, Date.now() - started, res.statusCode >= 500);
    });

    let options = proxyOptions(req, entry, ctx.lookup);
    if (via) {
      tag(req, { via });
      options = viaOptions(req, entry, via, allowed);
      req.url = via.path;
    }
    const upstream = via ? viaOrigin(via) : entry.target;
    ctx.proxy.web(req, res, options, (err: NodeJS.ErrnoException) => {
      logger.warn(`${host} → ${upstream}: ${reason(err)}`);
      if (res.headersSent) {
        res.destroy();
        return;
      }
      // With --cors the page should see the error, not a CORS failure.
      res.writeHead(downStatus(req), { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...(entry.cors ? allowOrigin(req) : {}) });
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
  ctx.proxy.web(req, res, remoteOptions(req, entry, remote, peerNames(req, ctx, remote.name)), (err: NodeJS.ErrnoException) => {
    logger.warn(`${host} → ${remote.name} (${remote.url}): ${reason(err)}`);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(upstreamDown(host, `${remote.name}: ${entry.remote!.host}`, reason(err) || "error", dashboardUrl(req)));
  });
}

/**
 * Receiver side: `<domain>.localhost` is the sender's dashboard and `<port>.<domain>.localhost` its localhost:<port>.
 * The sender checks the role again on every request.
 */
function forwardLocal(req: http.IncomingMessage, res: http.ServerResponse, ctx: RouterContext, host: string, local: LocalTarget) {
  const { remote, domain, port } = local;
  const allowed = canReachLocalhost(remote);
  const landing = !port && (req.url || "/").split("?")[0] === LANDING_PATH;
  if (!allowed || landing) {
    const hosts = (ctx.remoteHosts?.(remote.name) || []).map((h) => ({ local: h, url: `${urlFor(h, isTls(req))}/` }));
    const body = remoteLocalhost({ domain, name: remote.name, sender: remote.sender.hostname, allowed, hosts, portUrl: portUrl(req, domain), dashboardUrl: dashboardUrl(req) });
    html(res, port && !allowed ? 403 : 200, body);
    return;
  }
  const label = `${remote.name}: ${port ? `localhost:${port}` : "dashboard"}`;
  const started = Date.now();
  res.once("finish", () => record(ctx.stats, host, res.statusCode, Date.now() - started, res.statusCode >= 500));
  ctx.proxy.web(req, res, localOptions(req, remote, port, port ? peerNames(req, ctx, remote.name) : undefined), (err: NodeJS.ErrnoException) => {
    logger.warn(`${host} → ${label}: ${reason(err)}`);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    html(res, downStatus(req), upstreamDown(host, label, reason(err) || "error", dashboardUrl(req)));
  });
}

export function handleUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer, ctx: RouterContext) {
  socket.on("error", () => socket.destroy());
  const hub = ctx.hub?.classify(req);
  if (hub?.kind === "api" || hub?.kind === "deny" || hub?.kind === "panel") {
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
    if (guardUpgrade(req, socket, host, entry)) return;
    const via = passThrough(req, entry) ? parseVia(req.url) : undefined;
    const allowed = via && listed(req, ctx, entry, via);
    if (via && !viaAllowed(req, via, allowed)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    logger.debug(`WebSocket upgrade for ${host}`);
    let options = proxyOptions(req, entry, ctx.lookup);
    if (via) {
      options = viaOptions(req, entry, via, allowed);
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

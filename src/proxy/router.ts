import http from "http";
import type { Duplex } from "stream";
import zlib from "zlib";
import httpProxy from "http-proxy";
import { proxyNotFound, upstreamDown } from "../constants/template";
import Constants from "../constants";
import logger from "../utils/logger";
import type { HostEntry, HostStats } from "../types";
import { SHIM_PATH, injectShim, isSameOrigin, parseVia, shimScript, viaHeaders, type Via } from "./passthrough";

export interface RouterContext {
  proxy: httpProxy;
  lookup(host: string): HostEntry | undefined;
  stats: Map<string, HostStats>;
  dashboard(req: http.IncomingMessage, res: http.ServerResponse): void;
  /** The mapping behind a public tunnel host (xyz.trycloudflare.com), if any. */
  tunnelFor?(host: string): string | undefined;
}

/** Host header without port, lowercased; handles [::1]:443. */
export const hostOf = (req: http.IncomingMessage) => {
  const raw = (req.headers.host || "").trim().toLowerCase();
  if (raw.startsWith("[")) return raw.slice(1, raw.indexOf("]"));
  return raw.split(":")[0].replace(/\.$/, "");
};

/** Tunnel visitors are on https even though cloudflared talks plain http to us. */
const isTls = (req: http.IncomingMessage) => Boolean((req.socket as any).encrypted) || fromTunnel(req);

/** The mapping a request is for: its Host, or the mapping behind a tunnel's public host. */
export const mappedHost = (req: http.IncomingMessage) => (req as any).locadotHost ?? hostOf(req);

export const fromTunnel = (req: http.IncomingMessage) => Boolean((req as any).locadotTunnel);

/** Resolves a tunnel's public host to its mapping and tags the request, before any routing. */
const resolveHost = (req: http.IncomingMessage, ctx: RouterContext) => {
  const host = hostOf(req);
  const local = ctx.tunnelFor?.(host);
  if (local) Object.assign(req as any, { locadotHost: local, locadotTunnel: true });
  return local ?? host;
};

const dashboardUrl = (req: http.IncomingMessage) => {
  const tls = isTls(req);
  const port = tls ? Constants.server.httpsPort : Constants.server.httpPort;
  const standard = tls ? 443 : 80;
  return `${tls ? "https" : "http"}://localhost${port === standard ? "" : `:${port}`}/`;
};

const proxyOptions = (req: http.IncomingMessage, entry: HostEntry, lookup: RouterContext["lookup"]): httpProxy.ServerOptions => ({
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
  headers: { "X-Original-Host": req.headers.host || "", ...(entry.cors ? { ...sameOriginHeaders(req, entry, lookup), ...DECODABLE } : {}) },
});

// --cors bodies are rewritten, so only ask for encodings we can decode (browsers also offer zstd).
const DECODABLE = { "Accept-Encoding": "gzip, deflate, br" };

const viaOptions = (req: http.IncomingMessage, entry: HostEntry, via: Via): httpProxy.ServerOptions => ({
  target: `${via.scheme}://${via.host}`,
  changeOrigin: true,
  ws: true,
  secure: !entry.insecure,
  cookieDomainRewrite: { "*": "" },
  headers: { ...viaHeaders(req, via, entry.target), ...DECODABLE },
});

/**
 * --cors: the upstream should see a request from a site it trusts, so origin/CSRF checks pass.
 * A page on another mapped domain (signalsant.localhost calling api.signalsant.localhost) is
 * sent as that domain's real origin; anything else as the target's own origin.
 */
const sameOriginHeaders = (req: http.IncomingMessage, entry: HostEntry, lookup: RouterContext["lookup"]) => {
  const upstreamOrigin = (value: string) => {
    try {
      const caller = lookup(new URL(value).hostname);
      if (caller) return new URL(caller.target).origin;
    } catch {}
    return new URL(entry.target).origin;
  };
  const headers: Record<string, string> = {};
  if (req.headers.origin) headers.Origin = upstreamOrigin(req.headers.origin);
  if (req.headers.referer) {
    try {
      const referer = new URL(req.headers.referer);
      headers.Referer = upstreamOrigin(referer.href) + referer.pathname + referer.search;
    } catch {
      headers.Referer = new URL(entry.target).origin + "/";
    }
  }
  return headers;
};

const REWRITABLE = /^(text\/(?!event-stream)|application\/(javascript|x-javascript|ecmascript|json|xml|[\w.+-]+\+(json|xml))\b)/i;
const DECODERS: Record<string, (body: Buffer) => Buffer> = {
  gzip: zlib.gunzipSync,
  "x-gzip": zlib.gunzipSync,
  deflate: zlib.inflateSync,
  br: zlib.brotliDecompressSync,
};

/** [real origin, local origin] for every mapping, e.g. https://api.x.com → https://api.x.localhost. */
export const originMap = (req: http.IncomingMessage, hosts: Record<string, HostEntry>): [string, string][] => {
  const tls = isTls(req);
  const port = tls ? Constants.server.httpsPort : Constants.server.httpPort;
  const suffix = port === (tls ? 443 : 80) ? "" : `:${port}`;
  const self = hostOf(req);
  const pairs: [string, string, boolean][] = [];
  for (const [host, entry] of Object.entries(hosts)) {
    try {
      pairs.push([new URL(entry.target).origin, `${tls ? "https" : "http"}://${host}${suffix}`, host === self]);
    } catch {}
  }
  // Longest first, so https://a.x.com is not half-replaced by a mapping for https://x.com;
  // when two domains share a target, the one serving this response wins.
  return pairs
    .sort((a, b) => b[0].length - a[0].length || Number(b[2]) - Number(a[2]))
    .map(([from, to]) => [from, to]);
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replaces real origins with local ones, plain and JSON-escaped (https:\/\/…). */
export const rewriteOrigins = (text: string, pairs: [string, string][]) => {
  for (const [from, to] of pairs) {
    for (const [a, b] of [[from, to], [from.replace(/\//g, "\\/"), to.replace(/\//g, "\\/")]]) {
      text = text.replace(new RegExp(escapeRegex(a) + "(?![\\w.-])", "gi"), b);
    }
  }
  return text;
};

/**
 * --cors: pages that call other domains by absolute URL (`https://api.x.com`) bypass the proxy,
 * so the browser applies the real API's CORS policy. Rewriting mapped origins in text bodies
 * keeps those calls on .localhost. Buffers the body; streams (SSE, binary) pass through.
 */
export const rewriteBody = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  proxyRes: http.IncomingMessage,
  pairs: [string, string][],
  inject = false
) => {
  const headers = proxyRes.headers;
  const encoding = String(headers["content-encoding"] || "identity").toLowerCase();
  if (!pairs.length || req.method === "HEAD" || !REWRITABLE.test(String(headers["content-type"] || ""))) return;
  if (encoding !== "identity" && !DECODERS[encoding]) return;
  if (proxyRes.statusCode === 204 || proxyRes.statusCode === 304) return;

  delete headers["content-length"];
  delete headers["content-encoding"];
  delete headers["transfer-encoding"];
  const chunks: Buffer[] = [];
  const end = res.end.bind(res);
  res.write = ((chunk: any) => {
    if (chunk) chunks.push(Buffer.from(chunk));
    return true;
  }) as any;
  res.end = ((chunk?: any) => {
    if (chunk && typeof chunk !== "function") chunks.push(Buffer.from(chunk));
    let body: Buffer = Buffer.concat(chunks);
    try {
      if (encoding !== "identity") body = DECODERS[encoding](body);
      let text = rewriteOrigins(body.toString("utf8"), pairs);
      if (inject && /^text\/html/i.test(String(headers["content-type"]))) text = injectShim(text);
      body = Buffer.from(text, "utf8");
    } catch (error) {
      logger.warn(`${hostOf(req)}: could not rewrite response body: ${error}`);
      res.statusCode = 502;
      body = Buffer.alloc(0);
    }
    if (!res.headersSent) res.setHeader("Content-Length", body.length);
    return end(body);
  }) as any;
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
    const host = resolveHost(req, ctx);
    // The pass-through fetches arbitrary URLs from this machine; never offer it to the internet.
    const passThrough = (entry: HostEntry) => entry.cors && !fromTunnel(req);
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

      if (passThrough(entry) && req.url?.split("?")[0] === SHIM_PATH) {
        res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
        res.end(shimScript);
        return;
      }
      const via = passThrough(entry) ? parseVia(req.url) : undefined;
      if (via && !isSameOrigin(req)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("locadot: the pass-through only serves the page's own requests.\n");
        return;
      }

      const started = Date.now();
      res.once("finish", () => {
        record(ctx.stats, host, res.statusCode, Date.now() - started, res.statusCode >= 500);
      });

      let options = proxyOptions(req, entry, ctx.lookup);
      if (via) {
        (req as any).locadotVia = via;
        options = viaOptions(req, entry, via);
        req.url = via.path;
      }
      const upstream = via ? `${via.scheme}://${via.host}` : entry.target;
      ctx.proxy.web(req, res, options, (err: any) => {
        logger.warn(`${host} → ${upstream}: ${err?.code || err?.message}`);
        if (res.headersSent) {
          res.destroy();
          return;
        }
        // With --cors the page should see a 502, not a CORS error.
        res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...(entry.cors ? allowOrigin(req) : {}) });
        res.end(upstreamDown(host, upstream, err?.code || err?.message || "error", dashboardUrl(req)));
      });
    } catch (error) {
      logger.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  }

  static requestUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer, ctx: RouterContext) {
    const host = resolveHost(req, ctx);
    socket.on("error", () => socket.destroy());
    try {
      const entry = ctx.lookup(host);
      if (!entry) {
        socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
        return;
      }
      const via = entry.cors && !fromTunnel(req) ? parseVia(req.url) : undefined;
      if (via && !isSameOrigin(req)) {
        socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        return;
      }
      logger.debug(`WebSocket upgrade for ${host}`);
      let options = proxyOptions(req, entry, ctx.lookup);
      if (via) {
        options = viaOptions(req, entry, via);
        req.url = via.path;
      }
      ctx.proxy.ws(req, socket, head, options, (err: any) => {
        logger.warn(`${host} WebSocket → ${via ? `${via.scheme}://${via.host}` : entry.target}: ${err?.code || err?.message}`);
        socket.destroy();
      });
    } catch (error) {
      logger.error(error);
      socket.destroy();
    }
  }
}

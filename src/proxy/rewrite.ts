import http from "http";
import zlib from "zlib";
import logger from "../utils/logger";
import { urlFor } from "../lib/urls";
import type { HostEntry } from "../types";
import { injectShim } from "./passthrough";
import { hostOf, isTls } from "./request";

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
  const self = hostOf(req);
  const pairs: [string, string, boolean][] = [];
  for (const [host, entry] of Object.entries(hosts)) {
    try {
      pairs.push([new URL(entry.target).origin, urlFor(host, tls), host === self]);
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

type Chunk = string | Uint8Array | undefined;

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
  res.write = ((chunk: Chunk) => {
    if (chunk) chunks.push(Buffer.from(chunk));
    return true;
  }) as typeof res.write;
  res.end = ((chunk?: Chunk | (() => void)) => {
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
  }) as typeof res.end;
};

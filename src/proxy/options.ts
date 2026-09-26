import http from "http";
import httpProxy from "http-proxy";
import type { HostEntry } from "../types";
import { sameOriginHeaders, type Lookup } from "./cors";
import { publicOnlyAgents } from "./guard";
import { viaHeaders, type Via } from "./passthrough";
import { fromTunnel, isTls } from "./request";

// --cors bodies are rewritten, so only ask for encodings we can decode (browsers also offer zstd).
const DECODABLE = { "Accept-Encoding": "gzip, deflate, br" };

export const proxyOptions = (req: http.IncomingMessage, entry: HostEntry, lookup: Lookup): httpProxy.ServerOptions => ({
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

export const viaOptions = (req: http.IncomingMessage, entry: HostEntry, via: Via): httpProxy.ServerOptions => ({
  target: viaOrigin(via),
  changeOrigin: true,
  ws: true,
  secure: !entry.insecure,
  cookieDomainRewrite: { "*": "" },
  headers: { ...viaHeaders(req, via, entry.target), ...DECODABLE },
  ...(fromTunnel(req) ? { agent: via.scheme === "https" || via.scheme === "wss" ? publicOnlyAgents.https : publicOnlyAgents.http } : {}),
});

export const viaOrigin = (via: Via) => `${via.scheme}://${via.host}`;

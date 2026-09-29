import http from "http";
import httpProxy from "http-proxy";
import type { HostEntry } from "../types";
import { sameOriginHeaders, type Lookup } from "./cors";
import { notSelfAgents, publicOnlyAgents } from "./guard";
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

/** On the mapping's allow list: "open" goes anywhere, "not-self" anywhere but this machine (see router.ts). */
export type Listed = "open" | "not-self" | undefined;

const agentFor = (req: http.IncomingMessage, via: Via, listed: Listed) => {
  const tls = via.scheme === "https" || via.scheme === "wss";
  if (listed === "not-self") return { agent: tls ? notSelfAgents.https : notSelfAgents.http };
  if (fromTunnel(req) && !listed) return { agent: tls ? publicOnlyAgents.https : publicOnlyAgents.http };
  return {};
};

export const viaOptions = (req: http.IncomingMessage, entry: HostEntry, via: Via, listed?: Listed): httpProxy.ServerOptions => ({
  target: viaOrigin(via),
  changeOrigin: true,
  ws: true,
  secure: !entry.insecure,
  cookieDomainRewrite: { "*": "" },
  headers: { ...viaHeaders(req, via, entry.target), ...DECODABLE },
  ...agentFor(req, via, listed),
});

export const viaOrigin = (via: Via) => `${via.scheme}://${via.host}`;

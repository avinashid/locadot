import http from "http";
import type { HostEntry } from "../types";
import { applyCors } from "./cors";
import { rewriteViaResponse } from "./passthrough";
import { mappedHost, viaOf } from "./request";
import { originMap, rewriteBody, rewriteOrigins, type PublicUrl } from "./rewrite";

// Hop-by-hop headers describe the upstream connection, not ours. Apache sends
// `Connection: Upgrade, close` + `Upgrade: h2`, which made us close the browser's
// socket after every response (ERR_TOO_MANY_RETRIES on asset-heavy pages).
const stripHopByHop = (headers: http.IncomingHttpHeaders) => {
  const listed = String(headers.connection || "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  for (const name of [...listed, "connection", "keep-alive", "upgrade", "proxy-connection"]) {
    delete headers[name];
  }
};

/** http-proxy `proxyRes` pipeline: hop-by-hop cleanup, then --cors headers and origin rewriting. */
export const handleProxyResponse = (
  proxyRes: http.IncomingMessage,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  hosts: Record<string, HostEntry>,
  publicUrl: PublicUrl = () => undefined
) => {
  if (proxyRes.statusCode === 101) return;
  stripHopByHop(proxyRes.headers);
  const entry = hosts[mappedHost(req)];
  if (!entry?.cors) return;
  applyCors(req, proxyRes.headers);
  const via = viaOf(req);
  const pairs = originMap(req, hosts, publicUrl);
  if (via) rewriteViaResponse(proxyRes.headers, via, entry.target);
  else if (proxyRes.headers.location) proxyRes.headers.location = rewriteOrigins(proxyRes.headers.location, pairs);
  rewriteBody(req, res, proxyRes, pairs, !via);
};

import http from "http";
import type { HostEntry } from "../types";
import { isTls } from "./request";

export type Lookup = (host: string) => HostEntry | undefined;

export const isPreflight = (req: http.IncomingMessage) =>
  req.method === "OPTIONS" && !!req.headers.origin && !!req.headers["access-control-request-method"];

/** Headers that let the calling page read the response, credentials included. */
export const allowOrigin = (req: http.IncomingMessage): Record<string, string> =>
  req.headers.origin
    ? { "Access-Control-Allow-Origin": req.headers.origin, "Access-Control-Allow-Credentials": "true", Vary: "Origin" }
    : { "Access-Control-Allow-Origin": "*" };

export const preflightHeaders = (req: http.IncomingMessage) => {
  const requested = req.headers["access-control-request-headers"];
  return {
    ...allowOrigin(req),
    "Access-Control-Allow-Methods": String(req.headers["access-control-request-method"]),
    ...(requested ? { "Access-Control-Allow-Headers": String(requested) } : {}),
    ...(req.headers["access-control-request-private-network"] ? { "Access-Control-Allow-Private-Network": "true" } : {}),
    "Access-Control-Max-Age": "600",
    "Content-Length": "0",
  };
};

/**
 * --cors: the upstream should see a request from a site it trusts, so origin/CSRF checks pass.
 * A page on another mapped domain (signalsant.localhost calling api.signalsant.localhost) is
 * sent as that domain's real origin; anything else as the target's own origin.
 */
export const sameOriginHeaders = (req: http.IncomingMessage, entry: HostEntry, lookup: Lookup) => {
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

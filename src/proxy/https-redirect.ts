import http from "http";
import net from "net";
import Constants from "../constants";
import { formatUrl } from "../lib/urls";
import type { HostEntry } from "../types";
import type { HubDecision } from "./hub";
import { fromRemote, fromTunnel, hostOf, isTls } from "./request";

export interface RedirectContext {
  lookup(host: string): HostEntry | undefined;
  /** The global `httpsRedirect` setting. */
  httpsRedirect?(): boolean;
  httpsPort?(): number;
  /** Receiver side: a remote's `<domain>.localhost` names, which have no mapping of their own. */
  localFor?(host: string): unknown;
}

/** The CLI and scripts talk to the dashboard's API and health check over plain http. */
const dashboardExempt = (url: string) => {
  const path = url.split("?")[0];
  return path === "/healthz" || path === "/api" || path.startsWith("/api/");
};

/** Whether this request should be sent to https: the mapping's own choice, else the global setting. */
export const wantsHttps = (req: http.IncomingMessage, ctx: RedirectContext, host: string, hub: HubDecision | undefined) => {
  // Tunnels, the hub and peers reach the http port on purpose and are already https on their public side.
  if (isTls(req) || (hub && hub.kind !== "none") || fromTunnel(req) || fromRemote(req)) return false;
  if (req.headers["cf-ray"] || req.headers["cf-connecting-ip"] || req.headers["cdn-loop"]) return false;
  const global = ctx.httpsRedirect?.() === true;
  if (Constants.dashboardHosts.includes(host)) return global && !dashboardExempt(req.url || "/");
  const entry = ctx.lookup(host);
  if (entry) return entry.httpsRedirect ?? global;
  return global && Boolean(ctx.localFor?.(host));
};

/** 307 keeps the method and body, and isn't cached, so turning the setting off takes effect straight away. */
export const redirectToHttps = (req: http.IncomingMessage, res: http.ServerResponse, ctx: RedirectContext) => {
  const name = hostOf(req);
  const origin = formatUrl(net.isIPv6(name) ? `[${name}]` : name, true, ctx.httpsPort?.() ?? Constants.server.httpsPort);
  const path = req.url?.startsWith("/") ? req.url : "/";
  res.writeHead(307, { Location: origin + path, "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" });
  res.end(`Redirecting to ${origin}${path}\n`);
};

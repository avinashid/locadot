import fs from "fs";
import http from "http";
import httpProxy from "http-proxy";
import Constants from "../constants";
import { isTls } from "./request";
import type { HostEntry, Remote } from "../types";

interface RemotesFile {
  remotes: Record<string, Remote>;
}

let cache: { mtimeMs: number; data: RemotesFile } | undefined;

/** REMOTES_FILE, re-parsed only when its mtime changes so the proxy doesn't hit disk per request. */
const remotes = (): Record<string, Remote> => {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(Constants.paths.REMOTES_FILE);
  } catch {
    cache = undefined;
    return {};
  }
  if (!cache || cache.mtimeMs !== stat.mtimeMs) {
    let data: RemotesFile = { remotes: {} };
    try {
      const parsed = JSON.parse(fs.readFileSync(Constants.paths.REMOTES_FILE, "utf8"));
      if (parsed && typeof parsed.remotes === "object") data = parsed;
    } catch {}
    cache = { mtimeMs: stat.mtimeMs, data };
  }
  return cache.data.remotes;
};

export const remoteFor = (name: string): Remote | undefined => remotes()[name];

export const remoteOptions = (req: http.IncomingMessage, entry: HostEntry, remote: Remote): httpProxy.ServerOptions => ({
  target: remote.url,
  changeOrigin: true,
  // Don't leak the receiver's LAN addresses to the sender.
  xfwd: false,
  ws: true,
  secure: true,
  autoRewrite: true,
  hostRewrite: req.headers.host,
  protocolRewrite: isTls(req) ? "https" : "http",
  cookieDomainRewrite: { "*": "" },
  headers: {
    "X-Original-Host": req.headers.host || "",
    "X-Locadot-Peer": remote.token,
    "X-Locadot-Host": entry.remote!.host,
  },
});

export interface LocalTarget {
  remote: Remote;
  domain: string;
  /** Absent for the bare `<domain>.localhost` landing page. */
  port?: number;
}

/** Receiver side: `<domain>.localhost` / `<port>.<domain>.localhost` → the admin remote that owns `domain`. */
export const localFor = (host: string): LocalTarget | undefined => {
  if (!host.endsWith(".localhost")) return undefined;
  const labels = host.slice(0, -".localhost".length).split(".");
  if (labels.length > 2) return undefined;
  const domain = labels[labels.length - 1];
  let port: number | undefined;
  if (labels.length === 2) {
    if (!/^\d{1,5}$/.test(labels[0])) return undefined;
    port = Number(labels[0]);
    if (port < 1 || port > 65535) return undefined;
  }
  const remote = Object.values(remotes()).find((r) => r.domain === domain);
  return remote ? { remote, domain, port } : undefined;
};

export const canReachLocalhost = (remote: Remote) => remote.role === "admin" && remote.localhost !== false;

export const localOptions = (req: http.IncomingMessage, remote: Remote, port: number): httpProxy.ServerOptions => ({
  target: remote.url,
  changeOrigin: true,
  xfwd: false,
  ws: true,
  secure: true,
  autoRewrite: true,
  hostRewrite: req.headers.host,
  protocolRewrite: isTls(req) ? "https" : "http",
  cookieDomainRewrite: { "*": "" },
  headers: {
    "X-Original-Host": req.headers.host || "",
    "X-Locadot-Peer": remote.token,
    "X-Locadot-Port": String(port),
  },
});

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
export const remoteFor = (name: string): Remote | undefined => {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(Constants.paths.REMOTES_FILE);
  } catch {
    cache = undefined;
    return undefined;
  }
  if (!cache || cache.mtimeMs !== stat.mtimeMs) {
    let data: RemotesFile = { remotes: {} };
    try {
      const parsed = JSON.parse(fs.readFileSync(Constants.paths.REMOTES_FILE, "utf8"));
      if (parsed && typeof parsed.remotes === "object") data = parsed;
    } catch {}
    cache = { mtimeMs: stat.mtimeMs, data };
  }
  return cache.data.remotes[name];
};

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

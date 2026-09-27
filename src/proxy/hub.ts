import http from "http";
import os from "os";
import Constants from "../constants";
import logger from "../utils/logger";
import Links, { LinkError } from "../lib/links";
import HostOps, { ConflictError, NotFoundError } from "../lib/hosts";
import { InputError } from "../lib/localhost";
import { RegistryError } from "../lib/registry";
import { hostOf } from "./request";
import type { HostEntry, Peer, Permission, Registry, RemoteHost } from "../types";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require("../../package.json");

const MAX_BODY = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX = 20;

export type HubDecision =
  | { kind: "none" }
  | { kind: "api" }
  | { kind: "app"; host: string; peer: Peer }
  | { kind: "deny"; status: number; message: string };

export interface HubApiContext {
  getRegistry(): Registry;
  reload(): void;
  retryTunnels(): void;
}

class HubApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/* ---------- per-IP auth-failure rate limiting, shared by classify() and the /_locadot/v1 API ---------- */

const failures = new Map<string, number[]>();

const recentFailures = (ip: string, now: number) => (failures.get(ip) || []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS);

const isLimited = (ip: string) => {
  const now = Date.now();
  const recent = recentFailures(ip, now);
  failures.set(ip, recent);
  return recent.length >= RATE_LIMIT_MAX;
};

const recordFailure = (ip: string) => {
  const now = Date.now();
  failures.set(ip, [...recentFailures(ip, now), now]);
};

/** Test-only: forget every recorded failure. */
export const resetRateLimiter = () => failures.clear();

const clientIp = (req: http.IncomingMessage) => {
  const header = req.headers["cf-connecting-ip"];
  const value = Array.isArray(header) ? header[0] : header;
  return value || req.socket.remoteAddress || "unknown";
};

const bearerToken = (req: http.IncomingMessage) => {
  const header = req.headers.authorization;
  const match = typeof header === "string" ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match?.[1];
};

/* ---------- app traffic: classify every request that arrives on the hub's public hostname ---------- */

export function classify(req: http.IncomingMessage, publicHost: string | undefined, hosts: Record<string, HostEntry>): HubDecision {
  if (!publicHost || hostOf(req) !== publicHost) return { kind: "none" };

  const pathname = (req.url || "/").split("?")[0];
  if (pathname === "/_locadot" || pathname.startsWith("/_locadot/")) return { kind: "api" };

  const ip = clientIp(req);
  if (isLimited(ip)) return { kind: "deny", status: 429, message: "Too many failed attempts. Try again later." };

  // Not Authorization: the sender's own apps may need that header from the visitor.
  const token = req.headers["x-locadot-peer"];
  const peer = Links.authenticate(typeof token === "string" ? token.trim() : undefined);
  if (!peer) {
    recordFailure(ip);
    return { kind: "deny", status: 401, message: "Unauthorized" };
  }

  const hostHeader = req.headers["x-locadot-host"];
  const host = typeof hostHeader === "string" ? hostHeader.trim().toLowerCase() : "";
  const entry = host ? hosts[host] : undefined;
  if (!host || Constants.dashboardHosts.includes(host) || !entry || entry.remote) {
    return { kind: "deny", status: 404, message: "Not found" };
  }
  const visible = Links.visibleHosts(peer, Object.keys(hosts));
  if (!visible.includes(host)) {
    return { kind: "deny", status: 403, message: "Forbidden" };
  }

  for (const name of Object.keys(req.headers)) if (name.toLowerCase().startsWith("x-locadot-")) delete req.headers[name];

  return { kind: "app", host, peer };
}

/* ---------- /_locadot/v1 API ---------- */

const send = (res: http.ServerResponse, status: number, body: Record<string, unknown>) => {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(json) });
  res.end(json);
};

const readJson = (req: http.IncomingMessage): Promise<Record<string, any>> =>
  new Promise((resolve, reject) => {
    const type = String(req.headers["content-type"] || "");
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) reject(new HubApiError(413, "Request body too large."));
      else chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      if (!/^application\/json\b/i.test(type)) return reject(new HubApiError(400, "Content-Type must be application/json."));
      try {
        const value = size ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        resolve(value);
      } catch {
        reject(new HubApiError(400, "Body must be a JSON object."));
      }
    });
  });

const requireString = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new HubApiError(400, `\`${name}\` is required.`);
  return value;
};

const optionalBool = (value: unknown, name: string) => {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new HubApiError(400, `\`${name}\` must be true or false.`);
  return value;
};

/** connect name: printable characters only, capped so it can't be used to stuff the peers file. */
const sanitizeName = (value: unknown): string => {
  const raw = typeof value === "string" ? value : "";
  const printable = raw.replace(/[^\x20-\x7E]/g, "").trim();
  return (printable || "peer").slice(0, 40);
};

const requirePerm = (peer: Peer, permission: Permission) => {
  if (!Links.can(peer, permission)) throw new HubApiError(403, "Forbidden");
};

const peerView = (peer: Peer) => {
  const { id, name, role, hosts } = peer;
  return hosts ? { id, name, role, hosts } : { id, name, role };
};

const senderInfo = () => ({ hostname: os.hostname(), version: String(version) });

const hostView = (host: string, entry: HostEntry): RemoteHost => ({
  host,
  target: entry.target,
  cors: Boolean(entry.cors),
  insecure: Boolean(entry.insecure),
});

export async function handleHubApi(req: http.IncomingMessage, res: http.ServerResponse, ctx: HubApiContext): Promise<void> {
  const url = new URL(req.url || "/", "http://hub.invalid");
  const path = url.pathname;
  const method = req.method || "GET";
  const ip = clientIp(req);

  try {
    if (path === "/_locadot/v1/connect" && method === "POST") {
      const body = await readJson(req);
      const code = requireString(body.code, "code");
      const name = sanitizeName(body.name);
      const { peer, token } = Links.redeem(code, name);
      logger.info(`🔗 hub: ${peer.name} connected as ${peer.role}`);
      return send(res, 200, { token, peer: peerView(peer), sender: senderInfo() });
    }

    if (isLimited(ip)) return send(res, 429, { error: "Too many failed attempts. Try again later." });

    const peer = Links.authenticate(bearerToken(req));
    if (!peer) {
      recordFailure(ip);
      return send(res, 401, { error: "Unauthorized" });
    }

    if (path === "/_locadot/v1/whoami" && method === "GET") {
      requirePerm(peer, "read");
      return send(res, 200, { peer: peerView(peer), sender: senderInfo() });
    }

    if (path === "/_locadot/v1/hosts" && method === "GET") {
      requirePerm(peer, "read");
      const registry = ctx.getRegistry();
      const visible = Links.visibleHosts(peer, Object.keys(registry.hosts));
      const hosts = visible.filter((host) => !registry.hosts[host].remote).map((host) => hostView(host, registry.hosts[host]));
      return send(res, 200, { hosts });
    }

    if (path === "/_locadot/v1/hosts" && method === "POST") {
      requirePerm(peer, "write");
      const body = await readJson(req);
      const { host, entry } = await HostOps.add({
        host: body.host,
        target: body.target,
        insecure: optionalBool(body.insecure, "insecure"),
        cors: optionalBool(body.cors, "cors"),
      });
      ctx.reload();
      logger.info(`➕ hub: ${peer.name} added ${host} → ${entry.target}`);
      return send(res, 201, { host: hostView(host, entry) });
    }

    const hostMatch = /^\/_locadot\/v1\/hosts\/([^/]+)$/.exec(path);
    if (hostMatch && method === "PUT") {
      requirePerm(peer, "write");
      const host = decodeURIComponent(hostMatch[1]);
      const body = await readJson(req);
      const tunnel = optionalBool(body.tunnel, "tunnel");
      if (tunnel !== undefined) requirePerm(peer, "settings");

      let updated;
      if (body.target !== undefined || tunnel === undefined) {
        updated = await HostOps.update({
          host,
          target: body.target,
          insecure: optionalBool(body.insecure, "insecure"),
          cors: optionalBool(body.cors, "cors"),
        });
      }
      if (tunnel !== undefined) updated = await HostOps.setTunnel({ host, tunnel });
      ctx.reload();
      if (tunnel) ctx.retryTunnels();
      logger.info(`✏️ hub: ${peer.name} updated ${host}`);
      return send(res, 200, { host: hostView(updated!.host, updated!.entry) });
    }
    if (hostMatch && method === "DELETE") {
      requirePerm(peer, "delete");
      const host = decodeURIComponent(hostMatch[1]);
      await HostOps.remove({ host });
      ctx.reload();
      logger.info(`🗑️ hub: ${peer.name} removed ${host}`);
      return send(res, 200, { ok: true });
    }

    send(res, 404, { error: "Not found" });
  } catch (error) {
    if (error instanceof NotFoundError) return send(res, 404, { error: error.message.replace(/^❌\s*/u, "") });
    if (error instanceof ConflictError) return send(res, 409, { error: error.message.replace(/^❌\s*/u, "") });
    if (error instanceof InputError) return send(res, 400, { error: error.message.replace(/^❌\s*/u, "") });
    if (error instanceof RegistryError) return send(res, 500, { error: error.message });
    if (error instanceof HubApiError) return send(res, error.status, { error: error.message });
    if (error instanceof LinkError) return send(res, error.status, { error: error.message });
    logger.error(error);
    return send(res, 500, { error: "Internal error." });
  }
}

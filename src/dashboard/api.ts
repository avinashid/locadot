import crypto from "crypto";
import fs from "fs";
import path from "path";
import http from "http";
import { spawn } from "child_process";
import Constants from "../constants";
import HostOps, { ConflictError, NotFoundError } from "../lib/hosts";
import { InputError } from "../lib/localhost";
import { RegistryError } from "../lib/registry";
import Startup from "../utils/startup";
import { trustCA, untrustCA } from "../utils/trust";
import FileModule from "../utils/file";
import logger from "../utils/logger";
import { invalidateSystemStatus } from "../lib/system";
import { installCloudflared } from "../proxy/tunnel";
import { formatUrl } from "../lib/urls";
import Links, { LinkError } from "../lib/links";
import HubConfigStore from "../lib/hub-config";
import Remotes, { RemoteError } from "../lib/remotes";
import type { DashboardContext, HubConfig, Peer, Remote, Role } from "../types";
import UiAuth from "../lib/ui-auth";
import ConfigStore from "../lib/config";
import { peerOriginOf } from "../proxy/request";

const MAX_BODY = 64 * 1024;

export class ApiError extends Error {
  constructor(public status: number, message: string, public hint?: string) {
    super(message);
  }
}

type Json = Record<string, unknown>;

const clean = (message: string) => message.replace(/^❌\s*/u, "");

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * What the page carries instead of the API token when an admin peer views it through the hub: the hub already
 * authenticated the peer, and the real token would outlive a revoked peer.
 */
export const PEER_TOKEN = "hub-peer";

/** The page's own origin: the dashboard hosts, or for an admin peer the receiver's `<domain>.localhost`. */
export const isDashboardOrigin = (req: http.IncomingMessage, origin: string) => {
  try {
    const url = new URL(origin);
    const peerOrigin = peerOriginOf(req);
    if (peerOrigin) return url.host === peerOrigin;
    return Constants.dashboardHosts.includes(url.hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
};

/**
 * Any web page can make the browser send requests to localhost, so every mutating
 * call must prove it came from the dashboard page itself (or a local script that
 * read the 0600 token file). The custom header also forces a CORS preflight, which
 * is never answered, and the Origin check rejects *.localhost apps as well.
 */
export function assertTrusted(req: http.IncomingMessage, ctx: DashboardContext) {
  const origin = req.headers.origin;
  if (origin && !isDashboardOrigin(req, origin)) throw new ApiError(403, "Cross-origin requests are not allowed.");
  if (req.headers["sec-fetch-site"] === "cross-site") throw new ApiError(403, "Cross-site requests are not allowed.");
  const token = req.headers["x-locadot-token"];
  if (typeof token !== "string" || !safeEqual(token, peerOriginOf(req) ? PEER_TOKEN : ctx.token)) {
    throw new ApiError(403, "Missing or wrong X-Locadot-Token.", `Token file: ${Constants.paths.API_TOKEN}`);
  }
}

export function readJson(req: http.IncomingMessage): Promise<Json> {
  return new Promise((resolve, reject) => {
    const type = String(req.headers["content-type"] || "");
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        // Don't req.destroy() here: that tears down the socket before the 413
        // response can be written, turning a clean error into a connection reset.
        // Just stop buffering and let the stream drain to completion.
        reject(new ApiError(413, "Request body too large."));
      } else chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      if (!size) return resolve({});
      if (!/^application\/json\b/i.test(type)) return reject(new ApiError(415, "Content-Type must be application/json."));
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        resolve(value);
      } catch {
        reject(new ApiError(400, "Body must be a JSON object."));
      }
    });
  });
}

const optionalBool = (value: unknown, name: string) => {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new ApiError(400, `\`${name}\` must be true or false.`);
  return value;
};

/** A mapping's https redirect: true/false, or null to follow the global setting. */
const optionalRedirect = (value: unknown): boolean | null | undefined => {
  if (value === undefined || value === null || typeof value === "boolean") return value;
  throw new ApiError(400, "`httpsRedirect` must be true, false or null (follow the global setting).");
};

const requiredBool = (value: unknown, name: string) => {
  const result = optionalBool(value, name);
  if (result === undefined) throw new ApiError(400, `\`${name}\` is required (true or false).`);
  return result;
};

/** Elevation prompts (polkit, macOS dialog, UAC) can fail headless; always offer the CLI equivalent. */
const privileged = async (action: () => Promise<void>, command: string) => {
  try {
    await action();
  } catch (error: any) {
    throw new ApiError(500, `${clean(String(error?.message || error))}`, command);
  }
};

const hostUrl = (host: string, ctx: DashboardContext) => formatUrl(host, true, ctx.proxyInfo.httpsPort);

const ROLES: Role[] = ["viewer", "editor", "admin"];

const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as string[]).includes(value);

const optionalString = (value: unknown, name: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new ApiError(400, `\`${name}\` must be a string.`);
  return value;
};

const optionalHosts = (value: unknown): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new ApiError(400, "`hosts` must be an array of strings.");
  }
  return value;
};

/** Public hostname a Cloudflare named tunnel can route to (not *.localhost, no scheme/path). */
const isValidPublicDomain = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const host = value.trim().toLowerCase();
  if (!host || host.length > 253 || host.includes("/") || host.includes(":")) return false;
  const labels = host.split(".");
  if (labels.length < 2 || labels[labels.length - 1] === "localhost") return false;
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
};

const sanitizeInvite = (invite: { id: string; role: Role; hosts?: string[]; expiresAt: string }) => ({
  id: invite.id,
  role: invite.role,
  hosts: invite.hosts,
  expiresAt: invite.expiresAt,
});

const sanitizePeer = (peer: Peer) => ({
  id: peer.id,
  name: peer.name,
  role: peer.role,
  hosts: peer.hosts,
  createdAt: peer.createdAt,
  lastSeen: peer.lastSeen,
});

const sanitizeRemote = (remote: Remote) => {
  const { token, ...rest } = remote;
  return rest;
};

const savedPorts = (): { httpPort?: number; httpsPort?: number } => {
  const config = ConfigStore.read();
  return {
    httpPort: Constants.validPort(config.httpPort),
    httpsPort: Constants.validPort(config.httpsPort),
  };
};

/** Settings response: what the running proxy uses, what's saved/env-overridden, and whether they've drifted apart. */
function buildSettingsBody(ctx: DashboardContext, warning?: string) {
  const saved = savedPorts();
  const env = {
    httpPort: Constants.userEnvPort("LOCADOT_HTTP_PORT") !== undefined,
    httpsPort: Constants.userEnvPort("LOCADOT_HTTPS_PORT") !== undefined,
    bind: Boolean(process.env.LOCADOT_BIND),
  };
  const nextHttpPort = Constants.userEnvPort("LOCADOT_HTTP_PORT") ?? saved.httpPort ?? 80;
  const nextHttpsPort = Constants.userEnvPort("LOCADOT_HTTPS_PORT") ?? saved.httpsPort ?? 443;
  const restartRequired = nextHttpPort !== ctx.proxyInfo.httpPort || nextHttpsPort !== ctx.proxyInfo.httpsPort;
  return {
    httpPort: ctx.proxyInfo.httpPort,
    httpsPort: ctx.proxyInfo.httpsPort,
    bind: ctx.proxyInfo.bind,
    logLevel: logger.level,
    stateDir: ctx.proxyInfo.stateDir,
    saved,
    env,
    restartRequired,
    httpsRedirect: ConfigStore.httpsRedirect(),
    uiAuth: { enabled: UiAuth.enabled(), updatedAt: UiAuth.read()?.updatedAt },
    ...(warning ? { warning } : {}),
  };
}

const validPortInput = (value: unknown, name: string): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 65535) {
    throw new ApiError(400, `\`${name}\` must be an integer between 1 and 65535.`);
  }
  return value;
};

/** Compiled layout: dist/dashboard/api.js -> dist/index.js. Under tsx (src/dashboard) the compiled dist/index.js is still what gets spawned. */
function resolveCliPath(): string {
  const compiled = path.join(__dirname, "..", "index.js");
  const fromSource = path.join(__dirname, "..", "..", "dist", "index.js");
  return __filename.endsWith(".ts") ? fromSource : compiled;
}

const REMOTE_SYNC_TIMEOUT_MS = 5000;

async function buildRemoteRows(ctx: DashboardContext) {
  const remotes = Remotes.list();
  let changed = false;
  const rows = await Promise.all(
    remotes.map(async (remote) => {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timed out")), REMOTE_SYNC_TIMEOUT_MS)
        );
        const result = await Promise.race([Remotes.sync(remote.name), timeout]);
        changed = true;
        return {
          name: result.remote.name,
          url: result.remote.url,
          role: result.remote.role,
          hosts: result.remote.hosts,
          sender: result.remote.sender,
          connectedAt: result.remote.connectedAt,
          domain: result.remote.domain,
          localhost: result.remote.localhost,
          status: "ok" as const,
          available: result.hosts,
          mapped: result.mapped,
        };
      } catch (error: any) {
        return {
          name: remote.name,
          url: remote.url,
          role: remote.role,
          hosts: remote.hosts,
          sender: remote.sender,
          connectedAt: remote.connectedAt,
          domain: remote.domain,
          localhost: remote.localhost,
          status: "error" as const,
          error: clean(String(error?.message || error)),
          available: null,
          mapped: [],
        };
      }
    })
  );
  if (changed) ctx.reload();
  return rows;
}

function buildHubBody(ctx: DashboardContext) {
  const config = HubConfigStore.read();
  const { invites, peers } = Links.list();
  return {
    hub: ctx.hub(),
    config: config ?? null,
    localhost: config?.localhost !== false,
    panel: config?.panel === true,
    invites: invites.map(sanitizeInvite),
    peers: peers.map(sanitizePeer),
  };
}

/** Routes under /api/ other than the read-only status/hosts. Returns undefined when nothing matched. */
export async function route(
  req: http.IncomingMessage,
  url: URL,
  ctx: DashboardContext
): Promise<{ status: number; body: Json } | undefined> {
  const method = req.method || "GET";
  const path = url.pathname;

  if (path === "/api/logs" && (method === "GET" || method === "HEAD")) {
    const lines = Math.min(Math.max(Number(url.searchParams.get("lines")) || 200, 1), 2000);
    return { status: 200, body: { lines: FileModule.lastLines("LOGS", lines) } };
  }

  if (path === "/api/hub" && (method === "GET" || method === "HEAD")) {
    return { status: 200, body: buildHubBody(ctx) };
  }

  if (path === "/api/remotes" && (method === "GET" || method === "HEAD")) {
    return { status: 200, body: { remotes: await buildRemoteRows(ctx) } };
  }

  if (path === "/api/settings" && (method === "GET" || method === "HEAD")) {
    return { status: 200, body: buildSettingsBody(ctx) };
  }

  const hostMatch = /^\/api\/hosts\/([^/]+)$/.exec(path);
  const inviteMatch = /^\/api\/invites\/([^/]+)$/.exec(path);
  const peerMatch = /^\/api\/peers\/([^/]+)$/.exec(path);
  const remoteMatch = /^\/api\/remotes\/([^/]+)$/.exec(path);
  const remoteSyncMatch = /^\/api\/remotes\/([^/]+)\/sync$/.exec(path);
  const remoteAliasMatch = /^\/api\/remotes\/([^/]+)\/aliases$/.exec(path);
  const remoteHostsMatch = /^\/api\/remotes\/([^/]+)\/hosts$/.exec(path);
  const remoteHostMatch = /^\/api\/remotes\/([^/]+)\/hosts\/([^/]+)$/.exec(path);

  const known =
    (path === "/api/hosts" && method === "POST") ||
    (hostMatch && (method === "PUT" || method === "DELETE")) ||
    (["/api/startup", "/api/trust", "/api/logs/clear", "/api/proxy/stop", "/api/proxy/restart", "/api/cloudflared/install", "/api/hub", "/api/invites", "/api/remotes"].includes(path) &&
      method === "POST") ||
    (path === "/api/hub/localhost" && method === "PUT") ||
    (path === "/api/hub/panel" && method === "PUT") ||
    (path === "/api/settings" && method === "PUT") ||
    (inviteMatch && method === "DELETE") ||
    (peerMatch && (method === "PUT" || method === "DELETE")) ||
    (remoteMatch && (method === "PUT" || method === "DELETE")) ||
    (remoteSyncMatch && method === "POST") ||
    (remoteAliasMatch && method === "POST") ||
    (remoteHostsMatch && method === "POST") ||
    (remoteHostMatch && (method === "PUT" || method === "DELETE"));
  if (!known) return undefined;

  assertTrusted(req, ctx);
  const body = await readJson(req);

  try {
    if (path === "/api/settings" && method === "PUT") {
      const newHttp = validPortInput(body.httpPort, "httpPort");
      const newHttps = validPortInput(body.httpsPort, "httpsPort");
      const httpsRedirect = optionalBool(body.httpsRedirect, "httpsRedirect");
      if (newHttp === undefined && newHttps === undefined && httpsRedirect === undefined) {
        throw new ApiError(400, "Provide `httpPort`, `httpsPort` and/or `httpsRedirect`.");
      }

      if (httpsRedirect !== undefined) {
        ConfigStore.write({ httpsRedirect: httpsRedirect || undefined });
        logger.info(`⚙️ dashboard: http → https redirect ${httpsRedirect ? "on" : "off"}`);
      }
      const warnings: string[] = [];
      if (newHttp !== undefined || newHttps !== undefined) {
        const saved = savedPorts();
        const finalHttp = newHttp ?? saved.httpPort ?? ctx.proxyInfo.httpPort;
        const finalHttps = newHttps ?? saved.httpsPort ?? ctx.proxyInfo.httpsPort;
        if (finalHttp === finalHttps) throw new ApiError(400, "`httpPort` and `httpsPort` can't be the same.");

        ConfigStore.write({ httpPort: finalHttp, httpsPort: finalHttps });
        logger.info(`⚙️ dashboard: settings saved → http ${finalHttp}, https ${finalHttps}`);

        if (newHttp !== undefined && Constants.userEnvPort("LOCADOT_HTTP_PORT") !== undefined) {
          warnings.push("LOCADOT_HTTP_PORT is set and overrides this");
        }
        if (newHttps !== undefined && Constants.userEnvPort("LOCADOT_HTTPS_PORT") !== undefined) {
          warnings.push("LOCADOT_HTTPS_PORT is set and overrides this");
        }
      }
      return { status: 200, body: buildSettingsBody(ctx, warnings.length ? warnings.join("; ") : undefined) };
    }
    if (path === "/api/hosts") {
      const { host, entry } = await HostOps.add({
        host: body.host,
        target: body.target,
        insecure: optionalBool(body.insecure, "insecure"),
        cors: optionalBool(body.cors, "cors"),
        allow: body.allow,
        httpsRedirect: optionalRedirect(body.httpsRedirect),
      });
      ctx.reload();
      logger.info(`➕ dashboard: ${host} → ${entry.target}`);
      return { status: 201, body: { ok: true, host, ...entry, url: hostUrl(host, ctx) } };
    }
    if (hostMatch) {
      const host = decodeURIComponent(hostMatch[1]);
      if (method === "DELETE") {
        await HostOps.remove({ host });
        ctx.reload();
        logger.info(`🗑️ dashboard: removed ${host}`);
        return { status: 200, body: { ok: true, host } };
      }
      const tunnel = optionalBool(body.tunnel, "tunnel");
      let updated;
      if (body.allow !== undefined && body.target === undefined) {
        updated = await HostOps.setAllow({ host, allow: body.allow });
        logger.info(`✏️ dashboard: ${updated.host} allows ${updated.entry.allow?.join(", ") || "no internal addresses"}`);
      }
      if (body.protect !== undefined) {
        const protect = body.protect as { password?: unknown; scopes?: unknown } | null;
        if (protect !== null && (typeof protect !== "object" || Array.isArray(protect))) throw new ApiError(400, "protect must be an object or null.");
        updated = protect === null
          ? await HostOps.setProtect({ host, off: true })
          : await HostOps.setProtect({ host, password: protect.password, scopes: protect.scopes });
        const scopes = updated.entry.protect?.scopes;
        logger.info(`🔒 dashboard: ${scopes ? `${updated.host} asks for a password on ${scopes.join(", ")}${protect?.password ? " (new password)" : ""}` : `${updated.host} is no longer password protected`}`);
      }
      const httpsRedirect = optionalRedirect(body.httpsRedirect);
      if (httpsRedirect !== undefined && body.target === undefined) {
        updated = await HostOps.setHttpsRedirect({ host, httpsRedirect });
        logger.info(`✏️ dashboard: ${updated.host} https redirect ${httpsRedirect === null ? "follows the global setting" : httpsRedirect ? "on" : "off"}`);
      }
      if (body.target !== undefined || (tunnel === undefined && body.allow === undefined && body.protect === undefined && httpsRedirect === undefined)) {
        updated = await HostOps.update({
          host,
          target: body.target,
          insecure: optionalBool(body.insecure, "insecure"),
          cors: optionalBool(body.cors, "cors"),
          allow: body.allow,
          httpsRedirect,
        });
        logger.info(`✏️ dashboard: ${updated.host} → ${updated.entry.target}`);
      }
      if (tunnel !== undefined) {
        updated = await HostOps.setTunnel({ host, tunnel, domain: body.domain });
        const on = updated.entry.tunnelDomain && tunnel ? `sharing ${updated.host} on ${updated.entry.tunnelDomain}` : `sharing ${updated.host}`;
        logger.info(`🌍 dashboard: ${tunnel ? on : `stopped sharing ${updated.host}`}`);
      }
      ctx.reload();
      if (tunnel) ctx.retryTunnels();
      const { host: name, entry } = updated!;
      return { status: 200, body: { ok: true, host: name, ...entry, url: hostUrl(name, ctx), tunnel: ctx.tunnel(name) } };
    }

    if (path === "/api/hub" && method === "POST") {
      const mode = body.mode;
      if (mode === "named") {
        if (!isValidPublicDomain(body.domain)) throw new ApiError(400, "`domain` must be a valid public hostname.");
        const tunnel = body.tunnel === undefined ? undefined : String(body.tunnel);
        ctx.setupNamedHub(String(body.domain).trim().toLowerCase(), tunnel);
      } else if (mode === "quick") {
        HubConfigStore.write({ mode: "quick" });
        ctx.reloadHub();
      } else if (mode === "manual") {
        if (typeof body.url !== "string" || !body.url.trim()) throw new ApiError(400, "`url` is required for manual mode.");
        let parsed: URL;
        try {
          parsed = new URL(body.url.trim());
        } catch {
          throw new ApiError(400, "`url` must be a valid http(s) URL.");
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new ApiError(400, "`url` must be http or https.");
        const config: HubConfig = { mode: "manual", url: body.url.trim().replace(/\/+$/, "") };
        HubConfigStore.write(config);
        ctx.reloadHub();
      } else if (mode === "off") {
        HubConfigStore.clear();
        ctx.reloadHub();
      } else {
        throw new ApiError(400, "`mode` must be one of named, quick, manual, off.");
      }
      return { status: 200, body: { hub: ctx.hub() } };
    }

    if (path === "/api/hub/localhost" && method === "PUT") {
      const enabled = requiredBool(body.enabled, "enabled");
      const config = HubConfigStore.read();
      if (!config) throw new ApiError(400, "The hub isn't configured yet. Set it up first: locadot hub:setup / hub:quick / hub:manual.");
      HubConfigStore.write({ ...config, localhost: enabled });
      ctx.reloadHub();
      return { status: 200, body: { localhost: enabled } };
    }

    if (path === "/api/hub/panel" && method === "PUT") {
      const enabled = requiredBool(body.enabled, "enabled");
      const config = HubConfigStore.read();
      if (!config) throw new ApiError(400, "The hub isn't configured yet. Set it up first: locadot hub:setup / hub:quick / hub:manual.");
      if (enabled && !UiAuth.enabled()) throw new ApiError(400, "Set a dashboard password first.", "Settings → Dashboard password, or `locadot ui:password`.");
      HubConfigStore.write({ ...config, panel: enabled });
      ctx.reloadHub();
      return { status: 200, body: { panel: enabled } };
    }

    if (path === "/api/invites" && method === "POST") {
      if (!isRole(body.role)) throw new ApiError(400, "`role` must be viewer, editor or admin.");
      const hosts = optionalHosts(body.hosts);
      if (ctx.hub().status !== "up") {
        throw new ApiError(409, "The hub isn't up. Start sharing first.", "locadot hub:quick");
      }
      const { invite, code } = Links.createInvite({ role: body.role, hosts });
      const string = Links.inviteString(ctx.hub().url!, code);
      return { status: 200, body: { id: invite.id, code, string, role: invite.role, hosts: invite.hosts, expiresAt: invite.expiresAt } };
    }

    if (inviteMatch && method === "DELETE") {
      Links.revokeInvite(decodeURIComponent(inviteMatch[1]));
      return { status: 200, body: { ok: true } };
    }

    if (peerMatch && method === "PUT") {
      const id = decodeURIComponent(peerMatch[1]);
      if (!isRole(body.role)) throw new ApiError(400, "`role` must be viewer, editor or admin.");
      const hosts = optionalHosts(body.hosts);
      const peer = Links.setRole(id, body.role, hosts);
      return { status: 200, body: { peer: sanitizePeer(peer) } };
    }

    if (peerMatch && method === "DELETE") {
      Links.revoke(decodeURIComponent(peerMatch[1]));
      return { status: 200, body: { ok: true } };
    }

    if (path === "/api/remotes" && method === "POST") {
      if (typeof body.string !== "string" || !body.string.trim()) throw new ApiError(400, "`string` is required.");
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
      const domain = optionalString(body.domain, "domain");
      const result = await Remotes.connect(body.string.trim(), { name, domain });
      ctx.reload();
      return { status: 200, body: { ...result, remote: sanitizeRemote(result.remote) } };
    }

    if (remoteMatch && method === "PUT" && "domain" in body) {
      const domain = body.domain;
      if (domain !== null && domain !== "random" && typeof domain !== "string") {
        throw new ApiError(400, '`domain` must be a string, "random" or null.');
      }
      const remote = Remotes.setDomain(decodeURIComponent(remoteMatch[1]), domain);
      ctx.reload();
      return { status: 200, body: { remote: sanitizeRemote(remote) } };
    }

    if (remoteMatch && method === "PUT") {
      if (typeof body.url !== "string" || !body.url.trim()) throw new ApiError(400, "`url` is required.");
      Remotes.setUrl(decodeURIComponent(remoteMatch[1]), body.url.trim());
      return { status: 200, body: { ok: true } };
    }

    if (remoteMatch && method === "DELETE") {
      await Remotes.disconnect(decodeURIComponent(remoteMatch[1]));
      ctx.reload();
      return { status: 200, body: { ok: true } };
    }

    if (remoteSyncMatch && method === "POST") {
      const result = await Remotes.sync(decodeURIComponent(remoteSyncMatch[1]));
      ctx.reload();
      return { status: 200, body: { ...result, remote: sanitizeRemote(result.remote) } };
    }

    if (remoteAliasMatch && method === "POST") {
      if (typeof body.host !== "string" || typeof body.local !== "string") {
        throw new ApiError(400, "`host` and `local` are required.");
      }
      await Remotes.alias(decodeURIComponent(remoteAliasMatch[1]), body.host, body.local);
      ctx.reload();
      return { status: 200, body: { ok: true } };
    }

    if (remoteHostsMatch && method === "POST") {
      if (typeof body.host !== "string" || typeof body.target !== "string") {
        throw new ApiError(400, "`host` and `target` are required.");
      }
      const host = await Remotes.addHost(decodeURIComponent(remoteHostsMatch[1]), {
        host: body.host,
        target: body.target,
        insecure: optionalBool(body.insecure, "insecure"),
        cors: optionalBool(body.cors, "cors"),
      });
      ctx.reload();
      return { status: 201, body: { host } };
    }

    if (remoteHostMatch) {
      const name = decodeURIComponent(remoteHostMatch[1]);
      const hostName = decodeURIComponent(remoteHostMatch[2]);
      if (method === "DELETE") {
        await Remotes.removeHost(name, hostName);
        ctx.reload();
        return { status: 200, body: { ok: true } };
      }
      const host = await Remotes.updateHost(name, hostName, {
        target: optionalString(body.target, "target"),
        insecure: optionalBool(body.insecure, "insecure"),
        cors: optionalBool(body.cors, "cors"),
        tunnel: optionalBool(body.tunnel, "tunnel"),
      });
      return { status: 200, body: { host } };
    }
  } catch (error) {
    if (error instanceof NotFoundError) throw new ApiError(404, clean(error.message));
    if (error instanceof ConflictError) throw new ApiError(409, clean(error.message));
    if (error instanceof InputError) throw new ApiError(400, clean(error.message));
    if (error instanceof RegistryError) throw new ApiError(500, clean(error.message));
    if (error instanceof LinkError) throw new ApiError(error.status, clean(error.message));
    if (error instanceof RemoteError) throw new ApiError(error.status || 502, clean(error.message));
    if (error instanceof ApiError) throw error;
    throw error;
  }

  switch (path) {
    case "/api/startup": {
      const enabled = requiredBool(body.enabled, "enabled");
      await privileged(
        () => (enabled ? Startup.enable() : Startup.disable()),
        enabled ? "locadot startup:enable" : "locadot startup:disable"
      );
      invalidateSystemStatus();
      return { status: 200, body: { ok: true, ...(await Startup.info()) } };
    }
    case "/api/trust": {
      const trusted = requiredBool(body.trusted, "trusted");
      await privileged(() => (trusted ? trustCA() : untrustCA()), trusted ? "locadot trust" : "locadot untrust");
      await ctx.refreshTrust();
      invalidateSystemStatus();
      return { status: 200, body: { ok: true, trusted: ctx.proxyInfo.caTrusted ?? null } };
    }
    case "/api/logs/clear":
      if (FileModule.exists("LOGS")) FileModule.write("LOGS", "");
      return { status: 200, body: { ok: true } };
    case "/api/cloudflared/install":
      try {
        const info = await installCloudflared();
        ctx.retryTunnels();
        logger.info(`🌍 cloudflared ${info.version ?? ""} installed at ${info.path}`);
        return { status: 200, body: { ok: true, ...info } };
      } catch (error: any) {
        throw new ApiError(500, clean(String(error?.message || error)), "locadot tunnel:install");
      }
    case "/api/proxy/stop":
      setTimeout(() => ctx.shutdown("dashboard stop"), 100);
      return { status: 200, body: { ok: true, hint: "locadot start" } };
    case "/api/proxy/restart": {
      const cli = resolveCliPath();
      if (!fs.existsSync(cli)) {
        throw new ApiError(500, `❌ ${cli} not found. Run \`pnpm build\` first.`, "locadot restart");
      }
      // Drop the CLI's pinned port copies so the child re-reads CONFIG_FILE; keep genuine user overrides.
      const restartEnv: NodeJS.ProcessEnv = { ...process.env };
      delete restartEnv.LOCADOT_USER_PORTS;
      for (const name of ["LOCADOT_HTTP_PORT", "LOCADOT_HTTPS_PORT"] as const) {
        if (Constants.userEnvPort(name) === undefined) delete restartEnv[name];
      }
      spawn(process.execPath, [cli, "restart"], { detached: true, stdio: "ignore", env: restartEnv, windowsHide: true }).unref();
      logger.info("🔁 dashboard: restarting proxy");
      return { status: 200, body: { ok: true, hint: "locadot restart" } };
    }
  }
  return undefined;
}

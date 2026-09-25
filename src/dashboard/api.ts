import crypto from "crypto";
import http from "http";
import Constants from "../constants";
import HostOps, { ConflictError, NotFoundError } from "../lib/hosts";
import { InputError } from "../lib/localhost";
import { RegistryError } from "../lib/registry";
import Startup from "../utils/startup";
import { trustCA, untrustCA } from "../utils/trust";
import FileModule from "../utils/file";
import logger from "../utils/logger";
import { invalidateSystemStatus } from "../lib/system";
import type { DashboardContext } from "../types";

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

const isDashboardOrigin = (origin: string) => {
  try {
    const hostname = new URL(origin).hostname.replace(/^\[|\]$/g, "");
    return Constants.dashboardHosts.includes(hostname);
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
  if (origin && !isDashboardOrigin(origin)) throw new ApiError(403, "Cross-origin requests are not allowed.");
  if (req.headers["sec-fetch-site"] === "cross-site") throw new ApiError(403, "Cross-site requests are not allowed.");
  const token = req.headers["x-locadot-token"];
  if (typeof token !== "string" || !safeEqual(token, ctx.token)) {
    throw new ApiError(403, "Missing or wrong X-Locadot-Token.", `Token file: ${Constants.paths.API_TOKEN}`);
  }
}

function readJson(req: http.IncomingMessage): Promise<Json> {
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

const hostUrl = (host: string, ctx: DashboardContext) =>
  `https://${host}${ctx.proxyInfo.httpsPort === 443 ? "" : `:${ctx.proxyInfo.httpsPort}`}`;

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

  const hostMatch = /^\/api\/hosts\/([^/]+)$/.exec(path);
  const known =
    (path === "/api/hosts" && method === "POST") ||
    (hostMatch && (method === "PUT" || method === "DELETE")) ||
    (["/api/startup", "/api/trust", "/api/logs/clear", "/api/proxy/stop"].includes(path) && method === "POST");
  if (!known) return undefined;

  assertTrusted(req, ctx);
  const body = await readJson(req);

  try {
    if (path === "/api/hosts") {
      const { host, entry } = await HostOps.add({ host: body.host, target: body.target, insecure: optionalBool(body.insecure, "insecure"), cors: optionalBool(body.cors, "cors") });
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
      const updated = await HostOps.update({ host, target: body.target, insecure: optionalBool(body.insecure, "insecure"), cors: optionalBool(body.cors, "cors") });
      ctx.reload();
      logger.info(`✏️ dashboard: ${updated.host} → ${updated.entry.target}`);
      return { status: 200, body: { ok: true, host: updated.host, ...updated.entry, url: hostUrl(updated.host, ctx) } };
    }
  } catch (error) {
    if (error instanceof NotFoundError) throw new ApiError(404, clean(error.message));
    if (error instanceof ConflictError) throw new ApiError(409, clean(error.message));
    if (error instanceof InputError) throw new ApiError(400, clean(error.message));
    if (error instanceof RegistryError) throw new ApiError(500, clean(error.message));
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
    case "/api/proxy/stop":
      setTimeout(() => ctx.shutdown("dashboard stop"), 100);
      return { status: 200, body: { ok: true, hint: "locadot start" } };
  }
  return undefined;
}

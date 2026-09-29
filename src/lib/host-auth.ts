import crypto from "crypto";
import fs from "fs";
import Constants from "../constants";
import FileModule from "../utils/file";
import type { ProtectScope } from "../types";

/**
 * Passwords for protected mappings, kept out of the registry (which other users on the machine can read)
 * in HOST_PASSWORDS_FILE (0600): per host an scrypt hash and the secret that signs its visitors' cookies.
 * Setting a new password replaces the secret, which signs everyone out.
 */

interface HostPassword {
  salt: string;
  hash: string;
  secret: string;
  updatedAt: string;
}

export const SCOPES: ProtectScope[] = ["shared", "remote", "local"];
export const HOST_COOKIE = "locadot_pw";
export const HOST_SESSION_TTL_SEC = 7 * 24 * 3600;
export const MIN_HOST_PASSWORD = 8;

const hashOf = (password: string, salt: string) => crypto.scryptSync(password, Buffer.from(salt, "base64"), 32).toString("base64");
const sign = (secret: string, value: string) => crypto.createHmac("sha256", secret).update(value).digest("base64url");

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

let cache: { mtimeMs: number; value: Record<string, HostPassword> } | undefined;

const readAll = (): Record<string, HostPassword> => {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(Constants.paths.HOST_PASSWORDS_FILE).mtimeMs;
  } catch {
    cache = undefined;
    return {};
  }
  if (!cache || cache.mtimeMs !== mtimeMs) {
    let value: Record<string, HostPassword> = {};
    try {
      const data = JSON.parse(FileModule.read("HOST_PASSWORDS_FILE") || "{}");
      if (data && typeof data === "object") value = data;
    } catch {}
    cache = { mtimeMs, value };
  }
  return cache.value;
};

const writeAll = (all: Record<string, HostPassword>) => {
  FileModule.writeAtomic("HOST_PASSWORDS_FILE", JSON.stringify(all, null, 2));
  fs.chmodSync(Constants.paths.HOST_PASSWORDS_FILE, 0o600);
  cache = undefined;
};

const failures = new Map<string, { count: number; since: number }>();
const FAIL_WINDOW_MS = 5 * 60_000;
const MAX_FAILURES = 10;

export const parseScopes = (value: unknown): ProtectScope[] => {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const scopes = [...new Set(list.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
  const bad = scopes.find((scope) => !SCOPES.includes(scope as ProtectScope));
  if (bad) throw new Error(`"${bad}" isn't a place to ask for the password; use shared, remote or local.`);
  return SCOPES.filter((scope) => scopes.includes(scope));
};

export default class HostAuth {
  static has(host: string): boolean {
    return Boolean(readAll()[host]);
  }

  static updatedAt(host: string): string | undefined {
    return readAll()[host]?.updatedAt;
  }

  static set(host: string, password: string): void {
    if (typeof password !== "string" || password.length < MIN_HOST_PASSWORD) {
      throw new Error(`The password must be at least ${MIN_HOST_PASSWORD} characters.`);
    }
    const salt = crypto.randomBytes(16).toString("base64");
    const entry: HostPassword = { salt, hash: hashOf(password, salt), secret: crypto.randomBytes(32).toString("base64"), updatedAt: new Date().toISOString() };
    writeAll({ ...readAll(), [host]: entry });
  }

  static clear(host: string): void {
    const all = { ...readAll() };
    if (!all[host]) return;
    delete all[host];
    writeAll(all);
  }

  static verify(host: string, password: unknown): boolean {
    const data = readAll()[host];
    if (!data || typeof password !== "string" || !password) return false;
    return safeEqual(hashOf(password, data.salt), data.hash);
  }

  /** `<expiry>.<mac>`, bound to the host; nothing is kept server-side. */
  static issue(host: string, now = Date.now()): string {
    const data = readAll()[host];
    if (!data) throw new Error(`${host} has no password.`);
    const exp = String(Math.floor(now / 1000) + HOST_SESSION_TTL_SEC);
    return `${exp}.${sign(data.secret, `${host}|${exp}`)}`;
  }

  static validSession(host: string, value: string | undefined, now = Date.now()): boolean {
    const data = readAll()[host];
    if (!data || !value) return false;
    const [exp, mac] = value.split(".");
    if (!/^\d+$/.test(exp || "") || !mac || Number(exp) * 1000 < now) return false;
    return safeEqual(mac, sign(data.secret, `${host}|${exp}`));
  }

  static limited(key: string, now = Date.now()): boolean {
    const entry = failures.get(key);
    if (!entry || now - entry.since > FAIL_WINDOW_MS) return false;
    return entry.count >= MAX_FAILURES;
  }

  static fail(key: string, now = Date.now()): void {
    const entry = failures.get(key);
    if (!entry || now - entry.since > FAIL_WINDOW_MS) failures.set(key, { count: 1, since: now });
    else entry.count++;
  }

  static succeed(key: string): void {
    failures.delete(key);
  }
}

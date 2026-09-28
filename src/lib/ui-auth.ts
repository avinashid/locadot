import crypto from "crypto";
import fs from "fs";
import path from "path";
import Constants from "../constants";
import FileModule from "../utils/file";
import HubConfigStore from "./hub-config";

interface UiAuthFile {
  salt: string;
  hash: string;
  // Signs session cookies; replaced on every password change, which signs everyone out.
  secret: string;
  updatedAt: string;
}

export const SESSION_COOKIE = "locadot_ui";
export const SESSION_TTL_SEC = 7 * 24 * 3600;
export const MIN_PASSWORD = 8;

const hashOf = (password: string, salt: string) => crypto.scryptSync(password, Buffer.from(salt, "base64"), 32).toString("base64");

const sign = (secret: string, value: string) => crypto.createHmac("sha256", secret).update(value).digest("base64url");

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

let cache: { mtimeMs: number; value: UiAuthFile | undefined } | undefined;

const failures = new Map<string, { count: number; since: number }>();
const FAIL_WINDOW_MS = 5 * 60_000;
const MAX_FAILURES = 10;

/** Optional password for the dashboard UI (`UI_AUTH_FILE`, 0600). Scripts keep using the API token. */
export default class UiAuth {
  static read(): UiAuthFile | undefined {
    let mtimeMs: number;
    try {
      mtimeMs = fs.statSync(path.resolve(Constants.paths.UI_AUTH_FILE)).mtimeMs;
    } catch {
      cache = undefined;
      return undefined;
    }
    if (!cache || cache.mtimeMs !== mtimeMs) {
      let value: UiAuthFile | undefined;
      try {
        const data = JSON.parse(FileModule.read("UI_AUTH_FILE") || "");
        value = data && typeof data.hash === "string" && typeof data.salt === "string" && typeof data.secret === "string" ? data : undefined;
      } catch {
        value = undefined;
      }
      cache = { mtimeMs, value };
    }
    return cache.value;
  }

  static enabled(): boolean {
    return Boolean(UiAuth.read());
  }

  static set(password: string): void {
    if (typeof password !== "string" || password.length < MIN_PASSWORD) {
      throw new Error(`The password must be at least ${MIN_PASSWORD} characters.`);
    }
    const salt = crypto.randomBytes(16).toString("base64");
    const data: UiAuthFile = {
      salt,
      hash: hashOf(password, salt),
      secret: crypto.randomBytes(32).toString("base64"),
      updatedAt: new Date().toISOString(),
    };
    FileModule.writeAtomic("UI_AUTH_FILE", JSON.stringify(data, null, 2));
    fs.chmodSync(Constants.paths.UI_AUTH_FILE, 0o600);
    cache = undefined;
  }

  static clear(): void {
    FileModule.remove("UI_AUTH_FILE");
    cache = undefined;
    // The shared dashboard needs the password, so it doesn't come back on its own when a new one is set.
    const hub = HubConfigStore.read();
    if (hub?.panel) HubConfigStore.write({ ...hub, panel: false });
  }

  static verify(password: unknown): boolean {
    const data = UiAuth.read();
    if (!data || typeof password !== "string" || !password) return false;
    return safeEqual(hashOf(password, data.salt), data.hash);
  }

  /** A signed `<expiry>.<mac>` cookie value; nothing is kept server-side. */
  static issue(now = Date.now()): string {
    const data = UiAuth.read();
    if (!data) throw new Error("No dashboard password is set.");
    const exp = String(Math.floor(now / 1000) + SESSION_TTL_SEC);
    return `${exp}.${sign(data.secret, exp)}`;
  }

  static validSession(value: string | undefined, now = Date.now()): boolean {
    const data = UiAuth.read();
    if (!data || !value) return false;
    const [exp, mac] = value.split(".");
    if (!/^\d+$/.test(exp || "") || !mac || Number(exp) * 1000 < now) return false;
    return safeEqual(mac, sign(data.secret, exp));
  }

  static limited(ip: string, now = Date.now()): boolean {
    const entry = failures.get(ip);
    if (!entry || now - entry.since > FAIL_WINDOW_MS) return false;
    return entry.count >= MAX_FAILURES;
  }

  static fail(ip: string, now = Date.now()): void {
    const entry = failures.get(ip);
    if (!entry || now - entry.since > FAIL_WINDOW_MS) failures.set(ip, { count: 1, since: now });
    else entry.count++;
  }

  static succeed(ip: string): void {
    failures.delete(ip);
  }
}

export const cookieOf = (header: string | undefined, name: string): string | undefined => {
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
};

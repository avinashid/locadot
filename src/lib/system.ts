import fs from "fs";
import { execFileSync } from "child_process";
import Constants from "../constants";
import Startup from "../utils/startup";
import { isCATrusted } from "../utils/trust";
import type { SystemStatus } from "../types";

let windowsAdmin: boolean | undefined;

/** Root on POSIX; on Windows `net session` only succeeds in an elevated shell. */
export const isElevated = () => {
  if (process.platform !== "win32") return process.getuid?.() === 0;
  if (windowsAdmin === undefined) {
    try {
      execFileSync("net", ["session"], { stdio: "ignore", windowsHide: true });
      windowsAdmin = true;
    } catch {
      windowsAdmin = false;
    }
  }
  return windowsAdmin;
};

export const unprivilegedPortStart = (): number | null => {
  if (process.platform !== "linux") return null;
  try {
    return Number(fs.readFileSync("/proc/sys/net/ipv4/ip_unprivileged_port_start", "utf8"));
  } catch {
    return 1024;
  }
};

/** macOS (since 10.14) and Windows let any user bind 80/443; Linux depends on the sysctl. */
export const canBindPrivileged = () => {
  if (process.platform !== "linux" || isElevated()) return true;
  const start = unprivilegedPortStart();
  return start !== null && start <= Math.min(Constants.server.httpPort, Constants.server.httpsPort);
};

// Startup.info may shell out (crontab); don't do that on every 5 s dashboard poll.
const STARTUP_TTL_MS = 30_000;
let startupCache: { at: number; value: SystemStatus["startup"] } | undefined;

export const invalidateSystemStatus = () => {
  startupCache = undefined;
};

const startupInfo = async () => {
  if (startupCache && Date.now() - startupCache.at < STARTUP_TTL_MS) return startupCache.value;
  const value = await Startup.info().catch(() => ({ enabled: false, method: null }));
  startupCache = { at: Date.now(), value };
  return value;
};

export async function systemStatus(caTrusted?: boolean): Promise<SystemStatus> {
  const [trusted, startup] = await Promise.all([caTrusted ?? isCATrusted().catch(() => null), startupInfo()]);
  return {
    platform: Constants.platform(),
    isRoot: isElevated(),
    canBindPrivileged: canBindPrivileged(),
    unprivilegedPortStart: unprivilegedPortStart(),
    caTrusted: trusted,
    startup,
    stateDir: Constants.paths.HOME,
  };
}

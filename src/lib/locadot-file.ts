import path from "path";
import FileModule from "../utils/file";
import type { ProxyInfo } from "../types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default class locadotFile {
  /** Written by the proxy itself once it is listening, so boot-started proxies are visible too. */
  static writeProxyInfo(info: ProxyInfo) {
    FileModule.writeAtomic("LOCK_FILE", JSON.stringify(info, null, 2));
  }

  static readProxyInfo(): ProxyInfo | undefined {
    const raw = FileModule.read("LOCK_FILE")?.trim();
    if (!raw) return undefined;
    try {
      const info = JSON.parse(raw);
      if (typeof info === "number") return locadotFile.legacyInfo(info);
      return Number.isInteger(info?.pid) && info.pid > 0 ? (info as ProxyInfo) : undefined;
    } catch {
      return locadotFile.legacyInfo(Number(raw));
    }
  }

  // Lock files from <=1.5.7 hold a bare PID.
  private static legacyInfo(pid: number): ProxyInfo | undefined {
    if (!Number.isInteger(pid) || pid <= 0) return undefined;
    return { pid } as ProxyInfo;
  }

  static getProcessId(): number | undefined {
    return locadotFile.readProxyInfo()?.pid;
  }

  static deleteLockFile(expectedPid?: number) {
    if (expectedPid && locadotFile.getProcessId() !== expectedPid) return;
    FileModule.remove("LOCK_FILE");
  }

  static isAlive(pid: number | undefined) {
    if (!pid) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (error: any) {
      // EPERM: alive but owned by another user (e.g. a root-started proxy).
      return error?.code === "EPERM";
    }
  }

  static async waitForExit(pid: number, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!locadotFile.isAlive(pid)) return true;
      await sleep(50);
    }
    return !locadotFile.isAlive(pid);
  }

  static clearLogs() {
    if (FileModule.exists("LOGS")) FileModule.write("LOGS", "");
  }

  static watchLogs(lines?: number) {
    FileModule.tailFile("LOGS", lines);
  }

  static getStartProxyFile(): { command: string; path: string[] } {
    // Compiled layout: dist/lib/locadot-file.js -> dist/core.js. Under tsx
    // (src/lib) the compiled dist/core.js is still what gets spawned.
    const compiled = path.join(__dirname, "..", "core.js");
    const fromSource = path.join(__dirname, "..", "..", "dist", "core.js");
    return {
      command: process.execPath,
      // http-proxy uses util._extend; keep its deprecation warning out of the log.
      path: ["--no-deprecation", __filename.endsWith(".ts") ? fromSource : compiled],
    };
  }
}

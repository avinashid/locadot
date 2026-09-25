import fs from "fs";
import { spawn } from "child_process";
import Constants from "./constants";
import locadotFile from "./lib/locadot-file";
import RegistryStore from "./lib/registry";
import FileModule from "./utils/file";
import logger from "./utils/logger";
import type { ProxyInfo } from "./types";

const START_TIMEOUT_MS = 10_000;
const STOP_TIMEOUT_MS = 5_000;
const LOG_ROTATE_BYTES = 5 * 1024 * 1024;

export class ProxyError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class ProxyHandler {
  running(): ProxyInfo | undefined {
    const info = locadotFile.readProxyInfo();
    return info && locadotFile.isAlive(info.pid) ? info : undefined;
  }

  private rotateLogs() {
    try {
      if (fs.statSync(Constants.paths.LOGS).size > LOG_ROTATE_BYTES) {
        fs.renameSync(Constants.paths.LOGS, `${Constants.paths.LOGS}.1`);
      }
    } catch {}
  }

  /** Spawns the proxy and waits until it reports it is listening, or fails loudly. */
  async start(): Promise<ProxyInfo> {
    const existing = this.running();
    if (existing) return existing;
    locadotFile.deleteLockFile();

    FileModule.ensureDir();
    this.rotateLogs();
    const logFd = fs.openSync(Constants.paths.LOGS, "a");
    const logOffset = fs.fstatSync(logFd).size;
    const { command, path: args } = locadotFile.getStartProxyFile();
    const entry = args[args.length - 1];
    if (!fs.existsSync(entry)) {
      fs.closeSync(logFd);
      throw new ProxyError(`❌ ${entry} not found. Run \`pnpm build\` first.`);
    }

    // The log fd is handed to the child directly: a pipe through this CLI
    // would break as soon as the CLI exits.
    const child = spawn(command, args, {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: {
        ...process.env,
        LOCADOT_HOME: Constants.paths.HOME,
        LOCADOT_ROLE: "proxy",
        LOCADOT_HTTP_PORT: String(Constants.server.httpPort),
        LOCADOT_HTTPS_PORT: String(Constants.server.httpsPort),
      },
      windowsHide: true,
    });
    fs.closeSync(logFd);

    let exitCode: number | null = null;
    child.once("exit", (code) => (exitCode = code ?? -1));
    child.unref();

    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const info = locadotFile.readProxyInfo();
      if (info && info.pid === child.pid) return info;
      if (exitCode !== null) break;
      await sleep(100);
    }

    if (exitCode === null && child.pid) {
      try {
        process.kill(child.pid);
      } catch {}
    }
    const tail = fs.readFileSync(Constants.paths.LOGS).subarray(logOffset).toString("utf8").trim().split(/\r?\n/).slice(-8).join("\n  ");
    throw new ProxyError(
      `❌ Central proxy failed to start${exitCode !== null ? ` (exit ${exitCode})` : " (timed out)"}.\n  ${tail}\n  Full log: ${Constants.paths.LOGS}`
    );
  }

  /** SIGTERM, wait, then SIGKILL. Returns false if nothing was running. */
  async stop(): Promise<boolean> {
    const info = locadotFile.readProxyInfo();
    if (!info || !locadotFile.isAlive(info.pid)) {
      locadotFile.deleteLockFile();
      return false;
    }
    try {
      process.kill(info.pid, "SIGTERM");
    } catch (error: any) {
      if (error?.code === "EPERM") {
        throw new ProxyError(
          `❌ The proxy (pid ${info.pid}) belongs to another user, probably root. Re-run this command with sudo.`
        );
      }
      if (error?.code !== "ESRCH") throw error;
    }
    if (!(await locadotFile.waitForExit(info.pid, STOP_TIMEOUT_MS))) {
      logger.warn(`⚠️ Proxy (pid ${info.pid}) ignored SIGTERM, forcing it to stop.`);
      try {
        process.kill(info.pid, "SIGKILL");
      } catch {}
      await locadotFile.waitForExit(info.pid, 2_000);
    }
    locadotFile.deleteLockFile(info.pid);
    return true;
  }

  async restart() {
    await this.stop();
    return this.start();
  }

  async kill() {
    const stopped = await this.stop();
    await RegistryStore.mutate((registry) => (registry.hosts = {}));
    locadotFile.clearLogs();
    return stopped;
  }
}

const locadotProxy = new ProxyHandler();

export default locadotProxy;

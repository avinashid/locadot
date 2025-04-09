import { locadotPath } from "../utils/constants";
import fs from "fs";
import { format } from "date-fns";
export interface DomainRegistry {
  [domain: string]: number;
}

export interface LogEntry {
  message: string;
  timestamp: number;
  status: "log" | "error" | "warn";
  description?: string;
}

export default class locadotFile {
  static async createLockFile(processId: string) {
    fs.writeFileSync(locadotPath.LOCK_FILE, processId);
  }

  static async getProcessId(): Promise<string | undefined | null> {
    try {
      if (fs.existsSync(locadotPath.LOCK_FILE)) {
        const pid = parseInt(fs.readFileSync(locadotPath.LOCK_FILE, "utf-8"));
        return pid.toString();
      }
    } catch (err) {
      return;
    }
  }
  static async deleteLockFile() {
    fs.rmSync(locadotPath.LOCK_FILE);
  }

  static async getRegistry(): Promise<DomainRegistry> {
    if (!fs.existsSync(locadotPath.REGISTRY_FILE)) {
      fs.writeFileSync(locadotPath.REGISTRY_FILE, "{}");
    }

    return JSON.parse(fs.readFileSync(locadotPath.REGISTRY_FILE, "utf-8"));
  }
  static async addRegistry(domain: string, port: number) {
    const registry = await locadotFile.getRegistry();
    registry[domain] = port;
    fs.writeFileSync(
      locadotPath.REGISTRY_FILE,
      JSON.stringify(registry, null, 2)
    );
  }
  static async removeAllRegistry() {
    fs.writeFileSync(locadotPath.REGISTRY_FILE, "{}");
  }
  static async updateRegistry(domain: string, port: number) {
    const registry = await locadotFile.getRegistry();
    registry[domain] = port;
    fs.writeFileSync(
      locadotPath.REGISTRY_FILE,
      JSON.stringify(registry, null, 2)
    );
  }
  static async deleteRegistry(domain: string) {
    const registry = await locadotFile.getRegistry();
    delete registry[domain];
    fs.writeFileSync(
      locadotPath.REGISTRY_FILE,
      JSON.stringify(registry, null, 2)
    );
  }

  static async watchRegistry(callBackOnChange?: () => void) {
    return fs.watch(locadotPath.REGISTRY_FILE, async (eventType) => {
      if (eventType === "change") {
        this.updateLogs("🔄 Updated domain mappings.");
        callBackOnChange && callBackOnChange();
      }
    });
  }

  static async getLogs(): Promise<{ logs?: LogEntry[] }> {
    if (!fs.existsSync(locadotPath.LOGS)) {
      fs.writeFileSync(locadotPath.LOGS, "{}");
    }
    return JSON.parse(fs.readFileSync(locadotPath.LOGS, "utf-8"));
  }

  static async updateLogs(
    message: string,
    status: "log" | "error" | "warn" = "log",
    description?: string
  ) {
    const logs = (await locadotFile.getLogs()).logs || [];

    if (!Array.isArray(logs)) {
      fs.writeFileSync(locadotPath.LOGS, "{}");
    }

    logs.push({
      message,
      timestamp: Date.now(),
      status: status,
      description,
    });
    fs.writeFileSync(locadotPath.LOGS, JSON.stringify({ logs: logs }));
  }

  static async clearLogs() {
    fs.writeFileSync(locadotPath.LOGS, "{}");
  }

  static async printLogs(log: LogEntry) {
    console[log.status || "log"](
      `${format(log.timestamp, "yyyy-MM-dd HH:mm:ss")}: ${log.message} ${
        log.description ? "==> " : ""
      }${log.description ? log.description : ""}\n`
    );
  }

  static async watchLogs() {
    const logs = await locadotFile.getLogs();
    let length = logs.logs?.length || 0;
    logs.logs?.forEach((log) => this.printLogs(log));
    fs.watch(locadotPath.LOGS, async (eventType) => {
      try {
        if (eventType === "change") {
          const newLog = await locadotFile.getLogs();
          newLog.logs?.forEach((log, i) => {
            if (i > length - 1) {
              this.printLogs(log);
            }
          });
          length = newLog.logs?.length || 0;
        }
      } catch (error) {}
    });
  }

  static async destroy(watcher?: fs.FSWatcher) {
    try {
      const pid = await locadotFile.getProcessId();
      locadotFile.deleteLockFile();
      locadotFile.removeAllRegistry();
      locadotFile.clearLogs();
      watcher?.close();
      if (pid) {
        process.kill(parseInt(pid));
      }
    } catch (error) {}
  }

  static async softDestroy(watcher?: fs.FSWatcher) {
    try {
      const pid = await locadotFile.getProcessId();
      locadotFile.deleteLockFile();
      watcher?.close();
      if (pid) {
        process.kill(parseInt(pid));
      }
    } catch (error) {}
  }
}

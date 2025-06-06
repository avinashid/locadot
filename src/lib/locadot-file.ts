import FileModule from "../utils/file";
import logger from "../utils/logger";
import path from "path";
import type { FSWatcher } from "chokidar";
export interface DomainRegistry {
  [domain: string]: number;
}

export default class locadotFile {
  static async createLockFile(processId: string) {
    await FileModule.writeFileSync("LOCK_FILE", processId);
  }

  static async getProcessId(): Promise<string | undefined | null> {
    try {
      const lockFile = await FileModule.readFileSync("LOCK_FILE");
      return parseInt(lockFile).toString();
    } catch (err) {
      await FileModule.removeFileSync("LOCK_FILE");
      return;
    }
  }
  static async deleteLockFile() {
    await FileModule.removeFileSync("LOCK_FILE");
  }

  static async getRegistry(): Promise<DomainRegistry> {
    try {
      return JSON.parse(await FileModule.readFileSync("REGISTRY_FILE"));
    } catch (error) {
      logger.error(error);
      return {};
    }
  }
  static async addRegistry(domain: string, port: number) {
    const registry = await locadotFile.getRegistry();
    registry[domain] = port;
    FileModule.writeFileSync("REGISTRY_FILE", JSON.stringify(registry));
  }
  static async removeAllRegistry() {
    FileModule.writeFileSync("REGISTRY_FILE", "{}");
  }
  static async updateRegistry(domain: string, port: number) {
    const registry = await locadotFile.getRegistry();
    registry[domain] = port;
    FileModule.writeFileSync("REGISTRY_FILE", JSON.stringify(registry));
  }
  static async deleteRegistry(domain: string) {
    const registry = await locadotFile.getRegistry();
    delete registry[domain];
    FileModule.writeFileSync("REGISTRY_FILE", JSON.stringify(registry));
  }

  static async watchRegistry(callBackOnChange?: () => void) {
    return FileModule.watchFileWithInit("REGISTRY_FILE", () =>
      callBackOnChange?.()
    );
  }

  static async getLogs(): Promise<string> {
    try {
      return await FileModule.readFileSync("LOGS");
    } catch (error) {
      FileModule.removeFileSync("LOGS");
      return "";
    }
  }

  static async clearLogs() {
    FileModule.writeFileSync("LOGS", "");
  }

  static async watchLogs() {
    FileModule.tailFile("LOGS");
  }

  static getStartProxyFile(): { command: string; path: string[] } {
    if (process.env.NODE_ENV === "production") {
      const filePath = path.join(__dirname, "..", "core.js");
      return {
        command: "node",
        path: [filePath],
      };
    }
    const filePath = path.join(__dirname, "../../", "dist", "core.js");
    return {
      command: "node",
      path: [filePath],
    };
  }

  static async destroy(watcher?: FSWatcher) {
    try {
      const pid = await locadotFile.getProcessId();
      await locadotFile.deleteLockFile();
      await locadotFile.removeAllRegistry();
      await locadotFile.clearLogs();
      await watcher?.close();
      if (pid) {
        process.kill(parseInt(pid));
      }
    } catch (error) {}
  }

  static async softDestroy(watcher?: FSWatcher) {
    try {
      const pid = await locadotFile.getProcessId();
      await locadotFile.deleteLockFile();
      await locadotFile.clearLogs();
      await watcher?.close();
      if (pid) {
        try {
          process.kill(parseInt(pid));
        } catch (error) {}
      }
    } catch (error) {
      logger.error(error);
    }
  }
}

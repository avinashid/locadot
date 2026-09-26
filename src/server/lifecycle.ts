import type { FSWatcher } from "chokidar";
import locadotFile from "../lib/locadot-file";
import FileModule from "../utils/file";
import logger from "../utils/logger";
import type { ProxyServer } from "./listeners";

interface Resources {
  watcher: FSWatcher;
  servers: ProxyServer[];
  stopTunnels(): void;
}

/** Returns the idempotent shutdown and wires it to the process signals. */
export const installShutdown = ({ watcher, servers, stopTunnels }: Resources) => {
  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info(`🛑 ${signal} received, shutting down`);
    locadotFile.deleteLockFile(process.pid);
    FileModule.remove("API_TOKEN");
    stopTunnels();
    setTimeout(() => process.exit(0), 3000).unref();
    Promise.allSettled([
      watcher.close(),
      ...servers.map(
        (s) =>
          new Promise<void>((resolve) => {
            s.close(() => resolve());
            s.closeAllConnections?.();
          })
      ),
    ]).finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));
  process.on("uncaughtException", (error) => logger.error(error));
  process.on("unhandledRejection", (error) => logger.error(error));
  return shutdown;
};

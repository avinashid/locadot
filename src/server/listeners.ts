import http from "http";
import https from "https";
import Constants from "../constants";
import logger from "../utils/logger";
import type { ProxyInfo } from "../types";

export type ProxyServer = http.Server | https.Server;

// Addresses that may legitimately be missing (no IPv6 on the host).
const SKIPPABLE = new Set(["EADDRNOTAVAIL", "EAFNOSUPPORT"]);

const listen = (server: ProxyServer, port: number, host: string) =>
  new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => reject(error);
    server.once("error", onError);
    server.listen({ port, host }, () => {
      server.off("error", onError);
      resolve();
    });
  });

const explain = (error: NodeJS.ErrnoException, port: number) => {
  if (error.code === "EADDRINUSE") {
    return `Port ${port} is already in use by another program (another proxy, nginx, apache?). Run \`locadot doctor\`.`;
  }
  if (error.code === "EACCES") {
    return `Permission denied binding port ${port}. Ports below 1024 need root; see \`locadot doctor\` for options.`;
  }
  return `Cannot listen on port ${port}: ${error.message}`;
};

/** One server per (port, bind address); records the bound addresses in `info`. Exits on a real bind failure. */
export const bindAll = async (make: (secure: boolean) => ProxyServer, info: ProxyInfo) => {
  const servers: ProxyServer[] = [];
  for (const [secure, port] of [
    [false, info.httpPort],
    [true, info.httpsPort],
  ] as const) {
    for (const host of Constants.server.bind) {
      const server = make(secure);
      try {
        await listen(server, port, host);
        servers.push(server);
        if (!info.bind.includes(host)) info.bind.push(host);
        logger.info(`🛜 ${secure ? "HTTPS" : "HTTP"} listening on ${host.includes(":") ? `[${host}]` : host}:${port}`);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code && SKIPPABLE.has(err.code)) {
          logger.warn(`Skipping ${host}:${port} (${err.code})`);
          continue;
        }
        logger.error(`❌ ${explain(err, port)}`);
        servers.forEach((s) => s.close());
        process.exit(1);
      }
    }
  }
  if (!servers.length) {
    logger.error("❌ Could not bind any address. Check LOCADOT_BIND.");
    process.exit(1);
  }
  return servers;
};

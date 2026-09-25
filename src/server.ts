import crypto from "crypto";
import fs from "fs";
import http from "http";
import https from "https";
import net from "net";
import httpProxy from "http-proxy";
import type { FSWatcher } from "chokidar";
import Constants from "./constants";
import RegistryStore from "./lib/registry";
import locadotFile from "./lib/locadot-file";
import HttpModule, { applyCors, hostOf, originMap, rewriteBody, rewriteOrigins, type RouterContext } from "./lib/http";
import Localhost from "./lib/localhost";
import { rewriteViaResponse, type Via } from "./lib/passthrough";
import FileModule from "./utils/file";
import logger from "./utils/logger";
import { createSNICallback, defaultContext, getCertFor } from "./utils/certs";
import { isCATrusted } from "./utils/trust";
import { handleDashboardRequest } from "./dashboard";
import type { HostStats, ProxyInfo, Registry } from "./types";
import { version } from "../package.json";

// Addresses that may legitimately be missing (no IPv6 on the host).
const SKIPPABLE = new Set(["EADDRNOTAVAIL", "EAFNOSUPPORT"]);

const listen = (server: net.Server, port: number, host: string) =>
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

export async function startCentralProxy() {
  let registry: Registry = { version: 2, hosts: {} };
  // Certs are slow to generate (~1-2 s each); do it ahead of the first request.
  let warming = Promise.resolve();
  const warmCerts = (hosts: string[]) => {
    for (const host of hosts) {
      warming = warming.then(() => getCertFor(host).then(
          () => undefined,
          (error) => {
            logger.warn(`cert for ${host}: ${error}`);
          }
        )
      );
    }
  };
  const reload = () => {
    try {
      registry = RegistryStore.read();
      logger.info(`🔄 Loaded ${Object.keys(registry.hosts).length} host mapping(s)`);
      warmCerts(Object.keys(registry.hosts));
    } catch (error) {
      // Keep serving the last good mapping rather than dropping everything.
      logger.error(error);
    }
  };
  reload();

  const stats = new Map<string, HostStats>();
  const proxy = httpProxy.createProxyServer({});
  proxy.on("error", (err) => logger.warn(`proxy error: ${err.message}`));
  // Hop-by-hop headers describe the upstream connection, not ours. Apache sends
  // `Connection: Upgrade, close` + `Upgrade: h2`, which made us close the browser's
  // socket after every response (ERR_TOO_MANY_RETRIES on asset-heavy pages).
  proxy.on("proxyRes", (proxyRes, req, res) => {
    if (proxyRes.statusCode === 101) return;
    const listed = String(proxyRes.headers.connection || "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
    for (const name of [...listed, "connection", "keep-alive", "upgrade", "proxy-connection"]) {
      delete proxyRes.headers[name];
    }
    const entry = registry.hosts[hostOf(req)];
    if (!entry?.cors) return;
    applyCors(req, proxyRes.headers);
    const via: Via | undefined = (req as any).locadotVia;
    const pairs = originMap(req, registry.hosts);
    if (via) rewriteViaResponse(proxyRes.headers, via, entry.target);
    else if (proxyRes.headers.location) proxyRes.headers.location = rewriteOrigins(proxyRes.headers.location, pairs);
    rewriteBody(req, res, proxyRes, pairs, !via);
  });

  const info: ProxyInfo = {
    pid: process.pid,
    version,
    startedAt: new Date().toISOString(),
    httpPort: Constants.server.httpPort,
    httpsPort: Constants.server.httpsPort,
    bind: [],
    stateDir: Constants.paths.HOME,
  };

  // Rotated per start; the page gets it embedded, local scripts read the 0600 file.
  const token = crypto.randomBytes(32).toString("hex");
  FileModule.ensureDir();
  fs.writeFileSync(Constants.paths.API_TOKEN, token, { mode: 0o600 });
  try {
    fs.chmodSync(Constants.paths.API_TOKEN, 0o600);
  } catch {}

  const refreshTrust = () =>
    isCATrusted()
      .then((trusted) => (info.caTrusted = trusted))
      .catch(() => (info.caTrusted = undefined));

  let shutdown: (signal: string) => void = () => process.exit(0);

  const ctx: RouterContext = {
    proxy,
    stats,
    lookup: (host) => registry.hosts[host],
    dashboard: (req, res) =>
      handleDashboardRequest(req, res, {
        getRegistry: () => registry,
        getStats: () => Object.fromEntries(stats),
        proxyInfo: info,
        probe: (target) => {
          const entry = Object.values(registry.hosts).find((h) => h.target === target);
          return Localhost.probe(target, 1500, entry?.insecure);
        },
        token,
        reload,
        refreshTrust,
        shutdown: (reason) => shutdown(reason),
      }),
  };

  const tls = { ...(await defaultContext()), SNICallback: createSNICallback() };
  const servers: net.Server[] = [];
  const make = (secure: boolean) => {
    const handler = (req: http.IncomingMessage, res: http.ServerResponse) =>
      HttpModule.requestHandler(req, res, ctx);
    const server = secure ? https.createServer(tls, handler) : http.createServer(handler);
    server.on("upgrade", (req, socket, head) => HttpModule.requestUpgrade(req, socket, head, ctx));
    server.on("clientError", (_err, socket) => socket.destroy());
    return server;
  };

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
      } catch (error: any) {
        if (SKIPPABLE.has(error?.code)) {
          logger.warn(`Skipping ${host}:${port} (${error.code})`);
          continue;
        }
        logger.error(`❌ ${explain(error, port)}`);
        servers.forEach((s) => s.close());
        process.exit(1);
      }
    }
  }
  if (!servers.length) {
    logger.error("❌ Could not bind any address. Check LOCADOT_BIND.");
    process.exit(1);
  }

  const watcher: FSWatcher = FileModule.watch("REGISTRY_FILE", reload);

  await refreshTrust();
  setInterval(refreshTrust, 5 * 60_000).unref();

  locadotFile.writeProxyInfo(info);

  let closing = false;
  shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info(`🛑 ${signal} received, shutting down`);
    locadotFile.deleteLockFile(process.pid);
    FileModule.remove("API_TOKEN");
    setTimeout(() => process.exit(0), 3000).unref();
    Promise.allSettled([
      watcher.close(),
      ...servers.map(
        (s) =>
          new Promise<void>((resolve) => {
            s.close(() => resolve());
            (s as any).closeAllConnections?.();
          })
      ),
    ]).finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));
  process.on("uncaughtException", (error) => logger.error(error));
  process.on("unhandledRejection", (error) => logger.error(error));

  logger.info(`☑️ locadot ${version} ready (pid ${process.pid})`);
}

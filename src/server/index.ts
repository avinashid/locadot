import http from "http";
import https from "https";
import httpProxy from "http-proxy";
import Constants from "../constants";
import locadotFile from "../lib/locadot-file";
import Localhost from "../lib/localhost";
import { handleRequest, handleUpgrade, type RouterContext } from "../proxy/router";
import { handleProxyResponse } from "../proxy/response";
import { TunnelManager } from "../proxy/tunnel";
import FileModule from "../utils/file";
import logger from "../utils/logger";
import { createSNICallback, defaultContext } from "../utils/certs";
import { isCATrusted } from "../utils/trust";
import { handleDashboardRequest } from "../dashboard";
import type { HostStats, ProxyInfo } from "../types";
import { version } from "../../package.json";
import { bindAll } from "./listeners";
import { installShutdown } from "./lifecycle";
import { createRegistryState } from "./state";
import { issueApiToken } from "./token";

export async function startCentralProxy() {
  const tunnels = new TunnelManager(() => {
    const host = Constants.server.bind.find((address) => !address.includes(":")) ? "127.0.0.1" : "[::1]";
    return `http://${host}:${Constants.server.httpPort}`;
  });
  const registry = createRegistryState((hosts) => tunnels.sync(hosts));
  registry.reload();

  const stats = new Map<string, HostStats>();
  const proxy = httpProxy.createProxyServer({});
  proxy.on("error", (err) => logger.warn(`proxy error: ${err.message}`));
  proxy.on("proxyRes", (proxyRes, req, res) => handleProxyResponse(proxyRes, req, res, registry.get().hosts, (host) => tunnels.state(host).url));

  const info: ProxyInfo = {
    pid: process.pid,
    version,
    startedAt: new Date().toISOString(),
    httpPort: Constants.server.httpPort,
    httpsPort: Constants.server.httpsPort,
    bind: [],
    stateDir: Constants.paths.HOME,
  };

  const token = issueApiToken();

  const refreshTrust = () =>
    isCATrusted()
      .then((trusted) => (info.caTrusted = trusted))
      .catch(() => (info.caTrusted = undefined));

  let shutdown: (signal: string) => void = () => process.exit(0);

  const ctx: RouterContext = {
    proxy,
    stats,
    lookup: (host) => registry.get().hosts[tunnels.hostFor(host) ?? host],
    tunnelFor: (host) => tunnels.hostFor(host),
    dashboard: (req, res) =>
      handleDashboardRequest(req, res, {
        getRegistry: registry.get,
        getStats: () => Object.fromEntries(stats),
        proxyInfo: info,
        probe: (target) => {
          const entry = Object.values(registry.get().hosts).find((h) => h.target === target);
          return Localhost.probe(target, 1500, entry?.insecure);
        },
        token,
        reload: registry.reload,
        refreshTrust,
        shutdown: (reason) => shutdown(reason),
        tunnel: (host) => tunnels.state(host),
        retryTunnels: () => tunnels.sync(registry.get().hosts, true),
      }),
  };

  const tls = { ...(await defaultContext()), SNICallback: createSNICallback() };
  const servers = await bindAll((secure) => {
    const handler = (req: http.IncomingMessage, res: http.ServerResponse) => handleRequest(req, res, ctx);
    const server = secure ? https.createServer(tls, handler) : http.createServer(handler);
    server.on("upgrade", (req, socket, head) => handleUpgrade(req, socket, head, ctx));
    server.on("clientError", (_err, socket) => socket.destroy());
    return server;
  }, info);

  const watcher = FileModule.watch("REGISTRY_FILE", registry.reload);

  await refreshTrust();
  setInterval(refreshTrust, 5 * 60_000).unref();

  locadotFile.writeProxyInfo(info);

  shutdown = installShutdown({ watcher, servers, stopTunnels: () => tunnels.stopAll() });

  logger.info(`☑️ locadot ${version} ready (pid ${process.pid})`);
}

import fs from "fs";
import { InputError } from "../../lib/localhost";
import locadotProxy from "../../lib/proxy-control";
import RegistryStore from "../../lib/registry";
import { urlFor } from "../../lib/urls";
import Constants from "../../constants";
import FileModule from "../../utils/file";
import Startup from "../../utils/startup";
import { isCATrusted } from "../../utils/trust";
import { print } from "../shared";

export type PortOptions = { port?: string; httpsPort?: string };

/** Applies --port/--https-port and saves them, so `add`, `status`, `open` and boot startup use the same ports. */
const usePorts = (options: PortOptions) => {
  if (options.port === undefined && options.httpsPort === undefined) return false;
  const parse = (value: string | undefined, flag: string) => {
    if (value === undefined) return undefined;
    const port = Constants.validPort(value);
    if (!port) throw new InputError(`❌ ${flag} must be a port between 1 and 65535, got "${value}".`);
    return port;
  };
  const httpPort = parse(options.port, "--port") ?? Constants.server.httpPort;
  const httpsPort = parse(options.httpsPort, "--https-port") ?? Constants.server.httpsPort;
  if (httpPort === httpsPort) throw new InputError(`❌ HTTP and HTTPS can't share port ${httpPort}.`);
  Object.assign(Constants.server, { httpPort, httpsPort });
  FileModule.ensureDir();
  fs.writeFileSync(Constants.paths.CONFIG_FILE, JSON.stringify({ httpPort, httpsPort }, null, 2) + "\n");
  return true;
};

export async function status(options: { json?: boolean }) {
  const info = locadotProxy.running();
  const hosts = Object.keys(RegistryStore.read().hosts).length;
  const [trusted, startup] = await Promise.all([isCATrusted().catch(() => undefined), Startup.isEnabled()]);
  const report = {
    running: Boolean(info),
    pid: info?.pid,
    version: info?.version,
    startedAt: info?.startedAt,
    httpPort: info?.httpPort ?? Constants.server.httpPort,
    httpsPort: info?.httpsPort ?? Constants.server.httpsPort,
    bind: info?.bind ?? Constants.server.bind,
    hosts,
    caTrusted: trusted,
    startupEnabled: startup,
    dashboard: urlFor("localhost"),
    stateDir: Constants.paths.HOME,
  };
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  print(info ? `🟢 Proxy running (pid ${info.pid}${info.startedAt ? `, since ${info.startedAt}` : ""})` : "🔴 Proxy not running");
  print(`   Ports:     http ${report.httpPort}, https ${report.httpsPort} on ${report.bind.join(", ")}`);
  print(`   Hosts:     ${hosts}`);
  print(`   CA:        ${trusted === undefined ? "unknown" : trusted ? "trusted" : "not trusted (run `locadot trust`)"}`);
  print(`   Startup:   ${startup ? "enabled" : "disabled"}`);
  print(`   Dashboard: ${report.dashboard}`);
  print(`   State dir: ${report.stateDir}`);
}

export async function start(options: PortOptions = {}) {
  const moved = usePorts(options);
  const running = locadotProxy.running();
  // Already up on other ports: the new ones only take effect after a restart.
  if (running && (running.httpPort !== Constants.server.httpPort || running.httpsPort !== Constants.server.httpsPort)) {
    const info = await locadotProxy.restart();
    print(`🔁 Proxy restarted on http ${info.httpPort}, https ${info.httpsPort} (pid ${info.pid}).`);
  } else {
    const info = await locadotProxy.start();
    print(running ? `☑️ Proxy already running (pid ${info.pid}).` : `🚀 Central proxy started (pid ${info.pid}).`);
    if (moved || !running) print(`   Ports:     http ${info.httpPort}, https ${info.httpsPort}`);
  }
  print(`   Dashboard: ${urlFor("localhost")}`);
}

export async function stop() {
  const stopped = await locadotProxy.stop();
  print(stopped ? Constants.proxyInfo.softClose : "☑️ Proxy was not running.");
}

export async function restart(options: PortOptions = {}) {
  usePorts(options);
  const info = await locadotProxy.restart();
  print(`☑️ Proxy restarted on http ${info.httpPort}, https ${info.httpsPort} (pid ${info.pid}).`);
}

export async function kill() {
  await locadotProxy.kill();
  print(Constants.proxyInfo.proxyClose);
}

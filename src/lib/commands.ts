import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import Localhost, { InputError } from "./localhost";
import locadotProxy from "../proxy";
import locadotFile from "./locadot-file";
import RegistryStore from "./registry";
import HostOps from "./hosts";
import FileModule from "../utils/file";
import logger from "../utils/logger";
import Constants from "../constants";
import Startup from "../utils/startup";
import { caCertPath } from "../utils/certs";
import { isCATrusted, trustCA, untrustCA, trustInstructions } from "../utils/trust";
import type { HostEntry, ProxyInfo } from "../types";

export type TargetOptions = {
  host: string;
  port?: string;
  target?: string;
  insecure?: boolean;
  cors?: boolean;
  start?: boolean;
};

export type PortOptions = { port?: string; httpsPort?: string };

const print = (message: string) => logger.info(message);

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

export const urlFor = (host: string, secure = true) => {
  const port = secure ? Constants.server.httpsPort : Constants.server.httpPort;
  const standard = secure ? 443 : 80;
  return `${secure ? "https" : "http"}://${host}${port === standard ? "" : `:${port}`}`;
};

const requireHost = (value: string) => {
  const host = Localhost.normalizeHost(value);
  if (!host) throw new InputError(Constants.proxyInfo.invalidHost);
  return host;
};

const resolveTarget = (options: TargetOptions) => {
  if (options.port !== undefined && options.target !== undefined) {
    throw new InputError("❌ Use either --port or --target, not both.");
  }
  if (options.port !== undefined) return `http://localhost:${Localhost.parsePort(options.port)}`;
  if (options.target !== undefined) return Localhost.parseTarget(options.target);
  throw new InputError("❌ Missing destination. Pass --port <port> or --target <url>.");
};

/** The proxy only picks up mappings once running; a failure here must not be hidden. */
const ensureRunning = async (options: TargetOptions) => {
  if (options.start === false) return;
  const wasRunning = locadotProxy.running();
  const info = await locadotProxy.start();
  if (!wasRunning) print(`🚀 Central proxy started (pid ${info.pid}).`);
};

const warnIfDown = async (entry: HostEntry) => {
  const probe = await Localhost.probe(entry.target, 1500, entry.insecure);
  if (!probe.up) print(`⚠️  Nothing answered at ${entry.target} yet (${probe.error}). The mapping is saved anyway.`);
};

export default class Commands {
  static async add(options: TargetOptions) {
    const { host, entry } = await HostOps.add({ host: options.host, target: resolveTarget(options), insecure: options.insecure, cors: options.cors });
    const { target } = entry;
    await ensureRunning(options);
    print(`✅ ${urlFor(host)} → ${target}`);
    if (!Localhost.isLocalTarget(target)) {
      print("ℹ️  Remote target: redirects to other domains will leave the .localhost name.");
    }
    await warnIfDown(entry);
  }

  static async update(options: TargetOptions) {
    const { host, entry } = await HostOps.update({ host: options.host, target: resolveTarget(options), insecure: options.insecure, cors: options.cors });
    const { target } = entry;
    await ensureRunning(options);
    print(`✅ Updated ${urlFor(host)} → ${target}`);
    await warnIfDown(entry);
  }

  static async remove(options: { host: string }) {
    const { host } = await HostOps.remove(options);
    print(`🗑️  Removed ${host}.`);
  }

  static async list(options: { json?: boolean }) {
    const hosts = Object.entries(RegistryStore.read().hosts).sort(([a], [b]) => a.localeCompare(b));
    if (options.json) {
      console.log(JSON.stringify(hosts.map(([host, entry]) => ({ host, url: urlFor(host), ...entry })), null, 2));
      return;
    }
    if (!hosts.length) {
      print("No hosts mapped. Add one: npx locadot add --host app.localhost --port 3000");
      return;
    }
    const width = Math.max(...hosts.map(([host]) => urlFor(host).length));
    for (const [host, entry] of hosts) {
      print(`${urlFor(host).padEnd(width)}  →  ${entry.target}${entry.insecure ? "  (insecure)" : ""}${entry.cors ? "  (cors)" : ""}`);
    }
    print(`☑️ Total: ${hosts.length}.`);
  }

  static async status(options: { json?: boolean }) {
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

  static async doctor(options: { host?: string }) {
    let failures = 0;
    const check = (ok: boolean | undefined, label: string, hint?: string) => {
      if (ok === undefined) print(`➖ ${label}`);
      else print(`${ok ? "✅" : "❌"} ${label}${!ok && hint ? `\n     → ${hint}` : ""}`);
      if (ok === false) failures++;
    };

    const info = locadotProxy.running();
    check(Boolean(info), `Proxy process ${info ? `running (pid ${info.pid})` : "not running"}`, "Run `locadot start` and read the error it prints.");

    for (const port of [Constants.server.httpPort, Constants.server.httpsPort]) {
      const listening = await Localhost.isPortListening(port);
      if (info) {
        check(listening, `Port ${port} answering`, "The proxy is running but not listening; check `locadot logs`.");
      } else if (listening) {
        check(false, `Port ${port} is free`, `Something else holds port ${port}. Find it with \`sudo lsof -i :${port}\`, or pick another with \`locadot start ${port === Constants.server.httpPort ? "--port" : "--https-port"} <port>\`.`);
      }
    }

    if (info && (await Localhost.isPortListening(Constants.server.httpPort))) {
      const probe = await Localhost.probe(`http://127.0.0.1:${Constants.server.httpPort}/healthz`);
      check(probe.up && probe.status === 200, "Dashboard responds", "Another program may be answering on the proxy port.");
    }

    if (os.platform() === "linux" && Math.min(Constants.server.httpPort, Constants.server.httpsPort) < 1024) {
      let unprivileged = 1024;
      try {
        unprivileged = Number(fs.readFileSync("/proc/sys/net/ipv4/ip_unprivileged_port_start", "utf8"));
      } catch {}
      const canBind = process.getuid?.() === 0 || unprivileged <= Math.min(Constants.server.httpPort, Constants.server.httpsPort);
      check(
        canBind || Boolean(info),
        "Allowed to bind ports 80/443",
        "Run with sudo, or allow it once: `sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80` (persist in /etc/sysctl.d/)."
      );
    }

    const trusted = await isCATrusted().catch(() => false);
    check(trusted, "Locadot CA trusted by the system", `Run \`locadot trust\`. Manual steps:\n${trustInstructions()}`);

    try {
      const registry = RegistryStore.read();
      check(true, `Registry readable (${Object.keys(registry.hosts).length} host(s))`);
      const hosts = options.host ? [requireHost(options.host)] : Object.keys(registry.hosts);
      for (const host of hosts) {
        const entry = registry.hosts[host];
        if (!entry) {
          check(false, `${host} is mapped`, `locadot add --host ${host} --port <port>`);
          continue;
        }
        const probe = await Localhost.probe(entry.target, 2000, entry.insecure);
        check(probe.up, `${host} → ${entry.target} ${probe.up ? `answers (${probe.status}, ${probe.ms}ms)` : `unreachable (${probe.error})`}`, "Start the app, or fix the target with `locadot update`.");
      }
    } catch (error: any) {
      check(false, "Registry readable", error.message);
    }

    print(failures ? `\n${failures} problem(s) found.` : "\nAll checks passed.");
    if (failures) process.exitCode = 1;
  }

  static async start(options: PortOptions = {}) {
    const moved = usePorts(options);
    const running = locadotProxy.running();
    // Already up on other ports: the new ones only take effect after a restart.
    if (running && (running.httpPort !== Constants.server.httpPort || running.httpsPort !== Constants.server.httpsPort)) {
      const info = await locadotProxy.restart();
      print(`🔁 Proxy restarted on http ${info.httpPort}, https ${info.httpsPort} (pid ${info.pid}).`);
    } else {
      const info: ProxyInfo = await locadotProxy.start();
      print(running ? `☑️ Proxy already running (pid ${info.pid}).` : `🚀 Central proxy started (pid ${info.pid}).`);
      if (moved || !running) print(`   Ports:     http ${info.httpPort}, https ${info.httpsPort}`);
    }
    print(`   Dashboard: ${urlFor("localhost")}`);
  }

  static async stop() {
    const stopped = await locadotProxy.stop();
    print(stopped ? Constants.proxyInfo.softClose : "☑️ Proxy was not running.");
  }

  static async restart(options: PortOptions = {}) {
    usePorts(options);
    const info = await locadotProxy.restart();
    print(`☑️ Proxy restarted on http ${info.httpPort}, https ${info.httpsPort} (pid ${info.pid}).`);
  }

  static async kill() {
    await locadotProxy.kill();
    print(Constants.proxyInfo.proxyClose);
  }

  static async clearHosts() {
    await RegistryStore.mutate((registry) => (registry.hosts = {}));
    print("☑️ All hosts removed.");
  }

  static logs(options: { lines?: string; follow?: boolean }) {
    const lines = options.lines ? Localhost.parsePort(options.lines) : 50;
    if (options.follow === false) {
      console.log(FileModule.lastLines("LOGS", lines).join("\n") || "(log is empty)");
      return;
    }
    locadotFile.watchLogs(lines);
  }

  static clearLogs() {
    locadotFile.clearLogs();
    print("☑️ Logs successfully cleared.");
  }

  static logPath() {
    console.log(Constants.paths.LOGS);
  }

  static hostPath() {
    console.log(Constants.paths.REGISTRY_FILE);
  }

  static configPath() {
    const rows: [string, string][] = [
      ["State dir", Constants.paths.HOME],
      ["Registry", Constants.paths.REGISTRY_FILE],
      ["Lock file", Constants.paths.LOCK_FILE],
      ["Logs", Constants.paths.LOGS],
      ["Certs", Constants.paths.CERT_DIR],
      ["CA cert", caCertPath()],
      ["API token", Constants.paths.API_TOKEN],
      ["Config", Constants.paths.CONFIG_FILE],
    ];
    rows.forEach(([label, value]) => console.log(`${label.padEnd(10)} ${value}`));
  }

  /** For scripts and AI agents driving the dashboard API. */
  static token() {
    const token = locadotProxy.running() ? FileModule.read("API_TOKEN")?.trim() : undefined;
    if (!token) throw new InputError("❌ The proxy isn't running, so there's no API token. Run `locadot start`.");
    console.log(token);
  }

  static async open(host?: string) {
    const url = host ? urlFor(requireHost(host)) : urlFor("localhost");
    const [command, args] =
      os.platform() === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : os.platform() === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
    try {
      // windows-hide-exempt: run from the user's terminal (no popup), and hiding `cmd /c start` can hide the browser too.
      spawn(command, args as string[], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
    } catch {}
    print(url);
  }

  static async trust() {
    await trustCA();
    print(`✅ Locadot CA trusted (${caCertPath()}). Restart your browser if it was open.`);
  }

  static async untrust() {
    await untrustCA();
    print("✅ Locadot CA removed from the trust store.");
  }

  static async enableStartup() {
    await Startup.enable();
  }

  static async disableStartup() {
    await Startup.disable();
  }

  static async statusStartup() {
    print((await Startup.isEnabled()) ? "enabled" : "disabled");
  }
}

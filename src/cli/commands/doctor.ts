import fs from "fs";
import os from "os";
import Localhost from "../../lib/localhost";
import locadotProxy from "../../lib/proxy-control";
import RegistryStore from "../../lib/registry";
import Constants from "../../constants";
import { isCATrusted, trustInstructions } from "../../utils/trust";
import { print } from "../shared";

export async function doctor(options: { host?: string }) {
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
    const hosts = options.host ? [Localhost.requireHost(options.host)] : Object.keys(registry.hosts);
    for (const host of hosts) {
      const entry = registry.hosts[host];
      if (!entry) {
        check(false, `${host} is mapped`, `locadot add --host ${host} --port <port>`);
        continue;
      }
      const probe = await Localhost.probe(entry.target, 2000, entry.insecure);
      check(probe.up, `${host} → ${entry.target} ${probe.up ? `answers (${probe.status}, ${probe.ms}ms)` : `unreachable (${probe.error})`}`, "Start the app, or fix the target with `locadot update`.");
    }
  } catch (error) {
    check(false, "Registry readable", (error as Error).message);
  }

  print(failures ? `\n${failures} problem(s) found.` : "\nAll checks passed.");
  if (failures) process.exitCode = 1;
}

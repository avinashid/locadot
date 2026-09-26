import Localhost, { InputError } from "../../lib/localhost";
import RegistryStore from "../../lib/registry";
import HostOps from "../../lib/hosts";
import { urlFor } from "../../lib/urls";
import type { HostEntry } from "../../types";
import { ensureRunning, print } from "../shared";

export type TargetOptions = {
  host: string;
  port?: string;
  target?: string;
  insecure?: boolean;
  cors?: boolean;
  start?: boolean;
};

const resolveTarget = (options: TargetOptions) => {
  if (options.port !== undefined && options.target !== undefined) {
    throw new InputError("❌ Use either --port or --target, not both.");
  }
  if (options.port !== undefined) return `http://localhost:${Localhost.parsePort(options.port)}`;
  if (options.target !== undefined) return Localhost.parseTarget(options.target);
  throw new InputError("❌ Missing destination. Pass --port <port> or --target <url>.");
};

const mapping = (options: TargetOptions) => ({
  host: options.host,
  target: resolveTarget(options),
  insecure: options.insecure,
  cors: options.cors,
});

const warnIfDown = async (entry: HostEntry) => {
  const probe = await Localhost.probe(entry.target, 1500, entry.insecure);
  if (!probe.up) print(`⚠️  Nothing answered at ${entry.target} yet (${probe.error}). The mapping is saved anyway.`);
};

export async function add(options: TargetOptions) {
  const { host, entry } = await HostOps.add(mapping(options));
  await ensureRunning(options);
  print(`✅ ${urlFor(host)} → ${entry.target}`);
  if (!Localhost.isLocalTarget(entry.target)) {
    print("ℹ️  Remote target: redirects to other domains will leave the .localhost name.");
  }
  await warnIfDown(entry);
}

export async function update(options: TargetOptions) {
  const { host, entry } = await HostOps.update(mapping(options));
  await ensureRunning(options);
  print(`✅ Updated ${urlFor(host)} → ${entry.target}`);
  await warnIfDown(entry);
}

export async function remove(options: { host: string }) {
  const { host } = await HostOps.remove(options);
  print(`🗑️  Removed ${host}.`);
}

export async function list(options: { json?: boolean }) {
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

export async function clearHosts() {
  await RegistryStore.mutate((registry) => (registry.hosts = {}));
  print("☑️ All hosts removed.");
}

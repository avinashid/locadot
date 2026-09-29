import Localhost, { InputError } from "../../lib/localhost";
import RegistryStore from "../../lib/registry";
import HostOps from "../../lib/hosts";
import { parseAllowList } from "../../lib/allow";
import { urlFor } from "../../lib/urls";
import type { HostEntry } from "../../types";
import { ensureRunning, print } from "../shared";

export type TargetOptions = {
  host: string;
  port?: string;
  target?: string;
  insecure?: boolean;
  cors?: boolean;
  allow?: string;
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
  allow: options.allow,
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

export async function allow(addresses: string[], options: { host: string; rm?: boolean; clear?: boolean }) {
  const host = Localhost.requireHost(options.host);
  const entry = RegistryStore.read().hosts[host];
  if (!entry) throw new InputError(`❌ ${host} isn't mapped. Add it first: locadot add --host ${host} --port <port> --cors`);
  if (options.clear && addresses.length) throw new InputError("❌ Use either --clear or addresses, not both.");
  if (options.rm && !addresses.length) throw new InputError("❌ Pass the addresses to remove.");

  const current = entry.allow ?? [];
  let next = current;
  if (options.clear) next = [];
  else if (options.rm) {
    const drop = new Set(parseAllowList(addresses));
    next = current.filter((item) => !drop.has(item));
  } else if (addresses.length) next = [...current, ...parseAllowList(addresses)];

  const { entry: saved } = next === current ? { entry } : await HostOps.setAllow({ host, allow: next });
  const list = saved.allow ?? [];
  print(list.length ? `🔓 ${urlFor(host)} lets shared visitors reach: ${list.join(", ")}` : `🔒 ${urlFor(host)} lets shared visitors reach public hosts only.`);
  if (list.length && !saved.cors) print(`ℹ️  Takes effect once --cors is on: locadot update --host ${host} --target ${saved.target} --cors`);
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
    print(`${urlFor(host).padEnd(width)}  →  ${entry.target}${entry.insecure ? "  (insecure)" : ""}${entry.cors ? "  (cors)" : ""}${entry.allow?.length ? `  (allow ${entry.allow.join(", ")})` : ""}${entry.protect ? `  (password: ${entry.protect.scopes.join(", ")})` : ""}`);
  }
  print(`☑️ Total: ${hosts.length}.`);
}

export async function clearHosts() {
  await RegistryStore.mutate((registry) => (registry.hosts = {}));
  print("☑️ All hosts removed.");
}

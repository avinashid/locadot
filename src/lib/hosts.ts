import Constants from "../constants";
import Localhost, { InputError } from "./localhost";
import RegistryStore from "./registry";

export class NotFoundError extends InputError {}
export class ConflictError extends InputError {}

// Mapping changes shared by the CLI and the dashboard API, so both validate identically.

const requireTarget = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new InputError("❌ Missing destination: a port, host:port or http(s) URL.");
  }
  return Localhost.parseTarget(String(value));
};

export default class HostOps {
  static async add(input: { host: unknown; target: unknown; insecure?: boolean; cors?: boolean }) {
    const host = Localhost.requireHost(input.host);
    const target = requireTarget(input.target);
    const now = new Date().toISOString();
    const entry = await RegistryStore.mutate((registry) => {
      const existing = registry.hosts[host];
      if (existing) {
        throw new ConflictError(
          `❌ ${host} is already mapped to ${existing.target}. Use \`locadot update --host ${host} ...\` instead.`
        );
      }
      registry.hosts[host] = { target, insecure: input.insecure || undefined, cors: input.cors || undefined, createdAt: now, updatedAt: now };
      return registry.hosts[host];
    });
    return { host, entry };
  }

  static async update(input: { host: unknown; target: unknown; insecure?: boolean; cors?: boolean }) {
    const host = Localhost.requireHost(input.host);
    const target = requireTarget(input.target);
    const entry = await RegistryStore.mutate((registry) => {
      const existing = registry.hosts[host];
      if (!existing) throw new NotFoundError(`${Constants.proxyInfo.hostNotFound} (${host})`);
      const insecure = input.insecure ?? existing.insecure;
      const cors = input.cors ?? existing.cors;
      registry.hosts[host] = { ...existing, target, insecure: insecure || undefined, cors: cors || undefined, updatedAt: new Date().toISOString() };
      return registry.hosts[host];
    });
    return { host, entry };
  }

  static async setTunnel(input: { host: unknown; tunnel: boolean }) {
    const host = Localhost.requireHost(input.host);
    const entry = await RegistryStore.mutate((registry) => {
      const existing = registry.hosts[host];
      if (!existing) throw new NotFoundError(`${Constants.proxyInfo.hostNotFound} (${host})`);
      registry.hosts[host] = { ...existing, tunnel: input.tunnel || undefined, updatedAt: new Date().toISOString() };
      return registry.hosts[host];
    });
    return { host, entry };
  }

  static async remove(input: { host: unknown }) {
    const host = Localhost.requireHost(input.host);
    await RegistryStore.mutate((registry) => {
      if (!registry.hosts[host]) throw new NotFoundError(`${Constants.proxyInfo.hostNotFound} (${host})`);
      delete registry.hosts[host];
    });
    return { host };
  }
}

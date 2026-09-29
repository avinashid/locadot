import Constants from "../constants";
import Localhost, { InputError } from "./localhost";
import RegistryStore from "./registry";
import { parseAllowList } from "./allow";
import HubConfigStore from "./hub-config";

export class NotFoundError extends InputError {}
export class ConflictError extends InputError {}

// Mapping changes shared by the CLI and the dashboard API, so both validate identically.

const requireTarget = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new InputError("❌ Missing destination: a port, host:port or http(s) URL.");
  }
  return Localhost.parseTarget(String(value));
};

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** A public hostname on the user's Cloudflare zone, e.g. app.example.com (scheme and trailing slash allowed). */
export const parseTunnelDomain = (value: unknown) => {
  const domain = typeof value === "string" ? value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const labels = domain.split(".");
  const tld = labels[labels.length - 1];
  if (domain.length > 253 || labels.length < 2 || tld === "localhost" || !/[a-z]/.test(tld) || !labels.every((label) => LABEL.test(label))) {
    throw new InputError(`❌ "${value}" isn't a public hostname, e.g. app.example.com.`);
  }
  return domain;
};

export default class HostOps {
  static async add(input: { host: unknown; target: unknown; insecure?: boolean; cors?: boolean; allow?: unknown }) {
    const host = Localhost.requireHost(input.host);
    const target = requireTarget(input.target);
    const allow = input.allow === undefined ? [] : parseAllowList(input.allow);
    const now = new Date().toISOString();
    const entry = await RegistryStore.mutate((registry) => {
      const existing = registry.hosts[host];
      if (existing) {
        throw new ConflictError(
          `❌ ${host} is already mapped to ${existing.target}. Use \`locadot update --host ${host} ...\` instead.`
        );
      }
      registry.hosts[host] = { target, insecure: input.insecure || undefined, cors: input.cors || undefined, allow: allow.length ? allow : undefined, createdAt: now, updatedAt: now };
      return registry.hosts[host];
    });
    return { host, entry };
  }

  static async update(input: { host: unknown; target: unknown; insecure?: boolean; cors?: boolean; allow?: unknown }) {
    const host = Localhost.requireHost(input.host);
    const target = requireTarget(input.target);
    const allow = input.allow === undefined ? undefined : parseAllowList(input.allow);
    const entry = await RegistryStore.mutate((registry) => {
      const existing = registry.hosts[host];
      if (!existing) throw new NotFoundError(`${Constants.proxyInfo.hostNotFound} (${host})`);
      const insecure = input.insecure ?? existing.insecure;
      const cors = input.cors ?? existing.cors;
      const list = allow ?? existing.allow;
      registry.hosts[host] = {
        ...existing,
        target,
        insecure: insecure || undefined,
        cors: cors || undefined,
        allow: list?.length ? list : undefined,
        updatedAt: new Date().toISOString(),
      };
      return registry.hosts[host];
    });
    return { host, entry };
  }

  /** Sharing on: `domain` shares on that hostname, none on a random trycloudflare.com URL. Sharing off keeps the hostname for next time. */
  static async setTunnel(input: { host: unknown; tunnel: boolean; domain?: unknown }) {
    const host = Localhost.requireHost(input.host);
    const domain = input.tunnel && input.domain !== undefined && input.domain !== null && input.domain !== "" ? parseTunnelDomain(input.domain) : undefined;
    if (domain && HubConfigStore.read()?.domain === domain) throw new ConflictError(`❌ ${domain} is this machine's remote-access hostname.`);
    const entry = await RegistryStore.mutate((registry) => {
      const existing = registry.hosts[host];
      if (!existing) throw new NotFoundError(`${Constants.proxyInfo.hostNotFound} (${host})`);
      if (domain && existing.remote) throw new InputError(`❌ ${host} is a remote's mapping; share it on a custom hostname from that machine.`);
      const taken = domain && Object.entries(registry.hosts).find(([other, e]) => other !== host && e.tunnelDomain === domain)?.[0];
      if (taken) throw new ConflictError(`❌ ${domain} is already the shared hostname of ${taken}.`);
      const tunnelDomain = input.tunnel ? domain : existing.tunnelDomain;
      registry.hosts[host] = { ...existing, tunnel: input.tunnel || undefined, tunnelDomain, updatedAt: new Date().toISOString() };
      return registry.hosts[host];
    });
    return { host, entry };
  }

  static async setAllow(input: { host: unknown; allow: unknown }) {
    const host = Localhost.requireHost(input.host);
    const allow = parseAllowList(input.allow);
    const entry = await RegistryStore.mutate((registry) => {
      const existing = registry.hosts[host];
      if (!existing) throw new NotFoundError(`${Constants.proxyInfo.hostNotFound} (${host})`);
      if (existing.remote) throw new InputError(`❌ ${host} is a remote's mapping; set its allowed addresses on that machine.`);
      registry.hosts[host] = { ...existing, allow: allow.length ? allow : undefined, updatedAt: new Date().toISOString() };
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

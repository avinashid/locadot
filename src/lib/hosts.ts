import Constants from "../constants";
import Localhost, { InputError } from "./localhost";
import RegistryStore from "./registry";
import { parseAllowList } from "./allow";
import HubConfigStore from "./hub-config";
import HostAuth, { parseScopes } from "./host-auth";

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

  /**
   * Password protection: `scopes` picks where it's asked for (at least one). `password` is needed the first time;
   * leaving it out keeps the current one. `off` removes the protection and the password.
   */
  static async setProtect(input: { host: unknown; password?: unknown; scopes?: unknown; off?: boolean }) {
    const host = Localhost.requireHost(input.host);
    const existing = RegistryStore.read().hosts[host];
    if (!existing) throw new NotFoundError(`${Constants.proxyInfo.hostNotFound} (${host})`);
    if (existing.remote) throw new InputError(`❌ ${host} is a remote's mapping; protect it on that machine.`);
    if (input.off) {
      const entry = await RegistryStore.mutate((registry) => {
        const current = registry.hosts[host];
        if (!current) throw new NotFoundError(`${Constants.proxyInfo.hostNotFound} (${host})`);
        registry.hosts[host] = { ...current, protect: undefined, updatedAt: new Date().toISOString() };
        return registry.hosts[host];
      });
      HostAuth.clear(host);
      return { host, entry };
    }
    let scopes;
    try {
      scopes = parseScopes(input.scopes);
    } catch (error: any) {
      throw new InputError(`❌ ${error.message}`);
    }
    if (!scopes.length) throw new InputError("❌ Pick at least one place to ask for the password: shared, remote or local.");
    const password = input.password === undefined || input.password === null || input.password === "" ? undefined : input.password;
    if (password === undefined && !HostAuth.has(host)) throw new InputError(`❌ Set a password to protect ${host}.`);
    if (password !== undefined) {
      try {
        HostAuth.set(host, String(password));
      } catch (error: any) {
        throw new InputError(`❌ ${error.message}`);
      }
    }
    const entry = await RegistryStore.mutate((registry) => {
      const current = registry.hosts[host];
      if (!current) throw new NotFoundError(`${Constants.proxyInfo.hostNotFound} (${host})`);
      registry.hosts[host] = { ...current, protect: { scopes }, updatedAt: new Date().toISOString() };
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
    HostAuth.clear(host);
    return { host };
  }
}

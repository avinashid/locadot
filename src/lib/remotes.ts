import fs from "fs";
import os from "os";
import Constants from "../constants";
import FileModule from "../utils/file";
import RegistryStore from "./registry";
import Localhost from "./localhost";
import { NotFoundError, ConflictError } from "./hosts";
import { randomDomain } from "./words";
import type { Remote, RemoteHost } from "../types";

interface RemotesFile {
  remotes: Record<string, Remote>;
}

export class RemoteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const apiBase = (url: string) => `${url}/_locadot/v1`;

const safeJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Talks to a sender's `/_locadot/v1` API. Never logs the body: it may carry the token. */
async function call(url: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error: any) {
    throw new RemoteError(0, `can't reach ${url}: ${error?.message || error}`);
  }
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) throw new RemoteError(res.status, (data && data.error) || res.statusText);
  return data;
}

const readFile = (): RemotesFile => {
  const raw = FileModule.read("REMOTES_FILE");
  if (!raw) return { remotes: {} };
  const data = safeJson(raw);
  if (data && typeof data.remotes === "object") return data;
  return { remotes: {} };
};

const writeFile = (data: RemotesFile) => {
  FileModule.writeAtomic("REMOTES_FILE", JSON.stringify(data, null, 2));
  fs.chmodSync(Constants.paths.REMOTES_FILE, 0o600);
};

const toLabel = (raw: string) => {
  const label = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return label || "remote";
};

const uniqueName = (base: string, existing: Set<string>) => {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
};

/** DNS label used for `<domain>.localhost` / `<port>.<domain>.localhost`. Not "localhost" itself. */
const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

export const isDomainLabel = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const label = value.trim().toLowerCase();
  return label !== "localhost" && DOMAIN_RE.test(label);
};

/** Sender allows the peer onto its localhost, treating an older sender (no `localhost` field) as "yes" when admin. */
const localhostAllowed = (data: { localhost?: unknown }, role: string): boolean =>
  typeof data.localhost === "boolean" ? data.localhost : role === "admin";

/** A shared --cors mapping is --cors here too; the sender still does the CORS work (see router forwardRemote). */
const inherited = (h: Pick<RemoteHost, "cors">) => (h.cors ? { cors: true } : {});

/** Domains already spoken for: other remotes' `domain`, and any single-label `*.localhost` registry host. */
const takenDomains = (excludeName?: string): Set<string> => {
  const store = readFile();
  const taken = new Set<string>(["localhost"]);
  for (const remote of Object.values(store.remotes)) {
    if (remote.domain && remote.name !== excludeName) taken.add(remote.domain);
  }
  const registry = RegistryStore.read();
  for (const host of Object.keys(registry.hosts)) {
    const match = /^([a-z0-9-]+)\.localhost$/.exec(host);
    if (match) taken.add(match[1]);
  }
  return taken;
};

export default class Remotes {
  static parseInvite(value: string): { url: string; code: string } {
    const trimmed = String(value || "").trim();
    const idx = trimmed.lastIndexOf("/#");
    if (idx === -1) throw new RemoteError(400, "Invalid pairing string.");
    const url = trimmed.slice(0, idx).replace(/\/+$/, "");
    const code = trimmed.slice(idx + 2);
    if (!/^lnk_[0-9a-f]{8}\.[A-Za-z0-9_-]+$/.test(code)) throw new RemoteError(400, "Invalid pairing code.");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new RemoteError(400, "Invalid pairing URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new RemoteError(400, "Invalid pairing URL.");
    return { url, code };
  }

  static list(): Remote[] {
    return Object.values(readFile().remotes);
  }

  static get(name: string): Remote | undefined {
    return readFile().remotes[name];
  }

  static mustGet(name: string): Remote {
    const remote = Remotes.get(name);
    if (!remote) throw new RemoteError(404, `No remote named "${name}".`);
    return remote;
  }

  /** Validates a domain label's shape/reserved words. Doesn't check clashes (see `domainAvailable`). */
  static isDomainLabel(value: unknown): value is string {
    return isDomainLabel(value);
  }

  /** Throws if `label` is already another remote's domain or `<label>.localhost` is a registry host. */
  static domainAvailable(label: string, excludeName?: string): void {
    if (takenDomains(excludeName).has(label)) {
      throw new RemoteError(409, `"${label}.localhost" is already in use.`);
    }
  }

  static normalizeDomain(value: string): string {
    const label = String(value ?? "").trim().toLowerCase();
    if (!isDomainLabel(label)) {
      throw new RemoteError(400, 'Domain must be a DNS label: a-z, 0-9 and -, up to 30 characters, and not "localhost".');
    }
    return label;
  }

  static async connect(value: string, opts: { name?: string; domain?: string } = {}) {
    const { url, code } = Remotes.parseInvite(value);
    // Checked before redeeming: the code works once, and the name ends up in hostnames (app.<name>.localhost).
    const wanted = opts.name?.trim().toLowerCase();
    if (wanted && !/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(wanted)) {
      throw new RemoteError(400, "Name must be a DNS label: a-z, 0-9 and -, up to 30 characters.");
    }
    let wantedDomain: string | undefined;
    if (opts.domain !== undefined) {
      wantedDomain = Remotes.normalizeDomain(opts.domain);
      Remotes.domainAvailable(wantedDomain);
    }

    const data = await call(`${apiBase(url)}/connect`, { method: "POST", body: { code, name: os.hostname() } });

    const store = readFile();
    const existingNames = new Set(Object.keys(store.remotes));
    const base = wanted || toLabel(data.sender.hostname);
    const name = uniqueName(base, existingNames);

    const role = data.peer.role;
    const allowLocalhost = localhostAllowed(data, role);
    let domain: string | undefined;
    let note: string | undefined;
    if (role === "admin" && allowLocalhost) {
      domain = wantedDomain || randomDomain(takenDomains());
    } else if (wantedDomain) {
      note = "domain ignored: not admin";
    }

    const remote: Remote = {
      name,
      url,
      token: data.token,
      peerId: data.peer.id,
      role,
      hosts: data.peer.hosts,
      sender: data.sender,
      connectedAt: new Date().toISOString(),
      localhost: allowLocalhost,
      ...(domain ? { domain } : {}),
    };
    store.remotes[name] = remote;
    writeFile(store);

    const hostsRes = await call(`${apiBase(url)}/hosts`, { token: remote.token });
    const hosts: RemoteHost[] = hostsRes.hosts;

    const now = new Date().toISOString();
    const mapped: { local: string; host: string }[] = [];
    const skipped: string[] = [];
    await RegistryStore.mutate((registry) => {
      const taken = new Set(Object.keys(registry.hosts));
      for (const h of hosts) {
        const local = Remotes.localName(name, h.host, taken);
        if (!local) {
          skipped.push(h.host);
          continue;
        }
        taken.add(local);
        registry.hosts[local] = { target: remote.url, remote: { name, host: h.host }, ...inherited(h), createdAt: now, updatedAt: now };
        mapped.push({ local, host: h.host });
      }
    });

    return { remote, hosts, mapped, skipped, domain, note };
  }

  static async sync(name: string) {
    const remote = Remotes.mustGet(name);
    const who = await call(`${apiBase(remote.url)}/whoami`, { token: remote.token });
    const role = who.peer.role;
    const allowLocalhost = localhostAllowed(who, role);
    // Keep an existing domain even if the role has dropped: the router checks role, not this field.
    let domain = remote.domain;
    if (!domain && role === "admin" && allowLocalhost) {
      domain = randomDomain(takenDomains(name));
    }
    const updated: Remote = {
      ...remote,
      role,
      hosts: who.peer.hosts,
      sender: who.sender,
      localhost: allowLocalhost,
      ...(domain ? { domain } : {}),
    };
    const store = readFile();
    store.remotes[name] = updated;
    writeFile(store);

    const hostsRes = await call(`${apiBase(remote.url)}/hosts`, { token: remote.token });
    const hosts: RemoteHost[] = hostsRes.hosts;

    const now = new Date().toISOString();
    const added: string[] = [];
    const removed: string[] = [];
    await RegistryStore.mutate((registry) => {
      const already = new Set<string>();
      const flags = new Map(hosts.map((h) => [h.host, h]));
      for (const [local, entry] of Object.entries(registry.hosts)) {
        if (entry.remote?.name !== name) continue;
        const h = flags.get(entry.remote.host);
        // No longer shared with us (unassigned from a viewer, or deleted on the sender): drop it, aliases too.
        if (!h) {
          delete registry.hosts[local];
          removed.push(local);
          continue;
        }
        already.add(entry.remote.host);
        if (Boolean(h.cors) !== Boolean(entry.cors)) registry.hosts[local] = { ...entry, cors: h.cors || undefined };
      }
      const taken = new Set(Object.keys(registry.hosts));
      for (const h of hosts) {
        if (already.has(h.host)) continue;
        const local = Remotes.localName(name, h.host, taken);
        if (!local) continue;
        taken.add(local);
        registry.hosts[local] = { target: updated.url, remote: { name, host: h.host }, ...inherited(h), createdAt: now, updatedAt: now };
        added.push(local);
      }
    });

    const registry = RegistryStore.read();
    const mapped = Object.entries(registry.hosts)
      .filter(([, e]) => e.remote?.name === name)
      .map(([local, e]) => ({ local, host: e.remote!.host }));

    return { remote: updated, hosts, mapped, added, removed, domain: updated.domain };
  }

  static async alias(name: string, remoteHost: string, localHost: string): Promise<void> {
    const remote = Remotes.mustGet(name);
    const local = Localhost.requireHost(localHost);
    const hostsRes = await call(`${apiBase(remote.url)}/hosts`, { token: remote.token });
    const hosts: RemoteHost[] = hostsRes.hosts;
    const shared = hosts.find((h) => h.host === remoteHost);
    if (!shared) throw new NotFoundError(`"${remoteHost}" is not available on "${name}".`);

    const now = new Date().toISOString();
    await RegistryStore.mutate((registry) => {
      if (registry.hosts[local]) throw new ConflictError(`❌ ${local} is already mapped to ${registry.hosts[local].target}.`);
      registry.hosts[local] = { target: remote.url, remote: { name, host: remoteHost }, ...inherited(shared), createdAt: now, updatedAt: now };
    });
  }

  static setUrl(name: string, url: string): void {
    const store = readFile();
    const remote = store.remotes[name];
    if (!remote) throw new RemoteError(404, `No remote named "${name}".`);
    store.remotes[name] = { ...remote, url: url.replace(/\/+$/, "") };
    writeFile(store);
  }

  /** `null` removes the domain, `"random"` auto-picks one, otherwise a wanted label (validated, must be free). */
  static setDomain(name: string, domain: string | null | "random"): Remote {
    const store = readFile();
    const remote = store.remotes[name];
    if (!remote) throw new RemoteError(404, `No remote named "${name}".`);

    const updated: Remote = { ...remote };
    if (domain === null) {
      delete updated.domain;
    } else if (domain === "random") {
      updated.domain = randomDomain(takenDomains(name));
    } else {
      const label = Remotes.normalizeDomain(domain);
      Remotes.domainAvailable(label, name);
      updated.domain = label;
    }
    store.remotes[name] = updated;
    writeFile(store);
    return updated;
  }

  static async disconnect(name: string): Promise<void> {
    const store = readFile();
    delete store.remotes[name];
    writeFile(store);
    await RegistryStore.mutate((registry) => {
      for (const [host, entry] of Object.entries(registry.hosts)) {
        if (entry.remote?.name === name) delete registry.hosts[host];
      }
    });
  }

  static async addHost(
    name: string,
    input: { host: string; target: string; insecure?: boolean; cors?: boolean }
  ): Promise<RemoteHost> {
    const remote = Remotes.mustGet(name);
    const data = await call(`${apiBase(remote.url)}/hosts`, { method: "POST", token: remote.token, body: input });
    const created: RemoteHost = data.host;

    const now = new Date().toISOString();
    await RegistryStore.mutate((registry) => {
      const taken = new Set(Object.keys(registry.hosts));
      const local = Remotes.localName(name, created.host, taken);
      if (local) registry.hosts[local] = { target: remote.url, remote: { name, host: created.host }, ...inherited(created), createdAt: now, updatedAt: now };
    });

    return created;
  }

  static async updateHost(
    name: string,
    host: string,
    input: { target?: string; insecure?: boolean; cors?: boolean; tunnel?: boolean }
  ): Promise<RemoteHost> {
    const remote = Remotes.mustGet(name);
    const data = await call(`${apiBase(remote.url)}/hosts/${encodeURIComponent(host)}`, {
      method: "PUT",
      token: remote.token,
      body: input,
    });
    const updated: RemoteHost = data.host;
    await RegistryStore.mutate((registry) => {
      for (const [local, entry] of Object.entries(registry.hosts)) {
        if (entry.remote?.name === name && entry.remote.host === host) registry.hosts[local] = { ...entry, cors: updated.cors || undefined };
      }
    });
    return updated;
  }

  static async removeHost(name: string, host: string): Promise<void> {
    const remote = Remotes.mustGet(name);
    await call(`${apiBase(remote.url)}/hosts/${encodeURIComponent(host)}`, { method: "DELETE", token: remote.token });
    await RegistryStore.mutate((registry) => {
      for (const [local, entry] of Object.entries(registry.hosts)) {
        if (entry.remote?.name === name && entry.remote?.host === host) delete registry.hosts[local];
      }
    });
  }

  /** app.localhost → itself if free, else the remote name inserted before "localhost"; undefined if both are taken. */
  static localName(remoteName: string, host: string, taken: Set<string>): string | undefined {
    const direct = Localhost.normalizeHost(host);
    if (!direct) return undefined;
    if (!taken.has(direct)) return direct;
    const labels = direct.split(".");
    labels.splice(labels.length - 1, 0, remoteName);
    const candidate = Localhost.normalizeHost(labels.join("."));
    if (!candidate || taken.has(candidate)) return undefined;
    return candidate;
  }
}

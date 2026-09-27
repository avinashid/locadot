import fs from "fs";
import os from "os";
import Constants from "../constants";
import FileModule from "../utils/file";
import RegistryStore from "./registry";
import Localhost from "./localhost";
import { NotFoundError, ConflictError } from "./hosts";
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

  static async connect(value: string, opts: { name?: string } = {}) {
    const { url, code } = Remotes.parseInvite(value);
    // Checked before redeeming: the code works once, and the name ends up in hostnames (app.<name>.localhost).
    const wanted = opts.name?.trim().toLowerCase();
    if (wanted && !/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(wanted)) {
      throw new RemoteError(400, "Name must be a DNS label: a-z, 0-9 and -, up to 30 characters.");
    }
    const data = await call(`${apiBase(url)}/connect`, { method: "POST", body: { code, name: os.hostname() } });

    const store = readFile();
    const existingNames = new Set(Object.keys(store.remotes));
    const base = wanted || toLabel(data.sender.hostname);
    const name = uniqueName(base, existingNames);

    const remote: Remote = {
      name,
      url,
      token: data.token,
      peerId: data.peer.id,
      role: data.peer.role,
      hosts: data.peer.hosts,
      sender: data.sender,
      connectedAt: new Date().toISOString(),
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
        registry.hosts[local] = { target: remote.url, remote: { name, host: h.host }, createdAt: now, updatedAt: now };
        mapped.push({ local, host: h.host });
      }
    });

    return { remote, hosts, mapped, skipped };
  }

  static async sync(name: string) {
    const remote = Remotes.mustGet(name);
    const who = await call(`${apiBase(remote.url)}/whoami`, { token: remote.token });
    const updated: Remote = { ...remote, role: who.peer.role, hosts: who.peer.hosts, sender: who.sender };
    const store = readFile();
    store.remotes[name] = updated;
    writeFile(store);

    const hostsRes = await call(`${apiBase(remote.url)}/hosts`, { token: remote.token });
    const hosts: RemoteHost[] = hostsRes.hosts;

    const now = new Date().toISOString();
    await RegistryStore.mutate((registry) => {
      const already = new Set<string>();
      for (const entry of Object.values(registry.hosts)) {
        if (entry.remote?.name === name) already.add(entry.remote.host);
      }
      const taken = new Set(Object.keys(registry.hosts));
      for (const h of hosts) {
        if (already.has(h.host)) continue;
        const local = Remotes.localName(name, h.host, taken);
        if (!local) continue;
        taken.add(local);
        registry.hosts[local] = { target: updated.url, remote: { name, host: h.host }, createdAt: now, updatedAt: now };
      }
    });

    const registry = RegistryStore.read();
    const mapped = Object.entries(registry.hosts)
      .filter(([, e]) => e.remote?.name === name)
      .map(([local, e]) => ({ local, host: e.remote!.host }));

    return { remote: updated, hosts, mapped };
  }

  static async alias(name: string, remoteHost: string, localHost: string): Promise<void> {
    const remote = Remotes.mustGet(name);
    const local = Localhost.requireHost(localHost);
    const hostsRes = await call(`${apiBase(remote.url)}/hosts`, { token: remote.token });
    const hosts: RemoteHost[] = hostsRes.hosts;
    if (!hosts.some((h) => h.host === remoteHost)) throw new NotFoundError(`"${remoteHost}" is not available on "${name}".`);

    const now = new Date().toISOString();
    await RegistryStore.mutate((registry) => {
      if (registry.hosts[local]) throw new ConflictError(`❌ ${local} is already mapped to ${registry.hosts[local].target}.`);
      registry.hosts[local] = { target: remote.url, remote: { name, host: remoteHost }, createdAt: now, updatedAt: now };
    });
  }

  static setUrl(name: string, url: string): void {
    const store = readFile();
    const remote = store.remotes[name];
    if (!remote) throw new RemoteError(404, `No remote named "${name}".`);
    store.remotes[name] = { ...remote, url: url.replace(/\/+$/, "") };
    writeFile(store);
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
      if (local) registry.hosts[local] = { target: remote.url, remote: { name, host: created.host }, createdAt: now, updatedAt: now };
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
    return data.host;
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

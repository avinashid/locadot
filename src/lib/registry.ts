import fs from "fs";
import FileModule from "../utils/file";
import Constants from "../constants";
import type { HostEntry, Registry } from "../types";

const LOCK_STALE_MS = 10_000;
const LOCK_WAIT_MS = 5_000;

const empty = (): Registry => ({ version: 2, hosts: {} });

export class RegistryError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default class RegistryStore {
  /** Parses v2 and migrates the legacy `{ domain: port }` format in memory. */
  static parse(raw: string | undefined): Registry {
    if (!raw || !raw.trim()) return empty();
    const data = JSON.parse(raw);
    if (data && data.version === 2 && typeof data.hosts === "object") {
      return data as Registry;
    }
    const now = new Date().toISOString();
    const registry = empty();
    for (const [domain, port] of Object.entries(data || {})) {
      const numeric = Number(port);
      if (Number.isInteger(numeric) && numeric > 0 && numeric < 65536) {
        registry.hosts[domain.toLowerCase()] = {
          target: `http://localhost:${numeric}`,
          createdAt: now,
          updatedAt: now,
        };
      }
    }
    return registry;
  }

  /**
   * Never returns {} for an unparseable file: the next write would wipe every
   * mapping. The bad file is kept aside and the error surfaced.
   */
  static read(): Registry {
    const raw = FileModule.read("REGISTRY_FILE");
    try {
      return RegistryStore.parse(raw);
    } catch {
      const backup = `${Constants.paths.REGISTRY_FILE}.corrupt-${Date.now()}`;
      fs.copyFileSync(Constants.paths.REGISTRY_FILE, backup);
      throw new RegistryError(
        `Registry file is not valid JSON. A copy was saved to ${backup}. Fix or delete ${Constants.paths.REGISTRY_FILE}.`
      );
    }
  }

  /** Read-modify-write under an exclusive lock file so concurrent CLIs don't lose updates. */
  static async mutate<T>(fn: (registry: Registry) => T): Promise<T> {
    await RegistryStore.lock();
    try {
      const registry = RegistryStore.read();
      const result = fn(registry);
      FileModule.writeAtomic("REGISTRY_FILE", JSON.stringify(registry, null, 2));
      return result;
    } finally {
      FileModule.remove("REGISTRY_LOCK");
    }
  }

  static get(host: string): HostEntry | undefined {
    return RegistryStore.read().hosts[host.toLowerCase()];
  }

  private static async lock() {
    FileModule.ensureDir();
    const deadline = Date.now() + LOCK_WAIT_MS;
    while (true) {
      try {
        fs.writeFileSync(Constants.paths.REGISTRY_LOCK, String(process.pid), { flag: "wx" });
        return;
      } catch (error: any) {
        if (error?.code !== "EEXIST") throw error;
        try {
          const age = Date.now() - fs.statSync(Constants.paths.REGISTRY_LOCK).mtimeMs;
          if (age > LOCK_STALE_MS) FileModule.remove("REGISTRY_LOCK");
        } catch {}
        if (Date.now() > deadline) {
          throw new RegistryError(
            `Registry is locked by another locadot process (${Constants.paths.REGISTRY_LOCK}).`
          );
        }
        await sleep(25 + Math.random() * 50);
      }
    }
  }
}

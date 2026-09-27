import fs from "fs";
import path from "path";
import Constants from "../constants";
import FileModule from "../utils/file";
import type { HubConfig } from "../types";

let cache: { mtimeMs: number; value: HubConfig | undefined } | undefined;

/** Persists how the sender is reachable (`HUB_FILE`). No secrets in here; see links.ts for those. */
export default class HubConfigStore {
  static read(): HubConfig | undefined {
    const raw = FileModule.read("HUB_FILE");
    if (!raw) return undefined;
    try {
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? (data as HubConfig) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Same as read(), but skips the parse when the file's mtime hasn't changed. Safe for the request hot path (classify()). */
  static readCached(): HubConfig | undefined {
    let mtimeMs: number;
    try {
      mtimeMs = fs.statSync(path.resolve(Constants.paths.HUB_FILE)).mtimeMs;
    } catch {
      cache = undefined;
      return undefined;
    }
    if (!cache || cache.mtimeMs !== mtimeMs) cache = { mtimeMs, value: HubConfigStore.read() };
    return cache.value;
  }

  static write(config: HubConfig): void {
    FileModule.writeAtomic("HUB_FILE", JSON.stringify(config, null, 2));
  }

  static clear(): void {
    FileModule.remove("HUB_FILE");
  }
}

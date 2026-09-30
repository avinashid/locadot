import fs from "fs";
import Constants from "../constants";
import FileModule from "../utils/file";

/** CONFIG_FILE: ports from `locadot start --port/--https-port` and the global https redirect. */
export interface LocadotConfig {
  httpPort?: number;
  httpsPort?: number;
  /** Send plain-http browser requests on this machine to https; a mapping's own `httpsRedirect` overrides it. */
  httpsRedirect?: boolean;
}

let cached: { mtimeMs: number; config: LocadotConfig } | undefined;

export default class ConfigStore {
  /** The file as-is, tolerating a missing or corrupt one. */
  static read(): LocadotConfig & Record<string, unknown> {
    try {
      const raw = JSON.parse(fs.readFileSync(Constants.paths.CONFIG_FILE, "utf8"));
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  }

  /** Merges into the file, so saving the ports keeps the other settings and the other way round. */
  static write(patch: LocadotConfig) {
    FileModule.ensureDir();
    const next: Record<string, unknown> = { ...ConfigStore.read(), ...patch };
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    fs.writeFileSync(Constants.paths.CONFIG_FILE, JSON.stringify(next, null, 2) + "\n");
    cached = undefined;
  }

  /** For the request path: re-reads only when the file changed. */
  static readCached(): LocadotConfig {
    let mtimeMs = -1;
    try {
      mtimeMs = fs.statSync(Constants.paths.CONFIG_FILE).mtimeMs;
    } catch {}
    if (cached?.mtimeMs !== mtimeMs) cached = { mtimeMs, config: mtimeMs < 0 ? {} : ConfigStore.read() };
    return cached.config;
  }

  static httpsRedirect(): boolean {
    return ConfigStore.readCached().httpsRedirect === true;
  }
}

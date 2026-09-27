import FileModule from "../utils/file";
import type { HubConfig } from "../types";

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

  static write(config: HubConfig): void {
    FileModule.writeAtomic("HUB_FILE", JSON.stringify(config, null, 2));
  }

  static clear(): void {
    FileModule.remove("HUB_FILE");
  }
}

import http from "http";
import type { HubDecision } from "./hub";
import { fromRemote, fromTunnel } from "./request";

/** One connected machine's result: what the sync mapped or unmapped here, or why it failed. */
export interface SyncReport {
  name: string;
  ok: boolean;
  added: string[];
  removed: string[];
  error?: string;
}

export interface AutoSyncOptions {
  /** Names of the connected machines (receiver side). */
  remotes(): string[];
  sync(name: string): Promise<{ added: string[]; removed: string[] }>;
  /** Called after a run that changed anything, so lookups see the new mappings straight away. */
  changed(): void;
  /** A run newer than this is reused instead of syncing again. */
  freshMs?: number;
  /** A forced run (the "Sync again" button) still reuses one newer than this. */
  forcedFreshMs?: number;
  timeoutMs?: number;
}

/** The "Sync again" button on the not-mapped page: same URL plus this query parameter. */
export const SYNC_PARAM = "locadot-sync";

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${Math.round(ms / 1000)}s`)), ms);
    promise.then(
      (value) => (clearTimeout(timer), resolve(value)),
      (error) => (clearTimeout(timer), reject(error))
    );
  });

const message = (error: any) => String(error?.message || error).replace(/^❌\s*/u, "");

/**
 * Syncs every connected machine when a browser asks for a name that isn't mapped: the sender may have
 * added or assigned it since the last sync. Concurrent requests share one run, and a recent run is reused.
 * Resolves undefined when there's nothing to sync with.
 */
export function createAutoSync(opts: AutoSyncOptions) {
  const freshMs = opts.freshMs ?? 10_000;
  const forcedFreshMs = opts.forcedFreshMs ?? 2_000;
  const timeoutMs = opts.timeoutMs ?? 5_000;
  let running: Promise<SyncReport[]> | undefined;
  let last: { at: number; reports: SyncReport[] } | undefined;

  const run = async (names: string[]) => {
    const reports = await Promise.all(
      names.map((name) =>
        withTimeout(opts.sync(name), timeoutMs).then(
          (r): SyncReport => ({ name, ok: true, added: r.added, removed: r.removed }),
          (error): SyncReport => ({ name, ok: false, added: [], removed: [], error: message(error) })
        )
      )
    );
    if (reports.some((r) => r.added.length || r.removed.length)) opts.changed();
    return reports;
  };

  return (force = false): Promise<SyncReport[] | undefined> => {
    const names = opts.remotes();
    if (!names.length) return Promise.resolve(undefined);
    if (running) return running;
    if (last && Date.now() - last.at < (force ? forcedFreshMs : freshMs)) return Promise.resolve(last.reports);
    running = run(names).then((reports) => {
      last = { at: Date.now(), reports };
      return reports;
    });
    running.finally(() => (running = undefined)).catch(() => {});
    return running;
  };
}

/** Only this machine's own browser triggers a sync; tunnels, the hub and peers just get the page. */
export const mayAutoSync = (req: http.IncomingMessage, hub: HubDecision | undefined) =>
  !(hub && hub.kind !== "none") && !fromTunnel(req) && !fromRemote(req) && !req.headers["cf-ray"];

export const wantsForcedSync = (req: http.IncomingMessage) => new URLSearchParams((req.url || "").split("?")[1] || "").has(SYNC_PARAM);

/** The URL the browser asked for, minus the sync parameter: where to send it once the name is mapped. */
export const withoutSyncParam = (url: string) => {
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.delete(SYNC_PARAM);
  const rest = params.toString();
  return (path.startsWith("/") ? path : "/") + (rest ? `?${rest}` : "");
};

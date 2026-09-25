export interface HostEntry {
  /** Absolute upstream URL, e.g. http://localhost:3000 or https://google.com */
  target: string;
  /** Skip TLS verification of an https target (self-signed upstreams). */
  insecure?: boolean;
  /** Make the upstream think requests come from itself, and let any origin call it. */
  cors?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Registry {
  version: 2;
  hosts: Record<string, HostEntry>;
}

export interface HostStats {
  hits: number;
  errors: number;
  lastStatus?: number;
  lastAccess?: string;
  /** Rolling average upstream response time in ms. */
  avgMs?: number;
}

export interface ProbeResult {
  up: boolean;
  status?: number;
  ms?: number;
  error?: string;
}

export interface ProxyInfo {
  pid: number;
  version: string;
  startedAt: string;
  httpPort: number;
  httpsPort: number;
  bind: string[];
  stateDir: string;
  caTrusted?: boolean;
}

export interface SystemStatus {
  platform: string;
  isRoot: boolean;
  canBindPrivileged: boolean;
  unprivilegedPortStart: number | null;
  caTrusted: boolean | null;
  startup: { enabled: boolean; method: string | null };
  stateDir: string;
}

export interface DashboardContext {
  getRegistry(): Registry;
  getStats(): Record<string, HostStats>;
  proxyInfo: ProxyInfo;
  probe(target: string): Promise<ProbeResult>;
  /** Required in the X-Locadot-Token header of every mutating request. */
  token: string;
  /** Re-read the registry now instead of waiting for the file watcher. */
  reload(): void;
  refreshTrust(): Promise<unknown>;
  shutdown(reason: string): void;
}

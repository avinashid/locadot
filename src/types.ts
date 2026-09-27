export interface HostEntry {
  /** Absolute upstream URL, e.g. http://localhost:3000 or https://google.com */
  target: string;
  /** Skip TLS verification of an https target (self-signed upstreams). */
  insecure?: boolean;
  /** Make the upstream think requests come from itself, and let any origin call it. */
  cors?: boolean;
  /** Share on a public Cloudflare quick tunnel (https://<random>.trycloudflare.com). */
  tunnel?: boolean;
  /** Receiver side: this name forwards to a mapping on a connected sender (see lib/remotes.ts). */
  remote?: { name: string; host: string };
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

export interface TunnelState {
  enabled: boolean;
  status: "off" | "starting" | "up" | "error";
  url?: string;
  error?: string;
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
  tunnel(host: string): TunnelState;
  /** Re-sync tunnels with the registry, restarting failed ones (after enabling or installing). */
  retryTunnels(): void;
  /** Remote access, sender side: the public hostname's state. */
  hub(): HubState;
  /** Re-read HUB_FILE and start/stop/restart the hub tunnel to match. */
  reloadHub(): void;
  /** Runs the named-tunnel setup in the background; progress (incl. loginUrl) shows in hub(). */
  setupNamedHub(domain: string, tunnel?: string): void;
}

/* ---------- remote access: sender (shares its locadot) / receiver (connects to one) ---------- */

export type Role = "viewer" | "editor" | "admin";

/** read: list + browse; write: add/edit mappings; delete: remove mappings; settings: cors, sharing. */
export type Permission = "read" | "write" | "delete" | "settings";

/**
 * How the sender is reachable. `named`: the user's own Cloudflare tunnel on their domain (stable).
 * `quick`: trycloudflare.com, URL changes whenever cloudflared restarts. `manual`: something else
 * (ngrok, a reverse proxy, tests) already forwards `url` to this proxy's HTTP port.
 */
export interface HubConfig {
  mode: "named" | "quick" | "manual";
  /** named: the public hostname, e.g. hub.example.com */
  domain?: string;
  /** named: cloudflared tunnel name or UUID */
  tunnel?: string;
  /** manual: public base URL, e.g. https://hub.example.com or http://hub.localhost:8081 */
  url?: string;
}

export interface HubState {
  enabled: boolean;
  mode?: HubConfig["mode"];
  status: "off" | "starting" | "up" | "error" | "login";
  /** Public base URL without trailing slash, when up. */
  url?: string;
  error?: string;
  /** named mode, first run: the Cloudflare login URL the user must open. */
  loginUrl?: string;
}

/** A one-time pairing code, valid for 5 minutes. */
export interface Invite {
  id: string;
  codeHash: string;
  role: Role;
  /** Viewer only: the mappings they may see. Editors and admins see everything. */
  hosts?: string[];
  createdAt: string;
  expiresAt: string;
}

/** A receiver that redeemed an invite. The sender can change its role or revoke it. */
export interface Peer {
  id: string;
  name: string;
  role: Role;
  hosts?: string[];
  tokenHash: string;
  createdAt: string;
  lastSeen?: string;
}

/** Receiver side: one sender we're connected to. */
export interface Remote {
  name: string;
  /** Sender's public base URL. */
  url: string;
  token: string;
  peerId: string;
  role: Role;
  hosts?: string[];
  sender: { hostname: string; version: string };
  connectedAt: string;
}

/** A mapping as the sender shows it to a receiver. */
export interface RemoteHost {
  host: string;
  target: string;
  cors: boolean;
  insecure: boolean;
}

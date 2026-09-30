/** shared: the mapping's public tunnel URL; remote: machines connected through remote access; local: everyone else. */
export type ProtectScope = "shared" | "remote" | "local";

export interface HostEntry {
  /** Absolute upstream URL, e.g. http://localhost:3000 or https://google.com */
  target: string;
  /** Skip TLS verification of an https target (self-signed upstreams). */
  insecure?: boolean;
  /** Make the upstream think requests come from itself, and let any origin call it. */
  cors?: boolean;
  /** Internal addresses (localhost:3000) a tunnel visitor or hub peer may reach through the --cors pass-through. */
  allow?: string[];
  /** Share on a public Cloudflare quick tunnel (https://<random>.trycloudflare.com), or on `tunnelDomain` when set. */
  tunnel?: boolean;
  /** Share on this hostname through a named Cloudflare tunnel in the user's account; kept after unsharing. */
  tunnelDomain?: string;
  /** Ask for a password on these paths in; the password itself is in HOST_PASSWORDS_FILE (see lib/host-auth.ts). */
  protect?: { scopes: ProtectScope[] };
  /** Send plain-http requests to https (true) or never (false); absent follows the global `httpsRedirect` setting. */
  httpsRedirect?: boolean;
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
  status: "off" | "starting" | "login" | "up" | "error";
  mode?: "quick" | "custom";
  domain?: string;
  url?: string;
  error?: string;
  /** status "login": cloudflared's browser login URL. */
  loginUrl?: string;
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

/** read: list + browse; write: add/edit mappings; delete: remove mappings; settings: cors, sharing; localhost: any port on the sender (admin). */
export type Permission = "read" | "write" | "delete" | "settings" | "localhost";

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
  /** Admin peers may reach any port on this machine's localhost. Default true; false turns it off. */
  localhost?: boolean;
  /** Browsers get this dashboard at the public URL, behind the dashboard password. Default off. */
  panel?: boolean;
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
  /** Admin only: `<domain>.localhost` and `<port>.<domain>.localhost` reach the sender's own localhost. */
  domain?: string;
  /** Whether the sender currently allows this peer to reach its localhost (from whoami). */
  localhost?: boolean;
}

/** A mapping as the sender shows it to a receiver. */
export interface RemoteHost {
  host: string;
  target: string;
  cors: boolean;
  insecure: boolean;
}

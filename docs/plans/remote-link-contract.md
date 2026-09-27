# Remote access: implementation contract

This is the binding interface for the remote-access build. The rationale is in `remote-link.md`.
Shared types are already in `src/types.ts`: `Role`, `Permission`, `HubConfig`, `HubState`, `Invite`,
`Peer`, `Remote`, `RemoteHost`, `HostEntry.remote`, and the `DashboardContext.hub/reloadHub/
setupNamedHub` hooks. State file paths are in `Constants.paths`: `HUB_FILE`, `LINKS_FILE`,
`REMOTES_FILE`.

**Sender** = the machine that shares its locadot. **Receiver** = the machine that connects to it.

## Decisions (from the owner)

- **Sender reachability.** Use the owner's own Cloudflare named tunnel on a custom domain. The
  fallback is a trycloudflare quick tunnel, with a clear warning that the URL changes whenever
  cloudflared restarts, so receivers have to update it. `manual` mode means something else already
  forwards a URL to the proxy's HTTP port (ngrok, a reverse proxy, tests).
- **Pairing.** The sender creates a pairing code with a role. The code is valid for **5 minutes**
  and can be used **once**. Redeeming it gives the receiver a long-lived session token. The sender
  can change a peer's role or revoke it at any time.
- **Roles.** viewer = read (list and browse), limited to the hosts picked on the invite. editor =
  read + write (add and edit **any** mapping, any target; everything is proxied from the sender's
  machine) and sees all hosts. admin = editor + delete + settings (the `tunnel` flag) and sees all
  hosts.

## Permission helper (`src/lib/links.ts`)

| Permission | viewer | editor | admin |
|------------|:------:|:------:|:-----:|
| read       | ✓      | ✓      | ✓     |
| write      |        | ✓      | ✓     |
| delete     |        |        | ✓     |
| settings   |        |        | ✓     |

`visibleHosts(peer, all)`: viewer → `all ∩ peer.hosts`; editor and admin → `all`.

## Wire format

- Pairing string: `<senderBaseUrl>/#lnk_<id>.<secret>`. `id` is 8 hex characters, `secret` is 32
  random bytes in base64url.
- Session token: `lpt_<peerId>.<secret>` (32 random bytes, base64url). Only the SHA-256 hex of each
  secret is stored, and comparisons are constant-time.
- Every sender request arrives with a Host header equal to the hub's public hostname (without port).
  Requests for any other Host are not hub traffic.

### Sender HTTP API (under the public hostname, path prefix `/_locadot/v1`)

All bodies are JSON. Errors are `{ "error": string }` with the right status (400, 401, 403, 404,
409, 413, 429).

| Method | Path | Auth | Perm | Body → Response |
|---|---|---|---|---|
| POST | /connect | none (code in body) | – | `{code, name}` → `{token, peer:{id,name,role,hosts?}, sender:{hostname,version}}` |
| GET | /whoami | Bearer | read | → `{peer:{id,name,role,hosts?}, sender}` |
| GET | /hosts | Bearer | read | → `{hosts: RemoteHost[]}` (visible only; entries with `remote` are excluded) |
| POST | /hosts | Bearer | write | `{host,target,insecure?,cors?}` → 201 `{host: RemoteHost}` |
| PUT | /hosts/:host | Bearer | write (+settings if `tunnel` is present) | `{target?,insecure?,cors?,tunnel?}` → `{host: RemoteHost}` |
| DELETE | /hosts/:host | Bearer | delete | → `{ok:true}` |

- Auth failures are rate-limited per client IP. The IP comes from `cf-connecting-ip`, falling back
  to the socket address. After 20 failures in 10 minutes the IP gets 429.

### App traffic (anything not under `/_locadot/`)

The receiver sends `X-Locadot-Peer: lpt_…` and `X-Locadot-Host: <mapping on sender>`. It uses its own header, not `Authorization`, because the sender's apps may need `Authorization` from the visitor.
- If the peer is valid and the mapping exists, is visible to the peer, and has no `remote` field
  itself, the request is routed like a local request for that mapping. Before routing, every
  `x-locadot-*` header is deleted. `Authorization` passes through untouched.
- Otherwise the response is 401, 403 or 404 with a plain-text body. Hub traffic **never** reaches
  the dashboard.

## Module signatures

### `src/lib/links.ts`: sender credential store (sync file I/O, `LINKS_FILE`, mode 0600)
```ts
export const INVITE_TTL_MS = 5 * 60_000;
export class LinkError extends Error { constructor(public status: number, message: string) }
export default class Links {
  static createInvite(input: { role: Role; hosts?: string[] }): { invite: Invite; code: string }; // code = "lnk_<id>.<secret>"
  static inviteString(baseUrl: string, code: string): string;         // `${baseUrl}/#${code}`
  static redeem(code: string, name: string): { peer: Peer; token: string }; // one-time; LinkError(401) if unknown/expired/used
  static authenticate(token: string | undefined): Peer | undefined;   // updates lastSeen at most once a minute
  static list(): { invites: Invite[]; peers: Peer[] };                // prunes expired invites
  static setRole(peerId: string, role: Role, hosts?: string[]): Peer; // LinkError(404)
  static revoke(peerId: string): void;
  static revokeInvite(id: string): void;
  static can(peer: Pick<Peer, "role">, permission: Permission): boolean;
  static visibleHosts(peer: Pick<Peer, "role" | "hosts">, all: string[]): string[];
}
```

### `src/lib/hub-config.ts`
```ts
export default class HubConfigStore { static read(): HubConfig | undefined; static write(c: HubConfig): void; static clear(): void }
```

### `src/proxy/hub-tunnel.ts`: runs inside the proxy
```ts
export class HubTunnel {
  constructor(origin: () => string);           // origin = http://127.0.0.1:<live http port>
  sync(config: HubConfig | undefined): void;   // start/stop/restart to match
  state(): HubState;
  publicHost(): string | undefined;            // hostname of state().url when up (manual: hostname of config.url)
  setupNamed(domain: string, tunnel?: string): Promise<void>; // sets status "login"+loginUrl while waiting, writes HUB_FILE, then sync()
  stop(): void;
}
/** Used by the CLI (outside the proxy). Logs in if ~/.cloudflared/cert.pem is missing, creates the tunnel (reusing an existing one), routes DNS with --overwrite-dns. */
export async function setupNamedTunnel(domain: string, tunnel = "locadot", onLoginUrl?: (url: string) => void): Promise<HubConfig>;
```
- Named mode runs `cloudflared tunnel --no-autoupdate run --url <origin> <tunnel>`. The status is
  "up" once a line matching /Registered tunnel connection/i appears, with url `https://<domain>`.
- Quick mode runs `cloudflared tunnel --no-autoupdate --config <empty file> --url <origin>` and
  parses the trycloudflare URL, as `src/proxy/tunnel.ts` does.
- Manual mode spawns nothing. The status is "up" and url is the configured url without a trailing
  slash.
- Use `cloudflaredPath()` from `src/proxy/tunnel.ts`. Honour `LOCADOT_CLOUDFLARED` so tests can pass
  a fake binary.

### `src/proxy/hub.ts`
```ts
export type HubDecision =
  | { kind: "none" }
  | { kind: "api" }
  | { kind: "app"; host: string; peer: Peer }
  | { kind: "deny"; status: number; message: string };
export function classify(req: http.IncomingMessage, publicHost: string | undefined, hosts: Record<string, HostEntry>): HubDecision;
export interface HubApiContext { getRegistry(): Registry; reload(): void; retryTunnels(): void }
export function handleHubApi(req: http.IncomingMessage, res: http.ServerResponse, ctx: HubApiContext): Promise<void>;
```

### `src/lib/remotes.ts`: receiver store (`REMOTES_FILE`, mode 0600) and client, using global `fetch`
```ts
export class RemoteError extends Error { constructor(public status: number, message: string) }
export default class Remotes {
  static parseInvite(value: string): { url: string; code: string };
  static connect(value: string, opts?: { name?: string }): Promise<{ remote: Remote; hosts: RemoteHost[]; mapped: { local: string; host: string }[]; skipped: string[] }>;
  static list(): Remote[];
  static get(name: string): Remote | undefined;
  static sync(name: string): Promise<{ remote: Remote; hosts: RemoteHost[]; mapped: { local: string; host: string }[] }>; // refresh role/hosts via whoami + hosts, import newly visible hosts
  static alias(name: string, remoteHost: string, localHost: string): Promise<void>;       // ConflictError if the local name is taken
  static setUrl(name: string, url: string): void;
  static disconnect(name: string): Promise<void>;                                        // removes the remote and its registry entries
  static addHost(name: string, input: { host: string; target: string; insecure?: boolean; cors?: boolean }): Promise<RemoteHost>; // + local alias
  static updateHost(name: string, host: string, input: { target?: string; insecure?: boolean; cors?: boolean; tunnel?: boolean }): Promise<RemoteHost>;
  static removeHost(name: string, host: string): Promise<void>;                          // + removes local aliases for it
  static localName(remoteName: string, host: string, taken: Set<string>): string | undefined; // app.localhost → app.localhost if free, else app.<remoteName>.localhost
}
```
- The remote name defaults to the sender's hostname, reduced to a DNS label and made unique.
- Imported registry entries are `{ target: remote.url, remote: { name, host }, createdAt, updatedAt }`.
  Write them with `RegistryStore.mutate`.

### `src/proxy/remote.ts`: receiver forwarding
```ts
export const remoteFor: (name: string) => Remote | undefined;  // REMOTES_FILE, cached by mtime
export const remoteOptions: (req: http.IncomingMessage, entry: HostEntry, remote: Remote) => httpProxy.ServerOptions;
// target remote.url, changeOrigin, ws, secure: true, autoRewrite, hostRewrite = req.headers.host,
// protocolRewrite by isTls(req), cookieDomainRewrite {"*": ""},
// headers { "X-Locadot-Peer": remote.token, "X-Locadot-Host": entry.remote!.host }
```

## Local dashboard API (`src/dashboard/api.ts`, on localhost)

Mutations go through `assertTrusted`. GETs are unauthenticated like the existing `/api/hosts`.
Tokens and hashes are never returned.

| Method | Path | Body → Response |
|---|---|---|
| GET | /api/hub | → `{hub: HubState, config: HubConfig\|null, invites: {id,role,hosts?,expiresAt}[], peers: {id,name,role,hosts?,createdAt,lastSeen?}[]}` |
| POST | /api/hub | `{mode:"named",domain,tunnel?}` → starts setupNamedHub; `{mode:"quick"}`; `{mode:"manual",url}`; `{mode:"off"}` → `{hub}` |
| POST | /api/invites | `{role, hosts?}` → `{id, code, string, role, hosts?, expiresAt}` (409 if the hub isn't up) |
| DELETE | /api/invites/:id | → `{ok}` |
| PUT | /api/peers/:id | `{role, hosts?}` → `{peer}` |
| DELETE | /api/peers/:id | → `{ok}` |
| GET | /api/remotes | → `{remotes: {name,url,role,hosts?,sender,connectedAt, status:"ok"\|"error", error?, available: RemoteHost[]\|null, mapped: {local,host}[]}[]}` (live fetch, 5 s timeout) |
| POST | /api/remotes | `{string, name?}` → connect result (without the token) |
| PUT | /api/remotes/:name | `{url}` → `{ok}` |
| DELETE | /api/remotes/:name | → `{ok}` |
| POST | /api/remotes/:name/sync | → sync result |
| POST | /api/remotes/:name/aliases | `{host, local}` → `{ok}` |
| POST | /api/remotes/:name/hosts | `{host,target,insecure?,cors?}` → `{host}` |
| PUT | /api/remotes/:name/hosts/:host | `{target?,insecure?,cors?,tunnel?}` → `{host}` |
| DELETE | /api/remotes/:name/hosts/:host | → `{ok}` |

`/api/hosts` rows gain `remote?: { name, host, role }` for entries that forward to a sender.

## CLI (`src/cli/commands/remote.ts`, registered in `src/index.ts`)

Sender commands:
- `hub`: status
- `hub:setup --domain <d> [--tunnel <name>]`
- `hub:quick`: prints the warning
- `hub:manual --url <u>`
- `hub:off`
- `share --role <viewer|editor|admin> [--hosts a.localhost,b.localhost]`: prints the pairing
  string and "valid for 5 minutes, one use"
- `peers`
- `peers:role <id> <role> [--hosts …]`
- `peers:revoke <id>`

Receiver commands:
- `connect <string> [--name <n>]`
- `remotes`
- `remote:sync <name>`
- `remote:alias <name> <remoteHost> <localHost>`
- `remote:url <name> <url>`
- `remote:add <name> --host <h> --target <t> [--cors] [--insecure]`
- `remote:update <name> --host <h> [--target <t>] [--cors|--no-cors]`
- `remote:rm <name> <host>`
- `disconnect <name>`

## Ownership (who edits what)

- **Sender core:** `src/lib/links.ts`, `src/lib/hub-config.ts`, `src/proxy/hub-tunnel.ts`,
  `src/proxy/hub.ts`, `test/links.test.ts`, `test/hub.test.ts`
- **Receiver core:** `src/lib/remotes.ts`, `src/proxy/remote.ts`, `test/remotes.test.ts`
- **CLI:** `src/cli/commands/remote.ts`, `src/cli/commands/index.ts`, `src/index.ts`
- **Dashboard:** `src/dashboard/api.ts`, `src/dashboard/index.ts`, `src/dashboard/page.ts`,
  `test/dashboard*.test.ts` edits
- **Lead (integration):** `src/types.ts`, `src/constants/index.ts`, `src/proxy/router.ts`,
  `src/proxy/request.ts`, `src/server/index.ts`, the end-to-end test

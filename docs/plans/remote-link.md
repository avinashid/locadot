# Plan: locadot-to-locadot links over a Cloudflare domain

Status: **proposal**, nothing implemented yet.

## Goal

Machine **A (hub)** puts its locadot behind a Cloudflare hostname, e.g. `hub.example.com`, and
creates a temporary credential with a role. It hands out one connection string. Machine **B (peer)**
pastes that string into its own locadot. B then sees A's mappings in its dashboard and can browse
them from B's own browser as normal `*.localhost` names. If a name clashes with one B already has,
B maps it under another local name (for example `he.localhost`). Depending on the role, B can also
add, edit or delete mappings on A.

```
B's browser ──► B's locadot (app.localhost) ──https──► hub.example.com (Cloudflare)
                                                         │ named tunnel
                                                         ▼
                                            A's locadot :<A's http port> ──► A's localhost:3000
```

Traffic from B to A's apps always goes through B's own proxy. B's browser never talks to Cloudflare
directly, so B keeps its own names, certificates and dashboard.

## Feasibility

**Feasible.** Most of the plumbing exists:

- `src/proxy/tunnel.ts` already runs cloudflared. It only needs a second mode, a named tunnel with
  ingress to `http://127.0.0.1:<httpPort>`.
- `src/proxy/router.ts` already maps a tunnel's public host back to a local mapping (`resolveHost`
  and `tag`).
- `src/proxy/rewrite.ts` already rewrites redirects and cookies between a public name and a local
  name. That covers renamed mappings such as `he.localhost`.
- `src/dashboard/api.ts` already has token-checked CRUD over hosts. The remote API can call the
  same `HostOps`.

What is new: a credential store, a remote API behind the tunnel, a "remote" kind of mapping on the
peer, and dashboard panels on both sides.

**Estimated effort: about 7–9 working days**, in the phases below.

## Design

### 1. Hub: public hostname (named tunnel)

- `locadot hub:setup --domain hub.example.com` runs `cloudflared tunnel login`, `tunnel create
  locadot-hub` and `tunnel route dns`. It writes locadot's own config with
  `ingress: hub.example.com → http://127.0.0.1:<httpPort>`, then a catch-all 404.
- **Port handling.** The ingress target is regenerated from the proxy's real port every time the
  proxy starts, including after `locadot start --port 8081` or a restart on a new port. The tunnel is
  supervised inside the proxy, like the quick tunnels are today, so it always follows the live port.
  The peer never needs to know A's port.
- A quick-tunnel fallback is optional. It works without a domain, but the URL changes on every
  restart, so every connection string breaks.

### 2. Hub: credentials ("links")

- `locadot link:create --role viewer|editor|admin [--ttl 24h] [--hosts app,api] [--name bob]`
- Each link stores an id, role, host allow-list, expiry, created and last-used times, and a
  **SHA-256 hash** of a random 256-bit secret. The file is `~/.locadot/links.json`, mode 0600. The
  secret itself is shown once and never stored.
- Connection string: `https://hub.example.com/#lnk_<id>.<secret>`. The secret sits in the URL
  fragment, so it is never sent to a server or written to logs if someone opens it in a browser.
- `link:list`, `link:revoke <id>`. Expired links are refused and pruned.

Roles (to confirm, see question 2):

| Capability                                 | viewer | editor | admin |
|--------------------------------------------|:------:|:------:|:-----:|
| List hub's mappings, stats, status          | ✓      | ✓      | ✓     |
| Browse mapped apps through the link (read)  | ✓      | ✓      | ✓     |
| Add and edit mappings on the hub (write)    |        | ✓      | ✓     |
| Delete mappings on the hub (delete)         |        |        | ✓     |
| Toggle cors, sharing and other settings     |        |        | ✓     |

The hub's own dashboard stays local-only. Nobody gets trust, startup, stop, or link management
over the tunnel.

### 3. Hub: requests arriving through the named tunnel

These are recognised by Host `hub.example.com`, so they are never confused with local traffic.

- `/_locadot/v1/*` is the remote JSON API: `GET hosts`, `POST hosts`, `PATCH hosts/:h`,
  `DELETE hosts/:h`, `GET whoami`. It requires `Authorization: Bearer lnk_<id>.<secret>`, is gated by
  role and host allow-list, and is rate-limited per IP on auth failures.
- Anything else is app traffic. It needs the same bearer token plus `X-Locadot-Host: app.localhost`.
  The hub checks the token and allow-list, tags the request as remote (like a tunnel request), and
  routes it through the normal router. WebSockets use the same headers, so HMR works.
- Anything without a valid token gets a bare 401. The hub never falls through to the dashboard or
  to arbitrary hosts.

### 4. Peer: connecting

- `locadot link:add "<connection string>" [--name alice]`, or paste it in the dashboard. The peer
  calls `whoami`, saves the remote in `~/.locadot/remotes.json` (0600), and imports the host list.
- Remote mappings sit next to local ones in the registry, e.g.
  `{ target: "remote://alice/app.localhost", remote: "alice" }`. The proxy forwards to
  `https://hub.example.com`, rewriting Host and adding the two headers. WebSockets go over wss.
- **Conflicts.** If `app.localhost` already exists on B, the import proposes `app.alice.localhost`
  by default. The user can rename it to anything, such as `he.localhost`. Existing rewrite logic
  fixes redirects and cookies between the local name and the hub name.
- Even without a conflict, the user can add extra local aliases to any remote mapping
  (`he.localhost` → alice's `app.localhost`).
- The list is refreshed every 30 s and on dashboard open. Mappings deleted on the hub show as
  "gone". A revoked or expired link shows as "disconnected".
- Targets are always resolved **on the hub**: `localhost:3000` means A's port 3000, not B's. The UI
  labels this clearly.

### 5. Dashboard

- Hub: a "Links" card that creates links (role, TTL, hosts), copies the string, lists and revokes
  links, and shows last used and by whom. It also shows hub tunnel status.
- Peer: a "Remotes" card to paste a string, list remotes, disconnect, and rename or alias. Remote
  rows appear in the hosts table with an `alice` badge. Edit and delete buttons show only if the role
  allows them.

## Security notes

1. **Editor role means SSRF into A.** A peer that can add a mapping with any target can reach A's
   loopback, LAN and cloud metadata through A. See question 3.
2. Cloudflare terminates TLS, so Cloudflare can see the traffic. That is normal for tunnels, but it
   should be documented.
3. Secrets are hashed at rest, compared in constant time, shown once, and rotated by revoke plus
   create.
4. The remote API reuses the input validation in `HostOps` and `localhost.ts`. The `.localhost`
   restriction and the bare-`localhost` dashboard reservation still apply.

## Phases

| # | Piece                                                               | Est.  |
|---|---------------------------------------------------------------------|-------|
| 1 | Named tunnel mode + `hub:setup`, follows the live port               | 1.5 d |
| 2 | Link store, `link:*` CLI, auth middleware, remote API, request gate  | 2 d   |
| 3 | Peer: remotes store, `link:add`, remote mappings, forwarding + WS, conflict/alias | 2 d |
| 4 | Dashboard: Links card (hub), Remotes card + badges (peer)            | 1.5 d |
| 5 | Tests (two proxies in one test run, fake cloudflared), README, CHANGELOG | 1 d |

Phases 1–2 (hub) and 3 (peer) can be built in parallel against the API contract above. Phase 4
depends on both.

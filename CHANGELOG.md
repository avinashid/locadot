# Changelog

## Unreleased

### Added
- Dashboard pages: every sidebar item now opens its own page (`#/overview`, `#/hosts`, `#/sharing`, `#/remote`, `#/machines`,
  `#/logs`, `#/settings`); they are bookmarkable and work with back/forward.
  - **Overview**: tiles for hosts, down targets, requests, public shares, remote access and connected machines, plus host health, proxy checks and recent activity.
  - **Public sharing**: a per-host share list.
  - **Logs**: filter, level, line count, live mode and download.
- Settings page:
  - HTTP/HTTPS ports with a **Restart proxy** button, which follows the dashboard to the new port.
  - Bind address, state directory, log level and the API token (reveal/copy).
  - Dashboard preferences: theme, refresh interval, start page, collapsed sidebar, confirm-before-remove.
  - New-host defaults (insecure TLS, CORS) and a danger zone.
- API: `GET/PUT /api/settings` and `POST /api/proxy/restart`.
- Remote localhost for admins: an admin peer reaches any port on the sender's machine at `<port>.<domain>.localhost`, where
  `<domain>.localhost` is a landing page listing that machine's shared hosts. The domain is chosen with
  `connect --domain` or in the dashboard, and otherwise defaults to two random words (e.g. `brave-otter`). Change it with
  `remote:domain`. The sender checks the role on every request, never exposes its own proxy ports, and can turn this off
  with `hub:localhost off` or the dashboard switch.

- Dashboard password (UI only): `locadot ui:password` sets or resets it from the terminal (scrypt hash, 0600 file), `--off` removes it,
  and **Settings → Dashboard password** changes it in the UI. When it is set, the dashboard shows a sign-in page and never serves the API token
  to a signed-out visitor. It uses a 7-day HttpOnly SameSite=Strict session, rate-limits wrong passwords, and adds a Sign out button to the sidebar.
  Mapped hosts are not affected, and neither are scripts or the CLI that send `X-Locadot-Token`.

### Changed
- `<domain>.localhost` now opens the sender's own dashboard for an admin peer, with full control (hosts, sharing, peers,
  settings), instead of a landing page; no port needed. The port picker moved to `<domain>.localhost/_locadot/ports`.
  The page never carries the sender's API token, the API only accepts calls from that `<domain>.localhost` origin, the sender
  checks the admin role on every request, `hub:localhost off` turns it off, and a dashboard password still asks for sign-in.
  Senders must run this version too; an older sender answers `<domain>.localhost` with a 404.

### Fixed
- The proxy can now tell a user's `LOCADOT_HTTP_PORT`/`LOCADOT_HTTPS_PORT` from the copies the CLI pins on every spawn
  (`LOCADOT_USER_PORTS`), so saved ports aren't reported as env-overridden.
- `--cors` through remote access: a shared `--cors` mapping is now `--cors` on the receiver too (shown in `list` and the
  dashboard, kept in step by `remote:sync` and `remote:update`). The sender used to rewrite its apps' origins in pages to its
  *own* local URLs, which don't exist on the receiver. Now the receiver sends the names it uses (`X-Locadot-Names`), so a
  page's API calls go to the receiver's name for that mapping (e.g. `api.alice.localhost` after a clash), on the receiver's
  port. The upstream still sees the calling page's real origin. `<port>.<domain>.localhost` gets the CORS handling of a
  `--cors` mapping on that port. The sender keeps names only for mappings the peer can see, and only as `*.localhost` URLs.
  Both machines need this version for the rewriting; with an older receiver the sender behaves as before.

## 2.1.0-beta.0 (2026-09-27)

### Added
- Remote access: share your whole locadot with another locadot over a Cloudflare named tunnel, a quick tunnel, or any URL.
  Receivers pair with a one-time string (5 minutes) and get viewer, editor or admin access, which the sender can change or
  revoke. The sender's mappings appear in the receiver's locadot; clashing names become `<host>.<remote>.localhost`.
  New commands: `hub*`, `share`, `peers*`, `connect`, `remotes`, `remote:*` and `disconnect`. There are also new dashboard cards.
- Dashboard: a collapsible sidebar with section links, active-section highlighting and counts. Collapse it to an icon rail
  (remembered per browser); on small screens it is a slide-out drawer.

## 2.0.0 (2026-09-26)

### Changed
- Internal restructure into `cli/commands/*`, `server/*` and `proxy/*` modules. There are no behaviour changes; see `tasks/README.md`.

### Breaking
- The proxy binds to `127.0.0.1` and `::1` only. Set `LOCADOT_BIND=0.0.0.0` for the old LAN-exposed behaviour.
- The registry format is now v2 (`{version, hosts:{host:{target,…}}}`). The old `{host: port}` files are migrated
  automatically, but older locadot versions can't read the new format.
- `-h` means `--host` on every command. Help is `--help` only.
- Bare `localhost` is reserved for the dashboard and can't be mapped.

### Added
- `locadot tunnel --host <h>` (with `--off`, and `tunnel:install`) shares a mapping on a public `https://*.trycloudflare.com` URL through a Cloudflare quick tunnel, with no account needed. `cloudflared` is downloaded on demand into the state dir. The dashboard has a Cloudflare Tunnel card, a Public URL column and Share/Unshare per row. The API accepts `PUT /api/hosts/:host {"tunnel": true}` and has `POST /api/cloudflared/install`. `--cors` also works for tunnel visitors (the shim, preflights and origin rewriting to the public URL), but their pass-through calls may only reach public addresses; loopback, LAN and metadata addresses are refused at connect time.
- The dashboard is redesigned: a two-column layout, a host filter, loading/offline/empty states, cards on small screens, and a system / light / dark theme toggle.
- `locadot start --port <http> --https-port <https>` (also on `restart`) runs the proxy on other ports than 80/443. The choice is saved in the state dir, so `add`, `status`, `open` and start-at-boot keep using it; `--port 80 --https-port 443` goes back. Running it while the proxy is up on other ports restarts it on the new ones.
- `--cors` per mapping (CLI, API and dashboard). `Origin`/`Referer` are sent as the target's own origin, CORS preflights are answered locally, and any origin may call the domain with credentials. Absolute URLs of other mapped domains in text responses are rewritten to their `.localhost` names, and a mapped caller is sent as its real origin, so a site plus its API both work locally. Pages also get a small script that sends calls to any other origin through the page's own origin (`/__locadot/x/…`), so no mapping per API or third-party domain is needed. (ENH-12, BUG-15)
- A control panel at `https://localhost` with a dark theme. You can add, edit and remove mappings, toggle CA trust and start-at-boot, see root/admin and privileged-port status,
  tail and clear logs, and stop the proxy. (FEAT-05)
- A token-protected JSON API for scripts and AI agents (`POST/PUT/DELETE /api/hosts`, `/api/startup`, `/api/trust`, `/api/logs`, `/api/proxy/stop`),
  and `locadot token` to print the token. (FEAT-05)
- Generic targets: `--target` takes a port, `host:port` or any http(s) URL (`google.localhost` → `https://google.com`).
  `--insecure` accepts self-signed upstreams. Redirects and cookies are rewritten back to the `.localhost` name. (ENH-08)
- A dashboard at `http(s)://localhost` shows each domain, its target, health, hits, errors and latency, with `/api/status`,
  `/api/hosts` and `/healthz`. (ENH-09)
- New commands and options: `status [--json]`, `doctor [--host]`, `open [host]`, `start`, `trust`, `untrust`,
  `logs -n/--no-follow`, `list --json`, the `rm`/`ls` aliases, `--no-start`, and a full `path` listing. (ENH-02, ENH-04, ENH-10, FEAT-01, FEAT-02)
- A trusted local CA with one certificate per domain served by SNI, pre-generated when a mapping loads. (BUG-02)
- Environment variables `LOCADOT_HOME`, `LOCADOT_HTTP_PORT`, `LOCADOT_HTTPS_PORT`, `LOCADOT_BIND` and `LOCADOT_LOG_LEVEL`.
- Test suite (`pnpm test`) and a `prepublishOnly` build.

### Fixed
- Windows: `startup:enable` no longer needs admin rights. It used to fail with "Access is denied". Start at logon now uses the user's Startup folder instead of a scheduled task. (BUG-14)
- Windows: console windows no longer flash up from the background proxy's `certutil`/`schtasks` checks. Start at logon now runs hidden and writes to the log. (BUG-13)
- Upstream `Connection`/`Upgrade` headers are no longer forwarded. Apache sites proxied through locadot kept dropping the connection and lost assets. (BUG-12)
- `stop`, `restart` and `kill` now actually stop the proxy. (BUG-01)
- A failed start is reported with the log tail and exits 1. (BUG-07)
- `update` accepts http targets and `add` accepts https ones. (BUG-03)
- Ports are validated. (BUG-06)
- An unknown host passed to `update` or `remove` exits 1. (BUG-10)
- An unmapped host no longer causes a double response or a crash. (BUG-04)
- The 502 page escapes the Host header. (BUG-05)
- `startup:*` is consistent, and a proxy started at boot is visible to the CLI. (BUG-08)
- Logs are kept across a restart. (BUG-09)
- An empty lock file is no longer read as a running proxy. (BUG-11)
- Every command exits non-zero on failure. (ENH-01)
- Registry writes are atomic and locked, and a corrupt registry is backed up instead of wiped. (ENH-03)
- The log is rotated above 5 MB. (ENH-05)
- The proxy no longer loses its stderr when the CLI exits, and http-proxy's deprecation noise is silenced. (ENH-11)

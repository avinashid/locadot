# Changelog

## Unreleased

The version in `package.json` is still 1.5.7. The owner decides the bump. **2.0.0** is suggested because of the
breaking items below.

### Breaking
- The proxy binds to `127.0.0.1` and `::1` only. Set `LOCADOT_BIND=0.0.0.0` for the old LAN-exposed behaviour.
- The registry format is now v2 (`{version, hosts:{host:{target,…}}}`). The old `{host: port}` files are migrated
  automatically, but older locadot versions can't read the new format.
- `-h` means `--host` on every command. Help is `--help` only.
- Bare `localhost` is reserved for the dashboard and can't be mapped.

### Added
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

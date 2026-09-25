# locadot 🔐

HTTPS custom domains for local development. Point `https://app.localhost` at your dev server on port 3000, or
`https://google.localhost` at any upstream URL, and see every mapping on a dashboard at `https://localhost`.

## ✨ Features

- ✅ **Trusted HTTPS for every domain.** locadot creates one local CA and issues a certificate per domain, served by SNI.
  Run `locadot trust` once to add the CA to your system and browsers.
- 🔁 **Any destination.** A local port (`--port 3000`), a host and port (`--target 192.168.1.5:8080`), or any URL
  (`--target https://google.com`). Redirects and cookies are rewritten so the browser stays on the `.localhost` name.
- 📋 **Control panel at `https://localhost`.** Add, edit and remove mappings, see health and traffic, and toggle CA trust and
  start-at-boot. Includes a token-protected JSON API, so scripts and AI agents can do everything the page does.
- 🔌 **WebSockets** are proxied too, so HMR and dev-server live reload work.
- 🩺 **`status` and `doctor`** show why a domain isn't working: port conflicts, permissions, CA trust, a target that isn't answering.
- 🛡️ **Local by default.** The proxy binds to `127.0.0.1` / `::1` only. Domains must end in `.localhost`, which browsers
  resolve to your machine with no hosts-file edits.
- 🖥️ Works on Linux, macOS and Windows. Optionally starts at boot or logon.

---

## 🚀 Quick start

```bash
npx locadot trust                                   # once: trust the locadot CA (asks for your password)
npx locadot add --host app.localhost --port 3000    # https://app.localhost → http://localhost:3000
npx locadot add --host google.localhost --target https://google.com
npx locadot open                                    # opens the dashboard at https://localhost
```

> **Linux:** ports 80/443 need root. Either run locadot with `sudo`, or allow unprivileged binding once:
> `sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80` (persist it in `/etc/sysctl.d/`). Or use other ports:
> `locadot start --port 8080 --https-port 8443` (URLs then include the port). `locadot doctor` checks this for you.

---

## 📦 Commands

### Mappings

| Command | What it does |
| --- | --- |
| `locadot add --host <name>.localhost --port <port>` | Map a domain to `http://localhost:<port>`. Starts the proxy if it isn't running. |
| `locadot add --host <name>.localhost --target <url>` | Map a domain to any upstream: `3000`, `127.0.0.1:8080`, `http://10.0.0.5:8080/app`, `https://google.com`. |
| `locadot update --host <name>.localhost --port/--target …` | Change the destination of an existing domain. |
| `locadot remove --host <name>.localhost` (`rm`) | Remove a domain. |
| `locadot list` (`ls`, `host`) `[--json]` | Show all mappings. |
| `locadot clear:hosts` | Remove all mappings. |
| `locadot open [host]` | Open a domain, or the dashboard when no host is given, in your browser. |

Options for `add` / `update`:

| Option | Meaning |
| --- | --- |
| `-p, --port <port>` | Shorthand for `--target http://localhost:<port>`. |
| `-t, --target <url>` | Any http(s) upstream. A bare `host:port` means `http://host:port`. |
| `-k, --insecure` | Don't verify the TLS certificate of an `https` target (self-signed upstreams). |
| `--cors` / `--no-cors` | Bypass CORS for this domain. The upstream gets `Origin`/`Referer` as its own origin, preflights are answered locally, any origin may read responses (with credentials), and cookies become `SameSite=None` over HTTPS. The page's calls to other domains go through locadot automatically, with no extra mapping (see [Sites that call other domains](#sites-that-call-other-domains---cors)). |
| `--no-start` | Save the mapping without starting the proxy. |

### Proxy

| Command | What it does |
| --- | --- |
| `locadot start [--port 8080] [--https-port 8443]` | Start the central proxy. Default ports are 80 and 443. Ports you pass are remembered for later commands and start-at-boot, and a running proxy is moved to them. Fails loudly with the reason if it can't bind its ports. |
| `locadot stop` | Stop the proxy. Mappings and logs are kept. |
| `locadot restart [--port …] [--https-port …]` | Stop, then start. |
| `locadot kill` | Stop the proxy, remove all mappings and clear the logs. |
| `locadot status [--json]` | Is it running, its PID, ports, number of hosts, CA trust, start-at-boot, dashboard URL. |
| `locadot doctor [--host h]` | Check the proxy, ports, permissions, CA trust, the registry and every target. Exits 1 if anything fails. |

### Certificates

| Command | What it does |
| --- | --- |
| `locadot trust` | Add the locadot CA to the system trust store, plus the Chrome/Firefox NSS stores on Linux when `certutil` is installed. |
| `locadot untrust` | Remove it again. |

### Logs, files and startup

| Command | What it does |
| --- | --- |
| `locadot logs [-n 50] [--no-follow]` | Print recent proxy logs and follow new ones. `watch:logs` is an alias. |
| `locadot clear:logs` | Clear the log file. |
| `locadot path` | Show every file locadot uses. `path:logs` and `path:hosts` print a single path. |
| `locadot token` | Print the dashboard API token, for scripts and AI agents. |
| `locadot startup:enable` / `startup:disable` / `startup:status` | Start the proxy at boot (Linux cron, macOS LaunchAgent) or logon (a hidden script in the Windows Startup folder, no admin needed). |

---

## 📋 Dashboard & control panel

Open `https://localhost` or `http://localhost` (or run `locadot open`). Requests for bare `localhost` / `127.0.0.1` / `::1`
are answered by locadot itself, not proxied. The page is a dark control panel:

- **System:** whether the proxy runs as root/admin, whether ports below 1024 can be bound (with the Linux sysctl fix when they
  can't), CA trust with an on/off toggle, start-at-boot with an on/off toggle, ports, bind addresses and state dir. It also has a **Stop proxy** button.
- **Proxies:** add a mapping (host + port / host:port / URL, and optional "Insecure TLS" and "Bypass CORS" boxes), edit a target inline, or remove one. The table shows
  each source → destination with up/down, status, latency, hits, errors, last access and average ms. It refreshes every 5 s.
- **Logs:** a live tail with refresh and clear.
- **CLI / API snippets** you can copy.

Trust and start-at-boot may need elevation. locadot asks the OS for it (polkit on Linux, the password dialog on macOS, UAC on Windows).
If that isn't possible, for example on a headless Linux box, the panel shows the exact command to run instead: `sudo locadot trust`,
`locadot startup:enable`, and so on.

### JSON API (for scripts and AI agents)

Everything the page does is a plain JSON API on the dashboard origin. The read routes are open to local callers. Every mutating route needs the
`X-Locadot-Token` header. Get the token with `locadot token`. It lives in `<state dir>/.locadot-token` (mode 0600) and is regenerated
each time the proxy starts.

| Method & path | Body | Does |
| --- | --- | --- |
| `GET /api/status` | | Proxy info, uptime, host count, and `system` (`platform`, `isRoot`, `canBindPrivileged`, `unprivilegedPortStart`, `caTrusted`, `startup`, `stateDir`). |
| `GET /api/hosts` | | Every mapping with urls, probe (`up`, `status`, `ms`) and stats. |
| `GET /api/logs?lines=200` | | `{ lines: [...] }` |
| `POST /api/hosts` | `{ "host": "app.localhost", "target": "3000", "insecure": false, "cors": false }` | Add a mapping (201; 409 if it exists). |
| `PUT /api/hosts/:host` | `{ "target": "https://example.com", "insecure": false, "cors": true }` | Change a mapping (404 if unknown). |
| `DELETE /api/hosts/:host` | | Remove a mapping. |
| `POST /api/startup` | `{ "enabled": true }` | Start at boot on/off. |
| `POST /api/trust` | `{ "trusted": true }` | Trust or untrust the CA. |
| `POST /api/logs/clear` | | Clear the log. |
| `POST /api/proxy/stop` | | Stop the proxy. Use `locadot start` to bring it back. |

Errors are `{ "error": "...", "hint": "<CLI command>" }` with a 4xx/5xx status.

```bash
TOKEN=$(locadot token)
curl -X POST http://localhost/api/hosts -H "X-Locadot-Token: $TOKEN" \
  -H 'Content-Type: application/json' -d '{"host":"app.localhost","target":"3000"}'
curl -X DELETE http://localhost/api/hosts/app.localhost -H "X-Locadot-Token: $TOKEN"
```

**Why a token:** any website you visit can make your browser send requests to `localhost`. Mutating routes therefore reject requests that:
- lack the token, which other sites can't read;
- carry a foreign `Origin`, including your own `*.localhost` apps;
- are marked `Sec-Fetch-Site: cross-site`;
- have a non-JSON body.

The dashboard is served only for the bare `localhost` host names, which also blocks DNS rebinding.

---

## ⚙️ Configuration

All optional, via environment variables. Set them for the CLI; the proxy it starts inherits them.

| Variable | Default | Purpose |
| --- | --- | --- |
| `LOCADOT_HOME` | OS app-data dir (`~/.config/locadot` on Linux) | Where the registry, logs, lock file and certs live. |
| `LOCADOT_HTTP_PORT` | `80` | HTTP port of the proxy. Overrides the port saved by `locadot start --port`. |
| `LOCADOT_HTTPS_PORT` | `443` | HTTPS port of the proxy. Overrides the port saved by `locadot start --https-port`. |
| `LOCADOT_BIND` | `127.0.0.1,::1` | Comma-separated addresses to listen on. Use `0.0.0.0` to expose your mappings to your LAN (not recommended). |
| `LOCADOT_LOG_LEVEL` | `info` | winston log level (`debug` logs every WebSocket upgrade). |

With non-standard ports, URLs include the port: `https://app.localhost:8443`.

---

## ⚠️ Notes on remote targets

`--target https://google.com` proxies the upstream with `Host` rewritten to the upstream's name.
`Location` redirects pointing at the upstream's own host, and cookie domains, are rewritten to the `.localhost` name. A
redirect to a *different* domain (for example `google.com` → `www.google.com`) takes the browser there directly. To stay on
locadot, map the final host instead (`--target https://www.google.com`). Some sites refuse to be framed or proxied; that's up to
the site.

### Sites that call other domains (`--cors`)

A frontend that calls its API or third-party services by absolute URL works with just the site mapped:

```bash
locadot add --host signalsant.localhost --target https://signalsant.com --cors
```

- **Pass-through.** HTML pages get a small script (`/__locadot/shim.js`) as the first thing in `<head>`. It sends `fetch`,
  `XMLHttpRequest`, `EventSource`, `WebSocket` and `sendBeacon` calls to other origins through the page's own origin
  (`/__locadot/x/https/api.signalsant.com/…`). The browser sees a same-origin request, so CORS never applies, and locadot
  forwards it with `Origin: https://signalsant.com`. Only the page itself can use it: requests from other sites get a 403.
- **Cookies.** The page's cookies are forwarded only to the same site (`api.signalsant.com`), never to third parties.
  Cookies set by third parties are dropped.
- **Mapped domains.** If you also map a domain (`api.signalsant.localhost` → `https://api.signalsant.com --cors`), its URLs in
  HTML/JS/CSS/JSON are rewritten to the `.localhost` name and it's called there directly.

Rewritten responses are buffered and sent uncompressed. Event streams and binary files pass through untouched. Not covered:
requests made by web workers or service workers, and `<form>` posts or `<img>`/`<script>` tags (these don't need CORS).

---

## 🛠️ Contributing

The code guide, architecture, and the tracker of bugs, enhancements, features and tech debt live in
[`tasks/README.md`](tasks/README.md). Start there.

```bash
pnpm install
pnpm build     # the CLI spawns dist/core.js, so build before trying proxy changes
pnpm test      # unit + end-to-end tests; runs on spare ports, never touches 80/443
```

Pull requests are welcome.

---

##### Made with ❤️ to make secure local development simple.

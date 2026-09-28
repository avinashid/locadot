# locadot 🔐

[![npm](https://img.shields.io/npm/v/locadot.svg)](https://www.npmjs.com/package/locadot)
[![license](https://img.shields.io/npm/l/locadot.svg)](LICENSE)

HTTPS custom domains for local development. Point `https://app.localhost` at your dev server on port 3000, or
`https://google.localhost` at any upstream URL, share any of them on a public URL, and manage it all from a dashboard at
`https://localhost`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/avinashid/locadot/main/docs/screenshots/dashboard-dark.png">
  <img alt="The locadot dashboard: hosts with health, traffic and public URLs, plus add-host, system and sharing panels" src="https://raw.githubusercontent.com/avinashid/locadot/main/docs/screenshots/dashboard-light.png">
</picture>

## ✨ Features

- ✅ **Trusted HTTPS for every domain.** locadot creates one local CA and issues a certificate per domain, served by SNI.
  Run `locadot trust` once to add the CA to your system and browsers.
- 🔁 **Any destination.** A local port (`--port 3000`), a host and port (`--target 192.168.1.5:8080`), or any URL
  (`--target https://google.com`). Redirects and cookies are rewritten so the browser stays on the `.localhost` name.
- 🌍 **Share on a public URL.** `locadot tunnel --host app.localhost` (or **Share** in the dashboard) puts a mapping on
  `https://<random>.trycloudflare.com` through a Cloudflare quick tunnel. No account needed.
- 🔗 **Remote access, locadot to locadot.** Publish your whole locadot on a Cloudflare hostname and let other machines pair
  with it as viewer, editor or admin. Your mappings show up in their locadot. Admins can also open your dashboard and any
  port on your localhost.
- 🖥️ **Share the dashboard in a browser.** `locadot hub:panel on` serves the control panel at the hub's public URL, behind the
  dashboard password, so you can manage this machine from anywhere without installing locadot there.
- 🧩 **`--cors` for sites that call other domains.** Preflights are answered locally and cross-origin calls are routed
  through the page's own origin, so a production frontend works against its real APIs from `.localhost`.
- 📋 **Control panel at `https://localhost`.** Add, edit, filter and remove mappings, see health and traffic, share them,
  and toggle CA trust and start-at-boot. Light, dark or system theme. Includes a token-protected JSON API, so scripts and
  AI agents can do everything the page does.
- 🔌 **WebSockets** are proxied too, so HMR and dev-server live reload work.
- 🩺 **`status` and `doctor`** show why a domain isn't working: port conflicts, permissions, CA trust, a target that isn't answering.
- 🛡️ **Local by default.** The proxy binds to `127.0.0.1` / `::1` only. Domains must end in `.localhost`, which browsers
  resolve to your machine with no hosts-file edits.
- 🖥️ Works on Linux, macOS and Windows. Optionally starts at boot or logon.

---

## 🚀 Quick start

```bash
npm i -g locadot                                    # or prefix each command with npx
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

### Sharing (Cloudflare Tunnel)

| Command | What it does |
| --- | --- |
| `locadot tunnel --host app.localhost` | Share a mapping on a public `https://<random>.trycloudflare.com` URL through a Cloudflare quick tunnel. No Cloudflare account is needed. `cloudflared` is downloaded on first use. |
| `locadot tunnel --host app.localhost --off` | Stop sharing it. |
| `locadot tunnel` | List the shared mappings and their public URLs. |
| `locadot tunnel:install` | Download `cloudflared` into the state dir (`<state>/bin`). Set `LOCADOT_CLOUDFLARED` to use your own binary; one on `PATH` is also picked up. |

The tunnel runs inside the proxy, so a shared mapping keeps working after `restart` and comes back at boot. Redirects to the
target are rewritten to the public URL. **Anyone with the link can reach the mapping**, so only share what you'd put online.
`--cors` works through the tunnel too: CORS headers and preflights, the pass-through shim, and the target's own
origin in pages rewritten to the public URL (other shared mappings get their public URLs too). For safety, a tunnel visitor's
pass-through calls may only go to public addresses: loopback, LAN, link-local and cloud-metadata addresses are refused, checked
on the address actually dialled, so the tunnel can't be used to reach your machine or network. The dashboard can also do this:
use **Share** / **Unshare** on a row.

### Remote access (locadot to locadot)

One machine (the sender) publishes its whole locadot on a Cloudflare hostname. Other machines (receivers) connect with a
short-lived pairing string, and the sender's mappings then show up in the receiver's own locadot and dashboard.

| Command | What it does |
| --- | --- |
| `locadot hub:setup --domain dev.example.com` | Sender: publish through your own named tunnel on your Cloudflare domain (runs `cloudflared` login, creates the tunnel and routes DNS). The address stays the same. |
| `locadot hub:quick` | Sender: publish on a trycloudflare URL. No account is needed, but **the URL changes if the tunnel restarts**, so receivers have to run `remote:url`. |
| `locadot hub:manual --url <url>` | Sender: publish behind a URL something else already forwards to the proxy's HTTP port (ngrok, a reverse proxy). |
| `locadot hub` / `hub:off` | Show the hub status and URL, or stop it. |
| `locadot hub:localhost <on\|off>` | Sender: allow or block admin peers from opening this machine's dashboard and any port on its localhost. |
| `locadot hub:panel <on\|off>` | Sender: serve this dashboard to any browser at the hub's public URL, behind the [dashboard password](#dashboard-password). Off by default. See [Sharing the dashboard](#sharing-the-dashboard-in-a-browser). |
| `locadot share --role viewer\|editor\|admin [--hosts a.localhost,b.localhost]` | Sender: print a pairing string. It works once and expires after 5 minutes. `--hosts` limits a viewer to those mappings. |
| `locadot peers` / `peers:role <id> <role>` / `peers:revoke <id>` | Sender: list the connected machines, change a role, or cut one off. |
| `locadot connect "<pairing string>" [--name alice] [--domain dev]` | Receiver: connect and import the sender's mappings. If a name clashes, `app.localhost` becomes `app.alice.localhost`. Admins get a local domain that opens the sender's dashboard and localhost (see below); `--domain` picks it, otherwise it's a random `adjective-noun`. |
| `locadot remotes` / `remote:sync <name>` / `disconnect <name>` | Receiver: list the connections (with their domain), pull new mappings, or remove the connection and its names. |
| `locadot remote:domain <name> [domain] [--off]` | Receiver, admin only: set the local domain for a remote's localhost, randomize it (no domain given), or remove it (`--off`). |
| `locadot remote:alias <name> <remote host> <local host>` | Receiver: give a sender mapping another local name, e.g. `he.localhost`. |
| `locadot remote:add\|remote:update\|remote:rm <name> …` | Receiver: change mappings on the sender (editor or admin). |
| `locadot remote:url <name> <url>` | Receiver: point a connection at the sender's new URL. |

Roles: **viewer** can only browse (optionally limited to the mappings picked on the invite). **editor** can also add and change
mappings on the sender. **admin** can also delete them and change sharing, and (unless the sender turned it off with
`hub:localhost off`) open the sender's own dashboard at `https://<domain>.localhost` and manage it as if they were sitting at it,
and reach any port on the sender's localhost at `https://<port>.<domain>.localhost` (`sender's localhost:<port>`). The port
picker is at `https://<domain>.localhost/_locadot/ports`. The admin's browser never gets the sender's API token, so revoking or
demoting the peer cuts off its dashboard access at once; a dashboard password on the sender still applies. Traffic goes receiver → Cloudflare → sender →
target, so an editor can reach anything the sender's machine can reach. Only give that role to people you trust. Only hashes
of the tokens are stored, and failed attempts are rate limited. Only admins can open the sender's dashboard through the hub.
The dashboard has **Remote access** and **Connected machines** cards for all of this.

`--cors` carries over: a sender's `--cors` mapping is `--cors` on the receiver too, with no extra flag. Preflights and CORS
headers work as they do locally, and origins in the sender's pages are rewritten to the receiver's own names and port (so
`http://localhost:8000` in a page becomes `http://api.alice.localhost` if that's the receiver's name for `api.localhost`).
An admin's `<port>.<domain>.localhost` gets the same treatment when a `--cors` mapping points at that port.
`remote:sync` picks up a sender turning `--cors` on or off.

When a target is down, requests through the hub or a public share get a **503** with locadot's "upstream unreachable" page.
Cloudflare replaces an origin's 502 with its own generic "bad gateway" error, which would hide the real cause.

#### Sharing the dashboard in a browser

Remote access above needs locadot on both machines. To manage this machine from a browser anywhere (a laptop, a phone),
share the dashboard itself on the hub's public URL:

```sh
locadot ui:password     # required: visitors sign in with it
locadot hub:panel on    # or the "Share this dashboard" switch under Remote access
locadot hub             # shows the URL, e.g. https://dev.example.com
```

Opening the hub URL in a browser then shows the sign-in page, and after that the full dashboard. Paired machines keep
working on the same URL, since they authenticate with their own tokens. Some details:

- It can't be turned on without a dashboard password, and removing the password turns sharing off.
- The session cookie is `HttpOnly`, `SameSite=Strict` and `Secure` on https. Wrong passwords are rate limited per visitor IP.
- The browser never gets this machine's API token. Changes are only accepted from the page's own origin.
- Only the dashboard is shared. Your mappings stay reachable only by paired machines, and links in the dashboard still point
  at `*.localhost` names, which open on the visitor's own machine.
- Anyone with the password controls this locadot, including remote access and stopping the proxy. Use a strong one, or
  prefer a named tunnel (`hub:setup`) behind Cloudflare Access if you need more.

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
are answered by locadot itself, not proxied. On wide screens the page is a two-column layout: your hosts on the left,
controls on the right. The button at the top right switches between the system, light and dark themes (saved per browser).

<img alt="Hosts table with status, latency, traffic, a shared public URL and per-row actions" src="https://raw.githubusercontent.com/avinashid/locadot/main/docs/screenshots/hosts.png">

- **Hosts:** every mapping with its target, options (`cors`, insecure TLS), up/down status, latency, traffic (hits, errors,
  average ms) and public tunnel URL. Filter the list, edit a target inline (Enter saves, Esc cancels), **Share** / **Unshare**
  or remove it. A host whose target doesn't answer is marked in red. It refreshes every 5 s.
- **Add host:** host + port / host:port / URL, with optional "Insecure TLS" and "Bypass CORS" boxes.
- **System:** ports, bind addresses and state dir, whether the proxy runs as root/admin, whether ports below 1024 can be bound
  (with the Linux sysctl fix when they can't), CA trust and start-at-boot toggles, and a **Stop proxy** button.
- **Sharing:** whether `cloudflared` is installed, with an **Install** button when it isn't.
- **Logs:** a live tail with refresh and clear. **CLI & API:** snippets you can copy.

If the proxy stops, the page says so, disables the controls and reconnects by itself when it's back. On phones and tablets
hosts become cards:

<p>
  <img alt="Dashboard on a phone, light theme" src="https://raw.githubusercontent.com/avinashid/locadot/main/docs/screenshots/mobile.png" width="260">
  <img alt="Dashboard on a phone, dark theme" src="https://raw.githubusercontent.com/avinashid/locadot/main/docs/screenshots/mobile-dark.png" width="260">
</p>

Trust and start-at-boot may need elevation. locadot asks the OS for it (polkit on Linux, the password dialog on macOS, UAC on Windows).
If that isn't possible, for example on a headless Linux box, the panel shows the exact command to run instead: `sudo locadot trust`,
`locadot startup:enable`, and so on.

### Dashboard password

The dashboard is open to anyone on this machine by default. To require a password for the UI only:

```sh
locadot ui:password          # set or reset it (prompts twice; stored as an scrypt hash, 0600)
locadot ui:password --off    # remove it
echo "$PW" | locadot ui:password --stdin
```

You can also set, change or remove it under **Settings → Dashboard password** (changing or removing it there needs the current one).
It's also what [sharing the dashboard in a browser](#sharing-the-dashboard-in-a-browser) signs visitors in with.
Only the dashboard is protected. Your mapped hosts work as before, and so do scripts and the CLI that send `X-Locadot-Token`.
Sessions last 7 days, and changing the password signs everyone out. If you forget it, run `locadot ui:password` again in a terminal.

### JSON API (for scripts and AI agents)

Everything the page does is a plain JSON API on the dashboard origin. The read routes are open to local callers, unless a [dashboard password](#dashboard-password) is set; then they need a signed-in session or the token. Every mutating route needs the
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
| `GET /api/settings` | | Running ports/bind, `logLevel`, `stateDir`, `saved`/`env` overrides, and `restartRequired`. |
| `PUT /api/settings` | `{ "httpPort": 8080, "httpsPort": 8443 }` | Save new ports to the config file (400 if invalid or equal). Takes effect after a restart. |
| `POST /api/proxy/restart` | | Restart the proxy (e.g. to pick up saved ports). |
| `PUT /api/settings/ui-password` | `{ "password": "…", "current": "…" }` or `{ "enabled": false, "current": "…" }` | Set, change or remove the dashboard password (`current` is required once one is set). |
| `GET /api/hub` | | Hub status/config, plus `localhost` (sender: is localhost access on) and `panel` (is the dashboard shared). |
| `PUT /api/hub/localhost` | `{ "enabled": true }` | Sender: turn localhost access for admin peers on/off (400 if the hub isn't configured). |
| `PUT /api/hub/panel` | `{ "enabled": true }` | Sender: share the dashboard at the hub's public URL on/off (400 if the hub isn't configured, or no dashboard password is set). |
| `GET /api/remotes` | | Every remote (never the token), including `domain` and `localhost`. |
| `POST /api/remotes` | `{ "string": "<pairing string>", "name": "alice", "domain": "dev" }` | Receiver: connect using a pairing string; `domain` is optional (admin only, random if omitted). |
| `PUT /api/remotes/:name` | `{ "domain": "dev" }` or `{ "domain": "random" }` or `{ "domain": null }` | Receiver: set, randomize or remove a remote's local domain (400 invalid, 409 clash, 404 unknown). |

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

## ⬆️ Upgrading from 1.x

2.0 changes a few defaults. Your mappings are migrated automatically.

- The proxy listens on `127.0.0.1` and `::1` only. Set `LOCADOT_BIND=0.0.0.0` if you relied on LAN access.
- The registry is stored in a new format that 1.x can't read. Don't downgrade without backing up `locadot path:hosts`.
- `-h` means `--host` on every command. Help is `--help`.
- Bare `localhost` is the dashboard and can't be mapped.

See [CHANGELOG.md](CHANGELOG.md) for everything new.

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
  Calls to a bare `localhost:<port>` (an API or dev server next to the app) go the same way, so the page works when opened
  from another machine through remote access too. There, only admin peers reach the sender's localhost this way.
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

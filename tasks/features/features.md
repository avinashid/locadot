# Features

New capabilities. Entries marked **Proposed** are ideas that haven't been agreed on yet. Move one to `Open`
once it's decided it should be built.
Process: [`../README.md#part-3--how-the-tracker-works`](../README.md#part-3--how-the-tracker-works) · Template: [`../templates/feature.md`](../templates/feature.md)

**Baseline:** 2026-09-24, `main` @ `475b4d0` · **0 open · 2 proposed · 3 shipped**

| ID | P | Title | Status |
| --- | --- | --- | --- |
| [FEAT-03](#feat-03) | P3 | Project config file (`locadot.json`) + `locadot up` | Proposed |
| [FEAT-04](#feat-04) | P3 | Opt-in non-`.localhost` domains via the hosts file | Proposed |

---

### FEAT-05
**Control panel: manage proxies, startup, trust and logs from the dashboard, plus a JSON API for scripts and AI agents** · P1 · Shipped

**Why:** The dashboard at `https://localhost` could only show state. Every change needed the CLI. Users want to see
whether they have root or admin rights and whether start-at-boot and CA trust are on, and to switch them from the page. They also want to add, edit and
remove mappings there, and to let scripts or AI agents drive all of it over HTTP.

**Agenda:**
1. **Security model first**, because the page becomes able to change things and any website can send requests to `localhost`:
   - Mutating routes need an `X-Locadot-Token` header. The token is random per proxy start and stored in `<home>/.locadot-token` (mode 0600).
     It is embedded in the dashboard HTML, which other origins can't read. The custom header also forces a CORS preflight, which locadot never approves.
   - Reject requests whose `Origin` isn't a dashboard origin, whose `Sec-Fetch-Site` is `cross-site`, or whose body isn't `application/json`. Cap bodies at 64 KB.
   - The dashboard is served only for `Host: localhost` / `127.0.0.1` / `[::1]`, which already blocks DNS rebinding. The default loopback bind stays.
2. **System status** in `GET /api/status`: platform, whether the proxy runs as root/admin, whether ports below 1024 can be bound
   (the Linux `ip_unprivileged_port_start` sysctl), CA trusted, start-at-boot enabled and its method, and the state dir.
3. **JSON API**, cross-platform. It reuses the CLI's modules, so behaviour is identical:
   - `POST /api/hosts`, `PUT /api/hosts/:host`, `DELETE /api/hosts/:host`. Validation comes from `parseTarget` / `normalizeHost`.
   - `POST /api/startup {enabled}` and `POST /api/trust {trusted}`. When elevation is needed, locadot tries the OS prompt (polkit, macOS dialog or UAC).
     If that fails it returns the exact CLI command to run.
   - `GET /api/logs?lines=N`, `POST /api/logs/clear`, `POST /api/proxy/stop`.
4. **UI**: a dark, futuristic theme with neon accents, a glass look and a monospace data font. It has:
   - status tiles with toggles;
   - an add/edit/remove form with inline validation errors;
   - a live logs panel;
   - copy-to-clipboard for URLs and for the API/CLI command behind each action.
   It still uses DOM APIs only (no `innerHTML` with data) and a strict CSP nonce, and it respects `prefers-reduced-motion`.
5. **Docs and tests**: README "Dashboard & API" section, `tasks/README.md` Part 1, and tests for every route, including CSRF rejections.

**Out of scope:** remote access to the panel, user accounts, and restarting from the UI. The page can't bring the proxy back after stopping it, so use `locadot start`.

**Done when:** from the page you can add, edit and remove a mapping and the proxy serves it; the startup and trust toggles work (or show
the exact command); and a request without the token, or with a foreign Origin, gets 403. Verified by `pnpm test` and a screenshot.

**Depends on:** [ENH-09](../enhancements/enhancements.md#enh-09) · **Unblocks:** —

**Resolution:** 2026-09-25. Code: `src/dashboard/api.ts` (routes + `assertTrusted`), `src/lib/hosts.ts`, `src/lib/system.ts`, `src/dashboard/page.ts` (UI), token in `src/server.ts`, and `locadot token`. **Verified:** `pnpm test` 71/71, including `test/api.test.ts` (auth/CSRF rejections, CRUD, logs, stop) and `test/api.e2e.test.ts` (real proxy, token mode 0600, add via API → proxied, token removed on stop). A headless-Chromium run of the page: add, duplicate error, inline edit, remove and logs all worked with no CSP/JS errors. **Not verified:** the trust/startup toggles with a valid token (they would change this shared host's trust store and crontab; only their rejection paths are tested), and macOS/Windows.

---

### FEAT-01
**`trust` / `untrust`: install locadot's CA in the OS trust store** · P1 · Shipped

**Why:** Without this, HTTPS is never trusted, and the README's headline promise fails (BUG-02).

**Scope:**
- A persistent CA in the app-data dir, created once.
- `locadot trust`: add it to the system store. On Linux, `update-ca-certificates` / `trust anchor` (and NSS for Firefox/Chrome if
  `certutil` exists). On macOS, `security add-trusted-cert`. On Windows, `certutil -addstore Root`. All through `sudo-prompt`.
- `locadot untrust`: remove it.
- Run `trust` automatically on the first `add` if the CA isn't trusted yet. Ask first, and print what's about to happen.

**Out of scope:** Per-domain cert issuing and SNI. That's the BUG-02 fix, which uses this CA.

**Done when:** After `trust` + `add`, `https://dev.localhost` loads in Chrome and Firefox with no warning on Linux,
macOS and Windows.

**Depends on:** — · **Unblocks:** BUG-02

**Resolution:** 2026-09-25. `locadot trust` / `untrust` (`src/utils/trust.ts`). Linux: Debian/Ubuntu `update-ca-certificates`, Fedora/Arch `update-ca-trust`, plus NSS (`certutil`) for Chrome/Firefox. macOS: `security add-trusted-cert`. Windows: `certutil -addstore`. **Verified:** Linux detection logic only; it was not run against the real store on the shared dev host. macOS and Windows are **untested**.

---

### FEAT-02
**`doctor`: diagnose why a domain isn't working** · P2 · Shipped

**Why:** Today, "it 502s" can mean any of: the proxy isn't running, a stale proxy (BUG-01), ports 80/443 held
by something else, no root, the CA isn't trusted, the host doesn't resolve to loopback, or the target isn't listening.

**Scope:** `locadot doctor [--host h]` checks each of these and prints ✅/❌ with a fix hint for each. It includes the
README's promised "domain resolves to a local IP" check.

**Done when:** Each failure above can be forced and `doctor` names it correctly.

**Depends on:** BUG-01, BUG-07 (so the checks can be reliable) · **Related:** ENH-02, ENH-07

**Resolution:** 2026-09-25. `locadot doctor [--host h]` checks: proxy running, ports reachable, dashboard `/healthz`, Linux `ip_unprivileged_port_start`, CA trusted, registry readable, and a probe of every target. It exits 1 on failure. **Verified:** manual run with one up target and one down target.

---

### FEAT-03
**Project config file (`locadot.json`) + `locadot up`** · P3 · Proposed

**Why:** A repo with web + API + docs needs three `add` commands on every machine.

**Sketch:** `locadot.json` in the project root: `{ "hosts": { "app.localhost": 3000, "api.localhost": 4000 } }`.
`locadot up` adds or updates all of them; `locadot down` removes them.

**Open questions:** Should `up` fail or update if a host is already mapped to a different port?

---

### FEAT-04
**Opt-in non-`.localhost` domains via the hosts file** · P3 · Proposed

**Why:** Some apps need a real-looking domain (cookie scoping, OAuth callbacks), for example `myapp.test`.

**Sketch:** `add --host myapp.test --port 3000 --hosts-file` writes a marked `127.0.0.1 myapp.test` line to
the OS hosts file (with sudo), and `remove` deletes it. It stays restricted to loopback targets.

**Open questions:** Does this conflict with the "only `.localhost`" safety promise in the README? Is it worth it?

---

## Shipped

| ID | Title | Shipped | Version | Commit |
| --- | --- | --- | --- | --- |
| [FEAT-05](#feat-05) | Control panel + JSON API | 2026-09-25 | unreleased | uncommitted |
| [FEAT-01](#feat-01) | `trust` / `untrust`: install locadot's CA in the OS trust store | 2026-09-25 | unreleased | uncommitted |
| [FEAT-02](#feat-02) | `doctor`: diagnose why a domain isn't working | 2026-09-25 | unreleased | uncommitted |

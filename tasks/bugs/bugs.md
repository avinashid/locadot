# Bugs

Something is wrong: it contradicts the README, a command's own output, or obvious intent.
Process: [`../README.md#part-3--how-the-tracker-works`](../README.md#part-3--how-the-tracker-works) · Template: [`../templates/bug.md`](../templates/bug.md)

**Baseline:** 2026-09-24, `main` @ `475b4d0` · **0 open · 14 resolved**

| ID | P | Title | Area | Status |
| --- | --- | --- | --- | --- |
| — | | | | |

## Fix order

| # | Do | Why |
| --- | --- | --- |
| 1 | BUG-01 + BUG-11 + BUG-09 | All in the teardown path (`softDestroy` and the proxy's signal handlers). One change, and every later fix needs a reliable restart to test. |
| 2 | BUG-04 + BUG-05 | Both in `http.ts` / `template.ts`, a few lines each. |
| 3 | BUG-03 + BUG-06 + BUG-10 | CLI validation in `commands.ts` / `index.ts`. |
| 4 | BUG-07 | Needs BUG-01 so it can be tested reliably. |
| 5 | BUG-02 | The biggest one. Pairs with [`FEAT-01`](../features/features.md#feat-01). |
| 6 | BUG-08 | Platform-specific; needs testing on each OS. |

---

### BUG-01
**`stop` / `restart` / `kill` leave the proxy running, now blind to registry changes** · P1 · lifecycle · Resolved

**Where:** `src/proxy.ts:25-38`, `src/lib/locadot-file.ts:92-119`

**What happens:** The CLI's `softDestroy` deletes the lock file and sends SIGTERM to the proxy PID. The
proxy has its own `SIGTERM`/`SIGINT` listeners. Installing a listener replaces Node's default "exit on
signal" behaviour, and the listener only runs `softDestroy(watcher)`, which closes the registry watcher
and tries to kill itself. The lock file is already gone, so that kill is `process.kill(NaN)`, which throws
and is swallowed (see BUG-11). **The process never exits.** Ports 80/443 stay bound, and the proxy keeps
serving the *old* domain map with its watcher closed.

After that: `restart` / `add` spawn a new proxy. It dies on `EADDRINUSE` (silently; see BUG-07). The old
one keeps serving but never sees new mappings. From the user's side, "I added a host and it 502s."

**Evidence:** Reproduced 2026-09-24 on Node 26. A process with a no-op `SIGTERM` listener that calls
`process.kill(process.pid)` stays alive until SIGKILL:
```bash
timeout -s KILL 3 node -e 'process.on("SIGTERM",()=>{}); setInterval(()=>{},1e3); process.kill(process.pid)'; echo $?  # 137
```

**Fix direction:** In the proxy process, the signal handler should close both servers and the watcher, then
`process.exit(0)`. It should not call `softDestroy`, which is the CLI-side teardown. The CLI side should wait
for the PID to disappear (poll `process.kill(pid, 0)` for up to ~3 s), then escalate to SIGKILL.

**Depends on:** — · **Related:** BUG-07, BUG-09, BUG-11

**Resolution:** 2026-09-25. The proxy handles SIGTERM/SIGINT/SIGHUP: it closes its servers and watcher, removes its *own* lock file, and exits, with a forced exit after 3 s (`src/server.ts` `shutdown`). The CLI sends SIGTERM, waits up to 5 s, then SIGKILL (`src/proxy.ts` `stop`). EPERM (a root-owned proxy) now says to re-run with sudo instead of claiming success. **Verified:** smoke test, `stop` ends the pid in ~1.5 s and the lock file is gone; `restart` gets a new pid.

---

### BUG-02
**HTTPS serves a `localhost` cert from an untrusted throwaway CA for every domain** · P1 · certs · Resolved

**Where:** `src/utils/certs.ts:9-46`, `src/proxy.ts:18,45`

**What happens:** The README says "automatically generates trusted local SSL certificates". In fact:
1. `createSSL` makes a **new CA** with `mkcert.createCA`, signs one cert with it, and throws the CA away.
   Nothing is ever added to the OS or browser trust store, so the cert is untrusted everywhere.
2. The proxy calls `createSSL("localhost")` once and uses that cert for **all** hosts. There is no
   `SNICallback`, so `https://dev.localhost` gets a cert for `localhost` and fails the name check as well.
3. The cert has a 365-day validity and is cached by file existence alone. After a year it expires and is
   never regenerated.

**Evidence:** Found by reading. No `SNICallback`, no trust-store step anywhere in `src/`.

**Fix direction:** Create a persistent CA once (`ca.key`/`ca.pem` in the app-data dir) and install it into
the trust store ([`FEAT-01`](../features/features.md#feat-01)). Issue a per-domain cert on `add` or on
first SNI hit, cached in memory, via `https.createServer({ SNICallback })`. Regenerate when a cert is close
to expiry.

**Depends on:** FEAT-01 for the trust part · **Related:** —

**Resolution:** 2026-09-25. Persistent CA under `<home>/certs/`, one leaf cert per domain issued through `SNICallback` and pre-generated when mappings load (`src/utils/certs.ts`). `locadot trust` installs the CA ([FEAT-01](../features/features.md#feat-01)). **Verified:** `curl --cacert <home>/certs/locadot-ca.pem https://app.localhost:18443` verifies with SNI; an automated test does the same.

---

### BUG-03
**`update` rejects plain-HTTP targets; `add` rejects HTTPS ones** · P1 · cli · Resolved

**Where:** `src/lib/localhost.ts:3-29`, `src/lib/commands.ts:21-24`, `src/lib/commands.ts:50-53`

**What happens:** `isLocalhostOpen(host, port)` sends an **HTTPS** `HEAD` to `localhost:<port>`, the
*target* app, and returns true only for 2xx/3xx.
- `add` exits with "Domain already in use" when that is true, so it refuses targets that serve HTTPS.
- `update` exits with "Domain not found" when it is false. Most dev servers are plain HTTP, and
  locadot always proxies to `http://`, so `update` fails in the common case.

Neither message describes what was actually checked. What both commands should check is the
**registry**: is this domain already mapped?

**Evidence:** Found by reading. Not reproduced end to end, because that needs ports 80/443.

**Fix direction:** `add`: error if `registry[host]` exists (that check is already in `proxy.ts:120`). `update`:
error if it doesn't. Optionally *warn* (not fail) when nothing is listening on the target port, using a plain
TCP connect.

**Depends on:** — · **Related:** BUG-10

**Resolution:** 2026-09-25. `add` and `update` share `parseTarget` (`src/lib/localhost.ts`): a port, `host:port`, or an `http(s)` URL. `--port` and `--target` can't be combined. See [ENH-08](../enhancements/enhancements.md#enh-08). **Verified:** unit tests plus smoke tests (http target, https remote target, both flags → exit 1).

---

### BUG-04
**Unmapped host: 502 page is sent, then the request still reaches `proxy.web` and throws** · P2 · proxy · Resolved

**Where:** `src/lib/http.ts:21-31`

**What happens:** The `if (!targetPort)` branch writes the 502 page but doesn't `return`. Execution
continues to `proxy.web` with target `http://localhost:undefined`, which throws `ERR_INVALID_ARG_VALUE:
Invalid port in url` synchronously. The surrounding `try/catch` logs it as an error, so every request to an
unmapped host writes a stack trace to the log.

**Evidence:** Reproduced 2026-09-24 with http-proxy 1.18.1: `proxy.web(req, res, { target: "http://localhost:undefined" })`
throws `TypeError [ERR_INVALID_ARG_VALUE]`.

**Fix direction:** `return` after `res.end(...)`. Also guard the `proxy.web` error callback with
`if (!res.headersSent)` before `writeHead`.

**Depends on:** — · **Related:** BUG-05

**Resolution:** 2026-09-25. `requestHandler` returns after sending the 502 page, and the proxy error callback checks `headersSent` (`src/lib/http.ts`). **Verified:** an unmapped host gets one 502 and the log has no error lines.

---

### BUG-05
**`Host` header reflected unescaped into the 502 HTML page; hint omits `add`** · P2 · proxy / security · Resolved

**Where:** `src/constants/template.ts:54-56`, called from `src/lib/http.ts:23`

**What happens:** `proxyNotFound(host)` interpolates the request's `Host` value (split on `:`) straight into
HTML. The proxy listens on all interfaces on 80/443, so any client that can reach the machine, or a
DNS-rebinding page, controls that string. The result is reflected HTML/JS served from a `*.localhost` origin.
Separately, the suggested command `npx locadot --host … --port PORT` is missing the `add` subcommand
and doesn't work.

**Evidence:** Found by reading.

**Fix direction:** HTML-escape `host` (`& < > " '`). Change the hint to `npx locadot add --host … --port PORT`.
Consider binding to `127.0.0.1` only ([`ENH-06`](../enhancements/enhancements.md#enh-06)).

**Depends on:** — · **Related:** BUG-04, ENH-06

**Resolution:** 2026-09-25. Every interpolated value is HTML-escaped (`src/dashboard/escape.ts`, `src/constants/template.ts`). The hint shows the `add` command and links to the dashboard. **Verified:** a `Host: <script>` request comes back escaped (smoke test and test suite).

---

### BUG-06
**`--port` is never parsed or validated; stored as a string** · P2 · cli · Resolved

**Where:** `src/index.ts:22,34`, `src/lib/commands.ts:8-12`

**What happens:** Commander passes `--port` through as a string (confirmed: `typeof options.port === "string"`),
although the `startCommand` type says `number`. The registry then stores `"3350"`. Also,
`--port abc`, `--port 0` and `--port 99999` are all accepted and written.

**Evidence:** Reproduced 2026-09-24 with commander 14.

**Fix direction:** Add a Commander argument parser: `parseInt`, then reject anything that isn't an integer in 1–65535.
Normalise existing string values when the registry is read.

**Depends on:** — · **Related:** —

**Resolution:** 2026-09-25. `parsePort` accepts only integers 1–65535. Mappings are stored as a `target` URL. **Verified:** `--port abc`, `0` and `70000` exit 1 (unit tests).

---

### BUG-07
**Proxy start failures are silent; CLI says "started"** · P2 · lifecycle · Resolved

**Where:** `src/proxy.ts:52-64`, `src/proxy.ts:89-107`, `src/proxy.ts:65-67`

**What happens:** The servers have no `error` listener. `EADDRINUSE` (another proxy, nginx, Apache) or
`EACCES` (not root) on 80/443 becomes an uncaught exception, and the detached child dies. Its stderr goes
into the log file, but the parent has already printed "🚀 Central proxy started in background." and
written the lock file with a now-dead PID. `startCentralProxy`'s `try/catch` doesn't help, because
`listen` errors are asynchronous.

**Evidence:** Found by reading.

**Fix direction:** Handle `server.on("error")` in the proxy and exit non-zero with a clear message. In `startProxy`,
wait briefly (for example, poll up to ~2 s for a "ready" line or a successful TCP connect to :443) before
reporting success. On failure, print the last log lines and remove the lock file.

**Depends on:** BUG-01 (for reliable testing) · **Related:** FEAT-02

**Resolution:** 2026-09-25. `start` waits up to 10 s for the proxy to write its lock file. The proxy writes it only once it is listening. On failure `start` prints the new log lines and the log path, and exits 1. **Verified:** with the port held by another listener, `start` exits 1 with an "already in use" hint.

---

### BUG-08
**`startup:*` disagrees with itself (root vs user crontab), and a reboot-started proxy is invisible to the CLI** · P2 · startup · Resolved

**Where:** `src/utils/startup.ts:39-42,91-93,122-125`, `src/utils/startup.ts:44-67`, `src/core.ts`

**What happens:**
- **Linux:** `enable` / `disable` run through `sudo`, so they edit **root's** crontab. `status` runs
  `crontab -l` without sudo and reads the **user's** crontab. It reports `disabled` right after a successful enable.
  Root's cron `PATH` may also not contain `node` (nvm installs).
- **macOS:** the plist is written to the *user's* `~/Library/LaunchAgents`, then loaded with `sudo launchctl`,
  in root's context. The label `com.local.reboot` is generic and could clash with another tool's.
- **All:** at boot, `node dist/core.js` runs directly. No lock file is written, so `isProxyRunning()` is false.
  The next `add` spawns a second proxy, which dies on `EADDRINUSE` (BUG-07), and `stop` can't find the
  boot-started one.

**Evidence:** Found by reading. Not reproduced on any platform.

**Fix direction:** Have the proxy write its own lock file (`process.pid`) on startup, not the CLI. Use the same
privilege context for enable, disable and status. Use an absolute `process.execPath` in startup entries. Rename
the label to `com.locadot.proxy`.

**Depends on:** — · **Related:** BUG-07

**Resolution:** 2026-09-25. Rewritten `src/utils/startup.ts`. Linux: the root crontab (via sudo-prompt) only when ports below 1024 need root, otherwise the user crontab, both tagged `# locadot-proxy`. macOS: a user LaunchAgent. Windows: a per-user `ONLOGON` task. A `startup.json` marker records which method was used. A boot-started proxy writes its own lock file, so the CLI sees it. **Verified:** Linux user crontab only. macOS and Windows are **untested**.

---

### BUG-09
**`stop` / `restart` wipe the log file** · P3 · lifecycle · Resolved

**Where:** `src/lib/locadot-file.ts:105-110`

**What happens:** `softDestroy`, used by `stop` and `restart`, calls `clearLogs()`. The README says only
`kill` clears logs. Restarting after a failure destroys the log that explains the failure.

**Evidence:** Found by reading.

**Fix direction:** Remove `clearLogs()` from `softDestroy`. Keep it in `destroy` (`kill`).

**Depends on:** — · **Related:** BUG-01

**Resolution:** 2026-09-25. `stop` and `restart` no longer touch the log. Only `kill` and `clear:logs` clear it. Logs above 5 MB are rotated to `.1` on start. **Verified:** smoke test, the log survives a restart.

---

### BUG-10
**`remove` / `update` of an unknown host succeed silently and start the proxy** · P3 · cli · Resolved

**Where:** `src/proxy.ts:132-144`, `src/lib/locadot-file.ts:43-52`

**What happens:** `removeProxy` / `updateProxy` start the proxy if it isn't running, which is a side
effect nobody asked for, then write the registry without checking the host exists. `remove --host nope.localhost`
prints nothing and exits 0. `update` on an unknown host *adds* it, although today BUG-03 usually blocks that first.

**Evidence:** Found by reading.

**Fix direction:** Check `registry[domain]` and exit 1 with `hostNotFound` if it's missing. Don't start the proxy for
`remove`. Print a confirmation line on success.

**Depends on:** — · **Related:** BUG-03

**Resolution:** 2026-09-25. `update` and `remove` throw `InputError` for an unknown host and exit 1 without starting anything. **Verified:** smoke test and test suite.

---

### BUG-11
**Empty lock file reads as PID `"NaN"`, which is truthy** · P3 · lifecycle · Resolved

**Where:** `src/lib/locadot-file.ts:14-22`, `src/utils/file.ts:97-114`

**What happens:** `readFileSync` *creates* a missing file as empty, so `getProcessId()` returns
`parseInt("").toString()` = `"NaN"`. `destroy` / `softDestroy` treat it as truthy and call `process.kill(NaN)`,
which throws. The error is swallowed. It's also a reason BUG-01 goes unnoticed.

**Evidence:** Reproduced: `Boolean(parseInt("").toString()) === true`.

**Fix direction:** Return `undefined` unless the parsed value is a positive integer. Don't create files as a side
effect of reading them.

**Depends on:** — · **Related:** BUG-01

**Resolution:** 2026-09-25. `readProxyInfo` parses JSON (or a legacy bare PID) and rejects anything that isn't a positive integer. **Verified:** unit test with an empty or garbage lock file.

---

### BUG-12
**Upstream hop-by-hop headers are forwarded, so the proxy closes the browser socket after every response** · P2 · proxy · Resolved

**Where:** `src/server.ts` (`proxy.on("proxyRes")`)

**What happens:** http-proxy copies `Connection` and `Upgrade` from the upstream response. Apache hosts (e.g. `digtinctive.localhost` → `https://digtinctive.com`) send `Connection: Upgrade, close` and `Upgrade: h2,h2c`, so Node closed the browser connection after each asset. Asset-heavy pages then lost CSS, JS and images intermittently (`net::ERR_TOO_MANY_RETRIES`).

**Evidence:** `curl -D -` through the proxy showed both headers; a curl fetching three URLs opened a new connection for each. Headless Chromium hit `ERR_TOO_MANY_RETRIES` on `assets/css/animate.min.css`.

**Fix direction:** Strip `Connection`, the headers it lists, `Keep-Alive`, `Upgrade` and `Proxy-Connection` from non-101 responses.

**Depends on:** — · **Related:** ENH-08

**Resolution:** 2026-09-25. **Verified:** e2e test `upstream hop-by-hop headers are not forwarded`; curl reuses one connection for three URLs; 38 digtinctive.com pages load in Chromium through the proxy with no connection errors.

---

### BUG-13
**Windows: console windows flash up and vanish while the proxy runs** · P2 · windows · Resolved

**Where:** `src/utils/trust.ts`, `src/utils/startup.ts`

**What happens:** The detached proxy has no console, so every child process it starts without `windowsHide`
gets a new console window that appears and closes. The proxy runs `certutil -store Root` every 5 minutes
(trust refresh), and `schtasks /Query` every 30 s while the dashboard is open (start-at-boot status). The
logon task also ran `node.exe` directly, which left a console window open after login; closing it killed
the proxy. Its output was also lost.

**Fix direction:** Set `windowsHide: true` on every child process. The logon task runs
`wscript.exe //B //Nologo <home>/startup-hidden.vbs`, which starts `cmd /c node … >> log 2>&1` with the
window hidden.

**Depends on:** — · **Related:** BUG-08, FEAT-05

**Resolution:** 2026-09-25. **Verified:** `test/windows-hide.test.ts` scans `src/` for child-process calls
without `windowsHide` (confirmed it fails when one is removed) and checks the VBS quoting. Not run on a real
Windows machine. Users with the old task must re-run `locadot startup:enable`.

---

### BUG-14
**Windows: `startup:enable` fails with "Access is denied"** · P1 · windows · Resolved

**Where:** `src/utils/startup.ts`

**What happens:** Start at logon was a scheduled task (`schtasks /Create /SC ONLOGON`). Windows only lets an
administrator create ONLOGON tasks, so from a normal terminal (and from the dashboard toggle) `startup:enable`
failed with "ERROR: Access is denied." and nothing started at logon.

**Fix direction:** Write the hidden launcher (`locadot-proxy.vbs`, from BUG-13) into the user's Startup folder
(`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`). That needs no admin rights, and `startup:status`
checks that the file exists. `enable`/`disable` also remove the old scheduled task and `startup-hidden.vbs`,
best effort.

**Depends on:** BUG-13 · **Related:** FEAT-05

**Resolution:** 2026-09-25. **Verified:** `pnpm test` passes and `test/windows-hide.test.ts` checks the
launcher script. Not run on a real Windows machine.

---

## Resolved

| ID | P | Title | Resolved | Commit |
| --- | --- | --- | --- | --- |
| [BUG-01](#bug-01) | P1 | `stop` / `restart` / `kill` leave the proxy running, now blind to registry changes | 2026-09-25 | uncommitted |
| [BUG-02](#bug-02) | P1 | HTTPS serves a `localhost` cert from an untrusted throwaway CA for every domain | 2026-09-25 | uncommitted |
| [BUG-03](#bug-03) | P1 | `update` rejects plain-HTTP targets; `add` rejects HTTPS ones | 2026-09-25 | uncommitted |
| [BUG-04](#bug-04) | P2 | Unmapped host: 502 page is sent, then the request still reaches `proxy.web` and throws | 2026-09-25 | uncommitted |
| [BUG-05](#bug-05) | P2 | `Host` header reflected unescaped into the 502 HTML page; hint omits `add` | 2026-09-25 | uncommitted |
| [BUG-06](#bug-06) | P2 | `--port` is never parsed or validated; stored as a string | 2026-09-25 | uncommitted |
| [BUG-07](#bug-07) | P2 | Proxy start failures are silent; CLI says "started" | 2026-09-25 | uncommitted |
| [BUG-08](#bug-08) | P2 | `startup:*` disagrees with itself (root vs user crontab), and a reboot-started proxy is invisible to the CLI | 2026-09-25 | uncommitted |
| [BUG-09](#bug-09) | P3 | `stop` / `restart` wipe the log file | 2026-09-25 | uncommitted |
| [BUG-10](#bug-10) | P3 | `remove` / `update` of an unknown host succeed silently and start the proxy | 2026-09-25 | uncommitted |
| [BUG-11](#bug-11) | P3 | Empty lock file reads as PID `"NaN"`, which is truthy | 2026-09-25 | uncommitted |
| [BUG-12](#bug-12) | P2 | Upstream hop-by-hop headers forwarded; browser socket closed after every response | 2026-09-25 | uncommitted |
| [BUG-14](#bug-14) | P1 | Windows: `startup:enable` fails with "Access is denied" | 2026-09-25 | uncommitted |
| [BUG-13](#bug-13) | P2 | Windows: console windows flash up and vanish while the proxy runs | 2026-09-25 | uncommitted |

# Enhancements

Something works but should work better: clearer, safer, friendlier.
Process: [`../README.md#part-3--how-the-tracker-works`](../README.md#part-3--how-the-tracker-works) · Template: [`../templates/enhancement.md`](../templates/enhancement.md)

**Baseline:** 2026-09-24, `main` @ `475b4d0` · **0 open · 12 resolved**

| ID | P | Title | Status |
| --- | --- | --- | --- |
| — | | | |

---

### ENH-01
**Commands swallow errors and always exit 0** · P2 · Resolved

**Where:** `src/lib/commands.ts:61-129` (eight `catch (error) {}` blocks), `src/index.ts`, where every action ends in `process.exit(0)`

**Today:** Failures in `stop`, `kill`, `clear:hosts`, `host`, `clear:logs` and `startup:*` are silently discarded and the
command exits 0. Scripts and CI can't tell whether anything worked.

**Proposed:** Let errors propagate to one handler in `index.ts` that prints a one-line message and exits 1. Use
`logger.error` for the detail.

**Done when:** A forced failure (for example, a read-only app-data dir) prints an error and exits non-zero for every command.

**Depends on:** —

**Resolution:** 2026-09-25. `run()` in `src/index.ts` turns `InputError`, `ProxyError` and `RegistryError` into a message and exit 1. Anything unexpected prints its stack and exits 1. `doctor` sets exit code 1 when a check fails. **Verified:** smoke tests check the exit codes.

---

### ENH-02
**`status` command** · P2 · Resolved

**Today:** You can't ask "is the proxy running, and what is it serving?" without reading the lock file and
running `ps` yourself.

**Proposed:** `locadot status` prints the proxy PID and whether it's alive, whether 80/443 are listening,
the host count, the startup state and the app-data dir. Add `--json`.

**Done when:** The output is correct with the proxy running, stopped, and with a stale lock file.

**Depends on:** BUG-11 (for correct PID handling)

**Resolution:** 2026-09-25. `locadot status [--json]` shows the pid, version, uptime, ports, bind addresses, host count, CA trust, startup and the dashboard URL. **Verified:** manual run and smoke test.

---

### ENH-03
**Atomic, race-free registry writes** · P2 · Resolved

**Where:** `src/lib/locadot-file.ts:35-52`, `src/utils/file.ts:85-95`

**Today:** Each change reads the registry, modifies it and writes it back with `fs.writeFileSync`. Two
`add`s at once (for example, two `pnpm dev` scripts) can lose one mapping. A crash mid-write leaves invalid
JSON, and `getRegistry` then returns `{}` and wipes every mapping on the next write.

**Proposed:** Write to `*.tmp` and then `rename`. Keep a simple lock file around read-modify-write. If the registry
fails to parse, back up the bad file instead of treating it as empty.

**Done when:** 20 parallel `add`s with different hosts all end up in the registry.

**Depends on:** —

**Resolution:** 2026-09-25. `RegistryStore.mutate` (`src/lib/registry.ts`) takes a lock file (`wx`; stale after 10 s; waits up to 5 s), writes a temp file and renames it into place. A corrupt registry is backed up and reported, not silently reset. The proxy keeps serving the last good copy. **Verified:** unit tests, including concurrent `mutate` calls.

---

### ENH-04
**`path` should show every file locadot uses** · P3 · Resolved

**Where:** `src/lib/commands.ts:110-113`

**Today:** `path` prints the registry and the log only. The lock file, the certs and the app-data dir itself are missing.

**Proposed:** Print a labelled list of every path in `Constants.paths`, plus the cert/CA files.

**Depends on:** —

**Resolution:** 2026-09-25. `locadot path` lists the state dir, registry, lock file, logs, CA and startup marker.

---

### ENH-05
**Cap log file size** · P3 · Resolved

**Where:** `src/utils/logger.ts:14`, `src/proxy.ts:93-94`

**Today:** The log grows without bound. Every proxy error and every WebSocket upgrade writes a line.

**Proposed:** Use winston `maxsize` + `maxFiles`, or rotate on proxy start. Keep `watch:logs` working across rotation.

**Depends on:** —

**Resolution:** 2026-09-25. The log is rotated to `logs.1` when it passes 5 MB at `start` (`src/proxy.ts` `rotateLogs`).

---

### ENH-06
**Bind the proxy to loopback only** · P2 · Resolved

**Where:** `src/proxy.ts:52,59`

**Today:** `listen(443)` / `listen(80)` bind to all interfaces, which exposes every mapped dev server to the
local network (café Wi-Fi, office LAN).

**Proposed:** Bind `127.0.0.1` (and `::1`) by default. Add an explicit opt-in (`--lan` or a config flag) for exposure.

**Done when:** `curl http://<LAN-IP>/` from another machine is refused by default.

**Depends on:** —

**Resolution:** 2026-09-25. The default bind is `127.0.0.1,::1`, overridable with `LOCADOT_BIND`. A missing IPv6 address is skipped. **Verified:** `ss -ltnp` shows loopback only.

---

### ENH-07
**README claims that the code doesn't back up** · P3 · Resolved

**Where:** root `README.md` features list

**Today:** The README promises "trusted" certificates (false; see BUG-02) and "Warns and exits if domain isn't
correctly mapped to a local IP" (no such check exists; see FEAT-02). The "Default (Run Proxy)" heading describes
`add`. The 502 page's hint is wrong (BUG-05).

**Proposed:** Correct the README now. Restore the claims as BUG-02 / FEAT-02 land.

**Depends on:** —

**Resolution:** 2026-09-25. The root README is rewritten to match the code: generic targets, dashboard, every command, env vars, Linux port notes, CA trust, and the caveat about redirects to other domains.

---

### ENH-08
**Generic upstream targets: any port, host:port or URL, e.g. `google.localhost` → `https://google.com`** · P1 · Resolved

**Why:** Only a local port could be mapped. Pointing `google.localhost` at `https://google.com`, or a domain at another machine or container, wasn't possible.

**Resolution:** 2026-09-25. `--target <url>` on `add`/`update` (`--port N` remains as shorthand). Mappings are stored as `{target, insecure?}` in registry v2; the legacy `{domain: port}` format is migrated on read. The proxy uses `changeOrigin`, `autoRewrite`/`hostRewrite`/`protocolRewrite` and `cookieDomainRewrite` so upstream redirects and cookies stay on the `.localhost` name. `--insecure` skips TLS verification for self-signed upstreams. Redirects to a *different* domain leave locadot; this is documented. **Verified:** `pnpm test` end-to-end suite + `/tmp`-home smoke test on ports 18080/18443.

---

### ENH-09
**Dashboard at `http(s)://localhost`: every source → destination with health and traffic** · P1 · Resolved

**Why:** There was no way to see what was mapped and whether it worked without the CLI.

**Resolution:** 2026-09-25. Bare `localhost` / `127.0.0.1` / `::1` is served by `src/dashboard/`: a table of domain → target, up/down with status and latency, hits, errors, last access and average ms, plus proxy info and CA trust. It refreshes every 5 s from `/api/status` and `/api/hosts`. `/healthz` is for `doctor`. It has a strict CSP with a per-response nonce. It was read-only at first; [FEAT-05](../features/features.md#feat-05) later added token-guarded controls. Bare `localhost` is reserved and can't be mapped. **Verified:** `pnpm test` end-to-end suite + `/tmp`-home smoke test on ports 18080/18443.

---

### ENH-10
**Useful commands: `open`, `start`, `logs -n/--no-follow`, `list --json`, `status --json`, `rm`/`ls` aliases, `--no-start`** · P2 · Resolved

**Why:** Scripts and quick checks had to parse human output. `watch:logs` couldn't limit or stop, and there was no way to start the proxy without adding a host.

**Resolution:** 2026-09-25. Added the commands in the title. `-h` means `--host` everywhere, and help is `--help` only. **Verified:** `pnpm test` end-to-end suite + `/tmp`-home smoke test on ports 18080/18443.

---

### ENH-11
**Reliability: readiness-checked start, graceful stop, cert warm-up, no broken log pipe** · P1 · Resolved

**Why:** Starting could fail silently, the first HTTPS hit per domain stalled 1–2 s generating a cert, and the proxy's stderr pipe broke when the CLI exited.

**Resolution:** 2026-09-25. The child gets the log file's fd as stdio (no pipe), is spawned with `--no-deprecation`, and writes its lock file (JSON `ProxyInfo`) only once listening. Certs are pre-generated when mappings load. Registry reload errors keep the last good copy. Listen errors are explained (`EADDRINUSE`, `EACCES`). `uncaughtException` and `unhandledRejection` are logged instead of crashing the proxy. See BUG-01, BUG-07, BUG-09 and BUG-11 for the rest. **Verified:** `pnpm test` end-to-end suite + `/tmp`-home smoke test on ports 18080/18443.

---

### ENH-12
**`--cors`: make the upstream think requests come from itself, and let any origin call it** · P1 · Resolved

**Why:** Proxying a remote API or site (e.g. `api.localhost` → `https://api.example.com`) still hit CORS and origin
checks. The upstream saw `Origin: https://api.localhost` and rejected it or sent no `Access-Control-*` headers, and
preflights went upstream, where they often fail.

**Resolution:** 2026-09-25. Opt-in per mapping (`add/update --cors`, `--no-cors`, the API's `cors` field, and the
dashboard's "Bypass CORS" box and row toggle).
- Requests: `Origin` and `Referer` are rewritten to the target's origin. This includes WebSocket upgrades.
- Preflights (`OPTIONS` with `Access-Control-Request-Method`) are answered locally with a 204 that allows the
  requested method, headers and private-network access.
- Responses: the upstream's `Access-Control-*` headers are replaced. The caller's origin is echoed with credentials
  allowed, every response header is exposed, and `Vary: Origin` is added.
- Over HTTPS, `Set-Cookie` becomes `SameSite=None; Secure`.
- locadot's own 502 page also carries the CORS headers.
- Out of scope: URLs hard-coded in page bodies still go to the real domain. That would need body rewriting.

**Verified:** `pnpm test` (78/78), with new e2e cases in `test/cli.e2e.test.ts` and an `applyCors` unit test in
`test/http.test.ts`. Also a live run against `https://example.com` and API validation on spare ports. The dashboard
script was syntax-checked but not clicked through: headless Chromium can't start on this host.

---

## Resolved

| ID | P | Title | Resolved | Commit |
| --- | --- | --- | --- | --- |
| [ENH-01](#enh-01) | P2 | Commands swallow errors and always exit 0 | 2026-09-25 | uncommitted |
| [ENH-02](#enh-02) | P2 | `status` command | 2026-09-25 | uncommitted |
| [ENH-03](#enh-03) | P2 | Atomic, race-free registry writes | 2026-09-25 | uncommitted |
| [ENH-04](#enh-04) | P3 | `path` should show every file locadot uses | 2026-09-25 | uncommitted |
| [ENH-05](#enh-05) | P3 | Cap log file size | 2026-09-25 | uncommitted |
| [ENH-06](#enh-06) | P2 | Bind the proxy to loopback only | 2026-09-25 | uncommitted |
| [ENH-07](#enh-07) | P3 | README claims that the code doesn't back up | 2026-09-25 | uncommitted |
| [ENH-08](#enh-08) | P1 | Generic upstream targets: any port, host:port or URL, e.g. `google.localhost` → `https://google.com` | 2026-09-25 | uncommitted |
| [ENH-09](#enh-09) | P1 | Dashboard at `http(s)://localhost`: every source → destination with health and traffic | 2026-09-25 | uncommitted |
| [ENH-10](#enh-10) | P2 | Useful commands: `open`, `start`, `logs -n/--no-follow`, `list --json`, `status --json`, `rm`/`ls` aliases, `--no-start` | 2026-09-25 | uncommitted |
| [ENH-12](#enh-12) | P1 | `--cors`: rewrite Origin/Referer to the target, answer preflights, allow any origin | 2026-09-25 | uncommitted |
| [ENH-11](#enh-11) | P1 | Reliability: readiness-checked start, graceful stop, cert warm-up, no broken log pipe | 2026-09-25 | uncommitted |

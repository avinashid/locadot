# locadot — code guide & work tracker

This folder is the project's working memory. It holds how the code works and every known bug,
enhancement, feature and piece of tech debt. Update it as the work happens.

**Baseline:** 2026-09-24, `main` @ `475b4d0` (v1.5.7). All file:line references in *open* tasks are against this commit
unless a task says otherwise. Part 1 describes the code after the 2026-09-25 reliability and generic-targets work.

| I want to… | Go to |
| --- | --- |
| Understand the code | [Part 1](#part-1--how-locadot-works) |
| Run it locally | [Part 2](#part-2--dev-loop) |
| Fix something broken | [`bugs/bugs.md`](bugs/bugs.md) |
| Improve something that works | [`enhancements/enhancements.md`](enhancements/enhancements.md) |
| Build something new | [`features/features.md`](features/features.md) |
| Clean up the codebase | [`tech-debt/tech-debt.md`](tech-debt/tech-debt.md) |
| File or resolve a task | [Part 3](#part-3--how-the-tracker-works) |

---

## Part 1 — How locadot works

locadot is a CLI that gives any upstream an HTTPS `*.localhost` domain, such as
`https://dev.localhost` → `http://localhost:3350` or `https://google.localhost` → `https://google.com`.
A single background **central proxy** listens on 80 and 443 (loopback only), routes each request by its
`Host` header using a registry of `domain → target`, and serves a read-only dashboard on bare `localhost`.

### Two processes

```
 CLI (dist/index.js)                         Central proxy (dist/core.js, detached)
 ─────────────────────                       ──────────────────────────────────────
 locadot add --host a.localhost --target 3000
   ├─ normalizeHost / parseTarget
   ├─ RegistryStore.mutate (lock + atomic) ──►  chokidar sees the rename → reload() → warm certs
   ├─ running? (JSON pid in lock file)
   │    └─no─► spawn node --no-deprecation dist/core.js  (stdio = log fd)
   │           wait ≤10 s until the proxy writes its lock file  ◄── written after listen()
   └─ probe target, print URL
                                               :443/:80  Host: a.localhost ──► http://localhost:3000
                                               :443/:80  Host: localhost   ──► dashboard (src/dashboard)
```

The CLI never talks to the proxy directly. Everything goes through files in the state dir:
`~/.config/locadot` on Linux, from `appdata-path`, or `$LOCADOT_HOME`. Run `locadot path` to list them.

| File | Written by | Read by | Purpose |
| --- | --- | --- | --- |
| `.locadot-registry.json` | CLI via `RegistryStore.mutate` | proxy (watched) | v2: `{version:2, hosts:{[host]:{target, insecure?, createdAt, updatedAt}}}`. Legacy `{host: port}` is migrated on read. |
| `.locadot-registry.lock` | CLI while mutating | CLI | Write lock (`wx`). Stale after 10 s. |
| `.locadot.lock` | **proxy**, once listening | CLI (`running()`) | JSON `ProxyInfo`: pid, version, ports, bind, stateDir. A legacy bare PID is still accepted. |
| `.locadot.log` (+`.1`) | proxy stdout/stderr (fd) | `logs` | Logs, rotated above 5 MB at start. |
| `certs/locadot-ca.{pem,key}` + per-host leaves | proxy | proxy, `trust` | Persistent CA; leaf per domain via SNI. |
| `startup.json` | `startup:enable` | `startup:status` | Which boot method was installed. |
| `.locadot-token` | proxy at start (0600), removed on stop | `locadot token`, dashboard page (embedded) | Secret for the mutating API (`X-Locadot-Token`). On Windows the mode is ignored; the per-user profile dir protects it. |

Environment: `LOCADOT_HOME`, `LOCADOT_HTTP_PORT`, `LOCADOT_HTTPS_PORT`, `LOCADOT_BIND` (default `127.0.0.1,::1`),
`LOCADOT_LOG_LEVEL`. `LOCADOT_ROLE=proxy` is set internally and switches the logger to timestamps.

### Source map

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Commander definitions (bin `dist/index.js`). `run()` maps `InputError` / `ProxyError` / `RegistryError` to a message and exit 1. `-h` is `--host`; help is `--help`. |
| `src/cli/commands/` | Command handlers, one module per area: `hosts.ts` (add/update/remove/list/clear:hosts), `proxy.ts` (status/start/stop/restart/kill, `--port`/`--https-port`), `doctor.ts`, `files.ts` (logs/path/token), `system.ts` (open/trust/untrust/startup), `tunnel.ts`; `index.ts` merges them into `Commands`. |
| `src/cli/shared.ts` | CLI output (`print`) and `ensureRunning`. |
| `src/lib/proxy-control.ts` | CLI side of the lifecycle: `start` (spawn + readiness wait), `stop` (SIGTERM → SIGKILL), `restart`, `kill`, `ProxyError`. |
| `src/core.ts` → `src/server/` | The proxy process. `index.ts` composes: `state.ts` (registry reload + cert warm-up), `token.ts` (API token), `listeners.ts` (one server per port × bind address, bind error messages), `lifecycle.ts` (shutdown + signals). |
| `src/proxy/` | Per-request proxying. `router.ts` (`handleRequest`/`handleUpgrade`, `RouterContext`: dashboard hosts, 502 for unknown hosts, preflight, pass-through, stats); `request.ts` (`hostOf`, `isTls`, typed per-request tags: tunnel host, via); `options.ts` (http-proxy options, normal and pass-through); `cors.ts` (preflight, `allowOrigin`, `applyCors`, same-origin Origin/Referer); `rewrite.ts` (`originMap`, `rewriteOrigins`, `rewriteBody`); `response.ts` (`proxyRes` pipeline: hop-by-hop headers, --cors rewriting); `stats.ts`; `passthrough.ts` (--cors shim and `/__locadot/x/` pass-through); `tunnel.ts` (cloudflared install, `TunnelManager`). |
| `src/lib/urls.ts` | `formatUrl` / `urlFor`: http(s)://host with the port only when non-default. Use it for every user-facing URL. |
| `src/lib/registry.ts` | `RegistryStore`: parse/migrate, locked atomic `mutate`, corruption backup. |
| `src/lib/localhost.ts` | `normalizeHost`, `requireHost`, `parsePort`, `parseTarget`, `probe`, `InputError`. |
| `src/lib/locadot-file.ts` | Lock file `ProxyInfo` read/write, `isAlive`, `waitForExit`, spawn command. |
| `src/dashboard/` | `index.ts` read routes (`/`, `/api/status`, `/api/hosts`, `/healthz`) and dispatch; `api.ts` guarded mutating routes (hosts CRUD, startup, trust, logs, stop) and `assertTrusted`; `page.ts` control-panel HTML/CSS/JS; `escape.ts`. |
| `src/lib/hosts.ts` | `HostOps` add/update/remove, shared by the CLI and the API so validation is identical. `NotFoundError` / `ConflictError`. |
| `src/lib/system.ts` | `systemStatus()`: root/admin, privileged-port binding, CA trust, startup (cached 30 s). |
| `src/utils/certs.ts` | CA and per-host leaf certificates (`mkcert` npm lib), `SNICallback`. |
| `src/utils/trust.ts` | `trust` / `untrust` / `isCATrusted` per OS, plus NSS on Linux. |
| `src/utils/startup.ts` | `startup:*`: cron (Linux), LaunchAgent (macOS), schtasks (Windows). |
| `src/utils/file.ts` | fs helpers keyed by `Constants.paths`: `read`, `writeAtomic`, directory watcher, tail. |
| `src/utils/logger.ts` | winston console logger. The proxy's console is the log file. |
| `src/constants/` | Paths, ports, bind, messages, error HTML pages. |
| `src/types.ts` | Shared types (`HostEntry`, `Registry`, `ProxyInfo`, `HostStats`, …). |
| `test/` | node:test suites (`pnpm test`). |

Dependency direction: `index.ts` / `cli/` → `lib/`, `proxy/`, `utils/`; `server/` → `proxy/`, `dashboard/`, `lib/`. `lib/`, `proxy/` and `utils/` never import `cli/`, `server/` or `dashboard/` (one exception: `constants/template.ts` uses `dashboard/escape.ts`).

### Invariants worth knowing before you change anything

- Domains must be `*.localhost`, and bare `localhost` / `127.0.0.1` / `::1` is reserved for the dashboard.
  Targets can be anything http(s); the loopback default bind keeps the proxy from being an open relay.
- Any web page can send requests to localhost. Every mutating dashboard route goes through `assertTrusted` (token header, Origin must be bare localhost,
  no `Sec-Fetch-Site: cross-site`, JSON body). New routes must be added to the `known` list in `api.ts` so they get the guard, and must have a rejection test in `test/api.test.ts`.
- Privileged actions from the panel (`trust`, `startup`) must return the equivalent CLI command as `hint` when elevation fails.
- The proxy reads the registry only through the file watcher. It keeps the last good copy if a read fails.
- Only the proxy writes `.locadot.lock`, and only once it's listening. "Lock file has pid X" means "X is serving".
- `start` spawns the compiled `dist/core.js`, **even in dev**. Run `pnpm build` before testing proxy changes.
- Ports 80/443 need root on Linux unless `net.ipv4.ip_unprivileged_port_start` ≤ 80. For testing, use
  `LOCADOT_HTTP_PORT` / `LOCADOT_HTTPS_PORT` and a temp `LOCADOT_HOME`.

---

## Part 2 — Dev loop

```bash
pnpm install
pnpm build                                   # tsc → dist/; required, the CLI spawns dist/core.js
pnpm test                                    # unit + e2e on spare ports with a temp LOCADOT_HOME
export LOCADOT_HOME=$(mktemp -d) LOCADOT_HTTP_PORT=18080 LOCADOT_HTTPS_PORT=18443
node dist/index.js add --host app.localhost --port 3000
node dist/index.js add --host google.localhost --target https://google.com
curl --cacert $LOCADOT_HOME/certs/locadot-ca.pem https://app.localhost:18443/
node dist/index.js status && node dist/index.js doctor
node dist/index.js logs -n 20 --no-follow
node dist/index.js kill                      # stop + clear hosts + clear logs
```

Every fix must add or extend a test in `test/` where practical, and must say in its task entry how it was verified.

---

## Part 3 — How the tracker works

### Layout

```
tasks/
├── README.md                     ← this file: code guide + process
├── bugs/bugs.md                  ← BUG-xx   something is wrong
├── enhancements/enhancements.md  ← ENH-xx   something works but should work better
├── features/features.md          ← FEAT-xx  something new
├── tech-debt/tech-debt.md        ← TD-xx    internal quality; no user-visible change
└── templates/                    ← copy-paste entry templates, one per type
```

Each type file has a **registry table** at the top, which holds status for every item. **Detail sections**
follow, one `### ID` heading per item so it can be linked as `bugs/bugs.md#bug-03`. A **Resolved** table sits
at the bottom. Split a type into more files (`bugs/proxy-bugs.md`) only when one file passes about 30 items.

### Which type is it?

| It is a… | if… |
| --- | --- |
| **Bug** | behaviour contradicts the README, a command's own message, or obvious intent. Includes security issues. |
| **Enhancement** | behaviour is correct but could be clearer, safer, faster or friendlier. |
| **Feature** | a capability that doesn't exist yet: a new command, new platform support, a new mode. |
| **Tech debt** | users wouldn't notice, but contributors would: tests, types, deps, structure, CI. |

### IDs

`BUG-01`, `ENH-01`, `FEAT-01`, `TD-01`. Take the next number in the file, zero-padded to two digits. **Never
reuse or renumber an ID**, even after an item is resolved or dropped. Commits, PRs and other entries refer
to it.

### Priority

| | Meaning |
| --- | --- |
| **P0** | Data loss, security hole that's reachable today, or locadot unusable for everyone. Drop other work. |
| **P1** | A core command (`add` / `update` / `stop` / HTTPS) is broken or misleading for common setups. |
| **P2** | Wrong behaviour with a workaround, or only in some setups/platforms. |
| **P3** | Cosmetic, rare, or nice-to-have. |

### Status lifecycle

```
Open ──► In progress ──► Resolved
  │           │
  └──► Blocked (say on what) / Won't fix (say why)
```

Status lives in the registry table. The detail section holds evidence, fix notes and verification.

### Workflows

**Filing** a bug, enhancement, feature or debt item:
1. Copy the template from `templates/` into the right file, under the last detail section.
2. Give it the next ID and add a row to the registry table (status `Open`).
3. Include `file:line` and the commit it was observed on. For a bug, include a repro, or say plainly "found by
   reading, not reproduced".

**Picking up** an item:
1. Set status `In progress` in the table. Name a branch after the ID: `fix/bug-03-update-check`,
   `feat/feat-02-doctor`.
2. If it depends on another item, check the **Depends on** field first.

**Resolving** an item:
1. Fix it. Reference the ID in the commit subject: `fix(BUG-03): check registry, not target port, in update`.
2. In the detail section, fill in **Resolution**: what changed, the commit hash, and **how it was verified**.
3. Move the row from the registry table to the **Resolved** table with the date and commit.
4. Update the counts line at the top of the file.
5. If the fix changed behaviour described in Part 1 above, or in the root `README.md`, update those too.

**Definition of done:** `npx tsc --noEmit` passes, the repro no longer reproduces (or the new test passes),
the registry row has moved, and the Resolution field names the commit and the verification.

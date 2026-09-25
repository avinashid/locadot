# Tech debt

Internal quality: users won't notice it, but contributors will.
Process: [`../README.md#part-3--how-the-tracker-works`](../README.md#part-3--how-the-tracker-works) · Template: [`../templates/tech-debt.md`](../templates/tech-debt.md)

**Baseline:** 2026-09-24, `main` @ `475b4d0` · **1 open · 5 resolved**

| ID | P | Title | Status |
| --- | --- | --- | --- |
| [TD-02](#td-02) | P2 | No CI, no `prepublishOnly` build | Open |

---

### TD-01
**No tests** · P1 · Resolved

**Today:** The only check is `npx tsc --noEmit`. Every bug in `bugs/bugs.md` would have been caught by a small unit test.

**Proposed:** Add `vitest`. First targets, in order:
1. `Localhost.isValidLocalhostDomain`: a table of good and bad hosts.
2. `HttpModule.requestHandler` against a throwaway `http.createServer` target. Covers mapped, unmapped (BUG-04)
   and a hostile `Host` (BUG-05).
3. Registry read/write against a temp app-data dir. This needs `Constants.paths` to be injectable, for example
   via a `LOCADOT_HOME` env override.

Add a `pnpm test` script, and make it part of the definition of done in `../README.md`.

**Depends on:** —

**Resolution:** 2026-09-25. `test/*.test.ts` (node:test + tsx) covers target parsing, validation, the registry (migration, locking, corruption), lock-file parsing, escaping, and an end-to-end proxy on spare ports. Run it with `pnpm test`.

---

### TD-02
**No CI, no `prepublishOnly` build** · P2 · Open

**Today:** Publishing relies on remembering to run `pnpm build`. Nothing checks PRs.

**Proposed:** A GitHub Actions workflow that runs `pnpm install`, `tsc --noEmit` and `pnpm test` on
Node LTS × {ubuntu, macos, windows}. Add `"prepublishOnly": "pnpm build"`.

**Depends on:** TD-01 (for the test step)

**Resolution:** —

---

### TD-03
**Dependency hygiene** · P3 · Resolved

**Where:** `package.json`

- `@types/http-proxy` and `@types/yargs` are runtime `dependencies`, so every `npx` user installs them. Move them to
  `devDependencies`. `yargs` isn't used at all, so drop its types.
- `"https": "^1.0.0"` is a placeholder npm package. Node's core `https` module is what actually gets
  imported. Remove it.
- `@types/node` is missing, so types currently come in transitively.
- `pnpm-lock.yaml` is git-ignored, which makes installs non-reproducible. Commit it.

**Depends on:** —

**Resolution:** 2026-09-25. `@types/*` moved to devDependencies. Removed the unused `@types/yargs` and the npm `https` shim. Added `@types/node`.

---

### TD-04
**Dead code, unused imports, commented-out blocks** · P3 · Resolved

**Where:** `tsc --noUnusedLocals` reports `src/lib/commands.ts:4` (`logger`) and `src/utils/certs.ts:2`
(`WriteStream`). Commented-out blocks are at `src/proxy.ts:40-43`, `src/lib/http.ts:24-30` and `src/lib/http.ts:89-93`.

**Proposed:** Remove them, and turn on `noUnusedLocals` / `noUnusedParameters` in `tsconfig.json`.

**Depends on:** —

**Resolution:** 2026-09-25. Unused imports, `hasCommand`, a `require` hack and the commented-out blocks were removed. `tsc --noUnusedLocals` is clean.

---

### TD-05
**`file.ts` helpers: misleading names, repeated setup, side-effecting reads** · P3 · Resolved

**Where:** `src/utils/file.ts`

- `writeFileSync` / `readFileSync` / `removeFileSync` are declared `async` but are synchronous. Callers `await`
  some of them and not others (`locadot-file.ts:38,41,46,51`).
- The "ensure folder, ensure file" block is copy-pasted four times.
- Reading creates the file (the root of BUG-11).

**Proposed:** Add one `ensureDir()` helper, honest names, and reads that don't write.

**Depends on:** —

**Resolution:** 2026-09-25. `src/utils/file.ts` rewritten: `read` never creates files, `writeAtomic`, `ensureDir` is done once, and the watcher watches the directory so atomic renames are seen.

---

### TD-06
**Import-time side effects and mixed `console` / `logger` output** · P3 · Resolved

**Where:** `src/utils/startup.ts:10` resolves the start command at import time. The CLI mixes `console.*` and
`logger.*`. The `logger` File transport means every CLI invocation (even `path`) opens the proxy's log file.

**Proposed:** Resolve lazily. Use one output helper for user-facing CLI messages, and keep the file logger for the proxy process only.

**Depends on:** —

**Resolution:** 2026-09-25. Importing a module no longer creates files or spawns anything. The CLI logs bare messages and the proxy logs with timestamps, both through one logger (`src/utils/logger.ts`).

---

## Resolved

| ID | P | Title | Resolved | Commit |
| --- | --- | --- | --- | --- |
| [TD-01](#td-01) | P1 | No tests | 2026-09-25 | uncommitted |
| [TD-03](#td-03) | P3 | Dependency hygiene | 2026-09-25 | uncommitted |
| [TD-04](#td-04) | P3 | Dead code, unused imports, commented-out blocks | 2026-09-25 | uncommitted |
| [TD-05](#td-05) | P3 | `file.ts` helpers: misleading names, repeated setup, side-effecting reads | 2026-09-25 | uncommitted |
| [TD-06](#td-06) | P3 | Import-time side effects and mixed `console` / `logger` output | 2026-09-25 | uncommitted |

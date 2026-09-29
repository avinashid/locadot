import { escapeHtml } from "./escape";

// All data on the page is populated client-side via /api/status + /api/hosts
// (and mutated via /api/*) and rendered with DOM APIs (never innerHTML), so
// nothing server-supplied besides the per-response nonce and the auth token
// is interpolated into this markup.
const lightVars = `
  --bg: #f6f7f9;
  --surface: #ffffff;
  --surface-2: #f4f5f7;
  --surface-3: #eceef1;
  --border: #e5e7eb;
  --border-strong: #d4d8de;
  --fg: #111318;
  --fg-2: #3a3f47;
  --muted: #6b7280;
  --muted-dim: #9ca3af;
  --accent: #2563eb;
  --accent-strong: #1d4ed8;
  --accent-bg: rgba(37, 99, 235, 0.09);
  --accent-fg: #ffffff;
  --up: #16a34a;
  --up-bg: rgba(22, 163, 74, 0.1);
  --down: #dc2626;
  --down-bg: rgba(220, 38, 38, 0.08);
  --warn: #d97706;
  --warn-bg: rgba(217, 119, 6, 0.1);
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.05);
  --shadow-md: 0 12px 32px rgba(16, 24, 40, 0.14);
  color-scheme: light;
`;

const css = `
:root {
  --bg: #0a0b0d;
  --surface: #121417;
  --surface-2: #181b1f;
  --surface-3: #1f2329;
  --border: #23272e;
  --border-strong: #2f343c;
  --fg: #ededef;
  --fg-2: #c9cdd3;
  --muted: #8a9099;
  --muted-dim: #5c626c;
  --accent: #3b82f6;
  --accent-strong: #60a5fa;
  --accent-bg: rgba(59, 130, 246, 0.14);
  --accent-fg: #ffffff;
  --up: #22c55e;
  --up-bg: rgba(34, 197, 94, 0.14);
  --down: #ef4444;
  --down-bg: rgba(239, 68, 68, 0.14);
  --warn: #f59e0b;
  --warn-bg: rgba(245, 158, 11, 0.14);
  --focus: var(--accent-strong);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 12px 32px rgba(0, 0, 0, 0.45);
  --radius: 12px;
  --radius-sm: 8px;
  --radius-xs: 6px;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  color-scheme: dark;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", sans-serif;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {${lightVars}}
}
:root[data-theme="light"] {${lightVars}}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  font-family: var(--sans);
  font-size: 14px;
  color: var(--fg);
  line-height: 1.5;
  background: var(--bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
.mono { font-family: var(--mono); }
a { color: var(--accent); text-decoration: none; }
a:hover, a:focus-visible { text-decoration: underline; }
button, input { font-family: inherit; }
*:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  border-radius: 4px;
}
.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.clip-helper { position: absolute; left: -9999px; top: -9999px; }
.muted { color: var(--muted); }
.dim { color: var(--muted-dim); }
.label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* ---------- top bar ---------- */
header {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.topbar {
  max-width: 1360px;
  margin: 0 auto;
  padding: 0 32px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.logo {
  width: 24px; height: 24px;
  border-radius: 7px;
  background: var(--accent);
  position: relative;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}
.logo::after {
  content: "";
  position: absolute;
  left: 8px; top: 8px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #fff;
}
.wordmark {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
  color: var(--fg);
}
#version { font-size: 12px; color: var(--muted); }
.header-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.btn.theme-toggle { width: 28px; height: 28px; padding: 0; border-radius: 999px; color: var(--muted); flex-shrink: 0; }
.btn.theme-toggle:hover { color: var(--fg); }
.theme-toggle svg { width: 15px; height: 15px; flex-shrink: 0; display: none; }
.theme-toggle[data-mode="system"] .i-system, .theme-toggle[data-mode="light"] .i-light, .theme-toggle[data-mode="dark"] .i-dark { display: block; }
#updated { color: var(--muted-dim); font-size: 12px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
.chip:empty { display: none; }
.chip-live { color: var(--fg-2); font-weight: 500; }
.live-dot {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--muted-dim);
}
.live-dot.up { background: var(--up); box-shadow: 0 0 0 3px var(--up-bg); }
.live-dot.down { background: var(--down); box-shadow: 0 0 0 3px var(--down-bg); }
body.offline .live-label { color: var(--down); }

/* ---------- sidebar ---------- */
:root { --sb-w: 232px; }
:root[data-sidebar="collapsed"] { --sb-w: 64px; }
.sidebar {
  position: fixed;
  top: 0; bottom: 0; left: 0;
  z-index: 7;
  width: var(--sb-w);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
  transition: width 0.18s ease, transform 0.2s ease;
}
.shell { margin-left: var(--sb-w); min-height: 100vh; transition: margin-left 0.18s ease; }
.sb-head { height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; white-space: nowrap; }
.sb-links { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 12px 10px; display: flex; flex-direction: column; gap: 2px; }
.sb-section { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-dim); padding: 14px 12px 6px; white-space: nowrap; }
.sb-link {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--muted);
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.sb-link:hover { background: var(--surface-2); color: var(--fg); text-decoration: none; }
.sb-link[aria-current] { background: var(--accent-bg); color: var(--accent-strong); }
.sb-link svg { width: 18px; height: 18px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.sb-count { margin-left: auto; font-size: 11px; font-weight: 600; min-width: 20px; height: 18px; padding: 0 6px; border-radius: 999px; background: var(--surface-3); color: var(--fg-2); display: inline-flex; align-items: center; justify-content: center; }
.sb-collapse { margin: 8px 10px 12px; width: auto; flex-shrink: 0; }
.sb-collapse svg { transition: transform 0.18s ease; }
.sb-signout { margin-bottom: 0; }
.sb-signout[hidden] { display: none; }
:root[data-sidebar="collapsed"] .sb-label { display: none; }
:root[data-sidebar="collapsed"] .sb-head { padding: 0; justify-content: center; }
:root[data-sidebar="collapsed"] .sb-link { justify-content: center; padding: 0; }
:root[data-sidebar="collapsed"] .sb-collapse svg { transform: scaleX(-1); }
:root[data-sidebar="collapsed"] .sb-links { padding-top: 12px; }
.sb-menu, .brand-mobile { display: none; }
.btn.sb-menu { display: none; width: 32px; height: 32px; padding: 0; color: var(--muted); }
.sb-menu svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.sb-backdrop { position: fixed; inset: 0; z-index: 6; background: rgba(0, 0, 0, 0.45); }
.card, details.card { scroll-margin-top: 76px; }
@media (max-width: 899px) {
  :root, :root[data-sidebar="collapsed"] { --sb-w: 0px; }
  .sidebar { width: 260px; transform: translateX(-100%); box-shadow: none; visibility: hidden; transition: transform 0.2s ease, visibility 0s linear 0.2s; }
  body.sb-open .sidebar { transform: none; box-shadow: var(--shadow-md); visibility: visible; transition: transform 0.2s ease; }
  :root[data-sidebar="collapsed"] .sb-label { display: revert; }
  :root[data-sidebar="collapsed"] .sb-count { display: inline-flex; }
  :root[data-sidebar="collapsed"] .sb-head { padding: 0 20px; justify-content: flex-start; }
  :root[data-sidebar="collapsed"] .sb-link { justify-content: flex-start; padding: 0 12px; }
  .sb-collapse { display: none; }
  .btn.sb-menu { display: inline-flex; }
  .brand-mobile { display: inline-block; }
  span.wordmark.brand-mobile { display: inline; }
}

/* ---------- page layout ---------- */
main {
  max-width: 1360px;
  margin: 0 auto;
  padding: 32px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.page-head { display: flex; flex-direction: column; gap: 4px; }
.page-title { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 0; line-height: 1.25; }
.page-sub { margin: 0; color: var(--muted); font-size: 14px; }
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.col-primary, .col-secondary { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
@media (min-width: 1100px) {
  .layout { grid-template-columns: minmax(0, 1fr) 340px; }
}
@media (min-width: 1400px) {
  .layout { grid-template-columns: minmax(0, 1fr) 372px; }
}

/* ---------- cards ---------- */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.card-title-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
.card-title { font-size: 15px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
.card-desc { margin: 2px 0 0; font-size: 12.5px; color: var(--muted); }
.card-tools { display: flex; align-items: center; gap: 8px; }
.card-body { padding: 20px; }
.card-body-tight { padding: 8px 0; }

/* ---------- badges ---------- */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.01em;
  white-space: nowrap;
  border: 1px solid var(--border-strong);
  background: var(--surface-2);
  color: var(--fg-2);
}
.badge-warn { color: var(--warn); border-color: transparent; background: var(--warn-bg); }
.badge-cors, .badge-accent { color: var(--accent); border-color: transparent; background: var(--accent-bg); }
.badge-up { color: var(--up); border-color: transparent; background: var(--up-bg); }
.badge-down { color: var(--down); border-color: transparent; background: var(--down-bg); }
.badge-count { font-family: var(--mono); color: var(--muted); }
.badges { display: flex; flex-wrap: wrap; gap: 4px; }
td.badges { display: table-cell; }
td.badges .badge + .badge { margin-left: 4px; }

/* ---------- buttons ---------- */
.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease, color 0.15s ease;
}
.btn:hover:not(:disabled) { background: var(--surface-2); border-color: var(--muted-dim); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
.btn-sm.btn-icon { width: 28px; padding: 0; color: var(--muted); }
.btn-icon svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.btn-icon.is-set { color: var(--accent); border-color: transparent; background: var(--accent-bg); }
.btn-block { width: 100%; }
.btn-primary { border-color: var(--accent); background: var(--accent); color: var(--accent-fg); }
.btn-primary:hover:not(:disabled) { background: var(--accent-strong); border-color: var(--accent-strong); }
.btn-danger { border-color: var(--down); color: var(--down); background: transparent; }
.btn-danger:hover:not(:disabled) { background: var(--down-bg); border-color: var(--down); }
.btn-ghost { background: transparent; border-color: transparent; box-shadow: none; color: var(--muted); }
.btn-ghost:hover:not(:disabled) { background: var(--surface-2); border-color: transparent; color: var(--fg); }
.btn-ghost-danger { background: transparent; border-color: transparent; box-shadow: none; color: var(--muted); }
.btn-ghost-danger:hover:not(:disabled) { color: var(--down); background: var(--down-bg); border-color: transparent; }
.row-actions { display: flex; gap: 6px; justify-content: flex-end; }
.row-actions .btn-danger:not(:hover):not(:focus-visible) { border-color: var(--border-strong); color: var(--muted); }
.btn.busy { opacity: 0.7; cursor: wait; }
.btn.busy, #ca-toggle.busy, #startup-toggle.busy { color: transparent !important; pointer-events: none; }
.btn.busy::after {
  content: "";
  position: absolute;
  width: 13px; height: 13px;
  top: 50%; left: 50%;
  margin: -6.5px 0 0 -6.5px;
  border-radius: 50%;
  border: 2px solid rgba(127, 127, 127, 0.35);
  border-top-color: var(--accent-strong);
  animation: spin 0.7s linear infinite;
}
.btn-primary.busy::after { border-color: rgba(255, 255, 255, 0.35); border-top-color: #fff; }
.copy-btn {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.copy-btn:hover { color: var(--fg); border-color: var(--muted-dim); }

/* ---------- switch ---------- */
.switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--border-strong);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.switch .switch-knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease, background 0.15s ease;
}
.switch.on { background: var(--accent); }
.switch.on .switch-knob { transform: translateX(16px); }
.switch.busy { opacity: 0.6; cursor: wait; }
.switch:disabled { cursor: not-allowed; opacity: 0.5; }
.switch.busy .switch-knob { opacity: 0; }
.switch.busy::after {
  content: "";
  position: absolute;
  top: 2px; left: 10px;
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  animation: spin 0.7s linear infinite;
}
body.offline .switch, body.offline #add-submit { opacity: 0.5; pointer-events: none; }

/* ---------- inputs ---------- */
.input, .field input[type="text"], .edit-input {
  height: 36px;
  width: 100%;
  padding: 0 12px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--fg);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.input::placeholder, .field input::placeholder { color: var(--muted-dim); }
.input:focus-visible, .field input[type="text"]:focus-visible, .edit-input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}
.input-sm { height: 30px; font-size: 12px; padding: 0 10px; font-family: var(--sans); }
.input-search { width: 200px; max-width: 100%; }
.field input.invalid, .edit-input.invalid { border-color: var(--down); }
.field input.invalid:focus-visible, .edit-input.invalid:focus-visible { box-shadow: 0 0 0 3px var(--down-bg); }
.edit-input { height: 30px; min-width: 0; padding: 0 10px; }
input[type="checkbox"] { accent-color: var(--accent); width: 15px; height: 15px; margin: 0; }
select.input, .field select {
  height: 36px;
  width: 100%;
  padding: 0 30px 0 12px;
  font-family: var(--sans);
  font-size: 13px;
  color: var(--fg);
  background-color: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 16px) center, calc(100% - 11px) center;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}
select.input:focus-visible, .field select:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}
select.input-sm { height: 28px; font-size: 12px; padding: 0 24px 0 8px; background-position: calc(100% - 10px) center, calc(100% - 6px) center; }

/* ---------- add host form ---------- */
.form-grid { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.field label { font-size: 12.5px; color: var(--fg-2); font-weight: 500; }
.form-checks { display: flex; flex-wrap: wrap; gap: 8px 18px; padding-top: 2px; }
.field-checkbox { flex-direction: row; align-items: center; gap: 8px; }
.field-checkbox label { font-size: 13px; color: var(--fg-2); font-weight: 400; cursor: pointer; }
.field-error {
  font-size: 13px;
  color: var(--down);
  background: var(--down-bg);
  border: 1px solid var(--down);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* ---------- system list ---------- */
.stat-list { display: flex; flex-direction: column; }
.stat-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}
.stat-row:last-child { border-bottom: none; }
.stat-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.stat-side { flex-shrink: 0; padding-top: 2px; }
.tile-value { font-size: 14px; font-weight: 600; color: var(--fg); }
.tile-value.ok { color: var(--up); }
.tile-value.warn { color: var(--warn); }
.tile-sub { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.tile-sub.mono { font-size: 11.5px; }
.tile-hint { font-size: 12px; color: var(--warn); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.tile-hint code { overflow-wrap: anywhere; }
.tile-actions { margin-top: 10px; }

/* ---------- hosts table ---------- */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; min-width: 720px; }
th, td {
  text-align: left;
  padding: 12px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  white-space: nowrap;
  vertical-align: middle;
}
th:first-child, td:first-child { padding-left: 20px; }
th:last-child, td:last-child { padding-right: 20px; }
th {
  color: var(--muted);
  font-weight: 500;
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: var(--surface-2);
  padding-top: 9px;
  padding-bottom: 9px;
}
th.num, td.num { text-align: right; }
th.actions { text-align: right; }
tbody tr { transition: background 0.15s ease; }
tbody tr:hover { background: var(--surface-2); }
tbody tr:last-child td { border-bottom: none; }
tbody tr:last-child td:first-child { border-bottom-left-radius: var(--radius); }
tbody tr:last-child td:last-child { border-bottom-right-radius: var(--radius); }
#table th:nth-child(2), #table td.arrow { display: none; }
#table tbody td { padding-top: 10px; padding-bottom: 10px; }
.host-cell { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.host-cell a { color: var(--fg); }
.host-cell a:hover { color: var(--accent); }
.host-target, .traffic { font-size: 12px; color: var(--muted); margin-top: 3px; font-family: var(--mono); }
.host-target { max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.host-td .edit-input { margin-top: 6px; width: 100%; min-width: 150px; }
.host-cell .copy-btn, .tunnel-status .copy-btn { opacity: 0; transition: opacity 0.12s ease; }
tbody tr:hover .copy-btn, .copy-btn:focus-visible, #table tbody td:hover .copy-btn { opacity: 1; }
tr.row-down td:first-child { box-shadow: inset 3px 0 0 var(--down); }
.pill { display: inline-flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 12px; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--muted-dim); }
.dot.up { background: var(--up); box-shadow: 0 0 0 3px var(--up-bg); }
.dot.down { background: var(--down); box-shadow: 0 0 0 3px var(--down-bg); }
.dot.warn { background: var(--warn); box-shadow: 0 0 0 3px var(--warn-bg); }
.dot.accent { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.edit-hint { font-size: 12px; }
td.edit-error { color: var(--down); white-space: normal; }
td .inline-check + .inline-check { margin-top: 4px; }
.inline-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.tunnel-cell { white-space: normal; }
.tunnel-status { display: flex; align-items: center; gap: 6px; max-width: 240px; }
.tunnel-status a { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; display: inline-block; vertical-align: middle; font-size: 12px; }
.tunnel-error { color: var(--down); cursor: help; }
.tunnel-error-text {
  color: var(--down);
  cursor: help;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 170px;
  display: inline-block;
  vertical-align: middle;
  font-size: 12px;
}
.spinner {
  display: inline-block;
  width: 12px; height: 12px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty {
  padding: 40px 24px;
  color: var(--muted);
  text-align: center;
  font-size: 13.5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.empty p { margin: 0; }
.empty-icon {
  width: 40px; height: 40px;
  border-radius: 10px;
  border: 1px dashed var(--border-strong);
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-dim);
  font-size: 18px;
}
#hosts-error .empty-icon { color: var(--down); border-color: var(--down); background: var(--down-bg); }
.empty pre { display: inline-block; text-align: left; }

pre.code-block {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.55;
  color: var(--fg-2);
  margin: 0;
}
.cli-list { display: flex; flex-direction: column; gap: 16px; }
.cli-item { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cli-item-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

/* ---------- remote access ---------- */
.hub-section { padding: 16px 20px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
.hub-section:first-child { border-top: none; }
.hub-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hub-url { font-family: var(--mono); font-size: 12.5px; word-break: break-all; color: var(--fg-2); }
.hub-warn { font-size: 12px; color: var(--warn); background: var(--warn-bg); border-radius: var(--radius-sm); padding: 6px 10px; }
.hub-actions, .invite-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.hub-form-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.hub-form-row .field { flex: 1; min-width: 140px; }
.invite-result { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.invite-result-row { display: flex; align-items: center; gap: 8px; }
.invite-string { font-family: var(--mono); font-size: 11.5px; word-break: break-all; flex: 1; min-width: 0; }
.invite-countdown { font-family: var(--mono); font-size: 12px; color: var(--muted); white-space: nowrap; }
.host-checks { display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px 10px; }
.host-checks[hidden] { display: none; }
.host-checks label { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--fg-2); cursor: pointer; }
.peer-list, .invite-list, .remote-list { display: flex; flex-direction: column; }
.remote-list:not(:empty) { padding: 0 20px 12px; }
.peer-row, .invite-row, .remote-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.peer-row:last-child, .invite-row:last-child, .remote-item:last-child { border-bottom: none; }
.peer-main, .remote-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.peer-name { font-weight: 500; font-size: 13px; }
.peer-controls, .remote-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.remote-item { flex-direction: column; align-items: stretch; }
.remote-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.remote-hosts-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.remote-host-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 6px 0; border-top: 1px solid var(--border); }
.remote-host-row:first-child { border-top: none; }
.badge-role { text-transform: capitalize; }
.remote-card-body { display: flex; flex-direction: column; gap: 14px; }
.mini-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.mini-form input { flex: 1; min-width: 90px; }
.host-cell .badge-via { margin-left: 4px; }

/* ---------- banners ---------- */
.banner {
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 13.5px;
  border: 1px solid var(--down);
  background: var(--down-bg);
  color: var(--fg);
}
.banner-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.banner .btn { background: var(--surface); }

/* ---------- logs ---------- */
details.card summary {
  cursor: pointer;
  list-style: none;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-radius: var(--radius);
}
details.card summary::-webkit-details-marker { display: none; }
details.card summary .card-title { display: flex; align-items: center; gap: 8px; }
details.card summary .card-title::before {
  content: "";
  width: 6px; height: 6px;
  border-right: 1.5px solid var(--muted);
  border-bottom: 1.5px solid var(--muted);
  transform: rotate(-45deg);
  transition: transform 0.15s ease;
  margin-right: 2px;
}
details.card[open] summary .card-title::before { transform: rotate(45deg); }
details.card[open] summary { border-bottom: 1px solid var(--border); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.logs-body { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
.logs-actions { display: flex; gap: 8px; }
.logs-box {
  height: 280px;
  overflow-y: auto;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.55;
  color: var(--fg-2);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

/* ---------- allow dialog ---------- */
#allow-dialog {
  width: min(520px, calc(100vw - 32px));
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--fg);
  box-shadow: var(--shadow-md);
}
#allow-dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.modal-title { font-size: 15px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
.modal-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--muted); }
.modal-close { width: 28px; height: 28px; padding: 0; border-radius: 999px; flex-shrink: 0; }
.modal-close svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.modal-desc { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
.modal-warn {
  font-size: 12.5px;
  color: var(--warn);
  background: var(--warn-bg);
  border: 1px solid var(--warn);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  line-height: 1.5;
}
.allow-list { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; }
.allow-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
.allow-row span { font-size: 13px; word-break: break-all; }
.allow-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 15px;
  line-height: 1;
  border-radius: var(--radius-xs);
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
}
.allow-remove:hover { color: var(--down); background: var(--down-bg); border-color: transparent; }
.allow-empty { font-size: 13px; padding: 4px 0; }
.allow-add-row { display: flex; gap: 8px; }
.allow-add-row .input { flex: 1; }
.allow-add-row .btn { height: auto; align-self: stretch; padding: 0 14px; }
.modal-hint { margin: 0; font-size: 12px; color: var(--muted-dim); }
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

/* ---------- toasts ---------- */
.toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
}
.toast {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-left: 3px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: 13px;
  box-shadow: var(--shadow-md);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast.show { opacity: 1; transform: translateY(0); }
.toast-success { border-left-color: var(--up); }
.toast-error { border-left-color: var(--down); }
.toast-warn { border-left-color: var(--warn); }
.toast-hint { margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toast-hint code { font-size: 11.5px; color: var(--fg); }

/* ---------- skeleton / boot ---------- */
@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
body.boot .tile-value,
body.boot .tile-sub,
body.boot #version,
body.boot #uptime,
body.boot #pid {
  color: transparent !important;
  display: inline-block;
  min-width: 70px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--border-strong) 37%, var(--surface-2) 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
}
body.boot #updated { visibility: hidden; }
body.boot #stop-proxy-btn, body.offline #stop-proxy-btn { display: none; }
.skel-bar {
  display: block;
  width: 80%;
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--border-strong) 37%, var(--surface-2) 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
}
#hosts-skeleton table { min-width: 0; }
.skeleton-row td { border-bottom: 1px solid var(--border); padding: 17px 20px; }
.skeleton-row:nth-child(1) .skel-bar { width: 92%; }
.skeleton-row:nth-child(2) .skel-bar { width: 70%; }
.skeleton-row:nth-child(3) .skel-bar { width: 82%; }

footer { text-align: center; padding: 8px 20px 32px; color: var(--muted-dim); font-size: 12px; }
footer a { color: var(--muted); }
[hidden] { display: none !important; }


/* ---------- pages ---------- */
.view { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (min-width: 1100px) { .tiles { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
.tile { display: flex; flex-direction: column; gap: 4px; padding: 16px 18px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-sm); color: var(--fg); min-width: 0; transition: border-color 0.15s ease; }
.tile:hover { border-color: var(--border-strong); text-decoration: none; }
.tile-big { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
.tile-big.tile-word { font-size: 18px; line-height: 1.8; }
.tile-big.ok { color: var(--up); }
.tile-big.bad { color: var(--down); }
.tile-big.warn { color: var(--warn); }
.tile .tile-sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.grid-2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; align-items: start; }
@media (min-width: 1000px) { .grid-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.ov-list { display: flex; flex-direction: column; }
.ov-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--border); min-width: 0; }
.ov-row:last-child { border-bottom: none; }
.ov-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ov-title { font-family: var(--mono); font-size: 13px; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ov-checks .ov-title { font-family: var(--sans); }
.ov-sub { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-side { display: flex; align-items: center; gap: 8px; flex-shrink: 0; font-size: 12px; color: var(--muted); }
.ov-side a.ov-link { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--mono); }
.ov-more { padding: 10px 20px; font-size: 12.5px; }
.logs-full { height: calc(100vh - 290px); min-height: 320px; max-height: none; margin: 0; border-radius: 0; border: 0; border-top: 1px solid var(--border); }
.logs-short { height: auto; max-height: 220px; margin: 0; border-radius: 0 0 var(--radius) var(--radius); border: 0; }
.logs-head { flex-wrap: wrap; gap: 10px; }
.logs-tools { flex-wrap: wrap; gap: 8px; flex: 1; min-width: 0; }
.logs-tools .input { width: auto; }
.logs-tools select.input { padding-right: 28px; }
.logs-tools .input-search { width: 220px; }
.logs-meta { padding: 8px 20px; font-size: 12px; border-top: 1px solid var(--border); }
.check-inline { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--fg-2); cursor: pointer; }
select.input { padding-right: 8px; cursor: pointer; }
.segmented { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.segmented button { border: 0; background: var(--surface); color: var(--muted); font-size: 12.5px; padding: 6px 12px; cursor: pointer; }
.segmented button + button { border-left: 1px solid var(--border); }
.segmented button[aria-checked="true"] { background: var(--accent-bg); color: var(--accent-strong); font-weight: 600; }
.form-row-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 10px; }
.form-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
#ports-form .hub-warn { margin-top: 12px; }
.token-body { display: flex; flex-direction: column; gap: 12px; }
.token-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.token-value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; padding: 6px 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-xs); }
.help-list { display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: var(--fg-2); }
.help-list p { margin: 0; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.remote-local { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.remote-local a { font-family: var(--mono); font-size: 13px; }
.role-table { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.role-table div { display: flex; gap: 10px; padding: 8px 12px; font-size: 12.5px; }
.role-table div + div { border-top: 1px solid var(--border); }
.role-table strong { width: 56px; flex-shrink: 0; }
.role-table span { color: var(--muted); }
.danger-card { border-color: var(--down-bg); }
.danger-card .card-title { color: var(--down); }
.sb-dot { margin-left: auto; }
input.input[type="number"] { font-family: var(--mono); }

/* ---------- responsive ---------- */
@media (min-width: 1200px) {
  th, td { padding-left: 10px; padding-right: 10px; }
  .tunnel-status .copy-btn { display: none; }
  .tunnel-status a { max-width: 150px; }
  .host-target { max-width: 200px; }
}
@media (min-width: 1200px) and (max-width: 1399px) {
  .tunnel-status a { max-width: 110px; }
  .host-target { max-width: 170px; }
}
@media (max-width: 1099px) {
  .topbar, main { padding-left: 24px; padding-right: 24px; }
}
@media (min-width: 700px) and (max-width: 1099px) {
  .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 641px) and (max-width: 899px), (min-width: 1100px) and (max-width: 1279px) {
  #table tbody { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  #table tbody tr:nth-child(odd) { border-right: 1px solid var(--border); }
  #table tbody tr:nth-last-child(2):nth-child(odd) { border-bottom: none; }
}
@media (max-width: 899px), (min-width: 1100px) and (max-width: 1279px) {
  #table { min-width: 0; }
  #table thead { display: none; }
  #table, #table tbody, #table tr { display: block; width: 100%; }
  #table tr { padding: 14px 20px; border-bottom: 1px solid var(--border); }
  #table tr:last-child { border-bottom: none; }
  #table td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 5px 0; border: none; white-space: normal; text-align: right; min-width: 0; }
  #table td::before { content: attr(data-label); color: var(--muted); font-size: 12px; flex-shrink: 0; text-align: left; }
  #table td[data-label=""]::before { content: none; }
  #table td[data-label=""]:first-child { padding-bottom: 8px; justify-content: flex-start; font-weight: 600; }
  #table td.host-td, #table td.status-td { flex-direction: column; align-items: flex-start; gap: 0; }
  #table td.status-td { align-items: flex-end; }
  #table td.status-td::before { align-self: flex-start; margin-bottom: 4px; }
  #table td.host-td .edit-input { margin-top: 8px; }
  .host-target { max-width: 100%; }
  .host-cell .copy-btn, .tunnel-status .copy-btn { opacity: 1; }
  #table td[data-label=""] { justify-content: flex-end; padding-top: 10px; }
  #table .edit-input { min-width: 0; }
  tr.row-down td:first-child { box-shadow: none; }
  tr.row-down { box-shadow: inset 3px 0 0 var(--down); }
  .tunnel-status, .tunnel-status a, .tunnel-error-text { max-width: 100%; min-width: 0; }
  .tunnel-status { justify-content: flex-end; flex: 0 1 auto; }
  .tunnel-status a { flex: 0 1 auto; }
}
@media (max-width: 640px) {
  #pid, #updated, #version { display: none; }
  .topbar { height: 52px; padding: 0 16px; }
  main { padding: 20px 16px 40px; gap: 20px; }
  .col-primary, .col-secondary, .layout { gap: 16px; }
  .page-title { font-size: 20px; }
  .card-head, .card-body, .stat-row, .logs-body, details.card summary { padding-left: 16px; padding-right: 16px; }
  #table tr { padding-left: 16px; padding-right: 16px; }
  .skeleton-row td { padding-left: 16px; padding-right: 16px; }
  .input-search { width: 100%; }
  .card-tools { width: 100%; }
  .row-actions { flex-wrap: wrap; }
  .toast-container { left: 12px; right: 12px; bottom: 12px; max-width: none; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
`;

const clientJs = `
(function () {
  "use strict";
  var setTheme = (function () {
    var btn = document.getElementById("theme-toggle");
    var order = ["system", "light", "dark"];
    var mode = document.documentElement.getAttribute("data-theme") || "system";
    function apply(next) {
      mode = next;
      if (mode === "system") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", mode);
      try { if (mode === "system") localStorage.removeItem("locadot.theme"); else localStorage.setItem("locadot.theme", mode); } catch (e) {}
      var label = "Theme: " + mode;
      btn.setAttribute("data-mode", mode);
      btn.title = label;
      btn.setAttribute("aria-label", label + " (click to change)");
    }
    apply(mode);
    btn.addEventListener("click", function () { apply(order[(order.indexOf(mode) + 1) % order.length]); });
    return function (next) { apply(next); if (typeof syncThemeSeg === "function") syncThemeSeg(next); };
  })();


  var tokenMeta = document.querySelector('meta[name="locadot-token"]');
  var TOKEN = tokenMeta ? tokenMeta.getAttribute("content") : "";
  var uiAuthMeta = document.querySelector('meta[name="locadot-ui-auth"]');
  var UI_AUTH = uiAuthMeta ? uiAuthMeta.getAttribute("content") === "on" : false;

  var versionEl = document.getElementById("version");
  var uptimeEl = document.getElementById("uptime");
  var pidEl = document.getElementById("pid");
  var liveDot = document.getElementById("live-dot");
  var liveLabel = document.getElementById("live-label");
  var hostsErrorEl = document.getElementById("hosts-error");
  var updatedEl = document.getElementById("updated");

  var rootValueEl = document.getElementById("tile-root-value");
  var portsValueEl = document.getElementById("tile-ports-value");
  var portsHintEl = document.getElementById("tile-ports-hint");

  var caValueEl = document.getElementById("tile-ca-value");
  var caToggle = document.getElementById("ca-toggle");

  var startupValueEl = document.getElementById("tile-startup-value");
  var startupMethodEl = document.getElementById("tile-startup-method");
  var startupToggle = document.getElementById("startup-toggle");

  var proxyPortsEl = document.getElementById("tile-proxy-ports");
  var proxyBindEl = document.getElementById("tile-proxy-bind");
  var proxyStateDirEl = document.getElementById("tile-proxy-statedir");
  var proxyPlatformEl = document.getElementById("tile-proxy-platform");
  var stopProxyBtn = document.getElementById("stop-proxy-btn");
  var stoppedBanner = document.getElementById("stopped-banner");

  var cfValueEl = document.getElementById("tile-cloudflared-value");
  var cfSubEl = document.getElementById("tile-cloudflared-sub");
  var cfInstallBtn = document.getElementById("cloudflared-install-btn");

  var addForm = document.getElementById("add-form");
  var addHostInput = document.getElementById("add-host");
  var addTargetInput = document.getElementById("add-target");
  var addInsecureInput = document.getElementById("add-insecure");
  var addCorsInput = document.getElementById("add-cors");
  var addSubmitBtn = document.getElementById("add-submit");
  var addErrorEl = document.getElementById("add-error");

  var emptyEl = document.getElementById("empty");
  var tableWrap = document.getElementById("table-wrap");
  var tbody = document.getElementById("tbody");
  var hostsSkeletonEl = document.getElementById("hosts-skeleton");
  var hostsCountEl = document.getElementById("hosts-count");
  var sbHostsCountEl = document.getElementById("sb-hosts-count");
  var sbRemotesCountEl = document.getElementById("sb-remotes-count");
  var hostsFilterInput = document.getElementById("hosts-filter");
  // As many skeleton rows as hosts last time, so the table doesn't jump when data lands.
  try {
    var skelBody = hostsSkeletonEl.querySelector("tbody");
    var lastCount = Math.max(1, Math.min(8, parseInt(localStorage.getItem("locadot.hostCount") || "3", 10) || 3));
    while (skelBody.children.length > lastCount) skelBody.removeChild(skelBody.lastElementChild);
    while (skelBody.children.length < lastCount) skelBody.appendChild(skelBody.firstElementChild.cloneNode(true));
  } catch (e) {}
  var hostsBooted = false;

  var loadErrorBanner = document.getElementById("load-error-banner");
  var loadErrorText = document.getElementById("load-error-text");
  var loadErrorRetry = document.getElementById("load-error-retry");
  var isDown = false;

  var logsPanel = document.getElementById("logs-panel");
  var logsBox = document.getElementById("logs-box");
  var logsRefreshBtn = document.getElementById("logs-refresh");
  var logsClearBtn = document.getElementById("logs-clear");

  var cliAddPre = document.getElementById("cli-add-pre");
  var cliAddCopy = document.getElementById("cli-add-copy");
  var cliCurlPre = document.getElementById("cli-curl-pre");
  var cliCurlCopy = document.getElementById("cli-curl-copy");
  var cliTunnelPre = document.getElementById("cli-tunnel-pre");
  var cliTunnelCopy = document.getElementById("cli-tunnel-copy");

  var toastContainer = document.getElementById("toast-container");

  var hubDot = document.getElementById("hub-dot");
  var hubStatusText = document.getElementById("hub-status-text");
  var hubUrlRow = document.getElementById("hub-url-row");
  var hubUrlEl = document.getElementById("hub-url");
  var hubUrlCopyBtn = document.getElementById("hub-url-copy");
  var hubLoginRow = document.getElementById("hub-login-row");
  var hubLoginLink = document.getElementById("hub-login-link");
  var hubQuickWarning = document.getElementById("hub-quick-warning");
  var hubErrorRow = document.getElementById("hub-error-row");
  var hubNamedForm = document.getElementById("hub-named-form");
  var hubDomainInput = document.getElementById("hub-domain");
  var hubTunnelNameInput = document.getElementById("hub-tunnel-name");
  var hubNamedSubmitBtn = document.getElementById("hub-named-submit");
  var hubQuickBtn = document.getElementById("hub-quick-btn");
  var hubStopBtn = document.getElementById("hub-stop-btn");
  var hubShareSection = document.getElementById("hub-share-section");
  var inviteRoleSelect = document.getElementById("invite-role");
  var inviteCreateBtn = document.getElementById("invite-create-btn");
  var inviteHostsWrap = document.getElementById("invite-hosts-wrap");
  var inviteResultEl = document.getElementById("invite-result");
  var inviteStringEl = document.getElementById("invite-string");
  var inviteCopyBtn = document.getElementById("invite-copy-btn");
  var inviteCountdownEl = document.getElementById("invite-countdown");
  var peersEmptyEl = document.getElementById("peers-empty");
  var peersListEl = document.getElementById("peers-list");
  var invitesEmptyEl = document.getElementById("invites-empty");
  var invitesListEl = document.getElementById("invites-list");

  var connectForm = document.getElementById("connect-form");
  var connectStringInput = document.getElementById("connect-string");
  var connectNameInput = document.getElementById("connect-name");
  var connectDomainInput = document.getElementById("connect-domain");
  var hubLocalhostRow = document.getElementById("hub-localhost-row");
  var hubLocalhostSwitch = document.getElementById("hub-localhost");
  var hubPanelRow = document.getElementById("hub-panel-row");
  var hubPanelSwitch = document.getElementById("hub-panel");
  var hubPanelSub = document.getElementById("hub-panel-sub");
  var hubPanelUrl = "";
  var connectSubmitBtn = document.getElementById("connect-submit");
  var connectErrorEl = document.getElementById("connect-error");
  var remotesEmptyEl = document.getElementById("remotes-empty");
  var remotesListEl = document.getElementById("remotes-list");

  var lastStatus = null;
  var lastHosts = [];
  var lastHub = null;
  var lastRemotes = [];
  var rowElements = {};
  var editingHost = null;
  var caBusy = false;
  var startupBusy = false;
  var cfInstallBusy = false;
  var cloudflaredInstalled = false;
  var proxyStopped = false;
  var pollTimer = null;
  var remotesPollTimer = null;
  var inviteTimer = null;
  var inviteExpiresAt = null;

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function fmtRelative(iso) {
    if (!iso) return "never";
    var diffMs = Date.now() - new Date(iso).getTime();
    var s = Math.max(0, Math.round(diffMs / 1000));
    if (s < 60) return s + "s ago";
    var m = Math.round(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.round(m / 60);
    if (h < 24) return h + "h ago";
    var d = Math.round(h / 24);
    return d + "d ago";
  }

  function fmtUptime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h + "h " + m + "m " + s + "s";
  }

  function copyText(text, btn) {
    function done(ok) {
      if (!btn) return;
      var prev = btn.getAttribute("data-original") || btn.textContent;
      btn.setAttribute("data-original", prev);
      btn.textContent = ok ? "Copied" : "Failed";
      setTimeout(function () { btn.textContent = prev; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      return;
    }
    try {
      var ta = document.createElement("textarea");
      ta.className = "clip-helper";
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      done(true);
    } catch (e) {
      done(false);
    }
  }

  function makeCopyButton(getText, label) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = label || "Copy";
    btn.setAttribute("aria-label", "Copy to clipboard");
    btn.addEventListener("click", function () { copyText(getText(), btn); });
    return btn;
  }

  function showToast(message, kind, hint) {
    var el = document.createElement("div");
    el.className = "toast toast-" + (kind || "info");
    var row = document.createElement("div");
    row.textContent = message;
    el.appendChild(row);
    if (hint) {
      var hintRow = document.createElement("div");
      hintRow.className = "toast-hint";
      var code = document.createElement("code");
      code.className = "mono";
      code.textContent = hint;
      hintRow.appendChild(code);
      hintRow.appendChild(makeCopyButton(function () { return hint; }));
      el.appendChild(hintRow);
    }
    toastContainer.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    var timeout = hint ? 9000 : 4500;
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, timeout);
  }

  function apiError(err, context) {
    var message = err && err.message ? err.message : String(err);
    if (context) message = context + ": " + message;
    showToast(message, "error", err && err.hint ? err.hint : undefined);
  }

  function parseJsonOrThrow(r) {
    // The dashboard session ran out (or the password was set elsewhere): back to the sign-in page.
    if (r.status === 401) location.reload();
    return r.json().catch(function () { return {}; }).then(function (body) {
      if (!r.ok) {
        var err = new Error((body && body.error) || ("Request failed (" + r.status + ")"));
        err.hint = body && body.hint;
        throw err;
      }
      return body;
    });
  }

  function apiFetch(url, opts) {
    opts = opts || {};
    var method = opts.method || "GET";
    var headers = {};
    if (method !== "GET") {
      headers["X-Locadot-Token"] = TOKEN;
      headers["Content-Type"] = "application/json";
    }
    opts.headers = headers;
    return fetch(url, opts).then(parseJsonOrThrow);
  }

  // ---------- header + system tiles ----------

  function hideHostsSkeleton() {
    if (!hostsBooted) {
      hostsBooted = true;
      hostsSkeletonEl.hidden = true;
    }
  }

  function showLoadError(err) {
    isDown = true;
    var reason = (err && err.message) ? err.message : "connection failed";
    loadErrorText.textContent = "Can't reach the locadot proxy (" + reason + "). Start it with locadot start; this page retries every 5 s.";
    loadErrorBanner.hidden = false;
    if (!lastStatus) hostsErrorEl.hidden = false;
  }

  function hideLoadError() {
    isDown = false;
    loadErrorBanner.hidden = true;
    hostsErrorEl.hidden = true;
    liveLabel.textContent = "live";
    document.body.classList.remove("offline");
  }

  loadErrorRetry.addEventListener("click", function () {
    loadErrorRetry.disabled = true;
    loadErrorRetry.classList.add("busy");
    refreshAll().then(function () {
      loadErrorRetry.disabled = false;
      loadErrorRetry.classList.remove("busy");
    });
  });

  function renderHeader(status) {
    document.body.classList.remove("boot");
    versionEl.textContent = "v" + status.proxy.version;
    uptimeEl.textContent = "uptime " + fmtUptime(status.uptimeSec);
    pidEl.textContent = "pid " + status.proxy.pid;
    updatedEl.textContent = "Updated " + new Date().toLocaleTimeString();
    liveDot.classList.remove("down");
    liveDot.classList.add("up");
  }

  function markDown() {
    liveDot.classList.remove("up");
    liveDot.classList.add("down");
    liveLabel.textContent = "offline";
    document.body.classList.add("offline");
  }

  function renderSystemTiles(status) {
    var sys = status.system;
    var proxy = status.proxy;

    rootValueEl.textContent = sys.isRoot ? "Elevated" : "User";
    rootValueEl.className = "tile-value " + (sys.isRoot ? "ok" : "");
    portsValueEl.textContent = "Ports <1024: " + (sys.canBindPrivileged ? "allowed" : "blocked");
    clear(portsHintEl);
    if (!sys.canBindPrivileged && sys.platform === "linux") {
      var hintText = "sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80";
      var code = document.createElement("code");
      code.className = "mono";
      code.textContent = hintText;
      portsHintEl.appendChild(code);
      portsHintEl.appendChild(makeCopyButton(function () { return hintText; }));
      portsHintEl.hidden = false;
    } else {
      portsHintEl.hidden = true;
    }

    var caTrusted = sys.caTrusted;
    caValueEl.textContent = caTrusted === true ? "Trusted" : caTrusted === false ? "Not trusted" : "Unknown";
    caValueEl.className = "tile-value " + (caTrusted === true ? "ok" : caTrusted === false ? "warn" : "");
    if (!caBusy) {
      caToggle.setAttribute("aria-checked", String(caTrusted === true));
      caToggle.classList.toggle("on", caTrusted === true);
    }

    startupValueEl.textContent = sys.startup.enabled ? "Enabled" : "Disabled";
    startupValueEl.className = "tile-value " + (sys.startup.enabled ? "ok" : "");
    startupMethodEl.textContent = sys.startup.method ? ("via " + sys.startup.method) : "";
    if (!startupBusy) {
      startupToggle.setAttribute("aria-checked", String(sys.startup.enabled));
      startupToggle.classList.toggle("on", sys.startup.enabled);
    }

    proxyPortsEl.textContent = "http :" + proxy.httpPort + " \\u00b7 https :" + proxy.httpsPort;
    proxyBindEl.textContent = "bind " + proxy.bind.join(", ");
    proxyStateDirEl.textContent = proxy.stateDir;
    proxyPlatformEl.textContent = sys.platform;

    var cf = sys.cloudflared || { installed: false };
    cloudflaredInstalled = !!cf.installed;
    if (cf.installed) {
      cfValueEl.textContent = "Installed";
      cfValueEl.className = "tile-value ok";
      cfSubEl.textContent = [cf.version, cf.path].filter(Boolean).join(" \\u00b7 ");
      if (!cfInstallBusy) cfInstallBtn.hidden = true;
    } else {
      cfValueEl.textContent = "Not installed";
      cfValueEl.className = "tile-value warn";
      cfSubEl.textContent = "";
      if (!cfInstallBusy) cfInstallBtn.hidden = false;
    }
  }

  function renderCli(status) {
    var stateDir = status.proxy.stateDir;
    var port = status.proxy.httpPort;
    var urlBase = "http://localhost" + (port !== 80 ? ":" + port : "");
    var curl = "curl -X POST " + urlBase + "/api/hosts" +
      ' -H "X-Locadot-Token: $(cat ' + stateDir + '/.locadot-token)"' +
      " -H 'Content-Type: application/json'" +
      ' -d \\'{"host":"app.localhost","target":"3000"}\\'';
    cliCurlPre.textContent = curl;
  }

  // ---------- remote access: hub (sender) ----------

  function fmtIn(iso) {
    if (!iso) return "";
    var ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "expired";
    var s = Math.round(ms / 1000);
    if (s < 60) return "in " + s + "s";
    var m = Math.round(s / 60);
    return "in " + m + "m";
  }

  function renderPeers(peers) {
    peersEmptyEl.hidden = peers.length !== 0;
    clear(peersListEl);
    peers.forEach(function (peer) {
      var row = document.createElement("div");
      row.className = "peer-row";

      var main = document.createElement("div");
      main.className = "peer-main";
      var name = document.createElement("div");
      name.className = "peer-name";
      name.textContent = peer.name;
      main.appendChild(name);
      var sub = document.createElement("div");
      sub.className = "muted";
      sub.textContent = "last seen " + fmtRelative(peer.lastSeen);
      main.appendChild(sub);
      row.appendChild(main);

      var controls = document.createElement("div");
      controls.className = "peer-controls";
      var roleSelect = document.createElement("select");
      roleSelect.className = "input input-sm";
      roleSelect.setAttribute("aria-label", "Role for " + peer.name);
      ["viewer", "editor", "admin"].forEach(function (r) {
        var opt = document.createElement("option");
        opt.value = r;
        opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
        if (r === peer.role) opt.selected = true;
        roleSelect.appendChild(opt);
      });
      roleSelect.addEventListener("change", function () {
        var prev = peer.role;
        roleSelect.disabled = true;
        apiFetch("/api/peers/" + encodeURIComponent(peer.id), { method: "PUT", body: JSON.stringify({ role: roleSelect.value, hosts: peer.hosts }) })
          .then(function () { showToast("Updated role for " + peer.name, "success"); return loadHub(); })
          .catch(function (err) { apiError(err, "Couldn't update role"); roleSelect.value = prev; roleSelect.disabled = false; });
      });
      controls.appendChild(roleSelect);

      var revokeBtn = document.createElement("button");
      revokeBtn.type = "button";
      revokeBtn.className = "btn btn-sm btn-danger";
      revokeBtn.textContent = "Revoke";
      revokeBtn.addEventListener("click", function () {
        if (!window.confirm("Revoke " + peer.name + "?")) return;
        revokeBtn.disabled = true;
        apiFetch("/api/peers/" + encodeURIComponent(peer.id), { method: "DELETE" })
          .then(function () { showToast("Revoked " + peer.name, "success"); return loadHub(); })
          .catch(function (err) { apiError(err, "Couldn't revoke peer"); revokeBtn.disabled = false; });
      });
      controls.appendChild(revokeBtn);
      row.appendChild(controls);
      peersListEl.appendChild(row);
    });
  }

  function renderInvites(invites) {
    invitesEmptyEl.hidden = invites.length !== 0;
    clear(invitesListEl);
    invites.forEach(function (invite) {
      var row = document.createElement("div");
      row.className = "invite-row";
      var main = document.createElement("div");
      main.className = "peer-main";
      var roleLine = document.createElement("div");
      roleLine.className = "peer-name";
      roleLine.textContent = invite.role.charAt(0).toUpperCase() + invite.role.slice(1);
      main.appendChild(roleLine);
      var sub = document.createElement("div");
      sub.className = "muted";
      sub.textContent = "expires " + fmtIn(invite.expiresAt);
      main.appendChild(sub);
      row.appendChild(main);

      var revokeBtn = document.createElement("button");
      revokeBtn.type = "button";
      revokeBtn.className = "btn btn-sm btn-ghost-danger";
      revokeBtn.textContent = "\\u00d7";
      revokeBtn.setAttribute("aria-label", "Revoke invite");
      revokeBtn.addEventListener("click", function () {
        revokeBtn.disabled = true;
        apiFetch("/api/invites/" + encodeURIComponent(invite.id), { method: "DELETE" })
          .then(function () { return loadHub(); })
          .catch(function (err) { apiError(err, "Couldn't revoke invite"); revokeBtn.disabled = false; });
      });
      row.appendChild(revokeBtn);
      invitesListEl.appendChild(row);
    });
  }

  // Re-rendered on every poll, so remember what the user unticked.
  var inviteUnchecked = {};
  function renderInviteHostChecks() {
    Array.prototype.forEach.call(inviteHostsWrap.querySelectorAll("input"), function (cb) {
      if (cb.checked) delete inviteUnchecked[cb.value];
      else inviteUnchecked[cb.value] = true;
    });
    clear(inviteHostsWrap);
    lastHosts.forEach(function (row) {
      if (row.remote) return;
      var label = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = row.host;
      cb.checked = !inviteUnchecked[row.host];
      label.appendChild(cb);
      label.appendChild(document.createTextNode(row.host));
      inviteHostsWrap.appendChild(label);
    });
  }

  function updateInviteHostsVisibility() {
    var isViewer = inviteRoleSelect.value === "viewer";
    inviteHostsWrap.hidden = !isViewer;
    if (isViewer) renderInviteHostChecks();
  }
  inviteRoleSelect.addEventListener("change", updateInviteHostsVisibility);

  function updateInviteCountdown() {
    if (!inviteExpiresAt) return;
    var remaining = Math.max(0, Math.round((inviteExpiresAt - Date.now()) / 1000));
    if (remaining <= 0) {
      inviteCountdownEl.textContent = "expired";
      if (inviteTimer) { clearInterval(inviteTimer); inviteTimer = null; }
      return;
    }
    var m = Math.floor(remaining / 60);
    var s = remaining % 60;
    inviteCountdownEl.textContent = m + ":" + (s < 10 ? "0" : "") + s;
  }

  function showInviteResult(data) {
    inviteStringEl.textContent = data.string;
    inviteResultEl.hidden = false;
    inviteExpiresAt = new Date(data.expiresAt).getTime();
    if (inviteTimer) clearInterval(inviteTimer);
    updateInviteCountdown();
    inviteTimer = setInterval(updateInviteCountdown, 1000);
  }

  inviteCreateBtn.addEventListener("click", function () {
    var role = inviteRoleSelect.value;
    var hosts;
    if (role === "viewer") {
      hosts = Array.prototype.slice.call(inviteHostsWrap.querySelectorAll("input:checked")).map(function (cb) { return cb.value; });
    }
    inviteCreateBtn.disabled = true;
    inviteCreateBtn.classList.add("busy");
    apiFetch("/api/invites", { method: "POST", body: JSON.stringify({ role: role, hosts: hosts }) })
      .then(function (data) {
        showInviteResult(data);
        return loadHub();
      })
      .catch(function (err) { apiError(err, "Couldn't create pairing link"); })
      .then(function () { inviteCreateBtn.disabled = false; inviteCreateBtn.classList.remove("busy"); });
  });

  inviteCopyBtn.addEventListener("click", function () { copyText(inviteStringEl.textContent, inviteCopyBtn); });

  function renderHub(data) {
    lastHub = data.hub;
    var hub = data.hub;
    var status = hub.status;

    var dotClass = status === "up" ? "up" : status === "starting" ? "warn" : status === "login" ? "accent" : status === "error" ? "down" : "";
    hubDot.className = "dot" + (dotClass ? " " + dotClass : "");
    var labels = { off: "Off", starting: "Starting\\u2026", login: "Login required", up: "Up", error: "Error" };
    hubStatusText.textContent = labels[status] || status;

    hubUrlRow.hidden = !(status === "up" && hub.url);
    if (status === "up" && hub.url) hubUrlEl.textContent = hub.url;

    hubLoginRow.hidden = !(status === "login" && hub.loginUrl);
    if (status === "login" && hub.loginUrl) hubLoginLink.href = hub.loginUrl;

    hubQuickWarning.hidden = !(status === "up" && hub.mode === "quick");

    hubLocalhostRow.hidden = !data.config;
    setSwitch(hubLocalhostSwitch, data.localhost !== false);
    hubPanelUrl = status === "up" && hub.url ? hub.url : "";
    hubPanelRow.hidden = !data.config;
    renderHubPanel(data.panel === true);

    hubErrorRow.hidden = !(status === "error" && hub.error);
    if (status === "error" && hub.error) hubErrorRow.textContent = hub.error;

    var running = status === "starting" || status === "login" || status === "up";
    hubNamedForm.hidden = status === "up";
    hubQuickBtn.hidden = status === "up";
    hubStopBtn.hidden = !running;

    if (data.config && data.config.mode === "named" && data.config.domain && !hubDomainInput.value) {
      hubDomainInput.value = data.config.domain;
    }

    hubShareSection.hidden = status !== "up";
    if (status === "up") updateInviteHostsVisibility();

    renderPeers(data.peers);
    renderInvites(data.invites);
  }

  function loadHub() {
    return fetch("/api/hub").then(parseJsonOrThrow).then(renderHub).catch(function (err) { apiError(err, "Couldn't load remote access"); });
  }

  hubUrlCopyBtn.addEventListener("click", function () { copyText(hubUrlEl.textContent, hubUrlCopyBtn); });

  hubNamedForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var domain = hubDomainInput.value.trim();
    if (!domain) { hubDomainInput.focus(); return; }
    var tunnel = hubTunnelNameInput.value.trim();
    hubNamedSubmitBtn.disabled = true;
    hubNamedSubmitBtn.classList.add("busy");
    apiFetch("/api/hub", { method: "POST", body: JSON.stringify({ mode: "named", domain: domain, tunnel: tunnel || undefined }) })
      .then(function () { showToast("Setting up your domain\\u2026", "success"); return loadHub(); })
      .catch(function (err) { apiError(err, "Couldn't start setup"); })
      .then(function () { hubNamedSubmitBtn.disabled = false; hubNamedSubmitBtn.classList.remove("busy"); });
  });

  hubQuickBtn.addEventListener("click", function () {
    hubQuickBtn.disabled = true;
    hubQuickBtn.classList.add("busy");
    apiFetch("/api/hub", { method: "POST", body: JSON.stringify({ mode: "quick" }) })
      .then(function () { showToast("Starting quick tunnel\\u2026", "success"); return loadHub(); })
      .catch(function (err) { apiError(err, "Couldn't start quick tunnel"); })
      .then(function () { hubQuickBtn.disabled = false; hubQuickBtn.classList.remove("busy"); });
  });

  hubStopBtn.addEventListener("click", function () {
    if (!window.confirm("Stop remote access? Connected peers will be disconnected.")) return;
    hubStopBtn.disabled = true;
    hubStopBtn.classList.add("busy");
    apiFetch("/api/hub", { method: "POST", body: JSON.stringify({ mode: "off" }) })
      .then(function () { showToast("Remote access stopped", "success"); return loadHub(); })
      .catch(function (err) { apiError(err, "Couldn't stop remote access"); })
      .then(function () { hubStopBtn.disabled = false; hubStopBtn.classList.remove("busy"); });
  });

  // ---------- remote access: connected machines (receiver) ----------

  function showConnectError(message) {
    connectErrorEl.textContent = message;
    connectErrorEl.hidden = false;
  }
  function hideConnectError() {
    connectErrorEl.hidden = true;
  }

  function renderRemotes(remotes) {
    lastRemotes = remotes;
    remotesEmptyEl.hidden = remotes.length !== 0;
    sbRemotesCountEl.textContent = String(remotes.length);
    sbRemotesCountEl.hidden = remotes.length === 0;
    clear(remotesListEl);
    remotes.forEach(function (remote) {
      var item = document.createElement("div");
      item.className = "remote-item";

      var head = document.createElement("div");
      head.className = "remote-head";
      var main = document.createElement("div");
      main.className = "remote-main";
      var nameLine = document.createElement("div");
      nameLine.className = "peer-name";
      nameLine.textContent = remote.name;
      main.appendChild(nameLine);
      var sub = document.createElement("div");
      sub.className = "muted";
      sub.textContent = (remote.sender && remote.sender.hostname) || "";
      main.appendChild(sub);
      head.appendChild(main);

      var badges = document.createElement("div");
      badges.className = "badges";
      var roleBadge = document.createElement("span");
      roleBadge.className = "badge badge-role badge-accent";
      roleBadge.textContent = remote.role;
      badges.appendChild(roleBadge);
      var statusBadge = document.createElement("span");
      statusBadge.className = "badge " + (remote.status === "ok" ? "badge-up" : "badge-down");
      statusBadge.textContent = remote.status === "ok" ? "connected" : "error";
      if (remote.status !== "ok" && remote.error) statusBadge.title = remote.error;
      badges.appendChild(statusBadge);
      head.appendChild(badges);
      item.appendChild(head);

      var urlRow = document.createElement("div");
      urlRow.className = "hub-row";
      var urlText = document.createElement("span");
      urlText.className = "hub-url";
      urlText.textContent = remote.url;
      urlRow.appendChild(urlText);
      var urlEditBtn = document.createElement("button");
      urlEditBtn.type = "button";
      urlEditBtn.className = "btn btn-sm btn-ghost";
      urlEditBtn.textContent = "Update URL";
      urlEditBtn.addEventListener("click", function () {
        var next = window.prompt("New URL for " + remote.name, remote.url);
        if (!next || !next.trim() || next.trim() === remote.url) return;
        apiFetch("/api/remotes/" + encodeURIComponent(remote.name), { method: "PUT", body: JSON.stringify({ url: next.trim() }) })
          .then(function () { showToast("Updated URL for " + remote.name, "success"); return loadRemotes(); })
          .catch(function (err) { apiError(err, "Couldn't update URL"); });
      });
      urlRow.appendChild(urlEditBtn);
      item.appendChild(urlRow);
      if (remote.role === "admin") item.appendChild(remoteLocalRow(remote));

      var actions = document.createElement("div");
      actions.className = "remote-controls";
      var syncBtn = document.createElement("button");
      syncBtn.type = "button";
      syncBtn.className = "btn btn-sm";
      syncBtn.textContent = "Sync";
      syncBtn.addEventListener("click", function () {
        syncBtn.disabled = true;
        syncBtn.classList.add("busy");
        apiFetch("/api/remotes/" + encodeURIComponent(remote.name) + "/sync", { method: "POST" })
          .then(function () { showToast("Synced " + remote.name, "success"); return Promise.all([loadRemotes(), loadHosts()]); })
          .catch(function (err) { apiError(err, "Couldn't sync " + remote.name); })
          .then(function () { syncBtn.disabled = false; syncBtn.classList.remove("busy"); });
      });
      actions.appendChild(syncBtn);
      var disconnectBtn = document.createElement("button");
      disconnectBtn.type = "button";
      disconnectBtn.className = "btn btn-sm btn-danger";
      disconnectBtn.textContent = "Disconnect";
      disconnectBtn.addEventListener("click", function () {
        if (!window.confirm("Disconnect from " + remote.name + "? This removes its hosts too.")) return;
        disconnectBtn.disabled = true;
        apiFetch("/api/remotes/" + encodeURIComponent(remote.name), { method: "DELETE" })
          .then(function () { showToast("Disconnected " + remote.name, "success"); return Promise.all([loadRemotes(), loadHosts()]); })
          .catch(function (err) { apiError(err, "Couldn't disconnect"); disconnectBtn.disabled = false; });
      });
      actions.appendChild(disconnectBtn);
      item.appendChild(actions);

      var hostsWrap = document.createElement("div");
      hostsWrap.className = "remote-hosts-list";
      if (remote.available === null) {
        var errLine = document.createElement("div");
        errLine.className = "dim";
        errLine.textContent = "Couldn't load hosts: " + (remote.error || "unknown error");
        hostsWrap.appendChild(errLine);
      } else {
        (remote.available || []).forEach(function (h) {
          var hostRow = document.createElement("div");
          hostRow.className = "remote-host-row";
          var hostMain = document.createElement("div");
          hostMain.className = "mono";
          var aliases = (remote.mapped || []).filter(function (m) { return m.host === h.host; }).map(function (m) { return m.local; });
          hostMain.textContent = h.host + (aliases.length ? " \\u2192 " + aliases.join(", ") : "");
          hostRow.appendChild(hostMain);

          if (!aliases.length) {
            var aliasForm = document.createElement("div");
            aliasForm.className = "mini-form";
            var aliasInput = document.createElement("input");
            aliasInput.type = "text";
            aliasInput.className = "input input-sm";
            aliasInput.placeholder = h.host;
            aliasInput.setAttribute("aria-label", "Local alias for " + h.host);
            var aliasBtn = document.createElement("button");
            aliasBtn.type = "button";
            aliasBtn.className = "btn btn-sm";
            aliasBtn.textContent = "Add alias";
            aliasBtn.addEventListener("click", function () {
              var local = aliasInput.value.trim();
              if (!local) { aliasInput.focus(); return; }
              aliasBtn.disabled = true;
              apiFetch("/api/remotes/" + encodeURIComponent(remote.name) + "/aliases", { method: "POST", body: JSON.stringify({ host: h.host, local: local }) })
                .then(function () { showToast("Added alias " + local, "success"); return Promise.all([loadRemotes(), loadHosts()]); })
                .catch(function (err) { apiError(err, "Couldn't add alias"); aliasBtn.disabled = false; });
            });
            aliasForm.appendChild(aliasInput);
            aliasForm.appendChild(aliasBtn);
            hostRow.appendChild(aliasForm);
          } else if (remote.role === "admin") {
            var delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "btn btn-sm btn-danger";
            delBtn.textContent = "Delete";
            delBtn.addEventListener("click", function () {
              if (!window.confirm("Delete " + h.host + " on " + remote.name + "?")) return;
              delBtn.disabled = true;
              apiFetch("/api/remotes/" + encodeURIComponent(remote.name) + "/hosts/" + encodeURIComponent(h.host), { method: "DELETE" })
                .then(function () { showToast("Deleted " + h.host, "success"); return Promise.all([loadRemotes(), loadHosts()]); })
                .catch(function (err) { apiError(err, "Couldn't delete host"); delBtn.disabled = false; });
            });
            hostRow.appendChild(delBtn);
          }
          hostsWrap.appendChild(hostRow);
        });
      }
      item.appendChild(hostsWrap);

      if (remote.role === "editor" || remote.role === "admin") {
        var addHostForm = document.createElement("div");
        addHostForm.className = "mini-form";
        var addHostIn = document.createElement("input");
        addHostIn.type = "text";
        addHostIn.className = "input input-sm";
        addHostIn.placeholder = "host";
        addHostIn.setAttribute("aria-label", "New host on " + remote.name);
        var addTargetIn = document.createElement("input");
        addTargetIn.type = "text";
        addTargetIn.className = "input input-sm";
        addTargetIn.placeholder = "target";
        addTargetIn.setAttribute("aria-label", "Target for new host on " + remote.name);
        var addHostBtn = document.createElement("button");
        addHostBtn.type = "button";
        addHostBtn.className = "btn btn-sm";
        addHostBtn.textContent = "Add host on " + remote.name;
        addHostBtn.addEventListener("click", function () {
          var h = addHostIn.value.trim();
          var t = addTargetIn.value.trim();
          if (!h || !t) return;
          addHostBtn.disabled = true;
          apiFetch("/api/remotes/" + encodeURIComponent(remote.name) + "/hosts", { method: "POST", body: JSON.stringify({ host: h, target: t }) })
            .then(function () {
              showToast("Added " + h + " on " + remote.name, "success");
              addHostIn.value = "";
              addTargetIn.value = "";
              return Promise.all([loadRemotes(), loadHosts()]);
            })
            .catch(function (err) { apiError(err, "Couldn't add host"); })
            .then(function () { addHostBtn.disabled = false; });
        });
        addHostForm.appendChild(addHostIn);
        addHostForm.appendChild(addTargetIn);
        addHostForm.appendChild(addHostBtn);
        item.appendChild(addHostForm);
      }

      remotesListEl.appendChild(item);
    });
  }

  function loadRemotes() {
    return fetch("/api/remotes").then(parseJsonOrThrow).then(function (data) { renderRemotes(data.remotes || []); }).catch(function (err) { apiError(err, "Couldn't load remotes"); });
  }

  connectForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideConnectError();
    var value = connectStringInput.value.trim();
    if (!value) { showConnectError("Paste a pairing link first."); return; }
    var name = connectNameInput.value.trim();
    var domain = connectDomainInput.value.trim().toLowerCase();
    connectSubmitBtn.disabled = true;
    connectSubmitBtn.classList.add("busy");
    apiFetch("/api/remotes", { method: "POST", body: JSON.stringify({ string: value, name: name || undefined, domain: domain || undefined }) })
      .then(function (data) {
        var r = data.remote;
        showToast("Connected to " + r.name, "success", r.domain && r.role === "admin" ? "Its dashboard: " + localUrl(r.domain) : (domain && r.role !== "admin" ? "Domain ignored: you're " + r.role + ", not admin." : undefined));
        connectForm.reset();
        return Promise.all([loadRemotes(), loadHosts()]);
      })
      .catch(function (err) { showConnectError(err.message); })
      .then(function () { connectSubmitBtn.disabled = false; connectSubmitBtn.classList.remove("busy"); });
  });

  function localUrl(domain, port) {
    return location.protocol + "//" + (port ? port + "." : "") + domain + ".localhost" + (location.port ? ":" + location.port : "") + "/";
  }

  function saveDomain(remote, domain) {
    return apiFetch("/api/remotes/" + encodeURIComponent(remote.name), { method: "PUT", body: JSON.stringify({ domain: domain }) })
      .then(function (data) {
        var next = data && data.remote ? data.remote.domain : null;
        showToast(next ? "Localhost of " + remote.name + " is " + next + ".localhost" : "Removed the localhost domain", "success");
        return loadRemotes();
      })
      .catch(function (err) { apiError(err, "Couldn't set the domain"); });
  }

  /** Admin remotes: link to the sender's whole localhost, and an inline editor for the domain. */
  function remoteLocalRow(remote) {
    var row = document.createElement("div");
    row.className = "hub-row remote-local";
    if (remote.localhost === false) {
      var off = document.createElement("span");
      off.className = "dim";
      off.textContent = "Localhost access is off on " + ((remote.sender && remote.sender.hostname) || remote.name) + ".";
      row.appendChild(off);
      return row;
    }
    var label = document.createElement("span");
    label.className = "label";
    label.textContent = "Localhost";
    row.appendChild(label);

    var form = document.createElement("form");
    form.className = "mini-form";
    form.hidden = Boolean(remote.domain);
    var input = document.createElement("input");
    input.type = "text";
    input.className = "input input-sm";
    input.value = remote.domain || "";
    input.placeholder = "office";
    input.setAttribute("aria-label", "Localhost domain for " + remote.name);
    var save = document.createElement("button");
    save.type = "submit";
    save.className = "btn btn-sm btn-primary";
    save.textContent = "Save";
    var random = document.createElement("button");
    random.type = "button";
    random.className = "btn btn-sm";
    random.textContent = "Random";
    random.addEventListener("click", function () { saveDomain(remote, "random"); });
    form.appendChild(input);
    form.appendChild(save);
    form.appendChild(random);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = input.value.trim().toLowerCase();
      if (!value) { input.focus(); return; }
      saveDomain(remote, value);
    });

    if (remote.domain) {
      var link = document.createElement("a");
      link.href = localUrl(remote.domain);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = remote.domain + ".localhost";
      link.title = "Its dashboard. Any port: " + localUrl(remote.domain, "<port>");
      row.appendChild(link);
      row.appendChild(makeCopyButton(function () { return localUrl(remote.domain); }));
      var change = document.createElement("button");
      change.type = "button";
      change.className = "btn btn-sm btn-ghost";
      change.textContent = "Change";
      change.addEventListener("click", function () { form.hidden = !form.hidden; if (!form.hidden) input.focus(); });
      row.appendChild(change);
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-sm btn-ghost";
      remove.textContent = "Remove";
      remove.addEventListener("click", function () { saveDomain(remote, null); });
      row.appendChild(remove);
    }
    row.appendChild(form);
    return row;
  }

  function renderHubPanel(on) {
    setSwitch(hubPanelSwitch, on);
    // Turning it on needs a password; turning it off never does.
    hubPanelSwitch.disabled = !on && !UI_AUTH;
    if (!UI_AUTH && !on) hubPanelSub.textContent = "Set a dashboard password in Settings first. Visitors sign in with it.";
    else if (on) hubPanelSub.textContent = "Open " + (hubPanelUrl || "the public URL") + " in any browser and sign in with the dashboard password.";
    else hubPanelSub.textContent = "Open this dashboard from any browser at the public URL, after signing in with the dashboard password.";
  }

  hubPanelSwitch.addEventListener("click", function () {
    var next = hubPanelSwitch.getAttribute("aria-checked") !== "true";
    hubPanelSwitch.disabled = true;
    apiFetch("/api/hub/panel", { method: "PUT", body: JSON.stringify({ enabled: next }) })
      .then(function () {
        renderHubPanel(next);
        showToast(next ? "The dashboard is shared at the public URL" : "The dashboard is no longer shared", "success");
      })
      .catch(function (err) {
        apiError(err, "Couldn't change dashboard sharing");
        renderHubPanel(!next);
      });
  });

  hubLocalhostSwitch.addEventListener("click", function () {
    var next = hubLocalhostSwitch.getAttribute("aria-checked") !== "true";
    hubLocalhostSwitch.disabled = true;
    apiFetch("/api/hub/localhost", { method: "PUT", body: JSON.stringify({ enabled: next }) })
      .then(function () {
        setSwitch(hubLocalhostSwitch, next);
        showToast(next ? "Admins can open this dashboard and any port" : "Localhost access is off", "success");
      })
      .catch(function (err) { apiError(err, "Couldn't change localhost access"); })
      .then(function () { hubLocalhostSwitch.disabled = false; });
  });

  function refreshHubAndRemotes() {
    if (proxyStopped) return Promise.resolve();
    return Promise.all([loadHub(), loadRemotes()]).then(function () { renderOverview(); });
  }

  caToggle.addEventListener("click", function () {
    if (caBusy || !lastStatus) return;
    var next = !(lastStatus.system.caTrusted === true);
    caBusy = true;
    caToggle.disabled = true;
    caToggle.classList.add("busy");
    apiFetch("/api/trust", { method: "POST", body: JSON.stringify({ trusted: next }) })
      .then(function () {
        showToast("CA trust setting updated", "success");
        return refreshAll();
      })
      .catch(function (err) { apiError(err, "Couldn't update CA trust"); })
      .then(function () {
        caBusy = false;
        caToggle.disabled = false;
        caToggle.classList.remove("busy");
      });
  });

  startupToggle.addEventListener("click", function () {
    if (startupBusy || !lastStatus) return;
    var next = !lastStatus.system.startup.enabled;
    startupBusy = true;
    startupToggle.disabled = true;
    startupToggle.classList.add("busy");
    apiFetch("/api/startup", { method: "POST", body: JSON.stringify({ enabled: next }) })
      .then(function () {
        showToast("Startup setting updated", "success");
        return refreshAll();
      })
      .catch(function (err) { apiError(err, "Couldn't update start at boot"); })
      .then(function () {
        startupBusy = false;
        startupToggle.disabled = false;
        startupToggle.classList.remove("busy");
      });
  });

  stopProxyBtn.addEventListener("click", function () {
    if (proxyStopped) return;
    if (!window.confirm("Stop the locadot proxy? Run \\"locadot start\\" to bring it back up.")) return;
    stopProxyBtn.disabled = true;
    stopProxyBtn.classList.add("busy");
    apiFetch("/api/proxy/stop", { method: "POST" })
      .then(function () {
        proxyStopped = true;
        clear(stoppedBanner);
        stoppedBanner.appendChild(document.createTextNode("Proxy stopped. Run "));
        var code = document.createElement("code");
        code.className = "mono";
        code.textContent = "locadot start";
        stoppedBanner.appendChild(code);
        stoppedBanner.appendChild(document.createTextNode(" to bring it back."));
        stoppedBanner.hidden = false;
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        if (remotesPollTimer) { clearInterval(remotesPollTimer); remotesPollTimer = null; }
        showToast("Proxy stopped", "warn");
      })
      .catch(function (err) {
        apiError(err, "Couldn't stop the proxy");
        stopProxyBtn.disabled = false;
        stopProxyBtn.classList.remove("busy");
      });
  });

  cfInstallBtn.addEventListener("click", function () {
    if (cfInstallBusy) return;
    cfInstallBusy = true;
    cfInstallBtn.disabled = true;
    cfInstallBtn.classList.add("busy");
    var prevText = cfInstallBtn.textContent;
    cfInstallBtn.textContent = "Installing\\u2026";
    apiFetch("/api/cloudflared/install", { method: "POST", body: JSON.stringify({}) })
      .then(function () {
        showToast("cloudflared installed", "success");
        return refreshAll();
      })
      .catch(function (err) { apiError(err, "Couldn't install cloudflared"); })
      .then(function () {
        cfInstallBusy = false;
        cfInstallBtn.disabled = false;
        cfInstallBtn.classList.remove("busy");
        cfInstallBtn.textContent = prevText;
      });
  });

  // ---------- add host form ----------

  function showAddError(message, hint) {
    clear(addErrorEl);
    var text = document.createElement("span");
    text.textContent = message;
    addErrorEl.appendChild(text);
    if (hint) {
      var code = document.createElement("code");
      code.className = "mono";
      code.textContent = hint;
      addErrorEl.appendChild(code);
      addErrorEl.appendChild(makeCopyButton(function () { return hint; }));
    }
    addErrorEl.hidden = false;
  }

  function hideAddError() {
    addErrorEl.hidden = true;
    clear(addErrorEl);
  }

  function markFieldInvalid(el, invalid) {
    el.classList.toggle("invalid", !!invalid);
    el.setAttribute("aria-invalid", invalid ? "true" : "false");
  }

  addHostInput.addEventListener("input", function () {
    if (addHostInput.value.trim()) markFieldInvalid(addHostInput, false);
    hideAddError();
  });
  addTargetInput.addEventListener("input", function () {
    if (addTargetInput.value.trim()) markFieldInvalid(addTargetInput, false);
    hideAddError();
  });

  addForm.addEventListener("focusout", function (e) {
    if (e.relatedTarget && addForm.contains(e.relatedTarget)) return;
    hideAddError();
    markFieldInvalid(addHostInput, false);
    markFieldInvalid(addTargetInput, false);
  });

  addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideAddError();
    var hostVal = addHostInput.value.trim();
    var targetVal = addTargetInput.value.trim();
    if (!hostVal || !targetVal) {
      markFieldInvalid(addHostInput, !hostVal);
      markFieldInvalid(addTargetInput, !targetVal);
      showAddError("Host and target are required.");
      (!hostVal ? addHostInput : addTargetInput).focus();
      return;
    }
    markFieldInvalid(addHostInput, false);
    markFieldInvalid(addTargetInput, false);
    if (hostVal.indexOf(".") === -1) hostVal = hostVal + ".localhost";
    var insecureVal = !!addInsecureInput.checked;
    var corsVal = !!addCorsInput.checked;
    addSubmitBtn.disabled = true;
    addSubmitBtn.classList.add("busy");
    apiFetch("/api/hosts", { method: "POST", body: JSON.stringify({ host: hostVal, target: targetVal, insecure: insecureVal, cors: corsVal }) })
      .then(function () {
        addForm.reset();
        applyHostDefaults();
        showToast("Added " + hostVal, "success");
        return loadHosts();
      })
      .catch(function (err) {
        showAddError(err.message, err.hint);
      })
      .then(function () {
        addSubmitBtn.disabled = false;
        addSubmitBtn.classList.remove("busy");
      });
  });

  // ---------- hosts table ----------

  function statusPill(row) {
    var wrap = document.createElement("span");
    wrap.className = "pill";
    var dot = document.createElement("span");
    dot.className = "dot " + (row.probe.up ? "up" : "down");
    wrap.appendChild(dot);
    var text = document.createElement("span");
    if (row.probe.up) {
      var statusPart = row.probe.status !== undefined ? String(row.probe.status) : "?";
      var msPart = typeof row.probe.ms === "number" ? Math.round(row.probe.ms) + "ms" : "-";
      text.textContent = statusPart + " \\u00b7 " + msPart;
    } else {
      text.textContent = row.probe.error || "down";
    }
    wrap.appendChild(text);
    return wrap;
  }

  function makeCell(content, cls) {
    var td = document.createElement("td");
    if (cls) td.className = cls;
    if (content !== undefined && content !== null) td.textContent = content;
    return td;
  }

  function tunnelInfo(row) {
    return row.tunnel || { enabled: false, status: "off" };
  }

  function tunnelCell(row) {
    var td = document.createElement("td");
    td.className = "tunnel-cell";
    var t = tunnelInfo(row);

    var statusWrap = document.createElement("div");
    statusWrap.className = "tunnel-status";
    if (t.status === "up" && t.url) {
      var link = document.createElement("a");
      link.href = t.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "mono";
      link.textContent = t.url.replace("https://", "");
      link.title = t.url;
      statusWrap.appendChild(link);
      statusWrap.appendChild(makeCopyButton(function () { return t.url; }));
    } else if (t.status === "starting") {
      var spin = document.createElement("span");
      spin.className = "spinner";
      statusWrap.appendChild(spin);
      statusWrap.appendChild(document.createTextNode("Starting\\u2026"));
    } else if (t.status === "error") {
      var errDot = document.createElement("span");
      errDot.className = "dot down";
      statusWrap.appendChild(errDot);
      var errText = document.createElement("span");
      errText.className = "tunnel-error-text";
      errText.textContent = "Error: " + (t.error || "tunnel failed to start");
      errText.title = t.error || "Tunnel error";
      statusWrap.appendChild(errText);
    } else {
      var dash = document.createElement("span");
      dash.className = "dim";
      dash.textContent = "\\u2014";
      statusWrap.appendChild(dash);
    }
    td.appendChild(statusWrap);
    return td;
  }

  function shareButton(row) {
    var t = tunnelInfo(row);
    var isOn = t.enabled || t.status === "up" || t.status === "starting";
    var isRetry = !isOn && t.status === "error";
    var shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "btn btn-sm" + (isOn ? " btn-danger" : "");
    shareBtn.textContent = isOn ? "Unshare" : (isRetry ? "Retry" : "Share");
    shareBtn.title = isOn ? "Stop the public tunnel" : (isRetry ? "Retry starting the tunnel" : "Share on a public trycloudflare.com URL");
    if (!cloudflaredInstalled && !isOn) {
      shareBtn.disabled = true;
      shareBtn.title = "Install cloudflared first";
    }
    shareBtn.addEventListener("click", function () {
      if (!isOn && !window.confirm("This will make " + row.host + " reachable from the internet by anyone with the link. Continue?")) return;
      shareBtn.disabled = true;
      shareBtn.classList.add("busy");
      apiFetch("/api/hosts/" + encodeURIComponent(row.host), { method: "PUT", body: JSON.stringify({ tunnel: !isOn }) })
        .then(function () {
          showToast(isOn ? "Stopping tunnel for " + row.host : "Starting tunnel for " + row.host, "success");
          return loadHosts();
        })
        .catch(function (err) {
          apiError(err, "Couldn't change sharing for " + row.host);
          shareBtn.disabled = false;
          shareBtn.classList.remove("busy");
        });
    });
    return shareBtn;
  }

  var allowDialog = document.getElementById("allow-dialog");
  var allowHostEl = document.getElementById("allow-host");
  var allowWarnEl = document.getElementById("allow-warn");
  var allowListEl = document.getElementById("allow-list");
  var allowInput = document.getElementById("allow-input");
  var allowAddBtn = document.getElementById("allow-add");
  var allowErrorEl = document.getElementById("allow-error");
  var allowCancelBtn = document.getElementById("allow-cancel");
  var allowSaveBtn = document.getElementById("allow-save");
  var allowCloseBtn = document.getElementById("allow-close");
  var allowOriginal = [];
  var allowCurrent = [];
  var allowRow = null;

  function allowListsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function updateAllowSave() {
    allowSaveBtn.disabled = allowListsEqual(allowCurrent, allowOriginal);
  }

  function renderAllowList() {
    clear(allowListEl);
    if (!allowCurrent.length) {
      var empty = document.createElement("div");
      empty.className = "dim allow-empty";
      empty.textContent = "No internal addresses. Shared visitors reach public hosts only.";
      allowListEl.appendChild(empty);
      return;
    }
    allowCurrent.forEach(function (entry) {
      var entryRow = document.createElement("div");
      entryRow.className = "allow-row";
      var text = document.createElement("span");
      text.className = "mono";
      text.textContent = entry;
      entryRow.appendChild(text);
      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "allow-remove";
      removeBtn.textContent = "\\u00d7";
      removeBtn.setAttribute("aria-label", "Remove " + entry);
      removeBtn.addEventListener("click", function () {
        allowCurrent = allowCurrent.filter(function (item) { return item !== entry; });
        renderAllowList();
        updateAllowSave();
      });
      entryRow.appendChild(removeBtn);
      allowListEl.appendChild(entryRow);
    });
  }

  function allowAddEntry() {
    var value = allowInput.value.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\\/\\//, "").replace(/\\/$/, "");
    allowErrorEl.hidden = true;
    allowErrorEl.textContent = "";
    if (!value || /\\s/.test(value)) {
      allowErrorEl.textContent = "Enter a host or host:port, e.g. localhost:3000.";
      allowErrorEl.hidden = false;
      return;
    }
    if (allowCurrent.indexOf(value) !== -1) {
      allowErrorEl.textContent = value + " is already in the list.";
      allowErrorEl.hidden = false;
      return;
    }
    allowCurrent.push(value);
    allowInput.value = "";
    renderAllowList();
    updateAllowSave();
  }

  function closeAllowDialog() {
    allowDialog.close();
  }

  function openAllowDialog(row) {
    allowRow = row;
    allowOriginal = (row.allow || []).slice();
    allowCurrent = allowOriginal.slice();
    allowHostEl.textContent = row.host;
    allowWarnEl.hidden = !!row.cors;
    allowErrorEl.hidden = true;
    allowErrorEl.textContent = "";
    allowInput.value = "";
    renderAllowList();
    allowSaveBtn.disabled = true;
    allowSaveBtn.classList.remove("busy");
    allowCancelBtn.disabled = false;
    allowDialog.showModal();
    setTimeout(function () { allowInput.focus(); }, 0);
  }

  allowAddBtn.addEventListener("click", allowAddEntry);
  allowInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); allowAddEntry(); }
  });
  allowCancelBtn.addEventListener("click", closeAllowDialog);
  allowCloseBtn.addEventListener("click", closeAllowDialog);
  allowDialog.addEventListener("click", function (e) {
    if (e.target === allowDialog) closeAllowDialog();
  });

  allowSaveBtn.addEventListener("click", function () {
    if (!allowRow) return;
    var host = allowRow.host;
    allowSaveBtn.disabled = true;
    allowSaveBtn.classList.add("busy");
    allowCancelBtn.disabled = true;
    apiFetch("/api/hosts/" + encodeURIComponent(host), { method: "PUT", body: JSON.stringify({ allow: allowCurrent }) })
      .then(function () {
        showToast("Saved internal access for " + host, "success");
        closeAllowDialog();
        return loadHosts();
      })
      .catch(function (err) {
        allowErrorEl.textContent = err && err.message ? err.message : String(err);
        allowErrorEl.hidden = false;
        allowSaveBtn.disabled = false;
        allowSaveBtn.classList.remove("busy");
        allowCancelBtn.disabled = false;
      });
  });

  function labelCells(tr, labels) {
    for (var i = 0; i < tr.children.length; i++) tr.children[i].setAttribute("data-label", labels[i] || "");
  }

  function buildDisplayRow(tr, row) {
    clear(tr);
    tr.classList.toggle("row-down", !row.probe.up);

    var hostTd = document.createElement("td");
    hostTd.className = "host-td mono";
    var hostWrap = document.createElement("span");
    hostWrap.className = "host-cell";
    var href = (row.urls && (row.urls.https || row.urls.http)) || "";
    var a = document.createElement("a");
    if (/^https?:\\/\\//.test(href)) a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = row.host;
    hostWrap.appendChild(a);
    hostWrap.appendChild(makeCopyButton(function () { return href || row.host; }));
    if (row.remote) {
      var viaBadge = document.createElement("span");
      viaBadge.className = "badge badge-via";
      viaBadge.textContent = "via " + row.remote.name;
      viaBadge.title = "Imported from remote \\"" + row.remote.name + "\\"";
      hostWrap.appendChild(viaBadge);
    }
    hostTd.appendChild(hostWrap);
    var targetLine = document.createElement("div");
    targetLine.className = "host-target mono";
    var targetText = row.remote ? (row.remote.name + ": " + row.remote.host) : row.target;
    targetLine.textContent = targetText;
    targetLine.title = targetText;
    hostTd.appendChild(targetLine);
    tr.appendChild(hostTd);

    tr.appendChild(makeCell("\\u2192", "arrow"));

    var optionsTd = document.createElement("td");
    var flags = [];
    if (row.insecure) flags.push(["insecure", "Upstream TLS certificate is not verified", "badge-warn"]);
    if (row.cors) flags.push(["cors", "Origin/Referer rewritten to the target; any origin may call this host", "badge-cors"]);
    if (row.allow && row.allow.length) flags.push(["allow " + row.allow.length, row.allow.join(", "), "badge-accent"]);
    if (flags.length) {
      optionsTd.className = "badges";
      flags.forEach(function (flag) {
        var badge = document.createElement("span");
        badge.className = "badge " + flag[2];
        badge.textContent = flag[0];
        badge.title = flag[1];
        optionsTd.appendChild(badge);
      });
    } else {
      optionsTd.className = "dim";
      optionsTd.textContent = "\\u2014";
    }
    tr.appendChild(optionsTd);

    var statusTd = document.createElement("td");
    statusTd.className = "status-td";
    statusTd.appendChild(statusPill(row));
    var st = row.stats || { hits: 0, errors: 0 };
    var traffic = st.hits + " hits";
    if (st.errors) traffic += " · " + st.errors + " err";
    if (typeof st.avgMs === "number") traffic += " · " + Math.round(st.avgMs) + "ms";
    var trafficLine = document.createElement("div");
    trafficLine.className = "traffic";
    trafficLine.textContent = traffic;
    trafficLine.title = "Last access: " + (st.lastAccess ? fmtRelative(st.lastAccess) : "never");
    statusTd.appendChild(trafficLine);
    tr.appendChild(statusTd);

    tr.appendChild(tunnelCell(row));

    var actionsTd = document.createElement("td");
    var actionsWrap = document.createElement("div");
    actionsWrap.className = "row-actions";
    actionsTd.appendChild(actionsWrap);
    var accessBtn = document.createElement("button");
    accessBtn.type = "button";
    var allowCount = row.allow ? row.allow.length : 0;
    accessBtn.className = "btn btn-sm btn-icon" + (allowCount ? " is-set" : "");
    accessBtn.title = allowCount ? "Internal access: " + row.allow.join(", ") : "Internal access: let shared visitors reach addresses such as localhost:3000";
    accessBtn.setAttribute("aria-label", "Internal access for " + row.host);
    var accessSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    accessSvg.setAttribute("viewBox", "0 0 24 24");
    accessSvg.setAttribute("aria-hidden", "true");
    var accessPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    accessPath.setAttribute("d", "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3zM9.5 12l1.8 1.8L15 10");
    accessSvg.appendChild(accessPath);
    accessBtn.appendChild(accessSvg);
    accessBtn.addEventListener("click", function () { openAllowDialog(row); });
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () { enterEditMode(row); });
    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-sm btn-danger";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", function () {
      if (prefs.confirm && !window.confirm("Remove host " + row.host + "?")) return;
      removeBtn.disabled = true;
      apiFetch("/api/hosts/" + encodeURIComponent(row.host), { method: "DELETE" })
        .then(function () {
          showToast("Removed " + row.host, "success");
          return loadHosts();
        })
        .catch(function (err) {
          apiError(err, "Couldn't remove " + row.host);
          removeBtn.disabled = false;
        });
    });
    if (!row.remote) {
      actionsWrap.appendChild(shareButton(row));
      actionsWrap.appendChild(accessBtn);
      actionsWrap.appendChild(editBtn);
    }
    actionsWrap.appendChild(removeBtn);
    tr.appendChild(actionsTd);
    labelCells(tr, ["", "", "Options", "Status", "Public URL", ""]);
  }

  function enterEditMode(row) {
    editingHost = row.host;
    var tr = rowElements[row.host];
    if (!tr) return;
    clear(tr);

    var hostTd = makeCell(null, "host-td mono");
    var hostName = document.createElement("div");
    hostName.className = "host-cell";
    hostName.textContent = row.host;
    hostTd.appendChild(hostName);
    tr.appendChild(hostTd);
    tr.appendChild(makeCell("\\u2192", "arrow"));

    var targetInput = document.createElement("input");
    targetInput.type = "text";
    targetInput.className = "edit-input mono";
    targetInput.value = row.target;
    targetInput.title = row.target;
    targetInput.setAttribute("aria-label", "Target for " + row.host);
    hostTd.appendChild(targetInput);

    var insecureTd = document.createElement("td");
    var insecureLabel = document.createElement("label");
    insecureLabel.className = "inline-check";
    var insecureInput = document.createElement("input");
    insecureInput.type = "checkbox";
    insecureInput.checked = !!row.insecure;
    insecureLabel.appendChild(insecureInput);
    insecureLabel.appendChild(document.createTextNode("insecure"));
    insecureTd.appendChild(insecureLabel);
    var corsLabel = document.createElement("label");
    corsLabel.className = "inline-check";
    var corsInput = document.createElement("input");
    corsInput.type = "checkbox";
    corsInput.checked = !!row.cors;
    corsLabel.appendChild(corsInput);
    corsLabel.appendChild(document.createTextNode("cors"));
    insecureTd.appendChild(corsLabel);
    tr.appendChild(insecureTd);

    var hintTd = makeCell("Enter to save \\u00b7 Esc to cancel", "dim edit-hint");
    hintTd.colSpan = 2;
    tr.appendChild(hintTd);

    var actionsTd = document.createElement("td");
    var actionsWrap = document.createElement("div");
    actionsWrap.className = "row-actions";
    actionsTd.appendChild(actionsWrap);
    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-sm btn-primary";
    saveBtn.textContent = "Save";
    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-sm btn-ghost";
    cancelBtn.textContent = "Cancel";

    saveBtn.addEventListener("click", function () {
      var newTarget = targetInput.value.trim();
      if (!newTarget) {
        targetInput.classList.add("invalid");
        targetInput.setAttribute("aria-invalid", "true");
        targetInput.focus();
        return;
      }
      saveBtn.disabled = true;
      saveBtn.classList.add("busy");
      cancelBtn.disabled = true;
      apiFetch("/api/hosts/" + encodeURIComponent(row.host), {
        method: "PUT",
        body: JSON.stringify({ target: newTarget, insecure: !!insecureInput.checked, cors: !!corsInput.checked })
      })
        .then(function () {
          editingHost = null;
          showToast("Updated " + row.host, "success");
          return loadHosts();
        })
        .catch(function (err) {
          hintTd.textContent = "Couldn't save: " + (err && err.message ? err.message : err) + ". Fix it and press Enter to retry.";
          hintTd.className = "edit-hint edit-error";
          saveBtn.disabled = false;
          saveBtn.classList.remove("busy");
          cancelBtn.disabled = false;
        });
    });

    cancelBtn.addEventListener("click", function () {
      editingHost = null;
      buildDisplayRow(tr, row);
    });

    targetInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); saveBtn.click(); }
      if (e.key === "Escape") { e.preventDefault(); cancelBtn.click(); }
    });
    setTimeout(function () { targetInput.focus(); targetInput.select(); }, 0);

    actionsWrap.appendChild(saveBtn);
    actionsWrap.appendChild(cancelBtn);
    tr.appendChild(actionsTd);
    labelCells(tr, ["", "", "Options", "", ""]);
  }

  function renderHosts(hosts) {
    try { localStorage.setItem("locadot.hostCount", String(hosts.length || 1)); } catch (e) {}
    hideHostsSkeleton();
    lastHosts = hosts;
    if (inviteRoleSelect.value === "viewer" && !inviteHostsWrap.hidden) renderInviteHostChecks();
    emptyEl.hidden = hosts.length !== 0;
    tableWrap.hidden = hosts.length === 0;

    var seen = {};
    hosts.forEach(function (row) {
      seen[row.host] = true;
      if (editingHost === row.host) return;
      var tr = rowElements[row.host];
      if (!tr) {
        tr = document.createElement("tr");
        rowElements[row.host] = tr;
      }
      buildDisplayRow(tr, row);
      tbody.appendChild(tr);
    });
    Object.keys(rowElements).forEach(function (host) {
      if (!seen[host]) {
        var tr = rowElements[host];
        if (tr && tr.parentNode) tr.parentNode.removeChild(tr);
        delete rowElements[host];
        if (editingHost === host) editingHost = null;
      }
    });
    hostsCountEl.textContent = String(hosts.length);
    hostsCountEl.hidden = false;
    sbHostsCountEl.textContent = String(hosts.length);
    sbHostsCountEl.hidden = false;
    applyHostsFilter();
  }

  function applyHostsFilter() {
    var q = (hostsFilterInput.value || "").trim().toLowerCase();
    Object.keys(rowElements).forEach(function (host) {
      var tr = rowElements[host];
      var target = "";
      for (var i = 0; i < lastHosts.length; i++) if (lastHosts[i].host === host) { target = lastHosts[i].target || ""; break; }
      tr.hidden = !!q && (host + " " + target).toLowerCase().indexOf(q) === -1;
    });
  }
  hostsFilterInput.addEventListener("input", applyHostsFilter);

  function loadHosts() {
    return fetch("/api/hosts").then(parseJsonOrThrow).then(renderHosts);
  }

  // ---------- logs ----------

  logsRefreshBtn.addEventListener("click", loadLogs);
  logsClearBtn.addEventListener("click", function () {
    if (!window.confirm("Clear logs?")) return;
    apiFetch("/api/logs/clear", { method: "POST" })
      .then(function () {
        showToast("Logs cleared", "success");
        return loadLogs();
      })
      .catch(function (err) { apiError(err, "Couldn't clear logs"); });
  });

  cliAddCopy.addEventListener("click", function () { copyText(cliAddPre.textContent, cliAddCopy); });
  cliCurlCopy.addEventListener("click", function () { copyText(cliCurlPre.textContent, cliCurlCopy); });
  cliTunnelCopy.addEventListener("click", function () { copyText(cliTunnelPre.textContent, cliTunnelCopy); });

  // ---------- polling ----------

  function refreshAll() {
    if (proxyStopped) return Promise.resolve();
    return Promise.all([
      fetch("/api/status").then(parseJsonOrThrow),
      fetch("/api/hosts").then(parseJsonOrThrow)
    ]).then(function (results) {
      lastStatus = results[0];
      renderHeader(lastStatus);
      renderSystemTiles(lastStatus);
      renderCli(lastStatus);
      renderHosts(results[1]);
      hideLoadError();
    }).catch(function (err) {
      document.body.classList.remove("boot");
      hideHostsSkeleton();
      markDown();
      showLoadError(err);
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !proxyStopped) {
      refreshAll().then(tickViews);
      refreshHubAndRemotes();
    }
  });


  remotesPollTimer = setInterval(function () {
    if (!document.hidden && !proxyStopped) refreshHubAndRemotes();
  }, 15000);

  // ---------- preferences (per browser) ----------

  var PREF_DEFAULTS = { refresh: 5000, start: "overview", confirm: true, insecure: false, cors: false };
  var prefs = (function () {
    var out = {};
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem("locadot.prefs") || "{}") || {}; } catch (e) {}
    Object.keys(PREF_DEFAULTS).forEach(function (k) { out[k] = saved[k] !== undefined ? saved[k] : PREF_DEFAULTS[k]; });
    return out;
  })();
  function savePrefs() {
    try { localStorage.setItem("locadot.prefs", JSON.stringify(prefs)); } catch (e) {}
  }

  function applyHostDefaults() {
    addInsecureInput.checked = !!prefs.insecure;
    addCorsInput.checked = !!prefs.cors;
  }
  applyHostDefaults();

  function setSwitch(el, on) {
    el.setAttribute("aria-checked", String(on));
    el.classList.toggle("on", on);
  }

  // ---------- sidebar + routing ----------

  var VIEWS = ["overview", "hosts", "sharing", "remote", "machines", "logs", "settings"];
  var TITLES = { overview: "Overview", hosts: "Hosts", sharing: "Public sharing", remote: "Remote access", machines: "Connected machines", logs: "Logs", settings: "Settings" };
  var rootEl = document.documentElement;
  var sidebarEl = document.getElementById("sidebar");
  var collapseBtn = document.getElementById("sb-collapse");
  var menuBtn = document.getElementById("sb-menu");
  var backdropEl = document.getElementById("sb-backdrop");
  var navLinks = Array.prototype.slice.call(sidebarEl.querySelectorAll("a.sb-link"));
  var viewEls = {};
  Array.prototype.forEach.call(document.querySelectorAll("section.view"), function (el) { viewEls[el.getAttribute("data-view")] = el; });
  var drawerMq = window.matchMedia("(max-width: 899px)");
  var currentView = null;

  function isCollapsed() { return rootEl.getAttribute("data-sidebar") === "collapsed"; }
  function setCollapsed(collapsed, persist) {
    if (collapsed) rootEl.setAttribute("data-sidebar", "collapsed");
    else rootEl.removeAttribute("data-sidebar");
    if (persist) { try { localStorage.setItem("locadot.sidebar", collapsed ? "collapsed" : "expanded"); } catch (e) {} }
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    collapseBtn.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    collapseBtn.querySelector(".sb-label").textContent = collapsed ? "Expand" : "Collapse";
    setSwitch(prefSidebar, collapsed);
  }
  collapseBtn.addEventListener("click", function () { setCollapsed(!isCollapsed(), true); });

  function setDrawer(open) {
    document.body.classList.toggle("sb-open", open);
    backdropEl.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    if (open && navLinks[0]) navLinks[0].focus();
  }
  menuBtn.addEventListener("click", function () { setDrawer(!document.body.classList.contains("sb-open")); });
  backdropEl.addEventListener("click", function () { setDrawer(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("sb-open")) { setDrawer(false); menuBtn.focus(); }
  });
  if (drawerMq.addEventListener) drawerMq.addEventListener("change", function () { if (!drawerMq.matches) setDrawer(false); });

  function viewFromHash() {
    var name = (location.hash || "").replace(/^#\\/?/, "");
    return VIEWS.indexOf(name) !== -1 ? name : null;
  }

  function showView(name) {
    if (VIEWS.indexOf(name) === -1) name = "overview";
    var changed = currentView !== name;
    currentView = name;
    VIEWS.forEach(function (v) { if (viewEls[v]) viewEls[v].hidden = v !== name; });
    navLinks.forEach(function (a) {
      if (a.getAttribute("data-view") === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = TITLES[name] + " · locadot";
    try { localStorage.setItem("locadot.lastView", name); } catch (e) {}
    if (drawerMq.matches) setDrawer(false);
    if (changed) {
      window.scrollTo(0, 0);
      onViewEnter(name);
    }
  }

  function onViewEnter(name) {
    if (name === "logs") loadLogs();
    if (name === "overview") { renderOverview(); loadOverviewLogs(); }
    if (name === "sharing") renderShareList();
    if (name === "settings") loadSettings();
    if (name === "remote" || name === "machines") refreshHubAndRemotes();
  }

  window.addEventListener("hashchange", function () { showView(viewFromHash() || "overview"); });

  // ---------- overview ----------

  var ovHostsEl = document.getElementById("ov-hosts");
  var ovHostsSubEl = document.getElementById("ov-hosts-sub");
  var ovDownEl = document.getElementById("ov-down");
  var ovHitsEl = document.getElementById("ov-hits");
  var ovHitsSubEl = document.getElementById("ov-hits-sub");
  var ovSharesEl = document.getElementById("ov-shares");
  var ovSharesSubEl = document.getElementById("ov-shares-sub");
  var ovHubEl = document.getElementById("ov-hub");
  var ovHubSubEl = document.getElementById("ov-hub-sub");
  var ovRemotesEl = document.getElementById("ov-remotes");
  var ovRemotesSubEl = document.getElementById("ov-remotes-sub");
  var ovHostList = document.getElementById("ov-host-list");
  var ovHostEmpty = document.getElementById("ov-host-empty");
  var ovChecks = document.getElementById("ov-checks");
  var ovLogs = document.getElementById("ov-logs");
  var sbSharesCountEl = document.getElementById("sb-shares-count");
  var sbHubDot = document.getElementById("sb-hub-dot");

  function isShared(row) {
    var t = tunnelInfo(row);
    return t.enabled || t.status === "up" || t.status === "starting";
  }

  function ovRow(title, sub, side, dotClass, href) {
    var row = document.createElement(href ? "a" : "div");
    row.className = "ov-row";
    if (href) { row.href = href; row.style.color = "inherit"; row.style.textDecoration = "none"; }
    var dot = document.createElement("span");
    dot.className = "dot" + (dotClass ? " " + dotClass : "");
    row.appendChild(dot);
    var main = document.createElement("div");
    main.className = "ov-main";
    var t = document.createElement("span");
    t.className = "ov-title";
    t.textContent = title;
    main.appendChild(t);
    if (sub) {
      var s = document.createElement("span");
      s.className = "ov-sub";
      s.textContent = sub;
      main.appendChild(s);
    }
    row.appendChild(main);
    var sideEl = document.createElement("div");
    sideEl.className = "ov-side";
    if (typeof side === "string") sideEl.textContent = side;
    else if (side) sideEl.appendChild(side);
    row.appendChild(sideEl);
    return row;
  }

  function fmtNum(n) { return n >= 10000 ? Math.round(n / 1000) + "k" : String(n); }

  function renderOverview() {
    var hosts = lastHosts || [];
    var up = 0, hits = 0, errors = 0, shared = 0, remoteCount = 0;
    hosts.forEach(function (h) {
      if (h.probe && h.probe.up) up++;
      if (h.stats) { hits += h.stats.hits || 0; errors += h.stats.errors || 0; }
      if (isShared(h)) shared++;
      if (h.remote) remoteCount++;
    });
    var down = hosts.length - up;
    if (lastStatus) {
      ovHostsEl.textContent = String(hosts.length);
      ovHostsSubEl.textContent = up + " up" + (remoteCount ? " · " + remoteCount + " from other machines" : "");
      ovDownEl.textContent = String(down);
      ovDownEl.className = "tile-big" + (down ? " bad" : " ok");
      ovHitsEl.textContent = fmtNum(hits);
      ovHitsSubEl.textContent = errors ? errors + " errors since start" : "since the proxy started";
      ovSharesEl.textContent = String(shared);
      ovSharesSubEl.textContent = cloudflaredInstalled ? (shared ? "public right now" : "nothing public") : "cloudflared not installed";
    }
    sbSharesCountEl.textContent = String(shared);
    sbSharesCountEl.hidden = shared === 0;

    var hub = lastHub;
    var hubLabels = { off: "Off", starting: "Starting", login: "Login needed", up: "On", error: "Error" };
    if (hub) {
      ovHubEl.textContent = hubLabels[hub.status] || hub.status;
      ovHubEl.className = "tile-big tile-word" + (hub.status === "up" ? " ok" : hub.status === "error" ? " bad" : hub.status === "off" ? "" : " warn");
      ovHubSubEl.textContent = hub.url ? hub.url.replace(/^https?:\\/\\//, "") : (hub.status === "off" ? "not shared" : "");
      sbHubDot.hidden = hub.status === "off";
      sbHubDot.className = "dot sb-dot " + (hub.status === "up" ? "up" : hub.status === "error" ? "down" : "warn");
    }
    var remotes = lastRemotes || [];
    ovRemotesEl.textContent = String(remotes.length);
    ovRemotesSubEl.textContent = remotes.length ? remotes.map(function (r) { return r.name; }).join(", ") : "none";

    clear(ovHostList);
    ovHostEmpty.hidden = hosts.length !== 0 || !lastStatus;
    var sorted = hosts.slice().sort(function (a, b) {
      var au = a.probe && a.probe.up ? 1 : 0, bu = b.probe && b.probe.up ? 1 : 0;
      return au - bu || a.host.localeCompare(b.host);
    });
    sorted.slice(0, 8).forEach(function (h) {
      var p = h.probe || {};
      var side = p.up ? ((p.status || "") + (p.ms !== undefined ? " · " + p.ms + "ms" : "")) : (p.error || "down");
      var sub = h.remote ? "via " + h.remote.name : h.target;
      ovHostList.appendChild(ovRow(h.host, sub, side, p.up ? "up" : "down", "#/hosts"));
    });
    if (sorted.length > 8) {
      var more = document.createElement("a");
      more.className = "ov-more";
      more.href = "#/hosts";
      more.textContent = "View all " + sorted.length + " hosts";
      ovHostList.appendChild(more);
    }

    clear(ovChecks);
    if (lastStatus) {
      var sys = lastStatus.system, proxy = lastStatus.proxy;
      ovChecks.appendChild(ovRow("Running", "pid " + proxy.pid + " · uptime " + fmtUptime(lastStatus.uptimeSec), "http :" + proxy.httpPort + " · https :" + proxy.httpsPort, "up"));
      ovChecks.appendChild(ovRow("HTTPS certificates", sys.caTrusted === true ? "local CA is trusted" : "browsers will warn until the CA is trusted", sys.caTrusted === true ? "Trusted" : "Not trusted", sys.caTrusted === true ? "up" : "warn", "#/settings"));
      ovChecks.appendChild(ovRow("Start at boot", sys.startup.method ? "via " + sys.startup.method : "", sys.startup.enabled ? "Enabled" : "Disabled", sys.startup.enabled ? "up" : "", "#/settings"));
      var cf = sys.cloudflared || {};
      ovChecks.appendChild(ovRow("cloudflared", cf.installed ? (cf.version || cf.path || "") : "needed for public sharing and remote access", cf.installed ? "Installed" : "Missing", cf.installed ? "up" : "warn", "#/sharing"));
    }
  }

  function loadOverviewLogs() {
    return fetch("/api/logs?lines=12").then(parseJsonOrThrow).then(function (data) {
      var lines = (data && data.lines) || [];
      ovLogs.textContent = lines.length ? lines.join("\\n") : "No log lines yet.";
      ovLogs.scrollTop = ovLogs.scrollHeight;
    }).catch(function () {});
  }

  // ---------- public sharing page ----------

  var shareListEl = document.getElementById("share-list");
  var shareEmptyEl = document.getElementById("share-empty");
  var shareCountEl = document.getElementById("share-count");

  function renderShareList() {
    var hosts = (lastHosts || []).filter(function (h) { return !h.remote; });
    clear(shareListEl);
    shareEmptyEl.hidden = hosts.length !== 0;
    var shared = hosts.filter(isShared).length;
    shareCountEl.textContent = shared + " public";
    shareCountEl.hidden = hosts.length === 0;
    hosts.slice().sort(function (a, b) { return (isShared(b) ? 1 : 0) - (isShared(a) ? 1 : 0) || a.host.localeCompare(b.host); }).forEach(function (h) {
      var t = tunnelInfo(h);
      var side = document.createElement("div");
      side.className = "ov-side";
      if (t.status === "up" && t.url) {
        var a = document.createElement("a");
        a.className = "ov-link";
        a.href = t.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = t.url.replace(/^https:\\/\\//, "");
        side.appendChild(a);
        side.appendChild(makeCopyButton(function () { return t.url; }));
      }
      side.appendChild(shareButton(h));
      var sub = t.status === "up" ? "public" : t.status === "starting" ? "starting tunnel…" : t.status === "error" ? ("error: " + (t.error || "tunnel failed")) : h.target;
      var dot = t.status === "up" ? "up" : t.status === "starting" ? "warn" : t.status === "error" ? "down" : "";
      shareListEl.appendChild(ovRow(h.host, sub, side, dot));
    });
  }

  // ---------- logs page ----------

  var logsFilter = document.getElementById("logs-filter");
  var logsLevel = document.getElementById("logs-level");
  var logsLines = document.getElementById("logs-lines");
  var logsAuto = document.getElementById("logs-auto");
  var logsDownload = document.getElementById("logs-download");
  var logsMeta = document.getElementById("logs-meta");
  var lastLogLines = [];
  var LEVELS = { error: 0, warn: 1, info: 2 };

  function lineLevel(line) {
    var m = /\\[(error|warn|info|debug|verbose|silly)\\]/i.exec(line);
    return m ? m[1].toLowerCase() : "info";
  }

  function renderLogs() {
    var q = (logsFilter.value || "").trim().toLowerCase();
    var lvl = logsLevel.value;
    var shown = lastLogLines.filter(function (line) {
      if (q && line.toLowerCase().indexOf(q) === -1) return false;
      if (lvl) {
        var l = LEVELS[lineLevel(line)];
        if (l === undefined || l > LEVELS[lvl]) return false;
      }
      return true;
    });
    var atBottom = logsBox.scrollHeight - logsBox.scrollTop - logsBox.clientHeight < 40;
    logsBox.textContent = shown.length ? shown.join("\\n") : (lastLogLines.length ? "No lines match." : "No log lines yet.");
    if (atBottom) logsBox.scrollTop = logsBox.scrollHeight;
    logsMeta.textContent = (shown.length === lastLogLines.length ? lastLogLines.length + " lines" : shown.length + " of " + lastLogLines.length + " lines") + " · updated " + new Date().toLocaleTimeString();
  }

  function loadLogs() {
    return fetch("/api/logs?lines=" + encodeURIComponent(logsLines.value)).then(parseJsonOrThrow).then(function (data) {
      lastLogLines = (data && data.lines) || [];
      renderLogs();
    }).catch(function (err) { apiError(err, "Couldn't load logs"); });
  }

  logsFilter.addEventListener("input", renderLogs);
  logsLevel.addEventListener("change", renderLogs);
  logsLines.addEventListener("change", loadLogs);
  logsDownload.addEventListener("click", function () {
    var blob = new Blob([lastLogLines.join("\\n") + "\\n"], { type: "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "locadot-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".log";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  // ---------- settings page ----------

  var portsForm = document.getElementById("ports-form");
  var httpPortInput = document.getElementById("set-http-port");
  var httpsPortInput = document.getElementById("set-https-port");
  var portsNote = document.getElementById("ports-note");
  var portsError = document.getElementById("ports-error");
  var portsSave = document.getElementById("ports-save");
  var restartBtn = document.getElementById("restart-proxy-btn");
  var restartNote = document.getElementById("restart-note");
  var setBind = document.getElementById("set-bind");
  var setBindNote = document.getElementById("set-bind-note");
  var setHome = document.getElementById("set-home");
  var setLogLevel = document.getElementById("set-loglevel");
  var prefTheme = document.getElementById("pref-theme");
  var prefRefresh = document.getElementById("pref-refresh");
  var prefStart = document.getElementById("pref-start");
  var prefSidebar = document.getElementById("pref-sidebar");
  var prefConfirm = document.getElementById("pref-confirm");
  var prefInsecure = document.getElementById("pref-insecure");
  var prefCors = document.getElementById("pref-cors");
  var tokenValue = document.getElementById("token-value");
  var tokenReveal = document.getElementById("token-reveal");
  var tokenCopy = document.getElementById("token-copy");
  var dangerClearLogs = document.getElementById("danger-clear-logs");
  var settingsLoaded = null;

  function renderSettings(s) {
    settingsLoaded = s;
    if (s.uiAuth) renderUiAuth(s.uiAuth.enabled);
    if (document.activeElement !== httpPortInput) httpPortInput.value = String((s.saved && s.saved.httpPort) || s.httpPort);
    if (document.activeElement !== httpsPortInput) httpsPortInput.value = String((s.saved && s.saved.httpsPort) || s.httpsPort);
    var notes = ["Running on http :" + s.httpPort + " and https :" + s.httpsPort + "."];
    if (s.env && s.env.httpPort) notes.push("LOCADOT_HTTP_PORT is set and overrides the saved HTTP port.");
    if (s.env && s.env.httpsPort) notes.push("LOCADOT_HTTPS_PORT is set and overrides the saved HTTPS port.");
    portsNote.textContent = notes.join(" ");
    restartNote.hidden = !s.restartRequired;
    setBind.textContent = (s.bind || []).join(", ");
    setBindNote.textContent = s.env && s.env.bind ? "Set by LOCADOT_BIND." : "Loopback only. Set LOCADOT_BIND to change it.";
    setHome.textContent = s.stateDir || "";
    setLogLevel.textContent = s.logLevel || "info";
  }

  function loadSettings() {
    return fetch("/api/settings").then(parseJsonOrThrow).then(renderSettings).catch(function (err) { apiError(err, "Couldn't load settings"); });
  }

  portsForm.addEventListener("submit", function (e) {
    e.preventDefault();
    portsError.hidden = true;
    var h = parseInt(httpPortInput.value, 10), hs = parseInt(httpsPortInput.value, 10);
    var bad = function (p) { return !(p >= 1 && p <= 65535); };
    if (bad(h) || bad(hs) || h === hs) {
      portsError.textContent = h === hs ? "HTTP and HTTPS need different ports." : "Ports must be between 1 and 65535.";
      portsError.hidden = false;
      return;
    }
    portsSave.disabled = true;
    portsSave.classList.add("busy");
    apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ httpPort: h, httpsPort: hs }) })
      .then(function (s) {
        renderSettings(s);
        showToast(s.restartRequired ? "Ports saved. Restart to apply." : "Ports saved", s.warning ? "warn" : "success", s.warning);
      })
      .catch(function (err) { portsError.textContent = err.message; portsError.hidden = false; })
      .then(function () { portsSave.disabled = false; portsSave.classList.remove("busy"); });
  });

  restartBtn.addEventListener("click", function () {
    if (!window.confirm("Restart the proxy? Hosts are unavailable for a few seconds.")) return;
    var s = settingsLoaded;
    var nextPort = s ? ((s.env && s.env.httpPort) ? s.httpPort : ((s.saved && s.saved.httpPort) || s.httpPort)) : null;
    restartBtn.disabled = true;
    restartBtn.classList.add("busy");
    apiFetch("/api/proxy/restart", { method: "POST" })
      .then(function () {
        showToast("Restarting proxy…", "success");
        var base = location.protocol + "//" + location.hostname;
        var samePort = !nextPort || String(nextPort) === (location.port || "80");
        var tries = 0;
        var wait = setInterval(function () {
          tries++;
          if (!samePort) {
            var go = function () { clearInterval(wait); setTimeout(function () { location.href = base + ":" + nextPort + "/#/settings"; }, 1500); };
            if (tries > 20) return go();
            fetch("/healthz", { cache: "no-store" }).catch(go);
            return;
          }
          if (tries < 3) return;
          fetch("/healthz", { cache: "no-store" }).then(function (r) {
            if (!r.ok) return;
            clearInterval(wait);
            location.reload();
          }).catch(function () {});
          if (tries > 40) { clearInterval(wait); restartBtn.disabled = false; restartBtn.classList.remove("busy"); }
        }, 500);
      })
      .catch(function (err) {
        apiError(err, "Couldn't restart the proxy");
        restartBtn.disabled = false;
        restartBtn.classList.remove("busy");
      });
  });

  document.getElementById("set-home-copy").addEventListener("click", function (e) { copyText(setHome.textContent, e.currentTarget); });

  function syncThemeSeg(mode) {
    Array.prototype.forEach.call(prefTheme.querySelectorAll("button"), function (b) {
      b.setAttribute("aria-checked", String(b.getAttribute("data-value") === mode));
    });
  }
  prefTheme.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-value]");
    if (b) setTheme(b.getAttribute("data-value"));
  });
  syncThemeSeg(document.documentElement.getAttribute("data-theme") || "system");
  document.getElementById("theme-toggle").addEventListener("click", function () {
    syncThemeSeg(document.documentElement.getAttribute("data-theme") || "system");
  });

  prefRefresh.value = String(prefs.refresh);
  if (prefRefresh.value !== String(prefs.refresh)) prefRefresh.value = "5000";
  prefRefresh.addEventListener("change", function () {
    prefs.refresh = parseInt(prefRefresh.value, 10) || 0;
    savePrefs();
    schedulePoll();
    showToast(prefs.refresh ? "Refreshing every " + prefs.refresh / 1000 + "s" : "Auto-refresh paused", "success");
  });
  prefStart.value = prefs.start;
  prefStart.addEventListener("change", function () { prefs.start = prefStart.value; savePrefs(); });
  prefSidebar.addEventListener("click", function () { setCollapsed(!isCollapsed(), true); });

  function bindPrefSwitch(el, key, after) {
    setSwitch(el, !!prefs[key]);
    el.addEventListener("click", function () {
      prefs[key] = !prefs[key];
      savePrefs();
      setSwitch(el, prefs[key]);
      if (after) after();
    });
  }
  bindPrefSwitch(prefConfirm, "confirm");
  bindPrefSwitch(prefInsecure, "insecure", applyHostDefaults);
  bindPrefSwitch(prefCors, "cors", applyHostDefaults);

  var tokenShown = false;
  tokenReveal.addEventListener("click", function () {
    tokenShown = !tokenShown;
    tokenValue.textContent = tokenShown ? TOKEN : "••••••••••••••••";
    tokenReveal.textContent = tokenShown ? "Hide" : "Show";
  });
  tokenCopy.addEventListener("click", function () { copyText(TOKEN, tokenCopy); });
  dangerClearLogs.addEventListener("click", function () { logsClearBtn.click(); });

  // ---------- dashboard password ----------

  var uiAuthForm = document.getElementById("ui-auth-form");
  var uiAuthBadge = document.getElementById("ui-auth-badge");
  var uiAuthCurrentField = document.getElementById("ui-auth-current-field");
  var uiAuthCurrent = document.getElementById("ui-auth-current");
  var uiAuthNew = document.getElementById("ui-auth-new");
  var uiAuthRepeat = document.getElementById("ui-auth-repeat");
  var uiAuthError = document.getElementById("ui-auth-error");
  var uiAuthSave = document.getElementById("ui-auth-save");
  var uiAuthRemove = document.getElementById("ui-auth-remove");
  var signOutBtn = document.getElementById("sb-signout");

  function renderUiAuth(enabled) {
    UI_AUTH = enabled;
    uiAuthBadge.textContent = enabled ? "On" : "Off";
    uiAuthBadge.className = "badge " + (enabled ? "badge-up" : "badge-count");
    uiAuthCurrentField.hidden = !enabled;
    uiAuthSave.textContent = enabled ? "Change password" : "Set password";
    uiAuthRemove.hidden = !enabled;
    signOutBtn.hidden = !enabled;
    renderHubPanel(enabled && hubPanelSwitch.getAttribute("aria-checked") === "true");
  }
  renderUiAuth(UI_AUTH);

  function uiAuthFail(message) {
    uiAuthError.textContent = message;
    uiAuthError.hidden = false;
  }

  function sendUiAuth(body, done) {
    uiAuthError.hidden = true;
    uiAuthSave.disabled = uiAuthRemove.disabled = true;
    apiFetch("/api/settings/ui-password", { method: "PUT", body: JSON.stringify(body) })
      .then(function (res) {
        uiAuthCurrent.value = uiAuthNew.value = uiAuthRepeat.value = "";
        renderUiAuth(res.uiAuth.enabled);
        showToast(done, "success");
      })
      .catch(function (err) { uiAuthFail(err.message + (err.hint ? " " + err.hint : "")); })
      .then(function () { uiAuthSave.disabled = uiAuthRemove.disabled = false; });
  }

  uiAuthForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (uiAuthNew.value.length < 8) return uiAuthFail("The password must be at least 8 characters.");
    if (uiAuthNew.value !== uiAuthRepeat.value) return uiAuthFail("The passwords don't match.");
    if (UI_AUTH && !uiAuthCurrent.value) return uiAuthFail("Enter the current password.");
    var wasOn = UI_AUTH;
    sendUiAuth({ password: uiAuthNew.value, current: uiAuthCurrent.value }, wasOn ? "Password changed. Other sessions are signed out." : "The dashboard now asks for this password");
  });

  uiAuthRemove.addEventListener("click", function () {
    if (!uiAuthCurrent.value) return uiAuthFail("Enter the current password to remove it.");
    sendUiAuth({ enabled: false, current: uiAuthCurrent.value }, "Password removed");
  });

  signOutBtn.addEventListener("click", function () {
    fetch("/logout", { method: "POST" }).then(function () { location.reload(); });
  });

  // ---------- polling ----------

  function tickViews() {
    if (currentView === "overview") { renderOverview(); loadOverviewLogs(); }
    else renderOverview();
    if (currentView === "sharing") renderShareList();
    if (currentView === "logs" && logsAuto.checked) loadLogs();
  }

  function schedulePoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (!prefs.refresh || proxyStopped) return;
    pollTimer = setInterval(function () {
      if (!document.hidden && !proxyStopped) refreshAll().then(tickViews);
    }, prefs.refresh);
  }

  setCollapsed(isCollapsed(), false);
  var lastViewSaved = null;
  try { lastViewSaved = localStorage.getItem("locadot.lastView"); } catch (e) {}
  showView(viewFromHash() || (prefs.start === "last" ? lastViewSaved : prefs.start) || "overview");
  schedulePoll();

  refreshAll().then(tickViews);
  refreshHubAndRemotes();
})();
`;

export function renderPage(nonce: string, token: string, uiAuth = false): string {
  // The nonce and token are server-generated but still escaped before landing
  // in HTML attributes, defensively.
  const safeNonce = escapeHtml(nonce);
  const safeToken = escapeHtml(token);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="locadot-token" content="${safeToken}">
<meta name="locadot-ui-auth" content="${uiAuth ? "on" : "off"}">
<title>locadot dashboard</title>
<script nonce="${safeNonce}">try { var t = localStorage.getItem("locadot.theme"); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); var s = localStorage.getItem("locadot.sidebar"); if (s === "collapsed" || (s !== "expanded" && window.innerWidth < 1280)) document.documentElement.setAttribute("data-sidebar", "collapsed"); } catch (e) {}</script>
<style nonce="${safeNonce}">${css}</style>
</head>
<body class="boot">
<nav id="sidebar" class="sidebar" aria-label="Sections">
  <div class="sb-head">
    <span class="logo" aria-hidden="true"></span>
    <h1 class="wordmark sb-label">locadot</h1>
    <span id="version" class="muted mono sb-label"></span>
  </div>
  <div class="sb-links">
    <a class="sb-link" href="#/overview" data-view="overview" title="Overview"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg><span class="sb-label">Overview</span></a>
    <a class="sb-link" href="#/hosts" data-view="hosts" title="Hosts"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/></svg><span class="sb-label">Hosts</span><span id="sb-hosts-count" class="sb-count sb-label" hidden></span></a>
    <a class="sb-link" href="#/sharing" data-view="sharing" title="Public sharing"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg><span class="sb-label">Public sharing</span><span id="sb-shares-count" class="sb-count sb-label" hidden></span></a>
    <div class="sb-section sb-label">Remote</div>
    <a class="sb-link" href="#/remote" data-view="remote" title="Remote access"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/></svg><span class="sb-label">Remote access</span><span id="sb-hub-dot" class="dot sb-dot" hidden></span></a>
    <a class="sb-link" href="#/machines" data-view="machines" title="Connected machines"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="9" height="7" rx="1.5"/><rect x="13" y="13" width="9" height="7" rx="1.5"/><path d="M6.5 11v4.5h6.5M17.5 13V8.5H11"/></svg><span class="sb-label">Connected machines</span><span id="sb-remotes-count" class="sb-count sb-label" hidden></span></a>
    <div class="sb-section sb-label">System</div>
    <a class="sb-link" href="#/logs" data-view="logs" title="Logs"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg><span class="sb-label">Logs</span></a>
    <a class="sb-link" href="#/settings" data-view="settings" title="Settings"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span class="sb-label">Settings</span></a>
  </div>
  <button type="button" id="sb-signout" class="sb-link sb-collapse sb-signout" title="Sign out" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg><span class="sb-label">Sign out</span></button>
  <button type="button" id="sb-collapse" class="sb-link sb-collapse" aria-controls="sidebar" aria-expanded="true" title="Collapse sidebar"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 10l-2 2 2 2"/></svg><span class="sb-label">Collapse</span></button>
</nav>
<div id="sb-backdrop" class="sb-backdrop" hidden></div>
<div class="shell">
<header>
  <div class="topbar">
    <div class="brand">
      <button type="button" id="sb-menu" class="btn sb-menu" aria-controls="sidebar" aria-expanded="false" aria-label="Open navigation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <span class="logo brand-mobile" aria-hidden="true"></span>
      <span class="wordmark brand-mobile">locadot</span>
    </div>
    <div class="header-meta">
      <span class="chip chip-live"><span id="live-dot" class="live-dot"></span> <span id="live-label" class="live-label">live</span></span>
      <span id="uptime" class="chip"></span>
      <span id="pid" class="chip"></span>
      <span id="updated"></span>
      <button type="button" id="theme-toggle" class="btn theme-toggle" data-mode="system" title="Theme: system" aria-label="Theme: system (click to change)">
        <svg class="i-system" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
        <svg class="i-light" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <svg class="i-dark" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      </button>
    </div>
  </div>
</header>
<main>
  <div id="stopped-banner" class="banner" role="status" hidden></div>
  <div id="load-error-banner" class="banner" role="alert" hidden>
    <div class="banner-row">
      <span id="load-error-text"></span>
      <button type="button" id="load-error-retry" class="btn btn-sm">Retry</button>
    </div>
  </div>

  <section class="view" data-view="overview" aria-label="Overview">
    <div class="page-head">
      <h2 class="page-title">Overview</h2>
      <p class="page-sub">Everything locadot is doing on this machine at a glance.</p>
    </div>
    <div class="tiles">
      <a class="tile" href="#/hosts"><span class="label">Hosts</span><span id="ov-hosts" class="tile-big">—</span><span id="ov-hosts-sub" class="tile-sub"></span></a>
      <a class="tile" href="#/hosts"><span class="label">Down</span><span id="ov-down" class="tile-big">—</span><span class="tile-sub">targets not answering</span></a>
      <a class="tile" href="#/hosts"><span class="label">Requests</span><span id="ov-hits" class="tile-big">—</span><span id="ov-hits-sub" class="tile-sub">since the proxy started</span></a>
      <a class="tile" href="#/sharing"><span class="label">Public shares</span><span id="ov-shares" class="tile-big">—</span><span id="ov-shares-sub" class="tile-sub"></span></a>
      <a class="tile" href="#/remote"><span class="label">Remote access</span><span id="ov-hub" class="tile-big tile-word">—</span><span id="ov-hub-sub" class="tile-sub"></span></a>
      <a class="tile" href="#/machines"><span class="label">Connected machines</span><span id="ov-remotes" class="tile-big">—</span><span id="ov-remotes-sub" class="tile-sub"></span></a>
    </div>
    <div class="grid-2">
      <section class="card" aria-label="Host health">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">Host health</h3></div>
          <div class="card-tools"><a class="btn btn-sm" href="#/hosts">Manage hosts</a></div>
        </div>
        <div id="ov-host-list" class="ov-list"></div>
        <div id="ov-host-empty" class="empty" hidden>
          <span class="empty-icon" aria-hidden="true">+</span>
          <p>No hosts yet.</p>
          <a class="btn btn-sm btn-primary" href="#/hosts">Add your first host</a>
        </div>
      </section>
      <section class="card" aria-label="Proxy status">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">Proxy</h3></div>
          <div class="card-tools"><a class="btn btn-sm" href="#/settings">Settings</a></div>
        </div>
        <div id="ov-checks" class="ov-list"></div>
      </section>
    </div>
    <section class="card" aria-label="Recent activity">
      <div class="card-head">
        <div class="card-title-wrap"><h3 class="card-title">Recent activity</h3></div>
        <div class="card-tools"><a class="btn btn-sm" href="#/logs">All logs</a></div>
      </div>
      <pre id="ov-logs" class="logs-box logs-short" aria-live="off"></pre>
    </section>
  </section>

  <section class="view" data-view="hosts" aria-label="Hosts" hidden>
    <div class="page-head">
      <h2 class="page-title">Hosts</h2>
      <p class="page-sub">Local hostnames and the dev servers they proxy to.</p>
    </div>
    <div class="layout">
      <div class="col-primary">
      <section id="hosts-card" class="card" aria-label="Registered hosts">
        <div class="card-head">
          <div class="card-title-wrap">
            <h3 class="card-title">Hosts</h3>
            <span id="hosts-count" class="badge badge-count" hidden></span>
          </div>
          <div class="card-tools">
            <input type="search" id="hosts-filter" class="input input-sm input-search" placeholder="Filter hosts" aria-label="Filter hosts" autocomplete="off">
          </div>
        </div>
        <div id="hosts-skeleton" class="table-wrap" aria-hidden="true">
          <table>
            <tbody>
              <tr class="skeleton-row"><td colspan="6"><span class="skel-bar"></span></td></tr>
              <tr class="skeleton-row"><td colspan="6"><span class="skel-bar"></span></td></tr>
              <tr class="skeleton-row"><td colspan="6"><span class="skel-bar"></span></td></tr>
            </tbody>
          </table>
        </div>
        <div id="hosts-error" class="empty" hidden>
          <span class="empty-icon" aria-hidden="true">!</span>
          <p>Hosts couldn't be loaded while the proxy is unreachable.</p>
        </div>
        <div id="empty" class="empty" hidden>
          <span class="empty-icon" aria-hidden="true">+</span>
          <p>No hosts registered yet. Add one from the panel, or from the CLI:</p>
          <pre class="code-block">locadot add --host app.localhost --port 3000</pre>
        </div>
        <div id="table-wrap" class="table-wrap" hidden>
          <table id="table">
            <thead>
              <tr>
                <th scope="col">Host</th>
                <th scope="col" aria-label="Flow"></th>
                <th scope="col">Options</th>
                <th scope="col">Status</th>
                <th scope="col">Public URL</th>
                <th scope="col" class="actions">Actions</th>
              </tr>
            </thead>
            <tbody id="tbody"></tbody>
          </table>
        </div>
      </section>
      </div>
      <aside class="col-secondary">
      <section id="add-card" class="card" aria-label="Add proxy host">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">Add host</h3></div>
        </div>
        <form id="add-form" class="card-body" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="add-host">Host</label>
              <input type="text" id="add-host" name="host" placeholder="app.localhost" autocomplete="off" aria-describedby="add-error" required>
            </div>
            <div class="field">
              <label for="add-target">Target</label>
              <input type="text" id="add-target" name="target" placeholder="3000, 127.0.0.1:8080, https://&hellip;" autocomplete="off" aria-describedby="add-error" required>
            </div>
            <div class="form-checks">
              <div class="field field-checkbox">
                <input type="checkbox" id="add-insecure" name="insecure">
                <label for="add-insecure">Insecure TLS</label>
              </div>
              <div class="field field-checkbox" title="Send Origin/Referer as the target's own and let any origin call this host">
                <input type="checkbox" id="add-cors" name="cors">
                <label for="add-cors">Bypass CORS</label>
              </div>
            </div>
            <button type="submit" id="add-submit" class="btn btn-primary btn-block">Add proxy</button>
          </div>
          <div id="add-error" class="field-error" role="alert" hidden></div>
        </form>
      </section>
      </aside>
    </div>
  </section>

  <section class="view" data-view="sharing" aria-label="Public sharing" hidden>
    <div class="page-head">
      <h2 class="page-title">Public sharing</h2>
      <p class="page-sub">Put a single host on a public https://*.trycloudflare.com URL. Anyone with the link can reach it.</p>
    </div>
    <div class="layout">
      <div class="col-primary">
        <section id="share-card" class="card" aria-label="Hosts you can share">
          <div class="card-head">
            <div class="card-title-wrap"><h3 class="card-title">Hosts</h3><span id="share-count" class="badge badge-count" hidden></span></div>
          </div>
          <div id="share-list" class="ov-list"></div>
          <div id="share-empty" class="empty" hidden>
            <span class="empty-icon" aria-hidden="true">+</span>
            <p>Add a host first, then share it from here.</p>
          </div>
        </section>
      </div>
      <aside class="col-secondary">
      <section id="sharing-card" class="card" aria-label="Public sharing">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">Cloudflare Tunnel</h3></div>
        </div>
        <div class="stat-list">
          <div class="stat-row">
            <div class="stat-main">
              <div class="label">Cloudflare Tunnel</div>
              <div id="tile-cloudflared-value" class="tile-value">—</div>
              <div id="tile-cloudflared-sub" class="tile-sub mono"></div>
              <div class="tile-sub">Share a host on a public https://*.trycloudflare.com URL with the Share button. No Cloudflare account needed.</div>
              <div class="tile-actions">
                <button type="button" id="cloudflared-install-btn" class="btn btn-sm btn-primary" hidden>Install cloudflared</button>
              </div>
            </div>
          </div>
        </div>
      </section>
      </aside>
    </div>
  </section>

  <section class="view" data-view="remote" aria-label="Remote access" hidden>
    <div class="page-head">
      <h2 class="page-title">Remote access</h2>
      <p class="page-sub">Let other locadots use this machine's hosts through a Cloudflare hostname.</p>
    </div>
    <div class="layout">
      <div class="col-primary">
      <section id="hub-card" class="card" aria-label="Remote access">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">Remote access</h3></div>
        </div>
        <div class="hub-section">
          <div class="hub-row">
            <span class="pill"><span id="hub-dot" class="dot"></span><span id="hub-status-text">Off</span></span>
          </div>
          <div id="hub-url-row" class="hub-row" hidden>
            <span id="hub-url" class="hub-url"></span>
            <button type="button" id="hub-url-copy" class="copy-btn">Copy</button>
          </div>
          <div id="hub-login-row" class="hub-row" hidden>
            <a id="hub-login-link" href="#" target="_blank" rel="noopener noreferrer">Log in to Cloudflare</a>
          </div>
          <div id="hub-quick-warning" class="hub-warn" hidden>URL changes when locadot restarts &mdash; receivers must update it.</div>
          <div id="hub-error-row" class="hub-warn" hidden></div>

          <form id="hub-named-form" class="hub-form-row" novalidate>
            <div class="field">
              <label for="hub-domain">Domain</label>
              <input type="text" id="hub-domain" placeholder="hub.example.com" autocomplete="off">
            </div>
            <div class="field">
              <label for="hub-tunnel-name">Tunnel name</label>
              <input type="text" id="hub-tunnel-name" placeholder="locadot (optional)" autocomplete="off">
            </div>
            <button type="submit" id="hub-named-submit" class="btn btn-sm btn-primary">Use my domain</button>
          </form>
          <div class="hub-actions">
            <button type="button" id="hub-quick-btn" class="btn btn-sm">Use quick tunnel</button>
            <button type="button" id="hub-stop-btn" class="btn btn-sm btn-danger" hidden>Stop</button>
          </div>
          <div id="hub-localhost-row" class="toggle-row" hidden>
            <div>
              <div class="label">Admins can open this dashboard and any port</div>
              <div class="tile-sub">Admin peers get this dashboard at <span class="mono">&lt;domain&gt;.localhost</span> and this machine's localhost at <span class="mono">&lt;port&gt;.&lt;domain&gt;.localhost</span> on their side.</div>
            </div>
            <button type="button" id="hub-localhost" class="switch" role="switch" aria-checked="true" aria-label="Let admins open this dashboard and any port on this machine"><span class="switch-knob"></span></button>
          </div>
          <div id="hub-panel-row" class="toggle-row" hidden>
            <div>
              <div class="label">Share this dashboard</div>
              <div id="hub-panel-sub" class="tile-sub"></div>
            </div>
            <button type="button" id="hub-panel" class="switch" role="switch" aria-checked="false" aria-label="Share this dashboard at the public URL, behind the dashboard password"><span class="switch-knob"></span></button>
          </div>
        </div>

        <div id="hub-share-section" class="hub-section" hidden>
          <div class="label">Create pairing link</div>
          <div class="hub-form-row">
            <div class="field">
              <label for="invite-role">Role</label>
              <select id="invite-role" class="input input-sm">
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="button" id="invite-create-btn" class="btn btn-sm btn-primary">Create pairing link</button>
          </div>
          <div id="invite-hosts-wrap" class="host-checks" hidden></div>
          <div id="invite-result" class="invite-result" hidden>
            <div class="invite-result-row">
              <span id="invite-string" class="invite-string mono"></span>
              <button type="button" id="invite-copy-btn" class="copy-btn">Copy</button>
            </div>
            <div id="invite-countdown" class="invite-countdown"></div>
          </div>
        </div>

        <div class="hub-section">
          <div class="label">Peers</div>
          <div id="peers-empty" class="dim" hidden>No peers yet.</div>
          <div id="peers-list" class="peer-list"></div>
        </div>
        <div class="hub-section">
          <div class="label">Pending invites</div>
          <div id="invites-empty" class="dim" hidden>No pending invites.</div>
          <div id="invites-list" class="invite-list"></div>
        </div>
      </section>
      </div>
      <aside class="col-secondary">
        <section class="card" aria-label="Roles">
          <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">How it works</h3></div></div>
          <div class="card-body help-list">
            <p>1. Turn on a tunnel: your own domain keeps the same address; a quick tunnel is free but its URL changes on restart.</p>
            <p>2. Create a pairing link. It works once and expires after 5 minutes.</p>
            <p>3. The other machine pastes it under <a href="#/machines">Connected machines</a>.</p>
            <div class="role-table">
              <div><strong>Viewer</strong><span>browse the hosts you pick</span></div>
              <div><strong>Editor</strong><span>also add and change hosts here</span></div>
              <div><strong>Admin</strong><span>also delete hosts, change sharing, and open this dashboard and any port on this machine</span></div>
            </div>
            <p class="dim">Editors can reach anything this machine can. Change or revoke a role any time under Peers.</p>
          </div>
        </section>
      </aside>
    </div>
  </section>

  <section class="view" data-view="machines" aria-label="Connected machines" hidden>
    <div class="page-head">
      <h2 class="page-title">Connected machines</h2>
      <p class="page-sub">Other locadots you've connected to. Their hosts show up in your Hosts list.</p>
    </div>

      <section id="remotes-card" class="card" aria-label="Connected machines">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">Connected machines</h3></div>
        </div>
        <div class="hub-section">
          <form id="connect-form" class="hub-form-row" novalidate>
            <div class="field">
              <label for="connect-string">Pairing link</label>
              <input type="text" id="connect-string" placeholder="https://hub.example.com/#lnk_..." autocomplete="off">
            </div>
            <div class="field">
              <label for="connect-name">Name (optional)</label>
              <input type="text" id="connect-name" placeholder="my-mac" autocomplete="off">
            </div>
            <div class="field">
              <label for="connect-domain">Localhost domain (admins)</label>
              <input type="text" id="connect-domain" placeholder="auto: two random words" autocomplete="off">
            </div>
            <button type="submit" id="connect-submit" class="btn btn-sm btn-primary">Connect</button>
          </form>
          <div id="connect-error" class="field-error" role="alert" hidden></div>
        </div>
        <div id="remotes-empty" class="empty" hidden>
          <span class="empty-icon" aria-hidden="true">~</span>
          <p>Not connected to anything yet. Paste a pairing link above.</p>
        </div>
        <div id="remotes-list" class="remote-list"></div>
      </section>
  </section>

  <section class="view" data-view="logs" aria-label="Logs" hidden>
    <div class="page-head">
      <h2 class="page-title">Logs</h2>
      <p class="page-sub">The proxy's log file.</p>
    </div>
    <section id="logs-panel" class="card" aria-label="Logs">
      <div class="card-head logs-head">
        <div class="card-tools logs-tools">
          <input type="search" id="logs-filter" class="input input-sm input-search" placeholder="Filter lines" aria-label="Filter log lines" autocomplete="off">
          <select id="logs-level" class="input input-sm" aria-label="Level">
            <option value="">All levels</option>
            <option value="error">Errors</option>
            <option value="warn">Warnings+</option>
            <option value="info">Info+</option>
          </select>
          <select id="logs-lines" class="input input-sm" aria-label="Lines">
            <option value="200">Last 200</option>
            <option value="500">Last 500</option>
            <option value="1000">Last 1000</option>
          </select>
          <label class="check-inline"><input type="checkbox" id="logs-auto" checked> Live</label>
        </div>
        <div class="card-tools">
          <button type="button" id="logs-refresh" class="btn btn-sm">Refresh</button>
          <button type="button" id="logs-download" class="btn btn-sm">Download</button>
          <button type="button" id="logs-clear" class="btn btn-sm btn-danger">Clear</button>
        </div>
      </div>
      <pre id="logs-box" class="logs-box logs-full" aria-live="off"></pre>
      <div id="logs-meta" class="logs-meta dim"></div>
    </section>
  </section>

  <section class="view" data-view="settings" aria-label="Settings" hidden>
    <div class="page-head">
      <h2 class="page-title">Settings</h2>
      <p class="page-sub">Proxy, security and dashboard preferences.</p>
    </div>
    <div class="layout">
      <div class="col-primary">
        <section id="proxy-settings-card" class="card" aria-label="Proxy settings">
          <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">Proxy</h3></div></div>
          <form id="ports-form" class="card-body" novalidate>
            <div class="form-row-2">
              <div class="field"><label for="set-http-port">HTTP port</label><input type="number" id="set-http-port" class="input" min="1" max="65535" required></div>
              <div class="field"><label for="set-https-port">HTTPS port</label><input type="number" id="set-https-port" class="input" min="1" max="65535" required></div>
            </div>
            <div id="ports-note" class="tile-sub"></div>
            <div id="ports-error" class="field-error" role="alert" hidden></div>
            <div class="form-actions">
              <button type="submit" id="ports-save" class="btn btn-sm btn-primary">Save ports</button>
              <button type="button" id="restart-proxy-btn" class="btn btn-sm">Restart proxy</button>
            </div>
            <div id="restart-note" class="hub-warn" hidden>Saved. Restart the proxy to use the new ports.</div>
          </form>
          <div class="stat-list">
            <div class="stat-row"><div class="stat-main"><div class="label">Listening on</div><div id="set-bind" class="tile-value mono">—</div><div id="set-bind-note" class="tile-sub"></div></div></div>
            <div class="stat-row"><div class="stat-main"><div class="label">State directory</div><div id="set-home" class="tile-value mono">—</div></div><div class="stat-side"><button type="button" id="set-home-copy" class="copy-btn">Copy</button></div></div>
            <div class="stat-row"><div class="stat-main"><div class="label">Log level</div><div id="set-loglevel" class="tile-value mono">—</div><div class="tile-sub">Set LOCADOT_LOG_LEVEL before starting to change it.</div></div></div>
          </div>
        </section>

        <section class="card" aria-label="Dashboard preferences">
          <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">Dashboard</h3></div></div>
          <div class="stat-list">
            <div class="stat-row"><div class="stat-main"><div class="label">Theme</div><div class="tile-sub">Follow the system, or pick one.</div></div>
              <div class="stat-side"><div id="pref-theme" class="segmented" role="radiogroup" aria-label="Theme">
                <button type="button" role="radio" data-value="system">System</button><button type="button" role="radio" data-value="light">Light</button><button type="button" role="radio" data-value="dark">Dark</button>
              </div></div></div>
            <div class="stat-row"><div class="stat-main"><div class="label">Refresh every</div><div class="tile-sub">How often hosts and status are polled.</div></div>
              <div class="stat-side"><select id="pref-refresh" class="input input-sm" aria-label="Refresh interval">
                <option value="2000">2 seconds</option><option value="5000">5 seconds</option><option value="10000">10 seconds</option><option value="30000">30 seconds</option><option value="0">Paused</option>
              </select></div></div>
            <div class="stat-row"><div class="stat-main"><div class="label">Open on</div><div class="tile-sub">The page shown when the dashboard opens.</div></div>
              <div class="stat-side"><select id="pref-start" class="input input-sm" aria-label="Start page">
                <option value="overview">Overview</option><option value="hosts">Hosts</option><option value="last">Last visited</option>
              </select></div></div>
            <div class="stat-row"><div class="stat-main"><div class="label">Collapsed sidebar</div><div class="tile-sub">Show only icons in the sidebar.</div></div>
              <div class="stat-side"><button type="button" id="pref-sidebar" class="switch" role="switch" aria-checked="false" aria-label="Collapsed sidebar"><span class="switch-knob"></span></button></div></div>
            <div class="stat-row"><div class="stat-main"><div class="label">Ask before removing</div><div class="tile-sub">Confirm before a host is removed.</div></div>
              <div class="stat-side"><button type="button" id="pref-confirm" class="switch" role="switch" aria-checked="true" aria-label="Ask before removing"><span class="switch-knob"></span></button></div></div>
          </div>
        </section>

        <section class="card" aria-label="New host defaults">
          <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">New host defaults</h3></div></div>
          <div class="stat-list">
            <div class="stat-row"><div class="stat-main"><div class="label">Insecure TLS</div><div class="tile-sub">Accept self-signed certificates on https targets.</div></div>
              <div class="stat-side"><button type="button" id="pref-insecure" class="switch" role="switch" aria-checked="false" aria-label="Insecure TLS by default"><span class="switch-knob"></span></button></div></div>
            <div class="stat-row"><div class="stat-main"><div class="label">Bypass CORS</div><div class="tile-sub">Send the target's own Origin and allow any origin.</div></div>
              <div class="stat-side"><button type="button" id="pref-cors" class="switch" role="switch" aria-checked="false" aria-label="Bypass CORS by default"><span class="switch-knob"></span></button></div></div>
          </div>
        </section>

      <section id="cli-card" class="card" aria-label="Use from CLI or scripts">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">CLI &amp; API</h3></div>
        </div>
        <div class="card-body cli-list">
          <div class="cli-item">
            <div class="cli-item-head"><span class="label">Add a host</span><button type="button" id="cli-add-copy" class="copy-btn">Copy</button></div>
            <pre id="cli-add-pre" class="code-block mono">locadot add --host app.localhost --port 3000</pre>
          </div>
          <div class="cli-item">
            <div class="cli-item-head"><span class="label">HTTP API (scripts, AI agents)</span><button type="button" id="cli-curl-copy" class="copy-btn">Copy</button></div>
            <pre id="cli-curl-pre" class="code-block mono">curl -X POST http://localhost/api/hosts -H "X-Locadot-Token: $(locadot token)" -H 'Content-Type: application/json' -d '{"host":"app.localhost","target":"3000"}'</pre>
          </div>
          <div class="cli-item">
            <div class="cli-item-head"><span class="label">Share publicly</span><button type="button" id="cli-tunnel-copy" class="copy-btn">Copy</button></div>
            <pre id="cli-tunnel-pre" class="code-block mono">locadot tunnel --host app.localhost</pre>
          </div>
        </div>
      </section>
      </div>
      <aside class="col-secondary">
      <section id="system-card" class="card" aria-label="System status">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">System &amp; security</h3></div>
        </div>
        <div class="stat-list">
          <div class="stat-row" hidden>
            <div class="stat-main">
              <div class="label">Proxy</div>
              <div id="tile-proxy-ports" class="tile-value mono">—</div>
              <div id="tile-proxy-bind" class="tile-sub mono"></div>
              <div id="tile-proxy-statedir" class="tile-sub mono"></div>
              <div id="tile-proxy-platform" class="tile-sub"></div>
            </div>
          </div>
          <div class="stat-row">
            <div class="stat-main">
              <div class="label">Access</div>
              <div id="tile-root-value" class="tile-value">—</div>
              <div id="tile-ports-value" class="tile-sub"></div>
              <div id="tile-ports-hint" class="tile-hint" hidden></div>
            </div>
          </div>
          <div class="stat-row">
            <div class="stat-main">
              <div class="label">CA trust</div>
              <div id="tile-ca-value" class="tile-value">—</div>
            </div>
            <div class="stat-side">
              <button type="button" id="ca-toggle" class="switch" role="switch" aria-checked="false" aria-label="Toggle local CA trust">
                <span class="switch-knob"></span>
              </button>
            </div>
          </div>
          <div class="stat-row">
            <div class="stat-main">
              <div class="label">Start at boot</div>
              <div id="tile-startup-value" class="tile-value">—</div>
              <div id="tile-startup-method" class="tile-sub"></div>
            </div>
            <div class="stat-side">
              <button type="button" id="startup-toggle" class="switch" role="switch" aria-checked="false" aria-label="Toggle start at boot">
                <span class="switch-knob"></span>
              </button>
            </div>
          </div>
        </div>
      </section>

        <section id="ui-auth-card" class="card" aria-label="Dashboard password">
          <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">Dashboard password</h3><span id="ui-auth-badge" class="badge">Off</span></div></div>
          <form id="ui-auth-form" class="card-body token-body" novalidate>
            <div id="ui-auth-note" class="tile-sub">Ask for a password before the dashboard opens. Only the dashboard is protected: your hosts and scripts using the API token work as before. Forgot it? Run <code class="mono">locadot ui:password</code> in a terminal.</div>
            <div id="ui-auth-current-field" class="field" hidden><label for="ui-auth-current">Current password</label><input type="password" id="ui-auth-current" class="input" autocomplete="current-password"></div>
            <div class="form-row-2">
              <div class="field"><label for="ui-auth-new">New password</label><input type="password" id="ui-auth-new" class="input" autocomplete="new-password" minlength="8" placeholder="8+ characters"></div>
              <div class="field"><label for="ui-auth-repeat">Repeat it</label><input type="password" id="ui-auth-repeat" class="input" autocomplete="new-password"></div>
            </div>
            <div id="ui-auth-error" class="field-error" role="alert" hidden></div>
            <div class="form-actions">
              <button type="submit" id="ui-auth-save" class="btn btn-sm btn-primary">Set password</button>
              <button type="button" id="ui-auth-remove" class="btn btn-sm btn-danger" hidden>Remove password</button>
            </div>
          </form>
        </section>

        <section class="card" aria-label="API token">
          <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">API token</h3></div></div>
          <div class="card-body token-body">
            <div class="tile-sub">Scripts send it as <code class="mono">X-Locadot-Token</code>. It changes every time the proxy starts.</div>
            <div class="token-row"><code id="token-value" class="mono token-value">••••••••••••••••</code>
              <button type="button" id="token-reveal" class="copy-btn">Show</button>
              <button type="button" id="token-copy" class="copy-btn">Copy</button></div>
          </div>
        </section>

        <section class="card danger-card" aria-label="Danger zone">
          <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">Danger zone</h3></div></div>
          <div class="stat-list">
            <div class="stat-row"><div class="stat-main"><div class="label">Clear logs</div><div class="tile-sub">Empty the log file.</div></div><div class="stat-side"><button type="button" id="danger-clear-logs" class="btn btn-sm btn-danger">Clear</button></div></div>
            <div class="stat-row"><div class="stat-main"><div class="label">Stop proxy</div><div class="tile-sub">All hosts stop working until <code class="mono">locadot start</code>.</div></div><div class="stat-side"><button type="button" id="stop-proxy-btn" class="btn btn-sm btn-danger">Stop</button></div></div>
          </div>
        </section>
      </aside>
    </div>
  </section>
</main>
<footer>
  <a href="https://github.com/avinashid/locadot" target="_blank" rel="noopener noreferrer">github.com/avinashid/locadot</a>
</footer>
</div>
<dialog id="allow-dialog">
  <div class="modal-head">
    <div>
      <h3 class="modal-title">Internal access</h3>
      <p id="allow-host" class="modal-sub mono"></p>
    </div>
    <button type="button" id="allow-close" class="btn btn-ghost modal-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  </div>
  <div class="modal-body">
    <p class="modal-desc">People who open this mapping through a tunnel or remote access can only reach public hosts. Allow the internal addresses this app calls, such as its API on localhost.</p>
    <div id="allow-warn" class="modal-warn" hidden>Bypass CORS is off for this mapping. These addresses take effect once it's on, because the page reaches them through locadot's pass-through.</div>
    <div id="allow-list" class="allow-list"></div>
    <div class="allow-add-row">
      <input type="text" id="allow-input" class="input" placeholder="localhost:3000" aria-label="Address" autocomplete="off">
      <button type="button" id="allow-add" class="btn btn-sm">Add</button>
    </div>
    <p class="modal-hint">host:port, or a host alone for any port. locadot's own ports are always blocked.</p>
    <div id="allow-error" class="field-error" role="alert" hidden></div>
  </div>
  <div class="modal-foot">
    <button type="button" id="allow-cancel" class="btn">Cancel</button>
    <button type="button" id="allow-save" class="btn btn-primary" disabled>Save changes</button>
  </div>
</dialog>
<div id="toast-container" class="toast-container" aria-live="polite"></div>
<script nonce="${safeNonce}">${clientJs}</script>
</body>
</html>
`;
}

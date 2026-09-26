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
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot.up { background: var(--up); box-shadow: 0 0 0 3px var(--up-bg); }
.dot.down { background: var(--down); box-shadow: 0 0 0 3px var(--down-bg); }
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
@media (max-width: 1099px) {
  .col-primary, .col-secondary { display: contents; }
  #hosts-card { order: 1; }
  #add-card { order: 2; }
  #system-card { order: 3; }
  #sharing-card { order: 4; }
  #logs-panel { order: 5; }
  #cli-card { order: 6; }
}
@media (min-width: 700px) and (max-width: 1099px) {
  .layout { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  #hosts-card, #logs-panel, #cli-card { grid-column: 1 / -1; }
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
  (function () {
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
  })();

  var tokenMeta = document.querySelector('meta[name="locadot-token"]');
  var TOKEN = tokenMeta ? tokenMeta.getAttribute("content") : "";

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

  var lastStatus = null;
  var lastHosts = [];
  var rowElements = {};
  var editingHost = null;
  var caBusy = false;
  var startupBusy = false;
  var cfInstallBusy = false;
  var cloudflaredInstalled = false;
  var proxyStopped = false;
  var pollTimer = null;

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
    hostTd.appendChild(hostWrap);
    var targetLine = document.createElement("div");
    targetLine.className = "host-target mono";
    targetLine.textContent = row.target;
    targetLine.title = row.target;
    hostTd.appendChild(targetLine);
    tr.appendChild(hostTd);

    tr.appendChild(makeCell("\\u2192", "arrow"));

    var optionsTd = document.createElement("td");
    var flags = [];
    if (row.insecure) flags.push(["insecure", "Upstream TLS certificate is not verified"]);
    if (row.cors) flags.push(["cors", "Origin/Referer rewritten to the target; any origin may call this host"]);
    if (flags.length) {
      optionsTd.className = "badges";
      flags.forEach(function (flag) {
        var badge = document.createElement("span");
        badge.className = "badge " + (flag[0] === "cors" ? "badge-cors" : "badge-warn");
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
      if (!window.confirm("Remove host " + row.host + "?")) return;
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
    actionsWrap.appendChild(shareButton(row));
    actionsWrap.appendChild(editBtn);
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

  function loadLogs() {
    return fetch("/api/logs?lines=200").then(parseJsonOrThrow).then(function (data) {
      var lines = (data && data.lines) || [];
      logsBox.textContent = lines.length ? lines.join("\\n") : "No log lines yet.";
      logsBox.scrollTop = logsBox.scrollHeight;
    }).catch(function (err) { apiError(err, "Couldn't load logs"); });
  }

  logsPanel.addEventListener("toggle", function () {
    if (logsPanel.open) loadLogs();
  });
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
    if (!document.hidden && !proxyStopped) refreshAll();
  });

  pollTimer = setInterval(function () {
    if (!document.hidden && !proxyStopped) refreshAll();
  }, 5000);

  refreshAll();
})();
`;

export function renderPage(nonce: string, token: string): string {
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
<title>locadot dashboard</title>
<script nonce="${safeNonce}">try { var t = localStorage.getItem("locadot.theme"); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); } catch (e) {}</script>
<style nonce="${safeNonce}">${css}</style>
</head>
<body class="boot">
<header>
  <div class="topbar">
    <div class="brand">
      <span class="logo" aria-hidden="true"></span>
      <h1 class="wordmark">locadot</h1>
      <span id="version" class="muted mono"></span>
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

  <div class="page-head">
    <h2 class="page-title">Dashboard</h2>
    <p class="page-sub">Local hostnames proxied to your dev servers, with optional public sharing.</p>
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

      <details id="logs-panel" class="card">
        <summary><span class="card-title">Logs</span><span class="card-desc">last 200 lines</span></summary>
        <div class="logs-body">
          <div class="logs-actions">
            <button type="button" id="logs-refresh" class="btn btn-sm">Refresh</button>
            <button type="button" id="logs-clear" class="btn btn-sm btn-danger">Clear</button>
          </div>
          <pre id="logs-box" class="logs-box" aria-live="off"></pre>
        </div>
      </details>

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

      <section id="system-card" class="card" aria-label="System status">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">System</h3></div>
          <div class="card-tools">
            <button type="button" id="stop-proxy-btn" class="btn btn-sm btn-ghost-danger">Stop proxy</button>
          </div>
        </div>
        <div class="stat-list">
          <div class="stat-row">
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

      <section id="sharing-card" class="card" aria-label="Public sharing">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">Sharing</h3></div>
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
</main>
<footer>
  <a href="https://github.com/avinashid/locadot" target="_blank" rel="noopener noreferrer">github.com/avinashid/locadot</a>
</footer>
<div id="toast-container" class="toast-container" aria-live="polite"></div>
<script nonce="${safeNonce}">${clientJs}</script>
</body>
</html>
`;
}

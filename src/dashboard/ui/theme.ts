/** The dashboard's styles: colour tokens, layout, components, pages, responsive rules. */

export const lightVars = `
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

export const css = `
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
.modal-foot .btn-danger { background: var(--down); border-color: var(--down); color: #fff; }
.modal-foot .btn-danger:hover:not(:disabled) { background: var(--down); filter: brightness(0.92); }
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
.tunnel-login { display: flex; flex-direction: column; gap: 2px; font-size: 12px; white-space: nowrap; }
.tunnel-login a { font-weight: 500; }
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

/* ---------- confirm / prompt / share / protect dialogs ---------- */
#confirm-dialog, #prompt-dialog, #share-dialog, #protect-dialog {
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--fg);
  box-shadow: var(--shadow-md);
}
#confirm-dialog::backdrop, #prompt-dialog::backdrop, #share-dialog::backdrop, #protect-dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
#confirm-dialog { width: min(420px, calc(100vw - 32px)); }
#prompt-dialog { width: min(420px, calc(100vw - 32px)); }
#share-dialog { width: min(480px, calc(100vw - 32px)); }
#protect-dialog { width: min(480px, calc(100vw - 32px)); }
.field-password { position: relative; }
.field-password .input { width: 100%; padding-right: 40px; }
.field-toggle {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.field-toggle:hover { background: var(--surface-2); color: var(--fg); }
.field-toggle svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.option-check {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1.5px solid var(--border-strong);
  background: var(--surface);
  position: relative;
}
.option-card[aria-checked="true"] .option-check { border-color: var(--accent); background: var(--accent); }
.option-card[aria-checked="true"] .option-check::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid var(--accent-fg);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
#protect-remove { margin-right: auto; }
.share-options { display: flex; flex-direction: column; gap: 10px; }
.option-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.option-card:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.option-card[aria-checked="true"] { border-color: var(--accent); background: var(--accent-bg); }
.option-dot {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1.5px solid var(--border-strong);
  background: var(--surface);
  position: relative;
}
.option-card[aria-checked="true"] .option-dot { border-color: var(--accent); }
.option-card[aria-checked="true"] .option-dot::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent);
}
.option-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.option-title { font-size: 13.5px; font-weight: 600; }
.option-desc { font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.option-extra { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.option-extra .field-error { margin-top: 4px; }
.share-progress { display: flex; gap: 14px; align-items: flex-start; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-2); }
.share-progress-icon { width: 36px; height: 36px; flex-shrink: 0; border-radius: 999px; display: grid; place-items: center; background: var(--accent-bg); color: var(--accent); }
.share-progress-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.share-progress-icon .spinner { margin: 0; }
.share-progress-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.share-progress-title { font-size: 14px; font-weight: 600; margin: 0; overflow-wrap: anywhere; }
.share-progress-text { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0; }
.share-progress-body .btn { align-self: flex-start; margin-top: 6px; text-decoration: none; }
.share-steps { margin: 2px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--muted); line-height: 1.6; }

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

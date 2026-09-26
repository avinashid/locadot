import { escapeHtml } from "./escape";

// All data on the page is populated client-side via /api/status + /api/hosts
// (and mutated via /api/*) and rendered with DOM APIs (never innerHTML), so
// nothing server-supplied besides the per-response nonce and the auth token
// is interpolated into this markup.
const css = `
:root {
  --bg: #0b0d10;
  --surface: #14181e;
  --surface-2: #1a1f26;
  --border: #282d36;
  --border-strong: #353b46;
  --fg: #e6e8eb;
  --muted: #8b929c;
  --muted-dim: #5f6672;
  --accent: #3b82f6;
  --accent-strong: #60a5fa;
  --accent-bg: rgba(59, 130, 246, 0.12);
  --accent-fg: #ffffff;
  --up: #22c55e;
  --up-bg: rgba(34, 197, 94, 0.12);
  --down: #ef4444;
  --down-bg: rgba(239, 68, 68, 0.12);
  --warn: #f59e0b;
  --warn-bg: rgba(245, 158, 11, 0.12);
  --focus: var(--accent-strong);
  --radius: 10px;
  --radius-sm: 8px;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f7f8fa;
    --surface: #ffffff;
    --surface-2: #f2f3f5;
    --border: #e3e5e8;
    --border-strong: #d3d6db;
    --fg: #1a1d21;
    --muted: #6b7280;
    --muted-dim: #9aa0a8;
    --accent: #2563eb;
    --accent-strong: #1d4ed8;
    --accent-bg: rgba(37, 99, 235, 0.08);
    --accent-fg: #ffffff;
    --up: #16a34a;
    --up-bg: rgba(22, 163, 74, 0.1);
    --down: #dc2626;
    --down-bg: rgba(220, 38, 38, 0.1);
    --warn: #d97706;
    --warn-bg: rgba(217, 119, 6, 0.1);
  }
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  font-family: var(--sans);
  color: var(--fg);
  line-height: 1.5;
  background: var(--bg);
  min-height: 100vh;
}
.mono { font-family: var(--mono); }
a { color: var(--accent); text-decoration: none; }
a:hover, a:focus-visible { text-decoration: underline; }
button { font-family: inherit; }
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

.label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color 0.15s ease;
}
.card:hover { border-color: var(--border-strong); }

header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--bg);
}
.brand { display: flex; align-items: baseline; gap: 10px; }
.wordmark {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.01em;
  color: var(--fg);
}
.muted { color: var(--muted); }
.header-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 13px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--muted);
}
.live-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted-dim);
}
.live-dot.up { background: var(--up); }
.live-dot.down { background: var(--down); }

main { max-width: 1280px; margin: 0 auto; padding: 24px 24px 64px; display: flex; flex-direction: column; gap: 24px; }

.banner {
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 14px;
  border: 1px solid var(--down);
  background: var(--down-bg);
  color: var(--fg);
}

section h2 {
  font-size: 15px;
  color: var(--fg);
  margin: 0 0 12px;
  font-weight: 600;
}

.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: stretch; }
.tile { padding: 16px; display: flex; flex-direction: column; gap: 6px; }
.tile-wide { grid-column: span 2; }
.tile-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; height: 100%; }
.tile-main { display: flex; flex-direction: column; gap: 6px; }
.tile-value { font-size: 17px; font-weight: 600; }
.tile-value.ok { color: var(--up); }
.tile-value.warn { color: var(--warn); }
.tile-sub { font-size: 12px; color: var(--muted); }
.tile-hint { font-size: 12px; color: var(--warn); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tile-actions { margin-top: auto; padding-top: 8px; }

.switch {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--border-strong);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.switch .switch-knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease, background 0.15s ease;
}
.switch.on { background: var(--accent); }
.switch.on .switch-knob { transform: translateX(16px); }
.switch.busy { opacity: 0.6; cursor: wait; }
.switch:disabled { cursor: not-allowed; opacity: 0.5; }

.btn {
  font-size: 13px;
  font-weight: 500;
  padding: 7px 13px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--surface-2);
  color: var(--fg);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
}
.btn:hover:not(:disabled) { border-color: var(--muted); background: var(--border); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-fg);
}
.btn-primary:hover:not(:disabled) { background: var(--accent-strong); border-color: var(--accent-strong); }
.btn-danger { border-color: var(--down); color: var(--down); background: transparent; }
.btn-danger:hover:not(:disabled) { background: var(--down-bg); }
.row-actions .btn-danger:not(:hover):not(:focus-visible) { border-color: var(--border-strong); color: var(--muted); }
.btn-primary.busy::after { border-color: rgba(255, 255, 255, 0.35); border-top-color: #fff; }
.btn-ghost { background: transparent; border-color: var(--border); }
.btn.busy { opacity: 0.6; cursor: wait; }

.form-card { padding: 16px 18px; }
.form-grid { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 200px; flex: 1 1 200px; }
.field label { font-size: 12px; color: var(--muted); font-weight: 500; }
.field input[type="text"] {
  font-family: var(--mono);
  font-size: 14px;
  padding: 8px 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--surface-2);
  color: var(--fg);
}
.field input[type="text"]::placeholder { color: var(--muted-dim); }
.field-checkbox { flex-direction: row; align-items: center; gap: 8px; flex: 0 0 auto; min-width: 0; height: 36px; }
#add-submit { height: 36px; margin-left: auto; }
.field-checkbox label { font-size: 13px; color: var(--fg); font-weight: 400; }
.field-error {
  font-size: 13px;
  color: var(--down);
  background: var(--down-bg);
  border: 1px solid var(--down);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.table-wrap { overflow-x: auto; border-radius: var(--radius); }
table { width: 100%; border-collapse: collapse; min-width: 760px; }
td.traffic { color: var(--muted); font-family: var(--mono); font-size: 12px; }
th, td { text-align: left; padding: 10px 9px; border-bottom: 1px solid var(--border); font-size: 13px; white-space: nowrap; }
th { color: var(--muted); font-weight: 500; font-size: 12px; }
th.num, td.num { text-align: right; }
tbody tr { transition: background 0.15s ease; }
tbody tr:hover { background: var(--surface-2); }
tr:last-child td { border-bottom: none; }
.arrow { color: var(--muted-dim); text-align: center; }
.host-cell { display: flex; align-items: center; gap: 6px; }
.badge {
  display: inline-block;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid var(--warn);
  color: var(--warn);
  background: var(--warn-bg);
}
.pill { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 12px; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
.dot.up { background: var(--up); }
.dot.down { background: var(--down); }
.copy-btn {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  background: var(--surface-2);
  color: var(--muted);
  cursor: pointer;
}
.copy-btn:hover { color: var(--fg); border-color: var(--muted); }
.row-actions { display: flex; gap: 6px; justify-content: flex-end; }
th.actions { text-align: right; }
.edit-hint { font-size: 12px; }
td.edit-error { color: var(--down); white-space: normal; }
body.offline .switch, body.offline #add-submit { opacity: 0.5; pointer-events: none; }
.field input.invalid:focus-visible, .edit-input.invalid:focus-visible { outline-color: var(--down); }
.edit-input.invalid { border-color: var(--down); box-shadow: 0 0 0 3px var(--down-bg); }
.chip:empty { display: none; }
body.boot #updated { visibility: hidden; }
body.boot #stop-proxy-btn, body.offline #stop-proxy-btn { display: none; }
body.offline .live-label { color: var(--down); }
.edit-input {
  font-family: var(--mono);
  font-size: 13px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  background: var(--surface-2);
  color: var(--fg);
  width: 100%;
  min-width: 240px;
}
.badges { display: flex; flex-wrap: wrap; gap: 4px; }
td.badges { display: table-cell; }
td.badges .badge + .badge { margin-left: 4px; }
.badge-cors { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
td .inline-check + .inline-check { margin-top: 4px; }
.inline-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.dim { color: var(--muted-dim); }

.tunnel-cell { white-space: normal; }
.tunnel-status { display: flex; align-items: center; gap: 6px; max-width: 220px; }
.tunnel-status a { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; display: inline-block; vertical-align: middle; }
.tunnel-error { color: var(--down); cursor: help; }
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
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
  padding: 28px;
  color: var(--muted);
  text-align: center;
}
#hosts-error { border-color: var(--down); }
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
  font-size: 12.5px;
  color: var(--fg);
  margin: 0;
}

.cli-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; }
.cli-item pre { flex: 1; min-width: 0; }
.cli-item:last-child { margin-bottom: 0; }

details.card { padding: 0; }
details.card summary {
  cursor: pointer;
  list-style: none;
  padding: 14px 18px;
  font-size: 15px;
  color: var(--fg);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
details.card summary::-webkit-details-marker { display: none; }
details.card summary::after { content: "+"; font-size: 16px; color: var(--muted); font-weight: 400; }
details.card[open] summary::after { content: "\\2212"; }
.logs-body { padding: 0 18px 16px; display: flex; flex-direction: column; gap: 10px; }
.logs-actions { display: flex; gap: 8px; }
.logs-box {
  height: 260px;
  overflow-y: auto;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--fg);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

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
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast.show { opacity: 1; transform: translateY(0); }
.toast-success { border-color: var(--up); }
.toast-error { border-color: var(--down); }
.toast-warn { border-color: var(--warn); }
.toast-hint { margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toast-hint code { font-size: 11.5px; color: var(--fg); }

.banner-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

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
.skel-bar {
  display: block;
  width: 80%;
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--border-strong) 37%, var(--surface-2) 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
}
.skeleton-row td { border-bottom: 1px solid var(--border); padding: 14px 9px; }
.skeleton-row:nth-child(1) .skel-bar { width: 92%; }
.skeleton-row:nth-child(2) .skel-bar { width: 70%; }
.skeleton-row:nth-child(3) .skel-bar { width: 82%; }

tr.row-down td:first-child { border-left: 3px solid var(--down); padding-left: 6px; }

.tunnel-error-text {
  color: var(--down);
  cursor: help;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 170px;
  display: inline-block;
  vertical-align: middle;
}

.field input.invalid { border-color: var(--down); }

.btn.busy, #ca-toggle.busy, #startup-toggle.busy { color: transparent !important; pointer-events: none; }
.btn.busy::after {
  content: "";
  position: absolute;
  width: 13px; height: 13px;
  margin-left: -6px;
  top: 50%; left: 50%;
  margin-top: -6.5px;
  border-radius: 50%;
  border: 2px solid rgba(127, 127, 127, 0.35);
  border-top-color: var(--accent-strong);
  animation: spin 0.7s linear infinite;
}
.btn { position: relative; }
.switch.busy .switch-knob { opacity: 0; }
.switch.busy::after {
  content: "";
  position: absolute;
  top: 3px; left: 11px;
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  animation: spin 0.7s linear infinite;
}

footer { text-align: center; padding: 20px; color: var(--muted-dim); font-size: 12px; }
[hidden] { display: none !important; }

@media (max-width: 900px) {
  .tiles { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .tile { grid-column: span 2; }
  .tile-wide, .tile-wide + .tile { grid-column: span 3; }
}
@media (max-width: 600px) {
  .tiles { grid-template-columns: 1fr; }
  .tile, .tile-wide, .tile-wide + .tile { grid-column: auto; }
  #add-submit { margin-left: 0; }
}

@media (max-width: 1200px) {
  #table th:nth-child(2), #table td.arrow { display: none; }
  .tunnel-status a { max-width: 120px; }
  th, td { padding-left: 6px; padding-right: 6px; }
}
@media (min-width: 641px) and (max-width: 1023px) {
  #table tbody { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  #table tbody tr:nth-child(odd) { border-right: 1px solid var(--border); }
  #table tbody tr:nth-last-child(2):nth-child(odd) { border-bottom: none; }
}
@media (max-width: 1023px) {
  #table { min-width: 0; }
  #table thead { display: none; }
  #table, #table tbody, #table tr { display: block; width: 100%; }
  #table tr { padding: 12px 14px; border-bottom: 1px solid var(--border); }
  #table tr:last-child { border-bottom: none; }
  #table td { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 5px 0; border: none; white-space: normal; text-align: right; min-width: 0; }
  #table td::before { content: attr(data-label); color: var(--muted); font-size: 12px; flex-shrink: 0; text-align: left; }
  #table td[data-label=""]::before { content: none; }
  #table td[data-label=""]:first-child { padding-bottom: 8px; justify-content: flex-start; font-weight: 600; }
  #table td[data-label=""] { justify-content: flex-end; padding-top: 10px; }
  #table .edit-input { min-width: 0; }
}
@media (max-width: 640px) {
  #pid, #updated { display: none; }
  header { padding: 12px 16px; }
  main { padding: 18px 16px 48px; }
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
    hostTd.className = "mono";
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
    tr.appendChild(hostTd);

    tr.appendChild(makeCell("\\u2192", "arrow"));
    tr.appendChild(makeCell(row.target, "mono"));

    var optionsTd = document.createElement("td");
    var flags = [];
    if (row.insecure) flags.push(["insecure", "Upstream TLS certificate is not verified"]);
    if (row.cors) flags.push(["cors", "Origin/Referer rewritten to the target; any origin may call this host"]);
    if (flags.length) {
      optionsTd.className = "badges";
      flags.forEach(function (flag) {
        var badge = document.createElement("span");
        badge.className = "badge" + (flag[0] === "cors" ? " badge-cors" : "");
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
    statusTd.appendChild(statusPill(row));
    tr.appendChild(statusTd);

    tr.appendChild(tunnelCell(row));

    var st = row.stats || { hits: 0, errors: 0 };
    var traffic = st.hits + " hits";
    if (st.errors) traffic += " · " + st.errors + " err";
    if (typeof st.avgMs === "number") traffic += " · " + Math.round(st.avgMs) + "ms";
    var trafficTd = makeCell(traffic, "traffic");
    trafficTd.title = "Last access: " + (st.lastAccess ? fmtRelative(st.lastAccess) : "never");
    tr.appendChild(trafficTd);

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
    labelCells(tr, ["", "", "Target", "Options", "Status", "Public URL", "Traffic", ""]);
  }

  function enterEditMode(row) {
    editingHost = row.host;
    var tr = rowElements[row.host];
    if (!tr) return;
    clear(tr);

    tr.appendChild(makeCell(row.host, "mono"));
    tr.appendChild(makeCell("\\u2192", "arrow"));

    var targetTd = document.createElement("td");
    var targetInput = document.createElement("input");
    targetInput.type = "text";
    targetInput.className = "edit-input mono";
    targetInput.value = row.target;
    targetInput.title = row.target;
    targetInput.setAttribute("aria-label", "Target for " + row.host);
    targetTd.appendChild(targetInput);
    tr.appendChild(targetTd);

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
    hintTd.colSpan = 3;
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
    labelCells(tr, ["", "", "Target", "Options", "", ""]);
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
  }

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
<style nonce="${safeNonce}">${css}</style>
</head>
<body class="boot">
<header>
  <div class="brand">
    <h1 class="wordmark">locadot</h1>
    <span id="version" class="muted mono"></span>
  </div>
  <div class="header-meta">
    <span class="chip"><span id="live-dot" class="live-dot"></span> <span id="live-label" class="live-label">live</span></span>
    <span id="uptime" class="chip"></span>
    <span id="pid" class="chip"></span>
    <span id="updated" class="muted"></span>
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

  <section aria-label="System status">
    <h2>System</h2>
    <div class="tiles">
      <div class="tile card">
        <div class="label">Access</div>
        <div id="tile-root-value" class="tile-value">—</div>
        <div id="tile-ports-value" class="tile-sub"></div>
        <div id="tile-ports-hint" class="tile-hint" hidden></div>
      </div>

      <div class="tile card">
        <div class="tile-row">
          <div>
            <div class="label">CA trust</div>
            <div id="tile-ca-value" class="tile-value">—</div>
          </div>
          <button type="button" id="ca-toggle" class="switch" role="switch" aria-checked="false" aria-label="Toggle local CA trust">
            <span class="switch-knob"></span>
          </button>
        </div>
      </div>

      <div class="tile card">
        <div class="tile-row">
          <div>
            <div class="label">Start at boot</div>
            <div id="tile-startup-value" class="tile-value">—</div>
            <div id="tile-startup-method" class="tile-sub"></div>
          </div>
          <button type="button" id="startup-toggle" class="switch" role="switch" aria-checked="false" aria-label="Toggle start at boot">
            <span class="switch-knob"></span>
          </button>
        </div>
      </div>

      <div class="tile card tile-wide">
        <div class="label">Proxy</div>
        <div id="tile-proxy-ports" class="tile-value mono">—</div>
        <div id="tile-proxy-bind" class="tile-sub mono"></div>
        <div id="tile-proxy-statedir" class="tile-sub mono"></div>
        <div id="tile-proxy-platform" class="tile-sub"></div>
        <div class="tile-actions">
          <button type="button" id="stop-proxy-btn" class="btn btn-sm btn-danger">Stop proxy</button>
        </div>
      </div>

      <div class="tile card">
        <div class="tile-main">
          <div class="label">Cloudflare Tunnel</div>
          <div id="tile-cloudflared-value" class="tile-value">—</div>
          <div id="tile-cloudflared-sub" class="tile-sub"></div>
          <div class="tile-sub">Share a mapping on a public https://*.trycloudflare.com URL. No Cloudflare account needed.</div>
        </div>
        <div class="tile-actions">
          <button type="button" id="cloudflared-install-btn" class="btn btn-sm btn-primary" hidden>Install cloudflared</button>
        </div>
      </div>
    </div>
  </section>

  <section aria-label="Add proxy host">
    <h2>Add host</h2>
    <form id="add-form" class="card form-card" novalidate>
      <div class="form-grid">
        <div class="field">
          <label for="add-host">Host</label>
          <input type="text" id="add-host" name="host" placeholder="app.localhost" autocomplete="off" aria-describedby="add-error" required>
        </div>
        <div class="field">
          <label for="add-target">Target</label>
          <input type="text" id="add-target" name="target" placeholder="3000, 127.0.0.1:8080 or https://example.com" autocomplete="off" aria-describedby="add-error" required>
        </div>
        <div class="field field-checkbox">
          <input type="checkbox" id="add-insecure" name="insecure">
          <label for="add-insecure">Insecure TLS</label>
        </div>
        <div class="field field-checkbox" title="Send Origin/Referer as the target's own and let any origin call this host">
          <input type="checkbox" id="add-cors" name="cors">
          <label for="add-cors">Bypass CORS</label>
        </div>
        <button type="submit" id="add-submit" class="btn btn-primary">Add proxy</button>
      </div>
      <div id="add-error" class="field-error" role="alert" hidden></div>
    </form>
  </section>

  <section aria-label="Registered hosts">
    <h2>Hosts</h2>
    <div id="hosts-skeleton" class="table-wrap card" aria-hidden="true">
      <table>
        <tbody>
          <tr class="skeleton-row"><td colspan="8"><span class="skel-bar"></span></td></tr>
          <tr class="skeleton-row"><td colspan="8"><span class="skel-bar"></span></td></tr>
          <tr class="skeleton-row"><td colspan="8"><span class="skel-bar"></span></td></tr>
        </tbody>
      </table>
    </div>
    <div id="hosts-error" class="empty" hidden>
      <p>Hosts couldn't be loaded while the proxy is unreachable.</p>
    </div>
    <div id="empty" class="empty" hidden>
      <p>No hosts registered yet. Add one above, or from the CLI:</p>
      <pre class="code-block">locadot add --host app.localhost --port 3000</pre>
    </div>
    <div id="table-wrap" class="table-wrap card" hidden>
      <table id="table">
        <thead>
          <tr>
            <th scope="col">Host</th>
            <th scope="col" aria-label="Flow"></th>
            <th scope="col">Target</th>
            <th scope="col">Options</th>
            <th scope="col">Status</th>
            <th scope="col">Public URL</th>
            <th scope="col">Traffic</th>
            <th scope="col" class="actions">Actions</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
  </section>

  <details id="logs-panel" class="card">
    <summary>Logs</summary>
    <div class="logs-body">
      <div class="logs-actions">
        <button type="button" id="logs-refresh" class="btn btn-sm">Refresh</button>
        <button type="button" id="logs-clear" class="btn btn-sm btn-danger">Clear</button>
      </div>
      <pre id="logs-box" class="logs-box" aria-live="off"></pre>
    </div>
  </details>

  <section aria-label="Use from CLI or scripts" class="card form-card">
    <h2>Use from CLI / scripts / AI</h2>
    <div class="cli-item">
      <pre id="cli-add-pre" class="code-block mono">locadot add --host app.localhost --port 3000</pre>
      <button type="button" id="cli-add-copy" class="copy-btn">Copy</button>
    </div>
    <div class="cli-item">
      <pre id="cli-curl-pre" class="code-block mono">curl -X POST http://localhost/api/hosts -H "X-Locadot-Token: $(locadot token)" -H 'Content-Type: application/json' -d '{"host":"app.localhost","target":"3000"}'</pre>
      <button type="button" id="cli-curl-copy" class="copy-btn">Copy</button>
    </div>
    <div class="cli-item">
      <pre id="cli-tunnel-pre" class="code-block mono">locadot tunnel --host app.localhost</pre>
      <button type="button" id="cli-tunnel-copy" class="copy-btn">Copy</button>
    </div>
  </section>
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

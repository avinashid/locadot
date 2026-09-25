import { escapeHtml } from "./escape";

// All data on the page is populated client-side via /api/status + /api/hosts
// (and mutated via /api/*) and rendered with DOM APIs (never innerHTML), so
// nothing server-supplied besides the per-response nonce and the auth token
// is interpolated into this markup.
const css = `
:root {
  --bg: #05070d;
  --bg2: #0a0e1a;
  --fg: #e6edf7;
  --muted: #8b93a7;
  --muted-dim: #5b6478;
  --card-bg: rgba(18, 22, 36, 0.55);
  --card-border: rgba(120, 170, 255, 0.18);
  --border-soft: rgba(255, 255, 255, 0.08);
  --accent-cyan: #22d3ee;
  --accent-violet: #a78bfa;
  --up: #34d399;
  --up-glow: rgba(52, 211, 153, 0.45);
  --down: #f87171;
  --down-glow: rgba(248, 113, 113, 0.45);
  --warn: #fbbf24;
  --warn-glow: rgba(251, 191, 36, 0.45);
  --focus: #67e8f9;
  --radius: 14px;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  font-family: var(--sans);
  color: var(--fg);
  line-height: 1.5;
  background-color: var(--bg2);
  min-height: 100vh;
  position: relative;
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 12% -10%, rgba(34, 211, 238, 0.16), transparent 42%),
    radial-gradient(circle at 88% 0%, rgba(167, 139, 250, 0.14), transparent 45%),
    radial-gradient(circle at 50% 110%, rgba(34, 211, 238, 0.08), transparent 50%),
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: auto, auto, auto, 42px 42px, 42px 42px;
  background-color: var(--bg);
}
.mono { font-family: var(--mono); }
a { color: var(--accent-cyan); text-decoration: none; }
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
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 12px 30px rgba(0, 0, 0, 0.35);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.card:hover { border-color: rgba(120, 170, 255, 0.32); }

header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 28px;
  border-bottom: 1px solid var(--border-soft);
  position: sticky;
  top: 0;
  z-index: 5;
  background: rgba(5, 7, 13, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.brand { display: flex; align-items: baseline; gap: 10px; }
.wordmark {
  font-size: 22px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-violet));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.muted { color: var(--muted); }
.header-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 13px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--muted);
  font-family: var(--mono);
}
.live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted-dim);
}
.live-dot.up { background: var(--up); box-shadow: 0 0 0 0 var(--up-glow); animation: pulseDot 2s ease-in-out infinite; }
.live-dot.down { background: var(--down); box-shadow: 0 0 8px var(--down-glow); }
@keyframes pulseDot {
  0% { box-shadow: 0 0 0 0 var(--up-glow); }
  70% { box-shadow: 0 0 0 7px rgba(52, 211, 153, 0); }
  100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
}

main { max-width: 1400px; margin: 0 auto; padding: 24px 28px 64px; display: flex; flex-direction: column; gap: 24px; }

.banner {
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 14px;
  border: 1px solid var(--down);
  background: rgba(248, 113, 113, 0.08);
  color: #fecaca;
}

section h2 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 0 0 12px;
  font-weight: 700;
}

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.tile { padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; }
.tile-wide { grid-column: span 2; }
.tile-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.tile-value { font-size: 18px; font-weight: 700; }
.tile-value.ok { color: var(--up); }
.tile-value.warn { color: var(--warn); }
.tile-sub { font-size: 12px; color: var(--muted); }
.tile-hint { font-size: 12px; color: var(--warn); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tile-actions { margin-top: 4px; }

.switch {
  position: relative;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.switch .switch-knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--muted);
  transition: transform 0.2s ease, background 0.2s ease;
}
.switch.on { background: rgba(34, 211, 238, 0.18); border-color: var(--accent-cyan); }
.switch.on .switch-knob { transform: translateX(18px); background: var(--accent-cyan); box-shadow: 0 0 8px var(--accent-cyan); }
.switch.busy { opacity: 0.6; cursor: wait; }
.switch:disabled { cursor: not-allowed; }

.btn {
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.05);
  color: var(--fg);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}
.btn:hover:not(:disabled) { border-color: rgba(120, 170, 255, 0.4); box-shadow: 0 0 12px rgba(34, 211, 238, 0.15); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-primary {
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-violet));
  color: #04121a;
}
.btn-primary:hover:not(:disabled) { box-shadow: 0 0 16px rgba(34, 211, 238, 0.4); }
.btn-danger { border-color: rgba(248, 113, 113, 0.5); color: #fecaca; }
.btn-danger:hover:not(:disabled) { box-shadow: 0 0 12px var(--down-glow); }
.btn-ghost { background: transparent; }
.btn.busy { opacity: 0.6; cursor: wait; }

.form-card { padding: 18px 20px; }
.form-grid { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 200px; flex: 1 1 200px; }
.field label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; }
.field input[type="text"] {
  font-family: var(--mono);
  font-size: 14px;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.04);
  color: var(--fg);
}
.field input[type="text"]::placeholder { color: var(--muted-dim); }
.field-checkbox { flex-direction: row; align-items: center; gap: 8px; flex: 0 0 auto; }
.field-checkbox label { text-transform: none; letter-spacing: normal; font-size: 13px; color: var(--fg); font-weight: 400; }
.field-error {
  font-size: 13px;
  color: #fecaca;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.35);
  border-radius: 8px;
  padding: 8px 12px;
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.table-wrap { overflow-x: auto; border-radius: var(--radius); }
table { width: 100%; border-collapse: collapse; min-width: 780px; }
th, td { text-align: left; padding: 10px 11px; border-bottom: 1px solid var(--border-soft); font-size: 13px; white-space: nowrap; }
th { color: var(--muted); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
tbody tr { transition: background 0.15s ease; }
tbody tr:hover { background: rgba(255, 255, 255, 0.03); }
tr:last-child td { border-bottom: none; }
.arrow { color: var(--muted-dim); text-align: center; }
.host-cell { display: flex; align-items: center; gap: 6px; }
.badge {
  display: inline-block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--warn);
  color: var(--warn);
  background: rgba(251, 191, 36, 0.1);
}
.pill { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 12px; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.dot.up { background: var(--up); box-shadow: 0 0 6px var(--up-glow); }
.dot.down { background: var(--down); box-shadow: 0 0 6px var(--down-glow); }
.copy-btn {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.05);
  color: var(--muted);
  cursor: pointer;
}
.copy-btn:hover { color: var(--fg); border-color: rgba(120, 170, 255, 0.4); }
.row-actions { display: flex; gap: 6px; }
.edit-input {
  font-family: var(--mono);
  font-size: 13px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.05);
  color: var(--fg);
  width: 100%;
  min-width: 160px;
}
.inline-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.dim { color: var(--muted-dim); }

.empty {
  border: 1px dashed var(--border-soft);
  border-radius: var(--radius);
  padding: 28px;
  color: var(--muted);
  text-align: center;
}
.empty pre { display: inline-block; text-align: left; }

pre.code-block {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  font-family: var(--mono);
  font-size: 12.5px;
  color: #c7f9ff;
  margin: 0;
}

.cli-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; }
.cli-item pre { flex: 1; }
.cli-item:last-child { margin-bottom: 0; }

details.card { padding: 0; }
details.card summary {
  cursor: pointer;
  list-style: none;
  padding: 14px 20px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
details.card summary::-webkit-details-marker { display: none; }
details.card summary::after { content: "+"; font-size: 16px; color: var(--muted); }
details.card[open] summary::after { content: "\\2212"; }
.logs-body { padding: 0 20px 18px; display: flex; flex-direction: column; gap: 10px; }
.logs-actions { display: flex; gap: 8px; }
.logs-box {
  height: 260px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: var(--mono);
  font-size: 12px;
  color: #c7f9ff;
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
  background: rgba(15, 18, 30, 0.92);
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast.show { opacity: 1; transform: translateY(0); }
.toast-success { border-color: rgba(52, 211, 153, 0.5); }
.toast-error { border-color: rgba(248, 113, 113, 0.5); }
.toast-warn { border-color: rgba(251, 191, 36, 0.5); }
.toast-hint { margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toast-hint code { font-size: 11.5px; color: #c7f9ff; }

footer { text-align: center; padding: 20px; color: var(--muted-dim); font-size: 12px; }
[hidden] { display: none !important; }

@media (max-width: 640px) {
  .tile-wide { grid-column: span 1; }
  header { padding: 14px 16px; }
  main { padding: 18px 16px 48px; }
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

  var addForm = document.getElementById("add-form");
  var addHostInput = document.getElementById("add-host");
  var addTargetInput = document.getElementById("add-target");
  var addInsecureInput = document.getElementById("add-insecure");
  var addSubmitBtn = document.getElementById("add-submit");
  var addErrorEl = document.getElementById("add-error");

  var emptyEl = document.getElementById("empty");
  var tableWrap = document.getElementById("table-wrap");
  var tbody = document.getElementById("tbody");

  var logsPanel = document.getElementById("logs-panel");
  var logsBox = document.getElementById("logs-box");
  var logsRefreshBtn = document.getElementById("logs-refresh");
  var logsClearBtn = document.getElementById("logs-clear");

  var cliAddPre = document.getElementById("cli-add-pre");
  var cliAddCopy = document.getElementById("cli-add-copy");
  var cliCurlPre = document.getElementById("cli-curl-pre");
  var cliCurlCopy = document.getElementById("cli-curl-copy");

  var toastContainer = document.getElementById("toast-container");

  var lastStatus = null;
  var lastHosts = [];
  var rowElements = {};
  var editingHost = null;
  var caBusy = false;
  var startupBusy = false;
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

  function apiError(err) {
    var message = err && err.message ? err.message : String(err);
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

  function renderHeader(status) {
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
      .catch(function (err) { apiError(err); })
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
      .catch(function (err) { apiError(err); })
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
        apiError(err);
        stopProxyBtn.disabled = false;
        stopProxyBtn.classList.remove("busy");
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

  addForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideAddError();
    var hostVal = addHostInput.value.trim();
    var targetVal = addTargetInput.value.trim();
    if (!hostVal || !targetVal) {
      showAddError("Host and target are required.");
      return;
    }
    if (hostVal.indexOf(".") === -1) hostVal = hostVal + ".localhost";
    var insecureVal = !!addInsecureInput.checked;
    addSubmitBtn.disabled = true;
    addSubmitBtn.classList.add("busy");
    apiFetch("/api/hosts", { method: "POST", body: JSON.stringify({ host: hostVal, target: targetVal, insecure: insecureVal }) })
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

  function buildDisplayRow(tr, row) {
    clear(tr);

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

    var insecureTd = document.createElement("td");
    if (row.insecure) {
      var badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "insecure";
      insecureTd.appendChild(badge);
    } else {
      insecureTd.className = "dim";
      insecureTd.textContent = "\\u2014";
    }
    tr.appendChild(insecureTd);

    var statusTd = document.createElement("td");
    statusTd.appendChild(statusPill(row));
    tr.appendChild(statusTd);

    tr.appendChild(makeCell(row.stats ? String(row.stats.hits) : "0"));
    tr.appendChild(makeCell(row.stats ? String(row.stats.errors) : "0"));
    tr.appendChild(makeCell(row.stats && row.stats.lastAccess ? fmtRelative(row.stats.lastAccess) : "never"));
    tr.appendChild(makeCell(row.stats && typeof row.stats.avgMs === "number" ? Math.round(row.stats.avgMs) + "ms" : "-"));

    var actionsTd = document.createElement("td");
    actionsTd.className = "row-actions";
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
          apiError(err);
          removeBtn.disabled = false;
        });
    });
    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(removeBtn);
    tr.appendChild(actionsTd);
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
    tr.appendChild(insecureTd);

    tr.appendChild(makeCell("\\u2014", "dim"));
    tr.appendChild(makeCell("\\u2014", "dim"));
    tr.appendChild(makeCell("\\u2014", "dim"));
    tr.appendChild(makeCell("\\u2014", "dim"));

    var actionsTd = document.createElement("td");
    actionsTd.className = "row-actions";
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
        showToast("Target is required", "error");
        return;
      }
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      apiFetch("/api/hosts/" + encodeURIComponent(row.host), {
        method: "PUT",
        body: JSON.stringify({ target: newTarget, insecure: !!insecureInput.checked })
      })
        .then(function () {
          editingHost = null;
          showToast("Updated " + row.host, "success");
          return loadHosts();
        })
        .catch(function (err) {
          apiError(err);
          saveBtn.disabled = false;
          cancelBtn.disabled = false;
        });
    });

    cancelBtn.addEventListener("click", function () {
      editingHost = null;
      buildDisplayRow(tr, row);
    });

    actionsTd.appendChild(saveBtn);
    actionsTd.appendChild(cancelBtn);
    tr.appendChild(actionsTd);
  }

  function renderHosts(hosts) {
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
      logsBox.textContent = lines.join("\\n");
      logsBox.scrollTop = logsBox.scrollHeight;
    }).catch(function (err) { apiError(err); });
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
      .catch(function (err) { apiError(err); });
  });

  cliAddCopy.addEventListener("click", function () { copyText(cliAddPre.textContent, cliAddCopy); });
  cliCurlCopy.addEventListener("click", function () { copyText(cliCurlPre.textContent, cliCurlCopy); });

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
    }).catch(function (err) {
      markDown();
      showToast("Refresh failed: " + (err && err.message ? err.message : err), "error");
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
<meta name="color-scheme" content="dark">
<meta name="locadot-token" content="${safeToken}">
<title>locadot dashboard</title>
<style nonce="${safeNonce}">${css}</style>
</head>
<body>
<header>
  <div class="brand">
    <h1 class="wordmark">locadot</h1>
    <span id="version" class="muted mono"></span>
  </div>
  <div class="header-meta">
    <span class="chip"><span id="live-dot" class="live-dot"></span> live</span>
    <span id="uptime" class="chip"></span>
    <span id="pid" class="chip"></span>
    <span id="updated" class="muted"></span>
  </div>
</header>
<main>
  <div id="stopped-banner" class="banner" role="status" hidden></div>

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
            <div class="label">CA Trust</div>
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
            <div class="label">Start at Boot</div>
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
    </div>
  </section>

  <section aria-label="Add proxy host">
    <h2>Add Host</h2>
    <form id="add-form" class="card form-card">
      <div class="form-grid">
        <div class="field">
          <label for="add-host">Host</label>
          <input type="text" id="add-host" name="host" placeholder="app.localhost" autocomplete="off" required>
        </div>
        <div class="field">
          <label for="add-target">Target</label>
          <input type="text" id="add-target" name="target" placeholder="3000, 127.0.0.1:8080 or https://google.com" autocomplete="off" required>
        </div>
        <div class="field field-checkbox">
          <input type="checkbox" id="add-insecure" name="insecure">
          <label for="add-insecure">Insecure TLS</label>
        </div>
        <button type="submit" id="add-submit" class="btn btn-primary">Add proxy</button>
      </div>
      <div id="add-error" class="field-error" role="alert" hidden></div>
    </form>
  </section>

  <section aria-label="Registered hosts">
    <h2>Hosts</h2>
    <div id="empty" class="empty" hidden>
      <p>No hosts registered yet. Add one above, or from the CLI:</p>
      <pre class="code-block">locadot add --host app.localhost --port 3000</pre>
    </div>
    <div id="table-wrap" class="table-wrap card" hidden>
      <table id="table">
        <thead>
          <tr>
            <th scope="col">Host</th>
            <th scope="col" class="visually-hidden">Flow</th>
            <th scope="col">Target</th>
            <th scope="col">Insecure</th>
            <th scope="col">Status</th>
            <th scope="col">Hits</th>
            <th scope="col">Errors</th>
            <th scope="col">Last access</th>
            <th scope="col">Avg ms</th>
            <th scope="col">Actions</th>
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
      <pre id="cli-curl-pre" class="code-block mono"></pre>
      <button type="button" id="cli-curl-copy" class="copy-btn">Copy</button>
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

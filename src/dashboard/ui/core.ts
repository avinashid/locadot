/** Shared client state and helpers (elements, fetch, toasts) and the polling loop. */

export const jsPrelude = `(function () {
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
  var cloudflareLoggedIn = false;
  var cloudflareZones = [];
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

`;

export const jsPolling = `  // ---------- polling ----------

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

`;

export const jsPollingLoop = `  // ---------- polling ----------

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

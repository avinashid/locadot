/** The app shell: sidebar, top bar, routing, preferences, and the shared confirm/prompt dialogs and toasts. */

export const jsHeader = `  // ---------- header + system tiles ----------

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
    cloudflareLoggedIn = !!cf.loggedIn;
    cloudflareZones = Array.isArray(cf.zones) ? cf.zones : [];
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

  // ---------- status pill (details + quick actions) ----------

  var statusBtn = document.getElementById("status-btn");
  function stripPrefix(text, prefix) {
    text = text || "";
    return text.indexOf(prefix) === 0 ? text.slice(prefix.length) : text;
  }
  statusBtn.addEventListener("click", function () {
    var items = [
      { info: true, label: "Proxy", hint: isDown ? "offline" : "live" },
      { info: true, label: "Version", hint: versionEl.textContent || "\u2014" },
      { info: true, label: "Uptime", hint: stripPrefix(uptimeEl.textContent, "uptime ") || "\u2014" },
      { info: true, label: "PID", hint: stripPrefix(pidEl.textContent, "pid ") || "\u2014" },
      { info: true, label: "Last update", hint: stripPrefix(updatedEl.textContent, "Updated ") || "\u2014" },
      "-",
      { label: "Refresh now", icon: ICONS.refresh, onSelect: function () { refreshAll().then(tickViews); refreshHubAndRemotes(); } },
      { label: "View logs", icon: ICONS.logs, onSelect: function () { location.hash = "#/logs"; } },
      { label: "Settings", icon: ICONS.settings, onSelect: function () { location.hash = "#/settings"; } }
    ];
    var signOut = document.getElementById("sb-signout");
    if (signOut && !signOut.hidden) items.push("-", { label: "Sign out", icon: ICONS.signOut, danger: true, onSelect: function () { signOut.click(); } });
    openMenu(statusBtn, items, { label: "Proxy status", title: "Proxy status", align: "end" });
  });

`;

export const jsDialogs = `  // ---------- confirm / prompt dialogs ----------

  var confirmDialogEl = document.getElementById("confirm-dialog");
  var confirmTitleEl = document.getElementById("confirm-title");
  var confirmMessageEl = document.getElementById("confirm-message");
  var confirmCancelBtn = document.getElementById("confirm-cancel");
  var confirmOkBtn = document.getElementById("confirm-ok");
  var confirmCloseBtn = document.getElementById("confirm-close");
  var confirmResolve = null;

  function closeConfirmDialog(result) {
    var resolve = confirmResolve;
    confirmResolve = null;
    confirmDialogEl.close();
    if (resolve) resolve(result);
  }

  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      confirmResolve = resolve;
      confirmTitleEl.textContent = opts.title || "Are you sure?";
      confirmMessageEl.textContent = opts.message || "";
      confirmOkBtn.textContent = opts.confirmLabel || "OK";
      confirmOkBtn.className = "btn " + (opts.danger ? "btn-danger" : "btn-primary");
      confirmDialogEl.showModal();
      setTimeout(function () { confirmOkBtn.focus(); }, 0);
    });
  }

  confirmCancelBtn.addEventListener("click", function () { closeConfirmDialog(false); });
  confirmCloseBtn.addEventListener("click", function () { closeConfirmDialog(false); });
  confirmOkBtn.addEventListener("click", function () { closeConfirmDialog(true); });
  confirmDialogEl.addEventListener("click", function (e) {
    if (e.target === confirmDialogEl) closeConfirmDialog(false);
  });
  confirmDialogEl.addEventListener("close", function () {
    if (confirmResolve) { var resolve = confirmResolve; confirmResolve = null; resolve(false); }
  });

  var promptDialogEl = document.getElementById("prompt-dialog");
  var promptTitleEl = document.getElementById("prompt-title");
  var promptMessageEl = document.getElementById("prompt-message");
  var promptLabelEl = document.getElementById("prompt-label");
  var promptInput = document.getElementById("prompt-input");
  var promptErrorEl = document.getElementById("prompt-error");
  var promptCancelBtn = document.getElementById("prompt-cancel");
  var promptConfirmBtn = document.getElementById("prompt-confirm");
  var promptCloseBtn = document.getElementById("prompt-close");
  var promptResolve = null;
  var promptValidate = null;

  function closePromptDialog(result) {
    var resolve = promptResolve;
    promptResolve = null;
    promptValidate = null;
    promptDialogEl.close();
    if (resolve) resolve(result);
  }

  function promptDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      promptResolve = resolve;
      promptValidate = typeof opts.validate === "function" ? opts.validate : null;
      promptTitleEl.textContent = opts.title || "";
      promptMessageEl.textContent = opts.message || "";
      promptMessageEl.hidden = !opts.message;
      promptLabelEl.textContent = opts.label || "";
      promptLabelEl.hidden = !opts.label;
      promptInput.placeholder = opts.placeholder || "";
      promptInput.value = opts.value || "";
      promptConfirmBtn.textContent = opts.confirmLabel || "OK";
      promptErrorEl.hidden = true;
      promptErrorEl.textContent = "";
      promptDialogEl.showModal();
      setTimeout(function () { promptInput.focus(); promptInput.select(); }, 0);
    });
  }

  function submitPromptDialog() {
    var value = promptInput.value;
    if (promptValidate) {
      var err = promptValidate(value);
      if (err) {
        promptErrorEl.textContent = err;
        promptErrorEl.hidden = false;
        return;
      }
    }
    closePromptDialog(value);
  }

  promptCancelBtn.addEventListener("click", function () { closePromptDialog(null); });
  promptCloseBtn.addEventListener("click", function () { closePromptDialog(null); });
  promptConfirmBtn.addEventListener("click", submitPromptDialog);
  promptInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); submitPromptDialog(); }
  });
  promptDialogEl.addEventListener("click", function (e) {
    if (e.target === promptDialogEl) closePromptDialog(null);
  });
  promptDialogEl.addEventListener("close", function () {
    if (promptResolve) { var resolve = promptResolve; promptResolve = null; resolve(null); }
  });

`;

export const jsPrefs = `  // ---------- preferences (per browser) ----------

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

`;

export const jsRouting = `  // ---------- sidebar + routing ----------
  // Routes are #/<view> or #/<view>/<tab>. A view with a tab group registered via
  // initTabs() (core) gets the tab selected from the second segment; an unknown or
  // missing tab falls back to the group's first tab. Legacy routes redirect.

  var VIEWS = ["overview", "hosts", "sharing", "remote", "machines", "logs", "settings"];
  var ROUTE_REDIRECTS = { sharing: ["hosts", "shared"], machines: ["remote", "machines"] };
  var TITLES = { overview: "Overview", hosts: "Hosts", sharing: "Hosts", remote: "Remote", machines: "Remote", logs: "Logs", settings: "Settings" };
  var rootEl = document.documentElement;
  var sidebarEl = document.getElementById("sidebar");
  var collapseBtn = document.getElementById("sb-collapse");
  var menuBtn = document.getElementById("sb-menu");
  var backdropEl = document.getElementById("sb-backdrop");
  var tbTitleEl = document.getElementById("tb-title");
  var navLinks = Array.prototype.slice.call(sidebarEl.querySelectorAll("a.sb-link"));
  var viewEls = {};
  Array.prototype.forEach.call(document.querySelectorAll("section.view"), function (el) { viewEls[el.getAttribute("data-view")] = el; });
  var drawerMq = window.matchMedia("(max-width: 640px)");
  var currentView = null;

  function isCollapsed() { return rootEl.getAttribute("data-sidebar") === "collapsed"; }
  function setCollapsed(collapsed, persist) {
    if (collapsed) rootEl.setAttribute("data-sidebar", "collapsed");
    else rootEl.removeAttribute("data-sidebar");
    if (persist) { try { localStorage.setItem("locadot.sidebar", collapsed ? "collapsed" : "expanded"); } catch (e) {} }
    var label = collapsed ? "Expand sidebar" : "Collapse sidebar";
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    collapseBtn.setAttribute("aria-label", label);
    collapseBtn.setAttribute("data-tip", label);
    collapseBtn.querySelector(".sb-label").textContent = collapsed ? "Expand" : "Collapse";
    setSwitch(prefSidebar, collapsed);
    hideTooltip();
  }
  collapseBtn.addEventListener("click", function () { setCollapsed(!isCollapsed(), true); });

  // Legacy slide-in drawer; the menu button is hidden now that phones get a bottom tab bar.
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

  // Sidebar tooltips only make sense on the icon rail.
  tooltipGuards.push(function (el) {
    if (!sidebarEl.contains(el)) return true;
    return isCollapsed() && !drawerMq.matches;
  });

  function resolveRoute(view, tab) {
    var redirected = false;
    if (ROUTE_REDIRECTS[view]) { tab = tab || ROUTE_REDIRECTS[view][1]; view = ROUTE_REDIRECTS[view][0]; redirected = true; }
    if (VIEWS.indexOf(view) === -1) return null;
    return { view: view, tab: tab || null, redirected: redirected };
  }

  function routeFromHash() {
    var parts = (location.hash || "").replace(/^#\\/?/, "").split("/");
    return resolveRoute(decodeURIComponent(parts[0] || ""), parts[1] ? decodeURIComponent(parts[1]) : null);
  }

  function viewFromHash() {
    var r = routeFromHash();
    return r ? r.view : null;
  }

  function showView(name, tab) {
    var r = resolveRoute(name, tab) || { view: "overview", tab: null };
    name = r.view;
    tab = r.tab;
    var changed = currentView !== name;
    currentView = name;
    closeMenu(false);
    VIEWS.forEach(function (v) { if (viewEls[v]) viewEls[v].hidden = v !== name; });
    navLinks.forEach(function (a) {
      if (a.getAttribute("data-view") === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = TITLES[name] + " · locadot";
    if (tbTitleEl) tbTitleEl.textContent = TITLES[name];
    try { localStorage.setItem("locadot.lastView", name); } catch (e) {}
    if (drawerMq.matches) setDrawer(false);
    var group = tabGroups[name];
    if (group) {
      var picked = group.select(tab, { silent: changed });
      if (tab && picked !== tab) replaceHash(name, picked);
    }
    if (r.redirected) replaceHash(name, group ? group.current() : tab);
    if (changed) {
      window.scrollTo(0, 0);
      onViewEnter(name);
      if (group && group.opts.onChange) group.opts.onChange(group.current(), null);
    }
  }

  function replaceHash(view, tab) {
    var h = "#/" + view + (tab ? "/" + encodeURIComponent(tab) : "");
    if (location.hash !== h) { try { history.replaceState(null, "", h); } catch (e) {} }
  }

  function showRoute() {
    var r = routeFromHash();
    if (r && r.redirected) replaceHash(r.view, r.tab);
    if (r) showView(r.view, r.tab);
    else showView("overview");
  }

  function onViewEnter(name) {
    if (name === "logs") loadLogs();
    if (name === "overview") { renderOverview(); loadOverviewLogs(); }
    if (name === "hosts" || name === "sharing") renderShareList();
    if (name === "settings") loadSettings();
    if (name === "remote" || name === "machines") refreshHubAndRemotes();
  }

  window.addEventListener("hashchange", showRoute);

`;

export const shellTop = `<body class="boot">
<nav id="sidebar" class="sidebar" aria-label="Main">
  <div class="sb-head">
    <a class="sb-brand" href="#/overview" aria-label="locadot overview"><span class="logo" aria-hidden="true"></span><h1 class="wordmark sb-label">locadot</h1></a>
    <span id="version" class="sb-version sb-label"></span>
  </div>
  <div class="sb-links">
    <div class="sb-group">
      <a class="sb-link" href="#/overview" data-view="overview" aria-label="Overview" data-tip="Overview" data-tip-pos="right"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg><span class="sb-label">Overview</span></a>
      <a class="sb-link" href="#/hosts" data-view="hosts" aria-label="Hosts" data-tip="Hosts" data-tip-pos="right"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/></svg><span class="sb-label">Hosts</span><span class="sb-badges"><span id="sb-shares-count" class="sb-count sb-count-accent" title="Shared publicly" hidden></span><span id="sb-hosts-count" class="sb-count" hidden></span></span></a>
      <a class="sb-link" href="#/remote" data-view="remote" aria-label="Remote" data-tip="Remote" data-tip-pos="right"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/></svg><span class="sb-label">Remote</span><span class="sb-badges"><span id="sb-remotes-count" class="sb-count" title="Connected machines" hidden></span><span id="sb-hub-dot" class="dot sb-dot" hidden></span></span></a>
    </div>
    <div class="sb-section sb-label" role="presentation">System</div>
    <div class="sb-group">
      <a class="sb-link" href="#/logs" data-view="logs" aria-label="Logs" data-tip="Logs" data-tip-pos="right"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg><span class="sb-label">Logs</span></a>
      <a class="sb-link" href="#/settings" data-view="settings" aria-label="Settings" data-tip="Settings" data-tip-pos="right"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span class="sb-label">Settings</span></a>
    </div>
  </div>
  <div class="sb-foot">
    <button type="button" id="sb-signout" class="sb-link sb-signout" aria-label="Sign out" data-tip="Sign out" data-tip-pos="right" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg><span class="sb-label">Sign out</span></button>
    <button type="button" id="sb-collapse" class="sb-link sb-collapse" aria-controls="sidebar" aria-expanded="true" aria-label="Collapse sidebar" data-tip="Expand sidebar" data-tip-pos="right"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 10l-2 2 2 2"/></svg><span class="sb-label">Collapse</span></button>
  </div>
</nav>
<div id="sb-backdrop" class="sb-backdrop" hidden></div>
<div class="shell">
<header>
  <div class="topbar">
    <div class="brand">
      <button type="button" id="sb-menu" class="btn btn-ghost btn-icon sb-menu" aria-controls="sidebar" aria-expanded="false" aria-label="Open navigation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <a class="brand-mobile logo" href="#/overview" aria-label="locadot overview"></a>
      <span class="wordmark brand-mobile">locadot</span>
      <div class="crumbs"><span class="crumb-root">locadot</span><span class="crumb-sep" aria-hidden="true">/</span><span id="tb-title" class="crumb-current">Overview</span></div>
    </div>
    <div class="header-meta">
      <span id="updated"></span>
      <button type="button" id="status-btn" class="status-pill" aria-haspopup="menu" aria-expanded="false" aria-label="Proxy status and details">
        <span id="live-dot" class="live-dot"></span><span id="live-label" class="live-label">live</span>
        <span class="status-extra"><span class="status-sep" aria-hidden="true"></span><span id="uptime"></span><span class="status-sep status-pid-sep" aria-hidden="true"></span><span id="pid"></span></span>
        <svg class="status-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <button type="button" id="theme-toggle" class="btn btn-ghost theme-toggle" data-mode="system" title="Theme: system" aria-label="Theme: system (click to change)">
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

`;

export const shellBottom = `</main>
<footer>
  <a href="https://github.com/avinashid/locadot" target="_blank" rel="noopener noreferrer">github.com/avinashid/locadot</a>
</footer>
</div>
`;

export const dialogsMarkup = `<dialog id="confirm-dialog">
  <div class="modal-head">
    <div>
      <h3 class="modal-title" id="confirm-title"></h3>
    </div>
    <button type="button" id="confirm-close" class="btn btn-ghost modal-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  </div>
  <div class="modal-body">
    <p class="modal-desc" id="confirm-message"></p>
  </div>
  <div class="modal-foot">
    <button type="button" id="confirm-cancel" class="btn">Cancel</button>
    <button type="button" id="confirm-ok" class="btn btn-primary">OK</button>
  </div>
</dialog>
<dialog id="prompt-dialog">
  <div class="modal-head">
    <div>
      <h3 class="modal-title" id="prompt-title"></h3>
    </div>
    <button type="button" id="prompt-close" class="btn btn-ghost modal-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  </div>
  <div class="modal-body">
    <p class="modal-desc" id="prompt-message"></p>
    <div class="field">
      <label id="prompt-label" for="prompt-input"></label>
      <input type="text" id="prompt-input" class="input" autocomplete="off">
    </div>
    <div id="prompt-error" class="field-error" role="alert" hidden></div>
  </div>
  <div class="modal-foot">
    <button type="button" id="prompt-cancel" class="btn">Cancel</button>
    <button type="button" id="prompt-confirm" class="btn btn-primary">OK</button>
  </div>
</dialog>
`;

export const toastMarkup = `<div id="toast-container" class="toast-container" aria-live="polite"></div>
`;

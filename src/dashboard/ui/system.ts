/** Overview, logs and settings. */

export const jsLogs = `  // ---------- logs ----------

  var LEVELS = { error: 0, warn: 1, info: 2 };

  function lineLevel(line) {
    var m = /\\[(error|warn|info|debug|verbose|silly)\\]/i.exec(line);
    return m ? m[1].toLowerCase() : "info";
  }

  // Renders lines as individual, level-coloured rows instead of one big <pre>
  // blob, so long lines wrap nicely and errors/warnings stand out.
  function renderLogLines(container, lines, emptyText) {
    clear(container);
    if (!lines.length) {
      var empty = document.createElement("div");
      empty.className = "log-line log-line-empty";
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }
    lines.forEach(function (line) {
      var row = document.createElement("div");
      row.className = "log-line log-line-" + lineLevel(line);
      row.textContent = line;
      container.appendChild(row);
    });
  }

  logsRefreshBtn.addEventListener("click", loadLogs);
  logsClearBtn.addEventListener("click", function () {
    confirmDialog({ title: "Clear logs?", message: "This can't be undone.", confirmLabel: "Clear logs", danger: true }).then(function (ok) {
      if (!ok) return;
      apiFetch("/api/logs/clear", { method: "POST" })
        .then(function () {
          showToast("Logs cleared", "success");
          return loadLogs();
        })
        .catch(function (err) { apiError(err, "Couldn't clear logs"); });
    });
  });

  cliAddCopy.addEventListener("click", function () { copyText(cliAddPre.textContent, cliAddCopy); });
  cliCurlCopy.addEventListener("click", function () { copyText(cliCurlPre.textContent, cliCurlCopy); });
  cliTunnelCopy.addEventListener("click", function () { copyText(cliTunnelPre.textContent, cliTunnelCopy); });

`;

export const jsOverview = `  // ---------- overview ----------

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

  // Plays once on load; the tiles themselves are static, so later polls just
  // update their text and don't need to re-animate.
  Array.prototype.forEach.call(document.querySelectorAll('[data-view="overview"] .tile'), function (el, i) { animateIn(el, i); });

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
    sorted.slice(0, 6).forEach(function (h, i) {
      var p = h.probe || {};
      var side = p.up ? ((p.status || "") + (p.ms !== undefined ? " · " + p.ms + "ms" : "")) : (p.error || "down");
      var sub = h.remote ? "via " + h.remote.name : h.target;
      var row = ovRow(h.host, sub, side, p.up ? "up" : "down", "#/hosts");
      ovHostList.appendChild(row);
      animateIn(row, i);
    });
    if (sorted.length > 6) {
      var more = document.createElement("a");
      more.className = "ov-more";
      more.href = "#/hosts";
      more.textContent = "View all " + sorted.length + " hosts";
      ovHostList.appendChild(more);
    }

    clear(ovChecks);
    if (lastStatus) {
      var sys = lastStatus.system, proxy = lastStatus.proxy;
      var checkRows = [
        ovRow("Running", "pid " + proxy.pid + " · uptime " + fmtUptime(lastStatus.uptimeSec), "http :" + proxy.httpPort + " · https :" + proxy.httpsPort, "up"),
        ovRow("HTTPS certificates", sys.caTrusted === true ? "local CA is trusted" : "browsers will warn until the CA is trusted", sys.caTrusted === true ? "Trusted" : "Trust CA", sys.caTrusted === true ? "up" : "warn", "#/settings/security"),
        ovRow("Start at boot", sys.startup.method ? "via " + sys.startup.method : "", sys.startup.enabled ? "Enabled" : "Enable", sys.startup.enabled ? "up" : "", "#/settings/general")
      ];
      var cf = sys.cloudflared || {};
      checkRows.push(ovRow("cloudflared", cf.installed ? (cf.version || cf.path || "") : "needed for public sharing and remote access", cf.installed ? "Installed" : "Install", cf.installed ? "up" : "warn", "#/sharing"));
      checkRows.forEach(function (row, i) { ovChecks.appendChild(row); animateIn(row, i); });
    }
  }

  function loadOverviewLogs() {
    return fetch("/api/logs?lines=8").then(parseJsonOrThrow).then(function (data) {
      var lines = (data && data.lines) || [];
      renderLogLines(ovLogs, lines, "No log lines yet.");
      ovLogs.scrollTop = ovLogs.scrollHeight;
    }).catch(function () {});
  }

`;

export const jsLogsPage = `  // ---------- logs page ----------

  var logsFilter = document.getElementById("logs-filter");
  var logsLevel = document.getElementById("logs-level");
  var logsLines = document.getElementById("logs-lines");
  var logsAuto = document.getElementById("logs-auto");
  var logsCopy = document.getElementById("logs-copy");
  var logsDownload = document.getElementById("logs-download");
  var logsMeta = document.getElementById("logs-meta");
  var lastLogLines = [];

  function filteredLogLines() {
    var q = (logsFilter.value || "").trim().toLowerCase();
    var lvl = logsLevel.value;
    return lastLogLines.filter(function (line) {
      if (q && line.toLowerCase().indexOf(q) === -1) return false;
      if (lvl) {
        var l = LEVELS[lineLevel(line)];
        if (l === undefined || l > LEVELS[lvl]) return false;
      }
      return true;
    });
  }

  function renderLogs() {
    var shown = filteredLogLines();
    var atBottom = logsBox.scrollHeight - logsBox.scrollTop - logsBox.clientHeight < 40;
    renderLogLines(logsBox, shown, lastLogLines.length ? "No lines match." : "No log lines yet.");
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
  logsCopy.addEventListener("click", function () { copyText(filteredLogLines().join("\\n"), logsCopy); });
  logsDownload.addEventListener("click", function () {
    var blob = new Blob([lastLogLines.join("\\n") + "\\n"], { type: "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "locadot-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".log";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

`;

export const jsSettings = `  // ---------- settings page ----------

  initTabs(document.getElementById("settings-tabs"));

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
    confirmDialog({ title: "Restart the proxy?", message: "Hosts are unavailable for a few seconds.", confirmLabel: "Restart", danger: true }).then(function (ok) {
    if (!ok) return;
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

`;

export const jsUiPassword = `  // ---------- dashboard password ----------

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

`;

export const overviewView = `  <section class="view" data-view="overview" aria-label="Overview">
    <div class="page-head">
      <h2 class="page-title">Overview</h2>
      <p class="page-sub">Everything locadot is doing on this machine at a glance.</p>
    </div>
    <div class="tiles">
      <a class="tile" href="#/hosts"><span class="label">Hosts</span><span id="ov-hosts" class="tile-big">—</span><span id="ov-hosts-sub" class="tile-sub"></span></a>
      <a class="tile" href="#/hosts"><span class="label">Down</span><span id="ov-down" class="tile-big">—</span><span class="tile-sub">targets not answering</span></a>
      <a class="tile" href="#/hosts"><span class="label">Requests</span><span id="ov-hits" class="tile-big">—</span><span id="ov-hits-sub" class="tile-sub">since the proxy started</span></a>
      <a class="tile" href="#/hosts/shared"><span class="label">Public shares</span><span id="ov-shares" class="tile-big">—</span><span id="ov-shares-sub" class="tile-sub"></span></a>
      <a class="tile" href="#/remote"><span class="label">Remote access</span><span id="ov-hub" class="tile-big tile-word">—</span><span id="ov-hub-sub" class="tile-sub"></span></a>
      <a class="tile" href="#/remote/machines"><span class="label">Connected machines</span><span id="ov-remotes" class="tile-big">—</span><span id="ov-remotes-sub" class="tile-sub"></span></a>
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
      <div id="ov-logs" class="logs-box logs-short" aria-live="off"></div>
    </section>
  </section>

`;

export const logsView = `  <section class="view" data-view="logs" aria-label="Logs" hidden>
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
          <label class="check-inline"><input type="checkbox" id="logs-auto" checked> Follow</label>
        </div>
        <div class="card-tools">
          <button type="button" id="logs-refresh" class="btn btn-sm">Refresh</button>
          <button type="button" id="logs-copy" class="btn btn-sm">Copy</button>
          <button type="button" id="logs-download" class="btn btn-sm">Download</button>
          <button type="button" id="logs-clear" class="btn btn-sm btn-danger">Clear</button>
        </div>
      </div>
      <div id="logs-box" class="logs-box logs-full" aria-live="off"></div>
      <div id="logs-meta" class="logs-meta dim"></div>
    </section>
  </section>

`;

export const settingsView = `  <section class="view" data-view="settings" aria-label="Settings" hidden>
    <div class="page-head">
      <h2 class="page-title">Settings</h2>
      <p class="page-sub">Proxy, security and dashboard preferences.</p>
    </div>
    <div id="settings-tabs" class="tabs" role="tablist" data-tabs="settings" aria-label="Settings sections">
      <button type="button" role="tab" data-tab="general">General</button>
      <button type="button" role="tab" data-tab="security">Security</button>
      <button type="button" role="tab" data-tab="preferences">Preferences</button>
      <button type="button" role="tab" data-tab="developer">Developer</button>
    </div>
    <div class="tab-panels">
      <div data-tab-panel="general">
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

            <section class="card danger-card" aria-label="Danger zone">
              <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">Danger zone</h3></div></div>
              <div class="stat-list">
                <div class="stat-row"><div class="stat-main"><div class="label">Clear logs</div><div class="tile-sub">Empty the log file.</div></div><div class="stat-side"><button type="button" id="danger-clear-logs" class="btn btn-sm btn-danger">Clear</button></div></div>
                <div class="stat-row"><div class="stat-main"><div class="label">Stop proxy</div><div class="tile-sub">All hosts stop working until <code class="mono">locadot start</code>.</div></div><div class="stat-side"><button type="button" id="stop-proxy-btn" class="btn btn-sm btn-danger">Stop</button></div></div>
              </div>
            </section>
          </div>
          <aside class="col-secondary">
            <section id="system-card" class="card" aria-label="System and access">
              <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">System &amp; access</h3></div></div>
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
          </aside>
        </div>
      </div>

      <div data-tab-panel="security">
        <div class="layout">
          <div class="col-primary">
            <section class="card" aria-label="HTTPS certificate">
              <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">HTTPS certificate</h3></div></div>
              <div class="stat-list">
                <div class="stat-row">
                  <div class="stat-main">
                    <div class="label">CA trust</div>
                    <div id="tile-ca-value" class="tile-value">—</div>
                    <div class="tile-sub">Trust the local CA so browsers stop warning on https hosts.</div>
                  </div>
                  <div class="stat-side">
                    <button type="button" id="ca-toggle" class="switch" role="switch" aria-checked="false" aria-label="Toggle local CA trust">
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
          </div>
          <aside class="col-secondary">
            <section class="card" aria-label="API token">
              <div class="card-head"><div class="card-title-wrap"><h3 class="card-title">API token</h3></div></div>
              <div class="card-body token-body">
                <div class="tile-sub">Scripts send it as <code class="mono">X-Locadot-Token</code>. It changes every time the proxy starts.</div>
                <div class="token-row"><code id="token-value" class="mono token-value">••••••••••••••••</code>
                  <button type="button" id="token-reveal" class="copy-btn">Show</button>
                  <button type="button" id="token-copy" class="copy-btn">Copy</button></div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <div data-tab-panel="preferences">
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
      </div>

      <div data-tab-panel="developer">
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
    </div>
  </section>
`;

/** Styles for these pages, appended after theme.ts. */
export const css = `
/* Keep card headers on one line on the overview page: short
   title + a single action button shouldn't wrap onto its own row. */
[data-view="overview"] .card-head { flex-wrap: nowrap; }
[data-view="overview"] .card-title-wrap { flex: 1 1 auto; min-width: 0; overflow: hidden; }
[data-view="overview"] .card-title-wrap .card-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
[data-view="overview"] .card-head .card-tools { flex: 0 0 auto; width: auto; }

/* Level-coloured log lines (replaces one big <pre> blob). */
.log-line { font-family: var(--mono); font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-all; }
.log-line + .log-line { margin-top: 1px; }
.log-line-error { color: var(--down); }
.log-line-warn { color: var(--warn); }
.log-line-info { color: var(--fg-2); }
.log-line-debug, .log-line-verbose, .log-line-silly { color: var(--muted); }
.log-line-empty { color: var(--muted); }

/* The logs toolbar stays visible while the log list scrolls underneath it. */
#logs-panel .logs-head {
  position: sticky;
  top: var(--topbar-h);
  z-index: 3;
  background: var(--surface);
}
`;

/** Hosts and public sharing: the add form, the hosts table, the share, access and password dialogs. */

export const jsAddHost = `  // ---------- add host form ----------

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

`;

export const jsHostsTable = `  // ---------- hosts table ----------

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
      if (t.mode === "custom") {
        var modeBadge = document.createElement("span");
        modeBadge.className = "badge badge-accent";
        modeBadge.textContent = "custom";
        statusWrap.appendChild(modeBadge);
      }
      statusWrap.appendChild(makeCopyButton(function () { return t.url; }));
    } else if (t.status === "starting") {
      var spin = document.createElement("span");
      spin.className = "spinner";
      statusWrap.appendChild(spin);
      statusWrap.appendChild(document.createTextNode("Starting\\u2026"));
    } else if (t.status === "login") {
      var loginDot = document.createElement("span");
      loginDot.className = "dot warn";
      statusWrap.appendChild(loginDot);
      var loginText = document.createElement("span");
      loginText.className = "tunnel-login";
      var loginLabel = document.createElement("span");
      loginLabel.textContent = "Waiting for Cloudflare login";
      loginText.appendChild(loginLabel);
      if (t.loginUrl) {
        var loginLink = document.createElement("a");
        loginLink.href = t.loginUrl;
        loginLink.target = "_blank";
        loginLink.rel = "noopener noreferrer";
        loginLink.textContent = "Log in to Cloudflare \u2197";
        loginText.appendChild(loginLink);
      }
      statusWrap.appendChild(loginText);
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
    var isOn = t.enabled || t.status === "up" || t.status === "starting" || t.status === "login";
    var isRetry = !isOn && t.status === "error";
    var shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "btn btn-sm" + (isOn ? " btn-danger" : "");
    shareBtn.textContent = isOn ? "Unshare" : (isRetry ? "Retry" : "Share");
    shareBtn.title = isOn ? "Stop the public tunnel" : "Share on a public URL";
    if (!cloudflaredInstalled && !isOn) {
      shareBtn.disabled = true;
      shareBtn.title = "Install cloudflared first";
    }
    shareBtn.addEventListener("click", function () {
      if (isOn) {
        confirmDialog({ title: "Stop sharing " + row.host + "?", message: "The public URL for " + row.host + " stops working.", confirmLabel: "Stop sharing", danger: true }).then(function (ok) {
          if (!ok) return;
          shareBtn.disabled = true;
          shareBtn.classList.add("busy");
          apiFetch("/api/hosts/" + encodeURIComponent(row.host), { method: "PUT", body: JSON.stringify({ tunnel: false }) })
            .then(function () {
              showToast("Stopping tunnel for " + row.host, "success");
              return loadHosts();
            })
            .catch(function (err) {
              apiError(err, "Couldn't change sharing for " + row.host);
              shareBtn.disabled = false;
              shareBtn.classList.remove("busy");
            });
        });
      } else {
        openShareDialog(row);
      }
    });
    return shareBtn;
  }

`;

export const jsShare = `  // ---------- share dialog ----------

  var shareDialogEl = document.getElementById("share-dialog");
  var shareHostEl = document.getElementById("share-host");
  var shareCloseBtn = document.getElementById("share-close");
  var shareCancelBtn = document.getElementById("share-cancel");
  var shareSubmitBtn = document.getElementById("share-submit");
  var shareOptionRandom = document.getElementById("share-option-random");
  var shareOptionCustom = document.getElementById("share-option-custom");
  var shareCustomExtra = document.getElementById("share-custom-extra");
  var shareDomainInput = document.getElementById("share-domain-input");
  var shareDomainError = document.getElementById("share-domain-error");
  var shareDomainHint = document.getElementById("share-domain-hint");
  var shareErrorEl = document.getElementById("share-error");
  var shareOptionsEl = document.getElementById("share-options");
  var shareProgressEl = document.getElementById("share-progress");
  var shareProgressIcon = document.getElementById("share-progress-icon");
  var shareProgressTitle = document.getElementById("share-progress-title");
  var shareProgressText = document.getElementById("share-progress-text");
  var shareStepsEl = document.getElementById("share-steps");
  var shareStepsDomain = document.getElementById("share-steps-domain");
  var shareAuthLink = document.getElementById("share-auth-link");
  var shareDescEl = shareDialogEl.querySelector(".modal-desc");
  var sharePoll = null;
  var shareAuthWin = null;
  var shareAuthOpened = false;
  var shareRow = null;
  var shareMode = "random";
  var HOSTNAME_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,}$/;

  function normalizeHostname(value) {
    return String(value || "").trim().toLowerCase().replace(/^https?:\\/\\//, "").replace(/\\/$/, "");
  }

  function validateHostname(raw) {
    var value = normalizeHostname(raw);
    if (!value) return "Enter a hostname.";
    if (value.slice(-10) === ".localhost") return "Hostname can't be a .localhost address.";
    if (!HOSTNAME_RE.test(value)) return "Enter a valid hostname, e.g. app.example.com.";
    return null;
  }

  function setShareMode(mode) {
    shareMode = mode;
    shareOptionRandom.setAttribute("aria-checked", String(mode === "random"));
    shareOptionCustom.setAttribute("aria-checked", String(mode === "custom"));
    shareCustomExtra.hidden = mode !== "custom";
    updateDomainHint();
    shareDomainError.hidden = true;
    shareDomainError.textContent = "";
    shareErrorEl.hidden = true;
    shareErrorEl.textContent = "";
    if (mode === "custom") setTimeout(function () { shareDomainInput.focus(); }, 0);
  }

  function coveringZone(hostname) {
    for (var i = 0; i < cloudflareZones.length; i++) {
      var zone = cloudflareZones[i];
      if (hostname === zone || hostname.slice(-(zone.length + 1)) === "." + zone) return zone;
    }
    return null;
  }

  function updateDomainHint() {
    var value = normalizeHostname(shareDomainInput.value);
    var zone = value && !validateHostname(value) ? coveringZone(value) : null;
    shareDomainHint.textContent = zone
      ? "Uses your Cloudflare login for " + zone + ". The DNS record is created or updated for you."
      : "Cloudflare opens in a new tab so you can authorize this domain's zone. Each zone you authorize is remembered.";
  }

  var ICON_CLOUD = '<svg viewBox="0 0 24 24"><path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/></svg>';

  function stopSharePoll() {
    if (sharePoll) clearInterval(sharePoll);
    sharePoll = null;
  }

  function closeAuthWindow() {
    if (shareAuthWin && !shareAuthOpened && !shareAuthWin.closed) shareAuthWin.close();
    shareAuthWin = null;
  }

  function showShareOptions() {
    shareOptionsEl.hidden = false;
    shareDescEl.hidden = false;
    shareProgressEl.hidden = true;
    shareSubmitBtn.hidden = false;
    shareCancelBtn.textContent = "Cancel";
  }

  function showShareProgress(domain, t) {
    shareOptionsEl.hidden = true;
    shareDescEl.hidden = true;
    shareProgressEl.hidden = false;
    shareSubmitBtn.hidden = true;
    shareCancelBtn.textContent = "Close";
    shareCancelBtn.disabled = false;
    var login = t.status === "login";
    if (login) {
      shareProgressIcon.innerHTML = ICON_CLOUD;
      shareProgressTitle.textContent = "Authorize " + domain + " on Cloudflare";
      shareProgressText.textContent = "locadot doesn't have a Cloudflare login for this domain yet.";
    } else {
      shareProgressIcon.innerHTML = '<span class="spinner"></span>';
      shareProgressTitle.textContent = "Setting up " + domain;
      shareProgressText.textContent = t.loginUrl === undefined && shareAuthOpened
        ? "Authorized. Creating the tunnel and the DNS record\u2026"
        : "Checking your Cloudflare login, then creating the tunnel and the DNS record\u2026";
    }
    shareStepsEl.hidden = !login;
    shareStepsDomain.textContent = domain;
    shareAuthLink.hidden = !(login && t.loginUrl);
    if (login && t.loginUrl) {
      shareAuthLink.href = t.loginUrl;
      if (shareAuthWin && !shareAuthOpened && !shareAuthWin.closed) {
        shareAuthWin.location.href = t.loginUrl;
        shareAuthOpened = true;
      }
    }
  }

  function watchShare(host, domain) {
    stopSharePoll();
    showShareProgress(domain, { status: "starting" });
    var tick = function () {
      fetch("/api/hosts").then(parseJsonOrThrow).then(function (hosts) {
        if (shareRow === null || shareRow.host !== host) return;
        var row = null;
        for (var i = 0; i < hosts.length; i++) if (hosts[i].host === host) row = hosts[i];
        var t = row ? tunnelInfo(row) : { status: "error", error: host + " was removed." };
        if (t.status === "up") {
          stopSharePoll();
          closeAuthWindow();
          closeShareDialog();
          showToast(host + " is live at " + t.url, "success");
          renderHosts(hosts);
        } else if (t.status === "error" || t.status === "off") {
          stopSharePoll();
          closeAuthWindow();
          showShareOptions();
          shareErrorEl.textContent = t.error || "Sharing stopped.";
          shareErrorEl.hidden = false;
          shareSubmitBtn.textContent = "Try again";
          renderHosts(hosts);
        } else {
          showShareProgress(domain, t);
        }
      }).catch(function () {});
    };
    sharePoll = setInterval(tick, 1500);
    tick();
  }

  function closeShareDialog() {
    stopSharePoll();
    closeAuthWindow();
    shareRow = null;
    shareDialogEl.close();
  }

  function openShareDialog(row) {
    shareRow = row;
    shareHostEl.textContent = row.host;
    shareErrorEl.hidden = true;
    shareErrorEl.textContent = "";
    shareDomainError.hidden = true;
    shareDomainError.textContent = "";
    var hasDomain = typeof row.tunnelDomain === "string" && !!row.tunnelDomain;
    shareDomainInput.value = hasDomain ? row.tunnelDomain : "";
    showShareOptions();
    shareSubmitBtn.textContent = "Start sharing";
    shareAuthOpened = false;
    setShareMode(hasDomain ? "custom" : "random");
    shareSubmitBtn.disabled = false;
    shareSubmitBtn.classList.remove("busy");
    shareCancelBtn.disabled = false;
    shareDialogEl.showModal();
  }

  shareOptionRandom.addEventListener("click", function () { setShareMode("random"); });
  shareOptionCustom.addEventListener("click", function () { setShareMode("custom"); });
  shareOptionRandom.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); setShareMode("custom"); shareOptionCustom.focus(); }
  });
  shareOptionCustom.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); setShareMode("random"); shareOptionRandom.focus(); }
  });
  shareCancelBtn.addEventListener("click", closeShareDialog);
  shareCloseBtn.addEventListener("click", closeShareDialog);
  shareDialogEl.addEventListener("click", function (e) {
    if (e.target === shareDialogEl) closeShareDialog();
  });
  shareDialogEl.addEventListener("close", function () {
    stopSharePoll();
    closeAuthWindow();
    shareRow = null;
  });
  shareDomainInput.addEventListener("input", updateDomainHint);
  shareDomainInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); shareSubmitBtn.click(); }
  });

  shareSubmitBtn.addEventListener("click", function () {
    if (!shareRow) return;
    var row = shareRow;
    var body = { tunnel: true };
    if (shareMode === "custom") {
      var err = validateHostname(shareDomainInput.value);
      if (err) {
        shareDomainError.textContent = err;
        shareDomainError.hidden = false;
        return;
      }
      body.domain = normalizeHostname(shareDomainInput.value);
    }
    shareSubmitBtn.disabled = true;
    shareSubmitBtn.classList.add("busy");
    shareCancelBtn.disabled = true;
    shareErrorEl.hidden = true;
    // Opened now, inside the click, so the browser allows it; pointed at Cloudflare once the sign-in URL arrives.
    shareAuthOpened = false;
    closeAuthWindow();
    if (body.domain && !coveringZone(body.domain)) {
      shareAuthWin = window.open("", "_blank");
      if (shareAuthWin) {
        try {
          shareAuthWin.document.title = "Connecting to Cloudflare\u2026";
          shareAuthWin.document.body.style.cssText = "font:14px system-ui,sans-serif;color:#666;display:grid;place-items:center;height:100vh;margin:0";
          shareAuthWin.document.body.textContent = "Connecting to Cloudflare\u2026";
        } catch (e) {}
      }
    }
    apiFetch("/api/hosts/" + encodeURIComponent(row.host), { method: "PUT", body: JSON.stringify(body) })
      .then(function () {
        if (body.domain) {
          watchShare(row.host, body.domain);
          return loadHosts();
        }
        showToast("Starting tunnel for " + row.host, "success");
        closeShareDialog();
        return loadHosts();
      })
      .catch(function (err2) {
        closeAuthWindow();
        shareErrorEl.textContent = (err2 && err2.message) ? err2.message : String(err2);
        shareErrorEl.hidden = false;
      })
      .then(function () {
        shareSubmitBtn.disabled = false;
        shareSubmitBtn.classList.remove("busy");
        shareCancelBtn.disabled = false;
      });
  });

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

`;

export const jsProtect = `  // ---------- protect dialog ----------

  var PROTECT_SCOPES = ["shared", "remote", "local"];
  var PROTECT_SCOPE_LABELS = { shared: "Shared link", remote: "Remote access", local: "This machine & network" };

  function protectScopeNames(scopes) {
    return scopes.map(function (s) { return PROTECT_SCOPE_LABELS[s] || s; }).join(", ");
  }

  var protectDialogEl = document.getElementById("protect-dialog");
  var protectHostEl = document.getElementById("protect-host");
  var protectCloseBtn = document.getElementById("protect-close");
  var protectCancelBtn = document.getElementById("protect-cancel");
  var protectSubmitBtn = document.getElementById("protect-submit");
  var protectRemoveBtn = document.getElementById("protect-remove");
  var protectPasswordInput = document.getElementById("protect-password");
  var protectToggleBtn = document.getElementById("protect-toggle");
  var protectErrorEl = document.getElementById("protect-error");
  var protectHintEl = document.getElementById("protect-hint");
  var protectScopeErrorEl = document.getElementById("protect-scope-error");
  var protectOptionEls = PROTECT_SCOPES.map(function (s) { return document.getElementById("protect-option-" + s); });
  var protectRow = null;
  var protectScopes = [];

  function protectRenderScopes() {
    protectOptionEls.forEach(function (el) {
      el.setAttribute("aria-checked", String(protectScopes.indexOf(el.getAttribute("data-scope")) !== -1));
    });
  }

  function protectToggleScope(el) {
    var scope = el.getAttribute("data-scope");
    var on = protectScopes.indexOf(scope) === -1;
    if (on) protectScopes.push(scope);
    else protectScopes = protectScopes.filter(function (s) { return s !== scope; });
    protectRenderScopes();
    protectScopeErrorEl.hidden = true;
    protectScopeErrorEl.textContent = "";
  }

  protectOptionEls.forEach(function (el) {
    el.addEventListener("click", function () { protectToggleScope(el); });
  });

  protectToggleBtn.addEventListener("click", function () {
    var showing = protectPasswordInput.type === "text";
    protectPasswordInput.type = showing ? "password" : "text";
    protectToggleBtn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });

  function closeProtectDialog() {
    protectRow = null;
    protectDialogEl.close();
  }

  function openProtectDialog(row) {
    protectRow = row;
    protectHostEl.textContent = row.host;
    protectPasswordInput.value = "";
    protectPasswordInput.type = "password";
    protectToggleBtn.setAttribute("aria-label", "Show password");
    protectErrorEl.hidden = true;
    protectErrorEl.textContent = "";
    protectScopeErrorEl.hidden = true;
    protectScopeErrorEl.textContent = "";
    protectScopes = row.protect ? row.protect.scopes.slice() : [];
    protectRenderScopes();
    if (row.protect) {
      protectPasswordInput.placeholder = "Leave blank to keep the current password";
      protectHintEl.textContent = "Set " + fmtRelative(row.protect.updatedAt);
      protectHintEl.hidden = false;
      protectRemoveBtn.hidden = false;
      protectSubmitBtn.textContent = "Save";
    } else {
      protectPasswordInput.placeholder = "";
      protectHintEl.hidden = true;
      protectRemoveBtn.hidden = true;
      protectSubmitBtn.textContent = "Protect host";
    }
    protectSubmitBtn.disabled = false;
    protectSubmitBtn.classList.remove("busy");
    protectCancelBtn.disabled = false;
    protectRemoveBtn.disabled = false;
    protectDialogEl.showModal();
    setTimeout(function () { protectPasswordInput.focus(); }, 0);
  }

  protectCancelBtn.addEventListener("click", closeProtectDialog);
  protectCloseBtn.addEventListener("click", closeProtectDialog);
  protectDialogEl.addEventListener("click", function (e) {
    if (e.target === protectDialogEl) closeProtectDialog();
  });
  protectDialogEl.addEventListener("close", function () { protectRow = null; });

  protectRemoveBtn.addEventListener("click", function () {
    if (!protectRow) return;
    var row = protectRow;
    confirmDialog({ title: "Remove password protection?", message: "Anyone will be able to reach " + row.host + " without a password.", confirmLabel: "Remove protection", danger: true }).then(function (ok) {
      if (!ok) return;
      protectRemoveBtn.disabled = true;
      protectSubmitBtn.disabled = true;
      protectCancelBtn.disabled = true;
      apiFetch("/api/hosts/" + encodeURIComponent(row.host), { method: "PUT", body: JSON.stringify({ protect: null }) })
        .then(function () {
          showToast("Removed password protection for " + row.host, "success");
          closeProtectDialog();
          return loadHosts();
        })
        .catch(function (err) {
          protectErrorEl.textContent = err && err.message ? err.message : String(err);
          protectErrorEl.hidden = false;
          protectRemoveBtn.disabled = false;
          protectSubmitBtn.disabled = false;
          protectCancelBtn.disabled = false;
        });
    });
  });

  protectSubmitBtn.addEventListener("click", function () {
    if (!protectRow) return;
    var row = protectRow;
    var password = protectPasswordInput.value;
    protectErrorEl.hidden = true;
    protectErrorEl.textContent = "";
    protectScopeErrorEl.hidden = true;
    protectScopeErrorEl.textContent = "";
    var required = !row.protect;
    if ((required || password) && password.length < 8) {
      protectErrorEl.textContent = "Use at least 8 characters.";
      protectErrorEl.hidden = false;
      return;
    }
    if (!protectScopes.length) {
      protectScopeErrorEl.textContent = "Pick at least one place to ask for the password.";
      protectScopeErrorEl.hidden = false;
      return;
    }
    var protectBody = { scopes: protectScopes.slice() };
    if (password) protectBody.password = password;
    protectSubmitBtn.disabled = true;
    protectSubmitBtn.classList.add("busy");
    protectCancelBtn.disabled = true;
    protectRemoveBtn.disabled = true;
    apiFetch("/api/hosts/" + encodeURIComponent(row.host), { method: "PUT", body: JSON.stringify({ protect: protectBody }) })
      .then(function () {
        showToast("Password protection saved for " + row.host, "success");
        closeProtectDialog();
        return loadHosts();
      })
      .catch(function (err) {
        protectErrorEl.textContent = err && err.message ? err.message : String(err);
        protectErrorEl.hidden = false;
      })
      .then(function () {
        protectSubmitBtn.disabled = false;
        protectSubmitBtn.classList.remove("busy");
        protectCancelBtn.disabled = false;
        protectRemoveBtn.disabled = false;
      });
  });

`;

export const jsHostRows = `  function labelCells(tr, labels) {
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
    if (row.protect) flags.push(["password", "Password protected on: " + protectScopeNames(row.protect.scopes), "badge-accent"]);
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
    var protectBtn = document.createElement("button");
    protectBtn.type = "button";
    var protectScopesSet = row.protect ? row.protect.scopes : [];
    protectBtn.className = "btn btn-sm btn-icon" + (protectScopesSet.length ? " is-set" : "");
    protectBtn.title = protectScopesSet.length ? "Password protected on: " + protectScopeNames(protectScopesSet) : "Password protection: require a password before visitors reach this host";
    protectBtn.setAttribute("aria-label", "Password protection for " + row.host);
    var protectSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    protectSvg.setAttribute("viewBox", "0 0 24 24");
    protectSvg.setAttribute("aria-hidden", "true");
    var protectPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    protectPath.setAttribute("d", "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z");
    protectSvg.appendChild(protectPath);
    protectBtn.appendChild(protectSvg);
    protectBtn.addEventListener("click", function () { openProtectDialog(row); });
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
      (prefs.confirm ? confirmDialog({ title: "Remove host " + row.host + "?", message: "This can't be undone.", confirmLabel: "Remove host", danger: true }) : Promise.resolve(true)).then(function (ok) {
        if (!ok) return;
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
    });
    if (!row.remote) {
      actionsWrap.appendChild(shareButton(row));
      actionsWrap.appendChild(accessBtn);
      actionsWrap.appendChild(protectBtn);
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

`;

export const jsSharingPage = `  // ---------- public sharing page ----------

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

`;

export const hostsView = `  <section class="view" data-view="hosts" aria-label="Hosts" hidden>
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

`;

export const sharingView = `  <section class="view" data-view="sharing" aria-label="Public sharing" hidden>
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

`;

export const allowDialog = `<dialog id="allow-dialog">
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
`;

export const hostDialogs = `<dialog id="share-dialog">
  <div class="modal-head">
    <div>
      <h3 class="modal-title">Share publicly</h3>
      <p id="share-host" class="modal-sub mono"></p>
    </div>
    <button type="button" id="share-close" class="btn btn-ghost modal-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  </div>
  <div class="modal-body">
    <p class="modal-desc">Anyone with the link will be able to reach this host, without signing in.</p>
    <div id="share-options" class="share-options" role="radiogroup" aria-label="Sharing method">
      <button type="button" id="share-option-random" class="option-card" role="radio" aria-checked="false">
        <span class="option-dot" aria-hidden="true"></span>
        <span class="option-body">
          <span class="option-title">Random URL</span>
          <span class="option-desc">https://&lt;random&gt;.trycloudflare.com &middot; No account needed. Changes each time sharing restarts.</span>
        </span>
      </button>
      <button type="button" id="share-option-custom" class="option-card" role="radio" aria-checked="false">
        <span class="option-dot" aria-hidden="true"></span>
        <span class="option-body">
          <span class="option-title">Custom domain</span>
          <span class="option-desc">Your own hostname on a domain in your Cloudflare account. Stable URL.</span>
          <span id="share-custom-extra" class="option-extra" hidden>
            <label for="share-domain-input" class="dim">Hostname</label>
            <input type="text" id="share-domain-input" class="input mono" placeholder="app.example.com" autocomplete="off">
            <div id="share-domain-error" class="field-error" role="alert" hidden></div>
            <p id="share-domain-hint" class="modal-hint"></p>
          </span>
        </span>
      </button>
    </div>
    <div id="share-progress" class="share-progress" hidden>
      <div id="share-progress-icon" class="share-progress-icon" aria-hidden="true"></div>
      <div class="share-progress-body">
        <p id="share-progress-title" class="share-progress-title"></p>
        <p id="share-progress-text" class="share-progress-text"></p>
        <ol id="share-steps" class="share-steps" hidden>
          <li>Sign in to Cloudflare in the tab that opens.</li>
          <li>Pick the zone <span id="share-steps-domain" class="mono"></span> is in, then <strong>Authorize</strong>.</li>
          <li>Come back here. This dialog updates by itself.</li>
        </ol>
        <a id="share-auth-link" class="btn btn-primary" target="_blank" rel="noopener noreferrer" hidden>Open Cloudflare &#8599;</a>
      </div>
    </div>
    <div id="share-error" class="field-error" role="alert" hidden></div>
  </div>
  <div class="modal-foot">
    <button type="button" id="share-cancel" class="btn">Cancel</button>
    <button type="button" id="share-submit" class="btn btn-primary">Start sharing</button>
  </div>
</dialog>
<dialog id="protect-dialog">
  <div class="modal-head">
    <div>
      <h3 class="modal-title">Password protection</h3>
      <p id="protect-host" class="modal-sub mono"></p>
    </div>
    <button type="button" id="protect-close" class="btn btn-ghost modal-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  </div>
  <div class="modal-body">
    <p class="modal-desc">Visitors see a sign-in page and need this password before they reach the app.</p>
    <div class="field">
      <label for="protect-password">Password</label>
      <div class="field-password">
        <input type="password" id="protect-password" class="input" autocomplete="new-password">
        <button type="button" id="protect-toggle" class="field-toggle" aria-label="Show password">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <p id="protect-hint" class="modal-hint" hidden></p>
      <div id="protect-error" class="field-error" role="alert" hidden></div>
    </div>
    <div class="field">
      <label>Ask for it on</label>
      <div id="protect-options" class="share-options" role="group" aria-label="Ask for the password on">
        <button type="button" id="protect-option-shared" class="option-card" role="checkbox" aria-checked="false" data-scope="shared">
          <span class="option-check" aria-hidden="true"></span>
          <span class="option-body">
            <span class="option-title">Shared link</span>
            <span class="option-desc">Visitors on the public tunnel URL (Share).</span>
          </span>
        </button>
        <button type="button" id="protect-option-remote" class="option-card" role="checkbox" aria-checked="false" data-scope="remote">
          <span class="option-check" aria-hidden="true"></span>
          <span class="option-body">
            <span class="option-title">Remote access</span>
            <span class="option-desc">Machines connected to this one through remote access.</span>
          </span>
        </button>
        <button type="button" id="protect-option-local" class="option-card" role="checkbox" aria-checked="false" data-scope="local">
          <span class="option-check" aria-hidden="true"></span>
          <span class="option-body">
            <span class="option-title">This machine &amp; network</span>
            <span class="option-desc">Browsers on this computer or your local network.</span>
          </span>
        </button>
      </div>
      <div id="protect-scope-error" class="field-error" role="alert" hidden></div>
    </div>
  </div>
  <div class="modal-foot">
    <button type="button" id="protect-remove" class="btn btn-danger" hidden>Remove protection</button>
    <button type="button" id="protect-cancel" class="btn">Cancel</button>
    <button type="button" id="protect-submit" class="btn btn-primary">Protect host</button>
  </div>
</dialog>
`;

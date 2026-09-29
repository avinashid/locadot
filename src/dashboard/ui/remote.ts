/** Remote access (sharing this machine) and connected machines: one page, two tabs. */

export const jsHub = `  // ---------- remote access: hub (sender) ----------

  var remoteInviteActionBtn = document.getElementById("remote-invite-action");
  var remoteConnectActionBtn = document.getElementById("remote-connect-action");
  var hubSetupSection = document.getElementById("hub-setup-section");
  var inviteSectionOpen = false;

  var remoteTabsEl = document.querySelector('.tabs[data-tabs="remote"]');
  if (remoteTabsEl) initTabs(remoteTabsEl, { onChange: function () { updatePageActions(); } });

  function updatePageActions() {
    var tab = currentTab("remote");
    var up = !!(lastHub && lastHub.status === "up");
    remoteInviteActionBtn.hidden = !(tab === "hub" && up);
    remoteConnectActionBtn.hidden = tab !== "machines";
  }

  remoteInviteActionBtn.addEventListener("click", function () {
    inviteSectionOpen = !inviteSectionOpen;
    hubShareSection.hidden = !(lastHub && lastHub.status === "up" && inviteSectionOpen);
    if (!hubShareSection.hidden) {
      updateInviteHostsVisibility();
      hubShareSection.scrollIntoView({ behavior: motionOk() ? "smooth" : "auto", block: "nearest" });
      inviteRoleSelect.focus();
    }
  });

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
    peers.forEach(function (peer, i) {
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

      var meta = document.createElement("div");
      meta.className = "peer-controls";
      var roleBadge = document.createElement("span");
      roleBadge.className = "badge badge-accent badge-role";
      roleBadge.textContent = peer.role;
      meta.appendChild(roleBadge);

      function setRole(role) {
        if (role === peer.role) return;
        apiFetch("/api/peers/" + encodeURIComponent(peer.id), { method: "PUT", body: JSON.stringify({ role: role, hosts: peer.hosts }) })
          .then(function () { showToast("Updated role for " + peer.name, "success"); return loadHub(); })
          .catch(function (err) { apiError(err, "Couldn't update role"); });
      }
      function revoke() {
        confirmDialog({ title: "Revoke " + peer.name + "?", message: "This peer will lose access immediately.", confirmLabel: "Revoke", danger: true }).then(function (ok) {
          if (!ok) return;
          apiFetch("/api/peers/" + encodeURIComponent(peer.id), { method: "DELETE" })
            .then(function () { showToast("Revoked " + peer.name, "success"); return loadHub(); })
            .catch(function (err) { apiError(err, "Couldn't revoke peer"); });
        });
      }
      meta.appendChild(makeMoreButton(function () {
        return ["viewer", "editor", "admin"].map(function (r) {
          return { label: "Set as " + r.charAt(0).toUpperCase() + r.slice(1), disabled: r === peer.role, onSelect: function () { setRole(r); } };
        }).concat(["-", { label: "Revoke", icon: ICONS.trash, danger: true, onSelect: revoke }]);
      }, { label: "Actions for " + peer.name, small: true }));
      row.appendChild(meta);
      peersListEl.appendChild(row);
      animateIn(row, i);
    });
  }

  function renderInvites(invites) {
    invitesEmptyEl.hidden = invites.length !== 0;
    clear(invitesListEl);
    invites.forEach(function (invite, i) {
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
      revokeBtn.className = "btn btn-ghost btn-icon btn-sm";
      revokeBtn.setAttribute("aria-label", "Revoke invite");
      revokeBtn.setAttribute("data-tip", "Revoke");
      revokeBtn.appendChild(svgIcon(ICONS.close));
      revokeBtn.addEventListener("click", function () {
        revokeBtn.disabled = true;
        apiFetch("/api/invites/" + encodeURIComponent(invite.id), { method: "DELETE" })
          .then(function () { return loadHub(); })
          .catch(function (err) { apiError(err, "Couldn't revoke invite"); revokeBtn.disabled = false; });
      });
      row.appendChild(revokeBtn);
      invitesListEl.appendChild(row);
      animateIn(row, i);
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
    var up = status === "up";

    var dotClass = status === "up" ? "up" : status === "starting" ? "warn" : status === "login" ? "accent" : status === "error" ? "down" : "";
    hubDot.className = "dot" + (dotClass ? " " + dotClass : "");
    var labels = { off: "Off", starting: "Starting\\u2026", login: "Login required", up: "Up", error: "Error" };
    hubStatusText.textContent = labels[status] || status;

    hubUrlRow.hidden = !(up && hub.url);
    if (up && hub.url) hubUrlEl.textContent = hub.url;

    hubLoginRow.hidden = !(status === "login" && hub.loginUrl);
    if (status === "login" && hub.loginUrl) hubLoginLink.href = hub.loginUrl;

    hubQuickWarning.hidden = !(up && hub.mode === "quick");

    hubLocalhostRow.hidden = !data.config;
    setSwitch(hubLocalhostSwitch, data.localhost !== false);
    hubPanelUrl = up && hub.url ? hub.url : "";
    hubPanelRow.hidden = !data.config;
    renderHubPanel(data.panel === true);

    hubErrorRow.hidden = !(status === "error" && hub.error);
    if (status === "error" && hub.error) hubErrorRow.textContent = hub.error;

    var running = status === "starting" || status === "login" || up;
    hubSetupSection.hidden = up;
    hubNamedForm.hidden = up;
    hubQuickBtn.hidden = up;
    hubStopBtn.hidden = !running;

    if (data.config && data.config.mode === "named" && data.config.domain && !hubDomainInput.value) {
      hubDomainInput.value = data.config.domain;
    }

    hubShareSection.hidden = !(up && inviteSectionOpen);
    if (up) updateInviteHostsVisibility();

    renderPeers(data.peers);
    renderInvites(data.invites);
    updatePageActions();
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
    confirmDialog({ title: "Stop remote access?", message: "Connected peers will be disconnected.", confirmLabel: "Stop remote access", danger: true }).then(function (ok) {
      if (!ok) return;
      hubStopBtn.disabled = true;
      hubStopBtn.classList.add("busy");
      apiFetch("/api/hub", { method: "POST", body: JSON.stringify({ mode: "off" }) })
        .then(function () { showToast("Remote access stopped", "success"); return loadHub(); })
        .catch(function (err) { apiError(err, "Couldn't stop remote access"); })
        .then(function () { hubStopBtn.disabled = false; hubStopBtn.classList.remove("busy"); });
    });
  });

`;

export const jsReceiver = `  // ---------- remote access: connected machines (receiver) ----------

  remoteConnectActionBtn.addEventListener("click", function () {
    connectStringInput.scrollIntoView({ behavior: motionOk() ? "smooth" : "auto", block: "center" });
    connectStringInput.focus();
  });

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
    remotes.forEach(function (remote, i) {
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

      var controls = document.createElement("div");
      controls.className = "remote-controls";
      var roleBadge = document.createElement("span");
      roleBadge.className = "badge badge-role badge-accent";
      roleBadge.textContent = remote.role;
      controls.appendChild(roleBadge);
      var statusBadge = document.createElement("span");
      statusBadge.className = "badge badge-dot " + (remote.status === "ok" ? "badge-up" : "badge-down");
      statusBadge.textContent = remote.status === "ok" ? "connected" : "error";
      if (remote.status !== "ok" && remote.error) statusBadge.title = remote.error;
      controls.appendChild(statusBadge);

      var syncBtn = document.createElement("button");
      syncBtn.type = "button";
      syncBtn.className = "btn btn-ghost btn-icon btn-sm";
      syncBtn.setAttribute("aria-label", "Sync " + remote.name);
      syncBtn.setAttribute("data-tip", "Sync");
      syncBtn.appendChild(svgIcon(ICONS.refresh));
      syncBtn.addEventListener("click", function () {
        syncBtn.disabled = true;
        syncBtn.classList.add("busy");
        apiFetch("/api/remotes/" + encodeURIComponent(remote.name) + "/sync", { method: "POST" })
          .then(function () { showToast("Synced " + remote.name, "success"); return Promise.all([loadRemotes(), loadHosts()]); })
          .catch(function (err) { apiError(err, "Couldn't sync " + remote.name); })
          .then(function () { syncBtn.disabled = false; syncBtn.classList.remove("busy"); });
      });
      controls.appendChild(syncBtn);

      controls.appendChild(makeMoreButton(function () {
        return [
          {
            label: "Update URL", icon: ICONS.edit, onSelect: function () {
              promptDialog({ title: "Update URL", message: "New URL for " + remote.name, label: "URL", value: remote.url, confirmLabel: "Save" }).then(function (next) {
                if (!next || !next.trim() || next.trim() === remote.url) return;
                apiFetch("/api/remotes/" + encodeURIComponent(remote.name), { method: "PUT", body: JSON.stringify({ url: next.trim() }) })
                  .then(function () { showToast("Updated URL for " + remote.name, "success"); return loadRemotes(); })
                  .catch(function (err) { apiError(err, "Couldn't update URL"); });
              });
            }
          },
          "-",
          {
            label: "Disconnect", icon: ICONS.trash, danger: true, onSelect: function () {
              confirmDialog({ title: "Disconnect from " + remote.name + "?", message: "This removes its hosts too.", confirmLabel: "Disconnect", danger: true }).then(function (ok) {
                if (!ok) return;
                apiFetch("/api/remotes/" + encodeURIComponent(remote.name), { method: "DELETE" })
                  .then(function () { showToast("Disconnected " + remote.name, "success"); return Promise.all([loadRemotes(), loadHosts()]); })
                  .catch(function (err) { apiError(err, "Couldn't disconnect"); });
              });
            }
          }
        ];
      }, { label: "Actions for " + remote.name, small: true }));
      head.appendChild(controls);
      item.appendChild(head);

      var urlRow = document.createElement("div");
      urlRow.className = "hub-row";
      var urlText = document.createElement("span");
      urlText.className = "hub-url";
      urlText.textContent = remote.url;
      urlRow.appendChild(urlText);
      item.appendChild(urlRow);
      if (remote.role === "admin") item.appendChild(remoteLocalRow(remote));

      var hostsLabel = document.createElement("div");
      hostsLabel.className = "label";
      hostsLabel.textContent = "Shared hosts";
      item.appendChild(hostsLabel);

      var hostsWrap = document.createElement("div");
      hostsWrap.className = "remote-hosts-list";
      if (remote.available === null) {
        var errLine = document.createElement("div");
        errLine.className = "dim";
        errLine.textContent = "Couldn't load hosts: " + (remote.error || "unknown error");
        hostsWrap.appendChild(errLine);
      } else if (!(remote.available || []).length) {
        var noneLine = document.createElement("div");
        noneLine.className = "dim";
        noneLine.textContent = "No hosts shared yet.";
        hostsWrap.appendChild(noneLine);
      } else {
        (remote.available || []).forEach(function (h) {
          var hostRow = document.createElement("div");
          hostRow.className = "remote-host-row";
          var hostMain = document.createElement("div");
          hostMain.className = "mono";
          var aliases = (remote.mapped || []).filter(function (m) { return m.host === h.host; }).map(function (m) { return m.local; });
          hostMain.appendChild(document.createTextNode(h.host + (aliases.length ? " \\u2192 " : "")));
          aliases.forEach(function (aliasName, idx) {
            if (idx) hostMain.appendChild(document.createTextNode(", "));
            var aliasRow = lastHosts.filter(function (r) { return r.host === aliasName; })[0];
            var aliasHref = aliasRow && aliasRow.urls && (aliasRow.urls.https || aliasRow.urls.http);
            if (aliasHref) {
              var link = document.createElement("a");
              link.href = aliasHref;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              link.textContent = aliasName;
              hostMain.appendChild(link);
            } else {
              hostMain.appendChild(document.createTextNode(aliasName));
            }
          });
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
              confirmDialog({ title: "Delete " + h.host + " on " + remote.name + "?", message: "This can't be undone.", confirmLabel: "Delete", danger: true }).then(function (ok) {
                if (!ok) return;
                delBtn.disabled = true;
                apiFetch("/api/remotes/" + encodeURIComponent(remote.name) + "/hosts/" + encodeURIComponent(h.host), { method: "DELETE" })
                  .then(function () { showToast("Deleted " + h.host, "success"); return Promise.all([loadRemotes(), loadHosts()]); })
                  .catch(function (err) { apiError(err, "Couldn't delete host"); delBtn.disabled = false; });
              });
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
      animateIn(item, i);
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
    confirmDialog({ title: "Stop the locadot proxy?", message: "Run \\"locadot start\\" to bring it back up.", confirmLabel: "Stop proxy", danger: true }).then(function (ok) {
      if (!ok) return;
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

`;

export const remoteView = `  <section class="view" data-view="remote" aria-label="Remote" hidden>
    <div class="page-head">
      <h2 class="page-title">Remote</h2>
      <p class="page-sub">Share this machine's hosts with other locadots, or connect to one that's sharing.</p>
      <div class="page-actions">
        <button type="button" id="remote-invite-action" class="btn btn-primary" hidden>Create pairing link</button>
        <button type="button" id="remote-connect-action" class="btn btn-primary" hidden>Connect a machine</button>
      </div>
    </div>

    <div class="tabs" role="tablist" data-tabs="remote" aria-label="Remote sections">
      <button type="button" role="tab" data-tab="hub">This machine</button>
      <button type="button" role="tab" data-tab="machines">Connected machines</button>
    </div>

    <div data-tab-panel="hub">
      <div class="layout">
        <div class="col-primary">
          <section id="hub-card" class="card" aria-label="This machine">
            <div class="card-head">
              <div class="card-title-wrap">
                <h3 class="card-title">This machine</h3>
                <p class="card-desc">Share its hosts with other locadots through a Cloudflare hostname.</p>
              </div>
            </div>

            <div class="hub-section">
              <div class="hub-hero-top">
                <span class="pill"><span id="hub-dot" class="dot"></span><span id="hub-status-text" class="hub-status-text">Off</span></span>
                <button type="button" id="hub-stop-btn" class="btn btn-sm btn-danger" hidden>Stop</button>
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
            </div>

            <div id="hub-setup-section" class="hub-section" hidden>
              <div class="label">Turn on remote access</div>
              <div class="setup-grid">
                <div class="setup-card">
                  <div class="setup-card-title">Use my domain</div>
                  <p class="setup-card-desc">Your own hostname on a domain in your Cloudflare account. Stable URL.</p>
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
                </div>
                <div class="setup-card">
                  <div class="setup-card-title">Quick tunnel</div>
                  <p class="setup-card-desc">Free, no account needed. The URL changes each time it restarts.</p>
                  <button type="button" id="hub-quick-btn" class="btn btn-sm">Use quick tunnel</button>
                </div>
              </div>
            </div>

            <div class="hub-section">
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

            <div class="hub-section">
              <div class="label">Peers</div>
              <div id="peers-empty" class="dim" hidden>No peers yet.</div>
              <div id="peers-list" class="peer-list"></div>
            </div>

            <div class="hub-section">
              <div class="label">Pending invites</div>
              <div id="hub-share-section" class="invite-create" hidden>
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
              <div id="invites-empty" class="dim" hidden>No pending invites.</div>
              <div id="invites-list" class="invite-list"></div>
            </div>
          </section>
        </div>
        <aside class="col-secondary">
          <details class="card" open>
            <summary><div class="card-title-wrap"><h3 class="card-title">How it works</h3></div></summary>
            <div class="card-body help-list">
              <p>1. Turn on a tunnel: your own domain keeps the same address; a quick tunnel is free but its URL changes on restart.</p>
              <p>2. Create a pairing link. It works once and expires after 5 minutes.</p>
              <p>3. The other machine pastes it under <a href="#/remote/machines">Connected machines</a>.</p>
              <div class="role-table">
                <div><strong>Viewer</strong><span>browse the hosts you pick</span></div>
                <div><strong>Editor</strong><span>also add and change hosts here</span></div>
                <div><strong>Admin</strong><span>also delete hosts, change sharing, and open this dashboard and any port on this machine</span></div>
              </div>
              <p class="dim">Editors can reach anything this machine can. Change or revoke a role any time under Peers.</p>
            </div>
          </details>
        </aside>
      </div>
    </div>

    <div data-tab-panel="machines">
      <section id="connect-card" class="card" aria-label="Connect a machine">
        <div class="card-head">
          <div class="card-title-wrap">
            <h3 class="card-title">Connect a machine</h3>
            <p class="card-desc">Paste a one-time pairing link from another locadot.</p>
          </div>
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
      </section>

      <section id="remotes-card" class="card" aria-label="Connected machines">
        <div class="card-head">
          <div class="card-title-wrap"><h3 class="card-title">Connected machines</h3></div>
        </div>
        <div class="hub-section">
          <div id="remotes-empty" class="empty" hidden>
            <span class="empty-icon" aria-hidden="true">~</span>
            <p class="empty-title">Not connected to anything yet</p>
            <p class="empty-desc">Paste a pairing link above to connect to another locadot.</p>
          </div>
          <div id="remotes-list" class="remote-list"></div>
        </div>
      </section>
    </div>
  </section>

`;

/** Styles for these pages, appended after theme.ts. */
export const css = `
.hub-hero-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.hub-status-text { font-size: 15px; font-weight: 600; }
#hub-dot { width: 10px; height: 10px; }
.setup-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
.setup-card { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-2); padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.setup-card-title { font-size: 13.5px; font-weight: 600; }
.setup-card-desc { margin: 0; font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.setup-card .hub-form-row { margin-top: 2px; flex-direction: column; align-items: stretch; }
.setup-card .hub-form-row .field { min-width: 0; }
.setup-card .hub-form-row > .btn { align-self: flex-start; }
[data-view="remote"] .card-title { white-space: nowrap; }
.setup-card > .btn { align-self: flex-start; }
.invite-create { display: flex; flex-direction: column; gap: 10px; padding-bottom: 4px; }
.remote-host-row a { color: var(--accent); text-decoration: none; }
.remote-host-row a:hover { text-decoration: underline; }
@media (max-width: 640px) {
  .setup-grid { grid-template-columns: minmax(0, 1fr); }
}
`;

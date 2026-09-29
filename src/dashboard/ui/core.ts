/**
 * Shared client state and helpers (elements, fetch, toasts, UI components) and the polling loop.
 *
 * UI component API (all functions live in the single page script scope):
 *
 *   openMenu(anchorEl, items, opts?) -> close()
 *     items: Array of "-" (separator) or { label, icon?, hint?, danger?, disabled?, onSelect?, info? }
 *       icon  an SVG path "d" string (24x24 viewBox, stroked), e.g. ICONS.edit
 *       hint  right-aligned secondary text; info: true renders a non-interactive label/hint row
 *     opts: { label? (aria-label), title? (heading shown in the phone sheet), align?: "end" | "start", onClose? }
 *     Anchored popover on >640px (arrows/Home/End/Enter/Esc, focus returns to the anchor), bottom sheet on <=640px.
 *     Calling it again with the same anchor toggles the menu closed. closeMenu(returnFocus) closes any open menu.
 *   makeMoreButton(items | () => items, { label?, small?, align?, title? }) -> a ready "..." button (.btn-more)
 *   svgIcon(d, className?) -> <svg> element;  ICONS: common path strings (edit, trash, copy, external, globe,
 *     lock, unlock, shield, refresh, plus, check, close, stop, play, link, logs, settings, signOut, machine, key, more)
 *
 *   initTabs(tablistEl, opts?) -> { select(name, { focus? }), current(), names() }
 *     Markup: <div class="tabs" role="tablist" data-tabs="<view>" aria-label="...">
 *               <button role="tab" data-tab="machines">Machines</button> ...
 *             </div>
 *             <div data-tab-panel="machines"> ... </div>   (inside the same section.view, or opts.scope)
 *     When data-tabs (or opts.view) names a view, the group is routed: #/<view>/<tab> deep-links to the tab,
 *     clicking a tab rewrites the hash, and a missing/unknown tab selects the first one. opts.route = false
 *     opts out. opts.onChange(tab, prevTab) runs when the tab changes and when the view is entered.
 *     opts.initial picks the tab selected before routing runs. currentTab(view) reads a group's tab.
 *
 *   animateIn(el, index?)   plays the list-row enter animation once (index staggers by 25ms, capped).
 *   showToast(message, kind?: "info" | "success" | "error" | "warn", hint?)   stacks max 4, above dialogs.
 *   confirmDialog / promptDialog (shell.ts) for confirmations; every <dialog> animates open/close
 *     (close() plays the exit animation, then closes ~170ms later) and is a bottom sheet on phones.
 *   data-tip="text" (+ data-tip-pos="top|right|bottom") on any element shows a tooltip on hover/keyboard focus.
 */

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

  // Toasts live in a manual popover so they stay visible above an open modal dialog.
  if (typeof HTMLElement.prototype.showPopover === "function") toastContainer.setAttribute("popover", "manual");
  function liftToasts() {
    if (typeof toastContainer.showPopover !== "function" || !toastContainer.hasAttribute("popover")) return;
    try {
      if (toastContainer.matches(":popover-open")) toastContainer.hidePopover();
      toastContainer.showPopover();
    } catch (e) {}
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
    while (toastContainer.children.length >= 4) toastContainer.removeChild(toastContainer.firstElementChild);
    toastContainer.appendChild(el);
    liftToasts();
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("show"); }); });
    var timeout = hint ? 9000 : 4500;
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (hasPopover && !toastContainer.children.length) { try { toastContainer.hidePopover(); } catch (e) {} }
      }, 300);
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
  // ---------- shared UI components ----------
  // See the API block at the top of this file (core.ts).

  var SVG_NS = "http://www.w3.org/2000/svg";
  var ICONS = {
    more: "M5 12h.01M12 12h.01M19 12h.01",
    edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
    copy: "M9 9h11v11H9zM5 15H4V4h11v1",
    external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
    globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
    lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
    unlock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2",
    shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z",
    refresh: "M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M21 4v5h-5M3 20v-5h5",
    plus: "M12 5v14M5 12h14",
    check: "M5 12l5 5L20 7",
    close: "M6 6l12 12M18 6L6 18",
    stop: "M6 6h12v12H6z",
    play: "M7 4l13 8-13 8z",
    link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
    logs: "M4 6h16M4 12h16M4 18h10",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15l1.2 2-2 3.4-2.3-.6a8 8 0 0 1-2 1.2L13.6 23h-3.2l-.7-2a8 8 0 0 1-2-1.2l-2.3.6-2-3.4 1.2-2a8 8 0 0 1 0-2.3l-1.2-2 2-3.4 2.3.6a8 8 0 0 1 2-1.2l.7-2h3.2l.7 2a8 8 0 0 1 2 1.2l2.3-.6 2 3.4-1.2 2a8 8 0 0 1 0 2.3z",
    signOut: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    machine: "M3 4h18v12H3zM8 20h8M12 16v4",
    key: "M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7z"
  };

  function svgIcon(d, cls) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (cls) svg.setAttribute("class", cls);
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
    return svg;
  }

  var reducedMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var sheetMq = window.matchMedia("(max-width: 640px)");
  function motionOk() { return !reducedMotionMq.matches; }
  var hasPopover = typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.showPopover === "function";

  function animateIn(el, index) {
    if (!el || !motionOk()) return el;
    el.classList.remove("anim-in");
    void el.offsetWidth;
    if (index) el.style.animationDelay = Math.min(index, 8) * 25 + "ms";
    el.classList.add("anim-in");
    el.addEventListener("animationend", function done() {
      el.classList.remove("anim-in");
      el.style.animationDelay = "";
      el.removeEventListener("animationend", done);
    });
    return el;
  }

  // Every <dialog> gets an exit animation: close() plays it, then really closes.
  // showModal() while a close is pending finishes the close first.
  (function () {
    if (typeof HTMLDialogElement === "undefined") return;
    var proto = HTMLDialogElement.prototype;
    var nativeClose = proto.close;
    var nativeShowModal = proto.showModal;
    function finish(d, value) {
      if (d.__closeTimer) { clearTimeout(d.__closeTimer); d.__closeTimer = null; }
      d.classList.remove("closing");
      if (d.open) nativeClose.call(d, value);
    }
    proto.close = function (value) {
      var d = this;
      if (!d.open || !motionOk() || !d.isConnected) { finish(d, value); return; }
      if (d.__closeTimer) return;
      d.classList.add("closing");
      d.__closeTimer = setTimeout(function () { d.__closeTimer = null; finish(d, value); }, 170);
    };
    proto.showModal = function () {
      if (this.__closeTimer) finish(this);
      if (this.open) return;
      return nativeShowModal.apply(this, arguments);
    };
  })();

  // ---------- menu ----------
  var menuState = null;

  function closeMenu(returnFocus) {
    var st = menuState;
    if (!st) return;
    menuState = null;
    document.removeEventListener("pointerdown", st.onPointer, true);
    window.removeEventListener("resize", st.onWin);
    window.removeEventListener("scroll", st.onScroll, true);
    st.anchor.setAttribute("aria-expanded", "false");
    var menu = st.menu;
    function remove() {
      if (hasPopover) { try { menu.hidePopover(); } catch (e) {} }
      if (menu.parentNode) menu.parentNode.removeChild(menu);
    }
    if (motionOk()) { menu.classList.add("menu-closing"); setTimeout(remove, 180); }
    else remove();
    if (returnFocus && st.anchor.isConnected) st.anchor.focus({ preventScroll: true });
    if (st.opts.onClose) st.opts.onClose();
  }

  function positionMenu(menu, anchor, align) {
    var r = anchor.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;
    var mw = menu.offsetWidth;
    var mh = menu.offsetHeight;
    var start = align === "start";
    var left = start ? r.left : r.right - mw;
    if (left + mw > vw - 8) { left = vw - mw - 8; }
    if (left < 8) { left = 8; }
    var top = r.bottom + 6;
    var up = false;
    if (top + mh > vh - 8 && r.top - mh - 6 >= 8) { top = r.top - mh - 6; up = true; }
    if (top + mh > vh - 8) top = Math.max(8, vh - mh - 8);
    menu.style.left = Math.round(left) + "px";
    menu.style.top = Math.round(top) + "px";
    menu.classList.toggle("menu-up", up);
    menu.classList.toggle("menu-start", start);
  }

  function openMenu(anchorEl, items, opts) {
    opts = opts || {};
    if (menuState) {
      var same = menuState.anchor === anchorEl;
      closeMenu(false);
      if (same) return null;
    }
    hideTooltip();
    var sheet = sheetMq.matches;
    var menu = document.createElement("div");
    menu.className = "menu" + (sheet ? " menu-sheet" : "");
    menu.setAttribute("role", "menu");
    menu.tabIndex = -1;
    if (opts.label) menu.setAttribute("aria-label", opts.label);
    if (sheet && opts.title) {
      var title = document.createElement("div");
      title.className = "menu-title";
      title.textContent = opts.title;
      menu.appendChild(title);
    }
    var buttons = [];
    var withIcons = items.some(function (it) { return it && it !== "-" && it.icon; });
    function addButton(it, extraClass) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "menu-item" + (it.danger ? " danger" : "") + (extraClass ? " " + extraClass : "");
      b.setAttribute("role", "menuitem");
      b.tabIndex = -1;
      if (it.disabled) { b.disabled = true; b.setAttribute("aria-disabled", "true"); }
      if (it.icon) b.appendChild(svgIcon(it.icon, "menu-icon"));
      else if (withIcons && !extraClass) { var ph = document.createElement("span"); ph.className = "menu-icon"; b.appendChild(ph); }
      var lab = document.createElement("span");
      lab.className = "menu-label";
      lab.textContent = it.label;
      b.appendChild(lab);
      if (it.hint) { var h = document.createElement("span"); h.className = "menu-hint"; h.textContent = it.hint; b.appendChild(h); }
      b.addEventListener("click", function () {
        if (b.disabled) return;
        closeMenu(true);
        if (typeof it.onSelect === "function") it.onSelect();
      });
      buttons.push(b);
      menu.appendChild(b);
    }
    items.forEach(function (it) {
      if (!it) return;
      if (it === "-") {
        var sep = document.createElement("div");
        sep.className = "menu-sep";
        sep.setAttribute("role", "separator");
        menu.appendChild(sep);
        return;
      }
      if (it.info) {
        var row = document.createElement("div");
        row.className = "menu-info";
        row.setAttribute("role", "presentation");
        var l = document.createElement("span");
        l.textContent = it.label;
        row.appendChild(l);
        if (it.hint) { var hv = document.createElement("span"); hv.className = "menu-hint"; hv.textContent = it.hint; row.appendChild(hv); }
        menu.appendChild(row);
        return;
      }
      addButton(it);
    });
    if (sheet) addButton({ label: "Cancel" }, "menu-cancel");

    function enabled() { return buttons.filter(function (b) { return !b.disabled && b.offsetParent !== null; }); }
    function move(delta) {
      var list = enabled();
      if (!list.length) return;
      var i = list.indexOf(document.activeElement);
      var next = i === -1 ? (delta > 0 ? 0 : list.length - 1) : (i + delta + list.length) % list.length;
      list[next].focus();
    }
    menu.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Home") { e.preventDefault(); var a = enabled(); if (a[0]) a[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); var z = enabled(); if (z.length) z[z.length - 1].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      else if (e.key === "Tab") { e.preventDefault(); closeMenu(true); }
    });

    if (hasPopover) menu.setAttribute("popover", "manual");
    document.body.appendChild(menu);
    if (hasPopover) { try { menu.showPopover(); } catch (e) {} }
    if (!sheet) positionMenu(menu, anchorEl, opts.align);
    anchorEl.setAttribute("aria-haspopup", "menu");
    anchorEl.setAttribute("aria-expanded", "true");

    var st = {
      menu: menu,
      anchor: anchorEl,
      opts: opts,
      onPointer: function (e) {
        if (anchorEl.contains(e.target)) return;
        if (menu.contains(e.target)) {
          if (e.target !== menu) return;
          var r = menu.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
        }
        closeMenu(false);
      },
      onWin: function () { closeMenu(false); },
      onScroll: function (e) { if (!sheet && !menu.contains(e.target)) closeMenu(false); }
    };
    menuState = st;
    document.addEventListener("pointerdown", st.onPointer, true);
    window.addEventListener("resize", st.onWin);
    window.addEventListener("scroll", st.onScroll, true);
    var first = enabled()[0];
    (first || menu).focus({ preventScroll: true });
    return function () { if (menuState === st) closeMenu(true); };
  }

  function makeMoreButton(items, opts) {
    opts = opts || {};
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost btn-icon btn-more" + (opts.small ? " btn-sm" : "");
    btn.setAttribute("aria-label", opts.label || "More actions");
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    [5, 12, 19].forEach(function (cx) {
      var c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", String(cx));
      c.setAttribute("cy", "12");
      c.setAttribute("r", "1.7");
      svg.appendChild(c);
    });
    btn.appendChild(svg);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      openMenu(btn, typeof items === "function" ? items() : items, { label: opts.label || "More actions", title: opts.title, align: opts.align || "end" });
    });
    return btn;
  }

  // ---------- tabs ----------
  var tabGroups = {};

  function initTabs(root, opts) {
    opts = opts || {};
    var view = opts.view || root.getAttribute("data-tabs") || "";
    var scope = opts.scope || root.closest("section.view") || document;
    var routed = opts.route !== false && !!view && !!document.querySelector('section.view[data-view="' + view + '"]');
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"][data-tab]'));
    var current = null;
    var ink = document.createElement("span");
    ink.className = "tabs-ink";
    ink.setAttribute("aria-hidden", "true");
    root.appendChild(ink);

    function names() { return tabs.map(function (t) { return t.getAttribute("data-tab"); }); }
    function tabEl(name) { for (var i = 0; i < tabs.length; i++) if (tabs[i].getAttribute("data-tab") === name) return tabs[i]; return null; }
    function panelEl(name) { return scope.querySelector('[data-tab-panel="' + name + '"]'); }

    function moveInk() {
      var t = tabEl(current);
      if (!t || !t.offsetWidth) return;
      ink.style.transform = "translateX(" + t.offsetLeft + "px) scaleX(" + t.offsetWidth + ")";
      if (!root.classList.contains("ink-ready")) requestAnimationFrame(function () { root.classList.add("ink-ready"); });
    }
    function reveal(t) {
      var l = t.offsetLeft, r = l + t.offsetWidth;
      if (l < root.scrollLeft + 16) root.scrollLeft = Math.max(0, l - 16);
      else if (r > root.scrollLeft + root.clientWidth - 16) root.scrollLeft = r - root.clientWidth + 16;
    }

    function select(name, o) {
      o = o || {};
      var list = names();
      if (list.indexOf(name) === -1) name = list[0];
      var prev = current;
      current = name;
      tabs.forEach(function (t) {
        var on = t.getAttribute("data-tab") === name;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var p = panelEl(t.getAttribute("data-tab"));
        if (p) p.hidden = !on;
      });
      var t = tabEl(name);
      if (t) {
        if (o.focus) t.focus();
        requestAnimationFrame(function () { moveInk(); reveal(t); });
      }
      if (o.user && routed) replaceHashTab(view, name);
      if (prev !== null && prev !== name && !o.silent && typeof opts.onChange === "function") opts.onChange(name, prev);
      return name;
    }

    tabs.forEach(function (t) {
      var name = t.getAttribute("data-tab");
      if (!t.id) t.id = "tab-" + (view || "g") + "-" + name;
      if (t.tagName === "BUTTON") t.type = "button";
      var p = panelEl(name);
      if (p) {
        if (!p.id) p.id = t.id + "-panel";
        p.setAttribute("role", "tabpanel");
        p.setAttribute("aria-labelledby", t.id);
        if (!p.hasAttribute("tabindex")) p.tabIndex = 0;
        t.setAttribute("aria-controls", p.id);
      }
      t.addEventListener("click", function () { select(name, { user: true }); });
      t.addEventListener("keydown", function (e) {
        var list = names();
        var i = list.indexOf(name);
        var next = null;
        if (e.key === "ArrowRight") next = list[(i + 1) % list.length];
        else if (e.key === "ArrowLeft") next = list[(i - 1 + list.length) % list.length];
        else if (e.key === "Home") next = list[0];
        else if (e.key === "End") next = list[list.length - 1];
        if (next !== null) { e.preventDefault(); select(next, { user: true, focus: true }); }
      });
    });
    window.addEventListener("resize", moveInk);
    if (typeof ResizeObserver === "function") new ResizeObserver(moveInk).observe(root);

    var api = {
      select: function (name, o) { return select(name, o); },
      current: function () { return current; },
      names: names,
      opts: opts,
      root: root
    };
    select(opts.initial || names()[0], { silent: true });
    current = current || null;
    if (routed) tabGroups[view] = api;
    return api;
  }

  function replaceHashTab(view, tab) {
    var h = "#/" + view + "/" + encodeURIComponent(tab);
    if (location.hash !== h) { try { history.replaceState(null, "", h); } catch (e) {} }
  }

  function currentTab(view) { return tabGroups[view] ? tabGroups[view].current() : null; }

  // Handle for console/e2e poking at the shared components (the page script itself is a closure).

  // ---------- tooltips ([data-tip]) ----------
  var tooltipEl = null;
  var tooltipFor = null;
  var tooltipGuards = [];
  function hideTooltip() {
    tooltipFor = null;
    if (tooltipEl) tooltipEl.classList.remove("show");
  }
  function showTooltip(el) {
    var text = el.getAttribute("data-tip");
    if (!text || sheetMq.matches) return;
    for (var i = 0; i < tooltipGuards.length; i++) if (!tooltipGuards[i](el)) return;
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "tooltip";
      tooltipEl.setAttribute("role", "tooltip");
      document.body.appendChild(tooltipEl);
    }
    tooltipFor = el;
    tooltipEl.textContent = text;
    var r = el.getBoundingClientRect();
    var pos = el.getAttribute("data-tip-pos") || "top";
    var tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
    var x, y;
    if (pos === "right") { x = r.right + 10; y = r.top + (r.height - th) / 2; }
    else if (pos === "bottom") { x = r.left + (r.width - tw) / 2; y = r.bottom + 8; }
    else { x = r.left + (r.width - tw) / 2; y = r.top - th - 8; }
    x = Math.max(6, Math.min(x, document.documentElement.clientWidth - tw - 6));
    y = Math.max(6, y);
    tooltipEl.style.transform = "translate(" + Math.round(x) + "px, " + Math.round(y) + "px)";
    tooltipEl.classList.add("show");
  }
  function tipTarget(e) { return e.target && e.target.closest ? e.target.closest("[data-tip]") : null; }
  document.addEventListener("mouseover", function (e) { var t = tipTarget(e); if (t && t !== tooltipFor) showTooltip(t); else if (!t && tooltipFor) hideTooltip(); });
  document.addEventListener("focusin", function (e) { var t = tipTarget(e); if (t && e.target.matches(":focus-visible")) showTooltip(t); else hideTooltip(); });
  document.addEventListener("focusout", hideTooltip);
  document.addEventListener("pointerdown", hideTooltip, true);
  window.addEventListener("scroll", hideTooltip, true);

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
    if (currentView === "sharing" || currentView === "hosts") renderShareList();
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
  if (routeFromHash()) showRoute();
  else showView((prefs.start === "last" ? lastViewSaved : prefs.start) || "overview");
  schedulePoll();

  refreshAll().then(tickViews);
  refreshHubAndRemotes();
})();
`;

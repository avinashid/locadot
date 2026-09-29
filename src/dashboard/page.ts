import { escapeHtml } from "./escape";
import { css } from "./ui/theme";
import { jsPolling, jsPollingLoop, jsPrelude } from "./ui/core";
import { dialogsMarkup, jsDialogs, jsHeader, jsPrefs, jsRouting, shellBottom, shellTop, toastMarkup } from "./ui/shell";
import { allowDialog, hostDialogs, hostsView, jsAddHost, jsHostRows, jsHostsTable, jsProtect, jsShare, jsSharingPage, sharingView } from "./ui/hosts";
import { jsHub, jsReceiver, machinesView, remoteView } from "./ui/remote";
import { jsLogs, jsLogsPage, jsOverview, jsSettings, jsUiPassword, logsView, overviewView, settingsView } from "./ui/system";

// All data on the page is populated client-side via /api/status + /api/hosts
// (and mutated via /api/*) and rendered with DOM APIs (never innerHTML), so
// nothing server-supplied besides the per-response nonce and the auth token
// is interpolated into this markup.

// One script scope, so the order matters: helpers first, the polling loop last.
const clientJs = [
  "\n",
  jsPrelude, jsHeader, jsHub, jsReceiver, jsAddHost, jsHostsTable, jsShare, jsProtect, jsDialogs, jsHostRows,
  jsLogs, jsPolling, jsPrefs, jsRouting, jsOverview, jsSharingPage, jsLogsPage, jsSettings, jsUiPassword, jsPollingLoop,
].join("");

const body = [
  shellTop, overviewView, hostsView, sharingView, remoteView, machinesView, logsView, settingsView, shellBottom,
  allowDialog, dialogsMarkup, hostDialogs, toastMarkup,
].join("");

export function renderPage(nonce: string, token: string, uiAuth = false): string {
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
<meta name="locadot-ui-auth" content="${uiAuth ? "on" : "off"}">
<title>locadot dashboard</title>
<script nonce="${safeNonce}">try { var t = localStorage.getItem("locadot.theme"); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); var s = localStorage.getItem("locadot.sidebar"); if (s === "collapsed" || (s !== "expanded" && window.innerWidth < 1280)) document.documentElement.setAttribute("data-sidebar", "collapsed"); } catch (e) {}</script>
<style nonce="${safeNonce}">${css}</style>
</head>
${body}<script nonce="${safeNonce}">${clientJs}</script>
</body>
</html>
`;
}

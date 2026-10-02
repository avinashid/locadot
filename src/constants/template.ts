import { escapeHtml } from "../dashboard/escape";
import type { SyncReport } from "../proxy/auto-sync";

const page = (title: string, body: string, dashboardUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      background-color: #121212;
      color: #f8d7da;
      font-family: 'Segoe UI', system-ui, sans-serif;
      margin: 0;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 90vh;
    }
    .error-box {
      background-color: #1e1e1e;
      border: 1px solid #d9534f;
      padding: 24px;
      border-radius: 8px;
      max-width: 640px;
      width: 100%;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.7);
      line-height: 1.6;
    }
    .error-box code {
      background: #2e2e2e;
      color: #ffd5d5;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }
    .error-box a { color: #61dafb; text-decoration: none; font-weight: bold; }
    .error-box a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="error-box">
    ${body}
    <br/><br/>
    <a href="${escapeHtml(dashboardUrl)}">📋 Open the locadot dashboard</a> ·
    <a href="https://github.com/avinashid/locadot#readme" target="_blank" rel="noopener noreferrer">📘 Docs</a>
  </div>
</body>
</html>
`;

const syncLine = (r: SyncReport) => {
  if (!r.ok) return `<li>❌ <code>${escapeHtml(r.name)}</code>: couldn't sync, ${escapeHtml(r.error || "unknown error")}</li>`;
  const changes = [...r.added.map((h) => `+${h}`), ...r.removed.map((h) => `−${h}`)];
  return `<li>✅ <code>${escapeHtml(r.name)}</code>: synced${changes.length ? `, ${escapeHtml(changes.join(", "))}` : ", nothing new"}</li>`;
};

/** `sync`: when there are connected machines, what syncing with them just now found, and the "Sync again" link. */
const proxyNotFound = (host: string, dashboardUrl: string, sync?: { reports: SyncReport[]; href: string }) =>
  page(
    "locadot: host not mapped",
    `<strong style="color: #ff6b6b;">Not mapped:</strong>
    no locadot mapping exists for <code>${escapeHtml(host)}</code>.<br/><br/>
    ${
      sync
        ? `Synced with your connected machines, and none of them shares <code>${escapeHtml(host)}</code> with you:
    <ul style="margin: 8px 0 12px; padding-left: 20px;">${sync.reports.map(syncLine).join("")}</ul>
    <a href="${escapeHtml(sync.href)}">🔄 Sync again</a><br/><br/>
    If it should be shared with you, ask whoever shared their locadot to add it to your hosts. Or map it here with<br/>`
        : `Add one with<br/>`
    }
    <code>npx locadot add --host ${escapeHtml(host)} --port PORT</code><br/>
    or<br/>
    <code>npx locadot add --host ${escapeHtml(host)} --target https://example.com</code>`,
    dashboardUrl
  );

const upstreamDown = (host: string, target: string, reason: string, dashboardUrl: string) =>
  page(
    "locadot: upstream unreachable",
    `<strong style="color: #ff6b6b;">Upstream unreachable:</strong>
    <code>${escapeHtml(host)}</code> → <code>${escapeHtml(target)}</code><br/><br/>
    ${escapeHtml(reason)}. Is the app running?`,
    dashboardUrl
  );

/** Receiver side: `<domain>.localhost/_locadot/ports`, the port picker and shared hosts of an admin remote. */
const remoteLocalhost = (opts: {
  domain: string;
  name: string;
  sender: string;
  allowed: boolean;
  hosts: { local: string; url: string }[];
  portUrl: string;
  dashboardUrl: string;
}) =>
  page(
    `locadot: ${opts.sender} localhost`,
    opts.allowed
      ? `<strong style="color: #7ee2a8;">${escapeHtml(opts.sender)}</strong>: localhost<br/><br/>
    Its dashboard is <a href="/">${escapeHtml(opts.domain)}.localhost</a>.<br/>
    Any port on that machine is at <code>${escapeHtml(opts.portUrl.replace("PORT", "<port>"))}</code>.<br/><br/>
    <form id="go" style="display:flex;gap:8px">
      <input id="port" inputmode="numeric" pattern="[0-9]{1,5}" placeholder="3000" required
        style="flex:1;padding:6px 10px;border-radius:4px;border:1px solid #444;background:#2e2e2e;color:#fff" />
      <button style="padding:6px 14px;border-radius:4px;border:0;background:#61dafb;color:#000;font-weight:bold">Open</button>
    </form>
    <script>
      document.getElementById("go").addEventListener("submit", function (e) {
        e.preventDefault();
        var port = document.getElementById("port").value.trim();
        if (/^[0-9]{1,5}$/.test(port)) location.href = ${JSON.stringify(opts.portUrl)}.replace("PORT", port);
      });
    </script>
    ${
      opts.hosts.length
        ? `<br/>Shared hosts:<br/>${opts.hosts.map((h) => `<a href="${escapeHtml(h.url)}">${escapeHtml(h.local)}</a>`).join("<br/>")}`
        : ""
    }`
      : `<strong style="color: #ff6b6b;">Not available:</strong>
    <code>${escapeHtml(opts.domain)}.localhost</code> reaches ${escapeHtml(opts.sender)}'s localhost only while you're an
    admin there and it allows localhost access. Ask its owner, then run <code>locadot remote:sync ${escapeHtml(opts.name)}</code>.`,
    opts.dashboardUrl
  );

export { proxyNotFound, remoteLocalhost, upstreamDown };

import { escapeHtml } from "../dashboard/escape";
import { LOGO_SVG } from "../dashboard/logo";
import { darkVars, lightVars } from "../dashboard/ui/theme";
import type { SyncReport } from "../proxy/auto-sync";

type Tone = "down" | "warn" | "accent";

/** The proxy's own pages (not mapped, upstream unreachable, remote localhost), in the dashboard's look. */
const page = (opts: { title: string; badge: string; tone: Tone; heading: string; body: string; dashboardUrl: string }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark light" />
  <title>${escapeHtml(opts.title)}</title>
  <style>
    :root {${darkVars}
      --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    }
    @media (prefers-color-scheme: light) { :root {${lightVars}} }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; padding: 24px;
      display: flex; align-items: center; justify-content: center;
      background: var(--bg); color: var(--fg);
      font: 14px/1.55 var(--sans); -webkit-font-smoothing: antialiased;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; text-underline-offset: 2px; }
    *:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 6px; }
    .card {
      width: 100%; max-width: 600px; background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px; box-shadow: var(--shadow-md); overflow: hidden;
    }
    .head { display: flex; align-items: center; gap: 10px; padding: 16px 24px; border-bottom: 1px solid var(--border); }
    .logo { width: 24px; height: 24px; flex: none; }
    .logo svg { display: block; width: 100%; height: 100%; }
    .wordmark { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
    .badge {
      margin-left: auto; display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px;
      border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap;
    }
    .badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .tone-down { color: var(--down); background: var(--down-bg); }
    .tone-warn { color: var(--warn); background: var(--warn-bg); }
    .tone-accent { color: var(--accent-strong); background: var(--accent-bg); }
    .body { padding: 24px; }
    h1 { margin: 0 0 6px; font-size: 22px; line-height: 1.25; letter-spacing: -0.015em; }
    p { margin: 0 0 14px; color: var(--fg-2); }
    .muted { color: var(--muted); }
    code { font-family: var(--mono); font-size: 0.92em; background: var(--surface-2); border: 1px solid var(--border); padding: 1px 6px; border-radius: 6px; color: var(--fg); overflow-wrap: anywhere; }
    h2 { margin: 22px 0 8px; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    .cmd {
      display: flex; align-items: center; gap: 8px; margin: 0 0 8px; padding: 8px 8px 8px 12px;
      background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px;
    }
    .cmd code { flex: 1; background: none; border: 0; padding: 0; line-height: 1.6; }
    .cmd code::before { content: "$ "; color: var(--muted-dim); }
    .list { list-style: none; margin: 0 0 12px; padding: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .list li { display: flex; align-items: baseline; gap: 10px; padding: 9px 12px; }
    .list li + li { border-top: 1px solid var(--border); }
    .list .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; align-self: center; }
    .dot.up { background: var(--up); } .dot.down { background: var(--down); }
    .list .name { font-family: var(--mono); font-size: 13px; font-weight: 600; }
    .list .detail { color: var(--muted); font-size: 13px; }
    .route { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 14px; }
    .route .arrow { color: var(--muted); }
    .note { padding: 10px 12px; border-radius: 10px; background: var(--down-bg); color: var(--fg-2); margin: 0 0 14px; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 14px;
      border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--fg);
      font: 600 13px/1 var(--sans); cursor: pointer; white-space: nowrap;
      transition: background 120ms, border-color 120ms;
    }
    .btn:hover { text-decoration: none; background: var(--surface-3); }
    .btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
    .btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
    .btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
    .btn-ghost { background: transparent; border-color: transparent; color: var(--muted); }
    .btn-ghost:hover { background: var(--surface-3); color: var(--fg); }
    .foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 24px; border-top: 1px solid var(--border); background: var(--surface-2); }
    .foot .spacer { flex: 1; }
    form.go { display: flex; gap: 8px; margin: 0 0 8px; }
    .input {
      flex: 1; min-width: 0; height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--border-strong);
      background: var(--bg); color: var(--fg); font: 14px var(--mono);
    }
    .input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
    @media (max-width: 520px) { body { padding: 12px; } .body, .head, .foot { padding-left: 16px; padding-right: 16px; } }
  </style>
</head>
<body>
  <main class="card">
    <div class="head">
      <span class="logo" aria-hidden="true">${LOGO_SVG}</span>
      <span class="wordmark">locadot</span>
      <span class="badge tone-${opts.tone}">${escapeHtml(opts.badge)}</span>
    </div>
    <div class="body">
      <h1>${opts.heading}</h1>
      ${opts.body}
    </div>
    <div class="foot">
      <a class="btn btn-primary" href="${escapeHtml(opts.dashboardUrl)}">Open the dashboard</a>
      <a class="btn" href="https://github.com/avinashid/locadot#readme" target="_blank" rel="noopener noreferrer">Docs</a>
    </div>
  </main>
  <script>
    document.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var text = b.parentNode.querySelector("code").textContent;
        var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
      });
    });
  </script>
</body>
</html>
`;

const cmd = (text: string) =>
  `<div class="cmd"><code>${escapeHtml(text)}</code><button type="button" class="btn btn-sm btn-ghost" data-copy>Copy</button></div>`;

const syncLine = (r: SyncReport) => {
  if (!r.ok)
    return `<li><span class="dot down"></span><span class="name">${escapeHtml(r.name)}</span><span class="detail">couldn't sync: ${escapeHtml(r.error || "unknown error")}</span></li>`;
  const changes = [...r.added.map((h) => `+${h}`), ...r.removed.map((h) => `−${h}`)];
  return `<li><span class="dot up"></span><span class="name">${escapeHtml(r.name)}</span><span class="detail">synced, ${changes.length ? escapeHtml(changes.join(", ")) : "nothing new"}</span></li>`;
};

/** `sync`: when there are connected machines, what syncing with them just now found, and the "Sync again" link. */
const proxyNotFound = (host: string, dashboardUrl: string, sync?: { reports: SyncReport[]; href: string }) =>
  page({
    title: "locadot: host not mapped",
    badge: "Not mapped",
    tone: "down",
    heading: "Not mapped",
    body: `<p>No locadot mapping exists for <code>${escapeHtml(host)}</code>.</p>
      ${
        sync
          ? `<h2>Connected machines</h2>
      <p class="muted">Synced just now; none of them shares <code>${escapeHtml(host)}</code> with you.</p>
      <ul class="list">${sync.reports.map(syncLine).join("")}</ul>
      <p><a class="btn" href="${escapeHtml(sync.href)}">🔄 Sync again</a></p>
      <p class="muted">If it should be shared with you, ask whoever shared their locadot to add it to your hosts. Or map it here:</p>`
          : `<h2>Map it</h2>`
      }
      ${cmd(`npx locadot add --host ${host} --port PORT`)}
      ${cmd(`npx locadot add --host ${host} --target https://example.com`)}`,
    dashboardUrl,
  });

const upstreamDown = (host: string, target: string, reason: string, dashboardUrl: string) =>
  page({
    title: "locadot: upstream unreachable",
    badge: "Upstream unreachable",
    tone: "down",
    heading: "Upstream unreachable",
    body: `<div class="route"><code>${escapeHtml(host)}</code><span class="arrow">→</span><code>${escapeHtml(target)}</code></div>
      <div class="note">${escapeHtml(reason)}</div>
      <p class="muted">Is the app running? Start it, then reload this page.</p>`,
    dashboardUrl,
  });

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
  page({
    title: `locadot: ${opts.sender} localhost`,
    badge: opts.allowed ? "Remote" : "Not available",
    tone: opts.allowed ? "accent" : "warn",
    heading: `${escapeHtml(opts.sender)}: localhost`,
    body: opts.allowed
      ? `<p>Its dashboard is <a href="/">${escapeHtml(opts.domain)}.localhost</a>.
      Any port on that machine is at <code>${escapeHtml(opts.portUrl.replace("PORT", "<port>"))}</code>.</p>
      <h2>Open a port</h2>
      <form id="go" class="go">
        <input id="port" class="input" inputmode="numeric" pattern="[0-9]{1,5}" placeholder="3000" required aria-label="Port" />
        <button class="btn btn-primary">Open</button>
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
          ? `<h2>Shared hosts</h2><ul class="list">${opts.hosts
              .map((h) => `<li><span class="dot up"></span><a class="name" href="${escapeHtml(h.url)}">${escapeHtml(h.local)}</a></li>`)
              .join("")}</ul>`
          : ""
      }`
      : `<p><code>${escapeHtml(opts.domain)}.localhost</code> reaches ${escapeHtml(opts.sender)}'s localhost only while you're an
      admin there and it allows localhost access.</p>
      <p class="muted">Ask its owner, then run:</p>
      ${cmd(`locadot remote:sync ${opts.name}`)}`,
    dashboardUrl: opts.dashboardUrl,
  });

export { proxyNotFound, remoteLocalhost, upstreamDown };

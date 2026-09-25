import { escapeHtml } from "../dashboard/escape";

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

const proxyNotFound = (host: string, dashboardUrl: string) =>
  page(
    "locadot: host not mapped",
    `<strong style="color: #ff6b6b;">Not mapped:</strong>
    no locadot mapping exists for <code>${escapeHtml(host)}</code>.<br/><br/>
    Add one with<br/>
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

export { proxyNotFound, upstreamDown };

const proxyNotFound = (host: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proxy Error</title>
  <style>
    body {
      background-color: #121212;
      color: #f8d7da;
      font-family: 'Segoe UI', sans-serif;
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
      max-width: 600px;
      width: 100%;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.7);
    }

    .error-box code {
      background: #2e2e2e;
      color: #ffd5d5;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    .error-box a {
      color: #61dafb;
      text-decoration: none;
      font-weight: bold;
    }

    .error-box a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="error-box">
    <strong style="color: #ff6b6b;">Connection failed:</strong>
    Proxy does not exist for 
    <code>${host}</code>.<br/><br/>
    Please use 
    <code>npx locadot --host ${host} --port PORT</code><br/><br/>
    <a href="https://github.com/avinashid/locadot#readme" target="_blank">
      📘 View on GitHub
    </a>
  </div>
</body>
</html>
`;

export { proxyNotFound };

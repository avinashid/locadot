#!/usr/bin/env node

import https from "https";
import httpProxy from "http-proxy";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createSSL } from "./certs";
import { proxyNotFound } from "./utils";

export function isValidLocalhostDomain(domain: string): boolean {
  const localhostPattern = /^(?:[a-zA-Z0-9-]+\.)*localhost$/;
  return localhostPattern.test(domain);
}

async function createReverseProxy(targetPort: number, domain: string) {
  const proxy = httpProxy.createProxyServer({});

  const { key, cert } = await createSSL(domain);

  const options = { key, cert };

  const server = https.createServer(options, (req, res) => {
    const host = req.headers.host;
    if (host !== domain && host !== `${domain}:443`) {
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end(proxyNotFound(host!));
      return;
    }

    proxy.web(req, res, { target: `http://localhost:${targetPort}` }, (err) => {
      console.error("Proxy error:", err);
      res.writeHead(502);
      res.end("Connection failed. Host not found.");
    });
  });

  server.listen(443, () => {
    console.log(`✅ HTTPS available at https://${domain}`);
  });
}

export function isDomainRunning(domain: string, port = 443): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: domain,
        port,
        method: "HEAD",
        rejectUnauthorized: false, // ignore self-signed certs
        timeout: 1000,
      },
      (res) => {
        resolve(true);
        res.destroy();
      }
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function run() {
  const argv = await yargs(hideBin(process.argv))
    .option("host", {
      alias: "h",
      describe: "Domain to map (must point to 127.0.0.1 in hosts file)",
      demandOption: true,
      type: "string",
    })
    .option("port", {
      alias: "p",
      describe: "Local port to forward to",
      demandOption: true,
      type: "number",
    })
    .usage("Usage: npx locadot --host local.dev --port 3350")
    .help().argv;

  if (!isValidLocalhostDomain(argv.host)) {
    console.error(
      "❌ Invalid domain. Please use a valid localhost domain like dev.localhost, localhost, test.localhost, etc."
    );
    process.exit(1);
  }

  const isRunning = await isDomainRunning(argv.host);

  if (isRunning) {
    console.error(
      "❌ Domain already in use. Please choose another domain or stop the existing instance."
    );

    process.exit(1);
  }
  const domain = argv.host;
  const port = argv.port;

  createReverseProxy(port, domain);
}

run();

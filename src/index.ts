#!/usr/bin/env node

import https from "https";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { registerDomain, startCentralProxy } from "./server";

export function isValidLocalhostDomain(domain: string): boolean {
  const localhostPattern = /^(?:[a-zA-Z0-9-]+\.)*localhost$/;
  return localhostPattern.test(domain);
}

export function isDomainRunning(domain: string, port = 443): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "localhost", // we're always connecting to localhost
        port,
        method: "HEAD",
        rejectUnauthorized: false, // ignore self-signed certs
        timeout: 1000,
        headers: {
          Host: domain, // 👈 critical: ask the proxy "Do you know this host?"
        },
      },
      (res) => {
        // Only return true if it returns a valid 2xx or 3xx status
        resolve(res.statusCode! >= 200 && res.statusCode! < 400);
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

  await startCentralProxy();
  await registerDomain(domain as string, port as number);
}

run();

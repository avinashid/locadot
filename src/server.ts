import httpProxy from "http-proxy";
import { createSSL } from "./certs";
import https from "https";
import http from "http";
import fs from "fs";
import { proxyNotFound } from "./utils";
import path from "path";
import getAppDataPath from "appdata-path";

const CERT_PATH = getAppDataPath("locadot");

export const LOCK_FILE = path.join(CERT_PATH, ".locadot.lock");

export const REGISTRY_FILE = path.join(CERT_PATH, ".locadot-registry.json");

export interface DomainRegistry {
  [domain: string]: number;
}

export async function startCentralProxy() {
  if (await isProxyAlreadyRunning()) {
    console.log("🔌 Proxy is already running");
    return;
  }

  let domainMap: DomainRegistry = {};

  // Create lock file
  fs.writeFileSync(LOCK_FILE, process.pid.toString());

  if (!fs.existsSync(REGISTRY_FILE)) {
    fs.writeFileSync(REGISTRY_FILE, "{}");
  }

  if (fs.existsSync(REGISTRY_FILE)) {
    domainMap = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
  }
  const proxy = httpProxy.createProxyServer({});

  const defaultCert = await createSSL("localhost");

  const watcher = fs.watch(REGISTRY_FILE, (eventType) => {
    if (eventType === "change") {
      domainMap = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
      console.log("🔄 Updated domain mappings:", domainMap);
    }
  });

  process.on("SIGINT", cleanupFn);
  process.on("SIGTERM", cleanupFn);

  function cleanupFn() {
    watcher.close();
    cleanUp();
    process.exit();
  }

  const requestHandler = (
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) => {
    const host = req.headers.host?.split(":")[0];
    const targetPort = domainMap[host!];

    if (!targetPort) {
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end(proxyNotFound(host!));
      return;
    }

    proxy.web(req, res, { target: `http://localhost:${targetPort}` }, (err) => {
      console.error("Proxy error:", err);
      res.writeHead(502);
      res.end("Connection failed. Host not found.");
    });
  };

  const httpsServer = https.createServer(defaultCert, requestHandler);
  const httpServer = http.createServer(requestHandler);

  httpsServer.listen(443, () => {
    console.log("🌐 HTTPS proxy running on port 443");
  });

  httpServer.listen(80, () => {
    console.log("🌐 HTTP proxy running on port 80");
  });
}

export async function registerDomain(domain: string, port: number) {
  if (!(await isProxyAlreadyRunning())) {
    console.error(
      '❌ Proxy is not running. Start it first with "locadot start"'
    );
    process.exit(1);
  }

  let registry: DomainRegistry = {};

  if (!fs.existsSync(REGISTRY_FILE)) {
    fs.writeFileSync(REGISTRY_FILE, "{}");
  }

  if (fs.existsSync(REGISTRY_FILE)) {
    registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
  }
  if (registry[domain]) {
    console.error(`❌ ${domain} already mapped to port ${registry[domain]}`);
    process.exit(1);
  }

  registry[domain] = port;
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
  console.log(`✅ ${domain} => http://localhost:${port}`);
}

export async function isProxyAlreadyRunning(): Promise<boolean> {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = parseInt(fs.readFileSync(LOCK_FILE, "utf-8"));
      try {
        process.kill(pid, 0); // Check if process exists
        return true;
      } catch {
        // PID doesn't exist, remove stale lock file
        cleanUp();
        return false;
      }
    }
    cleanUp();
    return false;
  } catch (err) {
    cleanUp();

    return false;
  }
}

export const cleanUp = () => {
  try {
    fs.unlinkSync(LOCK_FILE);
    fs.rmSync(REGISTRY_FILE);
  } catch (error) {}
};

import httpProxy from "http-proxy";
import { createSSL } from "./certs";
import https from "https";
import http from "http";
import fs from "fs";
import { proxyNotFound } from "./utils";
import { locadotPath } from "./utils/constants";
import locadotFile, { type DomainRegistry } from "./lib/locadot-file";
import { spawn } from "child_process";
import path from "path";

class ProxyHandler {
  async startCentralProxy() {
    let domainMap = await locadotFile.getRegistry();

    const proxy = httpProxy.createProxyServer({});

    const defaultCert = await createSSL("localhost");

    const watcher = await locadotFile.watchRegistry(async () => {
      locadotFile.updateLogs("🔄 Updated domain mappings.");
      domainMap = await locadotFile.getRegistry();
    });

    process.on("SIGINT", async () => {
      locadotFile.updateLogs(
        "🛑 Proxy stopped.",
        "error",
        "Proxy soft destroyed as process SIGINT"
      );
      await locadotFile.softDestroy(watcher);
    });
    process.on("SIGTERM", async () => {
      locadotFile.updateLogs(
        "🛑 Proxy stopped.",
        "error",
        "Proxy soft destroyed as process SIGTERM"
      );

      await locadotFile.softDestroy(watcher);
    });

    const requestHandler = (
      req: http.IncomingMessage,
      res: http.ServerResponse
    ) => {
      const host = req.headers.host?.split(":")[0];
      const targetPort = domainMap[host!];

      if (!targetPort) {
        res.writeHead(502, { "Content-Type": "text/html" });
        res.end(proxyNotFound(host!));
      }

      proxy.web(
        req,
        res,
        { target: `http://localhost:${targetPort}` },
        (err) => {
          locadotFile.updateLogs(
            host || "",
            "warn",
            `${err.name}=> ${err.message}`
          );
          res.writeHead(502);
          res.end("Connection failed. Host not found.");
        }
      );
    };

    const httpsServer = https.createServer(defaultCert, requestHandler);
    const httpServer = http.createServer(requestHandler);

    httpsServer.listen(443, () => {
      locadotFile.updateLogs("🛜 HTTPS proxy running on port 443");
    });

    httpServer.listen(80, () => {
      locadotFile.updateLogs("🛜 HTTP proxy running on port 80");
    });
  }

  async startProxy() {
    if (await locadotFile.getProcessId()) {
      console.error("Proxy is already running");
      return;
    }
    const proxyProcess = spawn(
      "node",
      [
        path.join(
          __dirname,
          process.env.NODE_ENV === "production" ? "core.js" : "../dist/core.js"
        ),
      ],
      {
        detached: true,
        stdio: "ignore",
      }
    );

    proxyProcess.on("error", (err) => {
      console.error("Failed to start child process:", err);
    });

    if (!proxyProcess.pid) {
      console.error("❌ Central proxy failed to start");
      process.exit(1);
    } else {
      locadotFile.createLockFile(proxyProcess.pid?.toString());
    }

    proxyProcess.unref();
    console.log("🚀 Central proxy started in background.");
  }

  async registerDomain(domain: string, port: number) {
    if (!(await locadotFile.getProcessId())) {
      await this.startProxy();
    }

    let registry = await locadotFile.getRegistry();

    if (!fs.existsSync(locadotPath.REGISTRY_FILE)) {
      fs.writeFileSync(locadotPath.REGISTRY_FILE, "{}");
    }

    if (fs.existsSync(locadotPath.REGISTRY_FILE)) {
      registry = JSON.parse(
        fs.readFileSync(locadotPath.REGISTRY_FILE, "utf-8")
      );
    }
    if (registry[domain]) {
      console.error(`❌ ${domain} already mapped to port ${registry[domain]}`);
      process.exit(1);
    }

    registry[domain] = port;
    fs.writeFileSync(
      locadotPath.REGISTRY_FILE,
      JSON.stringify(registry, null, 2)
    );
    console.log(`✅ ${domain} => http://localhost:${port}`);
  }

  async stopProxy() {
    await locadotFile.softDestroy();
  }
  async killProxy() {
    await locadotFile.destroy();
  }
  async restartProxy() {
    await locadotFile.softDestroy();
    await this.startProxy();
  }
}

const locadotProxy = new ProxyHandler();

export default locadotProxy;

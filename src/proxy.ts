import httpProxy from "http-proxy";
import { createSSL } from "./utils/certs";
import https from "https";
import http from "http";
import locadotFile from "./lib/locadot-file";
import { spawn } from "child_process";
import FileModule from "./utils/file";
import logger from "./utils/logger";
import HttpModule from "./lib/http";

class ProxyHandler {
  async startCentralProxy() {
    try {
      let domainMap = await locadotFile.getRegistry();

      const proxy = httpProxy.createProxyServer({});

      const defaultCert = await createSSL("localhost");

      const watcher = await locadotFile.watchRegistry(async () => {
        logger.info("🔄 Updated domain mapping");
        domainMap = await locadotFile.getRegistry();
      });

      process.on("SIGINT", async (err) => {
        logger.error(
          "🛑 Proxy stopped. Proxy soft destroyed as process SIGINT",
          err
        );
        await locadotFile.softDestroy(watcher);
      });
      process.on("SIGTERM", async (err) => {
        logger.error(
          "🛑 Proxy stopped. Proxy soft destroyed as process SIGTERM",
          err
        );
        await locadotFile.softDestroy(watcher);
      });

      // process.on("exit", (code: string, signal: string) => {
      //   logger.error(`Process exited with error ${code} and signal ${signal}`);
      //   locadotFile.softDestroy(watcher);
      // });

      const httpsServer = https.createServer(defaultCert, (req, res) => {
        HttpModule.requestHandler(req, res, proxy, domainMap);
      });
      const httpServer = http.createServer((req, res) => {
        HttpModule.requestHandler(req, res, proxy, domainMap);
      });

      httpsServer.listen(443, () => {
        logger.info("🛜 HTTPS proxy running on port 443");
      });
      httpsServer.on("upgrade", (req, res, head) => {
        HttpModule.requestUpgrade(req, res, head, proxy, domainMap);
      });

      httpServer.listen(80, () => {
        logger.info("🛜 HTTP proxy running on port 80");
      });
      httpServer.on("upgrade", (req, socket, head) => {
        HttpModule.requestUpgrade(req, socket, head, proxy, domainMap);
      });
    } catch (error) {
      logger.error("Failed to start central proxy", error);
    }
  }

  static async isProxyRunning() {
    try {
      const pid = Number(await locadotFile.getProcessId());
      if (!pid || isNaN(pid)) {
        return false;
      }
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }
  async startProxy() {
    try {
      if (await ProxyHandler.isProxyRunning()) {
        logger.error("Proxy is already running");
        return;
      }
      const command = locadotFile.getStartProxyFile();
      const proxyProcess = spawn(command.command, command.path, {
        detached: true,
        stdio: ["ignore", "ignore", "pipe"],
      });
      const logStream = FileModule.writeFileStream("LOGS", true);
      proxyProcess.stderr.pipe(logStream);
      proxyProcess.on("error", (err) => {
        console.error("Failed to start child process:", err);
      });

      if (!proxyProcess.pid) {
        logger.error("❌ Central proxy failed to start");
        process.exit(1);
      } else {
        locadotFile.createLockFile(proxyProcess.pid?.toString());
      }

      proxyProcess.unref();
      logger.info("🚀 Central proxy started in background.");
    } catch (error) {
      logger.error("Failed to start central proxy", error);
    }
  }

  async addProxy(domain: string, port: number) {
    if (!(await ProxyHandler.isProxyRunning())) {
      await this.startProxy();
    }

    let registry = await locadotFile.getRegistry();

    if (registry[domain]) {
      console.error(
        `❌ ${domain} already mapped to port ${registry[domain]} use update instead.`
      );
      process.exit(1);
    }

    await locadotFile.addRegistry(domain, port);

    logger.info(`✅ ${domain} => http://localhost:${port}`);
  }

  async removeProxy(domain: string) {
    if (!(await ProxyHandler.isProxyRunning())) {
      await this.startProxy();
    }
    await locadotFile.deleteRegistry(domain);
  }

  async updateProxy(domain: string, port: number) {
    if (!(await ProxyHandler.isProxyRunning())) {
      await this.startProxy();
    }
    await locadotFile.updateRegistry(domain, port);
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

import Localhost from "./localhost";
import locadotProxy from "../proxy";
import locadotFile from "./locadot-file";
import logger from "../utils/logger";
import Constants from "../constants";
import Startup from "../utils/startup";

export type startCommand = {
  host: string;
} & {
  port: number;
};

export default class Commands {
  static async add(argv: startCommand) {
    if (!Localhost.isValidLocalhostDomain(argv.host)) {
      console.error(Constants.proxyInfo.invalidHost);
      process.exit(1);
    }

    if (await Localhost.isLocalhostOpen(argv.host, argv.port)) {
      console.error(Constants.proxyInfo.hostExist);
      process.exit(1);
    }

    try {
      await locadotProxy.addProxy(argv.host, argv.port);
    } catch (error) {
      console.error(error);
    }
  }

  static async remove(argv: { host: string }) {
    if (!Localhost.isValidLocalhostDomain(argv.host)) {
      console.error(Constants.proxyInfo.invalidHost);
      process.exit(1);
    }
    try {
      await locadotProxy.removeProxy(argv.host);
    } catch (error) {
      console.error(error);
    }
  }
  static async update(argv: startCommand) {
    if (!Localhost.isValidLocalhostDomain(argv.host)) {
      console.error(Constants.proxyInfo.invalidHost);
      process.exit(1);
    }

    if (!(await Localhost.isLocalhostOpen(argv.host, argv.port))) {
      console.error(Constants.proxyInfo.hostNotFound);
      process.exit(1);
    }
    try {
      await locadotProxy.updateProxy(argv.host, argv.port);
    } catch (error) {
      console.error(error);
    }
  }

  static async stop() {
    try {
      await locadotProxy.stopProxy();
    } catch (error) {}
  }
  static async clearHosts() {
    try {
      await locadotFile.removeAllRegistry();
    } catch (error) {}
  }
  static async kill() {
    try {
      await locadotProxy.killProxy();
    } catch (error) {}
  }

  static async restart() {
    await locadotProxy.restartProxy();
    console.log("☑️ Proxy successfully restarted.");
  }

  static async getRegistry() {
    try {
      const registry = await locadotFile.getRegistry();
      Object.entries(registry).forEach(([value, key]) =>
        console.log(`Port: ${key} => ${value} \n`)
      );
      console.log(`☑️ Total: ${Object.keys(registry).length}.`);
    } catch (error) {}
  }

  static watchLogs() {
    try {
      locadotFile.watchLogs();
    } catch (error) {}
  }
  static async clearLogs() {
    try {
      await locadotFile.clearLogs();
      console.log("☑️ Logs successfully cleared.");
    } catch (error) {}
  }

  static async logPath() {
    console.log(Constants.paths.LOGS);
  }
  static async hostPath() {
    console.log(Constants.paths.REGISTRY_FILE);
  }
  static async configPath() {
    console.log(Constants.paths.REGISTRY_FILE);
    console.log(Constants.paths.LOGS);
  }

  static async enableStartup() {
    try {
      await Startup.enable();
    } catch (error) {}
  }
  static async disableStartup() {
    try {
      await Startup.disable();
    } catch (error) {}
  }
  static async statusStartup() {
    try {
      await Startup.status();
    } catch (error) {}
  }
}

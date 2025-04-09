import type yargs from "yargs";
import Localhost from "./localhost";
import { errorConstants, locadotPath } from "../utils/constants";
import locadotProxy from "../server";
import locadotFile from "./locadot-file";

export type startCommand = {
  host: string;
} & {
  port: number;
};

export default class Commands {
  static async start(argv: yargs.ArgumentsCamelCase<startCommand>) {
    if (!Localhost.isValidLocalhostDomain(argv.host)) {
      console.error(errorConstants.invalidHost);
      process.exit(1);
    }

    if (await Localhost.isLocalhostOpen(argv.host, argv.port)) {
      console.error(errorConstants.hostExist);
    }

    try {
      await locadotProxy.registerDomain(argv.host, argv.port);
    } catch (error) {}
  }

  static async stop() {
    try {
      await locadotProxy.stopProxy();
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
      console.log("☑️ Watching logs files.");
      locadotFile.watchLogs();
    } catch (error) {}
  }
  static clearLogs() {
    try {
      locadotFile.clearLogs();
      console.log("☑️ Logs successfully cleared.");
    } catch (error) {}
  }

  static async logPath() {
    console.log(locadotPath.LOGS);
  }
}

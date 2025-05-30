#!/usr/bin/env node
import { Command } from "commander";
import Commands from "./lib/commands";
import logger from "./utils/logger";
import { version } from "../package.json";
import Constants from "./constants";

const program = new Command();

program
  .name("locadot")
  .description("Locadot CLI - Local domain proxy manager")
  .version(version);

program
  .command("add")
  .description("Add a new localhost domain and port")
  .requiredOption(
    "-h, --host <host>",
    "Domain to map must be ends with localhost. Example: dev.localhost, localhost, test.localhost, etc."
  )
  .requiredOption("-p, --port <port>", "Local port to forward to")
  .action(async (options) => {
    await Commands.add(options);
    process.exit(0);
  });

program
  .command("update")
  .requiredOption(
    "-h, --host <host>",
    "Domain to map must be ends with localhost. Example: dev.localhost, localhost, test.localhost, etc."
  )
  .requiredOption("-p, --port <port>", "Local port to forward to")
  .description("Update a domain")
  .action(async (options) => {
    await Commands.update(options);
    process.exit(0);
  });

program
  .command("remove")
  .requiredOption(
    "-h, --host <host>",
    "Host must ends with localhost. Example: dev.localhost, localhost, test.localhost, etc."
  )
  .description("Remove a domain")
  .action(async (options) => {
    await Commands.remove(options);
    process.exit(0);
  });

program
  .command("host")
  .description("Show all hosts")
  .action(async () => {
    await Commands.getRegistry();
    process.exit(0);
  });

program
  .command("watch:logs")
  .description("Watch log files")
  .action(() => {
    Commands.watchLogs();
  });

program
  .command("clear:logs")
  .description("Clear logs")
  .action(async () => {
    await Commands.clearLogs();
    process.exit(0);
  });

program
  .command("clear:hosts")
  .description("Clear all host file.")
  .action(async () => {
    await Commands.clearHosts();
    process.exit(0);
  });

program
  .command("path")
  .description("Show configuration paths.")
  .action(() => {
    Commands.configPath();
    process.exit(0);
  });

program
  .command("path:logs")
  .description("Show logs path file.")
  .action(() => {
    Commands.logPath();
    process.exit(0);
  });

program
  .command("path:hosts")
  .description("Show hosts path file.")
  .action(async () => {
    await Commands.hostPath();
    process.exit(0);
  });

program
  .command("startup:enable")
  .description("Enable locadot on reboot.")
  .action(async () => {
    await Commands.enableStartup();
    process.exit(0);
  });

program
  .command("startup:disable")
  .description("Disable locadot on reboot.")
  .action(async () => {
    await Commands.disableStartup();
    process.exit(0);
  });

program
  .command("startup:status")
  .description("Check locadot status on reboot.")
  .action(async () => {
    await Commands.statusStartup();
    process.exit(0);
  });

program
  .command("restart")
  .description("Restart locadot")
  .action(async () => {
    await Commands.restart();
    process.exit(0);
  });

program
  .command("stop")
  .description("Stop central proxy and logs")
  .action(async () => {
    await Commands.stop();
    logger.info(Constants.proxyInfo.softClose);
    process.exit(0);
  });

program
  .command("kill")
  .description("Stop proxy, clear logs, and hosts file.")
  .action(async () => {
    await Commands.kill();
    logger.info(Constants.proxyInfo.softClose);
    process.exit(0);
  });

program.parse(process.argv);

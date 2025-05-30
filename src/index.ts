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
  });

program
  .command("update")
  .requiredOption(
    "-h, --host <host>",
    "Domain to map must be ends with localhost. Example: dev.localhost, localhost, test.localhost, etc."
  )
  .requiredOption("-p, --port <port>", "Local port to forward to")
  .description("Update a domain")
  .action(async (options) => await Commands.update(options));

program
  .command("remove")
  .requiredOption(
    "-h, --host <host>",
    "Host must ends with localhost. Example: dev.localhost, localhost, test.localhost, etc."
  )
  .description("Remove a domain")
  .action(async (options) => await Commands.remove(options));

program
  .command("host")
  .description("Show all hosts")
  .action(() => {
    Commands.getRegistry();
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
  .action(() => {
    Commands.clearLogs();
  });

program
  .command("clear:hosts")
  .description("Clear all host file.")
  .action(() => {
    Commands.clearHosts();
  });

program
  .command("path")
  .description("Show configuration paths.")
  .action(() => {
    Commands.configPath();
  });

program
  .command("path:logs")
  .description("Show logs path file.")
  .action(() => {
    Commands.logPath();
  });

program
  .command("path:hosts")
  .description("Show hosts path file.")
  .action(() => {
    Commands.hostPath();
  });

program
  .command("restart")
  .description("Restart locadot")
  .action(() => {
    Commands.restart();
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

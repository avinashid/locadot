#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import Commands from "./lib/commands";
import { errorConstants } from "./utils/constants";

async function run() {
  await yargs(hideBin(process.argv))
    .usage("Usage: npx locadot --host local.dev --port 3350")
    .command(
      "stop",
      "Stop all kill all locadot hosts",
      () => {},
      async (argv) => {
        await Commands.stop();
        console.log(errorConstants.proxyClose);
        process.exit(0);
      }
    )
    .command(
      "logs",
      "Watch logs",
      () => {},
      async (argv) => {
        Commands.watchLogs();
      }
    )
    .command(
      "clear logs",
      "Clear logs",
      () => {},
      async (argv) => {
        Commands.clearLogs();
      }
    )
    .command(
      "restart",
      "Restart locadot",
      () => {},
      async (argv) => {
        Commands.restart();
      }
    )
    .command("hosts", "Show all hosts.", () => {
      Commands.getRegistry();
    })
    .command(
      "$0",
      "Run the proxy with a domain and port",
      (yargs) => {
        return yargs
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
          .usage("Usage: npx locadot --host local.dev --port 3350");
      },
      async (argv) => {
        await Commands.start(argv);
      }
    )
    .help().argv;
}

run();

#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import Commands from "./lib/commands";
import { errorConstants } from "./utils/constants";

async function run() {
  await yargs(hideBin(process.argv))
    .scriptName("locadot")
    .usage("Usage: npx locadot --host local.dev --port 3350")
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
          });
      },
      async (argv) => {
        await Commands.start(argv);
      }
    )
    .command("host", "Show all hosts.", () => {
      Commands.getRegistry();
    })
    .command(
      "watch logs",
      "Watch log files",
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
      "path logs",
      "Show log path",
      () => {},
      async (argv) => {
        Commands.logPath();
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
    .command(
      "stop",
      "Stop central proxy and logs.",
      () => {},
      async (argv) => {
        await Commands.stop();
        console.log(errorConstants.proxyClose);
        process.exit(0);
      }
    )
    .command(
      "kill",
      "Stop central proxy and clear all logs and also port mapping.",
      () => {},
      async (argv) => {
        await Commands.kill();
        console.log(errorConstants.proxyClose);
        process.exit(0);
      }
    )

    .help().argv;
}

run();

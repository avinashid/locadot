#!/usr/bin/env node
import { Command, Option } from "commander";
import Commands from "./lib/commands";
import { InputError } from "./lib/localhost";
import { RegistryError } from "./lib/registry";
import { ProxyError } from "./proxy";
import logger from "./utils/logger";
import { version } from "../package.json";

const program = new Command();

/** One place that turns failures into a message and a non-zero exit code. */
const run =
  <A extends unknown[]>(fn: (...args: A) => unknown, { exit = true } = {}) =>
  async (...args: A) => {
    try {
      await fn(...args);
      if (exit) process.exit(process.exitCode ?? 0);
    } catch (error: any) {
      const known = error instanceof InputError || error instanceof ProxyError || error instanceof RegistryError;
      logger.error(known ? error.message : `❌ ${error?.stack || error}`);
      process.exit(1);
    }
  };

const hostOption = () =>
  new Option("-h, --host <host>", "Domain ending in .localhost, e.g. dev.localhost or google.localhost").makeOptionMandatory();

const destinationOptions = (command: Command) =>
  command
    .option("-p, --port <port>", "Local port to forward to (shorthand for --target http://localhost:<port>)")
    .option("-t, --target <url>", "Any upstream: 3000, 127.0.0.1:8080, http://192.168.1.5:8080, https://google.com")
    .option("-k, --insecure", "Don't verify the TLS certificate of an https target")
    .option("--no-start", "Only save the mapping; don't start the proxy");

program
  .name("locadot")
  .description("HTTPS custom *.localhost domains for any local or remote upstream")
  .version(version)
  .helpOption("--help", "Display help for command");

destinationOptions(program.command("add").description("Map a new domain to a port or URL").addOption(hostOption())).action(
  run((options) => Commands.add(options))
);

destinationOptions(
  program.command("update").description("Change the destination of a mapped domain").addOption(hostOption())
).action(run((options) => Commands.update(options)));

program
  .command("remove")
  .alias("rm")
  .description("Remove a domain")
  .addOption(hostOption())
  .action(run((options) => Commands.remove(options)));

program
  .command("list")
  .aliases(["host", "ls"])
  .description("Show all mapped domains")
  .option("--json", "Machine-readable output")
  .action(run((options) => Commands.list(options)));

program
  .command("status")
  .description("Show proxy state, ports, CA trust and startup")
  .option("--json", "Machine-readable output")
  .action(run((options) => Commands.status(options)));

program
  .command("doctor")
  .description("Diagnose why a domain isn't working")
  .option("-h, --host <host>", "Only check this domain")
  .action(run((options) => Commands.doctor(options)));

program
  .command("open [host]")
  .description("Open a domain, or the dashboard when no host is given, in the browser")
  .action(run((host?: string) => Commands.open(host)));

program.command("start").description("Start the central proxy").action(run(() => Commands.start()));
program.command("stop").description("Stop the central proxy (keeps hosts and logs)").action(run(() => Commands.stop()));
program.command("restart").description("Restart the central proxy").action(run(() => Commands.restart()));
program.command("kill").description("Stop the proxy, remove all hosts and clear logs").action(run(() => Commands.kill()));

program.command("trust").description("Install the locadot CA in the system trust store (sudo)").action(run(() => Commands.trust()));
program.command("untrust").description("Remove the locadot CA from the system trust store (sudo)").action(run(() => Commands.untrust()));

program
  .command("logs")
  .description("Print recent logs and follow new ones")
  .option("-n, --lines <n>", "Number of lines to show", "50")
  .option("--no-follow", "Print and exit")
  .action(run((options) => Commands.logs(options), { exit: false }));
program
  .command("watch:logs")
  .description("Alias of `logs`")
  .action(run(() => Commands.logs({}), { exit: false }));
program.command("clear:logs").description("Clear logs").action(run(() => Commands.clearLogs()));
program.command("clear:hosts").description("Remove all hosts").action(run(() => Commands.clearHosts()));

program.command("path").description("Show every file locadot uses").action(run(() => Commands.configPath()));
program.command("path:logs").description("Show the log file path").action(run(() => Commands.logPath()));
program
  .command("token")
  .description("Print the dashboard API token (X-Locadot-Token) for scripts and AI agents")
  .action(run(() => Commands.token()));
program.command("path:hosts").description("Show the registry file path").action(run(() => Commands.hostPath()));

program.command("startup:enable").description("Start locadot on boot/logon").action(run(() => Commands.enableStartup()));
program.command("startup:disable").description("Don't start locadot on boot/logon").action(run(() => Commands.disableStartup()));
program.command("startup:status").description("Is start on boot enabled?").action(run(() => Commands.statusStartup()));

program.parseAsync(process.argv);

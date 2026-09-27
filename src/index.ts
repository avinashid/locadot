#!/usr/bin/env node
import { Command, Option } from "commander";
import Commands from "./cli/commands";
import { InputError } from "./lib/localhost";
import { RegistryError } from "./lib/registry";
import { ProxyError } from "./lib/proxy-control";
import { LinkError } from "./lib/links";
import { RemoteError } from "./lib/remotes";
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
      const known =
        error instanceof InputError ||
        error instanceof ProxyError ||
        error instanceof RegistryError ||
        error instanceof LinkError ||
        error instanceof RemoteError;
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
    .option("--cors", "Send Origin/Referer as the target's own and let any origin call this domain")
    .option("--no-cors", "Turn --cors off again (update)")
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

program
  .command("tunnel")
  .description("Share a domain on a public https://*.trycloudflare.com URL (Cloudflare quick tunnel, no account); lists shared domains without --host")
  .option("-h, --host <host>", "Domain to share, e.g. app.localhost")
  .option("--off", "Stop sharing it")
  .action(run((options) => Commands.tunnel(options)));
program.command("tunnel:install").description("Download cloudflared into the locadot state dir").action(run(() => Commands.installTunnel()));

const portOptions = (command: Command) =>
  command
    .option("-p, --port <port>", "HTTP port (default 80, or the last one you chose)")
    .option("--https-port <port>", "HTTPS port (default 443, or the last one you chose)");

portOptions(program.command("start").description("Start the central proxy")).action(run((options) => Commands.start(options)));
program.command("stop").description("Stop the central proxy (keeps hosts and logs)").action(run(() => Commands.stop()));
portOptions(program.command("restart").description("Restart the central proxy")).action(run((options) => Commands.restart(options)));
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

const roleOption = () => new Option("-r, --role <role>", "viewer, editor or admin").choices(["viewer", "editor", "admin"]).makeOptionMandatory();

program
  .command("hub")
  .description("Show remote access status")
  .option("--json", "Machine-readable output")
  .action(run((options) => Commands.hub(options)));
program
  .command("hub:setup")
  .description("Share this locadot on your own domain via a named Cloudflare tunnel")
  .requiredOption("-d, --domain <domain>", "Public domain, e.g. hub.example.com")
  .option("-t, --tunnel <name>", "Cloudflare tunnel name", "locadot")
  .action(run((options) => Commands.hubSetup(options)));
program
  .command("hub:quick")
  .description("Share this locadot on a random trycloudflare.com URL (no account, URL changes on restart)")
  .action(run(() => Commands.hubQuick()));
program
  .command("hub:manual")
  .description("Share this locadot behind a URL something else already forwards (ngrok, a reverse proxy, tests)")
  .requiredOption("-u, --url <url>", "Public base URL that forwards to this proxy's HTTP port")
  .action(run((options) => Commands.hubManual(options)));
program.command("hub:off").description("Turn off remote access").action(run(() => Commands.hubOff()));
program
  .command("hub:localhost <onOrOff>")
  .description("Sender: let admin peers reach any port on this machine's localhost (on/off)")
  .action(run((value) => Commands.hubLocalhost(value)));

program
  .command("share")
  .description("Create a one-time pairing code for someone to connect to this locadot")
  .addOption(roleOption())
  .option("--hosts <hosts>", "Comma separated hosts the viewer may see (viewer role only)")
  .action(run((options) => Commands.share(options)));

program
  .command("peers")
  .description("List everyone paired with this locadot")
  .option("--json", "Machine-readable output")
  .action(run((options) => Commands.peers(options)));
program
  .command("peers:role <id> <role>")
  .description("Change a peer's role")
  .option("--hosts <hosts>", "Comma separated hosts (viewer role only)")
  .action(run((id, role, options) => Commands.peersRole(id, role, options)));
program.command("peers:revoke <id>").description("Revoke a peer").action(run((id) => Commands.peersRevoke(id)));

program
  .command("connect <string>")
  .description("Connect to a remote locadot using its pairing string")
  .option("--name <name>", "Local name for this remote (defaults to the sender's hostname)")
  .option("--domain <domain>", "Local domain for the sender's localhost, e.g. dev (admin only; random if omitted)")
  .action(run((value, options) => Commands.connect(value, options)));
program
  .command("remotes")
  .description("List remotes this locadot is connected to")
  .option("--json", "Machine-readable output")
  .action(run((options) => Commands.remotes(options)));
program.command("remote:sync <name>").description("Refresh role and available hosts for a remote").action(run((name) => Commands.remoteSync(name)));
program
  .command("remote:domain <name> [domain]")
  .description("Set the local domain for a remote's localhost (admin only); no domain picks a random one")
  .option("--off", "Remove the domain")
  .action(run((name, domain, options) => Commands.remoteDomain(name, domain, options)));
program
  .command("remote:alias <name> <remoteHost> <localHost>")
  .description("Map a local .localhost name to a host on a remote")
  .action(run((name, remoteHost, localHost) => Commands.remoteAlias(name, remoteHost, localHost)));
program
  .command("remote:url <name> <url>")
  .description("Update a remote's URL (e.g. after its quick tunnel changed)")
  .action(run((name, url) => Commands.remoteUrl(name, url)));
program
  .command("remote:add <name>")
  .description("Add a mapping on a remote")
  .addOption(hostOption())
  .requiredOption("-t, --target <url>", "Any upstream: 3000, 127.0.0.1:8080, http://192.168.1.5:8080, https://google.com")
  .option("-k, --insecure", "Don't verify the TLS certificate of an https target")
  .option("--cors", "Send Origin/Referer as the target's own and let any origin call this domain")
  .action(run((name, options) => Commands.remoteAdd(name, options)));
program
  .command("remote:update <name>")
  .description("Update a mapping on a remote")
  .addOption(hostOption())
  .option("-t, --target <url>", "New upstream")
  .option("--cors", "Send Origin/Referer as the target's own and let any origin call this domain")
  .option("--no-cors", "Turn --cors off again")
  .action(run((name, options) => Commands.remoteUpdate(name, options)));
program
  .command("remote:rm <name> <host>")
  .description("Remove a mapping on a remote")
  .action(run((name, host) => Commands.remoteRm(name, host)));
program.command("disconnect <name>").description("Disconnect from a remote").action(run((name) => Commands.disconnect(name)));

program.parseAsync(process.argv);

import Localhost, { InputError } from "../../lib/localhost";
import locadotFile from "../../lib/locadot-file";
import locadotProxy from "../../lib/proxy-control";
import Constants from "../../constants";
import FileModule from "../../utils/file";
import { caCertPath } from "../../utils/certs";
import { print } from "../shared";

export function logs(options: { lines?: string; follow?: boolean }) {
  const lines = options.lines ? Localhost.parsePort(options.lines) : 50;
  if (options.follow === false) {
    console.log(FileModule.lastLines("LOGS", lines).join("\n") || "(log is empty)");
    return;
  }
  locadotFile.watchLogs(lines);
}

export function clearLogs() {
  locadotFile.clearLogs();
  print("☑️ Logs successfully cleared.");
}

export function logPath() {
  console.log(Constants.paths.LOGS);
}

export function hostPath() {
  console.log(Constants.paths.REGISTRY_FILE);
}

export function configPath() {
  const rows: [string, string][] = [
    ["State dir", Constants.paths.HOME],
    ["Registry", Constants.paths.REGISTRY_FILE],
    ["Lock file", Constants.paths.LOCK_FILE],
    ["Logs", Constants.paths.LOGS],
    ["Certs", Constants.paths.CERT_DIR],
    ["CA cert", caCertPath()],
    ["API token", Constants.paths.API_TOKEN],
    ["Config", Constants.paths.CONFIG_FILE],
  ];
  rows.forEach(([label, value]) => console.log(`${label.padEnd(10)} ${value}`));
}

/** For scripts and AI agents driving the dashboard API. */
export function token() {
  const token = locadotProxy.running() ? FileModule.read("API_TOKEN")?.trim() : undefined;
  if (!token) throw new InputError("❌ The proxy isn't running, so there's no API token. Run `locadot start`.");
  console.log(token);
}

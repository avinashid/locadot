import os from "os";
import { spawn } from "child_process";
import Localhost from "../../lib/localhost";
import { urlFor } from "../../lib/urls";
import Startup from "../../utils/startup";
import { caCertPath } from "../../utils/certs";
import { trustCA, untrustCA } from "../../utils/trust";
import { print } from "../shared";

export async function open(host?: string) {
  const url = urlFor(host ? Localhost.requireHost(host) : "localhost");
  const [command, args] =
    os.platform() === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : os.platform() === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];
  try {
    // windows-hide-exempt: run from the user's terminal (no popup), and hiding `cmd /c start` can hide the browser too.
    spawn(command, args as string[], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
  } catch {}
  print(url);
}

export async function trust() {
  await trustCA();
  print(`✅ Locadot CA trusted (${caCertPath()}). Restart your browser if it was open.`);
}

export async function untrust() {
  await untrustCA();
  print("✅ Locadot CA removed from the trust store.");
}

export async function enableStartup() {
  await Startup.enable();
}

export async function disableStartup() {
  await Startup.disable();
}

export async function statusStartup() {
  print((await Startup.isEnabled()) ? "enabled" : "disabled");
}

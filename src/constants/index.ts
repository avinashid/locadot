import getAppDataPath from "appdata-path";
import path from "path";
import os from "os";

// LOCADOT_HOME / LOCADOT_*_PORT let tests and hosts where 80/443 are taken run an isolated instance.
const PACKAGE_PATH = process.env.LOCADOT_HOME
  ? path.resolve(process.env.LOCADOT_HOME)
  : getAppDataPath("locadot");

const envPort = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : fallback;
};

export default class Constants {
  static paths = {
    HOME: PACKAGE_PATH,
    LOCK_FILE: path.join(PACKAGE_PATH, ".locadot.lock"),
    REGISTRY_FILE: path.join(PACKAGE_PATH, ".locadot-registry.json"),
    REGISTRY_LOCK: path.join(PACKAGE_PATH, ".locadot-registry.lock"),
    LOGS: path.join(PACKAGE_PATH, ".locadot.log"),
    CERT_DIR: path.join(PACKAGE_PATH, "certs"),
    // Secret for the dashboard's mutating API; rotated on every proxy start.
    API_TOKEN: path.join(PACKAGE_PATH, ".locadot-token"),
  } as const;

  static server = {
    httpPort: envPort("LOCADOT_HTTP_PORT", 80),
    httpsPort: envPort("LOCADOT_HTTPS_PORT", 443),
    // Loopback only unless the user opts in; see tasks/enhancements ENH-06.
    bind: (process.env.LOCADOT_BIND || "127.0.0.1,::1")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };

  // Hosts that serve the dashboard instead of being proxied.
  static dashboardHosts = ["localhost", "127.0.0.1", "::1"];

  static platform = () => {
    const currentPlatform = os.platform();
    if (currentPlatform === "win32") {
      return "windows";
    } else if (currentPlatform === "darwin") {
      return "mac";
    } else if (currentPlatform === "linux") {
      return "linux";
    } else {
      return "unknown";
    }
  };

  static readonly proxyInfo = {
    invalidHost:
      "❌ Invalid domain. Use a subdomain of localhost like dev.localhost or google.localhost (bare `localhost` is reserved for the dashboard).",
    hostExist:
      "❌ Domain already mapped. Use `locadot update` to change its target.",
    hostNotFound: "❌ Domain not found. Run `locadot list` to see mapped domains.",

    proxyClose: "☑️ Successfully stopped all locadot instances.",
    softClose: "☑️ Successfully stopped central proxy.",
  };
}

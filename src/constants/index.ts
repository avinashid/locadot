import getAppDataPath from "appdata-path";
import path from "path";
import os from "os";

const PACKAGE_PATH = getAppDataPath("locadot");
const LOGS = path.join(PACKAGE_PATH, ".locadot.log");
const LOCK_FILE = path.join(PACKAGE_PATH, ".locadot.lock");
const REGISTRY_FILE = path.join(PACKAGE_PATH, ".locadot-registry.json");

export default class Constants {
  static paths = {
    LOCK_FILE: LOCK_FILE,
    REGISTRY_FILE: REGISTRY_FILE,
    LOGS: LOGS,
  } as const;

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
      "❌ Invalid domain. Please use a valid localhost domain like dev.localhost, localhost, test.localhost, etc.",
    hostExist:
      "❌ Domain already in use. Please choose another domain or stop the existing instance.",
    hostNotFound:
      "❌ Domain not found. Please choose another domain or stop the existing instance.",

    proxyClose: "☑️ Successfully stopped all locadot instances.",
    softClose: "☑️ Successfully stopped central proxy..",
  };
}

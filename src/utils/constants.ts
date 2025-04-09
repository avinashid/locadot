import getAppDataPath from "appdata-path";
import path from "path";
const PACKAGE_PATH = getAppDataPath("locadot");

const LOCK_FILE = path.join(PACKAGE_PATH, ".locadot.lock");

const REGISTRY_FILE = path.join(PACKAGE_PATH, ".locadot-registry.json");

const LOGS = path.join(PACKAGE_PATH, ".locadot.log");

export const locadotPath = {
  LOCK_FILE,
  REGISTRY_FILE,
  LOGS,
};

export const errorConstants = {
  invalidHost:
    "❌ Invalid domain. Please use a valid localhost domain like dev.localhost, localhost, test.localhost, etc.",
  hostExist:
    "❌ Domain already in use. Please choose another domain or stop the existing instance.",

  proxyClose: "☑️ Successfully stopped all locadot instances.",
  softClose: "☑️ Successfully stopped central proxy..",
};

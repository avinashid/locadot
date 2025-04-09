import locadotFile from "./lib/locadot-file";
import locadotProxy from "./server";

async function run() {
  locadotFile.updateLogs("🔄 Starting central proxy.");
  await locadotProxy.startCentralProxy();
  locadotFile.updateLogs("☑️ Central proxy started.");
}

run();

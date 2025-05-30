import locadotProxy from "./proxy";
import logger from "./utils/logger";

async function run() {
  logger.info(`🔄 Starting central proxy.`);
  await locadotProxy.startCentralProxy();
  logger.info("☑️ Central proxy started.");
}

run();

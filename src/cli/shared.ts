import locadotProxy from "../lib/proxy-control";
import logger from "../utils/logger";

export const print = (message: string) => logger.info(message);

/** The proxy only picks up mappings once running; a failure here must not be hidden. */
export const ensureRunning = async (options: { start?: boolean } = {}) => {
  if (options.start === false) return;
  const wasRunning = locadotProxy.running();
  const info = await locadotProxy.start();
  if (!wasRunning) print(`🚀 Central proxy started (pid ${info.pid}).`);
};

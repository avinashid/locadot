import RegistryStore from "../lib/registry";
import logger from "../utils/logger";
import { getCertFor } from "../utils/certs";
import type { HostEntry, Registry } from "../types";

/** The proxy's in-memory registry; `reload` re-reads the file and keeps the last good copy on failure. */
export const createRegistryState = (onLoad: (hosts: Record<string, HostEntry>) => void) => {
  let registry: Registry = { version: 2, hosts: {} };
  // Certs are slow to generate (~1-2 s each); do it ahead of the first request.
  let warming = Promise.resolve();
  const warmCerts = (hosts: string[]) => {
    for (const host of hosts) {
      warming = warming.then(() =>
        getCertFor(host).then(
          () => undefined,
          (error) => {
            logger.warn(`cert for ${host}: ${error}`);
          }
        )
      );
    }
  };
  const reload = () => {
    try {
      registry = RegistryStore.read();
      logger.info(`🔄 Loaded ${Object.keys(registry.hosts).length} host mapping(s)`);
      warmCerts(Object.keys(registry.hosts));
      onLoad(registry.hosts);
    } catch (error) {
      // Keep serving the last good mapping rather than dropping everything.
      logger.error(error);
    }
  };
  return { get: () => registry, reload };
};

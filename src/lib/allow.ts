import net from "net";
import { isLoopbackHost } from "../proxy/guard";
import { InputError } from "./localhost";

/**
 * A mapping's `allow` list: internal addresses (`localhost:3000`, `api.internal`) that a tunnel visitor or hub peer
 * may reach through that mapping's --cors pass-through. Everyone else stays limited to public hosts.
 */
export const MAX_ALLOW = 32;

const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const HOSTNAME = new RegExp(`^${LABEL}(?:\\.${LABEL})*$`);

/** Loopback spellings (127.0.0.1, 0.0.0.0) all mean this machine, and the shim sends whichever the app wrote. */
const canonicalHost = (host: string) => (isLoopbackHost(host) && !host.endsWith(".localhost") ? "localhost" : host);

export const parseAllow = (value: unknown): string => {
  if (typeof value !== "string") throw new InputError("❌ Each allowed address must be a string, e.g. localhost:3000.");
  const raw = value.trim().toLowerCase();
  const bare = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/\/$/, "");
  const match = bare.match(/^([^:/\s]+)(?::(\d{1,5}))?$/);
  const port = match?.[2] === undefined ? undefined : Number(match[2]);
  if (!match || !(net.isIPv4(match[1]) || HOSTNAME.test(match[1])) || (port !== undefined && (port < 1 || port > 65535))) {
    throw new InputError(`❌ "${value}" isn't a host or host:port, e.g. localhost:3000 or api.internal.`);
  }
  const host = canonicalHost(match[1]);
  return port === undefined ? host : `${host}:${port}`;
};

/** Normalizes and de-duplicates; an empty list clears it. */
export const parseAllowList = (value: unknown): string[] => {
  const items = typeof value === "string" ? value.split(",").filter((item) => item.trim()) : value;
  if (!Array.isArray(items)) throw new InputError("❌ `allow` must be a list of addresses, e.g. [\"localhost:3000\"].");
  const list = [...new Set(items.map(parseAllow))];
  if (list.length > MAX_ALLOW) throw new InputError(`❌ At most ${MAX_ALLOW} allowed addresses per mapping.`);
  return list;
};

const defaultPort = (scheme: string) => (scheme === "https" || scheme === "wss" ? 443 : 80);

/** `host` from the pass-through URL (no brackets: parseVia only accepts names and IPv4). */
export const splitHost = (host: string, scheme: string) => {
  const match = host.toLowerCase().match(/^(.*?)(?::(\d+))?$/)!;
  return { host: canonicalHost(match[1].replace(/\.$/, "")), port: match[2] ? Number(match[2]) : defaultPort(scheme) };
};

export const allowMatches = (allow: string[] | undefined, host: string, scheme: string) => {
  if (!allow?.length) return false;
  const target = splitHost(host, scheme);
  return allow.some((entry) => {
    const [name, port] = entry.split(":");
    return name === target.host && (port === undefined || Number(port) === target.port);
  });
};

import dns from "dns";
import http from "http";
import https from "https";
import net from "net";

/**
 * Tunnel visitors are the internet. Their --cors pass-through calls may only leave this machine
 * for public addresses, never loopback, the LAN or cloud metadata.
 */
const blocked = new net.BlockList();
for (const [prefix, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(prefix, bits, "ipv4");
}
for (const [prefix, bits] of [
  ["::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(prefix, bits, "ipv6");
}

/** IPv4 inside IPv6 (::ffff:10.0.0.1, 64:ff9b::a00:1) is judged by its IPv4 part. */
const embeddedV4 = (address: string) => {
  const lower = address.toLowerCase();
  const dotted = lower.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (dotted) return dotted;
  const hex = lower.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return undefined;
  const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
};

export const isPublicAddress = (address: string) => {
  const v4 = net.isIPv4(address) ? address : embeddedV4(address);
  if (v4) return !blocked.check(v4, "ipv4");
  return net.isIPv6(address) && !blocked.check(address, "ipv6");
};

/** A host the pass-through may call for a tunnel visitor, judged before any DNS lookup. */
export const isPublicHost = (host: string) => {
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  if (net.isIP(name)) return isPublicAddress(name);
  return name !== "localhost" && !name.endsWith(".localhost") && !name.endsWith(".local") && name.includes(".");
};

// Checked at connect time, on the addresses actually dialled, so DNS rebinding can't slip past.
const publicLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const allowed = addresses.filter((entry) => isPublicAddress(entry.address));
    if (!allowed.length) {
      const error: NodeJS.ErrnoException = new Error(`${hostname} is not a public address`);
      error.code = "EPUBLICONLY";
      return callback(error, "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, allowed);
    callback(null, allowed[0].address, allowed[0].family);
  });
};

export const publicOnlyAgents = {
  http: new http.Agent({ keepAlive: true, lookup: publicLookup }),
  https: new https.Agent({ keepAlive: true, lookup: publicLookup }),
};

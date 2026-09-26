import http from "http";
import type { TLSSocket } from "tls";
import type { Via } from "./passthrough";

interface RequestTag {
  /** The mapping behind a tunnel's public host (xyz.trycloudflare.com). */
  host?: string;
  tunnel?: boolean;
  via?: Via;
}

const tags = new WeakMap<http.IncomingMessage, RequestTag>();

export const tag = (req: http.IncomingMessage, values: RequestTag) => {
  tags.set(req, { ...tags.get(req), ...values });
};

/** Host header without port, lowercased; handles [::1]:443. */
export const hostOf = (req: http.IncomingMessage) => {
  const raw = (req.headers.host || "").trim().toLowerCase();
  if (raw.startsWith("[")) return raw.slice(1, raw.indexOf("]"));
  return raw.split(":")[0].replace(/\.$/, "");
};

/** The mapping a request is for: its Host, or the mapping behind a tunnel's public host. */
export const mappedHost = (req: http.IncomingMessage) => tags.get(req)?.host ?? hostOf(req);

export const fromTunnel = (req: http.IncomingMessage) => Boolean(tags.get(req)?.tunnel);

export const viaOf = (req: http.IncomingMessage) => tags.get(req)?.via;

/** Tunnel visitors are on https even though cloudflared talks plain http to us. */
export const isTls = (req: http.IncomingMessage) => Boolean((req.socket as TLSSocket).encrypted) || fromTunnel(req);

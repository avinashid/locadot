import http from "http";
import type { TLSSocket } from "tls";
import type { Via } from "./passthrough";

interface RequestTag {
  /** The mapping behind a tunnel's public host (xyz.trycloudflare.com). */
  host?: string;
  tunnel?: boolean;
  /** Sender side: an authenticated peer's request through the hub's public hostname. */
  remote?: boolean;
  /** The public side of a remote request was https. */
  secure?: boolean;
  via?: Via;
  /** Sender side: an admin peer's browser viewing this dashboard; the receiver's `host[:port]` it runs on. */
  peerOrigin?: string;
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

export const fromRemote = (req: http.IncomingMessage) => Boolean(tags.get(req)?.remote);

export const peerOriginOf = (req: http.IncomingMessage) => tags.get(req)?.peerOrigin;

export const viaOf = (req: http.IncomingMessage) => tags.get(req)?.via;

/** Tunnel visitors are on https even though cloudflared talks plain http to us. */
export const isTls = (req: http.IncomingMessage) =>
  Boolean((req.socket as TLSSocket).encrypted) || fromTunnel(req) || Boolean(tags.get(req)?.secure);

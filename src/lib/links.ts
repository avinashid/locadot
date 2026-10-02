import crypto from "crypto";
import fs from "fs";
import Constants from "../constants";
import FileModule from "../utils/file";
import type { Invite, Peer, Permission, Role } from "../types";

export const INVITE_TTL_MS = 5 * 60_000;

export class LinkError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface LinksFile {
  invites: Invite[];
  peers: Peer[];
}

const sha256Hex = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** Constant-time compare of a stored hex digest against a fresh secret. */
const matchesHash = (storedHex: string, secret: string) => {
  const stored = Buffer.from(storedHex, "hex");
  const candidate = Buffer.from(sha256Hex(secret), "hex");
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
};

const load = (): LinksFile => {
  const raw = FileModule.read("LINKS_FILE");
  if (!raw) return { invites: [], peers: [] };
  try {
    const data = JSON.parse(raw);
    return {
      invites: Array.isArray(data?.invites) ? data.invites : [],
      peers: Array.isArray(data?.peers) ? data.peers : [],
    };
  } catch {
    return { invites: [], peers: [] };
  }
};

const save = (data: LinksFile) => {
  FileModule.writeAtomic("LINKS_FILE", JSON.stringify(data, null, 2));
  fs.chmodSync(Constants.paths.LINKS_FILE, 0o600);
};

const CODE_PATTERN = /^lnk_([0-9a-f]{8})\.(.+)$/i;
const TOKEN_PATTERN = /^lpt_([0-9a-f]{8})\.(.+)$/i;

export default class Links {
  static createInvite(input: { role: Role; hosts?: string[] }): { invite: Invite; code: string } {
    const id = crypto.randomBytes(4).toString("hex");
    const secret = crypto.randomBytes(32).toString("base64url");
    const now = new Date();
    const invite: Invite = {
      id,
      codeHash: sha256Hex(secret),
      role: input.role,
      hosts: input.hosts,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
    };
    const data = load();
    data.invites.push(invite);
    save(data);
    return { invite, code: `lnk_${id}.${secret}` };
  }

  static inviteString(baseUrl: string, code: string): string {
    return `${baseUrl.replace(/\/$/, "")}/#${code}`;
  }

  /** One-time: the invite is removed once a matching id is resolved, success or not. */
  static redeem(code: string, name: string): { peer: Peer; token: string } {
    const match = CODE_PATTERN.exec(String(code || "").trim());
    if (!match) throw new LinkError(401, "Invalid or expired code.");
    const [, id, secret] = match;
    const data = load();
    const index = data.invites.findIndex((invite) => invite.id === id);
    if (index === -1) throw new LinkError(401, "Invalid or expired code.");
    const invite = data.invites[index];
    data.invites.splice(index, 1);
    save(data);

    if (Date.parse(invite.expiresAt) < Date.now()) throw new LinkError(401, "Invalid or expired code.");
    if (!matchesHash(invite.codeHash, secret)) throw new LinkError(401, "Invalid or expired code.");

    const peerId = crypto.randomBytes(4).toString("hex");
    const tokenSecret = crypto.randomBytes(32).toString("base64url");
    const peer: Peer = {
      id: peerId,
      name: String(name || "peer"),
      role: invite.role,
      hosts: invite.hosts,
      tokenHash: sha256Hex(tokenSecret),
      createdAt: new Date().toISOString(),
    };
    const fresh = load();
    fresh.peers.push(peer);
    save(fresh);
    return { peer, token: `lpt_${peerId}.${tokenSecret}` };
  }

  /** Updates lastSeen at most once a minute so every proxied request doesn't rewrite the file. */
  static authenticate(token: string | undefined): Peer | undefined {
    if (!token) return undefined;
    const match = TOKEN_PATTERN.exec(token.trim());
    if (!match) return undefined;
    const [, id, secret] = match;
    const data = load();
    const peer = data.peers.find((p) => p.id === id);
    if (!peer || !matchesHash(peer.tokenHash, secret)) return undefined;
    const now = Date.now();
    if (!peer.lastSeen || now - Date.parse(peer.lastSeen) >= 60_000) {
      peer.lastSeen = new Date(now).toISOString();
      save(data);
    }
    return peer;
  }

  static list(): { invites: Invite[]; peers: Peer[] } {
    const data = load();
    const now = Date.now();
    const invites = data.invites.filter((invite) => Date.parse(invite.expiresAt) >= now);
    if (invites.length !== data.invites.length) save({ ...data, invites });
    return { invites, peers: data.peers };
  }

  static setRole(peerId: string, role: Role, hosts?: string[]): Peer {
    const data = load();
    const peer = data.peers.find((p) => p.id === peerId);
    if (!peer) throw new LinkError(404, "Peer not found.");
    peer.role = role;
    peer.hosts = hosts;
    save(data);
    return peer;
  }

  /** A viewer's mappings, changed after pairing. Editors and admins see everything, so they have no list. */
  static setHosts(peerId: string, hosts: string[]): Peer {
    const data = load();
    const peer = data.peers.find((p) => p.id === peerId);
    if (!peer) throw new LinkError(404, "Peer not found.");
    if (peer.role !== "viewer") throw new LinkError(400, `${peer.name} is ${peer.role === "admin" ? "an admin" : "an editor"} and already sees every host.`);
    peer.hosts = [...new Set(hosts.map((h) => h.trim().toLowerCase()).filter(Boolean))].sort();
    save(data);
    return peer;
  }

  static revoke(peerId: string): void {
    const data = load();
    const peers = data.peers.filter((p) => p.id !== peerId);
    if (peers.length !== data.peers.length) save({ ...data, peers });
  }

  static revokeInvite(id: string): void {
    const data = load();
    const invites = data.invites.filter((invite) => invite.id !== id);
    if (invites.length !== data.invites.length) save({ ...data, invites });
  }

  static can(peer: Pick<Peer, "role">, permission: Permission): boolean {
    if (permission === "read") return true;
    if (permission === "write") return peer.role === "editor" || peer.role === "admin";
    return peer.role === "admin"; // delete, settings
  }

  static visibleHosts(peer: Pick<Peer, "role" | "hosts">, all: string[]): string[] {
    if (peer.role !== "viewer") return all;
    const mine = new Set(peer.hosts || []);
    return all.filter((host) => mine.has(host));
  }
}

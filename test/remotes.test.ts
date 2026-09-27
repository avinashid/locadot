import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.LOCADOT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-remotes-"));

const Remotes = require("../src/lib/remotes").default;
const { RemoteError } = require("../src/lib/remotes");
const { ConflictError, NotFoundError } = require("../src/lib/hosts");
const RegistryStore = require("../src/lib/registry").default;
const Constants = require("../src/constants").default;
const { remoteFor, remoteOptions } = require("../src/proxy/remote");

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as any).port)));
}

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
  });
}

const TOKEN = "tok_fixed";
const CODE = "lnk_deadbeef.secretABC123_-xyz";

test("remotes (receiver)", async (t) => {
  const state = {
    role: "editor" as string,
    peerHosts: undefined as string[] | undefined,
    hostname: "alice",
    hosts: [
      { host: "app.localhost", target: "http://localhost:4000", cors: false, insecure: false },
      { host: "dup.localhost", target: "http://localhost:4001", cors: false, insecure: false },
      { host: "api.x.localhost", target: "http://localhost:4002", cors: false, insecure: false },
    ],
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://x");
    const send = (status: number, obj: unknown) => {
      const body = JSON.stringify(obj);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(body);
    };
    const authed = req.headers.authorization === `Bearer ${TOKEN}`;

    if (url.pathname === "/_locadot/v1/connect" && req.method === "POST") {
      const body = await readJson(req);
      if (body.code !== CODE) return send(401, { error: "invalid or expired code" });
      return send(200, {
        token: TOKEN,
        peer: { id: "peer1", name: body.name, role: state.role, hosts: state.peerHosts },
        sender: { hostname: state.hostname, version: "1.2.3" },
      });
    }
    if (url.pathname === "/_locadot/v1/whoami" && req.method === "GET") {
      if (!authed) return send(401, { error: "unauthorized" });
      return send(200, { peer: { id: "peer1", name: "r", role: state.role, hosts: state.peerHosts }, sender: { hostname: state.hostname, version: "1.2.3" } });
    }
    if (url.pathname === "/_locadot/v1/hosts" && req.method === "GET") {
      if (!authed) return send(401, { error: "unauthorized" });
      return send(200, { hosts: state.hosts });
    }
    if (url.pathname === "/_locadot/v1/hosts" && req.method === "POST") {
      if (!authed) return send(401, { error: "unauthorized" });
      const body = await readJson(req);
      const host = { host: body.host, target: body.target, cors: !!body.cors, insecure: !!body.insecure };
      state.hosts.push(host);
      return send(201, { host });
    }
    const hostMatch = url.pathname.match(/^\/_locadot\/v1\/hosts\/(.+)$/);
    if (hostMatch && req.method === "PUT") {
      if (!authed) return send(401, { error: "unauthorized" });
      const name = decodeURIComponent(hostMatch[1]);
      const body = await readJson(req);
      const existing = state.hosts.find((h) => h.host === name);
      if (!existing) return send(404, { error: "not found" });
      Object.assign(existing, {
        target: body.target ?? existing.target,
        cors: body.cors ?? existing.cors,
        insecure: body.insecure ?? existing.insecure,
      });
      return send(200, { host: existing });
    }
    if (hostMatch && req.method === "DELETE") {
      if (!authed) return send(401, { error: "unauthorized" });
      const name = decodeURIComponent(hostMatch[1]);
      state.hosts = state.hosts.filter((h) => h.host !== name);
      return send(200, { ok: true });
    }
    send(404, { error: "no route" });
  });
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const invite = `${baseUrl}/#${CODE}`;
  t.after(() => server.close());

  let remoteName = "";

  await t.test("parseInvite: valid and invalid pairing strings", () => {
    assert.deepEqual(Remotes.parseInvite(`  ${invite}  `), { url: baseUrl, code: CODE });
    assert.deepEqual(Remotes.parseInvite(`${baseUrl}//#${CODE}`), { url: baseUrl, code: CODE });
    assert.throws(() => Remotes.parseInvite("garbage"), RemoteError);
    assert.throws(() => Remotes.parseInvite(`${baseUrl}/#not_a_code`), RemoteError);
    try {
      Remotes.parseInvite("garbage");
      assert.fail("should have thrown");
    } catch (error: any) {
      assert.equal(error.status, 400);
    }
  });

  await t.test("connect: imports hosts, renames conflicts, skips unplaceable", async () => {
    const now = new Date().toISOString();
    await RegistryStore.mutate((registry: any) => {
      registry.hosts["app.localhost"] = { target: "http://localhost:9", createdAt: now, updatedAt: now };
      registry.hosts["app.alice.localhost"] = { target: "http://localhost:9", createdAt: now, updatedAt: now };
      registry.hosts["dup.localhost"] = { target: "http://localhost:9", createdAt: now, updatedAt: now };
    });

    const result = await Remotes.connect(invite);
    remoteName = result.remote.name;
    assert.equal(remoteName, "alice");
    assert.equal(result.remote.token, TOKEN);
    assert.equal(result.remote.role, "editor");
    assert.equal(result.hosts.length, 3);
    assert.deepEqual(new Set(result.skipped), new Set(["app.localhost"]));
    const mappedHosts = new Set(result.mapped.map((m: any) => m.host));
    assert.ok(!mappedHosts.has("app.localhost"));
    const dupEntry = result.mapped.find((m: any) => m.host === "dup.localhost");
    assert.equal(dupEntry.local, "dup.alice.localhost");
    const apiEntry = result.mapped.find((m: any) => m.host === "api.x.localhost");
    assert.equal(apiEntry.local, "api.x.localhost");

    const registry = RegistryStore.read();
    assert.equal(registry.hosts["dup.alice.localhost"].remote.name, remoteName);
    assert.equal(registry.hosts["dup.alice.localhost"].remote.host, "dup.localhost");
    assert.equal(registry.hosts["api.x.localhost"].remote.host, "api.x.localhost");

    const mode = fs.statSync(Constants.paths.REMOTES_FILE).mode & 0o777;
    assert.equal(mode, 0o600);
  });

  await t.test("addHost creates a local alias, removeHost cleans it up", async () => {
    const created = await Remotes.addHost(remoteName, { host: "new.localhost", target: "http://localhost:5000" });
    assert.equal(created.host, "new.localhost");
    let registry = RegistryStore.read();
    assert.equal(registry.hosts["new.localhost"].remote.host, "new.localhost");

    await Remotes.removeHost(remoteName, "new.localhost");
    registry = RegistryStore.read();
    assert.equal(registry.hosts["new.localhost"], undefined);
    assert.ok(!state.hosts.some((h) => h.host === "new.localhost"));
  });

  await t.test("sync: picks up a new host and a role change", async () => {
    state.role = "viewer";
    state.peerHosts = ["app.localhost"];
    state.hosts.push({ host: "fresh.localhost", target: "http://localhost:6000", cors: false, insecure: false });

    const result = await Remotes.sync(remoteName);
    assert.equal(result.remote.role, "viewer");
    assert.deepEqual(result.remote.hosts, ["app.localhost"]);
    assert.ok(result.mapped.some((m: any) => m.host === "fresh.localhost" && m.local === "fresh.localhost"));
    assert.ok(result.mapped.some((m: any) => m.host === "dup.localhost"));

    const stored = Remotes.get(remoteName);
    assert.equal(stored.role, "viewer");
  });

  await t.test("alias: success, not found, conflict", async () => {
    await Remotes.alias(remoteName, "fresh.localhost", "myalias.localhost");
    const registry1 = RegistryStore.read();
    assert.equal(registry1.hosts["myalias.localhost"].remote.host, "fresh.localhost");

    await assert.rejects(() => Remotes.alias(remoteName, "nope.localhost", "other.localhost"), NotFoundError);
    await assert.rejects(() => Remotes.alias(remoteName, "fresh.localhost", "myalias.localhost"), ConflictError);
  });

  await t.test("setUrl updates the stored remote", () => {
    Remotes.setUrl(remoteName, `${baseUrl}/`);
    assert.equal(Remotes.get(remoteName).url, baseUrl);
  });

  await t.test("remoteFor caches by mtime, remoteOptions shape", () => {
    const before = remoteFor(remoteName);
    assert.equal(before.url, baseUrl);

    Remotes.setUrl(remoteName, `${baseUrl}/changed`);
    const after = remoteFor(remoteName);
    assert.equal(after.url, `${baseUrl}/changed`);
    Remotes.setUrl(remoteName, baseUrl);

    const entry = { target: baseUrl, remote: { name: remoteName, host: "api.x.localhost" }, createdAt: "x", updatedAt: "x" };
    const req = { headers: { host: "api.x.localhost" }, socket: {} } as any;
    const opts = remoteOptions(req, entry, Remotes.get(remoteName));
    assert.equal(opts.target, baseUrl);
    assert.equal(opts.xfwd, false);
    assert.equal(opts.ws, true);
    assert.equal(opts.secure, true);
    assert.equal((opts.headers as any)["X-Locadot-Peer"], TOKEN);
    assert.equal((opts.headers as any)["X-Locadot-Host"], "api.x.localhost");
    assert.equal((opts.headers as any)["X-Original-Host"], "api.x.localhost");
  });

  await t.test("disconnect removes the remote and its registry entries", async () => {
    await Remotes.disconnect(remoteName);
    assert.equal(Remotes.get(remoteName), undefined);
    const registry = RegistryStore.read();
    for (const entry of Object.values(registry.hosts) as any[]) {
      assert.notEqual(entry.remote?.name, remoteName);
    }
  });
});

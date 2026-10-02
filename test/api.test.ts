import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-api-"));
process.env.LOCADOT_HOME = tmpHome;

const { handleDashboardRequest } = require("../src/dashboard");
const RegistryStore = require("../src/lib/registry").default;
const FileModule = require("../src/utils/file").default;
const Constants = require("../src/constants").default;
const Remotes = require("../src/lib/remotes").default;
const HubConfigStore = require("../src/lib/hub-config").default;
const Links = require("../src/lib/links").default;

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
  });
}

test.after(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

const TOKEN = "a".repeat(64);
const WRONG_TOKEN = "b".repeat(64);
const SHORT_TOKEN = "a".repeat(10);

function makeCtx() {
  const state = { reloads: 0, refreshes: 0, shutdowns: [] as string[] };
  const ctx = {
    getRegistry: () => RegistryStore.read(),
    getStats: () => ({}),
    proxyInfo: {
      pid: process.pid,
      version: "1.0.0",
      startedAt: new Date(Date.now() - 1000).toISOString(),
      httpPort: 8080,
      httpsPort: 8443,
      bind: ["127.0.0.1"],
      stateDir: tmpHome,
      caTrusted: true,
    },
    probe: async () => ({ up: true, status: 200, ms: 1 }),
    token: TOKEN,
    reload: () => {
      state.reloads++;
    },
    refreshTrust: async () => {
      state.refreshes++;
    },
    shutdown: (reason: string) => {
      state.shutdowns.push(reason);
    },
    tunnel: () => ({ enabled: false, status: "off" as const }),
    retryTunnels: () => {},
    hub: () => ({ enabled: false, status: "off" as const }),
    reloadHub: () => {},
    setupNamedHub: (_domain: string, _tunnel?: string) => {},
  };
  return { ctx, state };
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as any).port)));
}

interface Opts {
  headers?: Record<string, string>;
  body?: string;
}

function request(port: number, method: string, urlPath: string, opts: Opts = {}): Promise<{ status: number; json: any; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: urlPath, headers: opts.headers }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        let json: any;
        try {
          json = JSON.parse(body);
        } catch {
          json = undefined;
        }
        resolve({ status: res.statusCode!, json, body });
      });
    });
    req.on("error", reject);
    req.end(opts.body);
  });
}

function authed(extra: Record<string, string> = {}): Record<string, string> {
  return { "x-locadot-token": TOKEN, ...extra };
}

test("dashboard api", async (t) => {
  const { ctx, state } = makeCtx();
  const server = http.createServer((req, res) => handleDashboardRequest(req, res, ctx));
  const port = await listen(server);
  t.after(() => server.close());

  const SENDER_TOKEN = "sender_tok";
  const SENDER_CODE = "lnk_cafebabe.codeXYZ_-1";
  const senderState = { role: "admin" as string, localhost: true as boolean | undefined, hostname: "sender-box", hosts: [] as any[] };
  const senderServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://x");
    const send = (status: number, obj: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    const authed = req.headers.authorization === `Bearer ${SENDER_TOKEN}`;
    if (url.pathname === "/_locadot/v1/connect" && req.method === "POST") {
      const body = await readJson(req);
      if (body.code !== SENDER_CODE) return send(401, { error: "invalid or expired code" });
      return send(200, {
        token: SENDER_TOKEN,
        localhost: senderState.localhost,
        peer: { id: "peer1", name: body.name, role: senderState.role },
        sender: { hostname: senderState.hostname, version: "1.2.3" },
      });
    }
    if (url.pathname === "/_locadot/v1/whoami" && req.method === "GET") {
      if (!authed) return send(401, { error: "unauthorized" });
      return send(200, { localhost: senderState.localhost, peer: { id: "peer1", name: "r", role: senderState.role }, sender: { hostname: senderState.hostname, version: "1.2.3" } });
    }
    if (url.pathname === "/_locadot/v1/hosts" && req.method === "GET") {
      if (!authed) return send(401, { error: "unauthorized" });
      return send(200, { hosts: senderState.hosts });
    }
    send(404, { error: "no route" });
  });
  const senderPort = await listen(senderServer);
  const senderInvite = `http://127.0.0.1:${senderPort}/#${SENDER_CODE}`;
  t.after(() => senderServer.close());

  await t.test("403: no token", async () => {
    const r = await request(port, "POST", "/api/logs/clear");
    assert.equal(r.status, 403);
  });

  await t.test("403: wrong token", async () => {
    const r = await request(port, "POST", "/api/logs/clear", { headers: authed({ "x-locadot-token": WRONG_TOKEN }) });
    assert.equal(r.status, 403);
  });

  await t.test("403: token of wrong length", async () => {
    const r = await request(port, "POST", "/api/logs/clear", { headers: { "x-locadot-token": SHORT_TOKEN } });
    assert.equal(r.status, 403);
  });

  await t.test("403: Origin https://evil.com", async () => {
    const r = await request(port, "POST", "/api/logs/clear", { headers: authed({ origin: "https://evil.com" }) });
    assert.equal(r.status, 403);
  });

  await t.test("403: Origin https://app.localhost (subdomain app can't drive panel)", async () => {
    const r = await request(port, "POST", "/api/logs/clear", { headers: authed({ origin: "https://app.localhost" }) });
    assert.equal(r.status, 403);
  });

  await t.test("403: Sec-Fetch-Site cross-site", async () => {
    const r = await request(port, "POST", "/api/logs/clear", { headers: authed({ "sec-fetch-site": "cross-site" }) });
    assert.equal(r.status, 403);
  });

  await t.test("200: Origin http://localhost:PORT", async () => {
    const r = await request(port, "POST", "/api/logs/clear", { headers: authed({ origin: `http://localhost:${port}` }) });
    assert.equal(r.status, 200);
  });

  await t.test("200: Origin http://127.0.0.1:PORT", async () => {
    const r = await request(port, "POST", "/api/logs/clear", { headers: authed({ origin: `http://127.0.0.1:${port}` }) });
    assert.equal(r.status, 200);
  });

  await t.test("415: text/plain body (classic form CSRF)", async () => {
    const r = await request(port, "POST", "/api/logs/clear", {
      headers: authed({ "content-type": "text/plain", "content-length": "4" }),
      body: "data",
    });
    assert.equal(r.status, 415);
  });

  await t.test("413: oversized body", async () => {
    const big = "x".repeat(70 * 1024);
    const r = await request(port, "POST", "/api/logs/clear", {
      headers: authed({ "content-type": "application/json", "content-length": String(big.length) }),
      body: big,
    });
    assert.equal(r.status, 413);
  });

  await t.test("400: JSON array body", async () => {
    const body = JSON.stringify([1, 2, 3]);
    const r = await request(port, "POST", "/api/logs/clear", {
      headers: authed({ "content-type": "application/json", "content-length": String(body.length) }),
      body,
    });
    assert.equal(r.status, 400);
  });

  await t.test("400: invalid JSON body", async () => {
    const body = "{ not json";
    const r = await request(port, "POST", "/api/logs/clear", {
      headers: authed({ "content-type": "application/json", "content-length": String(body.length) }),
      body,
    });
    assert.equal(r.status, 400);
  });

  await t.test("host CRUD round trip", async () => {
    const reloadsBefore = state.reloads;

    const add = await request(port, "POST", "/api/hosts", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ host: "crud.localhost", target: 4001 }),
    });
    assert.equal(add.status, 201);
    assert.ok(add.json.url.startsWith("https://crud.localhost"));
    assert.equal(state.reloads, reloadsBefore + 1);

    const dup = await request(port, "POST", "/api/hosts", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ host: "crud.localhost", target: 4002 }),
    });
    assert.equal(dup.status, 409);

    const badHost = await request(port, "POST", "/api/hosts", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ host: "evil.com", target: 4003 }),
    });
    assert.equal(badHost.status, 400);

    const badTarget = await request(port, "POST", "/api/hosts", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ host: "badtarget.localhost", target: "ftp://x" }),
    });
    assert.equal(badTarget.status, 400);

    const put = await request(port, "PUT", "/api/hosts/crud.localhost", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ target: 4005 }),
    });
    assert.equal(put.status, 200);
    assert.equal(RegistryStore.read().hosts["crud.localhost"].target, "http://localhost:4005");

    const putUnknown = await request(port, "PUT", "/api/hosts/unknown.localhost", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ target: 4006 }),
    });
    assert.equal(putUnknown.status, 404);

    const del = await request(port, "DELETE", "/api/hosts/crud.localhost", { headers: authed() });
    assert.equal(del.status, 200);
    assert.ok(!RegistryStore.read().hosts["crud.localhost"]);

    const delAgain = await request(port, "DELETE", "/api/hosts/crud.localhost", { headers: authed() });
    assert.equal(delAgain.status, 404);
  });

  await t.test("URL-encoded host path works", async () => {
    const add = await request(port, "POST", "/api/hosts", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ host: "encoded.localhost", target: 4010 }),
    });
    assert.equal(add.status, 201);

    const put = await request(port, "PUT", `/api/hosts/${encodeURIComponent("encoded.localhost")}`, {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ target: 4011 }),
    });
    assert.equal(put.status, 200);
    assert.equal(RegistryStore.read().hosts["encoded.localhost"].target, "http://localhost:4011");

    const del = await request(port, "DELETE", `/api/hosts/${encodeURIComponent("encoded.localhost")}`, { headers: authed() });
    assert.equal(del.status, 200);
  });

  await t.test("GET /api/logs returns last N lines; POST /api/logs/clear empties it", async () => {
    FileModule.write("LOGS", Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n") + "\n");

    const r = await request(port, "GET", "/api/logs?lines=3");
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.lines, ["line 7", "line 8", "line 9"]);

    const noToken = await request(port, "GET", "/api/logs?lines=3");
    assert.equal(noToken.status, 200, "logs GET needs no token");

    const clear = await request(port, "POST", "/api/logs/clear", { headers: authed() });
    assert.equal(clear.status, 200);
    assert.equal(FileModule.read("LOGS"), "");
  });

  await t.test("POST /api/proxy/stop calls shutdown", async () => {
    const before = state.shutdowns.length;
    const r = await request(port, "POST", "/api/proxy/stop", { headers: authed() });
    assert.equal(r.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(state.shutdowns.length, before + 1);
  });

  await t.test("GET /api/status has a system object with the right types", async () => {
    const r = await request(port, "GET", "/api/status");
    assert.equal(r.status, 200);
    const { system } = r.json;
    assert.equal(typeof system.platform, "string");
    assert.equal(typeof system.isRoot, "boolean");
    assert.equal(typeof system.canBindPrivileged, "boolean");
    assert.ok(system.unprivilegedPortStart === null || typeof system.unprivilegedPortStart === "number");
    assert.ok(system.caTrusted === null || typeof system.caTrusted === "boolean");
    assert.equal(typeof system.startup, "object");
    assert.equal(typeof system.startup.enabled, "boolean");
    assert.ok(system.startup.method === null || typeof system.startup.method === "string");
    assert.equal(typeof system.stateDir, "string");
  });

  await t.test("403 without token: /api/trust and /api/startup are rejected", async () => {
    const trust = await request(port, "POST", "/api/trust", { body: JSON.stringify({ trusted: true }) });
    assert.equal(trust.status, 403);
    const startup = await request(port, "POST", "/api/startup", { body: JSON.stringify({ enabled: true }) });
    assert.equal(startup.status, 403);
  });

  await t.test("403 with bad Origin: /api/trust and /api/startup are rejected", async () => {
    const trust = await request(port, "POST", "/api/trust", {
      headers: authed({ origin: "https://evil.com", "content-type": "application/json" }),
      body: JSON.stringify({ trusted: true }),
    });
    assert.equal(trust.status, 403);
    const startup = await request(port, "POST", "/api/startup", {
      headers: authed({ origin: "https://evil.com", "content-type": "application/json" }),
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(startup.status, 403);
  });

  await t.test("400 with valid token but non-boolean body: /api/trust and /api/startup (rejected before any action)", async () => {
    const trust = await request(port, "POST", "/api/trust", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ trusted: "yes" }),
    });
    assert.equal(trust.status, 400);
    const startup = await request(port, "POST", "/api/startup", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ enabled: "yes" }),
    });
    assert.equal(startup.status, 400);
  });

  await t.test("PUT /api/hub/localhost: 400 unconfigured, then toggles and shows up in GET /api/hub", async () => {
    const notConfigured = await request(port, "PUT", "/api/hub/localhost", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ enabled: false }),
    });
    assert.equal(notConfigured.status, 400);

    HubConfigStore.write({ mode: "manual", url: "http://example.com" });
    const off = await request(port, "PUT", "/api/hub/localhost", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ enabled: false }),
    });
    assert.equal(off.status, 200);
    assert.equal(off.json.localhost, false);
    assert.equal((await request(port, "GET", "/api/hub")).json.localhost, false);

    const on = await request(port, "PUT", "/api/hub/localhost", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(on.status, 200);
    assert.equal(on.json.localhost, true);
    assert.equal((await request(port, "GET", "/api/hub")).json.localhost, true);

    const badBody = await request(port, "PUT", "/api/hub/localhost", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ enabled: "yes" }),
    });
    assert.equal(badBody.status, 400);
  });

  await t.test("POST /api/remotes connects with a domain; GET /api/remotes exposes domain/localhost and never a token", async () => {
    const connect = await request(port, "POST", "/api/remotes", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ string: senderInvite, name: "carol", domain: "team-alpha" }),
    });
    assert.equal(connect.status, 200);
    assert.equal(connect.json.remote.domain, "team-alpha");
    assert.equal(connect.json.remote.token, undefined);

    const list = await request(port, "GET", "/api/remotes");
    const row = list.json.remotes.find((r: any) => r.name === "carol");
    assert.ok(row);
    assert.equal(row.domain, "team-alpha");
    assert.equal(row.localhost, true);
    assert.equal(row.token, undefined);
  });

  await t.test("PUT /api/remotes/:name sets/validates/clashes on domain", async () => {
    const invalid = await request(port, "PUT", "/api/remotes/carol", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ domain: "Not Valid!" }),
    });
    assert.equal(invalid.status, 400);

    const unknown = await request(port, "PUT", "/api/remotes/nope", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ domain: "random" }),
    });
    assert.equal(unknown.status, 404);

    const now = new Date().toISOString();
    await RegistryStore.mutate((registry: any) => {
      registry.hosts["already-used.localhost"] = { target: "http://localhost:9", createdAt: now, updatedAt: now };
    });
    const clash = await request(port, "PUT", "/api/remotes/carol", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ domain: "already-used" }),
    });
    assert.equal(clash.status, 409);

    const ok = await request(port, "PUT", "/api/remotes/carol", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ domain: "team-beta" }),
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.remote.domain, "team-beta");

    const off = await request(port, "PUT", "/api/remotes/carol", {
      headers: authed({ "content-type": "application/json" }),
      body: JSON.stringify({ domain: null }),
    });
    assert.equal(off.status, 200);
    assert.equal(off.json.remote.domain, undefined);

    await Remotes.disconnect("carol");
  });

  await t.test("PUT /api/peers/:id {hosts}: changes a viewer's hosts without touching the role", async () => {
    const { code } = Links.createInvite({ role: "viewer", hosts: ["app.localhost"] });
    const { peer } = Links.redeem(code, "Viewer");
    const put = (body: unknown) =>
      request(port, "PUT", `/api/peers/${peer.id}`, { headers: authed({ "content-type": "application/json" }), body: JSON.stringify(body) });

    const ok = await put({ hosts: ["app.localhost", "api.localhost"] });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.peer.role, "viewer");
    assert.deepEqual(ok.json.peer.hosts, ["api.localhost", "app.localhost"]);
    assert.equal(ok.json.peer.tokenHash, undefined);

    assert.equal((await put({ hosts: "app.localhost" })).status, 400);
    assert.equal((await put({})).status, 400);
    Links.setRole(peer.id, "editor");
    assert.equal((await put({ hosts: ["app.localhost"] })).status, 400);
    assert.equal((await request(port, "PUT", "/api/peers/nope", { headers: authed({ "content-type": "application/json" }), body: '{"hosts":[]}' })).status, 404);
    Links.revoke(peer.id);
  });

  await t.test("unknown /api/nope 404s", async () => {
    const r = await request(port, "GET", "/api/nope", { headers: authed() });
    assert.equal(r.status, 404);
  });

  await t.test("POST / is 405", async () => {
    const r = await request(port, "POST", "/");
    assert.equal(r.status, 405);
  });
});

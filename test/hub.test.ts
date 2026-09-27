import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.LOCADOT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-hub-"));

const fakeCloudflared = path.join(process.env.LOCADOT_HOME, "fake-cloudflared.js");
fs.writeFileSync(
  fakeCloudflared,
  '#!/usr/bin/env node\nconsole.log("https://fake-x.trycloudflare.com");\nsetInterval(() => {}, 1000);\n'
);
fs.chmodSync(fakeCloudflared, 0o755);
process.env.LOCADOT_CLOUDFLARED = fakeCloudflared;

const Links = require("../src/lib/links").default;
const RegistryStore = require("../src/lib/registry").default;
const { classify, handleHubApi, resetRateLimiter } = require("../src/proxy/hub");
const { HubTunnel, setupNamedTunnel } = require("../src/proxy/hub-tunnel");

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as any).port)));
}

function request(port: number, method: string, urlPath: string, opts: { token?: string; body?: any } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const data = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    const headers: Record<string, string> = {};
    if (data !== undefined) headers["Content-Type"] = "application/json";
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const req = http.request({ host: "127.0.0.1", port, method, path: urlPath, headers }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        let body: any = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          body = raw;
        }
        resolve({ status: res.statusCode!, body });
      });
    });
    req.on("error", reject);
    if (data !== undefined) req.write(data);
    req.end();
  });
}

function fakeReq(opts: { host?: string; url?: string; headers?: Record<string, string>; ip?: string }): any {
  return {
    headers: { host: opts.host ?? "hub.example.com", ...opts.headers },
    url: opts.url ?? "/",
    socket: { remoteAddress: opts.ip ?? "10.0.0.1" },
  };
}

function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (cond()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout waiting for condition"));
      setTimeout(tick, 20);
    };
    tick();
  });
}

/* ---------- classify() ---------- */

test("classify: no publicHost configured means every request is untouched", () => {
  const req = fakeReq({ host: "hub.example.com" });
  assert.deepEqual(classify(req, undefined, {}), { kind: "none" });
});

test("classify: host header not matching publicHost is untouched", () => {
  const req = fakeReq({ host: "other.example.com" });
  assert.deepEqual(classify(req, "hub.example.com", {}), { kind: "none" });
});

test("classify: /_locadot/ paths are api traffic", () => {
  const req = fakeReq({ host: "hub.example.com", url: "/_locadot/v1/whoami" });
  assert.deepEqual(classify(req, "hub.example.com", {}), { kind: "api" });
});

test("classify: no bearer token is denied 401", () => {
  resetRateLimiter();
  const req = fakeReq({ host: "hub.example.com", ip: "10.0.0.2" });
  const decision = classify(req, "hub.example.com", {});
  assert.deepEqual(decision, { kind: "deny", status: 401, message: "Unauthorized" });
});

test("classify: app traffic decisions for a valid peer", () => {
  resetRateLimiter();
  const hosts: Record<string, any> = {
    "a.localhost": { target: "http://localhost:3000", createdAt: "x", updatedAt: "x" },
    "b.localhost": { target: "http://localhost:3001", createdAt: "x", updatedAt: "x" },
    "remote.localhost": { target: "http://x", remote: { name: "n", host: "h" }, createdAt: "x", updatedAt: "x" },
    localhost: { target: "http://localhost:9999", createdAt: "x", updatedAt: "x" },
  };

  const { code: viewerCode } = Links.createInvite({ role: "viewer", hosts: ["a.localhost"] });
  const { token: viewerToken } = Links.redeem(viewerCode, "Viewer");
  const { code: editorCode } = Links.createInvite({ role: "editor" });
  const { token: editorToken } = Links.redeem(editorCode, "Editor");

  // viewer can reach the host it was invited with
  const reqOk = fakeReq({ host: "hub.example.com", headers: { "x-locadot-peer": viewerToken, "x-locadot-host": "a.localhost" }, ip: "10.0.0.3" });
  const okDecision = classify(reqOk, "hub.example.com", hosts);
  assert.equal(okDecision.kind, "app");
  assert.equal((okDecision as any).host, "a.localhost");
  assert.equal(reqOk.headers.authorization, undefined);
  assert.equal(reqOk.headers["x-locadot-host"], undefined);

  // hidden host for a viewer -> forbidden
  const reqHidden = fakeReq({ host: "hub.example.com", headers: { "x-locadot-peer": viewerToken, "x-locadot-host": "b.localhost" }, ip: "10.0.0.3" });
  assert.deepEqual(classify(reqHidden, "hub.example.com", hosts), { kind: "deny", status: 403, message: "Forbidden" });

  // editor sees everything, but a remote-entry host is never forwarded
  const reqRemote = fakeReq({ host: "hub.example.com", headers: { "x-locadot-peer": editorToken, "x-locadot-host": "remote.localhost" }, ip: "10.0.0.3" });
  assert.deepEqual(classify(reqRemote, "hub.example.com", hosts), { kind: "deny", status: 404, message: "Not found" });

  // localhost (dashboard) is never reachable through the hub, even present in the map
  const reqDashboard = fakeReq({ host: "hub.example.com", headers: { "x-locadot-peer": editorToken, "x-locadot-host": "localhost" }, ip: "10.0.0.3" });
  assert.deepEqual(classify(reqDashboard, "hub.example.com", hosts), { kind: "deny", status: 404, message: "Not found" });

  // missing mapping
  const reqMissing = fakeReq({ host: "hub.example.com", headers: { "x-locadot-peer": editorToken, "x-locadot-host": "nope.localhost" }, ip: "10.0.0.3" });
  assert.deepEqual(classify(reqMissing, "hub.example.com", hosts), { kind: "deny", status: 404, message: "Not found" });
});

/* ---------- classify(): localhost (admin, any port on the sender) ---------- */

test("classify: admin peer with a port header gets a local decision, headers stripped", () => {
  resetRateLimiter();
  const { code } = Links.createInvite({ role: "admin" });
  const { token } = Links.redeem(code, "Admin");

  const req = fakeReq({ host: "hub.example.com", headers: { "x-locadot-peer": token, "x-locadot-port": "5173" }, ip: "10.0.0.4" });
  const decision = classify(req, "hub.example.com", {}, { localhost: true, blockedPorts: [80, 443] });
  assert.equal(decision.kind, "local");
  assert.equal((decision as any).port, 5173);
  assert.equal((decision as any).peer.role, "admin");
  assert.equal(req.headers["x-locadot-peer"], undefined);
  assert.equal(req.headers["x-locadot-port"], undefined);
});

test("classify: editor and viewer peers are forbidden from localhost", () => {
  resetRateLimiter();
  for (const role of ["editor", "viewer"] as const) {
    const { code } = Links.createInvite({ role });
    const { token } = Links.redeem(code, role);
    const req = fakeReq({ host: "hub.example.com", headers: { "x-locadot-peer": token, "x-locadot-port": "5173" }, ip: "10.0.0.5" });
    assert.deepEqual(classify(req, "hub.example.com", {}, { localhost: true, blockedPorts: [] }), { kind: "deny", status: 403, message: "Forbidden" });
  }
});

test("classify: localhost access disabled on this machine", () => {
  resetRateLimiter();
  const { code } = Links.createInvite({ role: "admin" });
  const { token } = Links.redeem(code, "Admin");
  const req = fakeReq({ host: "hub.example.com", headers: { "x-locadot-peer": token, "x-locadot-port": "5173" }, ip: "10.0.0.6" });
  assert.deepEqual(classify(req, "hub.example.com", {}, { localhost: false, blockedPorts: [] }), {
    kind: "deny",
    status: 403,
    message: "Localhost access is off on this machine.",
  });
});

test("classify: bad port values are rejected with 400", () => {
  resetRateLimiter();
  const { code } = Links.createInvite({ role: "admin" });
  const { token } = Links.redeem(code, "Admin");
  for (const bad of ["0", "70000", "abc", "3.5", "-1", "1 2"]) {
    const req = fakeReq({ host: "hub.example.com", headers: { "x-locadot-peer": token, "x-locadot-port": bad }, ip: "10.0.0.7" });
    assert.deepEqual(classify(req, "hub.example.com", {}, { localhost: true, blockedPorts: [] }), { kind: "deny", status: 400, message: "Bad request" });
  }
});

test("classify: the sender's own proxy ports are refused even for an admin", () => {
  resetRateLimiter();
  const { code } = Links.createInvite({ role: "admin" });
  const { token } = Links.redeem(code, "Admin");
  const req = fakeReq({ host: "hub.example.com", headers: { "x-locadot-peer": token, "x-locadot-port": "8080" }, ip: "10.0.0.8" });
  assert.deepEqual(classify(req, "hub.example.com", {}, { localhost: true, blockedPorts: [8080, 8443] }), {
    kind: "deny",
    status: 403,
    message: "Forbidden",
  });
});

test("classify: a bad token on a port request is still 401, not localhost-specific", () => {
  resetRateLimiter();
  const req = fakeReq({ host: "hub.example.com", headers: { "x-locadot-port": "5173" }, ip: "10.0.0.11" });
  assert.deepEqual(classify(req, "hub.example.com", {}, { localhost: true, blockedPorts: [] }), { kind: "deny", status: 401, message: "Unauthorized" });
});

test("classify: rate limits an IP after 20 auth failures in the window", () => {
  resetRateLimiter();
  const ip = "10.0.0.9";
  for (let i = 0; i < 20; i++) {
    const decision = classify(fakeReq({ host: "hub.example.com", ip }), "hub.example.com", {});
    assert.equal(decision.kind, "deny");
    assert.equal((decision as any).status, 401);
  }
  const denied = classify(fakeReq({ host: "hub.example.com", ip }), "hub.example.com", {});
  assert.deepEqual(denied, { kind: "deny", status: 429, message: "Too many failed attempts. Try again later." });
});

/* ---------- handleHubApi() over a real http server ---------- */

test("handleHubApi: connect, hosts, write/delete permissions", async (t) => {
  resetRateLimiter();
  const ctx = {
    getRegistry: () => RegistryStore.read(),
    reload: () => {},
    retryTunnels: () => {},
  };
  const server = http.createServer((req, res) => {
    handleHubApi(req, res, ctx).catch((error) => {
      res.statusCode = 500;
      res.end(String(error));
    });
  });
  const port = await listen(server);
  t.after(() => server.close());

  const { code: editorCode } = Links.createInvite({ role: "editor" });
  const { code: adminCode } = Links.createInvite({ role: "admin" });

  const connectEditor = await request(port, "POST", "/_locadot/v1/connect", { body: { code: editorCode, name: "Editor box" } });
  assert.equal(connectEditor.status, 200);
  assert.equal(connectEditor.body.peer.role, "editor");
  assert.equal(connectEditor.body.sender.hostname, os.hostname());
  const editorToken = connectEditor.body.token as string;

  assert.equal(connectEditor.body.localhost, false); // editor: no permission regardless of the machine's setting

  const connectAdmin = await request(port, "POST", "/_locadot/v1/connect", { body: { code: adminCode, name: "Admin box" } });
  const adminToken = connectAdmin.body.token as string;
  assert.equal(connectAdmin.body.localhost, true); // admin, and no HUB_FILE means localhost defaults to enabled

  const whoamiAdmin = await request(port, "GET", "/_locadot/v1/whoami", { token: adminToken });
  assert.equal(whoamiAdmin.status, 200);
  assert.equal(whoamiAdmin.body.localhost, true);

  const whoamiEditor = await request(port, "GET", "/_locadot/v1/whoami", { token: editorToken });
  assert.equal(whoamiEditor.body.localhost, false);

  // one-time: redeeming the same code again fails
  const connectAgain = await request(port, "POST", "/_locadot/v1/connect", { body: { code: editorCode, name: "Again" } });
  assert.equal(connectAgain.status, 401);

  const unauthorized = await request(port, "GET", "/_locadot/v1/hosts");
  assert.equal(unauthorized.status, 401);

  const emptyHosts = await request(port, "GET", "/_locadot/v1/hosts", { token: editorToken });
  assert.equal(emptyHosts.status, 200);
  assert.deepEqual(emptyHosts.body.hosts, []);

  const added = await request(port, "POST", "/_locadot/v1/hosts", { token: editorToken, body: { host: "app.localhost", target: "3000" } });
  assert.equal(added.status, 201);
  assert.equal(added.body.host.host, "app.localhost");

  const forbiddenDelete = await request(port, "DELETE", "/_locadot/v1/hosts/app.localhost", { token: editorToken });
  assert.equal(forbiddenDelete.status, 403);

  const okDelete = await request(port, "DELETE", "/_locadot/v1/hosts/app.localhost", { token: adminToken });
  assert.equal(okDelete.status, 200);
  assert.deepEqual(okDelete.body, { ok: true });

  const missingDelete = await request(port, "DELETE", "/_locadot/v1/hosts/app.localhost", { token: adminToken });
  assert.equal(missingDelete.status, 404);
});

/* ---------- HubTunnel with a fake cloudflared ---------- */

test("HubTunnel: manual mode is up immediately, no process spawned", () => {
  const tunnel = new HubTunnel(() => "http://127.0.0.1:9000");
  tunnel.sync({ mode: "manual", url: "https://manual.example.com/" });
  const state = tunnel.state();
  assert.equal(state.status, "up");
  assert.equal(state.url, "https://manual.example.com");
  assert.equal(tunnel.publicHost(), "manual.example.com");
  tunnel.stop();
  assert.equal(tunnel.state().status, "off");
});

test("HubTunnel: quick mode spawns the fake cloudflared and parses the trycloudflare url", async () => {
  const tunnel = new HubTunnel(() => "http://127.0.0.1:9001");
  tunnel.sync({ mode: "quick" });
  await waitFor(() => tunnel.state().status === "up");
  assert.equal(tunnel.state().url, "https://fake-x.trycloudflare.com");
  assert.equal(tunnel.publicHost(), "fake-x.trycloudflare.com");
  tunnel.stop();
  assert.equal(tunnel.state().status, "off");
});

test("HubTunnel: sync() is a no-op for the same config and origin", async () => {
  const tunnel = new HubTunnel(() => "http://127.0.0.1:9002");
  tunnel.sync({ mode: "quick" });
  await waitFor(() => tunnel.state().status === "up");
  tunnel.sync({ mode: "quick" });
  // an actual restart would synchronously reset status to "starting"; a no-op leaves it "up"
  assert.equal(tunnel.state().status, "up");
  tunnel.stop();
});

test("HubTunnel: a changed origin restarts the tunnel", async () => {
  let port = 9003;
  const tunnel = new HubTunnel(() => `http://127.0.0.1:${port}`);
  tunnel.sync({ mode: "quick" });
  await waitFor(() => tunnel.state().status === "up");

  port = 9004;
  tunnel.sync({ mode: "quick" });
  assert.equal(tunnel.state().status, "starting");
  await waitFor(() => tunnel.state().status === "up");
  tunnel.stop();
});

test("setupNamedTunnel rejects an invalid domain before touching cloudflared", async () => {
  await assert.rejects(() => setupNamedTunnel("not a domain"), /Invalid domain/);
});

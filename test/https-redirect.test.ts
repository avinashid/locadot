import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-redirect-"));
process.env.LOCADOT_HOME = tmpHome;

const httpProxy = require("http-proxy");
const { handleRequest } = require("../src/proxy/router");
const { handleDashboardRequest } = require("../src/dashboard");
const ConfigStore = require("../src/lib/config").default;
const HostOps = require("../src/lib/hosts").default;
const RegistryStore = require("../src/lib/registry").default;
const Constants = require("../src/constants").default;

test.after(() => fs.rmSync(tmpHome, { recursive: true, force: true }));

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as any).port)));
}

function send(port: number, method: string, urlPath: string, headers: Record<string, string>, body?: string) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: urlPath, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

const get = (port: number, urlPath: string, host: string, extra: Record<string, string> = {}) => send(port, "GET", urlPath, { Host: host, ...extra });

test("http → https redirect in the router", async (t) => {
  const upstream = http.createServer((req, res) => res.end(`up ${req.url}`));
  const upstreamPort = await listen(upstream);
  const target = `http://127.0.0.1:${upstreamPort}`;
  const hosts = new Map<string, any>([
    ["app.localhost", { target, createdAt: "x", updatedAt: "x" }],
    ["always.localhost", { target, httpsRedirect: true, createdAt: "x", updatedAt: "x" }],
    ["never.localhost", { target, httpsRedirect: false, createdAt: "x", updatedAt: "x" }],
  ]);
  let global = false;
  const ctx = {
    proxy: httpProxy.createProxyServer({}),
    lookup: (host: string) => hosts.get(host),
    stats: new Map(),
    dashboard: (_req: any, res: http.ServerResponse) => res.end("DASH"),
    tunnelFor: (host: string) => (host === "abc.trycloudflare.com" ? "app.localhost" : undefined),
    httpsRedirect: () => global,
    httpsPort: () => 8443,
  };
  const front = http.createServer((req, res) => handleRequest(req, res, ctx));
  const port = await listen(front);
  t.after(() => {
    front.close();
    upstream.close();
  });

  await t.test("off by default: mappings follow the global setting and are served", async () => {
    global = false;
    assert.equal((await get(port, "/", "app.localhost")).status, 200);
    assert.equal((await get(port, "/", "localhost")).body, "DASH");
  });

  await t.test("a mapping's own on wins over global off", async () => {
    global = false;
    const r = await get(port, "/a/b?c=1", "always.localhost");
    assert.equal(r.status, 307);
    assert.equal(r.headers.location, "https://always.localhost:8443/a/b?c=1");
    assert.equal(r.headers["cache-control"], "no-store");
  });

  await t.test("global on redirects mappings and the dashboard, keeping the path", async () => {
    global = true;
    const r = await get(port, "/x?y=2", "app.localhost:8080");
    assert.equal(r.status, 307);
    assert.equal(r.headers.location, "https://app.localhost:8443/x?y=2");
    const dash = await get(port, "/", "localhost");
    assert.equal(dash.status, 307);
    assert.equal(dash.headers.location, "https://localhost:8443/");
  });

  await t.test("a mapping's own off wins over global on", async () => {
    global = true;
    assert.equal((await get(port, "/", "never.localhost")).status, 200);
  });

  await t.test("the dashboard API and health check stay on http for the CLI", async () => {
    global = true;
    assert.equal((await get(port, "/api/hosts", "localhost")).body, "DASH");
    assert.equal((await get(port, "/healthz", "localhost")).body, "DASH");
  });

  await t.test("tunnel traffic is never redirected", async () => {
    global = true;
    assert.equal((await get(port, "/", "abc.trycloudflare.com")).status, 200);
    assert.equal((await get(port, "/", "app.localhost", { "cf-ray": "123-AMS" })).status, 200);
  });

  await t.test("unmapped names get the not-found page, not a redirect", async () => {
    global = true;
    assert.equal((await get(port, "/", "nothing.localhost")).status, 502);
  });

  await t.test("the default https port is left out of the Location", async () => {
    global = true;
    ctx.httpsPort = () => 443;
    const r = await get(port, "/", "app.localhost");
    assert.equal(r.headers.location, "https://app.localhost/");
  });
});

test("ConfigStore merges instead of overwriting", () => {
  ConfigStore.write({ httpPort: 8080, httpsPort: 8443 });
  ConfigStore.write({ httpsRedirect: true });
  assert.deepEqual(ConfigStore.read(), { httpPort: 8080, httpsPort: 8443, httpsRedirect: true });
  assert.equal(ConfigStore.httpsRedirect(), true);
  ConfigStore.write({ httpsRedirect: undefined });
  assert.deepEqual(ConfigStore.read(), { httpPort: 8080, httpsPort: 8443 });
  assert.equal(ConfigStore.httpsRedirect(), false);
  fs.rmSync(Constants.paths.CONFIG_FILE);
});

test("HostOps keeps, sets and clears a mapping's httpsRedirect", async () => {
  await HostOps.add({ host: "r.localhost", target: "3000", httpsRedirect: false });
  assert.equal(RegistryStore.read().hosts["r.localhost"].httpsRedirect, false);
  await HostOps.update({ host: "r.localhost", target: "3001" });
  assert.equal(RegistryStore.read().hosts["r.localhost"].httpsRedirect, false, "update without the field keeps it");
  await HostOps.setHttpsRedirect({ host: "r.localhost", httpsRedirect: true });
  assert.equal(RegistryStore.read().hosts["r.localhost"].httpsRedirect, true);
  await HostOps.update({ host: "r.localhost", target: "3001", httpsRedirect: null });
  assert.ok(!("httpsRedirect" in RegistryStore.read().hosts["r.localhost"]) || RegistryStore.read().hosts["r.localhost"].httpsRedirect === undefined);
  await HostOps.remove({ host: "r.localhost" });
});

test("dashboard API: global and per-host httpsRedirect", async (t) => {
  const TOKEN = "b".repeat(64);
  let reloads = 0;
  const ctx = {
    getRegistry: () => RegistryStore.read(),
    getStats: () => ({}),
    proxyInfo: { pid: process.pid, version: "1.0.0", startedAt: new Date().toISOString(), httpPort: 8080, httpsPort: 8443, bind: ["127.0.0.1"], stateDir: tmpHome, caTrusted: true },
    probe: async () => ({ up: true, status: 200, ms: 1 }),
    token: TOKEN,
    reload: () => reloads++,
    refreshTrust: async () => {},
    shutdown: () => {},
    tunnel: () => ({ enabled: false, status: "off" as const }),
    retryTunnels: () => {},
    hub: () => ({ enabled: false, status: "off" as const }),
    reloadHub: () => {},
    setupNamedHub: () => {},
  };
  const server = http.createServer((req, res) => handleDashboardRequest(req, res, ctx));
  const port = await listen(server);
  t.after(() => server.close());
  const headers = { Host: "localhost", "x-locadot-token": TOKEN, "content-type": "application/json" };
  const json = async (method: string, urlPath: string, body?: unknown) => {
    const r = await send(port, method, urlPath, headers, body === undefined ? undefined : JSON.stringify(body));
    return { status: r.status, json: r.body ? JSON.parse(r.body) : undefined };
  };

  await t.test("PUT /api/settings toggles the global redirect without touching the ports", async () => {
    ConfigStore.write({ httpPort: 8080, httpsPort: 8443 });
    const on = await json("PUT", "/api/settings", { httpsRedirect: true });
    assert.equal(on.status, 200);
    assert.equal(on.json.httpsRedirect, true);
    assert.equal(on.json.restartRequired, false);
    assert.deepEqual(ConfigStore.read(), { httpPort: 8080, httpsPort: 8443, httpsRedirect: true });
    const off = await json("PUT", "/api/settings", { httpsRedirect: false });
    assert.equal(off.json.httpsRedirect, false);
    assert.equal((await json("GET", "/api/settings")).json.httpsRedirect, false);
    assert.equal((await json("PUT", "/api/settings", { httpsRedirect: "yes" })).status, 400);
    assert.equal((await json("PUT", "/api/settings", {})).status, 400);
  });

  await t.test("POST/PUT /api/hosts take httpsRedirect true, false or null", async () => {
    const created = await json("POST", "/api/hosts", { host: "api-r.localhost", target: "3000", httpsRedirect: true });
    assert.equal(created.status, 201);
    assert.equal(created.json.httpsRedirect, true);

    const only = await json("PUT", "/api/hosts/api-r.localhost", { httpsRedirect: false });
    assert.equal(only.status, 200);
    assert.equal(only.json.httpsRedirect, false);
    assert.equal(only.json.target, "http://localhost:3000", "flag-only change keeps the target");

    const rows = await json("GET", "/api/hosts");
    const row = (rows.json.hosts || rows.json).find((h: any) => h.host === "api-r.localhost");
    assert.equal(row.httpsRedirect, false);

    const cleared = await json("PUT", "/api/hosts/api-r.localhost", { target: "3001", httpsRedirect: null });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.json.httpsRedirect, undefined);
    assert.equal((await json("PUT", "/api/hosts/api-r.localhost", { httpsRedirect: "on" })).status, 400);
    await HostOps.remove({ host: "api-r.localhost" });
  });
});

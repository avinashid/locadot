import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const { handleDashboardRequest } = require("../src/dashboard");

const XSS_TARGET = "http://localhost:1<img src=x onerror=alert(1)>";

function makeCtx() {
  return {
    getRegistry: () => ({
      version: 2,
      hosts: {
        "b.localhost": { target: "http://localhost:3001", createdAt: "1", updatedAt: "1" },
        "a.localhost": { target: XSS_TARGET, createdAt: "2", updatedAt: "2" },
      },
    }),
    getStats: () => ({}),
    proxyInfo: {
      pid: 123,
      version: "1.0.0",
      startedAt: new Date(Date.now() - 5000).toISOString(),
      httpPort: 8080,
      httpsPort: 8443,
      bind: ["127.0.0.1"],
      stateDir: "/tmp/x",
    },
    probe: async () => ({ up: true, status: 200, ms: 1 }),
    token: "test-token",
    reload: () => {},
    refreshTrust: async () => {},
    shutdown: (_reason: string) => {},
    tunnel: () => ({ enabled: false, status: "off" as const }),
    retryTunnels: () => {},
  };
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as any).port)));
}

function request(port: number, method: string, urlPath: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: urlPath }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("dashboard", async (t) => {
  const ctx = makeCtx();
  const server = http.createServer((req, res) => handleDashboardRequest(req, res, ctx));
  const port = await listen(server);
  t.after(() => server.close());

  await t.test("GET / returns page with CSP nonce matching html attributes", async () => {
    const r = await request(port, "GET", "/");
    assert.equal(r.status, 200);
    const csp = String(r.headers["content-security-policy"]);
    const match = csp.match(/nonce-([^']+)'/);
    assert.ok(match, "CSP header should carry a nonce");
    const nonce = match![1];
    const nonceAttrs = [...r.body.matchAll(/nonce="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(nonceAttrs.length >= 2);
    for (const attr of nonceAttrs) assert.equal(attr, nonce);
  });

  await t.test("XSS payload in target is not present raw in HTML", async () => {
    const r = await request(port, "GET", "/");
    assert.ok(!r.body.includes(XSS_TARGET));
  });

  await t.test("/api/hosts sorted with probe + urls", async () => {
    const r = await request(port, "GET", "/api/hosts");
    assert.equal(r.status, 200);
    const rows = JSON.parse(r.body);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].host, "a.localhost");
    assert.equal(rows[1].host, "b.localhost");
    assert.ok(rows[0].urls.http && rows[0].urls.https);
    assert.deepEqual(rows[0].probe, { up: true, status: 200, ms: 1 });
  });

  await t.test("/api/status", async () => {
    const r = await request(port, "GET", "/api/status");
    assert.equal(r.status, 200);
    const data = JSON.parse(r.body);
    assert.equal(data.hosts, 2);
    assert.ok(data.uptimeSec >= 0);
    assert.equal(data.proxy.pid, 123);
  });

  await t.test("/healthz", async () => {
    const r = await request(port, "GET", "/healthz");
    assert.equal(r.status, 200);
    assert.equal(r.body, "ok");
  });

  await t.test("unknown route 404s", async () => {
    const r = await request(port, "GET", "/nope");
    assert.equal(r.status, 404);
  });

  await t.test("POST / is 405", async () => {
    const r = await request(port, "POST", "/");
    assert.equal(r.status, 405);
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.LOCADOT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-http-"));

const httpProxy = require("http-proxy");
const HttpModule = require("../src/lib/http").default;
const { hostOf, applyCors, originMap, rewriteOrigins } = require("../src/lib/http");

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve((server.address() as any).port));
  });
}

function get(port: number, urlPath: string, host: string): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: urlPath, headers: { Host: host } }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode!, body, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("http router", async (t) => {
  const upstream = http.createServer((req, res) => {
    if (req.url === "/redir") {
      res.writeHead(302, {
        Location: `http://127.0.0.1:${upstreamPort}/x`,
        "Set-Cookie": "a=1; Domain=127.0.0.1",
      });
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`${req.url}|${req.headers.host}`);
  });
  const upstreamPort = await listen(upstream);

  const lookupMap = new Map<string, any>([
    ["mapped.localhost", { target: `http://127.0.0.1:${upstreamPort}`, createdAt: "x", updatedAt: "x" }],
  ]);
  const ctx = {
    proxy: httpProxy.createProxyServer({}),
    lookup: (host: string) => lookupMap.get(host),
    stats: new Map<string, any>(),
    dashboard: (_req: any, res: http.ServerResponse) => res.end("DASH"),
  };
  const front = http.createServer((req, res) => HttpModule.requestHandler(req, res, ctx));
  const frontPort = await listen(front);

  t.after(() => {
    front.close();
    upstream.close();
  });

  await t.test("mapped host is proxied and stats increment", async () => {
    const r1 = await get(frontPort, "/hello", "mapped.localhost");
    assert.equal(r1.status, 200);
    assert.ok(r1.body.startsWith("/hello|"));
    const r2 = await get(frontPort, "/hello2", "mapped.localhost");
    assert.equal(r2.status, 200);
    const stats = ctx.stats.get("mapped.localhost");
    assert.ok(stats);
    assert.equal(stats.hits, 2);
  });

  await t.test("unmapped host returns escaped 502", async () => {
    const r = await get(frontPort, "/", "<script>evil.localhost");
    assert.equal(r.status, 502);
    assert.ok(r.body.includes("&lt;"));
    assert.ok(!r.body.includes("<script>evil"));
  });

  await t.test("dashboard host routes to dashboard", async () => {
    const r = await get(frontPort, "/", "localhost");
    assert.equal(r.status, 200);
    assert.equal(r.body, "DASH");
  });

  await t.test("redirect Location rewritten to request Host, cookie domain stripped", async () => {
    const r = await get(frontPort, "/redir", "mapped.localhost:1234");
    assert.equal(r.status, 302);
    assert.equal(r.headers.location, "http://mapped.localhost:1234/x");
    const cookie = String(r.headers["set-cookie"]);
    assert.ok(!/Domain=/i.test(cookie));
  });

  await t.test("upstream down returns 502 without crashing", async () => {
    const downServer = http.createServer();
    const downPort = await listen(downServer);
    await new Promise<void>((resolve) => downServer.close(() => resolve()));
    lookupMap.set("down.localhost", { target: `http://127.0.0.1:${downPort}`, createdAt: "x", updatedAt: "x" });
    const r = await get(frontPort, "/", "down.localhost");
    assert.equal(r.status, 502);
    assert.ok(r.body.includes("Upstream unreachable") || r.body.length > 0);
  });

  await t.test("upgrade to unmapped host is closed", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = http.request({
        host: "127.0.0.1",
        port: frontPort,
        path: "/",
        headers: { Host: "nope.localhost", Connection: "Upgrade", Upgrade: "websocket" },
      });
      req.on("upgrade", () => reject(new Error("should not upgrade")));
      req.on("response", () => resolve());
      req.on("close", () => resolve());
      req.on("error", () => resolve());
      req.end();
    });
  });
});

test("hostOf parses host header edge cases", () => {
  assert.equal(hostOf({ headers: { host: "[::1]:443" } } as any), "::1");
  assert.equal(hostOf({ headers: { host: "Dev.Localhost.:80" } } as any), "dev.localhost");
});

test("applyCors: replaces upstream CORS, keeps Vary, makes cookies cross-site on TLS", () => {
  const req = { headers: { origin: "https://localhost:5173" }, socket: { encrypted: true } } as any;
  const headers: http.IncomingHttpHeaders = {
    "access-control-allow-origin": "https://example.com",
    vary: "Accept-Encoding",
    "content-type": "application/json",
    "set-cookie": ["sid=1; Path=/; SameSite=Lax; Secure; HttpOnly", "a=2; Path=/"],
  };
  applyCors(req, headers);
  assert.equal(headers["access-control-allow-origin"], "https://localhost:5173");
  assert.equal(headers["access-control-allow-credentials"], "true");
  assert.equal(headers.vary, "Accept-Encoding, Origin");
  assert.equal(headers["access-control-expose-headers"], "content-type");
  assert.deepEqual(headers["set-cookie"], ["sid=1; Path=/; HttpOnly; SameSite=None; Secure", "a=2; Path=/; SameSite=None; Secure"]);

  const plain: http.IncomingHttpHeaders = { "set-cookie": ["a=1"] };
  applyCors({ headers: {}, socket: {} } as any, plain);
  assert.equal(plain["access-control-allow-origin"], "*");
  assert.equal(plain["access-control-allow-credentials"], undefined);
  assert.deepEqual(plain["set-cookie"], ["a=1"]);
});

test("rewriteOrigins: mapped origins become .localhost, plain and JSON-escaped, longest first", () => {
  const req = { headers: { host: "app.localhost" }, socket: { encrypted: true } } as any;
  const httpsPort = require("../src/constants").default.server.httpsPort;
  const p = httpsPort === 443 ? "" : `:${httpsPort}`;
  const pairs = originMap(req, {
    "other.localhost": { target: "https://example.com" },
    "app.localhost": { target: "https://example.com" },
    "api.app.localhost": { target: "https://api.example.com" },
  });
  const text = 'fetch(`https://api.example.com/v1`);"https:\\/\\/example.com\\/x";https://example.com.evil.net;https://EXAMPLE.com';
  assert.equal(
    rewriteOrigins(text, pairs),
    "fetch(`https://api.app.localhost" + p + "/v1`);\"https:\\/\\/app.localhost" + p + "\\/x\";https://example.com.evil.net;https://app.localhost" + p
  );
});

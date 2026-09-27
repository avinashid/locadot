import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawnSync } from "node:child_process";

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-settings-"));
process.env.LOCADOT_HOME = tmpHome;

const { handleDashboardRequest } = require("../src/dashboard");
const Constants = require("../src/constants").default;

test.after(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

const TOKEN = "a".repeat(64);

function makeCtx() {
  const ctx = {
    getRegistry: () => ({ version: 2, hosts: {} }),
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
    reload: () => {},
    refreshTrust: async () => {},
    shutdown: () => {},
    tunnel: () => ({ enabled: false, status: "off" as const }),
    retryTunnels: () => {},
    hub: () => ({ enabled: false, status: "off" as const }),
    reloadHub: () => {},
    setupNamedHub: (_domain: string, _tunnel?: string) => {},
  };
  return ctx;
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as any).port)));
}

interface Opts {
  headers?: Record<string, string>;
  body?: string;
}

function request(port: number, method: string, urlPath: string, opts: Opts = {}): Promise<{ status: number; json: any }> {
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
        resolve({ status: res.statusCode!, json });
      });
    });
    req.on("error", reject);
    req.end(opts.body);
  });
}

function authed(extra: Record<string, string> = {}): Record<string, string> {
  return { "x-locadot-token": TOKEN, "content-type": "application/json", ...extra };
}

test("dashboard settings api", async (t) => {
  const ctx = makeCtx();
  const server = http.createServer((req, res) => handleDashboardRequest(req, res, ctx));
  const port = await listen(server);
  t.after(() => server.close());

  await t.test("GET /api/settings has the right shape", async () => {
    const r = await request(port, "GET", "/api/settings");
    assert.equal(r.status, 200);
    const body = r.json;
    assert.equal(body.httpPort, 8080);
    assert.equal(body.httpsPort, 8443);
    assert.deepEqual(body.bind, ["127.0.0.1"]);
    assert.equal(typeof body.logLevel, "string");
    assert.equal(body.stateDir, tmpHome);
    assert.equal(typeof body.saved, "object");
    assert.equal(typeof body.env, "object");
    assert.equal(typeof body.env.httpPort, "boolean");
    assert.equal(typeof body.env.httpsPort, "boolean");
    assert.equal(typeof body.env.bind, "boolean");
    assert.equal(typeof body.restartRequired, "boolean");
  });

  await t.test("PUT /api/settings without token is rejected", async () => {
    const r = await request(port, "PUT", "/api/settings", { body: JSON.stringify({ httpPort: 9001 }) });
    assert.equal(r.status, 403);
  });

  await t.test("PUT /api/settings saves valid ports and reports restartRequired", async () => {
    const r = await request(port, "PUT", "/api/settings", {
      headers: authed(),
      body: JSON.stringify({ httpPort: 9001, httpsPort: 9002 }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.restartRequired, true);
    assert.equal(r.json.saved.httpPort, 9001);
    assert.equal(r.json.saved.httpsPort, 9002);

    const onDisk = JSON.parse(fs.readFileSync(Constants.paths.CONFIG_FILE, "utf8"));
    assert.equal(onDisk.httpPort, 9001);
    assert.equal(onDisk.httpsPort, 9002);
  });

  await t.test("PUT /api/settings rejects out-of-range ports", async () => {
    const low = await request(port, "PUT", "/api/settings", { headers: authed(), body: JSON.stringify({ httpPort: 0 }) });
    assert.equal(low.status, 400);
    const high = await request(port, "PUT", "/api/settings", { headers: authed(), body: JSON.stringify({ httpPort: 70000 }) });
    assert.equal(high.status, 400);
  });

  await t.test("PUT /api/settings rejects a non-numeric port", async () => {
    const r = await request(port, "PUT", "/api/settings", { headers: authed(), body: JSON.stringify({ httpPort: "8080" }) });
    assert.equal(r.status, 400);
  });

  await t.test("PUT /api/settings rejects equal http/https ports", async () => {
    const r = await request(port, "PUT", "/api/settings", {
      headers: authed(),
      body: JSON.stringify({ httpPort: 9100, httpsPort: 9100 }),
    });
    assert.equal(r.status, 400);
  });

  await t.test("PUT /api/settings rejects an empty body", async () => {
    const r = await request(port, "PUT", "/api/settings", { headers: authed(), body: JSON.stringify({}) });
    assert.equal(r.status, 400);
  });

  await t.test("PUT /api/settings warns when an env var overrides the saved port", async () => {
    process.env.LOCADOT_HTTP_PORT = "9500";
    try {
      const r = await request(port, "PUT", "/api/settings", { headers: authed(), body: JSON.stringify({ httpPort: 9200 }) });
      assert.equal(r.status, 200);
      assert.match(r.json.warning || "", /LOCADOT_HTTP_PORT/);
      assert.equal(r.json.env.httpPort, true);
    } finally {
      delete process.env.LOCADOT_HTTP_PORT;
    }
  });
});

// ---------------------------------------------------------------------------
// End-to-end: PUT new ports on a real running proxy, restart it, and confirm
// it comes back up on the new ports.
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "..");
const CLI = path.join(repoRoot, "dist", "index.js");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const p = (server.address() as any).port;
      server.close((err) => (err ? reject(err) : resolve(p)));
    });
    server.on("error", reject);
  });
}

function httpRequest(port: number, method: string, urlPath: string, headers: Record<string, string>, body?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: urlPath, headers, timeout: 5000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode!, body: data }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

async function waitUntil(predicate: () => Promise<boolean> | boolean, timeoutMs: number, intervalMs = 300): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return await predicate();
}

test("dashboard settings + restart e2e", { timeout: 60_000 }, async (t) => {
  const tmpHomeE2e = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-settings-e2e-"));
  const httpPort = await freePort();
  const httpsPort = await freePort();
  // No LOCADOT_HTTP_PORT/HTTPS_PORT env vars here on purpose: the CLI --port/--https-port
  // flags below save the ports to CONFIG_FILE instead, so a later restart with no flags
  // re-reads that file rather than an env override.
  const env = { ...process.env, LOCADOT_HOME: tmpHomeE2e };
  delete (env as Record<string, string | undefined>).LOCADOT_HTTP_PORT;
  delete (env as Record<string, string | undefined>).LOCADOT_HTTPS_PORT;

  const run = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { env, encoding: "utf8", timeout: 20_000 });
  const tokenFile = path.join(tmpHomeE2e, ".locadot-token");
  const lockFile = path.join(tmpHomeE2e, ".locadot.lock");

  t.after(async () => {
    run("kill");
    fs.rmSync(tmpHomeE2e, { recursive: true, force: true });
  });

  await t.test("start on isolated ports", async () => {
    const s = run("start", "--port", String(httpPort), "--https-port", String(httpsPort));
    assert.equal(s.status, 0, s.stderr + s.stdout);
    const ok = await waitUntil(() => fs.existsSync(tokenFile), 10_000);
    assert.ok(ok, "token file should appear after start");
  });

  await t.test("PUT new ports, POST restart, dashboard comes back on the new port", async () => {
    const token = fs.readFileSync(tokenFile, "utf8");
    const newHttpPort = await freePort();
    const newHttpsPort = await freePort();

    const put = await httpRequest(
      httpPort,
      "PUT",
      "/api/settings",
      { "content-type": "application/json", "x-locadot-token": token },
      JSON.stringify({ httpPort: newHttpPort, httpsPort: newHttpsPort })
    );
    assert.equal(put.status, 200, put.body);
    assert.equal(JSON.parse(put.body).restartRequired, true);

    const restart = await httpRequest(httpPort, "POST", "/api/proxy/restart", { "x-locadot-token": token });
    assert.equal(restart.status, 200, restart.body);

    const upOnNewPort = await waitUntil(async () => {
      try {
        const r = await httpRequest(newHttpPort, "GET", "/api/status", {});
        if (r.status !== 200) return false;
        const parsed = JSON.parse(r.body);
        return parsed.proxy?.httpPort === newHttpPort && parsed.proxy?.httpsPort === newHttpsPort;
      } catch {
        return false;
      }
    }, 15_000);
    assert.ok(upOnNewPort, "dashboard should answer on the new http port after restart");
  });
});

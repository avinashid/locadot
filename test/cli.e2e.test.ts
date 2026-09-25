import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(__dirname, "..");
const CLI = path.join(repoRoot, "dist", "index.js");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as any).port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on("error", reject);
  });
}

function httpGet(
  port: number,
  host: string,
  urlPath = "/",
  extra: { method?: string; headers?: Record<string, string> } = {}
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const options = { host: "127.0.0.1", port, path: urlPath, method: extra.method || "GET", headers: { Host: host, ...extra.headers }, timeout: 3000, agent: false };
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode!, body, headers: res.headers }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs: number, intervalMs = 100): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return predicate();
}

test("locadot CLI e2e", { timeout: 120_000 }, async (t) => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-cli-"));
  const httpPort = await freePort();
  const httpsPort = await freePort();
  const env = { ...process.env, LOCADOT_HOME: tmpHome, LOCADOT_HTTP_PORT: String(httpPort), LOCADOT_HTTPS_PORT: String(httpsPort) };

  const run = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { env, encoding: "utf8", timeout: 20_000 });

  const upstream = http.createServer((req, res) => {
    // Mimic Apache advertising h2c on a plain HTTP/1.1 response.
    if (req.url === "/hop") res.setHeader("Connection", "Upgrade, close"), res.setHeader("Upgrade", "h2,h2c");
    if (req.url === "/echo") {
      res.setHeader("Access-Control-Allow-Origin", "https://only-this.example");
      res.setHeader("X-Request-Id", "abc");
      return res.end(JSON.stringify({ method: req.method, origin: req.headers.origin, referer: req.headers.referer }));
    }
    res.end("upstream-ok");
  });
  const upstreamPort: number = await new Promise((resolve) => upstream.listen(0, "127.0.0.1", () => resolve((upstream.address() as any).port)));

  t.after(async () => {
    run("kill");
    await new Promise((resolve) => upstream.close(resolve));
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  await t.test("add: exit 0 and upstream reachable through the proxy", async () => {
    const r = run("add", "--host", "app.localhost", "--port", String(upstreamPort));
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const res = await httpGet(httpPort, "app.localhost");
    assert.equal(res.status, 200);
    assert.equal(res.body, "upstream-ok");
  });

  await t.test("upstream hop-by-hop headers are not forwarded", async () => {
    const res = await httpGet(httpPort, "app.localhost", "/hop");
    assert.equal(res.status, 200);
    assert.equal(res.headers.upgrade, undefined);
    assert.notEqual(res.headers.connection, "Upgrade, close");
  });

  await t.test("--cors: preflight answered, Origin/Referer rewritten, CORS headers replaced", async () => {
    const r = run("add", "--host", "api.localhost", "--port", String(upstreamPort), "--cors", "--no-start");
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const origin = "http://localhost:5173";
    const cors = async () => {
      for (let i = 0; i < 30; i++) {
        const pre = await httpGet(httpPort, "api.localhost", "/echo", {
          method: "OPTIONS",
          headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type,x-token" },
        });
        if (pre.status === 204) return pre;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.fail("registry reload did not pick up api.localhost");
    };
    const pre = await cors();
    assert.equal(pre.headers["access-control-allow-origin"], origin);
    assert.equal(pre.headers["access-control-allow-credentials"], "true");
    assert.equal(pre.headers["access-control-allow-methods"], "PUT");
    assert.equal(pre.headers["access-control-allow-headers"], "content-type,x-token");

    const res = await httpGet(httpPort, "api.localhost", "/echo", { headers: { Origin: origin, Referer: `${origin}/page?q=1` } });
    assert.equal(res.status, 200);
    const seen = JSON.parse(res.body);
    const upstreamOrigin = `http://localhost:${upstreamPort}`;
    assert.equal(seen.origin, upstreamOrigin);
    assert.equal(seen.referer, `${upstreamOrigin}/page?q=1`);
    assert.equal(res.headers["access-control-allow-origin"], origin);
    assert.match(String(res.headers["access-control-expose-headers"]), /x-request-id/);
    assert.match(String(res.headers.vary), /Origin/);
  });

  await t.test("without --cors, Origin passes through and OPTIONS reaches the upstream", async () => {
    const r = run("update", "--host", "api.localhost", "--port", String(upstreamPort), "--no-cors", "--no-start");
    assert.equal(r.status, 0, r.stderr + r.stdout);
    let res;
    for (let i = 0; i < 30; i++) {
      res = await httpGet(httpPort, "api.localhost", "/echo", { method: "OPTIONS", headers: { Origin: "http://x.test", "Access-Control-Request-Method": "PUT" } });
      if (res.status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(res!.status, 200);
    assert.equal(JSON.parse(res!.body).origin, "http://x.test");
    assert.equal(res!.headers["access-control-allow-origin"], "https://only-this.example");
    run("remove", "--host", "api.localhost");
  });

  await t.test("duplicate add exits 1", () => {
    const r = run("add", "--host", "app.localhost", "--port", String(upstreamPort));
    assert.equal(r.status, 1);
  });

  await t.test("--port abc exits 1", () => {
    const r = run("add", "--host", "bad.localhost", "--port", "abc");
    assert.equal(r.status, 1);
  });

  await t.test("bare localhost exits 1", () => {
    const r = run("add", "--host", "localhost", "--port", "3000");
    assert.equal(r.status, 1);
  });

  await t.test("list --json parses", () => {
    const r = run("list", "--json");
    assert.equal(r.status, 0, r.stderr);
    const rows = JSON.parse(r.stdout);
    assert.ok(Array.isArray(rows));
    assert.ok(rows.some((row: any) => row.host === "app.localhost"));
  });

  let firstPid = 0;
  await t.test("status --json reports running with a live pid", () => {
    const r = run("status", "--json");
    assert.equal(r.status, 0, r.stderr);
    const status = JSON.parse(r.stdout);
    assert.equal(status.running, true);
    assert.ok(Number.isInteger(status.pid));
    assert.ok(isAlive(status.pid));
    firstPid = status.pid;
  });

  await t.test("update unknown host exits 1", () => {
    const r = run("update", "--host", "unknown.localhost", "--port", "3000");
    assert.equal(r.status, 1);
  });

  await t.test("remove unknown host exits 1", () => {
    const r = run("remove", "--host", "unknown.localhost");
    assert.equal(r.status, 1);
  });

  await t.test("stop: exit 0 and pid gone within 6s", async () => {
    const r = run("stop");
    assert.equal(r.status, 0, r.stderr);
    const gone = await waitUntil(() => !isAlive(firstPid), 6_000);
    assert.ok(gone, `pid ${firstPid} should be gone within 6s`);
  });

  await t.test("stop again: exit 0, reports not running", () => {
    const r = run("stop");
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /not running/i);
  });

  let restartedPid = 0;
  await t.test("start then restart: new pid, old pid dead, still proxying", async () => {
    const s = run("start");
    assert.equal(s.status, 0, s.stderr);
    const status1 = JSON.parse(run("status", "--json").stdout);
    const pidBeforeRestart = status1.pid;

    const r = run("restart");
    assert.equal(r.status, 0, r.stderr);
    const status2 = JSON.parse(run("status", "--json").stdout);
    restartedPid = status2.pid;

    assert.notEqual(restartedPid, pidBeforeRestart);
    assert.ok(!isAlive(pidBeforeRestart), "old pid should be dead after restart");

    const res = await httpGet(httpPort, "app.localhost");
    assert.equal(res.status, 200);
    assert.equal(res.body, "upstream-ok");
  });

  await t.test("port conflict: start fails with 'already in use'", async () => {
    const stopResult = run("stop");
    assert.equal(stopResult.status, 0, stopResult.stderr);
    await waitUntil(() => !isAlive(restartedPid), 6_000);

    const occupier = net.createServer();
    await new Promise<void>((resolve, reject) => {
      occupier.on("error", reject);
      occupier.listen(httpsPort, "127.0.0.1", () => resolve());
    });

    try {
      const r = run("start");
      assert.equal(r.status, 1);
      assert.match(r.stdout + r.stderr, /already in use/i);
    } finally {
      await new Promise((resolve) => occupier.close(resolve));
    }
  });

  await t.test("legacy lock file with NaN or empty content doesn't crash status", () => {
    const lockFile = path.join(tmpHome, ".locadot.lock");
    fs.writeFileSync(lockFile, "NaN");
    let r = run("status", "--json");
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).running, false);

    fs.writeFileSync(lockFile, "");
    r = run("status", "--json");
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).running, false);

    fs.rmSync(lockFile, { force: true });
  });

  await t.test("kill: registry becomes empty", () => {
    const r = run("kill");
    assert.equal(r.status, 0, r.stderr);
    const list = JSON.parse(run("list", "--json").stdout);
    assert.deepEqual(list, []);
  });
});

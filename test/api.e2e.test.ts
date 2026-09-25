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

function httpGet(port: number, host: string, urlPath = "/"): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: urlPath, headers: { Host: host }, timeout: 3000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode!, body }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
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

async function waitUntil(predicate: () => boolean, timeoutMs: number, intervalMs = 100): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return predicate();
}

test("dashboard mutating API e2e", { timeout: 60_000 }, async (t) => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-api-e2e-"));
  const httpPort = await freePort();
  const httpsPort = await freePort();
  const env = { ...process.env, LOCADOT_HOME: tmpHome, LOCADOT_HTTP_PORT: String(httpPort), LOCADOT_HTTPS_PORT: String(httpsPort) };

  const run = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { env, encoding: "utf8", timeout: 20_000 });

  const upstream = http.createServer((_req, res) => res.end("upstream-ok"));
  const upstreamPort: number = await new Promise((resolve) => upstream.listen(0, "127.0.0.1", () => resolve((upstream.address() as any).port)));

  const tokenFile = path.join(tmpHome, ".locadot-token");

  t.after(async () => {
    run("kill");
    await new Promise((resolve) => upstream.close(resolve));
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  await t.test("start: proxy comes up and writes a 0600 token file", async () => {
    const s = run("start");
    assert.equal(s.status, 0, s.stderr + s.stdout);
    const ok = await waitUntil(() => fs.existsSync(tokenFile), 10_000);
    assert.ok(ok, "token file should appear after start");
    if (process.platform !== "win32") {
      const mode = fs.statSync(tokenFile).mode & 0o777;
      assert.equal(mode, 0o600);
    }
  });

  await t.test("POST /api/hosts over real HTTP, then the proxy routes the new host", async () => {
    const token = fs.readFileSync(tokenFile, "utf8");
    const res = await httpRequest(
      httpPort,
      "POST",
      "/api/hosts",
      { "content-type": "application/json", "x-locadot-token": token },
      JSON.stringify({ host: "x.localhost", target: upstreamPort })
    );
    assert.equal(res.status, 201, res.body);

    const proxied = await httpGet(httpPort, "x.localhost");
    assert.equal(proxied.status, 200);
    assert.equal(proxied.body, "upstream-ok");
  });

  await t.test("stop: proxy exits and removes the token file", async () => {
    const r = run("stop");
    assert.equal(r.status, 0, r.stderr);
    const gone = await waitUntil(() => !fs.existsSync(tokenFile), 6_000);
    assert.ok(gone, "token file should be removed on shutdown");
  });
});

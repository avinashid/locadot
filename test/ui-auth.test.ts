import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-ui-auth-"));
process.env.LOCADOT_HOME = tmpHome;

const { handleDashboardRequest } = require("../src/dashboard");
const RegistryStore = require("../src/lib/registry").default;
const Constants = require("../src/constants").default;
const UiAuth = require("../src/lib/ui-auth").default;

const CLI = path.join(__dirname, "..", "dist", "index.js");
const TOKEN = "c".repeat(64);

test.after(() => fs.rmSync(tmpHome, { recursive: true, force: true }));

const ctx = {
  getRegistry: () => RegistryStore.read(),
  getStats: () => ({}),
  proxyInfo: { pid: process.pid, version: "1.0.0", startedAt: new Date().toISOString(), httpPort: 8080, httpsPort: 8443, bind: ["127.0.0.1"], stateDir: tmpHome, caTrusted: true },
  probe: async () => ({ up: true, status: 200, ms: 1 }),
  token: TOKEN,
  reload: () => {},
  refreshTrust: async () => {},
  shutdown: () => {},
  tunnel: () => ({ enabled: false, status: "off" as const }),
  retryTunnels: () => {},
  hub: () => ({ enabled: false, status: "off" as const }),
  reloadHub: () => {},
  setupNamedHub: () => {},
};

function request(port: number, method: string, urlPath: string, headers: Record<string, string> = {}, body?: string) {
  return new Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders; json: any }>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: urlPath, headers: { Host: "localhost", ...headers } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let json: any;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({ status: res.statusCode!, body: data, headers: res.headers, json });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

const cookieFrom = (headers: http.IncomingHttpHeaders) => String(headers["set-cookie"]?.[0] || "").split(";")[0];

const login = (port: number, password: string, extra: Record<string, string> = {}) =>
  request(port, "POST", "/login", { "Content-Type": "application/x-www-form-urlencoded", ...extra }, `password=${encodeURIComponent(password)}`);

test("dashboard password", async (t) => {
  const server = http.createServer((req, res) => handleDashboardRequest(req, res, ctx));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  t.after(() => server.close());

  await t.test("off by default: the dashboard opens without signing in", async () => {
    const res = await request(port, "GET", "/");
    assert.equal(res.status, 200);
    assert.match(res.body, /locadot-token" content="c{64}"/);
    assert.equal((await request(port, "GET", "/api/settings")).json.uiAuth.enabled, false);
  });

  await t.test("ui:password --stdin stores only an scrypt hash, 0600", () => {
    const r = spawnSync(process.execPath, [CLI, "ui:password", "--stdin"], { env: { ...process.env, LOCADOT_HOME: tmpHome }, input: "hunter2hunter2\n", encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const raw = fs.readFileSync(Constants.paths.UI_AUTH_FILE, "utf8");
    assert.doesNotMatch(raw, /hunter2/);
    assert.ok(JSON.parse(raw).hash);
    if (process.platform !== "win32") assert.equal(fs.statSync(Constants.paths.UI_AUTH_FILE).mode & 0o777, 0o600);
  });

  await t.test("a short password is refused", () => {
    const r = spawnSync(process.execPath, [CLI, "ui:password", "--stdin"], { env: { ...process.env, LOCADOT_HOME: tmpHome }, input: "short\n", encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.ok(UiAuth.verify("hunter2hunter2"));
  });

  await t.test("signed out: the page is a login form and never carries the API token", async () => {
    const res = await request(port, "GET", "/");
    assert.equal(res.status, 200);
    assert.match(res.body, /action="\/login"/);
    assert.doesNotMatch(res.body, /c{64}/);
    assert.match(String(res.headers["content-security-policy"]), /form-action 'self'/);
    assert.equal((await request(port, "GET", "/hosts")).status, 303);
  });

  await t.test("signed out: API reads and writes are refused", async () => {
    for (const p of ["/api/status", "/api/hosts", "/api/settings", "/api/logs"]) {
      assert.equal((await request(port, "GET", p)).status, 401, p);
    }
    assert.equal((await request(port, "POST", "/api/hosts", { "Content-Type": "application/json" }, "{}")).status, 401);
  });

  await t.test("scripts with the API token are not affected", async () => {
    assert.equal((await request(port, "GET", "/api/status", { "X-Locadot-Token": TOKEN })).status, 200);
    assert.equal((await request(port, "GET", "/api/status", { "X-Locadot-Token": "x".repeat(64) })).status, 401);
    assert.equal((await request(port, "GET", "/healthz")).status, 200);
  });

  await t.test("signed out: the favicon still loads, and the login page links it", async () => {
    for (const p of ["/favicon.svg", "/favicon.ico"]) {
      const res = await request(port, "GET", p);
      assert.equal(res.status, 200, p);
      assert.equal(res.headers["content-type"], "image/svg+xml");
      assert.match(res.body, /^<svg [^>]*viewBox="0 0 64 64"/);
    }
    const page = await request(port, "GET", "/");
    assert.match(page.body, /<link rel="icon" type="image\/svg\+xml" href="\/favicon.svg">/);
    assert.match(String(page.headers["content-security-policy"]), /img-src 'self' data:/);
  });

  await t.test("a wrong password is refused, a cross-site post too", async () => {
    const bad = await login(port, "nope-nope-nope");
    assert.equal(bad.status, 401);
    assert.equal(bad.headers["set-cookie"], undefined);
    const cross = await login(port, "hunter2hunter2", { Origin: "https://evil.example" });
    assert.equal(cross.status, 403);
    assert.equal(cross.headers["set-cookie"], undefined);
  });

  let session = "";
  await t.test("the right password signs in with an HttpOnly, SameSite=Strict cookie", async () => {
    const res = await login(port, "hunter2hunter2");
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/");
    assert.match(String(res.headers["set-cookie"]), /HttpOnly; SameSite=Strict/);
    session = cookieFrom(res.headers);
    const page = await request(port, "GET", "/", { Cookie: session });
    assert.match(page.body, /locadot-token" content="c{64}"/);
    assert.match(page.body, /locadot-ui-auth" content="on"/);
    assert.equal((await request(port, "GET", "/api/settings", { Cookie: session })).json.uiAuth.enabled, true);
    assert.equal((await request(port, "GET", "/login", { Cookie: session })).status, 303);
  });

  await t.test("a forged or expired cookie is refused", async () => {
    const [exp] = session.split("=")[1].split(".");
    assert.equal((await request(port, "GET", "/api/status", { Cookie: `locadot_ui=${Number(exp) + 999}.${session.split(".")[1]}` })).status, 401);
    assert.equal(UiAuth.validSession(session.split("=")[1], Date.now() + 8 * 24 * 3600_000), false);
  });

  await t.test("changing it from the dashboard needs the current password and keeps you signed in", async () => {
    const put = (body: object) =>
      request(port, "PUT", "/api/settings/ui-password", { Cookie: session, "X-Locadot-Token": TOKEN, "Content-Type": "application/json" }, JSON.stringify(body));
    assert.equal((await put({ password: "brand-new-pass", current: "wrong-wrong" })).status, 403);
    assert.equal((await put({ password: "brand-new-pass" })).status, 403);
    const ok = await put({ password: "brand-new-pass", current: "hunter2hunter2" });
    assert.equal(ok.status, 200, ok.body);
    assert.equal((await request(port, "GET", "/api/status", { Cookie: session })).status, 401, "old sessions are signed out");
    session = cookieFrom(ok.headers);
    assert.equal((await request(port, "GET", "/api/status", { Cookie: session })).status, 200);
    assert.equal((await login(port, "hunter2hunter2")).status, 401);
  });

  await t.test("sign out clears the cookie", async () => {
    const res = await request(port, "POST", "/logout", { Cookie: session });
    assert.equal(res.status, 200);
    assert.match(String(res.headers["set-cookie"]), /Max-Age=0/);
  });

  await t.test("resetting from the terminal works without the old password", () => {
    const r = spawnSync(process.execPath, [CLI, "ui:password", "--stdin"], { env: { ...process.env, LOCADOT_HOME: tmpHome }, input: "reset-from-shell\n", encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(UiAuth.verify("reset-from-shell"));
    assert.ok(!UiAuth.verify("brand-new-pass"));
  });

  await t.test("ui:password --off opens the dashboard again", async () => {
    const r = spawnSync(process.execPath, [CLI, "ui:password", "--off"], { env: { ...process.env, LOCADOT_HOME: tmpHome }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!fs.existsSync(Constants.paths.UI_AUTH_FILE));
    assert.equal((await request(port, "GET", "/api/status")).status, 200);
  });

  await t.test("too many wrong passwords are rate limited", async () => {
    UiAuth.set("limit-me-please");
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await login(port, "wrong-" + i)).status;
    assert.equal(last, 429);
    assert.equal((await login(port, "limit-me-please")).status, 429);
  });
});

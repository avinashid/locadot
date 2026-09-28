import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { spawnSync } from "node:child_process";

// `hub:manual` stands in for the Cloudflare tunnel: a browser reaches the sender at http://hub.localhost:<port>.

const CLI = path.join(path.resolve(__dirname, ".."), "dist", "index.js");
const PASSWORD = "correct-horse-battery";

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as any).port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on("error", reject);
  });

const request = (
  port: number,
  host: string,
  urlPath = "/",
  extra: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: urlPath, method: extra.method || "GET", headers: { Host: host, ...extra.headers }, timeout: 5000, agent: false },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode!, body, headers: res.headers }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(extra.body);
  });

const waitFor = async (check: () => Promise<boolean>, ms = 10_000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
};

test("hub:panel: the dashboard at the hub's public URL, behind the dashboard password", { timeout: 120_000 }, async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-panel-"));
  const httpPort = await freePort();
  const httpsPort = await freePort();
  const env = { ...process.env, LOCADOT_HOME: home, LOCADOT_HTTP_PORT: String(httpPort), LOCADOT_HTTPS_PORT: String(httpsPort) };
  const run = (args: string[], input?: string) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { env, encoding: "utf8", timeout: 30_000, input });
    return { ...r, out: `${r.stdout}${r.stderr}` };
  };
  t.after(() => {
    run(["stop"]);
    fs.rmSync(home, { recursive: true, force: true });
  });

  const hubHost = `hub.localhost:${httpPort}`;
  const visit = (urlPath: string, extra: Parameters<typeof request>[3] = {}) =>
    request(httpPort, hubHost, urlPath, { ...extra, headers: { "Cf-Connecting-Ip": "203.0.113.7", ...extra.headers } });
  const localToken = () => fs.readFileSync(path.join(home, ".locadot-token"), "utf8").trim();
  const hubState = async () =>
    JSON.parse((await request(httpPort, "localhost", "/api/hub", { headers: { "X-Locadot-Token": localToken() } })).body);

  assert.equal(run(["start"]).status, 0, "start");
  assert.equal(run(["hub:manual", "--url", `http://${hubHost}`]).status, 0);
  assert.ok(await waitFor(async () => (await hubState()).hub.status === "up"), "hub comes up");

  let cookie = "";

  await t.test("off by default: a browser without peer credentials is refused", async () => {
    assert.equal((await visit("/")).status, 401);
    assert.equal((await hubState()).panel, false);
  });

  await t.test("can't be turned on without a dashboard password", async () => {
    const r = run(["hub:panel", "on"]);
    assert.notEqual(r.status, 0);
    assert.match(r.out, /dashboard password/i);
    assert.equal((await hubState()).panel, false);
  });

  await t.test("with a password it serves the sign-in page and nothing else", async () => {
    assert.equal(run(["ui:password", "--stdin"], `${PASSWORD}\n`).status, 0, "set password");
    const on = run(["hub:panel", "on"]);
    assert.equal(on.status, 0, on.out);
    assert.match(on.out, /shared/);

    const page = await visit("/");
    assert.equal(page.status, 200);
    assert.match(page.body, /password protected/);
    assert.ok(!page.body.includes(localToken()), "no API token before sign-in");
    assert.equal((await visit("/api/hub")).status, 401);
    assert.equal((await visit("/api/hosts")).status, 401);
  });

  await t.test("a wrong password is refused, the right one signs in", async () => {
    const post = (password: string) =>
      visit("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Sec-Fetch-Site": "same-origin" },
        body: new URLSearchParams({ password }).toString(),
      });
    assert.equal((await post("wrong-password")).status, 401);
    const ok = await post(PASSWORD);
    assert.equal(ok.status, 303);
    const set = String(ok.headers["set-cookie"]);
    assert.match(set, /locadot_ui=[^;]+; Path=\/; HttpOnly; SameSite=Strict/);
    cookie = set.split(";")[0];
  });

  await t.test("signed in, the dashboard works but never sees the local API token", async () => {
    const page = await visit("/", { headers: { Cookie: cookie } });
    assert.equal(page.status, 200);
    assert.match(page.body, /hub-panel-row/);
    assert.ok(!page.body.includes(localToken()), "the local API token stays on this machine");
    const hub = await visit("/api/hub", { headers: { Cookie: cookie } });
    assert.equal(hub.status, 200);
    assert.equal(JSON.parse(hub.body).panel, true);
  });

  await t.test("changes need the page's own origin and marker", async () => {
    const put = (origin: string) =>
      visit("/api/hub/localhost", {
        method: "PUT",
        headers: { Cookie: cookie, Origin: origin, "X-Locadot-Token": "hub-peer", "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
    assert.equal((await put("http://evil.example")).status, 403);
    assert.equal((await put("http://localhost")).status, 403);
    assert.equal((await put(`http://${hubHost}`)).status, 200);
    assert.equal((await hubState()).localhost, false);
  });

  await t.test("peers still authenticate as before", async () => {
    assert.equal((await visit("/", { headers: { "X-Locadot-Peer": "lnk_bogus" } })).status, 401);
  });

  await t.test("removing the password turns sharing off", async () => {
    assert.equal(run(["ui:password", "--off"]).status, 0);
    assert.equal((await hubState()).panel, false);
    assert.equal((await visit("/", { headers: { Cookie: cookie } })).status, 401);
  });
});

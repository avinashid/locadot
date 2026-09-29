import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { spawnSync } from "node:child_process";

// A sender and two receivers (admin, viewer) in separate state dirs. `hub:manual` stands in for the
// Cloudflare tunnel: the receiver reaches the sender at http://hub.localhost:<port>.

const CLI = path.join(path.resolve(__dirname, ".."), "dist", "index.js");

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
  extra: { method?: string; headers?: Record<string, string> } = {}
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
    req.end();
  });

const waitFor = async (check: () => Promise<boolean>, ms = 10_000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
};

async function machine(name: string) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `locadot-${name}-`));
  const httpPort = await freePort();
  const httpsPort = await freePort();
  const env = { ...process.env, LOCADOT_HOME: home, LOCADOT_HTTP_PORT: String(httpPort), LOCADOT_HTTPS_PORT: String(httpsPort) };
  const run = (...args: string[]) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { env, encoding: "utf8", timeout: 30_000 });
    return { ...r, out: `${r.stdout}${r.stderr}` };
  };
  const registry = () => JSON.parse(fs.readFileSync(path.join(home, ".locadot-registry.json"), "utf8")).hosts;
  return { home, httpPort, httpsPort, run, registry };
}


test("remote pass-through: a --cors page's localhost:<port> calls reach the sender's machine", { timeout: 120_000 }, async (t) => {
  // The app's API: not mapped, only on the sender's localhost, and it signs in with a cookie.
  const seen: http.IncomingHttpHeaders[] = [];
  const api = http.createServer((req, res) => {
    seen.push(req.headers);
    if (req.url === "/login") {
      res.writeHead(200, { "Set-Cookie": "sid=s3cret; Path=/; HttpOnly", "Content-Type": "application/json" });
      res.end("{}");
      return;
    }
    const signedIn = /(^|;\s*)sid=s3cret/.test(String(req.headers.cookie || ""));
    res.writeHead(signedIn ? 200 : 401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ token: signedIn ? "t0k" : null }));
  });
  const web = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<html><head></head><body></body></html>`);
  });
  await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
  await new Promise<void>((r) => web.listen(0, "127.0.0.1", r));
  const apiPort = (api.address() as any).port;
  const webPort = (web.address() as any).port;

  const sender = await machine("sender");
  const admin = await machine("admin");
  const viewer = await machine("viewer");
  t.after(() => {
    for (const m of [sender, admin, viewer]) {
      m.run("stop");
      fs.rmSync(m.home, { recursive: true, force: true });
    }
    api.close();
    web.close();
  });

  assert.equal(sender.run("add", "--host", "app.localhost", "--port", String(webPort), "--cors", "--no-start").status, 0);
  assert.equal(sender.run("start").status, 0, "sender start");
  assert.equal(sender.run("hub:manual", "--url", `http://hub.localhost:${sender.httpPort}`).status, 0);
  assert.ok(await waitFor(async () => JSON.parse((await request(sender.httpPort, "localhost", "/api/hub")).body).hub.status === "up"), "hub comes up");
  for (const [m, role] of [[admin, "admin"], [viewer, "viewer"]] as const) {
    assert.equal(m.run("start").status, 0);
    const link = sender.run("share", "--role", role, ...(role === "viewer" ? ["--hosts", "app.localhost"] : [])).out.match(/https?:\/\/\S+#lnk_[0-9a-f]+\.[\w-]+/)![0];
    const connected = m.run("connect", link, "--name", "snd");
    assert.equal(connected.status, 0, connected.out);
    assert.ok(await waitFor(async () => (await request(m.httpPort, "app.localhost")).status === 200), `${role} serves the mapping`);
  }

  const via = (m: { httpPort: number }, path: string, headers: Record<string, string> = {}) =>
    request(m.httpPort, `app.localhost:${m.httpPort}`, `/__locadot/x/http/localhost:${apiPort}${path}`, { headers: { "Sec-Fetch-Site": "same-origin", ...headers } });

  await t.test("the remote page gets the pass-through shim", async () => {
    const page = await request(admin.httpPort, "app.localhost");
    assert.match(page.body, /__locadot\/shim\.js/);
  });

  await t.test("an admin's page signs in and gets its token from the sender's localhost API", async () => {
    const login = await via(admin, "/login");
    assert.equal(login.status, 200);
    const cookie = String(login.headers["set-cookie"]?.[0] || "");
    assert.match(cookie, new RegExp(`^sid=s3cret;.*Path=/__locadot/x/http/localhost:${apiPort}`));
    const token = await via(admin, "/auth/token", { Cookie: "sid=s3cret" });
    assert.equal(token.status, 200);
    assert.equal(JSON.parse(token.body).token, "t0k");
    assert.equal(seen.at(-1)?.origin, `http://localhost:${webPort}`);
  });

  await t.test("a viewer can't reach the sender's localhost through the pass-through", async () => {
    const before = seen.length;
    const res = await via(viewer, "/auth/token");
    assert.equal(res.status, 403);
    assert.equal(seen.length, before);
  });

  await t.test("nobody reaches the sender's own proxy ports", async () => {
    const res = await request(admin.httpPort, `app.localhost:${admin.httpPort}`, `/__locadot/x/http/localhost:${sender.httpPort}/api/hosts`, {
      headers: { "Sec-Fetch-Site": "same-origin" },
    });
    assert.equal(res.status, 403);
  });

  await t.test("an address on the mapping's allow list opens it to a viewer, and only that address", async () => {
    const other = await freePort();
    assert.match(sender.run("allow", "--host", "app.localhost", `127.0.0.1:${apiPort}`).out, new RegExp(`localhost:${apiPort}`));
    assert.ok(await waitFor(async () => (await via(viewer, "/auth/token", { Cookie: "sid=s3cret" })).status === 200), "viewer reaches the allowed API");
    const blocked = await request(viewer.httpPort, `app.localhost:${viewer.httpPort}`, `/__locadot/x/http/localhost:${other}/`, {
      headers: { "Sec-Fetch-Site": "same-origin" },
    });
    assert.equal(blocked.status, 403);
    const crossSite = await via(viewer, "/auth/token", { "Sec-Fetch-Site": "cross-site" });
    assert.equal(crossSite.status, 403);
  });

  await t.test("allowing all of localhost still keeps the sender's own proxy ports shut", async () => {
    sender.run("allow", "--host", "app.localhost", "localhost");
    assert.ok(await waitFor(async () => (await via(viewer, "/auth/token", { Cookie: "sid=s3cret" })).status === 200));
    for (const port of [sender.httpPort, sender.httpsPort]) {
      const res = await request(viewer.httpPort, `app.localhost:${viewer.httpPort}`, `/__locadot/x/http/localhost:${port}/api/hosts`, {
        headers: { "Sec-Fetch-Site": "same-origin" },
      });
      assert.equal(res.status, 403, `port ${port}`);
    }
  });

  await t.test("clearing the allow list shuts the viewer out again", async () => {
    assert.match(sender.run("allow", "--host", "app.localhost", "--clear").out, /public hosts only/);
    assert.ok(await waitFor(async () => (await via(viewer, "/auth/token")).status === 403));
  });

  await t.test("a stopped API is a 503 with locadot's page, which Cloudflare passes through", async () => {
    const down = await freePort();
    const res = await request(admin.httpPort, `app.localhost:${admin.httpPort}`, `/__locadot/x/http/localhost:${down}/auth/token`, {
      headers: { "Sec-Fetch-Site": "same-origin" },
    });
    assert.equal(res.status, 503);
    assert.match(res.body, new RegExp(`localhost:${down}`));
    assert.match(res.body, /ECONNREFUSED/);
  });
});

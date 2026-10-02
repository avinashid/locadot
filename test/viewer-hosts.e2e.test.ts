import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { spawnSync } from "node:child_process";

// A sender changes which hosts a viewer peer sees; the viewer's proxy picks it up by syncing when an
// unmapped name is requested. Same two-machine setup as remote.e2e.test.ts (`hub:manual` for the tunnel).

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
  return { home, httpPort, run, registry };
}

test("viewer hosts: the sender reassigns them, the viewer syncs on an unknown name", { timeout: 120_000 }, async (t) => {
  const upstream = http.createServer((req, res) => res.end(`sender app ${req.headers.host} ${req.url}`));
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  const upPort = (upstream.address() as any).port;

  const sender = await machine("vh-sender");
  const viewer = await machine("vh-viewer");
  t.after(() => {
    sender.run("stop");
    viewer.run("stop");
    upstream.close();
    fs.rmSync(sender.home, { recursive: true, force: true });
    fs.rmSync(viewer.home, { recursive: true, force: true });
  });

  const hubHost = "hub.localhost";
  for (const host of ["app.localhost", "extra.localhost"]) {
    assert.equal(sender.run("add", "--host", host, "--port", String(upPort), "--no-start").status, 0);
  }
  assert.equal(sender.run("start").status, 0, "sender start");
  assert.equal(sender.run("hub:manual", "--url", `http://${hubHost}:${sender.httpPort}`).status, 0);
  assert.ok(
    await waitFor(async () => JSON.parse((await request(sender.httpPort, "localhost", "/api/hub")).body).hub.status === "up"),
    "hub comes up"
  );
  assert.equal(viewer.run("start").status, 0, "viewer start");

  const shared = sender.run("share", "--role", "viewer", "--hosts", "app.localhost");
  const pairing = shared.out.match(/https?:\/\/\S+#lnk_[0-9a-f]+\.[\w-]+/);
  assert.ok(pairing, shared.out);
  const connected = viewer.run("connect", pairing[0], "--name", "alice");
  assert.equal(connected.status, 0, connected.out);
  assert.deepEqual(Object.keys(viewer.registry()).sort(), ["app.localhost"]);
  const peerId = JSON.parse(sender.run("peers", "--json").stdout).peers[0].id;

  await t.test("a name not shared yet: the viewer syncs, then explains, with Sync again", async () => {
    const res = await request(viewer.httpPort, "extra.localhost", "/");
    assert.equal(res.status, 502);
    assert.match(res.body, /<code>alice<\/code>: synced, nothing new/);
    assert.match(res.body, /locadot-sync=1">🔄 Sync again/);
  });

  await t.test("peers:hosts --add: the next visit syncs and lands on the app", async () => {
    const r = sender.run("peers:hosts", peerId, "--add", "extra.localhost");
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /now sees app\.localhost, extra\.localhost/);
    // "Sync again" forces a sync even right after the last one (after a short gap).
    await new Promise((r) => setTimeout(r, 2100));
    const again = await request(viewer.httpPort, "extra.localhost", "/page?locadot-sync=1");
    assert.equal(again.status, 307, again.body);
    assert.equal(again.headers.location, "/page");
    const page = await request(viewer.httpPort, "extra.localhost", "/page");
    assert.equal(page.status, 200);
    assert.match(page.body, /^sender app \S+ \/page$/);
  });

  await t.test("peers:hosts --remove: the sender refuses at once, and the viewer's sync unmaps it", async () => {
    assert.equal(sender.run("peers:hosts", peerId, "--remove", "extra.localhost").status, 0);
    assert.notEqual((await request(viewer.httpPort, "extra.localhost", "/")).status, 200, "denied before the viewer even syncs");
    const synced = viewer.run("remote:sync", "alice");
    assert.equal(synced.status, 0, synced.out);
    assert.match(synced.out, /- https?:\/\/extra\.localhost\S*\s+\(no longer shared\)/);
    assert.deepEqual(Object.keys(viewer.registry()).sort(), ["app.localhost"]);
  });

  await t.test("peers:hosts with no change prints the list; editors have none", () => {
    assert.match(sender.run("peers:hosts", peerId).out, /: app\.localhost/);
    assert.equal(sender.run("peers:role", peerId, "editor").status, 0);
    assert.match(sender.run("peers:hosts", peerId).out, /is editor and sees every host/);
    assert.notEqual(sender.run("peers:hosts", peerId, "--add", "x.localhost").status, 0);
  });
});

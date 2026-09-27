import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { spawnSync } from "node:child_process";

// Two real proxies (sender + receiver) in separate state dirs. `hub:manual` stands in for the
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
  return { home, httpPort, run, registry };
}

test("remote access: sender shares, receiver connects and browses", { timeout: 120_000 }, async (t) => {
  const seen: http.IncomingHttpHeaders[] = [];
  const upstream = http.createServer((req, res) => {
    seen.push(req.headers);
    if (req.url === "/redirect") {
      res.writeHead(302, { Location: `http://${req.headers.host}/landed` });
      res.end();
      return;
    }
    res.end(`sender app ${req.url}`);
  });
  const local = http.createServer((_req, res) => res.end("receiver's own app"));
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  await new Promise<void>((r) => local.listen(0, "127.0.0.1", r));
  const upPort = (upstream.address() as any).port;
  const localPort = (local.address() as any).port;

  const sender = await machine("sender");
  const receiver = await machine("receiver");
  t.after(() => {
    sender.run("stop");
    receiver.run("stop");
    upstream.close();
    local.close();
    fs.rmSync(sender.home, { recursive: true, force: true });
    fs.rmSync(receiver.home, { recursive: true, force: true });
  });

  const hubHost = "hub.localhost";
  assert.equal(sender.run("add", "--host", "app.localhost", "--port", String(upPort), "--no-start").status, 0);
  assert.equal(sender.run("add", "--host", "secret.localhost", "--port", String(upPort), "--no-start").status, 0);
  assert.equal(sender.run("start").status, 0, "sender start");
  const manual = sender.run("hub:manual", "--url", `http://${hubHost}:${sender.httpPort}`);
  assert.equal(manual.status, 0, manual.out);
  assert.ok(
    await waitFor(async () => JSON.parse((await request(sender.httpPort, "localhost", "/api/hub")).body).hub.status === "up"),
    "hub comes up"
  );

  assert.equal(receiver.run("add", "--host", "app.localhost", "--port", String(localPort), "--no-start").status, 0);
  assert.equal(receiver.run("start").status, 0, "receiver start");

  const pairing = (role: string, ...extra: string[]) => {
    const r = sender.run("share", "--role", role, ...extra);
    assert.equal(r.status, 0, r.out);
    const match = r.out.match(/https?:\/\/\S+#lnk_[0-9a-f]+\.[\w-]+/);
    assert.ok(match, `pairing string in: ${r.out}`);
    return match[0];
  };

  await t.test("the hub refuses anything without a valid peer token", async () => {
    assert.equal((await request(sender.httpPort, hubHost, "/")).status, 401);
    assert.equal((await request(sender.httpPort, hubHost, "/_locadot/v1/hosts")).status, 401);
    const forged = await request(sender.httpPort, hubHost, "/", { headers: { Authorization: "Bearer lpt_x.y", "X-Locadot-Host": "app.localhost" } });
    assert.equal(forged.status, 401);
    const dashboard = await request(sender.httpPort, hubHost, "/api/hub");
    assert.notEqual(dashboard.status, 200, "the dashboard is never reachable through the hub");
  });

  const editorString = pairing("editor");

  await t.test("connect imports hosts, renaming the one that clashes", async () => {
    const r = receiver.run("connect", editorString, "--name", "alice");
    assert.equal(r.status, 0, r.out);
    const hosts = receiver.registry();
    assert.equal(hosts["app.localhost"].target, `http://localhost:${localPort}`, "receiver's own mapping untouched");
    assert.deepEqual(hosts["app.alice.localhost"].remote, { name: "alice", host: "app.localhost" });
    assert.deepEqual(hosts["secret.localhost"].remote, { name: "alice", host: "secret.localhost" });
  });

  await t.test("a pairing string works once", async () => {
    const again = receiver.run("connect", editorString, "--name", "again");
    assert.notEqual(again.status, 0, again.out);
  });

  await t.test("traffic goes receiver → sender → sender's app, without leaking credentials", async () => {
    seen.length = 0;
    const res = await request(receiver.httpPort, "app.alice.localhost", "/hello");
    assert.equal(res.status, 200, res.body);
    assert.equal(res.body, "sender app /hello");
    assert.equal(seen.length, 1);
    assert.equal(seen[0].authorization, undefined);
    assert.ok(!Object.keys(seen[0]).some((h) => h.startsWith("x-locadot-")), "x-locadot-* headers stripped");
    assert.equal((await request(receiver.httpPort, "app.localhost", "/")).body, "receiver's own app");
  });

  await t.test("redirects land back on the receiver's local name", async () => {
    const res = await request(receiver.httpPort, "app.alice.localhost", "/redirect");
    assert.equal(res.status, 302);
    assert.match(String(res.headers.location), /^http:\/\/app\.alice\.localhost(:\d+)?\/landed$/);
  });

  await t.test("an editor can add a host on the sender but not delete one", async () => {
    const add = receiver.run("remote:add", "alice", "--host", "new.localhost", "--target", String(upPort));
    assert.equal(add.status, 0, add.out);
    assert.equal(sender.registry()["new.localhost"].target, `http://localhost:${upPort}`);
    assert.deepEqual(receiver.registry()["new.localhost"].remote, { name: "alice", host: "new.localhost" });
    assert.ok(await waitFor(async () => (await request(receiver.httpPort, "new.localhost", "/n")).body === "sender app /n"));
    const rm = receiver.run("remote:rm", "alice", "new.localhost");
    assert.notEqual(rm.status, 0, rm.out);
    assert.ok(sender.registry()["new.localhost"], "still there");
  });

  await t.test("the sender can promote the peer, then revoke it", async () => {
    const peers = JSON.parse(sender.run("peers", "--json").stdout);
    const list = Array.isArray(peers) ? peers : peers.peers;
    const id = list.find((p: any) => p.role === "editor").id;
    assert.equal(sender.run("peers:role", id, "admin").status, 0);
    const rm = receiver.run("remote:rm", "alice", "new.localhost");
    assert.equal(rm.status, 0, rm.out);
    assert.equal(sender.registry()["new.localhost"], undefined);

    assert.equal(sender.run("peers:revoke", id).status, 0);
    assert.equal((await request(receiver.httpPort, "app.alice.localhost", "/")).status, 401);
  });

  await t.test("a viewer sees only the hosts picked on the invite", async () => {
    const r = receiver.run("connect", pairing("viewer", "--hosts", "app.localhost"), "--name", "bob");
    assert.equal(r.status, 0, r.out);
    const hosts = receiver.registry();
    assert.deepEqual(hosts["app.bob.localhost"].remote, { name: "bob", host: "app.localhost" });
    assert.ok(!Object.values(hosts).some((h: any) => h.remote?.name === "bob" && h.remote.host === "secret.localhost"));
    const add = receiver.run("remote:add", "bob", "--host", "x.localhost", "--target", String(upPort));
    assert.notEqual(add.status, 0, "viewers can't write");
  });

  await t.test("disconnect removes the remote's local names", async () => {
    assert.equal(receiver.run("disconnect", "bob").status, 0);
    assert.ok(!Object.values(receiver.registry()).some((h: any) => h.remote?.name === "bob"));
  });
});

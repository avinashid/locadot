import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { spawnSync } from "node:child_process";

// Admin peers reach any port on the sender's localhost via <port>.<domain>.localhost on the receiver.
// Same setup as remote.e2e: two real proxies, `hub:manual` standing in for the Cloudflare tunnel.

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

test("remote localhost: an admin reaches any port on the sender", { timeout: 120_000 }, async (t) => {
  const seen: http.IncomingHttpHeaders[] = [];
  const service = http.createServer((req, res) => {
    seen.push(req.headers);
    if (req.url === "/redirect") {
      res.writeHead(302, { Location: `http://${req.headers.host}/landed` });
      res.end();
      return;
    }
    res.end(`private ${req.url}`);
  });
  await new Promise<void>((r) => service.listen(0, "127.0.0.1", r));
  const port = (service.address() as any).port;

  const sender = await machine("sender");
  const receiver = await machine("receiver");
  t.after(() => {
    sender.run("stop");
    receiver.run("stop");
    service.close();
    fs.rmSync(sender.home, { recursive: true, force: true });
    fs.rmSync(receiver.home, { recursive: true, force: true });
  });

  const hubHost = "hub.localhost";
  assert.equal(sender.run("start").status, 0, "sender start");
  const manual = sender.run("hub:manual", "--url", `http://${hubHost}:${sender.httpPort}`);
  assert.equal(manual.status, 0, manual.out);
  assert.ok(
    await waitFor(async () => JSON.parse((await request(sender.httpPort, "localhost", "/api/hub")).body).hub.status === "up"),
    "hub comes up"
  );
  assert.equal(receiver.run("start").status, 0, "receiver start");

  const pairing = (role: string) => {
    const r = sender.run("share", "--role", role);
    assert.equal(r.status, 0, r.out);
    const match = r.out.match(/https?:\/\/\S+#lnk_[0-9a-f]+\.[\w-]+/);
    assert.ok(match, `pairing string in: ${r.out}`);
    return match[0];
  };
  const remotes = () => JSON.parse(fs.readFileSync(path.join(receiver.home, ".locadot-remotes.json"), "utf8")).remotes;

  await t.test("an admin connects with a chosen domain", async () => {
    const r = receiver.run("connect", pairing("admin"), "--name", "carol", "--domain", "office");
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /office\.localhost/);
    assert.equal(remotes().carol.domain, "office");
  });

  await t.test("<domain>.localhost is a landing page", async () => {
    const res = await request(receiver.httpPort, "office.localhost", "/");
    assert.equal(res.status, 200);
    assert.match(res.body, /PORT\.office\.localhost/);
  });

  await t.test("<port>.<domain>.localhost reaches the sender's localhost:<port>, unmapped", async () => {
    seen.length = 0;
    const res = await request(receiver.httpPort, `${port}.office.localhost`, "/hello");
    assert.equal(res.status, 200, res.body);
    assert.equal(res.body, "private /hello");
    assert.equal(seen[0].host, `localhost:${port}`);
    assert.ok(!Object.keys(seen[0]).some((h) => h.startsWith("x-locadot-")), "x-locadot-* headers stripped");
  });

  await t.test("redirects land back on the receiver's name", async () => {
    const res = await request(receiver.httpPort, `${port}.office.localhost`, "/redirect");
    assert.equal(res.status, 302);
    assert.match(String(res.headers.location), new RegExp(`^http://${port}\\.office\\.localhost(:\\d+)?/landed$`));
  });

  await t.test("tunnel traffic (Cf-* headers) can't use <domain>.localhost", async () => {
    for (const h of ["office.localhost", `${port}.office.localhost`]) {
      const res = await request(receiver.httpPort, h, "/hello", { headers: { "Cf-Ray": "x", "Cf-Connecting-Ip": "203.0.113.9" } });
      assert.equal(res.status, 502);
      assert.doesNotMatch(res.body, /private/);
    }
  });

  await t.test("a crafted Host port can't break out of the landing page script", async () => {
    const res = await request(receiver.httpPort, 'office.localhost:1"</script><script>alert(1)//', "/");
    assert.doesNotMatch(res.body, /<script>alert/);
  });

  await t.test("the sender's own proxy ports are refused", async () => {
    assert.equal((await request(receiver.httpPort, `${sender.httpPort}.office.localhost`, "/api/hub")).status, 403);
  });

  await t.test("the sender can turn it off and on", async () => {
    assert.equal(sender.run("hub:localhost", "off").status, 0);
    assert.equal((await request(receiver.httpPort, `${port}.office.localhost`, "/")).status, 403);
    assert.equal(sender.run("hub:localhost", "on").status, 0);
    assert.equal((await request(receiver.httpPort, `${port}.office.localhost`, "/")).status, 200);
  });

  await t.test("the domain can be renamed", async () => {
    const r = receiver.run("remote:domain", "carol", "lab");
    assert.equal(r.status, 0, r.out);
    assert.equal((await request(receiver.httpPort, `${port}.lab.localhost`, "/")).body, "private /");
    assert.equal((await request(receiver.httpPort, `${port}.office.localhost`, "/")).status, 502, "old name is gone");
  });

  await t.test("without --domain an admin gets two random words", async () => {
    const r = receiver.run("connect", pairing("admin"), "--name", "dave");
    assert.equal(r.status, 0, r.out);
    const domain = remotes().dave.domain;
    assert.match(domain, /^[a-z]+-[a-z]+\d*$/);
    assert.equal((await request(receiver.httpPort, `${port}.${domain}.localhost`, "/r")).body, "private /r");
  });

  await t.test("an editor gets no domain, and a demoted admin is refused by the sender", async () => {
    const r = receiver.run("connect", pairing("editor"), "--name", "erin", "--domain", "nope");
    assert.equal(r.status, 0, r.out);
    assert.equal(remotes().erin.domain, undefined);

    const peers = JSON.parse(sender.run("peers", "--json").stdout);
    const list = Array.isArray(peers) ? peers : peers.peers;
    const carol = list.find((p: any) => p.id === remotes().carol.peerId);
    assert.equal(sender.run("peers:role", carol.id, "editor").status, 0);
    assert.equal((await request(receiver.httpPort, `${port}.lab.localhost`, "/")).status, 403);
  });
});

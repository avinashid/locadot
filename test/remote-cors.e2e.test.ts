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

test("remote cors: a shared --cors mapping is --cors on the receiver too", { timeout: 120_000 }, async (t) => {
  const seen: http.IncomingHttpHeaders[] = [];
  const api = http.createServer((req, res) => {
    seen.push(req.headers);
    if (req.method === "OPTIONS") {
      res.writeHead(405);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json", "X-Api": "yes" });
    res.end(JSON.stringify({ ok: true }));
  });
  let apiPort = 0;
  let webPort = 0;
  const web = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<html><head></head><body><script>fetch("http://localhost:${apiPort}/data"); location.href = "http://localhost:${webPort}/self";</script></body></html>`);
  });
  await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
  await new Promise<void>((r) => web.listen(0, "127.0.0.1", r));
  apiPort = (api.address() as any).port;
  webPort = (web.address() as any).port;

  const sender = await machine("sender");
  const receiver = await machine("receiver");
  t.after(() => {
    sender.run("stop");
    receiver.run("stop");
    api.close();
    web.close();
    fs.rmSync(sender.home, { recursive: true, force: true });
    fs.rmSync(receiver.home, { recursive: true, force: true });
  });

  const hubHost = "hub.localhost";
  assert.equal(sender.run("add", "--host", "api.localhost", "--port", String(apiPort), "--cors", "--no-start").status, 0);
  assert.equal(sender.run("add", "--host", "web.localhost", "--port", String(webPort), "--cors", "--no-start").status, 0);
  assert.equal(sender.run("add", "--host", "plain.localhost", "--port", String(apiPort), "--no-start").status, 0);
  assert.equal(sender.run("start").status, 0, "sender start");
  const manual = sender.run("hub:manual", "--url", `http://${hubHost}:${sender.httpPort}`);
  assert.equal(manual.status, 0, manual.out);
  assert.ok(
    await waitFor(async () => JSON.parse((await request(sender.httpPort, "localhost", "/api/hub")).body).hub.status === "up"),
    "hub comes up"
  );
  // Taken here, so the sender's api.localhost gets another local name on the receiver.
  assert.equal(receiver.run("add", "--host", "api.localhost", "--port", "9", "--no-start").status, 0);
  assert.equal(receiver.run("start").status, 0, "receiver start");

  const shared = sender.run("share", "--role", "admin");
  const link = shared.out.match(/https?:\/\/\S+#lnk_[0-9a-f]+\.[\w-]+/)![0];
  const connected = receiver.run("connect", link, "--name", "carol", "--domain", "office");
  assert.equal(connected.status, 0, connected.out);
  const localName = (host: string) => Object.entries(receiver.registry()).find(([, h]: any) => h.remote?.host === host)![0];
  const apiLocal = localName("api.localhost");
  const plainLocal = localName("plain.localhost");
  const rp = receiver.httpPort;
  const origin = `http://web.localhost:${rp}`;
  assert.ok(await waitFor(async () => (await request(rp, "web.localhost")).status === 200), "receiver serves the remote mapping");

  await t.test("the receiver's mappings inherit --cors", () => {
    const hosts = receiver.registry();
    assert.equal(apiLocal, "api.carol.localhost");
    assert.equal(hosts[apiLocal].cors, true);
    assert.equal(hosts["web.localhost"].cors, true);
    assert.equal(hosts[plainLocal].cors, undefined);
    assert.match(receiver.run("list").out, /api\.carol\.localhost.*\(cors\)/);
  });

  await t.test("the page's API origins become the receiver's names, not the sender's", async () => {
    const res = await request(rp, "web.localhost");
    assert.match(res.body, new RegExp(`"http://api\\.carol\\.localhost:${rp}/data"`));
    assert.match(res.body, new RegExp(`"http://web\\.localhost:${rp}/self"`));
    assert.doesNotMatch(res.body, new RegExp(`:${sender.httpPort}|localhost:${apiPort}`));
  });

  await t.test("a preflight from the page is answered", async () => {
    const res = await request(rp, apiLocal, "/data", {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers["access-control-allow-origin"], origin);
    assert.equal(res.headers["access-control-allow-methods"], "PUT");
    assert.equal(res.headers["access-control-allow-headers"], "content-type");
  });

  await t.test("the call carries CORS headers and reaches the API as the page's real origin", async () => {
    const res = await request(rp, apiLocal, "/data", { headers: { Origin: origin, Referer: `${origin}/app` } });
    assert.equal(res.status, 200);
    assert.equal(res.headers["access-control-allow-origin"], origin);
    assert.equal(res.headers["access-control-allow-credentials"], "true");
    assert.equal(seen.at(-1)?.origin, `http://localhost:${webPort}`);
    assert.equal(seen.at(-1)?.referer, `http://localhost:${webPort}/app`);
  });

  await t.test("<port>.<domain>.localhost gets the cors of the mapping on that port", async () => {
    const host = `${apiPort}.office.localhost`;
    const preflight = await request(rp, host, "/data", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "DELETE" } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], origin);
    const res = await request(rp, host, "/data", { headers: { Origin: origin } });
    assert.equal(res.headers["access-control-allow-origin"], origin);
    const page = await request(rp, `${webPort}.office.localhost:${rp}`);
    assert.match(page.body, new RegExp(`"http://${webPort}\\.office\\.localhost:${rp}/self"`));
  });

  await t.test("a mapping without --cors stays without", async () => {
    const res = await request(rp, plainLocal, "/data", { headers: { Origin: origin } });
    assert.equal(res.status, 200);
    assert.equal(res.headers["access-control-allow-origin"], undefined);
  });

  await t.test("turning --cors off on the sender reaches the receiver on sync", async () => {
    assert.equal(sender.run("update", "--host", "api.localhost", "--port", String(apiPort), "--no-cors").status, 0);
    const r = receiver.run("remote:sync", "carol");
    assert.equal(r.status, 0, r.out);
    assert.equal(receiver.registry()[apiLocal].cors, undefined);
  });
});

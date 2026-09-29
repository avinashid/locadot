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

type Res = { status: number; body: string; headers: http.IncomingHttpHeaders };

function request(port: number, host: string, urlPath: string, opts: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, method: opts.method || "GET", path: urlPath, headers: { Host: host, ...opts.headers }, timeout: 5000 },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode!, body, headers: res.headers }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(opts.body);
  });
}

const login = (port: number, host: string, password: string, next = "/") =>
  request(port, host, "/__locadot/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password, next }).toString(),
  });

function upgradeStatus(port: number, host: string, cookie?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port,
      path: "/ws",
      headers: { Host: host, Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==", ...(cookie ? { Cookie: cookie } : {}) },
      timeout: 5000,
    });
    req.on("upgrade", (res, socket) => (socket.destroy(), resolve(res.statusCode!)));
    req.on("response", (res) => (res.resume(), resolve(res.statusCode!)));
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function eventually<T>(fn: () => Promise<T>, ok: (value: T) => boolean, timeoutMs = 8000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await fn();
  while (!ok(value) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
    value = await fn();
  }
  return value;
}

test("locadot protect: a password on the paths picked, a signed cookie, nothing upstream", { timeout: 90_000 }, async (t) => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-protect-"));
  const fake = path.join(tmpHome, "fake-cloudflared.js");
  fs.writeFileSync(
    fake,
    `#!${process.execPath}\nif (process.argv.includes("--version")) { console.log("cloudflared version 2099.1.0"); process.exit(0); }\n` +
      `console.error("INF |  https://fake-protect.trycloudflare.com  |"); setInterval(() => {}, 1000);\n`,
    { mode: 0o755 }
  );
  const [httpPort, httpsPort] = [await freePort(), await freePort()];
  const upstream = http.createServer((req, res) => {
    if (req.headers.upgrade) return;
    res.end(`upstream ${req.url} cookie=${req.headers.cookie ?? "-"}`);
  });
  upstream.on("upgrade", (_req, socket) => socket.end("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n"));
  const upstreamPort: number = await new Promise((resolve) => upstream.listen(0, "127.0.0.1", () => resolve((upstream.address() as any).port)));
  const env = {
    ...process.env,
    HOME: tmpHome,
    LOCADOT_HOME: tmpHome,
    LOCADOT_HTTP_PORT: String(httpPort),
    LOCADOT_HTTPS_PORT: String(httpsPort),
    LOCADOT_CLOUDFLARED: fake,
  };
  const cli = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { env, encoding: "utf8", timeout: 30_000 });
  const withStdin = (input: string, ...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { env, encoding: "utf8", timeout: 30_000, input });
  t.after(() => {
    cli("stop");
    upstream.close();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  const host = "secret.localhost";
  assert.equal(cli("add", "--host", host, "--target", `127.0.0.1:${upstreamPort}`).status, 0);
  assert.equal(cli("start").status, 0);
  assert.equal((await eventually(() => request(httpPort, host, "/"), (r) => r.status === 200)).body, "upstream / cookie=-");

  await t.test("needs a place and a password", () => {
    const none = withStdin("longenough\n", "protect", "--host", host, "--stdin");
    assert.notEqual(none.status, 0);
    assert.match(none.stdout + none.stderr, /--shared, --remote and\/or --local/);
    const short = withStdin("short\n", "protect", "--host", host, "--local", "--stdin");
    assert.notEqual(short.status, 0);
    assert.match(short.stdout + short.stderr, /at least 8 characters/);
  });

  await t.test("local: sign-in page, wrong password, then a cookie that isn't forwarded", async () => {
    const set = withStdin("correct horse\n", "protect", "--host", host, "--local", "--stdin");
    assert.equal(set.status, 0, set.stdout + set.stderr);

    const registry = fs.readFileSync(path.join(tmpHome, ".locadot-registry.json"), "utf8");
    assert.doesNotMatch(registry, /correct horse|hash|salt/);
    const secrets = path.join(tmpHome, ".locadot-host-passwords.json");
    assert.equal(fs.statSync(secrets).mode & 0o777, 0o600);
    assert.doesNotMatch(fs.readFileSync(secrets, "utf8"), /correct horse/);

    const page = await eventually(() => request(httpPort, host, "/app?x=1", { headers: { Accept: "text/html" } }), (r) => r.status === 401);
    assert.equal(page.status, 401);
    assert.match(page.body, /Password required/);
    assert.match(page.body, /name="next" value="\/app\?x=1"/);
    assert.match(String(page.headers["content-security-policy"]), /default-src 'none'/);
    assert.equal((await request(httpPort, host, "/api", { headers: { Accept: "application/json" } })).status, 401);
    assert.equal(await upgradeStatus(httpPort, host), 401);

    const wrong = await login(httpPort, host, "nope nope nope");
    assert.equal(wrong.status, 401);
    assert.match(wrong.body, /Wrong password/);
    assert.equal(wrong.headers["set-cookie"], undefined);

    const offsite = await login(httpPort, host, "correct horse", "//evil.example/");
    assert.equal(offsite.status, 303);
    assert.equal(offsite.headers.location, "/");

    const ok = await login(httpPort, host, "correct horse", "/app?x=1");
    assert.equal(ok.status, 303);
    assert.equal(ok.headers.location, "/app?x=1");
    const setCookie = String(ok.headers["set-cookie"]);
    assert.match(setCookie, /^locadot_pw=[^;]+; Path=\/; HttpOnly; SameSite=Lax/);
    assert.doesNotMatch(setCookie, /Secure/);
    const cookie = setCookie.split(";")[0];

    assert.equal((await request(httpPort, host, "/app", { headers: { Cookie: `${cookie}; theme=dark` } })).body, "upstream /app cookie=theme=dark");
    assert.equal((await request(httpPort, host, "/app", { headers: { Cookie: cookie } })).body, "upstream /app cookie=-");
    assert.equal(await upgradeStatus(httpPort, host, cookie), 101);
    assert.equal((await request(httpPort, host, "/", { headers: { Cookie: "locadot_pw=9999999999.forged" } })).status, 401);

    const other = "other.localhost";
    assert.equal(cli("add", "--host", other, "--target", `127.0.0.1:${upstreamPort}`).status, 0);
    const withStolen = await eventually(() => request(httpPort, other, "/", { headers: { Cookie: cookie } }), (r) => r.status === 200);
    assert.equal(withStolen.body, `upstream / cookie=${cookie}`, "an unprotected mapping is untouched");
  });

  await t.test("a new password signs everyone out", async () => {
    const first = String((await login(httpPort, host, "correct horse")).headers["set-cookie"]).split(";")[0];
    assert.equal(withStdin("battery staple\n", "protect", "--host", host, "--stdin").status, 0);
    assert.equal((await eventually(() => request(httpPort, host, "/", { headers: { Cookie: first } }), (r) => r.status === 401)).status, 401);
    assert.equal((await login(httpPort, host, "battery staple")).status, 303);
  });

  await t.test("rate limits wrong passwords", async () => {
    let last: Res | undefined;
    for (let i = 0; i < 11; i++) last = await login(httpPort, host, `wrong-${i}-password`);
    assert.equal(last!.status, 429);
    assert.equal((await login(httpPort, host, "battery staple")).status, 429);
  });

  await t.test("shared only: the tunnel asks, this machine doesn't", async () => {
    const shared = cli("tunnel", "--host", host);
    assert.equal(shared.status, 0, shared.stdout + shared.stderr);
    const publicHost = "fake-protect.trycloudflare.com";
    const open = await eventually(() => request(httpPort, publicHost, "/", { headers: { Accept: "text/html" } }), (r) => r.status === 200);
    assert.equal(open.body, "upstream / cookie=-", "only local is protected so far");

    const set = cli("protect", "--host", host, "--shared");
    assert.equal(set.status, 0, set.stdout + set.stderr);
    assert.match(set.stdout, /the shared link/);
    assert.equal((await eventually(() => request(httpPort, host, "/"), (r) => r.status === 200)).body, "upstream / cookie=-");

    const page = await request(httpPort, publicHost, "/", { headers: { Accept: "text/html", "cf-connecting-ip": "203.0.113.9" } });
    assert.equal(page.status, 401);
    assert.match(page.body, /fake-protect\.trycloudflare\.com/);
    // Its own visitor, so the local lockout above doesn't apply.
    const ok = await request(httpPort, publicHost, "/__locadot/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "cf-connecting-ip": "203.0.113.9" },
      body: "password=battery+staple&next=%2F",
    });
    assert.equal(ok.status, 303);
    assert.match(String(ok.headers["set-cookie"]), /; Secure/);
    const cookie = String(ok.headers["set-cookie"]).split(";")[0];
    assert.equal((await request(httpPort, publicHost, "/x", { headers: { Cookie: cookie } })).body, "upstream /x cookie=-");
  });

  await t.test("shown in list and the API, then --off", async () => {
    assert.match(cli("list").stdout, /\(password: shared\)/);
    const token = fs.readFileSync(path.join(tmpHome, ".locadot-token"), "utf8").trim();
    const rows = JSON.parse((await request(httpPort, "localhost", "/api/hosts", { headers: { "X-Locadot-Token": token } })).body);
    const row = rows.find((r: any) => r.host === host);
    assert.deepEqual(row.protect.scopes, ["shared"]);
    assert.match(row.protect.updatedAt, /^\d{4}-/);
    assert.doesNotMatch(JSON.stringify(rows), /"(salt|secret|hash)"/);

    assert.equal(cli("protect", "--host", host, "--off").status, 0);
    assert.doesNotMatch(fs.readFileSync(path.join(tmpHome, ".locadot-host-passwords.json"), "utf8"), /secret\.localhost/);
    assert.equal((await eventually(() => request(httpPort, "fake-protect.trycloudflare.com", "/"), (r) => r.status === 200)).status, 200);
  });
});

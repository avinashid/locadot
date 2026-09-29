import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { spawnSync } from "node:child_process";

// A fake cloudflared stands in for the named-tunnel commands; HOME points at a temp dir so its
// ~/.cloudflared/cert.pem starts missing and `tunnel login` has to run.

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

const get = (port: number, host: string, urlPath = "/"): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: urlPath, headers: { Host: host }, timeout: 5000, agent: false }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode!, body, headers: res.headers }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });

test("locadot tunnel --domain: shares a mapping on the user's own hostname through a named tunnel", { timeout: 90_000 }, async (t) => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-domain-"));
  const userHome = path.join(tmpHome, "user");
  const calls = path.join(tmpHome, "calls.log");
  const fake = path.join(tmpHome, "fake-cloudflared.js");
  fs.mkdirSync(userHome);
  fs.writeFileSync(
    fake,
    `#!${process.execPath}
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2);
if (args.includes("--version")) { console.log("cloudflared version 2099.1.0"); process.exit(0); }
fs.appendFileSync(${JSON.stringify(calls)}, args.join(" ") + "\\n");
if (args[1] === "login") {
  console.error("Please open the following URL: https://dash.cloudflare.com/argotunnel?callback=fake");
  setTimeout(() => {
    fs.mkdirSync(path.join(process.env.HOME, ".cloudflared"), { recursive: true });
    fs.writeFileSync(path.join(process.env.HOME, ".cloudflared", "cert.pem"), "x");
    process.exit(0);
  }, 1500);
} else if (args[1] === "create") { console.log("Created tunnel " + args[2]); }
else if (args[1] === "route") { console.log("Added CNAME " + args.at(-1)); }
else if (args.includes("run")) { console.error("INF Registered tunnel connection connIndex=0"); setInterval(() => {}, 1000); }
else { console.error("INF |  https://fake-quick.trycloudflare.com  |"); setInterval(() => {}, 1000); }
`,
    { mode: 0o755 }
  );
  const [httpPort, httpsPort] = [await freePort(), await freePort()];
  const upstream = http.createServer((req, res) => res.end(`upstream ${req.url}`));
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamPort = (upstream.address() as any).port;
  const env = { ...process.env, HOME: userHome, LOCADOT_HOME: tmpHome, LOCADOT_HTTP_PORT: String(httpPort), LOCADOT_HTTPS_PORT: String(httpsPort), LOCADOT_CLOUDFLARED: fake };
  const cli = (...args: string[]) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { env, encoding: "utf8", timeout: 60_000 });
    return { ...r, out: `${r.stdout}${r.stderr}` };
  };
  const registry = () => JSON.parse(fs.readFileSync(path.join(tmpHome, ".locadot-registry.json"), "utf8")).hosts;
  t.after(() => {
    cli("stop");
    upstream.close();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  assert.equal(cli("add", "--host", "app.localhost", "--target", `127.0.0.1:${upstreamPort}`).status, 0);
  assert.equal(cli("add", "--host", "other.localhost", "--target", `127.0.0.1:${upstreamPort}`).status, 0);

  const shared = cli("tunnel", "--host", "app.localhost", "--domain", "https://App.Example.com/");
  assert.equal(shared.status, 0, shared.out);
  assert.match(shared.out, /Log in to Cloudflare to finish: https:\/\/dash\.cloudflare\.com\/argotunnel/);
  assert.match(shared.out, /app\.localhost is public at https:\/\/app\.example\.com/);
  assert.equal(registry()["app.localhost"].tunnelDomain, "app.example.com");

  const log = fs.readFileSync(calls, "utf8");
  assert.match(log, /^tunnel login$/m);
  assert.match(log, /^tunnel create locadot-app-localhost$/m);
  assert.match(log, /^tunnel route dns --overwrite-dns locadot-app-localhost app\.example\.com$/m);
  assert.match(log, new RegExp(`^tunnel --no-autoupdate run --url http://127\\.0\\.0\\.1:${httpPort} locadot-app-localhost$`, "m"));

  const res = await get(httpPort, "app.example.com", "/hi");
  assert.equal(res.body, "upstream /hi");
  assert.match(cli("tunnel").out, /app\.localhost\s+→\s+https:\/\/app\.example\.com/);

  await t.test("bad and taken hostnames are refused", () => {
    for (const bad of ["app.localhost", "nodot", "a b.com", "x.example.com/path"]) {
      const r = cli("tunnel", "--host", "other.localhost", "--domain", bad);
      assert.equal(r.status, 1, bad);
      assert.match(r.out, /isn't a public hostname/, bad);
    }
    const taken = cli("tunnel", "--host", "other.localhost", "--domain", "app.example.com");
    assert.equal(taken.status, 1);
    assert.match(taken.out, /already the shared hostname of app\.localhost/);
  });

  await t.test("unsharing keeps the hostname; sharing without --domain switches to a random URL", async () => {
    assert.equal(cli("tunnel", "--host", "app.localhost", "--off").status, 0);
    assert.equal(registry()["app.localhost"].tunnelDomain, "app.example.com");
    assert.equal(registry()["app.localhost"].tunnel, undefined);
    const quick = cli("tunnel", "--host", "app.localhost");
    assert.equal(quick.status, 0, quick.out);
    assert.match(quick.out, /https:\/\/fake-quick\.trycloudflare\.com/);
    assert.equal(registry()["app.localhost"].tunnelDomain, undefined);
    assert.notEqual((await get(httpPort, "app.example.com", "/hi")).body, "upstream /hi");
  });

  await t.test("a second custom share reuses the login", () => {
    const again = cli("tunnel", "--host", "other.localhost", "--domain", "other.example.com");
    assert.equal(again.status, 0, again.out);
    assert.doesNotMatch(again.out, /Log in to Cloudflare/);
    assert.equal(fs.readFileSync(calls, "utf8").match(/^tunnel login$/gm)!.length, 1);
  });
});

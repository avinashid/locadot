import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";

// A fake cloudflared stands in for the named-tunnel commands and a fake Cloudflare API names each
// login's zone. HOME points at a temp dir, so there's no ~/.cloudflared/cert.pem to start with.
// The fake `tunnel login` authorizes whichever zone is written in next-zone.

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

test("locadot tunnel --domain: shares a mapping on the user's own hostname through a named tunnel", { timeout: 120_000 }, async (t) => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-domain-"));
  const userHome = path.join(tmpHome, "user");
  const calls = path.join(tmpHome, "calls.log");
  const nextZone = path.join(tmpHome, "next-zone");
  const fake = path.join(tmpHome, "fake-cloudflared.js");
  fs.mkdirSync(userHome);
  fs.writeFileSync(nextZone, "example.com");
  fs.writeFileSync(
    fake,
    `#!${process.execPath}
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2);
if (args.includes("--version")) { console.log("cloudflared version 2099.1.0"); process.exit(0); }
fs.appendFileSync(${JSON.stringify(calls)}, args.join(" ") + "\\n");
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const pem = (token) => "-----BEGIN ARGO TUNNEL TOKEN-----\\n" + Buffer.from(JSON.stringify(token)).toString("base64") + "\\n-----END ARGO TUNNEL TOKEN-----\\n";
const certZone = () => {
  const text = fs.readFileSync(flag("--origincert"), "utf8").split("\\n")[1];
  return JSON.parse(Buffer.from(text, "base64").toString()).zoneID.replace(/^id-/, "");
};
const rest = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] || "").match(/^--(origincert|credentials-file|url|config)$/));
if (rest[1] === "login") {
  console.error("Please open the following URL: https://dash.cloudflare.com/argotunnel?callback=fake");
  const zone = fs.readFileSync(${JSON.stringify(nextZone)}, "utf8").trim();
  setTimeout(() => {
    fs.mkdirSync(path.join(process.env.HOME, ".cloudflared"), { recursive: true });
    fs.writeFileSync(path.join(process.env.HOME, ".cloudflared", "cert.pem"), pem({ zoneID: "id-" + zone, accountID: "acct", apiToken: "tok" }));
    process.exit(0);
  }, 1500);
} else if (rest[1] === "create") {
  if (flag("--credentials-file")) fs.writeFileSync(flag("--credentials-file"), "{}");
  console.log("Created tunnel " + rest[2]);
} else if (rest[1] === "route") {
  const zone = certZone(), host = rest[4];
  console.log("INF Added CNAME " + (host === zone || host.endsWith("." + zone) ? host : host + "." + zone) + " which will route to this tunnel");
} else if (rest.includes("run")) { console.error("INF Registered tunnel connection connIndex=0"); setInterval(() => {}, 1000); }
else { console.error("INF |  https://fake-quick.trycloudflare.com  |"); setInterval(() => {}, 1000); }
`,
    { mode: 0o755 }
  );
  // The CLI runs through spawnSync, which blocks this process, so the fake API gets its own.
  const api = spawn(process.execPath, ["-e", `
    require("http").createServer((req, res) => {
      const zone = (req.url.match(/^\\/zones\\/id-(.+)$/) || [])[1];
      const ok = zone && zone !== "legacy.net" && req.headers.authorization === "Bearer tok";
      res.writeHead(ok ? 200 : 403, { "content-type": "application/json" });
      res.end(JSON.stringify(ok ? { success: true, result: { name: zone } } : { success: false }));
    }).listen(0, "127.0.0.1", function () { console.log(this.address().port); });
  `], { stdio: ["ignore", "pipe", "inherit"] });
  const apiPort = await new Promise<string>((resolve) => api.stdout!.once("data", (d) => resolve(String(d).trim())));
  const [httpPort, httpsPort] = [await freePort(), await freePort()];
  const upstream = http.createServer((req, res) => res.end(`upstream ${req.url}`));
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamPort = (upstream.address() as any).port;
  const env = {
    ...process.env,
    HOME: userHome,
    LOCADOT_HOME: tmpHome,
    LOCADOT_HTTP_PORT: String(httpPort),
    LOCADOT_HTTPS_PORT: String(httpsPort),
    LOCADOT_CLOUDFLARED: fake,
    LOCADOT_CLOUDFLARE_API: `http://127.0.0.1:${apiPort}`,
  };
  const cli = (...args: string[]) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { env, encoding: "utf8", timeout: 60_000 });
    return { ...r, out: `${r.stdout}${r.stderr}` };
  };
  const registry = () => JSON.parse(fs.readFileSync(path.join(tmpHome, ".locadot-registry.json"), "utf8")).hosts;
  const logins = path.join(tmpHome, "cloudflare");
  const logins_ = () => fs.readdirSync(logins).filter((f) => f.endsWith(".pem")).sort();
  const loginCount = () => fs.readFileSync(calls, "utf8").match(/^tunnel login$/gm)?.length ?? 0;
  t.after(() => {
    cli("stop");
    upstream.close();
    api.kill();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  for (const host of ["app", "other", "third", "fourth"]) {
    assert.equal(cli("add", "--host", `${host}.localhost`, "--target", `127.0.0.1:${upstreamPort}`).status, 0);
  }

  const shared = cli("tunnel", "--host", "app.localhost", "--domain", "https://App.Example.com/");
  assert.equal(shared.status, 0, shared.out);
  assert.match(shared.out, /Log in to Cloudflare to finish and pick the zone app\.example\.com is in: https:\/\/dash\.cloudflare\.com\/argotunnel/);
  assert.match(shared.out, /app\.localhost is public at https:\/\/app\.example\.com/);
  assert.equal(registry()["app.localhost"].tunnelDomain, "app.example.com");
  assert.deepEqual(logins_(), ["example.com.pem"]);
  assert.equal(fs.existsSync(path.join(userHome, ".cloudflared", "cert.pem")), false, "the login never lands in ~/.cloudflared");

  const cert = path.join(logins, "example.com.pem");
  const creds = path.join(logins, "tunnels", "acct", "locadot-app-localhost.json");
  const log = fs.readFileSync(calls, "utf8");
  assert.match(log, /^tunnel login$/m);
  assert.ok(log.includes(`tunnel --origincert ${cert} create --credentials-file ${creds} locadot-app-localhost\n`), log);
  assert.ok(log.includes(`tunnel --origincert ${cert} route dns --overwrite-dns locadot-app-localhost app.example.com\n`), log);
  assert.ok(log.includes(`tunnel --no-autoupdate --origincert ${cert} run --credentials-file ${creds} --url http://127.0.0.1:${httpPort} locadot-app-localhost\n`), log);

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

  await t.test("another hostname in an authorized zone reuses its login", () => {
    const again = cli("tunnel", "--host", "other.localhost", "--domain", "deep.other.example.com");
    assert.equal(again.status, 0, again.out);
    assert.doesNotMatch(again.out, /Log in to Cloudflare/);
    assert.equal(loginCount(), 1);
  });

  await t.test("a sign-in that authorizes the wrong zone is an error, not a share", () => {
    fs.writeFileSync(nextZone, "wrong.io");
    const wrong = cli("tunnel", "--host", "third.localhost", "--domain", "app.other.dev");
    assert.equal(wrong.status, 1, wrong.out);
    assert.match(wrong.out, /Log in to Cloudflare to finish/);
    assert.match(wrong.out, /authorized wrong\.io, which doesn't include app\.other\.dev/);
    assert.doesNotMatch(fs.readFileSync(calls, "utf8"), /route dns --overwrite-dns locadot-third-localhost/);
  });

  await t.test("a second zone gets its own login next to the first", () => {
    fs.writeFileSync(nextZone, "other.dev");
    const second = cli("tunnel", "--host", "third.localhost", "--domain", "app.other.dev");
    assert.equal(second.status, 0, second.out);
    assert.match(second.out, /public at https:\/\/app\.other\.dev/);
    assert.deepEqual(logins_(), ["example.com.pem", "other.dev.pem", "wrong.io.pem"]);
    assert.equal(loginCount(), 3);
    assert.ok(fs.readFileSync(calls, "utf8").includes(`--origincert ${path.join(logins, "other.dev.pem")} route dns --overwrite-dns locadot-third-localhost app.other.dev`));
  });

  await t.test("a login whose zone can't be looked up is caught when cloudflared routes outside it", () => {
    const token = Buffer.from(JSON.stringify({ zoneID: "id-legacy.net", accountID: "acct", apiToken: "tok" })).toString("base64");
    fs.mkdirSync(path.join(userHome, ".cloudflared"));
    fs.writeFileSync(path.join(userHome, ".cloudflared", "cert.pem"), `-----BEGIN ARGO TUNNEL TOKEN-----\n${token}\n-----END ARGO TUNNEL TOKEN-----\n`);
    const r = cli("tunnel", "--host", "fourth.localhost", "--domain", "api.nope.com");
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /api\.nope\.com isn't in the Cloudflare zone this login is for \(legacy\.net\); cloudflared created api\.nope\.com\.legacy\.net/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(logins, "zones.json"), "utf8"))["id-legacy.net"], "legacy.net");
  });
});

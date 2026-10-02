import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-autosync-"));
process.env.LOCADOT_HOME = tmpHome;

const httpProxy = require("http-proxy");
const { handleRequest } = require("../src/proxy/router");
const { createAutoSync, withoutSyncParam } = require("../src/proxy/auto-sync");

test.after(() => fs.rmSync(tmpHome, { recursive: true, force: true }));

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as any).port)));
}

function get(port: number, urlPath: string, headers: Record<string, string>) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method: "GET", path: urlPath, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("createAutoSync", async (t) => {
  await t.test("nothing to sync with: resolves undefined without calling sync", async () => {
    let calls = 0;
    const autoSync = createAutoSync({ remotes: () => [], sync: async () => (calls++, { added: [], removed: [] }), changed: () => {} });
    assert.equal(await autoSync(false), undefined);
    assert.equal(calls, 0);
  });

  await t.test("concurrent calls share one run; a recent run is reused, a forced one after the short gap", async () => {
    let calls = 0;
    let changed = 0;
    const autoSync = createAutoSync({
      remotes: () => ["alice"],
      sync: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 20));
        return { added: ["new.localhost"], removed: [] };
      },
      changed: () => changed++,
      freshMs: 10_000,
      forcedFreshMs: 30,
    });
    const [a, b] = await Promise.all([autoSync(false), autoSync(false)]);
    assert.equal(calls, 1);
    assert.equal(a, b);
    assert.deepEqual(a, [{ name: "alice", ok: true, added: ["new.localhost"], removed: [] }]);
    assert.equal(changed, 1);

    await autoSync(false);
    await autoSync(true);
    assert.equal(calls, 1, "within forcedFreshMs even a forced sync reuses the last run");
    await new Promise((r) => setTimeout(r, 40));
    await autoSync(false);
    assert.equal(calls, 1, "an unforced sync waits for freshMs");
    await autoSync(true);
    assert.equal(calls, 2);
  });

  await t.test("one machine failing or timing out doesn't hide the others", async () => {
    let changed = 0;
    const autoSync = createAutoSync({
      remotes: () => ["ok", "down", "slow"],
      sync: (name: string) => {
        if (name === "down") return Promise.reject(new Error("❌ connect ECONNREFUSED"));
        if (name === "slow") return new Promise(() => {});
        return Promise.resolve({ added: [], removed: [] });
      },
      changed: () => changed++,
      timeoutMs: 30,
    });
    const reports = await autoSync(false);
    assert.deepEqual(reports, [
      { name: "ok", ok: true, added: [], removed: [] },
      { name: "down", ok: false, added: [], removed: [], error: "connect ECONNREFUSED" },
      { name: "slow", ok: false, added: [], removed: [], error: "timed out after 0s" },
    ]);
    assert.equal(changed, 0, "nothing changed, so no reload");
  });

  await t.test("withoutSyncParam keeps the rest of the URL", () => {
    assert.equal(withoutSyncParam("/a/b?x=1&locadot-sync=1&y=2"), "/a/b?x=1&y=2");
    assert.equal(withoutSyncParam("/?locadot-sync=1"), "/");
    assert.equal(withoutSyncParam("/p"), "/p");
  });
});

test("router: an unmapped name syncs connected machines first", async (t) => {
  const upstream = http.createServer((req, res) => res.end(`up ${req.url}`));
  const target = `http://127.0.0.1:${await listen(upstream)}`;
  const hosts = new Map<string, any>();
  let shared: string[] = [];
  let syncs = 0;
  let fail = false;

  const autoSync = createAutoSync({
    remotes: () => ["alice"],
    sync: async () => {
      syncs++;
      if (fail) throw new Error("sender unreachable");
      const added = shared.filter((h) => !hosts.has(h));
      for (const h of added) hosts.set(h, { target, createdAt: "x", updatedAt: "x" });
      return { added, removed: [] };
    },
    changed: () => {},
    freshMs: 0,
    forcedFreshMs: 0,
  });
  const ctx = {
    proxy: httpProxy.createProxyServer({}),
    lookup: (host: string) => hosts.get(host),
    stats: new Map(),
    dashboard: (_req: any, res: http.ServerResponse) => res.end("DASH"),
    autoSync,
  };
  const front = http.createServer((req, res) => handleRequest(req, res, ctx));
  const port = await listen(front);
  t.after(() => {
    front.close();
    upstream.close();
  });

  await t.test("newly shared: the browser is sent back to the same URL, which then works", async () => {
    shared = ["new.localhost"];
    const res = await get(port, "/page?q=1&locadot-sync=1", { Host: "new.localhost" });
    assert.equal(res.status, 307);
    assert.equal(res.headers.location, "/page?q=1");
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal((await get(port, "/page?q=1", { Host: "new.localhost" })).body, "up /page?q=1");
  });

  await t.test("still not shared: the page says what the sync found and offers Sync again", async () => {
    const res = await get(port, "/x?a=b", { Host: "missing.localhost" });
    assert.equal(res.status, 502);
    assert.match(res.body, /Not mapped/);
    assert.match(res.body, /class="name">alice<\/span><span class="detail">synced, nothing new/);
    assert.match(res.body, /href="\/x\?a=b&amp;locadot-sync=1">🔄 Sync again/);
  });

  await t.test("a failing sync shows its error", async () => {
    fail = true;
    const res = await get(port, "/", { Host: "missing.localhost" });
    assert.match(res.body, /class="name">alice<\/span><span class="detail">couldn't sync: sender unreachable/);
    fail = false;
  });

  await t.test("requests through a tunnel or the hub don't trigger a sync", async () => {
    const before = syncs;
    const res = await get(port, "/", { Host: "missing.localhost", "cf-ray": "abc" });
    assert.match(res.body, /Not mapped/);
    assert.doesNotMatch(res.body, /Sync again/);
    assert.equal(syncs, before);
  });

  await t.test("no autoSync in the context: the plain page, as before", async () => {
    const plain = http.createServer((req, res) => handleRequest(req, res, { ...ctx, autoSync: undefined }));
    const plainPort = await listen(plain);
    const res = await get(plainPort, "/", { Host: "missing.localhost" });
    plain.close();
    assert.match(res.body, /<h2>Map it<\/h2>/);
    assert.doesNotMatch(res.body, /Sync again/);
  });
});

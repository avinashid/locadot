import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-registry-"));
process.env.LOCADOT_HOME = tmpHome;

const RegistryStore = require("../src/lib/registry").default;
const { RegistryError } = require("../src/lib/registry");
const Constants = require("../src/constants").default;

test.after(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

test("parse: legacy format migrates to v2", () => {
  const legacy = JSON.stringify({ "dev.localhost": 3350 });
  const registry = RegistryStore.parse(legacy);
  assert.equal(registry.version, 2);
  assert.equal(registry.hosts["dev.localhost"].target, "http://localhost:3350");
});

test("parse: v2 format passthrough", () => {
  const v2 = JSON.stringify({ version: 2, hosts: { "a.localhost": { target: "http://localhost:1", createdAt: "x", updatedAt: "x" } } });
  const registry = RegistryStore.parse(v2);
  assert.equal(registry.hosts["a.localhost"].target, "http://localhost:1");
});

test("parse: empty file returns empty registry", () => {
  assert.deepEqual(RegistryStore.parse(undefined), { version: 2, hosts: {} });
  assert.deepEqual(RegistryStore.parse(""), { version: 2, hosts: {} });
  assert.deepEqual(RegistryStore.parse("   "), { version: 2, hosts: {} });
});

test("read: corrupt JSON throws RegistryError and backs up without touching original", () => {
  fs.mkdirSync(tmpHome, { recursive: true });
  const badContent = "{ this is not json ";
  fs.writeFileSync(Constants.paths.REGISTRY_FILE, badContent, "utf8");

  assert.throws(() => RegistryStore.read(), RegistryError);

  const dir = path.dirname(Constants.paths.REGISTRY_FILE);
  const backups = fs.readdirSync(dir).filter((f) => f.includes(".corrupt-"));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, backups[0]), "utf8"), badContent);
  assert.equal(fs.readFileSync(Constants.paths.REGISTRY_FILE, "utf8"), badContent);

  fs.rmSync(Constants.paths.REGISTRY_FILE, { force: true });
  fs.rmSync(path.join(dir, backups[0]), { force: true });
});

test("mutate persists changes", async () => {
  await RegistryStore.mutate((registry: any) => {
    registry.hosts["persist.localhost"] = { target: "http://localhost:4000", createdAt: "x", updatedAt: "x" };
  });
  const read = RegistryStore.read();
  assert.equal(read.hosts["persist.localhost"].target, "http://localhost:4000");
});

test("mutate: concurrent writers from separate processes don't lose updates", async () => {
  const N = 15;
  const runs = Array.from({ length: N }, (_, i) => {
    const code = `
      const RegistryStore = require(${JSON.stringify(path.join(__dirname, "..", "src", "lib", "registry"))}).default;
      RegistryStore.mutate((r) => {
        r.hosts["concurrent-${i}.localhost"] = { target: "http://localhost:${5000 + i}", createdAt: "x", updatedAt: "x" };
      }).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
    `;
    return new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", "-e", code], {
        env: { ...process.env, LOCADOT_HOME: tmpHome },
        stdio: "inherit",
      });
      child.on("exit", (exitCode) => (exitCode === 0 ? resolve() : reject(new Error(`child ${i} exited ${exitCode}`))));
      child.on("error", reject);
    });
  });

  await Promise.all(runs);

  const registry = RegistryStore.read();
  for (let i = 0; i < N; i++) {
    assert.ok(registry.hosts[`concurrent-${i}.localhost`], `missing concurrent-${i}.localhost`);
  }
});

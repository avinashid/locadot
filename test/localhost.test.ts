import test from "node:test";
import assert from "node:assert/strict";

const Localhost = require("../src/lib/localhost").default;
const { InputError } = require("../src/lib/localhost");

test("isValidLocalhostDomain / normalizeHost", () => {
  const valid = ["dev.localhost", "a.b.localhost", "Google.Localhost"];
  for (const h of valid) {
    assert.ok(Localhost.isValidLocalhostDomain(h), `expected valid: ${h}`);
    assert.equal(Localhost.normalizeHost(h), h.toLowerCase());
  }

  const invalid = [
    "localhost",
    "evil.com",
    "a..localhost",
    "-a.localhost",
    "<script>.localhost",
    "a".repeat(250) + ".localhost", // 254 chars total
  ];
  for (const h of invalid) {
    assert.ok(!Localhost.isValidLocalhostDomain(h), `expected invalid: ${h}`);
    assert.equal(Localhost.normalizeHost(h), undefined);
  }
});

test("parsePort edges", () => {
  assert.equal(Localhost.parsePort("3000"), 3000);
  assert.throws(() => Localhost.parsePort(0), InputError);
  assert.throws(() => Localhost.parsePort(65536), InputError);
  assert.throws(() => Localhost.parsePort("30a"), InputError);
  // parsePort trims before validating, so " 80 " is accepted as 80.
  assert.equal(Localhost.parsePort(" 80 "), 80);
});

test("parseTarget", () => {
  assert.equal(Localhost.parseTarget(3000), "http://localhost:3000");
  assert.equal(Localhost.parseTarget("127.0.0.1:8080"), "http://127.0.0.1:8080");
  assert.equal(Localhost.parseTarget("https://google.com"), "https://google.com");
  assert.equal(Localhost.parseTarget("https://google.com/"), "https://google.com");
  assert.throws(() => Localhost.parseTarget("ftp://x"), InputError);
  assert.throws(() => Localhost.parseTarget("http://u:p@x"), InputError);
  assert.equal(Localhost.parseTarget("https://x.com/?q=1#h"), "https://x.com");
});

test("isLocalTarget", () => {
  assert.ok(Localhost.isLocalTarget("http://localhost:3000"));
  assert.ok(Localhost.isLocalTarget("http://127.0.0.1:8080"));
  assert.ok(Localhost.isLocalTarget("http://dev.localhost"));
  assert.ok(!Localhost.isLocalTarget("https://google.com"));
});

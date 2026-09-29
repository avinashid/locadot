import test from "node:test";
import assert from "node:assert/strict";
import { allowMatches, parseAllow, parseAllowList } from "../src/lib/allow";

test("parseAllow: host or host:port, schemes and loopback spellings normalized", () => {
  assert.equal(parseAllow(" LocalHost:3000 "), "localhost:3000");
  assert.equal(parseAllow("http://127.0.0.1:3000/"), "localhost:3000");
  assert.equal(parseAllow("0.0.0.0:8080"), "localhost:8080");
  assert.equal(parseAllow("api.localhost:4000"), "api.localhost:4000");
  assert.equal(parseAllow("api.internal"), "api.internal");
  assert.equal(parseAllow("192.168.1.5:9000"), "192.168.1.5:9000");
  for (const bad of ["", "*", "localhost:0", "localhost:70000", "http://x.com/path", "a b", "[::1]:3000", "-bad.com", 3000]) {
    assert.throws(() => parseAllow(bad), undefined, String(bad));
  }
});

test("parseAllowList: comma string or array, de-duplicated, capped", () => {
  assert.deepEqual(parseAllowList("localhost:3000, 127.0.0.1:3000,api.internal"), ["localhost:3000", "api.internal"]);
  assert.deepEqual(parseAllowList([]), []);
  assert.throws(() => parseAllowList({}));
  assert.throws(() => parseAllowList(Array.from({ length: 33 }, (_, i) => `localhost:${i + 1}`)));
});

test("allowMatches: exact port, or any port when the entry has none", () => {
  assert.equal(allowMatches(["localhost:3000"], "127.0.0.1:3000", "http"), true);
  assert.equal(allowMatches(["localhost:3000"], "localhost:3001", "http"), false);
  assert.equal(allowMatches(["localhost"], "localhost:9999", "ws"), true);
  assert.equal(allowMatches(["api.internal:443"], "api.internal", "https"), true);
  assert.equal(allowMatches(["api.internal:443"], "api.internal", "http"), false);
  assert.equal(allowMatches(["localhost"], "api.localhost:3000", "http"), false);
  assert.equal(allowMatches(undefined, "localhost:3000", "http"), false);
});

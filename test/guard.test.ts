import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const { isPublicAddress, isPublicHost, publicOnlyAgents } = require("../src/proxy/guard");

test("isPublicAddress: loopback, LAN, CGNAT, link-local, metadata and mapped forms are not public", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.5", "100.64.0.1", "169.254.169.254", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:a00:1", "64:ff9b::10.0.0.1"]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ["1.1.1.1", "104.16.0.1", "2606:4700::1111", "::ffff:8.8.8.8"]) assert.equal(isPublicAddress(ip), true, ip);
});

test("isPublicHost: rejects local names and private literals before DNS", () => {
  for (const host of ["localhost", "app.localhost:3000", "printer.local", "intranet", "127.0.0.1:8080", "[::1]:80", "10.0.0.1"]) {
    assert.equal(isPublicHost(host), false, host);
  }
  for (const host of ["api.example.com", "api.example.com:8443", "1.1.1.1"]) assert.equal(isPublicHost(host), true, host);
});

test("publicOnlyAgents refuse a name that resolves to loopback", async () => {
  const error = await new Promise<NodeJS.ErrnoException>((resolve) => {
    http.get({ host: "localhost", port: 9, agent: publicOnlyAgents.http }, () => resolve(new Error("connected"))).on("error", resolve);
  });
  assert.equal(error.code, "EPUBLICONLY");
});

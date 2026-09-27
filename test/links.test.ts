import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.LOCADOT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-links-"));

const Links = require("../src/lib/links").default;
const { LinkError } = require("../src/lib/links");
const Constants = require("../src/constants").default;

const is401 = (err: any) => err instanceof LinkError && err.status === 401;
const is404 = (err: any) => err instanceof LinkError && err.status === 404;

test("createInvite + redeem", () => {
  const { invite, code } = Links.createInvite({ role: "editor" });
  assert.equal(invite.role, "editor");
  assert.match(code, /^lnk_[0-9a-f]{8}\.[A-Za-z0-9_-]+$/);

  const { peer, token } = Links.redeem(code, "Bob's laptop");
  assert.equal(peer.role, "editor");
  assert.equal(peer.name, "Bob's laptop");
  assert.match(token, /^lpt_[0-9a-f]{8}\.[A-Za-z0-9_-]+$/);

  // one-time: the invite is gone even after a successful redeem
  assert.throws(() => Links.redeem(code, "again"), is401);
});

test("redeem: unknown code", () => {
  assert.throws(() => Links.redeem("lnk_deadbeef.notasecret", "x"), is401);
});

test("redeem: expired invite (fake time by editing the stored expiresAt)", () => {
  const { invite, code } = Links.createInvite({ role: "viewer", hosts: ["a.localhost"] });
  const file = Constants.paths.LINKS_FILE;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const stored = data.invites.find((i: any) => i.id === invite.id);
  stored.expiresAt = new Date(Date.now() - 1000).toISOString();
  fs.writeFileSync(file, JSON.stringify(data));

  assert.throws(() => Links.redeem(code, "x"), is401);
});

test("links file is written 0600", () => {
  Links.createInvite({ role: "viewer" });
  const mode = fs.statSync(Constants.paths.LINKS_FILE).mode & 0o777;
  assert.equal(mode, 0o600);
});

test("authenticate", () => {
  const { code } = Links.createInvite({ role: "admin" });
  const { peer, token } = Links.redeem(code, "Admin");
  const authed = Links.authenticate(token);
  assert.equal(authed?.id, peer.id);
  assert.equal(Links.authenticate("lpt_deadbeef.badsecret"), undefined);
  assert.equal(Links.authenticate(undefined), undefined);
  assert.equal(Links.authenticate("not-a-token"), undefined);
});

test("setRole / revoke", () => {
  const { code } = Links.createInvite({ role: "viewer" });
  const { peer } = Links.redeem(code, "Peer 2");

  const updated = Links.setRole(peer.id, "editor");
  assert.equal(updated.role, "editor");
  assert.throws(() => Links.setRole("missing-id", "viewer"), is404);

  Links.revoke(peer.id);
  const { peers } = Links.list();
  assert.ok(!peers.find((p: any) => p.id === peer.id));
});

test("revokeInvite", () => {
  const { invite, code } = Links.createInvite({ role: "viewer" });
  Links.revokeInvite(invite.id);
  const { invites } = Links.list();
  assert.ok(!invites.find((i: any) => i.id === invite.id));
  assert.throws(() => Links.redeem(code, "x"), is401);
});

test("can / visibleHosts", () => {
  assert.equal(Links.can({ role: "viewer" }, "read"), true);
  assert.equal(Links.can({ role: "viewer" }, "write"), false);
  assert.equal(Links.can({ role: "viewer" }, "delete"), false);
  assert.equal(Links.can({ role: "viewer" }, "settings"), false);
  assert.equal(Links.can({ role: "editor" }, "read"), true);
  assert.equal(Links.can({ role: "editor" }, "write"), true);
  assert.equal(Links.can({ role: "editor" }, "delete"), false);
  assert.equal(Links.can({ role: "editor" }, "settings"), false);
  assert.equal(Links.can({ role: "admin" }, "write"), true);
  assert.equal(Links.can({ role: "admin" }, "delete"), true);
  assert.equal(Links.can({ role: "admin" }, "settings"), true);

  const all = ["a.localhost", "b.localhost", "c.localhost"];
  assert.deepEqual(Links.visibleHosts({ role: "viewer", hosts: ["a.localhost"] }, all), ["a.localhost"]);
  assert.deepEqual(Links.visibleHosts({ role: "viewer" }, all), []);
  assert.deepEqual(Links.visibleHosts({ role: "editor", hosts: ["a.localhost"] }, all), all);
  assert.deepEqual(Links.visibleHosts({ role: "admin" }, all), all);
});

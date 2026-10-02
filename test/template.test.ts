import test from "node:test";
import assert from "node:assert/strict";

const { proxyNotFound, upstreamDown, remoteLocalhost } = require("../src/constants/template");
const { LOGO_SVG } = require("../src/dashboard/logo");

const d = "https://localhost";

test("proxy pages use the dashboard look: logo, light and dark tokens, dashboard and docs buttons", () => {
  const pages = [
    proxyNotFound("app.localhost", d),
    upstreamDown("app.localhost", "http://localhost:3000", "connect ECONNREFUSED", d),
    remoteLocalhost({ domain: "lap", name: "lap", sender: "mbp", allowed: true, hosts: [], portUrl: "https://lap-PORT.localhost", dashboardUrl: d }),
    remoteLocalhost({ domain: "lap", name: "lap", sender: "mbp", allowed: false, hosts: [], portUrl: "", dashboardUrl: d }),
  ];
  for (const html of pages) {
    assert.ok(html.includes(LOGO_SVG));
    assert.match(html, /--bg: #09090b/);
    assert.match(html, /prefers-color-scheme: light\) \{ :root \{\s*color-scheme: light;/);
    assert.match(html, /<a class="btn btn-primary" href="https:\/\/localhost">Open the dashboard<\/a>/);
    assert.match(html, /class="btn"[^>]*>Docs<\/a>/);
  }
});

test("not mapped page: escapes the host, lists each sync and links Sync again", () => {
  const html = proxyNotFound("<x>.localhost", d, {
    href: "https://a.localhost/?locadot-sync=1",
    reports: [
      { name: "lap", ok: true, added: ["b.localhost"], removed: ["c.localhost"] },
      { name: "office", ok: false, error: "timed out", added: [], removed: [] },
    ],
  });
  assert.match(html, /Not mapped/);
  assert.ok(!html.includes("<x>.localhost"));
  assert.match(html, /&lt;x&gt;\.localhost --port PORT/);
  assert.match(html, /dot up"><\/span><span class="name">lap<\/span><span class="detail">synced, \+b\.localhost, −c\.localhost/);
  assert.match(html, /dot down"><\/span><span class="name">office<\/span><span class="detail">couldn't sync: timed out/);
  assert.match(html, /href="https:\/\/a\.localhost\/\?locadot-sync=1">🔄 Sync again/);
  assert.doesNotMatch(proxyNotFound("a.localhost", d), /Sync again/);
});

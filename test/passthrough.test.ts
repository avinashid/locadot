import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

const { parseVia, injectShim, shimTag, shimScript, isSameSite, isSameOrigin, rewriteViaResponse } = require("../src/lib/passthrough");

test("parseVia: splits scheme, host and path; rejects anything else", () => {
  assert.deepEqual(parseVia("/__locadot/x/https/api.x.com:8443/v1?q=1"), { scheme: "https", host: "api.x.com:8443", path: "/v1?q=1" });
  assert.deepEqual(parseVia("/__locadot/x/wss/ws.x.com"), { scheme: "wss", host: "ws.x.com", path: "/" });
  assert.equal(parseVia("/__locadot/x/ftp/x.com/a"), undefined);
  assert.equal(parseVia("/__locadot/x/https/x.com@evil/a"), undefined);
  assert.equal(parseVia("/app/__locadot/x/https/x.com/"), undefined);
});

test("injectShim: first thing in <head>, once", () => {
  const html = injectShim('<!DOCTYPE html><html><head lang="en"><script src="/app.js"></script></head></html>');
  assert.equal(html, `<!DOCTYPE html><html><head lang="en">${shimTag}<script src="/app.js"></script></head></html>`);
  assert.equal(injectShim(html), html);
  assert.equal(injectShim("<p>no head</p>"), shimTag + "<p>no head</p>");
});

test("isSameOrigin: Sec-Fetch-Site wins, then Origin", () => {
  const req = (headers: Record<string, string>) => ({ headers: { host: "app.localhost", ...headers } }) as any;
  assert.equal(isSameOrigin(req({ "sec-fetch-site": "same-origin" })), true);
  assert.equal(isSameOrigin(req({ "sec-fetch-site": "cross-site", origin: "https://app.localhost" })), false);
  assert.equal(isSameOrigin(req({ origin: "https://evil.example" })), false);
  assert.equal(isSameOrigin(req({ origin: "https://app.localhost" })), true);
  assert.equal(isSameOrigin(req({})), true);
});

test("isSameSite: subdomains of the site (minus www) only", () => {
  assert.equal(isSameSite("api.signalsant.com", "https://www.signalsant.com"), true);
  assert.equal(isSameSite("signalsant.com:443", "https://signalsant.com"), true);
  assert.equal(isSameSite("cdn.other.com", "https://signalsant.com"), false);
  assert.equal(isSameSite("evilsignalsant.com", "https://signalsant.com"), false);
});

test("rewriteViaResponse: redirects stay on the pass-through, cookies scoped or dropped", () => {
  const via = { scheme: "https", host: "api.x.com", path: "/" };
  const same: any = { location: "/login?next=1", "set-cookie": ["a=1; Path=/v1; HttpOnly", "b=2; Domain=.x.com; Path=/"] };
  rewriteViaResponse(same, via, "https://x.com");
  assert.equal(same.location, "/__locadot/x/https/api.x.com/login?next=1");
  assert.deepEqual(same["set-cookie"], ["a=1; HttpOnly; Path=/__locadot/x/https/api.x.com/v1", "b=2; Domain=.x.com; Path=/"]);

  const other: any = { location: "https://auth.other.com/cb#top", "set-cookie": ["t=1"] };
  rewriteViaResponse(other, { scheme: "https", host: "cdn.other.com", path: "/" }, "https://x.com");
  assert.equal(other.location, "/__locadot/x/https/auth.other.com/cb#top");
  assert.equal(other["set-cookie"], undefined);
});

test("shim: fetch, XHR, EventSource, WebSocket and sendBeacon to other origins go through the page's origin", () => {
  const calls: string[] = [];
  class FakeRequest {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
  }
  class FakeXHR {}
  (FakeXHR.prototype as any).open = function (_method: string, url: string) {
    calls.push(`xhr ${url}`);
  };
  function FakeWS(this: any, url: string) {
    calls.push(`ws ${url}`);
  }
  (FakeWS as any).OPEN = 1;
  function FakeES(this: any, url: string) {
    calls.push(`es ${url}`);
  }
  const window: any = {
    location: new URL("https://app.localhost:8443/page"),
    fetch: (input: any) => calls.push(`fetch ${typeof input === "string" ? input : input.url}`),
    XMLHttpRequest: FakeXHR,
    WebSocket: FakeWS,
    EventSource: FakeES,
  };
  const navigator = { sendBeacon: (url: string) => calls.push(`beacon ${url}`) };
  Object.assign(window, { window, navigator, Request: FakeRequest });
  vm.runInNewContext(shimScript, Object.assign(Object.create(null), window, { window, URL }));

  window.fetch("https://api.x.com/v1/me?x=1");
  window.fetch("/same/origin");
  window.fetch("https://other.localhost/y");
  window.fetch(new FakeRequest("http://plain.example/z"));
  new window.XMLHttpRequest().open("POST", "https://api.x.com/v1/login");
  new window.WebSocket("wss://ws.x.com/socket");
  new window.EventSource("https://events.x.com/stream");
  navigator.sendBeacon("https://metrics.x.com/b");
  assert.equal(window.WebSocket.OPEN, 1);
  assert.deepEqual(calls, [
    "fetch https://app.localhost:8443/__locadot/x/https/api.x.com/v1/me?x=1",
    "fetch /same/origin",
    "fetch https://other.localhost/y",
    "fetch https://app.localhost:8443/__locadot/x/http/plain.example/z",
    "xhr https://app.localhost:8443/__locadot/x/https/api.x.com/v1/login",
    "ws wss://app.localhost:8443/__locadot/x/wss/ws.x.com/socket",
    "es https://app.localhost:8443/__locadot/x/https/events.x.com/stream",
    "beacon https://app.localhost:8443/__locadot/x/https/metrics.x.com/b",
  ]);
});

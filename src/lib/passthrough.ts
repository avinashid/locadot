import http from "http";

/**
 * --cors pass-through: a page on a --cors domain calls other origins (api.x.com, a CDN's JSON,
 * a third-party API) by absolute URL, and the browser enforces *their* CORS policy. The shim
 * injected into its HTML sends those calls to /__locadot/x/<scheme>/<host>/<path> on the page's
 * own origin instead, so the browser sees a same-origin request, and locadot forwards it upstream
 * as the real site. No per-domain mapping needed.
 */
export const PREFIX = "/__locadot/";
export const SHIM_PATH = `${PREFIX}shim.js`;
const VIA = `${PREFIX}x/`;

export interface Via {
  scheme: "http" | "https" | "ws" | "wss";
  host: string;
  path: string;
}

/** Parses /__locadot/x/https/api.x.com:8443/v1?q → {https, api.x.com:8443, /v1?q}. */
export const parseVia = (url: string | undefined): Via | undefined => {
  const match = (url || "").match(/^\/__locadot\/x\/(https?|wss?)\/([a-z0-9.-]+(?::\d{1,5})?)(\/.*)?$/i);
  if (!match) return undefined;
  return { scheme: match[1].toLowerCase() as Via["scheme"], host: match[2].toLowerCase(), path: match[3] || "/" };
};

/** The local path the shim uses for an absolute URL; the inverse of parseVia. */
export const viaPath = (url: URL) => `${VIA}${url.protocol.slice(0, -1)}/${url.host}${url.pathname}${url.search}`;

/**
 * Only the page itself may use the pass-through. A link or form on another site would otherwise
 * turn the proxy into a way to reach any host from the user's machine.
 */
export const isSameOrigin = (req: http.IncomingMessage) => {
  const site = req.headers["sec-fetch-site"];
  if (site) return site === "same-origin";
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
};

export const shimTag = `<script src="${SHIM_PATH}"></script>`;

/** Adds the shim as the first script in <head>, so it runs before the app's own scripts. */
export const injectShim = (html: string) => {
  if (html.includes(shimTag)) return html;
  const head = html.match(/<head\b[^>]*>/i);
  if (head) return html.replace(head[0], head[0] + shimTag);
  return shimTag + html;
};

export const shimScript = `(() => {
  if (window.__locadotShim) return;
  window.__locadotShim = true;
  const VIA = ${JSON.stringify(VIA)};
  const route = (input) => {
    try {
      const url = new URL(String(input), location.href);
      if (!/^(https?|wss?):$/.test(url.protocol)) return null;
      const local = url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
      if (local || url.host === location.host) return null;
      const ws = url.protocol === "ws:" || url.protocol === "wss:";
      const base = ws ? (location.protocol === "https:" ? "wss://" : "ws://") + location.host : location.origin;
      return base + VIA + url.protocol.slice(0, -1) + "/" + url.host + url.pathname + url.search + url.hash;
    } catch (e) {
      return null;
    }
  };
  const fetch0 = window.fetch;
  if (fetch0) {
    window.fetch = function (input, init) {
      if (typeof Request !== "undefined" && input instanceof Request) {
        const to = route(input.url);
        if (to) input = new Request(to, input);
      } else {
        const to = route(input);
        if (to) input = to;
      }
      return fetch0.call(this, input, init);
    };
  }
  if (window.XMLHttpRequest) {
    const open0 = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      const args = Array.prototype.slice.call(arguments);
      const to = route(url);
      if (to) args[1] = to;
      return open0.apply(this, args);
    };
  }
  const wrap = (name) => {
    const Original = window[name];
    if (!Original) return;
    const Wrapped = function (url, options) {
      return new Original(route(url) || url, options);
    };
    Wrapped.prototype = Original.prototype;
    Object.getOwnPropertyNames(Original).forEach((key) => {
      if (!(key in Wrapped)) try { Wrapped[key] = Original[key]; } catch (e) {}
    });
    window[name] = Wrapped;
  };
  wrap("EventSource");
  wrap("WebSocket");
  if (navigator.sendBeacon) {
    const beacon0 = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => beacon0(route(url) || url, data);
  }
})();
`;

/** The site's own domain without a leading www: signalsant.com for https://www.signalsant.com. */
const siteDomain = (target: string) => new URL(target).hostname.replace(/^www\./, "");

/** api.signalsant.com is the same site as signalsant.com; a CDN or third-party API is not. */
export const isSameSite = (host: string, target: string) => {
  const hostname = host.replace(/:\d+$/, "");
  const domain = siteDomain(target);
  return hostname === domain || hostname.endsWith(`.${domain}`);
};

/** Upstream headers for a pass-through call: the request looks like it came from the real site. */
export const viaHeaders = (req: http.IncomingMessage, via: Via, target: string) => {
  const site = new URL(target).origin;
  const headers: Record<string, string> = { Origin: site };
  try {
    if (req.headers.referer) {
      const referer = new URL(req.headers.referer);
      headers.Referer = site + referer.pathname + referer.search;
    }
  } catch {}
  // The page's cookies belong to its own site; don't hand them to third parties.
  if (!isSameSite(via.host, target)) delete req.headers.cookie;
  return headers;
};

/**
 * Keeps a pass-through response on the pass-through: redirects are routed back through it,
 * host-only cookies are scoped to the upstream's path, and third-party cookies are dropped.
 */
export const rewriteViaResponse = (headers: http.IncomingHttpHeaders, via: Via, target: string) => {
  const base = `${VIA}${via.scheme}/${via.host}`;
  const location = headers.location;
  if (location) {
    if (location.startsWith("/") && !location.startsWith("//")) headers.location = base + location;
    else {
      try {
        const url = new URL(location, `${via.scheme}://${via.host}/`);
        if (/^https?:$/.test(url.protocol) && !/(^|\.)localhost$/.test(url.hostname)) headers.location = viaPath(url) + url.hash;
      } catch {}
    }
  }
  const cookies = headers["set-cookie"];
  if (!cookies) return;
  if (!isSameSite(via.host, target)) {
    delete headers["set-cookie"];
    return;
  }
  headers["set-cookie"] = cookies.map((cookie) => {
    // Domain=.signalsant.com is shared with the page on the real site, so keep its path.
    if (/;\s*domain=/i.test(cookie)) return cookie;
    const path = cookie.match(/;\s*path=([^;]*)/i)?.[1]?.trim() || "/";
    return cookie.replace(/;\s*path=[^;]*/gi, "") + `; Path=${base}${path === "/" ? "" : path}`;
  });
};

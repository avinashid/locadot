import net from "net";
import http from "http";
import https from "https";
import type { ProbeResult } from "../types";

export class InputError extends Error {}

export default class Localhost {
  /** Subdomains of localhost only; bare `localhost` is the dashboard. */
  static isValidLocalhostDomain(domain: string): boolean {
    if (!domain || domain.length > 253) return false;
    const labels = domain.toLowerCase().split(".");
    if (labels.length < 2 || labels.pop() !== "localhost") return false;
    return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  }

  static normalizeHost(domain: string) {
    const host = String(domain || "").trim().toLowerCase().replace(/\.$/, "");
    if (!Localhost.isValidLocalhostDomain(host)) return undefined;
    return host;
  }

  static parsePort(value: string | number): number {
    const text = String(value).trim();
    const port = Number(text);
    if (!/^\d+$/.test(text) || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new InputError(`❌ Invalid port "${value}". Use a number between 1 and 65535.`);
    }
    return port;
  }

  /**
   * Accepts a port (3000), host:port (127.0.0.1:3000) or a full URL
   * (https://google.com, http://192.168.1.5:8080/app). Returns a normalized URL.
   */
  static parseTarget(value: string | number): string {
    const text = String(value).trim();
    if (/^\d+$/.test(text)) return `http://localhost:${Localhost.parsePort(text)}`;

    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      throw new InputError(`❌ Invalid target "${value}". Use a port, host:port or a URL like https://example.com.`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new InputError(`❌ Unsupported target protocol "${url.protocol}". Use http:// or https://.`);
    }
    if (!url.hostname) throw new InputError(`❌ Target "${value}" has no host.`);
    if (url.port) Localhost.parsePort(url.port);
    if (url.username || url.password) {
      throw new InputError("❌ Credentials in the target URL are not supported.");
    }
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  }

  static isLocalTarget(target: string) {
    const { hostname } = new URL(target);
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) || hostname.endsWith(".localhost");
  }

  /** Any HTTP response (even 404/500) counts as up: the upstream is reachable. */
  static probe(target: string, timeoutMs = 1500, insecure = false): Promise<ProbeResult> {
    const started = Date.now();
    return new Promise((resolve) => {
      let url: URL;
      try {
        url = new URL(target);
      } catch {
        return resolve({ up: false, error: "invalid target" });
      }
      const client = url.protocol === "https:" ? https : http;
      const req = client.request(
        url,
        { method: "HEAD", timeout: timeoutMs, rejectUnauthorized: !insecure },
        (res) => {
          res.resume();
          resolve({ up: true, status: res.statusCode, ms: Date.now() - started });
        }
      );
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", (error: any) =>
        resolve({ up: false, error: error?.code || error?.message || "error", ms: Date.now() - started })
      );
      req.end();
    });
  }

  static isPortListening(port: number, host = "127.0.0.1", timeoutMs = 800): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.connect({ port, host });
      const done = (result: boolean) => {
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(timeoutMs, () => done(false));
      socket.once("connect", () => done(true));
      socket.once("error", () => done(false));
    });
  }
}

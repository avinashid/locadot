import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import Constants from "../constants";
import logger from "../utils/logger";
import type { HostEntry, TunnelState } from "../types";

/**
 * Public sharing through Cloudflare quick tunnels (https://<random>.trycloudflare.com, no account).
 * cloudflared forwards to the proxy's HTTP port with the public Host header, and the proxy maps
 * that name back to the mapping, so redirects and cookies stay on the public name.
 */

const exe = os.platform() === "win32" ? "cloudflared.exe" : "cloudflared";
const BIN_DIR = path.join(Constants.paths.HOME, "bin");
const RELEASES = "https://github.com/cloudflare/cloudflared/releases/latest/download/";
const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

const onPath = () => {
  const finder = os.platform() === "win32" ? "where" : "which";
  const result = spawnSync(finder, ["cloudflared"], { encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.split(/\r?\n/)[0].trim() || undefined : undefined;
};

/** LOCADOT_CLOUDFLARED, then the copy `locadot tunnel:install` downloaded, then PATH. */
export const cloudflaredPath = () => {
  const candidates = [process.env.LOCADOT_CLOUDFLARED, path.join(BIN_DIR, exe)].filter(Boolean) as string[];
  return candidates.find((file) => fs.existsSync(file)) || onPath();
};

export interface CloudflaredInfo {
  installed: boolean;
  path?: string;
  version?: string;
}

// The dashboard polls status every few seconds; don't spawn cloudflared --version each time.
let cached: { at: number; info: CloudflaredInfo } | undefined;

export const cloudflaredInfo = (fresh = false): CloudflaredInfo => {
  if (!fresh && cached && Date.now() - cached.at < 60_000) return cached.info;
  const file = cloudflaredPath();
  let info: CloudflaredInfo = { installed: false };
  if (file) {
    const result = spawnSync(file, ["--version"], { encoding: "utf8", timeout: 5000, windowsHide: true });
    const version = `${result.stdout || ""}${result.stderr || ""}`.match(/version\s+(\S+)/i)?.[1];
    info = { installed: result.status === 0, path: file, ...(version ? { version } : {}) };
  }
  cached = { at: Date.now(), info };
  return info;
};

const asset = () => {
  const arch = { x64: "amd64", arm64: "arm64", arm: "arm", ia32: "386" }[os.arch() as string];
  const platform = os.platform();
  if (!arch) return undefined;
  if (platform === "linux") return `cloudflared-linux-${arch}`;
  if (platform === "darwin" && (arch === "amd64" || arch === "arm64")) return `cloudflared-darwin-${arch}.tgz`;
  if (platform === "win32" && (arch === "amd64" || arch === "386")) return `cloudflared-windows-${arch}.exe`;
  return undefined;
};

const download = (url: string, file: string, redirects = 5): Promise<void> =>
  new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "locadot" }, timeout: 30_000 }, (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
          res.resume();
          download(new URL(res.headers.location, url).href, file, redirects - 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`download failed: HTTP ${status} for ${url}`));
          return;
        }
        const out = fs.createWriteStream(file, { mode: 0o755 });
        res.pipe(out);
        out.on("finish", () => out.close(() => resolve()));
        out.on("error", reject);
        res.on("error", reject);
      })
      .on("timeout", function (this: any) {
        this.destroy(new Error("download timed out"));
      })
      .on("error", reject);
  });

/** Downloads the official cloudflared release for this OS into <state dir>/bin. */
export const installCloudflared = async () => {
  const name = asset();
  if (!name) {
    throw new Error(`No cloudflared build for ${os.platform()}/${os.arch()}. Install it yourself: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/`);
  }
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const target = path.join(BIN_DIR, exe);
  const partial = path.join(BIN_DIR, `${name}.part`);
  try {
    await download(RELEASES + name, partial);
    if (name.endsWith(".tgz")) {
      const untar = spawnSync("tar", ["-xzf", partial, "-C", BIN_DIR], { encoding: "utf8", windowsHide: true });
      if (untar.status !== 0) throw new Error(`could not unpack ${name}: ${untar.stderr}`);
    } else {
      fs.renameSync(partial, target);
    }
    fs.chmodSync(target, 0o755);
  } finally {
    fs.rmSync(partial, { force: true });
  }
  const info = cloudflaredInfo(true);
  if (!info.installed) throw new Error(`cloudflared was downloaded to ${target} but doesn't run on this machine.`);
  return info;
};

type Running = TunnelState & { child?: ChildProcess; publicHost?: string };

/** Runs one cloudflared per mapping with `tunnel: true`; lives inside the proxy process. */
export class TunnelManager {
  private tunnels = new Map<string, Running>();

  constructor(private origin: () => string) {}

  /** The mapping a public trycloudflare.com Host belongs to. */
  hostFor(publicHost: string) {
    for (const [host, tunnel] of this.tunnels) if (tunnel.publicHost === publicHost) return host;
    return undefined;
  }

  state(host: string): TunnelState {
    const tunnel = this.tunnels.get(host);
    if (!tunnel) return { enabled: false, status: "off" };
    const { child, publicHost, ...state } = tunnel;
    return state;
  }

  /** Starts and stops tunnels to match the registry; `retry` also restarts ones that failed. */
  sync(hosts: Record<string, HostEntry>, retry = false) {
    for (const [host, tunnel] of [...this.tunnels]) if (!hosts[host]?.tunnel || (retry && tunnel.status === "error")) this.stop(host);
    for (const [host, entry] of Object.entries(hosts)) if (entry.tunnel && !this.tunnels.has(host)) this.start(host);
  }

  private start(host: string) {
    const file = cloudflaredPath();
    if (!file) {
      this.tunnels.set(host, { enabled: true, status: "error", error: "cloudflared is not installed. Run `locadot tunnel:install`." });
      return;
    }
    const tunnel: Running = { enabled: true, status: "starting" };
    this.tunnels.set(host, tunnel);
    // An empty config file keeps a user's ~/.cloudflared/config.yml (named tunnels) out of the way.
    const config = path.join(Constants.paths.HOME, "cloudflared-quick.yml");
    fs.writeFileSync(config, "");
    const child = spawn(file, ["tunnel", "--no-autoupdate", "--config", config, "--url", this.origin()], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    tunnel.child = child;
    let tail = "";
    const read = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      tail = (tail + text).slice(-2000);
      const url = text.match(URL_PATTERN)?.[0];
      if (url && tunnel.status !== "up") {
        Object.assign(tunnel, { status: "up", url, publicHost: new URL(url).hostname });
        logger.info(`🌍 ${host} is public at ${url}`);
      }
    };
    child.stdout?.on("data", read);
    child.stderr?.on("data", read);
    child.on("error", (error) => Object.assign(tunnel, { status: "error", error: error.message, child: undefined }));
    child.on("exit", (code) => {
      if (this.tunnels.get(host) !== tunnel) return;
      const reason = tail.split(/\r?\n/).filter((line) => /ERR|error|failed/i.test(line)).pop()?.trim();
      Object.assign(tunnel, { status: "error", error: reason || `cloudflared exited (${code})`, url: undefined, publicHost: undefined, child: undefined });
      logger.warn(`🌍 tunnel for ${host} stopped: ${tunnel.error}`);
    });
  }

  stop(host: string) {
    const tunnel = this.tunnels.get(host);
    this.tunnels.delete(host);
    if (tunnel?.child) {
      tunnel.child.kill();
      logger.info(`🌍 ${host} is no longer public`);
    }
  }

  stopAll() {
    for (const host of [...this.tunnels.keys()]) this.stop(host);
  }
}

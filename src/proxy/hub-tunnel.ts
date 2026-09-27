import fs from "fs";
import os from "os";
import path from "path";
import { spawn, type ChildProcess } from "child_process";
import Constants from "../constants";
import logger from "../utils/logger";
import HubConfigStore from "../lib/hub-config";
import { cloudflaredPath } from "./tunnel";
import type { HubConfig, HubState } from "../types";

/**
 * Runs the sender's own cloudflared, mirroring TunnelManager in tunnel.ts but for a single
 * public hostname instead of one tunnel per mapping.
 */

const QUICK_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
const REGISTERED_PATTERN = /Registered tunnel connection/i;
const HTTPS_URL_PATTERN = /https:\/\/\S+/;
const LOGIN_WAIT_MS = 10 * 60_000;
const DEFAULT_TUNNEL = "locadot";

const isHostname = (value: string) => {
  if (!value || value.length > 253) return false;
  const labels = value.toLowerCase().split(".");
  return labels.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
};

const trimSlash = (value: string) => value.replace(/\/$/, "");

const configEqual = (a: HubConfig | undefined, b: HubConfig | undefined) => {
  if (!a || !b) return a === b;
  return a.mode === b.mode && a.domain === b.domain && a.tunnel === b.tunnel && a.url === b.url;
};

type Running = { child: ChildProcess; tail: string };

export class HubTunnel {
  private applied?: { config: HubConfig | undefined; origin: string };
  private st: HubState = { enabled: false, status: "off" };
  private running?: Running;

  constructor(private origin: () => string) {}

  state(): HubState {
    return { ...this.st };
  }

  /** hostname of state().url when up (manual mode too: the configured url). */
  publicHost(): string | undefined {
    if (this.st.status !== "up" || !this.st.url) return undefined;
    try {
      return new URL(this.st.url).hostname;
    } catch {
      return undefined;
    }
  }

  sync(config: HubConfig | undefined): void {
    const origin = this.origin();
    if (this.applied && configEqual(this.applied.config, config) && this.applied.origin === origin) return;
    this.killChild();
    this.applied = { config, origin };

    if (!config) {
      this.st = { enabled: false, status: "off" };
      return;
    }
    if (config.mode === "manual") {
      const url = config.url ? trimSlash(config.url) : undefined;
      this.st = url
        ? { enabled: true, mode: "manual", status: "up", url }
        : { enabled: true, mode: "manual", status: "error", error: "No url configured." };
      return;
    }
    const file = cloudflaredPath();
    if (!file) {
      this.st = { enabled: true, mode: config.mode, status: "error", error: "cloudflared is not installed. Run `locadot tunnel:install`." };
      return;
    }
    this.st = { enabled: true, mode: config.mode, status: "starting" };
    if (config.mode === "quick") this.startQuick(file, origin);
    else this.startNamed(file, config, origin);
  }

  private startQuick(file: string, origin: string) {
    const config = path.join(Constants.paths.HOME, "cloudflared-hub-quick.yml");
    fs.writeFileSync(config, "");
    const child = spawn(file, ["tunnel", "--no-autoupdate", "--config", config, "--url", origin], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    this.attach(child, (text) => {
      const url = text.match(QUICK_URL_PATTERN)?.[0];
      if (url && this.st.status !== "up") {
        this.st = { ...this.st, status: "up", url };
        logger.info(`🌍 hub is public at ${url}`);
      }
    });
  }

  private startNamed(file: string, config: HubConfig, origin: string) {
    const tunnel = config.tunnel || DEFAULT_TUNNEL;
    const child = spawn(file, ["tunnel", "--no-autoupdate", "run", "--url", origin, tunnel], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    this.attach(child, (text) => {
      if (REGISTERED_PATTERN.test(text) && this.st.status !== "up") {
        const url = `https://${config.domain}`;
        this.st = { ...this.st, status: "up", url };
        logger.info(`🌍 hub is public at ${url}`);
      }
    });
  }

  private attach(child: ChildProcess, onData: (text: string) => void) {
    const running: Running = { child, tail: "" };
    this.running = running;
    const read = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      running.tail = (running.tail + text).slice(-2000);
      onData(text);
    };
    child.stdout?.on("data", read);
    child.stderr?.on("data", read);
    child.on("error", (error) => {
      if (this.running !== running) return;
      this.st = { ...this.st, status: "error", error: error.message };
      this.running = undefined;
    });
    child.on("exit", (code) => {
      if (this.running !== running) return;
      const reason = running.tail
        .split(/\r?\n/)
        .filter((line) => /ERR|error|failed/i.test(line))
        .pop()
        ?.trim();
      this.st = { ...this.st, status: "error", error: reason || `cloudflared exited (${code})`, url: undefined };
      this.running = undefined;
      logger.warn(`🌍 hub tunnel stopped: ${this.st.error}`);
    });
  }

  private killChild() {
    this.running?.child.kill();
    this.running = undefined;
  }

  /** Background named-tunnel setup: reflects progress (incl. loginUrl) in state() rather than throwing. */
  setupNamed(domain: string, tunnel?: string): Promise<void> {
    this.st = { enabled: true, mode: "named", status: "login" };
    return setupNamedTunnel(domain, tunnel, (url) => {
      this.st = { ...this.st, loginUrl: url };
    })
      .then((config) => {
        HubConfigStore.write(config);
        this.applied = undefined; // force sync() to (re)apply the fresh config
        this.sync(config);
      })
      .catch((error: any) => {
        this.st = { enabled: true, mode: "named", status: "error", error: error?.message || String(error) };
      });
  }

  stop(): void {
    this.killChild();
    this.applied = undefined;
    this.st = { enabled: false, status: "off" };
  }
}

const runCapture = (
  file: string,
  args: string[],
  opts: { onData?: (text: string) => void; timeoutMs?: number } = {}
): Promise<{ code: number | null; output: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let output = "";
    let done = false;
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          if (done) return;
          done = true;
          child.kill();
          reject(new Error(`${args.join(" ")} timed out`));
        }, opts.timeoutMs)
      : undefined;
    const read = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      output += text;
      opts.onData?.(text);
    };
    child.stdout?.on("data", read);
    child.stderr?.on("data", read);
    child.on("error", (error) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve({ code, output });
    });
  });

/**
 * Used by the CLI (outside the proxy). Logs in if ~/.cloudflared/cert.pem is missing, creates the
 * tunnel (reusing an existing one), routes DNS with --overwrite-dns.
 */
export async function setupNamedTunnel(
  domain: string,
  tunnel = DEFAULT_TUNNEL,
  onLoginUrl?: (url: string) => void
): Promise<HubConfig> {
  if (!isHostname(domain)) throw new Error(`Invalid domain "${domain}".`);
  const file = cloudflaredPath();
  if (!file) throw new Error("cloudflared is not installed. Run `locadot tunnel:install`.");

  const certPath = path.join(os.homedir(), ".cloudflared", "cert.pem");
  if (!fs.existsSync(certPath)) {
    let announced = false;
    const login = await runCapture(file, ["tunnel", "login"], {
      timeoutMs: LOGIN_WAIT_MS,
      onData: (text) => {
        if (announced) return;
        const url = text.match(HTTPS_URL_PATTERN)?.[0];
        if (url) {
          announced = true;
          onLoginUrl?.(url);
        }
      },
    });
    if (login.code !== 0) throw new Error(`cloudflared login failed: ${login.output.trim().slice(-500)}`);
  }

  const create = await runCapture(file, ["tunnel", "create", tunnel]);
  if (create.code !== 0 && !/already exists/i.test(create.output)) {
    throw new Error(`cloudflared tunnel create failed: ${create.output.trim().slice(-500)}`);
  }

  const route = await runCapture(file, ["tunnel", "route", "dns", "--overwrite-dns", tunnel, domain]);
  if (route.code !== 0) throw new Error(`cloudflared tunnel route dns failed: ${route.output.trim().slice(-500)}`);

  return { mode: "named", domain, tunnel };
}

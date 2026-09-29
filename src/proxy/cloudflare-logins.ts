import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import Constants from "../constants";
import logger from "../utils/logger";
import { cloudflaredPath } from "./tunnel";

/**
 * Cloudflare logins for custom-domain sharing. `cloudflared tunnel login` authorizes a single zone,
 * so each login is kept as <state>/cloudflare/<zone>.pem and the one whose zone covers a hostname
 * is used; ~/.cloudflared/cert.pem counts as one but is never written. A cert's zone is looked up
 * with the API token inside it.
 */

const DIR = path.join(Constants.paths.HOME, "cloudflare");
const ZONES_FILE = path.join(DIR, "zones.json");
const LOGIN_WAIT_MS = 10 * 60_000;
const API = () => process.env.LOCADOT_CLOUDFLARE_API || "https://api.cloudflare.com/client/v4";

const defaultCert = () => path.join(os.homedir(), ".cloudflared", "cert.pem");

type CertToken = { zoneID: string; accountID: string; apiToken: string };

const readToken = (file: string): CertToken | undefined => {
  try {
    const body = fs.readFileSync(file, "utf8").match(/-----BEGIN ARGO TUNNEL TOKEN-----([\s\S]*?)-----END/)?.[1];
    const token = body && JSON.parse(Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8"));
    return token?.zoneID ? token : undefined;
  } catch {
    return undefined;
  }
};

/** zoneID → zone name, learned from the API or from where cloudflared put a DNS record. */
const readZones = (): Record<string, string> => {
  try {
    return JSON.parse(fs.readFileSync(ZONES_FILE, "utf8"));
  } catch {
    return {};
  }
};

const rememberZone = (zoneID: string, zone: string) => {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(ZONES_FILE, JSON.stringify({ ...readZones(), [zoneID]: zone }, null, 2));
};

const certFiles = () => {
  const stored = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".pem")).map((f) => path.join(DIR, f)) : [];
  return [defaultCert(), ...stored].filter((file) => fs.existsSync(file));
};

export const covers = (zone: string, hostname: string) => hostname === zone || hostname.endsWith(`.${zone}`);

/** Zones there's a login for, as far as they're known (no network). */
export const loggedInZones = () => {
  const zones = readZones();
  return [...new Set(certFiles().map((file) => zones[readToken(file)?.zoneID || ""]).filter(Boolean))].sort();
};

const zoneOf = async (file: string): Promise<string | undefined> => {
  const token = readToken(file);
  if (!token) return undefined;
  const known = readZones()[token.zoneID];
  if (known) return known;
  try {
    const res = await fetch(`${API()}/zones/${token.zoneID}`, {
      headers: { Authorization: `Bearer ${token.apiToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const name = ((await res.json()) as any)?.result?.name;
    if (res.ok && typeof name === "string") {
      rememberZone(token.zoneID, name);
      return name;
    }
    logger.warn(`🌍 couldn't look up the zone of a Cloudflare login: HTTP ${res.status}`);
  } catch (error: any) {
    logger.warn(`🌍 couldn't look up the zone of a Cloudflare login: ${error?.cause?.message || error?.message || error}`);
  }
  return undefined;
};

export const runCapture = (
  file: string,
  args: string[],
  opts: { onData?: (text: string) => void; timeoutMs?: number; env?: NodeJS.ProcessEnv; signal?: AbortSignal } = {}
): Promise<{ code: number | null; output: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: opts.env, signal: opts.signal });
    let output = "";
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      fn();
    };
    const timer = opts.timeoutMs
      ? setTimeout(() => finish(() => (child.kill(), reject(new Error(`${args.join(" ")} timed out`)))), opts.timeoutMs)
      : undefined;
    const read = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      output += text;
      opts.onData?.(text);
    };
    child.stdout?.on("data", read);
    child.stderr?.on("data", read);
    child.on("error", (error) => finish(() => reject(error)));
    child.on("exit", (code) => finish(() => resolve({ code, output })));
  });

/** Runs `cloudflared tunnel login` against a scratch home so the new cert never replaces an existing one. */
const signIn = async (file: string, onLoginUrl: (url: string) => void, signal?: AbortSignal) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-cf-login-"));
  try {
    let announced = false;
    const login = await runCapture(file, ["tunnel", "login"], {
      timeoutMs: LOGIN_WAIT_MS,
      signal,
      env: { ...process.env, HOME: home, USERPROFILE: home },
      onData: (text) => {
        const url = !announced && text.match(/https:\/\/\S+/)?.[0];
        if (url) {
          announced = true;
          onLoginUrl(url);
        }
      },
    }).catch((error) => {
      throw new Error(/timed out/.test(error.message) ? "The Cloudflare sign-in wasn't finished within 10 minutes." : error.message);
    });
    const cert = path.join(home, ".cloudflared", "cert.pem");
    const token = readToken(cert);
    if (login.code !== 0 || !token) throw new Error(`Cloudflare sign-in failed: ${login.output.trim().slice(-300) || `cloudflared exited (${login.code})`}`);
    fs.mkdirSync(DIR, { recursive: true });
    const staged = path.join(DIR, `${token.zoneID}.pem`);
    fs.copyFileSync(cert, staged);
    fs.chmodSync(staged, 0o600);
    const zone = await zoneOf(staged);
    if (!zone) return staged;
    const named = path.join(DIR, `${zone}.pem`);
    fs.renameSync(staged, named);
    return named;
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
};

const notAuthorized = (domain: string, zone: string) =>
  new Error(
    `Your Cloudflare sign-in authorized ${zone}, which doesn't include ${domain}. Share again and pick the zone ${domain} belongs to, or add that domain to your Cloudflare account first.`
  );

export interface DomainTunnel {
  cert: string;
  credentials?: string;
}

/**
 * Makes `name` a named tunnel serving `domain`: uses the login whose zone covers it, or signs in
 * (reporting the URL through onLoginUrl), creates the tunnel and routes the DNS record.
 * Throws a readable error when no login covers the domain.
 */
export async function setupDomainTunnel(
  domain: string,
  name: string,
  onLoginUrl: (url: string) => void,
  signal?: AbortSignal
): Promise<DomainTunnel> {
  const file = cloudflaredPath();
  if (!file) throw new Error("cloudflared is not installed. Run `locadot tunnel:install`.");

  let cert: string | undefined;
  const unknown: string[] = [];
  for (const candidate of certFiles()) {
    const zone = await zoneOf(candidate);
    if (zone && covers(zone, domain)) {
      cert = candidate;
      break;
    }
    if (!zone) unknown.push(candidate);
  }
  // A login whose zone couldn't be looked up is tried; route dns shows which zone it's for.
  cert ||= unknown[0];
  if (!cert) {
    cert = await signIn(file, onLoginUrl, signal);
    const zone = await zoneOf(cert);
    if (zone && !covers(zone, domain)) throw notAuthorized(domain, zone);
  }

  const token = readToken(cert)!;
  const credentials = path.join(DIR, "tunnels", token.accountID, `${name}.json`);
  fs.mkdirSync(path.dirname(credentials), { recursive: true });
  const create = await runCapture(file, ["tunnel", "--origincert", cert, "create", "--credentials-file", credentials, name], { signal });
  if (create.code !== 0 && !/already exists/i.test(create.output)) {
    throw new Error(`cloudflared tunnel create failed: ${create.output.trim().slice(-500)}`);
  }

  const route = await runCapture(file, ["tunnel", "--origincert", cert, "route", "dns", "--overwrite-dns", name, domain], { signal });
  if (route.code !== 0) throw new Error(`cloudflared tunnel route dns failed: ${route.output.trim().slice(-500)}`);
  // Outside the login's zone, cloudflared appends the zone and "succeeds" with <domain>.<zone>.
  const routed = route.output.match(/Added CNAME (\S+)/i)?.[1] || route.output.match(/(\S+) is already configured to route/i)?.[1];
  if (routed && routed.toLowerCase().replace(/\.$/, "") !== domain) {
    const zone = routed.toLowerCase().startsWith(`${domain}.`) ? routed.slice(domain.length + 1) : undefined;
    if (zone) rememberZone(token.zoneID, zone);
    throw new Error(
      `${domain} isn't in the Cloudflare zone this login is for${zone ? ` (${zone})` : ""}; cloudflared created ${routed} instead. Delete that record in Cloudflare, then share again to sign in for ${domain}'s zone.`
    );
  }

  return { cert, credentials: fs.existsSync(credentials) ? credentials : undefined };
}

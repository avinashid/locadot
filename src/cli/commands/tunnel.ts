import http from "http";
import Localhost, { InputError } from "../../lib/localhost";
import HostOps from "../../lib/hosts";
import Constants from "../../constants";
import { cloudflaredInfo, installCloudflared } from "../../proxy/tunnel";
import FileModule from "../../utils/file";
import type { TunnelState } from "../../types";
import { ensureRunning, print } from "../shared";

const TUNNEL_TIMEOUT_MS = 45_000;

type TunnelRow = { host: string; tunnel: TunnelState };

/** Tunnel state lives in the proxy process; ask it over the local read-only API. */
const tunnelRows = () =>
  new Promise<TunnelRow[]>((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port: Constants.server.httpPort, path: "/api/hosts", headers: { Host: "localhost", "X-Locadot-Token": FileModule.read("API_TOKEN")?.trim() || "" }, timeout: 5000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve((JSON.parse(body) as Partial<TunnelRow>[]).filter((row): row is TunnelRow => Boolean(row.tunnel?.enabled)));
        } catch {
          reject(new InputError("❌ The proxy didn't answer /api/hosts. Is it running? Try `locadot status`."));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => reject(new InputError("❌ The proxy isn't running. Run `locadot start`.")));
  });

export async function installTunnel() {
  const existing = cloudflaredInfo(true);
  if (existing.installed) {
    print(`☑️ cloudflared ${existing.version ?? ""} is already installed (${existing.path}).`);
    return;
  }
  print("⬇️  Downloading cloudflared from github.com/cloudflare/cloudflared…");
  const info = await installCloudflared();
  print(`✅ cloudflared ${info.version ?? ""} installed at ${info.path}`);
}

/** Shares a mapping on a public trycloudflare.com URL or `--domain`, or lists what's shared when no host is given. */
export async function tunnel(options: { host?: string; off?: boolean; domain?: string }) {
  if (!options.host) {
    const shared = await tunnelRows();
    if (!shared.length) print("Nothing is shared. Share a mapping: locadot tunnel --host app.localhost");
    for (const row of shared) print(`${row.host}  →  ${row.tunnel.url ?? row.tunnel.status}${row.tunnel.error ? ` (${row.tunnel.error})` : ""}`);
    return;
  }
  const host = Localhost.requireHost(options.host);
  if (options.off) {
    await HostOps.setTunnel({ host, tunnel: false });
    print(`🔒 ${host} is no longer public.`);
    return;
  }
  if (!cloudflaredInfo(true).installed) await installTunnel();
  // The proxy leaves a failed tunnel alone when the registry doesn't change, so clear it first to retry.
  const current = await tunnelRows().then((rows) => rows.find((row) => row.host === host)?.tunnel, () => undefined);
  if (current?.status === "error") {
    await HostOps.setTunnel({ host, tunnel: false });
    for (let i = 0; i < 20; i++) {
      const state = await tunnelRows().then((rows) => rows.find((row) => row.host === host)?.tunnel, () => undefined);
      if (!state || state.status === "off") break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  await HostOps.setTunnel({ host, tunnel: true, domain: options.domain });
  await ensureRunning();
  let deadline = Date.now() + TUNNEL_TIMEOUT_MS;
  let loginShown = false;
  while (Date.now() < deadline) {
    const state = (await tunnelRows()).find((row) => row.host === host)?.tunnel;
    if (state?.status === "login" && state.loginUrl && !loginShown) {
      loginShown = true;
      deadline = Date.now() + 10 * 60_000;
      print(`🔑 Log in to Cloudflare to finish${state.domain ? ` and pick the zone ${state.domain} is in` : ""}: ${state.loginUrl}`);
    }
    if (state?.status === "up") {
      print(`🌍 ${host} is public at ${state.url}`);
      print("   Anyone with the link can reach it. Stop with: locadot tunnel --host " + host + " --off");
      return;
    }
    if (state?.status === "error") throw new InputError(`❌ Tunnel for ${host} failed: ${state.error}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new InputError(`❌ Tunnel for ${host} didn't come up within ${TUNNEL_TIMEOUT_MS / 1000}s. See \`locadot logs\`.`);
}

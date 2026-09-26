import http from "http";
import Localhost, { InputError } from "../../lib/localhost";
import HostOps from "../../lib/hosts";
import Constants from "../../constants";
import { cloudflaredInfo, installCloudflared } from "../../proxy/tunnel";
import type { TunnelState } from "../../types";
import { ensureRunning, print } from "../shared";

const TUNNEL_TIMEOUT_MS = 45_000;

type TunnelRow = { host: string; tunnel: TunnelState };

/** Tunnel state lives in the proxy process; ask it over the local read-only API. */
const tunnelRows = () =>
  new Promise<TunnelRow[]>((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port: Constants.server.httpPort, path: "/api/hosts", headers: { Host: "localhost" }, timeout: 5000 }, (res) => {
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

/** Shares a mapping on a public trycloudflare.com URL, or lists what's shared when no host is given. */
export async function tunnel(options: { host?: string; off?: boolean }) {
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
  await HostOps.setTunnel({ host, tunnel: true });
  await ensureRunning();
  const deadline = Date.now() + TUNNEL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = (await tunnelRows()).find((row) => row.host === host)?.tunnel;
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

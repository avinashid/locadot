import http from "http";
import Constants from "../../constants";
import locadotProxy from "../../lib/proxy-control";
import { InputError } from "../../lib/localhost";
import { urlFor } from "../../lib/urls";
import RegistryStore from "../../lib/registry";
import FileModule from "../../utils/file";
import Links from "../../lib/links";
import HubConfigStore from "../../lib/hub-config";
import { setupNamedTunnel } from "../../proxy/hub-tunnel";
import Remotes from "../../lib/remotes";
import type { HubConfig, HubState, Remote, Role } from "../../types";
import { print } from "../shared";

const ROLES: Role[] = ["viewer", "editor", "admin"];

const requireRole = (value: unknown): Role => {
  if (typeof value !== "string" || !ROLES.includes(value as Role)) {
    throw new InputError(`❌ Invalid role "${value}". Use viewer, editor or admin.`);
  }
  return value as Role;
};

const splitHosts = (value?: string) =>
  value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

const requireRunning = () => {
  if (!locadotProxy.running()) throw new InputError("❌ The proxy isn't running. Run `locadot start`.");
};

const apiToken = () => {
  const token = locadotProxy.running() ? FileModule.read("API_TOKEN")?.trim() : undefined;
  if (!token) throw new InputError("❌ No API token found. Run `locadot start`.");
  return token;
};

/** Talks to the running proxy's local dashboard API on its HTTP port. */
const dashboardRequest = (method: string, path: string, options: { headers?: Record<string, string>; body?: unknown } = {}) =>
  new Promise<{ status: number; json: any }>((resolve, reject) => {
    const data = options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const token = FileModule.read("API_TOKEN")?.trim();
    const req = http.request(
      {
        host: "127.0.0.1",
        port: Constants.server.httpPort,
        path,
        method,
        headers: {
          Host: "localhost",
          // Reads need it too once the dashboard has a password.
          ...(token ? { "X-Locadot-Token": token } : {}),
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
          ...options.headers,
        },
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode || 0, json: body ? JSON.parse(body) : undefined });
          } catch {
            reject(new InputError("❌ The proxy didn't answer. Is it running? Try `locadot status`."));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => reject(new InputError("❌ The proxy isn't running. Run `locadot start`.")));
    if (data) req.write(data);
    req.end();
  });

const getHub = async (): Promise<{ hub: HubState; config: HubConfig | null; panel?: boolean; invites: unknown[]; peers: unknown[] }> => {
  requireRunning();
  const { status, json } = await dashboardRequest("GET", "/api/hub");
  if (status !== 200) throw new InputError("❌ Couldn't read hub status. Try `locadot status`.");
  return json;
};

const HUB_EMOJI: Record<HubState["status"], string> = { off: "🔒", starting: "⏳", up: "🌍", error: "❌", login: "🔑" };

export async function hub(options: { json?: boolean }) {
  const { hub, panel } = await getHub();
  if (options.json) {
    console.log(JSON.stringify(hub, null, 2));
    return;
  }
  if (!hub.enabled) {
    print("🔒 Remote access is off. Turn it on: locadot hub:setup / hub:quick / hub:manual");
    return;
  }
  print(`${HUB_EMOJI[hub.status] ?? "❔"} ${hub.mode} — ${hub.status}${hub.url ? `: ${hub.url}` : ""}`);
  if (hub.loginUrl) print(`   Open to finish login: ${hub.loginUrl}`);
  if (hub.error) print(`   ${hub.error}`);
  if (panel) print(`   Dashboard shared${hub.url ? ` at ${hub.url}` : ""} (password sign-in). Turn off: locadot hub:panel off`);
}

export async function hubSetup(options: { domain?: string; tunnel?: string }) {
  if (!options.domain) throw new InputError("❌ Missing --domain <domain>.");
  print(`🔗 Setting up a named tunnel for ${options.domain}…`);
  const config = await setupNamedTunnel(options.domain, options.tunnel, (loginUrl: string) => {
    print(`🔑 Open this URL to log in to Cloudflare: ${loginUrl}`);
    print("   Waiting for login…");
  });
  HubConfigStore.write(config);
  print(`✅ Hub configured: https://${options.domain}`);
  print("   The running proxy watches this and starts the tunnel automatically. Not running? `locadot start`.");
}

export async function hubQuick() {
  HubConfigStore.write({ mode: "quick" });
  print("🌍 Quick tunnel enabled (trycloudflare.com).");
  print("⚠️  The trycloudflare URL changes whenever cloudflared or the proxy restarts.");
  print("   When that happens, tell receivers to run: locadot remote:url <name> <new-url>");
  print("   Check the current URL any time: locadot hub");
  print("   The running proxy watches this and starts the tunnel automatically. Not running? `locadot start`.");
}

export async function hubManual(options: { url?: string }) {
  if (!options.url) throw new InputError("❌ Missing --url <url>.");
  let parsed: URL;
  try {
    parsed = new URL(options.url);
  } catch {
    throw new InputError(`❌ Invalid URL "${options.url}".`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InputError(`❌ Invalid URL "${options.url}". Use http:// or https://.`);
  }
  HubConfigStore.write({ mode: "manual", url: options.url.replace(/\/+$/, "") });
  print(`✅ Hub configured: ${parsed.origin}`);
  print("   The running proxy watches this automatically. Not running? `locadot start`.");
}

export async function hubOff() {
  HubConfigStore.clear();
  print("🔒 Remote access turned off.");
}

export async function hubLocalhost(value: string) {
  if (value !== "on" && value !== "off") throw new InputError('❌ Use "on" or "off".');
  requireRunning();
  const { status, json } = await dashboardRequest("PUT", "/api/hub/localhost", {
    headers: { "X-Locadot-Token": apiToken() },
    body: { enabled: value === "on" },
  });
  if (status === 400) throw new InputError(`❌ ${json?.error || "Set up the hub first: locadot hub:setup / hub:quick / hub:manual."}`);
  if (status !== 200) throw new InputError(`❌ Couldn't update (${status})${json?.error ? `: ${json.error}` : ""}.`);
  print(json.localhost ? "🖥️  Admin peers can now reach this machine's localhost." : "🔒 Admin peers can no longer reach this machine's localhost.");
}

export async function hubPanel(value: string) {
  if (value !== "on" && value !== "off") throw new InputError('❌ Use "on" or "off".');
  requireRunning();
  const { status, json } = await dashboardRequest("PUT", "/api/hub/panel", {
    headers: { "X-Locadot-Token": apiToken() },
    body: { enabled: value === "on" },
  });
  if (status === 400) throw new InputError(`❌ ${json?.error || "Set up the hub first: locadot hub:setup / hub:quick / hub:manual."}${json?.hint ? ` ${json.hint}` : ""}`);
  if (status !== 200) throw new InputError(`❌ Couldn't update (${status})${json?.error ? `: ${json.error}` : ""}.`);
  if (!json.panel) return print("🔒 The dashboard is no longer shared.");
  const { hub } = await getHub();
  print(`🌍 The dashboard is shared${hub.url ? ` at ${hub.url}` : ""}. Visitors sign in with the dashboard password.`);
}

export async function share(options: { role?: string; hosts?: string }) {
  const role = requireRole(options.role);
  if (options.hosts && role !== "viewer") {
    print(`⚠️  --hosts is ignored for ${role}s: they see every host.`);
  }
  const hosts = role === "viewer" ? splitHosts(options.hosts) : undefined;
  requireRunning();
  const { status, json } = await dashboardRequest("POST", "/api/invites", {
    headers: { "X-Locadot-Token": apiToken() },
    body: { role, hosts },
  });
  if (status === 409) {
    throw new InputError("❌ The hub isn't up. Set it up first: locadot hub:setup / hub:quick / hub:manual.");
  }
  if (status !== 200 && status !== 201) {
    throw new InputError(`❌ Couldn't create an invite (${status})${json?.error ? `: ${json.error}` : ""}.`);
  }
  print("🔗 Pairing code (valid for 5 minutes, one use):");
  print("");
  print(`   ${json.string}`);
  print("");
  print(`   Role: ${json.role}${json.hosts ? ` — hosts: ${json.hosts.join(", ")}` : ""}`);
}

export async function peers(options: { json?: boolean }) {
  const { invites, peers } = Links.list();
  if (options.json) {
    console.log(JSON.stringify({ invites, peers }, null, 2));
    return;
  }
  if (!peers.length) print("No peers yet. Create an invite: locadot share --role viewer");
  for (const peer of peers as any[]) {
    print(`${peer.id}  ${peer.name}  ${peer.role}${peer.hosts ? `  [${peer.hosts.join(", ")}]` : ""}  last seen: ${peer.lastSeen ?? "never"}`);
  }
  if ((invites as any[]).length) print(`⏳ Pending invites: ${(invites as any[]).length}`);
}

export async function peersRole(id: string, role: string, options: { hosts?: string }) {
  const parsedRole = requireRole(role);
  const hosts = parsedRole === "viewer" ? splitHosts(options.hosts) : undefined;
  const peer = Links.setRole(id, parsedRole, hosts);
  print(`✅ ${peer.name} is now ${peer.role}${peer.hosts ? ` [${peer.hosts.join(", ")}]` : ""}.`);
}

export async function peersRevoke(id: string) {
  Links.revoke(id);
  print(`🗑️  Revoked peer ${id}.`);
}

/** After connect/sync/remote:domain: the sender's dashboard and localhost, reachable when this remote has a domain and we're admin. */
const printDomain = (remote: Remote) => {
  if (remote.domain && remote.role === "admin") {
    print(`🖥️  ${remote.sender.hostname} dashboard: ${urlFor(`${remote.domain}.localhost`)}  (any port: ${urlFor(`<port>.${remote.domain}.localhost`)})`);
  }
};

export async function connect(value: string, options: { name?: string; domain?: string }) {
  const { remote, mapped, skipped, note } = await Remotes.connect(value, { name: options.name, domain: options.domain });
  print(`✅ Connected to ${remote.name} (${remote.sender.hostname}) as ${remote.role}.`);
  for (const m of mapped) print(`   ${urlFor(m.local)}  →  ${m.host}`);
  for (const reason of skipped) print(`   ⚠️  skipped: ${reason}`);
  if (note) print(`   ⚠️  ${note}`);
  printDomain(remote);
}

export async function remotes(options: { json?: boolean }) {
  const list = Remotes.list();
  const registry = RegistryStore.read();
  const aliasesFor = (name: string) =>
    Object.entries(registry.hosts)
      .filter(([, entry]) => entry.remote?.name === name)
      .map(([local, entry]) => ({ local, host: entry.remote!.host }));

  if (options.json) {
    console.log(
      JSON.stringify(
        list.map(({ token, ...remote }) => ({ ...remote, aliases: aliasesFor(remote.name) })),
        null,
        2
      )
    );
    return;
  }
  if (!list.length) {
    print("No remotes. Connect to one: locadot connect <pairing-string>");
    return;
  }
  for (const remote of list) {
    print(`${remote.name}  ${remote.url}  (${remote.role})${remote.domain ? `  domain: ${remote.domain}.localhost` : ""}`);
    for (const alias of aliasesFor(remote.name)) print(`   ${urlFor(alias.local)}  →  ${alias.host}`);
  }
}

export async function remoteSync(name: string) {
  const { remote, mapped } = await Remotes.sync(name);
  print(`✅ ${name} synced.`);
  for (const m of mapped) print(`   + ${urlFor(m.local)}  →  ${m.host}`);
  printDomain(remote);
}

export async function remoteDomain(name: string, domain: string | undefined, options: { off?: boolean }) {
  if (options.off) {
    Remotes.setDomain(name, null);
    print(`🗑️  Removed the local domain for ${name}.`);
    return;
  }
  const remote = Remotes.setDomain(name, domain || "random");
  print(`✅ ${name} domain: ${remote.domain}.localhost.`);
  printDomain(remote);
}

export async function remoteAlias(name: string, remoteHost: string, localHost: string) {
  await Remotes.alias(name, remoteHost, localHost);
  print(`✅ ${urlFor(localHost)}  →  ${remoteHost} (${name})`);
}

export async function remoteUrl(name: string, url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new InputError(`❌ Invalid URL "${url}".`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InputError(`❌ Invalid URL "${url}". Use http:// or https://.`);
  }
  Remotes.setUrl(name, url.replace(/\/+$/, ""));
  print(`✅ ${name} now points to ${parsed.origin}.`);
}

export async function remoteAdd(name: string, options: { host?: string; target?: string; cors?: boolean; insecure?: boolean }) {
  if (!options.host) throw new InputError("❌ Missing --host <host>.");
  if (!options.target) throw new InputError("❌ Missing --target <url>.");
  await Remotes.addHost(name, { host: options.host, target: options.target, insecure: options.insecure, cors: options.cors });
  print(`✅ ${options.host}  →  ${options.target} on ${name}.`);
}

export async function remoteUpdate(name: string, options: { host?: string; target?: string; cors?: boolean }) {
  if (!options.host) throw new InputError("❌ Missing --host <host>.");
  await Remotes.updateHost(name, options.host, { target: options.target, cors: options.cors });
  print(`✅ Updated ${options.host} on ${name}.`);
}

export async function remoteRm(name: string, host: string) {
  await Remotes.removeHost(name, host);
  print(`🗑️  Removed ${host} from ${name}.`);
}

export async function disconnect(name: string) {
  await Remotes.disconnect(name);
  print(`🔌 Disconnected from ${name}.`);
}

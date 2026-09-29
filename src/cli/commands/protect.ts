import Localhost, { InputError } from "../../lib/localhost";
import HostOps from "../../lib/hosts";
import HostAuth, { SCOPES } from "../../lib/host-auth";
import RegistryStore from "../../lib/registry";
import { urlFor } from "../../lib/urls";
import type { ProtectScope } from "../../types";
import { print } from "../shared";
import { askHidden, readStdin } from "./ui";

const PLACES: Record<ProtectScope, string> = { shared: "the shared link", remote: "connected machines", local: "this machine" };

/** Asks for a password on a mapping, on the paths picked with --shared/--remote/--local; --off removes it. */
export async function protect(options: { host: string; password?: string; stdin?: boolean; shared?: boolean; remote?: boolean; local?: boolean; off?: boolean }) {
  const host = Localhost.requireHost(options.host);
  if (options.off) {
    await HostOps.setProtect({ host, off: true });
    print(`🔓 ${urlFor(host)} no longer asks for a password.`);
    return;
  }
  const entry = RegistryStore.read().hosts[host];
  if (!entry) throw new InputError(`❌ ${host} isn't mapped. Add it first: locadot add --host ${host} --port <port>`);
  const picked = SCOPES.filter((scope) => options[scope]);
  const scopes = picked.length ? picked : entry.protect?.scopes ?? [];
  if (!scopes.length) throw new InputError(`❌ Pick where to ask for the password: --shared, --remote and/or --local.`);

  let password = options.password;
  // Picking places for an already protected mapping keeps its password; otherwise ask for one.
  if (password === undefined && (options.stdin || !HostAuth.has(host) || !picked.length)) {
    if (options.stdin || !process.stdin.isTTY) password = await readStdin();
    else {
      password = await askHidden(`Password for ${host}: `);
      if ((await askHidden("Repeat it: ")) !== password) throw new InputError("❌ The passwords don't match.");
    }
  }
  const { entry: saved } = await HostOps.setProtect({ host, password, scopes });
  print(`🔒 ${urlFor(host)} asks for a password on ${saved.protect!.scopes.map((scope) => PLACES[scope]).join(", ")}.`);
}

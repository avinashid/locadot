import fs from "fs";
import os from "os";
import path from "path";
import { execSync, spawn } from "child_process";
import sudo from "@expo/sudo-prompt";
import Constants from "../constants";
import { caCertPath, ensureCA } from "./certs";
import logger from "./logger";

const CA_NAME = "Locadot Development CA";

const sudoOptions = { name: "Locadot" };

function execSudo(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sudo.exec(cmd, sudoOptions, (error, stdout, stderr) => {
      if (error) return reject(error);
      if (stderr) console.error(stderr);
      if (stdout) console.log(stdout);
      resolve();
    });
  });
}

function hasBinary(bin: string): boolean {
  try {
    execSync(`command -v ${bin}`, { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function isDebianStyle(): boolean {
  return fs.existsSync("/usr/local/share/ca-certificates") && hasBinary("update-ca-certificates");
}

// Debian/Ubuntu keep system anchors under ca-certificates; Fedora/RHEL/Arch
// use pki/ca-trust (or the newer `trust` CLI). Both need root, so only the
// copy+refresh step is sudo'd — NSS db updates below run as the user.
function linuxAnchorPath(): string {
  return isDebianStyle()
    ? "/usr/local/share/ca-certificates/locadot-ca.crt"
    : "/etc/pki/ca-trust/source/anchors/locadot-ca.crt";
}

function nssProfileDirs(): string[] {
  const dirs: string[] = [];
  const chromeNssdb = path.join(os.homedir(), ".pki", "nssdb");
  if (fs.existsSync(chromeNssdb)) dirs.push(`sql:${chromeNssdb}`);

  const firefoxRoot = path.join(os.homedir(), ".mozilla", "firefox");
  if (fs.existsSync(firefoxRoot)) {
    for (const entry of fs.readdirSync(firefoxRoot)) {
      if (entry.includes(".default")) {
        dirs.push(`sql:${path.join(firefoxRoot, entry)}`);
      }
    }
  }
  return dirs;
}

// Chrome/Firefox on Linux read their own NSS trust stores instead of the
// system one, and can be updated without sudo — best effort, skip if certutil
// is missing rather than failing the whole trustCA() call.
function trustNssDbs(certPath: string): void {
  if (!hasBinary("certutil")) return;

  for (const db of nssProfileDirs()) {
    try {
      execSync(`certutil -d "${db}" -A -t "C,," -n "${CA_NAME}" -i "${certPath}"`, {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      // Best effort — a locked/incompatible profile shouldn't block system trust.
    }
  }
}

function untrustNssDbs(): void {
  if (!hasBinary("certutil")) return;

  for (const db of nssProfileDirs()) {
    try {
      execSync(`certutil -d "${db}" -D -n "${CA_NAME}"`, { stdio: "ignore", windowsHide: true });
    } catch {
      // Not present in this profile — nothing to remove.
    }
  }
}

async function trustLinux(certPath: string): Promise<void> {
  const anchorPath = linuxAnchorPath();
  const debian = isDebianStyle();

  const copyAndRefresh = debian
    ? `cp "${certPath}" "${anchorPath}" && update-ca-certificates`
    : hasBinary("trust")
      ? `cp "${certPath}" "${anchorPath}" && trust anchor --store "${anchorPath}"`
      : `cp "${certPath}" "${anchorPath}" && update-ca-trust`;

  await execSudo(copyAndRefresh);
  trustNssDbs(certPath);
}

async function untrustLinux(): Promise<void> {
  const anchorPath = linuxAnchorPath();
  const debian = isDebianStyle();

  const removeAndRefresh = debian
    ? `rm -f "${anchorPath}" && update-ca-certificates --fresh`
    : `rm -f "${anchorPath}" && update-ca-trust`;

  await execSudo(removeAndRefresh);
  untrustNssDbs();
}

function isTrustedLinux(certPath: string): boolean {
  const anchorPath = linuxAnchorPath();
  if (!fs.existsSync(anchorPath)) return false;
  try {
    return fs.readFileSync(anchorPath, "utf-8") === fs.readFileSync(certPath, "utf-8");
  } catch {
    return false;
  }
}

const MAC_KEYCHAIN = "/Library/Keychains/System.keychain";

const macRootError = () =>
  new Error(
    `Run \`locadot trust\` without sudo; it asks for your password itself. Under sudo it would trust root's own CA ` +
      `(${caCertPath()}), not the one your proxy serves.`
  );

// Plain `sudo` sets HOME to /var/root; `sudo -E` or LOCADOT_HOME keep the user's state dir, so those are fine.
const sudoAsRoot = () => {
  const user = process.env.SUDO_USER;
  return process.getuid?.() === 0 && Boolean(user) && !process.env.LOCADOT_HOME && !path.resolve(Constants.paths.HOME).startsWith(`/Users/${user}/`);
};

// Changing admin trust settings needs macOS to show a password dialog. sudo-prompt elevates through
// `osascript ... with administrator privileges`, which can't, so it fails with "no user interaction was possible".
// A Terminal's sudo or the user's own session can.
// Async: from the dashboard the dialog can stay open for a while, and the proxy has to keep serving meanwhile.
export async function macSecurity(args: string[]): Promise<void> {
  const viaSudo = process.getuid?.() !== 0 && Boolean(process.stdin.isTTY);
  const detail = await new Promise<string | undefined>((resolve) => {
    const child = viaSudo
      ? spawn("sudo", ["security", ...args], { stdio: ["inherit", "inherit", "pipe"], windowsHide: true })
      : spawn("security", args, { stdio: ["ignore", "inherit", "pipe"], windowsHide: true });
    let stderr = "";
    child.stderr!.on("data", (chunk) => {
      stderr += chunk;
      if (viaSudo) process.stderr.write(chunk);
    });
    child.on("error", (error) => resolve(error.message));
    child.on("close", (code) => resolve(code === 0 ? undefined : stderr.trim() || `security exited with ${code}`));
  });
  if (detail === undefined) return;
  if (/no user interaction was possible/i.test(detail)) {
    throw new Error(
      "macOS needs to show a password dialog to change certificate trust, and couldn't from here. " +
        "Run `locadot trust` in Terminal on the Mac itself (not over SSH), or run:\n  " +
        `sudo security ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")}`
    );
  }
  throw new Error(detail);
}

async function trustMac(certPath: string): Promise<void> {
  if (sudoAsRoot()) throw macRootError();
  await macSecurity(["add-trusted-cert", "-d", "-r", "trustRoot", "-k", MAC_KEYCHAIN, certPath]);
}

async function untrustMac(): Promise<void> {
  if (sudoAsRoot()) throw macRootError();
  const certPath = caCertPath();
  if (fs.existsSync(certPath)) {
    try {
      await macSecurity(["remove-trusted-cert", "-d", certPath]);
    } catch {
      // No trust settings left for it; deleting the certificate below is what matters.
    }
  }
  await macSecurity(["delete-certificate", "-c", CA_NAME, MAC_KEYCHAIN]);
}

function isTrustedMac(certPath: string): boolean {
  try {
    execSync(`security verify-cert -c "${certPath}"`, { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

async function trustWindows(certPath: string): Promise<void> {
  await execSudo(`certutil -addstore -f Root "${certPath}"`);
}

async function untrustWindows(): Promise<void> {
  await execSudo(`certutil -delstore Root "${CA_NAME}"`);
}

function isTrustedWindows(): boolean {
  try {
    execSync(`certutil -store Root "${CA_NAME}"`, { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function isCATrusted(): Promise<boolean> {
  const certPath = caCertPath();
  if (!fs.existsSync(certPath)) return false;

  const platform = Constants.platform();
  switch (platform) {
    case "linux":
      return isTrustedLinux(certPath);
    case "mac":
      return isTrustedMac(certPath);
    case "windows":
      return isTrustedWindows();
    default:
      return false;
  }
}

export async function trustCA(): Promise<void> {
  await ensureCA();
  const certPath = caCertPath();
  const platform = Constants.platform();

  switch (platform) {
    case "linux":
      await trustLinux(certPath);
      break;
    case "mac":
      await trustMac(certPath);
      break;
    case "windows":
      await trustWindows(certPath);
      break;
    default:
      throw new Error(trustInstructions());
  }

  logger.info("🔐 Locadot CA trusted");
}

export async function untrustCA(): Promise<void> {
  const platform = Constants.platform();

  switch (platform) {
    case "linux":
      await untrustLinux();
      break;
    case "mac":
      await untrustMac();
      break;
    case "windows":
      await untrustWindows();
      break;
    default:
      throw new Error(trustInstructions());
  }

  logger.info("🔓 Locadot CA untrusted");
}

export function trustInstructions(): string {
  const certPath = caCertPath();
  const platform = Constants.platform();

  switch (platform) {
    case "linux":
      return [
        `Locadot CA certificate: "${certPath}"`,
        "Debian/Ubuntu:",
        `  sudo cp "${certPath}" "/usr/local/share/ca-certificates/locadot-ca.crt"`,
        "  sudo update-ca-certificates",
        "Fedora/RHEL/Arch:",
        `  sudo cp "${certPath}" "/etc/pki/ca-trust/source/anchors/locadot-ca.crt"`,
        "  sudo update-ca-trust",
        "Chrome/Firefox (per-user, no sudo needed):",
        `  certutil -d "sql:$HOME/.pki/nssdb" -A -t "C,," -n "${CA_NAME}" -i "${certPath}"`,
      ].join("\n");

    case "mac":
      return [
        `Locadot CA certificate: "${certPath}"`,
        `sudo security add-trusted-cert -d -r trustRoot -k "/Library/Keychains/System.keychain" "${certPath}"`,
      ].join("\n");

    case "windows":
      return [
        `Locadot CA certificate: "${certPath}"`,
        `certutil -addstore -f Root "${certPath}"`,
      ].join("\n");

    default:
      return `Unsupported platform. Manually trust the CA certificate at "${certPath}" in your OS/browser trust store.`;
  }
}

import path from "path";
import os from "os";
import fs from "fs";
import { execFileSync } from "child_process";
import sudo from "@expo/sudo-prompt";
import Constants from "../constants";
import locadotFile from "../lib/locadot-file";
import logger from "./logger";

const SERVICE_NAME = "locadot-proxy";
const MAC_LABEL = "com.locadot.proxy";
const CRON_MARK = "# locadot-proxy";
const MARKER = path.join(Constants.paths.HOME, "startup.json");
const markerIn = (state: string) => path.join(state, "startup.json");
// Per-user Startup folder: unlike an ONLOGON scheduled task it needs no admin rights.
const windowsLauncher = () =>
  path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    "Microsoft", "Windows", "Start Menu", "Programs", "Startup", `${SERVICE_NAME}.vbs`
  );
// Earlier versions registered an ONLOGON scheduled task and kept the script in the state dir.
const LEGACY_LAUNCHER = path.join(Constants.paths.HOME, "startup-hidden.vbs");

// Tests point these elsewhere.
export const macDirs = { daemons: "/Library/LaunchDaemons" };
const agentPath = (home = os.homedir()) => path.join(home, "Library", "LaunchAgents", `${MAC_LABEL}.plist`);
const daemonPath = () => path.join(macDirs.daemons, `${MAC_LABEL}.plist`);

const xml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Home of the user behind `sudo`, so root mode starts their proxy, not root's. */
const sudoUserHome = (user: string) => {
  try {
    const out = execFileSync("dscl", [".", "-read", `/Users/${user}`, "NFSHomeDirectory"], { encoding: "utf8", windowsHide: true });
    const home = out.split(":").slice(1).join(":").trim();
    if (home) return home;
  } catch {}
  return path.join("/Users", user);
};

/**
 * Who the boot job runs as and which state dir it uses. As root under plain `sudo`, HOME is /var/root, so the
 * state dir is re-derived for SUDO_USER; LOCADOT_HOME or `sudo -E` already point at the right one.
 */
const macTarget = () => {
  const root = process.getuid?.() === 0;
  const user = root ? process.env.SUDO_USER : undefined;
  if (!user || user === "root") return { root, user: undefined, home: os.homedir(), state: Constants.paths.HOME };
  const home = sudoUserHome(user);
  const own = process.env.LOCADOT_HOME || Constants.paths.HOME.startsWith(`${home}/`);
  return { root, user, home, state: own ? Constants.paths.HOME : path.join(home, "Library", "Application Support", "locadot") };
};

export const macPlist = (label: string, argv: string[], opts: { state: string; user?: string; home?: string; env?: Record<string, string> }) => {
  const env = { ...(opts.home ? { HOME: opts.home } : {}), ...opts.env };
  const dict = (entries: Record<string, string>) =>
    Object.entries(entries).map(([k, v]) => `    <key>${xml(k)}</key>\n    <string>${xml(v)}</string>`).join("\n");
  const log = path.join(opts.state, ".locadot.log");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xml(label)}</string>
  <key>ProgramArguments</key>
  <array>
    ${argv.map((arg) => `<string>${xml(arg)}</string>`).join("\n    ")}
  </array>${opts.user ? `\n  <key>UserName</key>\n  <string>${xml(opts.user)}</string>` : ""}${Object.keys(env).length ? `\n  <key>EnvironmentVariables</key>\n  <dict>\n${dict(env)}\n  </dict>` : ""}
  <key>RunAtLoad</key>
  <true/>
  <!-- A dashboard restart spawns the new proxy and exits; launchd must not take it down with the old one. -->
  <key>AbandonProcessGroup</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xml(log)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(log)}</string>
</dict>
</plist>
`;
};

/** Port vars only when the user set them; otherwise the proxy reads the ports saved in the state dir. */
const userPortVars = (): Record<string, string> => {
  const set = Constants.userPortEnv();
  if (set === "none") return {};
  const vars: Record<string, string> = { LOCADOT_USER_PORTS: set };
  if (set.includes("LOCADOT_HTTP_PORT")) vars.LOCADOT_HTTP_PORT = String(Constants.server.httpPort);
  if (set.includes("LOCADOT_HTTPS_PORT")) vars.LOCADOT_HTTPS_PORT = String(Constants.server.httpsPort);
  return vars;
};

/** Clears a disabled override (left by `launchctl unload -w`), which would keep the job from ever running. */
const launchctlEnable = (domain: string) => {
  try {
    execFileSync("launchctl", ["enable", `${domain}/${MAC_LABEL}`], { stdio: "ignore", windowsHide: true });
  } catch {}
};

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

// Resolved on use, not import: the entry path depends on how locadot was launched.
const launchArgs = () => {
  const { command, path: args } = locadotFile.getStartProxyFile();
  return { command, args: [...args, "--home", Constants.paths.HOME] };
};

/**
 * Launching node.exe directly at logon opens a console window, and closing it kills the
 * proxy. Explorer runs the .vbs with wscript, which has no console, and Run(…, 0) keeps cmd
 * and node hidden too. cmd also appends the output to the log, like the cron line does.
 */
export const windowsLauncherScript = (command: string, args: string[]) => {
  const env = `set LOCADOT_HTTP_PORT=${Constants.server.httpPort}&& set LOCADOT_HTTPS_PORT=${Constants.server.httpsPort}&& set LOCADOT_USER_PORTS=${Constants.userPortEnv()}&&`;
  const line = `cmd /d /c ${env} ${[command, ...args].map((a) => `"${a}"`).join(" ")} >> "${Constants.paths.LOGS}" 2>&1`;
  return `CreateObject("WScript.Shell").Run "${line.replace(/"/g, '""')}", 0, False\r\n`;
};

/** Best effort: deleting a task the user created without elevation needs none. */
const removeLegacyTask = () => {
  try {
    execFileSync("schtasks", ["/Delete", "/TN", SERVICE_NAME, "/F"], { stdio: "ignore", windowsHide: true });
  } catch {}
  fs.rmSync(LEGACY_LAUNCHER, { force: true });
};

function execSudo(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sudo.exec(cmd, { name: "Locadot" }, (error, stdout, stderr) => {
      if (error) return reject(error);
      if (stderr) logger.warn(String(stderr).trim());
      if (stdout) logger.info(String(stdout).trim());
      resolve();
    });
  });
}

/** Linux needs root for ports below 1024 unless the sysctl allows otherwise. */
const linuxNeedsRoot = () => {
  if (process.getuid?.() === 0) return false;
  const lowest = Math.min(Constants.server.httpPort, Constants.server.httpsPort);
  try {
    const start = Number(fs.readFileSync("/proc/sys/net/ipv4/ip_unprivileged_port_start", "utf8"));
    return lowest < start;
  } catch {
    return lowest < 1024;
  }
};

const cronEdit = (line?: string) =>
  `(crontab -l 2>/dev/null | grep -v ${quote(CRON_MARK)}${line ? `; echo ${quote(line)}` : ""}) | crontab -`;

export default class Startup {
  static async enable() {
    const { command, args } = launchArgs();
    const platform = Constants.platform();
    let method = "";

    switch (platform) {
      case "windows": {
        // Runs at the user's logon; ports 80/443 need no elevation on Windows.
        removeLegacyTask();
        fs.mkdirSync(path.dirname(windowsLauncher()), { recursive: true });
        fs.writeFileSync(windowsLauncher(), windowsLauncherScript(command, args));
        method = "startup-folder";
        break;
      }
      case "linux": {
        const env = `LOCADOT_HOME=${quote(Constants.paths.HOME)} LOCADOT_HTTP_PORT=${Constants.server.httpPort} LOCADOT_HTTPS_PORT=${Constants.server.httpsPort} LOCADOT_USER_PORTS=${Constants.userPortEnv()}`;
        const line = `@reboot ${env} ${[command, ...args].map(quote).join(" ")} >> ${quote(Constants.paths.LOGS)} 2>&1 ${CRON_MARK}`;
        const edit = cronEdit(line);
        if (linuxNeedsRoot()) {
          await execSudo(`sh -c ${quote(edit)}`);
          method = "root-crontab";
        } else {
          execFileSync("sh", ["-c", edit], { stdio: "inherit", windowsHide: true });
          method = "user-crontab";
        }
        break;
      }
      case "mac": {
        // Not loaded now: a second proxy would only fail to bind next to the running one. launchd reads
        // LaunchAgents at login and LaunchDaemons at boot on its own.
        const target = macTarget();
        const argv = [command, ...args.slice(0, -1), target.state];
        if (target.root) {
          // Root mode: a LaunchDaemon starts at boot, before anyone logs in, as the sudo user when there is one.
          fs.mkdirSync(macDirs.daemons, { recursive: true });
          fs.writeFileSync(daemonPath(), macPlist(MAC_LABEL, argv, { state: target.state, user: target.user, home: target.user ? target.home : undefined, env: userPortVars() }));
          // launchd skips daemon plists that aren't root-owned or are group/world writable.
          fs.chmodSync(daemonPath(), 0o644);
          fs.rmSync(agentPath(target.home), { force: true });
          launchctlEnable("system");
          method = "launch-daemon";
        } else {
          // macOS (10.14+) lets unprivileged processes bind 80/443, so a user LaunchAgent is enough. It starts at login.
          fs.mkdirSync(path.dirname(agentPath()), { recursive: true });
          fs.writeFileSync(agentPath(), macPlist(MAC_LABEL, argv, { state: target.state, env: userPortVars() }));
          fs.chmodSync(agentPath(), 0o644);
          if (fs.existsSync(daemonPath())) await execSudo(`rm -f ${quote(daemonPath())}`);
          launchctlEnable(`gui/${process.getuid?.()}`);
          method = "launch-agent";
        }
        fs.mkdirSync(target.state, { recursive: true });
        fs.writeFileSync(markerIn(target.state), JSON.stringify({ platform, method, enabledAt: new Date().toISOString() }, null, 2));
        if (target.user) {
          // Written as root into the user's state dir; the user's own proxy has to be able to replace them.
          const { uid, gid } = fs.statSync(target.home);
          for (const file of [target.state, markerIn(target.state)]) fs.chownSync(file, uid, gid);
        }
        logger.info(`✅ locadot will start at ${method === "launch-daemon" ? "boot" : "login"} (${method}).`);
        return;
      }
      default:
        throw new Error("Unknown platform");
    }

    fs.mkdirSync(Constants.paths.HOME, { recursive: true });
    fs.writeFileSync(MARKER, JSON.stringify({ platform, method, enabledAt: new Date().toISOString() }, null, 2));
    logger.info(`✅ locadot will start at ${platform === "windows" ? "logon" : "boot"} (${method}).`);
  }

  static async disable() {
    const platform = Constants.platform();
    const method = Startup.marker()?.method;

    switch (platform) {
      case "windows":
        removeLegacyTask();
        fs.rmSync(windowsLauncher(), { force: true });
        break;
      case "linux":
        if (method === "root-crontab") await execSudo(`sh -c ${quote(cronEdit())}`);
        else execFileSync("sh", ["-c", cronEdit()], { stdio: "inherit", windowsHide: true });
        break;
      case "mac": {
        // Only the plist goes: unloading the job would also stop a proxy launchd started.
        const target = macTarget();
        fs.rmSync(agentPath(target.home), { force: true });
        if (fs.existsSync(daemonPath())) {
          if (target.root) fs.rmSync(daemonPath(), { force: true });
          else await execSudo(`rm -f ${quote(daemonPath())}`);
        }
        fs.rmSync(markerIn(target.state), { force: true });
        break;
      }
      default:
        throw new Error("Unknown platform");
    }

    fs.rmSync(MARKER, { force: true });
    logger.info("✅ Start at boot disabled.");
  }

  private static marker(): { method?: string } | undefined {
    try {
      return JSON.parse(fs.readFileSync(MARKER, "utf8"));
    } catch {
      return undefined;
    }
  }

  static async info(): Promise<{ enabled: boolean; method: string | null }> {
    const enabled = await Startup.isEnabled();
    return { enabled, method: enabled ? Startup.marker()?.method ?? null : null };
  }

  /**
   * The marker is the source of truth for root crontabs, which an unprivileged
   * status check cannot read. Other methods are verified directly.
   */
  static async isEnabled(): Promise<boolean> {
    const marker = Startup.marker();
    try {
      switch (Constants.platform()) {
        case "linux":
          if (marker?.method === "root-crontab") return true;
          return execFileSync("sh", ["-c", "crontab -l 2>/dev/null || true"], { encoding: "utf8", windowsHide: true }).includes(CRON_MARK);
        case "mac":
          return fs.existsSync(agentPath()) || fs.existsSync(daemonPath());
        case "windows":
          return fs.existsSync(windowsLauncher());
        default:
          return false;
      }
    } catch {
      return false;
    }
  }
}

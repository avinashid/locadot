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
// Per-user Startup folder: unlike an ONLOGON scheduled task it needs no admin rights.
const windowsLauncher = () =>
  path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    "Microsoft", "Windows", "Start Menu", "Programs", "Startup", `${SERVICE_NAME}.vbs`
  );
// Earlier versions registered an ONLOGON scheduled task and kept the script in the state dir.
const LEGACY_LAUNCHER = path.join(Constants.paths.HOME, "startup-hidden.vbs");

const plistPath = () => path.join(os.homedir(), "Library", "LaunchAgents", `${MAC_LABEL}.plist`);

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
  const env = `set LOCADOT_HTTP_PORT=${Constants.server.httpPort}&& set LOCADOT_HTTPS_PORT=${Constants.server.httpsPort}&&`;
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
        const env = `LOCADOT_HOME=${quote(Constants.paths.HOME)} LOCADOT_HTTP_PORT=${Constants.server.httpPort} LOCADOT_HTTPS_PORT=${Constants.server.httpsPort}`;
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
        // macOS (10.14+) lets unprivileged processes bind 80/443, so a user LaunchAgent is enough.
        const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${MAC_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    ${[command, ...args].map((arg) => `<string>${arg}</string>`).join("\n    ")}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${Constants.paths.LOGS}</string>
  <key>StandardErrorPath</key>
  <string>${Constants.paths.LOGS}</string>
</dict>
</plist>`;
        fs.mkdirSync(path.dirname(plistPath()), { recursive: true });
        fs.writeFileSync(plistPath(), plist);
        execFileSync("launchctl", ["load", "-w", plistPath()], { stdio: "inherit", windowsHide: true });
        method = "launch-agent";
        break;
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
      case "mac":
        if (fs.existsSync(plistPath())) {
          try {
            execFileSync("launchctl", ["unload", "-w", plistPath()], { stdio: "ignore", windowsHide: true });
          } catch {}
          fs.rmSync(plistPath(), { force: true });
        }
        break;
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
          return fs.existsSync(plistPath());
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

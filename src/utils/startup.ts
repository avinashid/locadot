import path from "path";
import os from "os";
import fs from "fs";
import { execSync } from "child_process";
import sudo from "@expo/sudo-prompt";
import Constants from "../constants";
import locadotFile from "../lib/locadot-file";

const SERVICE_NAME = "reboot-locadot";
const { command, path: commandArgs } = locadotFile.getStartProxyFile();

const sudoOptions = {
  name: "Locadot",
};

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

export default class Startup {
  static async enable() {
    const platform = Constants.platform();
    let cmd = "";

    switch (platform) {
      case "windows":
        cmd = `schtasks /Create /TN "${SERVICE_NAME}" /TR "${command} ${commandArgs.join(
          " "
        )}" /SC ONSTART /F`;
        break;

      case "linux":
        const cronLine = `@reboot ${command} ${commandArgs.join(" ")}`;
        cmd = `crontab -l | grep -v '${commandArgs[0]}' | { cat; echo '${cronLine}'; } | crontab -`;
        break;

      case "mac":
        const plistPath = path.join(
          os.homedir(),
          "Library",
          "LaunchAgents",
          "com.local.reboot.plist"
        );
        const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.local.reboot</string>
  <key>ProgramArguments</key>
  <array>
    <string>${command}</string>
    ${commandArgs.map((arg) => `<string>${arg}</string>`).join("\n    ")}
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>`;
        fs.writeFileSync(plistPath, plist);
        cmd = `launchctl load "${plistPath}"`;
        break;

      default:
        throw new Error("Unknown platform");
    }

    try {
      await execSudo(cmd);
      console.log("✅ Reboot task enabled.");
    } catch (err) {
      console.error("❌ Failed to enable reboot task:", err);
    }
  }

  static async disable() {
    const platform = Constants.platform();
    let cmd = "";

    switch (platform) {
      case "windows":
        cmd = `schtasks /Delete /TN "${SERVICE_NAME}" /F`;
        break;

      case "linux":
        cmd = `crontab -l | grep -v '${commandArgs[0]}' | crontab -`;
        break;

      case "mac":
        const plistPath = path.join(
          os.homedir(),
          "Library",
          "LaunchAgents",
          "com.local.reboot.plist"
        );
        cmd = `launchctl unload "${plistPath}" && rm "${plistPath}"`;
        break;

      default:
        throw new Error("Unknown platform");
    }

    try {
      await execSudo(cmd);
      console.log("✅ Reboot task disabled.");
    } catch (err) {
      console.error("❌ Failed to disable reboot task:", err);
    }
  }

  static async status() {
    const platform = Constants.platform();

    try {
      switch (platform) {
        case "linux": {
          const output = execSync("crontab -l", { encoding: "utf-8" });
          console.log(output.includes(commandArgs[0]) ? "enabled" : "disabled");
          break;
        }
        case "windows": {
          try {
            const output = execSync(`schtasks /Query /TN "${SERVICE_NAME}"`, {
              encoding: "utf-8",
            });
            console.log(output.includes(SERVICE_NAME) ? "enabled" : "disabled");
          } catch {
            console.log("disabled");
          }
          break;
        }
        case "mac": {
          const plistPath = path.join(
            os.homedir(),
            "Library",
            "LaunchAgents",
            "com.local.reboot.plist"
          );
          console.log(fs.existsSync(plistPath) ? "enabled" : "disabled");
          break;
        }
        default:
          throw new Error("Unknown platform");
      }
    } catch (err) {
      console.error("❌ Failed to check status:", err);
    }
  }
}

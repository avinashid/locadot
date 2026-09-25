import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Startup.enable writes its marker into the state dir; keep it off the real one.
process.env.LOCADOT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-startup-"));

const { default: Startup, windowsLauncherScript } = require("../src/utils/startup");
const { default: Constants } = require("../src/constants");

const SRC = path.join(__dirname, "..", "src");

const sources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(full) : full.endsWith(".ts") ? [full] : [];
  });

// The detached proxy has no console, so on Windows any child without windowsHide
// gets a fresh console window that flashes up and vanishes.
test("every child process in src/ sets windowsHide", () => {
  const missing: string[] = [];
  for (const file of sources(SRC)) {
    const text = fs.readFileSync(file, "utf8");
    const call = /\b(execSync|execFileSync|spawn|spawnSync|execFile|exec)\(/g;
    let match: RegExpExecArray | null;
    while ((match = call.exec(text))) {
      // Method calls (regex.exec, sudo.exec) aren't child_process; those are imported by name.
      if (text[match.index - 1] === ".") continue;
      if (/^\s*(function|import)/.test(text.slice(text.lastIndexOf("\n", match.index) + 1, match.index))) continue;
      const lineStart = text.lastIndexOf("\n", match.index);
      if (text.slice(text.lastIndexOf("\n", lineStart - 1), lineStart).includes("windows-hide-exempt")) continue;
      const rest = text.slice(match.index, match.index + 400);
      const end = rest.indexOf(");");
      if (!rest.slice(0, end === -1 ? undefined : end).includes("windowsHide: true")) {
        missing.push(`${path.relative(SRC, file)}:${text.slice(0, match.index).split("\n").length}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("Windows logon launcher runs hidden and logs to the log file", () => {
  const vbs = windowsLauncherScript("C:\\Program Files\\nodejs\\node.exe", ["C:\\a b\\core.js", "--home", "C:\\h"]);
  assert.match(vbs, /^CreateObject\("WScript\.Shell"\)\.Run "cmd \/d \/c /);
  assert.match(vbs, /, 0, False\r\n$/);
  assert.ok(vbs.includes('""C:\\Program Files\\nodejs\\node.exe"" ""C:\\a b\\core.js"" ""--home"" ""C:\\h""'));
  assert.match(vbs, /2>&1", 0/);
  // Every quote inside the VBS string literal must be doubled.
  const body = vbs.slice(vbs.indexOf('Run "') + 5, vbs.lastIndexOf('", 0'));
  assert.equal(body.replace(/""/g, "").includes('"'), false);
});

test("Windows start at logon uses the per-user Startup folder (no admin)", async () => {
  const appData = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-appdata-"));
  const original = { platform: Constants.platform, appData: process.env.APPDATA };
  Constants.platform = () => "windows";
  process.env.APPDATA = appData;
  const launcher = path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "locadot-proxy.vbs");
  try {
    await Startup.enable();
    assert.match(fs.readFileSync(launcher, "utf8"), /^CreateObject\("WScript\.Shell"\)\.Run /);
    assert.deepEqual(await Startup.info(), { enabled: true, method: "startup-folder" });
    await Startup.disable();
    assert.equal(fs.existsSync(launcher), false);
    assert.equal(await Startup.isEnabled(), false);
  } finally {
    Constants.platform = original.platform;
    if (original.appData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = original.appData;
    fs.rmSync(appData, { recursive: true, force: true });
  }
});

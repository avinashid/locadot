import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

process.env.LOCADOT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-mac & co-"));

const { default: Startup, macDirs, macPlist } = require("../src/utils/startup");
const { default: Constants } = require("../src/constants");

// Parsed with Python's plistlib: launchd silently ignores a plist that isn't valid XML.
const readPlist = (file: string) =>
  JSON.parse(execFileSync("python3", ["-c", "import plistlib,json,sys; print(json.dumps(plistlib.load(open(sys.argv[1],'rb'))))", file], { encoding: "utf8" }));

// Fake `launchctl` and `dscl` first on PATH; each call is appended to <bin>/calls.
const fakeMac = (userHome: string) => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-bin-"));
  fs.writeFileSync(path.join(bin, "launchctl"), `#!/bin/sh\necho "launchctl $@" >> "$(dirname "$0")/calls"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "dscl"), `#!/bin/sh\necho "NFSHomeDirectory: ${userHome}"\n`, { mode: 0o755 });
  const saved = { path: process.env.PATH, home: process.env.HOME, platform: Constants.platform, getuid: process.getuid, sudo: process.env.SUDO_USER, daemons: macDirs.daemons };
  process.env.PATH = `${bin}${path.delimiter}${saved.path}`;
  Constants.platform = () => "mac";
  macDirs.daemons = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-daemons-"));
  return {
    calls: () => (fs.existsSync(path.join(bin, "calls")) ? fs.readFileSync(path.join(bin, "calls"), "utf8") : ""),
    restore: () => {
      process.env.PATH = saved.path;
      process.env.HOME = saved.home;
      Constants.platform = saved.platform;
      process.getuid = saved.getuid;
      if (saved.sudo === undefined) delete process.env.SUDO_USER;
      else process.env.SUDO_USER = saved.sudo;
      fs.rmSync(macDirs.daemons, { recursive: true, force: true });
      macDirs.daemons = saved.daemons;
      fs.rmSync(bin, { recursive: true, force: true });
    },
  };
};

test("macOS: a user LaunchAgent that starts the proxy at login, with a disabled override cleared", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-user-"));
  const mac = fakeMac(home);
  process.env.HOME = home;
  const agent = path.join(home, "Library", "LaunchAgents", "com.locadot.proxy.plist");
  try {
    await Startup.enable();
    const plist = readPlist(agent);
    assert.equal(plist.Label, "com.locadot.proxy");
    assert.deepEqual(plist.ProgramArguments.slice(-2), ["--home", Constants.paths.HOME]);
    assert.equal(plist.ProgramArguments[0], process.execPath);
    assert.equal(plist.RunAtLoad, true);
    assert.equal(plist.AbandonProcessGroup, true);
    assert.equal(plist.UserName, undefined);
    assert.equal(plist.StandardOutPath, path.join(Constants.paths.HOME, ".locadot.log"));
    assert.equal(fs.statSync(agent).mode & 0o777, 0o644);
    assert.match(mac.calls(), new RegExp(`launchctl enable gui/${process.getuid!()}/com.locadot.proxy`));
    assert.doesNotMatch(mac.calls(), /unload|bootout/, "enabling must not stop a running proxy");
    assert.deepEqual(await Startup.info(), { enabled: true, method: "launch-agent" });

    await Startup.disable();
    assert.equal(fs.existsSync(agent), false);
    assert.doesNotMatch(mac.calls(), /unload|bootout/, "disabling must not stop a running proxy");
    assert.equal(await Startup.isEnabled(), false);
  } finally {
    mac.restore();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("macOS root mode: a LaunchDaemon that starts at boot as the sudo user, replacing their LaunchAgent", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-user-"));
  const mac = fakeMac(home);
  process.env.HOME = "/var/root";
  process.env.SUDO_USER = "aditya";
  process.getuid = () => 0;
  const agent = path.join(home, "Library", "LaunchAgents", "com.locadot.proxy.plist");
  fs.mkdirSync(path.dirname(agent), { recursive: true });
  fs.writeFileSync(agent, "old");
  const daemon = path.join(macDirs.daemons, "com.locadot.proxy.plist");
  try {
    await Startup.enable();
    const plist = readPlist(daemon);
    assert.equal(plist.UserName, "aditya");
    assert.equal(plist.EnvironmentVariables.HOME, home);
    assert.deepEqual(plist.ProgramArguments.slice(-2), ["--home", Constants.paths.HOME]);
    assert.equal(fs.statSync(daemon).mode & 0o777, 0o644);
    assert.equal(fs.existsSync(agent), false, "no second copy at login");
    assert.match(mac.calls(), /launchctl enable system\/com.locadot.proxy/);
    assert.equal((await Startup.info()).method, "launch-daemon");

    await Startup.disable();
    assert.equal(fs.existsSync(daemon), false);
  } finally {
    mac.restore();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("macOS plists escape paths and carry the sudo user's HOME and port vars", () => {
  const xml = macPlist("com.locadot.proxy", ["/n/node", "core.js", "--home", "/Users/a/Library/Application Support/locadot"], {
    state: "/Users/a/Library/Application Support/locadot",
    user: "a",
    home: "/Users/a",
    env: { LOCADOT_HTTP_PORT: "8080" },
  });
  const file = path.join(os.tmpdir(), `locadot-plist-${process.pid}.plist`);
  fs.writeFileSync(file, xml);
  try {
    const plist = readPlist(file);
    assert.deepEqual(plist.EnvironmentVariables, { HOME: "/Users/a", LOCADOT_HTTP_PORT: "8080" });
    assert.equal(plist.StandardErrorPath, "/Users/a/Library/Application Support/locadot/.locadot.log");
  } finally {
    fs.rmSync(file, { force: true });
  }
});

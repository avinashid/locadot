import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

process.env.LOCADOT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-mac & co-"));

const { default: Startup, macDirs, macPlist, privilege } = require("../src/utils/startup");
const { default: Constants } = require("../src/constants");

// Parsed with Python's plistlib: launchd silently ignores a plist that isn't valid XML.
const readPlist = (file: string) =>
  JSON.parse(execFileSync("python3", ["-c", "import plistlib,json,sys; print(json.dumps(plistlib.load(open(sys.argv[1],'rb'))))", file], { encoding: "utf8" }));

// Fake `launchctl` and `dscl` first on PATH; each call is appended to <bin>/calls.
const fakeMac = (userHome: string) => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-bin-"));
  fs.writeFileSync(path.join(bin, "launchctl"), `#!/bin/sh\necho "launchctl $@" >> "$(dirname "$0")/calls"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "dscl"), `#!/bin/sh\necho "NFSHomeDirectory: ${userHome}"\n`, { mode: 0o755 });
  const saved = {
    path: process.env.PATH, home: process.env.HOME, platform: Constants.platform, getuid: process.getuid, sudo: process.env.SUDO_USER,
    daemons: macDirs.daemons, run: privilege.run, ports: [Constants.server.httpPort, Constants.server.httpsPort],
  };
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
      privilege.run = saved.run;
      [Constants.server.httpPort, Constants.server.httpsPort] = saved.ports;
      fs.rmSync(bin, { recursive: true, force: true });
    },
  };
};

// Stands in for sudo: records each command and runs it without the root-only ownership flags.
const fakeSudo = () => {
  const commands: string[] = [];
  privilege.run = async (cmd: string) => {
    commands.push(cmd);
    execFileSync("sh", ["-c", cmd.replace("-o root -g wheel ", "")], { stdio: "ignore" });
  };
  return commands;
};

test("macOS: a user LaunchAgent that starts the proxy at login, with a disabled override cleared", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-user-"));
  const mac = fakeMac(home);
  process.env.HOME = home;
  // Unprivileged ports: no root needed, so no password prompt either.
  [Constants.server.httpPort, Constants.server.httpsPort] = [8080, 8443];
  const sudo = fakeSudo();
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
    assert.deepEqual(sudo, []);
  } finally {
    mac.restore();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("macOS on 80/443 without root: asks for the password and installs a root LaunchDaemon instead", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-user-"));
  const mac = fakeMac(home);
  process.env.HOME = home;
  [Constants.server.httpPort, Constants.server.httpsPort] = [80, 443];
  const sudo = fakeSudo();
  const agent = path.join(home, "Library", "LaunchAgents", "com.locadot.proxy.plist");
  fs.mkdirSync(path.dirname(agent), { recursive: true });
  fs.writeFileSync(agent, "old");
  const daemon = path.join(macDirs.daemons, "com.locadot.proxy.plist");
  try {
    await Startup.enable();
    assert.equal(sudo.length, 1);
    assert.match(sudo[0], /install -m 644 -o root -g wheel /);
    assert.match(sudo[0], /launchctl enable system\/com.locadot.proxy/);
    const plist = readPlist(daemon);
    assert.equal(plist.UserName, undefined, "runs as root so it can bind loopback 80/443");
    assert.equal(plist.EnvironmentVariables.HOME, home);
    assert.deepEqual(plist.ProgramArguments.slice(-2), ["--home", Constants.paths.HOME]);
    assert.equal(fs.existsSync(agent), false, "no second copy at login");
    assert.equal(fs.readdirSync(os.tmpdir()).some((f) => f.startsWith("locadot-daemon-")), false, "temp plist removed");
    assert.deepEqual(await Startup.info(), { enabled: true, method: "launch-daemon" });

    await Startup.disable();
    assert.equal(fs.existsSync(daemon), false);
    assert.match(sudo[1], /^rm -f /);
  } finally {
    mac.restore();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("macOS without root: a refused password prompt leaves nothing enabled", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-user-"));
  const mac = fakeMac(home);
  process.env.HOME = home;
  [Constants.server.httpPort, Constants.server.httpsPort] = [80, 443];
  privilege.run = async () => {
    throw new Error("User did not grant permission.");
  };
  try {
    await assert.rejects(Startup.enable(), /did not grant/);
    assert.equal(await Startup.isEnabled(), false);
  } finally {
    mac.restore();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("macOS root mode: a LaunchDaemon that starts at boot, as root for 80/443 and as the sudo user otherwise", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-user-"));
  const mac = fakeMac(home);
  process.env.HOME = "/var/root";
  process.env.SUDO_USER = "aditya";
  process.getuid = () => 0;
  [Constants.server.httpPort, Constants.server.httpsPort] = [80, 443];
  const agent = path.join(home, "Library", "LaunchAgents", "com.locadot.proxy.plist");
  fs.mkdirSync(path.dirname(agent), { recursive: true });
  fs.writeFileSync(agent, "old");
  const daemon = path.join(macDirs.daemons, "com.locadot.proxy.plist");
  try {
    await Startup.enable();
    const plist = readPlist(daemon);
    assert.equal(plist.UserName, undefined, "loopback 80/443 need root");
    assert.equal(plist.EnvironmentVariables.HOME, home);
    assert.deepEqual(plist.ProgramArguments.slice(-2), ["--home", Constants.paths.HOME]);
    assert.equal(fs.statSync(daemon).mode & 0o777, 0o644);
    assert.equal(fs.existsSync(agent), false, "no second copy at login");
    assert.match(mac.calls(), /launchctl enable system\/com.locadot.proxy/);
    assert.equal((await Startup.info()).method, "launch-daemon");

    [Constants.server.httpPort, Constants.server.httpsPort] = [8080, 8443];
    await Startup.enable();
    assert.equal(readPlist(daemon).UserName, "aditya");

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

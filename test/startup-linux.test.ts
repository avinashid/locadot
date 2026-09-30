import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.LOCADOT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-linux-"));

const sudoPrompt = require("@expo/sudo-prompt");
const { default: Startup, elevate, privilege } = require("../src/utils/startup");
const { default: Constants } = require("../src/constants");

// Fake `crontab` first on PATH, keeping the table in <bin>/table.
const fakeLinux = () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-bin-"));
  const table = path.join(bin, "table");
  fs.writeFileSync(
    path.join(bin, "crontab"),
    `#!/bin/sh\nif [ "$1" = "-l" ]; then cat "${table}" 2>/dev/null; else cat > "${table}"; fi\n`,
    { mode: 0o755 }
  );
  const saved = { path: process.env.PATH, platform: Constants.platform, run: privilege.run, ports: [Constants.server.httpPort, Constants.server.httpsPort] };
  process.env.PATH = `${bin}${path.delimiter}${saved.path}`;
  Constants.platform = () => "linux";
  const sudo: string[] = [];
  privilege.run = async (cmd: string) => {
    sudo.push(cmd);
  };
  return {
    sudo,
    table: () => (fs.existsSync(table) ? fs.readFileSync(table, "utf8") : ""),
    restore: () => {
      process.env.PATH = saved.path;
      Constants.platform = saved.platform;
      privilege.run = saved.run;
      [Constants.server.httpPort, Constants.server.httpsPort] = saved.ports;
      fs.rmSync(bin, { recursive: true, force: true });
    },
  };
};

const unprivilegedStart = () => {
  try {
    return Number(fs.readFileSync("/proc/sys/net/ipv4/ip_unprivileged_port_start", "utf8"));
  } catch {
    return 1024;
  }
};

test("linux: unprivileged ports go in the user's crontab without asking for a password", async () => {
  const linux = fakeLinux();
  [Constants.server.httpPort, Constants.server.httpsPort] = [8080, 8443];
  try {
    await Startup.enable();
    assert.match(linux.table(), /^@reboot .*LOCADOT_HTTP_PORT=8080 .*# locadot-proxy$/m);
    assert.deepEqual(linux.sudo, []);
    assert.deepEqual(await Startup.info(), { enabled: true, method: "user-crontab" });
    await Startup.disable();
    assert.doesNotMatch(linux.table(), /locadot-proxy/);
  } finally {
    linux.restore();
  }
});

test("linux: ports 80/443 ask for admin rights and go in root's crontab", { skip: process.getuid?.() === 0 || unprivilegedStart() <= 80 }, async () => {
  const linux = fakeLinux();
  [Constants.server.httpPort, Constants.server.httpsPort] = [80, 443];
  try {
    await Startup.enable();
    assert.equal(linux.sudo.length, 1);
    assert.match(linux.sudo[0], /crontab -/);
    assert.match(linux.sudo[0], /LOCADOT_HTTP_PORT=80 /);
    assert.equal(linux.table(), "", "not the user's crontab");
    assert.deepEqual(await Startup.info(), { enabled: true, method: "root-crontab" });
    await Startup.disable();
    assert.equal(linux.sudo.length, 2);
    assert.doesNotMatch(linux.sudo[1], /@reboot/);
  } finally {
    linux.restore();
  }
});

test("linux: with no password prompt available, enabling fails and says to run it in a terminal", { skip: Boolean(process.stdin.isTTY) }, async () => {
  const saved = sudoPrompt.exec;
  sudoPrompt.exec = (_cmd: string, _opts: unknown, cb: (error?: Error) => void) => cb(new Error("Unable to find pkexec or kdesudo."));
  try {
    await assert.rejects(elevate("true", "locadot startup:enable"), (error: Error) => {
      assert.match(error.message, /needs admin rights/);
      assert.match(error.message, /Unable to find pkexec or kdesudo/);
      assert.match(error.message, /Run `locadot startup:enable` in a terminal/);
      return true;
    });
  } finally {
    sudoPrompt.exec = saved;
  }
});

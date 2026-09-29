import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.LOCADOT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-trust-"));

const { macSecurity } = require("../src/utils/trust");

// A stand-in for macOS's `security`, first on PATH. Tests run without a TTY, like the dashboard does.
const fakeSecurity = (script: string) => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-bin-"));
  fs.writeFileSync(path.join(bin, "security"), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  const saved = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${saved}`;
  return {
    bin,
    restore: () => {
      process.env.PATH = saved;
      fs.rmSync(bin, { recursive: true, force: true });
    },
  };
};

test("macOS trust runs `security` itself, not through osascript, so macOS can show its password dialog", async () => {
  const fake = fakeSecurity(`echo "$@" > "$(dirname "$0")/args"`);
  try {
    await macSecurity(["add-trusted-cert", "-d", "-r", "trustRoot", "-k", "/Library/Keychains/System.keychain", "/x/ca.pem"]);
    assert.equal(fs.readFileSync(path.join(fake.bin, "args"), "utf8").trim(), "add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain /x/ca.pem");
  } finally {
    fake.restore();
  }
});

test("when macOS can't show the dialog, the error says what to do instead", async () => {
  const fake = fakeSecurity(`echo "SecTrustSettingsSetTrustSettings: The authorization was denied since no user interaction was possible." >&2; exit 1`);
  try {
    await assert.rejects(
      () => macSecurity(["add-trusted-cert", "-d", "-r", "trustRoot", "-k", "/Library/Keychains/System.keychain", "/Users/a b/ca.pem"]),
      (error: Error) => {
        assert.match(error.message, /Terminal on the Mac itself/);
        assert.match(error.message, /sudo security add-trusted-cert -d -r trustRoot -k \/Library\/Keychains\/System.keychain "\/Users\/a b\/ca.pem"/);
        return true;
      }
    );
  } finally {
    fake.restore();
  }
});

test("other failures pass through what `security` said", async () => {
  const fake = fakeSecurity(`echo "SecKeychainItemImport: The specified item already exists in the keychain." >&2; exit 1`);
  try {
    await assert.rejects(() => macSecurity(["add-trusted-cert", "/x/ca.pem"]), /already exists in the keychain/);
  } finally {
    fake.restore();
  }
});

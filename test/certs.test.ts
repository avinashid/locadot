import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import https from "node:https";

process.env.LOCADOT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "locadot-certs-"));

const { getCertFor, createSNICallback, defaultContext, ensureCA } = require("../src/utils/certs");

test("getCertFor returns the same cert on repeated calls", { timeout: 30_000 }, async () => {
  const first = await getCertFor("dev.localhost");
  const second = await getCertFor("dev.localhost");
  assert.equal(first.cert, second.cert);
});

test("issued cert: CA-signed, SAN, validity window", { timeout: 30_000 }, async () => {
  const ca = await ensureCA();
  const caX509 = new crypto.X509Certificate(ca.cert);
  const { cert } = await getCertFor("dev.localhost");
  const leaf = new crypto.X509Certificate(cert);

  assert.ok(leaf.checkIssued(caX509));
  assert.ok(leaf.subjectAltName?.includes("dev.localhost"));

  const days = (new Date(leaf.validTo).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(days > 0 && days <= 366, `validTo should be within ~366 days, got ${days}`);
});

test("TLS handshake via SNICallback is authorized by the CA", { timeout: 30_000 }, async () => {
  const ca = await ensureCA();
  const context = await defaultContext();

  const server = https.createServer({ ...context, SNICallback: createSNICallback() });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as any).port;

  try {
    const authorized = await new Promise<boolean>((resolve, reject) => {
      const socket = tls.connect(
        {
          host: "127.0.0.1",
          port,
          servername: "google.localhost",
          ca: ca.cert,
        },
        () => {
          resolve(socket.authorized);
          socket.end();
        }
      );
      socket.on("error", reject);
    });
    assert.equal(authorized, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

import crypto from "crypto";
import fs from "fs";
import path from "path";
import tls from "tls";
import { createCA, createCert } from "mkcert";
import Constants from "../constants";
import logger from "./logger";

const CA_KEY_FILE = path.join(Constants.paths.CERT_DIR, "locadot-ca.key");
const CA_CERT_FILE = path.join(Constants.paths.CERT_DIR, "locadot-ca.pem");

const CA_ORGANIZATION = "Locadot Development CA";
const CA_VALIDITY_DAYS = 365 * 10;
// Browsers (Chrome/Safari) reject leaf certs with validity > 398 days.
const LEAF_VALIDITY_DAYS = 365;
const RENEW_WITHIN_MS = 30 * 24 * 60 * 60 * 1000;

type KeyCert = { key: string; cert: string };

let caPromise: Promise<KeyCert & { certPath: string }> | null = null;
const certCache = new Map<string, KeyCert>();
const certInFlight = new Map<string, Promise<KeyCert>>();
const contextCache = new Map<string, { ctx: tls.SecureContext; cert: string }>();

export async function ensureCA(): Promise<KeyCert & { certPath: string }> {
  if (!caPromise) {
    caPromise = loadOrCreateCA();
  }
  return caPromise;
}

async function loadOrCreateCA(): Promise<KeyCert & { certPath: string }> {
  fs.mkdirSync(Constants.paths.CERT_DIR, { recursive: true });

  if (fs.existsSync(CA_KEY_FILE) && fs.existsSync(CA_CERT_FILE)) {
    return {
      key: fs.readFileSync(CA_KEY_FILE, "utf-8"),
      cert: fs.readFileSync(CA_CERT_FILE, "utf-8"),
      certPath: CA_CERT_FILE,
    };
  }

  logger.info("🔐 Generating local certificate authority");

  const ca = await createCA({
    organization: CA_ORGANIZATION,
    countryCode: "US",
    state: "California",
    locality: "San Francisco",
    validity: CA_VALIDITY_DAYS,
  });

  fs.writeFileSync(CA_KEY_FILE, ca.key, { mode: 0o600 });
  fs.writeFileSync(CA_CERT_FILE, ca.cert);

  return { ...ca, certPath: CA_CERT_FILE };
}

function sanDomainsFor(domain: string): string[] {
  return domain === "localhost" ? ["localhost", "127.0.0.1", "::1"] : [domain];
}

// Regenerate if the leaf isn't signed by the CA we currently trust (e.g. the
// CA was recreated) or if it's close enough to expiry that a long-running
// proxy could serve an expired cert before the next restart.
function isLeafStillValid(certPem: string, ca: crypto.X509Certificate): boolean {
  try {
    const leaf = new crypto.X509Certificate(certPem);
    if (!leaf.checkIssued(ca) || !leaf.verify(ca.publicKey)) return false;
    return new Date(leaf.validTo).getTime() - Date.now() > RENEW_WITHIN_MS;
  } catch {
    return false;
  }
}

async function loadOrCreateCert(domain: string): Promise<KeyCert> {
  const ca = await ensureCA();
  const caX509 = new crypto.X509Certificate(ca.cert);

  const keyFile = path.join(Constants.paths.CERT_DIR, `${domain}.key`);
  const certFile = path.join(Constants.paths.CERT_DIR, `${domain}.pem`);

  if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
    const key = fs.readFileSync(keyFile, "utf-8");
    const cert = fs.readFileSync(certFile, "utf-8");
    if (isLeafStillValid(cert, caX509)) return { key, cert };
  }

  logger.info(`🔐 Generating certificate for ${domain}`);

  const leaf = await createCert({
    domains: sanDomainsFor(domain),
    ca: { key: ca.key, cert: ca.cert },
    validity: LEAF_VALIDITY_DAYS,
    organization: CA_ORGANIZATION,
  });

  fs.mkdirSync(Constants.paths.CERT_DIR, { recursive: true });
  fs.writeFileSync(keyFile, leaf.key, { mode: 0o600 });
  fs.writeFileSync(certFile, leaf.cert);

  return leaf;
}

export async function getCertFor(domain: string): Promise<KeyCert> {
  const key = domain.toLowerCase();

  const cached = certCache.get(key);
  if (cached) {
    const caX509 = new crypto.X509Certificate((await ensureCA()).cert);
    if (isLeafStillValid(cached.cert, caX509)) return cached;
  }

  const inFlight = certInFlight.get(key);
  if (inFlight) return inFlight;

  const promise = loadOrCreateCert(key)
    .then((result) => {
      certCache.set(key, result);
      return result;
    })
    .finally(() => certInFlight.delete(key));

  certInFlight.set(key, promise);
  return promise;
}

export function createSNICallback(): (
  servername: string,
  cb: (err: Error | null, ctx?: tls.SecureContext) => void
) => void {
  return (servername, cb) => {
    const host = (servername || "localhost").toLowerCase();

    getCertFor(host)
      .then(({ key, cert }) => {
        // Re-use the SecureContext as long as the underlying cert hasn't
        // been rotated (getCertFor regenerates near expiry / CA change).
        const cached = contextCache.get(host);
        if (cached && cached.cert === cert) {
          cb(null, cached.ctx);
          return;
        }
        const ctx = tls.createSecureContext({ key, cert });
        contextCache.set(host, { ctx, cert });
        cb(null, ctx);
      })
      .catch((err) => cb(err));
  };
}

export async function defaultContext(): Promise<KeyCert> {
  return getCertFor("localhost");
}

export function caCertPath(): string {
  return CA_CERT_FILE;
}

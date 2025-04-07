import getAppDataPath from "appdata-path";
import fs, { type WriteStream } from "fs";
import path from "path";

const CERT_PATH = getAppDataPath("locadot");
import { createCA, createCert } from "mkcert";

export async function createSSL(domain: string) {
  console.log(`🔐 Preparing SSL cert for ${domain}`);

  const KEY_FILE = path.join(CERT_PATH, domain + ".key");
  const CERT_FILE = path.join(CERT_PATH, domain + ".pem");

  if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    console.log(`🔄 Using existing certificate for ${domain}`);
    const key = fs.readFileSync(KEY_FILE, "utf-8");
    const cert = fs.readFileSync(CERT_FILE, "utf-8");
    return { key, cert };
  }

  // Otherwise, generate a new one
  console.log(`🔐 Generating SSL cert for ${domain}`);

  const ca = await createCA({
    organization: "Locadot",
    countryCode: "IN",
    state: "DevState",
    locality: "DevTown",
    validity: 365,
  });

  const cert = await createCert({
    domains: [domain],
    ca: ca,
    validity: 365,
    organization: "Locadot",
  });

  if (!fs.existsSync(CERT_PATH)) fs.mkdirSync(CERT_PATH, { recursive: true });

  fs.writeFileSync(KEY_FILE, cert.key);
  fs.writeFileSync(CERT_FILE, cert.cert);

  return { key: cert.key, cert: cert.cert };
}

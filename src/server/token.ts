import crypto from "crypto";
import fs from "fs";
import Constants from "../constants";
import FileModule from "../utils/file";

// Rotated per start; the page gets it embedded, local scripts read the 0600 file.
export const issueApiToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  FileModule.ensureDir();
  fs.writeFileSync(Constants.paths.API_TOKEN, token, { mode: 0o600 });
  try {
    fs.chmodSync(Constants.paths.API_TOKEN, 0o600);
  } catch {}
  return token;
};

import readline from "readline";
import { InputError } from "../../lib/localhost";
import UiAuth, { MIN_PASSWORD } from "../../lib/ui-auth";
import { print } from "../shared";

export const readStdin = (): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.split(/\r?\n/)[0]));
    process.stdin.on("error", reject);
  });

/** Reads a line without echoing it. */
export const askHidden = (question: string): Promise<string> =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl);
    let prompted = false;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (!prompted) {
        prompted = true;
        write(s);
      } else if (s.includes("\n")) write("\n");
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });

/** Sets, resets or removes the dashboard password. Works whether or not the proxy is running. */
export async function uiPassword(options: { off?: boolean; stdin?: boolean }) {
  if (options.off) {
    const was = UiAuth.enabled();
    UiAuth.clear();
    print(was ? "🔓 Dashboard password removed. The dashboard is open to anyone on this machine again." : "ℹ️  No dashboard password was set.");
    return;
  }

  let password: string;
  if (options.stdin || !process.stdin.isTTY) {
    password = await readStdin();
  } else {
    password = await askHidden("New dashboard password: ");
    const again = await askHidden("Repeat it: ");
    if (password !== again) throw new InputError("❌ The passwords don't match.");
  }
  if (password.length < MIN_PASSWORD) throw new InputError(`❌ The password must be at least ${MIN_PASSWORD} characters.`);

  const was = UiAuth.enabled();
  UiAuth.set(password);
  print(
    was
      ? "🔑 Dashboard password reset. Everyone signed in has been signed out."
      : "🔒 The dashboard now asks for this password. Scripts using the API token (X-Locadot-Token) are unaffected."
  );
}

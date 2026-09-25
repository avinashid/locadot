// Entry point of the detached proxy process. `--home <dir>` lets boot-time
// launchers (root cron, SYSTEM task) use the invoking user's state dir.
const homeIndex = process.argv.indexOf("--home");
if (homeIndex > -1 && process.argv[homeIndex + 1]) {
  process.env.LOCADOT_HOME = process.argv[homeIndex + 1];
}
process.env.LOCADOT_ROLE = "proxy";

// Required after the env is set: constants read it at load time.
const { startCentralProxy } = require("./server") as typeof import("./server");

startCentralProxy().catch((error) => {
  console.error("❌ Failed to start central proxy", error);
  process.exit(1);
});

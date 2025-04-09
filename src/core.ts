import locadotProxy from "./server";

async function run() {
  await locadotProxy.startCentralProxy();
}

run();

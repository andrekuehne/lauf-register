import { execSync } from "node:child_process";

// The Worker inlines the bundled browser flow; build it before the Worker loads.
export default function setup() {
  execSync("node scripts/build-client.mjs", { stdio: "inherit" });
}

const { spawnSync } = require("node:child_process");
const path = require("node:path");
for (const args of [
  ["--test", "tests/runtime.cjs", "tests/controls.cjs"],
  ["tests/regression.cjs"],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
for (const file of [
  "runtime.js",
  "save-model.js",
  "account-config.js",
  "accounts.js",
  "account-ui.js",
  "combat-state.js",
  "controls.js",
  "controls-ui.js",
  "avatars.js",
  "avatar-motion.js",
  "browser-ui.js",
  "game.js",
]) {
  new vm.Script(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    filename: file,
  });
  console.log("OK", file);
}
for (const directory of ["backend/src", "backend/scripts"]) {
  for (const file of fs.readdirSync(path.join(__dirname, "..", directory))) {
    if (!file.endsWith(".js")) continue;
    const target = path.join(directory, file);
    const result = spawnSync(process.execPath, ["--check", target], {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    });
    if (result.status !== 0) process.exit(result.status || 1);
    console.log("OK", target);
  }
}

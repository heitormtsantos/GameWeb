const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
for (const file of [
  "runtime.js",
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

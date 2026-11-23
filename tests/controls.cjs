const { test } = require("node:test"),
  assert = require("node:assert/strict");
const vm = require("node:vm"),
  fs = require("node:fs"),
  path = require("node:path");
function load(file, name) {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
    context,
  );
  return context.window[name];
}
const Controls = load("controls.js", "ArenaControls"),
  Combat = load("combat-state.js", "ArenaCombat");
test("Cada arma conserva seu pente e o reset repõe os pentes", () => {
  const mags = new Combat.Magazines({ a: { mag: 28 }, b: { mag: 30 } });
  mags.write("a", 9);
  mags.write("b", 17);
  assert.equal(mags.read("a"), 9);
  assert.equal(mags.read("b"), 17);
  mags.reset();
  assert.equal(mags.read("a"), 28);
});
test("Nova tecla substitui a antiga e persiste no mapa", () => {
  const keys = new Controls.Bindings();
  assert.equal(keys.bind("reload", "KeyL").ok, true);
  assert.equal(keys.resolve("KeyL"), "KeyR");
  assert.equal(keys.resolve("KeyR"), null);
  const restored = new Controls.Bindings(keys.snapshot());
  assert.equal(restored.label("reload"), "L");
});
test("Conflitos e Escape são rejeitados sem alterar o mapa", () => {
  const keys = new Controls.Bindings();
  assert.equal(keys.bind("reload", "KeyW").ok, false);
  assert.equal(keys.bind("reload", "Escape").ok, false);
  assert.equal(keys.label("reload"), "R");
});
test("Saves inválidos recuperam padrão e restauração remove customização", () => {
  const keys = new Controls.Bindings({ reload: "Escape" });
  assert.equal(keys.label("reload"), "R");
  keys.bind("reload", "KeyL");
  keys.reset();
  assert.equal(keys.resolve("KeyR"), "KeyR");
  assert.equal(keys.resolve("KeyL"), null);
});
test("Soltar uma tecla não desativa outro atalho ainda pressionado", () => {
  const keys = new Controls.Bindings(),
    held = new Set(["KeyW", "ArrowUp"]),
    state = {};
  keys.sync(state, held);
  held.delete("KeyW");
  keys.sync(state, held);
  assert.equal(state.KeyW, true);
  held.clear();
  keys.sync(state, held);
  assert.equal(state.KeyW, false);
});

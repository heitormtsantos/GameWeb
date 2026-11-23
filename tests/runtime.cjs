const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm"),
  fs = require("node:fs"),
  path = require("node:path");
function load(file, name) {
  const context = { window: {}, performance: { now: () => 0 } };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
    context,
  );
  return context.window[name];
}
const Runtime = load("runtime.js", "ArenaRuntime");
for (const fps of [5, 10, 30, 60, 144])
  test(`Relógio mantém dois segundos em ${fps} FPS`, () => {
    const clock = new Runtime.SimulationClock();
    let steps = 0,
      distance = 0;
    for (let frame = 1; frame <= fps * 2; frame++)
      clock.advance((frame * 1000) / fps, true, (dt) => {
        steps++;
        distance += 5 * dt;
      });
    assert.equal(steps, 120);
    assert(Math.abs(clock.now - 12000) < 0.00001);
    assert(Math.abs(distance - 10) < 0.00001);
  });
test("Pausa descarta somente o tempo inativo e congela ações", () => {
  const clock = new Runtime.SimulationClock();
  let fired = false;
  clock.schedule(() => (fired = true), 200);
  clock.advance(100, true, () => {});
  clock.advance(5000, false, () => {});
  assert.equal(fired, false);
  assert(Math.abs(clock.now - 10100) < 0.001);
  clock.advance(5100, true, () => {});
  assert.equal(fired, true);
  assert(Math.abs(clock.now - 10200) < 0.001);
});
test("Quadro longo tem orçamento limitado sem perder o backlog", () => {
  const clock = new Runtime.SimulationClock();
  let steps = 0;
  clock.advance(3000, true, () => steps++);
  assert.equal(steps, 120);
  clock.advance(3000, true, () => steps++);
  assert.equal(steps, 180);
  assert(Math.abs(clock.now - 13000) < 0.001);
});

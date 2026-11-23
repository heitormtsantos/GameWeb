const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const Save = require("../save-model.js");
test("Modelo de save compartilha as teclas padrão do jogo", () => {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "controls.js"), "utf8"),
    context,
  );
  assert.deepEqual(
    Save.defaultKeys,
    JSON.parse(
      JSON.stringify(new context.window.ArenaControls.Bindings().snapshot()),
    ),
  );
});
test("Modelo limita estatísticas e deriva os pontos de missões", () => {
  const saved = Save.normalize({
    totalKills: 7,
    totalCapas: 20,
    boomKills: 2,
    totalBooyahs: 1,
    bonusPts: 100000,
  });
  assert.equal(saved.totalCapas, 7);
  assert.equal(saved.bonusPts, 600);
  assert.equal(Save.consistent(saved), true);
});
test("Modelo remove campos desconhecidos e recupera teclas inválidas", () => {
  const input = JSON.parse(
    '{"__proto__":{"polluted":true},"isAdmin":true,"keyBindings":{"reload":"Escape"},"sens":"bad"}',
  );
  const saved = Save.normalize(input);
  assert.equal(saved.isAdmin, undefined);
  assert.equal({}.polluted, undefined);
  assert.equal(saved.sens, 1);
  assert.equal(saved.keyBindings.reload, "KeyR");
});

const { chromium } = require("playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const path = require("node:path"),
  http = require("node:http");
const root = path.resolve(__dirname, ".."),
  artifacts = path.join(root, "test-results");
fs.mkdirSync(artifacts, { recursive: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".txt": "text/plain",
};
const server = http.createServer((request, response) => {
  const file = path.resolve(
    root,
    "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname),
  );
  if (file !== root && !file.startsWith(root + path.sep)) {
    response.writeHead(403);
    response.end();
    return;
  }
  const target = file === root ? path.join(root, "index.html") : file;
  fs.readFile(target, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "application/octet-stream",
    });
    response.end(data);
  });
});
let base;
const source = fs
  .readFileSync(path.join(root, "game.js"), "utf8")
  .replaceAll("\r\n", "\n");
const hook = `window.__arenaTest={state,player,clock,keys,bindings,magazines,simulate,renderer,scene,camera,sun,ui,playerChar,enemies,dummies,grenades,glooWalls,smokeClouds,landmines,particles3d,particlePool,tracers3d,shockwaves,loots,mushrooms,obstacles,nadeGeo,nadeMat,statsTotal,WEAPONS,validPacket,setupConn,startMatch,startX1Round,startCSRound,pauseGame,resumeGame,leaveGame,clearArenaEntities,spawnGlooWallAt,spawnSmokeCloud,throwGrenade,plantLandmine,spawnSparks,spawnLootBox,spawnMushrooms,startReload,selectWeapon,applyPlayerDamage,damageEnemy,fireWeapon,applyQuality};`;
const instrumented = source.replace(
  "  requestAnimationFrame(animate);\n})();",
  hook + "\n  requestAnimationFrame(animate);\n})();",
);
assert(
  instrumented.includes("window.__arenaTest="),
  "Instrumentation must be present",
);
const checks = [];
function passed(name, data) {
  checks.push({ name, status: "passed", ...data });
  console.log("PASS", name, data ? JSON.stringify(data) : "");
}
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + server.address().port + "/";
  const browser = await chromium.launch({
    ...(process.env.ARENA_BROWSER === "chromium"
      ? { channel: "chromium" }
      : { channel: process.env.ARENA_BROWSER || "chrome" }),
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  let page;
  try {
    const errors = [];
    async function fresh(init) {
      if (page) await page.close();
      page = await browser.newPage({
        viewport: { width: 1100, height: 760 },
        deviceScaleFactor: 1,
      });
      page.setDefaultTimeout(8000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/game.js", (route) =>
        route.fulfill({ contentType: "text/javascript", body: instrumented }),
      );
      if (init) await page.addInitScript(init);
      await page.goto(base);
      await page.waitForFunction(() => !!window.__arenaTest);
    }
    await fresh(() => localStorage.setItem("ff_web_apex2_v1", "{broken-json"));
    assert.equal(await page.locator(".mode-btn").count(), 6);
    passed("Inicialização com JSON corrompido");
    await fresh(() =>
      localStorage.setItem(
        "ff_web_apex2_v1",
        JSON.stringify({
          sens: "oops",
          totalKills: "infinity",
          skill: "bad",
          timeOfDay: "bad",
          shirtColor: "bad",
          quality: "bad",
        }),
      ),
    );
    assert.equal(await page.evaluate(() => __arenaTest.state.sens), 1);
    assert.equal(await page.evaluate(() => __arenaTest.statsTotal.kills), 0);
    passed("Valores inválidos no save recuperados");
    await fresh(() => {
      Storage.prototype.getItem = () => {
        throw new DOMException("blocked", "SecurityError");
      };
      Storage.prototype.setItem = () => {
        throw new DOMException("quota", "QuotaExceededError");
      };
    });
    assert.equal(await page.locator("#appNotice").isVisible(), true);
    passed("Armazenamento bloqueado não impede jogar");
    await fresh();
    await page.selectOption("#skinColorSel", "0xdc2626");
    await page.selectOption("#skinToneSel", "0x8d5a3a");
    await page.selectOption("#hatStyleSel", "none");
    assert.deepEqual(
      await page.evaluate(() => ({
        shirt: __arenaTest.playerChar.torsoMat.color.getHex(),
        skin: __arenaTest.playerChar.skinMat.color.getHex(),
        hat: __arenaTest.playerChar.helmet.visible,
      })),
      { shirt: 0xdc2626, skin: 0x8d5a3a, hat: false },
    );
    await page.reload();
    await page.waitForFunction(() => !!window.__arenaTest);
    assert.equal(await page.inputValue("#hatStyleSel"), "none");
    passed("Personalização real e persistência do avatar");
    await page.click("#btnControlsLobby");
    await page
      .locator("#keybindingsList summary")
      .filter({ hasText: "Combate" })
      .click();
    await page.click('[data-action="reload"]');
    await page.keyboard.press("w");
    assert.match(await page.locator("#bindingStatus").textContent(), /já está/);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#controlsModal").isVisible(), true);
    await page.click('[data-action="reload"]');
    await page.keyboard.press("l");
    await page.click('[data-action="forward"]');
    await page.keyboard.press("o");
    await page
      .locator("#keybindingsList summary")
      .filter({ hasText: "Equipamentos" })
      .click();
    await page.click('[data-action="skill"]');
    await page.keyboard.press("n");
    await page.screenshot({
      path: path.join(artifacts, "configurable-keys.png"),
    });
    await page.click("#btnCloseControls");
    await page.reload();
    await page.waitForFunction(() => !!window.__arenaTest);
    assert.equal(
      await page.evaluate(() => __arenaTest.bindings.label("reload")),
      "L",
    );
    assert.equal(
      await page.evaluate(() => __arenaTest.bindings.label("forward")),
      "O",
    );
    passed(
      "Editor rejeita conflitos, Escape cancela captura e teclas persistem",
    );
    await page.evaluate(() => {
      __arenaTest.applyQuality("low");
      __arenaTest.state.botsShoot = false;
    });
    await page.click("#playBtn");
    await page.waitForFunction(() => __arenaTest.state.started);
    const stationary = await page.evaluate(() => __arenaTest.player.pos.z);
    await page.keyboard.down("w");
    await page.waitForTimeout(200);
    await page.keyboard.up("w");
    assert.equal(
      await page.evaluate(() => __arenaTest.player.pos.z),
      stationary,
    );
    await page.keyboard.down("o");
    await page.waitForTimeout(350);
    await page.keyboard.up("o");
    const moved = await page.evaluate(() => __arenaTest.player.pos.z);
    assert(moved < 14);
    passed("Movimentação no teclado");
    const magazines = await page.evaluate(() => {
      const t = __arenaTest;
      t.state.ammo = 9;
      t.selectWeapon("scar");
      t.state.ammo = 17;
      t.selectWeapon("mp40");
      const first = t.state.ammo;
      t.selectWeapon("scar");
      const second = t.state.ammo;
      t.selectWeapon("mp40");
      return { first, second };
    });
    assert.deepEqual(magazines, { first: 9, second: 17 });
    passed("Trocar de arma preserva a munição de cada pente");
    await page.evaluate(() => {
      __arenaTest.clock.now += 1000;
      __arenaTest.state.lastShotAt = 0;
    });
    await page.mouse.click(700, 300);
    await page.waitForFunction(() => __arenaTest.state.ammo < 9);
    await page.evaluate(() => (__arenaTest.state.ammo = 9));
    passed("Clique rápido registra o tiro mesmo entre quadros");
    const cancelled = await page.evaluate(() => {
      const t = __arenaTest;
      t.startReload();
      t.selectWeapon("scar");
      t.selectWeapon("mp40");
      return { ammo: t.state.ammo, reloading: t.state.reloading };
    });
    assert.deepEqual(cancelled, { ammo: 9, reloading: false });
    await page.keyboard.press("r");
    assert.equal(await page.evaluate(() => __arenaTest.state.reloading), false);
    await page.keyboard.press("l");
    await page.waitForFunction(() => __arenaTest.state.ammo === 28);
    assert.equal(
      await page.evaluate(() => __arenaTest.magazines.read("scar")),
      17,
    );
    await page.keyboard.press("n");
    await page.waitForFunction(
      () => __arenaTest.player.skillActiveUntil > __arenaTest.clock.now,
    );
    assert.match(await page.locator("#uiSkill").textContent(), /\[N\]/);
    passed(
      "Recarga cancelada não repõe munição; novas teclas executam ações e atualizam HUD",
    );
    const articulation = await page.evaluate(() => {
      const c = __arenaTest.playerChar;
      return {
        knee: !!c.leftKneePivot,
        elbow: c.rightElbowPivot.rotation.x,
        gun: c.gunHolder.parent === c.rightElbowPivot,
      };
    });
    assert.equal(articulation.knee, true);
    assert.equal(articulation.gun, true);
    assert(Math.abs(articulation.elbow) > 0.01);
    passed("Personagem tem joelhos e cotovelos animados e arma presa à mão");
    await page.evaluate(() => {
      const t = __arenaTest;
      t.state.ammo = 1;
      t.startReload();
      t.throwGrenade(t.clock.now);
      t.clock.schedule(() => {
        window.__timerFired = true;
      }, 200);
    });
    await page.keyboard.press("p");
    await page.waitForFunction(() => __arenaTest.state.paused);
    const paused = await page.evaluate(() => ({
      time: __arenaTest.clock.now,
      pos: __arenaTest.player.pos.toArray(),
      fuse: __arenaTest.grenades[0].explodeAt,
      ammo: __arenaTest.state.ammo,
    }));
    await page.waitForTimeout(600);
    assert.deepEqual(
      await page.evaluate(() => ({
        time: __arenaTest.clock.now,
        pos: __arenaTest.player.pos.toArray(),
        fuse: __arenaTest.grenades[0].explodeAt,
        ammo: __arenaTest.state.ammo,
      })),
      paused,
    );
    assert.equal(await page.evaluate(() => window.__timerFired), undefined);
    passed("Pausa congela posição, recarga, granada e ações agendadas");
    await page.click("#btnResume");
    await page.waitForTimeout(100);
    assert.equal(await page.locator("#pauseModal").isVisible(), false);
    assert(
      Math.abs((await page.evaluate(() => __arenaTest.player.pos.z)) - moved) <
        0.001,
    );
    passed("Continuar retoma a mesma partida");
    await page.waitForFunction(() => window.__timerFired === true);
    passed("Ações agendadas retomam após continuar");
    await page.evaluate(() => {
      const t = __arenaTest;
      t.clock.schedule(() => (window.__staleCallback = true), 100);
      t.pauseGame();
    });
    await page.waitForFunction(
      () => document.pointerLockElement === null && __arenaTest.state.paused,
    );
    await page.click("#btnRestart");
    const reset = await page.evaluate(() => ({
      grenades: __arenaTest.grenades.length,
      tasks: __arenaTest.clock.tasks.size,
      smoke: __arenaTest.smokeClouds.length,
      round: __arenaTest.state.csRound,
      z: __arenaTest.player.pos.z,
    }));
    assert.equal(reset.grenades, 0, "grenades reset");
    assert.equal(reset.tasks, 0, "tasks reset");
    assert.equal(reset.smoke, 0);
    assert.equal(reset.z, 14);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__staleCallback), undefined);
    passed("Reinício elimina projéteis e callbacks da partida anterior");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal(await page.evaluate(() => __arenaTest.state.paused), true);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    passed("Ocultar a aba pausa a partida local");
    await page.selectOption("#qualityPause", "high");
    assert.equal(
      await page.evaluate(() => __arenaTest.renderer.shadowMap.enabled),
      true,
    );
    assert.equal(
      await page.evaluate(() => __arenaTest.sun.shadow.mapSize.x),
      2048,
    );
    await page.selectOption("#qualityPause", "low");
    assert.equal(
      await page.evaluate(() => __arenaTest.renderer.shadowMap.enabled),
      false,
    );
    passed("Presets gráficos alteram renderização e sombras");
    await page.click("#btnControlsPause");
    await page.click("#btnResetBindings");
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => __arenaTest.bindings.label("reload")),
      "R",
    );
    assert.equal(
      await page.evaluate(() => __arenaTest.bindings.label("forward")),
      "W",
    );
    passed("Restaurar padrão funciona pelo editor de teclas");
    await page.click("#btnExitLobby");
    for (const mode of ["br", "x1bot", "horda", "cs"]) {
      await page.click(`[data-mode="${mode}"]`);
      await page.click("#playBtn");
      if (mode === "cs") {
        assert.equal(await page.locator("#shopModal").isVisible(), true);
        await page.keyboard.press("p");
        assert.equal(await page.locator("#pauseModal").isVisible(), true);
        const shopTime = await page.evaluate(() => __arenaTest.clock.now);
        await page.waitForTimeout(180);
        assert.equal(
          await page.evaluate(() => __arenaTest.clock.now),
          shopTime,
        );
        await page.click("#btnResume");
        assert.equal(await page.locator("#shopModal").isVisible(), true);
        await page.click("#btnReadyCS");
      }
      await page.waitForFunction(() => __arenaTest.state.started);
      assert(
        (await page.evaluate(
          () => __arenaTest.enemies.filter((e) => e.alive).length,
        )) > 0,
      );
      await page.evaluate(() => __arenaTest.pauseGame());
      await page.click("#btnExitLobby");
    }
    passed("BR, duelo com bot, sobrevivência e loja Contra Squad iniciam");
    await page.click('[data-mode="treino"]');
    await page.click("#playBtn");
    const weapons = await page.evaluate(() => {
      const t = __arenaTest,
        keys = Object.keys(t.WEAPONS);
      t.state.botsShoot = false;
      for (const key of keys) {
        t.state.unlockedWeapons[key] = true;
        t.selectWeapon(key);
        t.clock.now += 2000;
        t.fireWeapon(t.clock.now);
        t.renderer.render(t.scene, t.camera);
      }
      t.leaveGame();
      return keys.length;
    });
    assert.equal(weapons, 11);
    passed("As onze armas trocam e disparam sem exceções");
    await page.click('[data-mode="x1bot"]');
    await page.click("#playBtn");
    const outcome = await page.evaluate(() => {
      const t = __arenaTest;
      t.state.csPlayerScore = 3;
      const enemy = t.enemies.find((e) => e.alive);
      t.damageEnemy(
        enemy,
        10000,
        true,
        enemy.char.root.position.clone(),
        t.clock.now,
      );
      return {
        started: t.state.started,
        title: document.getElementById("sumTitle").textContent,
        visible: !document
          .getElementById("summaryModal")
          .classList.contains("hidden"),
      };
    });
    assert.equal(outcome.started, false);
    assert.equal(outcome.visible, true);
    await page.click("#btnRematch");
    assert.equal(await page.evaluate(() => __arenaTest.state.started), true);
    await page.evaluate(() => __arenaTest.leaveGame());
    passed("Vitória abre resultado e revanche inicia nova partida");
    await page.click('[data-mode="x1"]');
    await page.click("#playBtn");
    assert.equal(await page.evaluate(() => __arenaTest.state.started), false);
    passed("X1 exige conexão antes de iniciar");
    const valid = await page.evaluate(() => ({
      bad: __arenaTest.validPacket({ t: "state", x: NaN }),
      huge: __arenaTest.validPacket({ t: "hit", dmg: 1e9 }),
      hit: __arenaTest.validPacket({ t: "hit", dmg: 25 }),
      unknown: __arenaTest.validPacket({ t: "other" }),
    }));
    assert.deepEqual(valid, {
      bad: false,
      huge: false,
      hit: true,
      unknown: false,
    });
    passed("Mensagens P2P inválidas e dano fora do limite rejeitados");
    const network = await page.evaluate(() => {
      const t = __arenaTest,
        listeners = {};
      const connection = {
        open: true,
        on: (name, fn) => {
          listeners[name] = fn;
        },
        send: () => {},
        close: () => {},
      };
      t.setupConn(connection);
      listeners.open();
      t.state.mode = "x1";
      t.startMatch();
      const before = t.player.hp;
      listeners.data({ t: "hit", dmg: NaN });
      listeners.data({ t: "hit", dmg: 25, isHead: false });
      const after = t.player.hp;
      listeners.data({ t: "roundWin" });
      listeners.data({ t: "roundWin" });
      const score = t.state.csPlayerScore;
      t.leaveGame();
      return { before, after, score };
    });
    assert(network.after < network.before);
    assert.equal(network.score, 1);
    passed("Protocolo X1 aplica dano válido e ignora resultado duplicado");
    const head = await page.evaluate(() => {
      const t = __arenaTest,
        d = t.dummies[0];
      t.scene.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      d.hHit.getWorldPosition(v);
      const ray = new THREE.Raycaster(
        v.clone().add(new THREE.Vector3(0, 0, 2)),
        new THREE.Vector3(0, 0, -1),
      );
      const hits = ray.intersectObjects([d.hHit, d.bHit]);
      return {
        head: hits[0]?.object.userData.isHead,
        width: d.hHit.geometry.parameters.width,
      };
    });
    assert.equal(head.head, true);
    assert.equal(head.width, 0.46);
    passed("Área de acerto da cabeça acompanha o avatar de blocos");
    const speeds = await page.evaluate(() => {
      const t = __arenaTest,
        results = [];
      for (const fps of [5, 10, 30, 60, 144]) {
        t.state.mode = "treino";
        t.startMatch();
        t.state.botsShoot = false;
        t.state.aimMode = "total";
        t.state.camYaw = 0;
        t.state.camPitch = 0;
        t.clock.now = 10000;
        t.clock.lastReal = 0;
        t.clock.accumulator = 0;
        t.keys.KeyW = true;
        t.state.ammo = 1;
        t.startReload();
        for (let i = 1; i <= fps * 2; i++)
          t.clock.advance((i * 1000) / fps, true, t.simulate);
        results.push({
          fps,
          z: t.player.pos.z,
          ammo: t.state.ammo,
          now: t.clock.now,
        });
        t.leaveGame();
      }
      t.clock.lastReal = performance.now();
      return results;
    });
    for (const result of speeds) {
      assert(Math.abs(result.z - 3) < 0.0001);
      assert.equal(result.ammo, 28);
      assert(Math.abs(result.now - 12000) < 0.0001);
    }
    passed("Movimento e recarga equivalentes na simulação de 5 a 144 FPS");
    const memory = await page.evaluate(() => {
      const t = __arenaTest;
      t.state.mode = "treino";
      t.state.started = false;
      t.applyQuality("low");
      function cycle() {
        t.clearArenaEntities();
        t.spawnMushrooms();
        t.spawnGlooWallAt(0, 0, 0, 0, t.clock.now, true);
        t.spawnSmokeCloud(new THREE.Vector3(4, 0, 0), t.clock.now, true);
        t.spawnLootBox(new THREE.Vector3(0, 0, 0));
        t.throwGrenade(t.clock.now, true);
        t.spawnSparks(new THREE.Vector3(), 0xff0000, 24);
        t.renderer.render(t.scene, t.camera);
        t.clearArenaEntities();
        t.renderer.render(t.scene, t.camera);
      }
      cycle();
      const start = { ...t.renderer.info.memory };
      for (let i = 0; i < 20; i++) cycle();
      const end = { ...t.renderer.info.memory };
      return { start, end, pool: t.particlePool.length };
    });
    assert(memory.end.geometries <= memory.start.geometries + 1);
    assert(memory.pool <= 48);
    passed("Memória gráfica estável em 20 ciclos de efeitos e limpeza", memory);
    // Isolate layout checks from the preceding GPU allocation stress test.
    await fresh();
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => {
        const el = document.getElementById("overlay");
        return el.scrollWidth > el.clientWidth + 1;
      });
      assert.equal(overflow, false);
      if (viewport.width === 390) {
        await page.locator("#overlay").evaluate((el) => (el.scrollTop = 0));
        await page.screenshot({
          path: path.join(artifacts, "mobile-lobby.png"),
          timeout: 30000,
        });
      }
    }
    passed("Lobby sem rolagem horizontal em 390, 768 e 1366 pixels");
    await fresh();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: path.join(artifacts, "lobby-preview.png"),
      timeout: 30000,
    });
    assert.deepEqual(errors, []);
    passed("Sem exceções JavaScript durante os testes");
    fs.writeFileSync(
      path.join(artifacts, "results.json"),
      JSON.stringify(
        { browser: "Chrome headless / SwiftShader", checks },
        null,
        2,
      ),
    );
  } catch (error) {
    if (page) {
      await page
        .screenshot({
          path: path.join(artifacts, "failure.png"),
          timeout: 5000,
        })
        .catch(() => {});
      console.log(
        "browser failure detail",
        await page.evaluate(() => ({
          lock: !!document.pointerLockElement,
          body: document.body.className,
          state: window.__arenaTest?.state.started,
        })),
      );
    }
    throw error;
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});

(() => {
  "use strict";
  if (typeof THREE === "undefined") {
    ArenaUI.fatal(
      "Os recursos do jogo não carregaram. Extraia o ZIP completo ou abra o arquivo HTML autônomo.",
    );
    return;
  }
  const R = ArenaRuntime,
    clock = new R.SimulationClock(),
    disposeObject = R.disposeObject;
  let ui = null;
  const $ = (id) => document.getElementById(id);

  // TEXTURAS & MIRAS PNG
  function mkTex(type, c1, c2, rx = 1, ry = 1) {
    const c = document.createElement("canvas");
    c.width = type === "conc" ? 256 : 128;
    c.height = c.width;
    const x = c.getContext("2d"),
      S = c.width;
    x.fillStyle = c1;
    x.fillRect(0, 0, S, S);
    if (type === "wood") {
      x.fillStyle = c2;
      for (let i = 0; i < S; i += 16) x.fillRect(0, i, S, 2);
      x.strokeStyle = "#5c3a21";
      x.lineWidth = 8;
      x.strokeRect(4, 4, S - 8, S - 8);
      x.beginPath();
      x.moveTo(6, 6);
      x.lineTo(S - 6, S - 6);
      x.moveTo(S - 6, 6);
      x.lineTo(6, S - 6);
      x.stroke();
    } else if (type === "metal") {
      x.fillStyle = c2;
      for (let i = 0; i < S; i += 12) x.fillRect(i, 0, 5, S);
      x.fillStyle = "rgba(255,255,255,0.08)";
      x.fillRect(0, 10, S, 8);
      x.fillRect(0, S - 18, S, 8);
    } else {
      for (let i = 0; i < 420; i++) {
        x.fillStyle =
          Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
        x.fillRect(Math.random() * S, Math.random() * S, 4, 4);
      }
      if (type === "conc") {
        x.strokeStyle = "rgba(0,0,0,0.14)";
        x.lineWidth = 2;
        x.strokeRect(0, 0, S, S);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    return t;
  }
  function createScopePNG(type) {
    const c = document.createElement("canvas");
    c.width = 1280;
    c.height = 720;
    const ctx = c.getContext("2d"),
      W = c.width,
      H = c.height,
      cx = W / 2,
      cy = H / 2,
      R = type === "4x" ? 305 : 280;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = type === "4x" ? "rgba(4,7,12,0.95)" : "rgba(4,7,12,0.68)";
    ctx.fill("evenodd");
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    const vig = ctx.createRadialGradient(cx, cy, R * 0.78, cx, cy, R);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.62)");
    ctx.fillStyle = vig;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    ctx.strokeStyle = "rgba(15,20,26,0.92)";
    ctx.lineWidth = type === "4x" ? 6 : 4;
    ctx.beginPath();
    const gap = type === "4x" ? 140 : 75;
    ctx.moveTo(cx - R + 12, cy);
    ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + R - 12, cy);
    ctx.lineTo(cx + gap, cy);
    ctx.moveTo(cx, cy + R - 12);
    ctx.lineTo(cx, cy + gap);
    if (type === "4x") {
      ctx.moveTo(cx, cy - R + 12);
      ctx.lineTo(cx, cy - gap);
    }
    ctx.stroke();
    if (type === "2x") {
      ctx.strokeStyle = "rgba(74,222,128,0.85)";
      ctx.lineWidth = 2.4;
      [0.25, Math.PI / 2 + 0.25, Math.PI + 0.25, Math.PI * 1.5 + 0.25].forEach(
        (a) => {
          ctx.beginPath();
          ctx.arc(cx, cy, 34, a, a + Math.PI / 2 - 0.5);
          ctx.stroke();
        },
      );
    } else {
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - 140, cy);
      ctx.lineTo(cx - 8, cy);
      ctx.moveTo(cx + 140, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx, cy - 140);
      ctx.lineTo(cx, cy - 8);
      ctx.moveTo(cx, cy + 150);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();
      ctx.fillStyle = "#0f141a";
      for (let i = 1; i <= 4; i++) {
        const d = i * 26;
        [cx - d, cx + d].forEach((px) => {
          ctx.beginPath();
          ctx.arc(px, cy, 2.8, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.beginPath();
        ctx.arc(cx, cy - d, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - 6 - i * 3, cy + d);
        ctx.lineTo(cx + 6 + i * 3, cy + d);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "#1e242c";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = "900 18px Segoe UI, sans-serif";
    ctx.fillStyle = "#ffbe2e";
    ctx.fillText(type.toUpperCase(), cx + R * 0.65, cy + R * 0.68);
    const img = new Image();
    img.src = c.toDataURL("image/png");
    return img;
  }
  const imgMira2x = createScopePNG("2x"),
    imgMira4x = createScopePNG("4x");

  // LOCALSTORAGE, PATENTE & MISSÕES
  const SAVE_KEY = "ff_web_apex2_v1",
    saved = R.loadSave(SAVE_KEY);
  for (const [key, fallback, min, max] of [
    ["sens", 1, 0.3, 2.5],
    ["redDotSens", 0.9, 0.3, 2.5],
    ["sens2x", 0.8, 0.2, 2],
    ["sens4x", 0.7, 0.2, 2],
    ["assistStrength", 1, 0, 1.5],
    ...[
      "totalKills",
      "totalCapas",
      "totalBooyahs",
      "boomKills",
      "bonusPts",
    ].map((key) => [key, 0, 0, 1e9]),
  ])
    saved[key] = R.number(saved[key], fallback, min, max);
  for (const [key, options, fallback] of [
    ["skill", ["alok", "chrono", "tatsuya"], "alok"],
    ["pet", ["panda", "waggor", "falcao", "none"], "panda"],
    ["timeOfDay", ["dia", "tarde", "noite", "chuva"], "dia"],
    ["aimMode", ["padrao", "precisa", "total"], "padrao"],
    ["evoSkin", ["padrao", "dragao", "cobra", "trovao"], "padrao"],
    [
      "shirtColor",
      ["0x2563eb", "0xdc2626", "0xd97706", "0x7c3aed", "0x15803d"],
      "0x2563eb",
    ],
    ["skinTone", ["0xf3c59d", "0xd99c70", "0x8d5a3a", "0xffda64"], "0xf3c59d"],
    ["hatStyle", ["cap", "none"], "cap"],
    ["hatColor", ["0xffcf4a", "0xf3f0e7", "0x142036"], "0xffcf4a"],
    ["quality", ["low", "medium", "high"], "medium"],
  ])
    saved[key] = R.choice(saved[key], options, fallback);
  const bindings = new ArenaControls.Bindings(saved.keyBindings);
  const keyHint = (id) => bindings.label(id);
  const statsTotal = {
    kills: saved.totalKills || 0,
    capas: saved.totalCapas || 0,
    booyahs: saved.totalBooyahs || 0,
    boomKills: saved.boomKills || 0,
    bonusPts: saved.bonusPts || 0,
  };
  function getRankName() {
    const pts =
      statsTotal.kills * 10 +
      statsTotal.capas * 15 +
      statsTotal.booyahs * 100 +
      statsTotal.bonusPts;
    return pts >= 4500
      ? "Desafiante 🔥"
      : pts >= 2500
        ? "Mestre 🏆"
        : pts >= 1500
          ? "Diamante 💎"
          : pts >= 800
            ? "Platina"
            : pts >= 400
              ? "Ouro"
              : pts >= 150
                ? "Prata"
                : "Bronze";
  }
  function renderMissions() {
    const list = [
      [
        `Dê 5 Capas (${Math.min(5, statsTotal.capas)}/5)`,
        statsTotal.capas >= 5,
        "+150 pts",
      ],
      [
        `Elimine c/ Granada/Barril/Mina/M79 (${Math.min(1, statsTotal.boomKills)}/1)`,
        statsTotal.boomKills >= 1,
        "+150 pts",
      ],
      [
        `Vença 1 Booyah no CS/BR/X1 (${Math.min(1, statsTotal.booyahs)}/1)`,
        statsTotal.booyahs >= 1,
        "+300 pts",
      ],
    ];
    $("missionsBar").innerHTML = list
      .map(
        ([t, d, rw]) =>
          `<div class="mission-pill ${d ? "done" : ""}"><b>${d ? "✅" : "🎯"} ${t}</b><br><span style="color:#ffbe2e;">${d ? "Concluída!" : "Recompensa: " + rw}</span></div>`,
      )
      .join("");
  }
  function persistSave() {
    statsTotal.bonusPts =
      (statsTotal.capas >= 5 ? 150 : 0) +
      (statsTotal.boomKills >= 1 ? 150 : 0) +
      (statsTotal.booyahs >= 1 ? 300 : 0);
    const stored = R.save(SAVE_KEY, {
      sens: state.sens,
      redDotSens: state.redDotSens,
      sens2x: state.sens2x,
      sens4x: state.sens4x,
      assistStrength: state.assistStrength,
      aimMode: state.aimMode,
      shirtColor: state.shirtColor,
      evoSkin: state.evoSkin,
      skill: state.skill,
      pet: state.pet,
      timeOfDay: state.timeOfDay,
      totalKills: statsTotal.kills,
      totalCapas: statsTotal.capas,
      totalBooyahs: statsTotal.booyahs,
      boomKills: statsTotal.boomKills,
      bonusPts: statsTotal.bonusPts,
      skinTone: state.skinTone,
      hatStyle: state.hatStyle,
      hatColor: state.hatColor,
      quality: state.quality,
      keyBindings: bindings.snapshot(),
    });
    if (!stored && !persistSave.warned) {
      persistSave.warned = true;
      ArenaUI.notice(
        "O navegador não permitiu salvar o progresso. Você pode continuar jogando.",
      );
    }
    $("svKills").textContent = statsTotal.kills;
    $("svCapas").textContent = statsTotal.capas;
    $("svBooyahs").textContent = statsTotal.booyahs;
    const r = getRankName();
    $("uiRank").textContent = r;
    $("svRank").textContent = r;
    renderMissions();
  }

  const overlay = $("overlay"),
    shopModal = $("shopModal"),
    summaryModal = $("summaryModal"),
    fxCanvas = $("fxLayer"),
    fxCtx = fxCanvas.getContext("2d");
  const settingsPanel = $("settingsPanel"),
    killfeedEl = $("killfeed"),
    vehiclePrompt = $("vehiclePrompt");
  const pauseModal = $("pauseModal");
  const scoreBox = $("scoreBox"),
    banner = $("banner"),
    bannerMain = $("bannerMain"),
    bannerSub = $("bannerSub");

  const modes = [
    ["treino", "Treino livre", "Arsenal completo · pratique à vontade", "◎"],
    ["br", "Battle Royale", "Você + 11 bots · último sobrevivente", "⚑"],
    ["x1bot", "Duelo com bot", "1 contra 1 · melhor de 7", "⚔"],
    ["cs", "Contra Squad", "1 contra 3 bots · loja por round", "▦"],
    ["horda", "Sobrevivência", "Ondas de bots · chefão a cada 3", "✦"],
    ["x1", "X1 com amigo", "Online casual · entre por código", "↔"],
  ];
  modes.forEach(([id, title, description, icon], index) => {
    const b = document.createElement("button");
    b.className = "mode-btn" + (index === 0 ? " selected" : "");
    b.dataset.mode = id;
    b.dataset.icon = icon;
    b.setAttribute("aria-pressed", index === 0 ? "true" : "false");
    const name = document.createElement("b"),
      desc = document.createElement("small");
    name.textContent = title;
    desc.textContent = description;
    b.append(name, desc);
    b.onclick = () => {
      document.querySelectorAll(".mode-btn").forEach((item) => {
        item.classList.toggle("selected", item === b);
        item.setAttribute("aria-pressed", String(item === b));
      });
      state.mode = id;
      $("p2pBox").classList.toggle("show", id === "x1");
      $("playHint").textContent = description + " · teclado e mouse";
    };
    $("modeBtns").append(b);
  });

  // ÁUDIO
  let audioCtx = null,
    noiseBuffer = null;
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuffer = audioCtx.createBuffer(
        1,
        audioCtx.sampleRate * 0.25,
        audioCtx.sampleRate,
      );
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++)
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.25));
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }
  function speakAnnouncer(t) {
    if ($("voiceToggle").value !== "on" || !("speechSynthesis" in window))
      return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "en-US";
      u.rate = 1.15;
      u.pitch = 0.85;
      u.volume = 0.6;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  function playTone(type, f1, f2, dur, vol) {
    if (!audioCtx) return;
    const n = audioCtx.currentTime,
      o = audioCtx.createOscillator(),
      g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, n);
    o.frequency.exponentialRampToValueAtTime(Math.max(10, f2), n + dur);
    g.gain.setValueAtTime(vol, n);
    g.gain.exponentialRampToValueAtTime(0.001, n + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(n);
    o.stop(n + dur + 0.01);
  }
  function playNoiseBurst(freq, dur, vol) {
    if (!audioCtx || !noiseBuffer) return;
    const n = audioCtx.currentTime,
      s = audioCtx.createBufferSource(),
      f = audioCtx.createBiquadFilter(),
      g = audioCtx.createGain();
    s.buffer = noiseBuffer;
    f.type = "bandpass";
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, n);
    g.gain.exponentialRampToValueAtTime(0.001, n + dur);
    s.connect(f);
    f.connect(g);
    g.connect(audioCtx.destination);
    s.start(n);
    s.stop(n + dur);
  }
  function playShotSound(w, v = 1) {
    if (w === "katana") return playTone("triangle", 1200, 2400, 0.12, 0.16 * v);
    const cfg = {
      mp40: ["triangle", 220, 55, 0.07, 0.18, 1600, 0.06, 0.2],
      vector: ["triangle", 270, 60, 0.06, 0.17, 1800, 0.05, 0.18],
      scar: ["sawtooth", 165, 45, 0.09, 0.2, 1100, 0.09, 0.26],
      carapina: ["sawtooth", 210, 48, 0.12, 0.24, 1400, 0.11, 0.28],
      groza: ["sine", 250, 75, 0.07, 0.15, 2400, 0.05, 0.09],
      m79: ["sine", 160, 45, 0.2, 0.3, 500, 0.18, 0.24],
      m1014: ["sine", 125, 28, 0.18, 0.36, 750, 0.16, 0.38],
      m1887: ["sawtooth", 105, 24, 0.22, 0.42, 620, 0.2, 0.44],
      deagle: ["sawtooth", 280, 42, 0.13, 0.3, 1300, 0.12, 0.32],
      awm: ["sawtooth", 145, 22, 0.26, 0.36, 800, 0.22, 0.42],
    }[w];
    if (cfg) {
      playTone(cfg[0], cfg[1], cfg[2], cfg[3], cfg[4] * v);
      playNoiseBurst(cfg[5], cfg[6], cfg[7] * v);
    }
  }
  const playHitSound = (h, b) =>
    b
      ? playTone("square", 1500, 320, 0.18, 0.35)
      : h
        ? playTone("triangle", 1050, 1900, 0.12, 0.3)
        : playTone("sine", 300, 110, 0.055, 0.18);
  const playStepSound = () => playTone("sine", 95, 45, 0.045, 0.045),
    playReloadSound = () => playTone("square", 420, 680, 0.06, 0.12),
    playBounceSound = () => playTone("triangle", 220, 130, 0.05, 0.12),
    playSmokeSound = () => playTone("sine", 420, 140, 0.35, 0.18),
    playExplosionSound = () => {
      playTone("sawtooth", 110, 18, 0.48, 0.52);
      playNoiseBurst(350, 0.25, 0.5);
    },
    playSkillSound = () => playTone("triangle", 380, 860, 0.25, 0.22);

  function addKillfeed(k, w, v, c) {
    const d = document.createElement("div");
    d.className = "kf-item" + (c ? " capa" : "");
    d.innerHTML = `<span style="color:#38bdf8">${k}</span> <span style="color:#ffbe2e">[${w}]</span> ${c ? "🎯" : "💀"} <span style="color:#f87171">${v}</span>${c ? ' <b style="color:#ff3b3b">CAPA!</b>' : ""}`;
    killfeedEl.prepend(d);
    if (killfeedEl.children.length > 4) killfeedEl.lastChild.remove();
    setTimeout(() => d.remove(), 4200);
  }

  // CENA THREE.JS & CLIMA
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6b9ac4);
  scene.fog = new THREE.FogExp2(0x88b0d1, 0.008);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
    });
  } catch {
    ArenaUI.fatal(
      "Este navegador não conseguiu iniciar o WebGL. Ative a aceleração gráfica ou tente outro navegador atualizado.",
    );
    return;
  }
  const camera = new THREE.PerspectiveCamera(
    62,
    innerWidth / innerHeight,
    0.15,
    280,
  );
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute(
    "aria-label",
    "Arena 3D. Use WASD para mover e Escape para abrir o menu.",
  );
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    pauseGame();
    ArenaUI.fatal(
      "A conexão com a placa gráfica foi perdida. Recarregue para voltar ao lobby; o progresso salvo é preservado.",
    );
  });
  document.body.insertBefore(renderer.domElement, fxCanvas);

  let W = innerWidth,
    H = innerHeight,
    CX = W / 2,
    CY = H / 2;
  function onResize() {
    W = innerWidth;
    H = innerHeight;
    CX = W / 2;
    CY = H / 2;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    fxCanvas.width = W;
    fxCanvas.height = H;
  }
  addEventListener("resize", onResize);
  onResize();

  const hemiLight = new THREE.HemisphereLight(0xe8f4ff, 0x4b5336, 0.8);
  scene.add(hemiLight);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.08);
  sun.position.set(26, 42, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 135;
  sun.shadow.camera.left = -52;
  sun.shadow.camera.right = 52;
  sun.shadow.camera.top = 52;
  sun.shadow.camera.bottom = -52;
  scene.add(sun);
  const sunDiscMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      fog: false,
    }),
    sunDisc = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 16), sunDiscMat);
  sunDisc.position.set(70, 95, 55);
  scene.add(sunDisc);

  const rainCount = 450,
    rainGeo = new THREE.BufferGeometry(),
    rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 50;
    rainPos[i * 3 + 1] = Math.random() * 24;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 50;
  }
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rainPoints = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.14,
      transparent: true,
      opacity: 0.65,
    }),
  );
  rainPoints.visible = false;
  scene.add(rainPoints);
  let nextLightningAt = 0,
    lightningOffAt = 0;

  function applyTimeOfDay(tod) {
    rainPoints.visible = tod === "chuva";
    sunDisc.visible = tod !== "chuva";
    const th = {
      dia: [
        0x6b9ac4, 0x88b0d1, 0.008, 0xfff1d6, 1.08, 26, 42, 22, 0.8, 0xfef08a,
        70, 95, 55,
      ],
      tarde: [
        0xd97742, 0xc96f4b, 0.009, 0xff9e5e, 1.15, 35, 18, -30, 0.65, 0xfb923c,
        70, 34, -70,
      ],
      noite: [
        0x0b132b, 0x111a33, 0.011, 0x60a5fa, 0.36, -25, 38, -20, 0.38, 0xe2e8f0,
        -60, 82, -55,
      ],
      chuva: [
        0x1e293b, 0x283548, 0.014, 0x94a3b8, 0.48, 10, 38, 10, 0.45, 0xe2e8f0,
        0, 90, 0,
      ],
    }[tod];
    scene.background.setHex(th[0]);
    scene.fog.color.setHex(th[1]);
    scene.fog.density = th[2];
    sun.color.setHex(th[3]);
    sun.intensity = th[4];
    sun.position.set(th[5], th[6], th[7]);
    hemiLight.intensity = th[8];
    sunDiscMat.color.setHex(th[9]);
    sunDisc.position.set(th[10], th[11], th[12]);
    if (tod === "chuva") nextLightningAt = clock.now + 4000;
  }

  const grassTex = mkTex("grass", "#475938", "", 36, 36),
    concreteTex = mkTex("conc", "#5d6266", "", 14, 16),
    woodTex = mkTex("wood", "#8b5e3c", "#734b2e");
  const blueTex = mkTex("metal", "#2a6f97", "#1d5170", 2, 1),
    orangeTex = mkTex("metal", "#c2631b", "#964910", 2, 1),
    redTex = mkTex("metal", "#9b2226", "#721619", 2, 1),
    tealTex = mkTex("metal", "#456990", "#314c69", 2, 1);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.94 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(70, 0.04, 78),
    new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.86 }),
  );
  pad.position.set(0, 0.01, -7);
  pad.receiveShadow = true;
  scene.add(pad);
  const mtnMat = new THREE.MeshStandardMaterial({
    color: 0x3b4d3e,
    roughness: 1,
  });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2,
      d = 92 + (i % 3) * 12,
      h = 16 + (i % 4) * 7,
      m = new THREE.Mesh(
        new THREE.ConeGeometry(18 + (i % 3) * 6, h, 5),
        mtnMat,
      );
    m.position.set(Math.cos(a) * d, h / 2 - 1, Math.sin(a) * d - 6);
    scene.add(m);
  }
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
  });
  for (let i = 0; i < 14; i++) {
    const cg = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(3.2 - j * 0.5, 8, 8),
        cloudMat,
      );
      p.position.x = (j - 1) * 2.8;
      p.scale.y = 0.55;
      cg.add(p);
    }
    cg.position.set(
      (Math.random() - 0.5) * 150,
      32 + Math.random() * 12,
      (Math.random() - 0.5) * 150,
    );
    scene.add(cg);
  }

  const obstacles = [];
  let obstacleRevision = 0,
    cachedObstacleRevision = -1,
    obstacleCache = [];
  function getObstacleMeshes() {
    if (cachedObstacleRevision !== obstacleRevision) {
      obstacleCache = obstacles.map((item) => item.mesh);
      cachedObstacleRevision = obstacleRevision;
    }
    return obstacleCache;
  }
  function addObstacle(x, y, z, w, h, d, mO) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial(
        typeof mO === "number"
          ? { color: mO, roughness: 0.78 }
          : { map: mO, roughness: 0.75 },
      ),
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obstacles.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
    obstacleRevision++;
  }
  [
    [0, 0, -45, 72, 5, 1.5, 0x3b424d],
    [0, 0, 30, 72, 5, 1.5, 0x3b424d],
    [-35, 0, -8, 1.5, 5, 78, 0x3b424d],
    [35, 0, -8, 1.5, 5, 78, 0x3b424d],
    [-4.7, 0, -4.3, 0.6, 3.2, 0.6, 0x64748b],
    [4.7, 0, -4.3, 0.6, 3.2, 0.6, 0x64748b],
    [-4.7, 0, -11.7, 0.6, 3.2, 0.6, 0x64748b],
    [4.7, 0, -11.7, 0.6, 3.2, 0.6, 0x64748b],
    [0, 0, -11.7, 5, 2.2, 0.5, 0x94a3b8],
    [0, 3.05, -8, 10.2, 0.27, 8.2, 0x78716c],
    [0, 3.32, -4.1, 10, 0.95, 0.35, 0x9ca3af],
    [0, 3.32, -11.9, 10, 0.95, 0.35, 0x9ca3af],
    [4.85, 3.32, -8, 0.35, 0.95, 7.6, 0x9ca3af],
    [15.3, 0, 7.3, 0.45, 5.8, 0.45, 0x5c4033],
    [20.7, 0, 7.3, 0.45, 5.8, 0.45, 0x5c4033],
    [15.3, 0, 12.7, 0.45, 5.8, 0.45, 0x5c4033],
    [20.7, 0, 12.7, 0.45, 5.8, 0.45, 0x5c4033],
    [18, 2.4, 10, 6, 0.22, 6, woodTex],
    [18, 5.7, 10, 6.4, 0.25, 6.4, 0x7f1d1d],
    [18, 2.62, 7.15, 5.6, 0.92, 0.3, woodTex],
    [18, 2.62, 12.85, 5.6, 0.92, 0.3, woodTex],
    [20.85, 2.62, 10, 0.3, 0.92, 5.4, woodTex],
    [-11, 0, 1, 3, 2.3, 5.8, blueTex],
    [13, 0, -2, 3, 2.4, 5.8, orangeTex],
    [-13, 0, -21, 3, 2.3, 5.5, redTex],
    [15, 0, -22, 3.2, 2.4, 5.5, tealTex],
    [-6, 0, 11, 2.4, 1.35, 2.4, woodTex],
    [6, 0, 12, 2.4, 1.35, 2.4, woodTex],
    [0, 0, -25, 4.6, 1.35, 1.8, woodTex],
  ].forEach((o) => addObstacle(...o));

  const mkRamp = (len, w, x, y, z, rz) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.22, w),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 }),
    );
    m.position.set(x, y, z);
    m.rotation.z = rz;
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  };
  mkRamp(Math.hypot(6, 3.32), 3.0, -8.0, 1.56, -8.0, Math.atan2(3.32, 6));
  mkRamp(Math.hypot(4.5, 2.62), 2.6, 12.75, 1.22, 10.0, Math.atan2(2.62, 4.5));

  const zipAnchorA = new THREE.Vector3(4.2, 3.32, -7.8),
    zipAnchorB = new THREE.Vector3(15.8, 2.62, 9.2);
  [zipAnchorA, zipAnchorB].forEach((p) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5 }),
    );
    post.position.set(p.x, p.y + 0.8, p.z);
    scene.add(post);
  });
  scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        zipAnchorA.clone().add(new THREE.Vector3(0, 1.4, 0)),
        zipAnchorB.clone().add(new THREE.Vector3(0, 1.4, 0)),
      ]),
      new THREE.LineBasicMaterial({ color: 0xfacc15 }),
    ),
  );

  // Arsenal Tático
  const arsenalGroup = new THREE.Group();
  const arsBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 1.1, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7 }),
  );
  arsBase.position.y = 0.55;
  arsBase.castShadow = true;
  const arsTrim = new THREE.Mesh(
    new THREE.BoxGeometry(1.76, 0.22, 1.26),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
    }),
  );
  arsTrim.position.y = 0.95;
  const arsIcon = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true }),
  );
  arsIcon.position.y = 1.8;
  arsenalGroup.add(arsBase, arsTrim, arsIcon);
  arsenalGroup.position.set(-19, 0, -10);
  scene.add(arsenalGroup);
  const arsenal = {
    group: arsenalGroup,
    pos: arsenalGroup.position,
    icon: arsIcon,
    prog: 0,
    readyAt: 0,
  };

  const laneMark = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.03, 0.25),
    new THREE.MeshBasicMaterial({ color: 0xffbe2e }),
  );
  laneMark.position.set(-24, 0.04, 15);
  scene.add(laneMark);
  [
    [-38, 12],
    [-39, -14],
    [38, 10],
    [39, -18],
    [-18, -48],
    [18, -48],
  ].forEach(([x, z]) => {
    const tr = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.4, 3.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c4033 }),
    );
    tr.position.set(x, 1.7, z);
    tr.castShadow = true;
    scene.add(tr);
    const lf = new THREE.Mesh(
      new THREE.SphereGeometry(1.9, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f }),
    );
    lf.position.set(x, 4.2, z);
    lf.castShadow = true;
    scene.add(lf);
  });

  const upgraders = [];
  [
    [0, 0, -8],
    [18, 2.62, 10],
  ].forEach(([ux, uy, uz]) => {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.95, 0.14, 16),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.6,
      }),
    );
    ring.position.set(ux, uy + 0.07, uz);
    scene.add(ring);
    upgraders.push({ mesh: ring, pos: ring.position, readyAt: 0 });
  });
  const barrels = [],
    barrelMeshes = [];
  [
    [-8.5, -1],
    [8.5, -5],
    [0, -14],
    [-10, -24],
    [11, 4],
  ].forEach(([bx, bz]) => {
    const g = new THREE.Group(),
      cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 1.25, 14),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 }),
      );
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.24, 14),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
    );
    g.add(cyl, stripe);
    g.position.set(bx, 0.625, bz);
    scene.add(g);
    const bObj = {
      group: g,
      cyl,
      pos: g.position,
      hp: 60,
      alive: true,
      respawnAt: 0,
    };
    cyl.userData = { barrel: bObj };
    stripe.userData = { barrel: bObj };
    barrels.push(bObj);
    barrelMeshes.push(cyl, stripe);
  });
  const resetBarrels = () =>
    barrels.forEach((b) => {
      b.alive = true;
      b.hp = 60;
      b.group.visible = true;
    });

  const safeZone = {
    active: false,
    radius: 44,
    minRadius: 5,
    centerX: 0,
    centerZ: -6,
    shrinkSpeed: 1.4,
  };
  const zoneMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 20, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  zoneMesh.position.set(0, 10, -6);
  zoneMesh.visible = false;
  scene.add(zoneMesh);

  function getFloorY(x, z, curY) {
    if (x >= -11.3 && x <= -4.9 && z >= -9.6 && z <= -6.4) {
      const ry = Math.max(0, Math.min(1, (x + 11.0) / 6.0)) * 3.32;
      if (curY >= ry - 0.9) return ry;
    }
    if (x >= -5.1 && x <= 5.1 && z >= -12.1 && z <= -3.9 && curY >= 2.4)
      return 3.32;
    if (x >= 10.3 && x <= 15.1 && z >= 8.6 && z <= 11.4) {
      const ry = Math.max(0, Math.min(1, (x - 10.5) / 4.5)) * 2.62;
      if (curY >= ry - 0.9) return ry;
    }
    if (x >= 14.8 && x <= 21.2 && z >= 6.8 && z <= 13.2 && curY >= 5.3)
      return 5.95;
    if (x >= 15.0 && x <= 21.0 && z >= 7.0 && z <= 13.0 && curY >= 1.9)
      return 2.62;
    return 0;
  }

  // Gel, Minas, Ping, VANT, Cogumelos, Buggy, AirDrop
  const glooWalls = [];
  let lastGelTime = -10000;
  function spawnGlooWallAt(x, y, z, yaw, now, skipSound = false) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 2.1, 0.42),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        roughness: 0.25,
        transparent: true,
        opacity: 0.88,
      }),
    );
    mesh.position.set(x, y + 1.05, z);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const obs = {
      mesh,
      box: new THREE.Box3().setFromObject(mesh),
      isOBB: true,
      cx: x,
      cz: z,
      hw: 1.7,
      hd: 0.24,
      yaw,
      minY: y,
      maxY: y + 2.1,
      createdAt: now,
      hp: 350,
      isGel: true,
    };
    obstacles.push(obs);
    obstacleRevision++;
    glooWalls.push(obs);
    if (!skipSound) playTone("sine", 520, 180, 0.18, 0.24);
  }
  function playerUseGel(now, forceCrouch = false) {
    if (
      player.dead ||
      player.inVehicle ||
      player.parachuting ||
      player.onZipline ||
      (!state.customRoom && player.gels <= 0) ||
      now - lastGelTime < 750
    )
      return;
    lastGelTime = now;
    if (forceCrouch) player.crouching = true;
    if (state.mode !== "treino" && !state.customRoom) player.gels--;
    const aimY = player.freeLook ? player.lockedMoveYaw : state.camYaw,
      dist = forceCrouch ? 2.0 : 2.5,
      gx = player.pos.x - Math.sin(aimY) * dist,
      gz = player.pos.z - Math.cos(aimY) * dist;
    spawnGlooWallAt(gx, player.pos.y, gz, aimY, now);
    sendP2P({ t: "gel", x: gx, y: player.pos.y, z: gz, yaw: aimY });
  }
  const landmines = [];
  function plantLandmine(x, y, z, now, isRemote = false) {
    if (!isRemote) {
      if (
        player.dead ||
        player.inVehicle ||
        player.parachuting ||
        player.onZipline ||
        (!state.customRoom && player.mines <= 0)
      )
        return;
      if (state.mode !== "treino" && !state.customRoom) player.mines--;
      sendP2P({ t: "mine", x, y, z });
    }
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.34, 0.1, 12),
        new THREE.MeshStandardMaterial({ color: 0x334155 }),
      ),
    );
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    );
    led.position.y = 0.08;
    g.add(led);
    g.position.set(x, y + 0.05, z);
    scene.add(g);
    landmines.push({ group: g, pos: g.position, armedAt: now + 900, isRemote });
    playTone("square", 650, 420, 0.08, 0.14);
  }
  const pingGroup = new THREE.Group(),
    pingBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 16, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
  pingBeam.position.y = 8;
  pingGroup.add(pingBeam);
  pingGroup.visible = false;
  scene.add(pingGroup);
  const pingState = { active: false, pos: pingGroup.position, expiresAt: 0 };
  const uavGroup = new THREE.Group(),
    uavBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.25, 0.9),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.6,
      }),
    ),
    uavRing = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.3, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }),
    );
  uavRing.rotation.x = -Math.PI / 2;
  uavGroup.add(uavBody, uavRing);
  uavGroup.visible = false;
  scene.add(uavGroup);
  const mushrooms = [];
  function spawnMushrooms() {
    mushrooms.forEach((m) => disposeObject(m.group));
    mushrooms.length = 0;
    [
      [-18, 12],
      [18, -14],
      [-8, -28],
      [22, 4],
      [-22, -28],
      [4, 20],
    ].forEach(([mx, mz]) => {
      const g = new THREE.Group(),
        stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.16, 0.3, 8),
          new THREE.MeshStandardMaterial({ color: 0xfef3c7 }),
        );
      stem.position.y = 0.15;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.32,
          10,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.55,
        ),
        new THREE.MeshStandardMaterial({
          color: 0xf97316,
          emissive: 0xea580c,
          emissiveIntensity: 0.4,
        }),
      );
      cap.position.y = 0.28;
      g.add(stem, cap);
      g.position.set(mx, 0, mz);
      scene.add(g);
      mushrooms.push({ group: g, active: true, respawnAt: 0 });
    });
  }

  const buggyGroup = new THREE.Group(),
    buggyBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.75, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.7 }),
    );
  buggyBody.position.y = 0.7;
  buggyBody.castShadow = true;
  buggyGroup.add(buggyBody);
  const buggyHood = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.4, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x4d7c0f }),
  );
  buggyHood.position.set(0, 0.85, -1.1);
  buggyGroup.add(buggyHood);
  const cageMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.6,
  });
  [
    [-0.82, 0.5],
    [0.82, 0.5],
    [-0.82, -0.5],
    [0.82, -0.5],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6),
      cageMat,
    );
    post.position.set(px, 1.5, pz);
    buggyGroup.add(post);
  });
  const roofBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.08, 1.1),
    cageMat,
  );
  roofBar.position.set(0, 2.08, 0);
  buggyGroup.add(roofBar);
  const buggyWheels = [],
    wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.34, 14),
    wheelMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.9,
    });
  [
    [-1.02, -1.1],
    [1.02, -1.1],
    [-1.02, 1.1],
    [1.02, 1.1],
  ].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.45, wz);
    w.castShadow = true;
    buggyGroup.add(w);
    buggyWheels.push(w);
  });
  buggyGroup.position.set(25, 0, 18);
  scene.add(buggyGroup);
  const buggy = {
    group: buggyGroup,
    pos: buggyGroup.position,
    yaw: 0,
    speed: 0,
    lastEngineAt: 0,
  };

  const airdropGroup = new THREE.Group(),
    dropBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0xb91c1c,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.3,
      }),
    );
  dropBox.position.y = 0.7;
  dropBox.castShadow = true;
  airdropGroup.add(dropBox);
  const dropTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.48, 0.25, 1.48),
    new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
  );
  dropTop.position.y = 1.4;
  airdropGroup.add(dropTop);
  const chute = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, side: THREE.DoubleSide }),
  );
  chute.position.y = 3.6;
  airdropGroup.add(chute);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 34, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  beacon.position.y = 17;
  airdropGroup.add(beacon);
  airdropGroup.visible = false;
  scene.add(airdropGroup);
  const airdrop = {
    active: false,
    pos: airdropGroup.position,
    nextSpawnAt: clock.now + 18000,
    landed: false,
  };
  function spawnAirdrop(now) {
    const s = [
      [0, 3],
      [-10, -10],
      [8, -12],
      [-2, -20],
    ][Math.floor(Math.random() * 4)];
    airdrop.active = true;
    airdrop.landed = false;
    airdrop.pos.set(s[0], 34, s[1]);
    chute.visible = true;
    airdropGroup.visible = true;
    showBanner(
      "AIRDROP A CAMINHO! 📦",
      "Groza + M79 + Vector Dupla!",
      "#ffbe2e",
    );
  }

  // ARMAS 3D & PERSONAGENS COMPACTOS
  function buildWeaponModel(key, evoSkin = "padrao") {
    const g = new THREE.Group(),
      dark = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.65,
        roughness: 0.35,
      }),
      grey = new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.5,
        roughness: 0.4,
      });
    const base = {
      mp40: 0xf59e0b,
      scar: 0xd97706,
      carapina: 0xd946ef,
      m1014: 0xdc2626,
      m1887: 0xb45309,
      awm: 0x15803d,
      deagle: 0xcbd5e1,
      groza: 0x9333ea,
      m79: 0x65a30d,
      katana: 0x38bdf8,
      vector: 0x06b6d4,
    }[key];
    const col =
      { dragao: 0xff3b3b, cobra: 0x22c55e, trovao: 0x38bdf8 }[evoSkin] || base;
    const acc = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.32,
      metalness: key === "deagle" || key === "katana" ? 0.8 : 0.25,
      emissive: evoSkin !== "padrao" ? col : 0,
      emissiveIntensity: evoSkin !== "padrao" ? 0.55 : 0,
    });
    const box = (w, h, d, m, x = 0, y = 0, z = 0, rx = 0) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      o.rotation.x = rx;
      g.add(o);
    };
    const cyl = (r, l, m, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 8), m);
      o.rotation.x = Math.PI / 2;
      o.position.set(x, y, z);
      g.add(o);
    };
    if (key === "katana") {
      cyl(0.025, 0.26, dark, 0, 0, 0.05);
      box(0.015, 0.06, 0.88, acc, 0, 0.01, -0.45);
    } else if (key === "mp40" || key === "vector") {
      box(0.075, 0.1, key === "vector" ? 0.38 : 0.46, dark);
      cyl(0.018, 0.24, grey, 0, 0.02, -0.28);
      box(0.045, 0.22, 0.06, acc, 0, -0.14, -0.06, 0.12);
    } else if (key === "scar" || key === "groza" || key === "carapina") {
      box(0.085, 0.12, key === "carapina" ? 0.68 : 0.58, acc);
      cyl(key === "groza" ? 0.032 : 0.02, 0.44, dark, 0, 0.01, -0.46);
      box(0.05, 0.2, 0.08, dark, 0, -0.12, -0.08, 0.2);
      box(0.055, 0.06, 0.18, dark, 0, 0.09, 0.02);
    } else if (key === "m1014") {
      box(0.09, 0.11, 0.65, dark);
      cyl(0.025, 0.48, grey, 0, -0.02, -0.36);
      cyl(0.025, 0.52, dark, 0, 0.03, -0.38);
      box(0.095, 0.06, 0.2, acc, 0, 0.01, 0.05);
    } else if (key === "m1887") {
      box(0.08, 0.1, 0.34, acc, 0, -0.02, 0.12);
      cyl(0.023, 0.56, grey, -0.026, 0.02, -0.25);
      cyl(0.023, 0.56, grey, 0.026, 0.02, -0.25);
    } else if (key === "m79") {
      box(0.09, 0.12, 0.32, acc, 0, -0.03, 0.1);
      cyl(0.052, 0.44, dark, 0, 0.03, -0.2);
    } else if (key === "deagle") {
      box(0.065, 0.09, 0.34, acc, 0, 0.03, -0.08);
      box(0.055, 0.15, 0.08, dark, 0, -0.06, 0.04, -0.25);
    } else {
      box(0.085, 0.12, 0.72, acc);
      cyl(0.02, 0.62, dark, 0, 0.02, -0.55);
      cyl(0.036, 0.34, dark, 0, 0.1, -0.02);
    }
    return g;
  }

  function createCharacter(opts) {
    return ArenaAvatars.create(THREE, opts, buildWeaponModel);
  }

  const petGroup = new THREE.Group(),
    petBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    );
  const petEarL = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x0f172a }),
  );
  petEarL.position.set(-0.15, 0.2, 0);
  const petEarR = petEarL.clone();
  petEarR.position.x = 0.15;
  const petWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.04, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8 }),
  );
  petGroup.add(petBody, petEarL, petEarR, petWing);
  scene.add(petGroup);
  function updatePetVisual(p) {
    petGroup.visible = p !== "none";
    petWing.visible = p === "falcao";
    petEarL.visible = petEarR.visible = p === "panda";
    petBody.material.color.setHex(
      p === "panda" ? 0xf8fafc : p === "waggor" ? 0x38bdf8 : 0xfacc15,
    );
  }

  const muzzleLight = new THREE.PointLight(0xffb703, 0, 8.5);
  scene.add(muzzleLight);
  const playerChute = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }),
  );
  playerChute.position.set(0, 3.2, 0);
  playerChute.visible = false;
  const alokRing = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.1, 32),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    }),
  );
  alokRing.rotation.x = -Math.PI / 2;
  alokRing.visible = false;
  scene.add(alokRing);
  const chronoDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.55, 20, 14),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  chronoDome.visible = false;
  scene.add(chronoDome);
  const remoteAlokRing = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.1, 32),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    }),
  );
  remoteAlokRing.rotation.x = -Math.PI / 2;
  remoteAlokRing.visible = false;
  scene.add(remoteAlokRing);
  const remoteChronoDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.55, 20, 14),
    new THREE.MeshStandardMaterial({
      color: 0xff3b3b,
      emissive: 0xdc2626,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    }),
  );
  remoteChronoDome.visible = false;
  scene.add(remoteChronoDome);

  // ESTADO & 11 ARMAS
  const WEAPON_ORDER = [
    "mp40",
    "scar",
    "m1014",
    "m1887",
    "awm",
    "deagle",
    "carapina",
    "groza",
    "m79",
    "katana",
    "vector",
  ];
  const WEAPONS = {
    mp40: {
      name: "MP40",
      short: "MP40",
      sub: "SMG Capa",
      mag: 28,
      rate: 78,
      dmg: 25,
      headMult: 4.5,
      recoil: 0.0042,
      spread: 0.011,
      pellets: 1,
      fov: 48,
      range: 48,
      reload: 1100,
      assistPx: 108,
      shake: 0.015,
    },
    scar: {
      name: "SCAR",
      short: "SCAR",
      sub: "AR • 2x",
      mag: 30,
      rate: 118,
      dmg: 35,
      headMult: 4.2,
      recoil: 0.0056,
      spread: 0.005,
      pellets: 1,
      fov: 35,
      range: 82,
      reload: 1300,
      assistPx: 120,
      shake: 0.022,
    },
    m1014: {
      name: "M1014",
      short: "M1014",
      sub: "Doze 6T",
      mag: 6,
      rate: 460,
      dmg: 20,
      headMult: 3.4,
      recoil: 0.014,
      spread: 0.036,
      pellets: 7,
      fov: 50,
      range: 26,
      reload: 1450,
      assistPx: 125,
      shake: 0.065,
    },
    m1887: {
      name: "M1887 (Doze Nova)",
      short: "M1887",
      sub: "Doze Nova",
      mag: 2,
      rate: 310,
      dmg: 29,
      headMult: 2.8,
      recoil: 0.018,
      spread: 0.028,
      pellets: 6,
      fov: 50,
      range: 23,
      reload: 1100,
      assistPx: 130,
      shake: 0.085,
    },
    awm: {
      name: "AWM",
      short: "AWM",
      sub: "Sniper 4x",
      mag: 5,
      rate: 950,
      dmg: 150,
      headMult: 3.8,
      recoil: 0.022,
      spread: 0.001,
      pellets: 1,
      fov: 19,
      range: 115,
      reload: 1700,
      assistPx: 92,
      shake: 0.095,
    },
    deagle: {
      name: "Águia do Deserto",
      short: "Águia",
      sub: "Pistola",
      mag: 7,
      rate: 260,
      dmg: 62,
      headMult: 3.2,
      recoil: 0.011,
      spread: 0.003,
      pellets: 1,
      fov: 46,
      range: 65,
      reload: 1200,
      assistPx: 112,
      shake: 0.045,
    },
    carapina: {
      name: "Carapina",
      short: "Carapina",
      sub: "Precisão",
      mag: 12,
      rate: 230,
      dmg: 58,
      headMult: 3.8,
      recoil: 0.009,
      spread: 0.0018,
      pellets: 1,
      fov: 32,
      range: 98,
      reload: 1350,
      assistPx: 118,
      shake: 0.035,
    },
    groza: {
      name: "Groza (Silenc.)",
      short: "Groza",
      sub: "Drop Sil.",
      mag: 32,
      rate: 102,
      dmg: 42,
      headMult: 4.2,
      recoil: 0.0045,
      spread: 0.0032,
      pellets: 1,
      fov: 34,
      range: 90,
      reload: 1200,
      assistPx: 125,
      shake: 0.016,
    },
    m79: {
      name: "M79 Lança",
      short: "M79",
      sub: "Lança",
      mag: 3,
      rate: 850,
      dmg: 190,
      headMult: 1.0,
      recoil: 0.024,
      spread: 0.002,
      pellets: 1,
      fov: 52,
      range: 70,
      reload: 1900,
      assistPx: 95,
      shake: 0.1,
    },
    katana: {
      name: "Katana",
      short: "Katana",
      sub: "+Vel. Corte",
      mag: 1,
      rate: 380,
      dmg: 115,
      headMult: 1.6,
      recoil: 0,
      spread: 0,
      pellets: 1,
      fov: 62,
      range: 3.4,
      reload: 0,
      assistPx: 140,
      shake: 0.03,
      melee: true,
    },
    vector: {
      name: "Vector Dupla",
      short: "Vector 2x",
      sub: "Akimbo [Y]",
      mag: 40,
      rate: 55,
      dmg: 19,
      headMult: 3.9,
      recoil: 0.0035,
      spread: 0.015,
      pellets: 2,
      fov: 50,
      range: 38,
      reload: 1300,
      assistPx: 114,
      shake: 0.014,
      akimbo: true,
    },
  };

  const magazines = new ArenaCombat.Magazines(WEAPONS);
  const slotsBox = $("weaponSlots");
  WEAPON_ORDER.forEach((k, i) => {
    const d = document.createElement("div");
    d.className = "slot" + (k === "mp40" ? " active" : "");
    d.dataset.w = k;
    d.dataset.action =
      k === "vector" ? "weaponVector" : "weapon" + ((i + 1) % 10);
    d.innerHTML = `<b>${keyHint(d.dataset.action)} • ${WEAPONS[k].short}</b><small>${WEAPONS[k].sub.replace(" [Y]", "")}</small>`;
    d.onclick = () => selectWeapon(k);
    slotsBox.appendChild(d);
  });
  const weaponSlots = document.querySelectorAll(".slot");

  const state = {
    started: false,
    paused: false,
    quality: saved.quality,
    skinTone: saved.skinTone,
    hatStyle: saved.hatStyle,
    hatColor: saved.hatColor,
    mode: "treino",
    customRoom: false,
    skill: saved.skill || "alok",
    pet: saved.pet || "panda",
    timeOfDay: saved.timeOfDay || "dia",
    camYaw: 0,
    camPitch: 0.02,
    camShake: 0,
    gunKick: 0,
    shoulderSide: 1,
    curShoulder: 1,
    weaponKey: "mp40",
    prevWeaponKey: "katana",
    reloading: false,
    reloadEnd: 0,
    isFiring: false,
    fireQueued: false,
    isScoped: false,
    firePressedAt: 0,
    scopePressedAt: 0,
    lastShotAt: 0,
    bloom: 0,
    userDragUp: 0,
    sens: saved.sens ?? 1.0,
    redDotSens: saved.redDotSens ?? 0.9,
    sens2x: saved.sens2x ?? 0.8,
    sens4x: saved.sens4x ?? 0.7,
    assistStrength: saved.assistStrength ?? 1.0,
    aimMode: saved.aimMode || "padrao",
    shirtColor: saved.shirtColor || "0x2563eb",
    evoSkin: saved.evoSkin || "padrao",
    botsShoot: true,
    targetInCone: null,
    hitmarkerAt: 0,
    hitmarkerHead: false,
    killBadgeAt: -10000,
    killBadgeHead: false,
    kills: 0,
    capas: 0,
    capaStreak: 0,
    streak: 0,
    matchDmg: 0,
    lastKillAt: 0,
    flashOffAt: 0,
    csRound: 1,
    csPlayerScore: 0,
    csEnemyScore: 0,
    csCoins: 800,
    hordaWave: 1,
    hordaNextWaveAt: 0,
    csShopOpen: false,
    csShopEndAt: 0,
    unlockedWeapons: {
      mp40: true,
      scar: true,
      m1014: true,
      m1887: true,
      awm: true,
      deagle: true,
      carapina: true,
      groza: false,
      m79: false,
      katana: true,
      vector: true,
    },
    roundOver: false,
    outOfZone: false,
  };

  Object.defineProperty(state, "ammo", {
    enumerable: true,
    get: () => magazines.read(state.weaponKey),
    set: (value) => magazines.write(state.weaponKey, value),
  });

  [
    ["sens", "Sens. Geral", 0.3, 2.5],
    ["redDotSens", "Ponto Vermelho", 0.3, 2.5],
    ["sens2x", "Mira 2x", 0.2, 2],
    ["sens4x", "Mira 4x / AWM", 0.2, 2],
    ["assistStrength", "Assistência", 0, 1.5],
  ].forEach(([p, l, mn, mx]) => {
    const r = document.createElement("div");
    r.className = "set-row";
    const v = () =>
      p === "assistStrength"
        ? Math.round(state[p] * 100) + "%"
        : state[p].toFixed(1);
    r.innerHTML = `<span>${l}: <b>${v()}</b></span><input type="range" min="${mn}" max="${mx}" step="0.1" value="${state[p]}" />`;
    const inp = r.querySelector("input"),
      b = r.querySelector("b");
    inp.oninput = () => {
      state[p] = +inp.value;
      b.textContent = v();
      persistSave();
    };
    $("slidersBox").appendChild(r);
  });

  $("aimMode").value = state.aimMode;
  $("skinColorSel").value = state.shirtColor;
  $("evoSkinSel").value = state.evoSkin;
  $("skillSel").value = state.skill;
  $("petSel").value = state.pet;
  $("timeSel").value = state.timeOfDay;
  applyTimeOfDay(state.timeOfDay);
  updatePetVisual(state.pet);
  $("svKills").textContent = statsTotal.kills;
  $("svCapas").textContent = statsTotal.capas;
  $("svBooyahs").textContent = statsTotal.booyahs;
  persistSave();

  const playerChar = createCharacter({
    shirtColor: parseInt(state.shirtColor),
    pantsColor: 0x111827,
    hatColor: parseInt(state.hatColor),
    skinTone: parseInt(state.skinTone),
    backpack: true,
    weaponKey: "mp40",
    evoSkin: state.evoSkin,
  });
  playerChar.root.add(playerChute);
  playerChar.root.position.set(0, 0, 14);
  scene.add(playerChar.root);

  const player = {
    pos: playerChar.root.position,
    hp: 200,
    maxHp: 200,
    ep: 0,
    maxEp: 200,
    helmLv: 1,
    helmHp: 80,
    helmMax: 80,
    vestLv: 1,
    vestHp: 100,
    vestMax: 100,
    gels: 5,
    kits: 3,
    inhalers: 3,
    nades: 2,
    mines: 2,
    smokes: 2,
    dead: false,
    respawnAt: 0,
    velY: 0,
    onGround: true,
    crouching: false,
    sprinting: false,
    walkTime: 0,
    charYaw: 0,
    lastStepCycle: 0,
    freeLook: false,
    lockedMoveYaw: 0,
    healing: false,
    healEnd: 0,
    damageFlashAt: 0,
    aimingNade: false,
    inVehicle: false,
    parachuting: false,
    emoteUntil: 0,
    slashUntil: 0,
    onZipline: false,
    zipT: 0,
    zipFrom: new THREE.Vector3(),
    zipTo: new THREE.Vector3(),
    nextWaggorAt: 0,
    uavActiveUntil: 0,
    uavCdUntil: 0,
    skillActiveUntil: 0,
    skillCdUntil: 0,
    tatsuyaCharges: 2,
    tatsuyaRechargeAt: 0,
    dashUntil: 0,
    dashDir: new THREE.Vector3(),
  };

  const damageDirs = [];
  function activateSkill(now) {
    if (player.dead || player.inVehicle || player.parachuting) return;
    if (state.skill === "tatsuya") {
      if (player.tatsuyaCharges <= 0) return;
      player.tatsuyaCharges--;
      if (player.tatsuyaCharges === 1) player.tatsuyaRechargeAt = now + 8000;
      player.dashUntil = now + 220;
      player.dashDir
        .set(-Math.sin(state.camYaw), 0, -Math.cos(state.camYaw))
        .normalize();
      playSkillSound();
      spawnSparks(
        player.pos.clone().add(new THREE.Vector3(0, 0.8, 0)),
        0x38bdf8,
        8,
      );
    } else if (state.skill === "alok" && now >= player.skillCdUntil) {
      player.skillActiveUntil = now + 6000;
      player.skillCdUntil = now + 16000;
      playSkillSound();
    } else if (state.skill === "chrono" && now >= player.skillCdUntil) {
      player.skillActiveUntil = now + 4500;
      player.skillCdUntil = now + 19000;
      playSkillSound();
    }
  }
  function activateUAV(now) {
    if (!player.dead && now >= player.uavCdUntil) {
      player.uavActiveUntil = now + 10000;
      player.uavCdUntil = now + 26000;
      uavGroup.visible = true;
      playSkillSound();
      showBanner(
        "VANT ATIVADO! 🛸",
        "Inimigos revelados através das paredes!",
        "#facc15",
      );
    }
  }
  function useInhaler() {
    if (
      player.dead ||
      player.inVehicle ||
      player.parachuting ||
      (!state.customRoom && player.inhalers <= 0) ||
      (player.hp >= player.maxHp && player.ep >= player.maxEp)
    )
      return;
    if (state.mode !== "treino" && !state.customRoom) player.inhalers--;
    player.hp = Math.min(player.maxHp, player.hp + 25);
    player.ep = Math.min(player.maxEp, player.ep + 25);
    updateHpUI();
    playTone("sine", 700, 980, 0.14, 0.16);
  }
  function updateArmorHUD() {
    $("uiHelmLv").textContent =
      player.helmHp > 0 ? `Nv.${player.helmLv}` : "Quebr.";
    $("uiHelmHp").textContent =
      player.helmHp > 0
        ? Math.round((player.helmHp / player.helmMax) * 100) + "%"
        : "0%";
    $("uiVestLv").textContent =
      player.vestHp > 0 ? `Nv.${player.vestLv}` : "Quebr.";
    $("uiVestHp").textContent =
      player.vestHp > 0
        ? Math.round((player.vestHp / player.vestMax) * 100) + "%"
        : "0%";
    playerChar.helmet.visible = player.helmHp > 0 && state.hatStyle !== "none";
  }
  function updateHpUI() {
    const pct = Math.max(0, (player.hp / player.maxHp) * 100);
    $("uiHpText").textContent =
      `HP ${Math.max(0, Math.round(player.hp))} / ${player.maxHp}`;
    $("uiHpBar").style.width = pct + "%";
    $("uiHpBar").style.background =
      pct < 35
        ? "linear-gradient(90deg,#ef4444,#f87171)"
        : "linear-gradient(90deg,#e2e8f0,#fff)";
    $("uiEpText").textContent = `EP ${Math.round(player.ep)}`;
    $("uiEpBar").style.width =
      Math.max(0, (player.ep / player.maxEp) * 100) + "%";
    updateArmorHUD();
  }
  function refreshWeaponSlotLocks() {
    weaponSlots.forEach((s) => {
      const k = s.dataset.w;
      s.classList.toggle("active", k === state.weaponKey);
      s.classList.toggle("locked", !state.unlockedWeapons[k]);
    });
  }
  function selectWeapon(key) {
    if (!WEAPONS[key] || state.weaponKey === key || !state.unlockedWeapons[key])
      return;
    state.prevWeaponKey = state.weaponKey;
    state.weaponKey = key;
    state.reloadEnd = 0;
    state.reloading = false;
    if (WEAPONS[key].melee) state.isScoped = false;
    refreshWeaponSlotLocks();
    disposeObject(playerChar.currentGun);
    playerChar.currentGun = buildWeaponModel(key, state.evoSkin);
    playerChar.gunHolder.add(playerChar.currentGun);
    playerChar.leftGunHolder.visible = !!WEAPONS[key].akimbo;
    updateAmmoUI();
  }
  function updateAmmoUI() {
    const w = WEAPONS[state.weaponKey];
    if (w.melee) {
      $("uiAmmo").textContent = `${w.name} • CORPO-A-CORPO`;
      return;
    }
    $("uiAmmo").textContent = state.reloading
      ? `${w.name} • RECARREGANDO...`
      : `${w.name} • ${state.customRoom ? "∞" : state.ammo} / ∞`;
  }
  function startReload() {
    if (state.customRoom || WEAPONS[state.weaponKey].melee) return;
    const w = WEAPONS[state.weaponKey];
    if (state.reloading || player.parachuting || state.ammo === w.mag) return;
    state.reloading = true;
    state.reloadEnd = clock.now + w.reload;
    playReloadSound();
    updateAmmoUI();
  }
  function startMedkit(now) {
    if (
      !player.dead &&
      !player.inVehicle &&
      !player.parachuting &&
      !player.onZipline &&
      !player.healing &&
      player.hp < player.maxHp &&
      (state.customRoom || player.kits > 0)
    ) {
      player.healing = true;
      player.healEnd = now + 2000;
    }
  }

  let bannerTimer = null;
  function showBanner(m, s, c) {
    bannerMain.textContent = m;
    bannerMain.style.color = c;
    bannerSub.textContent = s || "";
    banner.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove("show"), 1300);
  }

  // FUMAÇA, LOOT, GRANADAS & ALVOS
  const smokeClouds = [],
    smokeGeo = R.shared(new THREE.SphereGeometry(1, 8, 6));
  function spawnSmokeCloud(pos, now, fromRemote = false) {
    if (!fromRemote) {
      if (player.dead) return;
      if (state.mode !== "treino" && !state.customRoom) player.smokes--;
      sendP2P({ t: "smoke", x: pos.x, y: pos.y, z: pos.z });
    }
    playSmokeSound();
    const group = new THREE.Group(),
      mat = new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        transparent: true,
        opacity: 0.62,
        roughness: 1,
        depthWrite: false,
      });
    for (let i = 0; i < 11; i++) {
      const p = new THREE.Mesh(smokeGeo, mat);
      p.scale.setScalar(1.5 + Math.random());
      p.position.set(
        (Math.random() - 0.5) * 3.8,
        0.8 + Math.random() * 1.8,
        (Math.random() - 0.5) * 3.8,
      );
      group.add(p);
    }
    group.position.copy(pos);
    scene.add(group);
    smokeClouds.push({
      group,
      mat,
      center: new THREE.Vector3(pos.x, pos.y + 1.5, pos.z),
      radius: 4.3,
      expiresAt: now + 9500,
    });
  }
  function throwSmoke(now) {
    if (
      player.dead ||
      player.inVehicle ||
      player.parachuting ||
      player.onZipline ||
      (!state.customRoom && player.smokes <= 0)
    )
      return;
    const p = new THREE.Vector3(player.pos.x, player.pos.y + 1.4, player.pos.z),
      dir = camForward
        .clone()
        .add(new THREE.Vector3(0, 0.25, 0))
        .normalize()
        .multiplyScalar(15);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 }),
    );
    mesh.position.copy(p);
    scene.add(mesh);
    grenades.push({
      mesh,
      pos: p,
      vel: dir,
      explodeAt: now + 1100,
      isSmoke: true,
      fromRemote: false,
      impactExplode: false,
    });
  }
  function isBlockedBySmoke(p1, p2) {
    for (const s of smokeClouds) {
      const ab = p2.clone().sub(p1),
        l = ab.lengthSq();
      if (l < 1e-6) continue;
      const t = Math.max(0, Math.min(1, s.center.clone().sub(p1).dot(ab) / l));
      if (
        p1.clone().addScaledVector(ab, t).distanceToSquared(s.center) <
        s.radius * s.radius * 0.72
      )
        return true;
    }
    return false;
  }

  const loots = [],
    lootGeo = R.shared(new THREE.BoxGeometry(0.65, 0.45, 0.65));
  function spawnLootBox(pos) {
    const m = new THREE.Mesh(
      lootGeo,
      new THREE.MeshStandardMaterial({
        color: 0xffbe2e,
        emissive: 0xd97706,
        emissiveIntensity: 0.45,
      }),
    );
    m.position.set(pos.x, pos.y + 0.3, pos.z);
    m.castShadow = true;
    scene.add(m);
    loots.push({ mesh: m });
  }
  const shockwaves = [],
    shockwaveGeo = R.shared(new THREE.SphereGeometry(1, 12, 8));
  function spawnShockwave(pos) {
    const mat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.75,
        wireframe: true,
      }),
      m = new THREE.Mesh(shockwaveGeo, mat);
    m.position.copy(pos);
    scene.add(m);
    shockwaves.push({ mesh: m, mat, scale: 0.5, life: 0.35 });
  }

  const grenades = [],
    nadeGeo = R.shared(new THREE.SphereGeometry(0.14, 10, 10)),
    nadeMat = R.shared(
      new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.5 }),
    );
  const trajPoints = Array.from({ length: 24 }, () => new THREE.Vector3()),
    trajLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(trajPoints),
      new THREE.LineBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.85,
      }),
    );
  trajLine.visible = false;
  scene.add(trajLine);
  const getNadeLaunchVel = () =>
    camForward
      .clone()
      .add(new THREE.Vector3(0, 0.34, 0))
      .normalize()
      .multiplyScalar(17.5);
  function throwGrenade(
    now,
    fromRemote = false,
    startPos = null,
    startVel = null,
    impactExplode = false,
  ) {
    if (!fromRemote && !impactExplode) {
      if (
        player.dead ||
        player.inVehicle ||
        player.parachuting ||
        player.onZipline ||
        (!state.customRoom && player.nades <= 0)
      )
        return;
      if (state.mode !== "treino" && !state.customRoom) player.nades--;
    }
    const mesh = new THREE.Mesh(
      nadeGeo,
      impactExplode
        ? new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xd97706,
          })
        : nadeMat,
    );
    const p = startPos
        ? startPos.clone()
        : new THREE.Vector3(player.pos.x, player.pos.y + 1.5, player.pos.z),
      v = startVel ? startVel.clone() : getNadeLaunchVel();
    mesh.position.copy(p);
    scene.add(mesh);
    grenades.push({
      mesh,
      pos: p,
      vel: v,
      explodeAt: now + (impactExplode ? 3000 : 2200),
      fromRemote,
      isSmoke: false,
      impactExplode,
    });
    if (!fromRemote)
      sendP2P({
        t: "nade",
        px: p.x,
        py: p.y,
        pz: p.z,
        vx: v.x,
        vy: v.y,
        vz: v.z,
        imp: impactExplode,
      });
  }
  function explodeAt(pos, now, fromRemote, label = "Granada", radius = 6.8) {
    playExplosionSound();
    spawnShockwave(pos);
    spawnSparks(pos, 0xf97316, 22);
    spawnSparks(pos, 0xfef08a, 12);
    const dP = player.pos.distanceTo(pos);
    if (dP < 16)
      state.camShake = Math.max(state.camShake, 0.35 * (1 - dP / 16));
    for (let i = glooWalls.length - 1; i >= 0; i--)
      if (glooWalls[i].mesh.position.distanceTo(pos) < 5.4)
        glooWalls[i].createdAt = -Infinity;
    for (let i = landmines.length - 1; i >= 0; i--)
      if (landmines[i].pos.distanceTo(pos) < 4.5) {
        const mp = landmines[i].pos.clone();
        disposeObject(landmines[i].group);
        landmines.splice(i, 1);
        clock.schedule(
          () => explodeAt(mp, clock.now, false, "Mina 💥", 5.2),
          120,
        );
      }
    if (!fromRemote) {
      for (const e of enemies)
        if (e.alive) {
          const dist = e.char.root.position.distanceTo(pos);
          if (dist < radius)
            damageEnemy(
              e,
              Math.round(190 * (1 - dist / radius)),
              false,
              e.char.root.position.clone().add(new THREE.Vector3(0, 1.3, 0)),
              now,
              label,
              true,
              "Você",
              pos,
            );
        }
      if (state.mode === "x1" && remotePlayer.alive) {
        const dist = remotePlayer.char.root.position.distanceTo(pos);
        if (dist < radius)
          sendP2P({
            t: "hit",
            dmg: Math.round(170 * (1 - dist / radius)),
            isHead: false,
          });
      }
    }
    if (dP < 5.5 && !player.dead)
      applyPlayerDamage(Math.round(90 * (1 - dP / 5.5)), false, now, pos);
  }

  const dummies = [];
  [
    { label: "Alvo 15m", x: -24, z: 0 },
    { label: "Alvo 30m", x: -24, z: -15 },
  ].forEach((dcfg) => {
    const ch = createCharacter({
      shirtColor: 0xf97316,
      pantsColor: 0x334155,
      hatColor: 0xffffff,
    });
    ch.root.position.set(dcfg.x, 0, dcfg.z);
    scene.add(ch.root);
    const hHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.44, 0.44),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hHit.position.set(0, 1.69, 0);
    ch.bodyPivot.add(hHit);
    const bHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 1.42, 0.45),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    bHit.position.set(0, 0.74, 0);
    ch.bodyPivot.add(bHit);
    const dm = {
      char: ch,
      label: dcfg.label,
      comboDmg: 0,
      lastHitAt: -10000,
      flashAt: 0,
    };
    hHit.userData = { dummy: dm, isHead: true };
    bHit.userData = { dummy: dm, isHead: false };
    dummies.push({ dm, hHit, bHit });
  });

  // BOTS
  const enemies = [],
    enemyHitMeshes = [];
  [
    ["Bot Rush", "rush", "m1887", 0xe11d48, -6, 0, 0, 4.3],
    ["Bot Strafe", "rifle", "scar", 0xd97706, 7, 0, -2, 3.4],
    ["Bot Sniper", "sniper", "awm", 0x059669, 0, 3.32, -8, 2.5],
    ["Bot Guarita", "guarita", "carapina", 0x0ea5e9, 18, 2.62, 10, 2.2],
    ["Bot Flanco", "rush", "m1014", 0x7c3aed, -12, 0, -14, 4.5],
    ["Bot Elite", "rifle", "scar", 0xdb2777, 10, 0, -17, 3.6],
    ["NobruBot", "rush", "m1887", 0xf43f5e, -22, 0, -26, 4.4],
    ["CerolBot", "rifle", "mp40", 0x10b981, 22, 0, -30, 3.8],
    ["BuxexaBot", "rifle", "scar", 0x6366f1, -25, 0, 10, 3.5],
    ["BakBot", "rush", "m1887", 0xeab308, 24, 0, -8, 4.2],
    ["ThurBot", "rifle", "carapina", 0x14b8a6, 0, 0, -34, 3.7],
  ].forEach(([name, role, weapon, color, x, y, z, speed], i) => {
    const char = createCharacter({
      shirtColor: color,
      pantsColor: 0x1f2937,
      hatColor: 0x475569,
      weaponKey: weapon,
    });
    char.root.position.set(x, y, z);
    scene.add(char.root);
    const headHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.44, 0.44),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    headHit.position.set(0, 1.69, 0);
    char.bodyPivot.add(headHit);
    const bodyHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 1.42, 0.45),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    bodyHit.position.set(0, 0.74, 0);
    char.bodyPivot.add(bodyHit);
    const e = {
      id: i,
      name,
      origName: name,
      role,
      origRole: role,
      weapon,
      origWeapon: weapon,
      char,
      headHit,
      bodyHit,
      hp: 200,
      maxHp: 200,
      helmHp: 80,
      vestHp: 100,
      alive: true,
      respawnAt: 0,
      flashAt: 0,
      damagedAt: -10000,
      lastGelAt: -10000,
      lastFiredAt: -10000,
      lastZoneDmgAt: 0,
      healedBehindGel: false,
      nextShotAt: clock.now + 2000 + Math.random() * 2000,
      origColor: color,
      baseX: x,
      baseY: y,
      baseZ: z,
      speed,
      origSpeed: speed,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      walkTime: Math.random() * 10,
      jumpTimer: 0,
      isBoss: false,
    };
    headHit.userData = { enemy: e, isHead: true };
    bodyHit.userData = { enemy: e, isHead: false };
    enemyHitMeshes.push(headHit, bodyHit);
    enemies.push(e);
  });
  function resetBotsForMode(now) {
    enemies.forEach((e, i) => {
      e.char.root.scale.setScalar(1);
      e.isBoss = false;
      e.name = e.origName;
      e.role = e.origRole;
      e.weapon = e.origWeapon;
      e.speed = e.origSpeed;
      const active =
        state.mode === "br"
          ? true
          : state.mode === "treino"
            ? i < 6
            : state.mode === "cs"
              ? i < 3
              : state.mode === "x1bot" && i === 0;
      e.alive = active;
      e.char.root.visible = active;
      e.hp = 200;
      e.maxHp = 200;
      e.helmHp = state.mode === "cs" ? 70 + state.csRound * 15 : 80;
      e.vestHp = 100;
      e.char.helmet.visible = true;
      if (state.mode === "x1bot" && i === 0) {
        e.name = "Bot Pro X1 🔥";
        e.role = "rush";
        e.speed = 5.0;
        e.helmHp = 100;
        e.vestHp = 120;
        e.char.root.position.set(0, 0, -24);
      } else e.char.root.position.set(e.baseX, e.baseY, e.baseZ);
      e.lastGelAt = -10000;
      e.healedBehindGel = false;
      e.nextShotAt =
        now + (state.mode === "x1bot" ? 1200 : 2200 + Math.random() * 2000);
    });
    dummies.forEach((d) => (d.dm.char.root.visible = state.mode === "treino"));
    buggyGroup.visible = state.mode === "treino" || state.mode === "br";
    arsenalGroup.visible = state.mode === "treino" || state.mode === "br";
  }
  function spawnHordaWave(wave, now) {
    const count = Math.min(enemies.length, 3 + wave),
      hasBoss = wave % 3 === 0;
    enemies.forEach((e, i) => {
      const active = i < count;
      e.alive = active;
      e.char.root.visible = active;
      if (!active) return;
      const isBoss = hasBoss && i === 0;
      e.isBoss = isBoss;
      e.role = "rush";
      e.name = isBoss ? `TITÃ ONDA ${wave} 👹` : `Invasor ${i + 1}`;
      e.char.root.scale.setScalar(isBoss ? 1.38 : 1.0);
      e.maxHp = isBoss ? 480 : 180 + wave * 20;
      e.hp = e.maxHp;
      e.helmHp = isBoss ? 150 : 60;
      e.vestHp = isBoss ? 160 : 80;
      e.char.helmet.visible = true;
      const ang = (i / count) * Math.PI * 2;
      e.char.root.position.set(Math.cos(ang) * 24, 0, Math.sin(ang) * 20 - 8);
      e.lastGelAt = -10000;
      e.healedBehindGel = false;
      e.nextShotAt = now + 1500;
    });
    updateScoreBoxUI();
    showBanner(
      `ONDA ${wave}!`,
      hasBoss ? "⚠️ CHEFÃO TITÃ CHEGANDO!" : `${count} Invasores se aproximam!`,
      hasBoss ? "#ff3b3b" : "#ffbe2e",
    );
  }

  // X1 ONLINE (PeerJS P2P)
  let peer = null,
    conn = null,
    isHost = false;
  const remoteChar = createCharacter({
    shirtColor: 0xdc2626,
    pantsColor: 0x0f172a,
    hatColor: 0,
    weaponKey: "mp40",
    backpack: true,
  });
  remoteChar.root.visible = false;
  scene.add(remoteChar.root);
  const remoteHeadHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.44, 0.44),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  remoteHeadHit.position.set(0, 1.69, 0);
  remoteChar.bodyPivot.add(remoteHeadHit);
  const remoteBodyHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 1.42, 0.45),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  remoteBodyHit.position.set(0, 0.74, 0);
  remoteChar.bodyPivot.add(remoteBodyHit);
  const remotePlayer = {
    char: remoteChar,
    alive: false,
    hp: 200,
    maxHp: 200,
    damagedAt: -10000,
    targetPos: new THREE.Vector3(0, 0, -24),
    prevPos: new THREE.Vector3(0, 0, -24),
    yaw: 0,
    crouch: false,
    weapon: "mp40",
    walkTime: 0,
    flashOffAt: 0,
    lastFiredAt: -10000,
    alok: false,
    chrono: false,
    emote: false,
    aimPitch: -99,
  };
  remoteHeadHit.userData = { isRemote: true, isHead: true };
  remoteBodyHit.userData = { isRemote: true, isHead: false };

  function sendP2P(msg) {
    if (conn && conn.open) conn.send(msg);
  }
  function validPacket(d) {
    if (!d || typeof d !== "object" || Array.isArray(d)) return false;
    const finite = (...fields) =>
      fields.every(
        (field) => Number.isFinite(d[field]) && Math.abs(d[field]) <= 1000,
      );
    switch (d.t) {
      case "state":
        return (
          finite("x", "y", "z", "yaw", "hp", "helm") &&
          d.hp >= 0 &&
          d.hp <= 200 &&
          typeof d.w === "string" &&
          Object.prototype.hasOwnProperty.call(WEAPONS, d.w) &&
          (d.aim === undefined || Number.isFinite(d.aim))
        );
      case "shot":
        return (
          typeof d.w === "string" &&
          Object.prototype.hasOwnProperty.call(WEAPONS, d.w) &&
          finite("sx", "sy", "sz", "ex", "ey", "ez")
        );
      case "hit":
        return Number.isFinite(d.dmg) && d.dmg > 0 && d.dmg <= 600;
      case "gel":
        return glooWalls.length < 48 && finite("x", "y", "z", "yaw");
      case "mine":
        return landmines.length < 48 && finite("x", "y", "z");
      case "nade":
        return (
          grenades.length < 48 && finite("px", "py", "pz", "vx", "vy", "vz")
        );
      case "smoke":
        return smokeClouds.length < 12 && finite("x", "y", "z");
      case "roundWin":
        return !state.roundOver;
      default:
        return false;
    }
  }
  function setupConn(c) {
    if (conn?.open) {
      c.close();
      return;
    }
    conn = c;
    const st = $("p2pStatus");
    let packetAt = 0,
      packetCount = 0;
    c.on("open", () => {
      st.innerHTML =
        '<b style="color:#4ade80;">Conectado! Clique em Entrar na Partida.</b>';
      remotePlayer.alive = true;
      remoteChar.root.visible = true;
    });
    c.on("data", (d) => {
      if (
        conn !== c ||
        !state.started ||
        state.mode !== "x1" ||
        !validPacket(d)
      )
        return;
      const real = performance.now();
      if (real - packetAt > 1000) {
        packetAt = real;
        packetCount = 0;
      }
      if (++packetCount > 160) return;
      const now = clock.now;
      if (d.t === "state") {
        remotePlayer.targetPos.set(d.x, d.y, d.z);
        remotePlayer.yaw = d.yaw;
        remotePlayer.crouch = d.crouch;
        remotePlayer.hp = d.hp;
        remotePlayer.alok = !!d.alok;
        remotePlayer.chrono = !!d.chrono;
        remotePlayer.emote = !!d.emote;
        remotePlayer.aimPitch = d.aim ?? -99;
        remoteChar.helmet.visible = d.helm > 0;
        if (d.w !== remotePlayer.weapon) {
          remotePlayer.weapon = d.w;
          disposeObject(remoteChar.currentGun);
          remoteChar.currentGun = buildWeaponModel(d.w);
          remoteChar.gunHolder.add(remoteChar.currentGun);
          remoteChar.leftGunHolder.visible = d.w === "vector";
        }
      } else if (d.t === "shot") {
        playShotSound(d.w, 0.5);
        remoteChar.muzzleFlash.visible = true;
        remotePlayer.flashOffAt = now + 50;
        remotePlayer.lastFiredAt = now;
        spawnTracer(
          new THREE.Vector3(d.sx, d.sy, d.sz),
          new THREE.Vector3(d.ex, d.ey, d.ez),
          0xff4d4d,
        );
      } else if (d.t === "hit")
        applyPlayerDamage(d.dmg, d.isHead, now, remoteChar.root.position);
      else if (d.t === "gel") spawnGlooWallAt(d.x, d.y, d.z, d.yaw, now, true);
      else if (d.t === "mine") plantLandmine(d.x, d.y, d.z, now, true);
      else if (d.t === "nade")
        throwGrenade(
          now,
          true,
          new THREE.Vector3(d.px, d.py, d.pz),
          new THREE.Vector3(d.vx, d.vy, d.vz),
          !!d.imp,
        );
      else if (d.t === "smoke")
        spawnSmokeCloud(new THREE.Vector3(d.x, d.y, d.z), now, true);
      else if (d.t === "roundWin") {
        state.roundOver = true;
        state.csPlayerScore++;
        updateScoreBoxUI();
        addKillfeed("Você", WEAPONS[state.weaponKey].name, "Oponente", false);
        if (state.csPlayerScore >= 4) {
          statsTotal.booyahs++;
          persistSave();
          speakAnnouncer("Booyah!");
          openSummary(
            "BOOYAH! 🏆",
            `VITÓRIA NO X1 (${state.csPlayerScore} x ${state.csEnemyScore})`,
          );
        } else {
          state.csRound++;
          showBanner(
            "VITÓRIA DO ROUND!",
            `${state.csPlayerScore} x ${state.csEnemyScore}`,
            "#4ade80",
          );
          clock.schedule(startX1Round, 2000);
        }
      }
    });
    c.on("close", () => {
      if (conn !== c) return;
      st.textContent = "Oponente desconectou. Crie ou entre em outra sala.";
      conn = null;
      remotePlayer.alive = false;
      remoteChar.root.visible = false;
      pauseGame();
      ArenaUI.notice("Seu amigo desconectou da sala.");
    });
    c.on("error", () =>
      ArenaUI.notice("A conexão com a sala falhou. Tente criar outra sala."),
    );
  }
  $("btnCreateRoom").onclick = () => {
    if (typeof Peer === "undefined") {
      $("p2pStatus").textContent = "PeerJS indisponível offline.";
      return;
    }
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (peer) peer.destroy();
    isHost = true;
    $("p2pStatus").textContent = "Criando sala...";
    peer = new Peer("ffweb-" + code);
    peer.on("open", () => {
      $("p2pStatus").innerHTML =
        `Sala criada! Código: <b style="color:#ffbe2e;font-size:15px;">${code}</b>`;
    });
    peer.on("connection", setupConn);
    peer.on("error", (e) => {
      $("p2pStatus").textContent = "Erro P2P: " + e.type;
    });
  };
  $("btnJoinRoom").onclick = () => {
    if (typeof Peer === "undefined") return;
    const code = $("inpRoomCode").value.trim();
    if (!/^\d{4}$/.test(code)) {
      ArenaUI.notice("Digite o código de 4 números da sala.");
      return;
    }
    if (peer) peer.destroy();
    isHost = false;
    $("p2pStatus").textContent = "Conectando...";
    peer = new Peer();
    peer.on("open", () => setupConn(peer.connect("ffweb-" + code)));
    peer.on("error", (e) => {
      $("p2pStatus").textContent = "Erro: " + e.type;
    });
  };

  // LOBBY, PLACAR & LOJA
  function updateScoreBoxUI() {
    if (state.mode === "br") {
      $("scLeftLabel").innerHTML =
        `VIVOS <b style="color:#4ade80">${(player.dead ? 0 : 1) + enemies.filter((e) => e.alive).length}</b>`;
      $("scMidLabel").innerHTML = `ABATES <b>${state.kills}</b>`;
      $("scRightLabel").innerHTML = `BR · BOTS`;
    } else if (state.mode === "horda") {
      $("scLeftLabel").innerHTML =
        `ONDA <b style="color:#ffbe2e">${state.hordaWave}</b>`;
      $("scMidLabel").innerHTML =
        `RESTAM <b style="color:#ff3b3b">${enemies.filter((e) => e.alive).length}</b>`;
      $("scRightLabel").innerHTML = `ABATES <b>${state.kills}</b>`;
    } else {
      $("scLeftLabel").innerHTML = `VOCÊ <b>${state.csPlayerScore}</b>`;
      $("scMidLabel").innerHTML = `ROUND <b>${state.csRound}</b>`;
      $("scRightLabel").innerHTML = `<b>${state.csEnemyScore}</b> INIMIGOS`;
    }
  }
  function openSummary(title, sub) {
    clock.clear();
    state.started = false;
    state.paused = false;
    pauseModal.classList.add("hidden");
    document.body.classList.remove("menu-open");
    if (document.pointerLockElement) document.exitPointerLock();
    state.isFiring = false;
    state.isScoped = false;
    player.freeLook = false;
    $("sumTitle").textContent = title;
    $("sumSub").textContent = sub;
    $("sumKills").textContent = state.kills;
    $("sumCapas").textContent = state.capas;
    $("sumRate").textContent = state.kills
      ? Math.round((state.capas / state.kills) * 100) + "%"
      : "0%";
    $("sumDmg").textContent = Math.round(state.matchDmg);
    summaryModal.classList.remove("hidden");
  }
  $("btnRematch").onclick = () => {
    summaryModal.classList.add("hidden");
    startMatch();
  };
  $("btnBackLobby").onclick = leaveGame;
  $("btnResetStats").onclick = () => {
    statsTotal.kills = 0;
    statsTotal.capas = 0;
    statsTotal.booyahs = 0;
    statsTotal.boomKills = 0;
    persistSave();
    $("svKills").textContent = 0;
    $("svCapas").textContent = 0;
    $("svBooyahs").textContent = 0;
  };

  $("petSel").onchange = () => {
    state.pet = $("petSel").value;
    updatePetVisual(state.pet);
    persistSave();
  };
  $("timeSel").onchange = () => {
    state.timeOfDay = $("timeSel").value;
    applyTimeOfDay(state.timeOfDay);
    persistSave();
  };
  $("skillSel").onchange = () => {
    state.skill = $("skillSel").value;
    persistSave();
  };
  $("customRoomSel").onchange = () => {
    state.customRoom = $("customRoomSel").value === "on";
    updateAmmoUI();
  };
  $("skinColorSel").onchange = () => {
    state.shirtColor = $("skinColorSel").value;
    const hex = parseInt(state.shirtColor);
    playerChar.torsoMat.color.setHex(hex);
    playerChar.armMat.color.setHex(hex);
    persistSave();
  };
  $("evoSkinSel").onchange = () => {
    state.evoSkin = $("evoSkinSel").value;
    disposeObject(playerChar.currentGun);
    playerChar.currentGun = buildWeaponModel(state.weaponKey, state.evoSkin);
    playerChar.gunHolder.add(playerChar.currentGun);
    persistSave();
  };

  function clearArenaEntities() {
    state.fireQueued = false;
    clock.clear();
    grenades.forEach((g) => disposeObject(g.mesh));
    grenades.length = 0;
    particles3d.forEach(releaseParticle);
    particles3d.length = 0;
    tracers3d.forEach((t) => disposeObject(t.line));
    tracers3d.length = 0;
    shockwaves.forEach((s) => disposeObject(s.mesh));
    shockwaves.length = 0;
    floatingNums.length = 0;
    damageDirs.length = 0;
    trajLine.visible = false;
    killfeedEl.replaceChildren();
    clearTimeout(bannerTimer);
    banner.classList.remove("show");
    state.reloading = false;
    state.isFiring = false;
    state.isScoped = false;
    state.bloom = 0;
    state.camShake = 0;
    player.healing = false;
    player.aimingNade = false;
    player.freeLook = false;
    lastGelTime = -10000;
    lastNetSend = 0;
    lastZoneTick = 0;
    pressedKeys.clear();
    for (const key in keys) keys[key] = false;
    for (let i = glooWalls.length - 1; i >= 0; i--) {
      disposeObject(glooWalls[i].mesh);
      const idx = obstacles.indexOf(glooWalls[i]);
      if (idx >= 0) {
        obstacles.splice(idx, 1);
        obstacleRevision++;
      }
    }
    glooWalls.length = 0;
    loots.forEach((l) => disposeObject(l.mesh));
    loots.length = 0;
    smokeClouds.forEach((s) => disposeObject(s.group));
    smokeClouds.length = 0;
    mushrooms.forEach((m) => disposeObject(m.group));
    mushrooms.length = 0;
    landmines.forEach((m) => disposeObject(m.group));
    landmines.length = 0;
    airdrop.active = false;
    airdropGroup.visible = false;
    pingState.active = false;
    pingGroup.visible = false;
    uavGroup.visible = false;
    upgraders.forEach((u) => {
      u.readyAt = 0;
      u.mesh.visible = true;
    });
    arsenal.readyAt = 0;
    arsenal.prog = 0;
    resetBarrels();
  }
  function resetPlayerStats(xPos, yPos, zPos) {
    magazines.reset();
    ArenaMotion.reset(playerChar);
    playerChar.bodyPivot.position.y = 0;
    player.dashUntil = 0;
    state.reloading = false;
    state.isFiring = false;
    state.isScoped = false;
    player.dead = false;
    player.hp = 200;
    player.ep = 0;
    player.pos.set(xPos, yPos, zPos);
    player.velY = 0;
    player.onGround = yPos === 0;
    player.crouching = false;
    player.inVehicle = false;
    player.onZipline = false;
    player.parachuting = yPos > 5;
    playerChute.visible = player.parachuting;
    playerChar.root.visible = true;
    player.healing = false;
    player.emoteUntil = 0;
    playerChar.flagGroup.visible = false;
    player.freeLook = false;
    player.skillActiveUntil = 0;
    player.skillCdUntil = 0;
    player.tatsuyaCharges = 2;
    player.uavActiveUntil = 0;
    player.uavCdUntil = 0;
    player.nextWaggorAt = clock.now + 16000;
    alokRing.visible = false;
    chronoDome.visible = false;
    state.outOfZone = false;
    if (
      state.mode === "treino" ||
      state.mode === "br" ||
      state.mode === "horda"
    ) {
      player.helmLv = 1;
      player.helmHp = 70;
      player.helmMax = 70;
      player.vestLv = 1;
      player.vestHp = 90;
      player.vestMax = 90;
      player.gels = 4;
      player.kits = 3;
      player.inhalers = 3;
      player.nades = 2;
      player.mines = 2;
      player.smokes = 2;
    }
    updateHpUI();
  }
  function startMatch() {
    magazines.reset();
    if (state.mode === "x1" && !(conn && conn.open)) {
      ArenaUI.notice(
        "Crie ou entre em uma sala e aguarde a conexão com seu amigo.",
      );
      return;
    }
    state.started = true;
    state.paused = false;
    state.csShopOpen = false;
    pauseModal.classList.add("hidden");
    shopModal.classList.add("hidden");
    summaryModal.classList.add("hidden");
    ui?.playing();
    clearArenaEntities();
    state.customRoom = $("customRoomSel").value === "on";
    state.roundOver = false;
    state.kills = 0;
    state.capas = 0;
    state.capaStreak = 0;
    state.matchDmg = 0;
    $("uiKills").textContent = 0;
    $("uiCapas").textContent = 0;
    $("uiRate").textContent = "0%";
    airdrop.nextSpawnAt = clock.now + 16000;
    buggy.pos.set(25, 0, 18);
    buggy.yaw = 0;
    buggy.speed = 0;
    const allOpen = {
      mp40: true,
      scar: true,
      m1014: true,
      m1887: true,
      awm: true,
      deagle: true,
      carapina: true,
      groza: false,
      m79: false,
      katana: true,
      vector: true,
    };
    if (state.mode === "cs") {
      state.csRound = 1;
      state.csPlayerScore = 0;
      state.csEnemyScore = 0;
      state.csCoins = 800;
      state.unlockedWeapons = {
        mp40: true,
        scar: false,
        m1014: false,
        m1887: false,
        awm: false,
        deagle: false,
        carapina: false,
        groza: false,
        m79: false,
        katana: true,
        vector: false,
      };
      player.helmLv = 1;
      player.helmHp = 60;
      player.helmMax = 60;
      player.vestLv = 1;
      player.vestHp = 80;
      player.vestMax = 80;
      player.gels = 2;
      player.kits = 2;
      player.inhalers = 2;
      player.nades = 1;
      player.mines = 1;
      player.smokes = 1;
      scoreBox.classList.add("show");
      $("uiCoins").style.display = "inline";
      $("scZoneTxt").textContent = "Safe OK";
      refreshWeaponSlotLocks();
      openCSShop();
    } else if (state.mode === "br") {
      state.unlockedWeapons = allOpen;
      scoreBox.classList.add("show");
      $("uiCoins").style.display = "none";
      safeZone.active = true;
      safeZone.radius = 48;
      safeZone.shrinkSpeed = 0.85;
      zoneMesh.visible = true;
      spawnMushrooms();
      resetPlayerStats(0, 42, 16);
      resetBotsForMode(clock.now);
      updateScoreBoxUI();
      refreshWeaponSlotLocks();
      selectWeapon("mp40");
      overlay.classList.add("hidden");
      showBanner(
        "SALTO DE PARAQUEDAS! 🪂",
        "Use WASD para escolher onde pousar!",
        "#38bdf8",
      );
      requestLock();
    } else if (state.mode === "horda") {
      state.hordaWave = 1;
      state.hordaNextWaveAt = 0;
      state.unlockedWeapons = allOpen;
      scoreBox.classList.add("show");
      $("uiCoins").style.display = "none";
      $("scZoneTxt").textContent = "Modo Horda";
      safeZone.active = false;
      zoneMesh.visible = false;
      spawnMushrooms();
      resetPlayerStats(0, 0, 14);
      resetBotsForMode(clock.now);
      spawnHordaWave(1, clock.now);
      refreshWeaponSlotLocks();
      selectWeapon("mp40");
      overlay.classList.add("hidden");
      requestLock();
    } else if (state.mode === "x1" || state.mode === "x1bot") {
      state.csRound = 1;
      state.csPlayerScore = 0;
      state.csEnemyScore = 0;
      state.unlockedWeapons = allOpen;
      scoreBox.classList.add("show");
      $("uiCoins").style.display = "none";
      $("scZoneTxt").textContent =
        state.mode === "x1bot" ? "X1 Bot Pro" : "X1 PvP";
      safeZone.active = false;
      zoneMesh.visible = false;
      refreshWeaponSlotLocks();
      startX1Round();
    } else {
      state.unlockedWeapons = allOpen;
      scoreBox.classList.remove("show");
      $("uiCoins").style.display = "none";
      safeZone.active = false;
      zoneMesh.visible = false;
      spawnMushrooms();
      resetPlayerStats(0, 0, 14);
      resetBotsForMode(clock.now);
      refreshWeaponSlotLocks();
      selectWeapon("mp40");
      overlay.classList.add("hidden");
      requestLock();
    }
  }
  function startX1Round() {
    clearArenaEntities();
    state.roundOver = false;
    resetPlayerStats(0, 0, isHost || state.mode === "x1bot" ? 18 : -26);
    state.camYaw = isHost || state.mode === "x1bot" ? 0 : Math.PI;
    player.gels = 5;
    player.kits = 2;
    player.inhalers = 2;
    player.nades = 1;
    player.mines = 1;
    player.smokes = 1;
    player.helmLv = 2;
    player.helmHp = 100;
    player.helmMax = 100;
    player.vestLv = 2;
    player.vestHp = 120;
    player.vestMax = 120;
    state.ammo = WEAPONS[state.weaponKey].mag;
    state.reloading = false;
    updateAmmoUI();
    updateHpUI();
    resetBotsForMode(clock.now);
    updateScoreBoxUI();
    overlay.classList.add("hidden");
    if (state.mode === "x1bot")
      showBanner(`ROUND ${state.csRound}`, "1v1 CONTRA BOT PRO!", "#ffbe2e");
    requestLock();
  }

  const SHOP_CATALOG = [
    { id: "deagle", name: "Águia do Deserto", price: 400, type: "weapon" },
    { id: "vector", name: "Vector Dupla (Akimbo)", price: 950, type: "weapon" },
    { id: "m1887", name: "M1887 (Doze Nova)", price: 900, type: "weapon" },
    {
      id: "carapina",
      name: "Carapina (Precisão)",
      price: 1000,
      type: "weapon",
    },
    { id: "scar", name: "SCAR (Mira 2x)", price: 800, type: "weapon" },
    { id: "m1014", name: "M1014 (Doze 6T)", price: 700, type: "weapon" },
    { id: "awm", name: "AWM (Sniper 4x)", price: 1400, type: "weapon" },
    { id: "m79", name: "M79 Lança-Granadas", price: 1600, type: "weapon" },
    { id: "gel", name: "+2 Paredes de Gel", price: 300, type: "item" },
    { id: "vest2", name: "Colete + Capacete Nv.3", price: 600, type: "armor" },
  ];
  function openCSShop() {
    if (document.pointerLockElement) document.exitPointerLock();
    state.csShopOpen = true;
    state.csShopEndAt = clock.now + 14000;
    $("shopRoundNum").textContent = state.csRound;
    renderShop();
    shopModal.classList.remove("hidden");
    overlay.classList.add("hidden");
  }
  function renderShop() {
    $("shopMoney").textContent = "$ " + state.csCoins;
    $("uiCoins").textContent = "$ " + state.csCoins;
    const grid = $("shopGrid");
    grid.innerHTML = "";
    SHOP_CATALOG.forEach((item) => {
      const owned = item.type === "weapon" && state.unlockedWeapons[item.id],
        div = document.createElement("div");
      div.className = "shop-item" + (owned ? " owned" : "");
      div.innerHTML = `<span><b>${item.name}</b></span><span class="shop-price">${owned ? "COMPRADO" : "$ " + item.price}</span>`;
      div.onclick = () => {
        if (owned || state.csCoins < item.price) return;
        state.csCoins -= item.price;
        if (item.type === "weapon") {
          state.unlockedWeapons[item.id] = true;
          refreshWeaponSlotLocks();
          selectWeapon(item.id);
        } else if (item.id === "gel") player.gels += 2;
        else if (item.id === "vest2") {
          player.helmLv = 3;
          player.helmHp = 130;
          player.helmMax = 130;
          player.vestLv = 3;
          player.vestHp = 160;
          player.vestMax = 160;
        }
        renderShop();
      };
      grid.appendChild(div);
    });
  }
  function startCSRound() {
    state.csShopOpen = false;
    state.roundOver = false;
    shopModal.classList.add("hidden");
    clearArenaEntities();
    resetPlayerStats(0, 0, 18);
    state.camYaw = 0;
    state.camPitch = 0.02;
    state.ammo = WEAPONS[state.weaponKey].mag;
    state.reloading = false;
    updateAmmoUI();
    resetBotsForMode(clock.now);
    safeZone.active = true;
    safeZone.radius = 42;
    safeZone.shrinkSpeed = 1.4;
    zoneMesh.visible = true;
    if (state.csRound >= 2) airdrop.nextSpawnAt = clock.now + 7000;
    updateScoreBoxUI();
    showBanner(`ROUND ${state.csRound}`, "ELIMINE O ESQUADRÃO!", "#ffbe2e");
    requestLock();
  }
  $("btnReadyCS").onclick = startCSRound;

  // CONTROLES PC
  const keys = {},
    pressedKeys = new Set();
  let isLocked = false,
    wasLocked = false,
    lastMouseX = null,
    lastMouseY = null;
  function requestLock() {
    initAudio();
    try {
      const promise = renderer.domElement.requestPointerLock?.();
      if (promise?.catch)
        promise.catch(() =>
          ArenaUI.notice(
            "Clique na arena para capturar o mouse. Use Esc para abrir o menu.",
          ),
        );
    } catch {
      ArenaUI.notice("Clique e arraste na arena para mirar.");
    }
  }
  function isPlaying() {
    return (
      state.started &&
      !state.paused &&
      !state.csShopOpen &&
      summaryModal.classList.contains("hidden")
    );
  }
  function isSimulating() {
    return (
      state.started &&
      !document.hidden &&
      (!state.paused || (state.mode === "x1" && conn?.open))
    );
  }
  function releaseInputs() {
    state.fireQueued = false;
    pressedKeys.clear();
    for (const key in keys) keys[key] = false;
    state.isFiring = false;
    state.isScoped = false;
    player.freeLook = false;
    player.aimingNade = false;
    lastMouseX = lastMouseY = null;
  }
  function pauseGame() {
    if (!state.started || state.paused) return;
    state.paused = true;
    releaseInputs();
    pauseModal.classList.remove("hidden");
    if (document.pointerLockElement) document.exitPointerLock();
    ui?.pause(state.mode === "x1" && !!conn?.open);
    if (state.mode !== "x1" && audioCtx?.state === "running")
      audioCtx.suspend();
    window.speechSynthesis?.cancel();
  }
  function resumeGame() {
    if (!state.started) return;
    state.paused = false;
    releaseInputs();
    pauseModal.classList.add("hidden");
    ui?.playing();
    clock.lastReal = performance.now();
    if (!state.csShopOpen) requestLock();
    else $("btnReadyCS").focus();
  }
  function restartGame() {
    releaseInputs();
    startMatch();
  }
  function leaveGame() {
    state.started = false;
    state.paused = false;
    state.csShopOpen = false;
    releaseInputs();
    clearArenaEntities();
    pauseModal.classList.add("hidden");
    shopModal.classList.add("hidden");
    summaryModal.classList.add("hidden");
    overlay.classList.remove("hidden");
    if (document.pointerLockElement) document.exitPointerLock();
    if (peer) {
      peer.destroy();
      peer = null;
    }
    conn = null;
    remotePlayer.alive = false;
    remoteChar.root.visible = false;
    $("p2pStatus").textContent =
      "Convide um amigo para um X1 casual. Requer internet.";
    window.speechSynthesis?.cancel();
    if (audioCtx?.state === "running") audioCtx.suspend();
    ui?.lobby();
  }
  $("btnToggleCfg").onclick = pauseGame;
  $("playBtn").onclick = startMatch;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseGame();
    clock.lastReal = performance.now();
  });

  const pingRay = new THREE.Raycaster();
  renderer.domElement.onmousedown = (e) => {
    initAudio();
    if (!isPlaying()) return;
    if (!isLocked) requestLock();
    if (e.button === 1) {
      e.preventDefault();
      pingRay.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hits = pingRay.intersectObjects(
        [ground, ...getObstacleMeshes()],
        false,
      );
      if (hits.length > 0) {
        pingState.active = true;
        pingState.pos.copy(hits[0].point);
        pingState.expiresAt = clock.now + 6500;
        pingGroup.visible = true;
        playTone("sine", 880, 1100, 0.08, 0.14);
      }
      return;
    }
    if (player.inVehicle || player.parachuting || player.onZipline) return;
    if (e.button === 0) {
      state.fireQueued = true;
      state.isFiring = true;
      state.firePressedAt = clock.now;
      player.healing = false;
      player.emoteUntil = 0;
    } else if (e.button === 2 && !WEAPONS[state.weaponKey].melee) {
      state.isScoped = true;
      state.scopePressedAt = clock.now;
    }
  };
  addEventListener("mouseup", (e) => {
    if (e.button === 0) state.isFiring = false;
    if (e.button === 2) state.isScoped = false;
  });
  renderer.domElement.addEventListener("contextmenu", (e) =>
    e.preventDefault(),
  );
  addEventListener("blur", () => {
    releaseInputs();
    if (!document.hidden) pauseGame();
  });
  addEventListener("wheel", (e) => {
    if (
      !isPlaying() ||
      player.inVehicle ||
      player.parachuting ||
      player.onZipline
    )
      return;
    const avail = WEAPON_ORDER.filter((k) => state.unlockedWeapons[k]);
    if (avail.length <= 1) return;
    selectWeapon(
      avail[
        (avail.indexOf(state.weaponKey) +
          (e.deltaY > 0 ? 1 : -1) +
          avail.length) %
          avail.length
      ],
    );
  });

  document.addEventListener("pointerlockchange", () => {
    isLocked = document.pointerLockElement === renderer.domElement;
    if (isLocked && !isPlaying()) document.exitPointerLock();
    $("uiLock").textContent = isLocked ? "Travado" : "Livre";
    $("uiLock").className = isLocked ? "green" : "gold";
    if (isLocked) settingsPanel.classList.remove("open");
    if (wasLocked && !isLocked && isPlaying()) pauseGame();
    wasLocked = isLocked;
    lastMouseX = null;
    lastMouseY = null;
  });

  addEventListener("mousemove", (e) => {
    if (!isPlaying()) return;
    let dx = 0,
      dy = 0;
    if (isLocked) {
      dx = e.movementX;
      dy = e.movementY;
    } else {
      if (
        lastMouseX !== null &&
        (e.target === renderer.domElement || state.isFiring)
      ) {
        dx = e.clientX - lastMouseX;
        dy = e.clientY - lastMouseY;
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
    dx = Math.max(-120, Math.min(120, dx));
    dy = Math.max(-120, Math.min(120, dy));
    let activeSens = state.sens;
    if (state.isScoped)
      activeSens *=
        state.weaponKey === "awm" ? state.sens4x * 0.55 : state.sens2x * 0.65;
    else if (state.targetInCone) activeSens *= state.redDotSens;
    const factor = 0.0022 * activeSens;
    state.camYaw -= dx * factor;
    state.camPitch = Math.max(
      -0.85,
      Math.min(0.85, state.camPitch - dy * factor),
    );
    if (dy < -0.5)
      state.userDragUp = Math.min(1.0, state.userDragUp + -dy * 0.06);
  });

  function exitBuggySafely() {
    player.inVehicle = false;
    for (const [cx, cz] of [
      [
        buggy.pos.x + Math.cos(buggy.yaw) * 2.1,
        buggy.pos.z - Math.sin(buggy.yaw) * 2.1,
      ],
      [
        buggy.pos.x - Math.cos(buggy.yaw) * 2.1,
        buggy.pos.z + Math.sin(buggy.yaw) * 2.1,
      ],
      [
        buggy.pos.x + Math.sin(buggy.yaw) * 2.6,
        buggy.pos.z + Math.cos(buggy.yaw) * 2.6,
      ],
      [buggy.pos.x, buggy.pos.z],
    ]) {
      if (
        !obstacles.some((o) =>
          checkObstacleHit(new THREE.Vector3(cx, 0, cz), 0.45, o),
        )
      ) {
        player.pos.set(cx, 0, cz);
        return;
      }
    }
    player.pos.set(buggy.pos.x, 0, buggy.pos.z);
  }

  addEventListener("keydown", (e) => {
    if (e.target.closest('input,select,textarea,[contenteditable="true"]'))
      return;
    if (!$("controlsModal").classList.contains("hidden")) return;
    const code = e.code === "Escape" ? "Escape" : bindings.resolve(e.code);
    if (!code) return;
    if (["Escape", "KeyP", "KeyH"].includes(code) && state.started) {
      e.preventDefault();
      if (!e.repeat) {
        if (state.paused && code !== "KeyH") resumeGame();
        else pauseGame();
      }
      return;
    }
    if (!isPlaying()) return;
    if (
      /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|ControlLeft)$/.test(
        code,
      )
    )
      e.preventDefault();
    if (
      e.repeat &&
      ["KeyC", "ControlLeft", "KeyU", "KeyB", "KeyT"].includes(code)
    )
      return;
    if (code === "AltLeft" || code === "AltRight") {
      e.preventDefault();
      if (isPlaying() && !player.freeLook) {
        player.freeLook = true;
        player.lockedMoveYaw = state.camYaw;
      }
    }
    pressedKeys.add(e.code);
    bindings.sync(keys, pressedKeys);

    if (!isPlaying()) return;
    if (code === "Enter" && !player.dead && !player.parachuting) {
      if (player.inVehicle) {
        exitBuggySafely();
        return;
      }
      if (!player.onZipline) {
        const dA = player.pos.distanceTo(zipAnchorA),
          dB = player.pos.distanceTo(zipAnchorB);
        if (dA < 2.6 || dB < 2.6) {
          player.onZipline = true;
          player.zipT = 0;
          player.crouching = false;
          state.isFiring = false;
          state.isScoped = false;
          player.zipFrom.copy(dA < dB ? zipAnchorA : zipAnchorB);
          player.zipTo.copy(dA < dB ? zipAnchorB : zipAnchorA);
          playTone("triangle", 420, 720, 0.15, 0.16);
          return;
        }
        if (
          (state.mode === "treino" || state.mode === "br") &&
          player.pos.distanceTo(buggy.pos) < 3.6
        ) {
          player.inVehicle = true;
          state.isFiring = false;
          state.isScoped = false;
          player.healing = false;
          return;
        }
      }
    }
    if (player.onZipline && code === "Space") {
      player.onZipline = false;
      player.velY = 4.5;
      player.onGround = false;
      return;
    }
    if (player.inVehicle || player.parachuting || player.onZipline) return;
    if (code === "KeyF") {
      state.fireQueued = true;
      initAudio();
      if (!state.isFiring) state.firePressedAt = clock.now;
      state.isFiring = true;
      player.healing = false;
      player.emoteUntil = 0;
    }
    if (code === "KeyU") state.shoulderSide *= -1;
    if (code === "KeyK") activateUAV(clock.now);
    const wKeys = {
      Digit1: "mp40",
      Digit2: "scar",
      Digit3: "m1014",
      Digit4: "m1887",
      Digit5: "awm",
      Digit6: "deagle",
      Digit7: "carapina",
      Digit8: "groza",
      Digit9: "m79",
      Digit0: "katana",
      KeyY: "vector",
    };
    if (wKeys[code]) selectWeapon(wKeys[code]);
    if (code === "KeyQ") selectWeapon(state.prevWeaponKey);
    if (code === "KeyR") startReload();
    if (code === "KeyG") playerUseGel(clock.now, false);
    if (code === "KeyV") playerUseGel(clock.now, true);
    if (code === "KeyE") startMedkit(clock.now);
    if (code === "KeyI") useInhaler();
    if (code === "KeyM")
      plantLandmine(player.pos.x, player.pos.y, player.pos.z, clock.now, false);
    if (code === "KeyX") throwSmoke(clock.now);
    if (code === "KeyZ") activateSkill(clock.now);
    if (code === "KeyB" && !player.dead) {
      player.emoteUntil = clock.now + 2200;
      playSkillSound();
      spawnSparks(
        player.pos.clone().add(new THREE.Vector3(0, 1.5, 0)),
        0xfacc15,
        10,
      );
    }
    if (
      code === "KeyT" &&
      (state.customRoom || player.nades > 0) &&
      !player.dead
    )
      player.aimingNade = true;
    if (code === "KeyC" || code === "ControlLeft")
      player.crouching = !player.crouching;
    if (code === "Space" && player.onGround && !player.dead) {
      player.crouching = false;
      player.velY = 7.4;
      player.onGround = false;
    }
  });
  addEventListener("keyup", (e) => {
    const code = bindings.resolve(e.code);
    pressedKeys.delete(e.code);
    bindings.sync(keys, pressedKeys);
    if (!code) return;
    if (code === "AltLeft" || code === "AltRight") {
      if (player.freeLook) {
        player.freeLook = false;
        state.camYaw = player.lockedMoveYaw;
      }
    }
    if (!isPlaying()) return;
    if (code === "KeyF") state.isFiring = false;
    if (code === "KeyT" && player.aimingNade) {
      player.aimingNade = false;
      throwGrenade(clock.now);
    }
  });

  $("aimMode").onchange = () => {
    state.aimMode = $("aimMode").value;
    persistSave();
  };
  $("botCombat").onchange = () =>
    (state.botsShoot = $("botCombat").value === "on");

  // CÂMERA & ASSISTÊNCIA DE MIRA
  const camForward = new THREE.Vector3(),
    camRight = new THREE.Vector3(),
    upVec = new THREE.Vector3(0, 1, 0),
    camRaycaster = new THREE.Raycaster(),
    losRaycaster = new THREE.Raycaster();
  function updateCamera(dt) {
    const w = WEAPONS[state.weaponKey],
      targetFov =
        player.parachuting || player.onZipline
          ? 72
          : player.inVehicle
            ? 68
            : state.isScoped
              ? w.fov
              : 62;
    camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-15 * dt));
    camera.updateProjectionMatrix();
    camForward
      .set(
        -Math.sin(state.camYaw) * Math.cos(state.camPitch),
        Math.sin(state.camPitch),
        -Math.cos(state.camYaw) * Math.cos(state.camPitch),
      )
      .normalize();
    camRight.crossVectors(camForward, upVec).normalize();
    const shakeX = (Math.random() - 0.5) * state.camShake,
      shakeY = (Math.random() - 0.5) * state.camShake;
    state.camShake = Math.max(0, state.camShake - 0.5 * dt);
    state.curShoulder +=
      (state.shoulderSide - state.curShoulder) * (1 - Math.exp(-12 * dt));
    const shoulderOff =
      player.inVehicle ||
      player.parachuting ||
      player.onZipline ||
      player.freeLook
        ? 0
        : (state.isScoped ? 0.52 : 0.74) * state.curShoulder;
    const pivot = new THREE.Vector3(
      player.pos.x + camRight.x * shoulderOff + shakeX,
      player.pos.y +
        (player.inVehicle ? 1.85 : player.crouching ? 1.08 : 1.48) +
        shakeY,
      player.pos.z + camRight.z * shoulderOff,
    );
    const camDist = player.parachuting
        ? 6.2
        : player.onZipline
          ? 4.8
          : player.inVehicle
            ? 5.6
            : state.isScoped
              ? state.weaponKey === "awm"
                ? 0.55
                : 1.85
              : 3.45,
      backDir = camForward.clone().negate();
    camRaycaster.set(pivot, backDir);
    camRaycaster.far = camDist;
    const hits = camRaycaster.intersectObjects(getObstacleMeshes(), false);
    camera.position
      .copy(pivot)
      .addScaledVector(
        backDir,
        hits.length > 0 ? Math.max(0.5, hits[0].distance - 0.25) : camDist,
      );
    camera.lookAt(camera.position.clone().add(camForward));
  }

  function updateAimAssist(dt, now) {
    if (
      player.inVehicle ||
      player.parachuting ||
      player.onZipline ||
      player.freeLook
    ) {
      state.targetInCone = null;
      return;
    }
    const w = WEAPONS[state.weaponKey],
      assistRadius = w.assistPx * (state.isScoped ? 1.15 : 1.0),
      obsMeshes = getObstacleMeshes(),
      targets = [];
    for (const e of enemies) if (e.alive) targets.push(e.char.root.position);
    if (state.mode === "treino")
      for (const d of dummies) targets.push(d.dm.char.root.position);
    if (state.mode === "x1" && remotePlayer.alive)
      targets.push(remotePlayer.char.root.position);

    let bestPos = null,
      bestDistPx = Infinity;
    for (const pos of targets) {
      const chestW = new THREE.Vector3(pos.x, pos.y + 1.16, pos.z),
        headW = new THREE.Vector3(pos.x, pos.y + 1.69, pos.z),
        toChest = chestW.clone().sub(camera.position),
        dist3d = toChest.length();
      if (dist3d > (w.melee ? 6 : w.range) || toChest.dot(camForward) <= 0)
        continue;
      const cProj = chestW.clone().project(camera),
        hProj = headW.clone().project(camera),
        cxPx = (cProj.x * 0.5 + 0.5) * W,
        cyPx = (-cProj.y * 0.5 + 0.5) * H,
        hyPx = (-hProj.y * 0.5 + 0.5) * H;
      const distPx = Math.hypot(
        CX - cxPx,
        CY - Math.max(hyPx, Math.min(cyPx + 20, CY)),
      );
      if (distPx < assistRadius && distPx < bestDistPx) {
        if (isBlockedBySmoke(camera.position, chestW)) continue;
        losRaycaster.set(camera.position, toChest.clone().normalize());
        losRaycaster.far = dist3d;
        if (losRaycaster.intersectObjects(obsMeshes, false).length === 0) {
          bestDistPx = distPx;
          bestPos = pos;
        }
      }
    }
    state.targetInCone = bestPos;
    const assistActive =
      state.aimMode === "padrao" ||
      (state.aimMode === "precisa" && !state.isScoped);
    if (!assistActive || !bestPos || state.assistStrength <= 0 || player.dead)
      return;
    const dirChest = new THREE.Vector3(bestPos.x, bestPos.y + 1.16, bestPos.z)
        .sub(camera.position)
        .normalize(),
      dirHead = new THREE.Vector3(bestPos.x, bestPos.y + 1.69, bestPos.z)
        .sub(camera.position)
        .normalize();
    const chestYaw = Math.atan2(-dirChest.x, -dirChest.z),
      chestPitch = Math.asin(Math.max(-1, Math.min(1, dirChest.y))),
      headYaw = Math.atan2(-dirHead.x, -dirHead.z),
      headPitch = Math.asin(Math.max(-1, Math.min(1, dirHead.y)));
    const justScoped = now - state.scopePressedAt < 180,
      justFired = now - state.firePressedAt < 140,
      active = state.isFiring || state.isScoped;
    let pullH = 0,
      pullV = 0;
    if (justScoped || justFired) {
      pullH = 19.0;
      pullV = 19.0;
    } else if (active) {
      pullH = 12.0;
      pullV = 10.0;
    } else if (bestDistPx < 48) {
      pullH = 2.8;
      pullV = 2.0;
    }
    pullH *= state.assistStrength;
    pullV *= state.assistStrength;
    const alphaH = 1 - Math.exp(-pullH * dt),
      alphaV = 1 - Math.exp(-pullV * dt),
      wrapDiff = (t, c) => {
        let d = t - c;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return d;
      };
    if (state.isFiring && state.userDragUp > 0.12) {
      state.camYaw += wrapDiff(headYaw, state.camYaw) * alphaH;
      const dPitchHead = headPitch - state.camPitch;
      if (Math.abs(dPitchHead) < 0.048)
        state.camPitch +=
          dPitchHead * (1 - Math.exp(-6.0 * state.assistStrength * dt));
    } else if (pullH > 0) {
      state.camYaw += wrapDiff(chestYaw, state.camYaw) * alphaH;
      state.camPitch += (chestPitch - state.camPitch) * alphaV;
    }
  }

  // PARTÍCULAS, DANO & TIRO
  const particles3d = [],
    particlePool = [],
    floatingNums = [],
    tracers3d = [],
    partGeo = R.shared(new THREE.BoxGeometry(0.08, 0.08, 0.08));
  function releaseParticle(p) {
    scene.remove(p.mesh);
    p.mesh.visible = false;
    particlePool.push(p);
  }
  function spawnSparks(pos, color, count) {
    const limit = R.presets[state.quality].particles;
    count = Math.min(count, limit - particles3d.length);
    for (let i = 0; i < count; i++) {
      let p = particlePool.pop();
      if (!p) {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
        p = { mesh: new THREE.Mesh(partGeo, mat), mat };
      }
      p.mat.color.setHex(color);
      p.mat.opacity = 1;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.vx = (Math.random() - 0.5) * 6;
      p.vy = Math.random() * 4.5 + 1;
      p.vz = (Math.random() - 0.5) * 6;
      p.life = 0.45 + Math.random() * 0.25;
      scene.add(p.mesh);
      particles3d.push(p);
    }
  }

  function spawnTracer(start, end, color = 0xffdf7a) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([start, end]),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
    );
    scene.add(line);
    tracers3d.push({ line, mat: line.material, alpha: 0.8 });
  }

  function applyPlayerDamage(rawDmg, isHead, now, sourcePos = null) {
    if (player.dead) return;
    if (
      state.skill === "chrono" &&
      now < player.skillActiveUntil &&
      sourcePos
    ) {
      spawnSparks(
        player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)),
        0x38bdf8,
        5,
      );
      return;
    }
    if (sourcePos) damageDirs.push({ pos: sourcePos.clone(), time: now });
    let dmg = rawDmg;
    if (isHead && player.helmHp > 0) {
      const abs = rawDmg * [0, 0.2, 0.35, 0.5, 0.62][player.helmLv];
      player.helmHp = Math.max(0, player.helmHp - abs);
      dmg = rawDmg - abs;
    } else if (!isHead && player.vestHp > 0) {
      const abs = rawDmg * [0, 0.2, 0.35, 0.5, 0.62][player.vestLv];
      player.vestHp = Math.max(0, player.vestHp - abs);
      dmg = rawDmg - abs;
    }
    player.hp -= dmg;
    player.damageFlashAt = now;
    updateHpUI();
    if (player.hp <= 0) {
      player.hp = 0;
      player.dead = true;
      playerChar.root.visible = false;
      player.inVehicle = false;
      player.onZipline = false;
      state.isFiring = false;
      state.isScoped = false;
      state.streak = 0;
      state.capaStreak = 0;
      updateHpUI();
      if (state.mode === "treino") {
        player.respawnAt = now + 2200;
        showBanner("NOCAUTEADO!", "Renascendo na Ilha...", "#ff3b3b");
      } else if (state.mode === "br") {
        const place = 1 + enemies.filter((b) => b.alive).length;
        updateScoreBoxUI();
        openSummary(
          `#${place} LUGAR!`,
          `Você foi eliminado com ${state.kills} abates`,
        );
      } else if (state.mode === "horda")
        openSummary(
          `FIM DA HORDA (ONDA ${state.hordaWave})`,
          `Você eliminou ${state.kills} invasores!`,
        );
      else if (
        (state.mode === "cs" || state.mode === "x1bot") &&
        !state.roundOver
      ) {
        state.roundOver = true;
        state.csEnemyScore++;
        updateScoreBoxUI();
        if (state.csEnemyScore >= 4)
          openSummary(
            state.mode === "x1bot" ? "DERROTA NO X1!" : "DERROTA NO CS!",
            `Placar Final: ${state.csPlayerScore} x ${state.csEnemyScore}`,
          );
        else {
          state.csRound++;
          if (state.mode === "cs") {
            state.csCoins += 500;
            showBanner(
              "ROUND PERDIDO",
              "+$500 para o próximo round",
              "#ff3b3b",
            );
            clock.schedule(openCSShop, 2200);
          } else {
            showBanner(
              "PONTO DO BOT PRO!",
              `${state.csPlayerScore} x ${state.csEnemyScore}`,
              "#ff3b3b",
            );
            clock.schedule(startX1Round, 2000);
          }
        }
      } else if (state.mode === "x1") {
        state.csEnemyScore++;
        updateScoreBoxUI();
        sendP2P({ t: "roundWin" });
        if (state.csEnemyScore >= 4)
          openSummary(
            "DERROTA NO X1!",
            `Placar Final: ${state.csPlayerScore} x ${state.csEnemyScore}`,
          );
        else {
          state.csRound++;
          showBanner(
            "DERROTA NO ROUND!",
            `${state.csPlayerScore} x ${state.csEnemyScore}`,
            "#ff3b3b",
          );
          clock.schedule(startX1Round, 2000);
        }
      }
    }
  }

  function damageEnemy(
    e,
    rawDmg,
    isHead,
    hitPos,
    now,
    weaponLabel = null,
    byPlayer = true,
    killerName = "Você",
    attackerPos = null,
  ) {
    let dmg = rawDmg,
      helmBroken = false;
    if (isHead && e.helmHp > 0) {
      const abs = rawDmg * 0.25;
      e.helmHp -= abs;
      dmg = Math.round(rawDmg - abs);
      if (e.helmHp <= 0) {
        e.helmHp = 0;
        e.char.helmet.visible = false;
        helmBroken = true;
        spawnSparks(hitPos, 0x38bdf8, 8);
      }
    } else if (!isHead && e.vestHp > 0) {
      const abs = rawDmg * 0.22;
      e.vestHp = Math.max(0, e.vestHp - abs);
      dmg = Math.round(rawDmg - abs);
    }
    if (byPlayer) {
      state.matchDmg += dmg;
      state.hitmarkerAt = now;
      state.hitmarkerHead = isHead;
      playHitSound(isHead, helmBroken);
      floatingNums.push({
        worldPos: hitPos
          .clone()
          .add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.18, 0)),
        text: `${dmg}`,
        isHead,
        alpha: 1.0,
        vy: 1.2,
      });
    }
    e.hp -= dmg;
    e.flashAt = now;
    e.damagedAt = now;
    e.char.torsoMat.color.setHex(0xffffff);
    spawnSparks(hitPos, isHead ? 0xff2a2a : 0xffbe2e, isHead ? 10 : 4);

    if (
      e.hp > 0 &&
      e.hp < 95 &&
      now - e.lastGelAt > (state.mode === "x1bot" ? 5000 : 10000) &&
      state.botsShoot
    ) {
      e.lastGelAt = now;
      const src = attackerPos || player.pos,
        yawToSrc = Math.atan2(
          e.char.root.position.x - src.x,
          e.char.root.position.z - src.z,
        );
      spawnGlooWallAt(
        e.char.root.position.x - Math.sin(yawToSrc) * 1.9,
        e.char.root.position.y,
        e.char.root.position.z - Math.cos(yawToSrc) * 1.9,
        yawToSrc,
        now,
        true,
      );
      if (!e.healedBehindGel) {
        e.healedBehindGel = true;
        clock.schedule(() => {
          if (e.alive) e.hp = Math.min(e.maxHp, e.hp + 55);
        }, 1800);
      }
    }
    if (e.hp <= 0) {
      e.alive = false;
      e.char.root.visible = false;
      e.respawnAt = now + 2600;
      spawnLootBox(e.char.root.position);
      addKillfeed(
        killerName,
        weaponLabel || WEAPONS[state.weaponKey].name,
        e.name,
        isHead,
      );
      if (byPlayer) {
        state.kills++;
        statsTotal.kills++;
        state.killBadgeAt = now;
        state.killBadgeHead = isHead;
        if (state.pet === "panda") {
          player.hp = Math.min(player.maxHp, player.hp + 20);
          updateHpUI();
        }
        if (
          weaponLabel &&
          (weaponLabel.includes("Granada") ||
            weaponLabel.includes("Barril") ||
            weaponLabel.includes("Mina") ||
            weaponLabel.includes("M79"))
        )
          statsTotal.boomKills++;
        if (isHead) {
          state.capas++;
          statsTotal.capas++;
          state.capaStreak++;
        } else {
          state.capaStreak = 0;
        }
        state.streak = now - state.lastKillAt < 5000 ? state.streak + 1 : 1;
        state.lastKillAt = now;
        if (state.mode === "cs") state.csCoins += isHead ? 450 : 300;
        $("uiKills").textContent = state.kills;
        $("uiCapas").textContent = state.capas;
        $("uiRate").textContent =
          Math.round((state.capas / state.kills) * 100) + "%";
        persistSave();
        let sub = "";
        if (state.kills === 1) {
          sub = "FIRST BLOOD!";
          speakAnnouncer("First Blood");
        }
        if (state.streak === 2) {
          sub = "DOUBLE KILL!";
          speakAnnouncer("Double Kill");
        } else if (state.streak === 3) {
          sub = "TRIPLE KILL!";
          speakAnnouncer("Triple Kill");
        } else if (state.streak >= 4) {
          sub = `MEGA KILL ${state.streak}x!`;
          speakAnnouncer("Unstoppable");
        }
        if (state.capaStreak >= 3)
          sub = `👑 REI DO CAPA (${state.capaStreak}x SEGUIDOS)!`;
        showBanner(
          isHead ? "CAPA! 🔥" : "ELIMINADO! 💀",
          sub,
          isHead ? "#ff3b3b" : "#ffbe2e",
        );
      }
      if (state.mode === "br") {
        updateScoreBoxUI();
        if (!player.dead && enemies.every((bot) => !bot.alive)) {
          statsTotal.booyahs++;
          persistSave();
          speakAnnouncer("Booyah!");
          openSummary(
            "BOOYAH! 🏆",
            `1º LUGAR · CONTRA BOTS • ${state.kills} Abates!`,
          );
        }
      } else if (state.mode === "horda") {
        updateScoreBoxUI();
        if (
          !player.dead &&
          enemies.every((bot) => !bot.alive) &&
          state.hordaNextWaveAt === 0
        ) {
          state.hordaNextWaveAt = now + 3200;
          player.hp = Math.min(player.maxHp, player.hp + 60);
          player.gels += 1;
          player.kits += 1;
          player.nades += 1;
          player.mines += 1;
          updateHpUI();
          showBanner(
            `ONDA ${state.hordaWave} LIMPA!`,
            "+60 HP, +1 Gel, Kit, Granada e Mina!",
            "#4ade80",
          );
        }
      } else if (state.mode === "x1bot" && !state.roundOver) {
        state.roundOver = true;
        state.csPlayerScore++;
        updateScoreBoxUI();
        if (state.csPlayerScore >= 4) {
          statsTotal.booyahs++;
          persistSave();
          speakAnnouncer("Booyah!");
          openSummary(
            "BOOYAH! 🏆",
            `CAMPEÃO X1 (${state.csPlayerScore} x ${state.csEnemyScore})`,
          );
        } else {
          state.csRound++;
          showBanner(
            "PONTO SEU!",
            `${state.csPlayerScore} x ${state.csEnemyScore}`,
            "#4ade80",
          );
          clock.schedule(startX1Round, 2000);
        }
      } else if (
        state.mode === "cs" &&
        !state.roundOver &&
        enemies.every((bot) => !bot.alive)
      ) {
        state.roundOver = true;
        state.csPlayerScore++;
        updateScoreBoxUI();
        if (state.csPlayerScore >= 4) {
          statsTotal.booyahs++;
          persistSave();
          speakAnnouncer("Booyah!");
          openSummary(
            "BOOYAH! 🏆",
            `VITÓRIA NO CONTRA SQUAD (${state.csPlayerScore} x ${state.csEnemyScore})`,
          );
        } else {
          state.csRound++;
          state.csCoins += 900;
          showBanner("VITÓRIA DO ROUND!", "+$900 • Abrindo Loja...", "#4ade80");
          clock.schedule(openCSShop, 2000);
        }
      }
    }
  }

  const shotRaycaster = new THREE.Raycaster();
  function fireWeapon(now) {
    const w = WEAPONS[state.weaponKey];
    if (
      player.dead ||
      player.inVehicle ||
      player.parachuting ||
      player.onZipline ||
      state.reloading
    )
      return;
    if (!w.melee && !state.customRoom && state.ammo <= 0) {
      startReload();
      return;
    }
    if (now - state.lastShotAt < w.rate) return;
    state.lastShotAt = now;
    if (w.melee) {
      player.slashUntil = now + 260;
      playShotSound("katana", 1);
      for (const e of enemies)
        if (e.alive && e.char.root.position.distanceTo(player.pos) <= w.range)
          damageEnemy(
            e,
            w.dmg,
            Math.random() < 0.35,
            e.char.root.position.clone().add(new THREE.Vector3(0, 1.3, 0)),
            now,
            "Katana ⚔️",
          );
      if (
        state.mode === "x1" &&
        remotePlayer.alive &&
        remoteChar.root.position.distanceTo(player.pos) <= w.range
      ) {
        sendP2P({ t: "hit", dmg: w.dmg, isHead: false });
        state.hitmarkerAt = now;
        playHitSound(false, false);
      }
      for (const g of glooWalls)
        if (g.mesh.position.distanceTo(player.pos) <= 3.5) {
          g.hp -= 180;
          spawnSparks(g.mesh.position.clone(), 0x38bdf8, 6);
          if (g.hp <= 0) g.createdAt = -Infinity;
        }
      return;
    }

    if (!state.customRoom) {
      state.ammo = Math.max(0, state.ammo - (w.akimbo ? 2 : 1));
      updateAmmoUI();
    }
    playShotSound(state.weaponKey, 1);
    playerChar.muzzleFlash.visible = true;
    state.flashOffAt = now + 45;
    state.bloom = Math.min(
      28,
      state.bloom + (state.weaponKey === "mp40" ? 5 : 4),
    );
    state.camShake = Math.max(state.camShake, w.shake);
    state.gunKick = 0.14;
    const muzzleR = new THREE.Vector3(),
      muzzleL = new THREE.Vector3();
    playerChar.muzzlePoint.getWorldPosition(muzzleR);
    playerChar.leftMuzzlePoint.getWorldPosition(muzzleL);
    muzzleLight.position.copy(muzzleR);
    muzzleLight.intensity = state.weaponKey === "groza" ? 0.9 : 2.8;

    if (state.weaponKey === "m79") {
      throwGrenade(
        now,
        false,
        muzzleR,
        camForward
          .clone()
          .add(new THREE.Vector3(0, 0.12, 0))
          .normalize()
          .multiplyScalar(32),
        true,
      );
      state.camPitch = Math.min(0.85, state.camPitch + w.recoil);
      if (!state.customRoom && state.ammo === 0) startReload();
      return;
    }

    const dummyHits =
        state.mode === "treino" ? dummies.flatMap((d) => [d.hHit, d.bHit]) : [],
      activeBarrels = barrelMeshes.filter((m) => m.userData.barrel.alive);
    const allTargets = [
      ...enemyHitMeshes.filter((mesh) => mesh.userData.enemy.alive),
      ...dummyHits,
      ...activeBarrels,
      ...getObstacleMeshes(),
    ];
    if (state.mode === "x1" && remotePlayer.alive)
      allTargets.push(remoteHeadHit, remoteBodyHit);

    for (let p = 0; p < w.pellets; p++) {
      const mOrig = w.akimbo && p === 1 ? muzzleL : muzzleR;
      const spreadAmount =
        (w.spread + state.bloom * 0.0012) * (state.isScoped ? 0.45 : 1);
      const sx =
        p === 0 && w.pellets === 1 && state.bloom < 6
          ? (Math.random() - 0.5) * spreadAmount * 0.3
          : (Math.random() - 0.5) * spreadAmount * 2;
      const sy =
        p === 0 && w.pellets === 1 && state.bloom < 6
          ? (Math.random() - 0.5) * spreadAmount * 0.3
          : (Math.random() - 0.5) * spreadAmount * 2;
      shotRaycaster.setFromCamera(new THREE.Vector2(sx, sy), camera);
      shotRaycaster.far = w.range;
      const hits = shotRaycaster.intersectObjects(allTargets, false);
      let endPoint = camera.position
        .clone()
        .addScaledVector(shotRaycaster.ray.direction, w.range);
      if (hits.length > 0) {
        const hit = hits[0];
        endPoint = hit.point.clone();
        if (hit.object.userData && hit.object.userData.enemy) {
          const e = hit.object.userData.enemy;
          if (e.alive) {
            const isHead = hit.object.userData.isHead;
            damageEnemy(
              e,
              Math.round(
                w.dmg *
                  (isHead ? w.headMult : 1) *
                  Math.max(0.6, 1 - hit.distance / (w.range * 1.4)),
              ),
              isHead,
              endPoint,
              now,
            );
          }
        } else if (hit.object.userData && hit.object.userData.barrel) {
          const b = hit.object.userData.barrel;
          if (b.alive) {
            b.hp -= w.dmg;
            state.hitmarkerAt = now;
            state.hitmarkerHead = false;
            spawnSparks(endPoint, 0xf97316, 5);
            if (b.hp <= 0) {
              b.alive = false;
              b.group.visible = false;
              b.respawnAt = now + 22000;
              explodeAt(b.pos.clone(), now, false, "Barril 🔥", 7.5);
            }
          }
        } else if (hit.object.userData && hit.object.userData.dummy) {
          const dm = hit.object.userData.dummy,
            isHead = hit.object.userData.isHead,
            dmg = Math.round(
              w.dmg *
                (isHead ? w.headMult : 1) *
                Math.max(0.6, 1 - hit.distance / (w.range * 1.4)),
            );
          if (now - dm.lastHitAt > 2200) dm.comboDmg = 0;
          dm.comboDmg += dmg;
          dm.lastHitAt = now;
          dm.flashAt = now;
          dm.char.torsoMat.color.setHex(0xffffff);
          state.hitmarkerAt = now;
          state.hitmarkerHead = isHead;
          playHitSound(isHead, false);
          spawnSparks(endPoint, isHead ? 0xff2a2a : 0xffbe2e, isHead ? 9 : 4);
          floatingNums.push({
            worldPos: endPoint.clone().add(new THREE.Vector3(0, 0.2, 0)),
            text: `${dmg}`,
            isHead,
            alpha: 1,
            vy: 1.2,
          });
        } else if (hit.object.userData && hit.object.userData.isRemote) {
          const isHead = hit.object.userData.isHead,
            dmg = Math.round(w.dmg * (isHead ? w.headMult : 1));
          state.matchDmg += dmg;
          state.hitmarkerAt = now;
          state.hitmarkerHead = isHead;
          remotePlayer.damagedAt = now;
          playHitSound(isHead, false);
          spawnSparks(endPoint, isHead ? 0xff2a2a : 0xffbe2e, isHead ? 10 : 4);
          floatingNums.push({
            worldPos: endPoint.clone().add(new THREE.Vector3(0, 0.2, 0)),
            text: `${dmg}`,
            isHead,
            alpha: 1,
            vy: 1.2,
          });
          sendP2P({ t: "hit", dmg, isHead });
        } else {
          const g = glooWalls.find((w) => w.mesh === hit.object);
          spawnSparks(endPoint, g ? 0x38bdf8 : 0xfbbf24, 4);
          if (g) {
            g.hp -= w.dmg;
            if (g.hp <= 0) g.createdAt = -Infinity;
          }
        }
      }
      spawnTracer(mOrig, endPoint, 0xffdf7a);
      sendP2P({
        t: "shot",
        w: state.weaponKey,
        sx: mOrig.x,
        sy: mOrig.y,
        sz: mOrig.z,
        ex: endPoint.x,
        ey: endPoint.y,
        ez: endPoint.z,
      });
    }
    state.camPitch = Math.min(
      0.85,
      state.camPitch + w.recoil * (state.isScoped ? 0.6 : 1),
    );
    if (!state.customRoom && state.ammo === 0) startReload();
  }

  function checkObstacleHit(pos, radius, o) {
    if (o.isOBB) {
      if (pos.y > o.maxY - 0.35 || pos.y + 1.65 < o.minY) return false;
      const dx = pos.x - o.cx,
        dz = pos.z - o.cz,
        c = Math.cos(o.yaw),
        s = Math.sin(o.yaw);
      return (
        Math.abs(dx * c - dz * s) < o.hw + radius &&
        Math.abs(dx * s + dz * c) < o.hd + radius
      );
    }
    if (pos.y > o.box.max.y - 0.35 || pos.y + 1.65 < o.box.min.y) return false;
    return (
      pos.x + radius > o.box.min.x &&
      pos.x - radius < o.box.max.x &&
      pos.z + radius > o.box.min.z &&
      pos.z - radius < o.box.max.z
    );
  }
  function moveWithCollision(pos, dx, dz, radius = 0.45) {
    let blocked = false;
    pos.x += dx;
    for (const o of obstacles) {
      if (checkObstacleHit(pos, radius, o)) {
        pos.x -= dx;
        blocked = true;
        break;
      }
    }
    pos.z += dz;
    for (const o of obstacles) {
      if (checkObstacleHit(pos, radius, o)) {
        pos.z -= dz;
        blocked = true;
        break;
      }
    }
    return blocked;
  }

  const botRaycaster = new THREE.Raycaster();
  function updateBotAI(e, dt, now) {
    const pos = e.char.root.position,
      distZone = Math.hypot(pos.x - safeZone.centerX, pos.z - safeZone.centerZ),
      outOfZone = safeZone.active && distZone > safeZone.radius - 1.5;
    if (outOfZone && now - e.lastZoneDmgAt > 1000) {
      e.lastZoneDmgAt = now;
      damageEnemy(
        e,
        7,
        false,
        pos.clone().add(new THREE.Vector3(0, 1.2, 0)),
        now,
        "Gás 🟣",
        false,
        "Safe Zone",
      );
      if (!e.alive) return;
    }

    let targetEnemyBot = null,
      targetPos = player.dead
        ? null
        : new THREE.Vector3(
            player.pos.x,
            player.pos.y + (player.crouching ? 0.8 : 1.15),
            player.pos.z,
          ),
      bestD = targetPos ? pos.distanceTo(targetPos) : Infinity;
    if (state.mode === "br") {
      for (const other of enemies) {
        if (other === e || !other.alive) continue;
        const d = pos.distanceTo(other.char.root.position);
        if (d < bestD && d < 28) {
          bestD = d;
          targetEnemyBot = other;
          targetPos = other.char.root.position
            .clone()
            .add(new THREE.Vector3(0, 1.15, 0));
        }
      }
    }
    const refPos = targetPos || player.pos,
      toTarget = new THREE.Vector3(refPos.x - pos.x, 0, refPos.z - pos.z),
      dist2d = toTarget.length();
    const dirToT =
        dist2d > 0.01
          ? toTarget.clone().normalize()
          : new THREE.Vector3(0, 0, 1),
      perp = new THREE.Vector3(-dirToT.z, 0, dirToT.x);

    if (outOfZone && e.role !== "sniper" && e.role !== "guarita") {
      const toC = new THREE.Vector3(
        safeZone.centerX - pos.x,
        0,
        safeZone.centerZ - pos.z,
      ).normalize();
      moveWithCollision(
        pos,
        toC.x * e.speed * 1.15 * dt,
        toC.z * e.speed * 1.15 * dt,
        0.45,
      );
    } else if (e.role === "sniper") {
      if (pos.x > 4.0) e.strafeDir = -1;
      if (pos.x < -4.0) e.strafeDir = 1;
      if (moveWithCollision(pos, e.strafeDir * e.speed * dt, 0, 0.45))
        e.strafeDir *= -1;
    } else if (e.role === "guarita") {
      if (pos.z > 12.2) e.strafeDir = -1;
      if (pos.z < 7.8) e.strafeDir = 1;
      if (moveWithCollision(pos, 0, e.strafeDir * e.speed * dt, 0.45))
        e.strafeDir *= -1;
    } else {
      let vx = perp.x * e.strafeDir * e.speed * 0.75,
        vz = perp.z * e.strafeDir * e.speed * 0.75;
      const prefDist = e.role === "rush" ? 7.5 : 16.0;
      if (
        state.mode === "cs" ||
        state.mode === "br" ||
        state.mode === "horda" ||
        state.mode === "x1bot" ||
        state.botsShoot
      ) {
        if (dist2d > prefDist) {
          vx += dirToT.x * e.speed * 0.85;
          vz += dirToT.z * e.speed * 0.85;
        } else if (dist2d < prefDist - 4) {
          vx -= dirToT.x * e.speed * 0.55;
          vz -= dirToT.z * e.speed * 0.55;
        }
      }
      if (pos.x > 26 || pos.x < -26 || pos.z > 24 || pos.z < -38)
        e.strafeDir *= -1;
      if (moveWithCollision(pos, vx * dt, vz * dt, 0.45)) e.strafeDir *= -1;
    }

    e.walkTime += dt * 8;
    e.char.leftLegPivot.rotation.x = Math.sin(e.walkTime) * 0.45;
    e.char.rightLegPivot.rotation.x = -Math.sin(e.walkTime) * 0.45;
    e.jumpTimer -= dt;
    if (e.role === "rush" && e.jumpTimer <= 0 && state.botsShoot)
      e.jumpTimer = (state.mode === "x1bot" ? 1.8 : 2.8) + Math.random() * 2.0;
    pos.y =
      e.baseY +
      (e.jumpTimer > 2.3
        ? Math.sin((e.jumpTimer - 2.3) * Math.PI * 2) * 0.65
        : 0);
    if (state.botsShoot && targetPos) {
      e.char.root.rotation.y = Math.atan2(pos.x - refPos.x, pos.z - refPos.z);
      e.char.rightArmPivot.rotation.x = Math.PI / 2;
    }
    if (now - e.flashAt > 90) e.char.torsoMat.color.setHex(e.origColor);

    if (!state.botsShoot || !targetPos || now < e.nextShotAt) return;
    const rate =
      e.weapon === "awm"
        ? 2400
        : e.weapon === "m1014" || e.weapon === "m1887"
          ? 1200
          : 1100;
    e.nextShotAt =
      now + rate + Math.random() * (state.mode === "x1bot" ? 400 : 900);
    const botEye = new THREE.Vector3(pos.x, pos.y + 1.48, pos.z);
    if (isBlockedBySmoke(botEye, targetPos)) return;
    const dir = targetPos.clone().sub(botEye),
      maxR =
        e.weapon === "m1014" || e.weapon === "m1887"
          ? 18
          : e.weapon === "awm"
            ? 58
            : 38;
    if (dir.length() > maxR) return;
    dir.normalize();
    const spread =
      e.weapon === "awm" ? 0.045 : state.mode === "x1bot" ? 0.06 : 0.085;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread * 0.7;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    botRaycaster.set(botEye, dir);
    botRaycaster.far = maxR;
    const hitsObs = botRaycaster.intersectObjects(getObstacleMeshes(), false),
      distToObs = hitsObs.length > 0 ? hitsObs[0].distance : Infinity;
    let endPt =
      hitsObs.length > 0
        ? hitsObs[0].point
        : botEye.clone().addScaledVector(dir, maxR);
    const toT = targetPos.clone().sub(botEye),
      proj = toT.dot(dir);
    if (proj > 0 && proj < distToObs) {
      const closest = botEye.clone().addScaledVector(dir, proj);
      if (closest.distanceTo(targetPos) < 0.48) {
        endPt = closest;
        const dmg =
          e.weapon === "awm"
            ? 36
            : e.weapon === "m1014" || e.weapon === "m1887"
              ? 22
              : 13;
        if (targetEnemyBot)
          damageEnemy(
            targetEnemyBot,
            dmg,
            Math.random() < 0.18,
            closest,
            now,
            WEAPONS[e.weapon].name,
            false,
            e.name,
            botEye,
          );
        else {
          applyPlayerDamage(dmg, Math.random() < 0.12, now, botEye);
          spawnSparks(closest, 0xff3b3b, 4);
        }
      }
    } else if (hitsObs.length > 0) {
      const g = glooWalls.find((w) => w.mesh === hitsObs[0].object);
      spawnSparks(hitsObs[0].point, g ? 0x38bdf8 : 0xfbbf24, 3);
      if (g) {
        g.hp -= 24;
        if (g.hp <= 0) g.createdAt = -Infinity;
      }
    }
    e.lastFiredAt = now;
    playShotSound(e.weapon, 0.22);
    spawnTracer(botEye, endPt, 0xff4d4d);
  }

  let lastNetSend = 0,
    lastZoneTick = 0,
    lastHudAt = 0;
  function updatePlayer(dt, now) {
    if (player.dead) {
      alokRing.visible = false;
      chronoDome.visible = false;
      if (state.mode === "treino" && now >= player.respawnAt)
        resetPlayerStats(0, 0, 14);
      return;
    }
    if (state.pet !== "none") {
      const px = player.pos.x - Math.cos(player.charYaw) * 0.85,
        pz = player.pos.z + Math.sin(player.charYaw) * 0.85;
      petGroup.position.lerp(
        new THREE.Vector3(
          px,
          player.pos.y + 1.8 + Math.sin(now * 0.004) * 0.14,
          pz,
        ),
        1 - Math.exp(-9 * dt),
      );
      petGroup.rotation.y = player.charYaw;
      if (state.pet === "waggor" && now >= player.nextWaggorAt) {
        player.nextWaggorAt = now + 16000;
        player.gels = Math.min(10, player.gels + 1);
        playTone("sine", 580, 820, 0.1, 0.12);
      }
    }
    if (player.ep > 0 && player.hp < player.maxHp) {
      const conv = Math.min(player.ep, player.maxHp - player.hp, 6 * dt);
      player.ep -= conv;
      player.hp += conv;
      updateHpUI();
    }
    for (const m of mushrooms) {
      if (!m.active) {
        if (now >= m.respawnAt) {
          m.active = true;
          m.group.visible = true;
        }
        continue;
      }
      if (
        m.group.position.distanceTo(player.pos) < 1.5 &&
        player.ep < player.maxEp
      ) {
        m.active = false;
        m.group.visible = false;
        m.respawnAt = now + 20000;
        player.ep = Math.min(player.maxEp, player.ep + 60);
        updateHpUI();
        playTone("sine", 520, 780, 0.12, 0.16);
      }
    }
    for (const u of upgraders) {
      u.mesh.visible = now >= u.readyAt;
      if (
        now >= u.readyAt &&
        u.pos.distanceTo(player.pos) < 1.3 &&
        (player.helmLv < 4 ||
          player.vestLv < 4 ||
          player.vestHp < player.vestMax)
      ) {
        u.readyAt = now + 22000;
        player.helmLv = Math.min(4, player.helmLv + 1);
        player.helmMax = 80 + player.helmLv * 25;
        player.helmHp = player.helmMax;
        player.vestLv = Math.min(4, player.vestLv + 1);
        player.vestMax = 100 + player.vestLv * 30;
        player.vestHp = player.vestMax;
        updateHpUI();
        playSkillSound();
        showBanner(
          `COLETE UPADO! 🛡️`,
          `Capacete & Colete Nível ${player.vestLv}!`,
          "#4ade80",
        );
      }
    }

    if (
      (state.mode === "treino" || state.mode === "br") &&
      now >= arsenal.readyAt
    ) {
      arsenal.icon.visible = true;
      arsenal.icon.rotation.y += 2.5 * dt;
      if (
        player.pos.distanceTo(arsenal.pos) < 2.6 &&
        !player.inVehicle &&
        !player.parachuting
      ) {
        arsenal.prog += dt / 4.0;
        if (arsenal.prog >= 1) {
          arsenal.prog = 0;
          arsenal.readyAt = now + 45000;
          arsenal.icon.visible = false;
          state.unlockedWeapons.groza = true;
          state.unlockedWeapons.m79 = true;
          state.unlockedWeapons.vector = true;
          refreshWeaponSlotLocks();
          selectWeapon("vector");
          player.helmLv = 4;
          player.helmHp = 180;
          player.helmMax = 180;
          player.vestLv = 4;
          player.vestHp = 220;
          player.vestMax = 220;
          player.gels += 4;
          player.inhalers += 2;
          updateHpUI();
          playSkillSound();
          showBanner(
            "ARSENAL DESTRANCADO! 🔓",
            "VECTOR DUPLA + GROZA + M79 + COLETE NV.4!",
            "#38bdf8",
          );
        }
      } else arsenal.prog = Math.max(0, arsenal.prog - dt);
    } else {
      arsenal.icon.visible = false;
      arsenal.prog = 0;
    }

    if (player.onZipline) {
      player.zipT += dt * 0.48;
      player.pos.lerpVectors(
        player.zipFrom,
        player.zipTo,
        Math.min(1, player.zipT),
      );
      playerChar.root.rotation.y = Math.atan2(
        player.zipFrom.x - player.zipTo.x,
        player.zipFrom.z - player.zipTo.z,
      );
      playerChar.leftArmPivot.rotation.x = 2.8;
      playerChar.rightArmPivot.rotation.x = 2.8;
      vehiclePrompt.style.display = "block";
      vehiclePrompt.textContent = `[${keyHint("jump")}] Soltar da Tirolesa`;
      $("uiState").textContent = "TIROLESA";
      if (player.zipT >= 1) {
        player.onZipline = false;
        player.onGround = true;
        playStepSound();
      }
      return;
    }
    if (player.parachuting) {
      let mx = 0,
        mz = 0;
      if (keys["KeyW"] || keys["ArrowUp"]) mz += 1;
      if (keys["KeyS"] || keys["ArrowDown"]) mz -= 1;
      if (keys["KeyA"] || keys["ArrowLeft"]) mx -= 1;
      if (keys["KeyD"] || keys["ArrowRight"]) mx += 1;
      const moveYaw = player.freeLook ? player.lockedMoveYaw : state.camYaw,
        pMult = state.pet === "falcao" ? 1.35 : 1.0;
      if (mx !== 0 || mz !== 0) {
        const len = Math.hypot(mx, mz);
        mx /= len;
        mz /= len;
        player.pos.x = Math.max(
          -32,
          Math.min(
            32,
            player.pos.x +
              (-Math.sin(moveYaw) * mz + Math.cos(moveYaw) * mx) *
                11 *
                pMult *
                dt,
          ),
        );
        player.pos.z = Math.max(
          -42,
          Math.min(
            26,
            player.pos.z +
              (-Math.cos(moveYaw) * mz - Math.sin(moveYaw) * mx) *
                11 *
                pMult *
                dt,
          ),
        );
      }
      player.pos.y -= 6.8 * pMult * dt;
      playerChar.root.rotation.y = moveYaw;
      playerChar.leftArmPivot.rotation.x = 2.8;
      playerChar.rightArmPivot.rotation.x = 2.8;
      const fy = getFloorY(player.pos.x, player.pos.z, player.pos.y);
      if (player.pos.y <= fy) {
        player.pos.y = fy;
        player.parachuting = false;
        playerChute.visible = false;
        player.onGround = true;
        playStepSound();
        spawnSparks(player.pos.clone(), 0xd6d3d1, 8);
      }
      $("uiState").textContent = `PARAQUEDAS (${Math.round(player.pos.y)}m)`;
      return;
    }

    if (
      state.skill === "tatsuya" &&
      player.tatsuyaCharges < 2 &&
      now >= player.tatsuyaRechargeAt
    ) {
      player.tatsuyaCharges++;
      if (player.tatsuyaCharges < 2) player.tatsuyaRechargeAt = now + 8000;
    }
    const alokOn = state.skill === "alok" && now < player.skillActiveUntil,
      chronoOn = state.skill === "chrono" && now < player.skillActiveUntil;
    alokRing.visible = alokOn;
    if (alokOn) {
      alokRing.position.set(player.pos.x, player.pos.y + 0.05, player.pos.z);
      alokRing.rotation.z += 2.2 * dt;
      player.hp = Math.min(player.maxHp, player.hp + 9 * dt);
      updateHpUI();
    }
    chronoDome.visible = chronoOn;
    if (chronoOn)
      chronoDome.position.set(player.pos.x, player.pos.y + 1.15, player.pos.z);

    if (player.inVehicle) {
      let thr = 0,
        steer = 0;
      if (keys["KeyW"] || keys["ArrowUp"]) thr += 1;
      if (keys["KeyS"] || keys["ArrowDown"]) thr -= 1;
      if (keys["KeyA"] || keys["ArrowLeft"]) steer += 1;
      if (keys["KeyD"] || keys["ArrowRight"]) steer -= 1;
      const maxSpd = keys["ShiftLeft"] || keys["ShiftRight"] ? 19.5 : 13.5;
      if (thr !== 0) buggy.speed += thr * 18 * dt;
      else buggy.speed *= Math.exp(-3.5 * dt);
      buggy.speed = Math.max(-7, Math.min(maxSpd, buggy.speed));
      if (Math.abs(buggy.speed) > 0.4)
        buggy.yaw += steer * 2.2 * dt * (buggy.speed >= 0 ? 1 : -1);
      if (
        moveWithCollision(
          buggy.pos,
          -Math.sin(buggy.yaw) * buggy.speed * dt,
          -Math.cos(buggy.yaw) * buggy.speed * dt,
          1.05,
        )
      )
        buggy.speed *= -0.35;
      buggyGroup.rotation.y = buggy.yaw;
      buggyWheels.forEach((w) => (w.rotation.x -= buggy.speed * dt * 2.1));
      if (Math.abs(buggy.speed) > 0.6 && now - buggy.lastEngineAt > 90) {
        buggy.lastEngineAt = now;
        playTone(
          "triangle",
          50 + Math.abs(buggy.speed) * 3.2,
          42,
          0.075,
          0.055,
        );
        if (Math.abs(buggy.speed) > 13)
          spawnSparks(buggy.pos.clone(), 0xa8a29e, 1);
      }
      player.pos.set(buggy.pos.x, buggy.pos.y + 0.35, buggy.pos.z);
      playerChar.root.rotation.y = buggy.yaw;
      playerChar.bodyPivot.position.y = -0.3;
      if (Math.abs(buggy.speed) > 5.0) {
        for (const e of enemies) {
          if (e.alive && e.char.root.position.distanceTo(buggy.pos) < 1.9)
            damageEnemy(
              e,
              140,
              false,
              e.char.root.position.clone().add(new THREE.Vector3(0, 1, 0)),
              now,
              "Buggy 🚗",
            );
        }
      }
      vehiclePrompt.style.display = "block";
      vehiclePrompt.textContent = `[${keyHint("interact")}] Sair do Buggy • ${Math.abs(Math.round(buggy.speed * 5))} km/h`;
      $("uiState").textContent = "DIRIGINDO";
      return;
    }

    const nearZip =
      player.pos.distanceTo(zipAnchorA) < 2.6 ||
      player.pos.distanceTo(zipAnchorB) < 2.6;
    if (nearZip) {
      vehiclePrompt.style.display = "block";
      vehiclePrompt.textContent = `Pressione [${keyHint("interact")}] para pegar a Tirolesa`;
    } else if (
      (state.mode === "treino" || state.mode === "br") &&
      player.pos.distanceTo(buggy.pos) < 3.6
    ) {
      vehiclePrompt.style.display = "block";
      vehiclePrompt.textContent = `Pressione [${keyHint("interact")}] para dirigir o Buggy`;
    } else vehiclePrompt.style.display = "none";

    if (player.healing && now >= player.healEnd) {
      player.healing = false;
      if (state.mode !== "treino" && !state.customRoom) player.kits--;
      player.hp = Math.min(player.maxHp, player.hp + 85);
      updateHpUI();
    }
    if (now < player.dashUntil)
      moveWithCollision(
        player.pos,
        player.dashDir.x * 19 * dt,
        player.dashDir.z * 19 * dt,
      );

    let mx = 0,
      mz = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) mz += 1;
    if (keys["KeyS"] || keys["ArrowDown"]) mz -= 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) mx -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) mx += 1;
    const isMoving = mx !== 0 || mz !== 0;
    if (isMoving || state.isFiring) player.emoteUntil = 0;
    player.sprinting =
      isMoving &&
      (keys["ShiftLeft"] || keys["ShiftRight"]) &&
      !state.isScoped &&
      !state.isFiring &&
      !player.crouching &&
      !player.healing;
    let speed = player.healing
      ? 2.4
      : player.crouching
        ? 3.1
        : player.sprinting
          ? 8.4
          : 5.5;
    if (WEAPONS[state.weaponKey].melee) speed *= 1.16;
    if (alokOn) speed *= 1.22;
    const moveYaw = player.freeLook ? player.lockedMoveYaw : state.camYaw;
    if (isMoving) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      moveWithCollision(
        player.pos,
        (-Math.sin(moveYaw) * mz + Math.cos(moveYaw) * mx) * speed * dt,
        (-Math.cos(moveYaw) * mz - Math.sin(moveYaw) * mx) * speed * dt,
      );
      player.walkTime += dt * (player.sprinting ? 13 : 9);
      const sc = Math.floor(player.walkTime / Math.PI);
      if (sc !== player.lastStepCycle && player.onGround) {
        player.lastStepCycle = sc;
        playStepSound();
      }
    }

    const floorY = getFloorY(player.pos.x, player.pos.z, player.pos.y);
    if (!player.onGround || player.pos.y > floorY + 0.05) {
      player.velY -= 19.5 * dt;
      player.pos.y += player.velY * dt;
      const nf = getFloorY(player.pos.x, player.pos.z, player.pos.y);
      if (player.pos.y <= nf) {
        if (player.velY < -6) spawnSparks(player.pos.clone(), 0xd6d3d1, 5);
        player.pos.y = nf;
        player.velY = 0;
        player.onGround = true;
      } else player.onGround = false;
    } else player.pos.y = floorY;

    for (let i = loots.length - 1; i >= 0; i--)
      if (loots[i].mesh.position.distanceTo(player.pos) < 1.8) {
        scene.remove(loots[i].mesh);
        loots.splice(i, 1);
        player.gels = Math.min(8, player.gels + 1);
        player.kits = Math.min(5, player.kits + 1);
        player.inhalers = Math.min(5, player.inhalers + 1);
        player.vestHp = Math.min(player.vestMax, player.vestHp + 40);
        updateHpUI();
        playTone("sine", 660, 880, 0.1, 0.15);
      }
    if (
      airdrop.active &&
      airdrop.landed &&
      airdrop.pos.distanceTo(player.pos) < 2.2
    ) {
      airdrop.active = false;
      airdropGroup.visible = false;
      airdrop.nextSpawnAt = now + 32000;
      state.unlockedWeapons.groza = true;
      state.unlockedWeapons.m79 = true;
      state.unlockedWeapons.vector = true;
      refreshWeaponSlotLocks();
      selectWeapon("groza");
      player.helmLv = 3;
      player.helmHp = 130;
      player.helmMax = 130;
      player.vestLv = 3;
      player.vestHp = 160;
      player.vestMax = 160;
      player.gels = Math.min(10, player.gels + 3);
      player.kits = Math.min(6, player.kits + 1);
      updateHpUI();
      playSkillSound();
      showBanner(
        "AIRDROP COLETADO! 📦",
        "GROZA + M79 + VECTOR + COLETE NV.3!",
        "#ffbe2e",
      );
    }

    let targetCharYaw = moveYaw;
    if (isMoving && !state.isFiring && !state.isScoped)
      targetCharYaw = Math.atan2(
        -(Math.cos(moveYaw) * mx - Math.sin(moveYaw) * mz),
        -(-Math.sin(moveYaw) * mx - Math.cos(moveYaw) * mz),
      );
    let diff = targetCharYaw - player.charYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.charYaw += diff * (1 - Math.exp(-15 * dt));
    playerChar.root.rotation.y = player.charYaw;
    const crouchY = player.crouching || player.healing ? -0.36 : 0;
    playerChar.bodyPivot.position.y +=
      (crouchY - playerChar.bodyPivot.position.y) * (1 - Math.exp(-14 * dt));
    if (!player.onGround) {
      playerChar.leftLegPivot.rotation.x = 0.45;
      playerChar.rightLegPivot.rotation.x = -0.35;
    } else if (isMoving) {
      const amp = player.sprinting ? 0.72 : 0.48;
      playerChar.leftLegPivot.rotation.x = Math.sin(player.walkTime) * amp;
      playerChar.rightLegPivot.rotation.x = -Math.sin(player.walkTime) * amp;
    } else {
      playerChar.leftLegPivot.rotation.x *= Math.exp(-14 * dt);
      playerChar.rightLegPivot.rotation.x *= Math.exp(-14 * dt);
    }

    state.gunKick = Math.max(0, state.gunKick - 1.1 * dt);
    playerChar.gunHolder.position.z = -0.06 + state.gunKick;
    const emoting = now < player.emoteUntil;
    playerChar.flagGroup.visible = emoting;
    playerChar.currentGun.visible = !emoting;
    const aiming = state.isFiring || state.isScoped,
      akimbo = !!WEAPONS[state.weaponKey].akimbo;
    let armR = aiming
        ? Math.PI / 2 + state.camPitch
        : player.sprinting
          ? 0.35
          : 0.95,
      armL =
        akimbo && aiming
          ? armR
          : aiming
            ? armR - 0.1
            : -Math.sin(player.walkTime) * (isMoving ? 0.4 : 0);
    if (now < player.slashUntil) armR = 1.6 + Math.sin(now * 0.03) * 1.1;
    else if (emoting) {
      armR = 2.6 + Math.sin(now * 0.012) * 0.35;
      armL = 2.1;
    } else if (state.reloading) {
      armR = 1.1 + Math.sin(now * 0.015) * 0.25;
      armL = 1.2;
    } else if (player.healing) {
      armR = 1.35 + Math.sin(now * 0.01) * 0.15;
      armL = 1.35;
    } else if (player.aimingNade) armR = 2.4;
    playerChar.rightArmPivot.rotation.x +=
      (armR - playerChar.rightArmPivot.rotation.x) * (1 - Math.exp(-18 * dt));
    playerChar.leftArmPivot.rotation.x +=
      (armL - playerChar.leftArmPivot.rotation.x) * (1 - Math.exp(-16 * dt));

    if (player.aimingNade) {
      trajLine.visible = true;
      const p0 = new THREE.Vector3(
          player.pos.x,
          player.pos.y + 1.5,
          player.pos.z,
        ),
        v0 = getNadeLaunchVel(),
        pa = trajLine.geometry.attributes.position;
      for (let i = 0; i < 24; i++) {
        const t = i * 0.075,
          px = p0.x + v0.x * t,
          pz = p0.z + v0.z * t,
          py = p0.y + v0.y * t - 0.5 * 16 * t * t;
        pa.setXYZ(i, px, Math.max(getFloorY(px, pz, py + 0.5) + 0.08, py), pz);
      }
      pa.needsUpdate = true;
    } else trajLine.visible = false;
    if (state.mode === "x1" && now - lastNetSend > 33) {
      lastNetSend = now;
      sendP2P({
        t: "state",
        x: player.pos.x,
        y: player.pos.y,
        z: player.pos.z,
        yaw: player.charYaw,
        crouch: player.crouching,
        w: state.weaponKey,
        hp: player.hp,
        helm: player.helmHp,
        alok: alokOn,
        chrono: chronoOn,
        emote: emoting,
        aim: aiming ? state.camPitch : -99,
      });
    }

    if (now - lastHudAt > 100) {
      lastHudAt = now;
      $("uiState").textContent = player.freeLook
        ? `OLHAR LIVRE (${keyHint("freeLook")})`
        : emoting
          ? "BANDEIRÃO!"
          : player.healing
            ? "CURANDO..."
            : !player.onGround
              ? "PULANDO"
              : player.crouching
                ? "AGACHADO"
                : player.sprinting
                  ? "CORRENDO"
                  : "EM PÉ";
      const inf = state.customRoom || state.mode === "treino";
      $("uiGel").textContent =
        `Gel [${keyHint("gel")}/${keyHint("crouchGel")}]: ${inf ? "∞" : player.gels}`;
      $("uiKit").textContent =
        `Kit [${keyHint("medkit")}]: ${inf ? "∞" : player.kits}`;
      $("uiInal").textContent =
        `Inal. [${keyHint("inhaler")}]: ${inf ? "∞" : player.inhalers}`;
      $("uiNade").textContent =
        `Gran. [${keyHint("grenade")}]: ${inf ? "∞" : player.nades}`;
      $("uiMine").textContent =
        `Mina [${keyHint("mine")}]: ${inf ? "∞" : player.mines}`;
      $("uiSmoke").textContent =
        `Fum. [${keyHint("smoke")}]: ${inf ? "∞" : player.smokes}`;
      if (state.skill === "tatsuya")
        $("uiSkill").textContent =
          `[${keyHint("skill")}] Tatsuya: ${player.tatsuyaCharges}/2`;
      else {
        const cd = Math.max(0, Math.ceil((player.skillCdUntil - now) / 1000)),
          lb = state.skill === "alok" ? "Alok" : "Chrono";
        $("uiSkill").textContent =
          now < player.skillActiveUntil
            ? `[${keyHint("skill")}] ${lb}: ATIVO`
            : cd > 0
              ? `[${keyHint("skill")}] ${lb}: ${cd}s`
              : `[${keyHint("skill")}] ${lb}: Pronto`;
      }
      const ur = Math.max(0, Math.ceil((player.uavCdUntil - now) / 1000));
      $("uiUav").textContent =
        now < player.uavActiveUntil
          ? `[${keyHint("uav")}] VANT: ATIVO`
          : ur > 0
            ? `[${keyHint("uav")}] VANT: ${ur}s`
            : `[${keyHint("uav")}] VANT: Pronto`;
    }
  }

  function applyQuality(value) {
    state.quality = R.choice(value, Object.keys(R.presets), "medium");
    const preset = R.presets[state.quality];
    renderer.setPixelRatio(Math.min(devicePixelRatio, preset.pixelRatio));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = preset.shadows;
    sun.castShadow = preset.shadows;
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
    sun.shadow.mapSize.set(preset.shadowSize, preset.shadowSize);
    renderer.shadowMap.needsUpdate = true;
    scene.traverse((object) => {
      if (object.material)
        for (const mat of Array.isArray(object.material)
          ? object.material
          : [object.material])
          mat.needsUpdate = true;
    });
  }
  let fpsFrames = 0,
    fpsStart = performance.now();
  const perf = document.createElement("span");
  perf.className = "performance-pill";
  perf.id = "performanceStats";
  $("btnToggleCfg").after(perf);
  applyQuality(state.quality);
  ui = ArenaUI.init({
    THREE,
    state,
    playerChar,
    createCharacter,
    applyQuality,
    persistSave,
    bindings,
    onBindingsChanged: () => {
      releaseInputs();
      persistSave();
      lastHudAt = 0;
      refreshWeaponSlotLocks();
      for (const slot of weaponSlots)
        slot.querySelector("b").textContent =
          `${keyHint(slot.dataset.action)} • ${WEAPONS[slot.dataset.w].short}`;
    },
    pauseGame,
    resumeGame,
    restartGame,
    leaveGame,
  });
  ui.lobby();
  function animate(realNow) {
    requestAnimationFrame(animate);
    if (!isSimulating()) {
      clock.advance(realNow, false);
      fpsFrames = 0;
      fpsStart = realNow;
      ui.renderPreview();
      return;
    }
    const dt = clock.advance(realNow, true, simulate),
      now = clock.now;
    fpsFrames++;
    if (realNow - fpsStart >= 1000) {
      perf.textContent = `${Math.round((fpsFrames * 1000) / (realNow - fpsStart))} FPS · ${R.presets[state.quality].label}`;
      fpsFrames = 0;
      fpsStart = realNow;
    }
    renderer.render(scene, camera);
    draw2DOverlay(now, dt);
  }
  function simulate(dt, now) {
    if (!isSimulating()) return false;
    if (state.timeOfDay === "chuva") {
      const rp = rainGeo.attributes.position.array;
      for (let i = 0; i < rainCount; i++) {
        rp[i * 3 + 1] -= 28 * dt;
        if (rp[i * 3 + 1] < 0) {
          rp[i * 3] = player.pos.x + (Math.random() - 0.5) * 48;
          rp[i * 3 + 1] = 22 + Math.random() * 4;
          rp[i * 3 + 2] = player.pos.z + (Math.random() - 0.5) * 48;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
      if (now >= nextLightningAt) {
        nextLightningAt = now + 7000 + Math.random() * 8000;
        lightningOffAt = now + 130;
        sun.intensity = 3.2;
        clock.schedule(() => playTone("sawtooth", 65, 22, 0.7, 0.35), 350);
      }
      if (now > lightningOffAt) sun.intensity = 0.48;
    }
    if (state.csShopOpen) {
      const rem = Math.max(0, Math.ceil((state.csShopEndAt - now) / 1000));
      $("shopTimer").textContent = rem + "s";
      if (rem <= 0) startCSRound();
    }
    if (
      state.mode === "horda" &&
      state.hordaNextWaveAt > 0 &&
      now >= state.hordaNextWaveAt
    ) {
      state.hordaNextWaveAt = 0;
      state.hordaWave++;
      spawnHordaWave(state.hordaWave, now);
    }
    if (pingState.active && now > pingState.expiresAt) {
      pingState.active = false;
      pingGroup.visible = false;
    }
    if (now < player.uavActiveUntil) {
      uavGroup.visible = true;
      uavGroup.position.set(
        Math.cos(now * 0.0012) * 16,
        20,
        Math.sin(now * 0.0012) * 16 - 6,
      );
      uavGroup.rotation.y += 3 * dt;
    } else uavGroup.visible = false;
    if (playerChar.muzzleFlash.visible && now > state.flashOffAt) {
      playerChar.muzzleFlash.visible = false;
      muzzleLight.intensity = 0;
    }
    if (remoteChar.muzzleFlash.visible && now > remotePlayer.flashOffAt)
      remoteChar.muzzleFlash.visible = false;
    if (state.reloading && now >= state.reloadEnd) {
      state.reloading = false;
      state.ammo = WEAPONS[state.weaponKey].mag;
      updateAmmoUI();
      playReloadSound();
    }
    state.bloom = Math.max(0, state.bloom - 36 * dt);
    state.userDragUp = Math.max(0, state.userDragUp - 3.6 * dt);

    for (const b of barrels)
      if (!b.alive && state.mode === "treino" && now >= b.respawnAt) {
        b.alive = true;
        b.hp = 60;
        b.group.visible = true;
      }
    for (let i = landmines.length - 1; i >= 0; i--) {
      const m = landmines[i];
      if (now < m.armedAt) continue;
      let trig = false;
      if (!m.isRemote) {
        for (const e of enemies)
          if (e.alive && e.char.root.position.distanceTo(m.pos) < 1.35) {
            trig = true;
            break;
          }
        if (
          state.mode === "x1" &&
          remotePlayer.alive &&
          remoteChar.root.position.distanceTo(m.pos) < 1.35
        )
          trig = true;
      } else if (!player.dead && player.pos.distanceTo(m.pos) < 1.35)
        trig = true;
      if (trig) {
        disposeObject(m.group);
        landmines.splice(i, 1);
        explodeAt(m.pos.clone(), now, m.isRemote, "Mina 💥", 5.2);
      }
    }
    if (
      (state.mode === "treino" ||
        state.mode === "br" ||
        (state.mode === "cs" && state.csRound >= 2)) &&
      isPlaying()
    ) {
      if (!airdrop.active && now >= airdrop.nextSpawnAt) spawnAirdrop(now);
      if (airdrop.active && !airdrop.landed) {
        airdrop.pos.y -= 4.2 * dt;
        const fy = getFloorY(airdrop.pos.x, airdrop.pos.z, airdrop.pos.y + 1);
        if (airdrop.pos.y <= fy) {
          airdrop.pos.y = fy;
          airdrop.landed = true;
          chute.visible = false;
        }
      }
    }
    if (safeZone.active && isPlaying()) {
      safeZone.radius = Math.max(
        safeZone.minRadius,
        safeZone.radius - safeZone.shrinkSpeed * dt,
      );
      zoneMesh.scale.set(safeZone.radius, 1, safeZone.radius);
      const dZ = Math.hypot(
        player.pos.x - safeZone.centerX,
        player.pos.z - safeZone.centerZ,
      );
      state.outOfZone = dZ > safeZone.radius;
      $("scZoneTxt").textContent = state.outOfZone
        ? "FORA DA SAFE!"
        : `Safe: ${Math.round(safeZone.radius)}m`;
      $("scZoneTxt").style.color = state.outOfZone ? "#ff3b3b" : "#4ade80";
      if (state.outOfZone && !player.parachuting && now - lastZoneTick > 1000) {
        lastZoneTick = now;
        applyPlayerDamage(10, false, now);
      }
    } else state.outOfZone = false;

    for (let i = glooWalls.length - 1; i >= 0; i--)
      if (now - glooWalls[i].createdAt > 15000) {
        disposeObject(glooWalls[i].mesh);
        const idx = obstacles.indexOf(glooWalls[i]);
        if (idx >= 0) {
          obstacles.splice(idx, 1);
          obstacleRevision++;
        }
        glooWalls.splice(i, 1);
      }
    for (let i = smokeClouds.length - 1; i >= 0; i--) {
      const s = smokeClouds[i];
      s.group.rotation.y += 0.2 * dt;
      const rem = (s.expiresAt - now) / 1500;
      if (rem < 1) s.mat.opacity = Math.max(0, rem * 0.62);
      if (now >= s.expiresAt) {
        disposeObject(s.group);
        smokeClouds.splice(i, 1);
      }
    }
    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i];
      g.vel.y -= 16 * dt;
      const r = 0.14;
      let hw = false;
      g.pos.x += g.vel.x * dt;
      for (const o of obstacles)
        if (checkObstacleHit(g.pos, r, o)) {
          g.pos.x -= g.vel.x * dt;
          g.vel.x *= -0.5;
          hw = true;
          if (!g.impactExplode) playBounceSound();
          break;
        }
      g.pos.z += g.vel.z * dt;
      for (const o of obstacles)
        if (checkObstacleHit(g.pos, r, o)) {
          g.pos.z -= g.vel.z * dt;
          g.vel.z *= -0.5;
          hw = true;
          if (!g.impactExplode) playBounceSound();
          break;
        }
      g.pos.y += g.vel.y * dt;
      const fy = getFloorY(g.pos.x, g.pos.z, g.pos.y + 0.3);
      if (g.pos.y < fy + r) {
        g.pos.y = fy + r;
        hw = true;
        if (!g.impactExplode && Math.abs(g.vel.y) > 1.4) playBounceSound();
        g.vel.y = Math.abs(g.vel.y) * 0.42;
        g.vel.x *= 0.68;
        g.vel.z *= 0.68;
      }
      if (g.impactExplode && !g.fromRemote)
        for (const e of enemies)
          if (e.alive && e.char.root.position.distanceTo(g.pos) < 1.25)
            hw = true;
      g.mesh.position.copy(g.pos);
      if (now >= g.explodeAt || (g.impactExplode && hw)) {
        disposeObject(g.mesh);
        grenades.splice(i, 1);
        if (g.isSmoke) spawnSmokeCloud(g.pos, now, false);
        else
          explodeAt(
            g.pos,
            now,
            g.fromRemote,
            g.impactExplode ? "M79 💥" : "Granada",
          );
      }
    }
    for (const l of loots) l.mesh.rotation.y += 2.2 * dt;
    for (const d of dummies)
      if (now - d.dm.flashAt > 90) d.dm.char.torsoMat.color.setHex(0xf97316);
    for (const e of enemies) {
      if (!e.alive) {
        if (state.mode === "treino" && now >= e.respawnAt) {
          e.alive = true;
          e.hp = e.maxHp;
          e.helmHp = 80;
          e.vestHp = 100;
          e.healedBehindGel = false;
          e.char.helmet.visible = true;
          e.char.root.visible = true;
        }
        continue;
      }
      if (isPlaying()) {
        updateBotAI(e, dt, now);
        ArenaMotion.pose(e.char, dt, {
          grounded: true,
          walkTime: e.walkTime,
          aiming: state.botsShoot,
          pitch: 0,
        });
      }
    }

    if (state.mode === "x1" && remotePlayer.alive) {
      remotePlayer.prevPos.copy(remoteChar.root.position);
      remoteChar.root.position.lerp(
        remotePlayer.targetPos,
        1 - Math.exp(-25 * dt),
      );
      if (remoteChar.root.position.distanceTo(remotePlayer.prevPos) > 0.01) {
        remotePlayer.walkTime += dt * 11;
        remoteChar.leftLegPivot.rotation.x =
          Math.sin(remotePlayer.walkTime) * 0.55;
        remoteChar.rightLegPivot.rotation.x =
          -Math.sin(remotePlayer.walkTime) * 0.55;
      } else {
        remoteChar.leftLegPivot.rotation.x *= Math.exp(-14 * dt);
        remoteChar.rightLegPivot.rotation.x *= Math.exp(-14 * dt);
      }
      remoteChar.root.rotation.y = remotePlayer.yaw;
      remoteChar.bodyPivot.position.y +=
        ((remotePlayer.crouch ? -0.36 : 0) - remoteChar.bodyPivot.position.y) *
        0.3;
      remoteAlokRing.visible = remotePlayer.alok;
      if (remotePlayer.alok) {
        remoteAlokRing.position.set(
          remoteChar.root.position.x,
          remoteChar.root.position.y + 0.05,
          remoteChar.root.position.z,
        );
        remoteAlokRing.rotation.z += 2.2 * dt;
      }
      remoteChronoDome.visible = remotePlayer.chrono;
      if (remotePlayer.chrono)
        remoteChronoDome.position.set(
          remoteChar.root.position.x,
          remoteChar.root.position.y + 1.15,
          remoteChar.root.position.z,
        );
      ArenaMotion.pose(remoteChar, dt, {
        grounded: true,
        walkTime: remotePlayer.walkTime,
        aiming: remotePlayer.aimPitch > -50,
        pitch: remotePlayer.aimPitch > -50 ? remotePlayer.aimPitch : 0,
        akimbo: remotePlayer.weapon === "vector",
        emoting: remotePlayer.emote,
      });
      remoteChar.flagGroup.visible = remotePlayer.emote;
      remoteChar.currentGun.visible = !remotePlayer.emote;
      if (remotePlayer.emote)
        remoteChar.rightArmPivot.rotation.x =
          2.6 + Math.sin(now * 0.012) * 0.35;
      else if (remotePlayer.aimPitch > -50)
        remoteChar.rightArmPivot.rotation.x =
          Math.PI / 2 + remotePlayer.aimPitch;
      else remoteChar.rightArmPivot.rotation.x = 0.9;
    } else {
      remoteAlokRing.visible = false;
      remoteChronoDome.visible = false;
    }

    if (isPlaying() || (state.paused && state.mode === "x1" && conn?.open)) {
      updatePlayer(dt, now);
      updateCamera(dt);
      updateAimAssist(dt, now);
      updateCamera(0);
      ArenaMotion.pose(playerChar, dt, {
        grounded: player.onGround,
        pitch: state.camPitch,
        walkTime: player.walkTime,
        aiming: state.isScoped || state.isFiring,
        reloading: state.reloading,
        akimbo: !!WEAPONS[state.weaponKey].akimbo,
        emoting: now < player.emoteUntil,
        riding: player.inVehicle || player.onZipline || player.parachuting,
      });
      scene.updateMatrixWorld(true);
      if (state.isFiring || state.fireQueued) {
        fireWeapon(now);
        state.fireQueued = false;
      }
    } else updateCamera(dt);
    for (let i = tracers3d.length - 1; i >= 0; i--) {
      const t = tracers3d[i];
      t.alpha -= 6.5 * dt;
      t.mat.opacity = Math.max(0, t.alpha);
      if (t.alpha <= 0) {
        disposeObject(t.line);
        tracers3d.splice(i, 1);
      }
    }
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.life -= dt;
      s.scale += 18 * dt;
      s.mesh.scale.setScalar(s.scale);
      s.mat.opacity = Math.max(0, s.life * 2);
      if (s.life <= 0) {
        disposeObject(s.mesh);
        shockwaves.splice(i, 1);
      }
    }
    for (let i = particles3d.length - 1; i >= 0; i--) {
      const p = particles3d[i];
      p.life -= dt;
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mat.opacity = Math.max(0, p.life * 2);
      if (p.life <= 0) {
        releaseParticle(p);
        particles3d.splice(i, 1);
      }
    }
    return isSimulating();
  }

  // OVERLAY 2D
  function drawScopePNG(img) {
    if (!img.complete || img.naturalWidth === 0) return;
    const sc = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    fxCtx.drawImage(
      img,
      (W - img.naturalWidth * sc) / 2,
      (H - img.naturalHeight * sc) / 2,
      img.naturalWidth * sc,
      img.naturalHeight * sc,
    );
  }
  function drawMiniRadar(now) {
    const rX = 76,
      rY = 76,
      R = 52,
      maxR = 42;
    fxCtx.save();
    fxCtx.beginPath();
    fxCtx.arc(rX, rY, R, 0, Math.PI * 2);
    fxCtx.fillStyle = "rgba(11,16,25,0.8)";
    fxCtx.fill();
    fxCtx.lineWidth = 2;
    fxCtx.strokeStyle = "rgba(255,255,255,0.25)";
    fxCtx.stroke();
    fxCtx.clip();
    fxCtx.fillStyle = "rgba(255,190,46,0.14)";
    fxCtx.beginPath();
    fxCtx.moveTo(rX, rY);
    fxCtx.arc(rX, rY, R, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
    fxCtx.closePath();
    fxCtx.fill();
    const sy = Math.sin(state.camYaw),
      cy = Math.cos(state.camYaw);
    const dot = (wx, wz, col, sz = 3.8, lf = -1e4) => {
      const rx = wx - player.pos.x,
        rz = wz - player.pos.z,
        px = rX + ((rx * cy - rz * sy) / maxR) * R,
        py = rY - ((rx * -sy - rz * cy) / maxR) * R;
      if (now - lf < 500 || now < player.uavActiveUntil) {
        const p =
          now < player.uavActiveUntil ? (now % 900) / 900 : (now - lf) / 500;
        fxCtx.strokeStyle = `rgba(255,59,59,${1 - p})`;
        fxCtx.lineWidth = 2;
        fxCtx.beginPath();
        fxCtx.arc(px, py, 4 + p * 10, 0, Math.PI * 2);
        fxCtx.stroke();
      }
      fxCtx.fillStyle = col;
      fxCtx.beginPath();
      fxCtx.arc(px, py, sz, 0, Math.PI * 2);
      fxCtx.fill();
    };
    if (airdrop.active) dot(airdrop.pos.x, airdrop.pos.z, "#facc15", 4.2);
    if (pingState.active) dot(pingState.pos.x, pingState.pos.z, "#38bdf8", 4.5);
    for (const e of enemies)
      if (e.alive)
        dot(
          e.char.root.position.x,
          e.char.root.position.z,
          e.isBoss ? "#f97316" : "#ff3b3b",
          e.isBoss ? 5.2 : 3.8,
          e.lastFiredAt,
        );
    if (state.mode === "x1" && remotePlayer.alive)
      dot(
        remoteChar.root.position.x,
        remoteChar.root.position.z,
        "#ff3b3b",
        4.5,
        remotePlayer.lastFiredAt,
      );
    fxCtx.fillStyle = "#38bdf8";
    fxCtx.beginPath();
    fxCtx.arc(rX, rY, 4.5, 0, Math.PI * 2);
    fxCtx.fill();
    fxCtx.restore();
  }
  function drawTargetBar(pos, hp, maxHp, locked, label = "") {
    const top = new THREE.Vector3(pos.x, pos.y + 2.08, pos.z);
    if (top.clone().sub(camera.position).dot(camForward) <= 0) return;
    const p = top.project(camera);
    if (p.z > 1) return;
    const sx = (p.x * 0.5 + 0.5) * W,
      syP = (-p.y * 0.5 + 0.5) * H;
    fxCtx.fillStyle = "rgba(0,0,0,0.7)";
    fxCtx.fillRect(sx - 23, syP, 46, 6);
    fxCtx.fillStyle = locked ? "#ff3b3b" : "#4ade80";
    fxCtx.fillRect(sx - 23, syP, 46 * Math.max(0, hp / maxHp), 6);
    if (locked || label) {
      fxCtx.font = "700 11px Segoe UI, sans-serif";
      fxCtx.textAlign = "center";
      fxCtx.fillStyle = "#fff";
      fxCtx.fillText(
        label || `${Math.round(pos.distanceTo(player.pos))}m`,
        sx,
        syP - 5,
      );
    }
  }

  function draw2DOverlay(now, dt) {
    fxCtx.clearRect(0, 0, W, H);
    if (state.outOfZone && !player.dead && isPlaying()) {
      const g = fxCtx.createRadialGradient(
        CX,
        CY,
        Math.min(W, H) * 0.3,
        CX,
        CY,
        Math.max(W, H) * 0.65,
      );
      g.addColorStop(0, "rgba(147,51,234,0)");
      g.addColorStop(
        1,
        `rgba(147,51,234,${0.22 + Math.sin(now * 0.008) * 0.1})`,
      );
      fxCtx.fillStyle = g;
      fxCtx.fillRect(0, 0, W, H);
    }
    const fast =
      player.sprinting ||
      player.parachuting ||
      player.onZipline ||
      now < player.dashUntil ||
      (player.inVehicle && Math.abs(buggy.speed) > 14);
    if (fast && isPlaying()) {
      fxCtx.save();
      fxCtx.strokeStyle = "rgba(255,255,255,0.12)";
      fxCtx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + now * 0.002,
          r1 = Math.min(W, H) * 0.42,
          r2 = Math.max(W, H) * 0.68;
        fxCtx.beginPath();
        fxCtx.moveTo(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1);
        fxCtx.lineTo(CX + Math.cos(a) * r2, CY + Math.sin(a) * r2);
        fxCtx.stroke();
      }
      fxCtx.restore();
    }
    if (now - player.damageFlashAt < 260) {
      fxCtx.fillStyle = `rgba(255,20,20,${(1 - (now - player.damageFlashAt) / 260) * 0.35})`;
      fxCtx.fillRect(0, 0, W, H);
    }

    const sy = Math.sin(state.camYaw),
      cy = Math.cos(state.camYaw);
    for (let i = damageDirs.length - 1; i >= 0; i--) {
      const age = (now - damageDirs[i].time) / 1100;
      if (age >= 1) {
        damageDirs.splice(i, 1);
        continue;
      }
      const rx = damageDirs[i].pos.x - player.pos.x,
        rz = damageDirs[i].pos.z - player.pos.z,
        ang = Math.atan2(-(rx * -sy - rz * cy), rx * cy - rz * sy);
      fxCtx.save();
      fxCtx.globalAlpha = 1 - age;
      fxCtx.strokeStyle = "#ff2a2a";
      fxCtx.lineWidth = 7;
      fxCtx.beginPath();
      fxCtx.arc(CX, CY, 118, ang - 0.32, ang + 0.32);
      fxCtx.stroke();
      fxCtx.restore();
    }
    drawMiniRadar(now);

    if (pingState.active) {
      const pTop = pingState.pos.clone().add(new THREE.Vector3(0, 1.8, 0));
      if (pTop.clone().sub(camera.position).dot(camForward) > 0) {
        const pr = pTop.project(camera);
        if (pr.z <= 1) {
          fxCtx.font = "800 13px Segoe UI, sans-serif";
          fxCtx.textAlign = "center";
          fxCtx.fillStyle = "#38bdf8";
          fxCtx.fillText(
            `📍 ${Math.round(pingState.pos.distanceTo(player.pos))}m`,
            (pr.x * 0.5 + 0.5) * W,
            (-pr.y * 0.5 + 0.5) * H,
          );
        }
      }
    }
    if (now < player.uavActiveUntil) {
      const list = enemies
        .filter((e) => e.alive)
        .map((e) => e.char.root.position);
      if (state.mode === "x1" && remotePlayer.alive)
        list.push(remoteChar.root.position);
      for (const p of list) {
        const ch = p.clone().add(new THREE.Vector3(0, 1.2, 0));
        if (ch.clone().sub(camera.position).dot(camForward) <= 0) continue;
        const pr = ch.project(camera);
        if (pr.z > 1) continue;
        const sx = (pr.x * 0.5 + 0.5) * W,
          syP = (-pr.y * 0.5 + 0.5) * H;
        fxCtx.strokeStyle = "#facc15";
        fxCtx.lineWidth = 2;
        fxCtx.beginPath();
        fxCtx.moveTo(sx, syP - 10);
        fxCtx.lineTo(sx + 10, syP);
        fxCtx.lineTo(sx, syP + 10);
        fxCtx.lineTo(sx - 10, syP);
        fxCtx.closePath();
        fxCtx.stroke();
      }
    }
    if (state.mode === "treino")
      for (const d of dummies) {
        const top = new THREE.Vector3(
          d.dm.char.root.position.x,
          2.25,
          d.dm.char.root.position.z,
        );
        if (top.clone().sub(camera.position).dot(camForward) <= 0) continue;
        const p = top.project(camera);
        if (p.z > 1) continue;
        const sx = (p.x * 0.5 + 0.5) * W,
          syP = (-p.y * 0.5 + 0.5) * H;
        fxCtx.font = "700 12px Segoe UI, sans-serif";
        fxCtx.textAlign = "center";
        fxCtx.fillStyle = "rgba(0,0,0,.65)";
        fxCtx.fillRect(sx - 46, syP - 14, 92, 20);
        fxCtx.fillStyle = "#ffbe2e";
        fxCtx.fillText(
          now - d.dm.lastHitAt < 2500
            ? `${d.dm.label} • ${d.dm.comboDmg}`
            : d.dm.label,
          sx,
          syP,
        );
      }
    for (const e of enemies)
      if (
        e.alive &&
        (state.targetInCone === e.char.root.position ||
          now - e.damagedAt <= 3000 ||
          e.isBoss)
      )
        drawTargetBar(
          e.char.root.position,
          e.hp,
          e.maxHp,
          state.targetInCone === e.char.root.position,
          e.isBoss ? "TITÃ 👹" : "",
        );
    if (
      state.mode === "x1" &&
      remotePlayer.alive &&
      (state.targetInCone === remoteChar.root.position ||
        now - remotePlayer.damagedAt < 3000)
    )
      drawTargetBar(
        remoteChar.root.position,
        remotePlayer.hp,
        remotePlayer.maxHp,
        state.targetInCone === remoteChar.root.position,
      );

    for (let i = floatingNums.length - 1; i >= 0; i--) {
      const f = floatingNums[i];
      f.worldPos.y += f.vy * dt;
      f.alpha -= 1.25 * dt;
      if (f.alpha <= 0) {
        floatingNums.splice(i, 1);
        continue;
      }
      const pr = f.worldPos.clone().project(camera);
      if (pr.z > 1) continue;
      const sx = (pr.x * 0.5 + 0.5) * W,
        syP = (-pr.y * 0.5 + 0.5) * H;
      fxCtx.save();
      fxCtx.globalAlpha = Math.max(0, f.alpha);
      fxCtx.font = f.isHead
        ? "900 28px Segoe UI, sans-serif"
        : "800 18px Segoe UI, sans-serif";
      fxCtx.textAlign = "center";
      fxCtx.strokeStyle = "rgba(0,0,0,.85)";
      fxCtx.lineWidth = 4;
      fxCtx.strokeText(f.text, sx, syP);
      fxCtx.fillStyle = f.isHead ? "#ff2a2a" : "#ffd166";
      fxCtx.fillText(f.text, sx, syP);
      fxCtx.restore();
    }
    if (state.isScoped)
      drawScopePNG(state.weaponKey === "awm" ? imgMira4x : imgMira2x);

    if (!player.inVehicle && !player.parachuting && !player.onZipline) {
      if (state.aimMode !== "total") {
        const r =
          WEAPONS[state.weaponKey].assistPx * (state.isScoped ? 1.15 : 1);
        fxCtx.strokeStyle = state.targetInCone
          ? "rgba(255,59,59,.25)"
          : "rgba(255,255,255,.08)";
        fxCtx.lineWidth = 1;
        fxCtx.beginPath();
        fxCtx.arc(CX, CY, r, 0, Math.PI * 2);
        fxCtx.stroke();
      }
      const col = state.targetInCone ? "#ff3333" : "#ffffff",
        gap = (state.isScoped ? 5 : 9) + state.bloom * 0.85,
        len = state.isScoped ? 14 : 11;
      fxCtx.strokeStyle = col;
      fxCtx.lineWidth = 2.4;
      fxCtx.beginPath();
      fxCtx.moveTo(CX, CY - gap);
      fxCtx.lineTo(CX, CY - gap - len);
      fxCtx.moveTo(CX, CY + gap);
      fxCtx.lineTo(CX, CY + gap + len);
      fxCtx.moveTo(CX - gap, CY);
      fxCtx.lineTo(CX - gap - len, CY);
      fxCtx.moveTo(CX + gap, CY);
      fxCtx.lineTo(CX + gap + len, CY);
      fxCtx.stroke();
      fxCtx.fillStyle = col;
      fxCtx.beginPath();
      fxCtx.arc(CX, CY, 2.3, 0, Math.PI * 2);
      fxCtx.fill();
    }
    if (player.healing || state.reloading || arsenal.prog > 0) {
      const prog =
        arsenal.prog > 0
          ? arsenal.prog
          : Math.max(
              0,
              Math.min(
                1,
                1 -
                  ((player.healing ? player.healEnd : state.reloadEnd) - now) /
                    (player.healing ? 2000 : WEAPONS[state.weaponKey].reload),
              ),
            );
      fxCtx.strokeStyle =
        arsenal.prog > 0 ? "#38bdf8" : player.healing ? "#4ade80" : "#ffbe2e";
      fxCtx.lineWidth = 3.5;
      fxCtx.beginPath();
      fxCtx.arc(
        CX,
        CY + 42,
        14,
        -Math.PI / 2,
        -Math.PI / 2 + prog * Math.PI * 2,
      );
      fxCtx.stroke();
      if (arsenal.prog > 0) {
        fxCtx.font = "800 12px Segoe UI, sans-serif";
        fxCtx.textAlign = "center";
        fxCtx.fillStyle = "#38bdf8";
        fxCtx.fillText("ABRINDO ARSENAL...", CX, CY + 72);
      }
    }
    const ka = (now - state.killBadgeAt) / 1000;
    if (ka >= 0 && ka < 1.1) {
      fxCtx.save();
      fxCtx.globalAlpha = ka > 0.7 ? (1.1 - ka) / 0.4 : 1;
      fxCtx.translate(CX, CY + 85 - ka * 14);
      fxCtx.scale(
        ka < 0.15 ? 0.6 + (ka / 0.15) * 0.5 : 1.1,
        ka < 0.15 ? 0.6 + (ka / 0.15) * 0.5 : 1.1,
      );
      fxCtx.fillStyle = state.killBadgeHead
        ? "rgba(220,38,38,.9)"
        : "rgba(217,119,6,.9)";
      fxCtx.beginPath();
      fxCtx.arc(0, 0, 20, 0, Math.PI * 2);
      fxCtx.fill();
      fxCtx.strokeStyle = "#ffbe2e";
      fxCtx.lineWidth = 2.5;
      fxCtx.stroke();
      fxCtx.font = "900 18px Segoe UI, sans-serif";
      fxCtx.textAlign = "center";
      fxCtx.textBaseline = "middle";
      fxCtx.fillStyle = "#fff";
      fxCtx.fillText(state.killBadgeHead ? "🎯" : "💀", 0, 1);
      fxCtx.restore();
    }
    if (now - state.hitmarkerAt < 120) {
      fxCtx.strokeStyle = state.hitmarkerHead ? "#ff2a2a" : "#ffbe2e";
      fxCtx.lineWidth = state.hitmarkerHead ? 3 : 2;
      const hm = state.hitmarkerHead ? 16 : 11;
      fxCtx.beginPath();
      fxCtx.moveTo(CX - hm, CY - hm);
      fxCtx.lineTo(CX - 5, CY - 5);
      fxCtx.moveTo(CX + hm, CY - hm);
      fxCtx.lineTo(CX + 5, CY - 5);
      fxCtx.moveTo(CX - hm, CY + hm);
      fxCtx.lineTo(CX - 5, CY + 5);
      fxCtx.moveTo(CX + hm, CY + hm);
      fxCtx.lineTo(CX + 5, CY + 5);
      fxCtx.stroke();
    }
  }

  requestAnimationFrame(animate);
})();

/* Lobby preview, accessible dialogs, and browser-only controls. */
window.ArenaUI = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let noticeTimer;
  function notice(message) {
    $("appNotice").textContent = message;
    $("appNotice").classList.remove("hidden");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(
      () => $("appNotice").classList.add("hidden"),
      4500,
    );
  }
  function fatal(message) {
    $("bootErrorText").textContent = message;
    $("bootError").classList.remove("hidden");
  }
  function init({
    THREE,
    state,
    playerChar,
    createCharacter,
    applyQuality,
    persistSave,
    pauseGame,
    resumeGame,
    restartGame,
    leaveGame,
  }) {
    const settings = $("settingsPanel"),
      settingsHome = settings.parentElement;
    const previewRenderer = new THREE.WebGLRenderer({
      canvas: $("avatarPreview"),
      alpha: true,
      antialias: true,
    });
    previewRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const previewScene = new THREE.Scene(),
      previewCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    previewCamera.position.set(0, 1.1, 4.9);
    previewCamera.lookAt(0, 1.04, 0);
    previewScene.add(new THREE.HemisphereLight(0xf7f8ff, 0x50558b, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.65);
    key.position.set(-3, 5, 4);
    previewScene.add(key);
    const avatar = createCharacter({
      shirtColor: parseInt(state.shirtColor),
      pantsColor: 0x142036,
      hatColor: parseInt(state.hatColor),
      skinTone: parseInt(state.skinTone),
      backpack: true,
    });
    avatar.root.rotation.y = Math.PI - 0.38;
    avatar.leftArmPivot.rotation.x = -0.08;
    avatar.rightArmPivot.rotation.x = -0.15;
    avatar.currentGun.visible = false;
    avatar.root.position.y = 0.08;
    previewScene.add(avatar.root);
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.72, 0.13, 8),
      new THREE.MeshStandardMaterial({ color: 0x8192ff, roughness: 0.9 }),
    );
    plinth.position.y = -0.03;
    previewScene.add(plinth);
    let previewDirty = true;
    function renderPreview() {
      if (
        !$("overlay").classList.contains("hidden") &&
        !document.hidden &&
        previewDirty
      ) {
        const bounds = $("avatarPreview").getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        previewRenderer.setSize(bounds.width, bounds.height, false);
        previewCamera.aspect = bounds.width / bounds.height;
        previewCamera.updateProjectionMatrix();
        previewRenderer.render(previewScene, previewCamera);
        previewDirty = false;
      }
    }
    function refreshAvatar() {
      for (const character of [avatar, playerChar]) {
        character.torsoMat.color.setHex(parseInt(state.shirtColor));
        character.armMat.color.setHex(parseInt(state.shirtColor));
        character.skinMat.color.setHex(parseInt(state.skinTone));
        character.hatMat.color.setHex(parseInt(state.hatColor));
        character.helmet.visible = state.hatStyle !== "none";
      }
      previewDirty = true;
      renderPreview();
    }
    for (const [id, property] of [
      ["skinToneSel", "skinTone"],
      ["hatStyleSel", "hatStyle"],
      ["hatColorSel", "hatColor"],
    ]) {
      $(id).value = state[property];
      $(id).addEventListener("change", () => {
        state[property] = $(id).value;
        refreshAvatar();
        persistSave();
      });
    }
    $("skinColorSel").addEventListener("change", refreshAvatar);
    function quality(value) {
      applyQuality(value);
      $("qualitySel").value = $("qualityPause").value = state.quality;
      persistSave();
      previewDirty = true;
    }
    $("qualitySel").value = $("qualityPause").value = state.quality;
    for (const id of ["qualitySel", "qualityPause"])
      $(id).addEventListener("change", (event) => quality(event.target.value));
    async function fullscreen() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen)
          await document.documentElement.requestFullscreen();
        else notice("Tela cheia não está disponível neste navegador.");
      } catch {
        notice(
          "O navegador bloqueou a tela cheia. Tente novamente pelo botão.",
        );
      }
    }
    for (const id of ["btnFullscreenLobby", "btnFullscreenPause"])
      $(id).onclick = fullscreen;
    $("btnResume").onclick = resumeGame;
    $("btnRestart").onclick = restartGame;
    $("btnExitLobby").onclick = leaveGame;
    let controlsTrigger;
    function controls(event) {
      controlsTrigger = event.currentTarget;
      $("controlsModal").classList.remove("hidden");
      $("btnCloseControls").focus();
    }
    $("btnControlsLobby").onclick = $("btnControlsPause").onclick = controls;
    $("btnCloseControls").onclick = () => {
      $("controlsModal").classList.add("hidden");
      controlsTrigger?.focus();
    };
    document.addEventListener(
      "keydown",
      (event) => {
        if (
          !$("controlsModal").classList.contains("hidden") &&
          event.code === "Escape"
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          $("btnCloseControls").click();
        }
        if (event.code !== "Tab") return;
        const modal = ["controlsModal", "pauseModal"]
          .map($)
          .find((item) => !item.classList.contains("hidden"));
        if (!modal) return;
        const focusable = [
          ...modal.querySelectorAll('button,select,input,[tabindex="0"]'),
        ].filter((item) => !item.disabled && item.getClientRects().length);
        if (!focusable.length) return;
        const first = focusable[0],
          last = focusable.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !modal.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !modal.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      },
      true,
    );
    const canvas = $("avatarPreview");
    let drag;
    canvas.addEventListener("pointerdown", (event) => {
      drag = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (drag === undefined) return;
      avatar.root.rotation.y += (event.clientX - drag) * 0.012;
      drag = event.clientX;
      previewDirty = true;
      renderPreview();
    });
    canvas.addEventListener("pointerup", () => {
      drag = undefined;
    });
    canvas.addEventListener("pointercancel", () => {
      drag = undefined;
    });
    new ResizeObserver(() => {
      previewDirty = true;
      renderPreview();
    }).observe(canvas);
    addEventListener(
      "pagehide",
      () => {
        previewRenderer.dispose();
      },
      { once: true },
    );
    refreshAvatar();
    if (matchMedia("(pointer: coarse)").matches)
      $("playHint").textContent =
        "Esta edição usa teclado e mouse. Controles de toque ainda não estão disponíveis.";
    return {
      lobby() {
        document.body.classList.add("in-lobby");
        document.body.classList.remove("menu-open");
        settingsHome.prepend(settings);
        settings.classList.remove("open");
        previewDirty = true;
        renderPreview();
      },
      playing() {
        document.body.classList.remove("in-lobby", "menu-open");
        settingsHome.prepend(settings);
        settings.classList.remove("open");
      },
      pause(online) {
        $("pauseNote").textContent = online
          ? "O X1 online continua enquanto o menu estiver aberto."
          : "Partida pausada. Seu progresso nesta partida está preservado.";
        document.body.classList.add("menu-open");
        $("pauseSettingsHost").append(settings);
        settings.classList.add("open");
        $("btnResume").focus();
      },
      renderPreview,
      refreshAvatar,
    };
  }
  return { init, notice, fatal };
})();

/* Physical keys are translated to the game's logical actions at the input boundary. */
window.ArenaControls = (() => {
  "use strict";
  const actions = [
    ["forward", "Avançar", "KeyW", "Movimento"],
    ["backward", "Recuar", "KeyS", "Movimento"],
    ["left", "Esquerda", "KeyA", "Movimento"],
    ["right", "Direita", "KeyD", "Movimento"],
    ["sprint", "Correr", "ShiftLeft", "Movimento"],
    ["jump", "Pular", "Space", "Movimento"],
    ["crouch", "Agachar", "KeyC", "Movimento"],
    ["freeLook", "Olhar livre", "AltLeft", "Movimento"],
    ["fire", "Atirar pelo teclado", "KeyF", "Combate"],
    ["reload", "Recarregar", "KeyR", "Combate"],
    ["previous", "Arma anterior", "KeyQ", "Combate"],
    ["shoulder", "Trocar ombro", "KeyU", "Combate"],
    ["gel", "Parede de gel", "KeyG", "Equipamentos"],
    ["crouchGel", "Gel agachado", "KeyV", "Equipamentos"],
    ["medkit", "Kit de cura", "KeyE", "Equipamentos"],
    ["inhaler", "Inalador", "KeyI", "Equipamentos"],
    ["grenade", "Granada (segurar e soltar)", "KeyT", "Equipamentos"],
    ["mine", "Mina", "KeyM", "Equipamentos"],
    ["smoke", "Fumaça", "KeyX", "Equipamentos"],
    ["skill", "Habilidade", "KeyZ", "Equipamentos"],
    ["uav", "VANT", "KeyK", "Equipamentos"],
    ["interact", "Interagir", "Enter", "Atalhos"],
    ["emote", "Emote", "KeyB", "Atalhos"],
    ["menu", "Abrir / fechar menu", "KeyP", "Atalhos"],
    ["settings", "Abrir ajustes", "KeyH", "Atalhos"],
    ...Array.from({ length: 10 }, (_, i) => [
      "weapon" + ((i + 1) % 10),
      "Arma " + ((i + 1) % 10),
      "Digit" + ((i + 1) % 10),
      "Armas",
    ]),
    ["weaponVector", "Vector dupla", "KeyY", "Armas"],
  ].map(([id, label, canonical, group]) => ({ id, label, canonical, group }));
  const defaults = Object.fromEntries(
    actions.map((action) => [action.id, action.canonical]),
  );
  const aliases = {
    ArrowUp: "KeyW",
    ArrowDown: "KeyS",
    ArrowLeft: "KeyA",
    ArrowRight: "KeyD",
    ShiftRight: "ShiftLeft",
    ControlLeft: "KeyC",
    AltRight: "AltLeft",
  };
  const allowed = (code) =>
    typeof code === "string" &&
    /^(Key[A-Z]|Digit[0-9]|Space|Enter|Backspace|CapsLock|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Arrow(Up|Down|Left|Right)|Insert|Delete|Home|End|PageUp|PageDown)$/.test(
      code,
    );
  function label(code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    return (
      {
        Space: "Espaço",
        Enter: "Enter",
        ShiftLeft: "Shift E",
        ShiftRight: "Shift D",
        ControlLeft: "Ctrl E",
        ControlRight: "Ctrl D",
        AltLeft: "Alt E",
        AltRight: "Alt D",
        ArrowUp: "↑",
        ArrowDown: "↓",
        ArrowLeft: "←",
        ArrowRight: "→",
        Backspace: "⌫",
        CapsLock: "Caps",
        PageUp: "PgUp",
        PageDown: "PgDn",
      }[code] || code
    );
  }
  class Bindings {
    constructor(saved) {
      this.values = { ...defaults };
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        const candidate = actions.map((action) => saved[action.id]);
        if (
          candidate.every(allowed) &&
          new Set(candidate).size === actions.length
        )
          this.values = Object.fromEntries(
            actions.map((action, i) => [action.id, candidate[i]]),
          );
      }
    }
    snapshot() {
      return { ...this.values };
    }
    replace(saved) {
      this.values = new Bindings(saved).snapshot();
    }
    label(id) {
      return label(this.values[id] || "");
    }
    resolve(code) {
      const action = actions.find((action) => this.values[action.id] === code);
      return action?.canonical || aliases[code] || null;
    }
    sync(keys, pressed) {
      for (const action of actions) keys[action.canonical] = false;
      for (const physical of pressed) {
        const logical = this.resolve(physical);
        if (logical) keys[logical] = true;
      }
    }
    bind(id, code) {
      if (!actions.some((action) => action.id === id) || !allowed(code))
        return {
          ok: false,
          message: "Escolha uma tecla simples. Esc fica reservado para o menu.",
        };
      const conflict = actions.find(
        (action) => action.id !== id && this.values[action.id] === code,
      );
      if (conflict)
        return {
          ok: false,
          message: `${label(code)} já está em “${conflict.label}”. Escolha outra tecla.`,
        };
      this.values[id] = code;
      return { ok: true };
    }
    reset() {
      this.values = { ...defaults };
    }
  }
  return { actions, Bindings, label };
})();

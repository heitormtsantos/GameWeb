window.ArenaControlsUI = (() => {
  "use strict";
  function init(bindings, onChange) {
    const list = document.getElementById("keybindingsList"),
      status = document.getElementById("bindingStatus");
    const buttons = new Map();
    let capturing = null;
    function refresh() {
      for (const [id, button] of buttons) {
        button.textContent =
          capturing === id ? "Pressione…" : bindings.label(id);
        button.classList.toggle("capturing", capturing === id);
        button.setAttribute(
          "aria-label",
          `Alterar tecla: ${ArenaControls.actions.find((action) => action.id === id).label}, ${bindings.label(id)}`,
        );
      }
    }
    function cancel() {
      capturing = null;
      status.textContent =
        "Clique numa tecla para alterar. Esc sempre abre o menu.";
      refresh();
    }
    for (const group of [
      ...new Set(ArenaControls.actions.map((action) => action.group)),
    ]) {
      const section = document.createElement("details");
      section.open = group === "Movimento";
      const title = document.createElement("summary");
      title.textContent = group;
      section.append(title);
      const grid = document.createElement("div");
      grid.className = "binding-grid";
      section.append(grid);
      for (const action of ArenaControls.actions.filter(
        (action) => action.group === group,
      )) {
        const row = document.createElement("div"),
          text = document.createElement("span"),
          button = document.createElement("button");
        row.className = "binding-row";
        text.textContent = action.label;
        button.type = "button";
        button.className = "binding-key";
        button.dataset.action = action.id;
        button.onclick = () => {
          capturing = action.id;
          status.textContent = `Pressione a nova tecla para “${action.label}”. Esc cancela.`;
          refresh();
        };
        buttons.set(action.id, button);
        row.append(text, button);
        grid.append(row);
      }
      list.append(section);
    }
    window.addEventListener(
      "keydown",
      (event) => {
        if (
          !capturing ||
          document.getElementById("controlsModal").classList.contains("hidden")
        )
          return;
        if (event.code === "Tab") {
          cancel();
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat) return;
        if (event.code === "Escape") {
          cancel();
          return;
        }
        const result = bindings.bind(capturing, event.code);
        if (!result.ok) {
          status.textContent = result.message;
          return;
        }
        const action = capturing;
        capturing = null;
        onChange();
        refresh();
        buttons.get(action).focus();
        status.textContent = "Tecla salva neste navegador.";
      },
      true,
    );
    document.getElementById("btnResetBindings").onclick = () => {
      bindings.reset();
      cancel();
      onChange();
      status.textContent = "Teclas padrão restauradas.";
    };
    cancel();
    return { cancel, refresh };
  }
  return { init };
})();

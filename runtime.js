/* Infrastructure shared by the game. No gameplay rules live here. */
window.ArenaRuntime = (() => {
  "use strict";
  function loadSave(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    } catch {
      return {};
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  function number(value, fallback, min, max) {
    return typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  }
  function choice(value, options, fallback) {
    return options.includes(value) ? value : fallback;
  }
  class SimulationClock {
    constructor() {
      this.now = 10000;
      this.lastReal = performance.now();
      this.tasks = new Map();
      this.nextId = 0;
    }
    advance(real, active) {
      const dt = Math.max(0, Math.min(0.05, (real - this.lastReal) / 1000));
      this.lastReal = real;
      if (!active) return 0;
      this.now += dt * 1000;
      for (const [id, task] of [...this.tasks]) {
        if (this.tasks.has(id) && task.at <= this.now) {
          this.tasks.delete(id);
          task.fn();
        }
      }
      return dt;
    }
    schedule(fn, ms) {
      const id = ++this.nextId;
      this.tasks.set(id, { fn, at: this.now + ms });
      return id;
    }
    clear() {
      this.tasks.clear();
    }
  }
  // Shared buffers/materials are explicitly marked. Never free a resource still in use.
  function shared(resource) {
    resource.userData = resource.userData || {};
    resource.userData.arenaShared = true;
    return resource;
  }
  function disposeObject(root) {
    if (!root) return;
    if (root.parent) root.parent.remove(root);
    const geometries = new Set(),
      materials = new Set();
    root.traverse((node) => {
      if (node.geometry && !node.geometry.userData.arenaShared)
        geometries.add(node.geometry);
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material]) {
        if (material && !material.userData.arenaShared) materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
  const presets = {
    low: {
      label: "Leve",
      pixelRatio: 1,
      shadows: false,
      shadowSize: 512,
      particles: 48,
    },
    medium: {
      label: "Equilibrado",
      pixelRatio: 1.25,
      shadows: true,
      shadowSize: 1024,
      particles: 96,
    },
    high: {
      label: "Detalhado",
      pixelRatio: 1.75,
      shadows: true,
      shadowSize: 2048,
      particles: 180,
    },
  };
  return {
    loadSave,
    save,
    number,
    choice,
    SimulationClock,
    shared,
    disposeObject,
    presets,
  };
})();

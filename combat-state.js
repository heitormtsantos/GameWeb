/* Each weapon owns its magazine. Equipping never grants ammunition. */
window.ArenaCombat = (() => {
  "use strict";
  class Magazines {
    constructor(weapons) {
      this.weapons = weapons;
      this.reset();
    }
    reset() {
      this.amounts = Object.fromEntries(
        Object.entries(this.weapons).map(([key, weapon]) => [key, weapon.mag]),
      );
    }
    read(key) {
      return this.amounts[key] ?? 0;
    }
    write(key, value) {
      if (!Object.prototype.hasOwnProperty.call(this.weapons, key)) return;
      this.amounts[key] = Number.isFinite(value)
        ? Math.max(0, Math.min(this.weapons[key].mag, Math.floor(value)))
        : 0;
    }
  }
  return { Magazines };
})();

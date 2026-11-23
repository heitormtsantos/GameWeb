/* One save contract shared by the browser and API. Casual stats are client-reported. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ArenaSave = factory();
})(globalThis, () => {
  "use strict";
  const numeric = {
    sens: [1, 0.3, 2.5],
    redDotSens: [0.9, 0.3, 2.5],
    sens2x: [0.8, 0.2, 2],
    sens4x: [0.7, 0.2, 2],
    assistStrength: [1, 0, 1.5],
  };
  const choices = {
    aimMode: ["padrao", "precisa", "total"],
    shirtColor: ["0x2563eb", "0xdc2626", "0xd97706", "0x7c3aed", "0x15803d"],
    evoSkin: ["padrao", "dragao", "cobra", "trovao"],
    skill: ["alok", "chrono", "tatsuya"],
    pet: ["panda", "waggor", "falcao", "none"],
    timeOfDay: ["dia", "tarde", "noite", "chuva"],
    skinTone: ["0xf3c59d", "0xd99c70", "0x8d5a3a", "0xffda64"],
    hatStyle: ["cap", "none"],
    hatColor: ["0xffcf4a", "0xf3f0e7", "0x142036"],
    quality: ["medium", "low", "high"],
  };
  const defaultKeys = {
    forward: "KeyW",
    backward: "KeyS",
    left: "KeyA",
    right: "KeyD",
    sprint: "ShiftLeft",
    jump: "Space",
    crouch: "KeyC",
    freeLook: "AltLeft",
    fire: "KeyF",
    reload: "KeyR",
    previous: "KeyQ",
    shoulder: "KeyU",
    gel: "KeyG",
    crouchGel: "KeyV",
    medkit: "KeyE",
    inhaler: "KeyI",
    grenade: "KeyT",
    mine: "KeyM",
    smoke: "KeyX",
    skill: "KeyZ",
    uav: "KeyK",
    interact: "Enter",
    emote: "KeyB",
    menu: "KeyP",
    settings: "KeyH",
    weapon1: "Digit1",
    weapon2: "Digit2",
    weapon3: "Digit3",
    weapon4: "Digit4",
    weapon5: "Digit5",
    weapon6: "Digit6",
    weapon7: "Digit7",
    weapon8: "Digit8",
    weapon9: "Digit9",
    weapon0: "Digit0",
    weaponVector: "KeyY",
  };
  const keyPattern =
    "^(Key[A-Z]|Digit[0-9]|Space|Enter|Backspace|CapsLock|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Arrow(Up|Down|Left|Right)|Insert|Delete|Home|End|PageUp|PageDown)$";
  const counts = ["totalKills", "totalCapas", "totalBooyahs", "boomKills"];
  const properties = {
    schemaVersion: { const: 1 },
    bonusPts: { type: "integer", minimum: 0, maximum: 600 },
  };
  for (const [key, [, minimum, maximum]] of Object.entries(numeric))
    properties[key] = { type: "number", minimum, maximum };
  for (const [key, values] of Object.entries(choices))
    properties[key] = { type: "string", enum: values };
  for (const key of counts)
    properties[key] = { type: "integer", minimum: 0, maximum: 1e9 };
  properties.keyBindings = {
    type: "object",
    additionalProperties: false,
    required: Object.keys(defaultKeys),
    properties: Object.fromEntries(
      Object.keys(defaultKeys).map((key) => [
        key,
        { type: "string", pattern: keyPattern },
      ]),
    ),
  };
  const schema = {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
  function normalize(input = {}) {
    const data =
      input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const result = { schemaVersion: 1 };
    for (const [key, [fallback, min, max]] of Object.entries(numeric))
      result[key] =
        typeof data[key] === "number" && Number.isFinite(data[key])
          ? Math.max(min, Math.min(max, data[key]))
          : fallback;
    for (const [key, values] of Object.entries(choices))
      result[key] = values.includes(data[key]) ? data[key] : values[0];
    for (const key of counts)
      result[key] =
        typeof data[key] === "number" && Number.isFinite(data[key])
          ? Math.max(0, Math.min(1e9, Math.floor(data[key])))
          : 0;
    result.totalCapas = Math.min(result.totalCapas, result.totalKills);
    result.boomKills = Math.min(result.boomKills, result.totalKills);
    result.bonusPts =
      (result.totalCapas >= 5 ? 150 : 0) +
      (result.boomKills >= 1 ? 150 : 0) +
      (result.totalBooyahs >= 1 ? 300 : 0);
    const keys = data.keyBindings,
      values =
        keys && typeof keys === "object"
          ? Object.keys(defaultKeys).map((key) => keys[key])
          : [];
    const valid =
      values.length === Object.keys(defaultKeys).length &&
      values.every(
        (value) =>
          typeof value === "string" && new RegExp(keyPattern).test(value),
      ) &&
      new Set(values).size === values.length;
    result.keyBindings = valid
      ? Object.fromEntries(
          Object.keys(defaultKeys).map((key, i) => [key, values[i]]),
        )
      : { ...defaultKeys };
    return result;
  }
  function consistent(data) {
    return (
      !!data &&
      !!data.keyBindings &&
      data.totalCapas <= data.totalKills &&
      data.boomKills <= data.totalKills &&
      new Set(Object.values(data.keyBindings)).size ===
        Object.keys(defaultKeys).length &&
      data.bonusPts === normalize(data).bonusPts
    );
  }
  return { normalize, schema, consistent, defaultKeys };
});

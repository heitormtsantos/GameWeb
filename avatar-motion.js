/* Secondary animation is cosmetic: hitboxes remain on the unanimated body pivot. */
window.ArenaMotion = (() => {
  "use strict";
  const motions = new WeakMap();
  function reset(character) {
    motions.delete(character);
    character.posePivot.position.set(0, 0, 0);
    character.posePivot.rotation.set(0, 0, 0);
  }
  function pose(character, dt, options = {}) {
    let motion = motions.get(character);
    if (!motion) {
      motion = {
        previous: character.root.position.clone(),
        grounded: options.grounded !== false,
        landing: 0,
        phase: 0,
        rootQ: new THREE.Quaternion(),
        parentQ: new THREE.Quaternion(),
        targetQ: new THREE.Quaternion(),
        euler: new THREE.Euler(),
      };
      motions.set(character, motion);
    }
    const position = character.root.position,
      dx = position.x - motion.previous.x,
      dz = position.z - motion.previous.z;
    const speed = Math.min(10, Math.hypot(dx, dz) / Math.max(dt, 0.0001));
    motion.previous.copy(position);
    const grounded = options.grounded !== false,
      moving = speed > 0.2 && !options.riding;
    const aiming = !!options.aiming && !options.emoting && !options.riding,
      alpha = 1 - Math.exp(-14 * dt);
    motion.phase += dt * (moving ? (speed > 7 ? 13 : 9) : 2);
    if (!motion.grounded && grounded) motion.landing = 0.1;
    motion.grounded = grounded;
    motion.landing *= Math.exp(-12 * dt);
    const smooth = (object, axis, target) => {
      object.rotation[axis] += (target - object.rotation[axis]) * alpha;
    };
    const phase = options.walkTime ?? motion.phase;
    const knee = (offset) =>
      options.riding
        ? -0.9
        : !grounded
          ? -0.65
          : -(moving ? Math.max(0, -Math.sin(phase + offset)) * 0.75 : 0.04) -
            motion.landing * 2;
    smooth(character.leftKneePivot, "x", knee(0));
    smooth(character.rightKneePivot, "x", knee(Math.PI));
    smooth(
      character.rightElbowPivot,
      "x",
      options.reloading
        ? -0.95
        : aiming
          ? -0.3
          : options.emoting
            ? -0.45
            : -0.12,
    );
    smooth(
      character.leftElbowPivot,
      "x",
      options.reloading
        ? -1.15
        : aiming && !options.akimbo
          ? -0.55
          : aiming
            ? -0.3
            : -0.15,
    );
    smooth(character.rightArmPivot, "y", 0);
    smooth(character.leftArmPivot, "y", 0);
    smooth(character.rightArmPivot, "z", aiming && !options.akimbo ? -1.1 : 0);
    smooth(character.leftArmPivot, "z", aiming && !options.akimbo ? 1.0 : 0);
    smooth(
      character.headGroup,
      "x",
      Math.max(-0.35, Math.min(0.35, (options.pitch || 0) * 0.65)),
    );
    smooth(
      character.posePivot,
      "x",
      options.riding ? 0 : speed > 7 ? -0.065 : 0,
    );
    smooth(character.posePivot, "z", moving ? Math.sin(phase) * 0.018 : 0);
    character.posePivot.position.y =
      (grounded && moving
        ? Math.abs(Math.sin(phase)) * 0.023
        : Math.sin(motion.phase) * 0.006) - motion.landing;
    // Keep the barrel aligned with the aim even while elbows and shoulders bend.
    character.root.getWorldQuaternion(motion.rootQ);
    const pitch = aiming
      ? options.pitch || 0
      : options.reloading
        ? -0.6
        : -0.32;
    motion.euler.set(
      pitch,
      0,
      options.reloading ? Math.sin(motion.phase * 3) * 0.14 : 0,
    );
    motion.targetQ
      .copy(motion.rootQ)
      .multiply(motion.parentQ.setFromEuler(motion.euler));
    for (const holder of [character.gunHolder, character.leftGunHolder]) {
      holder.parent.getWorldQuaternion(motion.parentQ);
      holder.quaternion.copy(motion.parentQ.invert().multiply(motion.targetQ));
    }
  }
  return { pose, reset };
})();

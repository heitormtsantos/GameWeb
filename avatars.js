/* Procedural block avatars. Silhouette and hitboxes do not depend on accessories. */
window.ArenaAvatars = (() => {
  "use strict";
  let geometries;
  function create(THREE, opts, buildWeaponModel) {
    const shared = ArenaRuntime.shared;
    if (!geometries)
      geometries = {
        leg: shared(new THREE.BoxGeometry(0.32, 0.36, 0.36)),
        upperArm: shared(new THREE.BoxGeometry(0.27, 0.3, 0.34)),
        forearm: shared(new THREE.BoxGeometry(0.25, 0.28, 0.32)),
        torso: shared(new THREE.BoxGeometry(0.7, 0.65, 0.4)),
        head: shared(new THREE.BoxGeometry(0.45, 0.43, 0.43)),
        shoe: shared(new THREE.BoxGeometry(0.34, 0.15, 0.42)),
        hand: shared(new THREE.BoxGeometry(0.25, 0.16, 0.31)),
        eye: shared(new THREE.BoxGeometry(0.047, 0.065, 0.012)),
        mouth: shared(new THREE.BoxGeometry(0.11, 0.023, 0.013)),
        helmet: shared(new THREE.BoxGeometry(0.49, 0.15, 0.47)),
        visor: shared(new THREE.BoxGeometry(0.51, 0.055, 0.26)),
        hair: shared(new THREE.BoxGeometry(0.47, 0.14, 0.44)),
      };
    const mat = (color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
    const pants = mat(opts.pantsColor ?? 0x25304b),
      torsoMat = mat(opts.shirtColor ?? 0x2563eb);
    const armMat = mat(opts.shirtColor ?? 0x2563eb),
      hatMat = mat(opts.hatColor ?? 0xffcf4a);
    const skinMat = mat(opts.skinTone ?? 0xf3c59d),
      hairMat = mat(0x302235),
      darkMat = mat(0x142036),
      shoeMat = mat(0xf3f0e7);
    const root = new THREE.Group(),
      bodyPivot = new THREE.Group(),
      posePivot = new THREE.Group();
    root.add(bodyPivot);
    bodyPivot.add(posePivot);
    const mesh = (geo, material, x = 0, y = 0, z = 0) => {
      const item = new THREE.Mesh(geo, material);
      item.position.set(x, y, z);
      item.castShadow = true;
      item.receiveShadow = true;
      return item;
    };
    const pivot = (x, y, geo, material, cy) => {
      const p = new THREE.Group();
      p.position.set(x, y, 0);
      p.add(mesh(geo, material, 0, cy));
      posePivot.add(p);
      return p;
    };
    const leftLegPivot = pivot(-0.19, 0.8, geometries.leg, pants, -0.18);
    const rightLegPivot = pivot(0.19, 0.8, geometries.leg, pants, -0.18);
    const knees = [leftLegPivot, rightLegPivot].map((leg) => {
      const knee = new THREE.Group();
      knee.position.y = -0.36;
      knee.add(
        mesh(geometries.leg, pants, 0, -0.18),
        mesh(geometries.shoe, shoeMat, 0, -0.36, -0.025),
      );
      leg.add(knee);
      return knee;
    });
    const [leftKneePivot, rightKneePivot] = knees;
    const leftArmPivot = pivot(-0.5, 1.44, geometries.upperArm, armMat, -0.12);
    const rightArmPivot = pivot(0.5, 1.44, geometries.upperArm, armMat, -0.12);
    const elbows = [leftArmPivot, rightArmPivot].map((arm) => {
      const elbow = new THREE.Group();
      elbow.position.y = -0.27;
      elbow.add(
        mesh(geometries.forearm, armMat, 0, -0.14),
        mesh(geometries.hand, skinMat, 0, -0.3),
      );
      arm.add(elbow);
      return elbow;
    });
    const [leftElbowPivot, rightElbowPivot] = elbows;
    posePivot.add(mesh(geometries.torso, torsoMat, 0, 1.14));
    const chestStripe = mesh(
      new THREE.BoxGeometry(0.39, 0.055, 0.012),
      shoeMat,
      0,
      1.25,
      -0.207,
    );
    posePivot.add(chestStripe);
    if (opts.backpack)
      posePivot.add(
        mesh(new THREE.BoxGeometry(0.44, 0.43, 0.18), darkMat, 0, 1.15, 0.29),
      );
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.69;
    posePivot.add(headGroup);
    headGroup.add(mesh(geometries.head, skinMat));
    headGroup.add(mesh(geometries.hair, hairMat, 0, 0.19, 0.015));
    headGroup.add(
      mesh(geometries.eye, darkMat, -0.085, 0.015, -0.22),
      mesh(geometries.eye, darkMat, 0.085, 0.015, -0.22),
    );
    headGroup.add(mesh(geometries.mouth, darkMat, 0, -0.088, -0.222));
    const helmet = new THREE.Group();
    helmet.add(
      mesh(geometries.helmet, hatMat, 0, 0.25),
      mesh(geometries.visor, hatMat, 0, 0.19, -0.16),
    );
    headGroup.add(helmet);
    const gunHolder = new THREE.Group();
    gunHolder.position.set(0, -0.3, -0.06);
    gunHolder.rotation.x = -Math.PI / 2;
    const currentGun = buildWeaponModel(
      opts.weaponKey || "mp40",
      opts.evoSkin || "padrao",
    );
    gunHolder.add(currentGun);
    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.02, -0.5);
    gunHolder.add(muzzlePoint);
    const muzzleFlash = mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdd55 }),
      0,
      0.02,
      -0.5,
    );
    muzzleFlash.visible = false;
    gunHolder.add(muzzleFlash);
    const leftGunHolder = new THREE.Group();
    leftGunHolder.position.copy(gunHolder.position);
    leftGunHolder.add(buildWeaponModel("vector", opts.evoSkin || "padrao"));
    leftGunHolder.visible = false;
    leftGunHolder.rotation.x = -Math.PI / 2;
    leftElbowPivot.add(leftGunHolder);
    const leftMuzzlePoint = new THREE.Object3D();
    leftMuzzlePoint.position.copy(muzzlePoint.position);
    leftGunHolder.add(leftMuzzlePoint);
    const flagGroup = new THREE.Group();
    flagGroup.add(
      mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6), hatMat, 0, -0.5),
    );
    flagGroup.add(
      mesh(new THREE.BoxGeometry(0.03, 0.55, 0.85), torsoMat, 0, -1, -0.42),
    );
    flagGroup.position.set(0, -0.35, -0.1);
    flagGroup.visible = false;
    rightElbowPivot.add(gunHolder);
    rightArmPivot.add(flagGroup);
    return {
      root,
      bodyPivot,
      posePivot,
      leftKneePivot,
      rightKneePivot,
      leftElbowPivot,
      rightElbowPivot,
      headGroup,
      helmet,
      hatMat,
      skinMat,
      leftLegPivot,
      rightLegPivot,
      leftArmPivot,
      rightArmPivot,
      gunHolder,
      leftGunHolder,
      leftMuzzlePoint,
      currentGun,
      muzzlePoint,
      muzzleFlash,
      flagGroup,
      torsoMat,
      armMat,
    };
  }
  return { create };
})();

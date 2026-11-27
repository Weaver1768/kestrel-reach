import * as THREE from 'three';

const mat = (color, metalness = 0.2, roughness = 0.42) => new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: true });

function mesh(group, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); group.add(m); return m;
}

function wingGeometry() {
  const outline = [[0, -2.55], [1.2, -1.9], [5.5, 0.1], [5.5, 3.15], [4.7, 2.9], [0, 1.85]];
  const vertices = [], indices = [], n = outline.length;
  for (const y of [0.16, -0.16]) for (const [x, z] of outline) vertices.push(x, y, z);
  for (let i = 1; i < n - 1; i++) { indices.push(0, i, i + 1, n, n + i + 1, n + i); }
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n, a = i, b = next, c = n + i, d = n + next;
    indices.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
  return g;
}

function finGeometry() {
  const outline = [[3.05, 0.35], [6.7, 0.35], [6.1, 3.75], [5.45, 3.75]];
  const vertices = [], indices = [], n = outline.length;
  for (const x of [-0.2, 0.2]) for (const [z, y] of outline) vertices.push(x, y, z);
  indices.push(0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6);
  for (let i = 0; i < n; i++) { const next = (i + 1) % n; indices.push(i, n + i, next, next, n + i, n + next); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
  return g;
}

export function createAircraft(scene) {
  const root = new THREE.Group(); scene.add(root);
  const airframe = new THREE.Group(); root.add(airframe);
  const skin = mat(0xbdb6a2, 0.38, 0.42), dark = mat(0x373b39, 0.35, 0.5);
  const antiGlare = mat(0x414337, 0.12, 0.7), accent = mat(0xb25d36, 0.18, 0.46), lineMat = mat(0x343837, 0.24, 0.58);

  // The main body, pointed radome, and long pitot probe define a 15.5 m airframe.
  const fuselage = mesh(airframe, new THREE.CylinderGeometry(1.58, 1.12, 13.5, 12, 2), skin, 0, 0, -0.15);
  fuselage.rotation.x = Math.PI / 2;
  const radome = mesh(airframe, new THREE.ConeGeometry(1.12, 2.0, 12), mat(0x555958, 0.3, 0.47), 0, 0, -7.9);
  radome.rotation.x = -Math.PI / 2;
  const pitot = mesh(airframe, new THREE.CylinderGeometry(0.035, 0.055, 2.35, 6), dark, 0, 0, -10.15);
  pitot.rotation.x = -Math.PI / 2;
  mesh(airframe, new THREE.SphereGeometry(0.055, 6, 5), dark, 0, 0, -11.33);

  // Teardrop canopy with a dark cockpit and a visible bow.
  const canopy = mesh(airframe, new THREE.SphereGeometry(1, 18, 12), new THREE.MeshPhysicalMaterial({ color: 0x536b70, metalness: 0.42, roughness: 0.14, transparent: true, opacity: 0.78, clearcoat: 0.9 }), 0, 1.36, -3.55, 1.02, 0.76, 2.15);
  const cockpitTub = mesh(airframe, new THREE.BoxGeometry(1.35, 0.8, 1.9), mat(0x171d1d, 0.1, 0.74), 0, 0.95, -2.45);
  const bow = mesh(airframe, new THREE.TorusGeometry(0.92, 0.075, 7, 20, Math.PI), dark, 0, 1.45, -4.25);
  for (const side of [-1, 1]) mesh(airframe, new THREE.BoxGeometry(0.075, 0.13, 3.05), dark, side * 0.94, 1.34, -3.45);
  mesh(airframe, new THREE.BoxGeometry(0.74, 0.29, 6.6), skin, 0, 0.92, 1.15);
  const antiGlareShield = mesh(airframe, new THREE.BoxGeometry(2.05, 0.08, 3.0), antiGlare, 0, 1.12, -5.28);

  // Two swept half-wings, each rotated and sheared aft at the tip.
  const wingGeo = wingGeometry(), wingHalves = [], wingPanels = [], ailerons = [], canards = [], elevators = [], pylons = [];
  for (const side of [-1, 1]) {
    const half = new THREE.Group(); half.scale.x = side; half.rotation.y = -side * 0.3; airframe.add(half); wingHalves.push(half);
    const wing = new THREE.Mesh(wingGeo, skin); half.add(wing); wingPanels.push(wing);
    const flash = mesh(half, new THREE.BoxGeometry(0.88, 0.035, 1.55), accent, 3.95, 0.19, 1.72);
    flash.rotation.y = 0.2;
    const fence = mesh(half, new THREE.BoxGeometry(0.11, 0.4, 1.5), dark, 3.25, 0.32, 0.95);
    fence.rotation.y = 0.22;
    const aileron = mesh(half, new THREE.BoxGeometry(1.55, 0.14, 1.05), skin, 4.62, 0.04, 2.47);
    ailerons.push(aileron);
    // A rail at each tip and an inner hardpoint carry four slim missiles total.
    mesh(half, new THREE.BoxGeometry(0.22, 0.34, 1.2), dark, 5.38, -0.16, 1.62);
    for (const x of [4.55, 5.35]) {
      const missile = new THREE.Group(); half.add(missile);
      mesh(missile, new THREE.CylinderGeometry(0.13, 0.15, 2.8, 8), mat(0xd8d2c1, 0.3, 0.42), x, -0.36, 1.48).rotation.x = Math.PI / 2;
      mesh(missile, new THREE.ConeGeometry(0.13, 0.42, 8), mat(0x77776d, 0.25, 0.5), x, -0.36, 0.0).rotation.x = -Math.PI / 2;
      pylons.push(missile);
    }

    const canard = new THREE.Group(); canard.position.set(side * 1.55, 0.1, -5.45); airframe.add(canard); canards.push(canard);
    mesh(canard, new THREE.BoxGeometry(2.05, 0.2, 1.25), skin, side * 0.95, 0, 0);
    const tailplane = new THREE.Group(); tailplane.position.set(side * 0.25, 0.55, 4.45); airframe.add(tailplane); elevators.push(tailplane);
    mesh(tailplane, new THREE.BoxGeometry(2.55, 0.2, 1.7), skin, side * 1.15, 0, 0.55);
  }
  // Leading-edge root extensions and the dorsal/ventral stabilizing strakes.
  const wingRoot = mesh(airframe, new THREE.BoxGeometry(2.15, 0.28, 5.2), skin, 0, -0.12, -0.4);
  mesh(airframe, new THREE.BoxGeometry(0.45, 1.35, 2.6), skin, 0, -0.9, 5.25);

  const fin = new THREE.Group(); airframe.add(fin);
  fin.add(new THREE.Mesh(finGeometry(), skin));
  mesh(fin, new THREE.BoxGeometry(0.44, 0.5, 1.35), accent, 0, 3.35, 5.85);
  const rudder = new THREE.Group(); rudder.position.set(0, 0, 5.78); fin.add(rudder);
  mesh(rudder, new THREE.BoxGeometry(0.12, 2.35, 0.78), dark, 0.22, 1.75, 0.55);

  // Exhaust ring, dark turbine face, and a controllable afterburner plume.
  const nozzle = mat(0x363a3a, 0.62, 0.34);
  const nozzleRing = mesh(airframe, new THREE.TorusGeometry(0.94, 0.18, 8, 16), nozzle, 0, 0, 6.6);
  mesh(airframe, new THREE.CylinderGeometry(0.78, 0.65, 0.6, 12), mat(0x15191a, 0.32, 0.58), 0, 0, 6.67).rotation.x = Math.PI / 2;
  const burnerMaterial = new THREE.MeshStandardMaterial({ color: 0xff8a35, emissive: 0xff5412, emissiveIntensity: 0.75, transparent: true, opacity: 0.9, roughness: 0.34 });
  const afterburner = mesh(airframe, new THREE.ConeGeometry(0.64, 1, 10), burnerMaterial, 0, 0, 7.17);
  afterburner.rotation.x = Math.PI / 2; afterburner.visible = false;

  // Dark fuselage cheat lines and six panel joints on each flank.
  for (const side of [-1, 1]) {
    mesh(airframe, new THREE.BoxGeometry(0.055, 0.12, 9.6), lineMat, side * 1.17, -0.12, 0.15);
    for (const z of [-5.25, -3.55, -1.75, 0.15, 2.05, 4.0]) mesh(airframe, new THREE.BoxGeometry(0.035, 0.55, 0.045), lineMat, side * 1.3, 0.05, z);
  }

  const gear = new THREE.Group(); airframe.add(gear);
  const gearMat = mat(0x464a49, 0.55, 0.55), rubber = new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 1 });
  for (const x of [-3.65, 3.65]) {
    const leg = mesh(gear, new THREE.CylinderGeometry(0.1, 0.15, 2.0, 7), gearMat, x, -1.35, 1.05); leg.rotation.z = x < 0 ? -0.18 : 0.18;
    const wheel = mesh(gear, new THREE.CylinderGeometry(0.4, 0.4, 0.23, 12), rubber, x, -2.32, 1.05); wheel.rotation.z = Math.PI / 2;
  }
  mesh(gear, new THREE.CylinderGeometry(0.1, 0.13, 1.65, 7), gearMat, 0, -1.2, -5.8);
  const noseWheel = mesh(gear, new THREE.CylinderGeometry(0.31, 0.31, 0.19, 10), rubber, 0, -2.02, -5.8); noseWheel.rotation.z = Math.PI / 2;

  const brakes = [];
  for (const side of [-1, 1]) {
    const brake = new THREE.Group(); brake.position.set(side * 0.9, 0.78, 1.7); airframe.add(brake);
    mesh(brake, new THREE.BoxGeometry(0.85, 0.12, 2.35), dark, side * 0.45, 0, 0.45); brakes.push(brake);
  }

  const navMaterials = [];
  const navColors = [[-1, 0xff3232], [1, 0x35ff84]];
  for (const [side, color] of navColors) {
    const lightMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.7, roughness: 0.22 }); navMaterials.push(lightMaterial);
    mesh(airframe, new THREE.SphereGeometry(0.16, 8, 6), lightMaterial, side * 5.48, 0.1, 1.1);
  }
  const strobeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf5ff, emissiveIntensity: 2, roughness: 0.15 });
  mesh(airframe, new THREE.SphereGeometry(0.14, 8, 6), strobeMaterial, 0, 3.85, 5.85);
  const formationMaterial = new THREE.MeshStandardMaterial({ color: 0xffc66b, emissive: 0xffa73b, emissiveIntensity: 0.9, roughness: 0.25 });
  mesh(airframe, new THREE.SphereGeometry(0.13, 8, 6), formationMaterial, 0, 1.18, 0.15);

  return { ailerons, elevators, rudder, brakes, pylons, canopy, gear, root, airframe, gearMat, noseWheel, wing: wingPanels[0], wingRoot, canards, afterburner, burnerMaterial, navMaterials, strobeMaterial, formationMaterial, nozzleRing, antiGlareShield, bow, cockpitTub };
}

export function updateAircraft(meshes, state) {
  meshes.root.position.set(state.position.x, state.position.y, state.position.z);
  meshes.root.quaternion.copy(state.orientation);
  meshes.gear.visible = state.gear;
  meshes.brakes[0].rotation.x = state.airbrake ? -0.65 : 0;
  meshes.brakes[1].rotation.x = state.airbrake ? 0.65 : 0;
  meshes.ailerons[0].rotation.x = state.controls.roll * 0.45;
  meshes.ailerons[1].rotation.x = -state.controls.roll * 0.45;
  for (const elevator of meshes.elevators) elevator.rotation.x = state.controls.pitch * 0.28;
  for (const canard of meshes.canards) canard.rotation.x = -state.controls.pitch * 0.22;
  meshes.rudder.rotation.y = state.controls.rudder * 0.25;
  meshes.pylons.forEach((p, i) => { p.visible = state.missiles > i; });
  const blink = Math.sin((state.missionTime || 0) * Math.PI * 2) > 0.15 ? 1.7 : 0.08;
  meshes.navMaterials.forEach((material) => { material.emissiveIntensity = blink; });
  const strobePhase = (state.missionTime || 0) % 1;
  meshes.strobeMaterial.emissiveIntensity = strobePhase < 0.12 || (strobePhase > 0.22 && strobePhase < 0.31) ? 2.4 : 0.08;
  meshes.formationMaterial.emissiveIntensity = 0.9;
  meshes.afterburner.visible = !!state.afterburner;
  meshes.afterburner.scale.y = state.afterburner ? 0.7 + clampNumber(state.throttle) * 1.3 : 0.04;
  meshes.burnerMaterial.emissiveIntensity = state.afterburner ? 1.1 + clampNumber(state.throttle) * 2.6 : 0.08;
  meshes.burnerMaterial.color.setHex(state.afterburner ? 0xff9a3b : 0x4b3021);
  meshes.burnerMaterial.emissive.setHex(state.afterburner ? 0xff5412 : 0x120600);
  meshes.root.visible = true;
  if (state.destroyed) { meshes.airframe.rotation.z = 0.12; meshes.airframe.rotation.x = -0.08; }
  else meshes.airframe.rotation.set(0, 0, 0);
}

function clampNumber(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }

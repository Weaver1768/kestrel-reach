import * as THREE from 'three';
import { clamp, hash2, seeded, smooth } from './util.js';

export const MAP_SIZE = 9000;
export const COAST = 3300;
export const AIRBASE = { x: -1250, z: 1800, y: 110 };
export const LANDMARKS = [
  { name: 'Vane Field', x: AIRBASE.x, z: AIRBASE.z, kind: 'airbase' },
  { name: 'Port Anvil', x: -2250, z: -1800, kind: 'port' },
  { name: 'The Narrows', x: 250, z: -100, kind: 'canyon' },
  { name: 'Blind Mesa', x: 2050, z: 600, kind: 'mesa' },
  { name: 'Salt Flats', x: -850, z: 1550, kind: 'salt' },
  { name: 'Cinder Ridge', x: 2950, z: -600, kind: 'ridge' },
];

function canyonCenter(x) { return 350 * Math.sin(x * 0.00062) + 0.11 * x - 180; }
function baseHeight(x, z) {
  const n = (hash2(Math.floor(x / 180), Math.floor(z / 180), 91) - 0.5) * 42;
  let h = 92 + 18 * Math.sin(x * 0.0011) + 13 * Math.cos(z * 0.0014) + n;
  const ridge = Math.exp(-(((x - 3000) / 850) ** 2 + ((z + 620) / 1750) ** 2));
  h += ridge * (280 + 70 * Math.sin(z * 0.004));
  const mesa = Math.exp(-(((x - 2050) / 950) ** 4 + ((z - 600) / 850) ** 4));
  h += mesa * 265;
  if (x > -2200 && x < 2400) {
    const d = Math.abs(z - canyonCenter(x));
    const canyon = (1 - smooth(200, 520, d)) * 210;
    h = Math.max(45, h - canyon);
  }
  const cityFlat = Math.exp(-(((x + 2250) / 1500) ** 4 + ((z + 1800) / 1100) ** 4));
  h = h * (1 - cityFlat) + 80 * cityFlat;
  const airFlat = Math.exp(-(((x - AIRBASE.x) / 1450) ** 4 + ((z - AIRBASE.z) / 800) ** 4));
  h = h * (1 - airFlat) + AIRBASE.y * airFlat;
  if (x < COAST) {
    const coastFade = smooth(COAST - 900, COAST, x);
    return Math.max(14, h * (1 - coastFade) + 14 * coastFade);
  }
  const shore = smooth(COAST, COAST + 150, x);
  return Math.max(-25, 14 * (1 - shore) - 25 * shore);
}

export function heightAt(x, z) { return baseHeight(x, z); }

function terrainColor(x, z, y, slope) {
  const n = hash2(Math.floor(x / 28), Math.floor(z / 28), 13);
  let c;
  if (x >= COAST) c = new THREE.Color(0x37565c);
  else if (x > -2200 && x < 2400 && Math.abs(z - canyonCenter(x)) < 560) {
    const band = Math.floor(Math.max(0, y) / 22) % 2;
    c = new THREE.Color(band ? 0xbb9a72 : 0xa98860);
    c.lerp(new THREE.Color(n > 0.62 ? 0x9c4a33 : 0x7f3b2b), clamp((slope - 0.16) * 1.5, 0, 0.78));
  } else if (x > 2300 && z < 1400 && z > -2300) c = new THREE.Color(n > 0.5 ? 0x2f3335 : 0x43464a);
  else if (x < -250 && x > -1700 && z > 1100 && z < 2100) c = new THREE.Color(0xe6dfc9);
  else if (Math.exp(-(((x - 2050) / 950) ** 4 + ((z - 600) / 850) ** 4)) > 0.52) c = new THREE.Color(0x8d6a4a);
  else c = new THREE.Color(n > 0.5 ? 0xc9a274 : 0xb08a5e);
  if (slope > 0.52) c.lerp(new THREE.Color(0x3c3531), clamp((slope - 0.52) * 0.7, 0, 0.2));
  return c;
}

function makeTerrain(scene) {
  const count = 241;
  const step = MAP_SIZE / (count - 1);
  const positions = new Float32Array(count * count * 3);
  const colors = new Float32Array(count * count * 3);
  const indices = [];
  for (let iz = 0; iz < count; iz++) for (let ix = 0; ix < count; ix++) {
    const x = -MAP_SIZE / 2 + ix * step, z = -MAP_SIZE / 2 + iz * step;
    const y = baseHeight(x, z);
    const i = (iz * count + ix) * 3;
    positions[i] = x; positions[i + 1] = y; positions[i + 2] = z;
    const sx = baseHeight(x + 14, z) - baseHeight(x - 14, z);
    const sz = baseHeight(x, z + 14) - baseHeight(x, z - 14);
    const slope = Math.hypot(sx, sz) / 28;
    const c = terrainColor(x, z, y, slope);
    colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b;
    if (ix < count - 1 && iz < count - 1) {
      const a = iz * count + ix, b = a + 1, c0 = a + count, d = c0 + 1;
      if ((ix + iz) % 2) indices.push(a, c0, b, b, c0, d); else indices.push(a, c0, d, a, d, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  mesh.receiveShadow = true; scene.add(mesh);
}

function box(scene, x, y, z, sx, sy, sz, color, material = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material || new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.88 }));
  mesh.position.set(x, y, z); scene.add(mesh); return mesh;
}
function line(scene, a, b, color, width = 2) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
  const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color, linewidth: width })); scene.add(m); return m;
}
function runway(scene) {
  const { x, z, y } = AIRBASE;
  const pavement = new THREE.Mesh(new THREE.BoxGeometry(1800, 1.1, 48), new THREE.MeshStandardMaterial({ color: 0x3d4242, roughness: 1 }));
  pavement.position.set(x, y + 0.8, z); scene.add(pavement);
  for (const end of [-1, 1]) {
    for (let i = 0; i < 8; i++) box(scene, x + end * 820, y + 1.42, z + (i - 3.5) * 4.2, 3.5, 0.25, 1.5, 0xe9e0c8);
    // Displaced threshold bars.
    for (let i = 0; i < 5; i++) box(scene, x + end * (745 - i * 18), y + 1.42, z, 9, 0.2, 1, 0xe9e0c8);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) box(scene, x + end * (635 - i * 62), y + 1.42, z + side * 8, 19, 0.22, 1.5, 0xe9e0c8);
      box(scene, x + end * 285, y + 1.42, z + side * 10, 42, 0.22, 4, 0xe9e0c8);
    }
  }
  for (let i = -12; i <= 12; i++) box(scene, x + i * 62, y + 1.4, z, 25, 0.22, 0.8, 0xd7c9a7);
  box(scene, x, y + 1.2, z + 77, 1740, 0.5, 12, 0x565a55);
  for (let i = -13; i <= 13; i++) if (i % 2 === 0) box(scene, x + i * 62, y + 1.52, z + 77, 24, 0.12, 0.65, 0xe0bd62);
  box(scene, x + 50, y + 1.2, z + 155, 450, 0.4, 16, 0x484d4a);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffb84a, emissive: 0xffa629, emissiveIntensity: 1.15, roughness: 0.35 });
  for (let i = 0; i <= 30; i++) for (const side of [-1, 1])
    box(scene, x - 900 + i * 60, y + 1.55, z + side * 25.5, 1.2, 0.3, 1.2, 0xffb84a, lightMat);
  for (let i = 0; i < 8; i++) {
    const row = i < 4 ? 0 : 1, col = i % 4;
    const hx = x - 520 + col * 340, hz = z + 255 + row * 100;
    box(scene, hx, y + 1.7, hz, 108, 30 + (i % 3) * 3, 68, 0x77776d);
    box(scene, hx, y + 18, hz - 35, 112, 2, 2, 0x9a4734);
  }
  box(scene, x + 250, y + 28, z + 75, 28, 55, 28, 0x89877b);
  box(scene, x + 250, y + 56, z + 75, 34, 5, 34, 0x383e3f);
  const sock = new THREE.Group(); sock.position.set(x - 400, y + 12, z + 112); scene.add(sock);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 24, 6), new THREE.MeshStandardMaterial({ color: 0x66635b })); pole.position.y = -1; sock.add(pole);
  const cloth = new THREE.Mesh(new THREE.ConeGeometry(3.5, 19, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0xd08c39, side: THREE.DoubleSide })); cloth.rotation.z = -Math.PI / 2; cloth.position.set(9, 8, 0); sock.add(cloth);
  for (const end of [-1, 1]) {
    const paint = document.createElement('canvas'); paint.width = 128; paint.height = 64;
    const paintCtx = paint.getContext('2d'); paintCtx.fillStyle = '#e4deca'; paintCtx.font = 'bold 52px monospace'; paintCtx.textAlign = 'center'; paintCtx.textBaseline = 'middle'; paintCtx.fillText(end < 0 ? '09' : '27', 64, 32);
    const paintTexture = new THREE.CanvasTexture(paint); paintTexture.colorSpace = THREE.SRGBColorSpace;
    const number = new THREE.Mesh(new THREE.PlaneGeometry(36, 16), new THREE.MeshBasicMaterial({ map: paintTexture, transparent: true, side: THREE.DoubleSide }));
    number.rotation.x = -Math.PI / 2; number.position.set(x + end * 700, y + 1.5, z); scene.add(number);
  }
}

function landmarks(scene, random) {
  runway(scene);
  const city = new THREE.Group(); scene.add(city);
  const dummy = new THREE.Object3D();
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x555453, roughness: 0.9 }), 150);
  for (let i = 0; i < 150; i++) {
    const x = -2250 + (random() - 0.5) * 1750, z = -1800 + (random() - 0.5) * 1250;
    const h = 12 + random() * (random() < 0.12 ? 110 : 34), w = 28 + random() * 44;
    dummy.position.set(x, 80 + h / 2, z); dummy.scale.set(w, h, 30 + random() * 36); dummy.updateMatrix(); blocks.setMatrixAt(i, dummy.matrix);
  }
  blocks.instanceMatrix.needsUpdate = true; city.add(blocks);
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffa94f }), 750);
  for (let i = 0; i < 750; i++) {
    const x = -2250 + (random() - 0.5) * 1700, z = -1800 + (random() - 0.5) * 1200;
    dummy.position.set(x, 87 + random() * 28, z); dummy.scale.set(7, 5, 3); dummy.updateMatrix(); lights.setMatrixAt(i, dummy.matrix);
  }
  lights.instanceMatrix.needsUpdate = true; scene.add(lights);
  for (let i = 0; i < 3; i++) {
    const x = -2650 + i * 370, z = -2550;
    box(scene, x, 92, z, 17, 70, 17, 0x625f59); box(scene, x, 130, z, 10, 6, 10, 0xc29557);
    const boom = line(scene, [x, 135, z], [x + 75, 135, z - 22], 0x564c40); line(scene, [x + 75, 135, z - 22], [x + 150, 80, z - 22], 0x564c40); line(scene, [x + 75, 135, z - 22], [x + 30, 78, z - 22], 0x564c40); void boom;
  }
  for (let i = 0; i < 3; i++) {
    const ship = box(scene, -1750 + i * 280, 3, -2900 - i * 72, 185, 10, 34, 0x444c4b);
    ship.rotation.y = -0.3; box(scene, ship.position.x, 11, ship.position.z, 32, 8, 22, 0xafa28a);
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 10000), new THREE.MeshStandardMaterial({ color: 0x37565c, roughness: 0.38, metalness: 0.06 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(6300, 0, 0); scene.add(sea);
  const shallows = new THREE.Mesh(new THREE.PlaneGeometry(150, 10000), new THREE.MeshStandardMaterial({ color: 0x6f9a94, transparent: true, opacity: 0.75, roughness: 0.24, depthWrite: false }));
  shallows.rotation.x = -Math.PI / 2; shallows.position.set(3375, 0.18, 0); scene.add(shallows);
  const breaker = new THREE.Mesh(new THREE.BoxGeometry(1500, 14, 34), new THREE.MeshStandardMaterial({ color: 0x686a62 })); breaker.position.set(-1950, 8, -2740); scene.add(breaker);
  // Salt pan water pockets and a single deterministic cracked-polygon line mesh.
  const saltRandom = seeded(8821), cracks = [], ponds = new THREE.MeshBasicMaterial({ color: 0x82a19a, transparent: true, opacity: 0.48 });
  for (let i = 0; i < 185; i++) {
    let px = -850 + (saltRandom() - 0.5) * 1500, pz = 1550 + (saltRandom() - 0.5) * 760;
    const len = 16 + saltRandom() * 66, angle = saltRandom() * Math.PI * 2;
    const h = baseHeight(px, pz) + 1.5;
    cracks.push(px, h, pz, px + Math.cos(angle) * len, h, pz + Math.sin(angle) * len);
  }
  const crackGeo = new THREE.BufferGeometry(); crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(cracks, 3));
  scene.add(new THREE.LineSegments(crackGeo, new THREE.LineBasicMaterial({ color: 0xb6b5a8, transparent: true, opacity: 0.52 })));
  for (let i = 0; i < 5; i++) {
    const pond = new THREE.Mesh(new THREE.CircleGeometry(40 + saltRandom() * 80, 9), ponds);
    const px = -850 + (saltRandom() - 0.5) * 1150, pz = 1550 + (saltRandom() - 0.5) * 550;
    pond.rotation.x = -Math.PI / 2; pond.scale.set(1.4, 0.55, 1); pond.position.set(px, baseHeight(px, pz) + 2, pz); scene.add(pond);
  }
  // Mesa installations and a compact dirt strip.
  const mx = 2050, mz = 600, my = baseHeight(mx, mz);
  box(scene, mx, my + 3, mz, 1150, 8, 1000, 0x8b6546);
  const radar = new THREE.Group(); radar.position.set(mx - 180, my + 18, mz - 120); scene.add(radar);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), new THREE.MeshStandardMaterial({ color: 0xb8b7ac, side: THREE.DoubleSide })); dish.rotation.x = Math.PI / 2; dish.position.y = 20; radar.add(dish);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 24, 6), new THREE.MeshStandardMaterial({ color: 0x595b58 })); mast.position.y = 7; radar.add(mast);
  // Each prop sits on the ground under itself, so none hangs over the mesa edge.
  const slabX = mx + 220, slabZ = mz + 190;
  box(scene, slabX, baseHeight(slabX, slabZ) + 1.5, slabZ, 320, 1.5, 24, 0x554c3e);
  for (let i = 0; i < 4; i++) {
    const bx = mx + 480 + (i % 2) * 90, bz = mz - 150 + Math.floor(i / 2) * 110;
    box(scene, bx, baseHeight(bx, bz) + 6, bz, 54, 12, 26, 0x676254);
  }
  const sam = new THREE.Group(); sam.position.set(mx + 520, my + 10, mz - 205); scene.add(sam);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(13, 16, 12, 8), new THREE.MeshStandardMaterial({ color: 0x52604f })); sam.add(base);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 52, 7), new THREE.MeshStandardMaterial({ color: 0x616b59 })); tube.rotation.z = -0.72; tube.position.set(12, 17, 0); sam.add(tube);
  // Canyon river and gate arches follow the winding floor.
  const riverVertices = [], riverIndices = [], riverSteps = 300;
  for (let i = 0; i <= riverSteps; i++) {
    const x = -2200 + i * (4600 / riverSteps), z = canyonCenter(x);
    const dz = (canyonCenter(x + 1) - canyonCenter(x - 1)) / 2;
    const inv = 1 / Math.hypot(1, dz), nx = -dz * inv, nz = inv, y = baseHeight(x, z) + 0.6;
    riverVertices.push(x - nx * 13, y, z - nz * 13, x + nx * 13, y, z + nz * 13);
    if (i < riverSteps) { const a = i * 2; riverIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(riverVertices, 3)); riverGeo.setIndex(riverIndices); riverGeo.computeVertexNormals();
  // A floating ribbon cut across the canyon, so the bed stays terrain colour only.
  riverGeo.dispose();
  for (const x of [-1250, -150, 950]) {
    const z = canyonCenter(x), y = baseHeight(x, z) + 66;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(42, 2.2, 6, 28), new THREE.MeshBasicMaterial({ color: 0xf1bd60 }));
    ring.position.set(x, y, z); ring.rotation.y = Math.PI / 2; scene.add(ring);
  }
  // Vent cone and low-poly ash fans.
  const rx = 3000, rz = -650, ry = baseHeight(rx, rz);
  const vent = new THREE.Mesh(new THREE.ConeGeometry(180, 230, 7), new THREE.MeshStandardMaterial({ color: 0x292b2c, flatShading: true })); vent.position.set(rx, ry + 105, rz); scene.add(vent);
  const crater = new THREE.Mesh(new THREE.TorusGeometry(54, 13, 5, 9), new THREE.MeshStandardMaterial({ color: 0x1e2021 })); crater.position.set(rx, ry + 224, rz); crater.rotation.x = Math.PI / 2; scene.add(crater);
  return { radar, sam };
}

export function createTerrain(scene, seed = 1) {
  const random = seeded(seed);
  makeTerrain(scene);
  const props = landmarks(scene, random);
  return { heightAt, landmarks: LANDMARKS, radar: props.radar, sam: props.sam, airbase: AIRBASE };
}

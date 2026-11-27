import * as THREE from 'three';
import { seeded } from './util.js';

function textureFrom(draw) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d'); draw(ctx); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const smokeTexture = textureFrom((ctx) => { const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(0.3, 'rgba(230,225,210,.52)'); g.addColorStop(1, 'rgba(190,190,180,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });
const flashTexture = textureFrom((ctx) => { const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.2, 'rgba(255,183,75,.9)'); g.addColorStop(1, 'rgba(255,71,20,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });

export function createEffects(scene, seed = 1) {
  const random = seeded(seed ^ 0xa52c), sprites = [], tracers = [], bursts = [], debris = [], contrails = [];
  const group = new THREE.Group(); scene.add(group);
  const material = (texture, opacity = 1, blending = THREE.NormalBlending) => new THREE.SpriteMaterial({ map: texture, transparent: true, opacity, depthWrite: false, blending });
  const smokeMat = material(smokeTexture, 0.55), flashMat = material(flashTexture, 0.9, THREE.AdditiveBlending);
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.8 });
  const debrisGeo = new THREE.TetrahedronGeometry(1, 0), debrisMat = new THREE.MeshStandardMaterial({ color: 0x554843, flatShading: true });
  const addSmoke = (pos, size = 5, life = 2.5) => {
    const s = new THREE.Sprite(smokeMat.clone()); s.position.copy(pos); s.scale.set(size, size, 1); group.add(s); sprites.push({ mesh: s, life, max: life, size });
  };
  const addTracer = (a, b, color = 0xffd88d, life = 0.09) => {
    const geom = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const mesh = new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })); group.add(mesh); tracers.push({ mesh, life, max: life });
  };
  const addContrail = (a, b) => {
    const curve = new THREE.CatmullRomCurve3([a.clone(), b.clone()]);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 1.2, 5, false), new THREE.MeshBasicMaterial({ color: 0xe5e1d7, transparent: true, opacity: 0.48, depthWrite: false }));
    group.add(mesh); return mesh;
  };
  const addFlash = (pos, size = 3) => {
    const s = new THREE.Sprite(flashMat.clone()); s.position.copy(pos); s.scale.set(size, size, 1); group.add(s); bursts.push({ mesh: s, life: 0.16, max: 0.16, power: size / 10 });
  };
  const explode = (pos, power = 1) => {
    const s = new THREE.Sprite(flashMat.clone()); s.position.copy(pos); s.scale.set(10 * power, 10 * power, 1); group.add(s); bursts.push({ mesh: s, life: 0.55, max: 0.55, power });
    for (let i = 0; i < 14 * power; i++) {
      const d = new THREE.Mesh(debrisGeo, debrisMat); d.position.copy(pos); d.scale.setScalar(0.35 + random() * 1.3); group.add(d);
      const a = random() * Math.PI * 2, u = random() * 2 - 1, speed = 18 + random() * 50;
      debris.push({ mesh: d, velocity: new THREE.Vector3(Math.cos(a) * speed, u * speed, Math.sin(a) * speed), life: 2.2 + random() * 1.2 });
    }
    for (let i = 0; i < 8; i++) addSmoke(pos.clone().add(new THREE.Vector3((random() - 0.5) * 10, random() * 7, (random() - 0.5) * 10)), 5 + random() * 9, 2.7 + random() * 1.5);
  };
  const contrail = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 5), new THREE.MeshBasicMaterial({ color: 0xe3ded0, transparent: true, opacity: 0.22, depthWrite: false })); group.add(contrail); contrails.push(contrail);
  return {
    explode, smoke: addSmoke, tracer: addTracer, muzzle: addFlash, contrailLine: addContrail,
    touchdown(position, quality) { if (quality > 0.5) addSmoke(position.clone(), 2.4, 0.35); },
    update(dt, state) {
      for (let i = sprites.length - 1; i >= 0; i--) {
        const p = sprites[i]; p.life -= dt; p.mesh.position.y += dt * 1.8; p.mesh.scale.setScalar(p.size * (1 + (p.max - p.life) * 0.8)); p.mesh.material.opacity = Math.max(0, 0.55 * p.life / p.max);
        if (p.life <= 0) { group.remove(p.mesh); p.mesh.material.dispose(); sprites.splice(i, 1); }
      }
      for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.life -= dt; t.mesh.material.opacity = t.life / t.max; if (t.life <= 0) { group.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); tracers.splice(i, 1); } }
      for (let i = bursts.length - 1; i >= 0; i--) { const b = bursts[i]; b.life -= dt; const k = 1 + (b.max - b.life) * 22; b.mesh.scale.setScalar(k * b.power); b.mesh.material.opacity = Math.max(0, b.life / b.max); if (b.life <= 0) { group.remove(b.mesh); b.mesh.material.dispose(); bursts.splice(i, 1); } }
      for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.life -= dt; d.velocity.y -= 9.8 * dt; d.mesh.position.addScaledVector(d.velocity, dt); d.mesh.rotation.x += dt * 2; d.mesh.rotation.z += dt * 3; if (d.life <= 0) { group.remove(d.mesh); debris.splice(i, 1); } }
      const pos = state.position, q = state.orientation;
      const tail = new THREE.Vector3(0, 0.25, 7.5).applyQuaternion(q).add(pos);
      const nose = new THREE.Vector3(0, 0.25, -0.2).applyQuaternion(q).add(pos);
      const c = contrails[0]; c.position.copy(tail).lerp(nose, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nose.clone().sub(tail).normalize()); c.scale.set(1, Math.max(1, tail.distanceTo(nose)), 1);
      c.visible = state.mach > 0.72 || state.stall;
      if (state.damage.fire && random() < dt * 7) addSmoke(tail, 3.5 + random() * 3, 2.6);
    },
    dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); scene.remove(group); },
  };
}


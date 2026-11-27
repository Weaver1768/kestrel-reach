import * as THREE from 'three';
import { seeded } from './util.js';
import { applyDamage } from './flightmodel.js';

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x65594c, roughness: 0.65, flatShading: true });
const bomberMat = new THREE.MeshStandardMaterial({ color: 0x827c6b, roughness: 0.58, flatShading: true });
const gunMat = new THREE.MeshStandardMaterial({ color: 0x343839, metalness: 0.5, roughness: 0.5 });
function makeBomber(scene) {
  const root = new THREE.Group(); scene.add(root);
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.3, 19, 8), bomberMat); fus.rotation.x = Math.PI / 2; root.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.8, 5, 8), bomberMat); nose.rotation.x = -Math.PI / 2; nose.position.z = -12; root.add(nose);
  const wings = new THREE.Mesh(new THREE.BoxGeometry(30, 0.55, 5), bomberMat); root.add(wings);
  for (const x of [-10, -4, 4, 10]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 3.2, 7), gunMat); eng.rotation.x = Math.PI / 2; eng.position.set(x, -0.1, -0.5); root.add(eng);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 3), bomberMat); tail.position.z = 8; root.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 3.2), bomberMat); fin.position.set(0, 2, 7.6); root.add(fin);
  return root;
}
function makeFighter(scene) {
  const root = new THREE.Group(); scene.add(root);
  const m = bodyMat;
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 10, 7), m); fus.rotation.x = Math.PI / 2; root.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.8, 7), m); nose.rotation.x = -Math.PI / 2; nose.position.z = -6.6; root.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13, 0.32, 3), m); wing.rotation.y = 0.12; root.add(wing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.3, 2.2), m); fin.position.set(0, 1.1, 3.8); root.add(fin);
  return root;
}

export function createEnemies(scene, terrain, effects, seed = 1) {
  const random = seeded(seed ^ 0xa17), list = [], missiles = [];
  let activeMission = '', fireClock = 0, samClock = 5, samWarning = 0, flareHeld = false;
  const radar = terrain.radar;
  const spawnBomber = (i, damaged = false) => {
    const mesh = makeBomber(scene), x = 2650 + i * 310, z = -1350 + i * 560;
    mesh.position.set(x, 1050 + i * 80, z); mesh.rotation.y = Math.PI / 2;
    const e = { id: `bomber-${i}`, type: 'bomber', mesh, position: mesh.position, velocity: new THREE.Vector3(-82, 0, 0), health: damaged ? 0.55 : 1, maxHealth: 1, alive: true, speed: 82, routeZ: -1800 + i * 185, smoke: 0, score: 1200 };
    list.push(e); return e;
  };
  const spawnFighter = (i) => {
    const mesh = makeFighter(scene), x = 1200 + i * 250, z = -450 + i * 500;
    mesh.position.set(x, 1500 + i * 80, z);
    const e = { id: `fighter-${i}`, type: 'fighter', mesh, position: mesh.position, velocity: new THREE.Vector3(), health: 1, maxHealth: 1, alive: true, speed: 180, state: 'pursue', timer: 0, score: 1800 };
    list.push(e); return e;
  };
  const setMission = (name) => {
    activeMission = name; fireClock = 0; samClock = 4;
    for (const e of list) { if (e.id !== 'mesa-sam') scene.remove(e.mesh); e.alive = false; }
    list.length = 0;
    if (name === 'iron-rain') for (let i = 0; i < 3; i++) spawnBomber(i);
    if (name === 'blind-mesa') {
      const mx = 2570, mz = 395, my = terrain.heightAt(mx, mz);
      for (let i = 0; i < 2; i++) {
        const van = new THREE.Group(); scene.add(van); van.position.set(mx - 240 + i * 100, my + 13, mz + 220);
        const body = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 27), bodyMat); van.add(body);
        const target = { id: `radar-van-${i}`, type: 'ground', mesh: van, position: van.position, health: 1, maxHealth: 1, alive: true, score: 900 }; list.push(target);
      }
      const sam = terrain.sam;
      scene.add(sam);
      list.push({ id: 'mesa-sam', type: 'ground', mesh: sam, position: sam.position, health: 1, maxHealth: 1, alive: true, score: 1100 });
    }
    if (name === 'free') { spawnFighter(0); }
  };
  const hit = (target, amount = 0.5) => {
    if (!target || !target.alive) return false;
    target.health -= amount;
    if (target.health <= 0) {
      target.alive = false;
      if (target.mesh.parent) target.mesh.parent.remove(target.mesh);
      effects.explode(target.position.clone(), target.type === 'bomber' ? 2 : 1.1);
      return true;
    }
    target.smoke = 1;
    return false;
  };
  const launchHostile = (position, target) => {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 6), new THREE.MeshStandardMaterial({ color: 0x9c5946, emissive: 0x37130b }));
    mesh.position.copy(position); scene.add(mesh);
    const direction = target.position.clone().sub(position).normalize(); missiles.push({ mesh, velocity: direction.multiplyScalar(290), target: 'player', life: 11, hostile: true });
  };
  const targets = () => list.filter((e) => e.alive);
  return {
    get list() { return list; }, targets, setMission, hit,
    spawnForShot(name) { setMission(name); if (name === 'dogfight') { list.length = 0; const e = spawnBomber(0, true); e.position.set(350, 880, -260); e.routeZ = -1800; e.speed = 0; e.smoke = 1; } },
    update(dt, state, weapons, audio, input = {}) {
      radar.rotation.y += dt * 0.8;
      const p = state.position, a = state.orientation;
      for (const e of list) {
        if (e.alive && e.health <= 0) hit(e, 1);
        if (!e.alive) continue;
        e.timer = (e.timer || 0) + dt;
        if (e.type === 'bomber') {
          if (e.speed > 0) { e.position.x -= e.speed * dt; e.position.z += Math.sin(e.timer * 0.16) * dt * 9; e.velocity.set(-e.speed, 0, Math.sin(e.timer * 0.16) * 9); }
          e.mesh.rotation.y = Math.PI / 2;
          if (e.health < 0.7) { e.smoke = 1; if (random() < dt * 6) effects.smoke(e.position.clone().add(new THREE.Vector3(0, 3, 10)), 5, 2.8); }
          fireClock -= dt;
          if (fireClock <= 0 && e.position.distanceTo(p) < 1300) {
            fireClock = 1.8 + random();
            const from = e.position.clone().add(new THREE.Vector3(0, -1, 0));
            const lead = p.clone().add(state.velocity.clone().multiplyScalar(0.3));
            effects.tracer(from, lead, 0xff764b, 0.16);
            if (from.distanceTo(p) < 470 && random() < 0.06) applyDamage(state, random);
          }
          if (e.position.x < -3300) e.reachedCity = true;
        } else if (e.type === 'fighter') {
          const dx = p.x - e.position.x, dy = p.y - e.position.y, dz = p.z - e.position.z, d = Math.hypot(dx, dy, dz);
          e.state = d < 650 ? 'extend' : d < 1250 ? 'evade' : 'pursue';
          const direction = new THREE.Vector3(dx, dy, dz).normalize();
          if (e.state === 'extend') direction.multiplyScalar(-1);
          if (e.state === 'evade') direction.add(new THREE.Vector3(Math.sin(e.timer * 4), 0.18, Math.cos(e.timer * 3)).multiplyScalar(0.8)).normalize();
          e.position.addScaledVector(direction, e.speed * dt);
          e.velocity.copy(direction).multiplyScalar(e.speed);
          e.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
          if (d < 1000 && e.timer > 7) { e.timer = 0; launchHostile(e.position.clone(), state); }
          if (d < 620 && random() < dt * 0.45) { effects.tracer(e.position.clone(), p.clone(), 0xff865b, 0.13); if (random() < 0.08) applyDamage(state, random); }
        }
      }
      const agl = Math.max(0, p.y - terrain.heightAt(p.x, p.z));
      const mesaD = Math.hypot(p.x - 2570, p.z - 395);
      samClock -= dt;
      if (activeMission === 'blind-mesa' && mesaD < 1800 && agl > 60 && samClock <= 0 && !state.destroyed) {
        samClock = 13; samWarning = 3; state.warnings.push('MISSILE INBOUND'); launchHostile(terrain.sam.position.clone().add(new THREE.Vector3(0, 16, 0)), state); if (audio) audio.play('warning');
      }
      if (activeMission === 'blind-mesa') terrain.sam.rotation.y = Math.atan2(p.x - terrain.sam.position.x, p.z - terrain.sam.position.z);
      if (samWarning > 0) samWarning -= dt;
      if (input.flare && !flareHeld && state.flares > 0) {
        state.flares--;
        for (const missile of missiles) if (missile.hostile) { missile.life = Math.min(missile.life, 0.65); break; }
        if (audio) audio.play('servo');
      }
      flareHeld = !!input.flare;
      for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i]; m.life -= dt;
        const to = p.clone().sub(m.mesh.position).normalize();
        m.velocity.lerp(to.multiplyScalar(m.hostile ? 320 : 510), dt * (m.hostile ? 2.8 : 1.5));
        m.mesh.position.addScaledVector(m.velocity, dt); m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), m.velocity.clone().normalize());
        effects.smoke(m.mesh.position.clone(), 1.1, 0.55);
        if (m.mesh.position.distanceTo(p) < 13 && m.hostile) { applyDamage(state, random); state.damage.fire = true; effects.explode(p.clone(), 0.7); m.life = 0; }
        if (m.life <= 0) { scene.remove(m.mesh); missiles.splice(i, 1); }
      }
      return { samWarning, targets: targets() };
    },
    reset() {
      for (const e of list) if (e.id !== 'mesa-sam') scene.remove(e.mesh);
      for (const missile of missiles) scene.remove(missile.mesh);
      missiles.length = 0; list.length = 0; activeMission = ''; samClock = 5; samWarning = 0; flareHeld = false;
    },
  };
}


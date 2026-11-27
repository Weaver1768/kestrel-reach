import * as THREE from 'three';
import { clamp, seeded } from './util.js';

const forward = new THREE.Vector3(0, 0, -1);
const noseOffset = new THREE.Vector3(0, 0, -10);

export function createWeapons(scene, effects, state, audio) {
  const missiles = [], bombs = [];
  const random = seeded(711);
  let gunClock = 0, bombClock = 0, lockTime = 0, target = null, selected = 'gun', incoming = 0, slewX = 0, slewY = 0;
  const missileMat = new THREE.MeshStandardMaterial({ color: 0xd7d1bd, metalness: 0.3, roughness: 0.55, flatShading: true, emissive: 0x20160c });
  const bombMat = new THREE.MeshStandardMaterial({ color: 0x5d6259, roughness: 0.7, flatShading: true });
  const nextWeapon = () => { selected = selected === 'gun' ? 'missile' : selected === 'missile' ? 'bomb' : 'gun'; state.weapon = selected; };
  const getForward = () => forward.set(0, 0, -1).applyQuaternion(state.orientation);
  const getOrigin = () => noseOffset.clone().applyQuaternion(state.orientation).add(state.position);
  const bestTarget = (targets) => {
    const f = new THREE.Vector3(slewX, slewY, -1).normalize().applyQuaternion(state.orientation), origin = getOrigin(); let best = null, score = Infinity;
    for (const t of targets) {
      if (!t.alive || t.type === 'ground') continue;
      const d = t.position.distanceTo(origin); if (d > 4200 || d < 35) continue;
      const dir = t.position.clone().sub(origin).normalize();
      const angle = Math.acos(clamp(f.dot(dir), -1, 1));
      if (angle < 0.31 && d + angle * 850 < score) { best = t; score = d + angle * 850; }
    }
    return best;
  };
  const damageTarget = (t, amount) => {
    if (t && t.alive) t.health -= amount;
  };
  const fireGun = (targets) => {
    if (state.gunRounds <= 0) return;
    const origin = getOrigin(), dir = getForward();
    const spread = (random() - 0.5) * 0.008;
    const aim = dir.clone().add(new THREE.Vector3(spread, spread * 0.42, (random() - 0.5) * 0.008)).normalize();
    const end = origin.clone().addScaledVector(aim, 1250);
    effects.tracer(origin, end, random() < 0.15 ? 0xffe7a8 : 0xffb767, 0.08);
    effects.muzzle(origin, 2.8);
    state.velocity.addScaledVector(dir, -0.16);
    state.gunRounds--; gunClock = 0.05;
    for (const t of targets) {
      if (!t.alive) continue;
      const to = t.position.clone().sub(origin), range = to.length(), along = to.dot(aim);
      if (along > 0 && along < Math.min(range + 80, 2000)) {
        const closest = origin.clone().addScaledVector(aim, along);
        if (closest.distanceTo(t.position) < (t.type === 'bomber' ? 22 : 15)) damageTarget(t, t.type === 'bomber' ? 0.07 : 0.18);
      }
    }
    if (audio) audio.play('gun');
  };
  const launchMissile = () => {
    if (state.missiles <= 0 || !target || !target.alive || lockTime < 1.25) return false;
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.45, 4.2, 7), missileMat); mesh.position.copy(getOrigin()); scene.add(mesh);
    missiles.push({ mesh, velocity: getForward().multiplyScalar(Math.max(110, state.velocity.length())), target, life: 8, age: 0 }); state.missiles--;
    if (audio) audio.play('launch'); lockTime = 0; return true;
  };
  const dropBomb = () => {
    if (state.bombs <= 0 || bombClock > 0) return false;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.2, 7), bombMat); mesh.position.copy(getOrigin()); scene.add(mesh);
    bombs.push({ mesh, velocity: state.velocity.clone().add(getForward().multiplyScalar(8)), life: 20 }); state.bombs--; bombClock = 0.6; if (audio) audio.play('launch'); return true;
  };
  const getCCIP = (terrain) => {
    const origin = getOrigin();
    const height = Math.max(0, origin.y - terrain.heightAt(origin.x, origin.z));
    const t = clamp((state.velocity.y + Math.sqrt(Math.max(0, state.velocity.y * state.velocity.y + 2 * 9.81 * height))) / 9.81, 0.1, 14);
    const pos = origin.clone().addScaledVector(state.velocity, t);
    pos.y -= 0.5 * 9.81 * t * t;
    pos.y = terrain.heightAt(pos.x, pos.z);
    return { position: pos, time: t };
  };
  return {
    get selected() { return selected; }, get target() { return target; }, get lockTime() { return lockTime; }, get incoming() { return incoming; },
    setIncoming(value) { incoming = value; }, nextWeapon,
    forceWeapon(name) { selected = name; state.weapon = name; },
    slew(dx, dy, cockpitMode = false) {
      if (cockpitMode) return;
      slewX = clamp(slewX + dx * 0.0018, -0.38, 0.38);
      slewY = clamp(slewY - dy * 0.0018, -0.28, 0.28);
      if (!dx && !dy) { slewX *= 0.995; slewY *= 0.995; }
    },
    reset() {
      for (const m of missiles) scene.remove(m.mesh); for (const b of bombs) scene.remove(b.mesh);
      missiles.length = 0; bombs.length = 0; target = null; lockTime = 0; gunClock = 0; bombClock = 0; incoming = 0; slewX = 0; slewY = 0; selected = 'gun'; state.weapon = 'gun';
    },
    fireMissile: launchMissile,
    update(dt, input, targets, terrain) {
      gunClock -= dt; bombClock = Math.max(0, bombClock - dt);
      if (input.weaponPressed) nextWeapon();
      const next = bestTarget(targets); if (next === target && next) lockTime += dt; else { target = next; lockTime = 0; }
      if (target && audio && lockTime < 1.25 && lockTime + dt >= 1.25) audio.play('lock');
      if ((selected === 'gun' && input.gun) || (input.gun && selected !== 'gun' && input.shiftHeld)) { if (gunClock <= 0) fireGun(targets); }
      if (selected === 'missile' && input.fire) launchMissile();
      if (selected === 'bomb' && input.gun) dropBomb();
      if (input.clickFire && selected !== 'missile' && target && lockTime >= 1.25) launchMissile();
      for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i]; m.life -= dt; m.age += dt;
        if (m.target && m.target.alive) {
          const desired = m.target.position.clone().sub(m.mesh.position).normalize().multiplyScalar(Math.min(690, 360 + m.age * 55));
          const los = desired.clone().normalize(); m.velocity.addScaledVector(los, Math.min(36, 90 * dt)); m.velocity.normalize().multiplyScalar(Math.min(690, 360 + m.age * 55));
        }
        m.mesh.position.addScaledVector(m.velocity, dt); m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), m.velocity.clone().normalize()); effects.smoke(m.mesh.position.clone(), 1.25, 0.7);
        if (m.target && m.mesh.position.distanceTo(m.target.position) < 22) { damageTarget(m.target, 1.4); effects.explode(m.mesh.position.clone(), 1.7); if (audio) audio.play('explosion'); m.life = 0; }
        if (m.life <= 0) { scene.remove(m.mesh); missiles.splice(i, 1); }
      }
      for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i]; b.life -= dt; b.velocity.y -= 9.81 * dt; b.mesh.position.addScaledVector(b.velocity, dt); b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.velocity.clone().normalize());
        const ground = terrain.heightAt(b.mesh.position.x, b.mesh.position.z);
        if (b.mesh.position.y <= ground || b.life <= 0) {
          effects.explode(b.mesh.position.clone(), 1.3);
          for (const t of targets) if (t.alive && t.position.distanceTo(b.mesh.position) < 115) damageTarget(t, 1.2);
          scene.remove(b.mesh); bombs.splice(i, 1); if (audio) audio.play('explosion');
        }
      }
      const ccip = getCCIP(terrain);
      let pipper = null;
      if (target) {
        const range = getOrigin().distanceTo(target.position), t = range / 820;
        pipper = target.position.clone();
        if (target.velocity) pipper.addScaledVector(target.velocity, t);
        pipper.y += 4.905 * t * t;
      }
      return { target, lockTime, ccip, pipper, slewX, slewY, selected, incoming };
    },
    dispose() { for (const m of missiles) scene.remove(m.mesh); for (const b of bombs) scene.remove(b.mesh); },
  };
}


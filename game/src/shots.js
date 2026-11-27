import * as THREE from 'three';
import { AIRBASE } from './terrain.js';
import { MISSIONS } from './missions.js';
import { forwardOf } from './flightmodel.js';

function canyonCenter(x) { return 350 * Math.sin(x * 0.00062) + 0.11 * x - 180; }

function pose(state, x, y, z, heading, pitch = 0, bank = 0, speed = 150) {
  state.position.set(x, y, z); state.previous.copy(state.position);
  state.velocity.set(speed * Math.sin(heading), speed * Math.sin(pitch), -speed * Math.cos(heading));
  state.heading = heading; state.pitch = pitch; state.bank = bank;
  state.orientation.setFromEuler(new THREE.Euler(pitch, -heading, bank, 'YXZ'));
  state.previousOrientation.copy(state.orientation);
  state.gear = false; state.flaps = false; state.airbrake = false; state.afterburner = false;
  state.throttle = 0.78; state.takeoff = true;
  state.controls.pitch = 0; state.controls.roll = 0; state.controls.rudder = 0;
  state.damage.fire = false;
}

function setCamera(camera, state, distance, height, left, lead, fov) {
  const q = state.orientation;
  const forward = forwardOf(state), right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  right.y = 0; right.normalize();
  camera.position.copy(state.position).addScaledVector(forward, -distance).addScaledVector(right, -left);
  camera.position.y += height;
  camera.lookAt(state.position.clone().addScaledVector(forward, lead));
  camera.fov = fov; camera.updateProjectionMatrix();
}

function configureSortie(state, terrain, values = {}) {
  state.agl = state.position.y - terrain.heightAt(state.position.x, state.position.z);
  state.fuel = values.fuel ?? 2050;
  state.throttle = values.throttle ?? 0.78;
  state.missionTime = values.missionTime ?? 12;
  state.warnings = values.warnings ? [...values.warnings] : [];
  state.missiles = values.missiles ?? 4; state.bombs = values.bombs ?? 2; state.gunRounds = values.gunRounds ?? 400;
  state.weapon = values.weapon ?? 'gun'; state.afterburner = !!values.afterburner;
}

export function configureShot(name, app) {
  const { state, terrain, camera, aircraft, missions, enemies, weapons, effects, hud } = app;
  if (!['cover', 'cockpit', 'strike', 'dogfight'].includes(name)) return false;
  if (name === 'cover') {
    missions.begin(MISSIONS[0], state, enemies);
    // Run down the canyon toward the central gate, the hoop dead ahead.
    const gateX = -1250, gateZ = canyonCenter(gateX);
    // Approach along the canyon floor with the hoop exactly on the nose.
    const x = gateX + 320, z = canyonCenter(x);
    const heading = Math.atan2(gateX - x, -(gateZ - z));
    pose(state, x, terrain.heightAt(x, z) + 84, z, heading, 0.015, -8 * Math.PI / 180, 150);
    configureSortie(state, terrain, { missionTime: 12, fuel: 2180, throttle: 0.8, missiles: 4, bombs: 2, gunRounds: 400 });
    state.agl = 84; state.controls.roll = -0.22;
    setCamera(camera, state, 33, 4, 12, 82, 52);
    const forward = forwardOf(state);
    camera.lookAt(state.position.clone().addScaledVector(forward, 84));
    app.shotTarget = { position: new THREE.Vector3(gateX, terrain.heightAt(gateX, gateZ) + 66, gateZ) };
  } else if (name === 'cockpit') {
    missions.begin(MISSIONS[0], state, enemies);
    const thresholdX = AIRBASE.x - 900, x = thresholdX - 1400, z = AIRBASE.z;
    const ground = terrain.heightAt(x, z);
    pose(state, x, ground + 210, z, Math.PI / 2, -3 * Math.PI / 180, 0, 120);
    state.gear = true; state.flaps = true;
    configureSortie(state, terrain, { missionTime: 34, fuel: 1920, throttle: 0.67, missiles: 4, bombs: 2, gunRounds: 400 });
    state.agl = 210;
    camera.position.copy(state.position).add(new THREE.Vector3(0, 1.62, -3.05).applyQuaternion(state.orientation));
    camera.quaternion.copy(state.orientation); camera.fov = 72; camera.updateProjectionMatrix();
    app.shotTarget = { position: new THREE.Vector3(thresholdX, AIRBASE.y + 2, AIRBASE.z) };
  } else if (name === 'strike') {
    missions.begin(MISSIONS[2], state, enemies);
    // Run in on the mesa radar site from 700 m out, the target dead ahead.
    const site = terrain.radar.position;
    const bearing = new THREE.Vector3(-0.75, 0, -0.66).normalize();
    const x = site.x + bearing.x * 700, z = site.z + bearing.z * 700;
    const y = Math.max(terrain.heightAt(x, z) + 170, site.y + 130);
    const heading = Math.atan2(site.x - x, -(site.z - z));
    pose(state, x, y, z, heading, 0, -0.06, 192);
    configureSortie(state, terrain, { missionTime: 18, fuel: 1740, throttle: 0.83, missiles: 3, bombs: 2, gunRounds: 360, weapon: 'bomb', warnings: ['MISSILE INBOUND'] });
    state.agl = 170; weapons.forceWeapon('bomb');
    setCamera(camera, state, 40, 9, 10, 520, 50);
    app.shotTarget = terrain.radar;
    effects.smoke(new THREE.Vector3(2250, terrain.heightAt(2250, 790) + 1.5, 790), 2.8, 3);
  } else {
    missions.begin(MISSIONS[1], state, enemies);
    enemies.spawnForShot('dogfight');
    const heading = Math.PI / 2 + 0.05, x = -2100, z = -1760;
    pose(state, x, terrain.heightAt(x, z) + 460, z, heading, 0.015, -40 * Math.PI / 180, 235);
    configureSortie(state, terrain, { missionTime: 21, fuel: 1480, throttle: 0.96, missiles: 2, bombs: 1, gunRounds: 286, weapon: 'gun', afterburner: true });
    state.agl = 460; state.controls.roll = -0.48;
    const bomber = enemies.targets()[0];
    if (bomber) {
      bomber.position.set(x + 300, state.position.y + 18, z + 130); bomber.health = 0.52; bomber.smoke = 1;
      for (let i = 0; i < 9; i++) effects.smoke(bomber.position.clone().add(new THREE.Vector3(18 + i * 18, 2 + i * 3, 5)), 13 + i, 7 - i * 0.4);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(state.orientation);
      const forward = forwardOf(state);
      for (const side of [-1, 1]) {
        const root = state.position.clone().addScaledVector(right, side * 4.1).addScaledVector(forward, 1.2);
        effects.tracer(root, bomber.position.clone().add(new THREE.Vector3(0, 6, 6)), side < 0 ? 0xffd383 : 0xff9860, 0.16);
      }
      effects.muzzle(state.position.clone().addScaledVector(forward, 9), 4);
      effects.contrailLine(state.position.clone().add(new THREE.Vector3(-120, 0, 0)), state.position.clone().add(new THREE.Vector3(-14, 0, 0)));
      app.shotTarget = bomber;
    }
    setCamera(camera, state, 28, 6.5, 5.5, 26, 52);
  }
  aircraft.root.position.copy(state.position); aircraft.root.quaternion.copy(state.orientation);
  aircraft.gear.visible = state.gear;
  hud.setRadio(name === 'cockpit' ? 'KESTREL 1-1, gear down, final.' : name === 'strike' ? 'KESTREL 1-1, SAM launch, break low.' : name === 'dogfight' ? 'KESTREL 1-1, guns, tally bomber.' : 'KESTREL 1-1, gate in sight.');
  return true;
}

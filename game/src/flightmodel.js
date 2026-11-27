import * as THREE from 'three';
import { clamp, approach } from './util.js';

const GRAVITY = 9.80665;
const WING_AREA = 24.5;
const BASE_MASS = 10100;
const vecForward = new THREE.Vector3(0, 0, -1);
const vecUp = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();
const liftAxis = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

export function createFlightState(terrain) {
  const p = terrain.airbase;
  // Sit on the runway surface where the jet actually spawns, so the sortie never opens with a drop.
  const spawnX = p.x - 760, spawnY = p.y + 2.4;
  const state = {
    position: new THREE.Vector3(spawnX, spawnY, p.z),
    previous: new THREE.Vector3(spawnX, spawnY, p.z),
    velocity: new THREE.Vector3(),
    orientation: new THREE.Quaternion(),
    previousOrientation: new THREE.Quaternion(),
    heading: Math.PI / 2, pitch: 0, bank: 0,
    pitchRate: 0, rollRate: 0, yawRate: 0,
    throttle: 0.72, trim: 0, fuel: 2350, burnRate: 0.7,
    mass: BASE_MASS, gLoad: 1, alpha: 0, beta: 0, mach: 0,
    gear: true, flaps: true, airbrake: false, afterburner: false,
    missiles: 4, bombs: 2, gunRounds: 400, flares: 6, weapon: 'gun',
    controls: { pitch: 0, roll: 0, rudder: 0 },
    damage: { engine: 0, hydraulics: 0, fuelLeak: false, fire: false, wing: false },
    destroyed: false, engineOut: false, flameoutTime: 0, overGTime: 0,
    stall: false, buffet: 0, warnings: [], crashReason: '',
    takeoff: false, landed: false, landing: { quality: 0, vertical: 0, center: 0, stopped: false },
    trimInput: 0, lastTouchdown: false, missionTime: 0, ammo: 400,
  };
  euler.set(0, -state.heading, 0, 'YXZ'); state.orientation.setFromEuler(euler); state.previousOrientation.copy(state.orientation);
  return state;
}

export function forwardOf(state, out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(state.orientation); }
export function altitudeAGL(state, terrain) { return Math.max(0, state.position.y - terrain.heightAt(state.position.x, state.position.z)); }

function crash(state, reason) { if (!state.destroyed) { state.destroyed = true; state.crashReason = reason; } }

export function stepFlight(state, input, terrain, dt, effects = null) {
  if (state.destroyed) return;
  const p = state.position, v = state.velocity;
  state.previous.copy(p);
  state.previousOrientation.copy(state.orientation);
  state.warnings.length = 0;
  state.missionTime += dt;
  state.throttle = clamp(state.throttle + input.throttle * 0.58 * dt, 0, 1);
  state.afterburner = !!input.burner && state.throttle > 0.72;
  if (input.gPressed) state.gear = !state.gear;
  if (input.vPressed) state.flaps = !state.flaps;
  state.airbrake = !!input.brake;
  if (input.trimPressed) state.trim = clamp(state.trim + (input.pitch || 1) * 0.015, -0.12, 0.12);
  state.mass = BASE_MASS + state.fuel;
  const speed = Math.max(0.1, v.length());
  const rho = 1.225 * Math.exp(-Math.max(0, p.y) / 8500);
  const q = 0.5 * rho * speed * speed;
  const qAuthority = clamp(q / 3600, 0.12, 1.28) * (1 - state.damage.hydraulics * 0.6);
  state.mach = speed / Math.max(270, 340.3 - p.y * 0.003);
  const fwd = forwardOf(state, tmp);
  const vhat = speed > 1 ? v.clone().multiplyScalar(1 / speed) : fwd.clone();
  state.alpha = Math.asin(clamp(fwd.y - vhat.y, -1, 1));
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(state.orientation);
  state.beta = Math.asin(clamp(right.dot(vhat), -1, 1));
  const stallStart = 15 * Math.PI / 180, stallEnd = 25 * Math.PI / 180;
  let cl = 0.22 + 4.9 * state.alpha;
  if (Math.abs(state.alpha) > stallStart) {
    const excess = clamp((Math.abs(state.alpha) - stallStart) / (stallEnd - stallStart), 0, 1);
    cl = Math.sign(state.alpha) * (1.55 - 0.65 * excess);
    state.stall = true; state.buffet = Math.max(state.buffet, 0.45 + excess * 0.55);
  } else state.stall = false;
  cl = clamp(cl, -0.8, 1.55);
  const agl = altitudeAGL(state, terrain);
  state.agl = agl;
  const groundEffect = agl < 12 ? 1 - 0.08 * (1 - agl / 12) : 1;
  const lift = q * WING_AREA * cl / state.mass * (agl < 14 ? 1.08 : 1);
  let cd = 0.021 + 0.048 * cl * cl;
  if (state.gear) cd += 0.020;
  if (state.flaps) cd += 0.015;
  if (state.airbrake) cd += 0.055;
  cd += state.missiles * 0.002;
  const drag = q * WING_AREA * cd / state.mass * groundEffect;
  let thrust = 62000 * (0.08 + state.throttle * 0.92) * Math.max(0.18, 1 - p.y / 18000);
  if (state.afterburner) thrust *= 1.45;
  thrust *= 1 - state.damage.engine * 0.72;
  if (state.engineOut) thrust = 0;
  const fuelScale = state.afterburner ? 3 : 0.35 + state.throttle * 0.85;
  state.burnRate = state.engineOut ? 0 : (0.55 + fuelScale * 2.25) * (p.y < 9000 ? 1 : 1.25);
  state.fuel = Math.max(0, state.fuel - state.burnRate * dt);
  if (state.fuel <= 0) state.engineOut = true;
  if (state.damage.fuelLeak) state.fuel = Math.max(0, state.fuel - 0.55 * dt);
  if (state.fuel < 220 && !state.warnings.includes('BINGO FUEL')) state.warnings.push('BINGO FUEL');
  if (state.mach > 0.92) state.pitchRate -= 0.12 * dt;

  const controlLag = 5.5;
  state.controls.pitch = approach(state.controls.pitch, input.pitch + state.trim, controlLag, dt);
  state.controls.roll = approach(state.controls.roll, input.roll, controlLag, dt);
  state.controls.rudder = approach(state.controls.rudder, input.rudder, controlLag * 0.8, dt);
  const maxRoll = (Math.PI / 6 + Math.min(Math.PI / 2, speed / 180 * Math.PI * 0.62)) * qAuthority;
  state.rollRate = approach(state.rollRate, -state.controls.roll * maxRoll, 3.2, dt);
  const pitchAuthority = qAuthority * clamp(speed / 75, 0.28, 1.25);
  state.pitchRate = approach(state.pitchRate, state.controls.pitch * 0.58 * pitchAuthority, 3.8, dt);
  state.pitchRate -= state.alpha * 0.18 * dt;
  state.yawRate = approach(state.yawRate, state.controls.rudder * 0.52 * qAuthority - state.beta * 0.9, 3.4, dt);
  if (Math.abs(state.alpha) > 0.34 && Math.abs(state.controls.rudder) > 0.55) {
    state.yawRate += Math.sign(state.controls.rudder) * 0.9 * dt;
    state.bank += Math.sin(state.missionTime * 8) * 0.018;
  }
  state.pitch = clamp(state.pitch + state.pitchRate * dt, -1.05, 1.15);
  state.bank += state.rollRate * dt;
  state.heading += -GRAVITY * Math.tan(clamp(state.bank, -1.42, 1.42)) / Math.max(25, speed) * dt + state.yawRate * dt * 0.12;
  state.heading = Math.atan2(Math.sin(state.heading), Math.cos(state.heading));
  euler.set(state.pitch, -state.heading, state.bank, 'YXZ'); state.orientation.setFromEuler(euler);

  // Recompute the aircraft axes after the smoothed control step.
  const up = vecUp.clone().applyQuaternion(state.orientation);
  liftAxis.copy(up).addScaledVector(vhat, -up.dot(vhat)).normalize();
  const thrustAccel = thrust / state.mass;
  const accel = fwd.clone().multiplyScalar(thrustAccel).addScaledVector(vhat, -drag).addScaledVector(liftAxis, lift).add(new THREE.Vector3(0, -GRAVITY, 0));
  if (speed > 0.01) {
    const turnLoad = Math.abs(lift) / GRAVITY;
    if (turnLoad > 11) { crash(state, 'WING FAILURE'); return; }
    state.gLoad = (lift / GRAVITY) * Math.cos(state.bank);
    if (state.gLoad > 9) state.gLoad = 9;
    if (state.gLoad < -3) state.gLoad = -3;
    state.overGTime = Math.max(0, state.overGTime + (turnLoad > 9 ? dt : -dt * 0.45));
  } else state.gLoad = 1;
  if (state.overGTime > 0.35) state.warnings.push('OVER G');
  if (state.overGTime > 3.8) { state.damage.wing = true; crash(state, 'STRUCTURAL FAILURE'); return; }
  if (Math.abs(state.gLoad) > 11) { crash(state, 'WING FAILURE'); return; }
  if (state.gLoad > 7.5) state.controls.roll *= Math.max(0.45, 1 - (state.gLoad - 7.5) * 0.08);
  state.buffet = Math.max(0, state.buffet - dt * 0.75);
  if (state.stall && !state.warnings.includes('STALL')) state.warnings.push('STALL');
  if (agl < 80 && input.pitch < -0.3) state.warnings.push('PULL UP');

  v.addScaledVector(accel, dt);
  if (state.gear && agl < 2.8 && input.brake) v.x *= 1 - dt * 0.8;
  p.addScaledVector(v, dt);

  const nearRunway = Math.abs(p.x - terrain.airbase.x) < 950 && Math.abs(p.z - terrain.airbase.z) < 31;
  // On the strip the pavement, not the heightfield beneath it, is the surface the jet rolls on.
  const ground = nearRunway ? Math.max(terrain.heightAt(p.x, p.z), terrain.airbase.y + 1.35) : terrain.heightAt(p.x, p.z);
  if (p.y <= ground + 2.2) {
    const vertical = v.y;
    const gearTouch = state.gear && nearRunway && Math.abs(state.bank) < 0.28 && Math.abs(state.pitch) < 0.22;
    if (vertical < -1.2 && gearTouch && !state.lastTouchdown) {
      state.landed = true; state.landing.vertical = -vertical; state.landing.center = Math.abs(p.z - terrain.airbase.z);
      state.landing.quality = vertical > -2 ? 1 : vertical > -6 ? 0.55 : 0.1;
      if (vertical < -9) crash(state, 'HARD LANDING');
      if (effects) effects.touchdown(p, state.landing.quality);
    } else if (vertical < -9) crash(state, nearRunway ? 'HARD LANDING' : 'TERRAIN IMPACT');
    state.lastTouchdown = true;
    p.y = ground + 2.2;
    if (state.gear) {
      v.y = Math.max(0, v.y * -0.12);
      const friction = state.landed ? (input.brake ? 2.6 : 0.28) : 1.2;
      v.x *= Math.max(0, 1 - friction * dt / Math.max(speed, 1)); v.z *= Math.max(0, 1 - friction * dt / Math.max(speed, 1));
      if (v.length() < 3 && state.landed) state.landing.stopped = true;
      if (speed < 67) state.takeoff = false;
    } else {
      crash(state, nearRunway ? 'GEAR UP LANDING' : 'GROUND IMPACT');
    }
  } else state.lastTouchdown = false;
  if (p.y > ground + 6) state.takeoff = true;
  if (state.engineOut) { state.flameoutTime += dt; if (state.flameoutTime > 180 && p.y < 3) crash(state, 'FUEL EXHAUSTION'); }
  if (p.y < 1 && Math.abs(p.x) > 3700) crash(state, 'SEA IMPACT');
  if (Math.abs(p.x) > 4700 || Math.abs(p.z) > 4700) crash(state, 'OUT OF AREA');
  if (state.damage.fire && state.missionTime % 1 < dt && state.damage.engine < 0.95) state.damage.engine += 0.015;
}

export function applyDamage(state, random = Math.random) {
  const hit = Math.floor(random() * 4);
  if (hit === 0) state.damage.engine = Math.min(0.85, state.damage.engine + 0.25);
  if (hit === 1) state.damage.hydraulics = Math.min(0.75, state.damage.hydraulics + 0.32);
  if (hit === 2) state.damage.fuelLeak = true;
  if (hit === 3) state.damage.fire = true;
}


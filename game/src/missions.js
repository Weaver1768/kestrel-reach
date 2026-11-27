import { AIRBASE, LANDMARKS } from './terrain.js';
import { bearingTo } from './util.js';

export const MISSIONS = [
  { id: 'first-light', name: 'First Light', subtitle: 'Training flight through The Narrows', brief: 'Lift from Vane Field. Pass the three canyon gates below 150 m AGL, then return and land.', start: AIRBASE },
  { id: 'iron-rain', name: 'Iron Rain', subtitle: 'Protect Port Anvil', brief: 'Three bombers are inbound from the east. Intercept before they reach Port Anvil. Four missiles, 400 gun rounds.', start: AIRBASE },
  { id: 'blind-mesa', name: 'Blind Mesa', subtitle: 'Low level strike', brief: 'Destroy two radar vans and the SAM launcher. Stay below 60 m AGL near the mesa, then return and land.', start: AIRBASE },
  { id: 'free', name: 'Free Flight', subtitle: 'The whole Cinder Coast', brief: 'No tasking. Fly the coast, work the canyon, or take the Kestrel to the ridge.', start: AIRBASE },
];

export function createMissionSystem() {
  let current = MISSIONS[0], phase = 'idle', objectiveIndex = 0, complete = false, failed = false, report = null;
  let startTime = 0, score = 0, destroyed = 0, gateTimes = [0, 0, 0], damageAtStart = 0;
  const gateX = [-1250, -150, 950];
  const getWaypoint = (state) => {
    if (current.id === 'first-light') {
      if (objectiveIndex < 3) { const x = gateX[objectiveIndex], z = 350 * Math.sin(x * 0.00062) + 0.11 * x - 180; return { x, y: 180, z, name: `GATE ${objectiveIndex + 1}` }; }
      return { x: AIRBASE.x, y: AIRBASE.y, z: AIRBASE.z, name: 'VANE FIELD' };
    }
    if (current.id === 'iron-rain' && phase === 'active') return { x: -700, y: 1000, z: -1500, name: 'INTERCEPT' };
    if (current.id === 'blind-mesa' && phase === 'active') return { x: 2450, y: 400, z: 420, name: 'BLIND MESA' };
    return { x: AIRBASE.x, y: AIRBASE.y, z: AIRBASE.z, name: 'VANE FIELD' };
  };
  const begin = (mission, state, enemies) => {
    current = typeof mission === 'string' ? MISSIONS.find((m) => m.id === mission) || MISSIONS[0] : mission || current;
    phase = 'active'; objectiveIndex = 0; complete = false; failed = false; report = null; score = 0; destroyed = 0; gateTimes = [0, 0, 0]; startTime = 0;
    damageAtStart = 0;
    if (enemies) enemies.setMission(current.id);
    if (current.id === 'free') complete = false;
  };
  const grade = (points) => points >= 8800 ? 'S' : points >= 7200 ? 'A' : points >= 5600 ? 'B' : points >= 3900 ? 'C' : 'D';
  const makeReport = (state, elapsed, reason = '') => {
    const objectivePoints = score;
    const timeBonus = Math.max(0, Math.round(2200 - elapsed * 2.2));
    const munitions = Math.round((state.missiles * 125 + state.bombs * 120 + state.gunRounds * 1.3));
    const damage = Math.round((state.damage.engine + state.damage.hydraulics + (state.damage.fire ? 0.5 : 0) + (state.damage.fuelLeak ? 0.35 : 0)) * 1100);
    const landing = state.landing.quality ? Math.round(1700 * state.landing.quality + (state.landing.stopped ? 400 : 0) + Math.max(0, 300 - state.landing.center * 9)) : 0;
    const total = Math.max(0, objectivePoints + timeBonus + munitions + landing - damage);
    report = { grade: grade(total), total, objectivePoints, timeBonus, munitions, damage, landing, reason };
  };
  return {
    get current() { return current; }, get phase() { return phase; }, get complete() { return complete; }, get failed() { return failed; }, get report() { return report; },
    get objectiveIndex() { return objectiveIndex; }, begin, getWaypoint,
    update(dt, state, enemies) {
      if (phase !== 'active') return this.snapshot(state);
      startTime += dt;
      if (state.destroyed) { failed = true; phase = 'after'; makeReport(state, startTime, state.crashReason); return this.snapshot(state); }
      if (current.id === 'first-light') {
        if (objectiveIndex < 3) {
          const x = gateX[objectiveIndex], z = 350 * Math.sin(x * 0.00062) + 0.11 * x - 180;
          if (Math.hypot(state.position.x - x, state.position.z - z) < 48 && state.agl < 150) {
            objectiveIndex++; score += 1300; gateTimes[objectiveIndex - 1] = startTime;
          }
        } else if (state.landed && state.landing.stopped) {
          complete = true; phase = 'after'; score += 1600; makeReport(state, startTime); return this.snapshot(state);
        }
      } else if (current.id === 'iron-rain') {
        const alive = enemies.targets().filter((e) => e.type === 'bomber').length;
        destroyed = 3 - alive;
        for (const e of enemies.list) if (e.type === 'bomber' && e.reachedCity) failed = true;
        if (destroyed >= 3 && !complete) { complete = true; score += 4000; objectiveIndex = 1; }
        if (complete && state.landed && state.landing.stopped) { phase = 'after'; score += 1200; makeReport(state, startTime); return this.snapshot(state); }
        if (failed) { phase = 'after'; makeReport(state, startTime, 'BOMBERS REACHED PORT ANVIL'); return this.snapshot(state); }
      } else if (current.id === 'blind-mesa') {
        const alive = enemies.targets().filter((e) => e.type === 'ground').length;
        destroyed = 3 - alive;
        if (destroyed >= 3 && !complete) { complete = true; score += 4000; objectiveIndex = 1; }
        if (complete && state.landed && state.landing.stopped) { phase = 'after'; score += 1200; makeReport(state, startTime); return this.snapshot(state); }
      }
      if (current.id === 'free') return this.snapshot(state);
      return this.snapshot(state);
    },
    snapshot(state) {
      let objective = '';
      if (current.id === 'first-light') objective = objectiveIndex < 3 ? `PASS GATE ${objectiveIndex + 1} BELOW 150 M` : 'RETURN TO VANE FIELD AND LAND';
      else if (current.id === 'iron-rain') objective = complete ? 'RTB AND LAND' : `DESTROY BOMBERS ${destroyed}/3`;
      else if (current.id === 'blind-mesa') objective = complete ? 'RTB AND LAND' : `DESTROY MESA SITE ${destroyed}/3`;
      else objective = 'FREE FLIGHT - NO TASKING';
      const waypoint = getWaypoint(state);
      return { current, phase, objective, waypoint, complete, failed, report, elapsed: startTime, score, objectiveIndex, gates: gateTimes, headingToWaypoint: bearingTo(state.position, waypoint) };
    },
  };
}


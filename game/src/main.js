import * as THREE from 'three';
import { createInput } from './input.js';
import { createTerrain } from './terrain.js';
import { createScenery } from './scenery.js';
import { createAircraft, updateAircraft } from './aircraft.js';
import { createFlightState, stepFlight } from './flightmodel.js';
import { createCameraRig } from './camera.js';
import { createEffects } from './effects.js';
import { createWeapons } from './weapons.js';
import { createEnemies } from './enemies.js';
import { createMissionSystem } from './missions.js';
import { createHUD } from './hud.js';
import { createCockpit } from './cockpit.js';
import { readInstruments } from './instruments.js';
import { createAudio } from './audio.js';
import { createScreens } from './screens.js';
import { configureShot } from './shots.js';

const FIXED = 1 / 120;
const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot') || '';
const viewCanvas = document.getElementById('view');
const hudCanvas = document.getElementById('hud');
const screenCanvas = document.getElementById('screen');
const renderer = new THREE.WebGLRenderer({ canvas: viewCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.2, 18000);
const terrain = createTerrain(scene, seed);
const scenery = createScenery(scene, seed);
const aircraft = createAircraft(scene);
const cockpit = createCockpit(aircraft);
const effects = createEffects(scene, seed);
const audio = createAudio();
const missions = createMissionSystem();
const enemies = createEnemies(scene, terrain, effects, seed);
let state = createFlightState(terrain);
const weapons = createWeapons(scene, effects, state, audio);
const input = createInput(viewCanvas);
const cameraRig = createCameraRig(camera, viewCanvas);
const hud = createHUD(hudCanvas);
const screens = createScreens(screenCanvas);
const renderState = {
  position: new THREE.Vector3(), velocity: new THREE.Vector3(), orientation: new THREE.Quaternion(),
  heading: 0, pitch: 0, bank: 0, throttle: 0, fuel: 0, burnRate: 1, gLoad: 1, alpha: 0, beta: 0,
  gear: true, flaps: true, airbrake: false, afterburner: false, missiles: 4, bombs: 2, gunRounds: 400,
  weapon: 'gun', damage: state.damage, warnings: [], stall: false, missionTime: 0, trim: 0,
};
let missionData = missions.snapshot(state);
let weaponsData = weapons.update(0, {}, enemies.targets(), terrain);
let enemyStatus = { samWarning: 0 };
let crashHandled = false, afterShown = false, accumulator = 0, lastFrame = 0, frameCount = 0, shotMode = false, shotTarget = null;

function resize() {
  const w = window.innerWidth, h = window.innerHeight, dpr = renderer.getPixelRatio();
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  for (const canvas of [hudCanvas, screenCanvas]) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; }
}
window.addEventListener('resize', resize);
resize();
cameraRig.snap(state, terrain);

function copyStateForRender(alpha) {
  renderState.position.copy(state.previous).lerp(state.position, alpha);
  renderState.velocity.copy(state.velocity);
  renderState.orientation.copy(state.previousOrientation).slerp(state.orientation, alpha);
  for (const key of ['heading', 'pitch', 'bank', 'throttle', 'fuel', 'burnRate', 'gLoad', 'alpha', 'beta', 'gear', 'flaps', 'airbrake', 'afterburner', 'missiles', 'bombs', 'gunRounds', 'weapon', 'stall', 'missionTime', 'trim', 'destroyed', 'mach', 'agl', 'flares', 'buffet']) renderState[key] = state[key];
  renderState.damage = state.damage; renderState.warnings = state.warnings; renderState.controls = state.controls;
}

function resetFlight(mission) {
  const fresh = createFlightState(terrain);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  weapons.reset(); enemies.reset();
  missions.begin(mission, state, enemies);
  weaponsData = weapons.update(0, {}, enemies.targets(), terrain);
  enemyStatus = { samWarning: 0 }; crashHandled = false; afterShown = false; accumulator = 0;
  cameraRig.setMode('chase'); cameraRig.snap(state, terrain); hud.setRadio('KESTREL 1-1, cleared for takeoff.');
  updateAircraft(aircraft, state);
}

function processActions(actions) {
  for (const action of actions) {
    if (action.type === 'start') { audio.start(); resetFlight(action.mission); }
    if (action.type === 'menu') { accumulator = 0; }
  }
}

function drawOverlay(width, height, dpr, dt, time, controls) {
  copyStateForRender(shotMode ? 1 : Math.min(1, accumulator / FIXED));
  updateAircraft(aircraft, renderState);
  if (!shotMode) cameraRig.update(dt, renderState, controls, terrain);
  cockpit.update(dt, { state: renderState, instruments: readInstruments(renderState, terrain), cameraMode: shotMode ? (shot === 'cockpit' ? 'cockpit' : 'chase') : cameraRig.mode });
  weaponsData = shotMode ? weapons.update(0, {}, enemies.targets(), terrain) : weaponsData;
  const instruments = readInstruments(renderState, terrain);
  const hudContext = hudCanvas.getContext('2d');
  hudContext.setTransform(1, 0, 0, 1, 0, 0); hudContext.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  hudContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  const hudVisible = shotMode || (screens.view !== 'title' && screens.view !== 'briefing');
  if (hudVisible) hud.draw(width, height, { state: renderState, instruments, mission: missionData, weapons: weaponsData, cameraMode: shotMode ? (shot === 'cockpit' ? 'cockpit' : 'chase') : cameraRig.mode, shotTarget, dt: shotMode ? 0 : dt, time: shotMode ? renderState.missionTime : time, extraWarnings: enemyStatus.samWarning > 0 ? ['MISSILE INBOUND'] : [] });
  const screenContext = screenCanvas.getContext('2d'); screenContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  screens.draw(width, height, missionData);
}

function frame(timestamp) {
  requestAnimationFrame(frame);
  const width = window.innerWidth, height = window.innerHeight, dpr = renderer.getPixelRatio();
  const raw = lastFrame ? (timestamp - lastFrame) / 1000 : 0; lastFrame = timestamp;
  const dt = Math.min(0.05, Math.max(0, raw));
  if (shotMode) {
    drawOverlay(width, height, dpr, 0, state.missionTime, {});
    renderer.render(scene, camera);
    frameCount++;
    if (frameCount >= 2) window.__shotReady = true;
    return;
  }
  const controls = input.update(dt);
  weapons.slew(controls.mouseX, controls.mouseY, cameraRig.mode === 'cockpit');
  if (controls.startPressed || controls.clickGun || controls.clickFire) audio.start();
  if (controls.volumeDown) audio.adjust(-0.05);
  if (controls.volumeUp) audio.adjust(0.05);
  const actions = screens.update(controls, missionData); processActions(actions);
  if (screens.view === 'flight') {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED && steps < 8) {
      const wasLanded = state.landed, wasDestroyed = state.destroyed;
      stepFlight(state, controls, terrain, FIXED, effects);
      if (controls.gPressed || controls.vPressed) audio.play('servo');
      if (!wasLanded && state.landed) audio.play('touchdown');
      if (!wasDestroyed && state.destroyed && !crashHandled) {
        crashHandled = true; state.damage.fire = true;
        effects.explode(state.position.clone(), 0.75); effects.smoke(state.position.clone(), 8, 10);
      }
      enemyStatus = enemies.update(FIXED, state, weapons, audio, controls);
      weaponsData = weapons.update(FIXED, controls, enemies.targets(), terrain);
      missionData = missions.update(FIXED, state, enemies);
      if (missionData.phase === 'after' && !afterShown) { screens.showAfter(missionData.report); afterShown = true; accumulator = 0; }
      if (steps === 0) {
        controls.gPressed = false; controls.vPressed = false; controls.weaponPressed = false; controls.trimPressed = false;
      }
      accumulator -= FIXED; steps++;
      if (screens.view !== 'flight') break;
    }
    if (steps >= 8) accumulator = 0;
    effects.update(dt, state); scenery.update(dt, state); audio.update(state);
  } else {
    accumulator = 0;
    scenery.update(dt * 0.15, state); audio.update(state);
  }
  drawOverlay(width, height, dpr, dt, state.missionTime, controls);
  renderer.render(scene, camera);
}

const shotName = params.get('shot');
if (shotName) {
  const shotApp = { state, terrain, camera, aircraft, missions, enemies, weapons, effects, hud, cameraRig };
  shotMode = configureShot(shotName, shotApp);
  if (shotMode) {
    shotTarget = shotApp.shotTarget || null;
    const mode = shotName === 'cockpit' ? 'cockpit' : 'chase'; cameraRig.setMode(mode);
    missionData = missions.snapshot(state); screens.setView('flight');
  }
}
window.__shotReady = false;
window.addEventListener('keydown', () => audio.start(), { once: true });
viewCanvas.addEventListener('pointerdown', () => audio.start(), { once: true });
requestAnimationFrame(frame);


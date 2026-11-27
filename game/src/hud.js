import * as THREE from 'three';
import { clamp } from './util.js';
import {
  INSTRUMENT_STYLE as STYLE,
  drawInstrumentText as text,
  drawInstrumentRule as rule,
  drawInstrumentPanel as panel,
  drawInstrumentVignette,
} from './instruments.js';
import { drawCockpitOverlay } from './cockpit.js';

function formatNumber(value) {
  return Math.round(value || 0).toLocaleString('en-US').replace(/,/g, ' ');
}

function formatClock(value) {
  const seconds = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function drawHeading(ctx, heading) {
  const x0 = 410, y0 = 32, width = 460, height = 48, axisY = 58;
  panel(ctx, x0, y0, width, height);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 + 1, y0 + 1, width - 2, height - 2); ctx.clip();
  const nearest = Math.round(heading / 5) * 5;
  for (let offset = -55; offset <= 55; offset += 5) {
    const raw = nearest + offset;
    const degree = (raw + 360) % 360;
    const x = 640 + (raw - heading) * 4.4;
    if (x < x0 || x > x0 + width) continue;
    const isMajor = degree % 30 === 0;
    const isMedium = degree % 10 === 0;
    rule(ctx, x, axisY, x, axisY - (isMajor ? 14 : isMedium ? 9 : 5), isMajor ? STYLE.stroke : STYLE.dim, 1);
    if (isMajor) {
      const cardinal = degree === 0 ? 'N' : degree === 90 ? 'E' : degree === 180 ? 'S' : degree === 270 ? 'W' : '';
      text(ctx, cardinal || String(Math.round(degree / 10)).padStart(2, '0'), x, y0 + 9, { size: 10, align: 'center' });
    }
  }
  rule(ctx, x0 + 8, axisY, x0 + width - 8, axisY, STYLE.dim, 1);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = STYLE.amber; ctx.lineWidth = 1.5; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(640, 62); ctx.lineTo(634, 68); ctx.lineTo(646, 68); ctx.closePath(); ctx.stroke();
  ctx.restore();
  panel(ctx, 612, 70, 56, 24);
  text(ctx, String(Math.round(heading) % 360).padStart(3, '0'), 640, 82, { size: 12, color: STYLE.amber, align: 'center' });
}

function drawTape(ctx, config) {
  const { x, y, height, value, step, label, side, pixelsPerUnit, formatter } = config;
  const left = side === 'left' ? x - 80 : x;
  panel(ctx, left, y - height / 2, 80, height);
  ctx.save();
  ctx.beginPath(); ctx.rect(left + 1, y - height / 2 + 1, 78, height - 2); ctx.clip();
  const start = Math.floor(value / step) * step;
  const first = start - step * Math.ceil(height / pixelsPerUnit / step / 2) - step;
  const last = start + step * Math.ceil(height / pixelsPerUnit / step / 2) + step;
  for (let tick = first; tick <= last; tick += step) {
    const py = y + (value - tick) * pixelsPerUnit;
    if (py < y - height / 2 || py > y + height / 2) continue;
    const major = Math.abs(tick % (step * (side === 'left' ? 5 : 5))) < 0.001;
    const tickColor = major ? STYLE.stroke : STYLE.dim;
    if (side === 'left') {
      rule(ctx, x - (major ? 25 : 13), py, x, py, tickColor, 1);
      if (major) text(ctx, formatter(tick), x - 29, py, { size: 10, align: 'right' });
    } else {
      rule(ctx, x, py, x + (major ? 25 : 13), py, tickColor, 1);
      if (major) text(ctx, formatter(tick), x + 29, py, { size: 10, align: 'left' });
    }
  }
  rule(ctx, x, y - height / 2, x, y + height / 2, STYLE.stroke, 1);
  ctx.restore();

  const labelX = side === 'left' ? x - 80 : x;
  panel(ctx, labelX, y - height / 2 - 22, 80, 18);
  text(ctx, label, labelX + 40, y - height / 2 - 13, { kind: 'label', align: 'center' });
}

function drawAirData(ctx, instruments) {
  const tapeY = 380, tapeHeight = 300;
  drawTape(ctx, {
    x: 168, y: tapeY, height: tapeHeight, value: instruments.knots || 0,
    step: 10, label: 'AIRSPEED', side: 'left', pixelsPerUnit: 1.5,
    formatter: (value) => String(Math.round(value)),
  });
  drawTape(ctx, {
    x: 1112, y: tapeY, height: tapeHeight, value: instruments.feet || 0,
    step: 200, label: 'ALTITUDE', side: 'right', pixelsPerUnit: 0.03,
    formatter: (value) => String(Math.round(value / 1000)),
  });

  panel(ctx, 90, 366, 78, 28);
  text(ctx, String(Math.round(instruments.knots || 0)), 119, 380, { size: 13, align: 'center' });
  text(ctx, 'KT', 155, 380, { size: 10, color: STYLE.amber, align: 'center' });
  panel(ctx, 99, 399, 69, 19);
  text(ctx, `M ${(instruments.mach || 0).toFixed(2)}`, 133, 408, { size: 10, align: 'center' });

  panel(ctx, 1112, 366, 78, 28);
  text(ctx, formatNumber(instruments.feet || 0), 1150, 380, { size: 12, align: 'center' });
  text(ctx, 'FT', 1178, 380, { size: 10, color: STYLE.amber, align: 'center' });
  if ((instruments.radarFeet || 0) < 1500) {
    panel(ctx, 1112, 399, 78, 20);
    text(ctx, `R ${Math.round(instruments.radarFeet || 0)}`, 1151, 409, { size: 10, align: 'center' });
  }

  panel(ctx, 1192, 282, 72, 22);
  text(ctx, `${(instruments.sink || 0) >= 0 ? '+' : ''}${(instruments.sink || 0).toFixed(1)}`, 1228, 293, { size: 11, align: 'center' });
  ctx.save();
  ctx.fillStyle = STYLE.ink; ctx.fillRect(1217, 300, 6, 160);
  ctx.strokeStyle = STYLE.dim; ctx.lineWidth = 1; ctx.strokeRect(1217.5, 300.5, 5, 159);
  const needleY = clamp(380 + (instruments.sink || 0) * 14, 302, 458);
  rule(ctx, 1208, needleY, 1232, needleY, STYLE.amber, 2);
  ctx.restore();
}

function drawPitchLadder(ctx, instruments) {
  ctx.save();
  ctx.beginPath(); ctx.rect(330, 170, 620, 420); ctx.clip();
  ctx.translate(640, 380);
  ctx.rotate(-((instruments.bank || 0) * Math.PI / 180));
  const pitch = instruments.pitch || 0;
  const horizonY = pitch * 6;
  for (let mark = -40; mark <= 40; mark += 5) {
    const y = horizonY - mark * 6;
    if (y < -230 || y > 230) continue;
    const long = mark % 10 === 0;
    const half = long ? 132 : 88;
    const color = mark === 0 ? STYLE.stroke : long ? STYLE.stroke : STYLE.dim;
    const width = mark === 0 ? 2 : 1;
    rule(ctx, -half, y, -45, y, color, width);
    rule(ctx, 45, y, half, y, color, width);
    if (long && mark !== 0) {
      const value = `${Math.abs(mark)}${mark > 0 ? '+' : '-'}`;
      text(ctx, value, -half - 10, y, { size: 10, color, align: 'right' });
      text(ctx, value, half + 10, y, { size: 10, color, align: 'left' });
    }
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = STYLE.stroke; ctx.lineWidth = 1.5; ctx.shadowBlur = 6; ctx.shadowColor = STYLE.stroke;
  ctx.beginPath(); ctx.moveTo(629, 174); ctx.lineTo(640, 190); ctx.lineTo(651, 174); ctx.stroke();
  ctx.restore();
}

function localDirection(state, worldPosition) {
  return worldPosition.clone().sub(state.position).applyQuaternion(state.orientation.clone().invert());
}

function drawFlightPathAndGun(ctx, state) {
  const centerX = 640, centerY = 380;
  ctx.save();
  ctx.strokeStyle = STYLE.amber; ctx.lineWidth = 1.4; ctx.shadowBlur = 0;
  rule(ctx, centerX - 13, centerY, centerX - 4, centerY, STYLE.amber, 1.4);
  rule(ctx, centerX + 4, centerY, centerX + 13, centerY, STYLE.amber, 1.4);
  rule(ctx, centerX, centerY - 13, centerX, centerY - 4, STYLE.amber, 1.4);
  rule(ctx, centerX, centerY + 4, centerX, centerY + 13, STYLE.amber, 1.4);
  ctx.restore();

  const speed = state.velocity ? state.velocity.length() : 0;
  if (speed > 2) {
    const velocity = state.velocity.clone().applyQuaternion(state.orientation.clone().invert());
    const z = Math.max(0.1, -velocity.z);
    const fx = clamp(centerX + velocity.x / z * 550, 350, 930);
    const fy = clamp(centerY - velocity.y / z * 550, 190, 570);
    ctx.save(); ctx.strokeStyle = STYLE.stroke; ctx.lineWidth = 1.4; ctx.shadowColor = STYLE.stroke; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(fx, fy, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx - 19, fy); ctx.lineTo(fx - 8, fy); ctx.moveTo(fx + 8, fy); ctx.lineTo(fx + 19, fy);
    ctx.moveTo(fx, fy + 8); ctx.lineTo(fx, fy + 16); ctx.stroke();
    ctx.restore();
  }
}

function projectLocal(direction) {
  let x = direction.x, y = direction.y, z = direction.z;
  if (z > 0) { x = -x; y = -y; z = -z; }
  const depth = Math.max(0.1, -z);
  return { x: 640 + x / depth * 550, y: 380 - y / depth * 550 };
}

function drawWaypoint(ctx, state, mission) {
  const waypoint = mission && mission.waypoint;
  if (!waypoint || !state.position || !state.orientation) return;
  const world = new THREE.Vector3(waypoint.x, waypoint.y, waypoint.z);
  const projected = projectLocal(localDirection(state, world));
  const distance = world.distanceTo(state.position);
  const bounds = { left: 36, right: 1244, top: 132, bottom: 636 };
  const offscreen = projected.x < bounds.left || projected.x > bounds.right || projected.y < bounds.top || projected.y > bounds.bottom;
  const x = clamp(projected.x, bounds.left, bounds.right), y = clamp(projected.y, bounds.top, bounds.bottom);
  if (offscreen) {
    const angle = Math.atan2(projected.y - 380, projected.x - 640);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = STYLE.amber; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-7, -6); ctx.lineTo(-7, 6); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = STYLE.amber; ctx.lineWidth = 1.3; ctx.shadowBlur = 0;
  ctx.strokeRect(-7, -7, 14, 14); ctx.restore();
  const labelY = offscreen && y > 500 ? y - 27 : y + 23;
  const labelWidth = 130;
  const labelX = clamp(x - labelWidth / 2, 8, 1280 - labelWidth - 8);
  panel(ctx, labelX, labelY - 9, labelWidth, 18, { stroke: STYLE.amber });
  text(ctx, `${waypoint.name || 'WAYPOINT'}  ${formatNumber(distance)} M`, labelX + labelWidth / 2, labelY, { kind: 'label', size: 9, color: STYLE.amber, align: 'center' });
}

function drawTarget(ctx, state, weapons, shotTarget) {
  const target = shotTarget || weapons.target;
  if (!target || !target.position || !state.position || !state.orientation) return;
  const rel = localDirection(state, target.position);
  if (-rel.z <= 0.1) return;
  const projected = projectLocal(rel);
  const x = clamp(projected.x, 30, 1250), y = clamp(projected.y, 125, 635);
  const locked = weapons.target === target && (weapons.lockTime || 0) >= 1.25;
  ctx.save(); ctx.strokeStyle = locked ? STYLE.amber : STYLE.stroke; ctx.lineWidth = 1.4;
  ctx.shadowColor = locked ? STYLE.amber : STYLE.stroke; ctx.shadowBlur = locked ? 0 : 6;
  ctx.strokeRect(x - 17, y - 17, 34, 34);
  rule(ctx, x - 26, y, x - 17, y, locked ? STYLE.amber : STYLE.stroke, 1);
  rule(ctx, x + 17, y, x + 26, y, locked ? STYLE.amber : STYLE.stroke, 1);
  ctx.restore();
  const delta = target.position.clone().sub(state.position);
  const range = delta.length();
  const closure = Math.max(0, state.velocity.dot(delta.clone().normalize()));
  const callout = `R ${range >= 1000 ? `${(range / 1000).toFixed(1)} KM` : `${Math.round(range)} M`}  C ${Math.round(closure)} M/S`;
  const boxY = clamp(y + 23, 106, 658);
  panel(ctx, clamp(x - 80, 4, 1116), boxY, 160, 19, { stroke: locked ? STYLE.amber : STYLE.stroke });
  text(ctx, callout, clamp(x, 84, 1196), boxY + 9, { size: 10, align: 'center' });
  if (locked) {
    panel(ctx, x - 27, y - 37, 54, 17, { stroke: STYLE.amber });
    text(ctx, 'LOCK', x, y - 28, { kind: 'label', color: STYLE.amber, align: 'center' });
  }
}

function drawObjectiveAndRadio(ctx, mission, radio, radioTime) {
  if (radioTime > 0 && radio) {
    const alpha = clamp(radioTime / 1.2, 0, 1);
    panel(ctx, 438, 4, 404, 22, { stroke: STYLE.dim });
    ctx.save(); ctx.globalAlpha = alpha;
    text(ctx, radio, 640, 15, { size: 11, align: 'center' });
    rule(ctx, 448, 26, 832, 26, STYLE.dim, 1);
    ctx.restore();
  }
  if (mission && mission.objective) {
    text(ctx, 'OBJECTIVE', 640, 99, { kind: 'label', color: STYLE.dim, align: 'center' });
    panel(ctx, 386, 102, 508, 22);
    text(ctx, mission.objective, 640, 113, { size: 11, color: STYLE.amber, align: 'center' });
  }
}

function drawBottomPanel(ctx, state, instruments) {
  const x = 320, y = 640, width = 640, height = 58;
  panel(ctx, x, y, width, height);
  const leftOne = `THR ${Math.round((state.throttle || 0) * 100)}  FUEL ${Math.round(instruments.fuel || 0)} KG  ${formatClock(instruments.timeFuel)}  G ${((instruments.g || 0) * 1).toFixed(1)}  M ${(instruments.mach || 0).toFixed(2)}`;
  const leftTwo = `${state.gear ? 'GEAR DN' : 'GEAR UP'}  ${state.flaps ? 'FLAPS' : 'CLEAN'}`;
  const rightTwo = `IR ${state.missiles || 0}  GUN ${state.gunRounds || 0}`;
  text(ctx, leftOne, x + 12, y + 16, { size: 11 });
  text(ctx, leftTwo, x + 12, y + 41, { size: 11 });
  text(ctx, rightTwo, x + width - 12, y + 41, { size: 11, align: 'right' });
}

function warningList(state, instruments, forced) {
  const warnings = [...(state.warnings || []), ...(forced || [])];
  if (state.stall) warnings.push('STALL');
  if (Math.abs(instruments.g || 0) > 8.4) warnings.push('OVER G');
  if (!state.gear && instruments.knots < 140 && instruments.agl < 450) warnings.push('GEAR');
  if (state.fuel < 220) warnings.push('BINGO FUEL');
  return [...new Set(warnings.map((warning) => String(warning).toUpperCase()))];
}

function drawWarnings(ctx, data) {
  const warnings = warningList(data.state, data.instruments, data.extraWarnings);
  if (!warnings.length || Math.sin((data.time || 0) * Math.PI * 6) < 0) return;
  const label = warnings.join('  /  ');
  const width = clamp(label.length * 8 + 36, 150, 720);
  panel(ctx, 640 - width / 2, 533, width, 25, { stroke: STYLE.alert });
  text(ctx, label, 640, 546, { size: 13, color: STYLE.alert, align: 'center' });
}

function drawOverG(ctx, state, instruments) {
  const g = instruments.g || 0;
  if (g <= 8.4) return;
  const alpha = clamp((g - 8.4) * 0.09, 0.08, 0.34);
  ctx.save(); ctx.fillStyle = `rgba(205,210,207,${alpha})`; ctx.fillRect(0, 0, 1280, 720); ctx.restore();
  const gradient = ctx.createRadialGradient(640, 360, 90, 640, 360, 520);
  gradient.addColorStop(0, 'rgba(6,10,10,0)'); gradient.addColorStop(1, 'rgba(6,10,10,0.25)');
  ctx.save(); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720); ctx.restore();
  panel(ctx, 1150, 458, 76, 24, { stroke: STYLE.amber });
  text(ctx, `G ${g.toFixed(1)}`, 1188, 470, { size: 12, color: STYLE.amber, align: 'center' });
}

function drawHUDSymbols(ctx, data, radio, radioTime) {
  const state = data.state || {};
  const instruments = data.instruments || {};
  const weapons = data.weapons || {};
  drawHeading(ctx, instruments.heading || 0);
  drawObjectiveAndRadio(ctx, data.mission, radio, radioTime);
  drawAirData(ctx, instruments);
  drawPitchLadder(ctx, instruments);
  drawFlightPathAndGun(ctx, state);
  drawTarget(ctx, state, weapons, data.shotTarget);
  drawWaypoint(ctx, state, data.mission);
  drawBottomPanel(ctx, state, instruments);
  drawWarnings(ctx, { ...data, state, instruments });
  drawOverG(ctx, state, instruments);
}

export function createHUD(canvas) {
  const ctx = canvas.getContext('2d');
  let radio = 'KESTREL 1-1, SYSTEMS CHECK.';
  let radioTime = 6;
  let lastObjective = '';
  const setRadio = (message) => { radio = String(message || ''); radioTime = 6; };

  return {
    setRadio,
    draw(width, height, data) {
      const pixelWidth = canvas.width || width;
      const pixelHeight = canvas.height || height;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pixelWidth, pixelHeight);
      ctx.setTransform(pixelWidth / 1280, 0, 0, pixelHeight / 720, 0, 0);
      radioTime = Math.max(0, radioTime - (data.dt || 0));
      const mission = data.mission || {};
      if (mission.objective && mission.objective !== lastObjective) {
        lastObjective = mission.objective;
        setRadio(`KESTREL 1-1, ${mission.objective}.`);
      }
      drawInstrumentVignette(ctx, 1280, 720);
      if (data.cameraMode === 'cockpit') {
        drawCockpitOverlay(ctx, 1280, 720, data, () => {
          ctx.save();
          ctx.translate(640, 230); ctx.scale(0.48, 0.48); ctx.translate(-640, -230);
          ctx.globalAlpha *= 0.68;
          drawHUDSymbols(ctx, { ...data, mission }, radio, radioTime);
          ctx.restore();
        });
      } else {
        drawHUDSymbols(ctx, { ...data, mission }, radio, radioTime);
      }
      ctx.restore();
    },
  };
}

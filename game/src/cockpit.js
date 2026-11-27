import * as THREE from 'three';

// Palette shared with instruments.js so the 2D glass and the 3D panel match.
const INK = '#0b1211';
const PANEL = '#161d1c';
const EDGE = '#2d3a37';
const MINT = '#c9f5d9';
const AMBER = '#ffc26b';
const ALERT = '#ff6f4a';
const DIM = 'rgba(201,245,217,0.38)';
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';

// ---------------------------------------------------------------------------
// Panel texture: a 2048 x 512 canvas painted once per update tick.
// ---------------------------------------------------------------------------

function makePanel() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d'), texture };
}

// Small letterspaced label used on the panel.
function stencil(ctx, value, x, y, size, color, align = 'center') {
  ctx.save();
  ctx.font = `600 ${size}px ${MONO}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value.toUpperCase(), x, y);
  ctx.restore();
}

// Bezel, glass, and the 270 degree tick ring of one round gauge.
function gaugeBody(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.fillStyle = '#202927'; ctx.fill();
  ctx.strokeStyle = '#39463f'; ctx.lineWidth = 2; ctx.stroke();

  const glass = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.45, r * 0.1, cx, cy, r);
  glass.addColorStop(0, '#18211f');
  glass.addColorStop(1, '#070d0c');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = glass; ctx.fill();
  ctx.restore();
}

function angleFor(t) {
  return (135 + 270 * t) * Math.PI / 180;
}

function gaugeTicks(ctx, cx, cy, r, divisions, majorEvery) {
  ctx.save();
  for (let i = 0; i <= divisions; i++) {
    const a = angleFor(i / divisions);
    const major = i % majorEvery === 0;
    const inner = r - (major ? 15 : 8);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
    ctx.strokeStyle = major ? MINT : DIM;
    ctx.lineWidth = major ? 2 : 1;
    ctx.stroke();
  }
  ctx.restore();
}

// A needle with a soft shadow so it reads against the dark glass.
function needle(ctx, cx, cy, length, t, color = AMBER, width = 3) {
  const a = angleFor(t);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(length, 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#c9c2ae'; ctx.fill();
  ctx.restore();
}

function gaugeCaption(ctx, cx, deep, text, sub) {
  stencil(ctx, text, cx, deep + 18, 13, MINT);
  if (sub) stencil(ctx, sub, cx, deep + 34, 11, DIM);
}

// Airspeed dial with a white arc for the flap limit.
function airspeedGauge(ctx, cx, cy, r, knots) {
  gaugeBody(ctx, cx, cy, r);
  gaugeTicks(ctx, cx, cy, r, 10, 2);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 21, angleFor(0.72), angleFor(0.86));
  ctx.strokeStyle = 'rgba(255,111,74,0.7)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();
  needle(ctx, cx, cy, r - 16, Math.max(0, Math.min(1, knots / 600)));
  stencil(ctx, String(Math.round(knots)), cx, cy + r * 0.52, 18, MINT);
  gaugeCaption(ctx, cx, cy + r, 'airspeed', 'knots');
}

// Attitude ball: a horizon that rolls and slides with the aircraft.
function attitudeGauge(ctx, cx, cy, r, pitch, bank) {
  gaugeBody(ctx, cx, cy, r);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-bank * Math.PI / 180);
  ctx.translate(0, pitch * 2.4);
  ctx.fillStyle = '#2f4f57'; ctx.fillRect(-r * 2, -r * 3, r * 4, r * 3);
  ctx.fillStyle = '#57392a'; ctx.fillRect(-r * 2, 0, r * 4, r * 3);
  ctx.strokeStyle = '#e7dcc2'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r * 2, 0); ctx.lineTo(r * 2, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(231,220,194,0.45)'; ctx.lineWidth = 1;
  for (const mark of [-20, -10, 10, 20]) {
    const y = -mark * 2.4;
    ctx.beginPath(); ctx.moveTo(-16, y); ctx.lineTo(16, y); ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = AMBER; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 8, cy); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 26, cy);
  ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 7); ctx.stroke();
  ctx.restore();
  gaugeCaption(ctx, cx, cy + r, 'attitude', '');
}

// Altimeter with a thousands drum and a hundreds needle.
function altimeterGauge(ctx, cx, cy, r, feet) {
  gaugeBody(ctx, cx, cy, r);
  gaugeTicks(ctx, cx, cy, r, 10, 5);
  needle(ctx, cx, cy, r - 18, (feet % 1000) / 1000, MINT, 2.5);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = '#0d1413'; ctx.fill();
  ctx.strokeStyle = EDGE; ctx.stroke();
  ctx.restore();
  const thousands = Math.round(feet / 1000).toString().padStart(2, '0');
  stencil(ctx, thousands, cx, cy + 2, 26, AMBER);
  stencil(ctx, 'x100 ft', cx, cy + 22, 9, DIM);
  gaugeCaption(ctx, cx, cy + r, 'altitude', 'feet');
}

// Compass card that turns under a fixed lubber line.
function headingGauge(ctx, cx, cy, r, heading) {
  gaugeBody(ctx, cx, cy, r);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-heading * Math.PI / 180);
  for (let degree = 0; degree < 360; degree += 10) {
    const a = (degree - 90) * Math.PI / 180;
    const major = degree % 30 === 0;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - (major ? 16 : 9)), Math.sin(a) * (r - (major ? 16 : 9)));
    ctx.lineTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3));
    ctx.strokeStyle = major ? MINT : DIM; ctx.lineWidth = major ? 2 : 1; ctx.stroke();
    if (degree % 90 === 0) {
      const cardinal = ['N', 'E', 'S', 'W'][degree / 90];
      ctx.save();
      ctx.translate(Math.cos(a) * (r - 34), Math.sin(a) * (r - 34));
      ctx.rotate((degree) * Math.PI / 180);
      stencil(ctx, cardinal, 0, 0, 15, AMBER);
      ctx.restore();
    }
  }
  ctx.restore();
  stencil(ctx, String(Math.round(heading) % 360).padStart(3, '0'), cx, cy, 17, MINT);
  gaugeCaption(ctx, cx, cy + r, 'heading', '');
}

// Turbine tachometer in percent.
function rpmGauge(ctx, cx, cy, r, rpm) {
  gaugeBody(ctx, cx, cy, r);
  gaugeTicks(ctx, cx, cy, r, 10, 2);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 20, angleFor(0.86), angleFor(1));
  ctx.strokeStyle = 'rgba(255,111,74,0.7)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();
  needle(ctx, cx, cy, r - 16, Math.max(0, Math.min(1, rpm)));
  stencil(ctx, `${Math.round(rpm * 100)}`, cx, cy + r * 0.52, 16, MINT);
  gaugeCaption(ctx, cx, cy + r, 'rpm', 'percent');
}

// Fuel quantity with a bar inside the dial.
function fuelGauge(ctx, cx, cy, r, fuel) {
  gaugeBody(ctx, cx, cy, r);
  gaugeTicks(ctx, cx, cy, r, 10, 5);
  const fraction = Math.max(0, Math.min(1, fuel / 2400));
  needle(ctx, cx, cy, r - 16, fraction, fraction < 0.18 ? ALERT : AMBER);
  stencil(ctx, String(Math.round(fuel)), cx, cy + r * 0.52, 15, fraction < 220 ? ALERT : MINT);
  gaugeCaption(ctx, cx, cy + r, 'fuel', 'kg');
}

// Twelve labelled lamps; each lights amber when its system needs attention.
function cautionPanel(ctx, x, y, w, h, lamps) {
  ctx.save();
  ctx.fillStyle = '#0c1312';
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
  const columns = 4, rows = 3;
  const cellW = w / columns, cellH = h / rows;
  lamps.forEach((lamp, index) => {
    const column = index % columns, row = Math.floor(index / columns);
    const cx = x + cellW * (column + 0.5), cy = y + cellH * (row + 0.5);
    const width = cellW - 16, height = cellH - 14;
    ctx.beginPath(); ctx.rect(cx - width / 2, cy - height / 2, width, height);
    ctx.fillStyle = lamp.lit ? 'rgba(255,194,107,0.92)' : '#1d2624';
    ctx.fill();
    ctx.strokeStyle = lamp.lit ? AMBER : '#2c3734';
    ctx.stroke();
    stencil(ctx, lamp.label, cx, cy, 11, lamp.lit ? '#241502' : 'rgba(201,245,217,0.5)');
  });
  stencil(ctx, 'caution', x + w / 2, y - 10, 11, DIM);
  ctx.restore();
}

// Three fixed radio displays with a channel selector knob.
function radioStack(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#0e1514';
  ctx.strokeStyle = EDGE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
  const channels = [['VHF 1', '118.30'], ['VHF 2', '251.00'], ['UHF', '031.85']];
  channels.forEach((channel, index) => {
    const rowY = y + 16 + index * ((h - 24) / 3);
    stencil(ctx, channel[0], x + 14, rowY + 7, 10, DIM, 'left');
    ctx.save();
    ctx.font = `600 19px ${MONO}`;
    ctx.fillStyle = AMBER;
    ctx.textAlign = 'right';
    ctx.fillText(channel[1], x + w - 22, rowY + 9);
    ctx.restore();
  });
  ctx.beginPath(); ctx.arc(x + w - 18, y + h - 12, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#202927'; ctx.fill(); ctx.strokeStyle = '#3a473f'; ctx.stroke();
  ctx.restore();
}

// Analogue cockpit clock driven by the sortie clock.
function clockFace(ctx, cx, cy, r, seconds) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = '#1f2826'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0a100f'; ctx.fill();
  ctx.strokeStyle = EDGE; ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * (r - 10), cy - Math.cos(a) * (r - 10));
    ctx.lineTo(cx + Math.sin(a) * (r - 3), cy - Math.cos(a) * (r - 3));
    ctx.strokeStyle = DIM; ctx.lineWidth = 1; ctx.stroke();
  }
  const minutes = seconds / 60;
  const hourAngle = minutes / 720 * Math.PI * 2;
  const minuteAngle = minutes % 60 / 60 * Math.PI * 2;
  ctx.strokeStyle = MINT; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(minuteAngle) * (r - 12), cy - Math.cos(minuteAngle) * (r - 12)); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = AMBER;
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(hourAngle) * (r - 18), cy - Math.cos(hourAngle) * (r - 18)); ctx.stroke();
  ctx.restore();
}

// Rows of toggle switches along the bottom of the panel.
function toggles(ctx, x, y, columns, rows, lit) {
  ctx.save();
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const cx = x + column * 54, cy = y + row * 34;
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#232c2a'; ctx.fill();
      ctx.strokeStyle = '#3b4841'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 10);
      ctx.strokeStyle = lit[row * columns + column] ? AMBER : '#8d998f';
      ctx.lineWidth = 4; ctx.stroke();
    }
  }
  ctx.restore();
}

// Full panel redraw from the current instrument readings.
function drawPanel(ctx, instruments, state) {
  const w = 2048, h = 512;
  ctx.save();
  const backing = ctx.createLinearGradient(0, 0, 0, h);
  backing.addColorStop(0, '#1c2523');
  backing.addColorStop(1, PANEL);
  ctx.fillStyle = backing; ctx.fillRect(0, 0, w, h);

  // Panel seams, rivets, and a darker footwell lip.
  ctx.strokeStyle = 'rgba(8,14,13,0.9)'; ctx.lineWidth = 3;
  for (const x of [690, 1090]) { ctx.beginPath(); ctx.moveTo(x, 24); ctx.lineTo(x, h - 16); ctx.stroke(); }
  ctx.fillStyle = 'rgba(201,245,217,0.16)';
  for (let x = 26; x < w; x += 62) { ctx.beginPath(); ctx.arc(x, 18, 2.4, 0, Math.PI * 2); ctx.arc(x, h - 12, 2.4, 0, Math.PI * 2); ctx.fill(); }
  for (const x of [690, 1090]) for (let y = 44; y < h - 24; y += 58) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); }

  const feet = instruments.feet || 0;
  const knots = instruments.knots || 0;
  airspeedGauge(ctx, 118, 156, 74, knots);
  attitudeGauge(ctx, 330, 156, 74, instruments.pitch || 0, instruments.bank || 0);
  altimeterGauge(ctx, 542, 156, 74, feet);
  headingGauge(ctx, 1186, 156, 72, instruments.heading || 0);
  rpmGauge(ctx, 1398, 156, 72, instruments.rpm || 0);
  fuelGauge(ctx, 1610, 156, 72, instruments.fuel || 0);

  const warnings = (state && state.warnings) || [];
  const lit = (name) => warnings.some((warning) => String(warning).toUpperCase().includes(name));
  cautionPanel(ctx, 726, 62, 338, 168, [
    { label: 'GEAR', lit: !state.gear && knots < 180 },
    { label: 'FLAP', lit: !!state.flaps && knots > 350 },
    { label: 'AB', lit: !!state.afterburner },
    { label: 'STALL', lit: !!state.stall },
    { label: 'FUEL', lit: (instruments.fuel || 0) < 220 },
    { label: 'OIL', lit: false },
    { label: 'HYD', lit: false },
    { label: 'ELEC', lit: false },
    { label: 'GUN', lit: (state.gunRounds || 0) < 60 },
    { label: 'IR', lit: (state.missiles || 0) === 0 },
    { label: 'SAM', lit: lit('MISSILE') },
    { label: 'OVER G', lit: (instruments.g || 0) > 8.4 },
  ]);

  radioStack(ctx, 726, 262, 338, 122);
  clockFace(ctx, 895, 436, 38, momentFrom(state, instruments));
  toggles(ctx, 116, 356, 9, 3, [0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0]);
  toggles(ctx, 1166, 356, 8, 3, [1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  stencil(ctx, 'kestrel sk-11', 330, 300, 11, DIM);
  stencil(ctx, 'cinder coast air wing', 330, 316, 9, 'rgba(201,245,217,0.22)');

  // A soft top light and bottom shadow so the panel reads as a physical object.
  const sheen = ctx.createLinearGradient(0, 0, 0, h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(0.4, 'rgba(0,0,0,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = sheen; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function momentFrom(state, instruments) {
  const seconds = (state && state.missionTime) || 0;
  return seconds + (instruments.hedge || 0);
}

// ---------------------------------------------------------------------------
// 3D cockpit assembly.
// ---------------------------------------------------------------------------

let panelArt = null;

export function createCockpit(aircraft) {
  const { canvas, ctx, texture } = makePanel();
  panelArt = canvas;
  const group = new THREE.Group();
  group.visible = false;
  aircraft.root.add(group);

  const panelMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.62,
    roughness: 0.82,
    metalness: 0.06,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.02, 0.5), panelMaterial);
  panel.position.set(0, 1.14, -4.25);

  panel.rotation.x = -0.26;
  group.add(panel);

  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2422, roughness: 0.78, metalness: 0.25 });
  const coaming = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.42), frameMaterial);
  coaming.position.set(0, 1.395, -4.1);
  group.add(coaming);

  // Side consoles and the canopy sill give the interior some depth.
  for (const side of [-1, 1]) {
    const console3d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 1.7), frameMaterial);
    console3d.position.set(side * 0.92, 0.98, -3.9);
    group.add(console3d);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 2.4), frameMaterial);
    sill.position.set(side * 0.93, 1.33, -3.6);
    group.add(sill);
  }

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x050807, transparent: true, opacity: 0.85 }),
  );
  shadowPlane.position.set(0, 0.82, -3.9);
  shadowPlane.rotation.x = -Math.PI / 2;
  group.add(shadowPlane);

  let timer = 1;
  let painted = false;

  return {
    group,
    panel,
    update(dt, data) {
      const visible = data.cameraMode === 'cockpit';
      group.visible = visible;
      // The airframe anti-glare shield and canopy bow sit between the pilot's eye and the glass.
      if (aircraft.antiGlareShield) aircraft.antiGlareShield.visible = !visible;
      if (aircraft.bow) aircraft.bow.visible = !visible;
      if (aircraft.cockpitTub) aircraft.cockpitTub.visible = !visible;
      if (!visible) return;
      timer += dt;
      if (painted && timer < 1 / 12) return;
      timer = 0;
      drawPanel(ctx, data.instruments || {}, data.state || {});
      texture.needsUpdate = true;
      painted = true;
    },
  };
}

// ---------------------------------------------------------------------------
// 2D canopy frame and HUD combiner, drawn on the HUD canvas in 1280 x 720 space.
// ---------------------------------------------------------------------------

export function drawCockpitOverlay(ctx, width, height, data, drawSymbols) {
  // The HUD canvas is already scaled to the 1280 x 720 design grid by hud.js.
  ctx.save();

  // Dark canopy shell around the edges of the view.
  const shell = ctx.createLinearGradient(0, 0, 0, 720);
  shell.addColorStop(0, 'rgba(9,15,14,0.92)');
  shell.addColorStop(0.18, 'rgba(9,15,14,0.16)');
  shell.addColorStop(0.72, 'rgba(9,15,14,0.1)');
  shell.addColorStop(1, 'rgba(9,15,14,0.96)');
  ctx.fillStyle = shell;
  ctx.fillRect(0, 0, 1280, 720);

  // Side walls: two dark wedges closing the canopy aperture.
  ctx.fillStyle = '#0d1413';
  ctx.beginPath();
  ctx.moveTo(0, 96); ctx.lineTo(126, 150); ctx.lineTo(96, 420); ctx.lineTo(0, 470);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1280, 96); ctx.lineTo(1154, 150); ctx.lineTo(1184, 420); ctx.lineTo(1280, 470);
  ctx.closePath(); ctx.fill();

  // Canopy bow across the top.
  ctx.fillStyle = '#0a1110';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(1280, 0); ctx.lineTo(1280, 34);
  ctx.quadraticCurveTo(640, 92, 0, 34);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(201,245,217,0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, 34); ctx.quadraticCurveTo(640, 92, 1280, 34); ctx.stroke();

  // Glare shield across the bottom, with a rounded top edge.
  const shield = ctx.createLinearGradient(0, 552, 0, 720);
  shield.addColorStop(0, '#1a2321');
  shield.addColorStop(1, '#070c0b');
  ctx.fillStyle = shield;
  ctx.beginPath();
  ctx.moveTo(0, 720); ctx.lineTo(0, 654);
  ctx.quadraticCurveTo(200, 606, 470, 610);
  ctx.lineTo(810, 610);
  ctx.quadraticCurveTo(1080, 606, 1280, 654);
  ctx.lineTo(1280, 720);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(201,245,217,0.18)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 654); ctx.quadraticCurveTo(200, 606, 470, 610);
  ctx.lineTo(810, 610); ctx.quadraticCurveTo(1080, 606, 1280, 654);
  ctx.stroke();

  // The glass combiner and the compact HUD inside it.
  const glass = ctx.createLinearGradient(0, 120, 0, 432);
  glass.addColorStop(0, 'rgba(255,196,120,0.07)');
  glass.addColorStop(1, 'rgba(255,196,120,0.02)');
  ctx.beginPath();
  ctx.moveTo(330, 120); ctx.lineTo(950, 120); ctx.lineTo(918, 432); ctx.lineTo(362, 432);
  ctx.closePath();
  ctx.fillStyle = glass; ctx.fill();
  ctx.strokeStyle = 'rgba(255,196,120,0.28)'; ctx.lineWidth = 2; ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(332, 122); ctx.lineTo(948, 122); ctx.lineTo(916, 430); ctx.lineTo(364, 430);
  ctx.closePath(); ctx.clip();
  if (drawSymbols) drawSymbols();
  ctx.restore();

  // The live instrument panel, painted into its texture, laid across the lower third.
  if (panelArt) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 18;
    ctx.drawImage(panelArt, 0, 430, 1280, 290);
    ctx.restore();
    ctx.strokeStyle = 'rgba(201,245,217,0.22)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, 430); ctx.lineTo(1280, 430); ctx.stroke();
  }

  // A faint reflection streak on the glass.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const streak = ctx.createLinearGradient(380, 140, 620, 400);
  streak.addColorStop(0, 'rgba(201,245,217,0)');
  streak.addColorStop(0.5, 'rgba(201,245,217,0.05)');
  streak.addColorStop(1, 'rgba(201,245,217,0)');
  ctx.fillStyle = streak;
  ctx.beginPath();
  ctx.moveTo(392, 132); ctx.lineTo(470, 132); ctx.lineTo(600, 428); ctx.lineTo(520, 428);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // A-pillars: thick frames from the lower corners to just above the top centre.
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 44 : 1236, x1 = side < 0 ? 300 : 980;
    ctx.beginPath();
    ctx.moveTo(x0, 434);
    ctx.lineTo(x0 + (side < 0 ? 96 : -96), 434);
    ctx.lineTo(x1 + (side < 0 ? 34 : -34), 8);
    ctx.lineTo(x1 + (side < 0 ? -18 : 18), 8);
    ctx.closePath();
    ctx.fillStyle = '#0b1211';
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,245,217,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Rivets down each pillar.
    ctx.fillStyle = 'rgba(201,245,217,0.22)';
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      ctx.beginPath();
      ctx.arc(x0 + (x1 - x0) * t + (side < 0 ? 40 : -40) * (1 - t * 0.5), 434 - 426 * t, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

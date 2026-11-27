import { clamp } from './util.js';

export const INSTRUMENT_STYLE = Object.freeze({
  ink: 'rgba(8,16,15,0.58)',
  stroke: '#c9f5d9',
  dim: 'rgba(201,245,217,0.34)',
  amber: '#ffc26b',
  alert: '#ff6f4a',
  valueFont: '600 12px ui-monospace, "Cascadia Mono", Consolas, monospace',
  labelFont: '500 10px ui-monospace, "Cascadia Mono", Consolas, monospace',
  family: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
});

export function drawInstrumentText(ctx, value, x, y, options = {}) {
  const kind = options.kind || 'value';
  const size = options.size || (kind === 'label' ? 10 : 12);
  const color = options.color || INSTRUMENT_STYLE.stroke;
  const align = options.align || 'left';
  const baseline = options.baseline || 'middle';
  const weight = options.weight || (kind === 'label' ? 500 : 600);
  let text = String(value);
  if (kind === 'label') text = text.toUpperCase();
  ctx.save();
  ctx.font = `${weight} ${size}px ${INSTRUMENT_STYLE.family}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.shadowBlur = 0;
  if (kind === 'label') {
    const spacing = size * 0.08;
    let width = 0;
    for (let index = 0; index < text.length; index++) width += ctx.measureText(text[index]).width;
    width += Math.max(0, text.length - 1) * spacing;
    let cursor = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    for (const character of text) {
      ctx.fillText(character, cursor, y);
      cursor += ctx.measureText(character).width + spacing;
    }
  } else {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

export function drawInstrumentRule(ctx, x1, y1, x2, y2, color = INSTRUMENT_STYLE.stroke, width = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (color === INSTRUMENT_STYLE.stroke || color === INSTRUMENT_STYLE.dim) {
    ctx.shadowColor = INSTRUMENT_STYLE.stroke;
    ctx.shadowBlur = 6;
  } else {
    ctx.shadowBlur = 0;
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function drawInstrumentPanel(ctx, x, y, width, height, options = {}) {
  const fill = options.fill || INSTRUMENT_STYLE.ink;
  const stroke = options.stroke || INSTRUMENT_STYLE.stroke;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = options.lineWidth || 1;
  if (stroke === INSTRUMENT_STYLE.stroke || stroke === INSTRUMENT_STYLE.dim) {
    ctx.shadowColor = INSTRUMENT_STYLE.stroke;
    ctx.shadowBlur = 6;
  } else {
    ctx.shadowBlur = 0;
  }
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
  ctx.restore();
}

export function drawInstrumentVignette(ctx, width = 1280, height = 720) {
  const cx = width / 2, cy = height / 2;
  const radius = Math.hypot(cx, cy);
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(6,10,10,0)');
  gradient.addColorStop(0.58, 'rgba(6,10,10,0.06)');
  gradient.addColorStop(1, 'rgba(6,10,10,0.42)');
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function readInstruments(state, terrain) {
  const speed = Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z);
  const agl = Math.max(0, state.position.y - terrain.heightAt(state.position.x, state.position.z));
  const heading = (state.heading * 180 / Math.PI + 360) % 360;
  return {
    knots: speed * 1.94384,
    feet: state.position.y * 3.28084,
    radarFeet: agl * 3.28084,
    heading,
    pitch: state.pitch * 180 / Math.PI,
    bank: state.bank * 180 / Math.PI,
    g: clamp(state.gLoad, -5, 12),
    mach: speed / Math.max(250, 340.3 - state.position.y * 0.003),
    throttle: state.throttle,
    fuel: state.fuel,
    sink: -state.velocity.y,
    rpm: clamp(state.throttle * 0.88 + speed / 2000, 0, 1.15),
    agl,
    timeFuel: state.fuel / Math.max(0.2, state.burnRate || 0.8),
  };
}


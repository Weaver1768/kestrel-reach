export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const approach = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const distance2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const seeded = (seed = 1) => {
  let s = (Number(seed) >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
export const hash2 = (x, z, seed = 1) => { let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
export const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const length3 = (v) => Math.hypot(v.x, v.y, v.z);
export const normalize3 = (v) => { const n = length3(v) || 1; return { x: v.x / n, y: v.y / n, z: v.z / n }; };
export const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale3 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross3 = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const bearingTo = (a, b) => ((Math.atan2(b.x - a.x, -(b.z - a.z)) * 180 / Math.PI) + 360) % 360;
export const colorHex = (hex) => `#${(hex >>> 0).toString(16).padStart(6, '0')}`;


// Medidas do corpo e utilitários de vetor (1 unidade ≈ 2 cm; boneco com ~1,78 m).
export const L = {
  torso: 27, neck: 3.4, head: 6, upper: 15.5, fore: 14, hand: 2.4,
  thigh: 22.5, shin: 21.5, foot: 9, ankle: 3.2, shw: 9.9, hpw: 5.2,
};
export const D2R = Math.PI / 180;
export const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpP = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const limbDir = (a) => [Math.sin(a * D2R), -Math.cos(a * D2R)];
export const angOf = (v) => Math.atan2(v[0], -v[1]) / D2R;

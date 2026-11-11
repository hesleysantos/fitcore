// Verificação automática das animações: toda animação existe, renderiza sem erro e respeita a física básica.
// Uso: node tools/check-anim.mjs
import { EXERCICIOS } from '../www/js/data/exercises.js';
import { animFor, hasAnim } from '../www/js/anim/index.js';
import { renderFrame, poseAt, solveSide, solveFront, activation, L } from '../www/js/anim/rig.js';

const TOL = 0.35;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ang = (a, b, c) => { // ângulo em b (graus) entre b→a e b→c
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
  const d = (v1[0] * v2[0] + v1[1] * v2[1]) / ((Math.hypot(...v1) || 1) * (Math.hypot(...v2) || 1));
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
};
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
let problems = 0;
const seen = new Map();
const report = (id, msg) => {
  const k = id + '|' + msg.replace(/[-\d.]+/g, '#');
  if (seen.has(k)) return;
  seen.set(k, 1);
  problems++;
  console.log(`  x ${id}: ${msg}`);
};

for (const ex of EXERCICIOS) {
  if (!hasAnim(ex.id)) { report(ex.id, 'sem animação'); continue; }
  let anim;
  try { anim = animFor(ex); } catch (e) { report(ex.id, 'erro ao montar: ' + e.message); continue; }
  const view = anim.view || 'side';
  const frames = anim.loop ? [...anim.frames, anim.frames[0]] : anim.frames;
  const act = activation(ex);
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    let shapes, pose;
    try { shapes = renderFrame(anim, act, t); pose = poseAt(frames, t, view); } catch (e) { report(ex.id, `erro ao desenhar em t=${t}: ${e.message}`); break; }
    for (const s of shapes) {
      for (const k of ['d', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2']) {
        if (s[k] != null && /NaN|Infinity/.test(String(s[k]))) report(ex.id, `coordenada inválida (${k}) em t=${t}`);
      }
    }
    if (view !== 'side') {
      const J = solveFront(pose);
      for (const sd of ['R', 'L']) {
        for (const k of ['an', 'kn', 'wr', 'el', 'hj', 'sh']) {
          if (J[k + sd][1] < 1.2) report(ex.id, `${k}${sd} abaixo do chão (${J[k + sd][1].toFixed(1)}) em t=${t}`);
        }
      }
      continue;
    }
    const J = solveSide(pose);
    for (const k of ['N', 'F']) {
      const as = pose['arm' + k] || pose.arm || {};
      const ls = pose['leg' + k] || pose.leg || {};
      const la = L.upper * Math.abs(as.la ?? 1), lb = L.fore * Math.abs(as.lb ?? 1);
      // ossos não mudam de comprimento
      if (Math.abs(dist(J.sh, J['el' + k]) - la) > TOL || Math.abs(dist(J['el' + k], J['wr' + k]) - lb) > TOL) report(ex.id, `braço ${k} muda de comprimento em t=${t}`);
      if (Math.abs(dist(J.hip, J['kn' + k]) - L.thigh) > TOL || Math.abs(dist(J['kn' + k], J['an' + k]) - L.shin) > TOL) report(ex.id, `perna ${k} muda de comprimento em t=${t}`);
      // alvo de mão/pé fora de alcance
      if (as.hand && dist(J['wr' + k], as.hand) > 0.6) report(ex.id, `mão ${k} não alcança o alvo (falta ${dist(J['wr' + k], as.hand).toFixed(1)}) em t=${t}`);
      if (ls.foot && dist(J['an' + k], ls.foot) > 0.6) report(ex.id, `pé ${k} não alcança o alvo (falta ${dist(J['an' + k], ls.foot).toFixed(1)}) em t=${t}`);
      // joelho só dobra para trás; cotovelo só dobra para a frente
      const kneeBend = cross(J.hip, J['kn' + k], J['an' + k]);
      const kneeAng = 180 - ang(J.hip, J['kn' + k], J['an' + k]);
      if (kneeBend > 0.5 && kneeAng > 6) report(ex.id, `joelho ${k} dobrando ao contrário (${kneeAng.toFixed(0)}°) em t=${t}`);
      if (kneeAng > 158) report(ex.id, `joelho ${k} flexionado além do limite (${kneeAng.toFixed(0)}°) em t=${t}`);
      const elBend = cross(J.sh, J['el' + k], J['wr' + k]);
      const elAng = 180 - ang(J.sh, J['el' + k], J['wr' + k]);
      const outOfPlane = as.la != null || as.lb != null; // braço declarado fora do plano (abre para o lado)
      if (la > 10 && lb > 9 && !outOfPlane) {
        if (elBend < -0.5 && elAng > 8) report(ex.id, `cotovelo ${k} dobrando ao contrário (${elAng.toFixed(0)}°) em t=${t}`);
        if (elAng > 158) report(ex.id, `cotovelo ${k} flexionado além do limite (${elAng.toFixed(0)}°) em t=${t}`);
      }
      // nada atravessa o chão
      const parts = [['tornozelo', J['an' + k], 2.2], ['joelho', J['kn' + k], 3.6], ['punho', J['wr' + k], 1.8], ['cotovelo', J['el' + k], 2.6], ['ponta do pé', J['toe' + k], 1.6], ['calcanhar', J['heel' + k], 1.9]];
      for (const [nm, p, r] of parts) {
        if (p[1] - r < -0.9) report(ex.id, `${nm} ${k} atravessa o chão (${(p[1] - r).toFixed(1)}) em t=${t}`);
      }
      const hipFlex = ang(J.sh, J.hip, J['kn' + k]);
      if (hipFlex < 26) report // agachado com as coxas no peito (coluna arredondada) chega perto disso(ex.id, `quadril ${k} fechado demais (${hipFlex.toFixed(0)}° entre tronco e coxa) em t=${t}`);
    }
    if (J.hip[1] < 6.4) report(ex.id, `quadril atravessa o chão em t=${t}`);
    if (J.sh[1] < 6.4) report(ex.id, `ombro atravessa o chão em t=${t}`);
    if (J.head[1] < 5.6) report(ex.id, `cabeça atravessa o chão em t=${t}`);
  }
}
console.log(problems ? `\n${problems} problema(s) em ${EXERCICIOS.length} exercícios.` : `OK: ${EXERCICIOS.length} animações verificadas, sem problemas de física.`);
process.exit(problems ? 1 : 0);

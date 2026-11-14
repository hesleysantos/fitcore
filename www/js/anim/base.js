// Posturas-base e utilitários para montar as animações dos exercícios.
import { L } from './rig.js';

export const D2R = Math.PI / 180;
export const AK = 3.9;            // altura do tornozelo com o pé plantado no chão
export const H = AK + L.thigh + L.shin - 0.1; // quadril em pé (47.8)
export const X = 100;
export const CHAO = 0.95;         // eixo de um tubo deitado no chão
export const SHY = H + L.torso;   // altura do ombro em pé

export const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
export const foot = (x, y = AK, extra) => ({ foot: [x, y], ...extra });

// vetores do tronco para um ângulo (graus a partir da vertical, + = inclinado à frente)
export function frame(torso) {
  const t = torso * D2R;
  const up = [Math.sin(t), Math.cos(t)];
  return { up, front: [up[1], -up[0]], back: [-up[1], up[0]] };
}
// ponto relativo ao ombro: f para a frente do tronco, u ao longo do tronco
export function fromSh(hip, torso, f, u, lt = 1) {
  const { up, front } = frame(torso);
  const sh = add(hip, up, L.torso * lt);
  return add(add(sh, front, f), up, u);
}
export const shOf = (hip, torso) => fromSh(hip, torso, 0, 0);

// tornozelo que mantém a ponta do pé num ponto fixo, com o pé no ângulo fa
export function ankleFromToe(toe, fa) {
  const r = fa * D2R;
  const fd = [Math.cos(r), -Math.sin(r)];
  const dn = [-fd[1], fd[0]];
  return [toe[0] - fd[0] * 6.12 + dn[0] * 1.76, toe[1] - fd[1] * 6.12 + dn[1] * 1.76];
}

// em pé
export const stand = (o = {}, x = X) => ({ hip: [x, H], torso: 0, leg: foot(x + 1), ...o });

// deitado/reclinado num banco. inc = inclinação do encosto (0 reto, 30/45 inclinado, -15 declinado)
// O banco sai completo: reto (estofado, longarina e dois pés), regulável (encosto com longarina e escora,
// assento, coluna e base) ou declinado (longarina, pé baixo na cabeceira e coluna alta no lado do quadril).
export function recline(inc = 0, hx = 110, seat = 16) {
  const torso = -(90 - inc);
  const { up, front, back } = frame(torso);
  const padY = seat - 1.8;
  const hip = inc === 0 ? [hx, padY + 9.4] : [hx, padY + 9.4 + Math.max(0, inc) * 0.05];
  const pa = add(add(hip, back, 9.4), up, -4);
  const pb = add(add(hip, back, 9.4), up, 39);
  const midp = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  // ponto da longarina que corre por baixo do estofado (u = 0 no lado do quadril, 1 na cabeceira)
  const S = (u) => add([pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u], back, 2.5);
  const equip = [];
  if (inc > 5) {
    equip.push({ k: 'pad', a: pa, b: pb });
    equip.push({ k: 'pad', a: [hip[0] - 2, hip[1] - 8.3], b: [hip[0] + 13, hip[1] - 8.3] });
    equip.push({ k: 'frame', pts: [S(0.03), S(0.9)], w: 1.5 });
    equip.push({ k: 'frame', pts: [[pb[0] + 5, CHAO], S(0.62)] });
    equip.push({ k: 'frame', pts: [[hip[0] - 3.5, hip[1] - 10.6], [hip[0] + 12, hip[1] - 10.6]], w: 1.4 });
    equip.push({ k: 'frame', pts: [[hip[0] + 5, hip[1] - 10.6], [hip[0] + 5, CHAO]], w: 2 });
    equip.push({ k: 'frame', pts: [[pb[0] + 1, CHAO], [hip[0] + 15, CHAO]], w: 1.7 });
  } else if (inc < 0) {
    equip.push({ k: 'pad', a: pa, b: pb });
    equip.push({ k: 'frame', pts: [S(0.03), S(0.95)], w: 1.5 });
    equip.push({ k: 'frame', pts: [S(0.84), [S(0.84)[0], CHAO]] });
    equip.push({ k: 'frame', pts: [S(0.1), [S(0.1)[0], CHAO]], w: 2 });
    equip.push({ k: 'frame', pts: [[S(0.84)[0] - 5, CHAO], [S(0.1)[0] + 6, CHAO]], w: 1.7 });
  } else {
    equip.push({ k: 'bench', x0: pb[0], x1: pa[0], h: seat - 0.1 });
  }
  return { hip, torso, up, front, back, sh: add(hip, up, L.torso), equip, mid: midp, pa, pb };
}

// sentado numa máquina/banco com encosto. recl = inclinação do encosto para trás (graus, positivo = reclinado)
// Cadeira completa: assento com a sua travessa e coluna, encosto preso num tubo que desce até a base e a sapata no chão.
export function seated({ hx = 92, hy = 26.5, recl = 6, back = 34, noBack = false, post = true } = {}) {
  const torso = -recl;
  const f = frame(torso);
  const hip = [hx, hy];
  const equip = [{ k: 'pad', a: [hx - 6, hy - 8.3], b: [hx + 13, hy - 8.3] }];
  if (!noBack) {
    const a = add(add(hip, f.back, 9.4), f.up, -1), b = add(add(hip, f.back, 9.4), f.up, back);
    equip.push({ k: 'pad', a, b });
    if (post) {
      const ta = add(a, f.back, 2.5), tb = add(add(b, f.back, 2.5), f.up, -5);
      equip.push({ k: 'frame', pts: [[ta[0], CHAO], ta, tb], w: 1.7 });
    }
  }
  if (post) {
    equip.push({ k: 'frame', pts: [[hx - 5, hy - 10.6], [hx + 12, hy - 10.6]], w: 1.4 });
    equip.push({ k: 'frame', pts: [[hx + 3, hy - 10.6], [hx + 3, CHAO]], w: 2 });
    equip.push({ k: 'circ', at: [hx + 4.9, hy - 14.2], r: 0.9, c: 'fg-eqhi-f' }); // pino de regulagem da altura do assento
    equip.push({ k: 'frame', pts: [[hx - 14, CHAO], [hx + 15, CHAO]], w: 1.7 });
  }
  return { hip, torso, ...f, sh: add(hip, f.up, L.torso), equip, leg: foot(hx + 22.5) };
}

// sentado de frente/costas (vista frontal): coxas em direção ao observador (encurtadas)
export const SEAT_F = { hip: [X, 26.5], leg: { a: 30, la: 0.135, b: 2, lb: 0.93 } };
export const seatBoxF = { k: 'seatf', y: 20, w: 11 };
export const backPadF = { k: 'pad', a: [0, 24], b: [0, 62], th: 8.5, z: 'back' };

// máquina de cabos: coluna com carenagem e pilha de pesos
export const tower = (x, top = 106, extra = {}) => ({ k: 'tower', x, top, ...extra });
// estação de polia (vista lateral): coluna, carrinho da polia regulável na altura py (na face dir) e o cabo até a mão (ou "to").
// A pilha sobe conforme a peça puxada se afasta da posição inicial.
// entre: o cabo passa entre as pernas (polia baixa atrás da pessoa); ver caboEntreAsPernas em equip.js
export function estacao(x, py, { top = 104, dir = -1, w = 9, to = 'hand', z, gain, entre } = {}) {
  const cabo = { k: 'cable', from: [x + dir * (w / 2 + 2.6), py], to };
  if (z) cabo.z = z;
  if (entre) cabo.entre = true;
  const col = { k: 'tower', x, top, w, py, dir, trk: to };
  if (gain) col.gain = gain;
  return [col, cabo];
}
// colunas de polia na vista frontal: x = distância do centro até a coluna; a polia fica na face de dentro
export const POLIA_F = (x, w = 8) => x - w / 2 - 2.6;

export const ping = (frames, equip, extra = {}) => ({ view: 'side', frames, equip, ...extra });

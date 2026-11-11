// Animações dos aparelhos acrescentados no levantamento de máquinas: articuladas com anilhas, bancos
// especiais (GHD, sissy squat), hiperextensão reversa, multi-hip e cardio (bicicleta reclinada, esqui, esteira curva).
// Convenção igual à de upper.js e lower.js: frames[0] = posição inicial descrita no exercício; último quadro = fim do movimento.
// As peças que não existem em equip.js são desenhadas aqui, com o tipo 'fn' (desenho livre).
import { L } from './rig.js';
import { AK, H, X, D2R, add, foot, shOf, ankleFromToe, seated, SEAT_F, seatBoxF, backPadF } from './base.js';
import { treadmill } from './core.js';

const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const passos = (n) => Array.from({ length: n }, (_, i) => i / (n - 1));
const entre = (a, b, t) => a + (b - a) * t;
// ponto a uma distância r do centro c; ângulo em graus a partir de "para baixo", positivo = para a frente
const polar = (c, r, graus) => [c[0] + r * Math.sin(graus * D2R), c[1] - r * Math.cos(graus * D2R)];
const MAOS_NO_PEITO = { rel: [7.5, -9], la: 0.7, lb: 0.6 };

// ---------- peças (mesmo acabamento das de equip.js) ----------
function tubo(o, pts, w = 1.6) {
  o.open(pts, 'fg-eq', w);
  if (w >= 1.2) o.open(pts, 'fg-eqhi', w * 0.28);
}
function estofado(o, a, b, th = 1.8) {
  o.cap(a, b, th, th, 'fg-cush');
  const d = norm([b[0] - a[0], b[1] - a[1]]);
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 6 && th >= 1.4) {
    const n = [-d[1], d[0]];
    const s = n[1] >= 0 ? 1 : -1;
    o.line(add(add(a, d, 1.2), n, s * th * 0.45), add(add(b, d, -1.2), n, s * th * 0.45), 'fg-cushhi', 0.45);
  }
}
function anilha(o, p, r = 7) {
  o.circ(p, r, 'fg-plate');
  o.circ(p, r * 0.87, 'fg-ring');
  if (r > 5) o.circ(p, r * 0.44, 'fg-ring');
  o.circ(p, Math.min(2.2, r * 0.3), 'fg-steel');
  o.circ(p, 0.75, 'fg-eqs');
}
function eixo(o, p) {
  o.circ(p, 1.8, 'fg-steel');
  o.circ(p, 0.6, 'fg-eqs');
}
function rolo(o, p, r = 2.8) {
  o.circ(p, r, 'fg-cush');
  o.circ(p, r * 0.3, 'fg-steel');
}
// chapa de aço: retângulo centrado em p, comprido na direção d
function chapa(o, p, d, meioC, meioL, c = 'fg-steel') {
  const n = [-d[1], d[0]];
  o.poly([add(add(p, d, -meioC), n, -meioL), add(add(p, d, meioC), n, -meioL), add(add(p, d, meioC), n, meioL), add(add(p, d, -meioC), n, meioL)], c);
}
// alavanca do eixo até a mão, com a anilha num pino a uma fração do caminho
const alavancaComAnilha = (P, fr, lado = 1, r = 7) => ({
  k: 'fn', z: 'back', f: (o, J) => {
    const h = J.handN;
    tubo(o, [P, h], 1.8);
    const d = norm([h[0] - P[0], h[1] - P[1]]);
    const n = [-d[1] * lado, d[0] * lado];
    const m = mix(P, h, fr);
    const q = add(m, n, r + 1.5);
    tubo(o, [m, q], 1.4);
    anilha(o, q, r);
    eixo(o, P);
  },
});
// gangorra: a mão puxa (ou empurra) uma ponta e as anilhas sobem na outra ponta, depois do eixo
const gangorra = (P, braco = 15, r = 7) => ({
  k: 'fn', z: 'back', f: (o, J) => {
    const h = J.handN;
    const d = norm([P[0] - h[0], P[1] - h[1]]);
    const e = add(P, d, braco);
    tubo(o, [h, P, e], 1.8);
    anilha(o, e, r);
    eixo(o, P);
  },
});

// ---------- PEITO ----------
// Supino declinado articulado: sentado, a alavanca desce de um eixo no alto e as mãos empurram para a frente e para baixo.
export function declinePress() {
  const s = seated({ hx: 88, recl: 5 });
  const P = add(s.sh, [30, 35]);
  const base = { hip: s.hip, torso: s.torso, leg: s.leg };
  return {
    view: 'side',
    frames: [-25.5, -15, -5].map((g) => ({ ...base, arm: { hand: polar(P, 48.75, g) } })),
    equip: [
      ...s.equip,
      { k: 'frame', pts: [[s.hip[0] - 17, 0.8], [s.hip[0] - 17, P[1] + 4], [P[0], P[1] + 4], P], w: 2, z: 'back' },
      alavancaComAnilha(P, 0.5),
      { k: 'handle' },
    ],
  };
}

// ---------- COSTAS ----------
// Puxada alta articulada (high row): peito no apoio, coxas presas, braços começam no alto e os cotovelos descem para trás.
export function highRow() {
  const s = seated({ hx: 84, recl: 0, noBack: true });
  const torso = 6;
  const sh = shOf(s.hip, torso);
  const P = add(sh, [51.65, -10.06]);
  const mao = (g) => [P[0] - 44 * Math.cos(g * D2R), P[1] + 44 * Math.sin(g * D2R)];
  const base = { hip: s.hip, torso, leg: s.leg };
  const hx = s.hip[0], hy = s.hip[1];
  return {
    view: 'side',
    frames: [44, 24, 4.65].map((g) => ({ ...base, arm: { hand: mao(g) } })),
    equip: [
      ...s.equip,
      { k: 'pad', a: [hx + 12.2, hy + 10], b: [hx + 14, hy + 25] },
      { k: 'frame', pts: [[hx + 14, hy + 17], [P[0] + 2, hy + 17]], z: 'back' },
      { k: 'frame', pts: [[P[0] + 2, 0.8], [P[0] + 2, P[1] + 2]], w: 2.2, z: 'back' },
      { k: 'frame', pts: [[hx + 12, 0.8], [P[0] + 8, 0.8]] },
      { k: 'pad', a: [hx + 9, hy + 8.6], b: [hx + 20, hy + 8.4], z: 'front' },
      gangorra(P, 17),
      { k: 'handle' },
    ],
  };
}

// Remada baixa articulada (low row): peito no apoio, as alavancas pendem de um eixo no alto e as mãos vêm de baixo até a cintura.
export function lowRow() {
  const s = seated({ hx: 84, recl: 0, noBack: true });
  const torso = 8;
  const sh = shOf(s.hip, torso);
  const P = add(sh, [22, 30]);
  const base = { hip: s.hip, torso, leg: s.leg };
  const hx = s.hip[0], hy = s.hip[1];
  return {
    view: 'side',
    frames: [-2, -12, -22].map((g) => ({ ...base, arm: { hand: polar(P, 50, g) } })),
    equip: [
      ...s.equip,
      { k: 'pad', a: [hx + 12.6, hy + 10], b: [hx + 14.8, hy + 25] },
      { k: 'frame', pts: [[hx + 15, hy + 18], [hx + 38, hy + 18]], z: 'back' },
      { k: 'frame', pts: [[hx + 38, 0.8], [hx + 38, P[1] + 4], [P[0], P[1] + 4], P], w: 2.2, z: 'back' },
      { k: 'frame', pts: [[hx + 12, 0.8], [hx + 44, 0.8]] },
      alavancaComAnilha(P, 0.8, 1, 6.5),
      { k: 'handle' },
    ],
  };
}

// Encolhimento na máquina: em pé entre as duas alavancas, os ombros sobem e descem com os braços estendidos.
export function shrugMachine() {
  const base = { hip: [X, H], leg: { a: 6, b: 3 }, arm: { a: 9, b: 4 } };
  const lados = (J) => [[J.handR, 1], [J.handL, -1]];
  return {
    view: 'front', label: 'Vista de frente',
    frames: [{ ...base }, { ...base, sy: 3.4 }],
    equip: [
      { k: 'fn', z: 'back', f: (o, J) => {
        tubo(o, [[X - 34, 0.8], [X + 34, 0.8]], 1.6);
        for (const [h, s] of lados(J)) {
          const pv = [X + s * 31, 28];
          tubo(o, [[pv[0], 0.8], [pv[0], 32]], 2);
          tubo(o, [pv, [h[0] + s * 2.5, h[1] + 0.5]], 1.8); // alavanca que vai do eixo, atrás, até a mão
          eixo(o, pv);
        }
      } },
      { k: 'fn', f: (o, J) => {
        for (const [h, s] of lados(J)) {
          tubo(o, [[h[0] - s * 1.5, h[1]], [h[0] + s * 11.5, h[1]]], 1.5); // pino das anilhas, ao lado da mão
          for (const dx of [6.2, 9]) chapa(o, [h[0] + s * dx, h[1]], [0, 1], 8, 1.15, 'fg-rub');
        }
      } },
    ],
  };
}

// ---------- TRÍCEPS ----------
// Mergulho sentado na máquina: coxas presas, mãos nos pegadores ao lado do corpo, empurra para baixo até estender os braços.
export function seatedDip() {
  const s = seated({ hx: 90, recl: 0, back: 27 });
  const P = add(s.sh, [39, -20]);
  const mao = (g) => [P[0] - 35.5 * Math.cos(g * D2R), P[1] + 35.5 * Math.sin(g * D2R)];
  const base = { hip: s.hip, torso: s.torso, leg: s.leg };
  return {
    view: 'side',
    frames: [14, 0, -13.5].map((g) => ({ ...base, arm: { hand: mao(g) } })),
    equip: [
      ...s.equip,
      { k: 'frame', pts: [[P[0], 0.8], P], w: 2.2, z: 'back' },
      { k: 'frame', pts: [[s.hip[0] + 12, 0.8], [P[0] + 8, 0.8]] },
      gangorra(P, 15),
      { k: 'frame', pts: [[s.hip[0] + 15, s.hip[1] + 8.1], [P[0], s.hip[1] + 8.1]], w: 1.4, z: 'back' },
      { k: 'roller', at: [s.hip[0] + 15, s.hip[1] + 8.1], r: 2.9, z: 'front' },
      { k: 'handle' },
    ],
  };
}

// ---------- ABDÔMEN ----------
// Rotação de tronco na máquina, vista de frente: o tronco fica parado nos apoios e os joelhos (com o assento) giram de um lado ao outro.
export function rotaryTorso() {
  const arm = { a: 22, b: 158, lb: 0.75 }; // mãos nos pegadores, ao lado dos ombros
  const perna = (kx) => ({ a: Math.atan2(kx, 2) / D2R, la: Math.hypot(kx, 2) / L.thigh, b: 2, lb: 0.93 });
  const mk = (giro) => {
    const dx = L.thigh * Math.sin(giro * D2R);
    return { hip: SEAT_F.hip, arm, legR: perna(3 + dx), legL: perna(3 - dx) };
  };
  return {
    view: 'front', label: 'Vista de frente: o tronco fica parado e os joelhos giram',
    frames: [-36, -18, 0, 18, 36].map(mk),
    equip: [
      seatBoxF, backPadF,
      { k: 'frame', pts: [[-17, 106], [17, 106]], z: 'back' },
      { k: 'frame', pts: [[0, 106], [0, 62]], z: 'back' },
      { k: 'fn', f: (o, J) => { for (const h of [J.handR, J.handL]) { tubo(o, [[h[0], 106], [h[0], h[1] - 2.5]], 1.5); } } },
      { k: 'roller', at: 'kn', dx: 5.6, dy: 0.5, r: 2.9 },
    ],
  };
}

// ---------- QUADRÍCEPS ----------
// Agachamento pêndulo: costas no encosto e ombros sob os apoios; o carro pende de um eixo no alto da torre e desce em arco.
export function pendulumSquat() {
  const P = [158.6, 96.5];
  const R = 76;
  const an = [112, 12];
  const fa = -20;
  const mk = (s) => {
    const al = entre(17.2, 35.8, s) * D2R;
    const sh = [P[0] - R * Math.cos(al), P[1] - R * Math.sin(al)];
    const torso = entre(-16, 2.6, s); // o encosto gira junto com o braço do pêndulo
    return { hip: [sh[0] - L.torso * Math.sin(torso * D2R), sh[1] - L.torso * Math.cos(torso * D2R)], torso, leg: { foot: an, footAng: fa }, arm: { rel: [6.5, -3] } };
  };
  const fd = [Math.cos(fa * D2R), -Math.sin(fa * D2R)];
  const sola = add(an, [-fd[1], fd[0]], -(L.ankle * 0.55 + 1.3));
  return {
    view: 'side',
    frames: passos(5).map(mk),
    equip: [
      { k: 'frame', pts: [[78, 0.8], [P[0] + 8, 0.8]] },
      { k: 'frame', pts: [[P[0] + 2, 0.8], [P[0] + 2, P[1]]], w: 2.4, z: 'back' },
      { k: 'frame', pts: [[add(sola, fd, -2)[0], add(sola, fd, -2)[1] - 1], [add(sola, fd, -2)[0], 0.8]], z: 'back' },
      { k: 'frame', pts: [[add(sola, fd, 8)[0], add(sola, fd, 8)[1] - 1], [add(sola, fd, 8)[0], 0.8]], z: 'back' },
      { k: 'fn', z: 'back', f: (o) => chapa(o, add(sola, fd, 2.5), fd, 9.5, 1.1) },
      { k: 'fn', z: 'back', f: (o, J) => {
        const up = J.up, back = [-up[1], up[0]], front = [up[1], -up[0]];
        tubo(o, [add(add(J.sh, up, 5), back, 7), add(add(J.sh, up, 24), back, 4), P], 2); // braço do pêndulo: sobe por trás da cabeça e vai até o eixo
        const pino = add(add(J.sh, up, -7), back, 18.5);
        tubo(o, [add(add(J.sh, up, -7), back, 9.4), pino], 1.4);
        anilha(o, pino, 8);
        estofado(o, add(add(J.hip, back, 9.4), up, -2), add(add(J.hip, back, 9.4), up, 35));
        o.circ(add(add(J.sh, up, 4.5), front, 1), 3, 'fg-cush');
        eixo(o, P);
      } },
    ],
  };
}

// Agachamento com cinto (belt squat): a carga puxa o quadril para baixo por um cinto; as mãos seguram o apoio da frente.
export function beltSquat() {
  const top = 8;
  const leg = foot(X + 1, top + AK);
  const maoEm = (y) => ({ hand: [X + 22, top + y] }); // as mãos escorregam pela coluna de apoio
  const P = [152, top + 6];
  const R = 52;
  const ponta = (J) => {
    const y = J.hip[1] - 16.5;
    return [P[0] - Math.sqrt(Math.max(1, R * R - (y - P[1]) ** 2)), y];
  };
  return {
    view: 'side',
    frames: [{ hip: [X, top + H - 0.4], torso: 3, leg, arm: maoEm(60) }, { hip: [X - 9, top + 26.5], torso: 20, leg, arm: maoEm(44) }],
    equip: [
      { k: 'box', x0: 84, x1: 117, h: top },
      { k: 'frame', pts: [[X + 23.4, 0.8], [X + 23.4, top + 66]], w: 2, z: 'back' },
      { k: 'frame', pts: [[P[0] + 1, 0.8], [P[0] + 1, P[1]]], w: 2.2, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        const q = ponta(J);
        tubo(o, [P, q], 1.8);
        anilha(o, mix(P, q, 0.42), 6.5);
        o.line(add(J.hip, [1.5, -4.5]), q, 'fg-cable', 1.3); // tira que liga o cinto à alavanca
        eixo(o, P);
      } },
      { k: 'fn', f: (o, J) => { const front = [J.up[1], -J.up[0]]; const c = add(J.hip, J.up, 1.5); o.cap(add(c, front, -8.6), add(c, front, 7.4), 1.5, 1.5, 'fg-eqf'); } },
    ],
  };
}

// Leg press vertical: deitado de costas, os pés empurram a plataforma para cima, em linha com o quadril.
export function verticalLegPress() {
  const hip = [100, 12.4];
  const base = { hip, torso: -90, arm: { a: 94, b: 92 } };
  const mk = (y) => ({ ...base, leg: { foot: [99, y], footAng: 180 } });
  return {
    view: 'side',
    frames: [mk(55.6), mk(46.4)],
    equip: [
      { k: 'pad', a: [56, 3], b: [107, 3] },
      { k: 'frame', pts: [[52, 0.8], [118, 0.8]] },
      { k: 'frame', pts: [[84, 0.8], [84, 88], [112, 88], [112, 0.8]], w: 2, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        const y = J.anN[1] + L.ankle * 0.55 + 1.2;
        const c = [J.anN[0] - 2, y];
        chapa(o, c, [1, 0], 10.5, 1.1);
        tubo(o, [[84, y + 4], [112, y + 4]], 1.6); // travessa do carro, que corre nas duas colunas
        tubo(o, [[c[0], y + 1], [c[0], y + 4]], 1.6);
        anilha(o, [c[0], y + 12.5], 7.5);
      } },
    ],
  };
}

// Sissy squat no banco: pés presos sob o rolo e panturrilhas no apoio; as canelas ficam paradas e o quadril senta para trás.
export function sissySquat() {
  const kn = [X + 1, AK + L.shin];
  const mk = (psi) => ({
    hip: [kn[0] - L.thigh * Math.sin(psi * D2R), kn[1] + L.thigh * Math.cos(psi * D2R)],
    torso: 2 + psi * 0.07, leg: { a: psi, b: 0 }, arm: MAOS_NO_PEITO,
  });
  const an = [kn[0], AK];
  return {
    view: 'side',
    frames: [0, 22, 44, 66, 86].map(mk),
    equip: [
      { k: 'frame', pts: [[82, 0.8], [118, 0.8]] },
      { k: 'pad', a: [kn[0] - 6.8, 8.5], b: [kn[0] - 6.8, 18.6] },
      { k: 'frame', pts: [[kn[0] - 8.6, 13.5], [kn[0] - 14, 13.5], [kn[0] - 14, 0.8]], z: 'back' },
      { k: 'frame', pts: [[an[0] + 5.6, an[1] + 4.4], [an[0] + 12, an[1] + 4.4], [an[0] + 12, 0.8]], z: 'back' },
      { k: 'roller', at: [an[0] + 5.6, an[1] + 4.4], r: 2.6, z: 'front' },
    ],
  };
}

// ---------- POSTERIORES ----------
// Flexão de joelhos no banco GHD (glute-ham raise): pés presos, coxas na almofada; o corpo desce reto até a horizontal e volta.
export function ghdRaise() {
  const A = [70, 50];
  const C = [101, 38.5];
  const mk = (s) => {
    const beta = entre(3, 24.9, s) * D2R, psi = entre(84, 0, s);
    const K = [A[0] + L.shin * Math.cos(beta), A[1] - L.shin * Math.sin(beta)];
    return {
      hip: [K[0] + L.thigh * Math.sin(psi * D2R), K[1] + L.thigh * Math.cos(psi * D2R)],
      torso: psi, head: -psi * 0.28, leg: { foot: A, footAng: 90 }, arm: MAOS_NO_PEITO,
    };
  };
  return {
    view: 'side',
    frames: [1, 0.75, 0.5, 0.25, 0].map(mk),
    equip: [
      { k: 'frame', pts: [[58, 0.8], [126, 0.8]] },
      { k: 'frame', pts: [[A[0] - 4.6, 0.8], [A[0] - 4.6, 41]], w: 2, z: 'back' },
      { k: 'frame', pts: [[A[0] - 4.6, 26], [C[0], 26]], z: 'back' },
      { k: 'frame', pts: [[C[0], C[1] - 6], [C[0], 0.8]], w: 2, z: 'back' },
      { k: 'fn', z: 'back', f: (o) => {
        chapa(o, [A[0] - 3.6, A[1] - 1], [0, 1], 10, 0.9);                        // chapa onde a sola dos pés empurra
        o.cap([C[0] - 2.5, C[1]], [C[0] + 2.5, C[1]], 6.5, 6.5, 'fg-cush');       // almofada em meia-lua, sob as coxas
        o.line([C[0] - 4, C[1] + 4.6], [C[0] + 4, C[1] + 4.6], 'fg-cushhi', 0.45);
        rolo(o, [A[0] + 2.6, A[1] - 5], 2.3);                                     // rolo de baixo, na frente da canela
      } },
      { k: 'roller', at: [A[0] + 3.4, A[1] + 4.9], r: 2.5, z: 'front' },          // rolo de cima, sobre o calcanhar
    ],
  };
}

// ---------- GLÚTEOS ----------
// Hiperextensão reversa: tronco apoiado na mesa, quadril na borda; as pernas sobem até a linha do corpo, puxando o pêndulo.
export function reverseHyper() {
  const hip = [84, 52];
  const base = { hip, torso: 90, head: -24, arm: { hand: [127, 37.5] } };
  const P = [87, 44];
  const BRACO = 36;
  return {
    view: 'side',
    frames: [{ ...base, leg: { a: 12, b: 12 } }, { ...base, leg: { a: -93, b: -93 } }],
    equip: [
      { k: 'pad', a: [88.5, 42.8], b: [114, 42.8] },
      { k: 'frame', pts: [[108, 41], [108, 0.8]], w: 2 },
      { k: 'frame', pts: [[96, 41], [108, 16]] },
      { k: 'frame', pts: [[82, 0.8], [132, 0.8]] },
      { k: 'frame', pts: [[127, 0.8], [127, 36]], w: 2, z: 'back' },
      { k: 'frame', pts: [[123.5, 36], [130.5, 36]], w: 1.8, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        const d = norm([J.anN[0] - J.knN[0], J.anN[1] - J.knN[1]]);
        const r = add(J.anN, [d[1], -d[0]], 4.8);            // rolo/tira atrás dos tornozelos
        const perna = Math.atan2(d[0], -d[1]) / D2R;         // ângulo das pernas (0 = penduradas)
        const e = polar(P, BRACO, entre(6, -88, (12 - perna) / 105));
        tubo(o, [P, e], 1.8);
        anilha(o, e, 5.5);
        o.line(e, r, 'fg-cable', 1.3);
        rolo(o, r, 2.5);
        eixo(o, P);
      } },
    ],
  };
}

// ---------- ADUTORES / ABDUTORES ----------
// Abdução de quadril em pé no multi-hip, vista de frente: o rolo fica por fora da coxa e a perna abre para o lado.
export function multiHip() {
  const base = { hip: [X, H], legL: { a: 3, b: 2 }, arm: { a: 12, b: -40, lb: 0.5 } }; // mãos na barra de apoio, à frente da cintura
  const pv = [X + L.hpw, H + 1];
  return {
    view: 'front', label: 'Vista de frente',
    frames: [{ ...base, legR: { a: 3, b: 3 } }, { ...base, legR: { a: 36, b: 36 } }],
    equip: [
      { k: 'tower', x: 44, only: 'L', top: 84 },
      { k: 'fn', z: 'back', f: (o) => tubo(o, [[X - 41, pv[1]], pv], 2) },
      { k: 'fn', f: (o, J) => {
        const d = norm([J.knR[0] - J.hjR[0], J.knR[1] - J.hjR[1]]);
        const r = add(add(J.knR, d, -3.5), [-d[1], d[0]], 6.2);
        tubo(o, [pv, r], 1.7);
        rolo(o, r, 2.9);
        eixo(o, pv);
        tubo(o, [[X - 41, J.handR[1]], [J.handR[0] + 4, J.handR[1]]], 1.5); // barra de apoio das mãos
      } },
    ],
  };
}

// ---------- PANTURRILHAS ----------
// Panturrilha burrinho na máquina: tronco inclinado, antebraços no apoio, almofada sobre o quadril e ponta dos pés no degrau.
export function donkeyCalf() {
  const toe = [100, 7.9];
  const hipDe = (an) => [92.5, an[1] + 43.6];
  const S = add(hipDe(ankleFromToe(toe, -14)), [L.torso * Math.sin(80 * D2R), L.torso * Math.cos(80 * D2R)]);
  const mk = (fa) => {
    const an = ankleFromToe(toe, fa);
    const hip = hipDe(an);
    return { hip, torso: Math.atan2(S[0] - hip[0], S[1] - hip[1]) / D2R, head: -24, leg: { foot: an, footAng: fa }, arm: { a: 8, b: 92 } };
  };
  const el = add(S, [L.upper * Math.sin(8 * D2R), -L.upper * Math.cos(8 * D2R)]);
  const P = [58, 30];
  return {
    view: 'side',
    frames: [mk(-14), mk(38)],
    equip: [
      { k: 'box', x0: 94.5, x1: 114, h: 6 },
      { k: 'frame', pts: [[52, 0.8], [140, 0.8]] },
      { k: 'pad', a: [el[0] - 2.5, el[1] - 3.8], b: [el[0] + 16, el[1] - 3.3] },
      { k: 'frame', pts: [[el[0] + 7, el[1] - 5.5], [el[0] + 7, 0.8]], w: 2 },
      { k: 'frame', pts: [[el[0] + 16.8, el[1] - 3.3], [el[0] + 16.8, el[1] + 3.6]], w: 1.6, z: 'back' },
      { k: 'frame', pts: [[P[0], 0.8], P], w: 2.2, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        const up = J.up, back = [-up[1], up[0]];
        const a = add(add(J.hip, back, 10), up, -2.5), b = add(add(J.hip, back, 8.6), up, 9);
        const meio = add(mix(a, b, 0.5), back, 1.8);
        tubo(o, [P, meio], 1.8);
        anilha(o, mix(P, meio, 0.55), 7);
        estofado(o, a, b);
        eixo(o, P);
      } },
    ],
  };
}

// ---------- CARDIO ----------
// Bicicleta reclinada: assento baixo com encosto e pedais à frente do corpo.
export function recumbentBike() {
  const s = seated({ hx: 76, hy: 29, recl: 22, back: 32, post: false });
  const c = [114.5, 27];
  const R = 7.4;
  const fa = -55;
  const fd = [Math.cos(fa * D2R), -Math.sin(fa * D2R)];
  const PE = [2.8, 1.3]; // do tornozelo até o ponto da sola que empurra o pedal
  const N = 8;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const th = (90 - (360 / N) * i) * D2R;
    const p = [c[0] + R * Math.cos(th), c[1] + R * Math.sin(th)];
    const q = [c[0] - R * Math.cos(th), c[1] - R * Math.sin(th)];
    frames.push({
      hip: s.hip, torso: s.torso, head: 14,
      legN: { foot: add(p, PE, -1), footAng: fa }, legF: { foot: add(q, PE, -1), footAng: fa },
      arm: { hand: [s.hip[0] + 4, s.hip[1]] },
    });
  }
  const pedal = (o, an) => { const p = add(an, PE); o.line(c, p, 'fg-eq', 1.6); o.line(add(p, fd, -3.4), add(p, fd, 3.4), 'fg-eq', 1.9); };
  return {
    view: 'side', loop: true, frames,
    equip: [
      ...s.equip,
      { k: 'frame', pts: [[60, 17.6], [100, 17.6], [c[0] + 4, 13]], w: 2, z: 'back' },
      { k: 'frame', pts: [[66, 17.6], [64, 0.8]], z: 'back' },
      { k: 'frame', pts: [[56, 0.8], [138, 0.8]] },
      { k: 'circ', at: [c[0] + 8, 19], r: 13, c: 'fg-plate', z: 'back' },
      { k: 'frame', pts: [[c[0] + 13, 30], [c[0] + 16, 60]], w: 2, z: 'back' },
      { k: 'pad', a: [c[0] + 11.5, 63], b: [c[0] + 20, 60.5], th: 2, z: 'back' },
      { k: 'frame', pts: [[s.hip[0] + 5, 19], [s.hip[0] + 5, s.hip[1] - 1]], w: 1.5, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => { o.circ(c, 2.2, 'fg-eqs'); pedal(o, add(J.anF, [1.8, 1])); } },
      { k: 'fn', f: (o, J) => pedal(o, J.anN) },
    ],
  };
}

// Simulador de esqui: em pé, as mãos puxam os dois cabos do alto até as coxas, dobrando o quadril antes dos joelhos.
export function skiErg() {
  const leg = foot(97);
  const topo = [128, 108];
  return {
    view: 'side', label: 'Ordem: tronco e quadril, depois os braços',
    frames: [
      { hip: [96, H - 0.4], torso: 3, leg, arm: { hand: [112, 90] } },
      { hip: [93, 46], torso: 24, head: -10, leg, arm: { hand: [114, 60] } },
      { hip: [89, 43.5], torso: 40, head: -22, leg, arm: { hand: [95.5, 40.5] } },
    ],
    equip: [
      { k: 'frame', pts: [[114, 0.8], [142, 0.8]] },
      { k: 'frame', pts: [[131, 0.8], [131, 112]], w: 2.4, z: 'back' },
      { k: 'circ', at: [131, 99], r: 9.5, c: 'fg-plate', z: 'back' },
      { k: 'pad', a: [124.5, 78], b: [124.5, 85], th: 1.5, z: 'back' },
      { k: 'frame', pts: [[124.5, 81.5], [131, 81.5]], w: 1.2, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => o.line(topo, add(J.handF, [1.8, 1]), 'fg-cable', 0.8) },
      { k: 'cable', from: topo, z: 'back' },
      { k: 'handle' },
    ],
  };
}

// Esteira curva (sem motor): a mesma passada da caminhada, sobre a lona côncava que a própria pessoa faz girar.
export function curvedTreadmill() {
  const dy = 5.2;
  const K = 0.009;
  const sobe = (x) => K * (x - X) ** 2;
  const rampa = (x) => Math.atan(2 * K * (x - X)) / D2R;
  const frames = treadmill().frames.map((f) => {
    const g = { ...f };
    for (const q of ['legN', 'legF']) {
      const l = f[q];
      if (!l || !l.foot) continue;
      g[q] = { ...l, foot: [l.foot[0], l.foot[1] + sobe(l.foot[0])], footAng: (l.footAng || 0) - rampa(l.foot[0]) };
    }
    return g;
  });
  const lona = [];
  for (let x = 62; x <= 138; x += 4) lona.push([x, dy + sobe(x)]);
  return {
    view: 'side', loop: true, frames,
    equip: [
      { k: 'fn', z: 'back', f: (o) => {
        o.poly([...lona.map((p) => [p[0], p[1] - 1.1]), [138, 0.8], [62, 0.8]], 'fg-col');
        o.open(lona.map((p) => [p[0], p[1] - 1.1]), 'fg-eq', 2.2);
        o.open(lona.map((p) => [p[0], p[1] - 0.6]), 'fg-eqhi', 0.5);
      } },
      { k: 'frame', pts: [[133, dy + sobe(133) - 1], [141, 62]], w: 2, z: 'back' },
      { k: 'frame', pts: [[141, 60], [122, 55]], z: 'back' },
      { k: 'pad', a: [138, 64], b: [146, 61], th: 1.8, z: 'back' },
    ],
  };
}

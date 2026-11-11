// Animações de membros inferiores (quadríceps, posteriores, glúteos, adutores/abdutores, panturrilhas).
import { L } from './rig.js';
import { AK, H, X, SHY, D2R, CHAO, add, foot, frame, fromSh, shOf, ankleFromToe, stand, seated, SEAT_F, seatBoxF, backPadF, tower, estacao, POLIA_F } from './base.js';
import { P } from './equip.js';

const TRAP_ARM = { rel: [-3.2, 1.2], bend: 1, la: 0.62, lb: 0.6 };
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const meio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const sapata = (x0, x1, z) => ({ k: 'frame', pts: [[x0, CHAO], [x1, CHAO]], w: 1.7, ...(z ? { z } : {}) });
// pegador ao lado do assento: haste que sobe da cadeira até a mão
const pegadorDoAssento = (y0) => ({ k: 'fn', z: 'back', f: (o, J) => { const h = J.handN; o.line([h[0] - 1, y0], h, 'fg-eq', 1.3); } });

// ---------- AGACHAMENTOS ----------
export function squat({ tool = 'barbell' } = {}) {
  let A = { hip: [X, H], torso: 3, leg: foot(X + 1) };
  let B = { hip: [X - 10, 26], torso: 40, leg: foot(X + 1) };
  const eq = [];
  // suporte de agachamento à frente: coluna com furos, gancho na altura dos ombros, braço de segurança e pino de anilhas
  const suporte = (hook) => ({ k: 'rack', x: X + 35, top: 98, hook, dir: -1, saf: 38, safLen: 13, peg: 20, b0: 15, b1: 9 });
  if (tool === 'barbell') { A.arm = B.arm = TRAP_ARM; eq.push(suporte(71), { k: 'barbell', at: 'trap' }); }
  if (tool === 'front') { A.torso = 0; B = { ...B, hip: [X - 8, 25.5], torso: 26 }; A.arm = B.arm = { a: 70, b: 222 }; eq.push(suporte(66), { k: 'barbell' }); }
  if (tool === 'goblet') { A.torso = 0; B = { ...B, hip: [X - 8, 25], torso: 24 }; A.arm = B.arm = { rel: [8.5, -5.5] }; eq.push({ k: 'db', r: 4.6 }); }
  if (tool === 'bw') { A.arm = { a: 8, b: 14 }; B = { ...B, torso: 36 }; B.arm = { a: 82, b: 86 }; }
  if (tool === 'smith') {
    A = { hip: [X - 2, 46.4], torso: 2, leg: foot(X + 8), arm: TRAP_ARM };
    B = { hip: [X - 8.5, 27], torso: 13, leg: foot(X + 8), arm: TRAP_ARM };
    eq.push({ k: 'rail', x: X - 5.6, top: 104, at: 'trap' }, { k: 'barbell', at: 'trap' });
  }
  return { view: 'side', frames: [A, B], equip: eq };
}

export function jumpSquat() {
  const leg = foot(X + 1);
  return {
    view: 'side',
    frames: [
      { hip: [X - 9, 28], torso: 38, leg, arm: { a: 70, b: 80 } },
      { hip: [X, H], torso: 4, leg, arm: { a: 0, b: 6 } },
      { hip: [X, H + 9], torso: 0, leg: { foot: [X + 0.5, AK + 9.3], footAng: 40 }, arm: { a: -22, b: -10 } },
    ],
    equip: [],
  };
}

export function sumoSquat({ tool = 'kb' } = {}) {
  const mk = (hy, lt) => ({ hip: [X, hy], lt, leg: { foot: [17, AK] }, arm: { hand: [tool === 'barbell' ? 9 : 2.6, hy + L.torso * lt - 28.6] } });
  if (tool === 'barbell') {
    // levantamento terra sumô
    return { view: 'front', label: 'Vista de frente', frames: [mk(28, 0.5), mk(46, 1)], equip: [{ k: 'barbell', r: 10, w: 38 }] };
  }
  return {
    view: 'front', label: 'Vista de frente',
    frames: [mk(46, 1), mk(27, 0.93)],
    equip: tool === 'kb' ? [{ k: 'kb', center: true }] : [{ k: 'ballheld', r: 3.8, off: [0, -2] }],
  };
}

export function lateralLunge() {
  const A = { hip: [X, 46.5], leg: { foot: [9, AK] }, arm: { hand: [3, 60], la: 0.7, lb: 0.7 } };
  const B = { hip: [X + 13, 29], lt: 0.9, tilt: 6, legR: { foot: [10, AK] }, legL: { foot: [35, AK] }, arm: { hand: [3, 44], la: 0.7, lb: 0.7 } };
  const A2 = { ...A, legR: { foot: [23, AK] }, legL: { foot: [22, AK] } };
  return { view: 'front', label: 'Vista de frente', frames: [A2, B], equip: [] };
}

export function bandWalk() {
  const arm = { hand: [5, 58], la: 0.6, lb: 0.6 };
  const mk = (hx, r, l) => ({ hip: [hx, 40], legR: { foot: [r - hx, AK] }, legL: { foot: [hx - l, AK] }, arm });
  return {
    view: 'front', label: 'Vista de frente',
    frames: [mk(92, 99, 85), mk(97, 113, 85), mk(104, 113, 97), mk(109, 125, 97)],
    equip: [{ k: 'band', at: 'kn' }],
  };
}

export function hack() {
  const r = [-0.574, 0.819];
  const b0 = [104, 22];
  const torso = -35;
  const leg = { foot: [122, 9.5], footAng: -35 };
  const mk = (k) => ({ hip: add(b0, r, k), torso, leg, arm: { rel: [6.5, -3] } });
  const f = frame(torso);
  const trilho = add(b0, f.back, 14); // o trilho passa 28 cm atrás da linha do quadril
  return {
    view: 'side',
    frames: [mk(20), mk(4.5)],
    // hack: trilho inclinado atrás do encosto (apoiado na coluna de trás), carro com encosto, ombreiras, pegadores e
    // anilha no pino; a plataforma dos pés fica fixa na base
    equip: [
      sapata(49, 137),
      { k: 'frame', pts: [add(trilho, r, -15), add(trilho, r, 69)], w: 1.6, z: 'back' },
      { k: 'frame', pts: [add(trilho, r, 69), [add(trilho, r, 69)[0] - 1.5, CHAO]], w: 2, z: 'back' },
      { k: 'frame', pts: [[124.5, 8], [127, CHAO]], w: 1.8, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        const c = add(add(J.heelN, J.fdN, 4), J.fuN, -1.1);
        P.chapa(o, c, J.fdN, 10.5, 1, 'fg-steel');
        o.line(add(c, J.fdN, 9), [135, CHAO], 'fg-eq', 1.5);
      } },
      { k: 'fn', z: 'back', f: (o, J) => {
        const q = add(J.hip, f.back, 14);
        P.anilha(o, add(add(J.hip, f.back, 22.5), f.up, 27), 9);
        o.line(add(q, f.up, -4), add(q, f.up, 39), 'fg-eq', 3);
        P.estofado(o, add(add(J.hip, f.back, 9.4), f.up, -2), add(add(J.hip, f.back, 9.4), f.up, 36), 1.9);
        const om = add(J.sh, f.up, 4.8);
        o.line(add(om, f.back, 9), add(om, f.back, 4), 'fg-eq', 1.6);
        P.estofado(o, add(om, f.back, 4.5), add(om, f.front, 3.5), 2);
        o.line(add(om, f.front, 3.5), J.handN, 'fg-eq', 1.4);
      } },
      { k: 'handle' },
    ],
  };
}

export function legPress({ horizontal = false, uni = false, calf = false } = {}) {
  if (horizontal) {
    const s = seated({ hx: 78, recl: 16 });
    const mk = (x) => ({ hip: s.hip, torso: s.torso, leg: { foot: [x, 31], footAng: 270 }, arm: { a: -8, b: 22 } });
    return {
      view: 'side', frames: [mk(108), mk(118)],
      // leg press horizontal: cadeira, trilho baixo com o carro da plataforma e a torre da pilha na frente
      equip: [
        ...s.equip,
        sapata(s.hip[0] + 15, 148),
        { k: 'frame', pts: [[99, CHAO], [99, 12], [147.5, 12]], w: 2, z: 'back' },
        tower(152, 80, { trk: 'ankle', gain: 0.8 }),
        { k: 'fn', z: 'back', f: (o, J) => {
          const x = J.heelN[0] + 1.1;
          P.tubo(o, [[x + 1, 24], [x + 5, 12]], 1.6);
          o.line([x + 1, 39], [x + 11, 12.6], 'fg-eq', 1.3);
          o.line([x + 2, 12], [x + 13, 12], 'fg-eq', 3.2);
          P.chapa(o, [x, 31], [0, 1], 13, 1, 'fg-steel');
        } },
        pegadorDoAssento(s.hip[1] - 8),
        { k: 'handle' },
      ],
    };
  }
  const torso = -56;
  const hip = [84, 17.5];
  const f = frame(torso);
  // leg press 45°: base, trilho inclinado apoiado na coluna de trás, encosto reclinado no seu suporte, assento e pegadores;
  // o carro (trenó) corre no trilho levando a plataforma dos pés e a anilha no pino lateral
  const RA = [90, 10], rr = [0.707, 0.707];
  const RB = add(RA, rr, 76);
  const pad = [
    sapata(44, RB[0] + 6),
    { k: 'frame', pts: [RA, RB], w: 2, z: 'back' },
    { k: 'frame', pts: [RB, [RB[0] + 1.5, CHAO]], w: 2.2, z: 'back' },
    { k: 'frame', pts: [[RA[0], CHAO], RA], w: 1.8, z: 'back' },
    { k: 'frame', pts: [[54, CHAO], add(add(hip, f.back, 11.9), f.up, 27)], w: 1.8 },
    { k: 'frame', pts: [[hip[0] + 4, hip[1] - 10.6], [hip[0] + 4, CHAO]], w: 1.8 },
    { k: 'pad', a: add(add(hip, f.back, 9.4), f.up, -3), b: add(add(hip, f.back, 9.4), f.up, 37) },
    { k: 'pad', a: [hip[0] - 4, hip[1] - 8.8], b: [hip[0] + 10, hip[1] - 7.6] },
    pegadorDoAssento(hip[1] - 9),
    { k: 'handle' },
  ];
  const carro = (soPontas) => ({ k: 'fn', z: 'back', f: (o, J) => {
    const d = soPontas ? [-0.707, 0.707] : norm(sub(J.toeN, J.heelN)); // ao longo da chapa, para cima
    const c = soPontas ? add(add(J.toeN, d, 10), rr, 1.2) : add(add(meio(J.heelN, J.toeN), d, -4), rr, 1.2);
    const q = add(RA, rr, (c[0] - RA[0]) * rr[0] + (c[1] - RA[1]) * rr[1]); // ponto do trilho debaixo da chapa
    P.anilha(o, add(add(q, rr, 11.5), d, 9), 9);
    o.line(add(q, rr, -7), add(q, rr, 12), 'fg-eq', 3.2);
    P.tubo(o, [add(c, d, -12), add(q, rr, -1)], 1.6);
    o.line(add(add(c, d, 7), rr, 1), add(q, rr, 10), 'fg-eq', 1.4);
    P.chapa(o, c, d, 13, 1, 'fg-steel');
  } });
  const arm = { a: -12, b: 28 };
  if (calf) {
    const toe = [110.4, 52.1];
    const mk = (fa) => ({ hip, torso, arm, leg: { foot: ankleFromToe(toe, fa), footAng: fa } });
    return { view: 'side', frames: [mk(236), mk(204)], equip: [...pad, carro(true)] };
  }
  const bent = [97.4, 43.7]; // pés ~18 cm acima da linha do quadril na plataforma: canela quase perpendicular à chapa
  const ext = [107.7, 53.9];
  const rest = { foot: [106, AK + 1] };
  const A = { hip, torso, arm, leg: { foot: ext, footAng: 225 } };
  const B = { hip, torso, arm, leg: { foot: bent, footAng: 225 } };
  if (uni) { A.legF = rest; B.legF = rest; }
  return { view: 'side', frames: [A, B], equip: [...pad, carro(false)] };
}

function legMachineSeat(hx, hy, recl) {
  const s = seated({ hx, hy, recl });
  s.equip[0] = { k: 'pad', a: [hx - 6, hy - 8.3], b: [hx + 18, hy - 8.3] };
  return s;
}
const rollerFn = (side, dist = 4.6) => ({
  k: 'fn', f: (o, J) => {
    const d = norm([J.anN[0] - J.knN[0], J.anN[1] - J.knN[1]]);
    const nf = [-d[1] * side, d[0] * side];
    const p = add(add(J.anN, d, -2), nf, dist);
    // braço articulado no eixo do joelho, com o rolo de espuma na ponta
    P.tubo(o, [J.knN, p], 1.4);
    P.eixo(o, J.knN, 1.7);
    P.rolo(o, p, 2.9);
  },
});

export function legExtension({ uni = false } = {}) {
  const s = legMachineSeat(86, 33.5, 14);
  const base = { hip: s.hip, torso: s.torso, arm: { a: -10, b: 18 } };
  const A = { ...base, leg: { a: 88, b: -6 } };
  const B = { ...base, leg: { a: 88, b: 80 } };
  if (uni) { A.legF = { a: 88, b: -6 }; B.legF = { a: 88, b: -6 }; A.legN = A.leg; B.legN = B.leg; }
  // cadeira extensora: torre da pilha atrás do encosto, perna da frente da cadeira, pegadores e o braço com o rolo na canela
  return { view: 'side', frames: [A, B], equip: [sapata(49, s.hip[0] - 14), tower(55, 82, { trk: 'ankle', gain: 0.45 }), ...s.equip, { k: 'frame', pts: [[s.hip[0] + 16.5, s.hip[1] - 10.6], [s.hip[0] + 16.5, CHAO]], w: 2 }, sapata(s.hip[0] + 15, s.hip[0] + 21), pegadorDoAssento(s.hip[1] - 8), { k: 'handle' }, rollerFn(1)] };
}

export function legCurl({ mode = 'lying' } = {}) {
  if (mode === 'seated') {
    const s = legMachineSeat(84, 33.5, 16);
    const base = { hip: s.hip, torso: s.torso, arm: { a: -10, b: 18 } };
    return {
      view: 'side',
      frames: [{ ...base, leg: { a: 88, b: 72 } }, { ...base, leg: { a: 88, b: -26 } }],
      // cadeira flexora: torre atrás, perna da frente, apoio sobre as coxas, pegadores e o braço com o rolo atrás do tornozelo
      equip: [sapata(47, s.hip[0] - 14), tower(53, 82, { trk: 'ankle', gain: 0.45 }), ...s.equip, { k: 'frame', pts: [[s.hip[0] + 16.5, s.hip[1] - 10.6], [s.hip[0] + 16.5, CHAO]], w: 2 }, sapata(s.hip[0] + 15, s.hip[0] + 21), pegadorDoAssento(s.hip[1] - 8), { k: 'handle' }, { k: 'pad', a: [s.hip[0] + 9, s.hip[1] + 8.6], b: [s.hip[0] + 20, s.hip[1] + 8.4], z: 'front' }, rollerFn(-1)],
    };
  }
  if (mode === 'standing') {
    const base = { hip: [94, H], torso: 14, legF: foot(96), arm: { hand: [117, 66] } };
    return {
      view: 'side',
      frames: [{ ...base, legN: { a: 2, b: 0 } }, { ...base, legN: { a: 6, b: -104 } }],
      // flexora em pé: torre da pilha à frente com o pegador, braço do apoio da coxa e o rolo atrás do tornozelo
      equip: [sapata(84, 122), tower(126, 88, { trk: 'ankle', gain: 0.5 }), { k: 'frame', pts: [[121.5, 66], [115.5, 66]], w: 1.6, z: 'back' }, { k: 'frame', pts: [[121.5, 34], [105.5, 34]], z: 'back' }, { k: 'pad', a: [103.5, 28], b: [104.5, 40], z: 'back' }, rollerFn(-1)],
    };
  }
  const hip = [94, 27.2];
  const base = { hip, torso: 90, head: -14, arm: { a: 62, b: 118 } };
  return {
    view: 'side',
    frames: [{ ...base, leg: { a: -90, b: -93 } }, { ...base, leg: { a: -90, b: -204 } }],
    // mesa flexora: mesa com longarina e dois pés, base até a torre da pilha, pegadores sob a cabeceira e o braço com o rolo
    equip: [
      sapata(66, 148),
      { k: 'frame', pts: [[78, 16.2], [78, CHAO]], w: 2 }, { k: 'frame', pts: [[126, 16.2], [126, CHAO]], w: 2 },
      { k: 'frame', pts: [[72, 16], [132, 16]], w: 1.6 },
      { k: 'pad', a: [70, 18.4], b: [134, 18.4] },
      tower(153, 82, { trk: 'ankle', gain: 0.5 }),
      { k: 'fn', z: 'back', f: (o, J) => { const h = J.handN; o.line([h[0], 16], h, 'fg-eq', 1.3); } },
      { k: 'handle' },
      rollerFn(-1),
    ],
  };
}

// ---------- AFUNDOS ----------
export function lunge({ mode = 'split', tool = 'db' } = {}) {
  const back = (toeX) => ({ foot: ankleFromToe([toeX, 1.9], 62), footAng: 62 });
  const arm = tool === 'smith' ? TRAP_ARM : { a: 0, b: 5 };
  const eq = tool === 'db' ? [{ k: 'db' }] : tool === 'smith' ? [{ k: 'rail', x: 93.6, top: 104, at: 'trap' }, { k: 'barbell', at: 'trap' }] : [];
  if (mode === 'bulgarian') {
    const lf = { foot: [70, 19.6], footAng: 180 };
    return {
      view: 'side',
      frames: [{ hip: [96, 44.4], torso: 6, legN: foot(112), legF: lf, arm }, { hip: [95, 29.5], torso: 14, legN: foot(112), legF: lf, arm }],
      equip: [{ k: 'bench', x0: 44, x1: 78, h: 16.6 }, ...eq],
    };
  }
  if (mode === 'reverse') {
    return {
      view: 'side',
      frames: [{ hip: [X, H], torso: 2, legN: foot(X + 3), legF: foot(X), arm }, { hip: [X - 8, 27.5], torso: 10, legN: foot(X + 3), legF: back(66), arm }],
      equip: eq,
    };
  }
  if (mode === 'walk') {
    const up = { hip: [X, H], torso: 2, legN: foot(X + 1), legF: foot(X), arm };
    return {
      view: 'side', loop: true,
      frames: [up, { hip: [X - 2, 27.5], torso: 8, legN: foot(X + 15), legF: back(64), arm }, up, { hip: [X - 2, 27.5], torso: 8, legF: foot(X + 15), legN: back(64), arm }],
      equip: eq,
    };
  }
  const lf = back(76);
  return {
    view: 'side',
    frames: [{ hip: [97, 44], torso: 3, legN: foot(114), legF: lf, arm }, { hip: [97, 27.5], torso: 8, legN: foot(114), legF: lf, arm }],
    equip: eq,
  };
}

export function stepUp() {
  const top = 15;
  return {
    view: 'side',
    frames: [
      { hip: [98, H], torso: 12, legN: foot(114, top + AK), legF: foot(97), arm: { a: 4, b: 10 } },
      { hip: [112, top + H], torso: 2, legN: foot(114, top + AK), legF: foot(108, top + AK), arm: { a: 2, b: 8 } },
    ],
    equip: [{ k: 'box', x0: 104, x1: 130, h: top }],
  };
}

export function wallSit() {
  const base = { hip: [80.5, 26.6], torso: 0, leg: foot(103), arm: { a: 4, b: 10 } };
  return { view: 'side', slow: true, frames: [base, { ...base, sy: 0.7 }], equip: [{ k: 'wall', x: 72.7, top: 100 }] };
}

// ---------- DOBRADIÇA DE QUADRIL ----------
const lerp = (a, b, t) => a + (b - a) * t;
// gera quadros intermediários: o quadril recua, o tronco inclina e as mãos ficam penduradas no alcance do braço
function hingeFrames({ top, bot, handX, arm, extra, n = 5, reach = 28.7 }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const hip = [lerp(top.hip[0], bot.hip[0], s), lerp(top.hip[1], bot.hip[1], s)];
    const torso = lerp(top.torso, bot.torso, s);
    const f = { hip, torso, head: lerp(0, -30, s), leg: foot(X) };
    if (arm) f.arm = arm;
    else {
      const sh = shOf(hip, torso);
      const hx = lerp(handX[0], handX[1], s);
      const dx = hx - sh[0];
      f.arm = { hand: [hx, sh[1] - Math.sqrt(Math.max(1, reach * reach - dx * dx))] };
    }
    if (extra) Object.assign(f, extra(s, f));
    out.push(f);
  }
  return out;
}
const TOP = { hip: [X - 1, H], torso: 2 };

export function hinge({ mode = 'stiff', tool = 'barbell' } = {}) {
  const eq = tool === 'db' ? [{ k: 'db' }] : [{ k: 'barbell', r: mode === 'deadlift' || mode === 'hex' ? 10.5 : 8 }];
  if (mode === 'deadlift') {
    return { view: 'side', frames: hingeFrames({ top: { hip: [X - 1, H], torso: 0 }, bot: { hip: [85, 30], torso: 62 }, handX: [X + 4.6, 107] }).reverse(), equip: eq };
  }
  if (mode === 'hex') {
    return { view: 'side', frames: hingeFrames({ top: { hip: [X - 1, H], torso: 0 }, bot: { hip: [88, 30], torso: 50 }, handX: [X - 0.5, 104] }).reverse(), equip: eq };
  }
  if (mode === 'goodmorning') {
    return { view: 'side', frames: hingeFrames({ top: TOP, bot: { hip: [88, 45.4], torso: 68 }, arm: TRAP_ARM }), equip: [{ k: 'barbell', at: 'trap' }] };
  }
  if (mode === 'single') {
    const frames = hingeFrames({
      top: TOP, bot: { hip: [X - 7, 46.6], torso: 76 }, handX: [X + 4, X + 15],
      extra: (s) => ({ leg: undefined, legN: foot(X), legF: { a: lerp(0, -70, s), b: lerp(-4, -66, s) } }),
    });
    return { view: 'side', frames, equip: [{ k: 'db' }] };
  }
  if (mode === 'rdl') {
    return { view: 'side', frames: hingeFrames({ top: TOP, bot: { hip: [84, 43], torso: 70 }, handX: [X + 4.6, 106.5] }), equip: eq };
  }
  if (mode === 'pullthrough') {
    return {
      view: 'side',
      frames: hingeFrames({ top: { hip: [X - 1, H], torso: 0 }, bot: { hip: [92, 44], torso: 62 }, handX: [X + 2, 101], reach: 28.2 }).reverse(),
      equip: [...estacao(48, 8, { dir: 1, z: 'back' }), { k: 'handle' }],
    };
  }
  // stiff: joelhos quase estendidos
  return { view: 'side', frames: hingeFrames({ top: TOP, bot: { hip: [86, 45.6], torso: 78 }, handX: [X + 4.6, 108] }), equip: eq };
}

export function nordic() {
  const kn = [96, 4.6];
  const mk = (th) => {
    const r = th * D2R;
    return { hip: [kn[0] + L.thigh * Math.sin(r), kn[1] + L.thigh * Math.cos(r)], torso: th, leg: { foot: [74.6, 5.2], footAng: 180 }, arm: { a: th + 38, b: th + 128 } };
  };
  return {
    view: 'side', frames: [4, 17, 30, 43, 56].map(mk),
    // rolo que prende os tornozelos, no seu suporte com sapata
    equip: [{ k: 'mat', x0: 62, x1: 150 }, sapata(58, 72, 'back'), { k: 'frame', pts: [[72.6, 10.4], [65, 10.4], [65, CHAO]], w: 1.8, z: 'back' }, { k: 'roller', at: [72.6, 10.4], r: 2.8 }],
  };
}

export function ballLegCurl() {
  const sh = [68, 8.4];
  const mk = (hip, fx) => {
    const t = Math.atan2(sh[0] - hip[0], sh[1] - hip[1]) / D2R;
    return { hip, torso: t, head: 22, arm: { a: 76, b: 83 }, leg: { foot: [fx, 27.4], footAng: -30 } }; // mãos espalmadas no chão
  };
  return {
    view: 'side',
    frames: [mk([93.6, 17.5], 130), mk([94, 22], 116)],
    equip: [{ k: 'mat', x0: 50, x1: 110 }, { k: 'fn', z: 'back', f: (o, J) => o.circ([J.anN[0] + 1, 12.4], 12.4, 'fg-plate') }],
  };
}

// ---------- GLÚTEOS ----------
export function hipThrust({ tool = 'barbell', uni = false, floor = false } = {}) {
  const leg = foot(124);
  let A, B;
  const eq = [];
  if (floor) {
    // os braços ficam no chão ao lado do corpo, com as mãos espalmadas no colchonete, e não sobem com o quadril
    A = { hip: [100, 8.9], torso: -90, leg, arm: { a: 76, b: 83 } };
    B = { hip: [101.5, 21], torso: -115.5, head: 24, leg, arm: { a: 76, b: 83 } };
    eq.push({ k: 'mat', x0: 56, x1: 134 });
  } else {
    const arm = tool === 'none' ? { rel: [8, -9], la: 0.7, lb: 0.6 } : { rel: [7.4, -24.6] };
    A = { hip: [101, 11.6], torso: -64, leg, arm };
    B = { hip: [103, 24], torso: -90, leg, arm };
    eq.push({ k: 'bench', x0: 50, x1: 79, h: 15 });
    if (tool === 'barbell') eq.push({ k: 'barbell', at: 'hipfront' });
    if (tool === 'smith') eq.push({ k: 'rail', x: 103, top: 104, at: 'hipfront' }, { k: 'barbell', at: 'hipfront' });
    // máquina articulada: base, braço com eixo perto dos pés, anilha no pino e o rolo estofado sobre o quadril
    if (tool === 'machine') eq.push(sapata(74, 150), { k: 'frame', pts: [[144, CHAO], [144, 7]], w: 2.2 }, { k: 'lever', pivot: [144, 7], to: 'hipfront', plate: 0.2, pr: 6.5, w: 1.6 }, { k: 'roller', at: 'hipfront', r: 3 });
  }
  if (uni) { A.legN = leg; B.legN = leg; A.legF = { a: 100, b: 96 }; B.legF = { a: 112, b: 110 }; } // perna livre na linha do tronco
  return { view: 'side', frames: [A, B], equip: eq };
}

export function gluteKickback({ mode = 'cable' } = {}) {
  if (mode === 'quad') {
    const hip = [84, 26.6];
    const sh = shOf(hip, 88);
    const base = { hip, torso: 88, head: -24, arm: { hand: [sh[0] + 1, 2.8] }, legF: { a: 0, b: -90, footAng: 180 } };
    return { view: 'side', frames: [{ ...base, legN: { a: 0, b: -90, footAng: 180 } }, { ...base, legN: { a: -84, b: -174 } }], equip: [{ k: 'mat', x0: 50, x1: 130 }] };
  }
  if (mode === 'machine') {
    const hip = [90, H - 1];
    const base = { hip, torso: 42, head: -20, legF: foot(92), arm: { hand: [121, 50] } };
    return {
      view: 'side',
      frames: [{ ...base, legN: { a: 34, b: -52 } }, { ...base, legN: { a: -26, b: -24 } }],
      // glúteo máquina: coluna com o apoio de peito e o pegador, torre da pilha logo atrás dela e o braço com a chapa do pé
      equip: [
        sapata(84, 128),
        tower(133, 88, { trk: 'foot', gain: 0.4 }),
        { k: 'frame', pts: [[111, 50], [122, 44], [122, CHAO]], z: 'back', w: 2.2 },
        { k: 'frame', pts: [[122, 56], [128.5, 56]], w: 1.6, z: 'back' },
        { k: 'pad', a: [106, 46], b: [116, 54], z: 'back' },
        { k: 'fn', z: 'back', f: (o, J) => { const b = add(meio(J.heelN, J.toeN), J.fuN, -2); P.tubo(o, [b, [122, 36]], 1.5); P.eixo(o, [122, 36], 1.7); } },
        { k: 'fn', f: (o, J) => { const b = add(meio(J.heelN, J.toeN), J.fuN, -2); P.chapa(o, b, J.fdN, 5.5, 1, 'fg-steel'); } },
      ],
    };
  }
  const base = { hip: [94, H - 0.6], torso: 26, head: -14, legF: foot(96), arm: { hand: [121, 62] } };
  return {
    view: 'side',
    frames: [{ ...base, legN: { a: 2, b: 2 } }, { ...base, legN: { a: -34, b: -30 } }],
    // coluna de polia baixa: o cabo vai até a tornozeleira e as mãos seguram na coluna
    equip: [...estacao(128, 6, { to: 'ankle' }), { k: 'fn', f: (o, J) => o.line(add(J.anN, [-2.6, 0.6]), add(J.anN, [2.6, -0.6]), 'fg-grip', 2.4) }],
  };
}

// ---------- ADUTORES / ABDUTORES ----------
export function hipMachine({ ab = false } = {}) {
  const closed = { ...SEAT_F, leg: { a: 72, la: 0.12, b: 0, lb: 0.93 }, arm: { a: 14, b: -6, la: 0.8 } };
  const open = { ...SEAT_F, leg: { a: 86, la: 0.72, b: 0, lb: 0.93 }, arm: { a: 14, b: -6, la: 0.8 } };
  return {
    view: 'front', label: 'Vista de frente',
    frames: ab ? [closed, open] : [open, closed],
    // torre da pilha atrás do encosto, braços que saem do eixo sob o assento até as almofadas dos joelhos e os pegadores
    equip: [
      { k: 'tower', x: 0, top: 86, w: 22, trk: 'knR', gain: 0.6 }, seatBoxF, backPadF,
      { k: 'lever', pivot: [2.5, 21], to: 'kn', dx: ab ? 5.4 : -5.4, w: 1.5, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => { for (const h of [J.handR, J.handL]) o.line([h[0], 18], [h[0], h[1] + 2.5], 'fg-eq', 1.3); } },
      { k: 'roller', at: 'kn', dx: ab ? 5.4 : -5.4, dy: 0, r: 2.8 },
    ],
  };
}

export function hipCable({ ab = false } = {}) {
  const base = { hip: [X, H], legL: { a: 3, b: 2 }, armL: { hand: [26, 66] }, armR: { a: 8, b: 14 } };
  const sideX = ab ? X - 34 : X - 34;
  const frames = ab
    ? [{ ...base, legR: { a: 2, b: 2 } }, { ...base, legR: { a: 34, b: 34 } }]
    : [{ ...base, hip: [X, H], legR: { a: 32, b: 32 } }, { ...base, legR: { a: -12, b: -12 } }];
  // abdução: cabo vem do lado oposto; adução: cabo vem do mesmo lado da perna que trabalha
  const px = ab ? sideX : X + 46;
  const cabo = (x) => ({ k: 'fn', f: (o, J) => { o.line([x, 6], J.anR, 'fg-cable', 0.8); P.polia(o, [x, 6]); o.line(add(J.anR, [-2.6, 0]), add(J.anR, [2.6, 0]), 'fg-grip', 2.4); } });
  const eq = ab
    // abdução: a coluna da polia fica do lado oposto ao da perna que trabalha e serve de apoio para a mão
    ? [{ k: 'tower', x: 34, only: 'L', top: 104, py: 6, trk: 'anR' }, cabo(X - POLIA_F(34))]
    // adução: poste de apoio de um lado e a coluna da polia do lado da perna que trabalha
    : [{ k: 'frame', pts: [[-37, CHAO], [-25, CHAO]], w: 1.7, z: 'back' }, { k: 'frame', pts: [[-31, CHAO], [-31, 72]], w: 2.2, z: 'back' }, { k: 'tower', x: 46, only: 'R', top: 104, py: 6, trk: 'anR' }, cabo(X + POLIA_F(46))];
  return { view: 'front', label: 'Vista de frente', frames, equip: eq };
}

export function sideLying({ clam = false } = {}) {
  const base = { hip: [92, 12.4], tilt: 90, armR: { a: 96, b: 88 }, armL: { a: 0, b: 0, la: 0.5, lb: 0.45 } };
  if (clam) {
    const R = { a: -90, la: 0.5, b: -90, lb: 0.85 };
    return {
      view: 'front', floor: true, label: 'Deitado de lado',
      frames: [{ ...base, legR: R, legL: { a: 90, la: 0.5, b: 90, lb: 0.85 } }, { ...base, legR: R, legL: { a: 140, la: 0.55, b: 52, lb: 0.9 } }],
      equip: [{ k: 'mat', x0: 50, x1: 150, z: 'back' }, { k: 'band', at: 'kn' }],
    };
  }
  return {
    view: 'front', floor: true, label: 'Deitado de lado',
    frames: [{ ...base, legR: { a: -90, b: -90 }, legL: { a: 92, b: 92 } }, { ...base, legR: { a: -90, b: -90 }, legL: { a: 126, b: 126 } }],
    equip: [{ k: 'mat', x0: 40, x1: 150, z: 'back' }],
  };
}

// ---------- PANTURRILHAS ----------
export function calfRaise({ mode = 'bw' } = {}) {
  if (mode === 'seated') {
    const s = seated({ hx: 88, noBack: true });
    const toe = [116, 7];
    const mk = (fa) => ({ hip: s.hip, torso: 4, arm: { a: 30, b: 80 }, leg: { foot: ankleFromToe(toe, fa), footAng: fa } });
    return {
      view: 'side', frames: [mk(-12), mk(36)],
      // panturrilha sentado (articulada): base, calço dos pés, coluna do eixo à frente, braço com a anilha no pino e o apoio sobre as coxas
      equip: [
        ...s.equip,
        sapata(s.hip[0] + 15, 142),
        { k: 'box', x0: 110, x1: 124, h: 5 },
        { k: 'frame', pts: [[136, CHAO], [136, 33]], w: 2.2, z: 'back' },
        { k: 'fn', f: (o, J) => {
          const p = add(J.knN, [-3, 6.4]), pv = [136, 33];
          P.tubo(o, [add(p, [0, 1.6]), pv], 1.6);
          P.anilha(o, [p[0] + (pv[0] - p[0]) * 0.52, p[1] + 1.6 + (pv[1] - p[1] - 1.6) * 0.52], 6.5);
          P.eixo(o, pv, 1.8);
          P.estofado(o, add(p, [-5, 0]), add(p, [5, 0]), 1.8);
        } },
      ],
    };
  }
  if (mode === 'tibial') {
    const an = [92, 5.2];
    const base = { hip: [81, 47.6], torso: -14, arm: { a: -6, b: 2 } };
    return { view: 'side', frames: [{ ...base, leg: { foot: an, footAng: 0 } }, { ...base, leg: { foot: an, footAng: -30 } }], equip: [{ k: 'wall', x: 67.7, top: 100 }] };
  }
  const toe = [107, 7.9];
  const mk = (fa) => {
    const an = ankleFromToe(toe, fa);
    return { hip: [an[0] + 0.6, an[1] + 43.9], torso: 2, leg: { foot: an, footAng: fa } };
  };
  const A = mk(-14), B = mk(38);
  const eq = [{ k: 'box', x0: 101, x1: 122, h: 6 }];
  if (mode === 'machine') {
    A.arm = B.arm = { rel: [7.5, -3.5] };
    // panturrilha em pé: torre da pilha atrás, braço articulado com as ombreiras e os pegadores à frente dos ombros
    eq.unshift(sapata(64, 101), tower(72, 104, { trk: 'sh', gain: 1 }));
    eq.push({ k: 'fn', z: 'back', f: (o, J) => { const p = add(J.sh, [-1, 4.7]); P.tubo(o, [[76.5, 82], [p[0] - 3, p[1] + 1]], 1.8); P.eixo(o, [76.5, 82], 1.8); o.line([p[0] + 4, p[1]], J.handN, 'fg-eq', 1.3); } });
    eq.push({ k: 'fn', f: (o, J) => { const p = add(J.sh, [-1, 4.7]); P.estofado(o, add(p, [-4.5, 0]), add(p, [4, 0]), 1.9); } }, { k: 'handle' });
  } else if (mode === 'smith') {
    A.arm = B.arm = TRAP_ARM;
    eq.push({ k: 'rail', x: 96, top: 104, at: 'trap' }, { k: 'barbell', at: 'trap' });
  } else if (mode === 'db') {
    A.armN = B.armN = { a: 0, b: 4 };
    A.armF = B.armF = { hand: [122, 66] };
    A.legF = B.legF = { a: 4, b: -62 };
    eq.push({ k: 'db', single: true }, sapata(117, 131, 'back'), { k: 'frame', pts: [[124, CHAO], [124, 70]], z: 'back', w: 2.2 });
  } else {
    A.arm = B.arm = { hand: [122, 64] };
    eq.push(sapata(117, 131, 'back'), { k: 'frame', pts: [[124, CHAO], [124, 68]], z: 'back', w: 2.2 });
  }
  return { view: 'side', frames: [A, B], equip: eq };
}

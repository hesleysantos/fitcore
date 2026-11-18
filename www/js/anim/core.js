// Animações de abdômen/core, cardio e exercícios de corpo inteiro.
import { L } from './rig.js';
import { AK, H, X, SHY, D2R, CHAO, add, foot, frame, shOf, ankleFromToe, stand, seated, tower, estacao, POLIA_F } from './base.js';
import { P } from './equip.js';
import { torre } from './pecas.js';

const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const sapata = (x0, x1, z) => ({ k: 'frame', pts: [[x0, CHAO], [x1, CHAO]], w: 1.7, ...(z ? { z } : {}) });
// painel de aparelho de cardio: caixa inclinada com a tela
function painel(o, c, w = 5.5, h = 4.2, incl = -0.22) {
  const d = [Math.cos(incl), Math.sin(incl)], n = [-d[1], d[0]];
  P.bloco(o, c, d, n, w, h, 'fg-shroud');
  P.bloco(o, add(c, n, 0.3), d, n, w - 1.5, h - 1.5, 'fg-screen');
}

const HEAD_HANDS = { rel: [-2.2, 8.6], la: 0.5, lb: 0.55 };
// braço ao lado do corpo, deitado de costas: desce do ombro até o chão, com a mão espalmada no colchonete
const FLOOR_ARM = { a: 76, b: 83 };
const mat = (x0 = 50, x1 = 150) => ({ k: 'mat', x0, x1 });

function plankAt(shY, ankle) {
  const th = Math.asin((shY - ankle[1]) / 71);
  const hip = [ankle[0] + 44 * Math.cos(th), ankle[1] + 44 * Math.sin(th)];
  return { hip, torso: 90 - th / D2R, leg: { foot: ankle, footAng: 90 } };
}

// ---------- ABDÔMEN ----------
export function crunch({ mode = 'floor' } = {}) {
  if (mode === 'decline') {
    const hip = [110, 36.4];
    const leg = { foot: [130, 24], footAng: 20 };
    return {
      view: 'side',
      frames: [{ hip, torso: -110, leg, arm: HEAD_HANDS }, { hip, torso: -52, leg, arm: HEAD_HANDS }],
      // banco declinado: base, longarina sob o estofado, pé baixo na cabeceira, coluna alta com o rolo sob os joelhos e o rolo que prende os pés
      equip: [
        sapata(60, 141),
        { k: 'frame', pts: [[69, 9.6], [120, 26.6]], w: 1.5 },
        { k: 'frame', pts: [[73, 10.6], [73, CHAO]], w: 2 },
        { k: 'frame', pts: [[115, 24.6], [115, CHAO]], w: 2 },
        { k: 'frame', pts: [[120, 26.6], [135, 33], [135, CHAO]], w: 1.8, z: 'back' },
        { k: 'frame', pts: [[135, 33], [124.5, 38.4]], w: 1.5, z: 'back' },
        { k: 'pad', a: [66, 11], b: [118, 28.4] },
        { k: 'roller', at: [124, 38.6], r: 2.8, z: 'back' },
        { k: 'roller', at: [133.4, 30], r: 2.8 },
      ],
    };
  }
  if (mode === 'machine') {
    const s = seated({ hx: 92, recl: 0, noBack: true });
    const arm = { rel: [5.5, 3.5], bend: -1 };
    const hx = s.hip[0], hy = s.hip[1];
    // ponto preso ao braço móvel, que gira junto com o tronco em volta do eixo (na altura do quadril)
    const noBraco = (J, tras, cima) => add(add(J.hip, [-J.up[1], J.up[0]], tras), J.up, cima);
    const cauda0 = [hx - 13.5, hy - 6]; // ponta de baixo do braço com o tronco em pé: é nela que o cabo prende
    return {
      view: 'side',
      frames: [{ hip: s.hip, torso: 0, leg: s.leg, arm }, { hip: s.hip, torso: 38, leg: s.leg, arm, head: 12 }],
      // abdominal máquina: torre da pilha atrás; coluna fixa com o apoio lombar e o eixo na altura do quadril; braço móvel
      // que sobe por trás das costas (com a almofada das costas), passa por cima dos ombros e desce até os pegadores;
      // a ponta de baixo do braço puxa o cabo, que passa pela polia da base e vai levantar a pilha; rolo que prende os pés
      equip: [
        sapata(51, hx - 14),
        { k: 'fn', z: 'back', f: (o, J) => {
          const cauda = noBraco(J, 13.5, -6);
          torre(o, { x: 57, top: 86, w: 10, dir: 1, sobe: Math.hypot(cauda[0] - cauda0[0], cauda[1] - cauda0[1]), de: [cauda, [hx - 13.5, 5]] });
          P.tubo(o, [[hx - 18, CHAO], [hx - 18, hy], J.hip], 2.2);                         // coluna fixa e suporte do eixo
          P.tubo(o, [cauda, noBraco(J, 13, 3), noBraco(J, 13, 30), noBraco(J, 5, 37.5), J.handN], 1.9); // braço móvel
          P.tubo(o, [noBraco(J, 13, 3), J.hip], 1.9);
          o.circ(cauda, 1.1, 'fg-steel');
        } },
        ...s.equip,
        { k: 'pad', a: [hx - 9.6, hy - 3], b: [hx - 9.6, hy + 8], th: 1.7 },
        { k: 'fn', z: 'back', f: (o, J) => P.estofado(o, noBraco(J, 9.6, 13), noBraco(J, 9.6, 31), 1.8) },
        { k: 'frame', pts: [[hx + 15, CHAO], [hx + 29.5, CHAO], [hx + 29.5, 9]], w: 1.7, z: 'back' },
        { k: 'roller', at: 'ankle', off: [3.6, 3.4], r: 2.6 },
        { k: 'handle' },
        { k: 'fn', f: (o, J) => P.eixo(o, J.hip, 1.7) },
      ],
    };
  }
  if (mode === 'ball') {
    const hip = [104, 21.5];
    const leg = foot(126);
    return {
      view: 'side',
      frames: [{ hip, torso: -106, leg, arm: HEAD_HANDS }, { hip, torso: -68, leg, arm: HEAD_HANDS }],
      equip: [{ k: 'ball', c: [92, 13.2], r: 13.2 }],
    };
  }
  if (mode === 'cable') {
    const kn = [98, 4.6];
    const hip = [kn[0] - 3.1, kn[1] + 22.3];
    const leg = { foot: [76.6, 5.2], footAng: 180 };
    const arm = { rel: [5, 7], bend: -1 };
    return {
      view: 'side',
      frames: [{ hip, torso: 18, leg, arm }, { hip, torso: 80, leg, arm, head: 10 }],
      equip: [mat(60, 130), ...estacao(140, 106, { top: 112 }), { k: 'handle' }],
    };
  }
  if (mode === 'bicycle') {
    const base = { hip: [102, 9.6], torso: -70, arm: HEAD_HANDS };
    const inL = { a: 150, b: 62 };
    const out = { a: 104, b: 100 };
    return { view: 'side', loop: true, frames: [{ ...base, legN: inL, legF: out }, { ...base, legN: out, legF: inL }], equip: [mat(50, 160)] };
  }
  const hip = [104, 8.9];
  const leg = foot(124);
  return {
    view: 'side',
    // ao enrolar o tronco, a bacia continua apoiada no chão
    frames: [{ hip, torso: -90, leg, arm: HEAD_HANDS }, { hip: [104, 10.2], torso: -62, leg, arm: HEAD_HANDS, head: 8 }],
    equip: [mat(54, 140)],
  };
}

export function legRaise({ mode = 'lying' } = {}) {
  if (mode === 'captain') {
    const hip = [X, 58];
    const base = { hip, torso: 0, arm: { a: 4, b: 88 } };
    return {
      view: 'side',
      frames: [{ ...base, leg: { a: 2, b: 0 } }, { ...base, leg: { a: 98, b: 4 } }],
      // paralela de abdominal: base, coluna alta com a barra fixa no topo, encosto, braços com o apoio dos antebraços,
      // pegadores em pé e o degrau
      equip: [
        sapata(72, 118),
        { k: 'frame', pts: [[88.6, CHAO], [88.6, 106], [101, 106]], z: 'back', w: 2.4 },
        { k: 'frame', pts: [[88.6, 14], [98, 14]], w: 1.6, z: 'back' },
        { k: 'frame', pts: [[88.6, 64.4], [116.6, 64.4], [116.6, 67]], w: 1.6, z: 'back' },
        { k: 'line', a: [116.6, 66.4], b: [116.6, 73.4], c: 'fg-grip', w: 2.3, z: 'back' },
        { k: 'pad', a: [91, 56], b: [91, 90], z: 'back' },
        { k: 'pad', a: [98, 66.6], b: [112, 66.6], z: 'back' },
      ],
    };
  }
  if (mode === 'hanging') {
    const BY = 114;
    const hip = [X, BY - 29.3 - L.torso];
    const base = { hip, torso: 0, arm: { hand: [X + 1, BY - 1.5] } };
    return {
      view: 'side',
      frames: [{ ...base, leg: { a: 3, b: 1 } }, { ...base, leg: { a: 92, b: 90 } }],
      // barra fixa: coluna com sapata, braço que sustenta a barra e mão-francesa
      equip: [sapata(X - 33, X - 9, 'back'), { k: 'frame', pts: [[X - 22, CHAO], [X - 22, BY], [X + 7, BY]], w: 2.2, z: 'back' }, { k: 'frame', pts: [[X - 22, BY - 13], [X - 9, BY]], w: 1.3, z: 'back' }, { k: 'fixbar', at: [X + 1, BY], r: 1.8 }],
    };
  }
  if (mode === 'reverse') {
    return {
      view: 'side',
      frames: [{ hip: [96, 8.9], torso: -90, arm: FLOOR_ARM, leg: { a: 152, b: 62 } }, { hip: [94, 13.5], torso: -101, arm: FLOOR_ARM, leg: { a: 204, b: 116 } }],
      equip: [mat(46, 140)],
    };
  }
  const base = { hip: [96, 8.9], torso: -90, arm: FLOOR_ARM };
  return { view: 'side', frames: [{ ...base, leg: { a: 97, b: 97 } }, { ...base, leg: { a: 176, b: 174 } }], equip: [mat(46, 152)] };
}

export function plank({ mode = 'front' } = {}) {
  if (mode === 'side') {
    // corpo em linha reta, com o antebraço e o pé de baixo apoiados no colchonete
    const base = { hip: [84, 20.8], tilt: 73, legR: { a: -73, b: -73 }, legL: { a: 73, b: 73 }, armR: { a: 0, b: 90, lb: 0.55 }, armL: { a: 150, b: 30, la: 0.7, lb: 0.7 } };
    return { view: 'front', label: 'Vista de frente', slow: true, frames: [base, { ...base, hip: [84, 21.4] }], equip: [mat(36, 130)] };
  }
  if (mode === 'tap') {
    const p = plankAt(32, [54, 8]);
    const dn = { hand: [122.5, 2.7] };
    const tap = { rel: [6, -3.5], la: 0.7, lb: 0.7 };
    return { view: 'side', loop: true, frames: [{ ...p, armN: dn, armF: dn }, { ...p, armN: tap, armF: dn }, { ...p, armN: dn, armF: dn }, { ...p, armN: dn, armF: tap }], equip: [] };
  }
  // antebraços e mãos apoiados no colchonete (o cotovelo fica logo acima dele)
  const base = { hip: [100.3, 14.6], torso: 80, head: -10, arm: { a: 0, b: 90 }, leg: { foot: [57, 8], footAng: 90 } };
  return { view: 'side', slow: true, frames: [base, { ...base, hip: [100.3, 15.2] }], equip: [mat(46, 154)] };
}

export function abWheel() {
  const kn = [84, 4.6];
  const leg = { foot: [62.6, 5.2], footAng: 180 };
  const mk = (th, torso, hx) => ({ hip: [kn[0] + L.thigh * Math.sin(th * D2R), kn[1] + L.thigh * Math.cos(th * D2R)], torso, head: -18, leg, arm: { hand: [hx, 6] } });
  const fr = [0, 0.25, 0.5, 0.75, 1].map((s) => mk(5 + 45 * s, 75 + 9 * s, 116.5 + 35 * s));
  return { view: 'side', frames: fr, equip: [mat(52, 110), { k: 'wheel', r: 5.4 }] };
}

export function vUp() {
  return {
    view: 'side',
    frames: [
      { hip: [100, 9.1], torso: -90, arm: { a: 283, b: 277 }, leg: { a: 93, b: 93 } }, // braços estendidos atrás da cabeça, apoiados no chão
      { hip: [100, 9.5], torso: -46, arm: { a: 128, b: 128 }, leg: { a: 140, b: 140 } },
    ],
    equip: [mat(40, 160)],
  };
}

export function russianTwist() {
  // Sentado no colchonete, tronco inclinado para trás (por isso aparece mais curto), joelhos dobrados e juntos apontando
  // para quem olha, pés no chão. A bola sai do lado de um quadril, passa na frente do peito e desce ao lado do outro
  // quadril; ombros e tronco acompanham a bola e os joelhos não saem do lugar.
  const base = { hip: [X, 10], lt: 0.72, leg: { a: 152, la: 0.32, b: 2, lb: 0.58 } }; // joelhos um pouco afastados: o abdômen aparece entre eles
  // braço do lado da bola: dobrado e apontando para quem olha (aparece mais curto); o outro cruza na frente do corpo
  const br = (x, by, k) => ({ hand: [x, by], bend: 1, la: k, lb: k });
  const mk = (bx, by, tilt) => ({ ...base, tilt, armR: br(bx + 3.4, by, bx > 0 ? 0.7 : bx < 0 ? 0.9 : 0.45), armL: br(3.4 - bx, by, bx < 0 ? 0.7 : bx > 0 ? 0.9 : 0.45) });
  return {
    view: 'front', label: 'Vista de frente, sentado com o tronco inclinado para trás: ombros e tronco giram juntos; joelhos parados',
    frames: [mk(-13, 12.5, -7), mk(0, 26.5, 0), mk(13, 12.5, 7)],
    equip: [mat(60, 140), { k: 'ballheld', r: 4.4, off: [0, -1.5] }],
  };
}

export function woodchop() {
  const base = { hip: [X, H], leg: { a: 9, b: 5 } };
  return {
    view: 'front', label: 'Vista de frente',
    frames: [{ ...base, tilt: -8, armR: { hand: [-13, 90] }, armL: { hand: [13, 90] } }, { ...base, tilt: 12, armR: { hand: [8, 50] }, armL: { hand: [-8, 50] } }],
    equip: [{ k: 'tower', x: 46, only: 'L', top: 108, py: 102, trk: 'handR' }, { k: 'fn', f: (o, J) => { const p = [X - POLIA_F(46), 102]; o.line(p, J.handR, 'fg-cable', 0.8); P.polia(o, p); } }],
  };
}

export function pallof() {
  const base = stand({ legN: foot(X + 6), legF: foot(X - 4) });
  const sh = shOf(base.hip, 0);
  return {
    view: 'side', label: 'O cabo puxa de lado: o tronco não gira',
    frames: [{ ...base, arm: { hand: [sh[0] + 9, sh[1] - 8] } }, { ...base, arm: { hand: [sh[0] + 28, sh[1] - 7] } }],
    equip: [{ k: 'tower', x: X - 2, top: 104, z: 'back', trk: 'hand', gain: 0.4 }, { k: 'cable', from: [X - 2, sh[1] - 7], z: 'back' }, { k: 'handle' }],
  };
}

export function deadBug() {
  const base = { hip: [100, 8.9], torso: -90 };
  const armUp = { a: 180, b: 180 };
  const armBack = { a: 262, b: 264 };
  const top = { a: 178, b: 90 };
  const ext = { a: 104, b: 100 };
  const A = { ...base, armN: armUp, armF: armUp, legN: top, legF: top };
  return {
    view: 'side', loop: true,
    frames: [A, { ...base, armN: armUp, armF: armBack, legN: ext, legF: top }, A, { ...base, armN: armBack, armF: armUp, legN: top, legF: ext }],
    equip: [mat(36, 150)],
  };
}

export function birdDog() {
  const hip = [84, 26.6];
  const sh = shOf(hip, 88);
  const sup = { hand: [sh[0] + 1, 2.8] };
  const kneel = { a: 0, b: -90, footAng: 180 }; // ajoelhado: peito do pé apoiado no chão
  const base = { hip, torso: 88, head: -22 };
  const A = { ...base, armN: sup, armF: sup, legN: kneel, legF: kneel };
  return {
    view: 'side', loop: true,
    frames: [A, { ...base, armN: sup, armF: { a: 95, b: 95 }, legN: { a: -88, b: -91 }, legF: kneel }, A, { ...base, armN: { a: 95, b: 95 }, armF: sup, legN: kneel, legF: { a: -88, b: -91 } }],
    equip: [mat(40, 150)],
  };
}

export function mountainClimber() {
  // quadril um pouco mais alto que na prancha, para o joelho passar sem tocar o chão
  const base = { hip: [96, 27], torso: 79.3, head: -16, arm: { hand: [122.5, 2.7] } };
  const back = { foot: [57, 8], footAng: 90 };
  const fwd = { foot: [93, 12], footAng: 70 };
  return { view: 'side', loop: true, fast: true, frames: [{ ...base, legN: fwd, legF: back }, { ...base, legN: back, legF: fwd }], equip: [] };
}

export function hollow() {
  const base = { hip: [100, 9.9], torso: -77, head: 6, arm: { a: 256, b: 256 }, leg: { a: 104, b: 104 } };
  return { view: 'side', slow: true, frames: [base, { ...base, leg: { a: 106, b: 106 }, arm: { a: 254, b: 254 } }], equip: [mat(36, 160)] };
}

export function sideBend() {
  const base = { hip: [X, H], leg: { a: 6, b: 3 }, armL: { a: 34, b: -78, lb: 0.8 } };
  return {
    view: 'front', label: 'Vista de frente',
    frames: [{ ...base, tilt: 0, armR: { a: 3, b: 3 } }, { ...base, tilt: 17, armR: { a: 3, b: 3 } }],
    equip: [{ k: 'db', o: 'end', only: 'R' }],
  };
}

// ---------- CARDIO ----------
const lift = (frames, dy) => frames.map((f) => {
  const g = { ...f, hip: [f.hip[0], f.hip[1] + dy] };
  for (const k of ['leg', 'legN', 'legF']) if (g[k] && g[k].foot) g[k] = { ...g[k], foot: [g[k].foot[0], g[k].foot[1] + dy] };
  for (const k of ['arm', 'armN', 'armF']) if (g[k] && g[k].hand) g[k] = { ...g[k], hand: [g[k].hand[0], g[k].hand[1] + dy] };
  return g;
});

function gait(run, slope = 0) {
  const y = (x) => AK + (x - X) * slope;
  const st = run ? 13 : 12;
  const torso = run ? 9 : 4 + slope * 30;
  const aF = run ? { a: 42, b: 122 } : { a: 22, b: 40 };
  const aB = run ? { a: -38, b: 44 } : { a: -20, b: -8 };
  const aM = run ? { a: 4, b: 84 } : { a: 2, b: 16 };
  const hi = run ? H - 0.6 : H - 1.2;
  const lo = run ? H - 2.4 : H - 0.2;
  const fwd = { foot: [X + st, y(X + st) + (run ? 2 : 0.6)], footAng: run ? -8 : -16 };
  const back = { foot: [X - st, y(X - st) + (run ? 9 : 2.2)], footAng: run ? 74 : 36 };
  const under = { foot: [X + 1, y(X + 1)], footAng: -slope * 50 };
  const swing = { foot: [X - 3, y(X - 3) + (run ? 17 : 6)], footAng: run ? 60 : 24 };
  return [
    { hip: [X, hi], torso, legN: fwd, legF: back, armN: aB, armF: aF },
    { hip: [X, lo], torso, legN: under, legF: swing, armN: aM, armF: aM },
    { hip: [X, hi], torso, legN: back, legF: fwd, armN: aF, armF: aB },
    { hip: [X, lo], torso, legN: swing, legF: under, armN: aM, armF: aM },
  ];
}
export function treadmill({ run = false, incline = false } = {}) {
  const slope = incline ? 0.1 : 0;
  const dy = 5.2;
  const y = (x) => dy + (x - X) * slope;
  return {
    view: 'side', loop: true, fast: run,
    frames: lift(gait(run, slope), dy),
    ...(incline ? {} : { pisos: [{ x0: 56, x1: 140, y: dy }] }),
    // esteira: deque com a lona (as marcas correm para trás), rolo de trás, capô do motor, coluna, corrimão e painel
    equip: [{ k: 'fn', z: 'back', f: (o, J, t) => {
      const g = 4.3; // espessura do deque
      const yr = Math.max(0.3, y(56) - g); // a traseira do deque fica apoiada no chão
      o.poly([[56, y(56)], [140, y(140)], [140, y(140) - g], [56, yr]], 'fg-cush');
      o.line([57.5, y(57.5) - 0.55], [139, y(139) - 0.55], 'fg-grip', 1.1);
      const passo = 20.5, anda = ((t * (run ? 3 : 2) * passo) % passo + passo) % passo;
      for (let i = 0; i < 4; i++) { const x = 137 - anda - i * passo; if (x > 60) o.line([x, y(x) - 0.55], [x - 2.6, y(x - 2.6) - 0.55], 'fg-eqhi', 0.5); }
      o.circ([57, (y(57) + yr) / 2], Math.max(0.5, (y(57) - yr) / 2 + 0.2), 'fg-rub');
      if (incline) P.tubo(o, [[143, y(143) - g], [147, CHAO]], 1.7);
      o.poly([[130.5, y(130.5) - 0.2], [134.5, y(134.5) + 6.8], [151, y(151) + 6.6], [155, y(155) - g], [130.5, y(130.5) - g]], 'fg-shroud');
      P.tubo(o, [[147, y(147) + 6.4], [150.5, 67]], 2.2);
      P.tubo(o, [[149.6, 57], [127, 55.5]], 1.6);
      o.line([127, 55.5], [135, 56], 'fg-grip', 2.3);
      painel(o, [149, 70.5], 6, 4.4, -0.28);
    } }],
  };
}
export function farmerWalk() {
  const fr = gait(false).map((f) => ({ ...f, torso: 1, armN: { a: 1, b: 4 }, armF: { a: 1, b: 4 } }));
  return { view: 'side', loop: true, frames: fr, equip: [{ k: 'db', r: 4.6 }] };
}

export function bike({ air = false } = {}) {
  const c = [102, 19];
  const R = 7.4;
  const hip = [84, 51];
  const N = 8;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const th = (90 - (360 / N) * i) * D2R;
    const p = [c[0] + R * Math.cos(th), c[1] + R * Math.sin(th) + 3.4];
    const q = [c[0] - R * Math.cos(th), c[1] - R * Math.sin(th) + 3.4];
    const sw = Math.sin((360 / N) * i * D2R) * 4.5;
    frames.push({
      hip, torso: 30, head: -22,
      legN: { foot: p, footAng: -6 }, legF: { foot: q, footAng: -6 },
      armN: { hand: air ? [116 + sw, 64] : [117, 63] }, armF: { hand: air ? [116 - sw, 64] : [117, 63] },
    });
  }
  return {
    view: 'side', loop: true, frames,
    equip: [
      { k: 'fn', z: 'back', f: (o, J, t) => {
        // base com as duas travessas, pedivela de lá, canote e selim
        o.line([70, CHAO], [141, CHAO], 'fg-eq', 1.7);
        P.chapa(o, [71, 1.5], [1, 0], 3, 1.5, 'fg-rub');
        P.chapa(o, [140, 1.5], [1, 0], 3, 1.5, 'fg-rub');
        const pf = add(J.anF, [1.8, -2.4]);
        o.line(c, pf, 'fg-eq fg-far', 1.6);
        o.line(add(pf, [-3.5, 0]), add(pf, [4, 0]), 'fg-eq fg-far', 1.8);
        P.tubo(o, [[97, 23], [85.4, 40.4]], 2.4);
        if (air) {
          // air bike: quadro aberto, ventoinha grande na grade (as pás giram), protetor da corrente, coluna com o painel e os braços móveis
          const v = [125, 17];
          P.tubo(o, [[90, CHAO], [97, 23], c, [134, CHAO]], 2);
          o.circ(v, 14.5, 'fg-plate');
          o.circ(v, 12.8, 'fg-ring');
          for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3 - t * Math.PI * 4; o.line(add(v, [Math.cos(a) * 2.2, Math.sin(a) * 2.2]), add(v, [Math.cos(a + 0.35) * 11.8, Math.sin(a + 0.35) * 11.8]), 'fg-eqhi', 0.9); }
          o.cap(c, v, 3, 2.4, 'fg-shroud');
          o.circ(v, 2.2, 'fg-steel');
          P.tubo(o, [[122, 30], [120.5, 50]], 2);
          painel(o, [120, 53.5], 4.2, 3, -0.2);
          P.tubo(o, [[119, 20], add(J.handF, [1.8, 1])], 1.5, ' fg-far');
        } else {
          // bicicleta vertical: carenagem que envolve o volante e a pedivela, coluna do guidão e painel
          o.smooth([[91, 7], [108, 4.6], [129, 5], [134.5, 13], [131, 25], [120, 30.5], [101, 29], [92, 20]], 'fg-shroud');
          o.circ([120.5, 16.5], 9.6, 'fg-plate');
          o.circ([120.5, 16.5], 7.6, 'fg-ring');
          o.circ([120.5, 16.5], 1.6, 'fg-steel');
          P.tubo(o, [[124, 28], [120.2, 59], [117.6, 65]], 2.2);
          painel(o, [122.5, 70.5], 4.6, 3.6, -0.18);
          o.line([121.4, 60], [122.2, 66.6], 'fg-eq', 1.4);
        }
        o.cap([79, 42.5], [91, 41.6], 2.3, 1.2, 'fg-cush');
        P.eixo(o, c, 2.2);
      } },
      { k: 'fn', f: (o, J) => {
        const pn = add(J.anN, [0, -3.5]);
        P.tubo(o, [c, pn], 1.6);
        o.line(add(pn, [-3.5, 0]), add(pn, [4, 0]), 'fg-grip', 2);
        if (air) { P.tubo(o, [[119, 20], J.handN], 1.5); P.manopla(o, add(J.handN, [-0.6, -2.6]), add(J.handN, [0.6, 2.6])); } else P.manopla(o, [115.4, 64.2], [120.4, 65.4]);
      } },
    ],
  };
}

const VOL = [70, 14], EIXO = [133, 50];
function ladoEliptico(o, J, k, t, c) {
  const fase = (90 - 360 * t) * D2R + (k === 'F' ? Math.PI : 0);
  const pino = [VOL[0] + 5.2 * Math.cos(fase), VOL[1] + 5.2 * Math.sin(fase)];
  const des = k === 'F' ? [1.8, 1] : [0, 0];
  const h = add(J['hand' + k], des);
  const u = norm(sub(h, EIXO));
  const ponta = add(EIXO, u, -31);
  const calc = add(add(J['heel' + k], J['fd' + k], -2.5), J['fu' + k], -0.9), bico = add(add(J['toe' + k], J['fd' + k], 1.5), J['fu' + k], -0.9);
  o.open([pino, add(des, calc), add(des, bico), ponta], 'fg-eq' + c, 1.4);
  o.line(add(des, calc), add(des, bico), 'fg-grip' + c, 2.3);
  P.tubo(o, [add(h, u, 2.5), ponta], 1.5, c);
  o.line(add(h, u, -3), add(h, u, 3), 'fg-grip' + c, 2.2);
}

export function elliptical() {
  const N = 8;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const th = (90 - (360 / N) * i) * D2R;
    const ex = 11 * Math.cos(th), ey = 3 * Math.sin(th);
    const sw = Math.cos(th) * 7;
    frames.push({
      hip: [X, H + 7 + Math.abs(Math.sin(th)) * 0.6], torso: 6,
      legN: { foot: [X + 1 + ex, 15 + ey], footAng: -ex * 0.8 }, legF: { foot: [X + 1 - ex, 15 - ey], footAng: ex * 0.8 },
      armN: { hand: [X + 19 - sw, SHY + 1] }, armF: { hand: [X + 19 + sw, SHY + 1] },
    });
  }
  return {
    view: 'side', loop: true, frames,
    // elíptico de tração traseira: base, carenagem do volante atrás, coluna com o painel, e de cada lado a barra do pedal
    // (da manivela do volante até a ponta de baixo do braço móvel) com a plataforma do pé e o braço que balança no eixo da coluna
    equip: [
      { k: 'fn', z: 'back', f: (o, J, t) => {
        o.line([54, CHAO], [150, CHAO], 'fg-eq', 1.7);
        o.smooth([[57, 2.6], [58.5, 17], [66, 26.5], [77, 25.5], [83.5, 15], [83, 2.6]], 'fg-shroud');
        o.circ(VOL, 9.4, 'fg-plate');
        o.circ(VOL, 7.4, 'fg-ring');
        P.tubo(o, [[141, CHAO], [EIXO[0] + 1.5, EIXO[1] - 6], [131, 85]], 2.4);
        painel(o, [130, 89.5], 6, 4.2, -0.2);
        ladoEliptico(o, J, 'F', t, ' fg-far');
      } },
      { k: 'fn', f: (o, J, t) => { ladoEliptico(o, J, 'N', t, ''); P.eixo(o, VOL, 1.7); P.eixo(o, EIXO, 1.9); } },
    ],
  };
}

export function rower() {
  const leg = { foot: [114, 16], footAng: -52 };
  const hy = 21.5;
  return {
    view: 'side', label: 'Ordem: pernas, tronco, braços',
    frames: [
      { hip: [86, hy], torso: 22, leg, arm: { hand: [119, 37] } },
      { hip: [72, hy], torso: 20, leg, arm: { hand: [105, 37] } },
      { hip: [72, hy], torso: -16, leg, arm: { hand: [93, 38] } },
      { hip: [72, hy], torso: -16, leg, arm: { hand: [80, 38] } },
    ],
    // remo ergômetro: monotrilho com o pé de trás, pescoço e pés da frente, volante (ventoinha) dentro da grade,
    // braço do monitor, apoio dos pés, carrinho do assento com rodízios e a corrente até o pegador
    equip: [
      { k: 'fn', z: 'back', f: (o, J) => {
        const v = [147, 27];
        P.tubo(o, [[52, 11], [129, 11], [139, 19]], 2.2);
        P.tubo(o, [[56, 10], [53.5, CHAO]], 1.7);
        o.line([49, CHAO], [58, CHAO], 'fg-eq', 1.7);
        P.tubo(o, [[133, 14], [151, CHAO]], 1.9);
        o.line([146, CHAO], [157, CHAO], 'fg-eq', 1.7);
        o.circ(v, 13, 'fg-plate');
        o.circ(v, 11.3, 'fg-ring');
        o.circ(v, 6.2, 'fg-ring');
        o.circ(v, 2, 'fg-steel');
        P.tubo(o, [[142, 38.5], [135, 49]], 1.3);
        painel(o, [133.6, 51.6], 3.6, 2.6, 0.5);
        const cp = add(add(J.heelN, J.fdN, 3.4), J.fuN, -1);
        P.tubo(o, [add(cp, J.fuN, -0.8), [cp[0] + 1.5, 12]], 1.6);
        P.chapa(o, cp, J.fdN, 6.8, 1, 'fg-steel');
        const sx = J.hip[0];
        o.circ([sx - 3.6, 12.2], 1.2, 'fg-steel');
        o.circ([sx + 3.6, 12.2], 1.2, 'fg-steel');
        P.estofado(o, [sx - 6, 13.9], [sx + 6, 13.9], 1.5);
      } },
      { k: 'cable', from: [140.5, 30.5] }, { k: 'handle' },
    ],
  };
}

// Simulador de escada (stepmill): os degraus giram como uma escada rolante que desce, e a pessoa sobe sem sair do lugar.
// Em cada passada (um ciclo da animação) a escada desce dois degraus. O pé apoia inteiro num degrau e desce junto com
// ele enquanto a perna estende; depois sobe e pousa dois degraus acima, sem encostar no degrau do meio. Pernas alternadas.
export const ESCADA = {
  O: [X + 11, 22.5],   // quina (bocel) do degrau em que o pé de cá pousa no início do ciclo
  D: [16, 10],         // de um degrau ao seguinte: profundidade do piso e altura do espelho
  pe: [4, AK],         // tornozelo em relação à quina do degrau: o pé inteiro cabe no piso
  apoio: 5 / 8,        // parte da passada em que o pé fica no degrau
  x0: X - 11, x1: X + 46, // trecho à vista dos degraus (entre a plataforma de baixo e a cobertura de cima)
};
// quina do degrau k (0 = onde o pé de cá pousa em t = 0) no instante t: a escada desce dois degraus por ciclo
export const quinaEscada = (k, t) => add(ESCADA.O, ESCADA.D, k - 2 * t);
export function stairs() {
  const { O, D, pe, apoio } = ESCADA;
  const pouso = add(O, pe);
  // pé ao longo da passada (f = 0 no pouso): no degrau, desce com ele; no ar, sobe primeiro (o degrau de cima vem
  // vindo na direção da ponta do pé) e depois avança por cima da quina do degrau do meio até pousar dois degraus acima
  // (no ar, as posições são dadas em relação ao degrau de onde o pé saiu, que segue descendo: [x, y, ângulo do pé])
  const noAr = { 6: [1, 12, 16], 7: [25, 26, 8] };
  const peEm = (f) => {
    if (f <= apoio + 1e-9) return { foot: add(pouso, D, -2 * f), footAng: 0 };
    const [dx, dy, fa] = noAr[Math.round(f * 8)];
    return { foot: add(add(pouso, [dx, dy]), D, -2 * f), footAng: fa };
  };
  const hip0 = add(pouso, [-15, 31]);
  const sh = shOf(hip0, 7);
  const arm = { hand: [sh[0] + 15.5, sh[1] - 13.2] };
  const frames = [];
  for (let i = 0; i < 8; i++) {
    const f = i / 8;
    // o quadril sobe um pouco no meio do apoio simples e desce no apoio duplo
    const dy = 0.45 * Math.cos(4 * Math.PI * (f - 0.3125));
    frames.push({ hip: [hip0[0], hip0[1] + dy], torso: 7, head: -6, legN: peEm(f), legF: peEm((f + 0.5) % 1), arm });
  }
  const { x0, x1 } = ESCADA;
  const rail = [[X + 57, 75.5], [arm.hand[0] - 6, arm.hand[1] - 0.6], [X - 18, 48], [X - 18, 12]];
  return {
    view: 'side', loop: true, fast: true, frames,
    // simulador de escada: base, plataforma de baixo, degraus que descem girando (o piso de cada um com a quina clara),
    // carenagem lateral, cobertura de cima, coluna com o painel e o corrimão que acompanha a escada
    equip: [{ k: 'fn', z: 'back', f: (o, J, t) => {
      o.line([X - 30, CHAO], [X + 66, CHAO], 'fg-eq', 1.7);
      // perfil dos degraus à vista: dente a dente, recortado no trecho entre x0 e x1
      const k0 = Math.floor((x0 - O[0]) / D[0] + 2 * t) - 1, k1 = Math.ceil((x1 - O[0]) / D[0] + 2 * t) + 1;
      const pts = [];
      for (let k = k0; k <= k1; k++) { const q = quinaEscada(k, t); pts.push(q, add(q, [D[0], 0])); }
      const yEm = (x) => { // altura do perfil em x (onde há espelho, a de cima)
        for (let i = 0; i < pts.length - 1; i++) if (x >= pts[i][0] && x < pts[i + 1][0]) return pts[i][1];
        return pts[pts.length - 1][1];
      };
      const perfil = [[x0, yEm(x0)], ...pts.filter((p) => p[0] > x0 && p[0] < x1), [x1, yEm(x1)]];
      // fundo dos dentes: uma linha por baixo das quinas internas, que encontra o chão perto da plataforma
      const base = (x) => O[1] + ((x - O[0]) * D[1]) / D[0] - D[1] - 4;
      const FUNDO = 8; // abaixo disso os degraus somem na carenagem
      const xChao = (sobe) => O[0] + ((CHAO - sobe - O[1] + D[1] + 4) * D[0]) / D[1];
      o.poly([...perfil, [x1, base(x1)], [xChao(0), CHAO], [x0, CHAO]], 'fg-col');
      for (let i = 0; i < perfil.length - 1; i++) if (perfil[i][1] === perfil[i + 1][1]) o.line(perfil[i], perfil[i + 1], 'fg-eq', 1.2); // pisos
      for (let k = k0; k <= k1; k++) { const q = quinaEscada(k, t); if (q[0] > x0 + 0.6 && q[0] < x1 - 0.6) o.line(q, add(q, [2.2, 0]), 'fg-eqhi', 1.2); }
      // carenagem lateral, por baixo dos dentes; perto do chão ela esconde os degraus que vão dar a volta por baixo
      o.poly([[x0, CHAO], [x0, FUNDO], [xChao(CHAO - FUNDO + 1.5), FUNDO], [x1, base(x1) + 1.5], [x1, CHAO]], 'fg-shroud');
      // plataforma de baixo (onde se sobe no aparelho) e cobertura de cima, onde os degraus dão a volta
      o.poly([[X - 28, CHAO], [X - 28, 11.6], [x0 + 1.5, 11.6], [x0 + 1.5, CHAO]], 'fg-shroud');
      o.line([X - 27.5, 11.4], [x0 + 1, 11.4], 'fg-eq', 1.2);
      o.poly([[x1 - 1.5, base(x1) + 1.5], [x1 - 1.5, 54], [x1 + 3, 56.5], [X + 62, 56.5], [X + 64, 51], [X + 64, CHAO], [x1, CHAO]], 'fg-shroud');
      // coluna com o painel e o corrimão (desce acompanhando a escada até a plataforma)
      P.tubo(o, [[X + 59, 56], [X + 55, 96]], 2.4);
      P.tubo(o, rail, 1.6);
      o.line(add(arm.hand, [-6.5, -0.7]), add(arm.hand, [6, 0.6]), 'fg-grip', 2.3);
      painel(o, [X + 54, 100], 6, 4.2, -0.2);
    } }],
  };
}

export function jumpRope() {
  const arm = { a: 6, b: 62 };
  return {
    view: 'side', loop: true, fast: true,
    frames: [{ hip: [X, H - 0.6], torso: 0, leg: foot(X + 1), arm }, { hip: [X, H + 5], torso: 0, leg: { foot: [X + 1, AK + 5.4], footAng: 34 }, arm }],
    // a corda gira em volta das mãos: de lado ela aparece como um arco que passa por cima da cabeça, pela frente,
    // por baixo dos pés (no instante do salto) e por trás
    equip: [{ k: 'fn', f: (o, J, t) => {
      const ph = t * 2 * Math.PI, h = J.handN;
      const ponta = [h[0] - 26 * Math.sin(ph) - 4 - 3.5 * (1 - Math.cos(ph)), h[1] + 46 * Math.cos(ph) - (Math.cos(ph) < 0 ? 0 : 8)];
      const v = [ponta[0] - h[0], ponta[1] - h[1]], n = [-v[1], v[0]];
      const pts = [];
      for (let i = 0; i <= 8; i++) { const u = i / 8, b = Math.sin(u * Math.PI) * 0.09; pts.push([h[0] + v[0] * u + n[0] * b, h[1] + v[1] * u + n[1] * b]); }
      o.open(pts, 'fg-cable', 1);
      o.line(add(h, [-1.6, 0.4]), add(h, [1.9, -0.5]), 'fg-grip', 1.9);
    } }],
  };
}

// ---------- CORPO INTEIRO ----------
export function burpee() {
  const p = plankAt(32, [54, 8]);
  const crouch = { hip: [X - 1, 21.5], torso: 68, head: -30, leg: { foot: ankleFromToe([X + 9, 1.7], 46), footAng: 46 }, arm: { hand: [123, 2.7] } };
  const hop = { hip: [86, 27], torso: 84, head: -24, leg: { foot: [70, 10], footAng: 105 }, arm: { hand: [123, 2.7] } };
  return {
    view: 'side', loop: true, long: true,
    frames: [
      { hip: [X, H], torso: 0, leg: foot(X + 2), arm: { a: 2, b: 8 } },
      crouch,
      hop,
      { ...p, head: -18, arm: { hand: [123, 2.7] } },
      hop,
      crouch,
      { hip: [X, H + 10], torso: 0, leg: { foot: [X + 1.5, AK + 10.5], footAng: 36 }, arm: { a: 174, b: 178 } },
    ],
    equip: [],
  };
}

export function kbSwing() {
  return {
    view: 'side',
    frames: [
      { hip: [86, 42], torso: 56, head: -30, leg: foot(X), arm: { a: -27, b: -22 } },
      { hip: [X - 1, H], torso: -3, leg: foot(X), arm: { a: 88, b: 91 } },
    ],
    equip: [{ k: 'kb' }],
  };
}

export function thruster({ clean = false } = {}) {
  const rackArm = { rel: [7.5, 3.6] };
  const leg = foot(X + 1);
  const up = { hip: [X, H], torso: 0, leg };
  const sh = shOf(up.hip, 0);
  const press = { ...up, arm: { hand: [sh[0] + 1, sh[1] + 28.6] } };
  if (clean) {
    const A = { hip: [88, 40], torso: 55, head: -30, leg };
    const sa = shOf(A.hip, A.torso);
    return { view: 'side', frames: [{ ...A, arm: { hand: [sa[0] - 1, sa[1] - 28.6] } }, { ...up, arm: rackArm }, press], equip: [{ k: 'db' }] };
  }
  return { view: 'side', frames: [{ hip: [X - 8, 26], torso: 28, leg, arm: rackArm }, { ...up, arm: rackArm }, press], equip: [{ k: 'db' }] };
}

export function battleRope() {
  const base = { hip: [X - 8, 38.5], torso: 28, leg: foot(X - 1) };
  const hi = { a: 62, b: 88 };
  const lo = { a: 34, b: 52 };
  const wave = (o, h, ph) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const x = h[0] + (176 - h[0]) * u;
      const base = h[1] + (2 - h[1]) * Math.min(1, u * 1.6);
      pts.push([x, Math.max(1, base + Math.sin(u * 9 - ph) * 7 * (1 - u) * Math.min(1, u * 5))]);
    }
    o.open(pts, 'fg-eq', 2);
  };
  return {
    view: 'side', loop: true, fast: true,
    frames: [{ ...base, armN: hi, armF: lo }, { ...base, armN: lo, armF: hi }],
    equip: [{ k: 'fn', z: 'back', f: (o, J, t) => wave(o, add(J.handF, [1.8, 1]), t * 2 * Math.PI + Math.PI) }, { k: 'fn', f: (o, J, t) => wave(o, J.handN, t * 2 * Math.PI) }, { k: 'circ', at: [176, 2], r: 2.4, c: 'fg-eqs' }],
  };
}

export function boxJump() {
  const top = 20;
  const bx = 112;
  return {
    view: 'side', loop: true, long: true,
    frames: [
      { hip: [82, H], torso: 2, leg: foot(83), arm: { a: 4, b: 10 } },
      { hip: [76, 31], torso: 42, leg: foot(83), arm: { a: -34, b: -20 } },
      { hip: [98, 54], torso: 20, leg: { foot: [102, 30], footAng: 10 }, arm: { a: 60, b: 90 } },
      { hip: [bx + 2, top + 30], torso: 34, leg: foot(bx + 10, top + AK), arm: { a: 40, b: 70 } },
      { hip: [bx + 9, top + H], torso: 2, leg: foot(bx + 10, top + AK), arm: { a: 4, b: 10 } },
      { hip: [bx - 4, 44], torso: 16, legN: foot(bx + 6, top + AK), legF: foot(bx - 14, AK), arm: { a: 4, b: 10 } },
    ],
    equip: [{ k: 'box', x0: bx, x1: bx + 30, h: top }],
    pisos: [{ x0: bx, x1: bx + 30, y: top }],
  };
}

export function jumpingJack() {
  return {
    view: 'front', label: 'Vista de frente', fast: true,
    frames: [{ hip: [X, H], arm: { a: 8, b: 10 }, leg: { foot: [5.6, AK] } }, { hip: [X, H - 1.6], arm: { a: 160, b: 168 }, leg: { foot: [17, AK] } }],
    equip: [],
  };
}

export function slam() {
  const leg = foot(X + 1);
  return {
    view: 'side',
    frames: [{ hip: [X, H], torso: -2, leg, arm: { a: 170, b: 176 } }, { hip: [X - 8, 34], torso: 48, head: -26, leg, arm: { a: 24, b: 30 } }],
    equip: [{ k: 'fn', f: (o, J) => { const p = J.handN; o.circ(p, 5.6, 'fg-rub'); o.circ(p, 3.9, 'fg-ring'); } }],
  };
}

export function sledPush() {
  const hip = [84, 40];
  const torso = 54;
  const sh = shOf(hip, torso);
  const arm = { hand: [sh[0] + 25, sh[1] + 3] };
  const under = foot(90);
  const back = { foot: ankleFromToe([56, 2], 52), footAng: 52 };
  return {
    view: 'side', loop: true,
    frames: [{ hip, torso, head: -30, arm, legN: under, legF: back }, { hip, torso, head: -30, arm, legN: back, legF: under }],
    // trenó: esquis com a ponta virada, hastes para empurrar (a de trás mais alta), travessa e o pino central com as anilhas deitadas
    equip: [{ k: 'fn', z: 'back', f: (o) => {
      const x0 = sh[0] + 20.4;
      P.tubo(o, [[x0 - 3.5, 3.6], [x0, CHAO], [x0 + 36, CHAO], [x0 + 39.5, 3.6]], 1.9);
      P.tubo(o, [[x0 + 6, CHAO], [x0 + 6, sh[1] + 12]], 2.4);
      P.tubo(o, [[x0 + 31, CHAO], [x0 + 31, 40]], 2.2);
      o.line([x0 + 6, 30], [x0 + 31, 30], 'fg-eq', 1.4);
      o.line([x0 + 18.5, 2], [x0 + 18.5, 19], 'fg-eq', 1.6);
      for (let i = 0; i < 3; i++) P.chapa(o, [x0 + 18.5, 3.3 + i * 2.7], [1, 0], 8.6 - i * 0.9, 1.15, 'fg-rub');
    } }],
  };
}

export function getUp() {
  const upArm = (hip, torso) => { const s = shOf(hip, torso); return { hand: [s[0] + 0.5, s[1] + 29] }; };
  const f0 = { hip: [100, 8.9], torso: -90, legN: foot(120), legF: { foot: [143.6, 5.4], footAng: -80 }, armF: { hand: [96, 5.5], bend: 1, la: 0.85, lb: 0.85 } };
  const f1 = { hip: [100, 9.5], torso: -35, legN: foot(120), legF: { foot: [143.6, 5.4], footAng: -80 }, armF: { hand: [78, 3], bend: 1, la: 1, lb: 1 } };
  const f2 = { hip: [100, 18], torso: -55, legN: foot(120), legF: { foot: [116, 11], footAng: 45 }, armF: { hand: [76.2, 4.1], bend: 1, la: 1, lb: 1 } };
  const f3 = { hip: [100, 27], torso: 0, legN: foot(117), legF: { foot: [78, 9], footAng: 75 }, armF: { a: 8, b: 14 } };
  const f4 = { hip: [X, H], torso: 0, legN: foot(X + 3), legF: foot(X - 1), armF: { a: 4, b: 10 } };
  const fr = [f0, f1, f2, f3, f4];
  for (const f of fr) f.armN = upArm(f.hip, f.torso);
  return { view: 'side', long: true, frames: fr, equip: [{ k: 'kb', single: true }] };
}

export function bearCrawl() {
  const hip = [78, 28];
  const torso = 84;
  const sh = shOf(hip, torso);
  const base = { hip, torso, head: -24 };
  const h = (dx) => ({ hand: [sh[0] + 2 + dx, 2.8] });
  const f = (dx) => ({ foot: [62 + dx, 9], footAng: 72 });
  return {
    view: 'side', loop: true,
    frames: [{ ...base, armN: h(5), armF: h(-3), legN: f(-4), legF: f(6) }, { ...base, armN: h(-3), armF: h(5), legN: f(6), legF: f(-4) }],
    equip: [],
  };
}

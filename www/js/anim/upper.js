// Animações de membros superiores (peito, ombros, tríceps, costas, bíceps, antebraço).
// Convenção: frames[0] = posição inicial descrita no exercício; frames[1] = fim do movimento.
import { L } from './rig.js';
import { AK, H, X, SHY, D2R, CHAO, add, foot, frame, fromSh, shOf, stand, recline, seated, SEAT_F, seatBoxF, backPadF, tower, estacao, POLIA_F, ankleFromToe } from './base.js';
import { P } from './equip.js';

const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const sapata = (x0, x1, z) => ({ k: 'frame', pts: [[x0, CHAO], [x1, CHAO]], w: 1.7, ...(z ? { z } : {}) });
// crossover visto de frente: duas colunas com pilha, travessa do alto e o cabo saindo da polia regulável na altura py
const crossover2 = (py) => [
  { k: 'tower', x: 53, top: 108, py, trk: 'handR' },
  { k: 'frame', pts: [[-53, 108], [53, 108]], w: 2.2, z: 'back' },
  { k: 'cable', from: [POLIA_F(53), py], grip: true },
];
// apoio de pés inclinado (remada baixa): chapa encostada na sola e o suporte até a base
const apoioDePes = { k: 'fn', z: 'back', f: (o, J) => {
  const d = norm(sub(J.toeN, J.heelN));
  const n = [-J.fuN[0], -J.fuN[1]];
  const c = add(add(J.heelN, d, 3.6), n, 1.1);
  P.tubo(o, [add(c, n, 0.8), [c[0] + 5, CHAO]], 1.7);
  P.chapa(o, c, d, 7.5, 1, 'fg-steel');
} };

const held = (tool, o = {}) => {
  if (tool === 'db') return [{ k: 'db', ...o }];
  if (tool === 'hammer') return [{ k: 'db', o: 'side', along: true, ...o }];
  if (tool === 'kb') return [{ k: 'kb', ...o }];
  if (tool === 'plate') return [{ k: 'plate', ...o }];
  if (tool === 'ez') return [{ k: 'barbell', r: 6, ...o }];
  if (tool === 'handle' || tool === 'cable') return [{ k: 'handle', ...o }];
  if (tool === 'none') return [];
  return [{ k: 'barbell', ...o }];
};
const heldF = (tool, o = {}) => {
  if (tool === 'db') return [{ k: 'db', o: 'h', ...o }];
  if (tool === 'none' || tool === 'cable') return [];
  if (tool === 'smith') return [{ k: 'smith', x: (o.w ?? 36) - 13, top: 114 }, { k: 'barbell', thin: true, ...o }];
  return [{ k: 'barbell', ...o }];
};

// ---------- PEITO ----------
export function benchPress({ inc = 0, tool = 'barbell' } = {}) {
  const r = recline(inc, inc > 5 ? 104 : 112, inc < 0 ? 25 : 16);
  let bot = add(add(r.sh, r.front, 10.8), r.up, -5.5);
  let top = [r.sh[0] + 2, r.sh[1] + 28.2];
  if (tool === 'smith') { top = [bot[0], r.sh[1] + 27.6]; }
  const leg = inc < 0 ? foot(r.hip[0] + 19, r.hip[1] - 13) : foot(r.hip[0] + 17);
  const base = { hip: r.hip, torso: r.torso, leg };
  const eq = [...r.equip];
  if (tool === 'smith') eq.push({ k: 'rail', x: top[0], top: 104, deep: 31 }, { k: 'barbell' });
  else if (tool === 'db') eq.push({ k: 'db' });
  // banco de supino: coluna com o gancho da barra atrás da cabeça, presa à base do banco
  else eq.push({ k: 'rack', x: r.sh[0] - 11, top: r.sh[1] + 31, hook: r.sh[1] + 26.5, dir: 1, b0: 7, b1: 9 }, { k: 'barbell' });
  if (inc < 0) {
    // declinado: coluna dos rolos — um par por baixo dos joelhos e outro prendendo os tornozelos
    const px = r.hip[0] + 24.5;
    eq.push(sapata(r.hip[0] + 6, px + 7));
    eq.push({ k: 'fn', z: 'back', f: (o, J) => P.tubo(o, [[px, CHAO], [px, J.anN[1] + 3.5], add(J.knN, [-4.6, -6.3])], 1.8) });
    eq.push({ k: 'roller', at: 'knee', off: [-4.6, -6.3], r: 2.7, z: 'front' }, { k: 'roller', at: 'ankle', off: [2.6, 3.5], r: 2.7, z: 'front' });
  }
  return { view: 'side', frames: [{ ...base, arm: { hand: top } }, { ...base, arm: { hand: bot } }], equip: eq };
}

export function machinePress({ incline = false } = {}) {
  const s = seated({ hx: 90, recl: incline ? 22 : 8 });
  const a = incline ? add(s.sh, [9, -4]) : add(s.sh, [9, -7.5]);
  const b = incline ? add(s.sh, [21, 18]) : add(s.sh, [27.6, -5.5]);
  const base = { hip: s.hip, torso: s.torso, leg: s.leg };
  return {
    view: 'side',
    frames: [{ ...base, arm: { hand: a } }, { ...base, arm: { hand: b } }],
    // máquina de supino: torre da pilha atrás do encosto, pescoço que passa por cima da cabeça e o braço que desce até os pegadores
    equip: [
      sapata(51, s.hip[0] - 14),
      tower(57, 88, { trk: 'hand', gain: 0.7 }),
      { k: 'frame', pts: [[61.5, 86], [s.sh[0] + 6, s.sh[1] + 29], [s.sh[0] + 16, s.sh[1] + 24]], w: 2, z: 'back' },
      ...s.equip,
      { k: 'lever', pivot: [s.sh[0] + 16, s.sh[1] + 24], to: 'hand' }, { k: 'handle' },
    ],
  };
}

export function flyTop({ tool = 'db' } = {}) {
  // vista de cima: pessoa deitada no banco, braços abrem e fecham
  const base = { hip: [112, 60], tilt: -90, legR: { a: 93, b: 93, lb: 0.25 }, legL: { a: -93, b: -93, lb: 0.25 } };
  return {
    view: 'front', floor: false, label: 'Vista de cima',
    frames: [
      { ...base, armR: { a: 168, la: 0.3, b: 202, lb: 0.25 }, armL: { a: -12, la: 0.3, b: 22, lb: 0.25 } },
      { ...base, armR: { a: 176, la: 0.97, b: 187, lb: 0.95 }, armL: { a: -4, la: 0.97, b: 7, lb: 0.95 } },
    ],
    // banco visto de cima: as duas travessas dos pés aparecem por baixo do estofado
    equip: [{ k: 'frame', pts: [[-45, 46], [-45, 74]], w: 2.2, z: 'back' }, { k: 'frame', pts: [[1, 46], [1, 74]], w: 2.2, z: 'back' }, { k: 'pad', a: [-54, 60], b: [10, 60], th: 9.5, z: 'back' }, ...(tool === 'db' ? [{ k: 'db' }] : [])],
  };
}

export function peckDeck({ reverse = false } = {}) {
  const open = { ...SEAT_F, arm: { a: 88, la: 0.97, b: 93, lb: 0.93 } };
  const closed = { ...SEAT_F, arm: { a: 80, la: 0.3, b: 104, lb: 0.26 } };
  return {
    view: reverse ? 'back' : 'front',
    label: reverse ? 'Vista de costas' : 'Vista de frente',
    frames: reverse ? [closed, open] : [open, closed],
    // voador: torre da pilha atrás do encosto, travessa do alto com os dois eixos e os braços pendurados com a manopla em pé
    equip: [{ k: 'tower', x: 0, top: 108, w: 22, trk: 'handR', gain: 0.5 }, { k: 'frame', pts: [[-17, 106], [17, 106]], w: 2.2, z: 'back' }, seatBoxF, ...(reverse ? [] : [backPadF]), { k: 'lever', pivot: [11, 106], to: 'hand', drop: true, z: reverse ? 'back' : 'front' }],
  };
}

export function crossover({ from = 'high' } = {}) {
  const base = { hip: [X, H], leg: { a: 7, b: 3 } };
  if (from === 'high') {
    return { view: 'front', label: 'Vista de frente', frames: [{ ...base, arm: { hand: [36, 85] } }, { ...base, arm: { hand: [4.5, 47.5] } }], equip: crossover2(102) };
  }
  if (from === 'low') {
    return { view: 'front', label: 'Vista de frente', frames: [{ ...base, arm: { hand: [25, 49], bend: 1 } }, { ...base, arm: { hand: [4, 70], bend: 1, la: 0.62, lb: 0.6 } }], equip: crossover2(6) };
  }
  return { view: 'front', label: 'Vista de frente', frames: [{ ...base, arm: { a: 86, b: 94, la: 0.97, lb: 0.95 } }, { ...base, arm: { a: 78, la: 0.32, b: 108, lb: 0.28 } }], equip: crossover2(73) };
}

function plankAt(shY, ankle) {
  const th = Math.asin((shY - ankle[1]) / 71);
  const hip = [ankle[0] + 44 * Math.cos(th), ankle[1] + 44 * Math.sin(th)];
  return { hip, torso: 90 - th / D2R, leg: { foot: ankle, footAng: 90 } };
}
function kneePlankAt(shY, knee) {
  const th = Math.asin((shY - knee[1]) / (L.thigh + L.torso));
  const hip = [knee[0] + L.thigh * Math.cos(th), knee[1] + L.thigh * Math.sin(th)];
  return { hip, torso: 90 - th / D2R, leg: { a: -(90 - th / D2R), b: -104 } };
}
export function pushup({ mode = 'floor' } = {}) {
  const eq = [];
  let top, bot, hand;
  if (mode === 'knees') {
    const kn = [78, 4.6];
    top = kneePlankAt(32, kn); bot = kneePlankAt(13.5, kn); hand = [124.5, 2.7];
    eq.push({ k: 'mat', x0: 60, x1: 100 });
  } else if (mode === 'incline') {
    const an = [48, 8];
    top = plankAt(47, an); bot = plankAt(29.5, an); hand = [113, 18.6];
    eq.push({ k: 'bench', x0: 104, x1: 146, h: 16 });
  } else if (mode === 'decline') {
    const an = [54, 25];
    top = plankAt(32, an); bot = plankAt(13, an); hand = [124.5, 2.7];
    eq.push({ k: 'bench', x0: 30, x1: 68, h: 17 });
  } else {
    const an = [54, 8];
    top = plankAt(32, an); bot = plankAt(12.5, an); hand = [122.5, 2.7];
  }
  return { view: 'side', frames: [{ ...top, arm: { hand }, head: -18 }, { ...bot, arm: { hand }, head: -18 }], equip: eq };
}

export function dip({ lean = 12, assisted = false } = {}) {
  const hand = [X + 2, 52];
  const mk = (sh, t) => {
    const f = frame(t);
    return { hip: add(sh, f.up, -L.torso), torso: t, arm: { hand }, leg: assisted ? { a: 12, b: -88 } : { a: 8, b: -62 } };
  };
  const frames = [mk([X + 3 + lean * 0.12, 80.6], lean), mk([X + 7 + lean * 0.2, 67], lean + 10)];
  const pega = { k: 'line', a: [X - 10.5, 50.3], b: [X + 8, 50.3], c: 'fg-grip', w: 2.4, z: 'back' };
  // paralelas: sapata, coluna com mão-francesa e a barra com a manopla
  let eq = [
    sapata(X - 16, X + 28),
    { k: 'frame', pts: [[X + 22, CHAO], [X + 22, 50.3]], w: 2.2, z: 'back' },
    { k: 'frame', pts: [[X + 22, 37], [X + 11, 50.3]], w: 1.3, z: 'back' },
    { k: 'frame', pts: [[X + 22, 50.3], [X - 12, 50.3]], w: 1.8, z: 'back' },
    pega,
  ];
  if (assisted) {
    // graviton: torre com a pilha, barras de mergulho e de barra fixa saindo dela, degrau e a plataforma dos joelhos
    // (quando o corpo desce, a plataforma desce junto e a pilha sobe)
    const xt = X + 24.5;
    eq = [
      tower(X + 29, 112, { trk: 'knee', gain: 0.8 }),
      sapata(X - 14, xt),
      { k: 'frame', pts: [[xt, 50.3], [X - 12, 50.3]], w: 1.8, z: 'back' },
      pega,
      { k: 'frame', pts: [[xt, 109], [X + 5, 109]], w: 1.8, z: 'back' },
      { k: 'frame', pts: [[xt, 8.5], [X + 15, 8.5]], w: 1.6, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        const k = J.knN, y = k[1] - 5.4;
        P.tubo(o, [[k[0] - 6, y - 2], [xt, y - 2]], 1.6);
        P.bloco(o, [xt, y - 2], [0, 1], [1, 0], 3, 1.5, 'fg-steel');
        P.estofado(o, [k[0] - 15, y], [k[0] + 2.5, y], 1.7);
      } },
    ];
  }
  return { view: 'side', frames, equip: eq };
}

export function pullover() {
  const r = recline(0, 112);
  const base = { hip: r.hip, torso: r.torso, leg: foot(r.hip[0] + 17) };
  return { view: 'side', frames: [{ ...base, arm: { a: 180, b: 188 } }, { ...base, arm: { a: 242, b: 258 } }], equip: [...r.equip, { k: 'db', o: 'side' }] };
}

// ---------- OMBROS ----------
export function ohp({ tool = 'db', seat = true, arnold = false } = {}) {
  const base = seat ? { ...SEAT_F } : { hip: [X, H], leg: { a: 6, b: 3 } };
  const sy = base.hip[1] + L.torso;
  const start = arnold ? { hand: [5.5, sy + 2], la: 0.55, lb: 0.6 } : { hand: [tool === 'db' ? 16.5 : 13, sy + 2.5] };
  const end = { hand: [tool === 'db' ? 9 : 12, sy + 28.4] };
  const eq = seat ? [seatBoxF, backPadF] : [];
  // máquina: torre da pilha atrás do encosto, travessa do alto com os eixos e os braços com manopla
  if (tool === 'machine') { eq.unshift({ k: 'tower', x: 0, top: 112, w: 22, trk: 'handR', gain: 0.5 }, { k: 'frame', pts: [[-25, 110], [25, 110]], w: 2.2, z: 'back' }); eq.push({ k: 'lever', pivot: [22, 110], to: 'hand', z: 'back', grip: true }); }
  else if (tool === 'smith') eq.unshift(...heldF(tool));
  else eq.push(...heldF(tool));
  return { view: 'front', label: 'Vista de frente', frames: [{ ...base, arm: start }, { ...base, arm: end }], equip: eq };
}

export function lateralRaise({ tool = 'db', seat = false } = {}) {
  const base = seat ? { ...SEAT_F } : { hip: [X, H], leg: { a: 6, b: 3 } };
  const lab = 'Vista de frente';
  if (tool === 'cable') {
    const rest = { a: 6, b: 8 };
    return {
      view: 'front', label: lab,
      frames: [{ ...base, armR: { a: 4, b: -8 }, armL: rest }, { ...base, armR: { a: 86, b: 90 }, armL: rest }],
      equip: [{ k: 'tower', x: 46, only: 'L', top: 104, py: 6, trk: 'handR' }, { k: 'cable', from: [-POLIA_F(46), 6], only: 'R', grip: true }],
    };
  }
  if (tool === 'machine') {
    return {
      view: 'front', label: lab,
      frames: [{ ...base, arm: { a: 16, b: 20, lb: 0.35 } }, { ...base, arm: { a: 86, b: 90, lb: 0.35 } }],
      // máquina: torre atrás do encosto, braços articulados na altura do ombro e os rolos apoiados nos cotovelos
      equip: [{ k: 'tower', x: 0, top: 96, w: 22, trk: 'elR', gain: 0.5 }, seatBoxF, backPadF, { k: 'lever', pivot: [12, SEAT_F.hip[1] + L.torso + 2.4], to: 'el', dy: 3.4, w: 1.5, z: 'back' }, { k: 'roller', at: 'el', r: 3.2, dy: 3.4 }],
    };
  }
  return { view: 'front', label: lab, frames: [{ ...base, arm: { a: 7, b: 11 } }, { ...base, arm: { a: 86, b: 91 } }], equip: [{ k: 'db', o: 'end' }, ...(seat ? [seatBoxF] : [])] };
}

export function frontRaise({ tool = 'db' } = {}) {
  const base = stand();
  const eq = tool === 'cable' ? [...estacao(56, 6, { dir: 1 }), { k: 'handle' }] : held(tool, tool === 'barbell' ? { r: 5.5 } : {});
  return { view: 'side', frames: [{ ...base, arm: { a: tool === 'cable' ? -6 : 5, b: tool === 'cable' ? -2 : 9 } }, { ...base, arm: { a: 90, b: 94 } }], equip: eq };
}

function bentBase(torso = 68, hx = 90) {
  return { hip: [hx, 44.5], torso, leg: foot(hx + 6), head: -25 };
}
export function reverseFly({ mode = 'bent' } = {}) {
  if (mode === 'peck') return peckDeck({ reverse: true });
  if (mode === 'cable') {
    const base = { hip: [X, H], leg: { a: 6, b: 3 } };
    return {
      view: 'back', label: 'Vista de costas',
      frames: [{ ...base, arm: { a: 82, la: 0.3, b: 108, lb: 0.3 } }, { ...base, arm: { a: 88, la: 0.97, b: 92, lb: 0.95 } }],
      equip: [{ k: 'tower', x: 53, top: 108, py: 84, trk: 'handR' }, { k: 'frame', pts: [[-53, 108], [53, 108]], w: 2.2, z: 'back' }, { k: 'fn', f: (o, J) => { const px = POLIA_F(53); o.line([X - px, 84], J.handR, 'fg-cable', 0.8); o.line([X + px, 84], J.handL, 'fg-cable', 0.8); P.polia(o, [X - px, 84]); P.polia(o, [X + px, 84]); o.circ(J.handR, 1.3, 'fg-rub'); o.circ(J.handL, 1.3, 'fg-rub'); } }],
    };
  }
  if (mode === 'incline') {
    const b = proneIncline();
    return { view: 'side', label: 'Braços abrem para os lados', frames: [{ ...b.base, arm: { a: 2, b: 6 } }, { ...b.base, arm: { a: 2, b: 6, la: 0.16, lb: 0.14 } }], equip: [...b.equip, { k: 'db' }] };
  }
  const base = bentBase(72);
  return { view: 'side', label: 'Braços abrem para os lados', frames: [{ ...base, arm: { a: 2, b: 6 } }, { ...base, arm: { a: 2, b: 6, la: 0.16, lb: 0.14 } }], equip: [{ k: 'db' }] };
}

export function facePull() {
  const base = { hip: [86, H], torso: -4, leg: foot(88) };
  const sh = shOf(base.hip, base.torso);
  return {
    view: 'side',
    frames: [{ ...base, arm: { hand: [sh[0] + 29.4, sh[1] + 2], bend: 1 } }, { ...base, arm: { hand: [sh[0] + 6.5, sh[1] + 8], bend: 1, la: 0.36 } }],
    equip: [...estacao(148, 92, { top: 108 }), { k: 'handle' }],
  };
}

export function uprightRow({ tool = 'barbell' } = {}) {
  const base = { hip: [X, H], leg: { a: 6, b: 3 } };
  // polia baixa vista de frente: suporte no chão, polia, cabo e a barra reta com as manoplas
  const eq = tool === 'cable' ? [{ k: 'fn', f: (o, J) => { const a = J.handR, b = J.handL; o.line([X - 6, CHAO], [X + 6, CHAO], 'fg-eq', 1.7); o.line([X, (a[1] + b[1]) / 2], [X, 4], 'fg-cable', 0.8); P.polia(o, [X, 4], 2.1); P.tubo(o, [[a[0] + 4, a[1]], [b[0] - 4, b[1]]], 1.4); } }] : heldF('barbell', { w: 38, r: 6.5 });
  return { view: 'front', label: 'Vista de frente', frames: [{ ...base, arm: { a: 9, b: -6 } }, { ...base, arm: { a: 76, la: 0.96, b: -62, lb: 0.92 } }], equip: eq }; // cotovelos abertos, na altura dos ombros ou pouco abaixo; a barra para na linha do peito
}

export function externalRotation({ tool = 'cable' } = {}) {
  const base = { hip: [X, H], leg: { a: 6, b: 3 }, armL: { a: 6, b: 9 } };
  const ey = SHY - 15;
  return {
    view: 'front', label: 'Vista de frente',
    frames: [{ ...base, armR: { a: 3, b: -90, lb: 0.85 } }, { ...base, armR: { a: 3, b: -90, lb: -0.8 } }],
    equip: tool === 'cable'
      ? [{ k: 'tower', x: 46, only: 'L', top: 104, py: ey, trk: 'handR' }, { k: 'cable', from: [-POLIA_F(46), ey], only: 'R', grip: true }]
      : [{ k: 'frame', pts: [[-51, CHAO], [-37, CHAO]], w: 1.7, z: 'back' }, { k: 'frame', pts: [[-44, CHAO], [-44, 96]], w: 2.2, z: 'back' }, { k: 'fn', f: (o, J) => { o.line([X - 44, ey], J.handR, 'fg-band', 1.4); o.circ([X - 44, ey], 1.5, 'fg-steel'); } }],
  };
}

export function shrug({ tool = 'barbell' } = {}) {
  const base = { hip: [X, H], leg: { a: 6, b: 3 }, arm: { a: 5, b: 5 } };
  return { view: 'front', label: 'Vista de frente', frames: [{ ...base }, { ...base, sy: 3.4 }], equip: heldF(tool === 'db' ? 'db' : tool, tool === 'db' ? { o: 'end' } : { w: 32 }) };
}

export function landminePress() {
  const base = { hip: [92, H - 1], torso: 4, legN: foot(100), legF: foot(84), armF: { a: 4, b: 10 } };
  const sh = shOf(base.hip, base.torso);
  return {
    view: 'side',
    frames: [{ ...base, armN: { hand: [sh[0] + 7, sh[1] + 1.5] } }, { ...base, armN: { hand: [sh[0] + 19, sh[1] + 21.5] } }],
    // landmine: barra presa na articulação do chão; as anilhas ficam de perfil, logo abaixo da mão
    equip: [{ k: 'fn', f: (o, J) => {
      const pv = [166, 3.2], d = norm(sub(pv, J.handN));
      o.line([158, CHAO], [173, CHAO], 'fg-eq', 1.7);
      P.tubo(o, [add(J.handN, d, -3), pv], 1.5);
      P.anilhasDePerfil(o, add(J.handN, d, 6), d, 2, 6, 1.1);
      P.eixo(o, pv, 2.1);
    } }],
  };
}

// ---------- TRÍCEPS ----------
export function pushdown({ rope = false } = {}) {
  const base = { hip: [92, H], torso: 9, leg: foot(94) };
  return {
    view: 'side',
    frames: [{ ...base, arm: { a: 6, b: 118 } }, { ...base, arm: { a: 6, b: 9 } }],
    equip: [...estacao(134, 104, { top: 110 }), { k: 'handle' }],
  };
}

export function skullCrusher({ tool = 'ez' } = {}) {
  const r = recline(0, 112);
  const base = { hip: r.hip, torso: r.torso, leg: foot(r.hip[0] + 17) };
  return { view: 'side', frames: [{ ...base, arm: { a: 188, b: 186 } }, { ...base, arm: { a: 192, b: 286 } }], equip: [...r.equip, ...held(tool)] };
}

export function overheadExt({ tool = 'db' } = {}) {
  if (tool === 'cable') {
    const base = { hip: [104, H - 1], torso: 14, legN: foot(112), legF: foot(98) };
    return {
      view: 'side',
      frames: [{ ...base, arm: { a: 160, b: 292 } }, { ...base, arm: { a: 160, b: 164 } }],
      equip: [...estacao(55, 8, { dir: 1 }), { k: 'handle' }],
    };
  }
  const s = seated({ hx: 96, recl: 0, back: 22 });
  const base = { hip: s.hip, torso: 0, leg: s.leg };
  return { view: 'side', frames: [{ ...base, arm: { a: 172, b: 300 } }, { ...base, arm: { a: 174, b: 177 } }], equip: [...s.equip, { k: 'db', o: 'side', along: true }] };
}

export function kickback({ tool = 'db' } = {}) {
  if (tool === 'db') {
    const hip = [94, 43.6];
    const torso = 82;
    const sh = shOf(hip, torso);
    const base = { hip, torso, head: -20, legN: foot(86), legF: { a: 10, b: -92 }, armF: { hand: [sh[0] + 2, 19.4] } };
    return {
      view: 'side',
      frames: [{ ...base, armN: { a: -82, b: 2 } }, { ...base, armN: { a: -82, b: -80 } }],
      equip: [{ k: 'bench', x0: 68, x1: 136, h: 16.5 }, { k: 'db', single: true }],
    };
  }
  const base = bentBase(72, 96);
  const eq = tool === 'cable' ? [...estacao(152, 8), { k: 'handle' }] : [{ k: 'db' }];
  return { view: 'side', frames: [{ ...base, arm: { a: -72, b: 2 } }, { ...base, arm: { a: -72, b: -70 } }], equip: eq };
}

export function benchDip() {
  const hand = [84, 18.7];
  const leg = { foot: [125, 5.2], footAng: -50 };
  return {
    view: 'side',
    frames: [{ hip: [88, 20.8], torso: -3, arm: { hand }, leg }, { hip: [89, 9], torso: -6, arm: { hand }, leg }],
    equip: [{ k: 'bench', x0: 50, x1: 86, h: 16.5 }],
  };
}

export function tricepsMachine() {
  const s = seated({ hx: 94, recl: 0 });
  const base = { hip: s.hip, torso: 4, leg: s.leg };
  const sh = shOf(s.hip, 4);
  return {
    view: 'side',
    frames: [{ ...base, arm: { hand: [sh[0] + 9, sh[1] - 9] } }, { ...base, arm: { hand: [sh[0] + 7.5, sh[1] - 28.4] } }],
    // máquina de tríceps (mergulho sentado): torre atrás, braços articulados atrás do encosto que descem até os pegadores
    equip: [sapata(51, s.hip[0] - 14), tower(57, 86, { trk: 'hand', gain: 0.7 }), ...s.equip, { k: 'lever', pivot: [s.hip[0] - 12, s.hip[1] + 13], to: 'hand', z: 'back' }, { k: 'handle' }],
  };
}

// ---------- COSTAS ----------
export function pullup({ w = 16, assisted = false, hang = false } = {}) {
  const BY = 108;
  const hand = [w, BY - 2];
  const cyHang = BY - 2 - Math.sqrt(29.4 ** 2 - (w - L.shw) ** 2);
  const leg = assisted ? { a: 6, b: 4, lb: 0.12 } : { a: 4, b: 3, lb: 0.5 };
  const mk = (cy, sy = 0) => ({ hip: [X, cy - L.torso], arm: { hand }, leg, sy });
  // barra fixa: duas colunas com sapata e mão-francesa e a barra por cima
  const eq = [
    { k: 'frame', pts: [[-43, CHAO], [-29, CHAO]], w: 1.7, z: 'back' }, { k: 'frame', pts: [[29, CHAO], [43, CHAO]], w: 1.7, z: 'back' },
    { k: 'frame', pts: [[-36, CHAO], [-36, BY]], w: 2.2, z: 'back' }, { k: 'frame', pts: [[36, CHAO], [36, BY]], w: 2.2, z: 'back' },
    { k: 'frame', pts: [[-36, BY - 9], [-28, BY]], w: 1.2, z: 'back' }, { k: 'frame', pts: [[36, BY - 9], [28, BY]], w: 1.2, z: 'back' },
    { k: 'fixbar', y: BY, w: 38 },
  ];
  // graviton: torre larga com a pilha atrás da pessoa, pegadores no alto, degraus e a plataforma dos joelhos
  if (assisted) {
    eq.length = 0;
    eq.push({ k: 'tower', x: 0, top: BY + 4, w: 26, trk: 'knR', gain: 0.8 }, { k: 'fixbar', y: BY, w: 25 },
      { k: 'frame', pts: [[-21, 9], [-13, 9]], w: 1.6, z: 'back' }, { k: 'frame', pts: [[13, 9], [21, 9]], w: 1.6, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => { const y = J.knR[1] - 4.8; P.estofado(o, [X - 12, y], [X + 12, y], 1.8); } });
  }
  const frames = hang ? [mk(cyHang), mk(cyHang - 0.6, -1.2)] : [mk(cyHang), mk(BY - 9.5)];
  return { view: 'back', label: 'Vista de costas', frames, equip: eq, slow: hang };
}

export function latPulldown({ grip = 'wide', uni = false, machine = false } = {}) {
  const sy = SEAT_F.hip[1] + L.torso;
  const G = { wide: [[19, sy + 28], [16.5, sy + 4.5]], sup: [[9, sy + 29], [8, sy + 3.5]], close: [[3.2, sy + 28.4], [3.4, sy + 2]] }[grip];
  // puxador: torre com a pilha à frente da pessoa, polia no alto, rolo de apoio das coxas e o assento
  const coxas = { k: 'pad', a: [-12.5, 34.4], b: [12.5, 34.4], th: 2.3, z: 'back' };
  const eq = machine
    // articulada: coluna central, travessa com os eixos, braços com manopla e as anilhas (de perfil) nos pinos
    ? [{ k: 'frame', pts: [[0, CHAO], [0, 114]], w: 2.6, z: 'back' }, { k: 'frame', pts: [[-27, 114], [27, 114]], w: 2.2, z: 'back' }, seatBoxF, coxas,
      { k: 'fn', z: 'back', f: (o) => { for (const s of [1, -1]) { o.line([X + s * 26, 106], [X + s * 34, 106], 'fg-eq', 1.2); P.anilhasDePerfil(o, [X + s * 28.6, 106], [s, 0], 2, 7.5, 1.1); } } },
      { k: 'lever', pivot: [26, 114], to: 'hand', z: 'back', grip: true }]
    : [{ k: 'tower', x: 0, top: 122, w: 15, trk: 'handR', gain: 0.5 }, seatBoxF, coxas];
  if (machine) { /* braços já desenhados */ }
  else if (uni) eq.push({ k: 'fn', f: (o, J) => { const h = J.handR; o.line(h, [X + 5, 119.4], 'fg-cable', 0.8); o.circ(h, 1.4, 'fg-rub'); } });
  else eq.push({ k: 'fn', f: (o, J) => {
    // barra de puxada: reta no meio e com as pontas dobradas para baixo na pegada aberta
    const a = J.handR, b = J.handL;
    o.line([X, a[1]], [X, 119.4], 'fg-cable', 0.8);
    if (grip === 'wide') P.tubo(o, [[a[0] + 6, a[1] - 1.8], [a[0] - 2, a[1]], [b[0] + 2, b[1]], [b[0] - 6, b[1] - 1.8]], 1.5);
    else P.tubo(o, [[a[0] + (grip === 'close' ? 0.5 : 4), a[1]], [b[0] - (grip === 'close' ? 0.5 : 4), b[1]]], 1.5);
  } });
  if (uni) {
    const rest = { a: 16, b: -10, la: 0.8 };
    return { view: 'back', label: 'Vista de costas', frames: [{ ...SEAT_F, armR: { hand: [13, sy + 28.6] }, armL: rest }, { ...SEAT_F, armR: { hand: [15, sy + 2] }, armL: rest }], equip: eq };
  }
  return { view: 'back', label: 'Vista de costas', frames: [{ ...SEAT_F, arm: { hand: G[0] } }, { ...SEAT_F, arm: { hand: G[1] } }], equip: eq };
}

export function straightArmPulldown() {
  const base = { hip: [88, H - 1], torso: 16, leg: foot(91) };
  return {
    view: 'side',
    frames: [{ ...base, arm: { a: 126, b: 133 } }, { ...base, arm: { a: 12, b: 20 } }],
    equip: [...estacao(142, 106, { top: 112 }), { k: 'handle' }],
  };
}

export function pulloverMachine() {
  const s = seated({ hx: 92, recl: 4 });
  const base = { hip: s.hip, torso: s.torso, leg: s.leg };
  return {
    view: 'side',
    frames: [{ ...base, arm: { a: 166, b: 232 } }, { ...base, arm: { a: 26, b: 92 } }],
    // pullover: torre atrás, braço articulado no eixo do ombro com o rolo no cotovelo e a barra nas mãos
    equip: [sapata(51, s.hip[0] - 14), tower(57, 88, { trk: 'elbow', gain: 0.45 }), ...s.equip, { k: 'lever', pivot: add(s.sh, [-1, 0]), to: 'elbow', w: 1.4 }, { k: 'roller', at: 'elbow', r: 3, z: 'front' }, { k: 'handle' }],
  };
}

export function bentRow({ tool = 'barbell', tbar = false } = {}) {
  const base = bentBase(62, 90);
  const sh = shOf(base.hip, base.torso);
  const a = [sh[0] - 0.5, sh[1] - 28.6];
  const b = fromSh(base.hip, base.torso, 9.5, -19);
  const eq = tbar
    // cavalinho: barra presa na articulação do chão, anilhas de perfil na ponta e o pegador logo atrás delas
    ? [{ k: 'fn', z: 'back', f: (o, J) => {
      const pv = [56, 3.2], d = norm(sub(J.handN, pv));
      o.line([49, CHAO], [64, CHAO], 'fg-eq', 1.7);
      P.tubo(o, [pv, add(J.handN, d, 12)], 1.5);
      P.anilhasDePerfil(o, add(J.handN, d, 3.4), d, 3, 7.5, 1.1);
      P.eixo(o, pv, 2.1);
    } }, { k: 'handle' }]
    : held(tool, tool === 'barbell' ? { r: 7.5 } : {});
  return { view: 'side', frames: [{ ...base, arm: { hand: a } }, { ...base, arm: { hand: b } }], equip: eq };
}

export function oneArmRow() {
  const hip = [94, 43.6];
  const torso = 82;
  const sh = shOf(hip, torso);
  const base = { hip, torso, head: -20, legN: foot(86), legF: { a: 10, b: -92 }, armF: { hand: [sh[0] + 2, 19.4] } };
  return {
    view: 'side',
    frames: [{ ...base, armN: { hand: [sh[0] - 1, sh[1] - 28.5] } }, { ...base, armN: { hand: [sh[0] - 13, sh[1] - 9.5] } }],
    equip: [{ k: 'bench', x0: 68, x1: 136, h: 16.5 }, { k: 'db', single: true }],
  };
}

export function seatedCableRow({ uni = false } = {}) {
  const leg = { foot: [127, 13], footAng: -72 };
  const A = { hip: [88, 22.6], torso: 9, leg };
  const B = { hip: [88, 22.6], torso: -4, leg };
  const sa = shOf(A.hip, A.torso);
  return {
    view: 'side',
    frames: [{ ...A, arm: { hand: [sa[0] + 27.5, 43] } }, { ...B, arm: { hand: [99, 38] } }],
    // remada baixa: banco comprido, apoio de pés inclinado, viga até a torre e a polia na altura das mãos
    equip: [{ k: 'bench', x0: 70, x1: 102, h: 14 }, sapata(97, 153), apoioDePes, ...estacao(158, 41, { top: 92 }), { k: 'handle' }],
  };
}

export function machineRow() {
  const s = seated({ hx: 86, recl: 0, noBack: true });
  const base = { hip: s.hip, torso: 3, leg: s.leg };
  const sh = shOf(s.hip, 3);
  return {
    view: 'side',
    frames: [{ ...base, arm: { hand: [sh[0] + 28, sh[1] - 4] } }, { ...base, arm: { hand: [sh[0] + 7.5, sh[1] - 10] } }],
    // remada máquina: assento, apoio de peito na sua coluna, torre da pilha à frente e o braço pendurado no pescoço da torre
    equip: [
      ...s.equip,
      { k: 'frame', pts: [[s.hip[0] + 13.2, s.hip[1] + 21], [s.hip[0] + 13.2, CHAO]], w: 1.8 },
      { k: 'pad', a: [s.hip[0] + 10.6, s.hip[1] + 9], b: [s.hip[0] + 11.6, s.hip[1] + 25] },
      sapata(s.hip[0] + 15, 150),
      tower(154, 90, { trk: 'hand', gain: 0.7 }),
      { k: 'frame', pts: [[149.5, 88], [sh[0] + 40, sh[1] + 27], [sh[0] + 30, sh[1] + 22]], w: 2, z: 'back' },
      { k: 'lever', pivot: [sh[0] + 30, sh[1] + 22], to: 'hand' }, { k: 'handle' },
    ],
  };
}

function proneIncline() {
  const hip = [84, 35];
  const torso = 50;
  const f = frame(torso);
  const pa = add(add(hip, f.front, 8.9), f.up, -3);
  const pb = add(add(hip, f.front, 8.9), f.up, 26);
  const S = (u) => add([pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u], f.front, 2.5);
  return {
    base: { hip, torso, leg: { foot: ankleFromToe([61, 1.7], 38), footAng: 38 }, head: -12 }, // pés atrás, apoiados na ponta
    sh: add(hip, f.up, L.torso),
    // banco inclinado usado de bruços: longarina sob o estofado, coluna, escora e base
    equip: [
      { k: 'frame', pts: [S(0.03), S(0.92)], w: 1.5 },
      { k: 'frame', pts: [S(0.72), [S(0.72)[0] + 9, CHAO]] },
      { k: 'frame', pts: [S(0.14), [S(0.14)[0] + 1, CHAO]], w: 2 },
      sapata(pa[0] - 7, pb[0] + 17),
      { k: 'pad', a: pa, b: pb },
    ],
  };
}
export function chestSupportedRow() {
  const b = proneIncline();
  return { view: 'side', frames: [{ ...b.base, arm: { hand: [b.sh[0] + 0.5, b.sh[1] - 28.6] } }, { ...b.base, arm: { hand: [b.sh[0] - 9, b.sh[1] - 9] } }], equip: [...b.equip, { k: 'db' }] };
}

export function invertedRow({ trx = false } = {}) {
  if (trx) {
    const pe = [128, 4.6];
    const mao = [94.6, 74.2];
    const pose = (graus, la) => {
      const th = graus * D2R;
      return { hip: [pe[0] - 44 * Math.cos(th), pe[1] + 44 * Math.sin(th)], torso: -(90 - graus), leg: { foot: pe, footAng: -38 }, arm: { hand: mao, la } };
    };
    return { view: 'side', frames: [pose(43, 1), pose(59, 0.5)], equip: [{ k: 'cable', from: [136, 120] }, { k: 'handle' }] };
  }
  const heel = [142, 5.2];
  const mk = (shY, la) => {
    const th = Math.asin((shY - heel[1]) / 71);
    return { hip: [heel[0] - 44 * Math.cos(th), heel[1] + 44 * Math.sin(th)], torso: -(90 - th / D2R), leg: { foot: heel, footAng: -55 }, arm: { hand: trx ? [77, 53] : [76, 52], la } };
  };
  const eq = trx
    ? [{ k: 'cable', from: [77, 120] }, { k: 'handle' }]
    // barra travada baixa no Smith
    : [{ k: 'rail', x: 76, top: 104, at: [76, 52] }, { k: 'fixbar', at: [76, 52], r: 1.8 }];
  return { view: 'side', frames: [mk(trx ? 24.5 : 23.3, 1), mk(trx ? 43 : 42, 0.5)], equip: eq };
}

export function hyperextension() {
  const an = [70, 9];
  const hip = [an[0] + 44 * Math.SQRT1_2, an[1] + 44 * Math.SQRT1_2];
  const base = { hip, leg: { foot: an, footAng: 45 }, arm: { rel: [7.5, -9], la: 0.7, lb: 0.6 } };
  const d = [-Math.SQRT1_2, -Math.SQRT1_2];
  const nf = [Math.SQRT1_2, -Math.SQRT1_2];
  const A = add(add(hip, d, 1), nf, 8.4);
  const B = add(add(hip, d, 15), nf, 8.4);
  return {
    view: 'side',
    frames: [{ ...base, torso: 118, head: -10 }, { ...base, torso: 45 }],
    // banco romano 45°: base, viga inclinada do apoio dos pés até o estofado das coxas, coluna, chapa dos pés e rolo do calcanhar
    equip: [
      sapata(an[0] - 12, B[0] + 18),
      { k: 'frame', pts: [[an[0] - 1, an[1] - 6], add(B, nf, 2.5), add(A, nf, 2.5)], w: 2, z: 'back' },
      { k: 'frame', pts: [add([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], nf, 2.5), [(A[0] + B[0]) / 2 + 7, CHAO]], w: 2, z: 'back' },
      { k: 'frame', pts: [[an[0] - 1, an[1] - 6], [an[0] - 3, CHAO]], w: 1.8, z: 'back' },
      { k: 'pad', a: A, b: B, th: 2 },
      { k: 'fn', z: 'back', f: (o, J) => { const c = add(add(J.heelN, J.fdN, 3.4), J.fuN, -1); P.chapa(o, c, J.fdN, 6.5, 0.9, 'fg-steel'); o.line(add(c, J.fdN, -6), [an[0] - 5, an[1] + 2.5], 'fg-eq', 1.3); } },
      { k: 'roller', at: [an[0] - 5, an[1] + 2.5], r: 2.8, z: 'back' },
    ],
  };
}

export function backExtMachine() {
  const s = seated({ hx: 94, recl: 0, noBack: true });
  const base = { hip: s.hip, leg: s.leg, arm: { rel: [7.5, -9], la: 0.7, lb: 0.6 } };
  return {
    view: 'side',
    frames: [{ ...base, torso: 32 }, { ...base, torso: -16 }],
    // extensão lombar: torre atrás, braço articulado na altura do quadril com o rolo nas costas e o apoio dos pés
    equip: [sapata(49, s.hip[0] - 14), tower(55, 86, { trk: 'trap', gain: 0.6 }), ...s.equip, { k: 'frame', pts: [[s.hip[0] + 15, CHAO], [s.hip[0] + 30, CHAO], [s.hip[0] + 33, 4]], w: 1.7 }, { k: 'lever', pivot: [s.hip[0] - 2, s.hip[1] - 2], to: 'trap', z: 'back' }, { k: 'roller', at: 'trap', r: 3.6, z: 'back' }],
  };
}

export function superman() {
  return {
    view: 'side',
    frames: [
      { hip: [96, 8.6], torso: 91, head: -8, arm: { a: 93, b: 93 }, leg: { a: -91, b: -90 } },
      { hip: [96, 8.6], torso: 91, head: -8, arm: { a: 105, b: 107 }, leg: { a: -99, b: -101 } },
    ],
    equip: [{ k: 'mat', x0: 44, x1: 152 }],
  };
}

// ---------- BÍCEPS / ANTEBRAÇO ----------
export function curl({ tool = 'barbell', mode = 'stand' } = {}) {
  const dn = { a: 3, b: 7 };
  const up = { a: 11, b: 150 };
  if (mode === 'alt') {
    const base = stand();
    return {
      view: 'side', loop: true,
      frames: [{ ...base, armN: dn, armF: dn }, { ...base, armN: up, armF: dn }, { ...base, armN: dn, armF: dn }, { ...base, armN: dn, armF: up }],
      equip: held(tool),
    };
  }
  if (mode === 'cable') {
    const base = stand({}, 92);
    return { view: 'side', frames: [{ ...base, arm: { a: 6, b: 16 } }, { ...base, arm: up }], equip: [...estacao(136, 6), { k: 'handle' }] };
  }
  if (mode === 'bayesian') {
    const base = { hip: [108, H], torso: 5, legN: foot(114), legF: foot(102) };
    return {
      view: 'side',
      frames: [{ ...base, armN: { a: -30, b: -22 }, armF: { a: 4, b: 10 } }, { ...base, armN: { a: -8, b: 138 }, armF: { a: 4, b: 10 } }],
      equip: [...estacao(56, 6, { dir: 1 }), { k: 'handle', single: true }],
    };
  }
  if (mode === 'preacher') {
    const hip = [82, 29];
    const torso = 20;
    const sh = shOf(hip, torso);
    const ua = 56;
    const d = [Math.sin(ua * D2R), -Math.cos(ua * D2R)];
    const n = [-d[1], d[0]];
    const pa = add(add(sh, d, -2), n, -5.6);
    const pb = add(add(sh, d, 19), n, -5.6);
    const base = { hip, torso, leg: foot(hip[0] + 21) };
    // banco Scott: base única, coluna do assento e coluna do apoio inclinado dos braços
    const pm = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
    const eq = [
      sapata(hip[0] - 9, tool === 'machine' ? pm[0] + 31 : pm[0] + 13),
      { k: 'frame', pts: [[pm[0] - 0.5, pm[1] - 2], [pm[0] + 4, CHAO]], w: 2, z: 'back' },
      { k: 'pad', a: pa, b: pb, th: 2, z: 'back' },
      { k: 'frame', pts: [[hip[0] + 1, hip[1] - 10.5], [hip[0] + 1, CHAO]], w: 2 },
      { k: 'pad', a: [hip[0] - 7, hip[1] - 8.7], b: [hip[0] + 9, hip[1] - 8.7] },
    ];
    // máquina de rosca: torre da pilha à frente e o braço articulado no eixo do cotovelo
    if (tool === 'machine') eq.push(tower(pm[0] + 36, 80, { trk: 'hand', gain: 0.6 }), { k: 'lever', pivot: add(sh, d, 15.5), to: 'hand', w: 1.5 }, { k: 'handle' });
    else eq.push(...held(tool));
    return { view: 'side', frames: [{ ...base, arm: { a: ua, b: ua + 8 } }, { ...base, arm: { a: ua, b: 178 } }], equip: eq };
  }
  if (mode === 'incline') {
    const r = recline(55, 98);
    const base = { hip: r.hip, torso: r.torso, leg: foot(r.hip[0] + 21) };
    return { view: 'side', frames: [{ ...base, arm: { a: -4, b: 3 } }, { ...base, arm: { a: 2, b: 148 } }], equip: [...r.equip, ...held(tool)] };
  }
  if (mode === 'spider') {
    const b = proneIncline();
    return { view: 'side', frames: [{ ...b.base, arm: { a: 2, b: 8 } }, { ...b.base, arm: { a: 6, b: 152 } }], equip: [...b.equip, ...held(tool)] };
  }
  if (mode === 'conc') {
    const hip = [86, 24];
    const base = { hip, torso: 44, head: -20, leg: foot(108), armF: { hand: [107, 30] } };
    return {
      view: 'side',
      frames: [{ ...base, armN: { a: 14, b: 26 } }, { ...base, armN: { a: 14, b: 168 } }],
      equip: [{ k: 'bench', x0: 64, x1: 96, h: 16 }, { k: 'db', single: true }],
    };
  }
  if (mode === 'high') {
    const base = { hip: [X, H], leg: { a: 6, b: 3 } };
    return {
      view: 'front', label: 'Vista de frente',
      frames: [{ ...base, arm: { a: 94, b: 97 } }, { ...base, arm: { a: 94, b: 214 } }],
      equip: crossover2(82),
    };
  }
  const base = stand();
  return { view: 'side', frames: [{ ...base, arm: dn }, { ...base, arm: up }], equip: held(tool) };
}

export function wristCurl({ single = false } = {}) {
  const hip = [86, 26.5];
  const torso = 40;
  const base = { hip, torso, head: -22, leg: foot(hip[0] + 22) };
  return {
    view: 'side',
    frames: [{ ...base, arm: { a: 25, b: 90, hf: 38 } }, { ...base, arm: { a: 25, b: 90, hf: -42 } }],
    equip: [{ k: 'bench', x0: 66, x1: 98, h: 17.6 }, single ? { k: 'db', single: true } : { k: 'barbell', r: 4.6 }],
  };
}

export function holdStand({ tool = 'plate' } = {}) {
  const base = { hip: [X, H], leg: { a: 6, b: 3 }, arm: { a: 6, b: 6 } };
  return {
    view: 'front', label: 'Vista de frente', slow: true,
    frames: [{ ...base }, { ...base, sy: -0.8 }],
    // duas anilhas lisas juntas em cada mão, vistas de canto e presas só pela ponta dos dedos:
    // ficam atrás da mão, com a borda de cima entre os dedos estendidos
    maos: 'solta',
    equip: [{ k: 'fn', z: 'back', f: (o, J) => { for (const h of [J.handR, J.handL]) for (const s of [-0.8, 0.8]) P.bloco(o, [h[0] + s, h[1] - 9.4], [0, 1], [1, 0], 7.4, 0.7, 'fg-rub'); } }],
  };
}

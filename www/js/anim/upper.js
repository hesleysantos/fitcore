// Animações de membros superiores (peito, ombros, tríceps, costas, bíceps, antebraço).
// Convenção: frames[0] = posição inicial descrita no exercício; frames[1] = fim do movimento.
import { L } from './rig.js';
import { AK, H, X, SHY, D2R, CHAO, add, foot, frame, fromSh, shOf, stand, recline, seated, SEAT_F, seatBoxF, backPadF, tower, estacao, POLIA_F, ankleFromToe } from './base.js';
import { P } from './equip.js';

const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const sapata = (x0, x1, z) => ({ k: 'frame', pts: [[x0, CHAO], [x1, CHAO]], w: 1.7, ...(z ? { z } : {}) });
// crossover visto de frente: duas colunas com pilha, travessa do alto e o cabo saindo da polia regulável na altura py
// (as colunas ficam a ~1,25 m do centro: com os braços abertos ainda sobra cabo entre a mão e a polia)
const XCROSS = 62;
const crossover2 = (py) => [
  { k: 'tower', x: XCROSS, top: 108, py, trk: 'handR' },
  { k: 'frame', pts: [[-XCROSS, 108], [XCROSS, 108]], w: 2.2, z: 'back' },
  { k: 'cable', from: [POLIA_F(XCROSS), py], grip: true },
];
// apoio de pés inclinado (remada baixa): chapa encostada na sola e o suporte até a base
const apoioDePes = { k: 'fn', z: 'back', f: (o, J) => {
  const d = norm(sub(J.toeN, J.heelN));
  // lado da sola: o oposto ao tornozelo
  let n = [-d[1], d[0]];
  if ((J.anN[0] - J.heelN[0]) * n[0] + (J.anN[1] - J.heelN[1]) * n[1] > 0) n = [-n[0], -n[1]];
  const c = add(add(J.heelN, d, 3.2), n, 4.3);
  P.tubo(o, [add(c, n, 0.8), [c[0] + 5, CHAO]], 1.7);
  P.chapa(o, c, d, 7.5, 1, 'fg-steel');
} };

const held = (tool, o = {}) => {
  if (tool === 'db') return [{ k: 'db', ...o }];
  if (tool === 'hammer') return [{ k: 'db', o: 'side', ...o }]; // pegada neutra: o halter aparece de lado, atravessado na mão
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

// came (disco) no eixo de um braço de máquina e o cabo que sai dele até a polia do alto da torre:
// é por aí que o braço puxa a pilha de pesos
// porBaixo: o cabo desce do came até uma polia junto do chão e segue rente ao chão até a torre (não cruza o corpo)
const cameECabo = (pv, torreX, torreTop, r = 3.4, porBaixo = false) => ({ k: 'fn', z: 'back', f: (o) => {
  if (porBaixo) {
    const pb = [pv[0] - r, 4.2];
    o.line([pv[0] - r, pv[1]], pb, 'fg-cable', 0.8);
    o.line(pb, [torreX + 2, 4.2], 'fg-cable', 0.8);
    P.polia(o, pb, 1.7);
  } else o.line([torreX + 1.2, torreTop - 2.4], [pv[0] - 1, pv[1] + r], 'fg-cable', 0.8);
  o.circ(pv, r, 'fg-steel');
} });
// braço de máquina do eixo até a mão, com uma dobra (para não passar por cima do rosto) e o mancal no eixo
const bracoDeMaquina = (pv, { dobra = 0, em = 0.55, w = 2.2, z } = {}) => ({ k: 'fn', ...(z ? { z } : {}), f: (o, J) => {
  const h = J.handN;
  const d = norm(sub(h, pv)), n = [-d[1], d[0]];
  const len = Math.hypot(h[0] - pv[0], h[1] - pv[1]);
  P.tubo(o, dobra ? [pv, add(add(pv, d, len * em), n, dobra), h] : [pv, h], w);
  P.eixo(o, pv, 2.3);
} });

// Supino na máquina (chest press), visto de lado: torre da pilha atrás do encosto, viga por cima da cabeça até o eixo
// e o braço da máquina PENDURADO nesse eixo, descendo até os pegadores na altura do peito. Empurrar os pegadores faz o
// braço balançar para a frente; o came no eixo puxa o cabo que sobe a pilha.
export function machinePress({ incline = false } = {}) {
  const s = seated({ hx: 90, recl: incline ? 22 : 8 });
  const base = { hip: s.hip, torso: s.torso, leg: s.leg };
  // reto: eixo acima e à frente da cabeça (o pegador vai quase em linha reta para a frente);
  // inclinado: eixo atrás e acima da cabeça (o pegador sobe para a frente e para cima)
  const pv = incline ? add(s.sh, [-14.9, 23.3]) : add(s.sh, [12, 30]);
  const a = incline ? add(s.sh, [9, -4]) : add(s.sh, [9, -7.5]);
  const b = incline ? add(s.sh, [21, 18]) : add(s.sh, [25, -5.3]);
  const xt = 54, top = Math.max(88, pv[1] + 6);
  return {
    view: 'side', pega: 'pronada',
    frames: [{ ...base, arm: { hand: a } }, { ...base, arm: { hand: b } }],
    equip: [
      sapata(xt - 6, s.hip[0] - 14),
      tower(xt, top, { trk: 'hand', gain: 0.7 }),
      { k: 'frame', pts: [[xt + 4.5, pv[1] - 1], pv], w: 2.6, z: 'back' },
      cameECabo(pv, xt, top),
      ...s.equip,
      bracoDeMaquina(pv, incline ? { dobra: 10, em: 0.5 } : { dobra: -3.5, em: 0.6 }),
      { k: 'handle' },
    ],
  };
}

export function flyTop({ tool = 'db' } = {}) {
  // vista de cima: pessoa deitada no banco, braços abrem e fecham
  const base = { hip: [112, 60], tilt: -90, legR: { a: 93, b: 93, lb: 0.25 }, legL: { a: -93, b: -93, lb: 0.25 } };
  return {
    view: 'front', floor: false, label: 'Vista de cima',
    // palmas para cima (viradas para quem olha), polegares para o lado da cabeça
    maos: { m: 'eixo', u: [1, 0], face: 'palma', pol: -1 },
    frames: [
      // braços em pé, com os halteres por cima dos ombros: de cima, quase não se vê o braço
      { ...base, armR: { a: 168, la: 0.12, b: 202, lb: 0.1 }, armL: { a: -12, la: 0.12, b: 22, lb: 0.1 } },
      { ...base, armR: { a: 176, la: 0.97, b: 187, lb: 0.95 }, armL: { a: -4, la: 0.97, b: 7, lb: 0.95 } },
    ],
    // banco visto de cima: as duas travessas dos pés aparecem por baixo do estofado
    equip: [{ k: 'frame', pts: [[-45, 46], [-45, 74]], w: 2.2, z: 'back' }, { k: 'frame', pts: [[1, 46], [1, 74]], w: 2.2, z: 'back' }, { k: 'pad', a: [-54, 60], b: [10, 60], th: 9.5, z: 'back' }, ...(tool === 'db' ? [{ k: 'db' }] : [])],
  };
}

// manopla em pé (voador, rotação externa) vista de frente: com a mão apontando para fora vê-se a palma (dedos em volta
// da manopla); com a mão apontando para o meio do corpo vêem-se as costas da mão
const maoEmPe = (J, k) => ({ m: 'eixo', u: [0, 1], face: J['hd' + k][0] * (k === 'R' ? 1 : -1) >= 0 ? 'palma' : 'dorso' });
// vista de costas com os braços à frente do corpo: a mão só aparece depois que passa da linha do ombro
const maoAFrente = (J, k) => (Math.abs(J['hand' + k][0] - J.hc[0]) < 15 ? 'oculta' : 'punho');
// braços estendidos à frente vistos de costas: só se vê um toco do braço, ao lado do ombro
const BRACO_A_FRENTE = { a: 62, la: 0.2, b: 62, lb: 0.03 };

export function peckDeck({ reverse = false } = {}) {
  const cames = { k: 'fn', z: 'back', f: (o) => { for (const s of [1, -1]) o.circ([X + s * 11, 106], 4.6, 'fg-steel'); } };
  if (reverse) {
    // crucifixo inverso: sentado de frente para o encosto (peito apoiado), mãos nos pegadores deitados, palmas para baixo.
    // De costas, os braços começam escondidos à frente do corpo e abrem para os lados até a linha dos ombros.
    return {
      view: 'back', label: 'Vista de costas: braços começam à frente',
      frames: [{ ...SEAT_F, arm: BRACO_A_FRENTE }, { ...SEAT_F, arm: { a: 88, la: 0.97, b: 92, lb: 0.93 } }],
      maos: maoAFrente,
      equip: [
        { k: 'tower', x: 0, top: 108, w: 22, trk: 'handR', gain: 0.5 }, { k: 'frame', pts: [[-17, 106], [17, 106]], w: 2.2, z: 'back' }, cames, seatBoxF, backPadF,
        { k: 'fn', z: 'back', f: (o, J) => { for (const [h, s] of [[J.handR, 1], [J.handL, -1]]) { P.tubo(o, [[X + s * 11, 106], [h[0], 106], [h[0], h[1] + 1.2]], 1.6); P.eixo(o, [X + s * 11, 106], 1.8); } } },
        { k: 'fn', f: (o, J) => { for (const h of [J.handR, J.handL]) if (Math.abs(h[0] - X) >= 15) { o.circ(h, 1.5, 'fg-rub'); o.circ(h, 0.55, 'fg-steel'); } } },
      ],
    };
  }
  const open = { ...SEAT_F, arm: { a: 88, la: 0.97, b: 93, lb: 0.93 } };
  // fechado: os braços vêm para a frente (na direção de quem olha) e as mãos quase se encontram à frente do peito
  const closed = { ...SEAT_F, arm: { a: 96, la: -0.1, b: 100, lb: -0.2 } };
  return {
    view: 'front', label: 'Vista de frente',
    frames: [open, closed],
    maos: maoEmPe,
    // voador: torre da pilha atrás do encosto, travessa do alto com os dois cames e os braços pendurados com a manopla em pé
    equip: [{ k: 'tower', x: 0, top: 108, w: 22, trk: 'handR', gain: 0.5 }, { k: 'frame', pts: [[-17, 106], [17, 106]], w: 2.2, z: 'back' }, cames, seatBoxF, backPadF, { k: 'lever', pivot: [11, 106], to: 'hand', drop: true, z: 'front' }],
  };
}

// Crossover: os cotovelos ficam levemente dobrados, sempre no mesmo ângulo, e os braços descrevem um arco.
// Visto de frente, o braço "encurta" quando vem na direção de quem olha.
export function crossover({ from = 'high' } = {}) {
  const base = { hip: [X, H], leg: { a: 7, b: 3 } };
  const anim = { view: 'front', label: 'Vista de frente', maos: 'punho' };
  if (from === 'high') {
    // de cima para baixo: mãos abertas na altura dos ombros; descem em arco e se encontram à frente do abdômen
    return { ...anim, frames: [{ ...base, arm: { a: 92, b: 98, la: 0.97, lb: 0.95 } }, { ...base, arm: { a: -8, b: -22, la: 0.7, lb: 0.65 } }], equip: crossover2(102) };
  }
  if (from === 'low') {
    // de baixo para cima: mãos ao lado do quadril; sobem em arco, para a frente, e se encontram à frente do peito
    return { ...anim, frames: [{ ...base, arm: { a: 22, b: 26 } }, { ...base, arm: { a: -30, la: 0.4, b: 45, lb: -0.42 } }], equip: crossover2(6) };
  }
  // polia na altura do peito: os braços fecham na horizontal, como num abraço
  return { ...anim, frames: [{ ...base, arm: { a: 86, b: 94, la: 0.97, lb: 0.95 } }, { ...base, arm: { a: 94, la: -0.12, b: 98, lb: -0.34 } }], equip: crossover2(73) };
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
  let top, bot, hand, pisos;
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
    pisos = [{ x0: 30, x1: 68, y: 17 }]; // os dedos dos pés dobram em cima do banco
  } else {
    const an = [54, 8];
    top = plankAt(32, an); bot = plankAt(12.5, an); hand = [122.5, 2.7];
  }
  return { view: 'side', frames: [{ ...top, arm: { hand }, head: -18 }, { ...bot, arm: { hand }, head: -18 }], equip: eq, ...(pisos ? { pisos } : {}) };
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
    // Graviton (Life Fitness Insignia Assist Dip Chin, Body-Solid S2ACD, Muscle D): mastro alto que termina, lá em cima,
    // nos pegadores de barra fixa virados para a pessoa; barras de mergulho saindo dele na altura da cintura; almofada dos
    // joelhos num carrinho que corre em duas hastes-guia; degrau para subir; e a torre da pilha atrás do mastro. O cabo sai
    // do carrinho, sobe até a polia do mastro e desce na pilha: quando o corpo desce, a pilha sobe (ela alivia o peso).
    const xm = X + 27, xh = X + 21.5, xt = X + 40, top = 84;
    eq = [
      tower(xt, top, { trk: 'knee', gain: 0.8 }),
      sapata(X - 14, xt - 6),
      { k: 'frame', pts: [[xm, CHAO], [xm, 104], [xm - 4, 110], [X + 6, 111]], w: 2.2, z: 'back' },
      { k: 'line', a: [X + 6, 111], b: [X + 13, 111], c: 'fg-grip', w: 2.4, z: 'back' },
      { k: 'frame', pts: [[xm, 50.3], [X - 12, 50.3]], w: 1.8, z: 'back' },
      pega,
      // degrau
      { k: 'frame', pts: [[X + 12.5, CHAO], [X + 12.5, 8.2]], w: 1.5, z: 'back' },
      { k: 'frame', pts: [[X + 7.5, 9], [X + 17.5, 9]], w: 1.6, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        const k = J.knN, y = k[1] - 5.4;
        // hastes-guia, carrinho e o cabo até a polia do mastro e a pilha
        o.line([xh - 1.5, 4], [xh - 1.5, 47], 'fg-rod', 0.9);
        o.line([xh + 1.5, 4], [xh + 1.5, 47], 'fg-rod', 0.9);
        o.line([xm, 92], [xh, 92], 'fg-eq', 1.2);
        o.open([[xh, y + 1], [xh, 92], [xt, top - 2.3]], 'fg-cable', 0.8);
        P.polia(o, [xh, 92], 1.6);
        P.tubo(o, [[k[0] - 6, y - 2], [xh, y - 2]], 1.6);
        P.bloco(o, [xh, y - 2], [0, 1], [1, 0], 3, 2.6, 'fg-steel');
        P.estofado(o, [k[0] - 15, y], [k[0] + 2.5, y], 1.7);
      } },
    ];
  }
  return { view: 'side', frames, equip: eq };
}

// halter segurado com as duas mãos por uma das cabeças: ele fica pendurado, em pé, abaixo das mãos
// (cabeças largas, de halter pesado: aparecem dos dois lados das mãos, que seguram a de cima)
const halterPendurado = { k: 'fn', z: 'back', f: (o, J) => {
  const h = J.handN;
  o.line([h[0], h[1]], [h[0], h[1] - 8], 'fg-eq', 1.2);
  P.bloco(o, [h[0] + 0.9, h[1] + 0.4], [0, 1], [1, 0], 1.7, 3.6, 'fg-rub');
  P.bloco(o, [h[0] + 0.9, h[1] - 8.4], [0, 1], [1, 0], 1.7, 3.6, 'fg-rub');
} };

export function pullover() {
  const r = recline(0, 112);
  const base = { hip: r.hip, torso: r.torso, leg: foot(r.hip[0] + 17) };
  return { view: 'side', frames: [{ ...base, arm: { a: 180, b: 188 } }, { ...base, arm: { a: 242, b: 258 } }], equip: [...r.equip, halterPendurado] };
}

// ---------- OMBROS ----------
export function ohp({ tool = 'db', seat = true, arnold = false } = {}) {
  if (tool === 'machine') return shoulderPressMachine();
  const base = seat ? { ...SEAT_F } : { hip: [X, H], leg: { a: 6, b: 3 } };
  const sy = base.hip[1] + L.torso;
  const start = arnold ? { hand: [5.5, sy + 2], la: 0.55, lb: 0.6 } : { hand: [tool === 'db' ? 16.5 : 13, sy + 2.5] };
  const end = { hand: [tool === 'db' ? 9 : 12, sy + 28.4] };
  const eq = seat ? [seatBoxF, backPadF] : [];
  // máquina: torre da pilha atrás do encosto, travessa do alto com os eixos e os braços com manopla
  if (tool === 'machine') { eq.unshift({ k: 'tower', x: 0, top: 112, w: 22, trk: 'handR', gain: 0.5 }, { k: 'frame', pts: [[-25, 110], [25, 110]], w: 2.2, z: 'back' }); eq.push({ k: 'lever', pivot: [22, 110], to: 'hand', z: 'back', grip: true }); }
  else if (tool === 'smith') eq.unshift(...heldF(tool));
  else eq.push(...heldF(tool));
  const anim = { view: 'front', label: 'Vista de frente', frames: [{ ...base, arm: start }, { ...base, arm: end }], equip: eq };
  // Arnold: embaixo, as palmas ficam viradas para o rosto (vêem-se as costas das mãos); giram para a frente na subida
  // (no meio do giro a mão fica de perfil: q encolhe a mão até a fileira dos nós dos dedos, e a troca não dá salto)
  // (o giro acontece na primeira metade da subida, quando as mãos passam uns 25 cm acima dos ombros)
  if (arnold) anim.maos = (J, k) => { const h = J['hand' + k][1] - J.chest[1]; return { m: 'eixo', u: [1, 0], face: h < 12 ? 'dorso' : 'palma', q: Math.min(1, Math.abs(h - 12) / 6) }; };
  return anim;
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
    // Elevação lateral na máquina (Life Fitness Insignia, Hammer Strength Select, Matrix Ultra): a pessoa senta DE FRENTE
    // para a torre da pilha, com o peito no apoio; os eixos dos braços da máquina ficam na altura dos ombros e as
    // almofadas encostam por fora dos braços, perto dos cotovelos. Por isso a figura é vista de costas: a torre e o apoio
    // de peito ficam além do corpo, e os antebraços (dobrados para a frente, nos pegadores) ficam escondidos pelos cotovelos.
    const sy = SEAT_F.hip[1] + L.torso;
    return {
      view: 'back', label: 'Vista de costas',
      frames: [{ ...base, arm: { a: 16, b: 20, lb: 0.05 } }, { ...base, arm: { a: 86, b: 90, lb: 0.05 } }],
      maos: 'oculta',
      equip: [
        // (apoio de peito: fica além do tronco, na altura do esterno)
        { k: 'tower', x: 0, top: 96, w: 22, trk: 'elR', gain: 0.5 }, seatBoxF, { k: 'pad', a: [0, 31], b: [0, 46], th: 7, z: 'back' },
        // cames nos eixos (aparecem por cima dos ombros) e os braços da máquina até as almofadas
        { k: 'fn', z: 'back', f: (o) => { for (const s of [1, -1]) o.circ([X + s * 11.5, sy + 3.2], 4.6, 'fg-steel'); } },
        { k: 'lever', pivot: [11.5, sy + 3.2], to: 'el', dy: 3.4, w: 1.7, z: 'back' },
        { k: 'roller', at: 'el', r: 3.2, dy: 3.4 },
      ],
    };
  }
  return { view: 'front', label: lab, frames: [{ ...base, arm: { a: 7, b: 11 } }, { ...base, arm: { a: 86, b: 91 } }], equip: [{ k: 'db', o: 'end' }, ...(seat ? [seatBoxF] : [])] };
}

export function frontRaise({ tool = 'db' } = {}) {
  const base = stand();
  const eq = tool === 'cable' ? [...estacao(56, 6, { dir: 1, entre: true }), { k: 'handle' }] : held(tool, tool === 'barbell' ? { r: 5.5 } : {});
  return { view: 'side', frames: [{ ...base, arm: { a: tool === 'cable' ? -6 : 5, b: tool === 'cable' ? -2 : 9 } }, { ...base, arm: { a: 90, b: 94 } }], equip: eq };
}

function bentBase(torso = 68, hx = 90) {
  return { hip: [hx, 44.5], torso, leg: foot(hx + 6), head: -25 };
}
export function reverseFly({ mode = 'bent' } = {}) {
  if (mode === 'peck') return peckDeck({ reverse: true });
  if (mode === 'cable') {
    // cabos cruzados (mão direita no cabo da esquerda): passam pela frente do corpo, por isso de costas ficam atrás dele.
    // Os braços começam à frente do peito (escondidos) e abrem para os lados até a linha dos ombros.
    const base = { hip: [X, H], leg: { a: 6, b: 3 } };
    const py = 78;
    return {
      view: 'back', label: 'Vista de costas: cabos cruzados à frente',
      frames: [{ ...base, arm: BRACO_A_FRENTE }, { ...base, arm: { a: 88, la: 0.97, b: 92, lb: 0.95 } }],
      maos: maoAFrente,
      equip: [{ k: 'tower', x: XCROSS, top: 108, py, trk: 'handR' }, { k: 'frame', pts: [[-XCROSS, 108], [XCROSS, 108]], w: 2.2, z: 'back' }, { k: 'fn', z: 'back', f: (o, J) => { const px = POLIA_F(XCROSS); o.line([X - px, py], J.handR, 'fg-cable', 0.8); o.line([X + px, py], J.handL, 'fg-cable', 0.8); P.polia(o, [X - px, py]); P.polia(o, [X + px, py]); } }],
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
    view: 'front', label: 'Vista de frente: cotovelo colado ao corpo',
    // pegador em pé na mão (pegada neutra); o outro braço fica solto
    maos: { R: maoEmPe, L: 'solta' },
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
export function pushdown({ rope = false, pega } = {}) {
  const base = { hip: [92, H], torso: 9, leg: foot(94) };
  return {
    view: 'side', pega: pega || (rope ? 'neutra' : 'pronada'),
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
      equip: [...estacao(55, 8, { dir: 1, z: 'back' }), { k: 'handle' }], // o cabo sobe por trás das costas e da cabeça
    };
  }
  const s = seated({ hx: 96, recl: 0, back: 22 });
  const base = { hip: s.hip, torso: 0, leg: s.leg };
  return { view: 'side', frames: [{ ...base, arm: { a: 172, b: 300 } }, { ...base, arm: { a: 174, b: 177 } }], equip: [...s.equip, halterPendurado] };
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

// Tríceps na máquina (extensão de cotovelos): costas no encosto, braços apoiados numa almofada inclinada à frente do peito,
// cotovelos na linha do eixo da máquina. As mãos saem de perto dos ombros e descem em arco até os braços quase esticarem.
// O came do eixo puxa o cabo que vai até a torre da pilha, à frente.
export function tricepsMachine() {
  const s = seated({ hx: 84, recl: 0 });
  const base = { hip: s.hip, torso: 0, leg: s.leg };
  const sh = s.sh;
  const ua = 60;
  const d = [Math.sin(ua * D2R), -Math.cos(ua * D2R)], n = [-d[1], d[0]];
  const E = add(sh, d, 15.5); // cotovelo = eixo
  const pa = add(add(sh, d, 1), n, -5.6), pb = add(add(sh, d, 16.5), n, -5.6);
  const pm = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  const xt = E[0] + 37, py = E[1] - 3.4;
  return {
    view: 'side', pega: 'neutra',
    frames: [{ ...base, arm: { a: ua, b: ua + 112 } }, { ...base, arm: { a: ua, b: ua + 10 } }],
    equip: [
      ...s.equip,
      sapata(s.hip[0] + 15, xt - 7),
      { k: 'frame', pts: [[pm[0] + 1, pm[1] - 2], [pm[0] + 5, CHAO]], w: 2, z: 'back' },
      { k: 'pad', a: pa, b: pb, th: 2, z: 'back' },
      tower(xt, 84, { trk: 'hand', gain: 0.6, py }),
      { k: 'fn', z: 'back', f: (o) => { o.line([E[0] + 1, py], [xt - 7.1, py], 'fg-cable', 0.8); o.circ(E, 3.4, 'fg-steel'); } },
      { k: 'lever', pivot: E, to: 'hand', w: 1.6 }, { k: 'handle' },
    ],
  };
}

// Desenvolvimento na máquina, visto de lado: torre da pilha atrás do encosto e o braço da máquina preso num eixo atrás da
// cabeça; ele vem por cima do ombro até os pegadores, que saem da altura dos ombros e sobem em arco.
function shoulderPressMachine() {
  const s = seated({ hx: 94, recl: 4 });
  const base = { hip: s.hip, torso: s.torso, leg: s.leg };
  const pv = add(s.sh, [-28, 16]);
  const xt = pv[0] - 8, top = pv[1] + 13;
  return {
    view: 'side', pega: 'pronada',
    frames: [{ ...base, arm: { hand: add(s.sh, [5, 2.5]), la: 0.8, lb: 0.92 } }, { ...base, arm: { hand: add(s.sh, [4.5, 26.8]), la: 0.97, lb: 0.97 } }],
    equip: [
      sapata(xt - 6, s.hip[0] - 14),
      tower(xt, top, { trk: 'hand', gain: 0.6 }),
      { k: 'frame', pts: [[xt + 4.5, pv[1]], pv], w: 2.6, z: 'back' },
      cameECabo(pv, xt, top),
      ...s.equip,
      bracoDeMaquina(pv, { dobra: -6, em: 0.7 }),
      { k: 'handle' },
    ],
  };
}

// ---------- COSTAS ----------

// pega: 'pronada' (palmas para a frente), 'supinada' (palmas para o rosto) ou 'neutra' (palmas uma para a outra, em pegadores curtos)
export function pullup({ w = 16, assisted = false, hang = false, pega = 'pronada' } = {}) {
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
    // a barra fica à frente do corpo: de costas, a cabeça passa na frente dela no alto do movimento
    { k: 'fixbar', y: BY, w: 38, z: 'back' },
  ];
  // Graviton visto de costas (mesma máquina do mergulho assistido): a pessoa fica de frente para o mastro de duas colunas,
  // que leva os pegadores no alto; a torre da pilha fica ao lado; os joelhos apoiam na almofada, que corre nas hastes-guia;
  // um degrau de cada lado. O cabo vai do mastro até o alto da torre.
  if (assisted) {
    eq.length = 0;
    const xt = 34, top = 84;
    eq.push({ k: 'tower', x: xt, only: 'L', top, w: 10, trk: 'knR', gain: 0.8 },
      { k: 'frame', pts: [[-xt - 7, CHAO], [14, CHAO]], w: 1.7, z: 'back' },
      { k: 'frame', pts: [[-9, CHAO], [-9, BY]], w: 2.2, z: 'back' }, { k: 'frame', pts: [[9, CHAO], [9, BY]], w: 2.2, z: 'back' },
      { k: 'fixbar', y: BY, w: 25, z: 'back' },
      { k: 'frame', pts: [[-22, 9], [-13, 9]], w: 1.6, z: 'back' }, { k: 'frame', pts: [[13, 9], [22, 9]], w: 1.6, z: 'back' },
      { k: 'frame', pts: [[-17.5, CHAO], [-17.5, 8.2]], w: 1.4, z: 'back' }, { k: 'frame', pts: [[17.5, CHAO], [17.5, 8.2]], w: 1.4, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        const y = J.knR[1] - 4.8;
        o.line([X - 3.5, 4], [X - 3.5, 60], 'fg-rod', 0.9);
        o.line([X + 3.5, 4], [X + 3.5, 60], 'fg-rod', 0.9);
        o.line([X - 9.8, 70], [X - xt, top - 2.3], 'fg-cable', 0.8);
        P.polia(o, [X - 9.8, 70], 1.6);
        P.bloco(o, [X, y - 2.6], [1, 0], [0, 1], 5.5, 1.3, 'fg-steel');
        P.estofado(o, [X - 12, y], [X + 12, y], 1.8);
      } });
  }
  const frames = hang ? [mk(cyHang), mk(cyHang - 0.6, -1.2)] : [mk(cyHang), mk(BY - 9.5)];
  const anim = { view: 'back', label: 'Vista de costas', frames, equip: eq, slow: hang, pega };
  if (pega === 'neutra') {
    // pegadores curtos que saem da barra na direção de quem olha: aparecem pela ponta, dentro do punho fechado
    eq.push({ k: 'fn', f: (o, J) => { for (const h of [J.handR, J.handL]) { o.circ(h, 1.5, 'fg-rub'); o.circ(h, 0.55, 'fg-steel'); } } });
    anim.maos = 'punho';
  }
  return anim;
}

// rolo que prende as coxas, num poste entre as pernas (fica atrás da coxa de cá)
const roloDasCoxas = (hx, hy) => ({ k: 'fn', z: 'back', f: (o) => { P.tubo(o, [[hx + 17, CHAO], [hx + 17, hy + 7]], 1.8); P.rolo(o, [hx + 15.5, hy + 7], 3); } });

// Puxada no puxador (pulley alto), vista de lado: a pessoa fica de frente para a torre, a lança do alto traz a polia para
// cima da cabeça e o cabo desce até a barra. A barra desce PELA FRENTE do rosto e para no alto do peito.
export function latPulldown({ grip = 'wide', uni = false } = {}) {
  const hx = 92, hy = 26.5;
  const s = seated({ hx, hy, noBack: true });
  const t0 = -4, t1 = uni ? -8 : -14; // tronco um pouco inclinado para trás
  const sh0 = shOf(s.hip, t0), sh1 = shOf(s.hip, t1);
  const f1 = frame(t1);
  const aberta = grip === 'wide' && !uni;
  const larg = aberta ? 0.9 : 1; // pegada aberta: os braços abrem para os lados e, de lado, aparecem mais curtos
  const alto = [sh0[0] + 6.5, sh0[1] + (aberta ? 24.3 : 27.6)];
  const peito = add(add(sh1, f1.front, 7.6), f1.up, grip === 'close' || uni ? -5.4 : -4.2);
  const arm = (hand) => ({ hand, la: larg, lb: larg });
  const xt = hx + 46, top = 120, px = sh0[0] + 7.5;
  const eq = [
    ...s.equip,
    roloDasCoxas(hx, hy),
    sapata(hx + 15, xt - 7),
    tower(xt, top, { trk: 'hand', gain: 0.5 }),
    { k: 'frame', pts: [[px - 3, top + 1], [xt + 5, top + 1]], w: 2.2, z: 'back' },
    { k: 'line', a: [px, top], b: [px, top - 2], w: 1.2, z: 'back' },
    { k: 'line', a: [xt, top - 2.3], b: [px, top - 1], c: 'fg-cable', w: 0.8, z: 'back' },
    { k: 'cable', from: [px, top - 2.9] },
    uni ? { k: 'handle', single: true } : grip === 'close' ? { k: 'handle' } : { k: 'fixbar', r: 1.15 },
  ];
  const base = { hip: s.hip, leg: s.leg };
  const anim = {
    view: 'side',
    pega: grip === 'sup' ? 'supinada' : grip === 'wide' && !uni ? 'pronada' : 'neutra',
    frames: [{ ...base, torso: t0, arm: arm(alto) }, { ...base, torso: t1, arm: arm(peito) }],
    equip: eq,
  };
  if (aberta) anim.label = 'A barra desce pela frente';
  if (uni) {
    // a outra mão descansa na coxa
    const rest = { hand: [hx + 13, hy + 5.6] };
    anim.frames = [{ ...base, torso: t0, armN: arm(alto), armF: rest }, { ...base, torso: t1, armN: arm(peito), armF: rest }];
    anim.maos = { F: 'solta' };
  }
  return anim;
}

// Puxada articulada de anilhas, vista de lado: a pessoa senta de costas para o quadro. Cada braço da máquina é uma
// alavanca com o eixo no alto, atrás da cabeça: na ponta da frente fica o pegador; a ponta de trás desce até o pino das
// anilhas. Puxar o pegador para baixo faz as anilhas subirem.
export function platePulldown() {
  const hx = 106, hy = 26.5;
  const s = seated({ hx, hy, noBack: true });
  const t0 = -3, t1 = -8;
  const sh0 = shOf(s.hip, t0);
  const pv = [sh0[0] - 30, sh0[1] + 22];
  const H0 = [pv[0] + 38, pv[1] + 5.5], H1 = [pv[0] + 34.4, pv[1] - 17]; // pegador no alto e embaixo (mesmo raio em volta do eixo)
  const base = { hip: s.hip, leg: s.leg };
  return {
    view: 'side', pega: 'supinada',
    frames: [{ ...base, torso: t0, arm: { hand: [H0[0] - 0.6, H0[1] - 2.3] } }, { ...base, torso: t1, arm: { hand: [H1[0] - 0.4, H1[1] - 2.4] } }],
    equip: [
      ...s.equip,
      roloDasCoxas(hx, hy),
      sapata(pv[0] - 17, hx - 14),
      // quadro em "A" com o eixo no alto
      { k: 'frame', pts: [[pv[0] + 9, CHAO], pv], w: 2.2, z: 'back' },
      { k: 'frame', pts: [[pv[0] - 15, CHAO], pv], w: 2.2, z: 'back' },
      { k: 'frame', pts: [[pv[0] - 9, 34], [pv[0] + 5.5, 34]], w: 1.4, z: 'back' },
      { k: 'fn', f: (o, J) => {
        const h = J.handN;
        const ang = Math.atan2(h[1] - pv[1], h[0] - pv[0]);
        const d = [Math.cos(ang), Math.sin(ang)], n = [-d[1], d[0]];
        const tras = [pv[0] + 19 * Math.cos(ang - 2.44), pv[1] + 19 * Math.sin(ang - 2.44)];
        P.tubo(o, [tras, pv, add(add(pv, d, 21), n, 8), h], 2);
        P.anilha(o, tras, 8.5);
        P.eixo(o, pv, 2.4);
      } },
      { k: 'handle' },
    ],
  };
}

export function straightArmPulldown() {
  const base = { hip: [88, H - 1], torso: 16, leg: foot(91) };
  return {
    view: 'side',
    frames: [{ ...base, arm: { a: 126, b: 133 } }, { ...base, arm: { a: 12, b: 20 } }],
    equip: [...estacao(142, 106, { top: 112 }), { k: 'handle' }],
  };
}

// Pullover na máquina: o braço da máquina gira num eixo na altura do ombro, com um came grande (a roda em volta do ombro);
// os cotovelos empurram os apoios e as mãos só seguram a barra. O cabo sai do came, sobe até a polia do alto da torre e
// desce até a pilha de pesos. À frente dos pés fica o pedal que traz a barra até a pessoa.
export function pulloverMachine() {
  const s = seated({ hx: 92, recl: 4 });
  const base = { hip: s.hip, torso: s.torso, leg: s.leg };
  const pv = add(s.sh, [-0.5, 0]);
  const xt = 54, top = 94;
  return {
    view: 'side', pega: 'pronada',
    frames: [{ ...base, arm: { a: 166, b: 232 } }, { ...base, arm: { a: 26, b: 92 } }],
    equip: [
      sapata(xt - 6, s.hip[0] - 14),
      tower(xt, top, { trk: 'elbow', gain: 0.45 }),
      { k: 'fn', z: 'back', f: (o) => {
        o.line([xt + 1.2, top - 2.4], [pv[0] - 2.5, pv[1] + 8.8], 'fg-cable', 0.8);
      } },
      ...s.equip,
      { k: 'frame', pts: [[s.hip[0] + 27, CHAO], [s.hip[0] + 31.5, 9]], w: 1.6 },
      { k: 'circ', at: [s.hip[0] + 31.5, 9], r: 1.5, c: 'fg-rub' },
      { k: 'fn', f: (o, J) => {
        // came: a roda grande em volta do eixo do ombro (só o aro, para o corpo continuar à vista)
        const aro = [];
        for (let i = 0; i <= 24; i++) aro.push([pv[0] + 9 * Math.cos(i * Math.PI / 12), pv[1] + 9 * Math.sin(i * Math.PI / 12)]);
        o.open(aro, 'fg-eq', 1.3);
        P.tubo(o, [pv, J.elN, J.handN], 1.4); P.eixo(o, pv, 2.2);
      } },
      { k: 'roller', at: 'elbow', r: 3, z: 'front' }, { k: 'handle' },
    ],
  };
}

export function bentRow({ tool = 'barbell', tbar = false, pega } = {}) {
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
  return { view: 'side', pega: pega || (tool === 'barbell' && !tbar ? 'pronada' : 'neutra'), frames: [{ ...base, arm: { hand: a } }, { ...base, arm: { hand: b } }], equip: eq };
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

// Remada na máquina: assento, apoio de peito e, à frente, os braços da máquina EM PÉ, presos num eixo baixo perto dos pés;
// os pegadores já ficam na altura do peito. Puxar os pegadores inclina os braços para trás; o cabo preso no meio deles
// entra na torre e sobe a pilha.
export function machineRow() {
  const s = seated({ hx: 86, recl: 0, noBack: true });
  const base = { hip: s.hip, torso: 3, leg: s.leg };
  const sh = shOf(s.hip, 3);
  const pv = [s.hip[0] + 32, 8];
  const R = sh[1] - 4 - pv[1];
  const ang = 30 * D2R;
  const H0 = [pv[0], pv[1] + R], H1 = [pv[0] - R * Math.sin(ang), pv[1] + R * Math.cos(ang)];
  const xt = 158, py = 30;
  return {
    view: 'side', pega: 'neutra',
    frames: [{ ...base, arm: { hand: [H0[0] - 2.4, H0[1]] } }, { ...base, arm: { hand: [H1[0] - 2.3, H1[1] - 0.7] } }],
    equip: [
      ...s.equip,
      { k: 'frame', pts: [[s.hip[0] + 13.2, s.hip[1] + 21], [s.hip[0] + 13.2, CHAO]], w: 1.8 },
      { k: 'pad', a: [s.hip[0] + 10.6, s.hip[1] + 9], b: [s.hip[0] + 11.6, s.hip[1] + 25] },
      sapata(s.hip[0] + 15, xt - 7),
      tower(xt, 90, { trk: 'hand', gain: 0.7, py }),
      { k: 'fn', f: (o, J) => {
        const h = J.handN;
        const c = [pv[0] + (h[0] - pv[0]) * 0.53, pv[1] + (h[1] - pv[1]) * 0.53];
        o.line(c, [xt - 7.1, py], 'fg-cable', 0.8);
        P.tubo(o, [[pv[0], CHAO], pv], 2);
        P.tubo(o, [pv, h], 2.2);
        P.eixo(o, pv, 2.4);
      } },
      { k: 'handle' },
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
  // Remada invertida: a barra do Smith fica TRAVADA nos ganchos, na altura da cintura; o corpo fica reto por baixo dela,
  // com os calcanhares no chão, e sobe até o peito chegar na barra.
  const heel = [142, 5.2];
  const barra = [76, 52];
  const mk = (shY, la) => {
    const th = Math.asin((shY - heel[1]) / 71);
    const hip = [heel[0] - 44 * Math.cos(th), heel[1] + 44 * Math.sin(th)];
    const sh = [heel[0] - 71 * Math.cos(th), shY];
    const d = norm(sub(barra, sh));
    // a barra fica no meio da mão fechada, não no punho
    return { hip, torso: -(90 - th / D2R), leg: { foot: heel, footAng: -55 }, arm: { hand: add(barra, d, -2.4), la } };
  };
  return {
    view: 'side', pega: 'pronada',
    label: 'Barra do Smith travada na altura da cintura',
    frames: [mk(23.3, 1), mk(41.2, 0.5)],
    equip: [
      // Smith fundo, como uma gaiola: a pessoa fica entre as colunas da frente e de trás
      { k: 'rail', x: barra[0], top: 104, at: barra, deep: 36 },
      // trava: o gancho da barra preso no pino da coluna, e a ponta da barra (vista pela ponta)
      { k: 'fn', z: 'back', f: (o) => { P.tubo(o, [[barra[0] + 0.5, barra[1] + 1.2], [barra[0] - 4.4, barra[1] + 1.2], [barra[0] - 4.4, barra[1] - 1.6]], 1.2); } },
      { k: 'fn', f: (o) => { o.circ(barra, 2.1, 'fg-steel'); o.circ(barra, 0.8, 'fg-eqs'); } },
    ],
  };
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
    equip: [sapata(49, s.hip[0] - 14), tower(55, 86, { trk: 'trap', gain: 0.6 }), cameECabo([s.hip[0] - 2, s.hip[1] - 2], 55, 86, 3, true), ...s.equip, { k: 'frame', pts: [[s.hip[0] + 15, CHAO], [s.hip[0] + 30, CHAO], [s.hip[0] + 33, 4]], w: 1.7 }, { k: 'lever', pivot: [s.hip[0] - 2, s.hip[1] - 2], to: 'trap', z: 'back' }, { k: 'roller', at: 'trap', r: 3.6, z: 'back' }],
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
// pega: 'supinada' (palmas para cima — o padrão das roscas), 'pronada' (rosca inversa) ou 'neutra' (martelo, corda)
export function curl({ tool = 'barbell', mode = 'stand', pega, label } = {}) {
  const anim = curlBase({ tool, mode });
  anim.pega = pega || (tool === 'hammer' ? 'neutra' : 'supinada');
  if (label) anim.label = label;
  return anim;
}
function curlBase({ tool, mode }) {
  const dn = { a: 3, b: 7 };
  const up = { a: 11, b: 150 };
  if (mode === 'frente') {
    // de frente, para a pegada aparecer: palmas para a frente embaixo; na subida o antebraço vem na direção de quem olha
    // (encurta) e termina em pé, com os halteres na frente dos ombros e as palmas viradas para eles
    const base = { hip: [X, H], leg: { a: 6, b: 3 } };
    return {
      view: 'front', label: 'Vista de frente: palmas para a frente',
      frames: [{ ...base, arm: { a: 9, b: 4 } }, { ...base, arm: { a: 7, b: 9, lb: -0.9 } }],
      equip: [{ k: 'db', o: 'h' }],
    };
  }
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
    if (tool === 'machine') {
      // o came do eixo puxa o cabo que entra na torre, à frente
      const E = add(sh, d, 15.5), xt = pm[0] + 36, py = E[1] - 3.4;
      eq.push(tower(xt, 80, { trk: 'hand', gain: 0.6, py }), { k: 'fn', z: 'back', f: (o) => { o.line([E[0] + 1, py], [xt - 7.1, py], 'fg-cable', 0.8); o.circ(E, 3.4, 'fg-steel'); } }, { k: 'lever', pivot: E, to: 'hand', w: 1.6 }, { k: 'handle' });
    }
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
      equip: [{ k: 'bench', x0: 64, x1: 96, h: 17.5 }, { k: 'db', single: true }],
    };
  }
  if (mode === 'high') {
    const base = { hip: [X, H], leg: { a: 6, b: 3 } };
    return {
      view: 'front', label: 'Vista de frente',
      frames: [{ ...base, arm: { a: 94, b: 97 } }, { ...base, arm: { a: 94, b: 214 } }],
      // palmas para cima: o pegador atravessa a mão de frente para trás e aparece pela ponta, dentro do punho fechado
      maos: { R: { m: 'punho', pal: 1 }, L: { m: 'punho', pal: -1 } },
      equip: crossover2(82),
    };
  }
  const base = stand();
  return { view: 'side', frames: [{ ...base, arm: dn }, { ...base, arm: up }], equip: held(tool) };
}

// Rosca de punho: antebraço parado na coxa, só o punho se move.
//   normal  — palma para cima: a mão fica por baixo da barra e FLEXIONA o punho para cima;
//   inversa — palma para baixo: a mão fica por cima da barra e ESTENDE o punho, levando as costas da mão para cima.
// A anilha (ou o halter) fica atrás da mão, como num corte, para a pegada aparecer.
export function wristCurl({ single = false, inversa = false } = {}) {
  const hip = [86, 26.5];
  const torso = 40;
  const base = { hip, torso, head: -22, leg: foot(hip[0] + 22) };
  const baixo = inversa ? -52 : -38, alto = inversa ? 34 : 52;
  return {
    view: 'side',
    label: inversa ? 'Palma para baixo: o punho estende' : 'Palma para cima: o punho flexiona',
    pega: inversa ? 'pronada' : 'supinada',
    frames: [{ ...base, arm: { a: 25, b: 90, hf: baixo } }, { ...base, arm: { a: 25, b: 90, hf: alto } }],
    equip: [{ k: 'bench', x0: 66, x1: 98, h: 20 }, single ? { k: 'db', single: true, under: true } : { k: 'barbell', r: 4.6, z: 'back' }, { k: 'fixbar', r: 0.95 }],
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

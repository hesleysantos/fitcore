// Animações de membros inferiores (quadríceps, posteriores, glúteos, adutores/abdutores, panturrilhas).
import { L, solveSide } from './rig.js';
import { AK, H, X, SHY, D2R, CHAO, add, foot, frame, fromSh, shOf, ankleFromToe, stand, seated, SEAT_F, seatBoxF, backPadF, tower, estacao, POLIA_F } from './base.js';
import { P } from './equip.js';
import { came, torre, bracoDoRolo } from './pecas.js';

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
    let x0 = null;
    return {
      view: 'side', frames: [mk(108), mk(118)],
      // leg press horizontal: cadeira, trilho baixo com o carro da plataforma e a torre da pilha na frente; o cabo sai do
      // carro, dá a volta na polia do começo do trilho e segue rente ao chão até a pilha
      equip: [
        ...s.equip,
        sapata(s.hip[0] + 15, 148),
        { k: 'frame', pts: [[99, CHAO], [99, 12], [147.5, 12]], w: 2, z: 'back' },
        { k: 'fn', z: 'back', f: (o, J) => {
          const x = J.heelN[0] + 1.1;
          if (x0 == null || x < x0) x0 = x;
          o.line([x + 4, 9.2], [103, 9.2], 'fg-cable', 0.8);
          P.polia(o, [103, 6.6], 2.6);
          torre(o, { x: 152, top: 80, w: 9, dir: -1, sobe: (x - x0) * 0.9, de: [[103, 4]] });
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
  const arm = { hand: [hip[0] - 0.5, hip[1] - 3.2] }; // mãos nos pegadores, um de cada lado do assento
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
// Mecanismo da cadeira extensora e das flexoras. O eixo da máquina fica ao lado do joelho, preso à estrutura por um
// suporte; nele giram o came (disco onde o cabo enrola) e o braço em L que leva o rolo até a canela. Do came, o cabo
// corre por dentro do suporte (tubo de aço) e só aparece longe das pernas, no ponto "saida": dali vai até a torre,
// sobe por fora e levanta a pilha. Assim o cabo nunca cruza a perna, que varre toda a região em volta do joelho.
//   lado: +1 = rolo na frente da canela (extensão); -1 = rolo atrás, no tendão (flexão)
//   b0: ângulo inicial da canela (o mesmo "b" do primeiro quadro); suporte: pontos do tubo fixo que chega ao eixo
function mecanismoDoJoelho({ lado, b0, torreEm, suporte, saida, ganho = 6 }) {
  const d0 = [Math.sin(b0 * D2R), -Math.cos(b0 * D2R)];
  const RC = 8;
  const canela = (J) => norm(sub(J.anN, J.knN));
  return [
    { k: 'fn', z: 'back', f: (o, J) => {
      const d = canela(J);
      const giro = Math.acos(Math.max(-1, Math.min(1, d[0] * d0[0] + d[1] * d0[1])));
      torre(o, { ...torreEm, sobe: giro * ganho, polia0: true, ...saida });
      P.tubo(o, [...suporte, J.knN], 2.2);
      came(o, J.knN, RC, Math.atan2(d[1], d[0]));
    } },
    { k: 'fn', f: (o, J) => {
      bracoDoRolo(o, J.knN, canela(J), L.shin - 2, lado);
      P.eixo(o, J.knN, 1.6);
    } },
  ];
}

export function legExtension({ uni = false } = {}) {
  const s = legMachineSeat(86, 33.5, 14);
  const base = { hip: s.hip, torso: s.torso, arm: { a: -10, b: 18 } };
  const A = { ...base, leg: { a: 88, b: -6 } };
  const B = { ...base, leg: { a: 88, b: 80 } };
  if (uni) { A.legF = { a: 88, b: -6 }; B.legF = { a: 88, b: -6 }; A.legN = A.leg; B.legN = B.leg; }
  const hx = s.hip[0], hy = s.hip[1];
  const [fundo, frente] = mecanismoDoJoelho({ lado: 1, b0: -6, torreEm: { x: 55, top: 82, w: 10, dir: 1 }, suporte: [[hx + 16.5, hy - 10.6]], saida: { de: [[hx + 13.6, 4.2]] } });
  // cadeira extensora: torre da pilha atrás do encosto, cadeira com a perna da frente, pegadores ao lado do assento e,
  // ao lado do joelho, o eixo com o came e o braço que leva o rolo até a frente da canela; o cabo vai do came à pilha
  return { view: 'side', frames: [A, B], equip: [sapata(49, hx - 14), fundo, ...s.equip, { k: 'frame', pts: [[hx + 16.5, hy - 10.6], [hx + 16.5, CHAO]], w: 2 }, sapata(hx + 15, hx + 34), pegadorDoAssento(hy - 8), { k: 'handle' }, frente] };
}

export function legCurl({ mode = 'lying' } = {}) {
  if (mode === 'seated') {
    const s = legMachineSeat(84, 33.5, 16);
    const base = { hip: s.hip, torso: s.torso, arm: { a: -10, b: 18 } };
    const hx = s.hip[0], hy = s.hip[1];
    const [fundo, frente] = mecanismoDoJoelho({ lado: -1, b0: 72, torreEm: { x: hx - 3, top: 80, w: 12, dir: 1 }, suporte: [[hx + 16.5, hy - 10.6]], saida: { de: [[hx + 13.6, 4.2]], interno: true }, ganho: 5.5 });
    return {
      view: 'side',
      frames: [{ ...base, leg: { a: 88, b: 72 } }, { ...base, leg: { a: 88, b: -26 } }],
      // cadeira flexora: a pilha fica ao lado do assento (aparece por trás do corpo), como nas cadeiras flexoras de pilha;
      // perna da frente, pegadores, eixo com o came ao lado do joelho, braço com o rolo atrás
      // do tornozelo e a almofada que prende as coxas, na sua haste (presa à estrutura, ao lado da perna)
      equip: [
        fundo, ...s.equip,
        { k: 'frame', pts: [[hx + 16.5, hy - 10.6], [hx + 16.5, CHAO]], w: 2 }, sapata(hx + 15, hx + 21),
        { k: 'frame', pts: [[hx + 12, hy - 10.6], [hx + 12, hy + 14.5], [hx + 14.5, hy + 14.5]], w: 1.6, z: 'back' },
        pegadorDoAssento(hy - 8), { k: 'handle' },
        { k: 'pad', a: [hx + 9, hy + 8.6], b: [hx + 20, hy + 8.4], z: 'front' },
        { k: 'line', a: [hx + 14.5, hy + 10.3], b: [hx + 14.5, hy + 14.5], c: 'fg-eq', w: 1.6, z: 'front' },
        frente,
      ],
    };
  }
  if (mode === 'standing') {
    const base = { hip: [94, H], torso: 14, legF: foot(96), arm: { hand: [117, 66] } };
    const [fundo, frente] = mecanismoDoJoelho({ lado: -1, b0: 0, torreEm: { x: 131, top: 88, w: 10, dir: -1 }, suporte: [[126, 25.4]], saida: { de: [[123.2, 25.4]], direto: true }, ganho: 5.5 });
    return {
      view: 'side',
      frames: [{ ...base, legN: { a: 2, b: 0 } }, { ...base, legN: { a: 6, b: -104 } }],
      // flexora em pé: torre da pilha à frente com o pegador, apoio da coxa, eixo com o came ao lado do joelho (no braço
      // que sai da torre) e o rolo atrás do tornozelo
      equip: [sapata(82, 126), fundo, { k: 'frame', pts: [[126, 71], [119.3, 71], [119.3, 69.5]], w: 1.6, z: 'back' }, { k: 'line', a: [119.3, 62], b: [119.3, 70.5], c: 'fg-grip', w: 2.3, z: 'back' }, { k: 'frame', pts: [[126, 34], [105.5, 34]], z: 'back' }, { k: 'pad', a: [103.5, 28], b: [104.5, 40], z: 'back' }, frente],
    };
  }
  // Mesa dobrada no quadril (o quadril fica no ponto mais alto): a almofada do peito desce para a cabeceira e a das
  // coxas desce para os joelhos. É o desenho das mesas flexoras de academia, que evita arquear a lombar.
  const hip = [94, 33];
  const tr = frame(100);
  const cx = [-Math.sin(80 * D2R), -Math.cos(80 * D2R)], cn = [-cx[1], cx[0]]; // ao longo da coxa e para baixo dela
  const noPeito = (u, f) => add(add(hip, tr.up, u), tr.front, f), naCoxa = (u, f) => add(add(hip, cx, u), cn, f);
  const T = naCoxa(18.5, 10.6), PICO = [hip[0], hip[1] - 11.4], C = noPeito(35, 11.2);
  const naLongarina = (x) => (x < PICO[0] ? [x, T[1] + ((x - T[0]) / (PICO[0] - T[0])) * (PICO[1] - T[1])] : [x, PICO[1] + ((x - PICO[0]) / (C[0] - PICO[0])) * (C[1] - PICO[1])]);
  const base = { hip, torso: 100, head: -20, arm: { a: 62, b: 118 } };
  const [fundo, frente] = mecanismoDoJoelho({ lado: -1, b0: -83, torreEm: { x: 161, top: 82, w: 10, dir: -1 }, suporte: [T], saida: { de: [[87, 4.2]] }, ganho: 5 });
  return {
    view: 'side',
    frames: [{ ...base, leg: { a: -80, b: -83 } }, { ...base, leg: { a: -80, b: -194 } }],
    // mesa flexora: mesa dobrada no quadril com longarina e dois pés, base até a torre da pilha, pegadores sob a
    // cabeceira, eixo com o came na ponta da mesa (ao lado do joelho) e o braço com o rolo sobre o tendão
    equip: [
      sapata(60, 156),
      fundo,
      { k: 'frame', pts: [naLongarina(84), [84, CHAO]], w: 2 }, { k: 'frame', pts: [naLongarina(120), [120, CHAO]], w: 2 },
      { k: 'frame', pts: [T, PICO, C], w: 1.6 },
      { k: 'pad', a: naCoxa(1.5, 8.2), b: naCoxa(18.5, 8.2) },
      { k: 'pad', a: noPeito(3, 8.8), b: noPeito(35, 8.8) },
      { k: 'fn', z: 'back', f: (o, J) => { const h = J.handN; P.tubo(o, [C, [h[0], C[1] - 1], h], 1.4); } },
      { k: 'handle' },
      frente,
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
    pisos: [{ x0: 104, x1: 130, y: top }],
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
    // máquina de elevação pélvica (modelo de anilhas com encosto articulado e cinto): base, encosto das costas que gira
    // no seu poste e acompanha o tronco, cinto estofado sobre o quadril preso à alavanca (eixo à frente dos pés, anilha
    // no pino), plataforma inclinada para os pés e pegadores ao lado do quadril
    if (tool === 'machine') {
      // Referência: Nautilus Glute Drive (foto do fabricante, com pessoa). O eixo das alavancas fica baixo, na base, sob
      // os joelhos; as alavancas sobem até o lado do quadril, onde ficam os pinos das anilhas e onde prende o cinto.
      const PV = [119, 5], RL = 22;
      const pe = { foot: [124, AK + 3.6], footAng: -18 };
      A.leg = pe; B.leg = pe;
      const costas = (J, u) => add(add(J.sh, [-J.up[1], J.up[0]], 6.8), J.up, u);
      eq.length = 0;
      eq.push(
        sapata(60, 140),
        { k: 'frame', pts: [[PV[0], CHAO], PV], w: 2.2 },
        { k: 'fn', z: 'back', f: (o, J) => {
          const m = costas(J, -6.5);
          P.tubo(o, [[80, CHAO], [80, 9], m], 2);            // poste e articulação do encosto
          P.estofado(o, costas(J, -15), costas(J, 2), 1.9);
          P.eixo(o, m, 1.5);
          const c = add(add(J.heelN, J.fdN, 4), J.fuN, -1.2); // plataforma inclinada, nos seus dois pés
          P.tubo(o, [add(c, J.fdN, -7), [add(c, J.fdN, -7)[0], CHAO]], 1.6);
          P.tubo(o, [add(c, J.fdN, 8), [add(c, J.fdN, 8)[0], CHAO]], 1.6);
          P.chapa(o, c, J.fdN, 10.5, 1, 'fg-steel');
          const q = add(J.hip, J.up, 2);                      // ponto do cinto, ao lado do quadril
          const u = norm(sub(q, PV)), e = add(PV, u, RL);     // a alavanca aponta para o quadril; o cinto dá a folga
          P.tubo(o, [PV, e], 1.8);
          P.anilha(o, add(PV, u, RL * 0.84), 6.5);
          o.line(e, q, 'fg-grip', 1.6);
          P.eixo(o, PV, 1.7);
        } },
        { k: 'fn', f: (o, J) => { const fr = [J.up[1], -J.up[0]], c = add(add(J.hip, J.up, 2), fr, 6.4); o.cap(add(c, J.up, -5), add(c, J.up, 5), 1.5, 1.5, 'fg-cush'); o.line(add(c, J.up, -5), add(J.hip, J.up, -3), 'fg-eq', 1.2); } },
        { k: 'handle' },
      );
    }
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
    // O eixo da máquina fica atrás e acima do quadril. O pé (na chapa) descreve um arco em volta dele: começa embaixo do
    // corpo, com o joelho dobrado, e vai para trás e para cima até a perna quase estender.
    const PV = [84, 56.8], RB = 44.2, RC = 6;
    const TH = [-81.3, -103.8, -126.3], FA = [40, 58, 75];
    const naChapa = (J) => add(meio(J.heelN, J.toeN), J.fuN, -2);
    return {
      view: 'side',
      frames: TH.map((th, i) => ({ ...base, legN: { foot: [PV[0] + RB * Math.cos(th * D2R), PV[1] + RB * Math.sin(th * D2R)], footAng: FA[i] } })),
      // glúteo máquina: coluna com o apoio de peito e o pegador, torre da pilha logo atrás dela; da coluna sai o suporte
      // do eixo; no eixo giram o came e o braço que leva a chapa onde a sola do pé empurra; o cabo desce do came até a
      // polia da base e vai até a pilha
      equip: [
        sapata(74, 130),
        { k: 'fn', z: 'back', f: (o, J) => {
          const d = norm(sub(naChapa(J), PV));
          const giro = Math.max(0, (TH[0] * D2R) - Math.atan2(d[1], d[0]));
          // o cabo corre por dentro da travessa que segura o eixo e só aparece junto da torre, longe do corpo
          torre(o, { x: 135, top: 88, w: 10, dir: -1, sobe: giro * 9, de: [[127.2, PV[1]]], direto: true, polia0: true });
          P.tubo(o, [[130, PV[1]], PV], 2);
          came(o, PV, RC, Math.atan2(d[1], d[0]));
          P.tubo(o, [PV, naChapa(J)], 1.7);
        } },
        { k: 'frame', pts: [[111, 50], [122, 44], [122, CHAO]], z: 'back', w: 2.2 },
        { k: 'fn', z: 'back', f: (o, J) => { const h = J.handN; P.tubo(o, [[h[0] + 3.5, h[1]], [130, h[1]]], 1.5); o.line([h[0] - 4, h[1]], [h[0] + 4, h[1]], 'fg-grip', 2.2); } }, // pegador
        { k: 'pad', a: [106, 46], b: [116, 54], z: 'back' },
        { k: 'fn', f: (o, J) => { P.chapa(o, naChapa(J), J.fdN, 5.5, 1, 'fg-steel'); P.eixo(o, PV, 1.6); } },
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
  // joelho a "kx" do meio do corpo (a coxa aponta para quem olha e abre para o lado, girando no quadril)
  const perna = (kx) => ({ a: 80, la: (kx - L.hpw) / (L.thigh * Math.sin(80 * D2R)), b: 0, lb: 0.93 });
  // mãos nos pegadores, um de cada lado do assento; o cotovelo dobra para trás (por isso o braço aparece mais curto)
  const arm = { hand: [13, 33.5], bend: 1, la: 0.72, lb: 0.76 };
  const DP = 7; // do centro do joelho até o centro da almofada
  // abdutora: almofadas por fora dos joelhos; adutora: por dentro (fechadas, as duas almofadas se encostam no meio)
  const closed = { ...SEAT_F, leg: perna(ab ? 7.4 : DP + 1.9), arm };
  const open = { ...SEAT_F, leg: perna(21.4), arm };
  const s = ab ? 1 : -1;
  // De cada lado, um braço sai do eixo sob a frente do assento, corre por baixo da coxa e sobe até a almofada, que fica
  // em pé encostada no lado do joelho; do mesmo braço desce a haste do apoio do pé.
  const braco = (o, J, sd, sg, frente) => {
    const kn = J['kn' + sd], an = J['an' + sd];
    const px = kn[0] + sg * s * DP; // linha da almofada
    const yb = 17.5;
    if (!frente) {
      P.tubo(o, [[X + sg * 2.6, yb], [px + sg * s * 2.2, yb], [px + sg * s * 2.2, kn[1] - 2]], 1.7);
      o.line([kn[0], yb], [kn[0], an[1] - 4.2], 'fg-eq', 1.4);
      o.line([kn[0] - 4.2, an[1] - 4.4], [kn[0] + 4.2, an[1] - 4.4], 'fg-eq', 2);
      P.eixo(o, [X + sg * 2.6, yb], 1.6);
      return;
    }
    o.line([px + sg * s * 2.2, kn[1] - 2], [px + sg * s * 0.6, kn[1] - 2], 'fg-eq', 1.5);
    P.estofado(o, [px, kn[1] - 6.5], [px, kn[1] + 3], 1.8);
  };
  return {
    view: 'front', label: ab ? 'Vista de frente: almofadas por fora dos joelhos' : 'Vista de frente: almofadas por dentro dos joelhos',
    frames: ab ? [closed, open] : [open, closed],
    // torre da pilha atrás do encosto, assento, os dois braços com as almofadas e os apoios dos pés, e os pegadores
    equip: [
      { k: 'tower', x: 0, top: 86, w: 22, trk: 'knR', gain: 0.6 }, seatBoxF, backPadF,
      { k: 'fn', z: 'back', f: (o, J) => { braco(o, J, 'R', 1, false); braco(o, J, 'L', -1, false); } },
      { k: 'fn', z: 'back', f: (o, J) => { for (const h of [J.handR, J.handL]) { P.tubo(o, [[h[0], 18], [h[0], h[1] - 1]], 1.5); o.circ(h, 1.7, 'fg-rub'); o.circ(h, 0.6, 'fg-steel'); } } },
      { k: 'fn', f: (o, J) => { braco(o, J, 'R', 1, true); braco(o, J, 'L', -1, true); } },
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
    // Referência: Body-Solid GSCR349 (foto do fabricante, com pessoa sentada). A alavanca gira num eixo sob a frente do
    // assento e segue para a frente, por entre as pernas, até o pino das anilhas, que fica à frente dos joelhos; dela
    // sobe a haste da almofada, apoiada sobre as coxas logo atrás dos joelhos, com dois pegadores em pé em cima.
    const PV = [s.hip[0] + 6, s.hip[1] - 11];
    const almofada = (kn) => add(kn, [-3, 6.4]);
    const mk = (fa) => {
      const pose = { hip: s.hip, torso: 4, leg: { foot: ankleFromToe(toe, fa), footAng: fa } };
      const p = almofada(solveSide(pose).knN);
      return { ...pose, arm: { hand: [p[0] + 1.5, p[1] + 4.6] } }; // mãos nos pegadores da almofada
    };
    return {
      view: 'side', frames: [mk(-12), mk(36)], maos: 'eixo-v',
      // panturrilha sentado (articulada): base, calço dos pés, alavanca com eixo sob o assento e anilhas na ponta da
      // frente, haste com a almofada das coxas e os pegadores
      equip: [
        ...s.equip,
        sapata(s.hip[0] + 15, 128),
        { k: 'box', x0: 110, x1: 124, h: 5 },
        { k: 'fn', z: 'back', f: (o, J) => {
          const p = almofada(J.knN), c = add(p, [0, -15]);
          const d = norm(sub(c, PV)), e = add(PV, d, 46);
          P.tubo(o, [PV, e], 2);
          P.tubo(o, [c, p], 1.7);
          P.anilha(o, e, 7);
          P.eixo(o, PV, 1.8);
        } },
        { k: 'fn', f: (o, J) => {
          const p = almofada(J.knN);
          P.estofado(o, add(p, [-5, 0]), add(p, [5, 0]), 1.8);
          o.line(add(p, [1.5, 1.8]), add(p, [1.5, 8]), 'fg-grip', 2.2);
        } },
      ],
      pisos: [{ x0: 110, x1: 124, y: 5 }],
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
    // panturrilha em pé: torre da pilha atrás, braço articulado (eixo na torre) com as ombreiras e os pegadores à frente
    // dos ombros; do meio do braço desce o cabo até a polia da base, que vai levantar a pilha
    const pv = [78, 82];
    const noBraco = (J) => { const p = add(J.sh, [-1, 4.7]); return [pv[0] + (p[0] - 3 - pv[0]) * 0.55, pv[1] + (p[1] + 1 - pv[1]) * 0.55]; };
    const q0 = noBraco({ sh: shOf(A.hip, A.torso) });
    eq.unshift(sapata(64, 101));
    eq.push({ k: 'fn', z: 'back', f: (o, J) => {
      const p = add(J.sh, [-1, 4.7]), q = noBraco(J);
      torre(o, { x: 72, top: 104, w: 9, dir: 1, sobe: Math.max(0, q[1] - q0[1]) * 1.6, de: [q, [q[0], 4.5]] });
      P.tubo(o, [pv, [p[0] - 3, p[1] + 1]], 1.8); P.eixo(o, pv, 1.8); o.line([p[0] + 4, p[1]], J.handN, 'fg-eq', 1.3);
    } });
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
  return { view: 'side', frames: [A, B], equip: eq, pisos: [{ x0: 101, x1: 122, y: 6 }] };
}

// Animações dos exercícios acrescentados no levantamento de lacunas do catálogo: pesos livres e acessórios que faltavam
// (supino no chão, rosca arrastada, landmine, kettlebell, bola suíça, elástico, fita de suspensão, medicine ball na
// parede, rolo de punho), a remada cavalinho com apoio de peito e o ergômetro de braço.
// Convenção igual à dos outros arquivos: frames[0] = posição inicial descrita no exercício; último quadro = fim do movimento.
// As peças que não existem em equip.js são desenhadas aqui, com o tipo 'fn' (desenho livre).
import { L, solveSide } from './rig.js';
import { AK, H, X, SHY, D2R, CHAO, add, foot, frame, shOf, stand, seated, POLIA_F, ankleFromToe } from './base.js';
import { P } from './equip.js';
import * as U from './upper.js';

const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const passos = (n) => Array.from({ length: n }, (_, i) => i / (n - 1));
const sapata = (x0, x1, z) => ({ k: 'frame', pts: [[x0, CHAO], [x1, CHAO]], w: 1.7, ...(z ? { z } : {}) });
const mat = (x0, x1) => ({ k: 'mat', x0, x1 });
const FAR = [1.8, 1.0]; // deslocamento com que os aparelhos da mão de lá são desenhados (igual ao de equip.js)

// ---------- PEITO ----------
// Supino no chão com halteres: deitado no colchonete, joelhos dobrados. Os braços descem abertos a uns 45° do tronco
// (de lado aparecem mais curtos) até a parte de trás do braço tocar o chão; o antebraço fica em pé.
export function floorPress() {
  const hip = [108, 8.9];
  const sh = [hip[0] - L.torso, hip[1]];
  const base = { hip, torso: -90, leg: foot(hip[0] + 29) };
  return {
    view: 'side', label: 'Os braços descem até tocar o chão',
    frames: [{ ...base, arm: { hand: [sh[0] + 1.5, sh[1] + 29.2] } }, { ...base, arm: { hand: [sh[0] + 10.5, 18.9], la: 0.74 } }],
    equip: [mat(56, 150), { k: 'db' }],
  };
}

// ---------- OMBROS ----------
// Abertura com elástico (pull-apart), vista de frente: os braços começam estendidos à frente (na direção de quem olha,
// por isso aparecem curtos) e abrem para os lados, um pouco abaixo da linha dos ombros; o elástico estica à frente do
// alto do peito. (De costas os músculos apareceriam, mas o elástico ficaria escondido atrás dos braços.)
export function bandPullApart() {
  const base = { hip: [X, H], leg: { a: 6, b: 3 } };
  return {
    view: 'front', label: 'Vista de frente: os braços começam estendidos à frente', maos: 'punho',
    frames: [{ ...base, arm: { a: 80, la: 0.16, b: 80, lb: 0.1 } }, { ...base, arm: { a: 84, la: 0.97, b: 86, lb: 0.95 } }],
    equip: [{ k: 'band', at: 'hand' }],
  };
}

// manopla em pé vista de frente: com a mão apontando para fora vê-se a palma; apontando para o meio do corpo, o dorso
const maoEmPe = (J, k) => ({ m: 'eixo', u: [0, 1], face: J['hd' + k][0] * (k === 'R' ? 1 : -1) >= 0 ? 'palma' : 'dorso' });

// Rotação interna de ombro, vista de frente: a polia (ou o elástico) fica do MESMO lado do braço que trabalha, na altura
// do cotovelo. O antebraço começa apontando para fora e gira para dentro, até a mão chegar à frente da barriga.
export function internalRotation({ tool = 'cable' } = {}) {
  const base = { hip: [X, H], leg: { a: 6, b: 3 }, armL: { a: 6, b: 9 } };
  const ey = SHY - 18; // polia na altura do cotovelo (um pouco abaixo dele, para o cabo não passar por cima do braço)
  return {
    view: 'front', label: 'Vista de frente: cotovelo colado ao corpo',
    maos: { R: maoEmPe, L: 'solta' },
    frames: [{ ...base, armR: { a: 3, b: -82, lb: -0.72 } }, { ...base, armR: { a: 3, b: -82, lb: 0.74 } }],
    equip: tool === 'cable'
      ? [{ k: 'tower', x: 46, only: 'R', top: 104, py: ey, trk: 'handR' }, { k: 'cable', from: [POLIA_F(46), ey], only: 'R', grip: true }]
      : [{ k: 'frame', pts: [[37, CHAO], [51, CHAO]], w: 1.7, z: 'back' }, { k: 'frame', pts: [[44, CHAO], [44, 96]], w: 2.2, z: 'back' }, { k: 'fn', f: (o, J) => { o.line([X + 44, ey], J.handR, 'fg-band', 1.4); o.circ([X + 44, ey], 1.5, 'fg-steel'); } }],
  };
}

// ---------- BÍCEPS ----------
// Rosca arrastada: os cotovelos vão para trás e a barra sobe rente ao corpo, das coxas até a altura do peito.
export function dragCurl() {
  const base = stand();
  const sh = shOf(base.hip, 0);
  return {
    view: 'side', pega: 'supinada', label: 'Cotovelos para trás: a barra sobe rente ao corpo',
    frames: [{ ...base, arm: { a: 3, b: 7 } }, { ...base, arm: { hand: [sh[0] + 7.4, sh[1] - 20.5] } }, { ...base, arm: { hand: [sh[0] + 6.2, sh[1] - 10] } }],
    equip: [{ k: 'barbell' }],
  };
}

// ---------- ANTEBRAÇO ----------
// Rolo de punho: braços estendidos à frente, na altura dos ombros. O bastão (visto pela ponta) fica parado; os punhos
// giram um de cada vez, a corda enrola nele e o peso sobe do chão até perto das mãos.
export function wristRoller() {
  const base = stand({ torso: -2 });
  const sh = shOf(base.hip, -2);
  const B = [sh[0] + 30.4, sh[1] - 1.5];
  // punho que deixa o meio da mão fechada em cima do bastão, com a mão apontando no ângulo fi
  const mao = (fi) => {
    const wr = add(B, [Math.cos(fi * D2R), Math.sin(fi * D2R)], -L.hand * 1.7);
    const J = solveSide({ ...base, arm: { hand: wr } });
    return { hand: wr, hf: fi - Math.atan2(wr[1] - J.elN[1], wr[0] - J.elN[0]) / D2R };
  };
  const cima = mao(30), baixo = mao(-24);
  return {
    view: 'side', long: true, label: 'Os punhos giram o bastão, uma mão de cada vez',
    frames: [0, 1, 2, 3, 4].map((i) => ({ ...base, armN: i % 2 ? baixo : cima, armF: i % 2 ? cima : baixo })),
    equip: [{ k: 'fn', f: (o, J, t) => {
      const y = lerp(4.7, B[1] - 12.5, t); // o peso sobe conforme a corda enrola
      o.line([B[0], B[1]], [B[0], y], 'fg-cable', 0.7);
      P.anilha(o, [B[0], y], 4.7);
      o.circ(B, 1.5 + 0.8 * t, 'fg-rub');
      o.circ(B, 0.6, 'fg-steel');
    } }],
  };
}

// ---------- COSTAS ----------
// Remada cavalinho com apoio de peito, como nos modelos vistos em catálogo (Total Health, TRG, Titan, Temple of Gainz):
// quadro em "A" visto de lado — coluna da frente e escora de trás — com a almofada inclinada no alto; plataforma dos
// pés inclinada, atrás; a alavanca sai de um eixo baixo junto da plataforma, passa pelo meio do quadro e leva na ponta da
// frente a manga das anilhas. Os pegadores ficam no alto de hastes que sobem da alavanca: por isso as mãos chegam ao
// lado da almofada enquanto a barra continua embaixo dela. A pessoa fica em pé na plataforma, inclinada sobre a almofada.
export function chestTBarRow() {
  const fa = 33; // inclinação da plataforma dos pés (a ponta de trás é a mais alta)
  const fd = [Math.cos(fa * D2R), -Math.sin(fa * D2R)], sola = [-fd[1], fd[0]];
  const p0 = [64, 9.5]; // ponta de baixo da plataforma
  const an = add(add(p0, fd, -12), sola, 1 + L.ankle * 0.55);
  const hip = add(an, [Math.sin(30 * D2R), Math.cos(30 * D2R)], 42.8);
  const torso = 52;
  const f = frame(torso);
  const sh = shOf(hip, torso);
  const base = { hip, torso, head: -14, leg: { foot: an, footAng: fa } };
  const pv = [62, 6]; // eixo da alavanca, na base, junto da ponta de baixo da plataforma
  const HASTE = 12;
  const h0 = add(sh, [Math.sin(14 * D2R), -Math.cos(14 * D2R)], 29.2);
  const R = dist(h0, pv), a0 = Math.atan2(h0[1] - pv[1], h0[0] - pv[0]);
  const BARRA = Math.sqrt(R * R - HASTE * HASTE), DELTA = Math.atan2(HASTE, BARRA);
  const mao = (g) => [pv[0] + R * Math.cos(a0 + g * D2R), pv[1] + R * Math.sin(a0 + g * D2R)];
  // almofada: da barriga até o alto do peito (o esterno fica na ponta de cima)
  const pa = add(add(hip, f.front, 8.9), f.up, 2), pb = add(add(hip, f.front, 8.9), f.up, 21);
  const S = (u) => add(mix(pa, pb, u), f.front, 2.5);
  const apice = S(0.5), pe = [apice[0] + 12, CHAO];
  // batente onde a alavanca descansa antes de começar, na coluna da frente
  let yb = 20;
  for (let i = 0; i < 4; i++) yb = pv[1] + Math.tan(a0 - DELTA) * (apice[0] + ((apice[1] - yb) / (apice[1] - CHAO)) * 12 - pv[0]) - 1.7;
  const xb = apice[0] + ((apice[1] - yb) / (apice[1] - CHAO)) * 12;
  return {
    view: 'side', pega: 'neutra',
    frames: [0, 7, 14].map((g) => ({ ...base, arm: { hand: mao(g) } })),
    equip: [
      sapata(38, pe[0] + 10),
      { k: 'frame', pts: [apice, pe], w: 2.4 },                       // coluna da frente
      { k: 'frame', pts: [apice, [p0[0] + 4, CHAO]], w: 2 },           // escora de trás
      { k: 'frame', pts: [[xb - 3, yb], [xb + 3.5, yb]], w: 1.5 },     // batente
      { k: 'frame', pts: [S(0.03), S(0.97)], w: 1.5 },
      { k: 'pad', a: pa, b: pb },
      // plataforma dos pés, com o suporte da ponta de trás
      { k: 'fn', z: 'back', f: (o) => {
        P.tubo(o, [add(p0, fd, -22), [add(p0, fd, -22)[0] + 1, CHAO]], 1.8);
        P.tubo(o, [add(p0, fd, 1), [p0[0] + 4, CHAO]], 1.6);
        P.chapa(o, add(p0, fd, -11), fd, 12.5, 1, 'fg-steel');
      } },
      // alavanca: barra do eixo até a manga das anilhas e a haste dos pegadores
      { k: 'fn', z: 'back', f: (o, J) => {
        const ang = Math.atan2(J.handN[1] - pv[1], J.handN[0] - pv[0]) - DELTA;
        const d = [Math.cos(ang), Math.sin(ang)];
        const q = add(pv, d, BARRA);
        // a manga das anilhas sai da ponta da alavanca um pouco mais deitada do que ela (fica quase horizontal no descanso)
        const e = [Math.cos(ang - 18 * D2R), Math.sin(ang - 18 * D2R)];
        P.tubo(o, [pv, q, add(q, e, 19)], 1.7);
        P.tubo(o, [q, J.handN], 1.4);
        P.anilhasDePerfil(o, add(q, e, 8), e, 3, 7, 1.1);
        P.eixo(o, pv, 2.1);
      } },
      { k: 'handle' },
    ],
  };
}

// ---------- QUADRÍCEPS ----------
// Agachamento no landmine: as duas mãos seguram a ponta da barra junto ao alto do peito. A outra ponta fica presa no
// chão, então a ponta de cima anda em arco: em pé, o corpo fica um pouco inclinado para a frente, apoiado na barra; no
// fundo, o quadril senta para trás.
export function landmineSquat() {
  const R = 104, REL = [7.5, -5.5];
  const an = [84.5, AK];
  const maoDe = (hip, torso) => { const f = frame(torso); return add(add(add(hip, f.up, L.torso), f.front, REL[0]), f.up, REL[1]); };
  const topo = { hip: [an[0] + 43.4 * Math.sin(11 * D2R), an[1] + 43.4 * Math.cos(11 * D2R)], torso: 12 };
  const m0 = maoDe(topo.hip, topo.torso);
  const pv = [m0[0] + Math.sqrt(R * R - (m0[1] - 3.2) ** 2), 3.2];
  const mk = (s) => {
    const hy = lerp(topo.hip[1], 27.5, s), torso = lerp(topo.torso, 26, s);
    const c = maoDe([0, hy], torso);
    return { hip: [pv[0] - c[0] - Math.sqrt(R * R - (c[1] - pv[1]) ** 2), hy], torso, leg: { foot: an }, arm: { rel: REL } };
  };
  return {
    view: 'side', label: 'A ponta da barra fica junto ao peito',
    frames: passos(5).map(mk),
    equip: [{ k: 'fn', f: (o, J) => {
      const h = J.handN, d = norm(sub(pv, h));
      o.line([pv[0] - 8, CHAO], [pv[0] + 7, CHAO], 'fg-eq', 1.7);
      P.tubo(o, [add(h, d, -2.6), pv], 1.5);
      P.anilhasDePerfil(o, add(h, d, 6.5), d, 2, 6.5, 1.1);
      P.eixo(o, pv, 2.1);
    } }],
  };
}

// Agachamento na parede com bola suíça: a bola fica entre a parede e as costas e rola parede abaixo. Como ela rola
// entre a parede (parada) e as costas (que descem), o centro da bola desce metade do que o corpo desce: começa na lombar
// e termina no meio das costas.
export function ballWallSquat() {
  const hx = 98, RAIO = 13.5;
  const an = [hx + 15, AK];
  const A = { hip: [hx, 44.8], torso: -2 }, B = { hip: [hx, 27.5], torso: -2 };
  const xb = hx - 4.2 - RAIO * 0.94; // centro da bola (um pouco amassada contra as costas)
  const xp = xb - RAIO * 0.94;       // face da parede
  return {
    view: 'side', maos: 'solta',
    frames: [
      { ...A, leg: { foot: an }, arm: { hand: [hx + 6.5, A.hip[1] - 0.3] } },
      { ...B, leg: { foot: an }, arm: { hand: [hx + 13.5, B.hip[1] + 4.4] } },
    ],
    equip: [
      { k: 'wall', x: xp, dir: -1, top: 100 },
      { k: 'fn', z: 'back', f: (o, J) => {
        const c = [xb, A.hip[1] + 9 - (A.hip[1] - J.hip[1]) / 2];
        o.circ(c, RAIO, 'fg-plate');
        o.circ(c, RAIO * 0.72, 'fg-ring');
        o.circ(add(c, [RAIO * 0.36, RAIO * 0.44]), RAIO * 0.12, 'fg-eqhi-f');
      } },
    ],
  };
}

// Agachamento com fita de suspensão: de frente para o ponto de fixação, fitas esticadas o tempo todo (a mão anda num
// arco em volta do ponto de fixação). Em pé, cotovelos junto ao corpo; ao descer, o quadril vai para trás e os braços estendem.
export function suspensionSquat() {
  const A = [X + 45, 110]; // ponto de fixação
  const leg = foot(X + 1);
  const topo = { hip: [X, H], torso: 0 }, fundo = { hip: [X - 11, 26], torso: 22 };
  const m0 = [X + 13, SHY - 12], m1 = [X + 22.1, 57.8];
  const FITA = dist(m0, A);
  const g0 = Math.atan2(m0[1] - A[1], m0[0] - A[0]), g1 = Math.atan2(m1[1] - A[1], m1[0] - A[0]);
  return {
    view: 'side', pega: 'neutra', label: 'As fitas ficam esticadas: servem para equilibrar, não para se pendurar',
    frames: passos(5).map((s) => {
      const g = lerp(g0, g1, s);
      return { hip: mix(topo.hip, fundo.hip, s), torso: lerp(topo.torso, fundo.torso, s), leg, arm: { hand: [A[0] + FITA * Math.cos(g), A[1] + FITA * Math.sin(g)] } };
    }),
    equip: [{ k: 'cable', from: A }, { k: 'handle' }],
  };
}

// ---------- POSTERIORES ----------
// Levantamento terra com kettlebell: o peso começa no chão, entre os pés. O quadril vai para trás, a coluna fica reta e
// os braços pendem estendidos; subir é empurrar o quadril para a frente.
export function kbDeadlift() {
  const leg = foot(X + 1);
  const topo = { hip: [X - 1, H], torso: 0 }, fundo = { hip: [85, 32.2], torso: 66 };
  const RAIO = 5.6; // kettlebell de uns 22 cm: com ele no chão, a alça fica a cerca de 25 cm de altura
  const frames = passos(5).map((s) => {
    const hip = mix(fundo.hip, topo.hip, s), torso = lerp(fundo.torso, topo.torso, s);
    const sh = shOf(hip, torso);
    const hx = lerp(X + 5.5, X + 4.6, s);
    return { hip, torso, head: lerp(-30, 0, s), leg, arm: { hand: [hx, sh[1] - Math.sqrt(Math.max(1, 28.7 ** 2 - (hx - sh[0]) ** 2))] } };
  });
  return {
    view: 'side', maos: 'eixo', frames,
    equip: [{ k: 'fn', f: (o, J) => P.kettlebell(o, add(J.handN, J.hdN, RAIO * 1.19), J.hdN, RAIO) }],
  };
}

// ---------- GLÚTEOS ----------
// Elevação pélvica unilateral: costas apoiadas na lateral do banco, um pé no chão e a outra perna no ar, com o quadril
// e o joelho dobrados. O quadril sobe até o tronco ficar paralelo ao chão, com o joelho de apoio a cerca de 90°. Mãos no quadril.
export function singleLegHipThrust() {
  const apoio = foot(124);
  const REL = [6.4, -21];
  // mãos espalmadas na frente do quadril: o punho dobra para a mão ficar deitada, apontando para a coxa
  const pose = (hip, torso, legF) => {
    const f = frame(torso);
    const J = solveSide({ hip, torso, arm: { rel: REL } });
    let hf = (Math.atan2(-f.up[1], -f.up[0]) - Math.atan2(J.wrN[1] - J.elN[1], J.wrN[0] - J.elN[0])) / D2R;
    hf = ((hf + 540) % 360) - 180;
    return { hip, torso, legN: apoio, legF, arm: { rel: REL, hf } };
  };
  return {
    view: 'side', maos: 'solta',
    // perna livre com quadril e joelho a cerca de 90°: a coxa aponta para cima e a canela fica paralela ao tronco
    frames: [pose([101, 11.6], -64, { a: 154, b: 64 }), pose([103, 24], -90, { a: 180, b: 90 })],
    equip: [{ k: 'bench', x0: 50, x1: 79, h: 15 }],
  };
}

// ---------- ABDÔMEN ----------
// Elevação de joelhos na barra fixa: pendurado, os joelhos sobem dobrados à frente do corpo; o tronco não balança.
export function hangingKneeRaise() {
  const BY = 114;
  const hip = [X, BY - 29.3 - L.torso];
  const base = { hip, torso: 0, arm: { hand: [X + 1, BY - 1.5] } };
  return {
    view: 'side',
    frames: [{ ...base, leg: { a: 3, b: 1 } }, { ...base, leg: { a: 104, b: 14 } }],
    // barra fixa: coluna com sapata, braço que sustenta a barra e mão-francesa
    equip: [sapata(X - 33, X - 9, 'back'), { k: 'frame', pts: [[X - 22, CHAO], [X - 22, BY], [X + 7, BY]], w: 2.2, z: 'back' }, { k: 'frame', pts: [[X - 22, BY - 13], [X - 9, BY]], w: 1.3, z: 'back' }, { k: 'fixbar', at: [X + 1, BY], r: 1.8 }],
  };
}

// ---------- CARDIO ----------
// Ergômetro de braço: sentado, tronco ereto, eixo das manivelas na altura dos ombros (ou pouco abaixo). As mãos giram
// as manivelas como pedais, uma oposta à outra; no ponto mais distante o cotovelo ainda fica um pouco dobrado.
export function armErgometer() {
  const s = seated({ hx: 82, recl: 2, back: 30 });
  const C = add(s.sh, [20, -2]);
  const RAIO = 7.4, N = 8;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const th = (90 - (360 / N) * i) * D2R;
    const v = [RAIO * Math.cos(th), RAIO * Math.sin(th)];
    // o alvo é o punho: a manopla fica no meio da mão fechada, um pouco adiante
    frames.push({ hip: s.hip, torso: s.torso, leg: s.leg, armN: { hand: add(add(C, v), [-2.2, 0.6]) }, armF: { hand: add(add(C, v, -1), [-2.2, 0.6]) } });
  }
  const xc = C[0] + 17; // coluna do aparelho, à frente dos joelhos
  return {
    view: 'side', loop: true, frames,
    equip: [
      ...s.equip,
      sapata(s.hip[0] + 15, xc + 9),
      { k: 'frame', pts: [[xc, CHAO], [xc, C[1] - 4]], w: 3, z: 'back' },
      { k: 'frame', pts: [[xc, 22], [xc + 7, CHAO]], w: 1.6, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        // cabeçote: a carenagem que guarda o eixo das manivelas e a resistência, no alto da coluna, e o painel por cima
        o.smooth([[C[0] - 6.5, C[1]], [C[0] - 4, C[1] + 5.6], [C[0] + 6, C[1] + 7], [xc + 3.5, C[1] + 5], [xc + 4, C[1] - 5], [C[0] + 6, C[1] - 7], [C[0] - 4, C[1] - 5.6]], 'fg-shroud');
        P.tubo(o, [[xc - 2, C[1] + 6], [xc - 3, C[1] + 14]], 1.8);          // haste do painel
        P.chapa(o, [xc - 3.8, C[1] + 17], [0.3, 0.95], 4.6, 3, 'fg-shroud');
        P.chapa(o, [xc - 4.2, C[1] + 17.1], [0.3, 0.95], 3.4, 1.9, 'fg-screen');
        const hf = add(J.handF, FAR);
        o.line(C, hf, 'fg-eq fg-far', 1.6);                                  // manivela de lá
      } },
      { k: 'fn', f: (o, J) => { o.line(C, J.handN, 'fg-eq', 1.6); P.eixo(o, C, 1.9); } },
      { k: 'handle' },
    ],
  };
}

// ---------- CORPO INTEIRO ----------
// Arremesso de medicine ball na parede (wall ball): agacha com a bola junto ao peito, sobe e só então empurra a bola
// para o alvo; na volta, recebe a bola com os braços estendidos e desce direto para o agachamento seguinte.
export function wallBall() {
  const leg = foot(X + 1);
  const RAIO = 7.2;
  const xp = X + 36;                 // face da parede: com os braços estendidos à frente, as pontas dos dedos chegam nela
  const alvo = [xp - RAIO, 137];     // alvo a 2,74 m (9 pés), o padrão mais baixo de competição; a bola toca nele no ponto mais alto
  const segura = { rel: [11.5, -9.5] };
  const emPe = { hip: [X, H], torso: 0, leg };
  const frames = [
    { ...emPe, arm: segura },
    { hip: [X - 8, 25], torso: 24, leg, arm: segura },
    { ...emPe, arm: segura },
    { ...emPe, arm: { rel: [9.5, 26.5] } },   // a bola sobe pela frente do rosto, em direção ao alvo
    { ...emPe, arm: { rel: [10.5, 25] } },
  ];
  const naMao = (J) => add(J.handN, J.hdN, 5.6); // centro da bola enquanto está nas mãos
  const solta = naMao(solveSide(frames[3]));
  return {
    view: 'side', long: true, maos: 'solta', label: 'Primeiro as pernas, depois os braços. Alvo a 2,7 m',
    frames,
    equip: [
      { k: 'wall', x: xp, dir: 1, top: 148 },
      { k: 'fn', z: 'back', f: (o) => { o.line([xp - 0.2, alvo[1] - 5], [xp - 0.2, alvo[1] + 5], 'fg-grip', 1.4); } }, // marca do alvo
      { k: 'fn', z: 'back', f: (o, J, t) => {
        const c = t <= 0.75 ? naMao(J) : mix(solta, alvo, (t - 0.75) * 4);
        o.circ(c, RAIO, 'fg-rub');
        o.circ(c, RAIO * 0.7, 'fg-ring');
      } },
    ],
  };
}

// ---------- APARELHOS ACRESCENTADOS NA TERCEIRA RODADA ----------
// Agachamento articulado (V-squat), como nos modelos da Hammer Strength, da Total Health (Squat Articulado) e da Movement
// (Squat Machine): o encosto e as ombreiras ficam presos numa alavanca cujo eixo fica atrás da pessoa, a meia altura; a
// plataforma dos pés é uma rampa à frente, com a ponta dos pés mais alta. Como o encosto gira com a alavanca, em pé o
// corpo fica reclinado para trás e, ao descer, o tronco vem para a vertical: o movimento é um arco, não uma linha reta.
// As anilhas ficam num pino na ponta de baixo da coluna do encosto, atrás do quadril.
export function vSquat() {
  const PV = [58, 44], R = 47;
  const fa = -20, an = [120, 18];
  const fd = [Math.cos(fa * D2R), -Math.sin(fa * D2R)], sola = [-fd[1], fd[0]];
  const mk = (g) => {
    const sh = [PV[0] + R * Math.cos(g * D2R), PV[1] + R * Math.sin(g * D2R)];
    const torso = -(g - 26);
    return { hip: add(sh, frame(torso).up, -L.torso), torso, leg: { foot: an, footAng: fa }, arm: { rel: [6.5, -3] } };
  };
  const pc = add(add(an, sola, -(L.ankle * 0.55 + 1)), fd, 2); // meio da rampa
  return {
    view: 'side', pega: 'neutra',
    frames: [49, 43.5, 37.5, 31.5, 26].map(mk),
    equip: [
      sapata(40, 148),
      // quadro de trás, que sustenta o eixo
      { k: 'frame', pts: [[PV[0] - 13, CHAO], PV, [PV[0] + 11, CHAO]], w: 2.2, z: 'back' },
      // rampa dos pés com os dois suportes
      { k: 'fn', z: 'back', f: (o) => {
        P.tubo(o, [add(pc, fd, 12), [add(pc, fd, 12)[0], CHAO]], 1.8);
        P.tubo(o, [add(pc, fd, -11), [add(pc, fd, -11)[0], CHAO]], 1.8);
        P.chapa(o, pc, fd, 14, 1, 'fg-steel');
      } },
      // alavanca com a coluna do encosto, as ombreiras, os pegadores e o pino das anilhas
      { k: 'fn', z: 'back', f: (o, J) => {
        const up = J.up, back = [-up[1], up[0]], front = [up[1], -up[0]];
        const q = (u, b = 12) => add(add(J.hip, back, b), up, u);
        P.tubo(o, [PV, q(31)], 2.2);
        o.line(q(-17), q(33), 'fg-eq', 3);
        P.tubo(o, [q(-17), q(-17, 18)], 1.4);
        P.anilha(o, q(-17, 18), 7.5);
        P.estofado(o, q(-2, 9.4), q(14, 9.4), 1.9);
        P.estofado(o, q(18, 9.4), q(35, 9.4), 1.9);
        const om = add(J.sh, up, 4.8);
        o.line(add(om, back, 12), add(om, back, 4), 'fg-eq', 1.6);
        P.estofado(o, add(om, back, 4.5), add(om, front, 3.5), 2);
        o.line(add(om, front, 3.5), J.handN, 'fg-eq', 1.4);
        P.eixo(o, PV, 2.3);
      } },
      { k: 'handle' },
    ],
  };
}

// Agachamento hack invertido: a mesma hack machine, usada de frente para o encosto. Os ombros ficam sob as ombreiras e
// andam com o carro pelo trilho; os pés ficam na plataforma, atrás; ao descer, o quadril vai para trás e o tronco inclina
// mais do que o trilho (o peito sai do encosto), com a coluna reta. Os pés ficam inteiros na plataforma: por isso a
// descida para quando o tornozelo chega ao limite.
export function reverseHack() {
  const INC = 35;
  const f = frame(INC), r = f.up; // o trilho sobe para a frente, na mesma inclinação do tronco em pé
  const fa = 35, an = [76.4, 10.65];
  const sh0 = add([107.48, 38.38], r, L.torso);
  const mk = (s) => {
    const sh = add(sh0, r, -10.5 * s), torso = INC + 25 * s;
    const m = add(add(sh, f.front, 5), r, -4);
    return { hip: add(sh, frame(torso).up, -L.torso), torso, head: -18 - 10 * s, leg: { foot: an, footAng: fa }, arm: { hand: m, la: 0.6, lb: 0.6 } };
  };
  const trilho = add([96, 22], f.front, 14);
  return {
    view: 'side', label: 'De frente para o encosto: o quadril vai para trás',
    frames: [0, 0.5, 1].map(mk),
    equip: [
      sapata(63, 151),
      { k: 'frame', pts: [add(trilho, r, -15), add(trilho, r, 69)], w: 1.6, z: 'back' },
      { k: 'frame', pts: [add(trilho, r, 69), [add(trilho, r, 69)[0] + 1.5, CHAO]], w: 2, z: 'back' },
      { k: 'frame', pts: [[75.5, 8], [73, CHAO]], w: 1.8, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        const c = add(add(J.heelN, J.fdN, 4), J.fuN, -1.1);
        P.chapa(o, c, J.fdN, 10.5, 1, 'fg-steel');
        o.line(add(c, J.fdN, -9), [65, CHAO], 'fg-eq', 1.5);
      } },
      // carro: anda no trilho junto com os ombros (o ponto de referência é o quadril de quem está em pé, reto)
      { k: 'fn', z: 'back', f: (o, J) => {
        const h = add(J.sh, r, -L.torso);
        const q = add(h, f.front, 14);
        P.anilha(o, add(add(h, f.front, 22.5), r, 27), 9);
        o.line(add(q, r, -4), add(q, r, 39), 'fg-eq', 3);
        P.estofado(o, add(add(h, f.front, 9.4), r, -2), add(add(h, f.front, 9.4), r, 36), 1.9);
        const om = add(J.sh, r, 4.8);
        o.line(add(om, f.front, 9), add(om, f.front, 4), 'fg-eq', 1.6);
        P.estofado(o, add(om, f.front, 4.5), add(om, f.back, 3.5), 2);
        o.line(add(J.handN, f.front, 7), J.handN, 'fg-eq', 1.4);
      } },
      { k: 'handle' },
    ],
  };
}

// Abdutora em pé (standing abductor), vista de costas, como a Standing Abductor da Movement e a da Booty Builder: a
// pessoa fica na plataforma, em meio agachamento, com o quadril um pouco para trás e as mãos no apoio da frente; as
// almofadas encostam por fora dos joelhos e os dois joelhos empurram para fora ao mesmo tempo, com os pés parados.
// Cada almofada fica num braço articulado junto da plataforma; as anilhas vão em pinos baixos, à frente, um de cada lado.
export function standingAbductor() {
  const top = 7;
  const pe = [L.hpw + 9, top + AK];
  const base = { hip: [X, top + AK + 34.1], lt: 0.82, arm: { a: 62, la: 0.2, b: 62, lb: 0.03 } };
  const perna = (la, lb) => ({ foot: pe, la, lb });
  const lados = (J) => [[J.knR, 1], [J.knL, -1]];
  const X0 = L.hpw + 3.8; // distância do joelho ao centro com as pernas fechadas
  return {
    view: 'back', label: 'Vista de costas: os joelhos empurram as almofadas para fora', maos: 'oculta',
    frames: [{ ...base, leg: perna(0.66, 0.95) }, { ...base, leg: perna(0.81, 0.91) }],
    equip: [
      { k: 'box', x0: -27, x1: 27, h: top },
      // apoio da frente (atrás do corpo, nesta vista): arco alto com a barra para as mãos
      { k: 'frame', pts: [[-18, top], [-15, 82], [15, 82], [18, top]], w: 2.2, z: 'back' },
      { k: 'frame', pts: [[-16, 60], [16, 60]], w: 1.6, z: 'back' },
      { k: 'fn', z: 'back', f: (o, J) => {
        for (const [kn, s] of lados(J)) {
          const sobe = Math.max(0, (Math.abs(kn[0] - X) - X0)) * 0.5; // as anilhas sobem um pouco quando as pernas abrem
          P.tubo(o, [[X + s * 19, 13 + sobe], [X + s * 33, 13 + sobe]], 1.5);
          for (const dx of [26.5, 29.4]) P.chapa(o, [X + s * dx, 13 + sobe], [0, 1], 7.5, 1.15, 'fg-rub');
          P.tubo(o, [[X + s * 9, top + 1.2], [kn[0] + s * 6.3, kn[1] - 8]], 1.8); // braço da almofada
          P.eixo(o, [X + s * 9, top + 1.2], 1.6);
        }
      } },
      { k: 'fn', f: (o, J) => { for (const [kn, s] of lados(J)) P.estofado(o, [kn[0] + s * 6.3, kn[1] - 8], [kn[0] + s * 6.3, kn[1] + 7], 2); } },
    ],
  };
}

// Puxada alta articulada de frente para o aparelho, como nos modelos nacionais (Movement Lat Pull, Total Health Front
// Pulldown, Natural Fitness, Cimerian): a pessoa senta virada para a coluna do aparelho, com as coxas presas sob o rolo.
// Cada braço da máquina é uma alavanca com o eixo na coluna da frente, mais ou menos na altura do queixo: a ponta de
// trás sobe até o pegador, acima e um pouco à frente da cabeça; a ponta da frente leva o pino das anilhas. Puxar o
// pegador faz ele descer em arco, de cima e da frente até o alto do peito, enquanto as anilhas sobem do outro lado.
export function frontLeverPulldown() {
  const hx = 84, hy = 26.5;
  const s = seated({ hx, hy, noBack: true });
  const t0 = -3, t1 = -8;
  const sh0 = shOf(s.hip, t0), sh1 = shOf(s.hip, t1);
  const m0 = [sh0[0] + 12, sh0[1] + 25];   // pegador no alto: braços estendidos para cima e um pouco para a frente
  const m1 = [sh1[0] + 8.5, sh1[1] + 1.5];    // pegador embaixo: à frente do alto do peito
  // o eixo fica à mesma distância das duas posições do pegador (sobre a mediatriz), 33 unidades à frente
  const meio = mix(m0, m1, 0.5), v = norm(sub(m1, m0));
  const PV = add(meio, [-v[1], v[0]], 33);
  const R = dist(m0, PV);
  const a0 = Math.atan2(m0[1] - PV[1], m0[0] - PV[0]), a1 = Math.atan2(m1[1] - PV[1], m1[0] - PV[0]) + 2 * Math.PI;
  const base = { hip: s.hip, leg: s.leg };
  const xr = hx + 15.5, yr = hy + 7; // rolo das coxas
  return {
    view: 'side', pega: 'pronada',
    frames: [0, 0.5, 1].map((k) => {
      const a = lerp(a0, a1, k);
      return { ...base, torso: lerp(t0, t1, k), arm: { hand: [PV[0] + R * Math.cos(a), PV[1] + R * Math.sin(a)] } };
    }),
    equip: [
      ...s.equip,
      sapata(hx + 15, PV[0] + 21),
      // coluna da frente com a escora e o braço do rolo das coxas
      { k: 'frame', pts: [[PV[0] + 3, CHAO], PV], w: 2.4, z: 'back' },
      { k: 'frame', pts: [[PV[0] + 18, CHAO], [PV[0] + 2, 31]], w: 1.8, z: 'back' },
      { k: 'frame', pts: [[PV[0] + 2, yr], [xr, yr]], w: 1.6, z: 'back' },
      { k: 'roller', at: [xr, yr], r: 3, z: 'front' },
      // alavanca dobrada: do pegador ao eixo e do eixo ao pino das anilhas
      { k: 'fn', f: (o, J) => {
        const h = J.handN;
        const ang = Math.atan2(h[1] - PV[1], h[0] - PV[0]) - 150 * D2R;
        const p = [PV[0] + 27 * Math.cos(ang), PV[1] + 27 * Math.sin(ang)];
        P.tubo(o, [h, PV, p], 2);
        P.anilha(o, p, 8);
        P.eixo(o, PV, 2.4);
      } },
      { k: 'handle' },
    ],
  };
}

// Panturrilha em pé no chão, com os dois pés: de frente para a parede, a um ou dois palmos dela, mãos apoiadas na altura
// do peito só para equilibrar. As pontas dos pés ficam paradas no chão; os calcanhares sobem devagar, com os joelhos
// estendidos, e descem até o chão.
export function calfRaiseFloor() {
  const ponta = [X + 6, 2.14];
  const mk = (fa) => {
    const an = ankleFromToe(ponta, fa);
    // o quadril fica sobre a parte da frente dos pés desde o começo: é ali que o peso se apoia quando os calcanhares sobem
    const hx = ponta[0] - 0.8;
    return { hip: [hx, an[1] + Math.sqrt(43.8 ** 2 - (hx - an[0]) ** 2)], torso: 3, leg: { foot: an, footAng: fa }, arm: { hand: [X + 15.6, 61] } };
  };
  return { view: 'side', frames: [mk(0), mk(19), mk(38)], equip: [{ k: 'wall', x: X + 18.3, top: 100, dir: 1 }] };
}

export const ANIMS_MAIS = {
  'supino-no-chao-halteres': [floorPress],
  'desenvolvimento-halteres-em-pe': [U.ohp, { seat: false }],
  'desenvolvimento-barra-sentado': [U.ohp, { tool: 'barbell' }],
  'elevacao-frontal-barra': [U.frontRaise, { tool: 'barbell' }],
  'abertura-elastico': [bandPullApart],
  'rotacao-interna-ombro-polia': [internalRotation],
  'rotacao-interna-ombro-elastico': [internalRotation, { tool: 'band' }],
  'rosca-arrastada-barra': [dragCurl],
  'rolo-de-punho': [wristRoller],
  'remada-cavalinho-apoio-peito': [chestTBarRow],
  'agachamento-landmine': [landmineSquat],
  'agachamento-parede-bola-suica': [ballWallSquat],
  'agachamento-fita-suspensao-trx': [suspensionSquat],
  'levantamento-terra-kettlebell': [kbDeadlift],
  'elevacao-pelvica-unilateral-banco': [singleLegHipThrust],
  'elevacao-joelhos-barra-fixa': [hangingKneeRaise],
  'ergometro-de-braco': [armErgometer],
  'arremesso-medicine-ball-parede': [wallBall],
  'agachamento-articulado': [vSquat],
  'agachamento-hack-invertido': [reverseHack],
  'abdutora-em-pe-maquina': [standingAbductor],
  'puxada-articulada-de-frente': [frontLeverPulldown],
  'panturrilha-em-pe-no-chao': [calfRaiseFloor],
};

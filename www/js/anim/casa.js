// Animações dos exercícios de treino em casa, sem aparelhos (peso do corpo e objetos da casa: parede, cadeira, mesa).
// Convenção: frames[0] = posição inicial descrita no exercício.
import { L } from './rig.js';
import { AK, H, X, D2R, foot, shOf, ankleFromToe } from './base.js';
import { P } from './equip.js';

const sin = (g) => Math.sin(g * D2R), cos = (g) => Math.cos(g * D2R);
const mat = (x0 = 50, x1 = 150) => ({ k: 'mat', x0, x1 });
const PERNA = L.thigh + L.shin - 0.1; // quadril ao tornozelo com o joelho estendido
const CORPO = PERNA + L.torso;        // tornozelo ao ombro, corpo em linha reta

// ---------- móveis da casa (desenho livre) ----------
// cadeira firme vista de lado: assento de x0 a x1, encosto na ponta "enc" ('x0' ou 'x1'); alt = altura do assento
function cadeira(o, x0, x1, { alt = 21.5, enc = 'x0', topo = 43 } = {}) {
  const xe = enc === 'x0' ? x0 : x1, xf = enc === 'x0' ? x1 : x0;
  const s = xe < xf ? 1 : -1;
  P.tubo(o, [[xf - s * 1.6, alt - 1.6], [xf - s * 0.6, P.CHAO]], 1.7);
  P.tubo(o, [[xe + s * 0.4, topo], [xe + s * 1.2, alt - 1], [xe + s * 0.4, P.CHAO]], 1.7);
  o.line([xe + s * 1.4, alt - 9], [xf - s * 1.2, alt - 9], 'fg-eq', 1.1);
  o.poly([[x0, alt - 2], [x1, alt - 2], [x1, alt], [x0, alt]], 'fg-cush');
  o.cap([xe + s * 0.5, topo - 9], [xe + s * 0.5, topo - 1], 1.5, 1.5, 'fg-cush');
}
// mesa firme vista de lado: tampo de x0 a x1 na altura alt; pés de lá no fundo e pés de cá por cima do corpo
const mesaFundo = (x0, x1, alt) => ({ k: 'fn', z: 'back', f: (o) => {
  P.tubo(o, [[x0 + 6.8, alt - 2], [x0 + 6.8, P.CHAO + 1]], 2, ' fg-far');
  P.tubo(o, [[x1 - 3.2, alt - 2], [x1 - 3.2, P.CHAO + 1]], 2, ' fg-far');
  o.poly([[x0, alt - 3], [x1, alt - 3], [x1, alt], [x0, alt]], 'fg-cush');
  o.line([x0 + 0.6, alt - 0.9], [x1 - 0.6, alt - 0.9], 'fg-cushhi', 0.5);
} });
const mesaFrente = (x0, x1, alt) => ({ k: 'fn', z: 'front', f: (o) => {
  P.tubo(o, [[x0 + 5, alt - 2.2], [x0 + 5, P.CHAO]], 2);
  P.tubo(o, [[x1 - 5, alt - 2.2], [x1 - 5, P.CHAO]], 2);
} });
// colchonete visto de cima (para os exercícios de bruços mostrados do alto)
const colchoneteDeCima = (x0, x1, y0, y1) => ({ k: 'fn', z: 'back', f: (o) => o.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 'fg-mat') });

// corpo em linha reta apoiado nos pés (ponta), com o ombro na altura shY
function pranchaEm(shY, tornozelo) {
  const th = Math.asin((shY - tornozelo[1]) / CORPO);
  const hip = [tornozelo[0] + PERNA * Math.cos(th), tornozelo[1] + PERNA * Math.sin(th)];
  return { hip, torso: 90 - th / D2R, leg: { foot: tornozelo, footAng: 90 } };
}

// ---------- PEITO E OMBROS ----------
// Flexão na parede: corpo reto, inclinado a partir dos tornozelos; as mãos ficam na parede na altura do peito.
export function flexaoParede() {
  const an = [70, AK];
  const pose = (g) => ({ hip: [an[0] + PERNA * sin(g), an[1] + PERNA * cos(g)], torso: g, head: -4, leg: { foot: an } });
  const A = pose(8), B = pose(21.5);
  const shA = shOf(A.hip, A.torso);
  const mao = [shA[0] + 28.6, shA[1] - 5];
  const arm = { hand: mao };
  const M = pose(15);
  return { view: 'side', frames: [{ ...A, arm }, { ...M, arm }, { ...B, arm }], equip: [{ k: 'wall', x: mao[0] + 2.7, top: 100, dir: 1 }] };
}

// Flexão de braços com elevação de perna: desce com os dois pés no chão; ao subir, uma perna estendida sai do chão.
export function flexaoElevacaoPerna() {
  const an = [54, 8];
  const alto = pranchaEm(32, an), fundo = pranchaEm(12.5, an);
  const arm = { hand: [122.5, 2.7] }, apoio = { foot: an, footAng: 90 }, sobe = { a: -80, b: -80 };
  const cima = { hip: alto.hip, torso: alto.torso, head: -18, arm }, baixo = { hip: fundo.hip, torso: fundo.torso, head: -18, arm, legN: apoio, legF: apoio };
  return {
    view: 'side', loop: true,
    frames: [{ ...cima, legN: apoio, legF: apoio }, baixo, { ...cima, legN: sobe, legF: apoio }, baixo, { ...cima, legN: apoio, legF: sobe }, baixo],
    equip: [],
  };
}

// Flexão pike: quadril alto (V invertido); os cotovelos dobram e a cabeça desce à frente das mãos.
export function flexaoPike() {
  const ponta = [75.5, 1.7];
  const pose = (fa, phi, incl, head) => {
    const an = ankleFromToe(ponta, fa);
    return { hip: [an[0] + PERNA * sin(phi), an[1] + PERNA * cos(phi)], torso: 90 + incl, head, leg: { foot: an, footAng: fa } };
  };
  const A = pose(50, 29, 50, 0);
  const shA = shOf(A.hip, A.torso);
  const mao = [shA[0] + 29.3 * cos(50), shA[1] - 29.3 * sin(50)];
  // os cotovelos abrem para trás e para fora (cerca de 45°): de lado, o braço aparece encurtado
  const arm = (la, lb) => ({ hand: mao, la, lb });
  const M = pose(58, 40, 49, -6);
  const B = pose(65, 50, 48, -12);
  return { view: 'side', frames: [{ ...A, arm: arm(1, 1) }, { ...M, arm: arm(0.78, 0.96) }, { ...B, arm: arm(0.5, 0.9) }], equip: [] };
}

// ---------- COSTAS ----------
// De bruços, visto de cima (a cabeça fica à direita). Na vista de costas com o corpo deitado, o braço e a perna "R"
// são os de baixo no desenho e os "L", os de cima.
const DE_CIMA = { hip: [92, 48], tilt: 90, legR: { a: -86, b: -88 }, legL: { a: 94, b: 92 } };
const deCima = (frames) => ({ view: 'back', floor: false, label: 'Vista de cima', frames, equip: [colchoneteDeCima(42, 136, 33, 63)] });

// Puxada de bruços: braços estendidos à frente; os cotovelos descem para junto das costelas (forma um "W").
export function puxadaDeBrucos() {
  const A = { ...DE_CIMA, armR: { a: 78, b: 80 }, armL: { a: 258, b: 260 } };
  const B = { ...DE_CIMA, armR: { a: -40, b: 72 }, armL: { a: 140, b: 252 } };
  return deCima([A, B]);
}

// Anjo invertido: de bruços, os braços saem do lado do corpo e fazem um arco aberto até acima da cabeça.
export function anjoInvertido() {
  const A = { ...DE_CIMA, armR: { a: -76, b: -72 }, armL: { a: 104, b: 108 } };
  const M = { ...DE_CIMA, armR: { a: 0, b: 4 }, armL: { a: 180, b: 184 } };
  const B = { ...DE_CIMA, armR: { a: 70, b: 74 }, armL: { a: 250, b: 254 } };
  return deCima([A, M, B]);
}

// Superman alternado: de bruços, sobe um braço e a perna do outro lado; troca.
export function supermanAlternado() {
  const base = { hip: [96, 8.6], torso: 91, head: -8 };
  const bracoChao = { a: 84, b: 84 }, bracoAlto = { a: 101, b: 103 };
  const pernaChao = { a: -91, b: -90 }, pernaAlta = { a: -98, b: -100 };
  const A = { ...base, armN: bracoChao, armF: bracoChao, legN: pernaChao, legF: pernaChao };
  return {
    view: 'side', loop: true,
    frames: [A, { ...base, armN: bracoAlto, armF: bracoChao, legN: pernaChao, legF: pernaAlta }, A, { ...base, armN: bracoChao, armF: bracoAlto, legN: pernaAlta, legF: pernaChao }],
    equip: [mat(40, 160)],
  };
}

// Remada invertida sob a mesa: deitado debaixo de uma mesa firme, cabeça e ombros para fora; as mãos seguram a borda.
export function remadaMesa() {
  const calc = [142, 5.2];
  const borda = 74, alt = 39;
  const mao = [borda - 0.4, alt - 3.8]; // o punho fecha em volta da borda do tampo
  const mk = (shY, la) => {
    const th = Math.asin((shY - calc[1]) / CORPO);
    return { hip: [calc[0] - PERNA * Math.cos(th), calc[1] + PERNA * Math.sin(th)], torso: -(90 - th / D2R), leg: { foot: calc, footAng: -55 }, arm: { hand: mao, la } };
  };
  return { view: 'side', pega: 'pronada', frames: [mk(10.6, 1), mk(19.5, 0.75), mk(28, 0.5)], equip: [mesaFundo(borda, borda + 62, alt), mesaFrente(borda, borda + 62, alt)] };
}

// ---------- PERNAS E GLÚTEOS ----------
const lerp = (a, b, t) => a + (b - a) * t;
const passos = (n) => Array.from({ length: n }, (_, i) => i / (n - 1));
const BRACO_SOLTO = { a: 0, b: 5 };
// mãos atrás da cabeça com os cotovelos abertos para os lados (de perfil o braço aparece encurtado); incl = inclinação do tronco
const maosNaNuca = (incl) => ({ a: 172 - incl, b: 255 - incl, la: 0.5, lb: 0.17 });
// pé de trás do afundo: ponta apoiada, calcanhar levantado
const peDeTras = (pontaX) => ({ foot: ankleFromToe([pontaX, 1.9], 62), footAng: 62 });

// Agachamento na cadeira: senta para trás até encostar de leve no assento e levanta.
export function agachamentoCadeira() {
  const leg = foot(X + 1);
  return {
    view: 'side', maos: 'solta',
    frames: [
      { hip: [X, H], torso: 3, leg, arm: { a: 8, b: 14 } },
      { hip: [X - 8, 38], torso: 22, leg, arm: { a: 48, b: 56 } },
      { hip: [X - 14, 28.2], torso: 33, leg, arm: { a: 78, b: 84 } },
    ],
    equip: [{ k: 'fn', z: 'back', f: (o) => cadeira(o, X - 30, X - 9) }],
  };
}

// Afundo reverso: um passo grande para trás, desce e volta.
export function afundoReverso() {
  const arm = BRACO_SOLTO;
  return {
    view: 'side',
    // o peso fica na perna da frente enquanto o pé de trás recua rente ao chão; só depois o corpo desce
    frames: [
      { hip: [X, H], torso: 2, legN: foot(X + 3), legF: foot(X), arm },
      { hip: [X, 39], torso: 11, legN: foot(X + 3), legF: { foot: ankleFromToe([X - 26, 1.9], 50), footAng: 50 }, arm },
      { hip: [X - 6, 27.5], torso: 10, legN: foot(X + 3), legF: peDeTras(X - 27), arm },
    ],
    equip: [],
  };
}

// Afundo à frente: um passo grande à frente, desce e empurra o chão para voltar.
export function afundoFrontal() {
  const arm = BRACO_SOLTO;
  return {
    view: 'side',
    frames: [
      { hip: [X - 22, H], torso: 2, legN: foot(X - 21), legF: foot(X - 22), arm },
      { hip: [X - 6, 38], torso: 5, legN: { foot: [X + 19, 4.4], footAng: -7 }, legF: { foot: ankleFromToe([X - 16, 1.9], 35), footAng: 35 }, arm },
      { hip: [X + 4, 27.5], torso: 8, legN: foot(X + 21), legF: peDeTras(X - 16), arm },
    ],
    equip: [],
  };
}

// Agachamento búlgaro com o pé de trás apoiado no assento de uma cadeira firme.
export function bulgaroCadeira() {
  const tras = { foot: [70, 24.7], footAng: 180 };
  const arm = BRACO_SOLTO;
  return {
    view: 'side', maos: 'solta',
    frames: [{ hip: [96, 44.6], torso: 6, legN: foot(112), legF: tras, arm }, { hip: [95, 30.5], torso: 16, legN: foot(112), legF: tras, arm }],
    equip: [{ k: 'fn', z: 'back', f: (o) => cadeira(o, 52, 73) }],
  };
}

// Bom-dia sem peso: mãos atrás da cabeça, o quadril vai para trás e o tronco desce reto.
export function bomDia() {
  const frames = passos(5).map((s) => ({ hip: [lerp(X - 1, 88, s), lerp(H, 45.4, s)], torso: lerp(2, 68, s), head: lerp(0, -14, s), leg: foot(X), arm: maosNaNuca(lerp(2, 68, s)) }));
  return { view: 'side', frames, equip: [] };
}

// Levantamento terra unilateral sem peso: tronco e perna de trás descem e sobem juntos, como uma gangorra.
export function terraUnilateral() {
  const frames = passos(5).map((s) => {
    const hip = [lerp(X - 1, X - 7, s), lerp(H, 46.6, s)], torso = lerp(2, 76, s);
    const sh = shOf(hip, torso);
    const hx = lerp(X + 4, X + 15, s), dx = hx - sh[0];
    return { hip, torso, head: lerp(0, -30, s), legN: foot(X), legF: { a: lerp(0, -70, s), b: lerp(-4, -66, s) }, arm: { hand: [hx, sh[1] - Math.sqrt(28.7 * 28.7 - dx * dx)] } };
  });
  return { view: 'side', frames, equip: [] };
}

// Ponte de glúteos com marcha: com o quadril no alto, tira um pé do chão de cada vez.
export function ponteMarcha() {
  const leg = foot(124);
  const arm = { a: 76, b: 83 };
  const chao = { hip: [100, 8.9], torso: -90, leg, arm };
  const alto = { hip: [101.5, 21], torso: -115.5, head: 24, arm };
  const sobe = { a: 205, b: 116 };
  return {
    view: 'side', loop: true,
    frames: [chao, { ...alto, leg }, { ...alto, legN: sobe, legF: leg }, { ...alto, leg }, { ...alto, legN: leg, legF: sobe }, { ...alto, leg }],
    equip: [mat(56, 134)],
  };
}

// Extensão de quadril em pé: mãos no encosto de uma cadeira, a perna vai estendida para trás.
export function extensaoQuadrilEmPe() {
  const base = { hip: [X, H], torso: 6, legF: foot(X), arm: { hand: [X + 13.5, 48.7] } };
  return {
    view: 'side', maos: 'aberta',
    frames: [{ ...base, legN: { a: 3, b: 0 } }, { ...base, legN: { a: -24, b: -26 } }],
    equip: [{ k: 'fn', z: 'back', f: (o) => cadeira(o, X + 13, X + 34, { topo: 46 }) }],
  };
}

// Panturrilha em um pé só, com as mãos na parede: o calcanhar sobe o máximo e desce devagar.
export function panturrilhaUnilateral() {
  const ponta = [X + 6, 2.14];
  const mk = (fa) => {
    const an = ankleFromToe(ponta, fa);
    return { hip: [an[0] + 1.2, an[1] + PERNA], torso: 3, legN: { foot: an, footAng: fa }, legF: { a: 10, b: -72 }, arm: { hand: [X + 15.6, 61] } };
  };
  return { view: 'side', frames: [mk(0), mk(19), mk(38)], equip: [{ k: 'wall', x: X + 18.3, top: 100, dir: 1 }] };
}

// Abdução de quadril em pé (vista de frente): uma mão no encosto de uma cadeira, a perna abre para o lado.
export function abducaoEmPe() {
  const base = { hip: [X, H], legL: { a: 3, b: 2 }, armL: { hand: [20, 48.6] }, armR: { a: 8, b: 14 } };
  return {
    view: 'front', label: 'Vista de frente',
    frames: [{ ...base, legR: { a: 3, b: 2 } }, { ...base, legR: { a: 32, b: 32 } }],
    // cadeira vista de frente, ao lado do corpo: encosto, assento e pés
    equip: [{ k: 'fn', z: 'back', f: (o) => {
      const cx = X - 21;
      for (const s of [-1, 1]) P.tubo(o, [[cx + s * 8, 46], [cx + s * 8, P.CHAO]], 1.7);
      o.cap([cx - 8, 44], [cx + 8, 44], 1.6, 1.6, 'fg-cush');
      o.cap([cx - 8, 36], [cx + 8, 36], 1.1, 1.1, 'fg-cush');
      o.poly([[cx - 9.5, 19.5], [cx + 9.5, 19.5], [cx + 9.5, 21.5], [cx - 9.5, 21.5]], 'fg-cush');
    } }],
  };
}

// ---------- ABDÔMEN E CORE ----------
const BRACO_NO_CHAO = { a: 76, b: 83 }; // deitado de costas: braço ao lado do corpo, mão espalmada no chão

// Tesoura: deitado de costas, as pernas estendidas sobem e descem alternadas, sem tocar o chão.
export function tesoura() {
  const base = { hip: [96, 8.9], torso: -90, arm: BRACO_NO_CHAO };
  const baixa = { a: 96, b: 96 }, alta = { a: 119, b: 118 };
  return { view: 'side', loop: true, frames: [{ ...base, legN: alta, legF: baixa }, { ...base, legN: baixa, legF: alta }], equip: [mat(44, 152)] };
}

// Toque nos calcanhares: ombros fora do chão; o tronco inclina para um lado e a mão desse lado avança até o calcanhar.
export function toqueCalcanhares() {
  const base = { hip: [104, 9.4], torso: -77, head: 10, leg: foot(123) };
  const perto = { hand: [103.5, 5.6] };
  const alcanca = { hand: [110.6, 4.2], la: 1.17, lb: 1.17 }; // o ombro desse lado desce junto com a inclinação do tronco
  const A = { ...base, armN: perto, armF: perto };
  return {
    view: 'side', loop: true, label: 'O tronco inclina para o lado da mão que avança',
    frames: [A, { ...base, armN: alcanca, armF: perto }, A, { ...base, armN: perto, armF: alcanca }],
    equip: [mat(54, 140)],
  };
}

// Toque nos pés com as pernas na vertical: enrola o tronco e as mãos sobem pelas pernas em direção aos tornozelos.
export function toqueNosPes() {
  const leg = { a: 178, b: 178 };
  return {
    view: 'side',
    frames: [
      { hip: [100, 9.2], torso: -90, leg, arm: { hand: [95.6, 23.3] } },
      { hip: [100, 10.4], torso: -62, head: 8, leg, arm: { hand: [96.6, 43.6] } },
    ],
    equip: [mat(54, 124)],
  };
}

// Prancha reversa: de barriga para cima, apoio nas mãos e nos calcanhares, corpo em linha reta.
export function pranchaReversa() {
  const calc = [146, 5.2];
  const th = 21.5;
  const base = { hip: [calc[0] - PERNA * cos(th), calc[1] + PERNA * sin(th)], torso: -(90 - th), leg: { foot: calc, footAng: -35 }, arm: { hand: [87, 2.7] } };
  // dedos apontando para os pés
  const maos = { m: 'aberta', O: [87, 0], s: [1, 0], n: [0, 1], h: 2.7 };
  return { view: 'side', slow: true, maos, frames: [base, { ...base, hip: [base.hip[0], base.hip[1] + 0.6] }], equip: [] };
}

// Prancha com elevação de perna: prancha nos antebraços; uma perna estendida sobe até a altura do quadril, alternando.
export function pranchaElevacaoPerna() {
  const base = { hip: [100.3, 14.6], torso: 80, head: -10, arm: { a: 0, b: 90 } };
  const apoio = { foot: [57, 8], footAng: 90 }, alta = { a: -91, b: -91 };
  const A = { ...base, legN: apoio, legF: apoio };
  return { view: 'side', loop: true, frames: [A, { ...base, legN: alta, legF: apoio }, A, { ...base, legN: apoio, legF: alta }], equip: [mat(46, 154)] };
}

// Prancha sobe e desce: da prancha alta (mãos) para a prancha nos antebraços, um braço de cada vez, e de volta.
export function pranchaSobeDesce() {
  const an = [54, 8];
  const mao = { hand: [122.5, 2.7] }, antebraco = { hand: [138, 3.8] };
  const alta = pranchaEm(32, an), meio = pranchaEm(24, an), baixa = pranchaEm(19.3, an);
  const cab = { head: -16 };
  return {
    view: 'side', loop: true,
    frames: [
      { ...alta, ...cab, armN: mao, armF: mao },
      { ...meio, ...cab, armN: antebraco, armF: mao },
      { ...baixa, ...cab, armN: { a: 0, b: 90 }, armF: { a: 0, b: 90 } },
      { ...meio, ...cab, armN: mao, armF: antebraco },
    ],
    equip: [],
  };
}

// Urso isométrico: em quatro apoios, pontas dos pés no chão; os joelhos saem só um pouco do chão e ficam parados.
export function ursoIsometrico() {
  const pe = { foot: [63.8, 8], footAng: 90 }, arm = { hand: [111.8, 2.8] };
  return {
    view: 'side', slow: true,
    frames: [{ hip: [84, 26.6], torso: 78.2, head: -20, leg: pe, arm }, { hip: [84.5, 28.8], torso: 83, head: -20, leg: pe, arm }],
    equip: [],
  };
}

// ---------- CONDICIONAMENTO ----------
// apoio na ponta do pé (corrida parada): hip logo acima
const naPonta = (fa = 28) => ({ foot: ankleFromToe([X + 6, 1.9], fa), footAng: fa });
const BRACO_FRENTE = { a: 40, b: 120 }, BRACO_TRAS = { a: -36, b: 44 };

// Corrida parada com joelho alto: corre no lugar levando o joelho até a altura do quadril.
export function joelhoAlto() {
  const base = { hip: [X, H + 1.3], torso: 4 };
  const sobe = { a: 86, b: -2 };
  return {
    view: 'side', loop: true, fast: true,
    frames: [{ ...base, legN: sobe, legF: naPonta(), armN: BRACO_TRAS, armF: BRACO_FRENTE }, { ...base, legN: naPonta(), legF: sobe, armN: BRACO_FRENTE, armF: BRACO_TRAS }],
    equip: [],
  };
}

// Corrida parada com calcanhar no glúteo: corre no lugar levando o calcanhar para trás, até perto do glúteo.
export function calcanharNoGluteo() {
  const base = { hip: [X, H + 1.3], torso: 5 };
  const dobra = { a: 3, b: -128 };
  return {
    view: 'side', loop: true, fast: true,
    frames: [{ ...base, legN: dobra, legF: naPonta(), armN: BRACO_FRENTE, armF: BRACO_TRAS }, { ...base, legN: naPonta(), legF: dobra, armN: BRACO_TRAS, armF: BRACO_FRENTE }],
    equip: [],
  };
}

// Marcha parada: caminha no lugar, sempre com um pé no chão; o braço oposto acompanha.
export function marchaParada() {
  const base = { hip: [X, H], torso: 2 };
  const sobe = { a: 62, b: -6 }, chao = foot(X);
  const bF = { a: 30, b: 78 }, bT = { a: -20, b: 30 }, bM = { a: 4, b: 40 };
  return {
    view: 'side', loop: true,
    frames: [
      { ...base, legN: sobe, legF: chao, armN: bT, armF: bF },
      { ...base, legN: chao, legF: chao, armN: bM, armF: bM },
      { ...base, legN: chao, legF: sobe, armN: bF, armF: bT },
      { ...base, legN: chao, legF: chao, armN: bM, armF: bM },
    ],
    equip: [],
  };
}

// Afundo com salto alternado: do afundo, salta e troca as pernas no ar; cai já no afundo do outro lado.
export function afundoSalto() {
  const frente = foot(114), tras = peDeTras(76);
  const baixo = { hip: [97, 27.5], torso: 9 };
  const ar = { hip: [97, H + 7], torso: 3, armN: { a: 8, b: 78 }, armF: { a: 8, b: 78 } };
  const arN = { foot: [103, AK + 8.5], footAng: 24 }, arF = { foot: [92, AK + 9.5], footAng: 34 };
  return {
    view: 'side', loop: true,
    frames: [
      { ...baixo, legN: frente, legF: tras, armN: BRACO_TRAS, armF: BRACO_FRENTE },
      { ...ar, legN: arN, legF: arF },
      { ...baixo, legN: tras, legF: frente, armN: BRACO_FRENTE, armF: BRACO_TRAS },
      { ...ar, legN: arF, legF: arN },
    ],
    equip: [],
  };
}

// Polichinelo sem salto (vista de frente): um passo para o lado de cada vez, com os braços subindo pelos lados.
export function polichineloSemSalto() {
  const junto = { hip: [X, H], arm: { a: 8, b: 10 }, leg: { foot: [5.6, AK] } };
  const alto = { a: 160, b: 168 };
  return {
    view: 'front', label: 'Vista de frente',
    loop: true,
    frames: [
      junto,
      { hip: [X + 5, H - 2], arm: alto, legR: { foot: [17, AK] }, legL: { foot: [10.6, AK] } },
      junto,
      { hip: [X - 5, H - 2], arm: alto, legR: { foot: [10.6, AK] }, legL: { foot: [17, AK] } },
    ],
    equip: [],
  };
}

// Salto lateral alternado (vista de frente): salta de um pé para o outro, amortecendo com o joelho; a perna livre fica fora do chão.
export function saltoLateral() {
  const cai = (s) => {
    const apoio = { foot: [3.5, AK], la: 0.86, lb: 0.88 }, livre = { a: 46, b: 53 };
    const cruza = { hand: [-5, 45], la: 0.8, lb: 0.8 }, solto = { a: 22, b: 12 };
    return s > 0
      ? { hip: [X + 17, 40], tilt: 6, lt: 0.9, legR: apoio, legL: livre, armL: cruza, armR: solto }
      : { hip: [X - 17, 40], tilt: -6, lt: 0.9, legL: apoio, legR: livre, armR: cruza, armL: solto };
  };
  const voo = { hip: [X, 54], leg: { a: 16, b: 10 }, arm: { a: 16, b: 22 } };
  return { view: 'front', label: 'Vista de frente', loop: true, frames: [cai(1), voo, cai(-1), voo], equip: [] };
}

// Caminhada da minhoca: dobra o tronco, caminha com as mãos até a prancha, faz uma flexão e volta do mesmo jeito.
export function minhoca() {
  const ponta = [76.1, 1.9];
  const pe = (fa) => (fa ? { foot: ankleFromToe(ponta, fa), footAng: fa } : foot(70));
  const perna = (fa, phi) => { const an = pe(fa).foot; return [an[0] + PERNA * sin(phi), an[1] + PERNA * cos(phi)]; };
  const an90 = pe(90).foot;
  const prancha = pranchaEm(32, an90), fundo = pranchaEm(12.5, an90);
  const mao = { hand: [146.4, 2.7] };
  return {
    view: 'side', long: true,
    frames: [
      { hip: [70.6, H], torso: 2, leg: pe(0), arm: { a: 2, b: 8 } },
      { hip: [66, 46.5], torso: 135, head: -6, leg: pe(0), arm: { hand: [97, 2.7] } },
      { hip: perna(40, 38), torso: 115, head: -10, leg: pe(40), armN: { hand: [128, 2.7] }, armF: { hand: [122, 2.7] } },
      { ...prancha, leg: pe(90), head: -18, arm: mao },
      { ...fundo, leg: pe(90), head: -18, arm: mao },
    ],
    equip: [],
  };
}

export const ANIMS_CASA = {
  'tesoura-abdominal': [tesoura],
  'toque-nos-calcanhares': [toqueCalcanhares],
  'toque-nos-pes-pernas-elevadas': [toqueNosPes],
  'prancha-reversa': [pranchaReversa],
  'prancha-elevacao-perna': [pranchaElevacaoPerna],
  'prancha-sobe-desce': [pranchaSobeDesce],
  'urso-isometrico': [ursoIsometrico],
  'corrida-parada-joelho-alto': [joelhoAlto],
  'corrida-parada-calcanhar-gluteo': [calcanharNoGluteo],
  'marcha-parada': [marchaParada],
  'afundo-salto-alternado': [afundoSalto],
  'polichinelo-sem-salto': [polichineloSemSalto],
  'salto-lateral-alternado': [saltoLateral],
  'caminhada-minhoca': [minhoca],
  'agachamento-na-cadeira': [agachamentoCadeira],
  'afundo-reverso-peso-corporal': [afundoReverso],
  'afundo-frontal-peso-corporal': [afundoFrontal],
  'agachamento-bulgaro-cadeira': [bulgaroCadeira],
  'bom-dia-peso-corporal': [bomDia],
  'levantamento-terra-unilateral-peso-corporal': [terraUnilateral],
  'ponte-gluteos-marcha': [ponteMarcha],
  'extensao-quadril-em-pe': [extensaoQuadrilEmPe],
  'panturrilha-unilateral-apoio-parede': [panturrilhaUnilateral],
  'abducao-quadril-em-pe': [abducaoEmPe],
  'flexao-na-parede': [flexaoParede],
  'flexao-pike': [flexaoPike],
  'flexao-de-bracos-elevacao-perna': [flexaoElevacaoPerna],
  'puxada-de-brucos': [puxadaDeBrucos],
  'anjo-invertido': [anjoInvertido],
  'superman-alternado': [supermanAlternado],
  'remada-invertida-sob-mesa': [remadaMesa],
};

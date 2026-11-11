// Desenho do corpo humano no padrão dos atlas de treino: corpo inteiro à mostra, com cada grupo
// muscular na sua forma (os que trabalham ficam em vermelho ou laranja), rosto, cabelo e tênis,
// em vista lateral e frontal/costas. Não há roupa cobrindo músculo nenhum.
// A figura é neutra: proporções intermediárias entre o corpo masculino e o feminino (ombros só um pouco
// mais largos que o quadril, tórax sem volume marcado, pescoço e mandíbula suaves) e cabelo curto e arredondado, sem costeleta nem comprimento (um corte que serve a qualquer pessoa).
// Coordenadas locais de cada segmento: f = fração ao longo do osso (0 = início, 1 = fim), w = afastamento
// lateral em unidades (positivo = frente do corpo na vista lateral; lado de fora na vista frontal).
// 1 unidade ≈ 2 cm. As larguras seguem medidas de um adulto atlético de ~1,84 m (antropometria de
// Drillis e Contini e tabelas de circunferência): coxa ~21 cm de profundidade, panturrilha ~14 cm,
// braço ~13 cm, antebraço ~10 cm, punho ~6 cm, tórax ~29 cm, cintura ~21 cm, pé ~27 cm.
// Cada parte do corpo (braço, perna, tronco + cabeça) é desenhada como um grupo de contorno único:
// as formas se fundem numa silhueta só, sem emendas nas articulações. Os músculos da bacia são
// recortados pela silhueta, então nunca passam do contorno, em nenhuma pose.
import { L, add, sub } from './geom.js';
import { maoBase, maoDetalhe, dedosNoCabo } from './maos.js';

const PUNHO_PADRAO = { m: 'punho' };

const cls = (act, m) => {
  const v = Array.isArray(m) ? Math.max(...m.map((k) => act[k] || 0)) : act[m] || 0;
  return v === 2 ? 'fg-m1' : v === 1 ? 'fg-m2' : 'fg-m0';
};
const isOn = (act, m) => (Array.isArray(m) ? m.some((k) => act[k]) : !!act[m]);

function frameOf(a, b) {
  const v = sub(b, a);
  const len = Math.hypot(v[0], v[1]);
  const d = len > 1e-6 ? [v[0] / len, v[1] / len] : [0, -1];
  const nf = [-d[1], d[0]];
  const P = (f, w) => [a[0] + d[0] * len * f + nf[0] * w, a[1] + d[1] * len * f + nf[1] * w];
  P.len = len; P.d = d; P.nf = nf;
  return P;
}
function blob(o, P, pts, c, flip = 1) {
  o.smooth(pts.map(([f, w]) => P(f, w * flip)), c);
}
// contorno de um membro: perfil da frente, perfil de trás e pontas arredondadas
function limb(o, P, front, back, capA, capB, c, flip = 1) {
  const len = Math.max(P.len, 0.01);
  if (P.len < 0.6) { o.circ(P(0, 0), Math.max(front[1][1], back[1][1]) * 0.92, c); return; }
  const pts = [P(-capA / len, 0)];
  for (const [f, w] of front) pts.push(P(f, w * flip));
  pts.push(P(1 + capB / len, 0));
  for (let i = back.length - 1; i >= 0; i--) pts.push(P(back[i][0], -back[i][1] * flip));
  o.smooth(pts, c);
}
// largura do perfil numa fração qualquer do osso
function larguraEm(perfil, f) {
  if (f <= perfil[0][0]) return perfil[0][1];
  for (let i = 1; i < perfil.length; i++) {
    if (f <= perfil[i][0]) { const [f0, w0] = perfil[i - 1], [f1, w1] = perfil[i]; return w0 + ((w1 - w0) * (f - f0)) / (f1 - f0); }
  }
  return perfil[perfil.length - 1][1];
}
// parte de cima de um membro, do início até a barra da roupa (mesmo perfil da pele)
function manga(o, P, front, back, capA, barra, flip = 1) {
  const len = Math.max(P.len, 0.01);
  if (P.len < 0.6) { o.circ(P(0, 0), Math.max(front[1][1], back[1][1]) * 0.92); return; }
  const pts = [P(-capA / len, 0)];
  for (const [f, w] of front) if (f < barra) pts.push(P(f, w * flip));
  pts.push(P(barra, larguraEm(front, barra) * flip));
  pts.push(P(barra, -larguraEm(back, barra) * flip));
  for (let i = back.length - 1; i >= 0; i--) if (back[i][0] < barra) pts.push(P(back[i][0], -back[i][1] * flip));
  o.smooth(pts);
}

// ---------- perfis (meia-largura de cada segmento) ----------
export const UP_F = [[0.02, 2.9], [0.34, 3.3], [0.7, 2.8], [0.98, 2.3]];
export const UP_B = [[0.02, 3.0], [0.3, 3.4], [0.7, 2.8], [0.98, 2.4]];
export const FO_F = [[0.03, 2.3], [0.26, 2.7], [0.7, 1.9], [0.98, 1.5]];
export const FO_B = [[0.03, 2.4], [0.26, 2.5], [0.7, 1.8], [0.98, 1.5]];
export const TH_F = [[0.02, 5.2], [0.3, 5.6], [0.7, 4.4], [0.98, 3.5]];
export const TH_B = [[0.02, 5.9], [0.3, 5.4], [0.7, 4.1], [0.98, 3.3]];
export const SH_F = [[0.02, 3.5], [0.3, 3.0], [0.8, 2.1], [0.98, 1.9]];
export const SH_B = [[0.02, 3.3], [0.28, 4.2], [0.6, 3.0], [0.85, 2.0], [0.98, 1.9]];
const BARRA = 0.42; // até onde o calção cobre a coxa

// tronco e bacia de lado (a = ombro, b = quadril; w positivo = frente)
export const TRONCO = [
  [-0.07, 1.3], [0.0, 4.0], [0.12, 6.1], [0.26, 6.8], [0.4, 6.4], [0.55, 5.5], [0.75, 5.0], [0.92, 5.0], [1.05, 4.5],
  [1.18, 1.9], [1.25, -2.4], [1.22, -6.2], [1.08, -8.7], [0.94, -7.8], [0.79, -5.9], [0.6, -5.7], [0.4, -6.8],
  [0.22, -7.7], [0.07, -6.8], [-0.07, -4.4], [-0.12, -1.6],
];
// parte da bacia coberta pelo calção: os mesmos pontos do tronco, do cós para baixo
const BACIA = [[0.86, 5.0], [0.92, 5.0], [1.05, 4.5], [1.18, 1.9], [1.25, -2.4], [1.22, -6.2], [1.08, -8.7], [0.94, -7.8], [0.85, -6.5], [0.85, 0]];

// ---------- VISTA LATERAL ----------
// g = pegada da mão (anim/maos.js); mao = centro da pegada; des = deslocamento do lado de lá
function armSkinSide(o, sh, el, wr, hd, far, g = PUNHO_PADRAO, mao = null, des = null) {
  const U = frameOf(sh, el);
  const F = frameOf(el, wr);
  if (des && g.O) g = { ...g, O: add(g.O, des) };
  o.begin(far ? 'fg-skf' : 'fg-sk');
  o.circ(sh, 3.4);
  limb(o, U, UP_F, UP_B, 3.0, 2.2);
  limb(o, F, FO_F, FO_B, 2.2, 1.0);
  // mão de perfil (braço na horizontal): a palma fica voltada para baixo
  const lado = g.perfil ? (hd[0] >= 0 ? -1 : 1) : 1;
  maoBase(o, wr, hd, g, lado, !!g.perfil);
  o.end();
  maoDetalhe(o, wr, hd, g, lado, !!g.perfil, far);
  // a mão de lá fecha os dedos sobre o objeto dela, que já foi desenhado na camada de fundo
  if (far && g.m === 'eixo' && mao) dedosNoCabo(o, mao, g.u, hd, 1, true);
  return { U, F };
}
function armMuscSide(o, sh, U, F, act, far) {
  const fx = far ? ' fg-far' : '';
  if (U.len > 2) {
    if (!far || isOn(act, 'biceps')) blob(o, U, [[0.24, 0.4], [0.3, 2.6], [0.5, 3.0], [0.78, 2.4], [0.93, 1.3], [0.6, 0.4]], cls(act, 'biceps') + fx);
    if (!far || isOn(act, 'triceps')) blob(o, U, [[0.12, -0.4], [0.24, -2.8], [0.45, -3.1], [0.75, -2.4], [0.95, -1.6], [0.6, -0.3]], cls(act, 'triceps') + fx);
  }
  if (F.len > 2 && (!far || isOn(act, 'antebraco'))) {
    blob(o, F, [[0.03, 0.2], [0.12, 2.3], [0.34, 2.5], [0.72, 1.6], [0.74, -1.5], [0.32, -2.3], [0.1, -2.1]], cls(act, 'antebraco') + fx);
  }
  // deltoide (parte da frente e parte de trás), sempre com tamanho real mesmo com o braço encurtado
  const D = frameOf(sh, add(sh, U.d, L.upper));
  const dA = ['deltoide_ant', 'deltoide_lat'];
  const dP = ['deltoide_post', 'deltoide_lat'];
  if (!far && cls(act, dA) === cls(act, dP)) {
    blob(o, D, [[-0.19, 0], [-0.14, 2.8], [0.06, 3.5], [0.3, 2.6], [0.46, 0], [0.3, -2.6], [0.06, -3.5], [-0.14, -2.8]], cls(act, dA));
  } else if (!far) {
    blob(o, D, [[-0.19, 0.15], [-0.14, 2.8], [0.06, 3.5], [0.3, 2.6], [0.44, 0.3], [0.1, 0.15]], cls(act, dA));
    blob(o, D, [[-0.19, -0.15], [-0.14, -2.8], [0.06, -3.5], [0.3, -2.6], [0.44, -0.3], [0.1, -0.15]], cls(act, dP));
  } else if (isOn(act, [...dA, 'deltoide_post'])) {
    blob(o, D, [[-0.19, 0], [-0.14, 2.8], [0.06, 3.5], [0.3, 2.6], [0.44, 0], [0.3, -2.6], [0.06, -3.5], [-0.14, -2.8]], cls(act, [...dA, 'deltoide_post']) + fx);
  }
}

function legSkinSide(o, hip, kn, an, fd, fu, far) {
  const T = frameOf(hip, kn);
  const S = frameOf(kn, an);
  o.begin(far ? 'fg-skf' : 'fg-sk');
  limb(o, T, TH_F, TH_B, 4.8, 3.3);
  limb(o, S, SH_F, SH_B, 3.2, 1.6);
  o.end();
  // Tênis. Coordenadas locais do pé: x para a ponta, y para cima a partir do tornozelo; a sola fica em y = -3,5.
  // O pé tem ~27 cm: do calcanhar (-3,6) até a ponta dos dedos (+9,9). Os dedos dobram na "bola do pé"
  // (x = 6,1): quando o calcanhar sobe com a ponta apoiada, eles continuam deitados no chão.
  const Fp = (x, y) => [an[0] + fd[0] * x + fu[0] * y, an[1] + fd[1] * x + fu[1] * y];
  const bola = Fp(6.1, -3.5);
  let td = fd, tu = fu;
  if (fd[1] < -0.02 && bola[1] < 1.6) { td = [fd[0] >= 0 ? 1 : -1, 0]; tu = [0, fu[1] < 0 ? -1 : 1]; }
  const Tp = (x, y) => [bola[0] + td[0] * x + tu[0] * y, bola[1] + td[1] * x + tu[1] * y];
  o.begin(far ? 'fg-shoef' : 'fg-shoe');
  o.smooth([Fp(-3.6, -0.6), Fp(-3.4, -2.9), Fp(-2.6, -3.5), Fp(1, -3.5), Fp(6.6, -3.5), Fp(7.0, -1.4), Fp(5.4, -0.3), Fp(3.1, 0.9), Fp(2.1, 2.3), Fp(-2.2, 2.2)]);
  o.smooth([Tp(-1.0, 0), Tp(2.9, 0), Tp(3.7, 0.5), Tp(3.6, 1.4), Tp(2.4, 2.2), Tp(0.4, 3.0), Tp(-1.0, 2.9)]);
  o.end();
  o.smooth([Fp(-3.4, -2.6), Fp(-2.7, -3.45), Fp(2, -3.5), Fp(6.2, -3.5), Fp(6.0, -2.7), Fp(1, -2.7)], far ? 'fg-solef' : 'fg-sole');
  o.smooth([Tp(-0.4, 0), Tp(2.9, 0), Tp(3.6, 0.5), Tp(2.6, 0.75), Tp(-0.4, 0.8)], far ? 'fg-solef' : 'fg-sole');
  return { T, S };
}
function legMuscSide(o, T, S, act, far) {
  const fx = far ? ' fg-far' : '';
  if (T.len > 3) {
    if (!far || isOn(act, 'quadriceps')) blob(o, T, [[0.08, 0.7], [0.12, 4.4], [0.35, 5.2], [0.7, 4.1], [0.94, 3.1], [0.95, 1.1], [0.5, 0.1]], cls(act, 'quadriceps') + fx);
    if (!far || isOn(act, 'posteriores')) blob(o, T, [[0.17, -0.8], [0.2, -4.9], [0.4, -4.9], [0.7, -3.8], [0.93, -2.9], [0.9, -0.9], [0.5, -0.5]], cls(act, 'posteriores') + fx);
  }
  if (S.len > 3) {
    if (!far || isOn(act, 'panturrilhas')) blob(o, S, [[0.03, -0.7], [0.08, -3.1], [0.28, -3.9], [0.5, -3.1], [0.7, -1.8], [0.6, -0.6], [0.3, -0.4]], cls(act, 'panturrilhas') + fx);
    if (!far || isOn(act, 'tibial')) blob(o, S, [[0.08, 0.7], [0.1, 2.7], [0.4, 2.6], [0.72, 1.8], [0.6, 0.6]], cls(act, 'tibial') + fx);
  }
}

function torsoSide(o, J, act) {
  const T = frameOf(J.sh, J.hip);
  const hup = J.hup;
  const hfr = [hup[1], -hup[0]];
  const Hp = (x, y) => [J.head[0] + hfr[0] * (x * 0.88 + 0.3) + hup[0] * (y * 0.97 + 1.1), J.head[1] + hfr[1] * (x * 0.88 + 0.3) + hup[1] * (y * 0.97 + 1.1)];
  o.begin('fg-sk');
  blob(o, T, TRONCO);
  // pescoço e cabeça (perfil com testa, nariz, lábios e queixo)
  o.cap(T(-0.04, -1.2), Hp(-1.0, -3.6), 2.7, 2.3);
  o.smooth([
    Hp(0.4, 6.5), Hp(3.6, 5.6), Hp(5.1, 3.6), Hp(5.3, 2.0), Hp(5.3, 1.0), Hp(6.5, -0.7), Hp(5.6, -1.4), Hp(5.7, -2.3),
    Hp(5.4, -3.1), Hp(5.0, -4.3), Hp(3.9, -5.3), Hp(1.8, -5.1), Hp(0.0, -4.3), Hp(-2.4, -4.6), Hp(-4.9, -3.0),
    Hp(-6.1, 0.6), Hp(-5.2, 4.3), Hp(-2.6, 6.2),
  ]);
  o.end();
  // cabelo curto e arredondado, orelha e rosto
  o.smooth([
    Hp(0.5, 6.9), Hp(3.7, 6.0), Hp(5.3, 4.3), Hp(5.5, 3.0), Hp(4.4, 3.3), Hp(3.0, 3.1), Hp(1.6, 2.2), Hp(0.5, 1.3),
    Hp(-0.9, 1.2), Hp(-2.0, 0.2), Hp(-2.6, -1.6), Hp(-3.6, -3.1), Hp(-5.3, -2.4), Hp(-6.5, 0.8), Hp(-5.5, 4.7), Hp(-2.6, 6.7),
  ], 'fg-hair');
  o.smooth([Hp(-1.5, 0.5), Hp(-0.3, 0.9), Hp(0.4, 0.0), Hp(-0.1, -1.4), Hp(-1.0, -1.6), Hp(-1.5, -0.6)], 'fg-ear');
  o.circ(Hp(4.15, 1.15), 0.52, 'fg-eye');
  o.open([Hp(3.4, 2.3), Hp(4.2, 2.5), Hp(4.9, 2.35)], 'fg-ln', 0.45);
  o.open([Hp(4.6, -2.75), Hp(5.6, -2.7)], 'fg-ln', 0.4);
  // músculos do tronco
  blob(o, T, [[0.03, 2.0], [0.06, 5.0], [0.2, 6.2], [0.36, 5.9], [0.43, 4.2], [0.3, 2.0]], cls(act, 'peito'));
  blob(o, T, [[0.46, 2.4], [0.47, 5.3], [0.65, 4.8], [0.85, 4.6], [0.98, 4.2], [0.97, 2.3], [0.7, 1.9]], cls(act, 'abdomen'));
  blob(o, T, [[0.5, 1.5], [0.5, -1.3], [0.7, -1.8], [0.93, -1.5], [0.95, 1.6], [0.7, 1.2]], cls(act, 'obliquos'));
  blob(o, T, [[0.05, -2.5], [0.08, -6.2], [0.25, -7.1], [0.45, -6.2], [0.6, -4.9], [0.57, -2.1], [0.3, -1.5]], cls(act, ['dorsais', 'costas_superior']));
  blob(o, T, [[0.62, -2.4], [0.63, -5.0], [0.8, -5.3], [0.93, -6.2], [0.93, -3.0], [0.8, -2.4]], cls(act, 'lombar'));
  blob(o, T, [[-0.12, -1.0], [-0.1, -3.5], [0.03, -5.6], [0.1, -3.3], [0.03, -1.0]], cls(act, 'trapezio'));
  return T;
}

export function drawSide(o, J, act, pg = null) {
  const far = [1.8, 1.0];
  const fo = (p) => add(p, far);
  // braço e perna do lado de lá
  const fa = armSkinSide(o, fo(J.sh), fo(J.elF), fo(J.wrF), J.hdF, true, pg ? pg.F : PUNHO_PADRAO, fo(J.handF), far);
  armMuscSide(o, fo(J.sh), fa.U, fa.F, act, true);
  const fl = legSkinSide(o, fo(J.hip), fo(J.knF), fo(J.anF), J.fdF, J.fuF, true);
  legMuscSide(o, fl.T, fl.S, act, true);
  // tronco, pescoço e cabeça
  const T = torsoSide(o, J, act);
  // perna do lado de cá, com os músculos da coxa, da perna e o glúteo (recortado pela silhueta)
  const nl = legSkinSide(o, J.hip, J.knN, J.anN, J.fdN, J.fuN, false);
  legMuscSide(o, nl.T, nl.S, act, false);
  o.recorte('cc', () => { blob(o, T, TRONCO); limb(o, nl.T, TH_F, TH_B, 4.8, 3.3); });
  o.dentroDe('cc', () => blob(o, T, [[0.9, -2.6], [0.93, -6.6], [1.07, -8.0], [1.2, -5.9], [1.22, -2.6], [1.08, -1.2]], cls(act, 'gluteos')));
  // braço do lado de cá
  const na = armSkinSide(o, J.sh, J.elN, J.wrN, J.hdN, false, pg ? pg.N : PUNHO_PADRAO);
  armMuscSide(o, J.sh, na.U, na.F, act, false);
}

// ---------- VISTA FRONTAL / COSTAS ----------
const A_UP = [[0.02, 2.9], [0.4, 3.2], [0.98, 2.4]];
const A_FO = [[0.03, 2.5], [0.26, 2.8], [0.7, 1.9], [0.98, 1.5]];
const F_TH_O = [[0.02, 5.4], [0.3, 5.7], [0.7, 4.5], [0.98, 3.6]];
const F_TH_I = [[0.02, 4.6], [0.3, 4.8], [0.7, 3.9], [0.98, 3.4]];
const F_SH_O = [[0.02, 3.6], [0.28, 3.9], [0.7, 2.5], [0.98, 1.9]];
const F_SH_I = [[0.02, 3.4], [0.28, 3.5], [0.7, 2.3], [0.98, 1.9]];
// tronco de frente: x = afastamento do centro, f = fração do quadril (0) ao peito (1)
const TRONCO_F = [[2.4, 1.17], [5.8, 1.1], [10.3, 1.03], [10.0, 0.82], [9.2, 0.62], [7.9, 0.36], [8.9, 0.13], [9.6, -0.04], [5.6, -0.22], [0, -0.3]];
const BACIA_F = [[0, 0.17], [8.5, 0.17], [8.6, 0.13], [9.4, -0.04], [5.6, -0.22], [0, -0.3]];

export function drawFront(o, J, act, isBack, pg = null) {
  const { hc, up, rt, chest } = J;
  const tl = Math.hypot(chest[0] - hc[0], chest[1] - hc[1]);
  // Elevação de cada ombro: a que a pose pede (encolher) mais a que acontece sozinha quando o braço sobe acima da
  // horizontal (a escápula gira e leva o ombro para cima). O contorno do tronco e os músculos sobem junto, do
  // pescoço para fora, para o ombro nunca ficar "solto" acima do corpo.
  const elev = {};
  for (const [sd, sg] of [['R', 1], ['L', -1]]) {
    const sh = J['sh' + sd], el = J['el' + sd];
    const base = (sh[0] - chest[0]) * up[0] + (sh[1] - chest[1]) * up[1];
    const dx = el[0] - sh[0], dy = el[1] - sh[1];
    const len = Math.hypot(dx, dy) || 1;
    const sobe = Math.max(0, (dx * up[0] + dy * up[1]) / len) * Math.min(1, len / 8);
    elev[sg] = base + sobe * 1.5;
  }
  const Q = (x, f) => {
    const e = elev[x >= 0 ? 1 : -1];
    const k = e ? Math.max(0, Math.min(1, (f - 0.78) / 0.22)) * Math.min(1, Math.abs(x) / 8.5) : 0;
    return add(add(hc, up, f * tl + k * e), rt, x);
  };
  const mirror = (pts) => [...pts, ...pts.slice().reverse().filter((p) => p[0] !== 0).map(([x, f]) => [-x, f])];
  const both = (pts, c) => { o.smooth(pts.map(([x, f]) => Q(x, f)), c); o.smooth(pts.map(([x, f]) => Q(-x, f)), c); };
  const tronco = () => o.smooth(mirror(TRONCO_F).map(([x, f]) => Q(x, f)));

  // --- pernas (pele e tênis)
  const legs = [];
  for (const [sd, sg] of [['R', 1], ['L', -1]]) {
    const hj = J['hj' + sd], kn = J['kn' + sd], an = J['an' + sd];
    const T = frameOf(hj, kn);
    const S = frameOf(kn, an);
    // lado de fora: produto com rt
    const fl = (T.nf[0] * rt[0] + T.nf[1] * rt[1]) * sg >= 0 ? 1 : -1;
    const fls = (S.nf[0] * rt[0] + S.nf[1] * rt[1]) * sg >= 0 ? 1 : -1;
    // coxa encurtada = apontando para a frente (sentado, joelho elevado): desenhada por cima do tronco, com o joelho arredondado
    const naFrente = !isBack && T.len < L.thigh * 0.8;
    legs.push({ T, S, fl, fls, an, kn, naFrente });
  }
  const pintaPerna = ({ T, S, fl, fls, an, kn, naFrente }) => {
    const Ft = frameOf(an, add(an, S.d, 4.4));
    o.begin('fg-shoe');
    blob(o, Ft, [[-0.3, 2.3], [0.45, 3.3], [0.95, 3.1], [1.12, 0.3], [0.95, -2.6], [0.45, -2.8], [-0.3, -2.1]], null, fls);
    o.end();
    o.begin('fg-sk');
    limb(o, T, F_TH_O, F_TH_I, 4.6, 3.3, null, fl);
    limb(o, S, F_SH_O, F_SH_I, 3.2, 1.6, null, fls);
    if (naFrente) o.circ(kn, 4.9); // joelho visto de frente, na ponta da coxa
    o.end();
  };
  for (const g of legs) if (!g.naFrente) pintaPerna(g);

  // --- tronco, pescoço e cabeça
  const Hp = (x, y) => [J.head[0] + rt[0] * x * 0.84 + up[0] * (y * 0.97 + 1.3), J.head[1] + rt[1] * x * 0.84 + up[1] * (y * 0.97 + 1.3)];
  o.begin('fg-sk');
  tronco();
  o.cap(Q(0, 1.0), Hp(0, -3), 2.7, 2.3);
  o.circ(Hp(5.2, -0.2), 1.25);
  o.circ(Hp(-5.2, -0.2), 1.25);
  o.smooth(mirror([[0, 7.0], [3.5, 6.2], [5.0, 3.0], [5.1, -0.5], [4.2, -3.6], [2.1, -6.0], [0, -6.6]]).map(([x, y]) => Hp(x, y)));
  o.end();
  if (isBack) {
    o.smooth(mirror([[0, 7.3], [3.7, 6.5], [5.4, 3.2], [5.5, -0.4], [4.4, -2.8], [2.2, -3.9], [0, -4.2]]).map(([x, y]) => Hp(x, y)), 'fg-hair');
  } else {
    // franja curta e arredondada, sem risca nem costeleta
    o.smooth(mirror([[0, 7.3], [3.7, 6.5], [5.4, 3.4], [5.5, 1.3], [4.7, 2.5], [3.2, 3.6], [1.4, 4.0], [0, 3.8]]).map(([x, y]) => Hp(x, y)), 'fg-hair');
    for (const s of [1, -1]) {
      o.circ(Hp(2.0 * s, 0.5), 0.55, 'fg-eye');
      o.open([Hp(1.2 * s, 1.8), Hp(2.1 * s, 2.0), Hp(3.0 * s, 1.8)], 'fg-ln', 0.42);
    }
    o.open([Hp(0.2, 0.2), Hp(0.75, -1.7), Hp(-0.2, -1.95)], 'fg-ln', 0.35);
    o.open([Hp(-1.4, -3.65), Hp(0, -3.8), Hp(1.4, -3.65)], 'fg-ln', 0.45);
  }
  for (const g of legs) if (g.naFrente) pintaPerna(g);

  // --- músculos das pernas; a região da bacia é recortada pela silhueta
  o.recorte('cc', () => { tronco(); for (const g of legs) limb(o, g.T, F_TH_O, F_TH_I, 4.6, 3.3, null, g.fl); });
  {
    const bl = (P, pts, c, flip) => o.smooth(pts.map(([f, w]) => P(f, w * flip)), c);
    for (const { T, S, fl, fls } of legs) {
      if (T.len > 4) {
        if (isBack) {
          bl(T, [[0.16, 0.3], [0.2, 3.8], [0.5, 3.9], [0.9, 2.6], [0.94, 0.2], [0.9, -2.4], [0.5, -3.7], [0.2, -3.5]], cls(act, 'posteriores'), fl);
        } else {
          bl(T, [[0.1, 0.4], [0.16, 2.2], [0.5, 2.4], [0.86, 1.3], [0.9, 0], [0.86, -1.2], [0.5, -2.0], [0.16, -1.7]], cls(act, 'quadriceps'), fl);
          bl(T, [[0.2, 2.7], [0.3, 4.8], [0.6, 4.6], [0.9, 3.1], [0.93, 1.8], [0.55, 2.9]], cls(act, 'quadriceps'), fl);
          bl(T, [[0.52, -2.5], [0.64, -3.9], [0.86, -3.6], [0.96, -2.1], [0.82, -1.5]], cls(act, 'quadriceps'), fl);
          bl(T, [[0.04, -2.0], [0.08, -4.3], [0.3, -4.4], [0.55, -3.6], [0.45, -2.5], [0.2, -2.3]], cls(act, 'adutores'), fl);
        }
      }
      if (S.len > 4) {
        if (isBack) {
          bl(S, [[0.03, 0.2], [0.08, 3.2], [0.3, 3.6], [0.6, 2.2], [0.64, 0], [0.6, -2.0], [0.3, -3.3], [0.08, -3.1]], cls(act, 'panturrilhas'), fls);
        } else {
          bl(S, [[0.08, 0.5], [0.12, 2.8], [0.4, 2.7], [0.7, 1.6], [0.6, 0.3]], cls(act, 'tibial'), fls);
          bl(S, [[0.06, -1.1], [0.1, -3.0], [0.3, -3.2], [0.55, -2.0], [0.4, -1.1]], cls(act, 'panturrilhas'), fls);
        }
      }
    }
  }

  // --- músculos do tronco
  if (isBack) {
    o.smooth(mirror([[0, 1.2], [3, 1.16], [9.3, 1.05], [4.4, 0.93], [0, 0.52]]).map(([x, f]) => Q(x, f)), cls(act, 'trapezio'));
    both([[1.2, 0.9], [5.0, 0.93], [9.0, 0.87], [8.6, 0.73], [5.4, 0.67], [1.5, 0.63]], cls(act, 'costas_superior'));
    both([[1.5, 0.58], [5.4, 0.62], [9.0, 0.7], [8.9, 0.56], [7.6, 0.37], [4.0, 0.25], [1.7, 0.21]], cls(act, 'dorsais'));
    o.smooth(mirror([[0, 0.5], [2.7, 0.46], [2.7, 0.1], [0, 0.04]]).map(([x, f]) => Q(x, f)), cls(act, 'lombar'));
    o.dentroDe('cc', () => both([[0.6, 0.06], [5.0, 0.12], [9.1, 0.0], [8.9, -0.16], [5.0, -0.27], [0.8, -0.2]], cls(act, 'gluteos')));
    if (isOn(act, 'abdutores')) o.dentroDe('cc', () => both([[7.0, 0.2], [9.3, 0.12], [9.4, -0.02], [7.4, 0.04]], cls(act, 'abdutores')));
  } else {
    both([[2.1, 1.16], [8.4, 1.05], [3.0, 1.0]], cls(act, 'trapezio'));
    both([[0.8, 0.98], [6.2, 0.99], [9.3, 0.86], [8.5, 0.71], [5.0, 0.65], [1.0, 0.69]], cls(act, 'peito'));
    const ab = cls(act, 'abdomen');
    for (const [f0, f1] of [[0.6, 0.5], [0.48, 0.38], [0.36, 0.26], [0.24, 0.18]]) {
      const m = (f0 + f1) / 2;
      both([[0.5, f0 - 0.012], [3.3, f0 - 0.005], [3.7, m], [3.3, f1 + 0.012], [0.5, f1 + 0.005]], ab);
    }
    both([[4.5, 0.6], [8.8, 0.6], [7.6, 0.37], [8.2, 0.19], [4.5, 0.18], [4.3, 0.36]], cls(act, 'obliquos'));
    if (isOn(act, 'abdutores')) o.dentroDe('cc', () => both([[7.8, 0.17], [9.4, 0.05], [9.3, -0.1], [7.5, -0.02]], cls(act, 'abdutores')));
  }

  // --- braços
  for (const sd of ['R', 'L']) {
    const sh = J['sh' + sd], el = J['el' + sd], wr = J['wr' + sd], hd = J['hd' + sd];
    const U = frameOf(sh, el);
    const F = frameOf(el, wr);
    const g = pg ? pg[sd] : PUNHO_PADRAO;
    // lado da palma: voltada para o meio do corpo (e para baixo, com o braço aberto)
    const sg = sd === 'R' ? 1 : -1;
    const lado = -hd[1] * -sg + hd[0] * -0.5 >= 0 ? 1 : -1;
    o.begin('fg-sk');
    o.circ(sh, 3.4);
    limb(o, U, A_UP, A_UP, 3.0, 2.2);
    limb(o, F, A_FO, A_FO, 2.2, 1.0);
    maoBase(o, wr, hd, g, lado, true);
    o.end();
    maoDetalhe(o, wr, hd, g, lado, true, false);
    if (U.len > 3) {
      blob(o, U, [[0.3, 0], [0.36, 2.2], [0.6, 2.3], [0.92, 1.4], [0.95, 0], [0.92, -1.4], [0.6, -2.3], [0.36, -2.2]], cls(act, isBack ? 'triceps' : 'biceps'));
    }
    if (F.len > 3) {
      blob(o, F, [[0.03, 0], [0.12, 2.2], [0.35, 2.4], [0.72, 1.4], [0.76, 0], [0.72, -1.4], [0.35, -2.4], [0.12, -2.2]], cls(act, 'antebraco'));
    }
    const dl = isBack ? ['deltoide_post', 'deltoide_lat'] : ['deltoide_ant', 'deltoide_lat'];
    const dir = U.len > 0.5 ? U.d : [0, -1];
    const D = frameOf(sh, add(sh, dir, L.upper));
    blob(o, D, [[-0.17, 0], [-0.13, 2.5], [0.05, 3.0], [0.3, 2.5], [0.45, 0], [0.3, -2.5], [0.05, -3.0], [-0.13, -2.5]], cls(act, dl));
  }
}

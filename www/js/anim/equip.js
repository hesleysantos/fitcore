// Desenho dos aparelhos junto ao boneco. Cada item: { k: tipo, z: 'back'|'front', ... }.
// Coordenadas no mesmo "mundo" do boneco (y para cima, chão em 0; 1 unidade ≈ 2 cm).
// Medidas de referência (catálogos de Life Fitness, Hammer Strength, Technogym, Matrix, Cybex e Movement):
// anilha olímpica de 45 cm, barra de 28–30 mm, banco com assento a ~42 cm do chão e estofado de ~6 cm,
// halter sextavado com cabeças de ~12 cm, coluna de polia regulável e Smith com ~2,1–2,2 m de altura,
// torre de pilha de pesos com ~1,5–1,7 m, pilha de placas de ~5 cm com duas hastes-guia.
//
// Tipos (vista lateral): bench, pad, frame, line, circ, tower (coluna com carenagem e pilha que sobe),
// cable, lever, roller, rail, mat, box, ball, barbell, plate, db, kb, handle, fixbar, wheel, sled,
// rack (coluna de suporte de barra com gancho), smith (haste-guia, coluna, travas e bucha da barra),
// wall (parede), fn (desenho livre). Vista frontal: barbell, db, kb, plate, ballheld, fixbar, cable,
// tower, pad, box, frame, lever, roller, band, smith, seatf (assento com coluna e pé), fn.

const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const FAR = [1.8, 1.0];
const CHAO = 0.95; // eixo de um tubo deitado no chão

const BACK_KINDS = new Set(['bench', 'pad', 'tower', 'frame', 'mat', 'box', 'ball', 'rail', 'step', 'seat', 'rack', 'smith', 'wall', 'seatf']);

// ---------- peças ----------
// tubo de aço: traço cheio com um filete de brilho
function tubo(o, pts, w = 1.6, c = '') {
  o.open(pts, 'fg-eq' + c, w);
  if (w >= 1.2) o.open(pts, 'fg-eqhi' + c, w * 0.28);
}
// estofado: almofada com contorno e a linha da costura
function estofado(o, a, b, th = 1.8) {
  o.cap(a, b, th, th, 'fg-cush');
  const d = norm(sub(b, a));
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len > 6 && th >= 1.4) {
    const n = [-d[1], d[0]];
    const s = n[1] >= 0 ? 1 : -1; // costura do lado de cima
    o.line(add(add(a, d, 1.2), n, s * th * 0.45), add(add(b, d, -1.2), n, s * th * 0.45), 'fg-cushhi', 0.45);
  }
}
// anilha vista de frente para o furo (disco): aro, ressalto interno e cubo de aço
function anilha(o, p, r, c = '') {
  o.circ(p, r, 'fg-plate' + c);
  o.circ(p, r * 0.87, 'fg-ring' + c);
  if (r > 5) o.circ(p, r * 0.44, 'fg-ring' + c);
  o.circ(p, Math.min(2.2, r * 0.3), 'fg-steel' + c);
  o.circ(p, 0.75, 'fg-eqs' + c);
}
// cabeça sextavada de halter (vista pela ponta)
function sextavado(o, p, r, c = '') {
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push([p[0] + Math.cos((i * Math.PI) / 3) * r, p[1] + Math.sin((i * Math.PI) / 3) * r]);
  o.poly(pts, 'fg-rub' + c);
  o.circ(p, r * 0.36, 'fg-steel' + c);
}
// retângulo com os cantos nos eixos d (comprimento) e n (largura), centrado em p
function bloco(o, p, d, n, meioC, meioL, c) {
  o.poly([add(add(p, d, -meioC), n, -meioL), add(add(p, d, meioC), n, -meioL), add(add(p, d, meioC), n, meioL), add(add(p, d, -meioC), n, meioL)], c);
}
// chapa: retângulo centrado em p, comprido na direção d
function chapa(o, p, d, meioC, meioL, c = 'fg-steel') {
  bloco(o, p, d, [-d[1], d[0]], meioC, meioL, c);
}
// anilhas vistas de perfil (de canto), enfiadas num pino na direção d a partir de p
function anilhasDePerfil(o, p, d, n = 2, r = 8, esp = 1.25) {
  const nn = [-d[1], d[0]];
  for (let i = 0; i < n; i++) bloco(o, add(p, d, esp + i * (esp * 2 + 0.4)), d, nn, esp, r * (i ? 0.82 : 1), 'fg-rub');
}
// halter visto de lado: pegador, duas cabeças e os colares
function halterDeLado(o, p, d, meio = 4.4, c = '') {
  const n = [-d[1], d[0]];
  o.line(add(p, d, -meio), add(p, d, meio), 'fg-eq' + c, 1.1);
  for (const s of [-1, 1]) {
    bloco(o, add(p, d, s * (meio - 0.2)), d, n, 1.5, 2.4, 'fg-rub' + c);
    o.line(add(add(p, d, s * (meio - 1.9)), n, -1.3), add(add(p, d, s * (meio - 1.9)), n, 1.3), 'fg-eqhi' + c, 0.5);
  }
}
// kettlebell: corpo redondo, base achatada e alça
function kettlebell(o, p, d, r = 4.2, c = '') {
  const n = [-d[1], d[0]];
  o.circ(p, r, 'fg-rub' + c);
  const a = add(add(p, d, -r * 0.75), n, -r * 0.62), b = add(add(p, d, -r * 0.75), n, r * 0.62);
  o.open([a, add(a, d, -r * 0.75), add(b, d, -r * 0.75), b], 'fg-eq' + c, 1.2);
  o.circ(add(add(p, d, -r * 0.2), n, -r * 0.35), r * 0.16, 'fg-eqhi-f' + c);
}
// polia: roda com cubo
function polia(o, p, r = 1.9) {
  o.circ(p, r, 'fg-steel');
  o.circ(p, r * 0.36, 'fg-eqs');
}
// eixo de articulação (mancal) de uma alavanca
function eixo(o, p, r = 1.9) {
  o.circ(p, r, 'fg-steel');
  o.circ(p, r * 0.34, 'fg-eqs');
}
// rolo de espuma com o eixo
function rolo(o, p, r = 2.9) {
  o.circ(p, r, 'fg-cush');
  o.circ(p, r * 0.3, 'fg-steel');
}
// manopla de borracha entre a e b
function manopla(o, a, b, w = 2.2) {
  o.line(a, b, 'fg-grip', w);
}
// pilha de pesos: duas hastes-guia, placas paradas, bloco selecionado (sobe "sobe" unidades), cabeçote,
// pino seletor e o cabo até a polia do alto. Cada trecho de placas é um traço só (tracejado = placas).
function pilha(o, x, y0, top, w, sobe = 0) {
  const alto = Math.max(10, Math.min(30, (top - y0) * 0.4));
  const sel = Math.max(5, Math.round((alto * 0.42) / 2.5) * 2.5);
  const fixo = alto - sel;
  const up = Math.max(0, Math.min(sobe, top - y0 - alto - 6));
  o.line([x - w * 0.24, y0], [x - w * 0.24, top - 1], 'fg-eqhi', 0.4);
  o.line([x + w * 0.24, y0], [x + w * 0.24, top - 1], 'fg-eqhi', 0.4);
  o.line([x, y0], [x, y0 + fixo], 'fg-stack', w);
  const yb = y0 + fixo + up;
  o.line([x, yb], [x, yb + sel], 'fg-stack', w);
  o.line([x - w / 2, yb + sel + 0.5], [x + w / 2, yb + sel + 0.5], 'fg-eq', 1.1); // cabeçote
  o.circ([x, yb + 1], 0.75, 'fg-eqhi-f'); // pino seletor
  o.line([x, yb + sel + 1], [x, top - 2.6], 'fg-cable', 0.6);
  polia(o, [x, top - 2.6], 1.5);
}
// coluna com carenagem e pilha de pesos (torre). py = altura do carrinho de polia regulável na face "dir".
function coluna(o, x, top, w, sobe = 0, py = null, dir = -1) {
  const x0 = x - w / 2, x1 = x + w / 2;
  o.poly([[x0, 1.7], [x1, 1.7], [x1, top - 0.8], [x0, top - 0.8]], 'fg-shroud');
  pilha(o, x, 2.6, top - 1.2, Math.max(3, w - 3.6), sobe);
  tubo(o, [[x0, CHAO], [x0, top]], 1.4);
  tubo(o, [[x1, CHAO], [x1, top]], 1.4);
  o.line([x0 - 0.7, top], [x1 + 0.7, top], 'fg-eq', 1.9);
  o.line([x0 - 2.6, CHAO], [x1 + 2.6, CHAO], 'fg-eq', 1.7);
  if (py != null) {
    const xf = dir < 0 ? x0 : x1;
    o.line([xf, 5], [xf, top - 4], 'fg-holes', 0.7); // furos de regulagem
    bloco(o, [xf, py], [0, 1], [1, 0], 2.6, 1.5, 'fg-steel'); // carrinho
    o.line([xf, py], [xf + dir * 2.6, py], 'fg-eq', 1.3);
  }
}
// gancho em J de suporte de barra, na coluna em p, aberto para o lado d (+1/-1); a barra descansa em p + [d*2.9, 0]
function gancho(o, p, d) {
  o.open([[p[0] + d * 0.9, p[1] + 2.8], [p[0] + d * 0.9, p[1] - 1.5], [p[0] + d * 4.7, p[1] - 1.5], [p[0] + d * 4.7, p[1] + 0.9]], 'fg-eq', 1.2);
}
// curso de uma peça móvel em relação à posição inicial (t = 0): faz a pilha subir junto com o movimento
function curso(e, p, t) {
  if (!e._p0 || t === 0) e._p0 = p;
  return dist(p, e._p0);
}

// peças à disposição das animações (desenho livre com o tipo 'fn')
export const P = { tubo, estofado, anilha, anilhasDePerfil, sextavado, bloco, chapa, polia, eixo, rolo, manopla, pilha, coluna, gancho, halterDeLado, kettlebell, CHAO };

function anchorSide(J, at, far) {
  if (Array.isArray(at)) return at;
  const k = far ? 'F' : 'N';
  const off = (p) => (far ? add(p, FAR) : p);
  const back = [-J.up[1], J.up[0]];
  const front = [J.up[1], -J.up[0]];
  switch (at) {
    case 'hand': return off(J['hand' + k]);
    case 'wrist': return off(J['wr' + k]);
    case 'elbow': return off(J['el' + k]);
    case 'ankle': return off(J['an' + k]);
    case 'knee': return off(J['kn' + k]);
    case 'shin': return off([J['kn' + k][0] * 0.2 + J['an' + k][0] * 0.8, J['kn' + k][1] * 0.2 + J['an' + k][1] * 0.8]);
    case 'foot': return off(mid(J['heel' + k], J['toe' + k]));
    case 'toe': return off(J['toe' + k]);
    case 'trap': return add(add(J.sh, J.up, 1.5), back, 4.2);
    case 'rack': return add(add(J.sh, J.up, -1), front, 6.0);
    case 'chest': return add(add(J.sh, J.up, -6), front, 7.4);
    case 'lap': return add(J.hip, [0, 7.0]);
    case 'hipfront': return add(add(J.hip, J.up, 2), front, 6.2);
    case 'sh': return J.sh;
    case 'hip': return J.hip;
    case 'head': return J.head;
    default: return J.hip;
  }
}

// Cabo que vem de uma polia baixa atrás da pessoa e passa ENTRE as pernas: abaixo do quadril fica atrás da perna de cá;
// daí para cima, na frente do tronco, até a mão. Assim ele nunca parece atravessar o corpo.
function caboEntreAsPernas(o, e, J, layer) {
  const to = add(anchorSide(J, e.to || 'hand'), e.off || [0, 0]);
  const a = e.from;
  const yc = J.hip[1] - 2;
  let m = to;
  if (to[1] > yc && a[1] < yc) { const k = (yc - a[1]) / (to[1] - a[1]); m = [a[0] + (to[0] - a[0]) * k, yc]; }
  if (layer === 'back') { o.line(a, m, 'fg-cable', 0.8); polia(o, a); }
  else if (m !== to) o.line(m, to, 'fg-cable', 0.8);
}

function drawSideItem(o, e, J, layer, t) {
  if (e.k === 'cable' && e.entre) { caboEntreAsPernas(o, e, J, layer); return; }
  const z = e.z || (BACK_KINDS.has(e.k) ? 'back' : 'front');
  const both = e.k === 'db' || e.k === 'kb' || e.k === 'handle';
  if (both) {
    // mão de trás no plano de fundo, mão da frente no primeiro plano
    // (under: o objeto da mão de cá também vai para trás do braço, como num corte, para a pegada aparecer)
    if (layer === 'back' && !e.single) sideHeld(o, e, J, true);
    if (layer === (e.under ? 'back' : 'front')) sideHeld(o, e, J, false);
    return;
  }
  if (z !== layer) return;
  switch (e.k) {
    case 'bench': {
      // banco reto: estofado, longarina e dois pés com sapata
      const h = e.h ?? 16;
      const xa = e.x0 + 5, xb = e.x1 - 5;
      tubo(o, [[xa, h - 3.6], [xa, CHAO]], 1.7);
      tubo(o, [[xb, h - 3.6], [xb, CHAO]], 1.7);
      o.line([xa - 3.4, CHAO], [xa + 3.4, CHAO], 'fg-eq', 1.7);
      o.line([xb - 3.4, CHAO], [xb + 3.4, CHAO], 'fg-eq', 1.7);
      o.line([e.x0 + 2.5, h - 4.1], [e.x1 - 2.5, h - 4.1], 'fg-eq', 1.6);
      estofado(o, [e.x0, h - 1.7], [e.x1, h - 1.7], 1.7);
      break;
    }
    case 'pad': estofado(o, e.a, e.b, e.th ?? 1.8); break;
    case 'frame': tubo(o, e.pts, e.w ?? 1.6); break;
    case 'line': o.line(anchorSide(J, e.a), anchorSide(J, e.b), e.c || 'fg-eq', e.w ?? 1.6); break;
    case 'circ': o.circ(anchorSide(J, e.c0 || e.at), e.r, e.c || 'fg-cush'); break;
    case 'tower': {
      // a pilha sobe junto com a peça acompanhada (trk): mão, tornozelo, joelho...
      const sobe = e.trk ? curso(e, anchorSide(J, e.trk), t) * (e.gain ?? 0.55) : 0;
      coluna(o, e.x, e.top ?? 104, e.w ?? 9, sobe, e.py, e.dir ?? -1);
      break;
    }
    case 'rail': if (e.x == null) { tubo(o, [e.a, e.b], e.w ?? 1.4); break; } // com x: o trilho é a haste-guia de um Smith completo
    // falls through
    case 'smith': {
      // Smith: sapata, coluna de trás, coluna da frente com a régua de travas, haste-guia cromada, travessa do alto e a bucha da barra
      const top = e.top ?? 104, d = e.dir ?? -1, x = e.x;
      const xc = x + d * 4.2, xr = x + d * (e.deep ?? 21); // coluna junto da haste e coluna de trás
      o.line([xr + d * 3, CHAO], [x - d * 17, CHAO], 'fg-eq', 1.7);
      tubo(o, [[xr, CHAO], [xr, top]], 2);
      tubo(o, [[xc, CHAO], [xc, top]], 2.2);
      o.line([xc - d * 1.6, 8], [xc - d * 1.6, top - 6], 'fg-holes', 0.8); // travas
      o.line([x, 2.4], [x, top - 1], 'fg-rod', 0.9); // haste-guia
      o.line([xr + d * 1.5, top], [x - d * 3, top], 'fg-eq', 2.2);
      const b = add(anchorSide(J, e.at || 'hand'), e.off || [0, 0]);
      bloco(o, [x, b[1]], [0, 1], [1, 0], 3, 1.4, 'fg-steel'); // bucha
      if (Math.abs(b[0] - x) > 1.5) o.line([x, b[1]], b, 'fg-eq', 1.2);
      break;
    }
    case 'mat': o.cap([e.x0, 0.6], [e.x1, 0.6], 0.6, 0.6, 'fg-mat'); break; // colchonete de ~2,5 cm
    case 'box': {
      // caixa de salto / degrau: frente lisa com a borda de cima marcada
      o.poly([[e.x0, 0], [e.x1, 0], [e.x1, e.h], [e.x0, e.h]], 'fg-cush');
      o.line([e.x0 + 0.6, e.h - 0.9], [e.x1 - 0.6, e.h - 0.9], 'fg-cushhi', 0.5);
      if (e.h >= 12 && e.x1 - e.x0 >= 18) { const m = (e.x0 + e.x1) / 2; o.cap([m - 2.8, e.h * 0.62], [m + 2.8, e.h * 0.62], 1.1, 1.1, 'fg-mat'); } // alça recortada da caixa
      break;
    }
    case 'wall': {
      // parede: a face onde o corpo encosta fica em e.x; o corpo da parede vai para o lado dir
      const d = e.dir ?? -1, top = e.top ?? 100;
      o.poly([[e.x, 0], [e.x + d * 7, 0], [e.x + d * 7, top], [e.x, top]], 'fg-wall');
      o.line([e.x, 0], [e.x, top], 'fg-eq', 0.7);
      break;
    }
    case 'ball': {
      // bola suíça: brilho e frisos
      o.circ(e.c, e.r, 'fg-plate');
      o.circ(e.c, e.r * 0.72, 'fg-ring');
      o.circ(add(e.c, [-e.r * 0.38, e.r * 0.42]), e.r * 0.13, 'fg-eqhi-f');
      break;
    }
    case 'barbell': anilha(o, add(anchorSide(J, e.at || 'hand'), e.off || [0, 0]), e.r ?? 8.5); break;
    case 'plate': anilha(o, add(anchorSide(J, e.at || 'hand'), e.off || [0, 0]), e.r ?? 6); break;
    case 'cable': {
      const to = add(anchorSide(J, e.to || 'hand'), e.off || [0, 0]);
      o.line(e.from, to, 'fg-cable', 0.8);
      polia(o, e.from);
      break;
    }
    case 'fixbar': {
      const p = add(anchorSide(J, e.at || 'hand'), e.off || [0, 0]);
      o.circ(p, e.r ?? 1.6, 'fg-steel');
      break;
    }
    case 'roller': rolo(o, add(anchorSide(J, e.at || 'ankle'), e.off || [0, 0]), e.r ?? 3); break;
    case 'lever': {
      // alavanca articulada: braço do eixo até a peça que o corpo empurra; pode levar anilha num pino (plate)
      const p = add(anchorSide(J, e.to || 'ankle'), e.off || [0, 0]);
      tubo(o, e.via ? [e.pivot, e.via, p] : [e.pivot, p], e.w ?? 1.8);
      if (e.plate) anilha(o, [e.pivot[0] + (p[0] - e.pivot[0]) * e.plate, e.pivot[1] + (p[1] - e.pivot[1]) * e.plate], e.pr ?? 7);
      eixo(o, e.pivot);
      break;
    }
    case 'rack': {
      // coluna de suporte de barra: sapata, coluna com furos, gancho em J e braço de segurança
      const top = e.top ?? 96, d = e.dir ?? -1;
      o.line([e.x - (e.b0 ?? 7), CHAO], [e.x + (e.b1 ?? 7), CHAO], 'fg-eq', 1.7);
      tubo(o, [[e.x, CHAO], [e.x, top]], 2.2);
      o.line([e.x, 7], [e.x, top - 2.5], 'fg-holes', 0.7);
      if (e.hook != null) gancho(o, [e.x, e.hook], d);
      if (e.saf != null) tubo(o, [[e.x, e.saf], [e.x + d * (e.safLen ?? 13), e.saf]], 1.5);
      if (e.peg != null) { o.line([e.x, e.peg], [e.x - d * 5, e.peg], 'fg-eq', 1.1); anilhasDePerfil(o, [e.x - d * 1.4, e.peg], [-d, 0], 2, 6.5, 1); }
      break;
    }
    case 'wheel': {
      // roda abdominal: pneu, aro e o eixo com as manoplas
      const p = add(anchorSide(J, 'hand'), e.off || [0, 0]);
      const r = e.r ?? 5;
      o.circ(p, r, 'fg-rub');
      o.circ(p, r * 0.62, 'fg-ring');
      o.circ(p, 1.3, 'fg-steel');
      break;
    }
    case 'sled': {
      // plataforma de pés (leg press / hack): chapa perpendicular ao trilho
      const heel = J.heelN, toe = J.toeN;
      const d = e.fix || norm(sub(toe, heel));
      const c = e.fix ? add(toe, d, -3.5) : mid(heel, toe);
      const n = [d[1], -d[0]];
      const base = add(c, n, 1.6 * (e.side ?? 1));
      if (e.rail) tubo(o, [base, add(base, e.rail, e.len ?? 30)], 1.4);
      if (e.plate) anilha(o, add(base, e.rail || n, 6), 7);
      bloco(o, add(base, n, 0.5 * (e.side ?? 1)), d, n, 8, 1.1, 'fg-steel');
      break;
    }
    case 'fn': e.f(o, J, t); break;
    default: break;
  }
}

function sideHeld(o, e, J, far) {
  const k = far ? 'F' : 'N';
  const hand = far ? add(J['hand' + k], FAR) : J['hand' + k];
  const wr = far ? add(J['wr' + k], FAR) : J['wr' + k];
  const el = far ? add(J['el' + k], FAR) : J['el' + k];
  const fd = norm(sub(wr, el));
  const c = far ? ' fg-far' : '';
  if (e.k === 'db') {
    if (e.o === 'side') {
      // halter visto de lado (pegada neutra): perpendicular ao antebraço
      halterDeLado(o, hand, e.along ? fd : [fd[1], -fd[0]], 4.2, c);
    } else {
      sextavado(o, hand, e.r ?? 3.7, c);
    }
  } else if (e.k === 'kb') {
    kettlebell(o, add(hand, fd, 5.0), fd, 4.2, c);
  } else if (e.k === 'handle') {
    // pegador visto pela ponta: manopla de borracha com o miolo de aço
    o.circ(hand, 1.6, 'fg-rub' + c);
    o.circ(hand, 0.6, 'fg-steel' + c);
  }
}

// ---------- vista frontal ----------
function drawFrontItem(o, e, J, layer, t) {
  const z = e.z || (BACK_KINDS.has(e.k) ? 'back' : 'front');
  if (z !== layer) return;
  const cx = J.hc[0];
  const hands = [J.handR, J.handL];
  switch (e.k) {
    case 'barbell': {
      // barra vista de frente: haste, mangas, anilhas e presilhas
      let y, y2;
      if (e.at === 'trap') { y = y2 = J.chest[1] + 0.5; } else if (typeof e.at === 'number') { y = y2 = e.at; } else { y = J.handR[1]; y2 = J.handL[1]; }
      const w = e.w ?? 36;
      const a = [cx + w, y + (e.dy || 0)], b = [cx - w, y2 + (e.dy || 0)];
      const d = norm(sub(a, b));
      const n = [-d[1], d[0]];
      tubo(o, [b, a], 1.3);
      const r = e.r ?? 8.5;
      for (const [p, s] of [[a, 1], [b, -1]]) {
        o.line(add(p, d, -s * 8.2), add(p, d, s * 0.6), 'fg-eq', 2.1); // manga
        bloco(o, add(p, d, -s * 5.7), d, n, 1.25, r, 'fg-rub');
        if (!e.thin) bloco(o, add(p, d, -s * 2.9), d, n, 1.0, r * 0.78, 'fg-rub');
        bloco(o, add(p, d, -s * (e.thin ? 3.6 : 1.2)), d, n, 0.5, 1.6, 'fg-steel'); // presilha
      }
      break;
    }
    case 'smith': {
      // Smith visto de frente: duas colunas com a haste-guia, travessa do alto, sapatas e as buchas da barra
      const x = e.x ?? 23, top = e.top ?? 112;
      const y = e.at === 'trap' ? J.chest[1] + 0.5 : (J.handR[1] + J.handL[1]) / 2;
      for (const s of [1, -1]) {
        const px = cx + s * x;
        tubo(o, [[px + s * 3.2, CHAO], [px + s * 3.2, top]], 2.2);
        o.line([px, 2.4], [px, top - 2], 'fg-rod', 0.9);
        o.line([px - 4, CHAO], [px + 9 * s + 4 * s, CHAO], 'fg-eq', 1.7);
        bloco(o, [px, y], [0, 1], [1, 0], 3, 1.4, 'fg-steel');
      }
      o.line([cx - x - 5, top], [cx + x + 5, top], 'fg-eq', 2.2);
      break;
    }
    case 'db': {
      for (const [h, s] of [[J.handR, 1], [J.handL, -1]]) {
        if (e.only && e.only !== (s > 0 ? 'R' : 'L')) continue;
        if (e.o === 'end') { sextavado(o, h, 3.6); continue; }
        halterDeLado(o, h, e.o === 'v' ? [0, 1] : [1, 0], 4.4);
      }
      break;
    }
    case 'kb': {
      if (e.center) { kettlebell(o, add(mid(J.handR, J.handL), [0, -5.6]), [0, -1], 5); break; }
      for (const h of hands) kettlebell(o, add(h, [0, -5.0]), [0, -1], 4.2);
      break;
    }
    case 'plate': anilha(o, mid(J.handR, J.handL), e.r ?? 6.5); break;
    case 'ballheld': {
      // bola de peso: gomos
      const p = add(mid(J.handR, J.handL), e.off || [0, 0]);
      const r = e.r ?? 5.5;
      o.circ(p, r, 'fg-rub');
      o.open([[p[0] - r, p[1]], [p[0], p[1] + r * 0.35], [p[0] + r, p[1]]], 'fg-eqhi', 0.45);
      o.open([[p[0], p[1] - r], [p[0] + r * 0.35, p[1]], [p[0], p[1] + r]], 'fg-eqhi', 0.45);
      break;
    }
    case 'fixbar': tubo(o, [[cx - (e.w ?? 34), e.y], [cx + (e.w ?? 34), e.y]], 2); break;
    case 'cable': {
      for (const [h, s] of [[J.handR, 1], [J.handL, -1]]) {
        if (e.only && e.only !== (s > 0 ? 'R' : 'L')) continue;
        const f = [cx + s * e.from[0], e.from[1]];
        const alvo = e.to ? J[e.to + (s > 0 ? 'R' : 'L')] : h;
        o.line(f, alvo, 'fg-cable', 0.8);
        polia(o, f);
        if (e.grip) o.circ(alvo, 1.3, 'fg-rub'); // pegador na mão
      }
      break;
    }
    case 'tower': {
      // coluna(s) de polia: a carenagem fica do lado de fora e a polia regulável na face de dentro
      const p = e.trk ? J[e.trk] : null;
      const sobe = p ? curso(e, p, t) * (e.gain ?? 0.55) : 0;
      if (!e.x) { coluna(o, cx, e.top ?? 104, e.w ?? 12, sobe); break; }
      for (const s of e.only ? [e.only === 'R' ? 1 : -1] : [1, -1]) coluna(o, cx + s * e.x, e.top ?? 104, e.w ?? 8, sobe, e.py, -s);
      break;
    }
    case 'pad': estofado(o, [cx + e.a[0], e.a[1]], [cx + e.b[0], e.b[1]], e.th ?? 1.8); break;
    case 'box': {
      const y0 = e.y0 ?? 0;
      o.poly([[cx + e.x0, y0], [cx + e.x1, y0], [cx + e.x1, e.h], [cx + e.x0, e.h]], 'fg-cush');
      o.line([cx + e.x0 + 0.8, e.h - 1.2], [cx + e.x1 - 0.8, e.h - 1.2], 'fg-cushhi', 0.5);
      break;
    }
    case 'seatf': {
      // assento visto de frente: almofada, coluna do assento e travessa de apoio no chão
      const y = e.y ?? 20, w = e.w ?? 11;
      tubo(o, [[cx, y - 3], [cx, CHAO]], 2.4);
      o.line([cx - w - 2, CHAO], [cx + w + 2, CHAO], 'fg-eq', 1.7);
      o.cap([cx - w + 2.2, y - 2.2], [cx + w - 2.2, y - 2.2], 2.2, 2.2, 'fg-cush');
      break;
    }
    case 'frame': tubo(o, e.pts.map((p) => [cx + p[0], p[1]]), e.w ?? 1.6); break;
    case 'lever': {
      for (const [h0, s] of [[J[(e.to || 'hand') + 'R'], 1], [J[(e.to || 'hand') + 'L'], -1]]) {
        const h = [h0[0] + s * (e.dx || 0), h0[1] + (e.dy || 0)];
        const pv = [cx + s * e.pivot[0], e.pivot[1]];
        if (e.drop) {
          // braço pendurado no eixo do alto: travessa até a linha da mão e haste que desce até a manopla
          tubo(o, [pv, [h[0], pv[1]], [h[0], h[1] - 3]], e.w ?? 1.6);
          manopla(o, [h[0], h[1] - 3.4], [h[0], h[1] + 3.4]);
        } else {
          tubo(o, [pv, h], e.w ?? 1.8);
          if (e.grip) manopla(o, [h[0] - 3.4, h[1]], [h[0] + 3.4, h[1]]);
        }
        eixo(o, pv, 1.8);
      }
      break;
    }
    case 'roller': {
      for (const sd of ['R', 'L']) {
        const p = add(J[(e.at || 'kn') + sd], [(sd === 'R' ? 1 : -1) * (e.dx ?? 0), e.dy ?? 0]);
        o.circ(p, e.r ?? 3, 'fg-cush');
      }
      break;
    }
    case 'band': o.line(J[(e.at || 'kn') + 'R'], J[(e.at || 'kn') + 'L'], 'fg-band', 1.6); break;
    case 'fn': e.f(o, J, t); break;
    default: break;
  }
}

export function drawEquip(o, equip, J, layer, view, t) {
  if (!equip) return;
  for (const e of equip) {
    if (view === 'side') drawSideItem(o, e, J, layer, t);
    else drawFrontItem(o, e, J, layer, t);
  }
}

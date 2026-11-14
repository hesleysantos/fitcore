// Mãos: o formato muda conforme o que a mão faz em cada exercício.
//   'aberta' — espalmada em um apoio (chão, colchonete, banco, caixa, parede): palma e dedos estendidos no apoio;
//   'eixo'   — segura um cabo que aparece de lado (barra vista de frente, halter, kettlebell, manopla em pé). O desenho
//              depende de que lado da mão está voltado para quem olha (campo `face`):
//                'palma' — vê-se a palma: os dedos dão a volta por trás do cabo e as pontas (com as unhas) voltam para o
//                          lado do punho; o polegar fecha por baixo;
//                'dorso' — vêem-se as costas da mão: ela cobre o cabo e os nós dos dedos ficam logo depois dele;
//                'dedos' — mão apoiada por cima de uma barra vista de lado (paralelas): os dedos descem pela frente dela;
//   'punho'  — segura algo visto pela ponta (barra de perfil, manopla): punho fechado em volta do miolo do objeto;
//              com `pal` (+1/-1) a palma fica de um lado: os nós dos dedos de um lado, as pontas do outro;
//   'solta'  — mão livre: palma, quatro dedos e polegar;
//   'oculta' — mão escondida atrás do próprio corpo (vista de costas com os braços à frente): não é desenhada.
// Pegada do exercício (campo `pega` da animação: 'pronada' — o padrão —, 'supinada' ou 'neutra'): decide para onde a
// palma aponta e de que lado fica o polegar.
// Medidas (1 unidade ≈ 2 cm): mão ~18,5 cm, palma ~9 cm de comprimento por ~8,5 cm de largura, dedos ~1,9 cm de espessura.
import { norm } from './geom.js';

const perp = (v) => [-v[1], v[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// sistema de eixos local: O = origem, s = eixo "a", n = eixo "b"
const eixos = (O, s, n) => (a, b) => [O[0] + s[0] * a + n[0] * b, O[1] + s[1] * a + n[1] * b];

// objetos que ocupam as mãos (qualquer um deles na cena = mãos fechadas, salvo regra mais específica)
const SEGURA = new Set(['handle', 'barbell', 'plate', 'cable', 'fixbar', 'wheel', 'lever', 'smith', 'rail', 'tower', 'db', 'kb', 'sled', 'fn']);
// objetos presos à própria mão (a mão não pode estar apoiada no chão ao mesmo tempo)
const NA_MAO = new Set(['db', 'kb', 'handle']);
const TOPO_COLCHONETE = 1.2;

// Procura um apoio debaixo (ou ao lado) do punho. Devolve a mão espalmada nesse apoio, ou null.
function apoio(eq, wr, hd, frente) {
  // parede: a mão fica em pé, com os dedos para cima
  for (const e of eq) {
    if (e.k === 'wall' && Math.abs(wr[0] - e.x) <= 4.6 && wr[1] > 6) {
      const sn = wr[0] < e.x ? -1 : 1;
      return { m: 'aberta', O: [e.x, wr[1]], s: [0, 1], n: [sn, 0], h: Math.abs(wr[0] - e.x) };
    }
  }
  // antebraço deitado no apoio (prancha no antebraço): a mão segue a direção dele; senão, o antebraço precisa descer até o apoio
  const deitado = Math.abs(hd[1]) <= 0.25;
  if (!deitado && !(hd[1] < -0.25)) return null;
  const sentido = deitado ? (hd[0] >= 0 ? 1 : -1) : frente;
  let y = null;
  for (const e of eq) {
    if ((e.k === 'bench' || e.k === 'box') && e.x0 != null && e.x1 != null) {
      const topo = e.k === 'bench' ? (e.h ?? 16) - 0.85 : e.h;
      const x0 = Math.min(e.x0, e.x1) - 1.5, x1 = Math.max(e.x0, e.x1) + 1.5;
      if (topo != null && wr[0] >= x0 && wr[0] <= x1 && wr[1] - topo >= 0.6 && wr[1] - topo <= 4.6) y = Math.max(y ?? -1, topo);
    }
  }
  if (y == null && wr[1] <= 4.6) {
    y = 0;
    for (const e of eq) if (e.k === 'mat' && wr[0] >= Math.min(e.x0, e.x1) && wr[0] <= Math.max(e.x0, e.x1) && wr[1] >= TOPO_COLCHONETE + 0.6) y = TOPO_COLCHONETE;
  }
  if (y == null) return null;
  return { m: 'aberta', O: [wr[0], y], s: [sentido, 0], n: [0, 1], h: wr[1] - y };
}
// Pegada informada na própria animação (campo `maos`): um nome para as duas mãos ou um por mão ({ N, F } ou { R, L }).
// Nomes: 'solta', 'punho', 'aberta', 'oculta', 'eixo' (cabo atravessado na mão), 'eixo-h' (cabo horizontal), 'eixo-v' (cabo em pé);
// ou o objeto pronto, por exemplo { m: 'eixo', u: [0.97, -0.26], face: 'dorso' }.
const porMao = (v, k) => (v == null ? null : typeof v === 'string' || typeof v === 'function' || v.m ? v : v[k]);
// (o valor também pode ser uma função (J, k) que devolve o nome ou o objeto, quando a pegada muda ao longo do movimento)
const forcada = (anim, k, J) => { const f = porMao(anim.maos, k); return typeof f === 'function' ? f(J, k) : f; };
const pegaDe = (anim, k) => { const p = anim.pega; return (p && typeof p === 'object' ? p[k] : p) || null; };
const pronta = (f, hd) => (f === 'eixo-h' ? { m: 'eixo', u: [1, 0] } : f === 'eixo-v' ? { m: 'eixo', u: [0, 1] } : f === 'eixo' ? { m: 'eixo', u: perp(hd) } : f === 'solta' || f === 'punho' || f === 'oculta' ? { m: f } : f && typeof f === 'object' && f.m ? { ...f } : null);
// mão livre com o braço na horizontal (palma para baixo): de lado ela aparece de perfil
const dePerfil = (g, hd) => (g.m === 'solta' && Math.abs(hd[1]) < 0.55 ? { m: 'solta', perfil: true } : g);

// De cada cabo (vetor u) para a pegada a que pertence: o desenho dos dedos é pedido só com o vetor.
const DONA = new WeakMap();
function fecha(g, wr, mao, faceBase = 'dedos') {
  if (g.m === 'punho') g.d = dist(wr, mao);
  if (g.m === 'eixo') {
    g.u = norm([g.u[0], g.u[1]]);
    g.d = dist(wr, mao);
    if (!g.face) g.face = faceBase;
    if (!g.pol) g.pol = 1;
    // q (0 a 1): quanto da mão aparece "de frente". Quando o antebraço aponta para quem olha (g.d pequeno), a mão é vista
    // pela ponta: palma e dorso encolhem até uma fileira de nós de dedos sobre o cabo. É por esse formato comum que a mão
    // passa quando troca de palma para dorso no meio de um movimento, sem dar salto.
    if (g.q == null) g.q = Math.max(0, Math.min(1, (g.d / 2.4 - 0.25) / 0.6));
    DONA.set(g.u, g);
  }
  return g;
}

// Vista lateral: N = braço de cá, F = braço de lá.
export function pegadasLado(anim, J) {
  const eq = Array.isArray(anim.equip) ? anim.equip : [];
  const algum = eq.some((e) => SEGURA.has(e.k));
  const frenteCorpo = [J.up[1], -J.up[0]];
  const frente = J.up[0] + frenteCorpo[0] >= 0 ? 1 : -1;
  const out = {};
  for (const k of ['N', 'F']) {
    const wr = J['wr' + k], hd = J['hd' + k];
    const f = forcada(anim, k, J);
    const pega = pegaDe(anim, k);
    let g = pronta(f, hd);
    // haste em pé segurada de lado: a mão de cá mostra o dorso
    if (f === 'eixo-v') g.face = k === 'N' ? 'dorso' : 'palma';
    if (f === 'aberta') g = apoio(eq, wr, hd, frente) || { m: 'aberta', O: [wr[0], Math.max(0, wr[1] - 2.7)], s: [frente, 0], n: [0, 1], h: 2.7 };
    if (!g) {
      const nesta = (e) => !(k === 'F' && e.single);
      for (const e of eq) {
        if (!nesta(e)) continue;
        // halter de lado (pegada neutra): a mão de cá mostra o dorso e a de lá, a palma
        if (e.k === 'db' && e.o === 'side') g = e.along ? { m: 'eixo', u: hd } : { m: 'eixo', u: perp(hd), face: k === 'N' ? 'dorso' : 'palma' };
        else if (e.k === 'kb') g = { m: 'eixo', u: perp(hd) };
      }
      if (!g && !eq.some((e) => NA_MAO.has(e.k) && nesta(e))) g = apoio(eq, wr, hd, frente);
      if (!g) g = { m: algum ? 'punho' : 'solta' };
    }
    // punho fechado em volta de uma barra vista pela ponta: de que lado fica a palma e se o polegar aparece
    if (g.m === 'punho' && g.pal == null && (pega === 'supinada' || pega === 'pronada')) {
      g.pal = pega === 'supinada' ? 1 : -1;
      g.dedao = (k === 'N') === (pega === 'supinada');
    }
    out[k] = dePerfil(fecha(g, wr, J['hand' + k]), hd);
  }
  return out;
}

// Vista de frente ou de costas: R e L.
export function pegadasFrente(anim, J) {
  const eq = Array.isArray(anim.equip) ? anim.equip : [];
  const algum = eq.some((e) => SEGURA.has(e.k));
  const deCostas = anim.view === 'back';
  const out = {};
  for (const [k, sg] of [['R', 1], ['L', -1]]) {
    const G = J['hand' + k], hd = J['hd' + k];
    const f = forcada(anim, k, J);
    const pega = pegaDe(anim, k) || 'pronada';
    let g = pronta(f === 'eixo' ? 'eixo-h' : f, hd);
    if (f === 'aberta') g = { m: 'chao' };
    if (!g) {
      for (const e of eq) {
        if (e.only && e.only !== k) continue;
        if (e.k === 'barbell' || e.k === 'smith' || e.k === 'fixbar') {
          const y = e.k === 'fixbar' ? e.y : e.at === 'trap' ? J.chest[1] + 0.5 : typeof e.at === 'number' ? e.at : G[1];
          if (typeof y === 'number' && Math.abs(G[1] - y - (e.dy || 0)) <= 3) g = { m: 'eixo', u: [1, 0] };
        } else if (e.k === 'db') g = e.o === 'end' ? { m: 'punho' } : { m: 'eixo', u: e.o === 'v' ? [0, 1] : [1, 0] };
        else if (e.k === 'kb') g = { m: 'eixo', u: [1, 0] };
        else if (e.k === 'cable' && e.grip) g = { m: 'eixo', u: [1, 0] };
        else if (e.k === 'lever' && (e.grip || e.drop)) g = { m: 'eixo', u: e.drop ? [0, 1] : [1, 0] };
      }
      if (!g && G[1] <= 4.6 && hd[1] < -0.25) g = { m: 'chao' };
      if (!g) g = { m: algum ? 'punho' : 'solta' };
    }
    if (g.m === 'eixo') {
      const emPe = Math.abs(g.u[1]) > Math.abs(g.u[0]);
      if (!g.face) {
        if (emPe) g.face = deCostas ? 'dorso' : 'palma';
        else {
          // pronada: com o braço para cima a palma aponta para a frente; com o braço para baixo, para trás. Supinada: o contrário.
          const paraFrente = pega === 'supinada' ? hd[1] <= 0 : hd[1] > 0;
          g.face = paraFrente !== deCostas ? 'palma' : 'dorso';
        }
      }
      // polegar: em pé fica em cima; deitado, aponta para o meio do corpo na pronada e para fora na supinada
      if (!g.pol) g.pol = emPe ? (g.u[1] >= 0 ? 1 : -1) : (pega === 'supinada' ? sg : -sg) * (g.u[0] >= 0 ? 1 : -1);
    }
    out[k] = fecha(g, J['wr' + k], G);
  }
  return out;
}

// ---------- desenho ----------
// punho fechado, com o volume do polegar (medidas em: fração do comprimento 5, largura)
const PUNHO = [[-0.05, 1.4], [0.35, 2.15], [0.8, 2.05], [1.08, 1.05], [1.1, -0.7], [0.85, -1.8], [0.4, -1.95], [-0.05, -1.4]];
// punho com a palma do lado +b: dorso reto, nós dos dedos na ponta e as pontas dos dedos voltando pelo lado da palma
const GANCHO = [[-0.05, -1.3], [1.6, -1.75], [3.4, -1.9], [4.5, -1.45], [5.0, -0.4], [4.85, 0.8], [4.1, 1.7], [2.9, 1.95], [1.8, 1.7], [0.8, 1.5], [-0.05, 1.3]];
// dedos, do indicador ao mínimo: posição na largura da palma e comprimento
const DEDOS = [[1.56, 3.5], [0.52, 4.0], [-0.52, 3.75], [-1.56, 3.0]];
// dedos fechados num cabo, do indicador ao mínimo: posição ao longo do cabo, até onde passam dele e onde ficam as pontas
const VOLTA = [[1.59, 1.3, -0.9], [0.53, 1.45, -1.05], [-0.53, 1.35, -0.95], [-1.59, 1.1, -0.7]];

// eixos de uma pegada num cabo: origem no centro da pegada, "a" ao longo do cabo e "b" para além dele (longe do punho)
function eixosDoCabo(G, u, hd) {
  let v = perp(u);
  if (dot(v, hd) < 0) v = [-v[0], -v[1]];
  return eixos(G, u, v);
}

// Parte da mão que se funde com o antebraço (chamar DENTRO do grupo da pele do braço).
// wr = punho; hd = direção da mão; g = pegada; lado = +1/-1 (para que lado fica o polegar ou a palma).
export function maoBase(o, wr, hd, g, lado = 1, deFrente = false) {
  const nf = perp(hd);
  const P = eixos(wr, hd, nf);
  if (g.m === 'oculta') return;
  if (g.m === 'aberta') {
    // mão espalmada vista de perfil: calcanhar da mão, palma e dedos no apoio; o punho fica h acima
    const h = Math.min(4.6, Math.max(1.7, g.h));
    const Q = eixos(g.O, g.s, g.n);
    o.smooth([Q(-1.3, h * 0.55), Q(-1.1, 0.3), Q(0.1, 0.02), Q(2.6, 0), Q(5.0, 0), Q(8.5, 0), Q(9.25, 0.28), Q(8.7, 0.7), Q(6.6, 0.95), Q(4.9, 1.3), Q(2.7, 1.8), Q(1.3, h * 0.72 + 0.25), Q(0.7, h + 0.5), Q(-0.9, h + 0.3)]);
    return;
  }
  if (g.m === 'chao') {
    // mão espalmada no chão vista de frente: os dedos vêm na direção de quem olha
    o.smooth([[wr[0] - 2.3, 0.5], [wr[0] - 1.9, 1.5], [wr[0] - 0.9, Math.max(1.9, wr[1])], [wr[0] + 0.9, Math.max(1.9, wr[1])], [wr[0] + 1.9, 1.5], [wr[0] + 2.3, 0.5], [wr[0] + 1.6, 0.02], [wr[0] - 1.6, 0.02]]);
    return;
  }
  if (g.m === 'solta' && deFrente) {
    // mão solta vista de frente, com o braço ao lado do corpo: aparece de perfil, com os dedos levemente dobrados para a palma
    o.smooth([P(-0.3, 1.0), P(1.6, 1.15), P(4.6, 1.0), P(5.2, 0), P(4.6, -0.95), P(1.6, -1.05), P(-0.3, -1.0)]);
    o.cap(P(4.5, 0.15 * lado), P(6.5, 0.75 * lado), 0.62, 0.55);
    o.cap(P(6.5, 0.75 * lado), P(7.5, 1.9 * lado), 0.55, 0.45);
    return;
  }
  if (g.m === 'solta') {
    // mão solta vista pelo dorso: palma, quatro dedos e polegar
    o.smooth([P(-0.3, 1.35), P(1.5, 1.95), P(4.3, 2.12), P(4.9, 0), P(4.3, -2.12), P(1.5, -1.9), P(-0.3, -1.35)]);
    for (const [w, c] of DEDOS) o.cap(P(4.2, w), P(4.2 + c * 0.86, w * 1.06), 0.56, 0.46);
    o.cap(P(1.2, 1.5 * lado), P(3.7, 3.0 * lado), 0.68, 0.5);
    return;
  }
  if (g.m === 'eixo') {
    // palma do punho até o cabo: os dedos (ou o dorso) vêm por cima dele, depois de desenhado o aparelho
    const d = g.d ?? 2.4;
    const Q = eixosDoCabo([wr[0] + hd[0] * d, wr[1] + hd[1] * d], g.u, hd);
    const s = dot(nf, g.u) >= 0 ? 1 : -1;
    const q = g.q ?? 1, m = (a, b) => a * q + b * (1 - q);
    const w = g.face === 'dedos' ? 1.9 : 2.15, t = g.face === 'dedos' ? 0.4 : m(1.15, 0.5), r = m(-1.1, -0.3);
    o.smooth([P(-0.3, 1.25), Q(s * w, r), Q(s * (w + 0.05), 0.2), Q(s * (w - 0.55), t), Q(-s * (w - 0.55), t), Q(-s * (w + 0.05), 0.2), Q(-s * w, r), P(-0.3, -1.25)]);
    // dorso à vista: o polegar passa por baixo do cabo, do lado de dentro da mão
    if (g.face === 'dorso') o.cap(Q(g.pol * m(1.6, 1.7), m(-1.55, -0.7)), Q(g.pol * m(2.75, 2.5), m(-0.75, -0.25)), 0.6, 0.5);
    return;
  }
  // punho fechado
  // a barra fica do lado da palma: o dorso da mão passa mais longe dela do que as pontas dos dedos
  if (g.pal) o.smooth(GANCHO.map(([a, b]) => P(a + (a > 1 ? mais(g) : 0), (b - 0.7 * Math.min(1, Math.max(0, (a - 1) / 1.5))) * g.pal)));
  else o.smooth(PUNHO.map(([f, w]) => P(f * 5, w)));
}
// barra segurada mais na ponta dos dedos (punho dobrado na rosca de punho): o gancho dos dedos avança junto
const mais = (g) => Math.max(0, (g.d ?? 2.4) - 3.2);

// Detalhes que ficam sobre a pele da própria mão (chamar logo depois de fechar o grupo do braço).
export function maoDetalhe(o, wr, hd, g, lado = 1, deFrente = false, longe = false) {
  const nf = perp(hd);
  const P = eixos(wr, hd, nf);
  const pele = longe ? 'fg-skf' : 'fg-sk';
  if (g.m === 'aberta') {
    // polegar deitado ao lado da palma
    const Q = eixos(g.O, g.s, g.n);
    o.cap(Q(1.5, 0.78), Q(4.3, 0.45), 0.42, 0.36, pele);
    return;
  }
  if (g.m === 'chao') {
    for (const x of [-1.1, 0, 1.1]) o.line([wr[0] + x, 0.25], [wr[0] + x, 0.95], 'fg-ln', 0.32);
    return;
  }
  if (g.m === 'solta' && deFrente) {
    o.cap(P(1.4, 0.5 * lado), P(3.9, 1.55 * lado), 0.55, 0.42, pele);
    return;
  }
  if (g.m === 'solta') {
    // separação entre os dedos
    for (const w of [1.04, 0, -1.04]) o.line(P(4.5, w), P(6.9, w * 1.06), 'fg-ln', 0.32);
    return;
  }
  if (g.m === 'punho') {
    if (g.pal) {
      // dobra dos dedos sobre a palma e, se estiver do lado de quem olha, o polegar fechado por cima deles
      const k = mais(g);
      o.open([P(4.45 + k, 0.55 * g.pal), P(3.6 + k, 1.25 * g.pal), P(2.3 + k, 1.3 * g.pal)], 'fg-ln', 0.32);
      if (g.dedao) o.cap(P(0.9, 1.35 * g.pal), P(3.5 + k, 0.75 * g.pal), 0.6, 0.5, pele);
      return;
    }
    // polegar fechado por cima dos dedos
    o.cap(P(1.0, -1.25 * lado), P(3.6, -0.35 * lado), 0.6, 0.5, pele);
  }
}

// Dedos fechados em volta de um cabo que passa pelo centro da pegada (chamar DEPOIS de desenhar o objeto).
// G = centro da pegada; u = direção do cabo (o mesmo vetor da pegada); hd = direção da mão.
export function dedosNoCabo(o, G, u, hd, lado = 1, longe = false) {
  const g = DONA.get(u) || { face: 'dedos', pol: lado };
  const pele = longe ? 'fg-skf' : 'fg-sk';
  const Q = eixosDoCabo(G, norm(u), hd);
  const p = g.pol || 1;
  // q = 1: mão vista de frente; q = 0: vista pela ponta (só a fileira dos nós dos dedos sobre o cabo)
  const q = g.q ?? 1, m = (a, b) => a * q + b * (1 - q);
  if (g.face === 'dorso') {
    // costas da mão por cima do cabo: os nós dos dedos fazem a borda de lá; o lado do punho fica sem risco
    const pts = [Q(-2.1, m(-1.6, -0.75)), Q(-2.3, m(-0.6, -0.45)), Q(-2.3, m(0.45, 0.3))];
    for (const [c, h0] of [...VOLTA].sort((a, b) => a[0] * p - b[0] * p)) { const h = m(h0, 0.55); pts.push(Q(c * p - 0.52, h - 0.4), Q(c * p - 0.3, h + 0.2), Q(c * p + 0.3, h + 0.2), Q(c * p + 0.52, h - 0.4)); }
    pts.push(Q(2.3, m(0.45, 0.3)), Q(2.3, m(-0.6, -0.45)), Q(2.1, m(-1.6, -0.75)));
    o.open(pts, pele, 1);
    for (const c of [-1.06, 0, 1.06]) o.line(Q(c, m(0.3, 0)), Q(c, m(1.05, 0.5)), 'fg-ln', 0.32);
    return;
  }
  if (g.face === 'palma') {
    // dedos que dão a volta por trás do cabo: as pontas, com as unhas, voltam para o lado do punho
    for (const [c, h, f0] of VOLTA) {
      const f = m(f0, -0.5);
      o.cap(Q(c * p, m(h, 0.5)), Q(c * p, f), 0.56, 0.5, pele);
      if (q > 0.7) o.line(Q(c * p, f - 0.12), Q(c * p, f + 0.3), 'fg-nail', 0.5);
    }
    // polegar por baixo, fechando a pegada por cima das pontas dos dedos
    o.cap(Q(p * m(2.45, 2.5), m(-2.15, -0.25)), Q(p * m(0.75, 1.7), m(-1.5, -0.7)), 0.62, 0.5, pele);
    return;
  }
  // mão por cima da barra: os quatro dedos descem pela frente dela
  for (const i of [-1.5, -0.5, 0.5, 1.5]) o.cap(Q(i * 1.06, -1.0), Q(i * 1.06, 1.2), 0.56, 0.5, pele);
}

// Mãos do lado de cá (vista lateral) ou as duas (vista de frente): dedos por cima dos objetos, na última camada.
export function maosPorCima(o, J, pg, view) {
  if (view === 'side') {
    const g = pg.N;
    if (g.m === 'eixo') dedosNoCabo(o, J.handN, g.u, J.hdN, 1, false);
    return;
  }
  for (const k of ['R', 'L']) {
    const g = pg[k];
    if (g.m === 'eixo') dedosNoCabo(o, J['hand' + k], g.u, J['hd' + k], g.pol, false);
  }
}

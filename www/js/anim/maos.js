// Mãos: o formato muda conforme o que a mão faz em cada exercício.
//   'aberta' — espalmada em um apoio (chão, colchonete, banco, caixa, parede): palma e dedos estendidos no apoio;
//   'eixo'   — segura um cabo que aparece de lado (barra vista de frente, halter, kettlebell): os quatro dedos e o
//              polegar são desenhados POR CIMA do objeto, fechando em volta dele;
//   'punho'  — segura algo visto pela ponta (barra de perfil, manopla): punho fechado em volta do miolo do objeto;
//   'solta'  — mão livre: palma, quatro dedos e polegar.
// Medidas (1 unidade ≈ 2 cm): mão ~18,5 cm, palma ~9 cm de comprimento por ~8,5 cm de largura, dedos ~1,9 cm de espessura.
import { norm } from './geom.js';

const perp = (v) => [-v[1], v[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
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
// Nomes: 'solta', 'punho', 'aberta', 'eixo' (cabo atravessado na mão), 'eixo-h' (cabo horizontal), 'eixo-v' (cabo em pé);
// ou o objeto pronto, por exemplo { m: 'eixo', u: [0.97, -0.26] }.
const forcada = (anim, k) => (anim.maos ? (typeof anim.maos === 'string' || anim.maos.m ? anim.maos : anim.maos[k]) : null);
const pronta = (f, hd) => (f === 'eixo-h' ? { m: 'eixo', u: [1, 0] } : f === 'eixo-v' ? { m: 'eixo', u: [0, 1] } : f === 'eixo' ? { m: 'eixo', u: perp(hd) } : f === 'solta' || f === 'punho' ? { m: f } : f && typeof f === 'object' && f.m ? f : null);
// mão livre com o braço na horizontal (palma para baixo): de lado ela aparece de perfil
const dePerfil = (g, hd) => (g.m === 'solta' && Math.abs(hd[1]) < 0.55 ? { m: 'solta', perfil: true } : g);

// Vista lateral: N = braço de cá, F = braço de lá.
export function pegadasLado(anim, J) {
  const eq = Array.isArray(anim.equip) ? anim.equip : [];
  const algum = eq.some((e) => SEGURA.has(e.k));
  const frenteCorpo = [J.up[1], -J.up[0]];
  const frente = J.up[0] + frenteCorpo[0] >= 0 ? 1 : -1;
  const out = {};
  for (const k of ['N', 'F']) {
    const wr = J['wr' + k], hd = J['hd' + k];
    const f = forcada(anim, k);
    let g = pronta(f, hd);
    if (f === 'aberta') g = apoio(eq, wr, hd, frente) || { m: 'aberta', O: [wr[0], Math.max(0, wr[1] - 2.7)], s: [frente, 0], n: [0, 1], h: 2.7 };
    if (!g) {
      const nesta = (e) => !(k === 'F' && e.single);
      for (const e of eq) {
        if (!nesta(e)) continue;
        if (e.k === 'db' && e.o === 'side') g = { m: 'eixo', u: e.along ? hd : perp(hd) };
        else if (e.k === 'kb') g = { m: 'eixo', u: perp(hd) };
      }
      if (!g && !eq.some((e) => NA_MAO.has(e.k) && nesta(e))) g = apoio(eq, wr, hd, frente);
      if (!g) g = { m: algum ? 'punho' : 'solta' };
    }
    out[k] = dePerfil(g, hd);
  }
  return out;
}

// Vista de frente ou de costas: R e L.
export function pegadasFrente(anim, J) {
  const eq = Array.isArray(anim.equip) ? anim.equip : [];
  const algum = eq.some((e) => SEGURA.has(e.k));
  const out = {};
  for (const k of ['R', 'L']) {
    const G = J['hand' + k], hd = J['hd' + k];
    const f = forcada(anim, k);
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
    out[k] = g;
  }
  return out;
}

// ---------- desenho ----------
// punho fechado, com o volume do polegar (medidas em: fração do comprimento 5, largura)
const PUNHO = [[-0.05, 1.4], [0.35, 2.15], [0.8, 2.05], [1.08, 1.05], [1.1, -0.7], [0.85, -1.8], [0.4, -1.95], [-0.05, -1.4]];
// dedos, do indicador ao mínimo: posição na largura da palma e comprimento
const DEDOS = [[1.56, 3.5], [0.52, 4.0], [-0.52, 3.75], [-1.56, 3.0]];

// Parte da mão que se funde com o antebraço (chamar DENTRO do grupo da pele do braço).
// wr = punho; hd = direção da mão; g = pegada; lado = +1/-1 (para que lado fica o polegar ou a palma).
export function maoBase(o, wr, hd, g, lado = 1, deFrente = false) {
  const nf = perp(hd);
  const P = eixos(wr, hd, nf);
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
  // punho fechado
  o.smooth(PUNHO.map(([f, w]) => P(f * 5, w)));
}

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
    // polegar fechado por cima dos dedos
    o.cap(P(1.0, -1.25 * lado), P(3.6, -0.35 * lado), 0.6, 0.5, pele);
  }
}

// Dedos fechados em volta de um cabo que passa pelo centro da pegada (chamar DEPOIS de desenhar o objeto).
// G = centro da pegada; u = direção do cabo; hd = direção da mão.
export function dedosNoCabo(o, G, u, hd, lado = 1, longe = false) {
  const pele = longe ? 'fg-skf' : 'fg-sk';
  u = norm(u);
  let v = perp(u);
  if (dot(v, hd) < 0) v = [-v[0], -v[1]];
  const Q = eixos(G, u, v);
  // quatro dedos atravessando o cabo
  for (const i of [-1.5, -0.5, 0.5, 1.5]) o.cap(Q(i * 1.06, -1.0), Q(i * 1.06, 1.55), 0.56, 0.52, pele);
  // polegar por baixo, fechando a pegada
  o.cap(Q(lado * 2.2, -2.2), Q(lado * 0.3, -1.6), 0.58, 0.48, pele);
}

// Mãos do lado de cá (vista lateral) ou as duas (vista de frente): dedos por cima dos objetos, na última camada.
export function maosPorCima(o, J, pg, view) {
  if (view === 'side') {
    const g = pg.N;
    if (g.m === 'eixo') dedosNoCabo(o, J.handN, g.u, J.hdN, 1, false);
    return;
  }
  for (const [k, sg] of [['R', 1], ['L', -1]]) {
    const g = pg[k];
    if (g.m === 'eixo') dedosNoCabo(o, J['hand' + k], g.u, J['hd' + k], g.u[0] ? -sg : 1, false);
  }
}

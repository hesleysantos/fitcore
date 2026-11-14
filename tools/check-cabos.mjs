// Verificação dos cabos dos aparelhos: nenhum cabo pode atravessar o corpo do boneco.
// Para cada animação, em vários instantes do movimento, mede quanto de cada cabo (classe fg-cable) fica por cima ou por
// trás do tronco, da cabeça, das coxas e das pernas. Um cabo de verdade passa ao lado ou em volta do corpo; no desenho,
// atravessar a silhueta dá a impressão de que a corda passa por dentro da pessoa.
// Tolerâncias: a ponta do cabo que chega à mão, ao pé ou ao tornozelo (onde a pessoa segura ou prende o cabo) não conta.
// Uso: node tools/check-cabos.mjs [-v] [id-do-exercicio]
import { EXERCICIOS } from '../www/js/data/exercises.js';
import { animFor } from '../www/js/anim/index.js';
import { renderFrame, juntasEm } from '../www/js/anim/rig.js';

const verbose = process.argv.includes('-v');
// Casos em que o cabo cruza a silhueta de propósito, com o motivo físico. O que não está aqui é erro.
// POR CIMA do corpo (o cabo está do lado de quem olha ou à frente da pessoa):
const POR_CIMA_OK = {
  'elevacao-lateral-polia': 'o cabo vem da polia do lado oposto e passa pela frente do corpo',
  'elevacao-frontal-polia': 'acima do quadril, o cabo sobe pela frente do corpo até a mão',
  'remada-alta-polia': 'a polia fica no chão, à frente dos pés, e o cabo sobe pela frente do corpo até a barra',
  'rotacao-externa-ombro-polia': 'o cabo vem do lado oposto e passa pela frente da barriga',
  'rosca-bayesian': 'o cabo vem de trás e passa ao lado do quadril, do lado de quem olha',
  'triceps-coice-polia': 'o cabo passa ao lado da coxa, do lado de quem olha',
  'lenhador-polia-alta': 'o cabo vem do alto, de lado, e passa pela frente do corpo',
  'pular-corda': 'a corda gira em volta do corpo',
};
// POR TRÁS do corpo (o cabo fica escondido pela silhueta):
const TORRE_ATRAS = 'cabo interno da torre, que fica atrás da pessoa';
const POR_TRAS_OK = {
  'peck-deck': TORRE_ATRAS, 'barra-fixa-assistida-graviton': 'vista de costas: o mastro e o cabo ficam à frente da pessoa, além do corpo', 'elevacao-lateral-maquina': 'vista de costas: a torre fica à frente da pessoa, além do corpo',
  'crucifixo-inverso-peck-deck': TORRE_ATRAS, 'cadeira-adutora': TORRE_ATRAS, 'cadeira-abdutora': TORRE_ATRAS,
  'cadeira-flexora': TORRE_ATRAS, // a pilha fica ao lado do assento: nesta vista, atrás da pessoa
  'crucifixo-inverso-polia': 'vista de costas: os cabos cruzam à frente do corpo',
  'pallof-press-polia': 'a coluna fica ao lado da pessoa, atrás dela nesta vista',
  'pullover-maquina': 'o cabo sai do came, ao lado do ombro, e passa por trás da cabeça',
  'triceps-frances-polia-corda': 'o cabo sobe por trás das costas e da cabeça',
  'elevacao-frontal-polia': 'abaixo do quadril, o cabo passa entre as pernas',
  'agachamento-cinto-belt-squat': 'o cinto prende no braço da máquina, entre as pernas',
};
const so = process.argv.slice(2).find((a) => !a.startsWith('-'));
const LIMITE = { tronco: 2.5, cabeca: 2.5, coxa: 3.5, perna: 3.5, braco: 4 }; // unidades de cabo dentro de cada parte (1 un ≈ 2 cm)
const FOLGA_PONTA = 6; // trecho final do cabo, junto de mão, pé ou tornozelo, que pode encostar no corpo

const dist2 = (p, a, b) => { // distância de p ao segmento ab
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t);
};
// pontos de um traço (linha ou caminho aberto feito de retas) em coordenadas do desenho
function pontosDe(s) {
  if (s.t === 'line') return [[Number(s.x1), Number(s.y1)], [Number(s.x2), Number(s.y2)]];
  if (s.t === 'path' && typeof s.d === 'string' && !/[CQAZ]/i.test(s.d.replace(/^M/, ''))) {
    const n = s.d.match(/-?\d+(\.\d+)?/g);
    const out = [];
    if (n) for (let i = 0; i + 1 < n.length; i += 2) out.push([Number(n[i]), Number(n[i + 1])]);
    return out.length >= 2 ? out : null;
  }
  return null;
}

let problemas = 0;
for (const ex of EXERCICIOS) {
  if (so && ex.id !== so) continue;
  const anim = animFor(ex);
  const pior = { cima: {}, tras: {} };
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const formas = renderFrame(anim, {}, t);
    // o corpo termina no último músculo pintado (os dedos que fecham sobre os pegadores vêm depois dos aparelhos e não contam)
    let ultimoCorpo = -1;
    formas.forEach((s, k) => { if (typeof s.c === 'string' && /fg-m[012]/.test(s.c)) ultimoCorpo = k; });
    const cabos = [];
    formas.forEach((s, k) => { if (typeof s.c === 'string' && s.c.includes('fg-cable')) { const pts = pontosDe(s); if (pts) cabos.push({ pts, lado: k > ultimoCorpo ? 'cima' : 'tras' }); } });
    if (!cabos.length) continue;
    const { J, chao, view } = juntasEm(anim, t);
    const P = (p) => [p[0], chao - p[1]];
    const partes = [];
    const pontas = []; // onde o cabo pode encostar
    if (view === 'side') {
      partes.push(['tronco', P(J.sh), P(J.hip), 5.2], ['cabeca', P(J.head), P(J.head), 5.2]);
      for (const k of ['N', 'F']) {
        partes.push(['coxa', P(J.hip), P(J['kn' + k]), 3.8], ['perna', P(J['kn' + k]), P(J['an' + k]), 2.3], ['braco', P(J.sh), P(J['el' + k]), 2.3]);
        pontas.push(P(J['hand' + k]), P(J['wr' + k]), P(J['an' + k]), P(J['toe' + k] || J['an' + k]), P(J['kn' + k]));
      }
    } else {
      partes.push(['tronco', P(J.chest), P(J.hc), 7.2], ['cabeca', P(J.head), P(J.head), 5.0]);
      for (const k of ['R', 'L']) {
        partes.push(['coxa', P(J['hj' + k]), P(J['kn' + k]), 3.6], ['perna', P(J['kn' + k]), P(J['an' + k]), 2.3], ['braco', P(J['sh' + k]), P(J['el' + k]), 2.3]);
        pontas.push(P(J['hand' + k]), P(J['wr' + k]), P(J['an' + k]), P(J['kn' + k]));
      }
    }
    for (const { pts, lado } of cabos) {
      const dentro = {};
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k], b = pts[k + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.ceil(len / 0.5));
        for (let j = 0; j <= n; j++) {
          const p = [a[0] + (b[0] - a[0]) * (j / n), a[1] + (b[1] - a[1]) * (j / n)];
          if (pontas.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < FOLGA_PONTA)) continue;
          for (const [nome, c0, c1, r] of partes) if (dist2(p, c0, c1) < r) { dentro[nome] = (dentro[nome] || 0) + len / n; break; }
        }
      }
      for (const nome in dentro) if (dentro[nome] > (pior[lado][nome] ? pior[lado][nome].v : 0)) pior[lado][nome] = { v: dentro[nome], t };
    }
  }
  for (const [lado, ok, rot] of [['cima', POR_CIMA_OK, 'por cima do corpo'], ['tras', POR_TRAS_OK, 'por trás do corpo']]) {
    const ruins = Object.entries(pior[lado]).filter(([nome, x]) => x.v > LIMITE[nome]);
    if (!ruins.length) continue;
    const msg = ruins.map(([nome, x]) => `${nome} ${x.v.toFixed(1)} (t=${x.t})`).join(', ');
    if (ok[ex.id]) { if (verbose) console.log(`  ok ${ex.id}: cabo ${rot} — ${ok[ex.id]} [${msg}]`); continue; }
    problemas++;
    console.log(`  x ${ex.id} [${anim.view || 'side'}]: cabo ${rot} cruza ${msg}`);
  }
}
console.log(problemas ? `
${problemas} cabo(s) atravessando o corpo. Mude o caminho do cabo (por baixo do assento, por trás do encosto, rente ao chão)
ou, se ele passa mesmo pela frente ou por trás da pessoa, registre o motivo em POR_CIMA_OK / POR_TRAS_OK.` : 'OK: nenhum cabo atravessa o corpo do boneco.');
if (problemas) process.exitCode = 1;

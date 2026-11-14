// Mãos das figuras: a pegada certa em cada situação (apoiada, segurando um cabo, fechada em volta de uma barra, solta).
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCICIOS } from '../www/js/data/exercises.js';
import { animFor } from '../www/js/anim/index.js';
import { juntasEm, renderFrame } from '../www/js/anim/rig.js';
import { pegadasLado, pegadasFrente } from '../www/js/anim/maos.js';

const pg = (id, t) => { const anim = animFor(id); const { J, view } = juntasEm(anim, t); return view === 'side' ? pegadasLado(anim, J) : pegadasFrente(anim, J); };
const MODOS = new Set(['aberta', 'chao', 'eixo', 'punho', 'solta', 'oculta']);

test('mãos: toda animação tem uma pegada válida em todos os instantes, e o desenho não quebra', () => {
  for (const ex of EXERCICIOS) {
    const anim = animFor(ex);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const g = pg(ex.id, t);
      const lados = (anim.view || 'side') === 'side' ? ['N', 'F'] : ['R', 'L'];
      for (const k of lados) {
        assert.ok(g[k] && MODOS.has(g[k].m), `${ex.id} t=${t} mão ${k}: ${g[k] && g[k].m}`);
        if (g[k].m === 'eixo') assert.ok(Array.isArray(g[k].u) && Math.abs(Math.hypot(g[k].u[0], g[k].u[1]) - 1) < 0.05, `${ex.id}: direção do cabo`);
        if (g[k].m === 'aberta') assert.ok(g[k].O.every(Number.isFinite) && g[k].h >= 0 && g[k].h <= 6.5, `${ex.id}: apoio da mão`);
      }
      const formas = renderFrame(anim, {}, t);
      for (const s of formas) if (s.d) assert.ok(!/NaN|undefined|Infinity/.test(s.d), `${ex.id} t=${t}: forma inválida`);
    }
  }
});

test('mãos: apoiadas no chão, no banco e na parede ficam espalmadas', () => {
  for (const id of ['flexao-de-bracos', 'flexao-de-bracos-joelhos', 'prancha-frontal', 'coice-quatro-apoios']) {
    for (const t of [0, 1]) { const g = pg(id, t); assert.equal(g.N.m, 'aberta', `${id} t=${t}`); assert.equal(g.F.m, 'aberta', `${id} t=${t}`); }
  }
  // no colchonete a mão fica em cima dele, não dentro
  assert.ok(pg('prancha-frontal', 0).N.O[1] > 1);
  assert.equal(pg('flexao-de-bracos', 0).N.O[1], 0);
  // deitado de costas: os braços descansam no chão, nos dois extremos do movimento
  for (const id of ['ponte-gluteos-solo', 'ponte-gluteos-unilateral', 'abdominal-reverso', 'flexao-joelhos-bola-suica']) {
    for (const t of [0, 0.5, 1]) assert.equal(pg(id, t).N.m, 'aberta', `${id} t=${t}`);
  }
  // remada serrote: a mão de lá apoia no banco e a de cá segura o halter
  const serrote = pg('remada-unilateral-halter-serrote', 0);
  assert.equal(serrote.F.m, 'aberta'); assert.ok(serrote.F.O[1] > 10, 'apoio na altura do banco'); assert.notEqual(serrote.N.m, 'aberta');
});

test('mãos: fecham os dedos por cima do cabo que seguram', () => {
  // barras vistas de frente ou de costas
  for (const id of ['barra-fixa-pronada', 'barra-fixa-supinada', 'desenvolvimento-halteres-sentado', 'agachamento-sumo-kettlebell', 'remada-alta-polia', 'encolhimento-barra']) {
    const g = pg(id, 0);
    assert.equal(g.R.m, 'eixo', id); assert.equal(g.L.m, 'eixo', id);
  }
  // de que lado da mão se vê: pendurado de costas na pegada pronada aparece o dorso (a mão cobre a barra, nós dos dedos por cima);
  // na supinada aparece a palma (dedos dando a volta na barra, pontas voltadas para o punho)
  assert.equal(pg('barra-fixa-pronada', 0).R.face, 'dorso');
  assert.equal(pg('suspensao-barra-fixa-dead-hang', 0).L.face, 'dorso');
  assert.equal(pg('barra-fixa-supinada', 0).R.face, 'palma');
  // de frente: empurrando acima da cabeça vê-se a palma; com a barra pendurada à frente das coxas, o dorso
  assert.equal(pg('desenvolvimento-halteres-sentado', 1).R.face, 'palma');
  assert.equal(pg('encolhimento-barra', 0).R.face, 'dorso');
  // polegares: para o meio do corpo na pronada, para fora na supinada
  assert.equal(pg('barra-fixa-pronada', 0).R.pol, -1); assert.equal(pg('barra-fixa-pronada', 0).L.pol, 1);
  assert.equal(pg('barra-fixa-supinada', 0).R.pol, 1);
  // pegada neutra em pegadores curtos e barra vista pela ponta: punho fechado
  assert.equal(pg('barra-fixa-neutra', 0).R.m, 'punho');
  assert.equal(pg('puxada-frente-aberta', 0).N.m, 'punho');
  // rosca de punho: palma para cima na normal e para baixo na inversa
  assert.equal(pg('rosca-punho-barra', 0).N.pal, 1);
  assert.equal(pg('rosca-punho-inversa-barra', 0).N.pal, -1);
  // rosca simultânea de frente: palma à vista embaixo (palmas para a frente) e dorso no alto
  assert.equal(pg('rosca-simultanea-halteres', 0).R.face, 'palma');
  assert.equal(pg('rosca-simultanea-halteres', 1).R.face, 'dorso');
  // de costas com os braços à frente do corpo, a mão fica escondida até passar da linha do ombro
  assert.equal(pg('crucifixo-inverso-polia', 0).R.m, 'oculta');
  assert.equal(pg('crucifixo-inverso-polia', 1).R.m, 'punho');
  // halter e kettlebell de lado, barras paralelas e hastes em pé
  // halter de lado (martelo): a mão de cá mostra o dorso
  assert.equal(pg('rosca-martelo-halteres', 0).N.face, 'dorso');
  for (const id of ['rosca-martelo-halteres', 'kettlebell-swing', 'mergulho-paralelas-triceps', 'mergulho-assistido-graviton', 'empurrar-treno']) {
    for (const t of [0, 1]) assert.equal(pg(id, t).N.m, 'eixo', `${id} t=${t}`);
  }
  // nas paralelas a barra corre de frente para trás; no trenó a haste fica em pé
  assert.deepEqual(pg('mergulho-assistido-graviton', 0).N.u, [1, 0]);
  assert.deepEqual(pg('empurrar-treno', 0).N.u, [0, 1]);
  // barra vista pela ponta: punho fechado em volta dela
  for (const id of ['supino-reto-barra', 'rosca-direta-barra-reta', 'triceps-pulley-corda']) assert.equal(pg(id, 0).N.m, 'punho', id);
});

test('mãos: livres ficam soltas, com os dedos à mostra', () => {
  assert.equal(pg('agachamento-peso-corporal', 0).N.m, 'solta');
  assert.equal(pg('polichinelo', 0).R.m, 'solta');
  // com o braço na horizontal a mão aparece de perfil
  assert.equal(pg('agachamento-peso-corporal', 1).N.perfil, true);
  assert.ok(!pg('agachamento-peso-corporal', 0).N.perfil);
});

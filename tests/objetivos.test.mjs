// Objetivo do Treinador e da Nutricionista: andam juntos por padrão; o usuário pode manter diferentes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import { COMBINA, combinam, nutriPara, treinoPara, parDe, parValido, situacao, alinhar, manterDiferentes } from '../www/js/logic/objetivos.js';
import { PERGUNTAS as P_TREINO, ROTULO as ROT_T } from '../www/js/logic/trainer.js';
import { PERGUNTAS as P_NUTRI, ROTULO as ROT_N } from '../www/js/logic/nutrition.js';

const OBJ_T = P_TREINO.find((q) => q.k === 'objetivo').op.map((o) => o[0]);
const OBJ_N = P_NUTRI.find((q) => q.k === 'objetivo').op.map((o) => o[0]);
const estado = (t, n, ok = '') => ({ trainer: { answers: t ? { objetivo: t } : {}, aceitoEm: '2026-11-01T10:00:00.000Z', revisaoEm: '2026-12-01T10:00:00.000Z', adiadoAte: '' }, nutri: { answers: n ? { objetivo: n } : {}, calculadoEm: '' }, ui: { objetivosOk: ok } });

test('objetivos: a tabela cobre todos os objetivos das duas entrevistas', () => {
  assert.deepEqual(Object.keys(COMBINA).sort(), [...OBJ_T].sort());
  for (const t of OBJ_T) { assert.ok(COMBINA[t].length >= 1); for (const n of COMBINA[t]) assert.ok(OBJ_N.includes(n)); assert.ok(ROT_T.objetivo[t]); }
  for (const n of OBJ_N) { assert.ok(OBJ_T.some((t) => COMBINA[t].includes(n)), 'todo objetivo da alimentação combina com algum treino: ' + n); assert.ok(ROT_N.objetivo[n]); }
});

test('objetivos: ganhar massa combina com ganhar massa, emagrecer com emagrecer', () => {
  assert.ok(combinam('hipertrofia', 'ganhar')); assert.ok(!combinam('hipertrofia', 'emagrecer')); assert.ok(!combinam('hipertrofia', 'manter'));
  assert.ok(combinam('emagrecimento', 'emagrecer')); assert.ok(!combinam('emagrecimento', 'ganhar')); assert.ok(!combinam('emagrecimento', 'manter'));
  assert.ok(combinam('forca', 'ganhar')); assert.ok(combinam('forca', 'manter')); assert.ok(!combinam('forca', 'emagrecer'));
  assert.ok(combinam('saude', 'manter')); assert.ok(combinam('resistencia', 'manter')); assert.ok(!combinam('saude', 'emagrecer')); assert.ok(!combinam('resistencia', 'ganhar'));
  // quem só respondeu um dos dois (ou tem valor inválido) não está em conflito
  for (const [t, n] of [[undefined, 'ganhar'], ['hipertrofia', undefined], ['x', 'ganhar'], ['hipertrofia', 'x'], [null, null], ['__proto__', 'ganhar'], ['hipertrofia', 'constructor']]) assert.ok(combinam(t, n));
  // o objetivo sugerido para o outro lado sempre combina
  for (const t of OBJ_T) assert.ok(combinam(t, nutriPara(t)));
  for (const n of OBJ_N) assert.ok(combinam(treinoPara(n), n));
  assert.equal(nutriPara('hipertrofia'), 'ganhar'); assert.equal(nutriPara('emagrecimento'), 'emagrecer');
  assert.equal(treinoPara('ganhar'), 'hipertrofia'); assert.equal(treinoPara('emagrecer'), 'emagrecimento'); assert.equal(treinoPara('manter'), 'saude');
  // quem já combina não é trocado
  assert.equal(nutriPara('forca', 'manter'), 'manter'); assert.equal(nutriPara('forca', 'emagrecer'), 'ganhar');
  assert.equal(treinoPara('manter', 'resistencia'), 'resistencia'); assert.equal(treinoPara('ganhar', 'forca'), 'forca'); assert.equal(treinoPara('emagrecer', 'forca'), 'emagrecimento');
  assert.equal(nutriPara('nada'), null); assert.equal(treinoPara(undefined), null); assert.equal(treinoPara('toString'), null);
});

test('objetivos: igualar muda só o outro lado; manter diferentes vale para aquele par', () => {
  assert.equal(situacao(estado('hipertrofia', null)), null);
  assert.equal(situacao(estado(null, 'ganhar')), null);
  assert.equal(situacao({}), null); assert.equal(situacao(null), null);
  assert.deepEqual(situacao(estado('hipertrofia', 'ganhar')), { treino: 'hipertrofia', nutri: 'ganhar', combinam: true, aceito: false });
  for (const t of OBJ_T) for (const n of OBJ_N) {
    if (combinam(t, n)) { const st = estado(t, n); assert.equal(alinhar(st, 'treino'), false); assert.equal(manterDiferentes(st), false); assert.deepEqual(st, estado(t, n)); continue; }
    // o treino manda: muda a alimentação, o plano de treino aceito continua
    let st = estado(t, n);
    assert.equal(alinhar(st, 'treino', new Date('2026-11-10T12:00:00.000Z')), true);
    assert.equal(st.trainer.answers.objetivo, t); assert.equal(st.trainer.aceitoEm, '2026-11-01T10:00:00.000Z');
    assert.ok(combinam(t, st.nutri.answers.objetivo)); assert.equal(st.nutri.calculadoEm, '2026-11-10T12:00:00.000Z');
    assert.equal(situacao(st).combinam, true);
    // a alimentação manda: muda o treino e o plano volta a ser proposta
    st = estado(t, n);
    assert.equal(alinhar(st, 'nutri'), true);
    assert.equal(st.nutri.answers.objetivo, n); assert.ok(combinam(st.trainer.answers.objetivo, n));
    assert.equal(st.trainer.aceitoEm, ''); assert.equal(st.trainer.revisaoEm, '');
    // manter diferentes: vale só para este par
    st = estado(t, n);
    assert.equal(situacao(st).aceito, false);
    assert.equal(manterDiferentes(st), true);
    assert.equal(st.ui.objetivosOk, parDe(t, n)); assert.ok(parValido(st.ui.objetivosOk));
    assert.equal(situacao(st).aceito, true); assert.equal(st.trainer.answers.objetivo, t); assert.equal(st.nutri.answers.objetivo, n);
    const outroN = OBJ_N.find((x) => x !== n && !combinam(t, x));
    if (outroN) { st.nutri.answers.objetivo = outroN; assert.equal(situacao(st).aceito, false, 'outro par diferente pede nova escolha'); }
  }
});

test('objetivos: a escolha de manter diferentes é gravada e validada', () => {
  for (const v of ['hipertrofia|emagrecer', 'forca|manter']) assert.ok(parValido(v));
  for (const v of ['', 'hipertrofia', 'hipertrofia|', '|ganhar', 'x|ganhar', 'hipertrofia|x', 'hipertrofia|ganhar|manter', '__proto__|ganhar', 'hipertrofia|constructor', null, 5, {}, ['hipertrofia|ganhar']]) assert.ok(!parValido(v), String(v));
  const limpo = (ui) => store.sanitize({ ui }).ui.objetivosOk;
  assert.equal(limpo({ objetivosOk: 'hipertrofia|emagrecer' }), 'hipertrofia|emagrecer');
  assert.equal(limpo({ objetivosOk: '<script>|ganhar' }), '');
  assert.equal(limpo({ objetivosOk: 42 }), '');
  assert.equal(limpo({}), '');
  assert.equal(store.sanitize({}).ui.objetivosOk, '');
});

// Treino a mais num dia que ainda vai chegar (logic/treino-extra.js): esporte, musculação ou corrida. O treinador ajusta a
// semana com as regras de sempre (logic/perdido.js) e tudo o que ele mudou sai junto quando o treino a mais é apagado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../www/js/logic/perdido.js';
import * as X from '../www/js/logic/treino-extra.js';
import * as store from '../www/js/store.js';

const SEG = '2026-11-16', TER = '2026-11-17', QUA = '2026-11-18', QUI = '2026-11-19', SEX = '2026-11-20';
const item = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
const SUP = [item('supino-reto-halteres'), item('remada-unilateral-halter-serrote')], INF = [item('agachamento-livre-barra'), item('leg-press-45')], FULL = [item('flexao-de-bracos'), item('agachamento-peso-corporal')];
const plano = (agenda) => ({ id: 'p1', nome: 'P', origem: 'manual', criadoEm: '2026-10-01T10:00:00.000Z', info: '', dias: [{ id: 'a', nome: 'Treino A', foco: '', itens: SUP }, { id: 'b', nome: 'Treino B', foco: '', itens: INF }, { id: 'c', nome: 'Treino C', foco: '', itens: FULL }], agenda });
const estado = (agenda, extra = {}) => ({ ...store.sanitize({ plans: [plano(agenda)], activePlan: 'p1', trainer: { answers: { idade: 30 } } }), ...extra });
const semana = (st) => P.semanaEfetiva(st.plans[0], st.perdidos, SEG).map((d) => d.diaId || '-');
const aplica = (st, plano_, marcas) => { const s = structuredClone(st); X.gravarExtra(s, plano_, marcas); return s; };
const EM = '2026-11-16T10:00:00.000Z';

test('futebol na terça: o treino de pernas da quarta muda de dia, e apagar o futebol desfaz', () => {
  const st = estado({ 1: 'a', 3: 'b', 5: 'c' });
  const a = X.analisarEsporte(st, TER, 'futebol', 90, SEG, 'f1', EM);
  assert.ok(a.vigoroso);
  assert.equal(a.marcas.length, 1);
  assert.equal(a.marcas[0].extra, 'f1');
  assert.equal(a.marcas[0].ajuste, 'esporte');
  const s = aplica(st, { id: 'f1', data: TER, tipo: 'esporte', esporte: 'futebol', min: 90, em: EM }, a.marcas);
  const sem = semana(s);
  assert.equal(sem[2], '-', 'quarta fica sem o treino de pernas');
  assert.ok(sem.indexOf('b') >= 4, 'o treino de pernas vai para longe do futebol: ' + sem.join(','));
  assert.match(a.textos.join(' '), /Recomendo passar o Treino B.*de quarta/);
  // a marca e o planejado passam pela validação do estado
  const limpo = store.sanitize(s);
  assert.deepEqual(limpo.planejados, s.planejados);
  assert.equal(limpo.perdidos.length, 1);
  X.apagarExtra(s, 'f1');
  assert.deepEqual(semana(s), ['a', '-', 'b', '-', 'c', '-', '-']);
  assert.equal(s.planejados.length, 0);
});

test('esporte leve (ioga) ou curto não mexe na semana', () => {
  const st = estado({ 1: 'a', 3: 'b', 5: 'c' });
  for (const [e, m] of [['ioga', 60], ['futebol', 20], ['natacao', 60]]) {
    const a = X.analisarEsporte(st, TER, e, m, SEG, 'x', EM);
    assert.equal(a.vigoroso, false, e);
    assert.equal(a.marcas.length, 0, e);
  }
});

test('musculação a mais num dia livre: entra como treino a mais, sem colar nos mesmos músculos', () => {
  // A (superiores) na segunda; B (pernas) na quarta; o A já foi feito; A a mais na sexta: ok
  const st = estado({ 1: 'a', 3: 'b' }, { sessions: [{ id: 's1', planId: 'p1', diaId: 'a', nome: 'A', inicio: SEG + 'T10:00:00.000Z', fim: SEG + 'T11:00:00.000Z', itens: [{ ex: 'supino-reto-halteres', sets: [{ reps: 10, ok: true }, { reps: 10, ok: true }, { reps: 10, ok: true }] }] }] });
  const a = X.analisarMusculacao(st, SEX, 'a', TER, 'm1', EM);
  assert.equal(a.pode, true, a.texto);
  assert.equal(a.acao, 'extra');
  const s = aplica(st, null, a.marcas);
  assert.equal(semana(s)[4], 'a');
  // hoje é segunda e o A já foi feito: o A a mais na terça fica colado nele, sem as 48 horas
  const b = X.analisarMusculacao(st, TER, 'a', SEG, 'm2', EM);
  assert.equal(b.pode, false);
  assert.match(b.texto, /48 horas/);
});

test('musculação de um treino que ainda vai acontecer: muda de dia em vez de repetir', () => {
  const st = estado({ 1: 'a', 3: 'b', 5: 'c' });
  // o C de sexta trazido para quinta? Fica colado no B de quarta? C (corpo inteiro) tem agachamento leve: depende da carga
  const a = X.analisarMusculacao(st, QUI, 'c', TER, 'm1', EM);
  if (a.pode) { assert.equal(a.acao, 'troca'); assert.equal(semana(aplica(st, null, a.marcas))[3], 'c'); }
  // o A de segunda (hoje ainda é segunda) levado para quinta, a pedido
  const b = X.analisarMusculacao(st, QUI, 'a', SEG, 'm2', EM);
  assert.equal(b.pode, true, b.texto);
  assert.equal(b.acao, 'pedido');
  const s = aplica(st, null, b.marcas);
  assert.equal(semana(s)[0], '-');
  assert.equal(semana(s)[3], 'a');
  assert.equal(store.sanitize(s).perdidos[0].ajuste, 'pedido');
});

test('dia que já tem musculação: o app não junta dois treinos', () => {
  const feito = { id: 's1', planId: 'p1', diaId: 'a', nome: 'A', inicio: SEG + 'T10:00:00.000Z', fim: SEG + 'T11:00:00.000Z', itens: [] };
  const st = estado({ 1: 'a', 3: 'b', 5: 'c' }, { sessions: [feito] });
  const a = X.analisarMusculacao(st, QUA, 'a', SEG, 'm1', EM);
  assert.equal(a.pode, false);
  assert.match(a.texto, /já tem o Treino B/);
});

test('corrida a mais sem plano de corrida: uma corrida leve e curta', () => {
  const st = estado({ 1: 'a', 3: 'b', 5: 'c' });
  const a = X.analisarCorrida(st, QUI, SEG, 'c1', EM);
  assert.equal(a.pode, true);
  assert.equal(a.mover, null);
  assert.ok(a.extraMin >= 20 && a.extraMin <= 40);
  const s = aplica(st, { id: 'c1', data: QUI, tipo: 'corrida', min: a.extraMin, em: EM }, []);
  assert.equal(store.sanitize(s).planejados.length, 1);
});

test('planejados inválidos saem na validação', () => {
  const l = X.limparPlanejados([{ id: 'a', data: TER, tipo: 'esporte', esporte: 'nada', min: 30 }, { id: 'b', data: 'x', tipo: 'corrida', min: 30 }, { id: 'c', data: TER, tipo: 'corrida', min: 2 }, { id: 'd', data: TER, tipo: 'corrida', min: 30 }, { id: 'd', data: TER, tipo: 'corrida', min: 30 }]);
  assert.deepEqual(l.map((p) => p.id), ['d']);
});

test('futebol registrado hoje: o treinador recomenda tirar as pernas de amanhã (a tela pergunta antes de gravar)', () => {
  const st = estado({ 1: 'a', 2: 'b', 5: 'c' });
  const a = X.analisarEsporte(st, SEG, 'futebol', 60, SEG, 'at1', EM);
  assert.ok(a.vigoroso);
  assert.equal(a.marcas.length, 1);
  assert.match(a.textos.join(' '), /Recomendo passar o Treino B.*de amanhã/);
  // nada foi gravado pela análise: a semana só muda se a pessoa aceitar
  assert.deepEqual(semana(st), ['a', 'b', '-', '-', 'c', '-', '-']);
  // dia que já passou: não reorganiza
  assert.equal(X.analisarEsporte(st, SEG, 'futebol', 60, TER, 'at2', EM).marcas.length, 0);
});

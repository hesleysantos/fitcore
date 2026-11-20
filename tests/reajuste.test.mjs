// Treino feito fora do dia dele, ou outro treino: o treinador reajusta a semana (logic/perdido.js, reajustarDepoisDoTreino),
// com as regras de "Não treinei" (48 horas para os mesmos músculos, dias livres, um dia de descanso).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../www/js/logic/perdido.js';
import * as store from '../www/js/store.js';

const SEG = '2026-11-16', TER = '2026-11-17';
const item = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
const SUP = [item('supino-reto-halteres'), item('remada-unilateral-halter-serrote')], INF = [item('agachamento-livre-barra'), item('leg-press-45')], FULL = [item('flexao-de-bracos'), item('agachamento-peso-corporal')];
const plano = (agenda) => ({ id: 'p1', nome: 'P', origem: 'manual', criadoEm: '2026-10-01T10:00:00.000Z', info: '', dias: [{ id: 'a', nome: 'Treino A', foco: '', itens: SUP }, { id: 'b', nome: 'Treino B', foco: '', itens: INF }, { id: 'c', nome: 'Treino C', foco: '', itens: FULL }], agenda });
const sessao = (data, diaId, itens = [{ ex: 'flexao-de-bracos', sets: [{ reps: 10, ok: true }] }]) => ({ id: 's' + data + (diaId || 'L'), planId: diaId ? 'p1' : null, diaId, nome: diaId || 'Treino livre', inicio: data + 'T18:00:00', fim: data + 'T19:00:00', itens });
const livre = (data, exs) => sessao(data, null, exs.map(([ex, n]) => ({ ex, sets: Array.from({ length: n }, () => ({ reps: 10, ok: true })) })));
const semana = (st, perdidos) => P.semanaEfetiva(st.plans[0], perdidos, SEG).map((d) => (d.diaId || '-') + (d.perdido ? (d.perdido.entrada.feitoEm ? '(feito)' : '(perd)') : ''));
const estado = (agenda, extra = {}) => ({ ...store.sanitize({ plans: [plano(agenda)], activePlan: 'p1', trainer: { answers: { idade: 30 } } }), ...extra });
const naoTreinei = (st, para) => P.novaMarca(st, SEG, SEG, 'mover', '2026-11-16T20:00:00.000Z', { motivo: 'tempo', para });

test('o treino que passou para sexta é feito na terça: sai de sexta, e o da terça vai para outro dia', () => {
  let st = estado({ 1: 'a', 2: 'b', 3: 'c' });
  st = { ...st, perdidos: [naoTreinei(st, '2026-11-20')] };
  assert.deepEqual(semana(st, st.perdidos), ['-(perd)', 'b', 'c', '-', 'a', '-', '-']);
  const s = sessao(TER, 'a');
  st = { ...st, sessions: [s] };
  const r = P.reajustarDepoisDoTreino(st, s, TER, '2026-11-17T19:00:00.000Z');
  assert.deepEqual(r.textos, ['O Treino A foi feito hoje: não vai mais para sexta.', 'O Treino B, que era hoje, passou para sexta.']);
  assert.deepEqual(semana(st, r.perdidos), ['-(feito)', '-(perd)', 'c', '-', 'b', '-', '-']);
  const b = r.perdidos.find((e) => e.data === TER);
  assert.equal(b.trocadoPor, 'a');
  // e as marcas passam pela validação do estado
  assert.deepEqual(store.sanitize({ ...st, perdidos: r.perdidos }).perdidos, r.perdidos);
  // o treino B feito depois, no mesmo dia: ele volta para o dia dele
  const s2 = sessao(TER, 'b');
  const r2 = P.reajustarDepoisDoTreino({ ...st, perdidos: r.perdidos, sessions: [s, s2] }, s2, TER, '2026-11-17T21:00:00.000Z');
  assert.ok(!r2.perdidos.some((e) => e.data === TER));
});

test('segunda sem dia novo ("seguir a semana") e o treino feito na terça: a marca registra "feito na terça"', () => {
  let st = estado({ 1: 'a', 5: 'c' });
  st = { ...st, perdidos: [P.novaMarca(st, SEG, SEG, 'seguir', '2026-11-16T20:00:00.000Z', { motivo: 'tempo' })] };
  const s = sessao(TER, 'a');
  const r = P.reajustarDepoisDoTreino({ ...st, sessions: [s] }, s, TER, '2026-11-17T19:00:00.000Z');
  assert.deepEqual(r.textos, ['O Treino A de segunda foi feito hoje.']);
  assert.equal(r.perdidos[0].feitoEm, TER);
});

test('treino livre com os mesmos músculos de um treino que falta: ele conta como feito, e o dia fica livre', () => {
  const st = estado({ 1: 'a', 3: 'b', 5: 'c' });
  const s = livre(TER, [['agachamento-livre-barra', 4], ['leg-press-45', 4]]);
  const r = P.reajustarDepoisDoTreino({ ...st, sessions: [s] }, s, TER, '2026-11-17T19:00:00.000Z');
  assert.match(r.textos[0], /já trabalhou os músculos do Treino B de amanhã: ele conta como feito/);
  assert.deepEqual(semana(st, r.perdidos), ['a', '-', '-(feito)', '-', 'c', '-', '-']);
});

test('treino livre que não cobre o de amanhã, mas pega os mesmos músculos pesados: o de amanhã muda de dia (48 horas)', () => {
  const st = estado({ 3: 'a', 5: 'b' });
  const s = livre(TER, [['supino-reto-halteres', 3]]);
  const r = P.reajustarDepoisDoTreino({ ...st, sessions: [s] }, s, TER, '2026-11-17T19:00:00.000Z');
  assert.match(r.textos[0], /O Treino A de amanhã passou para quinta: os mesmos músculos precisam de 48 horas/);
  const m = r.perdidos.find((e) => e.data === '2026-11-18');
  assert.equal(m.ajuste, 'descanso');
});

test('treino livre no dia de outro treino: o do dia, se não ficou coberto, vai para outro dia', () => {
  const st = estado({ 2: 'b', 4: 'a' });
  const s = livre(TER, [['supino-reto-halteres', 3], ['remada-unilateral-halter-serrote', 3]]);
  const r = P.reajustarDepoisDoTreino({ ...st, sessions: [s] }, s, TER, '2026-11-17T19:00:00.000Z');
  assert.deepEqual(semana(st, r.perdidos), ['-', '-(perd)', 'b', '-(feito)', '-', '-', '-']);
  assert.equal(r.perdidos.find((e) => e.data === TER).trocadoPor, 'livre');
});

test('nada muda: o treino do dia, treino de outra semana, sem plano', () => {
  const st = estado({ 2: 'b' });
  const s = sessao(TER, 'b');
  assert.equal(P.reajustarDepoisDoTreino({ ...st, sessions: [s] }, s, TER, ''), null);
  const velho = sessao('2026-11-10', 'a');
  assert.equal(P.reajustarDepoisDoTreino({ ...st, sessions: [velho] }, velho, TER, ''), null);
  assert.equal(P.reajustarDepoisDoTreino({ ...st, plans: [], activePlan: '' }, s, TER, ''), null);
  // treino livre leve num dia de descanso, sem músculo coberto nem choque: nada muda
  const leve = livre(SEG, [['flexao-de-bracos', 1]]);
  assert.equal(P.reajustarDepoisDoTreino({ ...st, sessions: [leve] }, leve, SEG, ''), null);
});

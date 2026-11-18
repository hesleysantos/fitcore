// Treino mudado "só nesta semana": a versão da semana vale de segunda a domingo e, na semana seguinte, volta o plano.
import test from 'node:test';
import assert from 'node:assert/strict';
import { semanaDe, ajustarSemana, itensDoDia, temAjusteNaSemana, desfazerAjusteSemana, limparAjustesSemana, MAX_AJUSTES } from '../www/js/logic/ajuste-semana.js';
import { sanitize } from '../www/js/store.js';

const item = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
const estado = () => ({
  plans: [{ id: 'p1', nome: 'Meu', origem: 'manual', criadoEm: '', info: '', agenda: { 1: 'dA' }, dias: [{ id: 'dA', nome: 'Treino A', foco: '', itens: [item('leg-press-45', 4), item('cadeira-extensora', 3)] }] }],
  ajustesSemana: [],
});

test('a semana vai de segunda a domingo', () => {
  assert.equal(semanaDe('2026-11-18'), '2026-11-16'); // quarta
  assert.equal(semanaDe('2026-11-16'), '2026-11-16'); // segunda
  assert.equal(semanaDe('2026-11-22'), '2026-11-16'); // domingo
  assert.equal(semanaDe('2026-11-23'), '2026-11-23');
  assert.equal(semanaDe('2026-02-30'), '');
  assert.equal(semanaDe('lixo'), '');
});

test('só nesta semana: vale na semana, não muda o plano, e na semana seguinte volta o de sempre', () => {
  const s = estado();
  const nova = [item('leg-press-45', 3), item('mesa-flexora', 3)];
  assert.equal(ajustarSemana(s, { planId: 'p1', diaId: 'dA', data: '2026-11-18', itens: nova }), true);
  assert.equal(s.plans[0].dias[0].itens[0].series, 4, 'o plano não muda');
  assert.equal(s.plans[0].dias[0].itens[1].ex, 'cadeira-extensora');
  for (const d of ['2026-11-16', '2026-11-18', '2026-11-22']) {
    assert.equal(temAjusteNaSemana(s, 'p1', 'dA', d), true);
    assert.deepEqual(itensDoDia(s, 'p1', 'dA', d).map((x) => [x.ex, x.series]), [['leg-press-45', 3], ['mesa-flexora', 3]]);
  }
  assert.equal(temAjusteNaSemana(s, 'p1', 'dA', '2026-11-23'), false);
  assert.deepEqual(itensDoDia(s, 'p1', 'dA', '2026-11-23').map((x) => [x.ex, x.series]), [['leg-press-45', 4], ['cadeira-extensora', 3]]);
  // a cópia devolvida pode ser alterada sem mexer no estado
  itensDoDia(s, 'p1', 'dA', '2026-11-18')[0].series = 9;
  assert.equal(s.ajustesSemana[0].itens[0].series, 3);
  // a mesma semana grava por cima (uma versão só)
  ajustarSemana(s, { planId: 'p1', diaId: 'dA', data: '2026-11-20', itens: [item('leg-press-45', 2)] });
  assert.equal(s.ajustesSemana.length, 1);
  assert.equal(itensDoDia(s, 'p1', 'dA', '2026-11-17').length, 1);
  // desfazer: volta o de sempre
  assert.equal(desfazerAjusteSemana(s, 'p1', 'dA', '2026-11-19'), true);
  assert.equal(temAjusteNaSemana(s, 'p1', 'dA', '2026-11-18'), false);
  assert.equal(itensDoDia(s, 'p1', 'dA', '2026-11-18').length, 2);
  assert.equal(desfazerAjusteSemana(s, 'p1', 'dA', '2026-11-19'), false);
});

test('igual ao plano não vira mudança; treino ou plano que não existe não grava', () => {
  const s = estado();
  ajustarSemana(s, { planId: 'p1', diaId: 'dA', data: '2026-11-18', itens: [item('leg-press-45', 3)] });
  assert.equal(s.ajustesSemana.length, 1);
  ajustarSemana(s, { planId: 'p1', diaId: 'dA', data: '2026-11-18', itens: s.plans[0].dias[0].itens });
  assert.equal(s.ajustesSemana.length, 0, 'voltar ao igual ao plano apaga a versão');
  assert.equal(ajustarSemana(s, { planId: 'p1', diaId: 'nao', data: '2026-11-18', itens: [] }), false);
  assert.equal(ajustarSemana(s, { planId: 'p1', diaId: 'dA', data: 'ontem', itens: [] }), false);
  assert.deepEqual(itensDoDia(s, 'pX', 'dA', '2026-11-18'), []);
  // exercício fora do catálogo e números fora do possível são cortados
  ajustarSemana(s, { planId: 'p1', diaId: 'dA', data: '2026-11-18', itens: [{ ex: 'nao-existe', series: 3 }, { ex: 'mesa-flexora', series: 99, reps: '<b>', descanso: -5 }] });
  assert.deepEqual(s.ajustesSemana[0].itens, [{ ex: 'mesa-flexora', series: 12, reps: '10', descanso: 0, nota: '' }]);
});

test('limpeza: só semanas recentes, sem repetir, com limite e no sanitize do estado (backup)', () => {
  const hoje = '2026-11-18';
  const r = (semana, extra = {}) => ({ planId: 'p1', diaId: 'dA', semana, itens: [item('mesa-flexora')], em: '2026-11-18T10:00:00.000Z', ...extra });
  const l = limparAjustesSemana([r('2026-11-16'), r('2026-11-16'), r('2026-11-02'), r('2026-10-19'), r('2027-03-01'), r('2026-11-18'), r('2026-11-23', { planId: '<x>' }), null, 'lixo'], hoje);
  assert.deepEqual(l.map((x) => x.semana), ['2026-11-16', '2026-11-02'], 'semana atual e 2 semanas atrás; nem antiga, nem longe no futuro, nem dia que não é segunda');
  assert.equal(limparAjustesSemana('lixo').length, 0);
  const muitos = Array.from({ length: 200 }, (_, i) => r('2026-11-16', { diaId: 'd' + i }));
  assert.equal(limparAjustesSemana(muitos, hoje).length, MAX_AJUSTES);
  // no sanitize: some a versão de treino que não existe mais
  const sem = semanaDe(new Date());
  const st = sanitize({ ...estado(), ajustesSemana: [r(sem), r(sem, { diaId: 'dZ' })] });
  assert.equal(st.ajustesSemana.length, 1);
  assert.equal(st.ajustesSemana[0].diaId, 'dA');
  assert.deepEqual(sanitize({}).ajustesSemana, []);
});

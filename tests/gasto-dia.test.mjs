import test from 'node:test';
import assert from 'node:assert/strict';
import { gastoDoDia } from '../www/js/logic/gasto-dia.js';

const dia = '2026-11-16';
const state = (extra = {}) => ({
  trainer: { answers: { idade: 30, peso: 80 } }, nutri: { answers: {} }, run: { answers: {} }, body: [],
  sessions: [], runs: [], atividades: [], ...extra,
});

test('soma todas as sessões, corrida e outros esportes registrados no mesmo dia', () => {
  const sessao = { id: 's1', nome: 'A', inicio: `${dia}T10:00:00.000Z`, fim: `${dia}T11:00:00.000Z`, itens: [{ ex: 'supino-reto-barra', sets: [{ kg: 40, reps: 10, ok: true }] }] };
  const g = gastoDoDia(state({ sessions: [sessao, { ...sessao, id: 's2' }], runs: [{ id: 'r1', data: dia, tipo: 'livre', distKm: 5, durMin: 30 }], atividades: [{ id: 'a1', data: dia, esporte: 'futebol', min: 60 }] }), dia);
  assert.equal(g.mostrar, true);
  assert.equal(g.atividades, 4);
  assert.ok(g.kcal > 0);
});

test('não mostra calorias para menores nem para quem informou transtorno alimentar', () => {
  assert.equal(gastoDoDia(state({ trainer: { answers: { idade: 16, peso: 60 } } }), dia).mostrar, false);
  assert.equal(gastoDoDia(state({ nutri: { answers: { idade: 30, peso: 80, condicoes: ['transtorno'] } } }), dia).mostrar, false);
});

test('dia sem atividades concluídas não exibe total', () => {
  assert.equal(gastoDoDia(state(), dia).mostrar, false);
});

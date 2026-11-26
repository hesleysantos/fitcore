// Gasto estimado do treino (logic/gasto.js): kcal = MET × peso × horas, pelos valores do Compendium de 2024.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gastoDoTreino, pesoParaGasto, METS_CARDIO } from '../www/js/logic/gasto.js';
import { REFS } from '../www/js/data/knowledge.js';
import { EXERCICIOS, EX_POR_ID } from '../www/js/data/exercises.js';

const inicio = '2026-11-16T10:00:00.000Z';
const fimEm = (min) => new Date(Date.parse(inicio) + min * 60000).toISOString();
const forca = (ex) => ({ ex, sets: [{ kg: 40, reps: 10, seg: null, ok: true }, { kg: 40, reps: 10, seg: null, ok: true }] });
const cardio = (ex, min, ok = true) => ({ ex, sets: [{ kg: null, reps: null, seg: min, ok }] });
const sessao = (min, itens) => ({ id: 's1', nome: 'Treino A', inicio, fim: fimEm(min), itens });
const st = (extra = {}) => ({ trainer: { answers: { idade: 30, peso: 80 } }, nutri: { answers: {} }, run: { answers: {} }, body: [], ...extra });

test('só musculação: 3,5 METs × peso × horas, arredondado a 10 kcal', () => {
  const g = gastoDoTreino(sessao(60, [forca('supino-reto-barra'), forca('leg-press-horizontal')]), st());
  assert.equal(g.mostrar, true);
  assert.equal(g.musculacaoMin, 60);
  assert.equal(g.kcal, 280); // 3,5 × 80 × 1 h
  assert.equal(g.peso, 80);
});

test('com cardio: o tempo do cardio sai da musculação e usa o MET do aparelho', () => {
  const g = gastoDoTreino(sessao(60, [forca('supino-reto-barra'), cardio('bicicleta-ergometrica', 20)]), st());
  assert.equal(g.musculacaoMin, 40);
  assert.deepEqual(g.cardio.map((c) => [c.ex, c.min, c.met]), [['bicicleta-ergometrica', 20, 6.8]]);
  assert.equal(g.kcal, Math.round((3.5 * 40 / 60 + 6.8 * 20 / 60) * 80 / 10) * 10); // 187 + 181 = 368 → 370
  // série de cardio não concluída não conta
  assert.equal(gastoDoTreino(sessao(60, [forca('supino-reto-barra'), cardio('bicicleta-ergometrica', 20, false)]), st()).musculacaoMin, 60);
  // air bike usa a categoria oficial equivalente de bicicleta estacionária geral
  const r = gastoDoTreino(sessao(60, [forca('supino-reto-barra'), cardio('air-bike', 10)]), st());
  assert.equal(r.musculacaoMin, 50);
  assert.equal(r.cardio[0].met, 6.8);
  assert.deepEqual(r.foraDaConta, []);
  // só cardio: nada de musculação no tempo que sobra
  const so = gastoDoTreino(sessao(40, [cardio('eliptico', 30)]), st());
  assert.equal(so.musculacaoMin, 0);
  assert.equal(so.kcal, 200); // 5,0 × 80 × 0,5 h
});

test('peso: o último registro vale mais que a entrevista; sem peso, pede o peso', () => {
  assert.equal(pesoParaGasto(st({ body: [{ data: '2026-11-01', peso: 82 }, { data: '2026-11-10', peso: 78.5 }] })), 78.5);
  assert.equal(pesoParaGasto(st()), 80);
  assert.equal(pesoParaGasto({ trainer: { answers: {} }, nutri: { answers: { peso: 66 } } }), 66);
  const g = gastoDoTreino(sessao(60, [forca('supino-reto-barra')]), { trainer: { answers: { idade: 30 } }, nutri: { answers: {} }, body: [] });
  assert.equal(g.mostrar, false);
  assert.equal(g.motivo, 'peso');
  assert.equal(g.kcal, null);
});

test('transtorno alimentar (em qualquer entrevista) e menores de 18: sem calorias', () => {
  const t = sessao(60, [forca('supino-reto-barra')]);
  for (const e of [st({ trainer: { answers: { idade: 30, peso: 80, condicoes: ['transtorno'] } } }), st({ nutri: { answers: { condicoes: ['transtorno'] } } }), st({ run: { answers: { condicoes: ['transtorno'] } } })]) {
    const g = gastoDoTreino(t, e);
    assert.equal(g.mostrar, false); assert.equal(g.motivo, 'transtorno'); assert.equal(g.kcal, null);
  }
  const menor = gastoDoTreino(t, st({ trainer: { answers: { idade: 16, peso: 60 } } }));
  assert.equal(menor.mostrar, false); assert.equal(menor.motivo, 'menor');
});

test('60 anos ou mais: valores do Older Adult Compendium (1 MET60+ = 2,7 mL/kg/min)', () => {
  const g = gastoDoTreino(sessao(60, [forca('supino-reto-barra')]), st({ trainer: { answers: { idade: 65, peso: 70 } } }));
  assert.equal(g.idade60, true);
  assert.equal(g.kcal, Math.round((4.3 * 70 * 2.7 / 3.5) / 10) * 10); // ≈ 232 → 230
  // sem MET60+ específico, usa o MET adulto publicado com a base metabólica 60+ (2,7/3,5)
  const corda = gastoDoTreino(sessao(30, [cardio('pular-corda', 10)]), st({ trainer: { answers: { idade: 65, peso: 70 } } }));
  assert.deepEqual(corda.foraDaConta, []);
  assert.equal(corda.cardio[0].fallback60, true);
  assert.ok(corda.kcal > 0);
});

test('entradas inválidas não quebram; todo cardio da tabela existe no catálogo; as fontes existem', () => {
  for (const lixo of [null, undefined, 5, 'x', {}, { inicio: 'x', fim: 'y', itens: 'z' }]) assert.doesNotThrow(() => gastoDoTreino(lixo, lixo));
  assert.equal(gastoDoTreino({ inicio, fim: inicio, itens: [] }, st()).mostrar, false);
  for (const id of Object.keys(METS_CARDIO)) assert.ok(EX_POR_ID.has(id) && EX_POR_ID.get(id).registro === 'minutos', id);
  for (const ex of EXERCICIOS.filter((e) => e.registro === 'minutos')) {
    assert.ok(METS_CARDIO[ex.id], `sem MET: ${ex.id}`);
    for (const idade of [30, 65]) {
      const g = gastoDoTreino(sessao(30, [cardio(ex.id, 10)]), st({ trainer: { answers: { idade, peso: 70 } } }));
      assert.equal(g.mostrar, true, `sem calorias para ${ex.id} aos ${idade}`);
      assert.deepEqual(g.foraDaConta, [], `${ex.id} fora da conta aos ${idade}`);
    }
  }
  assert.ok(REFS.compendio2024 && REFS.compendio60_2024);
});

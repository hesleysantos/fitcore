import test from 'node:test';
import assert from 'node:assert/strict';
import { gastoDoDia, resumoGastoDoDia } from '../www/js/logic/gasto-dia.js';

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

test('detalha e soma musculação, corrida, caminhada registrada e caminhada adicionada', () => {
  const sessao = { id: 's1', nome: 'Treino A', inicio: `${dia}T10:00:00.000Z`, fim: `${dia}T11:00:00.000Z`, itens: [{ ex: 'supino-reto-barra', sets: [{ kg: 40, reps: 10, ok: true }] }] };
  const g = gastoDoDia(state({
    sessions: [sessao],
    runs: [
      { id: 'r1', data: dia, tipo: 'leve', distKm: 5, durMin: 30 },
      { id: 'r2', data: dia, tipo: 'caminhada', distKm: 0, durMin: 60 },
      { id: 'r3', data: dia, tipo: 'intervalado', distKm: 0, durMin: 30, intervalos: [
        { tipo: 'correr', seg: 600, ritmo: null }, { tipo: 'caminhar', seg: 300, ritmo: null },
        { tipo: 'trote', seg: 600, ritmo: null }, { tipo: 'forte', seg: 300, ritmo: null },
      ] },
    ],
    atividades: [{ id: 'a1', data: dia, esporte: 'caminhada', min: 60 }],
  }), dia);
  assert.equal(g.mostrar, true);
  assert.equal(g.atividades, 5);
  assert.deepEqual(g.itens.map(({ nome, kcal }) => [nome, kcal]), [
    ['Musculação · Treino A', 280],
    ['Caminhada (passo moderado)', 300],
    ['Rodagem leve', 370],
    ['Caminhada', 280],
    ['Treino intervalado · Corrida leve', 110],
    ['Treino intervalado · Caminhada', 20],
    ['Treino intervalado · Trote de recuperação', 100],
    ['Treino intervalado · Tiro / ritmo forte', 50],
  ]);
  assert.equal(g.kcal, 1510);
  assert.equal(g.itens.reduce((total, x) => total + x.kcal, 0), g.kcal, 'o detalhe precisa fechar com o total exibido');
  const resumo = resumoGastoDoDia(g);
  assert.match(resumo, /Musculação · Treino A: ≈ 280 kcal/);
  assert.match(resumo, /Rodagem leve: ≈ 370 kcal/);
  assert.match(resumo, /Caminhada \(passo moderado\): ≈ 300 kcal/);
  assert.match(resumo, /Treino intervalado · Tiro \/ ritmo forte: ≈ 50 kcal/);
});

test('corrida registrada só por tempo não desaparece do total', () => {
  const g = gastoDoDia(state({ runs: [{ id: 'r1', data: dia, tipo: 'livre', distKm: 0, durMin: 30 }] }), dia);
  assert.equal(g.mostrar, true);
  assert.equal(g.kcal, 320); // 8 MET (running general, Compendium 12150) × 80 kg × 0,5 h
});

test('separa musculação e cardio feito dentro da mesma sessão sem somar duas vezes', () => {
  const sessao = { id: 's1', nome: 'Treino A', inicio: `${dia}T10:00:00.000Z`, fim: `${dia}T11:00:00.000Z`, itens: [
    { ex: 'supino-reto-barra', sets: [{ kg: 40, reps: 10, ok: true }] },
    { ex: 'caminhada-esteira', sets: [{ seg: 20, ok: true }] },
  ] };
  const g = gastoDoDia(state({ sessions: [sessao] }), dia);
  assert.equal(g.atividades, 1);
  assert.deepEqual(g.itens.map(({ nome, kcal }) => [nome, kcal]), [
    ['Musculação · Treino A', 190],
    ['Caminhada na esteira · Treino A', 100],
  ]);
  assert.equal(g.kcal, 290);
});

test('caminhadas em dias parecidos não despencam ao passar do limite da tabela', () => {
  const diaSeguinte = '2026-11-17';
  const hoje = gastoDoDia(state({ runs: [{ id: 'r1', data: dia, tipo: 'caminhada', distKm: 4.45, durMin: 30 }] }), dia);
  const amanha = gastoDoDia(state({ runs: [{ id: 'r2', data: diaSeguinte, tipo: 'caminhada', distKm: 4.5, durMin: 30 }] }), diaSeguinte);
  assert.equal(hoje.kcal, 340); // 8,5 MET: faixa mais rápida publicada para caminhada
  assert.equal(amanha.kcal, 340); // acima da última faixa, mantém o teto em vez de cair para 5,5 MET
});

test('não mostra calorias para menores nem para quem informou transtorno alimentar', () => {
  assert.equal(gastoDoDia(state({ trainer: { answers: { idade: 16, peso: 60 } } }), dia).mostrar, false);
  assert.equal(gastoDoDia(state({ nutri: { answers: { idade: 30, peso: 80, condicoes: ['transtorno'] } } }), dia).mostrar, false);
});

test('dia sem atividades concluídas não exibe total', () => {
  assert.equal(gastoDoDia(state(), dia).mostrar, false);
});

test('conta caminhada registrada só com duração, como pede o formulário', () => {
  const g = gastoDoDia(state({ runs: [{ id: 'c1', data: dia, tipo: 'caminhada', durMin: 60, distKm: 0 }] }), dia);
  assert.equal(g.mostrar, true);
  assert.equal(g.atividades, 1);
  assert.equal(g.kcal, 280); // 3,5 MET × 80 kg × 1 h, estimativa para caminhada sem ritmo medido
});

test('usa peso e idade da entrevista do treinador de corrida quando não há peso no perfil corporal', () => {
  const g = gastoDoDia(state({ trainer: { answers: {} }, run: { answers: { idade: 38, peso: 74 } }, runs: [{ id: 'c1', data: dia, tipo: 'caminhada', durMin: 60, distKm: 0 }] }), dia);
  assert.equal(g.mostrar, true);
  assert.equal(g.kcal, 260); // 3,5 MET × 74 kg × 1 h, arredondado a 10 kcal
});

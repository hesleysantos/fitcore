// Testes dos dados: catálogo de exercícios, animações, modelos de treino, alimentos e base de conhecimento.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCICIOS, EX_POR_ID } from '../www/js/data/exercises.js';
import { MUSCULOS, GRUPOS, PADROES, MODALIDADES, CUIDADOS, NIVEIS } from '../www/js/data/muscles.js';
import { EQUIPAMENTOS, CATEGORIAS_EQUIP } from '../www/js/data/equipment.js';
import { MODELOS } from '../www/js/data/templates.js';
import { ALIMENTOS, CATEGORIAS_ALIMENTO } from '../www/js/data/foods.js';
import { REFS, FAQ_TREINO, FAQ_NUTRI, buscarFaq } from '../www/js/data/knowledge.js';
import { hasAnim, animFor } from '../www/js/anim/index.js';

test('catálogo: 200+ exercícios com todos os campos válidos', () => {
  assert.ok(EXERCICIOS.length >= 200, 'menos de 200 exercícios');
  const ids = new Set();
  for (const e of EXERCICIOS) {
    assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'id inválido: ' + e.id);
    assert.ok(!ids.has(e.id), 'id repetido: ' + e.id);
    ids.add(e.id);
    assert.ok(e.nome && e.nome.length >= 4 && e.nome.length <= 80, 'nome: ' + e.id);
    assert.ok(GRUPOS[e.grupo], 'grupo: ' + e.id);
    assert.ok(PADROES[e.padrao], 'padrão: ' + e.id);
    assert.ok(MODALIDADES[e.modalidade], 'modalidade: ' + e.id);
    assert.ok(NIVEIS[e.nivel], 'nível: ' + e.id);
    assert.ok(['composto', 'isolado'].includes(e.tipo), 'tipo: ' + e.id);
    assert.ok(['peso_reps', 'reps', 'segundos', 'minutos'].includes(e.registro), 'registro: ' + e.id);
    assert.equal(typeof e.unilateral, 'boolean', 'unilateral: ' + e.id);
    assert.ok(e.primarios.length >= 1 && e.primarios.length <= 3, 'primários: ' + e.id);
    assert.ok(e.secundarios.length <= 4, 'secundários: ' + e.id);
    for (const m of [...e.primarios, ...e.secundarios]) assert.ok(MUSCULOS[m], `músculo ${m}: ${e.id}`);
    assert.equal(new Set([...e.primarios, ...e.secundarios]).size, e.primarios.length + e.secundarios.length, 'músculo repetido: ' + e.id);
    for (const q of e.equip) assert.ok(EQUIPAMENTOS[q], `aparelho ${q}: ${e.id}`);
    for (const c of e.cuidado) assert.ok(CUIDADOS[c], `cuidado ${c}: ${e.id}`);
    assert.ok(e.posicao && e.posicao.length > 15, 'posição: ' + e.id);
    assert.ok(e.execucao.length >= 3 && e.execucao.length <= 6, 'passos: ' + e.id);
    for (const p of e.execucao) assert.ok(p.length > 10 && p.length <= 160, 'passo longo/curto: ' + e.id);
    assert.ok(e.respiracao && e.respiracao.length > 10, 'respiração: ' + e.id);
    assert.ok(e.dicas.length >= 2 && e.dicas.length <= 4, 'dicas: ' + e.id);
    assert.ok(e.erros.length >= 2 && e.erros.length <= 4, 'erros: ' + e.id);
    assert.ok(Array.isArray(e.aliases), 'aliases: ' + e.id);
    // fontes em que a técnica foi conferida: pelo menos uma, com organização, título e endereço https
    assert.ok(Array.isArray(e.fontes) && e.fontes.length >= 1 && e.fontes.length <= 3, 'fontes: ' + e.id);
    for (const ft of e.fontes) {
      assert.ok(ft && typeof ft.org === 'string' && ft.org.length >= 2 && ft.org.length <= 30, 'fonte sem organização: ' + e.id);
      assert.ok(typeof ft.titulo === 'string' && ft.titulo.length >= 3 && ft.titulo.length <= 200, 'fonte sem título: ' + e.id);
      assert.ok(typeof ft.url === 'string' && /^https:\/\/[\w.-]+\/[^\s'"<>]*$/.test(ft.url) && ft.url.length <= 300, 'endereço de fonte inválido: ' + e.id);
    }
  }
});

test('catálogo: todos os grupos, padrões principais e aparelhos têm exercícios', () => {
  for (const g of Object.keys(GRUPOS)) assert.ok(EXERCICIOS.some((e) => e.grupo === g), 'grupo vazio: ' + g);
  const usados = new Set(EXERCICIOS.flatMap((e) => e.equip));
  for (const q of Object.keys(EQUIPAMENTOS)) {
    assert.ok(usados.has(q), 'aparelho sem exercício: ' + q);
    assert.ok(CATEGORIAS_EQUIP[EQUIPAMENTOS[q].cat], 'categoria do aparelho: ' + q);
  }
  for (const m of Object.keys(MUSCULOS)) assert.ok(EXERCICIOS.some((e) => e.primarios.includes(m)), 'músculo sem exercício principal: ' + m);
});

test('catálogo: coerência entre tipo de registro e modalidade', () => {
  for (const e of EXERCICIOS) {
    if (e.grupo === 'cardio') assert.equal(e.registro, 'minutos', 'cardio deve registrar minutos: ' + e.id);
    if (e.registro === 'minutos') assert.equal(e.grupo, 'cardio', 'só cardio registra minutos: ' + e.id);
    if (e.modalidade === 'peso_corporal' && e.equip.length === 0) assert.notEqual(e.registro, 'peso_reps', 'peso corporal sem aparelho não registra carga: ' + e.id);
  }
});

test('animações: todo exercício tem a sua, com pelo menos 2 quadros', () => {
  for (const e of EXERCICIOS) {
    assert.ok(hasAnim(e.id), 'sem animação: ' + e.id);
    const a = animFor(e);
    assert.ok(['side', 'front', 'back'].includes(a.view), 'vista: ' + e.id);
    assert.ok(a.frames.length >= 2, 'quadros: ' + e.id);
    assert.ok(!a.missing, 'animação genérica: ' + e.id);
  }
});

test('modelos de treino: só exercícios existentes e doses válidas', () => {
  assert.ok(MODELOS.length >= 8);
  const ids = new Set();
  for (const m of MODELOS) {
    assert.ok(!ids.has(m.id)); ids.add(m.id);
    assert.ok(NIVEIS[m.nivel]);
    assert.ok(m.dias.length >= 1);
    for (const di of m.agenda) assert.ok(m.dias[di], `agenda aponta para treino inexistente: ${m.id}`);
    for (const d of m.dias) {
      assert.ok(d.itens.length >= 4, `treino curto demais: ${m.id} / ${d.nome}`);
      const vistos = new Set();
      for (const it of d.itens) {
        const ex = EX_POR_ID.get(it.ex);
        assert.ok(ex, `exercício inexistente no modelo ${m.id}: ${it.ex}`);
        assert.ok(!vistos.has(it.ex), `exercício repetido: ${m.id} / ${it.ex}`); vistos.add(it.ex);
        assert.ok(it.series >= 1 && it.series <= 6);
        assert.match(it.reps, /^\d{1,3}(-\d{1,3})?$/);
        assert.ok(it.descanso >= 0 && it.descanso <= 300);
        if (m.nivel === 1) assert.ok(ex.nivel <= 2, `exercício avançado em modelo iniciante: ${m.id} / ${it.ex}`);
      }
    }
  }
});

test('alimentos: valores coerentes (calorias batem com os macronutrientes)', () => {
  assert.ok(ALIMENTOS.length >= 120);
  const ids = new Set();
  for (const f of ALIMENTOS) {
    assert.ok(!ids.has(f.id), 'id repetido: ' + f.id); ids.add(f.id);
    assert.ok(CATEGORIAS_ALIMENTO[f.cat], 'categoria: ' + f.id);
    for (const k of ['kcal', 'p', 'c', 'g', 'fibra']) assert.ok(typeof f[k] === 'number' && f[k] >= 0, `${k}: ${f.id}`);
    assert.ok(f.p + f.c + f.g <= 101, 'macros somam mais de 100 g: ' + f.id);
    const est = 4 * f.p + 4 * f.c + 9 * f.g;
    assert.ok(Math.abs(est - f.kcal) <= Math.max(30, f.kcal * 0.25), `calorias incoerentes: ${f.id} (${f.kcal} vs ${Math.round(est)})`);
    assert.ok(f.porcao && f.porcao.g > 0 && f.porcao.desc, 'porção: ' + f.id);
    assert.ok([1, 2, 3, 4].includes(f.nova), 'NOVA: ' + f.id);
    assert.ok(['TACO', 'TBCA', 'USDA'].includes(f.fonte), 'fonte: ' + f.id);
    if (f.tags.includes('vegano')) assert.ok(f.tags.includes('vegetariano'), 'vegano implica vegetariano: ' + f.id);
    if (['carnes', 'peixes'].includes(f.cat)) assert.ok(!f.tags.includes('vegetariano'), 'carne marcada como vegetariana: ' + f.id);
    if (f.cat === 'ovos_laticinios') assert.ok(!f.tags.includes('vegano'), 'ovo/laticínio marcado como vegano: ' + f.id);
  }
});

test('base de conhecimento: toda resposta cita fontes existentes', () => {
  for (const item of [...FAQ_TREINO, ...FAQ_NUTRI]) {
    assert.ok(item.q.endsWith('?'), 'pergunta: ' + item.q);
    assert.ok(item.a.length >= 1);
    assert.ok(item.f.length >= 1, 'sem fonte: ' + item.q);
    for (const k of item.f) assert.ok(REFS[k], `fonte inexistente ${k}: ${item.q}`);
  }
  const usadas = new Set([...FAQ_TREINO, ...FAQ_NUTRI].flatMap((i) => i.f));
  for (const k of Object.keys(REFS)) assert.ok(typeof REFS[k] === 'string' && REFS[k].length > 30, 'referência curta: ' + k);
  assert.ok(usadas.size >= 40);
  assert.ok(buscarFaq(FAQ_TREINO, 'descanso entre séries')[0].q.toLowerCase().includes('descans'));
  assert.ok(buscarFaq(FAQ_NUTRI, 'proteina')[0].q.toLowerCase().includes('proteína'));
  assert.equal(buscarFaq(FAQ_NUTRI, 'xyzabc123').length, 0);
});

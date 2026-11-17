// Carga recomendada no treino: carga inicial pelo perfil (logic/carga.js) e prioridade do histórico (logic/progress.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import { cargaInicial, recomendacao, arredondar, fracaoDoPerfil, fatorIdade, temRegistro } from '../www/js/logic/carga.js';
import { sugestao, retomada, assistido } from '../www/js/logic/progress.js';
import { perfil } from '../www/js/logic/trainer.js';
import { EXERCICIOS, EX_POR_ID } from '../www/js/data/exercises.js';
import { FORCA_INICIANTE, BARRA_KG } from '../www/js/data/cargas.js';
import { REFS } from '../www/js/data/knowledge.js';

const AGORA = Date.parse('2026-11-10T18:00:00.000Z');
const DIA = 86400000;
const base = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'iniciante', pausa: 'treinando', dias: '3', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], remedios: ['nenhum'], foco: ['equilibrado'] };
const SEM_KG = new Set(['maquina', 'cabo', 'smith', 'peso_corporal', 'cardio', 'outros', 'kettlebell']);
const ALVOS = ['8-12', '6-8', '10-15', '15-20', '12', '30', '', 'abc', '0', '20-30'];

// gerador determinístico (não depende de Math.random)
let semente = 12345;
const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const um = (l) => l[Math.floor(rnd() * l.length)];
function perfilAleatorio() {
  const a = { ...base };
  a.idade = Math.round(10 + rnd() * 89);
  a.peso = um([0, 30, 45, 52.5, 60, 70, 85, 100, 130, 180, 250, NaN, -10, '80']);
  a.experiencia = um(['nunca', 'iniciante', 'intermediario', 'avancado', undefined]);
  a.pausa = a.experiencia === 'nunca' ? undefined : um(['treinando', '2a4s', '1a3m', '3a6m', 'mais6m', undefined]);
  a.condicoes = um([['nenhuma'], ['hipertensao'], ['cardiaco'], ['diabetes'], ['gestante'], ['posparto'], ['cronica'], ['renal'], ['hipertensao', 'diabetes']]);
  a.liberado = um(['sim', 'nao', undefined]);
  a.limitacoes = um([['nenhuma'], ['nenhuma'], ['ombro'], ['joelho'], ['lombar'], ['cotovelo'], ['punho']]);
  a.triagem = um([['nenhum'], ['nenhum'], ['nenhum'], ['dor_peito'], ['medico']]);
  return { a, sexo: um(['m', 'f', '', 'x', undefined]) };
}

const kgPossivel = (kg, equip) => (equip === 'barra' ? kg >= BARRA_KG && Math.abs((kg - BARRA_KG) / 2 - Math.round((kg - BARRA_KG) / 2)) < 1e-9 : kg >= 1 && Number.isInteger(kg) && (kg <= 10 || kg % 2 === 0));
const val = (r) => (r.kg == null ? 0 : r.kg);
const est = (r) => (r.estimativa == null ? 0 : r.estimativa);

test('carga: arredondamento para o que existe na academia (sempre para baixo)', () => {
  assert.equal(arredondar(19.9, 'barra'), null);
  assert.equal(arredondar(20, 'barra'), 20);
  assert.equal(arredondar(25.4, 'barra'), 24);
  assert.equal(arredondar(36, 'barra'), 36);
  assert.equal(arredondar(0.9, 'halter'), null);
  assert.equal(arredondar(6.9, 'halter'), 6);
  assert.equal(arredondar(10, 'halter'), 10);
  assert.equal(arredondar(13.9, 'halter'), 12);
  assert.equal(arredondar(14.5, 'halter'), 14);
  for (const x of [NaN, -5, 0, undefined, null, Infinity, '30']) { assert.equal(arredondar(x, 'barra'), null); assert.equal(arredondar(x, 'halter'), null); }
});

test('carga: dados por exercício só em peso livre, com fonte existente', () => {
  for (const [id, d] of Object.entries(FORCA_INICIANTE)) {
    const ex = EX_POR_ID.get(id);
    assert.ok(ex, 'exercício inexistente: ' + id);
    assert.equal(ex.registro, 'peso_reps', id);
    assert.ok(ex.modalidade === (d.equip === 'barra' ? 'barra' : 'halteres'), id);
    assert.ok(REFS[d.fonte], 'fonte ausente: ' + d.fonte);
    for (const g of [d.h, d.m].filter(Boolean)) assert.ok(g.rm > g.dp && g.dp > 0 && g.peso > 0 && g.dpPeso > 0, id);
  }
});

test('carga: frações e idade nunca sobem a carga nos perfis de cuidado', () => {
  assert.deepEqual([20, 44, 45, 59, 60, 90].map(fatorIdade), [1, 1, 0.9, 0.9, 0.8, 0.8]);
  const f = (a) => fracaoDoPerfil(perfil({ ...base, ...a })).f;
  assert.equal(f({}), 0.5);
  assert.equal(f({ experiencia: 'intermediario' }), 0.6);
  assert.equal(f({ experiencia: 'intermediario', pausa: '1a3m' }), 0.5);
  assert.equal(f({ condicoes: ['hipertensao'] }), 0.4);
  assert.equal(f({ condicoes: ['cardiaco'], liberado: 'sim' }), 0.3);
  assert.equal(f({ idade: 65, experiencia: 'nunca' }), 0.3);
  assert.equal(f({ idade: 65, experiencia: 'avancado' }), 0.4);
});

test('carga: milhares de perfis × todo o catálogo, sem número inválido nem kg onde não cabe', () => {
  store.update((s) => { s.sessions = []; });
  let comKg = 0, total = 0;
  for (let p = 0; p < 2000; p++) {
    const { a, sexo } = perfilAleatorio();
    const alvo = um(ALVOS);
    for (const ex of EXERCICIOS) {
      const r = cargaInicial(ex.id, alvo, { respostas: a, sexo });
      total++;
      assert.ok(r && typeof r.linha === 'string' && r.linha.length > 0 && r.linha.length <= 41, `linha (${ex.id}): ${r && r.linha}`);
      for (const t of r.porque) assert.ok(typeof t === 'string' && t.length && !/undefined|NaN|null|Infinity/.test(t), `texto inválido (${ex.id}): ${t}`);
      for (const k of r.refs) assert.ok(REFS[k], 'fonte ausente: ' + k);
      assert.ok(r.estimativa == null || (Number.isFinite(r.estimativa) && r.estimativa > 0), `estimativa (${ex.id}): ${r.estimativa}`);
      if (r.kg == null) continue;
      comKg++;
      assert.ok(Number.isFinite(r.kg) && r.kg > 0, `kg inválido (${ex.id}): ${r.kg}`);
      assert.equal(ex.registro, 'peso_reps', 'kg só em exercício de carga: ' + ex.id);
      assert.ok(!SEM_KG.has(ex.modalidade) && !assistido(ex.id), 'kg em máquina, cabo, Smith, peso do corpo ou cardio: ' + ex.id);
      assert.ok(FORCA_INICIANTE[ex.id], 'kg sem dado de estudo: ' + ex.id);
      assert.ok(kgPossivel(r.kg, FORCA_INICIANTE[ex.id].equip), `kg impossível na academia (${ex.id}): ${r.kg}`);
      assert.ok(r.kg <= r.estimativa + 1e-9, 'o arredondamento é para baixo');
      assert.equal(r.origem, 'perfil');
      const pf = perfil(a);
      assert.ok(!pf.jovem && !pf.gestante && !pf.posparto && !pf.bloqueado, 'sem kg para menor, gestante, pós-parto ou sem liberação');
      assert.ok(sexo === 'm' || FORCA_INICIANTE[ex.id].m, 'dado só de homens não vale para mulher nem para sexo não informado');
    }
  }
  assert.ok(total >= 500000 && comKg > 50, `cobertura: ${comKg} de ${total}`);
});

test('carga: perfil de cuidado nunca recebe mais que o perfil comum equivalente', () => {
  const variantes = [
    { idade: 65 }, { idade: 50 }, { idade: 16 }, { idade: 15 }, { experiencia: 'nunca', pausa: undefined },
    { condicoes: ['hipertensao'] }, { condicoes: ['cardiaco'], liberado: 'sim' }, { condicoes: ['gestante'], liberado: 'sim' },
    { condicoes: ['posparto'], liberado: 'sim' }, { condicoes: ['diabetes'] }, { condicoes: ['cronica'] }, { pausa: '2a4s' }, { pausa: '3a6m' }, { pausa: 'mais6m' },
    { limitacoes: ['ombro'] }, { limitacoes: ['cotovelo'] }, { limitacoes: ['lombar'] }, { triagem: ['medico'] },
  ];
  let comparados = 0;
  for (const peso of [45, 60, 75, 90, 120]) for (const experiencia of ['iniciante', 'intermediario', 'avancado']) for (const sexo of ['m', 'f', '']) {
    const comum = { ...base, peso, experiencia };
    for (const id of Object.keys(FORCA_INICIANTE)) for (const alvo of ['8-12', '12-15', '30']) {
      const c = cargaInicial(id, alvo, { respostas: comum, sexo });
      for (const v of variantes) {
        const r = cargaInicial(id, alvo, { respostas: { ...comum, ...v }, sexo });
        assert.ok(val(r) <= val(c) && est(r) <= est(c) + 1e-9, `${id} ${JSON.stringify(v)}: ${val(r)} > ${val(c)}`);
        comparados++;
      }
      const dor = cargaInicial(id, alvo, { respostas: comum, sexo, dor: { nivel: 'leve', texto: 'Dor' } });
      assert.equal(dor.kg, null, 'com dor na região, sem número');
      // sexo não informado nunca dá mais que o masculino
      assert.ok(val(cargaInicial(id, alvo, { respostas: comum, sexo: '' })) <= val(cargaInicial(id, alvo, { respostas: comum, sexo: 'm' })));
    }
  }
  assert.ok(comparados > 9000);
  // gestação, menores, pressão alta e coração: lembrete de não prender a respiração quando há carga
  const g = cargaInicial('supino-reto-barra', '8-12', { respostas: { ...base, condicoes: ['gestante'], liberado: 'sim' }, sexo: 'f' });
  assert.equal(g.kg, null); assert.ok(g.porque.some((t) => /não prenda a respiração/.test(t)));
  const hpa = cargaInicial('supino-reto-barra', '8-12', { respostas: { ...base, peso: 80, condicoes: ['hipertensao'] }, sexo: 'm' });
  assert.ok(hpa.porque.some((t) => /Valsalva/.test(t)));
  assert.equal(cargaInicial('supino-reto-barra', '8-12', { respostas: { ...base, idade: 16 }, sexo: 'm' }).kg, null);
});

test('carga: exemplos (homem de 25 anos e 70 kg, intermediário de 35 e 85 kg, mulher de 65 que nunca treinou)', () => {
  const A = { respostas: { ...base, idade: 25, peso: 70 }, sexo: 'm' };
  const B = { respostas: { ...base, idade: 35, peso: 85, experiencia: 'intermediario' }, sexo: 'm' };
  const C = { respostas: { ...base, idade: 65, peso: 65, experiencia: 'nunca', pausa: undefined }, sexo: 'f' };
  const kg = (ctx, id) => cargaInicial(id, '8-12', ctx).kg;
  assert.equal(kg(A, 'supino-reto-barra'), 24); assert.equal(kg(A, 'remada-unilateral-halter-serrote'), 14);
  assert.equal(kg(B, 'supino-reto-barra'), 34); assert.equal(kg(B, 'remada-unilateral-halter-serrote'), 20);
  assert.equal(kg(C, 'supino-reto-barra'), null); assert.equal(kg(C, 'remada-unilateral-halter-serrote'), null);
  assert.ok(cargaInicial('supino-reto-barra', '8-12', C).estimativa < BARRA_KG && cargaInicial('supino-reto-barra', '8-12', C).porque[0].includes('menos que a barra'));
  for (const ctx of [A, B, C]) for (const id of ['agachamento-livre-barra', 'leg-press-45', 'puxada-frente-aberta', 'cadeira-extensora']) {
    const r = cargaInicial(id, '8-12', ctx);
    assert.equal(r.kg, null, id); assert.equal(r.origem, 'esforco'); assert.match(r.linha, /2 a 3 de sobra/);
  }
  const sup = cargaInicial('supino-reto-barra', '8-12', A);
  assert.equal(sup.linha, 'Estimativa pelo perfil · 1ª série é teste');
  assert.ok(sup.porque.some((t) => /Sobraram mais de 3: aumente/.test(t) && /Não chegou a 8: diminua/.test(t)));
  // sem entrevista: sem número
  assert.equal(cargaInicial('supino-reto-barra', '8-12', {}).kg, null);
  // peso do corpo, elástico e cardio
  for (const e of EXERCICIOS.filter((x) => x.registro === 'reps')) { const r = cargaInicial(e.id, '8-12', A); assert.equal(r.origem, 'reps'); assert.equal(r.kg, null); assert.match(r.linha, /8 a 12 repetições/); }
  assert.equal(cargaInicial(EXERCICIOS.find((e) => e.registro === 'minutos').id, '20', A).origem, 'tempo');
});

test('carga: o histórico do exercício tem prioridade sobre o perfil', () => {
  const iso = (t) => new Date(t).toISOString();
  const sess = (d, ex, sets) => ({ id: 's' + d + ex, planId: '', diaId: '', nome: 't', inicio: iso(AGORA - d * DIA), fim: iso(AGORA - d * DIA + 3600000), nota: '', itens: [{ ex, alvo: '8-12', descanso: 90, sets: sets.map(([kg, reps]) => ({ kg, reps, seg: null, ok: true })) }] });
  const A = { respostas: { ...base, idade: 25, peso: 70 }, sexo: 'm' };
  store.update((s) => { s.sessions = []; });
  assert.equal(temRegistro('supino-reto-barra'), false);
  const semHist = recomendacao('supino-reto-barra', '8-12', 3, A, AGORA);
  assert.equal(semHist.origem, 'perfil'); assert.equal(semHist.kg, 24); assert.equal(semHist.reps, 8);
  store.update((s) => { s.sessions = [sess(3, 'supino-reto-barra', [[30, 10], [30, 9], [30, 8]])]; });
  const r = recomendacao('supino-reto-barra', '8-12', 3, A, AGORA);
  const esperado = retomada('supino-reto-barra', sugestao('supino-reto-barra', '8-12', 3), '8-12', AGORA);
  assert.equal(r.origem, 'historico'); assert.equal(r.kg, esperado.kg); assert.equal(r.kg, 30); assert.equal(r.reps, esperado.reps);
  assert.equal(r.linha, 'Última vez: 30 kg × 10');
  assert.deepEqual(r.porque, [esperado.texto]);
  // o que a pessoa fez vale mesmo se for muito acima ou abaixo da estimativa
  store.update((s) => { s.sessions = [sess(3, 'supino-reto-barra', [[100, 12], [100, 12]]), sess(6, 'supino-reto-barra', [[100, 12], [100, 12]])]; });
  const sobe = recomendacao('supino-reto-barra', '8-12', 2, A, AGORA);
  assert.equal(sobe.origem, 'historico'); assert.ok(sobe.kg > 100); assert.match(sobe.linha, /100 kg × 12 → hoje/);
  // máquina sem estudo: com histórico, a sugestão por histórico vale (com kg)
  store.update((s) => { s.sessions = [sess(3, 'leg-press-45', [[80, 10], [80, 10]])]; });
  assert.equal(recomendacao('leg-press-45', '8-12', 2, A, AGORA).kg, 80);
  // por tempo e por repetições
  const min = EXERCICIOS.find((e) => e.registro === 'minutos').id;
  store.update((s) => { s.sessions = [{ ...sess(3, min, []), itens: [{ ex: min, alvo: '20', descanso: 0, sets: [{ kg: null, reps: null, seg: 25, ok: true }] }] }]; });
  assert.equal(recomendacao(min, '20', 1, A, AGORA).origem, 'historico');
  store.update((s) => { s.sessions = []; });
  // exercício inexistente não quebra
  const x = recomendacao('nao-existe', '8-12', 3, A, AGORA);
  assert.equal(x.kg, null);
});

// Avaliação do treino montado à mão: o que treina, para que serve, o que falta e sobra, e se serve para o perfil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCICIOS, EX_POR_ID } from '../www/js/data/exercises.js';
import { MODELOS } from '../www/js/data/templates.js';
import { REFS } from '../www/js/data/knowledge.js';
import { avaliarDia, avaliarPlano, sugestoesPara, trocasPara } from '../www/js/logic/avaliacao.js';
import { gerarPlano, perfil, motivosContra, soManual, tetoSeries, pesosDoExercicio } from '../www/js/logic/trainer.js';

const GYM = { all: true, has: {} };
const base = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };
const it = (ex, series = 3, reps = '8-12', descanso = 90) => ({ ex, series, reps, descanso });
const dia = (id, ...itens) => ({ id, nome: 'Treino ' + id, foco: '', itens });
const semLixo = (s) => typeof s === 'string' && s.length > 0 && !/undefined|null|NaN|\[object|  /.test(s);
const textos = (a) => [a.conclusao, a.tipo && a.tipo.texto, a.definicao, a.foco && a.foco.texto, ...(a.equilibrio || []).map((x) => x.texto), ...(a.corrida || []).map((x) => x.texto), ...(a.perfil ? [...a.perfil.dose, ...a.perfil.problemas.flatMap((p) => [p.nome, ...p.motivos])] : [])].filter((x) => x !== undefined && x !== '');
const confereTextos = (a, rot) => { for (const t of textos(a)) assert.ok(semLixo(t), `texto com lixo (${rot}): ${t}`); for (const k of a.refs) assert.ok(REFS[k], 'fonte ausente: ' + k); };

test('treino só de peito: diz o foco, o que mais e o que menos trabalha, e para que serve', () => {
  const d = dia('a', it('supino-maquina'), it('supino-inclinado-maquina'), it('peck-deck', 3, '10-15', 60));
  const a = avaliarDia(d, {});
  assert.equal(a.vazio, false);
  assert.deepEqual(a.foco.grupos[0], 'peito');
  assert.equal(a.mais.g, 'peito');
  assert.equal(a.mais.series, 9);
  assert.ok(a.menos && a.menos.series < a.mais.series && a.menos.g !== 'peito');
  assert.equal(a.tipo.id, 'hipertrofia');
  assert.match(a.conclusao, /^Treino de peito, de ganho de massa, com cerca de \d+ min\./);
  assert.equal(a.semPerfil, true);
  assert.match(a.conclusao, /Responda ao Treinador/);
  assert.match(a.definicao, /Definição não é um tipo de treino/);
  assert.equal(a.exercicios, 3); assert.equal(a.series, 9);
  confereTextos(a, 'peito');
  // no plano: sem costas nem pernas, e empurra mais do que puxa
  const p = avaliarPlano({ dias: [d], agenda: { 1: 'a', 4: 'a' } }, { respostas: base, gym: GYM });
  assert.equal(p.treinos, 2);
  assert.equal(p.volume.peito, 18);
  assert.ok(p.falta.some((x) => x.g === 'costas' && x.series === 0) && p.falta.some((x) => x.g === 'quadriceps'));
  assert.ok(p.equilibrio.some((x) => x.id === 'empurra-puxa') && p.equilibrio.some((x) => x.id === 'sem-pernas'));
  assert.equal(p.menos.series, 0);
  assert.match(p.conclusao, /Fica sem treino de /);
  confereTextos(p, 'plano peito');
});

test('30 séries de um músculo: acusa o excesso no treino e na semana, com o teto do nível', () => {
  const d = dia('a', ...['rosca-direta-barra-reta', 'rosca-direta-barra-w', 'rosca-alternada-halteres', 'rosca-martelo-halteres', 'rosca-concentrada', 'rosca-scott-barra-w'].map((id) => it(id, 5, '10-12', 60)));
  const a = avaliarDia(d, { respostas: { ...base, experiencia: 'iniciante' }, gym: GYM });
  assert.equal(a.diretas.biceps, 30);
  assert.ok(a.sobra.some((x) => x.g === 'biceps' && x.series === 30 && x.teto === tetoSeries(1)));
  assert.match(a.conclusao, /séries demais de bíceps/i);
  assert.ok(a.repetidos.length >= 1 && a.repetidos[0].nomes.length >= 3, 'exercícios redundantes não apontados');
  const p = avaliarPlano({ dias: [d], agenda: { 2: 'a' } }, { respostas: base, gym: GYM });
  assert.equal(p.grupos.find((x) => x.g === 'biceps').faixa, 'muito');
  assert.ok(p.sobra.some((x) => x.g === 'biceps' && x.teto === tetoSeries(2)));
  // sem perfil, o teto é o do nível mais alto (20): 30 séries ainda passam
  assert.ok(avaliarPlano({ dias: [d], agenda: { 2: 'a' } }, {}).sobra.some((x) => x.g === 'biceps' && x.teto === 20));
});

test('plano sem pernas: aponta os grupos que ficaram sem treino e o desequilíbrio', () => {
  const A = dia('a', it('supino-maquina', 4), it('supino-inclinado-maquina', 4), it('desenvolvimento-maquina', 3));
  const B = dia('b', it('puxada-frente-aberta', 4), it('remada-baixa-triangulo', 4), it('rosca-direta-barra-w', 3));
  for (const d of [A, B]) for (const x of d.itens) assert.ok(EX_POR_ID.has(x.ex), 'exercício do teste não existe: ' + x.ex);
  const p = avaliarPlano({ dias: [A, B], agenda: { 1: 'a', 2: 'b', 4: 'a', 5: 'b' } }, { respostas: base, gym: GYM });
  for (const g of ['quadriceps', 'posteriores', 'gluteos']) { assert.ok(p.falta.some((x) => x.g === g && x.series === 0), g); assert.equal(p.grupos.find((x) => x.g === g).faixa, 'nada'); }
  assert.ok(p.equilibrio.some((x) => x.id === 'sem-pernas'));
  assert.ok(!p.equilibrio.some((x) => x.id === 'empurra-puxa'), 'costas e peito estão equilibrados');
  assert.match(p.conclusao, /Fica sem treino de quadríceps, posteriores e glúteos\./);
  assert.equal(p.grupos.find((x) => x.g === 'peito').faixa, 'bom');
});

test('força (3 a 5 repetições) × resistência (15 a 20) × misto, e a linha sobre definição', () => {
  const forca = dia('f', it('agachamento-smith', 4, '3-5', 180), it('supino-reto-smith', 4, '3-5', 180), it('puxada-frente-aberta', 3, '4-6', 150));
  const res = dia('r', it('agachamento-smith', 3, '15-20', 45), it('supino-reto-smith', 3, '15-20', 45), it('puxada-frente-aberta', 2, '15-20', 45));
  const af = avaliarDia(forca, {}), ar = avaliarDia(res, {});
  assert.equal(af.tipo.id, 'forca'); assert.match(af.tipo.texto, /^Força/); assert.doesNotMatch(af.tipo.texto, /descanse de 2 a 3/);
  assert.equal(ar.tipo.id, 'resistencia'); assert.match(ar.tipo.texto, /^Resistência muscular/);
  assert.match(af.conclusao, /de força/); assert.match(ar.conclusao, /de resistência muscular/);
  // força com descanso curto: avisa
  const curto = avaliarDia(dia('c', it('agachamento-smith', 4, '3-5', 60), it('supino-reto-smith', 4, '4-6', 60)), {});
  assert.match(curto.tipo.texto, /descanse de 2 a 3 minutos/);
  const misto = avaliarDia(dia('m', it('agachamento-smith', 3, '3-5', 180), it('supino-reto-smith', 3, '8-12', 90), it('puxada-frente-aberta', 3, '15-20', 45)), {});
  assert.equal(misto.tipo.id, 'misto');
  // "definição" nunca aparece como tipo de treino: só na explicação
  for (const a of [af, ar, curto, misto]) { assert.doesNotMatch(a.tipo.texto + a.conclusao, /defini/i); assert.match(a.definicao, /comer menos do que se gasta/); }
  assert.ok(af.refs.includes('helms2014') && af.refs.includes('schoenfeld2021'));
  // o tempo estimado cresce com o descanso
  assert.ok(af.duracaoMin > ar.duracaoMin);
});

test('iniciante com exercícios de nível avançado: não recomendado, com o motivo e a troca', () => {
  const n3 = EXERCICIOS.filter((x) => x.nivel === 3 && x.grupo !== 'funcional' && x.grupo !== 'cardio' && !soManual(x.id)).slice(0, 4);
  assert.equal(n3.length, 4);
  const d = dia('a', ...n3.map((x) => it(x.id)));
  const ctx = { respostas: { ...base, experiencia: 'iniciante' }, gym: GYM };
  const a = avaliarDia(d, ctx);
  assert.equal(a.semPerfil, false);
  assert.equal(a.perfil.veredito, 'nao');
  assert.equal(a.perfil.problemas.length, 4);
  for (const p of a.perfil.problemas) {
    assert.ok(p.grave && p.motivos.some((m) => /nível avançado, acima do seu/.test(m)), p.nome);
    if (p.troca) { const t = EX_POR_ID.get(p.troca.ex); assert.ok(t && t.nivel === 1, 'troca acima do nível: ' + p.troca.ex); assert.equal(motivosContra(t, perfil(ctx.respostas), GYM, []).length, 0); }
  }
  assert.ok(a.perfil.problemas.some((p) => p.troca), 'nenhuma troca sugerida');
  assert.match(a.conclusao, /não é recomendado como está/);
  // o mesmo treino para um avançado: serve
  const b = avaliarDia(d, { respostas: { ...base, experiencia: 'avancado' }, gym: GYM });
  assert.ok(!b.perfil.problemas.some((p) => p.motivos.some((m) => /acima do seu/.test(m))));
  // quem nunca treinou com 5 séries por exercício: aviso de dose
  const c = avaliarDia(dia('c', it('supino-maquina', 5), it('leg-press-horizontal', 5)), { respostas: { ...base, experiencia: 'nunca' }, gym: GYM });
  assert.ok(c.perfil.dose.some((t) => /1 a 3 séries/.test(t)));
  assert.equal(c.perfil.veredito, 'ajustes');
});

test('perfil com limitação, condição de saúde e dor: cada um muda a avaliação', () => {
  const d = dia('a', it('agachamento-smith', 3, '6-8', 120), it('leg-press-45', 3, '8-12', 90), it('supino-maquina'), it('puxada-frente-aberta'));
  const limpo = avaliarDia(d, { respostas: base, gym: GYM });
  assert.equal(limpo.perfil.veredito, 'sim');
  assert.match(limpo.conclusao, /Serve para o seu perfil\./);
  // limitação no joelho
  const joelho = avaliarDia(d, { respostas: { ...base, limitacoes: ['joelho'] }, gym: GYM });
  const pj = joelho.perfil.problemas.filter((p) => p.motivos.some((m) => /cuidado com joelho/.test(m)));
  assert.ok(pj.length >= 2 && pj.every((p) => p.grave));
  for (const p of pj) if (p.troca) assert.ok(!EX_POR_ID.get(p.troca.ex).cuidado.includes('joelho'), 'troca que também pede cuidado com o joelho');
  assert.notEqual(joelho.perfil.veredito, 'sim');
  // pressão alta: cargas altas (menos de 10 repetições) e exercícios marcados
  const pressao = avaliarDia(d, { respostas: { ...base, condicoes: ['hipertensao'] }, gym: GYM });
  assert.ok(pressao.perfil.dose.some((t) => /pressão alta.*10 repetições ou mais/.test(t)));
  // diabetes: 8 repetições ou mais; e 4 treinos em dias seguidos
  const diab = { respostas: { ...base, condicoes: ['diabetes'] }, gym: GYM };
  assert.ok(avaliarDia(d, diab).perfil.dose.some((t) => /diabetes.*8 repetições ou mais/i.test(t)));
  const pd = avaliarPlano({ dias: [dia('a', it('supino-maquina', 3, '10-12'), it('leg-press-horizontal', 3, '10-12'), it('puxada-frente-aberta', 3, '10-12'))], agenda: { 1: 'a', 2: 'a', 3: 'a', 4: 'a' } }, diab);
  assert.ok(pd.perfil.dose.some((t) => /até 3 treinos de força por semana, em dias não seguidos/.test(t)));
  const pd3 = avaliarPlano({ dias: [dia('a', it('supino-maquina', 3, '10-12'), it('leg-press-horizontal', 3, '10-12'), it('puxada-frente-aberta', 3, '10-12'))], agenda: { 1: 'a', 3: 'a', 5: 'a' } }, diab);
  assert.ok(!pd3.perfil.dose.some((t) => /dias não seguidos/.test(t)));
  // menor de 18: barra livre composta e cargas altas
  const jovem = avaliarDia(dia('j', it('supino-reto-barra', 3, '6-8', 120), it('puxada-frente-aberta', 3, '10-15')), { respostas: { ...base, idade: 16 }, gym: GYM });
  assert.ok(jovem.perfil.problemas.some((p) => p.ex === 'supino-reto-barra' && p.grave && p.motivos.some((m) => /barra livre/.test(m))));
  assert.ok(jovem.perfil.dose.some((t) => /Antes dos 18/.test(t)));
  // dor de alerta no joelho: exercícios que carregam o joelho ficam de fora, com ou sem perfil
  const dor = [{ id: 'd1', data: '2026-11-10', onde: 'joelho', lado: '', tipo: 'articular', quando: 'durante', nivel: 8, nota: '', fim: '', dias: 3 }];
  for (const ctx of [{ respostas: base, gym: GYM, dores: dor }, { dores: dor }]) {
    const a = avaliarDia(d, ctx);
    const pp = a.perfil.problemas.filter((p) => p.motivos.some((m) => /região da dor/.test(m)));
    assert.ok(pp.some((p) => p.ex === 'agachamento-smith' && p.grave) && pp.some((p) => p.ex === 'leg-press-45'), 'dor no joelho não apontou os exercícios de joelho');
    assert.ok(!pp.some((p) => p.ex === 'supino-maquina'));
  }
  // menos de 14 anos: sem avaliação de perfil, com a frase certa
  const crianca = avaliarDia(d, { respostas: { ...base, idade: 12 }, gym: GYM });
  assert.equal(crianca.semPerfil, true);
  assert.match(crianca.conclusao, /Antes dos 14 anos/);
  // aparelho que a pessoa não marcou: aviso, não regra de segurança
  const semAparelho = avaliarDia(d, { respostas: { ...base, local: 'minha' }, gym: { all: false, has: { supino_maquina: true } } });
  assert.ok(semAparelho.perfil.problemas.some((p) => !p.grave && p.motivos.some((m) => /aparelho que você não marcou/.test(m))));
});

test('quem corre: treino de pernas na véspera da corrida forte ou do longo é apontado no plano', () => {
  const pernas = dia('p', it('leg-press-horizontal'), it('cadeira-extensora'), it('mesa-flexora'));
  const cima = dia('c', it('supino-maquina'), it('puxada-frente-aberta'));
  const plano = { dias: [pernas, cima], agenda: { 2: 'p', 4: 'c', 6: 'p' } };
  const a = avaliarPlano(plano, { corrida: { foco: 'corrida', fortalecimento: 'nao', fortes: [3], longo: 0, dias: [1, 3, 5, 0] } });
  // (corrida em 4 dias + musculação em 3 = semana sem descanso: também é apontado)
  assert.deepEqual(a.corrida.map((x) => x.wd), [2, 6, null]);
  assert.match(a.corrida[2].texto, /sem nenhum dia de descanso/);
  assert.match(a.corrida[0].texto, /Treino de pernas na terça, véspera/);
  assert.ok(a.refs.includes('blagrove2018'));
  assert.equal(avaliarPlano(plano, {}).corrida.length, 0);
  assert.equal(avaliarPlano(plano, { corrida: { fortes: [5], longo: null, dias: [5] } }).corrida.length, 0);
});

test('plano vazio e entradas inválidas: nunca quebra, nunca inventa', () => {
  for (const lixo of [undefined, null, 0, '', 'x', [], {}, { dias: null }, { dias: [] }, { dias: [null, 1, 'a'] }, { dias: [{ id: 'a', itens: [] }], agenda: { 1: 'a' } }, { dias: [{ id: 'a', itens: 'x' }] }, { dias: [{ id: 'a', itens: [{ ex: 'nao-existe', series: 3, reps: '10' }] }], agenda: { 1: 'a' } }]) {
    const p = avaliarPlano(lixo, lixo);
    assert.equal(p.vazio, true); assert.equal(p.conclusao, 'Este plano ainda não tem exercícios.');
    const d = avaliarDia(lixo, lixo);
    assert.equal(d.vazio, true); assert.equal(d.conclusao, 'Este treino ainda não tem exercícios.');
  }
  // itens estranhos são ignorados; os bons continuam valendo
  const d = dia('a', it('supino-maquina', 3), { ex: 'supino-maquina', series: -2, reps: '10' }, { ex: 'supino-maquina', series: 1e9, reps: '10' }, { ex: 42, series: 3 }, null, 'x', { ex: '<img src=x onerror=alert(1)>', series: 3, reps: '10' }, { ex: '__proto__', series: 3, reps: '10' }, { ex: 'peck-deck', series: '3', reps: { a: 1 }, descanso: 'abc' }, { ex: 'puxada-frente-aberta', series: 2.4, reps: '999-1', descanso: -50 });
  const a = avaliarDia(d, { respostas: { objetivo: 'x', idade: 'abc' }, gym: 'x', dores: 'x', corrida: 7 });
  assert.equal(a.exercicios, 3);
  assert.equal(a.series, 8);
  assert.equal(a.semPerfil, true);
  assert.ok(Number.isFinite(a.duracaoMin) && a.duracaoMin >= 5 && a.duracaoMin < 600);
  confereTextos(a, 'lixo');
  // contexto com tipos errados e dores inválidas não quebra
  for (const ctx of [null, 5, 'x', [], { respostas: [] }, { respostas: base, gym: null, dores: [null, 1, { onde: 'x' }], corrida: { fortes: 'x', longo: 'y' } }, { respostas: { ...base, limitacoes: 'x', condicoes: 5 } }]) {
    const p = avaliarPlano({ dias: [d], agenda: { 1: 'a' } }, ctx);
    assert.equal(p.vazio, false); confereTextos(p, 'contexto ' + JSON.stringify(ctx));
  }
  // agenda que aponta para treino que não existe: conta os treinos uma vez cada
  assert.equal(avaliarPlano({ dias: [d], agenda: { 1: 'zzz', 9: 'a', x: 'a' } }, {}).treinos, 1);
  // só cardio: não pede grupos musculares
  const c = avaliarPlano({ dias: [dia('k', it('caminhada-esteira', 1, '30', 0))], agenda: { 1: 'k' } }, {});
  assert.equal(c.falta.length, 0); assert.match(c.conclusao, /^Plano de cardio/);
  assert.match(avaliarDia(dia('k', it('caminhada-esteira', 1, '30', 0)), {}).conclusao, /^Treino de cardio, com cerca de 35 min\./);
});

test('exercícios que o Treinador não indica sozinho são apontados para qualquer pessoa', () => {
  const manual = EXERCICIOS.filter((x) => soManual(x.id));
  assert.ok(manual.length >= 4 && manual.some((x) => x.id === 'agachamento-hack-invertido'));
  for (const ex of manual) {
    for (const ctx of [{}, { respostas: { ...base, experiencia: 'avancado' }, gym: GYM }]) {
      const a = avaliarDia(dia('a', it(ex.id), it('supino-maquina'), it('puxada-frente-aberta'), it('leg-press-horizontal')), ctx);
      const p = a.perfil.problemas.find((x) => x.ex === ex.id);
      assert.ok(p && p.grave && p.motivos.some((m) => /sem supervisão/.test(m)), ex.id);
      if (p.troca) assert.ok(!soManual(p.troca.ex));
    }
  }
  // saltos e potência: com perfil, regra de segurança
  const a = avaliarDia(dia('a', it('salto-caixa', 3, '5'), it('burpee', 3, '10')), { respostas: base, gym: GYM });
  assert.equal(a.perfil.problemas.filter((p) => p.grave && p.motivos.some((m) => /potência/.test(m))).length, 2);
  assert.equal(a.perfil.veredito, 'nao');
});

test('catálogo inteiro e modelos prontos: a avaliação nunca quebra e os textos saem limpos', () => {
  const perfis = [{}, { respostas: base, gym: GYM }, { respostas: { ...base, experiencia: 'nunca', idade: 67, condicoes: ['hipertensao'], limitacoes: ['joelho', 'ombro'] }, gym: GYM }, { respostas: { ...base, idade: 15, local: 'corporal' }, gym: GYM }, { respostas: { ...base, condicoes: ['gestante'] }, gym: { all: false, has: {} } }];
  let n = 0;
  for (const ex of EXERCICIOS) for (const ctx of perfis) {
    const a = avaliarDia(dia('a', it(ex.id, 3, ex.registro === 'minutos' ? '20' : '10-12', 60)), ctx);
    assert.equal(a.vazio, false, ex.id);
    confereTextos(a, ex.id);
    for (const p of a.perfil.problemas) { assert.ok(p.motivos.length && p.motivos.every(semLixo)); if (p.troca) assert.ok(EX_POR_ID.has(p.troca.ex) && p.troca.ex !== ex.id); }
    n++;
  }
  assert.ok(n >= 1400);
  for (const m of MODELOS) {
    const dias = m.dias.map((d, i) => ({ id: 'd' + i, ...d }));
    const agenda = {}; dias.forEach((d, i) => { agenda[[1, 2, 4, 5, 6, 3][i] ?? 0] = d.id; });
    for (const ctx of perfis) {
      const p = avaliarPlano({ dias, agenda }, ctx);
      assert.equal(p.vazio, false, m.id);
      assert.equal(p.grupos.length, 10);
      assert.ok(p.duracaoMin.menor >= 5 && p.duracaoMin.maior <= 200, m.id + ' ' + JSON.stringify(p.duracaoMin));
      confereTextos(p, m.id);
      for (const d of dias) confereTextos(avaliarDia(d, ctx), m.id + '/' + d.nome);
    }
  }
});

test('coerência com o Treinador: o plano que ele monta para um perfil é aprovado pela avaliação desse perfil', () => {
  let n = 0;
  const falhas = [];
  for (const objetivo of ['hipertrofia', 'emagrecimento', 'forca', 'saude', 'resistencia']) for (const experiencia of ['nunca', 'iniciante', 'intermediario', 'avancado']) for (const dias of ['2', '3', '4', '5', '6']) for (const local of ['completa', 'halteres', 'corporal'])
    for (const extra of [{}, { idade: 16 }, { idade: 68 }, { condicoes: ['hipertensao'] }, { condicoes: ['diabetes'] }, { condicoes: ['gestante'] }, { limitacoes: ['joelho', 'lombar'] }, { limitacoes: ['ombro'], tempo: '30' }, { triagem: ['dor_peito'] }]) {
      const a = { ...base, objetivo, experiencia, dias, local, ...extra };
      const p = gerarPlano(a, GYM, n % 5);
      if (!p || !p.dias.length) continue;
      n++;
      const av = avaliarPlano({ dias: p.dias, agenda: p.agenda }, { respostas: a, gym: GYM });
      const rot = JSON.stringify({ objetivo, experiencia, dias, local, ...extra });
      const graves = av.perfil.problemas.filter((x) => x.grave);
      if (graves.length) falhas.push(`${rot}: exercício do Treinador reprovado — ${graves.map((x) => x.ex + ' (' + x.motivos.join('; ') + ')').join(', ')}`);
      const dose = av.perfil.dose.filter((t) => !/liberação médica antes/.test(t));
      if (dose.length) falhas.push(`${rot}: dose do Treinador reprovada — ${dose.join(' | ')}`);
      if (av.sobra.length) falhas.push(`${rot}: séries demais — ${av.sobra.map((x) => x.g + ' ' + x.series).join(', ')}`);
      // empurrar mais do que puxar só é aceito quando o próprio Treinador avisou que não havia como treinar as costas
      if (av.equilibrio.some((x) => x.id === 'empurra-puxa') && !p.avisos.some((x) => x.tipo === 'warn' && /sem exercício para[^.]*costas/.test(x.texto))) falhas.push(`${rot}: empurra mais do que puxa`);
      if (av.perfil.veredito === 'nao') falhas.push(`${rot}: veredito "não recomendado"`);
      // as séries por semana batem com as do Treinador
      for (const g of ['peito', 'costas', 'quadriceps']) if ((av.volume[g] || 0) !== (p.volume[g] || 0)) falhas.push(`${rot}: séries de ${g} ${av.volume[g]} × ${p.volume[g]}`);
    }
  assert.ok(n > 2000, 'poucos planos: ' + n);
  assert.equal(falhas.length, 0, `${falhas.length} incoerências em ${n} planos:\n` + falhas.slice(0, 12).join('\n'));
  console.log(`   Avaliação: ${n} planos do Treinador conferidos pela avaliação`);
});

test('o selo acompanha o texto: excesso, falta e desequilíbrio dão no máximo "serve com ajustes"; dose proibida para a condição dá "não recomendado"', () => {
  const ctx = { respostas: base, gym: GYM };
  // 30 séries de bíceps num treino
  const biceps = dia('a', ...['rosca-direta-barra-reta', 'rosca-direta-barra-w', 'rosca-alternada-halteres', 'rosca-martelo-halteres', 'rosca-concentrada', 'rosca-scott-barra-w'].map((id) => it(id, 5, '10-12', 60)));
  assert.equal(avaliarDia(biceps, ctx).perfil.veredito, 'ajustes');
  assert.equal(avaliarPlano({ dias: [biceps], agenda: { 2: 'a' } }, ctx).perfil.veredito, 'ajustes');
  // plano sem pernas
  const A = dia('a', it('supino-maquina', 4), it('supino-inclinado-maquina', 4), it('desenvolvimento-maquina', 3));
  const B = dia('b', it('puxada-frente-aberta', 4), it('remada-baixa-triangulo', 4), it('rosca-direta-barra-w', 3));
  const semPernas = avaliarPlano({ dias: [A, B], agenda: { 1: 'a', 2: 'b', 4: 'a', 5: 'b' } }, ctx);
  assert.equal(semPernas.perfil.veredito, 'ajustes');
  assert.equal(avaliarDia(A, ctx).perfil.veredito, 'sim', 'o treino de peito, sozinho, não tem problema: o problema é do plano');
  // 5×3–5 com pressão alta, diabetes e menor de 18: não recomendado
  const pesado = dia('p', it('agachamento-smith', 5, '3-5', 180), it('supino-maquina', 5, '3-5', 180), it('puxada-frente-aberta', 5, '3-5', 180));
  // (coração, gestação e sinal da triagem: com a liberação médica — sem ela, o Treinador não monta treino nenhum: abaixo)
  for (const extra of [{ condicoes: ['hipertensao'] }, { condicoes: ['cardiaco'], liberado: 'sim' }, { condicoes: ['gestante'], liberado: 'sim' }, { condicoes: ['diabetes'] }, { triagem: ['tontura'], liberado: 'sim' }, { idade: 16 }]) {
    const r = avaliarDia(pesado, { respostas: { ...base, ...extra }, gym: GYM });
    assert.equal(r.perfil.veredito, 'nao', JSON.stringify(extra));
    assert.match(r.conclusao, /não é recomendado/);
  }
  assert.equal(avaliarDia(pesado, ctx).perfil.veredito, 'sim');
  // sem a liberação que a triagem pede (ou com "só com supervisão"), a avaliação não diz que serve: diz o que falta
  for (const [extra, re] of [[{ condicoes: ['cardiaco'], liberado: 'nao' }, /liberação médica/], [{ triagem: ['dor_peito'], liberado: 'nao' }, /liberação médica/], [{ triagem: ['medico'] }, /supervisão/]]) {
    const r = avaliarDia(pesado, { respostas: { ...base, ...extra }, gym: GYM });
    assert.ok(!r.perfil.veredito && re.test(r.conclusao), JSON.stringify(extra) + ': ' + r.conclusao);
  }
  // plano equilibrado e dentro das faixas: "serve"
  const p = gerarPlano(base, GYM, 0);
  assert.equal(avaliarPlano({ dias: p.dias, agenda: p.agenda }, ctx).perfil.veredito, 'sim');
});

test('limitação da entrevista vale pela mecânica também na avaliação: quadril e tornozelo não saem como "serve"', () => {
  const pernas = dia('q', it('agachamento-livre-barra'), it('levantamento-terra-convencional'), it('elevacao-pelvica-barra'), it('stiff-barra'));
  for (const x of pernas.itens) assert.ok(EX_POR_ID.has(x.ex), x.ex);
  for (const lim of ['quadril', 'tornozelo']) {
    const r = avaliarDia(pernas, { respostas: { ...base, experiencia: 'avancado', limitacoes: [lim] }, gym: GYM });
    assert.notEqual(r.perfil.veredito, 'sim', lim);
    assert.ok(r.perfil.problemas.length >= 3, `${lim}: ${r.perfil.problemas.length} exercícios apontados`);
    assert.ok(r.perfil.problemas.every((p) => p.motivos.some((m) => /cuidado com|usa a região da sua limitação/.test(m))));
  }
  // sem a limitação, o mesmo treino serve para o avançado
  assert.equal(avaliarDia(pernas, { respostas: { ...base, experiencia: 'avancado' }, gym: GYM }).perfil.problemas.length, 0);
  // exercícios de braço não são apontados para quem tem limitação no quadril
  const bracos = avaliarDia(dia('b', it('rosca-direta-barra-w'), it('triceps-pulley-corda')), { respostas: { ...base, limitacoes: ['quadril'] }, gym: GYM });
  assert.equal(bracos.perfil.problemas.length, 0);
  // barra fixa para gestante, 60+, pressão alta e IMC de 30 ou mais: regra de segurança
  for (const extra of [{ condicoes: ['gestante'], liberado: 'sim' }, { idade: 72 }, { condicoes: ['hipertensao'] }, { peso: 110 }]) {
    const r = avaliarDia(dia('f', it('barra-fixa-pronada', 3, '10-12'), it('supino-maquina'), it('leg-press-horizontal')), { respostas: { ...base, ...extra }, gym: GYM });
    const pb = r.perfil.problemas.find((p) => p.ex === 'barra-fixa-pronada');
    assert.ok(pb && pb.grave && pb.motivos.some((m) => /pendurado/.test(m)), JSON.stringify(extra));
    if (pb.troca) assert.ok(!EX_POR_ID.get(pb.troca.ex).equip.includes('barra_fixa'));
  }
  assert.ok(!avaliarDia(dia('f', it('barra-fixa-pronada', 3, '6-10')), { respostas: base, gym: GYM }).perfil.problemas.some((p) => p.grave));
});

// ---------- a conta de cada músculo, conferida à mão ----------
// Um treino de pernas montado à mão, como o do dono do app (ele contou 20 de quadríceps e o app mostrava 28; 28 de glúteo
// e o app, 43). Números conferidos à mão, exercício por exercício: principal = série inteira; ajuda = meia série.
const PERNAS = [['agachamento-livre-barra', 4], ['leg-press-45', 4], ['agachamento-bulgaro-halteres', 4], ['hack-machine', 4], ['cadeira-extensora', 4],
  ['elevacao-pelvica-barra', 4], ['gluteo-maquina-coice', 4], ['cadeira-abdutora', 4], ['stiff-barra', 4], ['mesa-flexora', 4], ['levantamento-terra-convencional', 4], ['elevacao-pernas-deitado', 4]];
const planoPernas = (agenda = { 1: 'p' }) => ({ dias: [dia('p', ...PERNAS.map(([ex, s]) => it(ex, s)))], agenda });

test('caso do dono: cada músculo mostra as séries diretas, as de ajuda (× ½) e os exercícios que contam', () => {
  const a = avaliarPlano(planoPernas(), {});
  const g = (k) => a.grupos.find((x) => x.g === k);
  // quadríceps: 5 exercícios de 4 séries como principal = 20; elevação pélvica e terra ajudam (8 séries × ½ = 4) → 24.
  // O abdominal infra não conta mais (a coxa só dobra o quadril): na conta antiga, ele somava mais 2.
  assert.deepEqual([g('quadriceps').diretas, g('quadriceps').ajuda, g('quadriceps').series], [20, 8, 24]);
  assert.deepEqual(g('quadriceps').itens.filter((x) => x.peso === 1).map((x) => x.ex).sort(), ['agachamento-bulgaro-halteres', 'agachamento-livre-barra', 'cadeira-extensora', 'hack-machine', 'leg-press-45']);
  assert.deepEqual(g('quadriceps').itens.filter((x) => x.peso < 1).map((x) => [x.ex, x.conta]), [['elevacao-pelvica-barra', 2], ['levantamento-terra-convencional', 2]]);
  assert.ok(!g('quadriceps').itens.some((x) => x.ex === 'elevacao-pernas-deitado'));
  // glúteos: agachamento, leg press, búlgaro e hack contam inteiro (fazem o glúteo crescer), mais elevação pélvica,
  // coice, stiff e terra = 8 × 4 = 32; a cadeira abdutora ajuda (4 × ½ = 2) → 34
  assert.deepEqual([g('gluteos').diretas, g('gluteos').ajuda, g('gluteos').series], [32, 4, 34]);
  assert.equal(g('gluteos').faixa, 'muito');
  assert.equal(g('gluteos').excesso, 'diretas');
  // posteriores: stiff, mesa flexora e terra = 12; o coice ajuda (2) → 14. Agachamento, leg press, búlgaro, hack e
  // elevação pélvica não contam (na ressonância, os posteriores não crescem com eles): na conta antiga, somavam 10.
  assert.deepEqual([g('posteriores').diretas, g('posteriores').ajuda, g('posteriores').series], [12, 4, 14]);
  assert.ok(!g('posteriores').itens.some((x) => ['agachamento-livre-barra', 'leg-press-45', 'hack-machine', 'elevacao-pelvica-barra'].includes(x.ex)));
  // quadríceps com 20 diretas e 24 no total: dentro do máximo sem perfil (20 diretas; 30 no total)
  assert.equal(g('quadriceps').faixa, 'bom');
  assert.ok(a.sobra.some((x) => x.g === 'gluteos' && x.motivo === 'diretas' && x.series === 32));
  // o mesmo treino em dois dias da semana: cada exercício aparece uma vez, com "2× na semana", e a conta dobra
  const b = avaliarPlano(planoPernas({ 1: 'p', 4: 'p' }), {});
  const q = b.grupos.find((x) => x.g === 'quadriceps');
  assert.deepEqual([q.diretas, q.ajuda, q.series], [40, 16, 48]);
  assert.ok(q.itens.every((x) => x.vezes === 2) && q.itens.length === 7);
  // no treino (um dia só): a mesma lista, com os grupos trabalhados e o "demais" pela mesma regra
  const d = avaliarDia(planoPernas().dias[0], {});
  assert.equal(d.grupos.find((x) => x.g === 'quadriceps').itens.length, 7);
  assert.equal(d.grupos.find((x) => x.g === 'gluteos').faixa, 'muito');
  assert.ok(d.grupos.every((x) => x.series > 0));
});

test('a conta: principal = 1, ajuda = ½; posteriores não contam no agachamento, quadríceps não conta no abdominal; cardio e corrida não entram', () => {
  const w = (id) => pesosDoExercicio(EX_POR_ID.get(id));
  assert.deepEqual(w('supino-maquina'), { peito: 1, ombros: 0.5, triceps: 0.5 });
  assert.equal(w('leg-press-45').gluteos, 1);
  assert.equal(w('agachamento-livre-barra').posteriores, undefined);
  assert.equal(w('leg-press-45').posteriores, undefined);
  assert.equal(w('elevacao-pelvica-barra').posteriores, undefined);
  assert.equal(w('levantamento-terra-convencional').quadriceps, 0.5, 'no terra o joelho estende: o quadríceps ajuda');
  assert.equal(w('stiff-barra').posteriores, 1);
  assert.equal(w('elevacao-pernas-deitado').quadriceps, undefined);
  for (const ex of EXERCICIOS) if (ex.grupo === 'abdomen') assert.equal(pesosDoExercicio(ex).quadriceps, undefined, ex.id);
  for (const ex of EXERCICIOS) if (ex.padrao === 'agachar' || ex.padrao === 'afundo') assert.notEqual(pesosDoExercicio(ex).posteriores, 0.5, ex.id);
  // cardio (esteira, bicicleta, corrida) não soma série em músculo nenhum
  for (const ex of EXERCICIOS) if (ex.grupo === 'cardio' || ex.padrao === 'cardio') assert.deepEqual(pesosDoExercicio(ex), {}, ex.id);
  const cardio = EXERCICIOS.find((ex) => ex.grupo === 'cardio' && ex.registro === 'minutos');
  const com = avaliarPlano({ dias: [dia('p', ...PERNAS.map(([ex, s]) => it(ex, s)), { ex: cardio.id, series: 1, reps: '30', descanso: 0 })], agenda: { 1: 'p' } }, {});
  const sem = avaliarPlano(planoPernas(), {});
  assert.deepEqual(com.volume, sem.volume);
  // a corrida do plano de corrida só entra nos avisos de dia (véspera), nunca nas séries
  const corre = avaliarPlano(planoPernas(), { corrida: { dias: [2, 3], fortes: [2], longos: [] } });
  assert.deepEqual(corre.volume, sem.volume);
});

test('"demais" com a mesma regra do Treinador: diretas acima do teto ou total acima de 1,5 vez o teto', () => {
  // iniciante (teto 12): 12 séries diretas de tríceps não passam; com 24 séries de supino (ajuda: 12 × ½ = 6) o total é 18
  const d = dia('t', it('triceps-pulley-corda', 4), it('triceps-testa-barra-w', 4), it('triceps-frances-halter', 4), it('supino-maquina', 4), it('supino-inclinado-maquina', 4), it('supino-reto-halteres', 4));
  for (const x of d.itens) assert.ok(EX_POR_ID.has(x.ex), x.ex);
  const ctx = { respostas: { ...base, experiencia: 'iniciante' }, gym: GYM };
  const a = avaliarPlano({ dias: [d], agenda: { 1: 't' } }, ctx);
  const tri = a.grupos.find((x) => x.g === 'triceps');
  assert.deepEqual([tri.diretas, tri.ajuda, tri.series], [12, 12, 18]);
  assert.notEqual(tri.faixa, 'muito', '18 = 1,5 × 12: ainda não passa');
  const d2 = { ...d, itens: [...d.itens, it('supino-declinado-barra', 4)] };
  const b = avaliarPlano({ dias: [d2], agenda: { 1: 't' } }, ctx);
  const tri2 = b.grupos.find((x) => x.g === 'triceps');
  assert.equal(tri2.series, 20);
  assert.equal(tri2.excesso, 'total');
  assert.equal(tri2.faixa, 'muito');
  // o peito passa pelas diretas (16 > 12)
  assert.equal(b.grupos.find((x) => x.g === 'peito').excesso, 'diretas');
});

test('sugestões e trocas dentro da avaliação: só exercícios seguros para o perfil, fora os que já estão no plano', () => {
  // sem perfil: só de iniciante, sem supervisão, com os aparelhos
  const s0 = sugestoesPara('posteriores', {}, ['mesa-flexora']);
  assert.ok(s0.length >= 1 && s0.length <= 3);
  for (const x of s0) { const ex = EX_POR_ID.get(x.ex); assert.equal(pesosDoExercicio(ex).posteriores, 1); assert.equal(ex.nivel, 1); assert.notEqual(x.ex, 'mesa-flexora'); assert.ok(!soManual(x.ex)); }
  // com perfil: nenhum motivo contra (gestação, 60+ com pressão alta e limitação, menor de 18, quem nunca treinou)
  const perfis = [{ ...base, condicoes: ['gestante'], liberado: 'sim' }, { ...base, idade: 68, condicoes: ['hipertensao'], limitacoes: ['joelho'] }, { ...base, idade: 15 }, { ...base, experiencia: 'nunca' }];
  for (const r of perfis) for (const g of ['posteriores', 'gluteos', 'costas', 'peito', 'quadriceps']) {
    const pf = perfil(r);
    for (const x of sugestoesPara(g, { respostas: r, gym: GYM })) assert.deepEqual(motivosContra(EX_POR_ID.get(x.ex), pf, GYM, []), [], `${JSON.stringify(r)} / ${g}: ${x.ex}`);
  }
  // academia sem nada marcado: nenhuma sugestão pede aparelho que a pessoa não tem
  for (const x of sugestoesPara('costas', { gym: { all: false, has: {} } })) assert.ok(EX_POR_ID.get(x.ex).equip.length === 0, x.ex);
  // pede liberação médica (com ou sem a resposta da liberação) ou é menor de 14: nenhuma sugestão nem troca
  for (const extra of [{ triagem: ['dor_peito'] }, { triagem: ['dor_peito'], liberado: 'nao' }, { idade: 12 }, { condicoes: ['gestante'] }]) {
    assert.deepEqual(sugestoesPara('peito', { respostas: { ...base, ...extra }, gym: GYM }), [], JSON.stringify(extra));
    assert.deepEqual(trocasPara('leg-press-45', 'gluteos', { respostas: { ...base, ...extra }, gym: GYM }), [], JSON.stringify(extra));
  }
  // troca de leg press com glúteos demais: mantém o quadríceps como principal e tira o glúteo
  const t1 = trocasPara('leg-press-45', 'gluteos', { respostas: base, gym: GYM }, ['cadeira-extensora']);
  assert.ok(t1.length >= 1);
  for (const x of t1) { const w = pesosDoExercicio(EX_POR_ID.get(x.ex)); assert.equal(w.quadriceps, 1); assert.notEqual(w.gluteos, 1); assert.equal(x.para, 'quadriceps'); assert.notEqual(x.ex, 'cadeira-extensora'); }
  // exercício que só trabalha o músculo em excesso: a troca é por um do grupo que está com pouco
  const t2 = trocasPara('cadeira-extensora', 'quadriceps', { respostas: base, gym: GYM }, [], ['posteriores']);
  assert.ok(t2.length >= 1 && t2.every((x) => x.para === 'posteriores' && pesosDoExercicio(EX_POR_ID.get(x.ex)).posteriores === 1 && pesosDoExercicio(EX_POR_ID.get(x.ex)).quadriceps !== 1));
  assert.deepEqual(trocasPara('cadeira-extensora', 'quadriceps', { respostas: base, gym: GYM }, [], []), []);
  assert.deepEqual(trocasPara('nao-existe', 'quadriceps', {}), []);
});

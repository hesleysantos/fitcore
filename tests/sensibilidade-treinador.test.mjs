// Sensibilidade do Treinador: para CADA pergunta e CADA opção da entrevista, e para cada local, tipo e intensidade de dor,
// muda-se só aquela resposta e confere-se que o plano muda como o código e as perguntas frequentes declaram — ou que está
// declarado por que não muda. Uma resposta perguntada e ignorada, ou um aviso de lesão que não muda nada, quebra este teste.
// Também aqui: corrida + musculação (prioridade e fortalecimento) e o plano de fortalecimento para quem só corre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCICIOS, EX_POR_ID } from '../www/js/data/exercises.js';
import { EQUIPAMENTOS } from '../www/js/data/equipment.js';
import { REFS, FAQ_TREINO } from '../www/js/data/knowledge.js';
import { PERGUNTAS, ROTULO, gerarPlano, perfil, avisosBloqueio, permitido, pesosDoExercicio, tetoSeries, duracaoEstimada, alertaDoExercicio, orientacaoDaDor, outraVersao, sugerirTrocas, alternativas, soManual, resumoCombinado, efeitoDoFoco, planoFortalecimento, motivosContra } from '../www/js/logic/trainer.js';
import { LOCAIS_DOR, TIPOS_DOR, QUANDO_DOR, dorDeAlerta } from '../www/js/logic/dor.js';
import { doresDoTreino, doresPendentes, respostasParaAvisos, volumeSemanal, ajustesPorDor } from '../www/js/logic/trainer.js';
import { doresAtivas, DIAS_ATIVA } from '../www/js/logic/dor.js';
import { FOCOS, chaveCombo } from '../www/js/logic/combinado.js';
import * as store from '../www/js/store.js';

const GYM = { all: true, has: {} };
const base = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };
const P = (k) => PERGUNTAS.find((q) => q.k === k);
const opcoes = (k) => P(k).op.map((o) => o[0]);
const itens = (p) => p.dias.flatMap((d) => d.itens);
const exDe = (it) => EX_POR_ID.get(it.ex);
const ehCardio = (ex) => ex.grupo === 'cardio' || ex.padrao === 'cardio';
const comPeso = (p) => itens(p).filter((it) => exDe(it).registro === 'peso_reps' && !ehCardio(exDe(it)));
const lo = (it) => Number(String(it.reps).split('-')[0]);
const dose = (p) => JSON.stringify(p.dias.map((d) => d.itens.map((i) => [i.ex, i.series, i.reps, i.descanso])));
const doseEAgenda = (p) => dose(p) + JSON.stringify(Object.keys(p.agenda).sort());
const tem = (p, re, tipo = '') => p.avisos.some((x) => (!tipo || x.tipo === tipo) && re.test(x.texto));
const diretas = (p) => { const d = {}; for (const it of itens(p)) { const w = pesosDoExercicio(exDe(it)); for (const g in w) if (w[g] === 1) d[g] = (d[g] || 0) + it.series; } return d; };
const barraComposta = (ex) => ex.modalidade === 'barra' && ex.tipo === 'composto';
const diasDeForca = (p) => Object.entries(p.agenda).filter(([, id]) => p.dias.find((d) => d.id === id).itens.some((it) => !ehCardio(exDe(it)) && exDe(it).grupo !== 'abdomen')).map(([wd]) => Number(wd)).sort((a, b) => a - b);
const seguidos = (wds) => wds.some((w) => wds.includes((w + 1) % 7));
const todosDiferentes = (lista, rot) => { const s = new Set(lista); assert.equal(s.size, lista.length, rot + ': duas opções deram o mesmo resultado'); };
const p0 = gerarPlano(base, GYM, 0);

test('todas as perguntas da entrevista estão cobertas por este arquivo', () => {
  assert.deepEqual(PERGUNTAS.map((q) => q.k), ['objetivo', 'idade', 'condicoes', 'triagem', 'remedios', 'experiencia', 'pausa', 'liberado', 'peso', 'altura', 'diasMusc', 'dias', 'tempo', 'local', 'extras', 'limitacoes', 'foco'], 'pergunta nova na entrevista: acrescente o teste de sensibilidade dela');
  assert.deepEqual(opcoes('objetivo'), ['hipertrofia', 'emagrecimento', 'forca', 'saude', 'resistencia']);
  assert.deepEqual(opcoes('experiencia'), ['nunca', 'iniciante', 'intermediario', 'avancado']);
  assert.deepEqual(opcoes('pausa'), ['treinando', '2a4s', '1a3m', '3a6m', 'mais6m']);
  assert.deepEqual(opcoes('diasMusc'), ['1', '2', '3', '4', '5', '6', '0']);
  assert.deepEqual(opcoes('dias'), ['2', '3', '4', '5', '6']);
  assert.deepEqual(opcoes('tempo'), ['30', '45', '60', '75']);
  assert.deepEqual(opcoes('local'), ['completa', 'minha', 'halteres', 'corporal']);
  assert.deepEqual(opcoes('extras'), ['elastico', 'bola_suica', 'caixa', 'banco_inclinado', 'barra_fixa', 'kettlebell', 'trx', 'corda_pular', 'bicicleta', 'esteira', 'escada', 'nenhum']);
  assert.deepEqual(opcoes('limitacoes'), ['ombro', 'joelho', 'lombar', 'cervical', 'cotovelo', 'punho', 'quadril', 'tornozelo', 'nenhuma']);
  assert.deepEqual(opcoes('condicoes'), ['hipertensao', 'cardiaco', 'diabetes', 'renal', 'gestante', 'posparto', 'transtorno', 'cronica', 'nenhuma']);
  assert.deepEqual(opcoes('triagem'), ['dor_peito', 'falta_ar', 'falta_ar_deitado', 'palpitacao', 'tontura', 'tornozelos', 'perna', 'sopro', 'cansaco', 'osseo', 'medico', 'nenhum']);
  assert.deepEqual(opcoes('remedios'), ['pulso', 'glicose', 'outro', 'nenhum']);
  assert.deepEqual(opcoes('liberado'), ['sim', 'nao']);
  assert.deepEqual(opcoes('foco'), ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'peito', 'costas', 'ombros', 'biceps', 'triceps', 'abdomen', 'pernas', 'bracos', 'equilibrado']);
  // "Nenhum"/"Nenhuma" sempre por último nas listas
  for (const q of PERGUNTAS) if (q.nenhum) assert.equal(q.op[q.op.length - 1][0], q.nenhum, 'nenhum por último: ' + q.k);
  // as perguntas de segurança vêm logo depois de objetivo e idade (ordem do PAR-Q+)
  assert.deepEqual(PERGUNTAS.slice(0, 5).map((q) => q.k), ['objetivo', 'idade', 'condicoes', 'triagem', 'remedios']);
  assert.deepEqual(Object.keys(TIPOS_DOR), ['muscular', 'articular', 'aguda']);
  assert.deepEqual(Object.keys(QUANDO_DOR), ['durante', 'depois', 'repouso']);
  assert.equal(Object.keys(LOCAIS_DOR).length, 20);
});

test('soCorrida: não muda a musculação (o dia continua sem ela); só devolve o dia à corrida (logic/dias-livres.js)', () => {
  const a = { ...base, semTreino: ['6'] };
  assert.equal(doseEAgenda(gerarPlano({ ...a, soCorrida: ['6'] }, GYM, 0)), doseEAgenda(gerarPlano(a, GYM, 0)));
  assert.equal(doseEAgenda(gerarPlano({ ...a, soCorrida: ['nenhum'] }, GYM, 0)), doseEAgenda(gerarPlano(a, GYM, 0)));
});

test('diasMusc: cada dia fora dos marcados sai da agenda; os 7 dias, "Nenhum" antigo e a falta de resposta não mudam nada', () => {
  // o resto da regra (todas as combinações, corrida, fortalecimento e treino perdido) está em tests/dias-livres.test.mjs
  assert.equal(doseEAgenda(gerarPlano({ ...base, semTreino: ['nenhum'] }, GYM, 0)), doseEAgenda(p0));
  assert.equal(doseEAgenda(gerarPlano({ ...base, diasMusc: opcoes('diasMusc') }, GYM, 0)), doseEAgenda(p0));
  for (const w of opcoes('diasMusc')) {
    const p = gerarPlano({ ...base, diasMusc: opcoes('diasMusc').filter((x) => x !== w) }, GYM, 0);
    assert.ok(!Object.keys(p.agenda).includes(w), 'treino no dia bloqueado: ' + w);
    assert.equal(Object.keys(p.agenda).length, 4, 'os 4 treinos continuam: ' + w);
    // só muda a agenda quando o dia bloqueado era um dia de treino (segunda, terça, quinta e sexta)
    assert.equal(JSON.stringify(Object.keys(p.agenda).sort()) !== JSON.stringify(Object.keys(p0.agenda).sort()), Object.keys(p0.agenda).includes(w), w);
  }
});

test('objetivo: cada opção dá a sua dose (repetições, descanso) e o seu cardio', () => {
  // exercício principal do primeiro treino: repetições e descanso de cada objetivo (ACSM 2009; Schoenfeld 2021)
  const esperado = { hipertrofia: ['8-12', 120], emagrecimento: ['10-12', 90], forca: ['4-6', 180], saude: ['10-12', 90], resistencia: ['15-20', 60] };
  const planos = {};
  for (const objetivo of opcoes('objetivo')) {
    const p = planos[objetivo] = gerarPlano({ ...base, objetivo }, GYM, 0);
    const principal = p.dias[0].itens[0];
    assert.deepEqual([principal.reps, principal.descanso], esperado[objetivo], objetivo);
    assert.equal(p.perfil.objetivoDose, objetivo);
  }
  todosDiferentes(Object.values(planos).map(dose), 'objetivo');
  // emagrecimento, saúde e resistência: o plano traz cardio; força e hipertrofia com 4 dias, não
  for (const o of ['emagrecimento', 'saude', 'resistencia']) assert.ok(planos[o].minCardio > 0, 'sem cardio: ' + o);
  // saúde: 2 séries nos principais; força: 4
  assert.equal(planos.saude.dias[0].itens[0].series, 2);
  assert.equal(planos.forca.dias[0].itens[0].series, 4);
  // o texto de orientação muda com o objetivo
  todosDiferentes(Object.values(planos).map((p) => JSON.stringify(p.orientacoes)), 'orientações por objetivo');
});

test('idade: menos de 14 bloqueia; 14 a 17, regras de jovem; 18 a 59 não muda; 60 ou mais, regras de idoso', () => {
  for (const idade of [10, 13]) assert.equal(gerarPlano({ ...base, idade }, GYM, 0), null);
  for (const idade of [14, 17]) {
    const p = gerarPlano({ ...base, idade, dias: '5' }, GYM, 0);
    assert.ok(p.perfil.jovem && p.perfil.conservador);
    assert.ok(!itens(p).some((it) => barraComposta(exDe(it))), 'barra livre composta para menor de 18');
    assert.ok(comPeso(p).every((it) => lo(it) >= 10 && it.series <= 3), 'dose de adulto para menor de 18');
    const wds = diasDeForca(p);
    assert.ok(wds.length <= 3 && !seguidos(wds), 'força em mais de 3 dias ou em dias seguidos: ' + wds);
    assert.ok(tem(p, /18 anos/));
    assert.notEqual(dose(p), dose(gerarPlano({ ...base, dias: '5' }, GYM, 0)));
  }
  // entre 18 e 59 a idade não muda o plano (as diretrizes de adultos valem para toda a faixa)
  for (const idade of [18, 45, 59]) assert.equal(doseEAgenda(gerarPlano({ ...base, idade }, GYM, 0)), doseEAgenda(p0), 'idade ' + idade);
  for (const idade of [60, 75, 99]) {
    const p = gerarPlano({ ...base, idade }, GYM, 0);
    assert.ok(p.perfil.idoso && p.perfil.conservador);
    assert.ok(comPeso(p).filter((it) => exDe(it).grupo !== 'abdomen').every((it) => it.reps === '10-12' && it.series <= 3), 'dose de 60+');
    assert.ok(!itens(p).some((it) => barraComposta(exDe(it)) || exDe(it).equip.includes('bola_suica') || exDe(it).equip.includes('trx')), 'barra livre ou instável para 60+');
    assert.ok(itens(p).every((it) => exDe(it).nivel <= 2));
    assert.ok(tem(p, /60 anos/));
    assert.notEqual(dose(p), dose(p0));
  }
});

test('peso e altura: mudam o plano só pelo IMC (30 ou mais: sem impacto e com aviso; abaixo do saudável: aviso para quem quer emagrecer)', () => {
  // dentro da faixa de 18,5 a 30, peso e altura não mudam nada
  for (const extra of [{ peso: 58 }, { peso: 90 }, { altura: 160 }, { altura: 195 }]) {
    const p = gerarPlano({ ...base, ...extra }, GYM, 0);
    assert.equal(doseEAgenda(p), doseEAgenda(p0), JSON.stringify(extra));
    assert.deepEqual(p.avisos.map((x) => x.texto), p0.avisos.map((x) => x.texto));
  }
  // IMC 30 ou mais: aviso e nada de cardio de impacto
  const casa = { ...base, objetivo: 'emagrecimento', dias: '5', local: 'corporal', extras: ['corda_pular'] };
  const leve = gerarPlano(casa, GYM, 0);
  assert.ok(itens(leve).some((it) => it.ex === 'pular-corda'), 'o perfil de comparação deveria ter corda de pular');
  for (const extra of [{ peso: 100 }, { altura: 150 }]) {
    const p = gerarPlano({ ...casa, ...extra }, GYM, 0);
    assert.ok(p.perfil.obeso);
    assert.ok(tem(p, /proteger as articulações/));
    assert.ok(!itens(p).some((it) => exDe(it).padrao === 'cardio' && exDe(it).cuidado.includes('joelho') && exDe(it).cuidado.includes('tornozelo')), 'cardio de impacto com IMC de 30 ou mais');
    assert.ok(!itens(p).some((it) => it.ex === 'pular-corda'));
    assert.ok(tem(p, /Você marcou corda de pular/), 'corda marcada e não usada, sem aviso');
  }
  assert.ok(tem(gerarPlano({ ...base, peso: 100 }, GYM, 0), /proteger as articulações/) && !tem(p0, /proteger as articulações/));
  // abaixo do peso + emagrecer: aviso; com outro objetivo, não
  assert.ok(tem(gerarPlano({ ...base, objetivo: 'emagrecimento', peso: 50 }, GYM, 0), /abaixo da faixa/, 'warn'));
  assert.ok(!tem(gerarPlano({ ...base, objetivo: 'emagrecimento' }, GYM, 0), /abaixo da faixa/));
  assert.ok(!tem(gerarPlano({ ...base, peso: 50 }, GYM, 0), /abaixo da faixa/));
});

test('experiência: cada nível muda os exercícios permitidos, as séries e o teto semanal', () => {
  const planos = {};
  const nivel = { nunca: 1, iniciante: 1, intermediario: 2, avancado: 3 };
  for (const experiencia of opcoes('experiencia')) {
    const p = planos[experiencia] = gerarPlano({ ...base, experiencia, dias: '5', tempo: '75' }, GYM, 0);
    assert.equal(p.perfil.nivel, nivel[experiencia]);
    assert.ok(itens(p).every((it) => exDe(it).nivel <= nivel[experiencia]), 'exercício acima do nível: ' + experiencia);
    const d = diretas(p);
    for (const g in d) assert.ok(d[g] <= tetoSeries(nivel[experiencia]), `${experiencia}: ${g} com ${d[g]} séries diretas`);
  }
  todosDiferentes(Object.values(planos).map(dose), 'experiência');
  // quem nunca treinou: até 3 séries por exercício, e menos séries no total do que o iniciante
  assert.ok(itens(planos.nunca).every((it) => it.series <= 3));
  const total = (p) => itens(p).reduce((t, it) => t + it.series, 0);
  assert.ok(total(planos.nunca) < total(planos.iniciante) && total(planos.iniciante) <= total(planos.avancado));
  // só quem não é iniciante recebe exercício de nível 2
  assert.ok(itens(planos.intermediario).some((it) => exDe(it).nivel === 2));
  assert.ok([tetoSeries(1), tetoSeries(2), tetoSeries(3)].join() === '12,16,20');
});

test('pausa: cada faixa de tempo parado muda o aviso de volta; de 3 meses em diante, também o nível e as séries', () => {
  const planos = {};
  const retorno = { treinando: 0, '2a4s': 1, '1a3m': 2, '3a6m': 3, mais6m: 4 };
  for (const pausa of opcoes('pausa')) {
    const p = planos[pausa] = gerarPlano({ ...base, pausa }, GYM, 0);
    assert.equal(p.perfil.retorno, retorno[pausa], pausa);
  }
  todosDiferentes(Object.values(planos).map((p) => JSON.stringify(p.avisos.map((x) => x.texto))), 'avisos por pausa');
  assert.equal(dose(planos['2a4s']), dose(planos.treinando));
  assert.equal(dose(planos['1a3m']), dose(planos.treinando));
  // 3 a 6 meses: um nível abaixo e até 3 séries; mais de 6 meses: recomeça como iniciante
  assert.equal(planos['3a6m'].perfil.nivel, 1); assert.equal(planos.mais6m.perfil.nivel, 1);
  for (const k of ['3a6m', 'mais6m']) { assert.ok(itens(planos[k]).every((it) => it.series <= 3 && exDe(it).nivel <= 1), k); assert.notEqual(dose(planos[k]), dose(planos.treinando)); }
  assert.equal(gerarPlano({ ...base, experiencia: 'avancado', pausa: '3a6m' }, GYM, 0).perfil.nivel, 2);
  assert.equal(gerarPlano({ ...base, experiencia: 'avancado', pausa: 'mais6m' }, GYM, 0).perfil.nivel, 1);
  // quem nunca treinou não vê a pergunta, e a resposta não pesa
  assert.equal(P('pausa').se({ experiencia: 'nunca' }), false);
  assert.equal(dose(gerarPlano({ ...base, experiencia: 'nunca', pausa: 'mais6m' }, GYM, 0)), dose(gerarPlano({ ...base, experiencia: 'nunca', pausa: 'treinando' }, GYM, 0)));
  // parado há 3 meses ou mais com doença crônica: precisa de liberação médica
  assert.ok(gerarPlano({ ...base, pausa: '3a6m', condicoes: ['hipertensao'] }, GYM, 0).perfil.liberacao);
});

test('dias por semana: cada opção dá esse número de treinos, em dias diferentes', () => {
  const planos = [];
  for (const dias of opcoes('dias')) {
    const p = gerarPlano({ ...base, dias }, GYM, 0);
    assert.equal(p.dias.length, Number(dias));
    assert.equal(new Set(Object.keys(p.agenda)).size, Number(dias));
    planos.push(dose(p));
  }
  todosDiferentes(planos, 'dias');
});

test('tempo por treino: cada opção cabe no tempo e muda o tamanho do treino', () => {
  const ORCAMENTO = { 30: 35, 45: 50, 60: 65, 75: 90 };
  const planos = [];
  let antes = 0;
  for (const tempo of opcoes('tempo')) {
    const p = gerarPlano({ ...base, tempo }, GYM, 0);
    for (const d of p.dias) assert.ok(duracaoEstimada(d) <= ORCAMENTO[tempo], `${tempo} min: ${d.nome} ≈ ${duracaoEstimada(d)} min`);
    const total = itens(p).reduce((t, it) => t + it.series, 0);
    assert.ok(total >= antes, `mais tempo deu menos séries (${tempo} min)`);
    antes = total;
    planos.push(dose(p));
  }
  todosDiferentes(planos, 'tempo');
});

test('local: cada opção usa só os aparelhos que ela tem', () => {
  const gymMinha = { all: false, has: { halteres: true, banco_reto: true, leg_press_45: true, polia_alta: true, colchonete: true } };
  const planos = {};
  for (const local of opcoes('local')) planos[local] = gerarPlano({ ...base, local }, local === 'minha' ? gymMinha : GYM, 0);
  assert.ok(itens(planos.completa).every((it) => !exDe(it).equip.some((e) => EQUIPAMENTOS[e] && EQUIPAMENTOS[e].raro)), 'aparelho raro em academia completa');
  assert.ok(itens(planos.minha).every((it) => exDe(it).equip.every((e) => gymMinha.has[e] === true)), 'aparelho não marcado em "minha academia"');
  assert.ok(itens(planos.halteres).every((it) => exDe(it).equip.every((e) => ['halteres', 'banco_reto', 'colchonete'].includes(e))), 'em casa com halteres');
  assert.ok(itens(planos.corporal).every((it) => exDe(it).equip.every((e) => e === 'colchonete')), 'em casa sem aparelhos');
  todosDiferentes(Object.values(planos).map(dose), 'local');
  // "minha academia" depende do que foi marcado: outro conjunto, outro plano
  assert.notEqual(dose(planos.minha), dose(gerarPlano({ ...base, local: 'minha' }, { all: false, has: { halteres: true, colchonete: true } }, 0)));
  // a pergunta dos itens extras só aparece para quem treina em casa
  assert.equal(P('extras').se({ local: 'completa' }), false); assert.equal(P('extras').se({ local: 'minha' }), false);
  assert.equal(P('extras').se({ local: 'halteres' }), true); assert.equal(P('extras').se({ local: 'corporal' }), true);
});

test('itens extras em casa: cada item marcado entra no treino ou o plano diz por que ficou de fora', () => {
  const perfis = [];
  for (const experiencia of opcoes('experiencia')) for (const objetivo of ['hipertrofia', 'emagrecimento', 'saude']) for (const dias of ['3', '5']) perfis.push({ experiencia, objetivo, dias });
  for (const local of ['halteres', 'corporal']) for (const item of opcoes('extras')) {
    let usa = 0, mudou = 0, calado = 0;
    for (const x of perfis) for (let v = 0; v < 3; v++) {
      const a0 = { ...base, ...x, local, extras: ['nenhum'] };
      const p = gerarPlano({ ...a0, extras: [item] }, GYM, v), q = gerarPlano(a0, GYM, v);
      const usado = itens(p).some((it) => exDe(it).equip.includes(item));
      if (usado) usa++;
      if (dose(p) !== dose(q)) mudou++;
      // item que não serve para este perfil (nenhum exercício permitido com ele): o plano tem de dizer
      const serve = EXERCICIOS.some((ex) => ex.equip.includes(item) && ex.equip.every((e) => e === item || (local === 'halteres' ? ['halteres', 'banco_reto', 'colchonete'] : ['colchonete']).includes(e)) && permitido(ex, p.perfil));
      const avisou = tem(p, new RegExp('Você marcou [^.]*' + (ROTULO.extras[item] || item)));
      // item marcado que não entrou no treino (não serve para o perfil, ou os exercícios escolhidos foram outros): o plano tem de dizer
      if (!usado && !avisou && item !== 'nenhum') calado++;
      if (!serve && usado) assert.fail(`${local}+${item}: item usado sem exercício permitido`);
      if (avisou && usado) assert.fail(`${local}+${item}: aviso de item fora do treino com o item no treino`);
      if (item === 'nenhum') { assert.equal(dose(p), dose(q)); assert.equal(dose(p), dose(gerarPlano({ ...base, ...x, local }, GYM, v)), 'sem a resposta e com "nenhum" têm de dar o mesmo plano'); }
    }
    if (item === 'nenhum') continue;
    assert.equal(calado, 0, `${local}+${item}: item marcado que não serve para o perfil, sem aviso (${calado} planos)`);
    // o item é usado em algum perfil, ou em todos o plano avisa que ele ficou de fora
    assert.ok(usa > 0 || mudou === 0, `${local}+${item}: mudou o plano sem usar o item`);
    if (!usa) for (const x of perfis) assert.ok(tem(gerarPlano({ ...base, ...x, local, extras: [item] }, GYM, 0), /Você marcou/), `${local}+${item}: nunca usado e sem aviso`);
  }
});

test('limitações: cada opção tira do plano os exercícios marcados para ela e avisa', () => {
  for (const lim of opcoes('limitacoes').filter((x) => x !== 'nenhuma')) {
    let mudou = 0, n = 0;
    assert.ok(EXERCICIOS.some((ex) => ex.cuidado.includes(lim)), 'nenhum exercício marcado para: ' + lim);
    for (const local of ['completa', 'halteres', 'corporal']) for (const objetivo of ['hipertrofia', 'forca']) for (let v = 0; v < 4; v++) {
      const a = { ...base, local, objetivo, limitacoes: [lim] };
      const p = gerarPlano(a, GYM, v), q = gerarPlano({ ...a, limitacoes: ['nenhuma'] }, GYM, v);
      n++;
      assert.ok(itens(p).every((it) => !exDe(it).cuidado.includes(lim)), `exercício de cuidado para ${lim} no plano`);
      assert.ok(tem(p, /Evitei os exercícios marcados como de cuidado|não encontrei|sem exercício/), 'limitação sem aviso: ' + lim);
      assert.ok(p.perfil.cuidados.includes(lim));
      if (dose(p) !== dose(q)) mudou++;
      // o plano sem a limitação tinha exercício marcado → o plano com ela tem de ser outro
      if (itens(q).some((it) => exDe(it).cuidado.includes(lim))) assert.notEqual(dose(p), dose(q));
      // as trocas sugeridas e as alternativas também respeitam a limitação
      for (const t of sugerirTrocas({ dias: p.dias }, a, GYM, 3)) assert.ok(!EX_POR_ID.get(t.para).cuidado.includes(lim));
    }
    assert.ok(mudou > 0, `limitação ${lim} nunca mudou um plano (${n} planos)`);
  }
  // duas limitações somam
  const p = gerarPlano({ ...base, limitacoes: ['joelho', 'ombro'] }, GYM, 0);
  assert.ok(itens(p).every((it) => !exDe(it).cuidado.includes('joelho') && !exDe(it).cuidado.includes('ombro')));
});

test('condições de saúde: cada opção muda a dose, os exercícios ou a semana, com o aviso correspondente', () => {
  const com = (c, extra = {}) => gerarPlano({ ...base, dias: '5', ...extra, condicoes: [c] }, GYM, 0);
  const semCond = gerarPlano({ ...base, dias: '5' }, GYM, 0);
  // pressão alta: cargas leves a moderadas (10 repetições ou mais, até 3 séries), sem os exercícios marcados e sem barra composta
  const has = com('hipertensao');
  assert.ok(has.perfil.pressao && has.perfil.cautela && !has.perfil.liberacao);
  assert.ok(comPeso(has).every((it) => lo(it) >= 10 && it.series <= 3));
  assert.ok(comPeso(semCond).some((it) => lo(it) < 10), 'o plano sem pressão alta deveria ter séries de menos de 10 repetições');
  assert.ok(itens(has).every((it) => !exDe(it).cuidado.includes('hipertensao') && !barraComposta(exDe(it))));
  assert.ok(tem(has, /Pressão alta/, 'warn'));
  // coração: sem liberação médica, não há plano; com ela, o mesmo da pressão alta, com o aviso da liberação
  assert.equal(com('cardiaco'), null);
  const card = com('cardiaco', { liberado: 'sim' });
  assert.ok(card.perfil.liberacao && tem(card, /liberação médica/, 'danger'));
  assert.ok(comPeso(card).every((it) => lo(it) >= 10 && it.series <= 3) && itens(card).every((it) => !exDe(it).cuidado.includes('hipertensao')));
  // diabetes: até 3 treinos de força em dias não seguidos, 8 repetições ou mais, até 3 séries
  const diab = com('diabetes', { objetivo: 'forca' });
  assert.ok(diab.perfil.diabetes && diab.perfil.moderado);
  assert.ok(diasDeForca(diab).length <= 3 && !seguidos(diasDeForca(diab)));
  assert.ok(comPeso(diab).every((it) => lo(it) >= 8 && it.series <= 3));
  assert.ok(tem(diab, /Diabetes/, 'warn'));
  assert.ok(comPeso(gerarPlano({ ...base, dias: '5', objetivo: 'forca' }, GYM, 0)).some((it) => lo(it) < 8), 'o plano de força sem diabetes deveria ter séries pesadas');
  // gestação: sem liberação, nada (parq2023); com ela, dose de saúde, sem os exercícios marcados para gestantes, sem instáveis
  assert.equal(com('gestante'), null);
  assert.match(avisosBloqueio({ ...base, condicoes: ['gestante'] }).map((x) => x.texto).join(' '), /obstetra/);
  const gest = com('gestante', { liberado: 'sim' });
  assert.ok(gest.perfil.gestante && gest.perfil.liberacao && gest.perfil.objetivoDose === 'saude');
  assert.ok(itens(gest).every((it) => !exDe(it).cuidado.includes('gestante') && !exDe(it).cuidado.includes('hipertensao') && !barraComposta(exDe(it))));
  assert.ok(tem(gest, /Gestação/, 'warn') && tem(gest, /liberação médica/, 'danger'));
  // parto nos últimos 6 meses: sem liberação, nada (goom2019, deering2024); com ela, cargas leves a moderadas e o aviso
  assert.equal(com('posparto'), null);
  assert.match(avisosBloqueio({ ...base, condicoes: ['posparto'] })[0].texto, /fisioterapeuta pélvica/);
  const pos = com('posparto', { liberado: 'sim' });
  assert.ok(pos.perfil.posparto && pos.perfil.cautela && tem(pos, /Pós-parto/, 'warn'));
  assert.ok(comPeso(pos).every((it) => lo(it) >= 10 && it.series <= 3));
  // doença nos rins: como a doença crônica (8 repetições ou mais, até 3 séries), com o próprio aviso; sedentário, liberação antes
  const ren = com('renal', { objetivo: 'forca' });
  assert.ok(ren.perfil.renal && ren.perfil.moderado && !ren.perfil.bloqueado);
  assert.ok(comPeso(ren).every((it) => lo(it) >= 8 && it.series <= 3));
  assert.ok(tem(ren, /Doença nos rins/, 'warn'));
  assert.equal(gerarPlano({ ...base, experiencia: 'nunca', condicoes: ['renal'] }, GYM, 0), null);
  assert.equal(gerarPlano({ ...base, experiencia: 'nunca', condicoes: ['diabetes'] }, GYM, 0), null);
  assert.ok(gerarPlano({ ...base, experiencia: 'nunca', condicoes: ['renal'], liberado: 'sim' }, GYM, 0));
  // outra doença crônica: 8 repetições ou mais, até 3 séries, com aviso
  const cron = com('cronica', { objetivo: 'forca' });
  assert.ok(cron.perfil.cronica && cron.perfil.moderado);
  assert.ok(comPeso(cron).every((it) => lo(it) >= 8 && it.series <= 3));
  assert.ok(tem(cron, /Doença crônica/));
  // transtorno alimentar: no treino, o mesmo efeito de "outra doença crônica" (logic/saude.js); a diferença é o diário
  const trans = com('transtorno', { objetivo: 'forca' });
  assert.ok(trans.perfil.cronica && trans.perfil.moderado);
  assert.equal(dose(trans), dose(cron));
  for (const [nome, p] of [['hipertensao', has], ['cardiaco', card], ['gestante', gest], ['posparto', pos]]) assert.notEqual(dose(p), dose(semCond), nome + ' não mudou o plano');
  assert.notEqual(dose(diab), dose(gerarPlano({ ...base, dias: '5', objetivo: 'forca' }, GYM, 0)));
  assert.notEqual(dose(cron), dose(gerarPlano({ ...base, dias: '5', objetivo: 'forca' }, GYM, 0)));
  assert.notEqual(dose(ren), dose(gerarPlano({ ...base, dias: '5', objetivo: 'forca' }, GYM, 0)));
  todosDiferentes([has, card, com('diabetes'), com('renal'), gest, pos, com('cronica')].map((p) => JSON.stringify(p.avisos.map((x) => x.texto))), 'avisos por condição');
});

test('triagem: qualquer sinal bloqueia sem liberação; com ela, plano em cargas leves a moderadas', () => {
  const planos = [];
  for (const t of opcoes('triagem').filter((x) => x !== 'nenhum' && x !== 'medico')) {
    // sem liberação médica, não há plano (whitfield2017: com sintoma, liberação antes de qualquer intensidade)
    assert.equal(gerarPlano({ ...base, objetivo: 'forca', triagem: [t] }, GYM, 0), null, 'plano sem liberação: ' + t);
    assert.ok(avisosBloqueio({ ...base, triagem: [t] }).some((x) => /sinal de alerta/.test(x.texto)), t);
    const p = gerarPlano({ ...base, objetivo: 'forca', triagem: [t], liberado: 'sim' }, GYM, 0);
    assert.ok(p.perfil.liberacao && p.perfil.cautela && p.perfil.conservador, t);
    assert.ok(tem(p, /liberação médica/i, 'danger'), 'sem aviso de liberação: ' + t);
    assert.ok(comPeso(p).every((it) => lo(it) >= 10 && it.series <= 3), 'carga alta com triagem positiva: ' + t);
    assert.ok(itens(p).every((it) => !exDe(it).cuidado.includes('hipertensao') && !barraComposta(exDe(it)) && exDe(it).nivel <= 2));
    planos.push(dose(p));
  }
  // todos os sinais têm o mesmo efeito (a triagem do ACSM trata qualquer sinal do mesmo jeito: liberação antes)
  assert.equal(new Set(planos).size, 1);
  assert.notEqual(planos[0], dose(gerarPlano({ ...base, objetivo: 'forca' }, GYM, 0)));
  // "só com supervisão": nenhum plano, com ou sem liberação, e a pergunta da liberação nem aparece
  for (const liberado of [undefined, 'sim']) assert.equal(gerarPlano({ ...base, triagem: ['medico'], liberado }, GYM, 0), null);
  assert.ok(!P('liberado').se({ ...base, triagem: ['medico'] }) && P('liberado').se({ ...base, triagem: ['tontura'] }));
});

test('liberação médica: só aparece quando a triagem pede, e "sim" e "não" mudam o plano', () => {
  const q = P('liberado');
  assert.ok(!q.se(base), 'sem motivo, a pergunta não aparece');
  for (const motivo of [{ triagem: ['dor_peito'] }, { condicoes: ['cardiaco'] }, { condicoes: ['gestante'] }, { condicoes: ['posparto'] }, { experiencia: 'nunca', condicoes: ['diabetes'] }, { remedios: ['glicose'], experiencia: 'nunca' }]) {
    const a = { ...base, ...motivo };
    assert.ok(q.se(a), JSON.stringify(motivo));
    assert.equal(gerarPlano({ ...a, liberado: 'nao' }, GYM, 0), null);
    assert.ok(gerarPlano({ ...a, liberado: 'sim' }, GYM, 0));
  }
  // quem já treina e tem diabetes segue em intensidade moderada sem liberação (whitfield2017): a pergunta não aparece
  assert.ok(!q.se({ ...base, condicoes: ['diabetes'] }));
});

test('remédios: cada opção muda o plano ou os avisos', () => {
  const sem = gerarPlano(base, GYM, 0);
  // remédio que segura o pulso: o cardio vai pela fala (sbc2020, pescatello2004)
  const pulso = gerarPlano({ ...base, remedios: ['pulso'] }, GYM, 0);
  assert.ok(tem(pulso, /pulso mais baixo/, 'warn') && !tem(sem, /pulso mais baixo/));
  // insulina ou remédio que baixa o açúcar: vale como diabetes (dose moderada e o aviso da hipoglicemia — colberg2016)
  const gli = gerarPlano({ ...base, objetivo: 'forca', remedios: ['glicose'] }, GYM, 0);
  assert.ok(gli.perfil.diabetes && tem(gli, /insulina/) && comPeso(gli).every((it) => lo(it) >= 8));
  // outro remédio de uso contínuo, sem condição marcada: vale como outra doença crônica (parq2023, perguntas 4 e 5)
  const outro = gerarPlano({ ...base, objetivo: 'forca', remedios: ['outro'] }, GYM, 0);
  assert.ok(outro.perfil.cronica && tem(outro, /Doença crônica/));
  // com uma condição marcada, "outro remédio" é o da condição: não soma doença crônica
  assert.ok(!perfil({ ...base, condicoes: ['hipertensao'], remedios: ['outro'] }).cronica);
  // "nenhum" e a resposta ausente (entrevistas antigas) são iguais ao plano sem remédio
  assert.equal(dose(gerarPlano({ ...base, remedios: ['nenhum'] }, GYM, 0)), dose(sem));
  todosDiferentes([sem, pulso, gli, outro].map((p) => JSON.stringify(p.avisos.map((x) => x.texto))), 'avisos por remédio');
});

test('prioridade de músculo: cada opção aumenta as séries do músculo ou diz por que não aumentou', () => {
  const MOTIVOS = ['aumentou', 'sem-direto', 'limitacao', 'teto', 'teto-outro', 'max-series', 'equilibrio', 'tempo'];
  let aumentou = 0;
  for (const g of opcoes('foco').filter((x) => !['equilibrado', 'pernas', 'bracos'].includes(x))) {
    const p = gerarPlano({ ...base, foco: [g] }, GYM, 0);
    assert.equal(p.foco.length, 1); assert.equal(p.foco[0].id, g);
    assert.ok(MOTIVOS.includes(p.foco[0].motivo) && p.foco[0].texto.length > 10, g);
    if (p.foco[0].motivo === 'aumentou') { aumentou++; assert.ok(p.volume[g] > (p0.volume[g] || 0), `${g}: disse que aumentou e não aumentou`); assert.ok(p.foco[0].para > p.foco[0].de); }
    else assert.ok(p.volume[g] <= (p0.volume[g] || 0) + 0.5, `${g}: aumentou e disse que não`);
    assert.notEqual(dose(p), dose(p0), `prioridade em ${g} não mudou o plano`);
  }
  assert.equal(aumentou, 10, 'no perfil de comparação, todas as prioridades cabem');
  // áreas antigas valem por dois músculos
  assert.deepEqual(gerarPlano({ ...base, foco: ['pernas'] }, GYM, 0).foco.map((x) => x.id), ['quadriceps', 'posteriores']);
  assert.deepEqual(gerarPlano({ ...base, foco: ['bracos'] }, GYM, 0).foco.map((x) => x.id), ['biceps', 'triceps']);
  assert.deepEqual(gerarPlano({ ...base, foco: ['equilibrado'] }, GYM, 0).foco, []);
  // quando não cabe, o plano diz: iniciante com 2 dias de 30 min só prioriza um, e o segundo fica de fora com aviso
  const curto = gerarPlano({ ...base, dias: '2', tempo: '30', foco: ['peito', 'costas'] }, GYM, 0);
  assert.equal(curto.foco.length, 1); assert.deepEqual(curto.focoFora, ['Costas']);
});

test('dores: cada local × tipo × intensidade × momento tem efeito declarado no plano (ou a razão de não ter)', () => {
  const perfis = [base, { ...base, experiencia: 'iniciante', idade: 66 }];
  const dor = (onde, tipo, nivel, quando = 'durante') => ({ id: 'd', data: '2026-11-10', onde, lado: '', tipo, quando, nivel, nota: '', fim: '', dias: 3 });
  const cont = { alerta: 0, forte: 0, media: 0, leve: 0, mudou: 0, n: 0 };
  for (const a of perfis) {
    const sem = gerarPlano(a, GYM, 0);
    for (const onde of Object.keys(LOCAIS_DOR)) {
      // nenhum local é "de enfeite": com dor de alerta, existem exercícios do catálogo que saem
      assert.ok(EXERCICIOS.some((ex) => { const al = alertaDoExercicio(ex.id, [dor(onde, 'articular', 9)], a); return al && al.nivel === 'evitar'; }), 'local de dor que não tira nenhum exercício: ' + onde);
      for (const tipo of Object.keys(TIPOS_DOR)) for (let nivel = 1; nivel <= 10; nivel++) for (const quando of Object.keys(QUANDO_DOR)) {
        const d = dor(onde, tipo, nivel, quando);
        const rot = `${onde}/${tipo}/${nivel}/${quando}`;
        const o = orientacaoDaDor(d, a);
        assert.ok(o && o.texto.length > 20 && o.refs.length && o.refs.every((k) => REFS[k]), 'orientação: ' + rot);
        // a regra comum (dor aguda, 7 ou mais, ou em repouso) sempre vira alerta
        if (dorDeAlerta(d)) assert.equal(o.classe, 'alerta', rot);
        const p = gerarPlano(a, GYM, 0, [d]);
        const evitar = (pl) => itens(pl).filter((it) => { const al = alertaDoExercicio(it.ex, [d], a); return al && al.nivel === 'evitar'; });
        const aliviar = (pl) => itens(pl).filter((it) => { const al = alertaDoExercicio(it.ex, [d], a); return al && al.nivel === 'leve'; });
        cont[o.classe]++; cont.n++;
        if (dose(p) !== dose(sem)) cont.mudou++;
        assert.equal(evitar(p).length, 0, `${rot}: plano com exercício que a dor manda evitar`);
        if (o.classe === 'alerta') {
          assert.ok(p.avisos.some((x) => x.tipo === 'warn' && x.dor === onde && /Dor de alerta/.test(x.texto) && /médico|fisioterapeuta/.test(x.texto)), 'alerta sem aviso: ' + rot);
          if (evitar(sem).length) assert.notEqual(dose(p), dose(sem), 'alerta não mudou o plano: ' + rot);
        } else if (tipo === 'muscular') {
          // dor muscular comum: passa em poucos dias e não muda o plano; no treino do dia, os exercícios do músculo pedem carga mais leve
          assert.equal(dose(p), dose(sem), 'dor muscular comum mudou o plano: ' + rot);
          assert.ok(EXERCICIOS.some((ex) => { const al = alertaDoExercicio(ex.id, [d], a); return al && al.nivel === 'leve'; }), 'dor muscular sem nenhum exercício a aliviar: ' + rot);
        } else if (o.classe === 'forte') {
          assert.ok(p.avisos.some((x) => x.dor === onde && /deixei de fora/.test(x.texto)), 'dor forte sem aviso: ' + rot);
          if (evitar(sem).length) assert.notEqual(dose(p), dose(sem), 'dor forte não mudou o plano: ' + rot);
        } else if (o.classe === 'media') {
          assert.ok(p.avisos.some((x) => x.dor === onde && /dei preferência/.test(x.texto)), 'dor média sem aviso: ' + rot);
          // o que continua no treino e pega a região aparece com o aviso de fazer mais leve
          if (dose(p) === dose(sem)) assert.ok(aliviar(p).length > 0 || !aliviar(sem).length, 'dor média sem efeito nenhum: ' + rot);
        } else {
          // dor leve (até 2 em 10) em articulação: não muda o plano
          assert.equal(o.classe, 'leve'); assert.ok(nivel <= 2, rot);
          assert.equal(dose(p), dose(sem), 'dor leve mudou o plano: ' + rot);
        }
      }
    }
  }
  assert.equal(cont.n, 2 * 20 * 3 * 10 * 3);
  assert.ok(cont.alerta > 1500 && cont.forte > 60 && cont.media > 300 && cont.leve > 60 && cont.mudou > 1500, JSON.stringify(cont));
  // quem tolera menos: no iniciante de 66 anos a mesma dor de 4 em 10 no ombro tira exercícios; no intermediário de 30, só alivia
  assert.equal(orientacaoDaDor(dor('ombro', 'articular', 4), base).classe, 'media');
  assert.equal(orientacaoDaDor(dor('ombro', 'articular', 4), perfis[1]).classe, 'forte');
  // gestante: dor na panturrilha ou no abdômen é sempre alerta
  assert.equal(orientacaoDaDor(dor('panturrilha', 'muscular', 2), { ...base, condicoes: ['gestante'] }).classe, 'alerta');
  // dor no peito que não é muscular é sempre alerta
  assert.equal(orientacaoDaDor(dor('peito', 'articular', 1), base).classe, 'alerta');
  console.log(`   Sensibilidade das dores: ${cont.n} combinações (${cont.alerta} de alerta, ${cont.forte} fortes, ${cont.media} médias, ${cont.leve} leves); ${cont.mudou} mudaram o plano`);
});

// ---------- corrida + musculação ----------
const corrida = (foco, fortalecimento = 'nao', extra = {}) => ({ foco, fortalecimento, fortes: [3], longo: 0, dias: [1, 3, 5, 0], ...extra });
const G_PERNA = new Set(['quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'adutores']);
const ehDiaDePernas = (d) => d.itens.filter((it) => G_PERNA.has(exDe(it).grupo)).length >= 2;
const vesperas = (p, c) => { const chave = new Set([...c.fortes, ...(c.longo == null ? [] : [c.longo])]); return Object.entries(p.agenda).filter(([wd, id]) => chave.has((Number(wd) + 1) % 7) && ehDiaDePernas(p.dias.find((d) => d.id === id))).length; };

test('prioridade corrida × musculação × os dois: cada opção tem o efeito declarado, e sem corrida nada muda', () => {
  // sem plano de corrida (ou com entrada inválida), o plano é exatamente o de sempre
  for (const lixo of [null, undefined, 0, '', 'x', [], {}, { foco: 'corrida' }, { fortes: 'x', longo: 'y', dias: 7 }, { foco: 'corrida', fortes: [9, -1, 2.5], longo: 8, dias: ['a'] }]) {
    for (const a of [base, { ...base, objetivo: 'emagrecimento', dias: '5' }]) { const p = gerarPlano(a, GYM, 0, null, lixo); assert.equal(doseEAgenda(p), doseEAgenda(gerarPlano(a, GYM, 0)), JSON.stringify(lixo)); assert.equal(p.combinado, null); }
  }
  let n = 0, mudouAgenda = 0;
  for (const objetivo of opcoes('objetivo')) for (const experiencia of opcoes('experiencia')) for (const dias of opcoes('dias')) for (const extra of [{}, { idade: 16 }, { condicoes: ['diabetes'], liberado: 'sim' }, { local: 'halteres' }, { tempo: '30' }])
    for (const semana of [{ fortes: [3], longo: 0, dias: [1, 3, 5, 0] }, { fortes: [2, 4], longo: 6, dias: [2, 4, 6] }, { fortes: [], longo: 0, dias: [3, 0] }, { fortes: [2], longo: null, dias: [2, 5] }, { fortes: [], longo: null, dias: [1, 4] }]) {
      const a = { ...base, objetivo, experiencia, dias, ...extra };
      const sem = gerarPlano(a, GYM, 0);
      const planos = {};
      for (const foco of ['', ...FOCOS]) {
        const c = { foco, fortalecimento: 'nao', ...semana };
        const p = planos[foco] = gerarPlano(a, GYM, 0, null, c);
        n++;
        const rot = JSON.stringify({ objetivo, experiencia, dias, ...extra, foco, semana });
        // quem corre não recebe cardio no plano de musculação: a corrida já conta
        assert.equal(p.minCardio, 0, rot);
        assert.ok(!itens(p).some((it) => ehCardio(exDe(it))), 'cardio no plano de quem corre: ' + rot);
        if (sem.minCardio > 0) assert.ok(tem(p, /Como você corre, este plano não tem cardio/), 'cardio saiu sem aviso: ' + rot);
        assert.ok(p.orientacoes.some((o) => o[0] === 'Corrida e musculação'), rot);
        assert.equal(new Set(Object.keys(p.agenda)).size, p.dias.length, rot);
        assert.equal(p.combinado.foco, foco);
        // menores de 18 e diabetes: a regra dos dias não seguidos continua valendo depois do encaixe
        if (p.perfil.jovem || p.perfil.diabetes) assert.ok(diasDeForca(p).length <= 3 && !seguidos(diasDeForca(p)), 'dias seguidos depois do encaixe: ' + rot);
        const v = vesperas(p, semana);
        assert.equal(p.combinado.vespera, foco === 'corrida' || foco === 'equilibrio' ? v : 0, rot);
        if (foco === 'corrida' || foco === 'equilibrio') {
          // nunca fica pior do que a agenda de sempre, e o que sobrar na véspera vem com aviso
          // nunca fica pior do que a agenda de sempre — a não ser para guardar um dia de descanso na semana
          const desc = (x) => 7 - new Set([...semana.dias, ...Object.keys(x.agenda).map(Number)]).size;
          if (desc(p) <= desc(planos[''])) assert.ok(v <= vesperas(planos[''], semana), `encaixe piorou a véspera: ${rot}`);
          assert.equal(tem(p, /na véspera, treine as pernas mais leve/, 'warn'), v > 0, rot);
          assert.equal(tem(p, /os treinos foram para/), p.combinado.agendaMudou, rot);
          if (p.combinado.agendaMudou) mudouAgenda++;
        } else {
          // prioridade na musculação (ou ainda sem resposta): a agenda é a de sempre
          // prioridade na musculação (ou ainda sem resposta): os dias só mudam para a semana não ficar sem descanso
          assert.equal(p.combinado.agendaMudou, tem(p, /Para a semana ter um dia de descanso, os treinos foram para/), rot);
          assert.ok(!tem(p, /Para as pernas ficarem/));
        }
      }
      // a prioridade não mexe nos exercícios nem nas séries: só nos dias da semana
      for (const foco of FOCOS) assert.equal(dose(planos[foco]), dose(planos['']), 'a prioridade mudou exercícios ou séries');
      assert.equal(doseEAgenda(planos.corrida), doseEAgenda(planos.equilibrio));
      assert.equal(doseEAgenda(planos.musculacao), doseEAgenda(planos['']));
    }
  assert.ok(n >= 8000 && mudouAgenda > 500, `amostra fraca: ${n} planos, ${mudouAgenda} agendas mudadas`);
  // caso simples: 3 treinos, um treino forte na quinta e o longo no domingo → nenhum treino de pernas na quarta nem no sábado
  for (const foco of ['corrida', 'equilibrio']) {
    const p = gerarPlano({ ...base, dias: '3' }, GYM, 0, null, { foco, fortalecimento: 'nao', fortes: [4], longo: 0, dias: [2, 4, 0] });
    assert.equal(vesperas(p, { fortes: [4], longo: 0 }), 0);
    assert.ok(!tem(p, /na véspera/));
  }
  // o texto de cada opção existe, é curto e cita fontes que existem
  for (const foco of FOCOS) { const e = efeitoDoFoco(foco, {}); assert.ok(e.linhas.length >= 1 && e.linhas.length <= 3 && e.linhas.every((l) => l.length <= 110)); assert.ok(e.refs.length && e.refs.every((k) => REFS[k])); }
  todosDiferentes(FOCOS.map((f) => JSON.stringify(efeitoDoFoco(f, {}).linhas)), 'texto do foco');
  assert.deepEqual(efeitoDoFoco('x', {}).linhas, []); assert.deepEqual(efeitoDoFoco(null, null).linhas, []);
  console.log(`   Corrida + musculação: ${n} planos; em ${mudouAgenda} os treinos mudaram de dia para poupar as pernas`);
});

test('fortalecimento dentro da musculação: "sim" garante panturrilha, abdutores, um pé só e core, sem passar do teto nem do tempo', () => {
  const ORCAMENTO = { 30: 35, 45: 50, 60: 65, 75: 90 };
  const PADROES = { panturrilha: ['flexao_plantar'], 'abdutores do quadril': ['abducao'], 'um pé só': ['afundo'], core: ['anti_extensao', 'flexao_tronco', 'rotacao', 'flexao_quadril'] };
  let n = 0, completos = 0, semEspaco = 0, semUmPe = 0;
  for (const objetivo of opcoes('objetivo')) for (const experiencia of opcoes('experiencia')) for (const dias of opcoes('dias')) for (const tempo of opcoes('tempo')) for (const extra of [{}, { local: 'halteres' }, { local: 'corporal' }, { idade: 67 }, { limitacoes: ['joelho'] }, { condicoes: ['gestante'], liberado: 'sim' }]) {
    const a = { ...base, objetivo, experiencia, dias, tempo, ...extra };
    const rot = JSON.stringify({ objetivo, experiencia, dias, tempo, ...extra });
    const nao = gerarPlano(a, GYM, 0, null, corrida('corrida', 'nao'));
    const sim = gerarPlano(a, GYM, 0, null, corrida('corrida', 'sim'));
    n++;
    const padroes = new Set(itens(sim).map((it) => exDe(it).padrao));
    const c = sim.combinado;
    assert.deepEqual([...c.garantidos, ...c.faltam].sort(), Object.keys(PADROES).sort(), rot);
    for (const g of c.garantidos) assert.ok(PADROES[g].some((p) => padroes.has(p)), `${rot}: diz que tem ${g} e não tem`);
    const existe = (g) => EXERCICIOS.some((ex) => PADROES[g].includes(ex.padrao) && permitido(ex, sim.perfil) && motivosContra(ex, sim.perfil, GYM).length === 0 && (ex.registro === 'reps' || ex.registro === 'peso_reps' || ex.grupo === 'abdomen'));
    for (const g of c.faltam) {
      assert.ok(!PADROES[g].some((p) => padroes.has(p)), `${rot}: diz que falta ${g} e tem`);
      // só pode faltar por dois motivos: não existe exercício permitido para o perfil com os aparelhos dele, ou o treino é
      // de 30 minutos e não coube (vaga principal não sai)
      if (c.semExercicio.includes(g)) assert.ok(!existe(g), `${rot}: disse que não há exercício de ${g}, e há`);
      else { assert.ok(existe(g), `${rot}: ${g} faltou sem exercício e foi dado como falta de espaço`); if (tempo !== '30') semEspaco++; }
    }
    assert.ok(c.semExercicio.every((g) => c.faltam.includes(g)));
    // mesmo com 30 minutos, o exercício em um pé só entra (no lugar de um agachamento auxiliar), salvo no treino de força
    if (objetivo !== 'forca' && existe('um pé só') && !c.garantidos.includes('um pé só')) semUmPe++;
    // as garantias nunca derrubam um grande grupo abaixo da dose de manutenção (4 séries por semana; 6 para 60 anos ou mais)
    for (const g of ['peito', 'costas', 'quadriceps', 'posteriores', 'gluteos', 'ombros']) assert.ok(sim.volume[g] >= Math.min(sim.perfil.idoso ? 6 : 4, nao.volume[g]), `${rot}: ${g} caiu de ${nao.volume[g]} para ${sim.volume[g]} séries`);
    assert.ok(tem(sim, /Fortalecimento para a corrida: o treino tem/), rot);
    if (c.faltam.length) { assert.equal(tem(sim, /Sem exercício para o seu perfil e os seus aparelhos/), c.semExercicio.length > 0, rot); assert.equal(tem(sim, /Não coube no treino sem tirar o principal/), c.faltam.length > c.semExercicio.length, rot); } else completos++;
    // continua dentro do teto do nível e do tempo
    const d = diretas(sim);
    for (const g in d) assert.ok(d[g] <= tetoSeries(sim.perfil.nivel), `${rot}: ${g} com ${d[g]} séries diretas`);
    for (const dia of sim.dias) assert.ok(duracaoEstimada(dia) <= ORCAMENTO[tempo], `${rot}: ${dia.nome} ≈ ${duracaoEstimada(dia)} min`);
    // e respeita o perfil
    for (const it of itens(sim)) assert.equal(motivosContra(exDe(it), sim.perfil, GYM).filter((m) => m.grave).length, 0, `${rot}: ${it.ex}`);
    // "não" não põe garantia nenhuma a mais, e "academia"/"casa" (pedido feito antes de ter musculação) valem como "sim"
    assert.ok(!tem(nao, /Fortalecimento para a corrida/));
    if (n % 40 === 0) for (const f of ['academia', 'casa']) assert.equal(dose(gerarPlano(a, GYM, 0, null, corrida('corrida', f))), dose(sim), rot);
  }
  assert.ok(n >= 2400 && completos > n * 0.3 && semEspaco < n * 0.2 && semUmPe < n * 0.2, `${completos} de ${n} planos com as quatro garantias; ${semEspaco} sem espaço com 45 min ou mais; ${semUmPe} sem um pé só`);
  console.log(`   Fortalecimento na musculação: ${completos} de ${n} planos com panturrilha, abdutores, um pé só e core; ${semEspaco} com garantia de fora por falta de espaço (45 min ou mais); ${semUmPe} sem exercício em um pé só`);
});

// estado com plano de corrida aceito (as respostas vêm do teste da corrida)
const RUN = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 12, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
const estado = (run = {}, mais = {}) => store.sanitize({ run: { answers: { ...RUN, ...run }, aceitoEm: '2026-10-07T12:00:00.000Z', inicio: '2026-10-05' }, ...mais });
const HOJE = '2026-11-16';

test('resumo da corrida para o Treinador: dias de corrida, treino forte e longo; sem plano de corrida, null', () => {
  assert.equal(resumoCombinado(store.sanitize({}), HOJE), null);
  for (const lixo of [null, undefined, 5, 'x', [], {}, { run: null }, { run: { aceitoEm: 'x' } }]) assert.doesNotThrow(() => resumoCombinado(lixo, HOJE));
  assert.equal(resumoCombinado(null, HOJE), null);
  const st = estado({}, { combo: { foco: 'corrida', fortalecimento: 'sim', em: '2026-11-01T10:00:00.000Z' } });
  const r = resumoCombinado(st, HOJE);
  assert.ok(r && r.foco === 'corrida' && r.fortalecimento === 'sim');
  assert.deepEqual(r.dias.slice().sort(), [0, 2, 4, 6]);
  assert.equal(r.longo, 0);
  assert.ok(r.fortes.every((w) => r.dias.includes(w)) && r.longos.includes(r.longo) && r.longos.every((w) => r.dias.includes(w)));
  // plano pausado: sem corrida
  assert.equal(resumoCombinado({ ...st, run: { ...st.run, pausadoEm: '2026-11-10T10:00:00.000Z' } }, HOJE), null);
  // plano aceito que ainda não começou: vale a primeira semana
  const futuro = store.sanitize({ run: { answers: RUN, aceitoEm: '2026-11-15T12:00:00.000Z', inicio: '2026-11-23' } });
  assert.deepEqual(resumoCombinado(futuro, HOJE).dias.slice().sort(), [0, 2, 4, 6]);
  // a chave guardada com o plano aceito muda quando a escolha muda
  assert.notEqual(chaveCombo({ foco: 'corrida', fortalecimento: 'sim' }), chaveCombo({ foco: 'musculacao', fortalecimento: 'sim' }));
  // o plano gerado com o resumo de verdade tira as pernas da véspera do longo e dos treinos fortes
  const p = gerarPlano({ ...base, dias: '3' }, GYM, 0, null, r);
  assert.equal(p.combinado.vespera, vesperas(p, r));
  assert.ok(p.combinado.garantidos.length === 4);
});

test('plano de fortalecimento para quem só corre: academia e casa, por perfil, longe das corridas fortes, sem exercício inseguro', () => {
  const CASA = ['colchonete'];
  let n = 0, nulos = 0, um = 0;
  const assin = (f) => JSON.stringify(f.dias.map((d) => d.itens.map((i) => [i.ex, i.series, i.reps, i.descanso])));
  const dor = (onde, tipo, nivel) => ({ id: 'd' + onde, data: '2026-11-12', onde, lado: '', tipo, quando: 'durante', nivel, nota: '', fim: '', dias: 4 });
  // (diabetes, gestação e sinal da triagem: com a liberação para correr, dada hoje — sem ela, não há plano: teste abaixo)
  const lib = { liberado: 'sim', liberadoEm: HOJE };
  for (const run of [{}, { idade: 16 }, { idade: 68 }, { limitacoes: ['joelho'] }, { limitacoes: ['aquiles', 'lombar'] }, { condicoes: ['hipertensao'] }, { condicoes: ['diabetes'], ...lib }, { condicoes: ['gestante'], ...lib }, { triagem: ['dor_peito'], ...lib }, { peso: 110, altura: 165 }, { dias: ['1', '2', '3', '4', '5', '6'] }, { dias: ['3', '0'] }])
    for (const treinador of [null, { ...base, experiencia: 'avancado' }, { ...base, experiencia: 'iniciante', local: 'halteres', extras: ['elastico'] }])
      for (const dores of [[], [dor('joelho', 'articular', 8)], [dor('panturrilha', 'muscular', 4)], [dor('lombar', 'aguda', 5), dor('quadril', 'articular', 4)]])
        for (const ocupados of [[], [1, 3, 5], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6]]) for (const local of ['academia', 'casa']) {
          const st = estado(run, { trainer: treinador ? { answers: treinador } : undefined, dores });
          const rot = JSON.stringify({ run, treinador: treinador && treinador.experiencia, dores: dores.map((d) => d.onde + d.nivel), ocupados, local });
          const f = planoFortalecimento(st, { local, hoje: HOJE, ocupados });
          n++;
          assert.ok(f, 'estado válido sempre devolve um objeto: ' + rot);
          if (!f.dias.length) {
            nulos++;
            assert.ok(['sem_dias', 'dor', 'sem_exercicios'].includes(f.motivo) && f.texto.length > 30 && f.texto.length < 240, `${rot}: ${f.motivo} / ${f.texto}`);
            if (f.motivo === 'sem_dias') assert.equal(ocupados.length, 7, rot); else assert.ok(dores.length > 0, rot + ' ' + f.motivo);
            assert.ok(ocupados.length === 7 || dores.length > 0, 'sem plano sem dor e com dia livre: ' + rot);
            continue;
          }
          assert.equal(f.motivo, '');
          const pf = f.perfil;
          assert.equal(f.nome, 'Fortalecimento para corrida');
          assert.ok(f.dias.length >= 1 && f.dias.length <= 2, rot);
          if (f.dias.length === 1) um++;
          const wds = Object.keys(f.agenda).map(Number);
          assert.equal(wds.length, f.dias.length, rot);
          assert.ok(wds.every((w) => w >= 0 && w <= 6 && !ocupados.includes(w)), 'treino em dia ocupado: ' + rot);
          assert.deepEqual(Object.values(f.agenda).sort(), f.dias.map((d) => d.id).sort());
          if (wds.length === 2) assert.ok(Math.min((wds[0] - wds[1] + 7) % 7, (wds[1] - wds[0] + 7) % 7) >= 2, 'treinos de força em dias seguidos: ' + rot);
          const resumo = resumoCombinado(st, HOJE);
          const chave = new Set([...resumo.fortes, ...resumo.longos]);
          const naVespera = wds.filter((w) => chave.has((w + 1) % 7)).length;
          assert.equal(f.avisos.some((x) => /véspera/.test(x.texto)), naVespera > 0, rot);
          // com a semana livre, nenhum treino na véspera de corrida forte ou do longo
          if (!ocupados.length && resumo.dias.length <= 4 && chave.size <= 2) assert.equal(naVespera, 0, 'fortalecimento na véspera com dias livres: ' + rot);
          // a semana não fica sem descanso por causa do fortalecimento quando havia saída
          if (7 - new Set([...resumo.dias, ...ocupados, ...wds]).size < 1) assert.ok(f.avisos.some((x) => x.tipo === 'warn' && /sem nenhum dia de descanso/.test(x.texto)), 'semana sem descanso, sem aviso: ' + rot);
          for (const d of f.dias) {
            assert.ok(d.itens.length >= 3 && d.itens.length <= 6 && d.nome && d.foco, rot);
            assert.equal(new Set(d.itens.map((i) => i.ex)).size, d.itens.length, 'exercício repetido: ' + rot);
            assert.ok(duracaoEstimada(d) <= 45, `${rot}: ${duracaoEstimada(d)} min`);
            for (const it of d.itens) {
              const ex = exDe(it);
              assert.ok(ex, it.ex);
              assert.ok(permitido(ex, pf), `${rot}: ${it.ex} não é permitido para o perfil`);
              assert.equal(motivosContra(ex, pf, st.gym, dores).filter((m) => m.grave).length, 0, `${rot}: ${it.ex}`);
              assert.ok(!ehCardio(ex) && !soManual(ex.id) && ex.grupo !== 'funcional');
              const al = alertaDoExercicio(it.ex, dores, pf);
              assert.ok(!al || al.nivel !== 'evitar', `${rot}: ${it.ex} carrega a região dolorida`);
              assert.ok(it.series >= 2 && it.series <= 3 && /^\d+(-\d+)?$/.test(it.reps) && it.descanso >= 45 && it.descanso <= 150, `${rot}: ${it.ex} ${it.series}×${it.reps}`);
              if (local === 'casa') assert.ok(ex.equip.every((e) => CASA.includes(e) || (treinador && treinador.local === 'halteres' && ['halteres', 'banco_reto', 'elastico'].includes(e))), `${rot}: ${it.ex} pede ${ex.equip}`);
              else assert.ok(!ex.equip.some((e) => EQUIPAMENTOS[e] && EQUIPAMENTOS[e].raro), `${rot}: aparelho raro`);
              // quem não respondeu ao Treinador é tratado como iniciante: só exercícios de nível 1, 2 séries
              if (!treinador) assert.ok(ex.nivel === 1 && it.series === 2, `${rot}: ${it.ex} n${ex.nivel} ${it.series} séries`);
              if (pf.cautela && ex.registro === 'peso_reps') assert.ok(lo(it) >= 10, `${rot}: carga alta para perfil com cautela`);
            }
          }
          // as respostas da corrida entram no perfil
          if (run.limitacoes) assert.ok(pf.cuidados.length > 0, rot);
          if (run.condicoes || run.triagem) assert.ok(pf.cautela || pf.moderado, rot);
          if (pf.liberacao) assert.ok(f.avisos.some((x) => x.tipo === 'danger' && /médic/.test(x.texto)), rot);
          for (const d of dores) if (orientacaoDaDor(d, pf).classe === 'alerta') assert.ok(f.avisos.some((x) => x.dor === d.onde && /Dor de alerta/.test(x.texto)), 'dor de alerta sem aviso: ' + rot);
          assert.ok(f.info.length > 40 && f.info.length < 320 && !/undefined|null|NaN/.test(f.info));
          assert.ok(f.avisos.every((x) => ['info', 'warn', 'danger'].includes(x.tipo) && x.texto.length > 10) && f.refs.every((k) => REFS[k]));
          // determinístico (fora os identificadores)
          assert.equal(assin(planoFortalecimento(st, { local, hoje: HOJE, ocupados })), assin(f));
        }
  assert.ok(n === 12 * 3 * 4 * 4 * 2 && nulos < n * 0.45 && um > 0, `${n} casos, ${nulos} sem plano, ${um} com um treino só`);
  // perfil simples: dois treinos com agachar ou ponte, panturrilha, abdutores e core
  for (const local of ['academia', 'casa']) {
    const f = planoFortalecimento(estado(), { local, hoje: HOJE, ocupados: [] });
    assert.equal(f.dias.length, 2);
    const padroes = new Set(f.dias.flatMap((d) => d.itens).map((it) => exDe(it).padrao));
    for (const grupo of [['abducao'], ['afundo'], ['anti_extensao', 'flexao_tronco', 'rotacao'], ['agachar', 'extensao_quadril', 'dobradica_quadril']]) assert.ok(grupo.some((p) => padroes.has(p)), `${local}: sem ${grupo[0]}`);
    // panturrilha: entra nos dois lugares (em casa, a elevação de calcanhares no chão, de nível 1 e sem aparelho)
    assert.ok(padroes.has('flexao_plantar'), `${local}: sem panturrilha`); assert.deepEqual(f.faltam, []);
    assert.match(f.info, /duas vezes por semana/);
    assert.ok(f.avisos.some((x) => (local === 'casa' ? /prevenção/ : /economia de corrida/).test(x.texto)));
  }
  // menor de 14 anos e entradas inválidas: sem plano, sem erro
  for (const idade of [12, 13]) { const f = planoFortalecimento(estado({ idade }), { local: 'casa', hoje: HOJE, ocupados: [] }); assert.equal(f.motivo, 'idade'); assert.equal(f.dias.length, 0); assert.match(f.texto, /Antes dos 14 anos.*profissional/); assert.ok(f.refs.every((k) => REFS[k])); }
  // parto nos últimos 6 meses: sem plano, com o motivo e as fontes da corrida
  { const f = planoFortalecimento(estado({ condicoes: ['posparto'] }), { local: 'casa', hoje: HOJE, ocupados: [] }); assert.equal(f.motivo, 'saude'); assert.match(f.texto, /fisioterapeuta pélvica/); assert.ok(f.refs.length && f.refs.every((k) => REFS[k])); }
  // limitação "coxa" da corrida: o plano avisa nos exercícios que usam a coxa
  { const f = planoFortalecimento(estado({ limitacoes: ['coxa'] }), { local: 'academia', hoje: HOJE, ocupados: [] }); assert.ok(f.avisos.some((x) => x.lim === 'coxa-frente') && f.avisos.some((x) => x.lim === 'coxa-tras')); }
  for (const lixo of [null, undefined, 5, 'x', [], {}]) { assert.doesNotThrow(() => planoFortalecimento(lixo, lixo)); assert.doesNotThrow(() => planoFortalecimento(estado(), lixo)); }
  assert.equal(planoFortalecimento(null, {}), null);
  // opções inválidas caem no padrão (academia, nenhum dia ocupado)
  assert.ok(planoFortalecimento(estado(), { local: '<b>', hoje: 12, ocupados: 'x' }));
  console.log(`   Fortalecimento para quem só corre: ${n} casos (${nulos} sem plano possível, ${um} com um treino por semana)`);
});

test('perguntas frequentes: corrida com musculação e fortalecimento têm resposta com fontes', () => {
  const corre = FAQ_TREINO.find((x) => /Corro e faço musculação/.test(x.q));
  const fort = FAQ_TREINO.find((x) => /Quem corre precisa de fortalecimento/.test(x.q));
  assert.ok(corre && fort);
  for (const x of [corre, fort]) { assert.ok(x.f.length >= 4 && x.f.every((k) => REFS[k])); assert.ok(x.a.every((t) => t.length < 520)); }
  assert.match(fort.a.join(' '), /já faz musculação/); assert.match(fort.a.join(' '), /não faz musculação/);
  for (const k of ['blagrove2018', 'petre2021', 'eddens2018', 'methenitis2018', 'doma2017', 'ronnestad2014', 'leppanen2024', 'wu2024', 'toresdahl2020', 'hamner2013']) assert.ok(REFS[k], k);
});

test('outra versão e trocas continuam valendo para quem corre', () => {
  const c = corrida('corrida', 'sim');
  const prox = outraVersao(base, GYM, 0, { combinado: c });
  assert.ok(prox && prox.trocados > 0);
  assert.equal(prox.plano.minCardio, 0);
  assert.equal(prox.plano.combinado.foco, 'corrida');
  for (const it of itens(prox.plano)) for (const alt of alternativas(exDe(it), prox.plano.perfil, GYM)) assert.ok(permitido(alt, prox.plano.perfil));
});

test('agachamento hack invertido e articulado de frente: só para escolha manual — nunca em plano automático, em troca sugerida nem em alternativa', () => {
  for (const id of ['agachamento-hack-invertido', 'agachamento-articulado-de-frente']) soManualNuncaAutomatico(id);
  assert.match(FAQ_TREINO.find((x) => /não escolhe sozinho/.test(x.q)).a.join(' '), /hack invertido e o articulado de frente/);
});
function soManualNuncaAutomatico(id) {
  assert.ok(EX_POR_ID.has(id) && soManual(id));
  assert.ok(!soManual('agachamento-articulado') && !soManual('hack-machine'), 'o hack comum e o articulado continuam podendo ser prescritos');
  const gymHack = { all: false, has: { hack: true, agachamento_articulado: true, halteres: true, banco_reto: true, leg_press_45: true, cadeira_extensora: true, mesa_flexora: true, polia_alta: true, colchonete: true } };
  let n = 0, comHack = 0;
  for (const gym of [GYM, gymHack]) for (const local of ['completa', 'minha']) for (const experiencia of opcoes('experiencia')) for (const objetivo of opcoes('objetivo')) for (const dias of ['3', '5']) for (let v = 0; v < 6; v++) {
    const a = { ...base, local, experiencia, objetivo, dias, foco: ['quadriceps'] };
    const p = gerarPlano(a, gym, v);
    n++;
    assert.ok(!itens(p).some((it) => it.ex === id), 'hack invertido em plano automático');
    if (itens(p).some((it) => it.ex === 'hack-machine' || it.ex === 'agachamento-articulado')) comHack++;
    for (const t of sugerirTrocas({ dias: p.dias }, a, gym, 6)) assert.notEqual(t.para, id, 'hack invertido em troca sugerida');
    const prox = outraVersao(a, gym, v);
    if (prox) assert.ok(!itens(prox.plano).some((it) => it.ex === id));
  }
  for (const ex of EXERCICIOS) for (const experiencia of ['intermediario', 'avancado']) assert.ok(!alternativas(ex, perfil({ ...base, experiencia, local: 'minha' }), { all: true, has: {} }).some((x) => x.id === id), 'hack invertido como alternativa de ' + ex.id);
  assert.ok(n >= 900 && comHack > 0, `${n} planos, ${comHack} com hack comum ou articulado`);
  assert.ok(motivosContra(EX_POR_ID.get(id), perfil({ ...base, experiencia: 'avancado' }), GYM).some((m) => m.id === 'manual' && m.grave));
}

// ---------- rodada 6: achados da auditoria de lesões e questionários ----------
test('descanso semanal: a prioridade na corrida nunca tira o último dia sem treino; menores, 60+ e iniciantes não perdem descanso por causa dela', () => {
  // o caso da auditoria: 16 anos, corre 6 dias, musculação 3 dias
  const semana = { fortes: [], longo: 0, dias: [1, 2, 3, 4, 5, 0] };
  const desc = (p, s) => 7 - new Set([...s.dias, ...Object.keys(p.agenda).map(Number)]).size;
  for (const foco of ['', 'musculacao', 'corrida', 'equilibrio']) {
    const p = gerarPlano({ ...base, idade: 16, dias: '3' }, GYM, 0, null, { foco, fortalecimento: 'nao', ...semana });
    assert.equal(desc(p, semana), 1, `foco "${foco}": ${desc(p, semana)} dias de descanso`);
    assert.equal(p.combinado.descanso, 1);
    assert.ok(!seguidos(diasDeForca(p)), 'força em dias seguidos para menor de 18');
    assert.ok(!tem(p, /sem nenhum dia de descanso/));
  }
  let n = 0, zero = 0, piorVul = 0;
  for (const extra of [{}, { idade: 16 }, { idade: 66 }, { experiencia: 'iniciante' }, { condicoes: ['diabetes'] }]) for (const dias of opcoes('dias')) for (const objetivo of ['hipertrofia', 'emagrecimento', 'forca'])
    for (const s of [{ fortes: [3], longo: 0, dias: [1, 3, 5, 0] }, { fortes: [2, 4], longo: 6, dias: [1, 2, 4, 5, 6] }, { fortes: [2], longo: 0, dias: [1, 2, 3, 4, 5, 0] }, { fortes: [], longo: 6, dias: [2, 3, 4, 5, 6, 0] }, { fortes: [4], longo: null, dias: [2, 4] }])
      for (const foco of ['', 'musculacao', 'corrida', 'equilibrio']) {
        const a = { ...base, ...extra, dias, objetivo };
        const p = gerarPlano(a, GYM, 0, null, { foco, fortalecimento: 'nao', ...s });
        n++;
        const d = desc(p, s);
        assert.equal(p.combinado.descanso, d);
        if (d === 0) { zero++; assert.ok(tem(p, /sem nenhum dia de descanso/, 'warn'), 'semana sem descanso, sem aviso'); }
        if ((foco === 'corrida' || foco === 'equilibrio') && (p.perfil.jovem || p.perfil.idoso || p.perfil.nivel === 1)) {
          const q = gerarPlano(a, GYM, 0, null, { foco: '', fortalecimento: 'nao', ...s });
          if (d < desc(q, s) && d < 2) piorVul++;
        }
      }
  assert.ok(n >= 1400);
  assert.equal(zero, 0, 'com até 6 dias de corrida e de musculação, sempre sobra um dia de descanso');
  assert.equal(piorVul, 0, 'menor de 18, 60+ ou iniciante com menos descanso por causa da prioridade na corrida');
  for (const k of ['meeusen2013', 'valovichmcleod2011', 'valovichmcleod2011']) assert.ok(REFS[k], k);
});

test('limitação da entrevista pela mecânica: o que usa a região fica por último e, se entra, o plano avisa (quadril, tornozelo e as outras)', () => {
  const REGIAO = { ombro: 'ombro', joelho: 'joelho', lombar: 'lombar', cervical: 'pescoco', cotovelo: 'cotovelo', punho: 'punho', quadril: 'quadril', tornozelo: 'tornozelo' };
  assert.deepEqual(Object.keys(REGIAO).sort(), opcoes('limitacoes').filter((x) => x !== 'nenhuma').sort());
  let n = 0, comAviso = 0;
  for (const lim of Object.keys(REGIAO)) for (const local of ['completa', 'halteres', 'corporal']) for (const experiencia of opcoes('experiencia')) for (const dias of ['3', '5']) for (let v = 0; v < 3; v++) {
    const a = { ...base, local, experiencia, dias, limitacoes: [lim] };
    const p = gerarPlano(a, GYM, v);
    n++;
    assert.deepEqual(p.perfil.regioesLim, [REGIAO[lim]]);
    const aviso = p.avisos.find((x) => x.lim === REGIAO[lim]);
    if (aviso) { comAviso++; assert.match(aviso.texto, /menos carga e só a amplitude sem dor/); assert.ok(aviso.texto.length < 260); }
    // exercício de pernas em pé com limitação no quadril ou no tornozelo nunca passa calado
    if ((lim === 'quadril' || lim === 'tornozelo') && itens(p).some((it) => ['agachar', 'afundo', 'dobradica_quadril'].includes(exDe(it).padrao))) assert.ok(aviso, `${lim}/${local}/${experiencia}: agachar ou afundo sem aviso`);
    // o que a avaliação diz do mesmo plano: nenhum exercício reprovado por regra de segurança; os que usam a região são apontados
    const usam = itens(p).filter((it) => motivosContra(exDe(it), p.perfil, GYM).some((x) => x.id === 'limitacao'));
    for (const it of itens(p)) assert.ok(!motivosContra(exDe(it), p.perfil, GYM).some((x) => x.grave), `${lim}: ${it.ex} reprovado`);
    assert.equal(!!aviso, usam.length > 0, `${lim}/${local}: aviso e exercícios que usam a região não batem`);
  }
  assert.ok(n === 8 * 3 * 4 * 2 * 3 && comAviso > n * 0.6, `${comAviso} de ${n} planos com aviso`);
  const pf = perfil({ ...base, limitacoes: ['quadril'] });
  assert.ok(motivosContra(EX_POR_ID.get('leg-press-45'), pf, GYM).some((m) => m.id === 'limitacao' && !m.grave));
  assert.equal(motivosContra(EX_POR_ID.get('rosca-direta-barra-w'), pf, GYM).length, 0);
});

test('pendurados (barra fixa e paralelas): fora do plano de gestante, pressão alta, coração, triagem positiva, 60+ e IMC de 30 ou mais', () => {
  const pend = (ex) => ex.equip.includes('barra_fixa') || ex.equip.includes('paralelas');
  let comBarra = 0, n = 0;
  for (const [nome, extra, risco] of [['gestante', { condicoes: ['gestante'], liberado: 'sim' }, true], ['IMC 36', { peso: 110 }, true], ['pressão alta', { condicoes: ['hipertensao'] }, true], ['coração', { condicoes: ['cardiaco'], liberado: 'sim' }, true], ['triagem', { triagem: ['tontura'], liberado: 'sim' }, true], ['72 anos', { idade: 72 }, true], ['adulto saudável', {}, false]])
    for (const objetivo of opcoes('objetivo')) for (const experiencia of ['iniciante', 'intermediario', 'avancado']) for (const dias of ['3', '5']) for (const local of ['halteres', 'corporal', 'completa']) for (let v = 0; v < 4; v++) {
      const a = { ...base, ...extra, objetivo, experiencia, dias, local, extras: ['barra_fixa'] };
      const p = gerarPlano(a, GYM, v);
      n++;
      const temPend = itens(p).some((it) => pend(exDe(it)));
      if (risco) {
        assert.ok(!temPend, `${nome}: exercício pendurado no plano (${itens(p).filter((it) => pend(exDe(it))).map((it) => it.ex)})`);
        for (const t of sugerirTrocas({ dias: p.dias }, a, GYM, 4)) assert.ok(!pend(EX_POR_ID.get(t.para)), nome + ': pendurado em troca sugerida');
      } else if (temPend) comBarra++;
    }
  for (const extra of [{ condicoes: ['gestante'] }, { peso: 110 }, { condicoes: ['hipertensao'] }, { condicoes: ['cardiaco'] }, { triagem: ['tontura'] }, { idade: 72 }]) {
    const pf = perfil({ ...base, experiencia: 'avancado', ...extra });
    for (const ex of EXERCICIOS.filter(pend)) { assert.ok(!permitido(ex, pf), `${JSON.stringify(extra)}: ${ex.id} permitido`); assert.ok(motivosContra(ex, pf, GYM).some((m) => m.grave)); }
  }
  assert.ok(n > 2000 && comBarra > 50, 'o adulto saudável que marcou a barra fixa continua recebendo: ' + comBarra);
  for (const id of ['barra-fixa-pronada', 'barra-fixa-supinada', 'barra-fixa-neutra']) assert.ok(EX_POR_ID.get(id).cuidado.includes('hipertensao') && EX_POR_ID.get(id).cuidado.includes('gestante'), id);
});

test('dor de alerta no pescoço tira o bom-dia com as mãos atrás da cabeça', () => {
  const dor = [{ id: 'x', data: '2026-11-10', onde: 'pescoco', lado: '', tipo: 'aguda', quando: 'durante', nivel: 8, nota: '', fim: '', dias: 1 }];
  assert.equal(alertaDoExercicio('bom-dia-peso-corporal', dor, base).nivel, 'evitar');
  for (const local of ['halteres', 'corporal']) for (const experiencia of opcoes('experiencia')) for (let v = 0; v < 6; v++) {
    assert.ok(!itens(gerarPlano({ ...base, local, experiencia }, GYM, v, dor)).some((it) => it.ex === 'bom-dia-peso-corporal'));
    assert.ok(!itens(gerarPlano({ ...base, local, experiencia, limitacoes: ['cervical'] }, GYM, v)).some((it) => it.ex === 'bom-dia-peso-corporal'));
  }
});

test('dor de alerta não expira calada: fica pendente até a resposta, e a volta é gradual por 2 semanas', () => {
  const maisDias = (dia, n) => new Date(Date.parse(dia + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const D0 = '2026-10-01';
  const joelho = { id: 'j1', data: D0, onde: 'joelho', lado: 'd', tipo: 'aguda', quando: 'durante', nivel: 9, nota: '', fim: '' };
  const st = store.sanitize({ trainer: { answers: base }, dores: [joelho] });
  const sem = gerarPlano(base, GYM, 0);
  const comJoelho = (p) => itens(p).filter((it) => { const al = alertaDoExercicio(it.ex, [{ ...joelho, dias: 1 }], base); return al && al.nivel === 'evitar'; }).length;
  assert.ok(comJoelho(sem) >= 4);
  for (const dia of [0, 5, DIAS_ATIVA, DIAS_ATIVA + 1, DIAS_ATIVA + 2, 40, 120]) {
    const hoje = maisDias(D0, dia);
    const dores = doresDoTreino(st, hoje, base);
    assert.equal(dores.length, 1, 'dia ' + dia);
    assert.equal(doresAtivas(st, hoje).length, dia <= DIAS_ATIVA ? 1 : 0);
    assert.equal(doresPendentes(st, hoje, base).length, dia <= DIAS_ATIVA ? 0 : 1, 'pendente no dia ' + dia);
    const p = gerarPlano(base, GYM, 0, dores);
    assert.equal(comJoelho(p), 0, `dia ${dia}: o plano voltou a treinar o joelho sem perguntar`);
    assert.ok(tem(p, /Dor de alerta no joelho/, 'warn'));
  }
  // dor moderada que expira não fica pendente (só as de alerta e as acima do aceitável)
  const moderada = store.sanitize({ trainer: { answers: base }, dores: [{ ...joelho, tipo: 'articular', nivel: 3 }] });
  assert.equal(doresPendentes(moderada, maisDias(D0, 30), base).length, 0);
  assert.equal(doresDoTreino(moderada, maisDias(D0, 30), base).length, 0);
  const forte = store.sanitize({ trainer: { answers: base }, dores: [{ ...joelho, tipo: 'articular', nivel: 6 }] });
  assert.equal(doresPendentes(forte, maisDias(D0, 30), base).length, 1);
  // "Ainda dói" (novo relato) volta a contar como ativa; "Melhorou" abre a volta gradual de 14 dias
  const ainda = store.sanitize({ trainer: { answers: base }, dores: [joelho, { ...joelho, id: 'j2', data: maisDias(D0, 30) }] });
  assert.equal(doresPendentes(ainda, maisDias(D0, 31), base).length, 0);
  assert.equal(doresAtivas(ainda, maisDias(D0, 31)).length, 1);
  const fim = maisDias(D0, 30);
  const melhorou = store.sanitize({ trainer: { answers: base }, dores: [{ ...joelho, fim }] });
  for (const dia of [0, 7, 14]) {
    const hoje = maisDias(fim, dia);
    const dores = doresDoTreino(melhorou, hoje, base);
    assert.equal(dores.length, 1); assert.equal(dores[0].volta, true);
    assert.equal(doresPendentes(melhorou, hoje, base).length, 0);
    const o = orientacaoDaDor(dores[0], base);
    assert.equal(o.classe, 'volta'); assert.ok(o.refs.every((k) => REFS[k]) && o.refs.includes('caterisano2019'));
    const p = gerarPlano(base, GYM, 0, dores);
    assert.ok(tem(p, /Volta depois da dor no joelho: por 2 semanas/), 'sem aviso de volta no dia ' + dia);
    // os exercícios de joelho voltam, com o aviso de ir mais leve — nunca "evitar"
    assert.ok(comJoelho(p) > 0, 'a região não voltou');
    for (const it of itens(p)) { const al = alertaDoExercicio(it.ex, dores, base); assert.ok(!al || al.nivel === 'leve'); }
    assert.ok(itens(p).some((it) => { const al = alertaDoExercicio(it.ex, dores, base); return al && /Volta depois da dor no joelho/.test(al.texto); }));
    // no plano ativo: nada a pular nem a trocar
    assert.ok(ajustesPorDor({ dias: sem.dias }, base, GYM, dores).every((x) => x.tipo === 'aliviar'));
  }
  assert.equal(doresDoTreino(melhorou, maisDias(fim, 15), base).length, 0, 'a volta gradual termina depois de 14 dias');
  assert.equal(dose(gerarPlano(base, GYM, 0, doresDoTreino(melhorou, maisDias(fim, 15), base))), dose(sem));
  // dor comum que melhorou não abre volta gradual
  const comum = store.sanitize({ trainer: { answers: base }, dores: [{ ...joelho, tipo: 'articular', nivel: 3, fim }] });
  assert.equal(doresDoTreino(comum, fim, base).length, 0);
  // entradas inválidas
  for (const lixo of [null, undefined, 5, 'x', {}, { dores: 'x' }, { dores: [null, 1, { onde: 'x' }] }]) { assert.deepEqual(doresDoTreino(lixo, '2026-11-16'), []); assert.deepEqual(doresPendentes(lixo, 'x'), []); }
});

test('respostas para os avisos da sessão: as do Treinador; sem elas, um perfil montado com as respostas da corrida', () => {
  assert.equal(respostasParaAvisos(null), null);
  assert.equal(respostasParaAvisos(store.sanitize({})), null);
  const soTreinador = store.sanitize({ trainer: { answers: base } });
  assert.deepEqual(respostasParaAvisos(soTreinador), soTreinador.trainer.answers);
  // gestante que só corre: dor de 3 em 10 na panturrilha é alerta (com as respostas certas), não "leve"
  const st = estado({ condicoes: ['gestante'] });
  const r = respostasParaAvisos(st);
  assert.ok(r && perfil(r).gestante);
  const dor = [{ id: 'x', data: '2026-11-15', onde: 'panturrilha', lado: '', tipo: 'articular', quando: 'durante', nivel: 3, nota: '', fim: '', dias: 1 }];
  assert.equal(alertaDoExercicio('panturrilha-em-pe-maquina', dor, r).nivel, 'evitar');
  assert.equal(alertaDoExercicio('panturrilha-em-pe-maquina', dor, null).nivel, 'leve');
  // com as duas, valem as do Treinador, mais o que a corrida marcou e o Treinador não (o lado mais protegido)
  const dois = estado({ condicoes: ['gestante'] }, { trainer: { answers: base } });
  assert.equal(perfil(respostasParaAvisos(dois)).gestante, true);
  assert.equal(perfil(respostasParaAvisos(estado({}, { trainer: { answers: base } }))).gestante, false);
});

test('fortalecimento para quem só corre: sem a liberação que a triagem pede (ou vencida), não há plano', () => {
  for (const run of [{ condicoes: ['diabetes'] }, { condicoes: ['gestante'] }, { triagem: ['dor_peito'] }, { triagem: ['palpitacao'] }, { condicoes: ['cardiaco'] }]) {
    for (const lib of [{}, { liberado: 'nao' }, { liberado: 'sim' }, { liberado: 'sim', liberadoEm: '2025-10-01' }]) {
      const f = planoFortalecimento(estado({ ...run, ...lib }), { local: 'academia', hoje: HOJE, ocupados: [] });
      assert.ok(f && !f.dias.length && f.motivo === 'saude' && /liberação|médico/.test(f.texto), JSON.stringify({ run, lib }));
    }
    assert.ok(planoFortalecimento(estado({ ...run, liberado: 'sim', liberadoEm: '2026-06-01' }), { local: 'academia', hoje: HOJE, ocupados: [] }).dias.length, JSON.stringify(run));
  }
  // "só com supervisão": nunca
  const sup = planoFortalecimento(estado({ triagem: ['medico'], liberado: 'sim', liberadoEm: HOJE }), { local: 'casa', hoje: HOJE, ocupados: [] });
  assert.ok(!sup.dias.length && sup.motivo === 'saude' && /supervisão/.test(sup.texto));
});

test('robustez: item nulo ou torto em um treino não derruba duração, volume nem trocas', () => {
  const torto = { dias: [{ id: 'a', nome: 'A', itens: [null, undefined, 5, 'x', { ex: 'supino-maquina', series: 3, reps: '8-12', descanso: 90 }, { ex: null }, {}] }, null, { itens: null }], agenda: { 1: 'a' } };
  assert.doesNotThrow(() => duracaoEstimada(torto.dias[0]));
  assert.ok(duracaoEstimada(torto.dias[0]) >= 5);
  assert.doesNotThrow(() => duracaoEstimada({ itens: [null] }));
  assert.equal(volumeSemanal(torto.dias).peito, 3);
  assert.doesNotThrow(() => volumeSemanal([{ itens: [null] }, null]));
  assert.doesNotThrow(() => sugerirTrocas(torto, base, GYM, 2));
  assert.doesNotThrow(() => sugerirTrocas({ dias: [{ itens: [null] }] }, base, GYM, 2, [null]));
});

test('fortalecimento e as semanas seguintes da corrida: os dias-chave são os de todo o plano, não só os desta semana', () => {
  const st = estado();
  const r = resumoCombinado(st, HOJE);
  assert.ok(r.longos.length >= 1 && r.dias.length >= 4);
  for (const local of ['academia', 'casa']) {
    const f = planoFortalecimento(st, { local, hoje: HOJE, ocupados: [] });
    const chave = new Set([...r.fortes, ...r.longos]);
    const vesp = Object.keys(f.agenda).map(Number).filter((w) => chave.has((w + 1) % 7)).length;
    assert.equal(f.avisos.some((x) => /véspera/.test(x.texto)), vesp > 0);
  }
  // mais adiante no plano, os dias-chave são um subconjunto dos vistos hoje (hoje já se enxergam as semanas futuras)
  const depois = resumoCombinado(st, '2026-11-23');
  assert.ok(depois.fortes.every((w) => r.fortes.includes(w)) && depois.longos.every((w) => r.longos.includes(w)));
});

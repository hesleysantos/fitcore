// Testes do Treinador: gera planos para centenas de perfis e confere as regras de segurança e de dose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EX_POR_ID } from '../www/js/data/exercises.js';
import { EQUIPAMENTOS } from '../www/js/data/equipment.js';
import { PERGUNTAS, respostasCompletas, gerarPlano, perfil, sugerirTrocas, alternativas, volumeSemanal } from '../www/js/logic/trainer.js';

const GYM_ALL = { all: true, has: {} };
const base = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };
const OBJ = ['hipertrofia', 'emagrecimento', 'forca', 'saude', 'resistencia'];
const EXP = ['nunca', 'iniciante', 'intermediario', 'avancado'];
const DIAS = ['2', '3', '4', '5', '6'];
const TEMPO = ['30', '45', '60', '75'];

function confere(a, gym, rotulo) {
  const p = gerarPlano(a, gym, 0);
  assert.ok(p, 'plano não gerado: ' + rotulo);
  const pf = perfil(a);
  assert.equal(p.dias.length, pf.dias, 'número de treinos: ' + rotulo);
  const maxNivel = pf.conservador ? Math.min(pf.nivel, 2) : pf.nivel;
  for (const d of p.dias) {
    const vistos = new Set();
    for (const it of d.itens) {
      const ex = EX_POR_ID.get(it.ex);
      assert.ok(ex, 'exercício inexistente: ' + it.ex);
      assert.ok(!vistos.has(it.ex), `repetido no treino (${rotulo}): ${it.ex}`); vistos.add(it.ex);
      assert.ok(ex.nivel <= Math.max(1, maxNivel), `nível acima do permitido (${rotulo}): ${it.ex}`);
      for (const c of ex.cuidado) assert.ok(!pf.cuidados.includes(c), `exercício contraindicado para ${c} (${rotulo}): ${it.ex}`);
      assert.ok(it.series >= 1 && it.series <= 4, `séries fora da faixa (${rotulo}): ${it.ex} = ${it.series}`);
      assert.match(it.reps, /^\d{1,3}(-\d{1,3})?$/);
      assert.ok(it.descanso >= 0 && it.descanso <= 240);
      const lo = Number(it.reps.split('-')[0]);
      if (ex.registro === 'peso_reps' || ex.registro === 'reps') {
        if (pf.pressao || pf.gestante) assert.ok(lo >= 10, `repetições baixas com pressão alta/gestação (${rotulo}): ${it.ex} ${it.reps}`);
        if (pf.idoso) assert.ok(it.series <= 3 && lo >= 8, `dose inadequada para 60+ (${rotulo}): ${it.ex}`);
        if (pf.jovem) assert.ok(lo >= 10 && it.series <= 3, `dose inadequada para menor de 18 (${rotulo}): ${it.ex}`);
        if (pf.nunca) assert.ok(it.series <= 3, `séries demais para quem está começando (${rotulo}): ${it.ex}`);
      }
    }
    const limite = { 30: 4, 45: 6, 60: 7, 75: 9 }[pf.tempo];
    assert.ok(d.itens.length <= Math.max(limite, 4), `exercícios demais para o tempo (${rotulo}): ${d.nome} = ${d.itens.length}`);
  }
  return { p, pf };
}

test('perguntas da entrevista são consistentes', () => {
  const chaves = new Set();
  for (const q of PERGUNTAS) {
    assert.ok(!chaves.has(q.k)); chaves.add(q.k);
    assert.ok(q.titulo.endsWith('?'), 'pergunta sem interrogação: ' + q.titulo);
    if (q.tipo !== 'numero') { assert.ok(q.op.length >= 2); for (const o of q.op) assert.equal(o.length, 3); }
  }
  assert.ok(respostasCompletas(base));
  assert.ok(!respostasCompletas({ ...base, idade: undefined }));
  assert.ok(!respostasCompletas({ ...base, objetivo: 'voar' }));
});

test('academia completa: todas as combinações de objetivo × nível × dias × tempo geram treino completo e seguro', () => {
  let n = 0;
  for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) {
    const a = { ...base, objetivo, experiencia, dias, tempo };
    const { p } = confere(a, GYM_ALL, `${objetivo}/${experiencia}/${dias}d/${tempo}min`);
    for (const d of p.dias) assert.ok(d.itens.length >= 3, `treino com menos de 3 exercícios: ${objetivo}/${experiencia}/${dias}d/${tempo}min → ${d.nome}`);
    assert.equal(p.faltando.length, 0);
    assert.equal(Object.keys(p.agenda).length, Number(dias));
    n++;
  }
  assert.equal(n, 400);
});

test('limitações: nenhum exercício contraindicado entra no plano', () => {
  for (const lim of ['ombro', 'joelho', 'lombar', 'cervical', 'cotovelo', 'punho', 'quadril', 'tornozelo']) {
    for (const experiencia of EXP) for (const dias of ['3', '5']) {
      confere({ ...base, experiencia, dias, limitacoes: [lim] }, GYM_ALL, `limitação ${lim}/${experiencia}/${dias}`);
    }
  }
  confere({ ...base, limitacoes: ['ombro', 'joelho', 'lombar'] }, GYM_ALL, 'três limitações');
});

test('condições de saúde: modo conservador, avisos e liberação médica', () => {
  for (const cond of ['hipertensao', 'cardiaco', 'gestante', 'diabetes', 'cronica']) {
    for (const objetivo of OBJ) {
      const { p, pf } = confere({ ...base, objetivo, condicoes: [cond], experiencia: 'avancado' }, GYM_ALL, `condição ${cond}/${objetivo}`);
      if (['hipertensao', 'cardiaco', 'gestante'].includes(cond)) { assert.ok(pf.conservador); assert.ok(p.avisos.length >= 1, 'sem aviso: ' + cond); }
      if (['cardiaco', 'gestante'].includes(cond)) assert.ok(pf.liberacao, 'deveria pedir liberação médica: ' + cond);
    }
  }
  for (const sinal of ['dor_peito', 'tontura', 'falta_ar', 'osseo', 'medico']) {
    const { p, pf } = confere({ ...base, triagem: [sinal] }, GYM_ALL, 'triagem ' + sinal);
    assert.ok(pf.liberacao, 'triagem positiva deve pedir liberação: ' + sinal);
    assert.ok(p.avisos.some((x) => x.tipo === 'danger'));
  }
  assert.ok(!perfil(base).liberacao);
});

test('idades: menor de 14 é bloqueado; 14–17 e 60+ recebem dose conservadora', () => {
  assert.equal(gerarPlano({ ...base, idade: 12 }, GYM_ALL, 0), null);
  for (const idade of [14, 16, 17, 60, 72, 88]) for (const objetivo of OBJ) for (const experiencia of EXP) {
    const { p, pf } = confere({ ...base, idade, objetivo, experiencia }, GYM_ALL, `idade ${idade}/${objetivo}/${experiencia}`);
    assert.ok(pf.conservador);
    assert.ok(p.avisos.length >= 1);
  }
});

test('locais de treino: casa com halteres e sem aparelhos só usam o que existe', () => {
  const CASA = new Set(['halteres', 'banco_reto', 'banco_inclinado', 'colchonete', 'caixa', 'elastico', 'bola_suica']);
  const SEM = new Set(['colchonete', 'caixa']);
  for (const experiencia of EXP) for (const dias of DIAS) {
    const h = confere({ ...base, experiencia, dias, local: 'halteres' }, GYM_ALL, 'halteres').p;
    for (const d of h.dias) { for (const it of d.itens) for (const q of EX_POR_ID.get(it.ex).equip) assert.ok(CASA.has(q), `aparelho indisponível em casa: ${it.ex} (${q})`); assert.ok(d.itens.length >= 3, 'treino em casa curto: ' + d.nome); }
    const c = confere({ ...base, experiencia, dias, local: 'corporal' }, GYM_ALL, 'corporal').p;
    for (const d of c.dias) for (const it of d.itens) for (const q of EX_POR_ID.get(it.ex).equip) assert.ok(SEM.has(q), `aparelho indisponível sem equipamento: ${it.ex} (${q})`);
  }
});

test('minha academia: respeita os aparelhos marcados e avisa quando falta', () => {
  const poucos = { all: false, has: { halteres: true, banco_reto: true, puxador: true, leg_press_45: true, colchonete: true } };
  const { p } = confere({ ...base, local: 'minha' }, poucos, 'academia pequena');
  for (const d of p.dias) for (const it of d.itens) for (const q of EX_POR_ID.get(it.ex).equip) assert.ok(poucos.has[q], `usou aparelho não marcado: ${it.ex} (${q})`);
  const nada = { all: false, has: {} };
  const p2 = gerarPlano({ ...base, local: 'minha' }, nada, 0);
  assert.ok(p2);
  for (const d of p2.dias) for (const it of d.itens) assert.equal(EX_POR_ID.get(it.ex).equip.length, 0);
  const tudo = { all: false, has: Object.fromEntries(Object.keys(EQUIPAMENTOS).map((k) => [k, true])) };
  assert.equal(gerarPlano({ ...base, local: 'minha' }, tudo, 0).faltando.length, 0);
});

test('volume semanal: grupos principais recebem pelo menos o mínimo eficaz', () => {
  for (const experiencia of EXP) for (const dias of ['3', '4', '5', '6']) {
    const p = gerarPlano({ ...base, experiencia, dias, tempo: '60' }, GYM_ALL, 0);
    for (const g of ['peito', 'costas', 'quadriceps', 'posteriores', 'ombros']) assert.ok(p.volume[g] >= 4, `volume baixo em ${g}: ${experiencia}/${dias}d = ${p.volume[g]}`);
    for (const g of Object.keys(p.volume)) assert.ok(p.volume[g] <= 30, `volume exagerado em ${g}: ${p.volume[g]}`);
    assert.deepEqual(volumeSemanal(p.dias), p.volume);
  }
});

test('foco: a parte do corpo escolhida recebe mais séries', () => {
  for (const [foco, grupo] of [['gluteos', 'gluteos'], ['peito', 'peito'], ['costas', 'costas'], ['ombros', 'ombros'], ['abdomen', 'abdomen']]) {
    const sem = gerarPlano({ ...base, foco: ['equilibrado'] }, GYM_ALL, 0).volume[grupo];
    const com = gerarPlano({ ...base, foco: [foco] }, GYM_ALL, 0).volume[grupo];
    assert.ok(com >= sem, `foco em ${foco} não aumentou o volume (${sem} → ${com})`);
  }
});

test('rotação: novas versões mantêm os principais e trocam auxiliares; sugestões são equivalentes', () => {
  const v0 = gerarPlano(base, GYM_ALL, 0);
  const v1 = gerarPlano(base, GYM_ALL, 1);
  const ids = (p) => p.dias.map((d) => d.itens.map((i) => i.ex));
  assert.deepEqual(ids(v0).map((d) => d[0]), ids(v1).map((d) => d[0]), 'o exercício principal de cada treino deveria ser mantido');
  assert.notDeepEqual(ids(v0), ids(v1), 'a nova versão deveria trocar algum exercício auxiliar');
  const plan = { dias: v0.dias };
  const trocas = sugerirTrocas(plan, base, GYM_ALL);
  assert.ok(trocas.length >= 2, 'deveria sugerir trocas');
  const noPlano = new Set(v0.dias.flatMap((d) => d.itens.map((i) => i.ex)));
  const porDia = {};
  for (const t of trocas) {
    const de = EX_POR_ID.get(t.de), para = EX_POR_ID.get(t.para);
    assert.equal(de.padrao, para.padrao, 'troca por movimento diferente');
    assert.ok(!noPlano.has(t.para), 'sugeriu exercício que já está no plano');
    assert.equal(v0.dias.find((d) => d.id === t.diaId).itens[t.idx].ex, t.de);
    porDia[t.diaId] = (porDia[t.diaId] || 0) + 1;
    assert.ok(porDia[t.diaId] <= 2, 'mais de 2 trocas no mesmo treino');
  }
  // com limitação, as alternativas também respeitam a restrição
  const pf = perfil({ ...base, limitacoes: ['ombro'] });
  for (const ex of [EX_POR_ID.get('supino-maquina'), EX_POR_ID.get('puxada-frente-aberta')]) {
    for (const alt of alternativas(ex, pf, GYM_ALL)) assert.ok(!alt.cuidado.includes('ombro'), 'alternativa contraindicada: ' + alt.id);
  }
});

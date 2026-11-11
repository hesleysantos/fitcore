// Análise de desempenho e dicas de evolução.
import test from 'node:test';
import assert from 'node:assert/strict';
import { analisar, destaques, seriesPorGrupo, tendencias, constancia, tendenciaPeso } from '../www/js/logic/insights.js';
import { REFS } from '../www/js/data/knowledge.js';
import { EX_POR_ID } from '../www/js/data/exercises.js';

const DIA = 86400000;
const AGORA = Date.parse('2026-11-10T18:00:00.000Z');
const iso = (t) => new Date(t).toISOString();
const dia = (t) => iso(t).slice(0, 10);

function vazio() {
  return { plans: [], activePlan: '', sessions: [], trainer: { answers: {} }, nutri: { answers: {} }, body: [] };
}
// uma sessão: itens = [[exId, kg, reps, séries]]
function sessao(diasAtras, itens, { minutos = 55, feitas = 1 } = {}) {
  const inicio = AGORA - diasAtras * DIA;
  return {
    id: 's' + diasAtras, nome: 'Treino', inicio: iso(inicio), fim: iso(inicio + minutos * 60000),
    itens: itens.map(([ex, kg, reps, n = 3]) => ({ ex, alvo: '8-12', descanso: 90, sets: Array.from({ length: n }, (_, i) => ({ kg, reps, seg: null, ok: i < Math.ceil(n * feitas) })) })),
  };
}
const ids = (r) => r.dicas.map((d) => d.id);
const plano3 = { id: 'p', nome: 'Plano', dias: [{ id: 'a', nome: 'A', itens: [{ ex: 'supino-reto-barra', series: 3, reps: '8-12' }] }], agenda: { 1: 'a', 3: 'a', 5: 'a' } };

for (const id of ['supino-reto-barra', 'remada-curvada-barra-pronada', 'agachamento-livre-barra', 'stiff-barra', 'desenvolvimento-halteres-sentado', 'corrida-esteira']) {
  assert.ok(EX_POR_ID.has(id), 'exercício usado no teste não existe: ' + id);
}

test('evolução: sem treinos suficientes pede mais registros e não inventa análise', () => {
  const st = vazio();
  let r = analisar(st, AGORA);
  assert.equal(r.suficiente, false);
  assert.deepEqual(ids(r), ['inicio']);
  st.sessions.push(sessao(1, [['supino-reto-barra', 40, 10]]));
  r = analisar(st, AGORA);
  assert.equal(r.suficiente, false);
  assert.match(r.dicas[0].titulo, /Faltam 2 treinos/);
});

test('evolução: treino constante e carga subindo geram boas notícias', () => {
  const st = vazio();
  st.plans = [plano3]; st.activePlan = 'p';
  // 3 treinos por semana durante 4 semanas, subindo a carga
  let kg = 40;
  for (let d = 27; d >= 0; d -= 2.33) { st.sessions.push(sessao(Math.round(d), [['supino-reto-barra', kg, 10], ['remada-curvada-barra-pronada', kg, 10], ['agachamento-livre-barra', kg + 20, 10], ['stiff-barra', kg + 10, 10], ['desenvolvimento-halteres-sentado', 12 + Math.floor((kg - 40) / 3), 10]])); kg += 1; }
  st.sessions.forEach((s, i) => { s.id = 's' + i; });
  const r = analisar(st, AGORA);
  assert.equal(r.suficiente, true);
  const freq = r.dicas.find((d) => d.id === 'frequencia');
  assert.equal(freq.tom, 'bom');
  const alta = r.dicas.find((d) => d.id === 'alta');
  assert.ok(alta && alta.tom === 'bom', 'deveria apontar força em alta');
  assert.ok(!ids(r).includes('travado') && !ids(r).includes('queda'));
  assert.ok(tendencias(st, AGORA).every((t) => t.status === 'subindo' || t.status === 'estavel'));
});

test('evolução: exercício parado na mesma marca e quedas são apontados', () => {
  const st = vazio();
  for (let i = 0; i < 6; i++) st.sessions.push(sessao(18 - i * 3, [['supino-reto-barra', 50, 8], ['remada-curvada-barra-pronada', 50, 8]]));
  st.sessions.forEach((s, i) => { s.id = 's' + i; });
  let r = analisar(st, AGORA);
  const trav = r.dicas.find((d) => d.id === 'travado');
  assert.ok(trav, 'deveria apontar exercício travado');
  assert.ok(trav.refs.every((k) => REFS[k]));
  // agora os dois exercícios caem mais de 4%
  const st2 = vazio();
  for (let i = 0; i < 6; i++) st2.sessions.push(sessao(18 - i * 3, [['supino-reto-barra', 60 - i * 2, 8], ['remada-curvada-barra-pronada', 60 - i * 2, 8]]));
  st2.sessions.forEach((s, i) => { s.id = 's' + i; });
  r = analisar(st2, AGORA);
  const q = r.dicas.find((d) => d.id === 'queda');
  assert.ok(q && q.tom === 'atencao', 'queda em 2 exercícios deve pedir atenção');
  assert.equal(r.dicas[0].tom, 'atencao', 'o que pede atenção vem primeiro');
});

test('evolução: séries por semana por grupo e desequilíbrio entre peito e costas', () => {
  const st = vazio();
  // só peito, 3 vezes por semana, 4 séries
  for (let i = 0; i < 6; i++) st.sessions.push(sessao(13 - i * 2.3, [['supino-reto-barra', 40, 10, 4]]));
  st.sessions.forEach((s, i) => { s.id = 's' + i; });
  const v = seriesPorGrupo(st, AGORA).porGrupo;
  assert.ok(v.peito >= 10 && v.peito <= 14, 'séries de peito por semana: ' + v.peito);
  assert.equal(v.costas, 0);
  assert.ok(v.triceps > 0 && v.triceps < v.peito, 'auxiliar conta meia série');
  const r = analisar(st, AGORA);
  assert.ok(ids(r).some((x) => x.startsWith('pouco-')), 'deveria apontar grupo sem treino');
  assert.ok(ids(r).includes('empurra-puxa'), 'deveria pedir equilíbrio entre peito e costas');
});

test('evolução: frequência baixa e pausa longa', () => {
  const st = vazio();
  st.plans = [plano3]; st.activePlan = 'p';
  for (const d of [27, 20, 12, 3]) st.sessions.push(sessao(d, [['supino-reto-barra', 40, 10]]));
  let r = analisar(st, AGORA);
  const f = r.dicas.find((d) => d.id === 'frequencia');
  assert.equal(f.tom, 'atencao');
  assert.equal(constancia(st, AGORA).previstos, 12);
  const st2 = vazio();
  for (const d of [40, 37, 34]) st2.sessions.push(sessao(d, [['supino-reto-barra', 40, 10]]));
  r = analisar(st2, AGORA);
  assert.ok(ids(r).includes('parado'));
});

test('evolução: ritmo do peso corporal conforme o objetivo', () => {
  const base = () => { const st = vazio(); for (const d of [9, 6, 3]) st.sessions.push(sessao(d, [['supino-reto-barra', 40, 10]])); return st; };
  const pesos = (ini, porSemana) => [28, 21, 14, 7, 0].map((d, i) => ({ data: dia(AGORA - d * DIA), peso: Math.round((ini + porSemana * i) * 10) / 10, cintura: null }));
  let st = base(); st.nutri.answers.objetivo = 'emagrecer'; st.body = pesos(80, -0.5);
  assert.equal(analisar(st, AGORA).dicas.find((d) => d.id === 'peso').tom, 'bom');
  st = base(); st.nutri.answers.objetivo = 'emagrecer'; st.body = pesos(80, -1.3);
  assert.equal(analisar(st, AGORA).dicas.find((d) => d.id === 'peso').tom, 'atencao');
  st = base(); st.nutri.answers.objetivo = 'emagrecer'; st.body = pesos(80, 0);
  assert.equal(analisar(st, AGORA).dicas.find((d) => d.id === 'peso').tom, 'ideia');
  st = base(); st.nutri.answers.objetivo = 'ganhar'; st.body = pesos(70, 0.6);
  assert.equal(analisar(st, AGORA).dicas.find((d) => d.id === 'peso').tom, 'atencao');
  st = base(); st.nutri.answers.objetivo = 'ganhar'; st.body = pesos(70, 0.2);
  assert.equal(analisar(st, AGORA).dicas.find((d) => d.id === 'peso').tom, 'bom');
  const t = tendenciaPeso(st, AGORA);
  assert.ok(Math.abs(t.kgSemana - 0.2) < 0.03, 'tendência calculada: ' + t.kgSemana);
  st = base(); st.nutri.answers.objetivo = 'manter'; st.body = pesos(70, 0.6);
  assert.ok(!analisar(st, AGORA).dicas.some((d) => d.id === 'peso'), 'objetivo de manter não gera alerta de peso');
  st = base(); st.nutri.answers.objetivo = 'emagrecer';
  assert.ok(ids(analisar(st, AGORA)).includes('pesar'));
});

test('evolução: textos curtos, fontes existentes e destaques da tela inicial', () => {
  const cenarios = [];
  for (const [n, feitas, minutos, obj] of [[3, 1, 50, 'saude'], [8, 0.5, 120, 'emagrecimento'], [12, 1, 60, 'hipertrofia'], [20, 0.7, 95, 'forca']]) {
    const st = vazio();
    st.trainer.answers = { objetivo: obj, experiencia: 'avancado', dias: '4' };
    for (let i = 0; i < n; i++) st.sessions.push(sessao(Math.round((n - i) * 1.4), [['supino-reto-barra', 40 + (i % 3), 12, 6], ['agachamento-livre-barra', 60, 8, 8], ['corrida-esteira', null, null, 1]], { feitas, minutos }));
    st.sessions.forEach((s, i) => { s.id = 's' + i; });
    cenarios.push(st);
  }
  for (const st of cenarios) {
    const r = analisar(st, AGORA);
    assert.ok(r.dicas.length >= 1 && r.dicas.length <= 12);
    assert.equal(new Set(ids(r)).size, r.dicas.length, 'dica repetida');
    for (const d of r.dicas) {
      assert.ok(['atencao', 'ideia', 'bom'].includes(d.tom));
      assert.ok(d.titulo.length >= 6 && d.titulo.length <= 60, 'título longo: ' + d.titulo);
      assert.ok(d.texto.length >= 10 && d.texto.length <= 140, 'texto longo: ' + d.texto);
      if (d.porque) assert.ok(d.porque.length <= 190, 'explicação longa: ' + d.porque);
      for (const k of d.refs || []) assert.ok(REFS[k], 'referência inexistente: ' + k);
      if (d.tom !== 'bom' && d.id !== 'pesar' && d.id !== 'inicio') assert.ok(d.porque && d.refs && d.refs.length, 'dica sem fonte: ' + d.id);
      assert.ok(!/undefined|NaN|null/.test(d.titulo + d.texto), 'texto com valor inválido: ' + d.titulo + ' ' + d.texto);
    }
    const top = destaques(r.dicas, 2);
    assert.ok(top.length <= 2);
    if (r.dicas.some((d) => d.tom !== 'bom')) assert.ok(top[0].tom !== 'bom', 'a tela inicial começa pelo que precisa melhorar');
  }
});

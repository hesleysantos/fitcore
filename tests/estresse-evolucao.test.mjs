// Teste de estresse da Evolução e do progresso: históricos sintéticos grandes e estranhos (5.000 treinos, cargas 0,
// séries vazias, datas fora de ordem ou no futuro, pesos repetidos) e as regras das dicas.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import { EXERCICIOS, EX_POR_ID } from '../www/js/data/exercises.js';
import { REFS } from '../www/js/data/knowledge.js';
import { analisar, destaques, constancia, seriesPorGrupo, tendencias, recordesRecentes, seriesConcluidas, duracaoMedia, semDescanso, tendenciaPeso, cardioPorSemana, prontosParaSubir, metaSemanal } from '../www/js/logic/insights.js';
import { sugestao, historico, recorde, estagnados, sequenciaSemanas, volumePorSemana, volumeSessao, seriesSessao, duracaoSessao, parseReps, e1rm, semanaAtual, ultima } from '../www/js/logic/progress.js';
import { gerarPlano, volumeSemanal } from '../www/js/logic/trainer.js';

const DIA = 86400000;
const AGORA = Date.parse('2026-11-10T18:00:00.000Z');
const iso = (t) => new Date(t).toISOString();
const dia = (t) => iso(t).slice(0, 10);
function semente(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const um = (r, l) => l[Math.floor(r() * l.length)];
const vazio = () => ({ plans: [], activePlan: '', sessions: [], trainer: { answers: {} }, nutri: { answers: {} }, body: [] });
// itens = [[exId, kg, reps, séries]]
function sessao(diasAtras, itens, { minutos = 55, feitas = 1, agora = AGORA } = {}) {
  const inicio = agora - diasAtras * DIA;
  return {
    id: 's' + diasAtras + Math.random().toString(36).slice(2, 6), nome: 'Treino', inicio: iso(inicio), fim: iso(inicio + minutos * 60000),
    itens: itens.map(([ex, kg, reps, n = 3]) => ({ ex, alvo: '8-12', descanso: 90, sets: Array.from({ length: n }, (_, i) => ({ kg, reps, seg: EX_POR_ID.get(ex) && EX_POR_ID.get(ex).registro === 'minutos' ? 20 : 30, ok: i < Math.ceil(n * feitas) })) })),
  };
}
const ids = (r) => r.dicas.map((d) => d.id);
const lixo = /undefined|NaN|null|Infinity|\[object/;
const FORCA = EXERCICIOS.filter((e) => e.registro === 'peso_reps').map((e) => e.id);
const TODOS = EXERCICIOS.map((e) => e.id);

// Confere o resultado de analisar(): formato, textos, fontes e ausência de contradições.
function conferir(r, rot) {
  assert.ok(Array.isArray(r.dicas) && typeof r.suficiente === 'boolean', rot);
  assert.ok(r.dicas.length <= 14, `${rot}: dicas demais (${r.dicas.length})`);
  assert.equal(new Set(ids(r)).size, r.dicas.length, `${rot}: dica repetida (${ids(r)})`);
  for (const d of r.dicas) {
    assert.ok(['atencao', 'ideia', 'bom'].includes(d.tom), rot);
    assert.ok(typeof d.titulo === 'string' && d.titulo.length >= 6 && d.titulo.length <= 60, `${rot}: título "${d.titulo}"`);
    assert.ok(typeof d.texto === 'string' && d.texto.length >= 10 && d.texto.length <= 140, `${rot}: texto "${d.texto}" (${d.texto.length})`);
    assert.ok(!lixo.test(d.titulo + ' ' + d.texto + ' ' + (d.porque || '')), `${rot}: texto com valor inválido: ${d.titulo} | ${d.texto}`);
    assert.ok(!/-\d+ (dias|treinos|min|séries)|\b-0\b/.test(d.titulo + ' ' + d.texto), `${rot}: número negativo no texto: ${d.titulo} | ${d.texto}`);
    if (d.porque) assert.ok(d.porque.length <= 190, `${rot}: explicação longa`);
    for (const k of d.refs || []) assert.ok(REFS[k], `${rot}: referência inexistente ${k}`);
    if (d.tom !== 'bom' && d.id !== 'pesar' && d.id !== 'inicio') assert.ok(d.porque && d.refs && d.refs.length, `${rot}: dica sem fonte (${d.id})`);
    if (d.acao) assert.ok(d.acao.rotulo && d.acao.rota, rot);
  }
  // ordem: o que pede atenção vem antes das ideias, que vêm antes das boas notícias
  const peso = { atencao: 0, ideia: 1, bom: 2 };
  for (let i = 1; i < r.dicas.length; i++) assert.ok(peso[r.dicas[i - 1].tom] <= peso[r.dicas[i].tom], `${rot}: ordem das dicas`);
  // CONTRADIÇÕES
  const tem = (id) => ids(r).includes(id);
  const t = r.resumo.tendencias;
  const status = new Map(t.map((x) => [x.id, x.status]));
  assert.equal(status.size, t.length, `${rot}: exercício com duas tendências`);
  const alta = r.dicas.find((d) => d.id === 'alta'), queda = r.dicas.find((d) => d.id === 'queda'), trav = r.dicas.find((d) => d.id === 'travado');
  const exDe = (d) => (d && d.acao && d.acao.rota.startsWith('exercicio/') ? d.acao.rota.slice(10) : null);
  // o exercício citado numa dica (o texto começa por "Nome do exercício:")
  const citado = (d) => (d ? t.filter((x) => d.texto.startsWith(x.nome + ':') || d.texto.startsWith(x.nome.slice(0, 20)) && d.texto.includes('…:')).map((x) => x.id) : []);
  // "força em alta" cita um exercício que está subindo; "queda" e "travou" apontam exercícios caindo e parados
  for (const id of citado(alta)) if (EX_POR_ID.get(id).nome.length <= 80 && alta.texto.startsWith(EX_POR_ID.get(id).nome + ':')) assert.equal(status.get(id), 'subindo', `${rot}: "força em alta" para exercício ${status.get(id)}`);
  if (exDe(queda)) assert.equal(status.get(exDe(queda)), 'caindo', `${rot}: "queda" para exercício ${status.get(exDe(queda))}`);
  if (exDe(trav)) assert.equal(status.get(exDe(trav)), 'parado', `${rot}: "travou" para exercício ${status.get(exDe(trav))}`);
  // recordes nunca citam exercício em queda ou travado; "pronto para mais carga" nunca cita exercício em queda
  for (const rec of r.resumo.recordes) assert.ok(status.get(rec.id) !== 'caindo' && status.get(rec.id) !== 'parado', `${rot}: recorde em exercício ${status.get(rec.id)}`);
  const subir = r.dicas.find((d) => d.id === 'subir');
  if (subir) for (const x of t) if (x.status === 'caindo') assert.ok(!subir.texto.startsWith(x.nome + ':'), `${rot}: "mais carga" para exercício em queda (${x.nome})`);
  if (subir && exDe(trav)) assert.ok(!subir.texto.startsWith(EX_POR_ID.get(exDe(trav)).nome + ':'), `${rot}: "travou" e "mais carga" para o mesmo exercício`);
  // constância: só uma das três mensagens; "parado há X dias" não combina com "constância em dia"
  assert.ok([tem('parado'), tem('frequencia')].filter(Boolean).length <= 1, `${rot}: pausa e frequência juntas`);
  // um grupo não pode estar com "pouco" e "muito" treino, nem "pouco" e "descanse mais"
  const pouco = ids(r).filter((x) => x.startsWith('pouco-')).map((x) => x.slice(6));
  const muito = ids(r).filter((x) => x.startsWith('muito-')).map((x) => x.slice(6));
  assert.ok(pouco.length <= 1 && muito.length <= 1, rot);
  for (const g of pouco) assert.ok(!muito.includes(g), `${rot}: pouco e muito treino de ${g}`);
  const desc = r.dicas.find((d) => d.id === 'descanso');
  if (desc && pouco.length) assert.ok(!desc.titulo.toLowerCase().includes(pouco[0] === 'gluteos' ? 'glúteos' : pouco[0].slice(0, 5)), `${rot}: "pouco treino" e "descanse mais" do mesmo grupo`);
  assert.ok(!(tem('mais-series') && pouco.length), `${rot}: duas dicas de volume`);
  // peso: uma dica só
  assert.ok(ids(r).filter((x) => x === 'peso' || x === 'pesar').length <= 1, `${rot}: duas dicas de peso`);
  // resumo
  for (const g of Object.keys(r.resumo.series)) assert.ok(Number.isFinite(r.resumo.series[g]) && r.resumo.series[g] >= 0, `${rot}: séries de ${g} = ${r.resumo.series[g]}`);
  for (const x of t) { assert.ok(Number.isFinite(x.variacao) && Number.isFinite(x.forca) && x.forca > 0, `${rot}: tendência inválida`); assert.ok(['subindo', 'caindo', 'parado', 'estavel'].includes(x.status)); }
  if (r.resumo.constancia) for (const k of ['semanas', 'feitos', 'previstos', 'meta', 'taxa', 'diasParado']) assert.ok(Number.isFinite(r.resumo.constancia[k]) && r.resumo.constancia[k] >= 0, `${rot}: constância.${k} = ${r.resumo.constancia[k]}`);
  const top = destaques(r.dicas, 2);
  assert.ok(top.length <= 2);
  if (r.dicas.some((d) => d.tom !== 'bom') && top.length) assert.ok(top[0].tom !== 'bom', `${rot}: destaque começa pela boa notícia`);
}

// histórico aleatório "estranho"
function historicoEstranho(r, n, { baguncado = true } = {}) {
  const st = vazio();
  const exs = Array.from({ length: 12 }, () => um(r, TODOS));
  for (let i = 0; i < n; i++) {
    const quando = r() < 0.03 && baguncado ? -r() * 400 : r() * (n > 1000 ? 3650 : 120);   // 3% no futuro
    const itens = Array.from({ length: 1 + Math.floor(r() * 7) }, () => {
      const kg = um(r, [0, 0, 2.5, 20, 40, 60, 100, 500, null, undefined, -5, NaN, 0.5]);
      const reps = um(r, [0, 1, 5, 8, 10, 12, 15, 30, 999, null, undefined, NaN]);
      return [um(r, exs), kg, reps, Math.floor(r() * 6)];   // 0 a 5 séries (0 = item sem nenhuma série)
    });
    const s = sessao(quando, itens, { minutos: um(r, [0, 3, 30, 60, 90, 200, 1000, -10]), feitas: um(r, [0, 0.3, 0.5, 1, 1]) });
    if (baguncado && r() < 0.02) s.fim = null;
    if (baguncado && r() < 0.01) s.itens = [];
    if (baguncado && r() < 0.01) s.inicio = 'data inválida';
    if (r() < 0.2) for (const it of s.itens) it.planejadas = um(r, [0, 3, 4, 5, undefined, NaN, -1]);
    st.sessions.push(s);
  }
  if (!baguncado) st.sessions.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  // peso corporal: repetido, fora de ordem, datas repetidas e no futuro
  const m = Math.floor(r() * 60);
  for (let i = 0; i < m; i++) st.body.push({ data: dia(AGORA - (r() < 0.05 ? -r() * 30 : Math.floor(r() * 90)) * DIA), peso: um(r, [70, 70, 70, 70.5, 71, 69, 150, 20]), cintura: null });
  if (baguncado && r() < 0.1) st.body.push({ data: 'xx', peso: NaN, cintura: null });
  st.trainer.answers = { objetivo: um(r, ['hipertrofia', 'emagrecimento', 'forca', 'saude', 'resistencia', undefined]), experiencia: um(r, ['nunca', 'iniciante', 'intermediario', 'avancado']), dias: um(r, ['2', '3', '6', undefined]) };
  st.nutri.answers = { objetivo: um(r, ['emagrecer', 'ganhar', 'manter', undefined]) };
  if (r() < 0.7) {
    const p = gerarPlano({ objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] }, { all: true, has: {} }, 0);
    // metade dos planos usa os mesmos exercícios do histórico
    if (r() < 0.5) p.dias[0].itens = exs.slice(0, 6).map((ex) => ({ ex, series: 3, reps: um(r, ['8-12', '10', 'x', '', '0']), descanso: 60 }));
    st.plans = [{ id: 'p', nome: 'Plano', dias: p.dias, agenda: p.agenda }];
    st.activePlan = 'p';
  }
  return st;
}

test('estresse: 600 históricos estranhos (cargas 0 ou negativas, repetições vazias, séries vazias, datas fora de ordem, inválidas ou no futuro, pesos repetidos)', () => {
  const r = semente(2026);
  let comDicas = 0;
  for (let i = 0; i < 600; i++) {
    const st = historicoEstranho(r, um(r, [0, 1, 2, 3, 5, 12, 40, 120]));
    let res;
    assert.doesNotThrow(() => { res = analisar(st, AGORA); }, `histórico ${i}`);
    conferir(res, `histórico ${i}`);
    if (res.suficiente) comDicas++;
    // funções auxiliares, uma a uma
    for (const f of [() => constancia(st, AGORA), () => seriesPorGrupo(st, AGORA), () => tendencias(st, AGORA), () => recordesRecentes(st, AGORA), () => seriesConcluidas(st), () => duracaoMedia(st), () => semDescanso(st, AGORA), () => tendenciaPeso(st, AGORA), () => cardioPorSemana(st, AGORA), () => prontosParaSubir(st), () => metaSemanal(st)]) assert.doesNotThrow(f, `histórico ${i}`);
    const tp = tendenciaPeso(st, AGORA);
    assert.ok(tp.kgSemana === null || Number.isFinite(tp.kgSemana));
    assert.ok(tp.diasSemRegistro === null || tp.diasSemRegistro >= 0);
    const cs = cardioPorSemana(st, AGORA);
    assert.ok(Number.isFinite(cs) && cs >= 0);
    const sc = seriesConcluidas(st);
    assert.ok(sc === null || (sc >= 0 && sc <= 1), `histórico ${i}: concluídas = ${sc}`);
    const dm = duracaoMedia(st);
    assert.ok(dm === null || (dm >= 5 && dm <= 240));
  }
  assert.ok(comDicas > 300);
});

test('estresse: estados quebrados (campos ausentes, tipos errados) não derrubam a análise', () => {
  const ruins = [{}, { sessions: null }, { sessions: [null, 1, 'x', {}, { inicio: iso(AGORA - DIA) }, { inicio: iso(AGORA - 2 * DIA), itens: [null, {}, { ex: 'supino-reto-barra' }, { ex: 'supino-reto-barra', sets: [null, 1, {}, { ok: true }] }] }] },
    { sessions: [], plans: [null, { id: 'p' }], activePlan: 'p' }, { ...vazio(), body: [null, {}, { data: null, peso: 'x' }] }, { ...vazio(), trainer: null, nutri: null }];
  for (const st of ruins) { let res; assert.doesNotThrow(() => { res = analisar(st, AGORA); }, JSON.stringify(st)); conferir(res, 'estado quebrado'); }
  for (const agora of [NaN, undefined, 0, -1, Infinity]) assert.doesNotThrow(() => analisar(vazio(), agora));
});

test('estresse: 5.000 treinos em 10 anos — análise e progresso rápidos e corretos', () => {
  const r = semente(7);
  const st = vazio();
  const exs = ['supino-reto-barra', 'remada-curvada-barra-pronada', 'agachamento-livre-barra', 'stiff-barra', 'desenvolvimento-halteres-sentado', 'puxada-frente-aberta', 'leg-press-45', 'rosca-direta-barra-w', 'triceps-pulley-corda', 'prancha-frontal', 'corrida-esteira'];
  for (let i = 0; i < 5000; i++) {
    const d = (5000 - i) * 0.73;                                  // um treino a cada ~17,5 h, o mais antigo primeiro
    st.sessions.push(sessao(d, Array.from({ length: 6 }, (_, k) => [exs[(i + k) % exs.length], 20 + (i % 50) + k * 5, 8 + (i % 5), 3])));
  }
  for (let i = 0; i < 900; i++) st.body.push({ data: dia(AGORA - i * 4 * DIA), peso: 80 - i * 0.01, cintura: null });
  st.body.reverse();
  st.trainer.answers = { objetivo: 'hipertrofia', experiencia: 'avancado', dias: '6' };
  st.nutri.answers = { objetivo: 'ganhar' };
  const plano = gerarPlano({ objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'avancado', dias: '6', tempo: '75', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] }, { all: true, has: {} }, 0);
  st.plans = [{ id: 'p', nome: 'Plano', dias: plano.dias, agenda: plano.agenda }];
  st.activePlan = 'p';
  // melhor de 3 medidas: com a máquina ocupada por outros testes, uma medida só pode estourar sem a análise estar lenta
  let t0 = performance.now();
  const res = analisar(st, AGORA);
  let tAnalise = performance.now() - t0;
  for (let k = 0; k < 2 && tAnalise >= 400; k++) { t0 = performance.now(); analisar(st, AGORA); tAnalise = Math.min(tAnalise, performance.now() - t0); }
  conferir(res, '5.000 treinos');
  assert.ok(res.suficiente);
  assert.equal(res.resumo.treinos, 5000);
  assert.ok(tAnalise < 400, `analisar() com 5.000 treinos levou ${Math.round(tAnalise)} ms`);
  // mesma coisa com o histórico embaralhado e treinos no futuro: o resultado é o mesmo dos treinos válidos em ordem
  const st2 = { ...st, sessions: st.sessions.slice() };
  for (let i = st2.sessions.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [st2.sessions[i], st2.sessions[j]] = [st2.sessions[j], st2.sessions[i]]; }
  for (let i = 0; i < 50; i++) st2.sessions.push(sessao(-(i + 1) * 3, [['supino-reto-barra', 999, 12, 3]]));
  const res2 = analisar(st2, AGORA);
  conferir(res2, '5.000 treinos embaralhados');
  assert.equal(res2.resumo.treinos, 5000, 'treinos no futuro não entram na análise');
  assert.deepEqual(res2.resumo.series, res.resumo.series);
  assert.deepEqual(res2.resumo.constancia, res.resumo.constancia);
  assert.deepEqual(res2.resumo.tendencias, res.resumo.tendencias, 'datas fora de ordem não mudam as tendências');
  // progresso (usa o estado global do app)
  store.update((s) => { s.sessions = st.sessions; s.plans = st.plans; s.activePlan = 'p'; });
  t0 = performance.now();
  const seq = sequenciaSemanas(3);
  const tSeq = performance.now() - t0;
  assert.ok(seq >= 0 && seq <= 520);
  assert.ok(tSeq < 150, `sequenciaSemanas() com 5.000 treinos levou ${Math.round(tSeq)} ms`);
  t0 = performance.now();
  const vps = volumePorSemana(8);
  const est = estagnados(store.state.plans[0]);
  for (const ex of exs) { recorde(ex); sugestao(ex, '8-12', 3); historico(ex, 60); }
  recorde('exercicio-que-nunca-fiz');
  const tResto = performance.now() - t0;
  assert.ok(tResto < 400, `volumePorSemana + estagnados + recordes com 5.000 treinos levaram ${Math.round(tResto)} ms`);
  assert.equal(vps.length, 8);
  for (const w of vps) { assert.ok(Number.isFinite(w.vol) && w.vol >= 0 && Number.isFinite(w.treinos)); assert.match(w.rotulo, /^\d{1,2}\/\d{1,2}$/); }
  assert.ok(Array.isArray(est));
  store.update((s) => { s.sessions = []; s.plans = []; s.activePlan = ''; });
});

test('sequência de semanas: mesma resposta da conta semana a semana, com treinos fora de ordem e no futuro', () => {
  const r = semente(99);
  for (let caso = 0; caso < 60; caso++) {
    const sess = [];
    const semanasBoas = Math.floor(r() * 12);
    const agora = Date.now();
    // semanas seguidas com 3 treinos (seg, qua, sex), terminando na semana passada; antes disso, um buraco
    const seg = new Date(); seg.setHours(12, 0, 0, 0); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
    for (let w = 1; w <= semanasBoas; w++) for (const d of [0, 2, 4]) { const t = new Date(seg); t.setDate(t.getDate() - 7 * w + d); sess.push({ id: 'a' + w + d, inicio: t.toISOString(), fim: t.toISOString(), itens: [] }); }
    for (let w = semanasBoas + 2; w < semanasBoas + 6; w++) for (const d of [0, 1, 2]) { const t = new Date(seg); t.setDate(t.getDate() - 7 * w + d); sess.push({ id: 'b' + w + d, inicio: t.toISOString(), fim: t.toISOString(), itens: [] }); }
    for (let k = 0; k < 5; k++) sess.push({ id: 'f' + k, inicio: new Date(agora + (k + 1) * 9 * DIA).toISOString(), fim: null, itens: [] }); // no futuro
    sess.push({ id: 'x', inicio: 'lixo', fim: null, itens: [] });
    for (let i = sess.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [sess[i], sess[j]] = [sess[j], sess[i]]; }
    store.update((s) => { s.sessions = sess; });
    assert.equal(sequenciaSemanas(3), semanasBoas, `caso ${caso}`);
    assert.equal(sequenciaSemanas(4), 0);
    assert.ok(semanaAtual().size >= 0);
  }
  store.update((s) => { s.sessions = []; });
  assert.equal(sequenciaSemanas(3), 0);
});

test('sugestão de carga: históricos estranhos nunca geram erro, NaN, carga negativa nem texto contraditório', () => {
  const r = semente(5);
  const alvos = ['8-12', '10', '3-5', '15-20', '30', '', null, undefined, 'abc', '0', '0-0', '12-8', '5-', '-5', '1000', 8, '8 - 12'];
  let n = 0;
  for (let caso = 0; caso < 400; caso++) {
    const ex = um(r, TODOS);
    const sess = [];
    const k = Math.floor(r() * 4);
    for (let i = 0; i < k; i++) {
      const sets = Array.from({ length: Math.floor(r() * 5) }, () => ({ kg: um(r, [0, 0, 0.5, 5, 9.5, 24, 60, 300, null, undefined, -10, NaN]), reps: um(r, [0, 3, 8, 12, 20, null, undefined, NaN, -2]), seg: um(r, [0, 20, 45, null, undefined, NaN]), ok: r() < 0.8 }));
      sess.push({ id: 's' + i, nome: 't', inicio: iso(AGORA - (k - i) * DIA * (r() < 0.2 ? -1 : 1)), fim: iso(AGORA), itens: r() < 0.9 ? [{ ex, alvo: '8-12', descanso: 60, sets }] : [] });
    }
    store.update((s) => { s.sessions = sess; });
    for (const alvo of alvos) for (const nSeries of [3, 1, 0, undefined, null, NaN, -1, '3']) {
      let g;
      assert.doesNotThrow(() => { g = sugestao(ex, alvo, nSeries); }, `${ex} ${alvo} ${nSeries}`);
      n++;
      const rot = `${ex} alvo=${alvo} séries=${nSeries} ${JSON.stringify(sess.map((s) => s.itens[0] && s.itens[0].sets))}`;
      assert.ok(typeof g.texto === 'string' && !lixo.test(g.texto), `${rot}: ${g.texto}`);
      assert.ok(g.kg === null || (Number.isFinite(g.kg) && g.kg >= 0), `${rot}: kg = ${g.kg}`);
      assert.ok(g.reps === null || (Number.isFinite(g.reps) && g.reps >= 1), `${rot}: reps = ${g.reps}`);
      if (g.seg !== undefined) assert.ok(Number.isFinite(g.seg) && g.seg >= 1, `${rot}: seg = ${g.seg}`);
      assert.ok(g.texto.length <= 220, `${rot}: texto longo (${g.texto.length})`);
      // sem contradição: não manda subir e reduzir ao mesmo tempo, nem "reduza para 0 kg", nem faixa invertida
      assert.ok(!(/suba para/.test(g.texto) && /Reduza para/.test(g.texto)), rot);
      assert.ok(!/Reduza para 0 kg|suba para 0 kg|de (\d+) a \1 repetições|a 0 repetições|faça 0 /.test(g.texto), `${rot}: ${g.texto}`);
      const m = /alvo: (\d+) a (\d+)/.exec(g.texto) || /de (\d+) a (\d+) repetições/.exec(g.texto);
      if (m) assert.ok(Number(m[1]) < Number(m[2]), `${rot}: faixa invertida em "${g.texto}"`);
      if (/suba para ([\d,]+) kg/.test(g.texto)) assert.ok(/dois treinos seguidos/.test(g.texto), `${rot}: sobe a carga sem dois treinos no topo`);
    }
    // utilitários do progresso com o mesmo histórico
    assert.doesNotThrow(() => { recorde(ex); ultima(ex); historico(ex); estagnados({ dias: [{ itens: [{ ex }] }] }); estagnados({}); });
    const rec = recorde(ex);
    assert.ok(rec === null || (Number.isFinite(rec.v) && rec.v > 0));
    for (const s of sess) { assert.ok(Number.isFinite(volumeSessao(s)) && volumeSessao(s) >= 0); assert.ok(seriesSessao(s) >= 0); assert.ok(Number.isFinite(duracaoSessao(s)) && duracaoSessao(s) >= 0); }
  }
  store.update((s) => { s.sessions = []; });
  assert.ok(n > 50000);
  for (const [txt, esperado] of [['8-12', [8, 12]], ['30', [30, 30]], ['12-8', [8, 12]], ['0', [8, 12]], ['0-0', [8, 12]], ['', [8, 12]], [null, [8, 12]], [' 10-15 ', [10, 15]], [10, [10, 10]], ['x', [8, 12]]]) assert.deepEqual(parseReps(txt), esperado, String(txt));
  assert.equal(e1rm(-5, 10), 0); assert.equal(e1rm(50, 0), 0);
  assert.doesNotThrow(() => { volumeSessao(null); seriesSessao({}); duracaoSessao(undefined); volumeSessao({ itens: [null, { sets: null }] }); });
});

test('regra 2 por 2: a carga só sobe depois de dois treinos seguidos no topo — no treino e nas dicas', () => {
  const ex = 'supino-reto-barra';
  const plano = { id: 'p', nome: 'P', dias: [{ id: 'a', nome: 'A', itens: [{ ex, series: 3, reps: '8-12' }] }], agenda: { 1: 'a', 3: 'a', 5: 'a' } };
  const monta = (lista) => { const st = vazio(); st.plans = [plano]; st.activePlan = 'p'; lista.forEach(([d, kg, reps], i) => { const s = sessao(d, [[ex, kg, reps, 3]]); s.id = 's' + i; st.sessions.push(s); }); return st; };
  // um treino no topo (os anteriores abaixo): "perto de aumentar", e a sugestão do treino manda repetir
  let st = monta([[9, 40, 9], [6, 40, 10], [3, 40, 12]]);
  let d = analisar(st, AGORA).dicas.find((x) => x.id === 'subir');
  assert.ok(d && /Perto de aumentar/.test(d.titulo), 'um treino no topo: perto de aumentar');
  assert.deepEqual(prontosParaSubir(st).map((x) => x.treinos), [1]);
  store.update((s) => { s.sessions = st.sessions; });
  let g = sugestao(ex, '8-12', 3);
  assert.equal(g.kg, 40); assert.match(g.texto, /Repita 12 repetições/);
  // dois treinos seguidos no topo: "pronto para mais carga", e a sugestão sobe a carga
  st = monta([[9, 40, 9], [6, 40, 12], [3, 40, 12]]);
  d = analisar(st, AGORA).dicas.find((x) => x.id === 'subir');
  assert.ok(d && /Pronto para mais carga/.test(d.titulo));
  assert.match(d.porque, /dois treinos seguidos/);
  store.update((s) => { s.sessions = st.sessions; });
  g = sugestao(ex, '8-12', 3);
  assert.equal(g.kg, 42.5); assert.equal(g.reps, 8);
  // só existe um treino, e foi no topo: ainda não sobe (antes subia)
  st = monta([[3, 40, 12]]);
  store.update((s) => { s.sessions = st.sessions; });
  g = sugestao(ex, '8-12', 3);
  assert.equal(g.kg, 40, 'um único treino no topo não basta para subir a carga');
  // topo com carga MENOR que a do treino anterior não conta como dois seguidos
  st = monta([[9, 40, 12], [6, 50, 12], [3, 40, 12]]);
  assert.deepEqual(prontosParaSubir(st).map((x) => x.treinos), [2], 'os dois últimos treinos foram no topo com 40 kg ou mais');
  st = monta([[9, 40, 12], [6, 30, 12], [3, 40, 12]]);
  assert.deepEqual(prontosParaSubir(st).map((x) => x.treinos), [1], 'o treino anterior foi com carga menor');
  store.update((s) => { s.sessions = []; });
});

test('dicas sem contradição: queda, alta, travado, recorde e "mais carga" nunca apontam o mesmo exercício em sentidos opostos (2.000 históricos)', () => {
  const r = semente(31);
  let comQueda = 0, comAlta = 0, comTravado = 0, comRecorde = 0, comSubir = 0, juntos = 0;
  for (let caso = 0; caso < 2000; caso++) {
    const st = vazio();
    const exs = [...new Set(Array.from({ length: 2 + Math.floor(r() * 5) }, () => um(r, FORCA)))];
    const perfis = exs.map(() => um(r, ['sobe', 'cai', 'parado', 'serra', 'recorde-e-queda', 'topo']));
    const n = 4 + Math.floor(r() * 14);
    for (let i = 0; i < n; i++) {
      const itens = exs.map((ex, k) => {
        const p = perfis[k];
        const kg = p === 'sobe' ? 40 + i * 2 : p === 'cai' ? 80 - i * 2.5 : p === 'parado' ? 50 : p === 'serra' ? 50 + (i % 2) * 10 : p === 'recorde-e-queda' ? (i === n - 3 ? 90 : i > n - 3 ? 55 : 60) : 40;
        return [ex, Math.max(5, kg), p === 'topo' ? 12 : 8 + (i % 3), 3];
      });
      st.sessions.push(sessao((n - i) * um(r, [1, 2, 2.3, 3]), itens));
    }
    st.sessions.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
    st.plans = [{ id: 'p', nome: 'P', dias: [{ id: 'a', nome: 'A', itens: exs.map((ex) => ({ ex, series: 3, reps: '8-12' })) }], agenda: { 1: 'a', 3: 'a', 5: 'a' } }];
    st.activePlan = 'p';
    st.trainer.answers = { objetivo: um(r, ['hipertrofia', 'emagrecimento', 'saude']), experiencia: 'intermediario', dias: '3' };
    const res = analisar(st, AGORA);
    conferir(res, `caso ${caso} (${perfis})`);
    const tem = (id) => ids(res).includes(id);
    if (tem('queda')) comQueda++; if (tem('alta')) comAlta++; if (tem('travado')) comTravado++; if (tem('recordes')) comRecorde++; if (tem('subir')) comSubir++;
    if (tem('queda') && tem('alta')) juntos++;
    // "rendimento caindo: faça uma semana mais leve" só quando as quedas não são minoria
    const t = res.resumo.tendencias;
    const q = res.dicas.find((x) => x.id === 'queda');
    if (q && q.tom === 'atencao') assert.ok(t.filter((x) => x.status === 'caindo').length >= t.filter((x) => x.status === 'subindo').length, `caso ${caso}: cansaço geral com mais exercícios subindo do que caindo`);
  }
  assert.ok(comQueda > 200 && comAlta > 200 && comTravado > 100 && comRecorde > 50 && comSubir > 100 && juntos > 50, JSON.stringify({ comQueda, comAlta, comTravado, comRecorde, comSubir, juntos }));
});

test('constância: a semana que acabou de começar não conta inteira; quem cumpriu a meta não é cobrado', () => {
  const plano = { id: 'p', nome: 'P', dias: [{ id: 'a', nome: 'A', itens: [] }], agenda: { 1: 'a', 3: 'a', 5: 'a' } };
  const monta = (dias) => { const st = vazio(); st.plans = [plano]; st.activePlan = 'p'; dias.forEach((d, i) => { const s = sessao(d, [['supino-reto-barra', 40, 10, 3]]); s.id = 's' + i; st.sessions.push(s); }); return st; };
  // meta 3; treinos há 7, 5 e 3 dias: 3 de 3 (antes: 3 de 6, "frequência abaixo da meta")
  let c = constancia(monta([7, 5, 3]), AGORA);
  assert.equal(c.previstos, 3); assert.equal(c.feitos, 3);
  assert.equal(analisar(monta([7, 5, 3]), AGORA).dicas.find((d) => d.id === 'frequencia').tom, 'bom');
  // 10 dias de uso, 4 treinos, meta 3 por semana: previstos = round(3 × 10/7) = 4
  c = constancia(monta([10, 8, 5, 2]), AGORA);
  assert.equal(c.previstos, 4); assert.equal(c.feitos, 4);
  // 4 semanas ou mais: teto de 4 semanas
  c = constancia(monta([60, 27, 20, 12, 3]), AGORA);
  assert.equal(c.previstos, 12); assert.equal(c.feitos, 4); assert.equal(c.semanas, 4);
  assert.equal(analisar(monta([60, 27, 20, 12, 3]), AGORA).dicas.find((d) => d.id === 'frequencia').tom, 'atencao');
  // singular e plural
  const umaSemana = analisar(monta([6, 4, 2]), AGORA).dicas.find((d) => d.id === 'frequencia');
  assert.match(umaSemana.texto, /na última semana/);
  assert.ok(!/últimas 1 semanas/.test(umaSemana.texto));
  for (const dias of [[13, 11, 9, 6, 4, 2], [20, 18, 15, 12, 9, 6, 3], [27, 25, 22, 20, 18, 15, 13, 11, 8, 6, 4, 1]]) for (const d of analisar(monta(dias), AGORA).dicas) assert.ok(!/\b1 semanas\b|\b1 treinos\b|\b1 exercícios\b|\b1 recordes\b/.test(d.titulo + d.texto), d.texto);
  // treinos só no futuro: nada a analisar
  const fut = vazio(); for (const d of [-1, -2, -3, -4]) fut.sessions.push(sessao(d, [['supino-reto-barra', 40, 10, 3]]));
  assert.equal(analisar(fut, AGORA).suficiente, false);
  assert.equal(constancia(fut, AGORA), null);
});

test('peso corporal: subindo quando o objetivo é emagrecer, caindo quando é ganhar, registros repetidos e fora de ordem', () => {
  const base = () => { const st = vazio(); for (const d of [9, 6, 3]) st.sessions.push(sessao(d, [['supino-reto-barra', 40, 10]])); return st; };
  const pesos = (ini, porSemana) => [28, 21, 14, 7, 0].map((d, i) => ({ data: dia(AGORA - d * DIA), peso: Math.round((ini + porSemana * i) * 10) / 10, cintura: null }));
  const dicaPeso = (st) => analisar(st, AGORA).dicas.find((d) => d.id === 'peso');
  let st = base(); st.nutri.answers.objetivo = 'emagrecer'; st.body = pesos(80, 0.8);
  let d = dicaPeso(st);
  assert.equal(d.tom, 'atencao'); assert.match(d.titulo, /subindo/); assert.match(d.texto, /\+0,8 kg por semana/);
  assert.ok(!/parado/i.test(d.titulo));
  st = base(); st.nutri.answers.objetivo = 'ganhar'; st.body = pesos(70, -0.6);
  d = dicaPeso(st);
  assert.equal(d.tom, 'atencao'); assert.match(d.titulo, /caindo/); assert.match(d.texto, /-0,6 kg por semana/);
  st = base(); st.nutri.answers.objetivo = 'emagrecer'; st.body = pesos(80, 0.05);
  assert.match(dicaPeso(st).titulo, /Peso parado/);
  st = base(); st.nutri.answers.objetivo = 'ganhar'; st.body = pesos(70, 0);
  assert.match(dicaPeso(st).titulo, /não sobe/);
  // fora de ordem e com dias repetidos: mesma tendência
  st = base(); st.nutri.answers.objetivo = 'emagrecer'; st.body = pesos(80, -0.5);
  const t1 = tendenciaPeso(st, AGORA);
  st.body = [st.body[3], st.body[0], st.body[4], st.body[2], st.body[1]];
  const t2 = tendenciaPeso(st, AGORA);
  assert.ok(Math.abs(t1.kgSemana - t2.kgSemana) < 1e-9); assert.equal(t2.diasSemRegistro, 0);
  // todos os pesos iguais: tendência zero, sem divisão por zero; um só dia repetido: sem tendência
  st.body = pesos(80, 0);
  assert.equal(tendenciaPeso(st, AGORA).kgSemana, 0);
  st.body = Array.from({ length: 10 }, () => ({ data: dia(AGORA), peso: 80, cintura: null }));
  assert.equal(tendenciaPeso(st, AGORA).kgSemana, null);
  // registros no futuro não viram "dias sem registro" negativos
  st.body = [{ data: dia(AGORA + 20 * DIA), peso: 80, cintura: null }];
  assert.ok(tendenciaPeso(st, AGORA).diasSemRegistro === null || tendenciaPeso(st, AGORA).diasSemRegistro >= 0);
  // a dica de registrar o peso abre a aba Peso
  st = base(); st.nutri.answers.objetivo = 'emagrecer';
  assert.deepEqual(analisar(st, AGORA).dicas.find((x) => x.id === 'pesar').acao, { rotulo: 'Registrar peso', rota: 'progresso', aba: 'peso' });
});

test('cardio por semana e séries planejadas', () => {
  // 140 min na primeira semana de uso = 140 min por semana (antes: 70)
  const st = vazio();
  st.trainer.answers = { objetivo: 'saude' };
  for (const d of [6, 5, 4, 3, 2, 1, 0.2]) { const s = sessao(d, [['bicicleta-ergometrica', null, null, 1]]); s.itens[0].sets[0].seg = 20; st.sessions.push(s); }
  assert.equal(cardioPorSemana(st, AGORA), 140);
  assert.ok(!ids(analisar(st, AGORA)).includes('cardio'), '140 min por semana não é "pouco aeróbico"');
  // duas semanas completas: média das duas
  const st2 = vazio();
  for (const d of [13.5, 10, 6, 2]) { const s = sessao(d, [['bicicleta-ergometrica', null, null, 1]]); s.itens[0].sets[0].seg = 30; st2.sessions.push(s); }
  assert.ok(Math.abs(cardioPorSemana(st2, AGORA) - 62) <= 2);
  st2.trainer.answers = { objetivo: 'emagrecimento' };
  const dc = analisar(st2, AGORA).dicas.find((x) => x.id === 'cardio');
  assert.ok(dc && /150 a 300 min/.test(dc.texto));
  // séries planejadas: o histórico só guarda as séries feitas; com `planejadas` dá para ver o que ficou para trás
  const st3 = vazio();
  for (const d of [9, 6, 3, 1]) { const s = sessao(d, [['supino-reto-barra', 40, 10, 2], ['remada-curvada-barra-pronada', 40, 10, 2]]); st3.sessions.push(s); }
  assert.equal(seriesConcluidas(st3), 1, 'sem o campo, vale o que está gravado');
  for (const s of st3.sessions) for (const it of s.itens) it.planejadas = 4;
  assert.equal(seriesConcluidas(st3), 0.5);
  assert.ok(ids(analisar(st3, AGORA)).includes('incompleto'));
  for (const s of st3.sessions) for (const it of s.itens) it.planejadas = 1; // menos planejadas do que feitas: nunca passa de 100%
  assert.equal(seriesConcluidas(st3), 1);
});

test('séries por grupo: a Evolução conta igual ao Treinador e o excesso só olha as séries diretas', () => {
  const p = gerarPlano({ objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'avancado', dias: '6', tempo: '75', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] }, { all: true, has: {} }, 0);
  const st = vazio();
  p.dias.forEach((d, i) => st.sessions.push({ id: 's' + i, inicio: iso(AGORA - 3600000), fim: iso(AGORA), itens: d.itens.map((it) => ({ ex: it.ex, sets: Array.from({ length: it.series }, () => ({ kg: 20, reps: 10, seg: 30, ok: true })) })) }));
  const sg = seriesPorGrupo(st, AGORA, 7);
  const v = volumeSemanal(p.dias);
  for (const g of Object.keys(sg.porGrupo)) { assert.equal(sg.porGrupo[g], v[g], g); assert.ok(sg.diretas[g] <= sg.porGrupo[g]); }
  // 26 séries diretas de peito numa semana: alerta de excesso; encolhimento e lombar não entram na conta de costas
  const st2 = vazio();
  for (const d of [6, 4, 2, 0.5]) st2.sessions.push(sessao(d, [['supino-reto-barra', 40, 10, 4], ['supino-inclinado-halteres', 20, 10, 3], ['encolhimento-barra', 40, 10, 5], ['hiperextensao-lombar-banco-romano', 0, 12, 5]]));
  const r2 = analisar(st2, AGORA);
  assert.ok(ids(r2).includes('muito-peito'));
  // encolhimento (trapézio) e hiperextensão (lombar) não são séries diretas de costas; o encolhimento conta meia série (costas superiores auxiliam)
  assert.equal(seriesPorGrupo(st2, AGORA).diretas.costas, 0);
  assert.equal(seriesPorGrupo(st2, AGORA).porGrupo.costas, 10);
  assert.ok(!ids(r2).includes('empurra-puxa') || seriesPorGrupo(st2, AGORA).porGrupo.costas < seriesPorGrupo(st2, AGORA).porGrupo.peito * 0.67);
  assert.match(r2.dicas.find((d) => d.id === 'muito-peito').texto, /séries diretas/);
});

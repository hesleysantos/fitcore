// Variação dos exercícios ao longo do tempo (logic/variacao.js): uma pessoa que treina toda semana por meses, com o
// plano do Treinador e com um plano de modelo, e os casos de borda (dor, academia limitada, nenhum substituto, adiar e
// voltar a pedir, pausa, saúde, exercício travado, trocas à mão e o que fica guardado).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import { gerarPlano, perfil, alertaDoExercicio, marcaDor } from '../www/js/logic/trainer.js';
import { estagnados } from '../www/js/logic/progress.js';
import { EX_POR_ID } from '../www/js/data/exercises.js';
import { MODELOS } from '../www/js/data/templates.js';
import { MUSCULOS } from '../www/js/data/muscles.js';
import { REFS, FAQ_TREINO } from '../www/js/data/knowledge.js';
import * as V from '../www/js/logic/variacao.js';

const DIA = 86400000, SEMANA = 7 * DIA;
const J = (x) => JSON.parse(JSON.stringify(x));
const INICIO = new Date(2026, 0, 5, 18, 0, 0).getTime(); // segunda-feira, 5/1/2026, 18 h
const GYM_ALL = { all: true, has: {} };
const LIVRES = new Set(['barra', 'halteres', 'kettlebell', 'peso_corporal']);
const RESP = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', dias: '3', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };
const semanaDoAno = (t) => Math.floor((t - (INICIO - 18 * 3600000)) / SEMANA) + 1; // semana 1 = a de segunda, 5/1

function planoDoTreinador(resp = RESP, gym = GYM_ALL) {
  const p = gerarPlano(resp, gym, 0);
  return { id: 'pt', nome: 'Plano do Treinador', origem: 'treinador', criadoEm: new Date(INICIO - DIA).toISOString(), info: '', agenda: { ...p.agenda },
    dias: p.dias.map((d) => ({ id: d.id, nome: d.nome, foco: d.foco, itens: d.itens.map((i) => ({ ex: i.ex, series: i.series, reps: i.reps, descanso: i.descanso, nota: '' })) })) };
}
function planoDeModelo(prefixo = 'ABC:') {
  const m = MODELOS.find((x) => x.nome.startsWith(prefixo));
  const dias = m.dias.map((d, i) => ({ id: 'd' + i, nome: d.nome, foco: d.foco, itens: d.itens.filter((it) => EX_POR_ID.has(it.ex)).map((it) => ({ ex: it.ex, series: it.series, reps: it.reps, descanso: it.descanso, nota: '' })) }));
  const wd = [1, 3, 5, 2, 4, 6];
  const agenda = {}; dias.forEach((d, i) => { agenda[wd[i]] = d.id; });
  return { id: 'pm', nome: m.nome, origem: 'modelo', criadoEm: new Date(INICIO - DIA).toISOString(), dias, agenda, info: '' };
}
// principais de cada treino: os 2 primeiros compostos (fora o cardio)
const principais = (d) => d.itens.filter((it) => { const ex = EX_POR_ID.get(it.ex); return ex && ex.tipo === 'composto' && ex.grupo !== 'cardio' && ex.padrao !== 'cardio'; }).slice(0, 2).map((it) => it.ex);
const grupo = (ex) => (MUSCULOS[ex.primarios[0]] ? MUSCULOS[ex.primarios[0]].grupo : ex.grupo);

// Uma pessoa que treina em todos os dias da agenda por `semanas` semanas. Antes de cada treino ela abre o app; se o
// aviso aparece, decide conforme `politica(sit, n)` ('aceita' | 'adia' | 'mantem'). `travar`: exercícios cuja marca para
// de subir (no 2º treino); `pausa`: [semana inicial, semana final] sem treinar.
function simular(plano, respostas, { semanas = 52, politica = () => 'aceita', travar = [], pausa = null, gym = GYM_ALL, dores = null } = {}) {
  const st = store.state;
  st.plans = [plano]; st.activePlan = plano.id; st.sessions = []; st.gym = gym;
  st.trainer = { answers: respostas, aceitoEm: '', revisaoEm: '', adiadoAte: '', versao: 0, combo: '' };
  const vezes = new Map();
  const eventos = [];
  for (let w = 0; w < semanas; w++) {
    if (pausa && w + 1 >= pausa[0] && w + 1 <= pausa[1]) continue;
    for (let k = 0; k < 7; k++) {
      const t = INICIO + (w * 7 + k) * DIA;
      const dia = plano.dias.find((d) => d.id === plano.agenda[new Date(t).getDay()]);
      if (!dia) continue;
      const agora = t - 3600000;
      const sit = V.situacao(st, plano, { respostas, gym, dores, travados: estagnados(plano), agora });
      if (sit && sit.devido) {
        const ev = { t: agora, semana: semanaDoAno(agora), motivo: sit.motivo, semanas: sit.semanas, trocas: sit.trocas, antes: J(plano.dias), decisao: politica(sit, eventos.length) };
        eventos.push(ev);
        const iso = new Date(agora).toISOString();
        if (ev.decisao === 'adia') V.adiarVariacao(plano, iso);
        else if (ev.decisao === 'mantem') V.manterTreino(plano, iso, sit.motivo, sit.prazo);
        else V.aplicarVariacao(plano, sit.trocas, iso, sit.motivo);
      }
      const itens = dia.itens.map((it) => {
        const n = (vezes.get(it.ex) || 0) + 1; vezes.set(it.ex, n);
        const kg = travar.includes(it.ex) ? 20 + Math.min(n, 2) : 20 + n;
        return { ex: it.ex, alvo: it.reps, descanso: it.descanso, sets: Array.from({ length: it.series }, () => ({ kg, reps: 10, seg: null, ok: true })) };
      });
      st.sessions.push({ id: 's' + st.sessions.length, planId: plano.id, diaId: dia.id, nome: dia.nome, inicio: new Date(t).toISOString(), fim: new Date(t + 3600000).toISOString(), nota: '', itens });
    }
  }
  return eventos;
}
// regras que valem para qualquer troca, em qualquer momento
function confereTrocas(plano, eventos, respostas, rot, gym = GYM_ALL) {
  const pf = perfil(V.respostasDaVariacao(respostas));
  for (const ev of eventos) {
    const porDia = {};
    for (const t of ev.trocas) {
      const de = EX_POR_ID.get(t.de), para = EX_POR_ID.get(t.para);
      porDia[t.diaId] = (porDia[t.diaId] || 0) + 1;
      assert.ok(porDia[t.diaId] <= V.POR_TREINO, `${rot}: mais de ${V.POR_TREINO} trocas no mesmo treino (semana ${ev.semana})`);
      assert.equal(para.padrao, de.padrao, `${rot}: troca muda o movimento (${t.de} → ${t.para})`);
      assert.equal(grupo(para), grupo(de), `${rot}: troca muda o músculo (${t.de} → ${t.para})`);
      assert.ok(!(de.tipo === 'composto' && LIVRES.has(de.modalidade)), `${rot}: tirou um composto de peso livre (${t.de})`);
      assert.ok(!(para.tipo === 'composto' && LIVRES.has(para.modalidade)), `${rot}: pôs um composto de peso livre no lugar de um auxiliar (${t.para})`);
      const d = ev.antes.find((x) => x.id === t.diaId);
      assert.ok(!principais(d).includes(t.de), `${rot}: trocou um exercício principal (${t.de}, semana ${ev.semana})`);
      assert.ok(!d.itens.some((it) => it.ex === t.para), `${rot}: o substituto já estava no treino`);
      for (const c of para.cuidado) assert.ok(!pf.cuidados.includes(c), `${rot}: substituto com cuidado para ${c}`);
      if (gym && !gym.all && pf.local === 'minha') for (const e of para.equip) assert.equal(gym.has[e], true, `${rot}: substituto usa aparelho que a academia não tem (${e})`);
    }
  }
  // o que saiu não volta por 3 prazos, e o que entrou não sai antes de um prazo
  const prazo = V.prazoDaVariacao(respostas);
  const hist = (plano.variacao && plano.variacao.trocas) || [];
  for (let i = 0; i < hist.length; i++) for (let j = i + 1; j < hist.length; j++) {
    const dt = (Date.parse(hist[j].em) - Date.parse(hist[i].em)) / SEMANA;
    if (hist[j].para === hist[i].de) assert.ok(dt >= V.SEM_VOLTAR * prazo, `${rot}: ${hist[i].de} saiu e voltou em ${dt.toFixed(1)} semanas`);
    if (hist[j].de === hist[i].para) assert.ok(dt >= prazo, `${rot}: ${hist[i].para} entrou e saiu em ${dt.toFixed(1)} semanas`);
  }
  // nenhum exercício repetido no mesmo treino
  for (const d of plano.dias) assert.equal(new Set(d.itens.map((i) => i.ex)).size, d.itens.length, `${rot}: exercício repetido em ${d.nome}`);
}

test('12 meses com o plano do Treinador: aviso a cada 6 semanas cheias, só auxiliares, principais intactos', () => {
  const plano = planoDoTreinador();
  const inicio = J(plano.dias);
  const ev = simular(plano, RESP);
  const prazos = ev.filter((e) => e.motivo === 'prazo');
  assert.ok(prazos.length >= 7, 'deveria avisar várias vezes no ano: ' + prazos.length);
  // primeiro aviso na segunda-feira da 7ª semana (6 semanas cheias de treino); depois, a cada 6 semanas
  assert.equal(prazos[0].semana, 7);
  assert.equal(new Date(prazos[0].t).getDay(), 1, 'o aviso aparece na segunda, antes do treino');
  for (let i = 1; i < prazos.length; i++) assert.equal(prazos[i].semana - prazos[i - 1].semana, 6, `intervalo entre avisos ${i}`);
  for (const e of prazos) { assert.equal(e.semanas, 6); assert.ok(e.trocas.length > 0, 'deveria haver trocas na academia completa'); }
  confereTrocas(plano, ev, RESP, 'Treinador');
  // os principais de cada treino são os mesmos do começo, no mesmo lugar
  plano.dias.forEach((d, i) => assert.deepEqual(principais(d), principais(inicio[i]), 'principais de ' + d.nome));
  // o texto do aviso
  const txt = V.textoDoAviso({ ...prazos[0], devido: true }, (id) => id);
  assert.match(txt.texto, /^Hora de variar: você faz este treino há 6 semanas\. Trocar \d+ exercícios? auxiliar(es)?\?$/);
});

test('12 meses com um plano de modelo, sem entrevista: 8 semanas (nível inicial) e os aparelhos de "Minha academia"', () => {
  const plano = planoDeModelo();
  const ev = simular(plano, {});
  const prazos = ev.filter((e) => e.motivo === 'prazo');
  assert.equal(V.prazoDaVariacao({}), 8);
  assert.equal(prazos[0].semana, 9);
  for (let i = 1; i < prazos.length; i++) assert.equal(prazos[i].semana - prazos[i - 1].semana, 8);
  confereTrocas(plano, ev, {}, 'modelo');
  // academia limitada: só halteres, banco, polia e duas máquinas
  const has = { halteres: true, banco_reto: true, banco_inclinado: true, crossover: true, puxador: true, cadeira_extensora: true, mesa_flexora: true, barra: true };
  const gym = { all: false, has };
  const p2 = planoDeModelo();
  const ev2 = simular(p2, {}, { semanas: 30, gym });
  assert.ok(ev2.length >= 3);
  confereTrocas(p2, ev2, {}, 'modelo com academia limitada', gym);
});

test('exercício auxiliar travado: troca antes do prazo, só ele, sem mexer na contagem; principal travado não troca', () => {
  const plano = planoDoTreinador();
  const aux = plano.dias.flatMap((d) => d.itens.filter((it, k) => !principais(d).includes(it.ex) && EX_POR_ID.get(it.ex).registro === 'peso_reps' && !(EX_POR_ID.get(it.ex).tipo === 'composto' && LIVRES.has(EX_POR_ID.get(it.ex).modalidade)))).map((it) => it.ex)[0];
  const prin = principais(plano.dias[0])[0];
  const ev = simular(plano, RESP, { semanas: 14, travar: [aux, prin] });
  const trav = ev.filter((e) => e.motivo === 'travado');
  assert.ok(trav.length >= 1, 'o auxiliar travado deveria gerar aviso');
  assert.ok(trav[0].semana < 7, 'antes do prazo');
  assert.deepEqual(trav[0].trocas.map((t) => t.de), [aux], 'só o travado sai');
  assert.ok(!ev.some((e) => e.trocas.some((t) => t.de === prin)), 'o principal travado não é trocado');
  assert.equal(ev.find((e) => e.motivo === 'prazo').semana, 7, 'a troca do travado não muda o prazo do plano');
  const txt = V.textoDoAviso({ ...trav[0], devido: true }, () => 'Mesa flexora');
  assert.equal(txt.texto, 'Mesa flexora está há 3 treinos sem evoluir. Trocar por outro do mesmo músculo?');
  // "Manter meu treino" num travado: não pergunta de novo por um prazo, mas o prazo do plano segue
  const p2 = planoDoTreinador();
  const ev2 = simular(p2, RESP, { semanas: 14, travar: [aux], politica: (s) => (s.motivo === 'travado' ? 'mantem' : 'aceita') });
  const t2 = ev2.filter((e) => e.motivo === 'travado');
  for (let i = 1; i < t2.length; i++) assert.ok(t2[i].semana - t2[i - 1].semana >= 6, 'travado mantido voltou a perguntar cedo');
  assert.equal(ev2.find((e) => e.motivo === 'prazo').semana, 7);
});

test('adiar volta a pedir em 2 semanas; manter recomeça a contagem', () => {
  const plano = planoDoTreinador();
  const ev = simular(plano, RESP, { semanas: 20, politica: (s, n) => (n < 2 ? 'adia' : 'aceita') });
  assert.deepEqual(ev.slice(0, 3).map((e) => e.semana), [7, 9, 11]);
  assert.deepEqual(ev.slice(0, 3).map((e) => e.semanas), [6, 8, 10]);
  assert.equal(ev[3].semana, 17, 'depois de aceitar, 6 semanas cheias');
  const p2 = planoDoTreinador();
  const ev2 = simular(p2, RESP, { semanas: 26, politica: () => 'mantem' });
  assert.deepEqual(ev2.map((e) => e.semana), [7, 13, 19, 25]);
  const exs = (p) => p.dias.map((d) => d.itens.map((i) => i.ex));
  assert.deepEqual(exs(p2), exs(planoDoTreinador()), 'manter não troca nada');
});

test('dor e limitação: o substituto nunca pega a região; exercício trocado por dor fica fora da variação', () => {
  const dores = [{ id: 'd1', data: '2026-01-01', onde: 'joelho', lado: '', tipo: 'articular', quando: 'durante', nivel: 5, nota: '', fim: '' }];
  const plano = planoDoTreinador();
  const ev = simular(plano, RESP, { semanas: 20, dores });
  assert.ok(ev.length >= 2);
  for (const e of ev) for (const t of e.trocas) { const a = alertaDoExercicio(t.para, dores, RESP); assert.ok(!a || a.nivel !== 'evitar', 'substituto que a dor manda evitar: ' + t.para); }
  // item marcado como troca por dor: não sai na variação
  const p2 = planoDoTreinador();
  const d0 = p2.dias[0];
  const k = d0.itens.findIndex((it) => !principais(d0).includes(it.ex));
  d0.itens[k].nota = marcaDor('joelho', d0.itens[k].ex);
  const ev2 = simular(p2, RESP, { semanas: 40 });
  assert.ok(!ev2.some((e) => e.trocas.some((t) => t.diaId === d0.id && t.idx === k)), 'trocou o exercício que está no lugar por causa da dor');
  // limitação no ombro: nenhum substituto com cuidado para ombro
  const r = { ...RESP, limitacoes: ['ombro'] };
  const p3 = planoDoTreinador(r);
  const ev3 = simular(p3, r, { semanas: 30 });
  confereTrocas(p3, ev3, r, 'limitação no ombro');
});

test('nenhum substituto possível: o aviso diz que o treino pode seguir e "Manter" recomeça a contagem', () => {
  // em casa, só com o peso do corpo: os compostos ficam (técnica) e quase não há auxiliar com outro igual
  const plano = planoDeModelo('Só com o peso do corpo');
  const ev = simular(plano, { local: 'nada' }, { semanas: 10, politica: () => 'mantem' });
  const sem = ev.find((e) => !e.trocas.length);
  if (sem) {
    const txt = V.textoDoAviso({ ...sem, devido: true });
    assert.match(txt.texto, /Não achei substitutos/);
  }
  // um plano só com principais: devido, sem trocas
  const so = { id: 'ps', nome: 'Só principais', origem: 'manual', criadoEm: new Date(INICIO - DIA).toISOString(), info: '', agenda: { 1: 'a' }, dias: [{ id: 'a', nome: 'A', foco: '', itens: [{ ex: 'agachamento-livre-barra', series: 3, reps: '8-12', descanso: 120, nota: '' }, { ex: 'supino-reto-barra', series: 3, reps: '8-12', descanso: 120, nota: '' }].filter((i) => EX_POR_ID.has(i.ex)) }] };
  assert.ok(so.dias[0].itens.length === 2, 'exercícios do catálogo');
  const ev2 = simular(so, RESP, { semanas: 8, politica: () => 'mantem' });
  assert.equal(ev2[0].semana, 7);
  assert.equal(ev2[0].trocas.length, 0);
  assert.match(V.textoDoAviso({ ...ev2[0], devido: true }).texto, /^Hora de variar: você faz este treino há 6 semanas\. Não achei substitutos/);
});

test('pausa e saúde: o aviso espera a volta acabar e some com a saúde bloqueando', () => {
  const plano = planoDoTreinador();
  // 4 semanas treinando, 3 paradas, e volta: as semanas paradas não contam e a transição de 2 semanas espera
  const ev = simular(plano, RESP, { semanas: 20, pausa: [5, 7] });
  assert.ok(ev[0].semana >= 10, 'aviso durante a volta da pausa: semana ' + ev[0].semana);
  assert.equal(ev[0].semanas >= 6, true);
  // triagem com sinal de alerta e sem liberação: sem aviso
  const r = { ...RESP, triagem: ['dor_peito'] };
  assert.ok(perfil(r).bloqueio, 'o perfil de teste bloqueia');
  const p2 = planoDoTreinador();
  const ev2 = simular(p2, r, { semanas: 10 });
  assert.equal(ev2.length, 0);
});

test('contagem: só semanas cheias com treino; a semana da troca no meio não conta', () => {
  const plano = { id: 'p', origem: 'manual', criadoEm: '2026-01-01T10:00:00.000Z', dias: [{ id: 'a', itens: [] }] };
  const s = (d) => ({ planId: 'p', inicio: new Date(2026, 0, d, 18).toISOString() });
  const st = { sessions: [s(5), s(7), s(12), s(26), s(28)] }; // semanas de 5/1, 12/1 e 26/1 (a de 19/1 sem treino)
  assert.equal(V.semanasNoTreino(st, plano, Date.parse(plano.criadoEm), new Date(2026, 1, 2, 9).getTime()), 3);
  assert.equal(V.semanasNoTreino(st, plano, Date.parse(plano.criadoEm), new Date(2026, 0, 28, 20).getTime()), 2, 'a semana em curso não conta');
  // troca na quarta 7/1, depois do treino de segunda: a semana de 5/1 não conta
  assert.equal(V.semanasNoTreino(st, plano, new Date(2026, 0, 7, 12).getTime(), new Date(2026, 1, 2, 9).getTime()), 2);
  // treino de outro plano não conta
  assert.equal(V.semanasNoTreino({ sessions: [{ planId: 'x', inicio: s(5).inicio }] }, plano, 0, Date.now()), 0);
});

test('troca feita à mão: o novo não sai logo e o antigo não volta logo', () => {
  const plano = planoDoTreinador();
  const d = plano.dias[0];
  const k = d.itens.findIndex((it) => !principais(d).includes(it.ex) && !(EX_POR_ID.get(it.ex).tipo === 'composto' && LIVRES.has(EX_POR_ID.get(it.ex).modalidade)));
  const antigo = d.itens[k].ex;
  const sit0 = V.situacao({ sessions: [] }, plano, { respostas: RESP, forcar: true, agora: INICIO });
  const novo = sit0.trocas.find((t) => t.de === antigo).para;
  d.itens[k] = { ...d.itens[k], ex: novo };
  V.registrarTrocaManual(plano, antigo, novo, new Date(INICIO + 5 * SEMANA).toISOString());
  const ev = simular(plano, RESP, { semanas: 8 });
  assert.equal(ev[0].semana, 7);
  assert.ok(!ev[0].trocas.some((t) => t.de === novo), 'o exercício que entrou à mão há 2 semanas saiu');
  assert.ok(!ev[0].trocas.some((t) => t.para === antigo), 'o exercício que saiu à mão voltou');
});

test('plano do Treinador de antes desta regra: usa a revisão e o adiamento guardados', () => {
  const plano = planoDoTreinador();
  const st = { sessions: [], trainer: { revisaoEm: new Date(INICIO + 8 * SEMANA).toISOString(), adiadoAte: new Date(INICIO + 20 * SEMANA).toISOString() } };
  for (let w = 0; w < 18; w++) st.sessions.push({ planId: 'pt', inicio: new Date(INICIO + w * SEMANA).toISOString() });
  const sit = V.situacao(st, plano, { respostas: RESP, agora: INICIO + 18 * SEMANA });
  assert.equal(sit.adiado, true, 'o "Agora não" antigo vale');
  assert.equal(sit.devido, false);
  const sit2 = V.situacao({ ...st, trainer: { revisaoEm: st.trainer.revisaoEm, adiadoAte: '' } }, plano, { respostas: RESP, agora: INICIO + 18 * SEMANA });
  assert.equal(sit2.semanas, 16, 'conta desde a última revisão (8 semanas depois do início, menos o prazo)');
  assert.equal(sit2.devido, true);
});

test('o que fica guardado: a variação do plano passa pela validação e pelo backup', () => {
  const plano = planoDoTreinador();
  V.aplicarVariacao(plano, [], '2026-03-01T10:00:00.000Z');
  V.registrarTrocaManual(plano, 'mesa-flexora', 'cadeira-flexora', '2026-03-02T10:00:00.000Z');
  V.adiarVariacao(plano, '2026-03-03T10:00:00.000Z');
  V.manterTreino(plano, '2026-03-04T10:00:00.000Z', 'travado', 6);
  const limpo = store.sanitize({ v: store.VERSAO, plans: [plano], activePlan: 'pt' });
  assert.deepEqual(limpo.plans[0].variacao, plano.variacao);
  assert.deepEqual(store.sanitize(J(limpo)), limpo, 'validar duas vezes não muda');
  // sem variação, o plano não ganha o campo; lixo sai
  const sem = store.sanitize({ plans: [{ ...plano, variacao: undefined }] });
  assert.equal('variacao' in sem.plans[0], false);
  const lixo = store.sanitize({ plans: [{ ...plano, variacao: { desde: 'ontem', adiadoAte: 5, trocas: [{ de: 'nao-existe', para: 'x', em: '2026-01-01T00:00:00.000Z' }, null, 3] } }] });
  assert.equal('variacao' in lixo.plans[0], false);
  const muitas = store.sanitize({ plans: [{ ...plano, variacao: { trocas: Array.from({ length: 60 }, (_, i) => ({ de: 'mesa-flexora', para: 'cadeira-flexora', em: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() })) } }] });
  assert.equal(muitas.plans[0].variacao.trocas.length, 40);
  assert.equal(muitas.plans[0].variacao.trocas[39].em.slice(0, 10), '2026-03-01', 'ficam as mais recentes');
});

test('fontes e textos: tudo citado existe, a pergunta frequente fala do prazo novo', () => {
  for (const k of V.REFS_VARIACAO) assert.ok(REFS[k], 'referência sem texto: ' + k);
  const faq = FAQ_TREINO.find((x) => /trocar os exercícios/.test(x.q));
  assert.ok(faq);
  for (const k of faq.f) assert.ok(REFS[k], k);
  const txt = faq.a.join(' ');
  assert.match(txt, /6 semanas de treino \(8 para quem está começando\)/);
  assert.doesNotMatch(txt, /8 a 12 semanas/);
});

// Testes do armazenamento (validação de backup/importação) e das regras de progresso.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import { sugestao, e1rm, parseReps, sequenciaSemanas, volumeSessao, recorde, estagnados } from '../www/js/logic/progress.js';

const iso = (d) => new Date(d).toISOString();

test('sanitize: dados inválidos ou maliciosos são descartados', () => {
  const sujo = JSON.parse(`{
    "__proto__": {"polluted": true},
    "constructor": {"prototype": {"polluted": true}},
    "settings": {"tema": "<script>alert(1)</script>", "descanso": 999999, "som": "sim"},
    "gym": {"all": false, "has": {"halteres": true, "__proto__": true, "inventado": true}},
    "plans": [
      {"id": "p1", "nome": "${'x'.repeat(500)}", "origem": "hacker", "dias": [
        {"id": "d1", "nome": "A", "itens": [
          {"ex": "supino-reto-barra", "series": 9999, "reps": "8-12; DROP TABLE", "descanso": -5, "nota": "<img src=x onerror=alert(1)>"},
          {"ex": "nao-existe", "series": 3, "reps": "10", "descanso": 60},
          {"ex": "__proto__", "series": 3}
        ]},
        {"id": "<bad id>", "nome": "B", "itens": []}
      ], "agenda": {"1": "d1", "2": "inexistente", "__proto__": "d1", "99": "d1"}},
      "lixo", null, 42
    ],
    "activePlan": "nao-existe",
    "sessions": [
      {"id": "s1", "nome": "ok", "inicio": "2026-11-01T10:00:00.000Z", "fim": "2026-11-01T11:00:00.000Z", "itens": [{"ex": "supino-reto-barra", "sets": [{"kg": 1e99, "reps": -4, "ok": true}, {"kg": "40", "reps": null, "ok": "yes"}]}]},
      {"id": "s2", "inicio": "data inválida", "itens": []},
      {"id": "s3", "inicio": "2026-11-02T10:00:00.000Z", "itens": []}
    ],
    "current": {"inicio": "2026-11-03T10:00:00.000Z", "itens": [], "restEnd": "amanhã"},
    "trainer": {"answers": {"objetivo": "hipertrofia", "__proto__": "x", "constructor": "y", "idade": 30, "foco": ["gluteos", {"a": 1}, "<b>"], "Bad Key": 1, "x": "com espaço e <tag>"}},
    "nutri": {"answers": {"peso": 1e12}},
    "body": [{"data": "2026-11-01", "peso": 80}, {"data": "ontem", "peso": 70}, {"data": "2026-11-02", "peso": 99999}, {"data": "2026-10-01", "peso": 79.5, "cintura": 2}],
    "ui": {"onboarded": "true"},
    "extra": {"qualquer": "coisa"}
  }`);
  const s = store.sanitize(sujo);
  assert.equal({}.polluted, undefined, 'protótipo global poluído!');
  assert.equal(Object.prototype.hasOwnProperty.call(s, 'extra'), false);
  assert.deepEqual(Object.keys(s).sort(), ['activePlan', 'body', 'combo', 'current', 'diario', 'dores', 'gym', 'nutri', 'plans', 'run', 'runs', 'sessions', 'settings', 'sono', 'trainer', 'ui', 'v'].sort());
  assert.equal(s.settings.tema, 'auto');
  assert.equal(s.settings.descanso, 600);
  assert.equal(s.settings.som, true);
  assert.deepEqual(s.gym.has, { halteres: true });
  assert.equal(s.plans.length, 1);
  const p = s.plans[0];
  assert.equal(p.nome.length, 60);
  assert.equal(p.origem, 'manual');
  assert.equal(p.dias.length, 1, 'dia com id inválido deve ser descartado');
  assert.equal(p.dias[0].itens.length, 1, 'exercícios inexistentes devem ser descartados');
  const it = p.dias[0].itens[0];
  assert.equal(it.series, 12);
  assert.equal(it.reps, '10');
  assert.equal(it.descanso, 0);
  assert.equal(it.nota, '<img src=x onerror=alert(1)>', 'texto é guardado como texto puro (e exibido com textContent)');
  assert.deepEqual(p.agenda, { 1: 'd1' });
  assert.equal(s.activePlan, 'p1');
  assert.equal(s.sessions.length, 1, 'sessões sem data válida ou sem fim são descartadas');
  assert.equal(s.sessions[0].itens[0].sets[0].kg, 2000);
  assert.equal(s.sessions[0].itens[0].sets[0].reps, 0);
  assert.equal(s.sessions[0].itens[0].sets.length, 1, 'no histórico só ficam as séries concluídas (a segunda tinha "ok" inválido)');
  assert.equal(s.current.restEnd, 0);
  assert.deepEqual(Object.keys(s.trainer.answers).sort(), ['foco', 'idade', 'objetivo']);
  assert.deepEqual(s.trainer.answers.foco, ['gluteos']);
  assert.equal(s.nutri.answers.peso, undefined, 'valor fora da faixa da pergunta é recusado');
  assert.deepEqual(s.body.map((b) => b.data), ['2026-10-01', '2026-11-01', '2026-11-02']);
  assert.equal(s.body[2].peso, 400);
  assert.equal(s.body[0].cintura, 30);
  assert.equal(s.ui.onboarded, false);
});

test('sanitize: respostas das entrevistas só aceitam o que existe nas perguntas', async () => {
  const { gerarPlano, perfil } = await import('../www/js/logic/trainer.js');
  const { calcular } = await import('../www/js/logic/nutrition.js');
  const ruins = [
    { objetivo: 'saude', triagem: 1, limitacoes: true, condicoes: 'x', foco: 7 },
    { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['x', '__proto__', 'constructor'] },
    { objetivo: ['a'], idade: '30', dias: 4, foco: [['gluteos']] },
  ];
  for (const answers of ruins) {
    const s = store.sanitize({ trainer: { answers }, nutri: { answers } });
    for (const k of ['triagem', 'limitacoes', 'condicoes', 'foco']) assert.ok(s.trainer.answers[k] === undefined || Array.isArray(s.trainer.answers[k]), k + ' deve ser lista ou ausente');
    assert.doesNotThrow(() => perfil(s.trainer.answers));
    assert.doesNotThrow(() => gerarPlano(s.trainer.answers, { all: true, has: {} }, 0));
    // mesmo sem passar pela sanitização, a lógica não pode quebrar
    assert.doesNotThrow(() => perfil(answers));
    assert.doesNotThrow(() => gerarPlano(answers, { all: true, has: {} }, 0));
  }
  const s2 = store.sanitize({ trainer: { answers: ruins[1] } });
  assert.equal(s2.trainer.answers.foco, undefined, 'valores que não existem na pergunta são descartados');
  assert.doesNotThrow(() => calcular({ objetivo: 'manter', sexo: 'm', idade: 30, peso: 70, altura: 170, atividade: 'leve', treinos: '3', horario: 'noite', refeicoes: '4', restricoes: 5, condicoes: 'x' }));
});

test('sanitize: ids repetidos ou reservados e datas fora do padrão', () => {
  const s = store.sanitize({
    plans: [
      { id: 'p1', nome: 'A', dias: [{ id: 'd1', nome: 'A', itens: [] }, { id: 'd1', nome: 'repetido', itens: [] }] },
      { id: 'p1', nome: 'repetido', dias: [] },
      { id: '__proto__', nome: 'reservado', dias: [] },
      { id: 'constructor', nome: 'reservado', dias: [] },
    ],
    sessions: [
      { id: 'x', nome: 'b', inicio: '2026-11-02T10:00:00.000Z', fim: '2026-11-02T11:00:00.000Z', itens: [] },
      { id: 'x', nome: 'a', inicio: '2026-11-01T10:00:00.000Z', fim: '2026-11-01T11:00:00.000Z', itens: [] },
      { id: 'y', nome: 'data solta', inicio: 'Tuesday 5', fim: '2026-11-01T11:00:00.000Z', itens: [] },
      { id: 'z', nome: 'só número', inicio: '1', fim: '2', itens: [] },
      { id: 'w', nome: 'fim antes do início', inicio: '2026-11-03T10:00:00.000Z', fim: '2026-11-03T09:00:00.000Z', itens: [] },
    ],
  });
  assert.deepEqual(s.plans.map((p) => p.id), ['p1']);
  assert.equal(s.plans[0].dias.length, 1);
  assert.equal(s.sessions.length, 2);
  assert.notEqual(s.sessions[0].id, s.sessions[1].id, 'ids de sessão repetidos recebem um novo id');
  assert.deepEqual(s.sessions.map((x) => x.nome), ['a', 'b'], 'sessões ficam em ordem cronológica');
});

test('backup: leitura mostra resumo antes de aplicar e recusa versão mais nova', () => {
  const txt = JSON.stringify({ app: 'fitcore', v: 1, exportadoEm: '2026-11-10T12:00:00.000Z', dados: { sessions: [{ id: 'a', nome: 'ok', inicio: '2026-11-01T10:00:00.000Z', fim: '2026-11-01T11:00:00.000Z', itens: [] }, { lixo: true }], plans: [] } });
  const { dados, resumo } = store.readBackup(txt);
  assert.equal(resumo.treinos, 1);
  assert.equal(resumo.descartados, 1);
  assert.equal(resumo.exportadoEm, '2026-11-10T12:00:00.000Z');
  assert.equal(dados.current, null);
  assert.throws(() => store.readBackup(JSON.stringify({ app: 'fitcore', v: 99, dados: {} })), /versão mais nova/);
});

test('sanitize: entradas que não são objeto viram estado vazio', () => {
  for (const bad of [null, undefined, 42, 'texto', [], true]) {
    const s = store.sanitize(bad);
    assert.equal(s.plans.length, 0);
    assert.equal(s.settings.tema, 'auto');
    assert.equal(s.gym.all, true);
  }
});

test('importar backup: rejeita arquivos de outros apps, JSON inválido e arquivos enormes', () => {
  assert.throws(() => store.importData('isto não é json'), /backup válido/);
  assert.throws(() => store.importData('{"app":"outro","dados":{}}'), /deste aplicativo/);
  assert.throws(() => store.importData('{"app":"fitcore"}'), /deste aplicativo/);
  assert.throws(() => store.importData('x'.repeat(25 * 1024 * 1024)), /grande demais/);
  assert.throws(() => store.importData(12345), /grande demais|inválido/);
});

test('exportar e importar preserva os dados', () => {
  store.update((s) => {
    s.plans.push({ id: 'pA', nome: 'Meu', origem: 'manual', criadoEm: iso('2026-11-01'), dias: [{ id: 'dA', nome: 'A', foco: '', itens: [{ ex: 'leg-press-45', series: 3, reps: '10-12', descanso: 90, nota: '' }] }], agenda: { 1: 'dA' }, info: '' });
    s.activePlan = 'pA';
    s.sessions.push({ id: 'sA', planId: 'pA', diaId: 'dA', nome: 'A', inicio: iso('2026-11-02T10:00'), fim: iso('2026-11-02T11:00'), nota: '', itens: [{ ex: 'leg-press-45', alvo: '10-12', descanso: 90, sets: [{ kg: 100, reps: 12, seg: null, ok: true }] }] });
    s.current = { id: 'sB', planId: '', diaId: '', nome: 'x', inicio: iso('2026-11-03T10:00'), fim: '', nota: '', itens: [], restEnd: 0, restTotal: 0 };
  });
  const txt = store.exportData();
  const r = store.importData(txt);
  assert.equal(r.treinos, 1);
  assert.equal(store.state.plans[0].dias[0].itens[0].ex, 'leg-press-45');
  assert.equal(store.state.sessions[0].itens[0].sets[0].kg, 100);
  assert.equal(store.state.current, null, 'treino em andamento não é restaurado');
});

test('progresso: sugestão de carga segue a dupla progressão', () => {
  const ex = 'supino-reto-barra';
  const sess = (dia, sets) => ({ id: 's' + dia, planId: '', diaId: '', nome: 't', inicio: iso(`2026-10-${String(dia).padStart(2, '0')}T10:00`), fim: iso(`2026-10-${String(dia).padStart(2, '0')}T11:00`), nota: '', itens: [{ ex, alvo: '8-12', descanso: 90, sets: sets.map(([kg, reps]) => ({ kg, reps, seg: null, ok: true })) }] });
  store.update((s) => { s.sessions = []; });
  let g = sugestao(ex, '8-12', 3);
  assert.equal(g.kg, null); assert.equal(g.reps, 8); assert.match(g.texto, /Primeira vez/);
  store.update((s) => { s.sessions = [sess(1, [[40, 10], [40, 9], [40, 8]])]; });
  g = sugestao(ex, '8-12', 3);
  assert.equal(g.kg, 40); assert.equal(g.reps, 11); assert.match(g.texto, /Mantenha a carga/);
  store.update((s) => { s.sessions = [sess(1, [[40, 10], [40, 9], [40, 8]]), sess(3, [[40, 12], [40, 12], [40, 12]])]; });
  g = sugestao(ex, '8-12', 3);
  assert.equal(g.kg, 40, 'primeira vez no topo: repetir antes de subir (regra 2 por 2)'); assert.equal(g.reps, 12);
  store.update((s) => { s.sessions = [sess(1, [[40, 12], [40, 12], [40, 12]]), sess(3, [[40, 12], [40, 12], [40, 12]])]; });
  g = sugestao(ex, '8-12', 3);
  assert.equal(g.kg, 42.5, 'duas vezes no topo: subir cerca de 5%'); assert.equal(g.reps, 8);
  assert.ok((g.kg - 40) / 40 >= 0.02 && (g.kg - 40) / 40 <= 0.1, 'aumento entre 2% e 10%');
  store.update((s) => { s.sessions = [sess(1, [[60, 6], [60, 5]]), sess(3, [[60, 6], [60, 5]])]; });
  g = sugestao(ex, '8-12', 3);
  assert.ok(g.kg < 60 && g.kg >= 54, 'duas vezes abaixo do mínimo: reduzir 5 a 10%'); assert.match(g.texto, /Reduza/);
  // aparelho assistido: evoluir é reduzir a ajuda
  const gr = 'barra-fixa-assistida-graviton';
  store.update((s) => { s.sessions = [{ ...sess(5, []), itens: [{ ex: gr, alvo: '8-12', descanso: 90, sets: [{ kg: 30, reps: 12, seg: null, ok: true }, { kg: 30, reps: 12, seg: null, ok: true }] }] }]; });
  g = sugestao(gr, '8-12', 2);
  assert.ok(g.kg < 30, 'graviton: sugerir menos ajuda'); assert.match(g.texto, /reduza a ajuda/);
});

test('progresso: utilitários', () => {
  assert.deepEqual(parseReps('8-12'), [8, 12]);
  assert.deepEqual(parseReps('30'), [30, 30]);
  assert.deepEqual(parseReps('lixo'), [8, 12]);
  assert.equal(Math.round(e1rm(100, 10)), 133);
  assert.equal(e1rm(0, 10), 0);
  store.update((s) => { s.sessions = []; });
  assert.equal(sequenciaSemanas(3), 0);
  assert.equal(recorde('supino-reto-barra'), null);
  assert.deepEqual(estagnados(null), []);
  assert.equal(volumeSessao({ itens: [{ sets: [{ kg: 50, reps: 10, ok: true }, { kg: 50, reps: 8, ok: false }] }] }), 500);
});

test('backup: séries vazias em treinos finalizados são descartadas e dia impossível não é aceito', () => {
  const vazias = Array.from({ length: 30 }, () => ({}));
  const treino = (i) => ({ id: 't' + i, nome: 'x', inicio: '2026-10-01T10:00:00.000Z', fim: '2026-10-01T11:00:00.000Z', itens: Array.from({ length: 60 }, () => ({ ex: 'supino-reto-barra', sets: vazias })) });
  const txt = JSON.stringify({ app: 'fitcore', v: 1, dados: { sessions: Array.from({ length: 200 }, (_, i) => treino(i)), body: [{ data: '2026-02-31', peso: 80 }, { data: '2026-02-28', peso: 81 }] } });
  const { dados } = store.readBackup(txt);
  assert.equal(dados.sessions.length, 200);
  assert.ok(dados.sessions.every((x) => x.itens.every((it) => it.sets.length === 0)), 'séries sem nada não entram no histórico');
  assert.ok(JSON.stringify(dados).length < txt.length, 'o estado limpo não fica maior que o arquivo');
  assert.deepEqual(dados.body.map((b) => b.data), ['2026-02-28'], '31 de fevereiro não existe');
  const comPlano = store.sanitize({ sessions: [{ id: 'a', nome: 'x', inicio: '2026-10-01T10:00:00.000Z', fim: '2026-10-01T11:00:00.000Z', itens: [{ ex: 'supino-reto-barra', planejadas: 4.6, sets: [{ kg: 40, reps: 10, ok: true }] }, { ex: 'supino-reto-barra', planejadas: 'x', sets: [] }] }] });
  assert.equal(comPlano.sessions[0].itens[0].planejadas, 5);
  assert.equal('planejadas' in comPlano.sessions[0].itens[1], false);
});

test('sanitize: Treinador de corrida (run) e corridas registradas (runs)', () => {
  const sujo = JSON.parse(`{
    "run": {"answers": {"experiencia": "regular", "kmSemana": 9999, "dias": ["1", "3", "9", {"a": 1}, "__proto__"], "objetivo": "<script>", "__proto__": {"x": 1}, "liberado": "sim", "idade": 40},
            "aceitoEm": "2026-11-02T10:00:00.000Z", "inicio": "2026-11-04", "pausadoEm": "ontem", "extra": {"a": 1}},
    "runs": [
      {"id": "r1", "data": "2026-11-03", "tipo": "leve", "distKm": 5, "durMin": 30, "pse": 4, "dor": {"onde": "joelho", "nivel": 3, "x": 1}, "nota": "${'n'.repeat(500)}", "planejado": "${'p'.repeat(500)}", "lixo": {"a": 1}},
      {"id": "r1", "data": "2026-11-04", "tipo": "leve", "distKm": 5, "durMin": 30},
      {"id": "r2", "data": "2026-02-31", "tipo": "leve", "distKm": 5, "durMin": 30},
      {"id": "r3", "data": "2026-11-01", "tipo": "inventado", "distKm": 1e9, "durMin": -5, "pse": 99, "dor": {"onde": "__proto__", "nivel": 5}},
      {"id": "r4", "data": "2026-11-05", "tipo": "leve", "distKm": 10, "durMin": 5},
      {"id": "__proto__", "data": "2026-11-05", "tipo": "leve", "distKm": 5, "durMin": 30},
      {"id": "r5", "data": "2026-11-05", "tipo": "leve"},
      {"id": "r6", "data": "2026-11-06", "tipo": "tempo", "distKm": "5", "durMin": 41.26, "pse": 6.4, "dor": {"onde": "canela", "nivel": 0}},
      "lixo", null, 42, []
    ]
  }`);
  const s = store.sanitize(sujo);
  assert.equal({}.x, undefined, 'protótipo global poluído!');
  assert.deepEqual(Object.keys(s.run).sort(), ['aceitoEm', 'answers', 'cron', 'degrau', 'inicio', 'mostrados', 'pausadoEm', 'pausas']);
  assert.deepEqual(s.run.pausas, []);
  assert.equal(s.run.cron, null);
  assert.deepEqual(Object.keys(s.run.answers).sort(), ['dias', 'experiencia', 'idade', 'liberado'], 'só perguntas e valores que existem');
  assert.deepEqual(s.run.answers.dias, ['1', '3']);
  assert.equal(s.run.inicio, '2026-11-02', 'o início é sempre a segunda-feira da semana');
  assert.equal(s.run.pausadoEm, '');
  assert.deepEqual(s.runs.map((r) => r.id), ['r3', 'r1', 'r6'], 'ids repetidos, datas impossíveis, ritmos impossíveis e registros vazios saem; ordem por data');
  const r1 = s.runs[1];
  assert.deepEqual(Object.keys(r1).sort(), ['data', 'distKm', 'dores', 'durMin', 'id', 'nota', 'planejado', 'pse', 'tipo']);
  assert.deepEqual(r1.dores, [{ onde: 'joelho', nivel: 3, tipo: 'articular' }], 'a dor única dos registros antigos vira uma lista');
  assert.equal(r1.nota.length, 200); assert.equal(r1.planejado.length, 160);
  const r3 = s.runs[0];
  assert.equal(r3.tipo, 'livre'); assert.equal(r3.distKm, 120); assert.equal(r3.durMin, 0); assert.equal(r3.pse, null); assert.deepEqual(r3.dores, []);
  const r6 = s.runs[2];
  assert.equal(r6.distKm, 0, 'texto no lugar de número não vale'); assert.equal(Math.round(r6.durMin * 60), 2476, 'tempo guardado com precisão de 1 segundo'); assert.equal(r6.pse, 6); assert.deepEqual(r6.dores, []);
  // sem aceite válido, não há início nem pausa
  const semAceite = store.sanitize({ run: { answers: {}, aceitoEm: 'x', inicio: '2026-11-02', pausadoEm: '2026-11-03T10:00:00.000Z' } });
  assert.deepEqual(semAceite.run, { answers: {}, aceitoEm: '', inicio: '', pausadoEm: '', cron: null, pausas: [], mostrados: [], degrau: null });
  // cronômetro da corrida em andamento: guardado só com números válidos
  const comCron = store.sanitize({ run: { answers: {}, aceitoEm: '2026-11-02T10:00:00.000Z', inicio: '2026-11-02', cron: { data: '2026-11-03', i: 2, fim: 1794000000000, pausadoEm: 0, inicio: 1793999000000, parado: 0, inicioPasso: 1793999500000, terminado: 0, chave: 4321, extra: '<x>' }, pausas: [{ de: '2026-11-04', ate: '2026-11-20', semanas: 9, extra: '<x>' }, { de: 'ontem', ate: 'hoje' }, '<x>'] } });
  assert.deepEqual(comCron.run.cron, { data: '2026-11-03', i: 2, fim: 1794000000000, pausadoEm: 0, inicio: 1793999000000, parado: 0, inicioPasso: 1793999500000, terminado: 0, chave: 4321 });
  assert.deepEqual(comCron.run.pausas, [{ de: '2026-11-04', ate: '2026-11-20', semanas: 2 }], 'pausas do plano: só datas válidas, e as semanas puladas não passam do tamanho da pausa');
  assert.equal(store.sanitize({ run: { answers: {}, aceitoEm: '2026-11-02T10:00:00.000Z', inicio: '2026-11-02', cron: { data: 'ontem', i: 'a', fim: {} } } }).run.cron, null);
  for (const bad of [null, 5, 'x', [], { run: 7, runs: 'abc' }, { run: [], runs: {} }]) {
    const z = store.sanitize(bad);
    assert.deepEqual(z.run, { answers: {}, aceitoEm: '', inicio: '', pausadoEm: '', cron: null, pausas: [], mostrados: [], degrau: null });
    assert.deepEqual(z.runs, []);
  }
  // limite de 3000 registros
  const muitos = Array.from({ length: 3500 }, (_, i) => ({ id: 'm' + i, data: '2026-10-01', tipo: 'leve', distKm: 5, durMin: 30 }));
  assert.equal(store.sanitize({ runs: muitos }).runs.length, 3000);
});

test('relógio do aparelho atrasado: o que já estava guardado no aparelho não é apagado ao abrir; em backup importado o corte de futuro vale', () => {
  const futuro = () => ({
    sono: { acordar: '', idade: 30, registros: [{ data: '2031-05-10', horas: 7.5 }], cochilos: [{ data: '2031-05-10', min: 20 }] },
    diario: { dias: [{ data: '2031-05-10', itens: [{ id: 'i1', ref: 'almoco', nome: 'marmita', kcal: 500, p: null }] }] },
  });
  const doArquivo = store.sanitize(futuro());
  assert.equal(doArquivo.sono.registros.length, 0); assert.equal(doArquivo.diario.dias.length, 0);
  const doAparelho = store.sanitize(futuro(), { doAparelho: true });
  assert.equal(doAparelho.sono.registros.length, 1); assert.equal(doAparelho.sono.cochilos.length, 1); assert.equal(doAparelho.diario.dias.length, 1);
  // lixo continua sendo recusado nos dois caminhos
  const lixo = store.sanitize({ sono: { registros: [{ data: '2031-02-31', horas: 7 }, { data: '2031-05-10', horas: -3 }] }, diario: { dias: [{ data: 'amanhã', itens: [] }] } }, { doAparelho: true });
  assert.equal(lixo.sono.registros.length, 0); assert.equal(lixo.diario.dias.length, 0);
});

test('sanitize: perguntas de saúde novas — remédios, alergias e a data da liberação médica', () => {
  const s = store.sanitize({
    trainer: { answers: { triagem: ['palpitacao', 'xpto', 'nenhum'], remedios: ['pulso', 'aspirina', 7], liberado: 'sim', liberadoEm: '2026-10-01', liberadoEm2: 'x' } },
    run: { answers: { condicoes: ['renal'], remedios: 'glicose', liberado: 'sim', liberadoEm: '01/10/2026' } },
    nutri: { answers: { alergias: ['amendoim', 'gluten', 'leite'], condicoes: ['cardiaco', 'pulmao'] } },
  });
  assert.deepEqual(s.trainer.answers.triagem, ['palpitacao', 'nenhum'], 'só as opções que existem (o "nenhum" junto é resolvido na entrevista)');
  assert.deepEqual(s.trainer.answers.remedios, ['pulso']);
  assert.equal(s.trainer.answers.liberadoEm, '2026-10-01');
  assert.equal(s.trainer.answers.liberadoEm2, undefined);
  assert.equal(s.run.answers.remedios, undefined, 'remédios só como lista');
  assert.equal(s.run.answers.liberado, 'sim');
  assert.equal(s.run.answers.liberadoEm, undefined, 'data fora do formato AAAA-MM-DD não entra');
  assert.deepEqual(s.nutri.answers.alergias, ['amendoim', 'leite']);
  assert.deepEqual(s.nutri.answers.condicoes, ['cardiaco']);
  // sem "sim", a data não fica
  assert.equal(store.sanitize({ trainer: { answers: { liberado: 'nao', liberadoEm: '2026-10-01' } } }).trainer.answers.liberadoEm, undefined);
  assert.equal(store.sanitize({ trainer: { answers: { liberadoEm: '2026-10-01' } } }).trainer.answers.liberadoEm, undefined);
});

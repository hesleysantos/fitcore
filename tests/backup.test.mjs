// Backup: tudo o que o aplicativo guarda sai no arquivo e volta igual na restauração (ida e volta).
// Se um campo novo for criado no estado e esquecido na validação, este teste falha.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import { PERGUNTAS as P_TREINO, respostasCompletas as treinoOk, gerarPlano } from '../www/js/logic/trainer.js';
import { PERGUNTAS as P_NUTRI, respostasCompletas as nutriOk } from '../www/js/logic/nutrition.js';
import { PERGUNTAS as P_CORRIDA, respostasCompletas as corridaOk } from '../www/js/logic/corrida.js';
import { ALIMENTOS } from '../www/js/data/foods.js';
import { EQUIPAMENTOS } from '../www/js/data/equipment.js';

const J = (x) => JSON.parse(JSON.stringify(x));
// responde uma entrevista inteira: primeira opção de cada pergunta (ou a opção `i`), respeitando as perguntas condicionais
function responder(perguntas, i = 0) {
  const a = {};
  for (const q of perguntas) {
    if (q.se && !q.se(a)) continue;
    if (q.tipo === 'numero') a[q.k] = q.padrao ?? q.min;
    else if (q.tipo === 'um') a[q.k] = q.op[Math.min(i, q.op.length - 1)][0];
    else a[q.k] = [q.op[Math.min(i, q.op.length - 1)][0]];
  }
  return a;
}

function estadoCheio() {
  // (com um sinal da triagem, a liberação médica e a data dela, e um remédio: tudo tem de voltar igual)
  const treino = { objetivo: 'hipertrofia', idade: 31, peso: 78, altura: 176, experiencia: 'intermediario', pausa: '1a3m', dias: '4', tempo: '60', local: 'completa', limitacoes: ['joelho'], condicoes: ['nenhuma'], triagem: ['tontura'], remedios: ['pulso'], liberado: 'sim', liberadoEm: '2026-10-01', foco: [P_TREINO.find((q) => q.k === 'foco').op[1][0]] };
  assert.ok(treinoOk(treino), 'respostas do Treinador usadas no teste são válidas');
  const p = gerarPlano(treino, { all: true, has: {} }, 0);
  const plano = { id: 'p1', nome: 'Plano do Treinador', origem: 'treinador', criadoEm: '2026-11-01T10:00:00.000Z', dias: p.dias.map((d) => ({ id: d.id, nome: d.nome, foco: d.foco, itens: d.itens.map((it) => ({ ...it, nota: 'obs' })) })), agenda: p.agenda, info: 'Feito para o teste.' };
  const ex0 = plano.dias[0].itens[0].ex;
  const sessao = (id, dia) => ({ id, planId: 'p1', diaId: plano.dias[0].id, nome: plano.dias[0].nome, inicio: `2026-11-${dia}T18:00:00.000Z`, fim: `2026-11-${dia}T19:05:00.000Z`, nota: 'treino bom', itens: [{ ex: ex0, alvo: '8-12', descanso: 90, planejadas: 3, sets: [{ kg: 40, reps: 10, seg: null, ok: true }, { kg: 40, reps: 9, seg: null, ok: true }] }] });
  const nutri = responder(P_NUTRI);
  assert.ok(nutriOk(nutri), 'respostas da Nutricionista usadas no teste são válidas');
  const corrida = responder(P_CORRIDA, 1);
  return {
    v: store.VERSAO,
    settings: { tema: 'claro', descanso: 75, som: false, somAlerta: 'sino', vibrar: false, telaLigada: false, animar: false, avisoFundo: true },
    gym: { all: false, has: Object.fromEntries(Object.keys(EQUIPAMENTOS).slice(0, 3).map((k) => [k, true])) },
    plans: [plano],
    activePlan: 'p1',
    sessions: [sessao('s1', '03'), sessao('s2', '05')],
    current: null,
    trainer: { answers: treino, aceitoEm: '2026-11-01T10:00:00.000Z', revisaoEm: '2026-12-27T10:00:00.000Z', adiadoAte: '2026-11-20T10:00:00.000Z', versao: 3, combo: 'corrida|sim' },
    combo: { foco: 'corrida', fortalecimento: 'sim', em: '2026-11-03T10:00:00.000Z' },
    nutri: { answers: nutri, calculadoEm: '2026-11-02T10:00:00.000Z', seed: 7, emCasa: ALIMENTOS.slice(0, 12).map((f) => f.id), soCasa: true, ajustes: { '2026-11-12': { s: 3, m: [0, 2] }, '2026-11-13': { s: 0, m: [1] } } },
    body: [{ data: '2026-11-01', peso: 78.4, cintura: 84 }, { data: '2026-11-08', peso: 78.1, cintura: null }],
    run: { answers: corrida, aceitoEm: '2026-11-02T10:00:00.000Z', inicio: '2026-11-02', pausadoEm: '', cron: null, pausas: [{ de: '2026-11-10', ate: '2026-11-26', semanas: 2 }],
      // o treino que o plano mostrou em cada dia e o degrau de ritmo já concedido
      mostrados: [{ data: '2026-11-03', tipo: 'leve', nome: 'Rodagem leve', resumo: '5 km em ritmo leve', durMin: 32, distKm: 5, ritmo: [360, 420], pse: [2, 4], un: 'd' }, { data: '2026-11-04', tipo: '', nome: '', resumo: '', durMin: 0, distKm: 0, ritmo: null, pse: null, un: 't' }],
      degrau: { pontos: 1, base: 'entrevista' } },
    runs: [
      { id: 'r1', data: '2026-11-03', tipo: 'leve', distKm: 5.2, durMin: 33.5, pse: 4, dores: [], nota: 'tranquilo', planejado: 'Rodagem leve' },
      { id: 'r2', data: '2026-11-06', tipo: 'longo', distKm: 10, durMin: 68, pse: 6, dores: [{ onde: 'joelho', nivel: 3, tipo: 'articular' }, { onde: 'coxa-tras', nivel: 2, tipo: 'muscular' }], nota: '', planejado: 'Longo' },
    ],
    dores: [{ id: 'dor1', data: '2026-11-06', onde: 'joelho', lado: 'd', tipo: 'articular', quando: 'durante', nivel: 3, nota: 'na descida', fim: '' }, { id: 'dor2', data: '2026-10-20', onde: 'lombar', lado: '', tipo: 'muscular', quando: 'depois', nivel: 4, nota: '', fim: '2026-10-25' }],
    sono: { acordar: '06:30', idade: 31, registros: [{ data: '2026-11-11', horas: 7.5 }, { data: '2026-11-12', horas: 6.25, qualidade: 2 }, { data: '2026-11-13', horas: 8, qualidade: 4 }], cochilos: [{ data: '2026-11-12', min: 25, inicio: '13:40' }, { data: '2026-11-13', min: 20, inicio: '14:10' }, { data: '2026-11-13', min: 45 }] },
    diario: { dias: [
      { data: '2026-11-12', itens: [{ id: 'i1', ref: 'cafe', al: ALIMENTOS[0].id, g: 150, m: true }, { id: 'i2', ref: 'almoco', al: ALIMENTOS[5].id, g: 80, m: false }] },
      { data: '2026-11-13', itens: [{ id: 'i1', ref: 'outro', nome: 'Bolo de cenoura', kcal: 310, p: 4.5 }, { id: 'i2', ref: 'jantar', nome: 'Sopa da casa', kcal: 180, p: null }] },
    ] },
    // "Não treinei" (com o treino passado para outro dia) e "Não corri"
    perdidos: [
      { tipo: 'musculacao', data: '2026-11-03', planId: 'p1', diaId: plano.dias[0].id, movs: [{ diaId: plano.dias[0].id, de: '2026-11-03', para: '2026-11-05' }], em: '2026-11-03T21:00:00.000Z' },
      { tipo: 'corrida', data: '2026-11-04', em: '2026-11-04T21:00:00.000Z' },
    ],
    ui: { onboarded: true, installDismissedAt: '2026-11-01T09:00:00.000Z', backupEm: '2026-11-07T09:00:00.000Z', backupAdiadoEm: '2026-11-05T09:00:00.000Z', objetivosOk: 'hipertrofia|emagrecer' },
  };
}

test('backup: o estado completo sai no arquivo e volta idêntico', () => {
  const cheio = estadoCheio();
  const limpo = store.sanitize(J(cheio));
  // nada do que foi posto é descartado pela validação
  assert.deepEqual(limpo.settings, cheio.settings);
  assert.deepEqual(limpo.gym, cheio.gym);
  assert.equal(limpo.plans.length, 1); assert.deepEqual(limpo.plans[0].dias.map((d) => d.itens.length), cheio.plans[0].dias.map((d) => d.itens.length));
  assert.deepEqual(limpo.plans[0].agenda, cheio.plans[0].agenda); assert.equal(limpo.activePlan, 'p1');
  assert.equal(limpo.sessions.length, 2); assert.equal(limpo.sessions[0].itens[0].sets.length, 2); assert.equal(limpo.sessions[0].nota, 'treino bom');
  assert.deepEqual(limpo.trainer, cheio.trainer);
  assert.deepEqual(limpo.nutri, cheio.nutri);
  assert.deepEqual(limpo.body, cheio.body);
  assert.deepEqual(limpo.run.aceitoEm, cheio.run.aceitoEm); assert.equal(limpo.run.inicio, '2026-11-02');
  assert.ok(Object.keys(limpo.run.answers).length >= 5, 'respostas da corrida preservadas');
  assert.equal(limpo.trainer.answers.liberadoEm, '2026-10-01', 'a data da liberação médica volta do backup');
  assert.deepEqual(limpo.nutri.answers.alergias, cheio.nutri.answers.alergias, 'as alergias voltam do backup');
  assert.ok(cheio.nutri.answers.alergias.length, 'o teste responde a pergunta das alergias');
  // a corrida com liberação e data também volta igual
  const comLib = J(cheio); comLib.run.answers = { ...comLib.run.answers, liberado: 'sim', liberadoEm: '2026-09-30' };
  assert.equal(store.sanitize(comLib).run.answers.liberadoEm, '2026-09-30');
  // data inválida, ou data sem "sim", não entra
  const ruim = J(cheio); ruim.trainer.answers.liberadoEm = '2026-02-30'; ruim.run.answers = { ...ruim.run.answers, liberado: 'nao', liberadoEm: '2026-09-30' };
  assert.equal(store.sanitize(ruim).trainer.answers.liberadoEm, undefined);
  assert.equal(store.sanitize(ruim).run.answers.liberadoEm, undefined);
  assert.deepEqual(limpo.runs, cheio.runs);
  assert.deepEqual(limpo.dores, [cheio.dores[1], cheio.dores[0]], 'dores preservadas (em ordem de data)');
  assert.deepEqual(limpo.sono, cheio.sono, 'hora de acordar, idade e noites registradas preservadas');
  assert.deepEqual(limpo.diario, cheio.diario, 'diário alimentar preservado: dias, refeições, alimentos da lista e fora dela');
  assert.deepEqual(limpo.combo, cheio.combo);
  assert.deepEqual(limpo.perdidos, cheio.perdidos, 'treinos marcados como não feitos preservados');
  assert.deepEqual(limpo.ui, cheio.ui);
  // validar duas vezes não muda mais nada
  assert.deepEqual(store.sanitize(J(limpo)), limpo);

  // todo campo do estado está coberto por este teste: quem criar um campo novo precisa incluí-lo aqui e na validação
  const padrao = store.sanitize({});
  for (const k of Object.keys(padrao)) {
    if (k === 'current' || k === 'v') continue;
    assert.notDeepEqual(limpo[k], padrao[k], `o campo "${k}" do estado não foi preenchido neste teste`);
  }
  assert.deepEqual(Object.keys(limpo).sort(), Object.keys(padrao).sort());

  // ida e volta pelo arquivo de backup, como a tela faz
  store.update((s) => { for (const k of Object.keys(limpo)) s[k] = J(limpo[k]); });
  const arquivo = store.exportData();
  assert.equal(typeof arquivo, 'string');
  const { dados, resumo } = store.readBackup(arquivo);
  assert.deepEqual(dados, { ...limpo, current: null });
  assert.equal(resumo.treinos, 2); assert.equal(resumo.planos, 1); assert.equal(resumo.pesos, 2);
  assert.equal(resumo.corridas, 2); assert.equal(resumo.dores, 2);
  assert.deepEqual(dados.sono, cheio.sono, 'o sono volta do arquivo igual ao que foi registrado');
  assert.deepEqual(dados.diario, cheio.diario, 'o diário alimentar volta do arquivo igual ao que foi registrado');
  // segunda ida e volta: continua igual
  store.update((s) => { for (const k of Object.keys(dados)) s[k] = J(dados[k]); });
  assert.deepEqual(store.readBackup(store.exportData()).dados, dados);
});

test('backup: treino em andamento não vem no arquivo restaurado; backup de versão antiga ganha os campos novos vazios', () => {
  const cheio = store.sanitize(J(estadoCheio()));
  const emCurso = { id: 's9', planId: 'p1', diaId: cheio.plans[0].dias[0].id, nome: 'A', inicio: '2026-11-10T18:00:00.000Z', fim: '', nota: '', restEnd: 0, restTotal: 0, volta: 0, cron: null, itens: [{ ex: cheio.plans[0].dias[0].itens[0].ex, alvo: '8-12', descanso: 90, sets: [{ kg: 40, reps: 10, seg: null, ok: false }] }] };
  const txt = JSON.stringify({ app: 'fitcore', v: 1, exportadoEm: '2026-11-10T19:00:00.000Z', dados: { ...cheio, current: emCurso } });
  assert.equal(store.readBackup(txt).dados.current, null);
  // arquivo feito antes de existirem corrida, dores e despensa
  const { run, runs, dores, ...antigo } = cheio;
  antigo.nutri = { answers: cheio.nutri.answers, calculadoEm: cheio.nutri.calculadoEm, seed: cheio.nutri.seed };
  const r = store.readBackup(JSON.stringify({ app: 'fitcore', v: 1, dados: antigo })).dados;
  assert.equal(r.sessions.length, 2); assert.equal(r.plans.length, 1);
  assert.deepEqual(r.runs, []); assert.deepEqual(r.dores, []); assert.deepEqual(r.nutri.emCasa, []); assert.equal(r.nutri.soCasa, false); assert.deepEqual(r.nutri.ajustes, {});
  assert.equal(r.run.aceitoEm, ''); assert.deepEqual(r.run.answers, {});
  // lixo e arquivo de outro aplicativo são recusados
  assert.throws(() => store.readBackup('{"app":"outro","dados":{}}'));
  assert.throws(() => store.readBackup('não é json'));
  assert.throws(() => store.readBackup(JSON.stringify({ app: 'fitcore', v: 999, dados: {} })));
});

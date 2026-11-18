// Exportar o histórico: planilhas CSV (formato para o Excel em português, proteção contra fórmula, proteções do diário)
// e o resumo do período; e as configurações de letra e contraste na validação e no backup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { campoCsv, montarCsv, numBR, hms, hm, dataBR, planilha, planilhasDisponiveis, montarResumo, BOM, TIPOS_PLANILHA } from '../www/js/logic/exportar.js';
import * as store from '../www/js/store.js';

const HOJE = '2026-11-16';
// início de treino em hora LOCAL (como o app grava: ISO do horário do aparelho)
const local = (data, hh = 18, mm = 30) => { const [a, m, d] = data.split('-').map(Number); return new Date(a, m - 1, d, hh, mm).toISOString(); };
const sessao = (id, data, nome, itens) => ({ id, planId: '', diaId: '', nome, inicio: local(data), fim: local(data, 19, 30), nota: '', itens });
const serie = (kg, reps, ok = true) => ({ kg, reps, seg: null, ok });
// lê as linhas de um CSV gerado (sem o BOM), campo a campo
function ler(txt) {
  assert.ok(txt.startsWith(BOM), 'começa com o BOM do UTF-8');
  assert.ok(txt.endsWith('\r\n'), 'termina com CRLF');
  return txt.slice(1).split('\r\n').filter(Boolean).map((l) => l.slice(1, -1).split('";"').map((c) => c.replace(/""/g, '"')));
}
function estado(extra = {}) {
  return {
    sessions: [
      sessao('s1', '2026-10-20', 'Treino A', [{ ex: 'supino-reto-barra', sets: [serie(40, 10), serie(42.5, 8)], alvo: '8-10', descanso: 90 }, { ex: 'suspensao-barra-fixa-dead-hang', sets: [{ kg: null, reps: null, seg: 30, ok: true }], alvo: '30', descanso: 60 }]),
      sessao('s2', '2026-11-03', 'Treino A', [{ ex: 'supino-reto-barra', sets: [serie(45, 10), serie(45, 9)], alvo: '8-10', descanso: 90 }]),
      sessao('s3', '2026-11-14', '=HYPERLINK("http://x","clique")', [{ ex: 'supino-reto-barra', sets: [serie(47.5, 8), serie(50, 3, false)], alvo: '8-10', descanso: 90 }]),
    ],
    current: { id: 'c', nome: 'Em andamento', inicio: local(HOJE), itens: [{ ex: 'supino-reto-barra', sets: [serie(99, 1)] }] },
    runs: [
      { id: 'r1', data: '2026-11-02', tipo: 'leve', distKm: 5, durMin: 30, pse: 4, dores: [{ onde: 'joelho', nivel: 3, tipo: 'articular' }], nota: 'calor\nforte', planejado: '' },
      { id: 'r2', data: '2026-11-10', tipo: 'livre', distKm: 10, durMin: 62.5, pse: null, dores: [], nota: '+1 km', planejado: '' },
    ],
    body: [{ data: '2026-10-01', peso: 80, cintura: 90 }, { data: '2026-11-01', peso: 79.2, cintura: null }, { data: '2026-11-15', peso: 78.5, cintura: 88 }],
    sono: { acordar: '', idade: null, registros: [{ data: '2026-11-14', horas: 443 / 60, qualidade: 4, dormiu: '23:10', acordou: '06:40' }, { data: '2026-11-15', horas: 6.5 }], cochilos: [{ data: '2026-11-14', min: 20, inicio: '14:00' }] },
    diario: { dias: [{ data: '2026-11-15', itens: [{ id: 'i1', ref: 'jantar', al: 'arroz-branco-cozido', g: 150, m: false }, { id: 'i2', ref: 'cafe', nome: '@pão da padaria', kcal: 300, p: 9 }], sup: [{ id: 's1', tipo: 'whey', qtd: 1.5, un: 'dose', pDose: 24, kcalDose: 120 }, { id: 's2', tipo: 'creatina', qtd: 5, un: 'g' }] }] },
    dores: [{ id: 'd1', data: '2026-11-05', onde: 'ombro', lado: 'd', tipo: 'articular', quando: 'durante', nivel: 4, nota: '-piora no supino', fim: '' }, { id: 'd0', data: '2026-01-05', onde: 'lombar', lado: '', tipo: 'muscular', quando: 'depois', nivel: 2, nota: '', fim: '2026-01-08' }],
    trainer: { answers: { idade: 31 } }, nutri: { answers: {} }, run: { answers: {} },
    ...extra,
  };
}

test('CSV: campos entre aspas, aspas dobradas e fórmulas neutralizadas (OWASP)', () => {
  assert.equal(campoCsv('Supino'), '"Supino"');
  assert.equal(campoCsv('ele disse "oi"'), '"ele disse ""oi"""');
  for (const perigo of ['=1+1', '+5', '-2', '@SUM(A1)', '\t=1', '\r=1', '\n=1', '＝1', '＋1', '－1', '＠1']) assert.equal(campoCsv(perigo)[1], "'", perigo);
  assert.equal(campoCsv('12,5'), '"12,5"');
  assert.equal(campoCsv(null), '""');
  assert.equal(montarCsv(['a', 'b'], [[1, 'x;y']]), BOM + '"a";"b"\r\n"1";"x;y"\r\n', 'separador ";" e CRLF; ";" dentro do campo fica protegido pelas aspas');
});

test('números e tempos no formato brasileiro', () => {
  assert.equal(numBR(12.5), '12,5'); assert.equal(numBR(1000), '1000'); assert.equal(numBR(null), ''); assert.equal(numBR(NaN), ''); assert.equal(numBR(-0.001), '0');
  assert.equal(numBR(78.46, 1), '78,5');
  assert.equal(hms(3750), '1:02:30'); assert.equal(hms(330), '0:05:30'); assert.equal(hm(443), '7:23'); assert.equal(dataBR('2026-11-05'), '05/11/2026'); assert.equal(dataBR('x'), '');
});

test('planilha de musculação: uma linha por série feita, data local, kg com vírgula, sem o treino em andamento', () => {
  const p = planilha(estado(), 'musculacao', HOJE);
  assert.equal(p.nome, 'fitcore-musculacao-2026-11-16.csv');
  const l = ler(p.texto);
  assert.deepEqual(l[0], ['Data', 'Hora', 'Treino', 'Exercício', 'Série', 'Carga (kg)', 'Repetições', 'Tempo (s)']);
  assert.deepEqual(l[1], ['20/10/2026', '18:30', 'Treino A', 'Supino reto com barra', '1', '40', '10', '']);
  assert.deepEqual(l[2].slice(5, 7), ['42,5', '8']);
  assert.deepEqual(l[3], ['20/10/2026', '18:30', 'Treino A', 'Suspensão na barra fixa (dead hang)', '1', '', '', '30']);
  assert.equal(l.length, 1 + 6, 'série não concluída e treino em andamento ficam de fora');
  assert.ok(l.every((x) => !x.includes('99')));
  assert.equal(l[6][2], `'=HYPERLINK("http://x","clique")`, 'nome de treino com fórmula vira texto');
});

test('planilhas de corridas, peso, sono e dores', () => {
  const st = estado();
  const c = ler(planilha(st, 'corridas', HOJE).texto);
  assert.deepEqual(c[1], ['02/11/2026', 'Rodagem leve', '5', '0:30:00', '0:06:00', '4', 'Joelho 3/10', 'calor forte']);
  assert.deepEqual(c[2], ['10/11/2026', 'Corrida livre', '10', '1:02:30', '0:06:15', '', '', "'+1 km"]);
  const p = ler(planilha(st, 'peso', HOJE).texto);
  assert.deepEqual(p.slice(1), [['01/10/2026', '80', '90'], ['01/11/2026', '79,2', ''], ['15/11/2026', '78,5', '88']]);
  const s = ler(planilha(st, 'sono', HOJE).texto);
  assert.deepEqual(s.slice(1), [['14/11/2026', 'Noite', '7:23', '23:10', '06:40', '4'], ['14/11/2026', 'Cochilo', '0:20', '14:00', '', ''], ['15/11/2026', 'Noite', '6:30', '', '', '']]);
  const d = ler(planilha(st, 'dores', HOJE).texto);
  assert.deepEqual(d[1], ['05/11/2026', 'Ombro', 'direito', 'Dor na articulação ou no tendão', 'Durante o treino', '4', '', "'-piora no supino"]);
  assert.equal(planilha(st, 'nada', HOJE), null);
});

test('diário alimentar segue as proteções da tela: calorias para adultos, só alimentos para menores, nada com transtorno alimentar', () => {
  const adulto = ler(planilha(estado(), 'diario', HOJE).texto);
  assert.deepEqual(adulto[0], ['Data', 'Refeição', 'Alimento', 'Quantidade (g)', 'Medida caseira', 'Calorias (kcal)', 'Proteína (g)']);
  assert.deepEqual(adulto[1].slice(0, 3), ['15/11/2026', 'Café da manhã', "'@pão da padaria"], 'ordem das refeições do dia e texto com @ neutralizado');
  assert.deepEqual(adulto[1].slice(5), ['300', '9']);
  assert.deepEqual([adulto[2][2], adulto[2][3], adulto[2][5]], ['Arroz branco cozido', '150', '192']);
  // suplementos e vitaminas do dia: depois dos alimentos, com a dose marcada; números só do whey com o rótulo
  assert.deepEqual(adulto[3], ['15/11/2026', 'Suplemento ou vitamina', 'Whey (proteína em pó)', '', '1,5 doses', '180', '36']);
  assert.deepEqual(adulto[4], ['15/11/2026', 'Suplemento ou vitamina', 'Creatina', '', '5 g', '', '']);
  const menor = ler(planilha(estado({ run: { answers: { idade: 16 } } }), 'diario', HOJE).texto);
  assert.equal(menor[0].length, 5, 'menor de 18 anos: sem calorias nem proteína');
  assert.deepEqual(menor[3], ['15/11/2026', 'Suplemento ou vitamina', 'Whey (proteína em pó)', '', '1,5 doses']);
  assert.ok(!menor.flat().includes('300'));
  const ta = estado({ nutri: { answers: { condicoes: ['transtorno'] } } });
  assert.equal(planilha(ta, 'diario', HOJE), null);
  assert.ok(!planilhasDisponiveis(ta).some((x) => x.id === 'diario'));
  assert.deepEqual(planilhasDisponiveis(estado()).map((x) => [x.id, x.linhas]), [['musculacao', 6], ['corridas', 2], ['peso', 3], ['sono', 3], ['diario', 4], ['dores', 2], ['saude', 0]]);
  assert.equal(TIPOS_PLANILHA.length, 7);
});

test('problemas de saúde fora do treino: planilha e resumo', () => {
  const st = { saudeFora: [{ id: 'a1', data: '2026-03-02', tipo: 'pancada', onde: 'joelho', grau: 'moderada', fim: '2026-03-05' }, { id: 'a2', data: '2026-03-04', tipo: 'febre' }] };
  const l = ler(planilha(st, 'saude', HOJE).texto);
  assert.deepEqual(l[0], ['Data', 'Problema', 'Local', 'Intensidade', 'Avaliado em', 'Melhorou em']);
  assert.equal(l.length, 3);
  assert.equal(l[1][2], 'Joelho');
  const r = montarResumo(st, { dias: 0, hoje: HOJE });
  assert.equal(r.saude.length, 2);
});

test('estado vazio ou estranho não quebra as planilhas nem o resumo', () => {
  for (const st of [{}, null, { sessions: 'x', runs: [null, 1], sono: [], diario: { dias: [null] }, dores: [{}] }]) {
    for (const { id } of planilhasDisponiveis(st)) { const p = planilha(st, id, HOJE); assert.equal(ler(p.texto).length, 1, id); }
    const r = montarResumo(st, { dias: 0, hoje: HOJE });
    assert.equal(r.de, HOJE); assert.equal(r.musc.treinos, 0); assert.equal(r.corrida.n, 0); assert.equal(r.peso.n, 0); assert.deepEqual(r.dores, []);
  }
});

test('resumo do período: frequência, evolução da carga, corrida, peso, sono, alimentação e dores', () => {
  const st = estado();
  const r = montarResumo(st, { dias: 90, hoje: HOJE });
  assert.equal(r.de, '2026-08-19'); assert.equal(r.dias, 90);
  assert.equal(r.musc.treinos, 3); assert.equal(r.musc.porSemana, Math.round((3 / (90 / 7)) * 10) / 10); assert.equal(r.musc.series, 6);
  const sup = r.musc.principais[0];
  assert.equal(sup.nome, 'Supino reto com barra'); assert.equal(sup.vezes, 3);
  // melhor série (1RM estimado) do primeiro e do último treino; a série de 50 kg não concluída não conta
  assert.deepEqual([sup.inicio.kg, sup.inicio.reps, sup.fim.kg, sup.fim.reps, sup.difKg], [42.5, 8, 47.5, 8, 5]);
  assert.equal(r.musc.principais.length, 1, 'exercício feito uma vez só não entra na evolução');
  assert.equal(sup.assistido, false);
  // aparelho assistido: a melhor série é a com MENOS ajuda; a diferença negativa é progresso
  const grav = (data, sets) => sessao('g' + data, data, 'B', [{ ex: 'barra-fixa-assistida-graviton', sets, alvo: '8', descanso: 90 }]);
  const g = montarResumo({ sessions: [grav('2026-11-01', [serie(40, 8), serie(30, 6)]), grav('2026-11-10', [serie(25, 8), serie(35, 10)])] }, { dias: 30, hoje: HOJE }).musc.principais[0];
  assert.deepEqual([g.assistido, g.inicio.kg, g.fim.kg, g.difKg], [true, 30, 25, -5]);
  assert.deepEqual([r.corrida.n, r.corrida.km, r.corrida.seg, r.corrida.maiorKm, r.corrida.ritmoSeg, r.corrida.pse, r.corrida.comDor], [2, 15, 5550, 10, 370, 4, 1]);
  assert.deepEqual([r.peso.n, r.peso.inicio.peso, r.peso.fim.peso, r.peso.dif, r.peso.cinturaInicio, r.peso.cinturaFim], [3, 80, 78.5, -1.5, 90, 88]);
  assert.deepEqual([r.sono.noites, r.sono.mediaMin, r.sono.menos7, r.sono.qualidade, r.sono.cochilos, r.sono.cochiloMedioMin], [2, Math.round((443 + 390) / 2), 1, 4, 1, 20]);
  assert.deepEqual([r.diario.dias, r.diario.kcal, r.diario.prot], [1, 492, 13]);
  assert.deepEqual(r.dores.map((d) => [d.data, d.local, d.nivel]), [['2026-11-05', 'Ombro, direito', 4]], 'só as dores do período');
  // 30 dias desde 18/10: os três treinos entram; 14 dias desde 03/11: o treino de 20/10, o peso de 01/11 e a corrida de 02/11 saem
  const r30 = montarResumo(st, { dias: 30, hoje: HOJE });
  assert.equal(r30.de, '2026-10-18'); assert.equal(r30.musc.treinos, 3);
  const r14 = montarResumo(st, { dias: 14, hoje: HOJE });
  assert.equal(r14.de, '2026-11-03'); assert.equal(r14.musc.treinos, 2); assert.equal(r14.peso.n, 1); assert.equal(r14.peso.dif, null); assert.equal(r14.corrida.n, 1);
  // tudo: desde o primeiro registro de qualquer tipo (a dor de janeiro)
  const tudo = montarResumo(st, { dias: 0, hoje: HOJE });
  assert.equal(tudo.de, '2026-01-05'); assert.equal(tudo.dores.length, 2);
  // menor de 18: sem calorias no resumo; transtorno alimentar: sem a seção de alimentação
  assert.equal(montarResumo(estado({ trainer: { answers: { idade: 15 } } }), { dias: 90, hoje: HOJE }).diario.kcal, null);
  assert.equal(montarResumo(estado({ run: { answers: { condicoes: ['transtorno'] } } }), { dias: 90, hoje: HOJE }).diario, null);
  // registros depois de "hoje" não entram
  assert.equal(montarResumo(st, { dias: 90, hoje: '2026-11-04' }).musc.treinos, 2);
});

test('configurações de letra e contraste: validadas e mantidas no backup', () => {
  assert.equal(store.sanitize({}).settings.letra, 'normal');
  assert.equal(store.sanitize({}).settings.contraste, false);
  for (const v of ['grande', 'muito', 'normal']) assert.equal(store.sanitize({ settings: { letra: v } }).settings.letra, v);
  for (const v of ['enorme', '<b>', 2, null, ['grande'], { x: 1 }]) assert.equal(store.sanitize({ settings: { letra: v } }).settings.letra, 'normal', String(v));
  for (const v of ['sim', 1, null]) assert.equal(store.sanitize({ settings: { contraste: v } }).settings.contraste, false, String(v));
  assert.equal(store.sanitize({ settings: { contraste: true } }).settings.contraste, true);
  assert.deepEqual(store.LETRAS, ['normal', 'grande', 'muito']);
  const txt = JSON.stringify({ app: 'fitcore', v: 1, dados: { settings: { letra: 'grande', contraste: true, tema: 'claro' } } });
  const { dados } = store.readBackup(txt);
  assert.deepEqual([dados.settings.letra, dados.settings.contraste, dados.settings.tema], ['grande', true, 'claro']);
});

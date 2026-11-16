// Meta de sono: faixa e alvo por idade e perfil, validação, acompanhamento da semana, hora de deitar, dicas,
// referências e um teste de estresse com milhares de estados aleatórios (semente fixa).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  sonoPadrao, limparSono, limparNoite, noiteDe, gravarNoite, apagarNoite, limparCochilo, cochilosDe, minutosDeCochilo, gravarCochilo, apagarCochilo,
  cochiloTardio, MADRUGADA_ATE, MAX_COCHILOS, COCHILO_PASSO, COCHILO_MAX, COCHILOS_POR_DIA, SOMA_24H_ATE, COCHILO_LONGO, COCHILO_TARDE, DIAS_COCHILO_LONGO, DIAS_COCHILO_FREQUENTE, COCHILOS_TARDIOS, faixaDaIdade, perfilDeSono, metaDeSono, resumoDaSemana, horaDeDormir, dicasDeSono, painelDeSono,
  fmtHoras, fmtFaixa, horaValida, MAX_NOITES, HORAS_MAX, CARGA_ALTA, AJUSTE, NOITES_PARA_REGULARIDADE, IDADE_MIN, IDADE_MAX, FALTA_MINIMA, ANO_MIN, CAFE_HORAS,
} from '../www/js/logic/sono.js';
import { REFS_SONO, FAQ_SONO, DICAS_SONO, SINAIS_SONO } from '../www/js/data/sono.js';
import { buscarFaq } from '../www/js/data/knowledge.js';
import { PERGUNTAS as P_CORRIDA, respostasCompletas as corridaOk, planoAtual, planoDaSemana } from '../www/js/logic/corrida.js';
import * as store from '../www/js/store.js';

const HOJE = '2026-11-13'; // sexta-feira
const J = (x) => JSON.parse(JSON.stringify(x));
// plano de musculação com treino nos dias dados (0 = domingo); com `vazio`, os dias da agenda não têm exercício
const planoEm = (wds, vazio = false) => ({ plans: [{ id: 'p', dias: [{ id: 'a', itens: vazio ? [] : [{ ex: 'supino-reto-barra' }] }], agenda: Object.fromEntries(wds.map((wd) => [wd, 'a'])) }], activePlan: 'p' });
const plano = (n) => planoEm([1, 2, 3, 4, 5, 6, 0].slice(0, n));
const somaDia = (k, n) => new Date(Date.parse(k + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const estado = (x = {}) => ({ trainer: { answers: {} }, nutri: { answers: {} }, run: { answers: {} }, plans: [], activePlan: '', runs: [], dores: [], sono: sonoPadrao(), ...x });
const comIdade = (idade, x = {}) => estado({ sono: { ...sonoPadrao(), idade }, ...x });
const noites = (horas, fim = HOJE) => horas.map((h, i) => ({ data: new Date(Date.parse(fim + 'T12:00:00Z') - (horas.length - 1 - i) * 86400000).toISOString().slice(0, 10), horas: h })).filter((r) => r.horas != null);
// plano de corrida com prova de 10 km no domingo 15/11/2026 (2 semanas a partir de 2/11)
const corrida = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 2, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
const comCorrida = (answers, x = {}) => estado({ run: { answers, aceitoEm: '2026-11-02T12:00:00.000Z', inicio: '2026-11-02', pausadoEm: '' }, ...x });
const comProva = (x = {}) => comCorrida(corrida, x);

test('meta: faixa e alvo por idade, com as bordas de cada faixa', () => {
  // idade → [mínimo, máximo, alvo (meio da faixa)]; fontes: NSF 2015, AASM 2015 (adultos) e AASM 2016 (6 a 18 anos)
  const esperado = {
    6: [9, 11, 10], 12: [9, 11, 10], 13: [9, 10, 9.5], 14: [8, 10, 9], 17: [8, 10, 9], 18: [8, 9, 8.5], 19: [7, 9, 8], 25: [7, 9, 8], 26: [7, 9, 8], 40: [7, 9, 8], 64: [7, 9, 8], 65: [7, 8, 7.5], 80: [7, 8, 7.5], 99: [7, 8, 7.5],
  };
  for (const [idade, [min, max, alvo]] of Object.entries(esperado)) {
    const m = metaDeSono(comIdade(Number(idade)), HOJE);
    assert.deepEqual([m.min, m.max, m.alvo, m.base, m.ajuste], [min, max, alvo, alvo, 0], `idade ${idade}`);
    assert.equal(m.idade, Number(idade));
    assert.ok(m.motivos.length >= 1 && m.motivos[0].refs.includes('hirshkowitz2015'), 'o primeiro motivo é a idade, com a fonte');
    assert.ok(m.pouco < m.min && m.muito > m.max, 'limites do "não recomendado" ficam fora da faixa');
  }
  // limites do "não recomendado" da National Sleep Foundation
  assert.deepEqual(['pouco', 'muito'].map((k) => metaDeSono(comIdade(15), HOJE)[k]), [7, 11]);
  assert.deepEqual(['pouco', 'muito'].map((k) => metaDeSono(comIdade(22), HOJE)[k]), [6, 11]);
  assert.deepEqual(['pouco', 'muito'].map((k) => metaDeSono(comIdade(40), HOJE)[k]), [6, 10]);
  assert.deepEqual(['pouco', 'muito'].map((k) => metaDeSono(comIdade(70), HOJE)[k]), [5, 9]);
  // aos 13 e aos 18 o texto avisa que é a parte em que os dois consensos concordam
  assert.match(metaDeSono(comIdade(13), HOJE).motivos[0].texto, /dois consensos concordam/);
  assert.match(metaDeSono(comIdade(18), HOJE).motivos[0].texto, /dois consensos concordam/);
  assert.doesNotMatch(metaDeSono(comIdade(30), HOJE).motivos[0].texto, /concordam/);
  // sem idade (ou idade fora do que as fontes cobrem) não há meta
  assert.equal(metaDeSono(estado(), HOJE), null);
  assert.equal(metaDeSono(estado({ trainer: { answers: { idade: 4 } } }), HOJE), null);
  assert.equal(faixaDaIdade(null), null); assert.equal(faixaDaIdade(NaN), null); assert.equal(faixaDaIdade('30'), null); assert.equal(faixaDaIdade(5), null);
  assert.equal(faixaDaIdade(64.9).id, 'adulto'); assert.equal(faixaDaIdade(65).id, 'idoso');
});

test('perfil: de onde vem a idade e o que as entrevistas contam', () => {
  // ordem: Treinador, Nutricionista, corrida; só depois a idade informada na tela do sono
  assert.deepEqual([perfilDeSono(estado({ trainer: { answers: { idade: 20 } }, nutri: { answers: { idade: 30 } }, run: { answers: { idade: 40 } }, sono: { ...sonoPadrao(), idade: 50 } }), HOJE)].map((p) => [p.idade, p.origemIdade]), [[20, 'treinador']]);
  assert.deepEqual([perfilDeSono(estado({ nutri: { answers: { idade: 30 } }, run: { answers: { idade: 40 } }, sono: { ...sonoPadrao(), idade: 50 } }), HOJE)].map((p) => [p.idade, p.origemIdade]), [[30, 'nutricao']]);
  assert.deepEqual([perfilDeSono(estado({ run: { answers: { idade: 40 } }, sono: { ...sonoPadrao(), idade: 50 } }), HOJE)].map((p) => [p.idade, p.origemIdade]), [[40, 'corrida']]);
  assert.deepEqual([perfilDeSono(comIdade(50), HOJE)].map((p) => [p.idade, p.origemIdade]), [[50, 'sono']]);
  assert.deepEqual([perfilDeSono(estado(), HOJE)].map((p) => [p.idade, p.origemIdade]), [[null, '']]);
  // entrada estranha não derruba
  for (const lixo of [null, undefined, 5, 'x', [], {}, { trainer: 3, nutri: [], run: null, plans: 'x', sono: 7, dores: {} }]) {
    const p = perfilDeSono(lixo, HOJE);
    assert.equal(p.idade, null); assert.equal(p.diasDeTreino, 0); assert.equal(p.corrida, null); assert.equal(p.prova, null); assert.equal(metaDeSono(lixo, HOJE), null);
  }
  const p = perfilDeSono(estado({ trainer: { answers: { idade: 16, objetivo: 'emagrecimento', condicoes: ['hipertensao'] } }, nutri: { answers: { objetivo: 'ganhar', horario: 'noite', condicoes: ['gestante', 'nenhuma'] } }, ...plano(3) }), HOJE);
  assert.equal(p.jovem, true); assert.equal(p.idoso, false); assert.equal(p.gestante, true); assert.deepEqual(p.condicoes.sort(), ['gestante', 'hipertensao']);
  assert.equal(p.musculacao, 3); assert.equal(p.diasDeTreino, 3); assert.equal(p.treina, true); assert.equal(p.cargaAlta, false);
  assert.equal(p.adulto, false); assert.equal(perfilDeSono(comIdade(18), HOJE).adulto, true); assert.equal(perfilDeSono(comIdade(60), HOJE).adultoAasm, true); assert.equal(perfilDeSono(comIdade(61), HOJE).adultoAasm, false);
  assert.equal(p.emagrecer, true); assert.equal(p.musculo, true); assert.equal(p.treinaANoite, true);
  // dores ativas entram no perfil
  assert.equal(perfilDeSono(comIdade(30, { dores: [{ id: 'd1', data: '2026-11-10', onde: 'joelho', lado: '', tipo: 'articular', quando: 'durante', nivel: 4, nota: '', fim: '' }] }), HOJE).dores, 1);
});

test('meta: dias de treino, prova, gestação e os motivos de cada perfil', () => {
  // treinar em 5 dias ou mais na semana: o alvo sobe meia hora, sem sair da faixa
  assert.equal(CARGA_ALTA, 5); assert.equal(AJUSTE, 0.5);
  assert.equal(metaDeSono(comIdade(30, plano(4)), HOJE).alvo, 8);
  const alta = metaDeSono(comIdade(30, plano(5)), HOJE);
  assert.deepEqual([alta.min, alta.max, alta.alvo, alta.ajuste], [7, 9, 8.5, 0.5]);
  assert.ok(alta.motivos.some((m) => /treina em 5 dias/.test(m.texto) && m.refs.includes('walsh2021')));
  assert.equal(metaDeSono(comIdade(70, plano(6)), HOJE).alvo, 8, 'a partir dos 65 o alvo para no máximo da faixa');
  assert.equal(metaDeSono(comIdade(13, plano(6)), HOJE).alvo, 10);
  assert.equal(metaDeSono(comIdade(18, plano(6)), HOJE).alvo, 9);
  assert.equal(metaDeSono(comIdade(16, plano(5)), HOJE).alvo, 9.5);
  // dia da agenda sem exercício não é treino; agenda que aponta para dia que não existe também não
  for (const st of [comIdade(30, planoEm([1, 2, 3, 4, 5], true)), comIdade(30, { plans: [{ id: 'p', dias: [], agenda: { 1: 'a', 2: 'a', 3: 'a', 4: 'a', 5: 'a' } }], activePlan: 'p' })]) {
    const v = perfilDeSono(st, HOJE);
    assert.equal(v.musculacao, 0); assert.equal(v.diasDeTreino, 0); assert.equal(v.treina, false);
    const m = metaDeSono(st, HOJE); assert.equal(m.alvo, 8); assert.equal(m.motivos.length, 1);
  }
  // o consenso de adultos da AASM vale até os 60 anos: depois disso a meta cita só a NSF
  assert.ok(metaDeSono(comIdade(60), HOJE).motivos[0].refs.includes('watson2015'));
  assert.deepEqual(metaDeSono(comIdade(61), HOJE).motivos[0].refs, ['hirshkowitz2015']); assert.deepEqual(metaDeSono(comIdade(70), HOJE).motivos[0].refs, ['hirshkowitz2015']);
  // gestação: a faixa é a da idade (inclusive antes dos 18), o alvo não sobe e aparece o aviso do ronco
  const g = metaDeSono(estado({ trainer: { answers: { idade: 30, condicoes: ['gestante'] } }, ...plano(6) }), HOJE);
  assert.deepEqual([g.min, g.max, g.alvo], [7, 9, 8]);
  assert.ok(g.motivos.some((m) => /gestação vale a faixa da idade/.test(m.texto)) && g.avisos.some((a) => /obstetra/.test(a.texto) && a.refs.includes('pamidi2014')));
  assert.deepEqual(['min', 'max', 'alvo'].map((k) => metaDeSono(estado({ trainer: { answers: { idade: 16, condicoes: ['gestante'] } } }), HOJE)[k]), [8, 10, 9]);

  // corrida: contam os dias de corrida da semana ATUAL do plano (ter, qui, sáb, dom)
  assert.equal(corridaOk(corrida), true);
  const p = perfilDeSono(comProva(), '2026-11-10');
  assert.deepEqual(p.corrida, { dias: 4 }); assert.equal(p.diasDeTreino, 4); assert.equal(p.cargaAlta, false);
  assert.equal(p.prova.data, '2026-11-15'); assert.equal(p.prova.dias, 5); assert.equal(p.semanaDeProva, true); assert.equal(p.vesperaDeProva, false);
  // musculação e corrida no mesmo dia valem um dia só: ter/qui/sáb + ter/qui/sáb/dom = 4 dias (e não 7 treinos)
  const mesmoDia = comProva(planoEm([2, 4, 6]));
  const pm = perfilDeSono(mesmoDia, '2026-11-03');
  assert.equal(pm.musculacao, 3); assert.equal(pm.corrida.dias, 4); assert.equal(pm.diasDeTreino, 4); assert.equal(pm.cargaAlta, false);
  assert.equal(metaDeSono(mesmoDia, '2026-11-03').alvo, 8); assert.equal(metaDeSono(mesmoDia, '2026-11-03').motivos.length, 1);
  // em dias diferentes somam: seg/qua + ter/qui/sáb/dom = 6 dias → o alvo sobe
  const seis = comProva(planoEm([1, 3]));
  assert.equal(perfilDeSono(seis, '2026-11-03').diasDeTreino, 6);
  const m6 = metaDeSono(seis, '2026-11-03');
  assert.equal(m6.alvo, 8.5); assert.ok(m6.motivos.some((m) => /treina em 6 dias/.test(m.texto)));
  // plano de corrida que ainda não começou ou que já terminou não soma treino nem sobe o alvo
  assert.equal(planoDaSemana(seis, '2026-11-01').antesDoInicio, true); assert.equal(planoDaSemana(seis, '2026-11-16').concluido, true);
  for (const d of ['2026-10-30', '2026-11-01', '2026-11-16', '2026-12-16', '2027-11-16']) {
    const pf = perfilDeSono(seis, d);
    assert.equal(pf.corrida, null, d); assert.equal(pf.diasDeTreino, 2, d); assert.equal(pf.cargaAlta, false, d);
    const m = metaDeSono(seis, d);
    assert.equal(m.alvo, 8, d); assert.equal(m.motivos.length, 1, d); assert.ok(!dicasDeSono(seis, d).some((x) => x.id === 'cochilo' || x.id === 'prova' || x.id === 'vespera'), d);
  }
  assert.equal(perfilDeSono(seis, '2026-11-16').prova, null); assert.equal(perfilDeSono(seis, '2027-11-16').prova, null);
  // plano de corrida pausado não conta
  const pausado = perfilDeSono(comProva({ run: { answers: corrida, aceitoEm: '2026-11-02T12:00:00.000Z', inicio: '2026-11-02', pausadoEm: '2026-11-05T10:00:00.000Z' } }), '2026-11-10');
  assert.equal(pausado.corrida, null); assert.equal(pausado.prova, null); assert.equal(pausado.diasDeTreino, 0);

  // semana da prova: o alvo sobe dos 7 dias antes até a véspera
  const mp = metaDeSono(comProva(), '2026-11-10');
  assert.equal(mp.alvo, 8.5); assert.ok(mp.motivos.some((m) => /Sua prova é em 5 dias/.test(m.texto) && /sobe meia hora/.test(m.texto) && m.refs.includes('walsh2021')));
  assert.equal(metaDeSono(comProva(), '2026-11-03').alvo, 8, 'a 12 dias da prova e com 4 dias de treino, o alvo é o meio da faixa');
  assert.equal(metaDeSono(comProva(), '2026-11-07').alvo, 8); assert.equal(metaDeSono(comProva(), '2026-11-08').alvo, 8.5, '7 dias antes');
  assert.equal(perfilDeSono(comProva(), '2026-11-14').vesperaDeProva, true);
  assert.ok(metaDeSono(comProva(), '2026-11-14').motivos.some((m) => /Sua prova é amanhã/.test(m.texto)));
  assert.equal(metaDeSono(comProva(), '2026-11-15').alvo, 8, 'no dia da prova a noite já é depois dela');
  assert.equal(metaDeSono(comProva(), '2026-11-16').alvo, 8);
  // carga alta e prova na mesma semana: o alvo sobe uma vez só
  const soma = metaDeSono(seis, '2026-11-10');
  assert.equal(soma.alvo, 8.5); assert.equal(soma.ajuste, 0.5); assert.ok(soma.motivos.length <= 3, 'a meta explica o porquê em poucas linhas');
  // só é "prova" quando o objetivo do plano é uma prova: teste de ritmo e desafio de distância não sobem o alvo nem falam em prova
  const { semanasProva, ...semProva } = corrida;
  const { temAlvo, ...semAlvo } = semProva;
  for (const respostas of [{ ...semProva, objetivo: 'ritmo' }, { ...semAlvo, objetivo: 'distancia' }]) {
    assert.equal(corridaOk(respostas), true, respostas.objetivo);
    const st = comCorrida(respostas);
    const ev = planoAtual(st, '2026-11-03').prova;
    assert.ok(ev && ev.data > '2026-11-03', 'o plano tem um teste ou desafio marcado: ' + respostas.objetivo);
    for (const d of [somaDia(ev.data, -5), somaDia(ev.data, -1)]) {
      const pf = perfilDeSono(st, d);
      assert.equal(pf.prova, null, respostas.objetivo); assert.equal(pf.semanaDeProva, false); assert.equal(pf.vesperaDeProva, false);
      const m = metaDeSono(st, d);
      assert.equal(m.alvo, 8, respostas.objetivo); assert.ok(!m.motivos.some((x) => /prova/i.test(x.texto)));
      assert.ok(!dicasDeSono(st, d).some((x) => x.id === 'prova' || x.id === 'vespera' || /prova/i.test(x.texto)), respostas.objetivo);
    }
  }
  // objetivo, dor e condição de saúde não mexem na meta nem nos motivos: só a idade, a gestação, a carga e a prova
  const dor = [{ id: 'd1', data: '2026-11-10', onde: 'joelho', lado: '', tipo: 'articular', quando: 'durante', nivel: 4, nota: '', fim: '' }];
  for (const st of [estado({ nutri: { answers: { idade: 30, objetivo: 'emagrecer' } } }), estado({ trainer: { answers: { idade: 30, objetivo: 'hipertrofia', condicoes: ['hipertensao'] } } }), comIdade(30, { dores: dor })]) {
    const m = metaDeSono(st, HOJE); assert.equal(m.alvo, 8); assert.equal(m.motivos.length, 1);
  }
  // a faixa nunca muda com o perfil: só a idade a define
  for (const st of [comIdade(30, plano(6)), comProva(), estado({ nutri: { answers: { idade: 30, objetivo: 'emagrecer' } } })]) { const m = metaDeSono(st, '2026-11-10'); assert.deepEqual([m.min, m.max], [7, 9]); }
});

test('validação: lixo, chaves herdadas, datas impossíveis e limites', () => {
  assert.deepEqual(sonoPadrao(), { acordar: '', idade: null, registros: [], cochilos: [] });
  for (const lixo of [null, undefined, 5, 'x', [], [1, 2], true, () => 1]) assert.deepEqual(limparSono(lixo), sonoPadrao());
  const bom = { acordar: '06:30', idade: 34, registros: [{ data: '2026-11-11', horas: 7.5 }, { data: '2026-11-12', horas: 8, qualidade: 4 }], cochilos: [{ data: '2026-11-11', min: 20, inicio: '13:30' }, { data: '2026-11-12', min: 45 }] };
  assert.deepEqual(limparSono(J(bom)), bom);
  assert.deepEqual(limparSono(limparSono(J(bom))), bom, 'validar duas vezes não muda nada');
  // hora de acordar
  for (const ruim of ['24:00', '7:00', '07:60', '0700', '07:00:00', 700, null, '', ' 07:00', '07:00<script>']) assert.equal(limparSono({ acordar: ruim }).acordar, '', JSON.stringify(ruim));
  assert.equal(limparSono({ acordar: '00:00' }).acordar, '00:00'); assert.equal(limparSono({ acordar: '23:59' }).acordar, '23:59');
  assert.equal(horaValida('23:59'), true); assert.equal(horaValida('24:00'), false);
  // idade
  for (const ruim of [5, 100, -3, 0, NaN, Infinity, '30', null, [30], { v: 30 }]) assert.equal(limparSono({ idade: ruim }).idade, null, JSON.stringify(ruim));
  assert.equal(limparSono({ idade: 30.6 }).idade, 31); assert.equal(limparSono({ idade: IDADE_MIN }).idade, 6); assert.equal(limparSono({ idade: IDADE_MAX }).idade, 99);
  // noites
  const noite = (x = {}) => ({ data: '2026-11-12', horas: 7.5, ...x });
  for (const ruim of [null, 5, 'x', [], {}, noite({ data: '2026-02-31' }), noite({ data: '12/11/2026' }), noite({ data: 20261112 }), noite({ data: '2026-13-01' }), noite({ data: '' }), noite({ horas: -0.25 }), noite({ horas: 16.5 }), noite({ horas: NaN }),
    noite({ horas: Infinity }), noite({ horas: '8' }), noite({ horas: null }), { data: '2026-11-12' }, { horas: 8 }]) assert.equal(limparNoite(ruim), null, JSON.stringify(ruim));
  assert.deepEqual(limparNoite(noite({ horas: 7.6 })), noite({ horas: 7.5 }), 'as horas vão para o quarto de hora mais próximo');
  assert.deepEqual(limparNoite(noite({ horas: 7.13 })), noite({ horas: 7.25 }));
  assert.deepEqual(limparNoite(noite({ horas: 0 })), noite({ horas: 0 })); assert.deepEqual(limparNoite(noite({ horas: HORAS_MAX })), noite({ horas: 16 }));
  for (const q of [0, 6, -1, NaN, '4', null, [4]]) assert.equal('qualidade' in limparNoite(noite({ qualidade: q })), false, JSON.stringify(q));
  assert.equal(limparNoite(noite({ qualidade: 1 })).qualidade, 1); assert.equal(limparNoite(noite({ qualidade: 5 })).qualidade, 5); assert.equal(limparNoite(noite({ qualidade: 3.4 })).qualidade, 3);
  assert.deepEqual(Object.keys(limparNoite(noite({ qualidade: 2, extra: '<script>', __proto__: { x: 1 } }))), ['data', 'horas', 'qualidade']);
  // chaves herdadas e poluição de protótipo
  const sujo = JSON.parse('{"__proto__": {"acordar": "07:00", "idade": 30, "polluted": true}, "constructor": {"prototype": {"polluted": true}}, "registros": [{"__proto__": {"data": "2026-11-12", "horas": 8}}, {"data": "2026-11-11", "horas": 7, "__proto__": {"qualidade": 5}}], "extra": 1}');
  const l = limparSono(sujo);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(l, { acordar: '', idade: null, registros: [{ data: '2026-11-11', horas: 7 }], cochilos: [] });
  assert.deepEqual(Object.keys(l), ['acordar', 'idade', 'registros', 'cochilos']);
  assert.deepEqual(limparSono(Object.create({ acordar: '07:00', idade: 30, registros: [{ data: '2026-11-12', horas: 8 }] })), sonoPadrao(), 'o que vem do protótipo não passa');
  assert.deepEqual(limparSono({ registros: 'x' }).registros, []); assert.deepEqual(limparSono({ registros: { 0: { data: '2026-11-12', horas: 8 } } }).registros, []);
  // uma noite por dia (vale a última), em ordem de data
  const rep = limparSono({ registros: [{ data: '2026-11-12', horas: 6 }, { data: '2026-11-10', horas: 7 }, { lixo: 1 }, { data: '2026-11-12', horas: 9, qualidade: 2 }] }).registros;
  assert.deepEqual(rep, [{ data: '2026-11-10', horas: 7 }, { data: '2026-11-12', horas: 9, qualidade: 2 }]);
  // limite: ficam as noites mais recentes
  const base = Date.parse('2020-01-01T12:00:00Z');
  const muitas = Array.from({ length: MAX_NOITES + 400 }, (_, i) => ({ data: new Date(base + i * 86400000).toISOString().slice(0, 10), horas: 8 }));
  const cortado = limparSono({ registros: muitas }).registros;
  assert.equal(cortado.length, MAX_NOITES); assert.equal(cortado[cortado.length - 1].data, muitas[muitas.length - 1].data); assert.equal(cortado[0].data, muitas[400].data);
  assert.ok(limparSono({ registros: Array.from({ length: 50000 }, () => ({ data: '2026-11-12', horas: 8 })) }).registros.length <= 1);
  // datas: nada no futuro (só até amanhã, pela diferença de fuso) nem antes de ANO_MIN
  assert.equal(ANO_MIN, 2000);
  assert.deepEqual(limparNoite(noite({ data: HOJE }), HOJE), noite({ data: HOJE })); assert.deepEqual(limparNoite(noite({ data: somaDia(HOJE, 1) }), HOJE), noite({ data: somaDia(HOJE, 1) }));
  for (const d of [somaDia(HOJE, 2), '2027-01-01', '2999-12-31', '9999-12-31', '1999-12-31', '1900-01-01', '0001-01-01']) assert.equal(limparNoite(noite({ data: d }), HOJE), null, d);
  assert.deepEqual(limparNoite(noite({ data: '2000-01-01' }), HOJE), noite({ data: '2000-01-01' }));
  assert.equal(limparNoite(noite({ data: '2999-12-31' })), null, 'sem informar o dia, vale o relógio do aparelho');
  assert.deepEqual(limparSono({ registros: [noite({ data: '2031-05-05' }), noite({ data: '2026-11-10' })] }, HOJE).registros.map((x) => x.data), ['2026-11-10']);
  assert.equal(gravarNoite(sonoPadrao(), noite({ data: somaDia(HOJE, 2) }), HOJE), null);
  // sem corte de futuro (para carregar os dados com o relógio do aparelho atrasado): por opção ou com hoje = '9999-12-31'
  const futuro = { acordar: '06:30', idade: 30, registros: [noite({ data: '2026-11-10' }), noite({ data: '2031-05-05' }), noite({ data: '9999-12-31', horas: 6 })], cochilos: [{ data: '2026-11-10', min: 20 }, { data: '2040-01-01', min: 30, inicio: '14:00' }] };
  assert.deepEqual(limparSono(J(futuro), HOJE).registros.length, 1); assert.deepEqual(limparSono(J(futuro), HOJE).cochilos.length, 1);
  for (const limpo of [limparSono(J(futuro), '9999-12-31'), limparSono(J(futuro), HOJE, { semCorteDeFuturo: true }), limparSono(J(futuro), undefined, { semCorteDeFuturo: true }), limparSono(J(futuro), { semCorteDeFuturo: true })]) assert.deepEqual(limpo, futuro, 'nada é recusado por ser futuro');
  assert.deepEqual(limparNoite(noite({ data: '2999-01-01' }), HOJE, { semCorteDeFuturo: true }), noite({ data: '2999-01-01' })); assert.deepEqual(limparNoite(noite({ data: '2999-01-01' }), '9999-12-31'), noite({ data: '2999-01-01' }));
  assert.equal(limparNoite(noite({ data: '1999-12-31' }), HOJE, { semCorteDeFuturo: true }), null, 'o piso de ano continua valendo'); assert.equal(limparNoite(noite({ data: '2026-02-31' }), '9999-12-31'), null);
  assert.equal(limparSono(J(futuro), HOJE, { semCorteDeFuturo: false }).registros.length, 1); assert.equal(limparSono(J(futuro), HOJE, { semCorteDeFuturo: 'sim' }).registros.length, 1, 'só o valor true liga a opção');
  assert.ok(limparSono({ registros: Array.from({ length: 5000 }, (_, i) => noite({ data: somaDia('2026-01-01', i) })) }, '9999-12-31').registros.length === MAX_NOITES, 'sem corte de futuro o limite de registros continua');
  // lista longa com as noites mais recentes no fim (e fora de ordem): ficam as MAX_NOITES mais recentes, não as primeiras
  const velhas = Array.from({ length: 7000 }, (_, i) => ({ data: somaDia('2000-01-01', i), horas: 6 }));
  const novas = Array.from({ length: 10 }, (_, i) => ({ data: somaDia(HOJE, -i), horas: 8 }));
  const longa = limparSono({ registros: [...velhas, ...novas] }, HOJE).registros;
  assert.equal(longa.length, MAX_NOITES); assert.equal(longa[longa.length - 1].data, HOJE); assert.equal(longa.filter((x) => x.horas === 8).length, 10);
  assert.equal(longa[0].data, somaDia('2000-01-01', 7000 - (MAX_NOITES - 10)));
  // pela validação geral do estado (backup importado)
  const s = store.sanitize({ sono: { acordar: '05:45', idade: 200, registros: [{ data: '2026-11-12', horas: 99 }, { data: '2026-11-11', horas: 6.25, qualidade: 9 }] } });
  assert.deepEqual(s.sono, { acordar: '05:45', idade: null, registros: [{ data: '2026-11-11', horas: 6.25 }], cochilos: [] });
  assert.deepEqual(store.sanitize({}).sono, sonoPadrao());
});

test('registro: gravar, corrigir, apagar e consultar a noite de um dia', () => {
  const sono = sonoPadrao();
  assert.deepEqual(gravarNoite(sono, { data: '2026-11-12', horas: 7 }), { data: '2026-11-12', horas: 7 });
  gravarNoite(sono, { data: '2026-11-10', horas: 6.5, qualidade: 2 });
  assert.equal(gravarNoite(sono, { data: '2026-11-31', horas: 7 }), null); assert.equal(gravarNoite(sono, { data: '2026-11-11', horas: 40 }), null); assert.equal(gravarNoite(null, { data: '2026-11-11', horas: 7 }), null);
  assert.deepEqual(sono.registros.map((r) => r.data), ['2026-11-10', '2026-11-12']);
  gravarNoite(sono, { data: '2026-11-12', horas: 8.25, qualidade: 5 }); // corrigir não duplica
  assert.deepEqual(sono.registros, [{ data: '2026-11-10', horas: 6.5, qualidade: 2 }, { data: '2026-11-12', horas: 8.25, qualidade: 5 }]);
  assert.deepEqual(noiteDe({ sono }, '2026-11-12'), { data: '2026-11-12', horas: 8.25, qualidade: 5 }); assert.equal(noiteDe({ sono }, '2026-11-11'), null); assert.equal(noiteDe(null, '2026-11-11'), null);
  assert.equal(apagarNoite(sono, '2026-11-12'), true); assert.equal(apagarNoite(sono, '2026-11-12'), false); assert.equal(apagarNoite(null, 'x'), false);
  assert.deepEqual(sono.registros.map((r) => r.data), ['2026-11-10']);
  for (let i = 0; i < MAX_NOITES + 20; i++) gravarNoite(sono, { data: new Date(Date.parse('2021-01-01T12:00:00Z') + i * 86400000).toISOString().slice(0, 10), horas: 8 });
  assert.equal(sono.registros.length, MAX_NOITES);
});

test('semana: média de 7 dias, noites abaixo da faixa, variação e avisos', () => {
  const st = (horas, idade = 30, x = {}) => comIdade(idade, { sono: { acordar: '', idade, registros: noites(horas) }, ...x });
  let r = resumoDaSemana(st([7, 8, 6, 9, 7.5, 6.5, 8]), HOJE);
  assert.equal(r.dias.length, 7); assert.equal(r.dias[0].data, '2026-11-07'); assert.equal(r.dias[6].data, HOJE); assert.deepEqual(r.dias.map((d) => d.wd), [6, 0, 1, 2, 3, 4, 5]);
  assert.equal(r.n, 7); assert.equal(fmtHoras(r.media), '7 h 26'); assert.ok(Math.abs(r.media - 52 / 7) < 0.01); assert.equal(r.abaixo, 2); assert.equal(r.dentro, 5); assert.equal(r.acima, 0); assert.equal(r.faltaMin, 0);
  assert.deepEqual(r.dias.map((d) => d.estado), ['dentro', 'dentro', 'abaixo', 'dentro', 'dentro', 'abaixo', 'dentro']);
  assert.equal(r.desvioMin, 61); assert.equal(r.regularidade, 'variavel'); // desvio-padrão da amostra: 1,018 h
  assert.deepEqual(r.ultima, { data: HOJE, horas: 8 }); assert.equal(r.avisos.length, 0);
  // noites iguais: regular; variação grande: irregular
  r = resumoDaSemana(st([7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5]), HOJE);
  assert.equal(r.desvioMin, 0); assert.equal(r.regularidade, 'regular'); assert.equal(r.media, 7.5);
  r = resumoDaSemana(st([4, 10, 5, 9.5, 4.5, 10, 5]), HOJE);
  assert.ok(r.desvioMin > 120); assert.equal(r.regularidade, 'irregular'); assert.equal(r.acima, 3); assert.equal(r.abaixo, 4);
  // menos de 5 noites: há média, mas não se mede a variação nem se dá aviso de média
  assert.equal(NOITES_PARA_REGULARIDADE, 5);
  r = resumoDaSemana(st([null, null, null, 5, 5, 5, 5]), HOJE);
  assert.equal(r.n, 4); assert.equal(r.media, 5); assert.equal(r.desvioMin, null); assert.equal(r.regularidade, null); assert.equal(r.faltaMin, 120); assert.equal(r.avisos.length, 0);
  // média abaixo do "não recomendado" (6 h para adultos; 7 h para adolescentes) e acima dele
  r = resumoDaSemana(st([5, 5.5, 5, 6, 5.5, 5, 5.5]), HOJE);
  assert.equal(r.avisos.length, 1); assert.match(r.avisos[0].texto, /abaixo de 6 horas/); assert.ok(r.avisos[0].refs.includes('watson2015'));
  r = resumoDaSemana(st([6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5]), HOJE); assert.equal(r.avisos.length, 0); assert.equal(r.faltaMin, 30);
  r = resumoDaSemana(st([6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5], 15), HOJE); assert.match(r.avisos[0].texto, /abaixo de 7 horas/); assert.ok(r.avisos[0].refs.includes('paruthi2016'));
  r = resumoDaSemana(st([11, 10.5, 11, 10.5, 11, 10.5, 11]), HOJE); assert.match(r.avisos[0].texto, /passou de 10 horas/); assert.equal(r.avisos[0].tipo, 'info');
  // o aviso de média só cita o consenso de adultos da AASM até os 60 anos
  assert.ok(resumoDaSemana(st([5, 5.5, 5, 6, 5.5, 5, 5.5], 60), HOJE).avisos[0].refs.includes('watson2015'));
  for (const idade of [61, 64, 70]) { const a = resumoDaSemana(st([4, 4.5, 4, 4, 4.5, 4, 4], idade), HOJE).avisos[0]; assert.match(a.texto, /abaixo de [56] horas/); assert.ok(!a.refs.includes('watson2015'), 'idade ' + idade); }
  // "faltou sono": pede 5 noites e a média pelo menos 15 minutos abaixo do mínimo
  assert.equal(FALTA_MINIMA, 15);
  assert.equal(resumoDaSemana(st([7, 7, 6.75]), HOJE).faltou, false, 'três noites quase na faixa não dizem que faltou sono');
  assert.equal(resumoDaSemana(st([null, null, null, 5, 5, 5, 5]), HOJE).faltou, false, 'quatro noites ainda é pouco');
  assert.equal(resumoDaSemana(st([7, 7, 7, 7, 6.5, 7, 7]), HOJE).faltou, false, 'média 4 minutos abaixo não conta');
  assert.equal(resumoDaSemana(st([7, 7, 6.5, 7, 6.5]), HOJE).faltou, false, 'média 12 minutos abaixo não conta');
  assert.equal(resumoDaSemana(st([7, 6.5, 6.5, 7, 6.5]), HOJE).faltou, true, 'média 18 minutos abaixo, em 5 noites');
  assert.equal(resumoDaSemana(st([6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5]), HOJE).faltou, true);
  assert.equal(resumoDaSemana(estado({ sono: { acordar: '', idade: null, registros: noites([5, 5, 5, 5, 5, 5, 5]) } }), HOJE).faltou, false, 'sem meta não há o que faltar');
  // acordar cansado em 3 noites ou mais
  const cansado = st([7, 7, 7, 7, 7, 7, 7]); cansado.sono.registros.forEach((x, i) => { if (i < 3) x.qualidade = 2; else x.qualidade = 4; });
  r = resumoDaSemana(cansado, HOJE); assert.equal(r.cansado, 3); assert.ok(r.avisos.some((a) => /acordou cansado em 3 noites/.test(a.texto) && a.refs.includes('kapur2017')));
  // noites fora da janela (antes dos 7 dias e no futuro) não entram
  const fora = st([8, 8, 8]); fora.sono.registros.push({ data: '2026-11-01', horas: 2 }, { data: '2026-11-20', horas: 2 });
  r = resumoDaSemana(fora, HOJE); assert.equal(r.n, 3); assert.equal(r.media, 8);
  // sem idade: os dias aparecem, sem classificação; data inválida: vazio
  r = resumoDaSemana(estado({ sono: { acordar: '', idade: null, registros: noites([7, 8]) } }), HOJE);
  assert.equal(r.meta, null); assert.equal(r.n, 2); assert.equal(r.media, 7.5); assert.deepEqual(r.dias.map((d) => d.estado).filter(Boolean), []);
  assert.deepEqual(resumoDaSemana(st([7, 8]), '2026-02-31').dias, []); assert.equal(resumoDaSemana(null, HOJE).n, 0);
});

test('cochilos: validação, limites, soma por dia, gravar, corrigir e apagar', () => {
  assert.deepEqual([COCHILO_PASSO, COCHILO_MAX, COCHILOS_POR_DIA, MAX_COCHILOS], [5, 240, 4, 3000]);
  const c = (x = {}) => ({ data: '2026-11-12', min: 20, ...x });
  assert.deepEqual(limparCochilo(c({ inicio: '14:10' }), HOJE), c({ inicio: '14:10' }));
  assert.deepEqual(limparCochilo(c({ min: 22 }), HOJE), c({ min: 20 }), 'os minutos vão para o múltiplo de 5 mais próximo');
  assert.deepEqual(limparCochilo(c({ min: 23 }), HOJE), c({ min: 25 })); assert.deepEqual(limparCochilo(c({ min: 240 }), HOJE), c({ min: 240 })); assert.deepEqual(limparCochilo(c({ min: 5 }), HOJE), c({ min: 5 }));
  for (const ruim of [null, 5, 'x', [], {}, c({ min: 0 }), c({ min: 2 }), c({ min: -20 }), c({ min: 245 }), c({ min: 9999 }), c({ min: NaN }), c({ min: Infinity }), c({ min: '20' }), c({ min: null }), { data: '2026-11-12' }, { min: 20 },
    c({ data: '2026-02-31' }), c({ data: '12/11/2026' }), c({ data: 20261112 }), c({ data: somaDia(HOJE, 2) }), c({ data: '1999-12-31' }), c({ data: '9999-01-01' })]) assert.equal(limparCochilo(ruim, HOJE), null, JSON.stringify(ruim));
  for (const hora of ['24:00', '7:00', '14:60', 1410, null, '', '14:10<b>']) assert.equal('inicio' in limparCochilo(c({ inicio: hora }), HOJE), false, JSON.stringify(hora));
  assert.deepEqual(Object.keys(limparCochilo(c({ inicio: '09:00', extra: '<script>', __proto__: { x: 1 } }), HOJE)), ['data', 'min', 'inicio']);
  assert.equal(limparCochilo(JSON.parse('{"__proto__": {"data": "2026-11-12", "min": 20}}'), HOJE), null, 'o que vem do protótipo não passa');
  // lista: lixo fora, ordem por dia e hora (sem hora no fim), até 4 por dia, as mais recentes quando passa do limite
  assert.deepEqual(limparSono({ cochilos: 'x' }, HOJE).cochilos, []); assert.deepEqual(limparSono({ cochilos: { 0: c() } }, HOJE).cochilos, []);
  const lista = limparSono({ cochilos: [c({ min: 30 }), { lixo: 1 }, c({ data: '2026-11-10', inicio: '15:00' }), c({ inicio: '16:30', min: 10 }), c({ inicio: '13:00', min: 15 }), c({ data: '2031-01-01' })] }, HOJE).cochilos;
  assert.deepEqual(lista, [{ data: '2026-11-10', min: 20, inicio: '15:00' }, { data: '2026-11-12', min: 15, inicio: '13:00' }, { data: '2026-11-12', min: 10, inicio: '16:30' }, { data: '2026-11-12', min: 30 }]);
  assert.deepEqual(limparSono({ cochilos: J(lista) }, HOJE).cochilos, lista, 'validar duas vezes não muda nada');
  assert.equal(limparSono({ cochilos: Array.from({ length: 9 }, (_, i) => c({ min: 5 + 5 * i })) }, HOJE).cochilos.length, COCHILOS_POR_DIA);
  const velhos = Array.from({ length: 4000 }, (_, i) => ({ data: somaDia('2010-01-01', i), min: 30 }));
  const cortado = limparSono({ cochilos: [...velhos, c({ data: HOJE, min: 60 })] }, HOJE).cochilos;
  assert.equal(cortado.length, MAX_COCHILOS); assert.deepEqual(cortado[cortado.length - 1], { data: HOJE, min: 60 }); assert.equal(cortado[0].data, somaDia('2010-01-01', 4000 - (MAX_COCHILOS - 1)));
  assert.deepEqual(store.sanitize({ sono: { cochilos: [c({ min: 500 }), c({ min: 33, inicio: '99:00' })] } }).sono.cochilos, [{ data: '2026-11-12', min: 35 }]);
  // gravar, somar por dia, corrigir pelo índice do dia e apagar
  const sono = sonoPadrao();
  assert.deepEqual(gravarCochilo(sono, c({ inicio: '14:00' }), HOJE), c({ inicio: '14:00' }));
  gravarCochilo(sono, c({ min: 40 }), HOJE); gravarCochilo(sono, c({ data: '2026-11-13', min: 15, inicio: '13:10' }), HOJE); gravarCochilo(sono, c({ inicio: '12:30', min: 10 }), HOJE);
  assert.deepEqual(cochilosDe({ sono }, '2026-11-12'), [c({ inicio: '12:30', min: 10 }), c({ inicio: '14:00' }), c({ min: 40 })]);
  assert.equal(minutosDeCochilo({ sono }, '2026-11-12'), 70); assert.equal(minutosDeCochilo({ sono }, '2026-11-13'), 15); assert.equal(minutosDeCochilo({ sono }, '2026-11-11'), 0); assert.equal(minutosDeCochilo(null, HOJE), 0);
  assert.equal(gravarCochilo(sono, c({ min: 0 }), HOJE), null); assert.equal(gravarCochilo(sono, c({ data: somaDia(HOJE, 3) }), HOJE), null); assert.equal(gravarCochilo(null, c(), HOJE), null);
  gravarCochilo(sono, c({ min: 25 }), HOJE);
  assert.equal(gravarCochilo(sono, c({ min: 5 }), HOJE), null, 'o quinto cochilo do dia é recusado'); assert.equal(cochilosDe({ sono }, '2026-11-12').length, 4);
  assert.deepEqual(gravarCochilo(sono, c({ min: 35, inicio: '14:05' }), HOJE, 1), c({ min: 35, inicio: '14:05' }), 'corrigir troca o cochilo, mesmo com o dia cheio');
  assert.deepEqual(cochilosDe({ sono }, '2026-11-12').map((x) => x.min), [10, 35, 40, 25]); assert.equal(minutosDeCochilo({ sono }, '2026-11-12'), 110);
  assert.equal(gravarCochilo(sono, c(), HOJE, 9), null, 'índice que não existe');
  assert.equal(apagarCochilo(sono, '2026-11-12', 0), true); assert.deepEqual(cochilosDe({ sono }, '2026-11-12').map((x) => x.min), [35, 40, 25]);
  assert.equal(apagarCochilo(sono, '2026-11-12', 7), false); assert.equal(apagarCochilo(sono, '2026-11-01', 0), false); assert.equal(apagarCochilo(null, HOJE, 0), false); assert.equal(apagarCochilo(sono, '2026-11-12', -1), false);
  assert.equal(sono.cochilos.length, 4); assert.deepEqual(limparSono(J(sono), HOJE).cochilos, sono.cochilos, 'o que a tela grava passa inteiro pela validação');
});

test('cochilos e a meta: soma em 24 horas até os 18 anos; à parte nos adultos', () => {
  assert.equal(SOMA_24H_ATE, 18);
  for (const [idade, soma] of [[6, true], [13, true], [17, true], [18, true], [19, false], [30, false], [70, false]]) assert.equal(metaDeSono(comIdade(idade), HOJE).soma24h, soma, 'idade ' + idade);
  assert.match(metaDeSono(comIdade(16), HOJE).motivos[0].texto, /de 8 a 10 h por dia: os cochilos contam\./);
  assert.match(metaDeSono(comIdade(30), HOJE).motivos[0].texto, /de 7 a 9 h por noite\./);
  const com = (idade, horas, cochilos) => comIdade(idade, { sono: { acordar: '', idade, registros: noites(horas), cochilos } });
  const ck = [{ data: HOJE, min: 60, inicio: '14:00' }, { data: HOJE, min: 30 }, { data: somaDia(HOJE, -1), min: 45, inicio: '16:30' }, { data: somaDia(HOJE, -9), min: 200 }, { data: somaDia(HOJE, 1), min: 200 }];
  // 16 anos: 7 h de noite + 1 h 30 de cochilo = 8 h 30 → dentro da faixa de 8 a 10 h; sem cochilo, 7 h → abaixo
  let r = resumoDaSemana(com(16, [7, 7, 7, 7, 7, 7.25, 7], ck), HOJE);
  assert.equal(r.soma24h, true);
  assert.deepEqual(r.dias.map((d) => d.cochiloMin), [0, 0, 0, 0, 0, 45, 90]); assert.deepEqual(r.dias.map((d) => d.cochilos), [0, 0, 0, 0, 0, 1, 2]);
  assert.deepEqual(r.dias.map((d) => d.total), [7, 7, 7, 7, 7, 8, 8.5]); assert.deepEqual(r.dias.map((d) => d.estado), ['abaixo', 'abaixo', 'abaixo', 'abaixo', 'abaixo', 'dentro', 'dentro']);
  assert.equal(r.abaixo, 5); assert.equal(r.dentro, 2);
  assert.equal(fmtHoras(r.media), '7 h 02'); assert.equal(fmtHoras(r.media24), '7 h 21'); assert.equal(r.mediaDaMeta, r.media24);
  assert.equal(r.faltaMin, 39); assert.equal(r.faltou, true);
  assert.deepEqual(r.cochilo, { dias: 2, n: 3, totalMin: 135, mediaMin: 68, longos: 1, tardios: 1, semNoite: 0 }, 'cochilos fora dos 7 dias (antes e depois) não entram');
  assert.match(dicasDeSono(com(16, [7, 7, 7, 7, 7, 7.25, 7], ck), HOJE)[0].texto, /Sua média, com os cochilos, foi de 7 h 21 em 7 noites, abaixo do mínimo de 8 h\./);
  // os mesmos registros aos 30 anos: a meta é a da noite; o cochilo não muda o estado nem a média comparada
  r = resumoDaSemana(com(30, [7, 7, 7, 7, 7, 6.5, 6.5], ck), HOJE);
  assert.equal(r.soma24h, false); assert.deepEqual(r.dias.map((d) => d.estado).slice(5), ['abaixo', 'abaixo']); assert.deepEqual(r.dias.map((d) => d.total).slice(5), [7.25, 8]);
  assert.equal(r.mediaDaMeta, r.media); assert.equal(fmtHoras(r.media), '6 h 51'); assert.equal(fmtHoras(r.media24), '7 h 11'); assert.equal(r.faltaMin, 9); assert.equal(r.cochilo.totalMin, 135);
  // dia com cochilo e sem noite registrada: o cochilo aparece, mas não há total nem estado
  r = resumoDaSemana(com(16, [null, null, null, null, null, null, 8], [{ data: somaDia(HOJE, -2), min: 30 }]), HOJE);
  assert.deepEqual([r.dias[4].cochiloMin, r.dias[4].total, r.dias[4].estado, r.dias[4].horas], [30, null, '', null]); assert.equal(r.n, 1); assert.equal(r.media24, 8); assert.equal(r.cochilo.dias, 1);
  // 15 anos, 5 noites de 7 h e 2 cochilos de 2 h em dias SEM noite: esses cochilos não entram na média em 24 horas
  r = resumoDaSemana(com(15, [null, null, 7, 7, 7, 7, 7], [{ data: somaDia(HOJE, -6), min: 120 }, { data: somaDia(HOJE, -5), min: 120 }]), HOJE);
  assert.equal(r.media24, 7); assert.equal(r.faltou, true); assert.equal(r.cochilo.dias, 2); assert.equal(r.cochilo.semNoite, 2);
  assert.equal(resumoDaSemana(com(15, [null, 7, 7, 7, 7, 7, 7], [{ data: somaDia(HOJE, -6), min: 120 }, { data: somaDia(HOJE, -5), min: 120 }]), HOJE).cochilo.semNoite, 1);
  // aviso de média: até os 18 anos conta noite + cochilo (6 h 30 + 1 h = 7 h 30 não é "abaixo de 7 horas")
  const sete = (min) => Array.from({ length: 7 }, (_, i) => ({ data: somaDia(HOJE, -i), min }));
  assert.equal(resumoDaSemana(com(15, [6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5], sete(60)), HOJE).avisos.length, 0);
  assert.match(resumoDaSemana(com(15, [6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5], []), HOJE).avisos[0].texto, /abaixo de 7 horas/);
  assert.match(resumoDaSemana(com(30, [5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5], sete(60)), HOJE).avisos[0].texto, /abaixo de 6 horas/, 'no adulto o cochilo não entra na média comparada');
  // sem cochilos e com lixo no lugar da lista
  r = resumoDaSemana(comIdade(30, { sono: { acordar: '', idade: 30, registros: noites([8, 8, 8]), cochilos: [null, 5, { data: HOJE }, { data: HOJE, min: 'x' }, { data: 'x', min: 20 }, { data: HOJE, min: 9999 }] } }), HOJE);
  assert.deepEqual(r.cochilo, { dias: 0, n: 0, totalMin: 0, mediaMin: 0, longos: 0, tardios: 0, semNoite: 0 }); assert.equal(r.media24, 8);
  assert.deepEqual(resumoDaSemana(null, HOJE).cochilo, { dias: 0, n: 0, totalMin: 0, mediaMin: 0, longos: 0, tardios: 0, semNoite: 0 });
});

test('cochilos e saúde: limites das dicas, por idade e gestação', () => {
  assert.deepEqual([COCHILO_LONGO, COCHILO_TARDE, DIAS_COCHILO_LONGO, DIAS_COCHILO_FREQUENTE, COCHILOS_TARDIOS], [60, '16:00', 3, 5, 2]);
  const ids = (st) => dicasDeSono(st, HOJE).map((d) => d.id);
  const em = (dias, min, inicio) => dias.map((i) => ({ data: somaDia(HOJE, -i), min, ...(inicio ? { inicio } : {}) }));
  const com = (idade, horas, cochilos, x = {}) => comIdade(idade, { sono: { acordar: '', idade, registros: noites(horas), cochilos }, ...x });
  const oito = [8, 8, 8, 8, 8, 8, 8];
  // cochilo longo: 60 min ou mais no dia, em 3 dias ou mais
  assert.ok(ids(com(30, oito, em([0, 1, 2], 60))).includes('cochiloLongo'));
  assert.ok(!ids(com(30, oito, em([0, 1], 60))).includes('cochiloLongo'), 'dois dias não bastam');
  assert.ok(!ids(com(30, oito, em([0, 1, 2], 55))).includes('cochiloLongo'), '55 minutos não é cochilo longo');
  assert.ok(ids(com(30, oito, [...em([0, 1, 2], 30), ...em([0, 1, 2], 30, '15:00')])).includes('cochiloLongo'), 'dois cochilos de 30 min no mesmo dia somam 60');
  // só adultos a partir de 19 anos e não gestantes (os estudos são com adultos; não há estudo na gestação)
  for (const idade of [12, 16, 18]) assert.ok(!ids(com(idade, [9, 9, 9, 9, 9, 9, 9], em([0, 1, 2, 3, 4, 5, 6], 90))).some((x) => x === 'cochiloLongo' || x === 'cochiloFrequente'), 'idade ' + idade);
  assert.ok(ids(com(19, oito, em([0, 1, 2], 90))).includes('cochiloLongo')); assert.ok(ids(com(70, [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5], em([0, 1, 2], 90))).includes('cochiloLongo'));
  const gestante = estado({ trainer: { answers: { idade: 30, condicoes: ['gestante'] } }, sono: { acordar: '', idade: null, registros: noites(oito), cochilos: em([0, 1, 2, 3, 4, 5, 6], 90) } });
  assert.ok(!ids(gestante).some((x) => x === 'cochiloLongo' || x === 'cochiloFrequente'));
  // cochilo quase todo dia (5 de 7) com a noite na faixa: pode ser sinal de muito sono de dia
  assert.ok(ids(com(30, oito, em([0, 1, 2, 3, 4], 20))).includes('cochiloFrequente'));
  assert.ok(!ids(com(30, oito, em([0, 1, 2, 3], 20))).includes('cochiloFrequente'), 'quatro dias não é quase todo dia');
  assert.ok(!ids(com(30, [8, 8, 8], em([0, 1, 2, 3, 4], 20))).includes('cochiloFrequente'), 'com poucas noites registradas não dá para dizer');
  assert.ok(!ids(com(30, oito, em([0, 1, 2, 3, 4], 60))).includes('cochiloFrequente'), 'com cochilos longos, vale a dica dos longos');
  const d = dicasDeSono(com(30, oito, em([0, 1, 2, 3, 4], 20)), HOJE).find((x) => x.id === 'cochiloFrequente');
  assert.ok(d.refs.includes('kapur2017') && /procurar avaliação/.test(d.texto) && d.tom === 'atencao');
  // noite curta + cochilos em 3 dias ou mais: o cochilo não repõe a noite (e a sugestão de cochilar some)
  const curta = ids(com(30, [6, 6, 6, 6, 6, 6, 6], em([0, 1, 2], 20)));
  assert.deepEqual(curta.slice(0, 2), ['faltou', 'cochiloNoite']); assert.ok(!curta.includes('cochilo') && !curta.includes('cochiloFrequente'));
  assert.ok(ids(com(30, [6, 6, 6, 6, 6, 6, 6], em([0], 20))).includes('cochilo'), 'com um cochilo só, a sugestão de cochilo curto continua');
  // cochilo tarde: termina depois das 16 h (início + duração) ou começa de madrugada; a janela das fontes é das 13 h às 16 h
  assert.equal(MADRUGADA_ATE, '05:00');
  const tardio = (inicio, min) => cochiloTardio({ data: HOJE, min, ...(inicio ? { inicio } : {}) });
  for (const [inicio, min] of [['15:30', 90], ['15:45', 20], ['16:00', 5], ['17:00', 20], ['23:30', 20], ['00:00', 20], ['00:30', 20], ['04:55', 10], ['12:00', 245], ['13:00', 185]]) assert.equal(tardio(inicio, min), true, inicio + ' + ' + min);
  for (const [inicio, min] of [['15:40', 20], ['13:00', 180], ['14:00', 60], ['05:00', 20], ['09:00', 30], ['12:30', 30], ['', 240], [null, 20], ['25:00', 20]]) assert.equal(tardio(inicio, min), false, inicio + ' + ' + min);
  assert.equal(cochiloTardio(null), false); assert.equal(cochiloTardio({ inicio: '18:00' }), false);
  assert.equal(resumoDaSemana(com(30, oito, [{ data: HOJE, min: 90, inicio: '15:30' }, { data: HOJE, min: 20, inicio: '15:40' }, { data: somaDia(HOJE, -1), min: 20, inicio: '00:30' }, { data: somaDia(HOJE, -2), min: 60 }]), HOJE).cochilo.tardios, 2);
  // a dica pede dois cochilos tardios; sem hora informada não há como saber
  assert.ok(ids(com(30, oito, em([0, 1], 20, '16:00'))).includes('cochiloTarde')); assert.ok(ids(com(30, oito, em([0, 1], 90, '15:30'))).includes('cochiloTarde')); assert.ok(ids(com(30, oito, em([0, 1], 20, '00:30'))).includes('cochiloTarde'));
  assert.ok(!ids(com(30, oito, em([0, 1], 20, '15:40'))).includes('cochiloTarde')); assert.ok(!ids(com(30, oito, em([0], 20, '17:00'))).includes('cochiloTarde')); assert.ok(!ids(com(30, oito, em([0, 1, 2], 20))).includes('cochiloTarde'));
  assert.match(DICAS_SONO.cochiloTarde.texto, /das 13 h às 16 h.*termina depois disso/);
  // nenhuma dica de cochilo para menores (até 18 anos, em quem o cochilo soma à meta) nem para gestantes: as fontes são de adultos
  const DE_COCHILO = ['cochilo', 'cochiloLongo', 'cochiloFrequente', 'cochiloTarde', 'cochiloNoite', 'semCochilo'];
  const semDicaDeCochilo = (st, quem) => assert.deepEqual(ids(st).filter((x) => DE_COCHILO.includes(x)), [], quem);
  for (const idade of [6, 12, 15, 18]) {
    const nove = [9, 9, 9, 9, 9, 9, 9];
    semDicaDeCochilo(com(idade, nove, em([0, 1], 20, '18:30')), idade + ' anos, cochilo tarde');
    semDicaDeCochilo(com(idade, [6, 6, 6, 6, 6, 6, 6], em([0], 20), plano(6)), idade + ' anos, noite curta e treino em 6 dias');
    const ruim = com(idade, idade === 18 ? [8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5] : nove, em([0], 20), plano(6)); ruim.sono.registros.forEach((x) => { x.qualidade = 1; });
    assert.ok(ids(ruim).includes('acordado'), 'a dica de quem acorda cansado continua'); semDicaDeCochilo(ruim, idade + ' anos, acorda cansado e cochila');
  }
  const gravida = (horas, cochilos, q) => { const st = estado({ trainer: { answers: { idade: 30, condicoes: ['gestante'] } }, ...plano(6), sono: { acordar: '', idade: null, registros: noites(horas), cochilos } }); if (q) st.sono.registros.forEach((x) => { x.qualidade = q; }); return st; };
  semDicaDeCochilo(gravida(oito, em([0, 1], 20, '18:30')), 'gestante, cochilo tarde'); semDicaDeCochilo(gravida([6, 6, 6, 6, 6, 6, 6], em([0, 1, 2], 20)), 'gestante, noite curta');
  semDicaDeCochilo(gravida(oito, em([0], 20), 1), 'gestante, acorda cansada e cochila'); semDicaDeCochilo(gravida(oito, []), 'gestante, treino em 6 dias');
  // "evite o cochilo" não aparece junto com nenhuma outra dica de cochilo (seriam contraditórias)
  const cansadoCom = (idade, cochilos, x = {}) => { const st = com(idade, oito, cochilos, x); st.sono.registros.forEach((r) => { r.qualidade = 1; }); return st; };
  for (const st of [cansadoCom(19, em([0], 20), plano(6)), cansadoCom(19, em([0, 1, 2, 3, 4], 20)), cansadoCom(30, em([0, 1, 2], 90, '17:00'), plano(6)), cansadoCom(30, em([0, 1, 2, 3, 4, 5, 6], 60, '23:00'))]) {
    const l = ids(st);
    assert.deepEqual(l.slice(0, 2), ['acordado', 'semCochilo']); assert.deepEqual(l.filter((x) => DE_COCHILO.includes(x)), ['semCochilo'], l.join());
  }
  // dormiu as horas e acorda cansado, e cochila: a orientação é evitar o cochilo (adultos)
  const cansado = com(30, oito, em([0, 1], 20)); cansado.sono.registros.forEach((x) => { x.qualidade = 2; });
  assert.deepEqual(ids(cansado).slice(0, 2), ['acordado', 'semCochilo']);
  // nunca mais de 4 dicas, sem repetir, e todas com fonte
  const tudo = com(30, [5, 9, 5, 9, 5, 9, 5], [...em([0, 1, 2, 3, 4, 5, 6], 90, '17:00')], plano(6));
  const todas = dicasDeSono(tudo, HOJE); assert.equal(todas.length, 4); assert.equal(new Set(todas.map((x) => x.id)).size, 4); assert.ok(todas.every((x) => x.refs.length && x.refs.every((k) => REFS_SONO[k])));
});

// Pares de dicas que dizem coisas opostas e, por isso, nunca podem aparecer na mesma tela.
const PARES_CONTRADITORIOS = [
  ['semCochilo', 'cochilo'], ['semCochilo', 'cochiloFrequente'], ['semCochilo', 'cochiloLongo'], ['semCochilo', 'cochiloTarde'], ['semCochilo', 'cochiloNoite'], ['semCochilo', 'faltou'],
  ['faltou', 'acordado'], ['cochilo', 'cochiloLongo'], ['cochilo', 'cochiloFrequente'], ['cochilo', 'cochiloNoite'], ['cochiloLongo', 'cochiloFrequente'], ['horario', 'irregular'], ['cafeina', 'cafeinaJovem'],
];
const DICAS_DE_COCHILO = ['cochilo', 'cochiloLongo', 'cochiloFrequente', 'cochiloTarde', 'cochiloNoite', 'semCochilo'];
const DICAS_DE_ADULTO = ['alcool', 'cafeina', 'treinoNoite', 'emagrecer', 'musculo', 'dor', 'saude', ...DICAS_DE_COCHILO];
// confere uma lista de dicas contra as regras; devolve o que achou de errado
function problemasNasDicas(idsDicas, { idade, gestante }) {
  const out = [];
  for (const [a, b] of PARES_CONTRADITORIOS) if (idsDicas.includes(a) && idsDicas.includes(b)) out.push('par:' + a + '+' + b);
  if (!(idade >= 19)) for (const id of idsDicas) if (DICAS_DE_COCHILO.includes(id)) out.push('menor:' + id);
  if (!(idade >= 18)) for (const id of idsDicas) if (DICAS_DE_ADULTO.includes(id) && !DICAS_DE_COCHILO.includes(id)) out.push('menor:' + id);
  if (gestante) for (const id of idsDicas) if (DICAS_DE_COCHILO.includes(id) || id === 'alcool' || id === 'emagrecer') out.push('gestante:' + id);
  return out;
}

test('varredura: em 38.016 perfis, nenhum par de dicas contraditórias e nenhuma dica de adulto para menor ou gestante', () => {
  const dias = (l, min, inicio) => l.map((i) => ({ data: somaDia(HOJE, -i), min, ...(inicio ? { inicio } : {}) }));
  const IDADES = [6, 10, 13, 15, 17, 18, 19, 30, 45, 61, 70];
  const NOITES = [[], [8, 8, 8], [8, 8, 8, 8, 8, 8, 8], [7, 7, 7, 7, 7, 7, 7], [5, 5, 5, 5, 5, 5, 5], [10, 10, 10, 10, 10, 10, 10], [5, 9, 5, 9, 5, 9, 5], [null, null, 6.5, 6.5, 6.5, 6.5, 6.5]];
  const COCHILOS = [[], dias([0], 20), dias([0, 1], 20, '17:00'), dias([0, 1, 2], 20), dias([0, 1, 2, 3, 4], 20), dias([0, 1, 2, 3, 4, 5, 6], 20), dias([0, 1, 2], 90), dias([0, 1, 2, 3, 4, 5, 6], 90),
    dias([0, 1, 2], 60, '23:30'), dias([0, 1], 30, '00:30'), dias([0, 1, 2, 3], 45, '15:30'), dias([5, 6], 120)];
  let n = 0;
  const achados = new Map();
  const vistas = new Set();
  for (const idade of IDADES) for (const gestante of [false, true]) for (const treino of [0, 3, 6]) for (const horas of NOITES) for (const q of [0, 1, 4]) for (const ck of COCHILOS) for (const extra of [false, true]) {
    const st = estado({
      trainer: { answers: { idade, condicoes: [...(gestante ? ['gestante'] : []), ...(extra ? ['hipertensao'] : [])], ...(extra ? { objetivo: 'hipertrofia' } : {}) } }, nutri: { answers: extra ? { horario: 'noite', objetivo: 'emagrecer' } : {} }, ...plano(treino),
      dores: extra ? [{ id: 'd1', data: somaDia(HOJE, -2), onde: 'joelho', lado: '', tipo: 'articular', quando: 'durante', nivel: 4, nota: '', fim: '' }] : [],
      sono: { acordar: extra ? '06:30' : '', idade: null, registros: noites(horas).map((r) => (q ? { ...r, qualidade: q } : r)), cochilos: ck },
    });
    const l = dicasDeSono(st, HOJE).map((d) => d.id);
    n++;
    assert.ok(l.length >= 3 && l.length <= 4 && new Set(l).size === l.length);
    for (const id of l) vistas.add(id);
    for (const x of problemasNasDicas(l, { idade, gestante })) achados.set(x, (achados.get(x) || 0) + 1);
  }
  assert.equal(n, 38016);
  assert.deepEqual([...achados], [], 'dicas contraditórias ou fora do público das fontes');
  // a grade passa por todas as dicas que dependem de registro ou perfil (as de prova e as gerais, que se revezam com o dia, têm teste próprio)
  const FORA_DA_GRADE = ['prova', 'vespera', 'cafeina', 'cafeinaJovem', 'telas', 'quarto', 'horario', 'alcool'];
  for (const id of Object.keys(DICAS_SONO)) if (!FORA_DA_GRADE.includes(id)) assert.ok(vistas.has(id), 'a varredura não chegou à dica ' + id);
});

test('hora de dormir: atravessa a meia-noite e recusa entrada inválida', () => {
  assert.equal(horaDeDormir('06:30', 8), '22:30');
  assert.equal(horaDeDormir('07:00', 7.5), '23:30');
  assert.equal(horaDeDormir('05:00', 9.5), '19:30');
  assert.equal(horaDeDormir('09:00', 9), '00:00');
  assert.equal(horaDeDormir('08:15', 8.25), '00:00');
  assert.equal(horaDeDormir('00:15', 8), '16:15');
  assert.equal(horaDeDormir('23:59', 8.5), '15:29');
  assert.equal(horaDeDormir('12:00', 10), '02:00');
  for (const [a, h] of [['', 8], ['24:00', 8], ['7:00', 8], [null, 8], ['07:00', 0], ['07:00', -1], ['07:00', NaN], ['07:00', '8'], ['07:00', 25], ['07:00', Infinity]]) assert.equal(horaDeDormir(a, h), '', JSON.stringify([a, h]));
  assert.equal(fmtHoras(8), '8 h'); assert.equal(fmtHoras(7.5), '7 h 30'); assert.equal(fmtHoras(7.25), '7 h 15'); assert.equal(fmtHoras(0), '0 h'); assert.equal(fmtHoras(0.75), '0 h 45'); assert.equal(fmtHoras(NaN), '–'); assert.equal(fmtHoras(-1), '–');
  assert.equal(fmtFaixa(7, 9), '7 a 9 h'); assert.equal(fmtFaixa(7.5, 9), '7 h 30 a 9 h');
});

test('dicas: de 3 a 4, sem repetir, escolhidas pelo perfil e pelos registros', () => {
  const ids = (st, hoje = HOJE) => dicasDeSono(st, hoje).map((d) => d.id);
  // junta as dicas de 5 dias seguidos (as gerais se revezam)
  const emCincoDias = (st) => { const v = new Set(); for (let i = 0; i < 5; i++) for (const id of ids(st, `2026-11-${10 + i}`)) v.add(id); return v; };
  const geral = ids(comIdade(30));
  assert.equal(geral.length, 3); assert.ok(geral.every((id) => ['cafeina', 'telas', 'quarto', 'horario', 'alcool'].includes(id)));
  assert.deepEqual([...emCincoDias(comIdade(30))].sort(), ['alcool', 'cafeina', 'horario', 'quarto', 'telas']);
  for (const d of dicasDeSono(comIdade(30), HOJE)) { assert.ok(d.titulo && d.texto && d.refs.length); assert.ok(d.refs.every((k) => REFS_SONO[k])); }
  // menores de 18: sem álcool, sem horário de corte para café (vale a orientação da pediatria) e sem as dicas de estudos com adultos
  for (const idade of [6, 12, 15, 17]) {
    const v = emCincoDias(estado({ trainer: { answers: { idade, objetivo: 'hipertrofia' } }, nutri: { answers: { objetivo: 'emagrecer', horario: 'noite' } } }));
    for (const id of ['alcool', 'cafeina', 'treinoNoite', 'emagrecer', 'musculo', 'dor', 'saude']) assert.ok(!v.has(id), `${id} aos ${idade} anos`);
    assert.ok(v.has('cafeinaJovem') && v.has('telas') && v.has('quarto') && v.has('horario'), 'dicas gerais aos ' + idade);
  }
  assert.ok(DICAS_SONO.cafeinaJovem.refs.includes('aap2011') && !/hora/.test(DICAS_SONO.cafeinaJovem.texto));
  assert.ok(emCincoDias(comIdade(18)).has('alcool') && emCincoDias(comIdade(18)).has('cafeina') && !emCincoDias(comIdade(18)).has('cafeinaJovem'));
  // gestantes: sem álcool e sem a dica de emagrecimento
  const gest = emCincoDias(estado({ trainer: { answers: { idade: 30, condicoes: ['gestante'] } }, nutri: { answers: { objetivo: 'emagrecer' } } }));
  assert.ok(!gest.has('alcool') && !gest.has('emagrecer') && gest.has('cafeina'));
  // perfil
  assert.ok(ids(estado({ nutri: { answers: { idade: 30, horario: 'noite', objetivo: 'emagrecer' } } })).includes('treinoNoite'));
  assert.ok(ids(estado({ nutri: { answers: { idade: 30, objetivo: 'emagrecer' } } })).includes('emagrecer'));
  assert.ok(ids(estado({ trainer: { answers: { idade: 30, objetivo: 'forca' } } })).includes('musculo'));
  assert.ok(ids(comIdade(16, plano(3))).includes('jovem')); assert.ok(!ids(comIdade(16)).includes('jovem'));
  // dor e pressão/diabetes/coração: só na faixa do consenso de adultos (18 a 60 anos)
  const dor = [{ id: 'd1', data: '2026-11-10', onde: 'joelho', lado: '', tipo: 'articular', quando: 'durante', nivel: 4, nota: '', fim: '' }];
  assert.ok(ids(comIdade(30, { dores: dor })).includes('dor')); assert.ok(ids(comIdade(60, { dores: dor })).includes('dor'));
  assert.ok(!ids(comIdade(16, { dores: dor })).includes('dor')); assert.ok(!ids(comIdade(61, { dores: dor })).includes('dor'));
  assert.ok(ids(estado({ trainer: { answers: { idade: 50, condicoes: ['hipertensao'] } } })).includes('saude'));
  assert.ok(!ids(estado({ trainer: { answers: { idade: 15, condicoes: ['diabetes'] } } })).includes('saude')); assert.ok(!ids(estado({ trainer: { answers: { idade: 70, condicoes: ['cardiaco'] } } })).includes('saude'));
  assert.ok(ids(comIdade(30, plano(6))).includes('cochilo'));
  assert.deepEqual(ids(comProva(), '2026-11-10').slice(0, 1), ['prova']); assert.deepEqual(ids(comProva(), '2026-11-14').slice(0, 1), ['vespera']);
  assert.ok(!ids(comProva(), '2026-11-15').some((id) => id === 'prova' || id === 'vespera'));
  // registros: média abaixo do mínimo, variação grande e noites em que acordou cansado
  const st = (horas, q) => comIdade(30, { sono: { acordar: '06:30', idade: 30, registros: noites(horas).map((r) => (q ? { ...r, qualidade: q } : r)) } });
  const curto = dicasDeSono(st([6, 6, 6.5, 6, 6, 6.5, 6]), HOJE);
  assert.equal(curto[0].id, 'faltou'); assert.match(curto[0].texto, /Sua média foi de 6 h 09 em 7 noites, abaixo do mínimo de 7 h\./); assert.ok(curto.some((d) => d.id === 'cochilo'));
  assert.ok(!ids(st([7, 7, 6.75])).includes('faltou'), 'três noites quase na faixa não disparam "faltou sono"');
  assert.ok(!ids(st([7, 7, 7, 7, 6.5, 7, 7])).includes('faltou'));
  assert.ok(ids(st([4, 10, 5, 9.5, 4.5, 10, 5])).includes('irregular')); assert.ok(!ids(st([4, 10, 5, 9.5, 4.5, 10, 5])).includes('horario'));
  // "dormiu as horas e acordou cansado": só com a média dentro da faixa, e nunca junto com "deite mais cedo"
  assert.equal(ids(st([8, 8, 8, 8, 8, 8, 8], 2))[0], 'acordado');
  const poucoERuim = ids(st([5, 5, 5, 5, 5, 5, 5], 1));
  assert.ok(poucoERuim.includes('faltou') && !poucoERuim.includes('acordado'), '7 noites de 5 h com nota baixa: a dica é dormir mais');
  assert.ok(!ids(st([8, 8, 8], 1)).includes('acordado'), 'três noites não bastam');
  assert.ok(!ids(st([10, 10, 10, 10, 10, 10, 10], 1)).includes('acordado'), 'média acima da faixa');
  assert.ok(!ids(st([8, 8, 8, 8, 8, 8, 8], 4)).includes('acordado'));
  // café: a frase e a conta usam o mesmo número (8,8 h antes; alvo 8 h, acordar 06:30 → deitar 22:30 → 13:42 → 13:40)
  assert.equal(CAFE_HORAS, 8.8); assert.ok(DICAS_SONO.cafeina.texto.includes('8,8 horas') && !/\b9 horas/.test(DICAS_SONO.cafeina.texto));
  let cafe = null; for (let i = 0; i < 5 && !cafe; i++) cafe = dicasDeSono(st([8, 8, 8]), `2026-11-${10 + i}`).find((d) => d.id === 'cafeina');
  assert.match(cafe.texto, /menos de 8,8 horas de deitar.*Para deitar às 22:30, o último café fica para até as 13:40\./);
  const semHora = comIdade(30); let cafe2 = null; for (let i = 0; i < 5 && !cafe2; i++) cafe2 = dicasDeSono(semHora, `2026-11-${10 + i}`).find((d) => d.id === 'cafeina');
  assert.equal(cafe2.texto, DICAS_SONO.cafeina.texto, 'sem hora de acordar não há conta');
  // nunca mais de 4, nunca repetidas, mesmo com tudo ao mesmo tempo
  const tudo = estado({ trainer: { answers: { idade: 16, objetivo: 'hipertrofia', condicoes: ['gestante'] } }, nutri: { answers: { objetivo: 'emagrecer', horario: 'noite' } }, ...plano(6), sono: { acordar: '06:00', idade: null, registros: noites([4, 10, 5, 9.5, 4.5, 6, 5]).map((r) => ({ ...r, qualidade: 1 })) } });
  const todas = ids(tudo); assert.equal(todas.length, 4); assert.equal(new Set(todas).size, 4);
});

test('referências: toda citação existe, toda referência é usada e os textos têm fonte', () => {
  const chaves = new Set(Object.keys(REFS_SONO));
  assert.ok(chaves.size >= 25);
  for (const [k, v] of Object.entries(REFS_SONO)) { assert.match(k, /^[a-z]+\d{4}$/, k); assert.ok(typeof v === 'string' && v.length > 40 && /\b(19|20)\d{2}\b/.test(v), k); }
  assert.equal(new Set(Object.values(REFS_SONO)).size, chaves.size, 'nenhuma publicação repetida');
  const usadas = new Set();
  const cita = (lista, onde) => { assert.ok(Array.isArray(lista) && lista.length > 0, 'sem fonte: ' + onde); for (const k of lista) { assert.ok(chaves.has(k), `referência inexistente "${k}" em ${onde}`); usadas.add(k); } };
  for (const f of FAQ_SONO) {
    assert.ok(f.q.endsWith('?') && f.tags.length > 3 && Array.isArray(f.a) && f.a.length >= 1 && f.a.every((p) => typeof p === 'string' && p.length > 20), f.q);
    cita(f.f, 'pergunta: ' + f.q);
  }
  assert.equal(new Set(FAQ_SONO.map((f) => f.q)).size, FAQ_SONO.length);
  for (const [id, d] of Object.entries(DICAS_SONO)) { assert.ok(d.titulo && d.texto && d.texto.length <= 220, 'dica curta: ' + id); cita(d.refs, 'dica: ' + id); }
  assert.equal(SINAIS_SONO.itens.length, 3); cita(SINAIS_SONO.refs, 'sinais');
  // citações escritas na lógica e na tela (motivos, avisos, "como ler")
  for (const arq of ['www/js/logic/sono.js', 'www/js/views/sono.js']) {
    const txt = fs.readFileSync(new URL('../' + arq, import.meta.url), 'utf8');
    for (const m of txt.matchAll(/'([a-z]+\d{4})'/g)) { assert.ok(chaves.has(m[1]), `referência inexistente "${m[1]}" em ${arq}`); usadas.add(m[1]); }
  }
  assert.deepEqual([...chaves].filter((k) => !usadas.has(k)), [], 'referência que ninguém cita');
  // os textos dizem o mesmo que as regras: todas as faixas (inclusive 13 e 18 anos), o mínimo de idade, a gestação e os 5 dias
  const faixas = FAQ_SONO.find((f) => f.q === 'Quantas horas eu preciso dormir?').a[0];
  for (const [idade, trecho] of [[IDADE_MIN, 'de 6 a 12 anos, 9 a 11'], [13, 'aos 13, 9 a 10'], [15, 'de 14 a 17, 8 a 10'], [18, 'aos 18, 8 a 9'], [40, 'de 19 a 64, 7 a 9'], [70, 'a partir de 65 anos, 7 a 8']]) {
    const m = metaDeSono(comIdade(idade), HOJE);
    assert.ok(faixas.includes(trecho) && trecho.endsWith(`${m.min} a ${m.max}`), 'faixa da pergunta diferente da regra: ' + trecho);
  }
  assert.match(FAQ_SONO.find((f) => /grávida/.test(f.q)).a[0], /vale a da sua idade/);
  assert.ok(FAQ_SONO.filter((f) => /5 dias ou mais/.test(f.a.join(' '))).length >= 2 && !FAQ_SONO.some((f) => /5 treinos/.test(f.a.join(' '))), 'o corte é em dias de treino');
  assert.ok(!FAQ_SONO.find((f) => /65 anos/.test(f.q)).f.includes('watson2015'), 'o consenso de adultos da AASM vai até os 60 anos');
  // a busca das perguntas funciona com e sem acento
  assert.match(buscarFaq(FAQ_SONO, 'café')[0].q, /café/); assert.match(buscarFaq(FAQ_SONO, 'cafe')[0].q, /café/);
  assert.match(buscarFaq(FAQ_SONO, 'ronco')[0].q, /Ronco/); assert.match(buscarFaq(FAQ_SONO, 'gravida')[0].q, /grávida/);
  assert.equal(buscarFaq(FAQ_SONO, 'xyzw').length, 0);
  // o aplicativo não indica remédio: nenhum texto recomenda melatonina ou remédio para dormir
  const textos = [...FAQ_SONO.flatMap((f) => f.a), ...Object.values(DICAS_SONO).map((d) => d.texto), ...SINAIS_SONO.itens];
  for (const t of textos) if (/melatonina|remédio/i.test(t)) assert.match(t, /não indica remédio nem melatonina|reduziu a melatonina/, t);
});

// ---------- estresse ----------
function semente(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const um = (r, l) => l[Math.floor(r() * l.length)];
const inteiro = (r, a, b) => a + Math.floor(r() * (b - a + 1));
function semNaN(v, caminho = '') {
  if (typeof v === 'number') assert.ok(Number.isFinite(v), 'número inválido em ' + caminho);
  else if (Array.isArray(v)) v.forEach((x, i) => semNaN(x, caminho + '[' + i + ']'));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) semNaN(v[k], caminho + '.' + k);
  else if (typeof v === 'string') assert.ok(!/NaN|undefined|Infinity|null/.test(v), `texto com valor inválido em ${caminho}: ${v}`);
}
// respostas válidas da entrevista de corrida (opção aleatória de cada pergunta), para gerar planos de verdade
function respostasCorrida(r) {
  const a = {};
  for (const q of P_CORRIDA) {
    if (q.se && !q.se(a)) continue;
    if (q.k === 'condicoes') a[q.k] = ['nenhuma'];
    else if (q.k === 'triagem') a[q.k] = ['nenhum'];
    else if (q.k === 'limitacoes') a[q.k] = ['nenhuma'];
    else if (q.k === 'dias') a[q.k] = um(r, [['1', '3', '5'], ['2', '4', '6', '0'], ['1', '2', '3', '4', '5', '6'], ['6', '0']]);
    else if (q.k === 'idade') a[q.k] = inteiro(r, 12, 80);
    else if (q.k === 'semanasProva') a[q.k] = inteiro(r, 1, 20);
    else if (q.tipo === 'numero') a[q.k] = q.padrao ?? q.min;
    else if (q.tipo === 'um') a[q.k] = um(r, q.op)[0];
    else a[q.k] = [um(r, q.op)[0]];
  }
  return a;
}
// cochilos válidos dos 7 dias que terminam em `hoje`, lidos direto do estado (conta independente da lógica)
function cochilosDaSemana(st, hoje) {
  const l = st && st.sono && Array.isArray(st.sono.cochilos) ? st.sono.cochilos : [];
  if (typeof hoje !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(hoje) || Number.isNaN(Date.parse(hoje + 'T12:00:00Z')) || new Date(hoje + 'T12:00:00Z').toISOString().slice(0, 10) !== hoje) return [];
  const ini = somaDia(hoje, -6);
  return l.filter((c) => c && typeof c === 'object' && !Array.isArray(c) && typeof c.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.data) && !Number.isNaN(Date.parse(c.data + 'T12:00:00Z')) && new Date(c.data + 'T12:00:00Z').toISOString().slice(0, 10) === c.data
    && typeof c.min === 'number' && Number.isFinite(c.min) && c.min >= COCHILO_PASSO && c.min <= COCHILO_MAX && c.data >= ini && c.data <= hoje);
}
const LIXO = [null, undefined, NaN, Infinity, -1, 99, '8', '', [], {}, true, '2026-02-31', '__proto__', { data: 'x' }, { horas: NaN }];

test('estresse: milhares de perfis e estados aleatórios (nunca NaN, faixa coerente e dentro das fontes)', () => {
  const r = semente(20261113);
  const base = Date.parse('2026-01-01T12:00:00Z');
  let comMeta = 0, comCorrida = 0, comAjuste = 0, semMeta = 0, comProvaNaSemana = 0, comCochilos = 0, comLongo = 0;
  for (let i = 0; i < 4000; i++) {
    const hoje = new Date(base + inteiro(r, 0, 700) * 86400000).toISOString().slice(0, 10);
    const idade = r() < 0.08 ? um(r, LIXO) : r() < 0.3 ? um(r, [6, 12, 13, 14, 17, 18, 19, 25, 26, 64, 65, 99]) : inteiro(r, 1, 110);
    const onde = um(r, ['trainer', 'nutri', 'run', 'sono', 'nenhum']);
    const st = estado();
    if (onde === 'sono') st.sono.idade = idade; else if (onde !== 'nenhum') st[onde].answers.idade = idade;
    if (r() < 0.5) st.trainer.answers.objetivo = um(r, ['hipertrofia', 'emagrecimento', 'forca', 'saude', 'resistencia', 7, null]);
    if (r() < 0.5) st.nutri.answers.objetivo = um(r, ['emagrecer', 'ganhar', 'manter', {}]);
    if (r() < 0.4) st.nutri.answers.horario = um(r, ['cedo', 'manha', 'tarde', 'noite', 'varia']);
    if (r() < 0.4) st.trainer.answers.condicoes = um(r, [['nenhuma'], ['gestante'], ['hipertensao', 'diabetes'], ['cardiaco'], 'gestante', [1, null, 'gestante']]);
    if (r() < 0.6) Object.assign(st, plano(inteiro(r, 0, 7)));
    if (r() < 0.1) { st.plans = um(r, LIXO); st.activePlan = um(r, LIXO); }
    if (r() < 0.25) {
      const a = respostasCorrida(r);
      const ini = new Date(Date.parse(hoje + 'T12:00:00Z') - inteiro(r, 0, 60) * 86400000);
      ini.setUTCDate(ini.getUTCDate() - ((ini.getUTCDay() + 6) % 7)); // segunda-feira
      st.run = { answers: a, aceitoEm: ini.toISOString(), inicio: ini.toISOString().slice(0, 10), pausadoEm: r() < 0.1 ? ini.toISOString() : '' };
      // Treinador e Nutricionista vêm antes da corrida na ordem da idade: nesses casos a corrida pode ter a sua (o plano de
      // corrida só existe com as respostas completas). Quando a idade vem do sono, ou de lugar nenhum, a corrida fica sem.
      if (onde === 'trainer' || onde === 'nutri') st.run.answers.idade = 30;
      else if (onde !== 'run') delete st.run.answers.idade;
      else st.run.answers.idade = idade;
    }
    if (r() < 0.2) st.dores = [{ id: 'd' + i, data: hoje, onde: 'joelho', lado: '', tipo: 'articular', quando: 'durante', nivel: inteiro(r, 1, 10), nota: '', fim: '' }];
    // noites: válidas, no limite e lixo; metade passa pela validação, metade vai crua para as funções
    const brutos = [];
    for (let k = inteiro(r, 0, 20); k > 0; k--) {
      const data = new Date(Date.parse(hoje + 'T12:00:00Z') - inteiro(r, -3, 12) * 86400000).toISOString().slice(0, 10);
      brutos.push(r() < 0.12 ? um(r, LIXO) : { data: r() < 0.05 ? um(r, LIXO) : data, horas: r() < 0.08 ? um(r, LIXO) : um(r, [0, 0.25, 3, 4.5, 5, 6, 6.5, 7, 7.25, 7.5, 8, 8.5, 9, 10, 12, 16, 7.33]), qualidade: r() < 0.5 ? um(r, [1, 2, 3, 4, 5, 0, 9, 'x', null]) : undefined });
    }
    const acordar = r() < 0.6 ? `${String(inteiro(r, 0, 23)).padStart(2, '0')}:${String(inteiro(r, 0, 59)).padStart(2, '0')}` : um(r, ['', '25:00', null, 7]);
    const cochilosBrutos = [];
    for (let k = inteiro(r, 0, 14); k > 0; k--) {
      const data = new Date(Date.parse(hoje + 'T12:00:00Z') - inteiro(r, -3, 10) * 86400000).toISOString().slice(0, 10);
      cochilosBrutos.push(r() < 0.12 ? um(r, LIXO) : { data: r() < 0.05 ? um(r, LIXO) : data, min: r() < 0.08 ? um(r, LIXO) : um(r, [5, 10, 20, 25, 30, 45, 60, 90, 120, 240, 22, 500]), inicio: r() < 0.6 ? um(r, ['12:30', '13:00', '14:10', '15:59', '16:00', '17:30', '21:00', '25:00', 7, null]) : undefined });
    }
    const limpo = limparSono({ acordar, idade: st.sono.idade, registros: brutos, cochilos: cochilosBrutos }, hoje);
    assert.ok(limpo.cochilos.every((x, j, l) => x.min >= COCHILO_PASSO && x.min <= COCHILO_MAX && x.min % COCHILO_PASSO === 0 && x.data <= somaDia(hoje, 1) && (j === 0 || l[j - 1].data <= x.data)), 'cochilos válidos e em ordem');
    assert.ok(Object.values(limpo.cochilos.reduce((m, x) => { m[x.data] = (m[x.data] || 0) + 1; return m; }, {})).every((n) => n <= COCHILOS_POR_DIA));
    assert.deepEqual(limparSono(J(limpo), hoje), limpo);
    assert.ok(limpo.registros.every((x) => x.data <= somaDia(hoje, 1)), 'nenhuma noite no futuro');
    assert.ok(limpo.registros.every((x, j, l) => x.horas >= 0 && x.horas <= HORAS_MAX && Number.isInteger(x.horas * 4) && (j === 0 || l[j - 1].data < x.data)));
    st.sono = r() < 0.5 ? limpo : { acordar, idade: st.sono.idade, registros: brutos, cochilos: r() < 0.9 ? cochilosBrutos : um(r, LIXO) };
    const hojeUsado = r() < 0.03 ? um(r, ['', '2026-02-31', null, 5]) : hoje;

    const pn = painelDeSono(st, hojeUsado);
    semNaN(pn, 'painel');
    const meta = metaDeSono(st, hojeUsado);
    assert.deepEqual(meta, pn.meta);
    const idadeBoa = typeof pn.perfil.idade === 'number' && pn.perfil.idade >= IDADE_MIN;
    assert.equal(!!meta, idadeBoa, 'há meta se, e só se, a idade é conhecida e coberta pelas fontes');
    if (meta) {
      comMeta++;
      assert.ok(meta.min <= meta.alvo && meta.alvo <= meta.max, 'min ≤ alvo ≤ max');
      assert.ok(meta.min >= 7 && meta.max <= 11 && meta.max - meta.min >= 1 && meta.max - meta.min <= 2, 'faixa dentro do que os consensos dão');
      assert.ok(meta.idade >= 18 ? meta.max <= 9 : meta.min >= 8, 'adultos até 9 h; menores de 18 a partir de 8 h');
      if (meta.idade >= 65) assert.deepEqual([meta.min, meta.max], [7, 8]);
      assert.equal(meta.base, (meta.min + meta.max) / 2);
      assert.ok(meta.ajuste === 0 || meta.ajuste === AJUSTE, 'o alvo só sobe meia hora');
      if (meta.ajuste) { comAjuste++; assert.ok(pn.perfil.cargaAlta || pn.perfil.semanaDeProva); assert.equal(pn.perfil.gestante, false); }
      if (pn.perfil.cargaAlta) assert.ok(pn.perfil.diasDeTreino >= CARGA_ALTA);
      if (pn.perfil.semanaDeProva) { comProvaNaSemana++; assert.equal(st.run.answers.objetivo, 'prova'); assert.ok(pn.perfil.prova.dias >= 1 && pn.perfil.prova.dias <= 7); }
      if (!pn.perfil.corrida && !pn.perfil.prova) assert.ok(!meta.motivos.some((m) => /prova/i.test(m.texto)), 'sem corrida nem prova, a meta não fala em prova');
      if (pn.perfil.gestante) assert.equal(meta.alvo, meta.base);
      assert.ok(Number.isInteger(meta.alvo * 2));
      assert.ok(meta.motivos.length >= 1 && meta.motivos.length <= 4 && meta.motivos.every((m) => m.texto.length > 20 && m.texto.length <= 200 && m.refs.length && m.refs.every((k) => REFS_SONO[k])));
      assert.ok(meta.avisos.every((a) => a.refs.every((k) => REFS_SONO[k])));
      const d = horaDeDormir(pn.perfil.acordar || '07:00', meta.alvo);
      assert.match(d, /^([01]\d|2[0-3]):[0-5]\d$/);
    } else semMeta++;
    if (pn.perfil.corrida) comCorrida++;
    assert.ok(pn.perfil.diasDeTreino >= 0 && pn.perfil.diasDeTreino <= 7 && pn.perfil.musculacao <= 7 && pn.perfil.diasDeTreino >= pn.perfil.musculacao);
    if (pn.perfil.corrida) assert.ok(pn.perfil.corrida.dias >= 0 && pn.perfil.corrida.dias <= 6 && pn.perfil.diasDeTreino <= pn.perfil.musculacao + pn.perfil.corrida.dias);
    if (pn.perfil.prova) assert.ok(pn.perfil.prova.dias >= 0);
    const idsDicas = pn.dicas.map((d) => d.id);
    assert.ok(!(idsDicas.includes('faltou') && idsDicas.includes('acordado')), 'as duas dicas se contradizem');
    if (!pn.perfil.adulto) assert.ok(!idsDicas.some((id) => ['alcool', 'cafeina', 'treinoNoite', 'emagrecer', 'musculo', 'dor', 'saude'].includes(id)), 'dica de adulto para menor de 18: ' + idsDicas.join());
    if (pn.perfil.gestante) assert.ok(!idsDicas.includes('alcool') && !idsDicas.includes('emagrecer'));
    if (!pn.perfil.prova) assert.ok(!idsDicas.includes('prova') && !idsDicas.includes('vespera'));
    const s = pn.semana;
    assert.ok(s.dias.length === 0 || s.dias.length === 7);
    assert.ok(s.n >= 0 && s.n <= 7 && s.abaixo + s.dentro + s.acima === (meta ? s.n : 0));
    if (s.media != null) assert.ok(s.media >= 0 && s.media <= HORAS_MAX);
    // cochilos: totais coerentes com os dias e com a regra de cada idade
    const ck = s.cochilo;
    assert.ok(ck.dias >= 0 && ck.dias <= 7 && ck.n >= ck.dias && ck.n <= 7 * COCHILOS_POR_DIA && ck.longos <= ck.dias && ck.tardios <= ck.n && ck.totalMin <= ck.n * COCHILO_MAX);
    if (s.dias.length) {
      assert.equal(ck.totalMin, s.dias.reduce((t, d) => t + d.cochiloMin, 0)); assert.equal(ck.dias, s.dias.filter((d) => d.cochilos > 0).length);
      assert.equal(ck.mediaMin, ck.dias ? Math.round(ck.totalMin / ck.dias) : 0);
      for (const d of s.dias) {
        assert.equal(d.total, d.horas == null ? null : d.horas + d.cochiloMin / 60);
        if (meta && d.horas != null) { const v = meta.soma24h ? d.total : d.horas; assert.equal(d.estado, v < meta.min ? 'abaixo' : v > meta.max ? 'acima' : 'dentro'); }
      }
      if (ck.dias) comCochilos++;
    }
    assert.equal(s.soma24h, !!meta && meta.idade <= SOMA_24H_ATE);
    if (s.n) { assert.ok(s.media24 >= s.media && s.media24 <= HORAS_MAX + (COCHILOS_POR_DIA * COCHILO_MAX) / 60); assert.equal(s.mediaDaMeta, s.soma24h ? s.media24 : s.media); } else assert.equal(s.media24, null);
    const idsCochilo = pn.dicas.map((d) => d.id);
    assert.deepEqual(problemasNasDicas(idsCochilo, { idade: pn.perfil.idade, gestante: pn.perfil.gestante }), [], 'dicas contraditórias ou fora do público das fontes: ' + idsCochilo.join());
    assert.equal(ck.semNoite, s.dias.filter((d) => d.cochilos > 0 && d.horas == null).length);
    assert.equal(ck.tardios, cochilosDaSemana(st, hojeUsado).filter(cochiloTardio).length);
    if (!meta || meta.soma24h || pn.perfil.gestante) assert.ok(!idsCochilo.some((x) => DICAS_DE_COCHILO.includes(x)), 'dica de cochilo (estudos com adultos) para menor ou gestante');
    if (idsCochilo.includes('cochiloLongo')) { comLongo++; assert.ok(ck.longos >= DIAS_COCHILO_LONGO); }
    if (idsCochilo.includes('cochiloFrequente')) assert.ok(ck.dias >= DIAS_COCHILO_FREQUENTE && s.media >= meta.min);
    if (idsCochilo.includes('cochiloTarde')) assert.ok(ck.tardios >= COCHILOS_TARDIOS);
    if (idsCochilo.includes('cochiloNoite')) assert.ok(s.faltou && !meta.soma24h);
    assert.equal(minutosDeCochilo(st, hojeUsado), s.dias.length ? s.dias[6].cochiloMin : minutosDeCochilo(st, hojeUsado));
    assert.equal(s.desvioMin != null, s.n >= NOITES_PARA_REGULARIDADE);
    if (s.desvioMin != null) assert.ok(s.desvioMin >= 0 && s.desvioMin <= HORAS_MAX * 60 && ['regular', 'variavel', 'irregular'].includes(s.regularidade));
    assert.ok(s.faltaMin >= 0 && s.avisos.every((a) => a.texto && a.refs.every((k) => REFS_SONO[k])));
    assert.ok(pn.dicas.length >= 3 && pn.dicas.length <= 4 && new Set(pn.dicas.map((d) => d.id)).size === pn.dicas.length);
    assert.ok(pn.dicas.every((d) => DICAS_SONO[d.id] && d.texto.length <= 300 && d.refs.every((k) => REFS_SONO[k])));
    assert.deepEqual(dicasDeSono(st, hojeUsado), pn.dicas); assert.deepEqual(resumoDaSemana(st, hojeUsado), pn.semana);
  }
  // o sorteio cobriu os casos que importam
  assert.ok(comMeta > 2000 && semMeta > 300 && comCorrida > 100 && comAjuste > 100 && comProvaNaSemana >= 1 /* semana de prova é rara no sorteio (a corrida recusa prova inviável); o caso tem teste próprio */, JSON.stringify({ comMeta, semMeta, comCorrida, comAjuste, comProvaNaSemana }));
  assert.ok(comCochilos > 1500 && comLongo > 20, JSON.stringify({ comCochilos, comLongo }));
});

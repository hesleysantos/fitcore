// Meta de sono: faixa e alvo por idade e perfil, validação, acompanhamento da semana, hora de deitar, dicas,
// referências e um teste de estresse com milhares de estados aleatórios (semente fixa).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  sonoPadrao, limparSono, limparNoite, noiteDe, gravarNoite, apagarNoite, faixaDaIdade, perfilDeSono, metaDeSono, resumoDaSemana, horaDeDormir, dicasDeSono, painelDeSono,
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
  assert.deepEqual(sonoPadrao(), { acordar: '', idade: null, registros: [] });
  for (const lixo of [null, undefined, 5, 'x', [], [1, 2], true, () => 1]) assert.deepEqual(limparSono(lixo), sonoPadrao());
  const bom = { acordar: '06:30', idade: 34, registros: [{ data: '2026-11-11', horas: 7.5 }, { data: '2026-11-12', horas: 8, qualidade: 4 }] };
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
  assert.deepEqual(l, { acordar: '', idade: null, registros: [{ data: '2026-11-11', horas: 7 }] });
  assert.deepEqual(Object.keys(l), ['acordar', 'idade', 'registros']);
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
  // lista longa com as noites mais recentes no fim (e fora de ordem): ficam as MAX_NOITES mais recentes, não as primeiras
  const velhas = Array.from({ length: 7000 }, (_, i) => ({ data: somaDia('2000-01-01', i), horas: 6 }));
  const novas = Array.from({ length: 10 }, (_, i) => ({ data: somaDia(HOJE, -i), horas: 8 }));
  const longa = limparSono({ registros: [...velhas, ...novas] }, HOJE).registros;
  assert.equal(longa.length, MAX_NOITES); assert.equal(longa[longa.length - 1].data, HOJE); assert.equal(longa.filter((x) => x.horas === 8).length, 10);
  assert.equal(longa[0].data, somaDia('2000-01-01', 7000 - (MAX_NOITES - 10)));
  // pela validação geral do estado (backup importado)
  const s = store.sanitize({ sono: { acordar: '05:45', idade: 200, registros: [{ data: '2026-11-12', horas: 99 }, { data: '2026-11-11', horas: 6.25, qualidade: 9 }] } });
  assert.deepEqual(s.sono, { acordar: '05:45', idade: null, registros: [{ data: '2026-11-11', horas: 6.25 }] });
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
const LIXO = [null, undefined, NaN, Infinity, -1, 99, '8', '', [], {}, true, '2026-02-31', '__proto__', { data: 'x' }, { horas: NaN }];

test('estresse: milhares de perfis e estados aleatórios (nunca NaN, faixa coerente e dentro das fontes)', () => {
  const r = semente(20261113);
  const base = Date.parse('2026-01-01T12:00:00Z');
  let comMeta = 0, comCorrida = 0, comAjuste = 0, semMeta = 0, comProvaNaSemana = 0;
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
    const limpo = limparSono({ acordar, idade: st.sono.idade, registros: brutos }, hoje);
    assert.deepEqual(limparSono(J(limpo), hoje), limpo);
    assert.ok(limpo.registros.every((x) => x.data <= somaDia(hoje, 1)), 'nenhuma noite no futuro');
    assert.ok(limpo.registros.every((x, j, l) => x.horas >= 0 && x.horas <= HORAS_MAX && Number.isInteger(x.horas * 4) && (j === 0 || l[j - 1].data < x.data)));
    st.sono = r() < 0.5 ? limpo : { acordar, idade: st.sono.idade, registros: brutos };
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
    assert.equal(s.desvioMin != null, s.n >= NOITES_PARA_REGULARIDADE);
    if (s.desvioMin != null) assert.ok(s.desvioMin >= 0 && s.desvioMin <= HORAS_MAX * 60 && ['regular', 'variavel', 'irregular'].includes(s.regularidade));
    assert.ok(s.faltaMin >= 0 && s.avisos.every((a) => a.texto && a.refs.every((k) => REFS_SONO[k])));
    assert.ok(pn.dicas.length >= 3 && pn.dicas.length <= 4 && new Set(pn.dicas.map((d) => d.id)).size === pn.dicas.length);
    assert.ok(pn.dicas.every((d) => DICAS_SONO[d.id] && d.texto.length <= 300 && d.refs.every((k) => REFS_SONO[k])));
    assert.deepEqual(dicasDeSono(st, hojeUsado), pn.dicas); assert.deepEqual(resumoDaSemana(st, hojeUsado), pn.semana);
  }
  // o sorteio cobriu os casos que importam
  assert.ok(comMeta > 2000 && semMeta > 300 && comCorrida > 100 && comAjuste > 100 && comProvaNaSemana >= 1 /* semana de prova é rara no sorteio (a corrida recusa prova inviável); o caso tem teste próprio */, JSON.stringify({ comMeta, semMeta, comCorrida, comAjuste, comProvaNaSemana }));
});

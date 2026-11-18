// Carga da semana na corrida (logic/carga-corrida.js): semana normal, 1º treino de pernas da volta antes do longão,
// corrida que muda de dia, salto de distância, volume que subiu muito, sono ruim, dor, proteções e a validação do que fica
// guardado (state.run.carga).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import { PERGUNTAS, somaDias, planoDaSemana, planoAtual, limparCarga, limparCorrida } from '../www/js/logic/corrida.js';
import { cargaDaSemana, aplicarCarga, desfazerCarga, cargaDoDia, treinosDePernas } from '../www/js/logic/carga-corrida.js';
import { REFS_CORRIDA, MOTIVOS_CARGA } from '../www/js/data/corrida.js';

const it = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
const PERNAS = [it('agachamento-peso-corporal'), it('flexao-nordica'), it('ponte-gluteos-solo')];
const SUPERIOR = [it('flexao-de-bracos'), it('barra-fixa-pronada'), it('flexao-pike')];
const SEG = '2026-11-16'; // segunda; a semana vai até domingo, 22/11
const D = (i) => somaDias(SEG, i);
const inicioEm = (k, hora = 18) => { const [a, m, d] = k.split('-').map(Number); return new Date(a, m - 1, d, hora).toISOString(); };
const sessao = (k, itens) => ({ id: 's' + k.replace(/-/g, ''), planId: 'p1', diaId: 'a', nome: 'Feito', inicio: inicioEm(k), fim: inicioEm(k, 19), nota: '', itens: itens.map((x) => ({ ex: x.ex, alvo: '10', descanso: 90, sets: Array.from({ length: x.series }, () => ({ kg: 20, reps: 10, seg: null, ok: true })) })) });
function respostas(extra = {}) {
  const a = { idade: 34, experiencia: 'regular', kmSemana: 30, longoAtual: 14, pausa: 'treinando', objetivo: 'distancia', distancia: '21', dias: ['2', '4', '6'], diaLongo: '6', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', peso: 75, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], remedios: ['nenhum'], resultado: 'nao', ...extra };
  for (const q of PERGUNTAS) if (!(q.k in a) && !(q.se && !q.se(a)) && !q.opcional) a[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  return a;
}
// corridas das 4 semanas anteriores: terça 8 km, quinta 7 km, sábado 13 km (sem pausa: nada de "volta à corrida")
function corridasAntes(longo = 13) {
  const l = [];
  for (let k = 1; k <= 4; k++) { const s = somaDias(SEG, -7 * k); l.push({ id: `a${k}`, data: somaDias(s, 1), tipo: 'leve', distKm: 8, durMin: 48, pse: 4 }, { id: `b${k}`, data: somaDias(s, 3), tipo: 'leve', distKm: 7, durMin: 42, pse: 4 }, { id: `c${k}`, data: somaDias(s, 5), tipo: 'longo', distKm: longo, durMin: Math.round(longo * 6.2), pse: 4 }); }
  return l;
}
// estado de teste: plano de corrida aceito em 19/10 (terça, quinta e sábado, longão no sábado) e musculação com pernas em `diaPernas`
function estado({ diaPernas = 5, sessoes = [], runs = corridasAntes(), resp = {}, extra = {} } = {}) {
  return store.sanitize({
    v: store.VERSAO,
    plans: [{ id: 'p1', nome: 'P', origem: 'manual', criadoEm: '2026-10-01T10:00:00.000Z', dias: [{ id: 'a', nome: 'Pernas', foco: '', itens: PERNAS }, { id: 'b', nome: 'Superior', foco: '', itens: SUPERIOR }], agenda: { [diaPernas]: 'a', 1: 'b' }, info: '' }],
    activePlan: 'p1', sessions: sessoes, runs, run: { answers: respostas(resp), aceitoEm: '2026-10-19T10:00:00.000Z', inicio: '2026-10-19', pausadoEm: '' }, ...extra,
  });
}
const pernasToda = (ate) => { const l = []; for (let k = 1; k <= 5; k++) l.push(sessao(somaDias(ate, -7 * k), PERNAS)); return l; };
const aplica = (st, hoje) => { const g = aplicarCarga(st, hoje); assert.ok(g, 'há o que aplicar'); return { ...st, run: { ...st.run, carga: g.carga }, perdidos: g.perdidos }; };
const desfaz = (st, hoje) => { const g = desfazerCarga(st, hoje); return { ...st, run: { ...st.run, carga: g.carga }, perdidos: g.perdidos }; };
const confereTextos = (r, rot) => {
  for (const k of r.refs) assert.ok(REFS_CORRIDA[k], `${rot}: fonte desconhecida ${k}`);
  for (const f of r.fatores) assert.ok(f.texto.length > 10 && f.texto.length <= 160 && f.refs.length && f.refs.every((k) => REFS_CORRIDA[k]), `${rot}: fator ${f.id}`);
  for (const a of r.ajustes) assert.ok(a.texto.length <= 90 && a.porque.length > 40 && a.refs.every((k) => REFS_CORRIDA[k]), `${rot}: ajuste ${a.texto}`);
  assert.ok(r.texto.length <= 260, `${rot}: texto curto`);
};

test('carga: semana normal segue como está', () => {
  // treina pernas toda sexta: o corpo já está acostumado (do 3º treino em diante, doma2017)
  const st = estado({ sessoes: pernasToda(D(4)) });
  const r = cargaDaSemana(st, D(2));
  assert.equal(r.nivel, 'normal', JSON.stringify(r.fatores));
  assert.equal(r.ajustes.length, 0);
  assert.match(r.texto, /Semana normal/);
  assert.ok(r.semana && r.semana.longo && r.semana.longo.data === D(5) && r.semana.pernas === 1 && r.anterior.km === 28 && r.anterior.pernas === 1);
  assert.ok(r.semana.previstoKm > 0 && r.semana.previstoMin > 0 && r.semana.fortes >= 1);
  assert.equal(aplicarCarga(st, D(2)), null, 'nada para aplicar');
  confereTextos(r, 'normal');
});

test('carga: 1º treino de pernas depois de 3+ semanas na sexta, antes do longão de sábado', () => {
  const st = estado({ sessoes: [sessao('2026-10-23', PERNAS)] });
  const hoje = D(2); // quarta
  const pern = treinosDePernas(st, hoje);
  assert.deepEqual(pern.map((t) => [t.data, t.n, t.feito]), [['2026-10-23', 1, true], [D(4), 1, false]]);
  assert.equal(pern[1].pausa, 28);
  const r = cargaDaSemana(st, hoje);
  assert.equal(r.nivel, 'puxada');
  assert.match(r.resumo, /^Semana puxada: 1º treino de pernas depois de 4 semanas na sexta\.$/);
  assert.equal(r.ajustes.length, 1);
  const a = r.ajustes[0];
  assert.ok(a.data === D(5) && a.acao === 'curto' && a.corte === 0.5 && a.motivo === 'pernas' && !a.aplicado, JSON.stringify(a));
  assert.match(a.texto, /^Longão de sábado: mais curto, em ritmo de conversa\.$/);
  assert.ok(a.refs.includes('doma2017') && a.refs.includes('damas2016'));
  confereTextos(r, 'pernas');
  // o Início avisa no dia de antes e no dia
  assert.ok(cargaDoDia(st, D(4), D(5)), 'sexta: o longão de amanhã');
  assert.equal(cargaDoDia(st, hoje, D(3)), null);
  // aplicar: o longão fica pela metade, com o mesmo nome; a lista do plano mostra o porquê
  const antes = planoDaSemana(st, hoje).dias[6];
  const st2 = aplica(st, hoje);
  const depois = planoDaSemana(st2, hoje).dias[6];
  assert.equal(depois.nome, 'Longão');
  assert.ok(depois.durMin <= antes.durMin * 0.6 && depois.durMin >= antes.durMin * 0.4, `${antes.durMin} → ${depois.durMin}`);
  assert.ok(depois.blocos.every((b) => b.rotulo !== 'Acelerações') && /^Ritmo de conversa\. Semana puxada/.test(depois.detalhe) && depois.carga === 'pernas');
  const p = planoAtual(st2, hoje);
  assert.ok(p.ajustes.some((x) => x.carga && /mais curto/.test(x.texto) && x.refs.includes('doma2017')));
  // os outros dias não mudam
  for (const wd of [2, 4]) assert.deepEqual(planoDaSemana(st2, hoje).dias[wd].durMin, planoDaSemana(st, hoje).dias[wd].durMin);
  const r2 = cargaDaSemana(st2, hoje);
  assert.ok(r2.aplicado && r2.temAplicado && r2.ajustes[0].aplicado && r2.nivel === 'puxada', 'a proposta continua a mesma, marcada como feita');
  assert.ok(cargaDoDia(st2, D(4), D(5)).aplicado);
  // no sábado, sem o treino de sexta registrado, o ajuste continua no plano e o Início avisa
  const sab0 = cargaDoDia(st2, D(5), D(5));
  assert.ok(sab0 && sab0.aplicado && /Corrida mais curta/.test(sab0.texto), JSON.stringify(sab0));
  // o que vai para o armazenamento passa pela validação
  const salvo = store.sanitize(JSON.parse(JSON.stringify(st2)));
  assert.deepEqual(salvo.run.carga.map((x) => [x.data, x.acao, x.corte, x.motivo]), [[D(5), 'curto', 0.5, 'pernas']]);
  // desfazer: volta ao plano
  const st3 = desfaz(st2, hoje);
  assert.equal(planoDaSemana(st3, hoje).dias[6].durMin, antes.durMin);
  assert.ok(!cargaDaSemana(st3, hoje).temAplicado);
  // no sábado, com o treino de sexta feito, a proposta continua (e o 2º treino da semana que vem também conta como da volta)
  const feito = { ...st, sessions: [...st.sessions, sessao(D(4), PERNAS)] };
  const sab = cargaDaSemana(feito, D(5));
  assert.ok(sab.ajustes.length === 1 && sab.ajustes[0].data === D(5) && /ontem/.test(sab.resumo), sab.resumo);
});

test('carga: do 3º treino de pernas em diante e para quem já treina sem pausa, nada muda', () => {
  const tres = estado({ sessoes: [sessao(D(-10), PERNAS), sessao(D(-3), PERNAS)] });
  const t = treinosDePernas(tres, D(2));
  assert.deepEqual(t.map((x) => x.n), [1, 2, 3]);
  assert.equal(cargaDaSemana(tres, D(2)).ajustes.length, 0);
  // sem histórico no aplicativo, mas o Treinador sabe que a pessoa treina sem pausa
  const semPausa = estado({ extra: { trainer: { answers: { experiencia: 'intermediario', pausa: 'treinando' }, aceitoEm: '2026-11-10T10:00:00.000Z' } } });
  assert.equal(treinosDePernas(semPausa, D(2))[0].n, 3);
  assert.equal(cargaDaSemana(semPausa, D(2)).ajustes.length, 0);
  // sem histórico e sem resposta: por cautela, é o 1º treino
  assert.equal(cargaDaSemana(estado(), D(2)).ajustes.length, 1);
  // exercícios de pernas com menos de 3 séries não contam como treino pesado de pernas
  const leve = store.sanitize({ ...estado(), plans: [{ id: 'p1', nome: 'P', origem: 'manual', criadoEm: '2026-10-01T10:00:00.000Z', dias: [{ id: 'a', nome: 'Leve', foco: '', itens: [it('agachamento-peso-corporal', 2), it('flexao-de-bracos', 3)] }], agenda: { 5: 'a' }, info: '' }] });
  assert.equal(treinosDePernas(leve, D(2)).length, 0);
});

test('carga: treino forte perto do treino de pernas da volta muda de dia (e desfaz)', () => {
  // corrida segunda, quarta, sexta e sábado; pernas na quinta: o longão de sábado (48 h) passa para domingo
  const st = estado({ diaPernas: 4, resp: { dias: ['1', '3', '5', '6'] }, sessoes: [sessao('2026-10-20', PERNAS)] });
  const hoje = D(0);
  const r = cargaDaSemana(st, hoje);
  const a = r.ajustes.find((x) => x.acao === 'mover');
  assert.ok(a, JSON.stringify(r.ajustes));
  assert.ok(a.data === D(5) && a.para === D(6) && /passa para domingo/.test(a.texto), a.texto);
  const st2 = aplica(st, hoje);
  const s = planoDaSemana(st2, hoje);
  assert.ok(!s.dias[6 /* sábado */] && s.dias[0 /* domingo */] && s.dias[0].tipo === 'longo' && s.dias[0].movidaDe === D(5));
  assert.ok(st2.perdidos.some((e) => e.tipo === 'corrida' && e.data === D(5) && e.para === D(6)));
  assert.ok(cargaDaSemana(st2, hoje).aplicado);
  const st3 = desfaz(st2, hoje);
  assert.equal(st3.perdidos.length, 0);
  assert.equal(planoDaSemana(st3, hoje).dias[6].tipo, 'longo');
  // treino forte que não tem para onde ir vira rodagem leve
  const st4 = estado({ diaPernas: 2, resp: { dias: ['1', '2', '4', '6', '0'] }, sessoes: [sessao('2026-10-20', PERNAS)] });
  const r4 = cargaDaSemana(st4, D(0));
  const lv = r4.ajustes.find((x) => x.acao === 'leve');
  assert.ok(lv && /vira rodagem leve/.test(lv.texto), JSON.stringify(r4.ajustes));
  const dia = planoDaSemana(aplica(st4, D(0)), D(0)).dias[new Date(lv.data + 'T12:00:00Z').getUTCDay()];
  assert.equal(dia.tipo, 'leve');
});

test('carga: salto de distância na semana segura o longão; volume que subiu muito só informa', () => {
  // a mais longa dos 30 dias antes da semana: 11 km; na terça, 15 km (+36%): o longão de sábado não passa de 12,1 km
  const runs = [...corridasAntes(11), { id: 'x1', data: D(1), tipo: 'livre', distKm: 15, durMin: 95, pse: 5 }];
  const st = estado({ sessoes: pernasToda(D(4)), runs, resp: { longoAtual: 16, kmSemana: 34 } });
  const r = cargaDaSemana(st, D(2));
  const lg = planoDaSemana(st, D(2)).dias[6];
  // o plano já segura o longão; a semana avisa o limite
  assert.ok(lg.distKm <= 11 * 1.1 + 0.3, 'longão dentro do limite: ' + lg.distKm);
  const f0 = r.fatores.find((x) => x.id === 'salto');
  assert.ok(f0 && /15 km/.test(f0.texto) && /11 km/.test(f0.texto) && /nenhuma passa de 12 km/.test(f0.texto) && f0.refs.includes('frandsen2025'), JSON.stringify(r.fatores));
  assert.ok(r.principal === 'salto' && ['atencao', 'puxada'].includes(r.nivel));
  for (const a of r.ajustes) assert.equal(a.motivo, 'salto');
  // outra corrida da semana acima do limite (prevista maior que 12,1 km) fica mais curta
  const longa = estado({ sessoes: pernasToda(D(4)), runs, resp: { longoAtual: 16, kmSemana: 34 } });
  const pl = planoDaSemana(longa, D(2));
  const acima = pl.dias.filter((d) => d && d.data >= D(2) && d.distKm > 11 * 1.1 + 0.3);
  const rl = cargaDaSemana(longa, D(2));
  assert.equal(rl.ajustes.length, acima.length, JSON.stringify(rl.ajustes));
  for (const a of rl.ajustes) assert.ok(a.acao === 'curto' && a.corte >= 0.05 && a.corte <= 0.5);
  confereTextos(r, 'salto');
  // volume: semana passada com 9 km; nesta, 3 corridas de 8 km (nenhuma acima da maior do mês): só informa
  const poucas = corridasAntes(12).filter((x) => !x.id.endsWith('1') || x.id === 'c1');
  const vol = estado({ sessoes: pernasToda(D(4)), runs: [...poucas, { id: 'v1', data: D(0), tipo: 'leve', distKm: 8, durMin: 48 }, { id: 'v2', data: D(1), tipo: 'leve', distKm: 8, durMin: 48 }, { id: 'v3', data: D(2), tipo: 'leve', distKm: 8, durMin: 48 }] });
  const rv = cargaDaSemana(vol, D(2));
  const f = rv.fatores.find((x) => x.id === 'volume');
  assert.ok(f && /mais km que a passada/.test(f.texto) && f.refs.includes('impellizzeri2020'), JSON.stringify(rv.fatores));
  assert.ok(!rv.ajustes.some((x) => x.motivo === 'volume'), 'volume não gera ajuste');
});

test('carga: sono ruim e cansaço só informam', () => {
  // dia de treino forte (terça) com 5 h de sono
  const st = estado({ sessoes: pernasToda(D(4)), extra: { sono: { registros: [{ data: D(1), horas: 5 }] } } });
  const s = planoDaSemana(st, D(1)).dias[2];
  const r = cargaDaSemana(st, D(1));
  const f = r.fatores.find((x) => x.id === 'sono');
  assert.ok(f && /Noite curta \(5 h\)/.test(f.texto) && f.refs.includes('craven2022'), JSON.stringify(r.fatores));
  if (s.intensidade !== 'leve') assert.match(f.texto, /de manhã/);
  assert.equal(r.nivel, 'atencao');
  assert.equal(r.ajustes.length, 0);
  assert.match(r.texto, /seguem como estão/);
  // 7 h e bem descansado: nada
  const bem = estado({ sessoes: pernasToda(D(4)), extra: { sono: { registros: [{ data: D(1), horas: 7.5, qualidade: 4 }] } } });
  assert.ok(!cargaDaSemana(bem, D(1)).fatores.some((x) => x.id === 'sono'));
  // acordou cansado
  const cansado = estado({ sessoes: pernasToda(D(4)), extra: { sono: { registros: [{ data: D(1), horas: 7.5, qualidade: 1 }] } } });
  assert.ok(cargaDaSemana(cansado, D(1)).fatores.some((x) => x.id === 'sono' && /acordou cansado/.test(x.texto)));
  // "Não corri" por cansaço nesta semana
  const marca = estado({ sessoes: pernasToda(D(4)), extra: { perdidos: [{ tipo: 'corrida', data: D(1), em: '2026-11-17T20:00:00.000Z', motivo: 'cansaco' }] } });
  assert.ok(cargaDaSemana(marca, D(2)).fatores.some((x) => x.id === 'cansaco'));
});

test('carga: com dor, o plano já ajusta e a semana não ajusta de novo', () => {
  const dor = [{ id: 'd1', onde: 'joelho', nivel: 5, tipo: 'articular', quando: 'durante', data: D(1) }];
  const st = estado({ sessoes: [sessao('2026-10-23', PERNAS)], extra: { dores: dor } });
  const r = cargaDaSemana(st, D(2));
  assert.ok(r.fatores.some((f) => f.id === 'dor' && /joelho/.test(f.texto)), JSON.stringify(r.fatores));
  // o longão de sábado já ficou pela metade por causa da dor: nenhum ajuste a mais nele
  assert.ok(!r.ajustes.some((a) => a.data === D(5)), JSON.stringify(r.ajustes));
  confereTextos(r, 'dor');
});

test('carga: protegidos — sem plano, saúde sem liberação, entradas estranhas', () => {
  assert.equal(cargaDaSemana(null, D(2)).nivel, 'sem_plano');
  assert.equal(cargaDaSemana({}, D(2)).nivel, 'sem_plano');
  assert.equal(cargaDaSemana(estado(), 'ontem').nivel, 'sem_plano');
  assert.equal(cargaDaSemana(store.sanitize({ v: store.VERSAO }), D(2)).nivel, 'sem_plano');
  // doença do coração sem liberação médica: não há plano, nada a propor
  const cor = estado({ sessoes: [sessao('2026-10-23', PERNAS)], resp: { condicoes: ['coracao'], liberado: 'nao' } });
  assert.equal(planoAtual(cor, D(2)), null);
  const rc = cargaDaSemana(cor, D(2));
  assert.ok(rc.nivel === 'sem_plano' && !rc.ajustes.length);
  assert.equal(aplicarCarga(cor, D(2)), null);
  // plano pausado
  const pausado = estado({ sessoes: [sessao('2026-10-23', PERNAS)] });
  pausado.run.pausadoEm = '2026-11-10T10:00:00.000Z';
  assert.equal(cargaDaSemana(pausado, D(2)).nivel, 'sem_plano');
  // lixo no estado não derruba a análise
  const lixo = estado();
  lixo.sessions.push({ inicio: 'x', itens: 'y' }, null, { inicio: inicioEm(D(0)), itens: [{ ex: '__proto__', sets: [{ ok: true }] }] });
  lixo.perdidos = [null, 3, { tipo: 'corrida' }];
  lixo.sono = { registros: [{ data: D(2), horas: 'muito' }, null] };
  assert.doesNotThrow(() => cargaDaSemana(lixo, D(2)));
  assert.doesNotThrow(() => desfazerCarga({ run: null, perdidos: 'x' }, D(2)));
  // validação de state.run.carga (backup importado)
  const sujo = [{ data: D(5), acao: 'curto', corte: 9, motivo: 'pernas' }, { data: D(5), acao: 'leve', motivo: 'pernas' }, { data: D(4), acao: 'mover', para: D(9), motivo: 'pernas' },
    { data: D(3), acao: 'apagar', motivo: 'pernas' }, { data: D(2), acao: 'leve', motivo: '__proto__' }, { data: '2026-13-01', acao: 'leve', motivo: 'pernas' }, { data: D(1), acao: 'curto', motivo: 'salto' }, 'x', null];
  assert.deepEqual(limparCarga(sujo), [{ data: D(5), acao: 'curto', motivo: 'pernas', em: '', corte: 0.5 }]);
  assert.equal(limparCarga(Array.from({ length: 200 }, (_, i) => ({ data: somaDias('2026-01-01', i), acao: 'leve', motivo: 'salto' }))).length, 30);
  assert.deepEqual(limparCorrida({ carga: [{ data: D(5), acao: 'leve', motivo: 'pernas' }] }).carga, [], 'sem plano aceito, não guarda');
  for (const k of Object.keys(MOTIVOS_CARGA)) assert.ok(MOTIVOS_CARGA[k].refs.every((x) => REFS_CORRIDA[x]) && MOTIVOS_CARGA[k].curto.length < 60);
});

test('carga: ajuste de um dia que já passou ou que deixou de valer não muda o plano', () => {
  const st = estado({ sessoes: [sessao('2026-10-23', PERNAS)] });
  const st2 = aplica(st, D(2));
  // na semana seguinte, o ajuste de sábado passado não pesa em nada
  const prox = planoDaSemana(st2, D(8));
  const base = planoDaSemana(st, D(8));
  assert.deepEqual(prox.dias.map((d) => d && d.durMin), base.dias.map((d) => d && d.durMin));
  // o treino de pernas saiu da agenda: a proposta some e o "Desfazer" continua
  const semPernas = { ...st2, plans: [{ ...st2.plans[0], agenda: { 1: 'b' } }] };
  const r = cargaDaSemana(semPernas, D(2));
  assert.ok(!r.ajustes.length && r.temAplicado);
});

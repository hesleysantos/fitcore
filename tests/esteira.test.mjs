// Corrida do plano na esteira (logic/esteira.js): conversão de ritmo em km/h, inclinação, tiros, longão, quem pode trocar,
// a marcação no estado e a validação do que fica guardado (e do backup).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../www/js/logic/esteira.js';
import * as store from '../www/js/store.js';
import { treinoDoDia, expandirBlocos, limparRegistro, evolucao, somaDias, planoAtual } from '../www/js/logic/corrida.js';
import { REFS_CORRIDA } from '../www/js/data/corrida.js';
import { marcaCorrida, limparPerdidos } from '../www/js/logic/perdido.js';

const base = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 12, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
const novato = { experiencia: 'nunca', objetivo: 'comecar', dias: ['1', '3', '5'], diaLongo: 'auto', tempo: '45', aparelho: 'nada', local: 'rua', idade: 30, peso: 70, altura: 170, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
const HOJE = '2026-11-17'; // terça-feira
const D = (k) => somaDias(HOJE, k);
const J = (x) => JSON.parse(JSON.stringify(x));
const estado = (answers, extra = {}) => store.sanitize({ run: { answers, aceitoEm: '2026-10-01T12:00:00.000Z', inicio: '2026-09-28', ...(extra.run || {}) }, runs: extra.runs || [], dores: extra.dores || [], perdidos: extra.perdidos || [] });
const tipoEm = (st, d) => { const t = treinoDoDia(st, HOJE, d); return t ? t.tipo : null; };
const acharDia = (st, f) => { for (let k = 0; k <= 6; k++) { const t = treinoDoDia(st, HOJE, D(k)); if (t && f(t)) return D(k); } return null; };

test('conversão: ritmo (s/km) em km/h, com 1 casa, conta exata', () => {
  assert.equal(E.kmhDe(300), 12); // 5:00 por km
  assert.equal(E.kmhDe(330), 10.9); // 5:30 → 3600 / 330 = 10,909...
  assert.equal(E.kmhDe(240), 15); // 4:00
  assert.equal(E.kmhDe(360), 10); // 6:00
  assert.equal(E.kmhDe(397), 9.1);
  assert.equal(E.kmhDe(450), 8);
});

test('rodagem leve: velocidades da faixa leve do plano e inclinação de 0 a 1%', () => {
  const st = estado(base);
  const d = acharDia(st, (t) => t.tipo === 'leve' && !t.blocos.some((b) => b.rotulo === 'Acelerações'));
  assert.ok(d, 'há um dia leve na semana');
  const t = treinoDoDia(st, HOJE, d);
  const v = E.versaoNaEsteira(st, d, HOJE);
  assert.equal(v.inclinacao, '0 a 1%');
  assert.equal(v.titulo, 'Rodagem leve na esteira');
  const P = t.plano.ritmos;
  const leve = v.velocidades.find((x) => x.trecho === 'Corrida leve');
  assert.equal(leve.de, E.kmhDe(P.leve.ate), 'ponta lenta da faixa');
  assert.equal(leve.ate, E.kmhDe(P.leve.de), 'ponta rápida da faixa');
  assert.ok(leve.de < leve.kmh && leve.kmh < leve.ate);
  assert.match(leve.texto, /^\d+,\d a \d+,\d km\/h$/);
  assert.ok(v.detalhes.some((x) => /60 ÷ ritmo/.test(x)), 'o "Por quê?" mostra a conta');
  assert.ok(v.avisos.some((x) => /chave de segurança/.test(x)) && v.avisos.some((x) => /Nunca pule/.test(x)));
  assert.ok(v.refs.includes('miller2019') && v.refs.every((k) => REFS_CORRIDA[k]));
  for (const l of [...v.linhas, ...v.avisos]) assert.ok(l.length > 20 && l.length < 200, l);
});

test('tiros: velocidade de cada trecho, 1% de inclinação, troca antes do apito e cronômetro com as mesmas etapas', () => {
  const st = estado(base);
  const d = acharDia(st, (t) => t.intensidade === 'forte' && t.blocos.some((b) => b.repeticoes > 1 && b.pausa));
  assert.ok(d, 'há um treino forte com tiros na semana');
  const t = treinoDoDia(st, HOJE, d);
  const v = E.versaoNaEsteira(st, d, HOJE);
  assert.equal(v.inclinacao, '1%', 'treino com trechos rápidos: 1% (miller2019)');
  const tiro = t.blocos.find((b) => b.repeticoes > 1 && b.ritmo);
  const vt = v.velocidades.find((x) => x.trecho === tiro.rotulo);
  assert.deepEqual([vt.de, vt.ate], [E.kmhDe(tiro.ritmo.ate), E.kmhDe(tiro.ritmo.de)]);
  assert.ok(v.velocidades.some((x) => x.trecho === 'Aquecimento') && v.velocidades.some((x) => /^Trote/.test(x.trecho)), 'aquecimento e trote também têm velocidade');
  assert.ok(vt.kmh > v.velocidades.find((x) => x.trecho === 'Aquecimento').kmh, 'o tiro é mais rápido que o aquecimento');
  assert.ok(v.linhas.some((x) => /uns segundos antes do apito/.test(x) && /sobre a lona/.test(x)));
  // cronômetro: as mesmas etapas e durações do plano (a assinatura do cronômetro guardado não muda), com a velocidade
  const ref = expandirBlocos(t.blocos, (t.ritmo.de + t.ritmo.ate) / 2);
  const et = E.etapasNaEsteira(v.blocos, (t.ritmo.de + t.ritmo.ate) / 2);
  assert.deepEqual(et.map((p) => [p.tipo, p.seg, p.m]), ref.map((p) => [p.tipo, p.seg, p.m]));
  assert.ok(et.filter((p) => p.tipo === 'forte').every((p) => p.vel === vt.texto));
  assert.ok(et.filter((p) => p.tipo === 'trote').every((p) => /trote/.test(p.vel)));
  assert.ok(v.resumoBlocos.some((x) => x.includes(vt.texto)));
});

test('acelerações curtas saem na esteira; o resto do treino fica igual', () => {
  const st = estado(base);
  // as acelerações aparecem na semana que vem, no começo dela
  const d = [7, 8, 9, 10, 11, 12, 13].map(D).find((x) => { const t = treinoDoDia(st, HOJE, x); return t && t.blocos.some((b) => b.rotulo === 'Acelerações'); });
  assert.ok(d, 'há um dia com acelerações');
  const v = E.versaoNaEsteira(st, d, HOJE);
  assert.ok(!v.blocos.some((b) => b.rotulo === 'Acelerações'));
  assert.ok(v.blocos.some((b) => b.rotulo === 'Corrida leve'));
  assert.ok(v.linhas.some((x) => /Sem as acelerações curtas/.test(x)));
});

test('longão na esteira: água, lugar ventilado e esforço de conversa; sem inventar divisão em blocos', () => {
  const st = estado(base);
  const d = acharDia(st, (t) => t.tipo === 'longo');
  assert.ok(d);
  const t = treinoDoDia(st, HOJE, d);
  const v = E.versaoNaEsteira(st, d, HOJE);
  assert.equal(v.titulo, 'Longão na esteira');
  assert.ok(v.linhas.some((x) => /água/.test(x) && /ventilado/.test(x) && /esforço de conversa/.test(x)));
  assert.ok(v.refs.includes('kenefick2018'));
  assert.equal(v.blocos.length, t.blocos.length, 'o longão não é dividido');
  const P = t.plano.ritmos;
  assert.ok(v.velocidades.some((x) => x.de === E.kmhDe(P.longo.ate) && x.ate === E.kmhDe(P.longo.de)));
});

test('sem ritmos calculados (plano por esforço) e corrida e caminhada: velocidade pelo esforço', () => {
  const semRes = { ...base, resultado: 'nao' }; delete semRes.resultadoMin;
  const st = estado(semRes);
  const d = acharDia(st, (t) => t.tipo !== 'descanso');
  const v = E.versaoNaEsteira(st, d, HOJE);
  assert.equal(v.velocidades.length, 0);
  assert.ok(v.linhas.some((x) => /pelo esforço/.test(x) && /um pouco mais devagar/.test(x)));
  const stN = estado(novato);
  const dn = acharDia(stN, (t) => t.tipo === 'corrida_caminhada');
  assert.ok(dn, 'o novato tem corrida e caminhada na semana');
  const vn = E.versaoNaEsteira(stN, dn, HOJE);
  assert.equal(vn.velocidades.length, 0);
  assert.equal(vn.inclinacao, '0 a 1%');
  assert.ok(vn.linhas.some((x) => /dá para conversar/.test(x) && /sem descer da lona/.test(x)));
  assert.ok(E.podeNaEsteira(stN, dn, HOJE).pode);
});

test('podeNaEsteira: dias, plano, saúde, registro, perdido, cronômetro e idade', () => {
  const st = estado(base);
  const dLeve = acharDia(st, (t) => t.tipo === 'leve');
  assert.deepEqual(E.podeNaEsteira(st, dLeve, HOJE), { pode: true, motivo: '' });
  assert.ok(E.diasPossiveis(st, HOJE).length >= 3);
  const nao = (s, d, re) => { const r = E.podeNaEsteira(s, d, HOJE); assert.equal(r.pode, false, d); assert.match(r.motivo, re); };
  nao(st, 'xx', /inválida/);
  nao(st, '2026-02-30', /inválida/);
  nao(st, D(-1), /já passou/);
  nao(st, D(8), /próximos 7 dias/);
  const semCorrida = [0, 1, 2, 3, 4, 5, 6].map(D).find((x) => !tipoEm(st, x));
  nao(st, semCorrida, /Não há corrida/);
  nao(store.sanitize({}), HOJE, /Sem plano/);
  nao(estado(base, { run: { pausadoEm: '2026-11-10T12:00:00.000Z' } }), dLeve, /pausado/);
  // doença do coração sem liberação médica: não há plano
  const cardio = estado({ ...base, condicoes: ['cardiaca'], liberado: 'nao' });
  assert.equal(planoAtual(cardio, HOJE), null);
  nao(cardio, dLeve, /suspenso/);
  // plano que já é na esteira
  nao(estado({ ...base, aparelho: 'esteira' }), dLeve, /já é feito na esteira/);
  nao(estado({ ...base, local: 'esteira' }), dLeve, /já é feito na esteira/);
  assert.equal(E.versaoNaEsteira(estado({ ...base, aparelho: 'esteira' }), dLeve, HOJE), null);
  // menor de 16 anos (os manuais pedem que fique longe da esteira)
  const jovem = estado({ ...base, idade: 14 });
  const dj = acharDia(jovem, (t) => t.tipo !== 'descanso');
  assert.ok(dj, 'o plano do jovem tem treino');
  nao(jovem, dj, /menores de 16/);
  // corrida já registrada
  nao(estado(base, { runs: [{ id: 'r1', data: dLeve, tipo: 'leve', distKm: 5, durMin: 30, pse: 3, dores: [], nota: '', planejado: '' }] }), dLeve, /já foi registrada/);
  // "Não corri" marcado nesse dia
  const comPerdido = { ...J(st), perdidos: limparPerdidos([marcaCorrida(HOJE, HOJE + 'T10:00:00.000Z')]) };
  assert.ok(tipoEm(st, HOJE), 'há corrida hoje');
  nao(comPerdido, HOJE, /não correu/);
  // cronômetro rodando nesse dia
  const cr = J(st); cr.run.cron = { data: dLeve, i: 0, fim: 0, pausadoEm: 0, inicio: Date.now(), parado: 0, inicioPasso: Date.now(), terminado: 0, chave: 1 };
  nao(cr, dLeve, /cronômetro/);
  // dor forte: o dia sai do plano (descanso) e não vai para a esteira
  const dor = estado(base, { dores: [{ id: 'd1', data: HOJE, onde: 'joelho', lado: '', tipo: 'aguda', quando: 'durante', nivel: 8, nota: '', fim: '' }] });
  const dDor = [0, 1, 2, 3, 4, 5, 6].map(D).find((x) => tipoEm(dor, x) === 'descanso');
  assert.ok(dDor, 'a dor forte tira a corrida de algum dia');
  nao(dor, dDor, /dor/); assert.equal(E.versaoNaEsteira(dor, dDor, HOJE), null);
  // dia da prova (objetivo prova): a corrida é no local da prova
  // caminhada do plano também pode ir para a esteira (quem está começando, com 5 dias: os dias a mais são de caminhada)
  const prova = estado({ ...base, experiencia: 'nunca', objetivo: 'comecar', dias: ['1', '2', '3', '4', '5'] });
  const dCam = [0, 1, 2, 3, 4, 5, 6].map(D).find((x) => tipoEm(prova, x) === 'caminhada');
  assert.ok(dCam && E.podeNaEsteira(prova, dCam, HOJE).pode);
  assert.ok(E.versaoNaEsteira(prova, dCam, HOJE).linhas.some((x) => /Passo firme/.test(x)));
});

test('dia da prova cai nesta semana: não vai para a esteira', () => {
  // plano de 8 semanas aceito há 7 semanas: a prova é nesta semana
  const st = store.sanitize({ run: { answers: { ...base, semanasProva: 8 }, aceitoEm: '2026-09-28T12:00:00.000Z', inicio: '2026-09-28' } });
  const p = planoAtual(st, HOJE);
  assert.ok(p);
  const d = [0, 1, 2, 3, 4, 5, 6].map(D).find((x) => tipoEm(st, x) === 'prova');
  assert.ok(d, 'a prova está nesta semana');
  const r = E.podeNaEsteira(st, d, HOJE);
  assert.equal(r.pode, false);
  assert.match(r.motivo, /local da prova/);
});

test('marcarEsteira: marca, desmarca, recusa o que não pode e limpa datas velhas', () => {
  const s = J(estado(base));
  const dLeve = acharDia(s, (t) => t.tipo === 'leve');
  const semCorrida = [0, 1, 2, 3, 4, 5, 6].map(D).find((x) => !tipoEm(s, x));
  s.run.esteira = ['2026-10-01', 'lixo', D(-2)];
  assert.equal(E.naEsteira(s, dLeve), false);
  assert.equal(E.marcarEsteira(s, dLeve, true, HOJE), true);
  assert.equal(E.naEsteira(s, dLeve), true);
  assert.deepEqual(s.run.esteira, [D(-2), dLeve].sort(), 'tira a data velha e o lixo; a de 2 dias atrás fica');
  assert.equal(E.marcarEsteira(s, dLeve, true, HOJE), true, 'marcar de novo não duplica');
  assert.equal(s.run.esteira.filter((x) => x === dLeve).length, 1);
  assert.equal(E.marcarEsteira(s, semCorrida, true, HOJE), false, 'dia sem corrida');
  assert.equal(E.marcarEsteira(s, D(-1), true, HOJE), false, 'dia que passou');
  assert.equal(E.marcarEsteira(s, 'xx', true, HOJE), false);
  assert.ok(!s.run.esteira.includes(semCorrida));
  // com o cronômetro rodando no dia, não troca (nem volta para a rua)
  s.run.cron = { data: dLeve, i: 0, fim: 0, pausadoEm: 0, inicio: Date.now(), parado: 0, inicioPasso: Date.now(), terminado: 0, chave: 1 };
  assert.equal(E.marcarEsteira(s, dLeve, false, HOJE), false);
  assert.equal(E.naEsteira(s, dLeve), true);
  s.run.cron = null;
  assert.equal(E.marcarEsteira(s, dLeve, false, HOJE), true);
  assert.equal(E.naEsteira(s, dLeve), false);
  assert.equal(E.marcarEsteira({}, dLeve, true, HOJE), false);
  assert.equal(E.naEsteira(null, dLeve), false);
});

test('limparEsteira: só datas válidas, sem repetir, recentes e em ordem', () => {
  assert.deepEqual(E.limparEsteira(null, HOJE), []);
  assert.deepEqual(E.limparEsteira('2026-11-17', HOJE), []);
  assert.deepEqual(E.limparEsteira([D(3), D(3), D(1), '2026-13-01', 5, { a: 1 }, D(-15), D(-14), D(30), '__proto__'], HOJE), [D(-14), D(1), D(3)]);
  const muitas = Array.from({ length: 40 }, (_, k) => D(-14 + (k % 22)));
  assert.ok(E.limparEsteira(muitas, HOJE).length <= 16);
});

test('sanitize e backup: a marcação e o "na esteira" do registro passam; lixo não', () => {
  const hoje = E.hojeLocal();
  const st = store.sanitize({ run: { answers: base, aceitoEm: '2026-10-01T12:00:00.000Z', inicio: '2026-09-28', esteira: [hoje, hoje, 'x', '1999-01-01', somaDias(hoje, 2)] },
    runs: [{ id: 'r1', data: '2026-11-10', tipo: 'leve', distKm: 6, durMin: 36, pse: 3, dores: [], nota: '', planejado: '', local: 'esteira' }, { id: 'r2', data: '2026-11-12', tipo: 'leve', distKm: 6, durMin: 36, pse: 3, dores: [], nota: '', planejado: '', local: 'marte' }] });
  assert.deepEqual(st.run.esteira, [hoje, somaDias(hoje, 2)]);
  assert.equal(st.runs.find((r) => r.id === 'r1').local, 'esteira');
  assert.equal('local' in st.runs.find((r) => r.id === 'r2'), false, 'local desconhecido não é guardado');
  assert.deepEqual(store.sanitize({}).run.esteira, []);
  assert.deepEqual(store.sanitize({ run: { esteira: { a: 1 } } }).run.esteira, []);
  // backup: exporta e lê de volta
  const txt = JSON.stringify({ app: 'fitcore', v: store.VERSAO, exportadoEm: new Date().toISOString(), dados: st });
  const lido = store.readBackup(txt);
  assert.deepEqual(lido.dados.run.esteira, st.run.esteira);
  assert.equal(lido.dados.runs.find((r) => r.id === 'r1').local, 'esteira');
  // registro
  assert.equal(limparRegistro({ id: 'a', data: '2026-11-10', tipo: 'leve', distKm: 5, durMin: 30, local: 'esteira' }).local, 'esteira');
  assert.equal('local' in limparRegistro({ id: 'a', data: '2026-11-10', tipo: 'leve', distKm: 5, durMin: 30, local: 'rua' }), false);
});

test('evolução: a corrida na esteira conta no volume; a tendência de ritmo compara corridas do mesmo lugar', () => {
  const r = (id, data, ritmoSeg, local) => ({ id, data, tipo: 'leve', distKm: 6, durMin: (6 * ritmoSeg) / 60, pse: 3, dores: [], nota: '', planejado: '', ...(local ? { local } : {}) });
  // rua cada vez mais rápida; uma esteira mais lenta no fim não vira "piora" nem entra na conta da rua
  const rua = [r('a', '2026-10-20', 400), r('b', '2026-10-24', 395), r('c', '2026-10-28', 380), r('d', '2026-11-01', 375), r('e', '2026-11-05', 370)];
  const comEsteira = [...rua, r('f', '2026-11-09', 420, 'esteira')];
  const ev = evolucao(comEsteira, '2026-11-17');
  assert.equal(ev.totalCorridas, 6);
  assert.equal(ev.totalKm, 36, 'os 6 km da esteira contam');
  assert.ok(ev.ritmoLeve.length === 1 && ev.ritmoLeve[0].ritmo === 420, 'a mais recente é na esteira: compara só esteira');
  const ev2 = evolucao([...comEsteira, r('g', '2026-11-12', 365)], '2026-11-17');
  assert.ok(ev2.ritmoLeve.every((x) => x.ritmo !== 420), 'a mais recente é na rua: a esteira fica fora da tendência');
  assert.ok(ev2.tendenciaRitmo > 0, 'a rua está mais rápida');
});

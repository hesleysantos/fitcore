// Tempo sem treinar antes de voltar: Treinador, sugestão de carga e dicas da Evolução.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import { nivelPausa, cortePausa, duracaoTxt, maiorPausa, FAIXAS_PAUSA, FAIXA_DA_RESPOSTA, voltaEm, semanasDeTransicao, IRV_MAX, CORTE_CARDIO } from '../www/js/logic/pausa.js';
import { PERGUNTAS, respostasCompletas, gerarPlano, perfil, volumeSemanal, tetoSeries } from '../www/js/logic/trainer.js';
import { sugestao, retomada, voltaDePausa, seriesNaVolta, descansoNaVolta } from '../www/js/logic/progress.js';
import { analisar, retomadaRecente } from '../www/js/logic/insights.js';
import { REFS, FAQ_TREINO } from '../www/js/data/knowledge.js';

const DIA = 86400000;
const AGORA = Date.parse('2026-11-10T18:00:00.000Z');
const iso = (t) => new Date(t).toISOString();
const GYM = { all: true, has: {} };
const base = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'avancado', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };
const EX = 'supino-reto-barra';
// treino feito há `d` dias: sets = [[kg, reps], ...]
const sess = (d, sets, ex = EX) => ({ id: 's' + d, planId: '', diaId: '', nome: 't', inicio: iso(AGORA - d * DIA), fim: iso(AGORA - d * DIA + 3600000), nota: '', itens: [{ ex, alvo: '8-12', descanso: 90, sets: sets.map(([kg, reps]) => ({ kg, reps, seg: null, ok: true })) }] });
const tres = (kg, reps) => [[kg, reps], [kg, reps], [kg, reps]];

test('pausa: faixas, textos e maior intervalo sem treinar', () => {
  assert.deepEqual([0, 13, 14, 27, 28, 89, 90, 179, 180, 900].map(nivelPausa), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(nivelPausa(NaN), 0); assert.equal(nivelPausa(-5), 0); assert.equal(nivelPausa(undefined), 0);
  for (let i = 1; i < FAIXAS_PAUSA.length; i++) {
    assert.ok(FAIXAS_PAUSA[i].min > FAIXAS_PAUSA[i - 1].min && FAIXAS_PAUSA[i].corte > FAIXAS_PAUSA[i - 1].corte, 'faixas em ordem crescente');
    assert.ok(cortePausa(i) > 0 && cortePausa(i) <= 0.5);
  }
  assert.equal(cortePausa(0), 0); assert.equal(cortePausa(99), 0);
  assert.equal(duracaoTxt(1), '1 dia'); assert.equal(duracaoTxt(12), '12 dias'); assert.equal(duracaoTxt(21), '3 semanas');
  assert.equal(duracaoTxt(75), '3 meses'); assert.equal(duracaoTxt(365), '1 ano'); assert.equal(duracaoTxt(800), '2 anos');
  for (let d = 0; d < 1500; d++) assert.match(duracaoTxt(d), /^\d+ (dia|dias|semanas|meses|ano|anos)$/);
  // treinos há 100, 97 e 40 dias: de 97 dias atrás até agora, o maior intervalo é 57 dias (de 97 a 40)
  const ts = [100, 97, 40].map((d) => AGORA - d * DIA);
  assert.equal(maiorPausa(ts, ts[1], AGORA), 57);
  assert.equal(maiorPausa(ts, ts[2], AGORA), 40);
  assert.equal(maiorPausa([], AGORA - 5 * DIA, AGORA), 5);
  // as respostas da entrevista correspondem às faixas
  const q = PERGUNTAS.find((x) => x.k === 'pausa');
  assert.deepEqual(q.op.map((o) => FAIXA_DA_RESPOSTA[o[0]]), [0, 1, 2, 3, 4]);
});

test('Treinador: a pergunta de tempo parado é opcional, some para quem nunca treinou e muda a dose', () => {
  const q = PERGUNTAS.find((x) => x.k === 'pausa');
  assert.ok(q && q.opcional && typeof q.se === 'function');
  assert.ok(PERGUNTAS.indexOf(q) === PERGUNTAS.findIndex((x) => x.k === 'experiencia') + 1, 'vem logo depois da experiência');
  assert.equal(q.se({ experiencia: 'nunca' }), false); assert.equal(q.se({ experiencia: 'avancado' }), true);
  // entrevistas salvas antes de a pergunta existir continuam completas; resposta inválida não
  assert.ok(respostasCompletas(base));
  assert.ok(respostasCompletas({ ...base, pausa: '3a6m' }));
  assert.ok(!respostasCompletas({ ...base, pausa: 'ontem' }));
  assert.ok(respostasCompletas({ ...base, experiencia: 'nunca' }));
  // sem resposta = sem pausa
  assert.equal(perfil(base).retorno, 0); assert.equal(perfil(base).nivel, 3);
  assert.equal(perfil({ ...base, pausa: 'treinando' }).retorno, 0);
  // até 3 meses: o nível não muda, só as orientações
  for (const p of ['2a4s', '1a3m']) { const pf = perfil({ ...base, pausa: p }); assert.equal(pf.nivel, 3); assert.ok(pf.retorno >= 1 && !pf.inativo); }
  // 3 a 6 meses: um nível abaixo; mais de 6 meses: dose de iniciante
  assert.equal(perfil({ ...base, pausa: '3a6m' }).nivel, 2);
  assert.equal(perfil({ ...base, pausa: 'mais6m' }).nivel, 1);
  assert.equal(perfil({ ...base, experiencia: 'iniciante', pausa: '3a6m' }).nivel, 1);
  assert.equal(perfil({ ...base, pausa: '3a6m' }).nivelBase, 3);
  // quem nunca treinou não tem "volta"
  assert.equal(perfil({ ...base, experiencia: 'nunca', pausa: 'mais6m' }).retorno, 0);
  // triagem: parado há 3 meses ou mais com doença crônica pede liberação médica, como o sedentário
  assert.equal(perfil({ ...base, condicoes: ['diabetes'] }).liberacao, false);
  assert.equal(perfil({ ...base, condicoes: ['diabetes'], pausa: '1a3m' }).liberacao, false);
  assert.equal(perfil({ ...base, condicoes: ['diabetes'], pausa: '3a6m' }).liberacao, true);
  assert.equal(perfil({ ...base, condicoes: ['hipertensao'], pausa: 'mais6m' }).liberacao, true);

  const total = (p) => p.dias.reduce((n, d) => n + d.itens.reduce((m, it) => m + it.series, 0), 0);
  const semPausa = gerarPlano(base, GYM, 0);
  assert.ok(!semPausa.avisos.some((a) => /parado/.test(a.texto)));
  for (const objetivo of ['hipertrofia', 'emagrecimento', 'forca', 'saude', 'resistencia']) for (const experiencia of ['iniciante', 'intermediario', 'avancado']) for (const dias of ['2', '4', '6']) {
    const a0 = { ...base, objetivo, experiencia, dias };
    const p0 = gerarPlano(a0, GYM, 0);
    for (const pausa of ['2a4s', '1a3m', '3a6m', 'mais6m']) {
      const rot = `${objetivo}/${experiencia}/${dias}/${pausa}`;
      const p = gerarPlano({ ...a0, pausa }, GYM, 0);
      assert.equal(p.dias.length, p0.dias.length, rot);
      const av = p.avisos.filter((x) => /^Volta depois de/.test(x.texto));
      assert.equal(av.length, 1, 'um aviso de volta: ' + rot);
      assert.ok(!/undefined|NaN/.test(av[0].texto), rot);
      if (FAIXA_DA_RESPOSTA[pausa] < 3) assert.equal(total(p), total(p0), 'até 3 meses o plano é o mesmo: ' + rot);
      else {
        // (o total de séries não é comparável entre níveis: na força, o nível mais alto descansa mais e cabe menos exercício no tempo)
        for (const d of p.dias) for (const it of d.itens) assert.ok(it.series <= 3, `até 3 séries por exercício na volta (${rot})`);
        const v = volumeSemanal(p.dias);
        // o teto de séries por grupo é o do nível já rebaixado pela pausa
        const teto = tetoSeries(perfil({ ...a0, pausa }).nivel) * 1.5;
        for (const g of Object.keys(v)) assert.ok(v[g] <= teto + 0.01, `séries de ${g} acima do teto na volta (${rot}): ${v[g]} > ${teto}`);
      }
    }
  }
  // o avançado que ficou mais de 6 meses parado recebe menos séries do que o que está treinando
  assert.ok(total(gerarPlano({ ...base, pausa: 'mais6m' }, GYM, 0)) < total(semPausa));
  // 65 anos ou mais: aviso extra
  assert.match(gerarPlano({ ...base, idade: 68, pausa: '1a3m' }, GYM, 0).avisos.find((x) => /^Volta depois/.test(x.texto)).texto, /65 anos/);
  assert.doesNotMatch(gerarPlano({ ...base, idade: 40, pausa: '1a3m' }, GYM, 0).avisos.find((x) => /^Volta depois/.test(x.texto)).texto, /65 anos/);
});

test('sugestão de carga: a volta depois de uma pausa reduz a carga conforme o tempo parado', () => {
  const sug = () => retomada(EX, sugestao(EX, '8-12', 3), '8-12', AGORA);
  // treinando normalmente (último treino há 3 dias): nada muda
  store.update((s) => { s.sessions = [sess(6, tres(60, 10)), sess(3, tres(60, 10))]; });
  assert.deepEqual(sug(), sugestao(EX, '8-12', 3));
  // 13 dias: ainda não é pausa
  store.update((s) => { s.sessions = [sess(13, tres(60, 10))]; });
  assert.deepEqual(sug(), sugestao(EX, '8-12', 3));
  // cada faixa corta mais do que a anterior, e a carga sai em múltiplos de anilha
  let ant = 60;
  for (const [d, corte] of [[14, 0.1], [20, 0.1], [28, 0.2], [60, 0.2], [90, 0.3], [150, 0.3], [180, 0.5], [700, 0.5]]) {
    store.update((s) => { s.sessions = [sess(d + 4, tres(60, 12)), sess(d, tres(60, 12))]; });
    const g = sug();
    assert.ok(Math.abs(g.kg - 60 * (1 - corte)) <= 1.25, `${d} dias: ${g.kg} kg`);
    assert.equal((g.kg * 2) % 1, 0, 'carga em passos de 0,5 kg');
    assert.equal(g.reps, 8, 'volta pelo começo da faixa de repetições');
    assert.ok(g.kg <= ant); ant = g.kg;
    assert.match(g.texto, /sem treinar/); assert.match(g.texto, /antes da pausa: 60 kg/);
    assert.ok(!/undefined|NaN/.test(g.texto));
    assert.equal(g.pausaDias, d);
  }
  // mesmo quem ia subir a carga (dois treinos no topo) volta mais leve
  store.update((s) => { s.sessions = [sess(44, tres(60, 12)), sess(40, tres(60, 12))]; });
  assert.ok(sugestao(EX, '8-12', 3).kg > 60);
  assert.equal(sug().kg, 47.5);
  // ficou sem fazer o exercício, mas seguiu treinando outras coisas: não é pausa
  store.update((s) => { s.sessions = [sess(60, tres(60, 10)), ...[50, 43, 36, 29, 22, 15, 8, 2].map((d) => sess(d, tres(100, 10), 'agachamento-livre-barra'))]; });
  assert.deepEqual(sug(), sugestao(EX, '8-12', 3));
  // parou tudo por 50 dias e voltou ontem com outro exercício: o supino ainda não foi refeito, a redução continua valendo
  store.update((s) => { s.sessions = [sess(51, tres(60, 10)), sess(1, tres(80, 10), 'agachamento-livre-barra')]; });
  assert.equal(sug().kg, 47.5);
  // exercício por tempo: o tempo também volta menor (40 dias parado: 20% a menos)
  store.update((s) => { s.sessions = [{ ...sess(40, []), itens: [{ ex: 'prancha-frontal', alvo: '30-60', descanso: 60, sets: [{ kg: null, reps: null, seg: 45, ok: true }] }] }]; });
  const pr = retomada('prancha-frontal', sugestao('prancha-frontal', '30-60', 3), '30-60', AGORA);
  assert.match(pr.texto, /sem treinar/); assert.equal(pr.kg, null); assert.equal(pr.seg, 36); assert.match(pr.texto, /36 s .antes da pausa: 45 s./);
  // exercício só de repetições (barra fixa): menos repetições por série
  store.update((s) => { s.sessions = [{ ...sess(100, []), itens: [{ ex: 'barra-fixa-pronada', alvo: '8-12', descanso: 120, sets: [{ kg: null, reps: 10, seg: null, ok: true }, { kg: null, reps: 9, seg: null, ok: true }] }] }]; });
  const bf = retomada('barra-fixa-pronada', sugestao('barra-fixa-pronada', '8-12', 3), '8-12', AGORA);
  assert.equal(bf.reps, 7); assert.match(bf.texto, /7 repetições por série .antes da pausa: 10./);
  // máquina com ajuda (graviton): voltar mais leve é usar MAIS ajuda, nunca menos
  store.update((s) => { s.sessions = [sess(44, tres(45, 12), 'barra-fixa-assistida-graviton'), sess(40, tres(45, 12), 'barra-fixa-assistida-graviton')]; });
  assert.ok(sugestao('barra-fixa-assistida-graviton', '8-12', 3).kg < 45, 'sem pausa, a regra normal reduziria a ajuda');
  const gr = retomada('barra-fixa-assistida-graviton', sugestao('barra-fixa-assistida-graviton', '8-12', 3), '8-12', AGORA);
  assert.ok(gr.kg > 45 && gr.kg <= 45 * 1.25, 'mais ajuda na volta: ' + gr.kg); assert.match(gr.texto, /mais ajuda/);
  // sem histórico, exercício inexistente, data inválida: devolve a sugestão como veio
  store.update((s) => { s.sessions = []; });
  assert.deepEqual(sug(), sugestao(EX, '8-12', 3));
  assert.deepEqual(retomada('nao-existe', { kg: 10, reps: 8, texto: 'x' }, '8-12', AGORA), { kg: 10, reps: 8, texto: 'x' });
  assert.deepEqual(retomada(EX, { kg: 10, reps: 8, texto: 'x' }, '8-12', NaN), { kg: 10, reps: 8, texto: 'x' });
});

test('sugestão de carga: depois da volta, a carga sobe a cada treino até a de antes da pausa', () => {
  const sug = () => retomada(EX, sugestao(EX, '8-12', 3), '8-12', AGORA);
  // parou 60 dias (80 kg antes), voltou há 6 dias com 65 kg e fez o mínimo de repetições: sobe ~10%
  store.update((s) => { s.sessions = [sess(70, tres(80, 10)), sess(66, tres(80, 10)), sess(6, tres(65, 9))]; });
  let g = sug();
  assert.equal(g.kg, 72.5); assert.equal(g.reps, 8); assert.match(g.texto, /antes da pausa você usava 80 kg/);
  // terceiro treino da volta: continua subindo, sem passar da carga de antes
  store.update((s) => { s.sessions = [sess(70, tres(80, 10)), sess(66, tres(80, 10)), sess(6, tres(65, 9)), sess(3, tres(72.5, 9))]; });
  g = sug();
  assert.equal(g.kg, 80);
  // chegou à carga de antes: volta a regra normal
  store.update((s) => { s.sessions = [sess(70, tres(80, 10)), sess(66, tres(80, 10)), sess(6, tres(65, 9)), sess(3, tres(80, 9))]; });
  assert.deepEqual(sug(), sugestao(EX, '8-12', 3));
  // não completou o mínimo de repetições no treino da volta: não sobe
  store.update((s) => { s.sessions = [sess(70, tres(80, 10)), sess(6, tres(65, 6))]; });
  assert.deepEqual(sug(), sugestao(EX, '8-12', 3));
  // mais de 6 semanas depois da volta: regra normal
  store.update((s) => { s.sessions = [sess(140, tres(80, 10)), sess(50, tres(65, 9)), sess(10, tres(65, 9)), sess(3, tres(65, 9))]; });
  assert.deepEqual(sug(), sugestao(EX, '8-12', 3));
  store.update((s) => { s.sessions = []; });
});

test('Evolução: o tempo parado antes de voltar entra nas dicas', () => {
  const vazio = () => ({ plans: [], activePlan: '', sessions: [], trainer: { answers: { dias: '3' } }, nutri: { answers: {} }, body: [] });
  const monta = (dias, kgDe = () => 60) => { const st = vazio(); dias.forEach((d, i) => st.sessions.push(sess(d, tres(kgDe(d, i), 10)))); return st; };
  const dica = (st, id) => analisar(st, AGORA).dicas.find((d) => d.id === id);
  // treinando sem pausa: nada de retomada
  assert.equal(retomadaRecente(monta([20, 17, 14, 10, 7, 4, 1]), AGORA), null);
  assert.equal(dica(monta([20, 17, 14, 10, 7, 4, 1]), 'retomada'), undefined);
  // parou 45 dias e voltou há 5: dica de volta com o tempo parado, sem cobrar frequência
  let st = monta([60, 57, 54, 50, 5, 3, 1]);
  let r = retomadaRecente(st, AGORA);
  assert.deepEqual(r, { dias: 45, faixa: 2, ha: 5, treinos: 3 });
  let d = dica(st, 'retomada');
  assert.ok(d); assert.match(d.titulo, /6 semanas/); assert.match(d.texto, /20% menos/);
  assert.deepEqual(d.refs, ['bosquet2013', 'caterisano2019']);
  assert.equal(dica(st, 'frequencia'), undefined); assert.equal(dica(st, 'parado'), undefined);
  assert.equal(analisar(st, AGORA).resumo.retomada.dias, 45);
  // a carga mais baixa na volta não vira "queda" nem "travou"
  st = monta([70, 66, 62, 58, 54, 50, 6, 3, 1], (dd) => (dd > 10 ? 80 : 60));
  assert.equal(dica(st, 'queda'), undefined); assert.equal(dica(st, 'travado'), undefined);
  assert.ok(dica(st, 'retomada'));
  // a mesma queda sem pausa é apontada
  st = monta([24, 21, 18, 15, 12, 9, 6, 3, 1], (dd) => (dd > 10 ? 80 : 60));
  assert.ok(dica(st, 'queda'));
  // voltou há mais de 2 semanas: a frequência conta só depois da volta
  st = monta([90, 86, 82, 25, 23, 21, 18, 16, 14, 11, 9, 7, 4, 2]);
  assert.equal(dica(st, 'retomada'), undefined);
  assert.equal(dica(st, 'frequencia').tom, 'bom');
  // mais de 6 meses parado antes de voltar: sugere pedir plano novo
  st = monta([300, 296, 292, 4, 2, 1]);
  d = dica(st, 'retomada');
  assert.match(d.titulo, /10 meses/); assert.match(d.texto, /metade da carga/); assert.equal(d.acao.rota, 'treinador');
  // ainda parado: o texto muda com o tempo parado
  const parado = (dd) => dica(monta([dd + 8, dd + 4, dd]), 'parado');
  assert.match(parado(11).texto, /um pouco menos de carga/); assert.match(parado(11).titulo, /^11 dias/);
  assert.match(parado(20).texto, /10% menos/);
  assert.match(parado(45).texto, /20% menos/);
  assert.match(parado(120).texto, /30% menos/); assert.match(parado(120).titulo, /^4 meses sem treinar/);
  assert.match(parado(400).texto, /metade da carga/); assert.equal(parado(400).acao.rota, 'treinador');
  for (const dd of [11, 20, 45, 120, 400]) { const p = parado(dd); assert.ok(p.texto.length <= 140 && p.porque.length <= 190 && p.titulo.length <= 60); for (const k of p.refs) assert.ok(REFS[k]); }
  // base de conhecimento
  assert.ok(REFS.bosquet2013 && REFS.caterisano2019);
  const faq = FAQ_TREINO.find((x) => /parado/.test(x.q));
  assert.ok(faq && faq.f.every((k) => REFS[k]));
});

// ---------- regras do consenso CSCCa/NSCA de 2019 (lido na íntegra) ----------
test('volta: vale a partir de 2 semanas parado e dura 2 semanas (4 depois de 3 meses)', () => {
  const t = (d) => AGORA - d * DIA;
  assert.equal(semanasDeTransicao(14), 2); assert.equal(semanasDeTransicao(89), 2); assert.equal(semanasDeTransicao(90), 4);
  // treinando sem pausa
  assert.equal(voltaEm([t(9), t(6), t(3)], AGORA), null);
  assert.equal(voltaEm([], AGORA), null);
  // ainda parado: 13 dias não é pausa; 14 é, e a volta começa hoje, na semana 1
  assert.equal(voltaEm([t(20), t(13)], AGORA), null);
  assert.deepEqual(voltaEm([t(20), t(14)], AGORA), { dias: 14, retorno: AGORA, semana: 1, semanas: 2 });
  assert.deepEqual(voltaEm([t(200)], AGORA), { dias: 200, retorno: AGORA, semana: 1, semanas: 4 });
  // já voltou: semana 1 até o 6º dia, semana 2 até o 13º, depois acabou
  assert.deepEqual(voltaEm([t(60), t(3)], AGORA), { dias: 57, retorno: t(3), semana: 1, semanas: 2 });
  assert.equal(voltaEm([t(60), t(8), t(5), t(1)], AGORA).semana, 2);
  assert.equal(voltaEm([t(60), t(15), t(8), t(1)], AGORA), null);
  // pausa longa: quatro semanas
  assert.equal(voltaEm([t(150), t(15), t(8), t(1)], AGORA).semana, 3);
  assert.equal(voltaEm([t(150), t(26), t(19), t(12), t(5)], AGORA).semana, 4);
  assert.equal(voltaEm([t(150), t(28), t(21), t(14), t(7), t(1)], AGORA), null);
  // uma pausa nova no meio da volta recomeça a contagem
  assert.deepEqual(voltaEm([t(150), t(26), t(8), t(1)], AGORA), { dias: 18, retorno: t(8), semana: 2, semanas: 2 });
  // treinos no futuro não contam
  assert.equal(voltaEm([t(9), t(3), AGORA + 5 * DIA], AGORA), null);
  // pausa informada ao Treinador, para quem ainda não tem treinos registrados
  const dec = { dias: 60, desde: t(2) };
  assert.deepEqual(voltaEm([], AGORA, dec), { dias: 60, retorno: AGORA, semana: 1, semanas: 2 });
  assert.equal(voltaEm([t(1)], AGORA, dec).semana, 1);
  assert.equal(voltaEm([t(9), t(1)], AGORA, { dias: 60, desde: t(10) }).semana, 2);
  assert.equal(voltaEm([t(16), t(9), t(2)], AGORA, { dias: 60, desde: t(17) }), null, 'depois de 2 semanas a transição acaba');
  assert.equal(voltaEm([t(8), t(1)], AGORA, dec), null, 'com treinos antes do plano, vale o histórico');
  assert.equal(voltaEm([t(30), t(1)], AGORA, dec).dias, 29, 'pausa no histórico vale mais do que a informada');
  assert.equal(voltaEm([], AGORA, { dias: 5, desde: t(2) }), null);
  assert.equal(voltaEm([], AGORA, { dias: 60, desde: NaN }), null);
});

test('volta: o tempo parado informado ao Treinador vale para quem ainda não tem treinos no aplicativo', () => {
  const aceito = iso(AGORA - 2 * DIA);
  store.update((s) => { s.sessions = []; s.trainer.answers = { ...base, pausa: '1a3m' }; s.trainer.aceitoEm = aceito; });
  assert.deepEqual(voltaDePausa(AGORA), { dias: 60, retorno: AGORA, semana: 1, semanas: 2 });
  store.update((s) => { s.trainer.answers = { ...base, pausa: 'mais6m' }; });
  assert.equal(voltaDePausa(AGORA).semanas, 4);
  // sem pausa informada, quem nunca treinou, ou plano ainda não aceito: nada
  store.update((s) => { s.trainer.answers = { ...base, pausa: 'treinando' }; });
  assert.equal(voltaDePausa(AGORA), null);
  store.update((s) => { s.trainer.answers = { ...base, experiencia: 'nunca', pausa: 'mais6m' }; });
  assert.equal(voltaDePausa(AGORA), null);
  store.update((s) => { s.trainer.answers = { ...base, pausa: '1a3m' }; s.trainer.aceitoEm = ''; });
  assert.equal(voltaDePausa(AGORA), null);
  // com histórico, o histórico manda
  store.update((s) => { s.trainer.aceitoEm = aceito; s.sessions = [sess(40, tres(60, 10)), sess(36, tres(60, 10))]; });
  assert.equal(voltaDePausa(AGORA).dias, 36);
  store.update((s) => { s.sessions = []; s.trainer.answers = {}; s.trainer.aceitoEm = ''; });
  assert.equal(voltaDePausa(AGORA), null);
  assert.equal(voltaDePausa(NaN), null);
});

test('volta, musculação (regra FIT): volume de até 30 por grupo muscular e descanso mínimo nas 2 primeiras semanas', () => {
  // IRV = séries × repetições × %1RM. Peito com dois exercícios de 3 séries passa de 30: sai série até caber.
  const peito = [{ ex: 'supino-reto-barra', series: 3, reps: '8-12' }, { ex: 'supino-inclinado-halteres', series: 3, reps: '10-12' }];
  const irv = (itens, series, corte = 0) => itens.reduce((s, it, i) => { const lo = Number(it.reps.split('-')[0]); return s + series[i] * lo * (1 / (1 + (lo + 3) / 30)) * (1 - corte); }, 0);
  assert.ok(irv(peito, [3, 3]) > IRV_MAX, 'o treino normal passa do teto');
  let s = seriesNaVolta(peito, 0);
  assert.ok(irv(peito, s) <= IRV_MAX && s.every((n) => n >= 1) && s[0] <= 3 && s[1] <= 3, s.join());
  assert.ok(s[0] + s[1] < 6, 'ficou com menos séries');
  // com a carga já reduzida, o corte de séries é menor ou igual
  const s2 = seriesNaVolta(peito, 0.5);
  assert.ok(s2[0] + s2[1] >= s[0] + s[1]);
  assert.ok(irv(peito, s2, 0.5) <= IRV_MAX);
  // um exercício só, dentro do teto: nada muda
  assert.deepEqual(seriesNaVolta([{ ex: 'supino-reto-barra', series: 3, reps: '8-12' }], 0), [3]);
  // grupos diferentes não se somam; exercício por tempo e cardio não entram na conta
  const misto = [{ ex: 'supino-reto-barra', series: 3, reps: '8-12' }, { ex: 'remada-curvada-barra-pronada', series: 3, reps: '8-12' }, { ex: 'prancha-frontal', series: 3, reps: '30-60' }, { ex: 'corrida-esteira', series: 1, reps: '20' }];
  assert.deepEqual(seriesNaVolta(misto, 0), [3, 3, 3, 1]);
  // pernas com três exercícios de quadríceps: cada um fica com pelo menos 1 série e o grupo cabe no teto
  const pernas = [{ ex: 'agachamento-livre-barra', series: 4, reps: '6-10' }, { ex: 'leg-press-45', series: 3, reps: '10-12' }, { ex: 'cadeira-extensora', series: 3, reps: '12-15' }];
  s = seriesNaVolta(pernas, 0.2);
  assert.ok(s.every((n) => n >= 1) && s[0] <= 4 && s[1] <= 3 && s[2] <= 3 && s.reduce((a, b) => a + b, 0) < 10, s.join());
  // valores estranhos não quebram
  assert.deepEqual(seriesNaVolta([{ ex: 'nao-existe', series: 3, reps: '10' }, { ex: 'supino-reto-barra', series: 0, reps: '' }], 0), [3, 1]);
  assert.deepEqual(seriesNaVolta([], 0), []);
  // descanso: pelo menos 2 minutos na 1ª semana e 1 min 30 s na 2ª; depois, o do plano; cardio e prancha não mudam
  const v = (semana) => ({ dias: 40, retorno: AGORA, semana, semanas: 2 });
  assert.equal(descansoNaVolta('supino-reto-barra', 60, v(1)), 120);
  assert.equal(descansoNaVolta('supino-reto-barra', 60, v(2)), 90);
  assert.equal(descansoNaVolta('supino-reto-barra', 60, v(3)), 60);
  assert.equal(descansoNaVolta('supino-reto-barra', 180, v(1)), 180, 'descanso maior do plano é mantido');
  assert.equal(descansoNaVolta('supino-reto-barra', 60, null), 60);
  assert.equal(descansoNaVolta('prancha-frontal', 45, v(1)), 45);
  assert.equal(descansoNaVolta('corrida-esteira', 0, v(1)), 0);
});

test('volta, cardio (regra 50/30/20/10): metade do tempo na 1ª semana e 30% a menos na 2ª', () => {
  const EST = 'corrida-esteira';
  const cardio = (d, min) => ({ ...sess(d, []), itens: [{ ex: EST, alvo: '30', descanso: 0, sets: [{ kg: null, reps: null, seg: min, ok: true }] }] });
  const sug = () => retomada(EST, sugestao(EST, '30', 1), '30', AGORA);
  store.update((s) => { s.trainer.answers = {}; s.trainer.aceitoEm = ''; s.sessions = [cardio(6, 30), cardio(3, 30)]; });
  assert.deepEqual(sug(), sugestao(EST, '30', 1), 'sem pausa, nada muda');
  // parou 40 dias: volta com metade
  store.update((s) => { s.sessions = [cardio(44, 30), cardio(40, 30)]; });
  let g = sug();
  assert.equal(g.seg, 15); assert.match(g.texto, /semana 1 de 2/); assert.match(g.texto, /antes da pausa: 30 min/);
  // segunda semana da volta: 30% a menos do que antes da pausa (e não do treino reduzido da semana passada)
  store.update((s) => { s.sessions = [cardio(50, 30), cardio(9, 15), cardio(6, 15)]; });
  g = sug();
  assert.equal(g.seg, 21); assert.match(g.texto, /semana 2 de 2/);
  // terceira semana: volta ao normal
  store.update((s) => { s.sessions = [cardio(60, 30), cardio(15, 15), cardio(8, 21), cardio(1, 30)]; });
  assert.deepEqual(sug(), sugestao(EST, '30', 1));
  // pausa longa (3 meses ou mais): quatro semanas, com 50, 30, 20 e 10% a menos
  for (const [dias, min, semana] of [[2, 15, 1], [9, 21, 2], [16, 24, 3], [23, 27, 4]]) {
    const depois = []; for (let d = dias; d > 0; d -= 7) depois.push(cardio(d, 10));
    store.update((s) => { s.sessions = [cardio(dias + 120, 30), ...depois]; });
    g = sug();
    assert.equal(g.seg, min, `semana ${semana}`); assert.match(g.texto, new RegExp(`semana ${semana} de 4`));
  }
  store.update((s) => { s.sessions = [cardio(150, 30), cardio(29, 15), cardio(22, 21), cardio(15, 24), cardio(8, 27), cardio(1, 30)]; });
  assert.deepEqual(sug(), sugestao(EST, '30', 1));
  assert.deepEqual(CORTE_CARDIO, [0.5, 0.3, 0.2, 0.1]);
  store.update((s) => { s.sessions = []; });
});

test('treino em andamento: o cronômetro do exercício e o tempo parado são gravados e validados', () => {
  const cur = (extra) => ({ id: 's1', planId: '', diaId: '', nome: 'T', inicio: iso(AGORA), fim: '', nota: '', restEnd: 0, restTotal: 0, itens: [{ ex: 'prancha-frontal', alvo: '30-60', descanso: 45, sets: [{ kg: null, reps: null, seg: 30, ok: false }, { kg: null, reps: null, seg: 30, ok: false }] }], ...extra });
  const limpo = (extra) => store.sanitize({ current: cur(extra) }).current;
  assert.deepEqual(limpo({ cron: { i: 0, j: 1, end: AGORA + 20000, total: 30 } }).cron, { i: 0, j: 1, end: AGORA + 20000, total: 30 });
  assert.equal(limpo({}).cron, null);
  assert.equal(limpo({ cron: { i: 3, j: 0, end: AGORA, total: 30 } }).cron, null, 'exercício inexistente');
  assert.equal(limpo({ cron: { i: 0, j: 7, end: AGORA, total: 30 } }).cron, null, 'série inexistente');
  assert.equal(limpo({ cron: { i: 0, j: 0, end: 'amanhã', total: 30 } }).cron, null);
  assert.equal(limpo({ cron: { i: 0, j: 0, end: AGORA, total: 0 } }).cron, null);
  assert.equal(limpo({ cron: 'x' }).cron, null);
  assert.equal(limpo({ cron: { i: -1, j: 0, end: AGORA, total: 30 } }).cron, null);
  assert.equal(limpo({ cron: { i: 0.5, j: 0, end: AGORA, total: 30 } }).cron, null);
  assert.equal(limpo({ volta: 45 }).volta, 45);
  assert.equal(limpo({ volta: -3 }).volta, 0);
  assert.equal(limpo({ volta: '45' }).volta, 0);
  assert.equal(limpo({}).volta, 0);
});

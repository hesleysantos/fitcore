// Dias sem treino ("não sugerir treinos no domingo" — logic/dias-livres.js): a agenda da musculação, da corrida, do
// fortalecimento e do treino perdido nunca cai num dia bloqueado; o número de treinos nunca passa dos dias livres; e,
// nos dias livres, o descanso de sempre continua valendo (48 horas entre treinos do mesmo músculo — ref garber2011;
// força em dias não seguidos para menores de 18 e diabetes — refs faigenbaum2009, colberg2016).
import test from 'node:test';
import assert from 'node:assert/strict';
import { EX_POR_ID } from '../www/js/data/exercises.js';
import { MUSCULOS } from '../www/js/data/muscles.js';
import { PERGUNTAS, gerarPlano, perfil, planoFortalecimento, resumoCombinado, respostasCompletas } from '../www/js/logic/trainer.js';
import { gerarPlano as gerarCorrida, planoAtual, planoDaSemanaEm, inicioPara } from '../www/js/logic/corrida.js';
import { bloqueadosDe, diasBloqueados, livresDe, notaDosDias, perguntaDiasMusc, MAX_BLOQUEADOS, soCorridaDe, semCorridaDe, diasSemCorrida, limparDiasAntigos, ajustarAgenda, aplicarDiasNosTreinos } from '../www/js/logic/dias-livres.js';
import { PERGUNTAS as P_CORRIDA } from '../www/js/logic/corrida.js';
import { marcar as marcarOpcao, limiteDe } from '../www/js/logic/escolhas.js';
import * as P from '../www/js/logic/perdido.js';
import * as store from '../www/js/store.js';

const GYM = { all: true, has: {} };
const base = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };
// perfis com regras de descanso diferentes: intermediário, iniciante, avançado (divisões com dias repetidos), menor de 18,
// diabetes (força em dias não seguidos), 60 anos ou mais e saúde (2 séries: o mesmo músculo com poucas séries também conta)
const PERFIS = {
  intermediario: {},
  iniciante: { experiencia: 'iniciante', objetivo: 'emagrecimento' },
  avancado: { experiencia: 'avancado', objetivo: 'forca' },
  jovem: { idade: 16 },
  diabetes: { condicoes: ['diabetes'] },
  idoso: { idade: 68, objetivo: 'saude' },
  saude: { objetivo: 'saude', tempo: '45' },
};
const GRANDES = new Set(['peito', 'costas', 'quadriceps', 'posteriores', 'gluteos', 'ombros']);
// todos os conjuntos de 0 a 5 dias bloqueados (120)
const CONJUNTOS = [];
for (let m = 0; m < 128; m++) { const l = [0, 1, 2, 3, 4, 5, 6].filter((w) => m & (1 << w)); if (l.length <= MAX_BLOQUEADOS) CONJUNTOS.push(l); }
const resp = (l) => (l.length ? l.map(String) : ['nenhum']);
const diaDe = (p, w) => p.dias.find((d) => d.id === p.agenda[w]);
// treino de força = tem exercício fora do cardio e do abdômen (o dia "Cardio e abdômen" não conta, como no Treinador)
const ehForca = (d) => d.itens.some((it) => { const ex = EX_POR_ID.get(it.ex); return ex && ex.padrao !== 'cardio' && ex.registro !== 'minutos' && ex.grupo !== 'abdomen'; });
// a agenda pela posição dos treinos (os ids mudam a cada plano)
const semana = (p) => [0, 1, 2, 3, 4, 5, 6].map((w) => p.dias.findIndex((d) => d.id === p.agenda[w])).join(',');
// músculos principais dos grandes grupos que o treino usa
const principais = (d) => { const s = new Set(); for (const it of d.itens) { const ex = EX_POR_ID.get(it.ex); if (!ex || ex.padrao === 'cardio') continue; for (const mu of ex.primarios) if (MUSCULOS[mu] && GRANDES.has(MUSCULOS[mu].grupo)) s.add(mu); } return s; };

// Confere a agenda de um plano: nada nos dias bloqueados, um treino por dia livre no máximo, e o descanso nos dias livres.
function confere(p, bloq, pf, rot) {
  const wds = Object.keys(p.agenda).map(Number);
  for (const w of wds) assert.ok(!bloq.includes(w), `${rot}: treino num dia bloqueado (${w})`);
  assert.ok(wds.length <= livresDe(bloq), `${rot}: mais treinos que dias livres`);
  if (!bloq.length) return;
  for (const w of wds) {
    const a = diaDe(p, w), b = diaDe(p, (w + 1) % 7);
    if (!a || !b) continue;
    const comuns = [...principais(a)].filter((mu) => principais(b).has(mu));
    assert.equal(comuns.length, 0, `${rot}: o mesmo músculo (${comuns.join(', ')}) em dias seguidos (${w} e ${(w + 1) % 7})`);
    if (pf.jovem || pf.diabetes) assert.ok(!(ehForca(a) && ehForca(b)), `${rot}: força em dias seguidos (${w})`);
  }
}

test('a pergunta: os dias da musculação (pelo menos 2), antes de "quantos desses dias"; a resposta antiga continua valendo', () => {
  const q = PERGUNTAS.find((x) => x.k === 'diasMusc');
  assert.ok(q && q.opcional && q.tipo === 'varios' && q.minimo === 2 && !q.nenhum);
  assert.deepEqual(q.op.map((o) => o[0]), ['1', '2', '3', '4', '5', '6', '0']);
  assert.equal(PERGUNTAS.indexOf(q) + 1, PERGUNTAS.findIndex((x) => x.k === 'dias'));
  assert.deepEqual(perguntaDiasMusc().op, q.op);
  // as perguntas antigas não são mais feitas, em nenhuma das duas entrevistas
  for (const L of [PERGUNTAS, P_CORRIDA]) assert.ok(!L.some((x) => x.k === 'semTreino' || x.k === 'soCorrida'));
  // os dias sem musculação são os não marcados
  assert.deepEqual(bloqueadosDe({ diasMusc: ['1', '3', '5'] }), [2, 4, 6, 0]);
  assert.deepEqual(bloqueadosDe({ diasMusc: ['0', '1', '2', '3', '4', '5', '6'] }), []);
  assert.deepEqual(bloqueadosDe({ diasMusc: ['x'] }), []);
  // resposta antiga, sem a pergunta: continua completa; sem dias, vale como "nenhum"
  assert.ok(respostasCompletas(base));
  assert.deepEqual(perfil(base).bloqueados, []);
  assert.equal(perfil(base).livres, 7);
  assert.deepEqual(bloqueadosDe({ semTreino: ['nenhum', '0'] }), []);
  assert.deepEqual(bloqueadosDe({ semTreino: ['0', '6', 'x', 7, '9'] }), [6, 0]);
  // o estado guarda a resposta nova e a antiga (só dias que existem; a antiga, no máximo 5)
  const st = store.sanitize({ trainer: { answers: { ...base, semTreino: ['0', '1', '2', '3', '4', '5', '6', 'lixo'] } } });
  assert.equal(st.trainer.answers.semTreino.length, 5);
  assert.equal(diasBloqueados(st).length, 5);
  const st2 = store.sanitize({ trainer: { answers: { ...base, diasMusc: ['1', '4', 'lixo'] } }, run: { answers: { ...RUN, semTreino: ['6'] } } });
  assert.deepEqual(st2.trainer.answers.diasMusc, ['1', '4']);
  assert.deepEqual(st2.run.answers.semTreino, ['6']);
  assert.deepEqual(diasBloqueados(st2), [2, 3, 5, 6, 0]);
  assert.deepEqual(diasBloqueados(store.sanitize({ trainer: { answers: base } })), []);
  // refazer uma entrevista tira as respostas antigas dela
  assert.deepEqual(limparDiasAntigos({ a: 1, semTreino: ['6'], soCorrida: ['6'] }), { a: 1 });
});

test('limite: as opções de "quantos dias" não passam dos dias marcados, e o plano também não', () => {
  const q = PERGUNTAS.find((x) => x.k === 'dias');
  const visiveis = (a) => q.op.filter((o) => typeof o[3] !== 'function' || o[3](a)).map((o) => o[0]);
  assert.deepEqual(visiveis({ diasMusc: ['1', '2', '3', '4', '5', '6', '0'] }), ['2', '3', '4', '5', '6']);
  assert.deepEqual(visiveis({ diasMusc: ['1', '2', '3', '4', '5', '6'] }), ['2', '3', '4', '5', '6']);
  assert.deepEqual(visiveis({ diasMusc: ['1', '3', '5', '0'] }), ['2', '3', '4']);
  assert.deepEqual(visiveis({ diasMusc: ['6', '0'] }), ['2']);
  assert.deepEqual(visiveis({ semTreino: resp([0, 6]) }), ['2', '3', '4', '5']); // resposta antiga
  assert.equal(notaDosDias({ diasMusc: ['1', '2', '3', '4', '5', '6', '0'] }), '');
  assert.match(notaDosDias({ diasMusc: ['1', '3', '5'] }), /Você marcou 3 dias: dá para treinar até 3/);
  assert.match(notaDosDias({ semTreino: ['6', '0'] }), /sobram 5 dias livres: dá para treinar até 5 dias/);
  // resposta guardada com mais treinos do que dias marcados: o plano usa os dias marcados e diz isso
  const p = gerarPlano({ ...base, dias: '6', diasMusc: ['1', '3', '5', '0'] }, GYM, 0);
  assert.ok(Object.keys(p.agenda).length <= 4 && Object.keys(p.agenda).every((w) => ['1', '3', '5', '0'].includes(w)));
  assert.equal(p.perfil.dias, 4);
  assert.ok(p.avisos.some((x) => x.diasLivres && /Você pediu 6 dias de treino/.test(x.texto)));
});

test('musculação: em todas as combinações de dias × dias bloqueados × perfil, nenhum treino num dia bloqueado e o descanso continua', () => {
  let n = 0, menos = 0;
  for (const [nome, extra] of Object.entries(PERFIS)) for (const dias of ['2', '3', '4', '5', '6']) for (const bl of CONJUNTOS) {
    const a = { ...base, ...extra, dias, semTreino: resp(bl) };
    const pf = perfil(a);
    if (Number(dias) > livresDe(bl)) continue; // a entrevista não oferece essa opção (ver o teste do limite)
    const p = gerarPlano(a, GYM, 0);
    const rot = `${nome} ${dias} dias, sem treino em [${bl}]`;
    assert.ok(p && p.dias.length, rot);
    confere(p, bl, pf, rot);
    assert.ok(!p.quebra, `${rot}: plano sem o descanso`);
    // menos treinos do que o pedido só com bloqueio, e sempre com o aviso
    const treinos = Object.keys(p.agenda).length;
    if (!bl.length) assert.equal(semana(p), semana(gerarPlano({ ...base, ...extra, dias }, GYM, 0)), rot);
    if (p.perfil.dias < Number(dias)) { menos++; assert.ok(p.avisos.some((x) => x.diasLivres && x.tipo === 'warn' && /Por segurança, o plano ficou com/.test(x.texto)), rot); }
    else assert.equal(treinos, p.dias.length, rot);
    n++;
  }
  assert.ok(n >= 2240, `combinações: ${n}`);
  console.log(`   Dias livres: ${n} planos conferidos; ${menos} ficaram com menos treinos para manter o descanso`);
});

test('dois dias livres seguidos (só sábado e domingo): superiores e inferiores, ou corpo inteiro e cardio', () => {
  const bl = ['1', '2', '3', '4', '5'];
  const p = gerarPlano({ ...base, dias: '2', semTreino: bl }, GYM, 0);
  assert.deepEqual(Object.keys(p.agenda).map(Number).sort(), [0, 6]);
  assert.deepEqual(p.dias.map((d) => d.nome).sort(), ['Inferiores A', 'Superiores A']);
  // sábado vem antes do domingo na semana da tela: o primeiro treino fica no sábado
  assert.equal(diaDe(p, 6).nome, 'Superiores A');
  for (const extra of [{ idade: 16 }, { condicoes: ['diabetes'] }]) {
    const j = gerarPlano({ ...base, ...extra, dias: '2', semTreino: bl }, GYM, 0);
    assert.equal(j.dias.filter(ehForca).length, 1, JSON.stringify(extra));
  }
});

test('dia bloqueado no meio da agenda de sempre: os treinos se espalham nos dias livres, na ordem A, B, C', () => {
  // 3 dias (segunda, quarta e sexta) sem quarta: segunda, quinta e sábado
  const p = gerarPlano({ ...base, dias: '3', semTreino: ['3'] }, GYM, 0);
  assert.deepEqual(Object.keys(p.agenda).map(Number).sort(), [1, 4, 6]);
  assert.deepEqual([1, 4, 6].map((w) => diaDe(p, w).nome), ['Corpo inteiro A', 'Corpo inteiro B', 'Corpo inteiro C']);
  // bloqueio que não toca a agenda de sempre: nada muda
  const sem = gerarPlano({ ...base, dias: '3' }, GYM, 0);
  assert.equal(semana(gerarPlano({ ...base, dias: '3', semTreino: ['0'] }, GYM, 0)), semana(sem));
});

// ---------- corrida ----------
const RUN = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 12, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
const HOJE = '2026-11-16';
const corridasDe = (p) => [...new Set(p.semanas.flatMap((s) => s.dias.filter((d) => d.tipo !== 'descanso').map((d) => d.wd)))];

test('corrida: o plano nunca usa um dia bloqueado no Treinador, e diz o que tirou', () => {
  const sem = gerarCorrida(RUN, {});
  assert.ok(corridasDe(sem).includes(0));
  for (const bl of CONJUNTOS) {
    const p = gerarCorrida({ ...RUN, dias: ['1', '2', '3', '4', '5', '6', '0'] }, { bloqueados: bl });
    const usados = corridasDe(p);
    for (const w of usados) assert.ok(!bl.includes(w), `corrida num dia bloqueado: [${bl}] → ${w}`);
    // pelo menos um dia de descanso por semana (ref meeusen2013)
    assert.ok(usados.length <= 6);
  }
  // domingo bloqueado: sai da corrida, o longo vai para outro dia, e o plano diz por quê
  const p = gerarCorrida(RUN, { bloqueados: [0] });
  assert.ok(!corridasDe(p).includes(0));
  assert.notEqual(p.perfil.diaLongo, 0);
  assert.ok(p.avisos.some((x) => /Sem corrida domingo: você marcou que não treina/.test(x.texto)));
  // todos os dias marcados para correr estão bloqueados: a corrida vai para o mesmo número de dias livres
  const todos = gerarCorrida({ ...RUN, dias: ['6', '0'] }, { bloqueados: [6, 0] });
  assert.equal(todos.perfil.dias.length, 2);
  assert.ok(todos.perfil.dias.every((w) => w !== 6 && w !== 0));
  assert.ok(todos.avisos.some((x) => /a corrida foi para/.test(x.texto)));
  // o longo pedido num dia bloqueado volta para "tanto faz"
  const lg = gerarCorrida({ ...RUN, diaLongo: '0' }, { bloqueados: [0] });
  assert.ok(lg.perfil.dias.includes(lg.perfil.diaLongo) && lg.perfil.diaLongo !== 0);
  // a primeira semana também conta só os dias livres
  assert.equal(inicioPara({ ...RUN, dias: ['0'] }, '2026-11-21', [0]) >= '2026-11-16', true);
});

test('corrida pelo estado: os dias da musculação não mudam a corrida; a resposta antiga da corrida, sim', () => {
  // dias da musculação (resposta nova): a corrida usa os dias dela
  const st = store.sanitize({ run: { answers: { ...RUN, dias: ['2', '4', '6', '0'] }, aceitoEm: '2026-10-07T12:00:00.000Z', inicio: '2026-10-05' }, trainer: { answers: { ...base, diasMusc: ['1', '2', '3', '4', '5'] } } });
  assert.deepEqual(diasSemCorrida(st), []);
  assert.ok(corridasDe(planoAtual(st, HOJE)).some((w) => w === 0 || w === 6), 'corrida no fim de semana');
  // resposta antiga da corrida ("não posso treinar no fim de semana"): continua valendo até refazer a entrevista
  const st2 = store.sanitize({ run: { answers: { ...RUN, semTreino: ['0', '6'] }, aceitoEm: '2026-10-07T12:00:00.000Z', inicio: '2026-10-05' }, trainer: { answers: { ...base, semTreino: ['0', '6'] } } });
  const p = planoAtual(st2, HOJE);
  assert.ok(p);
  for (const w of corridasDe(p)) assert.ok(w !== 0 && w !== 6, 'corrida no fim de semana bloqueado');
  for (let k = 0; k < 4; k++) {
    const s = planoDaSemanaEm(st2, HOJE, P.somaDias(HOJE, 7 * k));
    if (!s) continue;
    for (const w of [0, 6]) assert.ok(!s.dias[w] || s.dias[w].tipo === 'descanso', `semana ${k}: corrida no dia ${w}`);
  }
  const r = resumoCombinado(st2, HOJE);
  assert.ok(r.dias.every((w) => w !== 0 && w !== 6));
});

test('corrida + musculação: a musculação também fica nos dias livres, com as regras do encaixe', () => {
  let n = 0;
  for (const foco of ['corrida', 'musculacao', 'equilibrio']) for (const dias of ['2', '3', '4', '5']) for (const bl of CONJUNTOS) {
    if (Number(dias) > livresDe(bl)) continue;
    // a corrida já vem sem os dias bloqueados (gerarCorrida, acima): aqui, os dias dela que sobraram
    const corre = [2, 4, 6, 0].filter((w) => !bl.includes(w));
    if (!corre.length) continue;
    const longo = corre.includes(0) ? 0 : corre[corre.length - 1];
    const combinado = { foco, fortalecimento: 'nao', fortes: corre.filter((w) => w !== longo).slice(0, 1), longo, longos: [longo], dias: corre };
    for (const extra of [{}, { experiencia: 'iniciante' }, { idade: 16 }]) {
      const a = { ...base, ...extra, dias, semTreino: resp(bl) };
      const p = gerarPlano(a, GYM, 0, null, combinado);
      const rot = `${foco} ${dias} dias ${JSON.stringify(extra)} sem treino em [${bl}]`;
      confere(p, bl, perfil(a), rot);
      assert.ok(!p.quebra, rot);
      n++;
    }
  }
  assert.ok(n > 2000, `combinações: ${n}`);
});

test('fortalecimento para quem só corre: nunca num dia bloqueado', () => {
  for (const bl of CONJUNTOS) {
    const st = store.sanitize({ run: { answers: RUN, aceitoEm: '2026-10-07T12:00:00.000Z', inicio: '2026-10-05' }, trainer: { answers: { ...base, semTreino: resp(bl) } } });
    for (const local of ['academia', 'casa']) {
      const f = planoFortalecimento(st, { local, hoje: HOJE, ocupados: [] });
      assert.ok(f, `[${bl}]`);
      for (const w of Object.keys(f.agenda).map(Number)) assert.ok(!bl.includes(w), `fortalecimento num dia bloqueado: [${bl}] → ${w}`);
      // dois treinos: com 48 horas ou mais entre eles (ref blagrove2018)
      const wds = Object.keys(f.agenda).map(Number);
      if (wds.length === 2) assert.ok(Math.min((wds[0] - wds[1] + 7) % 7, (wds[1] - wds[0] + 7) % 7) >= 2);
    }
  }
  // só os dias já ocupados e os bloqueados: sem dia livre, o plano diz isso
  const st = store.sanitize({ run: { answers: RUN, aceitoEm: '2026-10-07T12:00:00.000Z', inicio: '2026-10-05' }, trainer: { answers: { ...base, semTreino: ['1', '2', '3', '4', '5'] } } });
  const f = planoFortalecimento(st, { local: 'academia', hoje: HOJE, ocupados: [6, 0] });
  assert.equal(f.motivo, 'sem_dias');
  assert.match(f.texto, /fora dos dias em que você não treina/);
});

// ---------- treino perdido ----------
const it = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
const SUP = [it('flexao-de-bracos'), it('barra-fixa-pronada'), it('flexao-pike')];
const INF = [it('agachamento-peso-corporal'), it('flexao-nordica'), it('panturrilha-em-pe-peso-corporal-degrau')];
const SEG = '2026-11-16'; // segunda
const D = (i) => P.somaDias(SEG, i);

test('treino perdido: nunca vai para um dia bloqueado', () => {
  // superiores na segunda, inferiores na quarta; a pessoa perde o de segunda
  const plano = { id: 'p1', nome: 'Plano', origem: 'manual', criadoEm: '2026-11-01T10:00:00.000Z', dias: [{ id: 'a', nome: 'Sup', foco: '', itens: SUP }, { id: 'b', nome: 'Inf', foco: '', itens: INF }], agenda: { 1: 'a', 3: 'b' }, info: '' };
  const estado = (bl) => store.sanitize({ v: store.VERSAO, plans: [plano], activePlan: 'p1', trainer: { answers: { ...base, semTreino: resp(bl) } } });
  const livre = P.propor(estado([]), D(0), D(0));
  assert.equal(livre.motivo, 'livre');
  const destino = livre.movs[0].para;
  assert.equal(destino, D(1), 'sem bloqueio: vai para terça');
  // terça bloqueada: não vai para terça
  for (const bl of CONJUNTOS) {
    const st = estado(bl);
    for (const hoje of [D(0), D(1), D(2)]) {
      const p = P.propor(st, D(0), hoje);
      if (!p.pode) continue;
      for (const m of p.movs) assert.ok(!bl.includes(P.diaDaSemana(m.para)) || m.para === m.de, `[${bl}] hoje ${hoje}: ${m.diaId} foi para ${m.para}, dia bloqueado`);
      // a marca gravada segue a proposta
      const marca = P.novaMarca(st, D(0), hoje, 'mover', '2026-11-16T20:00:00.000Z');
      for (const m of marca.movs) assert.ok(!bl.includes(P.diaDaSemana(m.para)), `[${bl}]: marca para dia bloqueado`);
    }
  }
  // todos os outros dias da semana bloqueados: segue a semana
  const p = P.propor(estado([2, 4, 5, 6, 0]), D(0), D(0));
  assert.equal(p.motivo, 'sem_dia');
  assert.equal(p.movs.length, 0);
});

// ---------- dias por tipo de treino: "sábado só corrida" e as duas entrevistas ----------
const visiveis = (q, a) => q.op.filter((o) => typeof o[3] !== 'function' || o[3](a)).map((o) => o[0]);

test('cada entrevista pergunta os seus dias: a da corrida, só os dias de corrida (todos os 7 dias à vista)', () => {
  const ks = P_CORRIDA.map((q) => q.k);
  assert.ok(ks.includes('dias') && !ks.includes('diasMusc'));
  assert.ok(PERGUNTAS.some((q) => q.k === 'diasMusc'));
  const dias = P_CORRIDA.find((x) => x.k === 'dias');
  assert.equal(visiveis(dias, {}).length, 7);
  // resposta antiga guardada na corrida: os dias sem corrida ainda saem das opções
  assert.deepEqual(visiveis(dias, { semTreino: ['6', '0'], soCorrida: ['6'] }).sort(), ['1', '2', '3', '4', '5', '6']);
});

test('sábado só corrida: a corrida usa o sábado; a musculação não', () => {
  const a = { ...base, semTreino: ['6'], soCorrida: ['6'] };
  assert.deepEqual([bloqueadosDe(a), soCorridaDe(a), semCorridaDe(a)], [[6], [6], []]);
  assert.deepEqual(semCorridaDe({ ...a, soCorrida: ['nenhum'] }), [6]);
  // musculação: nenhum treino no sábado
  const m = gerarPlano(a, GYM);
  assert.ok(m && !Object.keys(m.agenda).map(Number).includes(6));
  // corrida pelo estado: o sábado continua
  const run = { ...RUN, dias: ['2', '4', '6'], semTreino: ['6'], soCorrida: ['6'] };
  const st = store.sanitize({ run: { answers: run, aceitoEm: '2026-10-07T12:00:00.000Z', inicio: '2026-10-05' }, trainer: { answers: a } });
  assert.deepEqual([diasBloqueados(st), diasSemCorrida(st)], [[6], []]);
  assert.ok(corridasDe(planoAtual(st, HOJE)).includes(6), 'corrida no sábado');
  // sem o "ainda quer correr", o sábado sai dos dois
  const st2 = store.sanitize({ run: { answers: { ...run, soCorrida: ['nenhum'] }, aceitoEm: '2026-10-07T12:00:00.000Z', inicio: '2026-10-05' }, trainer: { answers: { ...a, soCorrida: ['nenhum'] } } });
  assert.ok(!corridasDe(planoAtual(st2, HOJE)).includes(6));
  // a resposta guardada passa pela validação do estado nas duas entrevistas
  assert.deepEqual([st.trainer.answers.soCorrida, st.run.answers.soCorrida], [['6'], ['6']]);
});

test('mudar os dias da musculação tira o treino do dia que saiu; a corrida não muda nada na musculação', () => {
  const s = { trainer: { answers: { ...base, diasMusc: ['1', '3', '5'] } }, run: { answers: { ...RUN, dias: ['2', '4', '6'] } }, plans: [{ id: 'p', dias: [{ id: 'a', nome: 'Treino A' }, { id: 'b', nome: 'Treino B' }, { id: 'c', nome: 'Treino C' }], agenda: { 1: 'a', 3: 'b', 6: 'c' } }], activePlan: 'p' };
  const msg = aplicarDiasNosTreinos(s);
  // o treino C sai do sábado para o dia marcado livre (sexta)
  assert.deepEqual(s.plans[0].agenda, { 1: 'a', 3: 'b', 5: 'c' });
  assert.match(msg, /Treino C passou de sábado para sexta/);
  // nada é copiado de uma entrevista para a outra
  assert.deepEqual(s.run.answers.dias, ['2', '4', '6']);
  assert.ok(!('semTreino' in s.run.answers) && !('diasMusc' in s.run.answers));
  // quem só corre, com a resposta antiga: ela vale para os dois
  assert.deepEqual(diasBloqueados({ trainer: { answers: {} }, run: { answers: { semTreino: ['6'] } } }), [6]);
  // sem dia livre: o treino fica de fora e a frase pede para escolher
  const r = ajustarAgenda({ 1: 'a', 2: 'b' }, [0, 2, 3, 4, 5, 6].slice(0, 5).concat());
  assert.ok(r.movidos.length + r.sobrou.length === 1);
});

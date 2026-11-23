// "Não treinei" e "Não corri" (logic/perdido.js): a proposta de passar o treino para outro dia, as regras de descanso, a
// corrida junto, o desfazer, a validação do que fica guardado (e do backup) e a virada da semana.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../www/js/logic/perdido.js';
import * as store from '../www/js/store.js';
import { planoDaSemanaEm, PERGUNTAS as P_CORRIDA, respostasCompletas as corridaOk } from '../www/js/logic/corrida.js';

const J = (x) => JSON.parse(JSON.stringify(x));
const it = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
// treinos de teste: superior, inferior, corpo inteiro, empurrar, puxar e pernas (exercícios do catálogo)
const SUP = [it('flexao-de-bracos'), it('barra-fixa-pronada'), it('flexao-pike')];
const INF = [it('agachamento-peso-corporal'), it('flexao-nordica'), it('panturrilha-em-pe-peso-corporal-degrau')];
const FULL = [it('flexao-de-bracos'), it('barra-fixa-pronada'), it('agachamento-peso-corporal'), it('flexao-nordica')];
const PUSH = [it('flexao-de-bracos'), it('flexao-pike'), it('mergulho-no-banco')];
const PULL = [it('barra-fixa-pronada'), it('barra-fixa-neutra')];
const LEGS = [it('agachamento-peso-corporal'), it('flexao-nordica'), it('ponte-gluteos-solo')];
const dia = (id, itens, nome = 'Treino ' + id.toUpperCase()) => ({ id, nome, foco: '', itens });

// semana de teste: segunda 16/11/2026 a domingo 22/11/2026
const SEG = '2026-11-16';
const D = (i) => P.somaDias(SEG, i); // 0 = segunda ... 6 = domingo; 7 = segunda seguinte
const inicioEm = (k, hora = 18) => { const [a, m, d] = k.split('-').map(Number); return new Date(a, m - 1, d, hora).toISOString(); };
function estado(dias, agenda, extra = {}) {
  return store.sanitize({
    v: store.VERSAO,
    plans: [{ id: 'p1', nome: 'Plano', origem: 'manual', criadoEm: '2026-11-01T10:00:00.000Z', dias, agenda, info: '' }],
    activePlan: 'p1', ...extra,
  });
}
const sessao = (k, itens, diaId = '') => ({ id: 's' + k.replace(/-/g, ''), planId: 'p1', diaId, nome: 'Feito', inicio: inicioEm(k), fim: inicioEm(k, 19), nota: '', itens: itens.map((x) => ({ ex: x.ex, alvo: '10', descanso: 90, sets: Array.from({ length: x.series }, () => ({ kg: 10, reps: 10, seg: null, ok: true })) })) });
const marcar = (st, data, hoje, escolha = 'mover') => {
  const m = P.novaMarca(st, data, hoje, escolha, new Date(Date.parse(hoje + 'T12:00:00Z') + (st.perdidos.length + 1) * 1000).toISOString());
  assert.ok(m, `marca criada em ${data}`);
  return { ...st, perdidos: P.limparPerdidos([...st.perdidos, m]) };
};

// Confere uma semana depois das marcas: um treino por dia; nenhum grupo pesado em dias seguidos nos dias que mudaram
// (inclusive com a segunda-feira seguinte e com treinos já feitos); treino só para depois e dentro da semana; dia de descanso.
function confere(st, hoje, msg) {
  const plan = st.plans[0];
  const sem = P.semanaEfetiva(plan, st.perdidos, SEG);
  const carga = (k) => {
    if (k === 7) { const id = plan.agenda[1]; const d = plan.dias.find((x) => x.id === id); return d ? P.cargaDoTreino(d) : null; }
    const feita = st.sessions.find((s) => P.diaLocal(s.inicio) === D(k));
    if (feita) return P.cargaDoTreino({ itens: feita.itens.map((x) => ({ ex: x.ex, series: x.sets.length })) });
    if (D(k) < hoje && !sem[k].veioDe) return null; // dia que passou sem treino
    const d = plan.dias.find((x) => x.id === sem[k].diaId);
    return d ? P.cargaDoTreino(d) : null;
  };
  const mudou = (k) => k >= 0 && k <= 6 && (!!sem[k].veioDe || !!sem[k].foiPara);
  for (let k = 0; k < 7; k++) {
    if (!mudou(k) && !mudou(k + 1)) continue;
    assert.ok(!P.choca(carga(k), carga(k + 1)), `${msg}: mesmo músculo pesado em ${D(k)} e ${D(k + 1)}`);
  }
  for (const e of st.perdidos) for (const m of e.movs || []) {
    assert.ok(m.para > m.de && P.segundaDe(m.para) === SEG, `${msg}: mudança para frente e dentro da semana`);
    assert.ok(m.para >= e.data, msg);
  }
  const ocupados = sem.filter((d) => d.diaId).map((d) => d.data);
  assert.equal(new Set(ocupados).size, ocupados.length, `${msg}: um treino por dia`);
  assert.ok(sem.some((d) => !d.diaId), `${msg}: sobra dia sem musculação`);
  return sem;
}

test('perdido: validação da marca recusa lixo e o que sai da semana', () => {
  const boa = { tipo: 'musculacao', data: '2026-11-16', planId: 'p1', diaId: 'a', movs: [{ diaId: 'a', de: '2026-11-16', para: '2026-11-18' }], em: '2026-11-16T10:00:00.000Z' };
  assert.deepEqual(P.limparPerdido(boa), boa);
  for (const ruim of [null, 5, 'x', [], {}, { ...boa, tipo: 'natacao' }, { ...boa, data: '2026-02-30' }, { ...boa, data: '16/11/2026' }, { ...boa, planId: '' }, { ...boa, diaId: '__proto__' }, { ...boa, planId: 'a b' }, { ...boa, diaId: 'x'.repeat(41) }]) {
    assert.equal(P.limparPerdido(ruim), null, JSON.stringify(ruim));
  }
  // mudança inválida vira "Seguir a semana" (a marca fica, o treino não muda de dia)
  for (const movs of [
    [{ diaId: 'a', de: '2026-11-16', para: '2026-11-23' }], // outra semana
    [{ diaId: 'a', de: '2026-11-16', para: '2026-11-16' }], // mesmo dia
    [{ diaId: 'a', de: '2026-11-18', para: '2026-11-17' }], // para trás
    [{ diaId: 'b', de: '2026-11-16', para: '2026-11-18' }], // não é o treino perdido
    [{ diaId: 'a', de: '2026-11-16', para: '2026-11-18' }, { diaId: 'b', de: '2026-11-17', para: '2026-11-18' }], // dois no mesmo dia
    [{ diaId: 'a', de: '2026-11-16', para: '2026-11-18' }, { diaId: 'b', de: '2026-11-20', para: '2026-11-19' }],
    'x', [null], [{ diaId: 'a', de: '2026-11-16' }],
  ]) assert.deepEqual(P.limparPerdido({ ...boa, movs }).movs, [], JSON.stringify(movs));
  // campos a mais saem; "em" inválido vira vazio
  const l = P.limparPerdido({ ...boa, em: 'ontem', extra: '<script>' });
  assert.equal(l.em, ''); assert.ok(!('extra' in l));
  assert.deepEqual(P.limparPerdido({ tipo: 'corrida', data: '2026-11-17', em: '2026-11-17T10:00:00.000Z', movs: [1] }), { tipo: 'corrida', data: '2026-11-17', em: '2026-11-17T10:00:00.000Z' });
  // lista: sem repetidos (o mesmo dia e plano), em ordem de data, até o limite
  assert.deepEqual(P.limparPerdidos('x'), []); assert.deepEqual(P.limparPerdidos(null), []);
  const lista = P.limparPerdidos([{ ...boa, data: '2026-11-18', movs: [] }, boa, { ...boa, em: '2026-11-16T11:00:00.000Z' }, { lixo: 1 }, { tipo: 'corrida', data: '2026-11-16' }]);
  assert.deepEqual(lista.map((x) => x.tipo + ':' + x.data), ['corrida:2026-11-16', 'musculacao:2026-11-16', 'musculacao:2026-11-18']);
  assert.equal(lista[1].em, '2026-11-16T10:00:00.000Z', 'repetida: fica a primeira');
  const muitas = Array.from({ length: P.MAX_PERDIDOS + 30 }, (_, i) => ({ tipo: 'corrida', data: P.somaDias('2026-01-01', i) }));
  const cortada = P.limparPerdidos(muitas);
  assert.equal(cortada.length, P.MAX_PERDIDOS); assert.equal(cortada[cortada.length - 1].data, P.somaDias('2026-01-01', P.MAX_PERDIDOS + 29), 'ficam as mais recentes');
});

test('perdido: backup com marcas inválidas entra limpo e o estado sem o campo ganha a lista vazia', () => {
  const st = estado([dia('a', FULL)], { 1: 'a' });
  assert.deepEqual(st.perdidos, [], 'estado antigo, sem o campo');
  const txt = JSON.stringify({ app: 'fitcore', v: 1, dados: { ...J(st), perdidos: [
    { tipo: 'musculacao', data: '2026-11-16', planId: 'p1', diaId: 'a', movs: [{ diaId: 'a', de: '2026-11-16', para: '2026-11-30' }], em: '2026-11-16T10:00:00.000Z' },
    { tipo: 'musculacao', data: '2026-13-01', planId: 'p1', diaId: 'a' }, { tipo: 'corrida', data: 20261117 }, '<img src=x>', { tipo: 'corrida', data: '2026-11-17', em: 'x' },
  ] } });
  const { dados } = store.readBackup(txt);
  assert.deepEqual(dados.perdidos, [
    { tipo: 'musculacao', data: '2026-11-16', planId: 'p1', diaId: 'a', movs: [], em: '2026-11-16T10:00:00.000Z' },
    { tipo: 'corrida', data: '2026-11-17', em: '' },
  ]);
  assert.deepEqual(store.readBackup(JSON.stringify({ app: 'fitcore', v: 1, dados: { ...J(st), perdidos: 'nada' } })).dados.perdidos, []);
  // validar de novo não muda nada
  assert.deepEqual(store.sanitize(J(dados)).perdidos, dados.perdidos);
});

test('perdido: 2 treinos de corpo inteiro (segunda e quinta) — o de segunda passa para terça', () => {
  const st = estado([dia('a', FULL), dia('b', FULL)], { 1: 'a', 4: 'b' });
  const p = P.propor(st, D(0), D(0));
  assert.equal(p.motivo, 'livre');
  assert.deepEqual(p.movs, [{ diaId: 'a', de: D(0), para: D(1) }]);
  assert.equal(p.titulo, 'Passar o Treino A para amanhã?');
  assert.equal(p.texto, 'Os outros continuam nos dias deles.');
  const st2 = marcar(st, D(0), D(0));
  const sem = confere(st2, D(0), '2x');
  assert.equal(sem[0].perdido.para, D(1)); assert.equal(sem[0].diaId, '');
  assert.equal(sem[1].diaId, 'a'); assert.equal(sem[1].veioDe, D(0));
  assert.equal(P.treinoDoDia(st2, D(1)).diaId, 'a');
  // perdeu na segunda, marcou na quarta: terça já passou; quarta fica colada na quinta; vai para sábado
  const p2 = P.propor(st, D(0), D(2));
  assert.deepEqual(p2.movs, [{ diaId: 'a', de: D(0), para: D(5) }]);
  confere(marcar(st, D(0), D(2)), D(2), '2x, marcado depois');
});

test('perdido: 3 treinos de corpo inteiro (seg, qua, sex) — os seguintes andam junto e respeitam a segunda seguinte', () => {
  const st = estado([dia('a', FULL), dia('b', FULL), dia('c', FULL)], { 1: 'a', 3: 'b', 5: 'c' });
  const p = P.propor(st, D(0), D(0));
  assert.deepEqual(p.movs, [{ diaId: 'a', de: D(0), para: D(1) }, { diaId: 'b', de: D(2), para: D(3) }, { diaId: 'c', de: D(4), para: D(5) }]);
  assert.match(p.texto, /Treino B vai para quinta e o Treino C vai para sábado/);
  const sem = confere(marcar(st, D(0), D(0)), D(0), '3x seg');
  assert.equal(sem[2].foiPara, D(3)); assert.equal(sem[2].diaId, '');
  // o treino de domingo ficaria colado no de segunda que vem: perdendo na quarta, B vai para quinta e C para sábado
  const q = P.propor(st, D(2), D(2));
  assert.deepEqual(q.movs, [{ diaId: 'b', de: D(2), para: D(3) }, { diaId: 'c', de: D(4), para: D(5) }]);
  // perdido na sexta: sábado e domingo ficariam colados (domingo com a segunda seguinte): segue a semana
  const r = P.propor(st, D(4), D(4));
  assert.equal(r.movs.length, 1, 'sábado: 48 horas depois de quarta e antes de segunda');
  assert.equal(r.movs[0].para, D(5));
  // marcado no domingo: não há mais dia na semana
  const s = P.propor(st, D(4), D(6));
  assert.deepEqual(s.movs, []); assert.equal(s.motivo, 'sem_descanso');
  assert.match(s.texto, /volta na próxima sexta/);
});

test('perdido: 4 treinos superior/inferior e 5 e 6 treinos em divisão por grupos — todas as posições', () => {
  const configs = [
    { nome: '4x sup/inf', dias: [dia('a', SUP), dia('b', INF)], agenda: { 1: 'a', 2: 'b', 4: 'a', 5: 'b' } },
    { nome: '5x', dias: [dia('a', PUSH), dia('b', PULL), dia('c', LEGS), dia('d', SUP), dia('e', INF)], agenda: { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e' } },
    { nome: '6x PPL', dias: [dia('a', PUSH), dia('b', PULL), dia('c', LEGS)], agenda: { 1: 'a', 2: 'b', 3: 'c', 4: 'a', 5: 'b', 6: 'c' } },
    { nome: '3x corpo inteiro', dias: [dia('a', FULL), dia('b', FULL), dia('c', FULL)], agenda: { 1: 'a', 3: 'b', 5: 'c' } },
    { nome: '2x corpo inteiro', dias: [dia('a', FULL), dia('b', FULL)], agenda: { 2: 'a', 5: 'b' } },
  ];
  let movidos = 0, seguidos = 0;
  for (const c of configs) {
    const st = estado(c.dias, c.agenda);
    for (let k = 0; k < 7; k++) {
      if (!c.agenda[(k + 1) % 7]) { assert.equal(P.podeMarcar(st, D(k), D(k)).pode, false, `${c.nome}: dia sem treino não marca`); continue; }
      for (const h of [k, Math.min(6, k + 1), 6]) {
        const p = P.propor(st, D(k), D(h));
        assert.ok(p.pode, `${c.nome}: pode marcar ${D(k)} em ${D(h)}`);
        if (p.movs.length) { movidos++; assert.ok(p.movs[0].para >= D(h) && p.movs[0].para > D(k), `${c.nome}: nunca para um dia que passou`); }
        else seguidos++;
        confere(marcar(st, D(k), D(h)), D(h), `${c.nome} perdido ${D(k)} marcado ${D(h)}`);
        confere(marcar(st, D(k), D(h), 'seguir'), D(h), `${c.nome} seguir`);
      }
    }
  }
  assert.ok(movidos > 10 && seguidos > 5, `há casos dos dois tipos (${movidos} mudaram, ${seguidos} seguiram)`);
  // 4x sup/inf: perder a segunda (superior) leva para sábado; quarta ficaria colada no superior de quinta
  const ul = estado(configs[0].dias, configs[0].agenda);
  assert.deepEqual(P.propor(ul, D(0), D(0)).movs, [{ diaId: 'a', de: D(0), para: D(5) }]);
  // 6x: o único dia livre é domingo, colado com a segunda seguinte (empurrar): o empurrar perdido vai para terça e o
  // puxar de terça anda para domingo (o mínimo de treinos mudando de dia)
  const ppl = estado(configs[2].dias, configs[2].agenda);
  assert.deepEqual(P.propor(ppl, D(0), D(0)).movs, [{ diaId: 'a', de: D(0), para: D(1) }, { diaId: 'b', de: D(1), para: D(6) }]);
});

test('perdido: nunca dois treinos no mesmo dia; treino já feito não muda e conta para o descanso', () => {
  const st = estado([dia('a', FULL), dia('b', FULL)], { 1: 'a', 4: 'b' }, { sessions: [] });
  // fez um treino livre de corpo inteiro na terça: o A perdido na segunda não pode ir para terça nem para quarta
  const feito = { ...st, sessions: [sessao(D(1), FULL)] };
  const p = P.propor(feito, D(0), D(1));
  assert.ok(!p.movs.length || (p.movs[0].para !== D(1) && p.movs[0].para !== D(2)), JSON.stringify(p.movs));
  // treinou no dia: não dá para marcar "Não treinei"
  assert.equal(P.podeMarcar({ ...st, sessions: [sessao(D(0), FULL, 'a')] }, D(0), D(0)).motivo, 'treinou');
  // treino em andamento hoje
  assert.equal(P.podeMarcar({ ...st, current: { id: 'x' } }, D(0), D(0)).motivo, 'em_andamento');
  // dia futuro, outra semana e plano criado depois do dia
  assert.equal(P.podeMarcar(st, D(3), D(0)).motivo, 'futuro');
  assert.equal(P.podeMarcar(st, P.somaDias(SEG, -6), D(0)).motivo, 'outra_semana');
  const novo = { ...st, plans: [{ ...st.plans[0], criadoEm: inicioEm(D(2)) }] };
  assert.equal(P.podeMarcar(novo, D(0), D(3)).motivo, 'antes_do_plano');
});

test('perdido: menores de 18 e diabetes — força em dias não seguidos', () => {
  const dias = [dia('a', SUP), dia('b', INF)];
  const agenda = { 1: 'a', 2: 'b', 4: 'a', 5: 'b' };
  const adulto = estado(dias, agenda);
  assert.equal(P.propor(adulto, D(0), D(0)).movs[0].para, D(5), 'adulto: superior no sábado, depois do inferior de sexta');
  const jovem = estado(dias, agenda, { trainer: { answers: { idade: 16 } } });
  const pj = P.propor(jovem, D(0), D(0));
  // terça, quinta e sexta já são seguidos na agenda: o que mudou de dia nunca fica colado em outro treino
  const colado = (st) => { const sem = P.semanaEfetiva(st.plans[0], st.perdidos, SEG); const tem = (k) => (k === 7 ? !!st.plans[0].agenda[1] : k >= 0 && !!sem[k].diaId); return sem.some((d, k) => d.veioDe && (tem(k - 1) || tem(k + 1))); };
  assert.ok(!pj.movs.length || !colado(marcar(jovem, D(0), D(0))), 'menor de 18: ' + JSON.stringify(pj.movs));
  assert.ok(colado(marcar(adulto, D(0), D(0))), 'adulto: pode ficar colado quando os músculos são outros');
  // a idade da entrevista de corrida também vale
  const jovemCorrida = estado(dias, agenda, { run: { answers: { idade: 15 } } });
  assert.deepEqual(P.propor(jovemCorrida, D(0), D(0)).movs, pj.movs);
  // 2 treinos de corpo inteiro com diabetes: terça ficaria colada em quarta? (quinta é o B) → terça serve (48 h até quinta)
  const diab = estado([dia('a', SUP), dia('b', INF)], { 1: 'a', 4: 'b' }, { trainer: { answers: { idade: 40, condicoes: ['diabetes'] } } });
  const pd = P.propor(diab, D(0), D(0));
  assert.ok(pd.movs.length && ![D(2), D(4)].includes(pd.movs[0].para), 'com diabetes, nunca colado no treino de quinta: ' + JSON.stringify(pd.movs));
});

test('perdido: com corrida e prioridade na corrida, pernas não ficam na véspera da corrida forte ou do longo', () => {
  const corrida = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: ['2', '4', '6'], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  for (const q of P_CORRIDA) if (!(q.k in corrida) && !(q.se && !q.se(corrida)) && !q.opcional) corrida[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  assert.ok(corridaOk(corrida), 'respostas de corrida completas');
  const run = { answers: corrida, aceitoEm: '2026-11-02T10:00:00.000Z', inicio: '2026-11-02', pausadoEm: '' };
  const dias = [dia('a', LEGS, 'Pernas'), dia('b', SUP, 'Superior')];
  for (const foco of ['corrida', 'equilibrio', 'musculacao']) {
    const st = estado(dias, { 1: 'a', 3: 'b' }, { run, combo: { foco, fortalecimento: 'nao', em: '2026-11-02T10:00:00.000Z' } });
    const sem = planoDaSemanaEm(st, D(0), SEG);
    assert.ok(sem && Array.isArray(sem.dias), 'plano de corrida legível');
    const chave = new Set();
    for (let k = 0; k < 7; k++) { const d = sem.dias[(k + 1) % 7]; if (d && (d.tipo === 'longo' || d.forte === true || d.intensidade === 'forte')) chave.add(k); }
    assert.ok(chave.size >= 1, 'a semana tem corrida forte ou longo');
    const p = P.propor(st, D(0), D(0));
    if (foco === 'musculacao') continue; // a corrida se ajusta à musculação
    for (const m of p.movs) if (m.diaId === 'a') {
      const k = (Date.parse(m.para) - Date.parse(SEG)) / 86400000;
      assert.ok(!chave.has(k + 1), `${foco}: pernas na véspera da corrida-chave (${m.para})`);
      assert.ok(!chave.has(k + 2), `${foco}: novo na musculação, pernas a 48 horas da corrida-chave (${m.para})`);
    }
    if (!p.movs.length) assert.ok(['corrida', 'sem_descanso', 'sem_dia'].includes(p.motivo));
  }
});

test('perdido: "Não corri" fica registrado e não muda a corrida registrada', () => {
  const corrida = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: ['1', '3', '6'], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  for (const q of P_CORRIDA) if (!(q.k in corrida) && !(q.se && !q.se(corrida)) && !q.opcional) corrida[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  const st = estado([], {}, { run: { answers: corrida, aceitoEm: '2026-11-02T10:00:00.000Z', inicio: '2026-11-02', pausadoEm: '' } });
  const sem = planoDaSemanaEm(st, D(2), SEG);
  const comCorrida = [0, 1, 2, 3, 4, 5, 6].filter((k) => { const d = sem.dias[(k + 1) % 7]; return d && d.tipo !== 'descanso'; });
  assert.ok(comCorrida.length >= 2);
  for (let k = 0; k < 7; k++) assert.equal(P.podeMarcarCorrida(st, D(k), D(2)), comCorrida.includes(k) && k <= 2, `corrida em ${D(k)}`);
  const k0 = comCorrida[0];
  const m = P.marcaCorrida(D(k0), '2026-11-18T10:00:00.000Z');
  const st2 = { ...st, perdidos: P.limparPerdidos([m]) };
  assert.equal(P.podeMarcarCorrida(st2, D(k0), D(2)), false, 'já marcado');
  assert.ok(P.corridaPerdidaEm(st2, D(k0)));
  assert.deepEqual(st2.runs, st.runs, 'nenhuma corrida inventada');
  assert.equal(P.semanaEfetiva(null, st2.perdidos, SEG)[k0].corridaPerdida.data, D(k0));
  // com a corrida registrada, não marca
  assert.equal(P.podeMarcarCorrida({ ...st, runs: [{ id: 'r1', data: D(k0) }] }, D(k0), D(2)), false);
  // desfazer tira só ela
  assert.deepEqual(P.desfazer(st2.perdidos, m), { lista: [], removidas: 1 });
});

test('perdido: desfazer tira a marca e as feitas depois dela na semana; o treino volta ao dia da agenda', () => {
  const st = estado([dia('a', FULL), dia('b', FULL)], { 1: 'a', 4: 'b' });
  const st1 = marcar(st, D(0), D(0)); // A: segunda → terça
  assert.equal(P.treinoDoDia(st1, D(1)).diaId, 'a');
  // terça também não deu: o A (que veio de segunda) é o treino perdido agora
  assert.equal(P.podeMarcar(st1, D(1), D(1)).diaId, 'a');
  const st2 = marcar(st1, D(1), D(1), 'seguir');
  const sem = P.semanaEfetiva(st2.plans[0], st2.perdidos, SEG);
  assert.equal(sem[0].perdido.para, D(1)); assert.equal(sem[1].perdido.para, ''); assert.equal(sem[1].diaId, '');
  assert.equal(P.quantasSaem(st2.perdidos, st2.perdidos[0]), 2);
  const volta = P.desfazer(st2.perdidos, st2.perdidos[0]);
  assert.deepEqual(volta, { lista: [], removidas: 2 });
  const sem0 = P.semanaEfetiva(st.plans[0], volta.lista, SEG);
  assert.equal(sem0[0].diaId, 'a'); assert.equal(sem0[1].diaId, '');
  // desfazer a última só tira ela
  assert.equal(P.desfazer(st2.perdidos, st2.perdidos[1]).lista.length, 1);
  // alvo que não existe não muda nada
  assert.equal(P.desfazer(st2.perdidos, { tipo: 'musculacao', data: D(5), planId: 'p1' }).removidas, 0);
});

test('perdido: virada de semana e plano mudado depois da marca', () => {
  const st = estado([dia('a', FULL), dia('b', FULL)], { 1: 'a', 4: 'b' });
  const st1 = marcar(st, D(0), D(0));
  // semana seguinte: a agenda de sempre, sem marcas
  const prox = P.semanaEfetiva(st1.plans[0], st1.perdidos, D(7));
  assert.equal(prox[0].diaId, 'a'); assert.equal(prox[3].diaId, 'b'); assert.ok(prox.every((d) => !d.perdido && !d.veioDe));
  // na semana seguinte não dá mais para marcar o dia da semana passada, e o dia de hoje marca normalmente
  assert.equal(P.podeMarcar(st1, D(3), D(7)).motivo, 'outra_semana');
  assert.ok(P.podeMarcar(st1, D(7), D(7)).pode);
  // a semana passada continua mostrando o que aconteceu
  assert.ok(P.semanaEfetiva(st1.plans[0], st1.perdidos, SEG)[0].perdido);
  // o plano mudou (a segunda virou o B): a marca antiga não vale mais e o dia aparece como na agenda
  const mudado = { ...st1, plans: [{ ...st1.plans[0], agenda: { 1: 'b', 4: 'a' } }] };
  const sm = P.semanaEfetiva(mudado.plans[0], mudado.perdidos, SEG);
  assert.equal(sm[0].perdido, null); assert.equal(sm[0].diaId, 'b'); assert.equal(sm[1].diaId, '');
  // outro plano ativo: a marca é do plano antigo e não aparece
  const outro = { ...st1, plans: [...st1.plans, { ...st1.plans[0], id: 'p2' }], activePlan: 'p2' };
  assert.equal(P.treinoDoDia(outro, D(0)).perdido, null);
  // mudança que não bate mais (o dia que recebeu ganhou treino na agenda) vira "seguir": marca sem mover
  const cheio = { ...st1, plans: [{ ...st1.plans[0], agenda: { 1: 'a', 2: 'b', 4: 'b' } }] };
  const sc = P.semanaEfetiva(cheio.plans[0], cheio.perdidos, SEG);
  assert.equal(sc[0].perdido.para, ''); assert.equal(sc[1].diaId, 'b');
});

test('perdido: textos curtos e dia da semana certo', () => {
  assert.equal(P.naProxima('2026-11-16'), 'na próxima segunda');
  assert.equal(P.naProxima('2026-11-21'), 'no próximo sábado');
  assert.equal(P.naProxima('2026-11-22'), 'no próximo domingo');
  assert.equal(P.nomeDoDia('2026-11-19', '2026-11-16'), 'quinta');
  assert.equal(P.nomeDoDia('2026-11-16', '2026-11-16'), 'hoje');
  assert.equal(P.segundaDe('2026-11-22'), '2026-11-16'); assert.equal(P.segundaDe('2026-11-16'), '2026-11-16');
  // semana sem dia livre: texto de "seguir"
  const todos = estado([dia('a', FULL)], { 0: 'a', 1: 'a', 2: 'a', 3: 'a', 4: 'a', 5: 'a', 6: 'a' });
  const p = P.propor(todos, D(0), D(0));
  assert.deepEqual(p.movs, []); assert.equal(p.motivo, 'sem_dia');
  assert.match(p.texto, /^Não há outro dia livre nesta semana\. O Treino A volta na próxima segunda/);
});

// ---------- o motivo e a troca de dia na própria folha (1.9) ----------
test('perdido: o motivo fica na marca, só com as chaves conhecidas, e passa pelo backup', () => {
  const boa = { tipo: 'musculacao', data: '2026-11-16', planId: 'p1', diaId: 'a', movs: [], em: '2026-11-16T10:00:00.000Z' };
  for (const m of Object.keys(P.MOTIVOS)) assert.equal(P.limparPerdido({ ...boa, motivo: m }).motivo, m);
  for (const ruim of ['febre', '<b>', '__proto__', 'constructor', 5, null, '']) assert.ok(!('motivo' in P.limparPerdido({ ...boa, motivo: ruim })), String(ruim));
  assert.equal(P.limparPerdido({ tipo: 'corrida', data: '2026-11-17', em: '', para: '2026-11-18', motivo: 'chuva' }).motivo, 'chuva');
  assert.ok(!('motivo' in P.limparPerdido({ tipo: 'troca', data: '2026-11-17', de: '2026-11-18', planId: 'p1', diaId: 'a', em: '', motivo: 'tempo' })), 'a troca não tem motivo');
  const st = estado([dia('a', FULL)], { 1: 'a' });
  const txt = JSON.stringify({ app: 'fitcore', v: 1, dados: { ...J(st), perdidos: [{ ...boa, motivo: 'cansaco' }, { tipo: 'corrida', data: '2026-11-17', em: '', motivo: 'xx' }] } });
  const { dados } = store.readBackup(txt);
  assert.equal(dados.perdidos[0].motivo, 'cansaco'); assert.ok(!('motivo' in dados.perdidos[1]));
  assert.deepEqual(store.sanitize(J(dados)).perdidos, dados.perdidos);
});

test('perdido: as opções de dia — amanhã, outro dia livre e o porquê de cada dia que não dá', () => {
  const st = estado([dia('a', FULL), dia('b', FULL)], { 1: 'a', 4: 'b' });
  const o = P.opcoesDeDia(st, D(0), D(0));
  assert.deepEqual(o.dias.map((d) => d.data), [D(1), D(2), D(3), D(4), D(5), D(6)], 'de amanhã a domingo');
  const por = Object.fromEntries(o.dias.map((d) => [d.data, d]));
  assert.ok(por[D(1)].pode && o.melhor === D(1), 'amanhã serve e é a proposta');
  // quarta fica colada no B de quinta: só dá se o B andar junto
  if (por[D(2)].pode) assert.ok(por[D(2)].movs.some((x) => x.diaId === 'b' && x.para > D(3)), JSON.stringify(por[D(2)].movs));
  else assert.equal(por[D(2)].motivo, 'sem_descanso');
  assert.equal(P.porQueNaoDia({ data: D(2), motivo: 'sem_descanso' }, D(0)), 'Quarta, os mesmos músculos ficariam sem 48 horas de descanso.');
  assert.match(P.porQueNaoDia({ data: D(1), motivo: 'corrida' }, D(0)), /^Amanhã, o treino de pernas ficaria perto da corrida forte/);
  // quinta já tem o B: o A vai para quinta só se o B andar (trocar a ordem), sem juntar os dois
  if (por[D(3)].pode) assert.ok(por[D(3)].movs.length === 2 && por[D(3)].movs[1].diaId === 'b' && por[D(3)].movs[1].para > D(3), JSON.stringify(por[D(3)].movs));
  else assert.match(P.porQueNaoDia(por[D(3)], D(0)), /já tem o Treino B/);
  // cada dia possível vira uma marca válida, com o motivo, e a semana segue as regras
  for (const d of o.dias.filter((x) => x.pode)) {
    const m = P.novaMarca(st, D(0), D(0), 'mover', '2026-11-16T12:00:00.000Z', { para: d.data, motivo: 'tempo' });
    assert.equal(m.movs[0].para, d.data); assert.equal(m.motivo, 'tempo');
    confere({ ...st, perdidos: P.limparPerdidos([m]) }, D(0), 'para ' + d.data);
  }
  // a semana em uma linha, antes de confirmar
  const m = P.novaMarca(st, D(0), D(0), 'mover', '2026-11-16T12:00:00.000Z', { para: D(1) });
  assert.equal(P.linhaDaSemana(P.comMarca(st, m), D(0)), 'amanhã Treino A · quinta Treino B');
  assert.equal(P.linhaDaSemana(st, D(0)), 'hoje Treino A · quinta Treino B', 'comMarca não muda o estado');
});

test('perdido: amanhã já tem treino — passar para amanhã troca a ordem, nunca junta', () => {
  const st = estado([dia('a', FULL), dia('b', FULL)], { 1: 'a', 2: 'b' });
  const d = P.opcoesDeDia(st, D(0), D(0)).dias.find((x) => x.data === D(1));
  assert.ok(d.pode, 'amanhã serve, com o B andando');
  assert.equal(d.movs.length, 2); assert.equal(d.movs[1].diaId, 'b'); assert.ok(d.movs[1].para >= D(3), 'o B fica a 48 horas do A');
  assert.match(d.texto, /^Para manter o descanso entre os treinos, o Treino B vai para /);
  const sem = confere(marcar({ ...st }, D(0), D(0)), D(0), 'troca de ordem');
  assert.ok(sem.every((x) => !x.diaId || x.diaId === 'a' || x.diaId === 'b'));
});

test('perdido: dia sem treino e menor de 18 — o porquê de amanhã', () => {
  const st = estado([dia('a', FULL), dia('b', FULL)], { 1: 'a', 4: 'b' }, { trainer: { answers: { semTreino: ['2'] } } });
  const o = P.opcoesDeDia(st, D(0), D(0));
  const ter = o.dias.find((x) => x.data === D(1));
  assert.equal(ter.motivo, 'bloqueado');
  assert.equal(P.porQueNaoDia(ter, D(0)), 'Amanhã é um dia em que você não pode fazer musculação.');
  assert.ok(o.dias.some((x) => x.pode) && o.melhor !== D(1));
  const jovem = estado([dia('a', SUP), dia('b', INF)], { 1: 'a', 3: 'b' }, { trainer: { answers: { idade: 16 } } });
  const oj = P.opcoesDeDia(jovem, D(0), D(0));
  assert.ok(oj.alternado, 'menor de 18: força em dias não seguidos');
  // cada dia possível deixa o treino que mudou longe de outro treino
  for (const x of oj.dias.filter((y) => y.pode)) {
    const sj = P.semanaEfetiva(jovem.plans[0], P.limparPerdidos([P.novaMarca(jovem, D(0), D(0), 'mover', '', { para: x.data })]), SEG);
    sj.forEach((d, k) => { if (d.veioDe) assert.ok(!(k > 0 && sj[k - 1].diaId) && !(k < 6 && sj[k + 1].diaId), 'colado em ' + d.data); });
  }
  assert.match(P.porQueNaoDia({ data: D(1), motivo: 'sem_descanso' }, D(0), true), /dias não seguidos/);
});

test('perdido: com um problema de saúde que muda o treino, nada é reposto nesses dias (musculação, troca e corrida)', async () => {
  const { novoProblema } = await import('../www/js/logic/saude-fora.js');
  const febre = novoProblema('sf1', D(0), { tipo: 'febre', urgente: false, atendimento: false });
  assert.ok(febre, 'problema válido');
  const st = estado([dia('a', FULL), dia('b', FULL)], { 1: 'a', 4: 'b' }, { saudeFora: [febre] });
  assert.ok(P.diasDeSaude(st, D(0), 'musc').has(D(1)), 'a febre vale nos próximos dias');
  const p = P.propor(st, D(0), D(0));
  assert.deepEqual(p.movs, []); assert.equal(p.motivo, 'saude');
  assert.match(p.texto, /problema de saúde/);
  assert.ok(P.opcoesDeDia(st, D(0), D(0)).dias.every((x) => !x.pode && x.motivo === 'saude'));
  assert.equal(P.avaliarTroca(st, D(3), D(1), D(1)).motivo, 'saude', 'não traz o treino de outro dia para um dia com febre');
  // sem o problema, o mesmo estado repõe
  assert.ok(P.propor({ ...st, saudeFora: [] }, D(0), D(0)).movs.length);
});

test('perdido: cansaço como motivo — conta na semana; mais de uma semana pede treino mais leve', () => {
  const st = estado([dia('a', FULL)], { 1: 'a', 4: 'a' });
  const m = (data, motivo) => ({ tipo: 'musculacao', data, planId: 'p1', diaId: 'a', movs: [], em: data + 'T12:00:00.000Z', motivo });
  const c1 = P.cansacoRecente({ ...st, perdidos: P.limparPerdidos([m(D(0), 'cansaco'), m(D(3), 'cansaco')]) }, D(3));
  assert.deepEqual(c1, { n: 2, semana: 2, maisDeUmaSemana: false });
  const c2 = P.cansacoRecente({ ...st, perdidos: P.limparPerdidos([m(P.somaDias(SEG, -4), 'cansaco'), { tipo: 'corrida', data: D(3), em: '', motivo: 'cansaco' }]) }, D(3));
  assert.equal(c2.maisDeUmaSemana, true, 'cansaço há 7 dias ou mais (musculação e corrida)');
  const c3 = P.cansacoRecente({ ...st, perdidos: P.limparPerdidos([m(D(0), 'tempo'), m(D(3), 'viagem')]) }, D(3));
  assert.equal(c3.n, 0, 'outros motivos não contam');
});

test('perdido: corrida — opções de dia, a marca com o motivo e o porquê', () => {
  const corrida = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: ['1', '4'], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  for (const q of P_CORRIDA) if (!(q.k in corrida) && !(q.se && !q.se(corrida)) && !q.opcional) corrida[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  const st = estado([], {}, { run: { answers: corrida, aceitoEm: '2026-11-02T10:00:00.000Z', inicio: '2026-11-02', pausadoEm: '' } });
  const sem = planoDaSemanaEm(st, D(0), SEG);
  const k0 = [0, 1, 2, 3, 4, 5, 6].find((k) => { const d = sem.dias[(k + 1) % 7]; return d && d.tipo !== 'descanso'; });
  assert.ok(k0 != null, 'há corrida na semana');
  const ops = P.opcoesCorrida(st, D(k0), D(k0));
  assert.ok(ops.every((o) => o.data > D(k0)), 'só para hoje em diante, sem o próprio dia');
  const ocup = ops.find((o) => o.motivo === 'ocupado');
  if (ocup) assert.match(P.porQueNaoCorrida(ocup, D(k0)), /já tem corrida\. O app não junta duas/);
  const livre = ops.find((o) => o.pode);
  assert.ok(livre, 'algum dia livre recebe a corrida');
  const m = P.marcaMoverCorrida(st, D(k0), livre.data, D(k0), '2026-11-16T12:00:00.000Z', 'tempo');
  assert.deepEqual({ para: m.para, motivo: m.motivo }, { para: livre.data, motivo: 'tempo' });
  const st2 = P.comMarca(st, m);
  assert.ok(P.linhaDaSemana(st2, D(k0), 'corrida').startsWith(P.nomeDoDia(livre.data, D(k0))), P.linhaDaSemana(st2, D(k0), 'corrida'));
  assert.equal(P.marcaCorrida(D(k0), '', 'chuva').motivo, 'chuva');
  // a semana do chat traz o motivo
  const sc = P.semanaDoChat(P.comMarca(st, P.marcaCorrida(D(k0), '', 'chuva')), D(k0), D(k0));
  assert.equal(sc[k0].corrida.motivo, 'chuva');
});


// ---------- 1.14.0: feriado (a academia não abre) ----------
test('feriado: o treino do dia é marcado antes (futuro) e vai para outro dia; nenhum treino vai para um feriado', () => {
  // seg A (sup), ter B (inf), qui A, sex B; hoje é segunda; quinta é feriado
  const base = estado([dia('a', SUP), dia('b', INF)], { 1: 'a', 2: 'b', 4: 'a', 5: 'b' }, { feriados: [D(3)] });
  assert.deepEqual(base.feriados, [D(3)]);
  assert.ok(P.ehFeriado(base, D(3)));
  // sem "futuro", a quinta não pode ser marcada; com ele, pode, com o motivo feriado
  assert.equal(P.podeMarcar(base, D(3), D(0)).pode, false);
  assert.equal(P.podeMarcar(base, D(3), D(0), { futuro: true }).pode, true);
  const o = P.opcoesDeDia(base, D(3), D(0), { futuro: true });
  assert.ok(o.pode);
  const m = P.novaMarca(base, D(3), D(0), 'mover', '2026-11-16T09:00:00.000Z', { futuro: true, para: o.melhor, motivo: 'feriado' });
  assert.ok(m && m.motivo === 'feriado' && m.movs.length && m.movs[0].para !== D(3));
  // o treino de terça perdido não pode ir para a quinta (feriado)
  const o2 = P.opcoesDeDia(base, D(1), D(1));
  const qui = o2.dias.find((x) => x.data === D(3));
  assert.ok(qui && !qui.pode && qui.motivo === 'feriado', JSON.stringify(qui));
  assert.match(P.porQueNaoDia(qui, D(1)), /feriado: a academia não abre/);
  // datas inválidas saem; repetidas ficam uma vez
  assert.deepEqual(P.limparFeriados(['2026-11-20', 'x', '2026-11-20', '2026-13-40']), ['2026-11-20']);
});

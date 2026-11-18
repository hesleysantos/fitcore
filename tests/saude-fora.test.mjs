// Problemas de saúde que não vêm do treino (logic/saude-fora.js): cada tipo × gravidade × região → o efeito certo;
// a região bloqueada não aparece nos treinos; "sem treino" tira a musculação e a corrida; volta gradual; validação e
// backup; e as intenções do chat percorridas até o fim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EX_POR_ID } from '../www/js/data/exercises.js';
import { REFS } from '../www/js/data/knowledge.js';
import { REFS_CORRIDA } from '../www/js/data/corrida.js';
import { LOCAIS_DOR } from '../www/js/logic/dor.js';
import * as S from '../www/js/logic/saude-fora.js';
import { gerarPlano, doresDoTreino, alertaDoExercicio, ajustesPorDor, carregaRegiao } from '../www/js/logic/trainer.js';
import { planoDaSemana, planoAtual } from '../www/js/logic/corrida.js';
import * as store from '../www/js/store.js';
import * as CH from '../www/js/logic/chat/saude.js';
import { COACHES } from '../www/js/logic/chat/contrato.js';

const HOJE = '2026-11-17'; // terça
const somaDias = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const prob = (x = {}) => ({ id: 'sf1', data: HOJE, tipo: 'febre', onde: '', grau: '', piora: false, sinais: '', detalhe: '', avaliado: '', visto: '', fim: '', ...x });
const ef = (x, hoje = HOJE) => S.efeitoDoProblema(prob(x), hoje);
const temRef = (k) => Object.prototype.hasOwnProperty.call(REFS, k) || Object.prototype.hasOwnProperty.call(REFS_CORRIDA, k);
const PERNAS = new Set(['lombar', 'quadril', 'virilha', 'coxa-frente', 'coxa-tras', 'joelho', 'canela', 'panturrilha', 'aquiles', 'tornozelo', 'pe', 'gluteo']);
const LOCAIS = Object.keys(LOCAIS_DOR);
const GRAUS = ['leve', 'moderada', 'forte'];

test('saúde fora do treino: registro válido passa inteiro; lixo é recusado', () => {
  assert.deepEqual(S.limparProblema(prob()), prob());
  assert.deepEqual(S.limparProblema(prob({ tipo: 'pancada', onde: 'joelho', grau: 'forte', piora: true })), prob({ tipo: 'pancada', onde: 'joelho', grau: 'forte', piora: true }));
  for (const ruim of [null, 3, 'x', [], {}, prob({ tipo: 'gripe' }), prob({ tipo: '__proto__' }), prob({ tipo: 'pancada' }), prob({ tipo: 'corte', onde: 'nariz' }), prob({ tipo: 'pancada', onde: 'constructor' }),
    prob({ data: '2026-02-31' }), prob({ data: '17/11/2026' }), prob({ id: '' }), prob({ id: 'a b' }), prob({ id: '<x>' })]) assert.equal(S.limparProblema(ruim), null, JSON.stringify(ruim));
  // campos estranhos viram o padrão; região só nos tipos com região; datas antes do registro não valem
  const p = S.limparProblema(prob({ onde: 'joelho', grau: 'muito', piora: 'sim', sinais: 'talvez', detalhe: '<script>', fim: '2026-11-01', avaliado: '2026-11-30', extra: 1 }));
  assert.equal(p.onde, ''); assert.equal(p.grau, ''); assert.equal(p.piora, false); assert.equal(p.sinais, ''); assert.equal(p.detalhe, ''); assert.equal(p.fim, ''); assert.equal(p.avaliado, '2026-11-30'); assert.ok(!('extra' in p));
  // lista: sem repetidos, em ordem de data, com limite
  const l = S.limparSaudeFora([prob({ id: 'b', data: '2026-11-10' }), prob({ id: 'a', data: '2026-11-02' }), prob({ id: 'a', data: '2026-11-03' }), { lixo: 1 }]);
  assert.deepEqual(l.map((x) => x.id), ['a', 'b']);
  assert.equal(S.limparSaudeFora(Array.from({ length: S.MAX_SAUDE + 30 }, (_, i) => prob({ id: 'p' + i }))).length, S.MAX_SAUDE);
  assert.deepEqual(S.limparSaudeFora('x'), []);
});

test('cada tipo × gravidade × região (e sinais) → o efeito certo', () => {
  let casos = 0;
  for (const tipo of Object.keys(S.TIPOS_SAUDE)) {
    const onde = S.TIPOS_SAUDE[tipo].regiao ? LOCAIS : [''];
    for (const o of onde) for (const grau of ['', ...GRAUS]) for (const piora of [false, true]) for (const sinais of ['', 'atendimento', 'urgente']) for (const detalhe of tipo === 'cabeca' ? ['sintomas', 'sem-sintomas'] : tipo === 'dor-cabeca' ? ['', 'esforco'] : ['']) {
      const e = ef({ tipo, onde: o, grau, piora, sinais, detalhe });
      const rot = JSON.stringify({ tipo, o, grau, piora, sinais, detalhe });
      casos++;
      assert.ok(e && e.titulo && e.texto && e.porque.length, rot);
      assert.ok(e.refs.length && e.refs.every(temRef), 'fonte ausente ' + rot);
      if (sinais === 'urgente') { assert.equal(e.nivel, 'urgente', rot); assert.match(e.texto, /192/); assert.equal(e.musc, 'sem'); assert.equal(e.corrida, 'sem'); continue; }
      if (sinais === 'atendimento') { assert.equal(e.nivel, 'atendimento', rot); assert.equal(e.musc, 'sem'); assert.equal(e.corrida, 'sem'); continue; }
      switch (tipo) {
        case 'febre': case 'estomago': assert.deepEqual([e.nivel, e.musc, e.corrida], ['sem', 'sem', 'sem'], rot); break;
        case 'resfriado': assert.deepEqual([e.musc, e.corrida], grau === 'forte' ? ['sem', 'sem'] : ['leve', 'leve'], rot); break;
        case 'pancada': case 'corte': {
          const bloqueia = piora || grau === 'forte' || grau === '' || grau === 'moderada';
          assert.equal(e.musc, 'normal', rot);
          assert.deepEqual(e.regiao, { onde: o, modo: bloqueia ? 'bloqueia' : 'cuidado' }, rot);
          assert.equal(e.corrida, !PERNAS.has(o) ? 'normal' : bloqueia ? 'sem' : 'metade', rot);
          break;
        }
        case 'cabeca': assert.deepEqual([e.nivel, e.musc], detalhe === 'sintomas' ? ['atendimento', 'sem'] : ['leve', 'leve'], rot); break;
        case 'dor-cabeca': assert.equal(e.musc, detalhe === 'esforco' ? 'sem' : piora || grau === 'forte' ? 'sem' : 'leve', rot); if (detalhe === 'esforco') assert.equal(e.nivel, 'atendimento'); break;
        case 'colica': assert.equal(e.musc, grau === 'moderada' || grau === 'forte' ? 'leve' : 'normal', rot); break;
        case 'dente': assert.equal(e.musc, grau === 'forte' ? 'leve' : 'normal', rot); break;
        default: assert.fail('tipo sem regra: ' + tipo);
      }
    }
  }
  assert.ok(casos > 900, 'casos: ' + casos);
  // pancada moderada: região fora nos 3 primeiros dias (proteção de 1 a 3 dias, dubois2020); depois, só cuidado
  const mod = { tipo: 'pancada', onde: 'joelho', grau: 'moderada', data: '2026-11-14' };
  assert.equal(ef(mod, '2026-11-16').regiao.modo, 'bloqueia');
  assert.equal(ef(mod, '2026-11-17').regiao.modo, 'cuidado');
  // corte moderado continua fora até fechar
  assert.equal(ef({ ...mod, tipo: 'corte' }, '2026-11-20').regiao.modo, 'bloqueia');
  // avaliado: o sinal deixa de segurar; vale a regra do tipo
  assert.equal(ef({ tipo: 'pancada', onde: 'pe', grau: 'leve', sinais: 'atendimento', avaliado: HOJE }).nivel, 'cuidado');
  assert.equal(ef({ tipo: 'cabeca', detalhe: 'sintomas', avaliado: HOJE }).musc, 'sem'); // 24–48 h de repouso relativo
  assert.equal(ef({ tipo: 'cabeca', detalhe: 'sintomas', avaliado: '2026-11-15', data: '2026-11-15' }).musc, 'leve');
  assert.equal(ef({ tipo: 'dor-cabeca', detalhe: 'esforco', avaliado: HOJE }).musc, 'leve');
  // os registros do dia expiram sozinhos (sem sinal pendente)
  assert.equal(ef({ tipo: 'dor-cabeca', grau: 'forte' }, '2026-11-18'), null);
  assert.equal(ef({ tipo: 'colica', grau: 'forte' }, '2026-11-18').musc, 'leve');
  assert.equal(ef({ tipo: 'colica', grau: 'forte' }, '2026-11-19'), null);
  assert.equal(ef({ tipo: 'dente', grau: 'forte' }, '2026-11-20'), null);
  assert.equal(ef({ tipo: 'cabeca', detalhe: 'sem-sintomas' }, '2026-11-18').musc, 'leve');
  assert.equal(ef({ tipo: 'cabeca', detalhe: 'sem-sintomas' }, '2026-11-19'), null);
  assert.equal(ef({ tipo: 'dor-cabeca', detalhe: 'esforco' }, '2026-11-25').nivel, 'atendimento'); // pendente de avaliação não some
  // febre e diarreia não somem sem "Melhorou"; avisos de procurar atendimento pelo tempo
  assert.equal(ef({ tipo: 'febre' }, '2026-12-30').musc, 'sem');
  assert.match(ef({ tipo: 'febre' }, '2026-11-24').aviso, /atendimento/);
  assert.equal(ef({ tipo: 'febre' }, '2026-11-20').aviso, '');
  assert.match(ef({ tipo: 'estomago' }, '2026-11-19').aviso, /2 dias/);
  // "Melhorou?" a partir de alguns dias, e "Ainda não" adia a pergunta
  assert.equal(ef({ tipo: 'febre' }).perguntar, false);
  assert.equal(ef({ tipo: 'febre' }, '2026-11-18').perguntar, true);
  assert.equal(ef({ tipo: 'febre', visto: '2026-11-18' }, '2026-11-19').perguntar, false);
  assert.equal(ef({ tipo: 'febre', visto: '2026-11-18' }, '2026-11-20').perguntar, true);
  // data no futuro ou inválida não muda nada
  assert.equal(ef({ data: '2026-11-20' }), null); assert.equal(S.efeitoDoProblema(prob(), 'hoje'), null);
});

test('volta gradual depois do "Melhorou"', () => {
  // febre de 2 dias: 3 dias de treino leve para cada dia parado (6), depois normal
  const f = { tipo: 'febre', data: '2026-11-10', fim: '2026-11-12' };
  for (let k = 0; k < 6; k++) { const e = ef(f, somaDias('2026-11-12', k)); assert.equal(e.fase, 'volta'); assert.deepEqual([e.musc, e.corrida], ['leve', 'leve']); assert.equal(e.ate, '2026-11-17'); }
  assert.equal(ef(f, '2026-11-18'), null);
  // no mínimo 2 dias (melhorou no mesmo dia: 1 dia parado → 3), no máximo 14
  assert.equal(ef({ tipo: 'estomago', data: HOJE, fim: HOJE }, somaDias(HOJE, 2)).musc, 'leve');
  assert.equal(ef({ tipo: 'estomago', data: HOJE, fim: HOJE }, somaDias(HOJE, 3)), null);
  assert.equal(ef({ tipo: 'febre', data: '2026-10-01', fim: '2026-10-20' }, '2026-11-02').musc, 'leve');
  assert.equal(ef({ tipo: 'febre', data: '2026-10-01', fim: '2026-10-20' }, '2026-11-03'), null);
  // concussão: 3 etapas de 24 h
  const c = { tipo: 'cabeca', detalhe: 'sintomas', avaliado: '2026-11-10', data: '2026-11-10', fim: '2026-11-14' };
  assert.equal(ef(c, '2026-11-16').musc, 'leve'); assert.equal(ef(c, '2026-11-17'), null);
  // pancada que bloqueou a região: 7 dias de carga gradual na região; a leve, não
  const pb = { tipo: 'pancada', onde: 'tornozelo', grau: 'forte', data: '2026-11-05', fim: '2026-11-10' };
  assert.deepEqual(ef(pb, '2026-11-16').regiao, { onde: 'tornozelo', modo: 'volta' });
  assert.equal(ef(pb, '2026-11-16').corrida, 'metade');
  assert.equal(ef(pb, '2026-11-17'), null);
  assert.equal(ef({ tipo: 'pancada', onde: 'ombro', grau: 'leve', fim: HOJE }), null);
  assert.equal(ef({ tipo: 'resfriado', grau: 'leve', fim: HOJE }), null);
  // marcar: melhorou, avaliado, ainda não
  const lista = [prob({ id: 'x' })];
  assert.equal(S.marcar(lista, 'x', 'ainda', HOJE), true); assert.equal(lista[0].visto, HOJE);
  assert.equal(S.marcar(lista, 'x', 'avaliado', HOJE), true); assert.equal(lista[0].avaliado, HOJE);
  assert.equal(S.marcar(lista, 'x', 'melhorou', HOJE), true); assert.equal(lista[0].fim, HOJE);
  assert.equal(S.marcar(lista, 'y', 'melhorou', HOJE), false); assert.equal(S.marcar(lista, 'x', 'apagar', HOJE), false); assert.equal(S.marcar(lista, 'x', 'melhorou', '2026-11-01'), false);
});

// ---------- musculação: região bloqueada ----------
const GYM = { all: true, has: {} };
const BASE = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };
const PERFIS = [{}, { experiencia: 'iniciante', objetivo: 'emagrecimento', dias: '3' }, { experiencia: 'avancado', objetivo: 'forca', dias: '5' }, { idade: 66, objetivo: 'saude' }, { local: 'corporal' }, { local: 'halteres', dias: '2' }];
const comProblema = (x) => ({ saudeFora: [prob({ id: 'sfp', ...x })], dores: [] });

test('região bloqueada: nenhum exercício da região nos planos, e aviso "evitar" em todo exercício que a usa', () => {
  let planos = 0, avisos = 0;
  for (const onde of LOCAIS) for (const tipo of ['pancada', 'corte']) {
    const st = comProblema({ tipo, onde, grau: 'forte' });
    const dores = doresDoTreino(st, HOJE, BASE);
    assert.equal(dores.length, 1, onde); assert.equal(dores[0].fora, S.TIPOS_SAUDE[tipo].curto);
    for (const extra of tipo === 'pancada' ? PERFIS : [PERFIS[0]]) {
      const r = { ...BASE, ...extra };
      const p = gerarPlano(r, GYM, 0, dores);
      planos++;
      for (const d of p.dias) for (const it of d.itens) {
        const al = alertaDoExercicio(it.ex, dores, r);
        assert.ok(!al || al.nivel !== 'evitar', `${tipo} ${onde}: ${it.ex} ficou no plano`);
        assert.ok(!carregaRegiao(EX_POR_ID.get(it.ex), onde, true), `${tipo} ${onde}: ${it.ex} carrega a região`);
      }
    }
    // no plano montado sem o problema, todo exercício que carrega a região recebe "evitar", com o texto do problema
    const livre = gerarPlano(BASE, GYM, 0, []);
    for (const d of livre.dias) for (const it of d.itens) {
      const ex = EX_POR_ID.get(it.ex);
      const al = alertaDoExercicio(it.ex, dores, BASE);
      if (carregaRegiao(ex, onde, true)) { assert.ok(al && al.nivel === 'evitar', `${onde}: ${it.ex} sem aviso`); avisos++; }
      if (al) { assert.match(al.texto, tipo === 'pancada' ? /^Pancada / : /^Corte /); assert.ok(al.refs.every(temRef)); }
    }
    // o ajuste do plano só tira o exercício (nada é trocado de vez por um problema passageiro)
    for (const a of ajustesPorDor(livre, BASE, GYM, dores)) { assert.equal(a.tipo, 'pular'); assert.ok(a.motivo.length > 10); }
  }
  assert.ok(planos >= 140 && avisos > 50, `${planos} planos, ${avisos} avisos`);
  // com cuidado: menos carga, nada sai; em volta: idem, com o texto da volta
  const cuidado = doresDoTreino(comProblema({ tipo: 'pancada', onde: 'ombro', grau: 'leve' }), HOJE, BASE);
  const supino = gerarPlano(BASE, GYM, 0, []).dias.flatMap((d) => d.itens).map((it) => alertaDoExercicio(it.ex, cuidado, BASE)).filter(Boolean);
  assert.ok(supino.length && supino.every((a) => a.nivel === 'leve' && /^Pancada no ombro: menos carga/.test(a.texto)));
  const volta = doresDoTreino(comProblema({ tipo: 'pancada', onde: 'ombro', grau: 'forte', data: '2026-11-12', fim: '2026-11-15' }), HOJE, BASE);
  assert.equal(volta[0].volta, true);
  const av = gerarPlano(BASE, GYM, 0, []).dias.flatMap((d) => d.itens).map((it) => alertaDoExercicio(it.ex, volta, BASE)).filter(Boolean);
  assert.ok(av.length && av.every((a) => a.nivel === 'leve' && /^Volta depois de pancada no ombro/.test(a.texto)));
  // sem região (febre) não vira dor; nem problema que já passou
  assert.deepEqual(doresDoTreino(comProblema({ tipo: 'febre' }), HOJE, BASE), []);
  assert.deepEqual(doresDoTreino(comProblema({ tipo: 'pancada', onde: 'ombro', grau: 'leve', fim: HOJE }), HOJE, BASE), []);
});

test('sem treino: nada na musculação nem na corrida; treino leve: corrida sem treino forte; pancada na perna tira a corrida', () => {
  const RUN = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 12, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  const estado = (saudeFora = []) => store.sanitize({ run: { answers: RUN, aceitoEm: '2026-10-07T12:00:00.000Z', inicio: '2026-10-05' }, trainer: { answers: BASE }, saudeFora });
  const wd = 2; // terça
  const semana = (st) => planoDaSemana(st, HOJE);
  const antes = semana(estado());
  assert.ok(antes && antes.dias[wd] && antes.dias[wd].tipo !== 'descanso', 'terça tem corrida no plano');
  const corridasNaJanela = (s) => s.dias.filter((d) => d && d.data >= HOJE && d.tipo !== 'descanso' && d.tipo !== 'caminhada');
  for (const x of [{ tipo: 'febre' }, { tipo: 'estomago' }, { tipo: 'resfriado', grau: 'forte' }, { tipo: 'cabeca', detalhe: 'sintomas' }, { tipo: 'dor-cabeca', grau: 'forte' }, { tipo: 'pancada', onde: 'ombro', grau: 'leve', sinais: 'urgente' }]) {
    const st = estado([prob({ id: 'a', ...x })]);
    assert.equal(S.semTreinoHoje(st, HOJE), true, JSON.stringify(x));
    assert.equal(S.efeitoDeHoje(st, HOJE).corrida, 'sem');
    const s = semana(st);
    assert.equal(s.dias[wd].tipo, 'descanso', 'corrida de hoje: ' + JSON.stringify(x));
    assert.match(s.dias[wd].resumo, /^Sem corrida hoje: /);
    assert.equal(corridasNaJanela(s).length, 0, 'nenhuma corrida nos próximos dias com ' + x.tipo);
    assert.ok(planoAtual(st, HOJE).ajustes.some((a) => /^Sem corrida por causa de/.test(a.texto) && a.refs.length));
  }
  // treino leve: hoje sem treino forte, e a musculação marca "leve"
  const leve = estado([prob({ id: 'b', tipo: 'resfriado', grau: 'leve' })]);
  assert.equal(S.efeitoDeHoje(leve, HOJE).musc, 'leve'); assert.equal(S.semTreinoHoje(leve, HOJE), false);
  for (const d of semana(leve).dias) if (d && d.data >= HOJE) assert.ok(d.intensidade !== 'forte' || d.tipo === 'prova', 'treino forte com resfriado: ' + d.tipo);
  // pancada forte no joelho: sem corrida; no ombro: a corrida segue
  assert.equal(semana(estado([prob({ id: 'c', tipo: 'pancada', onde: 'joelho', grau: 'forte' })])).dias[wd].tipo, 'descanso');
  assert.equal(semana(estado([prob({ id: 'd', tipo: 'pancada', onde: 'ombro', grau: 'forte' })])).dias[wd].tipo, antes.dias[wd].tipo);
  // cuidado no tornozelo: corrida mais curta
  const cuid = semana(estado([prob({ id: 'e', tipo: 'pancada', onde: 'tornozelo', grau: 'leve' })])).dias[wd];
  assert.ok(cuid.tipo !== 'descanso' && cuid.durMin < antes.dias[wd].durMin, 'corrida pela metade');
  // depois do "Melhorou", a corrida volta (leve)
  const melhorou = estado([prob({ id: 'f', tipo: 'febre', data: '2026-11-15', fim: HOJE })]);
  assert.equal(S.semTreinoHoje(melhorou, HOJE), false);
  assert.notEqual(semana(melhorou).dias[wd].tipo, 'descanso');
});

test('estado e backup: o registro passa pela validação e volta igual', () => {
  const lista = [prob({ id: 'a', tipo: 'corte', onde: 'pe', grau: 'moderada', piora: true, sinais: 'atendimento', avaliado: HOJE }), prob({ id: 'b', tipo: 'cabeca', detalhe: 'sintomas', data: '2026-11-10', fim: '2026-11-12' })];
  const st = store.sanitize({ saudeFora: [...lista, { id: 'lixo', tipo: 'febre' }, 'x'] });
  assert.deepEqual(st.saudeFora, [lista[1], lista[0]]);
  assert.deepEqual(store.sanitize({}).saudeFora, []);
  assert.deepEqual(store.sanitize({ saudeFora: 'nada' }).saudeFora, []);
  const r = store.readBackup(JSON.stringify({ app: 'fitcore', v: 1, dados: { saudeFora: lista } }));
  assert.deepEqual(r.dados.saudeFora, [lista[1], lista[0]]);
  assert.deepEqual(store.sanitize(JSON.parse(JSON.stringify(st))), st);
});

test('perguntas: a sequência de cada tipo chega à decisão, e o sinal de emergência encerra', () => {
  // percorre todas as respostas possíveis
  let fins = 0;
  const responder = (r) => {
    const passo = S.proximoPasso(r);
    if (!passo) { const p = S.novoProblema('t1', HOJE, r); assert.ok(p, JSON.stringify(r)); assert.ok(S.efeitoDoProblema(p, HOJE), JSON.stringify(r)); fins++; return; }
    const op = passo === 'tipo' ? Object.keys(S.TIPOS_SAUDE) : passo === 'onde' ? ['joelho', 'punho'] : passo === 'grau' ? GRAUS : [true, false];
    for (const v of op) responder({ ...r, [passo]: v });
  };
  responder({});
  assert.ok(fins > 60, 'fins: ' + fins);
  assert.equal(S.proximoPasso({ tipo: 'pancada', onde: 'pe', urgente: true }), '');
  assert.equal(S.novoProblema('a', HOJE, { tipo: 'resfriado', vira: true, urgente: false, atendimento: false }).tipo, 'febre');
  for (const k of Object.keys(S.TIPOS_SAUDE)) for (const p of S.PASSOS[k]) if (['urgente', 'atendimento', 'vira'].includes(p)) assert.ok(S.SINAIS[k][p].length >= 1, k + ' ' + p);
});

test('sinais de emergência no texto livre', () => {
  for (const t of ['bati a cabeca e vomitei', 'cai e bati a cabeca, estou com visao dupla', 'levei uma pancada na cabeca e desmaiei', 'estou com febre e nuca dura', 'febre alta e manchas roxas na pele', 'a pior dor de cabeca da minha vida', 'dor de cabeca de repente muito forte', 'minha boca ficou torta', 'formigamento em um lado do corpo']) {
    const r = CH.sinaisDeEmergencia(t);
    assert.ok(r && /192/.test(r.texto) && r.refs.every(temRef), t);
    const p = CH.passoDeEmergencia(r);
    assert.equal(p.aviso.tipo, 'danger'); assert.ok(p.texto.length >= 1);
  }
  for (const t of ['estou gripado', 'bati o joelho na mesa', 'dor de cabeca leve', 'tive febre ontem', 'cortei o dedo', 'dor no lado do joelho', '']) assert.equal(CH.sinaisDeEmergencia(t), null, t);
  assert.equal(CH.passoDeEmergencia(null), null);
});

test('chat: intenções do Treinador e do Treinador de corrida, percorridas até o fim, anotam o problema certo', () => {
  assert.deepEqual(CH.INTENCOES.map((i) => [i.id, i.coach]), [['saude-fora-treino', 'treinador'], ['saude-fora-corrida', 'corrida']]);
  for (const i of CH.INTENCOES) {
    assert.ok(COACHES[i.coach] && i.titulo.length <= 40 && i.resumo.length > 5);
    for (const w of i.palavras) assert.ok(w === w.toLowerCase() && w === w.normalize('NFD').replace(/[̀-ͯ]/g, '') && /^!?[a-z0-9 +]+$/.test(w), 'palavra fora do padrão: ' + w);
    for (const w of ['pancada', 'bati', 'cai', 'torci', 'cortei', '!furei', '!prego', '!febre', '!gripe', '!gripado', 'dor cabeca', '!enxaqueca', '!diarreia', '!vomito', '!dente']) assert.ok(i.palavras.includes(w) || i.palavras.includes(w.replace('!', '')) || i.palavras.includes('!' + w), 'falta ' + w);
  }
  const vazio = store.sanitize({});
  let fins = 0, anotados = 0;
  const passos = new Set();
  const confere = (p, rot) => {
    assert.ok(p && Array.isArray(p.texto) && p.texto.length && p.texto.every((t) => typeof t === 'string' && t.length), rot);
    for (const k of p.refs || []) assert.ok(temRef(k), 'fonte ausente ' + k);
    if (p.aviso) assert.ok(['info', 'warn', 'danger'].includes(p.aviso.tipo) && p.aviso.texto);
    if (p.opcoes) { assert.ok(p.opcoes.length >= 2 && p.opcoes.length <= 6, rot + ' opções: ' + p.opcoes.length); assert.equal(typeof p.proximo, 'function'); assert.ok(p.opcoes.every((o) => o.rotulo && o.rotulo.length <= 60 && typeof o.valor === 'string')); }
    assert.ok(!('ir' in p) || p.ir.every((x) => typeof x.rotulo === 'string'));
  };
  const andar = (p, ctx, rot, prof = 0) => {
    confere(p, rot);
    assert.ok(prof < 12, 'conversa longa demais: ' + rot);
    if (p.opcoes) { for (const o of p.opcoes) andar(p.proximo(o.valor, ctx), ctx, rot + ' > ' + o.rotulo, prof + 1); return; }
    fins++;
    passos.add(p.texto[0].split('. ')[0] + '.');
    for (const a of p.acoes || []) {
      assert.ok(a.rotulo && a.confirmar && a.depois && typeof a.aplicar === 'function', rot);
      const s = JSON.parse(JSON.stringify(ctx.st));
      assert.notEqual(a.aplicar(s, ctx), false, rot);
      const limpo = store.sanitize(s);
      assert.equal(limpo.saudeFora.length, ctx.st.saudeFora.length + 1, 'anotado e válido: ' + rot);
      const novo = limpo.saudeFora[limpo.saudeFora.length - 1];
      assert.equal(novo.data, ctx.hoje);
      // a decisão mostrada é a mesma que o app aplica depois de anotar
      const e = S.efeitoDoProblema(novo, ctx.hoje);
      assert.ok(e && p.texto[0].startsWith(e.titulo + '.'), rot);
      anotados++;
    }
  };
  for (const i of CH.INTENCOES) {
    const ctx = { st: vazio, hoje: HOJE, agora: Date.parse(HOJE + 'T10:00:00Z') };
    assert.ok(!i.disponivel || i.disponivel(ctx));
    andar(i.inicio(ctx), ctx, i.id);
    // com um problema já anotado, a conversa mostra ele antes e deixa contar outro
    const com = { ...ctx, st: store.sanitize({ saudeFora: [prob({ id: 'z' })] }) };
    const p = i.inicio(com);
    confere(p, i.id + ' (já anotado)');
    assert.match(p.texto[0], /febre/);
    andar(p.proximo('novo', com), com, i.id + ' (outro)');
  }
  assert.ok(fins > 150 && anotados === fins, `${fins} fins, ${anotados} anotados`);
  assert.ok(passos.has('Procure atendimento agora.') && passos.has('Hoje sem treino.') && passos.has('Hoje só treino leve.'));
});

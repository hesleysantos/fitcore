// Saúde entre as entrevistas (logic/saude.js): o que uma entrevista diz sobre a saúde protege as outras, sempre pelo
// lado mais protegido; a liberação médica vale por 12 meses e deixa de valer quando a saúde muda (PAR-Q+ 2023).
import test from 'node:test';
import { calcular as calcularNutri, contextoDasEntrevistas as ctxNutri } from '../www/js/logic/nutrition.js';
import assert from 'node:assert/strict';
import { uniaoSaude, respostasProtegidas, respostasParaEntrevista, estadoLiberacao, condicoesDe, textoDaLiberacao, SINAIS, CONDICOES, REMEDIOS, VALIDADE_LIBERACAO } from '../www/js/logic/saude.js';
import { gerarPlano as planoTreino, perfil as perfilTreino, saudeDoTreinador, planoFortalecimento } from '../www/js/logic/trainer.js';
import { planoAtual, saudeDaCorrida, perfil as perfilCorrida } from '../www/js/logic/corrida.js';
import { calcular, contextoDasEntrevistas, suplementos } from '../www/js/logic/nutrition.js';
import { sanitize } from '../www/js/store.js';
import { modoDoDiario } from '../www/js/logic/diario.js';

const HOJE = '2026-11-16';
const GYM = { all: true, has: {} };
const treino = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, condicoes: ['nenhuma'], triagem: ['nenhum'], experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], foco: ['equilibrado'] };
const corrida = { idade: 35, condicoes: ['nenhuma'], triagem: ['nenhum'], experiencia: 'regular', kmSemana: 25, longoAtual: 10, pausa: 'treinando', objetivo: 'saude', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', aparelho: 'gps', local: 'rua', peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'] };
const nutri = { objetivo: 'manter', sexo: 'f', idade: 30, peso: 65, altura: 165, atividade: 'leve', treinos: '3', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };
// estado com plano de corrida aceito (para planoAtual)
const estado = ({ t = treino, r = corrida, n = nutri } = {}) => sanitize({ trainer: { answers: t }, run: { answers: r, aceitoEm: '2026-11-02T12:00:00.000Z', inicio: '2026-11-02' }, nutri: { answers: n } });

test('opções: "nenhum" por último, ids únicos e os sinais do ACSM e do PAR-Q+', () => {
  for (const [l, nenhum] of [[CONDICOES, 'nenhuma'], [SINAIS, 'nenhum'], [REMEDIOS, 'nenhum']]) {
    assert.equal(l[l.length - 1][0], nenhum);
    assert.equal(new Set(l.map((o) => o[0])).size, l.length);
    for (const o of l) assert.ok(o[1].length > 3 && typeof o[2] === 'string');
  }
  // os ids antigos continuam (respostas salvas valem)
  for (const id of ['dor_peito', 'tontura', 'falta_ar', 'osseo', 'medico']) assert.ok(SINAIS.some((o) => o[0] === id), id);
  for (const id of ['hipertensao', 'cardiaco', 'diabetes', 'gestante', 'cronica', 'renal', 'posparto']) assert.ok(CONDICOES.some((o) => o[0] === id), id);
});

test('remédios dizem condições: insulina → diabetes; remédio contínuo sem condição → doença crônica', () => {
  assert.deepEqual(condicoesDe({ remedios: ['glicose'] }), ['diabetes']);
  assert.deepEqual(condicoesDe({ remedios: ['outro'] }), ['cronica']);
  assert.deepEqual(condicoesDe({ condicoes: ['hipertensao'], remedios: ['outro', 'pulso'] }), ['hipertensao']);
  assert.deepEqual(condicoesDe({ condicoes: ['nenhuma'], remedios: ['nenhum'] }), []);
  assert.deepEqual(condicoesDe({ condicoes: ['xpto', 7, 'renal'] }), ['renal']);
});

test('liberação médica: vale por 12 meses; sem data (resposta antiga) ou com data impossível, é pedida de novo', () => {
  const l = (liberadoEm, liberado = 'sim') => estadoLiberacao({ liberado, liberadoEm }, HOJE);
  assert.equal(l('2026-11-16'), 'valida');
  assert.equal(l('2025-11-16'), 'valida'); // exatamente 365 dias
  assert.equal(VALIDADE_LIBERACAO, 365);
  assert.equal(l('2025-11-15'), 'vencida');
  assert.equal(l(undefined), 'sem_data');
  assert.equal(l('2026-13-40'), 'sem_data');
  assert.equal(l('2026-11-18'), 'valida'); // relógio adiantado em até 2 dias
  assert.equal(l('2027-01-01'), 'sem_data');
  assert.equal(l('2026-11-16', 'nao'), 'nao');
  assert.equal(estadoLiberacao({}, HOJE), 'falta');
  for (const e of ['vencida', 'sem_data', 'nao_cobre']) assert.ok(textoDaLiberacao(e).length > 60, e);
  assert.equal(textoDaLiberacao('valida'), '');
});

test('S1/S3: musculação com sinal de alerta — sem liberação ou com liberação vencida, nada de plano', () => {
  const t = { ...treino, triagem: ['dor_peito'] };
  const sem = respostasProtegidas('treinador', estado({ t }), HOJE);
  assert.equal(planoTreino(sem.respostas, GYM, 0), null);
  const valida = respostasProtegidas('treinador', estado({ t: { ...t, liberado: 'sim', liberadoEm: '2026-05-01' } }), HOJE);
  assert.equal(valida.liberacao, 'valida');
  assert.ok(planoTreino(valida.respostas, GYM, 0));
  for (const [liberadoEm, estadoEsperado] of [['2025-05-01', 'vencida'], [undefined, 'sem_data']]) {
    const v = respostasProtegidas('treinador', estado({ t: { ...t, liberado: 'sim', liberadoEm } }), HOJE);
    assert.equal(v.liberacao, estadoEsperado);
    assert.ok(v.renovar);
    assert.equal(v.respostas.liberado, 'nao');
    assert.equal(planoTreino(v.respostas, GYM, 0), null);
  }
});

test('S3: a liberação da corrida também vence em 12 meses: o plano aceito some até a pessoa confirmar', () => {
  const r = { ...corrida, condicoes: ['diabetes'], liberado: 'sim', liberadoEm: '2026-06-01' };
  assert.ok(planoAtual(estado({ r }), HOJE), 'liberação dentro do prazo');
  assert.equal(planoAtual(estado({ r: { ...r, liberadoEm: '2025-06-01' } }), HOJE), null, 'liberação vencida');
  assert.equal(planoAtual(estado({ r: { ...r, liberadoEm: undefined } }), HOJE), null, 'liberação sem data');
  assert.equal(saudeDaCorrida(estado({ r: { ...r, liberadoEm: '2025-06-01' } }), HOJE).liberacao, 'vencida');
  // a data é guardada pelo armazenamento e pelo backup só com "sim"
  assert.equal(estado({ r }).run.answers.liberadoEm, '2026-06-01');
  assert.equal(estado({ r: { ...r, liberado: 'nao' } }).run.answers.liberadoEm, undefined);
  assert.equal(estado({ r: { ...r, liberadoEm: 'ontem' } }).run.answers.liberadoEm, undefined);
  assert.equal(estado({ t: { ...treino, triagem: ['tontura'], liberado: 'sim', liberadoEm: '2026-10-10' } }).trainer.answers.liberadoEm, '2026-10-10');
});

test('S2: dor no peito contada à corrida protege a musculação (e diz de onde veio)', () => {
  const st = estado({ r: { ...corrida, triagem: ['dor_peito'], liberado: 'nao' } });
  // o Treinador só tem "Nenhum"; antes, saía o plano completo
  assert.ok(planoTreino(treino, GYM, 0));
  const sd = saudeDoTreinador(st, HOJE);
  assert.deepEqual(sd.respostas.triagem, ['dor_peito']);
  assert.equal(planoTreino(sd.respostas, GYM, 0), null);
  assert.ok(sd.avisos.some((x) => /dor ou pressão no peito ao Treinador de corrida/.test(x.texto)));
  assert.equal(sd.deFora.length, 1);
  // a liberação dada ao Treinador ANTES disso (sem saber da dor no peito) não vale
  const st2 = estado({ t: { ...treino, condicoes: ['cardiaco'], liberado: 'sim', liberadoEm: '2026-10-01' }, r: { ...corrida, triagem: ['dor_peito'], liberado: 'nao' } });
  const sd2 = saudeDoTreinador(st2, HOJE);
  assert.equal(sd2.liberacao, 'nao_cobre');
  assert.equal(planoTreino(sd2.respostas, GYM, 0), null);
  // com a mesma informação nas duas e a liberação dada sabendo dela, o plano sai
  const st3 = estado({ t: { ...treino, triagem: ['dor_peito'], liberado: 'sim', liberadoEm: '2026-10-01' }, r: { ...corrida, triagem: ['dor_peito'], liberado: 'nao' } });
  assert.ok(planoTreino(saudeDoTreinador(st3, HOJE).respostas, GYM, 0));
});

test('S2: o que a musculação marcou protege a corrida', () => {
  const st = estado({ t: { ...treino, condicoes: ['cardiaco'], liberado: 'sim', liberadoEm: '2026-10-01' } });
  assert.equal(planoAtual(st, HOJE), null, 'coração marcado só no Treinador: a corrida pede a liberação');
  assert.equal(perfilCorrida(saudeDaCorrida(st, HOJE).respostas).bloqueio, 'liberacao');
  // "só com supervisão" marcado no Treinador bloqueia a corrida também
  assert.equal(planoAtual(estado({ t: { ...treino, triagem: ['medico'] } }), HOJE), null);
  // remédio que segura o pulso contado ao Treinador: as zonas da corrida ficam sem batimentos (não pede liberação)
  const pulso = planoAtual(estado({ t: { ...treino, remedios: ['pulso'] } }), HOJE);
  assert.ok(pulso && pulso.zonas.fcMax === null);
  assert.ok(planoAtual(estado(), HOJE).zonas.fcMax > 0);
});

test('S2: a Nutricionista também protege os treinadores (transtorno alimentar, doença crônica, gestação ou amamentação)', () => {
  // transtorno alimentar e outra doença crônica: têm o efeito de "outra doença crônica" no Treinador
  for (const c of ['transtorno', 'outra']) {
    const sd = saudeDoTreinador(estado({ n: { ...nutri, condicoes: [c] } }), HOJE);
    assert.ok(perfilTreino(sd.respostas).cronica, c);
    assert.ok(sd.avisos.some((x) => /à Nutricionista/.test(x.texto)), c);
  }
  assert.ok(saudeDoTreinador(estado({ n: { ...nutri, condicoes: ['transtorno'] } }), HOJE).avisos[0].texto.includes('transtorno alimentar'));
  // "gestação ou amamentação" não diz qual: o Treinador avisa e a entrevista já abre com "Gestação" marcada para conferir
  const st = estado({ n: { ...nutri, condicoes: ['gestante'] } });
  const sd = saudeDoTreinador(st, HOJE);
  assert.ok(sd.avisos.some((x) => x.saude === 'gestacao'));
  assert.ok(respostasParaEntrevista('treinador', st).condicoes.includes('gestante'));
  assert.ok(respostasParaEntrevista('corrida', st).condicoes.includes('gestante'));
  // marcada na própria entrevista, o aviso não aparece
  assert.ok(!saudeDoTreinador(estado({ t: { ...treino, condicoes: ['gestante'] }, n: { ...nutri, condicoes: ['gestante'] } }), HOJE).avisos.some((x) => x.saude === 'gestacao'));
});

test('transtorno alimentar tem opção própria nos treinadores: protege o diário e vale como "outra doença crônica" no treino', () => {
  assert.ok(CONDICOES.some((o) => o[0] === 'transtorno'));
  assert.ok(!CONDICOES.find((o) => o[0] === 'cronica')[2].includes('transtorno'), '"outra doença crônica" não cita mais o transtorno');
  assert.deepEqual(condicoesDe({ condicoes: ['transtorno'] }), ['transtorno', 'cronica']);
  // no Treinador: o mesmo plano de "outra doença crônica"
  const t = (c) => ({ ...treino, condicoes: [c] });
  assert.ok(perfilTreino(t('transtorno')).cronica);
  const resumo = (p) => ({ dias: p.dias.map((d) => d.itens.map((i) => [i.ex, i.series, i.reps])), volume: p.volume, avisos: p.avisos.map((x) => x.texto), perfil: { ...p.perfil, condicoes: null } });
  assert.deepEqual(resumo(planoTreino(t('transtorno'), GYM, 0)), resumo(planoTreino(t('cronica'), GYM, 0)));
  // na corrida: o mesmo efeito também
  const r = (c) => ({ ...corrida, condicoes: [c] });
  const pr = perfilCorrida(r('transtorno')), pc = perfilCorrida(r('cronica'));
  assert.ok(pr.cronica);
  assert.deepEqual({ ...pr, condicoes: null }, { ...pc, condicoes: null });
  // protege o diário alimentar, marcado em qualquer entrevista
  for (const st of [estado({ t: t('transtorno') }), estado({ r: r('transtorno') }), estado({ n: { ...nutri, condicoes: ['transtorno'] } })]) assert.equal(modoDoDiario(null, st), 'sem');
  assert.notEqual(modoDoDiario(null, estado({ t: t('cronica') })), 'sem');
  // vindo da Nutricionista, entra como transtorno (não como "outra doença crônica") na entrevista e no plano do Treinador
  const sn = estado({ n: { ...nutri, condicoes: ['transtorno'] } });
  assert.deepEqual(respostasParaEntrevista('treinador', sn).condicoes, ['transtorno']);
  assert.deepEqual(saudeDoTreinador(sn, HOJE).respostas.condicoes, ['transtorno']);
  // contado ao Treinador: a corrida recebe o transtorno, com um aviso só
  const sc = respostasProtegidas('corrida', estado({ t: t('transtorno') }), HOJE);
  assert.deepEqual(sc.respostas.condicoes, ['transtorno']);
  assert.equal(sc.avisos.length, 1);
  assert.match(sc.avisos[0].texto, /Você informou transtorno alimentar ao Treinador, mas não aqui/);
  assert.deepEqual(respostasParaEntrevista('corrida', estado({ t: t('transtorno') })).condicoes, ['transtorno']);
});

test('S2: na Nutricionista, coração, outra doença crônica ou um sinal da triagem tiram a dose de cafeína', () => {
  const dose = (st) => suplementos(calcular(nutri, null, contextoDasEntrevistas(st)));
  assert.match(dose(estado()).linhas[1], /3 mg por quilo/);
  for (const [t, r] of [[{ ...treino, condicoes: ['cardiaco'] }, corrida], [treino, { ...corrida, triagem: ['dor_peito'] }], [{ ...treino, condicoes: ['cronica'] }, corrida], [treino, { ...corrida, triagem: ['palpitacao'] }]]) {
    const s = dose(estado({ t, r }));
    assert.ok(s.semCafeina && !/3 mg por quilo/.test(s.linhas.join(' ')) && /médico/.test(s.aviso), JSON.stringify(t.condicoes || r.triagem));
  }
  // marcado na própria Nutricionista também
  assert.ok(suplementos(calcular({ ...nutri, condicoes: ['cardiaco'] })).semCafeina);
  assert.ok(suplementos(calcular({ ...nutri, condicoes: ['outra'] })).semCafeina);
  // e a tela diz de onde veio
  const r = calcular(nutri, null, contextoDasEntrevistas(estado({ r: { ...corrida, triagem: ['dor_peito'] } })));
  assert.ok(r.avisos.some((x) => /sinal de alerta de saúde/.test(x.texto) && /Treinador de corrida/.test(x.texto)));
  // insulina contada a um treinador: diabetes na Nutricionista (manutenção, sem déficit)
  const d = calcular({ ...nutri, objetivo: 'emagrecer', peso: 90 }, null, contextoDasEntrevistas(estado({ t: { ...treino, remedios: ['glicose'] } })));
  assert.equal(d.modo, 'manutencao');
});

test('união: lixo não quebra, e cada item diz de onde veio', () => {
  for (const lixo of [null, undefined, 5, 'x', [], {}, { trainer: 7 }, { trainer: { answers: [] }, run: { answers: 'x' }, nutri: { answers: null } }]) {
    assert.doesNotThrow(() => uniaoSaude(lixo));
    assert.doesNotThrow(() => respostasProtegidas('treinador', lixo, HOJE));
    assert.doesNotThrow(() => respostasProtegidas('corrida', lixo, HOJE));
    assert.doesNotThrow(() => respostasParaEntrevista('corrida', lixo));
  }
  const u = uniaoSaude({ trainer: { answers: { condicoes: ['hipertensao'], triagem: ['tontura'], remedios: ['pulso'] } }, run: { answers: { condicoes: ['hipertensao', 'renal'] } }, nutri: { answers: { condicoes: ['diabetes', 'gestante'], alergias: ['ovo', 'nenhuma'] } } });
  assert.deepEqual(u.itens.map((x) => `${x.tipo}:${x.id}:${x.origem}`).sort(), ['condicao:diabetes:nutri', 'condicao:hipertensao:corrida', 'condicao:hipertensao:treinador', 'condicao:renal:corrida', 'remedio:pulso:treinador', 'sinal:tontura:treinador'].sort());
  assert.equal(u.gestacaoOuAmamentacao, true);
  assert.deepEqual(u.alergias, ['ovo']);
  // sem nada nas outras entrevistas, as respostas são as mesmas (nada muda para quem não tem nada disso)
  const sd = respostasProtegidas('treinador', estado(), HOJE);
  assert.deepEqual(sd.respostas, estado().trainer.answers);
  assert.equal(sd.avisos.length, 0);
});

test('fortalecimento para quem só corre: a liberação da musculação também vale, se cobre tudo', () => {
  const r = { ...corrida, triagem: ['tontura'], liberado: 'nao' };
  const sem = planoFortalecimento(estado({ t: null, r }), { local: 'academia', hoje: HOJE, ocupados: [] });
  assert.equal(sem.motivo, 'saude');
  const com = planoFortalecimento(estado({ t: { ...treino, triagem: ['tontura'], liberado: 'sim', liberadoEm: '2026-09-01' }, r }), { local: 'academia', hoje: HOJE, ocupados: [] });
  assert.ok(com.dias.length > 0);
});

test('transtorno alimentar informado a um treinador protege a Nutricionista (modo educativo, sem números)', () => {
  const st = { trainer: { answers: { condicoes: ['transtorno'] } }, run: { answers: {} }, nutri: { answers: {} } };
  const ctx = ctxNutri(st);
  assert.ok(ctx.condicoes.some((c) => c.id === 'transtorno' && c.origem === 'treinador'));
  const r = calcularNutri({ objetivo: 'emagrecer', sexo: 'f', idade: 30, peso: 70, altura: 165, atividade: 'leve', treinos: '3', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] }, null, ctx);
  assert.equal(r.modo, 'educativo');
  assert.ok(r.avisos.some((a) => /transtorno alimentar/.test(a.texto)));
});

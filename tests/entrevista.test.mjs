// Perguntas de várias escolhas: opção "Nenhuma", opção que já inclui outras, opção que conta como duas e limite que
// depende das outras respostas (a prioridade de músculos cabe no tempo de treino).
import test from 'node:test';
import assert from 'node:assert/strict';

const { marcar, limiteDe, dicaVarios } = await import('../www/js/logic/escolhas.js');
const { PERGUNTAS: P_TREINO } = await import('../www/js/logic/trainer.js');
const { PERGUNTAS: P_NUTRI } = await import('../www/js/logic/nutrition.js');
const { PERGUNTAS: P_CORRIDA } = await import('../www/js/logic/corrida.js');

const foco = P_TREINO.find((q) => q.k === 'foco');
const base = { objetivo: 'hipertrofia', idade: 30, peso: 70, altura: 175, experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
// marca em sequência, como a pessoa tocando nas opções
const tocar = (q, a, ...vals) => { const r = { ...a }; let ultimo = null; for (const v of vals) { ultimo = marcar(q, r, v); r[q.k] = ultimo.valor; } return { valor: r[q.k], aviso: ultimo ? ultimo.aviso : '' }; };

test('prioridade: "Coxas inteiras" conta como dois e não junta com outro músculo além do limite', () => {
  assert.equal(limiteDe(foco, base), 2);
  assert.deepEqual(tocar(foco, base, 'peito', 'pernas').valor, ['pernas'], 'peito + pernas passaria de 2: sai o peito');
  assert.match(tocar(foco, base, 'peito', 'pernas').aviso, /Limite de 2: tirei “Peito”/);
  assert.deepEqual(tocar(foco, base, 'pernas', 'bracos').valor, ['bracos']);
  assert.deepEqual(tocar(foco, base, 'peito', 'costas').valor, ['peito', 'costas']);
  assert.deepEqual(tocar(foco, base, 'peito', 'costas', 'ombros').valor, ['costas', 'ombros'], 'o terceiro tira o mais antigo');
});

test('prioridade: a opção maior substitui as que ela inclui, e a menor substitui a maior', () => {
  const r = tocar(foco, base, 'quadriceps', 'pernas');
  assert.deepEqual(r.valor, ['pernas']); assert.match(r.aviso, /já inclui “Quadríceps”/);
  const r2 = tocar(foco, base, 'pernas', 'posteriores');
  assert.deepEqual(r2.valor, ['posteriores']); assert.match(r2.aviso, /substitui “Coxas inteiras”/);
  assert.deepEqual(tocar(foco, base, 'quadriceps', 'posteriores').valor, ['quadriceps', 'posteriores']);
});

test('prioridade: com pouco tempo de treino o limite é 1, e "Coxas inteiras" não entra', () => {
  const pouco = { ...base, dias: '2', tempo: '30' };
  assert.equal(limiteDe(foco, pouco), 1);
  assert.deepEqual(tocar(foco, pouco, 'peito', 'costas').valor, ['costas']);
  const r = tocar(foco, pouco, 'peito', 'pernas');
  assert.deepEqual(r.valor, ['peito'], 'a escolha anterior fica'); assert.match(r.aviso, /conta como 2, e o seu limite é 1/);
  assert.equal(dicaVarios(foco, pouco), 'Você pode marcar só 1 músculo, pelo tempo de treino que você tem. “Coxas inteiras” e “Braços inteiros” contam como 2.');
  assert.equal(dicaVarios(foco, base), 'Você pode marcar até 2 músculos. “Coxas inteiras” e “Braços inteiros” contam como 2.');
});

test('"Nenhuma" e as outras não ficam marcadas juntas, em todas as perguntas de várias escolhas', () => {
  for (const q of [...P_TREINO, ...P_NUTRI, ...P_CORRIDA].filter((x) => x.tipo === 'varios' && x.nenhum)) {
    const outra = q.op.find((o) => o[0] !== q.nenhum)[0];
    assert.deepEqual(tocar(q, base, outra, q.nenhum).valor, [q.nenhum], q.k);
    assert.deepEqual(tocar(q, base, q.nenhum, outra).valor, [outra], q.k);
  }
});

test('restrições: "Vegano" já inclui "Vegetariano"', () => {
  const q = P_NUTRI.find((x) => x.k === 'restricoes');
  assert.deepEqual(tocar(q, {}, 'vegetariano', 'vegano').valor, ['vegano']);
  assert.deepEqual(tocar(q, {}, 'vegano', 'vegetariano').valor, ['vegetariano']);
  assert.deepEqual(tocar(q, {}, 'vegano', 'sem_gluten').valor, ['vegano', 'sem_gluten']);
});

test('toda opção citada em "inclui" e "vale" existe na pergunta', () => {
  for (const q of [...P_TREINO, ...P_NUTRI, ...P_CORRIDA]) {
    const ids = new Set((q.op || []).map((o) => o[0]));
    for (const [k, l] of Object.entries(q.inclui || {})) { assert.ok(ids.has(k), q.k + ':' + k); for (const x of l) assert.ok(ids.has(x), q.k + ':' + x); }
    for (const k of Object.keys(q.vale || {})) assert.ok(ids.has(k), q.k + ':' + k);
  }
});

// ---------- ordem e forma das perguntas ----------
test('"Nenhum"/"Nenhuma" vem por último em todas as listas das três entrevistas', () => {
  for (const q of [...P_TREINO, ...P_NUTRI, ...P_CORRIDA].filter((x) => x.tipo === 'varios' && x.nenhum)) assert.equal(q.op[q.op.length - 1][0], q.nenhum, q.k);
  // "Não tenho" (resultado da corrida) também
  assert.equal(P_CORRIDA.find((q) => q.k === 'resultado').op.slice(-1)[0][0], 'nao');
});

test('perguntas de segurança no começo (ordem do PAR-Q+) e as mesmas opções no Treinador e na corrida', () => {
  const ks = (P) => P.map((q) => q.k);
  assert.deepEqual(ks(P_TREINO).slice(0, 5), ['objetivo', 'idade', 'condicoes', 'triagem', 'remedios']);
  assert.deepEqual(ks(P_CORRIDA).slice(0, 5), ['idade', 'condicoes', 'triagem', 'remedios', 'liberado']);
  for (const k of ['condicoes', 'triagem', 'remedios']) assert.deepEqual(P_TREINO.find((q) => q.k === k).op, P_CORRIDA.find((q) => q.k === k).op, k);
  // o mesmo nome para o coração nas três entrevistas
  for (const P of [P_TREINO, P_CORRIDA, P_NUTRI]) assert.equal(P.find((q) => q.k === 'condicoes').op.find((o) => o[0] === 'cardiaco')[1], 'Coração, circulação ou AVC');
  // os sinais do ACSM (whitfield2017, Fig. 1) e a exceção da tontura do PAR-Q+
  const sinais = P_TREINO.find((q) => q.k === 'triagem').op;
  const txt = sinais.map((o) => o[1] + ' ' + o[2]).join(' | ');
  for (const re of [/pescoço, na mandíbula ou no braço/, /tornozelos/, /perna ao caminhar/, /Sopro no coração/, /deita/, /Cansaço fora do comum/, /lance de escada/, /Palpitações/, /respirar rápido demais/]) assert.match(txt, re);
});

test('idade, peso e altura precisam ser informados (o valor de partida não vale como resposta) nas três entrevistas', () => {
  for (const P of [P_TREINO, P_CORRIDA, P_NUTRI]) for (const k of ['idade', 'peso', 'altura']) assert.equal(P.find((q) => q.k === k).informar, true, k);
});

test('perguntas que só aparecem quando fazem diferença', () => {
  // corrida: "provas" só para a maratona de quem já corre; "Começar a correr" só para quem ainda está no nível 0
  const provas = P_CORRIDA.find((q) => q.k === 'provas');
  assert.ok(provas.se({ experiencia: 'regular', objetivo: 'prova', distancia: '42' }));
  for (const a of [{ experiencia: 'regular', objetivo: 'prova', distancia: '21' }, { experiencia: 'regular', objetivo: 'saude' }, { experiencia: 'nunca', objetivo: 'distancia', distancia: '42' }]) assert.ok(!provas.se(a), JSON.stringify(a));
  const comecar = P_CORRIDA.find((q) => q.k === 'objetivo').op.find((o) => o[0] === 'comecar');
  assert.equal(typeof comecar[3], 'function');
  assert.ok(comecar[3]({ experiencia: 'nunca' }) && comecar[3]({ experiencia: 'caminha' }));
  assert.ok(!comecar[3]({ experiencia: 'regular', kmSemana: 25, longoAtual: 10, pausa: 'treinando' }));
  // volta de pausa longa de quem corria pouco recomeça do nível 0: aí a opção aparece (e vale como começar)
  assert.ok(comecar[3]({ experiencia: 'iniciante', kmSemana: 8, longoAtual: 5, pausa: 'mais6m' }));
  // Nutricionista: horário do treino só para quem treina, e "Varia" sem "não treino"
  const horario = P_NUTRI.find((q) => q.k === 'horario');
  assert.ok(!horario.se({ treinos: '0' }) && horario.se({ treinos: '3' }));
  assert.equal(horario.op.find((o) => o[0] === 'varia')[1], 'Varia');
  // musculação: "Coxas inteiras" (o id continua "pernas", para as respostas salvas)
  assert.equal(foco.op.find((o) => o[0] === 'pernas')[1], 'Coxas inteiras');
});

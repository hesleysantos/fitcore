// Assuntos de hábito do chat (www/js/logic/chat/habitos.js): desânimo, sem resultado, dormi mal e água no treino.
// Reconhecimento, conteúdo com fontes, os caminhos dos botões e a proteção (nenhum número de peso, calorias ou gramas
// para transtorno alimentar e menores de 18).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import * as M from '../www/js/logic/chat/motor.js';
import { INTENCOES } from '../www/js/logic/chat/habitos.js';
import { textoDaRef } from '../www/js/logic/chat/comum.js';
import { gerarPlano } from '../www/js/logic/trainer.js';
import { PERGUNTAS as P_CORRIDA } from '../www/js/logic/corrida.js';

const J = (x) => JSON.parse(JSON.stringify(x));
const TER = '2026-11-17'; // terça
const TREINO = { objetivo: 'hipertrofia', idade: 31, peso: 78, altura: 176, experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], remedios: ['nenhum'], foco: ['equilibrado'], semTreino: ['nenhum'] };
const CORRIDA = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'saude', dias: ['1', '2', '4', '6'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
for (const q of P_CORRIDA) if (!(q.k in CORRIDA) && !(q.se && !q.se(CORRIDA)) && !q.opcional) CORRIDA[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
const NUTRI = { objetivo: 'emagrecer', sexo: 'f', idade: 32, peso: 72, altura: 165, atividade: 'leve', treinos: '3', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], alergias: ['nenhuma'], condicoes: ['nenhuma'] };
const p0 = gerarPlano(TREINO, { all: true, has: {} }, 0, null, null);
const PLANO = { id: 'p1', nome: 'Plano', origem: 'treinador', criadoEm: '2026-11-01T10:00:00.000Z', dias: p0.dias.map((d) => ({ id: d.id, nome: d.nome, foco: d.foco || '', itens: d.itens })), agenda: p0.agenda, info: '' };
const estado = ({ t = {}, n = NUTRI, extra = {} } = {}) => store.sanitize({ v: store.VERSAO, trainer: { answers: { ...TREINO, ...t }, aceitoEm: '2026-11-01T10:00:00.000Z' }, plans: [J(PLANO)], activePlan: 'p1', run: { answers: CORRIDA, aceitoEm: '2026-11-02T10:00:00.000Z', inicio: '2026-11-02', pausadoEm: '' }, combo: { foco: 'equilibrio', fortalecimento: 'nao', em: '2026-11-02T10:00:00.000Z' }, nutri: { answers: n, calculadoEm: '2026-11-01T10:00:00.000Z' }, ...extra });
const PERFIS = {
  adulto: estado(),
  transtorno: estado({ n: { ...NUTRI, condicoes: ['transtorno'] } }),
  menor: estado({ n: { ...NUTRI, idade: 16 }, t: { idade: 16 } }),
  gestante: estado({ n: { ...NUTRI, condicoes: ['gestante'] } }),
};
const ctxDe = (st, coach, hoje = TER) => ({ st, hoje, agora: Date.parse(hoje + 'T15:00:00Z'), coach });
const tudo = (p) => [...(p.texto || []), ...(p.detalhes || []), p.aviso ? p.aviso.texto : '', ...(p.opcoes || []).map((o) => o.rotulo)].join(' | ');
// todos os caminhos de botões de um assunto (até 3 níveis)
function caminhos(id, st, coach) {
  const out = [];
  const ir = (p, ctx, prof) => {
    out.push(p);
    if (prof >= 3 || !p.opcoes) return;
    for (const o of p.opcoes) { const q = M.limparPasso(M.seguir(p, o.valor, ctx)); if (q) ir(q, ctx, prof + 1); }
  };
  const ctx = ctxDe(st, coach);
  ir(M.limparPasso(M.iniciar(id, ctx)), ctx, 0);
  return out;
}

test('registro: 9 assuntos, títulos curtos, fontes que existem', () => {
  assert.equal(INTENCOES.length, 9);
  for (const i of INTENCOES) {
    assert.ok(M.intencaoPorId(i.id), i.id);
    assert.ok(i.titulo.length <= 40, i.titulo);
    for (const w of i.palavras) { const w0 = w.replace(/^!/, ''); assert.equal(w0, M.normalizar(w0), `${i.id}: ${w}`); }
    for (const p of caminhos(i.id, PERFIS.adulto, i.coach)) for (const r of p.refs || []) assert.ok(textoDaRef(r), `${i.id}: fonte ${r}`);
  }
});

test('reconhecimento: as frases do dia a dia vão para o assunto novo', () => {
  const casos = [
    ['treinador', 'to sem vontade nenhuma de treinar', 'desanimo'], ['treinador', 'desanimei da academia', 'desanimo'], ['treinador', 'que preguiça de ir pra academia hoje', 'desanimo'],
    ['treinador', 'faz 4 meses que treino e não vejo resultado', 'sem-resultado'], ['treinador', 'estagnei no supino', 'sem-resultado'],
    ['treinador', 'dormi mal, posso treinar?', 'dormi-mal'], ['treinador', 'não dormi nada essa noite', 'dormi-mal'],
    ['treinador', 'preciso de isotônico no treino?', 'agua-treino'], ['treinador', 'quanto de agua eu bebo durante o treino', 'agua-treino'],
    ['corrida', 'to sem vontade de correr', 'desanimo-corrida'], ['corrida', 'levo agua no longao?', 'agua-corrida'],
    ['nutri', 'não estou emagrecendo', 'nutri-sem-resultado'], ['nutri', 'a balança não mexe faz 3 semanas', 'nutri-sem-resultado'], ['nutri', 'como me hidratar no treino?', 'nutri-agua-treino'],
  ];
  for (const [coach, t, id] of casos) {
    const r = M.entender(t, coach, ctxDe(PERFIS.adulto, coach));
    assert.ok(r.confiante && r.melhor.intencao.id === id, `"${t}" → ${r.ranking.slice(0, 3).map((x) => x.intencao.id + ':' + x.pontos).join(' ')}`);
  }
  // o que já tinha dono continua com ele
  for (const [coach, t, id] of [['treinador', 'nao vou treinar hoje', 'treino-perdido'], ['treinador', 'to cansado hoje', 'treino-perdido'], ['nutri', 'quanta agua devo beber por dia', 'nutri-metas'], ['corrida', 'n quero correr hj, sem vontade nenhuma', 'corrida-perdida']]) {
    assert.equal(M.entender(t, coach, ctxDe(PERFIS.adulto, coach)).melhor.intencao.id, id, t);
  }
  // "dormi 4 horas" é noite curta; "acordei 5h" e "dormi demais" não são
  assert.equal(M.entender('dormi 4 horas, corro hoje?', 'corrida', ctxDe(PERFIS.adulto, 'corrida')).melhor.intencao.id, 'dormi-mal-corrida');
  assert.notEqual((M.entender('acordei 5h40 e tenho q ta no serviço 6h30', 'treinador', ctxDe(PERFIS.adulto, 'treinador')).melhor || { intencao: {} }).intencao.id, 'dormi-mal');
  assert.ok(!M.entender('dormi demais e perdi a hora da corrida', 'corrida', ctxDe(PERFIS.adulto, 'corrida')).ranking.some((x) => x.intencao.id === 'dormi-mal-corrida'));
  // "prato" não vira "platô" por erro de digitação
  assert.ok(M.lerTexto('o que botar no prato').some((x) => x.c === 'prato'));
});

test('desânimo: faz pouco hoje, como manter o hábito e o aviso de quando procurar ajuda (188)', () => {
  const p = M.limparPasso(M.iniciar('desanimo', ctxDe(PERFIS.adulto, 'treinador')));
  assert.match(p.aviso.texto, /2 semanas.*UBS.*CAPS.*188/);
  assert.ok(p.refs.includes('oms_depressao') && p.refs.includes('cvv'));
  assert.deepEqual(p.opcoes.map((o) => o.rotulo), ['Fazer a versão curta', 'Passar o treino', 'Como manter o hábito']);
  const h = M.limparPasso(M.seguir(p, 'habito', ctxDe(PERFIS.adulto, 'treinador')));
  assert.ok(h.texto.filter((t) => t.startsWith('•')).length === 5 && /66 dias/.test(h.detalhes.join(' ')));
  assert.ok(h.refs.includes('gardner2012') && h.refs.includes('teixeira2012'));
  const curta = M.limparPasso(M.seguir(p, 'curta', ctxDe(PERFIS.adulto, 'treinador')));
  assert.ok(curta && curta.texto.length, 'versão curta abre');
  // corrida
  const c = M.limparPasso(M.iniciar('desanimo-corrida', ctxDe(PERFIS.adulto, 'corrida')));
  assert.ok(c.opcoes.some((o) => o.rotulo === 'Como manter o hábito'));
});

test('sem resultado: ritmo real do ganho de músculo, o que conta e a troca de exercícios', () => {
  const p = M.limparPasso(M.iniciar('sem-resultado', ctxDe(PERFIS.adulto, 'treinador')));
  assert.match(tudo(p), /1 kg de massa magra/);
  assert.match(tudo(p), /4 a 6 semanas/);
  assert.ok(p.ir.some((x) => x.abrir === 'treinador-trocas'));
  assert.ok(p.refs.includes('morton2018') && p.refs.includes('bell2023'));
});

test('não emagreço: o peso oscila na semana, olhar a média; protegidos e gestantes sem conversa de peso', () => {
  const p = M.limparPasso(M.iniciar('nutri-sem-resultado', ctxDe(PERFIS.adulto, 'nutri')));
  assert.match(tudo(p), /fim de semana/);
  assert.match(tudo(p), /média de cada semana/);
  assert.ok(p.refs.includes('turicchi2020') && p.refs.includes('trexler2014'));
  for (const nome of ['transtorno', 'menor']) {
    const q = M.limparPasso(M.iniciar('nutri-sem-resultado', ctxDe(PERFIS[nome], 'nutri')));
    assert.match(q.texto[0], /não acompanho o peso/, nome);
    assert.ok(!/\d+[.,]?\d*\s*(kg|%|kcal|quilos?)/.test(tudo(q)), nome + ': ' + tudo(q));
  }
  assert.match(M.limparPasso(M.iniciar('nutri-sem-resultado', ctxDe(PERFIS.gestante, 'nutri'))).texto[0], /pré-natal/);
});

test('dormi mal: lê a noite registrada, treino mais leve e mais cedo; botões quando há treino hoje', () => {
  const st = estado({ extra: { sono: { idade: 31, acordar: '06:30', registros: [{ data: TER, horas: 4 }], cochilos: [] } } });
  const p = M.limparPasso(M.iniciar('dormi-mal', ctxDe(st, 'treinador')));
  assert.match(p.texto.join(' '), /4 h|4h|dormiu/);
  assert.match(tudo(p), /mais leve/);
  assert.match(tudo(p), /0,4%/);
  assert.ok(p.refs.includes('craven2022'));
  assert.deepEqual(p.opcoes.map((o) => o.rotulo), ['Fazer a versão curta', 'Passar o treino']);
  // sem a noite registrada: o atalho para registrar
  const q = M.limparPasso(M.iniciar('dormi-mal', ctxDe(PERFIS.adulto, 'treinador')));
  assert.ok(q.ir && q.ir.some((x) => x.rota === 'sono'));
});

test('água no treino: até 1 hora só água; sinais de excesso com 192; protegidos sem número de peso', () => {
  const p = M.limparPasso(M.iniciar('agua-treino', ctxDe(PERFIS.adulto, 'treinador')));
  assert.match(p.texto[0], /até 1 hora: água basta/);
  assert.match(tudo(p), /2% do peso/);
  assert.match(tudo(p), /192/);
  assert.ok(p.refs.includes('mcdermott2017') && p.refs.includes('hewbutler2017'));
  for (const nome of ['transtorno', 'menor']) {
    const q = M.limparPasso(M.iniciar('nutri-agua-treino', ctxDe(PERFIS[nome], 'nutri')));
    assert.ok(!/peso|mL por kg|\d+%/.test(tudo(q)), nome + ': ' + tudo(q));
  }
  const c = M.limparPasso(M.iniciar('agua-corrida', ctxDe(PERFIS.adulto, 'corrida')));
  assert.match(c.texto[0], /Corrida de até 1 hora/);
});

test('protegidos: nenhum número de peso, calorias ou gramas em nenhum caminho dos assuntos novos', () => {
  const NUM = /\d[\d.,]*\s*(kcal|calorias?|kg|quilos?|g\b|gramas?|mg|mL)\b|massa magra/i;
  for (const nome of ['transtorno', 'menor']) {
    for (const i of INTENCOES) {
      if (!M.intencaoPorId(i.id) || (typeof i.disponivel === 'function' && !i.disponivel(ctxDe(PERFIS[nome], i.coach)))) continue;
      for (const p of caminhos(i.id, PERFIS[nome], i.coach)) assert.ok(!NUM.test(tudo(p)), `${nome} ${i.id}: ${tudo(p)}`);
    }
  }
});

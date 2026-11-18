// Chat com texto livre (logic/chat/nlu.js, entidades.js, exercicio.js e o motor): abreviações e gírias, radicais, o
// exercício citado ("posso aumentar o peso no supino?"), perguntas relacionadas, a pergunta de volta quando não entende,
// a memória do exercício ("e no stiff?"), os assuntos novos (como faz, que músculo, trocar, é seguro, por quê,
// recomendação) com ações "Só hoje" / "Só nesta semana" / "Sempre", e a leva 5 de frases novas (medida antes e depois).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import * as M from '../www/js/logic/chat/motor.js';
import { expandir, radical, conceitos } from '../www/js/logic/chat/nlu.js';
import { exercicioDoTexto, corpoDoTexto, musculosDoTexto, numerosDoTexto } from '../www/js/logic/chat/entidades.js';
import { gerarPlano } from '../www/js/logic/trainer.js';
import { PERGUNTAS as P_CORRIDA } from '../www/js/logic/corrida.js';
import { itensDoDia, temAjusteNaSemana } from '../www/js/logic/ajuste-semana.js';
import { textoDaRef } from '../www/js/logic/chat/comum.js';
import { FAQ_TREINO, FAQ_NUTRI } from '../www/js/data/knowledge.js';
import { FAQ_CORRIDA } from '../www/js/data/corrida.js';
import * as P from '../www/js/logic/perdido.js';

const J = (x) => JSON.parse(JSON.stringify(x));
const TER = '2026-11-17'; // terça (Inferiores A no plano de teste)
const TREINO = { objetivo: 'hipertrofia', idade: 31, peso: 78, altura: 176, experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], remedios: ['nenhum'], foco: ['equilibrado'], semTreino: ['nenhum'] };
const CORRIDA = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'saude', dias: ['1', '2', '4', '6'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
for (const q of P_CORRIDA) if (!(q.k in CORRIDA) && !(q.se && !q.se(CORRIDA)) && !q.opcional) CORRIDA[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
const p0 = gerarPlano(TREINO, { all: true, has: {} }, 0, null, null);
const PLANO = { id: 'p1', nome: 'Plano', origem: 'treinador', criadoEm: '2026-11-01T10:00:00.000Z', dias: p0.dias.map((d) => ({ id: d.id, nome: d.nome, foco: d.foco || '', itens: d.itens })), agenda: p0.agenda, info: '' };
const estado = ({ t = {}, extra = {} } = {}) => store.sanitize({ v: store.VERSAO, trainer: { answers: { ...TREINO, ...t }, aceitoEm: '2026-11-01T10:00:00.000Z' }, plans: [J(PLANO)], activePlan: 'p1', run: { answers: CORRIDA, aceitoEm: '2026-11-02T10:00:00.000Z', inicio: '2026-11-02', pausadoEm: '' }, combo: { foco: 'equilibrio', fortalecimento: 'nao', em: '2026-11-02T10:00:00.000Z' }, ...extra });
const ADULTO = estado();
const ctxDe = (st, coach, hoje = TER) => ({ st, hoje, agora: Date.parse(hoje + 'T15:00:00Z'), coach });
function conversar(coach, falas, st = ADULTO) {
  let mem = null, aberto = null;
  const out = [];
  for (const f of falas) {
    const ctx = { ...ctxDe(st, coach), memoria: mem, aberto };
    let p;
    if (f.startsWith('#')) { const o = aberto.opcoes.find((x) => x.rotulo.startsWith(f.slice(1))); assert.ok(o, 'sem botão ' + f); p = M.seguir(aberto, o.valor, ctx); }
    else if (f.startsWith('@')) { const s = (aberto.sugestoes || []).find((x) => x.rotulo.startsWith(f.slice(1))); assert.ok(s, 'sem pergunta relacionada ' + f + ': ' + JSON.stringify(aberto.sugestoes)); p = M.sugestao(s.valor, coach, ctx); }
    else p = M.responder(f, coach, ctx);
    p = M.limparPasso(p);
    if (p.memoria) mem = p.memoria;
    aberto = p;
    out.push(p);
  }
  return out;
}
const tudo = (p) => [...(p.texto || []), ...(p.detalhes || []), p.aviso ? p.aviso.texto : '', ...(p.opcoes || []).map((o) => o.rotulo), ...(p.acoes || []).flatMap((a) => [a.rotulo, a.confirmar]), ...(p.sugestoes || []).map((s) => s.rotulo)].join(' | ');

// ---------- leitura do texto ----------
test('abreviações, gírias, risadas e unidades viram palavras inteiras', () => {
  assert.equal(expandir('hj n vou pq tenho medico kkkk mano'), 'hoje nao vou porque tenho medico');
  assert.equal(expandir('so tenho uns 35min hj'), 'so tenho uns 35 minutos hoje');
  assert.equal(expandir('qnd vc treina 5x na semana tb'), 'quando voce treina 5 vezes na semana tambem');
  assert.equal(expandir('muitooo cansadooo'), 'muito cansado');
  assert.equal(expandir('s tempo hj'), 'sem tempo hoje');
  assert.equal(expandir('s'), 's'); // "s" sozinho é "sim" (respostas abertas)
  assert.equal(conceitos('qual o melhor treino pra perder barriga'), 'qual o melhor treino pra emagrecer');
  assert.equal(conceitos('por que mudou o dia'), 'porque mudou o dia');
});
test('radical: as flexões de uma palavra se encontram (RSLP leve)', () => {
  for (const grupo of [['corri', 'correr', 'corrida', 'correndo'], ['alagada', 'alagado'], ['executa', 'executar'], ['treinando', 'treinei', 'treino']]) {
    assert.equal(new Set(grupo.map(radical)).size, 1, grupo.join(','));
  }
  assert.equal(radical('dor'), 'dor'); // palavra curta não muda
});
test('entidades: exercício do plano, ambíguo, fora do plano; parte do corpo, músculo e números', () => {
  const plan = ADULTO.plans[0];
  assert.equal(exercicioDoTexto('quantos kg eu coloco no agachamento goblet', plan).ex.id, 'agachamento-goblet');
  assert.equal(exercicioDoTexto('como faz o stiff?', plan).ex.id, 'stiff-halteres');
  assert.equal(exercicioDoTexto('o peck deck trabalha qual musculo?', plan).ex.id, 'peck-deck');
  const sup = exercicioDoTexto('posso aumentar o peso no supino?', plan);
  assert.ok(!sup.ex && sup.candidatos.length === 2 && sup.candidatos.every((e) => /^Supino/.test(e.nome)), 'dois supinos no plano: pergunta qual');
  const fora = exercicioDoTexto('como faz o levantamento terra romeno', plan);
  assert.ok(fora && fora.noPlano === false);
  // palavras do dia a dia não viram exercício
  for (const t of ['fiquei 3 meses parado', 'como faço pra passar no enem', 'estou com dor no joelho', 'qual o treino de amanhã', 'posso fazer perna dois dias seguidos?']) assert.equal(exercicioDoTexto(t, plan), null, t);
  assert.equal(corpoDoTexto('dor no joelho').onde, 'joelho');
  assert.equal(corpoDoTexto('o peso da elevação pélvica'), null);
  assert.deepEqual(musculosDoTexto('o que vc recomenda pra melhorar o glúteo?'), ['gluteos']);
  assert.deepEqual(numerosDoTexto('tenho meia hora e 3 series'), [{ n: 30, unidade: 'min' }, { n: 3, unidade: 'series' }]);
});

// ---------- o exercício citado ----------
test('"posso aumentar o peso no supino?": pergunta qual supino e responde sobre AQUELE exercício, com perguntas relacionadas', () => {
  const [a, b, c, d] = conversar('treinador', ['posso aumentar o peso no supino?', '#Supino inclinado', '@Como faz', 'e no stiff?']);
  assert.equal(a.assunto, 'carga');
  assert.deepEqual(a.opcoes.map((o) => o.rotulo).sort(), ['Supino inclinado com halteres', 'Supino no chão com halteres (floor press)']);
  assert.match(b.texto[0], /^Supino inclinado com halteres: \d/);
  assert.ok(b.sugestoes && b.sugestoes.length >= 2 && b.sugestoes.length <= 3);
  assert.equal(c.assunto, 'ex-como');
  assert.match(c.texto[0], /^Supino inclinado com halteres: /);
  assert.ok(c.texto.some((t) => /^1\. /.test(t)) && c.ir.some((x) => x.rota === 'exercicio/supino-inclinado-halteres'));
  // "e no stiff?": o mesmo assunto (como faz), agora com o stiff
  assert.equal(d.assunto, 'ex-como');
  assert.match(d.texto[0], /^Stiff com halteres: /);
  assert.equal(d.memoria.ex, 'stiff-halteres');
});
test('carga, séries e descanso de um exercício citado vão direto a ele', () => {
  for (const [t, nome] of [['quantos kg eu coloco no agachamento goblet', 'Agachamento goblet'], ['qual o descanso da cadeira extensora', 'Cadeira extensora'], ['quantas reps na mesa flexora?', 'Mesa flexora']]) {
    const [p] = conversar('treinador', [t]);
    assert.equal(p.assunto, 'carga', t);
    assert.ok(p.texto[0].startsWith(nome + ':'), `${t}: ${p.texto[0]}`);
  }
});
test('que músculo, como faz e trocar: respostas do catálogo e das regras do Treinador', () => {
  const [m] = conversar('treinador', ['stiff pega posterior ou gluteo?']);
  assert.equal(m.assunto, 'ex-musculo');
  assert.match(m.texto[0], /posteriores de coxa/);
  const [tr, escolha] = conversar('treinador', ['posso trocar o stiff?', '#Levantamento']);
  assert.equal(tr.assunto, 'ex-trocar');
  assert.ok(tr.opcoes.length >= 1 && tr.opcoes.length <= 3);
  assert.deepEqual(escolha.acoes.map((a) => a.rotulo), ['Só hoje', 'Só nesta semana', 'Sempre (no plano)']);
  // Só hoje: o treino de hoje com a troca, mesmas séries, repetições e descanso; o plano não muda
  const hoje = escolha.acoes[0].iniciar;
  const orig = ADULTO.plans[0].dias.find((d) => d.id === hoje.diaId).itens;
  assert.equal(hoje.itens.length, orig.length);
  const k = orig.findIndex((it) => it.ex === 'stiff-halteres');
  assert.ok(hoje.itens[k].ex === 'levantamento-terra-romeno' && hoje.itens[k].series === orig[k].series && hoje.itens[k].reps === orig[k].reps);
  // Só nesta semana: a versão da semana (logic/ajuste-semana.js); o plano não muda
  const s1 = J(ADULTO);
  assert.notEqual(escolha.acoes[1].aplicar(s1, { ...ctxDe(s1, 'treinador') }), false);
  assert.ok(temAjusteNaSemana(s1, 'p1', hoje.diaId, TER) && itensDoDia(s1, 'p1', hoje.diaId, TER).some((it) => it.ex === 'levantamento-terra-romeno'));
  assert.ok(s1.plans[0].dias.every((d) => !d.itens.some((it) => it.ex === 'levantamento-terra-romeno')));
  assert.ok(!itensDoDia(s1, 'p1', hoje.diaId, '2026-11-24').some((it) => it.ex === 'levantamento-terra-romeno'), 'semana seguinte volta ao de sempre');
  // Sempre: o plano muda (e fica registrado como variação)
  const s2 = J(ADULTO);
  assert.notEqual(escolha.acoes[2].aplicar(s2, { ...ctxDe(s2, 'treinador') }), false);
  assert.ok(s2.plans[0].dias.some((d) => d.itens.some((it) => it.ex === 'levantamento-terra-romeno')) && !s2.plans[0].dias.some((d) => d.itens.some((it) => it.ex === 'stiff-halteres')));
});
test('é seguro? usa as regras de segurança e as marcas do catálogo; com dor contada, o alerta real do exercício', () => {
  const [a] = conversar('treinador', ['agachamento goblet é seguro pra quem tem dor no joelho?']);
  assert.equal(a.assunto, 'ex-seguro');
  assert.match(a.texto.join(' '), /cuidado com o joelho/);
  assert.ok(a.ir.some((x) => x.abrir === 'contar-dor') && a.detalhes.some((t) => /médico ou fisioterapeuta/.test(t)));
  assert.ok(!/é seguro\b/i.test(a.texto.join(' ')), 'nunca promete que é seguro');
  const comDor = estado({ extra: { dores: [{ id: 'dj', data: '2026-11-15', onde: 'joelho', lado: '', tipo: 'articular', quando: 'durante', nivel: 5, nota: '', fim: '' }] } });
  const [b] = conversar('treinador', ['o agachamento goblet é seguro pra mim?'], comDor);
  assert.equal(b.assunto, 'ex-seguro');
  assert.match(b.texto[0], /joelho/);
});
test('por quê: dia que mudou, treino mais leve, séries e o exercício; recomendação pela avaliação do plano', () => {
  const [d] = conversar('treinador', ['pq mudou o dia do treino?']);
  assert.equal(d.assunto, 'explicar');
  assert.match(d.texto[0], /nenhum treino mudou|O que mudou/);
  // "Não treinei" na segunda (sem tempo), com o treino passado para outro dia: a mesma marca da folha
  const m = P.novaMarca(ADULTO, '2026-11-16', TER, 'mover', '2026-11-16T20:00:00.000Z', { futuro: false, motivo: 'tempo' });
  assert.ok(m && m.movs.length, 'marca de teste');
  const comMarca = estado({ extra: { perdidos: [m] } });
  const [d2] = conversar('treinador', ['por que mudou o dia do meu treino?'], comMarca);
  assert.ok(d2.texto.some((t) => /Não treinei/.test(t)), d2.texto.join(' | '));
  const [s] = conversar('treinador', ['por que eu tenho 3 series de stiff?']);
  assert.equal(s.assunto, 'explicar');
  assert.ok(s.texto.some((t) => /^Stiff com halteres: 3 séries/.test(t)), s.texto.join(' | '));
  const [r] = conversar('treinador', ['o que vc recomenda pra melhorar o gluteo?']);
  assert.equal(r.assunto, 'recomendar');
  assert.match(r.texto[0], /^Glúteos: [\d,]+ séries por semana/);
  for (const k of r.refs || []) assert.ok(textoDaRef(k), k);
  const [g] = conversar('treinador', ['meu treino ta bom?']);
  assert.equal(g.assunto, 'recomendar');
});
test('dor contada: o chat propõe o ajuste do treino e aplica ali mesmo', () => {
  const st = estado({ extra: { dores: [{ id: 'dl', data: '2026-11-15', onde: 'lombar', lado: '', tipo: 'articular', quando: 'durante', nivel: 7, nota: '', fim: '' }] } });
  const p = M.limparPasso(M.depoisDaDor('treinador', ctxDe(st, 'treinador')));
  assert.match(p.texto[0], /^Anotado/);
  assert.ok(p.acoes && p.acoes.length >= 1 && p.acoes.every((a) => a.confirmar));
  for (const a of p.acoes.filter((x) => x.aplicar)) { const s = J(st); assert.notEqual(a.aplicar(s, ctxDe(s, 'treinador')), false, a.rotulo); }
});

// ---------- conversa ----------
test('sem entender: pergunta de volta com os assuntos mais próximos e "Outra coisa" pede para reformular com exemplos', () => {
  const [p, q] = conversar('treinador', ['como faço pra passar no enem', '#Outra coisa']);
  assert.match(p.texto[0], /^(É sobre um destes|É isto que você quer)\?$/);
  assert.ok(p.opcoes.length >= 2 && p.opcoes.length <= 5 && !p.assunto);
  assert.match(q.texto.join(' '), /poucas palavras/);
  const [n] = conversar('treinador', ['asdf qwer zxcv']);
  assert.match(n.texto.join(' '), /Não entendi|Hum|Não consegui/);
  // sem nada entendido: assuntos comuns em botões (com jeitos diferentes de dizer) e "Ver todos os assuntos"
  assert.ok(n.opcoes.length >= 3 && n.opcoes.some((o) => o.rotulo === 'Ver todos os assuntos'), JSON.stringify(n.opcoes));
});
test('perguntas relacionadas: até 3, só nas falas que terminam, nunca num alerta, e o toque responde como se fosse escrito', () => {
  const [a] = conversar('treinador', ['qual o peso do stiff']);
  assert.ok(a.sugestoes.length >= 1 && a.sugestoes.length <= 3);
  const [al] = conversar('treinador', ['estou com dor no peito e falta de ar']);
  assert.equal(al.aviso.tipo, 'danger');
  assert.ok(!al.sugestoes);
  const [c, f] = conversar('corrida', ['qual o meu pace hoje', 'qual a corrida de amanha']);
  for (const p of [c, f]) if (p.opcoes || p.acoes) assert.ok(!p.sugestoes);
  // texto igual ao botão da pergunta relacionada
  const [x] = conversar('treinador', ['qual o peso do stiff']);
  const r = M.responder(x.sugestoes[0].rotulo, 'treinador', { ...ctxDe(ADULTO, 'treinador'), memoria: x.memoria, aberto: x });
  assert.ok(r.assunto && r.assunto.startsWith('ex-'), r.assunto);
});
test('frases variam sem mudar o conteúdo', () => {
  const vistos = new Set();
  let mem = null;
  for (let i = 0; i < 3; i++) { const p = M.responder('valeu', 'treinador', { ...ctxDe(ADULTO, 'treinador'), memoria: mem }); vistos.add(p.texto[0]); mem = p.memoria; }
  assert.ok(vistos.size >= 2);
});
test('perfis bloqueados pela triagem: os assuntos novos não sugerem treino', () => {
  for (const t of [{ condicoes: ['cardiaco'] }, { triagem: ['dor_peito'] }, { idade: 13 }]) {
    const st = estado({ t });
    for (const id of ['ex-como', 'ex-musculo', 'ex-trocar', 'ex-seguro', 'explicar', 'recomendar']) {
      const p = M.iniciar(id, { ...ctxDe(st, 'treinador'), texto: 'stiff' });
      assert.ok(p.aviso && p.aviso.tipo === 'danger' && !p.acoes && !p.opcoes, `${JSON.stringify(t)} ${id}`);
    }
  }
});

// ---------- leva 5: frases novas, medidas antes e depois ----------
// 156 frases escritas como no WhatsApp (gírias, abreviações, erros, sem acento, frases longas, emojis), a 2/3 usadas para
// ajustar o vocabulário e 1/3 (k % 3 === 2) guardada só para a medição final. ANTES das mudanças: 55,8% no total (ajuste
// 57,1%, medição 52,9%), entidade 1/20, fora do assunto com confiança 3/60. DEPOIS: medição final 72,5% (37/51),
// entidade 20/20, fora do assunto 0/60. Esperado: id do assunto, 'faq:<começo>' (resposta direta) ou lista; '@regex' = a
// resposta tem de falar do exercício citado.
const LEVA5 = {
  treinador: [['hj n vou conseguir ir na academia pq tenho medico', 'treino-perdido'], ['mano hj nao rola, to mt cansado', 'treino-perdido'], ['qnd eu faltar o treino oq eu faço?', 'treino-perdido'], ['tô sem pique nenhum hj 😩', 'treino-perdido'], ['acho q vou ter q pular o treino amanha, vou trabalhar ate mais tarde', 'treino-perdido'], ['nao fui treinar segunda, e agora?', 'treino-perdido'], ['sexta tenho casamento, nao vai dar pra treinar', 'treino-perdido'],
    ['só tenho uns 35 min hj, oq eu faço?', 'pouco-tempo'], ['to correndo contra o tempo hoje, da pra fazer algo rapido?', 'pouco-tempo'], ['tem como fazer um treino resumido?', 'pouco-tempo'], ['chego tarde do trampo e tenho pouco tempo pra malhar', 'pouco-tempo'],
    ['oq tem pra hj?', 'qual-treino'], ['qual treino toca hoje', 'qual-treino'], ['amanha é dia de que?', 'qual-treino'], ['qual o treino de sabado vc sabe?', 'qual-treino'], ['me passa a ficha de hoje pfv', 'qual-treino'], ['quais aparelhos vou usar hoje', 'qual-treino'],
    ['quanto tempo eu vou gastar na academia hj', 'duracao'], ['o treino de quinta é longo?', 'duracao'], ['qto tempo dura o treino de amanha', 'duracao'], ['quais dias eu tenho treino essa semana?', 'semana'], ['me mostra minha semana ai', 'semana'], ['como ta minha agenda de treinos', 'semana'],
    ['da pra eu fazer hj o treino de sexta?', 'antecipar'], ['quero adiantar o treino de quinta pra amanha', 'antecipar'], ['tem problema malhar 2 dias seguidos?', 'seguidos'], ['posso treinar sabado e domingo seguido?', 'seguidos'], ['quantos dias de descanso preciso por semana', 'seguidos'],
    ['faço a corrida antes ou dps da academia?', 'juntar-treino'], ['posso correr e malhar no msm dia?', 'juntar-treino'],
    ['quantos kg eu coloco no agachamento goblet', 'carga', '@Agachamento goblet'], ['posso aumentar o peso no supino?', 'carga', '@[Ss]upino'], ['quantas series de agachamento eu faço?', 'carga', '@[Aa]gachamento'], ['qual o descanso da cadeira extensora', 'carga', '@Cadeira extensora'], ['quantas reps na mesa flexora?', 'carga', '@Mesa flexora'], ['a carga da elevação pelvica ta muito leve', 'carga', '@Elevação pélvica'], ['como eu sei a hora de aumentar a carga?', ['carga', 'faq:Quando e quanto aumentar']],
    ['como faz o stiff?', 'ex-como', '@Stiff'], ['como executa o afundo direito', 'ex-como', '@Afundo'], ['qual a forma certa de fazer agachamento goblet', 'ex-como', '@Agachamento goblet'], ['me explica como fazer a remada cavalinho', 'ex-como', '@Remada cavalinho'],
    ['o peck deck trabalha qual musculo?', 'ex-musculo', '@Peck deck'], ['a cadeira abdutora serve pra que?', 'ex-musculo', '@Cadeira abdutora'], ['stiff pega posterior ou gluteo?', 'ex-musculo', '@Stiff'],
    ['posso trocar o stiff por outro exercicio?', 'ex-trocar', '@Stiff'], ['nao gosto do afundo, tem outro no lugar?', 'ex-trocar', '@Afundo'], ['da pra substituir o graviton por barra fixa?', ['ex-trocar', 'aparelho-falta'], '@[Gg]raviton'],
    ['agachamento goblet é seguro pra quem tem dor no joelho?', 'ex-seguro', '@Agachamento goblet'], ['posso fazer stiff com dor nas costas?', 'ex-seguro', '@Stiff'], ['a cadeira extensora faz mal pro joelho?', 'ex-seguro', '@Cadeira extensora'],
    ['minha academia nao tem smith', 'aparelho-falta'], ['a cadeira extensora ta quebrada hj', 'aparelho-falta', '@Cadeira extensora'], ['nao tem graviton na academia q eu treino', 'aparelho-falta'], ['o peck deck ta com fila enorme', 'aparelho-ocupado'], ['tem um cara usando o aparelho faz 20 min', 'aparelho-ocupado'],
    ['quero refazer meu treino do zero', 'mudar-plano'], ['enjoei dessa ficha, tem como mudar?', 'mudar-plano'], ['quero treinar 5x na semana agora', 'mudar-plano'], ['mudei de academia', 'mudar-plano'],
    ['to com uma dor no ombro qnd faço supino', 'dor-treino'], ['meu joelho estalou e ta doendo', 'dor-treino'], ['acordei com o corpo todo moído do treino de ontem', 'dor-treino'], ['sinto uma pontada na lombar', 'dor-treino'],
    ['preciso alongar antes de treinar?', 'faq:Preciso aquecer e alongar'], ['tem que treinar ate a falha?', 'faq:Preciso treinar até a falha'], ['oq é deload', 'faq:O que é um “deload”'], ['fazer esteira depois da musculação atrapalha a hipertrofia?', 'faq:Fazer cardio atrapalha'], ['qual o melhor treino pra perder barriga', 'faq:Qual é o melhor treino para emagrecer'],
    ['fiquei 3 meses parado, como volto?', 'faq:Fiquei um tempo parado'], ['quantas vezes por semana eu devo treinar?', 'faq:Quantas vezes por semana'], ['de quanto em quanto tempo troca a ficha', 'faq:De quanto em quanto tempo devo trocar'], ['tenho pressao alta, posso malhar pesado?', 'faq:Tenho pressão alta'],
    ['to gripado, posso treinar?', 'saude-fora-treino'], ['bati o dedo do pé na porta e inchou', 'saude-fora-treino'], ['dormi so 4 horas, treino ou nao?', 'treino-perdido']],
  corrida: [['ta chovendo canivete aqui, oq faço com a corrida', 'chuva'], ['a rua ta toda alagada', 'chuva'], ['ta um calor absurdo pra correr hj', ['chuva', 'faq:Como correr no calor']], ['posso fazer o treino na esteira em vez da rua?', 'esteira'], ['qnto de inclinação boto na esteira', 'esteira'], ['esteira conta igual correr na rua?', ['esteira', 'faq:Correr na esteira vale']],
    ['qual corrida tenho hj', 'corrida-dia'], ['quantos km eu corro amanha?', 'corrida-dia'], ['o longao de domingo é de quantos km', 'corrida-dia'], ['qual minha corrida de quinta', 'corrida-dia'], ['qual pace eu faço no rodagem?', 'ritmo'], ['a q velocidade eu tenho q correr hj', 'ritmo'], ['qual meu ritmo de treino leve', 'ritmo'],
    ['tô achando facil demais, posso apertar o ritmo?', 'mais-rapido'], ['queria correr mais km por semana', 'mais-rapido'], ['como faço pra melhorar meu tempo nos 5k', 'mais-rapido'], ['o treino ta mt puxado, posso diminuir?', 'mais-devagar'], ['nao to aguentando o ritmo', 'mais-devagar'], ['posso caminhar um pouco no meio da corrida?', 'mais-devagar'],
    ['da pra passar a corrida de hj pra amanha?', 'mover-corrida'], ['quero correr no sabado em vez de sexta', 'mover-corrida'], ['posso trocar o dia do longao?', 'mover-corrida'], ['hj nao vou conseguir correr, tenho reuniao', 'corrida-perdida'], ['perdi a corrida de ontem', 'corrida-perdida'], ['amanha nao rola correr', 'corrida-perdida'],
    ['quais dias eu corro essa semana', 'semana-corrida'], ['como ta minha semana de corrida', 'semana-corrida'], ['corro antes ou depois da academia?', 'juntar-corrida'], ['da pra correr e fazer perna no mesmo dia?', 'juntar-corrida'],
    ['to com dor na sola do pé qnd corro', 'dor-corrida'], ['minha canela ta latejando', 'dor-corrida'], ['senti o joelho doer no km 5', 'dor-corrida'], ['quero mudar minha meta pra meia maratona', 'mudar-corrida'], ['quero correr 3x por semana em vez de 4', 'mudar-corrida'],
    ['oq é o teste da fala?', 'faq:O que é o teste da fala'], ['pq quase todo treino é devagar?', 'faq:Por que a maior parte dos treinos é leve'], ['precisa alongar antes de correr?', 'faq:Alongar antes de correr'], ['como sei se to treinando demais', 'faq:Como saber se estou treinando demais'], ['menstruada posso correr normal?', 'faq:O ciclo menstrual'],
    ['quanto devo beber de agua correndo no calor', 'faq:Como correr no calor'], ['to resfriado, corro ou nao?', ['saude-fora-corrida', 'faq:Posso correr gripado']]],
  nutri: [['oq eu como no cafe hj?', 'nutri-cardapio'], ['me fala o cardapio de amanha', 'nutri-cardapio'], ['qual o jantar de hoje?', 'nutri-cardapio'], ['oq tem pro lanche da tarde', 'nutri-cardapio'], ['nao tenho frango em casa, troca por oq?', 'nutri-trocar'], ['posso trocar o arroz por batata doce?', ['nutri-trocar', 'nutri-alimento']], ['odeio brocolis, tem como mudar?', 'nutri-trocar'],
    ['comi um podrão ontem a noite 🍔', 'nutri-exagerei'], ['fds eu meti o pé na jaca', 'nutri-exagerei'], ['bebi mt cerveja no sabado', 'nutri-exagerei'], ['tomei 2 litros de refri ontem kkk', 'nutri-exagerei'], ['qnto de proteina eu tenho q comer por dia', 'nutri-metas'], ['quantos copos de agua por dia?', 'nutri-metas'], ['qual minha meta de agua', 'nutri-metas'],
    ['banana engorda?', 'nutri-alimento'], ['posso comer chocolate de vez em quando?', 'nutri-alimento'], ['ovo faz mal pro colesterol?', 'nutri-alimento'], ['acai é saudavel?', 'nutri-alimento'], ['quanto de arroz posso colocar no prato?', 'nutri-alimento'], ['como antes de malhar ou treino de estomago vazio?', 'nutri-treino'], ['oq comer dps do treino pra ganhar massa', 'nutri-treino'], ['qual o melhor lanche pre treino', 'nutri-treino'],
    ['creatina da queda de cabelo?', 'nutri-suplementos'], ['qnto de creatina eu tomo?', 'nutri-suplementos'], ['whey engorda?', 'nutri-suplementos'], ['pre treino faz mal pro coração?', ['nutri-suplementos', 'faq:Pré-treino faz mal']], ['vale a pena tomar bcaa?', ['nutri-suplementos', 'faq:BCAA funciona']],
    ['trabalho o dia todo fora, como faço pra comer direito?', 'nutri-pratico'], ['nao tenho tempo de cozinhar na semana', 'nutri-pratico'], ['vou num aniversario hj, oq como la?', 'nutri-pratico'], ['quero mudar meu objetivo pra emagrecer', 'nutri-plano'], ['engordei 3 kg, precisa refazer?', 'nutri-plano'],
    ['jejum intermitente funciona msm?', 'faq:Jejum intermitente'], ['low carb emagrece mais?', 'faq:Low-carb'], ['sou vegetariano, consigo ganhar massa?', 'faq:Dieta vegetariana'], ['quanto de açucar posso por dia', 'faq:Quanto de sal'], ['preciso tomar vitamina d?', 'faq:Preciso tomar vitamina D'], ['o app substitui nutricionista?', 'faq:O aplicativo substitui'], ['como o app calcula minhas calorias', 'faq:Como o aplicativo calcula'], ['quantas calorias eu como pra secar?', ['faq:Quantas calorias devo comer', 'nutri-metas']]],
};
const FORA_GIRIA = ['kkkkk vc é mt engraçado', 'qual o melhor celular pra comprar', 'me empresta 50 reais', 'quem vai ganhar a eleição', 'como faço pra passar no enem', 'meu chefe é chato demais', 'o que vc acha do flamengo', 'quero aprender ingles', 'me indica uma musica boa', 'tô entediado',
  'qual o sentido da vida', 'vc é um robô?', 'como fazer bolo de cenoura', 'onde fica a farmácia mais perto', 'minha internet ta lenta', 'qual a senha do wifi', 'vamo sair hj?', 'te amo', 'vc pode pedir uma pizza pra mim', 'que dia é hoje', 'me recomenda um filme', 'por que o céu é azul'];
function resultado(texto, coach) {
  const ctx = ctxDe(ADULTO, coach);
  let p = M.limparPasso(M.responder(texto, coach, ctx));
  if (/^Entendi que você quer/.test(p.texto[0])) p = M.limparPasso(M.seguir(p, 'sim', { ...ctx, memoria: p.memoria }));
  return p;
}
test('leva 5: frases novas de WhatsApp levam ao assunto, à pergunta frequente e ao exercício certos; mede o acerto', () => {
  let total = 0, certo = 0, entTot = 0, ent = 0, medTot = 0, med = 0;
  const erros = [];
  for (const [coach, lista] of Object.entries(LEVA5)) {
    lista.forEach(([frase, esp, ex], k) => {
      total++;
      const p = resultado(frase, coach);
      const ok = (Array.isArray(esp) ? esp : [esp]).some((a) => (a.startsWith('faq:') ? (p.faqQ || '').startsWith(a.slice(4)) : p.assunto === a));
      if (ok) certo++; else erros.push(`${coach}: "${frase}" → ${p.assunto || (p.faqQ ? 'faq:' + p.faqQ.slice(0, 25) : '(nenhum)')}`);
      if (k % 3 === 2) { medTot++; if (ok) med++; }
      if (ex) { entTot++; if (ok && new RegExp(ex.slice(1)).test(tudo(p))) ent++; }
    });
  }
  console.log(`  leva 5: ${certo}/${total} (${Math.round((certo / total) * 1000) / 10}%), separadas para medir ${med}/${medTot}, exercício citado ${ent}/${entTot}` + (erros.length ? '\n    ' + erros.join('\n    ') : ''));
  assert.ok(total >= 150);
  assert.ok(certo / total >= 0.82, `acerto abaixo de 82%: ${certo}/${total}`);
  assert.ok(ent / entTot >= 0.95, `exercício citado: ${ent}/${entTot}`);
});
test('leva 5: fora do assunto (com gíria) nunca sai com alta confiança, em nenhum treinador', () => {
  for (const coach of ['treinador', 'corrida', 'nutri']) {
    for (const t of FORA_GIRIA) {
      const r = M.entender(t, coach, ctxDe(ADULTO, coach));
      const p = M.responder(t, coach, ctxDe(ADULTO, coach));
      assert.ok(!r.alerta && !r.direto && !p.assunto && !/Entendi que/.test(p.texto.join(' ')), `"${t}" (${coach}) → ${p.assunto || p.texto[0]}`);
    }
  }
});
test('perguntas frequentes no chat: só as que existem, com fontes, e as relacionadas também', () => {
  const todas = [...FAQ_TREINO, ...FAQ_NUTRI, ...FAQ_CORRIDA].map((x) => x.q);
  for (const [coach, t] of [['treinador', 'tem que treinar ate a falha?'], ['corrida', 'oq é o teste da fala?'], ['nutri', 'jejum intermitente funciona msm?']]) {
    const p = resultado(t, coach);
    assert.ok(p.faqQ && todas.includes(p.faqQ), t);
    assert.ok(p.refs && p.refs.every((k) => textoDaRef(k)), t);
  }
});

// ---------- leva 6 e 7: frases de exemplo, jeitos de dizer, respostas curtas e conversa ----------
import fs from 'node:fs';
import { JEITOS, EXEMPLOS } from '../www/js/logic/chat/exemplos.js';
import { tipoDoTexto } from '../www/js/logic/chat/saude.js';
// O que o chat fez com a frase: 'direto' | 'confirma' | 'pergunta' | 'faq' | 'nada', e o assunto (ou os dos botões)
function decisao(coach, texto) {
  const ctx = ctxDe(ADULTO, coach);
  const r = M.entender(texto, coach, ctx);
  const [p] = conversar(coach, [texto]);
  if (p.assunto) return { tipo: 'direto', ids: [p.assunto] };
  if (/^Você quer falar sobre/.test(p.texto[0] || '') && r.melhor) return { tipo: 'confirma', ids: [r.melhor.intencao.id] };
  if (p.faqQ) return { tipo: 'faq', ids: [] };
  // o assunto é do outro treinador: o chat leva até ele
  if (p.ir && r.deOutro) return { tipo: 'pergunta', ids: [r.deOutro.intencao.id] };
  if (p.opcoes && /É sobre um destes|É isto que|É algum destes/.test(p.texto.join(' '))) return { tipo: 'pergunta', ids: p.opcoes.map((o) => o.valor) };
  return { tipo: 'nada', ids: [], seguranca: /\b(188|192)\b/.test(p.texto.join(' ')) };
}
test('frases novas de pessoas comuns (levas 6 e 7, escritas sem ver as palavras-chave): acerto mínimo e poucas respostas de outro assunto', () => {
  const { leva6, leva7, leva8, leva9, leva10 } = JSON.parse(fs.readFileSync(new URL('./dados/frases-chat.json', import.meta.url), 'utf8'));
  // leva 7: medida antes do ajuste em 68% (código antigo) e 77% (motor com exemplos); estes limites só protegem de piora.
  // levas 8 a 10: só situações contadas, sem pergunta ("to preso no aeroporto"); a 10 não foi usada para ajustar (antes do
  // ajuste: 53% com a pergunta de volta e 16 de outro assunto; depois: 66% e 13)
  for (const [nome, lista, minimo, trocaMax] of [['leva 6', leva6, 0.88, 0.05], ['leva 7', leva7, 0.80, 0.05], ['leva 8', leva8, 0.84, 0.05], ['leva 9', leva9, 0.86, 0.05], ['leva 10', leva10, 0.62, 0.10]]) {
    let certo = 0, trocado = 0;
    for (const f of lista) {
      const d = decisao(f.coach, f.texto);
      const ok = f.esperado === 'nenhum' ? d.tipo === 'nada' || d.tipo === 'pergunta' || d.tipo === 'faq'
        : d.tipo === 'faq' || d.seguranca || ((d.tipo === 'direto' || d.tipo === 'confirma' || d.tipo === 'pergunta') && d.ids.includes(f.esperado));
      if (ok) certo++;
      else if (d.tipo === 'direto') trocado++;
    }
    assert.ok(certo / lista.length >= minimo, `${nome}: ${(100 * certo / lista.length).toFixed(1)}% (mínimo ${minimo * 100}%)`);
    assert.ok(trocado / lista.length <= trocaMax, `${nome}: respondeu outro assunto em ${trocado}`);
  }
});
test('exemplos e jeitos: só de assuntos que existem, botões curtos', () => {
  for (const id of [...Object.keys(EXEMPLOS), ...Object.keys(JEITOS)]) assert.ok(M.intencaoPorId(id), id);
  for (const l of Object.values(JEITOS)) for (const j of l) assert.ok(j.length <= 40, j);
});
test('as duas perguntas do dono: intervalo menor que 1 hora e dor de cabeça (direto, sem pergunta de dois assuntos)', () => {
  for (const coach of ['treinador', 'corrida']) {
    const [p] = conversar(coach, ['posso correr e fazer os exercícios de hoje com o intervalor menor que 1 hora?']);
    assert.match(p.assunto, /^juntar-/);
    assert.ok(p.texto.length <= 2 && /menos de 3 horas/.test(p.texto.join(' ')));
    const [a, b, c, d] = conversar(coach, ['estou com dor de cabeça, como fica os treinos de hoje?', '#Não', '#Não', '#Leve']);
    assert.equal(a.assunto, 'saude-fora-' + (coach === 'corrida' ? 'corrida' : 'treino'));
    assert.match(a.texto[0], /^Dor de cabeça\. Antes, tem algum destes sinais\?/); // já sabe o que é: não pergunta "O que aconteceu?"
    assert.match(b.texto[0], /esforço forte/);
    assert.ok(c.opcoes.some((o) => o.rotulo === 'Piora quando me mexo'), 'grau e "piora" numa pergunta só');
    assert.equal(d.texto.length, 1);
    assert.match(d.texto[0], /^Hoje só treino leve\./);
    assert.equal(d.acoes[0].rotulo, 'Ajustar o treino de hoje');
  }
  assert.equal(tipoDoTexto('to com diarreia'), 'estomago');
  assert.equal(tipoDoTexto('furei o treino de ontem'), '');
  assert.equal(tipoDoTexto('furei o pe num prego'), 'corte');
  assert.equal(tipoDoTexto('bati a cabeca na porta'), 'cabeca');
});
test('respostas curtas: no máximo 2 parágrafos corridos no balão; o resto no "Saiba mais"; segurança inteira', () => {
  const ctx = ctxDe(ADULTO, 'treinador');
  for (const i of M.intencoes()) {
    const p = M.limparPasso(M.iniciar(i.id, ctxDe(ADULTO, i.coach)));
    const prosa = p.texto.filter((t, k) => !/^(•|\d+\.\s)/.test(t) && !/:$/.test(t) && !(p.opcoes && k === p.texto.length - 1));
    assert.ok(prosa.length <= M.MAX_PARAGRAFOS || p.texto.some((t) => /\b(192|188)\b/.test(t)), i.id + ': ' + p.texto.join(' | '));
  }
  // "Saiba mais" leva o que saiu do balão (nada se perde)
  const p = M.limparPasso({ texto: ['um', 'dois', 'três'], detalhes: ['porquê'] });
  assert.deepEqual(p.texto, ['um', 'dois']);
  assert.deepEqual(p.detalhes, ['três', 'porquê']);
  // risco: a fala inteira, com o 188 à vista
  const [r] = conversar('nutri', ['depois que como me sinto horrivel e queria me punir']);
  assert.ok(r.texto.some((t) => /188/.test(t)) && r.aviso && r.aviso.tipo === 'danger');
  assert.ok(ctx);
});
test('respostas digitadas: posição do botão, número aproximado e pergunta repetida quando não entende', () => {
  const [, a] = conversar('treinador', ['tenho pouco tempo hoje', 'a segunda']);
  assert.match(a.texto[0], /cerca de 30 min/);
  const [, b] = conversar('treinador', ['tenho pouco tempo hoje', 'uns 25']);
  assert.match(b.texto[0], /cerca de 20 min/); // o maior que cabe nos 25 minutos
  const [q, c] = conversar('treinador', ['tenho pouco tempo hoje', 'xablau bla']);
  assert.match(c.texto[0], /^Não peguei/);
  assert.deepEqual(c.opcoes.map((o) => o.rotulo), q.opcoes.map((o) => o.rotulo));
  // dia da semana como botão continua sendo o dia, não "a segunda opção"
  const [m, d] = conversar('corrida', ['quero mudar a corrida de hoje de dia', 'sexta']);
  assert.ok(m.opcoes.some((o) => /Sexta/.test(o.rotulo)));
  assert.match(d.texto[0], /sexta/);
});
test('sem entender: botões variados que levam aos assuntos (vários jeitos, o mesmo lugar)', () => {
  const [n] = conversar('treinador', ['asdf qwer zxcv']);
  assert.ok(n.opcoes.length >= 4 && n.opcoes[n.opcoes.length - 1].rotulo === 'Ver todos os assuntos');
  const [p] = conversar('corrida', ['posso acelerar o ritmo hoje?']);
  assert.ok(p.opcoes.length >= 3 && p.opcoes.some((o) => o.valor === 'ritmo'));
  // a mesma pergunta em outra conversa varia os jeitos de dizer
  const um = conversar('treinador', ['asdf qwer zxcv'])[0].opcoes.map((o) => o.rotulo).join();
  const dois = conversar('treinador', ['oi', 'asdf qwer zxcv'])[1].opcoes.map((o) => o.rotulo).join();
  assert.notEqual(um, dois);
});

import { doencaDeOutro, cansouDe, impedimento, tempoApertado } from '../www/js/logic/chat/comum.js';
test('situações contadas: doença de outra pessoa, cansar de algo, o que impede o treino e o tempo apertado', () => {
  const n = (t) => M.preparar(t);
  assert.ok(doencaDeOutro(n('minha filha acordou com febre e vou ficar com ela')) && !doencaDeOutro(n('to com febre')) && !doencaDeOutro(n('meu filho e eu estamos com gripe, to com febre')));
  assert.ok(cansouDe(n('ja faz 3 meses fazendo a msm coisa e to enjoado')) && !cansouDe(n('to enjoado e com dor de barriga')));
  assert.ok(impedimento(n('peguei plantao hoje')) && impedimento(n('o voo atrasou')) && !impedimento(n('entro no trabalho daqui a 40 minutos')));
  assert.ok(tempoApertado(n('entro no trabalho daqui a 40 minutos')) && !tempoApertado(n('peguei plantao hoje')));
  // no chat: a febre da filha leva a faltar ao treino, não às perguntas de saúde de quem escreve
  const [p] = conversar('treinador', ['minha filha ta com febre e vou ficar em casa com ela hoje']);
  assert.equal(p.assunto, 'treino-perdido');
  // "enjoado da mesma coisa" não abre a conversa de enjoo
  const [q] = conversar('treinador', ['ja faz 3 meses fazendo a msm coisa e to enjoado']);
  assert.notEqual(q.assunto, 'saude-fora-treino');
});

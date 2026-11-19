// Chat com os treinadores (logic/chat/motor.js, treino.js e corrida.js): reconhecimento do texto livre (frases reais,
// com e sem acento, com erro de digitação, com negação e fora do assunto), sinais de alerta, cada assunto percorrido até
// o fim em perfis variados (inclusive gestante, idoso, cardíaco, dor e menor de 18) sem sugestão contra as regras do
// app, e as ações aplicadas no estado.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import * as M from '../www/js/logic/chat/motor.js';
import { ABRIR, COACHES } from '../www/js/logic/chat/contrato.js';
import { textoDaRef } from '../www/js/logic/chat/comum.js';
import { versaoCurta, treinoDeHoje, corridaDeHoje } from '../www/js/logic/chat/treino.js';
import * as P from '../www/js/logic/perdido.js';
import { gerarPlano, respostasCompletas, duracaoEstimada, perfil } from '../www/js/logic/trainer.js';
import { PERGUNTAS as P_CORRIDA } from '../www/js/logic/corrida.js';
import { EX_POR_ID } from '../www/js/data/exercises.js';
import { FAQ_TREINO as FAQ_TREINO_T, FAQ_NUTRI as FAQ_NUTRI_T } from '../www/js/data/knowledge.js';
import { FAQ_CORRIDA as FAQ_CORRIDA_T } from '../www/js/data/corrida.js';
import { treinoDoDia as corridaDoDiaLogica, planoDaSemanaEm } from '../www/js/logic/corrida.js';
// a esteira é de outro módulo (logic/esteira.js): os testes usam se existir
let ESTEIRA = null;
try { ESTEIRA = await import('../www/js/logic/esteira.js'); } catch { ESTEIRA = null; }

const J = (x) => JSON.parse(JSON.stringify(x));
// semana de teste: segunda 16/11/2026 a domingo 22/11/2026
const SEMANA = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
const TREINO = { objetivo: 'hipertrofia', idade: 31, peso: 78, altura: 176, experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], remedios: ['nenhum'], foco: ['equilibrado'], semTreino: ['nenhum'] };
const CORRIDA = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'saude', dias: ['1', '2', '4', '6'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
for (const q of P_CORRIDA) if (!(q.k in CORRIDA) && !(q.se && !q.se(CORRIDA)) && !q.opcional) CORRIDA[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
const LIB = { liberado: 'sim', liberadoEm: '2026-10-01' };
// O plano aceito é sempre o de um adulto sem restrições (a saúde pode ter mudado depois do aceite: é aí que o chat tem
// de respeitar a triagem); as respostas guardadas são as do perfil.
const PLANO = (() => {
  const p = gerarPlano(TREINO, { all: true, has: {} }, 0, null, null);
  return { id: 'p1', nome: 'Plano', origem: 'treinador', criadoEm: '2026-11-01T10:00:00.000Z', dias: p.dias.map((d) => ({ id: d.id, nome: d.nome, foco: d.foco || '', itens: d.itens })), agenda: p.agenda, info: '' };
})();
function estado({ t = {}, c = {}, foco = 'equilibrio', semCorrida = false, extra = {} } = {}) {
  const treino = { ...TREINO, ...t }, corrida = { ...CORRIDA, ...c };
  return store.sanitize({
    v: store.VERSAO, trainer: { answers: treino, aceitoEm: '2026-11-01T10:00:00.000Z' }, plans: [J(PLANO)], activePlan: 'p1',
    ...(semCorrida ? {} : { run: { answers: corrida, aceitoEm: '2026-11-02T10:00:00.000Z', inicio: '2026-11-02', pausadoEm: '' } }),
    combo: { foco, fortalecimento: 'nao', em: '2026-11-02T10:00:00.000Z' }, ...extra,
  });
}
const dor = (onde, tipo, nivel, extra = {}) => ({ id: 'dor' + onde, data: '2026-11-15', onde, lado: '', tipo, quando: 'durante', nivel, nota: '', fim: '', ...extra });
const PERFIS = {
  adulto: () => estado(),
  novato: () => estado({ t: { experiencia: 'iniciante' } }),
  semFoco: () => estado({ foco: '' }),
  focoCorrida: () => estado({ foco: 'corrida' }),
  focoMusculacao: () => estado({ foco: 'musculacao' }),
  soMusculacao: () => estado({ semCorrida: true }),
  gestante: () => estado({ t: { condicoes: ['gestante'], ...LIB }, c: { condicoes: ['gestante'], ...LIB } }),
  gestanteSemLiberacao: () => estado({ t: { condicoes: ['gestante'] }, c: { condicoes: ['gestante'] } }),
  idoso: () => estado({ t: { idade: 68 }, c: { idade: 68 } }),
  cardiaco: () => estado({ t: { condicoes: ['cardiaco'], ...LIB }, c: { condicoes: ['cardiaco'], ...LIB } }),
  cardiacoSemLiberacao: () => estado({ t: { condicoes: ['cardiaco'] }, c: { condicoes: ['cardiaco'] } }),
  sinalNaTriagem: () => estado({ t: { triagem: ['dor_peito'] } }),
  menor: () => estado({ t: { idade: 16 }, c: { idade: 16 } }),
  menor13: () => estado({ t: { idade: 13 }, c: { idade: 13 } }),
  diabetes: () => estado({ t: { condicoes: ['diabetes'] }, c: { condicoes: ['diabetes'] } }),
  dorJoelho: () => estado({ extra: { dores: [dor('joelho', 'articular', 5)] } }),
  dorDeAlerta: () => estado({ extra: { dores: [dor('lombar', 'aguda', 8)] } }),
  dorMuscular: () => estado({ extra: { dores: [dor('coxa-frente', 'muscular', 4)] } }),
};
// perfis em que a triagem bloqueia o treino: o chat não sugere treino nenhum
const BLOQUEADOS = new Set(['gestanteSemLiberacao', 'cardiacoSemLiberacao', 'sinalNaTriagem', 'menor13']);
const SEM_TREINO_NO_BLOQUEIO = new Set(['treino-perdido', 'pouco-tempo', 'juntar-treino', 'carga', 'aparelho-ocupado', 'juntar-corrida']);
const ctxDe = (st, hoje, coach) => ({ st, hoje, agora: Date.parse(hoje + 'T15:00:00Z'), coach });
const ROTAS = [/^$/, /^academia$/, /^treinos$/, /^treinador$/, /^corrida$/, /^nutricao$/, /^sono$/, /^sessao$/, /^progresso$/, /^corrida\/dia\/\d{4}-\d{2}-\d{2}$/, /^exercicio\/[\w-]+$/, /^treino\/[\w-]+\/[\w-]+$/, /^chat\/(treinador|corrida|nutri)$/];

// Percorre um assunto até o fim (todas as opções, até 6 níveis) e devolve os passos crus (sem limparPasso)
function percorrer(raiz, ctx, max = 6) {
  const out = [];
  const ir = (p, nivel, caminho) => {
    out.push({ p, caminho });
    if (nivel >= max || !p || !Array.isArray(p.opcoes)) return;
    for (const o of p.opcoes) {
      if (typeof o.valor === 'string' && o.valor.startsWith('#')) continue; // menus do motor
      let q;
      try { q = p.proximo(o.valor, ctx); } catch (e) { assert.fail(`erro em ${caminho} > ${o.rotulo}: ${e.stack}`); }
      ir(q, nivel + 1, caminho + ' > ' + o.rotulo);
    }
  };
  ir(raiz, 0, '');
  return out;
}
// Confere um passo cru contra o contrato
function confere(p, onde) {
  assert.ok(p && typeof p === 'object', 'passo vazio em ' + onde);
  assert.ok(Array.isArray(p.texto) && (p.texto.length || p.aviso || p.faq), 'sem texto em ' + onde);
  for (const t of [...p.texto, ...(p.detalhes || [])]) assert.ok(typeof t === 'string' && t.trim().length > 1 && !/undefined|NaN|\[object/.test(t), `texto ruim em ${onde}: ${t}`);
  for (const k of p.refs || []) assert.ok(textoDaRef(k), `fonte inexistente "${k}" em ${onde}`);
  if (p.aviso) assert.ok(['info', 'warn', 'danger'].includes(p.aviso.tipo) && p.aviso.texto, 'aviso ruim em ' + onde);
  if (p.opcoes) {
    assert.ok(p.opcoes.length >= 1 && p.opcoes.length <= 6 && typeof p.proximo === 'function', 'opções fora do contrato em ' + onde);
    assert.equal(new Set(p.opcoes.map((o) => String(o.valor) + o.rotulo)).size, p.opcoes.length, 'opção repetida em ' + onde);
    for (const o of p.opcoes) assert.ok(o.rotulo.length <= 60, 'rótulo longo em ' + onde + ': ' + o.rotulo);
  }
  for (const x of p.ir || []) assert.ok(x.rota != null ? ROTAS.some((r) => r.test(x.rota)) : ABRIR.includes(x.abrir), `atalho inválido em ${onde}: ${JSON.stringify(x)}`);
  for (const a of p.acoes || []) assert.ok(a.rotulo && a.confirmar && (typeof a.aplicar === 'function' || (a.iniciar && Array.isArray(a.iniciar.itens))), 'ação inválida em ' + onde);
  // texto curto: nenhuma fala à vista passa de ~3 linhas
  for (const t of p.texto) assert.ok(t.length <= 260, `fala longa demais em ${onde}: ${t.length}`);
}

// ---------- registro ----------
test('registro: ids únicos, treinadores do contrato, palavras sem acento e sem maiúsculas', () => {
  const l = M.intencoes();
  assert.ok(l.filter((i) => i.coach === 'treinador').length >= 7 && l.filter((i) => i.coach === 'corrida').length >= 5);
  assert.equal(new Set(l.map((i) => i.id)).size, l.length);
  for (const i of l) {
    assert.ok(COACHES[i.coach], i.id);
    assert.ok(i.titulo.length <= 40, 'título longo: ' + i.titulo);
    if (i.coach === 'nutri') continue; // assuntos da Nutricionista: testes em chat-nutri.test.mjs
    for (const w of i.palavras) { const w0 = w.replace(/^!/, ''); assert.ok(w0 === M.normalizar(w0) || w.includes('+'), `palavra fora do padrão em ${i.id}: ${w}`); }
  }
  assert.equal(M.normalizar('  Não VOU, treinar — hoje!! Ç '), 'nao vou treinar hoje c');
});

// ---------- reconhecimento ----------
const ADULTO = PERFIS.adulto();
const TER = '2026-11-17';
const reconhece = (texto, coach, id) => {
  const r = M.entender(texto, coach, ctxDe(ADULTO, TER, coach));
  assert.ok(!r.alerta, `alerta indevido: ${texto}`);
  assert.ok(r.confiante && r.melhor.intencao.id === id, `"${texto}" (${coach}) deveria ser ${id}: ${r.ranking.slice(0, 3).map((x) => x.intencao.id + ':' + x.pontos).join(' ')}`);
};
test('reconhecimento: frases reais do Treinador, com e sem acento', () => {
  const casos = [
    ['Não vou conseguir treinar hoje', 'treino-perdido'], ['nao vou conseguir treinar hoje', 'treino-perdido'], ['hoje não vou poder treinar', 'treino-perdido'],
    ['tô cansado demais pra treinar', 'treino-perdido'], ['dormi mal essa noite', 'dormi-mal'], ['estou gripado', M.intencaoPorId('saude-fora-treino') ? 'saude-fora-treino' : 'treino-perdido'], ['vou viajar amanhã', 'treino-perdido'],
    ['tenho só 30 minutos hoje', 'pouco-tempo'], ['estou com pressa, dá pra fazer um treino rápido?', 'pouco-tempo'], ['tô sem tempo', 'pouco-tempo'], ['preciso de uma versão curta do treino', 'pouco-tempo'],
    ['quantos quilos eu coloco no supino?', 'carga'], ['quanto tempo de descanso entre as séries?', 'carga'], ['quantas repetições devo fazer?', 'carga'], ['quando aumentar a carga', 'carga'],
    ['quero mudar os dias do treino', 'mudar-plano'], ['quero treinar em casa', 'mudar-plano'], ['enjoei do meu treino', 'mudar-plano'], ['quero um treino novo', 'mudar-plano'],
    ['estou com dor no joelho', 'dor-treino'], ['meu ombro está doendo', 'dor-treino'], ['dor muscular depois do treino', 'dor-treino'],
    ['o aparelho está ocupado', 'aparelho-ocupado'], ['a academia está lotada', 'aparelho-ocupado'],
    ['posso correr depois da musculação?', 'juntar-treino'], ['dá pra fazer corrida e musculação no mesmo dia?', 'juntar-treino'],
    // o exemplo do dono do app
    ['hoje de manhã eu tinha corrida no plano mas choveu; tenho musculação hoje também — posso fazer um seguido do outro e qual a recomendação de acordo com minhas prioridades e meu perfil?', 'juntar-treino'],
  ];
  for (const [t, id] of casos) reconhece(t, 'treinador', id);
});
test('reconhecimento: frases reais do Treinador de corrida', () => {
  const casos = [
    ['choveu e não dá pra correr', 'chuva'], ['tá chovendo', 'chuva'], ['posso correr na esteira?', 'esteira'], ['qual inclinação na esteira', 'esteira'],
    ['não vou correr hoje', 'corrida-perdida'], ['hoje não consigo correr', 'corrida-perdida'],
    ['quero mudar os dias da corrida', 'mudar-corrida'], ['estou com dor na canela', 'dor-corrida'],
    ['hoje de manhã eu tinha corrida no plano mas choveu; tenho musculação hoje também — posso fazer um seguido do outro e qual a recomendação de acordo com minhas prioridades e meu perfil?', 'juntar-corrida'],
  ];
  for (const [t, id] of casos) reconhece(t, 'corrida', id);
});
test('reconhecimento: erros de digitação (palavras de 5 letras ou mais)', () => {
  reconhece('nao vou conseguir trienar hoje', 'treinador', 'treino-perdido');
  reconhece('estou cansdo', 'treinador', 'treino-perdido');
  reconhece('posso fazer corida e musculasao no mesmo dia', 'treinador', 'juntar-treino');
  reconhece('o aparelio esta ocupado', 'treinador', 'aparelho-ocupado');
  reconhece('quantas repeticoes devo fazr', 'treinador', 'carga');
  reconhece('chuveu e nao deu pra correr', 'corrida', 'chuva');
  // palavra curta não é "corrigida": "dor" e "for" não se confundem
  assert.equal(M.lerTexto('for').map((t) => t.c).join(), 'for');
});
test('reconhecimento: negação simples não conta', () => {
  const r = M.entender('não estou com dor', 'treinador', ctxDe(ADULTO, TER, 'treinador'));
  assert.ok(!r.confiante && !r.ranking.some((x) => x.intencao.id === 'dor-treino'), 'dor negada');
  reconhece('não estou cansado, só sem tempo', 'treinador', 'pouco-tempo');
  const s = M.entender('sem dor nenhuma, só quero saber quantas séries', 'treinador', ctxDe(ADULTO, TER, 'treinador'));
  assert.ok(s.confiante && s.melhor.intencao.id === 'carga');
});
test('reconhecimento: fora do assunto nunca sai com alta confiança', () => {
  const fora = ['qual a capital da França?', 'me conta uma piada', 'quanto custa um iPhone', 'quem ganhou o jogo de futebol ontem', 'bom dia', 'obrigado!', 'asdfgh qwerty', 'qual a previsão do tempo', 'me recomenda um filme', 'como faço um bolo de chocolate', '', '!!!', 'a'.repeat(400)];
  for (const coach of ['treinador', 'corrida']) {
    for (const t of fora) {
      const r = M.entender(t, coach, ctxDe(ADULTO, TER, coach));
      assert.ok(!r.alerta && !r.confiante, `"${t.slice(0, 30)}" não podia ser reconhecido em ${coach}`);
      const p = M.limparPasso(M.responder(t, coach, ctxDe(ADULTO, TER, coach)));
      assert.ok(p && !/Entendi que/.test(p.texto.join(' ')), t.slice(0, 30));
    }
  }
});
test('reconhecimento: assunto bem claro responde direto; com folga pequena confirma, "Sim" abre e "Não" mostra a lista; assunto de outro treinador vira atalho', () => {
  const ctx = ctxDe(ADULTO, TER, 'treinador');
  const d = M.limparPasso(M.responder('não vou conseguir treinar hoje', 'treinador', ctx));
  assert.equal(d.texto[0], 'Tudo bem. O que aconteceu?');
  assert.equal(d.assunto, 'treino-perdido');
  const cc = ctxDe(ADULTO, TER, 'corrida');
  const p = M.limparPasso(M.responder('posso acelerar o ritmo hoje?', 'corrida', cc));
  assert.match(p.texto[0], /^Você quer falar sobre correr mais rápido ou mais longe\?$/);
  // "Sim", os outros assuntos próximos (outro caminho sem voltar à lista) e "Outra coisa"
  assert.equal(p.opcoes[0].rotulo, 'Sim');
  assert.equal(p.opcoes[p.opcoes.length - 1].valor, 'nao');
  assert.ok(p.opcoes.some((o) => o.valor === 'ritmo'), JSON.stringify(p.opcoes));
  assert.equal(M.seguir(p, 'ritmo', cc).assunto, 'ritmo');
  assert.equal(M.seguir(p, 'sim', cc).assunto, 'mais-rapido');
  const nao = M.seguir(p, 'nao', cc);
  assert.ok(nao.opcoes.length >= 2 && nao.opcoes.length <= 6);
  // "choveu" no chat do Treinador leva ao chat da corrida
  const outro = M.limparPasso(M.responder('choveu e não dá pra correr', 'treinador', ctx));
  assert.ok(outro.ir && outro.ir[0].rota === 'chat/corrida', JSON.stringify(outro));
  // dúvida vaga: os assuntos mais próximos (até 3) e "Ver todos os assuntos"
  const vago = M.limparPasso(M.responder('treino', 'treinador', ctx));
  assert.ok(vago.opcoes && vago.opcoes.length <= 6);
});

// ---------- sinais de alerta ----------
test('sinais de alerta: param a conversa em qualquer chat e vêm antes do assunto', () => {
  const sim = ['senti uma dor no peito correndo', 'to com falta de ar', 'quase desmaiei no treino', 'fiquei tonto na esteira', 'meu coração disparou', 'estou com palpitação',
    'aperto no peito durante o treino', 'suando frio e enjoado', 'dor que vai pro braço esquerdo', 'não consigo respirar direito', 'tontura forte depois do agachamento', 'urina escura depois do treino',
    'Dor no peito', 'DOR NO PEITO!!', 'tô com uma dor forte no peito', 'nao aguento a dor no peito', 'nao sei se e dor no peito', 'palpitaçao', 'desmaiei'];
  for (const coach of ['treinador', 'corrida', 'nutri']) {
    for (const t of sim) {
      const p = M.limparPasso(M.responder(t, coach, ctxDe(ADULTO, TER, coach)));
      assert.ok(p.aviso && p.aviso.tipo === 'danger', `sem alerta para "${t}" em ${coach}`);
      if (!/urina/.test(t)) {
        assert.match(p.aviso.texto, /Pare o exercício agora e procure atendimento\. Em emergência, ligue 192 \(SAMU\)\./);
        assert.deepEqual(p.refs, ['ms_infarto', 'whitfield2017']);
      } else assert.deepEqual(p.refs, ['cdc_rabdo']);
      assert.ok(!p.acoes, 'alerta não oferece ação de treino');
    }
  }
  const nao = ['não estou com dor no peito', 'sem falta de ar', 'nao tive tontura', 'hoje é treino de peito', 'me conta uma piada', 'quanto peso no supino', 'nunca desmaiei', 'não tenho palpitação'];
  for (const t of nao) assert.equal(M.sinalDeAlerta(t), null, `alerta indevido: "${t}"`);
  // o alerta físico vem antes do assunto reconhecido ("dor no peito" também é "dor")
  const p = M.limparPasso(M.responder('estou com dor no peito, posso treinar?', 'treinador', ctxDe(ADULTO, TER, 'treinador')));
  assert.ok(p.aviso.tipo === 'danger' && !/Entendi que/.test(p.texto.join(' ')));
  // "Estou bem" volta aos assuntos
  assert.ok(M.seguir(p, 'voltar', ctxDe(ADULTO, TER, 'treinador')).opcoes.length >= 2);
});
test('sinais de risco da Nutricionista também valem nos chats dos treinadores (e o físico vem primeiro)', () => {
  const p = M.limparPasso(M.responder('tenho vomitado depois de comer para emagrecer', 'treinador', ctxDe(ADULTO, TER, 'treinador')));
  assert.ok(/Obrigado por me contar/.test(p.texto.join(' ')), JSON.stringify(p.texto));
  const f = M.limparPasso(M.responder('quero morrer e estou com dor no peito', 'corrida', ctxDe(ADULTO, TER, 'corrida')));
  assert.match(f.aviso.texto, /192/);
});

// ---------- cada assunto até o fim, em todos os perfis ----------
test('cada assunto, percorrido até o fim em perfis variados e em todos os dias da semana, segue o contrato e as regras', () => {
  let passos = 0;
  for (const [nome, mk] of Object.entries(PERFIS)) {
    const st = mk();
    for (const hoje of SEMANA) {
      for (const coach of ['treinador', 'corrida']) {
        const ctx = ctxDe(st, hoje, coach);
        // a abertura
        const s = M.saudacao(coach, ctx);
        confere(s, `${nome} ${hoje} saudação ${coach}`);
        for (const i of M.assuntos(coach, ctx)) {
          const raiz = i.inicio(ctx);
          const tudo = percorrer(raiz, ctx);
          for (const { p, caminho } of tudo) {
            const onde = `${nome} ${hoje} ${i.id}${caminho}`;
            confere(p, onde);
            passos++;
            if (BLOQUEADOS.has(nome) && SEM_TREINO_NO_BLOQUEIO.has(i.id)) {
              assert.ok(p.aviso && p.aviso.tipo === 'danger' && !p.acoes && !p.opcoes, 'triagem bloqueada, mas o chat sugeriu treino: ' + onde);
            }
            for (const a of p.acoes || []) {
              // "Só hoje" (uma troca ou o ajuste da dor) começa o treino com a mudança; as outras, a versão curta
              if (a.iniciar) (a.rotulo === 'Só hoje' ? confereTrocaHoje : confereVersaoCurta)(st, a.iniciar, onde);
              if (a.aplicar) confereAcao(st, a, ctx, onde);
            }
          }
        }
      }
    }
  }
  assert.ok(passos > 2000, 'passos percorridos: ' + passos);
});
// "Só hoje" depois de uma troca: o mesmo treino, na mesma ordem, cada exercício trocado com as séries, repetições e
// descanso do que saiu (nada a mais), e só exercícios do catálogo
function confereTrocaHoje(st, ini, onde) {
  const dia = st.plans[0].dias.find((d) => d.id === ini.diaId);
  assert.ok(dia && ini.planId === 'p1' && ini.itens.length >= 1 && ini.itens.length <= dia.itens.length, onde);
  const orig = new Map(dia.itens.map((it) => [it.ex, it]));
  const sairam = dia.itens.filter((it) => !ini.itens.some((x) => x.ex === it.ex));
  for (const it of ini.itens) {
    assert.ok(EX_POR_ID.has(it.ex), 'fora do catálogo: ' + onde);
    const o = orig.get(it.ex) || sairam.find((s) => s.series >= it.series && s.reps === it.reps && s.descanso === it.descanso);
    assert.ok(o, 'exercício a mais: ' + onde);
    assert.ok(it.series <= o.series && it.reps === o.reps && it.descanso === o.descanso, 'dose mudou na troca: ' + onde);
  }
}
function confereVersaoCurta(st, ini, onde) {
  const dia = st.plans[0].dias.find((d) => d.id === ini.diaId);
  assert.ok(dia && ini.planId === 'p1', onde);
  const orig = new Map(dia.itens.map((it) => [it.ex, it]));
  assert.ok(ini.itens.length >= Math.min(3, dia.itens.filter((it) => (EX_POR_ID.get(it.ex) || {}).padrao !== 'cardio').length), 'menos de 3 exercícios: ' + onde);
  let ultimo = -1;
  for (const it of ini.itens) {
    const o = orig.get(it.ex);
    assert.ok(o, 'exercício que não estava no treino: ' + onde);
    assert.ok(it.series >= 1 && it.series <= o.series, 'séries a mais: ' + onde);
    assert.equal(it.reps, o.reps, 'repetições mudaram: ' + onde);
    assert.equal(it.descanso, o.descanso, 'descanso mudou: ' + onde);
    const k = dia.itens.findIndex((x) => x.ex === it.ex);
    assert.ok(k > ultimo, 'ordem mudou: ' + onde);
    ultimo = k;
  }
}
// Confere uma ação: aplicada numa cópia do estado em que foi oferecida, ela vale (não devolve false) e muda só o que diz:
// uma marca de logic/perdido.js (igual à que a regra gera), um exercício do plano, "Minha academia" ou a esteira.
function confereAcao(st, a, ctx, onde) {
  const s = J(st);
  const r = a.aplicar(s, { ...ctx, st: s, data: a.data || ctx.hoje });
  assert.notEqual(r, false, 'a ação não se aplicou no estado em que foi oferecida: ' + onde);
  const novas = s.perdidos.filter((x) => !st.perdidos.some((y) => JSON.stringify(y) === JSON.stringify(x)));
  if (novas.length) {
    assert.equal(novas.length, 1, onde);
    const m = novas[0];
    // marca válida (passa pela mesma limpeza do estado)
    assert.deepEqual(P.limparPerdidos(s.perdidos), s.perdidos, 'marca inválida: ' + onde);
    if (m.tipo === 'musculacao') {
      // o motivo e o dia escolhidos vão na marca; a regra (propor com o dia) tem de chegar à mesma mudança
      const esperado = P.novaMarca(st, m.data, ctx.hoje, m.movs.length ? 'mover' : 'seguir', m.em, { futuro: m.data > ctx.hoje, motivo: m.motivo, para: m.movs.length ? m.movs[0].para : '' });
      assert.deepEqual(m, esperado, onde);
    } else if (m.tipo === 'troca') assert.ok(P.avaliarTroca(st, m.de, m.data, ctx.hoje).pode, 'troca contra a regra: ' + onde);
    else if (m.para) assert.ok(P.avaliarMoverCorrida(st, m.data, m.para, ctx.hoje).pode, 'corrida mudada contra a regra: ' + onde);
    else assert.ok(P.podeMarcarCorrida(st, m.data, ctx.hoje), onde);
    // a semana depois da marca: só treinos do plano, um por dia
    const sem = P.semanaEfetiva(s.plans[0], s.perdidos, P.segundaDe(ctx.hoje));
    assert.ok(sem.every((d) => !d.diaId || s.plans[0].dias.some((x) => x.id === d.diaId)), onde);
    confereSemana(s, ctx.hoje, onde);
    return;
  }
  const mudouPlano = JSON.stringify(s.plans) !== JSON.stringify(st.plans);
  const mudouGym = JSON.stringify(s.gym) !== JSON.stringify(st.gym);
  const mudouEsteira = JSON.stringify(s.run && s.run.esteira) !== JSON.stringify(st.run && st.run.esteira);
  assert.ok(mudouPlano || mudouGym || mudouEsteira || JSON.stringify(s) !== JSON.stringify(st), 'a ação não mudou nada: ' + onde);
  if (mudouPlano) {
    // trocou um exercício do plano: a mesma dose, só exercícios que existem
    const a0 = st.plans[0].dias.flatMap((d) => d.itens), a1 = s.plans[0].dias.flatMap((d) => d.itens);
    assert.equal(a0.length, a1.length, onde);
    a1.forEach((it, k) => { assert.ok(EX_POR_ID.has(it.ex), onde); assert.equal(it.series, a0[k].series, onde); assert.equal(it.reps, a0[k].reps, onde); });
  }
  if (mudouGym) assert.equal(s.gym.all, false, onde);
}
// Regras da semana depois de qualquer ação: nenhum dia de musculação em dia que a pessoa não treina (exceto o que já
// estava lá), e o mesmo grupo pesado nunca em dois dias seguidos por mudança do chat
function confereSemana(s, hoje, onde) {
  const plan = s.plans[0];
  const sem = P.semanaEfetiva(plan, s.perdidos, P.segundaDe(hoje));
  for (let k = 0; k < 6; k++) {
    const a = sem[k], b = sem[k + 1];
    if (!(a.veioDe || b.veioDe) || !a.diaId || !b.diaId) continue;
    const da = plan.dias.find((x) => x.id === a.diaId), db = plan.dias.find((x) => x.id === b.diaId);
    assert.ok(!P.choca(P.cargaDoTreino(da), P.cargaDoTreino(db)), 'mesmo músculo pesado em dias seguidos depois da mudança: ' + onde);
  }
}

// ---------- assuntos, um a um ----------
test('juntar corrida e musculação: o exemplo do dono, pela prioridade e pelo perfil', () => {
  const ctx = ctxDe(ADULTO, TER, 'treinador');
  // terça: corrida leve (regenerativo) e treino de pernas
  assert.ok(corridaDeHoje(ctx) && treinoDeHoje(ctx));
  const conf = M.limparPasso(M.responder('hoje de manhã eu tinha corrida no plano mas choveu; tenho musculação hoje também — posso fazer um seguido do outro e qual a recomendação de acordo com minhas prioridades e meu perfil?', 'treinador', ctx));
  const p = /^Você quer falar/.test(conf.texto[0]) ? M.seguir(conf, 'sim', ctx) : conf;
  const txt = p.texto.join(' ');
  // "um seguido do outro": responde sobre o intervalo curto (Schumann 2022; Petré 2021), em duas frases
  assert.match(txt, /^Pode\. A ordem tanto faz/);
  assert.match(txt, /menos de 3 horas entre os dois, o segundo treino rende um pouco menos/);
  assert.ok(p.texto.length <= 2);
  assert.ok(p.detalhes.some((d) => /20 minutos/.test(d)) && p.detalhes.some((d) => /Massa muscular e força máxima/.test(d)));
  // sem intervalo dito: a ordem e de 3 a 6 horas entre os dois; a prioridade vai para "Por quê?"
  const sem = M.limparPasso(M.responder('posso fazer corrida e musculação no mesmo dia?', 'treinador', ctx));
  assert.match(sem.texto.join(' '), /de 3 a 6 horas entre os dois/);
  assert.ok(sem.detalhes.some((d) => /Sua prioridade: os dois por igual\./.test(d)));
  // a pergunta do dono: menos de 1 hora entre os dois, nos dois treinadores
  for (const coach of ['treinador', 'corrida']) {
    const q = M.limparPasso(M.responder('posso correr e fazer os exercícios de hoje com o intervalor menor que 1 hora?', coach, ctxDe(ADULTO, TER, coach)));
    assert.equal(q.assunto, coach === 'corrida' ? 'juntar-corrida' : 'juntar-treino', coach);
    assert.match(q.texto.join(' '), /menos de 3 horas/);
  }
  for (const k of ['eddens2018', 'petre2021', 'methenitis2018']) assert.ok(p.refs.includes(k), k);
  // prioridade na musculação: musculação primeiro
  const m = M.iniciar('juntar-treino', ctxDe(PERFIS.focoMusculacao(), TER, 'treinador'));
  assert.match(m.texto.join(' '), /Comece pela musculação\./);
  // sem prioridade escolhida: pergunta e oferece guardar
  const sf = M.iniciar('juntar-treino', ctxDe(PERFIS.semFoco(), TER, 'treinador'));
  assert.equal(sf.texto[0], 'O que vem primeiro para você?');
  const c = M.seguir(sf, 'corrida', ctxDe(PERFIS.semFoco(), TER, 'treinador'));
  assert.ok(c.ir.some((x) => x.abrir === 'combinado'));
  // segunda: corrida forte (fartlek) e treino de superiores: corra primeiro
  const seg = M.iniciar('juntar-treino', ctxDe(ADULTO, '2026-11-16', 'treinador'));
  assert.match(seg.texto.join(' '), /Comece pela corrida/);
  // novato com pernas no dia da corrida: aviso das 48 horas
  const nov = M.iniciar('juntar-treino', ctxDe(PERFIS.novato(), TER, 'treinador'));
  assert.ok(nov.aviso && /48 horas/.test(nov.aviso.texto) && nov.refs.includes('doma2017'));
  // gestação: intensidade em que dá para conversar
  const g = M.iniciar('juntar-treino', ctxDe(PERFIS.gestante(), TER, 'treinador'));
  if (g.texto.some((t) => /6 horas/.test(t))) assert.ok(g.aviso && /gestação/.test(g.aviso.texto));
});
test('pouco tempo: versão curta sem subir nada, mantendo os compostos e os músculos em prioridade', () => {
  for (const d of PLANO.dias) {
    const antes = duracaoEstimada(d);
    for (const min of [20, 30, 45]) {
      const r = versaoCurta(d.itens, min, perfil(TREINO));
      assert.ok(r.minutos <= antes && (r.cabe || r.itens.length <= 3 || r.itens.every((it) => it.series === 1)), `${d.nome} em ${min}: ${r.minutos}`);
      const compostosAntes = d.itens.filter((it) => EX_POR_ID.get(it.ex).tipo === 'composto').map((it) => it.ex);
      const ficou = new Set(r.itens.map((it) => it.ex));
      // isolados saem antes de qualquer composto
      if (compostosAntes.some((x) => !ficou.has(x))) assert.ok(r.itens.every((it) => EX_POR_ID.get(it.ex).tipo === 'composto' || EX_POR_ID.get(it.ex).padrao === 'cardio'), `${d.nome} ${min}: composto saiu antes de isolado`);
    }
  }
  // prioridade: com foco em bíceps, o isolado de bíceps é o último isolado a sair
  const it = (ex, series = 3) => ({ ex, series, reps: '10-12', descanso: 60, nota: '' });
  const dia = [it('supino-reto-barra'), it('remada-curvada-barra'), it('agachamento-livre'), it('rosca-direta-barra'), it('triceps-polia-corda'), it('elevacao-lateral-halteres')].filter((x) => EX_POR_ID.has(x.ex));
  if (dia.length === 6) {
    const r = versaoCurta(dia, 20, { ...perfil(TREINO), foco: ['biceps'] });
    const ids = r.itens.map((x) => x.ex);
    if (ids.length > 3) assert.ok(ids.includes('rosca-direta-barra'), ids.join());
  }
  // a ação começa o treino de hoje com a versão curta, sem mudar o plano
  const ctx = ctxDe(ADULTO, TER, 'treinador');
  const p = M.seguir(M.iniciar('pouco-tempo', ctx), 30, ctx);
  assert.ok(p.acoes[0].iniciar && /plano não muda/.test(p.acoes[0].confirmar));
  assert.ok(p.refs.includes('iversen2021'));
  // idoso: lembra o cardio leve antes (o aquecimento que o app já recomenda)
  const ci = ctxDe(PERFIS.idoso(), TER, 'treinador');
  const pi = M.seguir(M.iniciar('pouco-tempo', ci), 30, ci);
  assert.ok(pi.aviso && /cardio leve/.test(pi.aviso.texto));
});
test('treino perdido: as mesmas escolhas da folha "Não treinei" e aplicadas como a folha', () => {
  const ctx = ctxDe(ADULTO, TER, 'treinador');
  const p = M.seguir(M.iniciar('treino-perdido', ctx), 'outro', ctx);
  const prop = P.propor(ADULTO, TER, TER);
  assert.ok(p.texto.includes(prop.titulo));
  assert.equal(p.acoes.length, prop.movs.length ? 2 : 1);
  const s = J(ADULTO);
  p.acoes[0].aplicar(s, { ...ctx, st: s });
  const sem = P.semanaEfetiva(s.plans[0], s.perdidos, P.segundaDe(TER));
  assert.ok(sem.find((d) => d.data === TER).perdido);
  // aplicar de novo (estado já mudou): não dá, e a tela avisa
  assert.equal(p.acoes[0].aplicar(s, { ...ctx, st: s }), false);
  // doente: a orientação de não treinar com febre vem antes
  const d = M.seguir(M.iniciar('treino-perdido', ctx), 'doente', ctx);
  assert.match(d.texto[0], /não treine hoje/);
  // cansaço com noite curta registrada: mostra a noite e a meta
  const st = estado({ extra: { sono: { acordar: '', idade: 31, registros: [{ data: TER, horas: 5 }], cochilos: [] } } });
  const c = M.seguir(M.iniciar('treino-perdido', ctxDe(st, TER, 'treinador')), 'cansaco', ctxDe(st, TER, 'treinador'));
  assert.match(c.texto[0], /Você dormiu 5 h/);
});
test('chuva: esteira com a equivalência pesquisada, mais tarde (juntar) ou marcar como não feita', () => {
  const ctx = ctxDe(ADULTO, TER, 'corrida');
  const p = M.iniciar('chuva', ctx);
  assert.deepEqual(p.opcoes.map((o) => o.valor), ['esteira', 'tarde', 'mover', 'nao']);
  const e = M.seguir(p, 'esteira', ctx);
  assert.ok(e.refs.includes('miller2019') && /inclinação/i.test(e.texto.join(' ')));
  const forte = M.seguir(M.iniciar('chuva', ctxDe(ADULTO, '2026-11-16', 'corrida')), 'esteira', ctxDe(ADULTO, '2026-11-16', 'corrida'));
  assert.match(forte.texto.join(' '), /1%/);
  assert.match(M.seguir(p, 'tarde', ctx).texto.join(' '), /6 horas/);
  const n = M.seguir(p, 'nao', ctx);
  assert.ok(n.refs.includes('frandsen2025'));
  const s = J(ADULTO);
  n.acoes[0].aplicar(s, { ...ctx, st: s });
  assert.ok(P.corridaPerdidaEm(s, TER));
  // dia sem corrida: nada a decidir
  const q = M.iniciar('chuva', ctxDe(ADULTO, '2026-11-18', 'corrida'));
  assert.ok(!q.opcoes && /não tem corrida/.test(q.texto[0]));
});
test('carga: a dose do plano e a carga recomendada que o treino mostraria', () => {
  const ctx = ctxDe(ADULTO, TER, 'treinador');
  let p = M.iniciar('carga', ctx);
  assert.match(p.opcoes[0].rotulo, /\(hoje\)$/);
  p = M.seguir(p, p.opcoes[0].valor, ctx);
  const ex = p.opcoes[0].valor;
  const d = M.seguir(p, ex, ctx);
  assert.match(d.texto[0], /séries|×/);
  assert.ok(d.refs.includes('acsm2009') && d.ir[0].rota === 'exercicio/' + ex);
  // dor no joelho: o exercício que pega o joelho traz o aviso da dor
  const cj = ctxDe(PERFIS.dorJoelho(), TER, 'treinador');
  let pj = M.seguir(M.iniciar('carga', cj), M.iniciar('carga', cj).opcoes[0].valor, cj);
  const avisos = pj.opcoes.filter((o) => !o.valor.startsWith('#')).map((o) => M.seguir(pj, o.valor, cj)).filter((x) => x.aviso);
  assert.ok(avisos.length > 0, 'algum exercício de pernas com aviso de dor');
});
test('dor: orientação das dores contadas e o caminho para contar a dor', () => {
  const ctx = ctxDe(PERFIS.dorJoelho(), TER, 'treinador');
  const p = M.iniciar('dor-treino', ctx);
  assert.match(p.texto[0], /^Joelho: /);
  for (const v of ['muscular', 'articular', 'aguda']) {
    const q = M.seguir(p, v, ctx);
    assert.ok(q.ir.some((x) => x.abrir === 'contar-dor'), v);
  }
  assert.equal(M.seguir(p, 'aguda', ctx).aviso.tipo, 'warn');
  const c = M.iniciar('dor-corrida', ctxDe(PERFIS.dorJoelho(), TER, 'corrida'));
  assert.match(c.texto[0], /^Joelho: /);
});
test('mudar o plano: mostra o que muda antes e leva às telas que já existem', () => {
  const ctx = ctxDe(ADULTO, TER, 'treinador');
  const p = M.iniciar('mudar-plano', ctx);
  assert.equal(M.seguir(p, 'respostas', ctx).ir[0].abrir, 'treinador-entrevista');
  const t = M.seguir(p, 'trocas', ctx);
  assert.ok(/sai .+, entra /.test(t.texto.join(' ')) && t.ir[0].abrir === 'treinador-trocas');
  assert.equal(M.seguir(p, 'novo', ctx).ir[0].abrir, 'treinador-novo');
  const sem = M.iniciar('mudar-plano', ctxDe(store.sanitize({ v: store.VERSAO }), TER, 'treinador'));
  assert.equal(sem.ir[0].rota, 'treinador');
});
test('sem plano: os chats explicam o que falta e não inventam treino', () => {
  const vazio = store.sanitize({ v: store.VERSAO });
  const ctx = ctxDe(vazio, TER, 'treinador');
  assert.ok(M.assuntos('treinador', ctx).every((i) => ['mudar-plano', 'dor-treino', 'saude-fora-treino'].includes(i.id)));
  const c = M.saudacao('corrida', ctxDe(vazio, TER, 'corrida'));
  assert.ok(c.opcoes.length >= 1);
  // sem corrida: os assuntos da corrida que dependem do plano somem
  assert.ok(!M.assuntos('corrida', ctxDe(PERFIS.soMusculacao(), TER, 'corrida')).some((i) => ['chuva', 'corrida-perdida', 'juntar-corrida'].includes(i.id)));
  assert.ok(!M.assuntos('treinador', ctxDe(PERFIS.soMusculacao(), TER, 'treinador')).some((i) => i.id === 'juntar-treino'));
});
test('passo limpo: nada fora do contrato chega à tela', () => {
  assert.equal(M.limparPasso(null), null);
  assert.equal(M.limparPasso({ texto: [] }), null);
  const p = M.limparPasso({ texto: ['a', 3, ''], refs: ['acsm2009', 'naoexiste'], opcoes: [{ rotulo: 'x', valor: 1 }], ir: [{ rotulo: 'r' }], acoes: [{ rotulo: 'sem nada', confirmar: 'x' }] });
  assert.deepEqual(p.texto, ['a']);
  assert.deepEqual(p.refs, ['acsm2009']);
  assert.ok(!p.opcoes && !p.ir && !p.acoes);
  // um assunto que quebra vira uma resposta curta, não uma tela quebrada
  assert.ok(M.iniciar('nao-existe', ctxDe(ADULTO, TER, 'treinador')).texto[0].length > 10);
  assert.ok(M.seguir({ proximo: () => { throw new Error('x'); } }, 1, {}).texto[0].length > 10);
});
test('fontes novas: Miller 2019 lida em texto completo e citada numa pergunta frequente', () => {
  assert.match(textoDaRef('miller2019'), /Sports Med\. 2019;49\(5\):763-782/);
  assert.ok(respostasCompletas(TREINO));
});

// ---------- conversa normal: corpus de frases reais, datas, continuação, dois assuntos e segurança ----------
// O assunto a que a resposta leva: direto, ou depois do "Sim" da confirmação ('' = nenhum assunto: alerta, "não achei"...)
function assuntoDe(texto, coach, st = ADULTO, hoje = TER, memoria = null, aberto = null) {
  const ctx = { ...ctxDe(st, hoje, coach), memoria, aberto };
  let p = M.responder(texto, coach, ctx);
  const confirmou = !!(p.texto && /^(Entendi que você quer|Você quer falar sobre)/.test(p.texto[0]));
  if (confirmou) p = M.seguir(p, 'sim', { ...ctx, memoria: p.memoria });
  return { id: (p && p.assunto) || '', p, confirmou };
}
const SAUDE_T = M.intencaoPorId('saude-fora-treino') ? 'saude-fora-treino' : 'treino-perdido';
const SAUDE_C = M.intencaoPorId('saude-fora-corrida') ? 'saude-fora-corrida' : 'corrida-perdida';
// [frase, assunto esperado]; frases de pessoas comuns, com gíria, erro de digitação e sem acento
const CORPUS = {
  treinador: [
    ['hoje nao vou conseguir ir na academia', 'treino-perdido'], ['não vou poder treinar hoje, tenho um compromisso', 'treino-perdido'], ['vou faltar hoje', 'treino-perdido'],
    ['hj nao vai dar pra malhar', 'treino-perdido'], ['sexta não vou poder ir', 'treino-perdido'], ['amanhã não consigo ir na academia', 'treino-perdido'],
    ['to cansadão hoje', 'treino-perdido'], ['dormi mal, acho que nao vou treinar', 'treino-perdido'], ['tive um imprevisto e não vou conseguir ir', 'treino-perdido'],
    ['nao treinei ontem', 'treino-perdido'], ['quinta não vou conseguir ir', 'treino-perdido'], ['nao vou consegui treina hj', 'treino-perdido'], ['vou viajar no fim de semana', 'treino-perdido'],
    ['só tenho 20 minutos', 'pouco-tempo'], ['tô com pressa hoje', 'pouco-tempo'], ['da pra fazer um treino mais curto?', 'pouco-tempo'], ['tenho meia hora so', 'pouco-tempo'],
    ['preciso encurtar o treino hoje', 'pouco-tempo'], ['tempo apertado hoje', 'pouco-tempo'],
    ['qual é o meu treino hoje?', 'qual-treino'], ['qual o treino de amanhã', 'qual-treino'], ['o que eu treino na quinta?', 'qual-treino'], ['que treino tem na sexta', 'qual-treino'],
    ['quais exercícios eu faço hoje', 'qual-treino'], ['tenho treino amanha?', 'qual-treino'], ['qual treino segunda que vem', 'qual-treino'], ['qual a ficha de hoje', 'qual-treino'],
    ['quanto tempo dura o treino de hoje?', 'duracao'], ['quanto tempo leva o treino', 'duracao'], ['o treino de quinta demora quanto?', 'duracao'], ['quantos minutos tem o treino', 'duracao'],
    ['como fica a minha semana?', 'semana'], ['me mostra a agenda da semana', 'semana'], ['quais dias eu treino?', 'semana'], ['como fica a semana que vem', 'semana'], ['o que tenho essa semana', 'semana'],
    ['posso fazer o treino de amanhã hoje?', 'antecipar'], ['da pra adiantar o treino de quinta?', 'antecipar'], ['quero antecipar o treino de sexta', 'antecipar'], ['posso puxar o treino de quinta pra hoje', 'antecipar'],
    ['posso treinar dois dias seguidos?', 'seguidos'], ['tudo bem treinar todo dia?', 'seguidos'], ['pode treinar dias consecutivos?', 'seguidos'], ['quantos dias de descanso entre treinos', 'seguidos'],
    ['posso correr depois da academia?', 'juntar-treino'], ['faço a corrida antes ou depois da musculação?', 'juntar-treino'],
    ['quantos quilos coloco no agachamento?', 'carga'], ['tá muito leve o supino', 'carga'], ['quantas séries de leg press', 'carga'], ['quanto descanso entre as series', 'carga'], ['quando eu aumento o peso?', 'carga'], ['ta facil demais, posso pegar mais peso?', 'carga'],
    ['minha academia não tem cadeira extensora', 'aparelho-falta'], ['não tem peck deck na minha academia', 'aparelho-falta'], ['esse aparelho não tem aqui', 'aparelho-falta'], ['o graviton tá quebrado', 'aparelho-falta'],
    ['a polia está em manutenção', 'aparelho-falta'], ['minha academia nao tem leg press', 'aparelho-falta'],
    ['o aparelho tá ocupado', 'aparelho-ocupado'], ['academia lotada hoje', 'aparelho-ocupado'], ['tem fila no aparelho', 'aparelho-ocupado'], ['tem gente usando o aparelho', 'aparelho-ocupado'],
    ['quero mudar o treino', 'mudar-plano'], ['o que posso mudar no meu treino?', 'mudar-plano'], ['quero treinar em casa', 'mudar-plano'], ['enjoei da ficha', 'mudar-plano'], ['quero mudar a ordem dos exercícios', 'mudar-plano'], ['quero trocar um exercicio', 'mudar-plano'],
    ['meu joelho tá doendo', 'dor-treino'], ['estou com dor nas costas', 'dor-treino'], ['sinto uma fisgada no ombro', 'dor-treino'], ['dor no cotovelo quando faço rosca', 'dor-treino'], ['acordei todo dolorido', 'dor-treino'], ['meu ombro ta doendu', 'dor-treino'],
    ['estou com febre', SAUDE_T],
  ],
  corrida: [
    ['tá chovendo muito', 'chuva'], ['choveu, e agora?', 'chuva'], ['tempo ruim hoje pra correr', 'chuva'], ['ta muito frio pra correr na rua', 'chuva'], ['vai chover amanhã, o que faço?', 'chuva'],
    ['posso correr na esteira?', 'esteira'], ['qual inclinação usar na esteira', 'esteira'], ['esteira vale igual a rua?', 'esteira'], ['quero fazer na esteira amanhã', 'esteira'], ['que velocidade coloco na esteira', 'esteira'],
    ['qual minha corrida hoje?', 'corrida-dia'], ['o que tenho de corrida amanhã', 'corrida-dia'], ['quantos km corro no sábado', 'corrida-dia'], ['qual o treino de quinta', 'corrida-dia'], ['tenho corrida hoje?', 'corrida-dia'], ['quanto tempo dura a corrida de hoje', 'corrida-dia'],
    ['qual meu pace hoje', 'ritmo'], ['qual ritmo devo correr', 'ritmo'], ['em que ritmo eu corro amanhã', 'ritmo'], ['qual minha frequencia cardiaca no treino', 'ritmo'], ['quantos minutos por km', 'ritmo'], ['qual o pace de quinta?', 'ritmo'],
    ['posso correr mais rápido?', 'mais-rapido'], ['quero aumentar o ritmo', 'mais-rapido'], ['tá muito fácil, posso aumentar?', 'mais-rapido'], ['quero correr mais km', 'mais-rapido'], ['posso acelerar no regenerativo?', 'mais-rapido'], ['quero ficar mais rapido', 'mais-rapido'],
    ['posso ir mais devagar?', 'mais-devagar'], ['tá muito pesado', 'mais-devagar'], ['não aguentei, posso diminuir?', 'mais-devagar'], ['estou sem fôlego nos treinos', 'mais-devagar'], ['posso correr menos hoje', 'mais-devagar'], ['to cansado posso reduzir', 'mais-devagar'],
    ['posso mudar a corrida para amanhã?', 'mover-corrida'], ['posso passar a corrida de quinta para sexta?', 'mover-corrida'], ['posso correr sexta em vez de quinta?', 'mover-corrida'], ['quero adiar a corrida', 'mover-corrida'],
    ['da pra correr outro dia?', 'mover-corrida'], ['deixar a corrida pra amanhã', 'mover-corrida'], ['posso mudar a corrida de dia?', 'mover-corrida'],
    ['como fica minha semana', 'semana-corrida'], ['como fica a semana que vem', 'semana-corrida'], ['quais dias eu corro', 'semana-corrida'], ['me mostra o calendario', 'semana-corrida'],
    ['não vou correr hoje', 'corrida-perdida'], ['hoje não consigo correr', 'corrida-perdida'], ['sexta não vou poder correr', 'corrida-perdida'], ['não vai dar pra correr hoje', 'corrida-perdida'], ['nao corri sabado passado', 'corrida-perdida'],
    ['estou com dor na canela', 'dor-corrida'], ['dor no joelho quando corro', 'dor-corrida'], ['minha panturrilha está doendo', 'dor-corrida'], ['senti uma fisgada no pé', 'dor-corrida'],
    ['posso correr e fazer musculação no mesmo dia', 'juntar-corrida'], ['corro antes ou depois da musculação?', 'juntar-corrida'],
    ['quero mudar os dias da corrida', 'mudar-corrida'], ['quero mudar meu objetivo', 'mudar-corrida'], ['quero pausar o plano', 'mudar-corrida'], ['vou fazer uma nova prova', 'mudar-corrida'],
    ['estou gripado', SAUDE_C],
  ],
  nutri: [
    ['o que eu como hoje?', 'nutri-cardapio'], ['qual o cardápio de amanhã', 'nutri-cardapio'], ['o que almoçar hoje?', 'nutri-cardapio'], ['o que vou comer amanha', 'nutri-cardapio'],
    ['quero trocar o almoço', 'nutri-trocar'], ['não gosto de peixe, posso trocar?', 'nutri-trocar'], ['acabou o ovo aqui em casa', 'nutri-trocar'],
    ['exagerei no fim de semana', 'nutri-exagerei'], ['comi pizza ontem', 'nutri-exagerei'], ['chutei o balde', 'nutri-exagerei'], ['jaquei feio', 'nutri-exagerei'],
    ['quanta proteína eu preciso?', 'nutri-metas'], ['quanta água devo beber', 'nutri-metas'], ['quantas refeições por dia', 'nutri-metas'], ['quantos litros de agua', 'nutri-metas'],
    ['posso comer pão francês?', 'nutri-alimento'], ['tapioca engorda?', 'nutri-alimento'], ['cuscuz é saudável?', 'nutri-alimento'], ['refrigerante faz mal?', 'nutri-alimento'],
    ['o que comer antes do treino?', 'nutri-treino'], ['o que comer depois de malhar', 'nutri-treino'], ['posso treinar em jejum?', 'nutri-treino'],
    ['creatina faz mal?', 'nutri-suplementos'], ['devo tomar whey?', 'nutri-suplementos'], ['cafeína ajuda?', 'nutri-suplementos'],
    ['vou comer fora hoje', 'nutri-pratico'], ['estou sem fome', 'nutri-pratico'], ['sem tempo pra cozinhar', 'nutri-pratico'],
    ['quero refazer o plano', 'nutri-plano'], ['meu peso mudou', 'nutri-plano'],
  ],
};
// Mais três levas de frases, escritas depois da primeira. A 2ª e a 3ª foram medidas ANTES de qualquer ajuste do
// vocabulário (frases nunca vistas): 66% e 77,6% de acerto; a 4ª, por último, também antes de ajustar: 80%. Depois
// de cada medição, o vocabulário foi ampliado e as frases entraram aqui, para não regredir.
const LEVA2 = {
  treinador: [['amanha nao rola treinar', 'treino-perdido'], ['acho que hoje vou furar o treino', 'treino-perdido'], ['nao to afim de treinar hoje', 'treino-perdido'], ['quarta eu trabalho ate tarde, nao vou conseguir ir', 'treino-perdido'],
    ['tenho uns 25 min so', 'pouco-tempo'], ['to atrasado, da pra encurtar?', 'pouco-tempo'],
    ['o que tem pra hoje no treino?', 'qual-treino'], ['qual treino eu faço sabado', 'qual-treino'], ['hoje é treino de perna?', 'qual-treino'],
    ['quanto tempo vou ficar na academia hoje', 'duracao'], ['o treino demora muito?', 'duracao'],
    ['como ficou minha semana de treino', 'semana'], ['quero ver a semana toda', 'semana'],
    ['da pra fazer o de sexta amanhã?', 'antecipar'], ['posso adiantar o treino?', 'antecipar'],
    ['posso malhar todos os dias?', 'seguidos'], ['é ruim treinar perna dois dias seguidos?', 'seguidos'],
    ['quanto peso eu ponho na rosca', 'carga'], ['quantas repetições no supino', 'carga'], ['posso aumentar a carga?', 'carga'],
    ['na minha academia não tem graviton', 'aparelho-falta'], ['a maquina de rosca quebrou', 'aparelho-falta'],
    ['ta cheio de gente no aparelho', 'aparelho-ocupado'],
    ['queria outro treino', 'mudar-plano'], ['posso trocar o dia do treino?', 'mudar-plano'],
    ['to com o ombro doendo desde ontem', 'dor-treino'], ['machuquei o joelho', 'dor-treino']],
  corrida: [['ta caindo um toró aqui', 'chuva'], ['ta chovendo, corro onde?', 'chuva'],
    ['quanto corro hoje?', 'corrida-dia'], ['qual a distancia de sabado', 'corrida-dia'],
    ['qual velocidade devo correr hoje', 'ritmo'], ['meu pace ta certo?', 'ritmo'],
    ['posso puxar mais no treino?', 'mais-rapido'], ['queria aumentar a distancia', 'mais-rapido'],
    ['posso fazer mais leve hoje?', 'mais-devagar'], ['to sem gás, posso ir devagar?', 'mais-devagar'],
    ['posso trocar a corrida de quinta pra sabado?', 'mover-corrida'], ['da pra jogar a corrida pra sexta?', 'mover-corrida'],
    ['hoje nao vou correr nao', 'corrida-perdida'], ['amanhã não dá pra correr', 'corrida-perdida'],
    ['to com dor no pé', 'dor-corrida'], ['dói a canela quando corro', 'dor-corrida'],
    ['como ficou a semana da corrida', 'semana-corrida'], ['esteira tem que por inclinação?', 'esteira']],
  nutri: [['o que eu janto hoje?', 'nutri-cardapio'], ['quanto de proteina eu como', 'nutri-metas'], ['pode comer ovo todo dia?', 'nutri-alimento'], ['whey é bom?', 'nutri-suplementos'],
    ['enfiei o pé na jaca ontem', 'nutri-exagerei'], ['o que como antes de correr', 'nutri-treino'], ['nao gosto do jantar, troca?', 'nutri-trocar'], ['vou almoçar no restaurante', 'nutri-pratico']],
};
const LEVA3 = {
  treinador: [['nao vou dar conta de ir hoje', 'treino-perdido'], ['sabado eu viajo, sem treino', 'treino-perdido'], ['nao consegui ir ontem', 'treino-perdido'], ['hoje to só o pó', 'treino-perdido'],
    ['tenho só uns 15 min', 'pouco-tempo'], ['preciso de um treino rapidinho', 'pouco-tempo'],
    ['quinta é treino de quê?', 'qual-treino'], ['me fala o treino de amanha', 'qual-treino'], ['o que vou treinar sexta', 'qual-treino'],
    ['o treino de hoje leva quanto tempo?', 'duracao'],
    ['como ta minha semana', 'semana'], ['quais os treinos da semana', 'semana'],
    ['posso treinar hoje o treino de quinta', 'antecipar'],
    ['tem problema treinar todo dia?', 'seguidos'], ['preciso descansar entre um treino e outro?', 'seguidos'],
    ['quantas series eu faço', 'carga'], ['que carga uso no leg', 'carga'], ['ta pesado demais o agachamento', 'carga'],
    ['aqui não tem leg press', 'aparelho-falta'], ['minha academia é pequena e não tem peck deck', 'aparelho-falta'],
    ['o aparelho que eu ia usar ta ocupado', 'aparelho-ocupado'],
    ['quero um treino diferente', 'mudar-plano'], ['dá pra treinar em casa?', 'mudar-plano'],
    ['to com dor no punho', 'dor-treino'], ['minha lombar travou', 'dor-treino']],
  corrida: [['choveu demais hoje', 'chuva'], ['ta frio demais pra correr', 'chuva'],
    ['qual a corrida de amanha?', 'corrida-dia'], ['quantos quilometros tem o longao', 'corrida-dia'],
    ['qual pace do treino de hoje', 'ritmo'], ['quantos km por hora devo correr', 'ritmo'],
    ['quero correr mais rapido hoje', 'mais-rapido'], ['ta facil demais o treino', 'mais-rapido'],
    ['posso correr mais devagar hoje', 'mais-devagar'], ['to muito cansado pra esse ritmo', 'mais-devagar'],
    ['posso correr amanhã no lugar de hoje?', 'mover-corrida'], ['quero passar a corrida pra sexta', 'mover-corrida'],
    ['nao vou conseguir correr amanha', 'corrida-perdida'],
    ['meu joelho doi quando corro', 'dor-corrida'],
    ['qual inclinação eu ponho na esteira', 'esteira'], ['como fica a semana de corrida', 'semana-corrida']],
  nutri: [['o que como no café da manhã hoje', 'nutri-cardapio'], ['quanta agua eu tomo por dia', 'nutri-metas'], ['arroz engorda?', 'nutri-alimento'], ['cafeína faz mal?', 'nutri-suplementos'],
    ['exagerei no churrasco', 'nutri-exagerei'], ['o que comer antes de correr?', 'nutri-treino'], ['nao tenho fome de manha', 'nutri-pratico'], ['quero trocar o jantar de hoje', 'nutri-trocar']],
};
const LEVA4 = {
  treinador: [['bom dia, hoje infelizmente nao vou conseguir treinar', 'treino-perdido'], ['acho que vou pular a academia amanha', 'treino-perdido'], ['quero saber qual treino eu faço quinta feira', 'qual-treino'],
    ['tenho so 40 minutinhos hoje, da pra treinar?', 'pouco-tempo'], ['o supino ta leve, aumento?', 'carga'], ['qual o descanso da rosca', 'carga'], ['me mostra como ficou minha semana', 'semana'],
    ['a academia nova nao tem cadeira flexora', 'aparelho-falta'], ['to com uma dor chata no joelho', 'dor-treino'], ['posso fazer perna dois dias seguidos?', 'seguidos'],
    ['quero mudar meu treino todo', 'mudar-plano'], ['quanto tempo leva o treino de sexta', 'duracao'], ['da pra trazer o treino de quinta pra amanha?', 'antecipar'], ['o aparelho ta sempre ocupado', 'aparelho-ocupado']],
  corrida: [['ta chovendo forte, o que eu faço com a corrida de hoje?', 'chuva'], ['qual o meu ritmo no longão de sabado?', 'ritmo'], ['quanto tempo dura a corrida de quinta?', 'corrida-dia'],
    ['será que posso correr mais forte hoje?', 'mais-rapido'], ['to achando o treino muito puxado', 'mais-devagar'], ['posso fazer a corrida de hoje na quarta?', 'mover-corrida'],
    ['amanha nao vou poder correr', 'corrida-perdida'], ['minha canela ta doendo muito', 'dor-corrida'], ['vale a pena correr na esteira hoje?', 'esteira'], ['quero ver minha semana de treinos', 'semana-corrida']],
  nutri: [['oq eu como no almoço?', 'nutri-cardapio'], ['quanta proteina por dia eu tenho que comer', 'nutri-metas'], ['comi demais no aniversario', 'nutri-exagerei'], ['pao integral engorda?', 'nutri-alimento'], ['o que comer depois do treino', 'nutri-treino'], ['creatina vale a pena?', 'nutri-suplementos']],
};
for (const l of [LEVA2, LEVA3, LEVA4]) for (const [coach, lista] of Object.entries(l)) CORPUS[coach].push(...lista);
// fora do assunto: nunca um assunto com confiança (nem direto, nem "Entendi que...")
const FORA = ['qual a capital da França?', 'me conta uma piada', 'quanto custa um iPhone', 'quem ganhou o jogo de futebol ontem', 'que horas são', 'quem é você', 'me ajuda com matemática',
  'qual a melhor série da netflix', 'comprei um carro novo', 'qual o preço da gasolina', 'me recomenda um filme', 'como faço um bolo de chocolate', 'asdfgh qwerty', 'vou ao cinema sexta',
  'meu time perdeu de novo', 'quanto é dois mais dois', 'escreve um poema', 'previsão do tempo pra semana', 'kkkkkk'];

test('corpus: frases reais (gíria, erro de digitação, sem acento, com data) levam ao assunto certo; mede o acerto', () => {
  let total = 0, certo = 0, diretos = 0;
  const erros = [];
  for (const [coach, lista] of Object.entries(CORPUS)) {
    for (const [frase, id] of lista) {
      total++;
      const r = assuntoDe(frase, coach);
      if (r.id === id) { certo++; if (!r.confirmou) diretos++; } else erros.push(`${coach}: "${frase}" → ${r.id || '(nenhum)'} (esperado ${id})`);
    }
  }
  const taxa = certo / total;
  console.log(`  corpus: ${certo}/${total} certas (${Math.round(taxa * 1000) / 10}%), ${diretos} respondidas direto` + (erros.length ? '\n    ' + erros.join('\n    ') : ''));
  assert.ok(total >= 150, 'corpus pequeno: ' + total);
  assert.ok(taxa >= 0.9, `acerto abaixo de 90%: ${certo}/${total}`);
});
test('corpus: fora do assunto nunca sai com alta confiança, em nenhum treinador', () => {
  for (const coach of ['treinador', 'corrida', 'nutri']) {
    for (const t of FORA) {
      const r = M.entender(t, coach, ctxDe(ADULTO, TER, coach));
      assert.ok(!r.alerta && !r.direto, `"${t}" saiu direto em ${coach}`);
      const p = M.responder(t, coach, ctxDe(ADULTO, TER, coach));
      assert.ok(!p.assunto && !/Entendi que/.test(p.texto.join(' ')), `"${t}" (${coach}) virou assunto: ${p.assunto || p.texto[0]}`);
    }
  }
});

// ---------- datas ----------
test('datas: "amanhã", "ontem", "sexta", "no sábado", "semana que vem" viram o dia do assunto', () => {
  const casos = [['qual o treino de amanhã', '2026-11-18'], ['o que eu treino na quinta?', '2026-11-19'], ['que treino tem na sexta', '2026-11-20'], ['qual treino segunda que vem', '2026-11-23'], ['nao treinei ontem', '2026-11-16'], ['como fica a semana que vem', '2026-11-23'], ['qual treino depois de amanhã', '2026-11-19']];
  for (const [t, data] of casos) { const r = assuntoDe(t, 'treinador'); assert.equal(r.p.memoria.data, data, t); }
  // o texto fala do dia certo
  assert.match(assuntoDe('o que eu treino na quinta?', 'treinador').p.texto[0], /^Na quinta é Superiores B/);
  assert.match(assuntoDe('qual o pace de quinta?', 'corrida').p.texto[0], /^Na quinta, rodagem leve/);
  assert.match(assuntoDe('o que tenho de corrida amanhã', 'corrida').p.texto[0], /^Amanhã o plano não tem corrida/);
  assert.match(assuntoDe('como fica a semana que vem', 'treinador').p.texto[0], /semana que vem/);
});

// ---------- continuação e respostas digitadas ----------
// conversa: cada fala com a memória e a pergunta em aberto da anterior, como na tela
function conversar(coach, frases, st = ADULTO, hoje = TER) {
  let mem = null, aberto = null;
  return frases.map((f) => {
    const p = M.responder(f, coach, { ...ctxDe(st, hoje, coach), memoria: mem, aberto });
    if (p.memoria) mem = p.memoria;
    aberto = p.opcoes || p.acoes ? p : aberto && Number.isInteger(p.executar) ? aberto : null;
    return p;
  });
}
test('continuação: "e amanhã?", "e na sexta?", "e a corrida?" seguem o assunto e o dia da conversa', () => {
  const [a, b, c, d] = conversar('treinador', ['qual meu treino amanhã?', 'e sexta?', 'e a corrida?', 'e a semana?']);
  assert.equal(a.assunto, 'qual-treino');
  assert.equal(b.assunto, 'qual-treino'); assert.equal(b.memoria.data, '2026-11-20'); assert.match(b.texto[0], /^Na sexta é Inferiores B/);
  assert.equal(c.assunto, 'corrida-dia'); assert.equal(c.memoria.data, '2026-11-20');
  assert.equal(d.assunto, 'semana');
  // na corrida: "e se eu fizer na quinta?" depois da corrida de hoje = mudar a corrida para quinta
  const [, m] = conversar('corrida', ['qual minha corrida hoje?', 'e se eu fizer na quinta?']);
  assert.equal(m.assunto, 'mover-corrida');
  assert.match(m.texto.join(' '), /quinta já tem corrida/i);
  const [, q] = conversar('corrida', ['qual minha corrida hoje?', 'e se eu fizer amanhã?']);
  assert.match(q.texto[0], /^Pode: a corrida de hoje \(regenerativo\) vai para amanhã\./);
});
test('respostas digitadas: "sim", "pode", "não", "deixa" e o texto de um botão respondem à pergunta em aberto', () => {
  // "pode" aceita a proposta (a ação abre a confirmação da tela: nada muda sem ela)
  const [p, sim] = conversar('treinador', ['não vou poder ir na sexta', 'pode']);
  assert.ok(p.acoes && p.acoes.length >= 1);
  assert.equal(sim.executar, 0);
  for (const s of ['sim', 'isso', 'claro', 'pode ser', 'bora', 'ok', 'beleza']) assert.equal(conversar('treinador', ['não vou poder ir na sexta', s])[1].executar, 0, s);
  // "não" numa confirmação "É isso?" mostra a lista
  const [, n] = conversar('corrida', ['posso acelerar o ritmo hoje?', 'não']);
  assert.match(n.texto[0], /Qual destes/);
  for (const s of ['nao quero', 'deixa', 'agora não', 'melhor nao']) assert.ok(!conversar('corrida', ['posso acelerar o ritmo hoje?', s])[1].assunto, s);
  // o texto de um botão, com sinônimo ou só uma parte
  const [, e] = conversar('corrida', ['choveu', 'na esteira']);
  assert.equal(e.assunto, 'esteira');
  const [, t] = conversar('treinador', ['tenho pouco tempo', '30 minutos']);
  assert.match(t.texto[0], /Versão de cerca de|O mais curto/);
  const [, dor] = conversar('corrida', ['estou com dor na canela', 'na articulação']);
  assert.match(dor.texto[0], /menos carga|Em geral/);
  // "sim" numa confirmação abre o assunto
  const [, ok] = conversar('corrida', ['posso acelerar o ritmo hoje?', 'sim']);
  assert.equal(ok.assunto, 'mais-rapido');
});
test('dois assuntos na mesma frase: a dor (segurança) primeiro, o outro oferecido em seguida', () => {
  const [p, q, r] = conversar('corrida', ['choveu e estou com dor no joelho', 'músculo dolorido', 'Agora: Choveu ou não dá para correr na rua']);
  assert.equal(p.assunto, 'dor-corrida');
  assert.match(p.texto[0], /^Primeiro, uma dor\. Depois, chuva/);
  assert.deepEqual(p.memoria.pendente, ['chuva']);
  assert.ok(q.opcoes.some((o) => o.valor === '#pend'), 'o assunto pendente vira botão');
  assert.equal(r.assunto, 'chuva');
  // pelo botão também
  const s = M.seguir(q, '#pend', { ...ctxDe(ADULTO, TER, 'corrida'), memoria: q.memoria });
  assert.equal(s.assunto, 'chuva');
  // uma frase de um assunto só não vira dois
  for (const t of ['quantas séries e repetições?', 'posso fazer corrida e musculação no mesmo dia?', 'não vou treinar hoje porque estou cansado']) {
    const x = M.responder(t, 'treinador', ctxDe(ADULTO, TER, 'treinador'));
    assert.ok(!/^Primeiro, .+\. Depois, /.test(x.texto[0]), t);
  }
  // alerta sempre antes, mesmo com outro assunto junto
  const a = M.responder('choveu e senti falta de ar', 'corrida', ctxDe(ADULTO, TER, 'corrida'));
  assert.equal(a.aviso.tipo, 'danger');
});

// ---------- triagem da dor no peito ----------
test('triagem do peito: dor do músculo do treino faz UMA pergunta; frases claras de alerta vão direto ao alerta', () => {
  const triagem = ['peito dolorido do supino', 'meu peito ta dolorido desde o treino de ontem', 'dor no peito depois do supino', 'dói o peito quando aperto, treinei peito ontem', 'peitoral dolorido depois da academia', 'dor no peito quando mexo o braço depois do crucifixo'];
  for (const coach of ['treinador', 'corrida', 'nutri']) {
    for (const t of triagem) {
      const p = M.limparPasso(M.responder(t, coach, ctxDe(ADULTO, TER, coach)));
      assert.equal(p.aviso && p.aviso.tipo, 'warn', `sem triagem: "${t}" (${coach})`);
      assert.match(p.texto[0], /você tem algum destes\?/);
      assert.ok(p.refs.includes('ms_infarto') && p.refs.includes('nhs_dor_peito'));
      assert.deepEqual(p.opcoes.map((o) => o.valor), ['sim', 'nao_sei', 'nao']);
      // qualquer sinal, ou "não sei": emergência (192)
      for (const v of ['sim', 'nao_sei']) { const q = M.seguir(p, v, ctxDe(ADULTO, TER, coach)); assert.equal(q.aviso.tipo, 'danger'); assert.match(q.aviso.texto, /192/); }
      // sem sinais: a dor muscular, com o lembrete do 192
      const n = M.seguir(p, 'nao', ctxDe(ADULTO, TER, coach));
      assert.match(n.texto.join(' '), /dor do músculo do treino/);
      assert.match(n.aviso.texto, /192/);
      assert.ok(!n.acoes, 'a triagem não oferece ação');
    }
  }
  // frases claras de alerta: direto ao alerta, sem pergunta
  const claro = ['dor no peito', 'aperto no peito', 'falta de ar', 'dor no peito forte depois do supino', 'peito apertado no supino', 'dor no peito que vai pro braço esquerdo', 'dor no peito em repouso', 'dor no peito e falta de ar depois do treino', 'pressão no peito no treino de peito'];
  for (const t of claro) { const p = M.responder(t, 'treinador', ctxDe(ADULTO, TER, 'treinador')); assert.equal(p.aviso.tipo, 'danger', t); assert.match(p.aviso.texto, /192/, t); }
  // digitar "sim" na triagem também leva ao alerta
  const [, s] = conversar('treinador', ['peito dolorido do supino', 'sim']);
  assert.equal(s.aviso.tipo, 'danger');
});

// ---------- pergunta frequente respondida direto ----------
test('perguntas frequentes: a que casa bem com a frase vira a resposta do treinador, com "Por quê?" e fontes', () => {
  const casos = [['treinador', 'preciso treinar até a falha?', 'Preciso treinar até a falha'], ['treinador', 'preciso aquecer e alongar antes?', 'Preciso aquecer'], ['corrida', 'o que é o polimento antes da prova?', 'O que é o polimento'],
    ['corrida', 'como correr no calor?', 'Como correr no calor'], ['nutri', 'jejum intermitente funciona?', 'Jejum intermitente'], ['treinador', 'amplitude do movimento importa?', 'A amplitude']];
  for (const [coach, t, q] of casos) {
    const p = M.limparPasso(M.responder(t, coach, ctxDe(ADULTO, TER, coach)));
    assert.ok(!p.faq, `"${t}": listou em vez de responder`);
    assert.ok(p.texto.length >= 1 && p.texto.every((x) => x.length <= 260), t);
    assert.ok(p.refs && p.refs.length, 'sem fontes: ' + t);
    const it = [...FAQ_TREINO_T, ...FAQ_NUTRI_T, ...FAQ_CORRIDA_T].find((x) => x.q.startsWith(q));
    assert.ok(it && p.texto[0] && it.a[0].startsWith(p.texto[0].slice(0, 20)), `"${t}" não respondeu com "${q}": ${p.texto[0]}`);
  }
});

// ---------- ações para outros dias ----------
test('ações em outros dias: faltar na sexta, mudar a corrida de dia, o treino de amanhã hoje, aparelho que não tem e esteira', () => {
  const ctx = ctxDe(ADULTO, TER, 'treinador');
  // faltar na sexta: a mesma regra da folha "Não treinei", para um dia que ainda não chegou
  const f = assuntoDe('sexta não vou poder ir', 'treinador').p;
  const s1 = J(ADULTO);
  assert.notEqual(f.acoes[0].aplicar(s1, { ...ctx, st: s1 }), false);
  const m1 = s1.perdidos.find((x) => x.tipo === 'musculacao');
  assert.equal(m1.data, '2026-11-20');
  const sem1 = P.semanaEfetiva(s1.plans[0], s1.perdidos, P.segundaDe(TER));
  assert.ok(sem1.find((d) => d.data === '2026-11-20').perdido);
  confereSemana(s1, TER, 'sexta');
  // mudar a corrida de hoje para amanhã: a marca com `para`, e a corrida aparece no dia novo
  const mv = assuntoDe('posso mudar a corrida para amanhã?', 'corrida').p;
  assert.match(mv.texto.join(' '), /Assim fica a semana:.*Qua 18\/11: Regenerativo \(veio de hoje\)/);
  const s2 = J(ADULTO);
  assert.notEqual(mv.acoes[0].aplicar(s2, { ...ctxDe(s2, TER, 'corrida'), st: s2 }), false);
  assert.deepEqual(s2.perdidos.map((x) => [x.tipo, x.data, x.para]), [['corrida', TER, '2026-11-18']]);
  assert.equal(corridaDoDiaLogica(store.sanitize(s2), TER, '2026-11-18').movidaDe, TER);
  assert.equal(P.corridaPerdidaEm(s2, TER).para, '2026-11-18');
  // o dia de origem fica sem corrida (não é previsto nem conta como falta) e a semana diz para onde ela foi
  assert.equal(corridaDoDiaLogica(store.sanitize(s2), TER, TER), null);
  { const sem = planoDaSemanaEm(store.sanitize(s2), TER, P.segundaDe(TER)); const wd = P.diaDaSemana(TER);
    assert.equal(sem.dias[wd], null); assert.equal(sem.movidas[wd].para, '2026-11-18'); assert.equal(sem.dias[P.diaDaSemana('2026-11-18')].movidaDe, TER);
    const linha = P.semanaDoChat(store.sanitize(s2), TER, TER).find((d) => d.data === TER); assert.equal(linha.corrida.movidaPara, '2026-11-18'); }
  // o estado continua válido depois de passar pelo sanitize (backup e abertura do app)
  assert.deepEqual(store.sanitize(s2).perdidos, s2.perdidos);
  // regra: treino forte não vai para o dia colado em outro forte / dia que já tem corrida
  assert.equal(P.avaliarMoverCorrida(ADULTO, '2026-11-19', '2026-11-21', TER).motivo, 'ocupado');
  const forte = P.avaliarMoverCorrida(ADULTO, '2026-11-21', '2026-11-20', '2026-11-20');
  assert.ok(['pernas', 'ocupado', 'forte_seguido', 'sem_descanso', ''].includes(forte.motivo));
  // o treino de quinta hoje: hoje já tem treino → não junta; num dia sem treino (quarta), pode
  const qua = '2026-11-18';
  const tr = M.iniciar('antecipar', { ...ctxDe(ADULTO, qua, 'treinador'), data: '2026-11-19' });
  if (tr.acoes) {
    const s3 = J(ADULTO);
    assert.notEqual(tr.acoes[0].aplicar(s3, { ...ctxDe(s3, qua, 'treinador'), st: s3 }), false);
    const sem3 = P.semanaEfetiva(s3.plans[0], s3.perdidos, P.segundaDe(qua));
    assert.equal(sem3.find((d) => d.data === qua).veioDe, '2026-11-19');
    assert.equal(sem3.find((d) => d.data === '2026-11-19').diaId, '');
    confereSemana(s3, qua, 'troca');
  } else assert.match(tr.texto[0], /48 horas|corrida|dia livre/);
  // aparelho que não tem: troca no plano (mesma dose) e desmarca em "Minha academia"
  const ap = assuntoDe('o graviton tá quebrado', 'treinador').p;
  assert.ok(ap.acoes.length >= 2);
  const s4 = J(ADULTO);
  assert.notEqual(ap.acoes[0].aplicar(s4, { ...ctx, st: s4 }), false);
  assert.ok(!s4.plans[0].dias.some((d) => d.itens.some((it) => it.ex === 'barra-fixa-assistida-graviton')) || !EX_POR_ID.has('barra-fixa-assistida-graviton'));
  const s5 = J(ADULTO);
  const gymA = ap.acoes[ap.acoes.length - 1];
  assert.match(gymA.rotulo, /Marcar que não tenho/);
  gymA.aplicar(s5, { ...ctx, st: s5 });
  assert.equal(s5.gym.all, false);
  assert.ok(!s5.gym.has.graviton && s5.gym.has.halteres);
  // esteira (logic/esteira.js): a versão do treino e "Fazer na esteira" para outro dia
  const es = assuntoDe('quero fazer na esteira sábado', 'corrida').p;
  if (ESTEIRA) {
    const a = es.acoes.find((x) => /esteira/i.test(x.rotulo));
    assert.ok(a, 'sem a ação da esteira: ' + es.texto.join(' | '));
    const s6 = J(ADULTO);
    assert.notEqual(a.aplicar(s6, { ...ctxDe(s6, TER, 'corrida'), st: s6 }), false);
    assert.ok(ESTEIRA.naEsteira(s6, '2026-11-21'));
    // mudar de dia uma corrida marcada na esteira: a esteira vai junto
    const s7 = J(s6);
    const mv7 = M.iniciar('mover-corrida', { ...ctxDe(s7, TER, 'corrida'), datas: [{ data: '2026-11-21' }, { data: '2026-11-22' }], texto: '' });
    if (mv7.acoes) {
      mv7.acoes[0].aplicar(s7, { ...ctxDe(s7, TER, 'corrida'), st: s7 });
      assert.ok(!ESTEIRA.naEsteira(s7, '2026-11-21'));
    }
  } else assert.match(es.texto.join(' '), /inclinação/i);
});

// ---------- perfis protegidos ----------
// As frases do corpus em cada perfil: quem a triagem bloqueia nunca recebe treino; gestante, idoso, cardíaco, menor e
// quem tem dor nunca recebem sugestão contra a regra do app.
test('perfis protegidos: nenhuma sugestão contra a regra, em todas as frases do corpus', () => {
  const SEM_TREINO = new Set([...SEM_TREINO_NO_BLOQUEIO, 'qual-treino', 'duracao', 'antecipar', 'seguidos', 'aparelho-falta', 'semana']);
  let n = 0;
  for (const nome of ['gestante', 'gestanteSemLiberacao', 'idoso', 'cardiaco', 'cardiacoSemLiberacao', 'sinalNaTriagem', 'menor', 'menor13', 'diabetes', 'dorJoelho', 'dorDeAlerta', 'dorMuscular']) {
    const st = PERFIS[nome]();
    for (const [coach, lista] of Object.entries(CORPUS)) {
      if (coach === 'nutri') continue;
      for (const [frase] of lista) {
        const { p, id } = assuntoDe(frase, coach, st);
        n++;
        confere(p, `${nome} "${frase}"`);
        if (BLOQUEADOS.has(nome) && SEM_TREINO.has(id)) assert.ok(p.aviso && p.aviso.tipo === 'danger' && !p.acoes, `triagem bloqueada, mas sugeriu treino: ${nome} "${frase}"`);
        for (const a of p.acoes || []) {
          if (a.iniciar) confereVersaoCurta(st, a.iniciar, nome + ' ' + frase);
          if (a.aplicar) confereAcao(st, a, ctxDe(st, TER, coach), `${nome} "${frase}"`);
        }
        const txt = p.texto.join(' ');
        if (nome.startsWith('gestante') && id === 'mais-rapido') assert.match(txt, /gestação|dor|Agora não/);
        if (nome === 'menor' && id === 'seguidos') assert.match(txt, /dias não seguidos/);
        if (nome === 'diabetes' && id === 'seguidos') assert.match(txt, /dias não seguidos/);
        if (nome.startsWith('dor') && id === 'mais-rapido') assert.match(txt, /não aumente/);
      }
    }
  }
  assert.ok(n > 1000, 'frases conferidas: ' + n);
});
test('perfis protegidos: menor de 18 e diabetes nunca ficam com força em dias seguidos depois de "o treino de amanhã hoje"', () => {
  for (const nome of ['menor', 'diabetes']) {
    const st = PERFIS[nome]();
    for (const hoje of SEMANA) for (const de of SEMANA) {
      if (de <= hoje) continue;
      const a = P.avaliarTroca(st, de, hoje, hoje);
      if (!a.pode) continue;
      const s = J(st);
      s.perdidos = P.limparPerdidos([...s.perdidos, P.marcaTroca(st, de, hoje, hoje, '2026-11-17T12:00:00.000Z')]);
      const sem = P.semanaEfetiva(s.plans[0], s.perdidos, P.segundaDe(hoje));
      for (let k = 0; k < 6; k++) assert.ok(!(sem[k].diaId && sem[k + 1].diaId && (sem[k].veioDe || sem[k + 1].veioDe)), `${nome}: dias seguidos depois da troca ${de} → ${hoje}`);
    }
  }
});

// ---------- outros módulos: saúde fora do treino ----------
test('saúde fora do treino (logic/chat/saude.js): os assuntos aparecem e as emergências param a conversa', () => {
  if (!M.intencaoPorId('saude-fora-treino')) return;
  assert.ok(M.assuntos('treinador', ctxDe(ADULTO, TER, 'treinador')).some((i) => i.id === 'saude-fora-treino'));
  assert.ok(M.assuntos('corrida', ctxDe(ADULTO, TER, 'corrida')).some((i) => i.id === 'saude-fora-corrida'));
  assert.equal(assuntoDe('estou com febre', 'treinador').id, 'saude-fora-treino');
  const e = M.responder('bati a cabeça e estou vomitando', 'treinador', ctxDe(ADULTO, TER, 'treinador'));
  assert.equal(e.aviso && e.aviso.tipo, 'danger', JSON.stringify(e.texto));
});

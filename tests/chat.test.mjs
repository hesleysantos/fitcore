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
const ROTAS = [/^$/, /^treinos$/, /^treinador$/, /^corrida$/, /^nutricao$/, /^sono$/, /^sessao$/, /^progresso$/, /^corrida\/dia\/\d{4}-\d{2}-\d{2}$/, /^exercicio\/[\w-]+$/, /^treino\/[\w-]+\/[\w-]+$/, /^chat\/(treinador|corrida|nutri)$/];

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
    for (const w of i.palavras) assert.ok(w === M.normalizar(w).replace(/ /g, ' ') || w.includes('+'), `palavra fora do padrão em ${i.id}: ${w}`);
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
    ['tô cansado demais pra treinar', 'treino-perdido'], ['dormi mal essa noite', 'treino-perdido'], ['estou gripado', 'treino-perdido'], ['vou viajar amanhã', 'treino-perdido'],
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
    ['choveu e não dá pra correr', 'chuva'], ['tá chovendo', 'chuva'], ['posso correr na esteira?', 'chuva'], ['qual inclinação na esteira', 'chuva'],
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
test('reconhecimento: confirma antes, "Sim" abre o assunto e "Não" mostra a lista; assunto de outro treinador vira atalho', () => {
  const ctx = ctxDe(ADULTO, TER, 'treinador');
  const p = M.limparPasso(M.responder('não vou conseguir treinar hoje', 'treinador', ctx));
  assert.match(p.texto[0], /^Entendi que você quer falar sobre faltar ao treino de hoje\. É isso\?$/);
  assert.deepEqual(p.opcoes.map((o) => o.rotulo), ['Sim', 'Não, outro assunto']);
  assert.equal(M.seguir(p, 'sim', ctx).texto[0], 'Tudo bem. O que aconteceu?');
  const nao = M.seguir(p, 'nao', ctx);
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
              if (a.iniciar) confereVersaoCurta(st, a.iniciar, onde);
              if (a.aplicar) confereAcao(st, a, ctx, onde);
            }
          }
        }
      }
    }
  }
  assert.ok(passos > 2000, 'passos percorridos: ' + passos);
});
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
function confereAcao(st, a, ctx, onde) {
  const s = J(st);
  const antes = s.perdidos.length;
  const r = a.aplicar(s, { ...ctx, st: s });
  assert.notEqual(r, false, 'a ação não se aplicou no estado em que foi oferecida: ' + onde);
  assert.equal(s.perdidos.length, antes + 1, onde);
  const m = s.perdidos.find((x) => !st.perdidos.some((y) => y.tipo === x.tipo && y.data === x.data));
  assert.ok(m && m.data === ctx.hoje, onde);
  // é exatamente a marca da folha "Não treinei" / "Não corri" (mesma regra de logic/perdido.js)
  assert.deepEqual(P.limparPerdidos(s.perdidos), s.perdidos, 'marca inválida: ' + onde);
  if (m.tipo === 'musculacao') {
    const esperado = P.novaMarca(st, ctx.hoje, ctx.hoje, m.movs.length ? 'mover' : 'seguir', m.em);
    assert.deepEqual(m, esperado, onde);
    // a semana depois da marca segue as regras do treino perdido: nenhum treino em dia bloqueado e um por dia
    const sem = P.semanaEfetiva(s.plans[0], s.perdidos, P.segundaDe(ctx.hoje));
    assert.ok(sem.every((d) => !d.diaId || s.plans[0].dias.some((x) => x.id === d.diaId)), onde);
  } else assert.ok(P.podeMarcarCorrida(st, ctx.hoje, ctx.hoje), onde);
}

// ---------- assuntos, um a um ----------
test('juntar corrida e musculação: o exemplo do dono, pela prioridade e pelo perfil', () => {
  const ctx = ctxDe(ADULTO, TER, 'treinador');
  // terça: corrida leve (regenerativo) e treino de pernas
  assert.ok(corridaDeHoje(ctx) && treinoDeHoje(ctx));
  const conf = M.limparPasso(M.responder('hoje de manhã eu tinha corrida no plano mas choveu; tenho musculação hoje também — posso fazer um seguido do outro e qual a recomendação de acordo com minhas prioridades e meu perfil?', 'treinador', ctx));
  const p = M.seguir(conf, 'sim', ctx);
  const txt = p.texto.join(' ');
  assert.match(txt, /Sua prioridade: os dois por igual\./);
  assert.match(txt, /O ideal é 6 horas entre os dois; no mínimo 3\./);
  assert.ok(p.detalhes.some((d) => /logo depois do outro/.test(d)));
  for (const k of ['eddens2018', 'petre2021', 'methenitis2018']) assert.ok(p.refs.includes(k), k);
  // prioridade na musculação: musculação primeiro
  const m = M.iniciar('juntar-treino', ctxDe(PERFIS.focoMusculacao(), TER, 'treinador'));
  assert.match(m.texto.join(' '), /Faça primeiro a musculação e depois a corrida\./);
  // sem prioridade escolhida: pergunta e oferece guardar
  const sf = M.iniciar('juntar-treino', ctxDe(PERFIS.semFoco(), TER, 'treinador'));
  assert.equal(sf.texto[0], 'O que vem primeiro para você?');
  const c = M.seguir(sf, 'corrida', ctxDe(PERFIS.semFoco(), TER, 'treinador'));
  assert.ok(c.ir.some((x) => x.abrir === 'combinado'));
  // segunda: corrida forte (fartlek) e treino de superiores: corra primeiro
  const seg = M.iniciar('juntar-treino', ctxDe(ADULTO, '2026-11-16', 'treinador'));
  assert.match(seg.texto.join(' '), /Corra primeiro/);
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
  assert.deepEqual(p.opcoes.map((o) => o.valor), ['esteira', 'tarde', 'nao']);
  const e = M.seguir(p, 'esteira', ctx);
  assert.ok(e.refs.includes('miller2019') && /inclinação/.test(e.texto.join(' ')));
  const forte = M.seguir(M.iniciar('chuva', ctxDe(ADULTO, '2026-11-16', 'corrida')), 'esteira', ctxDe(ADULTO, '2026-11-16', 'corrida'));
  assert.match(forte.texto.join(' '), /1% de inclinação/);
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
  assert.ok(M.assuntos('treinador', ctx).every((i) => ['mudar-plano', 'dor-treino'].includes(i.id)));
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

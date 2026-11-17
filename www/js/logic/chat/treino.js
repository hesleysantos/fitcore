// Assuntos do Treinador (musculação) no chat. Puro: sem DOM. Formato em logic/chat/contrato.js.
// Nenhuma regra nova de treino mora aqui: cada resposta chama a lógica que o app já usa (logic/perdido.js, trainer.js,
// carga.js, combinado.js, corrida.js, sono.js, dor.js) e cita as fontes dela. A única conta própria é a versão curta do
// treino de hoje (versaoCurta), que segue Iversen 2021 (ref iversen2021, texto completo, PMC8449772):
//  • "we recommend prioritizing bilateral, multi-joint exercises" e "all major muscle-groups can be targeted with as few
//    as three exercises" → ficam os exercícios de várias articulações, e o treino não desce de 3 exercícios;
//  • "Each muscle group should be trained with at least four sets per week" → um treino mais curto custa pouco: o que
//    conta é a semana (o mesmo que logic/perdido.js diz do volume semanal, ref pelland2026);
//  • descanso de "1–2 min" para quem começa e "≥ 2 min" para quem já treina → o descanso do plano NÃO é encurtado (ele
//    já foi ajustado ao tempo da entrevista em logic/trainer.js); o que sai são o cardio do fim, séries e exercícios
//    isolados, nessa ordem; "restricting the warm-up to exercise-specific warm-ups" → as séries de aproximação continuam
//    (o treino guiado as mostra), e o cardio leve antes só fica onde o app já o recomenda (aquecimentoRecomendado).
// Os músculos em prioridade da entrevista (pf.foco) são os últimos a perder exercício. Nada sobe: nem séries, nem
// carga, nem repetições; o descanso não muda.
import * as P from '../perdido.js';
import { perfil, duracaoEstimada, saudeDoTreinador, avisosBloqueio, orientacaoDaDor, sugerirTrocas, outraVersao, respostasCompletas, resumoCombinado, doresDoTreino, alertaDoExercicio, respostasParaAvisos } from '../trainer.js';
import { doresAtivas, LOCAIS_DOR } from '../dor.js';
import { temOsDois, comboAtual } from '../combinado.js';
import { treinoDoDia as corridaDoDia, efeitoDoFoco as efeitoNaCorrida, perfil as perfilCorrida, saudeDaCorrida, efeitoDaDor } from '../corrida.js';
import { efeitoDoFoco as efeitoNaMusculacao } from '../trainer.js';
import { noiteDe, metaDeSono, fmtHoras, fmtFaixa } from '../sono.js';
import { aquecimentoRecomendado } from '../guiado.js';
import { recomendacao, contextoDoEstado } from '../carga.js';
import { EX_POR_ID } from '../../data/exercises.js';
import { MUSCULOS } from '../../data/muscles.js';
import { FAQ_TREINO } from '../../data/knowledge.js';
import { FAQ_CORRIDA } from '../../data/corrida.js';
import { faqDe, plural, fmtDescanso, juntar } from './comum.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const emIso = (ctx) => new Date(Number.isFinite(ctx && ctx.agora) ? ctx.agora : Date.now()).toISOString();

// ---------- leitura do estado ----------
function pfDoTreino(ctx) {
  try { return perfil(saudeDoTreinador(ctx.st, ctx.hoje).respostas); } catch { return perfil({}); }
}
// O treino de musculação que vale hoje (com as marcas da semana): { plan, dia } ou null
export function treinoDeHoje(ctx) {
  const plan = P.planoAtivo(ctx.st);
  if (!plan) return null;
  let t = null;
  try { t = P.treinoDoDia(ctx.st, ctx.hoje); } catch { t = null; }
  const dia = t && t.diaId ? plan.dias.find((d) => d.id === t.diaId) : null;
  return dia && Array.isArray(dia.itens) && dia.itens.length ? { plan, dia } : null;
}
const treinouHoje = (ctx) => (Array.isArray(ctx.st.sessions) ? ctx.st.sessions : []).some((s) => s && P.diaLocal(s.inicio) === ctx.hoje);
// A corrida do plano hoje: o treino do dia (sem descanso) ou null
export function corridaDeHoje(ctx) {
  try { const d = corridaDoDia(ctx.st, ctx.hoje, ctx.hoje); return d && d.tipo && d.tipo !== 'descanso' ? d : null; } catch { return null; }
}
// corrida forte ou longão (os dois pedem distância do treino pesado de pernas: logic/trainer.js, logic/corrida.js)
export const corridaChave = (d) => !!d && (d.intensidade === 'forte' || d.forte === true || (d.tipo === 'longo' && !d.comoRodagem));
const correuHoje = (ctx) => (Array.isArray(ctx.st.runs) ? ctx.st.runs : []).some((r) => r && r.data === ctx.hoje);

// Triagem que bloqueia o treino (a mesma do Treinador): o chat não sugere treino nenhum até resolver
export function bloqueio(ctx) {
  let sd = null;
  try { sd = saudeDoTreinador(ctx.st, ctx.hoje); } catch { return null; }
  const pf = perfil(sd.respostas);
  if (!pf.bloqueado) return null;
  let av = [];
  try { av = avisosBloqueio(sd.respostas); } catch { av = []; }
  const curto = pf.bloqueio === 'idade' ? 'Para menores de 14 anos, a musculação é orientada ao vivo por um profissional.'
    : pf.bloqueio === 'supervisao' ? 'Um médico disse que você só deve se exercitar com supervisão: treine com um profissional ao lado.'
      : 'Pelas suas respostas de saúde, o treino só volta com a liberação do seu médico.';
  return {
    aviso: { tipo: 'danger', texto: curto },
    texto: ['Por segurança, não sugiro treino até isso ser resolvido.'],
    detalhes: av.map((x) => x.texto),
    refs: av.flatMap((x) => x.refs || []),
    ir: [{ rotulo: 'Abrir o Treinador', rota: 'treinador' }],
  };
}

// ---------- treino perdido (logic/perdido.js) ----------
const POR_QUE_PERDIDO = [
  'Para o músculo, o que mais conta é o total de séries da semana. Por isso, se der, o treino muda de dia.',
  'Entre dois treinos do mesmo músculo, 48 horas ou mais: o app não junta dois treinos no mesmo dia.',
  'Sem um dia assim, siga a semana: perder um treino tira pouca força.',
];
function semTreinoHoje(motivo) {
  const t = {
    treinou: 'Você já treinou hoje. Bom trabalho!',
    marcado: 'O treino de hoje já está marcado como não feito.',
    em_andamento: 'Você tem um treino em andamento.',
    sem_treino: 'Hoje não tem musculação no seu plano.',
  }[motivo] || 'Hoje não há treino do plano para marcar.';
  return { texto: [t], ir: [motivo === 'em_andamento' ? { rotulo: 'Voltar ao treino', rota: 'sessao' } : { rotulo: 'Ver a semana', rota: 'treinos' }] };
}
// Ação que grava a marca "Não treinei" de hoje (a mesma da folha de views/perdido.js)
function acaoMarcar(p, escolha, hoje) {
  const para = p.movs.length ? P.nomeDoDia(p.movs[0].para, hoje) : '';
  return {
    rotulo: escolha === 'mover' ? `Passar para ${para}` : 'Seguir a semana',
    confirmar: escolha === 'mover' ? `O ${p.nome} passa para ${para}. ${p.texto}` : `O ${p.nome} fica como não feito e volta ${P.naProxima(hoje)}.`,
    aplicar: (s, ctx) => {
      const m = P.novaMarca(s, ctx.hoje, ctx.hoje, escolha, emIso(ctx));
      if (!m || (escolha === 'mover' && !m.movs.length)) return false;
      s.perdidos = P.limparPerdidos([...(Array.isArray(s.perdidos) ? s.perdidos : []), m]);
      return true;
    },
    depois: escolha === 'mover' ? `Pronto: ${p.nome} passou para ${para}.` : `Pronto. O ${p.nome} volta ${P.naProxima(hoje)}.`,
  };
}
// A proposta do app para o treino de hoje, com as mesmas escolhas da folha "Não treinei"
export function passoPerdido(ctx, antes = [], detalhes = [], refs = []) {
  let p;
  try { p = P.propor(ctx.st, ctx.hoje, ctx.hoje); } catch { p = { pode: false, motivo: '' }; }
  if (!p.pode) return semTreinoHoje(p.motivo);
  const foco = (() => { try { return comboAtual(ctx.st).foco; } catch { return ''; } })();
  const ajusta = foco === 'corrida' || foco === 'equilibrio';
  return {
    texto: [...antes, p.titulo, p.texto],
    detalhes: [...detalhes, ...POR_QUE_PERDIDO, ...(ajusta ? ['Com a corrida, as pernas ficam a 24 horas ou mais da corrida forte e do longo.'] : [])],
    refs: [...refs, ...P.REFS_MUSCULACAO, ...(ajusta ? P.REFS_COMBINADO : [])],
    acoes: p.movs.length ? [acaoMarcar(p, 'mover', ctx.hoje), acaoMarcar(p, 'seguir', ctx.hoje)] : [acaoMarcar(p, 'seguir', ctx.hoje)],
  };
}

// ---------- versão curta do treino de hoje ----------
const exDe = (it) => EX_POR_ID.get(it.ex);
const ehCardio = (it) => { const e = exDe(it); return !!e && (e.padrao === 'cardio' || e.registro === 'minutos'); };
// Treino que cabe em `minutos` (conta de duracaoEstimada, a mesma das telas). Devolve { itens, minutos, antes, cabe,
// saiu: [nomes], menos: [nomes] }. Regra e fontes no começo do arquivo.
export function versaoCurta(itens, minutos, pf = null) {
  const orig = (Array.isArray(itens) ? itens : []).filter((it) => isObj(it) && EX_POR_ID.has(it.ex));
  const lista = orig.map((it) => ({ ...it, series: Math.max(1, Math.round(Number(it.series) || 1)) }));
  const antes = duracaoEstimada({ itens: orig });
  const foco = new Set(pf && Array.isArray(pf.foco) ? pf.foco : []);
  const composto = (it) => exDe(it).tipo === 'composto' && !ehCardio(it);
  const isolado = (it) => !composto(it) && !ehCardio(it);
  const ehFoco = (it) => exDe(it).primarios.some((m) => foco.has(m) || (MUSCULOS[m] && foco.has(MUSCULOS[m].grupo)));
  // objetivo força a partir do nível 2: os principais não descem de 3 séries antes de sair o resto (o mesmo piso de
  // caberNoTempo, em logic/trainer.js)
  const minMain = pf && pf.objetivoDose === 'forca' && pf.nivel > 1 ? 3 : 2;
  const dur = () => duracaoEstimada({ itens: lista });
  const nForca = () => lista.filter((it) => !ehCardio(it)).length;
  const ultimo = (f) => { for (let i = lista.length - 1; i >= 0; i--) if (f(lista[i])) return i; return -1; };
  const menos = (f, piso) => { const i = ultimo((it) => f(it) && it.series > piso); if (i < 0) return false; lista[i].series--; return true; };
  const tira = (f) => { const i = ultimo(f); if (i < 0 || nForca() <= 3) return false; lista.splice(i, 1); return true; };
  const passos = [
    () => { const i = ultimo(ehCardio); if (i < 0 || !nForca()) return false; lista.splice(i, 1); return true; }, // cardio do fim
    () => menos((it) => isolado(it) && !ehFoco(it), 2),
    () => tira((it) => isolado(it) && !ehFoco(it)),
    () => menos(isolado, 2),
    () => tira(isolado),
    () => menos(composto, minMain),
    () => tira((it) => !ehCardio(it) && !ehFoco(it)),
    () => tira((it) => !ehCardio(it)),
    () => menos((it) => !ehCardio(it), 1),
  ];
  for (let k = 0; k < 400 && dur() > minutos; k++) if (!passos.some((f) => f())) break;
  const ficou = new Map(lista.map((it) => [it.ex, it]));
  const saiu = orig.filter((it) => !ficou.has(it.ex)).map((it) => exDe(it).nome);
  const menosSeries = orig.filter((it) => ficou.has(it.ex) && ficou.get(it.ex).series < it.series).map((it) => exDe(it).nome);
  return { itens: lista, minutos: dur(), antes, cabe: dur() <= minutos, saiu, menos: menosSeries };
}
const doseTxt = (it) => {
  const e = exDe(it);
  const un = e.registro === 'segundos' ? ' s' : e.registro === 'minutos' ? ' min' : '';
  return e.registro === 'minutos' ? `${it.reps} min` : `${it.series} × ${String(it.reps).replace('-', ' a ')}${un}`;
};
const TEMPOS = [20, 30, 45];
function passoTempo(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  const t = treinoDeHoje(ctx);
  if (!t) return semTreinoHoje('sem_treino');
  if (ctx.st.current) return semTreinoHoje('em_andamento');
  const dur = duracaoEstimada(t.dia);
  const op = TEMPOS.filter((m) => m < dur);
  if (!op.length) return { texto: [`O treino de hoje (${t.dia.nome}) já é curto: cerca de ${dur} min.`], ir: [{ rotulo: 'Ver o treino', rota: `treino/${t.plan.id}/${t.dia.id}` }] };
  return {
    texto: [`O ${t.dia.nome} leva cerca de ${dur} min. Quanto tempo você tem?`],
    opcoes: [...op.map((m) => ({ rotulo: `${m} min`, valor: m })), { rotulo: 'Nem isso', valor: 0 }],
    proximo: (v, c) => (v ? passoCurto(c, Number(v)) : passoPerdido(c, ['Então vamos remarcar.'])),
  };
}
export function passoCurto(ctx, minutos) {
  const t = treinoDeHoje(ctx);
  if (!t) return semTreinoHoje('sem_treino');
  const pf = pfDoTreino(ctx);
  const r = versaoCurta(t.dia.itens, minutos, pf);
  if (!r.itens.length) return passoPerdido(ctx);
  const linhas = r.itens.map((it) => `• ${exDe(it).nome}: ${doseTxt(it)}`);
  const det = [
    'Com pouco tempo, ficam os exercícios de várias articulações; saem primeiro o cardio do fim, séries e exercícios isolados.',
    'O descanso entre as séries continua o do plano, e as séries leves de aproximação também.',
    'Para o músculo, o que conta é a semana: 4 séries por semana para cada grupo já dão resultado. Um treino mais curto custa pouco.',
  ];
  if (r.saiu.length) det.unshift(`Saem hoje: ${juntar(r.saiu)}.`);
  return {
    texto: [r.cabe ? `Versão de cerca de ${r.minutos} min:` : `O mais curto que dá é cerca de ${r.minutos} min:`, ...linhas],
    aviso: aquecimentoRecomendado(pf) ? { tipo: 'info', texto: 'Para o seu perfil, mantenha os 5 minutos de cardio leve antes.' } : undefined,
    detalhes: det,
    refs: ['iversen2021', 'pelland2026', ...(aquecimentoRecomendado(pf) ? ['garber2011'] : [])],
    acoes: [{
      rotulo: 'Começar a versão curta',
      confirmar: 'O treino de hoje começa com esta versão. O seu plano não muda.',
      iniciar: { planId: t.plan.id, diaId: t.dia.id, itens: r.itens },
    }],
  };
}

// ---------- corrida e musculação no mesmo dia (logic/combinado.js, trainer.js e corrida.js) ----------
const NOME_FOCO = { corrida: 'a corrida', musculacao: 'a musculação', equilibrio: 'os dois por igual' };
// O que fazer hoje com os dois treinos, pela prioridade escolhida (ou a que a pessoa disser agora)
export function passoJuntar(ctx, focoDito = '') {
  const b = bloqueio(ctx);
  if (b) return b;
  const foco = focoDito || (() => { try { return comboAtual(ctx.st).foco; } catch { return ''; } })();
  if (!foco) {
    return {
      texto: ['O que vem primeiro para você?'],
      opcoes: [{ rotulo: 'A corrida', valor: 'corrida' }, { rotulo: 'A musculação', valor: 'musculacao' }, { rotulo: 'Os dois por igual', valor: 'equilibrio' }],
      proximo: (v, c) => passoJuntar(c, v),
    };
  }
  const corrida = corridaDeHoje(ctx);
  const t = treinoDeHoje(ctx);
  const pernas = !!t && P.cargaDoTreino(t.dia).pernas;
  const chave = corridaChave(corrida);
  const pf = pfDoTreino(ctx);
  let pfC = null;
  try { pfC = perfilCorrida(saudeDaCorrida(ctx.st, ctx.hoje).respostas); } catch { pfC = null; }
  const gestante = pf.gestante || !!(pfC && pfC.gestante);
  const refs = [];
  const det = [];
  try { const e = efeitoNaCorrida(foco, ctx.st); det.push(...e.linhas); refs.push(...e.refs); } catch { /* sem o detalhe */ }
  try { refs.push(...efeitoNaMusculacao(foco, ctx.st).refs); } catch { /* idem */ }
  const ir = [];
  if (corrida) ir.push({ rotulo: 'Abrir a corrida de hoje', rota: 'corrida/dia/' + ctx.hoje });
  if (focoDito) ir.push({ rotulo: 'Guardar essa prioridade', abrir: 'combinado' });
  const quem = focoDito ? `Com prioridade n${foco === 'equilibrio' ? 'os dois' : foco === 'corrida' ? 'a corrida' : 'a musculação'}:` : `Sua prioridade: ${NOME_FOCO[foco]}.`;
  // corrida forte (ou longão) e treino de pernas no mesmo dia: não junta (24 horas ou mais entre os dois)
  if (corrida && pernas && chave) {
    const acoes = [];
    let p = null;
    try { p = P.propor(ctx.st, ctx.hoje, ctx.hoje); } catch { p = null; }
    if (p && p.pode) acoes.push({ ...acaoMarcar(p, p.movs.length ? 'mover' : 'seguir', ctx.hoje), rotulo: p.movs.length ? `Correr hoje e passar o ${p.nome} para ${P.nomeDoDia(p.movs[0].para, ctx.hoje)}` : `Correr hoje e deixar o ${p.nome}` });
    if (P.podeMarcarCorrida(ctx.st, ctx.hoje, ctx.hoje)) acoes.push(acaoNaoCorrer(`Fazer o ${t.dia.nome} e não correr hoje`));
    return {
      texto: [quem, `Hoje não junte os dois: ${corrida.tipo === 'longo' ? 'o longão' : 'a corrida forte'} e o treino de pernas ficam a 24 horas ou mais um do outro.`, 'Escolha um para hoje.'],
      detalhes: ['Depois do treino pesado de pernas, o rendimento na corrida cai por 24 a 48 horas.', 'Corrida perdida não se repõe: o plano segue.', ...det],
      refs: [...refs, 'blagrove2018', 'doma2017', ...P.REFS_CORRIDA], acoes, ir,
    };
  }
  const texto = [quem];
  if (!corrida && !t) texto.push('Hoje o plano não tem corrida nem musculação. Para os dias com os dois:');
  else if (!corrida) texto.push(correuHoje(ctx) ? 'Você já correu hoje.' : 'Hoje o plano não tem corrida. Para os dias com os dois:');
  else if (!t) texto.push('Hoje o plano não tem musculação. Para os dias com os dois:');
  const leve = corrida && !chave;
  if (foco === 'musculacao') texto.push('Faça primeiro a musculação e depois a corrida.');
  else if (leve) texto.push('Com a corrida leve, a ordem pesa pouco: comece pelo que preferir.');
  else texto.push('Corra primeiro e faça a musculação depois.');
  texto.push('O ideal é 6 horas entre os dois; no mínimo 3.');
  det.unshift('Um logo depois do outro também dá, mas o segundo rende menos. Por isso a prioridade vem primeiro.');
  refs.push('eddens2018', 'petre2021', 'schumann2022', 'methenitis2018');
  let aviso;
  if (pernas && corrida && pf.nivel === 1) { aviso = { tipo: 'info', texto: 'Nas primeiras semanas de musculação, as pernas demoram 48 horas para render de novo na corrida: vá com calma.' }; refs.push('doma2017'); }
  else if (gestante) { aviso = { tipo: 'warn', texto: 'Na gestação, os dois em intensidade leve a moderada: dá para conversar durante o esforço.' }; refs.push('acog804', 'sbc_gestacao2021'); }
  else if (doresAtivas(ctx.st, ctx.hoje).length) aviso = { tipo: 'info', texto: 'Com a dor que você contou, siga os ajustes que o plano já fez para ela.' };
  if (!corrida && !t) ir.length = 0;
  return { texto, aviso, detalhes: det, refs, ir };
}
// "Não corri" de hoje (a mesma marca da folha de views/perdido.js)
export function acaoNaoCorrer(rotulo = 'Marcar como não feita') {
  return {
    rotulo,
    confirmar: 'A corrida de hoje fica marcada como não feita. Ela não se repõe: o plano segue.',
    aplicar: (s, ctx) => {
      if (!P.podeMarcarCorrida(s, ctx.hoje, ctx.hoje)) return false;
      const m = P.marcaCorrida(ctx.hoje, emIso(ctx));
      if (!m) return false;
      s.perdidos = P.limparPerdidos([...(Array.isArray(s.perdidos) ? s.perdidos : []), m]);
      return true;
    },
    depois: 'Marcado. Siga o plano.',
  };
}

// ---------- dor (logic/dor.js, trainer.js e corrida.js; folha de views/dor.js) ----------
const nomeDor = (d) => (LOCAIS_DOR[d.onde] || 'Dor') + (d.lado === 'e' ? ', lado esquerdo' : d.lado === 'd' ? ', lado direito' : d.lado === 'dois' ? ', os dois lados' : '');
// `coach`: 'treinador' (o que o Treinador faz com a dor) ou 'corrida' (o que a corrida faz)
export function passoDor(ctx, coach = 'treinador') {
  const ativas = (() => { try { return doresAtivas(ctx.st, ctx.hoje); } catch { return []; } })();
  const FAQ = coach === 'corrida' ? FAQ_CORRIDA : FAQ_TREINO;
  const antes = [], depois = [];
  const refs = [];
  let respostas = null;
  try { respostas = respostasParaAvisos(ctx.st, ctx.hoje); } catch { respostas = null; }
  let pfC = null;
  try { pfC = perfilCorrida(saudeDaCorrida(ctx.st, ctx.hoje).respostas); } catch { pfC = null; }
  for (const d of ativas.slice(0, 2)) {
    let o = null;
    try { o = coach === 'corrida' ? efeitoDaDor(d, pfC) : orientacaoDaDor(d, respostas); } catch { o = null; }
    if (o && o.texto) { (antes.length ? depois : antes).push(`${nomeDor(d)}: ${o.texto}`); refs.push(...(o.refs || [])); }
  }
  const tipos = [{ rotulo: 'Músculo dolorido do treino', valor: 'muscular' }, { rotulo: 'Na articulação ou no tendão', valor: 'articular' }, { rotulo: 'Forte, repentina ou em repouso', valor: 'aguda' }];
  const contar = { rotulo: ativas.length ? 'Contar outra dor' : 'Contar a dor ao Treinador', abrir: 'contar-dor' };
  return {
    texto: [...antes, 'Como é a dor?'],
    detalhes: depois,
    refs,
    opcoes: tipos,
    proximo: (v) => {
      if (v === 'muscular') {
        const f = faqDe(FAQ, coach === 'corrida' ? 'Senti dor' : 'Estou com dor muscular');
        return { texto: ['É a dor comum do treino: some em até 7 dias.', 'Enquanto doer, treine esse músculo mais leve ou treine outras partes.'], detalhes: f ? f.a.slice(0, 2) : [], refs: f ? f.refs : [], ir: [contar] };
      }
      if (v === 'articular') {
        const f = faqDe(FAQ, coach === 'corrida' ? 'Senti dor' : 'Sinto dor numa articulação');
        return { texto: ['Em geral dá para treinar, com menos carga e amplitude, se a dor não piorar.', 'Conte a dor: o plano se ajusta ao local e à intensidade.'], detalhes: f ? f.a.slice(0, 2) : [], refs: f ? f.refs : [], ir: [contar] };
      }
      const f = faqDe(FAQ_TREINO, 'Quando a dor pede médico');
      return {
        aviso: { tipo: 'warn', texto: 'Dor forte, repentina, com inchaço ou que aparece em repouso precisa de avaliação de um médico ou fisioterapeuta antes de treinar essa região.' },
        texto: ['Conte a dor: o treino deixa essa região de fora até a avaliação.'],
        detalhes: f ? f.a.slice(0, 1) : [], refs: f ? f.refs : [], ir: [contar],
      };
    },
  };
}

// ---------- carga, repetições, séries, descanso e tempo ----------
const POR_PAGINA = 5;
function escolherExercicio(ctx, plan, dia, pagina = 0) {
  const itens = dia.itens.filter((it) => EX_POR_ID.has(it.ex));
  const ini = pagina * POR_PAGINA;
  const vis = itens.slice(ini, ini + (itens.length - ini > 6 ? POR_PAGINA : 6));
  const opcoes = vis.map((it) => ({ rotulo: exDe(it).nome, valor: it.ex }));
  if (ini + vis.length < itens.length) opcoes.push({ rotulo: 'Mais exercícios', valor: '#mais' });
  if (opcoes.length === 1) return passoDose(ctx, plan, dia, itens[0]);
  return { texto: [`Qual exercício do ${dia.nome}?`], opcoes, proximo: (v, c) => (v === '#mais' ? escolherExercicio(c, plan, dia, pagina + 1) : passoDose(c, plan, dia, itens.find((it) => it.ex === v))) };
}
export function passoDose(ctx, plan, dia, it) {
  if (!it) return { texto: ['Não achei esse exercício no plano.'] };
  const ex = exDe(it);
  let rec = null;
  try { rec = recomendacao(it.ex, it.reps, it.series, contextoDoEstado(ctx.st, it.ex, ctx.hoje), ctx.agora); } catch { rec = null; }
  const texto = [ex.registro === 'minutos' ? `${ex.nome}: ${it.reps} min.` : `${ex.nome}: ${doseTxt(it)}, com ${fmtDescanso(it.descanso)} de descanso entre as séries.`];
  if (rec) {
    if (ex.registro === 'peso_reps' && rec.kg != null) texto.push(`Carga para hoje: ${String(rec.kg).replace('.', ',')} kg.`);
    if (rec.linha) texto.push(rec.linha + '.');
    else if (rec.texto) texto.push(rec.texto);
  }
  if (ex.registro === 'peso_reps') texto.push('Para subir: quando fizer o número mais alto em todas as séries, em dois treinos seguidos, aumente a carga e volte ao número mais baixo.');
  else if (ex.registro === 'reps') texto.push('Para subir: passou do número mais alto em todas as séries, use uma variação mais difícil ou acrescente carga.');
  else texto.push('Para subir: quando ficar fácil, aumente um pouco o tempo.');
  let aviso;
  try {
    const respostas = respostasParaAvisos(ctx.st, ctx.hoje);
    const al = alertaDoExercicio(it.ex, doresDoTreino(ctx.st, ctx.hoje, respostas), respostas);
    if (al) aviso = { tipo: 'warn', texto: al.texto };
  } catch { aviso = undefined; }
  return {
    texto, aviso,
    detalhes: [...(rec && Array.isArray(rec.porque) ? rec.porque : []), 'Séries, repetições e descanso vêm do seu objetivo e do seu perfil, na entrevista do Treinador.'],
    refs: [...(rec && Array.isArray(rec.refs) ? rec.refs : []), 'acsm2009'],
    ir: [{ rotulo: 'Ver como fazer', rota: 'exercicio/' + it.ex }],
  };
}
function passoCarga(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  const plan = P.planoAtivo(ctx.st);
  const dias = plan ? plan.dias.filter((d) => Array.isArray(d.itens) && d.itens.some((it) => EX_POR_ID.has(it.ex))) : [];
  if (!dias.length) return { texto: ['O seu plano ainda não tem exercícios.'], ir: [{ rotulo: 'Ver os treinos', rota: 'treinos' }] };
  const t = treinoDeHoje(ctx);
  // o treino de hoje primeiro
  const ordem = t ? [t.dia, ...dias.filter((d) => d.id !== t.dia.id)] : dias;
  if (ordem.length === 1) return escolherExercicio(ctx, plan, ordem[0]);
  return {
    texto: ['De qual treino?'],
    opcoes: ordem.slice(0, 6).map((d) => ({ rotulo: t && d.id === t.dia.id ? `${d.nome} (hoje)` : d.nome, valor: d.id })),
    proximo: (v, c) => { const d = plan.dias.find((x) => x.id === v); return d ? escolherExercicio(c, plan, d) : { texto: ['Não achei esse treino.'] }; },
  };
}

// ---------- mudar o plano (as telas do Treinador mostram a proposta antes de valer) ----------
function passoMudar(ctx) {
  const a = ctx.st.trainer && ctx.st.trainer.answers;
  if (!respostasCompletas(a || {})) return { texto: ['Primeiro responda à entrevista do Treinador: ele monta o plano e mostra antes de você aceitar.'], ir: [{ rotulo: 'Abrir o Treinador', rota: 'treinador' }] };
  return {
    texto: ['O que você quer mudar?'],
    opcoes: [
      { rotulo: 'Os dias ou o tempo de treino', valor: 'respostas' },
      { rotulo: 'O lugar (casa ou academia)', valor: 'respostas' },
      { rotulo: 'Trocar alguns exercícios', valor: 'trocas' },
      { rotulo: 'Outro treino, mesmas respostas', valor: 'novo' },
    ],
    proximo: (v, c) => {
      if (v === 'respostas') return { texto: ['Isso muda nas respostas da entrevista.', 'O Treinador monta o plano novo e mostra antes de você aceitar.'], ir: [{ rotulo: 'Mudar as respostas', abrir: 'treinador-entrevista' }] };
      const plan = P.planoAtivo(c.st);
      let sd = null;
      try { sd = saudeDoTreinador(c.st, c.hoje); } catch { sd = null; }
      const resp = sd ? sd.respostas : a;
      let dores = [];
      try { dores = doresDoTreino(c.st, c.hoje, resp); } catch { dores = []; }
      if (v === 'trocas') {
        if (!plan) return { texto: ['Você ainda não tem um plano ativo.'], ir: [{ rotulo: 'Abrir o Treinador', rota: 'treinador' }] };
        let tr = [];
        try { tr = sugerirTrocas(plan, resp, c.st.gym, 2, dores); } catch { tr = []; }
        if (!tr.length) return { texto: ['Não achei trocas boas agora: os exercícios do plano já são os melhores para os seus aparelhos e o seu perfil.'] };
        const linhas = tr.slice(0, 4).map((x) => `• ${x.dia}: sai ${exDe({ ex: x.de }).nome}, entra ${exDe({ ex: x.para }).nome}`);
        return { texto: [`Sugiro ${plural(tr.length, 'troca', 'trocas')}:`, ...linhas, 'Na tela do Treinador você escolhe quais aceitar.'], detalhes: ['Os exercícios principais continuam: é neles que a carga mostra a sua evolução. As trocas são de auxiliares, pelo mesmo músculo.'], refs: ['bazvalle2019', 'iusca2021'], ir: [{ rotulo: 'Ver e escolher as trocas', abrir: 'treinador-trocas' }] };
      }
      let comb = null;
      try { comb = resumoCombinado(c.st, c.hoje); } catch { comb = null; }
      let prox = null;
      try { prox = outraVersao(resp, c.st.gym, c.st.trainer.versao || 0, { dores, plano: plan || undefined, combinado: comb }); } catch { prox = null; }
      if (!prox) return { texto: ['Com os seus aparelhos e respostas, não há outra combinação de exercícios. Para mudar mais, mude as respostas.'], ir: [{ rotulo: 'Mudar as respostas', abrir: 'treinador-entrevista' }] };
      return { texto: [`Montei outra versão do treino: ${plural(prox.trocados, 'exercício muda', 'exercícios mudam')}.`, 'Você vê o treino inteiro antes de aceitar. O atual fica guardado.'], ir: [{ rotulo: 'Ver a proposta', abrir: 'treinador-novo' }] };
    },
  };
}

// ---------- os assuntos ----------
const temPlano = (ctx) => !!P.planoAtivo(ctx.st);
function passoPerdidoInicio(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  let pode;
  try { pode = P.podeMarcar(ctx.st, ctx.hoje, ctx.hoje); } catch { pode = { pode: false, motivo: '' }; }
  if (!pode.pode) return semTreinoHoje(pode.motivo);
  return {
    texto: ['Tudo bem. O que aconteceu?'],
    opcoes: [
      { rotulo: 'Estou sem tempo', valor: 'tempo' }, { rotulo: 'Cansaço ou sono ruim', valor: 'cansaco' },
      { rotulo: 'Estou com dor', valor: 'dor' }, { rotulo: 'Estou doente', valor: 'doente' },
      { rotulo: 'Viagem', valor: 'viagem' }, { rotulo: 'Outro motivo', valor: 'outro' },
    ],
    proximo: (v, c) => {
      if (v === 'tempo') return { texto: ['Quer uma versão curta do treino de hoje?'], opcoes: [{ rotulo: 'Sim, versão curta', valor: 's' }, { rotulo: 'Não dá mesmo', valor: 'n' }], proximo: (x, cc) => (x === 's' ? passoTempo(cc) : passoPerdido(cc)) };
      if (v === 'cansaco') return passoCansaco(c);
      if (v === 'dor') return passoDor(c, 'treinador');
      if (v === 'doente') {
        const f = faqDe(FAQ_CORRIDA, 'Posso correr gripado');
        return passoPerdido(c, ['Com febre, dor no corpo ou cansaço fora do normal, não treine hoje.'], f ? f.a.slice(0, 2) : [], f ? f.refs : []);
      }
      if (v === 'viagem') return passoPerdido(c, [], ['Para quem já treina, 1 a 2 treinos por semana mantêm a força.', 'Ficou 2 semanas ou mais sem treinar? O app aplica sozinho as regras da volta.'], ['acsm2009', 'caterisano2019']);
      return passoPerdido(c);
    },
  };
}
function passoCansaco(ctx) {
  let noite = null, meta = null;
  try { noite = noiteDe(ctx.st, ctx.hoje); meta = metaDeSono(ctx.st, ctx.hoje); } catch { noite = null; }
  const texto = [];
  const refs = ['whitfield2017'];
  if (noite && meta && noite.horas < meta.min) { texto.push(`Você dormiu ${fmtHoras(noite.horas)} esta noite; o recomendado para você é ${fmtFaixa(meta.min, meta.max)}.`); refs.push(...(meta.motivos[0] ? meta.motivos[0].refs : [])); }
  else if (noite) texto.push(`Você registrou ${fmtHoras(noite.horas)} de sono esta noite.`);
  texto.push('Você decide: dá para fazer uma versão curta ou passar o treino.');
  return {
    texto,
    detalhes: ['Cansaço fora do comum nas atividades de sempre, que não passa, é um dos sinais da triagem antes do exercício: nesse caso, procure um médico.'],
    refs,
    opcoes: [{ rotulo: 'Versão curta', valor: 'curta' }, { rotulo: 'Passar o treino', valor: 'passar' }],
    proximo: (v, c) => (v === 'curta' ? passoTempo(c) : passoPerdido(c)),
    ir: noite ? undefined : [{ rotulo: 'Registrar o sono', rota: 'sono' }],
  };
}

export const INTENCOES = [
  {
    id: 'treino-perdido', coach: 'treinador', titulo: 'Não vou conseguir treinar hoje', resumo: 'faltar ao treino de hoje',
    palavras: ['nao vou treinar', 'nao vou conseguir treinar', 'nao consigo treinar', 'nao posso treinar', 'nao vou poder treinar', 'nao da treinar', 'nao deu treinar',
      'nao vou academia', 'nao vou poder ir academia', 'nao posso ir academia', 'nao quero ir academia', 'nao quero treinar', 'sem vontade treinar', 'nao vou conseguir ir academia', 'nao consigo ir academia', 'faltar treino', 'faltar academia', 'perder treino', 'perdi treino', 'pular treino',
      'nao treinei', 'nao vou malhar', 'faltar', 'remarcar treino', 'outro dia', 'adiar treino', 'deixar treino amanha', 'treinar amanha', 'imprevisto',
      'viagem', 'vou viajar', 'estou viajando', 'doente', 'cansado', 'estou cansado', 'to cansado', 'cansado treinar', 'estou doente', 'to doente', 'dormir mal', 'dormir pouco', 'mal dormir', 'sem condicao treinar', 'sem animo', 'sem vontade treinar'],
    disponivel: temPlano,
    inicio: passoPerdidoInicio,
  },
  {
    id: 'pouco-tempo', coach: 'treinador', titulo: 'Tenho pouco tempo hoje', resumo: 'um treino mais curto hoje',
    palavras: ['pouco tempo', 'sem tempo', 'nao tenho tempo', 'tempo curto', 'pressa', 'treino curto', 'treino rapido', 'versao curta', 'minuto', 'meia hora',
      'so tenho minuto', 'so minuto', 'tenho minuto', 'encurtar treino', 'reduzir treino', 'diminuir treino', 'treino menor', 'tempo apertado', 'dia corrido', 'quanto tempo', 'curto'],
    disponivel: (ctx) => !!treinoDeHoje(ctx),
    inicio: passoTempo,
  },
  {
    id: 'juntar-treino', coach: 'treinador', titulo: 'Corrida e musculação no mesmo dia', resumo: 'fazer corrida e musculação no mesmo dia',
    palavras: ['correr+musculacao', 'correr+treino+juntar', 'correr+treino+mesmo dia', 'mesmo dia', 'juntar', 'juntar outro', 'juntar treino', 'correr depois', 'correr antes',
      'depois musculacao', 'antes musculacao', 'qual primeiro', 'ordem', 'prioridade', 'correr+academia'],
    disponivel: (ctx) => temOsDois(ctx.st),
    inicio: (ctx) => passoJuntar(ctx),
  },
  {
    id: 'carga', coach: 'treinador', titulo: 'Carga, séries e repetições', resumo: 'carga, séries, repetições ou descanso de um exercício',
    palavras: ['aumentar carga', 'aumento carga', 'subir carga', 'subo carga', 'aumentar peso', 'muito facil', 'ta facil', 'muito leve', 'muito pesado', 'ta pesado', 'carga', 'quanto carga', 'quanto peso', 'quantos quilo', 'serie', 'quantas serie', 'repeticao', 'quantas repeticao', 'descanso', 'quanto descanso', 'quanto tempo descanso',
      'aumentar carga', 'subir carga', 'progredir', 'progressao', 'evoluir', 'dose', 'exercicio', 'quanto tempo prancha', 'carga recomendada', 'qual carga'],
    disponivel: (ctx) => { const p = P.planoAtivo(ctx.st); return !!p && p.dias.some((d) => Array.isArray(d.itens) && d.itens.length); },
    inicio: passoCarga,
  },
  {
    id: 'mudar-plano', coach: 'treinador', titulo: 'Mudar ou refazer o treino', resumo: 'mudar ou refazer o seu treino',
    palavras: ['nao tenho halteres', 'sem halteres', 'nao tenho aparelho', 'sem aparelho', 'mudar plano', 'mudar treino', 'mudar dia', 'mudar dias', 'trocar dia', 'outro treino', 'treino novo', 'novo treino', 'refazer treino', 'refazer entrevista', 'refazer plano',
      'treinar casa', 'treino casa', 'trocar exercicio', 'mudar exercicio', 'enjoei treino', 'cansei treino', 'treino chato', 'mudar academia', 'mudar horario', 'plano novo', 'mudar', 'novo plano'],
    inicio: passoMudar,
  },
  {
    id: 'dor-treino', coach: 'treinador', titulo: 'Estou com dor', resumo: 'uma dor',
    palavras: ['dor', 'dor depois treino', 'dor muscular', 'machucar', 'lesao', 'tendinite', 'inflamado', 'inchado', 'inchaco', 'joelho dor', 'ombro dor', 'costas dor', 'dor joelho', 'dor ombro', 'dor costas', 'dor lombar', 'dor punho', 'dor cotovelo', 'dor tornozelo', 'dor quadril', 'lombar', 'torcer', 'dor articulacao', 'dor tendao', 'estou dor'],
    inicio: (ctx) => passoDor(ctx, 'treinador'),
  },
  {
    id: 'aparelho-ocupado', coach: 'treinador', titulo: 'O aparelho está ocupado', resumo: 'um aparelho ocupado na academia',
    palavras: ['aparelho ocupado', 'ocupado', 'aparelho', 'esperar aparelho', 'trocar aparelho', 'academia cheia', 'academia lotada', 'fila', 'nao tem aparelho', 'aparelho quebrado', 'sem aparelho'],
    disponivel: temPlano,
    inicio: (ctx) => {
      const b = bloqueio(ctx);
      if (b) return b;
      return {
        texto: ['No treino, toque nos três pontinhos do exercício e escolha “Aparelho ocupado”.', 'Eu mostro 2 ou 3 do mesmo movimento e músculo, com o que está livre.'],
        detalhes: ['As opções seguem as suas dores e limitações e os aparelhos marcados em “Minha academia”. Séries e repetições continuam as mesmas.'],
        ir: [ctx.st.current ? { rotulo: 'Voltar ao treino', rota: 'sessao' } : { rotulo: 'Ver os treinos', rota: 'treinos' }],
      };
    },
  },
];

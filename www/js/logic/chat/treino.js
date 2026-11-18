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
import { temOsDois, temCorrida, comboAtual } from '../combinado.js';
import { treinoDoDia as corridaDoDia, efeitoDoFoco as efeitoNaCorrida, perfil as perfilCorrida, saudeDaCorrida, efeitoDaDor } from '../corrida.js';
import { efeitoDoFoco as efeitoNaMusculacao } from '../trainer.js';
import { noiteDe, metaDeSono, fmtHoras, fmtFaixa } from '../sono.js';
import { aquecimentoRecomendado, ocupados, aparelhoOcupado } from '../guiado.js';
import { aplicarVariacao } from '../variacao.js';
import { diasBloqueados } from '../dias-livres.js';
import { EQUIPAMENTOS } from '../../data/equipment.js';
import { recomendacao, contextoDoEstado } from '../carga.js';
import { EX_POR_ID } from '../../data/exercises.js';
import { MUSCULOS } from '../../data/muscles.js';
import { exercicioDoTexto, numerosDoTexto } from './entidades.js';
import { passoAjustesDor } from './exercicio.js';
import { FAQ_TREINO } from '../../data/knowledge.js';
import { FAQ_CORRIDA } from '../../data/corrida.js';
import { faqDe, plural, fmtDescanso, juntar, diaValido, nomeDia, noDia, diaCurto, segundaDa, impedimento, tempoApertado } from './comum.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const emIso = (ctx) => new Date(Number.isFinite(ctx && ctx.agora) ? ctx.agora : Date.now()).toISOString();
// O dia de que a conversa fala (ctx.data, lido do texto pelo motor: "amanhã", "na sexta"...); sem ele, hoje
export const diaDe = (ctx) => (ctx && diaValido(ctx.data) ? ctx.data : ctx.hoje);
export const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

// ---------- leitura do estado ----------
function pfDoTreino(ctx) {
  try { return perfil(saudeDoTreinador(ctx.st, ctx.hoje).respostas); } catch { return perfil({}); }
}
// O treino de musculação que vale hoje (com as marcas da semana): { plan, dia } ou null
export const treinoDeHoje = (ctx) => treinoNoDia(ctx, ctx.hoje);
export function treinoNoDia(ctx, data) {
  const plan = P.planoAtivo(ctx.st);
  if (!plan) return null;
  let t = null;
  try { t = P.treinoDoDia(ctx.st, data); } catch { t = null; }
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
function semTreinoNoDia(motivo, data, hoje) {
  const quando = noDia(data, hoje), de = data === hoje ? 'de hoje' : `de ${nomeDia(data, hoje)}`;
  const t = {
    treinou: data === hoje ? 'Você já treinou hoje. Bom trabalho!' : `Você já treinou ${quando}.`,
    marcado: `O treino ${de} já está marcado como não feito.`,
    em_andamento: 'Você tem um treino em andamento.',
    sem_treino: `${cap(quando)} não tem musculação no seu plano.`,
    outra_semana: 'Só dá para remarcar os dias desta semana. Na outra semana, fale comigo no dia.',
    antes_do_plano: 'Esse dia é de antes do seu plano começar.',
  }[motivo] || `${cap(quando)} não há treino do plano para marcar.`;
  return { texto: [t], ir: [motivo === 'em_andamento' ? { rotulo: 'Voltar ao treino', rota: 'sessao' } : { rotulo: 'Ver a semana', rota: 'treinos' }] };
}
const semTreinoHoje = (motivo, ctx) => semTreinoNoDia(motivo, ctx.hoje, ctx.hoje);
// Ação que grava a marca "Não treinei" de `data` (a mesma da folha de views/perdido.js; para um dia que ainda não chegou,
// a mesma regra com P.propor(..., { futuro: true })). `motivo`: uma chave de P.MOTIVOS, guardada na marca.
function acaoMarcar(p, escolha, hoje, data = hoje, motivo = '') {
  const para = p.movs.length ? P.nomeDoDia(p.movs[0].para, hoje) : '';
  // o dia da proposta vai junto: a marca grava a mesma mudança que a pessoa viu
  const futuro = { futuro: data > hoje, motivo, para: escolha === 'mover' && p.movs.length ? p.movs[0].para : '' };
  const doDia = data === hoje ? '' : ` de ${nomeDia(data, hoje)}`;
  return {
    rotulo: escolha === 'mover' ? `Passar para ${para}` : 'Seguir a semana',
    confirmar: escolha === 'mover' ? `O ${p.nome}${doDia} passa para ${para}. ${p.texto}` : `O ${p.nome}${doDia} fica como não feito e volta ${P.naProxima(data)}.`,
    aplicar: (s, ctx) => {
      const m = P.novaMarca(s, data, ctx.hoje, escolha, emIso(ctx), futuro);
      if (!m || (escolha === 'mover' && !m.movs.length)) return false;
      s.perdidos = P.limparPerdidos([...(Array.isArray(s.perdidos) ? s.perdidos : []), m]);
      return true;
    },
    data, semana: true,
    depois: escolha === 'mover' ? `Pronto: ${p.nome} passou para ${para}.` : `Pronto. O ${p.nome} volta ${P.naProxima(data)}.`,
  };
}
// A proposta do app para o treino do dia da conversa (hoje, ou outro desta semana), com as escolhas da folha "Não treinei".
// `ctx.motivo` (P.MOTIVOS) vai para a marca; com cansaço ou doença, "seguir a semana" vem primeiro (logic/perdido.js).
// `ctx.quer`: o dia que a pessoa pediu ("posso fazer amanhã?"): se as regras deixam, a proposta é ele; se não, o porquê.
export function passoPerdido(ctx, antes = [], detalhes = [], refs = []) {
  const data = diaDe(ctx);
  const motivo = P.MOTIVOS[ctx.motivo] ? ctx.motivo : '';
  const futuro = { futuro: data > ctx.hoje };
  let p;
  try { p = P.propor(ctx.st, data, ctx.hoje, futuro); } catch { p = { pode: false, motivo: '' }; }
  if (!p.pode) return semTreinoNoDia(p.motivo, data, ctx.hoje);
  const texto = [...antes];
  if (diaValido(ctx.quer)) {
    let o = null;
    try { o = P.opcoesDeDia(ctx.st, data, ctx.hoje, futuro); } catch { o = null; }
    const d = o && o.dias.find((x) => x.data === ctx.quer);
    if (d && d.pode) p = { ...p, movs: d.movs, titulo: d.titulo, texto: d.texto, motivo: 'livre' };
    else if (d) texto.push(P.porQueNaoDia(d, ctx.hoje, o.alternado));
    else texto.push('Só dá para passar o treino para um dia depois dele, nesta semana.');
  }
  texto.push(p.titulo, p.texto);
  if (p.movs.length) {
    let linha = '';
    try { linha = P.linhaDaSemana(P.comMarca(ctx.st, P.novaMarca(ctx.st, data, ctx.hoje, 'mover', emIso(ctx), { ...futuro, para: p.movs[0].para })), ctx.hoje, 'musc'); } catch { linha = ''; }
    if (linha) texto.push(`Como fica: ${linha}.`);
  }
  const foco = (() => { try { return comboAtual(ctx.st).foco; } catch { return ''; } })();
  const ajusta = foco === 'corrida' || foco === 'equilibrio';
  const det = [...detalhes];
  const rf = [...refs];
  let aviso;
  if (motivo === 'cansaco') {
    const c = P.cansacoRecente(ctx.st, ctx.hoje);
    if (c.maisDeUmaSemana) aviso = { tipo: 'warn', texto: 'O cansaço já passa de uma semana. Isso pede treinos mais leves ou descanso. Se passar de 4 semanas, procure um médico.' };
    det.push('Cansaço alto por mais de uma semana pede treinos mais leves ou descanso; com queda de rendimento por mais de 4 semanas, um médico.');
    rf.push(...P.REFS_CANSACO);
  }
  const mover = p.movs.length ? acaoMarcar(p, 'mover', ctx.hoje, data, motivo) : null;
  const seguir = acaoMarcar(p, 'seguir', ctx.hoje, data, motivo);
  const naoRepor = motivo === 'cansaco' || motivo === 'doente';
  return {
    texto, aviso,
    detalhes: [...det, ...POR_QUE_PERDIDO, ...(ajusta ? ['Com a corrida, as pernas ficam a 24 horas ou mais da corrida forte e do longo.'] : [])],
    refs: [...rf, ...P.REFS_MUSCULACAO, ...(ajusta ? P.REFS_COMBINADO : [])],
    acoes: mover ? (naoRepor ? [seguir, mover] : [mover, seguir]) : [seguir],
    data,
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
  // outro dia: a versão curta só sai no dia (o treino começa na hora)
  if (diaDe(ctx) !== ctx.hoje) {
    const t = treinoNoDia(ctx, diaDe(ctx));
    if (!t) return semTreinoNoDia('sem_treino', diaDe(ctx), ctx.hoje);
    return { texto: [`O ${t.dia.nome} ${noDia(diaDe(ctx), ctx.hoje)} leva cerca de ${duracaoEstimada(t.dia)} min.`, 'No dia, me diga quanto tempo você tem: eu monto uma versão mais curta na hora.'], refs: ['iversen2021'], ir: [{ rotulo: 'Ver o treino', rota: `treino/${t.plan.id}/${t.dia.id}` }] };
  }
  const t = treinoDeHoje(ctx);
  if (!t) return semTreinoHoje('sem_treino', ctx);
  if (ctx.st.current) return semTreinoHoje('em_andamento', ctx);
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
  if (!t) return semTreinoHoje('sem_treino', ctx);
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
      texto: [`Hoje não junte os dois: ${corrida.tipo === 'longo' ? 'o longão' : 'a corrida forte'} e o treino de pernas ficam a 24 horas ou mais um do outro. Escolha um:`],
      detalhes: [quem, 'Depois do treino pesado de pernas, o rendimento na corrida cai por 24 a 48 horas.', 'Corrida perdida não se repõe: o plano segue.', ...det],
      refs: [...refs, 'blagrove2018', 'doma2017', ...P.REFS_CORRIDA], acoes, ir,
    };
  }
  const texto = [];
  if (!corrida && !t) texto.push('Hoje o plano não tem corrida nem musculação. Nos dias com os dois:');
  else if (!corrida) texto.push(correuHoje(ctx) ? 'Você já correu hoje.' : 'Hoje o plano não tem corrida. Nos dias com os dois:');
  else if (!t) texto.push('Hoje o plano não tem musculação. Nos dias com os dois:');
  const leve = corrida && !chave;
  const ordem = foco === 'musculacao' ? 'Comece pela musculação.' : leve ? 'A ordem tanto faz: a corrida de hoje é leve.' : 'Comece pela corrida.';
  // a pessoa perguntou de um intervalo curto ("menos de 1 hora", "logo depois", "40 minutos")? (Schumann 2022: "mesma
  // sessão" = 20 minutos ou menos; separadas = 3 horas ou mais; Petré 2021: separadas = mais de 2 horas)
  const tx = typeof ctx.texto === 'string' ? ctx.texto : '';
  let minutos = null;
  try { const ns = numerosDoTexto(tx).filter((x) => x.unidade === 'min'); if (ns.length) minutos = Math.min(...ns.map((x) => x.n)); } catch { minutos = null; }
  const colado = /\b(logo depois|logo apos|em seguida|seguida|colado|um atras do outro|um depois do outro|seguido do outro|um seguido|sem intervalo|direto)\b/.test(tx);
  if ((minutos != null && minutos < 180) || colado) {
    texto.push(`Pode. ${ordem}`, 'Com menos de 3 horas entre os dois, o segundo treino rende um pouco menos.');
    det.unshift(quem, 'Massa muscular e força máxima crescem igual com os dois juntos.', 'Com até 20 minutos entre eles, a força explosiva cresce um pouco menos; em quem já treina há tempo, a força das pernas também.', 'Com 3 horas ou mais, essa diferença não apareceu. Por isso a prioridade vem primeiro.');
  } else {
    texto.push(ordem, 'Se der, deixe de 3 a 6 horas entre os dois.');
    det.unshift(quem, 'Um logo depois do outro também dá, mas o segundo rende menos. Por isso a prioridade vem primeiro.');
  }
  refs.push('eddens2018', 'petre2021', 'schumann2022', 'methenitis2018');
  let aviso;
  if (pernas && corrida && pf.nivel === 1) { aviso = { tipo: 'info', texto: 'Nas primeiras semanas de musculação, as pernas demoram 48 horas para render de novo na corrida: vá com calma.' }; refs.push('doma2017'); }
  else if (gestante) { aviso = { tipo: 'warn', texto: 'Na gestação, os dois em intensidade leve a moderada: dá para conversar durante o esforço.' }; refs.push('acog804', 'sbc_gestacao2021'); }
  else if (doresAtivas(ctx.st, ctx.hoje).length) aviso = { tipo: 'info', texto: 'Com a dor que você contou, siga os ajustes que o plano já fez para ela.' };
  if (!corrida && !t) ir.length = 0;
  return { texto, aviso, detalhes: det, refs, ir };
}
// "Não corri" de hoje (a mesma marca da folha de views/perdido.js)
export function acaoNaoCorrer(rotulo = 'Marcar como não feita', data = '', motivo = '') {
  return {
    rotulo,
    confirmar: `A corrida ${data ? 'desse dia' : 'de hoje'} fica marcada como não feita. Ela não se repõe: o plano segue.`,
    aplicar: (s, ctx) => {
      const dia = data || ctx.hoje;
      if (!P.podeMarcarCorrida(s, dia, ctx.hoje)) return false;
      const m = P.marcaCorrida(dia, emIso(ctx), motivo);
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
  // com dor já contada: o que o treino muda por ela, aplicável ali mesmo (logic/chat/exercicio.js, passoAjustesDor)
  if (coach === 'treinador' && ativas.length && P.planoAtivo(ctx.st)) tipos.push({ rotulo: 'Ajustar o treino pela dor', valor: 'ajustar' });
  const contar = { rotulo: ativas.length ? 'Contar outra dor' : 'Contar a dor ao Treinador', abrir: 'contar-dor' };
  return {
    texto: [...antes, 'Como é a dor?'],
    detalhes: depois,
    refs,
    opcoes: tipos,
    proximo: (v, c) => {
      if (v === 'ajustar') return passoAjustesDor(c || ctx);
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
  // o exercício citado ("quantas séries de agachamento?", "posso aumentar o peso no supino?"): direto nele; com mais de
  // um do plano com esse nome, a pessoa escolhe (logic/chat/entidades.js)
  const doItem = (id) => { for (const d of ordem) { const it = d.itens.find((x) => x && x.ex === id); if (it) return { d, it }; } return null; };
  let achou = null;
  if (typeof ctx.ex === 'string' && EX_POR_ID.has(ctx.ex)) achou = { ex: EX_POR_ID.get(ctx.ex), candidatos: [] };
  else if (typeof ctx.texto === 'string' && ctx.texto) { try { achou = exercicioDoTexto(ctx.texto, plan); } catch { achou = null; } }
  if (achou && achou.ex && doItem(achou.ex.id)) { const x = doItem(achou.ex.id); return { ...passoDose(ctx, plan, x.d, x.it), ex: achou.ex.id }; }
  const cands = achou && !achou.ex ? achou.candidatos.filter((e) => doItem(e.id)) : [];
  if (cands.length > 1) return { texto: ['Qual deles?'], opcoes: cands.slice(0, 6).map((e) => ({ rotulo: e.nome, valor: e.id })), proximo: (v, c) => { const x = doItem(v); return x ? { ...passoDose(c, plan, x.d, x.it), ex: v } : { texto: ['Não achei esse exercício no plano.'] }; } };
  const fora = achou && achou.ex && !achou.noPlano ? `${achou.ex.nome} não está no seu plano. ` : '';
  if (fora) return { ...escolherExercicio(ctx, plan, ordem[0]), aviso: { tipo: 'info', texto: fora + 'Veja os do plano.' } };
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
      { rotulo: 'Dias, tempo ou lugar do treino', valor: 'respostas' },
      { rotulo: 'Trocar alguns exercícios', valor: 'trocas' },
      { rotulo: 'Não tenho um aparelho', valor: 'aparelho' },
      { rotulo: 'A ordem dos exercícios', valor: 'ordem' },
      { rotulo: 'Séries, repetições ou carga', valor: 'dose' },
      { rotulo: 'Outro treino, mesmas respostas', valor: 'novo' },
    ],
    proximo: (v, c) => {
      if (v === 'aparelho') return passoAparelhoFalta(c);
      if (v === 'dose') return passoCarga(c);
      if (v === 'ordem') return passoOrdem(c);
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

// ---------- a semana (logic/perdido.js: semanaEfetiva e semanaDoChat) ----------
// Os 7 dias, com o que foi feito, o que ficou sem fazer e o que mudou de dia. `coach`: o treinador da conversa (a mesma
// semana nos dois chats; o da corrida abre a tela da corrida).
export function passoSemana(ctx, coach = 'treinador') {
  const b = bloqueio(ctx);
  if (b) return b;
  const data = diaDe(ctx), hoje = ctx.hoje;
  let sem = [];
  try { sem = P.semanaDoChat(ctx.st, data, hoje); } catch { sem = []; }
  if (!sem.length) return { texto: ['Não consegui montar a semana agora.'], ir: [{ rotulo: 'Ver a semana', rota: 'treinos' }] };
  const livres = new Set((() => { try { return diasBloqueados(ctx.st); } catch { return []; } })());
  const temPlano = !!P.planoAtivo(ctx.st);
  const linhas = sem.map((d) => {
    const partes = [];
    if (d.feito && !d.nome) partes.push('musculação feita');
    else if (d.nome) partes.push(d.nome + (d.feito ? ' (feito)' : d.veioDe ? ` (veio de ${nomeDia(d.veioDe, hoje)})` : ''));
    const porMotivo = (m) => (P.MOTIVO_CURTO[m] ? ` (${P.MOTIVO_CURTO[m]})` : '');
    if (d.perdido) partes.push(`${d.perdido.nome} não feito${porMotivo(d.perdido.motivo)}` + (d.perdido.para ? `, passou para ${nomeDia(d.perdido.para, hoje)}` : ''));
    if (d.foiPara && d.saiu) partes.push(`${d.saiu} passou para ${nomeDia(d.foiPara, hoje)}`);
    const c = d.corrida;
    if (c) partes.push(c.nome + (c.feita ? ' (feita)' : c.movidaPara ? ` (passou para ${nomeDia(c.movidaPara, hoje)})` : c.perdida ? ` (não feita${P.MOTIVO_CURTO[c.motivo] ? ', ' + P.MOTIVO_CURTO[c.motivo] : ''})` : c.movidaDe ? ` (veio de ${nomeDia(c.movidaDe, hoje)})` : ''));
    if (d.extra) partes.push('corrida fora do plano');
    if (!partes.length) partes.push(livres.has(d.wd) ? 'sem treino (dia livre)' : 'descanso');
    return `• ${diaCurto(d.data)}${d.data === hoje ? ' (hoje)' : ''}: ${partes.join(' · ')}`;
  });
  const seg = segundaDa(data), segHoje = segundaDa(hoje);
  const titulo = seg === segHoje ? 'Sua semana:' : seg > segHoje ? 'A semana que vem, como está prevista hoje:' : 'Aquela semana:';
  const detalhes = [];
  const refs = [];
  if (temPlano) { detalhes.push(...POR_QUE_PERDIDO); refs.push(...P.REFS_MUSCULACAO); }
  if (sem.some((d) => d.corrida)) { detalhes.push('Corrida perdida não se repõe: juntar duas faz uma corrida maior, e o risco de lesão sobe.'); refs.push(...P.REFS_CORRIDA); }
  if (seg > segHoje) detalhes.push('As corridas da semana que vem ainda podem mudar com o que você registrar nesta.');
  // cansaço como motivo por mais de uma semana: a regra que o app já usa (logic/perdido.js, cansacoRecente)
  let aviso;
  try { if (seg === segHoje && P.cansacoRecente(ctx.st, hoje).maisDeUmaSemana) { aviso = { tipo: 'warn', texto: 'O cansaço já tirou treinos por mais de uma semana. Isso pede treinos mais leves ou descanso. Se passar de 4 semanas, procure um médico.' }; refs.push(...P.REFS_CANSACO); } } catch { /* segue */ }
  const ir = coach === 'corrida' ? [{ rotulo: 'Abrir a corrida', rota: 'corrida' }] : [{ rotulo: 'Ver a semana', rota: 'treinos' }];
  return { texto: [titulo, ...linhas], aviso, detalhes, refs, ir, data };
}

// ---------- o treino de um dia, quanto tempo dura, dois dias seguidos, adiantar ----------
const primeiros = (dia, n = 3) => dia.itens.filter((it) => EX_POR_ID.has(it.ex) && !ehCardio(it)).slice(0, n).map((it) => exDe(it).nome.toLowerCase());
function corridaNoDia(ctx, data) {
  try { const d = corridaDoDia(ctx.st, ctx.hoje, data); return d && d.tipo && d.tipo !== 'descanso' ? d : null; } catch { return null; }
}
export function passoDoDia(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  const data = diaDe(ctx), hoje = ctx.hoje, quando = noDia(data, hoje);
  const t = treinoNoDia(ctx, data);
  let ef = null;
  try { ef = P.treinoDoDia(ctx.st, data); } catch { ef = null; }
  const c = corridaNoDia(ctx, data);
  const texto = [];
  const plan = P.planoAtivo(ctx.st);
  if (t) {
    const dur = duracaoEstimada(t.dia);
    texto.push(`${cap(quando)} é ${t.dia.nome}: ${plural(t.dia.itens.length, 'exercício', 'exercícios')}, cerca de ${dur} min.`);
    const pr = primeiros(t.dia);
    if (pr.length) texto.push(`Começa com ${juntar(pr)}.`);
    if (ef && ef.veioDe) texto.push(`Ele veio de ${nomeDia(ef.veioDe, hoje)}.`);
  } else if (ef && ef.perdido && plan) {
    const d = plan.dias.find((x) => x.id === ef.perdido.diaId);
    texto.push(`O ${d ? d.nome : 'treino'} ${data === hoje ? 'de hoje' : 'de ' + nomeDia(data, hoje)} está marcado como não feito${ef.perdido.para ? ` e passou para ${nomeDia(ef.perdido.para, hoje)}` : ''}.`);
  } else if (ef && ef.foiPara && plan) {
    const d = plan.dias.find((x) => x.id === plan.agenda[P.diaDaSemana(data)]);
    texto.push(`O ${d ? d.nome : 'treino'} ${data === hoje ? 'de hoje' : 'de ' + nomeDia(data, hoje)} passou para ${nomeDia(ef.foiPara, hoje)}.`);
  } else texto.push(`${cap(quando)} não tem musculação no seu plano.`);
  if (c) texto.push(`${t ? 'E tem' : 'Tem'} corrida: ${String(c.nome).toLowerCase()}${c.resumo ? ` (${c.resumo})` : ''}.`);
  const out = { texto, data, ir: t ? [{ rotulo: 'Ver o treino', rota: `treino/${t.plan.id}/${t.dia.id}` }] : [{ rotulo: 'Ver a semana', rota: 'treinos' }] };
  if (c) out.ir.push({ rotulo: 'Abrir a corrida', rota: 'corrida/dia/' + data });
  if (t && data === hoje && !treinouHoje(ctx) && !ctx.st.current) {
    out.opcoes = [{ rotulo: 'Tenho pouco tempo', valor: 'tempo' }, { rotulo: 'Hoje não vou conseguir', valor: 'faltar' }];
    out.proximo = (v, cc) => (v === 'tempo' ? passoTempo(cc) : passoPerdido({ ...cc, data }));
  } else if (t && data > hoje && segundaDa(data) === segundaDa(hoje)) {
    out.opcoes = [{ rotulo: 'Fazer hoje', valor: 'hoje' }, { rotulo: `Não vou poder ${quando}`, valor: 'faltar' }, { rotulo: 'Como fica a semana', valor: 'semana' }];
    out.proximo = (v, cc) => (v === 'hoje' ? passoAntecipar({ ...cc, data }) : v === 'semana' ? passoSemana({ ...cc, data }) : passoPerdido({ ...cc, data }));
  }
  return out;
}
export function passoDuracao(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  const data = diaDe(ctx), hoje = ctx.hoje;
  const t = treinoNoDia(ctx, data);
  const c = corridaNoDia(ctx, data);
  if (!t && !c) return semTreinoNoDia('sem_treino', data, hoje);
  const texto = [];
  if (t) texto.push(`O ${t.dia.nome} ${noDia(data, hoje)} leva cerca de ${duracaoEstimada(t.dia)} min, contando o descanso entre as séries.`);
  if (c && c.durMin) texto.push(`A corrida (${String(c.nome).toLowerCase()}) leva cerca de ${Math.round(c.durMin)} min.`);
  const out = { texto, data, detalhes: ['A conta soma as séries, o tempo de cada repetição e o descanso do plano: é a mesma das telas de treino.'] };
  const dur = t ? duracaoEstimada(t.dia) : 0;
  if (t && data === hoje && !ctx.st.current && TEMPOS.some((m) => m < dur)) {
    out.opcoes = [{ rotulo: 'Tenho menos tempo', valor: 'menos' }, { rotulo: 'Está bom assim', valor: 'ok' }];
    out.proximo = (v, cc) => (v === 'menos' ? passoTempo(cc) : { texto: ['Bom treino!'], ir: [{ rotulo: 'Ver o treino', rota: `treino/${t.plan.id}/${t.dia.id}` }] });
  } else if (t) out.ir = [{ rotulo: 'Ver o treino', rota: `treino/${t.plan.id}/${t.dia.id}` }];
  return out;
}
export function passoSeguidos(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  const pf = pfDoTreino(ctx);
  const alternado = !!(pf.jovem || pf.diabetes);
  const texto = alternado
    ? ['Para você, a musculação fica em dias não seguidos: um dia de treino, outro de descanso.']
    : ['Pode, se forem músculos diferentes: superiores num dia e pernas no outro, por exemplo.', 'O mesmo músculo, com treino pesado, pede 48 horas de descanso.'];
  texto.push(pf.jovem ? 'Tenha pelo menos 2 dias sem treino na semana.' : 'Tenha pelo menos 1 dia sem treino na semana.');
  const refs = ['garber2011', 'acsm2009', 'meeusen2013', ...(pf.jovem ? ['valovichmcleod2011', 'faigenbaum2009'] : []), ...(pf.diabetes ? ['colberg2016'] : [])];
  const detalhes = ['É a regra que o plano já usa: ele nunca põe o mesmo músculo pesado em dias seguidos nem dois treinos no mesmo dia.'];
  // a semana desta pessoa: dias seguidos com musculação, e se dividem músculos
  const plan = P.planoAtivo(ctx.st);
  if (plan) {
    const sem = P.semanaEfetiva(plan, ctx.st.perdidos, segundaDa(diaDe(ctx)));
    const diaPor = (id) => plan.dias.find((x) => x.id === id);
    for (let k = 0; k < 6; k++) {
      const a = sem[k].diaId && diaPor(sem[k].diaId), bb = sem[k + 1].diaId && diaPor(sem[k + 1].diaId);
      if (a && bb && !P.choca(P.cargaDoTreino(a), P.cargaDoTreino(bb))) { detalhes.push(`Na sua semana, ${a.nome} e ${bb.nome} ficam em dias seguidos porque trabalham músculos diferentes.`); break; }
    }
  }
  if (pf.diabetes) detalhes.push('Com diabetes, a recomendação é força em dias não seguidos.');
  if (pf.jovem) detalhes.push('Antes dos 18 anos, a força fica em dias não seguidos, com 2 dias de descanso na semana.');
  return { texto, detalhes, refs, ir: [{ rotulo: 'Ver a semana', rota: 'treinos' }] };
}
// O treino de outro dia desta semana feito hoje (marca "troca" de logic/perdido.js, avaliarTroca)
export function passoAntecipar(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  const hoje = ctx.hoje, plan = P.planoAtivo(ctx.st);
  if (!plan) return semTreinoNoDia('sem_treino', hoje, hoje);
  let de = diaDe(ctx), para = hoje;
  const ds = (Array.isArray(ctx.datas) ? ctx.datas : []).filter((x) => x && !x.semana && diaValido(x.data) && x.data >= hoje).map((x) => x.data).sort();
  if (ds.length >= 2 && ds[0] !== ds[ds.length - 1]) { para = ds[0]; de = ds[ds.length - 1]; }
  if (de <= hoje) {
    // sem dia dito: o próximo treino da semana
    const sem = P.semanaEfetiva(plan, ctx.st.perdidos, segundaDa(hoje));
    const prox = sem.find((d) => d.data > hoje && d.diaId);
    if (!prox) return { texto: ['Não há outro treino nesta semana para trazer para hoje.'], ir: [{ rotulo: 'Ver a semana', rota: 'treinos' }] };
    de = prox.data;
  }
  let a;
  try { a = P.avaliarTroca(ctx.st, de, para, hoje); } catch { a = { pode: false, motivo: '' }; }
  const nomeDe = nomeDia(de, hoje), nomePara = nomeDia(para, hoje);
  const refs = ['garber2011', 'acsm2009', 'meeusen2013'];
  if (a.pode) {
    return {
      texto: [`Pode: o ${a.nome} de ${nomeDe} vem para ${nomePara}.`, `${cap(nomeDe)} fica sem musculação.`],
      detalhes: ['Conferi as 48 horas de descanso para os mesmos músculos, os dias livres, a corrida da semana e pelo menos um dia sem treino.'],
      refs,
      acoes: [{
        rotulo: `Fazer o ${a.nome} ${para === hoje ? 'hoje' : nomePara}`, confirmar: `O ${a.nome} sai de ${nomeDe} e passa para ${nomePara}. Os outros dias não mudam.`,
        aplicar: (s, c) => { const m = P.marcaTroca(s, de, para, c.hoje, emIso(c)); if (!m) return false; s.perdidos = P.limparPerdidos([...(Array.isArray(s.perdidos) ? s.perdidos : []), m]); return true; },
        depois: `Pronto: o ${a.nome} ficou para ${nomePara}.`, data: para, semana: true,
      }],
      data: de,
    };
  }
  const porque = {
    ocupado: `${cap(nomePara)} já tem o ${a.ocupadoPor || 'treino do dia'}: o app não junta dois treinos no mesmo dia.`,
    treinou: 'Você já treinou hoje: o app não junta dois treinos no mesmo dia.',
    bloqueado: `${cap(nomePara)} é um dos dias em que você não treina.`,
    saude: `${cap(nomePara)}, o problema de saúde que você contou ainda muda o treino: não traga outro treino para esse dia.`,
    sem_descanso: `${cap(nomePara)}, o ${a.nome} ficaria sem as 48 horas de descanso para os mesmos músculos (ou a semana ficaria sem um dia livre).`,
    corrida: `${cap(nomePara)}, o treino de pernas ficaria perto da corrida forte ou do longão.`,
    feito: `O treino de ${nomeDe} já foi feito.`,
  }[a.motivo] || `${cap(nomeDe)} não tem treino para trazer para hoje.`;
  const out = { texto: [porque], refs, data: de, ir: [{ rotulo: 'Ver a semana', rota: 'treinos' }] };
  if (a.motivo === 'ocupado' && para === hoje) { out.texto.push('Se hoje não der para treinar, posso remarcar o de hoje.'); out.opcoes = [{ rotulo: 'Remarcar o de hoje', valor: 'r' }, { rotulo: 'Como fica a semana', valor: 's' }]; out.proximo = (v, cc) => (v === 'r' ? passoPerdido({ ...cc, data: hoje }) : passoSemana(cc)); }
  if (a.motivo === 'corrida') out.refs.push('blagrove2018', 'doma2017');
  return out;
}

// ---------- a ordem dos exercícios ----------
function passoOrdem(ctx) {
  const t = treinoNoDia(ctx, diaDe(ctx));
  return {
    texto: ['No treino, toque nos três pontinhos do exercício e escolha “Fazer antes” ou “Fazer depois”: vale só para aquele dia.', 'Para mudar no plano, edite o treino.'],
    detalhes: ['No plano, os exercícios de várias articulações e dos músculos grandes vêm antes dos isolados, como recomenda o ACSM: eles pedem mais força e técnica.'],
    refs: ['acsm2009'],
    ir: [t ? { rotulo: 'Editar o treino', rota: `treino/${t.plan.id}/${t.dia.id}` } : { rotulo: 'Ver os treinos', rota: 'treinos' }],
  };
}

// ---------- "esse aparelho não tem na minha academia" ----------
// Troca o exercício NO PLANO por um do mesmo movimento e músculo que dispensa o aparelho (logic/guiado.js aparelhoOcupado,
// com as regras de alternativas() do Treinador: aparelhos, limitações, saúde e dores) e, se a pessoa quiser, desmarca o
// aparelho em "Minha academia" (state.gym), para as próximas escolhas.
const GENERICAS = new Set(['com', 'de', 'do', 'da', 'na', 'no', 'em', 'e', 'a', 'o', 'para', 'reto', 'reta', 'sentado', 'sentada', 'livre', 'pe', 'maquina', 'barra', 'halteres', 'halter', 'unilateral', 'alternado', 'alternada', 'pegada', 'aberta', 'fechada', 'neutra', 'banco', 'cabo', 'peso', 'corporal', 'aparelho', 'frente', 'costas', 'tipo', 'alta', 'baixa', 'apoio', 'apoiado', 'parado', 'chao', 'joelhos', 'ajoelhado', 'corda', 'inclinado', 'declinado', 'articulada', 'articulado']);
const tokens = (t) => normalizarTxt(t).split(' ').filter((w) => w.length >= 3 && !GENERICAS.has(w));
const normalizarTxt = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// O item do plano citado no texto ("não tem leg press", "o smith está quebrado"): { it, ex } ou null; com o nome de um
// aparelho que mais de um exercício do plano usa, { lista: [ex, ...] }
export function exercicioNoTexto(texto, plan) {
  const t = ' ' + normalizarTxt(texto) + ' ';
  if (!plan || t.trim().length < 3) return null;
  const itens = plan.dias.flatMap((d) => d.itens).filter((it) => EX_POR_ID.has(it.ex));
  let melhor = null, pts = 0, empate = false;
  const vistos = new Set(), doAparelho = [];
  for (const it of itens) {
    if (vistos.has(it.ex)) continue;
    vistos.add(it.ex);
    const ex = exDe(it);
    let p = tokens(ex.nome).filter((w) => t.includes(' ' + w + ' ') || (w.length >= 6 && t.includes(' ' + w.slice(0, -1)))).length;
    // o nome do aparelho ("leg press", "smith", "crossover") vale mais que uma palavra do exercício
    for (const k of ocupados(ex)) { const n = EQUIPAMENTOS[k] ? tokens(EQUIPAMENTOS[k].nome.split(/[(/]/)[0]) : []; if (n.length && n.every((w) => t.includes(' ' + w + ' '))) { p += 2; doAparelho.push(ex); } }
    if (p > pts) { melhor = { it, ex }; pts = p; empate = false; } else if (p && p === pts) empate = true;
  }
  if (pts > 0 && !empate) return melhor;
  return doAparelho.length > 1 ? { lista: doAparelho } : null;
}
const nomesEquip = (ks) => juntar(ks.map((k) => (EQUIPAMENTOS[k] ? EQUIPAMENTOS[k].nome.split(' (')[0].toLowerCase() : k)));
export function passoAparelhoFalta(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  const plan = P.planoAtivo(ctx.st);
  if (!plan) return { texto: ['Você ainda não tem um plano ativo.'], ir: [{ rotulo: 'Abrir o Treinador', rota: 'treinador' }] };
  const achou = typeof ctx.texto === 'string' ? exercicioNoTexto(ctx.texto, plan) : null;
  if (achou && achou.ex) return passoFalta(ctx, achou.ex);
  // sem o exercício no texto: escolhe entre os que usam um aparelho que "fica num lugar" (máquina, polia, Smith...)
  const vistos = new Set();
  const lista = achou && achou.lista ? achou.lista : plan.dias.flatMap((d) => d.itens).filter((it) => { if (!EX_POR_ID.has(it.ex) || vistos.has(it.ex)) return false; vistos.add(it.ex); return ocupados(exDe(it)).length > 0; }).map((it) => exDe(it));
  if (!lista.length) return { texto: ['Os exercícios do seu plano usam pesos livres ou o peso do corpo.', 'Diga o nome do exercício que não dá para fazer.'], ir: [{ rotulo: 'Ver os treinos', rota: 'treinos' }] };
  const pagina = (ini) => {
    const vis = lista.slice(ini, ini + (lista.length - ini > 6 ? 5 : 6));
    const opcoes = vis.map((ex) => ({ rotulo: ex.nome, valor: ex.id }));
    if (ini + vis.length < lista.length) opcoes.push({ rotulo: 'Mais exercícios', valor: '#mais' });
    if (opcoes.length === 1) return passoFalta(ctx, vis[0]);
    return { texto: [ini ? 'Mais exercícios do plano:' : 'Qual exercício do plano não dá para fazer?'], opcoes, proximo: (v, c) => (v === '#mais' ? pagina(ini + vis.length) : passoFalta(c, EX_POR_ID.get(v))) };
  };
  return pagina(0);
}
function passoFalta(ctx, ex) {
  if (!ex) return { texto: ['Não achei esse exercício no plano.'] };
  const plan = P.planoAtivo(ctx.st);
  const gym = isObj(ctx.st.gym) ? ctx.st.gym : { all: true, has: {} };
  let falta = ocupados(ex);
  if (!falta.length) falta = ex.equip.slice();
  const has = {};
  for (const k of Object.keys(EQUIPAMENTOS)) if ((gym.all || gym.has[k] === true) && !falta.includes(k)) has[k] = true;
  const semAparelho = { all: false, has };
  let respostas = null, dores = [];
  try { respostas = respostasParaAvisos(ctx.st, ctx.hoje); } catch { respostas = null; }
  try { dores = doresDoTreino(ctx.st, ctx.hoje, respostas); } catch { dores = []; }
  const noPlano = new Set(plan.dias.flatMap((d) => d.itens.map((it) => it.ex)));
  let ids = [];
  try { ids = aparelhoOcupado(ex.id, { respostas, gym: semAparelho, dores, noTreino: noPlano, max: 2 }); } catch { ids = []; }
  const nomeF = nomesEquip(falta);
  const acoes = ids.map((id) => {
    const nx = EX_POR_ID.get(id);
    return {
      rotulo: `Trocar por ${nx.nome}`,
      confirmar: `No plano, ${ex.nome} vira ${nx.nome}, com as mesmas séries, repetições e descanso.`,
      aplicar: (s, c) => {
        const pl = P.planoAtivo(s);
        if (!pl) return false;
        const trocas = [];
        for (const d of pl.dias) d.itens.forEach((it, idx) => { if (it && it.ex === ex.id) trocas.push({ diaId: d.id, idx, de: ex.id, para: id }); });
        return trocas.length ? aplicarVariacao(pl, trocas, emIso(c), 'travado') > 0 : false;
      },
      depois: `Pronto: ${nx.nome} entrou no lugar de ${ex.nome}.`,
    };
  });
  const aindaTem = gym.all || falta.some((k) => gym.has[k] === true);
  if (aindaTem) {
    acoes.push({
      rotulo: falta.length === 1 ? `Marcar que não tenho ${nomeF}` : 'Marcar que não tenho esses aparelhos',
      confirmar: `Em “Minha academia”, ${nomeF} fica desmarcado. Os outros aparelhos continuam como estão.`,
      aplicar: (s) => {
        if (!isObj(s.gym)) return false;
        if (s.gym.all !== false) { s.gym.all = false; s.gym.has = {}; for (const k of Object.keys(EQUIPAMENTOS)) if (!falta.includes(k)) s.gym.has[k] = true; } else for (const k of falta) delete s.gym.has[k];
        return true;
      },
      depois: 'Pronto: anotei em “Minha academia”.',
    });
  }
  const texto = ids.length
    ? [`Sem ${nomeF}, troco “${ex.nome}” por um destes:`, ...ids.map((id) => `• ${EX_POR_ID.get(id).nome}`), 'Mesmo movimento e mesmo músculo.']
    : [`Sem ${nomeF}, não achei outro exercício do mesmo movimento para “${ex.nome}” que seja seguro para você.`, 'Peça outra versão do treino ao Treinador ou escolha um exercício na lista.'];
  const local = (() => { try { return perfil(saudeDoTreinador(ctx.st, ctx.hoje).respostas).local; } catch { return ''; } })();
  const detalhes = ['Séries, repetições e descanso continuam os do plano. A troca segue os aparelhos que sobram, as suas limitações e as dores que você contou.'];
  if (local && local !== 'minha') detalhes.push('Para os próximos planos do Treinador usarem só o que a sua academia tem, escolha “Só os aparelhos que eu marcar” nas respostas da entrevista.');
  return {
    texto, detalhes, refs: ['bazvalle2019', 'iusca2021'], acoes,
    ir: ids.length ? [{ rotulo: 'Minha academia', rota: 'academia' }] : [{ rotulo: 'Outra versão do treino', abrir: 'treinador-novo' }, { rotulo: 'Minha academia', rota: 'academia' }],
  };
}

// ---------- os assuntos ----------
const temPlano = (ctx) => !!P.planoAtivo(ctx.st);
function passoPerdidoInicio(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  const data = diaDe(ctx);
  let pode;
  try { pode = P.podeMarcar(ctx.st, data, ctx.hoje, { futuro: true }); } catch { pode = { pode: false, motivo: '' }; }
  if (!pode.pode && pode.motivo === 'marcado') {
    // já marcado: diz para onde o treino foi (e onde desfazer), em vez de só "já está marcado"
    let ef = null;
    try { ef = P.treinoDoDia(ctx.st, data); } catch { ef = null; }
    const para = ef && ef.perdido ? ef.perdido.para : '';
    const de = data === ctx.hoje ? 'de hoje' : `de ${nomeDia(data, ctx.hoje)}`;
    return { texto: [para ? `O treino ${de} já passou para ${nomeDia(para, ctx.hoje)}.` : `O treino ${de} já está marcado como não feito: ele volta ${P.naProxima(data)}.`, 'Para mudar, toque em “Desfazer” no dia, na aba Treinos.'], ir: [{ rotulo: 'Ver a semana', rota: 'treinos' }], data };
  }
  if (!pode.pode) return semTreinoNoDia(pode.motivo, data, ctx.hoje);
  // o dia que a pessoa pediu na frase ("não vou treinar hoje, posso fazer amanhã?"): a data seguinte, nesta semana
  const quer = (Array.isArray(ctx.datas) ? ctx.datas : []).filter((x) => x && !x.semana && diaValido(x.data) && x.data > data).map((x) => x.data).sort()[0] || '';
  // outro dia desta semana (ontem, sexta...): direto à proposta, sem perguntar o motivo
  if (data !== ctx.hoje) return passoPerdido({ ...ctx, quer }, ['Tudo bem.']);
  const com = (c, motivo) => ({ ...c, data, motivo, quer });
  return {
    texto: ['Tudo bem. O que aconteceu?'],
    opcoes: [
      { rotulo: 'Estou sem tempo', valor: 'tempo' }, { rotulo: 'Cansaço ou sono ruim', valor: 'cansaco' },
      { rotulo: 'Estou com dor', valor: 'dor' }, { rotulo: 'Estou doente', valor: 'doente' },
      { rotulo: 'Viagem', valor: 'viagem' }, { rotulo: 'Outro motivo', valor: 'outro' },
    ],
    proximo: (v, c) => {
      if (v === 'tempo') return { texto: ['Quer uma versão curta do treino de hoje?'], opcoes: [{ rotulo: 'Sim, versão curta', valor: 's' }, { rotulo: 'Não dá mesmo', valor: 'n' }], proximo: (x, cc) => (x === 's' ? passoTempo(cc) : passoPerdido(com(cc, 'tempo'))) };
      if (v === 'cansaco') return passoCansaco(com(c, 'cansaco'));
      if (v === 'dor') return passoDor(c, 'treinador');
      if (v === 'doente') {
        const f = faqDe(FAQ_CORRIDA, 'Posso correr gripado');
        return passoPerdido(com(c, 'doente'), ['Com febre, dor no corpo ou cansaço fora do normal, não treine hoje.'], f ? f.a.slice(0, 2) : [], f ? f.refs : []);
      }
      if (v === 'viagem') return passoPerdido(com(c, 'viagem'), [], ['Para quem já treina, 1 a 2 treinos por semana mantêm a força.', 'Ficou 2 semanas ou mais sem treinar? O app aplica sozinho as regras da volta.'], ['acsm2009', 'caterisano2019']);
      return passoPerdido(com(c, 'outro'));
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
    proximo: (v, c) => (v === 'curta' ? passoTempo(c) : passoPerdido({ ...c, data: diaDe(ctx), motivo: 'cansaco', quer: ctx.quer })),
    ir: noite ? undefined : [{ rotulo: 'Registrar o sono', rota: 'sono' }],
  };
}


// bônus de pontos ao reconhecer o texto (logic/chat/motor.js chama com { datas, hoje, texto, ctx }): só sinais que as
// palavras não pegam, como as datas da frase ("hoje" é palavra de ligação no motor)
const temHojeEFutura = (i) => i.datas.some((d) => d.data === i.hoje) && i.datas.some((d) => d.data > i.hoje && !d.semana);
// "o que eu treino na quinta?": pergunta sobre o treino de um dia (sem negar e sem pedir para trazer para hoje)
const perguntaDoDia = (i) => i.datas.some((d) => !d.semana && d.data !== i.hoje) && !temHojeEFutura(i) && !doisDias(i) && /\b(treino|treinos|treinar|treino|ficha|malhar|malho|treinamos)\b/.test(i.texto) && !/\b(nao|sem|nem|demora\w*|dura|duracao|leva|minutos|tempo)\b/.test(i.texto);
// "não vou treinar sexta", "amanhã não rola ir": uma negação perto de treinar / ir / academia
const faltaDe = (i) => /\b(nao|nem)\b( \w+){0,4} (treinar|treino|malhar|ir|academia|rola|rolar|vai dar|da)\b/.test(i.texto) && !/\b(aparelho|maquina|tem|tenho|sei|dor|doi)\b/.test(i.texto);
// "dá para fazer o de sexta amanhã?": dois dias, o treino do dia mais adiante feito no mais perto
const doisDias = (i) => i.datas.filter((d) => !d.semana).length >= 2 && /\b(fazer|faco|treinar|adiantar|antecipar|trazer|puxar|passar)\b/.test(i.texto) && !/\b(nao|nem)\b/.test(i.texto);
export const INTENCOES = [
  {
    id: 'treino-perdido', coach: 'treinador', titulo: 'Não vou conseguir treinar hoje', resumo: 'faltar ao treino de hoje', resumoNoDia: 'faltar ao treino', data: true, prioridade: 1,
    // "hoje não dá, passa pra amanhã": negação, hoje e outro dia, e um verbo de mudar de dia
    bonus: (i) => (temHojeEFutura(i) && /\b(nao|nem)\b/.test(i.texto) && /\b(passa\w*|troca\w*|muda\w*|deixa\w*|remarca\w*)\b/.test(i.texto) ? 2.5 : 0) + (faltaDe(i) ? 1.5 : 0) + (impedimento(i.texto) ? 2.5 : 0),
    palavras: ['furei treino', 'furei academia', 'nao tem como treinar', 'nao tem como ir', 'nao tem como+treinar', 'furar treino', 'vou furar', 'sem treino', '!viagem', 'so po', 'to morto', 'nao rola', 'nao to afim', 'nao estou afim', 'sem pique', 'nao vou dar conta', 'trabalhar ate tarde', 'trabalho ate tarde', 'nao vou treinar', 'nao vou conseguir treinar', 'nao consigo treinar', 'nao posso treinar', 'nao vou poder treinar', 'nao da treinar', 'nao deu treinar',
      'trocar treino amanha', 'mudar treino amanha', 'treinar amanha lugar', 'trocar dia amanha',
      'nao vou academia', 'nao vou poder ir academia', 'nao posso ir academia', 'nao quero ir academia', 'nao quero treinar', 'sem vontade treinar', 'nao vou conseguir ir academia', 'nao consigo ir academia', 'faltar treino', 'faltar academia', 'perder treino', 'perdi treino', 'pular treino',
      'nao treinei', 'nao vou malhar', 'faltar', 'remarcar treino', 'adiar treino', 'deixar treino amanha', 'deixar treino outro dia', 'imprevisto', 'nao posso ir', 'nao vou poder ir', 'nao consigo ir', 'nao vou conseguir ir', 'nao vou ir', 'nao vai dar', 'nao vai dar ir', 'nao da ir', 'nao fui', 'vou faltar', 'compromisso', 'nao vai rolar',
      'viagem', 'vou viajar', 'estou viajando', 'cansado', 'estou cansado', 'to cansado', 'cansado treinar', 'dormir mal', 'dormir pouco', 'mal dormir', 'sem condicao treinar', 'sem animo', 'sem vontade treinar'],
    disponivel: temPlano,
    inicio: passoPerdidoInicio,
  },
  {
    id: 'pouco-tempo', coach: 'treinador', titulo: 'Tenho pouco tempo hoje', resumo: 'um treino mais curto hoje',
    bonus: (i) => (tempoApertado(i.texto) ? 2.5 : 0),
    palavras: ['!relampago', 'treino relampago', 'versao enxuta', '!enxuta', 'contra relogio', 'agenda apertada', '!rapidinho', 'algo rapido', 'treino rapidinho', 'pouco tempo treino', 'chego tarde', 'tempo curto treino', 'pouco tempo', 'sem tempo', 'nao tenho tempo', 'tempo curto', '!pressa', '!correria', 'treino curto', 'treino rapido', 'versao curta', 'minuto', 'meia hora',
      'so tenho minuto', 'so minuto', 'tenho minuto', 'encurtar treino', 'reduzir treino', 'diminuir treino', 'treino menor', 'tempo apertado', 'dia corrido', 'curto', 'treino mais curto', 'tempo contado'],
    disponivel: (ctx) => !!treinoDeHoje(ctx),
    inicio: passoTempo,
  },
  {
    id: 'qual-treino', coach: 'treinador', titulo: 'Qual é o meu treino', resumo: 'o treino de hoje', resumoNoDia: 'o treino', data: true,
    bonus: (i) => (perguntaDoDia(i) ? 2 : 0),
    palavras: ['esqueci que fazer', 'esqueci treino', 'era pra fazer', 'que cai', 'cai amanha', 'treino cai', 'cai hoje', 'que treino hoje', 'passa ficha', 'manda ficha', 'mostra ficha', 'quais aparelho', 'aparelho vou usar', 'toca hoje', 'dia de que', 'qual treino', 'qual ficha', 'ir treino', 'tenho treino', 'tem treino', 'treino amanha', 'treino perna', 'treino peito', 'treino costas', 'treino braco', 'treino superior', 'treino superiores', 'treino inferior', 'treino inferiores', 'treino ombro', 'dia perna', 'dia peito', 'qual exercicio', 'quais exercicio', 'que exercicio', 'qual e treino', 'treino de amanha', 'me fala treino', 'fala treino', 'qual musculo', 'que musculo', 'vou fazer', 'o que faco', 'programado'],
    disponivel: temPlano,
    inicio: passoDoDia,
  },
  {
    id: 'duracao', coach: 'treinador', titulo: 'Quanto tempo dura o treino', resumo: 'quanto tempo dura o treino', resumoNoDia: 'quanto tempo dura o treino', data: true,
    palavras: ['treino longo', 'longo', 'demorado', 'gastar academia', 'quanto tempo gastar', 'quanto tempo dura', 'quanto tempo leva', 'quanto dura', 'quanto demora', 'demora quanto', 'dura quanto', '!duracao', '!demora', '!demorar', 'quanto tempo treino', 'quantos minuto', 'tempo de treino', 'leva quanto tempo', 'vai demorar', 'termina que horas', 'quantos minuto treino', 'minuto treino', 'quanto tempo vou ficar'],
    disponivel: temPlano,
    inicio: passoDuracao,
  },
  {
    id: 'semana', coach: 'treinador', titulo: 'Como fica a minha semana', resumo: 'a sua semana de treinos', data: true,
    palavras: ['segunda a sexta', 'segunda a domingo', 'como fica semana', 'minha semana', 'semana', '!agenda', 'agenda semana', 'programacao', 'treinos semana', '!calendario', '!cronograma', 'tenho semana', 'tem semana', 'o que tenho semana', 'ver semana', 'mostra semana', 'mostrar semana', 'semana toda', 'semana inteira', 'semana treino', 'semana treinos', 'resto semana', 'proximos dia', 'proximos treinos', 'como ficou semana', 'quais dia treino', 'que dia treino', 'dias treino', 'como fica', 'como ficou', 'como ta', 'como esta', 'quais treinos semana'],
    disponivel: (ctx) => temPlano(ctx) || temCorrida(ctx.st),
    inicio: (ctx) => passoSemana(ctx, 'treinador'),
  },
  {
    id: 'antecipar', coach: 'treinador', titulo: 'Fazer o treino de outro dia hoje', resumo: 'fazer hoje o treino de outro dia', resumoNoDia: 'fazer hoje o treino de {dia}', data: true,
    palavras: ['!adiantar', '!antecipar', 'adiantar treino', 'antecipar treino', 'fazer treino amanha', 'treinar treino amanha', 'trazer treino', 'puxar treino', 'inverter treino', 'inverter dia', 'trocar ordem dia', 'fazer antes'],
    bonus: (i) => (temHojeEFutura(i) && !faltaDe(i) ? 2.5 : doisDias(i) ? 2.5 : 0),
    disponivel: temPlano,
    inicio: passoAntecipar,
  },
  {
    id: 'seguidos', coach: 'treinador', titulo: 'Treinar dois dias seguidos', resumo: 'treinar em dias seguidos',
    palavras: ['dias na linha', 'sem folga', 'dias direto', 'treinei ontem', 'treinar de novo', 'treino de novo', 'entre um treino', 'treino e outro', 'descansar um dia', 'dia de descanso', 'dois dia seguido', 'dia seguido', 'treinar seguido', 'treino seguido', 'treinar todo dia', 'todo dia', 'todos dia', 'dia sim dia nao', 'dia consecutivo', '!consecutivo', '!consecutivos', 'treinar de novo amanha', 'treinar dois dia', 'mesmo musculo', 'descansar entre treinos', 'quantos dia descanso', 'descanso entre treinos', 'precisa descansar'],
    disponivel: temPlano,
    inicio: passoSeguidos,
  },
  {
    id: 'juntar-treino', coach: 'treinador', titulo: 'Corrida e musculação no mesmo dia', resumo: 'fazer corrida e musculação no mesmo dia',
    palavras: ['!leg day', 'tiro+leg day', 'correr+leg day', 'correr+musculacao', 'correr+exercicio', 'correr+treino', 'correr+treino+juntar', 'correr+treino+mesmo dia', '!intervalo entre', 'correr+intervalo', 'correr+horas entre', 'correr+seguida', 'correr+colado', 'correr+logo depois', 'mesmo dia', 'juntar', 'juntar outro', 'juntar treino', 'correr depois', 'correr antes',
      'depois musculacao', 'antes musculacao', 'qual primeiro', 'ordem', 'prioridade', 'correr+academia'],
    disponivel: (ctx) => temOsDois(ctx.st),
    inicio: (ctx) => passoJuntar(ctx),
  },
  {
    id: 'carga', coach: 'treinador', titulo: 'Carga, séries e repetições', resumo: 'carga, séries, repetições ou descanso de um exercício',
    palavras: ['aumentar carga', 'aumento carga', 'subir carga', 'subo carga', 'aumentar peso', 'muito facil', 'ta facil', 'muito leve', 'muito pesado', 'ta pesado', 'carga', 'quanto carga', 'quanto peso', 'quantos quilo', 'serie', 'quantas serie', 'repeticao', 'quantas repeticao', 'descanso', 'quanto descanso', 'quanto tempo descanso',
      'progredir', 'progressao', 'evoluir', 'dose', 'descanso rosca', 'descanso supino', 'descanso agachamento', 'exercicio', 'quanto tempo prancha', 'carga recomendada', 'qual carga', '!carga', 'carga uso', 'peso uso', 'quanto coloco', 'coloco quanto', 'pegar mais peso', 'botar mais peso', 'ta leve', 'esta leve', 'leve demais', 'facil demais', 'pesado demais', 'ta pesado demais', 'supino leve', 'quantos quilo coloco'],
    // um exercício do plano junto de carga, séries, repetições ou descanso ("qual o descanso da rosca?")
    bonus: (i) => (/\b(carga|peso|kg|quilos?|series?|repeticoes|reps|descanso|intervalo|aumento|aumentar)\b/.test(i.texto) && exercicioNoTexto(i.texto, P.planoAtivo(i.ctx.st)) ? 2 : 0),
    disponivel: (ctx) => { const p = P.planoAtivo(ctx.st); return !!p && p.dias.some((d) => Array.isArray(d.itens) && d.itens.length); },
    inicio: passoCarga,
  },
  {
    id: 'aparelho-falta', coach: 'treinador', titulo: 'Não tenho um aparelho', resumo: 'um aparelho que a sua academia não tem',
    palavras: ['nao possui', 'academia nao possui', 'nao tem aparelho', 'academia nao tem', 'nao tem academia', 'minha academia nao tem', 'nao tenho aparelho', 'falta aparelho', 'aparelho quebrado', 'quebrado', 'quebrada', 'nao existe', 'nao tem esse', 'esse aparelho', 'aparelho nao tem',
      'nao tem leg', 'nao tem smith', 'nao tem polia', 'nao tem cross', '!manutencao', '!quebrou', '!quebrado', '!quebrada', 'parou de funcionar', 'estragado', 'estragada', 'interditado', 'nao tem na academia', 'nao tem onde fazer', 'aparelho estragado', 'polia quebrada', 'nao funciona', 'sem funcionar'],
    bonus: (i) => (/\b(nao tem|nao tenho|quebrad\w*|manutencao|estragad\w*|nao existe)\b/.test(i.texto) && exercicioNoTexto(i.texto, P.planoAtivo(i.ctx.st)) ? 1.5 : 0),
    disponivel: temPlano,
    inicio: passoAparelhoFalta,
  },
  {
    id: 'mudar-plano', coach: 'treinador', titulo: 'Mudar ou refazer o treino', resumo: 'mudar ou refazer o seu treino',
    palavras: ['vezes semana', 'treinar vezes', 'mais dias', 'menos dias', 'mudei academia', 'nao tenho halteres', 'sem halteres', 'treinar sem aparelho', 'treino sem aparelho', 'mudar plano', 'mudar treino', 'mudar dia', 'mudar dias', 'trocar dia', 'outro treino', 'treino novo', 'novo treino', 'refazer treino', 'refazer entrevista', 'refazer plano',
      'treinar casa', 'treino casa', 'trocar exercicio', 'mudar exercicio', 'enjoei treino', 'cansei treino', 'treino chato', 'treino diferente', 'algo diferente', 'mudar academia', 'mudar horario', 'plano novo', 'mudar', 'novo plano', 'posso mudar', 'mudar algo', 'alterar treino', 'mudar ordem', 'trocar ordem', 'ordem exercicio', '!enjoei', 'enjoei plano', 'treino enjoativo', 'cansei plano'],
    inicio: passoMudar,
  },
  {
    id: 'dor-treino', coach: 'treinador', titulo: 'Estou com dor', resumo: 'uma dor', prioridade: 3,
    palavras: ['estalou', 'estalando', 'estalo', 'latejando', 'pontada', 'corpo dolorido', 'corpo moido', 'moido treino', 'dor', 'dor depois treino', 'dor muscular', 'machucar', 'lesao', 'tendinite', 'inflamado', 'inchado', 'inchaco', 'joelho dor', 'ombro dor', 'costas dor', 'dor joelho', 'dor ombro', 'dor costas', 'dor lombar', 'dor punho', 'dor cotovelo', 'dor tornozelo', 'dor quadril', 'lombar', 'torcer', 'dor articulacao', 'dor tendao', 'estou dor', 'to dor', 'tou dor', 'sinto dor', 'senti dor', '!travou', 'travado', 'lombar travou', 'costas travou', '!fisgada', 'estou dolorido', 'todo dolorido', 'todo dor', 'joelho dor', 'dor joelho', 'ombro dor', 'dor ombro', 'costas dor', 'dor costas', 'lombar dor', 'dor lombar', 'punho dor', 'dor punho', 'cotovelo dor', 'dor cotovelo', 'tornozelo dor', 'dor tornozelo', 'quadril dor', 'dor quadril', 'panturrilha dor', 'dor panturrilha', 'canela dor', 'dor canela', 'pe dor', 'dor pe', 'coxa dor', 'dor coxa', 'perna dor', 'dor perna', 'pescoco dor', 'dor pescoco', 'braco dor', 'dor braco', 'gluteo dor', 'dor gluteo', 'virilha dor', 'dor virilha'],
    inicio: (ctx) => passoDor(ctx, 'treinador'),
  },
  {
    id: 'aparelho-ocupado', coach: 'treinador', titulo: 'O aparelho está ocupado', resumo: 'um aparelho ocupado na academia',
    palavras: ['parado no aparelho', 'nao sai do aparelho', 'preciso dela', 'preciso dele', 'aparelho ocupado', '!ocupado', '!tomado', 'ta tomado', 'cheio de gente', 'gente usando', 'alguem usando', 'aparelho', 'esperar aparelho', 'trocar aparelho', 'academia cheia', 'academia lotada', 'fila', 'aparelho usando', 'tem gente', 'tem fila', 'esperando aparelho'],
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

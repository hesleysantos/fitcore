// Assuntos do Treinador no chat sobre UM exercício e sobre o porquê do treino. Puro: sem DOM. Formato em contrato.js.
//  • "como faz o stiff?"              → posição e passos do catálogo (data/exercises.js), com as fontes da técnica;
//  • "o peck deck trabalha o quê?"    → músculos principais e auxiliares do catálogo (data/muscles.js);
//  • "posso trocar o afundo?"         → as alternativas do Treinador (logic/trainer.js, alternativas: mesmo movimento e
//                                       músculo, seus aparelhos, nível, limitações e dores), aplicadas ali mesmo: só hoje,
//                                       só nesta semana (logic/ajuste-semana.js) ou sempre (no plano, logic/variacao.js);
//  • "o stiff é seguro com dor nas costas?" → as regras de segurança do Treinador (motivosContra, alertaDoExercicio) e as
//                                       marcas de cuidado do catálogo; nunca "é seguro" sem base: diz o que o app faria;
//  • "por que meu treino é assim?" / "por que mudou o dia?" / "por que hoje está mais leve?" → o que o plano e as marcas
//                                       já guardam (logic/perdido.js, carga.js, trainer.js, saude-fora.js, ajuste-semana.js);
//  • "o que você recomenda pra melhorar o glúteo?" / "meu treino está bom?" → a avaliação do plano (logic/avaliacao.js,
//                                       as mesmas contas e fontes do Treinador), com trocas aplicáveis no chat.
// Nada aqui cria regra de treino: cada resposta chama a lógica que o app já usa e cita as fontes dela.
import * as P from '../perdido.js';
import { perfil, saudeDoTreinador, respostasParaAvisos, doresDoTreino, alertaDoExercicio, alternativas, motivosContra, ajustesPorDor, aplicarTrocasDor, resumoCombinado, ROTULO } from '../trainer.js';
import { recomendacao, contextoDoEstado } from '../carga.js';
import { efeitoDeHoje } from '../saude-fora.js';
import { avaliarPlano } from '../avaliacao.js';
import { ajustarSemana, itensDoDia, temAjusteNaSemana } from '../ajuste-semana.js';
import { aplicarVariacao } from '../variacao.js';
import { doresAtivas } from '../dor.js';
import { EX_POR_ID } from '../../data/exercises.js';
import { MUSCULOS, GRUPOS } from '../../data/muscles.js';
import { FAQ_TREINO } from '../../data/knowledge.js';
import { faqDe, plural, juntar, fmtDescanso, nomeDia, segundaDa } from './comum.js';
import { bloqueio, treinoDeHoje, passoDose, cap } from './treino.js';
import { exercicioDoTexto, corpoDoTexto, musculosDoTexto, idsDoPlano } from './entidades.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const emIso = (ctx) => new Date(Number.isFinite(ctx && ctx.agora) ? ctx.agora : Date.now()).toISOString();
const planoDe = (ctx) => { try { return P.planoAtivo(ctx.st); } catch { return null; } };
const minus = (t) => String(t || '').toLowerCase();
const nomeMusc = (k) => (MUSCULOS[k] ? MUSCULOS[k].nome.split(' (')[0].toLowerCase() : k);
const respostasDe = (ctx) => { try { return saudeDoTreinador(ctx.st, ctx.hoje).respostas; } catch { return {}; } };
const avisosDe = (ctx) => { try { return respostasParaAvisos(ctx.st, ctx.hoje); } catch { return null; } };
const doresDe = (ctx, av = avisosDe(ctx)) => { try { return doresDoTreino(ctx.st, ctx.hoje, av); } catch { return []; } };
const treinouHoje = (ctx) => (Array.isArray(ctx.st.sessions) ? ctx.st.sessions : []).some((s) => s && P.diaLocal(s.inicio) === ctx.hoje);
// onde o exercício está no plano ("no Inferiores A e no Inferiores B")
const ondeNoPlano = (plan, id) => (plan ? plan.dias.filter((d) => Array.isArray(d.itens) && d.itens.some((it) => it && it.ex === id)).map((d) => d.nome) : []);

// ---------- qual exercício ----------
// O exercício da conversa: o que veio do botão ou da memória (ctx.ex) ou o citado no texto (logic/chat/entidades.js)
export function exercicioDe(ctx) {
  if (ctx && typeof ctx.ex === 'string' && EX_POR_ID.has(ctx.ex)) return { ex: EX_POR_ID.get(ctx.ex), candidatos: [], noPlano: idsDoPlano(planoDe(ctx)).has(ctx.ex) };
  const t = ctx && typeof ctx.texto === 'string' ? ctx.texto : '';
  return t ? exercicioDoTexto(t, planoDe(ctx)) : null;
}
// Pergunta qual exercício (os candidatos do texto, ou os do treino de hoje e do plano, de 5 em 5) e segue com `fazer`
function pedirExercicio(ctx, fazer, pergunta = 'Qual exercício?', candidatos = null) {
  const plan = planoDe(ctx);
  let lista = Array.isArray(candidatos) && candidatos.length ? candidatos : [];
  if (!lista.length && plan) {
    const t = treinoDeHoje(ctx);
    const dias = t ? [t.dia, ...plan.dias.filter((d) => d.id !== t.dia.id)] : plan.dias;
    const vistos = new Set();
    for (const d of dias) for (const it of d.itens || []) if (it && EX_POR_ID.has(it.ex) && !vistos.has(it.ex) && EX_POR_ID.get(it.ex).grupo !== 'cardio') { vistos.add(it.ex); lista.push(EX_POR_ID.get(it.ex)); }
  }
  if (!lista.length) return { texto: ['Diga o nome do exercício, por exemplo: “como faz o agachamento?”.'] };
  if (lista.length === 1) return fazer(ctx, lista[0]);
  const pagina = (ini) => {
    const vis = lista.slice(ini, ini + (lista.length - ini > 6 ? 5 : 6));
    const opcoes = vis.map((ex) => ({ rotulo: ex.nome, valor: ex.id }));
    if (ini + vis.length < lista.length) opcoes.push({ rotulo: 'Mais exercícios', valor: '#mais' });
    return { texto: [ini ? 'Mais exercícios do plano:' : pergunta], opcoes, proximo: (v, c) => (v === '#mais' ? pagina(ini + vis.length) : EX_POR_ID.has(v) ? fazer({ ...c, ex: v }, EX_POR_ID.get(v)) : { texto: ['Não achei esse exercício.'] }) };
  };
  return pagina(0);
}
// Abre o assunto pelo exercício: o citado, ou pergunta qual
const comExercicio = (fazer, pergunta) => (ctx) => {
  const b = bloqueio(ctx);
  if (b) return b;
  const e = exercicioDe(ctx);
  if (e && e.ex) return fazer(ctx, e.ex);
  return pedirExercicio(ctx, fazer, pergunta, e ? e.candidatos : null);
};

// ---------- só hoje, só nesta semana ou sempre ----------
// `mudar(itens)` → itens novos (ou null se nada muda nesse treino); `sempre(planoMutavel)` → quantas mudanças fez no plano.
// As ações: "Só hoje" começa o treino de hoje com a mudança (o plano não muda); "Só nesta semana" grava a versão da semana
// (logic/ajuste-semana.js) nos treinos que ainda faltam; "Sempre" muda o plano. A tela confirma antes de cada uma.
export function acoesDeAlcance(ctx, { mudar, sempre, oQue, depoisSempre }) {
  const plan = planoDe(ctx);
  if (!plan) return [];
  const hoje = ctx.hoje;
  const acoes = [];
  const t = treinoDeHoje(ctx);
  if (t && !treinouHoje(ctx) && !ctx.st.current) {
    let base = [];
    try { base = itensDoDia(ctx.st, plan.id, t.dia.id, hoje); } catch { base = t.dia.itens; }
    const novos = mudar(base.length ? base : t.dia.itens);
    if (novos && novos.length) acoes.push({ rotulo: 'Só hoje', confirmar: `${oQue} no treino de hoje. O plano não muda.`, iniciar: { planId: plan.id, diaId: t.dia.id, itens: novos } });
  }
  // os dias desta semana, de hoje em diante, com um treino que muda
  let sem = [];
  try { sem = P.semanaEfetiva(plan, ctx.st.perdidos, segundaDa(hoje)); } catch { sem = []; }
  const alvos = sem.filter((d) => d && d.diaId && d.data >= hoje && !(d.data === hoje && treinouHoje(ctx))).map((d) => ({ data: d.data, diaId: d.diaId }))
    .filter((d) => { const dia = plan.dias.find((x) => x.id === d.diaId); return dia && mudar(dia.itens); });
  if (alvos.length) {
    acoes.push({
      rotulo: 'Só nesta semana',
      confirmar: `${oQue} nos treinos desta semana (${juntar(alvos.map((d) => nomeDia(d.data, hoje)))}). Na outra semana volta o de sempre.`,
      aplicar: (s) => {
        const pl = P.planoAtivo(s);
        if (!pl || pl.id !== plan.id) return false;
        let n = 0;
        for (const d of alvos) { const novos = mudar(itensDoDia(s, pl.id, d.diaId, d.data)); if (novos && ajustarSemana(s, { planId: pl.id, diaId: d.diaId, data: d.data, itens: novos })) n++; }
        return n > 0;
      },
      depois: 'Pronto: mudei só nesta semana. Na outra, volta o de sempre.', data: alvos[0].data, semana: true,
    });
  }
  if (typeof sempre === 'function' && plan.dias.some((d) => mudar(d.itens))) {
    acoes.push({
      rotulo: 'Sempre (no plano)', confirmar: `${oQue} no plano, para todas as semanas. Dá para desfazer editando o treino.`,
      aplicar: (s) => { const pl = P.planoAtivo(s); if (!pl || pl.id !== plan.id) return false; return sempre(pl) > 0; },
      depois: depoisSempre || 'Pronto: o plano mudou.',
    });
  }
  return acoes;
}
// troca de um exercício por outro, com as mesmas séries, repetições e descanso
const trocaDe = (de, para) => (itens) => (Array.isArray(itens) && itens.some((it) => it && it.ex === de) && !itens.some((it) => it && it.ex === para) ? itens.map((it) => (it && it.ex === de ? { ...it, ex: para, nota: '' } : { ...it })) : null);
function sempreTroca(de, para, ctx) {
  return (pl) => {
    const trocas = [];
    for (const d of pl.dias) (d.itens || []).forEach((it, idx) => { if (it && it.ex === de && !d.itens.some((x) => x && x.ex === para)) trocas.push({ diaId: d.id, idx, de, para }); });
    return trocas.length ? aplicarVariacao(pl, trocas, emIso(ctx), 'travado') : 0;
  };
}
export function passoTrocaAlcance(ctx, de, para) {
  const acoes = acoesDeAlcance(ctx, { mudar: trocaDe(de.id, para.id), sempre: sempreTroca(de.id, para.id, ctx), oQue: `${para.nome} entra no lugar de ${de.nome}`, depoisSempre: `Pronto: ${para.nome} entrou no lugar de ${de.nome} no plano.` });
  if (!acoes.length) return { texto: [`${de.nome} não aparece nos próximos treinos.`], ir: [{ rotulo: 'Ver os treinos', rota: 'treinos' }] };
  return {
    texto: [`Trocar ${de.nome} por ${para.nome}.`, 'Vale para quando?'],
    detalhes: ['Séries, repetições e descanso continuam os do plano.'],
    acoes,
    ir: [{ rotulo: 'Ver como fazer ' + para.nome, rota: 'exercicio/' + para.id }],
  };
}

// ---------- como faz ----------
const fontesDaTecnica = (ex) => { const orgs = [...new Set((Array.isArray(ex.fontes) ? ex.fontes : []).map((f) => f && f.org).filter(Boolean))]; return orgs.length ? `Técnica conforme ${juntar(orgs)} (os links estão na tela do exercício).` : ''; };
function avisoDoPerfil(ctx, ex) {
  const av = avisosDe(ctx);
  try { const a = alertaDoExercicio(ex.id, doresDe(ctx, av), av); if (a) return { tipo: 'warn', texto: a.texto }; } catch { /* segue */ }
  try {
    const m = motivosContra(ex, perfil(respostasDe(ctx)), ctx.st.gym, doresDe(ctx, av)).filter((x) => x.grave && x.id !== 'aparelho');
    if (m.length) return { tipo: 'warn', texto: `Para você, o Treinador não escolhe este exercício: ${m[0].texto}.` };
  } catch { /* segue */ }
  return undefined;
}
function passoComoFaz(ctx, ex) {
  const passos = (Array.isArray(ex.execucao) ? ex.execucao : []).slice(0, 3).map((x, k) => `${k + 1}. ${x}`);
  const resto = (Array.isArray(ex.execucao) ? ex.execucao : []).slice(3).map((x, k) => `${k + 4}. ${x}`);
  const plan = planoDe(ctx);
  const onde = ondeNoPlano(plan, ex.id);
  const detalhes = [...resto, ex.respiracao, ...(Array.isArray(ex.dicas) ? ex.dicas.map((d) => 'Dica: ' + d) : []), ...(Array.isArray(ex.erros) ? ex.erros.slice(0, 2).map((d) => 'Evite: ' + minus(d.charAt(0)) + d.slice(1)) : []), fontesDaTecnica(ex)].filter(Boolean);
  return {
    texto: [`${ex.nome}: ${minus(ex.posicao.charAt(0)) + ex.posicao.slice(1)}`.slice(0, 250), ...passos],
    aviso: avisoDoPerfil(ctx, ex) || (onde.length ? undefined : { tipo: 'info', texto: 'Este exercício não está no seu plano.' }),
    detalhes,
    refs: ['acsm2009'],
    ir: [{ rotulo: 'Ver a animação', rota: 'exercicio/' + ex.id }],
    ex: ex.id,
  };
}
// ---------- que músculo trabalha ----------
function passoMusculo(ctx, ex) {
  const prim = (ex.primarios || []).map(nomeMusc), sec = (ex.secundarios || []).map(nomeMusc);
  const onde = ondeNoPlano(planoDe(ctx), ex.id);
  const texto = [`${ex.nome} trabalha principalmente ${juntar(prim)}${sec.length ? `; de apoio, ${juntar(sec)}` : ''}.`];
  texto.push(ex.tipo === 'composto' ? 'É um exercício de várias articulações: pega mais músculos ao mesmo tempo.' : 'É um exercício isolado: foca num músculo.');
  if (onde.length) texto.push(`No seu plano, ele está no ${juntar(onde)}.`);
  return {
    texto,
    detalhes: ['Na conta das séries da semana, o músculo principal conta 1 série e o auxiliar, meia.'],
    refs: ['pelland2026'],
    ir: [{ rotulo: 'Ver como fazer', rota: 'exercicio/' + ex.id }],
    ex: ex.id,
  };
}
// ---------- trocar por outro ----------
function alternativasPara(ctx, ex) {
  const plan = planoDe(ctx);
  const av = avisosDe(ctx);
  const dores = doresDe(ctx, av);
  let l = [];
  try { l = alternativas(ex, perfil(respostasDe(ctx)), ctx.st.gym, idsDoPlano(plan)); } catch { l = []; }
  return l.filter((c) => { try { const a = alertaDoExercicio(c.id, dores, av); return !a || a.nivel !== 'evitar'; } catch { return true; } }).slice(0, 3);
}
// o outro exercício que a pessoa citou ("trocar o stiff POR levantamento terra")
function alvoDaTroca(ctx, ex) {
  const t = typeof ctx.texto === 'string' ? ctx.texto : '';
  const m = /\b(?:por|pelo|pela|pra|para)\s+(?:o |a |um |uma )?(.{3,})$/.exec(t);
  if (!m) return null;
  const r = exercicioDoTexto(m[1], null);
  const y = r && (r.ex || (r.candidatos.length === 1 ? r.candidatos[0] : null));
  return y && y.id !== ex.id ? y : null;
}
function passoTrocar(ctx, ex) {
  const plan = planoDe(ctx);
  const noPlano = idsDoPlano(plan).has(ex.id);
  if (!noPlano) return { texto: [`${ex.nome} não está no seu plano.`, 'Diga qual exercício do plano você quer trocar.'], ir: [{ rotulo: 'Ver os treinos', rota: 'treinos' }] };
  const alts = alternativasPara(ctx, ex);
  const y = alvoDaTroca(ctx, ex);
  const refs = ['bazvalle2019', 'iusca2021'];
  const detalhes = ['As opções seguem o mesmo movimento e o mesmo músculo, os aparelhos da sua academia, o seu nível, as limitações e as dores que você contou: as regras do Treinador.'];
  if (y && alts.some((c) => c.id === y.id)) return passoTrocaAlcance(ctx, ex, y);
  const texto = [];
  if (y) {
    let m = [];
    try { m = motivosContra(y, perfil(respostasDe(ctx)), ctx.st.gym, doresDe(ctx)).filter((x) => x.grave); } catch { m = []; }
    texto.push(m.length ? `${y.nome} não serve para você: ${m[0].texto}.` : `${y.nome} não é do mesmo movimento e músculo de ${ex.nome}.`);
  }
  if (!alts.length) {
    texto.push(`Não achei outro exercício do mesmo movimento para ${ex.nome} que seja seguro para você.`);
    return { texto, detalhes, refs, ir: [{ rotulo: 'Outra versão do treino', abrir: 'treinador-novo' }] };
  }
  texto.push(`No lugar de ${ex.nome}, pode ser:`);
  return { texto, detalhes, refs, opcoes: alts.map((c) => ({ rotulo: c.nome, valor: c.id })), proximo: (v, c) => (EX_POR_ID.has(v) ? passoTrocaAlcance(c, ex, EX_POR_ID.get(v)) : { texto: ['Não achei esse exercício.'] }), ex: ex.id };
}
// ---------- é seguro? ----------
// "pede cuidado com o joelho"
const COM_O = { joelho: 'o joelho', ombro: 'o ombro', lombar: 'a lombar', 'coluna-alta': 'as costas', pescoco: 'o pescoço', cotovelo: 'o cotovelo', punho: 'o punho', quadril: 'o quadril', virilha: 'a virilha', tornozelo: 'o tornozelo', canela: 'a canela', panturrilha: 'a panturrilha', aquiles: 'o tendão de Aquiles', pe: 'o pé', 'coxa-frente': 'a coxa', gluteo: 'o glúteo', braco: 'o braço', abdomen: 'o abdômen' };
const FAQ_REGIAO = { joelho: 'Tenho dor no joelho', ombro: 'Como proteger os ombros', lombar: 'Sinto dor nas costas', 'coluna-alta': 'Sinto dor nas costas' };
function passoSeguro(ctx, ex) {
  const corpo = corpoDoTexto(typeof ctx.texto === 'string' ? ctx.texto : '');
  const av = avisosDe(ctx);
  const dores = doresDe(ctx, av);
  const texto = [], detalhes = [];
  const refs = [];
  let real = null;
  try { real = alertaDoExercicio(ex.id, dores, av); } catch { real = null; }
  if (real) { texto.push(real.texto); refs.push(...(real.refs || [])); }
  let contra = [];
  try { contra = motivosContra(ex, perfil(respostasDe(ctx)), ctx.st.gym, dores).filter((x) => x.grave && x.id !== 'aparelho'); } catch { contra = []; }
  if (contra.length) texto.push(`Para o seu perfil, o Treinador não escolhe ${ex.nome}: ${contra[0].texto}.`);
  if (corpo) {
    const local = COM_O[corpo.onde] || 'essa região';
    const marcado = corpo.cuidado && Array.isArray(ex.cuidado) && ex.cuidado.includes(corpo.cuidado);
    texto.push(marcado ? `No catálogo, ${ex.nome} pede cuidado com ${local}: com dor ali, o Treinador alivia a carga e a amplitude ou troca o exercício.` : `No catálogo, ${ex.nome} não está entre os que pedem cuidado com ${local}.`);
    if (!real) texto.push('Conte a dor: o treino se ajusta ao local e à intensidade dela.');
    const f = faqDe(FAQ_TREINO, FAQ_REGIAO[corpo.onde] || 'Sinto dor numa articulação');
    if (f) { detalhes.push(...f.a.slice(0, 2)); refs.push(...f.refs); }
  } else if (!real && !contra.length) texto.push(`Pelas regras do Treinador, ${ex.nome} não tem restrição para o seu perfil e as dores que você contou.`);
  detalhes.push('Dor forte, repentina, com inchaço ou que aparece em repouso pede avaliação de um médico ou fisioterapeuta antes de treinar essa região.');
  const fq = faqDe(FAQ_TREINO, 'Quando a dor pede médico');
  if (fq) refs.push(...fq.refs);
  const p = {
    texto, detalhes, refs,
    aviso: corpo ? { tipo: 'warn', texto: 'Pare se a dor aumentar durante o exercício.' } : undefined,
    ir: [{ rotulo: dores.length ? 'Contar outra dor' : 'Contar a dor ao Treinador', abrir: 'contar-dor' }],
    ex: ex.id,
  };
  if (idsDoPlano(planoDe(ctx)).has(ex.id) && (real || contra.length || corpo)) { p.opcoes = [{ rotulo: `Trocar ${ex.nome}`, valor: 'trocar' }]; p.proximo = (v, c) => passoTrocar({ ...c, texto: '' }, ex); }
  return p;
}

// ---------- por quê? ----------
const temPalavra = (ctx, re) => re.test(typeof ctx.texto === 'string' ? ctx.texto : '');
function porqueDose(ctx) {
  const pf = perfil(respostasDe(ctx));
  const r = respostasDe(ctx);
  const e = exercicioDe(ctx);
  const plan = planoDe(ctx);
  const f = faqDe(FAQ_TREINO, 'Quantas séries e repetições');
  const obj = ROTULO.objetivo[r.objetivo] ? minus(ROTULO.objetivo[r.objetivo]) : '';
  const nivel = ROTULO.experiencia[r.experiencia] ? minus(ROTULO.experiencia[r.experiencia]) : '';
  const texto = [`Séries, repetições e descanso vêm do seu objetivo${obj ? ` (${obj})` : ''} e do seu nível${nivel ? ` (${nivel})` : ''}, nas respostas da entrevista.`];
  if (e && e.ex && plan) {
    const it = plan.dias.flatMap((d) => d.itens || []).find((x) => x && x.ex === e.ex.id);
    if (it) texto.push(`${e.ex.nome}: ${it.series} séries de ${String(it.reps).replace('-', ' a ')}, com ${fmtDescanso(it.descanso)} de descanso.`);
  }
  const detalhes = [...(f ? f.a.slice(0, 2) : [])];
  if (pf.jovem) detalhes.push('Antes dos 18 anos, a dose fica em 10 a 15 repetições, sem carga máxima.');
  if (pf.nivel === 1) detalhes.push('Para quem está começando, 1 a 3 séries por exercício já trazem resultado.');
  if (pf.diabetes) detalhes.push('Com diabetes, a recomendação é força em dias não seguidos, com 8 repetições ou mais.');
  return { texto, detalhes, refs: [...(f ? f.refs : []), 'acsm2009', ...(pf.jovem ? ['faigenbaum2009'] : []), ...(pf.diabetes ? ['colberg2016'] : [])], ir: [{ rotulo: 'Mudar as respostas', abrir: 'treinador-entrevista' }] };
}
function porqueDia(ctx) {
  const hoje = ctx.hoje;
  let sem = [];
  try { sem = P.semanaDoChat(ctx.st, hoje, hoje); } catch { sem = []; }
  const linhas = [];
  for (const d of sem) {
    const motivo = (m) => (P.MOTIVO_CURTO[m] ? ` (${P.MOTIVO_CURTO[m]})` : '');
    if (d.perdido && d.perdido.para) linhas.push(`• ${d.perdido.nome}: de ${nomeDia(d.data, hoje)} para ${nomeDia(d.perdido.para, hoje)}${motivo(d.perdido.motivo)}, porque você marcou “Não treinei”.`);
    else if (d.perdido) linhas.push(`• ${d.perdido.nome} de ${nomeDia(d.data, hoje)}: ficou como não feito${motivo(d.perdido.motivo)}.`);
    if (d.foiPara && d.saiu) linhas.push(`• ${d.saiu}: de ${nomeDia(d.data, hoje)} para ${nomeDia(d.foiPara, hoje)}, a seu pedido.`);
    if (d.corrida && d.corrida.movidaPara) linhas.push(`• ${d.corrida.nome}: de ${nomeDia(d.data, hoje)} para ${nomeDia(d.corrida.movidaPara, hoje)}.`);
  }
  const texto = linhas.length ? ['O que mudou nesta semana:', ...linhas.slice(0, 4)] : ['Nesta semana nenhum treino mudou de dia: vale a agenda do plano.'];
  return {
    texto,
    detalhes: ['Quando um treino muda de dia, o app procura um dia com 48 horas de descanso para os mesmos músculos, fora dos seus dias sem treino e longe da corrida forte.', 'Para o músculo, o que mais conta é o total de séries da semana.'],
    refs: [...P.REFS_MUSCULACAO],
    ir: [{ rotulo: 'Ver a semana', rota: 'treinos' }],
  };
}
function porqueLeve(ctx) {
  const t = treinoDeHoje(ctx);
  if (!t) return { texto: ['Hoje não tem musculação no seu plano.'], ir: [{ rotulo: 'Ver a semana', rota: 'treinos' }] };
  const motivos = [], refs = [];
  try {
    const e = efeitoDeHoje(ctx.st, ctx.hoje);
    const at = e ? e.itens.filter((x) => x.ef.fase === 'ativo') : [];
    if (at.length) { motivos.push(`O problema de saúde que você contou: ${minus(at[0].ef.titulo)}.`); refs.push(...(at[0].ef.refs || [])); }
  } catch { /* segue */ }
  const av = avisosDe(ctx);
  const dores = doresDe(ctx, av);
  for (const it of t.dia.itens) {
    if (motivos.length >= 3) break;
    try { const a = alertaDoExercicio(it.ex, dores, av); if (a && !motivos.some((m) => m.startsWith('Dor'))) { motivos.push(`${EX_POR_ID.get(it.ex).nome}: ${a.texto}`); refs.push(...(a.refs || [])); } } catch { /* segue */ }
  }
  const linhasCarga = new Set();
  for (const it of t.dia.itens) {
    let rec = null;
    try { rec = recomendacao(it.ex, it.reps, it.series, contextoDoEstado(ctx.st, it.ex, ctx.hoje), ctx.agora); } catch { rec = null; }
    if (rec && rec.origem !== 'historico' && rec.linha && /volta|pausa|parad|leve|menos|reduz/i.test(rec.linha)) { linhasCarga.add(rec.linha); refs.push(...(rec.refs || [])); }
  }
  if (linhasCarga.size) motivos.push(cap([...linhasCarga][0]) + '.');
  try { if (temAjusteNaSemana(ctx.st, t.plan.id, t.dia.id, ctx.hoje)) motivos.push('Este treino tem uma versão só para esta semana.'); } catch { /* segue */ }
  return {
    texto: motivos.length ? [`O ${t.dia.nome} de hoje muda por isto:`, ...motivos.map((m) => '• ' + m)] : [`O ${t.dia.nome} de hoje segue o plano: séries e repetições de sempre.`, 'A carga de cada exercício sobe quando você completa as repetições em todas as séries.'],
    refs: refs.length ? refs : ['acsm2009'],
    ir: [{ rotulo: 'Ver o treino', rota: `treino/${t.plan.id}/${t.dia.id}` }],
  };
}
function porqueExercicio(ctx, ex) {
  const prim = (ex.primarios || []).map(nomeMusc);
  const onde = ondeNoPlano(planoDe(ctx), ex.id);
  return {
    texto: [`${ex.nome} ${onde.length ? 'está no seu plano' : 'entraria'} para trabalhar ${juntar(prim)}.`, 'O Treinador escolhe pelo movimento e pelo músculo, pelos aparelhos da sua academia, pelo seu nível e pelas dores e limitações que você contou.'],
    detalhes: ['Os exercícios de várias articulações e dos músculos grandes vêm antes dos isolados: pedem mais força e técnica.', 'Com poucos exercícios bem escolhidos dá para treinar todos os grandes grupos.'],
    refs: ['acsm2009', 'iversen2021'],
    opcoes: onde.length ? [{ rotulo: `Trocar ${ex.nome}`, valor: 'trocar' }, { rotulo: 'Que músculo trabalha', valor: 'musculo' }] : undefined,
    proximo: onde.length ? (v, c) => (v === 'trocar' ? passoTrocar({ ...c, texto: '' }, ex) : passoMusculo(c, ex)) : undefined,
    ex: ex.id,
  };
}
function passoPorQue(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  if (temPalavra(ctx, /\b(dia|dias|mudou|mudaram|passou|trocou|semana|agenda|remarc\w*|outro dia)\b/)) return porqueDia(ctx);
  if (temPalavra(ctx, /\b(leve|levinho|facil|menos|menor|diminu\w*|reduz\w*|baixa\w*|tirou|curto)\b/)) return porqueLeve(ctx);
  if (temPalavra(ctx, /\b(series?|repeticao|repeticoes|reps|descanso|intervalo|carga|peso|kg)\b/)) return porqueDose(ctx);
  const e = exercicioDe(ctx);
  if (e && e.ex) return porqueExercicio(ctx, e.ex);
  // um músculo citado ("por que tem tanto exercício de costas?", "por que não tem panturrilha?"): as séries dele na
  // semana e o que fazer para mudar (a mesma conta da recomendação)
  if (musculosDoTexto(typeof ctx.texto === 'string' ? ctx.texto : '').length) {
    const p = passoRecomendar(ctx);
    if (p && Array.isArray(p.texto)) return { ...p, texto: ['O Treinador divide as séries da semana pelo seu objetivo e pela prioridade que você escolheu.', ...p.texto] };
  }
  return {
    texto: ['O que você quer entender?'],
    opcoes: [{ rotulo: 'Séries e repetições', valor: 'dose' }, { rotulo: 'Por que estes exercícios', valor: 'ex' }, { rotulo: 'Por que mudou um dia', valor: 'dia' }, { rotulo: 'Por que hoje está diferente', valor: 'leve' }],
    proximo: (v, c) => (v === 'dose' ? porqueDose({ ...c, texto: '' }) : v === 'dia' ? porqueDia(c) : v === 'leve' ? porqueLeve(c) : pedirExercicio({ ...c, texto: '' }, porqueExercicio, 'Qual exercício?')),
  };
}

// ---------- recomendações (logic/avaliacao.js) ----------
const FAIXA = { nada: 'sem treino direto', pouco: 'pouco', ok: 'já dá resultado', bom: 'bom para ganhar massa', muito: 'acima do teto para o seu nível' };
function avaliacaoDe(ctx) {
  const plan = planoDe(ctx);
  if (!plan) return null;
  let comb = null;
  try { comb = resumoCombinado(ctx.st, ctx.hoje); } catch { comb = null; }
  let dores = [];
  try { dores = doresAtivas(ctx.st, ctx.hoje); } catch { dores = []; }
  try { return avaliarPlano(plan, { respostas: respostasDe(ctx), gym: ctx.st.gym, dores, corrida: comb }); } catch { return null; }
}
function passoRecomendar(ctx) {
  const b = bloqueio(ctx);
  if (b) return b;
  const r = avaliacaoDe(ctx);
  if (!r || r.vazio) return { texto: ['Não consegui avaliar o seu plano agora.'], ir: [{ rotulo: 'Ver os treinos', rota: 'treinos' }] };
  const gs = musculosDoTexto(typeof ctx.texto === 'string' ? ctx.texto : '');
  const grupos = Array.isArray(r.grupos) ? r.grupos : [];
  const refs = Array.isArray(r.refs) ? r.refs : [];
  if (gs.length) {
    const achados = gs.map((g) => grupos.find((x) => x.g === g) || { g, nome: GRUPOS[g] || g, series: 0, faixa: 'nada' });
    const texto = achados.slice(0, 2).map((x) => `${x.nome}: ${String(x.series).replace('.', ',')} séries por semana (${FAIXA[x.faixa] || x.faixa}).`);
    const baixo = achados.filter((x) => ['nada', 'pouco', 'ok'].includes(x.faixa));
    const detalhes = ['Cerca de 4 séries por semana já dão resultado; 10 ou mais ajudam a ganhar massa. Acima do teto do seu nível, mais séries não ajudam.'];
    if (baixo.length) {
      texto.push(`Para dar mais atenção, ponha ${minus(juntar(baixo.map((x) => x.nome)))} em prioridade: o Treinador dá mais séries a ${baixo.length > 1 ? 'eles' : 'ele'} e mostra o plano antes de valer.`);
      return { texto, detalhes, refs, ir: [{ rotulo: 'Escolher a prioridade', abrir: 'treinador-entrevista' }] };
    }
    if (achados.some((x) => x.faixa === 'muito')) texto.push('Mais séries não vão ajudar: o volume já passou do teto e cansa mais.');
    else texto.push('O volume já está bom. Para crescer, suba a carga aos poucos: quando fizer o número mais alto de repetições em todas as séries.');
    // pediu mais ("quero treinar mais glúteo"): também o caminho para dar mais séries, pela prioridade
    const querMais = /\b(mais|priorizar|prioridade|focar|colocar|acrescentar|incluir)\b/.test(typeof ctx.texto === 'string' ? ctx.texto : '') && !achados.some((x) => x.faixa === 'muito');
    if (querMais) {
      texto.push(`Se quiser mesmo mais séries de ${minus(juntar(achados.slice(0, 2).map((x) => x.nome)))}, ponha em prioridade: o Treinador mostra o plano antes de valer.`);
      return { texto, detalhes, refs, ir: [{ rotulo: 'Escolher a prioridade', abrir: 'treinador-entrevista' }, { rotulo: 'Ver a evolução', rota: 'progresso' }] };
    }
    return { texto, detalhes, refs, ir: [{ rotulo: 'Ver a evolução', rota: 'progresso' }] };
  }
  const texto = [String(r.conclusao || '').slice(0, 250)].filter(Boolean);
  const detalhes = [];
  for (const x of (Array.isArray(r.equilibrio) ? r.equilibrio : []).slice(0, 2)) if (x && x.texto) detalhes.push(x.texto);
  for (const x of (Array.isArray(r.corrida) ? r.corrida : []).slice(0, 2)) if (x && x.texto) detalhes.push(x.texto);
  for (const x of (Array.isArray(r.falta) ? r.falta : []).slice(0, 2)) if (typeof x === 'string') detalhes.push(x); else if (x && x.texto) detalhes.push(x.texto);
  if (r.perfil && Array.isArray(r.perfil.dose)) detalhes.push(...r.perfil.dose.slice(0, 2));
  const probs = r.perfil && Array.isArray(r.perfil.problemas) ? r.perfil.problemas.filter((x) => x && EX_POR_ID.has(x.ex)) : [];
  if (probs.length) texto.push(`Sugiro trocar ${plural(probs.length, 'exercício', 'exercícios')}: ${juntar(probs.slice(0, 3).map((x) => x.nome))}.`);
  const p = { texto: texto.length ? texto : ['O seu plano segue as regras do Treinador.'], detalhes, refs };
  if (probs.length) {
    p.opcoes = probs.slice(0, 3).map((x) => ({ rotulo: `Trocar ${x.nome}`, valor: x.ex }));
    p.proximo = (v, c) => {
      const pr = probs.find((x) => x.ex === v);
      if (pr && pr.troca && EX_POR_ID.has(pr.troca.ex)) return passoTrocaAlcance(c, EX_POR_ID.get(v), EX_POR_ID.get(pr.troca.ex));
      return passoTrocar({ ...c, texto: '' }, EX_POR_ID.get(v));
    };
  } else p.ir = [{ rotulo: 'Ver os treinos', rota: 'treinos' }];
  return p;
}

// ---------- dor: o que o treino muda (logic/trainer.js, ajustesPorDor) ----------
// Depois de contar uma dor: as trocas e o que fica de fora ou mais leve, aplicáveis só hoje, só nesta semana ou sempre.
export function passoAjustesDor(ctx) {
  const plan = planoDe(ctx);
  if (!plan) return { texto: ['Anotado.'] };
  const b = bloqueio(ctx);
  if (b) return b;
  let aj = [];
  try { aj = ajustesPorDor(plan, respostasDe(ctx), ctx.st.gym, doresAtivas(ctx.st, ctx.hoje)); } catch { aj = []; }
  if (!aj.length) return { texto: ['Anotado. Com essa dor, os exercícios do plano podem continuar: pare se a dor aumentar.'], ir: [{ rotulo: 'Ver os treinos', rota: 'treinos' }] };
  const nome = (id) => (EX_POR_ID.get(id) || { nome: id }).nome;
  const trocas = aj.filter((x) => x.tipo === 'trocar'), pular = aj.filter((x) => x.tipo === 'pular'), leve = aj.filter((x) => x.tipo === 'aliviar');
  const unicos = (l, f) => [...new Set(l.map(f))];
  const texto = ['Anotado. Com essa dor, eu ajusto assim:'];
  if (trocas.length) texto.push(`• Trocar: ${unicos(trocas, (x) => `${nome(x.de)} → ${nome(x.para)}`).slice(0, 2).join('; ')}`);
  if (pular.length) texto.push(`• Fica de fora até melhorar: ${juntar(unicos(pular, (x) => nome(x.de)).slice(0, 3))}`);
  if (leve.length) texto.push(`• Mais leve: ${juntar(unicos(leve, (x) => nome(x.de)).slice(0, 3))}`);
  const tiraIds = new Set(pular.map((x) => x.de));
  const porDe = new Map(trocas.map((x) => [x.de, x.para]));
  const mudar = (itens) => {
    if (!Array.isArray(itens) || !itens.some((it) => it && (tiraIds.has(it.ex) || porDe.has(it.ex)))) return null;
    const out = itens.filter((it) => it && !tiraIds.has(it.ex)).map((it) => (porDe.has(it.ex) && !itens.some((x) => x && x.ex === porDe.get(it.ex)) ? { ...it, ex: porDe.get(it.ex), nota: '' } : { ...it }));
    return out.length ? out : null;
  };
  const acoes = acoesDeAlcance(ctx, { mudar, sempre: trocas.length ? (pl) => aplicarTrocasDor(pl.dias, trocas) : null, oQue: 'Os exercícios mudam por causa da dor', depoisSempre: 'Pronto: as trocas entraram no plano. Quando melhorar, toque em “Melhorou”.' });
  return {
    texto,
    detalhes: [...new Set(aj.map((x) => x.motivo).filter(Boolean))].slice(0, 3),
    refs: [...new Set(aj.flatMap((x) => x.refs || []))],
    acoes,
    ir: [{ rotulo: 'Ver o treino de hoje', rota: 'treinos' }],
  };
}

// ---------- os assuntos ----------
const temPlano = (ctx) => !!planoDe(ctx);
// bônus: palavra de pergunta "por que" no começo de uma oração (e não o "porque" de explicação: "não vou porque...")
const perguntaPorQue = (i) => /(^|\b(e|mas|entao)\s)(porque|por que|por qual motivo|qual o motivo|qual a razao|me explica|explica)\b/.test(i.texto) && /\b(treino|treinos|serie|series|exercicio|exercicios|dia|dias|plano|ficha|carga|peso|leve|pesado|mudou|mudaram|passou|repeticao|repeticoes|descanso|semana|assim|isso|esse|essa|tenho|tem|faco|hoje)\b/.test(i.texto) && !/\b(nao vou|nao posso|nao consigo|nao da|nao deu|nao fui)\b/.test(i.texto);
const comEx = (i) => !!(i.ent && i.ent.exercicio);
export const INTENCOES = [
  {
    id: 'ex-como', coach: 'treinador', titulo: 'Como fazer um exercício', resumo: 'como fazer um exercício', exige: 'exercicio',
    palavras: ['respirar', 'respiracao', 'prendo ar', 'prender ar', 'melhorar execucao', 'melhorar meu', 'como faz', 'como fazer', 'como faco', 'como executa', 'como executar', '!execucao', 'executar', 'forma certa', 'jeito certo', 'postura certa', 'tecnica', 'explica como', 'me ensina', 'ensina', 'passo passo', 'como se faz', 'fazer direito', 'fazer certo', 'posicao certa', 'como e', 'faz como'],
    bonus: (i) => (comEx(i) && /\b(como|tecnica|execu\w*|ensina|postura|forma|jeito)\b/.test(i.texto) ? 2 : 0),
    disponivel: temPlano,
    inicio: comExercicio(passoComoFaz, 'Qual exercício?'),
  },
  {
    id: 'ex-musculo', coach: 'treinador', titulo: 'Que músculo um exercício trabalha', resumo: 'que músculo um exercício trabalha', exige: 'exercicio',
    palavras: ['pegada', 'abrir pegada', 'pegada aberta', 'pegada fechada', 'muda pegada', 'qual musculo', 'que musculo', 'quais musculo', 'trabalha', 'trabalha que', 'serve que', 'pra que serve', 'para que serve', 'pega', 'pega que', 'ativa', 'foca', 'exercita', 'musculo trabalha', 'que parte', 'qual parte', 'trabalha qual'],
    bonus: (i) => (comEx(i) && /\b(musculo\w*|trabalha\w*|serve|pega|ativa|foca|exercita|parte)\b/.test(i.texto) ? 2 : 0),
    disponivel: temPlano,
    inicio: comExercicio(passoMusculo, 'Qual exercício?'),
  },
  {
    id: 'ex-trocar', coach: 'treinador', titulo: 'Trocar um exercício por outro', resumo: 'trocar um exercício por outro', exige: 'exercicio',
    palavras: ['!substituir', 'substituto', 'posso trocar', 'quero trocar', 'da pra trocar', 'tem como trocar', 'trocar outro', 'trocar por', 'troca por', 'no lugar', 'outro lugar', 'outro exercicio', 'nao gosto', 'odeio', 'detesto', 'alternativa', 'equivalente', 'parecido', 'semelhante', 'outra opcao', 'tirar', 'trocar'],
    bonus: (i) => (comEx(i) && /\b(troc\w*|substitu\w*|lugar|alternativ\w*|nao gosto|odeio|detesto|equivalente|tirar|tira|muda|mudar|chato|enjoei)\b/.test(i.texto) ? 3 : 0),
    disponivel: temPlano,
    inicio: comExercicio(passoTrocar, 'Qual exercício do plano você quer trocar?'),
  },
  {
    id: 'ex-seguro', coach: 'treinador', titulo: 'Um exercício é seguro para mim?', resumo: 'se um exercício é seguro para você', exige: 'exercicio', prioridade: 2,
    palavras: ['seguro', 'e seguro', 'perigoso', 'faz mal', 'machuca', 'prejudica', 'ruim pra', 'arriscado', '!risco', 'risco lesao', 'risco machucar', 'posso fazer', 'pode fazer', 'faz mal joelho', 'faz mal coluna', 'faz mal costas', 'quem tem dor', 'com dor'],
    bonus: (i) => (comEx(i) && /\b(segur\w*|perigos\w*|faz mal|machuca\w*|prejudic\w*|arriscad\w*|risco|com dor|tem dor|problema)\b/.test(i.texto) ? 2.5 : 0),
    disponivel: temPlano,
    inicio: comExercicio(passoSeguro, 'Qual exercício?'),
  },
  {
    id: 'explicar', coach: 'treinador', titulo: 'Por que o meu treino é assim', resumo: 'entender o porquê do seu treino',
    palavras: ['abc', 'fullbody', 'full body', 'divisao treino', 'mesmo dia', 'costas biceps', 'peito triceps', '!explica', 'explicar', 'motivo treino', 'razao treino', 'nao entendi treino', 'entender treino', 'porque treino', 'porque mudou', 'porque series', 'porque mais leve', 'porque assim', 'porque exercicio', 'porque tenho', 'porque esta', 'porque ta'],
    bonus: (i) => (perguntaPorQue(i) ? 2.5 : 0) + (/^(porque|pq)\b/.test(i.texto) && i.ent && i.ent.musculos.length ? 2.5 : 0),
    disponivel: temPlano,
    inicio: passoPorQue,
  },
  {
    id: 'recomendar', coach: 'treinador', titulo: 'O que você recomenda?', resumo: 'uma recomendação para o seu treino',
    palavras: ['fazer mais que treino', 'fazer mais', 'to animado', 'treinar mais hoje', 'quero mais treino', 'recomenda+treino', 'recomendacao+treino', 'sugere+treino', 'sugestao+treino', 'voce acha treino', 'treino bom', 'treino esta bom', 'treino ta bom', 'treino certo', 'treino equilibrado', 'treino completo', 'treino fraco', 'falta treino', 'falta algo treino', 'melhorar treino', 'avaliar treino', 'avalia treino', 'avaliacao treino', 'dica treino', 'conselho treino', 'plano bom', 'plano ta bom'],
    // um músculo e um pedido de melhora ("o que você recomenda para melhorar o glúteo?")
    bonus: (i) => ((i.ent && i.ent.musculos.length && /\b(melhor\w*|cresc\w*|desenvolv\w*|aument\w*|ganhar|definir|evolu\w*|focar|recomend\w*|suger\w*|dica|forte|fortalec\w*|indic\w*|deixar|durinh\w*|empinad\w*|maior|afinar|tonific\w*|mais|colocar|acrescentar|incluir|priorizar|prioridade)\b/.test(i.texto) && !/\b(dor|doi|doendo|machuc\w*)\b/.test(i.texto)) ? 2.5 : 0),
    disponivel: temPlano,
    inicio: passoRecomendar,
  },
];

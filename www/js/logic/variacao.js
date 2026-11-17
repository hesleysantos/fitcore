// Variação dos exercícios ao longo do tempo: quando avisar que é hora de variar, o que trocar e o que guardar.
// Vale para qualquer plano de musculação (do Treinador, de modelo ou montado à mão). A escolha dos substitutos é a do
// Treinador (logic/trainer.js → sugerirTrocas e alternativas): mesmo padrão de movimento, mesmo músculo principal, a
// mesma forma de medir, os aparelhos que a pessoa tem, as limitações e a saúde das entrevistas e as dores contadas.
//
// O que as fontes sustentam (todas lidas em texto completo, em novembro de 2026):
//  • Trocar os exercícios a cada sessão, ao acaso, rendeu um pouco menos (força no supino e espessura do vasto
//    intermédio) e mais motivação; os autores sugerem manter os exercícios complexos, com peso livre, e variar os que
//    pedem pouca aprendizagem (ref bazvalle2019: 8 semanas, troca sorteada a cada sessão num banco de 80 exercícios).
//  • Posicionamento da IUSCA: incluir exercícios variados ajuda o músculo a crescer por inteiro; os de movimento
//    complexo (agachamento, remadas, supinos) ficam fixos na rotina, para manter a técnica; os mais simples (de uma
//    articulação ou em máquina) podem ser trocados com mais liberdade. "A pesquisa é limitada" sobre de quanto em quanto
//    tempo trocar; mudar a ênfase quando a evolução para é uma das formas de organizar o treino (ref iusca2021).
//  • ACSM 2009: o corpo se adapta depressa, e mudar as variáveis (a escolha dos exercícios entre elas) limita os platôs
//    (ref acsm2009). ACSM 2026: não há dados suficientes para dizer se variar os exercícios muda o ganho de força ou de
//    massa (ref acsm2026). Ou seja: variar é opcional, e o prazo não vem de um estudo.
//  • O prazo segue o ciclo de treino (mesociclo) usado na prática: semana mais leve a cada 4 a 8 semanas, e é nessa
//    passagem que os exercícios novos do ciclo seguinte entram (consenso Delphi, 95,2% de acordo — ref bell2023; os
//    treinadores entrevistados usam a semana leve como a hora de variar e alertam que exercício novo dá mais dor
//    muscular — ref bell2022). Por isso: 6 semanas de treino (dentro de 4 a 8), e 8 para quem está começando, que ainda
//    está aprendendo os movimentos (a IUSCA cita o ganho mais lento nos exercícios que pedem mais aprendizagem).
//  • Antes do prazo, só um auxiliar travado (o app chama assim o exercício com 3 treinos seguidos sem passar da marca
//    anterior: logic/progress.js → estagnados) ou uma dor (logic/trainer.js → ajustesPorDor). O número de treinos é uma
//    escolha do aplicativo: as fontes dizem só que, quando a evolução para, é hora de mudar algo.
//  • Segurança: durante a volta de uma pausa (logic/pausa.js, ref caterisano2019) o aviso espera a transição acabar, para
//    não somar exercício novo (mais dor muscular, ref bell2023) à volta. Com a saúde bloqueando o treino, não há aviso.
//
// Regra final:
//  • conta as semanas em que a pessoa treinou com este plano (semana sem treino não conta) desde a última troca, desde
//    "Manter meu treino" ou desde a criação do plano;
//  • com 6 semanas (8 no nível 1): "Hora de variar", com até 2 auxiliares por treino; os 2 primeiros exercícios
//    compostos de cada treino ficam, e também todo composto com peso livre ou com o peso do corpo (variam os de
//    máquina, Smith e polia e os isolados);
//  • sai primeiro o auxiliar que está há mais tempo no plano; o que entrou há menos de um prazo não sai; o que saiu nos
//    últimos 3 prazos não volta (assim não fica indo e voltando entre os mesmos dois);
//  • "Agora não" adia 2 semanas; "Manter meu treino" recomeça a contagem; aceitar as trocas também.
import { perfil, sugerirTrocas, semanasRevisao } from './trainer.js';
import { voltaEm } from './pausa.js';

export const SEMANA = 7 * 86400000;
export const ADIAR_SEMANAS = 2;
export const POR_TREINO = 2; // auxiliares por treino em cada variação
export const SEM_VOLTAR = 3; // um exercício que saiu não volta por 3 prazos
export const REFS_VARIACAO = ['bazvalle2019', 'iusca2021', 'acsm2009', 'acsm2026', 'bell2023', 'bell2022'];

const ms = (v) => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : 0; };
const lista = (x) => (Array.isArray(x) ? x : []);
// segunda-feira (data local) da semana de `t`
function semanaDe(t) {
  const d = new Date(t);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Sem entrevista do Treinador, os aparelhos são os de "Minha academia" (e não "sem aparelhos").
export function respostasDaVariacao(respostas) {
  const a = respostas && typeof respostas === 'object' ? respostas : {};
  return a.local ? a : { ...a, local: 'minha' };
}
export const prazoDaVariacao = (respostas) => semanasRevisao(perfil(respostasDaVariacao(respostas)));

// Desde quando conta o prazo (ms). Planos do Treinador de antes desta regra: "Manter" e as trocas moviam trainer.revisaoEm.
function inicioDaContagem(st, plan, prazo) {
  const v = plan.variacao || {};
  if (ms(v.desde)) return ms(v.desde);
  let desde = ms(plan.criadoEm);
  const t = st && st.trainer;
  if (plan.origem === 'treinador' && t && ms(t.revisaoEm)) desde = Math.max(desde, ms(t.revisaoEm) - prazo * SEMANA);
  return desde;
}
function adiadoAte(st, plan) {
  const v = plan.variacao || {};
  if (ms(v.adiadoAte)) return ms(v.adiadoAte);
  const t = st && st.trainer;
  return plan.origem === 'treinador' && t && !v.desde ? ms(t.adiadoAte) : 0;
}

// Semanas completas (de segunda a domingo) em que houve pelo menos um treino deste plano, de `desde` até `agora`.
// A semana em curso ainda não conta; a semana da troca só conta se a pessoa não treinou nela antes da troca (senão foi
// meia semana com os exercícios antigos). Assim o aviso aparece na segunda-feira depois de 6 semanas cheias.
export function semanasNoTreino(st, plan, desde, agora) {
  const semanas = new Set();
  const atual = semanaDe(agora), daTroca = desde ? semanaDe(desde) : '';
  let treinouAntes = false;
  for (const s of lista(st && st.sessions)) {
    if (!s || s.planId !== plan.id) continue;
    const t = ms(s.inicio);
    if (!t || t > agora) continue;
    if (t < desde) { if (semanaDe(t) === daTroca) treinouAntes = true; continue; }
    const k = semanaDe(t);
    if (k !== atual) semanas.add(k);
  }
  if (treinouAntes) semanas.delete(daTroca);
  return semanas.size;
}

// O que entrou e o que saiu, pelo histórico das trocas (as aceitas aqui e as feitas à mão no editor do treino).
function historico(plan, prazo, agora) {
  const entrou = new Map(), recemEntrou = new Set(), saiu = new Set();
  for (const t of lista(plan.variacao && plan.variacao.trocas)) {
    const em = ms(t.em);
    if (!em || em > agora) continue;
    entrou.set(t.para, Math.max(entrou.get(t.para) || 0, em));
    if (agora - em < prazo * SEMANA) recemEntrou.add(t.para);
    if (agora - em < SEM_VOLTAR * prazo * SEMANA) saiu.add(t.de);
  }
  // o que está no plano agora não conta como "saiu" (a pessoa pode ter voltado com ele à mão)
  for (const d of lista(plan.dias)) for (const it of lista(d && d.itens)) if (it) saiu.delete(it.ex);
  return { entrou, recemEntrou, saiu };
}

// Situação da variação de um plano. `opc`: { respostas, gym, dores, travados: [ids], agora (ms) }.
// Devolve null (plano vazio) ou { devido, motivo: 'prazo' | 'travado' | '', semanas, prazo, faltam, adiado, emVolta,
// bloqueado, trocas: [{ diaId, dia, idx, de, para, opcoes }] }.
export function situacao(st, plan, opc = {}) {
  if (!plan || !lista(plan.dias).some((d) => d && lista(d.itens).length)) return null;
  const agora = Number.isFinite(opc.agora) ? opc.agora : Date.now();
  const respostas = respostasDaVariacao(opc.respostas);
  const pf = perfil(respostas);
  const prazo = semanasRevisao(pf);
  const semanas = semanasNoTreino(st, plan, inicioDaContagem(st, plan, prazo), agora);
  const adiado = adiadoAte(st, plan) > agora;
  const tempos = lista(st && st.sessions).map((s) => ms(s && s.inicio)).filter((t) => t > 0).sort((a, b) => a - b);
  const emVolta = !!voltaEm(tempos, agora) && tempos.length > 0;
  const bloqueado = !!pf.bloqueio;
  const out = { devido: false, motivo: '', semanas, prazo, faltam: Math.max(0, prazo - semanas), adiado, emVolta, bloqueado, trocas: [] };
  // `forcar`: a pessoa pediu as trocas agora (passa por cima do "Lembrar depois", nunca da saúde nem da volta)
  if ((adiado && !opc.forcar) || emVolta || bloqueado) return out;
  const h = historico(plan, prazo, agora);
  const base = { excluir: h.saiu, fixos: opc.forcar ? new Set() : h.recemEntrou, opcoes: 4, ordem: idadeNoPlano(plan, h.entrou), complexosFixos: true };
  const gym = opc.gym || { all: true, has: {} };
  if (semanas >= prazo || opc.forcar) {
    // os travados saem primeiro
    const trav = new Set(lista(opc.travados));
    const ordem = new Map([...base.ordem].map(([id, t]) => [id, trav.has(id) ? -Infinity : t]));
    out.trocas = sugerirTrocas(plan, respostas, gym, POR_TREINO, opc.dores, { ...base, ordem });
    if (semanas >= prazo) { out.devido = true; out.motivo = 'prazo'; }
    return out;
  }
  // "Manter" num aviso de exercício travado: não pergunta de novo sobre travados por um prazo (o aviso do prazo segue)
  const trav = ms((plan.variacao || {}).travadoAte) > agora ? [] : lista(opc.travados);
  if (trav.length) {
    out.trocas = sugerirTrocas(plan, respostas, gym, POR_TREINO, opc.dores, { ...base, so: new Set(trav) });
    if (out.trocas.length) { out.devido = true; out.motivo = 'travado'; }
  }
  return out;
}
// quando cada exercício entrou no plano (ms): pela troca registrada; os que nunca foram trocados contam como os mais
// antigos (0), e entre eles vale a ordem do treino
function idadeNoPlano(plan, entrou) {
  const m = new Map();
  for (const d of lista(plan.dias)) for (const it of lista(d && d.itens)) if (it && it.ex) m.set(it.ex, entrou.get(it.ex) || 0);
  return m;
}

// Textos do aviso (curtos). `nomes`: id → nome do exercício.
export function textoDoAviso(sit, nomes = (id) => id) {
  if (!sit || !sit.devido) return null;
  const n = sit.trocas.length;
  const aux = n === 1 ? '1 exercício auxiliar' : `${n} exercícios auxiliares`;
  if (sit.motivo === 'travado') {
    return n === 1
      ? { titulo: 'Exercício travado', texto: `${nomes(sit.trocas[0].de)} está há 3 treinos sem evoluir. Trocar por outro do mesmo músculo?` }
      : { titulo: 'Exercícios travados', texto: `${n} exercícios auxiliares estão há 3 treinos sem evoluir. Trocar por outros do mesmo músculo?` };
  }
  const ha = `Hora de variar: você faz este treino há ${sit.semanas} semanas.`;
  return n
    ? { titulo: 'Hora de variar', texto: `${ha} Trocar ${aux}?`, curto: `Você faz este treino há ${sit.semanas} semanas. Trocar ${aux}?` }
    : { titulo: 'Hora de variar', texto: `${ha} Não achei substitutos com os seus aparelhos e cuidados: o treino pode seguir como está.`, curto: `Você faz este treino há ${sit.semanas} semanas. Não achei substitutos com os seus aparelhos e cuidados: o treino pode seguir como está.` };
}

// ---------- o que a pessoa decide (alteram o plano recebido; quem chama grava com update) ----------
const registro = (plan) => {
  const v = plan.variacao && typeof plan.variacao === 'object' ? plan.variacao : {};
  const s = (x) => (typeof x === 'string' ? x : '');
  plan.variacao = { desde: s(v.desde), adiadoAte: s(v.adiadoAte), travadoAte: s(v.travadoAte), trocas: lista(v.trocas).slice(-40) };
  return plan.variacao;
};
// Aplica as trocas escolhidas. `motivo` 'prazo' recomeça a contagem; 'travado' não (o prazo do plano continua).
// Devolve quantas foram feitas (a troca só vale se o exercício ainda está naquele lugar).
export function aplicarVariacao(plan, trocas, agoraIso, motivo = 'prazo') {
  const v = registro(plan);
  let n = 0;
  for (const t of lista(trocas)) {
    const d = lista(plan.dias).find((x) => x && x.id === t.diaId);
    const it = d && d.itens[t.idx];
    if (!it || it.ex !== t.de || !t.para || t.para === t.de) continue;
    d.itens[t.idx] = { ...it, ex: t.para, nota: '' };
    v.trocas.push({ de: t.de, para: t.para, em: agoraIso });
    n++;
  }
  v.trocas = v.trocas.slice(-40);
  if (motivo !== 'travado') v.desde = agoraIso;
  v.adiadoAte = '';
  return n;
}
export function adiarVariacao(plan, agoraIso) {
  const v = registro(plan);
  v.adiadoAte = new Date(ms(agoraIso) + ADIAR_SEMANAS * SEMANA).toISOString();
}
// "Manter meu treino". No prazo, recomeça a contagem; num aviso de exercício travado, só deixa de perguntar sobre
// travados por `prazo` semanas (o prazo do plano continua contando).
export function manterTreino(plan, agoraIso, motivo = 'prazo', prazo = 6) {
  const v = registro(plan);
  if (motivo === 'travado') v.travadoAte = new Date(ms(agoraIso) + prazo * SEMANA).toISOString();
  else { v.desde = agoraIso; v.adiadoAte = ''; }
}
// Troca feita à mão no editor do treino: entra no histórico (o exercício novo não sai logo; o antigo não volta logo)
export function registrarTrocaManual(plan, de, para, agoraIso) {
  if (!de || !para || de === para) return;
  const v = registro(plan);
  v.trocas = [...v.trocas, { de, para, em: agoraIso }].slice(-40);
}

// Treino perdido: a pessoa marca "Não treinei" (musculação) ou "Não corri" (corrida) num dia desta semana (hoje ou um dia
// que já passou). Puro: sem DOM. O estado guarda as marcas em state.perdidos (validadas por limparPerdidos, aqui).
//
// O que as fontes sustentam (todas lidas em texto completo):
//  • Para ganhar músculo, o que mais conta é o volume da semana: com o volume ajustado, treinar o músculo mais vezes por
//    semana tem efeito "negligenciável" na massa e efeito positivo, com retorno decrescente, na força (ref pelland2026). O
//    ACSM de 2009 traz o mesmo: 3 dias por semana deram o mesmo ganho de força que 2 quando o volume era igual (ref
//    acsm2009). Por isso, se dá, o treino perdido MUDA DE DIA dentro da semana, para o volume da semana não cair.
//  • Entre duas sessões do mesmo grupo muscular, 48 horas ou mais (ref garber2011, recomendação de nível A; o texto fala em
//    48 a 72 horas). O ACSM de 2009 recomenda dias alternados para quem começa, e deixa dois treinos no mesmo dia só para
//    avançados e atletas de elite, com músculos diferentes em cada um (evidência C — ref acsm2009). Por isso o aplicativo
//    nunca junta dois treinos no mesmo dia nem põe o mesmo músculo pesado em dias seguidos. "Pesado" = 3 séries ou mais com
//    o grupo como músculo principal, o mesmo critério do Treinador (logic/trainer.js) para espalhar os treinos.
//  • Sem dia que respeite esse descanso, a semana segue e o treino volta no dia dele, na semana seguinte. Perder um treino
//    custa pouco: para quem já treina, 1 a 2 dias por semana mantêm a força (ref acsm2009), e poucas semanas sem treinar
//    tiram pouca força (ref caterisano2019). Com 2 semanas ou mais sem treinar, valem as regras da volta (logic/pausa.js):
//    aqui não há outra regra para dias perdidos seguidos.
//  • Corrida + musculação: as mesmas regras do encaixe do Treinador (logic/trainer.js, encaixarNaCorrida) — com prioridade
//    na corrida ou nos dois por igual, pernas a 24 horas ou mais da corrida forte e do longo, e 48 horas para quem é novo
//    na musculação (refs blagrove2018, doma2017). Pelo menos um dia sem treino na semana (ref meeusen2013); menores de 18,
//    dois (ref valovichmcleod2011). Menores de 18 e diabetes: força em dias não seguidos, como no Treinador (refs
//    colberg2016, valovichmcleod2011).
//  • Dias em que a pessoa não treina (resposta do Treinador — logic/dias-livres.js): nunca recebem treino. Um treino que
//    já estava num deles (plano editado à mão) pode ficar onde está, mas nenhum outro vai para lá.
//  • Corrida perdida não se repõe: a marca "Não corri" só fica registrada. O plano de corrida (logic/corrida.js) já não
//    repõe treino perdido e ajusta o volume pelo que foi feito nas últimas semanas. Juntar a corrida perdida a outra faria
//    uma corrida maior, e uma corrida mais de 10% maior do que a mais longa dos últimos 30 dias aumenta o risco de lesão por
//    sobrecarga (ref frandsen2025).
//  • O motivo (MOTIVOS): fica na marca e muda a proposta, sem regra nova — sem tempo e viagem: o treino muda de dia (o
//    volume da semana, ref pelland2026); cansaço ou sono ruim: o app propõe não repor ("perder um treino tira pouca
//    força", refs acsm2009, caterisano2019) e, se quiser, a versão curta (iversen2021, logic/chat/treino.js); dor: o
//    fluxo de dor (logic/dor.js); doente ou machucado: o fluxo de saúde fora do treino (logic/saude-fora.js). Enquanto um
//    problema de saúde muda o treino de um dia (musculação leve ou sem treino; corrida diferente da normal), nenhum
//    treino é reposto nesse dia (diasDeSaude). Cansaço em marcas que se estendem por mais de uma semana: a regra que o app
//    já usa — "cansaço alto por mais de uma semana pede redução ou descanso", com médico depois de 4 semanas (refs
//    saw2016, meeusen2013; FAQ "Como saber se estou treinando demais?" de data/corrida.js). Menos que isso: só mostra.
import { EX_POR_ID } from '../data/exercises.js';
import { MUSCULOS } from '../data/muscles.js';
import { planoDaSemanaEm } from './corrida.js';
import { comboAtual } from './combinado.js';
import { perfil } from './trainer.js';
import { respostasProtegidas } from './saude.js';
import { diasBloqueados, diasSemCorrida } from './dias-livres.js';
import { efeitoDeHoje } from './saude-fora.js';

export const MAX_PERDIDOS = 200;
// 'troca': um treino de musculação da semana feito ANTES do dia dele (o "treino de amanhã hoje"), marcado pelo chat
// 'extra': um treino do plano a mais, planejado para um dia sem musculação desta semana (logic/treino-extra.js)
export const TIPOS_PERDIDO = ['musculacao', 'corrida', 'troca', 'extra'];
// ajuste de uma marca que não é falta: 'descanso' (48 horas para os mesmos músculos de um treino feito ou planejado),
// 'esporte' (longe de um esporte planejado — logic/treino-extra.js) e 'pedido' (a pessoa pediu o treino em outro dia)
export const AJUSTES = ['descanso', 'esporte', 'pedido'];
export const REFS_MUSCULACAO = ['pelland2026', 'garber2011', 'acsm2009', 'caterisano2019'];
export const REFS_COMBINADO = ['blagrove2018'];
export const REFS_CORRIDA = ['frandsen2025'];
export const PESADO = 3; // séries do grupo como músculo principal a partir das quais o treino conta como pesado para ele
export const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// o motivo de não ter treinado (o mesmo para musculação e corrida; 'chuva' só aparece na corrida)
export const MOTIVOS = { tempo: 'Sem tempo', cansaco: 'Cansaço ou dormi mal', dor: 'Dor', doente: 'Doente ou machucado', viagem: 'Viagem', chuva: 'Chuva', feriado: 'Feriado (academia fechada)', outro: 'Outro' };
export const MOTIVO_CURTO = { tempo: 'sem tempo', cansaco: 'cansaço', dor: 'dor', doente: 'doente', viagem: 'viagem', chuva: 'chuva', feriado: 'feriado', outro: '' };
// Feriados (state.feriados, 'AAAA-MM-DD'): a academia não abre. O dia não recebe treino mudado de outro dia; o treino
// que estava nele é marcado como "Não treinei" com o motivo 'feriado', e o treinador propõe o dia com as mesmas regras
// de sempre (descanso entre os músculos, corrida, dias em que a pessoa não treina), para o plano do Treinador e para o
// plano montado pela pessoa. Só a semana atual (a marca de "Não treinei" vale nesta semana).
export const MAX_FERIADOS = 60;
export function limparFeriados(raw) {
  const out = [...new Set((Array.isArray(raw) ? raw : []).filter((d) => diaOk(d)))].sort();
  return out.slice(-MAX_FERIADOS);
}
export const feriadosDe = (st) => new Set(limparFeriados(st && st.feriados));
export const ehFeriado = (st, data) => feriadosDe(st).has(data);
export const REFS_CANSACO = ['saw2016', 'meeusen2013'];
const motivoOk = (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(MOTIVOS, v) ? v : '');
const DIA_MS = 86400000;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const BAD = new Set(['__proto__', 'constructor', 'prototype']);
const idStr = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) && !BAD.has(v) ? v : '');
const iso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : '');
const pad = (n) => String(n).padStart(2, '0');
export const diaOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(Date.parse(v + 'T12:00:00Z')).toISOString().slice(0, 10) === v;
export const somaDias = (k, n) => new Date(Date.parse(k + 'T12:00:00Z') + n * DIA_MS).toISOString().slice(0, 10);
export const diaDaSemana = (k) => new Date(k + 'T12:00:00Z').getUTCDay();
export const segundaDe = (k) => somaDias(k, -((diaDaSemana(k) + 6) % 7));
// dia (no relógio do aparelho) em que um treino começou: o mesmo critério das telas
export const diaLocal = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// "segunda", "hoje", "amanhã"
export function nomeDoDia(k, hoje) {
  if (k === hoje) return 'hoje';
  if (diaOk(hoje) && k === somaDias(hoje, 1)) return 'amanhã';
  return DIAS[diaDaSemana(k)];
}
// "na próxima segunda" / "no próximo sábado"
export const naProxima = (k) => { const w = diaDaSemana(k); return (w === 0 || w === 6 ? 'no próximo ' : 'na próxima ') + DIAS[w]; };

// ---------- validação ----------
// musculação: { tipo, data, planId, diaId, movs: [{ diaId, de, para }], em, motivo? } — movs vazio = "Seguir a semana"; o primeiro é o
// treino perdido (de = data); os outros são os treinos que andaram junto. Tudo dentro da semana (segunda a domingo) da
// data, sempre para um dia depois. corrida: { tipo, data, em, para? } — `para` (opcional) = a corrida mudou para outro dia
// da mesma semana (o chat propõe com as regras do plano: avaliarMoverCorrida). `motivo` (opcional, nas duas): uma chave
// de MOTIVOS. troca: { tipo, data (dia em que o treino é
// feito), de (dia em que ele estava), planId, diaId, em } — tudo na mesma semana.
export function limparPerdido(x) {
  if (!isObj(x) || !TIPOS_PERDIDO.includes(x.tipo) || !diaOk(x.data)) return null;
  const em = iso(x.em);
  const motivo = motivoOk(x.motivo);
  // extra: o id do treino a mais planejado (logic/treino-extra.js) que fez a marca; sai junto com ele
  const ex = idStr(x.extra);
  const comMotivo = (o) => (ex ? { ...(motivo ? { ...o, motivo } : o), extra: ex } : motivo ? { ...o, motivo } : o);
  if (x.tipo === 'extra') {
    const planId = idStr(x.planId), diaId = idStr(x.diaId);
    return planId && diaId && ex ? { tipo: 'extra', data: x.data, planId, diaId, em, extra: ex } : null;
  }
  if (x.tipo === 'corrida') {
    // feitoEm: a corrida foi feita depois, nesse dia (reajustarDepoisDaCorrida); com ela, não há mais dia novo
    const feitoEm = diaOk(x.feitoEm) && segundaDe(x.feitoEm) === segundaDe(x.data) && x.feitoEm >= x.data ? x.feitoEm : '';
    const para = !feitoEm && diaOk(x.para) && x.para !== x.data && segundaDe(x.para) === segundaDe(x.data) ? x.para : '';
    return comMotivo(para ? { tipo: 'corrida', data: x.data, em, para } : feitoEm ? { tipo: 'corrida', data: x.data, em, feitoEm } : { tipo: 'corrida', data: x.data, em });
  }
  if (x.tipo === 'troca') {
    const planId = idStr(x.planId), diaId = idStr(x.diaId);
    if (!planId || !diaId || !diaOk(x.de) || x.de === x.data || segundaDe(x.de) !== segundaDe(x.data)) return null;
    // (a troca não tem motivo: só o id do treino a mais que a fez, se foi ele)
    return { tipo: 'troca', data: x.data, de: x.de, planId, diaId, em, ...(ex ? { extra: ex } : {}) };
  }
  const planId = idStr(x.planId), diaId = idStr(x.diaId);
  if (!planId || !diaId) return null;
  const seg = segundaDe(x.data);
  let movs = Array.isArray(x.movs) ? x.movs.slice(0, 7).map((m) => (isObj(m) ? { diaId: idStr(m.diaId), de: diaOk(m.de) ? m.de : '', para: diaOk(m.para) ? m.para : '' } : null)) : [];
  const valido = movs.length > 0 && movs.every((m) => m && m.diaId && m.de && m.para && segundaDe(m.de) === seg && segundaDe(m.para) === seg && m.para > m.de)
    && movs[0].diaId === diaId && movs[0].de === x.data
    && new Set(movs.map((m) => m.de)).size === movs.length && new Set(movs.map((m) => m.para)).size === movs.length;
  if (!valido) movs = [];
  // feitoEm: o treino deste dia já foi feito antes, nesse dia (logic/perdido.js, reajustarDepoisDoTreino);
  // trocadoPor: neste dia a pessoa fez outro treino do plano no lugar deste
  // (o próprio dia: a pessoa avisou depois que treinou, sem registro no app)
  const feitoEm = diaOk(x.feitoEm) && segundaDe(x.feitoEm) === seg ? x.feitoEm : '';
  // ('livre' = um treino fora do plano)
  const trocadoPor = idStr(x.trocadoPor) && x.trocadoPor !== diaId ? x.trocadoPor : '';
  // ajuste 'descanso': o treino mudou de dia para dar 48 horas aos mesmos músculos de um treino feito antes
  const ajuste = AJUSTES.includes(x.ajuste) && movs.length ? x.ajuste : '';
  return comMotivo({ tipo: 'musculacao', data: x.data, planId, diaId, movs, em, ...(feitoEm ? { feitoEm } : {}), ...(trocadoPor ? { trocadoPor } : {}), ...(ajuste ? { ajuste } : {}) });
}
export function limparPerdidos(raw) {
  if (!Array.isArray(raw)) return [];
  const vistos = new Set(), out = [];
  for (const x of raw.slice(0, MAX_PERDIDOS * 5)) {
    const p = limparPerdido(x);
    if (!p) continue;
    const k = p.tipo + '|' + p.data + '|' + (p.planId || '');
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(p);
  }
  // em ordem de data (e, no mesmo dia, de marcação); ficam as mais recentes
  out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : (a.em || '') < (b.em || '') ? -1 : (a.em || '') > (b.em || '') ? 1 : 0));
  return out.length > MAX_PERDIDOS ? out.slice(-MAX_PERDIDOS) : out;
}

// ---------- semana com as marcas ----------
// Os 7 dias (segunda a domingo) da semana que começa em `segunda`, com o treino de musculação que vale em cada um depois
// das marcas: { data, wd, diaId, veioDe (data de onde o treino veio), foiPara (para onde foi o treino da agenda deste dia),
// perdido: { entrada, diaId, para } | null, corridaPerdida: entrada | null }. As marcas são aplicadas na ordem em que foram
// feitas; marca que não bate mais com o plano (o plano mudou depois) é ignorada; mudança que não bate vira "Seguir a semana".
export function semanaEfetiva(plan, perdidos, segunda) {
  const ok = plan && Array.isArray(plan.dias) && isObj(plan.agenda);
  const existe = (id) => ok && plan.dias.some((d) => d && d.id === id);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const data = somaDias(segunda, i), wd = diaDaSemana(data);
    const id = ok ? plan.agenda[wd] : '';
    return { data, wd, diaId: existe(id) ? id : '', veioDe: '', foiPara: '', perdido: null, corridaPerdida: null };
  });
  const idx = (k) => dias.findIndex((d) => d.data === k);
  const lista = (Array.isArray(perdidos) ? perdidos : []).filter((e) => isObj(e) && diaOk(e.data) && segundaDe(e.data) === segunda);
  for (const e of lista) {
    const i = idx(e.data);
    if (e.tipo === 'corrida') { dias[i].corridaPerdida = e; continue; }
    if (e.tipo === 'extra') {
      // um treino a mais num dia sem musculação
      if (ok && e.planId === plan.id && existe(e.diaId) && !dias[i].diaId && !dias[i].perdido) { dias[i].diaId = e.diaId; dias[i].extra = e.extra; }
      continue;
    }
    if (e.tipo === 'troca') {
      // o treino de `de` feito em `data` (que estava sem musculação)
      const a = idx(e.de);
      if (ok && e.planId === plan.id && a >= 0 && !dias[a].perdido && !dias[i].perdido && dias[a].diaId === e.diaId && !dias[i].diaId) {
        dias[a].diaId = ''; dias[a].foiPara = e.data;
        dias[i].diaId = e.diaId; dias[i].veioDe = e.de;
      }
      continue;
    }
    if (!ok || e.planId !== plan.id || dias[i].perdido || !dias[i].diaId || dias[i].diaId !== e.diaId) continue;
    const antes = dias.map((d) => d.diaId);
    const movs = Array.isArray(e.movs) ? e.movs : [];
    const movOk = movs.length > 0 && movs.every((m) => {
      const a = idx(m.de), b = idx(m.para);
      return a >= 0 && b >= 0 && antes[a] === m.diaId && existe(m.diaId) && !dias[b].perdido && (antes[b] === '' || movs.some((o) => o.de === m.para));
    });
    dias[i].perdido = { entrada: e, diaId: e.diaId, para: movOk ? movs[0].para : '' };
    dias[i].diaId = '';
    if (!movOk) continue;
    for (const m of movs) { const a = idx(m.de); dias[a].diaId = ''; if (m.de !== e.data) dias[a].foiPara = m.para; }
    for (const m of movs) { const b = idx(m.para); dias[b].diaId = m.diaId; dias[b].veioDe = m.de; }
  }
  return dias;
}
export const planoAtivo = (st) => (st && Array.isArray(st.plans) ? st.plans.find((p) => p && p.id === st.activePlan) || null : null);
// O treino de musculação que vale numa data (com as marcas da semana dela): { diaId, veioDe, foiPara, perdido }
export function treinoDoDia(st, data) {
  const plan = planoAtivo(st);
  if (!plan || !diaOk(data)) return null;
  const sem = semanaEfetiva(plan, st.perdidos, segundaDe(data));
  return sem[(diaDaSemana(data) + 6) % 7];
}

// ---------- carga de cada dia ----------
const ESTABILIZA = new Set(['abdomen', 'obliquos', 'lombar', 'antebraco', 'trapezio']);
const G_PERNA = new Set(['quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'adutores']);
// { grupos: { grupo: séries como músculo principal }, pernas: bool } de uma lista de itens (do plano ou de um treino feito)
function cargaDe(itens, series) {
  const grupos = {};
  let pernas = 0;
  for (const it of Array.isArray(itens) ? itens : []) {
    const ex = it && EX_POR_ID.get(it.ex);
    if (!ex || ex.padrao === 'cardio' || ex.registro === 'minutos') continue;
    const n = series(it);
    if (!(n > 0)) continue;
    if (G_PERNA.has(ex.grupo)) pernas++;
    const gs = new Set();
    for (const mu of ex.primarios || []) if (!ESTABILIZA.has(mu) && MUSCULOS[mu]) gs.add(MUSCULOS[mu].grupo);
    for (const g of gs) grupos[g] = (grupos[g] || 0) + n;
  }
  return { grupos, pernas: pernas >= 2 };
}
export const cargaDoTreino = (dia) => cargaDe(dia && dia.itens, (it) => Number(it.series) || 0);
const cargaDaSessao = (s) => cargaDe(s && s.itens, (it) => (Array.isArray(it.sets) ? it.sets.filter((x) => x && x.ok).length : 0));
function juntar(cs) {
  if (!cs.length) return null;
  const grupos = {};
  for (const c of cs) for (const [g, n] of Object.entries(c.grupos)) grupos[g] = (grupos[g] || 0) + n;
  return { grupos, pernas: cs.some((c) => c.pernas) };
}
// o mesmo grupo pesado nos dois dias
export const choca = (a, b) => !!a && !!b && Object.keys(a.grupos).some((g) => a.grupos[g] >= PESADO && (b.grupos[g] || 0) >= PESADO);

// ---------- contexto da semana ----------
function corridaDaSemana(st, hoje, seg) {
  const corre = new Array(9).fill(false), chave = new Array(9).fill(false);
  try {
    for (const [base, desloc] of [[seg, 0], [somaDias(seg, 7), 7]]) {
      const s = planoDaSemanaEm(st, hoje, base);
      if (!s || !Array.isArray(s.dias) || s.foraDoPlano || s.concluido) continue;
      for (let i = 0; i < 7 && desloc + i < 9; i++) {
        const d = s.dias[diaDaSemana(somaDias(base, i))];
        // corrida que mudou de dia (marca com `para`): conta no dia novo, não no de origem
        if (!d || d.tipo === 'descanso' || d.movidaPara) continue;
        corre[desloc + i] = true;
        if ((d.tipo === 'longo' && !d.comoRodagem) || d.forte === true || d.intensidade === 'forte') chave[desloc + i] = true;
      }
    }
  } catch { /* sem plano de corrida legível: segue sem as corridas */ }
  const runs = Array.isArray(st.runs) ? st.runs : [];
  for (let i = 0; i < 7; i++) if (runs.some((r) => r && r.data === somaDias(seg, i))) corre[i] = true;
  return { corre, chave };
}
// perfil do Treinador com as condições mais protegidas entre as entrevistas; menor de 18 se QUALQUER entrevista disser
function perfilDe(st, hoje) {
  let pf;
  try { pf = perfil(respostasProtegidas('treinador', st, hoje).respostas); } catch { pf = perfil({}); }
  const idades = [st.trainer, st.run].map((o) => (o && isObj(o.answers) ? o.answers.idade : null)).filter((x) => typeof x === 'number' && Number.isFinite(x));
  return idades.some((x) => x < 18) ? { ...pf, jovem: true } : pf;
}

// ---------- o que fazer com o treino perdido ----------
// Pode marcar "Não treinei" em `data`? Devolve { pode, motivo, diaId, nome }. `opc.futuro`: vale também para um dia
// desta semana que ainda não chegou ("na sexta não vou poder ir", pelo chat).
export function podeMarcar(st, data, hoje, opc = {}) {
  const plan = planoAtivo(st);
  const nao = (motivo) => ({ pode: false, motivo, diaId: '', nome: '' });
  if (!plan || !diaOk(data) || !diaOk(hoje)) return nao('sem_plano');
  if (data > hoje && !(opc && opc.futuro)) return nao('futuro');
  if (segundaDe(data) !== segundaDe(hoje)) return nao('outra_semana');
  const dia = treinoDoDia(st, data);
  if (!dia || dia.perdido) return nao(dia && dia.perdido ? 'marcado' : 'sem_treino');
  if (!dia.diaId) return nao('sem_treino');
  if (!(opc && opc.aposTreino) && (Array.isArray(st.sessions) ? st.sessions : []).some((s) => s && diaLocal(s.inicio) === data)) return nao('treinou');
  if (st.current && data === hoje) return nao('em_andamento');
  if (plan.criadoEm && diaLocal(plan.criadoEm) > data) return nao('antes_do_plano');
  const d = plan.dias.find((x) => x.id === dia.diaId);
  return { pode: true, motivo: '', diaId: dia.diaId, nome: d ? d.nome : 'Treino' };
}

// Dias desta semana (de `hoje` a domingo) em que um problema de saúde fora do treino (logic/saude-fora.js) muda o treino:
// `tipo` 'musc' (musculação leve ou sem treino) ou 'corrida' (corrida diferente da normal). Nesses dias nada é reposto.
export function diasDeSaude(st, hoje, tipo = 'musc') {
  const out = new Set();
  if (!st || !Array.isArray(st.saudeFora) || !st.saudeFora.length || !diaOk(hoje)) return out;
  const seg = segundaDe(hoje);
  for (let k = 0; k < 7; k++) {
    const d = somaDias(seg, k);
    if (d < hoje) continue;
    try { const ef = efeitoDeHoje(st, d); if ((tipo === 'corrida' ? ef.corrida : ef.musc) !== 'normal') out.add(d); } catch { /* sem o registro */ }
  }
  return out;
}

// A proposta para o treino de `data`: { pode, diaId, nome, movs: [{ diaId, de, para }] (vazio = seguir a semana), motivo:
// 'livre' | 'sem_dia' | 'saude' | 'sem_descanso' | 'sem_folga' | 'corrida', titulo, texto, alternado }. `hoje` = 'AAAA-MM-DD'.
// `opc.para`: o treino perdido só pode ir para esse dia (sem jeito, a proposta é seguir a semana e diz por quê);
// `opc.futuro`: ver podeMarcar. Dias com problema de saúde que muda o treino (diasDeSaude) não recebem treino.
export function propor(st, data, hoje, opc = {}) {
  const base = podeMarcar(st, data, hoje, opc);
  if (!base.pode) return { ...base, movs: [] };
  const plan = planoAtivo(st);
  const seg = segundaDe(hoje);
  const sem = semanaEfetiva(plan, st.perdidos, seg);
  const datas = sem.map((d) => d.data);
  const i = datas.indexOf(data), iHoje = datas.indexOf(hoje);
  const diaPorId = new Map(plan.dias.map((d) => [d.id, d]));
  const sessoes = (Array.isArray(st.sessions) ? st.sessions : []).filter((s) => s && typeof s.inicio === 'string');
  const feitasEm = (k) => sessoes.filter((s) => diaLocal(s.inicio) === k).map(cargaDaSessao);
  // carga de -1 (domingo anterior) a 7 (segunda seguinte); fixo = o dia não muda (passou, teve treino ou tem marca)
  const carga = new Array(9).fill(null), fixo = new Array(9).fill(true), conteudo = new Array(9).fill('');
  const at = (k) => k + 1;
  carga[at(-1)] = juntar(feitasEm(somaDias(seg, -1)));
  for (let k = 0; k < 7; k++) {
    const feitas = feitasEm(datas[k]);
    if (feitas.length) { carga[at(k)] = juntar(feitas); conteudo[at(k)] = '#feito'; continue; }
    if (k < iHoje || sem[k].perdido || k === i) continue;
    fixo[at(k)] = false;
    if (sem[k].diaId && diaPorId.has(sem[k].diaId)) { carga[at(k)] = cargaDoTreino(diaPorId.get(sem[k].diaId)); conteudo[at(k)] = sem[k].diaId; }
  }
  {
    const prox = somaDias(seg, 7), id = plan.agenda[diaDaSemana(prox)];
    const feitas = feitasEm(prox);
    carga[at(7)] = feitas.length ? juntar(feitas) : diaPorId.has(id) ? cargaDoTreino(diaPorId.get(id)) : null;
  }
  const X = diaPorId.get(base.diaId);
  const cargaX = cargaDoTreino(X);
  const { corre, chave } = corridaDaSemana(st, hoje, seg);
  const combo = (() => { try { return comboAtual(st); } catch { return { foco: '' }; } })();
  const ajusta = combo.foco === 'corrida' || combo.foco === 'equilibrio';
  const pf = perfilDe(st, hoje);
  const novato = pf.nivel === 1, alternado = !!(pf.jovem || pf.diabetes);
  const minDescanso = pf.jovem ? 2 : 1;
  const descansos = (cs) => { let n = 0; for (let k = 0; k < 7; k++) if (!cs[at(k)] && !corre[k]) n++; return n; };
  const antes = carga.slice(); antes[at(i)] = cargaX;
  const descansoAntes = descansos(antes);

  // os dias que podem receber: de hoje (ou de amanhã, se o perdido é o de hoje) até domingo, sem treino feito nem marca,
  // e fora dos dias em que a pessoa não treina (a não ser o treino que já estava lá, que pode ficar)
  const bloq = new Set(diasBloqueados(st));
  const fer = feriadosDe(st);
  const bloqueado = (k) => bloq.has(sem[k].wd) || fer.has(sem[k].data);
  const saude = diasDeSaude(st, hoje, 'musc');
  const alvo = opc && diaOk(opc.para) ? opc.para : '';
  const evitar = new Set(opc && Array.isArray(opc.evitar) ? opc.evitar.filter(diaOk) : []);
  const vagas = [];
  for (let k = Math.max(iHoje, i + 1); k < 7; k++) if (!fixo[at(k)] && (!bloqueado(k) || conteudo[at(k)])) vagas.push(k);
  // os treinos que podem andar junto: os que estão nessas vagas
  const elems = [{ diaId: base.diaId, de: i, carga: cargaX }];
  for (const k of vagas) if (conteudo[at(k)]) elems.push({ diaId: conteudo[at(k)], de: k, carga: carga[at(k)] });
  const livres = vagas.filter((k) => !conteudo[at(k)] && !bloqueado(k)).length;

  let melhor = null, melhorCusto = Infinity;
  const motivos = new Set();
  const atual = new Array(elems.length).fill(-1), usada = new Set();
  const avaliar = () => {
    const cs = carga.slice(), mud = new Array(9).fill(false);
    for (let j = 1; j < elems.length; j++) if (atual[j] !== elems[j].de) { cs[at(elems[j].de)] = null; mud[at(elems[j].de)] = true; }
    for (let j = 0; j < elems.length; j++) if (j === 0 || atual[j] !== elems[j].de) { cs[at(atual[j])] = elems[j].carga; mud[at(atual[j])] = true; }
    let erro = '';
    for (let k = -1; k < 7 && !erro; k++) {
      if (!mud[at(k)] && !mud[at(k + 1)]) continue;
      const a = cs[at(k)], b = cs[at(k + 1)];
      if (a && b && (choca(a, b) || alternado)) erro = 'sem_descanso';
    }
    let custo = 0;
    for (let j = 0; j < elems.length && !erro; j++) {
      const s = atual[j];
      if (j > 0 && s === elems[j].de) continue;
      const c = elems[j].carga;
      if (ajusta && c && c.pernas) {
        if (chave[s + 1] || (novato && chave[s + 2])) { erro = 'corrida'; break; }
        if (chave[s]) custo += 3;
      }
      if (corre[s]) custo += 0.5;
    }
    if (!erro && descansos(cs) < Math.min(minDescanso, descansoAntes)) erro = 'sem_folga';
    if (erro) { motivos.add(erro); return; }
    let movidos = 0, desloc = 0;
    for (let j = 1; j < elems.length; j++) if (atual[j] !== elems[j].de) { movidos++; desloc += atual[j] - elems[j].de; }
    custo += movidos * 100 + atual[0] + desloc * 0.1;
    if (custo < melhorCusto - 1e-9) { melhorCusto = custo; melhor = atual.slice(); }
  };
  const tenta = (j) => {
    if (j === elems.length) { avaliar(); return; }
    for (const k of vagas) {
      if (usada.has(k) || (j > 0 && k < elems[j].de)) continue;
      if (j === 0 && alvo && datas[k] !== alvo) continue; // o dia escolhido pela pessoa
      // dias a evitar para quem tem pernas (perto de um esporte planejado: logic/treino-extra.js)
      if (evitar.size && evitar.has(datas[k]) && !(j > 0 && k === elems[j].de) && elems[j].carga && elems[j].carga.pernas) continue;
      const fica = j > 0 && k === elems[j].de;
      if (bloqueado(k) && !fica) continue; // dia sem treino: só o treino que já era dele
      if (saude.has(datas[k]) && !fica) continue; // problema de saúde nesse dia: nada é reposto nele
      usada.add(k); atual[j] = k; tenta(j + 1); usada.delete(k);
    }
  };
  if (vagas.length) tenta(0);

  const nomeDe = (id) => (diaPorId.get(id) || {}).nome || 'Treino';
  const out = { pode: true, diaId: base.diaId, nome: base.nome, movs: [], motivo: '', titulo: '', texto: '', alternado };
  if (melhor) {
    out.movs = elems.map((e, j) => ({ diaId: e.diaId, de: datas[e.de], para: datas[melhor[j]] })).filter((m, j) => j === 0 || m.para !== m.de);
    out.motivo = 'livre';
    const para = out.movs[0].para;
    out.titulo = `Passar o ${base.nome} para ${nomeDoDia(para, hoje)}?`;
    const outros = out.movs.slice(1).map((m) => `o ${nomeDe(m.diaId)} vai para ${nomeDoDia(m.para, hoje)}`);
    out.texto = outros.length ? `Para manter o descanso entre os treinos, ${outros.length > 1 ? outros.slice(0, -1).join(', ') + ' e ' + outros[outros.length - 1] : outros[0]}.` : 'Os outros continuam nos dias deles.';
  } else {
    const semSaude = vagas.filter((k) => !conteudo[at(k)] && !bloqueado(k) && !saude.has(datas[k])).length;
    out.motivo = !livres ? 'sem_dia' : !semSaude ? 'saude' : motivos.has('sem_descanso') || !motivos.size ? 'sem_descanso' : motivos.has('corrida') ? 'corrida' : 'sem_folga';
    out.titulo = 'Seguir a semana?';
    const por = out.motivo === 'sem_dia' ? 'Não há outro dia livre nesta semana.'
      : out.motivo === 'saude' ? 'O problema de saúde que você contou ainda muda o treino nos outros dias.'
        : out.motivo === 'corrida' ? 'Nos dias livres, o treino de pernas ficaria perto da corrida forte ou do longo.'
          : out.motivo === 'sem_folga' ? 'Nos dias livres, a semana ficaria sem nenhum dia de descanso.'
            : 'Nenhum dia livre desta semana deixa 48 horas de descanso para os mesmos músculos.';
    out.texto = `${por} O ${base.nome} volta ${naProxima(data)}, no dia de sempre.`;
  }
  return out;
}

// ---------- treino feito em outro dia (ou outro treino): o treinador reajusta a semana ----------
// A pessoa concluiu um treino num dia em que ele não estava. Ex.: na segunda marcou "Não treinei", o Treino A passou para
// sexta e, na terça, ela fez o Treino A. As regras são as de sempre (propor):
//  1. O Treino A não vai mais para sexta: a mudança da marca de segunda sai (a sexta volta a ter o treino dela) e a marca
//     guarda que ele foi feito na terça. Se o A estava num dia seguinte pela agenda (sem marca), esse dia fica livre.
//  2. O treino que era da terça (se havia e não foi feito) vira "não treinado" nesse dia, com "fez o Treino A no lugar", e
//     vai para outro dia desta semana pelas mesmas regras de "Não treinei" (48 horas para os mesmos músculos contando o
//     treino feito, dias livres, corrida, um dia de descanso — refs garber2011, acsm2009, meeusen2013); sem dia que dê,
//     volta na semana seguinte (perder um treino custa pouco — refs acsm2009, caterisano2019).
// Treino diferente (livre, de outro plano ou montado na hora): o que conta são os músculos. Para ganhar músculo, o que mais
// pesa é o volume da semana (ref pelland2026); por isso um treino da semana que ainda falta e cujos músculos principais o
// treino feito já trabalhou (75% das séries de cada um ou mais — COBRE) conta como feito, e o dia dele fica livre. O que
// não ficou coberto segue as regras de cima: o treino do dia muda de dia, e o de amanhã, se pega os mesmos músculos
// pesados do treino feito, também muda (48 horas — ref garber2011).
// Devolve { perdidos, textos } (as marcas novas e o que mudou, em frases) ou null quando nada muda.
const COBRE = 0.75;
const cobre = (feito, treino) => {
  const pesados = Object.keys(treino.grupos).filter((g) => treino.grupos[g] >= PESADO);
  return pesados.length > 0 && pesados.every((g) => (feito.grupos[g] || 0) >= Math.ceil(COBRE * treino.grupos[g]));
};
export function reajustarDepoisDoTreino(st, sessao, hoje, em) {
  const plan = planoAtivo(st);
  const D = sessao && typeof sessao.inicio === 'string' ? diaLocal(sessao.inicio) : '';
  if (!plan || !sessao || !diaOk(D) || !diaOk(hoje) || D > hoje || segundaDe(D) !== segundaDe(hoje)) return null;
  const nome = (id) => (plan.dias.find((d) => d.id === id) || {}).nome || '';
  const doPlano = sessao.planId === plan.id && !!nome(sessao.diaId);
  const X = doPlano ? sessao.diaId : '';
  const seg = segundaDe(hoje);
  const perdidos = limparPerdidos(st.perdidos);
  // o treino do dia, que tinha saído porque a pessoa fez outro no lugar, foi feito também: volta para o dia dele
  const trocado = X ? perdidos.find((e) => e.tipo === 'musculacao' && e.data === D && e.diaId === X && e.trocadoPor) : null;
  if (trocado) return { perdidos: perdidos.filter((e) => e !== trocado), textos: [`O ${nome(X)} também foi feito ${nomeDoDia(D, hoje)}: fica no dia dele.`] };
  const sem = semanaEfetiva(plan, perdidos, seg);
  const iD = sem.findIndex((d) => d.data === D);
  if (iD < 0 || (X && sem[iD].diaId === X)) return null;
  const sessoes = Array.isArray(st.sessions) ? st.sessions : [];
  const feitoNoDia = (id, data) => sessoes.some((x) => x && x !== sessao && x.planId === plan.id && x.diaId === id && diaLocal(x.inicio) === data);
  const cargaFeita = cargaDaSessao(sessao);
  const cargaDe_ = (id) => cargaDoTreino(plan.dias.find((d) => d.id === id));
  const textos = [];
  const marcas = perdidos.map((e) => ({ ...e, ...(Array.isArray(e.movs) ? { movs: e.movs.map((m) => ({ ...m })) } : {}) }));
  const livres = []; // dias desta semana que ficaram livres
  // 1. o mesmo treino num dia seguinte desta semana
  const k = X ? sem.findIndex((d, j) => j > iD && d.diaId === X && !d.perdido) : -1;
  if (k >= 0) {
    const dk = sem[k].data;
    const P_ = sem[k].veioDe ? marcas.find((e) => e.tipo === 'musculacao' && e.planId === plan.id && Array.isArray(e.movs) && e.movs.some((m) => m.diaId === X && m.para === dk)) : null;
    if (P_) {
      P_.movs = []; P_.feitoEm = D;
      textos.push(`O ${nome(X)} foi feito ${nomeDoDia(D, hoje)}: não vai mais para ${nomeDoDia(dk, hoje)}.`);
    } else {
      marcas.push({ tipo: 'musculacao', data: dk, planId: plan.id, diaId: X, movs: [], em, feitoEm: D });
      textos.push(`O ${nome(X)} foi feito ${nomeDoDia(D, hoje)}: ${nomeDoDia(dk, hoje)} fica livre.`);
    }
    livres.push(k);
  } else if (X) {
    // marcado como não treinado antes, sem dia novo ("seguir a semana"): a marca guarda que ele foi feito
    const antes = marcas.find((e) => e.tipo === 'musculacao' && e.planId === plan.id && e.diaId === X && e.data < D && segundaDe(e.data) === seg && !e.feitoEm && !(Array.isArray(e.movs) && e.movs.length));
    if (antes) { antes.feitoEm = D; textos.push(`O ${nome(X)} de ${nomeDoDia(antes.data, hoje)} foi feito ${nomeDoDia(D, hoje)}.`); }
  }
  // treino diferente: os treinos que ainda faltam na semana e cujos músculos ele já trabalhou contam como feitos
  const Y = sem[iD].diaId;
  const yCoberto = !X && Y && cobre(cargaFeita, cargaDe_(Y));
  if (!X) {
    for (let j = iD; j < 7; j++) {
      const d = sem[j];
      if (!d.diaId || d.perdido || feitoNoDia(d.diaId, d.data) || (j > iD && d.data <= hoje) || !cobre(cargaFeita, cargaDe_(d.diaId))) continue;
      marcas.push({ tipo: 'musculacao', data: d.data, planId: plan.id, diaId: d.diaId, movs: [], em, feitoEm: D });
      textos.push(j === iD ? `O treino de ${nomeDoDia(D, hoje)} trabalhou os mesmos músculos do ${nome(d.diaId)}: ele conta como feito.` : `O treino de ${nomeDoDia(D, hoje)} já trabalhou os músculos do ${nome(d.diaId)} de ${nomeDoDia(d.data, hoje)}: ele conta como feito, e ${nomeDoDia(d.data, hoje)} fica livre.`);
      if (j > iD) livres.push(j);
    }
  }
  // 2. o treino que era deste dia, se não foi feito nem ficou coberto
  let lista = limparPerdidos(marcas);
  if (Y && Y !== X && !yCoberto && !feitoNoDia(Y, D)) {
    const p = propor({ ...st, perdidos: lista }, D, hoje, { aposTreino: true });
    if (p.pode) {
      const m = limparPerdido({ tipo: 'musculacao', data: D, planId: plan.id, diaId: Y, movs: p.movs, em, trocadoPor: X || 'livre' });
      if (m) lista = limparPerdidos([...lista, m]);
      const outros = p.movs.slice(1).map((x) => `o ${nome(x.diaId)} vai para ${nomeDoDia(x.para, hoje)}`);
      textos.push(p.movs.length ? `O ${nome(Y)}, que era ${nomeDoDia(D, hoje)}, passou para ${nomeDoDia(p.movs[0].para, hoje)}${outros.length ? ' e ' + outros.join(', ') : ''}.` : `O ${nome(Y)}, que era ${nomeDoDia(D, hoje)}, volta ${naProxima(D)}: nesta semana não há dia com descanso suficiente.`);
    }
  }
  // 3. o treino de amanhã com os mesmos músculos pesados do treino feito: 48 horas de descanso
  const amanha = somaDias(D, 1);
  const sem2 = semanaEfetiva(plan, lista, seg);
  const iA = sem2.findIndex((d) => d.data === amanha);
  if (iA > 0 && sem2[iA].diaId && !sem2[iA].perdido && amanha > hoje && choca(cargaFeita, cargaDe_(sem2[iA].diaId))) {
    const Z = sem2[iA].diaId;
    const p = propor({ ...st, perdidos: lista }, amanha, hoje, { futuro: true });
    if (p.pode && p.movs.length) {
      const m = limparPerdido({ tipo: 'musculacao', data: amanha, planId: plan.id, diaId: Z, movs: p.movs, em, ajuste: 'descanso' });
      if (m) { lista = limparPerdidos([...lista, m]); textos.push(`O ${nome(Z)} de amanhã passou para ${nomeDoDia(p.movs[0].para, hoje)}: os mesmos músculos precisam de 48 horas de descanso.`); }
    }
  }
  if (!textos.length) return null;
  // o dia que ficou livre volta a ter o treino dele?
  const fim = semanaEfetiva(plan, lista, seg);
  for (const j of livres) if (fim[j].diaId && !fim[j].veioDe && !fim[j].perdido) textos.push(`${capi(nomeDoDia(fim[j].data, hoje))} volta a ter o ${nome(fim[j].diaId)}.`);
  return { perdidos: lista, textos };
}

// ---------- corrida feita depois ----------
// A corrida marcada "Não corri" (ou que mudou para um dia seguinte) foi feita depois, num dia sem corrida do plano (ou a
// mais no dia). A marca guarda "feita em tal dia" e, se a corrida tinha ido para um dia seguinte, ela sai de lá. O resto o
// plano de corrida já faz com o que foi registrado: o volume da semana conta a corrida, e um treino forte feito na véspera
// deixa o forte do dia seguinte leve (logic/corrida.js; refs buchheit2014, seiler2009). Uma corrida perdida não se repõe
// juntando com outra (ref frandsen2025): aqui ela só foi feita em outro dia. Devolve { perdidos, textos } ou null.
export function reajustarDepoisDaCorrida(st, registro, hoje) {
  const D = registro && diaOk(registro.data) ? registro.data : '';
  if (!D || !diaOk(hoje) || D > hoje || segundaDe(D) !== segundaDe(hoje)) return null;
  const seg = segundaDe(hoje);
  // a corrida que o plano tinha para esse dia: se havia e este é o único registro do dia, ele é ela (nada a reajustar)
  let doDia = null;
  try { const s = planoDaSemanaEm(st, hoje, seg); doDia = s && Array.isArray(s.dias) ? s.dias[diaDaSemana(D)] : null; } catch { doDia = null; }
  const outros = (Array.isArray(st.runs) ? st.runs : []).filter((r) => r && r.data === D && r.id !== registro.id);
  if (doDia && doDia.tipo !== 'descanso' && !outros.length) return null;
  const perdidos = limparPerdidos(st.perdidos);
  const daSemana = perdidos.filter((e) => e.tipo === 'corrida' && e.data < D && segundaDe(e.data) === seg && !e.feitoEm && (!e.para || e.para > D))
    .sort((a, b) => (a.para && !b.para ? -1 : !a.para && b.para ? 1 : a.data < b.data ? 1 : -1));
  const m = daSemana[0];
  if (!m) return null;
  const lista = perdidos.map((e) => (e === m ? (() => { const n = { ...e, feitoEm: D }; delete n.para; return n; })() : e));
  const textos = [m.para ? `A corrida de ${nomeDoDia(m.data, hoje)} foi feita ${nomeDoDia(D, hoje)}: não vai mais para ${nomeDoDia(m.para, hoje)}.` : `A corrida de ${nomeDoDia(m.data, hoje)} foi feita ${nomeDoDia(D, hoje)}.`];
  return { perdidos: limparPerdidos(lista), textos };
}

// A marca a gravar: 'mover' (a proposta, se houver) ou 'seguir'. `em` = ISO de agora. null se não dá para marcar.
// `opc.para`: o dia escolhido (o mesmo de propor); `opc.motivo`: uma chave de MOTIVOS, guardada na marca.
export function novaMarca(st, data, hoje, escolha, em, opc = {}) {
  const p = propor(st, data, hoje, opc);
  if (!p.pode) return null;
  const plan = planoAtivo(st);
  return limparPerdido({ tipo: 'musculacao', data, planId: plan.id, diaId: p.diaId, movs: escolha === 'mover' ? p.movs : [], em, motivo: opc && opc.motivo });
}

// Para que dias desta semana o treino perdido de `data` pode ir: de hoje (ou de amanhã, se o perdido é o de hoje) até
// domingo, cada um com as mesmas regras de propor. { ...propor(), dias: [{ data, pode, motivo, movs, titulo, texto,
// ocupadoPor }], melhor: data | '' } — motivo de um dia que não dá: 'bloqueado' | 'saude' | 'treinou' | 'marcado' |
// 'sem_descanso' | 'sem_folga' | 'corrida'.
export function opcoesDeDia(st, data, hoje, opc = {}) {
  const base = propor(st, data, hoje, { ...opc, para: '' });
  if (!base.pode) return { ...base, dias: [], melhor: '' };
  const plan = planoAtivo(st);
  const sem = semanaEfetiva(plan, st.perdidos, segundaDe(hoje));
  const bloq = new Set(diasBloqueados(st));
  const saude = diasDeSaude(st, hoje, 'musc');
  const sessoes = (Array.isArray(st.sessions) ? st.sessions : []).filter((s) => s && typeof s.inicio === 'string');
  const nomeDe = (id) => (plan.dias.find((x) => x.id === id) || {}).nome || '';
  const dias = [];
  for (const d of sem) {
    if (d.data < hoje || d.data <= data) continue;
    const ocupadoPor = d.diaId ? nomeDe(d.diaId) : '';
    const nao = (motivo) => dias.push({ data: d.data, pode: false, motivo, movs: [], titulo: '', texto: '', ocupadoPor });
    if (bloq.has(d.wd)) { nao('bloqueado'); continue; }
    if (feriadosDe(st).has(d.data)) { nao('feriado'); continue; }
    if (saude.has(d.data)) { nao('saude'); continue; }
    if (sessoes.some((s) => diaLocal(s.inicio) === d.data)) { nao('treinou'); continue; }
    if (d.perdido) { nao('marcado'); continue; }
    const p = propor(st, data, hoje, { ...opc, para: d.data });
    if (p.movs.length) dias.push({ data: d.data, pode: true, motivo: '', movs: p.movs, titulo: p.titulo, texto: p.texto, ocupadoPor });
    else nao(p.motivo === 'sem_dia' || p.motivo === 'livre' ? 'sem_descanso' : p.motivo);
  }
  return { ...base, dias, melhor: base.movs.length ? base.movs[0].para : '' };
}
const capi = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
// Por que o treino perdido não vai para um dia (uma frase curta, para a folha e o chat). `o` = um item de opcoesDeDia().dias.
export function porQueNaoDia(o, hoje, alternado = false) {
  const q = capi(nomeDoDia(o.data, hoje));
  switch (o.motivo) {
    case 'bloqueado': return `${q} não é um dos seus dias de musculação.`;
    case 'feriado': return `${q} é feriado: a academia não abre.`;
    case 'saude': return `${q}, o problema de saúde que você contou ainda muda o treino.`;
    case 'treinou': return `${q} já tem treino feito.`;
    case 'marcado': return `${q} também está marcado como não treinado.`;
    case 'corrida': return `${q}, o treino de pernas ficaria perto da corrida forte ou do longão.`;
    case 'sem_folga': return `${q}, a semana ficaria sem nenhum dia de descanso.`;
    default:
      if (alternado) return `${q} não dá: para você, a musculação fica em dias não seguidos.`;
      return o.ocupadoPor ? `${q} já tem o ${o.ocupadoPor}. O app não junta dois treinos, e trocar a ordem deixaria os mesmos músculos sem 48 horas de descanso.`
        : `${q}, os mesmos músculos ficariam sem 48 horas de descanso.`;
  }
}
// O estado como fica com mais uma marca (para mostrar a semana antes de confirmar). Não muda `st`.
export const comMarca = (st, m) => (m ? { ...st, perdidos: limparPerdidos([...(Array.isArray(st.perdidos) ? st.perdidos : []), m]) } : st);
// A semana em uma linha, de hoje a domingo: "amanhã Treino A · sexta Treino B" (tipo 'musc') ou as corridas ('corrida').
export function linhaDaSemana(st, hoje, tipo = 'musc') {
  let sem = [];
  try { sem = semanaDoChat(st, hoje, hoje); } catch { sem = []; }
  const partes = [];
  for (const d of sem) {
    if (d.data < hoje) continue;
    const q = nomeDoDia(d.data, hoje);
    if (tipo === 'corrida') { const c = d.corrida; if (c && !c.movidaPara && !c.perdida) partes.push(`${q} ${c.nome}${c.feita ? ' (feita)' : ''}`); }
    else if (d.nome) partes.push(`${q} ${d.nome}${d.feito ? ' (feito)' : ''}`);
  }
  return partes.join(' · ');
}
// Cansaço como motivo nas marcas dos últimos 14 dias (musculação e corrida): { n, semana (nos últimos 7 dias),
// maisDeUmaSemana (entre a primeira e a última, 7 dias ou mais) }. A regra que vale para o último caso está no começo.
export function cansacoRecente(st, hoje) {
  if (!diaOk(hoje)) return { n: 0, semana: 0, maisDeUmaSemana: false };
  const ini = somaDias(hoje, -14), ini7 = somaDias(hoje, -7);
  const datas = [...new Set((Array.isArray(st && st.perdidos) ? st.perdidos : []).filter((e) => e && e.motivo === 'cansaco' && diaOk(e.data) && e.data <= hoje && e.data > ini).map((e) => e.data))].sort();
  const span = datas.length >= 2 ? Math.round((Date.parse(datas[datas.length - 1] + 'T12:00:00Z') - Date.parse(datas[0] + 'T12:00:00Z')) / DIA_MS) : 0;
  return { n: datas.length, semana: datas.filter((d) => d > ini7).length, maisDeUmaSemana: span >= 7 };
}

// ---------- corrida ----------
// Pode marcar "Não corri" em `data`? Há corrida prevista, não há corrida registrada nem marca, é hoje ou já passou, nesta semana.
export function podeMarcarCorrida(st, data, hoje) {
  if (!st || !diaOk(data) || !diaOk(hoje) || data > hoje || segundaDe(data) !== segundaDe(hoje)) return false;
  if ((Array.isArray(st.runs) ? st.runs : []).some((r) => r && r.data === data)) return false;
  if ((Array.isArray(st.perdidos) ? st.perdidos : []).some((e) => e && e.tipo === 'corrida' && e.data === data)) return false;
  try {
    const s = planoDaSemanaEm(st, hoje, segundaDe(data));
    const d = s && Array.isArray(s.dias) && !s.foraDoPlano ? s.dias[diaDaSemana(data)] : null;
    return !!d && d.tipo !== 'descanso';
  } catch { return false; }
}
export const marcaCorrida = (data, em, motivo = '') => limparPerdido({ tipo: 'corrida', data, em, motivo });
export const corridaPerdidaEm = (st, data) => (Array.isArray(st && st.perdidos) ? st.perdidos.find((e) => e && e.tipo === 'corrida' && e.data === data) || null : null);

// ---------- desfazer ----------
// Tira a marca e, na musculação, as marcas feitas DEPOIS dela na mesma semana e no mesmo plano (elas partiram da semana
// já mudada por esta). Devolve { lista, removidas }.
export function desfazer(perdidos, alvo) {
  const lista = Array.isArray(perdidos) ? perdidos.slice() : [];
  // marca de um treino a mais planejado: saem todas as marcas dele
  if (alvo && alvo.extra) { const fica = lista.filter((e) => !(e && e.extra === alvo.extra)); return { lista: fica, removidas: lista.length - fica.length }; }
  const i = lista.findIndex((e) => e && alvo && e.tipo === alvo.tipo && e.data === alvo.data && (e.planId || '') === (alvo.planId || ''));
  if (i < 0) return { lista, removidas: 0 };
  if (alvo.tipo === 'corrida') { lista.splice(i, 1); return { lista, removidas: 1 }; }
  const seg = segundaDe(alvo.data);
  const depois = (e) => e.tipo === 'musculacao' && e.planId === alvo.planId && segundaDe(e.data) === seg && ((e.em || '') > (alvo.em || '') || ((e.em || '') === (alvo.em || '') && e.data > alvo.data));
  const fica = lista.filter((e, j) => j !== i && !depois(e));
  return { lista: fica, removidas: lista.length - fica.length };
}
// quantas marcas sairiam junto (para avisar antes de desfazer)
export const quantasSaem = (perdidos, alvo) => desfazer(perdidos, alvo).removidas;

// ---------- mudar de dia pelo chat: o treino de amanhã hoje, e a corrida em outro dia ----------
// As mesmas regras de cima, para uma mudança só (nenhuma regra nova): 48 horas entre treinos pesados do mesmo músculo
// (ref garber2011); força em dias não seguidos para menores de 18 e diabetes (refs valovichmcleod2011, colberg2016);
// com prioridade na corrida ou nos dois por igual, pernas a 24 horas ou mais da corrida forte e do longo, 48 horas para
// quem é novo na musculação (refs blagrove2018, doma2017); pelo menos um dia sem treino na semana, dois para menores de
// 18 (ref meeusen2013); dias em que a pessoa não treina ficam livres (logic/dias-livres.js). Na corrida, as regras do
// plano (logic/corrida.js): treino forte e longão nunca em dias seguidos (refs seiler2009, casado2022), uma corrida por
// dia — juntar duas faz uma corrida maior, e mais de 10% acima da mais longa dos últimos 30 dias aumenta o risco de
// lesão (ref frandsen2025).
const ehChave = (d) => !!d && ((d.tipo === 'longo' && !d.comoRodagem) || d.forte === true || d.intensidade === 'forte');
// A semana de `data` como o chat a mostra: os 7 dias com a musculação (semanaEfetiva) e a corrida do plano de cada um.
// [{ data, wd, diaId, nome, feito, perdido, veioDe, foiPara, corrida: { nome, chave, feita, perdida, movidaDe, movidaPara } | null, extra }]
export function semanaDoChat(st, data, hoje) {
  if (!diaOk(data) || !diaOk(hoje)) return [];
  const seg = segundaDe(data);
  const plan = planoAtivo(st);
  const sem = plan ? semanaEfetiva(plan, st.perdidos, seg) : Array.from({ length: 7 }, (_, i) => ({ data: somaDias(seg, i), wd: diaDaSemana(somaDias(seg, i)), diaId: '', veioDe: '', foiPara: '', perdido: null, corridaPerdida: null }));
  let semC = null;
  try { semC = planoDaSemanaEm(st, hoje, seg); } catch { semC = null; }
  const sessoes = (Array.isArray(st.sessions) ? st.sessions : []).filter((s) => s && typeof s.inicio === 'string');
  const runs = Array.isArray(st.runs) ? st.runs : [];
  return sem.map((d) => {
    const dia = plan && d.diaId ? plan.dias.find((x) => x.id === d.diaId) : null;
    const perdidoDia = plan && d.perdido ? plan.dias.find((x) => x.id === d.perdido.diaId) : null;
    const c = semC && Array.isArray(semC.dias) && !semC.foraDoPlano ? semC.dias[d.wd] : null;
    const marca = corridaPerdidaEm(st, d.data);
    // o dia de origem de uma corrida que mudou de dia fica sem corrida no plano (logic/corrida.js, `movidas`)
    const mv = semC && Array.isArray(semC.movidas) && !semC.foraDoPlano ? semC.movidas[d.wd] : null;
    const corrida = c && c.tipo !== 'descanso' ? {
      nome: String(c.nome || 'Corrida'), chave: ehChave(c), feita: !!c.feito || runs.some((r) => r && r.data === d.data),
      perdida: !!marca && !marca.para, movidaPara: marca && marca.para ? marca.para : '', movidaDe: c.movidaDe || '', motivo: (marca && marca.motivo) || '',
    } : mv ? { nome: String(mv.nome || 'Corrida'), chave: false, feita: false, perdida: false, movidaPara: mv.para, movidaDe: '', motivo: (marca && marca.motivo) || '' } : null;
    return {
      data: d.data, wd: d.wd, diaId: d.diaId, nome: dia ? dia.nome : '', feito: sessoes.some((s) => diaLocal(s.inicio) === d.data),
      perdido: perdidoDia ? { nome: perdidoDia.nome, para: d.perdido.para, motivo: d.perdido.entrada.motivo || '' } : null, veioDe: d.veioDe, foiPara: d.foiPara, corrida,
      // o nome do treino que saiu deste dia (está agora em foiPara)
      saiu: plan && d.foiPara ? ((plan.dias.find((x) => x.id === (sem.find((y) => y.data === d.foiPara) || {}).diaId) || {}).nome || '') : '',
      extra: !corrida && runs.some((r) => r && r.data === d.data),
    };
  });
}
// cargas de -1 (domingo anterior) a 7 (segunda seguinte) da semana efetiva: o que foi feito vale mais que o previsto
function cargasDaSemana(st, plan, sem, seg) {
  const diaPorId = new Map(plan.dias.map((d) => [d.id, d]));
  const sessoes = (Array.isArray(st.sessions) ? st.sessions : []).filter((s) => s && typeof s.inicio === 'string');
  const feitasEm = (k) => sessoes.filter((s) => diaLocal(s.inicio) === k).map(cargaDaSessao);
  const carga = new Array(9).fill(null);
  carga[0] = juntar(feitasEm(somaDias(seg, -1)));
  for (let k = 0; k < 7; k++) {
    const f = feitasEm(sem[k].data);
    carga[k + 1] = f.length ? juntar(f) : sem[k].diaId && diaPorId.has(sem[k].diaId) ? cargaDoTreino(diaPorId.get(sem[k].diaId)) : null;
  }
  const prox = somaDias(seg, 7), id = plan.agenda[diaDaSemana(prox)], f7 = feitasEm(prox);
  carga[8] = f7.length ? juntar(f7) : diaPorId.has(id) ? cargaDoTreino(diaPorId.get(id)) : null;
  return carga;
}
// Pode fazer em `para` (hoje ou depois, sem musculação) o treino que está em `de` (mais adiante, nesta semana)?
// { pode, motivo: '' | 'sem_plano' | 'outra_semana' | 'passou' | 'sem_treino' | 'feito' | 'treinou' | 'ocupado' |
//   'bloqueado' | 'saude' | 'sem_descanso' | 'corrida', diaId, nome }
export function avaliarTroca(st, de, para, hoje) {
  const plan = planoAtivo(st);
  const nao = (motivo, extra = {}) => ({ pode: false, motivo, diaId: '', nome: '', ...extra });
  if (!plan || !diaOk(de) || !diaOk(para) || !diaOk(hoje)) return nao('sem_plano');
  const seg = segundaDe(hoje);
  if (segundaDe(de) !== seg || segundaDe(para) !== seg) return nao('outra_semana');
  if (para < hoje || de <= hoje || de === para || para > de) return nao('passou');
  const sem = semanaEfetiva(plan, st.perdidos, seg);
  const iDe = sem.findIndex((d) => d.data === de), iPara = sem.findIndex((d) => d.data === para);
  const dDe = sem[iDe], dia = dDe.diaId ? plan.dias.find((x) => x.id === dDe.diaId) : null;
  if (!dia || dDe.perdido) return nao('sem_treino');
  const base = { diaId: dia.id, nome: dia.nome };
  const sessoes = (Array.isArray(st.sessions) ? st.sessions : []).filter((s) => s && typeof s.inicio === 'string');
  if (sessoes.some((s) => diaLocal(s.inicio) === de)) return nao('feito', base);
  if (sessoes.some((s) => diaLocal(s.inicio) === para) || (st.current && para === hoje)) return nao('treinou', base);
  if (sem[iPara].diaId || sem[iPara].perdido) return nao('ocupado', { ...base, ocupadoPor: (plan.dias.find((x) => x.id === sem[iPara].diaId) || {}).nome || '' });
  if (new Set(diasBloqueados(st)).has(sem[iPara].wd)) return nao('bloqueado', base);
  if (diasDeSaude(st, hoje, 'musc').has(para)) return nao('saude', base);
  const carga = cargasDaSemana(st, plan, sem, seg);
  const cx = cargaDoTreino(dia);
  const depois = carga.slice(); depois[iDe + 1] = null; depois[iPara + 1] = cx;
  const pf = perfilDe(st, hoje);
  const alternado = !!(pf.jovem || pf.diabetes);
  for (const k of [iPara, iPara + 1]) { const a = depois[k], b = depois[k + 1]; if (a && b && (choca(a, b) || alternado)) return nao('sem_descanso', base); }
  const { corre, chave } = corridaDaSemana(st, hoje, seg);
  const combo = (() => { try { return comboAtual(st); } catch { return { foco: '' }; } })();
  if ((combo.foco === 'corrida' || combo.foco === 'equilibrio') && cx.pernas && (chave[iPara] || chave[iPara + 1] || (pf.nivel === 1 && chave[iPara + 2]))) return nao('corrida', base);
  const livres = (cs) => { let n = 0; for (let k = 0; k < 7; k++) if (!cs[k + 1] && !corre[k]) n++; return n; };
  if (livres(depois) < Math.min(pf.jovem ? 2 : 1, livres(carga))) return nao('sem_descanso', base);
  return { pode: true, motivo: '', ...base };
}
export function marcaTroca(st, de, para, hoje, em) {
  const a = avaliarTroca(st, de, para, hoje);
  if (!a.pode) return null;
  return limparPerdido({ tipo: 'troca', data: para, de, planId: planoAtivo(st).id, diaId: a.diaId, em });
}
// Um treino do plano A MAIS num dia desta semana que ainda vai chegar e está sem musculação (logic/treino-extra.js). As
// regras são as de sempre: 48 horas entre os mesmos músculos (ref garber2011), um dia sem treino na semana (ref
// meeusen2013), menores de 18 e diabetes em dias não seguidos (refs colberg2016, valovichmcleod2011), pernas longe da
// corrida forte e do longo (refs blagrove2018, doma2017). { pode, motivo, nome, bloqueado, amanha } — amanha: a data do
// treino do dia seguinte, que pega os mesmos músculos e precisa mudar de dia ('' se nenhum). motivo: 'sem_plano' |
// 'outra_semana' | 'sem_treino' | 'ocupado' | 'feriado' | 'saude' | 'sem_descanso' | 'corrida' | 'sem_folga'.
export function avaliarExtraMusc(st, data, diaId, hoje, idExtra = 'x') {
  const plan = planoAtivo(st);
  const nao = (motivo, extra = {}) => ({ pode: false, motivo, nome: '', bloqueado: false, amanha: '', ...extra });
  if (!plan || !diaOk(data) || !diaOk(hoje)) return nao('sem_plano');
  const seg = segundaDe(hoje);
  if (segundaDe(data) !== seg || data <= hoje) return nao('outra_semana');
  const dia = plan.dias.find((d) => d.id === diaId);
  if (!dia) return nao('sem_treino');
  const base = { nome: dia.nome };
  const sem = semanaEfetiva(plan, st.perdidos, seg);
  const i = sem.findIndex((d) => d.data === data);
  if (sem[i].diaId || sem[i].perdido) return nao('ocupado', { ...base, ocupadoPor: (plan.dias.find((x) => x.id === (sem[i].diaId || (sem[i].perdido || {}).diaId)) || {}).nome || '' });
  if (feriadosDe(st).has(data)) return nao('feriado', base);
  if (diasDeSaude(st, hoje, 'musc').has(data)) return nao('saude', base);
  const marca = limparPerdido({ tipo: 'extra', data, planId: plan.id, diaId, em: '', extra: idExtra });
  const st2 = comMarca(st, marca);
  const sem2 = semanaEfetiva(plan, st2.perdidos, seg);
  const antes = cargasDaSemana(st, plan, sem, seg), carga = cargasDaSemana(st2, plan, sem2, seg);
  const pf = perfilDe(st, hoje);
  const alternado = !!(pf.jovem || pf.diabetes);
  const cx = cargaDoTreino(dia);
  const bate = (a, b) => !!(a && b && (choca(a, b) || alternado));
  // carga[k + 1] = dia k da semana (0 = segunda); carga[0] = domingo anterior, carga[8] = segunda seguinte
  if (bate(carga[i], cx)) return nao('sem_descanso', base);
  let amanha = '';
  if (bate(cx, carga[i + 2])) {
    const d1 = sem2[i + 1];
    const feito = d1 && (Array.isArray(st.sessions) ? st.sessions : []).some((x) => x && diaLocal(x.inicio) === d1.data);
    if (!d1 || !d1.diaId || d1.perdido || d1.extra || feito) return nao('sem_descanso', base);
    amanha = d1.data;
  }
  const { corre, chave } = corridaDaSemana(st, hoje, seg);
  const combo = (() => { try { return comboAtual(st); } catch { return { foco: '' }; } })();
  if ((combo.foco === 'corrida' || combo.foco === 'equilibrio') && cx.pernas && (chave[i] || chave[i + 1] || (pf.nivel === 1 && chave[i + 2]))) return nao('corrida', base);
  const livres = (cs) => { let n = 0; for (let k = 0; k < 7; k++) if (!cs[k + 1] && !corre[k]) n++; return n; };
  if (livres(carga) < Math.min(pf.jovem ? 2 : 1, livres(antes))) return nao('sem_folga', base);
  return { pode: true, motivo: '', ...base, bloqueado: new Set(diasBloqueados(st)).has(sem[i].wd), amanha };
}
// A corrida que mudou PARA `data` (a marca da corrida de origem), ou null
export const corridaMovidaPara = (st, data) => (Array.isArray(st && st.perdidos) ? st.perdidos.find((e) => e && e.tipo === 'corrida' && e.para === data) || null : null);
// Pode passar a corrida de `de` para `para` (hoje ou depois, nesta semana)? { pode, motivo, nome, chave } — motivo:
// 'sem_plano' | 'outra_semana' | 'passou' | 'sem_corrida' | 'feita' | 'ocupado' | 'dor' | 'bloqueado' | 'saude' |
// 'forte_seguido' | 'pernas' | 'sem_descanso'. 'saude': um problema de saúde fora do treino muda a corrida nesse dia.
export function avaliarMoverCorrida(st, de, para, hoje) {
  const nao = (motivo, extra = {}) => ({ pode: false, motivo, nome: '', chave: false, ...extra });
  if (!st || !diaOk(de) || !diaOk(para) || !diaOk(hoje)) return nao('sem_plano');
  const seg = segundaDe(hoje);
  if (segundaDe(de) !== seg || segundaDe(para) !== seg) return nao('outra_semana');
  if (para < hoje || de === para) return nao('passou');
  let s = null;
  try { s = planoDaSemanaEm(st, hoje, seg); } catch { s = null; }
  if (!s || !Array.isArray(s.dias) || s.foraDoPlano || s.concluido || s.antesDoInicio) return nao('sem_plano');
  const d = s.dias[diaDaSemana(de)];
  if (!d || d.tipo === 'descanso' || d.movidaDe) return nao('sem_corrida');
  const base = { nome: String(d.nome || 'Corrida'), chave: ehChave(d) };
  const runs = Array.isArray(st.runs) ? st.runs : [];
  if (runs.some((r) => r && r.data === de) || corridaPerdidaEm(st, de)) return nao('feita', base);
  const alvo = s.dias[diaDaSemana(para)];
  if (alvo && alvo.tipo === 'descanso') return nao('dor', base);
  if ((alvo && !alvo.movidaPara) || corridaMovidaPara(st, para) || runs.some((r) => r && r.data === para)) return nao('ocupado', base);
  // (a corrida não segue os dias da musculação: só os dias sem treino das respostas antigas — logic/dias-livres.js)
  if (new Set(diasSemCorrida(st)).has(diaDaSemana(para))) return nao('bloqueado', base);
  if (diasDeSaude(st, hoje, 'corrida').has(para)) return nao('saude', base);
  // a semana com a corrida no dia novo
  const datas = Array.from({ length: 7 }, (_, k) => somaDias(seg, k));
  const doPlano = (k) => { const x = s.dias[diaDaSemana(k)]; return x && x.tipo !== 'descanso' && !x.movidaPara ? x : null; };
  const corre = datas.map((k) => (k === de ? false : k === para ? true : !!doPlano(k)));
  const chave = datas.map((k) => (k === de ? false : k === para ? base.chave : ehChave(doPlano(k))));
  const iP = datas.indexOf(para);
  if (base.chave && ((iP > 0 && chave[iP - 1]) || (iP < 6 && chave[iP + 1]))) return nao('forte_seguido', base);
  const plan = planoAtivo(st);
  const pf = perfilDe(st, hoje);
  const carga = plan ? cargasDaSemana(st, plan, semanaEfetiva(plan, st.perdidos, seg), seg) : new Array(9).fill(null);
  const combo = (() => { try { return comboAtual(st); } catch { return { foco: '' }; } })();
  if (base.chave && (combo.foco === 'corrida' || combo.foco === 'equilibrio')) {
    const pernas = (k) => k >= -1 && !!(carga[k + 1] && carga[k + 1].pernas);
    if (pernas(iP) || pernas(iP - 1) || (pf.nivel === 1 && pernas(iP - 2))) return nao('pernas', base);
  }
  const livres = (cor) => { let n = 0; for (let k = 0; k < 7; k++) if (!carga[k + 1] && !cor[k]) n++; return n; };
  const corAntes = datas.map((k) => !!doPlano(k));
  if (livres(corre) < Math.min(pf.jovem ? 2 : 1, livres(corAntes))) return nao('sem_descanso', base);
  return { pode: true, motivo: '', ...base };
}
export function marcaMoverCorrida(st, de, para, hoje, em, motivo = '') {
  if (!avaliarMoverCorrida(st, de, para, hoje).pode) return null;
  return limparPerdido({ tipo: 'corrida', data: de, para, em, motivo });
}
// Para que dias desta semana a corrida de `de` pode ir (de hoje a domingo, menos o próprio dia), com as regras de
// avaliarMoverCorrida: [{ data, pode, motivo, nome, chave }]
export function opcoesCorrida(st, de, hoje) {
  if (!diaOk(de) || !diaOk(hoje)) return [];
  const out = [];
  for (let k = 0; k < 7; k++) {
    const x = somaDias(segundaDe(hoje), k);
    if (x < hoje || x === de) continue;
    let a;
    try { a = avaliarMoverCorrida(st, de, x, hoje); } catch { a = { pode: false, motivo: 'sem_plano', nome: '', chave: false }; }
    out.push({ data: x, ...a });
  }
  return out;
}
// Por que a corrida não vai para um dia (frase curta, para a folha)
export function porQueNaoCorrida(o, hoje) {
  const q = capi(nomeDoDia(o.data, hoje));
  return {
    ocupado: `${q} já tem corrida. O app não junta duas: uma corrida bem maior que a mais longa do mês aumenta o risco de lesão.`,
    dor: `${q} está sem corrida por causa da dor que você contou.`,
    bloqueado: `${q} é um dia em que você não treina.`,
    saude: `${q}, o problema de saúde que você contou ainda muda a corrida.`,
    forte_seguido: `${q}, este treino forte (ou o longão) ficaria colado em outro treino forte.`,
    pernas: `${q}, esta corrida ficaria perto do treino pesado de pernas.`,
    sem_descanso: `${q}, a semana ficaria sem nenhum dia de descanso.`,
  }[o.motivo] || `${q} não dá para esta corrida.`;
}

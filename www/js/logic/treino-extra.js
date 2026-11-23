// Treino a mais num dia desta semana que ainda vai chegar (ou o esporte registrado hoje): outro esporte (futebol, beach tennis...), um treino de
// musculação do plano ou uma corrida. Puro: sem DOM. O treinador olha a semana e ajusta o resto com as regras de sempre
// (logic/perdido.js). O que fica guardado:
//  • esporte e corrida a mais: state.planejados [{ id, data, tipo: 'esporte' | 'corrida', esporte?, min, em }] (validados
//    por limparPlanejados, aqui, no sanitize de store.js). O gasto do esporte só entra no dia quando a pessoa confirma
//    que fez (vira uma atividade — logic/esportes.js).
//  • musculação a mais: uma marca 'extra' em state.perdidos (o dia passa a ter o treino) — ou, se o treino ainda estava
//    para acontecer nesta semana, ele muda de dia ('troca' ou 'pedido'). Toda marca feita por um treino a mais guarda o
//    id dele (`extra`) e sai junto quando ele é apagado.
//
// Regras (as fontes estão nos comentários de logic/perdido.js e de cada regra):
//  • Esporte vigoroso para as pernas (6 METs ou mais no Compendium — o corte de "vigoroso" do ACSM, ref garber2011 —, fora
//    os da água e a escalada, que pedem mais dos braços), por 30 minutos ou mais: o treino de pernas que cai no mesmo dia
//    ou no dia seguinte muda de dia (e, se dá, também sai da véspera), e a corrida forte ou o longo também. Depois de um jogo
//    de futebol, o sprint volta em cerca de 48 horas e o salto e a força da parte de trás da coxa seguem abaixo com 72 horas
//    (ref silva2018, texto completo: "48 h are enough [...] for both linear and non-linear sprint performance"; "jumping
//    abilities still impaired at ≥72 h"); nos esportes coletivos, o salto pediu pelo menos 48 horas (ref doeven2018); depois
//    de um jogo reduzido de 45 minutos, "a high training load should be avoided earlier than 24 h" (ref bekris2022). O treino
//    de pernas pesado deixa a corrida pior por até 48 horas em quem não está acostumado (ref doma2017). Esses estudos são com
//    atletas: levar a regra para o jogo de lazer, para o tênis, as lutas e as aulas de HIIT é uma inferência do app. Sem dia
//    que dê, a semana segue e o app avisa para ir mais leve.
//  • Um dia sem treino na semana (ref meeusen2013): o app avisa quando o esporte ocupa o último.
//  • Corrida a mais: primeiro, o app tenta passar para o dia uma corrida da semana que ainda falta (avaliarMoverCorrida);
//    senão, uma corrida leve e curta, do tamanho da rodagem mais curta da semana, nunca maior que a mais longa do mês
//    (ref frandsen2025), e bem leve se fica colada num treino forte ou no longo (refs seiler2009, buchheit2014).
import { ESPORTE_POR_ID } from '../data/esportes.js';
import {
  planoAtivo, semanaEfetiva, segundaDe, somaDias, diaOk, nomeDoDia, diaLocal, cargaDoTreino, propor, limparPerdido,
  limparPerdidos, comMarca, avaliarTroca, marcaTroca, avaliarExtraMusc, avaliarMoverCorrida, feriadosDe, diaDaSemana,
} from './perdido.js';
import { planoDaSemanaEm } from './corrida.js';
import { MIN_MAX } from './esportes.js';

export const MAX_PLANEJADOS = 60;
export const REFS_EXTRA = ['silva2018', 'doeven2018', 'bekris2022', 'doma2017', 'garber2011', 'meeusen2013', 'frandsen2025'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v);
const capi = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

export function limparPlanejados(raw) {
  const out = [], ids = new Set();
  for (const p of Array.isArray(raw) ? raw.slice(-MAX_PLANEJADOS * 2) : []) {
    if (!isObj(p) || !idOk(p.id) || ids.has(p.id) || !diaOk(p.data) || !['esporte', 'corrida'].includes(p.tipo)) continue;
    const min = Math.round(Number(p.min));
    if (!Number.isFinite(min) || min < 5 || min > MIN_MAX) continue;
    if (p.tipo === 'esporte' && !ESPORTE_POR_ID.has(p.esporte)) continue;
    ids.add(p.id);
    const em = typeof p.em === 'string' && !Number.isNaN(Date.parse(p.em)) ? p.em : '';
    out.push(p.tipo === 'esporte' ? { id: p.id, data: p.data, tipo: 'esporte', esporte: p.esporte, min, em } : { id: p.id, data: p.data, tipo: 'corrida', min, em });
  }
  return out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)).slice(-MAX_PLANEJADOS);
}
export const planejadosDoDia = (st, data) => (isObj(st) && Array.isArray(st.planejados) ? st.planejados.filter((p) => p && p.data === data) : []);

// esporte que pede muito das pernas: 6 METs ou mais, fora os da água e a escalada
export function esporteVigoroso(id) {
  const e = ESPORTE_POR_ID.get(id);
  return !!e && e.met >= 6 && e.grupo !== 'agua' && id !== 'escalada';
}

// a corrida do plano em cada dia desta semana (só as que ainda valem: sem as que mudaram de dia)
function corridasDaSemana(st, hoje) {
  let s = null;
  try { s = planoDaSemanaEm(st, hoje, segundaDe(hoje)); } catch { s = null; }
  if (!s || !Array.isArray(s.dias) || s.foraDoPlano || s.concluido || s.antesDoInicio) return null;
  return s;
}
const ehChave = (d) => !!d && ((d.tipo === 'longo' && !d.comoRodagem) || d.forte === true || d.intensidade === 'forte');

// ---------- esporte ----------
// O que o treinador recomenda mudar na semana com o esporte em `data`: { vigoroso, marcas, textos, avisos }. As marcas já
// levam o id (`extra`). Nada muda sozinho: a tela pergunta, e a pessoa pode manter os treinos como estão (só o esporte fica).
export function analisarEsporte(st, data, esporte, min, hoje, id, em = '') {
  const out = { vigoroso: false, marcas: [], textos: [], avisos: [] };
  const e = ESPORTE_POR_ID.get(esporte);
  if (!e || !diaOk(data) || !diaOk(hoje) || data < hoje) return out;
  const nomeE = e.nome.replace(/ \(.*\)$/, '').toLowerCase();
  out.vigoroso = esporteVigoroso(esporte) && min >= 30;
  const seg = segundaDe(hoje);
  const mesma = segundaDe(data) === seg;
  if (!out.vigoroso) {
    out.textos.push(`${capi(nomeE)} não pesa nas pernas como um treino forte: os outros treinos continuam nos dias deles.`);
    return out;
  }
  if (!mesma) { out.textos.push('O treinador só reorganiza a semana atual. Na semana do jogo, deixe o treino de pernas e a corrida forte longe dele.'); return out; }
  let atual = st;
  const evitar = [somaDias(data, -1), data, somaDias(data, 1)];
  const plan = planoAtivo(st);
  // 1. musculação com pernas no dia do esporte ou no seguinte
  if (plan) {
    for (const alvo of [data, somaDias(data, 1)]) {
      if (alvo < hoje || segundaDe(alvo) !== seg) continue;
      const sem = semanaEfetiva(plan, atual.perdidos, seg);
      const d = sem.find((x) => x.data === alvo);
      const dia = d && d.diaId && !d.perdido && !d.extra ? plan.dias.find((x) => x.id === d.diaId) : null;
      if (!dia || !cargaDoTreino(dia).pernas) continue;
      if ((Array.isArray(st.sessions) ? st.sessions : []).some((s) => s && diaLocal(s.inicio) === alvo)) continue;
      let p = propor(atual, alvo, hoje, { futuro: true, evitar });
      if (!(p.pode && p.movs.length)) p = propor(atual, alvo, hoje, { futuro: true, evitar: [data, somaDias(data, 1)] });
      if (p.pode && p.movs.length && !evitar.slice(1).includes(p.movs[0].para)) {
        const m = limparPerdido({ tipo: 'musculacao', data: alvo, planId: plan.id, diaId: dia.id, movs: p.movs, em, ajuste: 'esporte', extra: id });
        if (m) { out.marcas.push(m); atual = comMarca(atual, m); out.textos.push(`Recomendo passar o ${dia.nome}, que tem pernas, de ${nomeDoDia(alvo, hoje)} para ${nomeDoDia(p.movs[0].para, hoje)}: fica longe do ${nomeE}.`); continue; }
      }
      out.avisos.push(`O ${dia.nome} de ${nomeDoDia(alvo, hoje)} tem pernas e fica perto do ${nomeE}, e não há outro dia com descanso suficiente. Se as pernas estiverem cansadas, diminua as cargas das pernas nesse dia.`);
    }
  }
  // 2. corrida forte ou longo no dia do esporte ou no seguinte
  const sC = corridasDaSemana(atual, hoje);
  if (sC) {
    for (const alvo of [data, somaDias(data, 1)]) {
      if (alvo < hoje || segundaDe(alvo) !== seg) continue;
      if ((Array.isArray(atual.runs) ? atual.runs : []).some((r) => r && r.data === alvo)) continue; // já corrida
      const c = sC.dias[diaDaSemana(alvo)];
      if (!c || c.tipo === 'descanso' || c.movidaPara || !ehChave(c)) continue;
      let destino = '';
      for (let k = 0; k < 7 && !destino; k++) {
        const x = somaDias(seg, k);
        if (x <= hoje || evitar.includes(x)) continue;
        let a; try { a = avaliarMoverCorrida(atual, alvo, x, hoje); } catch { a = { pode: false }; }
        if (a.pode) destino = x;
      }
      const m = destino ? limparPerdido({ tipo: 'corrida', data: alvo, para: destino, em, extra: id }) : null;
      if (m) { out.marcas.push(m); atual = comMarca(atual, m); out.textos.push(`Recomendo passar ${String(c.nome || 'a corrida').toLowerCase()} de ${nomeDoDia(alvo, hoje)} para ${nomeDoDia(destino, hoje)}: perto do ${nomeE}, a corrida forte rende menos e cansa mais.`); }
      else out.avisos.push(`${capi(String(c.nome || 'A corrida'))} de ${nomeDoDia(alvo, hoje)} fica perto do ${nomeE}, e não há outro dia que dê. Nesse dia, faça a corrida leve, em ritmo de conversa.`);
    }
  }
  // 3. a semana ainda tem um dia sem treino?
  const ocupado = new Set();
  const semF = plan ? semanaEfetiva(plan, atual.perdidos, seg) : [];
  for (const d of semF) if (d.diaId) ocupado.add(d.data);
  const sC2 = corridasDaSemana(atual, hoje);
  for (let k = 0; k < 7; k++) {
    const x = somaDias(seg, k);
    const c = sC2 ? sC2.dias[diaDaSemana(x)] : null;
    if (c && c.tipo !== 'descanso' && !c.movidaPara) ocupado.add(x);
    if ((Array.isArray(atual.runs) ? atual.runs : []).some((r) => r && r.data === x)) ocupado.add(x);
    if ((Array.isArray(atual.atividades) ? atual.atividades : []).some((a) => a && a.data === x)) ocupado.add(x);
    if (planejadosDoDia(atual, x).length) ocupado.add(x);
  }
  ocupado.add(data);
  if (ocupado.size >= 7) out.avisos.push('Com o esporte, a semana fica sem nenhum dia de descanso. Um dia por semana sem treino ajuda o corpo a se recuperar.');
  if (!out.textos.length && !out.avisos.length) out.textos.push(`Nenhum treino de pernas nem corrida forte fica perto do ${nomeE}: a semana segue como está.`);
  return out;
}

// ---------- musculação ----------
// { pode, acao: 'troca' | 'pedido' | 'extra', motivo, texto, marcas, textos }
const POR_QUE = {
  ocupado: (q, o) => `${q} já tem o ${o.ocupadoPor || 'treino dele'}. O app não junta dois treinos no mesmo dia: para mudar a ordem, use “Trocar os dias dos treinos”.`,
  feriado: (q) => `${q} está marcado como feriado.`,
  saude: (q) => `${q}, o problema de saúde que você contou ainda muda o treino.`,
  sem_descanso: (q, o) => `${q}, o ${o.nome} ficaria colado num treino com os mesmos músculos, sem as 48 horas de descanso.`,
  corrida: (q, o) => `${q}, o ${o.nome} tem pernas e ficaria perto da corrida forte ou do longo.`,
  sem_folga: () => 'A semana ficaria sem nenhum dia de descanso.',
  bloqueado: (q) => `${q} é um dia em que você não pode fazer musculação.`,
  treinou: (q) => `${q} já tem um treino feito.`,
  passou: () => 'Esse dia já passou.',
  outra_semana: () => 'O treinador só reorganiza a semana atual.',
};
export function analisarMusculacao(st, data, diaId, hoje, id, em = '') {
  const plan = planoAtivo(st);
  const nao = (motivo, o = {}) => ({ pode: false, acao: '', motivo, texto: (POR_QUE[motivo] || (() => 'Não dá para este dia.'))(capi(nomeDoDia(data, hoje)), o), marcas: [], textos: [] });
  if (!plan || !diaOk(data) || !diaOk(hoje)) return nao('sem_plano');
  const seg = segundaDe(hoje);
  if (segundaDe(data) !== seg || data <= hoje) return nao('outra_semana');
  const dia = plan.dias.find((d) => d.id === diaId);
  if (!dia) return nao('sem_plano');
  const sem = semanaEfetiva(plan, st.perdidos, seg);
  const feitoEm = (k) => (Array.isArray(st.sessions) ? st.sessions : []).some((s) => s && s.planId === plan.id && s.diaId === diaId && diaLocal(s.inicio) === k);
  // o treino ainda está para acontecer nesta semana (de hoje em diante)?
  const pend = sem.find((d) => d.data >= hoje && d.data !== data && d.diaId === diaId && !d.perdido && !feitoEm(d.data));
  if (pend && pend.data > data) {
    const a = avaliarTroca(st, pend.data, data, hoje);
    if (!a.pode) return nao(a.motivo, { ...a, nome: dia.nome });
    const m = marcaTroca(st, pend.data, data, hoje, em);
    const mm = m ? limparPerdido({ ...m, extra: id }) : null;
    return mm ? { pode: true, acao: 'troca', motivo: '', texto: '', marcas: [mm], textos: [`O ${dia.nome} passa de ${nomeDoDia(pend.data, hoje)} para ${nomeDoDia(data, hoje)}, e ${nomeDoDia(pend.data, hoje)} fica livre.`] } : nao('sem_descanso', { nome: dia.nome });
  }
  if (pend) {
    const p = propor(st, pend.data, hoje, { futuro: true, para: data });
    if (!(p.pode && p.movs.length && p.movs[0].para === data)) return nao(p.motivo === 'corrida' ? 'corrida' : p.motivo === 'sem_folga' ? 'sem_folga' : 'sem_descanso', { nome: dia.nome });
    const m = limparPerdido({ tipo: 'musculacao', data: pend.data, planId: plan.id, diaId, movs: p.movs, em, ajuste: 'pedido', extra: id });
    if (!m) return nao('sem_descanso', { nome: dia.nome });
    const outros = p.movs.slice(1).map((x) => `o ${(plan.dias.find((d) => d.id === x.diaId) || {}).nome || 'treino'} vai para ${nomeDoDia(x.para, hoje)}`);
    return { pode: true, acao: 'pedido', motivo: '', texto: '', marcas: [m], textos: [`O ${dia.nome} passa de ${nomeDoDia(pend.data, hoje)} para ${nomeDoDia(data, hoje)}${outros.length ? ', e ' + outros.join(', ') : ''}.`] };
  }
  // um treino a mais: o dia precisa respeitar o descanso dos mesmos músculos
  const a = avaliarExtraMusc(st, data, diaId, hoje, id);
  if (!a.pode) return nao(a.motivo, a);
  const marcas = [limparPerdido({ tipo: 'extra', data, planId: plan.id, diaId, em, extra: id })];
  const textos = [`${capi(nomeDoDia(data, hoje))} ganha o ${dia.nome}, a mais na semana.`];
  if (a.bloqueado) textos.push(`${capi(nomeDoDia(data, hoje))} era um dia sem treino na sua agenda: vale só para esta semana.`);
  if (a.amanha) {
    const st2 = comMarca(st, marcas[0]);
    const prox = semanaEfetiva(plan, st2.perdidos, seg).find((d) => d.data === a.amanha);
    const p = propor(st2, a.amanha, hoje, { futuro: true });
    const nomeP = (plan.dias.find((d) => d.id === (prox || {}).diaId) || {}).nome || 'treino';
    if (!(p.pode && p.movs.length)) return nao('sem_descanso', { nome: dia.nome });
    const m = limparPerdido({ tipo: 'musculacao', data: a.amanha, planId: plan.id, diaId: prox.diaId, movs: p.movs, em, ajuste: 'descanso', extra: id });
    if (!m) return nao('sem_descanso', { nome: dia.nome });
    marcas.push(m);
    textos.push(`O ${nomeP} de ${nomeDoDia(a.amanha, hoje)} passa para ${nomeDoDia(p.movs[0].para, hoje)}: os mesmos músculos precisam de 48 horas de descanso.`);
  }
  textos.push('Para ganhar músculo, o que conta é o volume da semana: um treino a mais soma, desde que o descanso venha junto.');
  return { pode: true, acao: 'extra', motivo: '', texto: '', marcas, textos };
}

// ---------- corrida ----------
// { pode, mover: { de, nome } | null, marcaMover, extraMin, textos, avisos }
export function analisarCorrida(st, data, hoje, id, em = '') {
  const out = { pode: false, mover: null, marcaMover: null, extraMin: 0, textos: [], avisos: [], motivo: '' };
  if (!diaOk(data) || !diaOk(hoje) || data <= hoje) { out.motivo = 'passou'; return out; }
  const seg = segundaDe(hoje);
  const mesma = segundaDe(data) === seg;
  const s = mesma ? corridasDaSemana(st, hoje) : null;
  const c = s ? s.dias[diaDaSemana(data)] : null;
  if (c && c.tipo !== 'descanso' && !c.movidaPara) { out.motivo = 'ocupado'; out.textos.push(`${capi(nomeDoDia(data, hoje))} já tem ${String(c.nome || 'corrida').toLowerCase()}.`); return out; }
  out.pode = true;
  // 1. uma corrida da semana que ainda falta pode vir para este dia?
  if (s) {
    const runs = Array.isArray(st.runs) ? st.runs : [];
    const cands = [];
    for (let k = 0; k < 7; k++) {
      const x = somaDias(seg, k);
      if (x < hoje || x === data || runs.some((r) => r && r.data === x)) continue;
      let a; try { a = avaliarMoverCorrida(st, x, data, hoje); } catch { a = { pode: false }; }
      if (a.pode) cands.push({ de: x, nome: a.nome, chave: a.chave, dist: Math.abs(k - (Date.parse(data) - Date.parse(seg)) / 86400000) });
    }
    cands.sort((a, b) => (a.chave === b.chave ? a.dist - b.dist : a.chave ? 1 : -1));
    if (cands.length) {
      out.mover = cands[0];
      out.marcaMover = limparPerdido({ tipo: 'corrida', data: cands[0].de, para: data, em, extra: id });
    }
  }
  // 2. ou uma corrida leve a mais: do tamanho da rodagem mais curta da semana (20 a 40 min)
  let curta = 0;
  if (s) for (const d of s.dias) if (d && (d.tipo === 'leve' || d.tipo === 'regenerativo') && d.durMin) curta = curta ? Math.min(curta, d.durMin) : d.durMin;
  out.extraMin = Math.max(20, Math.min(40, Math.round((curta || 30) / 5) * 5));
  if (s) {
    const perto = [somaDias(data, -1), somaDias(data, 1)].some((x) => segundaDe(x) === seg && ehChave(s.dias[diaDaSemana(x)]));
    if (perto) { out.extraMin = 20; out.avisos.push('Ela fica colada num treino forte ou no longo: bem leve, em ritmo de conversa fácil, para não somar cansaço.'); }
  }
  if (feriadosDe(st).has(data)) out.textos.push('Feriado: a academia fecha, mas a corrida na rua continua valendo.');
  out.textos.push(`Uma corrida a mais entra no volume da semana: o plano ajusta as próximas pelo que você registrar.`);
  return out;
}

// Grava um treino a mais (dentro de update). `marcas`: as do analisar*. `plano`: o item de state.planejados (ou null).
export function gravarExtra(s, plano, marcas) {
  if (plano) s.planejados = limparPlanejados([...(Array.isArray(s.planejados) ? s.planejados : []), plano]);
  if (marcas && marcas.length) s.perdidos = limparPerdidos([...(Array.isArray(s.perdidos) ? s.perdidos : []), ...marcas.filter(Boolean)]);
}
// Apaga um treino a mais e tudo o que ele mudou na semana (dentro de update)
export function apagarExtra(s, id) {
  s.planejados = (Array.isArray(s.planejados) ? s.planejados : []).filter((p) => p && p.id !== id);
  s.perdidos = (Array.isArray(s.perdidos) ? s.perdidos : []).filter((e) => !(e && e.extra === id));
}

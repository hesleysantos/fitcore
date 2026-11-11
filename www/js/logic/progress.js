// Cálculos de progresso: histórico por exercício, recordes, sugestão de carga e constância semanal.
import { state } from '../store.js';
import { EX_POR_ID } from '../data/exercises.js';
import { dateKey } from '../ui.js';
import { DIA, nivelPausa, cortePausa, duracaoTxt, maiorPausa } from './pausa.js';

const ASSISTIDOS = new Set(['barra-fixa-assistida-graviton', 'mergulho-assistido-graviton']);
export const assistido = (exId) => ASSISTIDOS.has(exId);

// 1RM estimado (Epley). Só é uma referência para comparar treinos; não é teste de carga máxima.
export const e1rm = (kg, reps) => (kg > 0 && reps > 0 ? kg * (1 + Math.min(reps, 15) / 30) : 0);
// número positivo e finito, ou 0 (cargas e repetições vazias, negativas ou inválidas contam como 0)
const pos = (n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
const lista = (x) => (Array.isArray(x) ? x : []);

// faixa de repetições "8-12" → [8, 12]; valor único "30" → [30, 30]; qualquer coisa inválida (vazio, zero) → [8, 12]
export function parseReps(s) {
  const m = /^(\d+)(?:-(\d+))?$/.exec(String(s == null ? '' : s).trim());
  if (!m) return [8, 12];
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  if (a < 1 || b < 1) return [8, 12];
  return [Math.min(a, b), Math.max(a, b)];
}

// séries concluídas de um exercício, da sessão mais recente para a mais antiga
export function historico(exId, limite = 60) {
  const out = [];
  for (let i = state.sessions.length - 1; i >= 0 && out.length < limite; i--) {
    const s = state.sessions[i];
    const sets = [];
    for (const it of lista(s && s.itens)) if (it && it.ex === exId) for (const x of lista(it.sets)) if (x && x.ok) sets.push(x);
    if (sets.length) out.push({ data: s.inicio, sets, sessao: s.id });
  }
  return out;
}
export const ultima = (exId) => historico(exId, 1)[0] || null;

export function recorde(exId) {
  const ex = EX_POR_ID.get(exId);
  let best = null;
  for (const hst of historico(exId, 500)) {
    for (const st of hst.sets) {
      const v = ex && ex.registro === 'peso_reps' ? e1rm(pos(st.kg), pos(st.reps)) : ex && (ex.registro === 'segundos' || ex.registro === 'minutos') ? pos(st.seg) : pos(st.reps);
      if (v > 0 && (!best || v > best.v)) best = { v, kg: st.kg, reps: st.reps, seg: st.seg, data: hst.data };
    }
  }
  return best;
}

function passo(kg) { return kg < 10 ? 0.5 : kg < 25 ? 1 : 2.5; }
function mais(kg) { const p = passo(kg); return Math.round((kg + Math.max(p, Math.round((kg * 0.05) / p) * p)) * 100) / 100; }
function menos(kg) { const p = passo(kg); return Math.max(0, Math.round((kg - Math.max(p, Math.round((kg * 0.075) / p) * p)) * 100) / 100); }
const kgTxt = (n) => String(n).replace('.', ',');

// Sugestão para o treino de hoje (dupla progressão; regra "2 por 2" do ACSM 2009 — ref acsm2009: a carga sobe depois
// de dois treinos seguidos no topo da faixa em todas as séries).
export function sugestao(exId, alvoReps, nSeries) {
  const ex = EX_POR_ID.get(exId);
  const [lo, hi] = parseReps(alvoReps);
  const minSeries = Math.min(pos(Number(nSeries)) || 2, 2);
  const faixa = lo === hi ? String(lo) : `${lo} a ${hi}`;   // alvo de um número só: "10", não "10 a 10"
  const h2 = historico(exId, 2);
  const last = h2[0];
  if (!ex) return { kg: null, reps: lo, texto: '' };
  if (ex.registro === 'segundos' || ex.registro === 'minutos') {
    const un = ex.registro === 'minutos' ? 'min' : 's';
    const best = last ? Math.max(...last.sets.map((s) => pos(s.seg))) : 0;
    if (!best) return { kg: null, reps: null, seg: lo, texto: `Primeira vez: faça ${lo} ${un}, em ritmo confortável.` };
    return { kg: null, reps: null, seg: best, texto: `Última vez: ${best} ${un}. Se foi tranquilo, aumente um pouco.` };
  }
  if (ex.registro === 'reps') {
    const reps = last ? last.sets.map((s) => pos(s.reps)) : [];
    if (!last || !Math.max(...reps)) return { kg: null, reps: lo, texto: `Primeira vez: faça ${lo === hi ? '' : 'de '}${faixa} repetições com boa técnica.` };
    const topo = reps.length >= minSeries && reps.every((r) => r >= hi);
    return { kg: pos(last.sets[0].kg) || null, reps: Math.max(...reps), texto: topo ? `Última vez: ${reps.join(', ')} repetições. Você atingiu o alvo: tente uma variação mais difícil ou adicione carga.` : `Última vez: ${reps.join(', ')} repetições. Tente fazer 1 a mais em cada série.` };
  }
  const primeira = { kg: null, reps: lo, texto: `Primeira vez: comece leve. Escolha uma carga com que você faça ${hi} repetições sobrando umas 3.` };
  if (!last || !last.sets.some((s) => pos(s.reps))) return primeira;
  const kg = Math.max(...last.sets.map((s) => pos(s.kg)));
  const comCarga = last.sets.filter((s) => pos(s.kg) >= kg);
  const resumo = last.sets.map((s) => `${kgTxt(pos(s.kg))} kg × ${pos(s.reps)}`).join(' · ');
  const noTopo = (hst) => !!hst && hst.sets.length >= minSeries && hst.sets.every((s) => pos(s.reps) >= hi && pos(s.kg) >= kg);
  const abaixo = (hst) => !!hst && hst.sets.length > 0 && pos(hst.sets[0].reps) < lo;
  const maisUma = Math.min(hi, Math.max(lo, pos(comCarga[0].reps) + 1));
  if (assistido(exId)) {
    if (noTopo(last) && kg > 0) return { kg: menos(kg), reps: lo, texto: `Última vez: ${resumo}. Você atingiu o alvo: reduza a ajuda da máquina para ${kgTxt(menos(kg))} kg.` };
    return { kg, reps: maisUma, texto: `Última vez: ${resumo}. Mantenha a ajuda e tente mais repetições.` };
  }
  if (noTopo(last) && noTopo(h2[1])) {
    const novo = mais(kg);
    return { kg: novo, reps: lo, texto: `Última vez: ${resumo}. Você atingiu ${hi} repetições em todas as séries por dois treinos seguidos: suba para ${kgTxt(novo)} kg e volte a ${lo} repetições.` };
  }
  if (noTopo(last)) return { kg, reps: hi, texto: `Última vez: ${resumo}. Repita ${hi} repetições em todas as séries hoje; se conseguir, aumente a carga no próximo treino.` };
  if (abaixo(last) && abaixo(h2[1]) && kg > 0) {
    const novo = menos(kg);
    // carga já no mínimo: não há o que reduzir
    if (novo <= 0) return { kg, reps: lo, texto: `Últimos treinos abaixo de ${lo} repetições. Mantenha a carga e capriche na técnica.` };
    return { kg: novo, reps: lo, texto: `Últimos treinos abaixo de ${lo} repetições. Reduza para ${kgTxt(novo)} kg e capriche na técnica.` };
  }
  return { kg, reps: maisUma, texto: `Última vez: ${resumo}. Mantenha a carga e tente mais repetições (alvo: ${faixa}).` };
}

// ---------- volta depois de uma pausa ----------
const temposDosTreinos = () => { const out = []; for (const s of state.sessions) { const t = s ? Date.parse(s.inicio) : NaN; if (Number.isFinite(t)) out.push(t); } return out.sort((a, b) => a - b); };
const maiorCarga = (hst) => Math.max(0, ...hst.sets.map((s) => pos(s.kg)));
const arred = (kg) => { const p = passo(kg); return Math.round(Math.round(kg / p) * p * 100) / 100; };
// Ajusta a sugestão de carga pelo tempo sem treinar antes de voltar (faixas e percentuais em logic/pausa.js).
// 1) Primeiro treino do exercício depois de 2 semanas ou mais sem treinar: carga reduzida conforme o tempo parado.
// 2) Treinos seguintes, até 6 semanas depois da volta: sobe cerca de 10% por treino até a carga de antes da pausa.
// Conta o tempo sem NENHUM treino (não só sem o exercício): quem seguiu treinando outras coisas não tem redução.
export function retomada(exId, sug, alvoReps, agora = Date.now()) {
  const ex = EX_POR_ID.get(exId);
  if (!ex || !sug || !Number.isFinite(agora)) return sug;
  const h = historico(exId, 8);
  if (!h.length) return sug;
  const t0 = Date.parse(h[0].data);
  if (!Number.isFinite(t0) || t0 > agora) return sug;
  const ts = temposDosTreinos();
  const [lo] = parseReps(alvoReps);
  const dias = maiorPausa(ts, t0, agora);
  const n = nivelPausa(dias);
  if (n >= 1) {
    const tempo = duracaoTxt(dias);
    const corte = cortePausa(n);
    const menor = (v) => Math.max(1, Math.round(v * (1 - corte)));
    if (ex.registro === 'segundos' || ex.registro === 'minutos') {
      const un = ex.registro === 'minutos' ? 'min' : 's';
      if (!(sug.seg > 0)) return sug;
      return { ...sug, seg: menor(sug.seg), pausaDias: dias, texto: `Você ficou ${tempo} sem treinar. Hoje faça ${menor(sug.seg)} ${un} (antes da pausa: ${sug.seg} ${un}) e retome aos poucos.` };
    }
    if (ex.registro === 'reps') {
      const ult = Math.max(0, ...h[0].sets.map((s) => pos(s.reps)));
      if (!(ult > 0)) return sug;
      return { ...sug, reps: menor(ult), pausaDias: dias, texto: `Você ficou ${tempo} sem treinar. Hoje faça ${menor(ult)} repetições por série (antes da pausa: ${ult}) e retome aos poucos.` };
    }
    const antes = maiorCarga(h[0]);
    if (assistido(exId)) {
      // na máquina com ajuda, voltar mais leve é usar MAIS ajuda
      if (!(antes > 0)) return sug;
      const kg = Math.max(arred(antes * (1 + corte)), mais(antes));
      return { kg, reps: lo, pausaDias: dias, texto: `Você ficou ${tempo} sem treinar. Hoje use mais ajuda da máquina: ${kgTxt(kg)} kg (antes da pausa: ${kgTxt(antes)} kg).` };
    }
    if (!(antes > 0)) return { ...sug, pausaDias: dias, texto: `Você ficou ${tempo} sem treinar. Hoje faça menos repetições do que da última vez e retome aos poucos.` };
    const kg = arred(antes * (1 - corte));
    if (!(kg > 0) || kg >= antes) return { kg: antes, reps: lo, pausaDias: dias, texto: `Você ficou ${tempo} sem treinar. Hoje mantenha ${kgTxt(antes)} kg e faça menos repetições; retome aos poucos.` };
    return { kg, reps: lo, pausaDias: dias, texto: `Você ficou ${tempo} sem treinar. Hoje comece com cerca de ${Math.round(corte * 100)}% menos: ${kgTxt(kg)} kg (antes da pausa: ${kgTxt(antes)} kg). Se ficar leve, suba na série seguinte.` };
  }
  if (ex.registro !== 'peso_reps' || assistido(exId)) return sug;
  // já voltou: procura a volta mais recente (dois treinos seguidos do exercício separados por 4 semanas ou mais sem treinar)
  for (let i = 0; i + 1 < h.length; i++) {
    const ta = Date.parse(h[i].data), tb = Date.parse(h[i + 1].data);
    if (!Number.isFinite(ta) || !Number.isFinite(tb) || agora - ta > 42 * DIA) break;
    if (nivelPausa(maiorPausa(ts, tb, ta)) < 2) continue;
    const ref = maiorCarga(h[i + 1]);   // carga de antes da pausa
    const atual = maiorCarga(h[0]);
    if (!(atual > 0) || atual >= ref) return sug;
    if (!h[0].sets.every((s) => pos(s.reps) >= lo)) return sug;   // ainda não fez o mínimo de repetições: segue a regra normal
    const novo = Math.min(ref, Math.max(arred(atual * 1.1), mais(atual)));
    if (sug.kg >= novo) return sug;
    return { kg: novo, reps: lo, texto: `Retomada: antes da pausa você usava ${kgTxt(ref)} kg; na última vez, ${kgTxt(atual)} kg. Hoje suba para ${kgTxt(novo)} kg.` };
  }
  return sug;
}

export const volumeSessao = (s) => lista(s && s.itens).reduce((t, it) => t + lista(it && it.sets).reduce((a, st) => a + (st && st.ok ? pos(st.kg) * pos(st.reps) : 0), 0), 0);
export const seriesSessao = (s) => lista(s && s.itens).reduce((t, it) => t + lista(it && it.sets).filter((x) => x && x.ok).length, 0);
export const duracaoSessao = (s) => { const d = s && s.fim ? (Date.parse(s.fim) - Date.parse(s.inicio)) / 1000 : 0; return Number.isFinite(d) ? Math.max(0, d) : 0; };

// segunda-feira da semana de uma data
export function inicioSemana(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function diasTreinados(desde, ate) {
  const set = new Set();
  for (const s of state.sessions) {
    const t = Date.parse(s.inicio);
    if (t >= desde.getTime() && t < ate.getTime()) set.add(dateKey(new Date(t)));
  }
  return set;
}
export function semanaAtual() {
  const ini = inicioSemana();
  const fim = new Date(ini); fim.setDate(fim.getDate() + 7);
  return diasTreinados(ini, fim);
}
// Quantas semanas atrás (0 = esta semana) fica um treino, pela segunda-feira da semana dele.
// O arredondamento absorve a hora a mais ou a menos das viradas de horário de verão.
function semanasAtras(t, ini) {
  return Math.round((ini.getTime() - inicioSemana(new Date(t)).getTime()) / (7 * 86400000));
}
// semanas seguidas (terminando na atual ou na anterior) em que a meta de dias foi cumprida
export function sequenciaSemanas(meta) {
  if (!state.sessions.length) return 0;
  // uma passada só pelo histórico: os dias treinados em cada semana
  const ini = inicioSemana();
  const porSemana = new Map();
  for (const s of state.sessions) {
    const t = s ? Date.parse(s.inicio) : NaN;
    if (!Number.isFinite(t)) continue;
    const i = semanasAtras(t, ini);
    if (i < 0 || i >= 520) continue; // treino com data no futuro ou de mais de 10 anos atrás
    let dias = porSemana.get(i);
    if (!dias) porSemana.set(i, (dias = new Set()));
    dias.add(dateKey(new Date(t)));
  }
  let n = 0;
  for (let i = 0; i < 520; i++) {
    const dias = porSemana.has(i) ? porSemana.get(i).size : 0;
    if (dias >= meta) n++;
    else if (i === 0) continue; // a semana atual ainda está em andamento
    else break;
  }
  return n;
}
// volume (kg levantados) das últimas n semanas, numa passada só pelo histórico
export function volumePorSemana(n = 8) {
  const ini = inicioSemana();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = new Date(ini); a.setDate(a.getDate() - 7 * i);
    out.push({ rotulo: `${a.getDate()}/${a.getMonth() + 1}`, vol: 0, treinos: 0 });
  }
  for (const s of state.sessions) {
    const t = s ? Date.parse(s.inicio) : NaN;
    if (!Number.isFinite(t)) continue;
    const i = semanasAtras(t, ini);
    if (i < 0 || i >= n) continue;
    out[n - 1 - i].vol += volumeSessao(s);
    out[n - 1 - i].treinos++;
  }
  return out;
}
// exercícios do plano que não evoluem há 3 treinos seguidos
export function estagnados(plan) {
  const out = [];
  if (!plan) return out;
  const ids = new Set(lista(plan.dias).flatMap((d) => lista(d && d.itens).map((i) => i.ex)));
  for (const id of ids) {
    const ex = EX_POR_ID.get(id);
    if (!ex || ex.registro !== 'peso_reps') continue;
    const hst = historico(id, 4);
    if (hst.length < 4) continue;
    const best = hst.map((x) => Math.max(...x.sets.map((s) => e1rm(pos(s.kg), pos(s.reps)))));
    if (best[3] > 0 && best[0] <= best[3] * 1.005 && best[1] <= best[3] * 1.005 && best[2] <= best[3] * 1.005) out.push(id);
  }
  return out;
}

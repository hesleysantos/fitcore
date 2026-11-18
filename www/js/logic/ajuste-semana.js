// Mudança "só nesta semana" num treino do plano. Puro: sem DOM. O estado guarda as versões em state.ajustesSemana
// (validadas por limparAjustesSemana, aqui, chamada no sanitize de store.js — o que vale também para o backup).
//
// O plano é a agenda de todas as semanas. Às vezes a pessoa quer mudar um treino só nesta semana (o aparelho vai estar em
// manutenção, está com pouco tempo, quer tirar uma série porque a semana está pesada) e, na semana seguinte, voltar ao de
// sempre. Para isso fica guardada uma versão do treino (a lista de exercícios inteira) para uma semana: segunda a domingo,
// a mesma semana da aba Treinos (logic/perdido.js). Na sessão, "Trocar" e "Aparelho ocupado" continuam valendo só para
// aquele treino (views/session.js): isso não passa por aqui.
//
// INTERFACE (usada pelo editor do treino, pela avaliação, pela sessão e pelo chat):
//  • semanaDe(data) → 'AAAA-MM-DD' da segunda-feira da semana de `data` ('AAAA-MM-DD'); '' se a data é inválida.
//  • ajustarSemana(s, { planId, diaId, data, itens }) → true se gravou. Chame dentro de update((s) => ...). Grava `itens`
//    como a versão do treino `diaId` do plano `planId` só na semana de `data`. Itens iguais aos do plano apagam a versão
//    (não sobra "mudança" que não muda nada). Itens: [{ ex, series, reps, descanso, nota }] (o formato do plano).
//  • itensDoDia(st, planId, diaId, data) → itens que valem naquele dia: a versão da semana, se houver; senão, os do plano.
//    [] se o plano ou o treino não existe. Devolve uma cópia (pode mexer à vontade).
//  • temAjusteNaSemana(st, planId, diaId, data) → true se o treino tem versão só para a semana de `data`.
//  • desfazerAjusteSemana(s, planId, diaId, data) → true se havia versão e ela saiu (volta o de sempre). Dentro de update.
//  • limparAjustesSemana(raw, hoje?) → lista limpa: só semanas recentes (de 2 semanas atrás até 10 semanas à frente de
//    `hoje`), uma versão por plano + treino + semana, exercícios do catálogo, até MAX_AJUSTES versões e 40 itens cada.
import { EX_POR_ID } from '../data/exercises.js';

export const MAX_AJUSTES = 60;
const MAX_ITENS = 40;
const DIA_MS = 86400000;
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const pad = (n) => String(n).padStart(2, '0');
const chave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const idOk = (v) => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);

function paraData(v) {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? new Date(v.getFullYear(), v.getMonth(), v.getDate()) : null;
  const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}
export function semanaDe(data) {
  const d = paraData(data);
  if (!d) return '';
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return chave(d);
}
// um exercício no formato do plano (o mesmo corte de store.js, cleanPlanItem)
function limparItem(it) {
  if (!isObj(it) || !EX_POR_ID.has(it.ex)) return null;
  const n = (v, lo, hi, pd) => { const x = Number(v); return Number.isFinite(x) ? Math.round(Math.min(hi, Math.max(lo, x))) : pd; };
  return {
    ex: it.ex, series: n(it.series, 1, 12, 3), reps: typeof it.reps === 'string' && /^\d{1,3}(-\d{1,3})?$/.test(it.reps) ? it.reps : '10',
    descanso: n(it.descanso, 0, 900, 90), nota: typeof it.nota === 'string' ? it.nota.slice(0, 200) : '',
  };
}
const limparItens = (l) => (Array.isArray(l) ? l.slice(0, MAX_ITENS * 2).map(limparItem).filter(Boolean).slice(0, MAX_ITENS) : []);
const mesmaLista = (a, b) => a.length === b.length && a.every((x, i) => x.ex === b[i].ex && x.series === b[i].series && x.reps === b[i].reps && x.descanso === b[i].descanso);
const diaDoPlano = (st, planId, diaId) => {
  const p = st && Array.isArray(st.plans) ? st.plans.find((x) => x && x.id === planId) : null;
  return p && Array.isArray(p.dias) ? p.dias.find((d) => d && d.id === diaId) || null : null;
};
const achar = (st, planId, diaId, semana) => (st && Array.isArray(st.ajustesSemana) ? st.ajustesSemana.findIndex((a) => a && a.planId === planId && a.diaId === diaId && a.semana === semana) : -1);

export function ajustarSemana(s, { planId, diaId, data, itens } = {}) {
  const semana = semanaDe(data);
  const dia = diaDoPlano(s, planId, diaId);
  if (!s || !semana || !dia || !Array.isArray(itens)) return false;
  const lista = limparItens(itens);
  if (!Array.isArray(s.ajustesSemana)) s.ajustesSemana = [];
  const i = achar(s, planId, diaId, semana);
  // igual ao plano: não há mudança a guardar
  if (mesmaLista(lista, limparItens(dia.itens))) { if (i >= 0) s.ajustesSemana.splice(i, 1); return true; }
  const reg = { planId, diaId, semana, itens: lista, em: new Date().toISOString() };
  if (i >= 0) s.ajustesSemana[i] = reg; else s.ajustesSemana.push(reg);
  if (s.ajustesSemana.length > MAX_AJUSTES) s.ajustesSemana.splice(0, s.ajustesSemana.length - MAX_AJUSTES);
  return true;
}
export function itensDoDia(st, planId, diaId, data) {
  const dia = diaDoPlano(st, planId, diaId);
  if (!dia) return [];
  const i = achar(st, planId, diaId, semanaDe(data));
  const fonte = i >= 0 ? st.ajustesSemana[i].itens : dia.itens;
  return (Array.isArray(fonte) ? fonte : []).filter((x) => isObj(x)).map((x) => ({ ...x }));
}
export const temAjusteNaSemana = (st, planId, diaId, data) => !!diaDoPlano(st, planId, diaId) && achar(st, planId, diaId, semanaDe(data)) >= 0;
export function desfazerAjusteSemana(s, planId, diaId, data) {
  const i = achar(s, planId, diaId, semanaDe(data));
  if (i < 0) return false;
  s.ajustesSemana.splice(i, 1);
  return true;
}
export function limparAjustesSemana(raw, hoje = new Date()) {
  if (!Array.isArray(raw)) return [];
  const base = paraData(hoje) || new Date();
  const de = semanaDe(new Date(base.getTime() - 14 * DIA_MS)), ate = semanaDe(new Date(base.getTime() + 70 * DIA_MS));
  const vistos = new Set(), out = [];
  for (const a of raw.slice(0, MAX_AJUSTES * 4)) {
    if (!isObj(a) || !idOk(a.planId) || !idOk(a.diaId)) continue;
    const semana = semanaDe(a.semana);
    if (!semana || semana !== a.semana || semana < de || semana > ate) continue;
    const k = a.planId + '|' + a.diaId + '|' + semana;
    if (vistos.has(k)) continue;
    const itens = limparItens(a.itens);
    vistos.add(k);
    out.push({ planId: a.planId, diaId: a.diaId, semana, itens, em: typeof a.em === 'string' && !Number.isNaN(Date.parse(a.em)) ? a.em : '' });
  }
  return out.slice(-MAX_AJUSTES);
}

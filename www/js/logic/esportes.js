// Outros esportes do dia (futebol, vôlei, natação...): só o tempo praticado e o gasto de energia estimado. Sem plano de
// treino e sem análise de desempenho. Puro: sem DOM e sem estado global.
//
// Conta, a mesma do treino registrado (logic/gasto.js, com as fontes lidas em texto completo): kcal = MET × peso (kg) ×
// horas, com o MET do 2024 Adult Compendium (ref compendio2024); aos 60 anos ou mais, o MET do Older Adult Compendium
// (ref compendio60_2024) × 2,7/3,5. Abaixo de 18 anos e com transtorno alimentar informado, nada de calorias (o mesmo
// critério do diário). A tabela "não reflete o gasto exato de cada pessoa": o número é sempre uma estimativa (≈).
import { ESPORTES, ESPORTE_POR_ID } from '../data/esportes.js';
import { pesoParaGasto } from './gasto.js';
import { perfilDoDiario } from './diario.js';
import { diaValido } from './saude.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const MAX_ATIVIDADES = 3000;
export const MIN_MAX = 600; // 10 horas: mais do que isso num registro é engano de digitação

// [{ id, data: 'AAAA-MM-DD', esporte, min, em }] — só esportes conhecidos, datas válidas, minutos de 1 a 600, sem id repetido
export function limparAtividades(raw) {
  const out = [], ids = new Set();
  for (const a of Array.isArray(raw) ? raw.slice(-MAX_ATIVIDADES * 2) : []) {
    if (!isObj(a) || typeof a.id !== 'string' || !a.id || a.id.length > 40 || ids.has(a.id)) continue;
    if (!diaValido(a.data) || !ESPORTE_POR_ID.has(a.esporte)) continue;
    const min = Math.round(Number(a.min));
    if (!Number.isFinite(min) || min < 1 || min > MIN_MAX) continue;
    ids.add(a.id);
    out.push({ id: a.id, data: a.data, esporte: a.esporte, min, em: typeof a.em === 'string' && !Number.isNaN(Date.parse(a.em)) ? a.em : '' });
  }
  return out.sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : 0)).slice(-MAX_ATIVIDADES);
}

export const atividadesDoDia = (st, data) => (isObj(st) && Array.isArray(st.atividades) ? st.atividades.filter((a) => a.data === data) : []);

// Quanto gasta por minuto para esta pessoa: { mostrar, motivo, porMin, met } (motivo: 'transtorno' | 'menor' | 'peso')
export function gastoPorMinuto(esporte, st) {
  const e = ESPORTE_POR_ID.get(esporte);
  const out = { mostrar: false, motivo: '', porMin: null, met: null };
  if (!e) return out;
  let perfil = { idade: null, condicoes: new Set() };
  try { perfil = perfilDoDiario(st); } catch { /* sem idade e sem condições */ }
  if (perfil.condicoes.has('transtorno')) { out.motivo = 'transtorno'; return out; }
  if (perfil.idade != null && perfil.idade < 18) { out.motivo = 'menor'; return out; }
  const idade60 = perfil.idade != null && perfil.idade >= 60 && e.met60 != null;
  out.met = idade60 ? e.met60 : e.met;
  const peso = pesoParaGasto(st);
  if (peso == null) { out.motivo = 'peso'; return out; }
  out.porMin = (out.met * peso * (idade60 ? 2.7 / 3.5 : 1)) / 60;
  out.mostrar = true;
  return out;
}

// Gasto de uma atividade registrada, arredondado a 10 kcal (a tabela não dá mais precisão do que isso)
export function gastoDaAtividade(a, st) {
  const g = gastoPorMinuto(a && a.esporte, st);
  return { ...g, kcal: g.mostrar ? Math.round((g.porMin * (Number(a.min) || 0)) / 10) * 10 : null };
}

// Total do dia com esportes: { min, kcal (ou null sem peso/sem mostrar), itens }
export function gastoDoDia(st, data) {
  const itens = atividadesDoDia(st, data).map((a) => ({ ...a, nome: ESPORTE_POR_ID.get(a.esporte).nome, ...gastoDaAtividade(a, st) }));
  const min = itens.reduce((t, x) => t + x.min, 0);
  const todos = itens.length && itens.every((x) => x.mostrar);
  return { min, kcal: todos ? itens.reduce((t, x) => t + x.kcal, 0) : null, itens };
}

export { ESPORTES };

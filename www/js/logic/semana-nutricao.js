// Treinos de cada dia e cardápio da semana para a Nutricionista. Só lê o estado (nunca altera).
// Os treinos vêm da agenda de musculação do plano ativo (plan.agenda[dia da semana]) e do plano de corrida
// (logic/corrida.js, treinoDoDia). As metas de cada dia vêm de metaDoDia (logic/diario.js): a meta muda com a semana
// do plano de corrida — dentro da semana, a corrida entra pela média (calcular, em logic/nutrition.js).
import { EX_POR_ID } from '../data/exercises.js';
import { treinoDoDia, planoAtual } from './corrida.js';
import { metaDoDia, somarDias } from './diario.js';
import { cardapioDoDia, limparAjustes } from './nutrition.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const diaDaSemana = (data) => new Date(data + 'T12:00:00Z').getUTCDay();
// treino pesado de pernas (o mesmo critério de antes na tela): 6 ou mais séries de agachar, dobradiça de quadril,
// afundo ou exercício de corpo inteiro, ou 8 exercícios ou mais
const PADROES_PERNA = new Set(['agachar', 'dobradica_quadril', 'afundo', 'total']);

export function musculacaoDoDia(st, data) {
  const s = isObj(st) ? st : {};
  const plano = Array.isArray(s.plans) ? s.plans.find((p) => isObj(p) && p.id === s.activePlan) : null;
  if (!plano || !isObj(plano.agenda) || !Array.isArray(plano.dias)) return { plano: !!plano, dia: null };
  const d = plano.dias.find((x) => isObj(x) && x.id === plano.agenda[diaDaSemana(data)]);
  if (!d || !Array.isArray(d.itens) || !d.itens.length) return { plano: true, dia: null };
  const series = d.itens.reduce((n, it) => { const ex = isObj(it) ? EX_POR_ID.get(it.ex) : null; return n + (ex && PADROES_PERNA.has(ex.padrao) ? Number(it.series) || 0 : 0); }, 0);
  return { plano: true, dia: { nome: typeof d.nome === 'string' && d.nome.trim() ? d.nome.trim() : 'treino', forte: series >= 6 || d.itens.length >= 8 } };
}

// { data, musculacao: { nome, forte } | null, corrida: { tipo, nome, durMin, distKm, intensidade } | null, conhecido }
// conhecido = há treino de musculação ou plano de corrida no aplicativo (dá para dizer se o dia é de descanso)
export function treinosDoDia(st, hoje, data) {
  const mu = musculacaoDoDia(st, data);
  let corrida = null, planoCorrida = false;
  try {
    planoCorrida = !!planoAtual(st, hoje);
    const t = planoCorrida ? treinoDoDia(st, hoje, data) : null;
    // "descanso" no plano de corrida é o dia protegido por dor: não há corrida
    if (t && t.tipo && t.tipo !== 'descanso' && Number(t.durMin) > 0) corrida = { tipo: t.tipo, nome: String(t.nome || 'Corrida'), durMin: Number(t.durMin), distKm: Number(t.distKm) || 0, intensidade: t.intensidade || 'leve' };
  } catch { corrida = null; }
  return { data, musculacao: mu.dia, corrida, conhecido: mu.plano || planoCorrida };
}

// Os 7 dias de hoje em diante: [{ data, treinos, meta, cardapio }]. `res` (opcional) é a meta de hoje já calculada.
// O cardápio de cada dia é o mesmo da tela do dia (mesma semente e mesmos ajustes); a semana usa comida comum.
export function semanaDoCardapio(st, hoje, { res = null, dias = 7 } = {}) {
  const ajustes = limparAjustes(isObj(st) && isObj(st.nutri) ? st.nutri.ajustes : null);
  const out = [];
  for (let i = 0; i < dias; i++) {
    const data = somarDias(hoje, i);
    let meta = i === 0 && res ? res : null;
    if (!meta) { try { meta = metaDoDia(st, data); } catch { meta = null; } }
    out.push({ data, treinos: treinosDoDia(st, hoje, data), meta, cardapio: meta ? cardapioDoDia(meta, data, ajustes[data] || null) : null });
  }
  return out;
}

// Soma as atividades registradas em um dia. Só considera o que foi feito, nunca o treino planejado.
import { gastoDoTreino, pesoParaGasto } from './gasto.js';
import { gastoDaAtividade } from './esportes.js';
import { perfilDoDiario } from './diario.js';
import { limparRegistros } from './corrida.js';

// METs por faixa de ritmo, 2024 Adult Compendium (códigos 12028–12135).
const MET_CORRIDA = [[6.4, 6.5], [8, 8.3], [9.7, 9], [10.8, 9.3], [12.1, 10.5], [13, 11], [14, 11.8], [15.7, 12], [17.4, 12.5], [18.3, 13], [19.3, 14.8], [Infinity, 16]];
const MET_CAMINHADA = [[3.2, 2.8], [3.9, 3.8], [5.5, 4.8], [7, 5.5], [7.9, 7], [8.9, 8.5], [Infinity, 5.5]];
// Sem distância não há como calcular o ritmo. Usa caminhada recreativa/ritmo próprio (adultos: 3,5 MET;
// 60+: 4,0 MET) em vez de descartar um registro válido que pede apenas o tempo.
const MET_CAMINHADA_SEM_RITMO = 3.5, MET_CAMINHADA_SEM_RITMO_60 = 4.0;

function kcalPorMET(met, min, peso, corrigido60 = false) {
  return met * peso * min / 60 * (corrigido60 ? 2.7 / 3.5 : 1);
}

export function gastoDoDia(st, data) {
  const out = { mostrar: false, kcal: 0, atividades: 0 };
  let perfil;
  try { perfil = perfilDoDiario(st); } catch { return out; }
  if (perfil.condicoes.has('transtorno') || (perfil.idade != null && perfil.idade < 18)) return out;
  const peso = pesoParaGasto(st);
  if (peso == null) return out;
  const sessoes = (Array.isArray(st.sessions) ? st.sessions : []).filter((s) => {
    const d = Date.parse(s.inicio);
    if (!Number.isFinite(d)) return false;
    const local = new Date(d);
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}` === data;
  });
  for (const s of sessoes) {
    const g = gastoDoTreino(s, st);
    if (g.mostrar) { out.kcal += g.kcal; out.atividades++; }
  }
  for (const a of Array.isArray(st.atividades) ? st.atividades.filter((x) => x.data === data) : []) {
    const g = gastoDaAtividade(a, st);
    if (g.mostrar) { out.kcal += g.kcal; out.atividades++; }
  }
  for (const r of limparRegistros(Array.isArray(st.runs) ? st.runs : []).filter((x) => x.data === data)) {
    const caminhada = r.tipo === 'caminhada';
    if (!(r.durMin > 0) || (!caminhada && !(r.distKm > 0))) continue;
    const kmh = r.distKm > 0 ? r.distKm * 60 / r.durMin : 0;
    const met = caminhada
      ? r.distKm > 0 ? MET_CAMINHADA.find(([lim]) => kmh <= lim)[1] : MET_CAMINHADA_SEM_RITMO
      : MET_CORRIDA.find(([lim]) => kmh <= lim)[1];
    // O Older Adult Compendium só tem valores de corrida para 3,6 e 7 mph; usa esses valores quando o ritmo coincide,
    // e os METs adultos para os demais ritmos, como o app já faz quando uma atividade não tem valor 60+ correspondente.
    const met60 = caminhada && r.distKm === 0 ? MET_CAMINHADA_SEM_RITMO_60
      : !caminhada && Math.abs(kmh - 5.8) < 0.2 ? 8.5
        : !caminhada && Math.abs(kmh - 11.3) < 0.2 ? 15.8 : null;
    const olderMatch = perfil.idade >= 60 && met60 != null;
    out.kcal += kcalPorMET(olderMatch ? met60 : met, r.durMin, peso, olderMatch);
    out.atividades++;
  }
  out.kcal = Math.round(out.kcal / 10) * 10;
  out.mostrar = out.atividades > 0 && out.kcal > 0;
  return out;
}

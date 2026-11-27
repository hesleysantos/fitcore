// Soma as atividades registradas em um dia. Só considera o que foi feito, nunca o treino planejado.
import { gastoDoTreino, pesoParaGasto, MET_MUSC } from './gasto.js';
import { gastoDaAtividade } from './esportes.js';
import { ESPORTE_POR_ID } from '../data/esportes.js';
import { TIPOS_TREINO } from '../data/corrida.js';
import { perfilDoDiario } from './diario.js';
import { limparRegistros } from './corrida.js';

// METs por faixa de ritmo, 2024 Adult Compendium (códigos 12028–12135).
const MET_CORRIDA = [[6.4, 6.5], [8, 8.3], [9.7, 9], [10.8, 9.3], [12.1, 10.5], [13, 11], [14, 11.8], [15.7, 12], [17.4, 12.5], [18.3, 13], [19.3, 14.8], [Infinity, 16]];
// 2024 Compendium: walking bands 17152/17160/17190/17200/17220/17230/17231. Above its fastest listed walk, cap at 8.5 MET
// rather than dropping back to 5.5 (which caused nearly identical fast walks to have very different estimates).
const MET_CAMINHADA = [[3.9, 2.8], [4.5, 3.5], [5.5, 3.8], [6.3, 4.8], [7.0, 5.5], [7.9, 7.0], [8.9, 8.5], [Infinity, 8.5]];
// Sem distância não há como calcular o ritmo. Usa caminhada recreativa/ritmo próprio (adultos: 3,5 MET;
// 60+: 4,0 MET) em vez de descartar um registro válido que pede apenas o tempo.
const MET_CAMINHADA_SEM_RITMO = 3.5, MET_CAMINHADA_SEM_RITMO_60 = 4.0;
// Quando não há distância para inferir o ritmo, usa o equivalente geral do Compendium:
// corrida (12150 = 8,0 MET), trote autoescolhido (12020 = 7,5) e corrida/caminhada (12010 = 6,0).
const MET_CORRIDA_SEM_RITMO = 8.0, MET_TROTE_SEM_RITMO = 7.5, MET_CORRIDA_CAMINHADA = 6.0;

function kcalPorMET(met, min, peso, corrigido60 = false) {
  return met * peso * min / 60 * (corrigido60 ? 0.810 : 1);
}
const arredonda10 = (kcal) => Math.round(kcal / 10) * 10;
const metCaminhada = (kmh) => kmh < 3.2 ? 2.3 : MET_CAMINHADA.find(([lim]) => kmh <= lim)[1];

function itensDaSessao(s, g) {
  const partes = [];
  if (g.musculacaoMin > 0) partes.push({ nome: `Musculação${s.nome ? ` · ${s.nome}` : ''}`, min: g.musculacaoMin, met: g.idade60 ? MET_MUSC.idoso : MET_MUSC.adulto });
  for (const c of g.cardio) partes.push({ nome: `${c.nome}${s.nome ? ` · ${s.nome}` : ''}`, min: c.min, met: c.met });
  if (!partes.length) return [{ id: s.id, nome: s.nome || 'Treino', kcal: g.kcal }];
  const detalhados = partes.map((p) => ({ id: s.id, nome: p.nome, min: p.min, kcal: arredonda10(kcalPorMET(p.met, p.min, g.peso, g.idade60)) }));
  // Mantém o rateio exibido igual ao valor arredondado da sessão no histórico.
  const maior = partes.reduce((i, p, n) => p.min * p.met > partes[i].min * partes[i].met ? n : i, 0);
  detalhados[maior].kcal += g.kcal - detalhados.reduce((t, x) => t + x.kcal, 0);
  return detalhados;
}

function metIntervalo(x) {
  if (x.ritmo > 0) {
    const kmh = 3600 / x.ritmo;
    return x.tipo === 'caminhar' ? metCaminhada(kmh) : MET_CORRIDA.find(([lim]) => kmh <= lim)[1];
  }
  if (x.tipo === 'caminhar') return MET_CAMINHADA_SEM_RITMO;
  if (x.tipo === 'trote' || x.tipo === 'aquecer' || x.tipo === 'desaquecer') return MET_TROTE_SEM_RITMO;
  return MET_CORRIDA_SEM_RITMO;
}

function itensDosIntervalos(r, peso) {
  const grupos = new Map();
  for (const x of r.intervalos || []) {
    const seg = Number(x.seg) || 0;
    if (seg <= 0) continue;
    const met = metIntervalo(x), nome = { aquecer: 'Aquecimento', correr: 'Corrida leve', forte: 'Tiro / ritmo forte', trote: 'Trote de recuperação', caminhar: 'Caminhada', desaquecer: 'Desaquecimento' }[x.tipo] || 'Intervalo';
    const p = grupos.get(x.tipo) || { nome: `${TIPOS_TREINO[r.tipo]?.nome || 'Treino intervalado'} · ${nome}`, min: 0, bruto: 0 };
    p.min += seg / 60;
    p.bruto += kcalPorMET(met, seg / 60, peso);
    grupos.set(x.tipo, p);
  }
  const partes = [...grupos.values()];
  if (!partes.length) return [];
  const total = arredonda10(partes.reduce((t, p) => t + p.bruto, 0));
  const out = partes.map((p) => ({ id: r.id, nome: p.nome, min: Math.round(p.min * 10) / 10, kcal: arredonda10(p.bruto) }));
  const maior = partes.reduce((i, p, n) => p.bruto > partes[i].bruto ? n : i, 0);
  out[maior].kcal += total - out.reduce((t, x) => t + x.kcal, 0);
  return out;
}

export function gastoDoDia(st, data) {
  const out = { mostrar: false, kcal: 0, atividades: 0, itens: [] };
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
    if (g.mostrar) { out.itens.push(...itensDaSessao(s, g)); out.atividades++; }
  }
  for (const a of Array.isArray(st.atividades) ? st.atividades.filter((x) => x.data === data) : []) {
    const g = gastoDaAtividade(a, st);
    if (g.mostrar) { out.itens.push({ id: a.id, nome: ESPORTE_POR_ID.get(a.esporte)?.nome || 'Esporte', min: a.min, kcal: g.kcal }); out.atividades++; }
  }
  for (const r of limparRegistros(Array.isArray(st.runs) ? st.runs : []).filter((x) => x.data === data)) {
    const caminhada = r.tipo === 'caminhada';
    if (!(r.durMin > 0)) continue;
    if (!r.distKm && !caminhada && Array.isArray(r.intervalos) && r.intervalos.length) {
      const itens = itensDosIntervalos(r, peso);
      if (itens.length) { out.itens.push(...itens); out.atividades++; continue; }
    }
    const kmh = r.distKm > 0 ? r.distKm * 60 / r.durMin : 0;
    const met = caminhada
      ? r.distKm > 0 ? metCaminhada(kmh) : MET_CAMINHADA_SEM_RITMO
      : r.distKm > 0 ? MET_CORRIDA.find(([lim]) => kmh <= lim)[1]
        : r.tipo === 'corrida_caminhada' ? MET_CORRIDA_CAMINHADA
          : MET_CORRIDA_SEM_RITMO;
    // O Older Adult Compendium só tem valores de corrida para 3,6 e 7 mph; usa esses valores quando o ritmo coincide,
    // e os METs adultos para os demais ritmos, como o app já faz quando uma atividade não tem valor 60+ correspondente.
    const met60 = caminhada && r.distKm === 0 ? MET_CAMINHADA_SEM_RITMO_60
      : !caminhada && Math.abs(kmh - 5.8) < 0.2 ? 8.5
        : !caminhada && Math.abs(kmh - 11.3) < 0.2 ? 15.8 : null;
    const olderMatch = perfil.idade >= 60 && met60 != null;
    const kcal = arredonda10(kcalPorMET(olderMatch ? met60 : met, r.durMin, peso, olderMatch));
    out.itens.push({ id: r.id, nome: TIPOS_TREINO[r.tipo]?.nome || 'Corrida ou caminhada', min: r.durMin, kcal });
    out.atividades++;
  }
  out.kcal = out.itens.reduce((t, x) => t + x.kcal, 0);
  out.mostrar = out.atividades > 0 && out.kcal > 0;
  return out;
}

export const resumoGastoDoDia = (g) => (g && Array.isArray(g.itens) ? g.itens : []).map((x) => `${x.nome}: ≈ ${Math.round(x.kcal).toLocaleString('pt-BR')} kcal`).join(' · ');

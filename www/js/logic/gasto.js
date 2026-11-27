// Gasto de energia estimado de um treino registrado (tela do treino concluído). Puro: sem DOM e sem estado global.
//
// Fonte, lida em texto completo: 2024 Adult Compendium of Physical Activities (Herrmann 2024, ref compendio2024) e a
// tabela oficial em pacompendium.com; para 60 anos ou mais, o Older Adult Compendium (Willis 2024, ref compendio60_2024).
//  • 1 MET equivale a cerca de 1,0 kcal por quilo por hora: kcal = MET × peso (kg) × horas. É o gasto TOTAL no tempo do
//    treino (inclui o de repouso). A fonte não fala em MET líquido (MET − 1), e por isso ele não é usado aqui.
//  • O "MET corrigido" (Kozey 2010, na página Corrected METs do Compendium) divide o MET pelo metabolismo de repouso
//    previsto (Harris-Benedict) para classificar melhor a intensidade de cada pessoa. Ele muda a classificação, não a
//    conta de energia (MET corrigido × repouso da pessoa = MET padrão × 3,5 mL/kg/min): fica de fora.
//  • A tabela "não reflete o gasto exato de cada pessoa" e serve como ponto de partida: o número é sempre "≈" e a tela diz
//    que é estimativa.
//  • Os valores de adultos valem de 19 a 59 anos; a partir dos 60, os do Older Adult Compendium convertem MET60+ a
//    0,810 kcal/kg/h (em vez de 1,0 no Compendium adulto). Por isso, aos 60 ou mais, kcal = MET60+ × 0,810 ×
//    peso × horas. Abaixo de 18 anos (outra
//    tabela, a Youth Compendium) o aplicativo não mostra calorias — como no diário alimentar, que também não as mostra.
//  • Transtorno alimentar informado em qualquer entrevista: nada de calorias (o mesmo critério do diário, logic/diario.js).
//
// Musculação: "Resistance (weight) training, multiple exercises, 8-15 repetitions at varied resistance" — 02054, 3,5 METs
// (60+: 0205460, 4,3). O registro não diz o esforço; o esforço vigoroso (02050, 6,0) não é presumido. O tempo da
// musculação é a duração do treino menos o tempo de cardio registrado (o descanso entre as séries faz parte da atividade
// medida nos estudos de musculação do Compendium).
import { EX_POR_ID } from '../data/exercises.js';
import { perfilDoDiario } from './diario.js';

const MET_MUSCULACAO = 3.5, MET_MUSCULACAO_60 = 4.3;
// Cardio do catálogo → [MET adulto, MET 60+ (null = sem valor específico na tabela de 60+)]. Para máquinas sem MET60+
// próprio, usa o valor adulto publicado como referência e converte para 0,810 kcal/kg/h por MET60+.
export const METS_CARDIO = {
  'caminhada-esteira': [3.8, null],            // 17355: esteira, 4,8 a 5,5 km/h, sem inclinação
  'caminhada-inclinada-esteira': [5.3, null],  // 17034: subida de 1% a 5%, ritmo moderado a rápido (não há esteira inclinada)
  'corrida-esteira': [8.0, null],              // 12150: corrida
  'caminhada-esteira-curva': [8.3, null],      // 17455: esteira curva, 4,8 a 8 km/h, ritmo rápido
  'bicicleta-ergometrica': [6.8, 5.3],         // 01200: bicicleta ergométrica, geral (60+: 0101060, moderado)
  'bicicleta-reclinada': [6.8, 5.3],            // 01200/0101060: bicicleta estacionária, geral (categoria oficial equivalente)
  'air-bike': [6.8, 5.3],                       // 01200/0101060: bicicleta estacionária, geral (sem MET específico para Air Bike)
  'hiit-bicicleta': [8.8, null],               // 01305: bicicleta, treino intervalado de alta intensidade
  eliptico: [5.0, 3.0],                        // 02048: elíptico, moderado (60+: 0204760, leve)
  'remo-ergometro': [5.0, 6.5],                // 02071: remo ergômetro, abaixo de 100 W, moderado (60+: 0207260, 50 a 99 W)
  'simulador-escada': [9.3, null],             // 02065: simulador de escada, geral
  'simulador-esqui': [10.5, null],              // 02082: SkiErg, dupla impulsão, intensidade leve a moderada
  'ergometro-de-braco': [2.8, null],            // 02115: ergômetro de braço, geral, esforço leve (sem potência/esforço registrados)
  'pular-corda': [11.0, null],                 // 02068: pular corda, geral
};
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Peso para a conta: o último registro de peso; sem ele, o informado em qualquer entrevista de treinador ou na
// Nutricionista. null = sem peso.
export function pesoParaGasto(st) {
  const s = isObj(st) ? st : {};
  const body = Array.isArray(s.body) ? s.body.filter((b) => isObj(b) && num(b.peso) >= 20 && num(b.peso) <= 400) : [];
  if (body.length) return body[body.length - 1].peso;
  for (const k of ['trainer', 'run', 'nutri']) {
    const p = isObj(s[k]) && isObj(s[k].answers) ? num(s[k].answers.peso) : null;
    if (p != null && p >= 20 && p <= 400) return p;
  }
  return null;
}

// Gasto estimado de uma sessão `sessao` ({ inicio, fim, itens: [{ ex, sets: [{ seg, ok }] }] }) com o estado `st`.
// Devolve { mostrar, motivo, kcal, peso, idade60, musculacaoMin, cardio: [{ ex, nome, min, met }], foraDaConta: [nome] }.
//   mostrar = false com motivo 'transtorno' | 'menor' (não mostrar nada) ou 'peso' (pedir o peso); 'vazio' = sem tempo.
export function gastoDoTreino(sessao, st) {
  const out = { mostrar: false, motivo: '', kcal: null, peso: null, idade60: false, musculacaoMin: 0, cardio: [], foraDaConta: [] };
  let perfil = { idade: null, condicoes: new Set() };
  try { perfil = perfilDoDiario(st); } catch { /* estado ilegível: segue sem idade e sem condições */ }
  if (perfil.condicoes.has('transtorno')) { out.motivo = 'transtorno'; return out; }
  if (perfil.idade != null && perfil.idade < 18) { out.motivo = 'menor'; return out; }
  const s = isObj(sessao) ? sessao : {};
  const dur = (Date.parse(s.fim) - Date.parse(s.inicio)) / 60000;
  const totalMin = Number.isFinite(dur) && dur > 0 ? Math.min(dur, 24 * 60) : 0;
  const idade60 = perfil.idade != null && perfil.idade >= 60;
  out.idade60 = idade60;
  let cardioMin = 0, forca = false;
  for (const it of Array.isArray(s.itens) ? s.itens : []) {
    const ex = isObj(it) ? EX_POR_ID.get(it.ex) : null;
    if (!ex) continue;
    if (ex.registro !== 'minutos') { forca = true; continue; }
    const min = (Array.isArray(it.sets) ? it.sets : []).filter((x) => isObj(x) && x.ok).reduce((t, x) => t + (num(x.seg) > 0 ? x.seg : 0), 0);
    if (!min) continue;
    cardioMin += min;
    const m = METS_CARDIO[ex.id];
    const met = m ? (idade60 ? (m[1] ?? m[0]) : m[0]) : null;
    if (met == null) out.foraDaConta.push(ex.nome);
    else out.cardio.push({ ex: ex.id, nome: ex.nome, min, met, ...(idade60 && m[1] == null ? { fallback60: true } : {}) });
  }
  // o cardio registrado não passa da duração do treino; o que sobra é musculação (se houve exercício de força)
  const escala = cardioMin > totalMin && cardioMin > 0 ? totalMin / cardioMin : 1;
  for (const c of out.cardio) c.min = Math.round(c.min * escala * 10) / 10;
  out.musculacaoMin = forca ? Math.max(0, Math.round(totalMin - cardioMin * escala)) : 0;
  if (!out.musculacaoMin && !out.cardio.length) { out.motivo = 'vazio'; return out; }
  const peso = pesoParaGasto(st);
  if (peso == null) { out.motivo = 'peso'; return out; }
  const metHoras = (out.musculacaoMin / 60) * (idade60 ? MET_MUSCULACAO_60 : MET_MUSCULACAO) + out.cardio.reduce((t, c) => t + (c.min / 60) * c.met, 0);
  out.peso = peso;
  // arredondado a 10 kcal: a tabela não dá mais precisão do que isso
  out.kcal = Math.round((metHoras * peso * (idade60 ? 0.810 : 1)) / 10) * 10;
  out.mostrar = out.kcal > 0;
  if (!out.mostrar) out.motivo = 'vazio';
  return out;
}
export const MET_MUSC = { adulto: MET_MUSCULACAO, idoso: MET_MUSCULACAO_60 };

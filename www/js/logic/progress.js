// Cálculos de progresso: histórico por exercício, recordes, sugestão de carga e constância semanal.
import { state } from '../store.js';
import { EX_POR_ID } from '../data/exercises.js';
import { dateKey } from '../ui.js';
import { DIA, nivelPausa, cortePausa, duracaoTxt, maiorPausa, diasEntre, voltaEm, FAIXAS_PAUSA, FAIXA_DA_RESPOSTA, CORTE_CARDIO, IRV_MAX, DESCANSO_MINIMO } from './pausa.js';
import { pesosDoExercicio } from './trainer.js';

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
// carga com uma fração a mais ou a menos, no passo da grade (pelo menos um passo de diferença)
function comPct(kg, pct) {
  const p = passo(kg);
  const v = Math.round((kg * (1 + pct)) / p) * p;
  return Math.round((pct > 0 ? Math.max(kg + p, v) : Math.max(0, Math.min(kg - p, v))) * 100) / 100;
}

// ---------- repetições que ainda sairiam (RIR) e exercício travado ----------
// Fontes (texto completo, novembro de 2026):
//  • acsm2026: esforço suficiente com "a target of 2–3 repetitions in reserve (RIR)"; ir até a falha não melhora força nem
//    músculo. helms2016 (PMC4961270): para hipertrofia, RIR de 0 a 2 nos exercícios de uma articulação e 2 a 4 nos
//    principais; novatos "likely not base training intensity or progression solely on the RIR-based scale".
//  • steele2017 (PMC5712461): os menos experientes erram por 4 a 5 repetições; os experientes, por 1 a 2 → para quem está
//    começando, a resposta fica guardada, mas a carga segue só pelas repetições (dupla progressão).
//  • helms2018 (PMC5877330): "for every 0.5 RPE above or below ... load was decreased or increased by 2%" → cerca de 4% por
//    repetição fora da faixa, com teto de 10% (acsm2009: aumentos de 2 a 10%); 5% nos exercícios de uma articulação.
//    Sobe com a média de 1 ou mais acima do teto da faixa e desce com 0 nos principais (nos de uma articulação, chegar
//    perto de 0 é normal: helms2016, 0 a 2). O estudo ajustava de uma série para a outra; aqui, como na regra "2 por 2" do acsm2009, só depois de DOIS treinos
//    seguidos com a mesma carga (escolha do app, para não seguir um dia ruim nem um erro de conta).
//  • Exercício travado (a melhor marca não sobe há 3 treinos): bell2022 (PMC9811819, Tabela 3: menos séries e "reducing the
//    absolute load (e.g., by 10%) whilst keeping the number of repetitions constant"; usado quando "performance has
//    plateaued"), bell2023 (PMC10511399: depois da semana leve, "intensity of training can be increased"), rogerson2024
//    (PMC10948666: a semana leve é feita quando o desempenho trava) e coleman2024 (PMC10809978: parar de vez uma semana
//    tirou força; por isso é mais leve, não parado). Se travar de novo, a troca do exercício (logic/variacao.js).
export const ROTULO_RIR = ['0', '1', '2', '3', '4+'];
export const TEXTO_RIR = [
  'Depois da série, marque quantas repetições a mais você ainda conseguiria fazer com boa técnica.',
  'Isso mostra se o peso está leve, certo ou pesado para você, e o app ajusta o próximo treino. Parar 2 a 3 repetições antes do limite já basta para ficar mais forte: não precisa ir até a falha.',
  'No primeiro ano de treino, é comum errar essa conta. Por isso, para quem está começando, a carga segue pelas repetições feitas, e a resposta fica guardada para você treinar o olhar.',
  'É opcional: sem resposta, a sugestão segue só pelas repetições.',
];
// faixa-alvo: principais (várias articulações) 2 a 3; os de uma articulação, 1 a 2 (acsm2026, helms2016)
export const alvoRir = (ex) => (ex && ex.tipo === 'composto' ? [2, 3] : [1, 2]);
// média das respostas nas séries (null quando menos da metade das séries tem resposta)
export function rirMedio(sets) {
  const l = lista(sets).map((s) => s && s.rir).filter((x) => Number.isInteger(x) && x >= 0 && x <= 4);
  return l.length && l.length * 2 >= lista(sets).length ? l.reduce((a, b) => a + b, 0) / l.length : null;
}
// começando (no primeiro ano): o RIR é só anotado (helms2016, steele2017). Pela entrevista do Treinador; sem ela, pelo
// primeiro treino registrado no app.
export function rirSoAnotado() {
  const exp = state.trainer && state.trainer.answers ? state.trainer.answers.experiencia : '';
  if (exp === 'nunca' || exp === 'iniciante') return true;
  if (exp === 'intermediario' || exp === 'avancado') return false;
  const t = state.sessions.map((s) => Date.parse(s && s.inicio)).filter(Number.isFinite);
  return !t.length || Date.now() - Math.min(...t) < 365 * DIA;
}
const maxKgDe = (hst) => Math.max(0, ...lista(hst && hst.sets).filter((s) => pos(s.reps) > 0).map((s) => pos(s.kg)));
const melhorDe = (hst) => Math.max(0, ...lista(hst && hst.sets).map((s) => e1rm(pos(s.kg), pos(s.reps))));
// treino mais leve: a carga máxima ficou 5% ou mais abaixo da do treino anterior
const maisLeve = (a, b) => maxKgDe(b) > 0 && maxKgDe(a) <= maxKgDe(b) * 0.95 + 1e-9;
// travado: nos 4 últimos treinos (do mais novo ao mais velho), os 3 mais novos não passaram da marca do 4º, sem nenhum
// treino mais leve no meio (um treino leve não conta como travado: era a semana leve)
export function travadoEm(hs) {
  if (lista(hs).length < 4) return false;
  const b = hs.slice(0, 4).map(melhorDe);
  if (!(b[3] > 0)) return false;
  for (let k = 0; k < 3; k++) if (maisLeve(hs[k], hs[k + 1]) || maisLeve(hs[k + 1], hs[k])) return false;
  return b[0] <= b[3] * 1.005 && b[1] <= b[3] * 1.005 && b[2] <= b[3] * 1.005;
}
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
    const rr0 = rirMedio(last.sets), rr1 = h2[1] ? rirMedio(h2[1].sets) : null;
    if (!topo && !rirSoAnotado() && rr0 != null && rr1 != null && rr0 >= 4 && rr1 >= 4) return { kg: pos(last.sets[0].kg) || null, reps: Math.max(...reps), rir: true, texto: `Última vez: ${reps.join(', ')} repetições, e ainda sobravam 4 ou mais. Está fácil: tente uma variação mais difícil ou adicione carga.` };
    return { kg: pos(last.sets[0].kg) || null, reps: Math.max(...reps), texto: topo ? `Última vez: ${reps.join(', ')} repetições. Você atingiu o alvo: tente uma variação mais difícil ou adicione carga.` : `Última vez: ${reps.join(', ')} repetições. Tente fazer 1 a mais em cada série.` };
  }
  const primeira = { kg: null, reps: lo, texto: `Primeira vez: comece leve. Escolha uma carga com que você faça ${hi} repetições sobrando umas 3.` };
  if (!last || !last.sets.some((s) => pos(s.reps))) return primeira;
  // Carga de trabalho: a maior da última vez (na máquina com ajuda, a MENOR ajuda, que é a série mais difícil).
  // Séries de trabalho: as feitas com pelo menos 90% dessa carga (ou até 10% mais ajuda). Aquecimento e degraus de
  // pirâmide ficam de fora: registrar essas séries não pode impedir a carga de subir.
  const ajuda = assistido(exId);
  const feitas = (hst) => (hst ? hst.sets.filter((s) => pos(s.reps) > 0) : []);
  const cargas = feitas(last).map((s) => pos(s.kg));
  const kg = ajuda ? Math.min(...cargas) : Math.max(...cargas);
  const deTrabalho = (hst) => feitas(hst).filter((s) => (ajuda ? pos(s.kg) <= kg * 1.1 + 1e-9 : pos(s.kg) >= kg * 0.9 - 1e-9));
  const comCarga = deTrabalho(last);
  const resumo = last.sets.map((s) => `${kgTxt(pos(s.kg))} kg × ${pos(s.reps)}`).join(' · ');
  // no topo: todas as séries de trabalho chegaram ao alto da faixa, e pelo menos uma foi feita com a carga cheia
  const cheia = (s) => (ajuda ? pos(s.kg) <= kg + 1e-9 : pos(s.kg) >= kg - 1e-9);
  const noTopo = (hst) => { const w = deTrabalho(hst); return w.length >= minSeries && w.some(cheia) && w.every((s) => pos(s.reps) >= hi); };
  // abaixo: a maioria das séries de trabalho ficou abaixo do mínimo da faixa
  const abaixo = (hst) => { const w = deTrabalho(hst); return w.length > 0 && w.filter((s) => pos(s.reps) < lo).length * 2 > w.length; };
  const maisUma = Math.min(hi, Math.max(lo, pos(comCarga[0].reps) + 1));
  if (!ajuda) {
    // o último treino foi o mais leve, por exercício travado: volta à carga de antes (bell2023)
    const h5 = historico(exId, 5);
    if (h5.length >= 5 && maisLeve(h5[0], h5[1]) && travadoEm(h5.slice(1))) {
      const antes = maxKgDe(h5[1]);
      return { kg: antes, reps: lo, plato: 'volta', texto: `Depois do treino mais leve, volte a ${kgTxt(antes)} kg e siga a progressão: mais repetições a cada treino, até ${hi}.` };
    }
  }
  if (ajuda) {
    if (noTopo(last) && kg > 0) return { kg: menos(kg), reps: lo, texto: `Última vez: ${resumo}. Você atingiu o alvo: reduza a ajuda da máquina para ${kgTxt(menos(kg))} kg.` };
    return { kg, reps: maisUma, texto: `Última vez: ${resumo}. Mantenha a ajuda e tente mais repetições.` };
  }
  if (noTopo(last) && noTopo(h2[1])) {
    const novo = mais(kg);
    return { kg: novo, reps: lo, texto: `Última vez: ${resumo}. Você atingiu ${hi} repetições em todas as séries por dois treinos seguidos: suba para ${kgTxt(novo)} kg e volte a ${lo} repetições.` };
  }
  if (noTopo(last)) return { kg, reps: hi, texto: `Última vez: ${resumo}. Repita ${hi} repetições em todas as séries hoje; se conseguir, aumente a carga no próximo treino.` };
  // quantas ainda sairiam: dois treinos seguidos com a mesma carga e fora da faixa-alvo (helms2018, acsm2026)
  const r0 = rirMedio(deTrabalho(last)), r1 = h2[1] ? rirMedio(deTrabalho(h2[1])) : null;
  if (!rirSoAnotado() && kg > 0 && r0 != null && r1 != null && Math.abs(maxKgDe(h2[1]) - kg) < 1e-9 && !abaixo(last)) {
    const [aMin, aMax] = alvoRir(ex);
    const faixaRir = `${aMin} a ${aMax}`;
    if (r0 >= aMax + 1 && r1 >= aMax + 1) {
      const novo = comPct(kg, Math.min(ex.tipo === 'composto' ? 0.1 : 0.05, 0.04 * (Math.min(r0, r1) - aMax)));
      return { kg: novo, reps: lo, rir: true, texto: `Última vez: ${resumo}. Nos dois últimos treinos, ainda sobravam ${Math.floor(Math.min(r0, r1))} repetições ou mais: a carga está leve. Suba para ${kgTxt(novo)} kg; o ideal é parar com ${faixaRir} sobrando.` };
    }
    if (r0 <= aMin - 2 && r1 <= aMin - 2) {
      const novo = comPct(kg, -Math.min(0.1, 0.04 * (aMin - Math.max(r0, r1))));
      if (novo > 0) return { kg: novo, reps: lo, rir: true, texto: `Última vez: ${resumo}. Nos dois últimos treinos, não sobrou nenhuma repetição. Baixe para ${kgTxt(novo)} kg: parar com ${faixaRir} sobrando dá o mesmo resultado, com menos cansaço.` };
    }
  }
  if (abaixo(last) && abaixo(h2[1]) && kg > 0) {
    const novo = menos(kg);
    // carga já no mínimo: não há o que reduzir
    if (novo <= 0) return { kg, reps: lo, texto: `Últimos treinos abaixo de ${lo} repetições. Mantenha a carga e capriche na técnica.` };
    return { kg: novo, reps: lo, texto: `Últimos treinos abaixo de ${lo} repetições. Reduza para ${kgTxt(novo)} kg e capriche na técnica.` };
  }
  // travado há 3 treinos: um treino mais leve, com uma série a menos e 10% menos carga, e depois a volta (bell2022)
  if (travadoEm(historico(exId, 4))) {
    const leve = comPct(kg, -0.1);
    if (leve > 0) return { kg: leve, reps: pos(comCarga[0].reps) || lo, plato: 'leve', texto: `Marca parada há 3 treinos. Hoje, um treino mais leve: uma série a menos, com ${kgTxt(leve)} kg e as mesmas repetições. No próximo, volte a ${kgTxt(kg)} kg.` };
  }
  return { kg, reps: maisUma, texto: `Última vez: ${resumo}. Mantenha a carga e tente mais repetições (alvo: ${faixa}).` };
}

// ---------- volta depois de uma pausa ----------
// Regras em logic/pausa.js (consenso CSCCa/NSCA de 2019 — ref caterisano2019).
const temposDosTreinos = () => { const out = []; for (const s of state.sessions) { const t = s ? Date.parse(s.inicio) : NaN; if (Number.isFinite(t)) out.push(t); } return out.sort((a, b) => a - b); };
const maiorCarga = (hst) => Math.max(0, ...hst.sets.map((s) => pos(s.kg)));
const arred = (kg) => { const p = passo(kg); return Math.round(Math.round(kg / p) * p * 100) / 100; };

// Volta em andamento: null ou { dias, retorno, semana, semanas }. Usa o histórico; para quem ainda não tem treinos
// registrados, usa o tempo parado informado ao Treinador, contado a partir do plano aceito.
export function voltaDePausa(agora = Date.now()) {
  if (!Number.isFinite(agora)) return null;
  const t = state.trainer || {};
  const a = t.answers || {};
  const faixa = a.experiencia === 'nunca' ? 0 : FAIXA_DA_RESPOSTA[a.pausa] || 0;
  const desde = Date.parse(t.aceitoEm);
  const declarada = faixa && Number.isFinite(desde) ? { dias: FAIXAS_PAUSA[faixa].meio, desde } : null;
  return voltaEm(temposDosTreinos(), agora, declarada);
}

// %1RM estimado para uma série de `reps` repetições parando com cerca de 3 de reserva (Epley)
const pct1RM = (reps) => 1 / (1 + (Math.max(1, reps) + 3) / 30);
// Musculação nas 2 primeiras semanas da volta (regra FIT): o volume relativo à intensidade
// (IRV = séries × repetições × %1RM) fica em até 30 por grupo muscular em cada treino. Recebe os itens do treino do dia
// ([{ ex, series, reps }]) e devolve quantas séries fazer de cada um. O %1RM é o da faixa de repetições do treino: a
// carga menor sugerida na volta acompanha a força que caiu com o tempo parado, então o esforço relativo é o mesmo e
// ela NÃO entra na conta (senão quem ficou mais tempo parado faria mais séries do que quem ficou menos).
export function seriesNaVolta(itens) {
  const series = itens.map((it) => Math.max(1, Math.round(Number(it.series) || 1)));
  const irv = (i) => { const [lo] = parseReps(itens[i].reps); return series[i] * lo * pct1RM(lo); };
  const grupos = new Map();
  itens.forEach((it, i) => {
    const ex = EX_POR_ID.get(it.ex);
    if (!ex || (ex.registro !== 'peso_reps' && ex.registro !== 'reps')) return;
    const w = pesosDoExercicio(ex);
    for (const g in w) if (w[g] === 1) { if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(i); }
  });
  for (let k = 0; k < 200; k++) {
    let mudou = false;
    for (const idx of grupos.values()) {
      if (idx.reduce((s, i) => s + irv(i), 0) <= IRV_MAX) continue;
      // tira uma série do exercício com mais séries (em caso de empate, do que vem depois no treino)
      let alvo = -1;
      for (const i of idx) if (series[i] > 1 && (alvo < 0 || series[i] >= series[alvo])) alvo = i;
      if (alvo < 0) continue;
      series[alvo]--; mudou = true;
    }
    if (!mudou) break;
  }
  return series;
}
// descanso entre as séries durante a volta (regra FIT: 4 vezes o tempo de esforço na 1ª semana e 3 vezes na 2ª)
export function descansoNaVolta(exId, descanso, volta) {
  const ex = EX_POR_ID.get(exId);
  const d = Number(descanso) || 0;
  if (!ex || !volta || volta.semana > 2 || (ex.registro !== 'peso_reps' && ex.registro !== 'reps')) return d;
  return Math.max(d, DESCANSO_MINIMO[volta.semana - 1]);
}

// Ajusta a sugestão do exercício pelo tempo sem treinar antes de voltar.
// Cardio (minutos): regra 50/30/20/10 do consenso — metade do tempo de antes na 1ª semana, 30% a menos na 2ª
//   (e 20% e 10% a menos na 3ª e na 4ª, depois de 3 meses ou mais parado).
// Carga (escolha conservadora do aplicativo, o consenso não fixa um corte de carga):
// 1) primeiro treino do exercício depois de 2 semanas ou mais sem treinar: carga reduzida conforme o tempo parado;
// 2) treinos seguintes, até 6 semanas depois da volta: sobe cerca de 10% por treino até a carga de antes da pausa.
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
  if (ex.registro === 'minutos') {
    const volta = voltaDePausa(agora);
    if (!volta) return sug;
    // tempo de antes da pausa: o último treino do exercício anterior à volta
    const antes = h.find((x) => Date.parse(x.data) < volta.retorno);
    const ref = antes ? Math.max(0, ...antes.sets.map((s) => pos(s.seg))) : 0;
    if (!(ref > 0)) return sug;
    const corte = CORTE_CARDIO[volta.semana - 1] || 0;
    const min = Math.max(1, Math.round(ref * (1 - corte)));
    return { ...sug, seg: min, pausaDias: volta.dias, texto: `Volta depois de ${duracaoTxt(volta.dias)} parado, semana ${volta.semana} de ${volta.semanas}: faça ${min} min (antes da pausa: ${ref} min).` };
  }
  const dias = maiorPausa(ts, t0, agora);
  // O corte vale enquanto a volta da pausa está em andamento. Pausa antiga, já superada com semanas de treino, não corta
  // nada: só lembra que o exercício não é feito há tempo.
  const emVolta = !!voltaDePausa(agora);
  const n = emVolta ? nivelPausa(dias) : 0;
  if (!emVolta && nivelPausa(dias) >= 1) {
    const semEx = diasEntre(t0, agora);
    if (semEx >= 28 && typeof sug.texto === 'string') return { ...sug, texto: `Faz ${duracaoTxt(semEx)} que você não faz este exercício: se a carga pesar, reduza. ${sug.texto}` };
    return sug;
  }
  if (n >= 1) {
    const tempo = duracaoTxt(dias);
    const corte = cortePausa(n);
    const menor = (v) => Math.max(1, Math.round(v * (1 - corte)));
    if (ex.registro === 'segundos') {
      if (!(sug.seg > 0)) return sug;
      if (menor(sug.seg) >= sug.seg) return { ...sug, pausaDias: dias, texto: `Você ficou ${tempo} sem treinar. Retome aos poucos.` };
      return { ...sug, seg: menor(sug.seg), pausaDias: dias, texto: `Você ficou ${tempo} sem treinar. Hoje faça ${menor(sug.seg)} s (antes da pausa: ${sug.seg} s) e retome aos poucos.` };
    }
    if (ex.registro === 'reps') {
      const ult = Math.max(0, ...h[0].sets.map((s) => pos(s.reps)));
      if (!(ult > 0)) return sug;
      if (menor(ult) >= ult) return { ...sug, pausaDias: dias, texto: `Você ficou ${tempo} sem treinar. Retome aos poucos.` };
      return { ...sug, reps: menor(ult), pausaDias: dias, texto: `Você ficou ${tempo} sem treinar. Hoje faça ${menor(ult)} ${menor(ult) === 1 ? 'repetição' : 'repetições'} por série (antes da pausa: ${ult}) e retome aos poucos.` };
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
    if (travadoEm(historico(id, 4))) out.push(id);
  }
  return out;
}

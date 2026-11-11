// Tempo sem treinar: faixas de pausa e regras da volta. Usado pelo Treinador, pelo treino e pela Evolução.
//
// O que diz o consenso CSCCa/NSCA (Caterisano 2019 — ref caterisano2019, lido na íntegra), escrito para atletas
// universitários e aplicado aqui como teto de segurança para qualquer praticante:
// - vale para quem ficou 2 semanas ou mais parado; a transição dura 2 semanas (4 depois de inatividade longa);
// - condicionamento (cardio): volume 50% menor na 1ª semana e 30% menor na 2ª; depois de inatividade longa,
//   50, 30, 20 e 10% menor ao longo de 4 semanas (regra 50/30/20/10);
// - musculação (regra FIT), nas 2 primeiras semanas: no máximo 3 treinos por grupo muscular na 1ª semana e 4 na 2ª;
//   volume relativo à intensidade (IRV = séries × repetições × %1RM em decimal) entre 11 e 30 por grupo muscular
//   (acima de 30 é contraindicado); e descanso de pelo menos 4 vezes o tempo de esforço na 1ª semana e 3 vezes na 2ª;
// - pausas curtas (1 a 4 semanas) tiram pouca força; pausas longas tiram bem mais; quem já treinou recupera depressa,
//   porque os núcleos ganhos pelas fibras musculares se mantêm mesmo com a perda de massa.
// O consenso NÃO fixa um corte de carga para a musculação. O corte de carga do primeiro treino (CORTE das faixas abaixo)
// é uma escolha conservadora deste aplicativo, coerente com a perda de força crescer com o tempo parado
// (Bosquet 2013 — ref bosquet2013). "Inatividade longa" também não tem prazo no consenso: aqui são 3 meses.
export const DIA = 86400000;
export const PAUSA_MINIMA = 14;   // dias parado a partir dos quais valem as regras da volta
export const PAUSA_LONGA = 90;    // dias parado a partir dos quais a transição dura 4 semanas
export const CORTE_CARDIO = [0.5, 0.3, 0.2, 0.1]; // redução do volume de cardio em cada semana da volta
export const IRV_MAX = 30;        // teto de séries × repetições × %1RM por grupo muscular em cada treino
// descanso mínimo entre as séries (s) na 1ª e na 2ª semana: 4 e 3 vezes uma série de cerca de 30 segundos
export const DESCANSO_MINIMO = [120, 90];
// n = faixa; min = dias parado a partir dos quais ela vale; corte = fração da carga a tirar no primeiro treino da volta;
// meio = tempo parado representativo (dias) quando só se conhece a resposta da entrevista
export const FAIXAS_PAUSA = [
  { n: 0, min: 0, corte: 0, meio: 0 },
  { n: 1, min: 14, corte: 0.1, meio: 21 },
  { n: 2, min: 28, corte: 0.2, meio: 60 },
  { n: 3, min: 90, corte: 0.3, meio: 135 },
  { n: 4, min: 180, corte: 0.5, meio: 270 },
];
// resposta da pergunta "Há quanto tempo você está sem treinar?" → faixa
export const FAIXA_DA_RESPOSTA = { treinando: 0, '2a4s': 1, '1a3m': 2, '3a6m': 3, mais6m: 4 };

export function nivelPausa(dias) {
  const d = Number(dias);
  if (!Number.isFinite(d)) return 0;
  let n = 0;
  for (const f of FAIXAS_PAUSA) if (d >= f.min) n = f.n;
  return n;
}
export const cortePausa = (n) => (FAIXAS_PAUSA[n] || FAIXAS_PAUSA[0]).corte;
// quantas semanas dura a transição depois de uma pausa
export const semanasDeTransicao = (dias) => (dias >= PAUSA_LONGA ? 4 : 2);

// "12 dias", "3 semanas", "2 meses", "1 ano"
export function duracaoTxt(dias) {
  const d = Math.max(0, Math.round(Number(dias) || 0));
  if (d < 14) return d === 1 ? '1 dia' : `${d} dias`;
  if (d < 60) return `${Math.round(d / 7)} semanas`;
  if (d < 345) return `${Math.round(d / 30)} meses`;
  const anos = Math.round(d / 365);
  return anos <= 1 ? '1 ano' : `${anos} anos`;
}

// Maior intervalo (em dias) entre treinos seguidos, de `desde` até `agora`. `tempos` = inícios dos treinos, em ms, em ordem.
// É o tempo que a pessoa ficou de fato sem treinar nesse período (e não só sem fazer um exercício).
export function maiorPausa(tempos, desde, agora) {
  let ant = desde, maior = 0;
  for (const t of tempos) {
    if (!(t > desde) || t > agora) continue;
    if (t - ant > maior) maior = t - ant;
    ant = t;
  }
  if (agora - ant > maior) maior = agora - ant;
  return Math.max(0, Math.floor(maior / DIA));
}

// Volta de uma pausa em andamento. `tempos` = inícios dos treinos (ms, em ordem); `declarada` = pausa informada ao
// Treinador, para quem ainda não tem histórico no aplicativo: { dias, desde } (desde = quando o plano foi aceito, ms).
// Devolve null ou { dias (tempo parado), retorno (ms do primeiro treino da volta, ou agora), semana (1, 2, ...), semanas }.
export function voltaEm(tempos, agora, declarada = null) {
  const ts = tempos.filter((t) => t <= agora);
  const ult = ts.length ? ts[ts.length - 1] : null;
  if (ult != null && agora - ult >= PAUSA_MINIMA * DIA) {
    const dias = Math.floor((agora - ult) / DIA);
    return { dias, retorno: agora, semana: 1, semanas: semanasDeTransicao(dias) };
  }
  for (let i = ts.length - 1; i >= 1; i--) {
    if (agora - ts[i] > 28 * DIA) break;
    const dias = Math.floor((ts[i] - ts[i - 1]) / DIA);
    if (dias < PAUSA_MINIMA) continue;
    const semanas = semanasDeTransicao(dias);
    const semana = Math.floor((agora - ts[i]) / (7 * DIA)) + 1;
    return semana <= semanas ? { dias, retorno: ts[i], semana, semanas } : null;
  }
  // sem pausa no histórico: vale a pausa informada ao Treinador, se não houver treinos registrados antes do plano
  if (declarada && declarada.dias >= PAUSA_MINIMA && Number.isFinite(declarada.desde) && declarada.desde <= agora) {
    if (ts.some((t) => t < declarada.desde)) return null;
    const primeiro = ts.length ? ts[0] : agora;
    const semanas = semanasDeTransicao(declarada.dias);
    const semana = Math.floor((agora - primeiro) / (7 * DIA)) + 1;
    return semana <= semanas ? { dias: declarada.dias, retorno: primeiro, semana, semanas } : null;
  }
  return null;
}

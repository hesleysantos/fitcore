// Tempo sem treinar: faixas de pausa e redução de carga na volta. Usado pelo Treinador, pela sugestão de carga e pela Evolução.
// A força cai pouco nas primeiras semanas sem treino e mais depois disso, e a queda é maior em quem tem mais de 65 anos
// (Bosquet 2013 — ref bosquet2013). Depois de 2 semanas ou mais de pausa, a volta deve ser gradual, com carga e volume
// reduzidos nas primeiras 2 a 4 semanas (Caterisano 2019 — ref caterisano2019). Os percentuais abaixo são uma aplicação
// conservadora dessa regra; o usuário pode mudar a carga a qualquer momento.
export const DIA = 86400000;
// n = faixa; min = dias parado a partir dos quais ela vale; corte = fração da carga a tirar no primeiro treino da volta
export const FAIXAS_PAUSA = [
  { n: 0, min: 0, corte: 0 },
  { n: 1, min: 14, corte: 0.1 },
  { n: 2, min: 28, corte: 0.2 },
  { n: 3, min: 90, corte: 0.3 },
  { n: 4, min: 180, corte: 0.5 },
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

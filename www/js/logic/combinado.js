// Quem faz corrida E musculação: o que priorizar e se quer fortalecimento para a corrida.
// Este arquivo só guarda a escolha (state.combo), valida o que entra e diz em que situação a pessoa está. O que cada
// escolha MUDA fica nas regras de cada treinador, com as referências: logic/trainer.js (musculação e fortalecimento) e
// logic/corrida.js (corrida). Puro: sem DOM e sem importar o estado.

// foco: '' (ainda não respondeu) | 'corrida' | 'musculacao' | 'equilibrio'
export const FOCOS = ['corrida', 'musculacao', 'equilibrio'];
// fortalecimento para a corrida: '' (ainda não respondeu) | 'nao' | 'sim' (dentro do plano de musculação que a pessoa já
// tem) | 'academia' | 'casa' (plano próprio de fortalecimento, para quem não faz musculação)
export const FORTALECIMENTOS = ['nao', 'sim', 'academia', 'casa'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const iso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : '');

export const comboPadrao = () => ({ foco: '', fortalecimento: '', em: '' });
export function limparCombo(raw) {
  const r = isObj(raw) ? raw : {};
  return { foco: FOCOS.includes(r.foco) ? r.foco : '', fortalecimento: FORTALECIMENTOS.includes(r.fortalecimento) ? r.fortalecimento : '', em: iso(r.em) };
}
// "foco|fortalecimento" com que um plano foi montado (guardado em state.trainer.combo para saber se a escolha mudou depois)
export const chaveCombo = (c) => `${c && FOCOS.includes(c.foco) ? c.foco : ''}|${c && FORTALECIMENTOS.includes(c.fortalecimento) ? c.fortalecimento : ''}`;
export function chaveValida(v) {
  if (typeof v !== 'string') return false;
  const p = v.split('|');
  return p.length === 2 && (p[0] === '' || FOCOS.includes(p[0])) && (p[1] === '' || FORTALECIMENTOS.includes(p[1]));
}

// plano de musculação ativo com pelo menos um dia de treino na agenda
export function temMusculacao(st) {
  const plano = st && Array.isArray(st.plans) ? st.plans.find((p) => p && p.id === st.activePlan) : null;
  if (!plano || !isObj(plano.agenda) || !Array.isArray(plano.dias)) return false;
  return Object.values(plano.agenda).some((id) => { const d = plano.dias.find((x) => x && x.id === id); return !!d && Array.isArray(d.itens) && d.itens.length > 0; });
}
// plano de corrida aceito e não pausado
export const temCorrida = (st) => !!(st && isObj(st.run) && st.run.aceitoEm && !st.run.pausadoEm);
export const temOsDois = (st) => temMusculacao(st) && temCorrida(st);
// o plano ativo de musculação é o plano próprio de fortalecimento para a corrida (e não um treino de musculação da pessoa)?
export function planoEhFortalecimento(st) {
  const plano = st && Array.isArray(st.plans) ? st.plans.find((p) => p && p.id === st.activePlan) : null;
  return !!plano && plano.origem === 'fortalecimento';
}
// Falta perguntar alguma coisa? { foco: bool, fortalecimento: bool }
export function faltaPerguntar(st) {
  const c = limparCombo(st && st.combo);
  const corrida = temCorrida(st);
  const doisDeVerdade = temOsDois(st) && !planoEhFortalecimento(st);
  return { foco: doisDeVerdade && !c.foco, fortalecimento: corrida && !c.fortalecimento };
}
// escolha em vigor, já considerando a situação: sem os dois treinos não há foco; sem corrida não há fortalecimento
export function comboAtual(st) {
  const c = limparCombo(st && st.combo);
  return { foco: temOsDois(st) && !planoEhFortalecimento(st) ? c.foco : '', fortalecimento: temCorrida(st) ? c.fortalecimento : '', em: c.em };
}

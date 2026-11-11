// Objetivo do Treinador e objetivo da Nutricionista: por padrão, os dois andam juntos (ganhar massa com ganhar massa,
// emagrecer com emagrecer). O usuário pode escolher mantê-los diferentes; a escolha fica guardada em ui.objetivosOk.
// Objetivos da alimentação que combinam com cada objetivo de treino. O primeiro da lista é o padrão.
export const COMBINA = {
  hipertrofia: ['ganhar'],
  forca: ['ganhar', 'manter'],
  emagrecimento: ['emagrecer'],
  saude: ['manter'],
  resistencia: ['manter'],
};
const TREINO_PADRAO = { ganhar: 'hipertrofia', emagrecer: 'emagrecimento', manter: 'saude' };
const tem = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

export const combinam = (treino, nutri) => !tem(COMBINA, treino) || !tem(TREINO_PADRAO, nutri) || COMBINA[treino].includes(nutri);
// objetivo da alimentação que acompanha um objetivo de treino (mantém o atual se ele já combina)
export const nutriPara = (treino, atual) => (!tem(COMBINA, treino) ? null : tem(TREINO_PADRAO, atual) && COMBINA[treino].includes(atual) ? atual : COMBINA[treino][0]);
// objetivo de treino que acompanha um objetivo da alimentação (mantém o atual se ele já combina)
export const treinoPara = (nutri, atual) => (!tem(TREINO_PADRAO, nutri) ? null : tem(COMBINA, atual) && COMBINA[atual].includes(nutri) ? atual : TREINO_PADRAO[nutri]);
export const parDe = (treino, nutri) => `${treino}|${nutri}`;
export const parValido = (v) => { if (typeof v !== 'string') return false; const [t, n, resto] = v.split('|'); return resto === undefined && tem(COMBINA, t) && tem(TREINO_PADRAO, n); };

const obj = (st, k) => { const a = st && st[k] && st[k].answers; const v = a && typeof a === 'object' ? a.objetivo : null; return typeof v === 'string' ? v : null; };
// Situação atual: null enquanto um dos dois ainda não tem objetivo. `aceito` = o usuário escolheu manter este par diferente.
export function situacao(st) {
  const treino = obj(st, 'trainer'), nutri = obj(st, 'nutri');
  if (!tem(COMBINA, treino) || !tem(TREINO_PADRAO, nutri)) return null;
  const ok = combinam(treino, nutri);
  return { treino, nutri, combinam: ok, aceito: !ok && !!st.ui && st.ui.objetivosOk === parDe(treino, nutri) };
}
// Iguala os objetivos. lado = 'treino': o treino manda e a alimentação muda. lado = 'nutri': a alimentação manda e o
// treino muda (o plano do Treinador volta a ser uma proposta, para o usuário ver e aceitar o plano novo).
export function alinhar(st, lado, agora = new Date()) {
  const s = situacao(st);
  if (!s || s.combinam) return false;
  if (lado === 'treino') {
    st.nutri.answers.objetivo = nutriPara(s.treino, s.nutri);
    st.nutri.calculadoEm = agora.toISOString();
  } else {
    st.trainer.answers.objetivo = treinoPara(s.nutri, s.treino);
    st.trainer.aceitoEm = ''; st.trainer.revisaoEm = ''; st.trainer.adiadoAte = '';
  }
  if (st.ui) st.ui.objetivosOk = '';
  return true;
}
export function manterDiferentes(st) {
  const s = situacao(st);
  if (!s || s.combinam || !st.ui) return false;
  st.ui.objetivosOk = parDe(s.treino, s.nutri);
  return true;
}

// Dias da semana em que a pessoa NÃO treina ("não sugerir treinos no domingo"). Puro: sem DOM e sem importar o estado.
// Um lugar só: a resposta fica na entrevista do Treinador (state.trainer.answers.semTreino) e vale para a musculação, a
// corrida, o fortalecimento e o treino perdido. A entrevista da corrida não pergunta de novo: ela só não oferece esses dias.
// Ids: '0' = domingo ... '6' = sábado (os mesmos da pergunta de dias da corrida); 'nenhum' = treina em qualquer dia.
//
// Limite: até 5 dias fora, para sobrarem os 2 dias livres do menor plano do Treinador (2 treinos por semana). As regras de
// descanso continuam as de sempre (48 horas entre treinos do mesmo músculo — ref garber2011; força em dias não seguidos
// para menores de 18 e diabetes — refs faigenbaum2009, colberg2016): se os dias livres não deixam cumpri-las, o plano fica
// com menos treinos (logic/trainer.js), nunca com o descanso a menos.

export const NENHUM = 'nenhum';
export const MAX_BLOQUEADOS = 5;
export const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
// na ordem da semana que começa na segunda
const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const OP_DIAS = [['1', 'Segunda', ''], ['2', 'Terça', ''], ['3', 'Quarta', ''], ['4', 'Quinta', ''], ['5', 'Sexta', ''], ['6', 'Sábado', ''], ['0', 'Domingo', '']];

// A pergunta da entrevista do Treinador. Opcional: respostas salvas antes dela valem como "nenhum".
export const perguntaSemTreino = () => ({
  k: 'semTreino', tipo: 'varios', opcional: true, titulo: 'Tem algum dia em que você não pode treinar?',
  ajuda: 'Nesses dias eu não marco musculação nem corrida.', nenhum: NENHUM, max: MAX_BLOQUEADOS, unidade: ['dia', 'dias'],
  op: [...OP_DIAS, [NENHUM, 'Nenhum, qualquer dia serve', '']],
});

// Dias bloqueados de um conjunto de respostas: números de 0 a 6, na ordem da semana (no máximo 5).
export function bloqueadosDe(respostas) {
  const v = respostas && typeof respostas === 'object' ? respostas.semTreino : null;
  if (!Array.isArray(v) || v.includes(NENHUM)) return [];
  const s = new Set(v.filter((x) => typeof x === 'string' && /^[0-6]$/.test(x)).map(Number));
  return ORDEM.filter((w) => s.has(w)).slice(0, MAX_BLOQUEADOS);
}
// Dias bloqueados do estado (a resposta do Treinador)
export const diasBloqueados = (st) => bloqueadosDe(st && st.trainer && st.trainer.answers);
// quantos dias livres sobram na semana
export const livresDe = (bloqueados) => 7 - (Array.isArray(bloqueados) ? new Set(bloqueados).size : 0);
// "segunda e domingo"
export function nomesDosDias(wds) {
  const l = ORDEM.filter((w) => wds.includes(w)).map((w) => NOME_DIA[w]);
  return l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1];
}
// Frase da pergunta de quantos dias por semana, quando os dias livres limitam as opções ('' quando não limitam)
export function notaDosDias(respostas) {
  const b = bloqueadosDe(respostas);
  const livres = livresDe(b);
  if (livres >= 7) return '';
  return livres >= 6 ? `Sem treino ${b.length === 1 ? 'no dia' : 'nos dias'} que você marcou: ${nomesDosDias(b)}.`
    : `Com ${nomesDosDias(b)} sem treino, sobram ${livres} dias livres: dá para treinar até ${livres} dias.`;
}

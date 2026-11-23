// Os dias de cada treino. Puro: sem DOM e sem importar o estado.
// Cada entrevista pergunta só os dias dela: a do Treinador, em quais dias a pessoa pode fazer musculação (diasMusc); a da
// corrida, em quais dias pode correr (logic/corrida.js, pergunta "dias"). Os dois planos se combinam depois (logic/trainer.js:
// pernas longe das corridas mais fortes; o mesmo dia pode ter os dois treinos). Os dias fora da musculação valem para a
// musculação, o fortalecimento e o treino perdido de musculação.
// Respostas antigas (de antes desta mudança): "Tem algum dia em que você não pode treinar?" (semTreino, para os dois
// treinos) e "Em algum desses dias você ainda quer correr?" (soCorrida). Continuam valendo até a entrevista ser refeita.
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

// A pergunta da entrevista do Treinador: os dias da musculação (pelo menos 2, o menor plano). Opcional só para as respostas
// antigas, que usam semTreino.
export const MIN_DIAS_MUSC = 2;
export const perguntaDiasMusc = () => ({
  k: 'diasMusc', tipo: 'varios', opcional: true, minimo: MIN_DIAS_MUSC, titulo: 'Em quais dias você pode fazer musculação?',
  ajuda: 'Marque pelo menos 2. Se você também corre, pode marcar os mesmos dias da corrida: eu organizo os dois treinos.',
  op: OP_DIAS,
});
// As perguntas antigas, só para a validação das respostas guardadas (store.js e logic/corrida.js): não aparecem mais nas
// entrevistas, mas a resposta continua valendo até a entrevista ser refeita.
export const PERGUNTAS_DIAS_ANTIGAS = [
  { k: 'semTreino', tipo: 'varios', max: MAX_BLOQUEADOS, op: [...OP_DIAS, [NENHUM, '', '']] },
  { k: 'soCorrida', tipo: 'varios', op: [...OP_DIAS, [NENHUM, '', '']] },
];
// dias marcados para a musculação (resposta nova), ou null
function diasMuscDe(respostas) {
  const v = respostas && typeof respostas === 'object' ? respostas.diasMusc : null;
  if (!Array.isArray(v)) return null;
  const s = new Set(v.filter((x) => typeof x === 'string' && /^[0-6]$/.test(x)).map(Number));
  return s.size ? s : null;
}
// dias sem treino em que a corrida continua (só os que estão entre os dias sem treino)
export function soCorridaDe(respostas) {
  const v = respostas && typeof respostas === 'object' ? respostas.soCorrida : null;
  if (!Array.isArray(v) || v.includes(NENHUM)) return [];
  const b = bloqueadosDe(respostas);
  return b.filter((w) => v.includes(String(w)));
}
// dias sem corrida: os sem treino, menos os que ficaram só para a corrida
export const semCorridaDe = (respostas) => { const so = soCorridaDe(respostas); return bloqueadosDe(respostas).filter((w) => !so.includes(w)); };
const respostasDe = (st, k) => (st && st[k] && st[k].answers && typeof st[k].answers === 'object' ? st[k].answers : null);
// Dias sem corrida do estado: só os da resposta antiga da própria entrevista da corrida (na nova, os dias de corrida são a
// pergunta "dias", e o plano usa só eles)
export const diasSemCorrida = (st) => semCorridaDe(respostasDe(st, 'run'));
// As respostas antigas de dias saem da entrevista guardada (as perguntas antigas não são mais feitas)
export function limparDiasAntigos(respostas) {
  if (respostas && typeof respostas === 'object') { delete respostas.semTreino; delete respostas.soCorrida; }
  return respostas;
}
// Treinos de musculação que caíram num dia sem musculação: vão para o dia livre mais afastado dos outros treinos (o
// descanso entre eles fica o maior possível). Devolve { agenda, movidos: [{ diaId, de, para }], sobrou: [diaId] }.
export function ajustarAgenda(agenda, bloqueados) {
  const bloq = new Set(bloqueados || []);
  const nova = {};
  for (const [w, id] of Object.entries(agenda || {})) if (id) nova[w] = id;
  const movidos = [], sobrou = [];
  for (const w of ORDEM.filter((x) => bloq.has(x) && nova[x])) {
    const id = nova[w]; delete nova[w];
    const usados = Object.keys(nova).map(Number);
    const dist = (a, b) => Math.min((a - b + 7) % 7, (b - a + 7) % 7);
    const livres = ORDEM.filter((x) => !bloq.has(x) && !nova[x]);
    if (!livres.length) { sobrou.push(id); continue; }
    const para = livres.map((x) => ({ x, d: usados.length ? Math.min(...usados.map((u) => dist(u, x))) : 7, perto: dist(x, w) }))
      .sort((p, q) => q.d - p.d || p.perto - q.perto)[0].x;
    nova[para] = id; movidos.push({ diaId: id, de: w, para });
  }
  return { agenda: nova, movidos, sobrou };
}

// Depois de mudar os dias da musculação: o treino que caiu num dia sem musculação passa para um dia livre (o mais afastado
// dos outros treinos). Devolve a frase do que mudou ('' sem mudança).
export function aplicarDiasNosTreinos(s) {
  const plan = s.plans.find((p) => p.id === s.activePlan);
  if (!plan) return '';
  const r = ajustarAgenda(plan.agenda, diasBloqueados(s));
  if (!r.movidos.length && !r.sobrou.length) return '';
  plan.agenda = r.agenda;
  const nome = (id) => (plan.dias.find((d) => d.id === id) || {}).nome || 'Treino';
  return r.movidos.map((m) => `${nome(m.diaId)} passou de ${nomesDosDias([m.de])} para ${nomesDosDias([m.para])}.`).join(' ') + (r.sobrou.length ? ' Sem dia livre para ' + r.sobrou.map(nome).join(', ') + ': escolha na aba Treinos.' : '');
}

// Dias sem musculação de um conjunto de respostas: números de 0 a 6, na ordem da semana (no máximo 5). Na resposta nova, os
// dias fora dos marcados para a musculação; na antiga, os dias sem treino.
export function bloqueadosDe(respostas) {
  const musc = diasMuscDe(respostas);
  if (musc) return ORDEM.filter((w) => !musc.has(w)).slice(0, MAX_BLOQUEADOS);
  const v = respostas && typeof respostas === 'object' ? respostas.semTreino : null;
  if (!Array.isArray(v) || v.includes(NENHUM)) return [];
  const s = new Set(v.filter((x) => typeof x === 'string' && /^[0-6]$/.test(x)).map(Number));
  return ORDEM.filter((w) => s.has(w)).slice(0, MAX_BLOQUEADOS);
}
// Dias sem musculação do estado (a resposta do Treinador; sem ela, a resposta antiga da corrida, que valia para os dois)
export const diasBloqueados = (st) => {
  const t = respostasDe(st, 'trainer');
  if (t && (diasMuscDe(t) || Array.isArray(t.semTreino))) return bloqueadosDe(t);
  return bloqueadosDe(respostasDe(st, 'run'));
};
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
  if (diasMuscDe(respostas)) return livres >= 6 ? '' : `Você marcou ${livres} dias: dá para treinar até ${livres}.`;
  return livres >= 6 ? `Sem treino ${b.length === 1 ? 'no dia' : 'nos dias'} que você marcou: ${nomesDosDias(b)}.`
    : `Com ${nomesDosDias(b)} sem treino, sobram ${livres} dias livres: dá para treinar até ${livres} dias.`;
}

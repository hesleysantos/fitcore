// Trocar os dias dos treinos de musculação: a pessoa diz em que dias da semana quer treinar e o treinador redistribui os
// treinos do plano nesses dias. Puro: sem DOM.
// Regras (as mesmas do "Não treinei" e do Treinador — logic/perdido.js, logic/trainer.js):
//  • o mesmo grupo pesado em dias seguidos é o que mais pesa (48 horas entre sessões do mesmo músculo — ref garber2011);
//    menores de 18 e diabetes: força em dias não seguidos (refs valovichmcleod2011, colberg2016);
//  • quem corre com prioridade na corrida ou nos dois: treino de pernas longe da véspera da corrida forte e do longo
//    (refs blagrove2018, doma2017);
//  • dias em que a pessoa não treina (logic/dias-livres.js) não recebem treino;
//  • empate: a ordem de sempre dos treinos (A, B, C...).
import { cargaDoTreino, choca, planoAtivo } from './perdido.js';
import { diasBloqueados } from './dias-livres.js';
import { resumoCombinado, perfil, saudeDoTreinador } from './trainer.js';
import { comboAtual } from './combinado.js';

const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const pos = (wd) => (wd + 6) % 7;
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// todas as ordens de uma lista pequena (até 7 treinos: 5.040)
function permutacoes(l) {
  if (l.length <= 1) return [l.slice()];
  const out = [];
  l.forEach((x, i) => { for (const p of permutacoes([...l.slice(0, i), ...l.slice(i + 1)])) out.push([x, ...p]); });
  return out;
}

// Os treinos do plano na ordem da semana atual (os que não têm dia vêm depois, na ordem do plano)
function ordemDosTreinos(plan) {
  const comDia = [];
  for (const wd of ORDEM) { const id = plan.agenda[wd]; if (id && !comDia.includes(id) && plan.dias.some((d) => d.id === id)) comDia.push(id); }
  return [...comDia, ...plan.dias.map((d) => d.id).filter((id) => !comDia.includes(id))];
}

// Proposta: { agenda, linhas: ['Segunda: Treino A', ...], avisos: [], foraDaSemana: [nomes], dias } ou null
export function sugerirDias(st, diasPedidos, hoje) {
  const plan = planoAtivo(st);
  if (!plan || !plan.dias.length) return null;
  const bloq = new Set(diasBloqueados(st));
  const dias = ORDEM.filter((w) => Array.isArray(diasPedidos) && diasPedidos.includes(w) && !bloq.has(w));
  if (!dias.length) return null;
  const ordem = ordemDosTreinos(plan);
  const n = Math.min(dias.length, ordem.length);
  const usados = ordem.slice(0, n);
  const carga = new Map(plan.dias.map((d) => [d.id, cargaDoTreino(d)]));
  let alternado = false;
  try { const pf = perfil(saudeDoTreinador(st, hoje).respostas); alternado = !!(pf.jovem || pf.diabetes); } catch { alternado = false; }
  let chave = [];
  try { const combo = comboAtual(st); if (combo.foco === 'corrida' || combo.foco === 'equilibrio') { const r = resumoCombinado(st, hoje); chave = r && Array.isArray(r.chave) ? r.chave : []; } } catch { chave = []; }
  const pernas = (id) => { const c = carga.get(id); return !!(c && c.pernas); };
  // os n dias escolhidos para os treinos: com mais dias do que treinos, os mais espalhados na semana
  const combos = (l, k) => (k === 0 ? [[]] : l.length < k ? [] : [...combos(l.slice(1), k - 1).map((c) => [l[0], ...c]), ...combos(l.slice(1), k)]);
  let melhor = null;
  for (const ds of combos(dias, n)) {
    for (const p of permutacoes(usados)) {
      let custo = 0;
      const em = new Map(ds.map((w, i) => [w, p[i]]));
      for (const w of ds) {
        const prox = (w + 1) % 7;
        if (em.has(prox)) { if (choca(carga.get(em.get(w)), carga.get(em.get(prox)))) custo += 100; else if (alternado) custo += 200; }
        if (pernas(em.get(w)) && (chave.includes(prox) || chave.includes(w))) custo += chave.includes(prox) ? 10 : 3;
      }
      // espalhar: dias seguidos custam um pouco; manter a ordem de sempre, menos ainda
      for (let i = 1; i < ds.length; i++) if (pos(ds[i]) - pos(ds[i - 1]) === 1) custo += 1;
      p.forEach((id, i) => { if (id !== usados[i]) custo += 0.1; });
      if (!melhor || custo < melhor.custo - 1e-9) melhor = { custo, ds, p };
    }
  }
  const agenda = {};
  melhor.ds.forEach((w, i) => { agenda[w] = melhor.p[i]; });
  const nome = (id) => (plan.dias.find((d) => d.id === id) || {}).nome || 'Treino';
  const linhas = ORDEM.filter((w) => agenda[w]).map((w) => `${DIAS[w].charAt(0).toUpperCase() + DIAS[w].slice(1)}: ${nome(agenda[w])}`);
  const avisos = [];
  if (melhor.custo >= 100) avisos.push('Com esses dias, dois treinos com os mesmos músculos ficam em dias seguidos: os músculos precisam de 48 horas. Se der, escolha dias alternados.');
  const foraDaSemana = ordem.slice(n).map(nome);
  if (foraDaSemana.length) avisos.push(`Com ${dias.length} ${dias.length === 1 ? 'dia' : 'dias'}, ${foraDaSemana.join(', ')} ${foraDaSemana.length === 1 ? 'fica' : 'ficam'} fora da semana. Para manter todos, escolha mais dias ou peça um plano novo ao Treinador.`);
  const sobra = dias.filter((w) => !agenda[w]);
  if (sobra.length) avisos.push(`${sobra.map((w) => DIAS[w]).join(', ')}: sem treino, para espalhar o descanso.`);
  return { agenda, linhas, avisos, foraDaSemana, dias, bloqueados: [...bloq] };
}

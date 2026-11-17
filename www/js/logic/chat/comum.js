// Peças comuns dos assuntos do chat (logic/chat/treino.js, corrida.js e o motor). Puro: sem DOM.
// Fica separado do motor para os módulos de assuntos não importarem o motor (que importa todos eles).
import { REFS } from '../../data/knowledge.js';
import { REFS_CORRIDA } from '../../data/corrida.js';

// Texto da referência (as duas listas do app: Treinador/Nutricionista e Treinador de corrida); '' se não existe.
export const textoDaRef = (k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(REFS, k) ? REFS[k] : typeof k === 'string' && Object.prototype.hasOwnProperty.call(REFS_CORRIDA, k) ? REFS_CORRIDA[k] : '');
// só as chaves que existem, sem repetir
export const refsValidas = (l) => [...new Set((Array.isArray(l) ? l : []).filter((k) => textoDaRef(k)))];

// Um item das perguntas frequentes no formato do Passo (resposta inteira, com as fontes): null se não achar a pergunta.
export function faqDe(lista, comeco) {
  const it = (Array.isArray(lista) ? lista : []).find((x) => x && typeof x.q === 'string' && x.q.startsWith(comeco));
  return it ? { q: it.q, a: [...it.a, ...(Array.isArray(it.mais) ? it.mais : [])], refs: refsValidas(it.f) } : null;
}

export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
export const virgula = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
// "1 min 30 s", "2 min", "45 s"
export function fmtDescanso(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  const m = Math.floor(s / 60), r = s % 60;
  return m && r ? `${m} min ${r} s` : m ? `${m} min` : `${r} s`;
}
// "a, b e c"
export const juntar = (l) => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]);

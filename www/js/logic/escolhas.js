// Perguntas de várias escolhas das entrevistas: o que acontece quando a pessoa toca em uma opção.
// Puro: sem DOM. Regras de cada pergunta (todas opcionais):
// - nenhum: a opção "Nenhuma" — marcada, desmarca as outras; marcar outra desmarca ela;
// - inclui: { opção: [opções que ela já cobre] } — marcar a maior tira as menores, e marcar uma menor tira a maior;
// - vale: { opção: quanto conta no limite } (padrão 1);
// - max / maxDe(respostas): limite de marcações (maxDe, quando existe, é o que vale: depende das outras respostas);
// - unidade: [singular, plural] do que se conta, para a frase da tela.
// Passando do limite, saem as marcadas há mais tempo, e o aviso diz o que saiu.

export const pesoDe = (q, v) => (q.vale && q.vale[v]) || 1;
export const somaDe = (q, lista) => (Array.isArray(lista) ? lista.reduce((s, x) => s + pesoDe(q, x), 0) : 0);

export function limiteDe(q, a) {
  if (typeof q.maxDe === 'function') {
    try { const n = q.maxDe(a); if (Number.isFinite(n) && n >= 1) return Math.min(n, q.max || n); } catch { /* respostas incompletas: vale o max fixo */ }
  }
  return q.max || 0;
}
const nomeOp = (q, v) => { const o = q.op.find((x) => x[0] === v); return o ? o[1] : v; };
const lista = (l) => l.map((x) => `“${x}”`).join(' e ');

// Marca ou desmarca `val`. Devolve { valor: nova lista, aviso: '' ou o que mudou além do toque }.
export function marcar(q, a, val) {
  let cur = Array.isArray(a[q.k]) ? a[q.k].slice() : [];
  if (val === q.nenhum) return { valor: [val], aviso: '' };
  cur = cur.filter((x) => x !== q.nenhum);
  if (cur.includes(val)) return { valor: cur.filter((x) => x !== val), aviso: '' };
  const inc = q.inclui || {};
  const tirados = [];
  for (const x of cur.slice()) {
    if ((inc[val] || []).includes(x) || (inc[x] || []).includes(val)) { cur = cur.filter((y) => y !== x); tirados.push(x); }
  }
  const max = limiteDe(q, a);
  if (max && pesoDe(q, val) > max) {
    return { valor: Array.isArray(a[q.k]) ? a[q.k].filter((x) => x !== q.nenhum) : [], aviso: `“${nomeOp(q, val)}” conta como ${pesoDe(q, val)}, e o seu limite é ${max}. Escolha um só.` };
  }
  cur.push(val);
  const saiu = [];
  if (max) while (somaDe(q, cur) > max) saiu.push(cur.shift());
  const aviso = saiu.length ? `Limite de ${max}: tirei ${lista(saiu.map((x) => nomeOp(q, x)))}.`
    : tirados.length ? `“${nomeOp(q, val)}” ${(inc[val] || []).length ? 'já inclui' : 'substitui'} ${lista(tirados.map((x) => nomeOp(q, x)))}.` : '';
  return { valor: cur, aviso };
}

// Frase embaixo das opções.
export function dicaVarios(q, a) {
  const max = limiteDe(q, a);
  if (!max) return 'Você pode marcar mais de uma opção.';
  const un = q.unidade ? ' ' + (max === 1 ? q.unidade[0] : q.unidade[1]) : '';
  const pesados = q.vale ? Object.keys(q.vale).filter((k) => q.vale[k] > 1).map((k) => nomeOp(q, k)) : [];
  const base = max === 1 ? `Você pode marcar só 1${un}` : `Você pode marcar até ${max}${un}`;
  const porque = q.maxDe && q.max && max < q.max ? ', pelo tempo de treino que você tem' : '';
  return `${base}${porque}.${pesados.length ? ` ${lista(pesados)} ${pesados.length > 1 ? 'contam' : 'conta'} como 2.` : ''}`;
}

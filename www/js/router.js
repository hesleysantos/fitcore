// Navegação entre telas (endereços do tipo #/treinos). Separado de main.js para as telas poderem importar.
let renderer = () => {};
// telas visitadas nesta abertura, na ordem; serve para saber se dá para "voltar"
const pilha = [location.hash];
window.addEventListener('hashchange', () => {
  const h = location.hash;
  if (pilha.length > 1 && pilha[pilha.length - 2] === h) pilha.pop(); // voltou (pelo app ou pelo navegador)
  else if (pilha[pilha.length - 1] !== h) pilha.push(h);
  if (pilha.length > 60) pilha.splice(0, pilha.length - 60);
});

export const setRenderer = (fn) => { renderer = fn; };
export function go(path) {
  const target = '#/' + path;
  if (location.hash === target || (path === '' && (location.hash === '' || location.hash === '#'))) { renderer(false); return; }
  location.hash = target;
}
export function replace(path) {
  pilha[pilha.length - 1] = '#/' + path;
  location.replace('#/' + path);
}
export function back(fallback = '') {
  if (pilha.length > 1) history.back(); else replace(fallback);
}
export function refresh() { renderer(true); }

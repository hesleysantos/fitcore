// Componentes visuais do boneco: animação do exercício, miniatura e mapa muscular.
import { renderFrame, paint, makeSvg, activation } from './anim/rig.js';
import { animFor } from './anim/index.js';
import { h, icon } from './ui.js';
import { state } from './store.js';

// As figuras são a demonstração do exercício: tocam sozinhas, como um vídeo curto em repetição.
// Quem preferir figuras paradas desliga em Ajustes > Aparência.
const animar = () => !state.settings || state.settings.animar !== false;
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2);

// posição do movimento (0..1) em função do tempo, com pequenas pausas nas pontas
function phaseOf(anim, ms) {
  if (anim.loop) {
    const n = anim.frames.length;
    const per = (anim.fast ? 0.42 : anim.long ? 0.85 : 0.6) * n * 1000;
    return (ms % per) / per;
  }
  const n = anim.frames.length - 1;
  const go = (anim.slow ? 1800 : anim.long ? 1300 * n : 1250) ;
  const back = (anim.slow ? 1800 : anim.long ? 1300 * n : 1650);
  const hold = anim.slow ? 100 : 320;
  const total = go + hold + back + hold;
  const x = ms % total;
  if (x < go) return ease(x / go);
  if (x < go + hold) return 1;
  if (x < go + hold + back) return 1 - ease((x - go - hold) / back);
  return 0;
}

// Economia de bateria: a figura é redesenhada a ~30 quadros por segundo (o movimento é lento; 60 não muda nada
// à vista e dobra o trabalho) e o laço para de vez quando nenhuma figura está visível e tocando.
const QUADRO_FIG_MS = 30;
const running = new Set();
let rafId = 0;
const ativa = (f) => f.visible && !f.paused;
function tick(now) {
  rafId = 0;
  let alguma = false;
  for (const f of running) {
    if (!f.svg.isConnected) { running.delete(f); continue; }
    if (!ativa(f)) continue;
    alguma = true;
    if (now - f.last < QUADRO_FIG_MS) continue;
    f.ms += Math.min(100, now - f.last);
    f.last = now;
    paint(f.svg, renderFrame(f.anim, f.act, phaseOf(f.anim, f.ms)));
  }
  if (alguma) rafId = requestAnimationFrame(tick);
}
function acordar() {
  if (rafId) return;
  for (const f of running) if (f.svg.isConnected && ativa(f)) { rafId = requestAnimationFrame(tick); return; }
}
function start(f) {
  running.add(f);
  f.last = performance.now();
  acordar();
}
const io = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      const f = e.target.__fig;
      if (!f) continue;
      f.visible = e.isIntersecting;
      if (f.visible) { f.last = performance.now(); acordar(); }
    }
  }, { rootMargin: '80px' })
  : null;
document.addEventListener('visibilitychange', () => { const n = performance.now(); for (const f of running) f.last = n; if (document.visibilityState === 'visible') acordar(); });

// Figura animada do exercício, com botão de pausar.
export function figure(ex, { controls = true } = {}) {
  const anim = animFor(ex);
  const act = activation(ex);
  const svg = makeSvg(null, anim);
  svg.setAttribute('role', 'img');
  svg.removeAttribute('aria-hidden');
  svg.setAttribute('aria-label', 'Demonstração do movimento: ' + ex.nome);
  const f = { svg, anim, act, ms: 0, last: 0, visible: true, paused: !animar() };
  svg.__fig = f;
  paint(svg, renderFrame(anim, act, 0));
  if (io) io.observe(svg);
  start(f);
  const box = h('div', { class: 'figbox' }, svg);
  if (anim.label) box.appendChild(h('span', { class: 'figlabel', text: anim.label }));
  if (controls) {
    const b = h('button', { class: 'iconbtn', type: 'button' });
    const sync = () => {
      while (b.firstChild) b.removeChild(b.firstChild);
      b.appendChild(icon(f.paused ? 'play' : 'pause'));
      b.setAttribute('aria-label', f.paused ? 'Reproduzir animação' : 'Pausar animação');
    };
    b.addEventListener('click', () => { f.paused = !f.paused; f.last = performance.now(); sync(); acordar(); });
    sync();
    box.appendChild(h('div', { class: 'figctl' }, b));
  }
  return box;
}

// Miniatura das listas: também se mexe, em ritmo de gif (poucos quadros por segundo, guardados em memória),
// e só enquanto está visível na tela.
const PASSOS = 12;
const QUADRO_MS = 85;
const cache = new Map(); // id do exercício -> quadros já calculados
function quadro(d, k) {
  let fr = cache.get(d.id);
  if (!fr) {
    if (cache.size >= 60) cache.delete(cache.keys().next().value);
    fr = [];
    cache.set(d.id, fr);
  }
  return fr[k] || (fr[k] = renderFrame(d.anim, d.act, k / PASSOS));
}
const minis = new Set();
let miniRaf = 0; // diferente de zero enquanto há um próximo quadro agendado
function miniTick(now) {
  for (const d of minis) {
    if (!d.svg.isConnected) { minis.delete(d); continue; }
    const k = Math.min(PASSOS - (d.anim.loop ? 1 : 0), Math.round(phaseOf(d.anim, now - d.t0) * PASSOS));
    if (k !== d.k) { d.k = k; paint(d.svg, quadro(d, k)); }
  }
  miniRaf = 0;
  agendarMinis();
}
function agendarMinis() {
  if (miniRaf || !minis.size) return;
  // espera o intervalo e só então pede um quadro à tela (que não vem se o app estiver em segundo plano)
  miniRaf = setTimeout(() => { miniRaf = requestAnimationFrame(miniTick); }, QUADRO_MS);
}
const lazy = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      const d = e.target.__thumb;
      if (!d) continue;
      if (e.isIntersecting) {
        if (!d.pintado) { d.pintado = true; paint(d.svg, renderFrame(d.anim, d.act, d.t)); }
        if (animar() && d.anim.frames.length > 1) {
          d.t0 = performance.now(); d.k = -1;
          minis.add(d);
          agendarMinis();
        }
      } else {
        minis.delete(d);
      }
    }
  }, { rootMargin: '60px' })
  : null;
let imediatas = 0;
let zerar = 0;
export function thumb(ex) {
  const anim = animFor(ex);
  const svg = makeSvg(null, anim);
  const d = { svg, id: ex.id, anim, act: activation(ex), t: anim.loop ? 0 : 0.55, pintado: false, t0: 0, k: -1 };
  // as primeiras miniaturas de cada tela são desenhadas na hora; as demais, quando entram na área visível
  if (!lazy || imediatas < 8) {
    imediatas++;
    if (!zerar) zerar = setTimeout(() => { imediatas = 0; zerar = 0; }, 0);
    d.pintado = true;
    paint(svg, renderFrame(d.anim, d.act, d.t));
  }
  if (lazy) { svg.__thumb = d; lazy.observe(svg); }
  return svg;
}

// Mapa muscular: corpo de frente e de costas com os músculos trabalhados em destaque.
const STAND = { arm: { a: 20, b: 13 }, leg: { a: 6, b: 3 } };
const MAP_FRONT = { view: 'front', frames: [STAND], equip: [], floor: false };
const MAP_BACK = { view: 'back', frames: [STAND], equip: [], floor: false };
export function muscleMap(exOrAct) {
  const act = exOrAct.primarios ? activation(exOrAct) : exOrAct;
  const mk = (anim, label) => {
    const svg = makeSvg(null, null);
    svg.setAttribute('viewBox', '68 28 64 96');
    paint(svg, renderFrame(anim, act, 0));
    return h('div', null, svg, label);
  };
  return h('div', { class: 'musclemap' }, mk(MAP_FRONT, 'Frente'), mk(MAP_BACK, 'Costas'));
}

// Galeria de conferência visual das animações (uso interno de desenvolvimento).
// /tools/gallery.html?g=peito&cols=4&frames=0,1&from=0&n=20&live=1
import { renderFrame, paint, makeSvg, activation, juntasEm } from '/js/anim/rig.js';
import { EXERCICIOS } from '/js/data/exercises.js';
import { animFor } from '/js/anim/index.js';

const q = new URLSearchParams(location.search);
const g = q.get('g');
const cols = Number(q.get('cols')) || 4;
const ts = (q.get('frames') || '0,1').split(',').map(Number);
const from = Number(q.get('from')) || 0;
const n = Number(q.get('n')) || 999;
const live = q.get('live') === '1';
const only = q.get('id');
const foco = q.get('foco');

document.documentElement.style.setProperty('--cols', String(cols));
const grid = document.getElementById('grid');
let list = EXERCICIOS.filter((e) => (!g || e.grupo === g) && (!only || only.split(',').includes(e.id)));
const vistas = q.get('v');
if (vistas) list = list.filter((e) => vistas.split(',').includes(animFor(e).view || 'side'));
list = list.slice(from, from + n);
const lives = [];
for (const ex of list) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  const h = document.createElement('h4');
  h.textContent = ex.nome;
  cell.appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  cell.appendChild(row);
  try {
    const anim = animFor(ex);
    const act = activation(ex);
    if (live) {
      const svg = makeSvg(null, anim);
      row.appendChild(svg);
      lives.push({ svg, anim, act });
    } else {
      for (const t of ts) {
        const svg = makeSvg(null, anim);
        paint(svg, renderFrame(anim, act, t));
        // foco=mao (ou maoL, maoF): aproxima o desenho na mão, para conferir dedos e pegada
        if (foco) {
          const { J, chao, view } = juntasEm(anim, t);
          // foco=mao | maoF | maoL (mão de cá, de lá, esquerda) ou foco=pe | peF | peL (pé)
          const outro = /F$|L$/.test(foco);
          const k = view === 'side' ? (outro ? 'F' : 'N') : (outro ? 'L' : 'R');
          const p = foco.startsWith('pe') ? J['an' + k] : J['hand' + k];
          const m = Number(q.get('raio')) || 13;
          svg.setAttribute('viewBox', `${p[0] - m} ${chao - p[1] - m} ${2 * m} ${2 * m}`);
        }
        row.appendChild(svg);
      }
    }
    if (anim.label) { const s = document.createElement('small'); s.textContent = anim.label; s.style.color = '#8b95a8'; cell.appendChild(s); }
  } catch (err) {
    const s = document.createElement('small');
    s.textContent = String(err && err.message);
    cell.appendChild(s);
  }
  grid.appendChild(cell);
}
if (live) {
  const t0 = performance.now();
  const tick = (now) => {
    const ph = ((now - t0) / 3000) % 1;
    for (const l of lives) {
      const t = l.anim.loop ? ph : (ph < 0.5 ? ph * 2 : 2 - ph * 2);
      paint(l.svg, renderFrame(l.anim, l.act, t));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Gráficos simples em SVG (sem bibliotecas externas).
import { SVG_NS } from '../ui.js';

const el = (tag, attrs, text) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k of Object.keys(attrs)) e.setAttribute(k, String(attrs[k]));
  if (text != null) e.textContent = text;
  return e;
};
const W = 320, H = 150, PL = 34, PR = 8, PT = 10, PB = 22;
const fmt = (n) => (n >= 10000 ? Math.round(n / 1000) + ' mil' : n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + ' mil' : String(Math.round(n * 10) / 10).replace('.', ','));

function base(max, min, label) {
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': label });
  for (let i = 0; i <= 2; i++) {
    const y = PT + ((H - PT - PB) * i) / 2;
    svg.appendChild(el('line', { x1: PL, y1: y, x2: W - PR, y2: y, class: 'ax' }));
    svg.appendChild(el('text', { x: PL - 4, y: y + 3, 'text-anchor': 'end' }, fmt(max - ((max - min) * i) / 2)));
  }
  return svg;
}

export function barChart(data, label = 'Gráfico de barras') {
  const max = Math.max(1, ...data.map((d) => d.value)) * 1.08;
  const svg = base(max, 0, label);
  const bw = (W - PL - PR) / data.length;
  data.forEach((d, i) => {
    const hgt = ((H - PT - PB) * d.value) / max;
    if (d.value > 0) svg.appendChild(el('rect', { x: PL + i * bw + bw * 0.18, y: H - PB - hgt, width: bw * 0.64, height: Math.max(1, hgt), rx: 3, class: 'bar' }));
    svg.appendChild(el('text', { x: PL + i * bw + bw / 2, y: H - 7, 'text-anchor': 'middle' }, d.label));
  });
  return svg;
}

export function lineChart(points, label = 'Gráfico de linha') {
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 1) { max += 1; min -= 1; }
  const padv = (max - min) * 0.12;
  max += padv; min = Math.max(0, min - padv);
  const svg = base(max, min, label);
  const n = points.length;
  const x = (i) => (n === 1 ? (PL + W - PR) / 2 : PL + 6 + ((W - PL - PR - 12) * i) / (n - 1));
  const y = (v) => PT + ((H - PT - PB) * (max - v)) / (max - min);
  if (n > 1) svg.appendChild(el('path', { d: 'M' + points.map((p, i) => `${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join('L'), class: 'ln' }));
  const step = Math.max(1, Math.ceil(n / 6));
  points.forEach((p, i) => {
    svg.appendChild(el('circle', { cx: x(i), cy: y(p.value), r: 3, class: 'pt' }));
    if (i % step === 0 || i === n - 1) svg.appendChild(el('text', { x: x(i), y: H - 7, 'text-anchor': 'middle' }, p.label));
  });
  return svg;
}

// barras horizontais com rótulo à esquerda e, se informada, a faixa ideal ao fundo
export function hbarChart(rows, { faixa = null, label = 'Gráfico de barras horizontais' } = {}) {
  const LH = 22, LW = 92, VW = 30;
  const alt = rows.length * LH + (faixa ? 18 : 2);
  const max = Math.max(faixa ? faixa[1] * 1.15 : 1, ...rows.map((r) => r.value));
  const svg = el('svg', { viewBox: `0 0 ${W} ${alt}`, class: 'chart', role: 'img', 'aria-label': label });
  const x = (v) => LW + ((W - LW - VW) * v) / max;
  if (faixa) {
    svg.appendChild(el('rect', { x: x(faixa[0]), y: 0, width: x(faixa[1]) - x(faixa[0]), height: rows.length * LH, rx: 3, class: 'zona' }));
    svg.appendChild(el('text', { x: (x(faixa[0]) + x(faixa[1])) / 2, y: alt - 4, 'text-anchor': 'middle' }, `ideal: ${faixa[0]} a ${faixa[1]}`));
  }
  rows.forEach((r, i) => {
    const y = i * LH;
    svg.appendChild(el('text', { x: LW - 6, y: y + 14, 'text-anchor': 'end', class: 'lb' }, r.label));
    svg.appendChild(el('rect', { x: LW, y: y + 5, width: Math.max(1.5, x(r.value) - LW), height: 11, rx: 3, class: 'bar' + (r.cls ? ' ' + r.cls : '') }));
    svg.appendChild(el('text', { x: x(r.value) + 4, y: y + 14 }, fmt(r.value)));
  });
  return svg;
}

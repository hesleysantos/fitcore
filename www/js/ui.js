// Utilitários de interface. Todo o DOM é criado por createElement/textContent —
// nunca por innerHTML — para que nenhum texto digitado pelo usuário vire código.

const BLOCKED = new Set(['innerHTML', 'outerHTML', 'srcdoc', 'style']);
const SVG_NS = 'http://www.w3.org/2000/svg';
// endereços permitidos em links e imagens: só rotas internas (#/...), arquivos do próprio app e blob: (download do backup)
const URL_OK = /^(#|blob:|(?![a-z][a-z0-9+.-]*:)(?!\/\/)[\w./?=&%-]+$)/i;

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v == null || v === false || BLOCKED.has(k)) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'dataset') { for (const d of Object.keys(v)) el.dataset[d] = v[d]; }
      else if (k.startsWith('on')) { if (typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v); }
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'open') el[k] = v;
      else if (k === 'href' || k === 'src' || k === 'action' || k === 'formaction') { if (URL_OK.test(String(v))) el.setAttribute(k, String(v)); }
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  add(el, kids);
  return el;
}
export function add(el, kids) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) add(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

// ---------- ícones (traços simples) ----------
const ICONS = {
  home: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  dumbbell: ['M6.5 6.5v11', 'M17.5 6.5v11', 'M3 9v6', 'M21 9v6', 'M6.5 12h11'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  coach: ['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1', 'M16 3l1.5 1.5L20 2'],
  apple: ['M12 7c-1-2.5-4-3-6-1.5S3 10 4 14s3 7 5 7 2-1 3-1 1 1 3 1 4-3 5-7-1-7-3-8.5-4-.5-5 1.5z', 'M12 7c0-2 1-4 3-5'],
  search: ['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4.3-4.3'],
  back: ['M15 5l-7 7 7 7'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  play: ['M7 4.5v15l12-7.5z'],
  pause: ['M8 5v14', 'M16 5v14'],
  settings: ['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.8 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003.1 14H3a2 2 0 110-4h.1a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z'],
  chart: ['M4 20V4', 'M4 20h16', 'M8 16v-5', 'M12 16V8', 'M16 16v-3'],
  history: ['M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8', 'M3 3v5h5', 'M12 7v5l3 2'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  edit: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13.5 6.5l4 4'],
  up: ['M6 15l6-6 6 6'],
  down: ['M6 9l6 6 6-6'],
  right: ['M9 5l7 7-7 7'],
  swap: ['M7 4L3 8l4 4', 'M3 8h14', 'M17 20l4-4-4-4', 'M21 16H7'],
  info: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 11v6', 'M12 7.5h.01'],
  warn: ['M12 3l10 18H2L12 3z', 'M12 10v5', 'M12 18h.01'],
  timer: ['M12 21a8 8 0 100-16 8 8 0 000 16z', 'M12 9v4l2.5 2', 'M9 2h6'],
  flame: ['M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 2-3 2 0-3-1-6-4-8 0 4-4 6-4 12 0 4 3 8 7 8z'],
  trophy: ['M8 4h8v5a4 4 0 01-8 0V4z', 'M8 6H4v1a4 4 0 004 4', 'M16 6h4v1a4 4 0 01-4 4', 'M12 13v4', 'M8 21h8', 'M10 17h4v4h-4z'],
  calendar: ['M4 6h16v15H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  filter: ['M3 5h18l-7 9v6l-4-2v-4L3 5z'],
  building: ['M4 21V5l8-2v18', 'M12 9h8v12', 'M2 21h20', 'M7 8h2', 'M7 12h2', 'M7 16h2', 'M15 13h2', 'M15 17h2'],
  download: ['M12 4v11', 'M7 11l5 5 5-5', 'M4 20h16'],
  upload: ['M12 16V5', 'M7 9l5-5 5 5', 'M4 20h16'],
  share: ['M12 15V3', 'M8 7l4-4 4 4', 'M6 11H5v10h14V11h-1'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z', 'M9 12l2 2 4-4'],
  book: ['M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z', 'M5 17a3 3 0 013-3h11'],
  heart: ['M12 20s-7-4.5-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.5-9 9-9 9z'],
  water: ['M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z'],
  moon: ['M20 14A8 8 0 019.5 4 8 8 0 1020 14z'],
  user: ['M12 12a4 4 0 100-8 4 4 0 000 8z', 'M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  refresh: ['M20 11A8 8 0 006 6.3L4 8', 'M4 4v4h4', 'M4 13a8 8 0 0014 4.7l2-1.7', 'M20 20v-4h-4'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7l1-8z'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.200 9.500l6.100-.900z'],
  phone: ['M7 2h10v20H7z', 'M11 18h2'],
  food: ['M5 3v7a3 3 0 006 0V3', 'M8 3v18', 'M17 3c-2 2-3 5-3 8h3v10'],
  sound: ['M4 9v6h4l5 4V5L8 9H4z', 'M16.5 8.500a5 5 0 010 7'],
};
export function icon(name, cls) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name] || ICONS.info) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

// ---------- componentes ----------
export const btn = (label, onClick, cls = '', ic) => h('button', { class: 'btn ' + cls, type: 'button', onClick }, ic ? icon(ic) : null, label);
export const iconBtn = (ic, label, onClick, cls = '') => h('button', { class: 'iconbtn ' + cls, type: 'button', 'aria-label': label, title: label, onClick }, icon(ic));
export const note = (kind, text, ic) => h('div', { class: 'note ' + kind }, icon(ic || (kind === 'info' ? 'info' : kind === 'ok' ? 'check' : 'warn')), h('div', null, text));
export const badge = (text, cls = '') => h('span', { class: 'badge ' + cls, text });
export const sectionTitle = (text, action) => h('div', { class: 'section-title' }, h('h2', { text }), action || null);

export function chip(label, on, onClick) {
  return h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', onClick }, label);
}
export function toggle(checked, onChange, label) {
  const input = h('input', { type: 'checkbox', checked, 'aria-label': label, onChange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'switch' }, input, h('i'));
}
export function seg(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'tablist' });
  for (const [val, label] of options) {
    wrap.appendChild(h('button', { type: 'button', class: val === value ? 'on' : '', role: 'tab', 'aria-selected': val === value ? 'true' : 'false', onClick: () => onChange(val) }, label));
  }
  return wrap;
}
// campo numérico com − e +
export function stepper({ value, min = 0, max = 999, step = 1, onChange, cls = '', label, decimals = 0 }) {
  const fmt = (n) => (decimals ? String(Math.round(n * 10 ** decimals) / 10 ** decimals).replace('.', ',') : String(Math.round(n)));
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const input = h('input', { type: 'text', inputmode: decimals ? 'decimal' : 'numeric', value: fmt(value), 'aria-label': label, autocomplete: 'off' });
  let cur = value;
  const set = (n, silent) => { cur = clamp(n); input.value = fmt(cur); if (!silent) onChange(cur); };
  input.addEventListener('change', () => { const n = parseNum(input.value); set(Number.isFinite(n) ? n : cur); });
  input.addEventListener('focus', () => input.select());
  return h('div', { class: 'stepper ' + cls },
    h('button', { type: 'button', 'aria-label': 'Diminuir ' + (label || ''), onClick: () => set(cur - step) }, '−'),
    input,
    h('button', { type: 'button', 'aria-label': 'Aumentar ' + (label || ''), onClick: () => set(cur + step) }, '+'));
}
export function parseNum(s) {
  const txt = String(s).trim().replace(',', '.');
  if (!txt) return NaN;
  const n = Number(txt);
  return Number.isFinite(n) ? n : NaN;
}

// ---------- folha inferior / diálogos ----------
let openSheets = 0;
export function sheet({ title, body, footer, full = false, onClose }) {
  const bd = h('div', { class: 'sheet-bd' });
  add(bd, [body]);
  const closeBtn = iconBtn('close', 'Fechar', () => close());
  const sh = h('div', { class: 'sheet' + (full ? ' full' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-hd' }, h('h2', { text: title }), closeBtn), bd);
  let ft = null;
  if (footer) { ft = h('div', { class: 'sheet-ft' }); add(ft, [footer]); sh.appendChild(ft); }
  const back = h('div', { class: 'backdrop' }, sh);
  const prevFocus = document.activeElement;
  function close(result) {
    if (!back.isConnected) return;
    back.remove();
    openSheets--;
    if (!openSheets) document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', onNav);
    if (prevFocus && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch { /* ignore */ } }
    if (onClose) onClose(result);
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const onNav = () => close();
  window.addEventListener('hashchange', onNav);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  openSheets++;
  document.body.classList.add('modal-open');
  closeBtn.focus({ preventScroll: true });
  return { close, body: bd, el: sh, footer: ft };
}
export function confirmSheet({ title, text, okLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const s = sheet({
      title,
      body: h('p', { text }),
      footer: [
        btn(cancelLabel, () => s.close(false), 'ghost'),
        btn(okLabel, () => { done = true; s.close(true); }, danger ? 'danger' : 'primary'),
      ],
      onClose: (r) => resolve(done && r === true),
    });
  });
}
export function promptSheet({ title, label, value = '', okLabel = 'Salvar', maxLength = 60, placeholder = '' }) {
  return new Promise((resolve) => {
    let result = null;
    const input = h('input', { class: 'input', type: 'text', value, maxlength: maxLength, placeholder, autocomplete: 'off' });
    const ok = () => { const v = input.value.trim().slice(0, maxLength); if (v) { result = v; s.close(); } else { toast('Digite um nome.'); input.focus(); } };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    const s = sheet({
      title,
      body: h('label', { class: 'field' }, h('span', { text: label }), input),
      footer: [btn('Cancelar', () => s.close(), 'ghost'), btn(okLabel, ok, 'primary')],
      onClose: () => resolve(result),
    });
    setTimeout(() => input.focus(), 50);
  });
}
let toastEl = null;
let toastT = 0;
export function toast(text) {
  if (toastEl) toastEl.remove();
  toastEl = h('div', { class: 'toast', role: 'status', text });
  document.body.appendChild(toastEl);
  clearTimeout(toastT);
  toastT = setTimeout(() => { if (toastEl) { toastEl.remove(); toastEl = null; } }, 2600);
}

// ---------- formatação ----------
export const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const fmtKg = (n) => (n == null || !Number.isFinite(n) ? '–' : String(Math.round(n * 100) / 100).replace('.', ','));
export const fmtInt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('pt-BR') : '–');
export const pad2 = (n) => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const hh = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return hh ? `${hh}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}
export function fmtDur(sec) {
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad2(m % 60)} min`;
}
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DIAS_LONGO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export function fmtDate(iso, withYear = false) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const base = `${DIAS[d.getDay()]}, ${d.getDate()}/${pad2(d.getMonth() + 1)}`;
  return withYear ? `${base}/${d.getFullYear()}` : base;
}
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : Math.random().toString(36).slice(2) + Date.now().toString(36));
export { SVG_NS };

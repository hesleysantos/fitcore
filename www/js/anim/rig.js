// Boneco articulado em SVG. Duas vistas: lateral ('side') e frontal/costas ('front'/'back').
// Mundo: x para a direita, y para cima, chão em y = 0. O boneco de lado olha para +x.
// Poses usam ângulos absolutos (graus a partir de "para baixo", positivo = para a frente/para fora)
// ou alvos de mão/pé resolvidos por cinemática inversa.
import { L, D2R, add, sub, norm, lerp, lerpP, limbDir, angOf } from './geom.js';
import { drawSide, drawFront } from './body.js';
import { drawEquip } from './equip.js';
import { pegadasLado, pegadasFrente, maosPorCima } from './maos.js';

export const VW = 200;
export const VH = 132;
export const FLOOR = 122;
export const STAND_HIP = L.ankle + L.shin + L.thigh;
const f1 = (n) => (Math.round(n * 10) / 10).toString();

function ik(root, target, l1, l2, bend) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = Math.hypot(dx, dy) || 1e-6;
  const dc = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, d));
  const ux = dx / d;
  const uy = dy / d;
  const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [
    [root[0] + ux * a - uy * h * bend, root[1] + uy * a + ux * h * bend],
    [root[0] + ux * dc, root[1] + uy * dc],
  ];
}

// ---------- saída de formas ----------
class Out {
  constructor() { this.s = []; this.bb = [1e9, 1e9, -1e9, -1e9]; this.g = null; this.cp = null; }
  add(shape) { if (this.cp) shape.cp = this.cp; this.s.push(shape); }
  // Recorte: as formas desenhadas dentro de fn viram uma região (a união delas) com o nome dado.
  // Depois, tudo o que for desenhado dentro de dentroDe(nome, ...) só aparece dentro dessa região.
  // É assim que a roupa nunca passa do contorno do corpo, em qualquer pose.
  recorte(nome, fn) {
    const antes = this.g;
    this.g = { t: 'clipPath', n: nome, d: '' };
    fn();
    const g = this.g;
    this.g = antes;
    if (g.d) this.s.push(g);
  }
  dentroDe(nome, fn) { const antes = this.cp; this.cp = nome; fn(); this.cp = antes; }
  // Grupo: várias formas viram um único contorno (a união delas), sem riscos por dentro.
  begin(c) { this.g = { t: 'path', d: '', c }; }
  end() { const g = this.g; this.g = null; if (g && g.d) this.add(g); }
  grow(x, y, r = 0) {
    const b = this.bb;
    if (x - r < b[0]) b[0] = x - r;
    if (y - r < b[1]) b[1] = y - r;
    if (x + r > b[2]) b[2] = x + r;
    if (y + r > b[3]) b[3] = y + r;
  }
  pt(p) { this.grow(p[0], FLOOR - p[1], 1); return f1(p[0]) + ' ' + f1(FLOOR - p[1]); }
  circ(p, r, c) {
    if (this.g) {
      const pts = [];
      for (let i = 0; i < 8; i++) pts.push([p[0] + Math.cos(i * Math.PI / 4) * r, p[1] + Math.sin(i * Math.PI / 4) * r]);
      this.smooth(pts, c);
      return;
    }
    this.grow(p[0], FLOOR - p[1], r); this.add({ t: 'circle', cx: f1(p[0]), cy: f1(FLOOR - p[1]), r: f1(r), c }); }
  line(a, b, c, w) {
    this.grow(a[0], FLOOR - a[1], 1); this.grow(b[0], FLOOR - b[1], 1);
    this.add({ t: 'line', x1: f1(a[0]), y1: f1(FLOOR - a[1]), x2: f1(b[0]), y2: f1(FLOOR - b[1]), c, w: f1(w) });
  }
  poly(pts, c, w) {
    const o = { t: 'path', d: 'M' + pts.map((p) => this.pt(p)).join('L') + 'Z', c };
    if (w) o.w = f1(w);
    this.add(o);
  }
  open(pts, c, w) {
    this.add({ t: 'path', d: 'M' + pts.map((p) => this.pt(p)).join('L'), c, w: f1(w) });
  }
  // contorno fechado e suave (Catmull-Rom) passando pelos pontos
  smooth(pts, c) {
    const n = pts.length;
    if (n < 3) return;
    if (this.g) {
      // mesmo sentido de giro em todas as formas do grupo, para a união não abrir buracos
      let ar = 0;
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; }
      if (ar < 0) pts = pts.slice().reverse();
    }
    let d = 'M' + this.pt(pts[0]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + this.pt(c1) + ' ' + this.pt(c2) + ' ' + this.pt(p2);
    }
    if (this.g) this.g.d += d + 'Z';
    else this.add({ t: 'path', d: d + 'Z', c });
  }
  // cápsula afunilada de a (raio ra) até b (raio rb)
  cap(a, b, ra, rb, c) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.05) { this.circ(a, Math.max(ra, rb), c); return; }
    if (this.g) {
      const ang = Math.atan2(dy, dx);
      const pts = [];
      for (let i = 0; i <= 4; i++) { const t = ang + Math.PI / 2 + (i * Math.PI) / 4; pts.push([a[0] + Math.cos(t) * ra, a[1] + Math.sin(t) * ra]); }
      for (let i = 0; i <= 4; i++) { const t = ang - Math.PI / 2 + (i * Math.PI) / 4; pts.push([b[0] + Math.cos(t) * rb, b[1] + Math.sin(t) * rb]); }
      this.smooth(pts, c);
      return;
    }
    this.grow(a[0], FLOOR - a[1], ra); this.grow(b[0], FLOOR - b[1], rb);
    const n = [-dy / len, dx / len];
    const p1 = add(a, n, ra), p2 = add(b, n, rb), p3 = add(b, n, -rb), p4 = add(a, n, -ra);
    const d = `M${this.pt(p1)}L${this.pt(p2)}A${f1(rb)} ${f1(rb)} 0 0 1 ${this.pt(p3)}L${this.pt(p4)}A${f1(ra)} ${f1(ra)} 0 0 1 ${this.pt(p1)}Z`;
    this.add({ t: 'path', d, c });
  }
}

// ---------- vista lateral ----------
function sideRoots(p) {
  const hip = p.hip || [100, STAND_HIP];
  const t = (p.torso || 0) * D2R;
  const up = [Math.sin(t), Math.cos(t)];
  return { hip, up, sh: add(hip, up, L.torso * (p.lt ?? 1) + (p.sy || 0)) };
}

function solveArm(root, spec, bendDef) {
  const la = L.upper * (spec.la ?? 1);
  const lb = L.fore * (spec.lb ?? 1);
  if (spec.hand) {
    const [el, wr] = ik(root, spec.hand, la, lb, spec.bend ?? bendDef);
    return { el, wr };
  }
  const el = add(root, limbDir(spec.a ?? 0), la);
  return { el, wr: add(el, limbDir(spec.b ?? spec.a ?? 0), lb) };
}
function solveLeg(root, spec, bendDef) {
  const la = L.thigh * (spec.la ?? 1);
  const lb = L.shin * (spec.lb ?? 1);
  if (spec.foot) {
    const [kn, an] = ik(root, spec.foot, la, lb, spec.bend ?? bendDef);
    return { kn, an };
  }
  const kn = add(root, limbDir(spec.a ?? 0), la);
  return { kn, an: add(kn, limbDir(spec.b ?? spec.a ?? 0), lb) };
}

// alvo de mão relativo ao tronco: rel = [para a frente, para cima] a partir do ombro
function relArm(spec, sh, up) {
  if (!spec.rel) return spec;
  return { ...spec, hand: add(add(sh, [up[1], -up[0]], spec.rel[0]), up, spec.rel[1]) };
}
const DEF_ARM = { a: 0, b: 6 };
const DEF_LEG = { a: 0, b: 0 };

export function solveSide(p) {
  const { hip, up, sh } = sideRoots(p);
  const hd = ((p.torso || 0) + (p.head || 0)) * D2R;
  const hup = [Math.sin(hd), Math.cos(hd)];
  const neck = add(sh, up, L.neck * 0.4);
  const head = add(add(sh, up, L.neck), hup, L.head);
  const J = { hip, sh, up, neck, head, hup };
  for (const k of ['N', 'F']) {
    const as = relArm(p['arm' + k] || p.arm || DEF_ARM, sh, up);
    const a = solveArm(sh, as, -1);
    let fd = norm(sub(a.wr, a.el));
    if (as.hf) {
      const r = as.hf * D2R;
      fd = [fd[0] * Math.cos(r) - fd[1] * Math.sin(r), fd[0] * Math.sin(r) + fd[1] * Math.cos(r)];
    }
    J['el' + k] = a.el; J['wr' + k] = a.wr; J['hand' + k] = add(a.wr, fd, L.hand * (as.hf != null ? 1.7 : 1)); J['hd' + k] = fd;
    const ls = p['leg' + k] || p.leg || DEF_LEG;
    const g = solveLeg(hip, ls, 1);
    J['kn' + k] = g.kn; J['an' + k] = g.an;
    // pé: plantado (IK) fica plano; solto (FK) acompanha a canela
    let fa;
    if (ls.footAng != null) fa = ls.footAng;
    else if (ls.foot) fa = 0;
    else fa = -angOf(sub(g.an, g.kn));
    const fdir = [Math.cos(fa * D2R), -Math.sin(fa * D2R)];
    const dn = [-fdir[1], fdir[0]]; // perpendicular "sola"
    const sole = add(g.an, dn, -L.ankle * 0.55);
    J['toe' + k] = add(sole, fdir, L.foot * 0.68);
    J['heel' + k] = add(sole, fdir, -L.foot * 0.26);
    J['fd' + k] = fdir; J['fu' + k] = dn;
  }
  return J;
}


// ---------- vista frontal / costas ----------
export function solveFront(p) {
  const hc = p.hip || [100, STAND_HIP];
  const tilt = (p.tilt || 0) * D2R;
  const up = [Math.sin(tilt), Math.cos(tilt)];
  const rt = [Math.cos(tilt), -Math.sin(tilt)];
  const chest = add(hc, up, L.torso * (p.lt ?? 1));
  const head = add(chest, up, L.neck + L.head);
  const J = { hc, chest, up, rt, head };
  for (const [sd, sg] of [['R', 1], ['L', -1]]) {
    const sh = add(add(chest, rt, sg * L.shw), up, p.sy || 0);
    const hj = add(hc, rt, sg * L.hpw);
    const loc = (q) => [sg * (q[0] - hc[0]), q[1]];
    const wld = (q) => [hc[0] + sg * q[0], q[1]];
    const as = p['arm' + sd] || p.arm || { a: 10, b: 6 };
    const aspec = as.hand ? { ...as, hand: [as.hand[0], as.hand[1]] } : as;
    const a = solveArm(loc(sh), aspec, -1);
    const ls = p['leg' + sd] || p.leg || { a: 4, b: 2 };
    const g = solveLeg(loc(hj), ls, 1);
    J['sh' + sd] = sh; J['hj' + sd] = hj;
    J['el' + sd] = wld(a.el); J['wr' + sd] = wld(a.wr);
    const fd = norm(sub(a.wr, a.el));
    J['hd' + sd] = [sg * fd[0], fd[1]];
    J['hand' + sd] = wld(add(a.wr, fd, L.hand * Math.min(1, Math.abs(as.lb ?? 1) + 0.25)));
    J['kn' + sd] = wld(g.kn); J['an' + sd] = wld(g.an);
  }
  return J;
}


// ---------- interpolação de poses ----------
function limbSpec(p, base, key) { return p[base + key] || p[base]; }

function lerpLimb(a, b, t, kind, RA, RB) {
  const tgt = kind === 'arm' ? 'hand' : 'foot';
  if (!a && !b) return undefined;
  a = a || b; b = b || a;
  const rootA = RA.root, rootB = RB.root;
  const out = {};
  if (a.hf != null || b.hf != null) out.hf = lerp(a.hf ?? 0, b.hf ?? 0, t);
  if (a.rel && b.rel) {
    out.rel = lerpP(a.rel, b.rel, t);
    if (a.bend != null) out.bend = a.bend;
    if (a.la != null || b.la != null) out.la = lerp(a.la ?? 1, b.la ?? 1, t);
    if (a.lb != null || b.lb != null) out.lb = lerp(a.lb ?? 1, b.lb ?? 1, t);
    return out;
  }
  if (a.rel) a = relArm(a, rootA, RA.up);
  if (b.rel) b = relArm(b, rootB, RB.up);
  if (a.la != null || b.la != null) out.la = lerp(a.la ?? 1, b.la ?? 1, t);
  if (a.lb != null || b.lb != null) out.lb = lerp(a.lb ?? 1, b.lb ?? 1, t);
  // ângulo do pé de cada quadro: o informado; senão, plano se estiver apoiado (alvo) ou acompanhando a canela se estiver solto
  const pe = (s) => s.footAng ?? (s[tgt] ? 0 : -(s.b ?? s.a ?? 0));
  if (kind === 'leg' && (a.footAng != null || b.footAng != null)) out.footAng = lerp(pe(a), pe(b), t);
  if (a[tgt] && b[tgt]) {
    out[tgt] = lerpP(a[tgt], b[tgt], t);
    if (a.bend != null) out.bend = a.bend;
    return out;
  }
  const toAng = (s, root) => {
    if (!s[tgt]) return [s.a ?? 0, s.b ?? s.a ?? 0];
    const r = kind === 'arm' ? solveArm(root, s, -1) : solveLeg(root, s, 1);
    const mid = kind === 'arm' ? r.el : r.kn;
    const end = kind === 'arm' ? r.wr : r.an;
    return [angOf(sub(mid, root)), angOf(sub(end, mid))];
  };
  const A = toAng(a, rootA), B = toAng(b, rootB);
  out.a = lerp(A[0], B[0], t);
  out.b = lerp(A[1], B[1], t);
  if (out.footAng == null && kind === 'leg' && (a.foot || b.foot)) out.footAng = lerp(a.foot ? 0 : -angOf(limbDir(A[1])), b.foot ? 0 : -angOf(limbDir(B[1])), t);
  return out;
}

export function lerpPose(A, B, t, view) {
  const P = {
    hip: lerpP(A.hip || [100, STAND_HIP], B.hip || [100, STAND_HIP], t),
    torso: lerp(A.torso || 0, B.torso || 0, t),
    head: lerp(A.head || 0, B.head || 0, t),
    tilt: lerp(A.tilt || 0, B.tilt || 0, t),
    lt: lerp(A.lt ?? 1, B.lt ?? 1, t),
    sy: lerp(A.sy || 0, B.sy || 0, t),
  };
  if (view === 'side') {
    const ra = sideRoots(A), rb = sideRoots(B);
    for (const k of ['N', 'F']) {
      P['arm' + k] = lerpLimb(limbSpec(A, 'arm', k) || DEF_ARM, limbSpec(B, 'arm', k) || DEF_ARM, t, 'arm', { root: ra.sh, up: ra.up }, { root: rb.sh, up: rb.up });
      P['leg' + k] = lerpLimb(limbSpec(A, 'leg', k) || DEF_LEG, limbSpec(B, 'leg', k) || DEF_LEG, t, 'leg', { root: ra.hip }, { root: rb.hip });
    }
  } else {
    const da = { a: 10, b: 6 }, dl = { a: 4, b: 2 };
    const rootsF = (p) => {
      const hc = p.hip || [100, STAND_HIP];
      return { sh: [L.shw, hc[1] + L.torso * (p.lt ?? 1)], hj: [L.hpw, hc[1]] };
    };
    const ra = rootsF(A), rb = rootsF(B);
    for (const k of ['R', 'L']) {
      P['arm' + k] = lerpLimb(limbSpec(A, 'arm', k) || da, limbSpec(B, 'arm', k) || da, t, 'arm', { root: ra.sh }, { root: rb.sh });
      P['leg' + k] = lerpLimb(limbSpec(A, 'leg', k) || dl, limbSpec(B, 'leg', k) || dl, t, 'leg', { root: ra.hj }, { root: rb.hj });
    }
  }
  return P;
}

// pose no instante t (0..1) ao longo dos quadros
export function poseAt(frames, t, view) {
  if (frames.length === 1) return frames[0];
  const n = frames.length - 1;
  const x = Math.min(0.9999, Math.max(0, t)) * n;
  const i = Math.floor(x);
  return lerpPose(frames[i], frames[i + 1], x - i, view);
}

// ---------- API de desenho ----------
// anim: { view, frames, equip: (J, pose, t) => void usando EquipOut }, act: { musculo: 2|1 }

export function renderFrame(anim, act, t, wantBox) {
  const o = new Out();
  const view = anim.view || 'side';
  const fr = anim.loop ? (anim._lf || (anim._lf = [...anim.frames, anim.frames[0]])) : anim.frames;
  const pose = poseAt(fr, t, view);
  if (anim.floor !== false) {
    const vb = anim._vb;
    o.s.push({ t: 'line', x1: f1(vb ? vb[0] + 2 : 4), y1: f1(FLOOR), x2: f1(vb ? vb[0] + vb[2] - 2 : VW - 4), y2: f1(FLOOR), c: 'fg-fl', w: '1.2' });
  }
  if (view === 'side') {
    const J = solveSide(pose);
    const pg = pegadasLado(anim, J);
    drawEquip(o, anim.equip, J, 'back', view, t);
    drawSide(o, J, act, pg);
    drawEquip(o, anim.equip, J, 'front', view, t);
    maosPorCima(o, J, pg, view);
  } else {
    const J = solveFront(pose);
    const pg = pegadasFrente(anim, J);
    drawEquip(o, anim.equip, J, 'back', view, t);
    drawFront(o, J, act, view === 'back', pg);
    drawEquip(o, anim.equip, J, 'front', view, t);
    maosPorCima(o, J, pg, view);
  }
  return wantBox ? o.bb : o.s;
}

// Juntas resolvidas de um instante da animação, com a altura do chão no desenho (uso da galeria de conferência).
export function juntasEm(anim, t) {
  const view = anim.view || 'side';
  const fr = anim.loop ? [...anim.frames, anim.frames[0]] : anim.frames;
  const pose = poseAt(fr, t, view);
  return { J: view === 'side' ? solveSide(pose) : solveFront(pose), chao: FLOOR, view };
}

// Enquadramento automático: caixa que contém o movimento inteiro, em proporção fixa 3:2.
export function viewBoxOf(anim) {
  if (anim._vb) return anim._vb;
  const b = [1e9, 1e9, -1e9, -1e9];
  for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    const q = renderFrame(anim, {}, t, true);
    b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[2]); b[3] = Math.max(b[3], q[3]);
  }
  const pad = 4;
  let x0 = b[0] - pad, x1 = b[2] + pad, y0 = b[1] - pad;
  const y1 = anim.floor === false ? b[3] + pad : FLOOR + 5;
  let w = x1 - x0, h = y1 - y0;
  const AR = 1.5;
  if (w / h < AR) { const nw = h * AR; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / AR; y0 -= (nh - h); h = nh; }
  anim._vb = [x0, y0, w, h].map((n) => Math.round(n * 10) / 10);
  return anim._vb;
}

const NS = 'http://www.w3.org/2000/svg';
const ATTRS = ['d', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2'];

// Sincroniza a lista de formas com os filhos de um <g>/<svg>, reaproveitando nós.
let serie = 0;
export function paint(g, shapes) {
  const kids = g.childNodes;
  const cid = g.__cid || (g.__cid = 'fgc' + (++serie));
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    let el = kids[i];
    if (!el || el.tagName !== s.t) {
      const ne = document.createElementNS(NS, s.t);
      if (s.t === 'clipPath') ne.appendChild(document.createElementNS(NS, 'path'));
      if (el) g.replaceChild(ne, el); else g.appendChild(ne);
      el = ne;
    }
    if (s.t === 'clipPath') {
      const id = cid + '-' + s.n;
      if (el.getAttribute('id') !== id) el.setAttribute('id', id);
      if (el.firstChild.getAttribute('d') !== s.d) el.firstChild.setAttribute('d', s.d);
      continue;
    }
    const alvo = s.cp ? `url(#${cid}-${s.cp})` : null;
    if (el.getAttribute('clip-path') !== alvo) { if (alvo) el.setAttribute('clip-path', alvo); else el.removeAttribute('clip-path'); }
    if (el.getAttribute('class') !== s.c) el.setAttribute('class', s.c);
    for (const a of ATTRS) {
      if (s[a] != null) { if (el.getAttribute(a) !== s[a]) el.setAttribute(a, s[a]); }
    }
    if (s.w != null) { if (el.getAttribute('stroke-width') !== s.w) el.setAttribute('stroke-width', s.w); }
  }
  while (kids.length > shapes.length) g.removeChild(g.lastChild);
}

export function makeSvg(extraClass, anim) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', anim ? viewBoxOf(anim).join(' ') : `0 0 ${VW} ${VH}`);
  svg.setAttribute('class', 'fig' + (extraClass ? ' ' + extraClass : ''));
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

// ativação: primários = 2, secundários = 1
export function activation(ex) {
  const act = {};
  for (const m of ex.secundarios || []) act[m] = 1;
  for (const m of ex.primarios || []) act[m] = 2;
  if (act.manguito) act.deltoide_post = Math.max(act.deltoide_post || 0, act.manguito);
  return act;
}

export { Out, L, add, sub, norm, lerp, lerpP, limbDir, angOf };

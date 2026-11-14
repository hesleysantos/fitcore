// Peças de aparelho usadas nas figuras de pernas, glúteos, abdômen e cardio (complementam as de equip.js).
// Tudo no mesmo "mundo" do boneco: y para cima, chão em 0, 1 unidade ≈ 2 cm.
import { P } from './equip.js';

export const soma = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
export const dif = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const uni = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
export const entre = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const angulo = (v) => Math.atan2(v[1], v[0]);

// Cabo de aço que passa por polias: pts é o caminho; cada ponto do meio ganha uma polia.
export function cabo(o, pts, r = 1.5) {
  o.open(pts, 'fg-cable', 0.8);
  for (let i = 1; i < pts.length - 1; i++) P.polia(o, pts[i], r);
}

// Came: disco preso ao eixo da alavanca, onde o cabo enrola. Os furos giram com o braço (ang em radianos).
export function came(o, c, r, ang = 0) {
  o.circ(c, r, 'fg-steel');
  for (let i = 0; i < 3; i++) {
    const a = ang + (i * 2 * Math.PI) / 3;
    o.circ([c[0] + Math.cos(a) * r * 0.62, c[1] + Math.sin(a) * r * 0.62], r * 0.17, 'fg-eqs');
  }
}

// Ponto da borda do came de onde o cabo sai em direção a p (lado = +1 ou -1 escolhe a tangente).
export function saida(c, r, p, lado = 1) {
  const d = uni(dif(p, c));
  return [c[0] - d[1] * r * lado, c[1] + d[0] * r * lado];
}

// Torre da pilha de pesos com o cabo que vem da máquina: o cabo chega pela polia do pé da torre (na face dir),
// sobe por fora da coluna e entra pela polia do alto até o cabeçote da pilha. "de" = caminho do cabo até a torre.
// direto = true: o cabo já chega encostado na face da torre (em de, na linha x da polia) e sobe direto, sem a polia do pé.
// polia0 = true: desenha uma polia também no primeiro ponto (onde o cabo sai de dentro da estrutura da máquina).
// interno = true: o cabo entra pelo pé da torre e sobe por dentro dela (só o cabo da própria pilha aparece).
export function torre(o, { x, top = 84, w = 10, dir = 1, sobe = 0, de = null, direto = false, polia0 = false, interno = false }) {
  P.coluna(o, x, top, w, sobe);
  if (!de) return;
  if (interno) {
    cabo(o, [...de, [x + dir * (w / 2 - 1.2), 3.8]]);
    if (polia0) P.polia(o, de[0], 1.5);
    return;
  }
  const xf = x + dir * (w / 2 + 2.8);
  if (!direto) o.line([x + dir * (w / 2), 3.8], [xf, 3.8], 'fg-eq', 1.1);
  o.line([x + dir * (w / 2), top - 3.8], [xf, top - 3.8], 'fg-eq', 1.1);
  cabo(o, direto ? [...de, [xf, top - 3.8], [x, top - 3.8]] : [...de, [xf, 3.8], [xf, top - 3.8], [x, top - 3.8]]);
  if (polia0) P.polia(o, de[0], 1.5);
}

// Braço em L de cadeira extensora / flexora: sai do eixo (ao lado do joelho), desce ao lado da canela e leva o rolo
// que encosta na perna. lado = +1 (rolo na frente da canela) ou -1 (rolo atrás, no tendão).
export function bracoDoRolo(o, eixo, d, comp, lado, afasta = 4.7) {
  const n = [-d[1] * lado, d[0] * lado];
  const q = soma(eixo, d, comp);
  const r = soma(q, n, afasta);
  P.tubo(o, [eixo, q, r], 1.7);
  P.rolo(o, r, 2.9);
  return r;
}

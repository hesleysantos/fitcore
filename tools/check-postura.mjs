// Verificação de postura, equilíbrio e contato com o chão em todas as animações (vista lateral).
// Complementa tools/check-anim.mjs (ossos, alcance e sentido das articulações).
// Uso: node tools/check-postura.mjs [-v]
//
// Referências dos limites:
// - massas e centros de massa dos segmentos: Winter DA. Biomechanics and Motor Control of Human Movement (tabela antropométrica);
// - amplitudes articulares normais: AAOS / Norkin & White, Measurement of Joint Motion (tornozelo ~20° de dorsiflexão
//   em pé e até ~35–40° com carga no agachamento profundo; ~50° de flexão plantar; ombro ~60° de extensão; quadril ~20–30° de extensão);
// - agachamento: Myer GD et al. The back squat (Strength Cond J, 2014): calcanhares no chão, coxas ao menos paralelas,
//   peso sobre o meio do pé; flexão de braços e prancha: ACE/NASM (corpo em linha reta da cabeça aos calcanhares).
import { EXERCICIOS } from '../www/js/data/exercises.js';
import { animFor } from '../www/js/anim/index.js';
import { poseAt, solveSide, L } from '../www/js/anim/rig.js';
import { TRONCO, TH_F, TH_B, SH_F, SH_B, UP_F, UP_B, FO_F, FO_B } from '../www/js/anim/body.js';
import { pegadasLado } from '../www/js/anim/maos.js';

const verbose = process.argv.includes('-v');
const DEG = 180 / Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const ang = (a, b, c) => { const v1 = sub(a, b), v2 = sub(c, b); const d = (v1[0] * v2[0] + v1[1] * v2[1]) / ((Math.hypot(...v1) || 1) * (Math.hypot(...v2) || 1)); return Math.acos(Math.max(-1, Math.min(1, d))) * DEG; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function borda(a, b, perfilF, perfilB) { // pontos do contorno de um segmento
  const v = sub(b, a); const len = Math.hypot(...v) || 1; const d = [v[0] / len, v[1] / len]; const n = [-d[1], d[0]];
  const out = [];
  for (const [f, w] of perfilF) out.push([a[0] + d[0] * len * f + n[0] * w, a[1] + d[1] * len * f + n[1] * w]);
  for (const [f, w] of perfilB) out.push([a[0] + d[0] * len * f - n[0] * w, a[1] + d[1] * len * f - n[1] * w]);
  return out;
}

let problemas = 0;
const vistos = new Set();
const relata = (id, msg) => { const k = id + '|' + msg.replace(/[-\d.,]+/g, '#'); if (vistos.has(k)) return; vistos.add(k); problemas++; console.log(`  x ${id}: ${msg}`); };

// equipamentos que seguram ou puxam o corpo: com eles o equilíbrio não depende só dos pés
const APOIO = new Set(['pad', 'bench', 'tower', 'cable', 'fixbar', 'rail', 'lever', 'sled', 'wheel', 'ball', 'band', 'roller', 'box', 'fn', 'line', 'circ']);
const CARGA = { barbell: 0.5, db: 0.25, kb: 0.2, plate: 0.15, ballheld: 0.08 };

for (const ex of EXERCICIOS) {
  const anim = animFor(ex);
  if ((anim.view || 'side') !== 'side') continue;
  const frames = anim.loop ? [...anim.frames, anim.frames[0]] : anim.frames;
  const tipos = new Set((anim.equip || []).map((e) => e.k));
  const temApoio = [...tipos].some((k) => APOIO.has(k));
  const temColchonete = tipos.has('mat');
  const carga = Math.max(0, ...[...tipos].map((k) => CARGA[k] || 0));
  const noTrapezio = (anim.equip || []).some((e) => e.at === 'trap');
  let fundo = null; // quadro com o quadril mais baixo

  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const pose = poseAt(frames, t, 'side');
    const J = solveSide(pose);
    const frente = [J.up[1], -J.up[0]]; // para onde o peito aponta
    const baixo = [J.hip[0] - J.sh[0], J.hip[1] - J.sh[1]]; // do ombro para o quadril
    const angCom = (v, w) => Math.acos(Math.max(-1, Math.min(1, (v[0] * w[0] + v[1] * w[1]) / ((Math.hypot(...v) || 1) * (Math.hypot(...w) || 1))))) * DEG;
    if (!fundo || J.hip[1] < fundo.J.hip[1]) fundo = { J, pose, t };

    // 0) mãos: deitado no chão, o braço estendido ao lado do corpo descansa no chão (a mão não fica no ar);
    //    e mão livre que chega ao chão fica espalmada
    const pg = pegadasLado(anim, J);
    const corpoDeitado = Math.abs(J.up[1]) < 0.3 && J.hip[1] < 14 && J.sh[1] < 14;
    for (const k of ['N', 'F']) {
      const wr = J['wr' + k], hd = J['hd' + k], g = pg[k];
      if (!['aberta', 'solta', 'punho', 'eixo'].includes(g.m)) relata(ex.id, `pegada desconhecida na mão ${k}: ${g.m}`);
      if (g.m === 'aberta' && !(g.O.every(Number.isFinite) && g.h >= 0 && g.h <= 6.5)) relata(ex.id, `mão ${k} espalmada longe do apoio`);
      const paraOsPes = (wr[0] - J.sh[0]) * (J.hip[0] - J.sh[0]) > 0 && Math.abs(wr[0] - J.sh[0]) > 18;
      if (corpoDeitado && g.m === 'solta' && paraOsPes && Math.abs(hd[1]) < 0.35 && wr[1] > 5.9 && wr[1] < 14) relata(ex.id, `mão ${k} no ar com o corpo deitado (punho a ${wr[1].toFixed(1)} do chão)`);
    }

    // 1) nada do corpo abaixo do chão (contorno real, não só as articulações)
    const cont = [...borda(J.sh, J.hip, TRONCO.filter((p) => p[1] > 0), TRONCO.filter((p) => p[1] < 0).map(([f, w]) => [f, -w]))];
    for (const k of ['N', 'F']) {
      cont.push(...borda(J.hip, J['kn' + k], TH_F, TH_B), ...borda(J['kn' + k], J['an' + k], SH_F, SH_B));
      const as = pose['arm' + k] || pose.arm || {};
      if (as.la == null && as.lb == null) cont.push(...borda(J.sh, J['el' + k], UP_F, UP_B), ...borda(J['el' + k], J['wr' + k], FO_F, FO_B));
    }
    const minY = Math.min(...cont.map((p) => p[1]));
    if (minY < -0.6) relata(ex.id, `corpo ${(-minY).toFixed(1)} abaixo do chão em t=${t}`);
    if (temColchonete && minY < 0.2 && J.hip[1] < 14) relata(ex.id, `corpo afundado no colchonete (${minY.toFixed(1)}) em t=${t}`);

    for (const k of ['N', 'F']) {
      // 2) tornozelo dentro da amplitude (90° = pé em ângulo reto com a canela)
      const tz = ang(J['kn' + k], J['an' + k], [J['an' + k][0] + J['fd' + k][0], J['an' + k][1] + J['fd' + k][1]]);
      if (tz < 48) relata(ex.id, `tornozelo ${k} dobrado demais para cima (${(90 - tz).toFixed(0)}° de dorsiflexão) em t=${t}`);
      if (tz > (J['kn' + k][1] < 7 || J['fu' + k][1] < -0.5 ? 185 : 152)) relata(ex.id, `tornozelo ${k} esticado além do limite (${(tz - 90).toFixed(0)}° de flexão plantar) em t=${t}`);
      // 3) quadril: coxa não passa muito para trás da linha do tronco
      const coxa = sub(J['kn' + k], J.hip);
      const ext = angCom(coxa, baixo); // 0 = coxa na linha do tronco
      if (coxa[0] * frente[0] + coxa[1] * frente[1] < 0 && ext > 35) relata(ex.id, `quadril ${k} estendido além do limite (${ext.toFixed(0)}°) em t=${t}`);
      // 4) ombro: braço não vai muito para trás do tronco (só braços no plano do desenho)
      const as = pose['arm' + k] || pose.arm || {};
      if (as.la == null && as.lb == null) {
        const braco = sub(J['el' + k], J.sh);
        const flex = angCom(braco, baixo); // 0 = braço ao longo do tronco, para baixo; 180 = acima da cabeça
        if (braco[0] * frente[0] + braco[1] * frente[1] < 0 && flex > 68 && flex < 125) relata(ex.id, `ombro ${k} estendido além do limite (${flex.toFixed(0)}° para trás) em t=${t}`);
      }
    }
    // 5) pescoço
    if (Math.abs(pose.head || 0) > 42) relata(ex.id, `pescoço dobrado demais (${(pose.head || 0).toFixed(0)}°) em t=${t}`);

    // 6) equilíbrio: sem apoio externo, o centro de massa fica sobre os pés
    const apoios = ['N', 'F'].flatMap((k) => [...(J['toe' + k][1] < 3 ? [J['toe' + k][0], J['toe' + k][0] + (J['fd' + k][0] >= 0 ? 3.7 : -3.7)] : []), ...(J['heel' + k][1] < 3 ? [J['heel' + k][0]] : [])]);
    const pes = apoios;
    if (!temApoio && pes.length && J.hip[1] > 14 && J.sh[1] > 24 && Math.min(J.wrN[1], J.wrF[1]) > 6 && !/parede|caminhada|passada-caminhando|corrida|treno|mergulho|levantamento-turco|salto|burpee|polichinelo|pular-corda/.test(ex.id)) {
      const seg = [[J.hip, J.sh, 0.5, 0.497], [J.sh, J.head, 1.0, 0.081]];
      for (const k of ['N', 'F']) {
        seg.push([J.sh, J['el' + k], 0.436, 0.028], [J['el' + k], J['wr' + k], 0.43, 0.016], [J['wr' + k], J['hand' + k], 0.5, 0.006]);
        seg.push([J.hip, J['kn' + k], 0.433, 0.1], [J['kn' + k], J['an' + k], 0.433, 0.0465], [J['an' + k], J['toe' + k], 0.5, 0.0145]);
      }
      let m = 0, mx = 0;
      for (const [a, b, f, w] of seg) { const c = lerp(a, b, f); m += w; mx += w * c[0]; }
      if (carga) { const p = noTrapezio ? J.sh : lerp(J.handN, J.handF, 0.5); m += carga; mx += carga * p[0]; }
      const cx = mx / m;
      const xs = pes;
      const lo = Math.min(...xs) - 1.5, hi = Math.max(...xs) + 1.5;
      if (cx < lo || cx > hi) relata(ex.id, `fora de equilíbrio em t=${t}: centro de massa ${(cx < lo ? lo - cx : cx - hi).toFixed(1)} ${cx < lo ? 'atrás' : 'à frente'} dos pés`);
      else if (verbose && i % 10 === 0) console.log(`    ${ex.id} t=${t}: centro de massa a ${(cx - lo).toFixed(1)} do calcanhar e ${(hi - cx).toFixed(1)} da ponta`);
    }

    // 7) prancha e flexão de braços: ombro, quadril e tornozelo em linha
    const maosNoApoio = Math.min(J.wrN[1], J.wrF[1]) < 22 && J.sh[1] > Math.min(J.wrN[1], J.wrF[1]);
    const deitadoDeBrucos = Math.abs(pose.torso || 0) > 55 && Math.abs(pose.torso || 0) < 125 && J.hip[1] > 9 && J.hip[1] < 46;
    if ((ex.padrao === 'anti_extensao' || ex.padrao === 'empurrar_horizontal') && maosNoApoio && deitadoDeBrucos && /prancha|flexao-de|flexao-incl|flexao-decl|flexao-diam/.test(ex.id)) {
      const linha = ang(J.sh, J.hip, J.anN);
      if (linha < 166 && !/joelhos/.test(ex.id)) relata(ex.id, `corpo fora da linha reta (${(180 - linha).toFixed(0)}° de dobra no quadril) em t=${t}`);
    }
  }

  // 8) agachamentos livres: no fundo, coxas ao menos paralelas, calcanhares no chão e joelho sem passar muito da ponta do pé
  if (ex.padrao === 'agachar' && !temApoio && fundo) {
    const { J } = fundo;
    if (J.hip[1] > J.knN[1] + 5 && !/salto/.test(ex.id)) relata(ex.id, `agachamento raso: quadril ${(J.hip[1] - J.knN[1]).toFixed(1)} acima do joelho no fundo`);
    if (J.hip[1] < J.knN[1] - 9) relata(ex.id, `agachamento fundo demais: quadril ${(J.knN[1] - J.hip[1]).toFixed(1)} abaixo do joelho`);
    if (J.heelN[1] > 2.6) relata(ex.id, `calcanhar fora do chão no fundo do agachamento (${J.heelN[1].toFixed(1)})`);
    const passa = (J.knN[0] - (J.toeN[0] + J.fdN[0] * 3.7)) * (J.up[1] >= 0 ? 1 : -1);
    if (passa > 5) relata(ex.id, `joelho ${passa.toFixed(1)} à frente da ponta do pé no fundo`);
  }
}
console.log(problemas ? `\n${problemas} problema(s) de postura ou equilíbrio.` : 'OK: postura, equilíbrio e contato com o chão verificados em todas as animações de vista lateral.');
process.exit(problemas ? 1 : 0);

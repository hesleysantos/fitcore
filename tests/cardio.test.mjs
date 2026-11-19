// Aeróbico da semana (logic/cardio.js): a meta muda com o perfil (OMS 2020; Swift 2014; Oppert 2021), a corrida e a
// caminhada entram na conta (1 min correndo vale 2: Compendium 2024), e quem segue o plano de corrida montado pelo app
// nunca recebe "pouco aeróbico" — o plano completa a semana com caminhada no fim dos treinos (logic/corrida.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metaAerobica, aerobicoFeito, dicaCardio } from '../www/js/logic/cardio.js';
import { PERGUNTAS, gerarPlano, planoAtual, planejadoDe, planoDaSemana, minutosEquivalentes, minutosDoRegistro } from '../www/js/logic/corrida.js';
import { REFS } from '../www/js/data/knowledge.js';

const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const somaDias = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return dk(d); };
const vazio = () => ({ sessions: [], runs: [], plans: [], perdidos: [], dores: [], trainer: { answers: {} }, nutri: { answers: {} }, run: null });
const AGORA = Date.parse('2026-11-19T20:00:00');
const HOJE = '2026-11-19'; // quinta-feira
const corrida = (extra = {}) => {
  const a = { experiencia: 'nunca', objetivo: 'comecar', dias: ['1', '3', '5'], diaLongo: 'auto', tempo: '45', tempoLongo: '60', aparelho: 'gps', local: 'rua', idade: 35, peso: 80, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], ...extra };
  for (const q of PERGUNTAS) if (!(q.k in a) && !(q.se && !q.se(a)) && !q.opcional) a[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  return a;
};

test('meta da semana pelo perfil: adolescente, gestante, emagrecer, 65+ e adulto', () => {
  const st = vazio();
  assert.equal(metaAerobica(st).perfil, 'adulto'); assert.equal(metaAerobica(st).min, 150);
  st.trainer.answers = { idade: 15 }; assert.deepEqual([metaAerobica(st).perfil, metaAerobica(st).min], ['jovem', 420]);
  st.trainer.answers = { idade: 30, condicoes: ['gestante'] }; assert.equal(metaAerobica(st).perfil, 'gestante');
  st.trainer.answers = { idade: 30, objetivo: 'emagrecimento' }; assert.deepEqual([metaAerobica(st).min, metaAerobica(st).relogio], [150, 225]);
  st.trainer.answers = { idade: 30 }; st.nutri.answers = { objetivo: 'emagrecer' }; assert.equal(metaAerobica(st).perfil, 'emagrecer');
  st.nutri.answers = {}; st.trainer.answers = { idade: 70 }; assert.equal(metaAerobica(st).perfil, 'idoso'); assert.match(metaAerobica(st).texto, /equilíbrio/);
  for (const k of ['oms2020', 'swift2014', 'oppert2021', 'compendio2024', 'schumann2022']) assert.ok(REFS[k], k);
});

test('a corrida e a caminhada registradas contam; correr vale 2, caminhar 1', () => {
  const st = vazio();
  st.runs.push({ id: 'a', data: '2026-11-17', tipo: 'leve', distKm: 5, durMin: 30, pse: 4 });
  st.runs.push({ id: 'b', data: '2026-11-18', tipo: 'caminhada', distKm: 3, durMin: 40, pse: 3 });
  st.runs.push({ id: 'c', data: '2026-11-19', tipo: 'livre', local: 'esteira', distKm: 3, durMin: 20, pse: 5 });
  const f = aerobicoFeito(st, AGORA);
  assert.deepEqual([f.relogio, f.equivalente, f.registros], [90, 140, 3]); // 1 semana de uso: 30×2 + 40 + 20×2
  // corrida e caminhada com o plano do dia: só a parte correndo vale 2
  assert.equal(minutosDoRegistro({ tipo: 'corrida_caminhada', durMin: 40, plan: { tipo: 'corrida_caminhada', durMin: 40, corridaMin: 10 } }).equivalente, 50);
  // rodagem com a caminhada somada pelo plano: a caminhada vale 1
  assert.equal(minutosDoRegistro({ tipo: 'leve', durMin: 45, plan: { tipo: 'leve', durMin: 45, caminhadaMin: 15 } }).equivalente, 75);
});

test('quem segue o plano de corrida do app não recebe "pouco aeróbico"', () => {
  for (const [nome, extra, outros] of [
    ['começar a correr, 3 × 45 min', {}, {}],
    ['começar, 60 anos e IMC 30', { idade: 60, peso: 95, altura: 170 }, {}],
    ['saúde, iniciante', { experiencia: 'iniciante', kmSemana: 8, longoAtual: 3, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude' }, {}],
    ['saúde e emagrecer', { experiencia: 'iniciante', kmSemana: 8, longoAtual: 3, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', tempo: '60', tempoLongo: '90' }, { trainer: { answers: { objetivo: 'emagrecimento' } } }],
  ]) {
    const st = { ...vazio(), ...outros, run: { answers: corrida(extra), aceitoEm: '2026-11-08T10:00:00.000Z', inicio: '2026-11-09', pausadoEm: '', pausas: [] } };
    // registra os treinos do plano até ontem, como o plano mostrou (com o que estava planejado)
    for (let k = 0; k < 10; k++) {
      const data = somaDias('2026-11-09', k);
      const sem = planoDaSemana(st, data);
      const d = sem && sem.dias[new Date(data + 'T12:00:00').getDay()];
      if (!d || d.tipo === 'descanso') continue;
      st.runs.push({ id: 'r' + k, data, tipo: d.tipo, distKm: d.distKm, durMin: d.durMin, pse: 4, plan: planejadoDe(d) });
    }
    const dc = dicaCardio(st, AGORA);
    assert.ok(dc && dc.titulo !== 'Pouco aeróbico na semana', `${nome}: ${dc && dc.texto}`);
    // e o plano de toda semana chega aos 150 minutos (moderado equivalente), dentro do tempo que a pessoa tem
    const p = planoAtual(st, HOJE);
    for (const s of p.semanas) assert.ok(s.dias.reduce((t, d) => t + minutosEquivalentes(d), 0) >= 150, `${nome}, semana ${s.n}`);
  }
});

test('sem registros nem plano, não há análise; plano de musculação para massa não é cobrado à toa', () => {
  const st = vazio();
  assert.equal(dicaCardio(st, AGORA), null);
  st.trainer.answers = { objetivo: 'hipertrofia' };
  st.runs.push({ id: 'a', data: '2026-11-18', tipo: 'caminhada', durMin: 20 });
  const dc = dicaCardio(st, AGORA);
  assert.equal(dc.titulo, 'Pouco aeróbico na semana');
  assert.match(dc.porque, /Não atrapalha o ganho de músculo/); assert.ok(dc.refs.includes('schumann2022'));
});

test('emagrecer: o plano soma caminhada até 225 min e avisa quando o tempo não dá', () => {
  // 4 dias de até 1 hora (o longo, 1h30): cabe
  const a = corrida({ experiencia: 'iniciante', kmSemana: 8, longoAtual: 3, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: ['1', '3', '5', '0'], tempo: '60', tempoLongo: '90' });
  const p = gerarPlano(a, { emagrecer: true });
  for (const s of p.semanas.filter((x) => x.n >= 5)) assert.ok(s.dias.reduce((t, d) => t + (d.tipo !== 'descanso' ? d.durMin : 0), 0) >= 220, 'semana ' + s.n);
  assert.ok(p.ajustes.some((x) => /225/.test(x.texto) && x.refs.includes('swift2014')));
  const curto = gerarPlano(corrida({ experiencia: 'iniciante', kmSemana: 8, longoAtual: 3, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', tempo: '30', tempoLongo: '45' }), { emagrecer: true });
  assert.ok(curto.ajustes.some((x) => /chega a cerca de \d+/.test(x.texto)), 'avisa que o tempo não chega aos 225');
  // menores de 18 e prova com data: o plano não mexe
  const jovem = gerarPlano(corrida({ idade: 16 }), {});
  assert.ok(jovem.semanas.every((s) => s.dias.every((d) => !d.caminhadaMin)));
});

test('corrida extra no mesmo dia do treino do plano conta como extra (esteira a mais)', () => {
  const st = { ...vazio(), run: { answers: corrida({ experiencia: 'iniciante', kmSemana: 8, longoAtual: 3, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude' }), aceitoEm: '2026-11-08T10:00:00.000Z', inicio: '2026-11-09', pausadoEm: '', pausas: [] } };
  const sem0 = planoDaSemana(st, '2026-11-18');
  const d = sem0.dias[3];
  assert.ok(d && d.tipo !== 'descanso', 'quarta tem treino');
  st.runs.push({ id: 'p', data: '2026-11-18', tipo: d.tipo, distKm: d.distKm, durMin: d.durMin, pse: 4, plan: planejadoDe(d) });
  st.runs.push({ id: 'x', data: '2026-11-18', tipo: 'livre', local: 'esteira', distKm: 6, durMin: 40, pse: 5 });
  const sem = planoDaSemana(st, '2026-11-18');
  assert.equal(sem.dias[3].feito.id, 'p', 'o do plano cumpre o treino, mesmo menor que a esteira');
  assert.deepEqual(sem.extras[3].map((x) => [x.id, x.local]), [['x', 'esteira']]);
});

// Repetições que ainda sairiam (RIR) e exercício travado na sugestão de carga (logic/progress.js):
//  • quem já treina há mais de um ano: com dois treinos seguidos na mesma carga e fora da faixa-alvo, a carga sobe ou
//    desce cerca de 4% por repetição fora da faixa, até 10% (5% nos de uma articulação) — helms2018, acsm2026;
//  • quem está começando: a resposta fica guardada, mas a carga segue pelas repetições (helms2016, steele2017);
//  • travado há 3 treinos: um treino mais leve (10% menos carga, uma série a menos) e, depois, a volta (bell2022, bell2023).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import { sugestao, estagnados, rirMedio, alvoRir, rirSoAnotado, TEXTO_RIR, ROTULO_RIR } from '../www/js/logic/progress.js';
import { recomendacao } from '../www/js/logic/carga.js';
import { EX_POR_ID } from '../www/js/data/exercises.js';
import { REFS } from '../www/js/data/knowledge.js';

const DIA = 86400000;
const SUPINO = 'supino-reto-barra';
const ROSCA = EX_POR_ID.has('rosca-direta-barra') ? 'rosca-direta-barra' : [...EX_POR_ID.values()].find((e) => e.registro === 'peso_reps' && e.tipo !== 'composto').id;
// sessões do mais velho ao mais novo: [diasAtrás, kg, reps, rir (ou null)]
function montar(ex, lista, experiencia = 'intermediario') {
  const sessions = lista.map(([d, kg, reps, rir], i) => ({ id: 's' + i, nome: 'T', inicio: new Date(Date.now() - d * DIA).toISOString(), fim: new Date(Date.now() - d * DIA + 3600000).toISOString(), nota: '', itens: [{ ex, alvo: '8-12', descanso: 90, sets: [0, 1, 2].map(() => ({ kg, reps, seg: null, ok: true, ...(rir == null ? {} : { rir }) })) }] }));
  store.update((s) => { s.sessions = sessions; s.trainer.answers = { experiencia }; });
}
test.afterEach(() => store.update((s) => { s.sessions = []; s.trainer.answers = {}; }));

test('RIR: o registro guarda a resposta (0 a 4) e descarta o resto', () => {
  const d = store.sanitize({ v: store.VERSAO, sessions: [{ id: 'x', nome: 'T', inicio: new Date().toISOString(), fim: new Date().toISOString(), itens: [{ ex: SUPINO, alvo: '8-12', descanso: 90, sets: [{ kg: 40, reps: 10, ok: true, rir: 2 }, { kg: 40, reps: 10, ok: true, rir: 7 }, { kg: 40, reps: 10, ok: true, rir: '1' }] }] }] });
  assert.deepEqual(d.sessions[0].itens[0].sets.map((s) => s.rir), [2, undefined, undefined]);
  assert.equal(rirMedio([{ rir: 4 }, { rir: 2 }, {}]), 3);
  assert.equal(rirMedio([{ rir: 4 }, {}, {}]), null, 'menos da metade das séries com resposta: não conta');
  assert.deepEqual(alvoRir(EX_POR_ID.get(SUPINO)), [2, 3]);
  assert.deepEqual(alvoRir(EX_POR_ID.get(ROSCA)), [1, 2]);
  assert.deepEqual(ROTULO_RIR, ['0', '1', '2', '3', '4+']);
  assert.ok(TEXTO_RIR.length >= 2 && TEXTO_RIR.every((t) => t.length < 260) && /2 a 3 repetições antes do limite/.test(TEXTO_RIR.join(' ')));
  assert.ok(REFS.helms2018 && REFS.bell2022 && REFS.bell2023 && REFS.acsm2026);
});

test('RIR: carga leve em dois treinos seguidos sobe; pesada desce; só um treino não muda', () => {
  // 4 ou mais sobrando no supino (alvo 2 a 3), 40 kg, 10 repetições: +4% por repetição acima do teto, até 10%
  montar(SUPINO, [[6, 40, 10, 4], [3, 40, 10, 4]]);
  let g = sugestao(SUPINO, '8-12', 3);
  assert.equal(g.kg, 42.5); assert.ok(g.rir && /ainda sobravam 4 repetições ou mais: a carga está leve/.test(g.texto), g.texto);
  assert.deepEqual(recomendacao(SUPINO, '8-12', 3).refs, ['acsm2009', 'helms2018', 'acsm2026']);
  // só o último treino com folga: segue a dupla progressão (mais repetições)
  montar(SUPINO, [[6, 40, 10, 2], [3, 40, 10, 4]]);
  g = sugestao(SUPINO, '8-12', 3);
  assert.equal(g.kg, 40); assert.ok(!g.rir);
  // carga diferente entre os dois treinos: não compara
  montar(SUPINO, [[6, 37.5, 10, 4], [3, 40, 10, 4]]);
  assert.equal(sugestao(SUPINO, '8-12', 3).kg, 40);
  // nenhuma sobrando em dois treinos: desce
  montar(SUPINO, [[6, 60, 9, 0], [3, 60, 9, 0]]);
  g = sugestao(SUPINO, '8-12', 3);
  assert.ok(g.kg < 60 && g.kg >= 54 && /não sobrou nenhuma repetição/.test(g.texto), JSON.stringify(g));
  // na faixa-alvo: nada muda pela resposta
  montar(SUPINO, [[6, 40, 10, 2], [3, 40, 10, 3]]);
  assert.ok(!sugestao(SUPINO, '8-12', 3).rir);
  // isolado: 5%, arredondado para o passo que existe (um passo, no mínimo), sem passar dos 10% do acsm2009
  montar(ROSCA, [[6, 30, 10, 4], [3, 30, 10, 4]]);
  g = sugestao(ROSCA, '8-12', 3);
  assert.ok(g.rir && g.kg > 30 && g.kg <= 33, JSON.stringify(g));
  montar(ROSCA, [[6, 12, 10, 4], [3, 12, 10, 4]]);
  assert.equal(sugestao(ROSCA, '8-12', 3).kg, 13, 'com passo pequeno, cerca de 5%');
});

test('RIR: quem está começando só anota (a carga segue pelas repetições)', () => {
  montar(SUPINO, [[6, 40, 10, 4], [3, 40, 10, 4]], 'iniciante');
  assert.equal(rirSoAnotado(), true);
  const g = sugestao(SUPINO, '8-12', 3);
  assert.equal(g.kg, 40); assert.ok(!g.rir);
  // sem entrevista: pelo tempo de treino registrado no app (menos de um ano: só anota)
  montar(SUPINO, [[400, 40, 10, null], [3, 40, 10, 4]], '');
  assert.equal(rirSoAnotado(), false);
  montar(SUPINO, [[60, 40, 10, null], [3, 40, 10, 4]], '');
  assert.equal(rirSoAnotado(), true);
});

test('travado: 3 treinos sem passar da marca → treino mais leve; depois, a volta; e o aviso de "sem evolução" não repete por causa do treino leve', () => {
  const plano = { id: 'p', nome: 'P', dias: [{ id: 'a', nome: 'A', itens: [{ ex: SUPINO, series: 3, reps: '8-12' }] }], agenda: {} };
  montar(SUPINO, [[12, 50, 9], [9, 50, 9], [6, 50, 9], [3, 50, 9]]);
  let g = sugestao(SUPINO, '8-12', 3);
  assert.equal(g.plato, 'leve');
  assert.equal(g.kg, 45); assert.equal(g.reps, 9);
  assert.match(g.texto, /Marca parada há 3 treinos\. Hoje, um treino mais leve: uma série a menos, com 45 kg e as mesmas repetições\. No próximo, volte a 50 kg\./);
  assert.ok(recomendacao(SUPINO, '8-12', 3).refs.includes('bell2022'));
  assert.deepEqual(estagnados(plano), [SUPINO]);
  // feito o treino leve: a sugestão volta à carga de antes, e o exercício não aparece mais como travado
  montar(SUPINO, [[15, 50, 9], [12, 50, 9], [9, 50, 9], [6, 50, 9], [3, 45, 9]]);
  g = sugestao(SUPINO, '8-12', 3);
  assert.equal(g.plato, 'volta'); assert.equal(g.kg, 50);
  assert.deepEqual(estagnados(plano), []);
  // de volta à carga, mais um treino: segue a dupla progressão
  montar(SUPINO, [[15, 50, 9], [12, 50, 9], [9, 50, 9], [6, 45, 9], [3, 50, 10]]);
  g = sugestao(SUPINO, '8-12', 3);
  assert.ok(!g.plato && g.kg === 50, JSON.stringify(g));
  // marca subindo: não é travado
  montar(SUPINO, [[12, 50, 8], [9, 50, 9], [6, 50, 10], [3, 50, 11]]);
  assert.ok(!sugestao(SUPINO, '8-12', 3).plato);
});

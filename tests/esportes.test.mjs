// Outros esportes do dia (logic/esportes.js, data/esportes.js): só o tempo e o gasto estimado pelo Compendium 2024.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESPORTES, ESPORTE_POR_ID, GRUPOS_ESPORTE } from '../www/js/data/esportes.js';
import { limparAtividades, gastoPorMinuto, gastoDaAtividade, gastoDoDia, MIN_MAX } from '../www/js/logic/esportes.js';
import { aerobicoFeito } from '../www/js/logic/cardio.js';
import { sanitize } from '../www/js/store.js';

const st = (extra = {}) => ({ sessions: [], runs: [], atividades: [], body: [{ data: '2026-11-01', peso: 70 }], trainer: { answers: { idade: 30 } }, nutri: { answers: {} }, run: null, ...extra });

test('tabela: ids únicos, grupos conhecidos, MET do Compendium entre 2 e 12', () => {
  assert.ok(ESPORTES.length >= 40);
  const grupos = new Set(GRUPOS_ESPORTE.map((g) => g[0]));
  assert.equal(ESPORTE_POR_ID.size, ESPORTES.length);
  for (const e of ESPORTES) {
    assert.ok(grupos.has(e.grupo), e.id);
    assert.ok(e.met >= 2 && e.met <= 12, e.id);
    if (e.met60 != null) assert.ok(e.met60 >= 2 && e.met60 <= 12, e.id);
    assert.ok(e.nome.length >= 4 && e.nome.length <= 45, e.id);
  }
  for (const id of ['futebol', 'basquete', 'volei', 'patins', 'ciclismo', 'natacao', 'calistenia', 'ginastica-aerobica']) assert.ok(ESPORTE_POR_ID.has(id), id);
});

test('calorias = MET × peso × horas (60+: MET60 × 2,7/3,5), arredondadas a 10 kcal', () => {
  const s = st();
  // futebol (7,0), 70 kg, 60 min: 490 kcal; 8,17 kcal por minuto
  assert.equal(gastoDaAtividade({ esporte: 'futebol', min: 60 }, s).kcal, 490);
  assert.ok(Math.abs(gastoPorMinuto('futebol', s).porMin - 7 * 70 / 60) < 1e-9);
  assert.equal(gastoDaAtividade({ esporte: 'natacao', min: 30 }, s).kcal, 210); // 6,0 × 70 × 0,5
  // 60 anos ou mais: com valor próprio, MET60 × 2,7/3,5; sem valor próprio, o de adultos
  const idoso = st({ trainer: { answers: { idade: 70 } } });
  assert.ok(Math.abs(gastoPorMinuto('calistenia', idoso).porMin - (3.5 * 70 * 2.7 / 3.5) / 60) < 1e-9);
  assert.ok(Math.abs(gastoPorMinuto('futebol', idoso).porMin - 7 * 70 / 60) < 1e-9);
  // sem peso: pede o peso; menor de 18 e transtorno alimentar: nada de calorias
  assert.equal(gastoPorMinuto('futebol', st({ body: [] })).motivo, 'peso');
  assert.equal(gastoPorMinuto('futebol', st({ trainer: { answers: { idade: 15 } } })).motivo, 'menor');
  assert.equal(gastoDaAtividade({ esporte: 'futebol', min: 60 }, st({ trainer: { answers: { idade: 15 } } })).kcal, null);
});

test('registros: limpeza, total do dia e backup', () => {
  const lixo = [null, 3, { id: 'a', data: '2026-11-19', esporte: 'futebol', min: 60 }, { id: 'a', data: '2026-11-19', esporte: 'volei', min: 30 }, { id: 'b', data: '2026-02-30', esporte: 'volei', min: 30 },
    { id: 'c', data: '2026-11-19', esporte: 'inexistente', min: 30 }, { id: 'd', data: '2026-11-19', esporte: 'natacao', min: MIN_MAX + 1 }, { id: 'e', data: '2026-11-18', esporte: 'patins', min: '45' }];
  const l = limparAtividades(lixo);
  assert.deepEqual(l.map((x) => [x.id, x.min]), [['e', 45], ['a', 60]]);
  const s = st({ atividades: l });
  const dia = gastoDoDia(s, '2026-11-19');
  assert.deepEqual([dia.min, dia.kcal, dia.itens[0].nome], [60, 490, 'Futebol (pelada)']);
  const volta = sanitize({ ...s, atividades: lixo });
  assert.deepEqual(volta.atividades, l);
});

test('esportes entram no aeróbico da semana (vigoroso vale 2; abaixo de 3 METs não conta)', () => {
  const agora = Date.parse('2026-11-19T20:00:00');
  const s = st({ atividades: [{ id: 'a', data: '2026-11-18', esporte: 'futebol', min: 60 }, { id: 'b', data: '2026-11-19', esporte: 'hidroginastica', min: 40 }, { id: 'c', data: '2026-11-19', esporte: 'ioga', min: 60 }] });
  const f = aerobicoFeito(s, agora);
  assert.deepEqual([f.relogio, f.equivalente], [100, 160]);
});

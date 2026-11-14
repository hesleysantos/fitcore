// Dores contadas ao Treinador: validação do registro e quais dores estão ativas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { limparDor, limparDores, doresAtivas, dorDeAlerta, MAX_DORES, DIAS_ATIVA, LOCAIS_DOR, TIPOS_DOR } from '../www/js/logic/dor.js';

const boa = (x = {}) => ({ id: 'dor1', data: '2026-11-06', onde: 'joelho', lado: 'd', tipo: 'articular', quando: 'durante', nivel: 3, nota: '', fim: '', ...x });

test('dor: registro válido passa inteiro; lixo é recusado', () => {
  assert.deepEqual(limparDor(boa()), boa());
  for (const ruim of [null, 5, 'x', [], {}, boa({ onde: '__proto__' }), boa({ onde: 'constructor' }), boa({ tipo: 'toString' }), boa({ onde: 'nariz' }), boa({ nivel: 0 }), boa({ nivel: 11 }), boa({ nivel: '3' }), boa({ nivel: NaN }),
    boa({ data: '2026-02-31' }), boa({ data: '06/11/2026' }), boa({ data: 20261106 }), boa({ id: '' }), boa({ id: 'a b' }), boa({ id: '<img>' }), boa({ id: 'x'.repeat(41) })]) {
    assert.equal(limparDor(ruim), null, JSON.stringify(ruim));
  }
  // campos opcionais estranhos viram o padrão; texto é cortado; "melhorou" antes da dor não vale
  const d = limparDor(boa({ lado: 'cima', quando: 'sempre', nota: 'a'.repeat(500), fim: '2026-11-01', extra: '<script>' }));
  assert.equal(d.lado, ''); assert.equal(d.quando, 'durante'); assert.equal(d.nota.length, 200); assert.equal(d.fim, ''); assert.ok(!('extra' in d));
  assert.equal(limparDor(boa({ nivel: 3.4 })).nivel, 3);
  assert.equal(limparDor(boa({ fim: '2026-11-09' })).fim, '2026-11-09');
});

test('dor: a lista tira repetidos, respeita o limite e sai em ordem de data', () => {
  assert.deepEqual(limparDores('x'), []); assert.deepEqual(limparDores(null), []);
  const muitas = Array.from({ length: MAX_DORES + 50 }, (_, i) => boa({ id: 'd' + i }));
  assert.equal(limparDores(muitas).length, MAX_DORES);
  const l = limparDores([boa({ id: 'b', data: '2026-11-08' }), boa({ id: 'a', data: '2026-11-02' }), boa({ id: 'a', data: '2026-11-03' }), { lixo: 1 }]);
  assert.deepEqual(l.map((x) => x.id + ':' + x.data), ['a:2026-11-02', 'b:2026-11-08']);
});

test('dor: ativas são as mais recentes de cada local e lado, sem "melhorou" e dentro do prazo', () => {
  const hoje = '2026-11-13';
  const st = { dores: [
    boa({ id: 'a', data: '2026-11-01', nivel: 6 }), boa({ id: 'b', data: '2026-11-10', nivel: 2 }), // mesmo joelho: vale o relato mais novo
    boa({ id: 'c', data: '2026-11-09', lado: 'e', nivel: 5 }), // o outro joelho conta separado
    boa({ id: 'd', data: '2026-11-11', onde: 'ombro', lado: '', nivel: 4, fim: '2026-11-12' }), // melhorou
    boa({ id: 'e', data: '2026-10-01', onde: 'lombar', lado: '' }), // velha demais
    boa({ id: 'f', data: '2026-11-20', onde: 'pe' }), // no futuro
  ] };
  const at = doresAtivas(st, hoje);
  assert.deepEqual(at.map((d) => d.id), ['c', 'b']); // da mais forte para a mais fraca
  assert.equal(at[0].dias, 4); assert.equal(at[1].dias, 3);
  // marcar "melhorou" no joelho direito não esconde o esquerdo
  st.dores[1].fim = hoje;
  assert.deepEqual(doresAtivas(st, hoje).map((d) => d.id), ['c']);
  // exatamente no limite do prazo ainda conta; um dia depois, não
  const lim = { dores: [boa({ data: '2026-10-23' })] };
  assert.equal(DIAS_ATIVA, 21);
  assert.equal(doresAtivas(lim, hoje).length, 1);
  assert.equal(doresAtivas(lim, '2026-11-14').length, 0);
  // entradas estranhas não quebram
  for (const x of [null, {}, { dores: 5 }, { dores: [null, 3, { onde: 'joelho' }] }]) assert.deepEqual(doresAtivas(x, hoje), []);
  assert.deepEqual(doresAtivas(st, 'hoje'), []);
});

test('dor: sinal de alerta e textos de todos os locais e tipos', () => {
  assert.equal(dorDeAlerta(boa()), false);
  assert.equal(dorDeAlerta(boa({ tipo: 'aguda' })), true); assert.equal(dorDeAlerta(boa({ nivel: 7 })), true); assert.equal(dorDeAlerta(boa({ quando: 'repouso' })), true);
  assert.equal(dorDeAlerta(null), false);
  for (const nome of Object.values(LOCAIS_DOR)) assert.ok(typeof nome === 'string' && nome.length > 1);
  for (const [nome, sub] of Object.values(TIPOS_DOR)) assert.ok(nome.length > 3 && sub.length > 10);
});

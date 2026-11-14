// Armazenamento: abrir o app com o banco do aparelho falhando não pode perder dados nem "ressuscitar" dados apagados.
// Usa um banco e um localStorage de mentira; cada cenário carrega uma cópia nova do módulo do estado.
import test from 'node:test';
import assert from 'node:assert/strict';

// ---------- aparelho de mentira ----------
const aparelho = { banco: new Map(), ls: new Map(), abrir: 'ok', gravar: 'ok' }; // abrir: 'ok' | 'erro'; gravar: 'ok' | 'aborta'
function pedido(fn) { const rq = {}; setTimeout(() => { try { rq.result = fn(); if (rq.onsuccess) rq.onsuccess(); } catch { if (rq.onerror) rq.onerror(); } }, 0); return rq; }
const fakeDb = {
  transaction() {
    const tx = {};
    const ops = [];
    const loja = {
      get: (k) => pedido(() => aparelho.banco.get(k)),
      put: (v, k) => { ops.push(() => aparelho.banco.set(k, JSON.parse(JSON.stringify(v)))); return {}; },
      delete: (k) => { ops.push(() => aparelho.banco.delete(k)); return {}; },
    };
    tx.objectStore = () => loja;
    setTimeout(() => { if (aparelho.gravar === 'aborta' && ops.length) { if (tx.onabort) tx.onabort(); return; } for (const o of ops) o(); if (tx.oncomplete) tx.oncomplete(); }, 5);
    return tx;
  },
};
globalThis.indexedDB = { open() { const rq = {}; setTimeout(() => { if (aparelho.abrir === 'ok') { rq.result = fakeDb; rq.onsuccess(); } else rq.onerror(); }, 0); return rq; } };
globalThis.localStorage = { getItem: (k) => (aparelho.ls.has(k) ? aparelho.ls.get(k) : null), setItem: (k, v) => { aparelho.ls.set(k, String(v)); }, removeItem: (k) => { aparelho.ls.delete(k); } };
globalThis.BroadcastChannel = undefined; // o canal entre janelas manteria o processo do teste aberto
globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {}, visibilityState: 'visible' };

let n = 0;
const abrirApp = async () => { const m = await import(`../www/js/store.js?abertura=${++n}`); await m.load(); return m; };
const esperar = (ms = 320) => new Promise((r) => setTimeout(r, ms));
const peso = (dia, kg) => ({ data: `2026-11-${String(dia).padStart(2, '0')}`, peso: kg, cintura: null });
const zerar = () => { aparelho.banco.clear(); aparelho.ls.clear(); aparelho.abrir = 'ok'; aparelho.gravar = 'ok'; };

test('armazenamento: uso normal grava no banco e reabre igual', async () => {
  zerar();
  let m = await abrirApp();
  assert.equal(m.armazenamentoOk(), true);
  m.update((s) => { s.body.push(peso(1, 80)); });
  await esperar();
  m = await abrirApp();
  assert.equal(m.state.body.length, 1);
  assert.equal(aparelho.ls.get('fitcore-tem-dados'), '1', 'marca de que este aparelho já tem dados no banco');
});

test('armazenamento: banco com erro em aparelho que já tinha dados não abre vazio', async () => {
  zerar();
  let m = await abrirApp();
  m.update((s) => { s.body.push(peso(1, 80)); });
  await esperar();
  aparelho.abrir = 'erro';
  await assert.rejects(abrirApp(), /banco indispon/);
  // o banco voltou: os dados estão lá
  aparelho.abrir = 'ok';
  m = await abrirApp();
  assert.equal(m.state.body.length, 1);
});

test('armazenamento: aparelho novo sem banco funciona pela reserva, mas essa reserva nunca apaga um banco com dados', async () => {
  zerar();
  aparelho.abrir = 'erro';
  let m = await abrirApp(); // nunca gravou no banco: abre vazio e usa a reserva
  assert.equal(m.armazenamentoOk(), false);
  m.update((s) => { s.body.push(peso(2, 70)); });
  await esperar();
  m = await abrirApp();
  assert.equal(m.state.body.length, 1, 'a reserva guarda os dados enquanto não há banco');
  // aparece um banco com dados reais (ex.: o navegador voltou a liberar o banco): ele vence a reserva feita "do nada"
  aparelho.banco.set('estado', { rev: 9, salvoEm: '', dados: { body: [peso(1, 80), peso(3, 79)] } });
  aparelho.abrir = 'ok';
  m = await abrirApp();
  assert.deepEqual(m.state.body.map((b) => b.peso), [80, 79]);
});

test('armazenamento: alteração feita com o banco fora do ar, a partir de dados reais, não se perde quando o banco volta', async () => {
  zerar();
  let m = await abrirApp();
  m.update((s) => { s.body.push(peso(1, 80)); });
  await esperar();
  // a gravação seguinte falha no banco e fica na reserva
  aparelho.gravar = 'aborta';
  m.update((s) => { s.body.push(peso(2, 79)); });
  await esperar();
  // reabre sem banco: vale a reserva (2 pesos); nova alteração também vai para a reserva
  aparelho.abrir = 'erro';
  m = await abrirApp();
  assert.equal(m.state.body.length, 2);
  m.update((s) => { s.body.push(peso(3, 78)); });
  await esperar();
  // o banco volta: os 3 pesos estão lá e voltam para o banco
  aparelho.abrir = 'ok'; aparelho.gravar = 'ok';
  m = await abrirApp();
  assert.deepEqual(m.state.body.map((b) => b.peso), [80, 79, 78]);
  await esperar();
  assert.equal(aparelho.banco.get('estado').dados.body.length, 3);
});

test('armazenamento: "apagar todos os dados" vale mesmo quando o banco não aceita a gravação', async () => {
  zerar();
  let m = await abrirApp();
  m.update((s) => { s.body.push(peso(1, 80)); s.body.push(peso(2, 79)); });
  await esperar();
  aparelho.gravar = 'aborta';
  assert.equal(await m.resetAll(), true);
  assert.equal(m.state.body.length, 0);
  aparelho.gravar = 'ok';
  m = await abrirApp();
  assert.equal(m.state.body.length, 0, 'os dados apagados não voltam');
  await esperar();
  assert.equal(aparelho.banco.get('estado').dados.body.length, 0, 'e o banco fica vazio na abertura seguinte');
  // caso normal
  m.update((s) => { s.body.push(peso(4, 77)); });
  await esperar();
  assert.equal(await m.resetAll(), true);
  m = await abrirApp();
  assert.equal(m.state.body.length, 0);
});

test('armazenamento: restaurar backup guarda os dados anteriores, e desfazer devolve também o treino em andamento', async () => {
  zerar();
  const m = await abrirApp();
  m.update((s) => { s.body.push(peso(1, 80)); s.current = { id: 's1', planId: '', diaId: '', nome: 'Treino livre', inicio: '2026-11-10T18:00:00.000Z', fim: '', nota: '', itens: [], restEnd: 0, restTotal: 0, volta: 0, cron: null }; });
  const backup = JSON.stringify({ app: 'fitcore', v: 1, dados: { body: [peso(5, 60)] } });
  assert.equal(await m.applyBackup(m.readBackup(backup).dados), true);
  assert.deepEqual(m.state.body.map((b) => b.peso), [60]);
  assert.equal(m.state.current, null);
  assert.equal(await m.restorePrevious(), true);
  assert.deepEqual(m.state.body.map((b) => b.peso), [80]);
  assert.equal(m.state.current && m.state.current.id, 's1');
  // sem banco para guardar a cópia anterior, a restauração avisa que não haverá "desfazer"
  aparelho.gravar = 'aborta';
  assert.equal(await m.applyBackup(m.readBackup(backup).dados), false);
});

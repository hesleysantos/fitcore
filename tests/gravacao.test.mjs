// Gravação dos dados: alterações em sequência rápida não podem se perder nem ser tomadas por "outra janela".
import test from 'node:test';
import assert from 'node:assert/strict';

// ----- ambiente mínimo de navegador: banco (IndexedDB) lento, armazenamento local e eventos -----
const banco = new Map();
const ATRASO = 25; // cada transação demora, para as gravações se cruzarem
function transacao() {
  const tx = { oncomplete: null, onerror: null, onabort: null };
  const pend = [];
  tx.objectStore = () => ({
    get(k) { const rq = { result: undefined, onsuccess: null, onerror: null }; pend.push(() => { rq.result = banco.has(k) ? structuredClone(banco.get(k)) : undefined; if (rq.onsuccess) rq.onsuccess(); }); return rq; },
    put(v, k) { pend.push(() => banco.set(k, structuredClone(v))); return {}; },
    delete(k) { pend.push(() => banco.delete(k)); return {}; },
  });
  setTimeout(() => { for (let i = 0; i < pend.length; i++) pend[i](); if (tx.oncomplete) tx.oncomplete(); }, ATRASO);
  return tx;
}
globalThis.indexedDB = { open() { const req = { result: { createObjectStore() {}, transaction: transacao }, onsuccess: null }; setTimeout(() => { if (req.onupgradeneeded) req.onupgradeneeded(); if (req.onsuccess) req.onsuccess(); }, 1); return req; } };
const local = new Map();
globalThis.localStorage = { getItem: (k) => (local.has(k) ? local.get(k) : null), setItem: (k, v) => { local.set(k, String(v)); }, removeItem: (k) => { local.delete(k); } };
const ouvintes = {};
globalThis.window = { addEventListener: (ev, fn) => { ouvintes[ev] = fn; } };
globalThis.document = { visibilityState: 'visible', addEventListener: (ev, fn) => { ouvintes['doc:' + ev] = fn; } };
delete globalThis.BroadcastChannel;

const store = await import('../www/js/store.js');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const noBanco = () => banco.get('estado');

test('gravação: alterações que se cruzam com uma gravação em andamento não se perdem', async () => {
  await store.load();
  let avisos = 0;
  store.onExternalChange(() => { avisos++; });
  store.update((s) => { s.settings.descanso = 60; });
  const a = store.flush();                       // 1ª gravação em andamento...
  store.update((s) => { s.settings.descanso = 120; s.body.push({ data: '2026-11-10', peso: 80, cintura: null }); });
  const b = store.flush();                       // ...e a 2ª começa antes de a 1ª terminar
  store.update((s) => { s.settings.descanso = 180; });
  const c = store.flush();
  await Promise.all([a, b, c]);
  await espera(300);                             // tempo para a gravação agendada terminar
  assert.equal(store.state.settings.descanso, 180, 'a última alteração continua na memória');
  assert.equal(store.state.body.length, 1, 'o peso registrado continua na memória');
  assert.equal(noBanco().dados.settings.descanso, 180, 'a última alteração chegou ao banco');
  assert.equal(noBanco().dados.body.length, 1);
  assert.equal(avisos, 0, 'nenhuma gravação própria foi tratada como "outra janela"');
});

test('gravação: muitas alterações seguidas (como marcar séries durante o treino) chegam todas ao banco', async () => {
  for (let i = 1; i <= 40; i++) {
    store.update((s) => { s.body.push({ data: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`, peso: 60 + i, cintura: null }); });
    await espera(i % 3 === 0 ? 30 : 5);          // ritmo irregular, cruzando com as gravações
    if (i % 7 === 0) store.flush();
  }
  await espera(400);
  assert.equal(store.state.body.length, 41);
  assert.equal(noBanco().dados.body.length, 41, 'todas as alterações estão gravadas');
  assert.equal(local.size, 0, 'sem cópia de reserva pendurada depois de gravar tudo');
});

test('gravação: outra janela que grava dados mais novos continua sendo respeitada', async () => {
  let motivo = null;
  store.onExternalChange((m) => { motivo = m || 'outra'; });
  const atual = noBanco();
  const deFora = structuredClone(atual);
  deFora.rev = atual.rev + 5;
  deFora.dados.settings.descanso = 45;
  banco.set('estado', deFora);                   // outra janela gravou
  store.update((s) => { s.settings.som = false; });
  await store.flush();
  await espera(100);
  assert.equal(motivo, 'conflito', 'o conflito com outra janela é detectado');
  assert.equal(store.state.settings.descanso, 45, 'ficam os dados mais novos da outra janela');
  assert.equal(noBanco().rev, atual.rev + 5, 'a gravação antiga não passou por cima');
});

test('gravação: ao sair da tela com gravação pendente, a reserva guarda a última alteração', async () => {
  store.update((s) => { s.settings.descanso = 75; });
  const emCurso = store.flush();
  store.update((s) => { s.settings.descanso = 90; });   // alteração feita com a gravação em andamento
  ouvintes.pagehide();                                   // o app vai para segundo plano / fecha
  const reserva = JSON.parse(local.get('fitcore.estado'));
  assert.equal(reserva.dados.settings.descanso, 90, 'a reserva tem a alteração mais recente, na hora');
  assert.ok(reserva.rev > noBanco().rev, 'a reserva é reconhecida como mais nova que o banco');
  await emCurso;
  await espera(300);
  assert.equal(noBanco().dados.settings.descanso, 90, 'se o app continua aberto, o banco também recebe');
  assert.equal(local.size, 0, 'e a reserva é dispensada');
});

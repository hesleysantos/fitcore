// Service worker do FitCore — gerado por tools/build-sw.mjs. Não edite à mão.
// Guarda todos os arquivos do aplicativo no aparelho na primeira abertura; depois disso o app
// abre e funciona sem internet. Só atende pedidos do próprio site (mesma origem).
const VERSION = '933bc702338c';
const CACHE = 'fitcore-' + VERSION;
const FILES = ["./","css/app.css","css/chat.css","css/corrida.css","css/fig.css","css/sono.css","css/treino.css","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/icon.svg","index.html","js/anim/base.js","js/anim/body.js","js/anim/casa.js","js/anim/core.js","js/anim/equip.js","js/anim/extra.js","js/anim/geom.js","js/anim/index.js","js/anim/lower.js","js/anim/mais.js","js/anim/maos.js","js/anim/pecas.js","js/anim/rig.js","js/anim/upper.js","js/data/ajuda.js","js/data/cargas.js","js/data/corrida.js","js/data/equipment.js","js/data/esportes.js","js/data/ex/abdomen.js","js/data/ex/adutores.js","js/data/ex/antebraco.js","js/data/ex/biceps.js","js/data/ex/cardio.js","js/data/ex/casa.js","js/data/ex/costas.js","js/data/ex/funcional.js","js/data/ex/gluteos.js","js/data/ex/mais.js","js/data/ex/ombros.js","js/data/ex/panturrilhas.js","js/data/ex/peito.js","js/data/ex/posteriores.js","js/data/ex/quadriceps.js","js/data/ex/triceps.js","js/data/exercises.js","js/data/foods.js","js/data/knowledge.js","js/data/muscles.js","js/data/sono.js","js/data/templates.js","js/device.js","js/figure.js","js/install.js","js/logic/ajuste-semana.js","js/logic/avaliacao.js","js/logic/cardio.js","js/logic/carga-corrida.js","js/logic/carga.js","js/logic/chat/comum.js","js/logic/chat/contrato.js","js/logic/chat/corrida.js","js/logic/chat/entidades.js","js/logic/chat/exemplos.js","js/logic/chat/exercicio.js","js/logic/chat/habitos.js","js/logic/chat/motor.js","js/logic/chat/nlu.js","js/logic/chat/nutri.js","js/logic/chat/saude.js","js/logic/chat/treino.js","js/logic/combinado.js","js/logic/corrida.js","js/logic/diario.js","js/logic/dias-livres.js","js/logic/dor.js","js/logic/escolhas.js","js/logic/esportes.js","js/logic/esteira.js","js/logic/exportar.js","js/logic/gasto.js","js/logic/guiado.js","js/logic/insights.js","js/logic/nutrition.js","js/logic/objetivos.js","js/logic/pausa.js","js/logic/perdido.js","js/logic/progress.js","js/logic/saude-fora.js","js/logic/saude.js","js/logic/semana-nutricao.js","js/logic/sono.js","js/logic/trainer.js","js/logic/treino-extra.js","js/logic/trocar-dias.js","js/logic/variacao.js","js/main.js","js/router.js","js/store.js","js/ui.js","js/views/ajuste-semana.js","js/views/arquivo.js","js/views/avaliacao.js","js/views/charts.js","js/views/chat.js","js/views/coach.js","js/views/combinado.js","js/views/common.js","js/views/corrida.js","js/views/diario.js","js/views/dor.js","js/views/esportes.js","js/views/exercises.js","js/views/exportar.js","js/views/history.js","js/views/home.js","js/views/more.js","js/views/nutrition.js","js/views/perdido.js","js/views/plans.js","js/views/saude-fora.js","js/views/session.js","js/views/sono.js","js/views/termos.js","js/views/trainer.js","js/views/trocar-dias.js","js/views/variacao.js","manifest.webmanifest"];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // baixa tudo sem usar o cache HTTP; se qualquer arquivo falhar, a instalação inteira falha (nada pela metade)
    await Promise.all(FILES.map(async (url) => {
      const res = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
      if (!res.ok || res.type !== 'basic') throw new Error('Falha ao baixar ' + url);
      // resposta vinda de redirecionamento não pode ser usada numa navegação: guarda uma cópia "limpa"
      await cache.put(url, res.redirected ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('fitcore-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nunca intercepta outros sites
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); } catch {
      // sem internet: qualquer endereço do app abre a tela principal
      if (req.mode === 'navigate') { const index = await cache.match('./'); if (index) return index; }
      return new Response('Sem conexão.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});

// toque na notificação do fim do descanso: volta para o aplicativo
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of janelas) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  })());
});

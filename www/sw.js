// Service worker do FitCore — gerado por tools/build-sw.mjs. Não edite à mão.
// Guarda todos os arquivos do aplicativo no aparelho na primeira abertura; depois disso o app
// abre e funciona sem internet. Só atende pedidos do próprio site (mesma origem).
const VERSION = 'b3c0cc6e3aef';
const CACHE = 'fitcore-' + VERSION;
const FILES = ["./","css/app.css","css/fig.css","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/icon.svg","index.html","js/anim/base.js","js/anim/body.js","js/anim/core.js","js/anim/equip.js","js/anim/extra.js","js/anim/geom.js","js/anim/index.js","js/anim/lower.js","js/anim/maos.js","js/anim/rig.js","js/anim/upper.js","js/data/equipment.js","js/data/ex/abdomen.js","js/data/ex/adutores.js","js/data/ex/antebraco.js","js/data/ex/biceps.js","js/data/ex/cardio.js","js/data/ex/costas.js","js/data/ex/funcional.js","js/data/ex/gluteos.js","js/data/ex/ombros.js","js/data/ex/panturrilhas.js","js/data/ex/peito.js","js/data/ex/posteriores.js","js/data/ex/quadriceps.js","js/data/ex/triceps.js","js/data/exercises.js","js/data/foods.js","js/data/knowledge.js","js/data/muscles.js","js/data/templates.js","js/device.js","js/figure.js","js/install.js","js/logic/insights.js","js/logic/nutrition.js","js/logic/objetivos.js","js/logic/pausa.js","js/logic/progress.js","js/logic/trainer.js","js/main.js","js/router.js","js/store.js","js/ui.js","js/views/charts.js","js/views/coach.js","js/views/common.js","js/views/exercises.js","js/views/history.js","js/views/home.js","js/views/more.js","js/views/nutrition.js","js/views/plans.js","js/views/session.js","js/views/trainer.js","manifest.webmanifest"];

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

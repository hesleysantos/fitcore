// Gera www/sw.js com a lista de todos os arquivos do aplicativo, para funcionar 100% offline.
// Rode sempre que mudar qualquer arquivo de www/:  node tools/build-sw.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WWW = path.join(ROOT, 'www');
const SKIP = new Set(['sw.js', '_headers']);

function walk(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const rel = base ? base + '/' + name : name;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, rel));
    else if (!SKIP.has(rel) && !name.startsWith('.')) out.push(rel);
  }
  return out;
}
const files = walk(WWW);
const hash = crypto.createHash('sha256');
for (const f of files) { hash.update(f); hash.update(fs.readFileSync(path.join(WWW, f))); }
const version = hash.digest('hex').slice(0, 12);

const sw = `// Service worker do FitCore — gerado por tools/build-sw.mjs. Não edite à mão.
// Guarda todos os arquivos do aplicativo no aparelho na primeira abertura; depois disso o app
// abre e funciona sem internet. Só atende pedidos do próprio site (mesma origem).
const VERSION = '${version}';
const CACHE = 'fitcore-' + VERSION;
const FILES = ${JSON.stringify(['./', ...files], null, 0)};

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
`;
fs.writeFileSync(path.join(WWW, 'sw.js'), sw);
console.log(`sw.js gerado: ${files.length} arquivos, versão ${version}`);

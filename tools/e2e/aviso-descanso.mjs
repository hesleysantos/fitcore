// Teste de ponta a ponta do aviso do descanso com o app em segundo plano: ao sair do app com o descanso rodando, aparece
// a notificação com o tempo que falta e a hora do fim, atualizada em silêncio; no fim, "Descanso terminado"; ao voltar,
// as notificações somem. O navegador sem janela não tem central de notificações: o roteiro troca a permissão, o
// registro do service worker e a visibilidade da página por versões de mentira que registram o que o app fez.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/aviso-descanso.mjs
const B = 'http://localhost:5173/';

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__av = { mostradas: [], fechadas: 0, vis: 'visible' };
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__av.vis });
    window.Notification = class { static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } };
    const reg = {
      showNotification: async (titulo, o) => { window.__av.mostradas.push({ titulo, body: o.body, silent: !!o.silent, renotify: !!o.renotify, tag: o.tag }); },
      getNotifications: async () => window.__av.mostradas.length ? [{ close: () => { window.__av.fechadas++; } }] : [],
    };
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = async () => reg;
  })();` });
  const av = () => page.eval(`return JSON.stringify(window.__av);`).then(JSON.parse);
  const mudar = (vis) => page.eval(`window.__av.vis = '${vis}'; document.dispatchEvent(new Event('visibilitychange')); return true;`);

  await page.goto(B, 1500);
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.ui.onboarded = true; s.ui.installDismissedAt = new Date().toISOString(); s.settings.avisoFundo = true; }); await new Promise((r) => setTimeout(r, 300)); return true;`);

  console.log('1. Descanso rodando e a pessoa sai do app');
  await page.eval(`const d = await import('/js/device.js'); d.agendarAviso(Date.now() + 12000); return true;`);
  await mudar('hidden'); await page.sleep(400);
  let a = await av();
  const primeira = a.mostradas[0] || {};
  ok(/^Descanso: faltam 0:1\d$/.test(primeira.titulo || '') && /^Termina às \d\d:\d\d\. Toque para voltar ao treino\.$/.test(primeira.body || '') && primeira.silent && !primeira.renotify, 'notificação com o tempo que falta e a hora do fim, sem som: ' + JSON.stringify(primeira));
  await page.sleep(5600);
  a = await av();
  ok(a.mostradas.length >= 2 && a.mostradas[a.mostradas.length - 1].titulo !== primeira.titulo && a.mostradas.every((n) => n.tag === a.mostradas[0].tag), 'a contagem é atualizada na mesma notificação: ' + a.mostradas.map((n) => n.titulo).join(' → '));
  await page.sleep(6500);
  a = await av();
  const ultima = a.mostradas[a.mostradas.length - 1] || {};
  ok(ultima.titulo === 'Descanso terminado' && ultima.renotify, 'no fim, a notificação vira "Descanso terminado", com aviso: ' + JSON.stringify(ultima));
  const total = a.mostradas.length; await page.sleep(5500);
  ok((await av()).mostradas.length === total, 'depois do fim, a contagem para');

  console.log('2. Ao voltar para o app, as notificações somem');
  await mudar('visible'); await page.sleep(300);
  ok((await av()).fechadas >= 1, 'voltar para o app fecha a notificação');

  console.log('3. Descanso pulado ou opção desligada: nada aparece');
  await page.eval(`window.__av.mostradas = []; const d = await import('/js/device.js'); d.agendarAviso(Date.now() + 20000); d.cancelarAviso(); return true;`);
  await mudar('hidden'); await page.sleep(600);
  ok((await av()).mostradas.length === 0, 'descanso cancelado antes de sair: nenhuma notificação');
  await mudar('visible');
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.settings.avisoFundo = false; }); window.__av.mostradas = []; const d = await import('/js/device.js'); d.agendarAviso(Date.now() + 20000); return true;`);
  await mudar('hidden'); await page.sleep(600);
  ok((await av()).mostradas.length === 0, 'com o aviso desligado em Ajustes: nenhuma notificação');
  await mudar('visible');

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

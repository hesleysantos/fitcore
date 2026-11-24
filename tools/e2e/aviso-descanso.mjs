// Teste de ponta a ponta do aviso do descanso com o app em segundo plano (device.js):
// 1) ao sair do app com o descanso rodando, aparece UMA notificação, em silêncio, com a hora do fim (nada de repostar a
//    cada 5 s); no fim, a mesma etiqueta vira "Descanso terminado", com aviso; ao voltar, as notificações somem;
// 2) enquanto o descanso corre, o app toca pela Web Audio o tom que o mantém vivo no Android (30 Hz, −60 dBFS), e ele
//    para no fim e quando o descanso é cancelado;
// 3) com "Som com a tela bloqueada", o descanso toca como uma faixa de áudio do tamanho do descanso;
// 4) descanso pulado ou opção desligada: nenhuma notificação.
// O navegador sem janela não tem central de notificações: o roteiro troca a permissão, o registro do service worker e a
// visibilidade da página por versões de mentira que registram o que o app fez.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/aviso-descanso.mjs
const B = 'http://localhost:5173/';

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__av = { mostradas: [], fechadas: 0, vis: 'visible', tons: [], parados: 0, faixas: [] };
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__av.vis });
    window.Notification = class { static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } };
    const reg = {
      showNotification: async (titulo, o) => { window.__av.mostradas.push({ titulo, body: o.body, silent: !!o.silent, renotify: !!o.renotify, tag: o.tag, badge: o.badge }); },
      getNotifications: async () => window.__av.mostradas.length ? [{ close: () => { window.__av.fechadas++; } }] : [],
    };
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = async () => reg;
    // os osciladores contínuos (o tom que mantém o app vivo) e as faixas de áudio
    const start = OscillatorNode.prototype.start, stop = OscillatorNode.prototype.stop;
    OscillatorNode.prototype.start = function (...a) { if (!a.length) window.__av.tons.push(this.frequency.value); return start.apply(this, a); };
    OscillatorNode.prototype.stop = function (...a) { if (!a.length) window.__av.parados++; return stop.apply(this, a); };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { if (/^blob:/.test(this.src)) window.__av.faixas.push({ src: this.src, t: Date.now() }); return play.call(this).catch(() => {}); };
  })();` });
  const av = () => page.eval(`return JSON.stringify(window.__av);`).then(JSON.parse);
  const mudar = (vis) => page.eval(`window.__av.vis = '${vis}'; document.dispatchEvent(new Event('visibilitychange')); return true;`);

  await page.goto(B, 2000);
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.ui.onboarded = true; s.ui.installDismissedAt = new Date().toISOString(); s.settings.avisoFundo = true; }); await new Promise((r) => setTimeout(r, 300)); return true;`);
  // um toque libera o som (como no treino)
  await page.eval(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); (await import('/js/device.js')).unlockAudio(); return true;`);

  console.log('1. Descanso rodando e a pessoa sai do app');
  await page.eval(`const d = await import('/js/device.js'); d.agendarAviso(Date.now() + 9000); return true;`);
  let a = await av();
  ok(a.tons.includes(30), 'o tom que mantém o app vivo começa com o descanso: ' + JSON.stringify(a.tons));
  await mudar('hidden'); await page.sleep(400);
  a = await av();
  const primeira = a.mostradas[0] || {};
  ok(a.mostradas.length === 1 && primeira.titulo === 'Descanso em andamento' && /^Termina às \d\d:\d\d:\d\d\. Toque para voltar ao treino\.$/.test(primeira.body || '') && primeira.silent && !primeira.renotify && primeira.badge === 'icons/badge-96.png', 'uma notificação, sem som, com a hora do fim: ' + JSON.stringify(a.mostradas));
  await page.sleep(6000);
  ok((await av()).mostradas.length === 1, 'nada de repostar a notificação durante o descanso');
  await page.sleep(3500);
  a = await av();
  const ultima = a.mostradas[a.mostradas.length - 1] || {};
  ok(a.mostradas.length === 2 && ultima.titulo === 'Descanso terminado' && ultima.renotify && ultima.tag === primeira.tag, 'no fim, a mesma notificação vira "Descanso terminado", com aviso: ' + JSON.stringify(ultima));
  ok(a.parados >= 1, 'o tom para no fim do descanso');

  console.log('2. Ao voltar para o app, as notificações somem');
  await mudar('visible'); await page.sleep(300);
  ok((await av()).fechadas >= 1, 'voltar para o app fecha a notificação');

  console.log('3. "Som com a tela bloqueada": o descanso vira uma faixa de áudio');
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.settings.somFaixa = true; }); window.__av.faixas = []; const d = await import('/js/device.js'); d.agendarAviso(Date.now() + 20000); await new Promise((r) => setTimeout(r, 900)); return true;`);
  a = await av();
  ok(a.faixas.length === 1, 'a faixa começa a tocar com o descanso');
  await page.eval(`(await import('/js/device.js')).cancelarAviso(); const m = await import('/js/store.js'); m.update((s) => { s.settings.somFaixa = false; }); return true;`);

  console.log('4. Descanso pulado ou opção desligada: nada aparece');
  await page.eval(`window.__av.mostradas = []; window.__av.parados = 0; const d = await import('/js/device.js'); d.agendarAviso(Date.now() + 20000); d.cancelarAviso(); return true;`);
  ok((await av()).parados >= 1, 'descanso cancelado: o tom para');
  await mudar('hidden'); await page.sleep(600);
  ok((await av()).mostradas.length === 0, 'descanso cancelado antes de sair: nenhuma notificação');
  await mudar('visible');
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.settings.avisoFundo = false; }); window.__av.mostradas = []; const d = await import('/js/device.js'); d.agendarAviso(Date.now() + 20000); return true;`);
  await mudar('hidden'); await page.sleep(600);
  ok((await av()).mostradas.length === 0, 'com a notificação desligada em Ajustes: nenhuma notificação');
  await mudar('visible');
  await page.eval(`(await import('/js/device.js')).cancelarAviso(); return true;`);

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

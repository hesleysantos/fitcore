// Teste de ponta a ponta da marca: enquanto o app carrega, o símbolo com um anel girando em volta, no modo do aparelho
// (fundo branco no claro, escuro no escuro); nada de logo completa na abertura nem espera fixa: a primeira tela entra
// assim que fica pronta. No topo do Início, o símbolo na versão do tema do app; no Sobre, a logo completa; e o ícone do
// aplicativo. Em 360 px, sem rolagem para o lado e sem erro no console.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/marca.mjs
import fs from 'node:fs';
const B = 'http://localhost:5173/';

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  // a imagem visível (e carregada) dentro de um seletor
  const visivel = (sel) => page.eval(`return [...document.querySelectorAll(${JSON.stringify(sel)})].filter((i) => i.offsetWidth > 0 && i.complete && i.naturalWidth > 0).map((i) => i.getAttribute('src'));`);

  console.log('1. Carregando: o símbolo com o anel girando, no modo do aparelho');
  // com o código do app bloqueado, a tela de carregamento fica parada para conferir
  await page.send('Network.setBlockedURLs', { urls: ['*js/main.js'] });
  for (const [modo, v, fundo] of [['light', 'claro', 'rgb(255, 255, 255)'], ['dark', 'escuro', 'rgb(14, 17, 22)']]) {
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: modo }] });
    await page.goto(B, 1200);
    ok(JSON.stringify(await visivel('.carregando img')) === JSON.stringify([`icons/simbolo-${v}.png`]), `modo ${v}: o símbolo ${v}`);
    const r = await page.eval(`const a = document.querySelector('.carregando .anel'), i = [...document.querySelectorAll('.carregando img')].find((x) => x.offsetWidth); if (!a || !i) return null; const ca = a.getBoundingClientRect(), ci = i.getBoundingClientRect(), s = getComputedStyle(a);
      return { anim: s.animationName, roda: a.getAnimations().some((x) => x.playState === 'running'), centro: Math.abs((ca.left + ca.width / 2) - (ci.left + ci.width / 2)) < 1.5 && Math.abs((ca.top + ca.height / 2) - (ci.top + ci.height / 2)) < 1.5, meio: Math.abs(ca.top + ca.height / 2 - innerHeight / 2) < 4, fundo: getComputedStyle(document.querySelector('.carregando')).backgroundColor, arco: s.borderTopColor, logo: !!document.getElementById('abertura'), status: document.querySelector('.carregando').getAttribute('role') };`);
    ok(r && r.anim === 'gira' && r.roda && r.centro && r.meio, `modo ${v}: o anel gira em volta do símbolo, no meio da tela: ` + JSON.stringify(r));
    ok(r && r.fundo === fundo, `modo ${v}: fundo ` + (r && r.fundo));
    ok(r && !r.logo && r.status === 'status', 'sem a logo completa na abertura; avisa "Carregando" ao leitor de tela');
    await page.shot('marca/carregando-' + v);
  }
  await page.send('Network.setBlockedURLs', { urls: [] });

  console.log('2. A primeira tela entra assim que fica pronta');
  await page.goto(B, 1500);
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.ui.onboarded = true; s.ui.installDismissedAt = new Date().toISOString(); s.settings.tema = 'auto'; }); return 1;`);
  await page.reload(150);
  const t = await page.eval(`for (let i = 0; i < 100 && !document.querySelector('.topbar'); i++) await new Promise((r) => setTimeout(r, 20)); const dcl = performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd; return { ms: Math.round(performance.now() - dcl), carregando: !!document.querySelector('.carregando') };`);
  ok(t.ms < 800 && !t.carregando, 'Início desenhado logo depois que a página carrega, sem a espera fixa de antes (1,2 s): ' + JSON.stringify(t));

  for (const modo of ['light', 'dark']) {
    console.log(`Aparelho no modo ${modo === 'light' ? 'claro' : 'escuro'}`);
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: modo }] });
    await page.reload(1200);
    const v = modo === 'light' ? 'claro' : 'escuro';
    ok(JSON.stringify(await visivel('.topbar .marca')) === JSON.stringify([`icons/simbolo-${v}.png`]), `topo do Início: o símbolo, versão ${v}`);
    ok(await page.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`), 'sem rolagem para o lado');
    await page.shot('marca/inicio-' + v);
  }
  // o tema do app vale por cima do modo do aparelho
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.settings.tema = 'claro'; }); return 1;`);
  await page.sleep(300);
  ok(JSON.stringify(await visivel('.topbar .marca')) === JSON.stringify(['icons/simbolo-claro.png']), 'tema claro no app (aparelho escuro): o símbolo claro');
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.settings.tema = 'auto'; }); return 1;`);
  // Sobre: a logo completa
  await page.goto(B + '#/sobre', 2200);
  ok((await visivel('.logo-sobre')).length === 1, 'Sobre: a logo completa');
  // ícones do aplicativo
  const man = JSON.parse(fs.readFileSync(new URL('../../www/manifest.webmanifest', import.meta.url), 'utf8'));
  for (const i of man.icons) { const b = fs.readFileSync(new URL('../../www/' + i.src, import.meta.url)); ok(b.readUInt32BE(16) === Number(i.sizes.split('x')[0]) && b.slice(1, 4).toString() === 'PNG', 'ícone no manifesto: ' + i.src + ' (' + i.sizes + ')'); }
  await page.send('Emulation.setEmulatedMedia', { features: [] });

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

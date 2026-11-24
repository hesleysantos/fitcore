// Teste de ponta a ponta da marca: na abertura, a logo completa (a versão clara com o aparelho no modo claro, a escura no
// modo escuro), que some sozinha depois de cerca de 1,2 s; no topo do Início, o símbolo na versão do tema do app; e o
// ícone do aplicativo. Em 360 px, sem rolagem para o lado e sem erro no console.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/marca.mjs
import fs from 'node:fs';
const B = 'http://localhost:5173/';

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  // a imagem visível (e carregada) dentro de um seletor
  const visivel = (sel) => page.eval(`return [...document.querySelectorAll(${JSON.stringify(sel)})].filter((i) => i.offsetWidth > 0 && i.complete && i.naturalWidth > 0).map((i) => i.getAttribute('src'));`);
  await page.goto(B, 1500);
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.ui.onboarded = true; s.ui.installDismissedAt = new Date().toISOString(); s.settings.tema = 'auto'; }); return 1;`);

  for (const modo of ['light', 'dark']) {
    console.log(`Aparelho no modo ${modo === 'light' ? 'claro' : 'escuro'}`);
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: modo }] });
    await page.reload(350);
    const v = modo === 'light' ? 'claro' : 'escuro';
    ok(JSON.stringify(await visivel('#abertura img')) === JSON.stringify([`icons/logo-${v}.png`]), `abertura: a logo completa, versão ${v}`);
    const fundo = await page.eval(`const a = document.getElementById('abertura'); return a ? getComputedStyle(a).backgroundColor : '';`);
    ok(fundo === (modo === 'light' ? 'rgb(255, 255, 255)' : 'rgb(14, 17, 22)'), 'fundo da abertura: ' + fundo);
    await page.shot('marca/abertura-' + v);
    await page.sleep(2200);
    ok(!(await page.eval(`return !!document.getElementById('abertura');`)), 'a abertura some sozinha');
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

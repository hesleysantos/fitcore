// Teste de ponta a ponta da atualização do aplicativo (main.js, registerSw):
// 1) versão nova publicada: o service worker novo se instala e aparece a barra "Nova versão do FitCore pronta." com
//    "Atualizar", que fica na tela até a pessoa tocar; tocar recarrega já na versão nova;
// 2) ao voltar para o app (visibilitychange), ele procura versão nova, no máximo a cada 30 min;
// 3) depois de atualizar, um aviso único "FitCore atualizado para a versão X.".
// Para simular a versão nova, o roteiro muda o www/sw.js por alguns segundos e devolve o original no fim.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/atualizacao.mjs
import fs from 'node:fs';
const B = 'http://localhost:5173/';
const SW = new URL('../../www/sw.js', import.meta.url);
export const comServiceWorker = true; // o motor de teste deixa o service worker de lado, a não ser que o roteiro peça

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 2000);
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.ui.onboarded = true; s.ui.installDismissedAt = new Date().toISOString(); }); return 1;`);
  // espera o service worker assumir a página
  for (let i = 0; i < 10 && !(await page.eval(`return !!navigator.serviceWorker.controller;`)); i++) await page.reload(1500);
  ok(await page.eval(`return !!navigator.serviceWorker.controller;`), 'o service worker cuida do app');
  const versao = await page.eval(`return (await import('/js/views/more.js')).APP_VERSAO;`);

  console.log('1. Depois de atualizar: aviso uma vez');
  await page.eval(`localStorage.setItem('fitcore-versao', '1.0.0'); return 1;`);
  await page.reload(1200);
  let txt = await page.eval(`return (document.querySelector('.toast') || {}).textContent || '';`);
  ok(txt === `FitCore atualizado para a versão ${versao}.`, 'aviso da versão nova: ' + txt);
  await page.reload(1200);
  ok(!(await page.eval(`return !!document.querySelector('.toast');`)), 'na abertura seguinte, sem aviso');

  console.log('2. Ao voltar para o app, procura versão nova (no máximo a cada 30 min)');
  const n = await page.eval(`let n = 0; const up = ServiceWorkerRegistration.prototype.update; ServiceWorkerRegistration.prototype.update = function () { n++; return up.call(this); };
    const ver = () => document.dispatchEvent(new Event('visibilitychange'));
    ver(); const antes = n;
    const agora = Date.now; Date.now = () => agora() + 31 * 60000; ver(); const depois = n; ver(); const deNovo = n;
    Date.now = agora; ServiceWorkerRegistration.prototype.update = up; return { antes, depois, deNovo };`);
  ok(n.antes === 0 && n.depois === 1 && n.deNovo === 1, 'volta logo depois: não procura; depois de 30 min: procura uma vez: ' + JSON.stringify(n));

  console.log('3. Versão nova publicada: a barra "Atualizar"');
  // (se uma execução anterior foi interrompida no meio, tira a marca que ficou)
  const original = Buffer.from(fs.readFileSync(SW, 'utf8').replace(/\n\/\/ versão de teste\n$/, ''));
  try {
    fs.writeFileSync(SW, Buffer.concat([original, Buffer.from('\n// versão de teste\n')]));
    await page.eval(`(await navigator.serviceWorker.getRegistration()).update(); return 1;`);
    let barra = null;
    for (let i = 0; i < 40 && !barra; i++) { await page.sleep(500); barra = await page.eval(`const b = document.querySelector('.barra-versao'); return b ? { txt: b.innerText, botao: !!b.querySelector('button'), topo: Math.round(b.getBoundingClientRect().top) } : null;`); }
    ok(barra && /Nova versão do FitCore pronta\./.test(barra.txt) && barra.botao, 'aparece a barra com "Atualizar": ' + JSON.stringify(barra));
    ok(await page.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`), 'sem rolagem para o lado');
    await page.shot('atualizacao/barra');
    await page.sleep(3500);
    ok(await page.eval(`return !!document.querySelector('.barra-versao');`), 'a barra continua na tela (não some sozinha)');
    await page.eval(`document.querySelector('.barra-versao button').click(); return 1;`);
    await page.sleep(2500); await page.pronto();
    ok(!(await page.eval(`return !!document.querySelector('.barra-versao');`)) && await page.eval(`return !!document.querySelector('.topbar');`), 'tocar em "Atualizar" recarrega o app');
  } finally {
    fs.writeFileSync(SW, original);
  }

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

// Teste de ponta a ponta do aviso do fim do descanso por cima da música (1.14.0):
//  • Android (e computador): cada som é gravado uma vez como um áudio curto (menos de 5 s) e tocado por um <audio>,
//    o jeito que faz o Android só abaixar a música de outro aplicativo enquanto o aviso toca;
//  • o relógio do app avisa mesmo fora da tela do treino e toca uma vez só;
//  • iPhone: o som sai pelo contexto de áudio, e a fala "Descanso terminado" (que no iPhone abaixa a música) junto.
// O navegador sem janela não tem saída de som: o roteiro só confere o que o app pede ao navegador.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/som-musica.mjs
const B = 'http://localhost:5173/';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__plays = []; window.__falas = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__plays.push({ src: this.src, muted: this.muted }); return Promise.resolve(); };
    if (window.speechSynthesis) { window.speechSynthesis.speak = (u) => { window.__falas.push(u.text); }; window.speechSynthesis.cancel = () => {}; }
  })();` });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 1500);
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.ui.onboarded = true; s.ui.installDismissedAt = new Date().toISOString(); s.settings.som = true; s.settings.somAlerta = 'equilibrado'; s.settings.voz = true; }); await new Promise((r) => setTimeout(r, 300)); return 1;`);
  await page.goto(B + '#/ajustes', 900);

  console.log('1. Android: o aviso sai como áudio curto gravado (a música só abaixa)');
  // um toque em qualquer ponto libera o áudio e grava o som escolhido
  await page.eval(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return 1;`);
  await page.sleep(800);
  await page.eval(`const d = await import('/js/device.js'); window.__plays = []; d.tocarAlerta('equilibrado'); return 1;`);
  await page.sleep(200);
  const p1 = await page.eval(`return window.__plays;`);
  ok(p1.length === 1 && /^blob:/.test(p1[0].src) && !p1[0].muted, 'toca pelo <audio>, com o som gravado: ' + JSON.stringify(p1));
  const dur = await page.eval(`const a = new Audio(window.__plays[0].src); await new Promise((r) => { a.onloadedmetadata = r; a.onerror = r; setTimeout(r, 1500); }); return a.duration;`);
  ok(Number.isFinite(dur) && dur > 0.5 && dur < 5, 'o áudio gravado tem menos de 5 segundos: ' + dur);
  // trocar o som em Ajustes grava o novo
  await page.eval(`document.querySelector('#som-alerta .chip[data-som="sino"]').click(); return 1;`);
  await page.sleep(800);
  const p2 = await page.eval(`const d = await import('/js/device.js'); window.__plays = []; d.tocarAlerta('sino'); await new Promise((r) => setTimeout(r, 100)); return window.__plays;`);
  ok(p2.length === 1 && /^blob:/.test(p2[0].src) && p2[0].src !== p1[0].src, 'o sino tem a própria gravação');

  console.log('2. O fim do descanso avisa em qualquer tela, uma vez só, com a fala');
  await page.goto(B + '#/treinos', 900);
  await page.eval(`const d = await import('/js/device.js'); window.__plays = []; window.__falas = []; d.vigiarDescanso(Date.now() + 400); return 1;`);
  await page.sleep(1200);
  const p3 = await page.eval(`return { plays: window.__plays.length, falas: window.__falas };`);
  ok(p3.plays === 1, 'fora da tela do treino, o aviso toca uma vez: ' + p3.plays);
  ok(p3.falas.length === 1 && p3.falas[0] === 'Descanso terminado', 'diz “Descanso terminado”: ' + JSON.stringify(p3.falas));
  const fimJa = await page.eval(`const d = await import('/js/device.js'); window.__plays = []; const f = Date.now() - 200; d.alertaDoDescanso(f); d.alertaDoDescanso(f); return window.__plays.length;`);
  ok(fimJa === 1, 'o mesmo fim de descanso não toca duas vezes');
  const velho = await page.eval(`const d = await import('/js/device.js'); window.__plays = []; d.alertaDoDescanso(Date.now() - 120000); return window.__plays.length;`);
  ok(velho === 0, 'descanso que acabou há mais de 1 minuto (app em segundo plano): só a tela mostra');
  // sem a fala ligada, só o som
  const semVoz = await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.settings.voz = false; }); const d = await import('/js/device.js'); window.__falas = []; d.alertaDoDescanso(Date.now() - 10); return window.__falas.length;`);
  ok(semVoz === 0, '“Falar o aviso” desligado: sem fala');

  console.log('3. iPhone: som pelo contexto de áudio e a fala (que abaixa a música)');
  await page.send('Emulation.setUserAgentOverride', { userAgent: IPHONE, platform: 'iPhone' });
  await page.goto(B + '#/ajustes', 1200);
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.settings.voz = true; s.settings.somAlerta = 'equilibrado'; }); return 1;`);
  await page.eval(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return 1;`);
  await page.sleep(600);
  const ios = await page.eval(`const d = await import('/js/device.js'); window.__plays = []; window.__falas = []; d.alertaDoDescanso(Date.now() - 10); await new Promise((r) => setTimeout(r, 200)); return { ios: d.isIOS(), plays: window.__plays.length, falas: window.__falas };`);
  ok(ios.ios && ios.plays === 0 && ios.falas[0] === 'Descanso terminado', 'no iPhone: sem <audio> (ele interromperia a música), com a fala: ' + JSON.stringify(ios));
  const textoAjustes = await page.eval(`return document.body.innerText;`);
  ok(/Falar “Descanso terminado”/.test(textoAjustes) && /a música abaixa enquanto a voz fala/.test(textoAjustes), 'Ajustes explica a fala no iPhone');

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

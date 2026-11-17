// Teste de ponta a ponta do som do alerta: em Ajustes a pessoa escolhe entre os sons (um deles é o sino), cada escolha
// toca uma amostra, a escolha fica gravada e é ela que toca no fim do descanso. O navegador sem janela não tem saída de
// som: o roteiro troca o AudioContext por um de mentira que conta os osciladores criados e as frequências.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/som-alerta.mjs
const B = 'http://localhost:5173/';

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__som = [];
    const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
    class AC { constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
      resume() { return Promise.resolve(); }
      createOscillator() { const o = { type: 'sine', frequency: param(), connect() {}, start() { window.__som.push({ tipo: o.type, f: o.frequency.value }); }, stop() {} }; return o; }
      createGain() { return { gain: param(), connect() {} }; }
      createDynamicsCompressor() { window.__compressor = (window.__compressor || 0) + 1; return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect() {} }; } }
    window.AudioContext = AC; window.webkitAudioContext = AC;
  })();` });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 1500);
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.ui.onboarded = true; s.ui.installDismissedAt = new Date().toISOString(); s.settings.som = true; s.settings.somAlerta = 'equilibrado'; }); await new Promise((r) => setTimeout(r, 300)); return true;`);
  await page.goto(B + '#/ajustes', 900);

  console.log('1. Ajustes mostra os sons, com o sino');
  const nomes = await page.eval(`return [...document.querySelectorAll('#som-alerta .chip')].map((e) => e.textContent);`);
  ok(JSON.stringify(nomes) === JSON.stringify(['Equilibrado', 'Sino', 'Alto', 'Longo', 'Discreto', 'Silencioso']), 'cinco sons e o silencioso para escolher: ' + nomes.join(', '));
  ok((await page.eval(`return document.querySelector('#som-alerta .chip.on').dataset.som;`)) === 'equilibrado', 'o som padrão vem marcado');

  console.log('2. Escolher toca uma amostra e grava');
  const tocar = (id) => page.eval(`window.__som = []; document.querySelector('#som-alerta .chip[data-som="${id}"]').click(); await new Promise((r) => setTimeout(r, 150)); return JSON.stringify(window.__som);`).then(JSON.parse);
  const sino = await tocar('sino');
  const freqs = new Set(sino.map((x) => Math.round(x.f)));
  ok(sino.length >= 6 && freqs.size >= 6 && sino.every((x) => x.tipo === 'sine'), 'o sino soa com vários parciais ao mesmo tempo, como um sino de verdade: ' + [...freqs].join(', ') + ' Hz');
  ok((await page.eval(`return (await import('/js/store.js')).state.settings.somAlerta;`)) === 'sino', 'a escolha fica gravada');
  ok((await page.eval(`return document.getElementById('som-alerta-sub').textContent;`)).includes('sino'), 'a descrição acompanha a escolha');
  const alto = await tocar('alto'), discreto = await tocar('discreto'), longo = await tocar('longo');
  ok(alto.length === 8 && alto.every((x) => x.tipo === 'square') && alto.some((x) => x.f >= 2000), 'o alto toca quatro bipes agudos e fortes');
  ok((await page.eval(`return window.__compressor || 0;`)) >= 1, 'o alto passa pelo compressor, que deixa o volume perto do máximo');
  ok(discreto.length === 1, 'o discreto é um toque só');
  ok(longo.length === 12, 'o longo se repete (6 vezes, cerca de 4 segundos)');

  console.log('3. No treino, toca o som escolhido; desligado, nada toca');
  await page.eval(`document.querySelector('#som-alerta .chip[data-som="sino"]').click(); return true;`); await page.sleep(200);
  const noTreino = await page.eval(`window.__som = []; const d = await import('/js/device.js'); d.tocarAlerta(); await new Promise((r) => setTimeout(r, 100)); return window.__som.length;`);
  ok(noTreino >= 6, 'o alerta do treino usa o sino escolhido');
  ok((await tocar('silencioso')).length === 0, 'o silencioso não toca nada');
  ok(JSON.stringify(await page.eval(`const s = (await import('/js/store.js')).state.settings; return [s.som, s.somAlerta];`)) === JSON.stringify([false, 'sino']), 'silencioso desliga o som e guarda o último som escolhido');
  ok((await page.eval(`window.__som = []; const d = await import('/js/device.js'); d.tocarAlerta(); d.beep(1); return window.__som.length;`)) === 0, 'em silencioso, nem o alerta nem os bipes da corrida tocam');
  await page.goto(B + '#/', 300); await page.goto(B + '#/ajustes', 700);
  ok((await page.eval(`return document.querySelector('#som-alerta .chip.on').dataset.som;`)) === 'silencioso', 'ao voltar a Ajustes, o silencioso continua marcado');
  ok((await tocar('discreto')).length === 1 && (await page.eval(`return (await import('/js/store.js')).state.settings.som;`)) === true, 'escolher um som de novo religa o som');
  await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.settings.som = true; s.settings.somAlerta = 'equilibrado'; }); return true;`);

  ok(!(await page.eval(`return document.documentElement.scrollWidth > window.innerWidth;`)), 'Ajustes sem rolagem lateral em 360 px');
  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

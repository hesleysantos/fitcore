// Teste de ponta a ponta de "Manter a tela ligada": o pedido ao navegador (Screen Wake Lock) só existe com o treino
// aberto na tela; sai ao deixar o treino; volta quando o app volta a ficar visível; e não acontece com a opção desligada.
// O navegador sem janela não tem tela para manter ligada: o roteiro troca navigator.wakeLock por um de mentira que conta
// os pedidos e as liberações.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/tela-ligada.mjs
const B = 'http://localhost:5173/';

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__tela = { pedidos: 0, ativos: 0 };
    const falso = { request: async (tipo) => { if (tipo !== 'screen') throw new Error('tipo'); window.__tela.pedidos++; window.__tela.ativos++; const ouvintes = []; let solto = false;
      return { released: false, addEventListener: (ev, f) => { if (ev === 'release') ouvintes.push(f); }, release: async () => { if (solto) return; solto = true; window.__tela.ativos--; ouvintes.forEach((f) => f()); } }; } };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, get: () => falso });
  })();` });
  const tela = () => page.eval(`return JSON.stringify(window.__tela);`).then(JSON.parse);
  const ajustar = (expr) => page.eval(`const m = await import('/js/store.js'); m.update((s) => { ${expr} }); await new Promise((r) => setTimeout(r, 400)); return true;`);
  const treino = `s.current = { id: 's1', planId: '', diaId: '', nome: 'Treino livre', inicio: new Date().toISOString(), fim: '', nota: '', itens: [{ ex: 'supino-reto-halteres', series: [{ kg: null, reps: null, seg: null, ok: false }], descanso: 90 }], restEnd: 0, restTotal: 0, volta: 0, cron: null };`;

  await page.goto(B, 1500);
  await ajustar(`s.ui.onboarded = true; s.ui.installDismissedAt = new Date().toISOString(); s.settings.telaLigada = true; ${treino}`);
  await page.reload(1500);
  ok((await tela()).ativos === 0, 'fora do treino a tela segue o bloqueio normal do celular');

  console.log('1. Com o treino aberto, a tela fica ligada');
  await page.goto(B + '#/sessao', 900);
  let t = await tela();
  ok(t.pedidos >= 1 && t.ativos === 1, 'ao abrir o treino, o app pede para manter a tela ligada: ' + JSON.stringify(t));

  console.log('2. Ao sair do treino, a tela volta ao normal');
  await page.goto(B + '#/treinos', 900);
  t = await tela();
  ok(t.ativos === 0, 'ao deixar a tela do treino, o pedido é liberado: ' + JSON.stringify(t));
  await page.goto(B + '#/', 600);
  ok((await tela()).ativos === 0, 'nas outras telas, com o treino ainda em andamento, a tela segue o celular');

  console.log('3. Com a opção desligada em Ajustes, nada é pedido');
  await ajustar('s.settings.telaLigada = false;');
  const antes = (await tela()).pedidos;
  await page.goto(B + '#/sessao', 900);
  t = await tela();
  ok(t.pedidos === antes && t.ativos === 0, 'com "Manter a tela ligada" desligado, o treino não pede: ' + JSON.stringify(t));
  await page.goto(B + '#/ajustes', 900);
  const ajustes = await page.text();
  ok(ajustes.includes('Manter a tela ligada') && ajustes.includes('Durante o treino ou a corrida, a tela não apaga sozinha'), 'Ajustes explica quando a tela fica ligada');

  await ajustar('s.current = null; s.settings.telaLigada = true;');
  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

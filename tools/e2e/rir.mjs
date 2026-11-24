// Teste de ponta a ponta de "Como foi a última série?" no treino (views/session.js; regras em logic/progress.js):
// a pergunta aparece só depois da última série do exercício (Fácil, Na medida, No limite), com o "?" que explica em
// texto simples como responder; a resposta fica guardada na última série e vira um resumo que reabre a escolha; é
// opcional. No primeiro treino do exercício, o "Como foi a 1ª série?" também fica guardado. No iPhone, a dica de deixar o
// app aberto no descanso. Em 360 px, sem rolagem para o lado e sem erro no console.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/rir.mjs
import * as store from '../../www/js/store.js';

const B = 'http://localhost:5173/';
const J = JSON.stringify;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const ITENS = [{ ex: 'supino-reto-barra', series: 3, reps: '8-12', descanso: 90, nota: '' }];
function estado() {
  const agora = new Date();
  return store.sanitize({
    v: store.VERSAO, settings: { tema: 'claro', animar: false, som: false }, gym: { all: true, has: {} },
    plans: [{ id: 'p1', nome: 'P', origem: 'manual', criadoEm: agora.toISOString(), info: '', agenda: {}, dias: [{ id: 'da', nome: 'Treino A', foco: '', itens: ITENS }] }], activePlan: 'p1',
    ui: { onboarded: true, installDismissedAt: agora.toISOString(), backupEm: agora.toISOString() },
  });
}
const PRE = `
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const cart = () => [...document.querySelectorAll('main .card')].find((c) => c.querySelector('.exhead'));
const digitar = (inp, v) => { inp.focus(); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); inp.blur(); };
const S = (await import('/js/store.js')).state;
`;

export default async (page) => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  const falhas = [];
  const ok = (c, m, diag) => { console.log((c ? '  ✔ ' : '  ✖ ') + m + (!c && diag !== undefined ? '   → ' + J(diag) : '')); if (!c) falhas.push(m); };
  const ev = (js) => page.eval(PRE + js);
  const abrir = async () => {
    await page.goto(B, 1200);
    await page.eval(`const m = await import('/js/store.js'); m.importData(${J(J({ app: 'fitcore', v: 1, dados: estado() }))}); await new Promise((r) => setTimeout(r, 700));`);
    await page.goto(B + '#/treinos', 300); await page.reload(1600);
    await ev(`const s = await import('/js/views/session.js'); await s.startSession('p1', 'da'); await espera(700); return 1;`);
  };

  console.log('1. Primeira vez no exercício: o "Como foi a 1ª série?" fica guardado');
  await abrir();
  await ev(`digitar(cart().querySelector('input[aria-label="carga da série 1"]'), '40'); digitar(cart().querySelector('input[aria-label="repetições da série 1"]'), '10'); cart().querySelector('button.check').click(); await espera(300); return 1;`);
  ok(await ev(`return !!cart().querySelector('.teste1') && !cart().querySelector('.rir-linha');`), 'depois da 1ª série: só o teste da 1ª série, sem a pergunta da última');
  await ev(`[...cart().querySelectorAll('.teste1 button')].find((b) => /Na medida/.test(b.textContent)).click(); await espera(400); return 1;`);
  ok((await ev(`return S.current.itens[0].sets[0].rir;`)) === 2, '"Na medida" fica guardado na 1ª série');
  await ev(`cart().querySelectorAll('button.check')[1].click(); await espera(300); return 1;`);
  ok(await ev(`return !cart().querySelector('.rir-linha') && !cart().querySelector('.rir-resumo');`), 'na 2ª série (não é a última): nada');

  console.log('2. Depois da última série, a pergunta');
  await ev(`cart().querySelectorAll('button.check')[2].click(); await espera(300); return 1;`);
  let r = await ev(`const l = cart().querySelector('.rir-linha'); return l ? { txt: l.innerText, chips: [...l.querySelectorAll('.chip')].map((c) => c.textContent), ajuda: !!l.querySelector('.ajuda-btn'), alto: l.getBoundingClientRect().height } : null;`);
  ok(r && /Como foi a última série\?/.test(r.txt) && J(r.chips) === J(['Fácil', 'Na medida', 'No limite']) && r.ajuda, 'Fácil, Na medida, No limite e o "?"', r);
  ok(r && r.alto < 100, 'cabe em duas linhas', r);
  ok(await ev(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`), 'sem rolagem para o lado');
  await page.shot('rir/pergunta');

  console.log('3. O "?" explica como responder');
  r = await ev(`cart().querySelector('.rir-linha .ajuda-btn').click(); await espera(400); const s = [...document.querySelectorAll('.sheet')].pop(); const t = s ? s.innerText : ''; const f = s && s.querySelector('[aria-label="Fechar"]'); if (f) f.click(); await espera(300); return t;`);
  ok(/quantas repetições a mais eu conseguiria/.test(r) && /Fácil\s*4 ou mais/.test(r) && /Na medida\s*2 ou 3/.test(r) && /No limite\s*1 ou nenhuma/.test(r) && /mais lenta/.test(r), 'a folha explica como responder', r.slice(0, 300));
  await page.shot('rir/ajuda');

  console.log('4. A resposta fica guardada, vira um resumo e pode mudar');
  await ev(`[...cart().querySelectorAll('.rir-linha .chip')].find((c) => c.textContent === 'Fácil').click(); await espera(300); return 1;`);
  r = await ev(`return { rir: S.current.itens[0].sets[2].rir, resumo: (cart().querySelector('.rir-resumo') || {}).textContent || '', linha: !!cart().querySelector('.rir-linha') };`);
  ok(r.rir === 4 && r.resumo === 'Última série: Fácil' && !r.linha, 'guardou "Fácil" e mostra o resumo', r);
  await ev(`cart().querySelector('.rir-resumo').click(); await espera(250); [...cart().querySelectorAll('.rir-linha .chip')].find((c) => c.textContent === 'No limite').click(); await espera(300); return 1;`);
  ok((await ev(`return S.current.itens[0].sets[2].rir;`)) === 0, 'tocar no resumo reabre e troca para "No limite"');
  await page.shot('rir/resumo');

  console.log('5. iPhone: a dica de deixar o app aberto no descanso');
  await page.send('Emulation.setUserAgentOverride', { userAgent: IPHONE, platform: 'iPhone' });
  await page.reload(1800);
  await ev(`if (!document.querySelector('.exhead')) { location.hash = '#/treino'; await espera(800); } return 1;`);
  ok(/No iPhone, deixe o app aberto no descanso/.test(await page.eval(`return document.body.innerText;`)), 'a dica aparece no iPhone');

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

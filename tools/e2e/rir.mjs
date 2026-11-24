// Teste de ponta a ponta de "Quantas ainda sairiam?" no treino (views/session.js; regras em logic/progress.js):
// a escolha aparece embaixo da série recém-feita (0, 1, 2, 3, 4+), com o botão "?" que explica em texto simples; a
// resposta fica guardada na série e vira um resumo ("Sobraram 2") que reabre a escolha; é opcional (dá para seguir sem
// responder). No iPhone, a dica de deixar o app aberto no descanso. Em 360 px, sem rolagem para o lado e sem erro.
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

  console.log('1. Primeira vez no exercício: o "Como foi a 1ª série?" vale como resposta');
  await abrir();
  ok(await ev(`return !cart().querySelector('.rir-linha');`), 'antes de marcar a série: sem a pergunta');
  await ev(`digitar(cart().querySelector('input[aria-label="carga da série 1"]'), '40'); digitar(cart().querySelector('input[aria-label="repetições da série 1"]'), '10'); cart().querySelector('button.check').click(); await espera(300); return 1;`);
  ok(await ev(`return !!cart().querySelector('.teste1') && !cart().querySelector('.rir-linha');`), 'com o teste da 1ª série na tela, a pergunta não se repete');
  await ev(`[...cart().querySelectorAll('.teste1 button')].find((b) => /Na medida/.test(b.textContent)).click(); await espera(400); return 1;`);
  let r = await ev(`return { rir: S.current.itens[0].sets[0].rir, resumo: (cart().querySelector('.rir-resumo') || {}).textContent || '' };`);
  ok(r.rir === 2 && r.resumo === 'Sobraram 2', '"Na medida" fica como 2 sobrando', r);

  console.log('2. Na série seguinte, a escolha aparece');
  await ev(`cart().querySelectorAll('button.check')[1].click(); await espera(300); return 1;`);
  r = await ev(`const l = cart().querySelector('.rir-linha'); return l ? { txt: l.innerText, chips: [...l.querySelectorAll('.chip')].map((c) => c.textContent), ajuda: !!l.querySelector('.ajuda-btn'), alto: l.getBoundingClientRect().height } : null;`);
  ok(r && /Quantas ainda sairiam\?/.test(r.txt) && J(r.chips) === J(['0', '1', '2', '3', '4+']) && r.ajuda, 'a pergunta, com 0, 1, 2, 3, 4+ e o "?"', r);
  ok(r && r.alto < 100, 'cabe em duas linhas: a pergunta e as opções', r);
  ok(await ev(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`), 'sem rolagem para o lado');
  await page.shot('rir/pergunta');

  console.log('3. O "?" explica em texto simples');
  r = await ev(`cart().querySelector('.rir-linha .ajuda-btn').click(); await espera(400); const s = [...document.querySelectorAll('.sheet')].pop(); const t = s ? s.innerText : ''; const f = s && s.querySelector('[aria-label="Fechar"]'); if (f) f.click(); await espera(300); return t;`);
  ok(/quantas repetições a mais você ainda conseguiria fazer com boa técnica/.test(r) && /2 a 3 repetições antes do limite/.test(r) && /não precisa ir até a falha/.test(r), 'a folha explica o porquê', r.slice(0, 200));

  console.log('4. A resposta fica guardada, vira um resumo e pode mudar');
  await ev(`[...cart().querySelectorAll('.rir-linha .chip')].find((c) => c.textContent === '3').click(); await espera(300); return 1;`);
  r = await ev(`const l = [...cart().querySelectorAll('.rir-resumo')].map((b) => b.textContent); return { rir: S.current.itens[0].sets[1].rir, resumos: l, linha: !!cart().querySelector('.rir-linha') };`);
  ok(r.rir === 3 && J(r.resumos) === J(['Sobraram 2', 'Sobraram 3']) && !r.linha, 'guardou 3 e mostra os resumos', r);
  await ev(`cart().querySelectorAll('.rir-resumo')[1].click(); await espera(250); [...cart().querySelectorAll('.rir-linha .chip')].find((c) => c.textContent === '4+').click(); await espera(300); return 1;`);
  ok((await ev(`return S.current.itens[0].sets[1].rir;`)) === 4, 'tocar no resumo reabre e troca para 4+');
  await page.shot('rir/resumo');

  console.log('4b. É opcional: a série seguinte segue sem responder');
  await ev(`cart().querySelectorAll('button.check')[2].click(); await espera(300); return 1;`);
  r = await ev(`return { ok: S.current.itens[0].sets[2].ok, rir: S.current.itens[0].sets[2].rir };`);
  ok(r.ok && r.rir === undefined, 'a 3ª série foi marcada sem resposta', r);

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

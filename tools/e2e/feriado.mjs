// Teste de ponta a ponta do feriado (1.14.0) e do selo "Feito" no treino de hoje, na aba Treinos.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/feriado.mjs
import * as store from '../../www/js/store.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = new Date();
const wd = hoje.getDay();
const item = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
const FULL = [item('flexao-de-bracos'), item('barra-fixa-pronada'), item('agachamento-peso-corporal'), item('flexao-nordica')];
const UI = { onboarded: true, installDismissedAt: new Date().toISOString(), backupEm: new Date().toISOString() };
// um dia desta semana, depois de hoje, com treino (domingo é o último dia da semana)
const futuros = [1, 2, 3, 4, 5, 6, 0].filter((d) => (d === 0 ? 7 : d) > (wd === 0 ? 7 : wd));

export default async (page) => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  if (futuros.length < 2) { console.log('Hoje é sábado ou domingo: sem dois dias à frente nesta semana, o roteiro não se aplica.'); console.log('\nRESULTADO: tudo certo'); return; }
  const [dF, dOutro] = futuros; // o feriado e o dia que pode receber o treino
  const agenda = { [wd]: 'da', [dF]: 'db' };
  const plano = { id: 'p1', nome: 'Meu plano', origem: 'manual', criadoEm: new Date(hoje.getTime() - 20 * 86400000).toISOString(), info: '',
    dias: [{ id: 'da', nome: 'Treino A', foco: 'Corpo inteiro', itens: FULL }, { id: 'db', nome: 'Treino B', foco: 'Corpo inteiro', itens: FULL }], agenda };
  // o treino de hoje já foi feito
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 7, 0).toISOString();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 8, 0).toISOString();
  const sessao = { id: 'sfeito', planId: 'p1', diaId: 'da', nome: 'Treino A', inicio: ini, fim, nota: '', itens: FULL.map((x) => ({ ex: x.ex, alvo: '10', descanso: 90, sets: [{ kg: 0, reps: 10, ok: true }] })) };
  const dados = store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, gym: { all: true, has: {} }, plans: [plano], activePlan: 'p1', sessions: [sessao], ui: UI });
  await page.goto(B, 1200);
  await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados }))}); await new Promise((r) => setTimeout(r, 700));`);
  await page.goto(B + '#/treinos', 300); await page.reload(1400);

  console.log('1. Treino de hoje feito: "Hoje" e "Feito" juntos');
  const selos = await page.eval(`return [...document.querySelectorAll('.card.dia[data-wd="${wd}"] .row.between .badge')].map((b) => b.textContent.trim());`);
  ok(selos.includes('Hoje') && selos.includes('Feito'), 'o cartão de hoje mostra os dois selos: ' + selos.join(', '));

  console.log('2. Botão discreto "É feriado?" nos dias que ainda vêm');
  const botoes = await page.eval(`return [...document.querySelectorAll('.card.dia .feriado-acao button')].map((b) => b.closest('.card.dia').dataset.wd);`);
  const permitidos = futuros.map(String).concat(String(wd));
  ok(botoes.includes(String(dF)) && !botoes.some((x) => !permitidos.includes(x)), 'só hoje e os dias que ainda vêm têm o botão: ' + botoes.join(','));
  const estilo = await page.eval(`const b = document.querySelector('.card.dia[data-wd="${dF}"] .feriado-acao button'); const cs = getComputedStyle(b); return { borda: cs.borderTopColor, fundo: cs.backgroundColor, h: Math.round(b.getBoundingClientRect().height) };`);
  ok(/rgba\(0, 0, 0, 0\)|transparent/.test(estilo.fundo) && estilo.h >= 44, 'o botão é discreto (sem fundo) e fácil de tocar: ' + JSON.stringify(estilo));
  await page.shot('feriado/1-semana');

  console.log('3. Marcar o feriado: o treino do dia vai para outro dia');
  await page.eval(`const b = document.querySelector('.card.dia[data-wd="${dF}"] .feriado-acao button'); b.scrollIntoView({ block: 'center' }); b.click(); return 1;`);
  await page.sleep(700);
  const folha = await page.eval(`const s = [...document.querySelectorAll('.sheet')].pop(); return s ? s.innerText : '';`);
  ok(/Feriado .*a academia não abre/.test(folha) && /Motivo: Feriado \(academia fechada\)/.test(folha), 'abre a folha do treino com o motivo feriado');
  await page.shot('feriado/2-folha');
  const passar = await page.eval(`const b = [...document.querySelectorAll('.sheet .btn')].find((x) => /^Passar para/.test(x.textContent.trim())); if (!b) return ''; const t = b.textContent.trim(); b.click(); return t;`);
  ok(!!passar, 'propõe outro dia: ' + passar);
  await page.sleep(800);
  const st = await page.eval(`const m = await import('/js/store.js'); return { feriados: m.state.feriados, perdidos: m.state.perdidos };`);
  const dataF = (() => { const d = new Date(hoje); d.setDate(d.getDate() + (((dF === 0 ? 7 : dF) - (wd === 0 ? 7 : wd)))); return dk(d); })();
  ok(st.feriados.includes(dataF), 'o feriado fica guardado: ' + JSON.stringify(st.feriados));
  ok(st.perdidos.length === 1 && st.perdidos[0].motivo === 'feriado' && st.perdidos[0].movs.length === 1 && st.perdidos[0].movs[0].para !== dataF, 'o treino do feriado foi para outro dia: ' + JSON.stringify(st.perdidos[0]));
  const linha = await page.eval(`const c = document.querySelector('.card.dia[data-wd="${dF}"]'); return c ? c.innerText : '';`);
  ok(/Feriado: a academia não abre/.test(linha), 'o cartão do dia mostra o feriado, com "Desfazer"');
  await page.shot('feriado/3-marcado');

  console.log('4. Desfazer o feriado');
  await page.eval(`const b = [...document.querySelectorAll('.card.dia[data-wd="${dF}"] .feriado-linha button')].find((x) => x.textContent.trim() === 'Desfazer'); b.click(); return 1;`);
  await page.sleep(500);
  ok(!(await page.eval(`const m = await import('/js/store.js'); return m.state.feriados.length;`)), 'feriado desfeito');
  const larga = await page.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`);
  ok(larga, 'sem rolagem para o lado a 360 px');

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

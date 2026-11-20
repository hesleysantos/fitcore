// Teste de ponta a ponta do reajuste da semana depois de um treino feito fora do dia dele (logic/perdido.js,
// reajustarDepoisDoTreino): na segunda o Treino A ficou "não treinado" e passou para sexta; na terça a pessoa faz o
// Treino A (pela aba Treinos, no cartão de sexta). No fim do treino, a folha "Ajustei a sua semana" diz o que mudou: o A
// não vai mais para sexta e o Treino B, que era da terça, vai para outro dia. Depois, um treino livre de pernas na
// quarta cobre o treino de pernas que faltava. A página roda como se hoje fosse terça-feira.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/reajuste.mjs
import * as store from '../../www/js/store.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async (page) => {
  const falhas = [];
  const ok = (c, m, extra) => { console.log((c ? '  ✔ ' : '  ✖ ') + m + (c || extra === undefined ? '' : ' ' + JSON.stringify(extra))); if (!c) falhas.push(m); };
  // relógio da página: a próxima terça-feira (ou hoje, se for terça), às 18 h
  const agora = new Date(); const ate = (9 - agora.getDay()) % 7;
  const terca = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + ate, 18, 0, 0);
  const adianta = terca.getTime() - Date.now();
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const R = Date, d = ${adianta}; class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + d); } static now() { return R.now() + d; } } window.Date = D; })();` });
  const dia = (k) => { const d = new Date(terca); d.setDate(d.getDate() + k); return dk(d); }; // k = 0 é a terça
  const seg = dia(-1), qua = dia(1), sex = dia(3);
  const item = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
  const plano = { id: 'p1', nome: 'Meu treino', origem: 'manual', criadoEm: new Date(terca.getTime() - 30 * 86400000).toISOString(), info: '',
    dias: [{ id: 'a', nome: 'Treino A', foco: 'Superiores', itens: [item('supino-reto-halteres'), item('remada-unilateral-halter-serrote')] },
      { id: 'b', nome: 'Treino B', foco: 'Pernas', itens: [item('agachamento-livre-barra'), item('leg-press-45')] },
      { id: 'c', nome: 'Treino C', foco: 'Corpo inteiro', itens: [item('flexao-de-bracos'), item('agachamento-peso-corporal')] }],
    agenda: { 1: 'a', 2: 'b', 5: 'c' } };
  // segunda: "Não treinei" (sem tempo), o A foi para quinta... aqui, para sexta, e o C de sexta para sábado
  const marca = { tipo: 'musculacao', data: seg, planId: 'p1', diaId: 'a', motivo: 'tempo', em: new Date(terca.getTime() - 20 * 3600000).toISOString(),
    movs: [{ diaId: 'a', de: seg, para: sex }, { diaId: 'c', de: sex, para: dia(4) }] };
  const st = store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, gym: { all: true, has: {} }, plans: [plano], activePlan: 'p1', perdidos: [marca],
    trainer: { answers: { idade: 30 } }, ui: { onboarded: true, installDismissedAt: new Date().toISOString() } });

  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 1200);
  await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados: st }))}); await new Promise((r) => setTimeout(r, 300)); await m.flush(); return true;`);
  await page.goto(B + '#/treinos', 300); await page.reload(1500);
  const semana = () => page.eval(`const s = await import('/js/logic/perdido.js'); const st = (await import('/js/store.js')).state; return s.semanaEfetiva(st.plans[0], st.perdidos, ${JSON.stringify(seg)}).map((d) => (d.diaId || '-') + (d.perdido ? (d.perdido.entrada.feitoEm ? '(feito)' : '(perd)') : ''));`);

  console.log('1. Antes: o A de segunda está na sexta');
  ok(JSON.stringify(await semana()) === JSON.stringify(['-(perd)', 'b', '-', '-', 'a', 'c', '-']), 'segunda não treinada, A na sexta, C no sábado', await semana());

  console.log('2. Na terça, faz o Treino A e conclui');
  await page.eval(`const m = await import('/js/views/session.js'); await m.startSession('p1', 'a'); return true;`); await page.sleep(800);
  await page.eval(`const st = await import('/js/store.js'); st.update((x) => { for (const it of x.current.itens) for (const s of it.sets) { s.ok = true; s.reps = 10; s.kg = 20; } }); (await import('/js/router.js')).refresh(); return true;`); await page.sleep(500);
  ok(await page.click('Finalizar treino'), 'tocou em "Finalizar treino"');
  await page.sleep(1200);
  const folha = await page.eval(`const f = document.getElementById('folha-reajuste'); return f ? f.innerText : '';`);
  ok(/O Treino A foi feito hoje: não vai mais para sexta\./.test(folha), 'a folha diz que o A sai de sexta', folha);
  ok(/O Treino B, que era hoje, passou para/.test(folha), 'e para onde foi o B, que era de hoje', folha);
  ok(/Sexta volta a ter o Treino C\./.test(folha), 'a sexta volta a ter o C', folha);
  await page.shot('_reajuste_folha');
  await page.click('Ver a semana', '.sheet button'); await page.sleep(800);
  const s2 = await semana();
  ok(s2[0] === '-(feito)' && s2[1] === '-(perd)' && s2[4] === 'c' && s2[5] === '-' && s2.filter((x) => x === 'b').length === 1, 'semana: segunda feito, terça sem o B, B em outro dia, C de volta à sexta', s2);
  const t = await page.eval(`return document.querySelector('.card.dia.hl').innerText;`);
  ok(/Você fez o Treino A no lugar/.test(t), 'o cartão de hoje diz que o A foi feito no lugar do B', t.slice(0, 200));
  const segCard = await page.eval(`return document.querySelector('.card.dia[data-wd="1"]').innerText;`);
  ok(/Feito/.test(segCard) && /Feito hoje/.test(segCard), 'segunda: "Feito hoje"', segCard.slice(0, 160));
  await page.eval(`window.scrollTo(0, 0); return true;`);
  await page.shot('_reajuste_semana');

  console.log('3. Pelo chat: "fiz hoje o treino de ontem" já está certo');
  const passo = await page.eval(`const c = await import('/js/logic/chat/treino.js'); const st = (await import('/js/store.js')).state; return c.passoFeitoDepois({ st, hoje: ${JSON.stringify(dia(0))}, texto: 'fiz hoje o treino de ontem' }).texto.join(' ');`);
  ok(/Já está certo/.test(passo), 'o chat sabe que já foi reajustado: ' + passo);

  if (falhas.length) throw new Error(falhas.length + ' falha(s): ' + falhas.join(' | '));
};

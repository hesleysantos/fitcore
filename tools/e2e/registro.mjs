// Teste de ponta a ponta do registro de corrida e caminhada: tempo em horas, minutos e segundos (1 h 13 min 48 s), a
// distância opcional também na caminhada (com o pace), e o lançamento de musculação num dia que já passou ("Adicionar
// treino feito"), sem cronômetro, gravado naquele dia.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/registro.mjs
import * as store from '../../www/js/store.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async (page) => {
  const falhas = [];
  const ok = (c, m, extra) => { console.log((c ? '  ✔ ' : '  ✖ ') + m + (c || extra === undefined ? '' : ' ' + JSON.stringify(extra))); if (!c) falhas.push(m); };
  const hoje = new Date();
  const item = (ex, series = 2) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
  const plano = { id: 'p1', nome: 'Meu treino', origem: 'manual', criadoEm: new Date(hoje.getTime() - 30 * 86400000).toISOString(), info: '',
    dias: [{ id: 'a', nome: 'Treino A', foco: '', itens: [item('supino-reto-halteres'), item('remada-unilateral-halter-serrote')] }], agenda: {} };
  const st = store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, plans: [plano], activePlan: 'p1', trainer: { answers: { idade: 30 } }, ui: { onboarded: true, installDismissedAt: new Date().toISOString() } });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 1200);
  await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados: st }))}); await new Promise((r) => setTimeout(r, 300)); await m.flush(); return true;`);

  console.log('1. Caminhada de 1 h 13 min 48 s, com a distância');
  await page.goto(B + '#/corrida/dia/' + dk(hoje), 300); await page.reload(1500);
  ok(await page.eval(`const c = [...document.querySelectorAll('[aria-label="Tipo de corrida"] .chip')].find((x) => x.textContent.trim() === 'Caminhada'); if (!c) return false; c.click(); return true;`), 'escolheu caminhada');
  await page.sleep(300);
  ok(await page.eval(`return !!document.querySelector('[aria-label="Tempo: horas"]');`), 'campo de horas no tempo');
  ok(await page.click('Informar a distância'), 'a caminhada também tem "Informar a distância"');
  await page.sleep(200);
  await page.eval(`const v = (l, x) => { const e = document.querySelector('[aria-label="' + l + '"]'); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }; v('Tempo: horas', '1'); v('Tempo: minutos', '13'); v('Tempo: segundos', '48'); v('Distância em quilômetros', '620'); return true;`);
  await page.sleep(200);
  ok(/Pace: 11:54 por km/.test(await page.eval(`return document.getElementById('pace-calculado').textContent;`)), 'o pace aparece com a distância', await page.eval(`return document.getElementById('pace-calculado').textContent;`));
  await page.shot('_registro_caminhada');
  ok(await page.click('Registrar corrida'), 'registrou');
  await page.sleep(600);
  const r = await page.eval(`const s = (await import('/js/store.js')).state; return s.runs.map((x) => [x.tipo, x.durMin, x.distKm]);`);
  ok(r.length === 1 && r[0][0] === 'caminhada' && Math.abs(r[0][1] - 73.8) < 0.01 && r[0][2] === 6.2, 'gravou 73,8 min e 6,2 km na caminhada', r);

  console.log('2. Musculação feita ontem (sem cronômetro, gravada ontem)');
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
  await page.eval(`const m = await import('/js/views/session.js'); await m.startSession('p1', 'a', { registro: ${JSON.stringify(dk(ontem))} }); return true;`); await page.sleep(800);
  ok(/Registrando o treino de/.test(await page.eval(`return document.body.innerText;`)), 'a tela avisa que é o registro de outro dia');
  ok(await page.eval(`return document.querySelector('.timer-big').textContent === 'Registro';`), 'sem cronômetro');
  await page.eval(`const st = await import('/js/store.js'); st.update((x) => { for (const it of x.current.itens) for (const s of it.sets) { s.ok = true; s.reps = 10; s.kg = 20; } }); (await import('/js/router.js')).refresh(); return true;`); await page.sleep(400);
  ok(await page.eval(`const s = (await import('/js/store.js')).state; return !s.current.restEnd;`), 'sem descanso cronometrado');
  await page.click('Finalizar treino'); await page.sleep(1200);
  const s2 = await page.eval(`const s = (await import('/js/store.js')).state; const x = s.sessions[s.sessions.length - 1]; const d = new Date(x.inicio); return { dia: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), min: (Date.parse(x.fim) - Date.parse(x.inicio)) / 60000 };`);
  ok(s2.dia === dk(ontem) && s2.min === 10, 'o treino ficou em ontem, com a duração estimada pelas séries (4 séries: 10 min)', s2);

  if (falhas.length) throw new Error(falhas.length + ' falha(s): ' + falhas.join(' | '));
};

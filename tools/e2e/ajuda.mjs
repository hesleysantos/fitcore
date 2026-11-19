// Teste de ponta a ponta do botão "?" (ui.js, ajuda): a explicação abre numa folha, sem linha a mais na tela.
// No dia da corrida, o "?" do Esforço mostra a escala de 1 a 10 e o teste da fala.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/ajuda.mjs
const B = 'http://localhost:5173/';
export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 1200);
  const data = await page.eval(`
    const st = await import('/js/store.js'); const C = await import('/js/logic/corrida.js');
    const hoje = new Date(); const pad = (n) => String(n).padStart(2, '0'); const dk = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const ini = new Date(hoje.getTime() - 3 * 86400000);
    const a = { experiencia: 'regular', kmSemana: 30, longoAtual: 12, provas: '5a10', pausa: 'treinando', objetivo: 'ritmo', distancia: '10', dias: ['1','2','4','6'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], resultado: '5', resultadoMin: 25 };
    for (const q of C.PERGUNTAS) if (!(q.k in a) && !(q.se && !q.se(a)) && !q.opcional) a[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
    st.importData(JSON.stringify({ app: 'fitcore', v: 1, dados: st.sanitize({ v: st.VERSAO, run: { answers: a, aceitoEm: ini.toISOString(), inicio: dk(ini) }, ui: { onboarded: true, installDismissedAt: new Date().toISOString(), backupEm: new Date().toISOString() } }) }));
    await new Promise((r) => setTimeout(r, 600));
    for (let k = 0; k < 14; k++) { const d = new Date(hoje.getTime() + k * 86400000); const t = C.treinoDoDia(st.state, dk(hoje), dk(d)); if (t && t.tipo !== 'descanso') return dk(d); }
    return '';`);
  ok(!!data, 'há uma corrida nos próximos dias: ' + data);
  await page.goto(B + '#/corrida/dia/' + data, 1500);

  console.log('1. Esforço com "?": sem linha a mais na tela');
  const b = await page.eval(`const kv = [...document.querySelectorAll('.kv')].find((k) => /^Esforço/.test(k.textContent.trim())); const btn = kv && kv.querySelector('.ajuda-btn'); if (!btn) return null; const r = btn.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), label: btn.getAttribute('aria-label'), alturaKv: Math.round(kv.getBoundingClientRect().height) };`);
  ok(b && b.w >= 44 && b.h >= 44 && /Esforço/.test(b.label), 'o "?" do Esforço existe e é fácil de tocar: ' + JSON.stringify(b));
  ok(b && b.alturaKv < 60, 'a linha do Esforço continua com uma linha só: ' + (b && b.alturaKv) + ' px');
  await page.shot('ajuda/1-dia');
  await page.eval(`[...document.querySelectorAll('.kv')].find((k) => /^Esforço/.test(k.textContent.trim())).querySelector('.ajuda-btn').click(); return 1;`);
  await page.sleep(400);
  const folha = await page.eval(`const s = [...document.querySelectorAll('.sheet')].pop(); return s ? s.innerText : '';`);
  ok(/Esforço de 1 a 10/.test(folha) && /Muito, muito fácil/.test(folha) && /Máximo/.test(folha) && /Teste da fala/.test(folha), 'a folha mostra a escala de 1 a 10 e o teste da fala');
  await page.shot('ajuda/2-escala');
  await page.eval(`[...document.querySelectorAll('.sheet')].pop().querySelector('.iconbtn').click(); return 1;`);
  await page.sleep(300);
  ok(!(await page.eval(`return [...document.querySelectorAll('.sheet')].some((s) => /Esforço de 1 a 10/.test(s.innerText));`)), 'fecha no X');

  console.log('2. No registro da corrida, as dicas viraram "?"');
  const reg = await page.eval(`const r = document.getElementById('registro'); if (!r) return null; return { ajudas: r.querySelectorAll('.ajuda-btn').length, texto: r.innerText };`);
  if (reg) {
    ok(reg.ajudas >= 2, 'tipo e esforço com "?": ' + reg.ajudas);
    ok(!/Pense no treino inteiro/.test(reg.texto) && !/Marque “Teste de ritmo”/.test(reg.texto), 'as explicações saíram da tela (ficam no "?")');
  } else ok(true, 'dia futuro: sem formulário de registro (conferido nos testes)');
  const larga = await page.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`);
  ok(larga, 'sem rolagem para o lado a 360 px');
  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

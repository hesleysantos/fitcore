// Teste de ponta a ponta da corrida do plano na esteira (logic/esteira.js), clicando como um usuário: marcar a corrida de
// hoje para a esteira, ver a versão ajustada (km/h, inclinação, segurança), o cronômetro com a velocidade, voltar para a
// rua num dia de tiros, registrar a corrida "na esteira", recarregar e conferir que tudo persiste, a tela de 360 px sem
// rolagem lateral, a letra "Muito grande" e nenhum erro no console.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/esteira.mjs
const B = 'http://localhost:5173/';

export default async (page) => {
  const falhas = [];
  const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msg); if (!cond) falhas.push(msg); };
  const texto = () => page.text();
  const estado = (expr) => page.eval(`const s = (await import('/js/store.js')).state; return ${expr};`);
  const foto = async (nome) => { if (process.env.FOTOS_ESTEIRA) await page.shot('esteira/' + nome); };
  const semRolagem = () => page.eval(`return document.documentElement.scrollWidth <= innerWidth + 1;`);
  const preencher = (rotulo, valor) => page.eval(`const i = document.querySelector('input[aria-label="${rotulo}"]'); if (!i) return false; i.value = ${JSON.stringify(valor)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true;`);

  console.log('1. Plano de corrida aceito há 6 semanas, com corrida hoje');
  await page.goto(B, 2500);
  const sem = await page.eval(`
    const store = await import('/js/store.js');
    const c = await import('/js/logic/corrida.js');
    const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
    const hoje = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const wd = d.getDay();
    const dias = [wd, (wd + 2) % 7, (wd + 4) % 7, (wd + 5) % 7].map(String);
    const inicio = c.somaDias(c.segundaDe(hoje), -42);
    store.update((s) => {
      s.ui.onboarded = true; s.ui.installDismissedAt = new Date().toISOString();
      s.run.answers = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'distancia', distancia: '10', semanasProva: 12, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias, diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
      s.run.aceitoEm = new Date(Date.parse(inicio + 'T12:00:00Z')).toISOString(); s.run.inicio = inicio; s.run.esteira = [];
    });
    await new Promise((r) => setTimeout(r, 400));
    const st = store.state;
    const lista = [];
    for (let k = 0; k <= 6; k++) { const dd = c.somaDias(hoje, k); const t = c.treinoDoDia(st, hoje, dd); if (t) lista.push({ data: dd, tipo: t.tipo, intens: t.intensidade, tiros: t.blocos.some((b) => b.repeticoes > 1 && b.pausa) }); }
    return { hoje, lista };`);
  const hoje = sem.hoje;
  const dHoje = sem.lista.find((x) => x.data === hoje);
  ok(!!dHoje && dHoje.tipo !== 'descanso', 'há corrida do plano hoje: ' + JSON.stringify(sem.lista));
  const dTiros = sem.lista.find((x) => x.data !== hoje && x.tiros);

  console.log('2. Hoje: "Fazer na esteira" e a versão ajustada');
  await page.goto(B + '#/corrida/dia/' + hoje, 1000);
  ok(await page.click('Fazer na esteira'), 'botão discreto "Fazer na esteira" no treino do dia');
  await page.sleep(400);
  let t = await texto();
  ok(await page.eval(`return !!document.getElementById('corrida-esteira');`), 'cartão "Na esteira" aparece');
  ok(/Inclinação (1%|0 a 1%)/.test(t) && /\d+,\d( a \d+,\d)? km\/h/.test(t), 'mostra a inclinação e as velocidades em km/h');
  ok(t.includes('chave de segurança') && t.includes('Nunca pule'), 'mostra os cuidados de segurança');
  ok(await page.eval(`const d = document.querySelector('#corrida-esteira details.pq'); return !!d && !d.open && /FONTES/.test(d.textContent) && /Miller/.test(d.textContent);`), '"Por quê?" fechado, com as fontes');
  ok((await estado(`s.run.esteira`)).includes(hoje), 'a marcação fica no estado (run.esteira)');
  ok(await page.eval(`return [...document.querySelectorAll('#registro-local .chip')].find((e) => e.dataset.local === 'esteira').getAttribute('aria-checked') === 'true';`), 'o registro já vem com "Esteira" marcado');
  await foto('1-hoje-esteira');

  console.log('3. Cronômetro guiado com a velocidade da etapa');
  if (await page.eval(`return !!document.querySelector('.cron');`)) {
    await page.eval(`[...document.querySelectorAll('.cron .btn')].find((e) => e.textContent.includes('Iniciar')).click(); return true;`); await page.sleep(500);
    const cron = await page.eval(`return document.querySelector('.cron').innerText;`);
    ok(/km\/h|caminhada|trote/.test(cron), 'a etapa mostra a velocidade na esteira: ' + cron.replace(/\s+/g, ' ').slice(0, 120));
    await page.click('Voltar para a rua'); await page.sleep(300);
    ok((await estado(`s.run.esteira`)).includes(hoje) && /cronômetro rodando/.test(await texto()), 'com o cronômetro rodando, não volta para a rua (e diz por quê)');
    await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.run.cron = null; }); return true;`);
    await page.goto(B + '#/corrida/dia/' + hoje, 800);
  } else ok(true, 'treino de hoje sem cronômetro');

  console.log('4. Dia de tiros: troca e volta para a rua');
  if (dTiros) {
    await page.goto(B + '#/corrida/dia/' + dTiros.data, 900);
    ok(await page.click('Fazer na esteira'), 'dia de tiros também pode ir para a esteira'); await page.sleep(400);
    t = await texto();
    ok(t.includes('Inclinação 1%') && t.includes('antes do apito'), 'tiros: 1% de inclinação e a troca de velocidade antes do apito');
    await foto('2-tiros-esteira');
    ok(await page.click('Voltar para a rua'), 'botão "Voltar para a rua"'); await page.sleep(400);
    ok(!(await estado(`s.run.esteira`)).includes(dTiros.data) && !(await page.eval(`return !!document.getElementById('corrida-esteira');`)), 'voltou para a rua: a marcação saiu');
    await page.click('Fazer na esteira'); await page.sleep(300);
  } else ok(true, 'sem dia de tiros nos próximos 7 dias: ' + JSON.stringify(sem.lista));
  // dia sem corrida do plano: sem o botão
  const livre = await page.eval(`const c = await import('/js/logic/corrida.js'); const s = (await import('/js/store.js')).state; for (let k = 1; k <= 6; k++) { const d = c.somaDias(${JSON.stringify(hoje)}, k); if (!c.treinoDoDia(s, ${JSON.stringify(hoje)}, d)) return d; } return '';`);
  if (livre) { await page.goto(B + '#/corrida/dia/' + livre, 700); ok(!(await texto()).includes('Fazer na esteira'), 'dia sem corrida do plano não mostra "Fazer na esteira"'); }

  console.log('5. Registrar a corrida de hoje na esteira e recarregar');
  await page.goto(B + '#/corrida/dia/' + hoje, 900);
  await preencher('Distância em quilômetros', '6'); await preencher('Tempo em minutos, ou minutos e segundos', '38:30');
  await page.click('Esforço 3: Moderado', 'button');
  await page.click('Registrar corrida'); await page.sleep(600);
  const r = await estado(`s.runs.find((x) => x.data === ${JSON.stringify(hoje)})`);
  ok(r && r.local === 'esteira' && r.distKm === 6, 'registro guardado com local "esteira": ' + JSON.stringify(r));
  await page.reload(1500);
  await page.goto(B + '#/corrida/dia/' + hoje, 900);
  t = await texto();
  ok(t.includes('na esteira') && t.includes('6 km'), 'depois de recarregar: o registro mostra "na esteira"');
  ok((await estado(`s.run.esteira`)).includes(hoje) && t.includes('Na esteira') && !t.includes('Voltar para a rua'), 'a marcação persiste; com a corrida feita, não volta para a rua');
  await page.goto(B + '#/corrida', 1000);
  t = await texto();
  ok(t.includes('na esteira'), 'o painel mostra o treino marcado como "na esteira"');
  ok(await page.eval(`const d = document.getElementById('corrida-evolucao'); return !!d && /6/.test(d.textContent);`), 'a corrida na esteira conta na evolução da semana');

  console.log('6. 360 px e letra "Muito grande"');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 760, deviceScaleFactor: 1, mobile: true });
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.settings.letra = 'muito'; }); await new Promise((r) => setTimeout(r, 400)); return true;`);
  await page.reload(1500);
  ok((await page.eval(`return document.documentElement.dataset.letra;`)) === 'muito', 'letra "Muito grande" ligada');
  for (const d of [hoje, dTiros ? dTiros.data : hoje]) {
    await page.goto(B + '#/corrida/dia/' + d, 900);
    await page.eval(`document.querySelectorAll('#corrida-esteira details').forEach((x) => { x.open = true; }); return true;`); await page.sleep(150);
    ok(await semRolagem(), `dia ${d} em 360 px com letra muito grande: sem rolagem lateral`);
  }
  await foto('3-360-muito');
  await page.goto(B + '#/corrida', 900);
  ok(await semRolagem(), 'painel em 360 px com letra muito grande: sem rolagem lateral');
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.settings.letra = 'normal'; }); return true;`);

  const erros = page.erros.filter((e) => !/favicon|SWv:/.test(e));
  ok(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' || ').slice(0, 500) : ''));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

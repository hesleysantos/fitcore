// Teste de uso de ponta a ponta, clicando como um usuário leigo: entrevista, treino, evolução, nutrição,
// backup e uso sem internet. PERFIL=1 ou 2 escolhe as respostas. Rode com "npm run test:uso".
const B = 'http://localhost:5173/';
const PERFIS = {
  1: {
    treino: { 'principal objetivo': 'Ganhar massa muscular', experiência: 'Menos de 6 meses de treino', 'sem treinar': 'De 1 a 3 meses', 'dias por semana': '3 dias', 'tempo você tem': 'Cerca de 1 hora', 'Onde você vai treinar': 'Academia completa', 'dor ou lesão': 'Nenhuma', condições: 'Nenhuma', sinais: 'Nenhum deles', 'remédio de uso contínuo': 'Nenhum', 'prioridade a algum músculo': 'Não, quero um treino equilibrado' },
    nutri: { 'objetivo com a alimentação': 'Ganhar massa muscular', 'alimentos mais baratos': 'Sim, priorize os mais baratos', 'sexo biológico': 'Masculino', 'dia a dia': 'Fico sentado a maior parte do dia', 'dias por semana você treina': '3 dias', horário: 'À noite', refeições: '4 refeições', 'alergia a algum': 'Nenhuma', 'restrição alimentar': 'Nenhuma', situações: 'Nenhuma' },
  },
  2: {
    treino: { 'principal objetivo': 'Emagrecer', experiência: 'Nunca treinei', 'dias por semana': '2 dias', 'tempo você tem': 'Cerca de 30 minutos', 'Onde você vai treinar': 'Em casa, com halteres e banco', 'mais algum destes': 'Nenhum destes', 'dor ou lesão': 'Joelho', condições: 'Pressão alta', sinais: 'Nenhum deles', 'remédio de uso contínuo': 'Nenhum', 'prioridade a algum músculo': 'Glúteos' },
    nutri: { 'objetivo com a alimentação': 'Emagrecer', 'alimentos mais baratos': 'Tanto faz', 'sexo biológico': 'Feminino', 'dia a dia': 'Fico em pé ou caminho parte do dia', 'dias por semana você treina': '1 a 2 dias', horário: 'De manhã', refeições: '3 refeições', 'alergia a algum': 'Nenhuma', 'restrição alimentar': 'Vegetariano', situações: 'Pressão alta' },
  },
};

export default async (page) => {
  const perfil = PERFIS[process.env.PERFIL || '1'];
  const falhas = [];
  const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msg); if (!cond) falhas.push(msg); };
  const titulo = () => page.eval(`return document.title;`);
  const texto = () => page.text();

  async function entrevista(respostas) {
    for (let n = 0; n < 20; n++) {
      const q = await page.eval(`const h2 = document.querySelector('.bubble h2'); return h2 ? h2.textContent : '';`);
      if (!q) break;
      const chave = Object.keys(respostas).find((k) => q.toLowerCase().includes(k.toLowerCase()));
      if (chave) {
        const achou = await page.eval(`const alvo = ${JSON.stringify(respostas[chave])}; const o = [...document.querySelectorAll('.opt')].find((e) => e.textContent.includes(alvo)); if (!o) return false; if (o.getAttribute('aria-checked') !== 'true') o.click(); return true;`);
        if (!achou) falhas.push('opção não encontrada: ' + q + ' -> ' + respostas[chave]);
      }
      await page.sleep(120);
      // número com o valor de partida (idade, peso, altura): a pessoa confirma tocando em "Está certo"
      await page.eval(`const c = [...document.querySelectorAll('[data-informar] button')].find((e) => e.textContent.trim() === 'Está certo'); if (c) c.click(); return !!c;`);
      const avancou = await page.eval(`const b = [...document.querySelectorAll('button.btn.primary')].find((e) => /Continuar|Concluir/.test(e.textContent)); if (!b || b.disabled) return false; b.click(); return true;`);
      if (!avancou) { falhas.push('não avançou na pergunta: ' + q); break; }
      await page.sleep(250);
    }
  }

  console.log('1. Primeira abertura');
  await page.goto(B, 2500);
  ok((await titulo()).includes('FitCore'), 'título da página é FitCore');
  await page.click('Agora não');
  ok((await texto()).includes('Vamos montar o seu treino?'), 'tela inicial convida a montar o treino');

  console.log('2. Entrevista com o Treinador');
  await page.click('Começar com o Treinador'); await page.sleep(600);
  await page.click('Começar'); await page.sleep(500);
  await entrevista(perfil.treino);
  let t = await texto();
  ok(t.includes('Montei um plano'), 'Treinador apresentou um plano');
  const avisos = await page.eval(`return [...document.querySelectorAll('.note')].map((n) => n.innerText.trim().slice(0, 110));`);
  console.log('     avisos mostrados: ' + (avisos.length ? avisos.join(' | ') : 'nenhum'));
  // se houver aviso de saúde, o usuário precisa marcar que leu
  await page.eval(`const sw = [...document.querySelectorAll('[role=switch], .switch input, .switch')].find((e) => (e.getAttribute('aria-label') || '').includes('Li o aviso')); if (sw) sw.click(); return !!sw;`);
  await page.sleep(200);
  await page.click('Aceitar e usar este treino'); await page.sleep(900);
  t = await texto();
  ok(t.includes('Plano do Treinador'), 'plano aceito aparece na aba Treinos');

  console.log('3. Treino na academia');
  await page.click('Iniciar'); await page.sleep(1200);
  const sess = await page.eval(`return { cards: document.querySelectorAll('.check').length, figs: document.querySelectorAll('.thumb svg.fig').length };`);
  ok(sess.cards > 0, `sessão aberta com ${sess.cards} séries para marcar`);
  // preenche cargas vazias e marca todas as séries, uma a uma
  let marcadas = 0;
  for (let n = 0; n < 80; n++) {
    const r = await page.eval(`
      const set = (inp, v) => { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); inp.dispatchEvent(new Event('blur', { bubbles: true })); };
      const b = [...document.querySelectorAll('button.check')].find((e) => (e.getAttribute('aria-label') || '').startsWith('Marcar série'));
      if (!b) return 'fim';
      const grid = b.closest('.setgrid') || b.parentElement;
      for (const inp of grid.querySelectorAll('input')) { if (!inp.value) set(inp, /carga/.test(inp.getAttribute('aria-label') || '') ? '20' : /tempo/.test(inp.getAttribute('aria-label') || '') ? '20' : '10'); }
      await new Promise((r) => setTimeout(r, 60));
      const b2 = [...document.querySelectorAll('button.check')].find((e) => (e.getAttribute('aria-label') || '').startsWith('Marcar série'));
      b2.click(); await new Promise((r) => setTimeout(r, 120));
      const pular = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Pular'); if (pular) pular.click();
      return 'ok';`);
    if (r === 'fim') break;
    marcadas++;
  }
  ok(marcadas === sess.cards, `todas as séries marcadas (${marcadas} de ${sess.cards})`);
  await page.click('Finalizar treino'); await page.sleep(500);
  await page.click('Finalizar'); await page.sleep(900);
  t = await texto();
  ok(/séries|Séries/.test(t) && !t.includes('Finalizar treino'), 'treino finalizado e resumo exibido');
  const salvo = await page.eval(`const s = await import('/js/store.js'); return { n: s.state.sessions.length, feitas: s.state.sessions[0] ? s.state.sessions[0].itens.reduce((a, it) => a + it.sets.filter((x) => x.ok).length, 0) : 0, emAndamento: !!s.state.current };`);
  ok(salvo.n === 1 && salvo.feitas === sess.cards && !salvo.emAndamento, `treino gravado no histórico (${salvo.feitas} séries)`);

  console.log('4. Evolução e dicas');
  await page.goto(B, 900);
  t = await texto();
  ok(t.includes('Sua evolução') && t.includes('Faltam 2 treinos'), 'tela inicial mostra o cartão de evolução');
  if (!(t.includes('Sua evolução') && t.includes('Faltam 2 treinos'))) console.log('     DIAGNÓSTICO: ' + JSON.stringify(await page.eval(`const s = await import('/js/store.js'); return { url: location.href, sessoes: s.state.sessions.length, emAndamento: !!s.state.current, planos: s.state.plans.length, reserva: !!localStorage.getItem('fitcore.estado'), texto: document.body.innerText.slice(0, 260) };`)));
  await page.click('Ver análise completa'); await page.sleep(700);
  ok((await titulo()).startsWith('Evolução'), 'abre a tela Evolução');
  for (const aba of ['Força', 'Volume', 'Peso', 'Dicas']) { await page.click(aba); await page.sleep(300); }
  await page.click('Peso'); await page.sleep(300);
  await page.eval(`const i = document.querySelector('input[aria-label="Peso em quilos"]'); i.value = '81,4'; i.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await page.click('Registrar'); await page.sleep(500);
  ok((await texto()).includes('81,4 kg'), 'peso corporal registrado');

  console.log('5. Exercícios: busca, filtro e detalhe');
  await page.goto(B + '#exercicios', 1200);
  await page.eval(`const i = document.querySelector('.search input'); i.value = 'agachamento'; i.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await page.sleep(500);
  const busca = await page.eval(`return document.querySelectorAll('.list .item').length;`);
  ok(busca >= 8 && busca < 60, `busca por "agachamento" encontrou ${busca} exercícios`);
  await page.eval(`document.querySelector('.list .item').click(); return true;`); await page.sleep(900);
  const det = await page.eval(`const s = document.querySelector('.figbox svg.fig'); s.scrollIntoView({ block: 'center' }); const a = s.innerHTML; let mexe = false; for (let k = 0; k < 8 && !mexe; k++) { await new Promise((r) => setTimeout(r, 250)); mexe = a !== s.innerHTML; } return { mexe, fontes: !!document.querySelector('.fontes'), palavras: document.querySelector('main').innerText.split(/\\s+/).length };`);
  ok(det.mexe, 'figura do exercício está em movimento');
  if (!det.mexe) console.log('     DIAGNÓSTICO: ' + JSON.stringify(await page.eval(`const s = document.querySelector('.figbox svg.fig'); const st = await import('/js/store.js'); return { url: location.href, temFigura: !!s, botao: document.querySelector('.figctl button')?.getAttribute('aria-label'), animar: st.state.settings.animar, oculto: document.hidden, vis: document.visibilityState, toasts: [...document.querySelectorAll('.toast')].map((x) => x.textContent) };`)));
  ok(det.fontes, 'detalhe traz as fontes da técnica');

  console.log('6. Nutricionista');
  await page.goto(B + '#nutricao', 900);
  await page.click('Começar'); await page.sleep(500);
  await entrevista(perfil.nutri);
  t = await texto();
  ok(/kcal/.test(t) && t.includes('Cardápio de hoje') && !!(await page.eval(`return document.getElementById('hoje-nutri');`)), 'Nutricionista mostrou o resultado: o dia de hoje e o cardápio');
  const refeicoes = await page.eval(`return document.querySelectorAll('.card.refeicao').length;`);
  console.log('     refeições no cardápio de hoje: ' + refeicoes + ' · avisos: ' + (await page.eval(`return [...document.querySelectorAll('.note.warn, .note.danger')].map((n) => n.innerText.trim().slice(0, 90)).join(' | ');`) || 'nenhum'));
  ok(refeicoes === Number(perfil.nutri.refeições.slice(0, 1)), `o cardápio tem as ${perfil.nutri.refeições.slice(0, 1)} refeições pedidas`);
  ok(await page.eval(`return [...document.querySelectorAll('.card.refeicao')].every((c) => c.querySelectorAll('.itens .kv').length > 1 && /\\d+ g/.test(c.querySelector('.itens').textContent));`), 'cada refeição já mostra os alimentos e as quantidades, sem precisar abrir');
  // o dia de hoje: com o treino aceito (3 dias por semana), é dia de treino ou de descanso, nunca os dois
  const hojeNutri = await page.eval(`const c = document.getElementById('hoje-nutri'); return { titulo: c.querySelector('h2').textContent, tipo: c.dataset.treino, antes: !!c.querySelector('#hoje-treino') };`);
  ok(hojeNutri.tipo === 'sim' ? hojeNutri.titulo.startsWith('Hoje: musculação') && hojeNutri.antes : hojeNutri.titulo === 'Hoje: descanso' && !hojeNutri.antes && !/antes do treino/i.test(await page.eval(`return document.getElementById('hoje-nutri').textContent;`)), `bloco do dia coerente: ${hojeNutri.titulo}`);
  ok(await page.eval(`const pos = (s) => document.querySelector(s).getBoundingClientRect().top; return pos('#hoje-nutri') < pos('.card.refeicao') && pos('.card.refeicao') < pos('#metas') && pos('#metas') < pos('#diario-dias');`), 'ordem da tela: hoje → cardápio → metas em detalhe → diário dos outros dias');

  console.log('7. Ajustes e backup');
  await page.goto(B + '#ajustes', 900);
  const backup = await page.eval(`const s = await import('/js/store.js'); const txt = s.exportData(); const r = s.readBackup(txt); return { tam: txt.length, treinos: r.resumo.treinos, pesos: r.resumo.pesos, app: JSON.parse(txt).app };`);
  ok(backup.app === 'fitcore' && backup.treinos === 1 && backup.pesos === 1, `backup gerado e lido de volta (${backup.tam} caracteres)`);

  console.log('8. Sem internet');
  await page.goto(B, 2500);
  const sw = await page.eval(`const r = await navigator.serviceWorker.ready; return !!r.active;`);
  ok(sw, 'service worker ativo');
  await page.offline(true);
  await page.reload(2500);
  t = await texto();
  ok((await titulo()).includes('FitCore') && t.includes('Sua evolução'), 'app abre sem internet, com os dados');
  await page.goto(B + '#exercicio/supino-reto-barra', 1200);
  ok(await page.eval(`return document.querySelectorAll('.figbox svg.fig path').length > 10;`), 'exercício e animação abrem sem internet');
  await page.goto(B + '#treinos', 900);
  await page.click('Iniciar'); await page.sleep(900);
  ok(await page.eval(`return document.querySelectorAll('.check').length > 0;`), 'dá para iniciar um treino sem internet');
  await page.offline(false);

  const erros = page.erros.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
  ok(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' || ').slice(0, 400) : ''));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

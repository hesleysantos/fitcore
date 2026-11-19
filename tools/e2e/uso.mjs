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

// este roteiro testa o modo offline: usa o service worker (tools/e2e/navegador.mjs)
export const comServiceWorker = true;
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
  // carga recomendada: cada série já vem com a sugestão (pelo perfil ou pelo esforço), com uma linha curta de origem e o
  // "Por quê?" fechado
  const rec = await page.eval(`
    const S = await import('/js/store.js'); const { recomendacao } = await import('/js/logic/carga.js'); const T = await import('/js/logic/trainer.js'); const { dateKey } = await import('/js/ui.js');
    const resp = T.respostasParaAvisos(S.state); const sexo = (S.state.nutri.answers || {}).sexo || '';
    const cards = [...document.querySelectorAll('.card')].filter((c) => c.querySelector('.setgrid'));
    return S.state.current.itens.map((it, i) => {
      const dor = T.alertaDoExercicio(it.ex, T.doresDoTreino(S.state, dateKey(new Date()), resp), resp);
      const r = recomendacao(it.ex, it.alvo, it.sets.length, { respostas: resp, sexo, dor });
      const c = cards[i]; const d = c && c.querySelector('details.carga');
      const kgs = [...c.querySelectorAll('input[aria-label^="carga da série"]')].map((x) => x.value);
      return { ex: it.ex, esperado: r.kg, kgs, linha: d ? d.querySelector('summary .linha').textContent : '', fechado: !!d && !d.open, pq: !!d && d.querySelector('summary .pq-link').textContent === 'Por quê?', soltos: c.querySelectorAll(':scope > p').length };
    });`);
  const fmt = (n) => (n == null ? '' : String(n).replace('.', ','));
  ok(rec.every((x) => x.kgs.every((v) => v === fmt(x.esperado))), 'cada série já vem preenchida com a carga recomendada (ou vazia, quando ela é pelo esforço)');
  ok(rec.every((x) => x.linha && x.linha.length <= 41 && x.fechado && x.pq && x.soltos === 0), 'cada exercício mostra só uma linha curta de origem e o "Por quê?" fechado, sem parágrafo solto');
  console.log('     origem da carga: ' + [...new Set(rec.map((x) => x.linha))].join(' | '));
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
  // gasto estimado (logic/gasto.js): com o treino durando 45 min, o quarto cartão mostra as calorias e o "Por quê?" fechado
  const gasto = await page.eval(`const S = await import('/js/store.js'); const G = await import('/js/logic/gasto.js'); const s0 = S.state.sessions[0];
    S.update((s) => { s.sessions[0].inicio = new Date(Date.parse(s0.fim) - 45 * 60000).toISOString(); });
    const R = await import('/js/router.js'); if (location.hash === '#/historico/' + s0.id) R.refresh(); else location.hash = '#/historico/' + s0.id; await new Promise((r) => setTimeout(r, 700));
    const g = G.gastoDoTreino(S.state.sessions[0], S.state); const c = document.getElementById('gasto-treino'); const pq = document.getElementById('gasto-porque');
    return { g: { mostrar: g.mostrar, kcal: g.kcal, motivo: g.motivo }, card: c ? c.textContent : '', pq: !!pq && !pq.open && pq.textContent.includes('Compendium') };`);
  ok(gasto.g.mostrar && gasto.g.kcal > 0 && gasto.card.includes('≈ ' + gasto.g.kcal.toLocaleString('pt-BR') + ' kcal') && gasto.card.includes('gasto estimado') && gasto.pq, 'treino concluído mostra o gasto estimado, com o "Por quê?" fechado e a fonte: ' + gasto.card);

  console.log('3b. Carga pelo perfil num exercício com estudo, e edição');
  // o sexo entra na conta (vem da Nutrição, que ainda não foi respondida): marcado só para este passo e depois desfeito
  await page.eval(`const S = await import('/js/store.js'); window.__nutriAntes = JSON.stringify(S.state.nutri.answers || {}); S.update((s) => { s.nutri.answers = { ...s.nutri.answers, sexo: 'm' }; }); return true;`);
  await page.goto(B + '#treinos', 900);
  await page.click('Treino livre agora'); await page.sleep(700);
  await page.click('Exercício'); await page.sleep(500);
  const add = await page.eval(`
    const sh = [...document.querySelectorAll('.sheet')].pop(); const busca = sh.querySelector('.search input');
    busca.value = 'Supino reto com barra'; busca.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 200));
    const it = [...sh.querySelectorAll('.list .item')].find((e) => e.querySelector('.t') && e.querySelector('.t').textContent === 'Supino reto com barra'); if (!it) return 'sem item';
    it.click(); await new Promise((r) => setTimeout(r, 100)); sh.querySelector('.sheet-ft .btn.primary').click(); await new Promise((r) => setTimeout(r, 500));
    const S = await import('/js/store.js'); const c = S.state.current; return c && c.itens.length === 1 ? c.itens[0].ex : 'nada';`);
  ok(add === 'supino-reto-barra', 'supino reto com barra entrou no treino livre');
  const livre = await page.eval(`
    const S = await import('/js/store.js'); const { recomendacao } = await import('/js/logic/carga.js'); const T = await import('/js/logic/trainer.js');
    const it = S.state.current.itens[0]; const r = recomendacao(it.ex, it.alvo, it.sets.length, { respostas: T.respostasParaAvisos(S.state), sexo: 'm' });
    const d = document.querySelector('details.carga'); const antes = d.open; d.querySelector('summary').click(); await new Promise((x) => setTimeout(x, 100));
    return { r: r.kg, origem: r.origem, sets: it.sets.map((x) => x.kg), valor: document.querySelector('input[aria-label="carga da série 1"]').value, linha: d.querySelector('summary .linha').textContent, antes, abriu: d.open, corpo: d.querySelector('.corpo').innerText };`);
  ok(livre.origem === 'perfil' && livre.r > 0 && livre.sets.every((k) => k === livre.r) && livre.valor === fmt(livre.r), `carga inicial pelo perfil já preenchida em todas as séries: ${livre.r} kg`);
  ok(livre.linha.startsWith('Estimativa pelo perfil') && /1ª série é teste/.test(livre.linha), 'a linha diz que é estimativa e que a 1ª série é teste');
  ok(!livre.antes && livre.abriu && /Sobraram mais de 3: aumente/.test(livre.corpo) && /Fontes/.test(livre.corpo) && /Dias RMR/.test(livre.corpo), '"Por quê?" abre com o ajuste e as fontes');
  // editar: a pessoa muda a carga da 1ª série, marca, e as séries seguintes acompanham; nada fica travado
  const edit = await page.eval(`
    const set = (inp, v) => { inp.value = v; inp.dispatchEvent(new Event('change', { bubbles: true })); };
    const S = await import('/js/store.js'); const novo = ${JSON.stringify(livre.r)} + 6;
    set(document.querySelector('input[aria-label="carga da série 1"]'), String(novo)); await new Promise((r) => setTimeout(r, 60));
    const k1 = S.state.current.itens[0].sets[0].kg;
    document.querySelector('button[aria-label="Marcar série 1 como feita"]').click(); await new Promise((r) => setTimeout(r, 150));
    const pular = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Pular'); if (pular) pular.click();
    const depois = S.state.current.itens[0].sets.map((x) => x.kg);
    document.querySelector('button[aria-label="Aumentar carga da série 2"]').click(); await new Promise((r) => setTimeout(r, 60));
    return { novo, k1, depois, s2: S.state.current.itens[0].sets[1].kg, aberto: !!document.querySelector('details.carga').open };`);
  ok(edit.k1 === edit.novo && edit.depois.every((k) => k === edit.novo), `a carga editada (${edit.novo} kg) vale na série e passa para as seguintes`);
  ok(edit.s2 > edit.novo && edit.aberto, 'dá para mudar qualquer série a qualquer momento, e o "Por quê?" continua aberto depois de redesenhar');
  await page.click('Descartar treino'); await page.sleep(400);
  await page.click('Descartar'); await page.sleep(600);
  await page.eval(`const S = await import('/js/store.js'); const a = JSON.parse(window.__nutriAntes || '{}'); S.update((s) => { s.nutri.answers = a; }); return true;`);
  ok(await page.eval(`const S = await import('/js/store.js'); return !S.state.current && S.state.sessions.length === 1 && !S.state.nutri.answers.sexo;`), 'treino livre descartado sem gravar; o histórico continua com 1 treino');

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
  ok(/kcal/.test(t) && (await page.eval(`return document.querySelectorAll('.card.refeicao').length;`)) >= 3 && !!(await page.eval(`return document.getElementById('hoje-nutri');`)), 'Nutricionista mostrou o resultado: o dia de hoje e as refeições do cardápio');
  const refeicoes = await page.eval(`return document.querySelectorAll('.card.refeicao').length;`);
  console.log('     refeições no cardápio de hoje: ' + refeicoes + ' · avisos: ' + (await page.eval(`return [...document.querySelectorAll('.note.warn, .note.danger')].map((n) => n.innerText.trim().slice(0, 90)).join(' | ');`) || 'nenhum'));
  ok(refeicoes === Number(perfil.nutri.refeições.slice(0, 1)), `o cardápio tem as ${perfil.nutri.refeições.slice(0, 1)} refeições pedidas`);
  ok(await page.eval(`return [...document.querySelectorAll('.card.refeicao')].every((c) => c.querySelectorAll('.itens .kv').length > 1 && /\\d+ g/.test(c.querySelector('.itens').textContent));`), 'cada refeição já mostra os alimentos e as quantidades, sem precisar abrir');
  // o dia de hoje: com o treino aceito (3 dias por semana), é dia de treino ou de descanso, nunca os dois
  const hojeNutri = await page.eval(`const c = document.getElementById('hoje-nutri'); return { titulo: c.querySelector('h2').textContent, tipo: c.dataset.treino, antes: !!c.querySelector('#hoje-treino') };`);
  ok(hojeNutri.tipo === 'sim' ? hojeNutri.titulo.startsWith('Hoje: musculação') && hojeNutri.antes : hojeNutri.titulo === 'Hoje: descanso' && !hojeNutri.antes && !/antes do treino/i.test(await page.eval(`return document.getElementById('hoje-nutri').textContent;`)), `bloco do dia coerente: ${hojeNutri.titulo}`);
  ok(await page.eval(`const pos = (s) => document.querySelector(s).getBoundingClientRect().top; return pos('#hoje-nutri') < pos('.card.refeicao') && pos('.card.refeicao') < pos('#diario-dias') && pos('#diario-dias') < pos('#metas') && pos('#metas') < pos('#saiba-mais');`), 'ordem da tela: hoje → refeições → dias anteriores → metas → saiba mais');

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

// Teste de ponta a ponta da meta de sono, clicando como um usuário: definir a idade, ver a meta e o porquê, informar a
// hora de acordar, registrar, corrigir e apagar noites (com confirmação), conferir a semana, as dicas e as perguntas,
// recarregar e ver que tudo persiste, o cartão da tela inicial, o perfil vindo das entrevistas (dias de treino, plano de
// corrida fora do período, dia vazio da agenda), a virada do dia com a tela aberta e a tela em 360 px (claro e escuro).
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/sono.mjs
// Com FOTOS_SONO=1, grava fotos em .tools/shots/_sono_*.png.
const B = 'http://localhost:5173/';
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export default async (page) => {
  const falhas = [];
  const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msg); if (!cond) falhas.push(msg); };
  const texto = () => page.text();
  const estado = (expr) => page.eval(`const s = (await import('/js/store.js')).state; return ${expr};`);
  const foto = async (nome) => { if (process.env.FOTOS_SONO) await page.shot('_sono_' + nome); };
  const ver = async (sel) => { await page.eval(`const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); return true;`); await page.sleep(150); };
  const hojeKey = await page.eval(`const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');`);
  const chave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const diaMenos = (n) => { const d = new Date(hojeKey + 'T12:00:00'); d.setDate(d.getDate() - n); return chave(d); };
  const wd = (k) => new Date(k + 'T12:00:00').getDay();
  const entreDias = (k) => `${DIAS[(wd(k) + 6) % 7]} para ${DIAS[wd(k)]}`;
  const noiteTxt = (k) => `Noite de ${entreDias(k)}, ${Number(k.slice(8, 10))}/${k.slice(5, 7)}`;
  const segunda = diaMenos((wd(hojeKey) + 6) % 7); // segunda-feira desta semana
  // dentro de `escopo`, toca n vezes em − ou + das horas
  const horas = (escopo, delta) => page.eval(`const b = document.querySelector(${JSON.stringify(escopo)} + ' .sono-passo button[aria-label="${delta < 0 ? 'Menos' : 'Mais'} 15 minutos de sono"]'); if (!b) return false; for (let i = 0; i < ${Math.abs(delta)}; i++) b.click(); return document.querySelector(${JSON.stringify(escopo)} + ' .sono-passo output').textContent;`);
  const nota = (escopo, n) => page.eval(`const c = [...document.querySelectorAll(${JSON.stringify(escopo)} + ' .chips .chip')].find((e) => e.textContent === '${n}'); if (!c) return false; c.focus(); c.click(); return document.activeElement === c && c.getAttribute('aria-pressed') === 'true';`);
  // botão do rodapé da folha que está por cima
  const naFolha = (rotulo) => page.eval(`const f = [...document.querySelectorAll('.sheet')].pop(); const b = f && [...f.querySelectorAll('.sheet-ft .btn')].find((e) => e.textContent.trim() === ${JSON.stringify(rotulo)}); if (!b) return false; b.click(); return true;`);
  const folhas = () => page.eval(`return document.querySelectorAll('.sheet').length;`);
  // espera até haver `n` folhas abertas (a máquina pode estar ocupada: tempo fixo não basta)
  const comFolhas = async (n) => { for (let i = 0; i < 40; i++) { if ((await folhas()) === n) break; await page.sleep(100); } await page.sleep(150); return (await folhas()) === n; };
  const redesenhar = () => page.eval(`(await import('/js/router.js')).refresh(); return true;`);
  const alvoNaTela = () => page.eval(`const e = document.querySelector('#sono-meta .sono-alvo'); return e ? e.textContent : '';`);
  const motivos = () => page.eval(`return [...document.querySelectorAll('#sono-meta .sono-motivos li')].map((e) => e.textContent);`);
  // registra (ou corrige) a noite de um dia pelos botões da semana; `passos` = quantos toques em − (negativo) ou +
  async function noiteDoDia(data, passos, q) {
    const abriu = await page.eval(`const b = document.querySelector('.sono-dia[data-dia="${data}"]'); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;`);
    await page.sleep(300);
    const h = await horas('.sheet', passos);
    if (q) await nota('.sheet', q);
    const salvou = await naFolha('Salvar');
    await page.sleep(400);
    return abriu && salvou ? h : false;
  }

  console.log('1. Tela inicial sem meta: o cartão convida a definir');
  await page.goto(B, 2500);
  await page.click('Agora não');
  let t = await texto();
  ok(await page.eval(`const c = document.getElementById('cartao-sono'); return !!c && c.tagName === 'A' && c.getAttribute('href') === '#/sono' && c.textContent.includes('Quantas horas você precisa dormir?');`), 'cartão do Início convida a definir a meta (é um link para a tela)');
  await page.eval(`document.getElementById('cartao-sono').click(); return true;`); await page.sleep(600);
  ok((await page.eval(`return location.hash;`)) === '#/sono', 'o cartão leva à tela do sono');
  t = await texto();
  ok(t.includes('Sua meta de sono') && t.includes('quantos anos você tem?') && !t.includes('META DESTA NOITE'), 'sem idade conhecida, a tela pergunta a idade');
  ok(t.includes('Quando procurar um médico') && t.includes('não indica remédio nem melatonina') && t.includes('Perguntas sobre o sono'), 'sinais de alerta e perguntas aparecem mesmo antes da meta');
  await foto('1-idade');

  console.log('2. Idade → meta com o porquê');
  const campoIdade = (v) => page.eval(`const i = document.querySelector('#sono-idade .stepper input'); if (!i) return false; i.value = '${v}'; i.dispatchEvent(new Event('change', { bubbles: true })); return i.value;`);
  ok((await campoIdade(3)) === '6', 'a idade mínima da tela é 6 anos, a mesma da lógica');
  ok((await campoIdade(34)) === '34', 'campo da idade');
  await page.click('Ver minha meta'); await page.sleep(500);
  t = await texto();
  ok(t.includes('META DESTA NOITE') && (await alvoNaTela()) === '8 h' && t.includes('faixa: 7 a 9 h'), 'meta: 8 h, faixa de 7 a 9 h');
  ok(t.toLowerCase().includes(`meta desta noite · ${DIAS[wd(hojeKey)]} para ${DIAS[(wd(hojeKey) + 1) % 7]}`), 'a meta diz de que noite é (de hoje para amanhã)');
  ok(t.includes('Aos 34 anos, os consensos de sono recomendam de 7 a 9 h por noite.') && t.includes('Idade: 34 anos, informada aqui.'), 'a meta explica o porquê e de onde veio a idade');
  await page.eval(`document.querySelector('#sono-meta details.pq summary').click(); return true;`); await page.sleep(150);
  ok((await page.eval(`return document.querySelector('#sono-meta details.pq').textContent;`)).includes('Hirshkowitz M') && (await page.eval(`return document.querySelector('#sono-meta details.pq').textContent;`)).includes('Watson NF'), 'as fontes da meta abrem ao toque');
  ok((await estado('s.sono.idade')) === 34, 'idade gravada');
  await foto('2-meta');

  console.log('3. Hora de acordar → hora de deitar (e as dicas acompanham)');
  ok((await texto()).includes('Informe a hora em que você costuma acordar'), 'sem hora de acordar, a tela pede a hora');
  const acordarAs = (v) => page.eval(`const i = document.querySelector('input[aria-label="Hora de acordar"]'); if (!i) return false; i.focus(); i.value = '${v}'; i.dispatchEvent(new Event('change', { bubbles: true })); return document.activeElement === i;`);
  await page.eval(`document.querySelector('#sono-dicas .dica').dataset.marca = 'antes'; return true;`);
  ok(await acordarAs('06:30'), 'campo da hora de acordar (e o foco continua nele)');
  await page.sleep(300);
  ok((await page.eval(`return document.getElementById('sono-deitar').textContent;`)) === 'Para dormir 8 h, apague a luz às 22:30.', 'acordar às 06:30 com alvo de 8 h → deitar às 22:30');
  ok((await estado('s.sono.acordar')) === '06:30', 'hora de acordar gravada');
  ok(await page.eval(`const d = document.querySelector('#sono-dicas .dica'); return !!d && d.dataset.marca !== 'antes';`), 'as dicas são redesenhadas quando a hora de acordar muda');

  console.log('4. Registrar a noite passada');
  t = await texto();
  ok(t.includes(noiteTxt(hojeKey)) && t.includes('Quanto você dormiu?'), 'a tela pergunta pela noite, com a data: ' + noiteTxt(hojeKey));
  ok((await horas('#sono-noite', -2)) === '7 h 30', 'dois toques em − levam de 8 h para 7 h 30');
  ok(await nota('#sono-noite', 4), 'a nota de como acordou fica marcada e o foco continua no botão');
  await page.eval(`[...document.querySelectorAll('#sono-noite .btn')].find((e) => e.textContent.trim() === 'Registrar').click(); return true;`); await page.sleep(500);
  let reg = await estado('s.sono.registros');
  ok(reg.length === 1 && reg[0].data === hojeKey && reg[0].horas === 7.5 && reg[0].qualidade === 4, 'noite gravada no dia de hoje: ' + JSON.stringify(reg));
  t = await texto();
  ok((await page.eval(`return document.querySelector('#sono-noite h3').textContent;`)) === noiteTxt(hojeKey) && t.includes('7 h 30') && t.includes('Dentro da faixa') && t.includes('Acordou: 4 de 5') && t.includes('1 de 7 noites'), 'a noite aparece na tela, dentro da faixa');

  console.log('5. Outras noites pela semana; média, noites curtas e variação');
  // a folha abre com as horas da noite mais recente (hoje, 7 h 30): ontem 6 h (−6), anteontem 6 h 30 (−4), há 3 dias 8 h (+2), há 4 dias 5 h 30 (−8)
  await page.eval(`document.querySelector('.sono-dia[data-dia="${diaMenos(1)}"]').click(); return true;`); await page.sleep(300);
  ok((await page.eval(`return document.getElementById('sono-folha-noite').textContent;`)) === noiteTxt(diaMenos(1)), 'a folha diz de que noite é: ' + noiteTxt(diaMenos(1)));
  await naFolha('Cancelar'); await page.sleep(300);
  ok((await noiteDoDia(diaMenos(1), -6, 2)) === '6 h', 'ontem: 6 h');
  ok((await noiteDoDia(diaMenos(2), -4)) === '6 h 30', 'anteontem: 6 h 30');
  ok((await noiteDoDia(diaMenos(3), 2)) === '8 h', 'há 3 dias: 8 h');
  ok((await noiteDoDia(diaMenos(4), -8, 1)) === '5 h 30', 'há 4 dias: 5 h 30');
  reg = await estado('s.sono.registros');
  ok(reg.length === 5 && reg.map((r) => r.data).join() === [4, 3, 2, 1, 0].map(diaMenos).join() && reg.map((r) => r.horas).join() === '5.5,8,6.5,6,7.5', 'cinco noites gravadas em ordem de data: ' + reg.map((r) => r.horas).join(' '));
  t = await texto();
  const stats = await page.eval(`return [...document.querySelectorAll('#sono-semana .stat')].map((e) => e.textContent);`);
  ok(stats.length === 3 && stats[0].includes('6 h 42') && stats[1].includes('3 de 5') && stats[1].includes('noites curtas') && stats[2].includes('± 62 min'), 'média 6 h 42, 3 de 5 noites curtas, variação ± 62 min: ' + stats.join(' | '));
  ok(t.includes('5 de 7 noites') && t.includes('em geral, ficaram a mais de 1 hora da sua média'), 'a tela explica a variação como distância da média');
  ok(await page.eval(`const g = document.querySelector('#sono-semana svg.sono-graf'); return !!g && g.querySelectorAll('rect.bar').length === 5 && g.querySelectorAll('rect.bar.abaixo').length === 3 && !!g.querySelector('rect.zona') && !!g.querySelector('line.alvo');`), 'gráfico: 5 barras (3 abaixo da faixa), faixa recomendada e linha do alvo');
  const dicas1 = await page.eval(`return [...document.querySelectorAll('.dica')].map((e) => e.dataset.dica);`);
  ok(dicas1.length >= 3 && dicas1.length <= 4 && dicas1[0] === 'faltou' && t.includes('Sua média foi de 6 h 42 em 5 noites, abaixo do mínimo de 7 h.') && !dicas1.includes('acordado'), 'dicas: de 3 a 4, a primeira avisa que faltou sono: ' + dicas1.join(', '));
  ok(await page.eval(`return [...document.querySelectorAll('.dica')].every((e) => !!e.querySelector('details.pq .ref'));`), 'toda dica traz as fontes');
  await ver('#sono-noite'); await foto('3-noite-semana');
  await ver('#sono-semana'); await foto('4-semana');

  console.log('6. Corrigir e apagar (apagar pede confirmação)');
  await page.click('Corrigir'); await page.sleep(300);
  ok((await texto()).includes('Corrigir a noite'), 'a folha de correção abre');
  await horas('.sheet', 1); await naFolha('Salvar'); await page.sleep(400);
  reg = await estado('s.sono.registros');
  ok(reg.length === 5 && reg[4].horas === 7.75 && reg[4].qualidade === 4, 'noite corrigida para 7 h 45, sem duplicar');
  await page.eval(`const b = document.querySelector('.sono-dia[data-dia="${diaMenos(4)}"]'); b.click(); return true;`); await comFolhas(1);
  await naFolha('Apagar'); const pediu = await comFolhas(2);
  t = await texto();
  ok(pediu && t.includes('Apagar esta noite?') && t.includes(`${noiteTxt(diaMenos(4))}: 5 h 30. Não dá para desfazer.`) && (await estado('s.sono.registros.length')) === 5, 'apagar pede confirmação e ainda não apaga');
  await naFolha('Cancelar');
  ok((await comFolhas(1)) && (await estado('s.sono.registros.length')) === 5, 'cancelar a confirmação mantém a noite e a folha aberta');
  await naFolha('Apagar'); await comFolhas(2); await naFolha('Apagar'); const fechou = await comFolhas(0); await page.sleep(300);
  reg = await estado('s.sono.registros');
  ok(reg.length === 4 && !reg.some((r) => r.data === diaMenos(4)) && (await texto()).includes('4 de 7 noites'), 'confirmando, a noite é apagada');
  ok(fechou, 'as folhas fecham depois de apagar');
  // uma noite sem dormir não vira sugestão para a próxima: a folha seguinte abre na última noite com sono
  await noiteDoDia(diaMenos(5), -40);
  ok((await estado(`s.sono.registros.find((r) => r.data === '${diaMenos(5)}').horas`)) === 0, 'noite de 0 h registrada');
  await page.eval(`const st = await import('/js/store.js'); const lg = await import('/js/logic/sono.js'); st.update((s) => { lg.apagarNoite(s.sono, '${hojeKey}'); lg.apagarNoite(s.sono, '${diaMenos(1)}'); lg.apagarNoite(s.sono, '${diaMenos(2)}'); lg.apagarNoite(s.sono, '${diaMenos(3)}'); }); return true;`); await redesenhar(); await page.sleep(300);
  ok((await horas('#sono-noite', 0)) === '8 h', 'só com uma noite de 0 h registrada, o registro abre no alvo (8 h), não em 0 h');
  await page.eval(`const st = await import('/js/store.js'); const lg = await import('/js/logic/sono.js'); st.update((s) => { lg.apagarNoite(s.sono, '${diaMenos(5)}'); for (const [d, h, q] of [['${diaMenos(3)}', 8], ['${diaMenos(2)}', 6.5], ['${diaMenos(1)}', 6, 2], ['${hojeKey}', 7.75, 4]]) lg.gravarNoite(s.sono, { data: d, horas: h, ...(q ? { qualidade: q } : {}) }); }); return true;`); await redesenhar(); await page.sleep(300);

  console.log('7. Perguntas frequentes com busca e fontes');
  ok(await page.eval(`return document.querySelectorAll('details.acc').length === 4;`), 'quatro perguntas aparecem de início');
  await page.eval(`const i = document.querySelector('.search input'); i.value = 'café'; i.dispatchEvent(new Event('input', { bubbles: true })); return true;`); await page.sleep(200);
  ok((await page.eval(`return document.querySelector('details.acc summary').textContent;`)) === 'Até que horas posso tomar café?', 'a busca por “café” encontra a pergunta da cafeína');
  await page.eval(`document.querySelector('details.acc summary').click(); return true;`); await page.sleep(150);
  ok((await page.eval(`return document.querySelector('details.acc').textContent;`)).includes('Drake C') && (await texto()).includes('6 horas antes de deitar'), 'a resposta traz os números e as fontes');
  await page.eval(`const i = document.querySelector('.search input'); i.value = 'qwertyzx'; i.dispatchEvent(new Event('input', { bubbles: true })); return true;`); await page.sleep(200);
  ok((await texto()).includes('Não encontrei isso na minha base'), 'busca sem resultado avisa e não inventa resposta');
  await page.eval(`const i = document.querySelector('.search input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); return true;`); await page.sleep(200);
  await page.click('Ver todas as'); await page.sleep(200);
  ok(await page.eval(`return document.querySelectorAll('details.acc').length >= 18;`), 'todas as perguntas abrem');

  console.log('8. Recarregar: tudo persiste');
  await page.reload(1800); await page.goto(B + '#/sono', 900);
  const st2 = await estado(`{ acordar: s.sono.acordar, idade: s.sono.idade, n: s.sono.registros.length, hoje: s.sono.registros[s.sono.registros.length - 1] }`);
  ok(st2.acordar === '06:30' && st2.idade === 34 && st2.n === 4 && st2.hoje.data === hojeKey && st2.hoje.horas === 7.75, 'hora de acordar, idade e noites continuam depois de recarregar: ' + JSON.stringify(st2));
  t = await texto();
  ok(t.includes('faixa: 7 a 9 h') && t.includes('7 h 45') && t.includes('4 de 7 noites') && (await page.eval(`return document.querySelector('input[aria-label="Hora de acordar"]').value;`)) === '06:30' && t.includes('apague a luz às 22:30'), 'a tela mostra os mesmos dados');

  console.log('9. Cartão da tela inicial');
  await page.goto(B, 900);
  // espera o cartão aparecer (a tela inicial pode levar um instante a mais para desenhar)
  await page.eval(`for (let i = 0; i < 30 && !document.getElementById('cartao-sono'); i++) await new Promise((r) => setTimeout(r, 100));`);
  let c = await page.eval(`const e = document.getElementById('cartao-sono'); return e ? e.textContent : '';`);
  ok(c.includes('Meta: 8 h (7 a 9 h)') && c.includes(`Noite de ${entreDias(hojeKey)}: 7 h 45`) && c.includes('Dentro da faixa') && c.includes('Para acordar às 06:30, deite até as 22:30.'), 'cartão: meta, noite (com os dias) e hora de deitar: ' + c.slice(0, 150));
  ok(await page.eval(`const k = document.getElementById('cartao-sono'); const a = k.querySelector('a.sono-abrir'); return !!a && !a.hasAttribute('aria-label') && a.textContent.includes('Meta: 8 h') && !k.querySelector('button h2, a h2, button h3, a h3') && !!k.querySelector(':scope > .row > h2');`), 'acessibilidade: o link lê a meta (sem rótulo que a esconda) e o título não fica dentro de botão');
  await foto('5-inicio');
  // sem a noite de hoje, o cartão registra em um toque
  await page.eval(`const st = await import('/js/store.js'); const lg = await import('/js/logic/sono.js'); st.update((s) => { lg.apagarNoite(s.sono, '${hojeKey}'); }); return true;`); await redesenhar(); await page.sleep(400);
  ok((await horas('#cartao-sono', 0)) === '6 h' && (await page.eval(`return document.getElementById('cartao-sono').textContent;`)).includes(`Noite de ${entreDias(hojeKey)}: quanto você dormiu?`), 'o cartão pergunta pela noite certa e sugere as horas da última noite registrada');
  await horas('#cartao-sono', 4);
  await page.eval(`[...document.querySelectorAll('#cartao-sono .btn')].find((e) => e.textContent.trim() === 'Registrar').click(); return true;`); await page.sleep(500);
  reg = await estado('s.sono.registros');
  ok(reg.length === 4 && reg[3].data === hojeKey && reg[3].horas === 7, 'noite registrada pelo cartão do Início');
  ok((await page.eval(`return document.getElementById('cartao-sono').textContent;`)).includes(`Noite de ${entreDias(hojeKey)}: 7 h`), 'o cartão passa a mostrar a noite');
  await page.eval(`document.querySelector('#cartao-sono a.sono-abrir').click(); return true;`); await page.sleep(500);
  ok((await page.eval(`return location.hash;`)) === '#/sono', 'o link do cartão leva à tela do sono');

  console.log('10. Perfil das entrevistas: dias de treino (não sessões), dia vazio da agenda e plano de corrida fora do período');
  const corrida = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 2, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 34, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  // plano de musculação nos dias dados (0 = domingo), com ou sem exercícios; plano de corrida começando em `inicio` (ou nenhum)
  const perfilCom = async ({ dias, vazio = false, inicio = '' }) => {
    await page.eval(`const st = await import('/js/store.js'); st.update((s) => {
      s.plans = [{ id: 'pz', nome: 'Teste', origem: 'manual', criadoEm: '', dias: [{ id: 'd1', nome: 'A', foco: '', itens: ${vazio ? '[]' : `[{ ex: 'supino-reto-barra', series: 3, reps: '10', descanso: 90, nota: '' }]`} }], agenda: ${JSON.stringify(Object.fromEntries(dias.map((d) => [d, 'd1'])))}, info: '' }]; s.activePlan = 'pz';
      s.run = ${inicio ? `{ answers: ${JSON.stringify(corrida)}, aceitoEm: '${inicio}T12:00:00.000Z', inicio: '${inicio}', pausadoEm: '' }` : `{ answers: {}, aceitoEm: '', inicio: '', pausadoEm: '' }`};
    }); return true;`);
    await redesenhar(); await page.sleep(450);
    return { alvo: await alvoNaTela(), motivos: await motivos(), perfil: await page.eval(`const lg = await import('/js/logic/sono.js'); const s = (await import('/js/store.js')).state; const p = lg.perfilDeSono(s, '${hojeKey}'); return { dias: p.diasDeTreino, musc: p.musculacao, corrida: p.corrida, prova: p.prova };`) };
  };
  let pf = await perfilCom({ dias: [1, 2, 3, 4, 5] });
  ok(pf.alvo === '8 h 30' && pf.motivos.length === 2 && pf.motivos[1].startsWith('Você treina em 5 dias nesta semana'), 'musculação de segunda a sexta: 5 dias de treino → alvo 8 h 30');
  pf = await perfilCom({ dias: [1, 2, 3, 4, 5], vazio: true });
  ok(pf.alvo === '8 h' && pf.motivos.length === 1 && pf.perfil.dias === 0, 'dias da agenda sem exercício não contam como treino → alvo 8 h');
  pf = await perfilCom({ dias: [1, 3], inicio: segunda });
  ok(pf.perfil.corrida && pf.perfil.corrida.dias === 4 && pf.perfil.dias === 6 && pf.alvo === '8 h 30' && pf.motivos.some((m) => m.startsWith('Você treina em 6 dias nesta semana')), 'plano de corrida em curso: seg/qua de musculação + 4 dias de corrida = 6 dias → alvo 8 h 30');
  pf = await perfilCom({ dias: [2, 4, 6], inicio: segunda });
  ok(pf.perfil.musc === 3 && pf.perfil.corrida.dias === 4 && pf.perfil.dias === 4 && pf.alvo === '8 h' && !pf.motivos.some((m) => m.includes('treina em')), 'musculação e corrida nos mesmos dias (ter/qui/sáb + dom) = 4 dias, não 7 treinos → alvo 8 h');
  const d = new Date(segunda + 'T12:00:00'); d.setDate(d.getDate() + 7); const proximaSegunda = chave(d);
  pf = await perfilCom({ dias: [1, 3], inicio: proximaSegunda });
  ok(pf.perfil.corrida === null && pf.perfil.dias === 2 && pf.alvo === '8 h' && pf.motivos.length === 1, 'plano de corrida que ainda não começou não soma treinos → alvo 8 h');
  d.setDate(d.getDate() - 7 - 28); const haQuatroSemanas = chave(d);
  pf = await perfilCom({ dias: [1, 3], inicio: haQuatroSemanas });
  ok(pf.perfil.corrida === null && pf.perfil.prova === null && pf.perfil.dias === 2 && pf.alvo === '8 h' && pf.motivos.length === 1 && !(await texto()).includes('prova é'), 'plano de corrida já concluído não soma treinos nem fala em prova → alvo 8 h');
  // idade do Treinador (16 anos), 5 dias de treino, objetivo e treino à noite
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.trainer.answers = { ...s.trainer.answers, idade: 16, objetivo: 'hipertrofia' }; s.nutri.answers = { ...s.nutri.answers, horario: 'noite' }; }); return true;`);
  pf = await perfilCom({ dias: [1, 2, 3, 4, 5] });
  t = await texto();
  ok(pf.alvo === '9 h 30' && t.includes('faixa: 8 a 10 h'), 'aos 16 anos com 5 dias de treino: faixa de 8 a 10 h e alvo de 9 h 30');
  ok(t.includes('Aos 16 anos, os consensos de sono recomendam de 8 a 10 h por noite.') && t.includes('Você treina em 5 dias nesta semana') && t.includes('Idade: 16 anos, informada ao Treinador.') && pf.motivos.length === 2, 'a meta explica em duas linhas: a idade e a carga de treino');
  ok(!(await page.eval(`return [...document.querySelectorAll('#sono-meta .btn')].some((e) => e.textContent.trim() === 'Alterar');`)), 'idade vinda da entrevista não se altera aqui');
  ok((await page.eval(`return document.getElementById('sono-deitar').textContent;`)) === 'Para dormir 9 h 30, apague a luz às 21:00.', 'a hora de deitar acompanha o novo alvo');
  const dicas2 = await page.eval(`return [...document.querySelectorAll('.dica')].map((e) => e.dataset.dica);`);
  ok(dicas2.includes('jovem') && t.includes('Adolescentes que treinam e dormem menos de 8 horas') && !dicas2.some((x) => ['alcool', 'cafeina', 'treinoNoite', 'musculo'].includes(x)), 'aos 16 anos as dicas são as da idade (sem álcool, corte de café ou estudos de adultos): ' + dicas2.join(', '));
  await foto('6-perfil-jovem');

  console.log('11. A dica do café acompanha a hora de acordar; virada do dia com a tela aberta');
  // adulto de novo, sem treinos: só dicas gerais. Escolhe um dia (hoje ou um dos próximos 4) em que a dica do café aparece.
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.trainer.answers = {}; s.nutri.answers = {}; s.plans = []; s.activePlan = ''; s.sono.registros = []; }); return true;`);
  const relogio = (dias) => page.eval(dias ? `if (!window.__Date) window.__Date = Date; const D = window.__Date; const off = ${dias} * 86400000; window.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } }; return true;` : `if (window.__Date) window.Date = window.__Date; return true;`);
  const k = await page.eval(`const lg = await import('/js/logic/sono.js'); const s = (await import('/js/store.js')).state; for (let i = 0; i < 5; i++) { const d = new Date(Date.now() + i * 86400000); const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); if (lg.dicasDeSono(s, key).some((x) => x.id === 'cafeina')) return i; } return -1;`);
  ok(k >= 0, 'há um dia próximo em que a dica do café aparece');
  await relogio(k); await redesenhar(); await page.sleep(400);
  const cafe = () => page.eval(`const e = document.querySelector('.dica[data-dica="cafeina"]'); return e ? e.textContent : '';`);
  ok((await cafe()).includes('menos de 8,8 horas de deitar') && (await cafe()).includes('Para deitar às 22:30, o último café fica para até as 13:40.'), 'dica do café: mesma conta do texto (8,8 h antes de 22:30 → 13:40)');
  await acordarAs('07:30'); await page.sleep(300);
  ok((await page.eval(`return document.getElementById('sono-deitar').textContent;`)).includes('23:30') && (await cafe()).includes('Para deitar às 23:30, o último café fica para até as 14:40.') && !(await cafe()).includes('13:40'), 'mudar “Acordo às” atualiza a hora do último café na mesma hora');
  await acordarAs('06:30'); await page.sleep(200);
  await relogio(0); await redesenhar(); await page.sleep(400);
  // a tela foi desenhada hoje; o relógio passa para amanhã e a pessoa toca em Registrar
  const antes = await estado('s.sono.registros.length');
  ok((await page.eval(`return document.querySelector('#sono-noite h3').textContent;`)) === noiteTxt(hojeKey), 'antes da virada, a tela mostra a noite de hoje');
  await relogio(1);
  await page.eval(`[...document.querySelectorAll('#sono-noite .btn')].find((e) => e.textContent.trim() === 'Registrar').click(); return true;`); await page.sleep(500);
  const amanha = diaMenos(-1);
  ok((await estado('s.sono.registros.length')) === antes, 'com o dia virado, o toque em Registrar não grava a noite no dia errado');
  ok((await page.eval(`return document.querySelector('#sono-noite h3').textContent;`)) === noiteTxt(amanha) && (await page.eval(`const e = document.querySelector('.toast'); return e ? e.textContent : '';`)).includes('O dia mudou'), 'a tela é redesenhada para a noite nova e avisa: ' + noiteTxt(amanha));
  await page.eval(`[...document.querySelectorAll('#sono-noite .btn')].find((e) => e.textContent.trim() === 'Registrar').click(); return true;`); await page.sleep(500);
  reg = await estado('s.sono.registros');
  ok(reg.length === antes + 1 && reg[reg.length - 1].data === amanha, 'na tela nova, o registro vai para o dia certo');
  // o mesmo no cartão do Início
  await relogio(0);
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.sono.registros = []; }); return true;`);
  await page.goto(B, 900);
  await relogio(1);
  await page.eval(`[...document.querySelectorAll('#cartao-sono .btn')].find((e) => e.textContent.trim() === 'Registrar').click(); return true;`); await page.sleep(500);
  ok((await estado('s.sono.registros.length')) === 0 && (await page.eval(`return document.getElementById('cartao-sono').textContent;`)).includes(`Noite de ${entreDias(amanha)}`), 'cartão do Início: com o dia virado, não grava e passa a mostrar a noite nova');
  await relogio(0);
  // devolve os dados para as fotos em 360 px
  await page.eval(`const st = await import('/js/store.js'); const lg = await import('/js/logic/sono.js'); st.update((s) => {
    s.trainer.answers = { idade: 16, objetivo: 'hipertrofia' }; s.nutri.answers = { horario: 'noite' };
    s.plans = [{ id: 'pz', nome: 'Teste', origem: 'manual', criadoEm: '', dias: [{ id: 'd1', nome: 'A', foco: '', itens: [{ ex: 'supino-reto-barra', series: 3, reps: '10', descanso: 90, nota: '' }] }], agenda: { 1: 'd1', 2: 'd1', 3: 'd1', 4: 'd1', 5: 'd1' }, info: '' }]; s.activePlan = 'pz';
    for (const [d, h, q] of [['${diaMenos(3)}', 8], ['${diaMenos(2)}', 6.5], ['${diaMenos(1)}', 6, 2], ['${hojeKey}', 7, 4]]) lg.gravarNoite(s.sono, { data: d, horas: h, ...(q ? { qualidade: q } : {}) });
  }); return true;`);

  console.log('12. Tela estreita (360 px), tema claro e escuro');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  for (const tema of ['claro', 'escuro']) {
    await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.settings.tema = '${tema}'; }); return true;`);
    await page.goto(B + '#/sono', 900); await page.reload(1500); await page.goto(B + '#/sono', 700);
    const claro = await page.eval(`return document.documentElement.dataset.theme === 'light';`);
    ok(claro === (tema === 'claro'), `tema ${tema} aplicado`);
    ok(await page.eval(`return document.documentElement.scrollWidth <= 361;`), `tela do sono cabe em 360 px sem rolagem lateral (${tema})`);
    ok(await page.eval(`const r = [...document.querySelectorAll('#conteudo *')].filter((e) => e.getClientRects().length && !e.closest('svg')).map((e) => e.getBoundingClientRect()); return r.every((x) => x.right <= 360.5 && x.left >= -0.5);`), `nenhum elemento passa da largura da tela (${tema})`);
    await foto(`7-360-${tema}-topo`);
    await ver('#sono-noite'); await foto(`8-360-${tema}-noite`);
    await ver('#sono-semana'); await foto(`9-360-${tema}-semana`);
    await ver('.dica'); await foto(`10-360-${tema}-dicas`);
    await ver('.sono-sinais'); await foto(`11-360-${tema}-sinais`);
    // folha de registro e confirmação de apagar em 360 px
    await page.eval(`const b = document.querySelector('.sono-dia[data-dia="${diaMenos(1)}"]'); b.scrollIntoView({ block: 'center' }); b.click(); return true;`); await comFolhas(1); await page.sleep(200);
    ok(await page.eval(`const s = document.querySelector('.sheet'); if (!s) return false; const r = s.getBoundingClientRect(); return r.right <= 360.5 && document.documentElement.scrollWidth <= 361;`), `folha de registro cabe em 360 px (${tema})`);
    await foto(`12-360-${tema}-folha`);
    await naFolha('Apagar'); await comFolhas(2); await page.sleep(200);
    ok(await page.eval(`const s = [...document.querySelectorAll('.sheet')].pop(); const r = s.getBoundingClientRect(); return document.querySelectorAll('.sheet').length === 2 && r.right <= 360.5 && document.documentElement.scrollWidth <= 361;`), `confirmação de apagar cabe em 360 px (${tema})`);
    await foto(`13-360-${tema}-confirmar`);
    await naFolha('Cancelar'); await comFolhas(1); await page.eval(`const b = document.querySelector('.sheet .iconbtn[aria-label="Fechar"]'); if (b) b.click(); return true;`); await comFolhas(0);
    await page.goto(B, 900);
    ok(await page.eval(`return document.documentElement.scrollWidth <= 361 && !!document.getElementById('cartao-sono');`), `tela inicial com o cartão cabe em 360 px (${tema})`);
    await ver('#cartao-sono'); await foto(`14-360-${tema}-inicio`);
  }

  const erros = page.erros.filter((e) => !/favicon|SWv:/.test(e));
  ok(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' || ').slice(0, 500) : ''));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

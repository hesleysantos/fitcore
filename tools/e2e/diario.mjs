// Teste de ponta a ponta do diário alimentar, clicando como um usuário: registrar sem entrevista (só o total),
// cada refeição do cardápio com o "Já comi" em cima e a sugestão ("Comi" discreto em cada alimento, "Comi tudo isso") embaixo, recolher e abrir o card (o que conta é o que
// foi marcado + o que foi adicionado à mão, nada em dobro: biscoito no lanche), adicionar pela busca (sem acento nem pontuação, medida
// caseira e gramas), alimento fora da lista (calorias só em número inteiro), corrigir, apagar (com confirmação),
// faltam / passou da meta, dias anteriores, semana, recarregar e ver que persistiu, quem não recebe contagem
// (transtorno alimentar; menores, em qualquer entrevista), a virada do dia com a tela aberta e a tela em 360 px
// (claro e escuro); "adicionar vários de uma vez" ("Acrescentar" e "Adicionar todos (N)"), a separação "Da sugestão" /
// "Fora da sugestão" dentro do "Já comi" e os suplementos e vitaminas do dia (whey com o rótulo, menores, transtorno).
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/diario.mjs
// O relógio da página é fixado (não anda): o roteiro não depende da hora em que roda. HORA=12:30 escolhe a hora
// simulada (padrão 09:00). Com FOTOS_DIARIO=1, grava fotos em .tools/shots/_diario_*.png.
const B = 'http://localhost:5173/';
const RESPOSTAS = { objetivo: 'manter', sexo: 'm', idade: 30, peso: 80, altura: 178, atividade: 'leve', treinos: '3', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };
const HORA = /^\d\d:\d\d$/.test(process.env.HORA || '') ? process.env.HORA : '09:00';

export default async (page) => {
  const falhas = [];
  const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msg); if (!cond) falhas.push(msg); };
  const texto = () => page.text();
  const estado = (expr) => page.eval(`const s = (await import('/js/store.js')).state; return ${expr};`);
  // a foto é só registro: se o navegador não responder a tempo, o roteiro avisa e segue
  const foto = async (nome) => { if (!process.env.FOTOS_DIARIO) return; try { await page.shot('_diario_' + nome); } catch (e) { console.log('  (foto ' + nome + ' não saiu: ' + String(e.message).slice(0, 60) + ')'); } };
  const ver = async (sel) => { await page.eval(`const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); return true;`); await page.sleep(150); };

  // relógio da página: parado no instante guardado em sessionStorage (sobrevive a recarregar); sem valor, o relógio real
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const R = Date; const ler = () => { try { return Number(sessionStorage.getItem('__relogio')) || 0; } catch { return 0; } }; class D extends R { constructor(...a) { if (a.length) super(...a); else super(ler() || R.now()); } static now() { return ler() || R.now(); } } window.Date = D; })();` });
  const p2 = (n) => String(n).padStart(2, '0');
  const agora = new Date();
  const hojeKey = `${agora.getFullYear()}-${p2(agora.getMonth() + 1)}-${p2(agora.getDate())}`;
  const diaMenos = (n) => { const d = new Date(hojeKey + 'T12:00:00'); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  const diaMes = (k) => `${Number(k.slice(8, 10))}/${k.slice(5, 7)}`;
  // acerta o relógio da página para um dia e uma hora locais (ex.: relogio(hojeKey, '23:59'))
  const relogio = (data, hora) => page.eval(`sessionStorage.setItem('__relogio', String(new (Object.getPrototypeOf(Date))(${JSON.stringify(data + 'T' + hora + ':00')}).getTime())); return new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');`);
  const redesenhar = async () => { await page.eval(`(await import('/js/router.js')).refresh(); return true;`); await page.sleep(350); };
  const folhas = () => page.eval(`return document.querySelectorAll('.sheet').length;`);
  const comFolhas = async (n) => { for (let i = 0; i < 40; i++) { if ((await folhas()) === n) break; await page.sleep(100); } await page.sleep(150); return (await folhas()) === n; };
  const naFolha = (rotulo) => page.eval(`const f = [...document.querySelectorAll('.sheet')].pop(); const b = f && [...f.querySelectorAll('.sheet-ft .btn')].find((e) => e.textContent.trim() === ${JSON.stringify(rotulo)}); if (!b) return false; b.click(); return true;`);
  const aviso = () => page.eval(`const e = document.querySelector('.toast'); return e ? e.textContent : '';`);
  // com metas e cardápio, o resumo do dia (#diario) fica no alto e os alimentos de hoje aparecem em cada refeição
  // (.refeicao .diario-comido) ou em "Outros alimentos de hoje" (#diario-hoje); os dias anteriores ficam em #diario-passado
  const noDiario = (sel) => page.eval(`const s = ${JSON.stringify(sel)}; const e = document.querySelector(s.startsWith('#') ? s : '#diario ' + s); return e ? e.textContent : '';`);
  const modoNaTela = () => page.eval(`const e = document.getElementById('diario'); return e ? e.dataset.modo || '' : '';`);
  const itensNaTela = () => page.eval(`return [...document.querySelectorAll('#conteudo .diario-item')].filter((e) => !e.closest('#diario-passado')).map((e) => e.textContent);`);
  const doDia = (data) => estado(`(s.diario.dias.find((d) => d.data === '${data}') || { itens: [] }).itens`);
  const hoje = () => doDia(hojeKey);
  // "Adicionar alimento" (tela sem cardápio, ou "... em 4/11" nos dias anteriores); com cardápio, o "+ Adicionar outro alimento" de uma refeição
  const abrirAdicionar = async (rotulo = 'Adicionar alimento') => { await page.eval(`const bs = [...document.querySelectorAll('#conteudo .btn')]; const b = bs.find((e) => e.textContent.trim() === ${JSON.stringify(rotulo)}) || (${JSON.stringify(rotulo)} === 'Adicionar alimento' ? bs.find((e) => e.classList.contains('add-alimento')) : null); b.scrollIntoView({ block: 'center' }); b.click(); return true;`); return comFolhas(1); };
  const naRefeicao = (ref) => page.eval(`return [...document.querySelectorAll('.refeicao[data-ref="${ref}"] .diario-comido .diario-item')].map((e) => e.textContent);`);
  // a refeição é sempre escolhida no roteiro (nada depende da refeição que a hora do relógio sugere)
  const refeicao = (ref) => page.eval(`const s = document.querySelector('.sheet select[aria-label="Refeição"]'); s.value = '${ref}'; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value;`);
  const buscar = async (t) => { await page.eval(`const i = document.querySelector('.sheet input[aria-label="Buscar alimento"]'); i.value = ${JSON.stringify(t)}; i.dispatchEvent(new Event('input', { bubbles: true })); return true;`); await page.sleep(200); return page.eval(`return [...document.querySelectorAll('.sheet .diario-achado')].map((e) => e.dataset.al);`); };
  const escolher = async (al) => { const achou = await page.eval(`const b = document.querySelector('.sheet .diario-achado[data-al="${al}"]'); if (!b) return false; b.click(); return true;`); await page.sleep(250); return achou; };
  const passo = (delta) => page.eval(`const b = document.querySelector('.sheet .stepper button[aria-label^="${delta < 0 ? 'Diminuir' : 'Aumentar'}"]'); for (let i = 0; i < ${Math.abs(delta)}; i++) b.click(); return document.querySelector('.sheet .stepper input').value;`);
  const conta = () => page.eval(`const e = document.getElementById('diario-conta'); return e ? e.textContent : '';`);
  const campo = (rotulo, v) => page.eval(`const i = document.querySelector('.sheet input[aria-label="${rotulo}"]'); if (!i) return false; i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  const tocarItem = async (trecho) => { const achou = await page.eval(`const b = [...document.querySelectorAll('#conteudo .diario-item')].filter((e) => !e.closest('#diario-passado')).find((e) => e.textContent.includes(${JSON.stringify(trecho)})); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;`); return achou && (await comFolhas(1)); };
  // o botão de baixo da sugestão de uma refeição: "Comi tudo isso" ou "Desmarcar tudo"; o resumo de uma linha do título do card
  const botoesDe = (ref) => page.eval(`const a = document.querySelector('.diario-acoes-sug[data-ref="${ref}"]'); return a ? [...a.querySelectorAll('.btn')].map((b) => b.textContent.trim()).join('|') : '';`);
  const resumoDe = (ref) => page.eval(`const e = document.querySelector('.refeicao[data-ref="${ref}"] .ref-resumo'); return e ? e.textContent : '';`);
  const abertoDe = (ref) => page.eval(`return document.querySelector('.refeicao[data-ref="${ref}"] .ref-hd').getAttribute('aria-expanded') === 'true' && !document.querySelector('.refeicao[data-ref="${ref}"] .ref-corpo').hidden;`);
  // "Já comi" de uma refeição não tem nenhum botão que some a sugestão inteira
  const semComiTudoEmbaixo = (ref) => page.eval(`const c = document.querySelector('.refeicao[data-ref="${ref}"] .comido'); return !!c && ![...c.querySelectorAll('.btn')].some((b) => /Comi tudo|Comi isso/.test(b.textContent));`);
  // botões dentro de "Ver a sugestão do cardápio" (quando a refeição já tem algo comido) e o "Comi" de cada alimento da sugestão
  const tocarSug = async (ref, rotulo) => { const achou = await page.eval(`const b = [...document.querySelectorAll('.diario-acoes-sug[data-ref="${ref}"] .btn')].find((e) => e.textContent.trim() === ${JSON.stringify(rotulo)}); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;`); await page.sleep(450); return achou; };
  // "Comi" de um alimento: ele sai da sugestão e sobe para "Já comi"; o título do card não sai do lugar
  const comiItem = async (ref, al) => page.eval(`const b = document.querySelector('.refeicao[data-ref="${ref}"] .itens .kv[data-al="${al}"] .sug-marca'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const hd = () => document.querySelector('.refeicao[data-ref="${ref}"] .ref-hd').getBoundingClientRect().top; const y0 = hd(); b.click(); await new Promise((r) => setTimeout(r, 650)); return { y0, y1: hd(), saiu: !document.querySelector('.refeicao[data-ref="${ref}"] .itens .kv[data-al="${al}"]'), toast: (document.querySelector('.toast') || {}).textContent || '' };`);
  const kcalExata = (al, g) => page.eval(`const f = (await import('/js/data/foods.js')).ALIMENTOS.find((x) => x.id === '${al}'); return f.kcal * ${g} / 100;`);
  const tocarEm = async (ref, rotulo) => { const achou = await page.eval(`const b = [...document.querySelectorAll('#conteudo .refeicao[data-ref="${ref}"] .btn')].find((e) => e.textContent.trim() === ${JSON.stringify(rotulo)}); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;`); await page.sleep(450); return achou; };
  const kcalDe = (al, g) => page.eval(`const f = (await import('/js/data/foods.js')).ALIMENTOS.find((x) => x.id === '${al}'); return Math.round(f.kcal * ${g} / 100);`);
  const totalDeHoje = () => page.eval(`const d = await import('/js/logic/diario.js'); const s = (await import('/js/store.js')).state; return d.totaisDoDia(s.diario, '${hojeKey}').kcal;`);
  const resumoInicio = () => page.eval(`const d = await import('/js/logic/diario.js'); const s = (await import('/js/store.js')).state; const x = d.resumoDeHoje(s, '${hojeKey}'); return { modo: x.modo, kcal: x.kcal, metaKcal: x.metaKcal, frase: x.frase, n: x.n };`);
  const mil = (n) => Math.round(n).toLocaleString('pt-BR');

  console.log(`0. Relógio da página parado em ${HORA}`);
  await page.goto(B, 2500);
  ok((await relogio(hojeKey, HORA)) === `${Number(HORA.slice(0, 2))}:${HORA.slice(3)}`, 'a página vê a hora simulada');
  await page.goto(B, 1200);
  await page.click('Agora não');

  console.log('1. Sem entrevista: o diário funciona e mostra só o total');
  await page.goto(B + '#/nutricao', 900);
  let t = await texto();
  ok(t.includes('O que comi hoje') && t.includes('Nada registrado hoje') && t.includes('Responda à entrevista para comparar com a sua meta do dia.'), 'sem entrevista, o bloco aparece, vazio, e convida a responder');
  ok((await modoNaTela()) === 'soma' && !t.includes('Faltam') && !t.includes('comido / meta') && !(await page.eval(`return !!document.getElementById('diario-kcal');`)), 'sem meta, não há "faltam" nem "comido / meta"');
  ok(await abrirAdicionar(), '"Adicionar alimento" abre a folha');
  ok((await buscar('p')).length === 0 && (await texto()).includes('Digite pelo menos 2 letras'), 'com 1 letra a busca pede mais');
  ok((await buscar('qwzx')).length === 0 && (await texto()).includes('Não achei esse alimento'), 'busca sem resultado orienta para "Não achei na lista"');
  ok((await buscar('arroz, cozido')).includes('arroz-branco-cozido') && (await buscar('leite (integral)')).includes('leite-integral'), 'pontuação no termo não atrapalha ("arroz, cozido", "leite (integral)")');
  ok(!(await buscar('coca')).includes('pacoca') && (await buscar('paco')).includes('pacoca'), 'a busca vale pelo começo das palavras: "coca" não acha "Paçoca"');
  const achados = await buscar('pao fr');
  ok(achados[0] === 'pao-frances', 'a busca sem acento ("pao fr") acha o pão francês, em primeiro: ' + achados.join(', '));
  await foto('1-busca');
  ok(await escolher('pao-frances'), 'toca no alimento');
  ok((await conta()).startsWith('50 g (1 unidade)') && (await conta()).includes('kcal'), 'abre com 1 porção e mostra medida e calorias: ' + (await conta()));
  ok((await passo(1)) === '1,5' && (await conta()).startsWith('75 g (1,5 unidade'), 'um toque em + passa para 1,5 porção (75 g): ' + (await conta()));
  ok((await refeicao('lanche-manha')) === 'lanche-manha', 'escolhe a refeição');
  await naFolha('Adicionar'); await comFolhas(0);
  let itens = await hoje();
  ok(itens.length === 1 && itens[0].al === 'pao-frances' && itens[0].g === 75 && itens[0].m === true && itens[0].ref === 'lanche-manha', 'gravado no dia de hoje: ' + JSON.stringify(itens));
  const kPao75 = await kcalDe('pao-frances', 75);
  t = await texto();
  ok((await noDiario('#diario-frase')).startsWith(`Total do dia: ${mil(kPao75)} kcal`) && (await itensNaTela())[0].includes(`${mil(kPao75)} kcal`), 'a tela mostra as calorias do alimento e o total do dia');
  ok(t.includes('quem anota o que come costuma registrar menos do que comeu') && t.includes('médias de tabela'), 'a linha de cuidado com os números aparece');

  console.log('2. Com a entrevista respondida: consumido × meta e "faltam"');
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.nutri.answers = ${JSON.stringify(RESPOSTAS)}; s.nutri.calculadoEm = new Date().toISOString(); s.nutri.seed = 0; }); return true;`);
  await page.goto(B + '#/nutricao', 900); await redesenhar();
  const meta = await page.eval(`const n = await import('/js/logic/nutrition.js'); const r = n.calcular(${JSON.stringify(RESPOSTAS)}); return { kcal: r.kcal, prot: r.prot };`);
  t = await texto();
  ok((await modoNaTela()) === 'meta' && (await noDiario('#diario-kcal')) === `${mil(kPao75)} de ${mil(meta.kcal)} kcal` && (await noDiario('#diario-prot')).startsWith('Proteína '), `com meta, em uma linha: ${mil(kPao75)} de ${mil(meta.kcal)} kcal`);
  ok((await noDiario('#diario-frase')) === `Faltam ${mil(Math.round((meta.kcal - (await totalDeHoje())) / 10) * 10)} kcal para a meta do dia.` && (await noDiario('#diario-proteina')).startsWith('Proteína: faltam '), 'frase clara: ' + (await noDiario('#diario-frase')));
  ok(await page.eval(`const pos = (sel) => document.querySelector(sel).getBoundingClientRect().top; return pos('#hoje-nutri') < pos('#diario') && pos('#diario') < pos('.refeicao');`), 'comido / meta fica no alto, no cartão de hoje, antes do cardápio');
  await ver('#diario'); await foto('2-com-meta');

  console.log('3. "Comi tudo isso": um toque copia a refeição do cardápio');
  // o cardápio de hoje é o do dia (semente pela data), o mesmo que a tela mostra
  const sugerido = await page.eval(`const n = await import('/js/logic/nutrition.js'); const c = n.cardapioDoDia(n.calcular(${JSON.stringify(RESPOSTAS)}), '${hojeKey}'); return Object.fromEntries(c.refeicoes.map((r) => [r.nome, r.itens.map((x) => [x.id, x.g])]));`);
  const cafe = sugerido['Café da manhã'], almoco = sugerido['Almoço'];
  ok((await botoesDe('cafe')) === 'Comi tudo isso' && (await botoesDe('almoco')) === 'Comi tudo isso' && (await page.eval(`return [...document.querySelectorAll('.refeicao')].every((c) => c.querySelector('.comido .add-alimento') && c.querySelector('.trocar') && c.querySelector('.ref-resumo').textContent === 'ainda não');`)), 'cada refeição tem a sugestão com "Comi tudo isso", "Trocar", o seu "Já comi" com "+ Adicionar outro alimento" e o resumo "ainda não"');
  ok(await page.eval(`return [...document.querySelectorAll('.refeicao')].every((c) => c.querySelectorAll('.itens .kv').length === c.querySelectorAll('.itens .sug-marca').length);`), 'cada alimento da sugestão tem o seu "Comi"');
  ok(await page.eval(`return [...document.querySelectorAll('.refeicao')].every((c) => c.querySelector('.comido').getBoundingClientRect().top < c.querySelector('.sug-box').getBoundingClientRect().top);`), 'em cada refeição, "Já comi" fica em cima e a sugestão embaixo');
  ok(await page.eval(`const b = document.querySelector('.sug-marca'); const cs = getComputedStyle(b); return parseFloat(cs.borderTopWidth) === 0 && cs.backgroundColor === 'rgba(0, 0, 0, 0)';`), 'o "Comi" é discreto: sem contorno e sem fundo');
  ok(await page.eval(`const d = document.getElementById('divisor-consulta'); const refs = [...document.querySelectorAll('.refeicao')]; return !!d && d.textContent === 'Para consultar' && refs.every((c) => c.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(d.compareDocumentPosition(document.getElementById('diario-dias')) & Node.DOCUMENT_POSITION_FOLLOWING) && getComputedStyle(document.getElementById('diario-dias')).backgroundColor !== getComputedStyle(refs[0]).backgroundColor;`), 'depois das refeições, a linha "Para consultar" separa os cards de informação (planos, sem o fundo do card de refeição)');
  await ver('.diario-acoes-sug[data-ref="cafe"]'); await foto('3-cardapio');
  await tocarEm('cafe', 'Comi tudo isso');
  itens = await hoje();
  const doCafe = itens.filter((x) => x.ref === 'cafe');
  ok(doCafe.length === cafe.length && doCafe.every((x, i) => x.al === cafe[i][0] && x.g === cafe[i][1]), `os ${cafe.length} alimentos do café da manhã sugerido foram para o diário`);
  ok((await aviso()).includes('Café da manhã: adicionado em “Já comi”'), 'avisa que registrou: ' + (await aviso()));
  ok((await botoesDe('cafe')) === 'Desmarcar tudo' && (await resumoDe('cafe')).startsWith('✓ comi ') && (await abertoDe('cafe')), 'a refeição copiada oferece "Desmarcar tudo", o título diz "✓ comi … kcal" e o card continua aberto (não some de baixo do dedo)');
  ok((await naRefeicao('cafe')).length === cafe.length && (await page.eval(`const g = document.querySelector('.refeicao[data-ref="cafe"] .comido details.comido-grupo'); return !!g && g.querySelector('summary').textContent.includes('(${cafe.length} alimentos)');`)), 'em "Já comi", a sugestão inteira aparece numa linha só ("Café da manhã da sugestão (N alimentos)"), sem repetir os alimentos um por um');
  ok((await page.eval(`return [...document.querySelectorAll('#diario-hoje .diario-item')].map((e) => e.textContent.split(' ')[0] + ' ' + e.textContent.split(' ')[1]).join('|');`)).startsWith('Pão francês') && (await page.eval(`return document.querySelectorAll('#diario-hoje .diario-item').length;`)) === 1, 'em "Outros alimentos de hoje" fica só o pão do lanche da manhã (refeição que não está no cardápio de 4 refeições)');

  console.log('4. "+ Adicionar outro alimento" e um alimento avulso no horário do almoço');
  await tocarEm('almoco', 'Adicionar outro alimento');
  ok((await comFolhas(1)) && (await page.eval(`return document.querySelector('.sheet select[aria-label="Refeição"]').value;`)) === 'almoco', 'a folha abre com "Almoço" marcado');
  ok((await buscar('feij')).includes('feijao-carioca-cozido') && (await escolher('feijao-carioca-cozido')), 'busca "feij" e escolhe o feijão-carioca');
  await page.eval(`[...document.querySelectorAll('.sheet .seg button')].find((b) => b.textContent.trim() === 'Gramas').click(); return true;`); await page.sleep(250);
  await page.eval(`const i = document.querySelector('.sheet .stepper input'); i.value = '200'; i.dispatchEvent(new Event('change', { bubbles: true })); return true;`); await page.sleep(150);
  ok((await conta()).startsWith('200 g (2 conchas') && (await passo(1)) === '210' && (await passo(-1)) === '200', 'em gramas: digita 200, o passo é de 10 g: ' + (await conta()));
  await naFolha('Adicionar'); await comFolhas(0);
  itens = await hoje();
  const feijao = itens.find((x) => x.al === 'feijao-carioca-cozido' && x.ref === 'almoco');
  ok(!!feijao && feijao.g === 200 && feijao.m === false, 'feijão gravado no almoço, 200 g');
  // o alimento adicionado no card aparece na própria refeição (não num bloco solto no alto), com a sugestão à mão
  const almocoNaTela = await naRefeicao('almoco');
  ok(almocoNaTela.length === 1 && almocoNaTela[0].includes('Feijão carioca cozido'), 'o feijão aparece dentro do almoço, em "Já comi"');
  ok(await page.eval(`const c = document.querySelector('.refeicao[data-ref="almoco"]'); return c.querySelectorAll('.itens .sug-marca').length > 1 && c.textContent.includes('Já comi') && ![...document.querySelectorAll('#diario-hoje .diario-item')].some((e) => e.textContent.includes('Feijão')) && !document.querySelector('#hoje-nutri .diario-item');`), 'o almoço mostra a sugestão (com "Comi") e "Já comi"; nada vai para o alto nem para outro card');
  await ver('.refeicao[data-ref="almoco"]'); await foto('4b-comi-outra-coisa');
  // o defeito do dono: o "Comi isso" ficava embaixo do que a pessoa comeu e somava a sugestão inteira
  ok((await semComiTudoEmbaixo('almoco')) && (await botoesDe('almoco')) === 'Comi tudo isso', 'com um alimento avulso no almoço, "Comi tudo isso" fica só junto da sugestão; em "Já comi" não há botão que some a sugestão');
  const antesDoAlmoco = (await hoje()).length;
  const novos = almoco.filter(([id]) => id !== 'feijao-carioca-cozido').length;
  ok(await tocarSug('almoco', 'Comi tudo isso'), '"Comi tudo isso" fica dentro da sugestão do cardápio');
  itens = await hoje();
  ok(itens.length === antesDoAlmoco + novos && almoco.every(([id]) => itens.filter((x) => x.ref === 'almoco' && x.al === id).length === 1), `"Comi tudo isso" completa o almoço com ${novos} alimentos, sem repetir o que já estava lá`);
  ok((await botoesDe('almoco')) === 'Desmarcar tudo', 'depois de copiado, o almoço mostra "registrado"');

  console.log('4b. Biscoito à mão no lanche: só conta o que foi marcado + o que foi adicionado');
  const lanche = sugerido['Lanche da tarde'];
  let kLanche = 0; for (const [id, g] of lanche) kLanche += await kcalExata(id, g);
  const k0 = await totalDeHoje();
  await tocarEm('lanche-tarde', 'Adicionar outro alimento'); await comFolhas(1);
  ok((await buscar('biscoito cream')).includes('biscoito-cream-cracker') && (await escolher('biscoito-cream-cracker')), 'busca e escolhe o biscoito cream cracker (5 unidades, 30 g)');
  await naFolha('Adicionar'); await comFolhas(0);
  const kB = await kcalExata('biscoito-cream-cracker', 30);
  ok(Math.abs((await totalDeHoje()) - (k0 + kB)) < 0.01, `o total sobe só o biscoito: +${Math.round(kB)} kcal (não a sugestão do lanche, ${Math.round(kLanche)} kcal)`);
  ok((await semComiTudoEmbaixo('lanche-tarde')) && (await naRefeicao('lanche-tarde')).length === 1 && (await page.eval(`return document.querySelector('.sheet') === null;`)), 'o lanche mostra o biscoito em "Já comi", sem botão que some a sugestão embaixo');
  ok((await resumoDe('lanche-tarde')).startsWith('comi ') && !(await resumoDe('lanche-tarde')).includes('da sugestão'), 'o título do lanche diz quanto comeu: ' + (await resumoDe('lanche-tarde')));
  const [al1, g1] = lanche[0];
  const k1 = await kcalExata(al1, g1);
  const toque = await comiItem('lanche-tarde', al1);
  ok(toque && toque.saiu && Math.abs(toque.y1 - toque.y0) < 2, `"Comi" em um alimento: ele sai da sugestão e o título do card não sai do lugar (${toque && Math.round(toque.y0)} → ${toque && Math.round(toque.y1)} px)`);
  ok(toque && /: adicionado em “Já comi”\.$/.test(toque.toast), 'aparece o aviso rápido: ' + (toque && toque.toast));
  ok(Math.abs((await totalDeHoje()) - (k0 + kB + k1)) < 0.01 && (await naRefeicao('lanche-tarde')).length === 2, `o total sobe só esse alimento (+${Math.round(k1)} kcal) e ele aparece em "Já comi"`);
  ok((await resumoDe('lanche-tarde')).includes(`1 de ${lanche.length} da sugestão`) && (await page.eval(`return document.querySelectorAll('.refeicao[data-ref="lanche-tarde"] .comido .comido-sec.da-sug .diario-item').length;`)) === 1, 'o título diz "1 de N da sugestão" e o alimento marcado aparece uma vez em "Já comi", em "Da sugestão"');
  await ver('.refeicao[data-ref="lanche-tarde"]'); await foto('4c-biscoito-e-um-item');
  // desfazer: tocar no alimento em "Já comi" e apagar; ele volta para a sugestão
  const nomeAl1 = await page.eval(`return (await import('/js/data/foods.js')).ALIMENTOS.find((x) => x.id === '${al1}').nome;`);
  ok(await tocarItem(nomeAl1), 'tocar no alimento em "Já comi" abre a correção');
  await naFolha('Apagar'); await comFolhas(2); await naFolha('Apagar'); await comFolhas(0);
  ok(Math.abs((await totalDeHoje()) - (k0 + kB)) < 0.01 && (await page.eval(`return !!document.querySelector('.refeicao[data-ref="lanche-tarde"] .itens .kv[data-al="${al1}"]');`)), 'apagado em "Já comi": o total volta a ser só o biscoito e o alimento volta para a sugestão');
  // corrigir a quantidade do biscoito e apagar
  ok(await tocarItem('Biscoito cream cracker'), 'tocar no biscoito abre a correção');
  ok((await passo(1)) === '1,5' && (await conta()).startsWith('45 g'), 'passa para 1,5 porção (45 g)');
  await naFolha('Salvar'); await comFolhas(0);
  ok(Math.abs((await totalDeHoje()) - (k0 + 1.5 * kB)) < 0.01 && (await hoje()).filter((x) => x.al === 'biscoito-cream-cracker').length === 1, 'corrigido: conta 45 g, uma vez só');
  await tocarItem('Biscoito cream cracker'); await naFolha('Apagar'); await comFolhas(2); await naFolha('Apagar'); await comFolhas(0);
  ok(Math.abs((await totalDeHoje()) - k0) < 0.01 && (await botoesDe('lanche-tarde')) === 'Comi tudo isso' && (await resumoDe('lanche-tarde')) === 'ainda não', 'apagado: o total volta ao de antes e o lanche volta a oferecer "Comi tudo isso"');

  console.log('5. Alimento que não está na lista (calorias só em número inteiro)');
  await abrirAdicionar();
  await buscar('bolo de cenoura');
  await page.click('Não achei na lista'); await page.sleep(250);
  ok((await page.eval(`return document.querySelector('.sheet input[aria-label="Nome do alimento"]').value;`)) === 'bolo de cenoura', 'o nome digitado na busca já vem preenchido');
  await naFolha('Adicionar'); await page.sleep(200);
  ok((await folhas()) === 1 && (await aviso()).includes('Informe as calorias'), 'sem calorias, não grava e explica');
  await campo('Calorias', '1,5'); await naFolha('Adicionar'); await page.sleep(200);
  ok((await folhas()) === 1 && (await aviso()).includes('número inteiro'), '"1,5" é recusado com aviso: ' + (await aviso()));
  await campo('Calorias', '12.5'); await naFolha('Adicionar'); await page.sleep(200);
  ok((await folhas()) === 1 && (await aviso()).includes('número inteiro'), '"12.5" (ambíguo) é recusado com aviso');
  await campo('Calorias', '99999'); await naFolha('Adicionar'); await page.sleep(200);
  ok((await folhas()) === 1 && (await aviso()).includes('vão de 0 a'), 'calorias fora do limite: não grava');
  await campo('Calorias', '310'); await campo('Proteína em gramas', '1.200'); await naFolha('Adicionar'); await page.sleep(200);
  ok((await folhas()) === 1 && (await aviso()).includes('Digite a proteína em gramas'), 'proteína inválida: não grava');
  await campo('Nome do alimento', 'Bolo de cenoura <b>da vó</b>'); await campo('Calorias', '1.200'); await campo('Proteína em gramas', '4,5');
  await refeicao('outro');
  await foto('4-fora-da-lista');
  await naFolha('Adicionar'); await comFolhas(0);
  itens = await hoje();
  const bolo = itens.find((x) => x.nome);
  ok(!!bolo && bolo.nome === 'Bolo de cenoura <b>da vó</b>' && bolo.kcal === 1200 && bolo.p === 4.5 && bolo.ref === 'outro', '"1.200" vale 1200 kcal (não 1): ' + JSON.stringify(bolo));
  ok(await page.eval(`const e = [...document.querySelectorAll('#diario-hoje .diario-item')].find((x) => x.textContent.includes('Bolo de cenoura')); return !!e && e.textContent.includes('<b>da vó</b>') && !e.querySelector('b') && e.textContent.includes('1.200 kcal') && e.textContent.includes('fora da lista');`), 'o nome digitado aparece como texto (não vira HTML), com as calorias, em "Outros alimentos de hoje" (fora das refeições do cardápio)');
  ok((await noDiario('#diario-macros')).includes('sem contar 1 alimento fora da lista'), 'a tela avisa que carboidrato, gordura e fibras não contam o alimento fora da lista');

  console.log('6. Corrigir e apagar (apagar pede confirmação)');
  const antes = (await hoje()).length;
  // o primeiro alimento do dia (i1) é o pão francês registrado no passo 1
  ok((await page.eval(`const b = [...document.querySelectorAll('#conteudo .diario-item[data-id="i1"]')].find((e) => !e.closest('#diario-passado')); if (!b || !b.textContent.includes('Pão francês')) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;`)) && (await comFolhas(1)), 'tocar no alimento abre "Corrigir alimento"');
  ok((await texto()).includes('Corrigir alimento') && (await conta()).startsWith('75 g'), 'a folha abre com a quantidade gravada');
  ok((await passo(1)) === '2' && (await conta()).startsWith('100 g (2 unidades)'), 'passa para 2 porções (100 g)');
  await naFolha('Salvar'); await comFolhas(0);
  itens = await hoje();
  ok(itens.length === antes && itens.find((x) => x.id === 'i1').g === 100, 'corrigido para 100 g, sem duplicar');
  await tocarItem('Bolo de cenoura');
  ok((await page.eval(`return document.querySelector('.sheet input[aria-label="Calorias"]').value;`)) === '1200' && (await page.eval(`return document.querySelector('.sheet input[aria-label="Proteína em gramas"]').value;`)) === '4,5', 'o alimento fora da lista abre com o que foi gravado');
  await naFolha('Apagar'); const pediu = await comFolhas(2);
  ok(pediu && (await texto()).includes('Apagar este alimento?') && (await texto()).includes('Não dá para desfazer') && (await hoje()).length === antes, 'apagar pede confirmação e ainda não apaga');
  await foto('5-confirmar');
  await naFolha('Cancelar');
  ok((await comFolhas(1)) && (await hoje()).length === antes, 'cancelar mantém o alimento');
  await naFolha('Apagar'); await comFolhas(2); await naFolha('Apagar'); ok(await comFolhas(0), 'confirmando, as folhas fecham');
  itens = await hoje();
  ok(itens.length === antes - 1 && !itens.some((x) => x.nome), 'o alimento foi apagado');

  console.log('7. Faltam e passou da meta');
  let total = await totalDeHoje();
  ok((await noDiario('#diario-frase')) === `Faltam ${mil(Math.round((meta.kcal - total) / 10) * 10)} kcal para a meta do dia.`, 'antes: ' + (await noDiario('#diario-frase')));
  const extra = Math.round(meta.kcal - total) + 250;
  await abrirAdicionar(); await page.click('Não achei na lista'); await page.sleep(200);
  await campo('Nome do alimento', 'Rodízio de pizza'); await campo('Calorias', String(extra)); await refeicao('jantar'); await naFolha('Adicionar'); await comFolhas(0);
  ok((await noDiario('#diario-frase')) === 'Você passou 250 kcal da meta do dia.', 'depois: ' + (await noDiario('#diario-frase')));
  ok((await noDiario('#diario-equivale')).startsWith('Na conta teórica, isso equivale a cerca de 30 g de gordura.'), 'a frase diz o tamanho real da diferença, sem julgamento');
  ok(await page.eval(`const c = document.getElementById('diario'); return !c.querySelector('.danger, .note.warn, .note.danger') && !/exager|estour|culpa/i.test(c.textContent);`), 'sem cor de erro nem palavra de culpa quando passa da meta');
  ok((await botoesDe('jantar')) === 'Comi tudo isso' && (await semComiTudoEmbaixo('jantar')), 'com o alimento avulso no jantar, "Comi tudo isso" fica só junto da sugestão do jantar');
  let ini = await resumoInicio();
  ok(ini.modo === 'meta' && ini.metaKcal === meta.kcal && ini.frase === 'Você passou 250 kcal da meta do dia.', 'resumoDeHoje() (Início): consumido / meta e a mesma frase');
  await ver('#diario'); await foto('6-passou');

  console.log('8. Dias anteriores (seção no fim da tela, fechada)');
  const ontem = diaMenos(1);
  ok((await page.eval(`const d = document.getElementById('diario-dias'); return !!d && !d.open;`)), '"Dias anteriores" começa fechado');
  await page.click('Dias anteriores'); await page.sleep(300);
  ok((await noDiario('#diario-dia')) === `Ontem, ${diaMes(ontem)}` && (await noDiario('#diario-passado')).includes('Nada registrado neste dia.'), 'abre em ontem, vazio: ' + (await noDiario('#diario-dia')));
  await abrirAdicionar(`Adicionar alimento em ${diaMes(ontem)}`);
  ok((await texto()).includes('Adicionar alimento · ontem'), 'a folha diz de que dia é');
  ok((await buscar('banana pra')).includes('banana-prata') && (await escolher('banana-prata')), 'a busca ignora o hífen: "banana pra" acha a banana-prata');
  await refeicao('ceia'); await naFolha('Adicionar'); await comFolhas(0);
  const deOntem = await doDia(ontem);
  ok(deOntem.length === 1 && deOntem[0].al === 'banana-prata' && deOntem[0].ref === 'ceia' && (await estado('s.diario.dias.map((d) => d.data).join()')) === `${ontem},${hojeKey}`, 'gravado em ontem; os dias ficam em ordem de data');
  ok((await page.eval(`return document.querySelectorAll('#diario-passado .diario-item').length;`)) === 1 && (await page.eval(`return document.getElementById('diario-dias').open;`)), 'a seção continua aberta e mostra só o alimento de ontem');
  // o cardápio de hoje pode trazer banana-prata (muda com a data): hoje, na tela, só as bananas registradas hoje
  { const naTela = await page.eval(`return [...document.querySelectorAll('.refeicao .diario-item, #diario-hoje .diario-item')].filter((e) => e.textContent.includes('Banana-prata')).length;`);
    const deHoje = (await hoje()).filter((x) => x.al === 'banana-prata').length;
    ok(naTela === deHoje, 'o alimento de ontem não entra nas refeições de hoje', { naTela, deHoje }); }
  ok((await page.eval(`return document.querySelector('#diario-passado .iconbtn[aria-label="Dia anterior"]').disabled;`)) === false, 'ainda dá para voltar mais (o limite é o primeiro dia que o diário guarda)');
  ok((await page.eval(`return document.querySelector('#diario-passado .iconbtn[aria-label="Dia seguinte"]').disabled;`)) === true, 'de ontem não se avança: hoje está nas refeições, no alto');
  await page.click('Dia anterior'); await page.sleep(400);
  ok((await noDiario('#diario-dia')) !== `Ontem, ${diaMes(ontem)}` && (await page.eval(`return document.querySelectorAll('#diario-passado .diario-item').length;`)) === 0, 'anteontem: vazio');
  await page.click('Dia seguinte'); await page.sleep(400);
  ok((await noDiario('#diario-dia')) === `Ontem, ${diaMes(ontem)}`, 'volta para ontem');
  await page.eval(`document.querySelector('#diario-semana summary').click(); return true;`); await page.sleep(200);
  ok((await page.eval(`return document.getElementById('diario-semana').textContent;`)).includes('2 dias registrados') && (await page.eval(`return document.getElementById('diario-semana').textContent;`)).includes('em 2 dias registrados nos últimos 7'), 'a semana mostra a média e os dias registrados');
  await ver('#diario-semana'); await foto('7-semana');

  console.log('9. Recarregar: tudo persiste');
  const guardado = await estado('JSON.stringify(s.diario)');
  await page.reload(1800); await page.goto(B + '#/nutricao', 900);
  ok((await estado('JSON.stringify(s.diario)')) === guardado, 'o diário continua igual depois de recarregar');
  ok((await noDiario('#diario-frase')) === 'Você passou 250 kcal da meta do dia.' && (await itensNaTela()).some((x) => x.includes('Rodízio de pizza')), 'a tela mostra os mesmos alimentos e a mesma frase');

  console.log('10. Quem não recebe contagem: transtorno alimentar e menores de 18 (em qualquer entrevista)');
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.nutri.answers = { ...s.nutri.answers, condicoes: ['transtorno'] }; }); return true;`); await redesenhar();
  t = await texto();
  ok(t.includes('não oferece o diário de alimentação') && !(await page.eval(`return [...document.querySelectorAll('.btn')].some((b) => b.textContent.trim() === 'Adicionar alimento' || b.classList.contains('add-alimento'));`)) && !t.includes('Você passou') && !t.includes('comido / meta'), 'com histórico de transtorno alimentar, o diário não é oferecido e nenhum número aparece');
  ini = await resumoInicio();
  ok(ini.modo === 'sem' && ini.kcal === null && ini.frase === '', 'e o resumo do Início não traz número nem frase');
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.nutri.answers = { ...s.nutri.answers, condicoes: ['nenhuma'], idade: 16, peso: 60, altura: 170 }; }); return true;`); await redesenhar();
  ok((await modoNaTela()) === 'alimentos' && !(await page.eval(`return document.getElementById('diario').textContent;`)).includes('kcal') && (await itensNaTela()).length > 0, 'aos 16 anos, o diário lista os alimentos sem nenhuma caloria');
  await abrirAdicionar(); await buscar('arroz');
  ok(!(await page.eval(`return document.querySelector('.sheet').textContent;`)).includes('kcal'), 'a busca também não mostra calorias');
  await buscar('qwzx'); ok((await texto()).includes('para escrever o nome'), 'sem resultado, o convite é para escrever o nome (não as calorias)');
  await page.click('Não achei na lista'); await page.sleep(250);
  ok((await page.eval(`return !!document.querySelector('.sheet input[aria-label="Nome do alimento"]') && !document.querySelector('.sheet input[aria-label="Calorias"]') && !document.querySelector('.sheet input[aria-label="Proteína em gramas"]') && !/caloria|kcal/i.test(document.querySelector('.sheet').textContent);`)), 'fora da lista, o menor de 18 só escreve o nome: não há campo de calorias');
  await campo('Nome do alimento', 'Suco da cantina'); await refeicao('lanche-tarde'); await naFolha('Adicionar'); await comFolhas(0);
  const suco = (await hoje()).find((x) => x.nome === 'Suco da cantina');
  ok(!!suco && suco.kcal === 0 && suco.p === null && (await itensNaTela()).some((x) => x.includes('Suco da cantina') && !x.includes('kcal')), 'gravado só com o nome, sem calorias: ' + JSON.stringify(suco));
  ini = await resumoInicio();
  ok(ini.modo === 'alimentos' && ini.kcal === null && ini.frase === '', 'o resumo do Início também fica sem calorias');
  // a idade só é conhecida por outra entrevista (sem nutrição respondida): continua sem calorias
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.nutri.answers = {}; s.trainer.answers = { ...s.trainer.answers, idade: 15 }; }); return true;`);
  await page.goto(B + '#/nutricao', 900); await redesenhar();
  ok((await modoNaTela()) === 'alimentos' && !(await page.eval(`return document.getElementById('diario').textContent;`)).includes('kcal'), 'idade 15 informada só ao Treinador: o diário não mostra calorias');
  await abrirAdicionar(); await buscar('arroz');
  ok(!(await page.eval(`return document.querySelector('.sheet').textContent;`)).includes('kcal'), 'nem a busca');
  await naFolha('Cancelar'); await comFolhas(0);
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.trainer.answers = {}; s.run.answers = { idade: 30, condicoes: ['gestante'] }; }); return true;`); await redesenhar();
  ok((await modoNaTela()) === 'soma' && !(await texto()).includes('comido / meta'), 'gestação marcada só na corrida: o diário soma, sem meta');
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.run.answers = {}; s.nutri.answers = ${JSON.stringify(RESPOSTAS)}; }); return true;`);
  await page.goto(B + '#/nutricao', 900); await redesenhar();
  ok((await modoNaTela()) === 'meta', 'de volta ao adulto com meta');

  console.log('11. Virada do dia com a tela aberta (23:59 → 00:01)');
  const amanha = diaMenos(-1);
  await relogio(hojeKey, '23:59'); await redesenhar();
  ok((await page.eval(`return document.getElementById('diario').dataset.dia;`)) === hojeKey && (await itensNaTela()).length > 0, 'às 23:59 a tela mostra o dia de hoje, com o que foi comido');
  const nHoje = (await hoje()).length;
  await relogio(amanha, '00:01');
  await page.eval(`const b = document.querySelector('#conteudo .refeicao[data-ref="almoco"] .add-alimento'); b.scrollIntoView({ block: 'center' }); b.click(); return true;`); await page.sleep(500);
  ok((await folhas()) === 0 && (await aviso()).includes('O dia mudou'), 'depois da meia-noite, "Adicionar alimento" não abre a folha do dia errado e avisa: ' + (await aviso()));
  ok((await page.eval(`return document.getElementById('diario').dataset.dia;`)) === amanha && (await itensNaTela()).length === 0 && (await noDiario('#diario-frase')).startsWith('Faltam'), 'a tela é redesenhada: "hoje" passa a ser o dia novo, vazio');
  ok((await hoje()).length === nHoje && (await doDia(amanha)).length === 0, 'nada foi gravado no dia errado');
  // folha aberta antes da virada: ao tocar em Adicionar depois da meia-noite, não grava
  await relogio(hojeKey, '23:59'); await redesenhar();
  await abrirAdicionar(); await buscar('arroz bra'); await escolher('arroz-branco-cozido'); await refeicao('ceia');
  await relogio(amanha, '00:01');
  await naFolha('Adicionar'); await page.sleep(500);
  ok((await folhas()) === 0 && (await aviso()).includes('O dia mudou') && (await hoje()).length === nHoje && (await doDia(amanha)).length === 0, 'com a folha aberta na virada, o toque em Adicionar não grava e avisa');
  // "Comi tudo isso" e "Comi" de um alimento depois da virada
  await relogio(hojeKey, '23:59'); await redesenhar();
  await relogio(amanha, '00:01');
  await tocarSug('jantar', 'Comi tudo isso');
  ok((await aviso()).includes('O dia mudou') && (await hoje()).length === nHoje && (await doDia(amanha)).length === 0, '"Comi tudo isso" depois da meia-noite também não grava no dia errado');
  await relogio(hojeKey, '23:59'); await redesenhar();
  await relogio(amanha, '00:01');
  await comiItem('jantar', sugerido['Jantar'][0][0]);
  ok((await aviso()).includes('O dia mudou') && (await hoje()).length === nHoje && (await doDia(amanha)).length === 0, '"Comi" de um alimento depois da meia-noite também não grava');
  ok((await botoesDe('jantar')) === 'Comi tudo isso' && (await botoesDe('cafe')) === 'Comi tudo isso' && (await resumoDe('cafe')) === 'ainda não', 'no dia novo, todas as refeições voltam a oferecer "Comi tudo isso" e dizem "ainda não"');
  await relogio(hojeKey, HORA); await redesenhar();
  ok((await page.eval(`return document.getElementById('diario').dataset.dia;`)) === hojeKey && (await itensNaTela()).length === nHoje, 'relógio de volta: a tela mostra de novo o dia de hoje');

  console.log('11b. Recolher e abrir cada refeição (toque no título)');
  // às 16:00, com o app aberto agora (sem escolha guardada): o café (comido inteiro) e o almoço (já passou) recolhidos;
  // o lanche da tarde (a refeição do horário) e o jantar abertos
  const limparEscolhas = () => page.eval(`try { localStorage.removeItem('fitcore-nutri-cards'); } catch {} return true;`);
  await relogio(hojeKey, '16:00'); await limparEscolhas();
  await page.reload(1500); await page.goto(B + '#/nutricao', 700);
  ok(!(await abertoDe('cafe')) && !(await abertoDe('almoco')) && (await abertoDe('lanche-tarde')) && (await abertoDe('jantar')), 'às 16:00: café e almoço recolhidos; lanche da tarde e jantar abertos');
  ok((await resumoDe('cafe')).startsWith('✓ comi ') && /kcal/.test(await resumoDe('cafe')) && (await resumoDe('lanche-tarde')).startsWith('comi '), 'recolhido, o título resume: café "' + (await resumoDe('cafe')) + '", lanche "' + (await resumoDe('lanche-tarde')) + '"');
  ok(await page.eval(`return [...document.querySelectorAll('.refeicao .ref-hd')].every((b) => b.tagName === 'BUTTON' && b.hasAttribute('aria-expanded') && document.getElementById(b.getAttribute('aria-controls')) && b.getBoundingClientRect().height >= 44);`), 'o título é um botão com aria-expanded, aria-controls e 44 px ou mais de altura');
  const tocarTitulo = (ref) => page.eval(`const b = document.querySelector('.refeicao[data-ref="${ref}"] .ref-hd'); b.scrollIntoView({ block: 'center' }); const y0 = b.getBoundingClientRect().top; b.click(); await new Promise((r) => setTimeout(r, 250)); return Math.abs(document.querySelector('.refeicao[data-ref="${ref}"] .ref-hd').getBoundingClientRect().top - y0) < 1;`);
  ok((await tocarTitulo('almoco')) && (await abertoDe('almoco')), 'tocar no título abre o almoço, e o título não sai do lugar');
  ok((await tocarTitulo('jantar')) && !(await abertoDe('jantar')), 'tocar no título recolhe o jantar, e o título não sai do lugar');
  await page.reload(1500); await page.goto(B + '#/nutricao', 700);
  ok((await abertoDe('almoco')) && !(await abertoDe('jantar')) && !(await abertoDe('cafe')), 'a escolha da pessoa fica lembrada no dia (depois de recarregar)');
  // mexer num card recolhido pelo padrão não o recolhe de novo debaixo do dedo
  await tocarTitulo('cafe');
  await tocarEm('cafe', 'Desmarcar tudo');
  ok((await abertoDe('cafe')) && (await resumoDe('cafe')) === 'ainda não', '"Desmarcar tudo" num card aberto: ele continua aberto e diz "ainda não"');
  await tocarEm('cafe', 'Comi tudo isso');
  ok((await abertoDe('cafe')) && (await resumoDe('cafe')).startsWith('✓ comi '), '"Comi tudo isso": o card continua aberto (não se recolhe sozinho debaixo do dedo)');
  await ver('.refeicao[data-ref="cafe"]'); await foto('11b-recolher');
  await limparEscolhas(); await relogio(hojeKey, HORA); await page.reload(1500); await page.goto(B + '#/nutricao', 700);

  console.log('12. Tela estreita (360 px), tema claro e escuro');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  for (const tema of ['claro', 'escuro']) {
    await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.settings.tema = '${tema}'; }); return true;`);
    await page.goto(B + '#/nutricao', 900); await page.reload(1500); await page.goto(B + '#/nutricao', 700);
    ok((await page.eval(`return document.documentElement.dataset.theme === 'light';`)) === (tema === 'claro'), `tema ${tema} aplicado`);
    ok(await page.eval(`return document.documentElement.scrollWidth <= 361;`), `a tela cabe em 360 px sem rolagem lateral (${tema})`);
    ok(await page.eval(`const r = [...document.querySelectorAll('#conteudo *')].filter((e) => e.getClientRects().length && !e.closest('svg')).map((e) => e.getBoundingClientRect()); return r.every((x) => x.right <= 360.5 && x.left >= -0.5);`), `nenhum elemento passa da largura da tela (${tema})`);
    await ver('#diario'); await foto(`8-360-${tema}-diario`);
    await page.eval(`window.scrollBy(0, 520); return true;`); await page.sleep(150); await foto(`9-360-${tema}-lista`);
    await ver('.diario-acoes-sug[data-ref="almoco"]'); await foto(`10-360-${tema}-cardapio`);
    ok(await page.eval(`return [...document.querySelectorAll('.diario-acoes-sug .btn, .sug-marca, .refeicao .ref-hd, .refeicao .add-alimento, .refeicao .trocar')].filter((b) => b.getClientRects().length).every((b) => { const r = b.getBoundingClientRect(); return r.right <= 360.5 && r.height >= 38; });`), `os botões do cardápio (e o "Comi" de cada alimento) cabem e têm altura de toque (${tema})`);
    await abrirAdicionar(); await buscar('fran'); await page.sleep(150);
    ok(await page.eval(`const s = document.querySelector('.sheet'); const r = s.getBoundingClientRect(); return r.right <= 360.5 && document.documentElement.scrollWidth <= 361 && [...s.querySelectorAll('*')].filter((e) => e.getClientRects().length).every((e) => e.getBoundingClientRect().right <= 360.5);`), `a folha de busca cabe em 360 px (${tema})`);
    await foto(`11-360-${tema}-busca`);
    await escolher('frango-assado-sem-pele');
    ok(await page.eval(`const s = document.querySelector('.sheet'); return !!document.getElementById('diario-conta') && [...s.querySelectorAll('*')].filter((e) => e.getClientRects().length).every((e) => e.getBoundingClientRect().right <= 360.5);`), `a folha de quantidade cabe em 360 px (${tema})`);
    await foto(`12-360-${tema}-quantidade`);
    await page.eval(`document.querySelector('.sheet .iconbtn[aria-label="Fechar"]').click(); return true;`); await comFolhas(0);
  }

  console.log('13. Adicionar vários de uma vez, a separação "Da sugestão" / "Fora da sugestão" (360 px)');
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.diario = { dias: [] }; s.settings.tema = 'claro'; }); try { localStorage.removeItem('fitcore-nutri-cards'); } catch {} return true;`);
  await page.goto(B + '#/nutricao', 900); await page.reload(1500); await page.goto(B + '#/nutricao', 700); await redesenhar();
  const rodape = () => page.eval(`const f = [...document.querySelectorAll('.sheet')].pop(); return [...f.querySelectorAll('.sheet-ft .btn')].map((b) => b.textContent.trim()).join('|');`);
  const naFila = () => page.eval(`return [...document.querySelectorAll('.sheet #diario-fila .fila-item')].map((e) => e.dataset.al);`);
  const tocarNaFolha = async (sel) => { const r = await page.eval(`const b = document.querySelector('.sheet ' + ${JSON.stringify(sel)}); if (!b) return false; b.click(); return true;`); await page.sleep(250); return r; };
  ok(await tocarEm('almoco', 'Adicionar outro alimento'), 'abre "+ Adicionar outro alimento" do almoço');
  await comFolhas(1);
  ok((await rodape()) === 'Cancelar|Adicionar', 'sem nada escolhido: Cancelar e Adicionar');
  ok((await buscar('x-salada')).includes('hamburguer-sanduiche') && (await escolher('hamburguer-sanduiche')), 'a busca acha "x-salada" (hambúrguer, sanduíche)');
  ok((await rodape()) === 'Acrescentar|Adicionar', 'com um alimento escolhido: "Acrescentar" e "Adicionar" (adicionar só um continua com um toque)');
  await naFolha('Acrescentar'); await page.sleep(250);
  ok((await naFila()).join() === 'hamburguer-sanduiche' && !!(await page.eval(`return document.querySelector('.sheet input[aria-label="Buscar alimento"]');`)), 'acrescentou: vai para "Para adicionar" e a busca volta');
  ok((await buscar('batata frita')).includes('batata-inglesa-frita') && (await escolher('batata-inglesa-frita')), 'busca e escolhe a batata frita');
  await page.eval(`[...document.querySelectorAll('.sheet .seg button')].find((b) => b.textContent.trim() === 'Gramas').click(); return true;`); await page.sleep(250);
  await page.eval(`const i = document.querySelector('.sheet .stepper input'); i.value = '100'; i.dispatchEvent(new Event('change', { bubbles: true })); return true;`); await page.sleep(150);
  ok((await rodape()) === 'Acrescentar|Adicionar todos (2)', 'o rodapé conta o que está escolhido: ' + (await rodape()));
  await naFolha('Acrescentar'); await page.sleep(250);
  const kHamb = await kcalExata('hamburguer-sanduiche', 125), kBat = await kcalExata('batata-inglesa-frita', 100), kCerv = await kcalExata('cerveja', 350);
  ok((await page.eval(`return document.getElementById('diario-fila-total').textContent;`)) === `Total ${mil(kHamb + kBat)} kcal`, `"Para adicionar" com o total: ${mil(kHamb + kBat)} kcal (334 + 267)`);
  ok((await buscar('cerveja')).includes('cerveja') && (await escolher('cerveja')) && (await rodape()) === 'Acrescentar|Adicionar todos (3)', 'escolhe o terceiro: "Adicionar todos (3)"');
  await foto('13-varios');
  ok(await tocarNaFolha('#diario-fila .fila-item[data-al="batata-inglesa-frita"] .iconbtn'), 'tira a batata da lista (×)');
  ok((await naFila()).join() === 'hamburguer-sanduiche' && (await rodape()) === 'Acrescentar|Adicionar todos (2)', 'a lista e o rodapé se atualizam');
  ok(await tocarNaFolha('#diario-fila .fila-item[data-al="hamburguer-sanduiche"] .fila-mudar'), 'toca no hambúrguer para mudar');
  ok((await naFila()).join() === 'cerveja' && (await conta()).startsWith('125 g (1 unidade média)'), 'o hambúrguer volta para a quantidade, com a medida que tinha; a cerveja escolhida foi para a lista');
  await passo(2);
  ok((await conta()).startsWith('250 g (2 unidades médias)'), 'agora 2 unidades: ' + (await conta()));
  await naFolha('Acrescentar'); await page.sleep(250);
  ok((await rodape()) === 'Cancelar|Adicionar todos (2)', 'de volta à busca, com a cerveja e o hambúrguer: ' + (await rodape()));
  ok((await naFila()).sort().join() === 'cerveja,hamburguer-sanduiche', 'a lista tem os dois');
  const antesVarios = await totalDeHoje();
  await naFolha('Adicionar todos (2)'); await comFolhas(0);
  itens = await hoje();
  ok(itens.length === 2 && itens.every((x) => x.ref === 'almoco') && itens.find((x) => x.al === 'hamburguer-sanduiche').g === 250 && itens.find((x) => x.al === 'cerveja').g === 350, '"Adicionar todos" gravou os dois no almoço, com as quantidades certas');
  ok(Math.abs((await totalDeHoje()) - antesVarios - (2 * kHamb + kCerv)) < 0.01, `as calorias somam certo: +${mil(2 * kHamb + kCerv)} kcal (2 × 334 + 144)`);
  ok((await aviso()).includes('2 alimentos adicionados em Almoço'), 'avisa: ' + (await aviso()));
  // um só continua simples: escolher e "Adicionar"
  await tocarEm('almoco', 'Adicionar outro alimento'); await comFolhas(1);
  await buscar('coxinha'); await escolher('coxinha-de-frango'); await naFolha('Adicionar'); await comFolhas(0);
  ok((await hoje()).length === 3, 'adicionar um só: buscar, escolher, "Adicionar"');
  // a separação visual dentro do card
  const sug = await page.eval(`const d = await import('/js/logic/diario.js'); const n = await import('/js/logic/nutrition.js'); const st = (await import('/js/store.js')).state; const c = n.cardapioDoDia(n.calcular(st.nutri.answers), '${hojeKey}'); return c.refeicoes.find((r) => r.nome === 'Almoço').itens[0].id;`);
  await comiItem('almoco', sug);
  await ver('.refeicao[data-ref="almoco"] .comido');
  const vis = await page.eval(`const c = document.querySelector('.refeicao[data-ref="almoco"]'); const cs = (e) => getComputedStyle(e); const comido = c.querySelector('.comido');
    const secs = [...comido.querySelectorAll('.comido-sec')].map((e) => [e.classList.contains('da-sug') ? 'da' : 'fora', e.querySelector('.comido-sub').textContent, e.querySelectorAll('.diario-item').length]);
    return { fundo: cs(comido).backgroundColor !== cs(c).backgroundColor, peso: Number(cs(comido.querySelector('.comido-tit')).fontWeight), sugPeso: Number(cs(c.querySelector('.sug-rot')).fontWeight), tamSug: parseFloat(cs(c.querySelector('.sug-rot')).fontSize), tamTit: parseFloat(cs(comido.querySelector('.comido-tit')).fontSize),
      linha: parseFloat(cs(comido.querySelector('.comido-sec.fora-sug')).borderTopWidth), ordem: c.querySelector('.sug-box').getBoundingClientRect().top > comido.getBoundingClientRect().top, secs, kcal: comido.querySelector('.comido-kcal') ? comido.querySelector('.comido-kcal').textContent : '' };`);
  ok(vis.fundo && vis.peso >= 700 && vis.tamTit > vis.tamSug && vis.ordem, '"Já comi" tem fundo próprio e título maior e em negrito, acima da sugestão (mais leve)');
  ok(vis.secs.length === 2 && vis.secs[0][0] === 'da' && vis.secs[0][1].startsWith('Da sugestão') && vis.secs[0][2] === 1 && vis.secs[1][0] === 'fora' && vis.secs[1][1].startsWith('Fora da sugestão') && vis.secs[1][2] === 3 && vis.linha >= 1, 'dentro dele: "Da sugestão" (1) e "Fora da sugestão" (3), com linha entre os dois: ' + JSON.stringify(vis.secs));
  await foto('13-separacao');

  console.log('14. Suplementos e vitaminas do dia');
  await page.eval(`window.scrollTo(0, 0); return true;`);
  // 1.14.0: suplementos e vitaminas, Semana e compras e Tenho em casa ficam abaixo das refeições
  ok(await page.eval(`const b = document.querySelector('#card-suplementos .sup-dia'); if (!b) return false; return b.textContent.includes('nenhum hoje');`), 'a linha "Suplementos e vitaminas · nenhum hoje" fica no card próprio');
  ok(await page.eval(`const refs = [...document.querySelectorAll('.refeicao')]; const ult = refs[refs.length - 1]; const sup = document.getElementById('card-suplementos'); const fer = document.getElementById('ferramentas-cardapio'); const div = document.getElementById('divisor-consulta'); const depois = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); return depois(ult, sup) && depois(sup, fer) && depois(fer, div) && !document.querySelector('#hoje-nutri .sup-dia');`), 'ordem: refeições → suplementos e vitaminas → Semana e compras / Tenho em casa → "Para consultar"');
  await page.eval(`document.querySelector('#hoje-nutri .sup-dia').click(); return true;`); await comFolhas(1);
  ok((await texto()).includes('Nada marcado hoje.') && (await rodape()) === 'Fechar', 'a folha abre com a lista vazia e os tipos para marcar');
  await tocarNaFolha('#sup-tipos [data-tipo="creatina"]');
  ok((await page.eval(`return document.querySelector('.sheet input[aria-label="Quantidade"]').value;`)) === '' && (await rodape()) === 'Voltar|Salvar', 'creatina: a quantidade vem vazia (o app não sugere dose)');
  await campo('Quantidade', 'cinco'); await naFolha('Salvar'); await page.sleep(200);
  ok((await aviso()).includes('Digite a quantidade em número') && (await estado(`(s.diario.dias.find((d) => d.data === '${hojeKey}') || {}).sup`)) == null, 'quantidade em texto é recusada, com aviso');
  await campo('Quantidade', '5'); await naFolha('Salvar'); await page.sleep(250);
  ok((await page.eval(`return [...document.querySelectorAll('.sheet .sup-item')].map((e) => e.textContent).join('|');`)) === 'Creatina5 g', 'creatina 5 g marcada');
  const p0 = await page.eval(`const d = await import('/js/logic/diario.js'); const s = (await import('/js/store.js')).state; return d.totaisDoDia(s.diario, '${hojeKey}').p;`);
  const k0w = await totalDeHoje();
  await tocarNaFolha('#sup-tipos [data-tipo="whey"]');
  ok((await page.eval(`return document.querySelector('.sheet input[aria-label="Quantidade"]').value;`)) === '1' && !!(await page.eval(`return document.querySelector('.sheet input[aria-label="Proteína por dose"]');`)), 'whey: pede a proteína por dose do rótulo');
  await campo('Quantidade', '1,5'); await campo('Proteína por dose', '24'); await campo('Calorias por dose', '120');
  await foto('14-whey');
  await naFolha('Salvar'); await page.sleep(250);
  const p1 = await page.eval(`const d = await import('/js/logic/diario.js'); const s = (await import('/js/store.js')).state; return d.totaisDoDia(s.diario, '${hojeKey}').p;`);
  ok(Math.abs(p1 - p0 - 36) < 1e-9 && Math.abs((await totalDeHoje()) - k0w - 180) < 1e-9, 'a proteína do whey entra no dia: 1,5 × 24 = 36 g e 1,5 × 120 = 180 kcal');
  ok((await page.eval(`return document.querySelector('.sheet #sup-tipos [data-tipo="whey"]').getAttribute('aria-pressed');`)) === 'true', 'o tipo já marcado aparece ligado (tocar abre o registro dele)');
  await foto('14-sup');
  await page.eval(`document.querySelector('.sheet .iconbtn[aria-label="Fechar"]').click(); return true;`); await comFolhas(0);
  ok(await page.eval(`return document.querySelector('#hoje-nutri .sup-dia .sup-dia-r').textContent === 'Creatina, Whey';`), 'a linha do card mostra "Creatina, Whey"');
  await page.reload(1500); await page.goto(B + '#/nutricao', 700);
  ok((await estado(`(s.diario.dias.find((d) => d.data === '${hojeKey}') || {}).sup.length`)) === 2, 'recarregar: os suplementos continuam');
  // dias anteriores também têm a linha; tirar pelo ×
  ok(await page.eval(`return !!document.querySelector('#diario-passado .sup-dia[data-dia="${diaMenos(1)}"]');`), '"Dias anteriores" mostra os suplementos daquele dia');
  await page.eval(`document.querySelector('#hoje-nutri .sup-dia').click(); return true;`); await comFolhas(1);
  await tocarNaFolha('.sup-item[data-tipo="creatina"] .iconbtn');
  ok((await estado(`s.diario.dias.find((d) => d.data === '${hojeKey}').sup.map((x) => x.tipo).join()`)) === 'whey', 'tirar a creatina (×)');
  await page.eval(`document.querySelector('.sheet .iconbtn[aria-label="Fechar"]').click(); return true;`); await comFolhas(0);
  // menor de 18 anos (em qualquer entrevista): aviso curto da cafeína e o whey sem números
  const idadeSono = await estado(`s.sono.idade`);
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.sono.idade = 16; }); return true;`); await redesenhar();
  ok(!!(await page.eval(`return document.querySelector('.sup-dia');`)), 'menor de 18: a linha continua (registro sem números)');
  await page.eval(`document.querySelector('.sup-dia').click(); return true;`); await comFolhas(1);
  ok(!(await page.eval(`return document.querySelector('.sheet').textContent;`)).includes('g de proteína'), 'menor: a lista não mostra a proteína do whey');
  await tocarNaFolha('#sup-tipos [data-tipo="cafeina"]');
  ok((await page.eval(`return document.querySelector('.sheet .note').textContent;`)).includes('A Anvisa não permite suplemento de cafeína para menores de 18 anos'), 'menor: aviso curto ao marcar cafeína');
  await naFolha('Voltar'); await page.sleep(200);
  await tocarNaFolha('#sup-tipos [data-tipo="whey"]');
  ok(!(await page.eval(`return document.querySelector('.sheet input[aria-label="Proteína por dose"]');`)) && (await page.eval(`return document.querySelector('.sheet .note').textContent;`)).includes('orientação do médico'), 'menor: o whey não pede números e tem o aviso');
  await page.eval(`document.querySelector('.sheet .iconbtn[aria-label="Fechar"]').click(); return true;`); await comFolhas(0);
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.sono.idade = ${JSON.stringify(idadeSono)}; const c = s.nutri.answers.condicoes; s.nutri.answers.condicoes = ['transtorno']; s.__c = c; }); return true;`); await redesenhar();
  ok(!(await page.eval(`return document.querySelector('.sup-dia');`)), 'transtorno alimentar: sem a linha de suplementos (o diário não é oferecido)');
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.nutri.answers.condicoes = ['nenhuma']; delete s.__c; }); return true;`); await redesenhar();
  const csv = await page.eval(`const e = await import('/js/logic/exportar.js'); const s = (await import('/js/store.js')).state; return e.planilha(s, 'diario', '${hojeKey}').texto;`);
  ok(csv.includes('"Suplemento ou vitamina";"Whey (proteína em pó)";"";"1,5 doses";"180";"36"'), 'a exportação do diário traz o suplemento, com a dose e os números do rótulo');

  const erros = page.erros.filter((e) => !/favicon|SWv:/.test(e));
  ok(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' || ').slice(0, 500) : ''));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

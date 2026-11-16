// Teste de ponta a ponta do diário alimentar, clicando como um usuário: registrar sem entrevista (só o total),
// "Comi isso" e "Comi outra coisa" no cardápio de exemplo, adicionar pela busca (sem acento nem pontuação, medida
// caseira e gramas), alimento fora da lista (calorias só em número inteiro), corrigir, apagar (com confirmação),
// faltam / passou da meta, dias anteriores, semana, recarregar e ver que persistiu, quem não recebe contagem
// (transtorno alimentar; menores, em qualquer entrevista), a virada do dia com a tela aberta e a tela em 360 px
// (claro e escuro).
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
  const noDiario = (sel) => page.eval(`const e = document.querySelector('#diario ' + ${JSON.stringify(sel)}); return e ? e.textContent : '';`);
  const modoNaTela = () => page.eval(`const e = document.getElementById('diario'); return e ? e.dataset.modo || '' : '';`);
  const itensNaTela = () => page.eval(`return [...document.querySelectorAll('#diario .diario-item')].map((e) => e.textContent);`);
  const doDia = (data) => estado(`(s.diario.dias.find((d) => d.data === '${data}') || { itens: [] }).itens`);
  const hoje = () => doDia(hojeKey);
  const abrirAdicionar = async () => { await page.eval(`const b = [...document.querySelectorAll('#diario .btn')].find((e) => e.textContent.trim() === 'Adicionar alimento'); b.scrollIntoView({ block: 'center' }); b.click(); return true;`); return comFolhas(1); };
  // a refeição é sempre escolhida no roteiro (nada depende da refeição que a hora do relógio sugere)
  const refeicao = (ref) => page.eval(`const s = document.querySelector('.sheet select[aria-label="Refeição"]'); s.value = '${ref}'; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value;`);
  const buscar = async (t) => { await page.eval(`const i = document.querySelector('.sheet input[aria-label="Buscar alimento"]'); i.value = ${JSON.stringify(t)}; i.dispatchEvent(new Event('input', { bubbles: true })); return true;`); await page.sleep(200); return page.eval(`return [...document.querySelectorAll('.sheet .diario-achado')].map((e) => e.dataset.al);`); };
  const escolher = async (al) => { const achou = await page.eval(`const b = document.querySelector('.sheet .diario-achado[data-al="${al}"]'); if (!b) return false; b.click(); return true;`); await page.sleep(250); return achou; };
  const passo = (delta) => page.eval(`const b = document.querySelector('.sheet .stepper button[aria-label^="${delta < 0 ? 'Diminuir' : 'Aumentar'}"]'); for (let i = 0; i < ${Math.abs(delta)}; i++) b.click(); return document.querySelector('.sheet .stepper input').value;`);
  const conta = () => page.eval(`const e = document.getElementById('diario-conta'); return e ? e.textContent : '';`);
  const campo = (rotulo, v) => page.eval(`const i = document.querySelector('.sheet input[aria-label="${rotulo}"]'); if (!i) return false; i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  const tocarItem = async (trecho) => { const achou = await page.eval(`const b = [...document.querySelectorAll('#diario .diario-item')].find((e) => e.textContent.includes(${JSON.stringify(trecho)})); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;`); return achou && (await comFolhas(1)); };
  const botoesDe = (ref) => page.eval(`const a = document.querySelector('.diario-acoes[data-ref="${ref}"]'); return a ? [...a.querySelectorAll('.btn')].map((b) => b.textContent.trim()).join('|') : '';`);
  const tocarEm = async (ref, rotulo) => { const achou = await page.eval(`const b = [...document.querySelectorAll('.diario-acoes[data-ref="${ref}"] .btn')].find((e) => e.textContent.trim() === ${JSON.stringify(rotulo)}); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;`); await page.sleep(450); return achou; };
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
  ok((await modoNaTela()) === 'soma' && !t.includes('Faltam') && !t.includes('comido / meta'), 'sem meta, não há "faltam" nem "comido / meta"');
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
  ok((await modoNaTela()) === 'meta' && t.includes('kcal: comido / meta') && (await noDiario('.stat b')) === `${mil(kPao75)} / ${mil(meta.kcal)}`, `com meta: ${mil(kPao75)} / ${mil(meta.kcal)} kcal`);
  ok((await noDiario('#diario-frase')) === `Faltam ${mil(Math.round((meta.kcal - (await totalDeHoje())) / 10) * 10)} kcal para a meta do dia.` && (await noDiario('#diario-proteina')).startsWith('Proteína: faltam '), 'frase clara: ' + (await noDiario('#diario-frase')));
  ok(await page.eval(`const pos = (sel) => document.querySelector(sel).getBoundingClientRect().top; return pos('#diario') < pos('details.refeicao');`), 'o bloco fica no topo, depois das metas e antes do cardápio');
  await ver('#diario'); await foto('2-com-meta');

  console.log('3. "Comi isso": um toque copia a refeição do cardápio');
  const sugerido = await page.eval(`const n = await import('/js/logic/nutrition.js'); const c = n.cardapio(n.calcular(${JSON.stringify(RESPOSTAS)}), 0); return Object.fromEntries(c.refeicoes.map((r) => [r.nome, r.itens.map((x) => [x.id, x.g])]));`);
  const cafe = sugerido['Café da manhã'], almoco = sugerido['Almoço'];
  ok((await botoesDe('cafe')) === 'Comi isso|Comi outra coisa' && (await botoesDe('almoco')) === 'Comi isso|Comi outra coisa', 'cada refeição do cardápio tem "Comi isso" e "Comi outra coisa"');
  await ver('.diario-acoes[data-ref="cafe"]'); await foto('3-cardapio');
  await tocarEm('cafe', 'Comi isso');
  itens = await hoje();
  const doCafe = itens.filter((x) => x.ref === 'cafe');
  ok(doCafe.length === cafe.length && doCafe.every((x, i) => x.al === cafe[i][0] && x.g === cafe[i][1]), `os ${cafe.length} alimentos do café da manhã sugerido foram para o diário`);
  ok((await aviso()).includes('Café da manhã registrado no diário de hoje'), 'avisa que registrou: ' + (await aviso()));
  ok((await botoesDe('cafe')) === 'Adicionar mais' && (await page.eval(`return document.querySelector('.diario-acoes[data-ref="cafe"]').textContent;`)).includes('registrado no diário de hoje'), 'a refeição copiada mostra "registrado" e não oferece "Comi isso" de novo');
  ok((await noDiario('h3')) === 'Café da manhã', 'o diário lista os alimentos por refeição');

  console.log('4. "Comi outra coisa" e um alimento avulso no horário do almoço');
  await tocarEm('almoco', 'Comi outra coisa');
  ok((await comFolhas(1)) && (await page.eval(`return document.querySelector('.sheet select[aria-label="Refeição"]').value;`)) === 'almoco', 'a folha abre com "Almoço" marcado');
  ok((await buscar('feij')).includes('feijao-carioca-cozido') && (await escolher('feijao-carioca-cozido')), 'busca "feij" e escolhe o feijão-carioca');
  await page.eval(`[...document.querySelectorAll('.sheet .seg button')].find((b) => b.textContent.trim() === 'Gramas').click(); return true;`); await page.sleep(250);
  await page.eval(`const i = document.querySelector('.sheet .stepper input'); i.value = '200'; i.dispatchEvent(new Event('change', { bubbles: true })); return true;`); await page.sleep(150);
  ok((await conta()).startsWith('200 g (2 conchas') && (await passo(1)) === '210' && (await passo(-1)) === '200', 'em gramas: digita 200, o passo é de 10 g: ' + (await conta()));
  await naFolha('Adicionar'); await comFolhas(0);
  itens = await hoje();
  const feijao = itens.find((x) => x.al === 'feijao-carioca-cozido' && x.ref === 'almoco');
  ok(!!feijao && feijao.g === 200 && feijao.m === false, 'feijão gravado no almoço, 200 g');
  ok((await botoesDe('almoco')) === 'Comi isso|Comi outra coisa', 'um alimento avulso no almoço NÃO tira o "Comi isso" do almoço');
  const antesDoAlmoco = (await hoje()).length;
  const novos = almoco.filter(([id]) => id !== 'feijao-carioca-cozido').length;
  await tocarEm('almoco', 'Comi isso');
  itens = await hoje();
  ok(itens.length === antesDoAlmoco + novos && almoco.every(([id]) => itens.filter((x) => x.ref === 'almoco' && x.al === id).length === 1), `"Comi isso" completa o almoço com ${novos} alimentos, sem repetir o que já estava lá`);
  ok((await botoesDe('almoco')) === 'Adicionar mais', 'depois de copiado, o almoço mostra "registrado"');

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
  ok(await page.eval(`const e = [...document.querySelectorAll('#diario .diario-item')].find((x) => x.textContent.includes('Bolo de cenoura')); return !!e && e.textContent.includes('<b>da vó</b>') && !e.querySelector('b') && e.textContent.includes('1.200 kcal') && e.textContent.includes('fora da lista');`), 'o nome digitado aparece como texto (não vira HTML), com as calorias');
  ok((await noDiario('#diario-macros')).includes('sem contar 1 alimento fora da lista'), 'a tela avisa que carboidrato, gordura e fibras não contam o alimento fora da lista');

  console.log('6. Corrigir e apagar (apagar pede confirmação)');
  const antes = (await hoje()).length;
  // o primeiro alimento do dia (i1) é o pão francês registrado no passo 1
  ok((await page.eval(`const b = document.querySelector('#diario .diario-item[data-id="i1"]'); if (!b || !b.textContent.includes('Pão francês')) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;`)) && (await comFolhas(1)), 'tocar no alimento abre "Corrigir alimento"');
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
  ok((await botoesDe('jantar')) === 'Comi isso|Comi outra coisa', 'o alimento avulso no jantar não tira o "Comi isso" do jantar');
  let ini = await resumoInicio();
  ok(ini.modo === 'meta' && ini.metaKcal === meta.kcal && ini.frase === 'Você passou 250 kcal da meta do dia.', 'resumoDeHoje() (Início): consumido / meta e a mesma frase');
  await ver('#diario'); await foto('6-passou');

  console.log('8. Dias anteriores');
  await page.click('Dia anterior'); await page.sleep(400);
  const ontem = diaMenos(1);
  ok((await texto()).includes(`O que comi em ${diaMes(ontem)}`) && (await noDiario('#diario-dia')) === `Ontem, ${diaMes(ontem)}` && (await texto()).includes('Nada registrado neste dia.'), 'o dia anterior abre vazio: ' + (await noDiario('#diario-dia')));
  await abrirAdicionar();
  ok((await texto()).includes('Adicionar alimento · ontem'), 'a folha diz de que dia é');
  ok((await buscar('banana pra')).includes('banana-prata') && (await escolher('banana-prata')), 'a busca ignora o hífen: "banana pra" acha a banana-prata');
  await refeicao('ceia'); await naFolha('Adicionar'); await comFolhas(0);
  const deOntem = await doDia(ontem);
  ok(deOntem.length === 1 && deOntem[0].al === 'banana-prata' && deOntem[0].ref === 'ceia' && (await estado('s.diario.dias.map((d) => d.data).join()')) === `${ontem},${hojeKey}`, 'gravado em ontem; os dias ficam em ordem de data');
  ok((await itensNaTela()).length === 1, 'a tela de ontem mostra só o alimento de ontem');
  ok((await page.eval(`return document.querySelector('#diario .iconbtn[aria-label="Dia anterior"]').disabled;`)) === false, 'ainda dá para voltar mais (o limite é o primeiro dia que o diário guarda)');
  await page.click('Dia seguinte'); await page.sleep(400);
  ok((await texto()).includes('O que comi hoje') && (await page.eval(`return document.querySelector('#diario .iconbtn[aria-label="Dia seguinte"]').disabled;`)) === true, 'volta para hoje; não dá para ir ao futuro');
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
  ok(t.includes('não oferece o diário de alimentação') && !(await page.eval(`return [...document.querySelectorAll('.btn')].some((b) => b.textContent.trim() === 'Adicionar alimento');`)) && !t.includes('Você passou') && !t.includes('comido / meta'), 'com histórico de transtorno alimentar, o diário não é oferecido e nenhum número aparece');
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
  ok((await page.eval(`return document.getElementById('diario').dataset.dia;`)) === hojeKey && (await texto()).includes('O que comi hoje'), 'às 23:59 a tela mostra o dia de hoje');
  const nHoje = (await hoje()).length;
  await relogio(amanha, '00:01');
  await page.eval(`const b = [...document.querySelectorAll('#diario .btn')].find((e) => e.textContent.trim() === 'Adicionar alimento'); b.scrollIntoView({ block: 'center' }); b.click(); return true;`); await page.sleep(500);
  ok((await folhas()) === 0 && (await aviso()).includes('O dia mudou'), 'depois da meia-noite, "Adicionar alimento" não abre a folha do dia errado e avisa: ' + (await aviso()));
  ok((await page.eval(`return document.getElementById('diario').dataset.dia;`)) === amanha && (await texto()).includes('Nada registrado hoje'), 'a tela é redesenhada: "hoje" passa a ser o dia novo, vazio');
  ok((await hoje()).length === nHoje && (await doDia(amanha)).length === 0, 'nada foi gravado no dia errado');
  // folha aberta antes da virada: ao tocar em Adicionar depois da meia-noite, não grava
  await relogio(hojeKey, '23:59'); await redesenhar();
  await abrirAdicionar(); await buscar('arroz bra'); await escolher('arroz-branco-cozido'); await refeicao('ceia');
  await relogio(amanha, '00:01');
  await naFolha('Adicionar'); await page.sleep(500);
  ok((await folhas()) === 0 && (await aviso()).includes('O dia mudou') && (await hoje()).length === nHoje && (await doDia(amanha)).length === 0, 'com a folha aberta na virada, o toque em Adicionar não grava e avisa');
  // "Comi isso" depois da virada
  await relogio(hojeKey, '23:59'); await redesenhar();
  await relogio(amanha, '00:01');
  await tocarEm('jantar', 'Comi isso');
  ok((await aviso()).includes('O dia mudou') && (await hoje()).length === nHoje && (await doDia(amanha)).length === 0, '"Comi isso" depois da meia-noite também não grava no dia errado');
  ok((await botoesDe('jantar')) === 'Comi isso|Comi outra coisa' && (await botoesDe('cafe')) === 'Comi isso|Comi outra coisa', 'no dia novo, todas as refeições voltam a oferecer "Comi isso"');
  await relogio(hojeKey, HORA); await redesenhar();
  ok((await page.eval(`return document.getElementById('diario').dataset.dia;`)) === hojeKey && (await itensNaTela()).length === nHoje, 'relógio de volta: a tela mostra de novo o dia de hoje');

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
    await ver('.diario-acoes[data-ref="almoco"]'); await foto(`10-360-${tema}-cardapio`);
    ok(await page.eval(`return [...document.querySelectorAll('.diario-acoes .btn')].every((b) => { const r = b.getBoundingClientRect(); return r.right <= 360.5 && r.height >= 38; });`), `os botões do cardápio cabem e têm altura de toque (${tema})`);
    await abrirAdicionar(); await buscar('fran'); await page.sleep(150);
    ok(await page.eval(`const s = document.querySelector('.sheet'); const r = s.getBoundingClientRect(); return r.right <= 360.5 && document.documentElement.scrollWidth <= 361 && [...s.querySelectorAll('*')].filter((e) => e.getClientRects().length).every((e) => e.getBoundingClientRect().right <= 360.5);`), `a folha de busca cabe em 360 px (${tema})`);
    await foto(`11-360-${tema}-busca`);
    await escolher('frango-assado-sem-pele');
    ok(await page.eval(`const s = document.querySelector('.sheet'); return !!document.getElementById('diario-conta') && [...s.querySelectorAll('*')].filter((e) => e.getClientRects().length).every((e) => e.getBoundingClientRect().right <= 360.5);`), `a folha de quantidade cabe em 360 px (${tema})`);
    await foto(`12-360-${tema}-quantidade`);
    await naFolha('Cancelar'); await comFolhas(0);
  }

  const erros = page.erros.filter((e) => !/favicon|SWv:/.test(e));
  ok(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' || ').slice(0, 500) : ''));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

// Teste de ponta a ponta dos extras de Ajustes: Privacidade e Termos de uso (folhas discretas), exportar o histórico
// (planilha CSV e resumo para imprimir ou salvar em PDF) e letra maior / alto contraste em todas as telas principais,
// a 360 px de largura, sem rolagem lateral.
// Nada é baixado de verdade: o roteiro guarda o arquivo gerado (Blob) e anula o clique do link de download, para não
// gravar arquivo fora da pasta do projeto. window.print também é trocado por um contador.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/ajustes-extras.mjs
import { B, semear } from './exemplo.mjs';

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  await page.send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => {});
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__blobs = []; window.__impressoes = 0;
    const criar = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { window.__blobs.push(b); return criar(b); };
    const clicar = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download')) { window.__baixado = this.getAttribute('download'); return; } return clicar.call(this); };
    window.print = () => { window.__impressoes++; };
    // "sem piscar": guarda a letra e o contraste da raiz no instante em que a primeira tela do app aparece
    new MutationObserver((l, obs) => { if (document.querySelector('main#conteudo')) { const r = document.documentElement.dataset; window.__primeiraTela = (r.letra || 'normal') + '|' + (r.contraste || '') + '|' + (r.theme || ''); obs.disconnect(); } }).observe(document, { childList: true, subtree: true });
  })();` });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 760, deviceScaleFactor: 1, mobile: true });
  const s = await semear(page, { semanas: 4 });
  ok(s.treinos > 5, 'usuário de exemplo com histórico: ' + JSON.stringify(s));
  // corridas, sono, diário, dores e um nome de treino com fórmula (para conferir a proteção do CSV)
  await page.eval(`const st = await import('/js/store.js'); const ui = await import('/js/ui.js');
    const dia = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ui.dateKey(d); };
    st.update((x) => {
      x.runs = [{ id: 'r1', data: dia(9), tipo: 'leve', distKm: 5, durMin: 31, pse: 4, dores: [], nota: '', planejado: '' }, { id: 'r2', data: dia(2), tipo: 'livre', distKm: 7.5, durMin: 45.5, pse: 5, dores: [{ onde: 'joelho', nivel: 2, tipo: 'articular' }], nota: '=1+1', planejado: '' }];
      x.sono.registros = [{ data: dia(2), horas: 7.5, qualidade: 4 }, { data: dia(1), horas: 6.25 }];
      x.diario.dias = [{ data: dia(1), itens: [{ id: 'i1', ref: 'almoco', al: 'arroz-branco-cozido', g: 150, m: false }] }];
      x.dores = [{ id: 'd1', data: dia(3), onde: 'ombro', lado: 'd', tipo: 'articular', quando: 'durante', nivel: 3, nota: '', fim: '' }];
      x.sessions[x.sessions.length - 1].nome = '=HYPERLINK("x")';
    });
    await new Promise((r) => setTimeout(r, 400)); return 1;`);

  console.log('1. Privacidade e Termos de uso: discretos no fim de Ajustes, cada um numa folha');
  await page.goto(B + '#/ajustes', 900);
  const links = await page.eval(`const l = document.querySelector('.legal-links'); const tudo = [...document.querySelectorAll('#conteudo > *')]; return { existe: !!l, ultimo: tudo[tudo.length - 1] === l, textos: l ? [...l.querySelectorAll('button')].map((b) => b.textContent.trim()) : [] };`);
  ok(links.existe && links.ultimo && links.textos.join('|') === 'Privacidade|Termos de uso', 'dois links no fim da tela: ' + JSON.stringify(links));
  await page.click('Privacidade', '.legal-links button');
  const priv = await page.eval(`const f = document.getElementById('folha-privacidade'); return f ? f.innerText : '';`);
  ok(/só neste aparelho/.test(priv) && /GitHub Pages/.test(priv) && /endereço IP/.test(priv) && /Lei 13\.709\/2018/.test(priv) && /art\. 5º, II/.test(priv) && /Apagar todos os meus dados/.test(priv), 'a folha de privacidade diz onde ficam os dados, o que o GitHub Pages registra, a LGPD e como apagar');
  await page.click('Fechar', '.sheet-ft button');
  ok(!(await page.eval(`return !!document.querySelector('.backdrop');`)), 'o botão Fechar fecha a folha');
  await page.click('Termos de uso', '.legal-links button');
  const termos = await page.eval(`const f = document.getElementById('folha-termos'); return f ? f.innerText : '';`);
  ok(/não substitui médico, profissional de educação física ou nutricionista/.test(termos) && /PAR-Q\+/.test(termos) && /dor ou pressão no peito/.test(termos) && /Menores de 18 anos/.test(termos) && /Por sua conta/.test(termos), 'a folha de termos tem o aviso de saúde, a triagem, os sinais para parar, menores de idade e uso por conta própria');
  await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return 1;`); await page.sleep(200);
  ok(!(await page.eval(`return !!document.querySelector('.backdrop');`)), 'Esc fecha a folha');
  await page.goto(B + '#/sobre', 800);
  const sobre = await page.text();
  ok(sobre.includes('Termos de uso e aviso de saúde') && sobre.includes('Privacidade e seus dados'), 'Sobre usa os mesmos textos (blocos fechados)');

  console.log('2. Exportar: planilha CSV');
  await page.goto(B + '#/ajustes', 900);
  await page.click('Exportar para planilha ou PDF');
  const tipos = await page.eval(`return [...document.querySelectorAll('#exportar-planilhas [data-planilha]')].map((b) => b.dataset.planilha + (b.disabled ? ':vazio' : ''));`);
  ok(tipos.join(',') === 'musculacao,corridas,peso,sono,diario,dores,saude:vazio', 'um botão por tipo de registro: ' + tipos.join(', '));
  const csv = async (id) => {
    await page.eval(`window.__blobs = []; document.querySelector('#exportar-planilhas [data-planilha="${id}"]').click(); await new Promise((r) => setTimeout(r, 300)); return 1;`);
    return page.eval(`const b = window.__blobs[window.__blobs.length - 1]; return b ? { tipo: b.type, nome: window.__baixado, bom: new Uint8Array(await b.slice(0, 3).arrayBuffer()).join(','), texto: await b.text() } : null;`);
  };
  const m = await csv('musculacao');
  ok(m && /^fitcore-musculacao-\d{4}-\d{2}-\d{2}\.csv$/.test(m.nome) && m.tipo.startsWith('text/csv'), 'baixa fitcore-musculacao-AAAA-MM-DD.csv: ' + (m && m.nome));
  ok(m && m.bom === '239,187,191', 'arquivo em UTF-8 com BOM (acentos certos no Excel)');
  const linhas = m ? m.texto.replace(/^﻿/, '').split('\r\n') : [];
  ok(linhas[0] === '"Data";"Hora";"Treino";"Exercício";"Série";"Carga (kg)";"Repetições";"Tempo (s)"', 'cabeçalho com ";" entre as colunas');
  ok(linhas.some((l) => /^"\d{2}\/\d{2}\/\d{4}";"\d{2}:\d{2}";"[^"]+";"[^"]+";"\d+";"\d+(,\d+)?";"\d+";""$/.test(l)), 'linhas com data dd/mm/aaaa, carga e repetições');
  ok(linhas.some((l) => l.includes(`"'=HYPERLINK(""x"")"`)), 'nome de treino com fórmula sai como texto (apóstrofo na frente)');
  const c = await csv('corridas');
  ok(c && c.texto.includes('"Rodagem leve";"5";"0:31:00";"0:06:12"') && c.texto.includes(`"'=1+1"`), 'planilha de corridas com duração, ritmo e anotação protegida');
  const d = await csv('diario');
  ok(d && d.texto.includes('"Almoço";"Arroz branco cozido";"150"'), 'planilha do diário alimentar');
  // o backup usa a mesma entrega de arquivo (views/arquivo.js)
  await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); window.__blobs = []; return 1;`); await page.sleep(200);
  await page.click('Fazer backup agora'); await page.click('Continuar', '.sheet-ft button'); await page.sleep(500);
  const bk = await page.eval(`const b = window.__blobs[0]; return b ? { nome: window.__baixado, tipo: b.type, app: JSON.parse(await b.text()).app, aviso: document.querySelector('.toast') ? document.querySelector('.toast').textContent : '' } : null;`);
  ok(bk && /^fitcore-backup-.+\.json$/.test(bk.nome) && bk.tipo === 'application/json' && bk.app === 'fitcore' && /Backup gerado/.test(bk.aviso), 'o backup continua sendo gerado e baixado: ' + JSON.stringify(bk));
  await page.click('Exportar para planilha ou PDF');
  await page.eval(`window.__blobs = []; return 1;`);

  console.log('3. Resumo para imprimir ou salvar em PDF');
  await page.click('Resumo para imprimir ou salvar em PDF');
  await page.sleep(600);
  ok((await page.eval(`return location.hash;`)) === '#/resumo', 'abre a tela do resumo');
  const res = await page.eval(`return document.getElementById('resumo').innerText;`);
  ok(/Período: \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/.test(res) && /Musculação/.test(res) && /kg × \d+ → [\d,]+ kg × \d+ \((\+|−)[\d,]+ kg|mesma carga\)/.test(res) && /Corrida/.test(res) && /Peso/.test(res) && /Sono/.test(res) && /Dores registradas/.test(res), 'período, musculação com evolução de carga, corrida, peso, sono e dores');
  await page.click('Imprimir ou salvar em PDF');
  ok((await page.eval(`return window.__impressoes;`)) === 1, 'o botão abre a impressão do navegador (window.print)');
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  const impresso = await page.eval(`const vis = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; }; return { topo: vis('.topbar'), controles: vis('.no-print'), resumo: vis('#resumo'), fundo: getComputedStyle(document.body).backgroundColor, texto: getComputedStyle(document.body).color };`);
  ok(!impresso.topo && !impresso.controles && impresso.resumo && impresso.fundo === 'rgb(255, 255, 255)' && impresso.texto === 'rgb(0, 0, 0)', 'na impressão: sem barras e botões, papel branco e texto preto: ' + JSON.stringify(impresso));
  await page.send('Emulation.setEmulatedMedia', { media: '' });
  await page.click('30 dias');
  ok((await page.eval(`return location.hash;`)) === '#/resumo/30', 'o período muda pelo seletor');

  console.log('4. Letra maior e alto contraste em todas as telas, a 360 px');
  const plano = await page.eval(`const st = await import('/js/store.js'); const p = st.activePlan(); return { plano: p.id, dia: p.dias[0].id };`);
  // telas principais; o treino em andamento é montado com o primeiro dia do plano (uma série feita, as outras abertas)
  const telas = [['início', ''], ['treinos', 'treinos'], ['dia do treino', `treino/${plano.plano}/${plano.dia}`], ['exercício (figura)', 'exercicio/supino-reto-barra'], ['treino em andamento', 'sessao'], ['histórico', 'historico'], ['evolução (gráficos)', 'progresso'], ['nutrição', 'nutricao'], ['corrida', 'corrida'], ['sono', 'sono'], ['ajustes', 'ajustes'], ['resumo', 'resumo'], ['sobre', 'sobre']];
  await page.eval(`const st = await import('/js/store.js'); const p = st.activePlan(); const dia = p.dias[0];
    st.update((x) => { x.current = { id: 'atual', planId: p.id, diaId: dia.id, nome: dia.nome, inicio: new Date().toISOString(), fim: '', nota: '', itens: dia.itens.map((it, i) => ({ ex: it.ex, alvo: it.reps, descanso: it.descanso, sets: Array.from({ length: it.series }, (_, j) => ({ kg: 22.5, reps: 10, seg: null, ok: i === 0 && j === 0 })) })), restEnd: 0, restTotal: 0, volta: 0, cron: null }; });
    await new Promise((r) => setTimeout(r, 300)); return 1;`);
  // o que vaza da largura da tela (fora de faixas com rolagem própria, como os chips) — ajuda a achar o culpado
  // no celular emulado, conteúdo largo demais alarga a área da página (innerWidth passa de 360): por isso compara com 360
  const medir = `const W = 360; const vaza = [];
    for (const e of document.querySelectorAll('#app *, .backdrop *')) { const r = e.getBoundingClientRect(); if (!r.width || r.right <= W + 1 && r.left >= -1) continue; if (e.closest('.chips:not(.wrap), .week7, [style*="overflow"]')) continue; vaza.push((e.id ? '#' + e.id : e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : e.tagName) + ':' + Math.round(r.right)); if (vaza.length > 5) break; }
    const cortado = [...document.querySelectorAll('.numin input, .stepper input')].filter((i) => i.scrollWidth > i.clientWidth + 1).length;
    return { rola: document.documentElement.scrollWidth > W || innerWidth > W, largura: Math.max(document.documentElement.scrollWidth, innerWidth), vaza, cortado };`;
  const combos = [['grande', 'escuro', true], ['muito', 'claro', true], ['muito', 'escuro', false], ['grande', 'claro', false]];
  for (const [letra, tema, contraste] of combos) {
    await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.settings.letra = '${letra}'; x.settings.tema = '${tema}'; x.settings.contraste = ${contraste}; }); await new Promise((r) => setTimeout(r, 300)); return 1;`);
    const problemas = [];
    for (const [nome, rota] of telas) {
      await page.goto(B + '#/' + rota, 700);
      const r = await page.eval(medir);
      if (r.rola || r.cortado) problemas.push(`${nome}: largura ${r.largura}${r.cortado ? `, ${r.cortado} campo(s) cortado(s)` : ''} ${r.vaza.join(' ')}`);
      else if (r.vaza.length) console.log(`      (aviso) ${nome}: ${r.vaza.join(' ')}`);
    }
    // folhas: exportar e privacidade
    await page.goto(B + '#/ajustes', 700);
    await page.click('Exportar para planilha ou PDF'); await page.sleep(300);
    let r = await page.eval(medir); if (r.rola) problemas.push('folha Exportar: ' + r.vaza.join(' '));
    await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return 1;`);
    await page.click('Privacidade', '.legal-links button'); await page.sleep(300);
    r = await page.eval(medir); if (r.rola) problemas.push('folha Privacidade: ' + r.vaza.join(' '));
    await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return 1;`);
    ok(!problemas.length, `letra ${letra}, tema ${tema}${contraste ? ', alto contraste' : ''}: ${telas.length} telas e 2 folhas sem rolagem lateral nem campo numérico cortado` + (problemas.length ? ' — ' + problemas.join(' | ') : ''));
  }
  const tam = await page.eval(`const st = await import('/js/store.js'); const out = {}; for (const l of ['normal', 'grande', 'muito']) { st.update((x) => { x.settings.letra = l; }); await new Promise((r) => setTimeout(r, 100)); out[l] = parseFloat(getComputedStyle(document.documentElement).fontSize) + '/' + parseFloat(getComputedStyle(document.body).fontSize); } return out;`);
  ok(tam.normal === '16/16' && tam.grande === '20/20' && tam.muito === '24/24', 'letra Normal, Grande e Muito grande: 16, 20 e 24 px no texto comum: ' + JSON.stringify(tam));

  console.log('5. Contraste medido na tela');
  // razão de contraste (WCAG 2.2) entre a cor do texto e a do fundo opaco mais próximo
  const contraste = `const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const rgb = (s) => s.match(/[\\d.]+/g).map(Number); const L = (c) => { const [r, g, b] = c.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const fundo = (e) => { for (; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] === 1) { if (c.length >= 3 && !(c.length === 4 && c[3] === 0)) return c.slice(0, 3); } } return [255, 255, 255]; };
    const razao = (e) => { const a = L(rgb(getComputedStyle(e).color).slice(0, 3)), b = L(fundo(e)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const els = [...document.querySelectorAll('#conteudo .muted, #conteudo .small, #conteudo .bold, #conteudo .btn, .nav a')].filter((e) => e.offsetParent && e.textContent.trim());
    const r = els.map(razao); return { n: r.length, min: Math.round(Math.min(...r) * 100) / 100 };`;
  for (const tema of ['escuro', 'claro']) {
    await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.settings.letra = 'normal'; x.settings.tema = '${tema}'; x.settings.contraste = true; }); await new Promise((r) => setTimeout(r, 200)); return 1;`);
    await page.goto(B + '#/ajustes', 700);
    const a = await page.eval(contraste);
    await page.goto(B + '#/', 700);
    const b = await page.eval(contraste);
    ok(a.min >= 7 && b.min >= 7, `alto contraste no tema ${tema}: menor razão entre ${a.n + b.n} textos = ${Math.min(a.min, b.min)}:1 (mínimo 7:1)`);
  }
  await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.settings.contraste = false; x.settings.tema = 'escuro'; }); await new Promise((r) => setTimeout(r, 200)); return 1;`);
  await page.goto(B + '#/ajustes', 700);
  const normal = await page.eval(contraste);
  console.log(`      (referência) sem alto contraste, tema escuro: menor razão ${normal.min}:1`);
  const foco = await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.settings.contraste = true; }); await new Promise((r) => setTimeout(r, 200)); const b = document.querySelector('#conteudo .btn'); b.focus(); const c = getComputedStyle(b); return c.outlineStyle + ' ' + c.outlineWidth;`);
  ok(/solid 3px/.test(foco) || foco.startsWith('solid'), 'foco visível mais forte com alto contraste: ' + foco);

  console.log('6. Recarregar mantém a escolha, já na primeira tela');
  await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.settings.letra = 'muito'; x.settings.contraste = true; x.settings.tema = 'claro'; }); await st.flush(); await new Promise((r) => setTimeout(r, 300)); return 1;`);
  await page.reload(1500);
  const depois = await page.eval(`return { primeira: window.__primeiraTela, raiz: document.documentElement.dataset.letra + '|' + document.documentElement.dataset.contraste, cor: document.querySelector('meta[name="theme-color"]').content };`);
  ok(depois.primeira === 'muito|alto|light' && depois.raiz === 'muito|alto', 'depois de recarregar, a primeira tela já aparece com letra muito grande e alto contraste: ' + JSON.stringify(depois));
  ok(depois.cor === '#ffffff', 'barra do navegador acompanha o alto contraste do tema claro');
  await page.goto(B + '#/ajustes', 800);
  const marcado = await page.eval(`return { letra: document.querySelector('#letra .on').textContent, contraste: document.querySelector('input[aria-label="Alto contraste"]').checked };`);
  ok(marcado.letra === 'Muito grande' && marcado.contraste, 'Ajustes mostra a escolha gravada');
  await page.click('Normal', '#letra button');
  ok((await page.eval(`return document.documentElement.dataset.letra || 'normal';`)) === 'normal', 'voltar para Normal muda na hora');
  await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.settings.letra = 'normal'; x.settings.contraste = false; x.settings.tema = 'auto'; x.current = null; }); await st.flush(); return 1;`);

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 400));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

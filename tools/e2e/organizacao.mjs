// Teste pesado da ORGANIZAÇÃO DOS TREINOS: planos, dias, agenda da semana, sessão em andamento e histórico.
// Clica como um usuário e confere sempre o estado gravado (store.state) além da tela.
// Uso (com "npm start" rodando): node tools/e2e/navegador.mjs tools/e2e/organizacao.mjs
const B = 'http://localhost:5173/';
const J = JSON.stringify;

// funções que rodam dentro da página (entram no começo de cada trecho avaliado)
const PRE = `
const S = await import('/js/store.js');
if (!window.__semAlerta) { window.__semAlerta = true; window.alert = () => { window.__alerta = true; }; }
// a pergunta "Só nesta semana / Sempre" (views/ajuste-semana.js; testada em tools/e2e/avaliacao.mjs): aqui, sempre "Sempre"
if (!window.__autoSempre) { window.__autoSempre = new MutationObserver(() => { const s = [...document.querySelectorAll('.sheet')].find((x) => x.getAttribute('aria-label') === 'Esta mudança vale para'); const b = s && [...s.querySelectorAll('.sheet-ft .btn')].find((x) => x.textContent.trim() === 'Sempre'); if (b) b.click(); }); window.__autoSempre.observe(document.body, { childList: true }); }
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const vis = (e) => !!(e.offsetParent !== null || e.getClientRects().length);
const topo = () => { const b = [...document.querySelectorAll('.backdrop')]; return b.length ? b[b.length - 1] : document; };
const folha = () => { const b = [...document.querySelectorAll('.backdrop .sheet')]; return b.length ? b[b.length - 1].getAttribute('aria-label') : ''; };
const achar = (txt, sel = 'button, a, .chip, .item, .opt, .menu-item') => { const els = [...topo().querySelectorAll(sel)].filter(vis); return els.find((x) => (x.getAttribute('aria-label') || '') === txt) || els.find((x) => x.textContent.trim() === txt) || els.find((x) => (x.textContent + ' ' + (x.getAttribute('aria-label') || '')).includes(txt)) || null; };
const clicar = async (txt, sel) => { const e = achar(txt, sel); if (!e || e.disabled) return false; e.scrollIntoView({ block: 'center' }); e.click(); await espera(90); return true; };
const digitar = (inp, v) => { inp.focus(); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); };
const toastTxt = () => { const t = document.querySelector('.toast'); return t ? t.textContent : ''; };
const semToast = () => document.querySelectorAll('.toast').forEach((t) => t.remove());
const texto = () => document.body.innerText;
// editor do treino e sessão: cartões de exercício
const cartoes = () => [...document.querySelectorAll('main .card')].filter((c) => c.querySelector('.exhead'));
const cart = (i) => cartoes()[i];
const campo = (i, rot) => cart(i).querySelector('input[aria-label="' + rot + '"]');
const marcar = async (i, j) => { cart(i).querySelectorAll('button.check')[j].click(); await espera(80); };
const botaoSerie = (i, qual) => { const c = cart(i); return c.querySelector('button[aria-label="' + (qual === '+' ? 'Adicionar série' : 'Remover a última série') + '"]') || [...c.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Série')[qual === '+' ? 0 : 1]; };
const barra = () => (document.querySelector('.restbar') || { innerText: '' }).innerText.replace(/\\s+/g, ' ').trim();
const escolher = async (ids) => { const { EX_POR_ID } = await import('/js/data/exercises.js'); const sh = topo(); const busca = sh.querySelector('.search input'); const falt = [];
  for (const id of ids) { const nome = EX_POR_ID.get(id).nome; busca.value = nome; busca.dispatchEvent(new Event('input', { bubbles: true })); await espera(40);
    const it = [...sh.querySelectorAll('.list .item')].find((e) => e.querySelector('.t').textContent === nome); if (it) it.click(); else falt.push(id); await espera(30); }
  return falt; };
`;

export default async (page) => {
  const falhas = [];
  let total = 0;
  const ok = (cond, msg, diag) => {
    total++;
    console.log((cond ? '  ✔ ' : '  ✖ ') + msg + (!cond && diag !== undefined ? '   → ' + (typeof diag === 'string' ? diag : J(diag)) : ''));
    if (!cond) falhas.push(msg);
    return !!cond;
  };
  const secao = (t) => console.log('\n' + t);
  const ev = (code) => page.eval(PRE + code);
  const E = (expr) => ev(`const s = S.state; return (${expr});`);
  const clicar = (txt, sel) => ev(`return clicar(${J(txt)}${sel ? ', ' + J(sel) : ''});`);
  const ir = (rota, ms = 300) => ev(`location.hash = '#/' + ${J(rota)}; await espera(${ms}); return location.hash;`);
  const hash = () => ev('return location.hash;');
  const folha = () => ev('return folha();');
  const texto = () => ev('return texto();');
  const responder = (v) => ev(`const inp = topo().querySelector('.sheet-bd input.input'); const b = topo().querySelector('.sheet-ft .btn.primary'); if (!inp || !b) return false; inp.value = ${J(v)}; b.click(); await espera(280); return true;`);
  const confirmar = () => ev(`const b = topo().querySelector('.sheet-ft .btn.danger, .sheet-ft .btn.primary'); if (!b) return false; b.click(); await espera(280); return true;`);
  const cancelar = () => ev(`const b = topo().querySelector('.sheet-ft .btn.ghost'); if (!b) return false; b.click(); await espera(160); return true;`);
  const fechar = () => ev(`let n = 0; for (const b of [...document.querySelectorAll('.backdrop')].reverse()) { const x = b.querySelector('.sheet-hd .iconbtn'); if (x) { x.click(); n++; } } await espera(140); return n;`);
  const gravar = () => ev('await espera(260); await S.flush(); return true;');
  const recarregar = async () => { await gravar(); await page.reload(900); };
  const menuPlano = async (item) => { await clicar('Opções do plano'); await page.sleep(80); return clicar(item, '.menu-item'); };
  // cria um plano direto no estado (para montar cenários exatos); itens: [id, séries, repetições, descanso]
  const criar = (nome, dias) => ev(`
    const id = 'pT' + Math.random().toString(36).slice(2, 10);
    const dias = ${J(dias)}.map((d, i) => ({ id: 'dT' + i + Math.random().toString(36).slice(2, 8), nome: d.nome, foco: d.foco || '', itens: d.itens.map(([ex, series, reps, descanso]) => ({ ex, series, reps, descanso, nota: '' })) }));
    S.update((s) => { s.plans.push({ id, nome: ${J(nome)}, origem: 'manual', criadoEm: new Date().toISOString(), dias, agenda: {}, info: '' }); s.activePlan = id; });
    const { refresh } = await import('/js/router.js'); refresh(); await espera(120);
    return { id, dias: dias.map((d) => d.id) };`);
  const iniciarDia = (nome) => ev(`
    const c = [...document.querySelectorAll('main .card')].find((x) => x.querySelector('h3') && x.querySelector('h3').textContent === ${J(nome)});
    if (!c) return false;
    [...c.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Iniciar').click(); await espera(400); return true;`);
  const descartar = async () => { if (!(await E('!!s.current'))) return; await ir('sessao'); await clicar('Descartar treino'); await confirmar(); };

  // ------------------------------------------------------------------
  secao('1. Primeira abertura: aba Treinos vazia');
  await page.goto(B, 1200);
  // na primeira abertura o app sugere a instalação depois de uns 2 s: espera a sugestão aparecer e dispensa
  await ev(`for (let k = 0; k < 40 && !folha(); k++) await espera(150); await clicar('Agora não'); S.update((s) => { s.ui.installDismissedAt = new Date().toISOString(); }); return true;`);
  await fechar();
  await ir('treinos');
  let t = await texto();
  ok(t.includes('Você ainda não tem um treino'), 'sem plano, a aba Treinos explica por onde começar');
  ok(['Pedir ao Treinador', 'Usar um modelo pronto', 'Montar do zero', 'Treino livre agora'].every((x) => t.includes(x)), 'as 4 formas de começar aparecem');
  ok(await E('s.plans.length === 0 && s.activePlan === "" && s.current === null'), 'estado inicial sem planos e sem sessão');
  await clicar('Pedir ao Treinador'); await page.sleep(300);
  ok((await hash()) === '#/treinador', '"Pedir ao Treinador" leva à tela do Treinador');
  await ir('treinos');

  // ------------------------------------------------------------------
  secao('2. Planos a partir dos 9 modelos prontos');
  const modelos = await ev(`const { MODELOS } = await import('/js/data/templates.js'); return MODELOS.map((m) => ({ nome: m.nome, itens: m.dias.map((d) => d.itens.length), series: m.dias[0].itens.map((i) => i.series), semana: m.agenda.length, diasSemana: m.diasSemana }));`);
  ok(modelos.length === 9, `há 9 modelos prontos (${modelos.length})`);
  for (const [k, m] of modelos.entries()) {
    await ir('treinos');
    await ev(`return (await clicar('Usar um modelo pronto')) || (await clicar('Modelos prontos'));`);
    const r = await ev(`
      const antes = S.state.plans.length; const fl = folha();
      const it = [...topo().querySelectorAll('.item')].find((e) => e.querySelector('.t') && e.querySelector('.t').textContent === ${J(m.nome)});
      if (!it) return { erro: 'modelo não está na lista', fl };
      it.click(); await espera(300);
      const p = S.activePlan(); const { EX_POR_ID } = await import('/js/data/exercises.js');
      const ids = new Set(p.dias.map((d) => d.id));
      return { fl, novos: S.state.plans.length - antes, nome: p.nome, origem: p.origem, itens: p.dias.map((d) => d.itens.length), existem: p.dias.every((d) => d.itens.every((i) => EX_POR_ID.has(i.ex) && i.series >= 1 && /^\\d+(-\\d+)?$/.test(i.reps) && i.descanso >= 0)),
        agenda: Object.keys(p.agenda).length, agendaOk: Object.values(p.agenda).every((v) => ids.has(v)), h2: (document.querySelector('main h2') || {}).textContent, aberta: folha(), toast: toastTxt(),
        cards: new Set([...document.querySelectorAll('main [data-treino]')].map((x) => x.dataset.treino)).size, hash: location.hash };`);
    const certo = !r.erro && r.fl === 'Modelos de treino' && r.novos === 1 && r.nome === m.nome && r.origem === 'modelo' && J(r.itens) === J(m.itens) && r.existem && r.agenda === m.semana && r.agenda === m.diasSemana && r.agendaOk && r.h2 === m.nome && r.aberta === '' && r.cards === m.itens.length && /Modelo copiado/.test(r.toast);
    ok(certo, `modelo ${k + 1} "${m.nome}": plano criado, ativo, ${m.itens.length} treino(s), agenda de ${m.semana} dia(s)`, r);
    // o primeiro treino do modelo inicia; sai sem registrar (alternando Descartar e Encerrar)
    await clicar('Iniciar'); await page.sleep(400);
    const s1 = await ev(`const c = S.state.current; return { hash: location.hash, itens: c ? c.itens.length : -1, series: c ? c.itens.map((i) => i.sets.length) : [], cards: cartoes().length, nome: c && c.nome, barra: barra() };`);
    ok(s1.hash === '#/sessao' && s1.itens === m.itens[0] && J(s1.series) === J(m.series) && s1.cards === m.itens[0] && /Encerrar/.test(s1.barra), `   inicia o 1º treino com ${m.itens[0]} exercícios e as séries do modelo`, s1);
    if (k % 2) { await clicar('Encerrar'); await confirmar(); } else { await clicar('Descartar treino'); await confirmar(); }
    const s2 = await ev(`return { cur: !!S.state.current, sess: S.state.sessions.length, hash: location.hash };`);
    ok(!s2.cur && s2.sess === 0 && s2.hash === '#/treinos', `   ${k % 2 ? 'encerrar' : 'descartar'} sem séries não grava nada e volta para Treinos`, s2);
  }
  ok(await E('s.plans.length === 9 && new Set(s.plans.map((p) => p.id)).size === 9'), '9 planos guardados, com identificadores diferentes');

  // ------------------------------------------------------------------
  secao('3. Montar do zero e nomes de plano (vazio, longo, emoji, HTML)');
  await ir('treinos');
  await clicar('Montar do zero'); await page.sleep(120);
  ok((await folha()) === 'Novo plano de treino', 'pede o nome do novo plano');
  await responder('');
  ok((await folha()) === 'Novo plano de treino' && await E('s.plans.length === 9'), 'nome vazio não cria plano (a pergunta continua aberta)');
  await responder('      ');
  ok((await folha()) === 'Novo plano de treino' && await E('s.plans.length === 9'), 'nome só com espaços não cria plano');
  await responder('L'.repeat(200));
  let r = await ev(`const p = S.activePlan(); return { n: S.state.plans.length, tam: p.nome.length, origem: p.origem, dias: p.dias.length, dia: p.dias[0].nome, itens: p.dias[0].itens.length, hash: location.hash, esperado: '#/treino/' + p.id + '/' + p.dias[0].id, h1: document.querySelector('h1').textContent, vazio: texto().includes('Este treino ainda está vazio'), fab: !!document.querySelector('.fab-bar') };`);
  ok(r.n === 10 && r.tam === 60 && r.origem === 'manual' && r.dias === 1 && r.itens === 0, 'nome muito longo é cortado em 60 letras; plano manual com 1 treino vazio', r);
  ok(r.hash === r.esperado && r.h1 === 'Treino A' && r.vazio && !r.fab, 'abre direto o editor do "Treino A", vazio e sem botão de iniciar', r);
  await clicar('Voltar'); await page.sleep(300);
  ok((await hash()) === '#/treinos', 'o botão Voltar do editor retorna para Treinos');
  r = await ev(`const h2 = document.querySelector('main h2'); return { larg: h2.scrollWidth, cabe: document.documentElement.scrollWidth <= window.innerWidth + 1 };`);
  ok(r.cabe, 'nome longo não estoura a largura da tela', r);

  const EMOJI = '💪 Treino 🔥 força ñ ç';
  await clicar('Montar do zero'); await page.sleep(120); await responder(EMOJI); await ir('treinos');
  r = await ev(`return { nome: S.activePlan().nome, h2: document.querySelector('main h2').textContent };`);
  ok(r.nome === EMOJI && r.h2 === EMOJI, 'nome com emoji e acentos é guardado e mostrado igual', r);

  const HTML = '<img src=x onerror=alert(1)>';
  await clicar('Montar do zero'); await page.sleep(120); await responder(HTML); await ir('treinos');
  r = await ev(`await espera(200); return { nome: S.activePlan().nome, h2: document.querySelector('main h2').textContent, imgs: document.querySelectorAll('main img, .sheet img').length, alerta: !!window.__alerta };`);
  ok(r.nome === HTML && r.h2 === HTML && r.imgs === 0 && !r.alerta, 'nome com HTML aparece como texto (nada é executado)', r);
  await clicar('Opções do plano'); await page.sleep(100);
  ok((await folha()) === HTML, 'menu do plano mostra o nome com HTML como texto');
  await clicar('Excluir plano', '.menu-item'); await page.sleep(150);
  r = await ev(`return { txt: topo().querySelector('.sheet-bd').textContent, imgs: topo().querySelectorAll('img').length, alerta: !!window.__alerta };`);
  ok(r.txt.includes(HTML) && r.imgs === 0 && !r.alerta, 'confirmação de exclusão mostra o nome com HTML como texto', r);
  await cancelar();
  ok(await E('s.plans.length === 12'), 'cancelar a exclusão mantém o plano');
  // dia com HTML no nome
  await clicar('Adicionar um treino ao plano'); await page.sleep(120);
  const HTMLDIA = '<script>alert(2)</script><b>dia</b>';
  await responder(HTMLDIA);
  r = await ev(`await espera(150); return { h1: document.querySelector('h1').textContent, nome: S.activePlan().dias[1].nome, scripts: document.querySelectorAll('main script, header script').length, alerta: !!window.__alerta };`);
  ok(r.h1 === HTMLDIA && r.nome === HTMLDIA && r.scripts === 0 && !r.alerta, 'nome de treino com HTML aparece como texto', r);
  await ir('treinos');
  r = await ev(`return { outros: [...document.querySelectorAll('main .list .item .t')].map((e) => e.textContent), alerta: !!window.__alerta };`);
  ok(r.outros.includes(EMOJI) && r.outros.some((x) => x.length === 60) && !r.alerta, '"Outros planos" lista os nomes com emoji e o nome longo', r.outros.slice(0, 4));
  await recarregar();
  await ir('treinos');
  r = await ev(`return { n: S.state.plans.length, nome: S.activePlan().nome, dia: S.activePlan().dias[1].nome, emoji: S.state.plans.some((p) => p.nome === ${J(EMOJI)}), h2: document.querySelector('main h2').textContent, alerta: !!window.__alerta };`);
  ok(r.n === 12 && r.nome === HTML && r.dia === HTMLDIA && r.emoji && r.h2 === HTML && !r.alerta, 'depois de recarregar, os 12 planos e os nomes continuam iguais', r);
  // renomear
  await menuPlano('Renomear plano'); await page.sleep(120);
  ok((await folha()) === 'Renomear plano', 'menu do plano abre "Renomear plano"');
  await responder('');
  ok((await folha()) === 'Renomear plano' && await E(`s.plans.find((p) => p.id === s.activePlan).nome === ${J(HTML)}`), 'renomear com nome vazio não muda nada');
  await responder('Plano renomeado ✅');
  r = await ev(`return { nome: S.activePlan().nome, h2: document.querySelector('main h2').textContent, aberta: folha() };`);
  ok(r.nome === 'Plano renomeado ✅' && r.h2 === r.nome && r.aberta === '', 'renomear plano muda o estado e a tela', r);
  await menuPlano('Renomear plano'); await page.sleep(120); await fechar();
  ok(await E('s.plans.find((p) => p.id === s.activePlan).nome === "Plano renomeado ✅"'), 'fechar o "Renomear" sem salvar mantém o nome');

  // ------------------------------------------------------------------
  secao('4. Editor do treino: seletor de exercícios (busca e filtros)');
  await ir('treinos');
  await clicar('Montar do zero'); await page.sleep(120); await responder('Plano de teste');
  const pt = await ev(`const p = S.activePlan(); return { id: p.id, dia: p.dias[0].id };`);
  const diaA = (expr) => ev(`const p = S.state.plans.find((x) => x.id === ${J(pt.id)}); const d = p && p.dias.find((x) => x.id === ${J(pt.dia)}); return (${expr});`);
  await clicar('Adicionar exercícios'); await page.sleep(200);
  r = await ev(`
    const { EXERCICIOS } = await import('/js/data/exercises.js'); const sh = topo();
    const n = () => sh.querySelectorAll('.list .item').length; const cont = () => sh.querySelector('.sheet-bd p.small.muted').textContent;
    const busca = sh.querySelector('.search input'); const dig = async (v) => { busca.value = v; busca.dispatchEvent(new Event('input', { bubbles: true })); await espera(70); };
    const chipDe = (x) => [...sh.querySelectorAll('.chips .chip')].find((c) => c.textContent === x);
    const out = { titulo: folha(), total: EXERCICIOS.length, inicio: n(), cont: cont(), okDesab: sh.querySelector('.sheet-ft .btn.primary').disabled };
    const cx = sh.querySelector('.chips').getBoundingClientRect(); const c1 = chipDe('Peito').getBoundingClientRect(); out.filtros = { faixa: Math.round(cx.height), chip: Math.round(c1.height), dentro: c1.top >= cx.top - 1 && c1.bottom <= cx.bottom + 1 };
    await dig('supino'); out.supino = n(); out.contSupino = cont();
    await dig('SUPÍNO   reto'); out.acento = n();
    await dig('zzzqqq'); out.nada = n(); out.vazio = sh.querySelector('.list .empty') ? sh.querySelector('.list .empty').textContent : '';
    await dig(''); out.volta = n();
    chipDe('Peito').click(); await espera(70); out.peito = n(); out.peitoEsperado = EXERCICIOS.filter((e) => e.grupo === 'peito').length; out.chipOn = chipDe('Peito').classList.contains('on');
    await dig('halter'); out.peitoHalter = n(); await dig('');
    chipDe('Cardio').click(); await espera(70); out.cardio = n(); out.cardioEsperado = EXERCICIOS.filter((e) => e.grupo === 'cardio').length;
    chipDe('Todos').click(); await espera(70); out.todos = n();
    return out;`);
  ok(r.titulo === 'Adicionar exercícios' && r.inicio === r.total && r.cont === r.total + ' exercícios' && r.okDesab, `seletor abre com os ${r.total} exercícios e o botão Adicionar desligado`, r);
  ok(r.filtros.dentro && r.filtros.faixa >= 36, `os filtros por grupo aparecem inteiros no seletor (faixa de ${r.filtros.faixa} px para botões de ${r.filtros.chip} px)`, r.filtros);
  ok(r.supino > 3 && r.supino < 40 && r.acento > 0 && r.acento <= r.supino, `busca "supino" encontra ${r.supino}; maiúsculas, acento e espaços a mais não atrapalham (${r.acento})`, r);
  ok(r.nada === 0 && /Nenhum exercício encontrado/.test(r.vazio) && r.volta === r.total, 'busca sem resultado avisa; limpar a busca traz todos de volta', r);
  ok(r.peito === r.peitoEsperado && r.chipOn && r.peitoHalter > 0 && r.peitoHalter < r.peito && r.cardio === r.cardioEsperado && r.todos === r.total, `filtros por grupo: Peito ${r.peito}, Peito + "halter" ${r.peitoHalter}, Cardio ${r.cardio}, Todos ${r.todos}`, r);
  // escolher e cancelar
  r = await ev(`const falt = await escolher(['supino-reto-barra', 'flexao-de-bracos']); const b = topo().querySelector('.sheet-ft .btn.primary'); return { falt, rot: b.textContent, desab: b.disabled };`);
  ok(!r.falt.length && r.rot === 'Adicionar (2)' && !r.desab, 'escolher 2 exercícios mostra "Adicionar (2)"', r);
  await cancelar();
  ok((await diaA('d.itens.length')) === 0 && (await folha()) === '', 'Cancelar no seletor não adiciona nada');
  // escolher, desmarcar um e confirmar
  await clicar('Adicionar exercícios'); await page.sleep(200);
  r = await ev(`await escolher(['supino-reto-barra', 'flexao-de-bracos', 'prancha-frontal', 'caminhada-esteira', 'leg-press-45']); await escolher(['leg-press-45']); const b = topo().querySelector('.sheet-ft .btn.primary'); const rot = b.textContent; b.click(); await espera(250); return { rot };`);
  r.itens = await diaA('d.itens');
  ok(r.rot === 'Adicionar (4)' && r.itens.map((i) => i.ex).join() === 'supino-reto-barra,flexao-de-bracos,prancha-frontal,caminhada-esteira', 'tocar de novo desmarca; os 4 escolhidos entram no treino, na ordem', r);
  const [i0, , i2, i3] = r.itens;
  ok(i0.series === 3 && i0.reps === '8-12' && i0.descanso === 90, 'exercício com carga entra com 3 × 8-12 e 90 s de descanso', i0);
  ok(i2.series === 3 && i2.reps === '30' && i2.descanso === 45, 'exercício por tempo entra com 3 × 30 s e 45 s de descanso', i2);
  ok(i3.series === 1 && i3.reps === '20' && i3.descanso === 0, 'cardio entra com 20 minutos, sem séries nem descanso', i3);
  r = await ev(`const cs = cartoes(); const rot = (c) => [...c.querySelectorAll('label.field span')].map((x) => x.textContent); return { n: cs.length, r0: rot(cs[0]), r1: rot(cs[1]), r2: rot(cs[2]), r3: rot(cs[3]), fab: !!document.querySelector('.fab-bar'), resumo: texto().includes('4 exercícios · cerca de'), aria3: [...cs[3].querySelectorAll('select')].map((x) => x.getAttribute('aria-label')), aria2: [...cs[2].querySelectorAll('select')].map((x) => x.getAttribute('aria-label')) };`);
  ok(r.n === 4 && r.r0.join() === 'Séries,Repetições,Descanso' && r.r1.join() === 'Séries,Repetições,Descanso' && r.r2.join() === 'Séries,Segundos,Descanso' && r.r3.join() === 'Minutos', 'editor mostra os campos certos: repetições, segundos (prancha) e só minutos (cardio)', r);
  ok(r.aria2[1] === 'Segundos' && r.aria3[0] === 'Minutos', 'nome acessível dos campos de tempo diz "Segundos"/"Minutos" (não "Repetições")', r);
  ok(r.fab && r.resumo, 'com exercícios, aparece o resumo e o botão "Iniciar este treino"');
  await clicar('Adicionar exercícios'); await page.sleep(200);
  r = await ev(`const { EXERCICIOS } = await import('/js/data/exercises.js'); const n = topo().querySelectorAll('.list .item').length; return { n, total: EXERCICIOS.length };`);
  ok(r.n === r.total - 4, 'os exercícios que já estão no treino não aparecem de novo no seletor', r);
  await fechar();
  ok((await diaA('d.itens.length')) === 4, 'fechar o seletor no X não adiciona nada');

  secao('5. Editor do treino: séries, repetições, descanso, mover, trocar e remover');
  const mudar = (i, rot, v) => ev(`const s = cart(${i}).querySelector('select[aria-label="${rot}"]'); if (!s) return false; s.value = ${J(String(v))}; s.dispatchEvent(new Event('change', { bubbles: true })); await espera(120); return true;`);
  await mudar(0, 'Séries', 5); await mudar(0, 'Repetições', '6-8'); await mudar(0, 'Descanso entre séries', 120);
  await mudar(2, 'Segundos', '60'); await mudar(3, 'Minutos', '30');
  r = await diaA('d.itens.map((i) => [i.series, i.reps, i.descanso])');
  ok(J(r[0]) === J([5, '6-8', 120]) && r[2][1] === '60' && r[3][1] === '30', 'mudar séries, repetições, descanso, segundos e minutos grava no plano', r);
  r = await ev(`return { alvo: cart(0).querySelector('.exhead .tiny').textContent, alvo2: cart(2).querySelector('.exhead .tiny').textContent, alvo3: cart(3).querySelector('.exhead .tiny').textContent, sel: cart(0).querySelector('select[aria-label="Descanso entre séries"]').selectedOptions[0].textContent };`);
  ok(r.alvo === '5 × 6-8' && r.alvo2 === '3 × 60 s' && r.alvo3 === '30 min' && r.sel === '2 min', 'a tela mostra os novos alvos (5 × 6-8, 3 × 60 s, 30 min; descanso "2 min")', r);
  const ordem = () => diaA('d.itens.map((i) => i.ex).join()');
  const mover = (i, dir) => ev(`semToast(); const b = cart(${i}).querySelector('button[aria-label="Mover para ${dir}"]'); const des = b.disabled; b.click(); await espera(120); return { des, toast: toastTxt() };`);
  const o0 = await ordem();
  r = await mover(0, 'cima');
  ok((await ordem()) === o0 && (r.des || r.toast), 'mover o primeiro para cima não muda a ordem e o app avisa (ou o botão fica desligado)', r);
  r = await mover(3, 'baixo');
  ok((await ordem()) === o0 && (r.des || r.toast), 'mover o último para baixo não muda a ordem e o app avisa (ou o botão fica desligado)', r);
  await mover(0, 'baixo');
  ok((await ordem()) === 'flexao-de-bracos,supino-reto-barra,prancha-frontal,caminhada-esteira', 'mover o primeiro para baixo troca com o segundo');
  await mover(3, 'cima');
  ok((await ordem()) === 'flexao-de-bracos,supino-reto-barra,caminhada-esteira,prancha-frontal', 'mover o último para cima troca com o penúltimo');
  await mover(1, 'cima'); await mover(2, 'baixo');
  ok((await ordem()) === o0 && (await diaA('d.itens[0].series')) === 5, 'voltar à ordem original mantém as séries de cada exercício');
  // trocar
  await ev(`[...cart(0).querySelectorAll('button')].find((b) => b.textContent.trim() === 'Trocar').click(); await espera(200); return true;`);
  r = await ev(`const { EXERCICIOS, EX_POR_ID } = await import('/js/data/exercises.js'); const sh = topo(); const nomes = () => [...sh.querySelectorAll('.list .item .t')].map((e) => e.textContent);
    const porNome = new Map(EXERCICIOS.map((e) => [e.nome, e])); const chip = [...sh.querySelectorAll('.chips .chip')].find((c) => c.textContent === 'Só movimentos parecidos');
    const a = nomes(); const out = { titulo: folha(), chip: !!chip && chip.classList.contains('on'), n: a.length, mesmos: a.every((x) => porNome.get(x).padrao === 'empurrar_horizontal'), semUsados: !a.some((x) => ['supino-reto-barra', 'flexao-de-bracos'].includes(porNome.get(x).id)), rodape: !!sh.querySelector('.sheet-ft') };
    chip.click(); await espera(80); out.todos = nomes().length; chip.click(); await espera(80); out.deNovo = nomes().length; return out;`);
  ok(r.titulo === 'Trocar Supino reto com barra' && r.chip && r.n > 0 && r.mesmos && r.semUsados && r.todos > r.n && r.deNovo === r.n, `"Trocar" sugere ${r.n} movimentos parecidos e deixa ver todos (${r.todos})`, r);
  await fechar();
  ok((await ordem()) === o0, 'fechar o "Trocar" sem escolher mantém o exercício');
  await ev(`[...cart(0).querySelectorAll('button')].find((b) => b.textContent.trim() === 'Trocar').click(); await espera(200); return true;`);
  r = await ev(`semToast(); const { EXERCICIOS } = await import('/js/data/exercises.js'); const it = [...topo().querySelectorAll('.list .item')].find((e) => e.querySelector('.t').textContent === 'Supino reto com halteres') || topo().querySelector('.list .item'); const nome = it.querySelector('.t').textContent; it.click(); await espera(250); return { nome, id: EXERCICIOS.find((e) => e.nome === nome).id, toast: toastTxt(), aberta: folha() };`);
  let d0 = await diaA('d.itens[0]');
  ok(d0.ex === r.id && d0.series === 5 && d0.reps === '6-8' && d0.descanso === 120 && r.toast === 'Exercício trocado' && r.aberta === '' && (await diaA('d.itens.length')) === 4, `trocar por "${r.nome}" mantém séries, repetições e descanso`, { r, d0 });
  // trocar por exercício de outro tipo (carga -> tempo): volta aos valores padrão do novo tipo
  await ev(`[...cart(0).querySelectorAll('button')].find((b) => b.textContent.trim() === 'Trocar').click(); await espera(200); const sh = topo(); [...sh.querySelectorAll('.chips .chip')].find((c) => c.textContent === 'Só movimentos parecidos').click(); await espera(60); await escolher(['prancha-lateral']); await espera(250); return true;`);
  d0 = await diaA('d.itens[0]');
  r = await ev(`const { EX_POR_ID } = await import('/js/data/exercises.js'); const e = EX_POR_ID.get('prancha-lateral'); return e ? e.registro : null;`);
  if (r) ok(d0.ex === 'prancha-lateral' && d0.reps === '30' && d0.series === 3 && d0.descanso === 45, 'trocar um exercício de carga por um de tempo usa os valores de tempo (3 × 30 s)', d0);
  // remover
  // Remover pede confirmação: cancelar mantém o exercício; confirmar tira
  const antesDeRemover = await ordem();
  const pediu = await ev(`[...cart(0).querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('Remover ') && !/série/.test(b.getAttribute('aria-label'))).click(); await espera(300); const s = document.querySelector('.sheet'); const txt = s ? s.innerText : ''; const c = s && [...s.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cancelar'); if (c) c.click(); await espera(300); return txt;`);
  ok(/Remover este exercício?/.test(pediu) && (await ordem()) === antesDeRemover, 'Remover pede confirmação e Cancelar mantém o exercício', pediu.slice(0, 80));
  await ev(`[...cart(0).querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('Remover ') && !/série/.test(b.getAttribute('aria-label'))).click(); await espera(300); const conf = [...document.querySelectorAll('.sheet button')].find((b) => b.textContent.trim() === 'Remover'); if (conf) conf.click(); await espera(250); return true;`);
  ok((await ordem()) === 'flexao-de-bracos,prancha-frontal,caminhada-esteira' && (await ev('return cartoes().length;')) === 3, 'Remover tira o exercício do treino e da tela');
  // descrição (foco)
  await ev(`const i = document.querySelector('main label.field input.input'); digitar(i, '  Peito e braços  '); await espera(60); digitar(i, 'F'.repeat(200)); await espera(60); return true;`);
  ok((await diaA('d.foco.length')) === 90, 'descrição do treino é cortada em 90 letras');
  await ev(`const i = document.querySelector('main label.field input.input'); digitar(i, '  Peito e braços  '); await espera(60); return true;`);
  ok((await diaA('d.foco')) === 'Peito e braços', 'descrição do treino grava sem espaços sobrando');
  // renomear o treino
  await clicar('Renomear treino'); await page.sleep(120);
  await responder('N'.repeat(60));
  r = await ev(`return { h1: document.querySelector('h1').textContent.length };`);
  ok((await diaA('d.nome.length')) === 40 && r.h1 === 40, 'nome do treino é cortado em 40 letras');
  await clicar('Renomear treino'); await page.sleep(120); await responder('Peito 💥');
  ok((await diaA('d.nome')) === 'Peito 💥' && (await ev('return document.querySelector("h1").textContent;')) === 'Peito 💥', 'renomear o treino muda o título');
  ok(!(await ev(`return !!achar('Excluir este treino');`)), 'plano com um treino só não oferece "Excluir este treino"');

  // ------------------------------------------------------------------
  secao('6. Treinos do plano: adicionar, vazio, excluir, limite, repetido e 40 exercícios');
  await ir('treinos');
  await clicar('Adicionar um treino ao plano'); await page.sleep(120);
  r = await ev(`return { fl: folha(), valor: topo().querySelector('.sheet-bd input.input').value };`);
  ok(r.fl === 'Novo treino' && r.valor === 'Treino B', 'novo treino sugere o nome "Treino B"', r);
  await responder('B'.repeat(55));
  r = await ev(`const p = S.activePlan(); return { dias: p.dias.length, tam: p.dias[1].nome.length, hash: location.hash, esperado: '#/treino/' + p.id + '/' + p.dias[1].id, id: p.dias[1].id };`);
  ok(r.dias === 2 && r.hash === r.esperado, 'treino novo é criado e abre no editor', r);
  ok(r.tam <= 40, `nome do treino novo respeita o limite de 40 letras (ficou com ${r.tam})`);
  const diaB = r.id;
  await recarregar();
  ok((await ev(`const p = S.state.plans.find((x) => x.id === ${J(pt.id)}); return p.dias[1].nome.length;`)) === r.tam, 'depois de recarregar, o nome do treino novo continua igual (não é cortado)');
  await ir('treinos');
  r = await ev(`semToast(); const c = document.querySelectorAll('main [data-treino]')[1]; const txt = c.innerText; [...c.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Iniciar').click(); await espera(300); return { txt, toast: toastTxt(), cur: !!S.state.current, hash: location.hash };`);
  ok(r.txt.includes('Nenhum exercício ainda') && /não tem exercícios/.test(r.toast) && !r.cur && r.hash === '#/treinos', 'treino sem exercício não inicia e o app explica o motivo', r);
  // agenda aponta para o treino B; excluir o treino limpa a agenda
  await ev(`S.update((s) => { const p = s.plans.find((x) => x.id === ${J(pt.id)}); p.agenda[1] = ${J(diaB)}; p.agenda[3] = ${J(diaB)}; p.agenda[5] = ${J(pt.dia)}; }); return true;`);
  await ir(`treino/${pt.id}/${diaB}`);
  await clicar('Excluir este treino'); await page.sleep(120);
  ok((await folha()) === 'Excluir este treino?', 'excluir treino pede confirmação');
  await cancelar();
  ok(await ev(`return S.state.plans.find((x) => x.id === ${J(pt.id)}).dias.length === 2;`), 'cancelar mantém o treino');
  await clicar('Excluir este treino'); await page.sleep(120); await confirmar();
  r = await ev(`const p = S.state.plans.find((x) => x.id === ${J(pt.id)}); return { dias: p.dias.length, agenda: p.agenda, hash: location.hash };`);
  ok(r.dias === 1 && J(r.agenda) === J({ 5: pt.dia }) && r.hash === '#/treinos', 'excluir o treino tira ele do plano e da agenda, e volta para Treinos', r);
  await ir(`treino/${pt.id}/${diaB}`);
  ok((await hash()) === '#/treinos', 'endereço de um treino que não existe mais volta para Treinos');
  // cardio com faixa de minutos ("20-30" pode vir de um backup): a duração estimada não pode virar "NaN"
  await ev(`S.update((s) => { const d = s.plans.find((x) => x.id === ${J(pt.id)}).dias[0]; d.itens.push({ ex: 'corrida-esteira', series: 1, reps: '20-30', descanso: 0, nota: '' }); }); return true;`);
  await ir('treinos');
  r = await ev(`const a = texto(); location.hash = '#/treino/' + ${J(pt.id)} + '/' + ${J(pt.dia)}; await espera(300); const b = texto(); const C = await import('/js/views/common.js'); const d = S.state.plans.find((x) => x.id === ${J(pt.id)}).dias[0]; const min = C.duracaoEstimada(d); S.update((s) => { s.plans.find((x) => x.id === ${J(pt.id)}).dias[0].itens.pop(); }); return { nan: /NaN/.test(a) || /NaN/.test(b), min };`);
  ok(!r.nan && Number.isFinite(r.min) && r.min >= 25, `cardio com minutos em faixa ("20-30") não quebra a duração estimada (cerca de ${r.min} min)`, r);
  await ir('treinos');
  // limite de 14 treinos por plano
  await ev(`S.update((s) => { const p = s.plans.find((x) => x.id === ${J(pt.id)}); while (p.dias.length < 14) p.dias.push({ id: 'dX' + p.dias.length, nome: 'Treino ' + p.dias.length, foco: '', itens: [] }); }); const { refresh } = await import('/js/router.js'); refresh(); await espera(120); return true;`);
  r = await ev(`semToast(); await clicar('Adicionar um treino ao plano'); await espera(150); return { toast: toastTxt(), fl: folha(), dias: S.activePlan().dias.length, cards: new Set([...document.querySelectorAll('main [data-treino]')].map((x) => x.dataset.treino)).size };`);
  ok(r.dias === 14 && r.cards === 14 && /Limite de 14/.test(r.toast) && r.fl === '', 'com 14 treinos, o app avisa do limite e não cria o 15º', r);
  await ev(`S.update((s) => { const p = s.plans.find((x) => x.id === ${J(pt.id)}); p.dias = p.dias.slice(0, 1); }); return true;`);
  // o mesmo exercício duas vezes (pode vir de um backup): o app precisa conviver com isso
  await ev(`S.update((s) => { const d = s.plans.find((x) => x.id === ${J(pt.id)}).dias[0]; d.itens.push({ ...d.itens[0] }); }); return true;`);
  await ir(`treino/${pt.id}/${pt.dia}`);
  r = await ev(`return { n: cartoes().length, nomes: cartoes().map((c) => c.querySelector('.exhead .bold').textContent) };`);
  ok(r.n === 4 && r.nomes[0].replace(/^\d+\. /, '') === r.nomes[3].replace(/^\d+\. /, ''), 'treino com o mesmo exercício duas vezes abre normalmente no editor', r);
  await clicar('Iniciar este treino'); await page.sleep(400);
  r = await ev(`return { hash: location.hash, itens: S.state.current ? S.state.current.itens.map((i) => i.ex) : [], cards: cartoes().length };`);
  ok(r.hash === '#/sessao' && r.itens.length === 4 && r.itens[0] === r.itens[3] && r.cards === 4, 'sessão com exercício repetido abre com os dois cartões', r);
  r = await ev(`digitar(campo(0, 'repetições da série 1'), '11'); digitar(campo(3, 'repetições da série 1'), '13'); await marcar(0, 0); await clicar('Pular'); await marcar(3, 0); await clicar('Pular'); await espera(100);
    const c = S.state.current; return { a: c.itens[0].sets[0], b: c.itens[3].sets[0] };`);
  ok(r.a.ok && r.a.reps === 11 && r.b.ok && r.b.reps === 13, 'cada cartão do exercício repetido registra as suas próprias séries', r);
  await clicar('Finalizar treino'); await page.sleep(150); await confirmar();
  r = await ev(`const x = S.state.sessions[S.state.sessions.length - 1]; return { n: S.state.sessions.length, itens: x ? x.itens.map((i) => [i.ex, i.sets.length, i.sets[0].reps]) : [], hash: location.hash, cards: document.querySelectorAll('main .card .kv').length, id: x && x.id };`);
  ok(r.n === 1 && r.itens.length === 2 && r.itens[0][0] === r.itens[1][0] && r.itens[0][2] === 11 && r.itens[1][2] === 13 && r.hash === '#/historico/' + r.id && r.cards === 2, 'o treino com exercício repetido é salvo e aparece no histórico com as duas entradas', r);
  await ev(`S.update((s) => { s.sessions = []; }); return true;`);
  // 40 exercícios num treino
  await ev(`S.update((s) => { const d = s.plans.find((x) => x.id === ${J(pt.id)}).dias[0]; d.itens = d.itens.slice(0, 3); }); return true;`);
  await ir('treinos'); await ir(`treino/${pt.id}/${pt.dia}`);
  await clicar('Adicionar exercícios'); await page.sleep(200);
  r = await ev(`semToast(); const its = [...topo().querySelectorAll('.list .item')].slice(0, 45); for (const it of its) it.click(); await espera(60); const b = topo().querySelector('.sheet-ft .btn.primary'); const rot = b.textContent; b.click(); await espera(500); return { rot, toast: toastTxt(), cards: cartoes().length };`);
  ok(r.rot === 'Adicionar (45)' && (await diaA('d.itens.length')) === 40 && r.cards === 40, 'escolhendo 45 exercícios, o treino fica com o limite de 40', r);
  ok(/40/.test(r.toast), 'o app avisa que o limite de 40 exercícios foi atingido (não descarta em silêncio)', r.toast);
  r = await ev(`semToast(); await clicar('Adicionar exercícios'); await espera(250); const fl = folha(); const toast = toastTxt(); if (fl) { const it = topo().querySelector('.list .item'); it.click(); topo().querySelector('.sheet-ft .btn.primary').click(); await espera(250); } return { fl, toast: toast || toastTxt() };`);
  ok((await diaA('d.itens.length')) === 40 && /40/.test(r.toast), 'com 40 exercícios, "Adicionar exercícios" avisa do limite em vez de aceitar a escolha e não fazer nada', r);
  await fechar();
  r = await ev(`const t0 = performance.now(); const { refresh } = await import('/js/router.js'); refresh(); const ms = Math.round(performance.now() - t0); return { ms, min: texto().match(/40 exercícios · cerca de (\\d+) minutos/) };`);
  ok(r.ms < 1500 && r.min, `editor com 40 exercícios desenha em ${r.ms} ms e estima a duração`, r);
  await clicar('Iniciar este treino'); await page.sleep(700);
  r = await ev(`return { itens: S.state.current ? S.state.current.itens.length : 0, cards: cartoes().length };`);
  ok(r.itens === 40 && r.cards === 40, 'sessão com 40 exercícios abre com os 40 cartões', r);
  await recarregar();
  r = await ev(`return { itens: S.state.current ? S.state.current.itens.length : 0, cards: cartoes().length, hash: location.hash, plano: S.state.plans.find((x) => x.id === ${J(pt.id)}).dias[0].itens.length };`);
  ok(r.itens === 40 && r.cards === 40 && r.hash === '#/sessao' && r.plano === 40, 'recarregar mantém os 40 exercícios no plano e na sessão', r);
  await descartar();

  // ------------------------------------------------------------------
  secao('7. Planos: duplicar, ativar outro, excluir, limite de 60, sem dias, excluir o último');
  await ir('treinos');
  await ev(`S.update((s) => { const p = s.plans.find((x) => x.id === ${J(pt.id)}); p.dias[0].itens = p.dias[0].itens.slice(0, 3); p.agenda = { 1: p.dias[0].id, 4: p.dias[0].id }; }); const { refresh } = await import('/js/router.js'); refresh(); await espera(100); return true;`);
  let nPlanos = await E('s.plans.length');
  await menuPlano('Duplicar plano'); await page.sleep(250);
  r = await ev(`const o = S.state.plans.find((x) => x.id === ${J(pt.id)}); const c = S.activePlan(); const idsC = new Set(c.dias.map((d) => d.id));
    const out = { n: S.state.plans.length, nome: c.nome, outroId: c.id !== o.id, diasNovos: c.dias.every((d) => !o.dias.some((x) => x.id === d.id)), itens: c.dias[0].itens.length, agenda: Object.keys(c.agenda).join(), agendaOk: Object.values(c.agenda).every((v) => idsC.has(v)), toast: toastTxt(), id: c.id };
    S.update((s) => { s.plans.find((x) => x.id === c.id).dias[0].itens[0].series = 7; }); out.original = S.state.plans.find((x) => x.id === ${J(pt.id)}).dias[0].itens[0].series; return out;`);
  ok(r.n === nPlanos + 1 && r.nome === 'Plano de teste (cópia)' && r.outroId && r.diasNovos && r.itens === 3 && r.agenda === '1,4' && r.agendaOk && r.toast === 'Plano duplicado', 'duplicar cria uma cópia ativa, com treinos e agenda próprios', r);
  ok(r.original !== 7, 'mexer na cópia não muda o plano original', r.original);
  const copia = r.id;
  // ativar outro
  await ir('treinos');
  r = await ev(`semToast(); const it = [...document.querySelectorAll('main .list .item')].find((e) => e.querySelector('.t').textContent === 'Plano de teste'); it.click(); await espera(250); return { ativo: S.state.activePlan, h2: document.querySelector('main h2').textContent, toast: toastTxt(), outros: document.querySelectorAll('main .list .item').length };`);
  ok(r.ativo === pt.id && r.h2 === 'Plano de teste' && r.toast === 'Plano ativado' && r.outros === nPlanos, 'tocar num plano em "Outros planos" ativa esse plano', r);
  // excluir o ativo
  const primeiro = await E('s.plans[0].id');
  await menuPlano('Excluir plano'); await page.sleep(150);
  ok((await folha()) === 'Excluir este plano?', 'excluir plano pede confirmação');
  await confirmar();
  r = await ev(`return { n: S.state.plans.length, existe: S.state.plans.some((p) => p.id === ${J(pt.id)}), ativo: S.state.activePlan, h2: document.querySelector('main h2').textContent, nome0: S.state.plans[0].nome };`);
  ok(r.n === nPlanos && !r.existe && r.ativo === primeiro && r.h2 === r.nome0, 'excluir o plano ativo passa a usar o primeiro plano da lista', r);
  // limite de 60
  await ev(`const P = await import('/js/views/plans.js'); let k = 0; while (S.state.plans.length < 60) { k++; P.criarPlano({ nome: 'Extra ' + k, dias: [{ id: 'dE' + k, nome: 'Treino A', foco: '', itens: [] }] }); } const { refresh } = await import('/js/router.js'); refresh(); await espera(200); return true;`);
  r = await ev(`return { n: S.state.plans.length, outros: document.querySelectorAll('main .list .item').length };`);
  ok(r.n === 60 && r.outros === 59, 'com 60 planos, a tela lista os 59 que não estão ativos', r);
  await clicar('Modelos prontos'); await page.sleep(150);
  r = await ev(`semToast(); topo().querySelector('.item').click(); await espera(250); return { n: S.state.plans.length, toast: toastTxt(), fl: folha() };`);
  ok(r.n === 60 && /60 planos/.test(r.toast) && !/copiado/.test(r.toast), 'limite de 60: modelo pronto não cria o 61º e o app avisa', r);
  await fechar();
  r = await ev(`semToast(); await clicar('Montar do zero'); await espera(200); const fl = folha(); const toast = toastTxt(); return { fl, toast };`);
  if (r.fl) { await responder('Sessenta e um'); r.toast = await ev('return toastTxt();'); }
  ok((await E('s.plans.length')) === 60 && /60 planos/.test(r.toast) && (await hash()) === '#/treinos', 'limite de 60: "Montar do zero" não cria e avisa', r);
  ok(!r.fl, 'limite de 60: "Montar do zero" avisa antes de pedir o nome (não faz o usuário digitar à toa)', r);
  await fechar();
  r = await ev(`semToast(); await clicar('Opções do plano'); await espera(100); await clicar('Duplicar plano', '.menu-item'); await espera(250); return { n: S.state.plans.length, toast: toastTxt() };`);
  ok(r.n === 60 && /60 planos/.test(r.toast), 'limite de 60: duplicar não cria e avisa', r);
  // Treinador no limite
  await ev(`S.update((s) => { s.trainer.answers = { objetivo: 'hipertrofia', idade: 31, peso: 78, altura: 176, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] }; }); return true;`);
  await ir('treinador', 500);
  r = await ev(`semToast(); const achou = await clicar('Aceitar e usar este treino'); await espera(300); return { achou, n: S.state.plans.length, toast: toastTxt(), aceito: S.state.trainer.aceitoEm, hash: location.hash };`);
  ok(r.achou && r.n === 60 && /60 planos/.test(r.toast) && !r.aceito, 'limite de 60: o plano do Treinador não é criado e o app avisa', r);
  await recarregar();
  ok((await E('s.plans.length')) === 60, 'os 60 planos continuam depois de recarregar');
  // plano sem dias
  await ev(`S.update((s) => { s.plans = s.plans.slice(0, 2); s.plans[0].dias = []; s.plans[0].agenda = {}; s.plans[0].nome = 'Plano sem dias'; s.activePlan = s.plans[0].id; }); return true;`);
  await ir('treinos');
  r = await ev(`return { h2: document.querySelector('main h2').textContent, cards: new Set([...document.querySelectorAll('main [data-treino]')].map((x) => x.dataset.treino)).size, add: !!achar('Adicionar um treino ao plano'), dica: texto() };`);
  ok(r.h2 === 'Plano sem dias' && r.cards === 0 && r.add, 'plano sem nenhum treino abre sem erro e oferece "Adicionar um treino ao plano"', { h2: r.h2, cards: r.cards });
  ok(/ainda não tem treinos/i.test(r.dica), 'plano sem treinos explica o que fazer');
  await ir('');
  t = await texto();
  ok(t.includes('Dia de descanso') && t.includes('Nenhum treino agendado'), 'tela inicial com plano sem treinos mostra "Dia de descanso" e "Nenhum treino agendado"');
  await ir('treinos');
  await clicar('Adicionar um treino ao plano'); await page.sleep(120);
  r = await ev(`return topo().querySelector('.sheet-bd input.input').value;`);
  await responder('Treino A');
  ok(r === 'Treino A' && (await E('s.plans[0].dias.length')) === 1 && /^#\/treino\//.test(await hash()), 'no plano sem dias, dá para criar o primeiro treino', r);
  // excluir até o último
  await ir('treinos');
  await menuPlano('Excluir plano'); await page.sleep(150); await confirmar();
  ok(await E('s.plans.length === 1 && s.activePlan === s.plans[0].id'), 'excluindo o ativo, o plano que sobrou vira o ativo');
  await menuPlano('Excluir plano'); await page.sleep(150); await confirmar();
  t = await texto();
  ok((await E('s.plans.length === 0 && s.activePlan === ""')) && t.includes('Você ainda não tem um treino'), 'excluir o último plano volta para a tela de começo, sem erro');
  await ir('');
  ok((await texto()).includes('Vamos montar o seu treino?'), 'sem planos, a tela inicial volta a convidar a montar o treino');
  await recarregar();
  ok(await E('s.plans.length === 0 && s.activePlan === ""'), 'depois de recarregar continua sem planos');

  // ------------------------------------------------------------------
  secao('8. Plano do Treinador');
  await ir('treinador', 500);
  r = await ev(`semToast(); const achou = await clicar('Aceitar e usar este treino'); await espera(400); const p = S.activePlan(); return { achou, hash: location.hash, toast: toastTxt(), n: S.state.plans.length, nome: p && p.nome, origem: p && p.origem, dias: p ? p.dias.length : 0, vazios: p ? p.dias.filter((d) => !d.itens.length).length : -1, agenda: p ? Object.keys(p.agenda).length : 0, selo: texto().includes('Do Treinador'), aceito: !!S.state.trainer.aceitoEm };`);
  ok(r.achou && r.hash === '#/treinos' && r.n === 1 && r.nome === 'Plano do Treinador' && r.origem === 'treinador' && r.dias === 4 && r.vazios === 0 && r.agenda === 4 && r.selo && r.aceito, 'aceitar o treino do Treinador cria o plano ativo, com 4 treinos e 4 dias na agenda', r);
  const tp = await ev(`const p = S.activePlan(); return { id: p.id, dias: p.dias.map((d) => ({ id: d.id, nome: d.nome })) };`);

  // ------------------------------------------------------------------
  secao('9. Agenda da semana, tela inicial e meta semanal');
  const LONGO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const hoje = await ev('return new Date().getDay();');
  const agendar = (wd, alvo) => ev(`
    const chip = [...document.querySelectorAll('.dia .chip[aria-label]')].find((c) => c.getAttribute('aria-label').startsWith(${J(LONGO[wd])} + ':'));
    if (!chip) return { erro: 'dia não encontrado' };
    chip.click(); await espera(120);
    const fl = folha(); const ops = [...topo().querySelectorAll('.list .item')]; const n = ops.length;
    const op = ops.find((o) => o.querySelector('.t').textContent === ${J(alvo)});
    if (!op) return { erro: 'opção não encontrada', fl, n };
    op.click(); await espera(160);
    const p = S.activePlan(); const c2 = [...document.querySelectorAll('.dia .chip[aria-label]')].find((c) => c.getAttribute('aria-label').startsWith(${J(LONGO[wd])} + ':'));
    return { fl, n, valor: p.agenda[${wd}] || '', rotulo: c2.getAttribute('aria-label'), letra: (c2.closest('.dia').querySelector('h3') || {}).textContent || '', on: c2.classList.contains('on'), aberta: folha() };`);
  await ir('treinos');
  ok((await ev('return document.querySelectorAll(".dia .chip[aria-label]").length;')) === 7, 'a agenda mostra os 7 dias da semana');
  let tudo = true; let diag = [];
  for (let wd = 0; wd < 7; wd++) {
    r = await agendar(wd, tp.dias[1].nome);
    const certo = !r.erro && r.fl === LONGO[wd] && r.n === 5 && r.valor === tp.dias[1].id && r.rotulo === `${LONGO[wd]}: ${tp.dias[1].nome}` && r.on && r.aberta === '';
    if (!certo) { tudo = false; diag.push(r); }
  }
  ok(tudo, 'cada dia da semana aceita um treino (folha com os 4 treinos + Descanso); tela e estado mudam juntos', diag);
  r = await ev(`const p = S.activePlan(); return { n: Object.keys(p.agenda).length, iguais: new Set(Object.values(p.agenda)).size, letras: [...document.querySelectorAll('.dia')].map((x) => (x.querySelector('h3') || {}).textContent === p.dias[1].nome ? 'B' : '-').join('') };`);
  ok(r.n === 7 && r.iguais === 1 && /B{7}/.test(r.letras), 'todos os dias com o mesmo treino: agenda com 7 dias iguais (o mesmo treino no cartão de cada dia)', r);
  await ir('');
  r = await ev(`const { metaSemanal } = await import('/js/views/history.js'); return { t: texto(), meta: metaSemanal() };`);
  ok(r.t.includes('TREINO DE HOJE') && r.t.includes(tp.dias[1].nome) && r.t.includes('Iniciar treino'), 'tela inicial mostra o "treino de hoje" agendado');
  ok(r.meta === 7 && r.t.includes('0 de 7 treinos'), 'meta semanal acompanha a agenda: 0 de 7 treinos', r.meta);
  await recarregar();
  ok(await E('Object.keys(s.plans[0].agenda).length === 7'), 'agenda continua depois de recarregar');
  await ir('treinos');
  tudo = true; diag = [];
  for (let wd = 0; wd < 7; wd++) {
    r = await agendar(wd, 'Descanso');
    if (r.erro || r.valor !== '' || r.rotulo !== `${LONGO[wd]}: descanso` || r.on || r.letra !== '') { tudo = false; diag.push(r); }
  }
  ok(tudo && await E('Object.keys(s.plans[0].agenda).length === 0'), 'tirar o treino de cada dia deixa a agenda vazia', diag);
  await ir('');
  r = await ev(`const { metaSemanal } = await import('/js/views/history.js'); return { t: texto(), meta: metaSemanal() };`);
  ok(r.t.includes('Dia de descanso') && r.t.includes('Nenhum treino agendado') && !r.t.includes('TREINO DE HOJE'), 'sem nenhum dia agendado, a tela inicial mostra "Dia de descanso" e avisa que não há agenda');
  ok(r.meta === 4 && r.t.includes('0 de 4 treinos'), 'sem agenda, a meta usa os dias informados ao Treinador (4)', r.meta);
  await ir('treinos');
  await agendar(hoje, tp.dias[0].nome);
  await ir('');
  r = await ev(`const { metaSemanal } = await import('/js/views/history.js'); return { t: texto(), meta: metaSemanal() };`);
  ok(r.t.includes('TREINO DE HOJE') && r.t.includes(tp.dias[0].nome) && r.meta === 1 && r.t.includes('0 de 1 treino'), 'agendando só hoje: "treino de hoje" e meta de 1 treino', r.meta);
  await clicar('Iniciar treino'); await page.sleep(400);
  r = await ev(`return { hash: location.hash, dia: S.state.current && S.state.current.diaId };`);
  ok(r.hash === '#/sessao' && r.dia === tp.dias[0].id, '"Iniciar treino" na tela inicial abre a sessão do treino de hoje', r);
  await descartar();
  await ir('treinos');
  await agendar(hoje, 'Descanso'); await agendar((hoje + 1) % 7, tp.dias[2].nome);
  await ir('');
  t = await texto();
  ok(t.includes('Dia de descanso') && t.includes(`Próximo treino: ${tp.dias[2].nome}, amanhã.`), 'agendando só amanhã: hoje é descanso e o próximo treino é "amanhã"');

  // ------------------------------------------------------------------
  secao('10. Sessão: iniciar, cargas e repetições inválidas');
  const ps = await criar('Plano sessão', [
    { nome: 'Dia S', itens: [['supino-reto-barra', 3, '8-12', 90], ['flexao-de-bracos', 2, '10-15', 60], ['prancha-frontal', 2, '30', 45], ['caminhada-esteira', 1, '20', 0]] },
    { nome: 'Dia T', itens: [['triceps-pulley-corda', 2, '10-12', 60]] },
  ]);
  await ev(`S.update((s) => { s.plans.find((p) => p.id === ${J(ps.id)}).agenda[${hoje}] = ${J(ps.dias[0])}; }); return true;`);
  await ir('treinos');
  await iniciarDia('Dia S');
  const cur = (expr) => ev(`const c = S.state.current; return (${expr});`);
  r = await ev(`const c = S.state.current; return { hash: location.hash, h1: document.querySelector('h1').textContent, nav: !!document.querySelector('nav.nav'), nome: c.nome, plan: c.planId, dia: c.diaId, sets: c.itens.map((i) => i.sets.map((x) => [x.kg, x.reps, x.seg, x.ok])), alvo: c.itens.map((i) => [i.alvo, i.descanso]), barra: barra(), prim: texto().includes('Primeira vez'), heads: cartoes().map((x) => [...x.querySelectorAll('.setgrid .hd')].map((y) => y.textContent).join('|')), relogio: document.querySelector('.timer-big').textContent };`);
  ok(r.hash === '#/sessao' && r.h1 === 'Dia S' && !r.nav && r.plan === ps.id && r.dia === ps.dias[0], 'sessão abre com o nome do treino, sem a barra de abas', r);
  ok(J(r.sets) === J([[[null, 8, null, false], [null, 8, null, false], [null, 8, null, false]], [[null, 10, null, false], [null, 10, null, false]], [[null, null, 30, false], [null, null, 30, false]], [[null, null, 20, false]]]), 'séries montadas conforme o plano: carga vazia, repetições no mínimo do alvo, tempo do plano', r.sets);
  ok(r.heads.join(' / ') === 'Carga (kg)|Repetições|Feito / Repetições|Feito / Segundos|Feito / Minutos|Feito', 'cada exercício mostra as colunas do seu tipo (carga+repetições, só repetições, segundos, minutos)', r.heads);
  ok(/Encerrar/.test(r.barra) && /Exercício/.test(r.barra) && r.prim && /^\d+:\d\d$/.test(r.relogio), 'barra inferior com "Exercício" e "Encerrar"; dica de primeira vez; relógio do treino andando', r.barra);
  r = await ev(`semToast(); await marcar(0, 0); return { toast: toastTxt(), ok: S.state.current.itens[0].sets[0].ok };`);
  ok(!r.ok && /Informe a carga/.test(r.toast), 'marcar série sem carga não marca e pede a carga', r);
  const campoTeste = async (i, rot, chave, casos) => {
    const out = await ev(`const res = []; for (const [v, esp] of ${J(casos)}) { const inp = campo(${i}, ${J(rot)}); digitar(inp, v); await espera(40); res.push([v, S.state.current.itens[${i}].sets[0].${chave}, campo(${i}, ${J(rot)}).value]); } return res;`);
    const ruins = out.filter(([, got], k) => (casos[k][1] === 'int' ? !(Number.isInteger(got) && got >= 0) : got !== casos[k][1]));
    return { out, ruins };
  };
  r = await campoTeste(0, 'carga da série 1', 'kg', [['12,5', 12.5], ['', null], ['0', 0], ['-5', 0], ['12.5', 12.5], ['abc', 12.5], ['99999', 2000], ['7,777', 7.78], ['  30 ', 30], ['1e9', 2000], ['Infinity', 2000], ['20kg', 2000]].slice(0, 9));
  ok(!r.ruins.length, 'carga: vírgula ou ponto valem; vazio limpa; negativo vira 0; texto é ignorado; valor enorme para em 2000; 2 casas decimais', r.ruins);
  r = await ev(`const inp = campo(0, 'carga da série 1'); digitar(inp, '7,777'); await espera(40); return { v: S.state.current.itens[0].sets[0].kg, tela: inp.value };`);
  ok(String(r.v).replace('.', ',') === r.tela, 'a carga gravada é a mesma que aparece no campo', r);
  r = await campoTeste(0, 'repetições da série 1', 'reps', [['12', 12], ['', null], ['0', 0], ['-3', 0], ['abc', 0], ['99999', 999], ['10', 10]]);
  ok(!r.ruins.length, 'repetições: vazio limpa; negativo vira 0; texto é ignorado; valor enorme para em 999', r.ruins);
  r = await campoTeste(0, 'repetições da série 1', 'reps', [['8,5', 'int'], ['7.2', 'int']]);
  ok(!r.ruins.length, 'repetições com vírgula viram número inteiro (não existe meia repetição)', r.out);
  r = await ev(`const res = {}; const t = async (kg, reps) => { digitar(campo(0, 'carga da série 1'), kg); digitar(campo(0, 'repetições da série 1'), reps); await espera(40); semToast(); await marcar(0, 0); const o = { ok: S.state.current.itens[0].sets[0].ok, toast: toastTxt() }; if (o.ok) { await marcar(0, 0); await clicar('Pular'); } return o; };
    res.semReps = await t('20', ''); res.zeroReps = await t('20', '0'); res.zeroKg = await t('0', '10'); return res;`);
  ok(!r.semReps.ok && /repetições/.test(r.semReps.toast) && !r.zeroReps.ok && /repetições/.test(r.zeroReps.toast), 'série sem repetições (vazio ou 0) não marca e o app pede as repetições', r);
  ok(r.zeroKg.ok, 'carga 0 com repetições é aceita (exercício sem peso)', r.zeroKg);
  r = await ev(`const c = cart(0); const mais = c.querySelector('button[aria-label="Aumentar carga da série 1"]'); const menos = c.querySelector('button[aria-label="Diminuir carga da série 1"]'); const kg = () => S.state.current.itens[0].sets[0].kg;
    digitar(campo(0, 'carga da série 1'), ''); const out = []; mais.click(); out.push(kg()); menos.click(); menos.click(); menos.click(); out.push(kg()); digitar(campo(0, 'carga da série 1'), '20'); mais.click(); out.push(kg()); menos.click(); out.push(kg());
    digitar(campo(0, 'carga da série 1'), '2000'); mais.click(); out.push(kg()); return out;`);
  ok(J(r) === J([1, 0, 22.5, 20, 2000]), 'botões + e − da carga: de vazio vai a 1; não desce de 0; acima de 20 kg anda de 2,5; não passa de 2000', r);
  // segurar o + repete; soltar para; e se o botão sumir da tela durante o toque (tela redesenhada), também para
  r = await ev(`const kg = () => S.state.current.itens[0].sets[2].kg; const bot = () => cart(0).querySelector('button[aria-label="Aumentar carga da série 3"]'); const toque = (b, tipo) => b.dispatchEvent(new PointerEvent(tipo, { bubbles: true }));
    digitar(campo(0, 'carga da série 3'), '20'); await espera(40);
    let b = bot(); toque(b, 'pointerdown'); await espera(900); toque(b, 'pointerup'); const a1 = kg(); await espera(400); const a2 = kg();
    b = bot(); toque(b, 'pointerdown'); await espera(900); const { refresh } = await import('/js/router.js'); refresh(); await espera(60); const b1 = kg(); await espera(600); const b2 = kg();
    digitar(campo(0, 'carga da série 3'), ''); await espera(40); return { a1, a2, b1, b2, fim: kg() };`);
  ok(r.a1 > 22.5 && r.a2 === r.a1, `segurar o + sobe a carga sozinho (20 → ${r.a1}) e para ao soltar`, r);
  ok(r.b1 > r.a1 && r.b2 === r.b1 && r.fim === null, 'se a tela é redesenhada com o + ainda apertado, a carga para de subir', r);

  secao('11. Sessão: marcar séries, descanso (+15, −15, pular), séries e exercícios a mais ou a menos');
  r = await ev(`digitar(campo(0, 'carga da série 1'), '40'); digitar(campo(0, 'repetições da série 1'), '10'); await espera(40); await marcar(0, 0); await espera(150); const c = S.state.current;
    return { sets: c.itens[0].sets.map((x) => [x.kg, x.reps, x.ok]), falta: Math.round((c.restEnd - Date.now()) / 1000), total: c.restTotal, barra: barra(), feito: cart(0).querySelector('.exhead .tiny').textContent, rot: cart(0).querySelector('button.check').getAttribute('aria-label'), pressed: cart(0).querySelector('button.check').getAttribute('aria-pressed') };`);
  ok(J(r.sets) === J([[40, 10, true], [40, 8, false], [40, 8, false]]), 'marcar a série grava 40 kg × 10 e copia a carga para as próximas séries vazias', r.sets);
  ok(r.falta >= 88 && r.falta <= 90 && r.total === 90 && /DESCANSO/.test(r.barra) && /1:(30|29|28)/.test(r.barra) && r.feito === '1 de 3 séries' && /^Desmarcar/.test(r.rot) && r.pressed === 'true', 'o descanso de 90 s começa sozinho e a barra mostra a contagem', r);
  r = await ev(`const f = () => S.state.current.restEnd; const a = f(); await clicar('+15'); const b = f(); const tot = S.state.current.restTotal; await clicar('−15'); await clicar('−15'); const c = f(); await espera(300); return { mais: b - a, menos: c - b, tot, barra: barra() };`);
  ok(r.mais === 15000 && r.menos === -30000 && r.tot === 105 && /1:1\d/.test(r.barra), '+15 soma 15 s e −15 tira 15 s do descanso', r);
  await clicar('Pular'); await page.sleep(150);
  r = await ev(`return { restEnd: S.state.current.restEnd, barra: barra() };`);
  ok(r.restEnd === 0 && /Finalizar treino/.test(r.barra) && !/DESCANSO/.test(r.barra), '"Pular" encerra o descanso e a barra volta com "Finalizar treino"', r);
  // −15 até acabar
  r = await ev(`await marcar(0, 0); await espera(100); const b0 = barra(); await marcar(0, 0); await espera(100); for (let k = 0; k < 7; k++) { if (!(await clicar('−15'))) break; } await espera(350); const b1 = barra(); const fim = S.state.current.restEnd; await clicar('OK'); await espera(100); return { b0, b1, fim, b2: barra() };`);
  ok(/Encerrar/.test(r.b0), 'desmarcar a única série feita muda o botão da barra de volta para "Encerrar"', r.b0);
  ok(/Descanso concluído/.test(r.b1) && r.fim === 0 && /Finalizar treino/.test(r.b2), 'tirando 15 s até zerar, aparece "Descanso concluído" e depois a barra normal', r);
  // série a mais e a menos
  r = await ev(`const n = () => S.state.current.itens[0].sets.length; botaoSerie(0, '+').click(); await espera(80); const a = n(); const nova = S.state.current.itens[0].sets[3]; botaoSerie(0, '−').click(); await espera(200); const fl = folha(); return { a, nova, b: n(), fl, rotMais: botaoSerie(0, '+').getAttribute('aria-label'), rotMenos: botaoSerie(0, '−').getAttribute('aria-label') };`);
  ok(r.a === 4 && J([r.nova.kg, r.nova.reps, r.nova.ok]) === J([40, 8, false]) && r.b === 3 && r.fl === '', 'adicionar série copia a última; remover série não feita tira sem perguntar', r);
  ok(r.rotMais === 'Adicionar série' && r.rotMenos === 'Remover a última série', 'os dois botões "Série" têm nomes diferentes para leitor de tela', r);
  r = await ev(`digitar(campo(1, 'repetições da série 2'), '12'); await marcar(1, 1); await clicar('Pular'); botaoSerie(1, '−').click(); await espera(200); const fl = folha(); const txt = fl ? topo().querySelector('.sheet-bd').textContent : ''; return { fl, txt, n: S.state.current.itens[1].sets.length };`);
  ok(r.fl !== '' && r.n === 2, 'remover uma série JÁ FEITA pede confirmação antes de apagar o registro', r);
  await cancelar();
  ok((await cur('c.itens[1].sets.length')) === 2 && (await cur('c.itens[1].sets[1].ok')), 'cancelar mantém a série feita');
  r = await ev(`botaoSerie(1, '−').click(); await espera(200); return folha();`);
  await confirmar();
  r = await ev(`return { n: S.state.current.itens[1].sets.length, menos: !!botaoSerie(1, '−') };`);
  ok(r.n === 1 && !r.menos, 'confirmar remove a série; com 1 série só, o botão de remover some', r);
  r = await ev(`semToast(); for (let k = 0; k < 32; k++) { botaoSerie(1, '+').click(); } await espera(150); const n = S.state.current.itens[1].sets.length; const toast = toastTxt(); S.update((s) => { s.current.itens[1].sets.length = 2; }); const { refresh } = await import('/js/router.js'); refresh(); await espera(150); return { n, toast };`);
  ok(r.n === 30 && /30/.test(r.toast), 'limite de 30 séries por exercício, com aviso', r);
  // exercício a mais
  await clicar('Exercício'); await page.sleep(250);
  r = await ev(`const { EXERCICIOS } = await import('/js/data/exercises.js'); const n = topo().querySelectorAll('.list .item').length; await escolher(['leg-press-45']); const b = topo().querySelector('.sheet-ft .btn.primary'); semToast(); b.click(); await espera(300); const c = S.state.current; const it = c.itens[4];
    return { toast: toastTxt(), n, total: EXERCICIOS.length, itens: c.itens.length, ex: it && it.ex, sets: it && it.sets.length, desc: it && it.descanso, alvo: it && it.alvo, cards: cartoes().length, padrao: S.state.settings.descanso };`);
  ok(/adicionado no fim/.test(r.toast) && r.n === r.total - 4 && r.itens === 5 && r.ex === 'leg-press-45' && r.sets === 3 && r.desc === r.padrao && r.alvo === '8-12' && r.cards === 5, 'adicionar exercício durante o treino: entra no fim (com aviso), com 3 séries e o descanso padrão dos Ajustes', r);
  ok((await cur('c.itens[0].sets[0].ok && c.itens[1].sets[0].ok === false && c.itens[0].sets[0].kg')) === 40, 'adicionar exercício não mexe no que já foi registrado');
  const menuEx = async (i, item) => { await ev(`cart(${i}).querySelector('button[aria-label^="Opções: "]').click(); await espera(120); return true;`); return item ? clicar(item, '.menu-item') : true; };
  await menuEx(4);
  r = await ev(`return [...topo().querySelectorAll('.menu-item')].map((m) => m.textContent);`);
  ok(J(r) === J(['Aparelho ocupado', 'Trocar por outro exercício', 'Fazer antes', 'Tirar deste treino']), 'menu do último exercício: aparelho ocupado, trocar, fazer antes, tirar (sem "fazer depois")', r);
  await fechar();
  await menuEx(0);
  r = await ev(`return [...topo().querySelectorAll('.menu-item')].map((m) => m.textContent);`);
  ok(J(r) === J(['Aparelho ocupado', 'Trocar por outro exercício', 'Fazer depois', 'Tirar deste treino']), 'menu do primeiro exercício: aparelho ocupado, trocar, fazer depois, tirar (sem "fazer antes")', r);
  await fechar();
  await menuEx(4, 'Fazer antes'); await page.sleep(200);
  ok((await cur('c.itens.map((i) => i.ex).join()')) === 'supino-reto-barra,flexao-de-bracos,prancha-frontal,leg-press-45,caminhada-esteira', '"Fazer antes" sobe o exercício uma posição');
  await menuEx(3, 'Fazer depois'); await page.sleep(200);
  ok((await cur('c.itens.map((i) => i.ex).join()')) === 'supino-reto-barra,flexao-de-bracos,prancha-frontal,caminhada-esteira,leg-press-45', '"Fazer depois" desce o exercício uma posição');
  await menuEx(4, 'Tirar deste treino'); await page.sleep(250);
  r = await ev(`return { fl: folha(), n: S.state.current.itens.length, cards: cartoes().length };`);
  ok(r.fl === '' && r.n === 4 && r.cards === 4, 'tirar um exercício sem séries feitas remove direto', r);
  await menuEx(0, 'Tirar deste treino'); await page.sleep(250);
  r = await ev(`return { fl: folha(), n: S.state.current.itens.length };`);
  ok(r.fl !== '' && r.n === 4, 'tirar um exercício COM séries feitas pede confirmação', r);
  await cancelar();
  ok((await cur('c.itens.length')) === 4 && (await cur('c.itens[0].ex')) === 'supino-reto-barra', 'cancelar mantém o exercício e as séries');
  // trocar durante o treino (exercício sem séries feitas)
  await ev(`S.update((s) => { s.current.itens[1].sets.forEach((x) => { x.ok = false; }); }); const { refresh } = await import('/js/router.js'); refresh(); await espera(120); return true;`);
  await menuEx(1, 'Trocar por outro exercício'); await page.sleep(250);
  r = await ev(`const fl = folha(); const it = [...topo().querySelectorAll('.list .item')].find((e) => e.querySelector('.t').textContent === 'Flexão de braços com joelhos apoiados') || topo().querySelector('.list .item'); const nome = it.querySelector('.t').textContent; it.click(); await espera(300); const c = S.state.current.itens[1]; const { EX_POR_ID } = await import('/js/data/exercises.js'); return { fl, nome, novo: EX_POR_ID.get(c.ex).nome, sets: c.sets.length, alvo: c.alvo, cards: cartoes().length, tit: cart(1).querySelector('.exhead .bold').textContent };`);
  ok(r.fl === 'Trocar Flexão de braços' && r.novo === r.nome && r.sets === 2 && r.alvo === '10-15' && r.cards === 4 && r.tit === r.nome, `trocar exercício durante o treino (por "${r.nome}") mantém o número de séries e o alvo`, r);

  secao('12. Sessão: exercícios por tempo (segundos e minutos)');
  r = await ev(`digitar(campo(2, 'tempo da série 1'), '2'); await espera(40); cart(2).querySelector('button[aria-label="Cronometrar esta série"]').click(); await espera(200); const b0 = barra(); await espera(2700); const c = S.state.current; return { b0, st: c.itens[2].sets[0], prox: c.itens[2].sets[1], descanso: Math.round((c.restEnd - Date.now()) / 1000), b1: barra() };`);
  ok(/EXERCÍCIO/.test(r.b0) && /Parar/.test(r.b0) && r.st.ok && r.st.seg === 2 && r.descanso >= 40 && r.descanso <= 45 && /DESCANSO/.test(r.b1), 'cronômetro de 2 s: ao terminar marca a série e começa o descanso de 45 s', r);
  await clicar('Pular');
  r = await ev(`digitar(campo(2, 'tempo da série 2'), '2'); await espera(40); cart(2).querySelector('button[aria-label="Cronometrar esta série"]').click(); await espera(300); await marcar(2, 1); const a = S.state.current.itens[2].sets[1].ok; await espera(2700); return { a, depois: S.state.current.itens[2].sets[1].ok, barra: barra() };`);
  ok(r.a && r.depois, 'marcar a série à mão com o cronômetro rodando: ela continua marcada quando o tempo acaba', r);
  await clicar('Pular');
  // o cronômetro continua valendo quando a tela é redesenhada (mudar a ordem dos exercícios no meio)
  await ev(`botaoSerie(2, '+').click(); await espera(100); digitar(campo(2, 'tempo da série 3'), '4'); cart(2).querySelector('button[aria-label="Cronometrar esta série"]').click(); await espera(150); return true;`);
  const ord0 = await cur('c.itens.map((i) => i.ex)');
  await menuEx(0, 'Fazer depois'); await page.sleep(150);
  r = await ev(`return { barra: barra(), ordem: S.state.current.itens.map((i) => i.ex).slice(0, 2).join() };`);
  await menuEx(1, 'Fazer antes'); await page.sleep(150);
  r.barra2 = await ev('return barra();');
  r.fim = await ev(`await espera(3600); const c = S.state.current; return { ordem: c.itens.map((i) => i.ex).slice(0, 3).join(), st: c.itens[2].sets[2], barra: barra() };`);
  ok(r.ordem === [ord0[1], ord0[0]].join() && /EXERCÍCIO/.test(r.barra) && /EXERCÍCIO/.test(r.barra2), 'mudar a ordem dos exercícios com o cronômetro rodando não perde o cronômetro', r);
  ok(r.fim.ordem === ord0.slice(0, 3).join() && r.fim.st && r.fim.st.ok && r.fim.st.seg === 4, 'e ao terminar ele marca a série certa (4 s)', r.fim);
  await clicar('Pular');
  await ev(`botaoSerie(2, '−').click(); await espera(200); return true;`); await confirmar();
  ok((await cur('c.itens[2].sets.length')) === 2, 'a série extra (feita) sai depois da confirmação');
  r = await ev(`botaoSerie(2, '+').click(); await espera(100); digitar(campo(2, 'tempo da série 3'), '2'); cart(2).querySelector('button[aria-label="Cronometrar esta série"]').click(); await espera(300); await clicar('Parar'); await espera(2600); return { n: S.state.current.itens[2].sets.length, ok: S.state.current.itens[2].sets[2].ok, barra: barra() };`);
  ok(r.n === 3 && !r.ok && !/EXERCÍCIO/.test(r.barra), '"Parar" cancela o cronômetro sem marcar a série', r);
  const errosAntes = page.erros.length;
  r = await ev(`cart(2).querySelector('button[aria-label="Cronometrar esta série"]').click(); await espera(300); botaoSerie(2, '−').click(); await espera(2800); return { n: S.state.current.itens[2].sets.length, barra: barra(), oks: S.state.current.itens[2].sets.map((x) => x.ok) };`);
  ok(r.n === 2 && J(r.oks) === J([true, true]) && !/EXERCÍCIO/.test(r.barra) && page.erros.length === errosAntes, 'remover a série que está sendo cronometrada não causa erro quando o tempo acaba', { r, erros: page.erros.slice(errosAntes) });
  await ev(`await clicar('Pular'); return true;`);
  r = await campoTeste(2, 'tempo da série 1', 'seg', [['', null], ['-4', 0], ['abc', 0], ['45', 45]]);
  ok(!r.ruins.length, 'tempo: vazio limpa; negativo vira 0; texto é ignorado', r.ruins);
  r = await ev(`digitar(campo(2, 'tempo da série 1'), '999999'); await espera(40); const seg = S.state.current.itens[2].sets[0].seg; digitar(campo(2, 'tempo da série 1'), '2'); digitar(campo(3, 'tempo da série 1'), '999999'); await espera(40); const min = S.state.current.itens[3].sets[0].seg; return { seg, min };`);
  ok(r.seg <= 3600 && r.min <= 600, `tempo enorme é limitado (segundos até ${r.seg}, minutos até ${r.min})`, r);
  r = await ev(`semToast(); digitar(campo(3, 'tempo da série 1'), ''); await espera(40); await marcar(3, 0); const semTempo = { ok: S.state.current.itens[3].sets[0].ok, toast: toastTxt() }; digitar(campo(3, 'tempo da série 1'), '25'); await espera(40); await marcar(3, 0); await espera(120); const c = S.state.current; return { semTempo, st: c.itens[3].sets[0], restEnd: c.restEnd, barra: barra(), crono: !!cart(3).querySelector('button[aria-label="Cronometrar esta série"]') };`);
  ok(!r.semTempo.ok && /tempo/i.test(r.semTempo.toast), 'cardio sem tempo não marca e o app pede o tempo', r.semTempo);
  ok(r.st.ok && r.st.seg === 25 && r.restEnd === 0 && !r.crono && /Finalizar treino/.test(r.barra), 'cardio de 25 min marca sem iniciar descanso (e sem cronômetro de segundos)', r);

  secao('13. Sessão: recarregar no meio, voltar e continuar, outro treino, editar o plano');
  await ev(`digitar(campo(0, 'repetições da série 2'), '8'); await marcar(0, 1); await espera(150); return true;`);
  const antes = await cur('({ id: c.id, sets: JSON.stringify(c.itens.map((i) => i.sets)), itens: c.itens.map((i) => i.ex).join(), restEnd: c.restEnd })');
  ok(antes.restEnd > 0, 'descanso em andamento antes de recarregar');
  await recarregar();
  r = await ev(`const c = S.state.current; return { hash: location.hash, id: c && c.id, sets: c && JSON.stringify(c.itens.map((i) => i.sets)), itens: c && c.itens.map((i) => i.ex).join(), restEnd: c && c.restEnd, barra: barra(), h1: document.querySelector('h1').textContent, cards: cartoes().length, marcadas: document.querySelectorAll('button.check.on').length };`);
  ok(r.hash === '#/sessao' && r.id === antes.id && r.sets === antes.sets && r.itens === antes.itens && r.h1 === 'Dia S' && r.cards === 4, 'recarregar a página no meio do treino continua de onde parou (mesmas séries, cargas e ordem)', r);
  ok(r.restEnd === antes.restEnd && /DESCANSO/.test(r.barra) && r.marcadas === 5, 'o descanso continua contando depois de recarregar e as séries feitas aparecem marcadas', { restEnd: r.restEnd, barra: r.barra, marcadas: r.marcadas });
  // som: depois de recarregar, o primeiro toque em qualquer ponto da tela da sessão já libera o bipe do descanso
  r = await ev(`const AC = window.AudioContext; window.__sons = 0; window.AudioContext = class extends AC { constructor() { super(); window.__sons++; } };
    document.querySelector('main').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await espera(80); const n = window.__sons; window.AudioContext = AC; return n;`);
  ok(r === 1, 'depois de recarregar, o primeiro toque na tela da sessão prepara o som do aviso de descanso', r);
  await clicar('Pular');
  await clicar('Voltar'); await page.sleep(350);
  r = await ev(`return { hash: location.hash, t: texto().includes('Treino em andamento'), cont: !!achar('Continuar'), cur: !!S.state.current };`);
  ok(r.hash === '#/treinos' && r.t && r.cont && r.cur, 'voltar da sessão não perde o treino: a aba Treinos mostra "Treino em andamento"', r);
  await ir('');
  t = await texto();
  ok(t.includes('Treino em andamento') && t.includes('Continuar treino') && !t.includes('TREINO DE HOJE'), 'a tela inicial também oferece "Continuar treino"');
  await clicar('Continuar treino'); await page.sleep(350);
  ok((await hash()) === '#/sessao' && (await cur('c.id')) === antes.id, '"Continuar treino" volta para a mesma sessão');
  // iniciar outro com este em andamento
  await ir('treinos');
  await iniciarDia('Dia T');
  r = await ev(`return { fl: folha(), txt: folha() ? topo().querySelector('.sheet-bd').textContent : '', botoes: folha() ? [...topo().querySelectorAll('.sheet-ft .btn')].map((b) => b.textContent) : [] };`);
  ok(r.fl === 'Já existe um treino em andamento' && r.txt.includes('Dia S'), 'iniciar outro treino com um em andamento avisa antes de descartar', r);
  ok(r.botoes.length === 2 && !/^Voltar$/.test(r.botoes[0]), `o botão que NÃO descarta diz claramente o que faz ("${r.botoes[0]}")`, r.botoes);
  await cancelar(); await page.sleep(300);
  r = await ev(`return { id: S.state.current && S.state.current.id, hash: location.hash };`);
  ok(r.id === antes.id && r.hash === '#/sessao', 'desistir de começar outro mantém o treino atual e volta para ele', r);
  // editar o plano com a sessão em andamento
  await ir(`treino/${ps.id}/${ps.dias[0]}`);
  await ev(`[...cart(0).querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').startsWith('Remover ') && !/série/.test(b.getAttribute('aria-label'))).click(); await espera(300); const conf = [...document.querySelectorAll('.sheet button')].find((b) => b.textContent.trim() === 'Remover'); if (conf) conf.click(); await espera(250); const s = cart(0).querySelector('select[aria-label="Séries"]'); s.value = '6'; s.dispatchEvent(new Event('change', { bubbles: true })); await espera(120); return true;`);
  await clicar('Renomear treino'); await page.sleep(120); await responder('Dia S editado');
  r = await ev(`const c = S.state.current; const d = S.state.plans.find((p) => p.id === ${J(ps.id)}).dias[0]; return { plano: d.itens.length, nomePlano: d.nome, sessao: c.itens.length, nomeSessao: c.nome, sets: JSON.stringify(c.itens.map((i) => i.sets)) };`);
  ok(r.plano === 3 && r.nomePlano === 'Dia S editado' && r.sessao === 4 && r.nomeSessao === 'Dia S' && r.sets === antes.sets, 'editar o plano durante o treino não muda a sessão em andamento', r);
  await ev(`S.update((s) => { const d = s.plans.find((p) => p.id === ${J(ps.id)}).dias[0]; d.nome = 'Dia S'; d.itens = ${J([['supino-reto-barra', 3, '8-12', 90], ['flexao-de-bracos', 2, '10-15', 60], ['prancha-frontal', 2, '30', 45], ['caminhada-esteira', 1, '20', 0]])}.map(([ex, series, reps, descanso]) => ({ ex, series, reps, descanso, nota: '' })); }); return true;`);

  secao('14. Finalizar parcial, histórico, recordes e sugestão de carga');
  await ir('sessao');
  // estado esperado: supino 40×10 e 40×8 feitas (3ª não), flexão sem séries feitas, prancha 2 feitas, caminhada 25 min
  r = await ev(`await clicar('Finalizar treino'); await espera(200); return { fl: folha(), txt: folha() ? topo().querySelector('.sheet-bd').textContent : '', feitas: S.state.current.itens.reduce((n, i) => n + i.sets.filter((x) => x.ok).length, 0), total: S.state.current.itens.reduce((n, i) => n + i.sets.length, 0) };`);
  ok(r.fl === 'Finalizar o treino?' && r.txt.includes(`Você marcou ${r.feitas} de ${r.total} séries`), `finalizar com séries faltando pede confirmação ("${r.feitas} de ${r.total} séries")`, r);
  await cancelar();
  ok((await cur('c && c.id')) === antes.id && (await E('s.sessions.length')) === 0, 'cancelar a finalização mantém o treino em andamento');
  await clicar('Finalizar treino'); await page.sleep(200); await confirmar(); await page.sleep(200);
  r = await ev(`const x = S.state.sessions[0]; return { n: S.state.sessions.length, cur: S.state.current, hash: location.hash, id: x && x.id, nome: x && x.nome, planId: x && x.planId, diaId: x && x.diaId, itens: x && x.itens.map((i) => [i.ex, i.sets.map((y) => [y.kg, y.reps, y.seg, y.ok])]), fimOk: x && Date.parse(x.fim) >= Date.parse(x.inicio), t: texto() };`);
  ok(r.n === 1 && r.cur === null && r.id === antes.id && r.hash === '#/historico/' + antes.id && r.nome === 'Dia S' && r.planId === ps.id && r.diaId === ps.dias[0] && r.fimOk, 'treino finalizado vai para o histórico e a sessão em andamento é encerrada', { n: r.n, hash: r.hash, nome: r.nome });
  ok(J(r.itens) === J([['supino-reto-barra', [[40, 10, null, true], [40, 8, null, true]]], ['prancha-frontal', [[null, null, 2, true], [null, null, 2, true]]], ['caminhada-esteira', [[null, null, 25, true]]]]), 'só as séries marcadas entram no histórico; exercício sem série feita fica de fora', r.itens);
  const plj = await E('s.sessions[0].itens.map((i) => i.planejadas)');
  ok(J(plj) === J([3, 2, 1]), 'cada exercício do histórico guarda quantas séries estavam planejadas (3, 2 e 1)', plj);
  ok(r.t.includes('Treino concluído!') && r.t.includes('40 kg × 10') && r.t.includes('40 kg × 8') && r.t.includes('25 min') && r.t.includes('2 s') && r.t.includes('720'), 'resumo do treino mostra as séries, o tempo e a carga total (720 kg)');
  await clicar('Voltar'); await page.sleep(350);
  r = await ev(`return { hash: location.hash, erro: texto().includes('Algo deu errado') };`);
  ok(r.hash !== '#/historico/' + antes.id && r.hash !== '#/sessao' && !r.erro, 'depois do resumo, o botão Voltar leva à tela de antes do treino, sem ficar preso', r);
  await ir('historico');
  r = await ev(`return { t: texto(), itens: document.querySelectorAll('main .list .item').length };`);
  ok(r.itens === 1 && r.t.includes('1 treino registrado') && r.t.includes('Dia S') && r.t.includes('3 exercícios · 5 séries · carga total: 720 kg'), 'histórico lista o treino com exercícios, séries e carga total', r.t.slice(0, 200));
  await ev(`document.querySelector('main .list .item').click(); await espera(300); return true;`);
  ok((await hash()) === '#/historico/' + antes.id && (await texto()).includes('Série 2'), 'tocar no treino abre o detalhe');
  r = await ev(`const P = await import('/js/logic/progress.js'); const a = P.recorde('supino-reto-barra'); const s = P.sugestao('supino-reto-barra', '8-12', 3); const f = P.sugestao('prancha-frontal', '30', 2); const c = P.sugestao('caminhada-esteira', '20', 1); return { a, s, f, c, semana: P.semanaAtual().size };`);
  ok(r.a && r.a.kg === 40 && r.a.reps === 10, 'recorde do supino usa o que foi registrado (40 kg × 10)', r.a);
  ok(r.s.kg === 40 && r.s.reps === 11 && r.s.texto.includes('Última vez: 40 kg × 10 · 40 kg × 8'), 'sugestão da próxima sessão: manter 40 kg e tentar 11 repetições', r.s);
  ok(r.f.seg === 2 && r.c.seg === 25 && r.semana === 1, 'sugestão de tempo usa o último registro (2 s e 25 min); semana conta 1 dia treinado', r);
  await ir('exercicio/supino-reto-barra', 500);
  ok((await texto()).includes('Melhor marca: 40 kg × 10'), 'a tela do exercício mostra a melhor marca registrada');
  await ir('');
  r = await ev(`const { metaSemanal } = await import('/js/views/history.js'); return { t: texto(), meta: metaSemanal() };`);
  ok(r.t.includes('TREINO DE HOJE · FEITO') && r.t.includes('Treinar de novo') && r.t.includes(`1 de ${r.meta} treino`), 'tela inicial marca o treino de hoje como feito e conta 1 treino na semana', r.meta);
  // segunda sessão no mesmo dia: cargas sugeridas e recorde
  await clicar('Treinar de novo'); await page.sleep(400);
  r = await ev(`const c = S.state.current; return { hash: location.hash, id: c && c.id, sup: c && c.itens[0].sets.map((x) => [x.kg, x.reps]), flex: c && c.itens[1].sets.map((x) => x.reps), pr: c && c.itens[2].sets.map((x) => x.seg), cam: c && c.itens[3].sets.map((x) => x.seg), dica: cart(0).querySelector('p.small.muted').textContent, valor: campo(0, 'carga da série 1').value };`);
  ok(r.hash === '#/sessao' && r.id !== antes.id && J(r.sup) === J([[40, 11], [40, 11], [40, 11]]) && r.valor === '40' && r.dica.includes('Última vez: 40 kg × 10'), 'a nova sessão já vem com 40 kg e 11 repetições sugeridas, e mostra a última vez', r);
  ok(J(r.flex) === J([10, 10]) && J(r.pr) === J([2, 2]) && J(r.cam) === J([25]), 'exercício não feito da última vez volta ao alvo; tempos repetem o último registro', r);
  r = await ev(`semToast(); digitar(campo(0, 'carga da série 1'), '45'); digitar(campo(0, 'repetições da série 1'), '10'); await espera(40); await marcar(0, 0); const t1 = toastTxt(); await clicar('Pular'); semToast(); digitar(campo(0, 'carga da série 2'), '30'); await marcar(0, 1); const t2 = toastTxt(); await clicar('Pular'); return { t1, t2 };`);
  ok(/recorde/i.test(r.t1) && !/recorde/i.test(r.t2), 'série acima da melhor marca avisa "Novo recorde"; série mais leve não avisa', r);
  await clicar('Finalizar treino'); await page.sleep(200); await confirmar(); await page.sleep(200);
  r = await ev(`const P = await import('/js/logic/progress.js'); const x = S.state.sessions[1]; return { n: S.state.sessions.length, id: x && x.id, rec: P.recorde('supino-reto-barra'), semana: P.semanaAtual().size, ordem: S.state.sessions.every((y, k, a) => !k || Date.parse(a[k - 1].inicio) <= Date.parse(y.inicio)) };`);
  ok(r.n === 2 && r.rec.kg === 45 && r.rec.reps === 10 && r.semana === 1 && r.ordem, 'duas sessões no mesmo dia: as duas ficam no histórico, o recorde sobe para 45 kg e a semana conta 1 dia', r);
  const sess2 = r.id;
  await ir('historico');
  ok((await ev('return document.querySelectorAll("main .list .item").length;')) === 2 && (await texto()).includes('2 treinos registrados'), 'histórico lista os 2 treinos');
  // excluir do histórico
  await ir('historico/' + sess2);
  await clicar('Excluir este treino do histórico'); await page.sleep(150);
  ok((await folha()) === 'Excluir este registro?', 'excluir do histórico pede confirmação');
  await cancelar();
  ok((await E('s.sessions.length')) === 2, 'cancelar mantém o registro');
  await clicar('Excluir este treino do histórico'); await page.sleep(150); await confirmar(); await page.sleep(250);
  r = await ev(`const P = await import('/js/logic/progress.js'); return { n: S.state.sessions.length, hash: location.hash, rec: P.recorde('supino-reto-barra'), sug: P.sugestao('supino-reto-barra', '8-12', 3).kg };`);
  ok(r.n === 1 && r.hash === '#/historico' && r.rec.kg === 40 && r.sug === 40, 'excluir o treino tira do histórico; recorde e sugestão voltam a usar o treino que sobrou (40 kg)', r);
  await ir('historico/' + sess2);
  ok((await hash()) === '#/historico', 'endereço de um treino excluído volta para o histórico');
  await ir('historico/' + antes.id);
  await clicar('Excluir este treino do histórico'); await page.sleep(150); await confirmar(); await page.sleep(250);
  r = await ev(`const P = await import('/js/logic/progress.js'); return { n: S.state.sessions.length, rec: P.recorde('supino-reto-barra'), sug: P.sugestao('supino-reto-barra', '8-12', 3), t: texto() };`);
  ok(r.n === 0 && r.rec === null && r.sug.kg === null && /Primeira vez/.test(r.sug.texto) && r.t.includes('Nenhum treino registrado ainda'), 'sem histórico, não há recorde e a sugestão volta a ser "Primeira vez"', { n: r.n, rec: r.rec });
  await recarregar();
  ok((await E('s.sessions.length === 0 && s.current === null')), 'exclusões continuam valendo depois de recarregar');

  secao('15. Finalizar com tudo marcado, treino livre, descartar, excluir o plano com sessão aberta');
  await ir('treinos');
  await iniciarDia('Dia T');
  r = await ev(`digitar(campo(0, 'carga da série 1'), '15'); await espera(30); await marcar(0, 0); await clicar('Pular'); await marcar(0, 1); await espera(200); const c = S.state.current; const b = barra(); const sets = c.itens[0].sets.map((x) => [x.kg, x.reps, x.ok]); const restEnd = c.restEnd; await clicar('Finalizar treino'); await espera(400); return { b, sets, restEnd, fl: folha(), n: S.state.sessions.length, cur: S.state.current, hash: location.hash };`);
  ok(J(r.sets) === J([[15, 10, true], [15, 10, true]]) && r.restEnd === 0 && /Finalizar treino/.test(r.b), 'a última série do treino não inicia descanso e a barra oferece "Finalizar treino"', r);
  ok(r.fl === '' && r.n === 1 && r.cur === null && /^#\/historico\//.test(r.hash), 'com todas as séries feitas, finaliza direto (sem pergunta) e mostra o resumo', r);
  await clicar('Início'); await page.sleep(300);
  ok(/^#\/?$/.test(await hash()), 'o botão "Início" do resumo leva à tela inicial', await hash());
  // treino livre
  await ir('treinos');
  await clicar('Treino livre agora'); await page.sleep(400);
  r = await ev(`const c = S.state.current; return { hash: location.hash, nome: c && c.nome, itens: c && c.itens.length, planId: c && c.planId, h1: document.querySelector('h1').textContent, t: texto(), barra: barra() };`);
  ok(r.hash === '#/sessao' && r.nome === 'Treino livre' && r.itens === 0 && r.planId === '' && r.h1 === 'Treino livre' && r.t.includes('toque em “Exercício”') && /Encerrar/.test(r.barra), 'treino livre abre vazio e explica como adicionar exercícios', r);
  await clicar('Encerrar'); await page.sleep(150);
  ok((await folha()) === 'Encerrar sem registrar?', 'encerrar sem nenhuma série avisa que nada será salvo');
  await confirmar();
  r = await ev(`return { cur: S.state.current, n: S.state.sessions.length, hash: location.hash };`);
  ok(r.cur === null && r.n === 1 && r.hash === '#/treinos', 'treino livre encerrado sem séries não entra no histórico', r);
  await clicar('Treino livre agora'); await page.sleep(400);
  await clicar('Exercício'); await page.sleep(250);
  r = await ev(`await escolher(['leg-press-45', 'caminhada-esteira']); topo().querySelector('.sheet-ft .btn.primary').click(); await espera(300); digitar(campo(0, 'carga da série 1'), '100'); digitar(campo(0, 'repetições da série 1'), '12'); await espera(40); await marcar(0, 0); await clicar('Pular'); const c = S.state.current; return { itens: c.itens.map((i) => i.ex).join(), barra: barra(), aviso: texto().includes('Toque no ✓') };`);
  ok(r.itens === 'leg-press-45,caminhada-esteira' && /Finalizar treino/.test(r.barra) && r.aviso, 'treino livre aceita exercícios e séries', r);
  await clicar('Finalizar treino'); await page.sleep(200); await confirmar(); await page.sleep(200);
  r = await ev(`const x = S.state.sessions[S.state.sessions.length - 1]; return { n: S.state.sessions.length, nome: x.nome, planId: x.planId, diaId: x.diaId, itens: x.itens.map((i) => [i.ex, i.sets.length]), t: texto() };`);
  ok(r.n === 2 && r.nome === 'Treino livre' && r.planId === '' && r.diaId === '' && J(r.itens) === J([['leg-press-45', 1]]) && r.t.includes('100 kg × 12'), 'treino livre finalizado entra no histórico só com o que foi feito', r);
  // descartar com séries feitas
  await ir('treinos');
  await clicar('Treino livre agora'); await page.sleep(400);
  await clicar('Exercício'); await page.sleep(250);
  await ev(`await escolher(['leg-press-45']); topo().querySelector('.sheet-ft .btn.primary').click(); await espera(300); await marcar(0, 0); await clicar('Pular'); return true;`);
  r = await cur('c.itens[0].sets[0]');
  ok(r.ok && r.kg === 100 && r.reps === 12, 'no treino livre seguinte, o exercício já vem com a última carga (100 kg × 12)', r);
  await clicar('Descartar treino'); await page.sleep(150);
  ok((await folha()) === 'Descartar este treino?', 'descartar pede confirmação');
  await cancelar();
  ok(await E('!!s.current'), 'cancelar o descarte mantém o treino');
  // iniciar outro e escolher "descartar e começar"
  await ir('treinos');
  await iniciarDia('Dia T');
  ok((await folha()) === 'Já existe um treino em andamento', 'com séries feitas no treino livre, iniciar outro pede confirmação');
  await confirmar(); await page.sleep(300);
  r = await ev(`const c = S.state.current; return { nome: c && c.nome, hash: location.hash, n: S.state.sessions.length, kg: c && c.itens[0].sets[0].kg };`);
  ok(r.nome === 'Dia T' && r.hash === '#/sessao' && r.n === 2 && r.kg === 15, '"Descartar e começar" troca para o novo treino (com a carga da última vez) sem gravar o antigo', r);
  // excluir o plano com a sessão aberta
  await ev(`digitar(campo(0, 'carga da série 1'), '17,5'); await espera(30); await marcar(0, 0); await clicar('Pular'); return true;`);
  await ir('treinos');
  await menuPlano('Excluir plano'); await page.sleep(150); await confirmar(); await page.sleep(200);
  r = await ev(`return { existe: S.state.plans.some((p) => p.id === ${J(ps.id)}), cur: S.state.current && S.state.current.nome, t: texto().includes('Treino em andamento') };`);
  ok(!r.existe && r.cur === 'Dia T' && r.t, 'excluir o plano com um treino em andamento não perde a sessão', r);
  await clicar('Continuar'); await page.sleep(350);
  r = await ev(`return { hash: location.hash, cards: cartoes().length, ok: S.state.current.itens[0].sets[0].ok };`);
  ok(r.hash === '#/sessao' && r.cards === 1 && r.ok, 'a sessão do plano excluído continua abrindo normalmente', r);
  await clicar('Finalizar treino'); await page.sleep(200); await confirmar(); await page.sleep(250);
  r = await ev(`const x = S.state.sessions[S.state.sessions.length - 1]; return { n: S.state.sessions.length, nome: x.nome, kg: x.itens[0].sets[0].kg, hash: location.hash, t: texto().includes('17,5 kg × 11') };`);
  ok(r.n === 3 && r.nome === 'Dia T' && r.kg === 17.5 && /^#\/historico\//.test(r.hash) && r.t, 'e finaliza normalmente: o treino do plano excluído fica no histórico', r);
  await recarregar();
  r = await ev(`return { n: S.state.sessions.length, cur: S.state.current, planos: S.state.plans.length };`);
  ok(r.n === 3 && r.cur === null && r.planos === 1, 'depois de recarregar: 3 treinos no histórico, nenhuma sessão aberta, 1 plano', r);

  secao('16. Adicionar pelo catálogo de exercícios e filtro da academia');
  await ev(`S.update((s) => { s.plans = []; s.activePlan = ''; }); return true;`);
  await ir('exercicio/supino-reto-barra', 500);
  await clicar('Adicionar a um treino'); await page.sleep(200);
  r = await ev(`return { fl: folha(), ops: [...topo().querySelectorAll('.list .item .t')].map((x) => x.textContent) };`);
  ok(r.fl === 'Adicionar ao treino' && r.ops.length >= 1, 'sem plano, "Adicionar a um treino" já oferece um treino para receber o exercício', r);
  await fechar();
  ok((await E('s.plans.length')) === 0, 'abrir e fechar essa folha sem escolher não cria plano vazio');
  await clicar('Adicionar a um treino'); await page.sleep(200);
  r = await ev(`semToast(); topo().querySelector('.list .item').click(); await espera(250); const p = S.activePlan(); return { n: S.state.plans.length, itens: p ? p.dias[0].itens.map((i) => i.ex) : [], toast: toastTxt(), fl: folha() };`);
  ok(r.n === 1 && J(r.itens) === J(['supino-reto-barra']) && /^Adicionado a /.test(r.toast) && r.fl === '', 'escolhendo o treino, o plano é criado com o exercício', r);
  await clicar('Adicionar a um treino'); await page.sleep(200);
  r = await ev(`const it = topo().querySelector('.list .item'); return { des: it.disabled, txt: it.textContent };`);
  ok(r.des && r.txt.includes('Já está neste treino'), 'exercício que já está no treino aparece desligado ("Já está neste treino")', r);
  await fechar();
  await ir('exercicio/leg-press-45', 500);
  await clicar('Adicionar a um treino'); await page.sleep(200);
  r = await ev(`return topo().querySelector('.list .item .s').textContent;`);
  ok(r === '1 exercício', `contagem no singular: "${r}"`);
  await fechar();
  await ev(`const { EXERCICIOS } = await import('/js/data/exercises.js'); S.update((s) => { const d = s.plans[0].dias[0]; d.itens = EXERCICIOS.filter((e) => e.id !== 'leg-press-45').slice(0, 40).map((e) => ({ ex: e.id, series: 3, reps: '10', descanso: 60, nota: '' })); }); return true;`);
  await clicar('Adicionar a um treino'); await page.sleep(200);
  r = await ev(`semToast(); const it = topo().querySelector('.list .item'); const des = it.disabled; const txt = it.textContent; if (!des) it.click(); await espera(250); return { des, txt, toast: toastTxt(), n: S.state.plans[0].dias[0].itens.length };`);
  ok(r.n === 40 && !/^Adicionado/.test(r.toast) && (r.des || /40/.test(r.toast)), 'treino cheio (40 exercícios): o app não diz "Adicionado" sem adicionar', r);
  await fechar();
  // filtro "minha academia" no seletor
  await ev(`S.update((s) => { s.gym.all = false; s.gym.has = { halteres: true }; s.plans[0].dias[0].itens = []; }); return true;`);
  await ir('treinos'); await ir(`treino/${await E('s.plans[0].id')}/${await E('s.plans[0].dias[0].id')}`);
  await clicar('Adicionar exercícios'); await page.sleep(250);
  r = await ev(`const { EXERCICIOS } = await import('/js/data/exercises.js'); const sh = topo(); const n = () => sh.querySelectorAll('.list .item').length; const a = n(); const chip = [...sh.querySelectorAll('.chips .chip')].find((c) => /academia/i.test(c.textContent)); let b = -1; if (chip) { chip.click(); await espera(100); b = n(); } return { a, b, total: EXERCICIOS.length, chip: chip ? chip.textContent : '' };`);
  ok(r.a > 0 && r.a < r.total, `com a academia marcada, o seletor mostra só o que dá para fazer (${r.a} de ${r.total})`, r);
  ok(r.chip && r.b === r.total, 'o seletor avisa desse filtro e deixa ver todos os exercícios', r);
  await fechar();
  await ev(`S.update((s) => { s.gym.all = true; s.gym.has = {}; }); return true;`);

  secao('17. Caminho sem volta e erros');
  // folha aberta + botão voltar do aparelho
  await clicar('Adicionar exercícios'); await page.sleep(250);
  r = await ev(`history.back(); await espera(400); return { hash: location.hash, fl: folha() };`);
  ok(r.hash === '#/treinos' && r.fl === '', 'botão voltar do aparelho com o seletor aberto: o seletor fecha junto (não fica solto sobre outra tela)', r);
  await fechar();
  await clicar('Modelos prontos'); await page.sleep(200);
  r = await ev(`const aberta = folha(); history.back(); await espera(400); return { aberta, hash: location.hash, fl: folha(), n: S.state.plans.length };`);
  ok(r.aberta === 'Modelos de treino' && r.fl === '' && r.n === 1, 'o mesmo vale para a lista de modelos (fecha sem criar plano)', r);
  await fechar();
  await ir('sessao');
  ok((await hash()) === '#/treinos', 'abrir o endereço da sessão sem treino em andamento volta para Treinos');
  await ir('treino/naoexiste/naoexiste');
  ok((await hash()) === '#/treinos', 'endereço de treino inexistente volta para Treinos');
  ok(!(await ev('return !!window.__alerta;')), 'nenhum texto digitado foi executado como código durante o teste');
  // o navegador de teste bloqueia a vibração porque os toques são simulados: não é erro do app
  const erros = page.erros.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource|Blocked call to navigator\.vibrate/.test(e));
  ok(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' || ').slice(0, 600) : ''));

  console.log(`\nRESULTADO: ${total} verificações, ${falhas.length} falha(s)`);
  if (falhas.length) { for (const f of falhas) console.log('  ✖ ' + f); throw new Error(falhas.length + ' falha(s)'); }
};

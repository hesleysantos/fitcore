// Teste de ponta a ponta do TREINO GUIADO (logic/guiado.js + views/session.js): o passo do aquecimento no topo, as séries
// de aproximação (que não contam no histórico, nos recordes, no volume nem nas calorias), a troca rápida "Aparelho
// ocupado" e o teste da 1ª série ("Como foi?"). Recarrega a página no meio, confere 360 px sem rolagem para o lado, o
// perfil que não pode subir a carga e zero erro no console. Deixa fotos em .tools/shots/treino-guiado/.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/treino-guiado.mjs
import * as store from '../../www/js/store.js';

const B = 'http://localhost:5173/';
const J = JSON.stringify;
const item = (ex, reps = '8-12', series = 3, descanso = 90) => ({ ex, series, reps, descanso, nota: '' });
// supino (peito, com número pelo perfil), crucifixo (peito de novo: sem aproximação), leg press (máquina: sem número) e
// cadeira extensora (sem outro exercício do mesmo movimento: "Aparelho ocupado" sem alternativa)
const ITENS = [item('supino-reto-barra'), item('crucifixo-reto-halteres', '10-15', 3, 60), item('leg-press-45'), item('cadeira-extensora', '10-15', 3, 60)];
const RESP = { objetivo: 'hipertrofia', idade: 31, peso: 78, altura: 176, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };

function estado(respostas, tema = 'claro') {
  const agora = new Date();
  const plano = { id: 'p1', nome: 'Guiado', origem: 'manual', criadoEm: new Date(agora.getTime() - 20 * 86400000).toISOString(), info: '', agenda: {}, dias: [{ id: 'da', nome: 'Treino A', foco: '', itens: ITENS }] };
  return store.sanitize({
    v: store.VERSAO, settings: { tema, animar: false, som: false }, gym: { all: true, has: {} }, plans: [plano], activePlan: 'p1',
    trainer: { answers: respostas, aceitoEm: new Date(agora.getTime() - 20 * 86400000).toISOString() },
    nutri: { answers: { sexo: 'm' } },
    ui: { onboarded: true, installDismissedAt: agora.toISOString(), backupEm: agora.toISOString() },
  });
}

const PRE = `
const S = await import('/js/store.js');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const vis = (e) => !!(e.offsetParent !== null || e.getClientRects().length);
const topo = () => { const b = [...document.querySelectorAll('.backdrop')]; return b.length ? b[b.length - 1] : document; };
const achar = (txt, sel = 'button, a, .item, .menu-item, summary') => { const els = [...topo().querySelectorAll(sel)].filter(vis); return els.find((x) => (x.getAttribute('aria-label') || '') === txt) || els.find((x) => x.textContent.trim() === txt) || els.find((x) => x.textContent.includes(txt)); };
const clicar = async (txt, sel) => { const e = achar(txt, sel); if (!e || e.disabled) return false; e.scrollIntoView({ block: 'center' }); e.click(); await espera(120); return true; };
const cartoes = () => [...document.querySelectorAll('main .card')].filter((c) => c.querySelector('.exhead'));
const cart = (i) => cartoes()[i];
const marcar = async (i, j) => { cart(i).querySelectorAll('button.check')[j].click(); await espera(150); };
const digitar = (inp, v) => { inp.focus(); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); inp.blur(); };
const campo = (i, rot) => cart(i).querySelector('input[aria-label="' + rot + '"]');
const toastTxt = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ');
const semToast = () => document.querySelectorAll('.toast').forEach((t) => t.remove());
const aprox = (i) => [...cart(i).querySelectorAll('.aprox-s')].map((b) => ({ txt: b.textContent.trim(), on: b.classList.contains('on') }));
const guia = () => JSON.parse(localStorage.getItem('fitcore-treino-guiado') || 'null');
const semRolagem = () => document.documentElement.scrollWidth <= window.innerWidth + 1;
`;

export default async (page) => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  const falhas = [];
  const ok = (c, m, diag) => { console.log((c ? '  ✔ ' : '  ✖ ') + m + (!c && diag !== undefined ? '   → ' + (typeof diag === 'string' ? diag : J(diag)) : '')); if (!c) falhas.push(m); };
  const ev = (js) => page.eval(PRE + js);
  const carregar = async (respostas, tema) => {
    await page.goto(B, 1200);
    await page.eval(`localStorage.removeItem('fitcore-treino-guiado'); const m = await import('/js/store.js'); m.importData(${J(J({ app: 'fitcore', v: 1, dados: estado(respostas, tema) }))}); await new Promise((r) => setTimeout(r, 700));`);
    await page.goto(B + '#/treinos', 300); await page.reload(1400);
    await ev(`const s = await import('/js/views/session.js'); await s.startSession('p1', 'da'); await espera(600);`);
  };
  let r;

  console.log('\n== 1. Aquecimento no topo do treino ==');
  await carregar(RESP);
  r = await ev(`const a = document.getElementById('aquecimento'); const pq = a && a.querySelector('details.pq');
    return { hash: location.hash, vis: !!a && !a.hidden && vis(a), txt: a ? a.innerText : '', fechado: !!pq && !pq.open, topo: a && cart(0) ? a.getBoundingClientRect().top < cart(0).getBoundingClientRect().top : false,
      bts: a ? [...a.querySelectorAll('button')].map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]) : [], rol: semRolagem() };`);
  ok(r.hash === '#/sessao' && r.vis && r.topo, 'o cartão "Aquecimento" aparece no topo, antes do 1º exercício', r);
  ok(/Aquecimento/.test(r.txt) && /opcional/.test(r.txt) && /1º exercício de cada músculo/.test(r.txt), 'texto curto: cardio opcional e séries leves no 1º exercício de cada músculo', r.txt);
  ok(r.fechado && !/Fontes/.test(r.txt), '"Por quê?" começa fechado (sem fontes à vista)');
  ok(r.bts.some(([t, hh]) => t === 'Feito' && hh >= 44) && r.bts.some(([t, hh]) => t === 'Pular' && hh >= 44), '"Feito" e "Pular" com 44 px ou mais', r.bts);
  ok(r.rol, 'sem rolagem para o lado em 360 px');
  r = await ev(`document.querySelector('#aquecimento details.pq > summary').click(); await espera(150); const t = document.getElementById('aquecimento').innerText; const rol = semRolagem(); document.querySelector('#aquecimento details.pq').open = false; return { t, rol };`);
  ok(/40%/.test(r.t) && /80%/.test(r.t) && /Ribeiro B/.test(r.t) && /Iversen VM/.test(r.t) && /não contam no histórico/.test(r.t), 'o "Por quê?" explica a aproximação e mostra as fontes', r.t.slice(0, 300));
  ok(r.rol, '"Por quê?" aberto sem rolagem para o lado');
  await page.shot('treino-guiado/inicio');

  console.log('\n== 2. Séries de aproximação ==');
  r = await ev(`const c = S.state.current; return { kg0: c.itens[0].sets[0].kg, a0: aprox(0), a1: cart(1).querySelectorAll('.aprox').length, a2: aprox(2), a3: cart(3).querySelectorAll('.aprox').length,
    sets: c.itens.map((i) => i.sets.length), hd: cart(0).querySelector('.aprox-hd').innerText };`);
  const k0 = r.kg0;
  const esperado = (p) => { const v = 20 + Math.floor((k0 * p - 20) / 2 + 1e-9) * 2; return k0 * p < 20 ? 'só com a barra' : `${String(v).replace('.', ',')} kg`; };
  ok(typeof k0 === 'number' && k0 >= 20, 'supino com carga estimada pelo perfil: ' + k0 + ' kg');
  ok(r.a0.length >= 1 && r.a0.length <= 2 && r.a0.some((x) => x.txt.includes(esperado(0.8))) && r.a0.every((x) => /^6 /.test(x.txt)), 'supino: 6 repetições a ~40% e ~80% da carga do dia', r.a0);
  ok(/APROXIMAÇÃO|Aproximação/i.test(r.hd) && /não conta no histórico/.test(r.hd), 'faixa marcada como "Aproximação · não conta no histórico"', r.hd);
  ok(r.a1 === 0, 'crucifixo (2º de peito): sem aproximação');
  ok(r.a2.length === 2 && r.a2.every((x) => /% da carga/.test(x.txt)), 'leg press sem número: aproximação em % da carga', r.a2);
  ok(r.a3 === 0, 'cadeira extensora (2º de quadríceps): sem aproximação');
  ok(J(r.sets) === J([3, 3, 3, 3]), 'as séries válidas continuam as do plano', r.sets);
  // a 360 px, o campo de carga mostra "102,5" inteiro (letra Normal e as maiores de Ajustes)
  for (const letra of ['', 'grande', 'muito']) {
    r = await ev(`if (${J(letra)}) document.documentElement.dataset.letra = ${J(letra)}; else delete document.documentElement.dataset.letra; await espera(80);
      const inp = campo(0, 'carga da série 2'); const antes = inp.value; inp.value = '102,5';
      const out = { cabe: inp.scrollWidth <= inp.clientWidth + 1, w: inp.clientWidth, sw: inp.scrollWidth, chk: Math.round(cart(0).querySelector('button.check').getBoundingClientRect().width), rol: semRolagem() };
      inp.value = antes; delete document.documentElement.dataset.letra; return out;`);
    ok(r.cabe && r.chk >= 44 && r.rol, `campo de carga com "102,5" inteiro a 360 px (letra ${letra || 'normal'}), ✓ com 44 px ou mais`, r);
  }
  // digitar a carga do leg press atualiza a aproximação sem redesenhar o cartão
  r = await ev(`digitar(campo(2, 'carga da série 1'), '100'); await espera(150); return { a2: aprox(2), kg: S.state.current.itens[2].sets[0].kg };`);
  ok(r.kg === 100 && J(r.a2.map((x) => x.txt)) === J(['6 × 40 kg', '6 × 80 kg']), 'com 100 kg na 1ª série, a aproximação vira 40 e 80 kg', r);
  r = await ev(`semToast(); cart(0).querySelector('.aprox-s').click(); await espera(200); const c = S.state.current;
    return { a0: aprox(0), rest: c.restTotal, restEnd: c.restEnd > Date.now(), sets: c.itens[0].sets.map((x) => x.ok), barra: document.querySelector('.restbar').innerText, g: guia() };`);
  ok(r.a0[0].on && !r.a0[1]?.on, 'tocar marca a 1ª aproximação', r.a0);
  ok(r.rest === 60 && r.restEnd && /DESCANSO/.test(r.barra), '1 minuto de descanso depois dela', r);
  ok(r.sets.every((x) => !x), 'nenhuma série válida foi marcada', r.sets);
  ok(r.g && r.g.aprox && Array.isArray(r.g.aprox['supino-reto-barra']), 'gravado fora do state, preso a este treino', r.g);
  await ev(`await clicar('Pular', '.restbar button'); await espera(100);`);
  await page.shot('treino-guiado/aproximacao');

  console.log('\n== 3. Recarregar a página no meio ==');
  await page.reload(1500);
  r = await ev(`await espera(300); const a = document.getElementById('aquecimento'); return { hash: location.hash, aq: !!a && !a.hidden, a0: aprox(0), a2: aprox(2), kg2: S.state.current.itens[2].sets[0].kg };`);
  ok(r.hash === '#/sessao' && r.aq, 'depois de recarregar, o treino e o aquecimento continuam', r);
  ok(r.a0[0] && r.a0[0].on, 'a aproximação já feita continua marcada', r.a0);
  ok(r.kg2 === 100 && /40 kg/.test(r.a2[0].txt), 'a carga digitada e a aproximação calculada continuam', r);
  r = await ev(`await clicar('Feito', '#aquecimento button'); await espera(150); const a = document.getElementById('aquecimento'); return { esc: !!a && a.hidden, g: guia().geral };`);
  ok(r.esc && r.g === 'feito', '"Feito" esconde o aquecimento', r);
  await page.reload(1500);
  r = await ev(`await espera(300); const a = document.getElementById('aquecimento'); return { esc: !a || a.hidden };`);
  ok(r.esc, 'e ele continua escondido depois de recarregar');
  r = await ev(`cart(2).querySelector('.aprox-pular').click(); await espera(150); return { a2: cart(2).querySelectorAll('.aprox').length, g: guia().aprox['leg-press-45'] };`);
  ok(r.a2 === 0 && r.g === 'pulado', '"Pular" tira a aproximação do leg press', r);

  console.log('\n== 4. Teste da 1ª série ("Como foi?") ==');
  r = await ev(`semToast(); const c = S.state.current; const s0 = c.itens[0].sets[0]; if (!s0.reps) digitar(campo(0, 'repetições da série 1'), '10'); else digitar(campo(0, 'repetições da série 1'), '10'); await espera(80);
    await marcar(0, 0); await espera(150);
    const t = cart(0).querySelector('.teste1');
    return { t: t ? t.innerText : '', bts: t ? [...t.querySelectorAll('.teste1-op button')].map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]) : [], aprox: cart(0).querySelectorAll('.aprox').length, rol: semRolagem(), kg: c.itens[0].sets.map((x) => x.kg) };`);
  ok(/Como foi a 1ª série\?/.test(r.t) && r.bts.length === 3, 'depois da 1ª série válida aparece "Como foi a 1ª série?" com 3 opções', r);
  ok(r.bts.every(([, hh]) => hh >= 44) && /Leve demais/.test(r.bts[0][0]) && /Na medida/.test(r.bts[1][0]) && /Pesada/.test(r.bts[2][0]), 'opções "Leve demais", "Na medida" e "Pesada", com 44 px ou mais', r.bts);
  ok(r.aprox === 0, 'a aproximação some quando a 1ª série válida é marcada');
  ok(r.rol, 'sem rolagem para o lado com a pergunta aberta');
  await ev(`await clicar('Pular', '.restbar button');`);
  await page.shot('treino-guiado/como-foi');
  await page.reload(1500);
  r = await ev(`await espera(300); return { t: !!cart(0).querySelector('.teste1') };`);
  ok(r.t, 'a pergunta continua depois de recarregar (ainda sem resposta)');
  const { cargaAjustada } = await import('../../www/js/logic/guiado.js');
  const novo = cargaAjustada('supino-reto-barra', k0, +1);
  r = await ev(`semToast(); await clicar('Leve demais', '.teste1 button'); await espera(150); const c = S.state.current; return { kg: c.itens[0].sets.map((x) => x.kg), ok: c.itens[0].sets.map((x) => x.ok), t: !!cart(0).querySelector('.teste1'), toast: toastTxt(), g: guia().teste };`);
  ok(J(r.kg) === J([k0, novo, novo]) && J(r.ok) === J([true, false, false]), `"Leve demais": as séries seguintes sobem de ${k0} para ${novo} kg (a feita não muda)`, r);
  ok(!r.t && /Próximas séries/.test(r.toast) && r.g['supino-reto-barra'] === 'leve', 'a pergunta some e o app diz a nova carga', r);
  await page.reload(1500);
  r = await ev(`await espera(300); const c = S.state.current; return { kg: c.itens[0].sets.map((x) => x.kg), t: !!cart(0).querySelector('.teste1') };`);
  ok(J(r.kg) === J([k0, novo, novo]) && !r.t, 'depois de recarregar: carga ajustada e sem a pergunta', r);
  // leg press: 5 repetições, abaixo do mínimo de 8 → propõe baixar
  r = await ev(`semToast(); digitar(campo(2, 'repetições da série 1'), '5'); await espera(80); await marcar(2, 0); await espera(150); await clicar('Pular', '.restbar button');
    const t = cart(2).querySelector('.teste1'); return { t: t ? t.innerText : '', bts: t ? [...t.querySelectorAll('button')].map((b) => b.textContent.trim()) : [] };`);
  ok(/abaixo de 8 repetições/.test(r.t) && r.bts.some((b) => /^Baixar para 90 kg/.test(b)), 'leg press com 5 repetições: "Ficou abaixo de 8" e "Baixar para 90 kg"', r);
  r = await ev(`await clicar('Baixar para 90 kg', '.teste1 button'); await espera(150); return S.state.current.itens[2].sets.map((x) => x.kg);`);
  ok(J(r) === J([100, 90, 90]), 'as séries seguintes do leg press baixam para 90 kg', r);

  console.log('\n== 5. Aparelho ocupado ==');
  r = await ev(`cart(1).querySelector('button[aria-label^="Opções: "]').click(); await espera(150); const m = [...topo().querySelectorAll('.menu-item')].map((x) => x.textContent.trim()); return m;`);
  ok(r[0] === 'Aparelho ocupado' && r[1] === 'Trocar por outro exercício', 'o menu do exercício tem "Aparelho ocupado" antes de "Trocar por outro exercício"', r);
  r = await ev(`await clicar('Aparelho ocupado', '.menu-item'); await espera(200); const f = document.getElementById('folha-ocupado');
    return { abriu: !!f, itens: f ? [...f.querySelectorAll('.list .item .t')].map((x) => x.textContent) : [], sub: f ? [...f.querySelectorAll('.list .item .grow .s')].map((x) => x.textContent) : [], lista: f ? /Ver a lista completa/.test(f.innerText) : false, rol: semRolagem(),
      noTreino: S.state.current.itens.map((i) => i.ex) };`);
  const { EX_POR_ID } = await import('../../www/js/data/exercises.js');
  const nomesNoTreino = r.noTreino.map((id) => EX_POR_ID.get(id).nome);
  ok(r.abriu && r.itens.length >= 2 && r.itens.length <= 3, 'abre a folha com 2 ou 3 alternativas', r.itens);
  ok(r.itens.every((n) => !nomesNoTreino.includes(n)) && !r.itens.includes('Crucifixo reto com halteres'), 'nenhuma alternativa já está no treino', r.itens);
  ok(r.sub.every((s) => s.length > 3), 'cada alternativa mostra os aparelhos que usa', r.sub);
  ok(r.lista && r.rol, '"Ver a lista completa" na folha, sem rolagem para o lado', r);
  await page.sleep(500); await page.shot('treino-guiado/aparelho-ocupado');
  r = await ev(`const antes = JSON.stringify({ n: S.state.current.itens[1].sets.length, alvo: S.state.current.itens[1].alvo, d: S.state.current.itens[1].descanso });
    const f = document.getElementById('folha-ocupado'); const nome = f.querySelector('.list .item .t').textContent; f.querySelector('.list .item').click(); await espera(400);
    const it = S.state.current.itens[1]; const { EX_POR_ID } = await import('/js/data/exercises.js');
    return { nome, agora: EX_POR_ID.get(it.ex).nome, depois: JSON.stringify({ n: it.sets.length, alvo: it.alvo, d: it.descanso }), antes, plano: S.state.plans[0].dias[0].itens[1].ex, varia: S.state.plans[0].variacao || null };`);
  ok(r.nome === r.agora, `um toque troca: ${r.nome}`, r);
  ok(r.antes === r.depois, 'séries, repetições e descanso continuam os mesmos', r);
  ok(r.plano === 'crucifixo-reto-halteres' && !r.varia, 'troca só de hoje: o plano não muda nem registra troca', r);
  // sem alternativa segura: avisa e oferece a lista completa
  r = await ev(`cart(3).querySelector('button[aria-label^="Opções: "]').click(); await espera(150); await clicar('Aparelho ocupado', '.menu-item'); await espera(200); const f = document.getElementById('folha-ocupado');
    return { t: f ? f.innerText : '', itens: f ? f.querySelectorAll('.list .item').length : -1, prim: f ? [...f.querySelectorAll('.btn.primary')].map((b) => b.textContent.trim()) : [] };`);
  ok(/Não achei outro exercício/.test(r.t) && r.itens === 0 && r.prim.includes('Ver a lista completa'), 'cadeira extensora: "Não achei" e "Ver a lista completa" em destaque', r);
  r = await ev(`await clicar('Ver a lista completa', '.sheet button'); await espera(300); const sh = topo().querySelector('.sheet'); const t = sh ? sh.getAttribute('aria-label') : ''; const n = sh ? sh.querySelectorAll('.list .item').length : 0; topo().querySelector('.sheet-hd button').click(); await espera(200); return { t, n };`);
  ok(/^Trocar /.test(r.t) && r.n > 0, '"Ver a lista completa" abre a lista de troca de sempre', r);

  console.log('\n== 6. Finalizar: só as séries válidas entram no histórico ==');
  r = await ev(`await clicar('Finalizar treino', '.restbar button'); await espera(200); await clicar('Finalizar', '.sheet button'); await espera(600);
    const x = S.state.sessions[S.state.sessions.length - 1]; const { recorde } = await import('/js/logic/progress.js'); const { gastoDoTreino } = await import('/js/logic/gasto.js');
    return { hash: location.hash, itens: x ? x.itens.map((i) => [i.ex, i.sets.length, i.sets.map((s) => s.kg)]) : [], rec: recorde('supino-reto-barra'), g: gastoDoTreino(x, S.state), guia: localStorage.getItem('fitcore-treino-guiado'), cur: S.state.current };`);
  ok(/historico/.test(r.hash) && J(r.itens) === J([['supino-reto-barra', 1, [k0]], ['leg-press-45', 1, [100]]]), 'o treino gravado tem só as 2 séries válidas (nenhuma aproximação)', r.itens);
  ok(r.rec && r.rec.kg === k0, 'o recorde é o da série válida, não o da aproximação', r.rec);
  ok(r.g && typeof r.g === 'object', 'o gasto do treino é calculado sobre as séries gravadas');
  ok(r.guia === null && r.cur === null, 'o estado do treino guiado é apagado ao finalizar');

  console.log('\n== 7. Perfil que não sobe carga no meio do treino (65 anos, pressão alta) ==');
  await carregar({ ...RESP, idade: 65, condicoes: ['hipertensao'] }, 'escuro');
  r = await ev(`const a = document.getElementById('aquecimento'); return { t: a ? a.innerText : '', kg: S.state.current.itens[0].sets[0].kg, ex: S.state.current.itens[0].ex };`);
  ok(/5 min de cardio leve/.test(r.t) && !/opcional/.test(r.t), 'aquecimento: o cardio leve passa a recomendado', r.t);
  r = await ev(`semToast(); const c = S.state.current; const i = 2; digitar(campo(i, 'carga da série 1'), '40'); digitar(campo(i, 'repetições da série 1'), '10'); await espera(80); await marcar(i, 0); await espera(150); await clicar('Pular', '.restbar button');
    const t = cart(i).querySelector('.teste1'); const txt = t ? t.innerText : ''; await clicar('Leve demais', '.teste1 button'); await espera(150);
    return { txt, kg: S.state.current.itens[i].sets.map((x) => x.kg), toast: toastTxt(), rol: semRolagem() };`);
  ok(/Como foi a 1ª série\?/.test(r.txt) && J(r.kg) === J([40, 40, 40]), '"Leve demais" não sobe a carga', r);
  ok(/não sobe|aos poucos/.test(r.toast), 'e diz por quê', r.toast);
  ok(r.rol, 'tema escuro em 360 px sem rolagem para o lado');
  await page.shot('treino-guiado/conservador-escuro');
  await ev(`await clicar('Descartar treino'); await espera(200); await clicar('Descartar', '.sheet button'); await espera(400);`);
  r = await ev(`return { cur: S.state.current, guia: localStorage.getItem('fitcore-treino-guiado') };`);
  ok(r.cur === null && r.guia === null, 'descartar o treino apaga o estado do treino guiado', r);

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console', erros.join(' | ').slice(0, 400));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

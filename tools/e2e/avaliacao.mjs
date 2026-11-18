// Teste de ponta a ponta da AVALIAÇÃO DO TREINO MONTADO À MÃO e do "só nesta semana": cada músculo abre ao toque com os
// exercícios que contam (inteira ou ajuda ½) e a conta explicada; no excesso, "Tirar 1 série", "Trocar" e "Remover";
// na falta, "Adicionar um exercício"; cada mudança pergunta "Só nesta semana" ou "Sempre", recalcula ali mesmo, sem a
// linha do músculo sair do lugar, e tem "Desfazer". No editor, a mudança só desta semana deixa o plano como está, aparece
// com o selo na aba Treinos, vale ao iniciar o treino e sai com "Desfazer". Letra "Muito grande", 360 px, claro e escuro.
// Fotos em .tools/shots/avaliacao/. Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/avaliacao.mjs
import * as store from '../../www/js/store.js';

const B = 'http://localhost:5173/';
const hoje = new Date();
const wd = hoje.getDay();
const item = (ex, series = 4) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
// o treino de pernas do caso do dono (tests/avaliacao.test.mjs): quadríceps 20 diretas + 8 de ajuda × ½ = 24
const PERNAS = ['agachamento-livre-barra', 'leg-press-45', 'agachamento-bulgaro-halteres', 'hack-machine', 'cadeira-extensora', 'elevacao-pelvica-barra', 'gluteo-maquina-coice', 'cadeira-abdutora', 'stiff-barra', 'mesa-flexora', 'levantamento-terra-convencional', 'elevacao-pernas-deitado'].map((x) => item(x));
const UI = { onboarded: true, installDismissedAt: new Date().toISOString(), backupEm: new Date().toISOString() };
const RESP = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };
function estado(tema) {
  const plano = { id: 'p1', nome: 'Meu treino', origem: 'manual', criadoEm: new Date(hoje.getTime() - 20 * 86400000).toISOString(), info: '', dias: [{ id: 'dp', nome: 'Pernas', foco: 'Pernas e glúteos', itens: PERNAS }], agenda: { [wd]: 'dp' } };
  return store.sanitize({ v: store.VERSAO, settings: { tema, animar: false, letra: 'muito' }, gym: { all: true, has: {} }, plans: [plano], activePlan: 'p1', ui: UI, trainer: { answers: RESP } });
}

export default async (page) => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  const falhas = [];
  const ok = (c, m, diag) => { console.log((c ? '  ✔ ' : '  ✖ ') + m + (!c && diag !== undefined ? '   → ' + JSON.stringify(diag) : '')); if (!c) falhas.push(m); };
  const importar = async (dados) => {
    await page.goto(B, 1200);
    await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados }))}); await new Promise((r) => setTimeout(r, 700));`);
  };
  const S = (expr) => page.eval(`const m = await import('/js/store.js'); const s = m.state; return (${expr});`);
  const semRolagem = () => page.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`);
  const espera = (ms) => page.sleep(ms);
  const foto = async (n) => { try { return await page.shot('avaliacao/' + n); } catch { await page.sleep(800); try { return await page.shot('avaliacao/' + n); } catch { return ''; } } };
  const M = (g) => `details[data-musc="plano:p1:${g}"]`;
  const abrir = (sel) => page.eval(`const d = document.querySelector(${JSON.stringify(sel)}); if (!d) return false; if (!d.open) { d.querySelector('summary').scrollIntoView({ block: 'center' }); d.querySelector('summary').click(); } await new Promise((r) => setTimeout(r, 200)); return d.open;`);
  const txt = (sel) => page.eval(`const d = document.querySelector(${JSON.stringify(sel)}); return d ? d.innerText.replace(/\\s+/g, ' ') : '';`);
  const topo = (sel) => page.eval(`const d = document.querySelector(${JSON.stringify(sel)}); return d ? Math.round(d.getBoundingClientRect().top) : null;`);
  const botaoEm = (sel, rot) => page.eval(`const b = [...document.querySelectorAll(${JSON.stringify(sel + ' button')})].find((x) => x.textContent.trim() === ${JSON.stringify(rot)}); if (!b) return false; b.click(); await new Promise((r) => setTimeout(r, 300)); return true;`);
  const folhaTxt = () => page.eval(`const s = [...document.querySelectorAll('.sheet')].pop(); return s ? s.innerText.replace(/\\s+/g, ' ') : '';`);
  const naFolha = (rot) => page.eval(`const s = [...document.querySelectorAll('.sheet')].pop(); if (!s) return false; const b = [...s.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(rot)} || x.textContent.includes(${JSON.stringify(rot)})); if (!b) return false; b.click(); await new Promise((r) => setTimeout(r, 350)); return true;`);
  const serieDe = (ex) => S(`(s.plans[0].dias[0].itens.find((x) => x.ex === ${JSON.stringify(ex)}) || {}).series`);

  for (const tema of ['claro', 'escuro']) {
    console.log(`\n== Tema ${tema} ==`);
    await importar(estado(tema));
    await page.goto(B + '#/treinos', 300); await page.reload(1400);
    console.log('1. Avaliação do plano: cada músculo abre com os exercícios e a conta');
    ok(await abrir('details[data-avaliacao="plano:p1"]'), 'o cartão da avaliação abre');
    ok(await abrir(M('quadriceps')), 'quadríceps abre ao toque');
    let q = await txt(M('quadriceps'));
    ok(q.includes('20 séries diretas + 8 de ajuda × ½ = 24'), 'a conta explicada: 20 diretas + 8 de ajuda × ½ = 24', q.slice(0, 160));
    ok(/CONTA INTEIRA/i.test(q) && /AJUDA \(CONTA ½\)/i.test(q) && q.includes('Leg press 45°') && q.includes('Elevação pélvica com barra') && q.includes('4 × ½ = 2'), 'lista os exercícios: inteiros e de ajuda (4 × ½ = 2)');
    ok(!q.includes('Abdominal infra'), 'o abdominal infra não conta para o quadríceps');
    ok(/Passa do máximo do seu nível: 20 séries diretas \(o máximo é 16\)/.test(q), 'diz que passa do máximo e qual é', q.slice(0, 260));
    ok(await page.eval(`return [...document.querySelectorAll('${M('quadriceps')} .musc-ex[data-ex="leg-press-45"] button')].map((b) => b.textContent.trim()).join('|') === 'Tirar 1 série|Trocar|Remover';`), 'o exercício que pesa tem "Tirar 1 série", "Trocar" e "Remover"');
    ok(await page.eval(`return ![...document.querySelectorAll('${M('quadriceps')} .musc-ex[data-ex="elevacao-pelvica-barra"] button')].length;`), 'o de ajuda não ganha botões quando o excesso é das diretas');
    ok(await semRolagem(), 'sem rolagem para o lado em 360 px (letra muito grande)');
    await foto(`1-quadriceps-${tema}`);

    console.log('2. Tirar 1 série: pergunta "Só nesta semana" ou "Sempre", recalcula ali mesmo e tem "Desfazer"');
    const y0 = await topo(M('quadriceps'));
    ok(await botaoEm(`${M('quadriceps')} .musc-ex[data-ex="leg-press-45"]`, 'Tirar 1 série'), 'toca em "Tirar 1 série"');
    const f = await folhaTxt();
    ok(/Esta mudança vale para/.test(f) && /Só nesta semana/.test(f) && /Sempre/.test(f), 'a pergunta tem 2 botões: "Só nesta semana" e "Sempre"', f);
    await foto(`2-pergunta-${tema}`);
    ok(await naFolha('Sempre'), 'escolhe "Sempre"');
    await espera(250);
    ok((await serieDe('leg-press-45')) === 3, 'o plano ficou com 3 séries no leg press');
    q = await txt(M('quadriceps'));
    ok(await page.eval(`return document.querySelector(${JSON.stringify(M('quadriceps'))}).open;`), 'o músculo continua aberto');
    ok(q.includes('19 séries diretas + 8 de ajuda × ½ = 23'), 'a conta já recalculou: 19 + 8 × ½ = 23', q.slice(0, 200));
    ok(q.includes('Tirou 1 série de Leg press 45°.') && q.includes('Desfazer'), 'mostra o que mudou, com "Desfazer"');
    const y1 = await topo(M('quadriceps'));
    ok(y0 != null && y1 != null && Math.abs(y1 - y0) <= 2, 'a linha do músculo não saiu do lugar', { y0, y1 });
    await foto(`3-depois-${tema}`);
    ok(await botaoEm(M('quadriceps') + ' .musc-feito', 'Desfazer'), 'toca em "Desfazer"');
    ok((await serieDe('leg-press-45')) === 4, 'voltaram as 4 séries');
    ok((await txt(M('quadriceps'))).includes('20 séries diretas + 8 de ajuda × ½ = 24'), 'a conta voltou');

    console.log('3. Trocar e Remover');
    ok(await botaoEm(`${M('quadriceps')} .musc-ex[data-ex="leg-press-45"]`, 'Trocar'), 'toca em "Trocar"');
    const ft = await folhaTxt();
    ok(/Trocar Leg press 45°/.test(ft) && /Por um que não pesa em quadríceps/.test(ft) && /Trabalha glúteos/.test(ft), 'a folha mostra trocas que tiram o peso do quadríceps e mantêm o glúteo', ft.slice(0, 200));
    await foto(`4-trocar-${tema}`);
    const escolhido = await page.eval(`const s = [...document.querySelectorAll('.sheet')].pop(); const b = s.querySelector('.list .item'); const t = b.querySelector('.t').textContent; b.click(); await new Promise((r) => setTimeout(r, 400)); return t;`);
    ok(!(await S(`s.plans[0].dias[0].itens.some((x) => x.ex === 'leg-press-45')`)) && (await S(`s.plans[0].dias[0].itens.length`)) === 12, `trocou o leg press por ${escolhido} (a resposta "Sempre" valeu para a tela)`);
    ok((await txt(M('quadriceps'))).includes('16 séries diretas'), 'o quadríceps recalculou: 16 diretas');
    ok(await botaoEm(M('quadriceps') + ' .musc-feito', 'Desfazer'), 'desfaz a troca');
    ok(await S(`s.plans[0].dias[0].itens.some((x) => x.ex === 'leg-press-45')`), 'o leg press voltou');
    ok(await botaoEm(`${M('quadriceps')} .musc-ex[data-ex="hack-machine"]`, 'Remover'), 'toca em "Remover"');
    ok(!(await S(`s.plans[0].dias[0].itens.some((x) => x.ex === 'hack-machine')`)), 'o hack saiu do treino');
    ok(await botaoEm(M('quadriceps') + ' .musc-feito', 'Desfazer'), 'desfaz a remoção');
    ok(await S(`s.plans[0].dias[0].itens.some((x) => x.ex === 'hack-machine')`), 'o hack voltou');

    console.log('4. Músculo em falta: "Adicionar um exercício"');
    ok(await abrir(M('peito')), 'peito abre');
    const p = await txt(M('peito'));
    ok(/Nenhum exercício conta para peito/.test(p) && /ADICIONAR UM EXERCÍCIO PARA PEITO/i.test(p), 'diz que falta e oferece exercícios', p);
    const sug = await page.eval(`return [...document.querySelectorAll('${M('peito')} .musc-acoes button')].map((b) => b.textContent.trim());`);
    ok(sug.length >= 2 && sug.length <= 3 && sug.every((x) => x.startsWith('+ ')), '2 ou 3 sugestões, botões curtos', sug);
    await foto(`5-falta-${tema}`);
    ok(await botaoEm(M('peito'), sug[0]), 'toca na primeira sugestão');
    await espera(200);
    ok((await S(`s.plans[0].dias[0].itens.length`)) === 13, 'o exercício entrou no treino (sem perguntar de novo: "Sempre" vale para a tela)');
    ok(!(await txt(M('peito'))).includes('Nenhum exercício conta'), 'o peito recalculou');
    ok(await botaoEm(M('peito') + ' .musc-feito', 'Desfazer'), 'desfaz');
    ok((await S(`s.plans[0].dias[0].itens.length`)) === 12, 'saiu');

    console.log('5. Editor do treino: "Só nesta semana"');
    await page.goto(B + '#/treino/p1/dp', 700);
    await page.eval(`const sel = document.querySelector('main .card select[aria-label="Séries"]'); sel.value = '2'; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 400)); return true;`);
    ok(/Esta mudança vale para/.test(await folhaTxt()), 'mudar as séries pergunta para quando vale');
    ok(await naFolha('Só nesta semana'), 'escolhe "Só nesta semana"');
    await espera(300);
    ok((await serieDe('agachamento-livre-barra')) === 4, 'o plano de sempre não mudou');
    ok((await S(`s.ajustesSemana.length`)) === 1 && (await S(`s.ajustesSemana[0].itens[0].series`)) === 2, 'a versão desta semana ficou guardada com 2 séries');
    const ed = await page.text();
    ok(/Só nesta semana/.test(ed) && /volta o de sempre/.test(ed), 'o editor mostra o selo "Só nesta semana"');
    ok((await page.eval(`return document.querySelector('main .card select[aria-label="Séries"]').value;`)) === '2', 'o editor mostra a versão da semana');
    await foto(`6-editor-semana-${tema}`);
    await page.goto(B + '#/treinos', 600);
    ok(await page.eval(`return !!document.querySelector('.card.dia[data-wd="${wd}"] [data-selo-semana="dp"]');`), 'na aba Treinos, o dia mostra o selo com "Desfazer"');
    await page.eval(`document.querySelector('.card.dia[data-wd="${wd}"]').scrollIntoView({ block: 'center' }); return 1;`);
    await foto(`7-semana-selo-${tema}`);
    // ao iniciar o treino de hoje, vale a versão da semana
    await page.eval(`const s = await import('/js/views/session.js'); await s.startSession('p1', 'dp'); await new Promise((r) => setTimeout(r, 500)); return 1;`);
    ok((await S(`s.current && s.current.itens[0].sets.length`)) === 2, 'o treino iniciado hoje usa a versão da semana (2 séries)');
    await page.eval(`const m = await import('/js/store.js'); m.update((s) => { s.current = null; }); location.hash = '#/treinos'; await new Promise((r) => setTimeout(r, 600)); return 1;`);
    ok(await botaoEm(`.card.dia[data-wd="${wd}"] [data-selo-semana="dp"]`, 'Desfazer'), '"Desfazer" no selo');
    ok((await S(`s.ajustesSemana.length`)) === 0, 'voltou o treino de sempre');
    ok(await semRolagem(), 'sem rolagem para o lado');
  }
  // a versão da semana sobrevive ao backup e some na semana seguinte (logic/ajuste-semana.js, limparAjustesSemana)
  const bk = await page.eval(`const m = await import('/js/store.js'); const { ajustarSemana } = await import('/js/logic/ajuste-semana.js'); const { dateKey } = await import('/js/ui.js');
    m.update((s) => { ajustarSemana(s, { planId: 'p1', diaId: 'dp', data: dateKey(new Date()), itens: [{ ex: 'mesa-flexora', series: 2, reps: '10', descanso: 60 }] }); });
    const r = m.readBackup(m.exportData()); return r.dados.ajustesSemana.length;`);
  ok(bk === 1, 'o backup leva a versão da semana');
  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTudo certo.');
  if (falhas.length) throw new Error(falhas.join('; '));
};

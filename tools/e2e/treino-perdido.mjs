// Teste de ponta a ponta do "Não treinei": a folha com a proposta (passar o treino para outro dia ou seguir a semana), o dia
// marcado como "Não treinado", o dia que recebeu o treino com a marca "Movido", o "Desfazer", o Início, os temas claro e
// escuro em 360 px e o backup. Deixa fotos em .tools/shots/treino-perdido/.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/treino-perdido.mjs
import * as store from '../../www/js/store.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = new Date();
const wd = hoje.getDay();
const item = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
const FULL = [item('flexao-de-bracos'), item('barra-fixa-pronada'), item('agachamento-peso-corporal'), item('flexao-nordica')];

// dois treinos de corpo inteiro: o A hoje e o B três dias depois (os dois de corpo inteiro: 48 horas entre eles)
function estado(tema) {
  const agenda = { [wd]: 'da', [(wd + 3) % 7]: 'db' };
  const plano = { id: 'p1', nome: 'Corpo inteiro', origem: 'manual', criadoEm: new Date(hoje.getTime() - 20 * 86400000).toISOString(), info: '',
    dias: [{ id: 'da', nome: 'Treino A', foco: 'Corpo inteiro', itens: FULL }, { id: 'db', nome: 'Treino B', foco: 'Corpo inteiro', itens: FULL }], agenda };
  return store.sanitize({ v: store.VERSAO, settings: { tema, animar: false }, gym: { all: true, has: {} }, plans: [plano], activePlan: 'p1', ui: { onboarded: true, installDismissedAt: new Date().toISOString(), backupEm: new Date().toISOString() } });
}

export default async (page) => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  const carregar = async (tema) => {
    await page.goto(B, 1200);
    await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados: estado(tema) }))}); await new Promise((r) => setTimeout(r, 700));`);
  };
  const st = () => page.eval(`const m = await import('/js/store.js'); return JSON.stringify(m.state.perdidos);`).then(JSON.parse);
  const semRolagem = () => page.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`);
  const espera = (sel) => page.eval(`for (let i = 0; i < 30 && !document.querySelector(${JSON.stringify(sel)}); i++) await new Promise((r) => setTimeout(r, 100)); return !!document.querySelector(${JSON.stringify(sel)});`);
  const altura = (sel, txt) => page.eval(`const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent.trim() === ${JSON.stringify(txt)}); return b ? Math.round(b.getBoundingClientRect().height) : 0;`);
  const cartaoHoje = `.card.dia[data-wd="${wd}"]`;

  for (const tema of ['claro', 'escuro']) {
    console.log(`\n== Tema ${tema} ==`);
    await carregar(tema);
    await page.goto(B + '#/treinos', 300); await page.reload(1400);
    console.log('1. Aba Treinos: o botão discreto no dia de hoje');
    const temBotao = await page.eval(`const c = document.querySelector('${cartaoHoje}'); return !!c && [...c.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Não treinei');`);
    ok(temBotao, '"Não treinei" no cartão de hoje');
    ok((await altura(`${cartaoHoje} button`, 'Não treinei')) >= 44, 'o botão tem 44 px ou mais');
    ok(await page.eval(`return [...document.querySelectorAll('.card.dia:not([data-wd="${wd}"]) button')].every((b) => b.textContent.trim() !== 'Não treinei');`), 'dias futuros não têm o botão');
    await page.eval(`const b = [...document.querySelectorAll('${cartaoHoje} button')].find((x) => x.textContent.trim() === 'Não treinei'); b.scrollIntoView({ block: 'center' }); b.click();`);
    ok(await espera('#folha-nao-treinei'), 'a folha abriu');
    const folha = await page.eval(`return document.querySelector('.sheet').innerText;`);
    const move = /Passar o Treino A para/.test(folha);
    ok(move || /Seguir a semana\?/.test(folha), 'a folha traz a proposta: ' + folha.split('\n').slice(0, 3).join(' / '));
    ok(/Por quê\?/.test(folha) && !/FONTES/.test(folha), '"Por quê?" começa fechado');
    await page.eval(`document.querySelector('.sheet details.pq > summary').click(); await new Promise((r) => setTimeout(r, 200));`);
    const aberto = await page.eval(`return document.querySelector('.sheet').innerText;`);
    ok(/48 horas/.test(aberto) && /Garber CE/.test(aberto) && /Pelland JC/.test(aberto), 'o "Por quê?" explica e mostra as fontes');
    ok((await altura('.sheet button', move ? (await page.eval(`return [...document.querySelectorAll('.sheet button')].find((x) => /^Passar para/.test(x.textContent.trim())).textContent.trim();`)) : 'Seguir a semana')) >= 44, 'botão principal com 44 px ou mais');
    ok(await semRolagem(), 'sem rolagem para o lado em 360 px');
    await page.eval(`document.querySelector('.sheet details.pq').open = false; await new Promise((r) => setTimeout(r, 150));`);
    await page.shot(`treino-perdido/folha-nao-treinei-${tema}`);
    if (tema === 'claro') await page.shot('treino-perdido/folha-nao-treinei');

    console.log('2. Escolher: o dia fica "Não treinado" e o outro recebe o treino');
    const rotulo = move ? await page.eval(`return [...document.querySelectorAll('.sheet button')].find((x) => /^Passar para/.test(x.textContent.trim())).textContent.trim();`) : 'Seguir a semana';
    await page.click(rotulo, '.sheet button');
    await page.sleep(700);
    const p = await st();
    ok(p.length === 1 && p[0].tipo === 'musculacao' && p[0].diaId === 'da' && p[0].data === dk(hoje), 'marca gravada: ' + JSON.stringify(p));
    ok(await page.eval(`const c = document.querySelector('${cartaoHoje}'); return !!c && /Não treinado/.test(c.innerText) && [...c.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Desfazer');`), 'hoje: "Não treinado", com "Desfazer"');
    if (move) {
      const para = p[0].movs[0].para;
      ok(p[0].movs.length >= 1 && para > dk(hoje), 'o treino foi para um dia depois de hoje: ' + para);
      const temMovido = await page.eval(`const t = document.querySelector('[data-treino="da"][data-movido]'); if (!t) return false; t.closest('.card').scrollIntoView({ block: 'center' }); return /Movido/.test(t.innerText) && /Veio de hoje/.test(t.innerText);`);
      ok(temMovido, 'o dia que recebeu mostra "Movido" e de onde veio');
      ok(await semRolagem(), 'sem rolagem para o lado');
      await page.sleep(2700); // o aviso ("Treino A passou para...") some antes da foto
      await page.shot(`treino-perdido/dia-movido-${tema}`);
      if (tema === 'claro') await page.shot('treino-perdido/dia-movido');
      await page.eval(`document.querySelector('${cartaoHoje}').scrollIntoView({ block: 'center' });`); await page.sleep(150);
      await page.shot(`treino-perdido/dia-nao-treinado-${tema}`);
    } else ok(p[0].movs.length === 0, 'seguir a semana: o treino não mudou de dia');

    console.log('3. Início: o treino de hoje aparece como não treinado; desfazer volta ao normal');
    await page.goto(B + '#/', 900);
    ok(await espera('#inicio-nao-treinado'), 'Início mostra o treino de hoje como não treinado');
    ok(await page.click('Desfazer', '#inicio-nao-treinado button'), 'tocou em Desfazer');
    await page.sleep(500);
    ok((await st()).length === 0, 'marca desfeita');
    ok(await page.eval(`return [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Iniciar treino') && [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Não treinei');`), 'o treino de hoje voltou, com "Iniciar treino" e "Não treinei"');

    console.log('4. Pelo Início, "Seguir a semana"');
    ok(await page.click('Não treinei', 'button'), 'tocou em "Não treinei" no Início');
    ok(await espera('#folha-nao-treinei'), 'a folha abriu');
    ok(await page.click('Seguir a semana', '.sheet button'), 'escolheu seguir a semana');
    await page.sleep(500);
    const q = await st();
    ok(q.length === 1 && q[0].movs.length === 0, 'marca sem mudança de dia');
    ok(/Volta n[ao] próxim[ao]/.test(await page.eval(`return document.querySelector('#inicio-nao-treinado').innerText;`)), 'Início diz quando o treino volta');
    ok(await semRolagem(), 'sem rolagem para o lado no Início');

    console.log('5. Backup e recarga');
    const volta = await page.eval(`const m = await import('/js/store.js'); return JSON.stringify(m.readBackup(m.exportData()).dados.perdidos);`).then(JSON.parse);
    ok(JSON.stringify(volta) === JSON.stringify(q), 'a marca sai no backup e volta igual');
    await page.reload(1400);
    ok((await st()).length === 1 && await espera('#inicio-nao-treinado'), 'persistiu depois de recarregar');
  }
  console.log('\n6. Corrida: "Não corri" fica registrado e não inventa corrida');
  {
    const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
    const corrida = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: [String(wd), String((wd + 3) % 7)], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
    const { PERGUNTAS } = await import('../../www/js/logic/corrida.js');
    for (const q of PERGUNTAS) if (!(q.k in corrida) && !(q.se && !q.se(corrida)) && !q.opcional) corrida[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
    const dados = store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, run: { answers: corrida, aceitoEm: new Date(seg.getTime() - 7 * 86400000).toISOString(), inicio: dk(new Date(seg.getTime() - 7 * 86400000)), pausadoEm: '' }, ui: { onboarded: true, installDismissedAt: new Date().toISOString(), backupEm: new Date().toISOString() } });
    await page.goto(B, 1000);
    await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados }))}); await new Promise((r) => setTimeout(r, 700));`);
    await page.goto(B + '#/treinos', 300); await page.reload(1400);
    const tem = await page.eval(`const c = document.querySelector('${cartaoHoje}'); return !!c && [...c.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Não corri');`);
    if (!tem) console.log('  (o plano de corrida não pôs treino hoje: passo pulado)');
    else {
      ok((await altura(`${cartaoHoje} button`, 'Não corri')) >= 44, '"Não corri" com 44 px ou mais');
      await page.eval(`const b = [...document.querySelectorAll('${cartaoHoje} button')].find((x) => x.textContent.trim() === 'Não corri'); b.scrollIntoView({ block: 'center' }); b.click();`);
      ok(await espera('#folha-nao-corri'), 'a folha abriu');
      ok(/não se repõe/.test(await page.eval(`return document.querySelector('.sheet').innerText;`)), 'a folha diz que corrida perdida não se repõe');
      await page.click('Marcar como não feita', '.sheet button'); await page.sleep(600);
      const r = await page.eval(`const m = await import('/js/store.js'); return JSON.stringify({ p: m.state.perdidos, runs: m.state.runs.length });`).then(JSON.parse);
      ok(r.p.length === 1 && r.p[0].tipo === 'corrida' && r.p[0].data === dk(hoje) && r.runs === 0, 'marca gravada, sem corrida inventada: ' + JSON.stringify(r));
      ok(await page.eval(`return /Não feita/.test(document.querySelector('${cartaoHoje}').innerText);`), 'o dia mostra a corrida como não feita');
      await page.click('Desfazer', `${cartaoHoje} button`); await page.sleep(500);
      ok((await st()).length === 0, 'desfeito');
    }
  }
  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

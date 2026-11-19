// Teste de ponta a ponta do "Não treinei" e do "Não corri": a folha pergunta o motivo, mostra a proposta do treinador
// (passar para amanhã ou outro dia desta semana, ou não repor), a semana como fica, grava a marca com o motivo; o dia
// marcado mostra o motivo e o "Desfazer"; o treino de amanhã muda de ordem quando precisa; amanhã sem treino (dia livre)
// diz por quê; a corrida muda de dia na aba Treinos, na tela da Corrida e no Início. Temas claro e escuro em 360 px e o
// backup. Deixa fotos em .tools/shots/treino-perdido/.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/treino-perdido.mjs
import * as store from '../../www/js/store.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = new Date();
const wd = hoje.getDay();
const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
const temAmanha = wd !== 0; // domingo: amanhã já é outra semana
const item = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
const FULL = [item('flexao-de-bracos'), item('barra-fixa-pronada'), item('agachamento-peso-corporal'), item('flexao-nordica')];
const UI = { onboarded: true, installDismissedAt: new Date().toISOString(), backupEm: new Date().toISOString() };

// dois treinos de corpo inteiro; `dB` = quantos dias depois de hoje fica o B; `semTreino` = dias em que não treina
function estado(tema, { dB = 3, semTreino = null } = {}) {
  const agenda = { [wd]: 'da', [(wd + dB) % 7]: 'db' };
  const plano = { id: 'p1', nome: 'Corpo inteiro', origem: 'manual', criadoEm: new Date(hoje.getTime() - 20 * 86400000).toISOString(), info: '',
    dias: [{ id: 'da', nome: 'Treino A', foco: 'Corpo inteiro', itens: FULL }, { id: 'db', nome: 'Treino B', foco: 'Corpo inteiro', itens: FULL }], agenda };
  const extra = semTreino ? { trainer: { answers: { semTreino } } } : {};
  return store.sanitize({ v: store.VERSAO, settings: { tema, animar: false }, gym: { all: true, has: {} }, plans: [plano], activePlan: 'p1', ui: UI, ...extra });
}

export default async (page) => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  const importar = async (dados) => {
    await page.goto(B, 1200);
    await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados }))}); await new Promise((r) => setTimeout(r, 700));`);
  };
  const st = () => page.eval(`const m = await import('/js/store.js'); return JSON.stringify(m.state.perdidos);`).then(JSON.parse);
  const semRolagem = () => page.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`);
  const espera = (sel) => page.eval(`for (let i = 0; i < 30 && !document.querySelector(${JSON.stringify(sel)}); i++) await new Promise((r) => setTimeout(r, 100)); return !!document.querySelector(${JSON.stringify(sel)});`);
  const altura = (sel) => page.eval(`const b = document.querySelector(${JSON.stringify(sel)}); return b ? Math.round(b.getBoundingClientRect().height) : 0;`);
  const folhaTxt = () => page.eval(`const s = document.querySelector('.sheet'); return s ? s.innerText : '';`);
  const motivo = (k) => page.eval(`const b = document.querySelector('.sheet [data-motivo="${k}"]'); if (!b) return false; b.click(); await new Promise((r) => setTimeout(r, 250)); return true;`);
  const botaoFolha = (re) => page.eval(`const b = [...document.querySelectorAll('.sheet .btn')].find((x) => ${re}.test(x.textContent.trim())); if (!b) return ''; return b.textContent.trim();`);
  const cartaoHoje = `.card.dia[data-wd="${wd}"]`;
  // foto: se o navegador demorar a desenhar, tenta de novo uma vez (a foto não decide o teste)
  const foto = async (n) => { try { return await page.shot(n); } catch (e) { console.log('  (foto ' + n + ' falhou: ' + e.message.slice(0, 60) + '; de novo)'); await page.sleep(1000); try { return await page.shot(n); } catch { return ''; } } };
  const abrirNoCartao = async (txt) => page.eval(`const b = [...document.querySelectorAll('${cartaoHoje} button')].find((x) => x.textContent.trim() === ${JSON.stringify(txt)}); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); await new Promise((r) => setTimeout(r, 300)); return true;`);

  for (const tema of ['claro', 'escuro']) {
    console.log(`\n== Tema ${tema} ==`);
    await importar(estado(tema));
    await page.goto(B + '#/treinos', 300); await page.reload(1400);
    console.log('1. Aba Treinos: "Não treinei" pergunta o motivo');
    const aberto1 = await abrirNoCartao('Não treinei');
    ok(aberto1, '"Não treinei" no cartão de hoje' + (aberto1 ? '' : ': ' + await page.eval(`const m = await import('/js/store.js'); return JSON.stringify(m.state.perdidos) + ' | ' + location.hash + ' | ' + ((document.querySelector('${cartaoHoje}') || {}).innerText || 'sem cartão') + ' | folhas ' + document.querySelectorAll('.sheet').length;`)));
    ok(await espera('#folha-nao-treinei'), 'a folha abriu');
    let f = await folhaTxt();
    ok(/O que aconteceu\?/.test(f) && /Sem tempo/.test(f) && /Cansaço ou dormi mal/.test(f) && /Doente ou machucado/.test(f) && /Viagem/.test(f), 'a folha pergunta o motivo, com botões curtos');
    ok((await altura('.sheet [data-motivo="tempo"]')) >= 44, 'botão do motivo com 44 px ou mais');
    ok(await semRolagem(), 'sem rolagem para o lado em 360 px');
    await foto(`treino-perdido/motivo-${tema}`);

    console.log('2. "Sem tempo": o treinador propõe passar para outro dia e mostra a semana');
    ok(await motivo('tempo'), 'escolheu "Sem tempo"');
    f = await folhaTxt();
    ok(/Motivo: Sem tempo/.test(f), 'o motivo aparece, com "Trocar"');
    ok(/Por quê\?/.test(f) && !/FONTES/.test(f), '"Por quê?" começa fechado');
    const passar = await botaoFolha('/^Passar para/');
    if (temAmanha) {
      ok(passar === 'Passar para amanhã', 'botão principal: ' + passar);
      ok(/Passar o Treino A para amanhã\?/.test(f), 'a pergunta diz o dia');
      ok(/Como fica: amanhã Treino A/.test(f), 'a semana em uma linha: ' + (f.match(/Como fica:.*$/m) || [''])[0]);
      ok(await page.eval(`return !!document.querySelector('.sheet .chip[data-dia="${dk(amanha)}"].on');`), 'o dia escolhido aparece marcado');
      ok((await altura('.sheet .chip[data-dia]')) >= 44, 'botão do dia com 44 px ou mais');
    } else ok(/Seguir a semana/.test(f), 'domingo: sem outro dia nesta semana');
    await page.eval(`document.querySelector('.sheet details.pq > summary').click(); await new Promise((r) => setTimeout(r, 200));`);
    const aberto = await folhaTxt();
    ok(/48 horas/.test(aberto) && /Garber CE/.test(aberto) && /Pelland JC/.test(aberto), 'o "Por quê?" explica e mostra as fontes');
    await page.eval(`document.querySelector('.sheet details.pq').open = false; await new Promise((r) => setTimeout(r, 150));`);
    ok(await semRolagem(), 'sem rolagem para o lado');
    await foto(`treino-perdido/proposta-${tema}`);

    console.log('3. Confirmar: o dia fica "Não treinado" com o motivo, e amanhã recebe o treino');
    if (passar) await page.click(passar, '.sheet button'); else await page.click('Seguir a semana', '.sheet button');
    await page.sleep(700);
    let p = await st();
    ok(p.length === 1 && p[0].tipo === 'musculacao' && p[0].diaId === 'da' && p[0].data === dk(hoje) && p[0].motivo === 'tempo', 'marca gravada com o motivo: ' + JSON.stringify(p));
    const linha = await page.eval(`const c = document.querySelector('${cartaoHoje}'); return c ? c.innerText : '';`);
    ok(/Não treinado/.test(linha) && /Sem tempo/.test(linha) && /Desfazer/.test(linha), 'hoje: "Não treinado", o motivo e "Desfazer"');
    if (passar && temAmanha) {
      ok(p[0].movs[0].para === dk(amanha), 'o treino foi para amanhã');
      ok(/Passou para amanhã/.test(linha), 'a linha diz para onde foi');
      ok(await page.eval(`const t = document.querySelector('[data-treino="da"][data-movido]'); return !!t && /Movido/.test(t.innerText) && /Veio de hoje/.test(t.innerText);`), 'amanhã mostra "Movido" e de onde veio');
      await page.sleep(2700);
      await page.eval(`document.querySelector('${cartaoHoje}').scrollIntoView({ block: 'center' });`); await page.sleep(150);
      await foto(`treino-perdido/dia-nao-treinado-${tema}`);
    }

    console.log('4. Início: o treino de hoje aparece como não treinado; desfazer volta ao normal');
    await page.goto(B + '#/', 900);
    ok(await espera('#inicio-nao-treinado'), 'Início mostra o treino de hoje como não treinado');
    ok(/Sem tempo/.test(await page.eval(`return document.querySelector('#inicio-nao-treinado').innerText;`)), 'Início mostra o motivo');
    ok(await page.click('Desfazer', '#inicio-nao-treinado button'), 'tocou em Desfazer');
    await page.sleep(500);
    ok((await st()).length === 0, 'marca desfeita');
    ok(await page.eval(`return [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Iniciar treino') && !!document.getElementById('inicio-musculacao');`), 'o treino de hoje voltou ao resumo do Início, com "Iniciar treino"');

    console.log('5. Na aba Treinos, "Cansaço": o treinador propõe não repor (o cartão completo do dia fica lá)');
    await page.click('Musculação: Treino A'); await page.sleep(700);
    ok(await page.click('Não treinei', '.card.dia.hl button'), 'tocou em "Não treinei" no cartão de hoje');
    ok(await espera('#folha-nao-treinei'), 'a folha abriu');
    ok(await motivo('cansaco'), 'escolheu "Cansaço ou dormi mal"');
    f = await folhaTxt();
    ok(/Não precisa repor o Treino A\./.test(f) && /não precisa repor/.test(f), 'com cansaço, a proposta é não repor: ' + f.split('\n').slice(0, 4).join(' / '));
    ok((await botaoFolha('/^Não repor: seguir a semana$/')) || (await botaoFolha('/^Seguir a semana$/')), 'botão de seguir a semana');
    ok(!(await botaoFolha('/^Passar para/')), 'nenhum dia escolhido de saída');
    if (tema === 'claro') await foto('treino-perdido/cansaco');
    await page.click((await botaoFolha('/^Não repor: seguir a semana$/')) || 'Seguir a semana', '.sheet button');
    await page.sleep(500);
    const q = await st();
    ok(q.length === 1 && q[0].movs.length === 0 && q[0].motivo === 'cansaco', 'marca sem mudança de dia, com o motivo');
    await page.goto(B + '#/', 900); await espera('#inicio-nao-treinado');
    ok(/Cansaço · Volta n[ao] próxim[ao]/.test(await page.eval(`return document.querySelector('#inicio-nao-treinado').innerText;`)), 'Início diz o motivo e quando o treino volta');
    ok(await semRolagem(), 'sem rolagem para o lado no Início');

    console.log('6. Backup e recarga');
    const volta = await page.eval(`const m = await import('/js/store.js'); return JSON.stringify(m.readBackup(m.exportData()).dados.perdidos);`).then(JSON.parse);
    ok(JSON.stringify(volta) === JSON.stringify(q), 'a marca (com o motivo) sai no backup e volta igual');
    await page.reload(1400);
    ok((await st()).length === 1 && await espera('#inicio-nao-treinado'), 'persistiu depois de recarregar');
  }

  if (temAmanha && wd !== 6) {
    console.log('\n7. Amanhã já tem treino: passar para amanhã troca a ordem (o de amanhã anda)');
    await importar(estado('claro', { dB: 1 }));
    await page.goto(B + '#/treinos', 300); await page.reload(1400);
    await abrirNoCartao('Não treinei'); await espera('#folha-nao-treinei');
    await motivo('viagem');
    const tem = await page.eval(`const c = document.querySelector('.sheet .chip[data-dia="${dk(amanha)}"]'); if (!c) return false; c.click(); await new Promise((r) => setTimeout(r, 250)); return true;`);
    const f = await folhaTxt();
    if (tem) {
      ok(/o Treino B vai para/.test(f), 'o Treino B anda junto: ' + (f.match(/Para manter.*$/m) || [''])[0]);
      ok(/Como fica: amanhã Treino A · \S+ Treino B/.test(f), 'a semana mostra a nova ordem: ' + (f.match(/Como fica:.*$/m) || [''])[0]);
      await foto('treino-perdido/troca-ordem');
      await page.click('Passar para amanhã', '.sheet button'); await page.sleep(600);
      const p = await st();
      ok(p.length === 1 && p[0].movs.length === 2 && p[0].motivo === 'viagem', 'marca com as duas mudanças: ' + JSON.stringify(p[0].movs));
    } else ok(/Treino B/.test(f) && /48 horas/.test(f), 'amanhã não dá e a folha explica: ' + f.slice(0, 200));
  }

  if (temAmanha) {
    console.log('\n8. Amanhã é dia sem treino: a folha diz por quê e propõe outro dia');
    await importar(estado('claro', { semTreino: [String(amanha.getDay())] }));
    await page.goto(B + '#/treinos', 300); await page.reload(1400);
    await abrirNoCartao('Não treinei'); await espera('#folha-nao-treinei');
    await motivo('tempo');
    const f = await folhaTxt();
    const dias = await page.eval(`return [...document.querySelectorAll('.sheet .chip[data-dia]')].map((c) => c.dataset.dia);`);
    ok(!dias.includes(dk(amanha)), 'amanhã não aparece como opção');
    if (dias.length) ok(/Amanhã é um dia em que você não treina\./.test(f), 'a folha explica por que não amanhã');
    await foto('treino-perdido/amanha-livre');
    await page.click('Cancelar', '.sheet button'); await page.eval(`document.querySelector('.sheet .iconbtn') && document.querySelector('.sheet .iconbtn').click();`);
  }

  console.log('\n9. Corrida: "Não corri" pergunta o motivo e passa a corrida para outro dia');
  {
    const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
    const corrida = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: [String(wd), String((wd + 3) % 7)], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
    const { PERGUNTAS } = await import('../../www/js/logic/corrida.js');
    for (const q of PERGUNTAS) if (!(q.k in corrida) && !(q.se && !q.se(corrida)) && !q.opcional) corrida[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
    const dados = store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, run: { answers: corrida, aceitoEm: new Date(seg.getTime() - 7 * 86400000).toISOString(), inicio: dk(new Date(seg.getTime() - 7 * 86400000)), pausadoEm: '' }, ui: UI });
    await importar(dados);
    await page.goto(B + '#/treinos', 300); await page.reload(1400);
    if (!(await abrirNoCartao('Não corri'))) console.log('  (o plano de corrida não pôs treino hoje: passo pulado)');
    else {
      ok(await espera('#folha-nao-corri'), 'a folha abriu');
      let f = await folhaTxt();
      ok(/O que aconteceu\?/.test(f) && /Chuva/.test(f), 'pergunta o motivo (com "Chuva")');
      await motivo('tempo');
      f = await folhaTxt();
      const passar = await botaoFolha('/^Passar para/');
      if (passar) {
        ok(/Como fica:/.test(f), 'a semana em uma linha: ' + (f.match(/Como fica:.*$/m) || [''])[0]);
        await foto('treino-perdido/corrida-proposta');
        await page.click(passar, '.sheet button'); await page.sleep(700);
        const p = await st();
        ok(p.length === 1 && p[0].tipo === 'corrida' && p[0].data === dk(hoje) && !!p[0].para && p[0].motivo === 'tempo', 'marca da corrida com o dia novo e o motivo: ' + JSON.stringify(p));
        ok(/Mudou de dia/.test(await page.eval(`return document.querySelector('${cartaoHoje}').innerText;`)), 'hoje: "Mudou de dia"');
        await page.goto(B + '#/corrida', 1200);
        const c = await page.eval(`const e = document.querySelector('#corrida-hoje'); return e ? e.innerText : '';`);
        ok(/Mudou de dia/.test(c) && /Sem tempo/.test(c) && /Desfazer/.test(c), 'tela da Corrida: a corrida de hoje mudou de dia, com o motivo e "Desfazer"');
        await foto('treino-perdido/corrida-tela');
        await page.click('Desfazer', '#corrida-hoje button'); await page.sleep(600);
        ok((await st()).length === 0, 'desfeito na tela da Corrida');
      } else ok(/não se repõe|Siga o plano/.test(f), 'sem outro dia: a corrida não se repõe');
      console.log('10. Tela da Corrida: "Não corri" e "Chuva"');
      await page.goto(B + '#/corrida', 1200);
      ok(await page.click('Não corri', '#corrida-hoje button'), '"Não corri" na tela da Corrida');
      ok(await espera('#folha-nao-corri'), 'a folha abriu');
      await motivo('chuva');
      f = await folhaTxt();
      if (/Correr na esteira\?/.test(f)) {
        ok(!!(await botaoFolha('/^Correr na esteira$/')), 'com chuva, propõe a esteira');
        await foto('treino-perdido/corrida-chuva');
        await page.click('Correr na esteira', '.sheet button'); await page.sleep(600);
        ok(await page.eval(`const m = await import('/js/store.js'); return (m.state.run.esteira || []).includes(${JSON.stringify(dk(hoje))}) && m.state.perdidos.length === 0;`), 'a corrida de hoje ficou na esteira, sem marca de falta');
      }
      console.log('11. Aba Treinos: "Não corri" com "Cansaço" marca como não feita; o Início mostra');
      await page.goto(B + '#/treinos', 1000);
      ok(await page.click('Não corri', '.card.dia.hl button'), '"Não corri" no cartão de hoje');
      ok(await espera('#folha-nao-corri'), 'a folha abriu');
      await motivo('cansaco');
      f = await folhaTxt();
      ok(/Corrida perdida não se repõe/.test(f), 'com cansaço, não repõe');
      await page.click('Marcar como não feita', '.sheet button'); await page.sleep(600);
      const r = await page.eval(`const m = await import('/js/store.js'); return JSON.stringify({ p: m.state.perdidos, runs: m.state.runs.length });`).then(JSON.parse);
      ok(r.p.length === 1 && r.p[0].tipo === 'corrida' && !r.p[0].para && r.p[0].motivo === 'cansaco' && r.runs === 0, 'marca gravada, sem corrida inventada: ' + JSON.stringify(r));
      await page.goto(B + '#/', 1000);
      ok(/Não feita/.test(await page.eval(`return document.body.innerText;`)) && /Cansaço/.test(await page.eval(`return document.body.innerText;`)), 'Início mostra a corrida como não feita, com o motivo');
      await page.click('Desfazer', 'button'); await page.sleep(500);
      ok((await st()).length === 0, 'desfeito');
    }
  }
  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

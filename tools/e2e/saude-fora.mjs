// Teste de ponta a ponta dos problemas de saúde que não vêm do treino (logic/saude-fora.js, views/saude-fora.js):
// contar pelas telas (Início e corrida), o efeito no treino do dia (aviso por exercício, "sem treino"), na corrida do dia,
// o "Melhorou" com a volta aos poucos, 360 px sem rolagem para o lado e nenhum erro no console.
// Fotos em .tools/shots/saude-fora/. Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/saude-fora.mjs
import * as store from '../../www/js/store.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = new Date();
const wd = hoje.getDay();
const item = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
const FULL = [item('flexao-de-bracos'), item('barra-fixa-pronada'), item('agachamento-peso-corporal'), item('flexao-nordica')];

async function estado(tema) {
  const plano = { id: 'p1', nome: 'Corpo inteiro', origem: 'manual', criadoEm: new Date(hoje.getTime() - 20 * 86400000).toISOString(), info: '',
    dias: [{ id: 'da', nome: 'Treino A', foco: 'Corpo inteiro', itens: FULL }], agenda: { [wd]: 'da' } };
  const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
  const corrida = { experiencia: 'regular', kmSemana: 20, longoAtual: 8, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: [String(wd), String((wd + 3) % 7)], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  const { PERGUNTAS } = await import('../../www/js/logic/corrida.js');
  for (const q of PERGUNTAS) if (!(q.k in corrida) && !(q.se && !q.se(corrida)) && !q.opcional) corrida[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  return store.sanitize({ v: store.VERSAO, settings: { tema, animar: false }, gym: { all: true, has: {} }, plans: [plano], activePlan: 'p1',
    run: { answers: corrida, aceitoEm: new Date(seg.getTime() - 7 * 86400000).toISOString(), inicio: dk(new Date(seg.getTime() - 7 * 86400000)), pausadoEm: '' },
    ui: { onboarded: true, installDismissedAt: new Date().toISOString(), backupEm: new Date().toISOString() } });
}

export default async (page) => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  const semRolagem = () => page.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`);
  const espera = (sel) => page.eval(`for (let i = 0; i < 30 && !document.querySelector(${JSON.stringify(sel)}); i++) await new Promise((r) => setTimeout(r, 100)); return !!document.querySelector(${JSON.stringify(sel)});`);
  const clicar = (sel) => page.eval(`const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); await new Promise((r) => setTimeout(r, 250)); return true;`);
  const naFolha = (txt) => page.click(txt, '.sheet button');
  const saude = () => page.eval(`const m = await import('/js/store.js'); return JSON.stringify(m.state.saudeFora);`).then(JSON.parse);
  // foto é só para conferir a tela: se o navegador sem janela travar na captura, o teste segue (e avisa)
  const foto = async (nome) => { try { await page.shot(nome); } catch (e) { console.log('  (foto não saiu: ' + nome + ')'); } };
  const texto = (sel = 'main') => page.eval(`const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.innerText : '';`);

  for (const tema of ['claro', 'escuro']) {
    console.log(`\n== Tema ${tema} ==`);
    await page.goto(B, 1000);
    const dados = await estado(tema);
    await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados }))}); await new Promise((r) => setTimeout(r, 300)); await m.flush();`);
    await page.goto(B + '#/', 300); await page.reload(1400);
    const corridaHoje = !!(await page.eval(`return !!document.getElementById('inicio-corrida');`));

    console.log('1. Início: caminho discreto para contar; pancada forte no joelho');
    ok(await page.eval(`return !!document.querySelector('.atalho[data-acao="contar-saude"]');`), 'atalho "Contar um problema de saúde" no Início');
    ok(!(await page.eval(`return !!document.querySelector('#saude-fora');`)), 'sem problema anotado, nenhum cartão a mais');
    await clicar('.atalho[data-acao="contar-saude"]');
    ok(await espera('#saude-folha'), 'a folha abriu');
    ok(await page.eval(`return document.querySelectorAll('#saude-folha [data-tipo]').length === 9;`), 'os 9 tipos aparecem');
    ok(await semRolagem(), 'folha sem rolagem para o lado em 360 px');
    await foto(`saude-fora/tipos-${tema}`);
    await clicar('[data-tipo="pancada"]'); await clicar('[data-onde="joelho"]');
    ok(/Tem algum destes sinais\?/.test(await texto('.sheet')) && /estalo/.test(await texto('.sheet')), 'pergunta dos sinais de emergência');
    await naFolha('Não'); // urgente
    ok(/4 passos/.test(await texto('.sheet')), 'sinais que pedem atendimento (Ottawa)');
    await naFolha('Não'); // atendimento
    await clicar('[data-grau="forte"]');
    await naFolha('Sim'); // piora ao mexer
    ok(await espera('#saude-resultado'), 'decisão do treinador');
    const res = await texto('#saude-resultado');
    ok(/Treino sem usar o joelho/.test(res) && /Por quê\?/.test(res) && !/FONTES/.test(res), 'decisão curta, com "Por quê?" fechado: ' + res.split('\n')[0]);
    await page.eval(`document.querySelector('#saude-resultado details.pq > summary').click(); await new Promise((r) => setTimeout(r, 150));`);
    ok(/Dubois B/.test(await texto('#saude-resultado')), 'o "Por quê?" mostra as fontes');
    ok(await semRolagem(), 'sem rolagem para o lado');
    await foto(`saude-fora/decisao-${tema}`);
    await naFolha('Anotar'); await page.sleep(600);
    let s = await saude();
    ok(s.length === 1 && s[0].tipo === 'pancada' && s[0].onde === 'joelho' && s[0].grau === 'forte' && s[0].piora === true && s[0].data === dk(hoje), 'anotado: ' + JSON.stringify(s));

    console.log('2. Efeito: cartão no Início, aviso no treino de hoje e na corrida');
    ok(await espera('#saude-fora'), 'cartão do problema no Início');
    const ini = await texto();
    ok(/Treino sem usar o joelho/.test(ini) && /joelho ficam de fora/.test(ini), 'o treino de hoje avisa que o joelho fica de fora');
    ok(/Iniciar treino/.test(ini), 'o resto do corpo treina: "Iniciar treino" continua');
    if (corridaHoje) ok(/Sem corrida hoje: pancada/.test(ini), 'corrida de hoje: sem corrida por causa da pancada');
    else console.log('  (o plano de corrida não pôs corrida hoje: conferência da corrida pulada)');
    ok(await semRolagem(), 'Início sem rolagem para o lado');
    await page.eval(`window.scrollTo(0, 0);`); await page.sleep(2600);
    await foto(`saude-fora/inicio-pancada-${tema}`);
    await page.click('Iniciar treino'); await page.sleep(900);
    ok(await espera('#sessao-saude'), 'treino em andamento: aviso do dia');
    const sess = await texto();
    ok(/Pancada no joelho: pule este exercício até melhorar\./.test(sess), 'o exercício que usa o joelho pede para pular');
    ok(await semRolagem(), 'treino sem rolagem para o lado');
    await foto(`saude-fora/treino-pancada-${tema}`);
    await page.eval(`const m = await import('/js/store.js'); m.update((x) => { x.current = null; }); await m.flush();`);

    console.log('3. "Melhorou": volta aos poucos');
    await page.goto(B + '#/', 300); await page.reload(1200);
    await page.click('Melhorou', '#saude-fora button'); await page.sleep(600);
    s = await saude();
    ok(s[0].fim === dk(hoje), '"Melhorou" gravado');
    ok(/Volta aos poucos: o joelho/.test(await texto('#saude-fora')), 'a região volta com menos carga por uma semana');

    console.log('4. Pela tela da corrida: febre → sem treino');
    await page.goto(B + '#/corrida', 300); await page.reload(1400);
    ok(await page.eval(`return !!document.querySelector('[data-acao="contar-saude"]');`), 'botão perto de "Contar uma dor"');
    await clicar('[data-acao="contar-saude"]');
    await clicar('[data-tipo="febre"]');
    await naFolha('Não'); await naFolha('Não');
    ok(/Hoje sem treino/.test(await texto('#saude-resultado')), 'febre: hoje sem treino');
    await naFolha('Anotar'); await page.sleep(600);
    if (corridaHoje) {
      await page.goto(B + '#/corrida/dia/' + dk(hoje), 300); await page.reload(1400);
      ok(/Sem corrida hoje: febre/.test(await texto()), 'corrida do dia: sem corrida por febre');
      ok(await semRolagem(), 'corrida do dia sem rolagem para o lado');
      await foto(`saude-fora/corrida-febre-${tema}`);
    }
    await page.goto(B + '#/', 300); await page.reload(1200);
    const ini2 = await texto();
    ok(/Hoje sem treino/.test(ini2) && !/Iniciar treino/.test(ini2), 'Início: sem treino hoje, sem "Iniciar treino"');
    await page.eval(`window.scrollTo(0, 0);`); await page.sleep(300);
    await foto(`saude-fora/inicio-febre-${tema}`);
    await page.eval(`const m = await import('/js/views/session.js'); m.startFree(); await new Promise((r) => setTimeout(r, 400));`);
    ok(await espera('#folha-sem-treino'), 'começar um treino mostra o aviso de dia sem treino');
    ok(!(await page.eval(`const m = await import('/js/store.js'); return !!m.state.current;`)), 'nenhum treino começou');
    await naFolha('Já melhorei'); await page.sleep(700);
    const ini3 = await texto();
    ok(/Volta aos poucos/.test(ini3) && /Iniciar treino/.test(ini3) && /treino leve/.test(ini3), 'depois de melhorar: treino leve, com "Iniciar treino"');
    ok(await semRolagem(), 'sem rolagem para o lado');
    await foto(`saude-fora/inicio-volta-${tema}`);
  }
  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

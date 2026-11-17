// Teste de ponta a ponta do chat com os treinadores, clicando nas telas, a 360 px:
// 1) as entradas (Treinador, Corrida, Nutrição e Início) e a abertura com os assuntos em botões;
// 2) o exemplo do dono do app (choveu de manhã; corrida e musculação no mesmo dia) pelo texto livre, com a confirmação;
// 3) a conversa continua depois de a tela ser redesenhada; "Começar de novo" apaga;
// 4) sinal de alerta no texto (nos três chats);
// 5) ações aplicadas: "Não vou conseguir treinar hoje" grava a marca e a versão curta começa o treino reduzido;
// 6) o chat da corrida (chuva → esteira) e o da Nutricionista;
// 7) letra "Muito grande" e alto contraste, claro e escuro, sem rolagem para o lado; zero erro no console;
// 8) conversa normal: continuação ("e sexta?", "e a corrida?"), outro dia, ritmo (pace), mudar a corrida de dia e como fica
//    a semana, "pode" digitado para aceitar a proposta, aparelho que a academia não tem, esteira e a triagem do peito —
//    também com a letra "Muito grande" a 360 px.
// Fotos em .tools/shots/chat/. Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/chat.mjs
import * as store from '../../www/js/store.js';
import { gerarPlano } from '../../www/js/logic/trainer.js';
import { PERGUNTAS as P_CORRIDA, respostasCompletas as corridaOk } from '../../www/js/logic/corrida.js';
import { corridaDeHoje, treinoDeHoje } from '../../www/js/logic/chat/treino.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = new Date();
const HOJE = dk(hoje);
const wd = hoje.getDay();
const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
const segAnterior = new Date(seg.getTime() - 7 * 86400000);
const TREINO = { objetivo: 'hipertrofia', idade: 31, peso: 78, altura: 176, experiencia: 'intermediario', pausa: 'treinando', dias: '3', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], remedios: ['nenhum'], foco: ['equilibrado'], semTreino: ['nenhum'] };
const NUTRI = { objetivo: 'ganhar', sexo: 'm', idade: 31, peso: 78, altura: 176, atividade: 'leve', treinos: '3', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], alergias: ['nenhuma'], condicoes: ['nenhuma'] };
const corrida = (dias) => {
  const c = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'saude', dias, diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  for (const q of P_CORRIDA) if (!(q.k in c) && !(q.se && !q.se(c)) && !q.opcional) c[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  if (!corridaOk(c)) throw new Error('respostas de corrida incompletas: atualize o roteiro');
  return c;
};
// Estado com musculação E corrida hoje (o exemplo do dono): procura a combinação de dias que deixa os dois em hoje
function estado(extra = {}) {
  const p = gerarPlano(TREINO, { all: true, has: {} }, 0, null, null);
  for (const desloc of [[0, 2, 4], [0, 3, 5], [0, 2, 5], [0, 1, 4]]) {
    for (const foco of ['equilibrio', 'musculacao', 'corrida']) {
      const agenda = {};
      p.dias.forEach((d, i) => { agenda[(wd + desloc[i % desloc.length]) % 7] = d.id; });
      const st = store.sanitize({
        v: store.VERSAO, settings: { tema: 'claro', animar: false }, gym: { all: true, has: {} },
        trainer: { answers: TREINO, aceitoEm: new Date(segAnterior.getTime() - 86400000).toISOString() },
        plans: [{ id: 'p1', nome: 'Plano', origem: 'treinador', criadoEm: new Date(segAnterior.getTime() - 86400000).toISOString(), dias: p.dias.map((d) => ({ id: d.id, nome: d.nome, foco: d.foco || '', itens: d.itens })), agenda, info: '' }],
        activePlan: 'p1', nutri: { answers: NUTRI, calculadoEm: new Date().toISOString() },
        run: { answers: corrida(desloc.map((k) => String((wd + k + 1) % 7)).concat([String(wd)]).filter((x, i, a) => a.indexOf(x) === i).slice(0, 4)), aceitoEm: segAnterior.toISOString(), inicio: dk(segAnterior), pausadoEm: '' },
        combo: { foco, fortalecimento: 'nao', em: new Date().toISOString() },
        ui: { onboarded: true, installDismissedAt: new Date().toISOString(), backupEm: new Date().toISOString() }, ...extra,
      });
      const ctx = { st, hoje: HOJE, agora: Date.now() };
      if (corridaDeHoje(ctx) && treinoDeHoje(ctx)) return st;
    }
  }
  throw new Error('não achei um estado com corrida e musculação hoje');
}

export default async (page) => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  const carregar = async (dados) => { await page.goto(B, 900); await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados }))}); await new Promise((r) => setTimeout(r, 700));`); };
  const semRolagem = () => page.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`);
  const espera = (sel) => page.eval(`for (let i = 0; i < 40 && !document.querySelector(${JSON.stringify(sel)}); i++) await new Promise((r) => setTimeout(r, 100)); return !!document.querySelector(${JSON.stringify(sel)});`);
  const falas = () => page.eval(`return [...document.querySelectorAll('.chat-msg')].map((m) => (m.classList.contains('de-eu') ? 'EU: ' : 'COACH: ') + m.querySelector('.chat-eu, .chat-bolha').innerText.replace(/\\s+/g, ' ').trim());`);
  const ultima = async () => { const l = await falas(); return l.filter((x) => x.startsWith('COACH')).pop() || ''; };
  const escrever = (t) => page.eval(`const c = document.getElementById('chat-campo'); c.focus(); c.value = ${JSON.stringify(t)}; c.dispatchEvent(new Event('input')); document.querySelector('.chat-campo button').click(); await new Promise((r) => setTimeout(r, 350)); return true;`);
  const botao = (txt) => page.click(txt, '.chat-msg.ativo .chat-opcoes button');
  const confirmar = async () => { await espera('.sheet'); await page.sleep(150); return page.eval(`const b = [...document.querySelectorAll('.sheet-ft button')].pop(); if (!b) return false; b.click(); await new Promise((r) => setTimeout(r, 500)); return true;`); };
  const estadoApp = (expr) => page.eval(`const s = (await import('/js/store.js')).state; return JSON.stringify(${expr});`).then(JSON.parse);
  // foto é só registro: se o navegador sem janela demorar para tirar, tenta de novo e segue (a conferência é pelo DOM)
  const foto = async (nome) => { for (let i = 0; i < 2; i++) { try { await page.shot(nome); return; } catch { await page.sleep(500); } } console.log('  (foto não saiu: ' + nome + ')'); };
  const campoVisivel = () => page.eval(`const c = document.getElementById('chat-campo'); if (!c) return false; c.scrollIntoView({ block: 'end' }); await new Promise((r) => setTimeout(r, 200)); const r = c.getBoundingClientRect(); return r.width >= 140 && r.bottom <= innerHeight + 1 && r.top >= 0;`);

  console.log('1. Entradas e abertura');
  await carregar(estado());
  await page.goto(B + '#/treinador', 300); await page.reload(1400);
  ok(await page.click('Perguntar ao Treinador'), 'entrada "Perguntar ao Treinador" na tela do Treinador');
  await espera('#chat');
  ok((await page.eval('return location.hash;')) === '#/chat/treinador', 'abriu #/chat/treinador');
  const abertura = await ultima();
  ok(/Em que posso ajudar no seu treino\?/.test(abertura), 'saudação de uma linha: ' + abertura.slice(0, 60));
  const nAssuntos = await page.eval(`return document.querySelectorAll('.chat-msg.ativo .chat-opcoes button').length;`);
  ok(nAssuntos >= 4 && nAssuntos <= 6, 'assuntos em botões: ' + nAssuntos);
  const alturaBotao = await page.eval(`return Math.round(document.querySelector('.chat-msg.ativo .chat-opcoes button').getBoundingClientRect().height);`);
  ok(alturaBotao >= 44, 'botões grandes (≥ 44 px): ' + alturaBotao);
  ok(await page.eval(`return !!document.querySelector('#chat-campo[placeholder="Escreva sua dúvida"]');`), 'campo "Escreva sua dúvida"');
  ok(!(await page.eval(`return !!document.querySelector('nav.nav');`)), 'sem a barra de abas (o campo fica livre no fim)');
  ok(await semRolagem(), 'sem rolagem para o lado');
  await foto('chat/abertura');

  console.log('2. O exemplo do dono, por texto livre');
  await escrever('hoje de manhã eu tinha corrida no plano mas choveu; tenho musculação hoje também — posso fazer um seguido do outro e qual a recomendação de acordo com minhas prioridades e meu perfil?');
  // assunto bem claro: o treinador responde direto; com folga pequena, confirma antes
  if (/Entendi que você quer falar sobre fazer corrida e musculação no mesmo dia\. É isso\?/.test(await ultima())) { ok(await botao('Sim'), 'confirmou a intenção'); await page.sleep(300); }
  const resp = await ultima();
  ok(/Sua prioridade/.test(resp) && /6 horas entre os dois; no mínimo 3/.test(resp), 'resposta pela prioridade, com o intervalo: ' + resp.slice(0, 160));
  ok(await page.eval(`const d = [...document.querySelectorAll('.chat-msg.ativo details.pq')].pop(); if (!d) return false; d.open = true; return /FONTES/.test(d.innerText) && /Eddens|Methenitis|Petré/.test(d.innerText);`), '"Por quê?" fechado, com as fontes');
  ok(await semRolagem(), 'sem rolagem para o lado');
  await foto('chat/exemplo-chuva');

  console.log('3. A conversa sobrevive ao redesenho; "Começar de novo"');
  const antes = (await falas()).length;
  await page.eval(`const st = await import('/js/store.js'); const r = await import('/js/router.js'); st.update((s) => { s.settings.som = !s.settings.som; }); r.refresh(); await new Promise((x) => setTimeout(x, 300)); return 1;`);
  ok((await falas()).length === antes, 'mesmas falas depois de redesenhar: ' + antes);
  await page.goto(B + '#/treinos', 400); await page.goto(B + '#/chat/treinador', 600);
  ok((await falas()).length === antes, 'mesmas falas ao sair e voltar');
  ok(await page.click('Começar de novo'), 'tocou em "Começar de novo"');
  await page.sleep(300);
  ok((await falas()).length === 1, 'conversa apagada: só a saudação');

  console.log('4. Sinais de alerta');
  for (const [rota, frase] of [['chat/treinador', 'senti um aperto no peito no treino'], ['chat/corrida', 'quase desmaiei correndo'], ['chat/nutri', 'comi e fiquei com falta de ar']]) {
    await page.goto(B + '#/' + rota, 600);
    await escrever(frase);
    const t = await page.eval(`const n = [...document.querySelectorAll('.chat-msg.ativo .note.danger')].pop(); return n ? n.innerText : '';`);
    ok(/Pare o exercício agora e procure atendimento/.test(t) && /192 \(SAMU\)/.test(t), `${rota}: "${frase}" → orientação de segurança primeiro`);
    if (rota === 'chat/treinador') await foto('chat/alerta');
    await page.click('Começar de novo');
  }

  console.log('5. Ações aplicadas');
  await page.goto(B + '#/chat/treinador', 600);
  ok(await botao('Não vou conseguir treinar hoje'), 'assunto "Não vou conseguir treinar hoje"');
  await page.sleep(250);
  ok(await botao('Outro motivo'), 'motivo');
  await page.sleep(250);
  const acao = await page.eval(`const b = document.querySelector('.chat-msg.ativo .chat-opcoes button.primary'); return b ? b.textContent.trim() : '';`);
  ok(/^(Passar para|Seguir a semana)/.test(acao), 'a mesma escolha da folha "Não treinei": ' + acao);
  await page.click(acao, '.chat-msg.ativo .chat-opcoes button');
  ok(await confirmar(), 'confirmou na folha');
  const marcas = await estadoApp('s.perdidos');
  ok(marcas.some((m) => m.tipo === 'musculacao' && m.data === HOJE), 'marca gravada no estado: ' + JSON.stringify(marcas).slice(0, 120));
  ok(/^COACH: Pronto/.test(await ultima()), 'o treinador diz o que foi feito');
  await foto('chat/acao-aplicada');
  // versão curta: começa o treino de hoje reduzido, sem mudar o plano
  await carregar(estado());
  await page.goto(B + '#/chat/treinador', 300); await page.reload(1400);
  const planoAntes = await estadoApp('s.plans[0]');
  ok(await botao('Tenho pouco tempo hoje'), 'assunto "Tenho pouco tempo hoje"');
  await page.sleep(250);
  const tempo = await page.eval(`const b = [...document.querySelectorAll('.chat-msg.ativo .chat-opcoes button')].find((x) => /min$/.test(x.textContent.trim())); return b ? b.textContent.trim() : '';`);
  ok(!!tempo, 'opção de tempo: ' + tempo);
  await botao(tempo);
  await page.sleep(300);
  const linhas = await page.eval(`return [...document.querySelectorAll('.chat-msg.ativo .chat-bolha > p')].filter((p) => p.textContent.startsWith('•')).length;`);
  ok(linhas >= 3, 'versão curta com ' + linhas + ' exercícios');
  ok(await page.click('Começar a versão curta', '.chat-msg.ativo .chat-opcoes button'), 'tocou em "Começar a versão curta"');
  ok(await confirmar(), 'confirmou');
  await page.sleep(600);
  const cur = await estadoApp('s.current && { n: s.current.itens.length, diaId: s.current.diaId }');
  ok((await page.eval('return location.hash;')) === '#/sessao' && cur && cur.n === linhas, 'treino começou com a versão curta: ' + JSON.stringify(cur));
  ok(JSON.stringify(await estadoApp('s.plans[0]')) === JSON.stringify(planoAntes), 'o plano não mudou');
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.current = null; }); return 1;`);

  console.log('6. Chat da corrida e da Nutricionista');
  await page.goto(B + '#/corrida', 300); await page.reload(1400);
  ok(await page.click('Perguntar ao treinador de corrida'), 'entrada na tela da Corrida');
  await espera('#chat');
  ok(await botao('Choveu ou não dá para correr na rua'), 'assunto da chuva');
  await page.sleep(250);
  ok(await botao('Correr na esteira'), 'esteira');
  await page.sleep(250);
  ok(/inclinação/i.test(await ultima()), 'esteira com a inclinação pesquisada');
  ok(await page.eval(`const d = [...document.querySelectorAll('.chat-msg.ativo details.pq')].pop(); d.open = true; return /Miller/.test(d.innerText);`), 'fonte: Miller 2019');
  await foto('chat/corrida-esteira');
  await page.click('Começar de novo');
  await escrever('tá chovendo, não dá pra correr');
  ok(/O que prefere\?|Entendi que você quer falar sobre chuva/.test(await ultima()), 'texto livre na corrida: ' + (await ultima()).slice(0, 80));
  await page.goto(B + '#/nutricao', 300); await page.reload(1400);
  ok(await page.click('Perguntar', '.topbar button'), 'entrada na Nutrição ("Perguntar" na barra do topo)');
  await espera('#chat');
  ok(/alimentação/.test(await ultima()), 'saudação da Nutricionista');
  await escrever('quanta proteína eu devo comer por dia?');
  ok((await ultima()).length > 20, 'a Nutricionista responde: ' + (await ultima()).slice(0, 80));
  await foto('chat/nutri');
  await page.goto(B + '#/', 300); await page.reload(1400);
  ok(await page.eval(`return [...document.querySelectorAll('.perdido-acoes button')].some((b) => /Dúvida\\? Pergunte/.test(b.textContent));`), 'atalho discreto no cartão do treino de hoje (Início)');

  console.log('7. Letra Muito grande e alto contraste, a 360 px');
  for (const [tema, contraste] of [['claro', true], ['escuro', true], ['escuro', false]]) {
    await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.settings.letra = 'muito'; x.settings.tema = '${tema}'; x.settings.contraste = ${contraste}; }); return 1;`);
    for (const rota of ['chat/treinador', 'chat/corrida', 'chat/nutri']) {
      await page.goto(B + '#/' + rota, 500);
      await page.click('Começar de novo');
      await page.sleep(200);
      await page.eval(`const b = document.querySelector('.chat-msg.ativo .chat-opcoes button'); if (b) b.click(); await new Promise((r) => setTimeout(r, 300)); return 1;`);
      await page.eval(`for (const d of document.querySelectorAll('.chat details')) d.open = true; return 1;`);
      const larga = await page.eval(`return [...document.querySelectorAll('#chat *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.className || e.tagName).slice(0, 3);`);
      ok(await semRolagem() && !larga.length, `${rota}, letra muito grande, ${tema}${contraste ? ', alto contraste' : ''}: sem rolagem para o lado ${larga.join(' ')}`);
      ok(await campoVisivel(), `${rota}: campo de texto largo e à vista`);
    }
    await foto(`chat/letra-${tema}${contraste ? '-contraste' : ''}`);
  }
  await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.settings.letra = 'normal'; x.settings.contraste = false; x.settings.tema = 'claro'; }); return 1;`);

  console.log('8. Conversa normal');
  const recomecar = async (rota) => { await page.goto(B + '#/' + rota, 500); await page.click('Começar de novo'); await page.sleep(250); };
  // continuação: outro dia e o outro treino, sem repetir o assunto
  await carregar(estado());
  await page.goto(B + '#/chat/treinador', 300); await page.reload(1400);
  await escrever('qual o meu treino de hoje?');
  ok(/^COACH: Hoje é /.test(await ultima()), 'o treino de hoje, direto: ' + (await ultima()).slice(0, 70));
  await escrever('e amanhã?');
  ok(/^COACH: Amanhã /.test(await ultima()), '"e amanhã?" fala de amanhã: ' + (await ultima()).slice(0, 70));
  await escrever('e a corrida?');
  ok(/^COACH: Amanhã /.test(await ultima()) && /corrida|regenerativo|rodagem|longão|fartlek|progressivo|tempo run|intervalado/i.test(await ultima()), '"e a corrida?" responde a corrida de amanhã: ' + (await ultima()).slice(0, 80));
  await escrever('como fica a semana?');
  ok(/Sua semana:/.test(await ultima()) && /\(hoje\)/.test(await ultima()), 'a semana, com o dia de hoje marcado');
  await foto('chat/continuacao');
  // "pode" digitado aceita a proposta em aberto (abre a mesma confirmação do botão)
  await recomecar('chat/treinador');
  await escrever('hoje não vou conseguir treinar');
  await escrever('outro motivo');
  const prop = await ultima();
  ok(/Passar o .* para .*\?|Seguir a semana\?/.test(prop), 'o motivo digitado responde aos botões: ' + prop.slice(0, 90));
  await escrever('pode');
  ok(await espera('.sheet'), '"pode" abre a confirmação da ação');
  ok(await confirmar(), 'confirmou');
  ok((await estadoApp('s.perdidos')).some((m) => m.tipo === 'musculacao' && m.data === HOJE), 'marca gravada pelo "pode"');
  ok(/^COACH: Pronto/.test(await ultima()), 'o treinador diz o que foi feito');
  ok(await botao('Como fica a semana'), '"Como fica a semana" depois da ação');
  await page.sleep(300);
  ok(/não feito|passou para/.test(await ultima()), 'a semana mostra o treino remarcado: ' + (await ultima()).slice(0, 120));
  // ritmo e mudar a corrida de dia, com a semana resultante
  await carregar(estado());
  await page.goto(B + '#/chat/corrida', 300); await page.reload(1400);
  await escrever('qual o meu pace hoje?');
  ok(/Ritmo:|esforço/i.test(await ultima()), 'o ritmo (ou o esforço) da corrida de hoje: ' + (await ultima()).slice(0, 90));
  ok(await botao('Posso ir mais rápido?'), 'pergunta de continuação em botão');
  await page.sleep(250);
  ok(/volume até 10% por semana/.test(await ultima()), 'mais rápido: pela regra do plano');
  await escrever('posso mudar a corrida de hoje para outro dia?');
  let mv = await ultima();
  if (/Para qual dia/.test(mv)) {
    const dia = await page.eval(`const b = [...document.querySelectorAll('.chat-msg.ativo .chat-opcoes button.chat-op')].find((x) => !/Não vou correr/.test(x.textContent)); return b ? b.textContent.trim() : '';`);
    ok(!!dia, 'dias possíveis em botões: ' + dia);
    await botao(dia);
    await page.sleep(300);
    mv = await ultima();
  }
  ok(/Pode: a corrida de hoje/.test(mv) && /Assim fica a semana/.test(mv) && /veio de hoje/.test(mv), 'mudar a corrida: a proposta e a semana resultante');
  const passar = await page.eval(`const b = document.querySelector('.chat-msg.ativo .chat-opcoes button.primary'); return b ? b.textContent.trim() : '';`);
  ok(/^Passar para /.test(passar), 'ação: ' + passar);
  await page.click(passar, '.chat-msg.ativo .chat-opcoes button');
  ok(await confirmar(), 'confirmou');
  const marcaMv = (await estadoApp('s.perdidos')).find((m) => m.tipo === 'corrida' && m.data === HOJE);
  ok(!!(marcaMv && marcaMv.para > HOJE), 'corrida passou para outro dia: ' + JSON.stringify(marcaMv));
  await foto('chat/mudar-corrida');
  if (marcaMv) {
    await page.goto(B + '#/corrida/dia/' + marcaMv.para, 900);
    ok(!/Sem corrida|descanso/i.test((await page.text()).slice(0, 400)) || /Rodagem|Regenerativo|Fartlek|Longão|Corrida/i.test(await page.text()), 'a tela do dia novo mostra a corrida');
    await page.goto(B + '#/treinos', 700);
    ok(/Mudou de dia/.test(await page.text()) && /Passou para/.test(await page.text()), 'a semana em Treinos mostra a corrida que mudou de dia');
  }
  // esteira (logic/esteira.js): a versão do treino e "Fazer na esteira"
  await carregar(estado());
  await page.goto(B + '#/chat/corrida', 300); await page.reload(1400);
  await escrever('quero fazer a corrida de hoje na esteira');
  const est = await ultima();
  ok(/esteira/i.test(est) && /Inclinação|inclinação/.test(est), 'a corrida de hoje na esteira: ' + est.slice(0, 90));
  if (await page.click('Fazer na esteira', '.chat-msg.ativo .chat-opcoes button')) {
    ok(await confirmar(), 'confirmou a esteira');
    ok((await estadoApp('s.run.esteira || []')).includes(HOJE), 'esteira marcada para hoje');
  } else ok(/Voltar para a rua/.test(await page.text()) || false, 'ação da esteira');
  // aparelho que a academia não tem: troca no plano
  await recomecar('chat/treinador');
  await escrever('esse aparelho não tem na minha academia');
  ok(/Qual exercício do plano/.test(await ultima()), 'pergunta qual exercício');
  const exNome = await page.eval(`const b = document.querySelector('.chat-msg.ativo .chat-opcoes button.chat-op'); return b ? b.textContent.trim() : '';`);
  await botao(exNome);
  await page.sleep(300);
  const troca = await page.eval(`const b = [...document.querySelectorAll('.chat-msg.ativo .chat-opcoes button.primary')].find((x) => /^Trocar por /.test(x.textContent.trim())); return b ? b.textContent.trim() : '';`);
  if (troca) {
    const antesPl = JSON.stringify(await estadoApp('s.plans[0].dias.map((d) => d.itens.map((i) => i.ex))'));
    await page.click(troca, '.chat-msg.ativo .chat-opcoes button');
    ok(await confirmar(), 'confirmou a troca');
    ok(JSON.stringify(await estadoApp('s.plans[0].dias.map((d) => d.itens.map((i) => i.ex))')) !== antesPl, `o plano trocou ${exNome} (${troca})`);
  } else ok(/não achei outro exercício/.test(await ultima()), 'sem troca segura: diz que não achou');
  // triagem do peito
  await recomecar('chat/treinador');
  await escrever('peito dolorido do supino');
  ok(/você tem algum destes\?/.test(await ultima()) && !!(await page.eval(`return !!document.querySelector('.chat-msg.ativo .note.warn');`)), 'triagem: uma pergunta com os sinais de alarme');
  ok(await botao('Não: só dói ao apertar ou mexer'), 'sem sinais de alarme');
  await page.sleep(250);
  ok(/dor do músculo do treino/.test(await ultima()) && /192/.test(await ultima()), 'dor muscular, com o lembrete do 192');
  await foto('chat/triagem-peito');
  await escrever('dor no peito');
  ok(/Pare o exercício agora/.test(await ultima()), '"dor no peito": direto ao alerta');
  // letra Muito grande a 360 px numa conversa longa
  await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.settings.letra = 'muito'; }); return 1;`);
  await recomecar('chat/corrida');
  await escrever('posso mudar a corrida para outro dia?');
  await page.eval(`for (const d of document.querySelectorAll('.chat details')) d.open = true; return 1;`);
  const larga2 = await page.eval(`return [...document.querySelectorAll('#chat *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.className || e.tagName).slice(0, 3);`);
  ok(await semRolagem() && !larga2.length, 'conversa de mudar a corrida, letra muito grande: sem rolagem para o lado ' + larga2.join(' '));
  ok(await campoVisivel(), 'campo de texto largo e à vista');
  await foto('chat/letra-mudar-corrida');
  await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.settings.letra = 'normal'; }); return 1;`);

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

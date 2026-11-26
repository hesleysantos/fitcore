// Teste de ponta a ponta do Treinador de corrida, clicando como um usuário: entrevista de dois perfis (iniciante e
// avançado), aceitar o plano, abrir o treino do dia, cronômetro guiado, registrar corrida, ver ajuste e evolução,
// contar uma dor, recarregar e conferir que tudo persiste, sem erros no console.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/corrida.mjs
const B = 'http://localhost:5173/';
const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export default async (page) => {
  const falhas = [];
  const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msg); if (!cond) falhas.push(msg); };
  const texto = () => page.text();
  // conteúdo de uma seção fechada (details) pelo id: o que foi para "Cuidados", "Sua evolução" etc. continua conferido
  const fechado = (id) => page.eval(`const d = document.getElementById(${JSON.stringify(id)}); return d && d.tagName === 'DETAILS' ? d.textContent : '';`);
  const estado = (expr) => page.eval(`const s = (await import('/js/store.js')).state; return ${expr};`);
  const foto = async (nome) => { if (process.env.FOTOS_CORRIDA) await page.shot('corr/' + nome); };
  // O roteiro roda como se hoje fosse segunda-feira (o relógio da página é adiantado até a próxima segunda): assim a semana 1
  // do plano começa hoje em qualquer dia em que o teste rode.
  const adianta = ((8 - new Date().getDay()) % 7) * 86400000;
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const R = Date, d = ${adianta}; if (!d) return; class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + d); } static now() { return R.now() + d; } } window.Date = D; })();` });
  const hoje = new Date(Date.now() + adianta).getDay();
  const dia = (k) => DIAS[(hoje + k) % 7];

  // responde a entrevista: texto da opção, lista de textos (várias opções) ou número
  async function entrevista(respostas) {
    for (let n = 0; n < 40; n++) {
      const q = await page.eval(`const h2 = document.querySelector('.bubble h2'); return h2 && document.querySelector('.steps') ? h2.textContent : '';`);
      if (!q) break;
      const chave = Object.keys(respostas).find((k) => q.toLowerCase().includes(k.toLowerCase()));
      const v = chave ? respostas[chave] : undefined;
      if (typeof v === 'number' && (await page.eval(`return !!document.querySelector('.tempo-hms');`))) {
        // tempo em horas, minutos e segundos (o roteiro informa em minutos: 104.5 = 1 h 44 min 30 s)
        const s = Math.round(v * 60);
        const pos = await page.eval(`const c = document.querySelectorAll('.tempo-hms input'); if (c.length !== 3) return false; const v = [${Math.floor(s / 3600)}, ${Math.floor((s % 3600) / 60)}, ${s % 60}]; c.forEach((i, n) => { i.value = String(v[n]); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); return [...c].map((i) => i.getAttribute('inputmode')).join() === 'numeric,numeric,numeric';`);
        if (!pos) falhas.push('campos de horas, minutos e segundos não encontrados: ' + q);
      } else if (typeof v === 'number') {
        const pos = await page.eval(`const i = document.querySelector('.stepper input'); if (!i) return false; i.value = ${JSON.stringify(String(v).replace('.', ','))}; i.dispatchEvent(new Event('change', { bubbles: true })); return true;`);
        if (!pos) falhas.push('campo numérico não encontrado: ' + q);
      } else if (v !== undefined) {
        for (const alvo of [].concat(v)) {
          const achou = await page.eval(`const alvo = ${JSON.stringify(alvo)}; const o = [...document.querySelectorAll('.opt')].find((e) => e.querySelector('.o-t').textContent.trim() === alvo) || [...document.querySelectorAll('.opt')].find((e) => e.textContent.includes(alvo)); if (!o) return false; if (o.getAttribute('aria-checked') !== 'true') o.click(); return true;`);
          if (!achou) falhas.push('opção não encontrada: ' + q + ' -> ' + alvo);
        }
      } else if (!(await page.eval(`return !!document.querySelector('.stepper input, .tempo-hms input');`))) falhas.push('pergunta sem resposta no roteiro: ' + q);
      await page.sleep(100);
      // número com o valor de partida que o roteiro não mudou: confirma em "Está certo"
      await page.eval(`const c = [...document.querySelectorAll('[data-informar] button')].find((e) => e.textContent.trim() === 'Está certo'); if (c) c.click(); return !!c;`);
      const avancou = await page.eval(`const b = [...document.querySelectorAll('button.btn.primary')].find((e) => /Continuar|Concluir/.test(e.textContent)); if (!b || b.disabled) return false; b.click(); return true;`);
      if (!avancou) { falhas.push('não avançou na pergunta: ' + q); break; }
      await page.sleep(200);
    }
  }
  // registro da corrida (1.14.0): distância só com números (a vírgula entra sozinha) e tempo em minutos e segundos
  const km = (digitos) => preencher('Distância em quilômetros', String(digitos));
  const tempo = async (min, seg = '') => { const a = await preencher('Tempo: minutos', String(min)); const b = await preencher('Tempo: segundos', String(seg)); return a && b; };
  const modoDoRegistro = () => page.eval(`const m = document.getElementById('registro-medidas'); return m ? m.dataset.modo : '';`);
  const preencher = (rotulo, valor) => page.eval(`const i = document.querySelector('input[aria-label="${rotulo}"]'); if (!i) return false; i.value = ${JSON.stringify(valor)}; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true;`);

  // depois de aceitar o plano, o aplicativo pergunta sobre o fortalecimento (e, com musculação, sobre a prioridade)
  const responderFortalecimento = async () => {
    const tem = (await texto()).includes('Quer treinos de fortalecimento para a corrida?');
    if (tem) {
      await page.eval(`[...document.querySelectorAll('.sheet .opt')].find((e) => e.textContent.includes('Não agora')).click(); return true;`); await page.sleep(150);
      await page.eval(`[...document.querySelectorAll('.sheet-ft .btn')].find((e) => e.textContent.trim() === 'Salvar').click(); return true;`); await page.sleep(600);
    }
    return tem;
  };

  console.log('1. Abertura e abas do Treinador');
  await page.goto(B, 2500);
  await page.click('Agora não');
  await page.goto(B + '#/corrida', 900);
  let t = await texto();
  ok(t.includes('Treinador de corrida') && t.includes('Musculação') && t.includes('Olá!'), 'tela de boas-vindas da corrida, com as abas Musculação e Corrida');
  ok(await page.eval(`return document.querySelectorAll('details.acc').length >= 4;`), 'perguntas frequentes aparecem antes da entrevista');
  await page.eval(`document.querySelector('.search input').value = 'pace'; document.querySelector('.search input').dispatchEvent(new Event('input', { bubbles: true })); return true;`);
  await page.sleep(200);
  ok((await texto()).includes('Devo treinar por ritmo'), 'busca nas perguntas frequentes encontra a pergunta sobre ritmo');
  await foto('1-boas-vindas');

  console.log('2. Perfil iniciante: entrevista, proposta e aceite');
  await page.click('Começar'); await page.sleep(400);
  await entrevista({
    'Como é a sua corrida': 'Nunca corri', 'objetivo na corrida': 'Começar a correr', 'prefere correr': [dia(2), dia(4), dia(0)], 'não pode correr': 'Nenhum', 'melhor dia para o treino mais longo': 'Tanto faz',
    'tempo você tem por treino': 'Cerca de 45 minutos', 'mede as suas corridas': 'Relógio ou aplicativo com GPS', 'Onde você corre': 'Rua, parque ou calçadão', 'só por tempo': 'Tanto faz',
    anos: 41, peso: 92, altura: 168, 'lesão nos últimos': 'Não', 'dor em alguma': 'Nenhuma', condições: 'Nenhuma', sinais: 'Nenhum deles', 'remédio de uso contínuo': 'Nenhum',
  });
  t = await texto();
  ok(t.includes('Montei um plano de 14 semanas') && t.includes('3 corridas por semana'), 'proposta: 14 semanas, 3 corridas por semana (começo mais lento pelo IMC)');
  ok(t.includes('tempo e esforço') && t.includes('mais indicada para quem está começando'), 'iniciante com GPS recebe treinos por tempo e esforço, com a explicação');
  ok((await fechado('corrida-cuidados')).includes('menos de 3 km de corrida na primeira semana') && !t.includes('menos de 3 km de corrida na primeira semana'), 'aviso do começo mais lento aparece em “Cuidados para o seu perfil”, fechado');
  ok(await page.eval(`const pos = (s) => document.querySelector(s).getBoundingClientRect().top; const b = [...document.querySelectorAll('.btn')].find((e) => e.textContent.includes('Aceitar e usar este plano')); return pos('.bubble') < pos('#corrida-semana1') && pos('#corrida-semana1') < b.getBoundingClientRect().top && b.getBoundingClientRect().top < pos('#corrida-semanas');`), 'proposta: resumo → primeira semana → aceitar → seções fechadas');
  ok(t.includes('1 min correndo + 2 min caminhando'), 'primeira semana alterna corrida e caminhada');
  await foto('2-proposta-iniciante');
  await page.click('Aceitar e usar este plano'); await page.sleep(700);
  ok(await responderFortalecimento(), 'logo depois do aceite, a pergunta sobre fortalecimento para a corrida');
  ok((await estado('s.combo.fortalecimento')) === 'nao' && (await texto()).includes('Fortalecimento: sem fortalecimento'), 'a escolha fica gravada e aparece no cartão do painel');
  t = await texto();
  ok(t.includes('Semana 1 de 14') && t.includes('Esta semana'), 'painel mostra a semana 1 de 14');
  const topo = await page.eval(`const c = document.getElementById('corrida-hoje'); const b = [...c.querySelectorAll('.btn')].map((x) => x.textContent.trim()); return { tipo: c.dataset.hoje, h2: c.querySelector('h2').textContent, b, alto: c.getBoundingClientRect().bottom, alvo: Math.min(...[...c.querySelectorAll('.btn')].map((x) => x.getBoundingClientRect().height)) };`);
  ok(topo.tipo === 'treino' && topo.h2.startsWith('Hoje: ') && topo.b.includes('Iniciar') && topo.alvo >= 44, 'no alto, o treino de hoje com o botão Iniciar: ' + JSON.stringify(topo));
  const st1 = await estado(`{ aceito: !!s.run.aceitoEm, inicio: s.run.inicio, wd: new Date(s.run.inicio + 'T12:00:00').getDay(), dias: s.run.answers.preferidos }`);
  ok(st1.aceito && st1.wd === 1 && st1.dias.length === 3, `plano gravado, começando na segunda-feira ${st1.inicio}`);
  await foto('3-painel-iniciante');

  console.log('3. Treino do dia, cronômetro guiado e registro');
  ok(await page.eval(`const b = document.querySelector('.item.hoje'); if (!b) return false; b.click(); return true;`), 'o treino de hoje aparece destacado na semana');
  await page.sleep(600);
  t = await texto();
  ok(t.includes('Corrida e caminhada') && t.includes('Teste da fala') && t.includes('Cronômetro guiado'), 'tela do dia mostra o treino, como sentir o esforço e o cronômetro');
  await foto('4-dia');
  await page.click('Iniciar'); await page.sleep(1300);
  const c1 = await page.eval(`return { fase: document.querySelector('.cron-fase').textContent, tempo: document.querySelector('.cron-tempo').textContent };`);
  ok(c1.fase === 'Aquecimento' && /^4:5\d$/.test(c1.tempo), `cronômetro corre no aquecimento (${c1.fase} ${c1.tempo})`);
  ok(await page.eval(`return document.querySelector('.cron').getAttribute('aria-live') === null && document.querySelector('.cron-fase').getAttribute('aria-live') === 'polite' && document.querySelector('.cron-tempo').getAttribute('aria-live') === 'off';`), 'o leitor de tela anuncia a troca de etapa, não o relógio a cada segundo');
  await page.click('Próxima'); await page.sleep(300);
  ok((await page.eval(`return document.querySelector('.cron-fase').textContent;`)) === 'Corra', 'próxima etapa: corrida');
  // o cronômetro fica guardado: recarregar a página não o perde, e o tempo passado com a página fechada é descontado
  const urlDia = await page.eval(`return location.href;`);
  await page.sleep(700); await page.reload(1500); await page.goto(urlDia, 800);
  const c2 = await page.eval(`return { fase: document.querySelector('.cron-fase').textContent, tempo: document.querySelector('.cron-tempo').textContent };`);
  ok(c2.fase === 'Corra' && /^0:[45]\d$/.test(c2.tempo), `cronômetro continua na mesma etapa depois de recarregar (${c2.fase} ${c2.tempo})`);
  await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.run.cron.fim -= 200000; x.run.cron.inicioPasso -= 200000; x.run.cron.inicio -= 200000; }); await st.flush(); return true;`);
  await page.reload(1500); await page.goto(urlDia, 800);
  const c3 = await page.eval(`return { fase: document.querySelector('.cron-fase').textContent, sub: document.querySelector('.cron .small.muted').textContent };`);
  ok(c3.fase === 'Corra' && c3.sub.includes('etapa 4 de'), `depois de 3 min com a página fechada, o cronômetro está na etapa certa (${c3.sub})`);
  await page.click('Pausar'); await page.sleep(1200);
  const p1 = await page.eval(`return document.querySelector('.cron-tempo').textContent;`); await page.sleep(700);
  ok(p1 === (await page.eval(`return document.querySelector('.cron-tempo').textContent;`)), 'pausa segura o tempo');
  await foto('5-cronometro');
  await page.click('Encerrar'); await page.sleep(300); await page.eval(`const b = [...document.querySelectorAll('.sheet-ft .btn')].find((e) => e.textContent.trim() === 'Encerrar'); b.click(); return true;`); await page.sleep(400);
  ok((await texto()).includes('Treino concluído'), 'cronômetro encerrado');
  // registro: tempo sem distância não basta para o teste; informa os dois, esforço e dor
  await page.click('Registrar corrida'); await page.sleep(300);
  ok((await estado('s.runs.length')) === 1 || (await texto()).includes('Informe'), 'registro só com o tempo do cronômetro é aceito (ou pede os dados)');
  if ((await estado('s.runs.length')) === 1) { await page.click('Editar'); await page.sleep(300); }
  // corrida e caminhada: pede as etapas feitas (e o tempo), não a distância
  ok((await modoDoRegistro()) === 'etapas' && !(await page.eval(`return !!document.querySelector('input[aria-label="Distância em quilômetros"]');`)) && !!(await page.eval(`return !!document.querySelector('#registro-medidas input[aria-label="Etapas de corrida feitas"]');`)), 'corrida e caminhada: o registro pede as etapas, sem a distância (' + (await modoDoRegistro()) + ')');
  await tempo('28', '30');
  ok(await page.eval(`return !!document.querySelector('[aria-label="Tipo de corrida"] .chip.on') && !document.querySelector('[aria-label="Esforço percebido"] .chip.on');`), 'o formulário oferece o tipo da corrida, e o esforço começa sem nada marcado');
  await page.eval(`document.querySelector('[aria-label="Esforço percebido"] .chip:nth-child(5)').click(); return true;`); await page.sleep(100);
  await page.eval(`const sw = document.querySelector('input[aria-label="Senti dor"]'); sw.click(); return true;`); await page.sleep(200);
  // duas regiões: joelho (dor em um ponto, 4) e coxa de trás (músculo dolorido, 2); o joelho não oferece "músculo"
  const regiao = (nome) => page.eval(`const c = [...document.querySelectorAll('[aria-label="Onde doeu"] .chip')].find((e) => e.textContent === ${JSON.stringify(nome)}); c.click(); return true;`);
  const tipoDor = (onde, rotulo) => page.eval(`const c = [...document.querySelectorAll('.dor-reg[data-onde="${onde}"] .chip')].find((e) => e.textContent === ${JSON.stringify(rotulo)}); if (!c) return false; c.click(); return true;`);
  await regiao('Joelho'); await page.sleep(150); await regiao('Coxa (atrás)'); await page.sleep(150);
  ok((await page.eval(`return document.querySelectorAll('.dor-reg').length;`)) === 2 && (await page.eval(`return !!document.getElementById('guia-dor-muscular');`)), 'marca duas regiões, cada uma com a sua intensidade, e mostra como reconhecer a dor muscular comum');
  ok(!(await tipoDor('joelho', 'Músculo cansado ou dolorido')), 'no joelho não há a opção de dor muscular');
  await page.eval(`const b = [...document.querySelectorAll('#registro .btn.primary')][0]; b.click(); return true;`); await page.sleep(300);
  const aviso0 = await page.eval(`return [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' | ');`);
  // (a corrida já pode estar gravada só com o tempo do cronômetro: o que não pode é gravar as dores sem o tipo)
  const n0 = await estado('s.runs.length ? s.runs[0].dores.length : 0'); ok(n0 === 0 && /Diga como foi a dor/.test(aviso0), 'sem dizer como foi cada dor, não grava, e avisa: ' + aviso0);
  await tipoDor('joelho', 'Dor em um ponto ou na articulação'); await tipoDor('coxa-tras', 'Músculo cansado ou dolorido');
  await page.click('Aumentar Intensidade da dor: Joelho'); await page.sleep(100);
  await page.click('Diminuir Intensidade da dor: Coxa (atrás)'); await page.sleep(100);
  await preencher('Observação', 'Primeira corrida <b>do plano</b>');
  await page.eval(`const b = [...document.querySelectorAll('#registro .btn.primary')][0]; b.click(); return true;`); await page.sleep(600);
  const r1 = await estado(`{ n: s.runs.length, r: s.runs[0], dores: s.dores.map((d) => [d.onde, d.nivel, d.tipo]) }`);
  ok(r1.n === 1 && !r1.r.distKm && r1.r.etapas && r1.r.durMin === 28.5 && r1.r.pse === 5 && JSON.stringify(r1.r.dores) === JSON.stringify([{ onde: 'joelho', nivel: 4, tipo: 'articular' }, { onde: 'coxa-tras', nivel: 2, tipo: 'muscular' }]), 'corrida gravada com distância, tempo, esforço e as duas dores: ' + JSON.stringify(r1.r).slice(0, 220));
  ok(JSON.stringify(r1.dores) === JSON.stringify([['joelho', 4, 'articular'], ['coxa-tras', 2, 'muscular']]), 'cada dor vira um relato de dor, com o tipo certo: ' + JSON.stringify(r1.dores));
  ok(r1.r.tipo === 'corrida_caminhada' && r1.r.planejado.includes('Corrida e caminhada'), 'registro guarda o tipo e o que estava no plano');
  ok((await estado('s.run.cron')) === null, 'corrida registrada: o cronômetro do dia não fica guardado');
  t = await texto();
  ok(t.includes('registrada') && /\d+ de \d+ etapas/.test(t) && t.includes('Primeira corrida <b>do plano</b>') && !(await page.eval(`return !!document.querySelector('main b:not(.stat b)') && [...document.querySelectorAll('main b')].some((b) => b.textContent === 'do plano');`)), 'registro aparece na tela e o texto digitado não vira HTML');
  await foto('6-registrado');
  t = await texto();
  ok(t.includes('Análise do treino') && (t.includes('Acima do plano') || t.includes('Abaixo do plano') || t.includes('Dentro do plano')) && t.includes('O plano:'), 'a corrida registrada vem com a análise contra o treino do dia');
  ok(await estado(`!!s.runs[0].plan && s.runs[0].plan.tipo === 'corrida_caminhada'`), 'o registro guarda o treino que estava no plano');

  console.log('4. Ajuste do plano, evolução e dor');
  await page.goto(B + '#/corrida', 900);
  t = await texto();
  ok(t.includes('O que ajustei no plano') && t.includes('Joelho:'), 'painel explica o ajuste feito por causa da dor no joelho');
  const evol = await fechado('corrida-evolucao');
  ok(t.includes('Sua evolução') && evol.includes('corrida registrada') && evol.includes('Constância'), 'evolução (seção fechada) mostra volume, corridas e constância');
  ok(t.includes('Como foram os seus treinos') && (await page.eval(`return document.querySelectorAll('#como-foram .item').length === 1;`)), 'painel resume como foram os treinos, com o selo de cada corrida');
  ok(t.includes('Dores que você contou') && t.includes('Feita'), 'cartão de dores e treino marcado como feito');
  // (o primeiro "Por quê?" do cartão "O que ajustei no plano"; o cartão "Sua semana" vem antes e tem o seu)
  await page.eval(`const d = [...document.querySelectorAll('[data-ajustes] details.pq summary')].find((e) => e.textContent === 'Por quê?'); d.click(); return true;`); await page.sleep(150);
  ok((await texto()).includes('Você contou dor de intensidade 4'), 'o motivo do ajuste abre ao toque, com as fontes');
  await foto('7-ajuste');
  // conta uma dor de alerta na canela: a corrida é suspensa
  await page.click('Contar outra dor'); await page.sleep(400);
  await page.eval(`const c = [...document.querySelectorAll('.sheet .chip')].find((e) => e.textContent === 'Canela'); c.click(); return true;`); await page.sleep(100);
  await page.eval(`const o = [...document.querySelectorAll('.sheet .opt')].find((e) => e.textContent.includes('articulação')); o.click(); return true;`); await page.sleep(100);
  await page.eval(`const b = [...document.querySelectorAll('.sheet-ft .btn')].find((e) => e.textContent.trim() === 'Salvar'); b.click(); return true;`); await page.sleep(600);
  t = await texto();
  ok(t.includes('Corrida suspensa') && t.includes('Sem corrida'), 'dor de 4 na canela suspende as corridas dos próximos dias');
  ok(t.includes('O que fazer com essa dor na corrida'), 'orientação por local da dor disponível');
  const sem = await page.eval(`const c = await import('/js/logic/corrida.js'); const s = (await import('/js/store.js')).state; const d = new Date(); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); const p = c.planoDaSemana(s, k); return p.dias.filter(Boolean).map((x) => [x.data >= k, x.tipo]);`);
  ok(sem.filter((x) => x[0]).every((x) => x[1] === 'descanso' || x[1] === 'caminhada'), 'planoDaSemana não traz corrida de hoje em diante: ' + JSON.stringify(sem));
  await foto('8-dor-alerta');
  await page.eval(`const b = [...document.querySelectorAll('.dor')].find((e) => e.textContent.includes('Canela')).querySelector('button'); b.click(); return true;`); await page.sleep(500);
  ok(!(await texto()).includes('Corrida suspensa'), 'marcar “Melhorou” devolve as corridas ao plano');
  // a dor anotada na corrida (joelho) também sai do plano quando a pessoa marca “Melhorou”
  ok((await texto()).includes('Joelho:'), 'o ajuste pela dor no joelho continua enquanto ela está registrada');
  await page.eval(`const b = [...document.querySelectorAll('.dor')].find((e) => e.textContent.includes('Joelho')).querySelector('button'); b.click(); return true;`); await page.sleep(500);
  ok(!(await texto()).includes('Joelho:') && !/joelho/i.test(await page.eval(`return (document.querySelector('[data-ajustes]') || {}).innerText || '';`)), '“Melhorou” no joelho tira o ajuste, mesmo com a dor anotada na corrida');

  console.log('5. Recarregar: tudo persiste');
  await page.reload(1800); await page.goto(B + '#/corrida', 900);
  t = await texto();
  const st2 = await estado(`{ runs: s.runs.length, dores: s.dores.length, aceito: !!s.run.aceitoEm, respostas: Object.keys(s.run.answers).length }`);
  ok(st2.runs === 1 && st2.dores === 3 && st2.aceito && st2.respostas >= 12 && t.includes('Semana 1 de 14'), 'plano, registro e dores continuam depois de recarregar: ' + JSON.stringify(st2));
  // editar e apagar o registro
  await page.eval(`[...document.querySelectorAll('.item')].find((e) => e.textContent.includes('Feita')).click(); return true;`); await page.sleep(600);
  await page.click('Editar'); await page.sleep(300);
  await tempo('28', '30');
  await page.click('Salvar alterações'); await page.sleep(500);
  ok((await estado('s.runs.length')) === 1 && !!(await estado('s.runs[0].etapas')), 'registro editado sem duplicar, com as etapas: ' + JSON.stringify(await estado('s.runs[0].etapas')));
  ok((await estado('s.runs[0].durMin')) === 28.5 && (await estado('s.runs[0].pse')) === 5, '28 min e 30 s nos dois campos, e o esforço gravado é o que estava marcado');
  ok((await estado('s.run.mostrados.length')) >= 1 && (await estado(`s.run.mostrados.some((m) => m.tipo === 'corrida_caminhada')`)), 'o treino mostrado em cada dia fica guardado para a análise das semanas passadas');
  await page.click('Apagar'); await page.sleep(300);
  ok((await texto()).includes('Apagar este registro?'), 'apagar pede confirmação');
  await page.eval(`[...document.querySelectorAll('.sheet-ft .btn')].find((e) => e.textContent.trim() === 'Apagar').click(); return true;`); await page.sleep(500);
  ok((await estado('s.runs.length')) === 0, 'registro apagado');
  // pausar, retomar e encerrar
  await page.goto(B + '#/corrida', 900);
  await page.click('Pausar o plano'); await page.sleep(300); await page.eval(`[...document.querySelectorAll('.sheet-ft .btn')].find((e) => e.textContent.trim() === 'Pausar').click(); return true;`); await page.sleep(500);
  ok((await texto()).includes('Plano pausado') && (await page.eval(`const c = await import('/js/logic/corrida.js'); const s = (await import('/js/store.js')).state; return c.planoDaSemana(s, '2099-01-01') === null && c.resumoParaNutricao(s, '2099-01-01') === null;`)), 'plano pausado sai da semana');
  await page.click('Retomar o plano'); await page.sleep(500);
  ok((await texto()).includes('Semana 1 de 14'), 'plano retomado');
  const pausas = await estado('s.run.pausas');
  ok(pausas.length === 1 && pausas[0].semanas === 0 && pausas[0].de === pausas[0].ate, 'a pausa fica guardada: ' + JSON.stringify(pausas));
  // refazer a entrevista com plano ativo pede confirmação, e cancelar não muda nada
  await page.click('Refazer a entrevista'); await page.sleep(300);
  ok((await texto()).includes('Refazer a entrevista?'), 'refazer a entrevista pede confirmação');
  await page.eval(`[...document.querySelectorAll('.sheet-ft .btn')].find((e) => e.textContent.trim() !== 'Refazer').click(); return true;`); await page.sleep(400);
  ok((await estado('!!s.run.aceitoEm')) && (await texto()).includes('Semana 1 de 14'), 'cancelar mantém o plano');

  console.log('5b. Metas que não cabem e condição de saúde sem liberação');
  const propor = async (respostas) => { await page.eval(`const st = await import('/js/store.js'); st.update((x) => { x.run = { answers: ${JSON.stringify(respostas)}, aceitoEm: '', inicio: '', pausadoEm: '', cron: null, pausas: [] }; x.runs = []; x.dores = []; }); await st.flush(); return true;`); await page.reload(1200); await page.goto(B + '#/corrida', 800); return texto(); };
  const novato = { experiencia: 'nunca', objetivo: 'prova', distancia: '42', semanasProva: 4, temAlvo: 'nao', dias: ['2', '4', '6'], diaLongo: 'auto', tempo: '45', tempoLongo: '150', aparelho: 'tempo', local: 'rua', idade: 30, peso: 70, altura: 170, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  t = await propor(novato);
  ok(t.includes('Não marquei a prova de maratona em 4 semanas') && !t.includes('A prova fica em') && !/Prova: maratona/.test(t), 'maratona em 4 semanas para quem nunca correu: a prova não é marcada, com aviso');
  t = await propor({ ...novato, distancia: '5', semanasProva: 12, tempoLongo: '60' });
  ok(t.includes('A prova fica em') && t.includes('Confira a data'), '5 km em 12 semanas: prova marcada, com a data para conferir');
  const corredor = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'saude', resultado: 'nao', dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], triagem: ['nenhum'] };
  t = await propor({ ...corredor, condicoes: ['cronica'], liberado: 'nao' });
  ok(t.includes('outra doença crônica') && (await page.eval(`const b = [...document.querySelectorAll('.btn')].find((e) => e.textContent.includes('Aceitar e usar este plano')); return b.disabled;`)), 'doença crônica sem liberação: aviso e aceite só depois da confirmação');
  await page.eval(`document.querySelector('input[aria-label="Confirmo que li os avisos"]').click(); return true;`); await page.sleep(200);
  ok(await page.eval(`const b = [...document.querySelectorAll('.btn')].find((e) => e.textContent.includes('Aceitar e usar este plano')); return !b.disabled;`), 'com a confirmação, o aceite é liberado');
  t = await propor({ ...corredor, condicoes: ['cardiaco'], liberado: 'nao' });
  ok(t.includes('liberação médica') && t.includes('vigoroso') && !t.includes('Aceitar e usar este plano'), 'doença do coração sem liberação: sem plano, com a explicação');
  t = await propor({ ...corredor, condicoes: ['nenhuma'], resultado: '5', resultadoMin: 45 });
  ok((await fechado('corrida-cuidados')).includes('caminhada rápida') && t.includes('tempo e esforço') && !/\d:\d\d a \d\d?:\d\d por km/.test(t), 'resultado muito lento: treinos por tempo e esforço, sem faixas de ritmo (o porquê em “Cuidados”)');
  t = await propor({ experiencia: 'irregular', longoAtual: 4, objetivo: 'saude', dias: ['1', '3', '5', '6'], diaLongo: 'auto', tempo: '45', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] });
  ok((await fechado('corrida-cuidados')).includes('sem regularidade') && t.includes('3 corridas por semana') && t.includes('tempo e esforço') && !/\d:\d\d a \d\d?:\d\d por km/.test(t), 'corredor irregular: 3 corridas por semana, por tempo e esforço, com a explicação');
  // a opção aparece na entrevista
  await page.click('Mudar respostas'); await page.sleep(400);
  // a entrevista começa pela idade e pelas perguntas de segurança (ordem do PAR-Q+); a experiência vem depois delas
  ok((await page.eval(`return document.querySelector('.bubble h2').textContent;`)) === 'Quantos anos você tem?', 'a entrevista da corrida começa pela idade');
  // (a pergunta dos remédios entrou depois: sem resposta guardada, a pessoa marca "Nenhum", a última opção)
  for (let n = 0; n < 8 && !(await texto()).includes('Como é a sua corrida'); n++) { await page.eval(`const b = [...document.querySelectorAll('button.btn.primary')].find((e) => /Continuar/.test(e.textContent)); if (b && b.disabled) { const o = [...document.querySelectorAll('.opt')].pop(); if (o) o.click(); await new Promise((r) => setTimeout(r, 80)); } if (b && !b.disabled) b.click(); return true;`); await page.sleep(250); }
  ok((await texto()).includes('Corro de vez em quando, devagar'), 'a entrevista oferece a opção de quem corre de vez em quando, devagar');
  await page.reload(1200);

  console.log('5c. Corrida e musculação: prioridade e análise do treino feito');
  const hojeK = await page.eval(`const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');`);
  const doisTreinos = async (foco) => {
    const respostas = { ...corredor, condicoes: ['nenhuma'], experiencia: 'avancado', kmSemana: 45, longoAtual: 14, provas: 'meia', dias: ['1', '2', '3', '4', '5', '6'], resultado: '10', resultadoMin: 52 };
    await page.eval(`const st = await import('/js/store.js'); st.update((x) => {
      x.run = { answers: ${JSON.stringify(respostas)}, aceitoEm: new Date().toISOString(), inicio: ${JSON.stringify(hojeK)}, pausadoEm: '', cron: null, pausas: [] };
      x.plans = [{ id: 'pe2e', nome: 'Meu treino', origem: 'modelo', criadoEm: new Date().toISOString(), dias: [{ id: 'de2e', nome: 'Treino A', foco: '', itens: [{ ex: 'agachamento', series: 3, reps: '8-12' }] }], agenda: { 2: 'de2e', 4: 'de2e' }, info: '' }];
      x.activePlan = 'pe2e';
      x.combo = { foco: ${JSON.stringify(foco)}, fortalecimento: 'nao', em: new Date().toISOString() };
      x.runs = [{ id: 'ce2e', data: ${JSON.stringify(hojeK)}, tipo: 'leve', distKm: 8, durMin: 40, pse: 6, dor: null, nota: '', planejado: '', plan: { tipo: 'leve', durMin: 30, distKm: 0, ritmo: [350, 370], pse: [2, 4] } }];
      x.dores = [];
    }); return true;`);
    await page.goto(B + '#/treinos', 500); await page.goto(B + '#/corrida', 900);
    return texto();
  };
  t = await doisTreinos('');
  ok(t.includes('Corrida e musculação: o que vem primeiro?'), 'com os dois treinos e sem escolha, o painel pergunta o que vem primeiro');
  const corridasSemFoco = await page.eval(`return document.querySelectorAll('.list .item[data-data]').length;`);
  t = await doisTreinos('musculacao');
  ok(t.includes('Prioridade: musculação') && t.includes('Corrida como complemento da musculação') && (await page.eval(`return document.querySelectorAll('.list .item[data-data]').length;`)) <= 3 && corridasSemFoco >= 5, 'prioridade para a musculação: corrida vira complemento (até 3 por semana), e o ajuste aparece explicado');
  t = await doisTreinos('equilibrio');
  ok(t.includes('Prioridade: os dois por igual') && t.includes('até 4 corridas por semana') && (await page.eval(`return document.querySelectorAll('.list .item[data-data]').length;`)) <= 4, 'os dois por igual: até 4 corridas por semana');
  ok(t.includes('Como foram os seus treinos') && (await fechado('como-foram')).includes('Acima do plano'),'corrida de 40 min em treino de 30, mais rápida e com esforço 6: selo “Acima do plano”');
  await page.goto(B + '#/corrida/dia/' + hojeK, 800);
  t = await texto();
  ok(t.includes('10 min a mais que o planejado (30 min)') && t.includes('mais rápido que a faixa (5:50 a 6:10)') && t.includes('virou moderado') && t.includes('O plano:'), 'análise diz o que foi diferente (mais tempo, mais rápido, esforço alto) e o que o plano faz');
  if (process.env.FOTOS_CORRIDA) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 760, deviceScaleFactor: 1, mobile: true });
    for (const tema of ['claro', 'escuro']) {
      const aplicar = `if (${JSON.stringify(tema)} === 'claro') document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme;`;
      await page.goto(B + '#/corrida', 800); await page.eval(aplicar + ' window.scrollTo(0, 0); return true;'); await page.sleep(200); await foto('r4-painel-' + tema);
      await page.eval(`document.getElementById('cartao-combinado').scrollIntoView({ block: 'start' }); return true;`); await page.sleep(200); await foto('r4-combinado-' + tema);
      await page.eval(`document.getElementById('como-foram').scrollIntoView({ block: 'start' }); return true;`); await page.sleep(200); await foto('r4-como-foram-' + tema);
      await page.goto(B + '#/corrida/dia/' + hojeK, 800); await page.eval(aplicar + ` document.querySelector('[data-analise]').scrollIntoView({ block: 'center' }); return true;`); await page.sleep(200); await foto('r4-analise-' + tema);
      ok(await page.eval(`return document.documentElement.scrollWidth <= 361;`), `análise cabe em 360 px (${tema})`);
    }
    await page.eval(`delete document.documentElement.dataset.theme; return true;`);
    await page.send('Emulation.clearDeviceMetricsOverride', {});
  }

  console.log('6. Perfil avançado: maratona com ritmos');
  await page.eval(`const s = await import('/js/store.js'); await s.resetAll(); return true;`);
  await page.goto(B + '#/corrida', 900); await page.reload(1500); await page.goto(B + '#/corrida', 700);
  await page.click('Agora não');
  await page.click('Começar'); await page.sleep(400);
  await entrevista({
    'Como é a sua corrida': 'Treino há anos, com bom volume', 'quilômetros você corre': 58, 'corrida mais longa': 24, 'maior prova': 'Maratona', 'sem correr': 'Estou correndo',
    'objetivo na corrida': 'Preparar uma prova com data', 'Qual distância': 'Maratona', 'quantas semanas': 16, 'tempo em mente': 'Sim', 'tempo-alvo': 225,
    'resultado recente': 'Meia maratona', 'Em quanto tempo?': 104.5, 'prefere correr': [dia(1), dia(2), dia(3), dia(5), dia(6), dia(0)], 'não pode correr': [dia(4)], 'melhor dia para o treino mais longo': dia(6),
    'tempo você tem por treino': 'Até 1h30', 'treino mais longo': 'Até 3 horas', 'mede as suas corridas': 'Relógio ou aplicativo com GPS', 'Onde você corre': 'Rua, parque ou calçadão',
    anos: 38, peso: 68, altura: 176, 'lesão nos últimos': 'Não', 'dor em alguma': 'Nenhuma', condições: 'Nenhuma', sinais: 'Nenhum deles', 'remédio de uso contínuo': 'Nenhum',
  });
  t = await texto();
  ok(t.includes('Montei um plano de 16 semanas') && t.includes('maratona') && t.includes('6 corridas por semana') && t.includes('A prova fica em'), 'proposta de 16 semanas para a maratona, 6 corridas por semana, com a data da prova');
  ok(t.includes('distância e faixa de ritmo') && /\d:\d\d a \d:\d\d por km/.test(t), 'treinos por distância, com faixas de ritmo calculadas pelo resultado');
  await page.eval(`[...document.querySelectorAll('details.acc summary')].find((e) => e.textContent.includes('Zonas de esforço')).click(); return true;`); await page.sleep(150);
  t = await texto();
  ok(t.includes('Calculado pelo seu resultado') && t.includes('maratona entre'), 'zonas mostram a base do cálculo e a previsão de maratona em faixa');
  await page.eval(`[...document.querySelectorAll('details.acc summary')].find((e) => e.textContent.includes('semanas do plano')).click(); return true;`); await page.sleep(150);
  t = await texto();
  ok(t.includes('Polimento') && t.includes('(leve)') && t.includes('Específico'), 'as semanas mostram base, construção, específico, semanas leves e polimento');
  await foto('9-proposta-avancado');
  await page.click('Aceitar e usar este plano'); await page.sleep(700);
  await responderFortalecimento();
  t = await texto();
  ok(t.includes('Semana 1 de 16') && t.includes('Prova de maratona'), 'painel do avançado com a data da prova');
  const plano = await page.eval(`const c = await import('/js/logic/corrida.js'); const s = (await import('/js/store.js')).state; const d = new Date(); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); const p = c.planoAtual(s, k); const n = c.resumoParaNutricao(s, k); return { tipos: [...new Set(p.semanas.flatMap((x) => x.dias.map((y) => y.tipo)))], hoje: (c.planoDaSemana(s, k).dias[d.getDay()] || {}).tipo, n };`);
  ok(['leve', 'regenerativo', 'longo', 'tempo', 'intervalado', 'fartlek', 'progressivo', 'ritmo', 'prova'].every((x) => plano.tipos.includes(x)), 'plano avançado usa todos os tipos de treino: ' + plano.tipos.join(', '));
  ok(plano.n && plano.n.prova && plano.n.prova.distKm > 42 && plano.n.sessoesSemana === 6 && plano.n.nivel === 3, 'resumo para a nutrição traz a prova e a semana: ' + JSON.stringify(plano.n).slice(0, 200));
  await page.eval(`document.querySelector('.item.hoje').click(); return true;`); await page.sleep(600);
  t = await texto();
  ok(/Ritmo/.test(t) && /por km/.test(t) && t.includes('Como foi a corrida?'), 'treino de hoje do avançado mostra o ritmo e o formulário');
  await foto('10-dia-avancado');
  ok((await km('800')) && (await page.eval(`return document.querySelector('input[aria-label="Distância em quilômetros"]').value;`)) === '8,00', 'distância só com números: 8, 0, 0 vira 8,00');
  await tempo('46');
  await page.click('Registrar corrida'); await page.sleep(500);
  ok((await estado('s.runs.length')) === 1, 'corrida do avançado registrada');
  // registro impossível é recusado
  await page.click('Registrar outra corrida neste dia'); await page.sleep(300);
  await km('1000'); await tempo('9');
  await page.eval(`[...document.querySelectorAll('#registro .btn.primary')].pop().click(); return true;`); await page.sleep(400);
  ok((await estado('s.runs.length')) === 1, 'ritmo impossível (10 km em 9 min) não é gravado');
  t = await texto();
  ok(t.includes('Intervalos e parciais') && t.includes('Cronometrar intervalos') && !t.includes('Adicionar treino manual'), '“Registrar outra corrida” oferece o formulário completo de intervalos sem um segundo botão');
  await page.click('Adicionar intervalo');
  const mascara = await page.eval(`const i = document.querySelector('[aria-label="Tempo do intervalo 1"]'); if (!i) return false; i.value = '0500'; i.dispatchEvent(new Event('input', { bubbles: true })); return i.value;`);
  ok(mascara === '05:00', 'o formulário único mantém o preenchimento e a máscara do tempo dos intervalos');

  console.log('7. Corrida nas outras telas e encerramento');
  await page.goto(B + '#/treinos', 900);
  t = await texto();
  ok(/corrida/i.test(t), 'aba Treinos mostra a corrida da semana');
  await page.goto(B, 900);
  ok(/corrida/i.test(await texto()), 'tela inicial mostra a corrida');
  await page.goto(B + '#/corrida/dia/2026-02-31', 700);
  ok((await page.eval(`return location.hash;`)) !== '#/corrida/dia/2026-02-31', 'data impossível no endereço volta para o painel');
  await page.goto(B + '#/corrida', 900);
  await page.click('Encerrar o plano'); await page.sleep(300); await page.eval(`[...document.querySelectorAll('.sheet-ft .btn')].find((e) => e.textContent.trim() === 'Encerrar').click(); return true;`); await page.sleep(600);
  const fim = await estado(`{ aceito: s.run.aceitoEm, runs: s.runs.length, respostas: Object.keys(s.run.answers).length }`);
  ok(fim.aceito === '' && fim.runs === 1 && fim.respostas > 10 && (await texto()).includes('Montei um plano'), 'plano encerrado: registros e respostas ficam, e a proposta volta a aparecer');
  // tela estreita (360 px): nada estoura a largura
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 760, deviceScaleFactor: 1, mobile: true });
  await page.goto(B + '#/corrida', 900);
  ok(await page.eval(`return document.documentElement.scrollWidth <= 361;`), 'proposta cabe em 360 px sem rolagem lateral');
  await foto('11-360');

  console.log('8. Sua semana: 1º treino de pernas depois de 3 semanas, hoje, e o longão amanhã');
  await page.send('Emulation.clearDeviceMetricsOverride', {});
  // estado de teste: plano de corrida aceito há 4 semanas (terça, quinta e sábado; longão na terça), corridas registradas nas
  // semanas anteriores e musculação com pernas hoje; o último treino de pernas foi há 25 dias
  const montado = await page.eval(`
    const s = await import('/js/store.js'); const c = await import('/js/logic/corrida.js');
    const k = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const hoje = k(new Date()); const seg = c.segundaDe(hoje);
    const a = { idade: 34, experiencia: 'regular', kmSemana: 30, longoAtual: 14, pausa: 'treinando', objetivo: 'distancia', distancia: '21', dias: ['2', '4', '6'], diaLongo: '2', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', peso: 75, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], remedios: ['nenhum'], resultado: 'nao' };
    for (const q of c.PERGUNTAS) if (!(q.k in a) && !(q.se && !q.se(a)) && !q.opcional) a[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
    const runs = [];
    for (let w = 1; w <= 4; w++) { const b = c.somaDias(seg, -7 * w); runs.push({ id: 'ra' + w, data: c.somaDias(b, 1), tipo: 'longo', distKm: 13, durMin: 80, pse: 4 }, { id: 'rb' + w, data: c.somaDias(b, 3), tipo: 'leve', distKm: 8, durMin: 48, pse: 4 }, { id: 'rc' + w, data: c.somaDias(b, 5), tipo: 'leve', distKm: 7, durMin: 42, pse: 4 }); }
    const it = (ex) => ({ ex, series: 3, reps: '8-12', descanso: 90, nota: '' });
    const pernas = [it('agachamento-peso-corporal'), it('flexao-nordica'), it('ponte-gluteos-solo')];
    const d25 = new Date(Date.now() - 25 * 86400000); d25.setHours(18, 0, 0, 0);
    const sess = { id: 'sv1', planId: 'p1', diaId: 'a', nome: 'Pernas', inicio: d25.toISOString(), fim: new Date(d25.getTime() + 3600000).toISOString(), nota: '', itens: pernas.map((x) => ({ ex: x.ex, alvo: '10', descanso: 90, sets: [1, 2, 3].map(() => ({ kg: 20, reps: 10, seg: null, ok: true })) })) };
    const dados = { v: s.VERSAO, plans: [{ id: 'p1', nome: 'Meu treino', origem: 'manual', criadoEm: new Date(Date.now() - 60 * 86400000).toISOString(), dias: [{ id: 'a', nome: 'Pernas', foco: '', itens: pernas }], agenda: { 1: 'a' }, info: '' }], activePlan: 'p1',
      sessions: [sess], runs, run: { answers: a, aceitoEm: new Date(Date.now() - 28 * 86400000).toISOString(), inicio: c.somaDias(seg, -28), pausadoEm: '' }, combo: { foco: 'corrida', fortalecimento: 'nao', em: new Date().toISOString() } };
    s.importData(JSON.stringify({ app: 'fitcore', v: s.VERSAO, dados }));
    return { hoje, ok: !!c.planoAtual(s.state, hoje) };`);
  ok(montado.ok, 'estado de teste com plano de corrida e treino de pernas hoje');
  await page.reload(1500); await page.goto(B + '#/corrida', 1000);
  t = await texto();
  const card = await page.eval(`const e = document.getElementById('corrida-sua-semana'); return e ? { nivel: e.dataset.nivel, aplicado: e.dataset.aplicado, txt: e.innerText } : null;`);
  ok(card && card.nivel === 'puxada' && /Semana puxada: 1º treino de pernas depois de [34] semanas hoje/.test(card.txt), 'cartão "Sua semana" mostra a semana puxada: ' + (card ? card.txt.replace(/\n/g, ' | ').slice(0, 200) : 'sem cartão'));
  ok(card && /Longão de amanhã: (mais curto|passa para)/.test(card.txt), 'o cartão diz o que muda no longão de amanhã');
  const naTela = await page.eval(`const e = document.getElementById('corrida-sua-semana'); const r = e.getBoundingClientRect(); return r.top < 2.5 * innerHeight;`);
  ok(naTela, 'o cartão aparece logo no começo do painel');
  await page.goto(B, 900);
  ok(await page.eval(`const e = document.getElementById('inicio-carga'); return !!e && e.dataset.aplicado === 'nao' && /Longão de amanhã/.test(e.innerText);`), 'Início avisa que o longão de amanhã pode mudar');
  await foto('s1-inicio');
  await page.goto(B + '#/corrida', 900);
  const longoAntes = await page.eval(`const c = await import('/js/logic/corrida.js'); const s = (await import('/js/store.js')).state; const amanha = c.somaDias(${JSON.stringify(montado.hoje)}, 1); const d = c.treinoDoDia(s, ${JSON.stringify(montado.hoje)}, amanha); return d ? { tipo: d.tipo, durMin: d.durMin } : null;`);
  await page.eval(`document.getElementById('corrida-sua-semana').scrollIntoView({ block: 'start' }); return true;`); await page.sleep(150);
  await foto('s2-sua-semana');
  await page.click('Ajustar a semana'); await page.sleep(300);
  ok((await texto()).includes('Ajustar a sua semana?'), 'pede confirmação antes de ajustar');
  await page.eval(`[...document.querySelectorAll('.sheet-ft .btn')].find((e) => e.textContent.trim() === 'Ajustar').click(); return true;`); await page.sleep(700);
  const aplicado = await estado(`{ carga: s.run.carga.length, movidas: s.perdidos.filter((e) => e.tipo === 'corrida' && e.para).length }`);
  ok(aplicado.carga === 1, 'ajuste guardado: ' + JSON.stringify(aplicado));
  const longoDepois = await page.eval(`const c = await import('/js/logic/corrida.js'); const s = (await import('/js/store.js')).state; const amanha = c.somaDias(${JSON.stringify(montado.hoje)}, 1); const d = c.treinoDoDia(s, ${JSON.stringify(montado.hoje)}, amanha); return d ? { tipo: d.tipo, durMin: d.durMin } : null;`);
  ok(longoAntes && (aplicado.movidas === 1 ? !longoDepois : longoDepois && longoDepois.durMin < longoAntes.durMin), `o longão de amanhã mudou: ${JSON.stringify(longoAntes)} → ${JSON.stringify(longoDepois)}`);
  ok(await page.eval(`const e = document.getElementById('corrida-sua-semana'); return e.dataset.aplicado === 'sim' && /Desfazer/.test(e.innerText) && !/Ajustar a semana/.test(e.innerText);`), 'cartão mostra o ajuste feito e o "Desfazer"');
  await page.eval(`window.scrollTo(0, 0); return true;`); await page.sleep(100);
  await foto('s3-ajustado');
  await page.reload(1500); await page.goto(B + '#/corrida', 800);
  ok((await estado('s.run.carga.length')) === 1 && (await page.eval(`return document.getElementById('corrida-sua-semana').dataset.aplicado;`)) === 'sim', 'o ajuste continua depois de recarregar');
  await page.goto(B, 800);
  ok(await page.eval(`const e = document.getElementById('inicio-carga'); return !!e && e.dataset.aplicado === 'sim';`), 'Início mostra o longão já ajustado');
  await page.goto(B + '#/corrida', 800);
  await page.click('Desfazer'); await page.sleep(500);
  const desfeito = await estado(`{ carga: s.run.carga.length, movidas: s.perdidos.filter((e) => e.tipo === 'corrida' && e.para).length }`);
  ok(desfeito.carga === 0 && desfeito.movidas === 0 && (await page.eval(`return document.getElementById('corrida-sua-semana').dataset.aplicado;`)) === 'nao', 'Desfazer volta ao plano');
  // 360 px, claro e escuro
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 760, deviceScaleFactor: 1, mobile: true });
  for (const tema of ['claro', 'escuro']) {
    await page.goto(B + '#/corrida', 800);
    await page.eval(`if (${JSON.stringify(tema)} === 'claro') document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme; document.getElementById('corrida-sua-semana').scrollIntoView({ block: 'start' }); return true;`); await page.sleep(200);
    ok(await page.eval(`return document.documentElement.scrollWidth <= 361;`), `"Sua semana" cabe em 360 px (${tema})`);
    if (process.env.FOTOS_SEMANA) await page.shot('semana/360-' + tema);
  }
  await page.eval(`delete document.documentElement.dataset.theme; return true;`);
  await page.goto(B, 800);
  if (process.env.FOTOS_SEMANA) await page.shot('semana/360-inicio');
  await page.send('Emulation.clearDeviceMetricsOverride', {});

  const erros = page.erros.filter((e) => !/favicon|SWv:/.test(e));
  ok(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' || ').slice(0, 500) : ''));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

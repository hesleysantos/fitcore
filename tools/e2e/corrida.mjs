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
      if (typeof v === 'number') {
        const pos = await page.eval(`const i = document.querySelector('.stepper input'); if (!i) return false; i.value = ${JSON.stringify(String(v).replace('.', ','))}; i.dispatchEvent(new Event('change', { bubbles: true })); return true;`);
        if (!pos) falhas.push('campo numérico não encontrado: ' + q);
      } else if (v !== undefined) {
        for (const alvo of [].concat(v)) {
          const achou = await page.eval(`const alvo = ${JSON.stringify(alvo)}; const o = [...document.querySelectorAll('.opt')].find((e) => e.querySelector('.o-t').textContent.trim() === alvo) || [...document.querySelectorAll('.opt')].find((e) => e.textContent.includes(alvo)); if (!o) return false; if (o.getAttribute('aria-checked') !== 'true') o.click(); return true;`);
          if (!achou) falhas.push('opção não encontrada: ' + q + ' -> ' + alvo);
        }
      } else if (!(await page.eval(`return !!document.querySelector('.stepper input');`))) falhas.push('pergunta sem resposta no roteiro: ' + q);
      await page.sleep(100);
      const avancou = await page.eval(`const b = [...document.querySelectorAll('button.btn.primary')].find((e) => /Continuar|Concluir/.test(e.textContent)); if (!b || b.disabled) return false; b.click(); return true;`);
      if (!avancou) { falhas.push('não avançou na pergunta: ' + q); break; }
      await page.sleep(200);
    }
  }
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
    'Como é a sua corrida': 'Nunca corri', 'objetivo na corrida': 'Começar a correr', 'quais dias': [dia(0), dia(2), dia(4)], 'melhor dia para o treino mais longo': 'Tanto faz',
    'tempo você tem por treino': 'Cerca de 45 minutos', 'mede as suas corridas': 'Relógio ou aplicativo com GPS', 'Onde você corre': 'Rua, parque ou calçadão',
    anos: 41, peso: 92, altura: 168, 'lesão nos últimos': 'Não', 'dor em alguma': 'Nenhuma', condições: 'Nenhuma', sinais: 'Nenhum deles',
  });
  t = await texto();
  ok(t.includes('Montei um plano de 14 semanas') && t.includes('3 corridas por semana'), 'proposta: 14 semanas, 3 corridas por semana (começo mais lento pelo IMC)');
  ok(t.includes('tempo e esforço') && t.includes('mais indicada para quem está começando'), 'iniciante com GPS recebe treinos por tempo e esforço, com a explicação');
  ok(t.includes('menos de 3 km de corrida na primeira semana'), 'aviso do começo mais lento aparece');
  ok(t.includes('1 min correndo + 2 min caminhando'), 'primeira semana alterna corrida e caminhada');
  await foto('2-proposta-iniciante');
  await page.click('Aceitar e usar este plano'); await page.sleep(700);
  ok(await responderFortalecimento(), 'logo depois do aceite, a pergunta sobre fortalecimento para a corrida');
  ok((await estado('s.combo.fortalecimento')) === 'nao' && (await texto()).includes('Fortalecimento: sem fortalecimento'), 'a escolha fica gravada e aparece no cartão do painel');
  t = await texto();
  ok(t.includes('Semana 1 de 14') && t.includes('Esta semana'), 'painel mostra a semana 1 de 14');
  const st1 = await estado(`{ aceito: !!s.run.aceitoEm, inicio: s.run.inicio, wd: new Date(s.run.inicio + 'T12:00:00').getDay(), dias: s.run.answers.dias }`);
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
  await preencher('Distância em quilômetros', '2,6');
  await preencher('Tempo em minutos, ou minutos e segundos', '28:30');
  ok(await page.eval(`return !!document.querySelector('[aria-label="Tipo de corrida"] .chip.on') && !document.querySelector('[aria-label="Esforço percebido"] .chip.on');`), 'o formulário oferece o tipo da corrida, e o esforço começa sem nada marcado');
  await page.eval(`document.querySelector('[aria-label="Esforço percebido"] .chip:nth-child(5)').click(); return true;`); await page.sleep(100);
  await page.eval(`const sw = document.querySelector('input[aria-label="Senti dor"]'); sw.click(); return true;`); await page.sleep(200);
  await page.eval(`const c = [...document.querySelectorAll('[aria-label="Onde doeu"] .chip')].find((e) => e.textContent === 'Joelho'); c.click(); return true;`); await page.sleep(150);
  await page.click('Aumentar Intensidade da dor'); await page.sleep(100);
  await preencher('Observação', 'Primeira corrida <b>do plano</b>');
  await page.eval(`const b = [...document.querySelectorAll('#registro .btn.primary')][0]; b.click(); return true;`); await page.sleep(600);
  const r1 = await estado(`{ n: s.runs.length, r: s.runs[0], dores: s.dores.map((d) => [d.onde, d.nivel, d.tipo]) }`);
  ok(r1.n === 1 && r1.r.distKm === 2.6 && r1.r.durMin === 28.5 && r1.r.pse === 5 && r1.r.dor && r1.r.dor.onde === 'joelho' && r1.r.dor.nivel === 4, 'corrida gravada com distância, tempo, esforço e dor: ' + JSON.stringify(r1.r).slice(0, 160));
  ok(r1.r.tipo === 'corrida_caminhada' && r1.r.planejado.includes('Corrida e caminhada'), 'registro guarda o tipo e o que estava no plano');
  ok(r1.dores.length === 1 && r1.dores[0][0] === 'joelho' && r1.dores[0][1] === 4, 'a dor da corrida virou um relato de dor para os dois treinadores');
  ok((await estado('s.run.cron')) === null, 'corrida registrada: o cronômetro do dia não fica guardado');
  t = await texto();
  ok(t.includes('registrada') && t.includes('2,6 km') && t.includes('Primeira corrida <b>do plano</b>') && !(await page.eval(`return !!document.querySelector('main b:not(.stat b)') && [...document.querySelectorAll('main b')].some((b) => b.textContent === 'do plano');`)), 'registro aparece na tela e o texto digitado não vira HTML');
  await foto('6-registrado');
  t = await texto();
  ok(t.includes('Análise do treino') && (t.includes('Acima do plano') || t.includes('Abaixo do plano') || t.includes('Dentro do plano')) && t.includes('O plano:'), 'a corrida registrada vem com a análise contra o treino do dia');
  ok(await estado(`!!s.runs[0].plan && s.runs[0].plan.tipo === 'corrida_caminhada'`), 'o registro guarda o treino que estava no plano');

  console.log('4. Ajuste do plano, evolução e dor');
  await page.goto(B + '#/corrida', 900);
  t = await texto();
  ok(t.includes('O que ajustei no plano') && t.includes('Joelho:'), 'painel explica o ajuste feito por causa da dor no joelho');
  ok(t.includes('Sua evolução') && t.includes('corrida registrada') && t.includes('Constância'), 'evolução mostra volume, corridas e constância');
  ok(t.includes('Como foram os seus treinos') && (await page.eval(`return document.querySelectorAll('#como-foram .item').length === 1;`)), 'painel resume como foram os treinos, com o selo de cada corrida');
  ok(t.includes('Dor que você contou') && t.includes('Feita'), 'cartão de dores e treino marcado como feito');
  await page.eval(`const d = [...document.querySelectorAll('details.pq summary')].find((e) => e.textContent === 'Por quê?'); d.click(); return true;`); await page.sleep(150);
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
  ok(!(await texto()).includes('Joelho:') && !(await texto()).includes('O que ajustei no plano'), '“Melhorou” no joelho tira o ajuste, mesmo com a dor anotada na corrida');

  console.log('5. Recarregar: tudo persiste');
  await page.reload(1800); await page.goto(B + '#/corrida', 900);
  t = await texto();
  const st2 = await estado(`{ runs: s.runs.length, dores: s.dores.length, aceito: !!s.run.aceitoEm, respostas: Object.keys(s.run.answers).length }`);
  ok(st2.runs === 1 && st2.dores === 2 && st2.aceito && st2.respostas >= 12 && t.includes('Semana 1 de 14'), 'plano, registro e dores continuam depois de recarregar: ' + JSON.stringify(st2));
  // editar e apagar o registro
  await page.eval(`[...document.querySelectorAll('.item')].find((e) => e.textContent.includes('Feita')).click(); return true;`); await page.sleep(600);
  await page.click('Editar'); await page.sleep(300);
  await preencher('Distância em quilômetros', '3');
  await preencher('Tempo em minutos, ou minutos e segundos', '28.30');
  await page.click('Salvar alterações'); await page.sleep(500);
  ok((await estado('s.runs[0].distKm')) === 3 && (await estado('s.runs.length')) === 1, 'registro editado sem duplicar');
  ok((await estado('s.runs[0].durMin')) === 28.5 && (await estado('s.runs[0].pse')) === 5, '“28.30” é lido como 28 min 30 s, e o esforço gravado é o que estava marcado');
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
  ok(t.includes('caminhada rápida') && t.includes('tempo e esforço') && !/\d:\d\d a \d\d?:\d\d por km/.test(t), 'resultado muito lento: treinos por tempo e esforço, sem faixas de ritmo');
  t = await propor({ experiencia: 'irregular', longoAtual: 4, objetivo: 'saude', dias: ['1', '3', '5', '6'], diaLongo: 'auto', tempo: '45', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] });
  ok(t.includes('sem regularidade') && t.includes('3 corridas por semana') && t.includes('tempo e esforço') && !/\d:\d\d a \d\d?:\d\d por km/.test(t), 'corredor irregular: 3 corridas por semana, por tempo e esforço, com a explicação');
  // a opção aparece na entrevista
  await page.click('Mudar respostas'); await page.sleep(400);
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
  ok(t.includes('Como foram os seus treinos') && t.includes('Acima do plano'), 'corrida de 40 min em treino de 30, mais rápida e com esforço 6: selo “Acima do plano”');
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
    'resultado recente': 'Meia maratona', 'quanto tempo, em minutos': 104.5, 'quais dias': [dia(0), dia(1), dia(2), dia(3), dia(5), dia(6)], 'melhor dia para o treino mais longo': dia(6),
    'tempo você tem por treino': 'Até 1h30', 'treino mais longo': 'Até 3 horas', 'mede as suas corridas': 'Relógio ou aplicativo com GPS', 'Onde você corre': 'Rua, parque ou calçadão',
    anos: 38, peso: 68, altura: 176, 'lesão nos últimos': 'Não', 'dor em alguma': 'Nenhuma', condições: 'Nenhuma', sinais: 'Nenhum deles',
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
  await preencher('Distância em quilômetros', '8'); await preencher('Tempo em minutos, ou minutos e segundos', '46');
  await page.click('Registrar corrida'); await page.sleep(500);
  ok((await estado('s.runs.length')) === 1, 'corrida do avançado registrada');
  // registro impossível é recusado
  await page.click('Registrar outra corrida neste dia'); await page.sleep(300);
  await preencher('Distância em quilômetros', '10'); await preencher('Tempo em minutos, ou minutos e segundos', '9');
  await page.eval(`[...document.querySelectorAll('#registro .btn.primary')].pop().click(); return true;`); await page.sleep(400);
  ok((await estado('s.runs.length')) === 1, 'ritmo impossível (10 km em 9 min) não é gravado');

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

  const erros = page.erros.filter((e) => !/favicon|SWv:/.test(e));
  ok(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' || ').slice(0, 500) : ''));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

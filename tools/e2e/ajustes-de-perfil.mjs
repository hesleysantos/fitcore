// Teste de ponta a ponta de duas regras do perfil do usuário, clicando nas telas:
// 1) o objetivo do Treinador e o da Nutricionista andam juntos, e o usuário pode manter diferentes;
// 2) o tempo sem treinar antes de voltar entra no Treinador, na carga sugerida do treino e nas dicas.
// Uso (com "npm start" rodando): node tools/e2e/navegador.mjs tools/e2e/ajustes-de-perfil.mjs
import { semear, B } from './exemplo.mjs';

export default async (page) => {
  const falhas = [];
  const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✖ ') + msg); if (!cond) falhas.push(msg); };
  const texto = () => page.text();
  const estado = () => page.eval(`const s = (await import('/js/store.js')).state; return { t: s.trainer.answers.objetivo, n: s.nutri.answers.objetivo, ok: s.ui.objetivosOk, aceito: !!s.trainer.aceitoEm, pausa: s.trainer.answers.pausa };`);
  const pergunta = () => page.eval(`const h2 = document.querySelector('.bubble h2'); return h2 ? h2.textContent : '';`);
  const marcada = () => page.eval(`const o = document.querySelector('.opt[aria-checked=true]'); return o ? o.querySelector('.o-t').textContent : '';`);
  const escolher = (rotulo) => page.eval(`const o = [...document.querySelectorAll('.opt')].find((e) => e.querySelector('.o-t') && e.querySelector('.o-t').textContent === ${JSON.stringify(rotulo)}); if (!o) return false; o.click(); return true;`);
  // (número com o valor de partida — idade, peso, altura —: a pessoa confirma em "Está certo" antes de continuar)
  const avancar = () => page.eval(`const c = [...document.querySelectorAll('[data-informar] button')].find((e) => e.textContent.trim() === 'Está certo'); if (c) { c.click(); await new Promise((r) => setTimeout(r, 60)); } const b = [...document.querySelectorAll('button.btn.primary')].find((e) => /^(Continuar|Concluir)$/.test(e.textContent.trim())); if (!b || b.disabled) return false; b.click(); return true;`);
  // segue a entrevista até o fim, respondendo só as perguntas indicadas; devolve os títulos das perguntas vistas
  async function entrevista(respostas = {}) {
    const vistas = [];
    for (let n = 0; n < 25; n++) {
      const q = await pergunta();
      if (!q) break;
      vistas.push(q);
      const k = Object.keys(respostas).find((x) => q.includes(x));
      if (k && !(await escolher(respostas[k]))) falhas.push(`opção não encontrada: ${q} -> ${respostas[k]}`);
      await page.sleep(120);
      // pergunta nova, que o usuário de exemplo ainda não respondeu: escolhe a primeira opção, como a pessoa teria de fazer
      // (nas de várias escolhas, a última opção é o "Nenhum"/"Nenhuma": é o que o usuário de exemplo responde)
      if (!k) await page.eval(`const b = [...document.querySelectorAll('button.btn.primary')].find((e) => /^(Continuar|Concluir)$/.test(e.textContent.trim())); if (b && b.disabled) { const l = [...document.querySelectorAll('.opt')]; const o = document.querySelector('.opts[role=group]') ? l[l.length - 1] : l[0]; if (o) o.click(); }`);
      await page.sleep(80);
      if (!(await avancar())) { falhas.push('não avançou na pergunta: ' + q); break; }
      await page.sleep(250);
    }
    return vistas;
  }
  const folha = () => page.eval(`const s = document.querySelector('.sheet'); return s ? s.innerText : '';`);
  const naFolha = (rotulo) => page.eval(`const b = [...document.querySelectorAll('.sheet button')].find((e) => e.textContent.trim() === ${JSON.stringify(rotulo)}); if (!b) return false; b.click(); await new Promise((r) => setTimeout(r, 350)); return true;`);

  console.log('1. Objetivos iguais: sem aviso');
  await semear(page, { semanas: 3, objetivo: 'hipertrofia' });
  let e = await estado();
  ok(e.t === 'hipertrofia' && e.n === 'ganhar', 'usuário de exemplo: treino e alimentação para ganhar massa');
  await page.goto(B + '#/nutricao', 1200);
  ok(!(await texto()).includes('Objetivos diferentes'), 'Nutrição sem aviso de objetivos diferentes');

  console.log('2. Mudar o objetivo da alimentação: o app pergunta se iguala o treino');
  await page.click('Refazer a entrevista'); await page.sleep(500);
  ok((await pergunta()).includes('objetivo com a alimentação'), 'entrevista da Nutricionista aberta');
  ok((await texto()).includes('No treino, o seu objetivo é ganhar massa muscular'), 'a pergunta mostra o objetivo do treino');
  ok((await marcada()) === 'Ganhar massa muscular', 'objetivo atual já vem marcado');
  await entrevista({ 'objetivo com a alimentação': 'Emagrecer' });
  let f = await folha();
  ok(f.includes('Deixar os objetivos iguais?') && f.includes('emagrecer') && f.includes('ganhar massa muscular'), 'pergunta "Deixar os objetivos iguais?" apareceu');
  ok(await naFolha('Manter diferentes'), 'escolheu manter diferentes');
  e = await estado();
  ok(e.t === 'hipertrofia' && e.n === 'emagrecer' && e.ok === 'hipertrofia|emagrecer' && e.aceito, 'objetivos diferentes mantidos; plano de treino intacto');
  let t = await texto();
  ok(t.includes('Treino para ganhar massa muscular; alimentação para emagrecer.') && !t.includes('Seguir o treino'), 'tela mostra a escolha em uma linha, sem alerta');
  await page.goto(B + '#/treinador', 1200);
  ok((await texto()).includes('Treino para ganhar massa muscular; alimentação para emagrecer.'), 'o Treinador mostra a mesma linha');
  await page.reload(1500);
  e = await estado();
  ok(e.ok === 'hipertrofia|emagrecer', 'a escolha continua depois de recarregar');

  console.log('3. Igualar depois: seguir a alimentação muda o treino');
  await page.click('Igualar'); await page.sleep(400);
  t = await texto();
  ok(t.includes('Objetivos diferentes') && t.includes('Seguir o treino') && t.includes('Seguir a alimentação') && t.includes('Manter diferentes'), 'cartão com as três opções');
  await page.click('Seguir a alimentação', '.opt'); await page.sleep(600);
  e = await estado();
  ok(e.t === 'emagrecimento' && e.n === 'emagrecer' && !e.aceito && e.ok === '', 'treino passou a ser para emagrecer e voltou a ser proposta');
  t = await texto();
  ok(t.includes('Montei um plano') && t.includes('para emagrecer') && !t.includes('Objetivos diferentes'), 'Treinador mostra o plano novo para emagrecer');
  await page.click('Aceitar e usar este treino'); await page.sleep(800);

  console.log('4. Mudar o objetivo do treino: igualar muda a alimentação');
  await page.goto(B + '#/treinador', 1200);
  await page.click('Refazer a entrevista'); await page.sleep(500);
  ok((await texto()).includes('Na alimentação, o seu objetivo é emagrecer'), 'a pergunta mostra o objetivo da alimentação');
  let vistas = await entrevista({ 'principal objetivo': 'Ganhar massa muscular', 'sem treinar': 'De 3 a 6 meses' });
  ok(vistas.some((q) => q.includes('Há quanto tempo você está sem treinar?')), 'o Treinador pergunta o tempo parado');
  f = await folha();
  ok(f.includes('Deixar os objetivos iguais?') && f.includes('Posso mudar a alimentação para ganhar massa muscular'), 'pergunta de igualar apareceu no Treinador');
  ok(await naFolha('Igualar'), 'escolheu igualar');
  e = await estado();
  ok(e.t === 'hipertrofia' && e.n === 'ganhar' && e.ok === '', 'alimentação passou a ser para ganhar massa');
  await page.goto(B + '#/nutricao', 1200);
  t = await texto();
  // o objetivo fica em "Suas metas e como foram calculadas", que abre ao toque
  const metas = await page.eval(`const d = [...document.querySelectorAll('details')].find((x) => /Suas metas/.test(x.querySelector('summary') ? x.querySelector('summary').textContent : '')); return d ? d.textContent : '';`);
  ok(metas.includes('Ganhar massa muscular') && !t.includes('Objetivos diferentes'), 'Nutrição recalculada para ganhar massa');

  console.log('5. Tempo parado no plano do Treinador');
  e = await estado();
  ok(e.pausa === '3a6m', 'resposta do tempo parado gravada');
  await page.goto(B + '#/treinador', 1200);
  t = await texto();
  ok(t.includes('Volta depois de 3 a 6 meses parado'), 'proposta traz a orientação de volta');
  const maxSeries = await page.eval(`const { gerarPlano } = await import('/js/logic/trainer.js'); const s = (await import('/js/store.js')).state; const p = gerarPlano(s.trainer.answers, s.gym, s.trainer.versao || 0); return Math.max(...p.dias.flatMap((d) => d.itens.map((i) => i.series)));`);
  ok(maxSeries <= 3, `plano de volta com até 3 séries por exercício (máximo: ${maxSeries})`);
  await page.click('Aceitar e usar este treino'); await page.sleep(800);
  await page.goto(B + '#/treinador', 1200);
  ok((await texto()).includes('Parado antes de voltar'), 'perfil mostra o tempo parado');
  // quem nunca treinou não vê a pergunta
  await page.click('Refazer a entrevista'); await page.sleep(500);
  vistas = await entrevista({ experiência: 'Nunca treinei musculação' });
  ok(!vistas.some((q) => q.includes('sem treinar')), 'quem nunca treinou não recebe a pergunta do tempo parado');
  e = await estado();
  ok(e.pausa === undefined, 'resposta antiga do tempo parado foi descartada');

  console.log('6. Tempo parado na carga do treino e nas dicas');
  // empurra todos os treinos 50 dias para trás: a pessoa ficou 7 semanas parada
  const antes = await page.eval(`
    const store = await import('/js/store.js');
    // volta ao plano com que os treinos do histórico foram feitos (os planos montados depois têm outros exercícios)
    const feitos = new Set(store.state.sessions.flatMap((x) => x.itens.map((i) => i.ex)));
    const conta = (p) => p.dias.reduce((n, d) => n + d.itens.filter((i) => feitos.has(i.ex)).length, 0);
    const usado = [...store.state.plans].sort((p, q) => conta(q) - conta(p))[0];
    store.update((s) => { for (const x of s.sessions) { x.inicio = new Date(Date.parse(x.inicio) - 50 * 86400000).toISOString(); x.fim = new Date(Date.parse(x.fim) - 50 * 86400000).toISOString(); } s.current = null; s.activePlan = usado.id; });
    await new Promise((r) => setTimeout(r, 300));
    const s = store.state; const u = s.sessions[s.sessions.length - 1];
    return { n: s.sessions.length };`);
  ok(antes.n >= 6, `histórico com ${antes.n} treinos, o último há 7 semanas`);
  await page.goto(B + '#/evolucao', 1500);
  t = await texto();
  ok(/5\d dias sem treinar/.test(t) && t.includes('20% menos carga'), 'Evolução avisa o tempo parado e a redução de carga na volta');
  await page.goto(B + '#/treinos', 1200);
  await page.click('Iniciar'); await page.sleep(1200);
  ok(await page.eval(`return !!(await import('/js/store.js')).state.current;`), 'treino iniciado');
  t = await texto();
  ok(/Você ficou \d+ semanas sem treinar/.test(t) && t.includes('antes da pausa'), 'treino sugere a carga reduzida e explica por quê');
  const cargas = await page.eval(`
    const store = await import('/js/store.js'); const { historico, assistido } = await import('/js/logic/progress.js'); const { EX_POR_ID } = await import('/js/data/exercises.js');
    const out = [];
    for (const it of store.state.current.itens) { if (EX_POR_ID.get(it.ex).registro !== 'peso_reps' || assistido(it.ex)) continue; const h = historico(it.ex, 1)[0]; if (!h) continue; const a = Math.max(...h.sets.map((x) => x.kg || 0)); if (a > 0) out.push([a, it.sets[0].kg]); }
    return out;`);
  ok(cargas.length > 0 && cargas.every(([a, b]) => b < a && b >= a * 0.72 && b <= a * 0.88), 'cargas do treino cerca de 20% abaixo das de antes da pausa: ' + cargas.slice(0, 4).map(([a, b]) => `${a}→${b}`).join(', '));
  // regras do consenso de 2019 na volta: aviso na tela, menos séries por músculo e descanso de pelo menos 2 minutos
  ok((await texto()).includes('De volta depois de'), 'treino avisa que é uma volta de pausa');
  const fit = await page.eval(`
    const store = await import('/js/store.js'); const { EX_POR_ID } = await import('/js/data/exercises.js');
    const c = store.state.current; const plan = store.activePlan(); const dia = plan.dias.find((d) => d.id === c.diaId);
    const forca = c.itens.filter((it) => ['peso_reps', 'reps'].includes(EX_POR_ID.get(it.ex).registro));
    return { volta: c.volta, series: c.itens.reduce((n, it) => n + it.sets.length, 0), plano: dia.itens.reduce((n, it) => n + it.series, 0), descansoMin: Math.min(...forca.map((it) => it.descanso)) };`);
  ok(fit.volta >= 49 && fit.series < fit.plano && fit.descansoMin >= 120, `volta de ${fit.volta} dias: ${fit.series} séries (plano: ${fit.plano}) e descanso mínimo de ${fit.descansoMin} s`);
  // o cronômetro do exercício por tempo continua contando depois de recarregar a página
  await page.eval(`
    const store = await import('/js/store.js');
    store.update((s) => { s.current.itens.push({ ex: 'prancha-frontal', alvo: '30-60', descanso: 45, sets: [{ kg: null, reps: null, seg: 40, ok: false }] }); });
    await new Promise((r) => setTimeout(r, 300)); return 1;`);
  await page.reload(1800);
  await page.eval(`const b = [...document.querySelectorAll('button')].filter((x) => x.getAttribute('aria-label') === 'Cronometrar esta série').pop(); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); await new Promise((r) => setTimeout(r, 700)); return true;`);
  const antesRec = await page.eval(`return (await import('/js/store.js')).state.current.cron;`);
  await page.reload(1800);
  const depoisRec = await page.eval(`const c = (await import('/js/store.js')).state.current.cron; const t = document.getElementById('rest-time'); return { c, relogio: t ? t.textContent : '', parar: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Parar') };`);
  ok(!!antesRec && !!depoisRec.c && depoisRec.c.end === antesRec.end && depoisRec.parar, 'cronômetro do exercício continua contando depois de recarregar a página (' + depoisRec.relogio + ')');

  console.log('7. Quem só respondeu um lado começa a outra entrevista com o mesmo objetivo');
  await page.eval(`const store = await import('/js/store.js'); store.update((s) => { s.current = null; s.trainer.answers = {}; s.trainer.aceitoEm = ''; s.nutri.answers.objetivo = 'emagrecer'; }); await new Promise((r) => setTimeout(r, 300)); return 1;`);
  await page.goto(B + '#/treinador', 1200);
  await page.click('Começar'); await page.sleep(500);
  ok((await marcada()) === 'Emagrecer', 'Treinador já começa com "Emagrecer" marcado');
  await page.eval(`const store = await import('/js/store.js'); store.update((s) => { s.nutri.answers = {}; s.trainer.answers = { objetivo: 'hipertrofia' }; }); await new Promise((r) => setTimeout(r, 300)); return 1;`);
  await page.goto(B + '#/nutricao', 1200);
  await page.click('Começar'); await page.sleep(500);
  ok((await marcada()) === 'Ganhar massa muscular', 'Nutricionista já começa com "Ganhar massa muscular" marcado');

  ok(page.erros.length === 0, 'nenhum erro no console' + (page.erros.length ? ': ' + page.erros.join(' | ').slice(0, 300) : ''));
  console.log(falhas.length ? `\nFALHAS: ${falhas.length}\n- ` + falhas.join('\n- ') : '\nTudo certo.');
  if (falhas.length) process.exitCode = 1;
};

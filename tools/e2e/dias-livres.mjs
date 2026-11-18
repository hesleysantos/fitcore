// Teste de ponta a ponta dos dias sem treino ("não sugerir treinos no domingo"), clicando nas telas:
// 1) a pergunta nova na entrevista do Treinador (opcional, "Nenhum" já marcado, limite de 5 dias) e a de quantos dias,
//    que não oferece mais treinos do que os dias livres;
// 2) o plano gerado e a agenda da aba Treinos sem musculação nem corrida nos dias bloqueados;
// 3) a entrevista da corrida sem os dias bloqueados (a mesma preferência, sem perguntar de novo);
// 4) o "Não treinei", que nunca passa o treino para um dia bloqueado;
// tudo em 360 px, sem rolagem para o lado e sem erro no console.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/dias-livres.mjs
import * as store from '../../www/js/store.js';
import { PERGUNTAS as P_CORRIDA, respostasCompletas as corridaOk } from '../../www/js/logic/corrida.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = new Date();
const wd = hoje.getDay();
const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
const CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const BLOQ = [3, 0]; // quarta e domingo
const TREINO = { objetivo: 'hipertrofia', idade: 31, peso: 78, altura: 176, experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], remedios: ['nenhum'], foco: ['equilibrado'] };
// a corrida marcada (antes da resposta nova) inclui quarta e domingo
const CORRIDA = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: ['1', '3', '5', '0'], diaLongo: '0', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
for (const q of P_CORRIDA) if (!(q.k in CORRIDA) && !(q.se && !q.se(CORRIDA)) && !q.opcional) CORRIDA[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
if (!corridaOk(CORRIDA)) throw new Error('respostas de corrida incompletas: atualize o roteiro');
const base = (extra = {}) => store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, gym: { all: true, has: {} },
  ui: { onboarded: true, installDismissedAt: new Date().toISOString(), backupEm: new Date().toISOString() }, ...extra });

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  const carregar = async (dados) => { await page.goto(B, 900); await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados }))}); await new Promise((r) => setTimeout(r, 700));`); };
  const st = (expr) => page.eval(`const s = (await import('/js/store.js')).state; return JSON.stringify(${expr});`).then(JSON.parse);
  const semRolagem = () => page.eval(`return document.documentElement.scrollWidth <= window.innerWidth + 1;`);
  const pergunta = () => page.eval(`const h2 = document.querySelector('.bubble h2'); return h2 ? h2.textContent : '';`);
  const opcoes = () => page.eval(`return [...document.querySelectorAll('.opt')].map((o) => ({ t: o.querySelector('.o-t').textContent, on: o.getAttribute('aria-checked') === 'true' }));`);
  const escolher = (rotulo) => page.eval(`const o = [...document.querySelectorAll('.opt')].find((e) => e.querySelector('.o-t') && e.querySelector('.o-t').textContent === ${JSON.stringify(rotulo)}); if (!o) return false; o.click(); await new Promise((r) => setTimeout(r, 120)); return true;`);
  const avancar = () => page.eval(`const c = [...document.querySelectorAll('[data-informar] button')].find((e) => e.textContent.trim() === 'Está certo'); if (c) { c.click(); await new Promise((r) => setTimeout(r, 60)); } const b = [...document.querySelectorAll('button.btn.primary')].find((e) => /^(Continuar|Concluir)$/.test(e.textContent.trim())); if (!b || b.disabled) return false; b.click(); return true;`);
  const espera = (sel) => page.eval(`for (let i = 0; i < 30 && !document.querySelector(${JSON.stringify(sel)}); i++) await new Promise((r) => setTimeout(r, 100)); return !!document.querySelector(${JSON.stringify(sel)});`);
  // segue a entrevista; em cada pergunta, `ao(titulo)` pode responder e conferir; devolve os títulos vistos
  async function entrevista(ao, parar = '') {
    const vistas = [];
    for (let n = 0; n < 30; n++) {
      const q = await pergunta();
      if (!q) break;
      vistas.push(q);
      if (parar && q.includes(parar)) break;
      await ao(q);
      await page.sleep(80);
      // pergunta sem resposta guardada: na de várias escolhas, o "Nenhum" (última); nas outras, a primeira
      await page.eval(`const b = [...document.querySelectorAll('button.btn.primary')].find((e) => /^(Continuar|Concluir)$/.test(e.textContent.trim())); if (b && b.disabled) { const l = [...document.querySelectorAll('.opt')]; const o = document.querySelector('.opts[role=group]') ? l[l.length - 1] : l[0]; if (o) o.click(); }`);
      await page.sleep(80);
      if (!(await avancar())) { falhas.push('não avançou na pergunta: ' + q); break; }
      await page.sleep(220);
    }
    return vistas;
  }

  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });

  console.log('1. Entrevista do Treinador: a pergunta nova e o limite de dias');
  // respostas antigas (sem a pergunta nova), plano de corrida aceito e a prioridade já escolhida
  await carregar(base({ trainer: { answers: TREINO }, run: { answers: CORRIDA, aceitoEm: new Date(seg.getTime() - 7 * 86400000).toISOString(), inicio: dk(new Date(seg.getTime() - 7 * 86400000)), pausadoEm: '' }, combo: { foco: 'equilibrio', fortalecimento: 'nao', em: new Date().toISOString() } }));
  await page.goto(B + '#/treinador', 300); await page.reload(1400);
  ok(await page.click('Mudar respostas'), 'abriu a entrevista pela proposta');
  await page.sleep(400);
  let viuPergunta = false, viuDias = false;
  const vistas = await entrevista(async (q) => {
    if (q === 'Tem algum dia em que você não pode treinar?') {
      viuPergunta = true;
      const l = await opcoes();
      ok(l.map((o) => o.t).join(',') === 'Segunda,Terça,Quarta,Quinta,Sexta,Sábado,Domingo,Nenhum, qualquer dia serve', 'os 7 dias e "Nenhum" por último');
      ok(l.filter((o) => o.on).map((o) => o.t).join() === 'Nenhum, qualquer dia serve', '"Nenhum" já vem marcado (resposta antiga)');
      ok(/até 5 dias/.test(await page.text()), 'diz o limite de 5 dias');
      ok(await semRolagem(), 'sem rolagem para o lado na pergunta');
      await page.shot('dias-livres/pergunta');
      ok(await escolher('Quarta') && await escolher('Domingo'), 'marcou quarta e domingo');
      const m = (await opcoes()).filter((o) => o.on).map((o) => o.t).join();
      ok(m === 'Quarta,Domingo', '"Nenhum" saiu ao marcar os dias: ' + m);
    }
    if (q === 'Quantos dias por semana você consegue treinar?') {
      viuDias = true;
      const l = await opcoes();
      ok(l.map((o) => o.t).join(',') === '2 dias,3 dias,4 dias,5 dias', 'sem a opção de 6 dias (só 5 livres): ' + l.map((o) => o.t).join(','));
      ok(/sobram 5 dias livres: dá para treinar até 5 dias/.test(await page.text()), 'a pergunta diz por quê');
      ok(l.find((o) => o.t === '4 dias').on, 'a resposta guardada (4 dias) continua marcada');
      ok(await semRolagem(), 'sem rolagem para o lado');
      await page.shot('dias-livres/quantos-dias');
    }
  });
  ok(viuPergunta && viuDias, 'viu as duas perguntas');
  ok(vistas.indexOf('Tem algum dia em que você não pode treinar?') === vistas.indexOf('Quantos dias por semana você consegue treinar?') - 1, 'a pergunta nova vem logo antes de "quantos dias"');
  await page.sleep(500);
  const resp = await st('s.trainer.answers.semTreino');
  ok(JSON.stringify(resp) === JSON.stringify(['3', '0']), 'resposta guardada: ' + JSON.stringify(resp));

  console.log('2. A proposta e o plano aceito: nada na quarta nem no domingo');
  const titulos = await page.eval(`return [...document.querySelectorAll('.treino-prop summary')].map((s) => s.querySelector('div > div').textContent);`);
  ok(titulos.length === 4, 'quatro treinos na proposta: ' + titulos.join(' | '));
  ok(titulos.every((t) => !/\bQua\b|\bDom\b/.test(t)), 'nenhum treino na quarta ou no domingo');
  ok(await semRolagem(), 'proposta sem rolagem para o lado');
  await page.shot('dias-livres/proposta');
  ok(await page.click('Aceitar e usar este treino'), 'aceitou o plano');
  await page.sleep(900);
  // a folha da prioridade não deve abrir (já respondida); se abrir, fecha
  await page.eval(`for (const b of document.querySelectorAll('.sheet .iconbtn[aria-label="Fechar"]')) b.click();`);
  const agenda = await st(`(s.plans.find((p) => p.id === s.activePlan) || {}).agenda || {}`);
  ok(Object.keys(agenda).length === 4 && !Object.keys(agenda).some((w) => BLOQ.includes(Number(w))), 'agenda do plano sem quarta e domingo: ' + Object.keys(agenda).map((w) => CURTO[w]).join(', '));

  console.log('3. A agenda da semana na tela (musculação e corrida)');
  await page.goto(B + '#/treinos', 300); await page.reload(1400);
  for (const w of BLOQ) {
    const c = await page.eval(`const c = document.querySelector('.card.dia[data-wd="${w}"]'); return c ? c.innerText : '';`);
    ok(!!c && !/Iniciar|Abrir corrida|Corrida\b/.test(c) && /Descanso/.test(c), `${CURTO[w]}: descanso, sem musculação nem corrida`);
  }
  const corridas = await page.eval(`return [...document.querySelectorAll('.card.dia')].filter((c) => /Abrir corrida|Ver corrida/.test(c.innerText)).map((c) => Number(c.dataset.wd));`);
  ok(corridas.length > 0 && corridas.every((w) => !BLOQ.includes(w)), 'a corrida ficou nos dias livres: ' + corridas.map((w) => CURTO[w]).join(', '));
  ok(await semRolagem(), 'aba Treinos sem rolagem para o lado');
  await page.eval(`const c = document.querySelector('.card.dia[data-wd="0"]'); if (c) c.scrollIntoView({ block: 'center' });`); await page.sleep(150);
  await page.shot('dias-livres/agenda');
  // o perfil do Treinador mostra os dias sem treino
  await page.goto(B + '#/treinador', 900);
  ok(await page.eval(`const d = document.querySelector('#treinador-perfil'); if (!d) return false; d.open = true; await new Promise((r) => setTimeout(r, 100)); return /Sem treino\\s*Qua, Dom/.test(d.innerText);`), '"Seu perfil" mostra "Sem treino: Qua, Dom"');
  // a folha da agenda (escolha à mão) lembra o dia bloqueado
  await page.goto(B + '#/treinos', 900);
  ok(await page.eval(`const b = document.querySelector('.card.dia[data-wd="0"] .chip-agenda'); if (!b) return false; b.click(); await new Promise((r) => setTimeout(r, 400)); return /marcou que não treina neste dia/.test(document.querySelector('.sheet').innerText);`), 'escolher treino à mão no domingo: a folha lembra que é dia sem treino');
  await page.eval(`for (const b of document.querySelectorAll('.sheet .iconbtn[aria-label="Fechar"]')) b.click();`); await page.sleep(300);

  console.log('4. Entrevista da corrida: os dias bloqueados não aparecem (a mesma preferência)');
  await page.goto(B + '#/corrida', 900);
  ok(await page.click('Refazer a entrevista'), 'abriu a entrevista da corrida');
  await page.sleep(400);
  await page.eval(`const b = [...document.querySelectorAll('.sheet button')].find((x) => /^(Refazer|Responder|Continuar|Sim)/.test(x.textContent.trim())); if (b) b.click();`); await page.sleep(400);
  const vistasC = await entrevista(async () => {}, 'Em quais dias da semana você pode correr?');
  const ultima = vistasC[vistasC.length - 1] || '';
  ok(ultima === 'Em quais dias da semana você pode correr?', 'chegou à pergunta dos dias da corrida');
  const lc = await opcoes();
  ok(lc.length === 5 && !lc.some((o) => /Quarta|Domingo/.test(o.t)), 'sem quarta e domingo nas opções: ' + lc.map((o) => o.t).join(', '));
  ok(lc.filter((o) => o.on).map((o) => o.t).join() === 'Segunda-feira,Sexta-feira', 'a resposta guardada perdeu os dias bloqueados: ' + lc.filter((o) => o.on).map((o) => o.t).join());
  ok(/no Treinador você marcou que não treina nesses dias/.test(await page.text()), 'a pergunta diz por quê');
  ok(await semRolagem(), 'sem rolagem para o lado');
  await page.shot('dias-livres/corrida-dias');

  console.log('5. "Não treinei": o treino nunca vai para um dia bloqueado');
  const item = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
  const FULL = [item('flexao-de-bracos'), item('barra-fixa-pronada'), item('agachamento-peso-corporal'), item('flexao-nordica')];
  const plano = (agenda) => ({ id: 'p1', nome: 'Corpo inteiro', origem: 'manual', criadoEm: new Date(hoje.getTime() - 20 * 86400000).toISOString(), info: '',
    dias: [{ id: 'da', nome: 'Treino A', foco: '', itens: FULL }, { id: 'db', nome: 'Treino B', foco: '', itens: FULL }], agenda });
  // os dias que faltam na semana depois de hoje (domingo fecha a semana)
  const depois = []; for (let k = (wd + 6) % 7 + 1; k < 7; k++) depois.push((k + 1) % 7);
  // o segundo caso deixa livres só hoje e um dia que já passou (ou, na segunda-feira, o domingo): 5 dias bloqueados
  const antes = [0, 1, 2, 3, 4, 5, 6].filter((w) => w !== wd && !depois.includes(w));
  const outro = antes.length ? antes[0] : depois[depois.length - 1];
  for (const caso of [{ nome: 'dois dias seguintes bloqueados', bloq: depois.slice(0, 2) }, { nome: 'cinco dias bloqueados', bloq: [0, 1, 2, 3, 4, 5, 6].filter((w) => w !== wd && w !== outro) }]) {
    const livresDepois = depois.filter((w) => !caso.bloq.includes(w));
    const agendaB = livresDepois.length > 2 ? { [wd]: 'da', [livresDepois[livresDepois.length - 1]]: 'db' } : { [wd]: 'da' };
    await carregar(base({ plans: [plano(agendaB)], activePlan: 'p1', trainer: { answers: { ...TREINO, semTreino: caso.bloq.map(String) } } }));
    await page.goto(B + '#/treinos', 300); await page.reload(1400);
    const tem = await page.eval(`const c = document.querySelector('.card.dia[data-wd="${wd}"]'); const b = c && [...c.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Não treinei'); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true;`);
    ok(tem, `${caso.nome}: "Não treinei" no dia de hoje`);
    if (!tem) continue;
    ok(await espera('#folha-nao-treinei'), 'a folha abriu');
    // a folha pergunta o motivo primeiro (views/perdido.js): "Outro" leva à proposta de sempre
    await page.eval(`const b = document.querySelector('.sheet [data-motivo="outro"]'); if (b) b.click(); await new Promise((r) => setTimeout(r, 250)); return 1;`);
    const folha = await page.eval(`return document.querySelector('.sheet').innerText;`);
    const passar = await page.eval(`const b = [...document.querySelectorAll('.sheet button')].find((x) => /^Passar para/.test(x.textContent.trim())); return b ? b.textContent.trim() : '';`);
    ok(await semRolagem(), 'folha sem rolagem para o lado');
    await page.shot('dias-livres/nao-treinei-' + caso.bloq.length);
    if (passar) await page.click(passar, '.sheet button'); else await page.click('Seguir a semana', '.sheet button');
    await page.sleep(600);
    const p = await st('s.perdidos');
    ok(p.length === 1, 'marca gravada');
    const destinos = (p[0] ? p[0].movs : []).map((m) => new Date(m.para + 'T12:00:00').getDay());
    ok(destinos.every((w) => !caso.bloq.includes(w)), `${caso.nome}: nenhum treino foi para dia bloqueado (${destinos.map((w) => CURTO[w]).join(', ') || 'seguiu a semana'})`);
    if (!livresDepois.length) ok(!passar && /Não há outro dia livre/.test(folha), 'sem dia livre: "Seguir a semana", e a folha diz por quê');
  }

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

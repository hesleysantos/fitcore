// Teste de ponta a ponta da tela inicial: saudação pela hora com o nome (pedido por um botão discreto, guardado e
// limpo), "Seja bem-vindo/bem-vinda/Boas-vindas", o resumo de hoje (musculação, corrida e a esteira feita fora do
// plano, sem a lista de exercícios: o cartão completo fica na aba Treinos), "Sua semana" logo depois e os atalhos.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/inicio.mjs
// Com FOTOS_INICIO=1, grava fotos em .tools/shots/_inicio_*.png.
import * as store from '../../www/js/store.js';
import { PERGUNTAS as P_CORRIDA, respostasCompletas as corridaOk } from '../../www/js/logic/corrida.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = new Date();
const wd = hoje.getDay();
const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
const item = (ex, series) => ({ ex, series, reps: '8-12', descanso: 90 });
const NUTRI = { objetivo: 'manter', preco: 'barato', sexo: 'f', idade: 31, peso: 64, altura: 166, atividade: 'leve', treinos: '4', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };

// hoje: pernas + corrida; a corrida de 3 dias depois; mais uma esteira feita hoje, fora do plano
function estado({ nome = '', extra = false } = {}) {
  const plano = { id: 'p1', nome: 'Meu treino', origem: 'manual', criadoEm: new Date().toISOString(), info: '',
    dias: [{ id: 'd1', nome: 'Pernas', foco: '', itens: [item('agachamento-livre-barra', 4), item('leg-press-45', 4), item('cadeira-extensora', 3)] },
      { id: 'd2', nome: 'Superiores', foco: '', itens: [item('supino-reto-halteres', 3), item('remada-unilateral-halter-serrote', 3)] }], agenda: { [wd]: 'd1', [(wd + 3) % 7]: 'd2' } };
  const corrida = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: [String(wd), String((wd + 3) % 7)], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 64, altura: 166, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  for (const q of P_CORRIDA) if (!(q.k in corrida) && !(q.se && !q.se(corrida)) && !q.opcional) corrida[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  if (!corridaOk(corrida)) throw new Error('respostas de corrida incompletas: atualize o roteiro');
  const runs = [];
  if (extra) {
    // a corrida do plano de hoje e, no mesmo dia, uma esteira a mais
    runs.push({ id: 'r1', data: dk(hoje), tipo: 'leve', local: 'rua', distKm: 5, durMin: 32, esforco: 4 });
    runs.push({ id: 'r2', data: dk(hoje), tipo: 'livre', local: 'esteira', distKm: 3, durMin: 20, esforco: 5 });
  }
  return store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false, nome }, gym: { all: true, has: {} }, plans: [plano], activePlan: 'p1',
    nutri: { answers: NUTRI, calculadoEm: new Date().toISOString() }, runs,
    run: { answers: corrida, aceitoEm: new Date().toISOString(), inicio: dk(seg), pausadoEm: '' }, ui: { onboarded: true, installDismissedAt: new Date().toISOString() } });
}

export default async (page) => {
  const falhas = [];
  const ok = (c, m, extra) => { console.log((c ? '  ✔ ' : '  ✖ ') + m + (c || extra === undefined ? '' : ' ' + JSON.stringify(extra))); if (!c) falhas.push(m); };
  const foto = async (nome) => { if (!process.env.FOTOS_INICIO) return; try { await page.shot('_inicio_' + nome); } catch { /* foto é só registro */ } };
  const carregar = async (st) => {
    await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados: st }))}); await new Promise((r) => setTimeout(r, 300)); await m.flush(); return true;`);
    await page.goto(B + '#/', 300); await page.reload(1500);
  };
  const hora = new Date().getHours();
  const sauda = hora < 5 ? 'Boa noite' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 1200);
  await carregar(estado());

  console.log('1. Saudação sem nome e o pedido do nome');
  let s = await page.eval(`const e = document.getElementById('inicio-saudacao'); return { h1: e.querySelector('h1').textContent, sub: e.querySelector('.hero-sub').textContent, botao: !!e.querySelector('.hero-nome') };`);
  ok(s.h1 === sauda + '!' && s.sub === 'Seja bem-vinda!' && s.botao, 'saudação pela hora, "bem-vinda" pelo sexo da Nutrição e o botão "Dizer meu nome"', s);
  await page.click('Dizer meu nome'); await page.sleep(300);
  await page.eval(`const c = document.getElementById('campo-nome'); c.value = '  Ana <b>Lu</b>  '; return true;`);
  await page.click('Boas-vindas', '.sheet button'); await page.click('Salvar', '.sheet button'); await page.sleep(500);
  s = await page.eval(`const e = document.getElementById('inicio-saudacao'); const st = (await import('/js/store.js')).state.settings; return { h1: e.querySelector('h1').textContent, sub: e.querySelector('.hero-sub').textContent, nome: st.nome, trato: st.trato, av: e.querySelector('.hero-av').textContent, botao: !!e.querySelector('.hero-nome') };`);
  ok(s.nome === 'Ana bLu/b' || s.nome === 'Ana bLub' || /^Ana /.test(s.nome), 'nome guardado sem sinais de código', s.nome);
  ok(s.h1 === `${sauda}, ${s.nome}!` && s.sub === 'Boas-vindas!' && s.trato === 'n' && s.av === 'A' && !s.botao, 'saudação com o nome, trato escolhido e a inicial no círculo', s);
  await page.eval(`(await import('/js/store.js')).update((x) => { x.settings.nome = 'Ana'; x.settings.trato = ''; }); (await import('/js/router.js')).refresh(); return true;`); await page.sleep(400);

  console.log('2. Resumo de hoje, sem a lista de exercícios');
  const r = await page.eval(`const c = document.getElementById('inicio-hoje'); return { t: c.innerText, musc: !!document.getElementById('inicio-musculacao'), corr: !!document.getElementById('inicio-corrida'), thumbs: c.querySelectorAll('.thumb').length, btns: [...c.querySelectorAll('.btn')].map((b) => b.textContent.trim()) };`);
  ok(r.musc && r.corr && /Musculação: Pernas/.test(r.t) && /3 exercícios · cerca de \d+ min/.test(r.t), 'musculação e corrida de hoje em linhas curtas', r.t);
  ok(r.thumbs === 0 && !/Leg press|Agachamento/.test(r.t), 'sem figuras nem lista de exercícios no Início');
  ok(r.btns.includes('Iniciar treino') && r.btns.includes('Abrir corrida'), 'os botões de começar continuam', r.btns);
  const ordem = await page.eval(`const ids = [...document.querySelectorAll('#conteudo > *, main > *')].map((e) => e.id).filter(Boolean); return ids.indexOf('inicio-hoje') >= 0 && ids.indexOf('inicio-semana') === ids.indexOf('inicio-hoje') + 1;`);
  ok(ordem, '"Sua semana" vem logo depois do resumo de hoje');
  ok(await page.eval(`return document.querySelectorAll('.atalhos .atalho').length === 6 && !!document.querySelector('.atalho[data-acao="contar-saude"]');`), 'seis atalhos em blocos, com "Problema de saúde"');
  await foto('claro');
  await page.click('Musculação: Pernas'); await page.sleep(700);
  ok(await page.eval(`return location.hash === '#/treinos' && !!document.querySelector('.card.dia.hl');`), 'tocar na musculação abre a aba Treinos, no cartão de hoje');
  await page.goto(B + '#/', 600);

  console.log('3. Esteira extra no mesmo dia da corrida do plano');
  await carregar(estado({ nome: 'Ana', extra: true }));
  const e = await page.eval(`return { hoje: document.getElementById('inicio-hoje').innerText, conta: document.getElementById('semana-contagem').textContent };`);
  ok(/Esteira fora do plano/.test(e.hoje) && /3 km · 20 min/.test(e.hoje), 'a esteira a mais aparece no resumo de hoje', e.hoje);
  ok(/Corrida 1\/2 \+ 1 extra/.test(e.conta), 'a semana conta a corrida do plano e a extra', e.conta);
  await foto('extra');
  await page.eval(`(await import('/js/store.js')).update((x) => { x.settings.tema = 'escuro'; }); (await import('/js/router.js')).refresh(); return true;`); await page.sleep(500);
  await foto('escuro');
  ok(await page.eval(`return document.documentElement.scrollWidth <= 360;`), 'sem rolagem para o lado em 360 px');

  console.log('4. Nome nos Ajustes');
  await page.goto(B + '#/ajustes', 700);
  ok(/Seu nome[\s\S]*Ana/.test(await page.eval(`return document.getElementById('ajuste-nome').innerText;`)), 'Ajustes mostra o nome e deixa mudar');

  if (falhas.length) throw new Error(falhas.length + ' falha(s): ' + falhas.join(' | '));
};

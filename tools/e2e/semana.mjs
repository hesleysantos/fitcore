// Teste de ponta a ponta da tela da Nutricionista organizada pelo dia de hoje e do cardápio da semana:
// bloco "Hoje" (musculação + corrida, descanso, horário "varia"), primeira tela em 360 px (hoje, metas e começo do
// cardápio), "Semana e compras" (7 dias de hoje em diante, cada um com o seu treino e a sua meta; mesmo dia = mesmo
// cardápio), "Trocar" uma refeição (na semana e na tela do dia), lista de compras agrupada e copiada como texto,
// quem não recebe números (transtorno alimentar) e a tela em 360 px nos temas claro e escuro.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/semana.mjs
// Com FOTOS_SEMANA=1, grava fotos em .tools/shots/_semana_*.png.
import * as store from '../../www/js/store.js';
import { PERGUNTAS as P_CORRIDA, respostasCompletas as corridaOk } from '../../www/js/logic/corrida.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = new Date();
const wd = hoje.getDay();
const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
const item = (ex, series) => ({ ex, series, reps: '8-12', descanso: 90 });
const NUTRI = { objetivo: 'manter', preco: 'barato', sexo: 'm', idade: 31, peso: 78, altura: 176, atividade: 'leve', treinos: '4', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };

// hoje: treino de pernas + corrida; o treino de superiores e a outra corrida 3 dias depois; o resto, descanso
function estado() {
  const plano = { id: 'p1', nome: 'Meu treino', origem: 'manual', criadoEm: new Date().toISOString(), info: '',
    dias: [{ id: 'd1', nome: 'Pernas', foco: '', itens: [item('agachamento-livre-barra', 4), item('leg-press-45', 4), item('cadeira-extensora', 3)] },
      { id: 'd2', nome: 'Superiores', foco: '', itens: [item('supino-reto-halteres', 3), item('remada-unilateral-halter-serrote', 3)] }], agenda: { [wd]: 'd1', [(wd + 3) % 7]: 'd2' } };
  const corrida = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: [String(wd), String((wd + 3) % 7)], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  // perguntas criadas depois deste roteiro: primeira opção
  for (const q of P_CORRIDA) if (!(q.k in corrida) && !(q.se && !q.se(corrida)) && !q.opcional) corrida[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  if (!corridaOk(corrida)) throw new Error('respostas de corrida incompletas: atualize o roteiro');
  return store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, gym: { all: true, has: {} }, plans: [plano], activePlan: 'p1',
    nutri: { answers: NUTRI, calculadoEm: new Date().toISOString() },
    run: { answers: corrida, aceitoEm: new Date().toISOString(), inicio: dk(seg), pausadoEm: '' }, ui: { onboarded: true, installDismissedAt: new Date().toISOString() } });
}

export default async (page) => {
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  const foto = async (nome) => { if (!process.env.FOTOS_SEMANA) return; try { await page.shot('_semana_' + nome); } catch { /* foto é só registro */ } };
  const estadoNutri = (expr) => page.eval(`const s = (await import('/js/store.js')).state; return ${expr};`);
  const mudar = async (corpo) => { await page.eval(`const st = await import('/js/store.js'); st.update((s) => { ${corpo} }); (await import('/js/router.js')).refresh(); return true;`); await page.sleep(400); };
  const folha = () => page.eval(`return document.querySelectorAll('.sheet').length;`);
  const abrirSemana = async () => { await page.click('Semana e compras'); for (let i = 0; i < 30 && !(await folha()); i++) await page.sleep(100); await page.sleep(200); return (await folha()) === 1; };
  const fechar = async () => { await page.eval(`for (const b of [...document.querySelectorAll('.sheet .iconbtn[aria-label="Fechar"]')].reverse()) b.click(); return true;`); await page.sleep(300); };
  const diasDaSemana = () => page.eval(`return [...document.querySelectorAll('.sheet .semana-dia')].map((c) => ({ data: c.dataset.data, titulo: c.querySelector('h3').textContent, treino: c.querySelector('.treino-dia').textContent.trim(), meta: (c.querySelector('.row .tiny') || {}).textContent || '', refs: [...c.querySelectorAll('details')].map((d) => d.dataset.ref + ':' + [...d.querySelectorAll('.itens .kv')].map((k) => k.firstChild.firstChild.firstChild.textContent).join(',')) }));`);
  const refeicoesDeHoje = () => page.eval(`return [...document.querySelectorAll('#conteudo .card.refeicao')].map((c) => c.dataset.ref + ':' + [...c.querySelectorAll('.itens .kv')].map((k) => k.firstChild.firstChild.firstChild.textContent).join(','));`);

  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 1200);
  await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados: estado() }))}); await new Promise((r) => setTimeout(r, 300)); await m.flush(); return true;`);
  await page.goto(B + '#/nutricao', 500); await page.reload(1500);

  console.log('1. Hoje: musculação e corrida num bloco só, no alto');
  const hojeCard = await page.eval(`const c = document.getElementById('hoje-nutri'); return { titulo: c.querySelector('h2').textContent, tipo: c.dataset.treino, texto: c.textContent, aberto: (document.getElementById('hoje-treino') || {}).open };`);
  ok(/^Hoje: musculação \(Pernas\) \+ .+ de \d/.test(hojeCard.titulo), 'título junta os dois treinos: ' + hojeCard.titulo);
  ok(hojeCard.tipo === 'sim' && hojeCard.aberto === false, 'o que comer em volta do treino fica numa seção fechada dentro do bloco do dia');
  await page.click('O que comer antes, durante e depois'); await page.sleep(200);
  const treinoTxt = await page.eval(`return document.getElementById('hoje-treino').textContent;`);
  ok(treinoTxt.includes('Antes') && treinoTxt.includes('Durante a corrida') && treinoTxt.includes('Depois') && treinoTxt.includes('Treino à noite') && /\d+ a \d+ mL nas 2 a 4 horas antes do treino/.test(treinoTxt), 'antes, durante a corrida, depois, horário e água antes do treino no mesmo bloco');
  ok(!(await page.text()).includes('Alimentação para a corrida'), 'a corrida não aparece num bloco solto');
  ok((await page.eval(`return document.getElementById('metas').textContent;`)).includes('A corrida gasta perto de'), 'as calorias da corrida aparecem nas metas, dizendo de onde vêm');
  await page.click('O que comer antes, durante e depois'); await page.sleep(200);

  console.log('2. Primeira tela (360 × 780): hoje, metas e o começo do cardápio');
  await page.eval(`window.scrollTo(0, 0); return true;`); await page.sleep(200);
  const tela = await page.eval(`const nav = document.querySelector('nav.nav'); const fim = nav ? nav.getBoundingClientRect().top : innerHeight; const kv = document.querySelector('.card.refeicao .ref-hd'); const ab = [...document.querySelectorAll('.card.refeicao .ref-hd')].find((e) => e.getAttribute('aria-expanded') === 'true'); const r = (s) => document.querySelector(s).getBoundingClientRect(); return { fim, hoje: r('#hoje-nutri').top, metas: r('#diario').bottom, prato: kv ? kv.getBoundingClientRect().bottom : 9999, aberto: ab ? ab.getBoundingClientRect().bottom : 9999 };`);
  // as refeições recolhem (a do horário fica aberta): o começo do cardápio são os títulos das refeições
  ok(tela.hoje < tela.fim && tela.metas < tela.fim && tela.prato <= tela.fim + 1 && tela.aberto <= tela.fim + 1, `o começo do cardápio aparece sem rolar: o primeiro título termina em ${Math.round(tela.prato)} px e o da refeição aberta em ${Math.round(tela.aberto)} px (a barra começa em ${Math.round(tela.fim)} px)`);
  await foto('1-primeira-tela');
  const hojeNaTela = await refeicoesDeHoje();

  console.log('3. Semana e compras: 7 dias de hoje em diante');
  ok(await abrirSemana(), '"Semana e compras" abre a folha');
  let dias = await diasDaSemana();
  ok(dias.length === 7 && dias[0].data === dk(hoje) && dias[0].titulo.startsWith('Hoje'), 'sete dias, a partir de hoje: ' + dias.map((d) => d.titulo).join(' · '));
  ok(dias.every((d, i) => i === 0 || Date.parse(d.data) - Date.parse(dias[i - 1].data) === 86400000), 'dias seguidos');
  ok(dias[0].treino.startsWith('Musculação (Pernas) +') && dias[3].treino.startsWith('Musculação (Superiores)') && dias.filter((d) => d.treino === 'Descanso').length >= 3, 'cada dia diz o treino ou o descanso daquele dia: ' + dias.map((d) => d.treino.split(' ')[0]).join(','));
  ok(dias.every((d) => /^[\d.]+ kcal · \d+ g$/.test(d.meta) && d.refs.length === 4), 'cada dia tem a sua meta e as 4 refeições');
  ok(new Set(dias.map((d) => d.refs.join('|'))).size >= 6, 'os dias não são cópias uns dos outros');
  ok(JSON.stringify(dias[0].refs.map((x) => x.split(':')[1])) === JSON.stringify(hojeNaTela.map((x) => x.split(':')[1])), 'o dia de hoje na semana é o mesmo cardápio da tela');
  await foto('2-semana');
  await fechar(); await abrirSemana();
  ok(JSON.stringify(await diasDaSemana()) === JSON.stringify(dias), 'fechar e abrir de novo: os mesmos cardápios');

  console.log('4. Trocar uma refeição');
  const amanhaAlmoco = dias[1].refs.find((x) => x.startsWith('almoco'));
  await page.eval(`const d = document.querySelector('.sheet .semana-dia[data-data="${dias[1].data}"] details[data-ref="almoco"]'); d.open = true; d.scrollIntoView({ block: 'center' }); return true;`); await page.sleep(150);
  await page.eval(`[...document.querySelectorAll('.sheet .semana-dia[data-data="${dias[1].data}"] details[data-ref="almoco"] .btn')].find((b) => b.textContent.trim() === 'Trocar').click(); return true;`); await page.sleep(700);
  dias = await diasDaSemana();
  const novoAlmoco = dias[1].refs.find((x) => x.startsWith('almoco'));
  ok(novoAlmoco && novoAlmoco !== amanhaAlmoco, `o almoço de amanhã mudou (${amanhaAlmoco.split(':')[1].slice(0, 40)}… → ${novoAlmoco.split(':')[1].slice(0, 40)}…)`);
  const aj = await estadoNutri(`JSON.stringify(s.nutri.ajustes)`);
  ok(aj.includes(dias[1].data), 'a troca fica guardada para aquele dia: ' + aj);
  await fechar(); await page.reload(1500); await page.goto(B + '#/nutricao', 600); await abrirSemana();
  ok((await diasDaSemana())[1].refs.find((x) => x.startsWith('almoco')) === novoAlmoco, 'depois de recarregar, a troca continua');
  await fechar();
  // na tela do dia: o botão de troca do jantar
  const jantarAntes = (await refeicoesDeHoje()).find((x) => x.startsWith('jantar'));
  await page.eval(`document.querySelector('.card.refeicao[data-ref="jantar"] .trocar').click(); return true;`); await page.sleep(600);
  const jantarDepois = (await refeicoesDeHoje()).find((x) => x.startsWith('jantar'));
  ok(jantarDepois !== jantarAntes, 'o jantar de hoje mudou com "Trocar jantar"');
  await abrirSemana();
  ok((await diasDaSemana())[0].refs.find((x) => x.startsWith('jantar')).split(':')[1] === jantarDepois.split(':')[1], 'e a semana mostra o mesmo jantar novo');

  console.log('5. Lista de compras');
  await page.eval(`[...document.querySelectorAll('.sheet .seg button')].find((b) => b.textContent.includes('Lista')).click(); return true;`); await page.sleep(400);
  const lista = await page.eval(`return { grupos: [...document.querySelectorAll('#lista-compras h3')].map((e) => e.textContent), itens: [...document.querySelectorAll('#lista-compras .kv')].map((k) => k.lastChild.textContent) };`);
  ok(lista.grupos.length >= 6 && ['Frutas', 'Verduras e legumes', 'Carnes e aves'].every((g) => lista.grupos.includes(g)), 'agrupada por tipo: ' + lista.grupos.join(', '));
  ok(lista.itens.length >= 20 && lista.itens.every((q) => /^\d+(,\d)? (g|kg|L|mL|unidades?|potes?|espigas?|latas?|colheres? de sopa)$/.test(q)), `${lista.itens.length} itens em quantidade de compra (${lista.itens.slice(0, 5).join(', ')}…)`);
  await foto('3-lista');
  await page.click('Copiar a lista como texto'); await page.sleep(400);
  const txt = await page.eval(`const t = [...document.querySelectorAll('.sheet textarea')].pop(); return t ? t.value : '';`);
  ok(txt.startsWith('Lista de compras · ') && txt.includes('\nFrutas\n- ') && (await folha()) === 2, 'abre o texto da lista para copiar (nada é enviado para fora do aparelho)');
  await fechar();

  console.log('6. Dia de descanso e horário que varia');
  await mudar(`const p = s.plans[0]; p.agenda = { ${(wd + 1) % 7}: 'd1' }; s.run.answers = { ...s.run.answers, dias: ['${(wd + 2) % 7}', '${(wd + 4) % 7}'] };`);
  const desc = await page.eval(`const c = document.getElementById('hoje-nutri'); return { titulo: c.querySelector('h2').textContent, texto: c.textContent };`);
  ok(desc.titulo === 'Hoje: descanso' && !/antes do treino|pré-treino/i.test(desc.texto) && desc.texto.includes('Descanso não é dia de comer menos') && desc.texto.includes('Água: 2,5 L no dia'), 'descanso: sem "água antes do treino", só a água do dia e o que vale para descanso');
  await foto('4-descanso');
  await mudar(`s.plans[0].agenda = { ${wd}: 'd1' }; s.nutri.answers = { ...s.nutri.answers, horario: 'varia' };`);
  await page.click('O que comer antes'); await page.sleep(200);
  const varia = await page.eval(`return document.getElementById('hoje-treino').textContent;`);
  ok(varia.includes('Regra geral') && !/Treino à noite|Treino de manhã|Treino à tarde|Treino ao acordar/.test(varia), 'horário "varia": regra geral, sem horário inventado');

  console.log('7. Quem não recebe números: sem cardápio nem calorias');
  await mudar(`s.nutri.answers = { ...s.nutri.answers, condicoes: ['transtorno'] };`);
  const semNum = await page.eval(`return { semana: [...document.querySelectorAll('.btn')].some((b) => b.textContent.includes('Semana e compras')), texto: document.getElementById('conteudo').innerText };`);
  ok(!semNum.semana && !/kcal/.test(semNum.texto), 'transtorno alimentar: sem semana, sem calorias');
  await mudar(`s.nutri.answers = { ...s.nutri.answers, condicoes: ['nenhuma'], horario: 'noite' };`);

  console.log('8. 360 px, temas claro e escuro');
  for (const tema of ['claro', 'escuro']) {
    await mudar(`s.settings.tema = '${tema}';`);
    await page.reload(1500); await page.goto(B + '#/nutricao', 600);
    ok((await page.eval(`return document.documentElement.dataset.theme === 'light';`)) === (tema === 'claro'), `tema ${tema}`);
    ok(await page.eval(`return document.documentElement.scrollWidth <= 361 && [...document.querySelectorAll('#conteudo *')].filter((e) => e.getClientRects().length && !e.closest('svg')).every((e) => { const r = e.getBoundingClientRect(); return r.right <= 360.5 && r.left >= -0.5; });`), `a tela cabe em 360 px (${tema})`);
    ok(await page.eval(`return [...document.querySelectorAll('#conteudo .card.refeicao .btn, #conteudo .card.refeicao .ref-hd, #hoje-nutri summary, #conteudo .par-de-botoes .btn, #diario-hoje .btn')].filter((b) => b.getClientRects().length).every((b) => b.getBoundingClientRect().height >= 43.5);`), `botões do dia e do cardápio com 44 px ou mais (${tema})`);
    await abrirSemana();
    ok(await page.eval(`const s = document.querySelector('.sheet'); return [...s.querySelectorAll('*')].filter((e) => e.getClientRects().length && !e.closest('svg')).every((e) => e.getBoundingClientRect().right <= 360.5) && [...s.querySelectorAll('.btn, .seg button, summary')].every((b) => b.getBoundingClientRect().height >= 43.5 || !b.getClientRects().length);`), `a semana cabe em 360 px e os botões têm 44 px (${tema})`);
    await foto('5-semana-' + tema);
    await page.eval(`[...document.querySelectorAll('.sheet .seg button')].find((b) => b.textContent.includes('Lista')).click(); return true;`); await page.sleep(300);
    ok(await page.eval(`const s = document.querySelector('.sheet'); return [...s.querySelectorAll('*')].filter((e) => e.getClientRects().length && !e.closest('svg')).every((e) => e.getBoundingClientRect().right <= 360.5);`), `a lista cabe em 360 px (${tema})`);
    await page.eval(`[...document.querySelectorAll('.sheet .seg button')].find((b) => b.textContent.includes('Cardápio')).click(); return true;`); await page.sleep(200);
    await fechar();
    await page.eval(`window.scrollTo(0, 0); return true;`); await foto('6-tela-' + tema);
  }

  const erros = page.erros.filter((e) => !/favicon|SWv:/.test(e));
  ok(erros.length === 0, 'nenhum erro no console' + (erros.length ? ': ' + erros.join(' || ').slice(0, 500) : ''));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

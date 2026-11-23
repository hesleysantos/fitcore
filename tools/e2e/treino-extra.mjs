// Teste de ponta a ponta do treino a mais num dia que ainda vai chegar (logic/treino-extra.js): futebol planejado para
// amanhã tira o treino de pernas de depois de amanhã (o treinador mostra antes de confirmar), o "x" desfaz tudo; e, no
// registro de corrida de quem disse que não mede a distância, a distância fica no histórico com o aviso de que o treinador
// não se baseia nela. Na corrida do dia, a outra medida (km ou tempo).
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/treino-extra.mjs
import * as store from '../../www/js/store.js';
import { PERGUNTAS } from '../../www/js/logic/corrida.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async (page) => {
  const falhas = [];
  const ok = (c, m, extra) => { console.log((c ? '  ✔ ' : '  ✖ ') + m + (c || extra === undefined ? '' : ' ' + JSON.stringify(extra))); if (!c) falhas.push(m); };
  const hoje = new Date();
  const mais = (n) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return d; };
  const amanha = mais(1), depois = mais(2);
  const wd = (d) => d.getDay();
  const item = (ex, series = 3) => ({ ex, series, reps: '8-12', descanso: 90, nota: '' });
  // pernas (B) depois de amanhã; superiores (A) hoje; o futebol fica amanhã. (Se amanhã for outra semana, o teste não vale.)
  const mesmaSemana = ((wd(hoje) + 6) % 7) <= 4;
  const plano = { id: 'p1', nome: 'Meu treino', origem: 'manual', criadoEm: new Date(hoje.getTime() - 30 * 86400000).toISOString(), info: '',
    dias: [{ id: 'a', nome: 'Treino A', foco: 'Superiores', itens: [item('supino-reto-halteres'), item('remada-unilateral-halter-serrote')] }, { id: 'b', nome: 'Treino B', foco: 'Pernas', itens: [item('agachamento-livre-barra'), item('leg-press-45')] }],
    agenda: { [wd(hoje)]: 'a', [wd(depois)]: 'b' } };
  const run = { experiencia: 'regular', kmSemana: 20, longoAtual: 8, pausa: 'treinando', objetivo: 'saude', dias: ['0', '2', '4', '6'].filter((x) => Number(x) !== wd(depois)), tempo: '45', aparelho: 'tempo', local: 'rua', idade: 30, peso: 70, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], resultado: 'nao' };
  for (const q of PERGUNTAS) if (!(q.k in run) && !(q.se && !q.se(run)) && !q.opcional) run[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  const seg = new Date(hoje); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
  const st = store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, plans: [plano], activePlan: 'p1', trainer: { answers: { idade: 30 } }, combo: { foco: 'equilibrio', fortalecimento: 'nao' }, ui: { onboarded: true, installDismissedAt: new Date().toISOString() } });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 1200);
  const carregar = async (s) => { await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados: s }))}); await new Promise((r) => setTimeout(r, 300)); await m.flush(); return true;`); };
  await carregar(st);

  if (mesmaSemana) {
    console.log('1. Futebol planejado para amanhã: o treino de pernas sai de depois de amanhã');
    await page.goto(B + '#/treinos', 300); await page.reload(1500);
    ok(await page.eval(`const c = document.querySelector('.card.dia[data-wd="${wd(amanha)}"]'); const b = c && [...c.querySelectorAll('button')].find((x) => /Planejar treino a mais/.test(x.textContent)); if (!b) return false; b.click(); return true;`), 'o dia de amanhã tem "Planejar treino a mais"');
    await page.sleep(400);
    ok(await page.eval(`const b = document.querySelector('#folha-outro-treino [data-acao="outro-esporte"]'); if (!b) return false; b.click(); return true;`), 'escolhe "Outro esporte"');
    await page.sleep(400);
    ok(await page.eval(`const c = document.querySelector('#folha-esporte [data-esporte="futebol"]'); if (!c) return false; c.click(); return true;`), 'escolhe futebol');
    await page.sleep(200);
    ok(await page.click('Continuar'), 'continua para a análise');
    await page.sleep(500);
    const txt = await page.eval(`const f = document.getElementById('folha-analise-extra'); return f ? f.textContent : '';`);
    ok(/TREINADOR OLHOU A SEMANA/.test(txt) && /Recomendo passar o Treino B/.test(txt) && /quer mudar\?/.test(txt), 'o treinador recomenda mudar o treino de pernas e pergunta antes', txt.slice(0, 260));
    await page.shot('_planejar_futebol');
    ok(await page.click('Mudar como recomendado'), 'a pessoa escolhe mudar');
    await page.sleep(600);
    const s1 = await page.eval(`const s = (await import('/js/store.js')).state; return { pl: s.planejados.length, aj: s.perdidos.map((e) => e.ajuste || '') };`);
    ok(s1.pl === 1 && s1.aj.includes('esporte'), 'gravou o futebol e a mudança do treino de pernas', s1);
    await page.reload(1500);
    ok(await page.eval(`return !!document.querySelector('.card.dia[data-wd="${wd(amanha)}"] [data-planejado]') && !!document.querySelector('.card.dia[data-wd="${wd(depois)}"] [data-ajuste="esporte"]');`), 'amanhã mostra o futebol; depois de amanhã, "Mudou de dia"');
    await page.shot('_semana_futebol');
    ok(await page.eval(`const b = document.querySelector('[data-planejado] button[aria-label^="Tirar"]'); if (!b) return false; b.click(); return true;`), 'tira o futebol');
    await page.sleep(500);
    const s2 = await page.eval(`const s = (await import('/js/store.js')).state; return { pl: s.planejados.length, pe: s.perdidos.length };`);
    ok(s2.pl === 0 && s2.pe === 0, 'tirar o futebol desfaz a mudança', s2);
    // de novo, agora mantendo os treinos: só o futebol fica, nada muda
    await page.eval(`const c = document.querySelector('.card.dia[data-wd="${wd(amanha)}"]'); [...c.querySelectorAll('button')].find((x) => /Planejar treino a mais/.test(x.textContent)).click(); return 1;`); await page.sleep(400);
    await page.eval(`document.querySelector('#folha-outro-treino [data-acao="outro-esporte"]').click(); return 1;`); await page.sleep(400);
    await page.eval(`document.querySelector('#folha-esporte [data-esporte="futebol"]').click(); return 1;`); await page.sleep(200);
    await page.click('Continuar'); await page.sleep(500);
    ok(await page.click('Manter os treinos como estão'), 'a pessoa escolhe manter os treinos');
    await page.sleep(500);
    const s3 = await page.eval(`const s = (await import('/js/store.js')).state; return { pl: s.planejados.length, pe: s.perdidos.length };`);
    ok(s3.pl === 1 && s3.pe === 0, 'só o futebol fica; nenhum treino muda', s3);

    console.log('1b. Futebol registrado hoje, com pernas amanhã: recomenda e pergunta');
    await carregar({ ...st, plans: [{ ...plano, agenda: { [wd(hoje)]: 'a', [wd(amanha)]: 'b' } }] });
    await page.goto(B + '#/treinos', 300); await page.reload(1500);
    await page.eval(`const c = document.querySelector('.card.dia[data-wd="${wd(hoje)}"]'); [...c.querySelectorAll('button')].find((x) => /Adicionar outro treino/.test(x.textContent)).click(); return 1;`); await page.sleep(400);
    await page.eval(`document.querySelector('#folha-outro-treino [data-acao="outro-esporte"]').click(); return 1;`); await page.sleep(400);
    await page.eval(`document.querySelector('#folha-esporte [data-esporte="futebol"]').click(); return 1;`); await page.sleep(200);
    ok(await page.click('Salvar'), 'registra o futebol de hoje');
    await page.sleep(600);
    const t4 = await page.eval(`const f = document.getElementById('folha-analise-extra'); return f ? f.textContent : '';`);
    ok(/Recomendo passar o Treino B/.test(t4) && /quer mudar\?/.test(t4), 'recomenda tirar as pernas de amanhã e pergunta', t4.slice(0, 200));
    await page.shot('_futebol_hoje');
    ok(await page.click('Manter os treinos como estão'), 'a pessoa mantém os treinos');
    await page.sleep(400);
    const s4 = await page.eval(`const s = (await import('/js/store.js')).state; return { at: s.atividades.length, pe: s.perdidos.length };`);
    ok(s4.at === 1 && s4.pe === 0, 'o futebol fica registrado e nenhum treino muda', s4);
  } else console.log('1. (pulado: amanhã já é outra semana)');

  console.log('2. Quem não mede a distância: o treinador não usa os km anotados');
  await carregar({ ...st, run: { answers: run, aceitoEm: new Date().toISOString(), inicio: dk(seg), pausadoEm: '' } });
  await page.goto(B + '#/corrida/dia/' + dk(hoje), 300); await page.reload(1500);
  ok(await page.click('Informar a distância'), 'a distância é opcional');
  await page.sleep(300);
  const aviso = await page.eval(`const e = document.getElementById('dist-nao-usada'); return e ? e.textContent : '';`);
  ok(/não se baseia nela/.test(aviso) && /não mede a distância/.test(aviso), 'explica que o treinador não se baseia na distância', aviso);
  await page.shot('_registro_sem_gps');

  console.log('3. A corrida do dia mostra a outra medida (km ou tempo)');
  let outra = '';
  for (let k = 0; k < 7 && !outra; k++) {
    await page.goto(B + '#/corrida/dia/' + dk(mais(k)), 300); await page.reload(1200);
    outra = await page.eval(`const e = document.querySelector('.outra-medida'); return e ? e.textContent : '';`);
  }
  ok(/Se medir a distância: cerca de/.test(outra), 'rodagem por tempo mostra "Se medir a distância: cerca de X km"', outra);
  await page.shot('_outra_medida');

  console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo.');
  return falhas.length;
};

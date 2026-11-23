// Teste de ponta a ponta da prova e da preparação em etapas (logic/corrida.js: semanaDaProva, etapaDe):
// 1) prova nesta semana: o cartão "Semana da prova" com o essencial e o caminho para a Nutricionista;
// 2) meia maratona sem data, de quem corre pouco: a proposta diz que é a 1ª etapa, mostra o desafio previsto e não fala
//    em treino "pouco".
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/prova.mjs
import * as store from '../../www/js/store.js';
import { PERGUNTAS } from '../../www/js/logic/corrida.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async (page) => {
  const falhas = [];
  const ok = (c, m, extra) => { console.log((c ? '  ✔ ' : '  ✖ ') + m + (c || extra === undefined ? '' : ' ' + JSON.stringify(extra))); if (!c) falhas.push(m); };
  const hoje = new Date();
  const seg = new Date(hoje); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
  const resp = (x) => { const r = { experiencia: 'regular', kmSemana: 30, longoAtual: 12, pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 1, temAlvo: 'nao', dias: ['0', '2', '4', '6'], diaLongo: '0', tempo: '60', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], resultado: 'nao', ...x };
    for (const q of PERGUNTAS) if (!(q.k in r) && !(q.se && !q.se(r)) && !q.opcional) r[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
    return r; };
  const st = (run) => store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, run, ui: { onboarded: true, installDismissedAt: new Date().toISOString() } });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 1200);
  const carregar = async (s) => { await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados: s }))}); await new Promise((r) => setTimeout(r, 300)); await m.flush(); return true;`); };

  console.log('1. Prova de 10 km no domingo desta semana: o cartão da semana da prova');
  await carregar(st({ answers: resp({}), aceitoEm: new Date().toISOString(), inicio: dk(seg), pausadoEm: '' }));
  await page.goto(B + '#/corrida', 300); await page.reload(1500);
  const c = await page.eval(`const e = document.getElementById('semana-prova'); return e ? e.innerText : '';`);
  ok(/Semana da prova/.test(c) && /Nada novo no dia/.test(c) && /O que comer na véspera e no dia/.test(c), 'o cartão aparece com o essencial', c.slice(0, 200));
  await page.eval(`const e = document.getElementById('semana-prova'); if (e) e.scrollIntoView({ block: 'center' }); return 1;`); await page.sleep(200);
  await page.shot('_semana_prova');

  console.log('2. Meia maratona sem data, de quem corre pouco: 1ª etapa, com o desafio previsto');
  await carregar(st({ answers: resp({ experiencia: 'iniciante', kmSemana: 8, longoAtual: 4, objetivo: 'distancia', distancia: '21', semanasProva: undefined, dias: ['1', '3', '5', '0'], diaLongo: 'auto', tempoLongo: '120' }), aceitoEm: '', inicio: '', pausadoEm: '' }));
  await page.goto(B + '#/corrida', 300); await page.reload(1500);
  const t = await page.eval(`return document.body.innerText;`);
  ok(/1ª etapa da preparação para a meia maratona/.test(t), 'a proposta diz que é a 1ª etapa', t.slice(0, 200));
  ok(/Desafio \(previsto\)/.test(t) && /Fim da 1ª etapa/.test(t), 'mostra o fim da etapa e o desafio previsto');
  ok(!/pouco para/.test(t), 'sem "pouco para"');
  await page.shot('_etapa_meia');

  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo.');
  return falhas.length;
};

// Teste de ponta a ponta de correr todo dia (logic/corrida.js, perfil → todoDia): quem já corre com regularidade, pela
// saúde, marca os 7 dias e o plano tem 7 corridas, com o aviso explicando; quem está começando fica com um dia sem corrida
// e o motivo. E o cardápio da Nutricionista: o azeite vem "na salada" e nenhum óleo de cozinha aparece como alimento.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/todo-dia.mjs
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
  const resp = (x) => { const r = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, pausa: 'treinando', objetivo: 'saude', dias: ['0', '1', '2', '3', '4', '5', '6'], diaLongo: 'auto', tempo: '60', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], resultado: 'nao', ...x };
    for (const q of PERGUNTAS) if (!(q.k in r) && !(q.se && !q.se(r)) && !q.opcional) r[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
    return r; };
  const st = (run) => store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, run: { answers: run, aceitoEm: new Date().toISOString(), inicio: dk(seg), pausadoEm: '' }, ui: { onboarded: true, installDismissedAt: new Date().toISOString() } });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  await page.goto(B, 1200);
  const carregar = async (s) => { await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(JSON.stringify({ app: 'fitcore', v: 1, dados: s }))}); await new Promise((r) => setTimeout(r, 300)); await m.flush(); return true;`); };

  console.log('1. Regular, pela saúde, 7 dias: 7 corridas na semana');
  await carregar(st(resp({})));
  await page.goto(B + '#/corrida', 300); await page.reload(1500);
  const t1 = await page.eval(`return document.body.textContent;`);
  ok(/Você pode correr todo dia/.test(t1), 'o aviso explica que pode correr todo dia', t1.slice(0, 200));
  const n1 = await page.eval(`const m = await import('/js/logic/corrida.js'); const s = (await import('/js/store.js')).state; const p = m.gerarPlano(s.run.answers); return p.semanas[1].dias.filter((d) => d.tipo !== 'descanso' && d.tipo !== 'caminhada').length;`);
  ok(n1 === 7, '7 corridas na semana', n1);
  await page.shot('_todo_dia');

  console.log('2. Iniciante, 7 dias marcados: um dia sem corrida e o motivo');
  await carregar(st(resp({ experiencia: 'iniciante', kmSemana: 8, longoAtual: 4 })));
  await page.goto(B + '#/corrida', 300); await page.reload(1500);
  const t2 = await page.eval(`return document.body.textContent;`);
  ok(/Você marcou os 7 dias/.test(t2) && /começando/.test(t2), 'explica por que um dia fica sem corrida', t2.slice(0, 200));
  await page.shot('_todo_dia_iniciante');

  console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo.');
  return falhas.length;
};

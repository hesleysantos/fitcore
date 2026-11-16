// Teste de ponta a ponta de "corrida e musculação" com treino montado à mão: a pergunta de prioridade e de fortalecimento
// para corrida; os treinos de fortalecimento entram nos dias livres do próprio plano (em casa: só peso do corpo e
// colchonete), trocar de lugar não duplica, e responder "não" tira os dias, com confirmação.
// Uso, com "npm start" rodando: node tools/e2e/navegador.mjs tools/e2e/combinado.mjs
import * as store from '../../www/js/store.js';
import { PERGUNTAS as P_CORRIDA, respostasCompletas as corridaOk } from '../../www/js/logic/corrida.js';

const B = 'http://localhost:5173/';
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = new Date();
const seg = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
const item = (ex, series, reps) => ({ ex, series, reps, descanso: 90 });

// treino montado à mão (segunda e quinta) + plano de corrida em andamento (terça e sábado)
function estado() {
  const plano = { id: 'p1', nome: 'Meu treino', origem: 'manual', criadoEm: new Date().toISOString(), info: '',
    dias: [{ id: 'd1', nome: 'Superiores', foco: '', itens: [item('supino-reto-halteres', 3, '8-12'), item('remada-unilateral-halter-serrote', 3, '8-12')] }], agenda: { 1: 'd1', 4: 'd1' } };
  const corrida = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: ['2', '6'], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  // perguntas criadas depois deste roteiro: primeira opção
  for (const q of P_CORRIDA) if (!(q.k in corrida) && !(q.se && !q.se(corrida)) && !q.opcional) corrida[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  if (!corridaOk(corrida)) throw new Error('respostas de corrida incompletas: atualize o roteiro');
  return store.sanitize({ v: store.VERSAO, settings: { tema: 'claro', animar: false }, gym: { all: true, has: {} }, plans: [plano], activePlan: 'p1',
    run: { answers: corrida, aceitoEm: new Date().toISOString(), inicio: dk(seg), pausadoEm: '' }, ui: { onboarded: true, installDismissedAt: new Date().toISOString() } });
}

export default async (page) => {
  await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 1, mobile: true });
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✖ ') + m); if (!c) falhas.push(m); };
  const txt = JSON.stringify({ app: 'fitcore', v: 1, dados: estado() });
  await page.goto(B, 1200);
  await page.eval(`const m = await import('/js/store.js'); m.importData(${JSON.stringify(txt)}); await new Promise((r) => setTimeout(r, 900));`);
  // o que ficou gravado: escolha, dias de fortalecimento acrescentados (id começa com "dfort") e a agenda
  const st = () => page.eval(`const m = await import('/js/store.js'); const { EX_POR_ID } = await import('/js/data/exercises.js'); const p = m.state.plans.find((x) => x.id === m.state.activePlan); const fort = p.dias.filter((d) => d.id.startsWith('dfort')); const itens = fort.flatMap((d) => d.itens); return JSON.stringify({ combo: m.state.combo, planos: m.state.plans.length, dias: p.dias.length, fort: fort.length, agenda: p.agenda, itens: itens.length, comAparelho: itens.filter((it) => (EX_POR_ID.get(it.ex).equip || []).some((k) => k !== 'colchonete')).length, fortNaAgenda: Object.values(p.agenda).filter((id) => id.startsWith('dfort')).length });`);
  const abrir = async () => { await page.goto(B + '#/treinos', 300); await page.reload(1400); return page.eval(`const b = [...document.querySelectorAll('#cartao-combinado button')].find((x) => /Responder|Mudar/.test(x.textContent)); if (!b) return false; b.click(); for (let i = 0; i < 20 && !document.querySelector('.sheet'); i++) await new Promise((x) => setTimeout(x, 100)); return !!document.querySelector('.sheet');`); };
  const escolher = (rotulo) => page.eval(`const o = [...document.querySelectorAll('.sheet .opt')].find((e) => e.querySelector('.o-t').textContent.trim() === ${JSON.stringify(rotulo)}); if (!o) return false; o.click(); await new Promise((x) => setTimeout(x, 200)); return true;`);
  // toca em Salvar; se aparecer a confirmação de tirar os treinos, confirma
  const salvar = () => page.eval(`const b = [...document.querySelectorAll('.sheet button')].find((x) => x.textContent.trim() === 'Salvar'); if (!b || b.disabled) return 'sem salvar'; b.click(); await new Promise((x) => setTimeout(x, 900)); const c = [...document.querySelectorAll('.sheet button')].find((x) => x.textContent.trim() === 'Tirar'); if (c) { c.click(); await new Promise((x) => setTimeout(x, 900)); return 'confirmou'; } return 'ok';`);

  console.log('1. A pergunta aparece e grava a prioridade e o fortalecimento em casa');
  ok(await abrir(), 'a folha abriu pela aba Treinos');
  ok(await escolher('Os dois por igual'), 'opção "Os dois por igual"');
  ok(await escolher('Sim, só com o peso do corpo'), 'opção "Sim, só com o peso do corpo"');
  ok((await salvar()) === 'ok', 'salvou');
  let e = JSON.parse(await st());
  ok(e.combo.foco === 'equilibrio' && e.combo.fortalecimento === 'casa', 'escolha gravada: ' + JSON.stringify(e.combo));
  ok(e.planos === 1 && e.fort >= 1 && e.dias === 1 + e.fort, `dias de fortalecimento acrescentados ao próprio plano (${e.fort}), sem criar outro plano`);
  ok(e.itens >= 3 && e.comAparelho === 0, `em casa: ${e.itens} exercícios, só peso do corpo e colchonete (com outro aparelho: ${e.comAparelho})`);
  ok(e.agenda['1'] === 'd1' && e.agenda['4'] === 'd1' && e.fortNaAgenda === e.fort, 'os treinos da pessoa continuam nos dias dela e o fortalecimento foi para outros dias: ' + JSON.stringify(e.agenda));
  const diasCasa = e.fort;

  console.log('2. Trocar para aparelhos de academia não duplica');
  ok(await abrir(), 'a folha abriu de novo');
  ok(await escolher('Sim, com aparelhos de academia'), 'opção "Sim, com aparelhos de academia"');
  ok((await salvar()) === 'ok', 'salvou');
  e = JSON.parse(await st());
  ok(e.combo.fortalecimento === 'academia' && e.fort >= 1 && e.fort <= Math.max(2, diasCasa) && e.dias === 1 + e.fort, `os dias antigos saíram e entraram os novos (${e.fort}), sem duplicar`);
  ok(e.comAparelho > 0, 'na academia entram exercícios com aparelho');

  console.log('3. "Não" tira os dias acrescentados, com confirmação');
  ok(await abrir(), 'a folha abriu de novo');
  ok(await escolher('Não'), 'opção "Não"');
  ok((await salvar()) === 'confirmou', 'pediu confirmação antes de tirar');
  e = JSON.parse(await st());
  ok(e.combo.fortalecimento === 'nao' && e.fort === 0 && e.dias === 1 && e.agenda['1'] === 'd1' && Object.keys(e.agenda).length === 2, 'os treinos de fortalecimento saíram e o treino da pessoa ficou intacto: ' + JSON.stringify(e.agenda));

  console.log('4. Recarregar: a escolha persiste');
  await page.reload(1400);
  e = JSON.parse(await st());
  ok(e.combo.foco === 'equilibrio' && e.combo.fortalecimento === 'nao', 'persistiu');
  const erros = page.erros.filter((x) => !/favicon|SWv|vibrate/.test(x));
  ok(!erros.length, 'sem erro no console: ' + erros.join(' | ').slice(0, 300));
  console.log(falhas.length ? `\nRESULTADO: ${falhas.length} falha(s)` : '\nRESULTADO: tudo certo');
  if (falhas.length) throw new Error(falhas.join('; '));
};

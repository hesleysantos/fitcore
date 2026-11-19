// Chat do Treinador com pedidos de dica e casos do dia a dia (1.14.0). Frases escritas por quem não viu o código:
// leva 11 (220, usadas para ajustar) e leva 12 (100, separadas para medir; medidas antes de olhar: dicas 52%, casos 82%,
// e 84% na versão anterior). Estes limites só protegem de piora.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as store from '../www/js/store.js';
import * as M from '../www/js/logic/chat/motor.js';
import { gerarPlano } from '../www/js/logic/trainer.js';

const J = (x) => JSON.parse(JSON.stringify(x));
const TER = '2026-11-17';
const TREINO = { objetivo: 'hipertrofia', idade: 31, peso: 78, altura: 176, experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], remedios: ['nenhum'], foco: ['equilibrado'], semTreino: ['nenhum'] };
const p0 = gerarPlano(TREINO, { all: true, has: {} }, 0, null, null);
const PLANO = { id: 'p1', nome: 'Plano', origem: 'treinador', criadoEm: '2026-11-01T10:00:00.000Z', dias: p0.dias.map((d) => ({ id: d.id, nome: d.nome, foco: d.foco || '', itens: d.itens })), agenda: p0.agenda, info: '' };
const ST = store.sanitize({ v: store.VERSAO, trainer: { answers: TREINO, aceitoEm: '2026-11-01T10:00:00.000Z' }, plans: [J(PLANO)], activePlan: 'p1' });
const ctx = () => ({ st: ST, hoje: TER, agora: Date.parse(TER + 'T15:00:00Z'), coach: 'treinador' });
function decide(texto) {
  const r = M.entender(texto, 'treinador', ctx());
  const p = M.limparPasso(M.responder(texto, 'treinador', ctx()));
  if (p.assunto) return { tipo: 'direto', ids: [p.assunto] };
  if (/^Você quer falar sobre/.test(p.texto[0] || '') && r.melhor) return { tipo: 'confirma', ids: [r.melhor.intencao.id] };
  if (p.faqQ) return { tipo: 'faq', ids: ['faq:' + p.faqQ] };
  if (p.ir && r.deOutro) return { tipo: 'pergunta', ids: [r.deOutro.intencao.id] };
  if (p.opcoes && /É sobre um destes|É isto que|É algum destes/.test(p.texto.join(' '))) return { tipo: 'pergunta', ids: [...p.opcoes.map((o) => o.valor), ...(p.faq || []).map((f) => 'faq:' + f.q)] };
  return { tipo: 'nada', ids: (p.faq || []).map((f) => 'faq:' + f.q), seg: /\b(188|192)\b/.test(p.texto.join(' ')) };
}
function medir(lista) {
  let ok = 0, errado = 0;
  for (const f of lista) {
    const d = decide(f.texto);
    const bate = f.esperado.includes('nenhum') ? d.tipo === 'nada' || d.tipo === 'pergunta' || d.ids.some((x) => f.esperado.includes(x)) : d.seg || d.ids.some((x) => f.esperado.includes(x));
    if (bate) ok++; else if (d.tipo === 'direto' || d.tipo === 'faq' || d.tipo === 'confirma') errado++;
  }
  return { taxa: ok / lista.length, errado: errado / lista.length };
}
const ler = (n) => JSON.parse(fs.readFileSync(new URL(`./dados/frases-treinador-${n}.json`, import.meta.url), 'utf8'));
test('Treinador: pedidos de dica e casos do dia a dia (levas 11 e 12): acerto mínimo e poucas respostas de outro assunto', () => {
  const l11 = ler('leva11'), l12 = ler('leva12');
  for (const [nome, lista, minimo, errMax] of [['leva 11 dicas', l11.dicas, 0.8, 0.1], ['leva 11 casos', l11.casos, 0.88, 0.07], ['leva 12 dicas', l12.dicas, 0.5, 0.22], ['leva 12 casos', l12.casos, 0.84, 0.1]]) {
    const r = medir(lista);
    console.log(`  ${nome}: ${Math.round(r.taxa * 1000) / 10}% (outro assunto: ${Math.round(r.errado * 1000) / 10}%)`);
    assert.ok(r.taxa >= minimo, `${nome}: ${r.taxa}`);
    assert.ok(r.errado <= errMax, `${nome}: outro assunto ${r.errado}`);
  }
});
test('feriado no chat: o motivo já vem dito e a ação guarda o feriado', () => {
  const p = M.limparPasso(M.responder('quinta é feriado e a academia não abre', 'treinador', ctx()));
  assert.equal(p.assunto, 'treino-perdido');
  assert.match(p.texto[0], /Feriado: a academia não abre/);
  const a = (p.acoes || []).find((x) => /^Passar para/.test(x.rotulo));
  assert.ok(a, 'propõe outro dia');
  const s = J(ST);
  assert.notEqual(a.aplicar(s, { ...ctx(), st: s }), false);
  assert.ok(s.feriados.includes('2026-11-19') && s.perdidos.some((m) => m.motivo === 'feriado'));
  // "adiantar o treino de amanhã porque é feriado" é antecipar, não faltar
  assert.equal(M.entender('amanha é feriado e a academia fecha, queria adiantar o treino de amanha hj', 'treinador', ctx()).melhor.intencao.id, 'antecipar');
});

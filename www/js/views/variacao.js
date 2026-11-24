// Aviso "Hora de variar": o cartão com as trocas (aba Treinos e painel do Treinador) e o aviso curto do Início.
// A regra, o prazo e as fontes ficam em logic/variacao.js; os substitutos vêm do Treinador (logic/trainer.js).
import { h, btn, toggle, toast, note, icon, plural, dateKey } from '../ui.js';
import { state, update } from '../store.js';
import { go, refresh } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { REFS } from '../data/knowledge.js';
import { thumb } from '../figure.js';
import { estagnados } from '../logic/progress.js';
import { saudeDoTreinador, doresDoTreino } from '../logic/trainer.js';
import * as V from '../logic/variacao.js';

const nome = (id) => (EX_POR_ID.get(id) || { nome: id }).nome;

// A situação do plano hoje, com a saúde das entrevistas, as dores e os exercícios travados. `forcar`: a pessoa pediu
// as trocas agora (botão do Treinador).
export function situacaoDoPlano(plan, forcar = false) {
  if (!plan || plan.origem === 'fortalecimento') return null;
  try {
    const hoje = dateKey(new Date());
    const sd = saudeDoTreinador(state, hoje);
    let travados = [];
    try { travados = estagnados(plan); } catch { travados = []; }
    return V.situacao(state, plan, { respostas: sd.respostas, gym: state.gym, dores: doresDoTreino(state, hoje, state.trainer.answers), travados, forcar });
  } catch { return null; }
}

function porQue() {
  const box = h('div', { class: 'col gap-s mt' }, h('div', { class: 'tiny bold muted', text: 'FONTES' }));
  for (const k of V.REFS_VARIACAO) if (REFS[k]) box.appendChild(h('p', { class: 'ref', text: '• ' + REFS[k] }));
  return h('details', { class: 'pq', id: 'variacao-porque' }, h('summary', { text: 'Por quê?' }),
    h('p', { class: 'small', text: 'Os exercícios principais e os de peso livre com várias articulações ficam: pedem técnica, e é neles que a carga mostra a sua evolução. Trocar tudo a cada treino rendeu um pouco menos de força e de músculo.' }),
    h('p', { class: 'small', text: 'Variar os auxiliares (de máquina, polia ou isolados) ajuda o músculo a crescer por inteiro e deixa o treino menos repetitivo. O substituto trabalha o mesmo músculo, no mesmo movimento, com os seus aparelhos.' }),
    h('p', { class: 'small', text: 'Nenhum estudo definiu de quanto em quanto tempo trocar. O prazo segue o ciclo de treino usado na prática, de 4 a 8 semanas: 6 semanas de treino, ou 8 para quem está começando e ainda aprende os movimentos.' }),
    h('p', { class: 'small', text: 'Antes disso, só troca o auxiliar que ficar 3 treinos sem evoluir (regra do aplicativo) ou que doer.' }),
    box);
}

// Cartão completo. `sit` = situacaoDoPlano(plan); `forcar` = trocas pedidas agora.
export function cartaoVariacao(plan, sit, { forcar = false, aoFechar = null } = {}) {
  if (!plan || !sit) return null;
  if (!forcar && !sit.devido) return null;
  const fechar = () => { if (aoFechar) aoFechar(); refresh(); };
  const txt = sit.devido ? V.textoDoAviso(sit, nome) : { titulo: 'Trocas sugeridas', texto: 'Os exercícios principais continuam.' };
  const card = h('div', { class: 'card hl col gap-s', id: 'variacao', dataset: { motivo: sit.motivo || 'pedido' } },
    h('div', { class: 'row' }, icon('swap', 'accent'), h('h2', { class: 'grow', text: txt.titulo })),
    // o título já diz "Hora de variar": a frase começa em "Você faz este treino há..."
    h('p', { class: 'small', text: txt.curto || txt.texto }));
  if (sit.emVolta || sit.bloqueado) {
    card.appendChild(note('info', sit.bloqueado ? 'Resolva primeiro o aviso de saúde do Treinador.' : 'Você está voltando de uma pausa: as trocas esperam a volta terminar, para não somar exercício novo à volta.'));
    card.appendChild(btn('Fechar', fechar, 'block ghost'));
    return card;
  }
  const trocas = sit.trocas.map((t) => ({ ...t, k: 0, on: true }));
  if (!trocas.length) {
    if (forcar && !sit.devido) card.appendChild(note('info', 'Não encontrei substitutos com os seus aparelhos e cuidados. O treino pode seguir como está.'));
  } else {
    const opcoesDe = (t) => (Array.isArray(t.opcoes) && t.opcoes.length ? t.opcoes : [t.para]);
    // uma troca: a foto e o nome do que entra (um toque abre o exercício), o que sai embaixo e o botão de aceitar
    const linha = (t) => {
      const para = EX_POR_ID.get(t.para);
      const outras = opcoesDe(t).length > 1;
      return h('div', { class: 'row top variacao-troca', dataset: { de: t.de, para: t.para } },
        h('button', { class: 'thumb mini', type: 'button', 'aria-label': 'Ver exercício ' + para.nome, onClick: () => go('exercicio/' + para.id) }, thumb(para)),
        h('div', { class: 'grow col' },
          h('div', { class: 'small bold', text: para.nome }),
          h('div', { class: 'tiny muted', text: 'No lugar de ' + nome(t.de) }),
          outras ? btn('Outra opção', () => trocarOpcao(t), 'sm plain variacao-outra', 'refresh') : null),
        toggle(t.on, (v) => { t.on = v; }, `Trocar ${nome(t.de)} por ${para.nome}`));
    };
    // as trocas agrupadas pelo treino (o nome do treino aparece uma vez)
    const lista = h('div', { class: 'col gap-s' });
    const desenhar = () => {
      while (lista.firstChild) lista.removeChild(lista.firstChild);
      let dia = null;
      for (const t of trocas) {
        if (t.diaId !== dia) { dia = t.diaId; lista.appendChild(h('div', { class: 'tiny muted bold mt', text: t.dia.toUpperCase() })); }
        lista.appendChild(linha(t));
      }
    };
    // a próxima alternativa da lista que ainda não foi escolhida para o mesmo treino
    const trocarOpcao = (t) => {
      const ops = opcoesDe(t);
      const usados = new Set(trocas.filter((x) => x !== t && x.diaId === t.diaId).map((x) => x.para));
      for (let i = 1; i <= ops.length; i++) {
        const k = (t.k + i) % ops.length;
        if (!usados.has(ops[k])) { t.k = k; t.para = ops[k]; break; }
      }
      desenhar();
    };
    desenhar();
    card.appendChild(lista);
    card.appendChild(h('p', { class: 'tiny muted', text: 'Nos exercícios novos, comece mais leve na primeira semana: exercício novo dá mais dor muscular.' }));
    card.appendChild(btn('Trocar os marcados', () => {
      const escolhidas = trocas.filter((t) => t.on);
      let n = 0;
      update((s) => {
        const p = s.plans.find((x) => x.id === plan.id);
        if (!p) return;
        // marcou nenhuma: é o mesmo que manter o treino (no prazo) ou deixar para depois (exercício travado)
        if (!escolhidas.length) { V.manterTreino(p, new Date().toISOString(), sit.motivo, sit.prazo); return; }
        n = V.aplicarVariacao(p, escolhidas, new Date().toISOString(), sit.motivo === 'travado' ? 'travado' : 'prazo');
        if (n && p.origem === 'treinador') s.trainer.versao = ((s.trainer.versao || 0) + 1) % 9996;
      });
      toast(n ? `${plural(n, 'exercício trocado', 'exercícios trocados')}. Comece mais leve nos novos.` : 'Nenhuma troca feita.');
      fechar();
    }, 'primary block', 'check'));
  }
  const acoes = h('div', { class: 'row par-de-botoes' },
    btn('Lembrar depois', () => { update((s) => { const p = s.plans.find((x) => x.id === plan.id); if (p) V.adiarVariacao(p, new Date().toISOString()); }); toast(`Combinado. Lembro você daqui a ${V.ADIAR_SEMANAS} semanas.`); fechar(); }, 'grow ghost'),
    btn('Manter meu treino', () => { update((s) => { const p = s.plans.find((x) => x.id === plan.id); if (p) V.manterTreino(p, new Date().toISOString(), sit.motivo, sit.prazo); }); toast(sit.motivo === 'travado' ? 'Treino mantido. A sugestão de carga traz um treino mais leve e depois a volta à carga.' : `Treino mantido. Volto a sugerir em ${sit.prazo} semanas de treino.`); fechar(); }, 'grow ghost'));
  card.appendChild(!forcar || sit.devido ? acoes : btn('Fechar', fechar, 'block ghost'));
  card.appendChild(porQue());
  return card;
}

// Aviso curto do Início: uma linha e o botão que leva às trocas, na aba Treinos.
export function avisoVariacao(plan, sit) {
  if (!plan || !sit || !sit.devido || sit.emVolta || sit.bloqueado) return null;
  const txt = V.textoDoAviso(sit, nome);
  return h('div', { class: 'card col gap-s', id: 'inicio-variacao' },
    h('div', { class: 'row' }, icon('swap', 'accent'), h('div', { class: 'grow' }, h('h3', { text: txt.titulo }), h('p', { class: 'small muted', text: txt.curto || txt.texto }))),
    btn(sit.trocas.length ? 'Ver as trocas' : 'Ver o aviso', () => go('treinos'), 'primary block', 'swap'));
}

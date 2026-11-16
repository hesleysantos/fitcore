// Corrida + musculação: pergunta o que priorizar e se a pessoa quer fortalecimento para a corrida.
// A escolha fica em state.combo (logic/combinado.js). O que ela muda vem de cada treinador:
//   logic/trainer.js → efeitoDoFoco(foco, st), planoFortalecimento(st, { local, hoje, ocupados })
//   logic/corrida.js → efeitoDoFoco(foco, st)
import { h, btn, icon, badge, toast, uid, dateKey, confirmSheet } from '../ui.js';
import { state, update, activePlan, MAX_PLANOS } from '../store.js';
import { go, refresh } from '../router.js';
import { folha } from './common.js';
import { FOCOS, comboAtual, faltaPerguntar, temCorrida, temOsDois, temMusculacao, planoEhFortalecimento, chaveCombo } from '../logic/combinado.js';
import * as T from '../logic/trainer.js';
import * as C from '../logic/corrida.js';

const NOME_FOCO = { corrida: 'Corrida', musculacao: 'Musculação', equilibrio: 'Os dois por igual' };
const SUB_FOCO = {
  corrida: 'A corrida vem primeiro; a musculação se ajusta para não atrapalhar os treinos-chave.',
  musculacao: 'A musculação vem primeiro; a corrida entra como complemento, sem tirar a recuperação.',
  equilibrio: 'O aplicativo distribui a semana para os dois renderem, com os treinos pesados longe um do outro.',
};
const NOME_FORT = { nao: 'Sem fortalecimento', sim: 'No meu treino de musculação', academia: 'Na academia', casa: 'Em casa' };
const hoje = () => dateKey(new Date());

// o que a escolha muda, dito por cada treinador (quando a função existe); devolve linhas de texto
function efeitos(foco) {
  const out = [];
  for (const M of [T, C]) {
    try { const e = typeof M.efeitoDoFoco === 'function' ? M.efeitoDoFoco(foco, state) : null; if (e && Array.isArray(e.linhas)) for (const l of e.linhas) if (typeof l === 'string' && l) out.push(l); } catch { /* segue sem o detalhe */ }
  }
  return out.slice(0, 4);
}

// plano ativo é do Treinador (pode ser remontado por ele) ou foi montado à mão / de modelo?
const planoDoTreinador = () => { const p = activePlan(); return !!p && p.origem === 'treinador' && !!state.trainer.aceitoEm; };

// Dias de fortalecimento acrescentados a um plano montado à mão ou de modelo: o id começa com este prefixo, para poder
// trocá-los ou tirá-los depois sem mexer nos treinos da pessoa.
const PREFIXO_FORT = 'dfort';
const ehDiaDeFort = (d) => !!d && typeof d.id === 'string' && d.id.startsWith(PREFIXO_FORT);
// o plano ativo é um treino da própria pessoa (montado à mão ou de modelo)?
const planoProprio = () => { const p = activePlan(); return !!p && p.origem !== 'treinador' && p.origem !== 'fortalecimento'; };
// tira do plano (rascunho do estado) os dias de fortalecimento acrescentados antes, e a agenda que apontava para eles
function tirarDiasDeFort(plano) {
  if (!plano || !Array.isArray(plano.dias)) return 0;
  const ids = new Set(plano.dias.filter(ehDiaDeFort).map((d) => d.id));
  if (!ids.size) return 0;
  plano.dias = plano.dias.filter((d) => !ids.has(d.id));
  for (const wd of Object.keys(plano.agenda || {})) if (ids.has(plano.agenda[wd])) delete plano.agenda[wd];
  return ids.size;
}
const temFortalecimentoMontado = () => state.plans.some((p) => p.origem === 'fortalecimento' || (Array.isArray(p.dias) && p.dias.some(ehDiaDeFort)));

// Cria (ou acrescenta) os treinos de fortalecimento. Devolve { ok, texto }: o que foi feito, ou por que não foi possível.
function aplicarFortalecimento(escolha) {
  const falhou = (texto) => ({ ok: false, texto: texto || 'Não consegui montar os treinos de fortalecimento agora: faltam dias livres na semana ou há uma dor que impede os exercícios. A escolha ficou gravada; tente de novo quando isso mudar.' });
  if (typeof T.planoFortalecimento !== 'function') return falhou();
  // já tem musculação do Treinador: ele mesmo ajusta o plano (a tela do Treinador mostra a proposta)
  if (escolha === 'sim') return planoDoTreinador() ? { ok: true, texto: 'O Treinador vai propor o seu treino com o fortalecimento.' } : falhou();
  const local = escolha === 'casa' ? 'casa' : 'academia';
  const p = activePlan();
  if (planoProprio()) {
    // plano montado à mão ou de modelo: os treinos de fortalecimento entram como dias a mais, só nos dias livres
    const ocupados = Object.keys(p.agenda).filter((wd) => { const d = p.dias.find((x) => x.id === p.agenda[wd]); return d && !ehDiaDeFort(d); }).map(Number);
    const fz = T.planoFortalecimento(state, { local, hoje: hoje(), ocupados });
    if (!fz || !Array.isArray(fz.dias) || !fz.dias.length) return falhou(fz && fz.texto);
    update((st) => {
      const alvo = st.plans.find((x) => x.id === st.activePlan);
      if (!alvo) return;
      tirarDiasDeFort(alvo); // nunca duplica: os dias de antes saem e entram os novos
      const mapa = {};
      for (const d of fz.dias) { const id = PREFIXO_FORT + uid(); mapa[d.id] = id; alvo.dias.push({ id, nome: d.nome, foco: d.foco || '', itens: d.itens.map((it) => ({ ...it })) }); }
      for (const [wd, id] of Object.entries(fz.agenda || {})) if (!(wd in alvo.agenda) && mapa[id]) alvo.agenda[wd] = mapa[id];
    });
    return { ok: true, texto: 'Treinos de fortalecimento acrescentados ao seu plano, nos dias livres.' };
  }
  const fz = T.planoFortalecimento(state, { local, hoje: hoje(), ocupados: [] });
  if (!fz || !Array.isArray(fz.dias) || !fz.dias.length) return falhou(fz && fz.texto);
  if (state.plans.length >= MAX_PLANOS && !state.plans.some((x) => x.origem === 'fortalecimento')) return falhou('Você chegou ao limite de planos. Apague um plano antigo para criar o de fortalecimento.');
  update((st) => {
    // um plano de fortalecimento anterior é substituído pelo novo
    st.plans = st.plans.filter((x) => x.origem !== 'fortalecimento');
    const id = 'p' + uid();
    st.plans.push({ id, nome: fz.nome || 'Fortalecimento para corrida', origem: 'fortalecimento', criadoEm: new Date().toISOString(), dias: fz.dias.map((d) => ({ id: d.id, nome: d.nome, foco: d.foco || '', itens: d.itens.map((it) => ({ ...it })) })), agenda: { ...(fz.agenda || {}) }, info: fz.info || '' });
    st.activePlan = id;
  });
  return { ok: true, texto: 'Plano de fortalecimento criado. Ele aparece na aba Treinos, na seção Musculação de cada dia.' };
}

// Folha com as perguntas. `aoMudar()` é chamado depois de gravar.
export function perguntarCombinado({ aoMudar = null } = {}) {
  if (!temCorrida(state)) return;
  const atual = comboAtual(state);
  const dois = temOsDois(state) && !planoEhFortalecimento(state);
  const r = { foco: atual.foco, fortalecimento: atual.fortalecimento };
  const corpo = h('div', { class: 'col gap-l' });
  const opcoes = (rotulo, lista, campo, aoEscolher) => {
    const box = h('div', { class: 'opts', role: 'radiogroup', 'aria-label': rotulo });
    const draw = () => {
      while (box.firstChild) box.removeChild(box.firstChild);
      for (const [id, nome, sub] of lista) {
        box.appendChild(h('button', { type: 'button', class: 'opt' + (r[campo] === id ? ' on' : ''), role: 'radio', 'aria-checked': r[campo] === id ? 'true' : 'false', onClick: () => { r[campo] = id; draw(); if (aoEscolher) aoEscolher(); pode(); } },
          h('span', { class: 'tick' }, icon('check')), h('div', { class: 'grow' }, h('div', { class: 'o-t', text: nome }), sub ? h('div', { class: 'o-s', text: sub }) : null)));
      }
    };
    draw();
    return h('div', { class: 'col gap-s' }, h('div', { class: 'bold', text: rotulo }), box);
  };
  const detalhe = h('div', { class: 'col gap-s' });
  const drawDetalhe = () => {
    while (detalhe.firstChild) detalhe.removeChild(detalhe.firstChild);
    if (!r.foco) return;
    for (const l of efeitos(r.foco)) detalhe.appendChild(h('p', { class: 'small muted', text: '• ' + l }));
  };
  const salvar = btn('Salvar', async () => {
    const antes = comboAtual(state);
    // tirar o fortalecimento: pergunta antes de apagar o que foi montado (plano próprio ou dias acrescentados)
    let apagar = false;
    if (r.fortalecimento === 'nao' && temFortalecimentoMontado()) {
      apagar = await confirmSheet({ title: 'Tirar os treinos de fortalecimento?', text: 'Os treinos de fortalecimento saem da aba Treinos. Os seus outros treinos e o histórico do que já foi feito continuam.', okLabel: 'Tirar', cancelLabel: 'Manter os treinos' });
    }
    update((st) => {
      st.combo = { foco: dois ? r.foco : st.combo.foco, fortalecimento: r.fortalecimento, em: new Date().toISOString() };
      if (apagar) {
        st.plans = st.plans.filter((p) => p.origem !== 'fortalecimento');
        for (const p of st.plans) tirarDiasDeFort(p);
        if (!st.plans.some((p) => p.id === st.activePlan)) st.activePlan = st.plans[0] ? st.plans[0].id : '';
      }
    });
    let msg = '';
    if (r.fortalecimento !== antes.fortalecimento && r.fortalecimento && r.fortalecimento !== 'nao') {
      let res = null;
      try { res = aplicarFortalecimento(r.fortalecimento); } catch { res = null; }
      msg = res ? res.texto : 'Não consegui montar os treinos de fortalecimento agora. A escolha ficou gravada; tente de novo mais tarde.';
    }
    f.close();
    toast(msg || 'Escolha gravada. Os treinos passam a seguir essa prioridade.');
    if (aoMudar) aoMudar();
    refresh();
  }, 'primary grow');
  const pode = () => { salvar.disabled = (dois && !r.foco) || !r.fortalecimento; };
  if (dois) {
    corpo.appendChild(opcoes('Você faz corrida e musculação. O que vem primeiro?', FOCOS.map((id) => [id, NOME_FOCO[id], SUB_FOCO[id]]), 'foco', drawDetalhe));
    corpo.appendChild(detalhe);
    drawDetalhe();
  }
  const listaFort = planoDoTreinador()
    ? [['sim', 'Sim, no meu treino de musculação', 'O Treinador inclui os exercícios que protegem quem corre.'], ['nao', 'Não', 'O treino de musculação fica como está.']]
    : planoProprio() && temMusculacao(state)
      ? [['academia', 'Sim, com aparelhos de academia', 'Entram treinos curtos nos dias livres do seu plano.'], ['casa', 'Sim, só com o peso do corpo', 'Entram treinos curtos, para fazer em casa, nos dias livres do seu plano.'], ['nao', 'Não', 'O seu treino fica como está.']]
      : [['academia', 'Sim, na academia', 'Treinos curtos, com aparelhos.'], ['casa', 'Sim, em casa', 'Treinos curtos, com o peso do corpo.'], ['nao', 'Não agora', 'Você pode incluir depois.']];
  // com plano do Treinador, uma escolha antiga de lugar vale como "sim"
  if (planoDoTreinador() && (r.fortalecimento === 'academia' || r.fortalecimento === 'casa')) r.fortalecimento = 'sim';
  if (!listaFort.some((o) => o[0] === r.fortalecimento)) r.fortalecimento = '';
  corpo.appendChild(opcoes('Quer treinos de fortalecimento para a corrida?', listaFort, 'fortalecimento'));
  const f = folha({ title: dois ? 'Corrida e musculação' : 'Fortalecimento para a corrida', full: true, body: corpo, footer: [btn('Cancelar', () => f.close(), 'ghost'), salvar] });
  pode();
}

// Cartão para as telas (Início, Treinos, Treinador e Corrida). null quando não há corrida.
export function cartaoCombinado({ aoMudar = null } = {}) {
  if (!temCorrida(state)) return null;
  const falta = faltaPerguntar(state);
  const atual = comboAtual(state);
  const abrir = () => perguntarCombinado({ aoMudar });
  if (falta.foco || falta.fortalecimento) {
    return h('div', { class: 'card hl col gap-s', id: 'cartao-combinado' },
      h('h3', { text: falta.foco ? 'Corrida e musculação: o que vem primeiro?' : 'Fortalecimento para a corrida' }),
      h('p', { class: 'small muted', text: falta.foco ? 'Diga o que você quer priorizar e o aplicativo organiza a semana dos dois treinos.' : 'Treinos de força curtos ajudam quem corre. Quer incluir?' }),
      btn('Responder', abrir, 'primary block', 'check'));
  }
  const partes = [];
  if (atual.foco) partes.push('Prioridade: ' + NOME_FOCO[atual.foco].toLowerCase());
  if (atual.fortalecimento) partes.push('Fortalecimento: ' + NOME_FORT[atual.fortalecimento].toLowerCase());
  // o plano de musculação do Treinador foi montado com outra escolha: leva à proposta nova
  const desatualizado = planoDoTreinador() && temOsDois(state) && state.trainer.combo !== chaveCombo(atual) && (atual.foco || (atual.fortalecimento && atual.fortalecimento !== 'nao'));
  return h('div', { class: 'card col gap-s', id: 'cartao-combinado' },
    h('div', { class: 'row between' }, h('h3', { text: 'Corrida e musculação' }), desatualizado ? badge('Treino a ajustar', 'warn') : null),
    h('p', { class: 'small', text: partes.join(' · ') + '.' }),
    h('div', { class: 'row par-de-botoes' },
      desatualizado ? btn('Ver ajuste', () => go('treinador'), 'primary grow sm', 'right') : null,
      btn('Mudar', abrir, 'ghost grow sm', 'edit')));
}

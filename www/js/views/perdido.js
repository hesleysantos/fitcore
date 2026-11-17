// "Não treinei" e "Não corri": a folha com a proposta do aplicativo, a marca no dia e o "Desfazer".
// A regra (e as fontes) ficam em logic/perdido.js.
import { h, btn, badge, toast, confirmSheet, dateKey } from '../ui.js';
import { state, update } from '../store.js';
import { folha } from './common.js';
import { REFS } from '../data/knowledge.js';
import { REFS_CORRIDA as REFS_DA_CORRIDA } from '../data/corrida.js';
import { comboAtual } from '../logic/combinado.js';
import * as P from '../logic/perdido.js';

const hojeK = () => dateKey(new Date());
const fontes = (ks) => {
  const box = h('div', { class: 'col gap-s mt' }, h('div', { class: 'tiny bold muted', text: 'FONTES' }));
  for (const k of ks) { const t = REFS[k] || REFS_DA_CORRIDA[k]; if (t) box.appendChild(h('p', { class: 'ref', text: '• ' + t })); }
  return box;
};
const porQue = (linhas, refs) => h('details', { class: 'pq perdido-pq' }, h('summary', { text: 'Por quê?' }),
  ...linhas.map((t) => h('p', { class: 'small', text: t })), fontes(refs));

function porQueMusculacao() {
  let ajusta = false;
  try { const f = comboAtual(state).foco; ajusta = f === 'corrida' || f === 'equilibrio'; } catch { ajusta = false; }
  const l = [
    'Para o músculo, o que mais conta é o total de séries da semana. Com o mesmo total, treinar em mais ou menos dias muda pouco. Por isso, se der, o treino muda de dia.',
    'Entre dois treinos do mesmo músculo, 48 horas ou mais. Por isso o app não junta dois treinos no mesmo dia nem põe o mesmo músculo em dias seguidos.',
    'Sem um dia assim, siga a semana: perder um treino tira pouca força.',
  ];
  if (ajusta) l.push('Com a corrida, as pernas ficam a 24 horas ou mais da corrida forte e do longo.');
  l.push('Ficou 2 semanas ou mais sem treinar? O app aplica sozinho as regras da volta.');
  return porQue(l, [...P.REFS_MUSCULACAO, ...(ajusta ? P.REFS_COMBINADO : [])]);
}

// Folha "Não treinei" do treino de musculação de `data`. `aoMudar` redesenha a tela.
export function folhaNaoTreinei(data, aoMudar) {
  const hoje = hojeK();
  const p = P.propor(state, data, hoje);
  if (!p.pode) { toast('Este treino não pode ser marcado agora.'); return; }
  const gravar = (escolha) => {
    const m = P.novaMarca(state, data, hoje, escolha, new Date().toISOString());
    s.close();
    if (!m) { toast('Não foi possível marcar este treino.'); return; }
    update((st) => { st.perdidos = P.limparPerdidos([...(st.perdidos || []), m]); });
    toast(m.movs.length ? `${p.nome} passou para ${P.nomeDoDia(m.movs[0].para, hoje)}.` : `Marcado. O ${p.nome} volta ${P.naProxima(data)}.`);
    if (aoMudar) aoMudar();
  };
  const para = p.movs.length ? P.nomeDoDia(p.movs[0].para, hoje) : '';
  const botoes = p.movs.length
    ? [btn(`Passar para ${para}`, () => gravar('mover'), 'primary block', 'calendar'), btn('Seguir a semana', () => gravar('seguir'), 'block')]
    : [btn('Seguir a semana', () => gravar('seguir'), 'primary block'), btn('Cancelar', () => s.close(), 'ghost block')];
  const s = folha({
    title: data === hoje ? 'Não vai treinar hoje?' : `Não treinou ${P.DIAS[P.diaDaSemana(data)]}?`,
    body: h('div', { class: 'col gap-s', id: 'folha-nao-treinei' },
      h('p', { class: 'bold', text: p.titulo }),
      h('p', { class: 'small muted', text: p.texto }),
      h('div', { class: 'col gap-s mt' }, ...botoes),
      porQueMusculacao()),
  });
}

// Folha "Não corri" da corrida de `data`.
export function folhaNaoCorri(data, aoMudar) {
  const hoje = hojeK();
  if (!P.podeMarcarCorrida(state, data, hoje)) { toast('Esta corrida não pode ser marcada agora.'); return; }
  const gravar = () => {
    const m = P.marcaCorrida(data, new Date().toISOString());
    s.close();
    if (!m) return;
    update((st) => { st.perdidos = P.limparPerdidos([...(st.perdidos || []), m]); });
    toast('Marcado. Siga o plano.');
    if (aoMudar) aoMudar();
  };
  const s = folha({
    title: data === hoje ? 'Não vai correr hoje?' : `Não correu ${P.DIAS[P.diaDaSemana(data)]}?`,
    body: h('div', { class: 'col gap-s', id: 'folha-nao-corri' },
      h('p', { class: 'bold', text: 'Corrida perdida não se repõe.' }),
      h('p', { class: 'small muted', text: 'Siga o plano. O volume das próximas semanas acompanha o que você de fato correu.' }),
      h('div', { class: 'col gap-s mt' }, btn('Marcar como não feita', gravar, 'primary block'), btn('Cancelar', () => s.close(), 'ghost block')),
      porQue(['Juntar a corrida perdida a outra faz uma corrida maior. Uma corrida mais de 10% maior do que a mais longa dos últimos 30 dias aumenta o risco de lesão.',
        'Se faltarem corridas, o plano retoma de onde você está e sobe aos poucos.'], P.REFS_CORRIDA)),
  });
}

// Botão discreto que abre a folha
export const botaoNaoTreinei = (data, aoMudar, rotulo = 'Não treinei') => btn(rotulo, () => folhaNaoTreinei(data, aoMudar), 'sm plain nao-treinei');
export const botaoNaoCorri = (data, aoMudar) => btn('Não corri', () => folhaNaoCorri(data, aoMudar), 'sm plain nao-treinei');

async function desfazerMarca(entrada, aoMudar) {
  const n = P.quantasSaem(state.perdidos, entrada);
  if (n > 1) {
    const ok = await confirmSheet({ title: 'Desfazer esta marca?', text: 'As marcas feitas depois desta, nesta semana, também saem, e os treinos voltam aos dias da agenda.', okLabel: 'Desfazer' });
    if (!ok) return;
  }
  update((st) => { st.perdidos = P.desfazer(st.perdidos, entrada).lista; });
  toast('Desfeito.');
  if (aoMudar) aoMudar();
}

// Linha do dia marcado como não treinado: nome do treino, para onde foi e "Desfazer".
// `dia` = um dia de P.semanaEfetiva; `nome` = nome do treino perdido.
export function linhaNaoTreinado(dia, nome, aoMudar, podeDesfazer = true) {
  const hoje = hojeK();
  const para = dia.perdido.para;
  return h('div', { class: 'treino row perdido', 'data-perdido': dia.data },
    h('div', { class: 'grow' },
      h('div', { class: 'row gap-s' }, h('span', { class: 'bold', text: nome }), badge('Não treinado', 'warn')),
      h('div', { class: 'small muted', text: para ? `Passou para ${P.nomeDoDia(para, hoje)}.` : `Volta ${P.naProxima(dia.data)}.` })),
    podeDesfazer ? btn('Desfazer', () => desfazerMarca(dia.perdido.entrada, aoMudar), 'sm ghost nao-treinei') : null);
}
// Linha da corrida marcada como não feita
export function linhaNaoCorrida(entrada, nome, aoMudar, podeDesfazer = true) {
  return h('div', { class: 'treino row perdido', 'data-corrida-perdida': entrada.data },
    h('div', { class: 'grow' },
      h('div', { class: 'row gap-s' }, h('span', { class: 'bold', text: nome || 'Corrida' }), badge(entrada.para ? 'Mudou de dia' : 'Não feita', entrada.para ? 'acc' : 'warn')),
      // corrida que mudou de dia pelo chat (marca com `para`)
      h('div', { class: 'small muted', text: entrada.para ? `Passou para ${P.nomeDoDia(entrada.para, hojeK())}.` : 'Não se repõe: o plano segue.' })),
    podeDesfazer ? btn('Desfazer', () => desfazerMarca(entrada, aoMudar), 'sm ghost nao-treinei') : null);
}

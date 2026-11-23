// "Adicionar outro treino" a um dia: outro treino de musculação, treino livre, corrida ou outro esporte (futebol, vôlei,
// natação...). O esporte guarda só o tempo; o gasto estimado vem de logic/esportes.js (Compendium 2024).
import { h, btn, icon, iconBtn, toast, uid, plural, dateKey, stepper } from '../ui.js';
import { state, update, activePlan } from '../store.js';
import { go, refresh } from '../router.js';
import { folha } from './common.js';
import { startSession, startFree } from './session.js';
import { ESPORTES, ESPORTE_POR_ID, GRUPOS_ESPORTE } from '../data/esportes.js';
import { gastoPorMinuto, gastoDaAtividade, atividadesDoDia, MIN_MAX } from '../logic/esportes.js';

const fmtKcal = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const porMinTxt = (g) => `≈ ${String(Math.round(g.porMin * 10) / 10).replace('.', ',')} kcal por minuto`;

// Folha "Adicionar ao dia": o que mais a pessoa fez (ou vai fazer) nesse dia
export function folhaOutroTreino(data = dateKey(new Date()), aoMudar = refresh) {
  const hoje = data === dateKey(new Date());
  const plan = activePlan();
  const opt = (ic, t, s, onClick, attrs = {}) => h('button', { class: 'opt', type: 'button', onClick, ...attrs }, icon(ic, 'l accent'), h('div', null, h('div', { class: 'o-t', text: t }), h('div', { class: 'o-s', text: s })));
  const corpo = h('div', { class: 'col gap-s', id: 'folha-outro-treino' });
  const opcoes = h('div', { class: 'opts' });
  // musculação: hoje, o treino cronometrado; num dia que já passou, o registro do que foi feito (sem cronômetro)
  const passado = data < dateKey(new Date());
  const reg = passado ? { registro: data } : {};
  if ((hoje || passado) && plan && plan.dias.length) opcoes.appendChild(opt('dumbbell', passado ? 'Musculação feita neste dia' : 'Outro treino de musculação', passado ? 'Um treino do seu plano: marque as séries que você fez' : 'Um treino do seu plano, além do de hoje', () => {
    corpo.replaceChildren(h('p', { class: 'small muted', text: 'Qual treino?' }), h('div', { class: 'list' }, ...plan.dias.map((d) => h('button', { class: 'item', type: 'button', onClick: () => { s.close(); startSession(plan.id, d.id, reg); } },
      h('div', { class: 'grow' }, h('div', { class: 't', text: d.nome }), h('div', { class: 's', text: plural(d.itens.length, 'exercício', 'exercícios') })), icon(passado ? 'edit' : 'play', 's accent')))));
  }));
  if (hoje || passado) opcoes.appendChild(opt('bolt', passado ? 'Treino livre feito neste dia' : 'Treino livre de musculação', passado ? 'Escolha os exercícios e marque as séries' : 'Comece e vá adicionando os exercícios', () => { s.close(); startFree(reg); }));
  opcoes.appendChild(opt('run', 'Corrida ou caminhada', 'Registre com tempo e distância', () => { s.close(); go('corrida/dia/' + data); }));
  opcoes.appendChild(opt('star', 'Outro esporte', 'Futebol, vôlei, natação, dança... com as calorias', () => { s.close(); folhaEsporte(data, aoMudar); }, { 'data-acao': 'outro-esporte' }));
  corpo.appendChild(opcoes);
  const s = folha({ title: data < dateKey(new Date()) ? 'Adicionar treino feito' : 'Adicionar ao dia', body: corpo });
}

// Escolher o esporte e o tempo; mostra o gasto estimado enquanto a pessoa escolhe
export function folhaEsporte(data = dateKey(new Date()), aoMudar = refresh) {
  let esporte = '', min = 60;
  const estimativa = h('div', { class: 'esporte-kcal', 'aria-live': 'polite' });
  const desenharEstimativa = () => {
    estimativa.replaceChildren();
    if (!esporte) { estimativa.appendChild(h('p', { class: 'small muted', text: 'Escolha o esporte.' })); return; }
    const g = gastoPorMinuto(esporte, state);
    if (g.mostrar) estimativa.append(h('div', { class: 'esporte-total', text: `≈ ${fmtKcal(Math.round((g.porMin * min) / 10) * 10)} kcal` }), h('div', { class: 'small muted', text: `${porMinTxt(g)} · estimativa pela tabela de gasto das atividades` }));
    else if (g.motivo === 'peso') estimativa.appendChild(h('p', { class: 'small muted', text: 'Para estimar as calorias, registre o seu peso em “Evolução e peso”.' }));
    else estimativa.appendChild(h('p', { class: 'small muted', text: 'O tempo fica registrado no seu dia.' }));
  };
  const lista = h('div', { class: 'col gap-s' });
  const busca = h('input', { type: 'search', class: 'input', placeholder: 'Buscar esporte', 'aria-label': 'Buscar esporte', autocomplete: 'off' });
  const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const desenharLista = () => {
    const q = norm(busca.value.trim());
    lista.replaceChildren();
    for (const [grupo, nomeGrupo] of GRUPOS_ESPORTE) {
      const daqui = ESPORTES.filter((e) => e.grupo === grupo && (!q || norm(e.nome + ' ' + (e.busca || '')).includes(q)));
      if (!daqui.length) continue;
      lista.appendChild(h('div', { class: 'tiny muted bold', text: nomeGrupo }));
      lista.appendChild(h('div', { class: 'chips wrap', role: 'group', 'aria-label': nomeGrupo }, ...daqui.map((e) => h('button', { class: 'chip' + (esporte === e.id ? ' on' : ''), type: 'button', 'aria-pressed': String(esporte === e.id), 'data-esporte': e.id, onClick: () => { esporte = e.id; desenharLista(); desenharEstimativa(); } }, e.nome))));
    }
    if (!lista.firstChild) lista.appendChild(h('p', { class: 'small muted', text: 'Nenhum esporte com esse nome. Escolha o mais parecido.' }));
  };
  busca.addEventListener('input', desenharLista);
  desenharLista(); desenharEstimativa();
  const tempo = h('div', { class: 'row between' }, h('div', { class: 'bold', text: 'Minutos praticados' }), stepper({ value: min, min: 5, max: MIN_MAX, step: 5, label: 'Minutos praticados', onChange: (v) => { min = v; desenharEstimativa(); } }));
  const salvar = () => {
    if (!esporte) { toast('Escolha o esporte.'); return; }
    update((st) => { st.atividades = [...(st.atividades || []), { id: uid(), data, esporte, min, em: new Date().toISOString() }]; });
    s.close();
    toast(`${ESPORTE_POR_ID.get(esporte).nome}: ${min} min registrados.`);
    aoMudar();
  };
  const s = folha({ title: 'Outro esporte', body: h('div', { class: 'col gap-s', id: 'folha-esporte' }, tempo, estimativa, busca, lista), footer: btn('Salvar', salvar, 'primary block') });
}

// Os esportes registrados no dia, cada um com o gasto e um "x" para apagar
export function linhasAtividades(data, aoMudar = refresh) {
  const itens = atividadesDoDia(state, data);
  if (!itens.length) return null;
  return h('div', { class: 'col gap-s', 'data-atividades': data }, ...itens.map((a) => {
    const g = gastoDaAtividade(a, state);
    const e = ESPORTE_POR_ID.get(a.esporte);
    return h('div', { class: 'hoje-item esporte-item', 'data-atividade': a.id },
      h('span', { class: 'hoje-ic' }, icon('star', 's')),
      h('span', { class: 'grow col hoje-txt' }, h('span', { class: 'bold ellipsis', text: e.nome }), h('span', { class: 'small muted', text: `${a.min} min${g.mostrar ? ` · ≈ ${fmtKcal(g.kcal)} kcal` : ''}` })),
      iconBtn('close', `Apagar ${e.nome}`, () => { update((st) => { st.atividades = (st.atividades || []).filter((x) => x.id !== a.id); }); toast('Atividade apagada.'); aoMudar(); }, 'soft'));
  }));
}

export const botaoOutroTreino = (data, aoMudar = refresh, cls = 'plain sm', rotulo = 'Adicionar outro treino') => btn(rotulo, () => folhaOutroTreino(data, aoMudar), cls, 'plus');

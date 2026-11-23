// "Adicionar outro treino" a um dia: outro treino de musculação, treino livre, corrida ou outro esporte (futebol, vôlei,
// natação...). O esporte guarda só o tempo; o gasto estimado vem de logic/esportes.js (Compendium 2024).
import { h, btn, icon, iconBtn, toast, uid, plural, dateKey, stepper } from '../ui.js';
import { state, update, activePlan } from '../store.js';
import { go, refresh } from '../router.js';
import { folha } from './common.js';
import { startSession, startFree } from './session.js';
import { ESPORTES, ESPORTE_POR_ID, GRUPOS_ESPORTE } from '../data/esportes.js';
import { gastoPorMinuto, gastoDaAtividade, atividadesDoDia, MIN_MAX } from '../logic/esportes.js';
import { analisarEsporte, analisarMusculacao, analisarCorrida, gravarExtra, apagarExtra, planejadosDoDia } from '../logic/treino-extra.js';
import { nomeDoDia } from '../logic/perdido.js';

const fmtKcal = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const porMinTxt = (g) => `≈ ${String(Math.round(g.porMin * 10) / 10).replace('.', ',')} kcal por minuto`;

// Folha "Adicionar ao dia": o que mais a pessoa fez (ou vai fazer) nesse dia. Num dia que ainda vai chegar, o treino a mais
// passa pelo treinador, que mostra o que muda na semana antes de confirmar (logic/treino-extra.js)
export function folhaOutroTreino(data = dateKey(new Date()), aoMudar = refresh) {
  if (data > dateKey(new Date())) { folhaPlanejar(data, aoMudar); return; }
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
export function folhaEsporte(data = dateKey(new Date()), aoMudar = refresh, planejar = false) {
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
  const tempo = h('div', { class: 'row between' }, h('div', { class: 'bold', text: planejar ? 'Quantos minutos' : 'Minutos praticados' }), stepper({ value: min, min: 5, max: MIN_MAX, step: 5, label: planejar ? 'Quantos minutos' : 'Minutos praticados', onChange: (v) => { min = v; desenharEstimativa(); } }));
  const salvar = () => {
    if (!esporte) { toast('Escolha o esporte.'); return; }
    if (planejar) { s.close(); planejarEsporte(data, esporte, min, aoMudar); return; }
    const id = uid(), em = new Date().toISOString();
    update((st) => { st.atividades = [...(st.atividades || []), { id, data, esporte, min, em }]; });
    s.close();
    toast(`${ESPORTE_POR_ID.get(esporte).nome}: ${min} min registrados.`);
    aoMudar();
    // esporte de hoje que pesa nas pernas: o treinador recomenda afastar o treino de pernas e a corrida forte de hoje e de
    // amanhã, e pergunta antes (nada muda sozinho). As marcas levam o id da atividade e saem junto com ela.
    if (data === hojeKey()) {
      let a = null;
      try { a = analisarEsporte(state, data, esporte, min, data, id, em); } catch { a = null; }
      if (a && a.marcas.length) folhaAnalise({ titulo: `Depois do ${ESPORTE_POR_ID.get(esporte).nome.replace(/ \(.*\)$/, '').toLowerCase()}`, textos: a.textos, avisos: a.avisos, pergunta: 'É o recomendado, mas a escolha é sua: quer mudar?', confirmar: 'Mudar como recomendado', aoConfirmar: () => { update((st) => gravarExtra(st, null, a.marcas)); toast('Semana ajustada.'); aoMudar(); }, outro: { rotulo: 'Manter os treinos como estão', aoEscolher: () => {} } });
    }
  };
  const s = folha({ title: 'Outro esporte', body: h('div', { class: 'col gap-s', id: 'folha-esporte' }, tempo, estimativa, busca, lista), footer: btn(planejar ? 'Continuar' : 'Salvar', salvar, 'primary block') });
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
      iconBtn('close', `Apagar ${e.nome}`, () => { update((st) => { st.atividades = (st.atividades || []).filter((x) => x.id !== a.id); st.perdidos = (st.perdidos || []).filter((x) => !(x && x.extra === a.id)); }); toast('Atividade apagada.'); aoMudar(); }, 'soft'));
  }));
}

export const botaoOutroTreino = (data, aoMudar = refresh, cls = 'plain sm', rotulo = 'Adicionar outro treino') => btn(rotulo, () => folhaOutroTreino(data, aoMudar), cls, 'plus');

// ---------- treino a mais num dia que ainda vai chegar ----------
const hojeKey = () => dateKey(new Date());
// A análise do treinador: o que muda na semana, com Confirmar (ou o motivo de não dar)
// `outro`: { rotulo, aoEscolher } — a segunda escolha (por exemplo, manter os treinos como estão)
function folhaAnalise({ titulo, textos = [], avisos = [], pode = true, motivo = '', confirmar = 'Confirmar', aoConfirmar, outro = null, pergunta = '' }) {
  const corpo = h('div', { class: 'col gap-s', id: 'folha-analise-extra' },
    h('div', { class: 'tiny accent bold', text: 'O TREINADOR OLHOU A SEMANA' }),
    ...(pode ? textos : [motivo]).map((t) => h('p', { class: 'small', text: t })),
    ...(pode ? avisos : []).map((t) => h('div', { class: 'note warn small' }, icon('warn'), h('div', { class: 'grow', text: t }))),
    pergunta && pode ? h('p', { class: 'small bold', text: pergunta }) : null);
  const ok = btn(confirmar, () => { s.close(); aoConfirmar(); }, 'primary block', 'check');
  const footer = !pode ? btn('Entendi', () => s.close(), 'block') : outro ? h('div', { class: 'col gap-s' }, ok, btn(outro.rotulo, () => { s.close(); outro.aoEscolher(); }, 'ghost block')) : ok;
  const s = folha({ title: titulo, body: corpo, footer });
}
export function folhaPlanejar(data, aoMudar = refresh) {
  const plan = activePlan();
  const qd = nomeDoDia(data, hojeKey());
  const opt = (ic, t, sub, onClick, attrs = {}) => h('button', { class: 'opt', type: 'button', onClick, ...attrs }, icon(ic, 'l accent'), h('div', null, h('div', { class: 'o-t', text: t }), h('div', { class: 'o-s', text: sub })));
  const corpo = h('div', { class: 'col gap-s', id: 'folha-outro-treino' }, h('p', { class: 'small muted', text: `O que mais você vai fazer ${qd}? O treinador confere a semana e ajusta o resto.` }));
  const opcoes = h('div', { class: 'opts' });
  if (plan && plan.dias.length) opcoes.appendChild(opt('dumbbell', 'Musculação', 'Um treino do seu plano neste dia', () => {
    corpo.replaceChildren(h('p', { class: 'small muted', text: 'Qual treino?' }), h('div', { class: 'list' }, ...plan.dias.map((d) => h('button', { class: 'item', type: 'button', 'data-dia-plano': d.id, onClick: () => { s.close(); planejarMusculacao(data, d.id, aoMudar); } },
      h('div', { class: 'grow' }, h('div', { class: 't', text: d.nome }), h('div', { class: 's', text: d.foco || plural(d.itens.length, 'exercício', 'exercícios') })), icon('right', 's')))));
  }, { 'data-acao': 'planejar-musculacao' }));
  opcoes.appendChild(opt('run', 'Corrida', 'O treinador vê se muda uma corrida da semana ou põe uma a mais', () => { s.close(); planejarCorrida(data, aoMudar); }, { 'data-acao': 'planejar-corrida' }));
  opcoes.appendChild(opt('star', 'Outro esporte', 'Futebol, vôlei, beach tennis... o treinador sugere afastar o treino de pernas', () => { s.close(); folhaEsporte(data, aoMudar, true); }, { 'data-acao': 'outro-esporte' }));
  corpo.appendChild(opcoes);
  const s = folha({ title: 'Planejar treino a mais', body: corpo });
}
function planejarMusculacao(data, diaId, aoMudar) {
  const id = uid(), em = new Date().toISOString();
  const a = analisarMusculacao(state, data, diaId, hojeKey(), id, em);
  const nome = ((activePlan() || { dias: [] }).dias.find((d) => d.id === diaId) || {}).nome || 'Treino';
  folhaAnalise({ titulo: `${nome} ${nomeDoDia(data, hojeKey())}`, textos: a.textos, pode: a.pode, motivo: a.texto, aoConfirmar: () => { update((s) => gravarExtra(s, null, a.marcas)); toast('Semana ajustada.'); aoMudar(); } });
}
function planejarCorrida(data, aoMudar) {
  const id = uid(), em = new Date().toISOString();
  const hoje = hojeKey();
  const a = analisarCorrida(state, data, hoje, id, em);
  if (!a.pode) { folhaAnalise({ titulo: 'Corrida', pode: false, motivo: a.textos[0] || 'Não dá para este dia.' }); return; }
  const qd = nomeDoDia(data, hoje);
  const corpo = h('div', { class: 'col gap-s', id: 'folha-analise-extra' }, h('div', { class: 'tiny accent bold', text: 'O TREINADOR OLHOU A SEMANA' }));
  if (a.mover) {
    corpo.append(h('p', { class: 'small', text: `A corrida de ${nomeDoDia(a.mover.de, hoje)} (${String(a.mover.nome).toLowerCase()}) pode vir para ${qd}, e ${nomeDoDia(a.mover.de, hoje)} fica livre. É o melhor jeito: a semana não ganha volume de uma vez.` }),
      btn(`Passar a corrida de ${nomeDoDia(a.mover.de, hoje)} para ${qd}`, () => { s2.close(); update((s) => gravarExtra(s, null, [a.marcaMover])); toast('A corrida mudou de dia.'); aoMudar(); }, 'primary block', 'calendar'),
      h('p', { class: 'small muted', text: 'Ou, se quiser correr a mais:' }));
  }
  corpo.append(...a.avisos.map((t) => h('div', { class: 'note warn small' }, icon('warn'), h('div', { class: 'grow', text: t }))), ...a.textos.map((t) => h('p', { class: 'small muted', text: t })),
    btn(`Corrida leve a mais, até ${a.extraMin} min`, () => { s2.close(); update((s) => gravarExtra(s, { id, data, tipo: 'corrida', min: a.extraMin, em }, [])); toast('Corrida a mais planejada.'); aoMudar(); }, a.mover ? 'ghost block' : 'primary block', 'plus'));
  const s2 = folha({ title: `Corrida ${qd}`, body: corpo });
}
function planejarEsporte(data, esporte, min, aoMudar) {
  const id = uid(), em = new Date().toISOString();
  const a = analisarEsporte(state, data, esporte, min, hojeKey(), id, em);
  const plano = { id, data, tipo: 'esporte', esporte, min, em };
  const so = () => { update((s) => gravarExtra(s, plano, [])); toast('Esporte planejado. Os treinos continuam como estão.'); aoMudar(); };
  // com mudança recomendada, a pessoa decide: o treinador nunca muda sozinho
  if (a.marcas.length) folhaAnalise({ titulo: `${ESPORTE_POR_ID.get(esporte).nome} ${nomeDoDia(data, hojeKey())}`, textos: a.textos, avisos: a.avisos, pergunta: 'É o recomendado, mas a escolha é sua: quer mudar?', confirmar: 'Mudar como recomendado', aoConfirmar: () => { update((s) => gravarExtra(s, plano, a.marcas)); toast('Esporte planejado e semana ajustada.'); aoMudar(); }, outro: { rotulo: 'Manter os treinos como estão', aoEscolher: so } });
  else folhaAnalise({ titulo: `${ESPORTE_POR_ID.get(esporte).nome} ${nomeDoDia(data, hojeKey())}`, textos: a.textos, avisos: a.avisos, aoConfirmar: so });
}

// Treinos a mais planejados para o dia (esporte e corrida), com "Fiz" (esporte) ou "Registrar" (corrida) no dia, e o "x"
// que tira o treino e desfaz o que ele mudou na semana
export function linhasPlanejados(data, aoMudar = refresh) {
  const itens = planejadosDoDia(state, data);
  if (!itens.length) return null;
  const hoje = hojeKey();
  return h('div', { class: 'col gap-s', 'data-planejados': data }, ...itens.map((p) => {
    const e = p.tipo === 'esporte' ? ESPORTE_POR_ID.get(p.esporte) : null;
    const nome = e ? e.nome : 'Corrida leve a mais';
    const acao = e && data <= hoje ? btn('Fiz', () => {
      update((st) => { st.atividades = [...(st.atividades || []), { id: uid(), data, esporte: p.esporte, min: p.min, em: new Date().toISOString() }]; st.planejados = (st.planejados || []).filter((x) => x.id !== p.id); });
      toast(`${e.nome}: ${p.min} min registrados.`); aoMudar();
    }, 'sm primary') : !e && data === hoje ? btn('Registrar', () => go('corrida/dia/' + data), 'sm primary') : null;
    return h('div', { class: 'hoje-item esporte-item planejado', 'data-planejado': p.id },
      h('span', { class: 'hoje-ic' }, icon(e ? 'star' : 'run', 's')),
      h('span', { class: 'grow col hoje-txt' }, h('span', { class: 'bold ellipsis', text: nome }), h('span', { class: 'small muted', text: `${e ? '' : 'até '}${p.min} min · planejado` })),
      acao,
      iconBtn('close', `Tirar ${nome}`, () => { update((st) => apagarExtra(st, p.id)); toast('Tirado. A semana voltou ao que era.'); aoMudar(); }, 'soft'));
  }));
}

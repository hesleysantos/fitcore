// Treinos: planos, dias, agenda da semana e editor de cada treino.
import { h, btn, icon, iconBtn, confirmSheet, promptSheet, toast, badge, sectionTitle, note, uid, DIAS_CURTO, DIAS_LONGO, plural } from '../ui.js';
import { state, update, activePlan, planById, MAX_PLANOS } from '../store.js';
import { go, refresh } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { NIVEIS } from '../data/muscles.js';
import { MODELOS } from '../data/templates.js';
import { thumb } from '../figure.js';
import { novoItem, alvoTexto, duracaoEstimada, pickExercises, subtitulo, folha } from './common.js';
import { startSession, startFree } from './session.js';

const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];
const AGENDA_PADRAO = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 0] };
const ORIGEM = { treinador: 'Do Treinador', modelo: 'Modelo pronto', manual: 'Montado por você' };

function mut(planId, fn) {
  update((s) => { const p = s.plans.find((x) => x.id === planId); if (p) fn(p, s); });
}

const MAX_ITENS = 40; // exercícios por treino (o mesmo limite usado ao carregar os dados)
// avisa e devolve verdadeiro quando não cabe mais nenhum plano
function semVagaDePlano() {
  if (state.plans.length < MAX_PLANOS) return false;
  toast(`Você já tem ${MAX_PLANOS} planos. Exclua um plano antigo para criar outro.`);
  return true;
}

export function criarPlano({ nome, origem = 'manual', dias, agenda = {}, info = '' }) {
  if (semVagaDePlano()) return '';
  const id = 'p' + uid();
  update((s) => {
    s.plans.push({ id, nome, origem, criadoEm: new Date().toISOString(), dias, agenda, info });
    s.activePlan = id;
  });
  return id;
}
export function planoDeModelo(m) {
  const dias = m.dias.map((d) => ({ id: 'd' + uid(), nome: d.nome, foco: d.foco, itens: d.itens.filter((i) => EX_POR_ID.has(i.ex)).map((i) => ({ ...i, nota: '' })) }));
  const agenda = {};
  const wd = AGENDA_PADRAO[m.agenda.length] || [];
  m.agenda.forEach((di, i) => { if (dias[di] && wd[i] != null) agenda[wd[i]] = dias[di].id; });
  return criarPlano({ nome: m.nome, origem: 'modelo', dias, agenda, info: m.desc });
}

function modelsSheet() {
  const list = h('div', { class: 'list' });
  for (const m of MODELOS) {
    list.appendChild(h('button', {
      class: 'item', type: 'button',
      onClick: () => { const ok = planoDeModelo(m); s.close(); if (ok) toast('Modelo copiado. Você pode editar à vontade.'); refresh(); },
    }, h('div', { class: 'grow' },
      h('div', { class: 't', text: m.nome }),
      h('div', { class: 's', text: m.desc }),
      h('div', { class: 'row gap-s mt' }, badge(NIVEIS[m.nivel], m.nivel === 1 ? 'ok' : m.nivel === 3 ? 'warn' : ''), badge(plural(m.diasSemana, 'dia por semana', 'dias por semana')), badge(plural(m.dias.length, 'treino', 'treinos')))),
    icon('right', 's')));
  }
  const s = folha({ title: 'Modelos de treino', full: true, body: [h('p', { class: 'muted small', text: 'Escolha um modelo para copiar. Depois você pode trocar exercícios, séries e dias como quiser.' }), list] });
}

async function novoDoZero() {
  if (semVagaDePlano()) return; // avisa antes de pedir o nome
  const nome = await promptSheet({ title: 'Novo plano de treino', label: 'Nome do plano', value: 'Meu treino', okLabel: 'Criar' });
  if (!nome) return;
  const d = { id: 'd' + uid(), nome: 'Treino A', foco: '', itens: [] };
  const id = criarPlano({ nome, dias: [d] });
  if (id) go(`treino/${id}/${d.id}`);
}

function agendaSheet(plan, wd) {
  const list = h('div', { class: 'list' });
  const set = (diaId) => { mut(plan.id, (p) => { if (diaId) p.agenda[wd] = diaId; else delete p.agenda[wd]; }); s.close(); refresh(); };
  for (const d of plan.dias) {
    list.appendChild(h('button', { class: 'item' + (plan.agenda[wd] === d.id ? ' sel' : ''), type: 'button', onClick: () => set(d.id) },
      h('div', { class: 'grow' }, h('div', { class: 't', text: d.nome }), h('div', { class: 's', text: d.foco || plural(d.itens.length, 'exercício', 'exercícios') }))));
  }
  list.appendChild(h('button', { class: 'item' + (!plan.agenda[wd] ? ' sel' : ''), type: 'button', onClick: () => set('') }, h('div', { class: 'grow' }, h('div', { class: 't', text: 'Descanso' }), h('div', { class: 's', text: 'Sem treino neste dia' }))));
  const s = folha({ title: DIAS_LONGO[wd], body: [h('p', { class: 'muted small', text: 'Qual treino você faz neste dia da semana?' }), list] });
}

function planMenu(plan) {
  const items = [
    ['edit', 'Renomear plano', async () => { const n = await promptSheet({ title: 'Renomear plano', label: 'Nome', value: plan.nome }); if (n) { mut(plan.id, (p) => { p.nome = n; }); refresh(); } }],
    ['copy', 'Duplicar plano', () => {
      const dias = plan.dias.map((d) => ({ ...d, id: 'd' + uid(), itens: d.itens.map((i) => ({ ...i })) }));
      const mapa = new Map(plan.dias.map((d, i) => [d.id, dias[i].id]));
      const agenda = {};
      for (let k = 0; k < 7; k++) if (mapa.has(plan.agenda[k])) agenda[k] = mapa.get(plan.agenda[k]);
      if (criarPlano({ nome: (plan.nome + ' (cópia)').slice(0, 60), dias, agenda, info: plan.info })) toast('Plano duplicado');
      refresh();
    }],
    ['trash', 'Excluir plano', async () => {
      const ok = await confirmSheet({ title: 'Excluir este plano?', text: `“${plan.nome}” será apagado. O histórico dos treinos já feitos continua guardado.`, okLabel: 'Excluir', danger: true });
      if (!ok) return;
      update((st) => { st.plans = st.plans.filter((p) => p.id !== plan.id); if (st.activePlan === plan.id) st.activePlan = st.plans[0] ? st.plans[0].id : ''; });
      refresh();
    }],
  ];
  const body = h('div');
  for (const [ic, label, fn] of items) body.appendChild(h('button', { class: 'menu-item' + (ic === 'trash' ? ' danger' : ''), type: 'button', onClick: () => { s.close(); fn(); } }, icon(ic), label));
  const s = folha({ title: plan.nome, body });
}

export function plansView() {
  const plan = activePlan();
  const body = [];
  if (state.current) {
    body.push(h('div', { class: 'card hl row' }, icon('timer', 'accent'), h('div', { class: 'grow' }, h('div', { class: 'bold', text: 'Treino em andamento' }), h('div', { class: 'small muted', text: state.current.nome })), btn('Continuar', () => go('sessao'), 'primary sm')));
  }
  if (!plan) {
    body.push(h('div', { class: 'empty' }, icon('dumbbell'), h('h2', { text: 'Você ainda não tem um treino' }), h('p', { text: 'Escolha por onde começar:' })));
    body.push(h('div', { class: 'opts' },
      h('button', { class: 'opt', type: 'button', onClick: () => go('treinador') }, icon('coach', 'l accent'), h('div', null, h('div', { class: 'o-t', text: 'Pedir ao Treinador' }), h('div', { class: 'o-s', text: 'Responda algumas perguntas e receba uma sugestão de treino para o seu objetivo' }))),
      h('button', { class: 'opt', type: 'button', onClick: modelsSheet }, icon('copy', 'l accent'), h('div', null, h('div', { class: 'o-t', text: 'Usar um modelo pronto' }), h('div', { class: 'o-s', text: 'Treinos clássicos para copiar e adaptar' }))),
      h('button', { class: 'opt', type: 'button', onClick: novoDoZero }, icon('plus', 'l accent'), h('div', null, h('div', { class: 'o-t', text: 'Montar do zero' }), h('div', { class: 'o-s', text: 'Escolha você mesmo os exercícios de cada dia' }))),
      h('button', { class: 'opt', type: 'button', onClick: startFree }, icon('bolt', 'l accent'), h('div', null, h('div', { class: 'o-t', text: 'Treino livre agora' }), h('div', { class: 'o-s', text: 'Comece a registrar e vá adicionando exercícios' })))));
    return { title: 'Treinos', body };
  }

  body.push(h('div', { class: 'row between' },
    h('div', { class: 'grow' }, h('h2', { class: 'ellipsis', text: plan.nome }), h('div', { class: 'row gap-s mt' }, badge(ORIGEM[plan.origem], plan.origem === 'treinador' ? 'acc' : ''))),
    iconBtn('more', 'Opções do plano', () => planMenu(plan), 'soft')));
  if (plan.info) body.push(h('p', { class: 'small muted', text: plan.info }));

  // agenda da semana
  const week = h('div', { class: 'week' });
  const hoje = new Date().getDay();
  for (const wd of ORDEM_SEMANA) {
    const d = plan.dias.find((x) => x.id === plan.agenda[wd]);
    const idx = d ? plan.dias.indexOf(d) : -1;
    week.appendChild(h('button', { class: 'chip' + (d ? ' on' : ''), type: 'button', 'aria-label': `${DIAS_LONGO[wd]}: ${d ? d.nome : 'descanso'}`, onClick: () => agendaSheet(plan, wd) },
      h('div', { class: 'col gap-s center' }, h('span', { class: 'tiny' + (wd === hoje ? ' bold' : ''), text: DIAS_CURTO[wd] }), h('span', { class: 'bold', text: d ? ('ABCDEFGHIJKLMN'[idx] || '•') : '–' }))));
  }
  week.className = 'week7';
  body.push(h('div', { class: 'card tight col gap-s' }, h('div', { class: 'row between' }, h('h3', { text: 'Semana' }), h('span', { class: 'tiny muted', text: 'Toque num dia para mudar' })), week));

  // dias do plano
  body.push(sectionTitle('Treinos do plano'));
  if (!plan.dias.length) body.push(h('p', { class: 'small muted', text: 'Este plano ainda não tem treinos. Adicione o primeiro abaixo.' }));
  plan.dias.forEach((d, i) => {
    const thumbs = h('div', { class: 'row gap-s' });
    for (const it of d.itens.slice(0, 4)) { const ex = EX_POR_ID.get(it.ex); if (ex) thumbs.appendChild(h('div', { class: 'thumb mini' }, thumb(ex))); }
    body.push(h('div', { class: 'card col' },
      h('div', { class: 'row top' },
        h('div', { class: 'avatar', text: 'ABCDEFGHIJKLMN'[i] || '•' }),
        h('div', { class: 'grow' }, h('h3', { text: d.nome }), h('div', { class: 'small muted', text: d.foco || 'Sem descrição' }),
          h('div', { class: 'tiny muted mt', text: d.itens.length ? `${plural(d.itens.length, 'exercício', 'exercícios')} · cerca de ${duracaoEstimada(d)} min` : 'Nenhum exercício ainda' }))),
      h('div', { class: 'row' },
        btn('Editar', () => go(`treino/${plan.id}/${d.id}`), 'ghost grow', 'edit'),
        btn('Iniciar', () => startSession(plan.id, d.id), 'primary grow', 'play'))));
  });
  body.push(btn('Adicionar um treino ao plano', async () => {
    if (plan.dias.length >= 14) { toast('Limite de 14 treinos por plano.'); return; }
    const nome = await promptSheet({ title: 'Novo treino', label: 'Nome', value: 'Treino ' + ('ABCDEFGHIJKLMN'[plan.dias.length] || ''), okLabel: 'Criar', maxLength: 40 });
    if (!nome) return;
    const d = { id: 'd' + uid(), nome, foco: '', itens: [] };
    mut(plan.id, (p) => p.dias.push(d));
    go(`treino/${plan.id}/${d.id}`);
  }, 'block', 'plus'));

  // outros planos
  const outros = state.plans.filter((p) => p.id !== plan.id);
  if (outros.length) {
    body.push(sectionTitle('Outros planos'));
    const l = h('div', { class: 'list' });
    for (const p of outros) {
      l.appendChild(h('button', { class: 'item', type: 'button', onClick: () => { update((s) => { s.activePlan = p.id; }); toast('Plano ativado'); refresh(); } },
        h('div', { class: 'grow' }, h('div', { class: 't', text: p.nome }), h('div', { class: 's', text: `${ORIGEM[p.origem]} · ${plural(p.dias.length, 'treino', 'treinos')}` })), badge('Usar este')));
    }
    body.push(l);
  }
  body.push(sectionTitle('Criar outro plano'));
  body.push(h('div', { class: 'col' },
    btn('Pedir um treino ao Treinador', () => go('treinador'), 'block', 'coach'),
    btn('Modelos prontos', modelsSheet, 'block', 'copy'),
    btn('Montar do zero', novoDoZero, 'block', 'plus'),
    btn('Treino livre agora', startFree, 'block', 'bolt')));
  return { title: 'Treinos', body };
}

// ---------- editor de um treino ----------
const REPS = ['3-5', '4-6', '6-8', '6-10', '8-10', '8-12', '10-12', '10-15', '12-15', '12-20', '15-20', '20-25'];
const TEMPOS = ['10', '15', '20', '30', '40', '45', '60', '90', '120'];
const MINUTOS = ['5', '10', '15', '20', '25', '30', '40', '45', '60'];
const DESCANSOS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
function select(options, value, onChange, label, fmt = String) {
  const s = h('select', { class: 'select', 'aria-label': label, onChange: (e) => onChange(e.target.value) });
  let found = false;
  for (const [v, t] of options) { const o = h('option', { value: v, text: t }); if (String(v) === String(value)) { o.selected = true; found = true; } s.appendChild(o); }
  if (!found) { const o = h('option', { value, text: fmt(value) }); o.selected = true; s.insertBefore(o, s.firstChild); }
  return s;
}
const descTxt = (s) => (s === 0 ? 'Sem descanso' : s < 60 ? `${s} s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)} min ${s % 60} s`);

export function dayView(planId, dayId) {
  const plan = planById(planId);
  const day = plan && plan.dias.find((d) => d.id === dayId);
  if (!day) return { redirect: 'treinos' };
  const mutDay = (fn) => mut(planId, (p) => { const d = p.dias.find((x) => x.id === dayId); if (d) fn(d, p); });
  const body = [];
  const foco = h('input', { class: 'input', type: 'text', value: day.foco, maxlength: 90, placeholder: 'Ex.: peito, ombros e tríceps', onInput: (e) => mutDay((d) => { d.foco = e.target.value.trim().slice(0, 90); }) }); // grava a cada letra: sair da tela sem tirar o foco do campo não perde o texto
  body.push(h('label', { class: 'field' }, h('span', { text: 'O que este treino trabalha (opcional)' }), foco));
  if (!day.itens.length) body.push(h('div', { class: 'empty' }, icon('dumbbell'), h('p', { text: 'Este treino ainda está vazio. Adicione os exercícios que você quer fazer neste dia.' })));
  else body.push(h('p', { class: 'small muted', text: `${plural(day.itens.length, 'exercício', 'exercícios')} · cerca de ${duracaoEstimada(day)} minutos` }));

  day.itens.forEach((it, i) => {
    const ex = EX_POR_ID.get(it.ex);
    if (!ex) return;
    const tempo = ex.registro === 'segundos';
    const cardio = ex.registro === 'minutos';
    const set = (k, v) => { mutDay((d) => { if (d.itens[i]) d.itens[i][k] = v; }); refresh(); };
    const unidade = cardio ? 'Minutos' : tempo ? 'Segundos' : 'Repetições';
    const controls = h('div', { class: 'row gap-s' });
    if (!cardio) controls.appendChild(h('label', { class: 'field grow' }, h('span', { text: 'Séries' }), select([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, String(n)]), it.series, (v) => set('series', Number(v)), 'Séries')));
    controls.appendChild(h('label', { class: 'field grow' }, h('span', { text: unidade }), select((cardio ? MINUTOS : tempo ? TEMPOS : REPS).map((r) => [r, r]), it.reps, (v) => set('reps', v), unidade)));
    if (!cardio) controls.appendChild(h('label', { class: 'field grow' }, h('span', { text: 'Descanso' }), select(DESCANSOS.map((d) => [d, descTxt(d)]), it.descanso, (v) => set('descanso', Number(v)), 'Descanso entre séries', descTxt)));
    body.push(h('div', { class: 'card col' },
      h('div', { class: 'exhead' },
        h('button', { class: 'thumb', type: 'button', 'aria-label': 'Ver exercício ' + ex.nome, onClick: () => go('exercicio/' + ex.id) }, thumb(ex)),
        h('div', { class: 'grow' }, h('div', { class: 'bold', text: `${i + 1}. ${ex.nome}` }), h('div', { class: 'small muted', text: subtitulo(ex) }), h('div', { class: 'tiny muted', text: alvoTexto(it) }))),
      controls,
      h('div', { class: 'row' },
        iconBtn('up', 'Mover para cima', () => { if (i === 0) { toast('Este já é o primeiro exercício.'); return; } mutDay((d) => { const [x] = d.itens.splice(i, 1); d.itens.splice(i - 1, 0, x); }); refresh(); }, 'soft'),
        iconBtn('down', 'Mover para baixo', () => { if (i >= day.itens.length - 1) { toast('Este já é o último exercício.'); return; } mutDay((d) => { const [x] = d.itens.splice(i, 1); d.itens.splice(i + 1, 0, x); }); refresh(); }, 'soft'),
        h('div', { class: 'grow' }),
        btn('Trocar', async () => {
          const usados = new Set(day.itens.map((x) => x.ex));
          const [novo] = await pickExercises({ title: 'Trocar ' + ex.nome, multi: false, padrao: ex.padrao, excluir: usados });
          if (!novo) return;
          const nx = EX_POR_ID.get(novo);
          mutDay((d) => { if (d.itens[i]) d.itens[i] = nx.registro === ex.registro ? { ...d.itens[i], ex: novo } : novoItem(nx); });
          toast('Exercício trocado'); refresh();
        }, 'sm', 'swap'),
        btn('Remover', async () => {
          const ok = await confirmSheet({ title: 'Remover este exercício?', text: `“${ex.nome}” sai deste treino. O histórico de treinos já feitos não muda.`, okLabel: 'Remover', danger: true });
          if (!ok) return;
          // remove o exercício confirmado, mesmo que a lista tenha mudado enquanto a pergunta estava aberta
          mutDay((d) => { const k = d.itens[i] && d.itens[i].ex === it.ex ? i : d.itens.findIndex((x) => x.ex === it.ex); if (k >= 0) d.itens.splice(k, 1); });
          refresh();
        }, 'sm danger', 'trash'))));
  });
  body.push(btn('Adicionar exercícios', async () => {
    if (day.itens.length >= MAX_ITENS) { toast(`Este treino já tem ${MAX_ITENS} exercícios, que é o limite.`); return; }
    const ids = await pickExercises({ excluir: new Set(day.itens.map((x) => x.ex)) });
    if (!ids.length) return;
    let entraram = 0;
    mutDay((d) => { for (const id of ids) { const ex = EX_POR_ID.get(id); if (ex && d.itens.length < MAX_ITENS) { d.itens.push(novoItem(ex)); entraram++; } } });
    if (entraram < ids.length) toast(`Limite de ${MAX_ITENS} exercícios por treino: ${entraram ? `entraram só os ${entraram} primeiros` : 'nenhum foi adicionado'}.`);
    refresh();
  }, 'block', 'plus'));
  if (plan.dias.length > 1) {
    body.push(btn('Excluir este treino', async () => {
      const ok = await confirmSheet({ title: 'Excluir este treino?', text: `“${day.nome}” será removido do plano.`, okLabel: 'Excluir', danger: true });
      if (!ok) return;
      mut(planId, (p) => { p.dias = p.dias.filter((d) => d.id !== dayId); for (const k of Object.keys(p.agenda)) if (p.agenda[k] === dayId) delete p.agenda[k]; });
      go('treinos');
    }, 'block plain danger', 'trash'));
  }
  body.push(note('info', 'As alterações são salvas automaticamente.'));
  return {
    title: day.nome, back: 'treinos',
    actions: [iconBtn('edit', 'Renomear treino', async () => { const n = await promptSheet({ title: 'Renomear treino', label: 'Nome', value: day.nome, maxLength: 40 }); if (n) { mutDay((d) => { d.nome = n; }); refresh(); } })],
    body,
    footer: day.itens.length ? h('div', { class: 'fab-bar' }, btn('Iniciar este treino', () => startSession(planId, dayId), 'primary lg block', 'play')) : null,
  };
}

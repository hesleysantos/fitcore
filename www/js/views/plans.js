// Treinos: planos, dias, agenda da semana e editor de cada treino.
import { h, btn, icon, iconBtn, confirmSheet, promptSheet, toast, badge, sectionTitle, note, uid, DIAS_CURTO, DIAS_LONGO, plural, dateKey, pad2 } from '../ui.js';
import * as Corrida from '../logic/corrida.js';
import { state, update, activePlan, planById, MAX_PLANOS } from '../store.js';
import { go, refresh, replace } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { NIVEIS } from '../data/muscles.js';
import { MODELOS } from '../data/templates.js';
import { thumb } from '../figure.js';
import { novoItem, alvoTexto, duracaoEstimada, pickExercises, subtitulo, folha } from './common.js';
import { startSession, startFree } from './session.js';
import { cartaoCombinado } from './combinado.js';
import { cartaoAvaliacaoDoDia, cartaoAvaliacaoDoPlano } from './avaliacao.js';
import { semanaEfetiva, podeMarcar, podeMarcarCorrida, corridaPerdidaEm, nomeDoDia, ehFeriado } from '../logic/perdido.js';
import { botaoNaoTreinei, botaoNaoCorri, linhaNaoTreinado, linhaNaoCorrida, folhaNaoTreinei } from './perdido.js';
import { situacaoDoPlano, cartaoVariacao } from './variacao.js';
import { registrarTrocaManual } from '../logic/variacao.js';
import { diasBloqueados } from '../logic/dias-livres.js';
import { itensDoDia } from '../logic/ajuste-semana.js';
import { alcance, mudarItens, seloSemana } from './ajuste-semana.js';
import { linhasAtividades, botaoOutroTreino } from './esportes.js';

const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];
const AGENDA_PADRAO = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 0] };
const ORIGEM = { treinador: 'Do Treinador', modelo: 'Modelo pronto', manual: 'Montado por você', fortalecimento: 'Fortalecimento para corrida' };

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
  // dia que a pessoa marcou no Treinador como sem treino: a escolha à mão continua livre, mas a folha lembra
  const semTreino = diasBloqueados(state).includes(Number(wd));
  const s = folha({ title: DIAS_LONGO[wd], body: [h('p', { class: 'muted small', text: 'Qual treino você faz neste dia da semana?' }), semTreino ? note('info', 'No Treinador, você marcou que não treina neste dia.') : null, list].filter(Boolean) });
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

// Corrida planejada para cada dia desta semana (Treinador de corrida): { semana, totalSemanas, fase, dias: Array(7) } ou null.
// ---------- semana mostrada na aba (a atual, por padrão; dá para avançar e voltar) ----------
let semanaVista = 0; // 0 = esta semana, 1 = a que vem, -1 = a passada…
let semanaBase = ''; // segunda-feira da semana atual quando a pessoa mudou de semana: virou a semana, volta para a atual
const segundaDe = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const maisDias = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const diaMes = (d) => `${d.getDate()}/${pad2(d.getMonth() + 1)}`;
// Outras telas podem abrir a aba já em outra semana (ex.: o plano de corrida que começa na segunda que vem).
// Guarda o treino de corrida que o plano está mostrando hoje (e até domingo), para a análise e as semanas passadas
// compararem com o que a pessoa de fato viu. Só grava quando algo mudou.
export function guardarCorridaMostrada() {
  try {
    if (typeof Corrida.guardarDoDia !== 'function') return;
    const g = Corrida.guardarDoDia(state, dateKey(new Date()));
    if (g) update((s) => { if (s.run) { s.run.mostrados = g.mostrados; s.run.degrau = g.degrau; } });
  } catch { /* segue sem guardar */ }
}
export function mostrarSemana(n) { semanaVista = Math.max(-12, Math.min(52, Math.round(Number(n) || 0))); semanaBase = dateKey(segundaDe(new Date())); }
// o resumo do Início abre a aba já no cartão de hoje (o cartão completo do treino fica aqui)
let rolarParaHoje = false;
export function abrirHoje() { mostrarSemana(0); rolarParaHoje = true; go('treinos'); }
// Corrida da semana que começa em `segunda` (Date). Devolve { dias[wd], antesDoInicio?, ... } ou null.
function corridaDaSemana(segunda, n) {
  try {
    const hojeK = dateKey(new Date());
    if (typeof Corrida.planoDaSemanaEm === 'function') return Corrida.planoDaSemanaEm(state, hojeK, dateKey(segunda));
    if (n === 0) return Corrida.planoDaSemana(state, hojeK);
    // sem a função por semana: monta com o treino previsto para cada data
    const atual = Corrida.planoDaSemana(state, hojeK);
    if (!atual) return null;
    const dias = new Array(7).fill(null);
    for (let i = 0; i < 7; i++) {
      const d = maisDias(segunda, i), k = dateKey(d);
      const t = Corrida.treinoDoDia(state, hojeK, k);
      if (t) dias[d.getDay()] = { ...t, data: k, feito: (Array.isArray(state.runs) ? state.runs.find((r) => r && r.data === k) : null) || null };
    }
    return { dias };
  } catch { return null; }
}

// folha para escolher em que dia da semana fica um treino que ainda não tem dia
function diaSheet(plan, d) {
  const list = h('div', { class: 'list' });
  for (const wd of ORDEM_SEMANA) {
    const atual = plan.dias.find((x) => x.id === plan.agenda[wd]);
    list.appendChild(h('button', { class: 'item', type: 'button', onClick: () => { mut(plan.id, (p) => { p.agenda[wd] = d.id; }); s.close(); refresh(); } },
      h('div', { class: 'grow' }, h('div', { class: 't', text: DIAS_LONGO[wd] }), h('div', { class: 's', text: atual ? `Agora: ${atual.nome}` : 'Livre' }))));
  }
  const s = folha({ title: d.nome, body: [h('p', { class: 'muted small', text: 'Em que dia da semana você faz este treino?' }), list] });
}

export function plansView() {
  guardarCorridaMostrada();
  const plan = activePlan();
  const hojeD = new Date();
  const segundaAtual = segundaDe(hojeD);
  if (semanaVista !== 0 && semanaBase !== dateKey(segundaAtual)) semanaVista = 0; // a semana virou: volta para a atual
  const segunda = maisDias(segundaAtual, semanaVista * 7);
  const corrida = corridaDaSemana(segunda, semanaVista);
  const corridaAtual = semanaVista === 0 ? corrida : corridaDaSemana(segundaAtual, 0);
  const body = [];
  if (state.current) {
    body.push(h('div', { class: 'card hl row' }, icon('timer', 'accent'), h('div', { class: 'grow' }, h('div', { class: 'bold', text: 'Treino em andamento' }), h('div', { class: 'small muted', text: state.current.nome })), btn('Continuar', () => go('sessao'), 'primary sm')));
  }
  const opcoesDeInicio = () => h('div', { class: 'opts' },
    h('button', { class: 'opt', type: 'button', onClick: () => go('treinador') }, icon('coach', 'l accent'), h('div', null, h('div', { class: 'o-t', text: 'Pedir ao Treinador' }), h('div', { class: 'o-s', text: 'Responda algumas perguntas e receba uma sugestão de treino para o seu objetivo' }))),
    h('button', { class: 'opt', type: 'button', onClick: modelsSheet }, icon('copy', 'l accent'), h('div', null, h('div', { class: 'o-t', text: 'Usar um modelo pronto' }), h('div', { class: 'o-s', text: 'Treinos clássicos para copiar e adaptar' }))),
    h('button', { class: 'opt', type: 'button', onClick: novoDoZero }, icon('plus', 'l accent'), h('div', null, h('div', { class: 'o-t', text: 'Montar do zero' }), h('div', { class: 'o-s', text: 'Escolha você mesmo os exercícios de cada dia' }))),
    h('button', { class: 'opt', type: 'button', onClick: startFree }, icon('bolt', 'l accent'), h('div', null, h('div', { class: 'o-t', text: 'Treino livre agora' }), h('div', { class: 'o-s', text: 'Comece a registrar e vá adicionando exercícios' }))));
  const opcaoCorrida = () => h('button', { class: 'opt', type: 'button', onClick: () => go('corrida') }, icon('run', 'l accent'), h('div', null, h('div', { class: 'o-t', text: 'Treinos de corrida' }), h('div', { class: 'o-s', text: 'O Treinador de corrida monta um plano para o seu nível e os seus dias' })));
  if (!plan && !corrida) {
    body.push(h('div', { class: 'empty' }, icon('dumbbell'), h('h2', { text: 'Você ainda não tem um treino' }), h('p', { text: 'Escolha por onde começar:' })));
    body.push(opcoesDeInicio());
    body.push(h('div', { class: 'opts' }, opcaoCorrida()));
    return { title: 'Treinos', body };
  }

  if (plan) {
    body.push(h('div', { class: 'row between' },
      h('div', { class: 'grow' }, h('h2', { class: 'ellipsis', text: plan.nome }), h('div', { class: 'row gap-s mt' }, badge('Musculação'), badge(ORIGEM[plan.origem], plan.origem === 'treinador' ? 'acc' : ''))),
      iconBtn('more', 'Opções do plano', () => planMenu(plan), 'soft')));
    if (plan.info) body.push(h('p', { class: 'small muted', text: plan.info }));
    // hora de variar os exercícios auxiliares (só quando chega o prazo ou um auxiliar trava): views/variacao.js
    if (semanaVista === 0) { const cv = cartaoVariacao(plan, situacaoDoPlano(plan)); if (cv) body.push(cv); }
  } else {
    body.push(h('h2', { text: 'Sua semana' }));
  }

  // quem tem corrida: o que priorizar e o fortalecimento (pergunta enquanto falta responder; depois, resumo com "Mudar")
  { let cc = null; try { cc = cartaoCombinado({ aoMudar: () => refresh() }); } catch { cc = null; } if (cc) body.push(cc); }

  // ---------- qual semana está na tela ----------
  const ir = (n) => { mostrarSemana(n); refresh(); };
  const nomeDaSemana = semanaVista === 0 ? 'Esta semana' : semanaVista === 1 ? 'Semana que vem' : semanaVista === -1 ? 'Semana passada' : semanaVista > 0 ? `Daqui a ${semanaVista} semanas` : `Há ${-semanaVista} semanas`;
  body.push(h('div', { class: 'row between nav-semana' },
    (() => { const b = iconBtn('back', 'Semana anterior', () => ir(semanaVista - 1), 'soft'); if (semanaVista <= -12) b.disabled = true; return b; })(),
    h('div', { class: 'center grow', 'aria-live': 'polite' }, h('div', { class: 'bold', text: nomeDaSemana }), h('div', { class: 'small muted', text: `${diaMes(segunda)} a ${diaMes(maisDias(segunda, 6))}` })),
    (() => { const b = iconBtn('right', 'Próxima semana', () => ir(semanaVista + 1), 'soft'); if (semanaVista >= 52) b.disabled = true; return b; })()));
  if (semanaVista !== 0) {
    body.push(h('div', { class: 'note warn', id: 'aviso-outra-semana' }, icon('warn'), h('div', { class: 'grow' },
      h('div', { text: `Esta não é a semana atual. Você está vendo a semana de ${diaMes(segunda)} a ${diaMes(maisDias(segunda, 6))}.` }),
      h('div', { class: 'small', text: 'A musculação é a mesma agenda de todas as semanas: trocar um treino aqui vale para todas. Para treinar, volte à semana atual.' }),
      btn('Voltar para esta semana', () => ir(0), 'sm mt', 'history'))));
  } else if (corridaAtual && corridaAtual.antesDoInicio && state.run && state.run.inicio) {
    // o plano de corrida começa numa semana que ainda não chegou: avisa e leva até ela
    const ini = new Date(state.run.inicio + 'T12:00:00');
    const n = Math.round((segundaDe(ini).getTime() - segundaAtual.getTime()) / (7 * 86400000));
    if (n >= 1) body.push(h('div', { class: 'card row', id: 'corrida-comeca' }, icon('run', 'accent'), h('div', { class: 'grow' }, h('div', { class: 'bold', text: `Seu plano de corrida começa ${n === 1 ? 'na semana que vem' : 'em ' + n + ' semanas'}` }), h('div', { class: 'small muted', text: `${DIAS_LONGO[ini.getDay()]}, ${diaMes(ini)}.` })), btn('Ver', () => ir(n), 'sm')));
  }

  // ---------- a semana, um cartão por dia, com corrida e musculação em seções separadas ----------
  const hojeWd = semanaVista === 0 ? hojeD.getDay() : -1; // em outra semana nenhum dia é "hoje"
  const dataDe = (wd) => maisDias(segunda, (wd + 6) % 7);
  const sessaoFeitaEm = (d, k) => state.sessions.find((s) => s.diaId === d.id && dateKey(new Date(s.inicio)) === k) || null;
  const feitoEm = (d, wd) => { const k = dateKey(dataDe(wd)); return state.sessions.some((s) => s.diaId === d.id && dateKey(new Date(s.inicio)) === k); };
  const rotulo = (ic, t, extra) => h('div', { class: 'sec-rot' }, icon(ic, 's'), h('span', { text: t }), extra || null);
  // botão que troca o treino de musculação de um dia (o rótulo diz o dia e o treino atual)
  const chipAgenda = (wd, d) => h('button', { class: 'chip sm chip-agenda' + (d ? ' on' : ''), type: 'button', 'aria-label': `${DIAS_LONGO[wd]}: ${d ? d.nome : 'descanso'}`, onClick: () => agendaSheet(plan, wd) }, d ? 'Trocar' : 'Definir treino');
  // "Não treinei" / "Não corri": só na semana atual, em hoje ou num dia que já passou (logic/perdido.js)
  const hojeK = dateKey(hojeD);
  const efetiva = plan ? semanaEfetiva(plan, state.perdidos, dateKey(segunda)) : null;
  const acoesPerdido = (b) => h('div', { class: 'perdido-acoes' }, b);
  // `ef` = o dia na semana com as marcas: treino que veio de outro dia mostra de onde veio (no lugar do "Trocar")
  // treino mudado só nesta semana (logic/ajuste-semana.js): a contagem é a da semana, com o selo e o "Desfazer"
  const blocoTreino = (d0, wd = null, ef = null) => { const dataK = wd != null ? dateKey(dataDe(wd)) : ''; const d = dataK ? { ...d0, itens: itensDoDia(state, plan.id, d0.id, dataK) } : d0; const feita = dataK ? sessaoFeitaEm(d0, dataK) : null; return h('div', { class: 'treino col gap-s', 'data-treino': d.id, ...(ef && ef.veioDe ? { 'data-movido': ef.veioDe } : {}) },
    h('div', { class: 'row top' },
      h('div', { class: 'grow' }, h('h3', { text: d.nome }), h('div', { class: 'small muted', text: d.foco || 'Sem descrição' }),
        ef && ef.veioDe ? h('div', { class: 'small', text: `Veio de ${nomeDoDia(ef.veioDe, hojeK)}.` }) : null,
        h('div', { class: 'tiny muted mt', text: d.itens.length ? `${plural(d.itens.length, 'exercício', 'exercícios')} · cerca de ${duracaoEstimada(d)} min` : 'Nenhum exercício ainda' })),
      ef && ef.veioDe ? badge('Movido', 'acc') : wd != null ? chipAgenda(wd, d) : h('button', { class: 'chip sm', type: 'button', onClick: () => diaSheet(plan, d) }, 'Definir dia')),
    dataK ? seloSemana(plan.id, d.id, dataK, refresh) : null,
    // treino já feito neste dia: só "Ver treino" (abre o registro no histórico)
    feita ? btn('Ver treino', () => go('historico/' + feita.id), 'ghost block', 'right') : h('div', { class: 'row' },
      btn('Editar', () => go(`treino/${plan.id}/${d.id}`), 'ghost grow', 'edit'),
      semanaVista === 0 || wd == null ? btn('Iniciar', () => startSession(plan.id, d.id), 'primary grow', 'play') : null),
    ef && semanaVista === 0 && podeMarcar(state, ef.data, hojeK).pode ? acoesPerdido(botaoNaoTreinei(ef.data, refresh)) : null); };
  const blocoCorrida = (c) => h('div', { class: 'treino col gap-s' },
    h('div', { class: 'row top' },
      h('div', { class: 'grow' }, h('h3', { text: String(c.nome || 'Corrida') }), c.resumo ? h('div', { class: 'small muted', text: String(c.resumo) }) : null),
      c.feito ? badge('Feita', 'ok') : null),
    btn(c.feito ? 'Ver corrida' : 'Abrir corrida', () => go('corrida/dia/' + c.data), c.feito ? 'ghost block' : 'block', 'run'),
    !c.feito && semanaVista === 0 && podeMarcarCorrida(state, c.data, hojeK) ? acoesPerdido(botaoNaoCorri(c.data, refresh)) : null);
  // Feriado: a academia não abre (logic/perdido.js). Nenhum dia vem marcado: a pessoa informa, por um link discreto no
  // fim da semana. Marcar guarda o dia (nenhum treino vem para ele) e, se o dia tem musculação, abre o "Não treinei" com
  // o motivo feriado: o treinador propõe outro dia com as regras de sempre. No dia marcado, uma linha com "Desfazer".
  const treinoAindaNoDia = (data) => { const ef = efetiva ? efetiva.find((x) => x.data === data) : null; return !!(ef && ef.diaId && !ef.perdido) && podeMarcar(state, data, hojeK, { futuro: true }).pode; };
  const marcarFeriado = (data) => {
    update((st) => { st.feriados = [...(st.feriados || []), data]; });
    refresh();
    if (treinoAindaNoDia(data)) folhaNaoTreinei(data, refresh, { motivo: 'feriado', futuro: true });
    else toast('Feriado marcado. Nenhum treino vai para este dia.');
  };
  const linhaFeriado = (data) => h('div', { class: 'col gap-s feriado-linha' },
    h('div', { class: 'row between' }, h('span', { class: 'small' }, icon('calendar', 's'), ' Feriado: a academia não abre.'),
      btn('Desfazer', () => { update((st) => { st.feriados = (st.feriados || []).filter((x) => x !== data); }); refresh(); }, 'plain sm')),
    treinoAindaNoDia(data) ? btn('Mudar o treino deste dia', () => folhaNaoTreinei(data, refresh, { motivo: 'feriado', futuro: true }), 'sm block', 'calendar') : null);
  const folhaFeriado = () => {
    const dias = [];
    for (let k = 0; k < 7; k++) { const dt = maisDias(segunda, k); const dk = dateKey(dt); if (dk >= hojeK && !ehFeriado(state, dk)) dias.push({ dk, wd: dt.getDay() }); }
    const corpo = h('div', { class: 'col gap-s', id: 'folha-feriado' },
      h('p', { class: 'small', text: 'Em qual dia a academia não abre? O treino desse dia vai para outro dia da semana.' }),
      dias.length ? h('div', { class: 'chips wrap', role: 'group', 'aria-label': 'Dia do feriado' }, ...dias.map((x) => h('button', { class: 'chip alvo', type: 'button', 'data-dia': x.dk, onClick: () => { s.close(); marcarFeriado(x.dk); } }, `${DIAS_LONGO[x.wd]} · ${diaMes(maisDias(segunda, (x.wd + 6) % 7))}`)))
        : h('p', { class: 'small muted', text: 'Não há mais dias nesta semana para marcar.' }));
    const s = folha({ title: 'Feriado nesta semana', body: corpo });
  };
  const semana = h('div', { class: 'col semana' });
  for (const wd of ORDEM_SEMANA) {
    const ef = efetiva ? efetiva[(wd + 6) % 7] : null;
    const d = plan && ef ? plan.dias.find((x) => x.id === ef.diaId) : null;
    const c = corrida && Array.isArray(corrida.dias) ? corrida.dias[wd] : null;
    const card = h('div', { class: 'card col dia' + (wd === hojeWd ? ' hl' : ''), 'data-wd': String(wd) },
      h('div', { class: 'row between' }, h('div', { class: 'dia-nome' }, DIAS_LONGO[wd], h('span', { class: 'small muted', text: ' · ' + diaMes(dataDe(wd)) })), h('div', { class: 'row gap-s' }, wd === hojeWd ? badge('Hoje', 'acc') : null, d && feitoEm(d, wd) ? badge('Feito', 'ok') : null)));
    const extras = corrida && Array.isArray(corrida.extras) && Array.isArray(corrida.extras[wd]) ? corrida.extras[wd] : [];
    // corrida que mudou de dia pelo chat: o dia de origem fica sem corrida, só com a linha "Mudou de dia" e o "Desfazer"
    const movida = !c && corrida && Array.isArray(corrida.movidas) && corrida.movidas[wd] ? corrida.movidas[wd] : null;
    const marcaMovida = movida ? corridaPerdidaEm(state, dateKey(dataDe(wd))) : null;
    if (c || extras.length || marcaMovida) card.appendChild(rotulo('run', 'Corrida'));
    const corridaPerdida = c && !c.feito ? corridaPerdidaEm(state, c.data) : null;
    if (marcaMovida) card.appendChild(linhaNaoCorrida(marcaMovida, String(movida.nome || 'Corrida'), refresh, semanaVista === 0));
    else if (corridaPerdida) card.appendChild(linhaNaoCorrida(corridaPerdida, String(c.nome || 'Corrida'), refresh, semanaVista === 0));
    else if (c) { card.appendChild(blocoCorrida(c)); if (c.estimado && !c.feito) card.appendChild(h('div', { class: 'tiny muted', text: 'Previsão de hoje para esse dia (o que foi mostrado na época não ficou guardado).' })); }
    for (const x of extras) {
      const partes = [x.distKm ? String(x.distKm).replace('.', ',') + ' km' : '', x.durMin ? Math.round(x.durMin) + ' min' : ''].filter(Boolean).join(' · ');
      card.appendChild(h('div', { class: 'treino row', 'data-extra': String(x.id || '') }, h('div', { class: 'grow' }, h('div', { class: 'bold', text: x.local === 'esteira' ? 'Esteira feita fora do plano' : 'Corrida feita fora do plano' }), h('div', { class: 'small muted', text: partes || 'Registrada neste dia' })), btn('Ver', () => go('corrida/dia/' + x.data), 'sm ghost')));
    }
    if (plan) {
      const perdido = ef && ef.perdido ? plan.dias.find((x) => x.id === ef.perdido.diaId) : null;
      const saiu = ef && ef.foiPara ? plan.dias.find((x) => x.id === plan.agenda[wd]) : null;
      card.appendChild(rotulo('dumbbell', 'Musculação', d || perdido ? null : chipAgenda(wd, null)));
      if (perdido) card.appendChild(linhaNaoTreinado(ef, perdido.nome, refresh, semanaVista === 0));
      else card.appendChild(d ? blocoTreino(d, wd, ef) : h('div', { class: 'small muted', text: saiu ? `${saiu.nome} passou para ${nomeDoDia(ef.foiPara, hojeK)}.` : c || extras.length ? 'Sem musculação neste dia.' : 'Descanso.' }));
    } else if (!c && !extras.length) card.appendChild(h('div', { class: 'small muted', text: 'Descanso.' }));
    // feriado informado pela pessoa: a linha com "Desfazer" no dia
    const dataDia = dateKey(dataDe(wd));
    if (plan && semanaVista === 0 && dataDia >= hojeK && ehFeriado(state, dataDia)) card.appendChild(linhaFeriado(dataDia));
    // outros esportes do dia e "Adicionar outro treino" (semana atual, de hoje para trás: views/esportes.js)
    if (semanaVista === 0 && dataDia <= hojeK) {
      const la = linhasAtividades(dataDia, refresh);
      if (la) card.append(rotulo('star', 'Outros esportes'), la);
      if (dataDia === hojeK) card.appendChild(h('div', { class: 'row outro-treino' }, botaoOutroTreino(dataDia, refresh)));
    }
    semana.appendChild(card);
  }
  // na semana atual, o dia de hoje vem primeiro (é o que se usa); o resto da semana, embaixo, na ordem de sempre
  const cartaoHoje = hojeWd >= 0 ? semana.querySelector(`.card.dia[data-wd="${hojeWd}"]`) : null;
  if (cartaoHoje && cartaoHoje !== semana.firstChild) {
    semana.insertBefore(cartaoHoje, semana.firstChild);
    semana.insertBefore(h('div', { class: 'tiny muted bold resto-semana', text: 'RESTO DA SEMANA' }), cartaoHoje.nextSibling);
  }
  body.push(semana);
  // um link só, discreto, no fim da semana (é usado pouco)
  if (plan && semanaVista === 0) body.push(h('div', { class: 'row feriado-acao' }, h('span', { class: 'grow' }), btn('Tem feriado nesta semana?', folhaFeriado, 'plain sm', 'calendar')));
  // análise do plano: o que ele trabalha mais e menos, para que serve e se combina com o perfil
  if (plan) { let av = null; try { av = cartaoAvaliacaoDoPlano(plan, { data: dateKey(segunda) }); } catch { av = null; } if (av) body.push(av); }

  if (plan) {
    // treinos do plano que ainda não têm dia da semana
    const comDia = new Set(Object.values(plan.agenda));
    const soltos = plan.dias.filter((d) => !comDia.has(d.id));
    if (!plan.dias.length) body.push(h('p', { class: 'small muted', text: 'Este plano ainda não tem treinos. Adicione o primeiro abaixo.' }));
    if (soltos.length) {
      body.push(sectionTitle('Treinos sem dia definido'));
      for (const d of soltos) body.push(h('div', { class: 'card col' }, blocoTreino(d)));
    }
    body.push(btn('Adicionar um treino ao plano', async () => {
      if (plan.dias.length >= 14) { toast('Limite de 14 treinos por plano.'); return; }
      const nome = await promptSheet({ title: 'Novo treino', label: 'Nome', value: 'Treino ' + ('ABCDEFGHIJKLMN'[plan.dias.length] || ''), okLabel: 'Criar', maxLength: 40 });
      if (!nome) return;
      const d = { id: 'd' + uid(), nome, foco: '', itens: [] };
      mut(plan.id, (p) => p.dias.push(d));
      go(`treino/${plan.id}/${d.id}`);
    }, 'block', 'plus'));
  }

  // corrida
  body.push(sectionTitle('Corrida'));
  body.push(corrida || corridaAtual
    ? h('div', { class: 'card row' }, icon('run', 'accent'), h('div', { class: 'grow' }, h('div', { class: 'bold', text: corridaAtual && corridaAtual.semana >= 1 && corridaAtual.totalSemanas ? `Plano de corrida: semana ${corridaAtual.semana} de ${corridaAtual.totalSemanas}` : 'Plano de corrida' }), corridaAtual && corridaAtual.fase ? h('div', { class: 'small muted', text: String(corridaAtual.fase) }) : null), btn('Abrir', () => go('corrida'), 'sm'))
    : h('div', { class: 'opts' }, opcaoCorrida()));

  // outros planos
  const outros = state.plans.filter((p) => !plan || p.id !== plan.id);
  if (outros.length) {
    body.push(sectionTitle('Outros planos'));
    const l = h('div', { class: 'list' });
    for (const p of outros) {
      l.appendChild(h('button', { class: 'item', type: 'button', onClick: () => { update((s) => { s.activePlan = p.id; }); toast('Plano ativado'); refresh(); } },
        h('div', { class: 'grow' }, h('div', { class: 't', text: p.nome }), h('div', { class: 's', text: `${ORIGEM[p.origem]} · ${plural(p.dias.length, 'treino', 'treinos')}` })), badge('Usar este')));
    }
    body.push(l);
  }
  body.push(sectionTitle(plan ? 'Criar outro plano de musculação' : 'Musculação'));
  body.push(h('div', { class: 'col' },
    btn('Pedir um treino ao Treinador', () => go('treinador'), 'block', 'coach'),
    btn('Modelos prontos', modelsSheet, 'block', 'copy'),
    btn('Montar do zero', novoDoZero, 'block', 'plus'),
    btn('Treino livre agora', startFree, 'block', 'bolt')));
  if (rolarParaHoje) {
    rolarParaHoje = false;
    setTimeout(() => { const c = document.querySelector('.card.dia.hl'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'start' }); }, 80);
  }
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
  const day0 = plan && plan.dias.find((d) => d.id === dayId);
  if (!day0) return { redirect: 'treinos' };
  const mutDay = (fn) => mut(planId, (p) => { const d = p.dias.find((x) => x.id === dayId); if (d) fn(d, p); });
  // os exercícios: a versão desta semana, se o treino foi mudado só nesta semana; senão, o plano. Cada mudança pergunta
  // (uma vez por tela) se vale só nesta semana ou sempre (views/ajuste-semana.js). Nome e descrição valem sempre.
  const hojeK = dateKey(new Date());
  const day = { ...day0, itens: itensDoDia(state, planId, dayId, hojeK) };
  const mudar = async (fn, depois) => {
    const modo = await alcance(planId, dayId, hojeK);
    if (!modo) { refresh(); return; }
    mudarItens(planId, dayId, hojeK, modo, (itens, p) => fn(itens, p, modo));
    if (depois) depois(modo);
    refresh();
  };
  const body = [];
  { const sl = seloSemana(planId, dayId, hojeK, refresh); if (sl) body.push(h('div', { class: 'col gap-s', id: 'editor-semana' }, sl, h('p', { class: 'tiny muted', text: 'As mudanças deste treino valem só nesta semana. Na semana que vem, volta o de sempre.' }))); }
  const foco = h('input', { class: 'input', type: 'text', value: day.foco, maxlength: 90, placeholder: 'Ex.: peito, ombros e tríceps', onInput: (e) => mutDay((d) => { d.foco = e.target.value.trim().slice(0, 90); }) }); // grava a cada letra: sair da tela sem tirar o foco do campo não perde o texto
  body.push(h('label', { class: 'field' }, h('span', { text: 'O que este treino trabalha (opcional)' }), foco));
  if (!day.itens.length) body.push(h('div', { class: 'empty' }, icon('dumbbell'), h('p', { text: 'Este treino ainda está vazio. Adicione os exercícios que você quer fazer neste dia.' })));
  else body.push(h('p', { class: 'small muted', text: `${plural(day.itens.length, 'exercício', 'exercícios')} · cerca de ${duracaoEstimada(day)} minutos` }));
  // análise deste treino (foco, músculo mais e menos trabalhado, para que serve, se serve para o perfil)
  if (day.itens.length) { let av = null; try { av = cartaoAvaliacaoDoDia(plan, day, { data: hojeK }); } catch { av = null; } if (av) body.push(av); }

  day.itens.forEach((it, i) => {
    const ex = EX_POR_ID.get(it.ex);
    if (!ex) return;
    const tempo = ex.registro === 'segundos';
    const cardio = ex.registro === 'minutos';
    const set = (k, v) => mudar((itens) => { if (itens[i]) itens[i][k] = v; });
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
        iconBtn('up', 'Mover para cima', () => { if (i === 0) { toast('Este já é o primeiro exercício.'); return; } mudar((itens) => { const [x] = itens.splice(i, 1); itens.splice(i - 1, 0, x); }); }, 'soft'),
        iconBtn('down', 'Mover para baixo', () => { if (i >= day.itens.length - 1) { toast('Este já é o último exercício.'); return; } mudar((itens) => { const [x] = itens.splice(i, 1); itens.splice(i + 1, 0, x); }); }, 'soft'),
        h('div', { class: 'grow' }),
        btn('Trocar', async () => {
          const usados = new Set(day.itens.map((x) => x.ex));
          const [novo] = await pickExercises({ title: 'Trocar ' + ex.nome, multi: false, padrao: ex.padrao, excluir: usados });
          if (!novo) return;
          const nx = EX_POR_ID.get(novo);
          // a troca à mão entra no histórico da variação: o novo não sai logo e o antigo não volta logo (logic/variacao.js);
          // a troca só desta semana, não
          mudar((itens, p, modo) => { if (itens[i]) { itens[i] = nx.registro === ex.registro ? { ...itens[i], ex: novo } : novoItem(nx); if (modo === 'sempre') registrarTrocaManual(p, ex.id, novo, new Date().toISOString()); } }, () => toast('Exercício trocado'));
        }, 'sm', 'swap'),
        // só o ícone (com nome para leitor de tela): com texto, ↑ ↓ Trocar Remover não cabem em 360 px
        iconBtn('trash', `Remover ${ex.nome}`, async () => {
          const ok = await confirmSheet({ title: 'Remover este exercício?', text: `“${ex.nome}” sai deste treino. O histórico de treinos já feitos não muda.`, okLabel: 'Remover', danger: true });
          if (!ok) return;
          // remove o exercício confirmado, mesmo que a lista tenha mudado enquanto a pergunta estava aberta
          mudar((itens) => { const k = itens[i] && itens[i].ex === it.ex ? i : itens.findIndex((x) => x.ex === it.ex); if (k >= 0) itens.splice(k, 1); });
        }, 'soft danger'))));
  });
  body.push(btn('Adicionar exercícios', async () => {
    if (day.itens.length >= MAX_ITENS) { toast(`Este treino já tem ${MAX_ITENS} exercícios, que é o limite.`); return; }
    const ids = await pickExercises({ excluir: new Set(day.itens.map((x) => x.ex)) });
    if (!ids.length) return;
    let entraram = 0;
    mudar((itens) => { for (const id of ids) { const ex = EX_POR_ID.get(id); if (ex && itens.length < MAX_ITENS) { itens.push(novoItem(ex)); entraram++; } } },
      () => { if (entraram < ids.length) toast(`Limite de ${MAX_ITENS} exercícios por treino: ${entraram ? `entraram só os ${entraram} primeiros` : 'nenhum foi adicionado'}.`); });
  }, 'block', 'plus'));
  if (plan.dias.length > 1) {
    body.push(btn('Excluir este treino', async () => {
      const ok = await confirmSheet({ title: 'Excluir este treino?', text: `“${day.nome}” será removido do plano.`, okLabel: 'Excluir', danger: true });
      if (!ok) return;
      mut(planId, (p) => { p.dias = p.dias.filter((d) => d.id !== dayId); for (const k of Object.keys(p.agenda)) if (p.agenda[k] === dayId) delete p.agenda[k]; });
      replace('treinos'); // a tela do treino apagado não fica no histórico do botão Voltar
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

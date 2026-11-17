// Treino em andamento: registro das séries, cronômetro de descanso e finalização.
import { h, btn, icon, iconBtn, confirmSheet, toast, note, parseNum, fmtClock, uid, plural, dateKey } from '../ui.js';
import { state, update, planById } from '../store.js';
import { go, refresh, replace } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { figure, thumb } from '../figure.js';
import { recorde, e1rm, assistido, voltaDePausa, seriesNaVolta, descansoNaVolta } from '../logic/progress.js';
import { nivelPausa, cortePausa, duracaoTxt } from '../logic/pausa.js';
import { alertaDoExercicio, doresDoTreino, respostasParaAvisos } from '../logic/trainer.js';
import { pickExercises, novoItem, subtitulo, folha } from './common.js';
import { recomendacao } from '../logic/carga.js';
import { REFS } from '../data/knowledge.js';
import { keepAwake, unlockAudio, beep, tocarAlerta, vibrate, agendarAviso, cancelarAviso, fimDoDescanso } from '../device.js';

// ---------- carga recomendada ----------
// Perfil para a carga inicial (logic/carga.js): as respostas do Treinador (com a proteção das outras entrevistas), o sexo
// informado na Nutrição e a dor que o exercício pega. Com histórico, vale a sugestão de progress.js.
function contextoCarga(exId) {
  let respostas = null, dor = null;
  try { respostas = respostasParaAvisos(state); } catch { respostas = null; }
  try { dor = alertaDoExercicio(exId, doresDoTreino(state, dateKey(new Date()), respostas), respostas); } catch { dor = null; }
  const n = state.nutri && state.nutri.answers;
  return { respostas, dor, sexo: n && typeof n.sexo === 'string' ? n.sexo : '' };
}
const recomendar = (exId, alvo, series) => recomendacao(exId, alvo, series, contextoCarga(exId));

// ---------- iniciar ----------
function montarItem(planItem) {
  const ex = EX_POR_ID.get(planItem.ex);
  const sug = recomendar(planItem.ex, planItem.reps, planItem.series);
  const sets = [];
  for (let i = 0; i < planItem.series; i++) {
    sets.push({ kg: ex.registro === 'peso_reps' ? (sug.kg ?? null) : null, reps: ex.registro === 'peso_reps' || ex.registro === 'reps' ? (sug.reps ?? null) : null, seg: ex.registro === 'segundos' || ex.registro === 'minutos' ? (sug.seg ?? Number(String(planItem.reps).split('-')[0])) : null, ok: false });
  }
  // carga e tempo sugeridos pelo app contam como "copiados": se a pessoa corrige a 1ª série e marca, as seguintes
  // (que ela não editou) acompanham. As repetições sugeridas ficam: são o alvo de cada série.
  for (const st of sets) { const c = {}; if (st.kg != null) c.kg = st.kg; if (st.seg != null) c.seg = st.seg; if (Object.keys(c).length) copiados.set(st, c); }
  return { ex: planItem.ex, alvo: planItem.reps, descanso: planItem.descanso, sets };
}
async function podeIniciar() {
  if (!state.current) return true;
  const feitas = state.current.itens.reduce((n, it) => n + it.sets.filter((s) => s.ok).length, 0);
  if (!feitas) return true;
  const ok = await confirmSheet({ title: 'Já existe um treino em andamento', text: `“${state.current.nome}” ainda não foi finalizado. Quer descartá-lo e começar outro?`, okLabel: 'Descartar e começar', cancelLabel: 'Continuar o atual', danger: true });
  return ok;
}
export async function startSession(planId, dayId) {
  const plan = planById(planId);
  const day = plan && plan.dias.find((d) => d.id === dayId);
  if (!day) return;
  if (!day.itens.length) { toast('Este treino ainda não tem exercícios.'); return; }
  if (!(await podeIniciar())) { if (state.current) go('sessao'); return; }
  unlockAudio();
  // Volta depois de 2 semanas ou mais parado (consenso CSCCa/NSCA de 2019, regra FIT): nas 2 primeiras semanas o treino
  // começa com menos séries por grupo muscular e mais descanso; a carga e o cardio reduzidos vêm de retomada().
  const volta = voltaDePausa();
  let base = day.itens.filter((i) => EX_POR_ID.has(i.ex));
  if (volta && volta.semana <= 2) {
    const series = seriesNaVolta(base);
    base = base.map((it, i) => ({ ...it, series: series[i], descanso: descansoNaVolta(it.ex, it.descanso, volta) }));
  }
  update((s) => {
    s.current = { id: 's' + uid(), planId, diaId: dayId, nome: day.nome, inicio: new Date().toISOString(), fim: '', nota: '', itens: base.map(montarItem), restEnd: 0, restTotal: 0, volta: volta ? volta.dias : 0, cron: null };
  });
  go('sessao');
}
export async function startFree() {
  if (!(await podeIniciar())) { if (state.current) go('sessao'); return; }
  unlockAudio();
  update((s) => { s.current = { id: 's' + uid(), planId: '', diaId: '', nome: 'Treino livre', inicio: new Date().toISOString(), fim: '', nota: '', itens: [], restEnd: 0, restTotal: 0, volta: 0, cron: null }; });
  go('sessao');
}

// ---------- tela ----------
// Cronômetro de exercício por tempo em andamento. Fica fora da tela para não se perder quando ela é redesenhada;
// guarda o próprio exercício (e não a posição), porque a ordem pode mudar.
let cronometro = null; // { sid, it, j, end, total }
// Valores que o app copiou de uma série para as seguintes (série -> { campo: valor }): se a pessoa corrige a série
// de origem e marca de novo, as cópias são corrigidas junto. Também fica fora da tela para valer entre redesenhos.
const copiados = new WeakMap();
const passoKg = (kg) => ((kg ?? 0) < 20 ? 1 : 2.5);

// segurar o botão − ou + repete a ação (para cargas altas não exigir dezenas de toques)
const repeticoes = new Set(); // repetições em andamento (para a tela poder parar todas ao fechar)
function repetir(botao, acao) {
  let espera = 0;
  let ciclo = 0;
  let segurou = false;
  const parar = () => { clearTimeout(espera); clearInterval(ciclo); espera = 0; ciclo = 0; repeticoes.delete(parar); };
  // se o botão sair da tela durante o toque (cartão redesenhado, troca de tela), o "soltar" não chega: para sozinho
  const passo = () => { if (!botao.isConnected) { parar(); return; } acao(); };
  botao.addEventListener('pointerdown', () => {
    segurou = false; parar();
    repeticoes.add(parar);
    espera = setTimeout(() => { if (!botao.isConnected) { parar(); return; } segurou = true; ciclo = setInterval(passo, 90); }, 450);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) botao.addEventListener(ev, parar);
  botao.addEventListener('click', (e) => { if (segurou) { segurou = false; e.preventDefault(); return; } acao(); });
  botao.addEventListener('contextmenu', (e) => e.preventDefault());
}

function numin({ value, step, min = 0, max = 2000, onChange, label, dec = false, placeholder = '' }) {
  const arred = (n) => (dec ? Math.round(n * 100) / 100 : Math.round(n));
  const fmt = (n) => (n == null ? '' : String(arred(n)).replace('.', ','));
  let cur = value;
  const input = h('input', { type: 'text', inputmode: dec ? 'decimal' : 'numeric', value: fmt(cur), 'aria-label': label, placeholder, autocomplete: 'off', enterkeyhint: 'done' });
  const set = (n) => { cur = n == null ? null : arred(Math.min(max, Math.max(min, n))); input.value = fmt(cur); onChange(cur); };
  input.addEventListener('focus', () => input.select());
  input.addEventListener('change', () => { const n = parseNum(input.value); set(input.value.trim() === '' ? null : (Number.isFinite(n) ? n : cur)); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  // os botões andam sempre pela grade do passo (20 → 19 → 20 → 22,5 → 20), mesmo quando o passo muda no caminho
  const passoDe = (v) => Math.max(0.01, typeof step === 'function' ? step(v) : step);
  const sobe = () => { const v = cur ?? 0; const p = passoDe(v); return (Math.floor(v / p + 1e-9) + 1) * p; };
  const desce = () => { const v = cur ?? 0; const p = passoDe(Math.max(0, v - 1e-6)); return Math.max(min, (Math.ceil(v / p - 1e-9) - 1) * p); };
  const menos = h('button', { type: 'button', 'aria-label': 'Diminuir ' + label }, '−');
  const mais = h('button', { type: 'button', 'aria-label': 'Aumentar ' + label }, '+');
  repetir(menos, () => { unlockAudio(); set(desce()); });
  repetir(mais, () => { unlockAudio(); set(sobe()); });
  return h('div', { class: 'numin' }, menos, input, mais);
}

// De onde vem a carga sugerida: uma linha curta e, num "Por quê?" fechado, o ajuste, os cuidados e as fontes. Fica
// aberto entre redesenhos do cartão se a pessoa abriu.
const porQueAberto = new WeakSet();
function origemDaCarga(it, sug) {
  if (!sug || !sug.linha) return null;
  const refs = (sug.refs || []).filter((k) => REFS[k]);
  const corpo = h('div', { class: 'corpo' });
  for (const t of sug.porque || []) corpo.appendChild(h('p', { class: 'small muted', text: t }));
  if (refs.length) corpo.appendChild(h('div', { class: 'col gap-s' }, h('div', { class: 'tiny bold', text: 'Fontes' }), ...refs.map((k) => h('p', { class: 'ref', text: '• ' + REFS[k] }))));
  const d = h('details', { class: 'carga', open: porQueAberto.has(it), onToggle: () => { if (d.open) porQueAberto.add(it); else porQueAberto.delete(it); } },
    h('summary', null, h('span', { class: 'linha', text: sug.linha }), h('span', { class: 'pq-link', text: 'Por quê?' })),
    corpo);
  return d;
}

function infoSheet(ex) {
  const passos = h('ol');
  for (const p of ex.execucao) passos.appendChild(h('li', { text: p }));
  const dicas = h('ul');
  for (const d of ex.dicas) dicas.appendChild(h('li', { text: d }));
  const s = folha({
    title: ex.nome, full: true,
    body: [figure(ex), h('p', null, h('b', { text: 'Posição inicial: ' }), ex.posicao), passos, h('div', { class: 'note info' }, icon('info'), h('div', null, h('b', { text: 'Respiração: ' }), ex.respiracao)), h('h3', { text: 'Pontos de atenção' }), dicas],
    footer: [btn('Ver tudo sobre o exercício', () => { s.close(); go('exercicio/' + ex.id); }, 'ghost'), btn('Fechar', () => s.close(), 'primary')],
  });
}

export function sessionView() {
  const cur = state.current;
  if (!cur) return { redirect: 'treinos' };
  keepAwake(true);
  const recAntes = new Map();
  for (const it of cur.itens) {
    // a marca a bater é a maior entre o histórico e o que já foi feito neste treino (a tela pode ser redesenhada no meio)
    const r = recorde(it.ex);
    const aqui = Math.max(0, ...it.sets.filter((s) => s.ok && s.kg != null && s.reps).map((s) => e1rm(s.kg, s.reps)));
    recAntes.set(it.ex, r && aqui > r.v ? { v: aqui } : r);
  }
  let work = null; // cronômetro de exercício por tempo: { i, j, end, total }
  const setWork = (w) => {
    work = w;
    cronometro = w && state.current ? { sid: state.current.id, it: state.current.itens[w.i], j: w.j, end: w.end, total: w.total } : null;
    // também fica gravado no treino em andamento, para não se perder se a página for recarregada
    update((s) => { if (s.current) s.current.cron = w && s.current.itens[w.i] ? { i: w.i, j: w.j, end: w.end, total: w.total, ex: s.current.itens[w.i].ex } : null; });
  };
  // depois de recarregar a página só resta o que foi gravado: vale se o item daquela posição ainda é o mesmo exercício
  if (!cronometro && cur.cron && cur.itens[cur.cron.i] && cur.itens[cur.cron.i].ex === cur.cron.ex) cronometro = { sid: cur.id, it: cur.itens[cur.cron.i], j: cur.cron.j, end: cur.cron.end, total: cur.cron.total };
  if (cronometro) {
    const i = cronometro.sid === cur.id ? cur.itens.indexOf(cronometro.it) : -1;
    const st = i >= 0 ? cur.itens[i].sets[cronometro.j] : null;
    if (st && !st.ok) work = { i, j: cronometro.j, end: cronometro.end, total: cronometro.total };
    else cronometro = null;
  }
  // o gravado acompanha o que está valendo: se o exercício cronometrado saiu, foi trocado ou mudou de posição, o registro
  // antigo não pode "ressuscitar" depois apontando para outro exercício
  {
    const g = cur.cron;
    const igual = work ? !!g && g.i === work.i && g.j === work.j && g.end === work.end && g.ex === cur.itens[work.i].ex : !g;
    if (!igual) update((s) => { if (s.current) s.current.cron = work ? { i: work.i, j: work.j, end: work.end, total: work.total, ex: s.current.itens[work.i].ex } : null; });
  }
  let alarmed = false;
  let doneUntil = 0;

  const elapsed = h('span', { class: 'timer-big', 'aria-label': 'Tempo de treino' });
  const cards = h('div', { class: 'col gap-l' });
  const bar = h('div', { class: 'restbar' });
  const mutCur = (fn) => update((s) => { if (s.current) fn(s.current); });

  function startRest(seconds) {
    if (!seconds) return;
    alarmed = false;
    mutCur((c) => { c.restEnd = Date.now() + seconds * 1000; c.restTotal = seconds; });
    agendarAviso(state.current.restEnd);
    drawBar();
  }
  function stopRest() { mutCur((c) => { c.restEnd = 0; c.restTotal = 0; }); cancelarAviso(); doneUntil = 0; drawBar(); }

  function check(i, j) {
    unlockAudio();
    const it = state.current.itens[i];
    const st = it && it.sets[j];
    if (!st) return;
    const ex = EX_POR_ID.get(it.ex);
    if (st.ok) { mutCur((c) => { c.itens[i].sets[j].ok = false; }); drawCard(i); drawBar(); return; }
    if (ex.registro === 'peso_reps' && st.kg == null) { toast('Informe a carga (kg) desta série. Use 0 se for sem peso.'); return; }
    if ((ex.registro === 'peso_reps' || ex.registro === 'reps') && !st.reps) { toast('Informe quantas repetições você fez.'); return; }
    if ((ex.registro === 'segundos' || ex.registro === 'minutos') && !st.seg) { toast('Informe o tempo.'); return; }
    if (work && work.i === i && work.j === j) setWork(null); // marcada à mão com o cronômetro rodando
    mutCur((c) => {
      const sets = c.itens[i].sets;
      sets[j].ok = true;
      // copia os valores para as próximas séries ainda vazias (ou que só têm o que o app copiou antes:
      // assim, corrigir um número digitado errado e marcar de novo corrige também as séries seguintes)
      for (let k = j + 1; k < sets.length; k++) {
        const nx = sets[k];
        if (nx.ok) continue;
        for (const campo of ['kg', 'reps', 'seg']) {
          const cp = copiados.get(nx) || {};
          if (nx[campo] == null || (campo in cp && cp[campo] === nx[campo])) { nx[campo] = sets[j][campo]; copiados.set(nx, { ...cp, [campo]: nx[campo] }); }
        }
      }
    });
    // recorde pessoal?
    const antes = recAntes.get(it.ex);
    if (ex.registro === 'peso_reps' && antes && !assistido(it.ex) && e1rm(st.kg, st.reps) > antes.v * 1.001) { toast('Novo recorde pessoal neste exercício!'); recAntes.set(it.ex, { v: e1rm(st.kg, st.reps) }); }
    drawCard(i);
    const ultimaSerie = i === state.current.itens.length - 1 && j === it.sets.length - 1;
    if (!ultimaSerie && ex.registro !== 'minutos' && it.descanso) startRest(it.descanso);
    else drawBar(); // o botão da barra muda entre "Encerrar" e "Finalizar treino"
  }

  function startWork(i, j) {
    unlockAudio();
    const st = state.current.itens[i].sets[j];
    const total = st.seg || 30;
    setWork({ i, j, end: Date.now() + total * 1000, total });
    if (state.current.restEnd) stopRest();
    drawBar();
  }

  function drawCard(i) {
    const it = state.current.itens[i];
    const ex = EX_POR_ID.get(it.ex);
    const old = cards.children[i];
    const tipo = ex.registro;
    const sug = recomendar(it.ex, it.alvo, it.sets.length);
    const grid = h('div', { class: 'setgrid' + (tipo === 'peso_reps' ? '' : ' one') });
    grid.appendChild(h('span'));
    if (tipo === 'peso_reps') { grid.appendChild(h('span', { class: 'hd', text: assistido(it.ex) ? 'Ajuda (kg)' : 'Carga (kg)' })); grid.appendChild(h('span', { class: 'hd', text: 'Repetições' })); }
    else grid.appendChild(h('span', { class: 'hd', text: tipo === 'reps' ? 'Repetições' : tipo === 'minutos' ? 'Minutos' : 'Segundos' }));
    grid.appendChild(h('span', { class: 'hd', text: 'Feito' }));
    it.sets.forEach((st, j) => {
      const cls = st.ok ? ' setrow-done' : '';
      const n = h('span', { class: 'setn', text: String(j + 1) });
      const wrapN = h('div', { class: cls.trim() }, n);
      grid.appendChild(wrapN);
      const setV = (k) => (v) => { mutCur((c) => { c.itens[i].sets[j][k] = v; }); };
      if (tipo === 'peso_reps') {
        grid.appendChild(h('div', { class: cls.trim() }, numin({ value: st.kg, step: passoKg, dec: true, label: `carga da série ${j + 1}`, placeholder: 'kg', onChange: setV('kg') })));
        grid.appendChild(h('div', { class: cls.trim() }, numin({ value: st.reps, step: 1, max: 999, label: `repetições da série ${j + 1}`, placeholder: 'reps', onChange: setV('reps') })));
      } else if (tipo === 'reps') {
        grid.appendChild(h('div', { class: cls.trim() }, numin({ value: st.reps, step: 1, max: 999, label: `repetições da série ${j + 1}`, placeholder: 'reps', onChange: setV('reps') })));
      } else {
        const cell = h('div', { class: 'row gap-s ' + cls.trim() }, h('div', { class: 'grow' }, numin({ value: st.seg, step: tipo === 'minutos' ? 1 : 5, max: tipo === 'minutos' ? 600 : 3600, label: `tempo da série ${j + 1}`, onChange: setV('seg') })));
        if (tipo === 'segundos' && !st.ok) cell.appendChild(iconBtn('timer', 'Cronometrar esta série', () => startWork(i, j), 'soft'));
        grid.appendChild(cell);
      }
      grid.appendChild(h('button', { class: 'check' + (st.ok ? ' on' : ''), type: 'button', 'aria-label': st.ok ? `Desmarcar série ${j + 1}` : `Marcar série ${j + 1} como feita`, 'aria-pressed': st.ok ? 'true' : 'false', onClick: () => check(i, j) }, icon('check')));
    });
    const maisSerie = btn('Série', () => {
      if (state.current.itens[i].sets.length >= 30) { toast('Limite de 30 séries por exercício.'); return; }
      mutCur((c) => { const s = c.itens[i].sets; const l = s[s.length - 1] || {}; s.push({ kg: l.kg ?? null, reps: l.reps ?? null, seg: l.seg ?? null, ok: false }); });
      drawCard(i);
    }, 'sm ghost', 'plus');
    maisSerie.setAttribute('aria-label', 'Adicionar série');
    const menosSerie = it.sets.length > 1 ? btn('Série', async () => {
      const ult = it.sets[it.sets.length - 1];
      if (ult && ult.ok && !(await confirmSheet({ title: 'Remover a série já feita?', text: 'A última série deste exercício está marcada como feita. O registro dela será apagado.', okLabel: 'Remover', danger: true }))) return;
      if (!state.current || state.current.itens[i] !== it || it.sets.length < 2) return;
      if (work && work.i === i && work.j === it.sets.length - 1) setWork(null); // a série cronometrada saiu
      mutCur((c) => { c.itens[i].sets.pop(); });
      drawCard(i); drawBar();
    }, 'sm ghost', 'minus') : null;
    if (menosSerie) menosSerie.setAttribute('aria-label', 'Remover a última série');
    const feitas = it.sets.filter((s) => s.ok).length;
    const alvoTxt = tipo === 'minutos' ? `${it.alvo} min` : tipo === 'segundos' ? `${it.sets.length} × ${it.alvo} s` : `${it.sets.length} × ${it.alvo} repetições`;
    // dor que o usuário contou ao Treinador e que este exercício sobrecarrega: aviso no próprio cartão
    let avisoDor = null;
    // dores ativas, dores de alerta que passaram do prazo sem "Melhorou" e dores em volta gradual; o perfil vem do
    // Treinador ou, para quem só corre, das respostas da corrida
    try { const perfilDeAviso = respostasParaAvisos(state); avisoDor = alertaDoExercicio(it.ex, doresDoTreino(state, dateKey(new Date()), perfilDeAviso), perfilDeAviso); } catch { avisoDor = null; }
    const card = h('div', { class: 'card col' },
      h('div', { class: 'exhead' },
        h('button', { class: 'thumb', type: 'button', 'aria-label': 'Ver como fazer: ' + ex.nome, onClick: () => infoSheet(ex) }, thumb(ex)),
        h('div', { class: 'grow' },
          h('div', { class: 'bold', text: ex.nome }),
          h('div', { class: 'small muted', text: `Alvo: ${alvoTxt}${it.descanso && tipo !== 'minutos' ? ` · descanso ${it.descanso} s` : ''}` }),
          h('div', { class: 'tiny ' + (feitas === it.sets.length ? 'ok bold' : 'muted'), text: feitas === it.sets.length ? 'Concluído' : `${feitas} de ${it.sets.length} séries` })),
        iconBtn('more', 'Opções: ' + ex.nome, () => itemMenu(i), '')),
      avisoDor ? note(avisoDor.nivel === 'evitar' ? 'warn' : 'info', avisoDor.texto) : null,
      origemDaCarga(it, sug),
      grid,
      h('div', { class: 'row acoes-ex' }, maisSerie, menosSerie,
        h('div', { class: 'grow' }),
        btn('Como fazer', () => infoSheet(ex), 'sm plain', 'info')));
    if (old) cards.replaceChild(card, old); else cards.appendChild(card);
  }

  function itemMenu(i) {
    const it = state.current.itens[i];
    const ex = EX_POR_ID.get(it.ex);
    const body = h('div');
    const add = (ic, label, fn, danger) => body.appendChild(h('button', { class: 'menu-item' + (danger ? ' danger' : ''), type: 'button', onClick: () => { s.close(); fn(); } }, icon(ic), label));
    // séries já feitas não somem sem aviso
    const podePerder = async (title, okLabel) => {
      const n = it.sets.filter((x) => x.ok).length;
      if (!n) return true;
      return confirmSheet({ title, text: `${plural(n, 'série já feita', 'séries já feitas')} de “${ex.nome}” ${n === 1 ? 'será apagada' : 'serão apagadas'}.`, okLabel, danger: true });
    };
    add('swap', 'Trocar por outro exercício', async () => {
      if (!(await podePerder('Trocar este exercício?', 'Trocar'))) return;
      const usados = new Set(state.current.itens.map((x) => x.ex));
      const [novo] = await pickExercises({ title: 'Trocar ' + ex.nome, multi: false, padrao: ex.padrao, excluir: usados });
      if (!novo || !state.current || state.current.itens[i] !== it) return;
      const nx = EX_POR_ID.get(novo);
      const base = nx.registro === ex.registro ? { ex: novo, series: it.sets.length, reps: it.alvo, descanso: it.descanso } : { ...novoItem(nx) };
      mutCur((c) => { c.itens[i] = montarItem(base); });
      recAntes.set(novo, recorde(novo));
      refresh();
    });
    if (i > 0) add('up', 'Fazer antes', () => { mutCur((c) => { const [x] = c.itens.splice(i, 1); c.itens.splice(i - 1, 0, x); }); refresh(); });
    if (i < state.current.itens.length - 1) add('down', 'Fazer depois', () => { mutCur((c) => { const [x] = c.itens.splice(i, 1); c.itens.splice(i + 1, 0, x); }); refresh(); });
    add('trash', 'Tirar deste treino', async () => {
      if (!(await podePerder('Tirar este exercício?', 'Tirar'))) return;
      if (!state.current || state.current.itens[i] !== it) return;
      mutCur((c) => { c.itens.splice(i, 1); });
      refresh();
    }, true);
    const s = folha({ title: ex.nome, body });
  }

  function drawBar() {
    while (bar.firstChild) bar.removeChild(bar.firstChild);
    bar.className = 'restbar';
    const c = state.current;
    if (!c) return;
    const inner = h('div', { class: 'restbar-in' });
    const now = Date.now();
    if (work) {
      const rem = Math.max(0, (work.end - now) / 1000);
      inner.appendChild(h('div', { class: 'grow' }, h('div', { class: 'tiny muted', text: 'EXERCÍCIO' }), h('div', { class: 'time', id: 'rest-time', text: fmtClock(Math.ceil(rem)) })));
      inner.appendChild(btn('Parar', () => { setWork(null); drawBar(); }, ''));
    } else if (c.restEnd && c.restEnd > now) {
      const rem = (c.restEnd - now) / 1000;
      inner.appendChild(btn('−15', () => { mutCur((x) => { x.restEnd = Math.max(Date.now(), x.restEnd - 15000); }); agendarAviso(state.current.restEnd); tick(); }, 'sm'));
      inner.appendChild(h('div', { class: 'grow center' }, h('div', { class: 'tiny muted', text: 'DESCANSO' }), h('div', { class: 'time', id: 'rest-time', 'aria-live': 'off', text: fmtClock(Math.ceil(rem)) })));
      inner.appendChild(btn('+15', () => { mutCur((x) => { x.restEnd += 15000; x.restTotal += 15; }); agendarAviso(state.current.restEnd); tick(); }, 'sm'));
      inner.appendChild(btn('Pular', stopRest, 'sm primary'));
    } else if (doneUntil > now) {
      bar.className = 'restbar done flash';
      inner.appendChild(h('div', { class: 'grow' }, h('div', { class: 'bold', text: 'Descanso concluído' }), h('div', { class: 'small', text: 'Vamos para a próxima série!' })));
      inner.appendChild(btn('OK', () => { doneUntil = 0; drawBar(); }, 'sm'));
    } else {
      const feitas = c.itens.reduce((n, it) => n + it.sets.filter((s) => s.ok).length, 0);
      inner.appendChild(btn('Exercício', addExercises, '', 'plus'));
      inner.appendChild(h('div', { class: 'grow' }));
      inner.appendChild(btn(feitas ? 'Finalizar treino' : 'Encerrar', finish, 'primary', 'check'));
    }
    bar.appendChild(inner);
  }

  async function addExercises() {
    if (state.current.itens.length >= 60) { toast('Este treino já tem 60 exercícios, que é o limite.'); return; }
    const ids = await pickExercises({ excluir: new Set(state.current.itens.map((x) => x.ex)) });
    if (!ids.length || !state.current) return;
    let entraram = 0;
    mutCur((c) => {
      for (const id of ids) {
        const ex = EX_POR_ID.get(id);
        if (!ex || c.itens.length >= 60) continue;
        const base = novoItem(ex);
        if (ex.registro === 'peso_reps' || ex.registro === 'reps') base.descanso = state.settings.descanso;
        c.itens.push(montarItem(base));
        entraram++;
      }
    });
    if (entraram < ids.length) toast(`Limite de 60 exercícios por treino: ${entraram ? `entraram só os ${entraram} primeiros` : 'nenhum foi adicionado'}.`);
    else toast(entraram === 1 ? 'Exercício adicionado no fim do treino.' : `${entraram} exercícios adicionados no fim do treino.`); // o cartão novo fica lá embaixo, fora da vista
    refresh();
  }

  async function finish() {
    const c = state.current;
    const feitas = c.itens.reduce((n, it) => n + it.sets.filter((s) => s.ok).length, 0);
    const total = c.itens.reduce((n, it) => n + it.sets.length, 0);
    if (!feitas) {
      const ok = await confirmSheet({ title: 'Encerrar sem registrar?', text: 'Nenhuma série foi marcada como feita. O treino não será salvo no histórico.', okLabel: 'Encerrar', danger: true });
      if (!ok) return;
      update((s) => { s.current = null; });
      replace('treinos');
      return;
    }
    if (feitas < total) {
      const ok = await confirmSheet({ title: 'Finalizar o treino?', text: `Você marcou ${feitas} de ${total} séries. As séries não marcadas não entram no histórico.`, okLabel: 'Finalizar' });
      if (!ok) return;
    }
    const id = c.id;
    update((s) => {
      const cc = s.current;
      const itens = cc.itens.map((it) => ({ ex: it.ex, alvo: it.alvo, descanso: it.descanso, planejadas: it.sets.length, sets: it.sets.filter((x) => x.ok) })).filter((it) => it.sets.length);
      s.sessions.push({ id: cc.id, planId: cc.planId, diaId: cc.diaId, nome: cc.nome, inicio: cc.inicio, fim: new Date().toISOString(), nota: cc.nota || '', itens });
      if (s.sessions.length > 5000) s.sessions.splice(0, s.sessions.length - 5000);
      s.current = null;
      cancelarAviso();
      s.ui.onboarded = true;
    });
    replace('historico/' + id);
  }

  function tick() {
    const c = state.current;
    if (!c) return;
    const now = Date.now();
    elapsed.textContent = fmtClock((now - Date.parse(c.inicio)) / 1000);
    const t = document.getElementById('rest-time');
    if (work) {
      const rem = (work.end - now) / 1000;
      if (rem <= 0) {
        const w = work; setWork(null);
        tocarAlerta(); vibrate();
        const st = c.itens[w.i] && c.itens[w.i].sets[w.j];
        if (st && !st.ok) {
          mutCur((x) => { x.itens[w.i].sets[w.j].seg = w.total; });
          drawCard(w.i);
          check(w.i, w.j);
        }
        drawBar();
      } else if (t) t.textContent = fmtClock(Math.ceil(rem));
      return;
    }
    if (c.restEnd) {
      const rem = (c.restEnd - now) / 1000;
      if (rem <= 0) {
        if (!alarmed) { alarmed = true; if (rem > -8) { tocarAlerta(); vibrate(); } doneUntil = now + 6000; }
        mutCur((x) => { x.restEnd = 0; x.restTotal = 0; });
        fimDoDescanso();
        drawBar();
      } else if (t) t.textContent = fmtClock(Math.ceil(rem));
      else drawBar();
    } else if (doneUntil && doneUntil <= now) { doneUntil = 0; drawBar(); }
  }

  cur.itens.forEach((_, i) => drawCard(i));
  drawBar();
  tick();
  const timer = setInterval(tick, 250);
  const onVis = () => { if (document.visibilityState === 'visible') tick(); };
  document.addEventListener('visibilitychange', onVis);
  // o navegador só libera som depois de um toque: o primeiro toque em qualquer ponto desta tela já libera o bipe
  // (ao voltar por "Continuar treino" depois de recarregar, nenhum ✓ foi tocado ainda)
  const TOQUES = ['pointerdown', 'click', 'keydown'];
  const liberarSom = () => { unlockAudio(); for (const ev of TOQUES) document.removeEventListener(ev, liberarSom, true); };
  for (const ev of TOQUES) document.addEventListener(ev, liberarSom, true);

  const body = [];
  if (cur.volta >= 14) body.push(note('info', `De volta depois de ${duracaoTxt(cur.volta)} parado: nas duas primeiras semanas o treino começa com menos séries por músculo, mais descanso e carga menor. Você pode ajustar qualquer série.`));
  if (!cur.itens.length) body.push(h('div', { class: 'empty' }, icon('dumbbell'), h('p', { text: 'Treino livre: toque em “Exercício” para escolher o que você vai fazer.' })));
  body.push(cards);
  if (cur.itens.length) body.push(note('info', 'Toque no ✓ ao terminar cada série. O descanso começa sozinho e o app avisa quando acabar.'));
  body.push(h('div', { class: 'row' }, btn('Descartar treino', async () => {
    const ok = await confirmSheet({ title: 'Descartar este treino?', text: 'Tudo o que foi registrado nesta sessão será perdido.', okLabel: 'Descartar', danger: true });
    if (!ok) return;
    cancelarAviso();
    update((s) => { s.current = null; });
    replace('treinos');
  }, 'plain danger sm', 'trash')));
  body.push(h('div', { class: 'spacer' }));
  return {
    title: cur.nome, back: 'treinos', noNav: true,
    actions: [h('div', { class: 'row gap-s' }, icon('timer', 's muted'), elapsed)],
    body, footer: bar,
    cleanup: () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      for (const ev of TOQUES) document.removeEventListener(ev, liberarSom, true);
      for (const parar of [...repeticoes]) parar();
      keepAwake(false);
    },
  };
}


// Histórico de treinos e progresso.
import { h, btn, icon, iconBtn, confirmSheet, toast, note, badge, sectionTitle, seg, fmtDate, fmtDur, fmtInt, fmtKg, plural, dateKey, parseNum } from '../ui.js';
import { state, update } from '../store.js';
import { go, refresh, replace } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { volumeSessao, seriesSessao, duracaoSessao, semanaAtual, sequenciaSemanas, volumePorSemana, recorde, e1rm, historico, assistido } from '../logic/progress.js';
import { barChart, lineChart, hbarChart } from './charts.js';
import { analisar, GRUPOS_VOLUME, SERIES_MIN, SERIES_BOM, SERIES_TETO, PESAGEM } from '../logic/insights.js';
import { GRUPOS } from '../data/muscles.js';
import { REFS } from '../data/knowledge.js';
import { gastoDoTreino, MET_MUSC } from '../logic/gasto.js';
import { exItem } from './common.js';

const setTxt = (ex, s) => (ex.registro === 'peso_reps' ? `${fmtKg(s.kg || 0)} kg × ${s.reps || 0}` : ex.registro === 'reps' ? `${s.reps || 0} rep.` : `${s.seg || 0} ${ex.registro === 'minutos' ? 'min' : 's'}`);

let quantos = 100; // quantos treinos a lista do histórico mostra
export function historyView() {
  const body = [];
  const list = state.sessions.slice().reverse();
  if (!list.length) {
    body.push(h('div', { class: 'empty' }, icon('history'), h('h2', { text: 'Nenhum treino registrado ainda' }), h('p', { text: 'Quando você finalizar um treino, ele aparece aqui.' }), btn('Ir para Treinos', () => go('treinos'), 'primary')));
    return { title: 'Histórico', back: '', body };
  }
  body.push(h('p', { class: 'small muted', text: plural(list.length, 'treino registrado', 'treinos registrados') }));
  const l = h('div', { class: 'list' });
  for (const s of list.slice(0, quantos)) {
    const vol = volumeSessao(s);
    l.appendChild(h('button', { class: 'item', type: 'button', onClick: () => go('historico/' + s.id) },
      h('div', { class: 'avatar' }, icon('check')),
      h('div', { class: 'grow' },
        h('div', { class: 't', text: s.nome }),
        h('div', { class: 's', text: `${fmtDate(s.inicio, true)} · ${fmtDur(duracaoSessao(s))}` }),
        h('div', { class: 's', text: `${plural(s.itens.length, 'exercício', 'exercícios')} · ${plural(seriesSessao(s), 'série', 'séries')}${vol ? ` · carga total: ${fmtInt(vol)} kg` : ''}` })),
      icon('right', 's')));
  }
  body.push(l);
  if (list.length > quantos) body.push(btn(`Mostrar treinos mais antigos (${list.length - quantos})`, () => { quantos += 200; refresh(); }, 'block'));
  return { title: 'Histórico', back: '', body };
}

export function sessionDetailView(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return { redirect: 'historico' };
  const body = [];
  const recente = Date.now() - Date.parse(s.fim) < 120000;
  if (recente) {
    body.push(h('div', { class: 'card hl center col' }, h('div', { class: 'row', }, h('div', { class: 'grow' })), icon('trophy', 'l accent'), h('h2', { text: 'Treino concluído!' }), h('p', { class: 'muted', text: 'Bom trabalho. Seu treino foi salvo no histórico.' })));
  }
  const vol = volumeSessao(s);
  // gasto estimado (logic/gasto.js): sem número para menores de 18 e para quem informou transtorno alimentar
  let g = null;
  try { g = gastoDoTreino(s, state); } catch { g = null; }
  body.push(h('div', { class: 'stats' + (g && g.mostrar ? ' quatro' : '') },
    h('div', { class: 'stat' }, h('b', { text: fmtDur(duracaoSessao(s)) }), h('span', { text: 'duração' })),
    h('div', { class: 'stat' }, h('b', { text: String(seriesSessao(s)) }), h('span', { text: 'séries' })),
    h('div', { class: 'stat' }, h('b', { class: 'nowrap', text: vol ? `${fmtInt(vol)} kg` : '–' }), h('span', { text: 'carga total' })),
    g && g.mostrar ? h('div', { class: 'stat', id: 'gasto-treino' }, h('b', { class: 'nowrap', text: `≈ ${fmtInt(g.kcal)} kcal` }), h('span', { text: 'gasto estimado' })) : null));
  if (g && g.mostrar) {
    const conta = `${g.musculacaoMin ? `musculação moderada (${String(g.idade60 ? MET_MUSC.idoso : MET_MUSC.adulto).replace('.', ',')} METs)` : ''}${g.musculacaoMin && g.cardio.length ? ' e ' : ''}${g.cardio.length ? 'o MET de cada cardio' : ''}`;
    body.push(h('details', { class: 'pq', id: 'gasto-porque' }, h('summary', { text: 'Por quê?' }),
      h('p', { class: 'small', text: `Estimativa pela tabela de atividades: ${conta}, vezes o seu peso (${fmtKg(g.peso)} kg) e o tempo. O gasto real varia muito de pessoa para pessoa.${g.foraDaConta.length ? ` Fica fora da conta (sem valor na tabela): ${g.foraDaConta.join(', ')}.` : ''}` }),
      h('p', { class: 'tiny muted', text: 'Fonte: ' + (g.idade60 ? REFS.compendio60_2024 : REFS.compendio2024) })));
  } else if (g && g.motivo === 'peso') {
    body.push(h('button', { class: 'plainlink small gasto-peso', type: 'button', id: 'gasto-treino', onClick: () => abrir({ aba: 'peso', rota: 'progresso' }) }, h('span', { class: 'muted', text: 'Informe seu peso para ver as calorias ' }), h('span', { class: 'bold', text: '→' })));
  }
  body.push(h('p', { class: 'small muted', text: fmtDate(s.inicio, true) }));
  for (const it of s.itens) {
    const ex = EX_POR_ID.get(it.ex);
    if (!ex) continue;
    const rows = h('div');
    it.sets.forEach((st, j) => rows.appendChild(h('div', { class: 'kv' }, h('span', { class: 'muted', text: `Série ${j + 1}` }), h('span', { text: setTxt(ex, st) }))));
    body.push(h('div', { class: 'card col gap-s' }, h('button', { class: 'row between menu-item', type: 'button', onClick: () => go('exercicio/' + ex.id) }, h('span', { class: 'bold grow', text: ex.nome }), icon('right', 's')), rows));
  }
  body.push(btn('Excluir este treino do histórico', async () => {
    const ok = await confirmSheet({ title: 'Excluir este registro?', text: 'O treino será apagado do histórico e das estatísticas. Não dá para desfazer.', okLabel: 'Excluir', danger: true });
    if (!ok) return;
    update((st) => { st.sessions = st.sessions.filter((x) => x.id !== id); });
    replace('historico');
  }, 'block plain danger', 'trash'));
  return { title: s.nome, back: 'historico', body, actions: recente ? [btn('Início', () => replace(''), 'sm primary')] : [] };
}

// ---------- Evolução: dicas, força, volume e peso ----------
const REF_CURTA = { acsm2009: 'ACSM, 2009', acsm2026: 'ACSM, 2026', oms2020: 'OMS, 2020' };
function refCurta(k) {
  if (REF_CURTA[k]) return REF_CURTA[k];
  const t = REFS[k] || '';
  const ano = (/(19|20)\d\d/.exec(t) || [''])[0];
  return `${t.split(' ')[0]} et al., ${ano}`;
}
let aba = 'dicas';
const abrir = (acao) => { if (acao.aba) aba = acao.aba; go(acao.rota); if (acao.aba) refresh(); };

// cartão de uma dica: título, uma frase, botão de ação e o motivo (recolhido)
export function dicaCard(d, compacto = false) {
  return h('div', { class: 'dica ' + d.tom + (compacto ? ' plana' : '') },
    h('div', { class: 'dica-ic' }, icon(d.icone)),
    h('div', { class: 'grow col gap-s' },
      h('div', { class: 'bold', text: d.titulo }),
      h('div', { class: 'small muted', text: d.texto }),
      !compacto && d.acao ? h('div', null, btn(d.acao.rotulo, () => abrir(d.acao), 'sm')) : null,
      !compacto && d.porque ? h('details', { class: 'pq' }, h('summary', { text: 'Por quê?' }), h('p', { class: 'small', text: d.porque }), d.refs ? h('p', { class: 'tiny muted', text: 'Fonte: ' + d.refs.map(refCurta).join('; ') }) : null) : null));
}

export function progressView() {
  const body = [];
  const total = state.sessions.length;
  // meta da semana só com agenda no plano; sem ela, a sequência conta as semanas seguidas com algum treino
  const comAgenda = temAgenda();
  const meta = comAgenda ? metaSemanal() : 1;
  const semana = semanaAtual().size;
  const seq = sequenciaSemanas(meta);
  const an = analisar(state);
  body.push(h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('b', { text: String(total) }), h('span', { text: total === 1 ? 'treino feito' : 'treinos feitos' })),
    h('div', { class: 'stat' }, h('b', { text: comAgenda ? `${semana}/${meta}` : String(semana) }), h('span', { text: 'nesta semana' })),
    h('div', { class: 'stat' }, h('b', { text: String(seq) }), h('span', { text: seq === 1 ? 'semana seguida' : 'semanas seguidas' }))));
  body.push(seg([['dicas', 'Dicas'], ['forca', 'Força'], ['volume', 'Volume'], ['peso', 'Peso']], aba, (v) => { aba = v; refresh(); }));

  if (aba === 'dicas') {
    for (const d of an.dicas) body.push(dicaCard(d));
    if (an.suficiente) body.push(h('p', { class: 'tiny muted center', text: 'Análise automática dos seus registros. Não substitui a avaliação de um profissional.' }));
  }

  if (aba === 'forca') {
    const tend = an.resumo.tendencias;
    if (!tend.length) body.push(note('info', 'Repita um exercício com carga em 3 treinos para ver a tendência dele aqui.'));
    else {
      const l = h('div', { class: 'list' });
      const selo = (t) => (t.status === 'subindo' ? badge(`+${Math.round(t.variacao * 100)}%`, 'ok') : t.status === 'caindo' ? badge(`${Math.round(t.variacao * 100)}%`, 'danger') : t.status === 'parado' ? badge('parado', 'warn') : badge('estável'));
      for (const t of tend.slice(0, 20)) { const ex = EX_POR_ID.get(t.id); if (ex) l.appendChild(exItem(ex, { onClick: () => go('exercicio/' + ex.id), sub: `${t.treinos} treinos · ≈ ${fmtKg(t.forca)} kg`, right: selo(t) })); }
      body.push(sectionTitle('Tendência por exercício'), l);
    }
    const marcas = new Map();
    for (const s of state.sessions) {
      for (const it of s.itens) {
        const ex = EX_POR_ID.get(it.ex);
        if (!ex || ex.registro !== 'peso_reps' || assistido(it.ex)) continue;
        let m = marcas.get(it.ex);
        if (!m) { m = { ex, n: 0, r: null }; marcas.set(it.ex, m); }
        let teve = false;
        for (const st of it.sets) {
          if (!st.ok) continue;
          teve = true;
          const v = e1rm(st.kg || 0, st.reps || 0);
          if (v > 0 && (!m.r || v > m.r.v)) m.r = { v, kg: st.kg, reps: st.reps, data: s.inicio };
        }
        if (teve) m.n++;
      }
    }
    const recs = [...marcas.values()].filter((m) => m.r).sort((a, b) => b.n - a.n);
    if (recs.length) {
      body.push(sectionTitle('Melhores marcas'));
      const l = h('div', { class: 'list' });
      for (const { ex, r } of recs.slice(0, 8)) l.appendChild(exItem(ex, { onClick: () => go('exercicio/' + ex.id), sub: `${fmtKg(r.kg)} kg × ${r.reps} · ${fmtDate(r.data, true)}`, right: badge(`≈ ${fmtKg(Math.round(e1rm(r.kg, r.reps)))} kg`, 'acc') }));
      body.push(l);
    }
    if (tend.length || recs.length) body.push(h('p', { class: 'tiny muted', text: '≈ kg: força estimada para 1 repetição. Serve só para comparar a sua evolução.' }));
  }

  if (aba === 'volume') {
    const g = an.resumo.series;
    if (total) {
      const rows = GRUPOS_VOLUME.map((k) => ({ label: GRUPOS[k], value: g[k], cls: g[k] < SERIES_MIN ? 'low' : g[k] > SERIES_TETO + 2 ? 'high' : '' }));
      body.push(h('div', { class: 'card col' }, h('h2', { text: 'Séries por semana' }), hbarChart(rows, { faixa: [SERIES_BOM, SERIES_TETO], label: 'Séries por semana em cada grupo muscular' }), h('p', { class: 'tiny muted', text: 'Média das últimas 2 semanas. Músculo auxiliar conta meia série.' })));
    }
    const vols = volumePorSemana(8);
    if (vols.some((v) => v.vol > 0)) body.push(h('div', { class: 'card col' }, h('h2', { text: 'Carga total por semana' }), barChart(vols.map((v) => ({ label: v.rotulo, value: v.vol })), 'Carga total levantada por semana'), h('p', { class: 'tiny muted', text: 'Carga × repetições de todas as séries, em kg.' })));
    if (!total) body.push(note('info', 'Finalize o seu primeiro treino para ver os gráficos.'));
  }

  if (aba === 'peso') {
    const pesoInput = h('input', { class: 'input', type: 'text', inputmode: 'decimal', placeholder: 'Ex.: 72,5', 'aria-label': 'Peso em quilos', autocomplete: 'off' });
    const salvarPeso = () => {
      const v = parseNum(pesoInput.value);
      if (!Number.isFinite(v) || v < 20 || v > 400) { toast('Digite um peso entre 20 e 400 kg.'); return; }
      const hoje = dateKey();
      update((s) => { s.body = s.body.filter((b) => b.data !== hoje); s.body.push({ data: hoje, peso: Math.round(v * 10) / 10, cintura: null }); s.body.sort((a, b) => (a.data < b.data ? -1 : 1)); if (s.body.length > 3000) s.body.shift(); });
      toast('Peso registrado'); refresh();
    };
    const pesoCard = h('div', { class: 'card col' }, h('h2', { text: 'Peso corporal' }));
    if (state.body.length >= 2) pesoCard.appendChild(lineChart(state.body.slice(-20).map((b) => ({ label: `${Number(b.data.slice(8))}/${Number(b.data.slice(5, 7))}`, value: b.peso })), 'Evolução do peso corporal'));
    if (state.body.length) {
      const ult = state.body[state.body.length - 1];
      const dif = Math.round((ult.peso - state.body[0].peso) * 10) / 10;
      pesoCard.appendChild(h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Último registro' }), h('span', { text: `${fmtKg(ult.peso)} kg` })));
      if (state.body.length > 1) pesoCard.appendChild(h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Desde o primeiro registro' }), h('span', { text: `${dif > 0 ? '+' : ''}${fmtKg(dif)} kg` })));
    } else pesoCard.appendChild(h('p', { class: 'small muted', text: PESAGEM }));
    pesoCard.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, pesoInput), btn('Registrar', salvarPeso, 'primary')));
    if (state.body.length) pesoCard.appendChild(btn('Apagar o último registro', async () => {
      const u = state.body[state.body.length - 1];
      if (!u || !(await confirmSheet({ title: 'Apagar este registro de peso?', text: `${fmtKg(u.peso)} kg, de ${fmtDate(u.data + 'T12:00:00')}.`, okLabel: 'Apagar', danger: true }))) return;
      update((s) => { const i = s.body.findIndex((b) => b.data === u.data); if (i >= 0) s.body.splice(i, 1); });
      refresh();
    }, 'plain sm danger'));
    body.push(pesoCard);
  }

  return { title: 'Evolução', back: '', body, actions: [iconBtn('history', 'Histórico de treinos', () => go('historico'))] };
}

// o plano ativo tem dias marcados na agenda? Sem agenda, não há meta de treinos na semana para mostrar.
export function temAgenda() {
  const p = state.plans.find((x) => x.id === state.activePlan);
  return !!p && !!p.agenda && Object.keys(p.agenda).length > 0;
}
export function metaSemanal() {
  const p = state.plans.find((x) => x.id === state.activePlan);
  const agendados = p ? Object.keys(p.agenda).length : 0;
  const dias = Number(state.trainer.answers.dias) || 0;
  return Math.max(1, agendados || dias || 3);
}

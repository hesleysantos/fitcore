// Catálogo de exercícios: busca, filtros e tela de detalhe com a animação.
import { h, btn, icon, sheet, chip, toggle, seg, note, badge, sectionTitle, fmtKg, fmtDate } from '../ui.js';
import { state, hasEquip } from '../store.js';
import { go } from '../router.js';
import { EXERCICIOS, EX_POR_ID } from '../data/exercises.js';
import { MUSCULOS, GRUPOS, MODALIDADES, CUIDADOS, PADROES } from '../data/muscles.js';
import { EQUIPAMENTOS } from '../data/equipment.js';
import { figure, muscleMap } from '../figure.js';
import { exItem, filtrar, nivelBadge, cuidadosDoUsuario, addToPlanSheet } from './common.js';
import { historico, recorde, e1rm } from '../logic/progress.js';
import { lineChart } from './charts.js';

// filtros ficam guardados enquanto o app está aberto
const F = { q: '', grupo: '', mods: new Set(), nivel: 0, tipo: '', soMinha: false, semCuidado: false };
const ativos = () => F.mods.size + (F.nivel ? 1 : 0) + (F.tipo ? 1 : 0) + (F.soMinha ? 1 : 0) + (F.semCuidado ? 1 : 0);

export function exercisesView() {
  const list = h('div', { class: 'list' });
  const count = h('p', { class: 'small muted' });
  const filterBtn = h('button', { class: 'btn sm', type: 'button', onClick: openFilters });
  const syncFilterBtn = () => {
    while (filterBtn.firstChild) filterBtn.removeChild(filterBtn.firstChild);
    filterBtn.appendChild(icon('filter', 's'));
    filterBtn.appendChild(document.createTextNode(ativos() ? `Filtros (${ativos()})` : 'Filtros'));
    filterBtn.classList.toggle('primary', ativos() > 0);
  };
  const draw = () => {
    while (list.firstChild) list.removeChild(list.firstChild);
    const items = filtrar(F);
    count.textContent = items.length === 1 ? '1 exercício' : `${items.length} exercícios`;
    if (!items.length) {
      list.appendChild(h('div', { class: 'empty' }, icon('search'), 'Nenhum exercício encontrado.', btn('Limpar busca e filtros', () => { F.q = ''; F.grupo = ''; F.mods.clear(); F.nivel = 0; F.tipo = ''; F.soMinha = false; F.semCuidado = false; search.value = ''; drawChips(); syncFilterBtn(); draw(); }, 'sm')));
    }
    for (const ex of items) list.appendChild(exItem(ex, { onClick: () => go('exercicio/' + ex.id), right: icon('right', 's') }));
  };
  const search = h('input', { class: 'input', type: 'search', value: F.q, placeholder: 'Buscar por nome, músculo ou aparelho', 'aria-label': 'Buscar exercício', autocomplete: 'off', onInput: (e) => { F.q = e.target.value; draw(); } });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Grupo muscular' });
  const drawChips = () => {
    while (chips.firstChild) chips.removeChild(chips.firstChild);
    chips.appendChild(chip('Todos', !F.grupo, () => { F.grupo = ''; drawChips(); draw(); }));
    for (const [k, nome] of Object.entries(GRUPOS)) chips.appendChild(chip(nome, F.grupo === k, () => { F.grupo = F.grupo === k ? '' : k; drawChips(); draw(); }));
  };
  function openFilters() {
    const body = h('div', { class: 'col gap-l' });
    const drawBody = () => {
      while (body.firstChild) body.removeChild(body.firstChild);
      const mods = h('div', { class: 'chips wrap' });
      for (const [k, nome] of Object.entries(MODALIDADES)) mods.appendChild(chip(nome, F.mods.has(k), () => { if (F.mods.has(k)) F.mods.delete(k); else F.mods.add(k); drawBody(); }));
      body.appendChild(h('div', { class: 'col gap-s' }, h('h3', { text: 'Tipo de equipamento' }), mods));
      body.appendChild(h('div', { class: 'col gap-s' }, h('h3', { text: 'Nível' }), seg([[0, 'Todos'], [1, 'Iniciante'], [2, 'Interm.'], [3, 'Avançado']], F.nivel, (v) => { F.nivel = v; drawBody(); })));
      body.appendChild(h('div', { class: 'col gap-s' }, h('h3', { text: 'Tipo de exercício' }), seg([['', 'Todos'], ['composto', 'Composto'], ['isolado', 'Isolado']], F.tipo, (v) => { F.tipo = v; drawBody(); }),
        h('p', { class: 'tiny muted', text: 'Composto: movimenta mais de uma articulação (ex.: agachamento). Isolado: uma só (ex.: rosca).' })));
      body.appendChild(h('div', { class: 'row between' }, h('div', null, h('div', { class: 'bold', text: 'Só o que tem na minha academia' }), h('div', { class: 'tiny muted', text: state.gym.all ? 'Você ainda não marcou os aparelhos da sua academia.' : 'Usa a lista “Minha academia”.' })), toggle(F.soMinha, (v) => { F.soMinha = v; }, 'Só o que tem na minha academia')));
      const cuid = cuidadosDoUsuario();
      body.appendChild(h('div', { class: 'row between' }, h('div', null, h('div', { class: 'bold', text: 'Esconder os que pedem cuidado' }), h('div', { class: 'tiny muted', text: cuid.length ? 'Conforme as limitações que você informou ao Treinador.' : 'Informe suas limitações ao Treinador para usar este filtro.' })), toggle(F.semCuidado, (v) => { F.semCuidado = v; }, 'Esconder exercícios que pedem cuidado')));
    };
    drawBody();
    const s = sheet({
      title: 'Filtros', body,
      footer: [btn('Limpar', () => { F.mods.clear(); F.nivel = 0; F.tipo = ''; F.soMinha = false; F.semCuidado = false; drawBody(); }, 'ghost'), btn('Ver exercícios', () => s.close(), 'primary')],
      onClose: () => { syncFilterBtn(); draw(); },
    });
  }
  drawChips(); syncFilterBtn(); draw();
  return {
    title: 'Exercícios',
    body: [h('div', { class: 'search' }, icon('search'), search), chips, h('div', { class: 'row between' }, count, filterBtn), list],
  };
}

// ---------- detalhe ----------
export function exerciseView(id) {
  const ex = EX_POR_ID.get(id);
  if (!ex) return { redirect: 'exercicios' };
  const body = [];
  body.push(figure(ex));
  body.push(h('div', { class: 'row wrap gap-s' }, badge(GRUPOS[ex.grupo], 'acc'), nivelBadge(ex), badge(MODALIDADES[ex.modalidade]), badge(ex.tipo === 'composto' ? 'Composto' : 'Isolado'), ex.unilateral ? badge('Um lado de cada vez') : null));

  // cuidados
  const meus = cuidadosDoUsuario().filter((c) => ex.cuidado.includes(c));
  if (meus.length) body.push(note('warn', `Atenção: este exercício pede cuidado com ${meus.map((c) => CUIDADOS[c]).join(', ')}, que você informou ao Treinador. Prefira uma alternativa.`));

  // músculos
  const prim = h('div', { class: 'row wrap gap-s' });
  for (const m of ex.primarios) prim.appendChild(badge(MUSCULOS[m].nome, 'm1'));
  const sec = h('div', { class: 'row wrap gap-s' });
  for (const m of ex.secundarios) sec.appendChild(badge(MUSCULOS[m].nome, 'm2'));
  body.push(h('div', { class: 'card col' },
    h('h2', { text: 'Músculos trabalhados' }),
    muscleMap(ex),
    h('div', { class: 'legend' }, h('span', null, h('i', { class: 'l1' }), 'Principal'), h('span', null, h('i', { class: 'l2' }), 'Auxiliar')),
    h('div', { class: 'col gap-s' }, h('div', { class: 'tiny muted', text: 'PRINCIPAIS' }), prim),
    ex.secundarios.length ? h('div', { class: 'col gap-s' }, h('div', { class: 'tiny muted', text: 'AUXILIARES' }), sec) : null));

  // aparelhos
  if (ex.equip.length) {
    const eq = h('div', { class: 'col gap-s' });
    for (const e of ex.equip) {
      const falta = !state.gym.all && !state.gym.has[e];
      eq.appendChild(h('div', { class: 'row' }, icon(falta ? 'close' : 'check', 's ' + (falta ? 'danger' : 'ok')), h('span', { text: EQUIPAMENTOS[e].nome }), falta ? h('span', { class: 'tiny muted', text: '(não marcado na sua academia)' }) : null));
    }
    body.push(h('div', { class: 'card col' }, h('h2', { text: 'Aparelhos' }), eq));
  } else {
    body.push(h('div', { class: 'card col' }, h('h2', { text: 'Aparelhos' }), h('p', { class: 'muted', text: 'Não precisa de aparelho.' })));
  }

  // execução
  const passos = h('ol');
  for (const p of ex.execucao) passos.appendChild(h('li', { text: p }));
  body.push(h('div', { class: 'card col' },
    h('h2', { text: 'Como fazer' }),
    h('p', null, h('b', { text: 'Posição inicial: ' }), ex.posicao),
    passos,
    h('div', { class: 'note info' }, icon('info'), h('div', null, h('b', { text: 'Respiração: ' }), ex.respiracao))));
  const dicas = h('ul');
  for (const d of ex.dicas) dicas.appendChild(h('li', { text: d }));
  const erros = h('ul');
  for (const d of ex.erros) erros.appendChild(h('li', { text: d }));
  body.push(h('details', { class: 'acc' }, h('summary', { text: `Pontos de atenção (${ex.dicas.length})` }), h('div', null, dicas)));
  body.push(h('details', { class: 'acc' }, h('summary', { text: `Erros comuns (${ex.erros.length})` }), h('div', null, erros)));
  if (ex.cuidado.length && !meus.length) body.push(note('info', `Pede cuidado em caso de: ${ex.cuidado.map((c) => CUIDADOS[c]).join(', ')}. Se for o seu caso, adapte ou escolha outro exercício.`));

  // fontes em que a técnica foi conferida (só texto: o app não abre endereços externos)
  if (ex.fontes && ex.fontes.length) {
    const fts = h('ul', { class: 'fontes' });
    for (const ft of ex.fontes) fts.appendChild(h('li', null, h('b', { text: ft.org }), ' — ' + ft.titulo, h('div', { class: 'tiny muted quebra', text: ft.url })));
    body.push(h('details', { class: 'acc' }, h('summary', { text: 'Fontes da técnica' }), h('div', null, fts)));
  }

  // histórico do usuário
  const hst = historico(ex.id, 12);
  if (hst.length) {
    const rec = recorde(ex.id);
    const card = h('div', { class: 'card col' }, h('h2', { text: 'Seu histórico' }));
    if (rec) {
      const txt = ex.registro === 'peso_reps' ? `${fmtKg(rec.kg)} kg × ${rec.reps}` : ex.registro === 'reps' ? `${rec.reps} repetições` : `${rec.seg} ${ex.registro === 'minutos' ? 'min' : 's'}`;
      card.appendChild(h('div', { class: 'row' }, icon('trophy', 'accent'), h('div', null, h('div', { class: 'bold', text: 'Melhor marca: ' + txt }), h('div', { class: 'tiny muted', text: fmtDate(rec.data, true) }))));
    }
    if (ex.registro === 'peso_reps' && hst.length >= 2) {
      const pts = hst.slice().reverse().map((x) => ({ label: `${new Date(x.data).getDate()}/${new Date(x.data).getMonth() + 1}`, value: Math.round(Math.max(...x.sets.map((s) => e1rm(s.kg || 0, s.reps || 0))) * 10) / 10 }));
      card.appendChild(h('div', { class: 'tiny muted', text: 'Força estimada (kg) ao longo dos treinos' }));
      card.appendChild(lineChart(pts));
    }
    for (const x of hst.slice(0, 4)) {
      const sets = x.sets.map((s) => (ex.registro === 'peso_reps' ? `${fmtKg(s.kg || 0)} kg × ${s.reps || 0}` : ex.registro === 'reps' ? `${s.reps || 0}` : `${s.seg || 0}`)).join(' · ');
      card.appendChild(h('div', { class: 'kv' }, h('span', { class: 'muted', text: fmtDate(x.data) }), h('span', { text: sets })));
    }
    body.push(card);
  }

  // parecidos
  const parecidos = EXERCICIOS.filter((e) => e.padrao === ex.padrao && e.id !== ex.id).slice(0, 6);
  if (parecidos.length) {
    body.push(sectionTitle('Exercícios parecidos'));
    body.push(h('p', { class: 'small muted', text: `Mesmo tipo de movimento: ${PADROES[ex.padrao].toLowerCase()}.` }));
    const l = h('div', { class: 'list' });
    for (const e of parecidos) l.appendChild(exItem(e, { onClick: () => go('exercicio/' + e.id), right: hasEquip(e) ? icon('right', 's') : badge('falta aparelho') }));
    body.push(l);
  }
  return {
    title: ex.nome, back: 'exercicios',
    body,
    footer: h('div', { class: 'fab-bar' }, btn('Adicionar a um treino', () => addToPlanSheet(ex.id), 'primary lg block', 'plus')),
  };
}


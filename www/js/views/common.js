// Peças reutilizadas por várias telas.
import { h, btn, icon, sheet, toast, norm, badge, chip, uid, plural, dateKey } from '../ui.js';
import { state, update, hasEquip, activePlan } from '../store.js';
import { EXERCICIOS, EX_POR_ID } from '../data/exercises.js';
import { MUSCULOS, GRUPOS, MODALIDADES, NIVEIS } from '../data/muscles.js';
import { EQUIPAMENTOS } from '../data/equipment.js';
import { thumb } from '../figure.js';
import { perfil, alertaDoExercicio, doresDoTreino, respostasParaAvisos } from '../logic/trainer.js';

export const subtitulo = (ex) => `${GRUPOS[ex.grupo]} · ${MODALIDADES[ex.modalidade]}`;
export const nomeMusculos = (ids) => ids.map((m) => (MUSCULOS[m] ? MUSCULOS[m].nome : m)).join(', ');
export const nivelBadge = (ex) => badge(NIVEIS[ex.nivel], ex.nivel === 1 ? 'ok' : ex.nivel === 3 ? 'warn' : '');

// regiões/condições informadas ao Treinador (para avisar sobre exercícios que pedem cuidado)
export function cuidadosDoUsuario() {
  const a = state.trainer.answers;
  if (!a || !a.objetivo) return [];
  return perfil(a).cuidados;
}
// Dores que valem hoje para o Treinador (ativas, pendentes de resposta e em volta gradual) e as respostas usadas nos
// avisos: as mesmas da tela do treino (views/session.js).
export function doresDeHoje() {
  try {
    const respostas = respostasParaAvisos(state);
    return { dores: doresDoTreino(state, dateKey(new Date()), respostas), respostas };
  } catch { return { dores: [], respostas: null }; }
}
// Aviso de dor para um exercício, pela regra do Treinador (região da dor × mecânica, músculos e marcas do catálogo:
// alertaDoExercicio em logic/trainer.js). null = a dor não pega este exercício.
export function avisoDeDor(exId, ctx = doresDeHoje()) {
  if (!ctx.dores.length) return null;
  try { return alertaDoExercicio(exId, ctx.dores, ctx.respostas); } catch { return null; }
}

// item de lista de exercício
export function exItem(ex, { onClick, selected = false, right = null, sub = null } = {}) {
  const el = h('button', { class: 'item' + (selected ? ' sel' : ''), type: 'button', onClick },
    h('div', { class: 'thumb' }, thumb(ex)),
    h('div', { class: 'grow' },
      h('div', { class: 't', text: ex.nome }),
      h('div', { class: 's', text: sub || subtitulo(ex) })),
    right);
  return el;
}

// valores padrão ao colocar um exercício num treino
export function novoItem(ex) {
  const reps = ex.registro === 'segundos' ? '30' : ex.registro === 'minutos' ? '20' : ex.tipo === 'composto' ? '8-12' : '10-15';
  const series = ex.registro === 'minutos' ? 1 : 3;
  const descanso = ex.registro === 'minutos' ? 0 : ex.registro === 'segundos' ? 45 : ex.tipo === 'composto' ? 90 : 60;
  return { ex: ex.id, series, reps, descanso, nota: '' };
}
export function alvoTexto(it) {
  const ex = EX_POR_ID.get(it.ex);
  if (ex && ex.registro === 'minutos') return `${it.reps} min`;
  if (ex && ex.registro === 'segundos') return `${it.series} × ${it.reps} s`;
  return `${it.series} × ${it.reps}`;
}
// duração estimada de um treino, em minutos
export function duracaoEstimada(dia) {
  let seg = 300; // aquecimento
  for (const it of dia.itens) {
    const ex = EX_POR_ID.get(it.ex);
    const n = Number(String(it.reps).split('-')[0]); // "20-30" vale 20
    if (ex && ex.registro === 'minutos') { seg += (n || 20) * 60; continue; }
    const trabalho = ex && ex.registro === 'segundos' ? n || 30 : 40;
    seg += it.series * (trabalho + it.descanso) + 60;
  }
  return Math.max(5, Math.round(seg / 300) * 5);
}

// Folha inferior que fecha sozinha se a tela de baixo mudar (ex.: botão "voltar" do aparelho com a folha aberta),
// para não ficar solta por cima de outra tela.
export function folha(opts) {
  const fechar = () => s.close();
  const s = sheet({ ...opts, onClose: (r) => { window.removeEventListener('hashchange', fechar); if (opts.onClose) opts.onClose(r); } });
  window.addEventListener('hashchange', fechar);
  return s;
}

// ---------- busca e filtros ----------
// o índice tem o nome do exercício, o grupo, a modalidade, os músculos, os apelidos e o NOME DOS APARELHOS que ele usa
const INDEX = new Map(EXERCICIOS.map((e) => [e.id, norm([e.nome, GRUPOS[e.grupo], MODALIDADES[e.modalidade], nomeMusculos(e.primarios), ...(e.aliases || []), ...(e.equip || []).map((k) => (EQUIPAMENTOS[k] && EQUIPAMENTOS[k].nome) || '')].join(' '))]));
// "articulado" acha "articulada", "halter" acha "halteres": palavras de 5 letras ou mais valem pela raiz (sem o final a/o/s)
const raiz = (t) => (t.length >= 5 ? t.replace(/(as|os|es|a|o|s)$/, '') : t);
export function filtrar({ q = '', grupo = '', mods = null, nivel = 0, tipo = '', soMinha = false, semCuidado = false, padrao = '', excluir = null } = {}) {
  const termos = norm(q).split(/\s+/).filter(Boolean);
  const cuid = semCuidado ? cuidadosDoUsuario() : [];
  const dor = semCuidado ? doresDeHoje() : { dores: [] };
  return EXERCICIOS.filter((e) => {
    if (grupo && e.grupo !== grupo) return false;
    if (padrao && e.padrao !== padrao) return false;
    if (mods && mods.size && !mods.has(e.modalidade)) return false;
    if (nivel && e.nivel !== nivel) return false;
    if (tipo && e.tipo !== tipo) return false;
    if (soMinha && !hasEquip(e)) return false;
    if (excluir && excluir.has(e.id)) return false;
    if (cuid.length && e.cuidado.some((c) => cuid.includes(c))) return false;
    if (dor.dores.length && avisoDeDor(e.id, dor)) return false;
    if (termos.length) { const idx = INDEX.get(e.id); if (!termos.every((t) => idx.includes(t) || idx.includes(raiz(t)))) return false; }
    return true;
  });
}

// ---------- seletor de exercícios (folha em tela cheia) ----------
export function pickExercises({ title = 'Adicionar exercícios', multi = true, padrao = '', excluir = null, okLabel = 'Adicionar' } = {}) {
  return new Promise((resolve) => {
    const sel = new Set();
    const F = { q: '', grupo: '', padrao, soMinha: !state.gym.all, excluir };
    const list = h('div', { class: 'list' });
    const count = h('p', { class: 'small muted' });
    let done = false;
    let confirmed = false;
    const okBtn = btn(okLabel, () => { confirmed = true; s.close(); }, 'primary');
    const syncOk = () => { okBtn.textContent = sel.size ? `${okLabel} (${sel.size})` : okLabel; okBtn.disabled = !sel.size; };
    const draw = () => {
      while (list.firstChild) list.removeChild(list.firstChild);
      const items = filtrar(F);
      count.textContent = items.length === 1 ? '1 exercício' : `${items.length} exercícios`;
      if (!items.length) list.appendChild(h('div', { class: 'empty' }, icon('search'), 'Nenhum exercício encontrado. Tente outra palavra ou outro grupo.'));
      for (const ex of items) {
        const row = exItem(ex, {
          selected: sel.has(ex.id),
          right: multi ? null : icon('right', 's'),
          onClick: () => {
            if (!multi) { sel.clear(); sel.add(ex.id); done = true; s.close(); return; }
            if (sel.has(ex.id)) sel.delete(ex.id); else sel.add(ex.id);
            row.classList.toggle('sel', sel.has(ex.id));
            syncOk();
          },
        });
        list.appendChild(row);
      }
    };
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Buscar exercício ou músculo', 'aria-label': 'Buscar exercício', autocomplete: 'off', onInput: (e) => { F.q = e.target.value; draw(); } });
    const chips = h('div', { class: 'chips' });
    const drawChips = () => {
      while (chips.firstChild) chips.removeChild(chips.firstChild);
      if (padrao) chips.appendChild(chip('Só movimentos parecidos', !!F.padrao, () => { F.padrao = F.padrao ? '' : padrao; drawChips(); draw(); }));
      if (!state.gym.all) chips.appendChild(chip('Só da minha academia', F.soMinha, () => { F.soMinha = !F.soMinha; drawChips(); draw(); }));
      chips.appendChild(chip('Todos', !F.grupo, () => { F.grupo = ''; drawChips(); draw(); }));
      for (const [k, nome] of Object.entries(GRUPOS)) chips.appendChild(chip(nome, F.grupo === k, () => { F.grupo = F.grupo === k ? '' : k; drawChips(); draw(); }));
    };
    const s = folha({
      title, full: true,
      // os filtros vão dentro de uma caixa própria: soltos na folha (coluna flexível), a lista comprida os espremia a 6 px de altura
      body: [h('div', { class: 'search' }, icon('search'), search), h('div', null, chips), count, list],
      footer: multi ? [btn('Cancelar', () => { sel.clear(); s.close(); }, 'ghost'), okBtn] : null,
      onClose: () => resolve(multi ? (confirmed ? [...sel] : []) : (done ? [...sel] : [])),
    });
    drawChips(); draw(); syncOk();
  });
}

// ---------- adicionar exercício a um treino ----------
const MAX_ITENS = 40; // exercícios por treino
export function ensurePlan() {
  let p = activePlan();
  if (!p) {
    update((s) => {
      const id = 'p' + uid();
      s.plans.push({ id, nome: 'Meu treino', origem: 'manual', criadoEm: new Date().toISOString(), dias: [{ id: 'd' + uid(), nome: 'Treino A', foco: '', itens: [] }], agenda: {}, info: '' });
      s.activePlan = id;
    });
    p = activePlan();
  }
  return p;
}
export function addToPlanSheet(exId) {
  const ex = EX_POR_ID.get(exId);
  if (!ex) return;
  const plan = activePlan();
  // sem plano (ou plano sem treinos): mostra o treino que será criado, mas só cria se a pessoa escolher
  const novo = !plan || !plan.dias.length;
  const dias = novo ? [{ id: '', nome: 'Treino A', itens: [] }] : plan.dias;
  const body = [h('p', { class: 'muted small', text: plan ? `Escolha em qual treino de “${plan.nome}” colocar o exercício.` : 'Você ainda não tem um plano. Toque abaixo para criar “Meu treino” com este exercício.' })];
  const list = h('div', { class: 'list' });
  for (const d of dias) {
    const ja = d.itens.some((i) => i.ex === exId);
    const cheio = !ja && d.itens.length >= MAX_ITENS;
    list.appendChild(h('button', {
      class: 'item', type: 'button', disabled: ja || cheio,
      onClick: () => {
        let entrou = false;
        const alvo = plan || ensurePlan(); // sem plano, "Meu treino" (com o Treino A) nasce só agora
        update((st) => {
          const p = st.plans.find((x) => x.id === alvo.id);
          if (!p) return;
          let dd = d.id ? p.dias.find((x) => x.id === d.id) : p.dias[0];
          if (!dd && !d.id) { dd = { id: 'd' + uid(), nome: d.nome, foco: '', itens: [] }; p.dias.push(dd); }
          if (dd && dd.itens.length < MAX_ITENS && !dd.itens.some((i) => i.ex === exId)) { dd.itens.push(novoItem(ex)); entrou = true; }
        });
        s.close();
        toast(entrou ? `Adicionado a ${d.nome}` : 'Não foi possível adicionar a este treino.');
      },
    }, h('div', { class: 'grow' }, h('div', { class: 't', text: d.nome }), h('div', { class: 's', text: ja ? 'Já está neste treino' : cheio ? `Treino cheio (${MAX_ITENS} exercícios)` : novo ? 'Treino novo' : plural(d.itens.length, 'exercício', 'exercícios') })), icon(ja ? 'check' : 'plus', 's')));
  }
  body.push(list);
  const s = folha({ title: 'Adicionar ao treino', body });
}

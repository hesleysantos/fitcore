// Tela inicial: o treino de hoje, a semana e os atalhos.
import { h, btn, icon, iconBtn, badge, sectionTitle, DIAS_CURTO, DIAS_LONGO, dateKey, plural, fmtInt } from '../ui.js';
import { state, activePlan } from '../store.js';
import { go } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { thumb } from '../figure.js';
import { semanaAtual, sequenciaSemanas, inicioSemana } from '../logic/progress.js';
import { duracaoEstimada, alvoTexto } from './common.js';
import { startSession } from './session.js';
import { installCard } from '../install.js';
import { metaSemanal, dicaCard } from './history.js';
import { analisar, destaques } from '../logic/insights.js';
import { revisaoPendente } from './trainer.js';
import { calcular, respostasCompletas as nutriOk } from '../logic/nutrition.js';

function saudacao() {
  const hora = new Date().getHours();
  return hora < 5 ? 'Boa noite' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

export function homeView() {
  const body = [];
  const plan = activePlan();
  const hoje = new Date();
  const wd = hoje.getDay();
  body.push(h('div', null, h('h1', { text: saudacao() + '!' }), h('p', { class: 'muted', text: `${DIAS_LONGO[wd]}, ${hoje.getDate()}/${hoje.getMonth() + 1}` })));

  const inst = installCard();
  if (inst) body.push(inst);

  // treino em andamento
  if (state.current) {
    body.push(h('div', { class: 'card hl col' }, h('div', { class: 'row' }, icon('timer', 'accent'), h('div', { class: 'grow' }, h('h3', { text: 'Treino em andamento' }), h('div', { class: 'small muted', text: state.current.nome }))), btn('Continuar treino', () => go('sessao'), 'primary lg block', 'play')));
  }

  // treino de hoje
  const feitoHoje = state.sessions.some((s) => dateKey(new Date(s.inicio)) === dateKey(hoje));
  if (!plan) {
    body.push(h('div', { class: 'card hl col' },
      h('h2', { text: 'Vamos montar o seu treino?' }),
      h('p', { class: 'muted', text: 'O Treinador monta um plano para o seu objetivo em 2 minutos.' }),
      btn('Começar com o Treinador', () => go('treinador'), 'primary lg block', 'coach'),
      btn('Escolher um modelo ou montar o meu', () => go('treinos'), 'block ghost')));
    if (!state.sessions.length) {
      const passo = (n, t) => h('div', { class: 'row' }, h('span', { class: 'setn', text: String(n) }), h('div', { class: 'grow', text: t }));
      body.push(h('div', { class: 'card col' }, h('h2', { text: 'Como funciona' }),
        passo(1, 'Monte o seu treino'),
        passo(2, 'Na academia, toque em Iniciar e marque cada série'),
        passo(3, 'Acompanhe a sua evolução e as dicas')));
    }
  } else if (!state.current) {
    const dia = plan.dias.find((d) => d.id === plan.agenda[wd]);
    if (dia) {
      const thumbs = h('div', { class: 'row gap-s' });
      for (const it of dia.itens.slice(0, 4)) { const ex = EX_POR_ID.get(it.ex); if (ex) thumbs.appendChild(h('div', { class: 'thumb mini' }, thumb(ex))); }
      const lista = h('div', { class: 'col gap-s' });
      for (const it of dia.itens.slice(0, 5)) { const ex = EX_POR_ID.get(it.ex); if (ex) lista.appendChild(h('div', { class: 'row between small' }, h('span', { class: 'ellipsis grow', text: ex.nome }), h('span', { class: 'muted nowrap', text: alvoTexto(it) }))); }
      if (dia.itens.length > 5) lista.appendChild(h('div', { class: 'tiny muted', text: `e mais ${dia.itens.length - 5}` }));
      body.push(h('div', { class: 'card hl col' },
        h('div', { class: 'row between' }, h('div', null, h('div', { class: 'tiny accent bold', text: feitoHoje ? 'TREINO DE HOJE · FEITO' : 'TREINO DE HOJE' }), h('h2', { text: dia.nome })), feitoHoje ? badge('Concluído', 'ok') : null),
        dia.foco ? h('p', { class: 'small muted', text: dia.foco }) : null,
        thumbs, lista,
        h('p', { class: 'tiny muted', text: `${plural(dia.itens.length, 'exercício', 'exercícios')} · cerca de ${duracaoEstimada(dia)} min` }),
        btn(feitoHoje ? 'Treinar de novo' : 'Iniciar treino', () => startSession(plan.id, dia.id), (feitoHoje ? '' : 'primary ') + 'lg block', 'play')));
    } else {
      const prox = proximoTreino(plan, wd);
      body.push(h('div', { class: 'card col' },
        h('div', { class: 'tiny muted bold', text: 'HOJE' }),
        h('h2', { text: 'Dia de descanso' }),
        h('p', { class: 'muted small', text: prox ? `Próximo treino: ${prox.dia.nome}, ${prox.quando}.` : 'Nenhum treino agendado. Escolha os dias na aba Treinos.' }),
        btn('Ver treinos e agenda', () => go('treinos'), 'block')));
    }
  }

  // revisão do treinador
  const rev = revisaoPendente();
  if (rev) {
    body.push(h('div', { class: 'card col' }, h('div', { class: 'row' }, h('div', { class: 'avatar' }, icon('coach')), h('div', { class: 'grow' }, h('h3', { text: 'O Treinador tem uma sugestão' }), h('p', { class: 'small muted', text: rev }))), btn('Ver sugestão', () => go('treinador'), 'primary block')));
  }

  // semana
  const feitos = semanaAtual();
  const meta = metaSemanal();
  const week = h('div', { class: 'week' });
  const ini = inicioSemana();
  for (let i = 0; i < 7; i++) {
    const d = new Date(ini); d.setDate(d.getDate() + i);
    const key = dateKey(d);
    const done = feitos.has(key);
    const planned = plan && plan.agenda[d.getDay()];
    const isToday = key === dateKey(hoje);
    week.appendChild(h('div', null, DIAS_CURTO[d.getDay()], h('div', { class: 'dot' + (done ? ' done' : planned ? ' plan' : '') + (isToday ? ' today' : ''), title: done ? 'Treino feito' : planned ? 'Treino agendado' : 'Descanso' }, done ? icon('check') : null)));
  }
  const seq = sequenciaSemanas(meta);
  body.push(h('div', { class: 'card col' },
    h('div', { class: 'row between' }, h('h2', { text: 'Sua semana' }), h('span', { class: 'small muted', text: `${feitos.size} de ${meta} ${meta === 1 ? 'treino' : 'treinos'}` })),
    week,
    seq > 0 ? h('div', { class: 'row small' }, icon('flame', 's accent'), h('span', { text: seq === 1 ? '1 semana com a meta cumprida' : `${seq} semanas seguidas com a meta cumprida` })) : null));

  // evolução: as dicas mais importantes da análise dos treinos
  if (state.sessions.length) {
    const an = analisar(state);
    const card = h('div', { class: 'card col' }, h('div', { class: 'row between' }, h('h2', { text: 'Sua evolução' }), an.suficiente ? h('span', { class: 'small muted', text: plural(an.dicas.length, 'dica', 'dicas') }) : null));
    for (const d of destaques(an.dicas, 2)) card.appendChild(dicaCard(d, true));
    card.appendChild(btn('Ver análise completa', () => go('progresso'), 'block', 'chart'));
    body.push(card);
  }

  // nutrição do dia
  if (nutriOk(state.nutri.answers)) {
    const r = calcular(state.nutri.answers);
    if (r.kcal) {
      body.push(h('button', { class: 'card click col gap-s', type: 'button', onClick: () => go('nutricao') },
        h('div', { class: 'row between' }, h('h2', { text: 'Alimentação de hoje' }), icon('right', 's muted')),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('b', { text: fmtInt(r.kcal) }), h('span', { text: 'kcal' })),
          h('div', { class: 'stat' }, h('b', { text: r.prot + ' g' }), h('span', { text: 'proteína' })),
          h('div', { class: 'stat' }, h('b', { text: String(r.agua).replace('.', ',') + ' L' }), h('span', { text: 'água' })))));
    }
  } else {
    body.push(h('button', { class: 'card click row', type: 'button', onClick: () => go('nutricao') }, h('div', { class: 'avatar nutri' }, icon('apple')), h('div', { class: 'grow' }, h('h3', { text: 'O que comer para o seu objetivo?' }), h('p', { class: 'small muted', text: 'Metas e cardápio de exemplo em 2 minutos.' })), icon('right', 's muted')));
  }

  // atalhos
  body.push(sectionTitle('Atalhos'));
  const atalhos = h('div', { class: 'card tight' });
  for (const [ic, label, path] of [['chart', 'Evolução e peso corporal', 'progresso'], ['history', 'Histórico de treinos', 'historico'], ['building', 'Minha academia (aparelhos)', 'academia'], ['settings', 'Ajustes e backup', 'ajustes'], ['book', 'Sobre, privacidade e referências', 'sobre']]) {
    atalhos.appendChild(h('button', { class: 'menu-item', type: 'button', onClick: () => go(path) }, icon(ic), h('span', { class: 'grow', text: label }), icon('right', 's muted')));
  }
  body.push(atalhos);
  return { title: 'FitCore', actions: [iconBtn('settings', 'Ajustes', () => go('ajustes'))], body };
}

function proximoTreino(plan, wd) {
  for (let i = 1; i <= 7; i++) {
    const d = (wd + i) % 7;
    const dia = plan.dias.find((x) => x.id === plan.agenda[d]);
    if (dia) return { dia, quando: i === 1 ? 'amanhã' : DIAS_LONGO[d].toLowerCase() };
  }
  return null;
}

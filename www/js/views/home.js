// Tela inicial: o treino de hoje, a semana e os atalhos.
import { h, btn, icon, iconBtn, badge, sectionTitle, DIAS_CURTO, DIAS_LONGO, dateKey, plural, fmtInt } from '../ui.js';
import { state, activePlan, update } from '../store.js';
import { go, refresh } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { thumb } from '../figure.js';
import { semanaAtual, sequenciaSemanas, inicioSemana } from '../logic/progress.js';
import { duracaoEstimada, alvoTexto } from './common.js';
import { startSession } from './session.js';
import { botaoChat } from './chat.js';
import { mostrarSemana, guardarCorridaMostrada } from './plans.js';
import { cartaoCombinado } from './combinado.js';
import { faltaPerguntar } from '../logic/combinado.js';
import { installCard } from '../install.js';
import { metaSemanal, temAgenda, dicaCard } from './history.js';
import { analisar, destaques } from '../logic/insights.js';
import { situacaoDoPlano, avisoVariacao } from './variacao.js';
import { calcular, respostasCompletas as nutriOk, contextoDasEntrevistas } from '../logic/nutrition.js';
import { planoDaSemana, resumoParaNutricao } from '../logic/corrida.js';
import { cartaoSono } from './sono.js';
import { resumoDeHoje } from '../logic/diario.js';
import { semanaEfetiva, segundaDe, podeMarcar, podeMarcarCorrida, corridaPerdidaEm, nomeDoDia } from '../logic/perdido.js';
import { botaoNaoTreinei, botaoNaoCorri, linhaNaoTreinado, linhaNaoCorrida } from './perdido.js';
import { cartaoSaude, avisoDoTreino, contarProblema } from './saude-fora.js';
import { semTreinoHoje } from '../logic/saude-fora.js';
import { itensDoDia } from '../logic/ajuste-semana.js';
import { linhaCargaInicio } from './corrida.js';

function saudacao() {
  const hora = new Date().getHours();
  return hora < 5 ? 'Boa noite' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

export function homeView() {
  guardarCorridaMostrada();
  const body = [];
  const plan = activePlan();
  const hoje = new Date();
  const wd = hoje.getDay();
  body.push(h('div', null, h('h1', { text: saudacao() + '!' }), h('p', { class: 'muted', text: `${DIAS_LONGO[wd]}, ${hoje.getDate()}/${hoje.getMonth() + 1}` })));

  const inst = installCard();
  if (inst) body.push(inst);

  // problema de saúde que não vem do treino (febre, pancada...) e muda o treino de hoje: logic/saude-fora.js
  let saudeHoje = null, semTreino = false;
  try { saudeHoje = cartaoSaude(); semTreino = semTreinoHoje(state, dateKey(hoje)); } catch { saudeHoje = null; }
  if (saudeHoje) body.push(saudeHoje);

  // treino em andamento
  if (state.current) {
    body.push(h('div', { class: 'card hl col' }, h('div', { class: 'row' }, icon('timer', 'accent'), h('div', { class: 'grow' }, h('h3', { text: 'Treino em andamento' }), h('div', { class: 'small muted', text: state.current.nome }))), btn('Continuar treino', () => go('sessao'), 'primary lg block', 'play')));
  }

  // corrida de hoje (Treinador de corrida): cartão próprio, separado da musculação
  let corridaSem = null;
  try { corridaSem = planoDaSemana(state, dateKey(hoje)); } catch { corridaSem = null; }
  const corridaHoje = corridaSem && Array.isArray(corridaSem.dias) ? corridaSem.dias[wd] : null;
  if (corridaSem && corridaSem.antesDoInicio && state.run && state.run.inicio) {
    const ini = new Date(state.run.inicio + 'T12:00:00');
    const seg = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    const n = Math.round((seg(ini).getTime() - seg(hoje).getTime()) / (7 * 86400000));
    if (n >= 1) body.push(h('div', { class: 'card row', id: 'corrida-comeca' }, icon('run', 'accent'), h('div', { class: 'grow' }, h('div', { class: 'bold', text: `Seu plano de corrida começa ${n === 1 ? 'na semana que vem' : 'em ' + n + ' semanas'}` }), h('div', { class: 'small muted', text: `${DIAS_LONGO[ini.getDay()]}, ${ini.getDate()}/${String(ini.getMonth() + 1).padStart(2, '0')}.` })), btn('Ver semana', () => { mostrarSemana(n); go('treinos'); }, 'sm')));
  }
  const hojeK = dateKey(hoje);
  const corridaNaoFeita = corridaHoje && !corridaHoje.feito ? corridaPerdidaEm(state, corridaHoje.data) : null;
  // a corrida de hoje mudou de dia pelo chat: hoje fica sem corrida, com "Mudou de dia" e o "Desfazer"
  const movidaHoje = !corridaHoje && corridaSem && Array.isArray(corridaSem.movidas) ? corridaSem.movidas[wd] : null;
  const marcaMovidaHoje = movidaHoje ? corridaPerdidaEm(state, dateKey(hoje)) : null;
  if (marcaMovidaHoje) {
    body.push(h('div', { class: 'card col' }, h('div', { class: 'tiny muted bold', text: 'CORRIDA DE HOJE' }), linhaNaoCorrida(marcaMovidaHoje, String(movidaHoje.nome || 'Corrida'), refresh)));
  } else if (corridaNaoFeita) {
    body.push(h('div', { class: 'card col' }, h('div', { class: 'tiny muted bold', text: 'CORRIDA DE HOJE' }), linhaNaoCorrida(corridaNaoFeita, String(corridaHoje.nome || 'Corrida'), refresh)));
  } else if (corridaHoje) {
    body.push(h('div', { class: 'card hl col' },
      h('div', { class: 'row between' }, h('div', null, h('div', { class: 'tiny accent bold', text: corridaHoje.feito ? 'CORRIDA DE HOJE · FEITA' : 'CORRIDA DE HOJE' }), h('h2', { text: String(corridaHoje.nome || 'Corrida') })), corridaHoje.feito ? badge('Concluída', 'ok') : null),
      corridaHoje.resumo ? h('p', { class: 'small muted', text: String(corridaHoje.resumo) }) : null,
      btn(corridaHoje.feito ? 'Ver corrida' : 'Abrir corrida', () => go('corrida/dia/' + corridaHoje.data), (corridaHoje.feito ? '' : 'primary ') + 'lg block', 'run'),
      !corridaHoje.feito && podeMarcarCorrida(state, corridaHoje.data, hojeK) ? h('div', { class: 'perdido-acoes' }, botaoNaoCorri(corridaHoje.data, refresh)) : null));
  }
  // semana puxada (logic/carga-corrida.js): a corrida de hoje ou de amanhã fica mais leve ou muda de dia
  if (corridaSem) { const lc = linhaCargaInicio(hojeK); if (lc) body.push(lc); }

  // corrida + musculação: enquanto falta dizer o que priorizar (ou se quer fortalecimento), a pergunta aparece aqui
  try { const f = faltaPerguntar(state); if (f.foco || f.fortalecimento) { const cc = cartaoCombinado({ aoMudar: () => refresh() }); if (cc) body.push(cc); } } catch { /* segue sem o cartão */ }

  // treino de hoje
  const treinosDeHoje = state.sessions.filter((s) => dateKey(new Date(s.inicio)) === dateKey(hoje));
  const treinouHoje = treinosDeHoje.length > 0;
  if (!plan) {
    if (corridaSem) {
      // já tem plano de corrida: a musculação é um convite discreto
      body.push(h('div', { class: 'card col' },
        h('h3', { text: 'Quer incluir musculação?' }),
        h('p', { class: 'small muted', text: 'Fortalecer as pernas e o tronco ajuda na corrida. O Treinador monta um plano em 2 minutos.' }),
        btn('Montar treino de musculação', () => go('treinador'), 'block', 'coach')));
    } else {
      body.push(h('div', { class: 'card hl col' },
        h('h2', { text: 'Vamos montar o seu treino?' }),
        h('p', { class: 'muted', text: 'O Treinador monta um plano para o seu objetivo em 2 minutos.' }),
        btn('Começar com o Treinador', () => go('treinador'), 'primary lg block', 'coach'),
        btn('Treinos de corrida', () => go('corrida'), 'block', 'run'),
        btn('Escolher um modelo ou montar o meu', () => go('treinos'), 'block ghost')));
    }
    if (!state.sessions.length && !corridaSem) {
      const passo = (n, t) => h('div', { class: 'row' }, h('span', { class: 'setn', text: String(n) }), h('div', { class: 'grow', text: t }));
      body.push(h('div', { class: 'card col' }, h('h2', { text: 'Como funciona' }),
        passo(1, 'Monte o seu treino'),
        passo(2, 'Na academia, toque em Iniciar e marque cada série'),
        passo(3, 'Acompanhe a sua evolução e as dicas')));
    }
  } else if (!state.current) {
    // o treino de hoje já com as marcas da semana ("Não treinei" e treinos que mudaram de dia: logic/perdido.js)
    const semEf = semanaEfetiva(plan, state.perdidos, segundaDe(hojeK));
    const efHoje = semEf[(wd + 6) % 7];
    const diaPlano = plan.dias.find((d) => d.id === efHoje.diaId);
    // mudado só nesta semana (logic/ajuste-semana.js): mostra a versão da semana
    const dia = diaPlano ? { ...diaPlano, itens: itensDoDia(state, plan.id, diaPlano.id, hojeK) } : null;
    const perdidoHoje = efHoje.perdido ? plan.dias.find((d) => d.id === efHoje.perdido.diaId) : null;
    if (perdidoHoje) {
      const prox = proximoTreino(plan, wd, semEf);
      body.push(h('div', { class: 'card col', id: 'inicio-nao-treinado' },
        h('div', { class: 'tiny muted bold', text: 'TREINO DE HOJE' }),
        linhaNaoTreinado(efHoje, perdidoHoje.nome, refresh),
        prox ? h('p', { class: 'small muted', text: `Próximo treino: ${prox.dia.nome}, ${prox.quando}.` } ) : null));
    } else if (dia) {
      const thumbs = h('div', { class: 'row gap-s' });
      for (const it of dia.itens.slice(0, 4)) { const ex = EX_POR_ID.get(it.ex); if (ex) thumbs.appendChild(h('div', { class: 'thumb mini' }, thumb(ex))); }
      const lista = h('div', { class: 'col gap-s' });
      for (const it of dia.itens.slice(0, 5)) { const ex = EX_POR_ID.get(it.ex); if (ex) lista.appendChild(h('div', { class: 'row between small' }, h('span', { class: 'ellipsis grow', text: ex.nome }), h('span', { class: 'muted nowrap', text: alvoTexto(it) }))); }
      if (dia.itens.length > 5) lista.appendChild(h('div', { class: 'tiny muted', text: `e mais ${dia.itens.length - 5}` }));
      const feitoHoje = treinosDeHoje.some((x) => x.planId === plan.id && x.diaId === dia.id);
      body.push(h('div', { class: 'card hl col' },
        h('div', { class: 'row between' }, h('div', null, h('div', { class: 'tiny accent bold', text: feitoHoje ? 'TREINO DE HOJE · FEITO' : 'TREINO DE HOJE' }), h('h2', { text: dia.nome })), feitoHoje ? badge('Concluído', 'ok') : null),
        !feitoHoje && treinouHoje ? h('p', { class: 'small muted', text: 'Você já fez outro treino hoje; este é o agendado para o dia.' }) : null,
        efHoje.veioDe ? h('p', { class: 'small', id: 'inicio-movido', text: `Veio de ${nomeDoDia(efHoje.veioDe, hojeK)}.` }) : null,
        dia.foco ? h('p', { class: 'small muted', text: dia.foco }) : null,
        thumbs, lista,
        h('p', { class: 'tiny muted', text: `${plural(dia.itens.length, 'exercício', 'exercícios')} · cerca de ${duracaoEstimada(dia)} min` }),
        (() => { try { return avisoDoTreino(); } catch { return null; } })(),
        semTreino ? null : btn(feitoHoje ? 'Treinar de novo' : 'Iniciar treino', () => startSession(plan.id, dia.id), (feitoHoje ? '' : 'primary ') + 'lg block', 'play'),
        // imprevisto ou dúvida: "Não treinei" e o chat do Treinador, discretos, na mesma linha
        h('div', { class: 'perdido-acoes' }, podeMarcar(state, hojeK, hojeK).pode ? botaoNaoTreinei(hojeK, refresh) : null, botaoChat('treinador', 'Dúvida? Pergunte', 'sm plain'))));
    } else {
      const prox = proximoTreino(plan, wd, semEf);
      const saiu = efHoje.foiPara ? plan.dias.find((d) => d.id === plan.agenda[wd]) : null;
      body.push(h('div', { class: 'card col' },
        h('div', { class: 'tiny muted bold', text: 'HOJE' }),
        h('h2', { text: 'Dia de descanso' }),
        saiu ? h('p', { class: 'small', text: `${saiu.nome} passou para ${nomeDoDia(efHoje.foiPara, hojeK)}.` }) : null,
        h('p', { class: 'muted small', text: prox ? `Próximo treino: ${prox.dia.nome}, ${prox.quando}.` : 'Nenhum treino agendado. Escolha os dias na aba Treinos.' }),
        btn('Ver treinos e agenda', () => go('treinos'), 'block')));
    }
  }

  // lembrete de backup: os dados ficam só neste aparelho; depois de alguns treinos, sugere guardar uma cópia (no máximo a cada 30 dias)
  {
    const DIA = 86400000;
    const registros = state.sessions.length + state.runs.length;
    const ha = (v) => (v ? (hoje.getTime() - Date.parse(v)) / DIA : Infinity);
    if (registros >= 5 && ha(state.ui.backupEm) > 30 && ha(state.ui.backupAdiadoEm) > 14) {
      body.push(h('div', { class: 'card col' },
        h('div', { class: 'row' }, icon('download', 'accent'), h('div', { class: 'grow' }, h('h3', { text: 'Guarde uma cópia dos seus dados' }), h('p', { class: 'small muted', text: `Seus ${registros} treinos ficam só neste aparelho. O backup protege se você trocar ou formatar o celular.` }))),
        h('div', { class: 'row' }, btn('Depois', () => { update((s) => { s.ui.backupAdiadoEm = new Date().toISOString(); }); refresh(); }, 'ghost grow'), btn('Fazer backup', () => go('ajustes'), 'primary grow', 'download'))));
    }
  }

  // hora de variar os exercícios (qualquer plano: do Treinador, de modelo ou montado à mão); as trocas ficam na aba Treinos
  if (plan && !state.current) { const av = avisoVariacao(plan, situacaoDoPlano(plan)); if (av) body.push(av); }

  // semana
  const feitos = semanaAtual();
  const meta = metaSemanal();
  const week = h('div', { class: 'week' });
  const ini = inicioSemana();
  // corridas da semana: marca pequena embaixo de cada dia (só aparece para quem tem plano de corrida ou correu na semana)
  const corridasPlan = corridaSem && Array.isArray(corridaSem.dias) ? corridaSem.dias : [];
  const diasDaSemana = new Set(); for (let i = 0; i < 7; i++) { const d = new Date(ini); d.setDate(d.getDate() + i); diasDaSemana.add(dateKey(d)); }
  const corridos = new Set(state.runs.filter((r) => diasDaSemana.has(r.data)).map((r) => r.data));
  const nCorridas = corridasPlan.filter(Boolean).length;
  const comCorrida = nCorridas > 0 || corridos.size > 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(ini); d.setDate(d.getDate() + i);
    const key = dateKey(d);
    const done = feitos.has(key);
    // com as marcas da semana: dia marcado "Não treinei" não conta como agendado; o dia que recebeu o treino conta
    const ef = plan ? semanaEfetiva(plan, state.perdidos, segundaDe(key)).find((x) => x.data === key) : null;
    const planned = !!(ef && ef.diaId);
    const isToday = key === dateKey(hoje);
    week.appendChild(h('div', null, DIAS_CURTO[d.getDay()], h('div', { class: 'dot' + (done ? ' done' : planned ? ' plan' : '') + (isToday ? ' today' : ''), role: 'img', 'aria-label': `${DIAS_LONGO[d.getDay()]}: ${done ? 'treino feito' : planned ? 'treino agendado' : ef && ef.perdido ? 'não treinado' : 'descanso'}`, title: done ? 'Treino feito' : planned ? 'Treino agendado' : ef && ef.perdido ? 'Não treinado' : 'Descanso' }, done ? icon('check') : null),
      comCorrida ? h('div', { class: 'run-mk' + (corridos.has(key) ? ' done' : corridasPlan[d.getDay()] ? ' plan' : ''), role: 'img', 'aria-label': corridos.has(key) ? 'corrida feita' : corridasPlan[d.getDay()] ? 'corrida agendada' : 'sem corrida', title: corridos.has(key) ? 'Corrida feita' : corridasPlan[d.getDay()] ? 'Corrida agendada' : 'Sem corrida' }, corridos.has(key) || corridasPlan[d.getDay()] ? icon('run') : null) : null));
  }
  // sem agenda no plano e sem os dias informados ao Treinador não há meta (o "3" seria inventado): só a contagem
  const comMeta = temAgenda() || Number(state.trainer.answers.dias) > 0;
  const seq = comMeta ? sequenciaSemanas(meta) : 0;
  const feitosTxt = `${feitos.size} ${feitos.size === 1 ? 'treino' : 'treinos'}`;
  body.push(h('div', { class: 'card col' },
    h('div', { class: 'row between' }, h('h2', { text: 'Sua semana' }), h('span', { class: 'small muted', id: 'semana-contagem', text: comCorrida ? `Musculação ${comMeta ? `${feitos.size}/${meta}` : feitos.size} · Corrida ${corridos.size}/${Math.max(nCorridas, corridos.size)}` : comMeta ? `${feitos.size} de ${meta} ${meta === 1 ? 'treino' : 'treinos'}` : `${feitosTxt} nesta semana` })),
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
    // as metas levam em conta os treinos de corrida, como na tela de Nutrição
    let resumoCorrida = null;
    try { resumoCorrida = resumoParaNutricao(state, dateKey(hoje)); } catch { resumoCorrida = null; }
    const r = calcular(state.nutri.answers, resumoCorrida, contextoDasEntrevistas(state)); // vale a resposta mais protegida entre as entrevistas
    if (r.kcal) {
      body.push(h('button', { class: 'card click col gap-s', type: 'button', onClick: () => go('nutricao') },
        h('div', { class: 'row between' }, h('h2', { text: 'Alimentação de hoje' }), icon('right', 's muted')),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('b', { text: fmtInt(r.kcal) }), h('span', { text: 'kcal' })),
          h('div', { class: 'stat' }, h('b', { text: r.prot + ' g' }), h('span', { text: 'proteína' })),
          h('div', { class: 'stat' }, h('b', { text: String(r.agua).replace('.', ',') + ' L' }), h('span', { text: 'água' }))),
        // diário: o que já foi comido hoje, contra a meta (só quando há algo registrado e o perfil recebe contagem)
        (() => { try { const d = resumoDeHoje(state, dateKey(hoje)); return d && d.n > 0 && d.frase ? h('p', { class: 'small', id: 'inicio-diario', text: `Comido hoje: ${fmtInt(Math.round(d.kcal))} kcal. ${d.frase}` }) : h('p', { class: 'small muted', text: 'Toque para anotar o que você comeu hoje.' }); } catch { return null; } })()));
    }
  } else {
    body.push(h('button', { class: 'card click row', type: 'button', onClick: () => go('nutricao') }, h('div', { class: 'avatar nutri' }, icon('apple')), h('div', { class: 'grow' }, h('h3', { text: 'O que comer para o seu objetivo?' }), h('p', { class: 'small muted', text: 'Metas e cardápio de exemplo em 2 minutos.' })), icon('right', 's muted')));
  }

  // sono: meta da noite e registro rápido
  let sono = null;
  try { sono = cartaoSono(); } catch { sono = null; }
  if (sono) body.push(sono);

  // atalhos
  body.push(sectionTitle('Atalhos'));
  const atalhos = h('div', { class: 'card tight' });
  for (const [ic, label, path] of [['chart', 'Evolução e peso corporal', 'progresso'], ['history', 'Histórico de treinos', 'historico'], ['building', 'Minha academia (aparelhos)', 'academia'], ['settings', 'Ajustes e backup', 'ajustes'], ['book', 'Sobre, privacidade e referências', 'sobre']]) {
    atalhos.appendChild(h('button', { class: 'menu-item', type: 'button', onClick: () => go(path) }, icon(ic), h('span', { class: 'grow', text: label }), icon('right', 's muted')));
  }
  // febre, pancada, corte, dor de cabeça...: o treinador avalia se muda o treino (views/saude-fora.js)
  atalhos.appendChild(h('button', { class: 'menu-item', type: 'button', 'data-acao': 'contar-saude', onClick: () => contarProblema() }, icon('heart'), h('span', { class: 'grow', text: 'Contar um problema de saúde' }), icon('right', 's muted')));
  body.push(atalhos);
  return { title: 'FitCore', actions: [iconBtn('settings', 'Ajustes', () => go('ajustes'))], body };
}

// `semEf` = a semana atual com as marcas (logic/perdido.js); depois de domingo vale a agenda
function proximoTreino(plan, wd, semEf = null) {
  for (let i = 1; i <= 7; i++) {
    const d = (wd + i) % 7;
    const nestaSemana = semEf && ((wd + 6) % 7) + i <= 6;
    const id = nestaSemana ? semEf[((wd + 6) % 7) + i].diaId : plan.agenda[d];
    const dia = plan.dias.find((x) => x.id === id);
    if (dia) return { dia, quando: i === 1 ? 'amanhã' : DIAS_LONGO[d].toLowerCase() };
  }
  return null;
}

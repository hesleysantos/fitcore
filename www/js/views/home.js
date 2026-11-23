// Tela inicial: a saudação com o nome, o resumo de hoje (o cartão completo fica na aba Treinos), a semana e os atalhos.
import { h, btn, icon, iconBtn, badge, sheet, DIAS_CURTO, DIAS_LONGO, dateKey, plural, fmtInt } from '../ui.js';
import { state, activePlan, update, limparNome } from '../store.js';
import { go, refresh } from '../router.js';
import { semanaAtual, sequenciaSemanas, inicioSemana } from '../logic/progress.js';
import { duracaoEstimada } from './common.js';
import { startSession } from './session.js';
import { mostrarSemana, guardarCorridaMostrada, abrirHoje } from './plans.js';
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
import { semanaEfetiva, segundaDe, corridaPerdidaEm, nomeDoDia } from '../logic/perdido.js';
import { linhaNaoTreinado, linhaNaoCorrida } from './perdido.js';
import { cartaoSaude, avisoDoTreino, contarProblema } from './saude-fora.js';
import { semTreinoHoje } from '../logic/saude-fora.js';
import { itensDoDia } from '../logic/ajuste-semana.js';
import { linhaCargaInicio } from './corrida.js';
import { linhasAtividades, botaoOutroTreino, linhasPlanejados } from './esportes.js';
import { botaoChat } from './chat.js';

function saudacao(hora = new Date().getHours()) {
  return hora < 5 ? 'Boa noite' : hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// "Seja bem-vindo/bem-vinda": o trato escolhido pela pessoa; sem escolha, o sexo informado na Nutrição; sem nada, neutro
function boasVindas() {
  const t = state.settings.trato || (state.nutri && state.nutri.answers && state.nutri.answers.sexo === 'f' ? 'a' : state.nutri && state.nutri.answers && state.nutri.answers.sexo === 'm' ? 'o' : 'n');
  return t === 'a' ? 'Seja bem-vinda!' : t === 'o' ? 'Seja bem-vindo!' : 'Boas-vindas!';
}

// nome e trato da saudação (também em Ajustes)
export function folhaDoNome() {
  const campo = h('input', { type: 'text', class: 'input', id: 'campo-nome', maxlength: '24', autocomplete: 'given-name', 'aria-label': 'Seu nome', placeholder: 'Seu nome', value: state.settings.nome || '' });
  let trato = state.settings.trato || '';
  const chips = h('div', { class: 'chips wrap', role: 'group', 'aria-label': 'Como saudar' });
  const OPC = [['o', 'Bem-vindo'], ['a', 'Bem-vinda'], ['n', 'Boas-vindas']];
  const desenhar = () => { chips.replaceChildren(...OPC.map(([v, t]) => h('button', { class: 'chip' + (trato === v ? ' on' : ''), type: 'button', 'aria-pressed': String(trato === v), onClick: () => { trato = v; desenhar(); } }, t))); };
  desenhar();
  const salvar = () => {
    const nome = limparNome(campo.value);
    update((s) => { s.settings.nome = nome; s.settings.trato = trato; });
    sh.close(); refresh();
  };
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') salvar(); });
  const sh = sheet({ title: 'Como quer ser chamado?', body: h('div', { class: 'col gap-s' }, campo, h('div', { class: 'small muted', text: 'Na saudação:' }), chips, h('p', { class: 'tiny muted', text: 'Fica só neste aparelho.' })),
    footer: btn('Salvar', salvar, 'primary block') });
  setTimeout(() => { try { campo.focus(); } catch { /* sem foco */ } }, 50);
}

function cabecalho(hoje) {
  const nome = state.settings.nome;
  return h('div', { class: 'hero', id: 'inicio-saudacao' },
    h('div', { class: 'grow' },
      h('div', { class: 'hero-data', text: `${DIAS_LONGO[hoje.getDay()]}, ${hoje.getDate()} de ${MESES[hoje.getMonth()]}` }),
      h('h1', { text: nome ? `${saudacao()}, ${nome}!` : `${saudacao()}!` }),
      h('p', { class: 'hero-sub', text: boasVindas() }),
      nome ? null : btn('Dizer meu nome', folhaDoNome, 'plain sm hero-nome')),
    h('button', { class: 'hero-av', type: 'button', 'aria-label': nome ? 'Mudar o seu nome' : 'Dizer o seu nome', onClick: folhaDoNome }, nome ? nome[0].toUpperCase() : icon('user')));
}

// linha do resumo de hoje: ícone, o quê, detalhe e a situação; toca e abre o cartão completo
function itemHoje({ ic, titulo, sub, selo, aoTocar, id }) {
  return h('button', { class: 'hoje-item', type: 'button', onClick: aoTocar, ...(id ? { id } : {}) },
    h('span', { class: 'hoje-ic' }, icon(ic, 's')),
    h('span', { class: 'grow col hoje-txt' }, h('span', { class: 'bold ellipsis', text: titulo }), sub ? h('span', { class: 'small muted', text: sub }) : null),
    selo || icon('right', 's muted'));
}

export function homeView() {
  guardarCorridaMostrada();
  const body = [];
  const plan = activePlan();
  const hoje = new Date();
  const wd = hoje.getDay();
  body.push(cabecalho(hoje));

  const inst = installCard();
  if (inst) body.push(inst);

  // problema de saúde que não vem do treino (febre, pancada...) e muda o treino de hoje: logic/saude-fora.js
  let saudeHoje = null, semTreino = false;
  // uma linha por problema; o detalhe abre ao tocar (contar outro fica nos atalhos)
  try { saudeHoje = cartaoSaude({ compacto: true, contar: false }); semTreino = semTreinoHoje(state, dateKey(hoje)); } catch { saudeHoje = null; }
  // no alto só o que é urgente (procurar atendimento agora); o resto desce para depois do dia e da semana
  const saudeUrgente = !!(saudeHoje && saudeHoje.querySelector('[data-nivel="urgente"]'));
  if (saudeHoje && saudeUrgente) body.push(saudeHoje);

  // treino em andamento
  if (state.current) {
    body.push(h('div', { class: 'card hl col' }, h('div', { class: 'row' }, icon('timer', 'accent'), h('div', { class: 'grow' }, h('h3', { text: 'Treino em andamento' }), h('div', { class: 'small muted', text: state.current.nome }))), btn('Continuar treino', () => go('sessao'), 'primary lg block', 'play')));
  }

  // corrida de hoje (Treinador de corrida)
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
  const movidaHoje = !corridaHoje && corridaSem && Array.isArray(corridaSem.movidas) ? corridaSem.movidas[wd] : null;
  const marcaMovidaHoje = movidaHoje ? corridaPerdidaEm(state, dateKey(hoje)) : null;
  // corrida feita hoje fora do plano (esteira, rua...): também aparece no resumo
  const extrasHoje = corridaSem && Array.isArray(corridaSem.extras) && Array.isArray(corridaSem.extras[wd]) ? corridaSem.extras[wd] : [];

  // ---------- resumo de hoje: o que tem e a situação; o cartão completo fica na aba Treinos ----------
  const linhas = [];
  const acoes = [];
  const treinosDeHoje = state.sessions.filter((s) => dateKey(new Date(s.inicio)) === hojeK);
  const treinouHoje = treinosDeHoje.length > 0;
  if (plan && !state.current) {
    const semEf = semanaEfetiva(plan, state.perdidos, segundaDe(hojeK));
    const efHoje = semEf[(wd + 6) % 7];
    const diaPlano = plan.dias.find((d) => d.id === efHoje.diaId);
    const dia = diaPlano ? { ...diaPlano, itens: itensDoDia(state, plan.id, diaPlano.id, hojeK) } : null;
    const perdidoHoje = efHoje.perdido ? plan.dias.find((d) => d.id === efHoje.perdido.diaId) : null;
    if (perdidoHoje) {
      const prox = proximoTreino(plan, wd, semEf);
      linhas.push(h('div', { class: 'col gap-s', id: 'inicio-nao-treinado' }, linhaNaoTreinado(efHoje, perdidoHoje.nome, refresh),
        prox ? h('p', { class: 'small muted', text: `Próximo treino: ${prox.dia.nome}, ${prox.quando}.` }) : null));
    } else if (dia) {
      const feitoHoje = treinosDeHoje.some((x) => x.planId === plan.id && x.diaId === dia.id);
      linhas.push(itemHoje({ ic: 'dumbbell', id: 'inicio-musculacao', titulo: `Musculação: ${dia.nome}`, sub: `${plural(dia.itens.length, 'exercício', 'exercícios')} · cerca de ${duracaoEstimada(dia)} min`, selo: feitoHoje ? badge('Feito', 'ok') : null, aoTocar: abrirHoje }));
      if (efHoje.veioDe) linhas.push(h('p', { class: 'small', id: 'inicio-movido', text: `Veio de ${nomeDoDia(efHoje.veioDe, hojeK)}.` }));
      if (!feitoHoje && treinouHoje) linhas.push(h('p', { class: 'small muted', text: 'Você já fez outro treino hoje; este é o agendado para o dia.' }));
      const av = (() => { try { return avisoDoTreino({ soAtivos: true }); } catch { return null; } })();
      if (av) linhas.push(av);
      if (!semTreino) acoes.push(btn(feitoHoje ? 'Treinar de novo' : 'Iniciar treino', () => startSession(plan.id, dia.id), feitoHoje ? 'sm grow' : 'primary grow', 'play'));
    } else if (!corridaHoje && !marcaMovidaHoje) {
      const prox = proximoTreino(plan, wd, semEf);
      const saiu = efHoje.foiPara ? plan.dias.find((d) => d.id === plan.agenda[wd]) : null;
      linhas.push(itemHoje({ ic: 'moon', id: 'inicio-descanso', titulo: 'Dia de descanso', sub: (saiu ? `${saiu.nome} passou para ${nomeDoDia(efHoje.foiPara, hojeK)}. ` : '') + (prox ? `Próximo treino: ${prox.dia.nome}, ${prox.quando}.` : 'Nenhum treino agendado. Escolha os dias na aba Treinos.'), aoTocar: abrirHoje }));
    }
  }
  if (marcaMovidaHoje) linhas.push(linhaNaoCorrida(marcaMovidaHoje, String(movidaHoje.nome || 'Corrida'), refresh));
  else if (corridaNaoFeita) linhas.push(linhaNaoCorrida(corridaNaoFeita, String(corridaHoje.nome || 'Corrida'), refresh));
  else if (corridaHoje) {
    linhas.push(itemHoje({ ic: 'run', id: 'inicio-corrida', titulo: `Corrida: ${String(corridaHoje.nome || 'Corrida')}`, sub: corridaHoje.resumo ? String(corridaHoje.resumo) : '', selo: corridaHoje.feito ? badge('Feita', 'ok') : null, aoTocar: () => go('corrida/dia/' + corridaHoje.data) }));
    if (!corridaHoje.feito) acoes.push(btn('Abrir corrida', () => go('corrida/dia/' + corridaHoje.data), (acoes.some((b) => b.classList.contains('primary')) ? '' : 'primary ') + 'grow', 'run'));
  }
  for (const x of extrasHoje) {
    const partes = [x.distKm ? String(x.distKm).replace('.', ',') + ' km' : '', x.durMin ? Math.round(x.durMin) + ' min' : ''].filter(Boolean).join(' · ');
    linhas.push(itemHoje({ ic: 'run', titulo: x.local === 'esteira' ? 'Esteira fora do plano' : 'Corrida fora do plano', sub: partes, selo: badge('Feita', 'ok'), aoTocar: () => go('corrida') }));
  }
  // outros esportes de hoje (futebol, natação...): tempo e calorias (views/esportes.js)
  const esportesHoje = linhasAtividades(hojeK, refresh);
  if (esportesHoje) linhas.push(esportesHoje);
  // esporte ou corrida a mais planejados para hoje (com "Fiz" e "Registrar")
  const planejadosHoje = linhasPlanejados(hojeK, refresh);
  if (planejadosHoje) linhas.push(planejadosHoje);
  if (linhas.length) {
    const temAlgo = (plan && !state.current) || corridaHoje || extrasHoje.length;
    body.push(h('div', { class: 'card col gap-s hoje', id: 'inicio-hoje' },
      h('div', { class: 'row between' }, h('h2', { text: 'Hoje' }), temAlgo ? btn('Ver semana', abrirHoje, 'plain sm') : null),
      ...linhas,
      acoes.length ? h('div', { class: 'row hoje-acoes' }, ...acoes) : null,
      // treinar outra coisa hoje: outro treino, corrida ou outro esporte
      // dúvida para o Treinador e treinar outra coisa hoje (outro treino, corrida ou outro esporte), discretos
      h('div', { class: 'row between outro-treino perdido-acoes' }, plan ? botaoChat('treinador', 'Dúvida? Pergunte', 'sm plain') : botaoChat('corrida', 'Dúvida? Pergunte', 'sm plain'), botaoOutroTreino(hojeK, refresh, 'plain sm', 'Outro treino'))));
  }
  const posSemana = body.length; // "Sua semana" entra logo depois do resumo de hoje
  // semana puxada (logic/carga-corrida.js): a corrida de hoje ou de amanhã fica mais leve ou muda de dia
  if (corridaSem) { const lc = linhaCargaInicio(hojeK); if (lc) body.push(lc); }

  // corrida + musculação: enquanto falta dizer o que priorizar (ou se quer fortalecimento), a pergunta aparece aqui
  try { const f = faltaPerguntar(state); if (f.foco || f.fortalecimento) { const cc = cartaoCombinado({ aoMudar: () => refresh() }); if (cc) body.push(cc); } } catch { /* segue sem o cartão */ }

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
  const corridasDaSemana = state.runs.filter((r) => diasDaSemana.has(r.data));
  const corridos = new Set(corridasDaSemana.map((r) => r.data));
  const nCorridas = corridasPlan.filter(Boolean).length;
  const comCorrida = nCorridas > 0 || corridos.size > 0;
  // cada registro conta: os do plano (um por dia planejado) e os de fora dele (esteira extra, segunda corrida no dia...)
  const feitasDoPlano = corridasPlan.filter((c) => c && c.feito).length;
  const extrasDaSemana = Math.max(0, corridasDaSemana.length - feitasDoPlano);
  const contaCorrida = nCorridas ? `Corrida ${feitasDoPlano}/${nCorridas}${extrasDaSemana ? ` + ${extrasDaSemana} extra` : ''}` : `Corrida ${corridasDaSemana.length}`;
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
  body.splice(posSemana, 0, h('div', { class: 'card col', id: 'inicio-semana' },
    h('div', null, h('h2', { text: 'Sua semana' }), h('div', { class: 'small muted', id: 'semana-contagem', text: comCorrida ? `Musculação ${comMeta ? `${feitos.size}/${meta}` : feitos.size} · ${contaCorrida}` : comMeta ? `${feitos.size} de ${meta} ${meta === 1 ? 'treino' : 'treinos'}` : `${feitosTxt} nesta semana` })),
    week,
    seq > 0 ? h('div', { class: 'row small' }, icon('flame', 's accent'), h('span', { text: seq === 1 ? '1 semana com a meta cumprida' : `${seq} semanas seguidas com a meta cumprida` })) : null));

  // saúde (febre, pancada, corte...): uma linha por problema, abaixo do dia e da semana
  if (saudeHoje && !saudeUrgente) body.push(saudeHoje);

  // evolução: as dicas mais importantes da análise dos treinos
  // (quem só corre também: a análise do aeróbico da semana usa as corridas)
  if (state.sessions.length || state.runs.length) {
    const an = analisar(state);
    const card = h('div', { class: 'card col' }, h('div', { class: 'row between' }, h('h2', { text: 'Sua evolução' }), an.suficiente ? h('span', { class: 'small muted', text: plural(an.dicas.length, 'dica', 'dicas') }) : null));
    for (const d of destaques(an.dicas, 2)) card.appendChild(dicaCard(d, true));
    card.appendChild(btn('Ver análise completa', () => go('progresso'), 'block', 'chart'));
    if (state.sessions.length || an.dicas.length) body.push(card);
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

  // atalhos: blocos pequenos, dois ou três por linha
  body.push(h('h2', { class: 'atalhos-tit', text: 'Atalhos' }));
  const atalho = (ic, label, aoTocar, extra = {}) => h('button', { class: 'atalho', type: 'button', onClick: aoTocar, ...extra }, h('span', { class: 'atalho-ic' }, icon(ic)), h('span', { text: label }));
  body.push(h('div', { class: 'atalhos' },
    atalho('chart', 'Evolução e peso', () => go('progresso')),
    atalho('history', 'Histórico', () => go('historico')),
    atalho('building', 'Minha academia', () => go('academia')),
    // febre, pancada, corte, dor de cabeça...: o treinador avalia se muda o treino (views/saude-fora.js)
    atalho('heart', 'Problema de saúde', () => contarProblema(), { 'data-acao': 'contar-saude' }),
    atalho('settings', 'Ajustes e backup', () => go('ajustes')),
    atalho('book', 'Sobre', () => go('sobre'))));
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

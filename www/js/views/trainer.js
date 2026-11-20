// Tela do Treinador virtual.
// Ordem da tela, por prioridade (plano aceito): o treino de hoje com o botão de iniciar → avisos que mudam o treino (saúde,
// dores, prioridade com a corrida, trocas pendentes) → a semana e os treinos do plano → seções fechadas (sem evolução,
// cuidados, perfil, séries por semana, como treinar) → perguntas frequentes → ações (trocas, novo treino, entrevista).
// Na proposta: o resumo, os avisos, os treinos da semana (fechados, um toque abre os exercícios) e o botão de aceitar.
import { h, btn, icon, note, badge, sectionTitle, toggle, toast, confirmSheet, plural, dateKey, uid, DIAS_CURTO, DIAS_LONGO } from '../ui.js';
import { state, update, activePlan } from '../store.js';
import { go, refresh } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { FAQ_TREINO } from '../data/knowledge.js';
import { PERGUNTAS, ROTULO, respostasCompletas, gerarPlano, perfil, volumeSemanal, imcTexto, nomeGrupo, outraVersao, avisosDoPlano, orientacaoDaDor, ajustesPorDor, aplicarTrocasDor, voltasPorDor, aplicarVoltasDor, resumoCombinado, doresDoTreino, doresPendentes, avisosBloqueio, saudeDoTreinador } from '../logic/trainer.js';
import { respostasParaEntrevista } from '../logic/saude.js';
import { comboAtual, chaveCombo, faltaPerguntar, temOsDois, temCorrida } from '../logic/combinado.js';
import { cartaoCombinado, perguntarCombinado } from './combinado.js';
import { doresAtivas, LOCAIS_DOR } from '../logic/dor.js';
import { cartaoDores } from './dor.js';
import { estagnados } from '../logic/progress.js';
import { thumb } from '../figure.js';
import { interview, faqBlock, notaObjetivo, conferirObjetivos, cartaoObjetivos, abasTreinador, cartaoLiberacao } from './coach.js';
import { treinoPara } from '../logic/objetivos.js';
import { alvoTexto, duracaoEstimada } from './common.js';
import { criarPlano } from './plans.js';
import { startSession } from './session.js';
import { situacaoDoPlano, cartaoVariacao } from './variacao.js';
import { botaoChat } from './chat.js';

let modo = 'auto'; // 'auto' | 'entrevista' | 'proposta' | 'trocas'
// exercícios que entraram no último toque em "Outra versão" (só para marcar "novo" na tela; não é gravado)
let novos = null; // { versao, dias: [Set de ids] }
// O número da versão é guardado até 9999 (store.js). As combinações se repetem a cada 12 versões; 9996 é múltiplo de 12.
const guardarVersao = (v) => v % 9996;
// dores que valem para o Treinador: as ativas, as que deixaram de contar por tempo sem resposta e as que estão em volta gradual
const doresDeHoje = () => doresDoTreino(state, dateKey(new Date()), state.trainer.answers);
// Dor de alerta (ou acima do aceitável) que deixou de contar por tempo, sem "Melhorou": o Treinador pergunta antes de
// voltar ao treino normal. Até a resposta, a região continua poupada.
function cartoesDeDorPendente(aoMudar) {
  const hoje = dateKey(new Date());
  return doresPendentes(state, hoje, state.trainer.answers).map((d) => {
    const nome = LOCAIS_DOR[d.onde].toLowerCase() + (d.lado === 'e' ? ' esquerdo' : d.lado === 'd' ? ' direito' : '');
    return h('div', { class: 'card hl col gap-s', 'data-dor-pendente': d.id },
      h('h3', { text: `Como está a dor (${nome})?` }),
      h('p', { class: 'small muted', text: `Você contou essa dor há ${d.dias} dias e não atualizou. Até responder, o Treinador continua poupando essa região.` }),
      h('div', { class: 'row par-de-botoes' },
        btn('Melhorou', () => { update((s) => { const x = s.dores.find((y) => y.id === d.id); if (x) x.fim = hoje; }); toast('Que bom! A região volta aos poucos, por 2 semanas.'); if (aoMudar) aoMudar(); refresh(); }, 'primary grow sm', 'check'),
        btn('Ainda dói', () => { update((s) => { s.dores.push({ id: 'd' + uid(), data: hoje, onde: d.onde, lado: d.lado || '', tipo: d.tipo, quando: d.quando, nivel: d.nivel, nota: typeof d.nota === 'string' ? d.nota : '', fim: '' }); }); toast('Anotado. Dor que dura semanas pede avaliação de um médico ou fisioterapeuta.'); if (aoMudar) aoMudar(); refresh(); }, 'ghost grow sm')));
  });
}
// avisos de dor que o cartão de dores não mostra (dor pendente de resposta ou em volta gradual)
const avisoDeDorForaDoCartao = (av) => !!av.dor && !doresAtivas(state, dateKey(new Date())).some((d) => d.onde === av.dor);
const MARCA_DOR = 'Adaptado para dor';
// corrida da semana e a escolha de prioridade (null para quem não corre): muda o encaixe dos treinos e tira o cardio
const corridaDeHoje = () => resumoCombinado(state, dateKey(new Date()));
const pedeFortalecimento = (c) => !!c.fortalecimento && c.fortalecimento !== 'nao';
const SEMANA = 7 * 86400000;
// respostas do Treinador com a proteção das outras entrevistas (condições, sinais e remédios marcados em qualquer uma, e a
// liberação médica só se estiver dentro dos 12 meses e cobrir tudo isso): logic/saude.js
const saudeDeHoje = () => saudeDoTreinador(state, dateKey(new Date()));
// Saúde antes do plano: de onde veio cada proteção, a liberação que precisa ser confirmada de novo e, sem plano, o porquê.
function blocoDeSaude(sd, pf, bloqueado) {
  const out = [];
  for (const av of sd.avisos) out.push(note(av.tipo, av.texto));
  if (bloqueado && pf.bloqueio === 'liberacao' && sd.liberacao !== 'falta' && sd.liberacao !== 'nao') {
    const c = cartaoLiberacao({
      estado: sd.liberacao,
      aoRenovar: () => { update((s) => { s.trainer.answers.liberado = 'sim'; s.trainer.answers.liberadoEm = dateKey(new Date()); }); toast('Liberação confirmada: vale por 12 meses.'); refresh(); },
      aoNegar: () => { update((s) => { s.trainer.answers.liberado = 'nao'; delete s.trainer.answers.liberadoEm; }); refresh(); },
      aoRefazer: () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); },
    });
    if (c) out.push(c);
  }
  if (bloqueado) for (const av of avisosBloqueio(sd.respostas)) out.push(note(av.tipo, av.texto));
  return out;
}

// cabeçalho grande só nas boas-vindas; com plano ou proposta, uma linha (o que importa aparece logo)
function cabecalho() {
  return h('div', { class: 'col' }, abasTreinador('forca'),
    h('div', { class: 'coach-hd' }, h('div', { class: 'avatar' }, icon('coach', 'l')), h('div', null, h('h2', { text: 'Treinador virtual' }), h('p', { class: 'tiny muted', text: 'Baseado em diretrizes de educação física. Não substitui um profissional.' }))));
}
// (o aviso de que não substitui um profissional fica no fim da tela: no alto, só o que se usa)
function cabecalhoCurto() {
  return h('div', { class: 'col gap-s', 'data-curto': '1' }, abasTreinador('forca'));
}
const rodapeAviso = () => h('div', { class: 'nutri-topo rodape-aviso' }, h('div', { class: 'avatar' }, icon('coach', 's')), h('p', { class: 'tiny muted', text: 'Treinador virtual. Baseado em diretrizes de educação física: não substitui um profissional.' }));
// seção que abre ao toque
const acc = (titulo, filhos, id) => h('details', { class: 'acc', id }, h('summary', { text: titulo }), h('div', null, ...filhos));
// avisos: os que mudam o que fazer (atenção e perigo) ficam à vista; os informativos vão para "Cuidados para o seu perfil"
const separarAvisos = (lista) => ({ alto: lista.filter((av) => av.tipo !== 'info'), info: lista.filter((av) => av.tipo === 'info') });
const cuidadosCard = (info) => (info.length ? acc(`Cuidados para o seu perfil (${info.length})`, info.map((av) => note(av.tipo, av.texto)), 'treinador-cuidados') : null);

// dias da semana em que cada treino cai (segunda primeiro)
const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const diasDoTreino = (agenda, id) => ORDEM.filter((wd) => agenda && agenda[wd] === id).map((wd) => DIAS_CURTO[wd]);
function listaExercicios(d, entrou) {
  const l = h('div', { class: 'col gap-s' });
  d.itens.forEach((it) => {
    const ex = EX_POR_ID.get(it.ex);
    if (!ex) return;
    l.appendChild(h('button', { class: 'row menu-item', type: 'button', onClick: () => go('exercicio/' + ex.id) },
      h('div', { class: 'thumb mini' }, thumb(ex)),
      h('span', { class: 'grow small', text: ex.nome }),
      entrou && entrou.has(it.ex) ? badge('novo', 'acc') : null,
      h('span', { class: 'small muted nowrap', text: alvoTexto(it) })));
  });
  return l;
}
// um treino da proposta: fechado, com os dias, o foco e o tempo no título; abre com os exercícios (e já aberto quando
// "Outra versão" trouxe exercícios novos para ele)
function diaCard(d, agenda, entrou) {
  const dias = diasDoTreino(agenda, d.id);
  const n = entrou ? d.itens.filter((it) => entrou.has(it.ex)).length : 0;
  return h('details', { class: 'acc treino-prop', open: n > 0, dataset: { dia: d.id } },
    h('summary', null, h('div', { class: 'grow' },
      h('div', { text: d.nome + (dias.length ? ' · ' + dias.join(', ') : '') }),
      h('div', { class: 'tiny muted resumo', text: `${d.foco ? d.foco + ' · ' : ''}${plural(d.itens.length, 'exercício', 'exercícios')} · ${duracaoEstimada(d)} min` })),
      n ? badge(plural(n, 'novo', 'novos'), 'acc') : null),
    h('div', null, listaExercicios(d, entrou), h('p', { class: 'tiny muted', text: 'Toque num exercício para ver a animação.' })));
}
function volumeCard(vol, nivel) {
  const inner = [];
  for (const g of Object.keys(vol)) {
    if (!vol[g]) continue;
    inner.push(h('div', { class: 'kv' }, h('span', { text: nomeGrupo(g) }), h('span', { text: String(vol[g]).replace('.', ',') })));
  }
  inner.push(h('p', { class: 'tiny muted', text: `Referência: 4 séries por semana já dão resultado; para hipertrofia, 10 ou mais${nivel === 1 ? ' (iniciantes evoluem com menos)' : ''}. Músculo auxiliar conta meia série.` }));
  return acc('Séries por semana em cada grupo', inner);
}
// orientações gerais num bloco só: um toque abre todas, cada uma com o seu título
const orientacoesCard = (titulo, lista) => acc(titulo, lista.flatMap(([t, txt]) => [h('h3', { class: 'orient-t', text: t }), h('p', { class: 'small', text: txt })]), 'treinador-orientacoes');
// perfil em linhas curtas (proposta e painel)
function perfilCard(a, pf, extra) {
  return acc('Seu perfil', [
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Objetivo' }), h('span', { text: ROTULO.objetivo[a.objetivo] })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Nível' }), h('span', { text: ROTULO.experiencia[a.experiencia] })),
    pf.retorno ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Parado antes de voltar' }), h('span', { text: ROTULO.pausa[a.pausa] })) : null,
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Frequência' }), h('span', { text: `${plural(pf.dias, 'dia', 'dias')} por semana · ${pf.tempo >= 75 ? 'mais de 1 h' : pf.tempo + ' min'}` })),
    // dias em que a pessoa não treina (vale também para a corrida)
    pf.bloqueados.length ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Sem treino' }), h('span', { text: pf.bloqueados.map((w) => DIAS_CURTO[w]).join(', ') })) : null,
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Local' }), h('span', { text: ROTULO.local[a.local] })),
    pf.extras.length ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Também tem' }), h('span', { text: pf.extras.map((x) => ROTULO.extras[x] || x).join(', ') })) : null,
    pf.limitacoes.length ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Cuidados' }), h('span', { text: pf.limitacoes.join(', ') })) : null,
    ...(extra || [])].filter(Boolean), 'treinador-perfil');
}
const imcLinha = (pf) => (pf.imc ? h('p', { class: 'small muted', text: `IMC: ${String(Math.round(pf.imc * 10) / 10).replace('.', ',')} (${imcTexto(pf.imc, pf.idade)}) — só uma referência.` }) : null);

function proposta() {
  const sd = saudeDeHoje();
  const a = sd.respostas;
  const versao = state.trainer.versao || 0;
  const dores = doresDeHoje();
  const comb = corridaDeHoje();
  const p = gerarPlano(a, state.gym, versao, dores, comb);
  const body = [cabecalhoCurto(), cartaoObjetivos()].filter(Boolean);
  // contar uma dor ou marcar "Melhorou" refaz a proposta (quem chama redesenha a tela)
  const dorCard = () => cartaoDores({ extra: (d) => (orientacaoDaDor(d, a) || {}).texto || '', aoMudar: () => { novos = null; } });
  if (!p) {
    // sem plano: menor de 14 anos, treino só com supervisão, ou falta a liberação médica que a triagem pede
    for (const x of blocoDeSaude(sd, perfil(a), true)) body.push(x);
    body.push(btn('Mudar respostas', () => { modo = 'entrevista'; refresh(); }, 'block'));
    return body;
  }
  const pf = p.perfil;
  for (const x of blocoDeSaude(sd, pf, false)) body.push(x);
  const avisos = separarAvisos(p.avisos.filter((av) => !av.dor || avisoDeDorForaDoCartao(av)));
  if (!p.dias.length) {
    body.push(dorCard());
    for (const c of cartoesDeDorPendente(() => { novos = null; })) body.push(c);
    for (const av of [...avisos.alto, ...avisos.info]) body.push(note(av.tipo, av.texto));
    body.push(note('warn', 'Com essas respostas e os aparelhos disponíveis não consegui montar um treino seguro. Marque mais aparelhos em “Minha academia” ou procure um profissional de educação física.'));
    body.push(btn('Mudar respostas', () => { modo = 'entrevista'; refresh(); }, 'block'));
    return body;
  }
  // 1. o resumo do plano em uma frase, e a prioridade de músculo em uma linha por músculo
  // o texto fala do plano que foi montado de fato: na gestação a dose é de saúde; depois de pausa longa, o nível desce
  const paraQue = pf.gestante ? 'manter a saúde na gestação' : ROTULO.objetivo[pf.objetivo].toLowerCase();
  const nivelTxt = pf.nunca ? 'para quem está começando' : pf.retorno >= 4 ? 'como recomeço depois da pausa' : pf.nivel < pf.nivelBase ? 'um nível abaixo do seu, por causa da pausa' : 'no nível ' + ['', 'iniciante', 'intermediário', 'avançado'][pf.nivel];
  body.push(h('div', { class: 'bubble', id: 'treinador-resumo' }, h('p', { text: `Montei um plano de ${plural(p.dias.length, 'treino', 'treinos')} por semana para ${paraQue}, ${nivelTxt}.` }),
    ...p.foco.map((x) => h('p', { class: 'small', text: x.texto })),
    h('p', { class: 'small muted', text: 'Toque num treino para ver os exercícios. Você pode editar tudo depois.' })));
  // 2. o que muda o treino: dores contadas e avisos de atenção (os informativos ficam em "Cuidados", no fim)
  const temDor = doresAtivas(state, dateKey(new Date())).length > 0;
  if (temDor) body.push(dorCard());
  for (const c of cartoesDeDorPendente(() => { novos = null; })) body.push(c);
  for (const av of avisos.alto) body.push(note(av.tipo, av.texto));
  if (p.faltando.length) body.push(note('warn', `Com os aparelhos disponíveis, não encontrei exercícios suficientes para: ${p.faltando.join(', ')}. Marque mais aparelhos em “Minha academia” ou complete esses treinos manualmente.`));
  // 3. os treinos da semana (um toque abre os exercícios) e o aceite
  body.push(sectionTitle('Os treinos da semana'));
  const marca = novos && novos.versao === versao ? novos.dias : null;
  p.dias.forEach((d, i) => body.push(diaCard(d, p.agenda, marca ? marca[i] : null)));
  let ciente = !pf.liberacao;
  const aceitar = btn('Aceitar e usar este treino', () => {
    if (!ciente) return;
    const dias = p.dias.map((d) => ({ ...d, itens: d.itens.map((i) => ({ ...i })) }));
    if (!criarPlano({ nome: 'Plano do Treinador', origem: 'treinador', dias, agenda: p.agenda, info: `Feito para: ${paraQue} · ${plural(p.dias.length, 'treino', 'treinos')} por semana.` + (pf.dor ? ` ${MARCA_DOR}: ${[...new Set(p.avisos.filter((x) => x.dor).map((x) => LOCAIS_DOR[x.dor].toLowerCase()))].join(', ')}.` : '') })) return;
    // a escolha de prioridade com que este plano foi montado fica guardada: se ela mudar, o painel propõe o ajuste
    update((s) => { const now = Date.now(); s.trainer.aceitoEm = new Date(now).toISOString(); s.trainer.revisaoEm = new Date(now + p.revisaoSemanas * SEMANA).toISOString(); s.trainer.adiadoAte = ''; s.trainer.combo = chaveCombo(comboAtual(s)); });
    modo = 'auto'; novos = null;
    toast('Treino ativado! Ele já está na aba Treinos.');
    // quem corre: falta dizer o que vem primeiro ou se quer fortalecimento? A pergunta abre aqui, no painel do Treinador
    const falta = faltaPerguntar(state);
    if (falta.foco || falta.fortalecimento) { refresh(); window.scrollTo(0, 0); perguntarCombinado({ aoMudar: () => refresh() }); return; }
    go('treinos');
  }, 'primary lg block', 'check');
  aceitar.disabled = !ciente;
  if (pf.liberacao) {
    const txt = pf.precisaLiberacao ? 'Confirmo que um médico me liberou nos últimos 12 meses e que li os avisos acima.' : 'Li o aviso de saúde acima e vou procurar liberação médica antes de começar.';
    body.push(h('div', { class: 'card row' }, h('div', { class: 'grow small', text: txt }), toggle(false, (v) => { ciente = v; aceitar.disabled = !v; }, 'Li o aviso de saúde')));
  }
  body.push(aceitar);
  // "Outra versão": procura a próxima combinação que muda de fato os exercícios (os principais e a dose ficam)
  const prox = outraVersao(a, state.gym, versao, { dores, plano: p, combinado: comb });
  body.push(h('div', { class: 'row par-de-botoes' },
    prox ? btn('Outra versão', () => {
      const antes = p.dias.map((d) => new Set(d.itens.map((i) => i.ex)));
      const v = guardarVersao(prox.versao);
      novos = { versao: v, dias: prox.plano.dias.map((d, i) => new Set(d.itens.map((x) => x.ex).filter((id) => !antes[i] || !antes[i].has(id)))) };
      update((s) => { s.trainer.versao = v; });
      toast(`Outra versão: ${plural(prox.trocados, 'exercício novo', 'exercícios novos')}. Os principais continuam.`);
      refresh();
    }, 'grow alvo', 'refresh') : null,
    btn('Mudar respostas', () => { modo = 'entrevista'; refresh(); }, 'grow ghost alvo', 'edit')));
  if (!prox) body.push(h('p', { class: 'tiny muted center', text: 'Não há outra versão: com os seus aparelhos e respostas, esta é a única combinação de exercícios.' }));
  // 4. o resto, fechado
  if (!temDor) body.push(dorCard());
  body.push(cuidadosCard(avisos.info));
  body.push(perfilCard(a, pf, [imcLinha(pf), p.focoFora.length ? h('p', { class: 'tiny muted', text: `Com este tempo de treino, priorizo até ${plural(p.foco.length, 'músculo', 'músculos')} por vez. Ficou de fora: ${p.focoFora.join(', ').toLowerCase()}.` }) : null]));
  body.push(volumeCard(p.volume, pf.nivel));
  body.push(orientacoesCard('Como seguir este treino', p.orientacoes));
  return body.filter(Boolean);
}

// ---------- painel (plano aceito) ----------
// o próximo dia com treino depois de hoje
function proximoTreino(plan, wd) {
  for (let i = 1; i <= 7; i++) {
    const d = (wd + i) % 7;
    const dia = plan.dias.find((x) => x.id === plan.agenda[d]);
    if (dia) return { dia, quando: i === 1 ? 'amanhã' : DIAS_LONGO[d].toLowerCase().replace('-feira', '') };
  }
  return null;
}
// 1. hoje: o treino do dia com o botão de iniciar, ou o descanso e o próximo treino
function cartaoHoje(plan, bloqueado) {
  const agora = new Date();
  const wd = agora.getDay();
  const dia = plan.dias.find((d) => d.id === plan.agenda[wd]);
  if (!dia) {
    const prox = proximoTreino(plan, wd);
    return h('div', { class: 'card col gap-s', id: 'treinador-hoje', dataset: { hoje: 'descanso' } },
      h('h2', { text: 'Hoje: descanso' }),
      h('p', { class: 'small muted', text: prox ? `Próximo treino: ${prox.dia.nome}, ${prox.quando}.` : 'Nenhum treino na agenda. Escolha os dias na aba Treinos.' }));
  }
  const hoje = dateKey(agora);
  const feito = state.sessions.some((x) => x.planId === plan.id && x.diaId === dia.id && dateKey(new Date(x.inicio)) === hoje);
  return h('div', { class: 'card hl col gap-s', id: 'treinador-hoje', dataset: { hoje: feito ? 'feito' : 'treino' } },
    h('div', { class: 'row between' }, h('h2', { text: `Hoje: ${dia.nome}` }), feito ? badge('Feito', 'ok') : null),
    h('p', { class: 'small muted', text: `${dia.foco ? dia.foco + ' · ' : ''}${plural(dia.itens.length, 'exercício', 'exercícios')} · cerca de ${duracaoEstimada(dia)} min` }),
    bloqueado ? null : h('div', { class: 'row par-de-botoes' },
      btn(feito ? 'Treinar de novo' : 'Iniciar', () => startSession(plan.id, dia.id), (feito ? '' : 'primary ') + 'grow alvo', 'play'),
      btn('Ver exercícios', () => go(`treino/${plan.id}/${dia.id}`), 'ghost grow alvo')));
}
// 3. a semana em uma lista curta: cada treino, os dias em que cai e o foco
function semanaCard(plan) {
  const wd = new Date().getDay();
  const lista = h('div', { class: 'list', id: 'treinador-semana' });
  for (const d of plan.dias) {
    const dias = diasDoTreino(plan.agenda, d.id);
    const hoje = plan.agenda[wd] === d.id;
    lista.appendChild(h('button', { class: 'item' + (hoje ? ' hoje' : ''), type: 'button', onClick: () => go(`treino/${plan.id}/${d.id}`) },
      h('div', { class: 'grow' }, h('div', { class: 't', text: d.nome + (dias.length ? ' · ' + dias.join(', ') : '') }), h('div', { class: 's', text: `${d.foco ? d.foco + ' · ' : ''}${plural(d.itens.length, 'exercício', 'exercícios')}` })),
      hoje ? badge('Hoje', 'acc') : icon('right', 's muted')));
  }
  return lista;
}

function painel() {
  const sd = saudeDeHoje();
  const a = sd.respostas;
  const pf = perfil(a);
  const plan = activePlan();
  const body = [cabecalhoCurto(), cartaoObjetivos()].filter(Boolean);
  const dores = doresDeHoje();
  const bloqueado = !!(pf.bloqueado && plan && plan.origem === 'treinador');
  // a saúde mudou depois do aceite (outra entrevista, liberação vencida): o aviso vem antes de tudo
  for (const x of blocoDeSaude(sd, pf, pf.bloqueado)) body.push(x);
  if (bloqueado) body.push(note('danger', 'Não use o treino abaixo até resolver o que está acima.'));
  // 1. hoje: o treino do dia e o botão de iniciar (com a saúde bloqueando, sem o botão)
  if (plan) body.push(cartaoHoje(plan, bloqueado));
  // dúvida ou imprevisto no treino: o chat do Treinador (views/chat.js)
  body.push(botaoChat('treinador', 'Perguntar ao Treinador'));

  // 2. o que muda o treino: dores, ajustes por dor, prioridade com a corrida, trocas pendentes, avisos de atenção

  // dores contadas: orientação de cada uma; ao marcar "Melhorou", os exercícios trocados voltam
  const trocadosPor = (onde) => (plan ? plan.dias.reduce((n, d) => n + d.itens.filter((it) => typeof it.nota === 'string' && it.nota.startsWith('dor:' + onde + ':')).length, 0) : 0);
  const desfazer = () => {
    const pl = activePlan();
    if (!pl) return 0;
    const lista = voltasPorDor(pl, a, doresDeHoje());
    let n = 0;
    if (lista.length) update((s) => { const x = s.plans.find((y) => y.id === pl.id); if (x) n = aplicarVoltasDor(x.dias, lista); });
    if (n) toast(`${plural(n, 'exercício voltou', 'exercícios voltaram')} ao treino.`);
    return n;
  };
  const cartaoDeDores = cartaoDores({
    extra: (d) => { const o = orientacaoDaDor(d, a); const n = trocadosPor(d.onde); return o ? o.texto + (n ? ` ${plural(n, 'exercício trocado', 'exercícios trocados')} no seu treino.` : '') : ''; },
    aoMudar: (d) => { if (!d) desfazer(); },
  });
  // com dor contada, o cartão fica aqui; sem dor, só o botão "Contar uma dor", depois da semana
  const temDor = doresAtivas(state, dateKey(new Date())).length > 0;
  if (temDor) body.push(cartaoDeDores);
  for (const c of cartoesDeDorPendente(null)) body.push(c);
  // região em volta gradual depois de uma dor de alerta que melhorou
  for (const d of dores.filter((x) => x.volta)) { const o = orientacaoDaDor(d, a); if (o) body.push(note('info', `${LOCAIS_DOR[d.onde]}: ${o.texto.charAt(0).toLowerCase() + o.texto.slice(1)}`)); }
  // corrida e musculação: o ajuste do treino quando a escolha mudou depois de o plano ser aceito
  const comb = corridaDeHoje();
  const escolha = comboAtual(state);
  if (plan && plan.origem === 'treinador' && comb && temOsDois(state) && state.trainer.combo !== chaveCombo(escolha) && (escolha.foco || pedeFortalecimento(escolha))) {
    const novo = gerarPlano(a, state.gym, state.trainer.versao || 0, dores, comb);
    const guardar = () => { update((s) => { s.trainer.combo = chaveCombo(comboAtual(s)); }); refresh(); };
    const exs = (d) => d.itens.map((i) => i.ex).sort().join(',');
    const semana = (pl) => [0, 1, 2, 3, 4, 5, 6].map((wd) => pl.dias.findIndex((d) => d.id === pl.agenda[wd])).join(',');
    const igual = !novo || !novo.dias.length || (novo.dias.length === plan.dias.length && novo.dias.every((d, i) => exs(d) === exs(plan.dias[i])) && semana(novo) === semana(plan));
    const card = h('div', { class: 'card hl col gap-s' }, h('h2', { text: 'Sua prioridade mudou' }));
    if (igual) {
      card.appendChild(h('p', { class: 'small', text: 'O seu treino já está de acordo com essa escolha: não há o que trocar.' }));
      card.appendChild(btn('Entendi', guardar, 'block', 'check'));
    } else {
      const linhas = novo.avisos.filter((x) => x.combo).map((x) => x.texto).slice(0, 3);
      for (const l of linhas.length ? linhas : ['O Treinador refez o plano com a nova escolha.']) card.appendChild(h('p', { class: 'small', text: l }));
      card.appendChild(btn('Ver o treino ajustado', () => { novos = null; modo = 'proposta'; refresh(); window.scrollTo(0, 0); }, 'primary block', 'right'));
      card.appendChild(btn('Manter o treino como está', guardar, 'block ghost'));
    }
    body.push(card);
  }
  const voltas = plan ? voltasPorDor(plan, a, dores) : [];
  if (voltas.length) {
    body.push(h('div', { class: 'card col gap-s' }, h('h3', { text: 'A dor passou?' }),
      h('p', { class: 'small muted', text: `${plural(voltas.length, 'exercício foi trocado', 'exercícios foram trocados')} por causa de uma dor que não está mais ativa.` }),
      btn('Voltar ao treino de antes', () => { desfazer(); refresh(); }, 'block', 'refresh')));
  }
  const ajustes = plan ? ajustesPorDor(plan, a, state.gym, dores) : [];
  if (ajustes.length) {
    const nome = (id) => EX_POR_ID.get(id).nome;
    const lista = (tipo) => [...new Set(ajustes.filter((x) => x.tipo === tipo).map((x) => nome(x.de)))];
    const resumo = (rotulo, nomes) => (nomes.length ? h('div', { class: 'small' }, h('span', { class: 'bold', text: rotulo + ' ' }), nomes.slice(0, 3).join(', ') + (nomes.length > 3 ? ` e mais ${nomes.length - 3}` : '') + '.') : null);
    const trocas = ajustes.filter((x) => x.tipo === 'trocar');
    const card = h('div', { class: 'card hl col' }, h('h2', { text: 'Ajustes por causa da dor' }), h('p', { class: 'small muted', text: 'Você decide. Tudo volta ao normal quando marcar “Melhorou”.' }));
    const sel = new Set(trocas.map((_, i) => i));
    trocas.forEach((t, i) => {
      const para = EX_POR_ID.get(t.para);
      card.appendChild(h('div', { class: 'row top' },
        h('div', { class: 'grow col gap-s' },
          h('div', { class: 'tiny muted bold', text: t.dia.toUpperCase() }),
          h('div', { class: 'small' }, h('span', { class: 'muted', text: 'Sai: ' }), nome(t.de)),
          h('button', { class: 'row gap-s plainlink', type: 'button', onClick: () => go('exercicio/' + para.id) }, h('div', { class: 'thumb mini' }, thumb(para)), h('span', { class: 'small bold grow', text: 'Entra: ' + para.nome })),
          h('div', { class: 'tiny muted', text: t.motivo })),
        toggle(true, (v) => { if (v) sel.add(i); else sel.delete(i); }, 'Aceitar esta troca')));
    });
    if (trocas.length) card.appendChild(btn('Aplicar as trocas marcadas', () => {
      let n = 0;
      update((s) => { const x = s.plans.find((y) => y.id === plan.id); if (x) n = aplicarTrocasDor(x.dias, trocas.filter((_, i) => sel.has(i))); });
      toast(n ? plural(n, 'exercício trocado', 'exercícios trocados') : 'Nenhuma troca aplicada');
      refresh();
    }, 'primary block', 'check'));
    const fora = resumo('Fique sem fazer até melhorar:', lista('pular'));
    const leve = resumo('Faça mais leve:', lista('aliviar'));
    if (fora) card.appendChild(fora);
    if (leve) card.appendChild(leve);
    body.push(card);
  }

  // hora de variar (prazo ou exercício travado) e as trocas pedidas agora: o mesmo cartão da aba Treinos (views/variacao.js)
  const sitVar = plan && !bloqueado ? situacaoDoPlano(plan, modo === 'trocas') : null;
  const cartaoVar = sitVar ? cartaoVariacao(plan, sitVar, { forcar: modo === 'trocas', aoFechar: () => { modo = 'auto'; } }) : null;
  if (cartaoVar) body.push(cartaoVar);

  // Avisos e orientações do perfil, sem as dores: o que as dores mudam no treino ATIVO está no cartão de ajustes, acima.
  // (Com as dores, os avisos falariam de um plano novo — "este plano ficou sem..." —, que não é o que a pessoa está usando.)
  // (O mesmo vale para os avisos do encaixe com a corrida: eles aparecem na proposta, não aqui.)
  // Os de atenção ficam à vista; os informativos, em "Cuidados para o seu perfil".
  const pBase = gerarPlano(a, state.gym, state.trainer.versao || 0, null, comb);
  const p0 = dores.length ? gerarPlano(a, state.gym, state.trainer.versao || 0, dores, comb) : pBase;
  const lista = pBase ? pBase.avisos.filter((av) => !av.combo) : [];
  // treino sem cardio de quem tinha plano de corrida e não tem mais: o cardio volta num treino novo
  if (plan && plan.origem === 'treinador' && !comb && !temCorrida(state) && Object.keys(state.run.answers || {}).length && pBase && pBase.minCardio > 0 && !plan.dias.some((d) => d.itens.some((it) => (EX_POR_ID.get(it.ex) || {}).registro === 'minutos'))) lista.push({ tipo: 'info', texto: 'Este treino está sem cardio e você não tem plano de corrida ativo. Para o cardio voltar, monte um novo treino.' });
  // avisos dos exercícios que a pessoa pôs no treino à mão (ex.: testar a mesa antes da remada sob a mesa)
  if (plan) lista.push(...avisosDoPlano(plan.dias));
  // plano que foi montado poupando uma região dolorida, quando a dor já não pede isso
  if (plan && p0 && !p0.perfil.dor && typeof plan.info === 'string' && plan.info.includes(MARCA_DOR)) lista.push({ tipo: 'info', texto: 'Este treino foi montado poupando uma região dolorida. Como a dor passou, você pode montar um novo treino completo.' });
  const avisos = separarAvisos(lista);
  for (const av of avisos.alto) body.push(note(av.tipo, av.texto));

  // 3. a semana e os treinos do plano; a escolha com a corrida; "Contar uma dor"
  if (plan) { body.push(sectionTitle('Seu treino')); body.push(semanaCard(plan)); }
  const cc = cartaoCombinado({ aoMudar: () => refresh() });
  if (cc) body.push(cc);
  if (!temDor) body.push(cartaoDeDores);

  // 4. seções fechadas: sem evolução, cuidados, perfil, séries por semana, como treinar
  const est = estagnados(plan).map((id) => EX_POR_ID.get(id)).filter(Boolean);
  if (est.length) {
    body.push(acc(`Exercícios sem evolução (${est.length})`, [h('p', { class: 'small muted', text: 'Marca parada há 3 treinos. Baixe a carga uns 10% e suba de novo, ou troque o exercício.' }),
      ...est.slice(0, 4).map((ex) => h('button', { class: 'menu-item', type: 'button', onClick: () => go('exercicio/' + ex.id) }, icon('swap'), h('span', { class: 'grow', text: ex.nome }), icon('right', 's muted')))], 'treinador-estagnados'));
  }
  body.push(cuidadosCard(avisos.info));
  body.push(perfilCard(a, pf, [sitVar && !sitVar.devido ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Hora de variar' }), h('span', { text: sitVar.faltam ? `em ${plural(sitVar.faltam, 'semana', 'semanas')} de treino` : 'agora' })) : null]));
  if (plan) body.push(volumeCard(volumeSemanal(plan.dias), pf.nivel));
  if (pBase) body.push(orientacoesCard('Como treinar', pBase.orientacoes));

  // 5. perguntas frequentes e, no fim, as ações sobre o plano
  body.push(faqBlock(FAQ_TREINO, 'Pergunte ao Treinador', 'Ex.: descanso, falha, joelho, cardio'));
  body.push(h('div', { class: 'col' },
    plan ? btn('Sugerir trocas de exercícios agora', () => { modo = 'trocas'; refresh(); window.scrollTo(0, 0); }, 'block', 'swap') : null,
    btn('Montar um novo treino', async () => {
      const ok = !plan || await confirmSheet({ title: 'Montar um novo treino?', text: 'Crio um novo plano com as suas respostas. O atual fica guardado em “Outros planos”.', okLabel: 'Montar' });
      if (!ok) return;
      prepararNovo();
      modo = 'proposta'; refresh(); window.scrollTo(0, 0);
    }, 'block', 'refresh'),
    btn('Refazer a entrevista', () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); }, 'block ghost', 'edit')));
  return body.filter(Boolean);
}

// "Montar um novo treino": a proposta abre na próxima versão que seja diferente do treino atual (se existir)
function prepararNovo() {
  const plan = activePlan();
  const prox = plan ? outraVersao(saudeDeHoje().respostas, state.gym, state.trainer.versao || 0, { dores: doresDeHoje(), plano: plan, combinado: corridaDeHoje() }) : null;
  if (prox) update((s) => { s.trainer.versao = guardarVersao(prox.versao); });
  novos = null;
}
// Abre o Treinador já num modo, vindo do chat (views/chat.js): 'entrevista' (mudar as respostas), 'trocas' (sugerir
// trocas de exercícios) ou 'novo' (a proposta de um treino novo). Nada vale antes de a pessoa aceitar na tela.
export function abrirNoTreinador(qual) {
  if (qual === 'novo') { prepararNovo(); modo = 'proposta'; } else modo = qual === 'trocas' ? 'trocas' : 'entrevista';
  go('treinador');
  window.scrollTo(0, 0);
}
export function trainerView() {
  const a = state.trainer.answers;
  const completo = respostasCompletas(a);
  if (modo === 'entrevista' || !completo) {
    if (modo !== 'entrevista' && !Object.keys(a).length) {
      // boas-vindas
      return {
        title: 'Treinador',
        body: [cabecalho(),
          h('div', { class: 'bubble' }, h('p', { text: 'Olá! Eu monto uma sugestão de treino a partir das suas respostas.' }), h('p', { class: 'small muted', text: `São até ${PERGUNTAS.length} perguntas rápidas, uns 2 minutos. As respostas ficam só neste aparelho.` })),
          btn('Começar', () => { modo = 'entrevista'; refresh(); }, 'primary lg block', 'play'),
          h('div', { class: 'mt' }), faqBlock(FAQ_TREINO, 'Pergunte ao Treinador', 'Ex.: descanso, falha, joelho, cardio')],
      };
    }
    // as respostas guardadas, mais o que as outras entrevistas disseram sobre a saúde (a pessoa confere e desmarca)
    const pre = respostasParaEntrevista('treinador', state);
    const n = state.nutri.answers;
    for (const k of ['idade', 'peso', 'altura']) if (pre[k] == null) { const v = typeof state.run.answers[k] === 'number' ? state.run.answers[k] : n[k]; if (typeof v === 'number') pre[k] = v; }
    // o objetivo começa igual ao da alimentação (o usuário pode trocar)
    if (pre.objetivo == null && treinoPara(n.objetivo)) pre.objetivo = treinoPara(n.objetivo);
    // dias sem treino: o padrão é "Nenhum" (treina em qualquer dia); respostas antigas, sem a pergunta, também
    if (!Array.isArray(pre.semTreino) || !pre.semTreino.length) pre.semTreino = ['nenhum'];
    return {
      title: 'Treinador', body: [interview({
        perguntas: PERGUNTAS, respostas: pre, base: a, notas: { objetivo: notaObjetivo('treino') },
        onDone: (r) => { update((s) => { s.trainer.answers = r; s.trainer.aceitoEm = ''; s.trainer.revisaoEm = ''; s.trainer.adiadoAte = ''; }); modo = 'proposta'; refresh(); window.scrollTo(0, 0); conferirObjetivos('treino'); },
        onCancel: () => { modo = 'auto'; refresh(); },
      })],
    };
  }
  if (modo === 'proposta' || !state.trainer.aceitoEm) return { title: 'Treinador', body: proposta() };
  const corpo = painel();
  return { title: 'Treinador', body: corpo[0] && corpo[0].dataset && corpo[0].dataset.curto ? [...corpo, rodapeAviso()] : corpo };
}

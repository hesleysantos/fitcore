// Tela do Treinador virtual.
import { h, btn, icon, note, badge, sectionTitle, toggle, toast, confirmSheet, plural, fmtDate, dateKey, uid } from '../ui.js';
import { state, update, activePlan } from '../store.js';
import { go, refresh } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { FAQ_TREINO } from '../data/knowledge.js';
import { PERGUNTAS, ROTULO, respostasCompletas, gerarPlano, sugerirTrocas, perfil, volumeSemanal, imcTexto, nomeGrupo, outraVersao, avisosDoPlano, orientacaoDaDor, ajustesPorDor, aplicarTrocasDor, voltasPorDor, aplicarVoltasDor, resumoCombinado, doresDoTreino, doresPendentes, avisosBloqueio, saudeDoTreinador } from '../logic/trainer.js';
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

export function revisaoPendente() {
  const t = state.trainer;
  if (!t.aceitoEm || !t.revisaoEm || !activePlan()) return '';
  const now = Date.now();
  if (now < Date.parse(t.revisaoEm)) return '';
  if (t.adiadoAte && now < Date.parse(t.adiadoAte)) return '';
  const semanas = Math.max(1, Math.round((now - Date.parse(t.aceitoEm)) / SEMANA));
  return `Você segue o mesmo treino há ${plural(semanas, 'semana', 'semanas')}. Sugiro trocar alguns exercícios auxiliares para variar o estímulo.`;
}

function cabecalho() {
  return h('div', { class: 'col' }, abasTreinador('forca'),
    h('div', { class: 'coach-hd' }, h('div', { class: 'avatar' }, icon('coach', 'l')), h('div', null, h('h2', { text: 'Treinador virtual' }), h('p', { class: 'tiny muted', text: 'Baseado em diretrizes de educação física. Não substitui um profissional.' }))));
}

function diaCard(d, entrou) {
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
  return h('div', { class: 'card col gap-s' }, h('h3', { text: d.nome }), h('div', { class: 'tiny muted', text: `${d.foco} · cerca de ${duracaoEstimada(d)} min` }), l);
}
function volumeCard(vol, nivel) {
  const inner = h('div');
  for (const g of Object.keys(vol)) {
    if (!vol[g]) continue;
    inner.appendChild(h('div', { class: 'kv' }, h('span', { text: nomeGrupo(g) }), h('span', { text: String(vol[g]).replace('.', ',') })));
  }
  inner.appendChild(h('p', { class: 'tiny muted', text: `Referência: 4 séries por semana já dão resultado; para hipertrofia, 10 ou mais${nivel === 1 ? ' (iniciantes evoluem com menos)' : ''}. Músculo auxiliar conta meia série.` }));
  return h('details', { class: 'acc' }, h('summary', { text: 'Séries por semana em cada grupo' }), inner);
}
function orientacoesCard(lista) {
  const wrap = h('div', { class: 'col gap-s' });
  for (const [t, txt] of lista) wrap.appendChild(h('details', { class: 'acc' }, h('summary', { text: t }), h('div', null, h('p', { text: txt }))));
  return wrap;
}

function proposta() {
  const sd = saudeDeHoje();
  const a = sd.respostas;
  const versao = state.trainer.versao || 0;
  const dores = doresDeHoje();
  const comb = corridaDeHoje();
  const p = gerarPlano(a, state.gym, versao, dores, comb);
  const body = [cabecalho(), cartaoObjetivos()].filter(Boolean);
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
  if (!p.dias.length) {
    body.push(dorCard());
    for (const c of cartoesDeDorPendente(() => { novos = null; })) body.push(c);
    for (const av of p.avisos) if (!av.dor || avisoDeDorForaDoCartao(av)) body.push(note(av.tipo, av.texto));
    body.push(note('warn', 'Com essas respostas e os aparelhos disponíveis não consegui montar um treino seguro. Marque mais aparelhos em “Minha academia” ou procure um profissional de educação física.'));
    body.push(btn('Mudar respostas', () => { modo = 'entrevista'; refresh(); }, 'block'));
    return body;
  }
  // o texto fala do plano que foi montado de fato: na gestação a dose é de saúde; depois de pausa longa, o nível desce
  const paraQue = pf.gestante ? 'manter a saúde na gestação' : ROTULO.objetivo[pf.objetivo].toLowerCase();
  const nivelTxt = pf.nunca ? 'para quem está começando' : pf.retorno >= 4 ? 'como recomeço depois da pausa' : pf.nivel < pf.nivelBase ? 'um nível abaixo do seu, por causa da pausa' : 'no nível ' + ['', 'iniciante', 'intermediário', 'avançado'][pf.nivel];
  body.push(h('div', { class: 'bubble' }, h('p', { text: `Montei um plano de ${plural(p.dias.length, 'treino', 'treinos')} por semana para ${paraQue}, ${nivelTxt}.` }), h('p', { class: 'small muted', text: 'Toque num exercício para ver a animação. Você pode editar tudo depois.' })));
  // prioridade de músculo: o que mudou, em uma linha por músculo
  if (p.foco.length) {
    body.push(h('div', { class: 'card col gap-s' }, h('div', { class: 'tiny muted bold', text: 'PRIORIDADE' }),
      ...p.foco.map((x) => h('div', { class: 'small', text: x.texto })),
      p.focoFora.length ? h('div', { class: 'tiny muted', text: `Com este tempo de treino, priorizo até ${plural(p.foco.length, 'músculo', 'músculos')} por vez. Ficou de fora: ${p.focoFora.join(', ').toLowerCase()}.` }) : null));
  }
  body.push(dorCard());
  for (const c of cartoesDeDorPendente(() => { novos = null; })) body.push(c);
  for (const av of p.avisos) if (!av.dor || avisoDeDorForaDoCartao(av)) body.push(note(av.tipo, av.texto));
  if (p.faltando.length) body.push(note('warn', `Com os aparelhos disponíveis, não encontrei exercícios suficientes para: ${p.faltando.join(', ')}. Marque mais aparelhos em “Minha academia” ou complete esses treinos manualmente.`));
  if (pf.imc) body.push(h('p', { class: 'small muted', text: `IMC: ${String(Math.round(pf.imc * 10) / 10).replace('.', ',')} (${imcTexto(pf.imc, pf.idade)}) — só uma referência.` }));
  const marca = novos && novos.versao === versao ? novos.dias : null;
  p.dias.forEach((d, i) => body.push(diaCard(d, marca ? marca[i] : null)));
  body.push(volumeCard(p.volume, pf.nivel));
  body.push(sectionTitle('Como seguir este treino'));
  body.push(orientacoesCard(p.orientacoes));
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
    }, 'grow', 'refresh') : null,
    btn('Mudar respostas', () => { modo = 'entrevista'; refresh(); }, 'grow ghost', 'edit')));
  if (!prox) body.push(h('p', { class: 'tiny muted center', text: 'Não há outra versão: com os seus aparelhos e respostas, esta é a única combinação de exercícios.' }));
  return body;
}

function painel() {
  const sd = saudeDeHoje();
  const a = sd.respostas;
  const pf = perfil(a);
  const plan = activePlan();
  const body = [cabecalho(), cartaoObjetivos()].filter(Boolean);
  const dores = doresDeHoje();
  // a saúde mudou depois do aceite (outra entrevista, liberação vencida): o aviso vem antes de tudo
  for (const x of blocoDeSaude(sd, pf, pf.bloqueado)) body.push(x);
  if (pf.bloqueado && plan && plan.origem === 'treinador') body.push(note('danger', 'Não use o treino abaixo até resolver o que está acima.'));

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
  body.push(cartaoDores({
    extra: (d) => { const o = orientacaoDaDor(d, a); const n = trocadosPor(d.onde); return o ? o.texto + (n ? ` ${plural(n, 'exercício trocado', 'exercícios trocados')} no seu treino.` : '') : ''; },
    aoMudar: (d) => { if (!d) desfazer(); },
  }));
  for (const c of cartoesDeDorPendente(null)) body.push(c);
  // região em volta gradual depois de uma dor de alerta que melhorou
  for (const d of dores.filter((x) => x.volta)) { const o = orientacaoDaDor(d, a); if (o) body.push(note('info', `${LOCAIS_DOR[d.onde]}: ${o.texto.charAt(0).toLowerCase() + o.texto.slice(1)}`)); }
  // corrida e musculação: a escolha, e o ajuste do treino quando ela mudou depois de o plano ser aceito
  const comb = corridaDeHoje();
  const cc = cartaoCombinado({ aoMudar: () => refresh() });
  if (cc) body.push(cc);
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

  // sugestão de troca (rotação)
  const pend = revisaoPendente();
  if ((pend || modo === 'trocas') && plan) {
    const trocas = sugerirTrocas(plan, a, state.gym, 2, dores);
    const card = h('div', { class: 'card hl col' }, h('h2', { text: 'Hora de variar o treino' }), h('p', { class: 'small muted', text: pend || 'Trocas sugeridas agora. Os exercícios principais continuam.' }));
    if (!trocas.length) {
      card.appendChild(note('info', 'Não encontrei alternativas com os seus aparelhos. O treino pode continuar como está.'));
    } else {
      const sel = new Set(trocas.map((_, i) => i));
      trocas.forEach((t, i) => {
        const de = EX_POR_ID.get(t.de), para = EX_POR_ID.get(t.para);
        card.appendChild(h('div', { class: 'row top' },
          h('div', { class: 'grow col gap-s' },
            h('div', { class: 'tiny muted bold', text: t.dia.toUpperCase() }),
            h('div', { class: 'small' }, h('span', { class: 'muted', text: 'Sai: ' }), de.nome),
            h('button', { class: 'row gap-s plainlink', type: 'button', onClick: () => go('exercicio/' + para.id) }, h('div', { class: 'thumb mini' }, thumb(para)), h('span', { class: 'small bold grow', text: 'Entra: ' + para.nome }))),
          toggle(true, (v) => { if (v) sel.add(i); else sel.delete(i); }, 'Aceitar esta troca')));
      });
      card.appendChild(btn('Aplicar as trocas marcadas', () => {
        const aplicar = trocas.filter((_, i) => sel.has(i));
        update((s) => {
          const p = s.plans.find((x) => x.id === plan.id);
          if (p) for (const t of aplicar) { const d = p.dias.find((x) => x.id === t.diaId); if (d && d.itens[t.idx] && d.itens[t.idx].ex === t.de) d.itens[t.idx] = { ...d.itens[t.idx], ex: t.para }; }
          const now = Date.now();
          s.trainer.revisaoEm = new Date(now + (pf.nivel === 1 ? 8 : 6) * SEMANA).toISOString();
          s.trainer.adiadoAte = '';
          s.trainer.versao = (s.trainer.versao || 0) + 1;
        });
        modo = 'auto';
        toast(aplicar.length ? `${plural(aplicar.length, 'exercício trocado', 'exercícios trocados')}` : 'Nenhuma troca aplicada');
        refresh();
      }, 'primary block', 'check'));
    }
    card.appendChild(h('div', { class: 'row' },
      btn('Agora não', () => { update((s) => { s.trainer.adiadoAte = new Date(Date.now() + 2 * SEMANA).toISOString(); }); modo = 'auto'; toast('Combinado. Lembro você daqui a 2 semanas.'); refresh(); }, 'grow ghost'),
      btn('Manter meu treino', () => { update((s) => { s.trainer.revisaoEm = new Date(Date.now() + (pf.nivel === 1 ? 8 : 6) * SEMANA).toISOString(); s.trainer.adiadoAte = ''; }); modo = 'auto'; toast('Treino mantido.'); refresh(); }, 'grow ghost')));
    body.push(card);
  }

  // exercícios sem evolução
  const est = estagnados(plan).map((id) => EX_POR_ID.get(id)).filter(Boolean);
  if (est.length) {
    const card = h('div', { class: 'card col' }, h('h3', { text: 'Exercícios sem evolução' }), h('p', { class: 'small muted', text: 'Marca parada há 3 treinos. Baixe a carga uns 10% e suba de novo, ou troque o exercício.' }));
    for (const ex of est.slice(0, 4)) card.appendChild(h('button', { class: 'menu-item', type: 'button', onClick: () => go('exercicio/' + ex.id) }, icon('swap'), h('span', { class: 'grow', text: ex.nome }), icon('right', 's muted')));
    body.push(card);
  }

  // perfil
  const resumo = h('div', { class: 'card col gap-s' }, h('h3', { text: 'Seu perfil' }),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Objetivo' }), h('span', { text: ROTULO.objetivo[a.objetivo] })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Nível' }), h('span', { text: ROTULO.experiencia[a.experiencia] })),
    pf.retorno ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Parado antes de voltar' }), h('span', { text: ROTULO.pausa[a.pausa] })) : null,
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Frequência' }), h('span', { text: `${plural(pf.dias, 'dia', 'dias')} por semana · ${pf.tempo >= 75 ? 'mais de 1 h' : pf.tempo + ' min'}` })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Local' }), h('span', { text: ROTULO.local[a.local] })),
    pf.extras.length ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Também tem' }), h('span', { text: pf.extras.map((x) => ROTULO.extras[x] || x).join(', ') })) : null,
    pf.limitacoes.length ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Cuidados' }), h('span', { text: pf.limitacoes.join(', ') })) : null,
    state.trainer.revisaoEm ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Próxima revisão' }), h('span', { text: fmtDate(state.trainer.revisaoEm, true) })) : null);
  body.push(resumo);
  // Avisos e orientações do perfil, sem as dores: o que as dores mudam no treino ATIVO está no cartão de ajustes, acima.
  // (Com as dores, os avisos falariam de um plano novo — "este plano ficou sem..." —, que não é o que a pessoa está usando.)
  // (O mesmo vale para os avisos do encaixe com a corrida: eles aparecem na proposta, não aqui.)
  const pBase = gerarPlano(a, state.gym, state.trainer.versao || 0, null, comb);
  const p0 = dores.length ? gerarPlano(a, state.gym, state.trainer.versao || 0, dores, comb) : pBase;
  if (pBase) for (const av of pBase.avisos) if (!av.combo) body.push(note(av.tipo, av.texto));
  // treino sem cardio de quem tinha plano de corrida e não tem mais: o cardio volta num treino novo
  if (plan && plan.origem === 'treinador' && !comb && !temCorrida(state) && Object.keys(state.run.answers || {}).length && pBase && pBase.minCardio > 0 && !plan.dias.some((d) => d.itens.some((it) => (EX_POR_ID.get(it.ex) || {}).registro === 'minutos'))) body.push(note('info', 'Este treino está sem cardio e você não tem plano de corrida ativo. Para o cardio voltar, monte um novo treino.'));
  // avisos dos exercícios que a pessoa pôs no treino à mão (ex.: testar a mesa antes da remada sob a mesa)
  if (plan) for (const av of avisosDoPlano(plan.dias)) body.push(note(av.tipo, av.texto));
  // plano que foi montado poupando uma região dolorida, quando a dor já não pede isso
  if (plan && p0 && !p0.perfil.dor && typeof plan.info === 'string' && plan.info.includes(MARCA_DOR)) body.push(note('info', 'Este treino foi montado poupando uma região dolorida. Como a dor passou, você pode montar um novo treino completo.'));

  body.push(h('div', { class: 'col' },
    plan ? btn('Sugerir trocas de exercícios agora', () => { modo = 'trocas'; refresh(); window.scrollTo(0, 0); }, 'block', 'swap') : null,
    btn('Montar um novo treino', async () => {
      const ok = !plan || await confirmSheet({ title: 'Montar um novo treino?', text: 'Crio um novo plano com as suas respostas. O atual fica guardado em “Outros planos”.', okLabel: 'Montar' });
      if (!ok) return;
      // abre a proposta na próxima versão que seja diferente do treino atual (se existir)
      const prox = plan ? outraVersao(a, state.gym, state.trainer.versao || 0, { dores, plano: plan, combinado: comb }) : null;
      if (prox) update((s) => { s.trainer.versao = guardarVersao(prox.versao); });
      novos = null;
      modo = 'proposta'; refresh(); window.scrollTo(0, 0);
    }, 'block', 'refresh'),
    btn('Refazer a entrevista', () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); }, 'block ghost', 'edit')));

  if (plan) body.push(volumeCard(volumeSemanal(plan.dias), pf.nivel));
  if (pBase) { body.push(sectionTitle('Como treinar')); body.push(orientacoesCard(pBase.orientacoes)); }
  body.push(faqBlock(FAQ_TREINO, 'Pergunte ao Treinador', 'Ex.: descanso, falha, joelho, cardio'));
  return body;
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
    return {
      title: 'Treinador', body: [interview({
        perguntas: PERGUNTAS, respostas: pre, base: a, notas: { objetivo: notaObjetivo('treino') },
        onDone: (r) => { update((s) => { s.trainer.answers = r; s.trainer.aceitoEm = ''; s.trainer.revisaoEm = ''; s.trainer.adiadoAte = ''; }); modo = 'proposta'; refresh(); window.scrollTo(0, 0); conferirObjetivos('treino'); },
        onCancel: () => { modo = 'auto'; refresh(); },
      })],
    };
  }
  if (modo === 'proposta' || !state.trainer.aceitoEm) return { title: 'Treinador', body: proposta() };
  return { title: 'Treinador', body: painel() };
}

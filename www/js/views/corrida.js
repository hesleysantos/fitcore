// Telas do Treinador de corrida: entrevista, proposta, painel do plano e o treino de cada dia (com cronômetro guiado e registro).
import { h, btn, icon, note, badge, sectionTitle, toggle, toast, confirmSheet, stepper, parseNum, plural, dateKey, fmtClock, uid, DIAS_CURTO, DIAS_LONGO, ajuda, comAjuda } from '../ui.js';
import { state, update } from '../store.js';
import { go, refresh } from '../router.js';
import { interview, abasTreinador, cartaoLiberacao } from './coach.js';
import { respostasParaEntrevista } from '../logic/saude.js';
import { diasSemCorrida, aplicarDiasNosTreinos } from '../logic/dias-livres.js';
import { cartaoDores } from './dor.js';
import { barChart } from './charts.js';
import { keepAwake, unlockAudio, beep, tocarAlerta, vibrate } from '../device.js';
import { buscarFaq } from '../data/knowledge.js';
import { REFS_CORRIDA, FAQ_CORRIDA, TIPOS_TREINO, FONTES_TELA } from '../data/corrida.js';
import {
  PERGUNTAS, ROTULO, respostasCompletas, gerarPlano, planoAtual, planoDaSemana, treinoDoDia, avisosBloqueio, inicioPara, diasDeForca, evolucao, alertas, naoMedeDe, podeTodoDiaDe, dicas,
  efeitoDaDor, orientacaoDor, expandirBlocos, textoBloco, limparRegistro, MAX_REGISTROS, fmtRitmo, fmtFaixa, fmtKm, fmtTempo, fmtDia, somaDias, diaValido, diasEntre,
  retomarPlano, diaLocal, segundaDe, planejadoDe, analiseDoRegistro, analiseRecente, guardarDoDia, perfil, saudeDaCorrida,
  MAX_DORES_REGISTRO, MUSCULO_CORRIDA, soDorMuscularLeve, etapasDe,
} from '../logic/corrida.js';
import { faltaPerguntar } from '../logic/combinado.js';
import { cartaoCombinado, perguntarCombinado } from './combinado.js';
import { LOCAIS_DOR, doresAtivas, limparDor, MAX_DORES } from '../logic/dor.js';
import { botaoChat } from './chat.js';
import { podeNaEsteira, versaoNaEsteira, naEsteira, marcarEsteira, etapasNaEsteira } from '../logic/esteira.js';
import { podeMarcarCorrida, corridaPerdidaEm, reajustarDepoisDaCorrida } from '../logic/perdido.js';
import { botaoNaoCorri, linhaNaoCorrida } from './perdido.js';
import { cargaDaSemana, cargaDoDia, aplicarCarga, desfazerCarga } from '../logic/carga-corrida.js';

let modo = 'auto'; // 'auto' | 'entrevista' | 'proposta'
const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const hojeKey = () => dateKey(new Date());
const virgula = (n) => String(n).replace('.', ',');
// Guarda o treino que o plano mostra hoje e nos próximos dias da semana (e o degrau de ritmo já concedido): os ajustes só
// valem de hoje em diante, e a análise de um dia que passou tem de usar o que a pessoa viu. Fora do desenho da tela.
let guardando = false;
function guardarMostrado() {
  if (guardando) return;
  guardando = true;
  queueMicrotask(() => {
    guardando = false;
    let g = null;
    try { g = guardarDoDia(state, hojeKey()); } catch { g = null; }
    if (g) update((s) => { s.run.mostrados = g.mostrados; s.run.degrau = g.degrau; });
  });
}
const perfilAtual = () => { try { return perfil(state.run.answers); } catch { return null; } };

// ---------- peças ----------
function cabecalho() {
  return h('div', { class: 'col' }, abasTreinador('corrida'),
    h('div', { class: 'coach-hd' }, h('div', { class: 'avatar' }, icon('run', 'l')), h('div', null, h('h2', { text: 'Treinador de corrida' }), h('p', { class: 'tiny muted', text: 'Baseado em estudos de treinamento. Não substitui um profissional.' }))));
}
// com proposta ou plano, o cabeçalho cabe em uma linha: o treino de hoje aparece logo
// (o aviso de que não substitui um profissional fica no fim da tela: no alto, só o que se usa)
function cabecalhoCurto() {
  return h('div', { class: 'col gap-s', 'data-curto': '1' }, abasTreinador('corrida'));
}
const rodapeAviso = () => h('div', { class: 'nutri-topo rodape-aviso' }, h('div', { class: 'avatar' }, icon('run', 's')), h('p', { class: 'tiny muted', text: 'Treinador de corrida. Baseado em estudos de treinamento: não substitui um profissional.' }));
function fontes(chaves) {
  const box = h('div', { class: 'col gap-s' });
  for (const k of chaves || []) if (REFS_CORRIDA[k]) box.appendChild(h('p', { class: 'ref', text: '• ' + REFS_CORRIDA[k] }));
  return box;
}
const acc = (titulo, ...filhos) => h('details', { class: 'acc' }, h('summary', { text: titulo }), h('div', null, ...filhos));
const accId = (id, titulo, ...filhos) => { const d = acc(titulo, ...filhos); d.id = id; return d; };
// avisos que mudam o que fazer (atenção, perigo ou destacados) ficam à vista; os informativos vão para "Cuidados"
const avisoAlto = (av) => av.tipo !== 'info' || !!av.destaque;
// "por quê" com as fontes, discreto (alvo de toque de 44 px)
const porQue = (texto, refs, rotulo = 'Por quê?') => h('details', { class: 'pq alvo' }, h('summary', { text: rotulo }), texto ? h('p', { class: 'small', text: texto }) : null, refs && refs.length ? h('div', { class: 'mt' }, h('div', { class: 'tiny bold muted', text: 'FONTES' }), fontes(refs)) : null);
const aviso = (a) => h('div', { class: 'note ' + (a.tipo === 'danger' ? 'danger' : a.tipo === 'warn' ? 'warn' : 'info') }, icon(a.tipo === 'info' ? 'info' : 'warn'), h('div', { class: 'grow' }, h('div', { text: a.texto }), a.refs && a.refs.length ? porQue('', a.refs, 'Fontes') : null));

function faq() {
  const wrap = h('div', { class: 'col' });
  const results = h('div', { class: 'col gap-s' });
  let todas = false;
  const draw = (termo) => {
    while (results.firstChild) results.removeChild(results.firstChild);
    const itens = buscarFaq(FAQ_CORRIDA, termo).slice(0, termo ? 8 : todas ? FAQ_CORRIDA.length : 4);
    if (!itens.length) { results.appendChild(note('info', 'Não encontrei isso na minha base. Só respondo o que tem apoio em estudos; para o seu caso, procure um profissional.')); return; }
    for (const it of itens) results.appendChild(acc(it.q, ...it.a.map((p) => h('p', { text: p })), h('div', { class: 'tiny bold muted', text: 'FONTES' }), fontes(it.f)));
    if (!termo && !todas) results.appendChild(btn(`Ver todas as ${FAQ_CORRIDA.length} perguntas`, () => { todas = true; draw(''); }, 'block ghost sm'));
  };
  wrap.appendChild(h('h2', { text: 'Pergunte ao Treinador de corrida' }));
  wrap.appendChild(h('div', { class: 'search' }, icon('search'), h('input', { class: 'input', type: 'search', placeholder: 'Ex.: ritmo, longão, dor, prova, calor', 'aria-label': 'Pergunte ao Treinador de corrida', autocomplete: 'off', onInput: (e) => draw(e.target.value) })));
  wrap.appendChild(results);
  draw('');
  return wrap;
}

const opcoesDoPlano = () => { const { forca, pernas } = diasDeForca(state); return { diasForca: forca, diasPernas: pernas, dores: doresAtivas(state, hojeKey()), bloqueados: diasSemCorrida(state) }; };
// Entrevista da corrida com as perguntas que valem para os dois treinos: os dias sem treino (a mesma resposta do Treinador)
// e, de quem também faz musculação, os dias em que ainda quer correr (logic/dias-livres.js). Os dias sem corrida saem das
// opções de dias de corrida dentro da própria entrevista.
const fazMusculacao = () => Object.keys(state.trainer.answers || {}).length > 0 || state.plans.length > 0;
const perguntasDaCorrida = () => (fazMusculacao() ? PERGUNTAS : PERGUNTAS.filter((q) => q.k !== 'soCorrida'));
const volumeTxt = (s) => (s.fase === 'adaptacao' ? `${s.corridaMin} min de corrida` : s.fase === 'caminhada' ? `${s.volumeMin} min` : `${virgula(s.volumeKm)} km`);

function zonasCard(p) {
  const box = h('div', { class: 'col gap-s' });
  for (const z of p.zonas.lista) {
    if (z.id === 'tiros' && p.perfil.nivel < 2) continue;
    const linhas = [`Esforço ${z.pse[0]} a ${z.pse[1]} em 10 · ${z.fala}`];
    if (z.ritmo) linhas.push((p.modo === 'esteira' ? 'Velocidade: ' : 'Ritmo: ') + fmtFaixa(z.ritmo, p.modo));
    if (z.fc) linhas.push(`Batimentos (aproximado): ${z.fc[0]} a ${z.fc[1]} por minuto`);
    box.appendChild(h('div', { class: 'col gap-s' }, h('div', { class: 'bold', text: z.nome }), ...linhas.map((t) => h('div', { class: 'small muted', text: t })), h('div', { class: 'small', text: z.paraQue })));
  }
  const R = p.ritmos;
  const extra = [];
  if (R) {
    extra.push(h('p', { class: 'small', text: `Calculado pelo seu resultado: ${fmtKm(R.base.distKm)} em ${fmtTempo(R.base.seg)}. Previsões de hoje: 5 km em ${fmtTempo(R.previsoes[5])}, 10 km em ${fmtTempo(R.previsoes[10])}, meia maratona em ${fmtTempo(R.previsoes[21])}, maratona entre ${fmtTempo(R.previsoes[42])} e ${fmtTempo(R.previsoes.maratonaAte)}.` }));
    extra.push(h('div', { class: 'row' }, h('span', { class: 'grow' }), comAjuda(h('span', { class: 'tiny muted', text: 'Por que a maratona é uma faixa?' }), 'Previsão da maratona', ['A previsão de maratona costuma ser otimista para quem treina pouco volume: por isso aparece como faixa.'])));
  } else extra.push(h('p', { class: 'small', text: 'Sem um resultado recente, os treinos são guiados pelo esforço e pelo teste da fala. Registre um “Teste de ritmo” de 3 km ou 5 km para ter ritmos calculados.' }));
  extra.push(porQue(p.zonas.fcMax ? 'A frequência cardíaca máxima é estimada pela idade e pode errar 10 batimentos ou mais. Prefira o esforço e a fala.' : 'Com o remédio que deixa o pulso mais baixo, as zonas vão só pelo esforço e pela fala.', FONTES_TELA.zonas, 'Como é calculado'));
  return acc('Zonas de esforço e ritmos', box, ...extra);
}
function tiposCard(p) {
  const usados = new Set(p.semanas.flatMap((s) => s.dias.map((d) => d.tipo)));
  const itens = Object.keys(TIPOS_TREINO).filter((t) => usados.has(t) && TIPOS_TREINO[t].paraQue && t !== 'descanso');
  return acc('Tipos de treino deste plano', ...itens.map((t) => h('div', { class: 'col gap-s' }, h('div', { class: 'bold', text: TIPOS_TREINO[t].nome }), h('div', { class: 'small', text: TIPOS_TREINO[t].paraQue }), TIPOS_TREINO[t].sentir ? h('div', { class: 'small muted', text: 'Como sentir: ' + TIPOS_TREINO[t].sentir }) : null, porQue('', TIPOS_TREINO[t].f, 'Fontes'))));
}
function semanasCard(p, atual) {
  const box = h('div');
  for (const s of p.semanas) {
    const nomes = [...new Set(s.dias.filter((d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso').map((d) => (d.comoRodagem ? TIPOS_TREINO.leve : TIPOS_TREINO[d.tipo]).nome.toLowerCase()))];
    box.appendChild(h('div', { class: 'kv' }, h('span', { class: s.n === atual ? 'bold accent' : '' }, `Semana ${s.n} · ${ROTULO.fase[s.fase]}${s.descarga ? ' (leve)' : ''}`, h('div', { class: 'tiny muted', text: nomes.join(', ') || 'caminhada' })), h('span', { class: 'nowrap', text: volumeTxt(s) })));
  }
  return accId('corrida-semanas', `As ${p.totalSemanas} semanas do plano`, box, porQue('O volume sobe até 10% por semana, com uma semana 30% mais leve a cada quatro, até o que amadores costumam correr para cada distância; antes da prova ele diminui (polimento), mantendo a intensidade.', FONTES_TELA.semanas));
}
// orientações do plano dentro de uma seção fechada: um toque abre todas, cada uma com o seu título e as fontes
const orientacoesCard = (lista) => h('div', { class: 'col gap-s' }, ...lista.flatMap(([t, txt, refs]) => [h('h3', { class: 'orient-t', text: t }), h('p', { class: 'small', text: txt }), refs ? porQue('', refs, 'Fontes') : null]));
// os cuidados informativos do perfil, fechados
const cuidadosCard = (lista) => (lista.length ? accId('corrida-cuidados', `Cuidados para o seu perfil (${lista.length})`, ...lista.map(aviso)) : null);
function linhaDia(d, data, hoje, feito) {
  return h('button', { class: 'item' + (data === hoje ? ' hoje' : ''), type: 'button', 'data-data': data, onClick: () => go('corrida/dia/' + data) },
    h('div', { class: 'dia-wd', text: DIAS_CURTO[d.wd] }),
    h('div', { class: 'grow' }, h('div', { class: 't', text: d.nome }), h('div', { class: 's', text: d.resumo + (naEsteira(state, data) ? ' · na esteira' : '') + (d.movidaDe ? ` · veio de ${DIAS_LONGO[new Date(d.movidaDe + 'T12:00:00').getDay()].toLowerCase().replace('-feira', '')}` : '') })),
    feito ? badge('Feita', 'ok') : corridaPerdidaEm(state, data) ? badge('Não feita', 'warn') : data === hoje ? badge('Hoje', 'acc') : icon('right', 's muted'));
}

// ---------- proposta ----------
// Saúde (logic/saude.js): de onde veio cada proteção e, se a liberação médica guardada não vale mais, o pedido de novo.
function blocoDeSaude(sd, bloqueado) {
  const out = sd.avisos.map((x) => aviso(x));
  if (bloqueado && sd.liberacao !== 'falta' && sd.liberacao !== 'nao') {
    const c = cartaoLiberacao({
      estado: sd.liberacao,
      aoRenovar: () => { update((s) => { s.run.answers.liberado = 'sim'; s.run.answers.liberadoEm = hojeKey(); }); toast('Liberação confirmada: vale por 12 meses.'); refresh(); },
      aoNegar: () => { update((s) => { s.run.answers.liberado = 'nao'; delete s.run.answers.liberadoEm; }); refresh(); },
      aoRefazer: () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); },
    });
    if (c) out.push(c);
  }
  if (bloqueado) for (const av of avisosBloqueio(sd.respostas)) out.push(aviso(av));
  return out;
}
function proposta() {
  const hoje = hojeKey();
  const sd = saudeDaCorrida(state, hoje);
  const a = sd.respostas;
  const inicio = inicioPara(a, hoje, diasSemCorrida(state));
  const adiado = inicio > segundaDe(hoje); // nesta semana não sobra dia de treino: o plano começa na segunda-feira
  const p = gerarPlano(a, { ...opcoesDoPlano(), dores: [], adiado }); // a proposta mostra o plano inteiro; as dores ajustam os dias depois do aceite
  // Ordem: resumo do plano → avisos que mudam o treino → resumo em linhas → a primeira semana → aceitar. O resto, fechado.
  const body = [cabecalhoCurto()];
  const mudar = btn('Mudar respostas', () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); }, 'block ghost', 'edit');
  for (const x of blocoDeSaude(sd, !p)) body.push(x);
  if (!p) {
    body.push(h('p', { class: 'small muted', text: 'Quando a situação mudar, refaça a entrevista. Suas respostas ficam guardadas só neste aparelho.' }));
    body.push(mudar);
    return body;
  }
  const pf = p.perfil;
  const s1 = p.semanas[0];
  const meta = pf.dist ? `${ROTULO.objetivo[pf.objetivo].toLowerCase()}: ${ROTULO.distancia[pf.dist]}` : ROTULO.objetivo[pf.objetivo].toLowerCase();
  const ehCorrida = (d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso';
  const porSemana = p.semanas.map((s) => s.dias.filter(ehCorrida).length);
  const nIni = porSemana[0], nMax = Math.max(...porSemana), nCam = s1.dias.length - nIni;
  const quantas = p.tipo === 'caminhada' ? `${plural(s1.dias.length, 'caminhada', 'caminhadas')} por semana`
    : `${plural(nIni, 'corrida', 'corridas')} por semana${nMax > nIni ? ` no começo (chega a ${nMax})` : ''}${nCam ? ` e ${plural(nCam, 'caminhada', 'caminhadas')}` : ''}`;
  const dataProva = pf.dist && !p.provaRetirada ? somaDias(inicio, (p.totalSemanas - 1) * 7 + ((pf.diaLongo + 6) % 7)) : '';
  // A semana 1 vai de segunda a domingo. Aceito no meio da semana, o plano usa esta semana e só valem os dias de hoje em
  // diante: a tela mostra o primeiro treino de verdade, e não a segunda-feira que já passou.
  const dataDe = (wd) => somaDias(inicio, (wd + 6) % 7);
  const dmCurto = (k) => `${Number(k.slice(8, 10))}/${k.slice(5, 7)}`;
  const treinosS1 = s1.dias.filter((d) => d.tipo !== 'descanso');
  const primeiro = (treinosS1.find((d) => dataDe(d.wd) >= hoje) || treinosS1[0]);
  const primeiroData = primeiro ? dataDe(primeiro.wd) : inicio;
  const noMeio = inicio < hoje;
  body.push(h('div', { class: 'bubble' },
    h('p', { text: `Montei um plano de ${plural(p.totalSemanas, 'semana', 'semanas')} para ${meta}, com ${quantas}.` }),
    pf.objetivo === 'prova' && dataProva ? h('p', { class: 'bold', text: `A prova fica em ${fmtDia(dataProva)}. Confira a data: se não for essa, toque em “Mudar respostas” e ajuste as semanas.` }) : null,
    h('p', { class: 'small muted', text: pf.nivel <= 1 ? 'Seus treinos vão por tempo e esforço: é a forma mais indicada para quem está começando.' : p.modo === 'gps' ? 'Seus treinos saem em distância e faixa de ritmo.' : p.modo === 'esteira' ? 'Seus treinos saem em distância e velocidade da esteira.' : 'Seus treinos saem em tempo e esforço.' })));
  for (const av of p.avisos.filter(avisoAlto)) body.push(aviso(av));
  if (doresAtivas(state, hoje).length) body.push(note('info', 'Você tem uma dor registrada: depois de aceitar, os treinos dos próximos dias saem ajustados a ela.'));
  // (os dias de treino estão na primeira semana, logo abaixo, e o jeito de medir está no resumo acima)
  body.push(h('div', { class: 'card col gap-s' },
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Nível' }), h('span', { text: ROTULO.nivel[pf.nivel] })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Primeiro treino' }), h('span', { id: 'corrida-primeiro', text: fmtDia(primeiroData) + (primeiroData === hoje ? ' (hoje)' : '') })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Semana 1' }), h('span', { text: `${dmCurto(inicio)} a ${dmCurto(somaDias(inicio, 6))}${noMeio ? ' (esta semana)' : ''}` })),
    dataProva ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: pf.objetivo === 'prova' ? 'Prova' : 'Dia do desafio' }), h('span', { text: fmtDia(dataProva) })) : null));
  body.push(sectionTitle('A primeira semana'));
  // aceito no meio da semana: os dias que já passaram aparecem apagados, com "Já passou"
  body.push(h('div', { class: 'card col gap-s', id: 'corrida-semana1' }, ...s1.dias.map((d) => {
    const passou = dataDe(d.wd) < hoje;
    return h('div', { class: 'row top' + (passou ? ' passou' : '') }, h('div', { class: 'dia-wd', text: DIAS_CURTO[d.wd] }),
      h('div', { class: 'grow' }, h('div', { class: 'bold', text: d.nome }), h('div', { class: 'small muted', text: d.resumo }), d.ritmo && !passou ? h('div', { class: 'small', text: (p.modo === 'esteira' ? 'Velocidade: ' : 'Ritmo: ') + fmtFaixa(d.ritmo, p.modo) }) : null),
      passou ? badge('Já passou', '') : dataDe(d.wd) === hoje ? badge('Hoje', 'acc') : h('span', { class: 'tiny muted nowrap', text: dmCurto(dataDe(d.wd)) }));
  })));
  let ciente = !pf.confirmar;
  const aceitar = btn('Aceitar e usar este plano', () => {
    if (!ciente) return;
    update((s) => { s.run.aceitoEm = new Date().toISOString(); s.run.inicio = inicioPara(s.run.answers, hojeKey(), diasSemCorrida(s)); s.run.pausadoEm = ''; s.run.pausas = []; s.run.cron = null; s.run.mostrados = []; s.run.degrau = null; s.run.carga = []; });
    modo = 'auto';
    toast('Plano ativado! Os treinos de corrida já aparecem na aba Treinos.');
    refresh(); window.scrollTo(0, 0);
    // com o plano aceito: quer fortalecimento? E, se também faz musculação, o que vem primeiro?
    const falta = faltaPerguntar(state);
    if (falta.foco || falta.fortalecimento) perguntarCombinado({ aoMudar: () => refresh() });
  }, 'primary lg block', 'check');
  aceitar.disabled = !ciente;
  if (pf.confirmar) {
    const txt = pf.precisaLiberacao ? 'Confirmo que um médico me liberou para correr e que li os avisos acima.' : 'Li os avisos acima: sei que a recomendação é conversar com um médico e que o plano fica só com treinos leves.';
    body.push(h('div', { class: 'card row' }, h('div', { class: 'grow small', text: txt }), toggle(false, (v) => { ciente = v; aceitar.disabled = !v; }, pf.precisaLiberacao ? 'Confirmo a liberação médica' : 'Confirmo que li os avisos')));
  }
  body.push(aceitar);
  body.push(mudar);
  // o resto, fechado: cuidados informativos, as semanas, os tipos de treino, as zonas e como seguir o plano
  const cuidados = cuidadosCard(p.avisos.filter((av) => !avisoAlto(av)));
  if (cuidados) body.push(cuidados);
  body.push(semanasCard(p, 0));
  body.push(tiposCard(p));
  body.push(zonasCard(p));
  body.push(acc('Como seguir este plano', orientacoesCard(p.orientacoes)));
  return body;
}

// ---------- painel ----------
function evolucaoCard(hoje) {
  const ev = evolucao(state.runs, hoje);
  // fechada: abre com o volume, a constância, o ritmo e o gráfico das semanas
  const card = h('div');
  const caixa = (titulo) => h('details', { class: 'acc', id: 'corrida-evolucao' }, h('summary', { text: titulo }), card);
  if (!ev.totalCorridas) { card.appendChild(h('p', { class: 'small muted', text: 'Registre as corridas para ver aqui o volume, o ritmo e a constância. É pelos registros que o plano se ajusta.' })); return caixa('Sua evolução'); }
  const atual = ev.semanas[ev.semanas.length - 1];
  card.appendChild(h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('b', { text: virgula(atual.km) }), h('span', { text: 'km nesta semana' })),
    h('div', { class: 'stat' }, h('b', { text: String(ev.totalCorridas) }), h('span', { text: ev.totalCorridas === 1 ? 'corrida registrada' : 'corridas registradas' })),
    h('div', { class: 'stat' }, h('b', { text: String(ev.constancia.sequencia) }), h('span', { text: ev.constancia.sequencia === 1 ? 'semana seguida' : 'semanas seguidas' }))));
  const comKm = ev.semanas.some((s) => s.km > 0);
  card.appendChild(h('div', { class: 'tiny muted bold', text: comKm ? 'QUILÔMETROS POR SEMANA' : 'MINUTOS POR SEMANA' }));
  card.appendChild(barChart(ev.semanas.map((s) => ({ label: `${Number(s.inicio.slice(8, 10))}/${s.inicio.slice(5, 7)}`, value: comKm ? s.km : s.min })), comKm ? 'Quilômetros corridos por semana' : 'Minutos corridos por semana'));
  card.appendChild(h('p', { class: 'small', text: `Constância: você correu em ${ev.constancia.semanasComTreino} das últimas ${ev.constancia.de} semanas.` }));
  if (ev.ritmoLeve.length) {
    const ult = ev.ritmoLeve.slice(-3);
    const medio = Math.round(ult.reduce((s, x) => s + x.ritmo, 0) / ult.length);
    const t = ev.tendenciaRitmo;
    card.appendChild(h('p', { class: 'small', text: `Ritmo nos treinos leves: ${fmtRitmo(medio)} por km nas últimas corridas.` + (t == null ? '' : t >= 5 ? ` Você está ${t} segundos por km mais rápido do que antes, no mesmo tipo de treino.` : t <= -5 ? ` Está ${-t} segundos por km mais lento do que antes: pode ser cansaço, calor ou percurso.` : ' Estável em relação às corridas anteriores.') }));
  }
  if (atual.carga) card.appendChild(h('p', { class: 'small muted', text: `Carga desta semana (esforço × minutos): ${atual.carga}.` }));
  card.appendChild(porQue('Volume, regularidade e o esforço que você anota são os sinais que melhor acompanham a resposta ao treino. A carga soma esforço × minutos de cada corrida.', ev.refs, 'Como ler'));
  return caixa(`Sua evolução · ${plural(ev.totalCorridas, 'corrida', 'corridas')}`);
}
// ---------- sua semana: a carga da semana (logic/carga-corrida.js) ----------
function aplicarSemana(r) {
  return async () => {
    if (!(await confirmSheet({ title: 'Ajustar a sua semana?', text: r.ajustes.map((a) => a.texto).join(' ') + ' Dá para desfazer depois.', okLabel: 'Ajustar' }))) return;
    const g = aplicarCarga(state, hojeKey());
    if (!g) { toast('Nada para ajustar agora.'); refresh(); return; }
    update((s) => { s.run.carga = g.carga; s.perdidos = g.perdidos; });
    toast('Semana ajustada.'); refresh();
  };
}
function desfazerSemana() {
  const g = desfazerCarga(state, hojeKey());
  update((s) => { s.run.carga = g.carga; s.perdidos = g.perdidos; });
  toast('Ajuste desfeito: a semana voltou ao plano.'); refresh();
}
function cartaoSemana(hoje) {
  let r;
  try { r = cargaDaSemana(state, hoje); } catch { return null; }
  if (r.nivel === 'sem_plano') return r.temAplicado ? h('div', { class: 'card row', id: 'corrida-sua-semana', dataset: { nivel: 'sem_plano' } }, h('div', { class: 'grow small', text: 'Sua semana tem um ajuste que não vale mais.' }), btn('Desfazer', desfazerSemana, 'sm ghost')) : null;
  const outros = r.fatores.filter((f) => f.id !== r.principal).slice(0, 2);
  const motivos = [...new Set(r.ajustes.map((a) => a.porque))].join(' ');
  return h('div', { class: 'card col gap-s', id: 'corrida-sua-semana', dataset: { nivel: r.nivel, aplicado: r.aplicado ? 'sim' : 'nao' } },
    h('div', { class: 'tiny muted bold', text: 'SUA SEMANA' }),
    h('div', { class: 'small bold', text: r.resumo }),
    ...r.ajustes.map((a) => h('div', { class: 'row top' }, icon(a.aplicado ? 'check' : 'swap', 's ' + (a.aplicado ? 'accent' : 'muted')), h('div', { class: 'grow small', text: a.texto }), a.aplicado ? badge('Feito', 'ok') : null)),
    ...outros.map((f) => h('div', { class: 'small muted', text: f.texto })),
    r.ajustes.length && !r.aplicado ? btn('Ajustar a semana', aplicarSemana(r), 'primary block alvo', 'check') : null,
    r.temAplicado ? btn('Desfazer', desfazerSemana, 'ghost block alvo', 'refresh') : null,
    r.refs.length ? porQue(motivos || (r.nivel === 'atencao' ? 'Só para informar: o plano não muda por isso.' : ''), r.refs) : null);
}
// Início (views/home.js): a corrida de hoje ou de amanhã que a carga da semana muda, em uma linha. null se nada muda.
export function linhaCargaInicio(hoje) {
  let a = null;
  try { const r = cargaDaSemana(state, hoje); a = cargaDoDia(state, hoje, hoje, r) || cargaDoDia(state, hoje, somaDias(hoje, 1), r); } catch { a = null; }
  if (!a) return null;
  return h('div', { class: 'card row', id: 'inicio-carga', dataset: { aplicado: a.aplicado ? 'sim' : 'nao' } }, icon(a.aplicado ? 'check' : 'swap', 'accent'),
    h('div', { class: 'grow' }, h('div', { class: 'small bold', text: a.aplicado ? a.texto : 'Semana puxada' }), h('div', { class: 'small muted', text: a.aplicado ? 'Semana puxada: já ajustado.' : a.texto })),
    btn(a.aplicado ? 'Ver' : 'Ver ajuste', () => go('corrida'), 'sm'));
}
// análise de uma corrida contra o treino do dia
const seloAnalise = (a) => badge(a.titulo, a.selo === 'dentro' ? 'ok' : a.selo === 'acima' ? 'warn' : a.selo === 'abaixo' ? 'acc' : '');
function analiseBox(a) {
  return h('div', { class: 'col gap-s', 'data-analise': a.selo },
    h('div', { class: 'row between' }, h('div', { class: 'small bold', text: 'Análise do treino' }), seloAnalise(a)),
    ...a.itens.map((x) => h('div', { class: 'row top' }, icon(x.tom === 'warn' ? 'warn' : x.tom === 'ok' ? 'check' : 'info', 's ' + (x.tom === 'warn' ? 'accent' : 'muted')), h('div', { class: 'grow small', text: x.texto }))),
    h('p', { class: 'small' }, h('b', { text: 'O plano: ' }), a.plano),
    a.refs.length ? porQue('', a.refs, 'Fontes') : null);
}
const quando = (dias) => (dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : dias < 14 ? `daqui a ${dias} dias` : `daqui a ${Math.floor(dias / 7)} semanas`);
function painel() {
  const run = state.run;
  const hoje = hojeKey();
  const body = [cabecalhoCurto()];
  const acoesFim = () => h('div', { class: 'col' },
    btn('Refazer a entrevista', async () => {
      if (!(await confirmSheet({ title: 'Refazer a entrevista?', text: 'Ao terminar as perguntas, o plano atual é trocado por um novo, que começa da semana 1. As corridas registradas continuam guardadas. Se desistir no meio, nada muda.', okLabel: 'Refazer' }))) return;
      modo = 'entrevista'; refresh(); window.scrollTo(0, 0);
    }, 'block ghost', 'edit'),
    btn('Encerrar o plano', async () => {
      if (!(await confirmSheet({ title: 'Encerrar o plano de corrida?', text: 'Os treinos de corrida saem da sua semana. As corridas registradas e as suas respostas continuam guardadas.', okLabel: 'Encerrar', danger: true }))) return;
      update((s) => { s.run.aceitoEm = ''; s.run.inicio = ''; s.run.pausadoEm = ''; s.run.pausas = []; s.run.cron = null; s.run.mostrados = []; s.run.degrau = null; s.run.carga = []; });
      modo = 'auto'; toast('Plano encerrado.'); refresh(); window.scrollTo(0, 0);
    }, 'block ghost danger', 'close'));
  if (run.pausadoEm) {
    const dias = Math.max(0, diasEntre(diaLocal(run.pausadoEm) || hoje, hoje));
    body.push(h('div', { class: 'card hl col' }, h('h2', { text: 'Plano pausado' }), h('p', { class: 'small muted', text: `Pausado há ${plural(dias, 'dia', 'dias')}. Ao retomar, o plano continua de onde parou; se a pausa passou de 2 semanas, ele volta com menos volume e sem treinos fortes.` }),
      btn('Retomar o plano', () => {
        // a pausa fica guardada: não conta como falta, e a volta é gradual (logic/corrida.js)
        update((s) => { s.run = retomarPlano(s.run, hojeKey()); });
        toast('Plano retomado.'); refresh();
      }, 'primary block', 'play')));
    body.push(evolucaoCard(hoje)); body.push(acoesFim()); body.push(faq());
    return body;
  }
  const p = planoAtual(state, hoje);
  if (!p) {
    // a saúde mudou depois do aceite (outra entrevista, liberação vencida ou sem data): a tela pede o que falta
    const sd = saudeDaCorrida(state, hoje);
    const saude = perfil(sd.respostas).bloqueio ? blocoDeSaude(sd, true) : [];
    for (const x of saude) body.push(x);
    if (!saude.length) body.push(note('warn', 'Não consegui montar o plano com as respostas guardadas. Refaça a entrevista.'));
    body.push(acoesFim()); return body;
  }
  guardarMostrado();
  const sem = planoDaSemana(state, hoje);
  const pf = p.perfil;
  // Ordem: hoje (treino e botão) → avisos que mudam o treino (alertas, dores, ajustes) → a semana → seções fechadas
  // (como foram os treinos, evolução, últimas corridas, dicas, o plano, cuidados, semanas, tipos, zonas, como seguir) →
  // perguntas frequentes → pausar, refazer a entrevista, encerrar.
  // 1. hoje, com a semana do plano em uma linha e a barra de progresso
  const feitas = sem.dias.filter((d) => d && d.feito).length, previstas = sem.dias.filter((d) => d && d.tipo !== 'descanso').length;
  // corridas além do plano (esteira a mais, segunda corrida no dia): contam à parte
  const nExtras = Array.isArray(sem.extras) ? sem.extras.reduce((t, l) => t + (Array.isArray(l) ? l.length : 0), 0) : 0;
  const pct = Math.min(100, Math.round(((sem.concluido ? p.totalSemanas : sem.semana - 1) / p.totalSemanas) * 10) * 10);
  const barra = h('div', { class: 'barra-plano', role: 'progressbar', 'aria-label': 'Progresso do plano', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, h('i', { class: 'w' + pct }));
  const provaTxt = p.prova && p.prova.data >= hoje ? h('p', { class: 'small', text: `${p.prova.tipo === 'teste' ? 'Teste' : pf.objetivo === 'prova' ? 'Prova' : 'Desafio'} de ${ROTULO.distancia[pf.dist]}: ${fmtDia(p.prova.data)}, ${quando(diasEntre(hoje, p.prova.data))}.` }) : null;
  if (sem.antesDoInicio || sem.concluido) {
    body.push(h('div', { class: 'card hl col gap-s', id: 'corrida-hoje', dataset: { hoje: sem.concluido ? 'concluido' : 'antes' } },
      h('h2', { text: sem.antesDoInicio ? 'Plano aceito' : 'Plano concluído' }), barra,
      h('p', { class: 'small muted', text: sem.antesDoInicio ? `${sem.fase}. Até lá, descanse ou caminhe.` : 'Parabéns por chegar ao fim! Refaça a entrevista para montar o próximo plano a partir de onde você está.' }),
      provaTxt,
      sem.concluido ? btn('Montar um novo plano', () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); }, 'primary block', 'refresh') : null));
  } else {
    const wdHoje = new Date(hoje + 'T12:00:00').getDay();
    const dHoje = sem.dias[wdHoje];
    const treinoHoje = dHoje && dHoje.tipo !== 'descanso';
    // "Não corri" (views/perdido.js): a corrida de hoje marcada como não feita, ou que mudou de dia
    const marcaHoje = corridaPerdidaEm(state, hoje);
    const movidaHoje = !treinoHoje && sem.movidas && sem.movidas[wdHoje] ? sem.movidas[wdHoje] : null;
    // descanso: o próximo treino desta semana, ou da semana que vem
    let proxTxt = '';
    if (!treinoHoje) {
      const prox = ORDEM.map((wd) => sem.dias[wd]).find((d) => d && d.tipo !== 'descanso' && d.data > hoje);
      const seg = p.semanas[sem.semana] && p.semanas[sem.semana].dias.find((d) => d.tipo !== 'descanso');
      proxTxt = prox ? `Próximo treino: ${DIAS_LONGO[prox.wd].toLowerCase().replace('-feira', '')}, ${prox.nome.toLowerCase()}.` : seg ? `Próximo treino: na semana que vem, ${DIAS_LONGO[seg.wd].toLowerCase().replace('-feira', '')}.` : '';
    }
    body.push(h('div', { class: 'card hl col gap-s', id: 'corrida-hoje', dataset: { hoje: treinoHoje ? (dHoje.feito ? 'feito' : 'treino') : 'descanso' } },
      h('div', { class: 'row between' }, h('div', { class: 'tiny accent bold', text: `Semana ${sem.semana} de ${sem.totalSemanas} · ${sem.fase}` }), previstas ? h('span', { class: 'tiny muted nowrap', text: `${feitas} de ${previstas} feitos${nExtras ? ` + ${nExtras} extra` : ''}` }) : null),
      barra,
      h('div', { class: 'row between' }, h('h2', { text: treinoHoje ? `Hoje: ${dHoje.nome}` : 'Hoje: descanso' }), treinoHoje && dHoje.feito ? badge('Feita', 'ok') : null),
      treinoHoje ? h('p', { class: 'small muted', text: dHoje.resumo + (naEsteira(state, hoje) ? ' · na esteira' : '') }) : proxTxt ? h('p', { class: 'small muted', text: proxTxt }) : null,
      provaTxt,
      marcaHoje && (treinoHoje || movidaHoje) ? linhaNaoCorrida(marcaHoje, String((treinoHoje ? dHoje.nome : movidaHoje.nome) || 'Corrida'), refresh) : null,
      treinoHoje && !marcaHoje ? btn(dHoje.feito ? 'Ver a corrida de hoje' : 'Iniciar', () => go('corrida/dia/' + hoje), (dHoje.feito ? 'ghost' : 'primary') + ' block alvo', dHoje.feito ? 'right' : 'play') : null,
      treinoHoje && !dHoje.feito && !marcaHoje && podeMarcarCorrida(state, hoje, hoje) ? h('div', { class: 'perdido-acoes' }, botaoNaoCorri(hoje, refresh)) : null));
  }
  // dúvida ou imprevisto (chuva, juntar com a musculação, dor): o chat do Treinador de corrida (views/chat.js), logo
  // depois do treino de hoje (no alto, as ferramentas; as informações, abaixo)
  body.push(botaoChat('corrida', 'Perguntar ao treinador de corrida'));
  // a carga da semana: segue, fica mais leve ou muda de dia (logic/carga-corrida.js)
  if (!sem.antesDoInicio && !sem.concluido) { const cs = cartaoSemana(hoje); if (cs) body.push(cs); }
  // 2. o que muda o treino: avisos graves (meta que não coube, prova retirada), alertas dos registros, dores e ajustes
  for (const av of p.avisos) if (av.destaque || av.tipo === 'danger') body.push(aviso(av));
  for (const al of alertas(state.runs, hoje, naoMedeDe(state), podeTodoDiaDe(state))) body.push(aviso(al));
  // dores: o mesmo registro vale para a musculação. Com dor contada, o cartão fica aqui; sem dor, só o botão, mais abaixo
  const pfDor = perfilAtual();
  // (o efeito da dor que já está em "O que ajustei no plano", com o porquê e as fontes, não se repete no cartão)
  const cartaoDeDores = cartaoDores({ extra: (d) => { const t = efeitoDaDor(d, pfDor).texto; return t && p.ajustes.some((x) => typeof x.texto === 'string' && x.texto.includes(t)) ? '' : t; }, aoMudar: () => refresh() });
  const comDor = doresAtivas(state, hoje);
  if (comDor.length) body.push(cartaoDeDores);
  const comOrientacao = comDor.filter((d) => orientacaoDor(d.onde));
  if (comOrientacao.length) body.push(acc('O que fazer com essa dor na corrida', ...comOrientacao.flatMap((d) => { const o = orientacaoDor(d.onde); return [h('div', { class: 'bold', text: o.nome }), ...o.itens.map(([t, txt]) => h('p', { class: 'small' }, h('b', { text: t + ': ' }), txt)), porQue('', o.refs, 'Fontes')]; })));
  // ajustes feitos: o que mudou, em uma linha cada; o porquê abre ao toque
  // (os ajustes da carga da semana já estão no cartão "Sua semana")
  const ajustesPlano = p.ajustes.filter((x) => !x.carga);
  if (ajustesPlano.length) {
    body.push(h('div', { class: 'card col gap-s', 'data-ajustes': String(ajustesPlano.length) }, h('h3', { text: 'O que ajustei no plano' }),
      ...ajustesPlano.map((x) => h('div', { class: 'dica plana atencao' }, h('div', { class: 'dica-ic' }, icon('swap')), h('div', { class: 'grow' }, h('div', { class: 'small bold', text: x.texto }), porQue(x.motivo, x.refs))))));
  }
  // 3. a semana
  if (!sem.antesDoInicio && !sem.concluido) {
    body.push(sectionTitle('Esta semana'));
    if (sem.foco) body.push(h('p', { class: 'small muted', text: sem.foco }));
    const lista = h('div', { class: 'list' });
    for (const wd of ORDEM) {
      const d = sem.dias[wd];
      if (d) lista.appendChild(linhaDia(d, d.data, hoje, d.feito));
      // corrida que mudou de dia (pelo chat): o dia de origem só lembra para onde ela foi
      else if (sem.movidas && sem.movidas[wd]) lista.appendChild(h('div', { class: 'item passou' }, h('div', { class: 'dia-wd', text: DIAS_CURTO[wd] }), h('div', { class: 'grow' }, h('div', { class: 's', text: `${sem.movidas[wd].nome}: passou para ${DIAS_LONGO[new Date(sem.movidas[wd].para + 'T12:00:00').getDay()].toLowerCase().replace('-feira', '')}` }))));
      // feita fora do plano (esteira a mais, segunda corrida no dia, dia sem treino): entra na semana
      for (const x of Array.isArray(sem.extras) && Array.isArray(sem.extras[wd]) ? sem.extras[wd] : []) {
        const partes = [x.distKm ? String(x.distKm).replace('.', ',') + ' km' : '', x.durMin ? Math.round(x.durMin) + ' min' : ''].filter(Boolean).join(' · ');
        lista.appendChild(h('div', { class: 'item', 'data-extra': String(x.id || '') }, h('div', { class: 'dia-wd', text: DIAS_CURTO[wd] }), h('div', { class: 'grow' }, h('div', { class: 't', text: x.local === 'esteira' ? 'Esteira fora do plano' : 'Corrida fora do plano' }), h('div', { class: 's', text: partes || 'Registrada neste dia' })), badge('Extra', 'ok')));
      }
    }
    body.push(lista);
    const prox = p.semanas[sem.semana];
    if (prox) body.push(acc(`Semana que vem (${volumeTxt(prox)})`, ...prox.dias.map((d) => h('div', { class: 'row top' }, h('div', { class: 'dia-wd', text: DIAS_CURTO[d.wd] }), h('div', { class: 'grow' }, h('div', { class: 'bold small', text: d.nome }), h('div', { class: 'small muted', text: d.resumo })))), h('p', { class: 'tiny muted', text: 'Pode mudar conforme o que você registrar nesta semana.' })));
  }
  body.push(btn('Registrar uma corrida', () => go('corrida/dia/' + hoje), 'block', 'plus'));
  // corrida e musculação: prioridade e fortalecimento (pergunta ou resumo da escolha)
  const combinado = cartaoCombinado({ aoMudar: () => refresh() });
  if (combinado) body.push(combinado);
  if (!comDor.length) body.push(cartaoDeDores);

  // 4. seções fechadas
  // o que foi feito contra o que estava no plano
  const feitos = analiseRecente(state, hoje);
  if (feitos.itens.length) {
    const card = accId('como-foram', `Como foram os seus treinos (${feitos.itens.length})`,
      h('p', { class: 'small muted', text: 'Cada corrida registrada, comparada com o treino do dia. Toque para ver a análise.' }));
    const dentro = card.lastChild;
    for (const { registro: r, analise: a } of feitos.itens) {
      dentro.appendChild(h('button', { class: 'item', type: 'button', onClick: () => go('corrida/dia/' + r.data) },
        h('div', { class: 'grow' }, h('div', { class: 't', text: `${fmtDia(r.data)} · ${TIPOS_TREINO[r.tipo] ? TIPOS_TREINO[r.tipo].nome : 'Corrida'}` }), h('div', { class: 's', text: (a.itens.find((x) => x.tom === 'warn') || a.itens.find((x) => x.tom !== 'ok') || a.itens[0]).texto })),
        seloAnalise(a)));
    }
    for (const pd of feitos.padroes) dentro.appendChild(h('div', { class: 'dica plana atencao' }, h('div', { class: 'dica-ic' }, icon('info')), h('div', { class: 'grow' }, h('div', { class: 'small', text: pd.texto }), porQue('', pd.refs, 'Fontes'))));
    if (feitos.faltas.length) dentro.appendChild(h('p', { class: 'small muted', text: `${plural(feitos.faltas.length, 'treino do plano ficou', 'treinos do plano ficaram')} sem registro nas últimas 2 semanas. Treino perdido não se repõe: siga o plano.` }));
    body.push(card);
  }
  body.push(evolucaoCard(hoje));
  // corridas registradas
  const ult = state.runs.slice(-5).reverse();
  if (ult.length) {
    body.push(accId('corrida-ultimas', 'Últimas corridas', h('div', { class: 'list' }, ...ult.map((r) => h('button', { class: 'item', type: 'button', onClick: () => go('corrida/dia/' + r.data) },
      h('div', { class: 'grow' }, h('div', { class: 't', text: `${fmtDia(r.data)} · ${TIPOS_TREINO[r.tipo] ? TIPOS_TREINO[r.tipo].nome : 'Corrida'}` }), h('div', { class: 's', text: resumoRegistro(r) })), icon('right', 's muted'))))));
  }
  // dicas
  const ds = dicas(run.answers).slice(0, 4);
  if (ds.length) body.push(accId('corrida-dicas', 'Dicas para você', ...ds.map((d) => h('div', { class: 'dica plana' }, h('div', { class: 'dica-ic' }, icon('bolt')), h('div', { class: 'grow' }, h('div', { class: 'bold', text: d.titulo }), h('div', { class: 'small', text: d.texto }), porQue('', d.refs, 'Fontes'))))));
  // o plano, os cuidados e as explicações
  body.push(accId('corrida-plano', 'O seu plano',
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Objetivo' }), h('span', { text: ROTULO.objetivo[pf.objetivo] + (pf.dist ? ' · ' + ROTULO.distancia[pf.dist] : '') })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Nível' }), h('span', { text: ROTULO.nivel[pf.nivel] })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Como medir' }), h('span', { text: ROTULO.modo[p.modo] })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Musculação' }), h('span', { text: diasDeForca(state).forca.length ? diasDeForca(state).forca.map((wd) => DIAS_CURTO[wd]).join(', ') : 'sem treino marcado' }))));
  const cuidados = cuidadosCard(p.avisos.filter((av) => !(av.destaque || av.tipo === 'danger')));
  if (cuidados) body.push(cuidados);
  body.push(semanasCard(p, sem.semana));
  body.push(tiposCard(p));
  body.push(zonasCard(p));
  body.push(acc('Como seguir o plano', orientacoesCard(p.orientacoes)));
  // 5. perguntas frequentes e, no fim, as ações sobre o plano
  body.push(faq());
  body.push(h('div', { class: 'col' },
    btn('Pausar o plano', async () => {
      if (!(await confirmSheet({ title: 'Pausar o plano?', text: 'Os treinos de corrida saem da sua semana até você retomar. Use para férias, doença ou uma semana corrida.', okLabel: 'Pausar' }))) return;
      update((s) => { s.run.pausadoEm = new Date().toISOString(); }); toast('Plano pausado.'); refresh(); window.scrollTo(0, 0);
    }, 'block ghost', 'pause'), acoesFim()));
  return body;
}

// Abre a entrevista da corrida vindo do chat (views/chat.js), com o mesmo aviso do botão "Refazer a entrevista"
export async function abrirEntrevistaCorrida() {
  if (state.run.aceitoEm && !(await confirmSheet({ title: 'Refazer a entrevista?', text: 'Ao terminar as perguntas, o plano atual é trocado por um novo, que começa da semana 1. As corridas registradas continuam guardadas. Se desistir no meio, nada muda.', okLabel: 'Refazer' }))) return;
  modo = 'entrevista';
  go('corrida');
  window.scrollTo(0, 0);
}
export function corridaView() {
  const a = state.run.answers;
  const completo = respostasCompletas(a);
  if (modo === 'entrevista' || !completo) {
    if (modo !== 'entrevista' && !Object.keys(a).length) {
      return {
        title: 'Treinador',
        body: [cabecalho(),
          h('div', { class: 'bubble' }, h('p', { text: 'Olá! Eu monto um plano de corrida para o seu nível, os seus dias e o seu objetivo, de quem nunca correu a quem prepara uma maratona.' }), h('p', { class: 'small muted', text: 'São uns 3 minutos de perguntas. Depois eu ajusto o plano pelo que você registrar. Tudo fica só neste aparelho.' })),
          btn('Começar', () => { modo = 'entrevista'; refresh(); }, 'primary lg block', 'play'),
          state.runs.length ? btn('Registrar uma corrida sem plano', () => go('corrida/dia/' + hojeKey()), 'block ghost', 'plus') : null,
          h('div', { class: 'mt' }), faq()],
      };
    }
    // as respostas guardadas, mais o que as outras entrevistas disseram sobre a saúde (a pessoa confere e desmarca)
    const pre = respostasParaEntrevista('corrida', state);
    for (const k of ['idade', 'peso', 'altura']) if (pre[k] == null) { const v = typeof state.trainer.answers[k] === 'number' ? state.trainer.answers[k] : state.nutri.answers[k]; if (typeof v === 'number') pre[k] = v; }
    // dias sem treino: a resposta é uma só para os dois treinos (quem respondeu no Treinador já vem com ela marcada)
    const ta = state.trainer.answers || {};
    if (!Array.isArray(pre.semTreino) || !pre.semTreino.length) pre.semTreino = Array.isArray(ta.semTreino) && ta.semTreino.length ? [...ta.semTreino] : ['nenhum'];
    if (!Array.isArray(pre.soCorrida)) pre.soCorrida = Array.isArray(ta.soCorrida) ? [...ta.soCorrida] : ['nenhum'];
    return {
      title: 'Treinador', body: [interview({
        perguntas: perguntasDaCorrida(), respostas: pre, base: a, avatar: 'run',
        onDone: (r) => { let msg = ''; update((s) => { s.run.answers = r; s.run.aceitoEm = ''; s.run.inicio = ''; s.run.pausadoEm = ''; s.run.pausas = []; s.run.cron = null; s.run.mostrados = []; s.run.degrau = null; s.run.carga = []; msg = aplicarDiasNosTreinos(s, 'run'); }); modo = 'proposta'; refresh(); window.scrollTo(0, 0); if (msg) toast('Musculação: ' + msg); },
        onCancel: () => { modo = 'auto'; refresh(); },
      })],
    };
  }
  if (modo === 'proposta' || !state.run.aceitoEm) return { title: 'Treinador', body: proposta() };
  const corpo = painel();
  return { title: 'Treinador', body: corpo[0] && corpo[0].dataset && corpo[0].dataset.curto ? [...corpo, rodapeAviso()] : corpo };
}

// ---------- treino do dia ----------
// a escala do esforço, para o "?" (o mesmo texto que aparece ao marcar o esforço no registro)
const AJUDA_ESFORCO = () => ['É o quanto o treino pesa para você, de 1 a 10:', ['1', 'Muito, muito fácil'], ['2', 'Fácil'], ['3', 'Moderado'], ['4', 'Um pouco difícil'], ['5 e 6', 'Difícil'], ['7 e 8', 'Muito difícil'], ['9', 'Quase no limite'], ['10', 'Máximo'],
  'Teste da fala: no leve (2 a 4), dá para falar frases inteiras; no moderado (5 a 6), só frases curtas; no forte (7 a 9), não dá para falar com conforto.'];
const PSE_TXT = ['', 'Muito, muito fácil', 'Fácil', 'Moderado', 'Um pouco difícil', 'Difícil', 'Difícil', 'Muito difícil', 'Muito difícil', 'Quase no limite', 'Máximo'];
const LOCAIS_CORRIDA = ['joelho', 'canela', 'panturrilha', 'aquiles', 'tornozelo', 'pe', 'coxa-frente', 'coxa-tras', 'quadril', 'virilha', 'gluteo', 'lombar'];
const TIPOS_LIVRES = ['livre', 'leve', 'longo', 'corrida_caminhada', 'progressivo', 'fartlek', 'tempo', 'intervalado', 'tiros', 'teste', 'prova', 'caminhada'];
// Ajuda para a pessoa saber se a dor é a dor muscular comum de quem treinou (zondi2015, mizumura2024) ou se pede cuidado
// (nhs_dor; urina escura com dor muscular forte: cdc_rabdo).
function guiaDorMuscular() {
  const li = (t) => h('li', { text: t });
  return h('details', { class: 'pq', id: 'guia-dor-muscular' }, h('summary', { text: 'Como saber se é dor muscular comum de treino?' }),
    h('div', { class: 'small bold mt', text: 'É dor muscular comum quando:' }),
    h('ul', { class: 'small' },
      li('fica no meio do músculo (coxa, panturrilha, glúteo), espalhada, como desgaste, peso ou rigidez;'),
      li('dói ao apertar, alongar ou usar o músculo, e quase nada parado;'),
      li('aparece horas depois ou no dia seguinte, fica mais forte em 1 a 3 dias e passa em até uma semana;'),
      li('melhora quando você aquece ou se movimenta de leve.')),
    h('div', { class: 'small bold', text: 'Pede cuidado (marque “Dor em um ponto” ou “Fisgada”):' }),
    h('ul', { class: 'small' },
      li('dor em um ponto do osso, da articulação ou do tendão;'),
      li('dor que começa ou piora durante a corrida e muda o seu jeito de correr;'),
      li('fisgada, estalo, inchaço, ou dor que não deixa apoiar;'),
      li('dor em repouso, à noite, ou que passa de uma semana.')),
    h('p', { class: 'small', text: 'Dor muscular muito forte com urina escura pede atendimento médico no mesmo dia.' }),
    h('div', { class: 'tiny bold muted', text: 'FONTES' }), fontes(['zondi2015', 'mizumura2024', 'nhs_dor', 'cdc_rabdo']));
}
function resumoRegistro(r) {
  const partes = [];
  if (r.distKm) partes.push(fmtKm(r.distKm));
  if (r.etapas) partes.push(`${r.etapas.feitas} de ${r.etapas.de} etapas`);
  if (r.durMin) partes.push((r.durEst ? 'cerca de ' : '') + fmtTempo(r.durMin * 60));
  if (r.distKm && r.durMin && r.tipo !== 'caminhada') partes.push(`${fmtRitmo((r.durMin * 60) / r.distKm)} por km${r.plan && r.plan.trecho ? ' na sessão' : ''}`);
  if (r.paceTrecho) partes.push(`${fmtRitmo(r.paceTrecho)} por km ${r.plan && r.plan.trecho ? (/tiro/i.test(r.plan.trecho.rotulo) ? 'nos tiros' : /limiar/i.test(r.plan.trecho.rotulo) ? 'no limiar' : 'na rodagem') : 'no trecho'}`);
  if (r.pse) partes.push(`esforço ${r.pse}`);
  if (r.local === 'esteira') partes.push('na esteira');
  for (const d of r.dores || []) partes.push(`${d.tipo === 'muscular' ? 'dor muscular' : 'dor'} em ${LOCAIS_DOR[d.onde].toLowerCase()} (${d.nivel})`);
  return partes.join(' · ');
}
// "32", "32:30" ou "1:05:20" → minutos. Não há minuto decimal: "32,5" não é aceito (seria ambíguo com 32 min 50 s);
// a tela pede minutos:segundos.
function lerTempo(txt) {
  const t = String(txt).trim();
  if (!t) return 0;
  // "32.30" ou "32,30" (dois dígitos depois do ponto ou da vírgula) é lido como 32 min 30 s, igual a "32:30"
  const mmss = /^(\d{1,3})[.,](\d{2})$/.exec(t);
  if (mmss) return Number(mmss[2]) > 59 ? NaN : emMin(Number(mmss[1]) * 60 + Number(mmss[2]));
  if (/[.,]/.test(t)) return NaN;
  if (t.includes(':')) {
    const p = t.split(':').map((x) => parseNum(x));
    if (p.some((x) => !Number.isFinite(x) || x < 0) || p.length > 3) return NaN;
    return p.length === 3 ? emMin(p[0] * 3600 + p[1] * 60 + p[2]) : emMin(p[0] * 60 + p[1]);
  }
  return parseNum(t);
}
const tempoTxt = (min) => { if (!min) return ''; const s = Math.round(min * 60); return s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s / 60); };
// minutos e segundos somados em segundos inteiros (32:20 não vira 32:18)
const emMin = (seg) => Math.round(seg) / 60;

// Cronômetro guiado. O andamento fica no estado (run.cron), com os instantes de início, fim da etapa e pausa: assim ele
// continua certo depois de recarregar ou fechar a página. As etapas são refeitas a partir do treino do dia.
let cronT = 0;
const NOME_PASSO = { aquecer: 'Aquecimento', correr: 'Corra', caminhar: 'Caminhe', trote: 'Trote leve', forte: 'Forte!', desaquecer: 'Volta à calma' };
const VALIDADE_CRON = 12 * 3600000; // um cronômetro esquecido há mais de 12 horas é descartado
// `esteira` (opcional): a versão do treino na esteira (logic/esteira.js); as etapas trazem a velocidade de cada uma
function cronometro(data, treino, aoTerminar, esteira = null) {
  const rp = treino.ritmo ? (treino.ritmo.de + treino.ritmo.ate) / 2 : 0;
  const passos = esteira ? etapasNaEsteira(esteira.blocos, rp) : expandirBlocos(treino.blocos, rp);
  const box = h('div', { class: 'card cron col' });
  // só a troca de etapa é anunciada ao leitor de tela; o relógio muda a cada segundo e fica fora do anúncio
  const fase = h('div', { class: 'cron-fase', 'aria-live': 'polite' }), tempo = h('div', { class: 'cron-tempo', role: 'timer', 'aria-live': 'off' }), sub = h('div', { class: 'small muted' }), prox = h('div', { class: 'small' });
  const acoes = h('div', { class: 'row' });
  const agora = () => Date.now();
  // assinatura das etapas: se o treino do dia mudou (dor, ajuste do plano), o cronômetro guardado não vale mais
  const chave = passos.reduce((x, p, i) => (x + (i + 1) * (p.seg + p.m + 7)) % 1999999973, passos.length);
  const guardado = state.run.cron;
  const vale = guardado && guardado.data === data && guardado.chave === chave && guardado.i < passos.length && guardado.inicio <= agora() + 60000 && guardado.pausadoEm <= agora() + 60000 && agora() - guardado.inicio < VALIDADE_CRON;
  let cron = vale ? { ...guardado } : null;
  const temTotal = passos.every((p) => p.seg > 0);
  const gravar = () => update((st) => { st.run.cron = cron ? { ...cron } : null; });
  const decorrido = () => Math.max(0, ((cron.terminado || cron.pausadoEm || agora()) - cron.inicio - cron.parado) / 1000);
  // começa a etapa i no instante t (o fim da etapa anterior, quando a troca foi pelo relógio)
  const iniciarPasso = (t) => { cron.inicioPasso = t; cron.fim = passos[cron.i].seg ? t + passos[cron.i].seg * 1000 : 0; };
  function avancar(t, aviso) {
    cron.i++;
    if (cron.i >= passos.length) {
      cron.i = passos.length - 1; cron.terminado = t;
      if (aviso) { tocarAlerta(); vibrate([300, 150, 300, 150, 300]); }
      keepAwake(false); gravar(); desenhar(); aoTerminar(Math.max(1, Math.round(decorrido() / 60)));
      return;
    }
    iniciarPasso(t);
    if (aviso) { beep(passos[cron.i].tipo === 'forte' || passos[cron.i].tipo === 'correr' ? 2 : 1); vibrate(); }
  }
  // a página ficou fechada ou parada: põe o cronômetro na etapa em que ele estaria agora, sem apitar por cada troca perdida
  function alcancar() {
    let mudou = false;
    while (cron && !cron.terminado && !cron.pausadoEm && cron.fim && cron.fim <= agora() - 1500) { avancar(cron.fim, false); mudou = true; if (cron.terminado) return; }
    if (mudou) gravar();
  }
  function desenhar() {
    while (acoes.firstChild) acoes.removeChild(acoes.firstChild);
    if (!cron) {
      box.className = 'card cron col';
      fase.textContent = 'Cronômetro guiado';
      // etapa por distância sem ritmo não tem duração certa: mostra a duração aproximada do treino
      tempo.textContent = temTotal ? fmtClock(passos.reduce((x, p) => x + p.seg, 0)) : `≈ ${treino.durMin} min`;
      sub.textContent = !temTotal ? 'As etapas por distância contam o tempo para cima: toque em “Próxima” quando completar a distância.' : passos.length > 1 ? `${passos.length} etapas. O aparelho apita e vibra a cada troca.` : 'Conta o tempo do treino e avisa no fim.';
      prox.textContent = '';
      acoes.appendChild(btn('Iniciar', () => { unlockAudio(); cron = { data, i: 0, fim: 0, pausadoEm: 0, inicio: agora(), parado: 0, inicioPasso: 0, terminado: 0, chave }; iniciarPasso(cron.inicio); keepAwake(true); beep(1); gravar(); desenhar(); }, 'primary lg grow', 'play'));
      return;
    }
    if (cron.terminado) {
      box.className = 'card cron col';
      fase.textContent = 'Treino concluído'; tempo.textContent = fmtClock(decorrido()); sub.textContent = 'Agora registre como foi, logo abaixo.'; prox.textContent = '';
      acoes.appendChild(btn('Fechar o cronômetro', () => { cron = null; gravar(); desenhar(); }, 'ghost grow'));
      return;
    }
    const p = passos[cron.i];
    box.className = 'card cron col ' + p.tipo;
    fase.textContent = NOME_PASSO[p.tipo] || p.rotulo;
    sub.textContent = `${p.rotulo}${p.vel ? ' · ' + p.vel : ''} · etapa ${cron.i + 1} de ${passos.length}` + (p.m ? ` · ${p.m >= 1000 ? fmtKm(p.m / 1000) : p.m + ' m'}` : '') + (p.seg && p.estimado ? ' (tempo aproximado)' : !p.seg ? ' · toque em “Próxima” ao completar' : '');
    const n = passos[cron.i + 1];
    prox.textContent = n ? `Depois: ${n.rotulo.toLowerCase()}${n.seg ? ' · ' + fmtClock(n.seg) : ''}${n.vel ? ' · ' + n.vel : ''}` : 'Última etapa';
    acoes.appendChild(btn(cron.pausadoEm ? 'Continuar' : 'Pausar', () => {
      unlockAudio();
      if (cron.pausadoEm) { const d = agora() - cron.pausadoEm; cron.parado += d; if (cron.fim) cron.fim += d; cron.inicioPasso += d; cron.pausadoEm = 0; keepAwake(true); } else { cron.pausadoEm = agora(); keepAwake(false); }
      gravar(); desenhar();
    }, 'grow', cron.pausadoEm ? 'play' : 'pause'));
    acoes.appendChild(btn('Próxima', () => { unlockAudio(); const t = cron.pausadoEm || agora(); avancar(t, false); if (!cron.terminado) { gravar(); desenhar(); } }, 'grow ghost', 'right'));
    acoes.appendChild(btn('Encerrar', async () => { if (await confirmSheet({ title: 'Encerrar o cronômetro?', text: 'O tempo corrido até aqui vai para o registro.', okLabel: 'Encerrar' })) { cron.terminado = cron.pausadoEm || agora(); keepAwake(false); gravar(); desenhar(); aoTerminar(Math.max(1, Math.round(decorrido() / 60))); } }, 'ghost', 'close'));
    tique();
  }
  function tique() {
    if (!cron || cron.terminado) return;
    const ref = cron.pausadoEm || agora();
    if (cron.fim) {
      const resta = (cron.fim - ref) / 1000;
      if (resta <= 0 && !cron.pausadoEm) { avancar(cron.fim, true); if (!cron.terminado) { alcancar(); if (!cron.terminado) { gravar(); desenhar(); } } return; }
      tempo.textContent = fmtClock(Math.max(0, Math.ceil(resta)));
    } else tempo.textContent = fmtClock((ref - cron.inicioPasso) / 1000); // etapa por distância sem ritmo: conta para cima; a pessoa avança
  }
  clearInterval(cronT);
  cronT = setInterval(tique, 250);
  box.appendChild(fase); box.appendChild(tempo); box.appendChild(sub); box.appendChild(prox); box.appendChild(acoes);
  if (cron && !cron.terminado && !cron.pausadoEm) { alcancar(); if (cron && !cron.terminado) keepAwake(true); }
  desenhar();
  return box;
}

function formulario(data, planejado, existente, aoFechar) {
  const r = existente ? { ...existente, dores: (existente.dores || []).map((d) => ({ ...d })) } : { id: 'c' + uid(), data, tipo: planejado && planejado.tipo !== 'descanso' ? planejado.tipo : 'livre', distKm: 0, durMin: 0, pse: null, dores: [], nota: '',
      // em dia que já passou, só vale o treino que o plano mostrou naquele dia; o previsto pelo plano de hoje não é gravado
      planejado: planejado && !planejado.estimado ? `${planejado.nome}: ${planejado.resumo}`.slice(0, 160) : '', plan: planejado && !planejado.estimado ? planejadoDe(planejado) : null };
  const card = h('div', { class: 'card col', id: 'registro' }, h('h3', { text: existente ? 'Editar o registro' : 'Como foi a corrida?' }));
  {
    // o tipo vem do treino do dia, mas dá para mudar (fez um treino forte no dia leve, trocou por caminhada...)
    const chips = h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': 'Tipo de corrida' });
    const draw = () => { while (chips.firstChild) chips.removeChild(chips.firstChild); for (const t of TIPOS_LIVRES) chips.appendChild(h('button', { type: 'button', class: 'chip' + (r.tipo === t ? ' on' : ''), role: 'radio', 'aria-checked': r.tipo === t ? 'true' : 'false', onClick: () => { r.tipo = t; draw(); if (typeof drawMedidas === 'function') drawMedidas(); } }, TIPOS_TREINO[t].nome)); };
    draw();
    card.appendChild(h('div', { class: 'col gap-s' }, comAjuda(h('div', { class: 'small bold muted', text: 'Tipo' }), 'Tipo da corrida', ['O tipo vem do treino do dia, mas dá para mudar (fez um treino forte no dia leve, trocou por caminhada...).', 'Marque “Teste de ritmo” ou “Dia da prova” em uma corrida forte e contínua: o resultado atualiza os seus ritmos.']), chips));
  }
  // onde correu: na esteira, o registro guarda local 'esteira' (conta igual na semana — logic/esteira.js)
  {
    if (!existente) r.local = naEsteira(state, data) || (planejado && planejado.modo === 'esteira') || (perfilAtual() || {}).local === 'esteira' ? 'esteira' : '';
    const locais = h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': 'Onde você correu' });
    const drawLocal = () => { while (locais.firstChild) locais.removeChild(locais.firstChild); for (const [v, nome] of [['', 'Rua ou pista'], ['esteira', 'Esteira']]) locais.appendChild(h('button', { type: 'button', class: 'chip' + ((r.local || '') === v ? ' on' : ''), role: 'radio', 'aria-checked': (r.local || '') === v ? 'true' : 'false', 'data-local': v || 'rua', onClick: () => { r.local = v; drawLocal(); if (typeof drawMedidas === 'function') drawMedidas(); } }, nome)); };
    drawLocal();
    card.appendChild(h('div', { class: 'col gap-s', id: 'registro-local' }, h('div', { class: 'small bold muted', text: 'Onde' }), locais));
  }
  // O que medir depende do treino e de como a pessoa mede (logic/corrida.js, aparelho):
  //  • caminhada: só o tempo (ninguém conta a distância da caminhada);
  //  • corrida e caminhada (etapas): quantas etapas de corrida foram feitas, e o tempo, se quiser;
  //  • teste de ritmo e prova: distância e tempo do trecho do teste (sem o aquecimento), os dois;
  //  • treino do plano por minutos: só os minutos; treino do plano por km: distância e tempo;
  //  • corrida fora do plano: com GPS, relógio ou esteira, distância e tempo; sem GPS, só o tempo (a distância fica
  //    escondida em "Tenho a distância").
  // Sem tempo nem distância, com um treino do plano, vale o tempo do plano (durEst: estimado, não entra no ritmo).
  const pf = perfilAtual() || {};
  const etapasDoPlano = planejado && planejado.tipo === 'corrida_caminhada' ? etapasDe(planejado) : 0;
  const unPlano = r.plan ? r.plan.un : '';
  const medeDistancia = () => r.tipo === 'teste' || r.tipo === 'prova' || (unPlano ? unPlano === 'd' : r.local === 'esteira' || pf.aparelho === 'gps' || pf.aparelho === 'esteira' || !!r.distKm);
  const modoDeMedir = () => (r.tipo === 'caminhada' ? 'tempo'
    : r.tipo === 'corrida_caminhada' && etapasDoPlano > 1 ? 'etapas'
      : medeDistancia() ? 'completo' : 'tempo');
  if (!existente && etapasDoPlano > 1 && r.tipo === 'corrida_caminhada') r.etapas = { feitas: etapasDoPlano, de: etapasDoPlano };
  // distância: só números, a vírgula entra sozinha (3, 0, 4 → 3,04)
  const kmTxt = (km) => (km ? (Math.round(km * 100) / 100).toFixed(2).replace('.', ',') : '');
  const dist = h('input', { class: 'input', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', value: kmTxt(r.distKm), placeholder: '0,00', 'aria-label': 'Distância em quilômetros' });
  dist.addEventListener('input', () => {
    const dig = dist.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5);
    dist.value = dig ? (Number(dig) / 100).toFixed(2).replace('.', ',') : '';
  });
  // tempo: horas, minutos e segundos em três campos, só números (1 h 13 min 48 s, como no relógio)
  const seg0 = Math.round((r.durMin || 0) * 60);
  const durHI = h('input', { class: 'input', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', maxlength: '2', value: seg0 >= 3600 ? String(Math.floor(seg0 / 3600)) : '', placeholder: 'h', 'aria-label': 'Tempo: horas' });
  const durMinI = h('input', { class: 'input', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', maxlength: '3', value: seg0 ? String(Math.floor((seg0 % 3600) / 60)) : '', placeholder: 'min', 'aria-label': 'Tempo: minutos' });
  const durSegI = h('input', { class: 'input', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', maxlength: '2', value: seg0 % 60 ? String(seg0 % 60).padStart(2, '0') : '', placeholder: 'seg', 'aria-label': 'Tempo: segundos' });
  for (const el of [durHI, durMinI, durSegI]) el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, ''); });
  const lerSegundos = () => (durHI.value ? Number(durHI.value) : 0) * 3600 + (durMinI.value ? Number(durMinI.value) : 0) * 60 + (durSegI.value ? Number(durSegI.value) : 0);
  // o pace calculado aparece na hora, com a distância e o tempo preenchidos (a média da sessão)
  const paceVivo = h('div', { class: 'small bold', id: 'pace-calculado', 'aria-live': 'polite' });
  const atualizarPace = () => {
    const km = dist.value ? parseNum(dist.value) : 0;
    const seg = lerSegundos();
    const ok = km > 0 && seg > 0 && seg / km >= 110 && seg / km <= 1800;
    paceVivo.textContent = ok ? `Pace: ${fmtRitmo(seg / km)} por km${r.plan && r.plan.trecho ? ' (média da sessão)' : ''}` : '';
    paceVivo.hidden = !ok;
  };
  for (const el of [durHI, durMinI, durSegI]) el.addEventListener('input', atualizarPace);
  dist.addEventListener('input', atualizarPace);
  durMinI.addEventListener('input', () => { if (durMinI.value.length >= 3) durSegI.focus(); });
  const campoTempo = h('div', { class: 'field grow' }, h('span', { text: 'Tempo' }), h('div', { class: 'row gap-s tempo-campos' }, durHI, h('span', { class: 'muted', text: 'h' }), durMinI, h('span', { class: 'muted', text: 'min' }), durSegI, h('span', { class: 'muted', text: 's' })));
  const campoDist = h('label', { class: 'field grow' }, h('span', { text: 'Distância (km)' }), dist);
  // pace do trecho principal (o que o relógio mostra durante a rodagem, os tiros ou o ritmo de limiar): opcional
  const trecho = r.plan && r.plan.trecho ? r.plan.trecho : null;
  const paceTxt = (seg) => (seg ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}` : '');
  const paceI = h('input', { class: 'input', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', value: paceTxt(r.paceTrecho), placeholder: '0:00', 'aria-label': 'Pace do trecho, em minutos por km' });
  paceI.addEventListener('input', () => {
    const dig = paceI.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 4);
    paceI.value = !dig ? '' : dig.length <= 2 ? `0:${dig.padStart(2, '0')}` : `${dig.slice(0, -2)}:${dig.slice(-2)}`;
  });
  const lerPace = () => { const m = /^(\d{1,2}):(\d{2})$/.exec(paceI.value.trim()); if (!m) return paceI.value.trim() ? NaN : 0; const seg = Number(m[1]) * 60 + Number(m[2]); return Number(m[2]) > 59 ? NaN : seg; };
  const nomeTrecho = trecho ? (/acelera|corrida leve/i.test(trecho.rotulo) ? 'da rodagem' : /tiro/i.test(trecho.rotulo) ? 'dos tiros' : /limiar/i.test(trecho.rotulo) ? 'no ritmo de limiar' : /prova/i.test(trecho.rotulo) ? 'no ritmo de prova' : /final/i.test(trecho.rotulo) ? 'no final forte' : `em “${trecho.rotulo.toLowerCase()}”`) : '';
  const campoPace = trecho ? h('div', { class: 'field' }, comAjuda(h('span', { text: `Pace ${nomeTrecho} (opcional)` }), 'Pace do trecho', [`É o pace que o relógio mostra ${nomeTrecho}, sem o aquecimento, as pausas e a caminhada.`, trecho.ritmo ? `A faixa do plano: ${paceTxt(trecho.ritmo[0])} a ${paceTxt(trecho.ritmo[1])} por km.` : 'Com um resultado de teste ou de prova, o plano passa a ter a faixa de ritmo para comparar.', 'Digite só os números: 5, 3, 0 vira 5:30.']), paceI) : null;
  let comDistancia = false; // sem GPS: a pessoa pode abrir o campo da distância
  const medidas = h('div', { class: 'col gap-s', id: 'registro-medidas' });
  const drawMedidas = () => {
    while (medidas.firstChild) medidas.removeChild(medidas.firstChild);
    const modo = modoDeMedir();
    medidas.dataset.modo = modo;
    if (modo === 'etapas') {
      if (!r.etapas) r.etapas = { feitas: etapasDoPlano, de: etapasDoPlano };
      medidas.appendChild(h('div', { class: 'row between' }, h('div', { class: 'col' }, h('span', { class: 'bold', text: 'Etapas de corrida feitas' }), h('span', { class: 'tiny muted', text: `O treino tinha ${etapasDoPlano}.` })),
        stepper({ value: r.etapas.feitas, min: 0, max: etapasDoPlano, step: 1, label: 'Etapas de corrida feitas', onChange: (v) => { r.etapas = { feitas: v, de: etapasDoPlano }; } })));
      medidas.appendChild(h('div', { class: 'row top' }, campoTempo));
      medidas.appendChild(h('p', { class: 'tiny muted', text: 'O tempo é opcional: o cronômetro guiado preenche sozinho.' }));
      return;
    }
    if (modo === 'tempo') {
      const mostraDist = comDistancia || !!r.distKm;
      // a distância é sempre opcional: o plano pode não pedir, mas a pessoa pode querer acompanhar (e o pace aparece)
      medidas.appendChild(h('div', { class: 'row top wrap' }, campoTempo, mostraDist ? campoDist : null));
      if (mostraDist) { medidas.appendChild(paceVivo); atualizarPace(); }
      const basta = r.tipo === 'caminhada' ? 'Na caminhada, basta o tempo.' : unPlano === 't' ? 'Este treino é por tempo: basta o tempo.' : 'Sem GPS, basta o tempo.';
      if (!mostraDist) medidas.appendChild(h('div', { class: 'row between' }, h('span', { class: 'tiny muted grow', text: basta }), btn('Informar a distância', () => { comDistancia = true; drawMedidas(); dist.focus(); }, 'plain sm')));
      // quem disse na entrevista que não mede a distância: ela fica no histórico, mas o treinador não se baseia nela
      else medidas.appendChild(h('p', { class: 'tiny muted', id: 'dist-nao-usada', text: naoMedeDe(state) && r.tipo !== 'teste' && r.tipo !== 'prova' ? 'Distância opcional: fica no seu histórico, com o pace. O treinador não se baseia nela, porque na entrevista você disse que não mede a distância: o plano segue pelo tempo e pelo esforço. Para mudar, refaça a entrevista.' : 'Distância opcional: fica no seu histórico, com o pace.' }));
      return;
    }
    medidas.appendChild(h('div', { class: 'row top' }, campoDist, campoTempo));
    medidas.appendChild(paceVivo); atualizarPace();
    medidas.appendChild(h('p', { class: 'tiny muted', text: r.tipo === 'teste' || r.tipo === 'prova' ? 'Só o trecho do teste ou da prova, sem o aquecimento: é o que atualiza os seus ritmos.' : 'Digite só os números: 3, 0, 4 vira 3,04 km.' }));
    if (campoPace && r.tipo !== 'teste' && r.tipo !== 'prova') medidas.appendChild(campoPace);
  };
  drawMedidas();
  card.appendChild(medidas);
  if (planejado && planejado.estimado && !existente) card.appendChild(note('info', 'O que o plano mostrava neste dia não ficou guardado: a corrida entra no volume da semana, sem comparação com o planejado.'));
  // esforço percebido
  // esforço: nada vem marcado; o que aparece escolhido é o que fica gravado
  const pseTxt = h('div', { class: 'small muted center' });
  const pseChips = h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': 'Esforço percebido' });
  const drawPse = () => {
    while (pseChips.firstChild) pseChips.removeChild(pseChips.firstChild);
    for (let v = 1; v <= 10; v++) pseChips.appendChild(h('button', { type: 'button', class: 'chip' + (r.pse === v ? ' on' : ''), role: 'radio', 'aria-checked': r.pse === v ? 'true' : 'false', 'aria-label': `Esforço ${v}: ${PSE_TXT[v]}`, onClick: () => { r.pse = r.pse === v ? null : v; drawPse(); } }, String(v)));
    pseTxt.textContent = r.pse ? PSE_TXT[r.pse] : (naoMedeDe(state) ? 'Não informado. Sem o esforço, a análise do treino fica só no tempo.' : 'Não informado. Sem o esforço, a análise do treino fica só no tempo e na distância.');
  };
  drawPse();
  card.appendChild(h('div', { class: 'col gap-s' }, comAjuda(h('div', { class: 'small bold', text: 'Esforço do treino, de 1 a 10' }), 'Esforço de 1 a 10', [...AJUDA_ESFORCO(), 'Pense no treino inteiro, uns minutos depois de terminar.']), pseChips, pseTxt));
  // dor: uma ou mais regiões, cada uma com a intensidade e o tipo
  const dorBox = h('div', { class: 'col gap-s', id: 'registro-dores' });
  let comDor = r.dores.length > 0;
  const drawDor = () => {
    while (dorBox.firstChild) dorBox.removeChild(dorBox.firstChild);
    if (!comDor) return;
    const chips = h('div', { class: 'chips wrap', role: 'group', 'aria-label': 'Onde doeu' });
    for (const k of LOCAIS_CORRIDA) {
      const on = r.dores.some((d) => d.onde === k);
      chips.appendChild(h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), role: 'checkbox', 'aria-checked': on ? 'true' : 'false', onClick: () => {
        if (on) r.dores = r.dores.filter((d) => d.onde !== k);
        else if (r.dores.length >= MAX_DORES_REGISTRO) { toast(`Marque até ${MAX_DORES_REGISTRO} regiões.`); return; }
        else r.dores.push({ onde: k, nivel: 3, tipo: '' });
        drawDor();
      } }, LOCAIS_DOR[k]));
    }
    dorBox.appendChild(comAjuda(h('div', { class: 'small bold', text: 'Onde doeu? Pode marcar mais de uma região.' }), 'Dores da corrida', ['Cada dor entra também em “Dores que você contou”, e o plano se ajusta.']));
    dorBox.appendChild(chips);
    for (const d of r.dores) dorBox.appendChild(linhaDeDor(d));
    if (r.dores.length) dorBox.appendChild(guiaDorMuscular());
  };
  // intensidade e tipo de uma região
  const linhaDeDor = (d) => {
    const temMusculo = MUSCULO_CORRIDA.has(d.onde);
    const tipos = temMusculo
      ? [['muscular', 'Músculo cansado ou dolorido', 'Dor espalhada, como desgaste ou peso'], ['articular', 'Dor em um ponto', 'Na articulação, no osso ou no tendão'], ['aguda', 'Fisgada, estalo ou inchaço', 'Ou dor que não deixa apoiar'], ['naosei', 'Não sei dizer', 'Por cautela, conta como dor em um ponto']]
      : [['articular', 'Dor em um ponto ou na articulação', ''], ['aguda', 'Fisgada, estalo ou inchaço', 'Ou dor que não deixa apoiar'], ['naosei', 'Não sei dizer', 'Por cautela, conta como dor em um ponto']];
    const box = h('div', { class: 'card col gap-s dor-reg', 'data-onde': d.onde });
    const opts = h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': `Como foi a dor: ${LOCAIS_DOR[d.onde]}` });
    const draw = () => {
      while (opts.firstChild) opts.removeChild(opts.firstChild);
      for (const [id, nome, sub] of tipos) opts.appendChild(h('button', { type: 'button', class: 'chip' + (d.tipo === id ? ' on' : ''), role: 'radio', 'aria-checked': d.tipo === id ? 'true' : 'false', title: sub, onClick: () => { d.tipo = id; draw(); } }, nome));
    };
    draw();
    box.appendChild(h('div', { class: 'row between' }, comAjuda(h('div', { class: 'bold', text: LOCAIS_DOR[d.onde] }), 'Intensidade da dor', ['De 1 (leve) a 10 (insuportável).', ...(temMusculo ? [] : ['Aqui não há um músculo grande: dor nesta região é tratada como de articulação, osso ou tendão.'])]),
      stepper({ value: d.nivel, min: 1, max: 10, step: 1, cls: 'sm', label: `Intensidade da dor: ${LOCAIS_DOR[d.onde]}`, onChange: (v) => { d.nivel = v; } })));
    box.appendChild(h('div', { class: 'tiny muted', text: 'Como foi?' }));
    box.appendChild(opts);
    return box;
  };
  card.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow small bold', text: 'Senti dor durante ou depois' }), toggle(comDor, (v) => { comDor = v; if (!v) r.dores = []; drawDor(); }, 'Senti dor')));
  card.appendChild(dorBox); drawDor();
  const nota = h('input', { class: 'input', type: 'text', maxlength: '200', value: r.nota, placeholder: 'Observação (opcional)', 'aria-label': 'Observação' });
  card.appendChild(nota);
  card.appendChild(h('div', { class: 'row' },
    aoFechar ? btn('Cancelar', aoFechar, 'ghost') : null,
    btn(existente ? 'Salvar alterações' : 'Registrar corrida', () => {
      const modo = modoDeMedir();
      const d = modo === 'completo' || (modo === 'tempo' && (comDistancia || r.distKm)) ? (dist.value.trim() ? parseNum(dist.value) : 0) : 0;
      const hh = durHI.value ? Number(durHI.value) : 0, mm = durMinI.value ? Number(durMinI.value) : 0, ss = durSegI.value ? Number(durSegI.value) : 0;
      if (ss > 59) { toast('Os segundos vão de 0 a 59.'); durSegI.focus(); return; }
      if (hh > 0 && mm > 59) { toast('Com as horas preenchidas, os minutos vão de 0 a 59.'); durMinI.focus(); return; }
      let t = emMin(hh * 3600 + mm * 60 + ss), durEst = false;
      if (!Number.isFinite(d) || d < 0 || d > 120) { toast('Confira a distância, em quilômetros.'); dist.focus(); return; }
      if (t > 900) { toast('Confira o tempo, em minutos.'); durMinI.focus(); return; }
      const pc = campoPace && modo === 'completo' && r.tipo !== 'teste' && r.tipo !== 'prova' ? lerPace() : 0;
      if (!Number.isFinite(pc) || (pc && (pc < 120 || pc > 1200))) { toast('Confira o pace, em minutos e segundos por km.'); paceI.focus(); return; }
      if ((r.tipo === 'teste' || r.tipo === 'prova') && (!d || !t)) { toast('No teste e na prova, informe a distância e o tempo do trecho.'); (d ? durMinI : dist).focus(); return; }
      // sem medir nada: vale o tempo do plano (proporcional às etapas feitas), marcado como estimado
      if (!d && !t) {
        const prev = r.plan && r.plan.durMin ? r.plan.durMin : 0;
        if (!prev) { toast(modo === 'completo' ? 'Informe a distância ou o tempo.' : 'Informe o tempo.'); (modo === 'completo' ? dist : durMinI).focus(); return; }
        const fr = modo === 'etapas' && r.etapas && r.etapas.de ? r.etapas.feitas / r.etapas.de : 1;
        t = Math.max(1, Math.round(prev * fr)); durEst = true;
      }
      if (comDor && !r.dores.length) { toast('Marque onde doeu, ou desligue “Senti dor”.'); return; }
      const semTipo = r.dores.find((x) => !x.tipo);
      if (semTipo) { toast(`Diga como foi a dor em ${LOCAIS_DOR[semTipo.onde].toLowerCase()}.`); const el = dorBox.querySelector(`[data-onde="${semTipo.onde}"]`); if (el) el.scrollIntoView({ block: 'center' }); return; }
      // "não sei dizer" vale como dor em um ponto (articulação, osso ou tendão), o lado mais cauteloso
      const limpo = limparRegistro({ ...r, dores: r.dores.map((x) => ({ ...x, tipo: x.tipo === 'naosei' ? 'articular' : x.tipo })), distKm: d, durMin: t, durEst, paceTrecho: pc || null, etapas: modo === 'etapas' ? r.etapas : null, nota: nota.value, local: r.local === 'esteira' ? 'esteira' : '' });
      if (!limpo) { toast('Esse ritmo não parece possível. Confira a distância e o tempo.'); return; }
      let reajuste = null;
      update((s) => {
        const i = s.runs.findIndex((x) => x.id === limpo.id);
        if (i >= 0) s.runs[i] = limpo; else s.runs.push(limpo);
        // corrida marcada "Não corri" (ou que mudou de dia) feita agora, num dia sem corrida do plano: a marca vira "feita"
        if (i < 0) { try { reajuste = reajustarDepoisDaCorrida(s, limpo, hojeKey()); } catch { reajuste = null; } if (reajuste) s.perdidos = reajuste.perdidos; }
        s.runs.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
        if (s.runs.length > MAX_REGISTROS) s.runs.splice(0, s.runs.length - MAX_REGISTROS);
        if (s.run.cron && (s.run.cron.terminado || s.run.cron.data === limpo.data)) s.run.cron = null; // a corrida do dia foi registrada: o cronômetro não continua rodando
        // cada dor anotada na corrida vira também um relato de dor (o mesmo que a musculação lê)
        // (se já há um relato do mesmo local nesse dia, fica o mais forte dos dois, e o tipo mais cauteloso)
        const GRAVIDADE = { muscular: 0, articular: 1, aguda: 2 };
        for (const rd of limpo.dores) {
          const relato = s.dores.find((x) => x.onde === rd.onde && x.data === limpo.data && !x.fim);
          if (relato) {
            if (rd.nivel > relato.nivel) relato.nivel = rd.nivel;
            if ((GRAVIDADE[rd.tipo] ?? 1) > (GRAVIDADE[relato.tipo] ?? 1)) relato.tipo = rd.tipo;
            continue;
          }
          const dor = limparDor({ id: 'dor' + uid(), data: limpo.data, onde: rd.onde, lado: '', tipo: rd.tipo, quando: rd.tipo === 'muscular' ? 'depois' : 'durante', nivel: rd.nivel, nota: 'Anotada em uma corrida', fim: '' });
          if (dor) s.dores.push(dor);
        }
        if (s.dores.length > MAX_DORES) s.dores.splice(0, s.dores.length - MAX_DORES);
      });
      if (!state.run.cron) { clearInterval(cronT); cronT = 0; keepAwake(false); }
      guardarMostrado();
      toast(soDorMuscularLeve(limpo.dores) ? 'Corrida registrada. Parece dor muscular comum de treino: costuma piorar em 1 a 3 dias e passar em até uma semana.'
        : existente ? 'Registro atualizado.' : reajuste ? 'Corrida registrada! ' + reajuste.textos.join(' ') : 'Corrida registrada! O plano leva em conta.');
      refresh();
    }, 'primary grow', 'check')));
  return { card, definirTempo: (min) => { if (!durHI.value.trim() && !durMinI.value.trim() && !durSegI.value.trim()) { const m = Math.round(min); if (m >= 60) { durHI.value = String(Math.floor(m / 60)); durMinI.value = String(m % 60); } else durMinI.value = String(m); } } };
}

// Fazer na esteira / Voltar para a rua. Marcado: o que muda na esteira (poucas linhas), os cuidados de segurança e o
// "Por quê?" com as fontes. Sem marcar: só um botão discreto, quando o dia pode ir para a esteira.
function cartaoEsteira(data, hoje, planejado, ves) {
  if (!planejado || planejado.tipo === 'descanso') return null;
  const trocar = (sim) => {
    let ok = false;
    update((s) => { ok = marcarEsteira(s, data, sim, hojeKey()); });
    if (ok) toast(sim ? 'Treino ajustado para a esteira.' : 'Treino de volta para a rua.');
    else toast(sim ? podeNaEsteira(state, data, hojeKey()).motivo || 'Não deu para trocar.' : 'Com o cronômetro rodando, termine ou encerre antes de trocar.');
    refresh();
  };
  if (!ves) {
    const pode = podeNaEsteira(state, data, hoje);
    return pode.pode ? btn('Fazer na esteira', () => trocar(true), 'block ghost sm', 'swap') : null;
  }
  const rodando = state.run.cron && state.run.cron.data === data && !state.run.cron.terminado;
  const feito = state.runs.some((r) => r.data === data);
  return h('div', { class: 'card col gap-s', id: 'corrida-esteira', 'data-inclinacao': ves.inclinacao },
    h('div', { class: 'row between' }, h('h3', { text: 'Na esteira' }), badge('Inclinação ' + ves.inclinacao, 'acc')),
    ves.velocidades.length ? h('div', { class: 'col gap-s' }, ...ves.velocidades.map((v) => h('div', { class: 'kv' }, h('span', { class: 'muted', text: v.trecho }), h('span', { class: 'nowrap', text: v.texto })))) : null,
    h('ul', { class: 'small' }, ...ves.linhas.slice(1).map((t) => h('li', { text: t }))),
    note('warn', ves.avisos.join(' ')),
    porQue(ves.detalhes.join(' '), ves.refs),
    !rodando && !feito ? btn('Voltar para a rua', () => trocar(false), 'block ghost sm', 'swap') : null);
}

export function corridaDiaView(data) {
  const hoje = hojeKey();
  if (!diaValido(data)) return { redirect: 'corrida' };
  const planejado = treinoDoDia(state, hoje, data);
  if (data === hoje) guardarMostrado();
  const registros = state.runs.filter((r) => r.data === data);
  const futuro = data > hoje;
  const body = [];
  body.push(h('div', { class: 'row between' }, h('h2', { text: DIAS_LONGO[new Date(data + 'T12:00:00').getDay()] + ', ' + Number(data.slice(8, 10)) + '/' + data.slice(5, 7) }), data === hoje ? badge('Hoje', 'acc') : registros.length ? badge('Feita', 'ok') : null));
  let form = null;
  // corrida do plano na esteira (logic/esteira.js): a versão ajustada, quando o dia está marcado
  const ves = planejado && planejado.tipo !== 'descanso' && naEsteira(state, data) ? versaoNaEsteira(state, data, hoje) : null;
  if (planejado) {
    // longo que não passa das outras corridas da semana aparece como rodagem leve (comoRodagem): a explicação acompanha
    const t = TIPOS_TREINO[planejado.comoRodagem ? 'leve' : planejado.tipo];
    const card = h('div', { class: 'card hl col' },
      h('div', { class: 'tiny accent bold', text: `SEMANA ${planejado.semana} · ${ROTULO.fase[planejado.fase].toUpperCase()}` }),
      h('h2', { text: planejado.nome }), h('p', { text: planejado.resumo }),
      // a mesma corrida na outra medida (km ou tempo): a pessoa escolhe a que puder usar no dia
      planejado.outraMedida && !ves ? h('p', { class: 'small outra-medida', text: planejado.outraMedida }) : null,
      h('p', { class: 'small muted', text: planejado.detalhe }));
    if (planejado.tipo !== 'descanso') {
      if (planejado.blocos.length > 1 || planejado.blocos.some((b) => b.repeticoes > 1)) {
        const ol = h('ol', { class: 'blocos' });
        if (ves) for (const txt of ves.resumoBlocos) ol.appendChild(h('li', { text: txt }));
        else for (const b of planejado.blocos) ol.appendChild(h('li', { text: textoBloco(b, planejado.modo) }));
        card.appendChild(ol);
      }
      card.appendChild(h('div', { class: 'col gap-s' },
        h('div', { class: 'kv' }, comAjuda(h('span', { class: 'muted', text: 'Esforço' }), 'Esforço de 1 a 10', AJUDA_ESFORCO()), h('span', { text: `${planejado.pse[0]} a ${planejado.pse[1]} em 10` })),
        h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Teste da fala' }), h('span', { text: planejado.fala })),
        planejado.ritmo && (planejado.modo !== 'tempo' || ves) ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: planejado.modo === 'esteira' || ves ? 'Velocidade' : 'Ritmo' }), h('span', { text: fmtFaixa(planejado.ritmo, ves ? 'esteira' : planejado.modo) })) : null,
        ves ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Inclinação' }), h('span', { text: ves.inclinacao })) : null,
        h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Duração' }), h('span', { text: `cerca de ${planejado.durMin} min` + (planejado.distKm && planejado.tipo !== 'caminhada' && (planejado.modo !== 'tempo' || ves || planejado.tipo === 'teste' || planejado.tipo === 'prova') ? ` · ${fmtKm(planejado.distKm)}${planejado.kmCorrendo ? ' no total' : ''}` : '') }))));
      if (t && t.paraQue) card.appendChild(porQue(t.paraQue + (t.sentir ? ' Como sentir: ' + t.sentir : ''), t.f, 'Para que serve este treino'));
      if (planejado.ajustado) card.appendChild(note('info', planejado.carga ? 'Este treino ficou mais leve por causa da sua semana puxada. Para voltar ao plano, use “Desfazer” em “Sua semana”.' : 'Este treino foi ajustado por causa de uma dor que você contou.'));
      if (planejado.guardado) card.appendChild(h('p', { class: 'tiny muted', text: 'É o treino que o plano mostrava neste dia.' }));
      if (planejado.estimado) card.appendChild(note('info', 'O que o plano mostrava neste dia não ficou guardado. Este é o treino previsto pelo plano de hoje, que pode ser diferente.'));
    }
    body.push(card);
    const est = cartaoEsteira(data, hoje, planejado, ves);
    if (est) body.push(est);
    if (planejado.tipo !== 'descanso' && !futuro && !registros.length && planejado.blocos.some((b) => b.seg || b.ritmo)) body.push(cronometro(data, planejado, (min) => { if (form) form.definirTempo(min); const el = document.getElementById('registro'); if (el) el.scrollIntoView({ block: 'start' }); }, ves));
  } else if (!registros.length) {
    body.push(h('div', { class: 'bubble' }, h('p', { text: state.run.aceitoEm && !state.run.pausadoEm ? 'Não há corrida do plano neste dia.' : 'Corrida livre.' }), h('p', { class: 'small muted', text: 'Se você correu, registre abaixo: o Treinador usa todas as corridas para acompanhar a sua evolução.' })));
  }
  // registros do dia
  let editando = '';
  const area = h('div', { class: 'col' });
  const desenhar = () => {
    while (area.firstChild) area.removeChild(area.firstChild);
    form = null;
    for (const r of state.runs.filter((x) => x.data === data)) {
      if (editando === r.id) { form = formulario(data, planejado, r, () => { editando = ''; desenhar(); }); area.appendChild(form.card); continue; }
      area.appendChild(h('div', { class: 'card col gap-s', 'data-registro': r.id },
        h('div', { class: 'row between' }, h('h3', { text: (TIPOS_TREINO[r.tipo] ? TIPOS_TREINO[r.tipo].nome : 'Corrida') + ' registrada' }), badge('Feita', 'ok')),
        h('p', { text: resumoRegistro(r) }), r.nota ? h('p', { class: 'small muted quebra', text: r.nota }) : null,
        r.planejado ? h('p', { class: 'tiny muted', text: 'No plano: ' + r.planejado }) : null,
        (() => { const a = analiseDoRegistro(state, hoje, r); return a ? analiseBox(a) : null; })(),
        h('div', { class: 'row' },
          btn('Editar', () => { editando = r.id; desenhar(); }, 'grow ghost sm', 'edit'),
          btn('Apagar', async () => {
            if (!(await confirmSheet({ title: 'Apagar este registro?', text: 'A corrida sai do seu histórico e da evolução. Não dá para desfazer.', okLabel: 'Apagar', danger: true }))) return;
            update((s) => { s.runs = s.runs.filter((x) => x.id !== r.id); }); toast('Registro apagado.'); refresh();
          }, 'grow ghost sm danger', 'trash'))));
    }
    const tem = state.runs.some((x) => x.data === data);
    if (futuro) area.appendChild(note('info', 'Este dia ainda não chegou. Você poderá registrar a corrida quando ela acontecer.'));
    else if (!tem) { form = formulario(data, planejado, null, null); area.appendChild(form.card); }
    else if (!editando) area.appendChild(btn('Registrar outra corrida neste dia', () => { editando = 'novo'; desenhar(); }, 'block ghost sm', 'plus'));
    // outra corrida no mesmo dia: entra com o mesmo treino planejado (a análise soma as corridas do dia)
    if (editando === 'novo') { form = formulario(data, planejado, null, () => { editando = ''; desenhar(); }); area.appendChild(form.card); }
  };
  desenhar();
  body.push(area);
  if (!futuro && data !== hoje) body.push(btn('Registrar uma corrida de hoje', () => go('corrida/dia/' + hoje), 'block ghost sm', 'plus'));
  return { title: 'Corrida', back: 'corrida', body, cleanup: () => { clearInterval(cronT); cronT = 0; const c = state.run.cron; if (!c || c.terminado || c.pausadoEm) keepAwake(false); } };
}

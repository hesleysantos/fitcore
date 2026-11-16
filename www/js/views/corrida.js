// Telas do Treinador de corrida: entrevista, proposta, painel do plano e o treino de cada dia (com cronômetro guiado e registro).
import { h, btn, icon, note, badge, sectionTitle, toggle, toast, confirmSheet, stepper, parseNum, plural, dateKey, fmtClock, uid, DIAS_CURTO, DIAS_LONGO } from '../ui.js';
import { state, update } from '../store.js';
import { go, refresh } from '../router.js';
import { interview, abasTreinador } from './coach.js';
import { cartaoDores } from './dor.js';
import { barChart } from './charts.js';
import { keepAwake, unlockAudio, beep, vibrate } from '../device.js';
import { buscarFaq } from '../data/knowledge.js';
import { REFS_CORRIDA, FAQ_CORRIDA, TIPOS_TREINO, FONTES_TELA } from '../data/corrida.js';
import {
  PERGUNTAS, ROTULO, respostasCompletas, gerarPlano, planoAtual, planoDaSemana, treinoDoDia, avisosBloqueio, inicioPara, diasDeForca, evolucao, alertas, dicas,
  efeitoDaDor, orientacaoDor, expandirBlocos, textoBloco, limparRegistro, MAX_REGISTROS, fmtRitmo, fmtFaixa, fmtKm, fmtTempo, fmtDia, somaDias, diaValido, diasEntre,
  retomarPlano, diaLocal, segundaDe, planejadoDe, analiseDoRegistro, analiseRecente, guardarDoDia, perfil,
} from '../logic/corrida.js';
import { faltaPerguntar } from '../logic/combinado.js';
import { cartaoCombinado, perguntarCombinado } from './combinado.js';
import { LOCAIS_DOR, doresAtivas, limparDor, MAX_DORES } from '../logic/dor.js';

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
function fontes(chaves) {
  const box = h('div', { class: 'col gap-s' });
  for (const k of chaves || []) if (REFS_CORRIDA[k]) box.appendChild(h('p', { class: 'ref', text: '• ' + REFS_CORRIDA[k] }));
  return box;
}
const acc = (titulo, ...filhos) => h('details', { class: 'acc' }, h('summary', { text: titulo }), h('div', null, ...filhos));
// "por quê" com as fontes, discreto
const porQue = (texto, refs, rotulo = 'Por quê?') => h('details', { class: 'pq' }, h('summary', { text: rotulo }), texto ? h('p', { class: 'small', text: texto }) : null, refs && refs.length ? h('div', { class: 'mt' }, h('div', { class: 'tiny bold muted', text: 'FONTES' }), fontes(refs)) : null);
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

const opcoesDoPlano = () => { const { forca, pernas } = diasDeForca(state); return { diasForca: forca, diasPernas: pernas, dores: doresAtivas(state, hojeKey()) }; };
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
    extra.push(h('p', { class: 'tiny muted', text: 'A previsão de maratona costuma ser otimista para quem treina pouco volume: por isso aparece como faixa.' }));
  } else extra.push(h('p', { class: 'small', text: 'Sem um resultado recente, os treinos são guiados pelo esforço e pelo teste da fala. Registre um “Teste de ritmo” de 3 km ou 5 km para ter ritmos calculados.' }));
  extra.push(porQue('A frequência cardíaca máxima é estimada pela idade e pode errar 10 batimentos ou mais. Prefira o esforço e a fala.', FONTES_TELA.zonas, 'Como é calculado'));
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
    const nomes = [...new Set(s.dias.filter((d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso').map((d) => TIPOS_TREINO[d.tipo].nome.toLowerCase()))];
    box.appendChild(h('div', { class: 'kv' }, h('span', { class: s.n === atual ? 'bold accent' : '' }, `Semana ${s.n} · ${ROTULO.fase[s.fase]}${s.descarga ? ' (leve)' : ''}`, h('div', { class: 'tiny muted', text: nomes.join(', ') || 'caminhada' })), h('span', { class: 'nowrap', text: volumeTxt(s) })));
  }
  return acc(`As ${p.totalSemanas} semanas do plano`, box, porQue('O volume sobe até 10% por semana, com uma semana 30% mais leve a cada quatro, até o que amadores costumam correr para cada distância; antes da prova ele diminui (polimento), mantendo a intensidade.', FONTES_TELA.semanas));
}
const orientacoesCard = (lista) => h('div', { class: 'col gap-s' }, ...lista.map(([t, txt, refs]) => acc(t, h('p', { text: txt }), refs ? porQue('', refs, 'Fontes') : null)));
function linhaDia(d, data, hoje, feito) {
  return h('button', { class: 'item' + (data === hoje ? ' hoje' : ''), type: 'button', 'data-data': data, onClick: () => go('corrida/dia/' + data) },
    h('div', { class: 'dia-wd', text: DIAS_CURTO[d.wd] }),
    h('div', { class: 'grow' }, h('div', { class: 't', text: d.nome }), h('div', { class: 's', text: d.resumo })),
    feito ? badge('Feita', 'ok') : data === hoje ? badge('Hoje', 'acc') : icon('right', 's muted'));
}

// ---------- proposta ----------
function proposta() {
  const a = state.run.answers;
  const hoje = hojeKey();
  const inicio = inicioPara(a, hoje);
  const adiado = inicio > segundaDe(hoje); // nesta semana não sobra dia de treino: o plano começa na segunda-feira
  const p = gerarPlano(a, { ...opcoesDoPlano(), dores: [], adiado }); // a proposta mostra o plano inteiro; as dores ajustam os dias depois do aceite
  const body = [cabecalho()];
  const mudar = btn('Mudar respostas', () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); }, 'block ghost', 'edit');
  if (!p) {
    for (const av of avisosBloqueio(a)) body.push(aviso(av));
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
  body.push(h('div', { class: 'bubble' },
    h('p', { text: `Montei um plano de ${plural(p.totalSemanas, 'semana', 'semanas')} para ${meta}, com ${quantas}.` }),
    pf.objetivo === 'prova' && dataProva ? h('p', { class: 'bold', text: `A prova fica em ${fmtDia(dataProva)}. Confira a data: se não for essa, toque em “Mudar respostas” e ajuste as semanas.` }) : null,
    h('p', { class: 'small muted', text: pf.nivel <= 1 ? 'Seus treinos vão por tempo e esforço: é a forma mais indicada para quem está começando.' : p.modo === 'gps' ? 'Seus treinos saem em distância e faixa de ritmo.' : p.modo === 'esteira' ? 'Seus treinos saem em distância e velocidade da esteira.' : 'Seus treinos saem em tempo e esforço.' })));
  for (const av of p.avisos) body.push(aviso(av));
  if (doresAtivas(state, hoje).length) body.push(note('info', 'Você tem uma dor registrada: depois de aceitar, os treinos dos próximos dias saem ajustados a ela.'));
  body.push(h('div', { class: 'card col gap-s' }, h('h3', { text: 'Resumo' }),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Nível' }), h('span', { text: ROTULO.nivel[pf.nivel] })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Dias' }), h('span', { text: s1.dias.map((d) => DIAS_CURTO[d.wd]).join(', ') })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Como medir' }), h('span', { text: ROTULO.modo[p.modo] })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Começa em' }), h('span', { text: fmtDia(inicio) })),
    dataProva ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: pf.objetivo === 'prova' ? 'Prova' : 'Dia do desafio' }), h('span', { text: fmtDia(dataProva) })) : null));
  body.push(sectionTitle('A primeira semana'));
  body.push(h('div', { class: 'card col gap-s' }, ...s1.dias.map((d) => h('div', { class: 'row top' }, h('div', { class: 'dia-wd', text: DIAS_CURTO[d.wd] }), h('div', { class: 'grow' }, h('div', { class: 'bold', text: d.nome }), h('div', { class: 'small muted', text: d.resumo }), d.ritmo ? h('div', { class: 'small', text: (p.modo === 'esteira' ? 'Velocidade: ' : 'Ritmo: ') + fmtFaixa(d.ritmo, p.modo) }) : null)))));
  body.push(semanasCard(p, 0));
  body.push(tiposCard(p));
  body.push(zonasCard(p));
  body.push(sectionTitle('Como seguir este plano'));
  body.push(orientacoesCard(p.orientacoes));
  let ciente = !pf.confirmar;
  const aceitar = btn('Aceitar e usar este plano', () => {
    if (!ciente) return;
    update((s) => { s.run.aceitoEm = new Date().toISOString(); s.run.inicio = inicioPara(s.run.answers, hojeKey()); s.run.pausadoEm = ''; s.run.pausas = []; s.run.cron = null; s.run.mostrados = []; s.run.degrau = null; });
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
  return body;
}

// ---------- painel ----------
function evolucaoCard(hoje) {
  const ev = evolucao(state.runs, hoje);
  const card = h('div', { class: 'card col' }, h('h3', { text: 'Sua evolução' }));
  if (!ev.totalCorridas) { card.appendChild(h('p', { class: 'small muted', text: 'Registre as corridas para ver aqui o volume, o ritmo e a constância. É pelos registros que o plano se ajusta.' })); return card; }
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
  return card;
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
  const body = [cabecalho()];
  const acoesFim = () => h('div', { class: 'col' },
    btn('Refazer a entrevista', async () => {
      if (!(await confirmSheet({ title: 'Refazer a entrevista?', text: 'Ao terminar as perguntas, o plano atual é trocado por um novo, que começa da semana 1. As corridas registradas continuam guardadas. Se desistir no meio, nada muda.', okLabel: 'Refazer' }))) return;
      modo = 'entrevista'; refresh(); window.scrollTo(0, 0);
    }, 'block ghost', 'edit'),
    btn('Encerrar o plano', async () => {
      if (!(await confirmSheet({ title: 'Encerrar o plano de corrida?', text: 'Os treinos de corrida saem da sua semana. As corridas registradas e as suas respostas continuam guardadas.', okLabel: 'Encerrar', danger: true }))) return;
      update((s) => { s.run.aceitoEm = ''; s.run.inicio = ''; s.run.pausadoEm = ''; s.run.pausas = []; s.run.cron = null; s.run.mostrados = []; s.run.degrau = null; });
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
  if (!p) { body.push(note('warn', 'Não consegui montar o plano com as respostas guardadas. Refaça a entrevista.')); body.push(acoesFim()); return body; }
  guardarMostrado();
  const sem = planoDaSemana(state, hoje);
  const pf = p.perfil;
  // semana atual
  const feitas = sem.dias.filter((d) => d && d.feito).length, previstas = sem.dias.filter((d) => d && d.tipo !== 'descanso').length;
  const pct = Math.min(100, Math.round(((sem.concluido ? p.totalSemanas : sem.semana - 1) / p.totalSemanas) * 10) * 10);
  const topo = h('div', { class: 'card hl col gap-s' },
    h('div', { class: 'row between' }, h('h2', { text: sem.antesDoInicio ? 'Plano aceito' : sem.concluido ? 'Plano concluído' : `Semana ${sem.semana} de ${sem.totalSemanas}` }), sem.antesDoInicio || sem.concluido ? null : badge(sem.fase, 'acc')),
    h('div', { class: 'barra-plano', role: 'progressbar', 'aria-label': 'Progresso do plano', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, h('i', { class: 'w' + pct })),
    h('p', { class: 'small muted', text: sem.antesDoInicio ? `${sem.fase}. Até lá, descanse ou caminhe.` : sem.concluido ? 'Parabéns por chegar ao fim! Refaça a entrevista para montar o próximo plano a partir de onde você está.' : `${sem.foco}. ${feitas} de ${previstas} treinos feitos nesta semana.` }),
    p.prova && p.prova.data >= hoje ? h('p', { class: 'small', text: `${p.prova.tipo === 'teste' ? 'Teste' : pf.objetivo === 'prova' ? 'Prova' : 'Desafio'} de ${ROTULO.distancia[pf.dist]}: ${fmtDia(p.prova.data)}, ${quando(diasEntre(hoje, p.prova.data))}.` }) : null);
  body.push(topo);
  // avisos graves (meta que não coube, prova retirada) ficam à vista, não só em "Cuidados"
  for (const av of p.avisos) if (av.destaque) body.push(aviso(av));
  // corrida e musculação: prioridade e fortalecimento (pergunta ou resumo da escolha)
  const combinado = cartaoCombinado({ aoMudar: () => refresh() });
  if (combinado) body.push(combinado);
  if (sem.concluido) body.push(btn('Montar um novo plano', () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); }, 'primary block', 'refresh'));
  // ajustes feitos e por quê
  if (p.ajustes.length) {
    body.push(h('div', { class: 'card col gap-s', 'data-ajustes': String(p.ajustes.length) }, h('h3', { text: 'O que ajustei no plano' }),
      ...p.ajustes.map((x) => h('div', { class: 'dica plana atencao' }, h('div', { class: 'dica-ic' }, icon('swap')), h('div', { class: 'grow' }, h('div', { class: 'small bold', text: x.texto }), porQue(x.motivo, x.refs))))));
  }
  for (const al of alertas(state.runs, hoje)) body.push(aviso(al));
  // os dias da semana
  if (!sem.antesDoInicio && !sem.concluido) {
    body.push(sectionTitle('Esta semana'));
    const lista = h('div', { class: 'list' });
    for (const wd of ORDEM) { const d = sem.dias[wd]; if (d) lista.appendChild(linhaDia(d, d.data, hoje, d.feito)); }
    body.push(lista);
    const prox = p.semanas[sem.semana];
    if (prox) body.push(acc(`Semana que vem (${volumeTxt(prox)})`, ...prox.dias.map((d) => h('div', { class: 'row top' }, h('div', { class: 'dia-wd', text: DIAS_CURTO[d.wd] }), h('div', { class: 'grow' }, h('div', { class: 'bold small', text: d.nome }), h('div', { class: 'small muted', text: d.resumo })))), h('p', { class: 'tiny muted', text: 'Pode mudar conforme o que você registrar nesta semana.' })));
  }
  body.push(btn('Registrar uma corrida', () => go('corrida/dia/' + hoje), 'block', 'plus'));
  // o que foi feito contra o que estava no plano
  const feitos = analiseRecente(state, hoje);
  if (feitos.itens.length) {
    const card = h('div', { class: 'card col gap-s', id: 'como-foram' }, h('h3', { text: 'Como foram os seus treinos' }),
      h('p', { class: 'small muted', text: 'Cada corrida registrada, comparada com o treino do dia. Toque para ver a análise.' }));
    for (const { registro: r, analise: a } of feitos.itens) {
      card.appendChild(h('button', { class: 'item', type: 'button', onClick: () => go('corrida/dia/' + r.data) },
        h('div', { class: 'grow' }, h('div', { class: 't', text: `${fmtDia(r.data)} · ${TIPOS_TREINO[r.tipo] ? TIPOS_TREINO[r.tipo].nome : 'Corrida'}` }), h('div', { class: 's', text: (a.itens.find((x) => x.tom === 'warn') || a.itens.find((x) => x.tom !== 'ok') || a.itens[0]).texto })),
        seloAnalise(a)));
    }
    for (const pd of feitos.padroes) card.appendChild(h('div', { class: 'dica plana atencao' }, h('div', { class: 'dica-ic' }, icon('info')), h('div', { class: 'grow' }, h('div', { class: 'small', text: pd.texto }), porQue('', pd.refs, 'Fontes'))));
    if (feitos.faltas.length) card.appendChild(h('p', { class: 'small muted', text: `${plural(feitos.faltas.length, 'treino do plano ficou', 'treinos do plano ficaram')} sem registro nas últimas 2 semanas. Treino perdido não se repõe: siga o plano.` }));
    body.push(card);
  }
  // dores: o mesmo registro vale para a musculação
  const pfDor = perfilAtual();
  body.push(cartaoDores({ extra: (d) => efeitoDaDor(d, pfDor).texto, aoMudar: () => refresh() }));
  const comOrientacao = doresAtivas(state, hoje).filter((d) => orientacaoDor(d.onde));
  if (comOrientacao.length) body.push(acc('O que fazer com essa dor na corrida', ...comOrientacao.flatMap((d) => { const o = orientacaoDor(d.onde); return [h('div', { class: 'bold', text: o.nome }), ...o.itens.map(([t, txt]) => h('p', { class: 'small' }, h('b', { text: t + ': ' }), txt)), porQue('', o.refs, 'Fontes')]; })));
  body.push(evolucaoCard(hoje));
  // corridas registradas
  const ult = state.runs.slice(-5).reverse();
  if (ult.length) {
    body.push(sectionTitle('Últimas corridas'));
    body.push(h('div', { class: 'list' }, ...ult.map((r) => h('button', { class: 'item', type: 'button', onClick: () => go('corrida/dia/' + r.data) },
      h('div', { class: 'grow' }, h('div', { class: 't', text: `${fmtDia(r.data)} · ${TIPOS_TREINO[r.tipo] ? TIPOS_TREINO[r.tipo].nome : 'Corrida'}` }), h('div', { class: 's', text: resumoRegistro(r) })), icon('right', 's muted')))));
  }
  // dicas
  body.push(sectionTitle('Dicas para você'));
  for (const d of dicas(run.answers).slice(0, 4)) body.push(h('div', { class: 'dica' }, h('div', { class: 'dica-ic' }, icon('bolt')), h('div', { class: 'grow' }, h('div', { class: 'bold', text: d.titulo }), h('div', { class: 'small', text: d.texto }), porQue('', d.refs, 'Fontes'))));
  // plano completo e cuidados
  body.push(sectionTitle('O seu plano'));
  body.push(h('div', { class: 'card col gap-s' },
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Objetivo' }), h('span', { text: ROTULO.objetivo[pf.objetivo] + (pf.dist ? ' · ' + ROTULO.distancia[pf.dist] : '') })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Nível' }), h('span', { text: ROTULO.nivel[pf.nivel] })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Como medir' }), h('span', { text: ROTULO.modo[p.modo] })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Musculação' }), h('span', { text: diasDeForca(state).forca.length ? diasDeForca(state).forca.map((wd) => DIAS_CURTO[wd]).join(', ') : 'sem treino marcado' }))));
  if (p.avisos.length) body.push(acc('Cuidados para o seu perfil', ...p.avisos.map(aviso)));
  body.push(semanasCard(p, sem.semana));
  body.push(tiposCard(p));
  body.push(zonasCard(p));
  body.push(acc('Como seguir o plano', orientacoesCard(p.orientacoes)));
  body.push(h('div', { class: 'col' },
    btn('Pausar o plano', async () => {
      if (!(await confirmSheet({ title: 'Pausar o plano?', text: 'Os treinos de corrida saem da sua semana até você retomar. Use para férias, doença ou uma semana corrida.', okLabel: 'Pausar' }))) return;
      update((s) => { s.run.pausadoEm = new Date().toISOString(); }); toast('Plano pausado.'); refresh(); window.scrollTo(0, 0);
    }, 'block ghost', 'pause'), acoesFim()));
  body.push(faq());
  return body;
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
    const pre = { ...a };
    for (const k of ['idade', 'peso', 'altura']) if (pre[k] == null) { const v = typeof state.trainer.answers[k] === 'number' ? state.trainer.answers[k] : state.nutri.answers[k]; if (typeof v === 'number') pre[k] = v; }
    return {
      title: 'Treinador', body: [interview({
        perguntas: PERGUNTAS, respostas: pre, avatar: 'run',
        onDone: (r) => { update((s) => { s.run.answers = r; s.run.aceitoEm = ''; s.run.inicio = ''; s.run.pausadoEm = ''; s.run.pausas = []; s.run.cron = null; s.run.mostrados = []; s.run.degrau = null; }); modo = 'proposta'; refresh(); window.scrollTo(0, 0); },
        onCancel: () => { modo = 'auto'; refresh(); },
      })],
    };
  }
  if (modo === 'proposta' || !state.run.aceitoEm) return { title: 'Treinador', body: proposta() };
  return { title: 'Treinador', body: painel() };
}

// ---------- treino do dia ----------
const PSE_TXT = ['', 'Muito, muito fácil', 'Fácil', 'Moderado', 'Um pouco difícil', 'Difícil', 'Difícil', 'Muito difícil', 'Muito difícil', 'Quase no limite', 'Máximo'];
const LOCAIS_CORRIDA = ['joelho', 'canela', 'panturrilha', 'aquiles', 'tornozelo', 'pe', 'coxa-frente', 'coxa-tras', 'quadril', 'virilha', 'gluteo', 'lombar'];
const TIPOS_LIVRES = ['livre', 'leve', 'longo', 'corrida_caminhada', 'progressivo', 'fartlek', 'tempo', 'intervalado', 'tiros', 'teste', 'prova', 'caminhada'];
function resumoRegistro(r) {
  const partes = [];
  if (r.distKm) partes.push(fmtKm(r.distKm));
  if (r.durMin) partes.push(fmtTempo(r.durMin * 60));
  if (r.distKm && r.durMin && r.tipo !== 'caminhada') partes.push(`${fmtRitmo((r.durMin * 60) / r.distKm)} por km`);
  if (r.pse) partes.push(`esforço ${r.pse}`);
  if (r.dor) partes.push(`dor em ${LOCAIS_DOR[r.dor.onde].toLowerCase()} (${r.dor.nivel})`);
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
function cronometro(data, treino, aoTerminar) {
  const passos = expandirBlocos(treino.blocos, treino.ritmo ? (treino.ritmo.de + treino.ritmo.ate) / 2 : 0);
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
      if (aviso) { beep(3); vibrate([300, 150, 300, 150, 300]); }
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
    sub.textContent = `${p.rotulo} · etapa ${cron.i + 1} de ${passos.length}` + (p.m ? ` · ${p.m >= 1000 ? fmtKm(p.m / 1000) : p.m + ' m'}` : '') + (p.seg && p.estimado ? ' (tempo aproximado)' : !p.seg ? ' · toque em “Próxima” ao completar' : '');
    const n = passos[cron.i + 1];
    prox.textContent = n ? `Depois: ${n.rotulo.toLowerCase()}${n.seg ? ' · ' + fmtClock(n.seg) : ''}` : 'Última etapa';
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
  const r = existente ? { ...existente, dor: existente.dor ? { ...existente.dor } : null } : { id: 'c' + uid(), data, tipo: planejado && planejado.tipo !== 'descanso' ? planejado.tipo : 'livre', distKm: 0, durMin: 0, pse: null, dor: null, nota: '',
      // em dia que já passou, só vale o treino que o plano mostrou naquele dia; o previsto pelo plano de hoje não é gravado
      planejado: planejado && !planejado.estimado ? `${planejado.nome}: ${planejado.resumo}`.slice(0, 160) : '', plan: planejado && !planejado.estimado ? planejadoDe(planejado) : null };
  const card = h('div', { class: 'card col', id: 'registro' }, h('h3', { text: existente ? 'Editar o registro' : 'Como foi a corrida?' }));
  {
    // o tipo vem do treino do dia, mas dá para mudar (fez um treino forte no dia leve, trocou por caminhada...)
    const chips = h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': 'Tipo de corrida' });
    const draw = () => { while (chips.firstChild) chips.removeChild(chips.firstChild); for (const t of TIPOS_LIVRES) chips.appendChild(h('button', { type: 'button', class: 'chip' + (r.tipo === t ? ' on' : ''), role: 'radio', 'aria-checked': r.tipo === t ? 'true' : 'false', onClick: () => { r.tipo = t; draw(); } }, TIPOS_TREINO[t].nome)); };
    draw();
    card.appendChild(h('div', { class: 'col gap-s' }, h('div', { class: 'small bold muted', text: 'Tipo' }), chips, h('p', { class: 'tiny muted', text: 'Marque “Teste de ritmo” ou “Dia da prova” em uma corrida forte e contínua: o resultado atualiza os seus ritmos.' })));
  }
  const dist = h('input', { class: 'input', type: 'text', inputmode: 'decimal', autocomplete: 'off', value: r.distKm ? virgula(r.distKm) : '', placeholder: 'Ex.: 5,2', 'aria-label': 'Distância em quilômetros' });
  const dur = h('input', { class: 'input', type: 'text', inputmode: 'text', autocomplete: 'off', value: tempoTxt(r.durMin), placeholder: 'Ex.: 32 ou 32:30', 'aria-label': 'Tempo em minutos, ou minutos e segundos' });
  card.appendChild(h('div', { class: 'row top' }, h('label', { class: 'field grow' }, h('span', { text: 'Distância (km)' }), dist), h('label', { class: 'field grow' }, h('span', { text: 'Tempo (min ou min:seg)' }), dur)));
  card.appendChild(h('p', { class: 'tiny muted', text: 'Tempo: 32 (minutos), 32:30 (minutos e segundos) ou 1:05:20 (horas, minutos e segundos).' }));
  if (planejado && planejado.estimado && !existente) card.appendChild(note('info', 'O que o plano mostrava neste dia não ficou guardado: a corrida entra no volume da semana, sem comparação com o planejado.'));
  card.appendChild(h('p', { class: 'tiny muted', text: 'Sem GPS aqui: digite a distância do relógio, do aplicativo de corrida ou da esteira. Se não souber, informe só o tempo.' }));
  // esforço percebido
  // esforço: nada vem marcado; o que aparece escolhido é o que fica gravado
  const pseTxt = h('div', { class: 'small muted center' });
  const pseChips = h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': 'Esforço percebido' });
  const drawPse = () => {
    while (pseChips.firstChild) pseChips.removeChild(pseChips.firstChild);
    for (let v = 1; v <= 10; v++) pseChips.appendChild(h('button', { type: 'button', class: 'chip' + (r.pse === v ? ' on' : ''), role: 'radio', 'aria-checked': r.pse === v ? 'true' : 'false', 'aria-label': `Esforço ${v}: ${PSE_TXT[v]}`, onClick: () => { r.pse = r.pse === v ? null : v; drawPse(); } }, String(v)));
    pseTxt.textContent = r.pse ? PSE_TXT[r.pse] : 'Não informado. Sem o esforço, a análise do treino fica só no tempo e na distância.';
  };
  drawPse();
  card.appendChild(h('div', { class: 'col gap-s' }, h('div', { class: 'small bold', text: 'Esforço do treino, de 1 (muito fácil) a 10 (máximo)' }), pseChips, pseTxt,
    h('p', { class: 'tiny muted', text: 'Pense no treino inteiro, uns minutos depois de terminar.' })));
  // dor
  const dorBox = h('div', { class: 'col gap-s' });
  const drawDor = () => {
    while (dorBox.firstChild) dorBox.removeChild(dorBox.firstChild);
    if (!r.dor) return;
    const chips = h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': 'Onde doeu' });
    for (const k of LOCAIS_CORRIDA) chips.appendChild(h('button', { type: 'button', class: 'chip' + (r.dor.onde === k ? ' on' : ''), role: 'radio', 'aria-checked': r.dor.onde === k ? 'true' : 'false', onClick: () => { r.dor.onde = k; drawDor(); } }, LOCAIS_DOR[k]));
    dorBox.appendChild(chips);
    dorBox.appendChild(h('div', { class: 'col gap-s center' }, h('div', { class: 'small bold', text: 'Intensidade da dor, de 1 a 10' }), stepper({ value: r.dor.nivel, min: 1, max: 10, step: 1, label: 'Intensidade da dor', onChange: (v) => { r.dor.nivel = v; } })));
    dorBox.appendChild(h('p', { class: 'tiny muted', text: 'A dor entra também em “Dores que você contou”, e o plano se ajusta.' }));
  };
  card.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow small bold', text: 'Senti dor durante ou depois' }), toggle(!!r.dor, (v) => { r.dor = v ? { onde: 'joelho', nivel: 3 } : null; drawDor(); }, 'Senti dor')));
  card.appendChild(dorBox); drawDor();
  const nota = h('input', { class: 'input', type: 'text', maxlength: '200', value: r.nota, placeholder: 'Observação (opcional)', 'aria-label': 'Observação' });
  card.appendChild(nota);
  card.appendChild(h('div', { class: 'row' },
    aoFechar ? btn('Cancelar', aoFechar, 'ghost') : null,
    btn(existente ? 'Salvar alterações' : 'Registrar corrida', () => {
      const d = dist.value.trim() ? parseNum(dist.value) : 0, t = lerTempo(dur.value);
      if (!Number.isFinite(d) || d < 0 || d > 120) { toast('Confira a distância, em quilômetros.'); dist.focus(); return; }
      if (!Number.isFinite(t) || t < 0 || t > 900) { toast('Confira o tempo: minutos (32) ou minutos:segundos (32:30).'); dur.focus(); return; }
      if (!d && !t) { toast('Informe a distância ou o tempo.'); dist.focus(); return; }
      const limpo = limparRegistro({ ...r, distKm: d, durMin: t, nota: nota.value });
      if (!limpo) { toast('Esse ritmo não parece possível. Confira a distância e o tempo.'); return; }
      update((s) => {
        const i = s.runs.findIndex((x) => x.id === limpo.id);
        if (i >= 0) s.runs[i] = limpo; else s.runs.push(limpo);
        s.runs.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
        if (s.runs.length > MAX_REGISTROS) s.runs.splice(0, s.runs.length - MAX_REGISTROS);
        if (s.run.cron && (s.run.cron.terminado || s.run.cron.data === limpo.data)) s.run.cron = null; // a corrida do dia foi registrada: o cronômetro não continua rodando
        // a dor anotada na corrida vira também um relato de dor (o mesmo que a musculação lê)
        // (se já há um relato do mesmo local nesse dia, fica o mais forte dos dois)
        const relato = limpo.dor ? s.dores.find((x) => x.onde === limpo.dor.onde && x.data === limpo.data && !x.fim) : null;
        if (relato && limpo.dor.nivel > relato.nivel) relato.nivel = limpo.dor.nivel;
        if (limpo.dor && !relato) {
          const dor = limparDor({ id: 'dor' + uid(), data: limpo.data, onde: limpo.dor.onde, lado: '', tipo: 'articular', quando: 'durante', nivel: limpo.dor.nivel, nota: 'Anotada em uma corrida', fim: '' });
          if (dor) { s.dores.push(dor); if (s.dores.length > MAX_DORES) s.dores.splice(0, s.dores.length - MAX_DORES); }
        }
      });
      if (!state.run.cron) { clearInterval(cronT); cronT = 0; keepAwake(false); }
      guardarMostrado();
      toast(existente ? 'Registro atualizado.' : 'Corrida registrada! O plano leva em conta.');
      refresh();
    }, 'primary grow', 'check')));
  return { card, definirTempo: (min) => { if (!dur.value.trim()) dur.value = String(min); } };
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
  if (planejado) {
    const t = TIPOS_TREINO[planejado.tipo];
    const card = h('div', { class: 'card hl col' },
      h('div', { class: 'tiny accent bold', text: `SEMANA ${planejado.semana} · ${ROTULO.fase[planejado.fase].toUpperCase()}` }),
      h('h2', { text: planejado.nome }), h('p', { text: planejado.resumo }), h('p', { class: 'small muted', text: planejado.detalhe }));
    if (planejado.tipo !== 'descanso') {
      if (planejado.blocos.length > 1 || planejado.blocos.some((b) => b.repeticoes > 1)) {
        const ol = h('ol', { class: 'blocos' });
        for (const b of planejado.blocos) ol.appendChild(h('li', { text: textoBloco(b, planejado.modo) }));
        card.appendChild(ol);
      }
      card.appendChild(h('div', { class: 'col gap-s' },
        h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Esforço' }), h('span', { text: `${planejado.pse[0]} a ${planejado.pse[1]} em 10` })),
        h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Teste da fala' }), h('span', { text: planejado.fala })),
        planejado.ritmo ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: planejado.modo === 'esteira' ? 'Velocidade' : 'Ritmo' }), h('span', { text: fmtFaixa(planejado.ritmo, planejado.modo) })) : null,
        h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Duração' }), h('span', { text: `cerca de ${planejado.durMin} min` + (planejado.distKm && planejado.tipo !== 'caminhada' ? ` · ${fmtKm(planejado.distKm)}` : '') }))));
      if (t && t.paraQue) card.appendChild(porQue(t.paraQue + (t.sentir ? ' Como sentir: ' + t.sentir : ''), t.f, 'Para que serve este treino'));
      if (planejado.ajustado) card.appendChild(note('info', 'Este treino foi ajustado por causa de uma dor que você contou.'));
      if (planejado.guardado) card.appendChild(h('p', { class: 'tiny muted', text: 'É o treino que o plano mostrava neste dia.' }));
      if (planejado.estimado) card.appendChild(note('info', 'O que o plano mostrava neste dia não ficou guardado. Este é o treino previsto pelo plano de hoje, que pode ser diferente.'));
    }
    body.push(card);
    if (planejado.tipo !== 'descanso' && !futuro && !registros.length && planejado.blocos.some((b) => b.seg || b.ritmo)) body.push(cronometro(data, planejado, (min) => { if (form) form.definirTempo(min); const el = document.getElementById('registro'); if (el) el.scrollIntoView({ block: 'start' }); }));
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

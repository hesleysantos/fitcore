// Assuntos do chat: problema de saúde que NÃO vem do treino (febre, diarreia, pancada, corte, pancada na cabeça, dor de
// cabeça, cólica, dor de dente). Puro: sem DOM. Formato em logic/chat/contrato.js.
// As regras, as perguntas e as fontes são as de logic/saude-fora.js (as mesmas da tela "Contar um problema de saúde"):
// aqui só a conversa, com no máximo 6 botões por pergunta, e a Acao que anota o problema em state.saudeFora.
// Para o motor: `sinaisDeEmergencia(textoNormalizado)` (reexportada daqui) acha, no texto livre, pancada na cabeça com
// sinal vermelho, febre com nuca dura ou manchas, dor de cabeça súbita e muito forte e sinais de AVC → { tipo, texto, refs }.
import { REFS } from '../../data/knowledge.js';
import { REFS_CORRIDA } from '../../data/corrida.js';
import { LOCAIS_DOR } from '../dor.js';
import { TIPOS_SAUDE, GRAUS_SAUDE, SINAIS, MAX_SAUDE, proximoPasso, novoProblema, efeitoDoProblema, efeitoDeHoje, sinaisDeEmergencia } from '../saude-fora.js';

export { sinaisDeEmergencia };

const refsOk = (l) => [...new Set((Array.isArray(l) ? l : []).filter((k) => typeof k === 'string' && (Object.prototype.hasOwnProperty.call(REFS, k) || Object.prototype.hasOwnProperty.call(REFS_CORRIDA, k))))];
const juntar = (l) => (l.length <= 1 ? l.join('') : l.slice(0, -1).join('; ') + '; ' + l[l.length - 1]);

// 1º nível: até 6 botões; alguns abrem uma escolha entre tipos parecidos
const GRUPOS = [
  { rotulo: 'Febre, gripe ou resfriado', valor: 'g-febre', tipos: ['febre', 'resfriado'] },
  { rotulo: 'Diarreia ou vômito', valor: 'estomago' },
  { rotulo: 'Pancada, queda ou torção', valor: 'g-pancada', tipos: ['pancada', 'cabeca'] },
  { rotulo: 'Corte ou furada', valor: 'corte' },
  { rotulo: 'Dor de cabeça', valor: 'dor-cabeca' },
  { rotulo: 'Cólica ou dor de dente', valor: 'g-outros', tipos: ['colica', 'dente'] },
];
const ROTULO_TIPO = { febre: 'Febre, gripe forte ou dor no corpo', resfriado: 'Só nariz ou garganta', pancada: 'No corpo (braço, perna...)', cabeca: 'Na cabeça', colica: 'Cólica menstrual', dente: 'Dor de dente' };
// regiões em grupos de até 6
const REGIOES = [
  { rotulo: 'Ombro, braço ou mão', valor: 'r-braco', locais: ['ombro', 'braco', 'cotovelo', 'punho'] },
  { rotulo: 'Pescoço, peito ou barriga', valor: 'r-frente', locais: ['pescoco', 'peito', 'abdomen'] },
  { rotulo: 'Costas', valor: 'r-costas', locais: ['coluna-alta', 'lombar'] },
  { rotulo: 'Quadril ou coxa', valor: 'r-quadril', locais: ['quadril', 'virilha', 'gluteo', 'coxa-frente', 'coxa-tras'] },
  { rotulo: 'Joelho ou perna', valor: 'r-perna', locais: ['joelho', 'canela', 'panturrilha'] },
  { rotulo: 'Tornozelo ou pé', valor: 'r-pe', locais: ['tornozelo', 'pe', 'aquiles'] },
];

// O tipo de problema dito na frase ("estou com dor de cabeça", "to com diarreia"): a conversa começa dele, sem perguntar
// de novo o que aconteceu. Texto normalizado (sem acento). '' quando a frase não diz.
const TIPO_NO_TEXTO = [
  ['cabeca', /\b(bati|bateu|batida|pancada|trauma|cai|caiu|queda)\b.*\bcabeca\b|\bcabeca\b.*\b(bati|bateu|batida|pancada)\b|\bconcussao\b/],
  ['dor-cabeca', /\b(dor|dores|doendo|doi|latej\w*) (de |na |da )?cabeca\b|\bcabeca (doendo|doi|latej\w*|explodindo)\b|\benxaqueca\b|\bcefaleia\b/],
  ['estomago', /\bdiarreia\b|\bvomit\w*\b|\bdor (de |na )?barriga\b|\bdor (de |no )?estomago\b|\benjo(o|ado|ada)\b|\bintestino solto\b|\bdesarranjo\b/],
  ['febre', /\bfebre\b|\bfebril\b|\bgripe\b|\bgripad[oa]\b|\bcalafrio\w*\b|\bcovid\b|\bvirose\b|\bdor no corpo\b|\bcorpo doendo\b/],
  ['resfriado', /\bresfria\w*\b|\bcoriza\b|\bnariz (escorrendo|entupido)\b|\bespirr\w*\b|\bgarganta\b|\btosse\b|\btossindo\b/],
  // ("furei o treino" é faltar, não se ferir)
  ['corte', /\bcortei\b|\bcorte\b|\bcortad[oa]\b|\bfurei\b(?! (o |a )?(treino|corrida|academia|dieta|aula|plano))|\bfurad[oa]\b|\bprego\b|\bcaco\b/],
  ['pancada', /\bbati\b|\bbatida\b|\bpancada\b|\bcai\b|\bqueda\b|\btombo\b|\btorci\b|\btorceu\b|\btorcao\b|\bentorse\b|\bcontusao\b|\bvirei o pe\b/],
  ['colica', /\bcolica\b|\bmenstrua\w*\b/],
  ['dente', /\bdente\b|\bdentes\b|\bsiso\b/],
];
export function tipoDoTexto(t) {
  const x = String(t || '');
  for (const [tipo, re] of TIPO_NO_TEXTO) if (re.test(x)) return tipo;
  return '';
}
// grau dito na frase ("dor de cabeça leve", "febre forte"): só quando é claro
const grauDoTexto = (t) => (/\b(leve|fraca|fraquinha|pouca|pouquinho)\b/.test(t) ? 'leve' : /\b(muito forte|forte|insuportavel|demais)\b/.test(t) ? 'forte' : '');

// Passo da próxima pergunta para as respostas `r` (cópia nova a cada resposta: voltar na conversa não estraga nada)
function perguntar(r, coach) {
  const passo = proximoPasso(r);
  const com = (k, v) => ({ ...r, [k]: v });
  const tp = r.tipo === 'resfriado' && r.vira === true ? 'febre' : r.tipo;
  const s = SINAIS[tp] || {};
  const simNao = (k, texto, itens, sim = 'Sim') => ({
    texto: [texto, ...(itens || []).map((t) => '• ' + t)],
    opcoes: [{ rotulo: sim, valor: 's' }, { rotulo: 'Não', valor: 'n' }],
    proximo: (v) => perguntar(com(k, v === 's'), coach),
  });
  if (passo === 'tipo') {
    return {
      texto: ['O que aconteceu? (algo que não veio do treino)'],
      opcoes: GRUPOS.map((g) => ({ rotulo: g.rotulo, valor: g.valor })),
      proximo: (v) => {
        const g = GRUPOS.find((x) => x.valor === v);
        if (!g) return perguntar(r, coach);
        if (!g.tipos) return perguntar(com('tipo', g.valor), coach);
        return { texto: ['Qual destes?'], opcoes: g.tipos.map((t) => ({ rotulo: ROTULO_TIPO[t], valor: t })), proximo: (t) => perguntar(com('tipo', TIPOS_SAUDE[t] ? t : g.tipos[0]), coach) };
      },
    };
  }
  if (passo === 'onde') {
    return {
      texto: ['Em que parte do corpo?'],
      opcoes: REGIOES.map((g) => ({ rotulo: g.rotulo, valor: g.valor })),
      proximo: (v) => {
        const g = REGIOES.find((x) => x.valor === v) || REGIOES[0];
        return { texto: ['Onde, exatamente?'], opcoes: g.locais.map((l) => ({ rotulo: LOCAIS_DOR[l], valor: l })), proximo: (l) => perguntar(com('onde', LOCAIS_DOR[l] ? l : g.locais[0]), coach) };
      },
    };
  }
  if (passo === 'urgente') return simNao('urgente', `${TIPOS_SAUDE[tp] ? TIPOS_SAUDE[tp].nome : 'Entendi'}. Antes, tem algum destes sinais?`, s.urgente, 'Sim, tenho');
  if (passo === 'vira') return simNao('vira', 'Junto com isso, tem algum destes?', s.vira);
  if (passo === 'atendimento') return simNao('atendimento', 'E algum destes?', s.atendimento);
  if (passo === 'detalhe') return simNao('detalhe', s.detalhe.pergunta, s.detalhe.itens);
  if (passo === 'grau' && tp === 'dor-cabeca') {
    // grau e "piora ao se mexer" numa pergunta só (a resposta que não é "piora" quer dizer que não piora)
    return {
      texto: ['Como está a dor?'],
      opcoes: [{ rotulo: 'Leve: dá para fazer tudo', valor: 'leve' }, { rotulo: 'Moderada: atrapalha um pouco', valor: 'moderada' }, { rotulo: 'Forte', valor: 'forte' }, { rotulo: 'Piora quando me mexo', valor: 'piora' }],
      proximo: (v) => perguntar(v === 'piora' ? { ...r, grau: 'moderada', piora: true } : { ...r, grau: GRAUS_SAUDE[v] ? v : 'forte', piora: false }, coach),
    };
  }
  if (passo === 'grau') {
    return { texto: ['Quanto incomoda?'], opcoes: Object.entries(GRAUS_SAUDE).map(([k, [nome, sub]]) => ({ rotulo: `${nome}: ${sub.toLowerCase()}`, valor: k })), proximo: (v) => perguntar(com('grau', GRAUS_SAUDE[v] ? v : 'forte'), coach) };
  }
  if (passo === 'piora' && r.grau === 'forte') return perguntar({ ...r, piora: false }, coach); // forte já tira o treino da região
  if (passo === 'piora') return simNao('piora', tp === 'dor-cabeca' ? 'Piora ao se mexer, andar ou subir escada?' : 'Dói mais quando você mexe essa região?', []);
  return montarDecisao(r, coach);
}

// O que o treinador decidiu, com a Acao que anota o problema. A decisão é a do dia em que se conta (dia 0); a data de
// verdade (ctx.hoje) entra na hora de anotar.
function montarDecisao(r, coach) {
  const hojeFicticio = '2000-01-01';
  const p0 = novoProblema('x', hojeFicticio, r);
  if (!p0) return { texto: ['Não consegui entender a resposta. Vamos de novo?'], opcoes: [{ rotulo: 'Recomeçar', valor: 'r' }, { rotulo: 'Deixar para depois', valor: 'f' }], proximo: (v) => (v === 'r' ? perguntar({}, coach) : { texto: ['Tudo bem. Quando quiser, conte de novo.'] }) };
  const ef = efeitoDoProblema(p0, hojeFicticio);
  const nome = TIPOS_SAUDE[p0.tipo].curto + (p0.onde ? ' (' + LOCAIS_DOR[p0.onde].toLowerCase() + ')' : '');
  const doCoach = coach === 'corrida'
    ? (ef.corrida === 'sem' ? 'Corrida: nenhuma por enquanto.' : ef.corrida === 'metade' ? 'Corrida: só leve e pela metade.' : ef.corrida === 'leve' ? 'Corrida: só leve.' : 'Corrida: segue o plano.')
    : (ef.musc === 'sem' ? 'Musculação: nenhuma por enquanto.' : ef.musc === 'leve' ? 'Musculação: só leve.' : ef.regiao ? (ef.regiao.modo === 'bloqueia' ? 'Musculação: o resto do corpo treina; a região fica de fora.' : 'Musculação: normal, com menos carga na região.') : 'Musculação: segue o plano.');
  const muda = ef.musc !== 'normal' || ef.corrida !== 'normal' || !!ef.regiao;
  // uma fala só: o que fazer hoje. A linha do treino deste treinador entra só quando diz algo a mais (a região)
  const passo = {
    texto: [`${ef.titulo}. ${ef.texto}`, ...(ef.regiao && ef.nivel !== 'urgente' && ef.nivel !== 'atendimento' ? [doCoach] : [])],
    detalhes: ef.porque,
    refs: refsOk(ef.refs),
    acoes: [{
      rotulo: muda ? 'Ajustar o treino de hoje' : 'Anotar',
      confirmar: `Vou anotar ${nome}. ${ef.titulo}.`,
      aplicar: (s, ctx) => {
        const hoje = ctx && typeof ctx.hoje === 'string' ? ctx.hoje : '';
        const id = 'sf' + Number(ctx && ctx.agora ? ctx.agora : 0).toString(36) + (Array.isArray(s.saudeFora) ? s.saudeFora.length : 0);
        const p = novoProblema(id, hoje, r);
        if (!p) return false;
        if (!Array.isArray(s.saudeFora)) s.saudeFora = [];
        s.saudeFora.push(p);
        if (s.saudeFora.length > MAX_SAUDE) s.saudeFora.splice(0, s.saudeFora.length - MAX_SAUDE);
        return undefined;
      },
      depois: ef.musc === 'sem' ? 'Anotado. Quando melhorar, toque em “Melhorou” no Início.' : 'Anotado. O treino de hoje já leva isso em conta.',
    }],
  };
  if (ef.nivel === 'urgente') passo.aviso = { tipo: 'danger', texto: 'Ligue 192 (SAMU) ou vá a um pronto-socorro agora.' };
  else if (ef.nivel === 'atendimento') passo.aviso = { tipo: 'warn', texto: ef.texto };
  else if (ef.aviso) passo.aviso = { tipo: 'warn', texto: ef.aviso };
  return passo;
}

// Já há um problema anotado que muda o treino hoje? Mostra antes de perguntar de novo.
function inicio(coach) {
  return (ctx) => {
    let e = null;
    try { e = efeitoDeHoje(ctx.st, ctx.hoje); } catch { e = null; }
    const ativos = e ? e.itens.filter((x) => x.ef.fase === 'ativo') : [];
    const t = ctx && typeof ctx.texto === 'string' ? ctx.texto : '';
    const tipo = tipoDoTexto(t);
    const r0 = tipo ? { tipo, ...(grauDoTexto(t) && tipo !== 'pancada' && tipo !== 'corte' ? { grau: grauDoTexto(t) } : {}) } : {};
    if (!ativos.length) return perguntar(r0, coach);
    const { p, ef } = ativos[0];
    return {
      texto: [`Você já contou ${TIPOS_SAUDE[p.tipo].curto}${p.onde ? ' (' + LOCAIS_DOR[p.onde].toLowerCase() + ')' : ''}. ${ef.titulo}.`, 'Quando melhorar, toque em “Melhorou” no cartão do Início.'],
      detalhes: ef.porque,
      refs: refsOk(ef.refs),
      opcoes: [{ rotulo: 'Contar outro problema', valor: 'novo' }, { rotulo: 'Está tudo certo', valor: 'ok' }],
      proximo: (v) => (v === 'novo' ? perguntar(r0, coach) : { texto: ['Combinado. Melhoras!'] }),
    };
  };
}

// palavras: minúsculas, sem acento (ver contrato.js)
const PALAVRAS = [
  '!febre', 'febre alta', 'com febre', 'temperatura', 'termometro', 'febril', 'estou febre', '!gripe', '!gripado', '!gripada', 'resfriado', 'resfriada', 'resfriei', 'nariz escorrendo', 'coriza', 'espirrando', 'dor garganta', 'garganta inflamada', 'tosse', 'tossindo', 'covid', 'dor corpo', 'corpo doendo', 'calafrio', 'doente', 'estou doente', 'fiquei doente', 'passando mal', 'mal estar', 'virose', 'infeccao',
  '!diarreia', '!vomito', 'vomitei', 'vomitando', 'enjoo', 'enjoado', 'enjoada', 'dor barriga', 'intestino solto', 'dor estomago',
  '!pancada', 'batida', '!bati', 'bati perna', 'bati joelho', 'bati braco', 'bati cabeca', 'bati com', '!cai', 'cai bicicleta', 'cai moto', 'cai escada', 'levei queda', '!queda', '!tombo', 'levei tombo', '!torci', 'torceu pe', 'torci+tornozelo', 'torci pe', 'torci tornozelo', 'virei pe', 'roxo', 'hematoma', 'contusao', 'inchado', 'trombei', 'acidente',
  '!cortei', 'corte', 'cortado', 'cortei pe', 'cortei mao', 'cortei dedo', 'furei', 'furei pe', 'furei mao', 'furei dedo', 'furada', 'furou pe', 'pisei prego', '!prego', 'vidro', 'caco vidro', 'faca', 'ferimento', 'machucado aberto', 'pontos', 'tetano', 'antitetanica',
  '!dor cabeca', 'cabeca doendo', '!enxaqueca', 'cefaleia', 'pancada cabeca', 'concussao',
  '!colica', 'colica menstrual', 'menstruacao', 'menstruada', 'periodo menstrual',
  '!dente', 'dor dente', 'dente doendo', 'dentista', 'siso',
];
const titulo = 'Problema de saúde fora do treino';
export const INTENCOES = [
  { id: 'saude-fora-treino', coach: 'treinador', titulo, resumo: 'um problema de saúde que não veio do treino (febre, pancada, corte, dor de cabeça...)', palavras: PALAVRAS, prioridade: 3, bonus: (i) => (tipoDoTexto(i.texto) ? 3 : 0), inicio: inicio('treinador') },
  { id: 'saude-fora-corrida', coach: 'corrida', titulo, resumo: 'um problema de saúde que não veio da corrida (febre, pancada, corte, dor de cabeça...)', palavras: PALAVRAS, prioridade: 3, bonus: (i) => (tipoDoTexto(i.texto) ? 3 : 0), inicio: inicio('corrida') },
];
// (para testes e para o motor, se quiser mostrar a lista) — os sinais de emergência de cada tipo, em texto corrido
export const resumoDosSinais = (tipo) => (SINAIS[tipo] && SINAIS[tipo].urgente ? juntar(SINAIS[tipo].urgente) : '');
// Passo para o motor mostrar quando sinaisDeEmergencia acha um sinal de alarme no texto: a conversa para aqui.
export function passoDeEmergencia(r) {
  if (!r || typeof r !== 'object' || typeof r.texto !== 'string') return null;
  return {
    aviso: { tipo: 'danger', texto: r.texto },
    texto: ['Não treine hoje. Primeiro, a avaliação.', 'Depois de atendido, conte aqui como ficou: o treino volta aos poucos.'],
    refs: refsOk(r.refs),
  };
}

// Motor do chat com os treinadores: o registro dos assuntos, o reconhecimento do texto livre e os sinais de alerta.
// Puro: sem DOM, sem internet e sem IA. Formato dos assuntos e dos passos em logic/chat/contrato.js.
//
// Como o texto livre é lido (tudo aqui, sem modelo de linguagem):
//  1. normaliza: minúsculas, sem acento, sem pontuação; tira as palavras de ligação ("de", "o", "pra"...);
//  2. cada palavra vira a forma de referência pelos sinônimos ("malhar" → "treino", "choveu" → "chuva"); palavras de 5
//     letras ou mais que o app não conhece são comparadas com as que ele conhece, tolerando 1 erro de digitação (2 a
//     partir de 8 letras; troca de duas letras vizinhas conta como 1);
//  3. SINAIS DE ALERTA antes de tudo (vale para todos os treinadores, inclusive a Nutricionista): dor ou aperto no peito,
//     falta de ar, desmaio, tontura, palpitação, suor frio, urina escura. Com um deles, a conversa para e mostra primeiro a
//     orientação de segurança que o app já usa: parar o exercício e procurar atendimento; em emergência, 192 (SAMU)
//     (refs ms_infarto e whitfield2017, as mesmas de logic/corrida.js e logic/trainer.js). Logo depois, os sinais de risco
//     alimentar ou à vida que logic/chat/nutri.js reconhece (sinaisDeRisco / passoDeRisco), também em todos os chats
//     (o alerta físico vem primeiro; o passo de risco já cita o 192 e o 188);
//  4. pontua cada assunto do treinador pelas expressões que aparecem (expressão mais longa vale mais; com erro de
//     digitação vale um pouco menos); expressão negada ("não estou com dor") não conta;
//  5. só diz "Entendi que você quer..." com pontuação boa e bem à frente do segundo colocado; senão mostra os 3 assuntos
//     mais próximos e as perguntas frequentes que batem (buscarFaq). Sempre confirma antes de seguir.
import { COACHES } from './contrato.js';
import { INTENCOES as I_TREINO } from './treino.js';
import { INTENCOES as I_CORRIDA } from './corrida.js';
import * as NUTRI from './nutri.js';
import { refsValidas } from './comum.js';
import { FAQ_TREINO, FAQ_NUTRI, buscarFaq } from '../../data/knowledge.js';
import { FAQ_CORRIDA } from '../../data/corrida.js';

export const LIMIAR = 2.5;   // pontos mínimos para "Entendi que você quer..."
export const FOLGA = 1;      // vantagem mínima sobre o segundo assunto
const FAQ_DO = { treinador: FAQ_TREINO, corrida: FAQ_CORRIDA, nutri: FAQ_NUTRI };

// ---------- registro ----------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const intencaoValida = (i) => isObj(i) && typeof i.id === 'string' && i.id && Object.prototype.hasOwnProperty.call(COACHES, i.coach)
  && typeof i.titulo === 'string' && i.titulo && typeof i.resumo === 'string' && Array.isArray(i.palavras) && typeof i.inicio === 'function';
let registro = null;
// Os assuntos de todos os treinadores, validados e sem id repetido. Montado na primeira chamada (e não ao carregar o
// módulo): um módulo de assuntos que importe peças do motor não cai em importação circular.
export function intencoes() {
  if (registro) return registro;
  const vistos = new Set(), out = [];
  for (const lista of [I_TREINO, I_CORRIDA, NUTRI.INTENCOES]) {
    for (const i of Array.isArray(lista) ? lista : []) {
      if (!intencaoValida(i) || vistos.has(i.id)) continue;
      vistos.add(i.id);
      out.push(i);
    }
  }
  registro = out;
  return out;
}
const disponivel = (i, ctx) => { if (typeof i.disponivel !== 'function') return true; try { return !!i.disponivel(ctx); } catch { return false; } };
// Assuntos de um treinador que fazem sentido agora (na ordem dos módulos)
export const assuntos = (coach, ctx) => intencoes().filter((i) => i.coach === coach && disponivel(i, ctx));
export const intencaoPorId = (id) => intencoes().find((i) => i.id === id) || null;

// ---------- texto ----------
export const normalizar = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// palavras de ligação: não mudam o assunto ("estou com dor" e "dor" são o mesmo pedido)
const LIGACAO = new Set(('a o os as e de do da dos das em no na nos nas num numa um uma uns umas para pra pro pros por pelo pela pelos pelas com '
  + 'que se me eu meu minha meus minhas mim te ti voce vc ao aos ou mas tambem ja la isso esse essa este isto aquele aquela ele ela '
  + 'hoje agora entao ai aqui muito muita bem tipo ne oi ola bom boa').split(' '));
const NEGA = new Set(['nao', 'nem', 'sem', 'nunca', 'jamais', 'nenhum', 'nenhuma']);
// palavras que podem ficar entre a negação e o que ela nega ("não ESTOU com dor", "não TENHO falta de ar")
const ENTRE = new Set(['estou', 'to', 'tou', 'esta', 'ta', 'estava', 'tenho', 'tive', 'tinha', 'sinto', 'senti', 'sentindo', 'tendo', 'ter', 'sentir', 'estar', 'ando', 'fiquei', 'ficou', 'mais', 'sou', 'era', 'foi', 'deu', 'houve', 'existe', 'tem', 'teve', 'estive', 'estamos', 'sinta']);
// sinônimos → forma de referência (as expressões dos assuntos passam pela mesma troca, então valem as duas formas)
const GRUPOS = {
  treino: 'treino treinos treinar treinei treinou treinando treinamento treinamentos malhar malho malhei malhando malhacao malhação academia_treino',
  correr: 'correr corrida corridas corri corro correndo corre corrido_x rodagem trote trotar corridinha',
  chuva: 'chuva chuvas chovendo choveu chover chove chuvoso chuvosa temporal tempestade garoa garoando molhado molhada',
  esteira: 'esteira esteiras treadmill',
  cansado: 'cansado cansada cansaco cansei exausto exausta exaustao esgotado esgotada moido moida acabado acabada quebrado quebrada fadiga indisposto indisposta desanimado desanimada preguica',
  dormir: 'dormir dormi dormiu durmo sono insonia acordei',
  dor: 'dor dores doendo doi doeu doer dolorido dolorida doloridos doloridas machuquei machucado machucada machucou lesao lesionei lesionado lesionada contusao contundi torci torceu incomodo incomodando incomoda',
  doente: 'doente gripe gripado gripada resfriado resfriada febre virose covid enjoado enjoada',
  viagem: 'viagem viajar viajando viajei viajo viajarei ferias hotel',
  tempo: 'tempo',
  minuto: 'minuto minutos min',
  pressa: 'pressa correria apressado apressada atrasado atrasada',
  carga: 'carga cargas peso pesos quilo quilos kg kilo kilos anilha anilhas',
  repeticao: 'repeticao repeticoes reps rep',
  serie: 'serie series',
  descanso: 'descanso descansar descansos intervalo intervalos',
  aparelho: 'aparelho aparelhos maquina maquinas equipamento equipamentos banco estacao',
  ocupado: 'ocupado ocupada ocupados ocupadas lotado lotada cheio cheia fila usando',
  juntar: 'juntar junto juntos junta juntei emendar emendado emendada combinar combinado seguido seguida seguidos sequencia colado colados',
  musculacao: 'musculacao musculação ferro forca_x',
  academia: 'academia academias',
  casa: 'casa',
  mudar: 'mudar mudo mudei mudanca trocar troco troca trocas alterar alteracao modificar ajustar ajuste refazer',
  plano: 'plano planos programa ficha',
  dia: 'dia dias',
  faltar: 'faltar faltei falto faltando falta_x perder perdi perdendo pular pulei pulo',
  curto: 'curto curta rapido rapida reduzido reduzida resumido resumida',
  prioridade: 'prioridade prioridades priorizar foco',
  recomendacao: 'recomendacao recomendacoes recomenda recomendado sugestao sugestoes sugere conselho dica dicas',
  conseguir: 'conseguir consigo consegui conseguindo',
  poder: 'posso pode poder podia',
  ir: 'ir vou vai',
};
const SIN = new Map();
for (const [canon, lista] of Object.entries(GRUPOS)) for (const w of lista.split(' ')) if (!w.includes('_')) SIN.set(w, canon);

// ---------- sinais de alerta ----------
// Ids, expressões (sem acento; passam pelos mesmos sinônimos) e a orientação. O texto é o que o app já usa: logic/trainer.js
// ("pare o exercício e procure atendimento") e logic/corrida.js ("ligue 192 (SAMU)"; ms_infarto, whitfield2017); urina
// escura com dor muscular forte: views/corrida.js (cdc_rabdo).
const ALERTAS = [
  { id: 'peito', frases: ['dor peito', 'peito dor', 'aperto peito', 'peito apertado', 'pressao peito', 'peso peito', 'queimacao peito', 'pontada peito', 'dor toracica', 'infarto', 'enfarte', 'ataque cardiaco', 'dor braco esquerdo', 'dor mandibula', 'dor queixo'] },
  { id: 'ar', frases: ['falta ar', 'faltando ar', 'faltou ar', 'sem ar', 'nao consigo respirar', 'nao conseguia respirar', 'dificuldade respirar', 'dificuldade pra respirar', 'respirar mal', 'sufocado', 'sufocada', 'sufocando', 'sufoco', 'chiado peito'] },
  { id: 'desmaio', frases: ['desmaio', 'desmaiei', 'desmaiou', 'desmaiar', 'desmaiando', 'perdi consciencia', 'perdi sentidos', 'vista escureceu', 'escureceu vista', 'vista escura', 'vista turva'] },
  { id: 'tontura', frases: ['tontura', 'tonturas', 'tonto', 'tonta', 'zonzo', 'zonza', 'vertigem', 'cabeca rodando', 'tudo girando', 'mundo girando'] },
  { id: 'palpitacao', frases: ['palpitacao', 'palpitacoes', 'coracao disparado', 'coracao disparou', 'coracao disparando', 'coracao acelerado', 'coracao acelerou', 'taquicardia', 'arritmia', 'coracao batendo forte', 'coracao descompassado', 'coracao falhando', 'batedeira'] },
  { id: 'suor', frases: ['suor frio', 'suando frio', 'suei frio'] },
  { id: 'urina', frases: ['urina escura', 'xixi escuro', 'urina marrom', 'xixi marrom', 'urina cor coca', 'urina vermelha', 'xixi vermelho'] },
];
export const SINAIS_DE_ALERTA = ALERTAS.map((a) => a.id);

// ---------- vocabulário e comparação ----------
function distancia(a, b, max) {
  // Damerau (troca de duas letras vizinhas conta como 1), com parada antecipada
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let menor = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      if (v < menor) menor = v;
    }
    if (menor > max) return max + 1;
  }
  return d[a.length][b.length];
}
const canon1 = (w) => SIN.get(w) || w;
let vocab = null;
function vocabulario() {
  if (vocab) return vocab;
  const s = new Set([...SIN.keys(), ...SIN.values()]);
  const addFrase = (f) => { for (const w of normalizar(f).split(' ')) if (w && !LIGACAO.has(w)) s.add(w); };
  for (const a of ALERTAS) a.frases.forEach(addFrase);
  for (const i of intencoes()) for (const p of i.palavras) for (const parte of String(p).split('+')) addFrase(parte);
  vocab = [...s];
  return vocab;
}
// palavra → { c (forma de referência), f (veio de erro de digitação) }
const cache = new Map();
function lerPalavra(w) {
  if (cache.has(w)) return cache.get(w);
  let out;
  const voc = vocabulario();
  if (SIN.has(w) || voc.includes(w)) out = { c: canon1(w), f: false };
  else if (w.length >= 5 && w.endsWith('s') && voc.includes(w.slice(0, -1))) out = { c: canon1(w.slice(0, -1)), f: false }; // plural
  else if (w.length >= 5 && !/^\d+$/.test(w)) {
    const max = w.length >= 8 ? 2 : 1;
    let melhor = null, dm = max + 1;
    for (const v of voc) {
      if (v.length < 4 || Math.abs(v.length - w.length) > max) continue;
      const dd = distancia(w, v, max);
      if (dd < dm) { dm = dd; melhor = v; if (dd === 1 && max === 1) break; }
    }
    out = melhor ? { c: canon1(melhor), f: true } : { c: w, f: false };
  } else out = { c: w, f: false };
  if (cache.size > 2000) cache.clear();
  cache.set(w, out);
  return out;
}
// Texto → palavras lidas (sem as de ligação)
export function lerTexto(texto) {
  return normalizar(texto).split(' ').filter((w) => w && !LIGACAO.has(w)).slice(0, 80).map((w) => ({ w, ...lerPalavra(w) }));
}
// Expressão → formas de referência (sem as de ligação)
const lerFrase = (f) => normalizar(f).split(' ').filter((w) => w && !LIGACAO.has(w)).map(canon1);
// A expressão aparece (na ordem, com até 1 palavra sobrando entre duas dela)? { ini, fuzzy } ou null. Expressão que
// começa negando ("sem ar", "nao vou treinar") pede a palavra seguinte colada: "sem falta de ar" não é "sem ar".
function acha(toks, frase) {
  if (!frase.length) return null;
  const folga0 = NEGA.has(frase[0]) ? 1 : 2;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].c !== frase[0]) continue;
    let pos = i, fuzzy = toks[i].f, ok = true;
    for (let k = 1; k < frase.length; k++) {
      let achou = -1;
      const folga = k === 1 ? folga0 : 2;
      // a palavra que sobra no meio não pode ser uma negação ("estou sem dor" não é "estou com dor")
      for (let j = pos + 1; j <= Math.min(toks.length - 1, pos + folga); j++) { if (toks[j].c === frase[k]) { achou = j; break; } if (NEGA.has(toks[j].w)) break; }
      if (achou < 0) { ok = false; break; }
      pos = achou; fuzzy = fuzzy || toks[achou].f;
    }
    if (ok) return { ini: i, fuzzy };
  }
  return null;
}
// A palavra em `ini` está negada? ("não estou com dor", "sem dor"): uma negação logo antes, com no máximo 3 palavras do
// tipo "estou", "tenho", "sinto" no meio.
function negada(toks, ini) {
  for (let k = ini - 1, n = 0; k >= 0 && n <= 3; k--, n++) {
    if (NEGA.has(toks[k].w)) return true;
    if (!ENTRE.has(toks[k].w)) return false;
  }
  return false;
}
// Procura a expressão sem contar as ocorrências negadas: { fuzzy, negada } ou null
function casar(toks, expr) {
  const forte = String(expr).startsWith('!');
  if (forte) { const r = casar(toks, String(expr).slice(1)); return r ? { ...r, forte: true } : null; }
  const partes = String(expr).split('+').map(lerFrase).filter((p) => p.length);
  if (!partes.length) return null;
  if (partes.length > 1) {
    // todas as partes, em qualquer lugar da frase (são marcas do assunto: "choveu e não deu para correr" ainda é sobre
    // chuva e corrida, então aqui a negação não tira a parte)
    let fuzzy = false;
    for (const p of partes) { const r = acha(toks, p); if (!r) return null; fuzzy = fuzzy || r.fuzzy; }
    return { fuzzy, n: partes.reduce((s, p) => s + p.length, 0), mais: true };
  }
  const r = achaNaoNegada(toks, partes[0]);
  return r ? { fuzzy: r.fuzzy, n: partes[0].length, mais: false } : null;
}
function achaNaoNegada(toks, frase) {
  const comecaNegando = NEGA.has(frase[0]);
  for (let de = 0; de < toks.length; de++) {
    const r = acha(toks.slice(de), frase);
    if (!r) return null;
    const ini = de + r.ini;
    if (comecaNegando || !negada(toks, ini)) return { ini, fuzzy: r.fuzzy };
    de = ini; // procura de novo depois da ocorrência negada
  }
  return null;
}
// '!palavra': marca forte do assunto, que sozinha já basta ("creatina", "whey", "exagerei")
const PESO = (m) => (m.forte ? 3.5 : m.mais ? 3 : m.n >= 3 ? 3.5 : m.n === 2 ? 2.5 : 1) * (m.fuzzy ? 0.8 : 1);
// Pontos de um assunto para o texto lido
export function pontuar(intencao, toks) {
  let pts = 0;
  const vistas = new Set();
  for (const p of intencao.palavras) {
    const k = lerFrase(String(p).replace(/^!/, '')).join(' ') + (String(p).includes('+') ? '+' + p : '');
    if (vistas.has(k)) continue;
    vistas.add(k);
    const m = casar(toks, p);
    if (m) pts += PESO(m);
  }
  return Math.round(pts * 100) / 100;
}

// Sinal de alerta no texto: null ou { id, ids }
export function sinalDeAlerta(texto) {
  // erro de digitação em palavra curta não vale aqui ("conta" não pode virar "tonta")
  const toks = lerTexto(texto).map((t) => (t.f && t.w.length < 7 ? { ...t, c: t.w, f: false } : t));
  const ids = ALERTAS.filter((a) => a.frases.some((f) => casar(toks, f))).map((a) => a.id);
  return ids.length ? { id: ids[0], ids } : null;
}

// Lê o texto para um treinador: { alerta, ranking: [{ intencao, pontos }], melhor, confiante, deOutro }
// deOutro: o melhor assunto de OUTRO treinador, quando ele é claro e o deste não é (para sugerir o outro chat).
export function entender(texto, coach, ctx) {
  const alerta = sinalDeAlerta(texto);
  const toks = lerTexto(texto);
  const rank = (lista) => lista.map((intencao) => ({ intencao, pontos: pontuar(intencao, toks) })).filter((x) => x.pontos > 0).sort((a, b) => b.pontos - a.pontos);
  const ranking = rank(assuntos(coach, ctx));
  const [a, b] = ranking;
  const claro = (x, y) => !!x && x.pontos >= LIMIAR && x.pontos - (y ? y.pontos : 0) >= FOLGA;
  const confiante = claro(a, b);
  let deOutro = null;
  if (!confiante) {
    const outros = rank(Object.keys(COACHES).filter((c) => c !== coach).flatMap((c) => assuntos(c, ctx)));
    if (claro(outros[0], outros[1]) && (!a || outros[0].pontos >= a.pontos + FOLGA)) deOutro = outros[0];
  }
  return { alerta, ranking, melhor: a || null, confiante, deOutro };
}

// ---------- perguntas frequentes ----------
const VAGAS = new Set(['qual', 'quais', 'como', 'quando', 'quanto', 'quantos', 'quantas', 'quanta', 'posso', 'pode', 'devo', 'deve', 'fazer', 'faco', 'faz', 'tem', 'ter', 'ser', 'sobre', 'onde', 'porque', 'por', 'melhor', 'quero', 'queria', 'gostaria', 'preciso', 'ajuda', 'duvida', 'pergunta', 'saber', 'coisa', 'algo', 'vou', 'estou', 'tenho', 'sinto']);
// As perguntas frequentes do treinador que batem com o texto (no máximo `max`), no formato { q, a, refs } do Passo
export function faqPara(texto, coach, max = 2) {
  const lista = FAQ_DO[coach] || [];
  const ws = normalizar(texto).split(' ').filter((w) => w.length > 2 && !LIGACAO.has(w) && !VAGAS.has(w) && !NEGA.has(w));
  if (!ws.length) return [];
  const raiz = (w) => (w.length >= 6 ? w.slice(0, -1) : w);
  const casaTitulo = (it) => { const alvo = normalizar(it.q + ' ' + it.tags); return ws.some((w) => alvo.includes(raiz(w))); };
  return buscarFaq(lista, ws.join(' ')).filter(casaTitulo).slice(0, max).map((it) => ({ q: it.q, a: [...it.a], refs: refsValidas(it.f) }));
}

// ---------- passos do motor ----------
const SAUDACAO = { treinador: 'Oi! Em que posso ajudar no seu treino?', corrida: 'Oi! Em que posso ajudar na sua corrida?', nutri: 'Oi! Em que posso ajudar na sua alimentação?' };
const SEM_ASSUNTO = {
  treinador: { texto: 'Para conversar sobre o treino, primeiro monte o seu plano com o Treinador.', ir: [{ rotulo: 'Abrir o Treinador', rota: 'treinador' }] },
  corrida: { texto: 'Para conversar sobre a corrida, primeiro monte o seu plano com o Treinador de corrida.', ir: [{ rotulo: 'Abrir a corrida', rota: 'corrida' }] },
  nutri: { texto: 'Para conversar sobre a alimentação, primeiro responda às perguntas da Nutricionista.', ir: [{ rotulo: 'Abrir a Nutrição', rota: 'nutricao' }] },
};
const erroDePasso = () => ({ texto: ['Não consegui abrir esse assunto agora. Escolha outro ou escreva a sua dúvida.'] });

// Começa um assunto (com proteção: um erro vira uma resposta curta, nunca uma tela quebrada)
export function iniciar(id, ctx) {
  const i = intencaoPorId(id);
  if (!i) return erroDePasso();
  try { return limparPasso(i.inicio(ctx)) || erroDePasso(); } catch { return erroDePasso(); }
}
// Lista de assuntos em botões (até 6; com mais, 5 e "Outros assuntos")
function menu(lista, frase, extra = [], coach = '') {
  const cabe = lista.length + extra.length > 6 ? 5 - extra.length : lista.length;
  const vis = lista.slice(0, Math.max(1, cabe)), resto = lista.slice(vis.length);
  const opcoes = vis.map((i) => ({ rotulo: i.titulo, valor: i.id }));
  if (resto.length) opcoes.push({ rotulo: 'Outros assuntos', valor: '#mais' });
  opcoes.push(...extra);
  return { texto: [frase], opcoes, proximo: (v, c) => (v === '#mais' ? menu(resto, 'Mais assuntos:', [], coach) : v === '#faq' ? passoFaq(coach, '') : iniciar(v, c)) };
}
// As perguntas frequentes do treinador (as primeiras, ou as que batem com o texto)
function passoFaq(coach, texto) {
  const lista = FAQ_DO[coach] || [];
  const faq = texto ? faqPara(texto, coach, 3) : lista.slice(0, 5).map((it) => ({ q: it.q, a: [...it.a], refs: refsValidas(it.f) }));
  return faq.length ? { texto: ['Estas são as perguntas mais comuns:'], faq } : { texto: ['Não tenho perguntas frequentes sobre isso.'] };
}
// Abertura do chat: uma linha e os assuntos em botões
export function saudacao(coach, ctx) {
  const lista = assuntos(coach, ctx);
  if (!lista.length) { const s = SEM_ASSUNTO[coach] || SEM_ASSUNTO.treinador; return { texto: [s.texto], ir: s.ir }; }
  // com um assunto só, as perguntas frequentes entram como segunda opção
  return menu(lista, SAUDACAO[coach] || SAUDACAO.treinador, lista.length === 1 && FAQ_DO[coach] && FAQ_DO[coach].length ? [{ rotulo: 'Perguntas frequentes', valor: '#faq' }] : [], coach);
}
// Orientação de segurança (para tudo e vem antes de qualquer resposta)
export function passoAlerta(alerta, coach) {
  if (alerta && alerta.ids.length === 1 && alerta.id === 'urina') {
    return {
      aviso: { tipo: 'danger', texto: 'Urina escura depois do treino, com dor muscular forte ou fraqueza fora do normal, pede atendimento médico no mesmo dia.' },
      texto: ['Não treine até ser avaliado.'],
      detalhes: ['Pode ser sinal de lesão do músculo que pede exame (rabdomiólise).'],
      refs: ['cdc_rabdo'],
      opcoes: [{ rotulo: 'Estou bem, voltar aos assuntos', valor: 'voltar' }, { rotulo: 'Perguntas frequentes', valor: 'faq' }],
      proximo: (v, c) => (v === 'faq' ? passoFaq(coach, 'dor muscular') : saudacao(coach, c)),
    };
  }
  const peito = alerta && alerta.ids.includes('peito');
  return {
    aviso: { tipo: 'danger', texto: 'Pare o exercício agora e procure atendimento. Em emergência, ligue 192 (SAMU).' },
    texto: ['Dor ou aperto no peito, falta de ar fora do normal, desmaio, tontura ou palpitação são sinais de alerta.'],
    detalhes: [
      'Com falta de ar, suor frio, enjoo ou dor que vai para o braço, as costas ou o queixo, ligue 192 (SAMU).',
      'Esses sinais pedem avaliação médica antes de qualquer exercício, mesmo que passem.',
      ...(peito ? ['Dor só no músculo do peito, que dói ao tocar ou ao mexer 1 a 2 dias depois do treino de força, é a dor muscular comum. Na dúvida, trate como sinal de alerta.'] : []),
    ],
    refs: ['ms_infarto', 'whitfield2017'],
    opcoes: [{ rotulo: 'Estou bem, voltar aos assuntos', valor: 'voltar' }],
    proximo: (v, c) => saudacao(coach, c),
  };
}
// Resposta ao texto digitado: sempre um Passo (alerta, confirmação, sugestões ou "não achei")
// Sinais de risco alimentar ou à vida (logic/chat/nutri.js): [] se o módulo não tem a função ou não achou nada
export function sinaisDeRisco(texto) {
  if (typeof NUTRI.sinaisDeRisco !== 'function') return [];
  try { const l = NUTRI.sinaisDeRisco(normalizar(texto)); return Array.isArray(l) ? l : []; } catch { return []; }
}
function passoDeRisco(sinais, ctx) {
  try { return limparPasso(NUTRI.passoDeRisco(sinais, ctx)); } catch { return null; }
}
export function responder(texto, coach, ctx) {
  const c = { ...(ctx || {}), coach, texto: normalizar(texto) };
  const r = entender(texto, coach, c);
  const risco = sinaisDeRisco(texto);
  const pRisco = risco.length ? passoDeRisco(risco, c) : null;
  if (r.alerta) return passoAlerta(r.alerta, coach);
  if (pRisco) return pRisco;
  if (r.confiante) {
    const i = r.melhor.intencao;
    return {
      texto: [`Entendi que você quer falar sobre ${i.resumo}. É isso?`],
      opcoes: [{ rotulo: 'Sim', valor: 'sim' }, { rotulo: 'Não, outro assunto', valor: 'nao' }],
      proximo: (v, cc) => (v === 'sim' ? iniciar(i.id, { ...cc, texto: c.texto }) : menu(assuntos(coach, cc), 'Qual destes?', [], coach)),
    };
  }
  if (r.deOutro) {
    const o = r.deOutro.intencao;
    return { texto: [`Esse assunto é com ${o.coach === 'nutri' ? 'a' : 'o'} ${COACHES[o.coach]}: ${o.resumo}.`], ir: [{ rotulo: `Falar com ${o.coach === 'nutri' ? 'a' : 'o'} ${COACHES[o.coach]}`, rota: 'chat/' + o.coach }] };
  }
  const faq = faqPara(texto, coach, 2);
  const perto = r.ranking.filter((x) => x.pontos >= 1).slice(0, 3).map((x) => x.intencao);
  if (perto.length) {
    const p = menu(perto, perto.length === 1 ? 'Não tenho certeza. É sobre isto?' : 'Não tenho certeza. É sobre um destes?', [{ rotulo: 'Ver todos os assuntos', valor: '#todos' }], coach);
    const prox = p.proximo;
    return { ...p, faq: faq.length ? faq : undefined, proximo: (v, cc) => (v === '#todos' ? saudacao(coach, cc) : prox(v, cc)) };
  }
  const todos = assuntos(coach, c);
  if (faq.length) return { texto: ['Não achei esse assunto aqui. Veja se uma destas perguntas ajuda:'], faq, ...(todos.length ? { opcoes: [{ rotulo: 'Ver os assuntos', valor: 'v' }, { rotulo: 'Escrever de outro jeito', valor: 'e' }], proximo: (v, cc) => (v === 'v' ? saudacao(coach, cc) : { texto: ['Escreva com outras palavras, por exemplo: “choveu e não deu para correr”.'] }) } : {}) };
  return { texto: ['Não achei esse assunto. Só respondo o que tem apoio nas pesquisas do app.'], ...(todos.length ? { opcoes: [{ rotulo: 'Ver os assuntos', valor: 'v' }, { rotulo: 'Perguntas frequentes', valor: 'f' }], proximo: (v, cc) => (v === 'v' ? saudacao(coach, cc) : passoFaq(coach, '')) } : {}) };
}

// ---------- validação do passo ----------
// Passo limpo para a tela: textos como string, opções com proximo, refs que existem, ações com o que fazer.
// null se não há nada para mostrar.
export function limparPasso(p) {
  if (!isObj(p)) return null;
  const txt = (l) => (Array.isArray(l) ? l.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()) : []);
  const out = { texto: txt(p.texto) };
  const det = txt(p.detalhes);
  if (det.length) out.detalhes = det;
  const refs = refsValidas(p.refs);
  if (refs.length) out.refs = refs;
  if (isObj(p.aviso) && typeof p.aviso.texto === 'string' && p.aviso.texto) out.aviso = { tipo: ['info', 'warn', 'danger'].includes(p.aviso.tipo) ? p.aviso.tipo : 'info', texto: p.aviso.texto };
  if (typeof p.proximo === 'function' && Array.isArray(p.opcoes)) {
    const op = p.opcoes.filter((o) => isObj(o) && typeof o.rotulo === 'string' && o.rotulo && o.valor != null).slice(0, 6);
    if (op.length) { out.opcoes = op; out.proximo = p.proximo; }
  }
  const acoes = (Array.isArray(p.acoes) ? p.acoes : []).filter((a) => isObj(a) && typeof a.rotulo === 'string' && typeof a.confirmar === 'string' && (typeof a.aplicar === 'function' || (isObj(a.iniciar) && Array.isArray(a.iniciar.itens))));
  if (acoes.length) out.acoes = acoes.slice(0, 4);
  const ir = (Array.isArray(p.ir) ? p.ir : []).filter((x) => isObj(x) && typeof x.rotulo === 'string' && (typeof x.rota === 'string' || typeof x.abrir === 'string'));
  if (ir.length) out.ir = ir.slice(0, 3);
  const faq = (Array.isArray(p.faq) ? p.faq : []).filter((f) => isObj(f) && typeof f.q === 'string' && Array.isArray(f.a)).map((f) => ({ q: f.q, a: txt(f.a), refs: refsValidas(f.refs) }));
  if (faq.length) out.faq = faq.slice(0, 3);
  if (!out.texto.length && !out.aviso && !out.faq) return null;
  return out;
}
// Segue para o próximo passo depois de um botão (com proteção)
export function seguir(passo, valor, ctx) {
  if (!passo || typeof passo.proximo !== 'function') return null;
  try { return limparPasso(passo.proximo(valor, ctx)) || erroDePasso(); } catch { return erroDePasso(); }
}

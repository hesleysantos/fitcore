// Leitura do texto livre do chat, sem IA e sem internet: abreviações e gírias de mensagem, radicais (stemming leve do
// português) e pesos das palavras. Puro: sem DOM. Usado por logic/chat/motor.js e logic/chat/entidades.js.
//
// O que cada parte faz e de onde vem:
//  • ABREVIAÇÕES E GÍRIAS ("hj", "vc", "pq", "tb", "qnd", "dps", "mt", "msm", "trampo", "refri"...): viram a palavra
//    inteira antes de tudo, como num dicionário de normalização de texto de mensagens. Letras repetidas ("muitooo",
//    "simmm") viram uma; risadas ("kkkk", "hahaha") e vocativos ("mano", "cara", "vei") saem; "35min", "5k", "3x",
//    "20kg" se separam em número e unidade.
//  • RADICAL (stemming leve): a ideia do RSLP, o removedor de sufixos da língua portuguesa (Orengo e Huyck, SPIRE 2001;
//    www.inf.ufrgs.br/~viviane/rslp): passos em ordem (plural, feminino, aumentativo e diminutivo, advérbio, substantivo,
//    verbo, vogal final), em cada passo só a regra do sufixo mais longo, com um tamanho mínimo de radical. Aqui ele serve
//    só de ponte: uma palavra que o chat não conhece ("alagada", "corremos", "executa") é ligada a uma que ele conhece
//    com o mesmo radical ("alagado", "correr", "executar"). As palavras conhecidas não mudam.
//  • PESO DAS PALAVRAS (idf, Spärck Jones 1972; o mesmo princípio do TF-IDF e do BM25 usados em busca de texto): uma
//    palavra que aparece em poucos assuntos pesa mais do que uma que aparece em muitos ("creatina" diz mais que "fazer").
//    Calculado sobre as próprias expressões dos assuntos e sobre as perguntas frequentes, na primeira chamada.

// ---------- abreviações e gírias ----------
// token (já sem acento e minúsculo) → palavra(s). Só o que é escrita de mensagem: nada de sinônimo de assunto aqui.
const ABREV = {
  hj: 'hoje', hje: 'hoje', hoj: 'hoje', amnh: 'amanha', amh: 'amanha', amanh: 'amanha', manha_x: '',
  vc: 'voce', vcs: 'voces', voc: 'voce', ce: 'voce', oce: 'voce',
  pq: 'porque', pk: 'porque', pque: 'porque', porq: 'porque', xq: 'porque',
  tb: 'tambem', tbm: 'tambem', tmb: 'tambem', tbem: 'tambem',
  qnd: 'quando', qdo: 'quando', qndo: 'quando', qd: 'quando', qnt: 'quanto', qto: 'quanto', qnto: 'quanto', qt: 'quanto',
  qtos: 'quantos', qntos: 'quantos', qtas: 'quantas', qntas: 'quantas', qtd: 'quantidade', qtde: 'quantidade',
  q: 'que', oq: 'o que', oque: 'o que', oqe: 'o que', ql: 'qual', qlq: 'qualquer', qq: 'qualquer', qlqr: 'qualquer',
  mt: 'muito', mto: 'muito', mta: 'muita', mtos: 'muitos', mtas: 'muitas', mtu: 'muito', muitao: 'muito',
  msm: 'mesmo', mesma_x: '', td: 'tudo', tds: 'todos', nd: 'nada', ngm: 'ninguem', agr: 'agora', aki: 'aqui', aq: 'aqui',
  dps: 'depois', dpois: 'depois', dpz: 'depois', ant: 'antes',
  blz: 'beleza', vlw: 'valeu', obg: 'obrigado', obgd: 'obrigado', obgda: 'obrigada', brigado: 'obrigado', brigada: 'obrigada',
  pf: 'por favor', pfv: 'por favor', pfvr: 'por favor', pls: 'por favor', plz: 'por favor', porfa: 'por favor', porfavor: 'por favor',
  naum: 'nao', nau: 'nao', nn: 'nao', n: 'nao', ss: 'sim', sss: 'sim',
  cmg: 'comigo', ctg: 'contigo', tava: 'estava', tavam: 'estavam', tamo: 'estamos', tmj: '', eh: 'e', vo: 'vou', axo: 'acho', sla: 'sei la',
  tou: 'to', tô: 'to', vamo: 'vamos', bora: 'vamos',
  kg: 'kg', kgs: 'kg', kilo: 'quilo', kilos: 'quilos', km: 'km', kms: 'km', hr: 'horas', hrs: 'horas', hs: 'horas', h: 'horas', mins: 'minutos', minuts: 'minutos',
  acad: 'academia', academ: 'academia', gym: 'academia', treininho: 'treino', trein: 'treino', ficha_x: '',
  trampo: 'trabalho', trampar: 'trabalhar', job: 'trabalho', facul: 'faculdade', refri: 'refrigerante', refris: 'refrigerante', coca: 'refrigerante',
  cerva: 'cerveja', breja: 'cerveja', birita: 'bebida', podrao: 'besteira', podroes: 'besteira', rango: 'comida', larica: 'fome', busao: 'onibus',
  // vocativos e enchimento de mensagem: saem
  mano: '', mana: '', cara: '', vei: '', vey: '', veio_x: '', mlk: '', bro: '', brother: '', man: '', mermao: '', parceiro: '', amigo: '', amiga: '',
  ae: '', aew: '', opa_x: '', uai: '', eita: '', nossa: '', poxa: '', putz: '', affs: '', aff: '', ixi: '', hmm: '', hum: '', ahn: '', ah: '', eh_x: '',
};
const VOCATIVO_FIM = new Set(['treinador', 'coach', 'nutri', 'nutricionista', 'professor', 'prof', 'personal']);
// "35min" → "35 minutos", "5k" → "5 km", "3x" → "3 vezes", "20kg" → "20 kg", "2h" → "2 horas", "1a" (1ª) → "1"
const UNIDADE = { min: 'minutos', mins: 'minutos', m: 'minutos', k: 'km', km: 'km', kms: 'km', x: 'vezes', kg: 'kg', kgs: 'kg', h: 'horas', hr: 'horas', hrs: 'horas', a: '', o: '', s: 'segundos', seg: 'segundos', g: 'gramas', gr: 'gramas', ml: 'ml', l: 'litros' };

// Expande um texto JÁ normalizado (minúsculo, sem acento, só letras, números e espaços)
export function expandir(t) {
  const w = String(t || '').replace(/([a-z])\1{2,}/g, '$1').split(' ').filter(Boolean);
  const out = [];
  for (let i = 0; i < w.length; i++) {
    let x = w[i];
    // risadas
    if (/^(k+|(ha){2,}h?|(he){2,}|(hi){2,}|rs+|ksk\w*|kk\w*)$/.test(x)) continue;
    const m = /^(\d+)([a-z]+)$/.exec(x);
    if (m && Object.prototype.hasOwnProperty.call(UNIDADE, m[2])) { out.push(m[1]); if (UNIDADE[m[2]]) out.push(UNIDADE[m[2]]); continue; }
    // "s/" e "c/" (sem e com) só no meio da frase: "s" sozinho é "sim"
    if ((x === 's' || x === 'c' || x === 'p') && w.length > 1 && i < w.length - 1 && /^[a-z]{3,}/.test(w[i + 1])) { out.push(x === 's' ? 'sem' : x === 'c' ? 'com' : 'para'); continue; }
    if (Object.prototype.hasOwnProperty.call(ABREV, x)) { x = ABREV[x]; if (!x) continue; }
    out.push(x);
  }
  // "valeu treinador", "oi nutri": o vocativo do fim sai
  while (out.length > 1 && VOCATIVO_FIM.has(out[out.length - 1])) out.pop();
  return out.join(' ');
}

// ---------- conceitos ----------
// Expressões do dia a dia que querem dizer uma palavra que o app já conhece (o mesmo assunto, dito de outro jeito)
const CONCEITOS = [
  [/\bpor que\b/g, 'porque'], [/\bpor qual motivo\b/g, 'porque'],
  [/\bperda de tempo\b/g, 'inutil'],
  [/\b(perder|queimar|tirar|eliminar) (a |essa |minha )?(barriga|gordura|pochete|peso)\b/g, 'emagrecer'],
  [/\b(secar|sequinho|sequinha)\b/g, 'emagrecer'],
  [/\b(ganhar|pegar|botar) (massa|musculo|corpo)\b/g, 'ganhar massa'],
  [/\b(bombar|hipertrofiar)\b/g, 'ganhar massa'],
  [/\b(estomago vazio|sem comer nada|em jejum)\b/g, 'jejum'],
];
export function conceitos(t) {
  let x = String(t || '');
  for (const [re, por] of CONCEITOS) x = x.replace(re, por);
  return x;
}

// ---------- radical (RSLP leve) ----------
// [sufixo, troca, tamanho mínimo do radical que sobra]. Em cada passo vale a primeira regra que casar (sufixos longos primeiro).
const R = (l) => l.map(([s, t = '', min = 3]) => ({ s, t, min }));
const PLURAL = R([['oes', 'ao', 2], ['aes', 'ao', 2], ['ais', 'al', 2], ['eis', 'el', 2], ['ois', 'ol', 2], ['ns', 'm', 2], ['res', 'r', 2], ['les', 'l', 2], ['is', 'il', 3], ['es', 'e', 3], ['s', '', 2]]);
const FEMININO = R([['ona', 'ao', 3], ['ora', 'or', 3], ['inha', 'inho', 3], ['esa', 'es', 3], ['osa', 'oso', 3], ['ica', 'ico', 3], ['ada', 'ado', 2], ['ida', 'ido', 3], ['ima', 'imo', 3], ['iva', 'ivo', 3], ['eira', 'eiro', 3], ['na', 'no', 4]]);
const AUMENTATIVO = R([['issimo', '', 3], ['errimo', '', 4], ['zinho', '', 2], ['zinha', '', 2], ['quinho', 'c', 4], ['inho', '', 3], ['inha', '', 3], ['zao', '', 2], ['adao', 'ad', 4], ['ao', '', 3]]);
const ADVERBIO = R([['mente', '', 4]]);
const SUBSTANTIVO = R([['amento', '', 3], ['imento', '', 3], ['mento', '', 4], ['acao', '', 3], ['icao', '', 3], ['cao', '', 3], ['idade', '', 4], ['ismo', '', 3], ['ista', '', 3], ['ador', '', 3], ['edor', '', 3], ['idor', '', 3], ['ante', '', 3], ['ancia', '', 3], ['encia', '', 3], ['avel', '', 3], ['ivel', '', 3], ['oso', '', 3], ['ivo', '', 3], ['ico', '', 3], ['al', '', 4]]);
const VERBO = R([['ariamos', '', 2], ['eriamos', '', 2], ['iriamos', '', 2], ['assemos', '', 2], ['essemos', '', 2], ['aremos', '', 2], ['eremos', '', 2], ['iremos', '', 2], ['avamos', '', 2],
  ['ando', '', 2], ['endo', '', 3], ['indo', '', 3], ['ondo', '', 3], ['aram', '', 2], ['eram', '', 3], ['iram', '', 3], ['avam', '', 2], ['aria', '', 3], ['eria', '', 3], ['iria', '', 3], ['asse', '', 3], ['esse', '', 3], ['isse', '', 3],
  ['arei', '', 2], ['erei', '', 2], ['irei', '', 2], ['amos', '', 2], ['emos', '', 2], ['imos', '', 2], ['ado', '', 2], ['ido', '', 3], ['ava', '', 2], ['ara', '', 2], ['era', '', 3], ['ira', '', 3],
  ['ar', '', 2], ['er', '', 2], ['ir', '', 3], ['ou', '', 3], ['ei', '', 3], ['eu', '', 3], ['iu', '', 3], ['ia', '', 3], ['am', '', 2], ['em', '', 2], ['as', '', 3], ['es', '', 3], ['ai', '', 3], ['o', '', 3], ['a', '', 3], ['e', '', 3], ['i', '', 3]]);
const VOGAL = R([['a', '', 3], ['e', '', 3], ['o', '', 3]]);
function passo(w, regras) {
  for (const r of regras) if (w.endsWith(r.s) && w.length - r.s.length >= r.min) return { w: w.slice(0, w.length - r.s.length) + r.t, ok: true };
  return { w, ok: false };
}
const cacheRad = new Map();
export function radical(w0) {
  const w = String(w0 || '');
  if (w.length < 4 || /\d/.test(w)) return w;
  if (cacheRad.has(w)) return cacheRad.get(w);
  let x = w;
  if (x.endsWith('s')) x = passo(x, PLURAL).w;
  if (x.endsWith('a')) x = passo(x, FEMININO).w;
  x = passo(x, AUMENTATIVO).w;
  x = passo(x, ADVERBIO).w;
  const s = passo(x, SUBSTANTIVO);
  x = s.ok ? s.w : passo(x, VERBO).w;
  x = passo(x, VOGAL).w;
  if (cacheRad.size > 5000) cacheRad.clear();
  cacheRad.set(w, x);
  return x;
}

// ---------- peso das palavras (idf) ----------
// docs: lista de conjuntos de palavras (um por assunto ou por pergunta). Devolve palavra → idf (ln(1 + N/df)).
export function idfDe(docs) {
  const df = new Map();
  for (const d of docs) for (const w of d) df.set(w, (df.get(w) || 0) + 1);
  const n = Math.max(1, docs.length);
  const out = new Map();
  for (const [w, k] of df) out.set(w, Math.log(1 + n / k));
  return out;
}

// ---------- orações ----------
// Corta um texto normalizado em orações (vírgula e ponto já saíram na normalização: aqui valem as conjunções).
// Devolve [{ t, pergunta }]: `pergunta` = a oração que pergunta (começa com palavra de pergunta ou com "posso", "da pra").
const CORTE = /\s+(?:mas|porem|so que|entao|ai|e depois|alem disso|e tambem|tambem|porque|pois|ja que|como|enquanto)\s+/;
const PERGUNTA = /^(o que|que|qual|quais|quanto|quantos|quantas|quando|como|onde|porque|por que|posso|pode|da pra|da para|tem como|devo|preciso|e normal|e ruim|e bom|vale|sera|seria)\b/;
export function oracoes(t) {
  const partes = String(t || '').split(CORTE).map((x) => x.trim()).filter((x) => x.split(' ').length >= 2);
  return partes.map((x) => ({ t: x, pergunta: PERGUNTA.test(x) }));
}

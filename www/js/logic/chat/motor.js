// Motor do chat com os treinadores: o registro dos assuntos, o reconhecimento do texto livre, a memória da conversa e os
// sinais de alerta. Puro: sem DOM, sem internet e sem IA. Formato dos assuntos e dos passos em logic/chat/contrato.js.
//
// Como o texto livre é lido (tudo aqui, sem modelo de linguagem):
//  1. normaliza: minúsculas, sem acento, sem pontuação; tira as palavras de ligação ("de", "o", "pra"...);
//  2. cada palavra vira a forma de referência pelos sinônimos ("malhar" → "treino", "choveu" → "chuva"); palavras de 5
//     letras ou mais que o app não conhece são comparadas com as que ele conhece, tolerando 1 erro de digitação (2 a
//     partir de 8 letras; troca de duas letras vizinhas conta como 1);
//  3. SINAIS DE ALERTA antes de tudo (vale para todos os treinadores, inclusive a Nutricionista): dor ou aperto no peito,
//     falta de ar, desmaio, tontura, palpitação, suor frio, urina escura. Com um deles, a conversa para e mostra primeiro a
//     orientação de segurança que o app já usa: parar o exercício e procurar atendimento; em emergência, 192 (SAMU)
//     (refs ms_infarto e whitfield2017, as mesmas de logic/corrida.js e logic/trainer.js).
//     TRIAGEM DO PEITO: quando a frase só fala de dor no peito (sem aperto, pressão, peso, queimação, falta de ar, braço,
//     queixo...) e indica dor muscular de treino (supino, treino de peito, dolorido ao apertar ou ao mexer o braço, dia
//     seguinte ao treino), o chat faz UMA pergunta com botões sobre os sinais de alarme; com qualquer um (ou "não sei"),
//     a orientação de emergência; sem nenhum, o caminho da dor muscular. Fontes, em texto completo: Ministério da Saúde,
//     "Infarto" (ms_infarto: dor ou desconforto no peito com sensação de peso ou aperto, que pode irradiar para as costas,
//     o rosto e o braço; suor frio, palidez, falta de ar e sensação de desmaio → ligue 192) e NHS, "Chest pain" (nhs_dor_peito:
//     dor que aperta ou pressiona, que vai para o braço, o pescoço, o queixo, a barriga ou as costas, ou com suor, enjoo,
//     tontura ou falta de ar → emergência; dor que começa depois de exercício do peito e melhora com o repouso costuma
//     ser distensão do músculo). Depois, os sinais de risco alimentar ou à vida (logic/chat/nutri.js: sinaisDeRisco) e os
//     sinais de emergência de outros problemas de saúde (logic/chat/saude.js, se existir: sinaisDeEmergencia);
//  4. pontua cada assunto do treinador pelas expressões que aparecem (expressão mais longa vale mais; com erro de
//     digitação vale um pouco menos); expressão negada ("não estou com dor") não conta; alguns assuntos ganham pontos
//     pelas datas da frase (bonus, ex.: "posso passar a corrida de quinta para sexta?");
//  5. DATAS: "hoje", "amanhã", "ontem", "depois de amanhã", "sexta", "no sábado", "semana que vem", "essa semana", "dia
//     20" (logic/chat/comum.js, lerDatas) viram ctx.data, o dia de que o assunto fala;
//  6. MEMÓRIA da conversa (ctx.memoria = { assunto, data, de, pendente }): "e amanhã?", "e se eu fizer na sexta?", "e a
//     corrida?" continuam o assunto; "sim", "pode", "não", "deixa" e o texto de um botão respondem à pergunta em aberto
//     (ctx.aberto); mensagem com dois assuntos ("choveu e estou com dor no joelho") trata primeiro o mais importante
//     (a dor: segurança antes) e oferece o outro em seguida;
//  7. com o assunto bem claro, responde direto; com pontuação boa mas não folgada, confirma ("Entendi que você quer...
//     É isso?"); sem assunto, uma pergunta frequente que casa bem com a frase é respondida direto, com o "Por quê?" e as
//     fontes; senão mostra os assuntos mais próximos e as perguntas frequentes que batem (buscarFaq).
import { COACHES } from './contrato.js';
import { INTENCOES as I_TREINO, passoSemana, passoDor } from './treino.js';
import { INTENCOES as I_CORRIDA } from './corrida.js';
import * as NUTRI from './nutri.js';
import { refsValidas, lerDatas, nomeDia, noDia, diaValido } from './comum.js';
import { FAQ_TREINO, FAQ_NUTRI, buscarFaq } from '../../data/knowledge.js';
import { FAQ_CORRIDA } from '../../data/corrida.js';

// Problemas de saúde fora do treino (pancada, corte, febre...): outro módulo, usado se existir
let SAUDE = null;
try { SAUDE = await import('./saude.js'); } catch { SAUDE = null; }

export const LIMIAR = 2.5;   // pontos mínimos para reconhecer um assunto
export const FOLGA = 1;      // vantagem mínima sobre o segundo assunto
export const DIRETO = 2;     // vantagem a partir da qual o treinador responde direto, sem "É isso?"
const FAQ_DO = { treinador: FAQ_TREINO, corrida: FAQ_CORRIDA, nutri: FAQ_NUTRI };
// ordem dos assuntos nos botões da abertura (os que não estão aqui vêm depois, na ordem dos módulos)
const ORDEM_MENU = {
  treinador: ['treino-perdido', 'pouco-tempo', 'qual-treino', 'semana', 'dor-treino', 'juntar-treino', 'carga', 'aparelho-falta', 'mudar-plano', 'aparelho-ocupado', 'duracao', 'antecipar', 'seguidos'],
  corrida: ['chuva', 'corrida-perdida', 'corrida-dia', 'ritmo', 'mover-corrida', 'dor-corrida', 'esteira', 'semana-corrida', 'mais-rapido', 'mais-devagar', 'juntar-corrida', 'mudar-corrida'],
};

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
  for (const lista of [I_TREINO, I_CORRIDA, NUTRI.INTENCOES, SAUDE && SAUDE.INTENCOES]) {
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
const noMenu = (coach, ctx) => {
  const ord = ORDEM_MENU[coach] || [];
  const pos = (i) => { const k = ord.indexOf(i.id); return k < 0 ? 100 : k; };
  return assuntos(coach, ctx).map((i, k) => ({ i, k })).sort((a, b) => pos(a.i) - pos(b.i) || a.k - b.k).map((x) => x.i);
};

// ---------- texto ----------
export const normalizar = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// palavras de ligação: não mudam o assunto ("estou com dor" e "dor" são o mesmo pedido)
const LIGACAO = new Set(('a o os as e de do da dos das em no na nos nas num numa um uma uns umas para pra pro pros por pelo pela pelos pelas com '
  + 'que se me eu meu minha meus minhas mim te ti voce vc ao aos ou mas tambem ja la isso esse essa este isto aquele aquela ele ela '
  + 'hoje agora entao ai aqui muito muita bem tipo ne oi ola bom boa oq q').split(' '));
const NEGA = new Set(['nao', 'nem', 'sem', 'nunca', 'jamais', 'nenhum', 'nenhuma']);
// palavras que podem ficar entre a negação e o que ela nega ("não ESTOU com dor", "não TENHO falta de ar")
const ENTRE = new Set(['estou', 'to', 'tou', 'esta', 'ta', 'estava', 'tenho', 'tive', 'tinha', 'sinto', 'senti', 'sentindo', 'tendo', 'ter', 'sentir', 'estar', 'ando', 'fiquei', 'ficou', 'mais', 'sou', 'era', 'foi', 'deu', 'houve', 'existe', 'tem', 'teve', 'estive', 'estamos', 'sinta']);
// sinônimos → forma de referência (as expressões dos assuntos passam pela mesma troca, então valem as duas formas)
const GRUPOS = {
  treino: 'treino treinos treinar treinei treinou treinando treinamento treinamentos malhar malho malhei malhando malhacao malhação academia_treino',
  correr: 'correr corrida corridas corri corro correndo corre corrido_x rodagem trote trotar corridinha',
  chuva: 'chuva chuvas chovendo choveu chover chove chuvoso chuvosa temporal tempestade garoa garoando molhado molhada toro aguaceiro chuvarada',
  esteira: 'esteira esteiras treadmill',
  cansado: 'cansado cansada cansaco cansei exausto exausta exaustao esgotado esgotada moido moida acabado acabada quebrado_x fadiga indisposto indisposta desanimado desanimada preguica morto morta destruido destruida',
  dormir: 'dormir dormi dormiu durmo sono insonia acordei',
  peito: 'peito peitoral peitorais',
  dor: 'dor dores doendo doi doeu doer dolorido dolorida doloridos doloridas machuquei machucado machucada machucou lesao lesionei lesionado lesionada incomodo incomodando incomoda',
  // torção e contusão são lesões agudas (pancada, queda): assunto de saúde fora do treino (logic/chat/saude.js)
  torci: 'torci torceu torcao entorse contusao contundi',
  doente: 'doente gripe gripado gripada resfriado resfriada febre virose covid enjoado enjoada',
  viagem: 'viagem viajar viajando viajei viajo viajarei ferias hotel',
  tempo: 'tempo',
  minuto: 'minuto minutos min minutinho minutinhos',
  pressa: 'pressa correria apressado apressada atrasado atrasada',
  carga: 'carga cargas peso pesos quilo quilos kg kilo kilos anilha anilhas',
  repeticao: 'repeticao repeticoes reps rep',
  serie: 'serie series',
  descanso: 'descanso descansar descansos intervalo intervalos',
  aparelho: 'aparelho aparelhos maquina maquinas equipamento equipamentos estacao',
  ocupado: 'ocupado ocupada ocupados ocupadas lotado lotada cheio cheia fila usando',
  juntar: 'juntar junto juntos junta juntei emendar emendado emendada combinar combinado seguido seguida seguidos sequencia colado colados',
  musculacao: 'musculacao musculação ferro forca_x',
  academia: 'academia academias',
  casa: 'casa',
  mudar: 'mudar mudo mudei mudanca trocar troco troca trocas alterar alteracao modificar ajustar ajuste refazer',
  plano: 'plano planos programa ficha',
  dia: 'dia dias',
  faltar: 'faltar faltei falto faltando falta_x perder perdi perdendo pular pulei pulo',
  curto: 'curto curta rapido_x rapida_x reduzido reduzida resumido resumida',
  prioridade: 'prioridade prioridades priorizar foco',
  recomendacao: 'recomendacao recomendacoes recomenda recomendado sugestao sugestoes sugere conselho dica dicas',
  conseguir: 'conseguir consigo consegui conseguindo',
  poder: 'posso pode poder podia poderia',
  ir: 'ir vou vai',
  rapido: 'rapido rapida veloz rapidinho rapidinha',
  devagar: 'devagar lento lenta devagarinho',
  semana: 'semana semanas',
  todo: 'todo todos toda todas',
  pace: 'pace pace_x',
  amanha: 'amanha amanhan',
};
const SIN = new Map();
for (const [canon, lista] of Object.entries(GRUPOS)) for (const w of lista.split(' ')) if (!w.includes('_')) SIN.set(w, canon);

// ---------- sinais de alerta ----------
// Ids, expressões (sem acento; passam pelos mesmos sinônimos) e a orientação. O texto é o que o app já usa: logic/trainer.js
// ("pare o exercício e procure atendimento") e logic/corrida.js ("ligue 192 (SAMU)"; ms_infarto, whitfield2017); urina
// escura com dor muscular forte: views/corrida.js (cdc_rabdo). `claro`: frases de peito que sempre vão direto ao alerta.
const PEITO_CLARO = ['aperto peito', 'peito apertado', 'pressao peito', 'peso peito', 'queimacao peito', 'pontada peito', 'dor toracica', 'infarto', 'enfarte', 'ataque cardiaco', 'dor braco esquerdo', 'dor mandibula', 'dor queixo', 'peito queimando', 'peito pesado'];
const ALERTAS = [
  { id: 'peito', frases: ['dor peito', 'peito dor', ...PEITO_CLARO] },
  { id: 'ar', frases: ['falta ar', 'faltando ar', 'faltou ar', 'sem ar', 'nao consigo respirar', 'nao conseguia respirar', 'dificuldade respirar', 'dificuldade pra respirar', 'respirar mal', 'sufocado', 'sufocada', 'sufocando', 'sufoco', 'chiado peito'] },
  { id: 'desmaio', frases: ['desmaio', 'desmaiei', 'desmaiou', 'desmaiar', 'desmaiando', 'perdi consciencia', 'perdi sentidos', 'vista escureceu', 'escureceu vista', 'vista escura', 'vista turva'] },
  { id: 'tontura', frases: ['tontura', 'tonturas', 'tonto', 'tonta', 'zonzo', 'zonza', 'vertigem', 'cabeca rodando', 'tudo girando', 'mundo girando'] },
  { id: 'palpitacao', frases: ['palpitacao', 'palpitacoes', 'coracao disparado', 'coracao disparou', 'coracao disparando', 'coracao acelerado', 'coracao acelerou', 'taquicardia', 'arritmia', 'coracao batendo forte', 'coracao descompassado', 'coracao falhando', 'batedeira'] },
  { id: 'suor', frases: ['suor frio', 'suando frio', 'suei frio'] },
  { id: 'urina', frases: ['urina escura', 'xixi escuro', 'urina marrom', 'xixi marrom', 'urina cor coca', 'urina vermelha', 'xixi vermelho'] },
];
export const SINAIS_DE_ALERTA = ALERTAS.map((a) => a.id);
// dor no peito que parece ser do músculo do treino (pede a triagem, não vai direto ao alerta)
const MUSCULO_PEITO = /\b(supino\w*|crucifixo\w*|flexao|flexoes|peck|voador|crossover|cross over|treino de peito|treinei peito|treino peito|musculacao|academia|malhei|treinei|depois do treino|apos o treino|dia seguinte|desde ontem|dolorid[oa]s?|ao (tocar|apertar|mexer|encostar|pressionar)|quando (aperto|toco|mexo|encosto|aperta|mexe)|mexer o braco|levantar o braco|musculo\w*|muscular)\b/;
const PEITO_GRAVE = /\b(forte|fortissima|repente|repentina|subita|subito|do nada|repouso|parado|deitado|dormindo|nao passa|irradia|espalha|vai pro|vai para|desce pro|desce para|braco esquerdo|queixo|mandibula|costas|suor|enjoo|enjoado|ansiedade)\b/;

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
const CONHECIDAS = 'segunda terca quarta quinta sexta sabado domingo amanha ontem anteontem semana feriado preco dinheiro cinema futebol filme serie netflix gasolina carro cachorro gato trabalho escola faculdade dedo'.split(' ');
let vocab = null;
function vocabulario() {
  if (vocab) return vocab;
  const s = new Set([...SIN.keys(), ...SIN.values()]);
  const addFrase = (f) => { for (const w of normalizar(f).split(' ')) if (w && !LIGACAO.has(w)) s.add(w); };
  for (const a of ALERTAS) a.frases.forEach(addFrase);
  // palavras comuns que não podem virar outra por "erro de digitação" (quinta → quanta)
  for (const w of CONHECIDAS) s.add(w);
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
  else if (w.length >= 6 && !/^\d+$/.test(w)) {
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
// pontos extras do assunto (datas da frase e o que as palavras não pegam); erro no assunto não derruba o motor
function bonus(i, info) {
  let b = 0;
  if (i.data && info.datas.some((d) => d.data !== info.hoje)) b += 0.5;
  if (typeof i.bonus === 'function') { try { const v = Number(i.bonus(info)); if (Number.isFinite(v) && v > 0) b += Math.min(v, 4); } catch { /* sem bônus */ } }
  return b;
}

// Sinal de alerta no texto: null ou { id, ids, triagem } — triagem = só dor no peito com jeito de dor muscular de treino
export function sinalDeAlerta(texto) {
  // erro de digitação em palavra curta não vale aqui ("conta" não pode virar "tonta")
  const toks = lerTexto(texto).map((t) => (t.f && t.w.length < 7 ? { ...t, c: t.w, f: false } : t));
  const ids = ALERTAS.filter((a) => a.frases.some((f) => casar(toks, f))).map((a) => a.id);
  if (!ids.length) return null;
  const t = normalizar(texto);
  // "dói quando aperto" é o verbo (apertar o músculo), não o "aperto no peito"
  const semVerbo = lerTexto(t.replace(/\b(quando|ao|se|so) (eu )?(aperto|apertar|aperta|aperto o|toco|tocar)\b/g, ' ')).map((x) => (x.f && x.w.length < 7 ? { ...x, c: x.w, f: false } : x));
  const claro = PEITO_CLARO.some((f) => casar(semVerbo, f));
  const triagem = ids.length === 1 && ids[0] === 'peito' && !claro && MUSCULO_PEITO.test(t) && !PEITO_GRAVE.test(t);
  return { id: ids[0], ids, triagem };
}

// Datas citadas no texto (logic/chat/comum.js)
const datasDe = (texto, ctx) => lerDatas(normalizar(texto), ctx && ctx.hoje);
// Lê o texto para um treinador: { alerta, ranking: [{ intencao, pontos }], melhor, confiante, direto, deOutro, datas }
// deOutro: o melhor assunto de OUTRO treinador, quando ele é claro e o deste não é (para sugerir o outro chat).
export function entender(texto, coach, ctx) {
  const alerta = sinalDeAlerta(texto);
  const toks = lerTexto(texto);
  const datas = datasDe(texto, ctx);
  const info = { datas, hoje: ctx && ctx.hoje, texto: normalizar(texto), ctx: ctx || {} };
  // o bônus soma aos pontos das palavras; sozinho, só conta quando é forte (2,5 ou mais)
  const rank = (lista) => lista.map((intencao) => {
    const p = pontuar(intencao, toks), b = bonus(intencao, info);
    return { intencao, pontos: Math.round((p > 0 ? p + b : b >= LIMIAR ? b : 0) * 100) / 100 };
  }).filter((x) => x.pontos > 0).sort((a, b) => b.pontos - a.pontos);
  const ranking = rank(assuntos(coach, ctx));
  const [a, b] = ranking;
  const claro = (x, y) => !!x && x.pontos >= LIMIAR && x.pontos - (y ? y.pontos : 0) >= FOLGA;
  const confiante = claro(a, b);
  const direto = confiante && a.pontos - (b ? b.pontos : 0) >= DIRETO;
  let deOutro = null;
  if (!confiante) {
    const outros = rank(Object.keys(COACHES).filter((c) => c !== coach).flatMap((c) => assuntos(c, ctx)));
    if (claro(outros[0], outros[1]) && (!a || outros[0].pontos >= a.pontos + FOLGA)) deOutro = outros[0];
  }
  return { alerta, ranking, melhor: a || null, confiante, direto, deOutro, datas };
}

// ---------- perguntas frequentes ----------
const VAGAS = new Set(['qual', 'quais', 'como', 'quando', 'quanto', 'quantos', 'quantas', 'quanta', 'posso', 'pode', 'devo', 'deve', 'fazer', 'faco', 'faz', 'tem', 'ter', 'ser', 'sobre', 'onde', 'porque', 'por', 'melhor', 'quero', 'queria', 'gostaria', 'preciso', 'ajuda', 'duvida', 'pergunta', 'saber', 'coisa', 'algo', 'vou', 'estou', 'tenho', 'sinto', 'mesmo', 'verdade', 'certo', 'serve', 'vale', 'precisa', 'importa', 'funciona', 'mais', 'menos', 'muito', 'bem', 'mal']);
const palavrasDaFaq = (texto) => normalizar(texto).split(' ').filter((w) => w.length > 2 && !LIGACAO.has(w) && !VAGAS.has(w) && !NEGA.has(w));
const raiz = (w) => (w.length >= 6 ? w.slice(0, -1) : w);
// As perguntas frequentes do treinador que batem com o texto (no máximo `max`), no formato { q, a, refs } do Passo
export function faqPara(texto, coach, max = 2) {
  const lista = FAQ_DO[coach] || [];
  const ws = palavrasDaFaq(texto);
  if (!ws.length) return [];
  const casaTitulo = (it) => { const alvo = normalizar(it.q + ' ' + it.tags); return ws.some((w) => alvo.includes(raiz(w))); };
  return buscarFaq(lista, ws.join(' ')).filter(casaTitulo).slice(0, max).map((it) => ({ q: it.q, a: [...it.a], refs: refsValidas(it.f) }));
}
// A pergunta frequente que responde a frase (casa bem com a pergunta e as marcas dela, e bem à frente da segunda), ou null.
// Só as palavras que contam (sem "qual", "posso"...); pelo menos 2 delas na pergunta ou nas marcas, e 60% da frase.
export function faqDireta(texto, coach) {
  const lista = FAQ_DO[coach] || [];
  const ws = [...new Set(palavrasDaFaq(texto))];
  if (ws.length < 2 || ws.length > 12) return null;
  // conta só o que está na PERGUNTA (as marcas desempatam): a frase tem de ser quase a própria pergunta
  const notas = lista.map((it) => {
    const q = ' ' + normalizar(it.q) + ' ', tg = ' ' + normalizar(it.tags) + ' ';
    const n = ws.filter((w) => q.includes(' ' + raiz(w))).length;
    return { it, n, m: n + ws.filter((w) => !q.includes(' ' + raiz(w)) && tg.includes(' ' + raiz(w))).length / 10 };
  }).sort((a, b) => b.m - a.m);
  const [a, b] = notas;
  if (!a || a.n < 2 || a.n / ws.length < 0.6 || (b && b.m >= a.m)) return null;
  return a.it;
}
// frases curtas para o balão e o resto no "Por quê?"
function frases(paragrafo) { return String(paragrafo).match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) || []; }
export function passoDaFaq(it) {
  const todas = [...it.a, ...(Array.isArray(it.mais) ? it.mais : [])];
  const p1 = frases(todas[0] || '');
  const texto = [];
  let n = 0;
  while (p1.length && texto.length < 2 && n + p1[0].length <= 240) { n += p1[0].length; texto.push(p1.shift()); }
  if (!texto.length && p1.length) texto.push(p1.shift().slice(0, 240));
  const detalhes = [p1.join(' '), ...todas.slice(1)].filter((x) => x && x.trim());
  return { texto, detalhes, refs: refsValidas(it.f), faqQ: it.q };
}

// ---------- passos do motor ----------
const SAUDACAO = { treinador: 'Oi! Em que posso ajudar no seu treino?', corrida: 'Oi! Em que posso ajudar na sua corrida?', nutri: 'Oi! Em que posso ajudar na sua alimentação?' };
const SEM_ASSUNTO = {
  treinador: { texto: 'Para conversar sobre o treino, primeiro monte o seu plano com o Treinador.', ir: [{ rotulo: 'Abrir o Treinador', rota: 'treinador' }] },
  corrida: { texto: 'Para conversar sobre a corrida, primeiro monte o seu plano com o Treinador de corrida.', ir: [{ rotulo: 'Abrir a corrida', rota: 'corrida' }] },
  nutri: { texto: 'Para conversar sobre a alimentação, primeiro responda às perguntas da Nutricionista.', ir: [{ rotulo: 'Abrir a Nutrição', rota: 'nutricao' }] },
};
const erroDePasso = () => ({ texto: ['Não consegui abrir esse assunto agora. Escolha outro ou escreva a sua dúvida.'] });

// Começa um assunto (com proteção: um erro vira uma resposta curta, nunca uma tela quebrada). O passo leva `assunto`
// (o id), para a memória da conversa.
export function iniciar(id, ctx) {
  const i = intencaoPorId(id);
  if (!i) return erroDePasso();
  let p = null;
  try { p = limparPasso(i.inicio(ctx)); } catch { p = null; }
  if (!p) return erroDePasso();
  p.assunto = id;
  if (!p.data && ctx && diaValido(ctx.data)) p.data = ctx.data;
  return p;
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
  const lista = noMenu(coach, ctx);
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
// Triagem curta da dor no peito que parece do músculo: uma pergunta com botões sobre os sinais de alarme
export function passoTriagemPeito(coach) {
  return {
    aviso: { tipo: 'warn', texto: 'Antes, uma pergunta de segurança.' },
    texto: [
      'Junto com essa dor no peito, você tem algum destes?',
      '• aperto, pressão, peso ou queimação no peito',
      '• falta de ar, suor frio, enjoo ou sensação de desmaio',
      '• dor que vai para o braço, as costas, o pescoço, o queixo ou a barriga',
      '• dor que veio de repente ou que aparece em repouso',
    ],
    refs: ['ms_infarto', 'nhs_dor_peito'],
    opcoes: [{ rotulo: 'Sim, tenho algum deles', valor: 'sim' }, { rotulo: 'Não sei dizer', valor: 'nao_sei' }, { rotulo: 'Não: só dói ao apertar ou mexer', valor: 'nao' }],
    proximo: (v, c) => {
      if (v !== 'nao') return passoAlerta({ id: 'peito', ids: ['peito'] }, coach);
      let base = null;
      try { base = passoDor(c, coach === 'corrida' ? 'corrida' : 'treinador'); } catch { base = null; }
      const musc = base && typeof base.proximo === 'function' ? base.proximo('muscular', c) : null;
      return {
        aviso: { tipo: 'warn', texto: 'Se aparecer qualquer um daqueles sinais, pare na hora e ligue 192 (SAMU).' },
        texto: ['Então parece dor do músculo do treino: começa depois do exercício e melhora com o repouso.', ...(musc ? musc.texto : ['Enquanto doer, treine esse músculo mais leve ou treine outras partes.'])],
        detalhes: ['Dor que começa depois de exercitar o peito e melhora com o repouso costuma ser distensão do músculo.', ...(musc && Array.isArray(musc.detalhes) ? musc.detalhes : [])],
        refs: ['nhs_dor_peito', 'ms_infarto', ...(musc && Array.isArray(musc.refs) ? musc.refs : [])],
        ir: musc && Array.isArray(musc.ir) ? musc.ir : [{ rotulo: 'Contar a dor ao Treinador', abrir: 'contar-dor' }],
      };
    },
  };
}
// Sinais de risco alimentar ou à vida (logic/chat/nutri.js): [] se o módulo não tem a função ou não achou nada
export function sinaisDeRisco(texto) {
  if (typeof NUTRI.sinaisDeRisco !== 'function') return [];
  try { const l = NUTRI.sinaisDeRisco(normalizar(texto)); return Array.isArray(l) ? l : []; } catch { return []; }
}
function passoDeRisco(sinais, ctx) {
  try { return limparPasso(NUTRI.passoDeRisco(sinais, ctx)); } catch { return null; }
}
// Emergências de saúde fora do treino (logic/chat/saude.js, se existir): Passo ou null
function passoDeEmergencia(texto, ctx) {
  if (!SAUDE || typeof SAUDE.sinaisDeEmergencia !== 'function') return null;
  let r = null;
  try { r = SAUDE.sinaisDeEmergencia(normalizar(texto), ctx); } catch { r = null; }
  if (!r || (Array.isArray(r) && !r.length)) return null;
  if (isObj(r) && Array.isArray(r.texto)) return limparPasso(r);
  if (typeof SAUDE.passoDeEmergencia === 'function') { try { const p = limparPasso(SAUDE.passoDeEmergencia(r, ctx)); if (p) return p; } catch { /* passo geral abaixo */ } }
  return {
    aviso: { tipo: 'danger', texto: 'Isso pede atendimento agora. Em emergência, ligue 192 (SAMU).' },
    texto: ['Não treine hoje: procure atendimento.'],
    refs: ['ms_infarto'],
  };
}

// ---------- memória da conversa ----------
// { assunto: id, data: 'AAAA-MM-DD', de: 'AAAA-MM-DD' (a corrida de origem, ao mudar de dia), pendente: [ids] }
export function memoriaLimpa(m) {
  const x = isObj(m) ? m : {};
  return {
    assunto: typeof x.assunto === 'string' && intencaoPorId(x.assunto) ? x.assunto : '',
    data: diaValido(x.data) ? x.data : '', de: diaValido(x.de) ? x.de : '',
    pendente: Array.isArray(x.pendente) ? x.pendente.filter((id) => typeof id === 'string' && intencaoPorId(id)).slice(0, 3) : [],
  };
}
// O assunto pendente (de uma mensagem com dois assuntos) entra como botão nas falas que terminam a conversa
function comPendente(p, mem, coach) {
  if (!p || !mem.pendente.length || (Array.isArray(p.opcoes) && p.opcoes.length) || (p.aviso && p.aviso.tipo === 'danger')) return p;
  const i = intencaoPorId(mem.pendente[0]);
  if (!i) return p;
  return { ...p, opcoes: [{ rotulo: `Agora: ${i.titulo}`, valor: '#pend' }], proximo: (v, c) => saudacao(coach, c) };
}
function lembrar(p, mem, coach) {
  if (!p) return p;
  const nova = { ...mem, assunto: p.assunto || mem.assunto, data: diaValido(p.data) ? p.data : mem.data };
  const q = comPendente(p, nova, coach);
  return { ...q, memoria: nova };
}

// ---------- respostas digitadas para a pergunta em aberto ----------
const SIM = /^(sim|s|ss|sim sim|isso|isso mesmo|isso ai|claro|claro que sim|pode|pode ser|pode sim|podes|quero|quero sim|ok|okay|okey|beleza|blz|bora|vamos|vamo|com certeza|certo|certeza|exato|exatamente|uhum|aham|ahan|perfeito|show|fechado|manda|manda ver|positivo|yes|por favor|pf|pfv|sim por favor|demorou|top|bom|boa|otimo|isso por favor|faz isso|pode fazer|faca|faz|vai|sim quero|quero isso|esse|essa|era isso|e isso|eh isso)( (por favor|obrigad[oa]|valeu|pode|sim))?$/;
const NAO = /^(nao|n|nn|nao nao|nao quero|deixa|deixa pra la|deixa para la|deixa quieto|agora nao|melhor nao|nem|negativo|nada|dispenso|nao obrigad[oa]|nao precisa|nao valeu|nao era isso|nao e isso|outro|outra|outra coisa|outro assunto|nada disso|cancela|cancelar|esquece|nao pode|nope)$/;
const GENERICAS_OP = new Set(['poder', 'ser', 'quero', 'querer', 'sim', 'nao', 'ok', 'acho', 'melhor', 'prefiro', 'vamos', 'bora', 'fazer', 'faco', 'opcao', 'mesmo', 'favor', 'pf', 'ir', 'gostaria', 'queria', 'escolho', 'primeira', 'segunda', 'vou', 'dia']);
const pergSimNao = (p) => { const u = (p.texto || [])[p.texto.length - 1] || ''; return /\?$/.test(u) && /^(Quer|É isso|Posso|Pode|Prefere|Vamos|Faço|Topa|Começo|Passo|Troco)/.test(u); };
// O que o texto responde: { valor } (uma opção), { executar: i } (uma ação, que a tela confirma), { nao: true } ou null
export function respostaAberta(texto, passo, novoAssunto = false) {
  if (!isObj(passo)) return null;
  const t = normalizar(texto);
  if (!t) return null;
  const ops = Array.isArray(passo.opcoes) && typeof passo.proximo === 'function' ? passo.opcoes : [];
  const acoes = Array.isArray(passo.acoes) ? passo.acoes : [];
  const pol = (o) => { const r = normalizar(o.rotulo); return /^sim\b/.test(r) ? 1 : /^nao\b/.test(r) ? -1 : 0; };
  if (SIM.test(t)) {
    const s = ops.find((o) => pol(o) === 1);
    if (s) return { valor: s.valor };
    if (acoes.length && !ops.length) return { executar: 0 };
    if (ops.length && pergSimNao(passo)) { const o = ops.find((x) => pol(x) >= 0 && !String(x.valor).startsWith('#')); if (o) return { valor: o.valor }; }
    if (acoes.length) return { executar: 0 };
    return null;
  }
  if (NAO.test(t)) {
    const n = ops.find((o) => pol(o) === -1);
    if (n) return { valor: n.valor };
    if (ops.length && pergSimNao(passo)) { const o = [...ops].reverse().find((x) => !String(x.valor).startsWith('#')); if (o && ops.length === 2) return { valor: o.valor }; }
    return acoes.length || ops.length ? { nao: true } : null;
  }
  // o texto de uma ação ("trocar por agachamento búlgaro"): abre a confirmação dela
  const conteudoA = (s) => lerTexto(s).map((x) => x.c).filter((w) => !GENERICAS_OP.has(w));
  if (acoes.length) {
    const tw = conteudoA(texto);
    const notas = acoes.map((a, i) => { const aw = new Set(conteudoA(a.rotulo)); return { i, n: tw.filter((w) => aw.has(w)).length, de: aw.size }; }).sort((x, y) => y.n - x.n);
    if (!novoAssunto && tw.length && notas[0].n >= Math.max(1, Math.ceil(tw.length * 0.75)) && (!notas[1] || notas[1].n < notas[0].n)) return { executar: notas[0].i };
  }
  if (!ops.length) return null;
  // um assunto novo e bem claro não é resposta a um botão (a não ser o texto do próprio botão)
  if (novoAssunto) { const o = ops.find((x) => normalizar(x.rotulo) === t); return o ? { valor: o.valor } : null; }
  // o texto de um botão: palavras em comum (com sinônimos e erro de digitação), números ("30" → "30 min") e dias
  const conteudo = (s) => lerTexto(s).map((x) => x.c).filter((w) => !GENERICAS_OP.has(w));
  const tw = conteudo(texto);
  if (!tw.length || tw.length > 6) return null;
  const notas = ops.map((o) => {
    const ow = new Set(conteudo(o.rotulo));
    const n = tw.filter((w) => ow.has(w) || (/^\d+$/.test(w) && ow.has(w))).length;
    return { o, n, de: ow.size };
  }).sort((a, b) => b.n - a.n || a.de - b.de);
  const [a, b] = notas;
  if (!a || a.n < 1 || (b && b.n === a.n) || (tw.length > 2 && a.n / tw.length < 0.75)) return null;
  return { valor: a.o.valor };
}

// ---------- continuação ("e amanhã?", "e a corrida?") ----------
const FILLER = new Set(['e', 'se', 'eu', 'for', 'fosse', 'entao', 'mas', 'quanto', 'como', 'fica', 'ficaria', 'ficar', 'tambem', 'ai', 'pra', 'para', 'no', 'na', 'o', 'a', 'de', 'do', 'da', 'que', 'em', 'vez', 'caso', 'tipo', 'ne', 'hein', 'agora', 'mesma', 'mesmo', 'coisa', 'pode', 'posso', 'ser', 'der', 'puder', 'vou', 'ir', 'dia']);
const VERBO_MOVER = /\b(fizer|fazer|faco|correr|corresse|passar|passo|mudar|mudo|trocar|troco|deixar|deixo|jogar|for)\b/;
const IRMAO = {
  treinador: { 'treino-perdido': 'corrida-perdida', 'qual-treino': 'corrida-dia', duracao: 'corrida-dia', semana: 'semana-corrida', 'pouco-tempo': 'corrida-dia', 'dor-treino': 'dor-corrida', antecipar: 'mover-corrida', 'mudar-plano': 'mudar-corrida', 'juntar-treino': 'juntar-corrida' },
  corrida: { 'corrida-perdida': 'treino-perdido', 'corrida-dia': 'qual-treino', 'semana-corrida': 'semana', 'mover-corrida': 'qual-treino', chuva: 'qual-treino', ritmo: 'qual-treino', 'dor-corrida': 'dor-treino', 'mudar-corrida': 'mudar-plano', 'juntar-corrida': 'juntar-treino' },
};
// sobra da frase sem as datas e sem as palavras de enchimento
function sobra(t, datas) {
  const w = t.split(' ').filter(Boolean);
  const fora = new Set();
  for (const d of datas) for (let k = d.ini; k <= d.fim; k++) fora.add(k);
  return w.filter((x, k) => !fora.has(k) && !LIGACAO.has(x) && !FILLER.has(x));
}
function continuar(texto, coach, ctx, mem, datas) {
  const t = normalizar(texto);
  const palavras = t.split(' ').filter(Boolean);
  if (palavras.length > 9) return null;
  const resto = sobra(t, datas);
  const novaData = datas.length ? datas[datas.length - 1].data : '';
  const comeca = /^(e|mas e|entao|e se|e pra|e para|e no|e na|e o|e a|e quanto)\b/.test(t);
  // só a data ("e amanhã?", "e se eu fizer na sexta?", "sábado"): o mesmo assunto, no outro dia
  if (!resto.filter((w) => !VERBO_MOVER.test(w)).length && novaData) {
    const assunto = mem.assunto && disponivel(intencaoPorId(mem.assunto), ctx) ? mem.assunto : coach === 'treinador' ? 'qual-treino' : coach === 'corrida' ? 'corrida-dia' : '';
    if (!assunto || !intencaoPorId(assunto) || !disponivel(intencaoPorId(assunto), ctx)) return null;
    const de = mem.de || mem.data || ctx.hoje;
    if (coach === 'corrida' && VERBO_MOVER.test(t) && intencaoPorId('mover-corrida') && disponivel(intencaoPorId('mover-corrida'), ctx) && ['corrida-dia', 'corrida-perdida', 'chuva', 'mover-corrida', 'ritmo', 'mais-rapido', 'mais-devagar', 'esteira'].includes(mem.assunto)) {
      return iniciar('mover-corrida', { ...ctx, de, data: novaData, antes: de, datas: [{ data: de }, { data: novaData }], texto: '' });
    }
    return iniciar(assunto, { ...ctx, data: novaData, antes: mem.data, datas, texto: t });
  }
  // "e a corrida?" / "e a musculação?": o assunto irmão no outro treino, no mesmo dia
  if ((comeca || palavras.length <= 3) && resto.length === 1) {
    const w = lerTexto(resto[0])[0];
    const alvo = w ? w.c : '';
    const data = novaData || mem.data || ctx.hoje;
    if (alvo === 'correr') {
      const id = (IRMAO.treinador[mem.assunto]) || (coach === 'corrida' ? mem.assunto : 'corrida-dia');
      const i = intencaoPorId(id);
      if (i && i.coach === 'corrida' && disponivel(i, ctx)) return iniciar(id, { ...ctx, data, datas, texto: t });
    }
    if (alvo === 'treino' || alvo === 'musculacao' || alvo === 'academia') {
      const id = (IRMAO.corrida[mem.assunto]) || (coach === 'treinador' ? mem.assunto : 'qual-treino');
      const i = intencaoPorId(id);
      if (i && i.coach === 'treinador' && disponivel(i, ctx)) return iniciar(id, { ...ctx, data, datas, texto: t });
    }
    if (alvo === 'semana') {
      const id = coach === 'corrida' ? 'semana-corrida' : 'semana';
      const i = intencaoPorId(id);
      if (i && disponivel(i, ctx)) return iniciar(id, { ...ctx, data, datas, texto: t });
    }
  }
  return null;
}

// ---------- mensagem com dois assuntos ----------
const SEPARA = /\s*(?:[,;.!?]+|\b(?:e|mas|porem|so que|alem disso|tambem|porque|pois|aí|ai)\b)\s*/;
const MARCAS = new Set(['chuva', 'dor', 'doente', 'cansado', 'esteira', 'viagem', 'dormir']);
const prioridade = (i) => (Number.isFinite(i.prioridade) ? i.prioridade : /(^|-)dor($|-)|saude/.test(i.id) ? 3 : 0);
function assuntosDaFrase(texto, coach, ctx) {
  const partes = normalizar(texto).replace(/\s+(e|mas|porem|tambem|porque|pois)\s+/g, ' , ').split(SEPARA).map((x) => x.trim()).filter((x) => x && lerTexto(x).length >= 1);
  if (partes.length < 2) return [];
  const achados = [];
  for (const p of partes) {
    const r = entender(p, coach, ctx);
    const [a, b] = r.ranking;
    if (!a) continue;
    // um trecho curto vale com uma palavra que sozinha já diz o assunto ("choveu", "dor", "doente")
    const toks = lerTexto(p);
    const ok = r.confiante || (a.pontos >= 1 && toks.length <= 3 && toks.some((x) => MARCAS.has(x.c)) && (!b || a.pontos - b.pontos >= 1));
    if (ok && !achados.some((x) => x.intencao.id === a.intencao.id)) achados.push(a);
  }
  return achados;
}

// Resposta ao texto digitado: sempre um Passo (alerta, resposta, confirmação, sugestões ou "não achei"), com `memoria`
// (a memória nova da conversa) e, quando o texto aceita uma ação em aberto, `executar` (índice da ação; a tela confirma).
export function responder(texto, coach, ctx) {
  const c0 = ctx || {};
  const mem = memoriaLimpa(c0.memoria);
  const c = { ...c0, coach, texto: normalizar(texto) };
  delete c.aberto; delete c.memoria;
  const r = entender(texto, coach, c);
  // o assunto pendente (de uma mensagem com dois assuntos) só fica enquanto a pessoa segue nos botões dele
  const memNova = { ...mem, pendente: [] };
  const fim = (p) => lembrar(limparPasso(p) || erroDePasso(), memNova, coach);
  // 1. segurança primeiro: alertas do corpo (com a triagem do peito), emergências de saúde e risco alimentar
  if (r.alerta) return fim(r.alerta.triagem ? passoTriagemPeito(coach) : passoAlerta(r.alerta, coach));
  const emerg = passoDeEmergencia(texto, c);
  if (emerg) return fim(emerg);
  const risco = sinaisDeRisco(texto);
  const pRisco = risco.length ? passoDeRisco(risco, c) : null;
  if (pRisco) return fim(pRisco);
  // 2. resposta à pergunta em aberto ("sim", "pode", "não", o texto de um botão)
  if (isObj(c0.aberto)) {
    const resp = respostaAberta(texto, c0.aberto, r.direto);
    if (resp && resp.executar != null) return { texto: ['Certo.'], executar: resp.executar, memoria: mem };
    if (resp && resp.valor != null) return seguir(c0.aberto, resp.valor, { ...c, memoria: mem });
    if (resp && resp.nao) return fim({ texto: ['Tudo bem, nada muda.'], opcoes: [{ rotulo: 'Ver os assuntos', valor: 'a' }], proximo: (v, cc) => saudacao(coach, cc) });
  }
  const datas = r.datas;
  const cData = { ...c, datas, ...(datas.length ? { data: datas[0].data } : {}) };
  // 3. continuação do assunto ("e amanhã?", "e a corrida?")
  if (!r.confiante || lerTexto(texto).length <= 2) {
    const cont = continuar(texto, coach, { ...c, memoria: mem }, mem, datas);
    if (cont) return lembrar(cont, memNova, coach);
  }
  // cumprimentos e agradecimentos
  const t = c.texto;
  if (/^(oi+|ola|bom dia|boa tarde|boa noite|e ai|eai|opa|hey|hello|oie)( (treinador|nutricionista|tudo bem|td bem|tudo bom))?$/.test(t)) return fim(saudacao(coach, c));
  if (/^(obrigad[oa]|valeu|vlw|brigad[oa]|obg|agradeco|muito obrigad[oa]|thanks|show|beleza|blz|ok|certo|entendi|ta bom|perfeito|otimo|massa|top)( (demais|mesmo|treinador|pela ajuda|viu))?$/.test(t)) return fim({ texto: ['Por nada! Se precisar de mais alguma coisa, é só escrever.'] });
  // 4. dois assuntos na mesma frase: o mais importante primeiro (a dor antes de tudo), o outro em seguida
  const varios = assuntosDaFrase(texto, coach, cData);
  if (varios.length >= 2 && (!r.confiante || varios.some((x) => x.intencao.id === r.melhor.intencao.id))) {
    const ordem = varios.map((x, k) => ({ ...x, k })).sort((a, b) => prioridade(b.intencao) - prioridade(a.intencao) || a.k - b.k);
    const [um, ...outros] = ordem;
    const p = iniciar(um.intencao.id, cData);
    const lead = `Vamos por partes. Primeiro, ${um.intencao.resumo}; depois, ${outros[0].intencao.resumo}.`;
    const novaMem = { ...memNova, pendente: outros.map((x) => x.intencao.id) };
    return lembrar({ ...p, texto: [lead, ...p.texto] }, novaMem, coach);
  }
  // 5. o assunto: direto quando é bem claro; senão, confirma
  if (r.confiante) {
    const i = r.melhor.intencao;
    const dataTxt = datas.length && !datas[0].semana && datas[0].data !== c.hoje && i.data ? noDia(datas[0].data, c.hoje) : '';
    if (r.direto) return lembrar(iniciar(i.id, cData), memNova, coach);
    const rd = i.resumoNoDia || i.resumo;
    const resumo = !dataTxt ? i.resumo : rd.includes('{dia}') ? rd.replace('{dia}', nomeDia(datas.find((d) => !d.semana && d.data !== c.hoje).data, c.hoje)) : `${rd} ${dataTxt}`;
    return fim({
      texto: [`Entendi que você quer falar sobre ${resumo}. É isso?`],
      opcoes: [{ rotulo: 'Sim', valor: 'sim' }, { rotulo: 'Não, outro assunto', valor: 'nao' }],
      proximo: (v, cc) => (v === 'sim' ? iniciar(i.id, { ...cc, datas, texto: c.texto, ...(cData.data ? { data: cData.data } : {}) }) : menu(noMenu(coach, cc), 'Qual destes?', [], coach)),
    });
  }
  if (r.deOutro) {
    const o = r.deOutro.intencao;
    return fim({ texto: [`Esse assunto é com ${o.coach === 'nutri' ? 'a' : 'o'} ${COACHES[o.coach]}: ${o.resumo}.`], ir: [{ rotulo: `Falar com ${o.coach === 'nutri' ? 'a' : 'o'} ${COACHES[o.coach]}`, rota: 'chat/' + o.coach }] });
  }
  // 6. uma pergunta frequente que casa bem: a resposta direto, como do treinador
  const perto = r.ranking.filter((x) => x.pontos >= 1).slice(0, 3).map((x) => x.intencao);
  const direta = faqDireta(texto, coach);
  if (direta) {
    const p = passoDaFaq(direta);
    if (perto.length) { p.opcoes = perto.slice(0, 2).map((i) => ({ rotulo: i.titulo, valor: i.id })); p.proximo = (v, cc) => iniciar(v, { ...cc, datas, texto: c.texto }); }
    return fim(p);
  }
  const faq = faqPara(texto, coach, 2);
  if (perto.length) {
    const p = menu(perto, perto.length === 1 ? 'Não tenho certeza. É sobre isto?' : 'Não tenho certeza. É sobre um destes?', [{ rotulo: 'Ver todos os assuntos', valor: '#todos' }], coach);
    const prox = p.proximo;
    return fim({ ...p, faq: faq.length ? faq : undefined, proximo: (v, cc) => (v === '#todos' ? saudacao(coach, cc) : prox(v, { ...cc, datas, texto: c.texto, ...(cData.data ? { data: cData.data } : {}) })) });
  }
  const todos = assuntos(coach, c);
  if (faq.length) return fim({ texto: ['Não achei esse assunto aqui. Veja se uma destas perguntas ajuda:'], faq, ...(todos.length ? { opcoes: [{ rotulo: 'Ver os assuntos', valor: 'v' }, { rotulo: 'Escrever de outro jeito', valor: 'e' }], proximo: (v, cc) => (v === 'v' ? saudacao(coach, cc) : { texto: ['Escreva com outras palavras, por exemplo: “choveu e não deu para correr”.'] }) } : {}) });
  return fim({ texto: ['Não achei esse assunto. Só respondo o que tem apoio nas pesquisas do app.'], ...(todos.length ? { opcoes: [{ rotulo: 'Ver os assuntos', valor: 'v' }, { rotulo: 'Perguntas frequentes', valor: 'f' }], proximo: (v, cc) => (v === 'v' ? saudacao(coach, cc) : passoFaq(coach, '')) } : {}) });
}

// O que o treinador diz depois de uma ação feita (com "Como fica a semana", quando a ação mexe na semana)
export function depoisDaAcao(a, coach, ctx) {
  const mem = memoriaLimpa(ctx && ctx.memoria);
  const data = isObj(a) && diaValido(a.data) ? a.data : ctx && ctx.hoje;
  const opcoes = [...(isObj(a) && a.semana ? [{ rotulo: 'Como fica a semana', valor: 'semana' }] : []), { rotulo: 'Ver os assuntos', valor: 'a' }];
  const p = { texto: [(isObj(a) && a.depois) || 'Pronto.'], opcoes, proximo: (v, cc) => (v === 'semana' ? passoSemana({ ...cc, data }, coach === 'corrida' ? 'corrida' : 'treinador') : saudacao(coach, cc)) };
  return lembrar(limparPasso(p), { ...mem, data }, coach);
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
  // para a memória da conversa: o dia de que o passo fala e o assunto
  if (diaValido(p.data)) out.data = p.data;
  if (typeof p.assunto === 'string' && p.assunto) out.assunto = p.assunto;
  if (isObj(p.memoria)) out.memoria = p.memoria;
  if (Number.isInteger(p.executar) && p.executar >= 0) out.executar = p.executar;
  if (!out.texto.length && !out.aviso && !out.faq) return null;
  return out;
}
// Segue para o próximo passo depois de um botão (com proteção). Com ctx.memoria, o passo volta com a memória nova.
export function seguir(passo, valor, ctx) {
  if (!passo || typeof passo.proximo !== 'function') return null;
  const mem = memoriaLimpa(ctx && ctx.memoria);
  const coach = (ctx && ctx.coach) || '';
  if (valor === '#pend' && mem.pendente.length) {
    const [id, ...resto] = mem.pendente;
    return lembrar(iniciar(id, { ...ctx, ...(mem.data ? { data: mem.data } : {}) }), { ...mem, pendente: resto }, coach);
  }
  let q = null;
  try { q = limparPasso(passo.proximo(valor, ctx)) || erroDePasso(); } catch { q = erroDePasso(); }
  return lembrar(q, mem, coach);
}
// a nome do dia para os textos dos testes e da tela ("hoje", "amanhã", "sexta")
export { nomeDia };

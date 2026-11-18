// Peças comuns dos assuntos do chat (logic/chat/treino.js, corrida.js e o motor). Puro: sem DOM.
// Fica separado do motor para os módulos de assuntos não importarem o motor (que importa todos eles).
import { REFS } from '../../data/knowledge.js';
import { REFS_CORRIDA } from '../../data/corrida.js';

// Texto da referência (as duas listas do app: Treinador/Nutricionista e Treinador de corrida); '' se não existe.
export const textoDaRef = (k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(REFS, k) ? REFS[k] : typeof k === 'string' && Object.prototype.hasOwnProperty.call(REFS_CORRIDA, k) ? REFS_CORRIDA[k] : '');
// só as chaves que existem, sem repetir
export const refsValidas = (l) => [...new Set((Array.isArray(l) ? l : []).filter((k) => textoDaRef(k)))];

// ---------- situações contadas, sem pergunta (texto já normalizado: sem acento, minúsculo) ----------
// Quem está doente é outra pessoa ("minha filha está com febre"): não é um problema de saúde de quem escreve.
const OUTRA_PESSOA = /\b(minha|meu|o|a|da|do|na|no) (filh[oa]s?|mae|pai|espos[oa]|marido|mulher|bebe|nenem|namorad[oa]|vo|avo|sogr[oa]|irm[ao]o?|cachorr[oa]|gat[oa]|cunhad[oa]|tia|tio|primo|prima|amig[oa]|crianca|criancas|menino|menina|neto|neta)\b/;
export const doencaDeOutro = (t) => OUTRA_PESSOA.test(t) && /\b(febre|gripe|gripad[oa]|doente|passou mal|vomit\w*|diarreia|internad[oa]|hospital|virose|dodoi|chorando|machucou)\b/.test(t) && !/\b(eu|to|estou|tou) (tambem |meio |bem |muito )?(com|doente|gripad|febril|mal)\b/.test(t);
// O que impede de treinar hoje, contado como situação ("peguei plantão", "o voo atrasou", "fiquei até 22h no escritório",
// "minha filha está com febre e vou ficar com ela"). Não vale quando a pessoa diz quanto tempo tem (isso é pouco tempo).
const IMPEDE = /\b(plantao|turno|hora extra|serao|preso|presa|atrasou|atrasado|atrasada|voo|aeroporto|rodoviaria|quebrou|pneu|transito|engarrafamento|mudanca|visita|velorio|enterro|casamento|formatura|cuidar|cuidando|fechando|escritorio|ate \d+ ?h?|ate tarde|virei a noite|nao dormi|dormi (\d|duas|tres|mal|pouco)|tenis (rasgou|furou|estragou)|sem tenis|ficar com (ele|ela|eles|elas|meu|minha|o|a))\b/;
export const impedimento = (t) => (IMPEDE.test(t) || doencaDeOutro(t)) && !/\b(daqui|em) (a )?(\d+|meia|uma|dez|vinte|trinta|quarenta) ?(min|minuto|minutos|hora|horas|h)\b/.test(t);
// Cansou de algo ("enjoado da mesma coisa", "enjoei do frango"): não é enjoo de estômago
export const cansouDe = (t) => /\b(enjoad[oa]|enjoei|cansad[oa]|cansei|saturad[oa]) (d[aeo]s? |de ficar |de fazer )?(mesm[ao]|msm|ficha|treino|rotina|cardapio|comida|frango|dieta|isso|so isso)\b|\b(mesm[ao]|msm) coisa\b.*\benjo|\benjo\w* (d[aeo]s? )?(mesm[ao]|msm) coisa\b/.test(t);
// Pouco tempo contado como situação: "entro no trabalho daqui a 40 min", "tenho que estar no serviço às 6h30"
export const tempoApertado = (t) => /\b(daqui|em) (a )?(\d+|meia|uma|dez|vinte|trinta|quarenta) ?(min|minuto|minutos|hora|horas|h)\b/.test(t) || /\b(tenho|preciso) (que|de) (estar|ta|tar|chegar|entrar|sair)\b.*\b\d+ ?h/.test(t) || /\bfecha (daqui|em|as|logo)\b/.test(t);

// Um item das perguntas frequentes no formato do Passo (resposta inteira, com as fontes): null se não achar a pergunta.
export function faqDe(lista, comeco) {
  const it = (Array.isArray(lista) ? lista : []).find((x) => x && typeof x.q === 'string' && x.q.startsWith(comeco));
  return it ? { q: it.q, a: [...it.a, ...(Array.isArray(it.mais) ? it.mais : [])], refs: refsValidas(it.f) } : null;
}

export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
export const virgula = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
// "1 min 30 s", "2 min", "45 s"
export function fmtDescanso(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  const m = Math.floor(s / 60), r = s % 60;
  return m && r ? `${m} min ${r} s` : m ? `${m} min` : `${r} s`;
}
// "a, b e c"
export const juntar = (l) => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]);

// ---------- datas na conversa ("amanhã", "na sexta", "semana que vem"...) ----------
// Tudo em 'AAAA-MM-DD', com as contas ao meio-dia UTC (como logic/perdido.js e logic/corrida.js).
const DIA_MS = 86400000;
export const somaDia = (k, n) => new Date(Date.parse(k + 'T12:00:00Z') + n * DIA_MS).toISOString().slice(0, 10);
export const wdDe = (k) => new Date(k + 'T12:00:00Z').getUTCDay();
export const segundaDa = (k) => somaDia(k, -((wdDe(k) + 6) % 7));
export const diaValido = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
export const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// "hoje", "amanhã", "ontem", "sexta" (desta semana), "sexta que vem", "sexta passada"
export function nomeDia(k, hoje) {
  if (!diaValido(k) || !diaValido(hoje)) return '';
  if (k === hoje) return 'hoje';
  if (k === somaDia(hoje, 1)) return 'amanhã';
  if (k === somaDia(hoje, -1)) return 'ontem';
  const n = NOME_DIA[wdDe(k)];
  if (segundaDa(k) === segundaDa(hoje)) return n;
  return k > hoje ? `${n} que vem` : `${n} passad${wdDe(k) === 0 || wdDe(k) === 6 ? 'o' : 'a'}`;
}
// "na sexta" / "no sábado" / "hoje" / "amanhã"
export function noDia(k, hoje) {
  const n = nomeDia(k, hoje);
  if (!n || n === 'hoje' || n === 'amanhã' || n === 'ontem') return n;
  return (wdDe(k) === 0 || wdDe(k) === 6 ? 'no ' : 'na ') + n;
}
// "Seg 16/11"
export const diaCurto = (k) => `${CURTO[wdDe(k)].charAt(0).toUpperCase() + CURTO[wdDe(k)].slice(1)} ${k.slice(8, 10)}/${k.slice(5, 7)}`;
const SEMANA_NOMES = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, sab: 6, dom: 0 };
const NAO_E_DIA = new Set(['serie', 'series', 'vez', 'vezes', 'opcao', 'parte', 'mao', 'pessoa', 'chance', 'etapa', 'semana', 'rodada', 'volta']);
const PASSADO = /\b(passad[oa]|ultim[oa]|fui|faltei|treinei|corri|perdi|deixei|pulei|tive|teve|foi|era|estava|fiz|malhei|consegui|deu|rolou)\b/;
// As datas citadas num texto já normalizado (logic/chat/motor.js, normalizar): [{ data, semana?: true, ini, fim }] na ordem
// em que aparecem. `semana` = a pessoa falou da semana inteira ("semana que vem", "essa semana"): data = a segunda.
// `ini` e `fim` = posições das palavras (para o motor saber o que sobra da frase sem as datas).
export function lerDatas(t, hoje) {
  if (!diaValido(hoje) || typeof t !== 'string') return [];
  const w = t.split(' ').filter(Boolean);
  const out = [];
  const wd0 = wdDe(hoje);
  const passado = PASSADO.test(t);
  const add = (data, ini, fim, extra = {}) => { if (diaValido(data)) out.push({ data, ini, fim, ...extra }); };
  for (let i = 0; i < w.length; i++) {
    const a = w[i], b = w[i + 1] || '', c = w[i + 2] || '';
    if (a === 'depois' && (b === 'de' || b === 'amanha') && (b === 'amanha' || c === 'amanha')) { const f = b === 'amanha' ? i + 1 : i + 2; add(somaDia(hoje, 2), i, f); i = f; continue; }
    if (a === 'anteontem' || a === 'antiontem') { add(somaDia(hoje, -2), i, i); continue; }
    if (a === 'antes' && b === 'de' && c === 'ontem') { add(somaDia(hoje, -2), i, i + 2); i += 2; continue; }
    if (a === 'amanha' || a === 'amanhan' || a === 'amanhá') { add(somaDia(hoje, 1), i, i); continue; }
    if (a === 'ontem') { add(somaDia(hoje, -1), i, i); continue; }
    if (a === 'hoje') { add(hoje, i, i, { hoje: true }); continue; }
    if ((a === 'fim' || a === 'final') && (b === 'de' || b === 'da') && c === 'semana') { add(somaDia(hoje, wd0 === 0 ? 0 : (6 - wd0 + 7) % 7), i, i + 2); i += 2; continue; }
    if (a === 'fds') { add(somaDia(hoje, wd0 === 0 ? 0 : (6 - wd0 + 7) % 7), i, i); continue; }
    if (a === 'semana') {
      const seg = segundaDa(hoje);
      if (b === 'que' && c === 'vem') { add(somaDia(seg, 7), i, i + 2, { semana: true }); i += 2; continue; }
      if (b === 'seguinte') { add(somaDia(seg, 7), i, i + 1, { semana: true }); i += 1; continue; }
      if (b === 'passada') { add(somaDia(seg, -7), i, i + 1, { semana: true }); i += 1; continue; }
      const antes = w[i - 1] || '';
      if (antes === 'proxima' || antes === 'outra') { add(somaDia(seg, 7), i - 1, i, { semana: true }); continue; }
      if (['essa', 'esta', 'nessa', 'nesta', 'minha', 'toda'].includes(antes) || b === 'toda' || b === 'inteira') { add(seg, i - 1, i, { semana: true }); continue; }
      continue;
    }
    if (a === 'dia' && /^\d{1,2}$/.test(b)) {
      const n = Number(b);
      const [y, m, d] = hoje.split('-').map(Number);
      if (n >= 1 && n <= 31) {
        let yy = y, mm = m;
        if (n < d) { mm++; if (mm > 12) { mm = 1; yy++; } }
        add(`${yy}-${String(mm).padStart(2, '0')}-${String(n).padStart(2, '0')}`, i, i + 1);
      }
      i += 1; continue;
    }
    if (Object.prototype.hasOwnProperty.call(SEMANA_NOMES, a) && !NAO_E_DIA.has(b) && !(a === 'segunda' && /^(serie|vez)/.test(b))) {
      if ((a === 'sab' || a === 'dom') && w.length > 3 && !['no', 'na', 'e', 'ate', 'pra', 'para', 'de', 'do', 'da'].includes(w[i - 1] || '')) continue;
      const alvo = SEMANA_NOMES[a];
      let fim = i;
      if (b === 'feira') fim++;
      const prox = ['que', 'vem'].every((x, j) => w[fim + 1 + j] === x) || (w[i - 1] === 'proxima' || w[i - 1] === 'proximo');
      const passou = w[fim + 1] === 'passada' || w[fim + 1] === 'passado' || w[i - 1] === 'ultima' || w[i - 1] === 'ultimo';
      if (prox && w[fim + 1] === 'que') fim += 2;
      if (passou && (w[fim + 1] === 'passada' || w[fim + 1] === 'passado')) fim++;
      let k = (alvo - wd0 + 7) % 7;
      if (passou) { const back = (wd0 - alvo + 7) % 7 || 7; add(somaDia(hoje, -back), i, fim); }
      else if (prox) add(somaDia(hoje, k || 7), i, fim);
      else if (passado && k !== 0) { const back = (wd0 - alvo + 7) % 7; add(segundaDa(somaDia(hoje, -back)) === segundaDa(hoje) ? somaDia(hoje, -back) : somaDia(hoje, k), i, fim); }
      else add(somaDia(hoje, k), i, fim);
      i = fim; continue;
    }
  }
  return out;
}

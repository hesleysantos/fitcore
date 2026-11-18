// "Entidades" do texto livre do chat: o exercício citado (pelo catálogo data/exercises.js, com os nomes e os apelidos),
// a parte do corpo, o músculo e os números (kg, séries, repetições, minutos, km, vezes). Puro: sem DOM, sem IA.
// É o que faz "posso aumentar o peso no supino?" ou "quantas séries de agachamento eu faço?" responderem sobre AQUELE
// exercício do plano, e não com uma lista. Quando o nome serve para mais de um exercício do plano ("supino", com dois
// supinos), devolve os candidatos para a pessoa escolher, em vez de adivinhar.
import { EXERCICIOS, EX_POR_ID } from '../../data/exercises.js';
import { expandir, radical, idfDe } from './nlu.js';

const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// palavras do nome que não identificam o exercício (modo de fazer, aparelho genérico, ligação)
const GENERICAS = new Set(('com de do da dos das na no nas nos em e a o as os para pra pro um uma ao reto reta sentado sentada livre pe em maquina barra halteres halter '
  + 'unilateral alternado alternada pegada aberta fechada neutra banco cabo peso corporal aparelho frente tipo alta baixa alto baixo apoio apoiado parado chao '
  + 'joelhos ajoelhado corda inclinado inclinada declinado declinada articulada articulado polia smith simultaneo simultanea bilateral '
  + 'leve curto curta longo longa normal tradicional classico classica variacao versao estilo lado apoiada '
  // partes do corpo: no nome dizem onde apoia ou o que mexe, não qual é o exercício ("dor no joelho" não é "joelho alto")
  + 'joelho perna pernas braco bracos ombro ombros peito costas quadril gluteo gluteos mao maos pes dedos cabeca tronco corpo inteiro').split(' '));
let GEN_RAD = null;
const tokensNome = (s) => { if (!GEN_RAD) GEN_RAD = new Set([...GENERICAS].filter((g) => g.length >= 4).map(radical)); return norm(s).split(' ').filter((w) => w.length >= 3 && !GENERICAS.has(w)).map(radical).filter((r) => !GEN_RAD.has(r)); };

// radicais de verbos e palavras do dia a dia que também começam nomes de exercício ("passar" e "passada", "correr" e
// "corrida"): sozinhos não indicam exercício
const COMUNS = new Set(['pass', 'faz', 'fic', 'cheg', 'tir', 'vir', 'lev', 'dev', 'pod', 'quer', 'sab', 'est', 'ach', 'volt', 'corr', 'and', 'sub', 'desc', 'port', 'abr', 'fech', 'mand', 'tom', 'bot', 'come', 'beb', 'trabalh', 'pens', 'olh', 'perd', 'ganh', 'gost', 'ped', 'precis', 'mud', 'troc', 'cam', 'caminh', 'sal', 'puls', 'pul', 'segur', 'empurr', 'pux_x', 'vid', 'cas', 'dia', 'hor', 'tempo', 'temp', 'mes', 'ano', 'sem', 'vez']);
let indice = null;
function montar() {
  if (indice) return indice;
  const porEx = new Map();     // id → [[radicais de uma forma do nome], ...] (a primeira forma é o nome)
  const palavras = new Set();  // radicais que aparecem em nomes de exercício
  for (const ex of EXERCICIOS) {
    const formas = [];
    for (const nome of [ex.nome, ...(Array.isArray(ex.aliases) ? ex.aliases : [])]) {
      const t = tokensNome(nome);
      if (t.length && !formas.some((f) => f.join(' ') === t.join(' '))) formas.push(t);
    }
    porEx.set(ex.id, formas);
    for (const f of formas) for (const w of f) palavras.add(w);
  }
  const idf = idfDe([...porEx.values()].map((fs) => new Set(fs.flat())));
  indice = { porEx, palavras, idf };
  return indice;
}

// Radicais do texto (já com as abreviações expandidas)
// palavras de pergunta e de ligação: nunca são parte do nome de um exercício ("como" não é "face pull")
const FORA_DO_NOME = new Set('como faco faz fazer qual quais que quanto quantos quantas posso pode tem tenho para pra pro com sem mais menos muito muita hoje amanha voce meu minha meus minhas esse essa isso ele ela dia dias vez vezes estou esta ta to vou vai quero queria sobre outro outra uma uns umas por pelo pela nao sim'.split(' '));
export const radicaisDoTexto = (texto) => expandir(norm(texto)).split(' ').filter((w) => w.length >= 3 && !FORA_DO_NOME.has(w)).map(radical);
// ids dos exercícios do plano
export const idsDoPlano = (plan) => new Set(plan && Array.isArray(plan.dias) ? plan.dias.flatMap((d) => (Array.isArray(d.itens) ? d.itens : []).map((it) => it && it.ex)).filter((id) => EX_POR_ID.has(id)) : []);

// O exercício citado no texto. `plan` (opcional): o plano ativo, cujos exercícios têm preferência.
// Devolve null ou { ex (objeto do catálogo) | null, candidatos: [ex, ...] (quando o nome serve para mais de um),
// noPlano: true|false, palavras: [radicais do exercício achados no texto] }.
export function exercicioDoTexto(texto, plan = null) {
  const { porEx, palavras, idf } = montar();
  const tw = radicaisDoTexto(texto);
  const ts = new Set(tw);
  const doTexto = [...new Set(tw.filter((w) => palavras.has(w) && w.length >= 3 && !COMUNS.has(w)))];
  if (!doTexto.length) return null;
  const noPlano = idsDoPlano(plan);
  // forma inteira do nome no texto ("agachamento goblet", "stiff", "peck deck"): pontos pelo peso das palavras
  const notaInteira = (id) => {
    let m = 0;
    for (const f of porEx.get(id) || []) if (f.every((w) => ts.has(w))) m = Math.max(m, f.reduce((s, w) => s + (idf.get(w) || 1), 0) + f.length);
    return m;
  };
  // parte do nome ("agachamento" para "Agachamento goblet"): só para os exercícios do plano
  const notaParte = (id) => { const f = (porEx.get(id) || [])[0] || []; return doTexto.filter((w) => w.length >= 4 && f.includes(w)).reduce((s, w) => s + (idf.get(w) || 1), 0); };
  const melhores = (ids, nota) => {
    let max = 0, l = [];
    for (const id of ids) { const n = nota(id); if (n > max + 1e-9) { max = n; l = [id]; } else if (n > 0 && Math.abs(n - max) < 1e-9) l.push(id); }
    return { max, l };
  };
  let pi = melhores(noPlano, notaInteira);
  let pp = melhores(noPlano, notaParte);
  // empate pela parte do nome: fica quem começa pela palavra achada ("peck deck" é o Peck deck, não o Crucifixo inverso no peck deck)
  const cabeca = (l) => { const c = l.filter((id) => doTexto.includes(((porEx.get(id) || [])[0] || [])[0])); return c.length ? c : l; };
  if (pp.l.length > 1) pp = { max: pp.max, l: cabeca(pp.l) };
  // catálogo inteiro (só a forma inteira do nome, e com peso: uma palavra comum não vira exercício)
  const ci = melhores(EX_POR_ID.keys(), notaInteira);
  const fim = (ids, dentro) => {
    const exs = ids.map((id) => EX_POR_ID.get(id));
    return exs.length === 1 ? { ex: exs[0], candidatos: [], noPlano: dentro, palavras: doTexto } : { ex: null, candidatos: exs.slice(0, 5), noPlano: dentro, palavras: doTexto };
  };
  // "supino" com dois supinos no plano: o nome achado serve também para outro do plano do mesmo tipo (mesma primeira
  // palavra e todas as palavras achadas) → a pessoa escolhe
  if (pi.l.length === 1) {
    const forma = (porEx.get(pi.l[0]) || []).filter((f) => f.every((w) => ts.has(w))).sort((a, b) => b.length - a.length)[0] || [];
    const outros = [...noPlano].filter((id) => { if (id === pi.l[0] || !forma.length) return false; const n = (porEx.get(id) || [])[0] || []; return forma.includes(n[0]) && forma.every((w) => n.includes(w)); });
    if (outros.length) pi = { max: pi.max, l: [pi.l[0], ...outros] };
  }
  if (pi.l.length && pi.max >= ci.max - 1e-9) return fim(pi.l, true);
  if (pp.l.length && pp.max >= 1.5 && pp.max >= ci.max * 0.6) return fim(pp.l, true);
  if (ci.l.length && ci.max >= 3) return fim(ci.l.slice(0, 5), false);
  return null;
}

// ---------- parte do corpo e músculo ----------
// palavra (radical) → local de dor (logic/dor.js, LOCAIS_DOR) e marca de cuidado do catálogo (ex.cuidado)
const CORPO = [
  [['joelh'], 'joelho', 'joelho'], [['ombr'], 'ombro', 'ombro'], [['lomb', 'coluna', 'costa', 'lombar'], 'lombar', 'lombar'], [['pescoc', 'cervic', 'nuca'], 'pescoco', 'cervical'],
  [['cotovel'], 'cotovelo', 'cotovelo'], [['punh', 'puls', 'mao', 'maos'], 'punho', 'punho'], [['quadril'], 'quadril', 'quadril'], [['virilh'], 'virilha', ''],
  [['tornozel'], 'tornozelo', 'tornozelo'], [['canel'], 'canela', ''], [['panturrilh'], 'panturrilha', ''], [['aquil'], 'aquiles', 'tornozelo'], [['pe', 'sola', 'calcanh'], 'pe', 'tornozelo'],
  [['coxa'], 'coxa-frente', ''], [['glute', 'bunda'], 'gluteo', 'quadril'], [['brac', 'bicep', 'tricep'], 'braco', ''], [['barrig', 'abdom'], 'abdomen', ''],
];
export function corpoDoTexto(texto) {
  const tw = expandir(norm(texto)).split(' ');
  const rs = tw.map((w) => (w.length >= 4 ? radical(w) : w));
  for (const [chaves, onde, cuidado] of CORPO) if (rs.some((w, k) => chaves.some((c) => w === c || tw[k] === c || (c.length >= 4 && (w.startsWith(c) || tw[k].startsWith(c)))))) return { onde, cuidado };
  return null;
}
// grupo muscular (data/muscles.js, GRUPOS) citado: "glúteo", "peito", "braço" → ['biceps', 'triceps']...
const MUSC = [
  [['glute', 'bunda'], ['gluteos']], [['peit'], ['peito']], [['costa', 'dorsal', 'dorsai'], ['costas']], [['ombr', 'deltoid'], ['ombros']], [['bicep'], ['biceps']], [['tricep'], ['triceps']],
  [['brac'], ['biceps', 'triceps']], [['antebrac'], ['antebraco']], [['abdom', 'barrig', 'abdominal', 'core', 'tanquinh'], ['abdomen']], [['quadricep'], ['quadriceps']],
  [['posterior'], ['posteriores']], [['panturrilh'], ['panturrilhas']], [['pern', 'coxa'], ['quadriceps', 'posteriores']], [['adutor', 'abdutor'], ['adutores']],
];
export function musculosDoTexto(texto) {
  const tw = expandir(norm(texto)).split(' ');
  const rs = tw.map((w) => (w.length >= 4 ? radical(w) : w));
  const out = [];
  for (const [chaves, gs] of MUSC) if (rs.some((w, k) => chaves.some((c) => w.startsWith(c) || tw[k].startsWith(c)))) for (const g of gs) if (!out.includes(g)) out.push(g);
  // "antebraço" contém "braço": fica só o antebraço
  if (out.includes('antebraco')) return out.filter((g) => g !== 'biceps' && g !== 'triceps');
  return out;
}

// ---------- números ----------
const UNI = { kg: 'kg', quilo: 'kg', quilos: 'kg', serie: 'series', series: 'series', repeticao: 'reps', repeticoes: 'reps', reps: 'reps', rep: 'reps', minuto: 'min', minutos: 'min', min: 'min', km: 'km', quilometro: 'km', quilometros: 'km', vez: 'vezes', vezes: 'vezes', hora: 'horas', horas: 'horas', segundo: 'seg', segundos: 'seg', litro: 'litros', litros: 'litros', dia: 'dias', dias: 'dias' };
const POR_EXTENSO = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50 };
// [{ n, unidade }] na ordem do texto ("meia hora" → 30 min, "2 horas" → 120 min)
export function numerosDoTexto(texto) {
  const w = expandir(norm(texto)).split(' ');
  const out = [];
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 'meia' && w[i + 1] === 'hora') { out.push({ n: 30, unidade: 'min' }); i++; continue; }
    const digito = /^\d+$/.test(w[i]);
    const n = digito ? Number(w[i]) : POR_EXTENSO[w[i]];
    if (n == null) continue;
    const u = UNI[w[i + 1]] || '';
    if (u === 'horas') { out.push({ n: n * 60, unidade: 'min' }); i++; continue; }
    if (u || digito) out.push({ n, unidade: u });
  }
  return out;
}

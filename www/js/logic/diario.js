// Diário alimentar: o que a pessoa comeu de fato em cada dia, por refeição, e a comparação com a meta do dia.
// Puro: sem DOM e sem importar o estado. Tudo o que entra (aparelho, backup importado, tela) passa por limparDiario()
// ou gravarItem(): só sobrevive o que tem o formato abaixo.
//
// Formato de state.diario:
//   { dias: [ { data: 'AAAA-MM-DD', itens: [ item, ... ] }, ... ] }        (dias em ordem de data, só os que têm item)
//   item do catálogo:        { id, ref, al: id de ALIMENTOS, g: gramas (inteiro), m: true se a pessoa informou em medida caseira }
//   item fora da lista:      { id, ref, nome: texto curto, kcal: inteiro, p: gramas de proteína ou null }
//   ref = id de REFEICOES (as refeições do cardápio de exemplo e "outro horário"); id = único dentro do dia.
//
// Cuidados (refs em data/knowledge.js):
//   - registro alimentar subestima o consumo: nos estudos com água duplamente marcada, o diário fica de 11% a 41% abaixo
//     do gasto medido (burrows2019); e as calorias dos alimentos são médias de tabela (taco). A tela diz isso em uma linha.
//   - contagem de calorias e transtorno alimentar: em mulheres com comportamento de transtorno alimentar, aplicativos de
//     contagem desencadearam ou pioraram os sintomas — fixação em números, culpa com o aviso de "passou do limite" e
//     satisfação em ficar abaixo dele (eikey2021). Por isso: quem marcou transtorno alimentar não recebe o diário; a
//     comparação com a meta não usa cor de erro nem palavra de culpa; e o "faltam" não é tratado como conquista.
//   - menores de 18 anos: a orientação é hábito saudável, não peso nem dieta (golden2016); o aplicativo já não calcula
//     calorias para eles, e o diário mostra só os alimentos, sem calorias.
//   - gestantes, lactantes, doença renal e estimativa de gasto não confiável (modo educativo): o diário soma as
//     calorias, mas não compara com meta (não há meta para comparar).
import { ALIMENTOS } from '../data/foods.js';
import { calcular, respostasCompletas, medida, contextoDasEntrevistas } from './nutrition.js';
import { resumoParaNutricao } from './corrida.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));
// Refeições do diário (id → nome), na ordem do dia. Os nomes são os mesmos do cardápio de exemplo.
export const REFEICOES = { cafe: 'Café da manhã', 'lanche-manha': 'Lanche da manhã', almoco: 'Almoço', 'lanche-tarde': 'Lanche da tarde', jantar: 'Jantar', ceia: 'Ceia', outro: 'Outro horário' };
const ORDEM = Object.keys(REFEICOES);
export const MAX_DIAS = 400;        // pouco mais de um ano de registros; os mais antigos saem
export const MAX_ITENS_DIA = 60;
export const G_MIN = 1, G_MAX = 2000;       // gramas de um alimento em um registro
export const KCAL_MAX = 5000, PROT_MAX = 300, NOME_MAX = 40;   // alimento fora da lista
const DATA_MIN = '2020-01-01';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const tem = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pad = (n) => String(n).padStart(2, '0');
// dia do calendário que existe de verdade (31 de fevereiro não passa)
const dia = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const t = new Date(v + 'T12:00:00Z');
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v ? v : '';
};
// dia local de hoje e soma de dias a uma data 'AAAA-MM-DD'
export const hojeLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const somarDias = (data, n) => { const t = new Date(data + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const tempo = (data) => Date.parse(data + 'T12:00:00Z');
// data aceita no diário: real, de 2020 em diante e no máximo amanhã (folga para quem muda de fuso; futuro distante não
// entra). A comparação é por número, para um `hoje` distante (ex.: 9999-12-31) não estourar. Com `semFuturo`, não há
// corte de futuro (serve a quem valida sem confiar no relógio do aparelho).
const dataAceita = (v, hoje, semFuturo = false) => { const d = dia(v); return d && d >= DATA_MIN && (semFuturo || tempo(d) <= tempo(dia(hoje) || hojeLocal()) + 86400000) ? d : ''; };
// primeiro dia que a tela deixa abrir e gravar: os últimos MAX_DIAS dias (assim um registro novo nunca é cortado pelo limite)
export const primeiroDiaDoDiario = (hoje) => { const p = somarDias(dia(hoje) || hojeLocal(), -(MAX_DIAS - 1)); return p < DATA_MIN ? DATA_MIN : p; };
// texto digitado pela pessoa: sem caracteres de controle, espaços juntados, cortado
const CONTROLE = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127, 8232, 8233) + ']', 'g');
const textoCurto = (v, max) => (typeof v === 'string' ? v.replace(CONTROLE, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim() : '');
const ID_OK = /^[\w-]{1,24}$/;

// Item validado ou null.
export function limparItem(raw) {
  if (!isObj(raw)) return null;
  const id = tem(raw, 'id') && typeof raw.id === 'string' && ID_OK.test(raw.id) ? raw.id : '';
  if (!id) return null;
  const ref = tem(raw, 'ref') && tem(REFEICOES, raw.ref) ? raw.ref : 'outro';
  if (tem(raw, 'al')) {
    if (typeof raw.al !== 'string' || !FOOD.has(raw.al)) return null;
    const g = numero(raw.g);
    if (g == null || Math.round(g) < G_MIN || Math.round(g) > G_MAX) return null;
    return { id, ref, al: raw.al, g: Math.round(g), m: tem(raw, 'm') && raw.m === true };
  }
  const nome = textoCurto(tem(raw, 'nome') ? raw.nome : '', NOME_MAX);
  const kcal = tem(raw, 'kcal') ? numero(raw.kcal) : null;
  if (!nome || kcal == null || kcal < 0 || Math.round(kcal) > KCAL_MAX) return null;
  const p = tem(raw, 'p') ? numero(raw.p) : null;
  return { id, ref, nome, kcal: Math.round(kcal), p: p != null && p >= 0 && p <= PROT_MAX ? Math.round(p * 10) / 10 : null };
}
function limparItens(raw) {
  const out = [];
  const vistos = new Set();
  if (!Array.isArray(raw)) return out;
  for (const x of raw) {
    const it = limparItem(x);
    if (!it || vistos.has(it.id)) continue;
    vistos.add(it.id); out.push(it);
    if (out.length >= MAX_ITENS_DIA) break;
  }
  return out;
}
const porData = (a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0);

export const diarioPadrao = () => ({ dias: [] });
// Validação na fronteira (armazenamento e backup importado). `hoje` = 'AAAA-MM-DD' (dia local); sem ele, vale o relógio.
// `semCorteDeFuturo: true` mantém os dias à frente de `hoje` (relógio do aparelho atrasado não apaga registros); um
// `hoje` distante, como '9999-12-31', dá no mesmo.
export function limparDiario(raw, hoje, { semCorteDeFuturo = false } = {}) {
  const d = diarioPadrao();
  if (!isObj(raw) || !tem(raw, 'dias') || !Array.isArray(raw.dias)) return d;
  const ref = dia(hoje) || hojeLocal();
  const mapa = new Map();
  for (const x of raw.dias) {
    if (!isObj(x) || !tem(x, 'data')) continue;
    const data = dataAceita(x.data, ref, semCorteDeFuturo === true);
    if (!data || mapa.has(data)) continue;          // dia repetido: vale o primeiro
    const itens = limparItens(tem(x, 'itens') ? x.itens : null);
    if (itens.length) mapa.set(data, { data, itens });
  }
  // ordena antes de cortar, para ficar com os dias mais recentes
  d.dias = [...mapa.values()].sort(porData).slice(-MAX_DIAS);
  return d;
}

// ---------- leitura ----------
const diasDe = (diario) => (isObj(diario) && Array.isArray(diario.dias) ? diario.dias : []);
export function itensDoDia(diario, data) {
  const d = diasDe(diario).find((x) => isObj(x) && x.data === data);
  return d ? limparItens(d.itens) : [];
}
export const idDaRefeicao = (nome) => ORDEM.find((k) => REFEICOES[k] === nome) || 'outro';
export const refeicaoRegistrada = (diario, data, ref) => itensDoDia(diario, data).some((x) => x.ref === ref);
// A refeição sugerida pelo cardápio já está no diário do dia? Vale quando TODOS os alimentos dela estão registrados
// naquela refeição (a quantidade pode ter sido corrigida). Um alimento avulso na mesma refeição não conta.
export function refeicaoCopiada(diario, data, refeicao) {
  if (!isObj(refeicao) || !Array.isArray(refeicao.itens)) return false;
  const ref = idDaRefeicao(refeicao.nome);
  const tem = new Set(itensDoDia(diario, data).filter((x) => x.ref === ref && x.al).map((x) => x.al));
  const sugeridos = refeicao.itens.filter((x) => isObj(x) && FOOD.has(x.id));
  return sugeridos.length > 0 && sugeridos.every((x) => tem.has(x.id));
}
export const diasRegistrados = (diario) => diasDe(diario).filter((x) => isObj(x) && dia(x.data) && Array.isArray(x.itens) && x.itens.length).map((x) => x.data).sort();

// ---------- escrita (mudam o objeto `diario`, que é state.diario) ----------
function guardar(diario, data, itens) {
  const outros = diasDe(diario).filter((x) => isObj(x) && dia(x.data) && x.data !== data);
  if (itens.length) outros.push({ data, itens });
  diario.dias = outros.sort(porData).slice(-MAX_DIAS);
}
const novoId = (itens) => 'i' + (itens.reduce((mx, x) => { const m = /^i(\d+)$/.exec(x.id); return m ? Math.max(mx, Number(m[1])) : mx; }, 0) + 1);
// Grava um item novo (sem `id`) ou troca um existente (com o `id` dele). Devolve o item gravado, ou null se for
// inválido, se a data não for aceita (dia real, dentro dos últimos MAX_DIAS dias e até hoje) ou se o dia já estiver
// cheio. Nunca devolve sucesso para um item que não ficou guardado.
export function gravarItem(diario, data, raw, hoje) {
  const ref = dia(hoje) || hojeLocal();
  const d = dataAceita(data, ref);
  if (!isObj(diario) || !d || d > ref || d < primeiroDiaDoDiario(ref) || !isObj(raw)) return null;
  const itens = itensDoDia(diario, d);
  const idAtual = tem(raw, 'id') && typeof raw.id === 'string' ? raw.id : '';
  const i = idAtual ? itens.findIndex((x) => x.id === idAtual) : -1;
  if (idAtual && i < 0) return null;                       // editar um item que não existe
  if (i < 0 && itens.length >= MAX_ITENS_DIA) return null;
  const it = limparItem({ ...raw, id: i >= 0 ? idAtual : novoId(itens) });
  if (!it) return null;
  if (i >= 0) itens[i] = it; else itens.push(it);
  const antes = diasDe(diario);
  guardar(diario, d, itens);
  // conferência: se o limite de dias cortou justamente este dia, desfaz e recusa (não há perda em silêncio)
  if (!itensDoDia(diario, d).some((x) => x.id === it.id)) { diario.dias = antes; return null; }
  return it;
}
export function apagarItem(diario, data, id) {
  if (!isObj(diario) || !dia(data)) return false;
  const itens = itensDoDia(diario, data);
  const resto = itens.filter((x) => x.id !== id);
  if (resto.length === itens.length) return false;
  guardar(diario, data, resto);
  return true;
}
// "Comi isso": copia uma refeição do cardápio de exemplo ({ nome, itens: [{ id, g }] }) para o diário do dia.
// O alimento que já está naquela refeição do diário não entra de novo (tocar duas vezes não duplica; o que a pessoa
// lançou à mão é respeitado). Devolve quantos alimentos entraram.
export function copiarRefeicao(diario, data, refeicao, hoje) {
  if (!isObj(refeicao) || !Array.isArray(refeicao.itens)) return 0;
  const ref = idDaRefeicao(refeicao.nome);
  let n = 0;
  for (const x of refeicao.itens) {
    if (!isObj(x) || itensDoDia(diario, data).some((y) => y.ref === ref && y.al === x.id)) continue;
    if (gravarItem(diario, data, { ref, al: x.id, g: x.g }, hoje)) n++;
  }
  return n;
}

// ---------- contas ----------
// Nutrientes de um item. Alimento do catálogo: valores da tabela pela quantidade. Fora da lista: só o que a pessoa
// digitou (carboidrato, gordura e fibra ficam desconhecidos: null).
export function nutrientesDoItem(item) {
  const it = limparItem(item);
  if (!it) return null;
  if (it.al) {
    const f = FOOD.get(it.al), k = it.g / 100;
    return { ...it, nome: f.nome, livre: false, kcal: f.kcal * k, p: f.p * k, c: f.c * k, gd: f.g * k, fibra: f.fibra * k, medida: medida(f, it.g) };
  }
  return { ...it, livre: true, c: null, gd: null, fibra: null, medida: '' };
}
// Totais de um dia: soma dos itens (o total é sempre a soma do que está na lista) e a lista por refeição.
// `semProteina` conta os itens fora da lista sem proteína informada; `livres`, todos os fora da lista (sem carboidrato,
// gordura e fibra): a tela avisa que esses totais ficam incompletos.
export function totaisDoDia(diario, data) {
  const out = { data: dia(data) || '', kcal: 0, p: 0, c: 0, gd: 0, fibra: 0, n: 0, livres: 0, semProteina: 0, refeicoes: [] };
  const porRef = new Map();
  for (const it of itensDoDia(diario, data)) {
    const x = nutrientesDoItem(it);
    out.n++; out.kcal += x.kcal; out.p += x.p || 0; out.c += x.c || 0; out.gd += x.gd || 0; out.fibra += x.fibra || 0;
    if (x.livre) { out.livres++; if (x.p == null) out.semProteina++; }
    if (!porRef.has(x.ref)) porRef.set(x.ref, { ref: x.ref, nome: REFEICOES[x.ref], kcal: 0, p: 0, itens: [] });
    const r = porRef.get(x.ref);
    r.kcal += x.kcal; r.p += x.p || 0; r.itens.push(x);
  }
  out.refeicoes = ORDEM.filter((k) => porRef.has(k)).map((k) => porRef.get(k));
  return out;
}

// Como o diário se comporta para cada pessoa (`res` = resultado de calcular(), ou null sem entrevista):
//   'sem'        não é oferecido (histórico de transtorno alimentar);
//   'alimentos'  só a lista do que comeu, sem calorias (menores de 18 anos);
//   'soma'       soma as calorias, sem comparar com meta (sem entrevista; gestação, doença renal e outros casos sem meta);
//   'meta'       soma e compara com a meta do dia.
// Com o estado (`st`), a idade e as condições vêm de TODAS as entrevistas — Treinador, Nutricionista, corrida e, para a
// idade, também a tela do sono (as mesmas fontes de logic/sono.js) —, e vale o modo mais protegido: a menor idade
// informada decide se é menor de 18; gestação, pós-parto ou doença renal marcados em qualquer entrevista tiram a meta.
// Transtorno alimentar só é perguntado pela Nutricionista: sem essa resposta, o adulto fica com a soma.
export function perfilDoDiario(st, res = null) {
  const s = isObj(st) ? st : {};
  const resp = (o) => (isObj(o) && isObj(o.answers) ? o.answers : {});
  const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const t = resp(s.trainer), n = resp(s.nutri), c = resp(s.run);
  const idades = [isObj(res) ? res.idade : null, t.idade, n.idade, c.idade, isObj(s.sono) ? s.sono.idade : null].map(numero).filter((v) => v != null && v >= 1 && v <= 130);
  const condicoes = new Set([...(isObj(res) ? lista(res.condicoes) : []), ...lista(t.condicoes), ...lista(n.condicoes), ...lista(c.condicoes)]);
  condicoes.delete('nenhuma');
  return { idade: idades.length ? Math.floor(Math.min(...idades)) : null, condicoes };
}
const SEM_META = ['gestante', 'posparto', 'renal'];
export function modoDoDiario(res, st = null) {
  const p = perfilDoDiario(st, res);
  if (p.condicoes.has('transtorno')) return 'sem';
  if (p.idade != null && p.idade < 18) return 'alimentos';
  if (!isObj(res) || res.modo === 'educativo' || !(numero(res.kcal) > 0) || SEM_META.some((k) => p.condicoes.has(k))) return 'soma';
  return 'meta';
}
const mil = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const r10 = (n) => Math.round(n / 10) * 10 || 0;   // sem zero negativo
// Comparação do dia com a meta. Com meta: quanto falta ou quanto passou, em calorias (arredondado a 10) e em proteína
// (a 1 g). As frases não julgam: "passou" é só a conta — e vem com o tamanho real da diferença, a 7.700 kcal por quilo
// (ref hall2008). Sem meta, `frase` diz só o total (ou nada, no modo 'alimentos').
// `st` (opcional) é o estado: com ele, o modo considera a idade e as condições das outras entrevistas.
export function compararComMeta(tot, res, st = null) {
  const modo = modoDoDiario(res, st);
  const t = { kcal: (isObj(tot) && numero(tot.kcal)) || 0, p: (isObj(tot) && numero(tot.p)) || 0, n: (isObj(tot) && numero(tot.n)) || 0 };
  const out = { modo, n: t.n, kcal: Math.round(t.kcal), prot: Math.round(t.p), metaKcal: null, metaProt: null, difKcal: null, difProt: null, estado: '', pct: null, frase: '', fraseProt: '', equivale: '' };
  if (modo === 'sem' || modo === 'alimentos') { out.kcal = null; out.prot = null; return out; }
  if (modo === 'soma') { out.frase = out.n ? `Total do dia: ${mil(out.kcal)} kcal e ${out.prot} g de proteína.` : ''; return out; }
  out.metaKcal = res.kcal; out.metaProt = res.prot;
  out.pct = Math.round((t.kcal / res.kcal) * 100);
  out.difKcal = r10(res.kcal - t.kcal);                    // positivo: falta; negativo: passou
  out.estado = out.difKcal > 0 ? 'falta' : out.difKcal < 0 ? 'passou' : 'chegou';
  out.frase = out.estado === 'falta' ? `Faltam ${mil(out.difKcal)} kcal para a meta do dia.` : out.estado === 'passou' ? `Você passou ${mil(-out.difKcal)} kcal da meta do dia.` : 'Você chegou à meta de calorias do dia.';
  // a diferença usa o valor já arredondado que a tela mostra ("124 / 125 g" → falta 1 g; "125 / 125 g" → atingida)
  out.difProt = Math.round(res.prot) - out.prot;
  out.fraseProt = out.difProt > 1 ? `Proteína: faltam ${out.difProt} g.` : out.difProt === 1 ? 'Proteína: falta 1 g.' : 'Proteína: meta do dia atingida.';
  // o tamanho real de passar da meta: 7.700 kcal equivalem a cerca de 1 kg
  if (out.estado === 'passou' && -out.difKcal >= 100) out.equivale = `Isso equivale a cerca de ${r10((-out.difKcal / 7700) * 1000)} g de peso.`;
  return out;
}
// Semana: os 7 dias que terminam em `hoje`. Média só dos dias com registro; `difMedia` = meta − média (com meta).
// Com o estado (`st`), cada dia é comparado com a meta DAQUELE dia (a meta muda com a semana do plano de corrida):
// `metaKcal` e `metaProt` são a média das metas dos dias registrados, e `metasIguais` diz se foram todas a mesma.
export function resumoDaSemana(diario, hoje, res, st = null) {
  const fim = dia(hoje) || hojeLocal();
  const modo = modoDoDiario(res, st);
  const dias = [];
  for (let i = 6; i >= 0; i--) { const data = somarDias(fim, -i); const t = totaisDoDia(diario, data); dias.push({ data, n: t.n, kcal: Math.round(t.kcal), p: Math.round(t.p) }); }
  const com = dias.filter((d) => d.n > 0);
  const media = (k) => (com.length ? Math.round(com.reduce((s, d) => s + d[k], 0) / com.length) : null);
  const out = { modo, dias, registrados: com.length, mediaKcal: media('kcal'), mediaProt: media('p'), metaKcal: null, metaProt: null, difMedia: null, metasIguais: true, frase: '' };
  if (modo === 'sem' || modo === 'alimentos') { out.mediaKcal = null; out.mediaProt = null; for (const d of dias) { d.kcal = null; d.p = null; } return out; }
  if (!com.length) return out;
  const quantos = com.length === 1 ? '1 dia registrado' : `${com.length} dias registrados`;
  if (modo === 'meta') {
    for (const d of com) {
      const m = isObj(st) && d.data !== fim ? metaDoDia(st, d.data) : res;
      const ok = isObj(m) && numero(m.kcal) > 0 && numero(m.prot) > 0 ? m : res;
      d.metaKcal = ok.kcal; d.metaProt = ok.prot;
    }
    out.metasIguais = com.every((d) => d.metaKcal === com[0].metaKcal && d.metaProt === com[0].metaProt);
    out.metaKcal = out.metasIguais ? com[0].metaKcal : r10(com.reduce((x, d) => x + d.metaKcal, 0) / com.length);
    out.metaProt = out.metasIguais ? com[0].metaProt : Math.round(com.reduce((x, d) => x + d.metaProt, 0) / com.length);
    out.difMedia = r10(out.metaKcal - out.mediaKcal);
    out.frase = `Média de ${mil(out.mediaKcal)} kcal e ${out.mediaProt} g de proteína em ${quantos} nos últimos 7 (${out.metasIguais ? 'meta' : 'média das metas desses dias'}: ${mil(out.metaKcal)} kcal e ${out.metaProt} g).`;
  } else out.frase = `Média de ${mil(out.mediaKcal)} kcal e ${out.mediaProt} g de proteína em ${quantos} nos últimos 7.`;
  return out;
}

// ---------- ligação com o estado (lido, nunca alterado) ----------
// Meta do dia: o resultado de calcular() com as respostas da Nutricionista e o plano de corrida NA SEMANA DA DATA
// pedida (a meta de um dia passado é a daquela semana do plano), ou null sem entrevista.
export function metaDoDia(st, hoje) {
  const a = isObj(st) && isObj(st.nutri) && isObj(st.nutri.answers) ? st.nutri.answers : null;
  if (!a || !respostasCompletas(a)) return null;
  let corrida = null;
  try { corrida = resumoParaNutricao(st, dia(hoje) || hojeLocal()); } catch { corrida = null; }
  // com o que as outras entrevistas dizem: vale a resposta mais protegida (logic/nutrition.js, contextoDasEntrevistas)
  return calcular(a, corrida, contextoDasEntrevistas(st));
}
// Números de hoje para o Início ("consumido / meta"): { modo, n, kcal, metaKcal, prot, metaProt, difKcal, estado, pct, frase, fraseProt }.
export function resumoDeHoje(st, hoje) {
  const data = dia(hoje) || hojeLocal();
  return compararComMeta(totaisDoDia(isObj(st) ? st.diario : null, data), metaDoDia(st, data), st);
}

// ---------- leitura do que a pessoa digita e busca no catálogo ----------
// Calorias: só número inteiro. "1200", "1.200" e "1 200" valem 1200 (ponto ou espaço de milhar); "1,5", "12.5", "1.20"
// e qualquer outra coisa são recusados (null) — nada de adivinhar. Vazio também é null.
export function lerCalorias(texto) {
  const t = typeof texto === 'string' ? texto.trim() : typeof texto === 'number' && Number.isInteger(texto) ? String(texto) : '';
  if (/^\d{1,5}$/.test(t)) return Number(t);
  if (/^\d{1,3}([. ]\d{3})+$/.test(t)) return Number(t.replace(/[. ]/g, ''));
  return null;
}
// Proteína em gramas: número com até uma casa, com vírgula ou ponto ("4", "4,5", "12.5"). O resto é recusado (null).
export function lerProteina(texto) {
  const t = typeof texto === 'string' ? texto.trim() : typeof texto === 'number' && Number.isFinite(texto) ? String(texto) : '';
  return /^\d{1,3}([.,]\d)?$/.test(t) ? Number(t.replace(',', '.')) : null;
}
// Busca de alimento pelo nome: sem acento, sem maiúsculas e sem pontuação (hífen, vírgula e parênteses valem espaço).
// Cada palavra digitada tem de ser o COMEÇO de uma palavra do nome ("coca" não acha "Paçoca"). Primeiro vêm os nomes
// que começam pelo termo, depois os demais, em ordem alfabética. Menos de 2 letras: lista vazia.
const simples = (v) => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const NOMES = ALIMENTOS.map((f) => ({ f, nome: simples(f.nome), palavras: simples(f.nome).split(' ') }));
export function buscarAlimentos(termo, max = 40) {
  const t = simples(typeof termo === 'string' ? termo.slice(0, 60) : '');
  if (t.length < 2) return [];
  const pedidas = t.split(' ');
  return NOMES.filter((x) => pedidas.every((p) => x.palavras.some((w) => w.startsWith(p))))
    .sort((a, b) => Number(b.nome.startsWith(t)) - Number(a.nome.startsWith(t)) || a.f.nome.localeCompare(b.f.nome, 'pt-BR'))
    .slice(0, max).map((x) => x.f);
}
// Uma linha com os limites do registro (a tela mostra junto dos totais).
export const AVISO_DO_REGISTRO = 'Use os números como guia, não como conta exata: quem anota o que come costuma registrar menos do que comeu (de 11% a 41% nos estudos), e as calorias dos alimentos são médias de tabela.';
export const REFS_DO_DIARIO = ['burrows2019', 'taco', 'hall2008', 'eikey2021', 'golden2016'];

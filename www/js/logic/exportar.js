// Exportar o histórico: planilhas CSV (uma por tipo de registro) e o resumo do período para imprimir ou salvar em PDF.
// Puro: sem DOM e sem importar o estado (recebe `st`, que é o state do aplicativo). A tela fica em views/exportar.js.
//
// Formato das planilhas, para abrir certo no Excel em português:
//   - UTF-8 com BOM (sem ele o Excel lê os acentos errado), separador ";" (o "," é a vírgula decimal), vírgula decimal,
//     data dd/mm/aaaa e linhas terminadas em CRLF (RFC 4180);
//   - cada campo vai entre aspas, com as aspas internas dobradas;
//   - injeção de fórmula (OWASP, "CSV Injection"): campo que começa com = + - @, tabulação, CR, LF ou a versão de largura
//     total de = + - @ recebe um apóstrofo na frente, para a planilha mostrar o texto em vez de executar uma fórmula.
//     Os números que o próprio app escreve nunca começam com esses sinais; o cuidado vale para o texto digitado.
import { EX_POR_ID } from '../data/exercises.js';
import { TIPOS_TREINO } from '../data/corrida.js';
import { LOCAIS_DOR, TIPOS_DOR, QUANDO_DOR } from './dor.js';
import { TIPOS_SAUDE, GRAUS_SAUDE, limparSaudeFora } from './saude-fora.js';
import { REFEICOES, nutrientesDoItem, modoDoDiario, supDoDia, textoDoSup, nutrientesDoSup } from './diario.js';
import { e1rm, assistido } from './progress.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const lista = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const p2 = (n) => String(n).padStart(2, '0');
const DIA_MS = 86400000;

// ---------- formatos ----------
export const hojeLocal = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
// 'AAAA-MM-DD' → 'dd/mm/aaaa'
export const dataBR = (k) => (typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) ? `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}` : '');
// dia e hora LOCAIS de uma data ISO (o treino das 22 h de São Paulo é do mesmo dia, não do seguinte em UTC)
const diaDe = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : hojeLocal(d); };
const horaDe = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
// número com vírgula decimal, sem separador de milhar (a planilha entende como número); null/NaN → vazio
export function numBR(v, casas = 2) {
  const n = num(v);
  if (n == null) return '';
  const f = 10 ** casas;
  return String(Math.round(n * f) / f || 0).replace('.', ',');
}
// segundos → 'h:mm:ss' (a planilha lê como duração); minutos de sono → 'h:mm'
export const hms = (seg) => { const s = Math.max(0, Math.round(num(seg) || 0)); return `${Math.floor(s / 3600)}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`; };
export const hm = (min) => { const m = Math.max(0, Math.round(num(min) || 0)); return `${Math.floor(m / 60)}:${p2(m % 60)}`; };

// ---------- CSV ----------
const PERIGOSO = /^[=+\-@\t\r\n＝＋－＠]/;
export function campoCsv(v) {
  let t = v == null ? '' : String(v);
  if (PERIGOSO.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}
// texto digitado pela pessoa: quebras de linha viram espaço (uma linha por registro na planilha)
const texto = (v) => (typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').trim() : '');
export const BOM = '﻿';
export const montarCsv = (cab, linhas) => BOM + [cab, ...linhas].map((l) => l.map(campoCsv).join(';')).join('\r\n') + '\r\n';

// ---------- as planilhas ----------
const sessoesFeitas = (st) => lista(st && st.sessions).filter((s) => isObj(s) && s.fim && Array.isArray(s.itens));
const nomeEx = (id) => (EX_POR_ID.get(id) || {}).nome || id;
const nomeCorrida = (tipo) => (TIPOS_TREINO[tipo] || TIPOS_TREINO.livre).nome;
const ladoTxt = (l) => (l === 'e' ? 'esquerdo' : l === 'd' ? 'direito' : l === 'dois' ? 'os dois' : '');
// registros com o mínimo para virar linha (o estado já vem validado por store.js; isto só evita linha vazia)
const corridaOk = (r) => isObj(r) && !!dataBR(r.data);
const pesoOk = (b) => isObj(b) && !!dataBR(b.data) && num(b.peso) != null;
const noiteOk = (r) => isObj(r) && !!dataBR(r.data) && num(r.horas) != null;
const cochiloOk = (c) => isObj(c) && !!dataBR(c.data) && num(c.min) != null;
const dorOk = (d) => isObj(d) && !!dataBR(d.data) && Object.prototype.hasOwnProperty.call(LOCAIS_DOR, d.onde);
const doresDaCorrida = (r) => lista(r.dores).map((d) => `${LOCAIS_DOR[d.onde] || d.onde} ${d.nivel}/10`).join(', ');
// o diário segue as mesmas proteções da tela (logic/diario.js): sem diário para quem marcou transtorno alimentar e,
// para menores de 18 anos, só os alimentos, sem calorias
const modoDiario = (st) => modoDoDiario(null, st);
const comCalorias = (st) => !['sem', 'alimentos'].includes(modoDiario(st));

function musculacao(st) {
  const linhas = [];
  for (const s of sessoesFeitas(st)) {
    for (const it of s.itens) {
      if (!isObj(it)) continue;
      lista(it.sets).forEach((x, j) => {
        if (!isObj(x) || !x.ok) return;
        linhas.push([dataBR(diaDe(s.inicio)), horaDe(s.inicio), texto(s.nome), nomeEx(it.ex), j + 1, numBR(x.kg), x.reps == null ? '' : numBR(x.reps, 0), x.seg == null ? '' : numBR(x.seg, 0)]);
      });
    }
  }
  return { cab: ['Data', 'Hora', 'Treino', 'Exercício', 'Série', 'Carga (kg)', 'Repetições', 'Tempo (s)'], linhas };
}
function corridas(st) {
  const linhas = lista(st && st.runs).filter(corridaOk).map((r) => {
    const seg = (num(r.durMin) || 0) * 60;
    const ritmo = r.distKm > 0 && seg > 0 ? hms(seg / r.distKm) : '';
    return [dataBR(r.data), nomeCorrida(r.tipo), r.distKm ? numBR(r.distKm) : '', seg ? hms(seg) : '', ritmo, r.pse == null ? '' : r.pse, doresDaCorrida(r), texto(r.nota)];
  });
  return { cab: ['Data', 'Tipo', 'Distância (km)', 'Duração (h:mm:ss)', 'Ritmo (h:mm:ss por km)', 'Esforço (1 a 10)', 'Dores', 'Anotação'], linhas };
}
function peso(st) {
  const linhas = lista(st && st.body).filter(pesoOk).map((b) => [dataBR(b.data), numBR(b.peso, 1), b.cintura == null ? '' : numBR(b.cintura, 1)]);
  return { cab: ['Data', 'Peso (kg)', 'Cintura (cm)'], linhas };
}
function sono(st) {
  const s = isObj(st && st.sono) ? st.sono : {};
  const noites = lista(s.registros).filter(noiteOk).map((r) => [r.data, 0, [dataBR(r.data), 'Noite', hm(r.horas * 60), r.dormiu || '', r.acordou || '', r.qualidade || '']]);
  const cochilos = lista(s.cochilos).filter(cochiloOk).map((c) => [c.data, 1, [dataBR(c.data), 'Cochilo', hm(c.min), c.inicio || '', '', '']]);
  const linhas = [...noites, ...cochilos].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1])).map((x) => x[2]);
  return { cab: ['Data', 'Tipo', 'Tempo dormido (h:mm)', 'Dormiu (ou início do cochilo)', 'Acordou', 'Como acordou (1 a 5)'], linhas };
}
function diario(st) {
  const cal = comCalorias(st);
  const linhas = [];
  const ordem = Object.keys(REFEICOES);
  for (const d of lista(st && st.diario && st.diario.dias)) {
    if (!isObj(d)) continue;
    const itens = lista(d.itens).map(nutrientesDoItem).filter(Boolean).sort((a, b) => ordem.indexOf(a.ref) - ordem.indexOf(b.ref));
    for (const x of itens) {
      const base = [dataBR(d.data), REFEICOES[x.ref], texto(x.nome), x.livre ? '' : x.g, x.livre ? '' : texto(x.medida)];
      linhas.push(cal ? [...base, numBR(x.kcal, 0), x.p == null ? '' : numBR(x.p, 1)] : base);
    }
    // suplementos e vitaminas do dia: nome e dose como a pessoa marcou; números só do whey com o valor do rótulo
    for (const sp of supDoDia(st.diario, d.data)) {
      const t = textoDoSup(sp, false), n = nutrientesDoSup(sp);
      const base = [dataBR(d.data), 'Suplemento ou vitamina', texto(t.nome), '', texto(t.dose)];
      linhas.push(cal ? [...base, sp.kcalDose == null ? '' : numBR(n.kcal, 0), sp.pDose == null ? '' : numBR(n.p, 1)] : base);
    }
  }
  const cab = ['Data', 'Refeição', 'Alimento', 'Quantidade (g)', 'Medida caseira'];
  return { cab: cal ? [...cab, 'Calorias (kcal)', 'Proteína (g)'] : cab, linhas };
}
function dores(st) {
  const linhas = lista(st && st.dores).filter(dorOk).map((d) => [dataBR(d.data), LOCAIS_DOR[d.onde] || d.onde, ladoTxt(d.lado), (TIPOS_DOR[d.tipo] || [''])[0], QUANDO_DOR[d.quando] || '', d.nivel, d.fim ? dataBR(d.fim) : '', texto(d.nota)]);
  return { cab: ['Data', 'Local', 'Lado', 'Tipo', 'Quando aparece', 'Nível (1 a 10)', 'Melhorou em', 'Anotação'], linhas };
}
// problemas de saúde que não vêm do treino (febre, pancada, corte...: logic/saude-fora.js)
const nomeSaude = (p) => (TIPOS_SAUDE[p.tipo] || { nome: p.tipo }).nome;
function saude(st) {
  const linhas = limparSaudeFora(st && st.saudeFora).map((p) => [dataBR(p.data), texto(nomeSaude(p)), p.onde ? LOCAIS_DOR[p.onde] || p.onde : '', p.grau ? GRAUS_SAUDE[p.grau][0] : '', p.avaliado ? dataBR(p.avaliado) : '', p.fim ? dataBR(p.fim) : '']);
  return { cab: ['Data', 'Problema', 'Local', 'Intensidade', 'Avaliado em', 'Melhorou em'], linhas };
}

// Tipos de planilha, na ordem da tela: [id, nome, função]. `contagem` diz quantos registros cada uma tem.
const PLANILHAS = [
  ['musculacao', 'Musculação (séries)', musculacao],
  ['corridas', 'Corridas', corridas],
  ['peso', 'Peso e cintura', peso],
  ['sono', 'Sono e cochilos', sono],
  ['diario', 'Diário alimentar', diario],
  ['dores', 'Dores', dores],
  ['saude', 'Problemas de saúde fora do treino', saude],
];
export const TIPOS_PLANILHA = PLANILHAS.map(([id, nome]) => [id, nome]);
// Planilhas que esta pessoa pode baixar, com o número de linhas de cada uma. O diário não aparece para quem marcou
// transtorno alimentar (a tela do diário também não aparece para essa pessoa).
export function planilhasDisponiveis(st) {
  return PLANILHAS.filter(([id]) => id !== 'diario' || modoDiario(st) !== 'sem').map(([id, nome, fn]) => ({ id, nome, linhas: fn(st).linhas.length }));
}
// { nome do arquivo, texto } de uma planilha, ou null se o tipo não existe ou não está disponível.
export function planilha(st, id, hoje = hojeLocal()) {
  const t = PLANILHAS.find((x) => x[0] === id);
  if (!t || (id === 'diario' && modoDiario(st) === 'sem')) return null;
  const { cab, linhas } = t[2](st);
  return { nome: `fitcore-${id}-${hoje}.csv`, texto: montarCsv(cab, linhas), linhas: linhas.length };
}

// ---------- resumo do período ----------
export const PERIODOS = [[30, '30 dias'], [90, '3 meses'], [365, '12 meses'], [0, 'Tudo']];
const somaDias = (k, n) => { const t = new Date(k + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DIA_MS);
const r1 = (n) => Math.round(n * 10) / 10;
const media = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
// Melhor série de um exercício num treino: a de maior 1RM estimado (logic/progress.js). Nos aparelhos assistidos
// (graviton) o peso é de AJUDA: a melhor série é a com menos ajuda (e, empatando, mais repetições).
function melhorSerie(it) {
  const ajuda = assistido(it.ex);
  let m = null;
  for (const x of lista(it && it.sets)) {
    if (!isObj(x) || !x.ok) continue;
    const kg = num(x.kg) || 0, reps = num(x.reps) || 0;
    if (!(kg > 0 && reps > 0)) continue;
    const v = ajuda ? -kg * 1000 + reps : e1rm(kg, reps);
    if (!m || v > m.v) m = { v, kg, reps };
  }
  return m;
}

// Resumo de `dias` dias até `hoje` (dias = 0: desde o primeiro registro). Tudo o que a tela de impressão mostra.
export function montarResumo(st, { dias = 90, hoje = hojeLocal() } = {}) {
  const sess = sessoesFeitas(st).map((s) => ({ s, dia: diaDe(s.inicio) })).filter((x) => x.dia && x.dia <= hoje);
  const runs = lista(st && st.runs).filter((r) => corridaOk(r) && r.data <= hoje);
  const body = lista(st && st.body).filter((b) => pesoOk(b) && b.data <= hoje);
  const sonoSt = isObj(st && st.sono) ? st.sono : {};
  const noites = lista(sonoSt.registros).filter((r) => noiteOk(r) && r.data <= hoje);
  const cochilos = lista(sonoSt.cochilos).filter((c) => cochiloOk(c) && c.data <= hoje);
  const diasDiario = lista(st && st.diario && st.diario.dias).filter((d) => isObj(d) && !!dataBR(d.data) && d.data <= hoje && lista(d.itens).length);
  const doresSt = lista(st && st.dores).filter((d) => dorOk(d) && d.data <= hoje);
  let de;
  if (dias > 0) de = somaDias(hoje, -(dias - 1));
  else {
    const todas = [...sess.map((x) => x.dia), ...runs.map((r) => r.data), ...body.map((b) => b.data), ...noites.map((r) => r.data), ...cochilos.map((c) => c.data), ...diasDiario.map((d) => d.data), ...doresSt.map((d) => d.data), ...limparSaudeFora(st && st.saudeFora).filter((p) => p.data <= hoje).map((p) => p.data)].filter(Boolean).sort();
    de = todas[0] || hoje;
  }
  const dentro = (k) => k >= de && k <= hoje;
  const semanas = Math.max(1, (diasEntre(de, hoje) + 1) / 7);

  // musculação: frequência e a evolução da carga dos exercícios mais feitos (primeiro e último treino do período)
  const ss = sess.filter((x) => dentro(x.dia)).sort((a, b) => Date.parse(a.s.inicio) - Date.parse(b.s.inicio));
  const porEx = new Map();
  let series = 0;
  for (const { s, dia } of ss) {
    for (const it of s.itens) {
      if (!isObj(it)) continue;
      series += lista(it.sets).filter((x) => isObj(x) && x.ok).length;
      const m = melhorSerie(it);
      if (!m) continue;
      if (!porEx.has(it.ex)) porEx.set(it.ex, []);
      porEx.get(it.ex).push({ dia, kg: m.kg, reps: m.reps });
    }
  }
  const principais = [...porEx.entries()].filter(([, l]) => l.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || nomeEx(a[0]).localeCompare(nomeEx(b[0]), 'pt-BR')).slice(0, 8)
    .map(([ex, l]) => ({ ex, nome: nomeEx(ex), assistido: assistido(ex), vezes: l.length, inicio: l[0], fim: l[l.length - 1], difKg: r1(l[l.length - 1].kg - l[0].kg) }));
  const musc = { treinos: ss.length, porSemana: r1(ss.length / semanas), series, principais };

  // corrida
  const rr = runs.filter((r) => dentro(r.data));
  const comRitmo = rr.filter((r) => r.distKm > 0 && r.durMin > 0);
  const kmR = comRitmo.reduce((a, r) => a + r.distKm, 0), segR = comRitmo.reduce((a, r) => a + r.durMin * 60, 0);
  const pses = rr.map((r) => num(r.pse)).filter((v) => v != null);
  const corrida = {
    n: rr.length, porSemana: r1(rr.length / semanas), km: r1(rr.reduce((a, r) => a + (num(r.distKm) || 0), 0)),
    seg: Math.round(rr.reduce((a, r) => a + (num(r.durMin) || 0) * 60, 0)), maiorKm: rr.reduce((a, r) => Math.max(a, num(r.distKm) || 0), 0),
    ritmoSeg: kmR > 0 ? Math.round(segR / kmR) : null, pse: pses.length ? r1(media(pses)) : null, comDor: rr.filter((r) => lista(r.dores).length).length,
  };

  // peso e cintura: primeiro e último registro do período
  const bb = body.filter((b) => dentro(b.data));
  const cint = bb.filter((b) => num(b.cintura) != null);
  const pesoR = { n: bb.length, inicio: bb[0] || null, fim: bb[bb.length - 1] || null, dif: bb.length >= 2 ? r1(bb[bb.length - 1].peso - bb[0].peso) : null,
    cinturaInicio: cint[0] ? cint[0].cintura : null, cinturaFim: cint.length ? cint[cint.length - 1].cintura : null };

  // sono
  const nn = noites.filter((r) => dentro(r.data));
  const qs = nn.map((r) => num(r.qualidade)).filter((v) => v != null);
  const cc = cochilos.filter((c) => dentro(c.data));
  const sonoR = { noites: nn.length, mediaMin: nn.length ? Math.round(media(nn.map((r) => r.horas * 60))) : null, menos7: nn.filter((r) => r.horas < 7).length,
    qualidade: qs.length ? r1(media(qs)) : null, cochilos: cc.length, cochiloMedioMin: cc.length ? Math.round(media(cc.map((c) => c.min))) : null };

  // diário alimentar (mesmas proteções das planilhas)
  const modo = modoDiario(st);
  const dd = diasDiario.filter((d) => dentro(d.data));
  let kcal = null, prot = null;
  if (comCalorias(st) && dd.length) {
    const tot = dd.map((d) => lista(d.itens).map(nutrientesDoItem).filter(Boolean).reduce((a, x) => ({ k: a.k + x.kcal, p: a.p + (x.p || 0) }), { k: 0, p: 0 }));
    kcal = Math.round(media(tot.map((t) => t.k))); prot = Math.round(media(tot.map((t) => t.p)));
  }
  const diarioR = modo === 'sem' ? null : { dias: dd.length, kcal, prot, semCalorias: !comCalorias(st) };

  // dores contadas no período
  const doresR = doresSt.filter((d) => dentro(d.data)).map((d) => ({ data: d.data, local: LOCAIS_DOR[d.onde] + (ladoTxt(d.lado) ? `, ${ladoTxt(d.lado)}` : ''), tipo: (TIPOS_DOR[d.tipo] || [''])[0], quando: QUANDO_DOR[d.quando] || '', nivel: d.nivel, fim: d.fim || '' }));

  // problemas de saúde fora do treino no período
  const saudeR = limparSaudeFora(st && st.saudeFora).filter((p) => p.data <= hoje && dentro(p.data)).map((p) => ({ data: p.data, nome: nomeSaude(p), local: p.onde ? LOCAIS_DOR[p.onde] || p.onde : '', grau: p.grau ? GRAUS_SAUDE[p.grau][0].toLowerCase() : '', fim: p.fim || '' }));
  return { de, ate: hoje, dias: diasEntre(de, hoje) + 1, musc, corrida, peso: pesoR, sono: sonoR, diario: diarioR, dores: doresR, saude: saudeR };
}

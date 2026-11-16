// Análise do desempenho do usuário e dicas para evoluir.
// Lê só o que o próprio usuário registrou (treinos e peso) e aplica regras fixas, cada uma apoiada
// em uma referência da base de conhecimento (data/knowledge.js). Não usa internet nem IA generativa.
import { EX_POR_ID } from '../data/exercises.js';
import { GRUPOS, MUSCULOS } from '../data/muscles.js';
import { pesosDoExercicio } from './trainer.js';
import { nivelPausa, duracaoTxt } from './pausa.js';

const DIA = 86400000;
const SEMANA = 7 * DIA;
const ASSISTIDOS = new Set(['barra-fixa-assistida-graviton', 'mergulho-assistido-graviton']);
const pos = (n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
const e1rm = (kg, reps) => (pos(kg) && pos(reps) ? kg * (1 + Math.min(reps, 15) / 30) : 0);
const diaDe = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const num1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const media = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const nome = (id) => (EX_POR_ID.get(id) || {}).nome || id;
const curto = (s, max) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s);
const minusc = (g) => (GRUPOS[g] || g).toLowerCase();
const lista = (x) => (Array.isArray(x) ? x : []);
const feitas = (it) => lista(it && it.sets).filter((x) => x && x.ok);

// grupos que entram na conta de séries por semana
export const GRUPOS_VOLUME = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'abdomen'];
const GRUPOS_PRINCIPAIS = ['peito', 'costas', 'ombros', 'quadriceps', 'posteriores', 'gluteos'];
// faixa de séries semanais por grupo muscular (Schoenfeld 2017; Baz-Valle 2022)
export const SERIES_MIN = 4;
export const SERIES_BOM = 10;
export const SERIES_TETO = 20;

// Treinos com data válida e que não estão no futuro, do mais antigo para o mais novo (o histórico pode chegar fora de ordem).
function treinos(st, agora) {
  const out = [];
  let ordenado = true, ant = -Infinity;
  for (const s of lista(st && st.sessions)) {
    const t = s ? Date.parse(s.inicio) : NaN;
    if (!Number.isFinite(t) || t > agora) continue;
    if (t < ant) ordenado = false;
    ant = t;
    out.push({ t, s, itens: lista(s.itens) });
  }
  if (!ordenado) out.sort((a, b) => a.t - b.t);
  return out;
}
const respostas = (st, k) => (st && st[k] && st[k].answers && typeof st[k].answers === 'object' ? st[k].answers : {});
const planoAtivo = (st) => lista(st && st.plans).find((x) => x && x.id === st.activePlan) || null;
// semanas de uso dentro de uma janela (no mínimo 1): quem começou há poucos dias não tem a média diluída
const semanasDeUso = (ss, agora, desde) => (ss.length ? Math.max(1, (agora - Math.max(desde, ss[0].t)) / SEMANA) : 1);

export function metaSemanal(st) {
  const p = planoAtivo(st);
  const agendados = p && p.agenda && typeof p.agenda === 'object' ? Object.keys(p.agenda).length : 0;
  const dias = Number(respostas(st, 'trainer').dias) || 0;
  return Math.max(1, agendados || dias || 3);
}

// ---------- medidas ----------
// treinos feitos e previstos nas últimas semanas (até 4). A semana que acabou de começar conta só pela parte já vivida.
export function constancia(st, agora) { return constanciaDe(treinos(st, agora), st, agora); }
function constanciaDe(ss, st, agora) {
  if (!ss.length) return null;
  const semanas = Math.max(1, Math.min(4, (agora - ss[0].t) / SEMANA));
  const desde = agora - semanas * SEMANA;
  const dias = new Set();
  for (const x of ss) if (x.t >= desde) dias.add(diaDe(x.t));
  const meta = metaSemanal(st);
  const previstos = Math.max(1, Math.round(meta * semanas));
  return { semanas: Math.max(1, Math.round(semanas)), feitos: dias.size, previstos, meta, taxa: Math.min(1.5, dias.size / previstos), diasParado: Math.max(0, Math.floor((agora - ss[ss.length - 1].t) / DIA)) };
}

// Volta recente depois de uma pausa: o último intervalo de 2 semanas ou mais entre dois treinos, quando a volta foi há
// até 4 semanas. `dias` = tempo parado antes de voltar; `ha` = dias desde a volta; `treinos` = treinos feitos desde então.
export function retomadaRecente(st, agora) { return retomadaDe(treinos(st, agora), agora); }
function retomadaDe(ss, agora) {
  for (let i = ss.length - 1; i >= 1; i--) {
    if (agora - ss[i].t > 28 * DIA) break;
    const dias = Math.floor((ss[i].t - ss[i - 1].t) / DIA);
    if (dias >= 14) return { dias, faixa: nivelPausa(dias), ha: Math.max(0, Math.floor((agora - ss[i].t) / DIA)), treinos: ss.length - i };
  }
  return null;
}
// o que fazer na volta, por faixa de tempo parado (regras em logic/pausa.js)
const VOLTA = [
  'Volte com um pouco menos de carga e retome o ritmo aos poucos.',
  'Na volta, o treino começa com menos séries, mais descanso e cerca de 10% menos carga por duas semanas.',
  'Na volta, o treino começa com menos séries, mais descanso e cerca de 20% menos carga por duas semanas.',
  'Na volta, o treino começa com menos séries, mais descanso e cerca de 30% menos carga; o cardio volta em 4 semanas.',
  'Recomece com metade da carga, ou menos, e peça um plano novo ao Treinador.',
];
const JA_VOLTOU = [
  '',
  'Nestas duas semanas o treino já começa com menos séries, mais descanso e cerca de 10% menos carga.',
  'Nestas duas semanas o treino já começa com menos séries, mais descanso e cerca de 20% menos carga.',
  'O treino já começa com menos séries, mais descanso e cerca de 30% menos carga; o cardio volta em 4 semanas.',
  'Recomece com metade da carga, ou menos, e suba aos poucos. Vale pedir um plano novo ao Treinador.',
];
const PORQUE_PAUSA = 'Pausas curtas tiram pouca força; as longas tiram mais. Depois de 2 semanas ou mais parado, o consenso CSCCa/NSCA pede 2 a 4 semanas com menos volume e mais descanso.';
const REFS_PAUSA = ['caterisano2019'];

// Séries concluídas por semana, por grupo muscular: músculo principal conta 1; auxiliar conta meia; quem só estabiliza
// não conta (a mesma conta do Treinador). `diretas` soma só as séries em que o grupo é o principal.
export function seriesPorGrupo(st, agora, dias = 14) { return seriesDe(treinos(st, agora), agora, dias); }
function seriesDe(ss, agora, dias = 14) {
  const out = {}, dir = {};
  for (const g of GRUPOS_VOLUME) { out[g] = 0; dir[g] = 0; }
  if (!ss.length) return { porGrupo: out, diretas: dir, treinos: 0 };
  const desde = agora - dias * DIA;
  const semanas = semanasDeUso(ss, agora, desde);
  let n = 0;
  for (const x of ss) {
    if (x.t < desde) continue;
    n++;
    for (const it of x.itens) {
      const k = feitas(it).length;
      if (!k) continue;
      const w = pesosDoExercicio(EX_POR_ID.get(it.ex));
      for (const g in w) if (g in out) { out[g] += k * w[g]; if (w[g] === 1) dir[g] += k; }
    }
  }
  for (const g of GRUPOS_VOLUME) { out[g] = Math.round((out[g] / semanas) * 2) / 2; dir[g] = Math.round((dir[g] / semanas) * 2) / 2; }
  return { porGrupo: out, diretas: dir, treinos: n };
}

const melhorMarca = (it) => Math.max(0, ...feitas(it).map((x) => e1rm(x.kg, x.reps)));

// evolução da força estimada de cada exercício com carga, nos últimos treinos
export function tendencias(st, agora, dias = 70) { return tendenciasDe(treinos(st, agora), agora, dias); }
function tendenciasDe(ss, agora, dias = 70) {
  const desde = agora - dias * DIA;
  const porEx = new Map();
  for (const x of ss) {
    if (x.t < desde) continue;
    for (const it of x.itens) {
      const ex = EX_POR_ID.get(it && it.ex);
      if (!ex || ex.registro !== 'peso_reps' || ASSISTIDOS.has(it.ex)) continue;
      const best = melhorMarca(it);
      if (best <= 0) continue;
      if (!porEx.has(it.ex)) porEx.set(it.ex, []);
      porEx.get(it.ex).push(best);
    }
  }
  const out = [];
  for (const [id, todos] of porEx) {
    if (todos.length < 3) continue;
    const v = todos.slice(-6);
    const n = v.length;
    const ini = n >= 4 ? media(v.slice(0, 2)) : v[0];
    const fim = n >= 4 ? media(v.slice(-2)) : v[n - 1];
    const variacao = fim / ini - 1;
    const semMarcaNova = n >= 4 && Math.max(...v.slice(-3)) <= Math.max(...v.slice(0, n - 3)) * 1.005;
    const status = variacao >= 0.02 ? 'subindo' : variacao <= -0.04 ? 'caindo' : semMarcaNova ? 'parado' : 'estavel';
    out.push({ id, nome: nome(id), treinos: n, variacao, status, forca: Math.round(fim) });
  }
  const ordem = { caindo: 0, parado: 1, subindo: 2, estavel: 3 };
  return out.sort((a, b) => ordem[a.status] - ordem[b.status] || Math.abs(b.variacao) - Math.abs(a.variacao));
}

// melhores marcas batidas nos últimos dias
export function recordesRecentes(st, agora, dias = 14) { return recordesDe(treinos(st, agora), agora, dias); }
function recordesDe(ss, agora, dias = 14) {
  const desde = agora - dias * DIA;
  const antes = new Map(), depois = new Map(), vezes = new Map();
  for (const x of ss) {
    for (const it of x.itens) {
      const ex = EX_POR_ID.get(it && it.ex);
      if (!ex || ex.registro !== 'peso_reps' || ASSISTIDOS.has(it.ex)) continue;
      const best = melhorMarca(it);
      if (best <= 0) continue;
      const mapa = x.t >= desde ? depois : antes;
      mapa.set(it.ex, Math.max(mapa.get(it.ex) || 0, best));
      if (x.t < desde) vezes.set(it.ex, (vezes.get(it.ex) || 0) + 1);
    }
  }
  const out = [];
  for (const [id, v] of depois) if ((vezes.get(id) || 0) >= 2 && v > antes.get(id) * 1.001) out.push({ id, nome: nome(id) });
  return out;
}

// Parte das séries planejadas que foi concluída nos últimos treinos. O histórico guarda as séries marcadas;
// quando o treino grava quantas estavam planejadas (campo `planejadas` do item), a conta usa esse número.
export function seriesConcluidas(st, n = 4) { return concluidasDe(treinos(st, Infinity), n); }
function concluidasDe(ss, n = 4) {
  let tot = 0, ok = 0;
  for (const x of ss.slice(-n)) for (const it of x.itens) {
    const k = feitas(it).length;
    const plan = it && Number.isFinite(it.planejadas) && it.planejadas > 0 ? Math.max(it.planejadas, k) : lista(it && it.sets).length;
    tot += plan; ok += k;
  }
  return tot >= 8 ? ok / tot : null;
}

export function duracaoMedia(st, n = 4) { return duracaoDe(treinos(st, Infinity), n); }
function duracaoDe(ss, n = 4) {
  const d = ss.slice(-n).map((x) => (Date.parse(x.s.fim) - x.t) / 60000).filter((m) => m >= 5 && m <= 240);
  return d.length >= 2 ? Math.round(media(d)) : null;
}

// Músculo treinado como principal em dias seguidos. A conta é por músculo, não por grupo: a parte de trás do ombro
// (crucifixo inverso, num treino de puxar) e a da frente (desenvolvimento, num treino de empurrar) são músculos diferentes,
// e treinar um depois do outro não tira o descanso de nenhum dos dois. O aviso mostra o nome do grupo.
export function semDescanso(st, agora, dias = 21) { return semDescansoDe(treinos(st, agora), agora, dias); }
function semDescansoDe(ss, agora, dias = 21) {
  const desde = agora - dias * DIA;
  const porDia = new Map();
  for (const x of ss) {
    if (x.t < desde) continue;
    const k = diaDe(x.t);
    if (!porDia.has(k)) porDia.set(k, {});
    const g0 = porDia.get(k);
    for (const it of x.itens) {
      const n = feitas(it).length;
      if (!n) continue;
      const ex = EX_POR_ID.get(it.ex);
      const w = pesosDoExercicio(ex);
      for (const m of new Set(ex ? ex.primarios : [])) { const g = MUSCULOS[m] ? MUSCULOS[m].grupo : ''; if (w[g] === 1 && GRUPOS_PRINCIPAIS.includes(g)) g0[m] = (g0[m] || 0) + n; }
    }
  }
  const chaves = [...porDia.keys()].sort((a, b) => a - b);
  const cont = {};
  for (let i = 0; i + 1 < chaves.length; i++) {
    if (chaves[i + 1] - chaves[i] >= 1.5 * DIA) continue;
    const g0 = porDia.get(chaves[i]), g1 = porDia.get(chaves[i + 1]);
    for (const g of Object.keys(g0)) if (g0[g] >= 3 && (g1[g] || 0) >= 3) cont[g] = (cont[g] || 0) + 1;
  }
  const top = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 2 ? { grupo: MUSCULOS[top[0]].grupo, vezes: top[1] } : null;
}

// tendência do peso corporal (kg por semana), por regressão linear dos registros recentes
export function tendenciaPeso(st, agora, dias = 42) {
  const desde = agora - dias * DIA;
  const todos = lista(st && st.body)
    .map((b) => ({ t: b ? Date.parse(b.data + 'T12:00:00') : NaN, p: b ? b.peso : NaN }))
    .filter((x) => Number.isFinite(x.t) && pos(x.p) && x.t <= agora + DIA)
    .sort((a, b) => a.t - b.t);
  const diasSemRegistro = todos.length ? Math.max(0, Math.floor((agora - todos[todos.length - 1].t) / DIA)) : null;
  const pts = todos.filter((x) => x.t >= desde);
  if (pts.length < 2) return { diasSemRegistro, kgSemana: null };
  const span = (pts[pts.length - 1].t - pts[0].t) / DIA;
  if (span < 13) return { diasSemRegistro, kgSemana: null };
  const mx = media(pts.map((x) => x.t)), my = media(pts.map((x) => x.p));
  let sxy = 0, sxx = 0;
  for (const x of pts) { sxy += (x.t - mx) * (x.p - my); sxx += (x.t - mx) ** 2; }
  const kgSemana = sxx > 0 ? (sxy / sxx) * SEMANA : 0;
  return { diasSemRegistro, kgSemana, pctSemana: (kgSemana / my) * 100, semanas: Math.round(span / 7), peso: my };
}

// minutos de aeróbico registrados por semana (pelas semanas de uso dentro da janela, no mínimo 1)
export function cardioPorSemana(st, agora, dias = 14) { return cardioDe(treinos(st, agora), agora, dias); }
function cardioDe(ss, agora, dias = 14) {
  const desde = agora - dias * DIA;
  let min = 0;
  for (const x of ss) {
    if (x.t < desde) continue;
    for (const it of x.itens) { const ex = EX_POR_ID.get(it && it.ex); if (ex && ex.registro === 'minutos') min += feitas(it).reduce((a, s) => a + pos(s.seg), 0); }
  }
  return Math.round(min / Math.min(dias / 7, semanasDeUso(ss, agora, desde)));
}

// Exercícios do plano que bateram o topo das repetições em todas as séries. A carga sobe depois de DOIS treinos
// seguidos no topo (adaptação da regra "2 por 2" do ACSM 2009 — ref acsm2009, a mesma da sugestão de carga do treino):
// `treinos` = 2 quando os dois últimos treinos do exercício foram no topo; 1 quando só o último.
export function prontosParaSubir(st) { return prontosDe(treinos(st, Infinity), st); }
function prontosDe(ss, st) {
  const p = planoAtivo(st);
  if (!p) return [];
  const out = [];
  const vistos = new Set();
  for (const d of lista(p.dias)) for (const item of lista(d && d.itens)) {
    const ex = EX_POR_ID.get(item && item.ex);
    if (!ex || ex.registro !== 'peso_reps' || ASSISTIDOS.has(item.ex) || vistos.has(item.ex)) continue;
    vistos.add(item.ex);
    const hi = Number(String(item.reps).split('-').pop()) || 0;
    if (hi <= 0) continue;
    const ult = [];
    for (let i = ss.length - 1; i >= 0 && ult.length < 2; i--) {
      const it = ss[i].itens.find((x) => x && x.ex === item.ex);
      const sets = it ? feitas(it) : [];
      if (sets.length) ult.push(sets);
    }
    if (!ult.length) continue;
    const kg = Math.max(...ult[0].map((x) => pos(x.kg)));
    const topo = (sets) => kg > 0 && sets.length >= Math.min(Number(item.series) || 2, 2) && sets.every((x) => pos(x.reps) >= hi && pos(x.kg) >= kg);
    if (!topo(ult[0])) continue;
    out.push({ id: item.ex, nome: ex.nome, reps: hi, treinos: ult[1] && topo(ult[1]) ? 2 : 1 });
  }
  return out;
}

// ---------- dicas ----------
// tom: 'atencao' (corrigir), 'ideia' (pode melhorar), 'bom' (está funcionando)
const PESO_TOM = { atencao: 0, ideia: 1, bom: 2 };

export function analisar(st, agora = Date.now()) {
  const dicas = [];
  const add = (d) => dicas.push(d);
  if (!Number.isFinite(agora)) agora = Date.now();
  const ss = treinos(st, agora);
  const nSess = ss.length;
  const c = constanciaDe(ss, st, agora);
  const vol = seriesDe(ss, agora);
  const tend = tendenciasDe(ss, agora);
  const caindoIds = new Set(tend.filter((x) => x.status === 'caindo').map((x) => x.id));
  const paradosIds = new Set(tend.filter((x) => x.status === 'parado').map((x) => x.id));
  // um exercício em queda ou travado não aparece ao mesmo tempo como recorde
  const recs = recordesDe(ss, agora).filter((x) => !caindoIds.has(x.id) && !paradosIds.has(x.id));
  // tempo sem treinar antes de voltar: entra na análise da constância, da força e da carga
  const ret = retomadaDe(ss, agora);
  const resumo = { treinos: nSess, constancia: c, series: vol.porGrupo, tendencias: tend, recordes: recs, retomada: ret };

  if (nSess < 3) {
    add({ id: 'inicio', tom: 'ideia', icone: 'chart', p: 0, titulo: nSess ? `Faltam ${3 - nSess} ${3 - nSess === 1 ? 'treino' : 'treinos'} para a análise` : 'Registre os seus treinos', texto: 'Com 3 treinos concluídos, o FitCore mostra onde você está evoluindo e o que ajustar.' });
    return { suficiente: false, dicas, resumo };
  }

  const objetivo = respostas(st, 'trainer').objetivo || '';
  const experiente = ['intermediario', 'avancado'].includes(respostas(st, 'trainer').experiencia);
  const sem = (n) => (n === 1 ? 'na última semana' : `nas últimas ${n} semanas`);

  // constância (depois de uma volta recente, a frequência conta só a partir do dia em que a pessoa voltou a treinar)
  const cf = ret ? constanciaDe(ss.slice(ss.length - ret.treinos), st, agora) : c;
  if (c.diasParado >= 10) {
    const fx = nivelPausa(c.diasParado);
    add({ id: 'parado', tom: 'atencao', icone: 'calendar', p: 0, titulo: `${c.diasParado < 60 ? c.diasParado + ' dias' : duracaoTxt(c.diasParado)} sem treinar`, texto: VOLTA[fx], porque: PORQUE_PAUSA, refs: REFS_PAUSA, ...(fx >= 4 ? { acao: { rotulo: 'Abrir o Treinador', rota: 'treinador' } } : {}) });
  } else if (ret && ret.ha <= 14) {
    // voltou há até 2 semanas: a frequência baixa das últimas semanas é a própria pausa; o que importa agora é a volta
    add({ id: 'retomada', tom: 'ideia', icone: 'calendar', p: 0, titulo: `De volta depois de ${duracaoTxt(ret.dias)}`, texto: JA_VOLTOU[ret.faixa], porque: PORQUE_PAUSA, refs: REFS_PAUSA, ...(ret.faixa >= 4 ? { acao: { rotulo: 'Abrir o Treinador', rota: 'treinador' } } : {}) });
  } else if (cf.taxa < 0.6) {
    add({ id: 'frequencia', tom: 'atencao', icone: 'calendar', p: 1, titulo: 'Frequência abaixo da meta', texto: `${cf.feitos} de ${cf.previstos} treinos previstos. Uma meta menor, cumprida, rende mais.`, porque: 'Treinar cada músculo 2 vezes por semana dá mais resultado do que 1 vez. A regularidade é o que sustenta o progresso.', refs: ['schoenfeld2016freq', 'oms2020'], acao: { rotulo: 'Ajustar agenda', rota: 'treinos' } });
  } else if (cf.taxa < 0.9) {
    add({ id: 'frequencia', tom: 'ideia', icone: 'calendar', p: 6, titulo: 'Frequência: faltou pouco', texto: `${cf.feitos} de ${cf.previstos} treinos previstos ${sem(cf.semanas)}.`, porque: 'Constância ao longo dos meses conta mais do que treinos perfeitos de vez em quando.', refs: ['oms2020'] });
  } else {
    add({ id: 'frequencia', tom: 'bom', icone: 'flame', p: 1, titulo: 'Constância em dia', texto: `${cf.feitos} de ${cf.previstos} treinos previstos ${sem(cf.semanas)}.` });
  }

  // carga: quem bateu o topo das repetições (2 treinos seguidos = pronto; 1 treino = quase)
  const noTopo = prontosDe(ss, st).filter((x) => !caindoIds.has(x.id));
  const prontos = noTopo.filter((x) => x.treinos >= 2);
  const quase = noTopo.filter((x) => x.treinos < 2);
  const noTopoIds = new Set(noTopo.map((x) => x.id));

  // força: quedas, travados e altas
  // na volta de uma pausa, a marca abaixo da de antes é esperada: não vira alerta de queda nem de exercício travado
  const caindo = ret ? [] : tend.filter((x) => x.status === 'caindo');
  // quem bateu o topo das repetições não está travado: o próximo passo é subir a carga
  const parados = ret ? [] : tend.filter((x) => x.status === 'parado' && !noTopoIds.has(x.id));
  const subindo = tend.filter((x) => x.status === 'subindo').sort((a, b) => b.variacao - a.variacao);
  // cansaço geral: queda em 2 ou mais exercícios, sem mais exercícios subindo do que caindo
  if (caindo.length >= 2 && caindo.length >= subindo.length) {
    add({ id: 'queda', tom: 'atencao', icone: 'down', p: 2, titulo: 'Rendimento caindo', texto: `Queda em ${caindo.length} exercícios. Durma bem, coma o suficiente e faça uma semana mais leve.`, porque: 'Queda em vários exercícios ao mesmo tempo costuma ser cansaço acumulado. Uma semana com menos carga e menos séries ajuda a recuperar.', refs: ['bell2023'] });
  } else if (caindo.length) {
    add({ id: 'queda', tom: 'ideia', icone: 'down', p: 4, titulo: `Queda em: ${curto(caindo[0].nome, 50)}`, texto: `${Math.round(caindo[0].variacao * 100)}% nos últimos ${caindo[0].treinos} treinos. Confira a técnica e o descanso.`, porque: 'Uma queda isolada pode ser só um dia ruim. Se continuar, pode ser cansaço acumulado: reduzir por alguns dias as séries e a carga alivia a fadiga.', refs: ['bell2023'], acao: { rotulo: 'Ver exercício', rota: 'exercicio/' + caindo[0].id } });
  }
  if (parados.length >= 3) {
    add({ id: 'travado', tom: 'ideia', icone: 'swap', p: 3, titulo: `${parados.length} exercícios sem evoluir`, texto: 'Mesma marca há vários treinos. O Treinador pode sugerir trocas.', porque: 'Trocar o exercício por outro para o mesmo músculo dá resultado parecido e aumenta a motivação. Mantenha os exercícios principais e varie os mais simples.', refs: ['bazvalle2019'], acao: { rotulo: 'Abrir o Treinador', rota: 'treinador' } });
  } else if (parados.length) {
    add({ id: 'travado', tom: 'ideia', icone: 'swap', p: 3, titulo: `Travou: ${curto(parados[0].nome, 52)}`, texto: `${parados[0].treinos} treinos na mesma marca. Tente 1 repetição a mais por série ou troque a variação.`, porque: 'Progredir pede aumentar aos poucos as repetições ou a carga, chegando perto do limite com boa técnica.', refs: ['acsm2009', 'refalo2023'], acao: { rotulo: 'Ver exercício', rota: 'exercicio/' + parados[0].id } });
  }
  if (subindo.length) {
    const s0 = subindo[0];
    add({ id: 'alta', tom: 'bom', icone: 'up', p: 0, titulo: subindo.length > 1 ? `Força em alta em ${subindo.length} exercícios` : 'Força em alta', texto: `${curto(s0.nome, 80)}: +${Math.round(s0.variacao * 100)}% nos últimos ${s0.treinos} treinos.` });
  }
  if (recs.length) {
    add({ id: 'recordes', tom: 'bom', icone: 'trophy', p: 2, titulo: recs.length === 1 ? '1 recorde em 2 semanas' : `${recs.length} recordes em 2 semanas`, texto: recs.slice(0, 2).map((x) => curto(x.nome, 55)).join(' e ') + (recs.length > 2 ? ` e mais ${recs.length - 2}.` : '.') });
  }
  if (prontos.length) {
    add({ id: 'subir', tom: 'ideia', icone: 'bolt', p: 2, titulo: 'Pronto para mais carga', texto: `${curto(prontos[0].nome, 70)}: ${prontos[0].reps} repetições em todas as séries` + (prontos.length > 1 ? `, e mais ${prontos.length - 1}.` : '.'), porque: 'Quando você completa o topo das repetições em todas as séries, em dois treinos seguidos, é hora de aumentar a carga e voltar ao início da faixa.', refs: ['acsm2009'] });
  } else if (quase.length) {
    add({ id: 'subir', tom: 'ideia', icone: 'bolt', p: 4, titulo: 'Perto de aumentar a carga', texto: `${curto(quase[0].nome, 70)}: ${quase[0].reps} repetições em todas as séries. Repita no próximo treino.`, porque: 'A carga sobe quando você completa o topo das repetições em todas as séries, em dois treinos seguidos.', refs: ['acsm2009'] });
  }

  // séries por semana e equilíbrio entre músculos
  let poucos = [];
  if (vol.treinos >= 3) {
    const g = vol.porGrupo;
    poucos = GRUPOS_PRINCIPAIS.filter((k) => g[k] < SERIES_MIN).sort((a, b) => g[a] - g[b]);
    if (poucos.length) {
      const k = poucos[0];
      const outros = poucos.slice(1, 3).map(minusc);
      add({ id: 'pouco-' + k, tom: 'ideia', icone: 'dumbbell', p: 5, titulo: g[k] === 0 ? `Sem treino de ${minusc(k)}` : `Pouco treino de ${minusc(k)}`, texto: `${num1(g[k])} séries por semana${outros.length ? ` (também: ${outros.join(' e ')})` : ''}. O ideal é ${SERIES_BOM} ou mais.`, porque: 'Estudos mostram mais ganho de músculo com 10 ou mais séries semanais por grupo. Quatro séries por semana são a dose mínima estudada.', refs: ['schoenfeld2017vol', 'pelland2026', 'iversen2021'], acao: { rotulo: 'Ajustar treino', rota: 'treinos' } });
    } else if (objetivo === 'hipertrofia' && experiente) {
      const medios = GRUPOS_PRINCIPAIS.filter((k) => g[k] < SERIES_BOM - 1).sort((a, b) => g[a] - g[b]);
      if (medios.length) add({ id: 'mais-series', tom: 'ideia', icone: 'dumbbell', p: 7, titulo: `Mais séries de ${minusc(medios[0])}`, texto: `${num1(g[medios[0]])} séries por semana. Para ganhar massa, mire em ${SERIES_BOM} a ${SERIES_TETO}.`, porque: 'Para quem já treina há mais tempo, 12 a 20 séries semanais por grupo dão os melhores resultados.', refs: ['bazvalle2022'], acao: { rotulo: 'Ajustar treino', rota: 'treinos' } });
    }
    // excesso: conta só as séries em que o grupo é o músculo principal (as meias séries de músculo auxiliar não entram)
    const d = vol.diretas;
    const muitos = GRUPOS_VOLUME.filter((k) => d[k] > SERIES_TETO + 2).sort((a, b) => d[b] - d[a]);
    if (muitos.length) add({ id: 'muito-' + muitos[0], tom: 'atencao', icone: 'warn', p: 4, titulo: `Muitas séries de ${minusc(muitos[0])}`, texto: `${num1(d[muitos[0]])} séries diretas por semana. Acima de ${SERIES_TETO}, o ganho extra é pequeno e o cansaço cresce.`, porque: 'Passar muito de 20 séries semanais por grupo traz pouco resultado a mais e dificulta a recuperação.', refs: ['bazvalle2022'] });
    // (o corte de dois terços é critério deste aplicativo: as fontes falam em desequilíbrio, sem dar uma razão numérica)
    if (g.peito >= 6 && g.costas < g.peito * 0.67) {
      add({ id: 'empurra-puxa', tom: 'ideia', icone: 'swap', p: 4, titulo: 'Equilibre peito e costas', texto: `${num1(g.peito)} séries de peito e ${num1(g.costas)} de costas por semana. ${st && st.trainer && st.trainer.answers && st.trainer.answers.local === 'corporal' ? 'Sem aparelhos, a opção é a puxada de bruços; ou faça menos séries de peito.' : 'Inclua mais remadas e puxadas.'}`, porque: 'O ombro é uma das regiões mais lesionadas na musculação, e o desequilíbrio entre os músculos é um dos fatores. Fortalecer as costas e os músculos da escápula faz parte da prevenção.', refs: ['bonilla2022'], acao: { rotulo: 'Ajustar treino', rota: 'treinos' } });
    }
    if (g.quadriceps >= 6 && g.posteriores + g.gluteos * 0.5 < g.quadriceps * 0.5) {
      add({ id: 'frente-tras', tom: 'ideia', icone: 'swap', p: 5, titulo: 'Reforce a parte de trás da coxa', texto: `${num1(g.quadriceps)} séries de quadríceps e ${num1(g.posteriores)} de posteriores por semana.`, porque: 'A recomendação para a saúde é fortalecer todos os grandes grupos musculares.', refs: ['oms2020'], acao: { rotulo: 'Ajustar treino', rota: 'treinos' } });
    }
  }

  // recuperação e rotina
  const sd = semDescansoDe(ss, agora);
  // não pede "descanse mais" para um grupo que está com poucas séries na semana
  if (sd && !poucos.includes(sd.grupo)) add({ id: 'descanso', tom: 'ideia', icone: 'moon', p: 5, titulo: `Descanse mais: ${minusc(sd.grupo)}`, texto: `Treinado em dias seguidos ${sd.vezes} vezes. Deixe um dia de descanso antes de repetir o mesmo músculo.`, porque: 'O músculo se recupera e cresce no intervalo entre os treinos: evite treinar forte o mesmo grupo em dias seguidos.', refs: ['acsm2009'] });
  const feito = concluidasDe(ss);
  if (feito != null && feito < 0.75) add({ id: 'incompleto', tom: 'ideia', icone: 'timer', p: 5, titulo: 'Séries ficando para trás', texto: `Você concluiu ${Math.round(feito * 100)}% das séries nos últimos treinos. Um plano mais curto pode servir melhor.`, porque: 'Um treino que cabe na rotina e é feito por inteiro rende mais do que um treino longo feito pela metade.', refs: ['acsm2026'], acao: { rotulo: 'Abrir o Treinador', rota: 'treinador' } });
  const dur = duracaoDe(ss);
  if (dur != null && dur > 90) add({ id: 'duracao', tom: 'ideia', icone: 'timer', p: 6, titulo: 'Treinos longos', texto: `Média de ${dur} min. Descansos de 1 a 3 minutos entre as séries costumam bastar.`, porque: 'Para ganhar massa, descansar mais de 90 segundos não traz ganho apreciável; para força, 2 a 3 minutos nos exercícios principais bastam.', refs: ['singer2024', 'grgic2018', 'acsm2009'] });
  if (['saude', 'emagrecimento', 'resistencia'].includes(objetivo)) {
    const cardio = cardioDe(ss, agora);
    if (cardio < 75) add({ id: 'cardio', tom: 'ideia', icone: 'heart', p: 7, titulo: 'Pouco aeróbico registrado', texto: `${cardio} min por semana. A OMS recomenda de 150 a 300 min de atividade moderada.`, porque: 'Caminhada, bicicleta e outras atividades feitas fora do app também contam para essa meta.', refs: ['oms2020'] });
  }

  // peso corporal x objetivo da alimentação
  const alvo = respostas(st, 'nutri').objetivo || (objetivo === 'emagrecimento' ? 'emagrecer' : objetivo === 'hipertrofia' ? 'ganhar' : '');
  const tp = tendenciaPeso(st, agora);
  if (alvo && tp.kgSemana != null) {
    const kg = `${tp.kgSemana > 0 ? '+' : ''}${num1(tp.kgSemana)} kg por semana`;
    const abrir = { rotulo: 'Abrir Nutrição', rota: 'nutricao' };
    if (alvo === 'emagrecer') {
      if (tp.pctSemana < -1) add({ id: 'peso', tom: 'atencao', icone: 'warn', p: 2, titulo: 'Perdendo peso rápido demais', texto: `${kg}. Acima de 1% do peso por semana, perde-se mais músculo.`, porque: 'Perder de 0,5% a 1% do peso por semana preserva melhor os músculos e a força.', refs: ['garthe2011', 'helms2014'], acao: abrir });
      else if (tp.pctSemana <= -0.25) add({ id: 'peso', tom: 'bom', icone: 'check', p: 3, titulo: 'Peso caindo no ritmo certo', texto: `${kg} ${sem(tp.semanas)}.` });
      else if (tp.pctSemana >= 0.25) add({ id: 'peso', tom: 'atencao', icone: 'food', p: 3, titulo: 'O peso está subindo', texto: `${kg} em ${tp.semanas} semanas. Para emagrecer, reveja as porções com a Nutricionista.`, porque: 'O peso só cai quando se come um pouco menos do que se gasta. Confira as metas e as porções.', refs: ['jensen2013', 'helms2014'], acao: abrir });
      else if (tp.semanas >= 3) add({ id: 'peso', tom: 'ideia', icone: 'food', p: 3, titulo: 'Peso parado', texto: `${kg} em ${tp.semanas} semanas. Reveja as porções com a Nutricionista.`, porque: 'Sem déficit de calorias, o peso não cai. Pequenos ajustes nas porções costumam bastar.', refs: ['helms2014'], acao: abrir });
    } else if (alvo === 'ganhar') {
      if (tp.pctSemana > 0.5) add({ id: 'peso', tom: 'atencao', icone: 'warn', p: 3, titulo: 'Ganhando peso rápido', texto: `${kg}. Acima de 0,5% do peso por semana, boa parte tende a ser gordura.`, porque: 'Um ganho lento, de 0,25% a 0,5% do peso por semana, favorece músculo em vez de gordura.', refs: ['iraki2019', 'slater2019'], acao: abrir });
      else if (tp.pctSemana >= 0.1) add({ id: 'peso', tom: 'bom', icone: 'check', p: 3, titulo: 'Ganho de peso no ritmo certo', texto: `${kg} ${sem(tp.semanas)}.` });
      else if (tp.pctSemana <= -0.25) add({ id: 'peso', tom: 'atencao', icone: 'food', p: 3, titulo: 'O peso está caindo', texto: `${kg} em ${tp.semanas} semanas. Para ganhar massa, aumente as porções.`, porque: 'Perdendo peso fica difícil ganhar músculo. Coma um pouco acima do que gasta, com proteína suficiente.', refs: ['iraki2019', 'slater2019'], acao: abrir });
      else if (tp.semanas >= 3) add({ id: 'peso', tom: 'ideia', icone: 'food', p: 3, titulo: 'O peso não sobe', texto: `${kg} em ${tp.semanas} semanas. Aumente um pouco as porções.`, porque: 'Para ganhar massa é preciso comer um pouco acima do que se gasta, com proteína suficiente.', refs: ['iraki2019', 'slater2019'], acao: abrir });
    }
  } else if (alvo && (tp.diasSemRegistro == null || tp.diasSemRegistro > 14)) {
    add({ id: 'pesar', tom: 'ideia', icone: 'chart', p: 8, titulo: 'Registre o seu peso', texto: 'Uma vez por semana basta para acompanhar a tendência.', acao: { rotulo: 'Registrar peso', rota: 'progresso', aba: 'peso' } });
  }

  dicas.sort((a, b) => PESO_TOM[a.tom] - PESO_TOM[b.tom] || a.p - b.p);
  return { suficiente: true, dicas, resumo };
}

// as dicas que vão para a tela inicial: o que mais precisa de atenção e, se houver, uma boa notícia
export function destaques(dicas, max = 2) {
  const melhorar = dicas.filter((d) => d.tom !== 'bom');
  const bons = dicas.filter((d) => d.tom === 'bom');
  const out = melhorar.slice(0, bons.length ? max - 1 : max);
  if (bons.length) out.push(bons[0]);
  return out.slice(0, max);
}

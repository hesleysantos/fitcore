// Estado do aplicativo. Tudo fica SOMENTE no aparelho (IndexedDB, com reserva em localStorage).
// Nenhum dado é enviado para servidor algum.
import { EX_POR_ID } from './data/exercises.js';
import { EQUIPAMENTOS } from './data/equipment.js';
import { PERGUNTAS as P_TREINO } from './logic/trainer.js';
import { PERGUNTAS as P_NUTRI, limparEmCasa, limparAjustes } from './logic/nutrition.js';
import { parValido } from './logic/objetivos.js';
import { limparDores } from './logic/dor.js';
import { limparSaudeFora } from './logic/saude-fora.js';
import { limparCorrida, limparRegistros } from './logic/corrida.js';
import { limparSono, sonoPadrao } from './logic/sono.js';
import { limparCombo, comboPadrao, chaveValida } from './logic/combinado.js';
import { limparDiario, diarioPadrao } from './logic/diario.js';
import { diaValido } from './logic/saude.js';
import { limparPerdidos } from './logic/perdido.js';
import { limparEsteira } from './logic/esteira.js';

const DB_NAME = 'fitcore';
const STORE = 'kv';
const KEY = 'estado';
const KEY_PREV = 'estado_anterior';
const LS_KEY = 'fitcore.estado';
export const VERSAO = 1;
const MAX_IMPORT = 24 * 1024 * 1024; // cabe o maior histórico possível (5.000 treinos)
const MAX_ESTADO = 30 * 1024 * 1024; // um backup válido nunca vira um estado maior que isto
export const MAX_PLANOS = 60;
export const LETRAS = ['normal', 'grande', 'muito']; // tamanhos de letra de Ajustes (100%, 125% e 150%: css/app.css)

const defaults = () => ({
  v: VERSAO,
  // letra: tamanho do texto ('normal' | 'grande' | 'muito'); contraste: cores mais fortes (views/more.js, main.js)
  settings: { tema: 'auto', descanso: 90, som: true, somAlerta: 'equilibrado', vibrar: true, telaLigada: true, animar: true, avisoFundo: false, letra: 'normal', contraste: false },
  gym: { all: true, has: {} },
  plans: [],
  activePlan: '',
  sessions: [],
  current: null,
  // combo: "foco|fortalecimento" com que o plano aceito foi montado (logic/combinado.js)
  trainer: { answers: {}, aceitoEm: '', revisaoEm: '', adiadoAte: '', versao: 0, combo: '' },
  // ajustes: "Outra sugestão" e "Trocar" do cardápio de cada dia (logic/nutrition.js, limparAjustes)
  nutri: { answers: {}, calculadoEm: '', seed: 0, emCasa: [], soCasa: false, ajustes: {} },
  body: [],
  // Treinador de corrida (logic/corrida.js): entrevista e plano aceito; runs = corridas registradas
  // esteira: dias em que a corrida do plano vai para a esteira (logic/esteira.js)
  run: { answers: {}, aceitoEm: '', inicio: '', pausadoEm: '', cron: null, pausas: [], mostrados: [], degrau: null, esteira: [] },
  runs: [],
  dores: [], // dores contadas ao Treinador (logic/dor.js); valem para musculação e corrida
  saudeFora: [], // problemas de saúde que não vêm do treino: febre, pancada, corte... (logic/saude-fora.js)
  sono: sonoPadrao(), // meta de sono e noites registradas (logic/sono.js)
  combo: comboPadrao(), // corrida + musculação: foco e fortalecimento (logic/combinado.js)
  diario: diarioPadrao(), // diário alimentar: o que a pessoa comeu de fato (logic/diario.js)
  perdidos: [], // "Não treinei" e "Não corri": dias marcados e para onde o treino foi (logic/perdido.js)
  // objetivosOk: par "treino|alimentação" que o usuário escolheu manter diferente (logic/objetivos.js)
  // backupAdiadoEm: quando a pessoa tocou em "Depois" no lembrete de backup da tela inicial
  ui: { onboarded: false, installDismissedAt: '', backupEm: '', backupAdiadoEm: '', objetivosOk: '' },
});

export let state = defaults();
const subs = new Set();
let db = null;
let dbOk = true;        // falso se a leitura do banco falhou: não gravamos por cima de dados que não conseguimos ler
let comBase = true;     // falso quando o app abriu vazio SEM conseguir ler o banco: o que for gravado assim não pode vencer o banco depois
const LS_MARCA = 'fitcore-tem-dados'; // marca de que este aparelho já gravou dados no banco (ver load)
const temMarca = () => { try { return localStorage.getItem(LS_MARCA) === '1'; } catch { return false; } };
const porMarca = () => { try { localStorage.setItem(LS_MARCA, '1'); } catch { /* ignore */ } };
export const armazenamentoOk = () => dbOk;
let rev = 0;            // número da última gravação conhecida (para detectar outra aba/janela gravando)
let saveT = 0;
let dirty = false;
let canal = null;
let aoMudarFora = null;
let aoFalhar = null;

// ---------- validação (usada ao carregar e ao importar backup) ----------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max, def = '') => (typeof v === 'string' ? v.slice(0, max) : def);
const num = (v, min, max, def) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
const numOrNull = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const arr = (v, max, fn) => (Array.isArray(v) ? v.slice(0, max).map(fn).filter((x) => x != null) : []);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// data e hora no formato ISO completo (o mesmo que o app grava): evita datas que cada navegador interpreta de um jeito
const iso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : '');
const idStr = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) && !BAD_KEYS.has(v) ? v : '');
const dayKey = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v ? v : '');
const novoId = (p) => p + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
function unico(id, vistos, prefixo) {
  let out = id || novoId(prefixo);
  while (vistos.has(out)) out = novoId(prefixo);
  vistos.add(out);
  return out;
}

// Respostas das entrevistas: só entram as perguntas que existem, com valores que existem nelas.
function cleanAnswers(v, perguntas) {
  const out = {};
  if (!isObj(v)) return out;
  for (const q of perguntas) {
    if (!Object.prototype.hasOwnProperty.call(v, q.k)) continue;
    const x = v[q.k];
    if (q.tipo === 'numero') {
      if (typeof x === 'number' && Number.isFinite(x) && x >= q.min && x <= q.max) out[q.k] = x;
    } else if (q.tipo === 'um') {
      if (typeof x === 'string' && q.op.some((o) => o[0] === x)) out[q.k] = x;
    } else if (Array.isArray(x)) {
      const ok = [...new Set(x.filter((y) => typeof y === 'string' && q.op.some((o) => o[0] === y)))].slice(0, q.max || q.op.length);
      if (ok.length) out[q.k] = ok;
    }
    // data da liberação médica (AAAA-MM-DD, logic/saude.js): só com a resposta "sim"
    if (q.dataEm && out[q.k] === 'sim' && diaValido(v[q.dataEm])) out[q.dataEm] = v[q.dataEm];
  }
  return out;
}
const cleanSet = (s) => {
  if (!isObj(s)) return null;
  return { kg: numOrNull(s.kg, 0, 2000), reps: numOrNull(s.reps, 0, 2000), seg: numOrNull(s.seg, 0, 86400), ok: bool(s.ok, false) };
};
const cleanSessItem = (it) => {
  if (!isObj(it) || !EX_POR_ID.has(it.ex)) return null;
  const out = { ex: it.ex, sets: arr(it.sets, 30, cleanSet), alvo: typeof it.alvo === 'string' && /^\d{1,3}(-\d{1,3})?$/.test(it.alvo) ? it.alvo : '10', descanso: Math.round(num(it.descanso, 0, 900, 90)) };
  if (typeof it.planejadas === 'number' && Number.isFinite(it.planejadas)) out.planejadas = Math.round(Math.min(30, Math.max(0, it.planejadas)));
  return out;
};
function cleanSession(s, isCurrent) {
  if (!isObj(s)) return null;
  const inicio = iso(s.inicio);
  if (!inicio) return null;
  const out = {
    id: idStr(s.id),
    planId: idStr(s.planId), diaId: idStr(s.diaId), nome: str(s.nome, 60, 'Treino'),
    inicio, fim: iso(s.fim), nota: str(s.nota, 500),
    itens: arr(s.itens, 60, cleanSessItem),
  };
  if (isCurrent) {
    out.id = out.id || novoId('s'); out.restEnd = num(s.restEnd, 0, 4e12, 0); out.restTotal = num(s.restTotal, 0, 900, 0);
    out.volta = Math.round(num(s.volta, 0, 40000, 0)); // dias parado antes deste treino (0 = sem pausa)
    // cronômetro de exercício por tempo em andamento: série j do item i, fim (ms) e duração (s)
    const c = isObj(s.cron) ? s.cron : null;
    const dentro = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
    // `ex` confere que o item i ainda é o exercício cronometrado (a ordem pode ter mudado); série já feita não tem cronômetro
    out.cron = c && Number.isInteger(c.i) && Number.isInteger(c.j) && out.itens[c.i] && out.itens[c.i].sets[c.j] && !out.itens[c.i].sets[c.j].ok
      && out.itens[c.i].ex === c.ex && dentro(c.end, 1, 4e12) && dentro(c.total, 1, 36000)
      ? { i: c.i, j: c.j, end: c.end, total: c.total, ex: c.ex } : null;
  }
  else if (!out.fim || Date.parse(out.fim) < Date.parse(inicio)) return null;
  // treino já finalizado: só as séries concluídas fazem parte do histórico (um arquivo com séries vazias não incha os dados)
  if (!isCurrent) for (const it of out.itens) it.sets = it.sets.filter((x) => x.ok);
  return out;
}
const cleanPlanItem = (it) => {
  if (!isObj(it) || !EX_POR_ID.has(it.ex)) return null;
  const reps = typeof it.reps === 'string' && /^\d{1,3}(-\d{1,3})?$/.test(it.reps) ? it.reps : '10';
  return { ex: it.ex, series: Math.round(num(it.series, 1, 12, 3)), reps, descanso: Math.round(num(it.descanso, 0, 900, 90)), nota: str(it.nota, 200) };
};
const cleanDay = (d) => {
  if (!isObj(d)) return null;
  const id = idStr(d.id);
  if (!id) return null;
  return { id, nome: str(d.nome, 40, 'Treino'), foco: str(d.foco, 90), itens: arr(d.itens, 40, cleanPlanItem) };
};
// Variação dos exercícios (logic/variacao.js): desde quando conta o prazo, até quando a pessoa adiou e as últimas trocas
// (o que saiu e o que entrou, para não trazer de volta um exercício que acabou de sair). Só aparece no plano que tem algo.
const cleanVariacao = (v) => {
  if (!isObj(v)) return null;
  const trocas = arr(Array.isArray(v.trocas) ? v.trocas.slice(-40) : [], 40, (t) => (isObj(t) && EX_POR_ID.has(t.de) && EX_POR_ID.has(t.para) && iso(t.em) ? { de: t.de, para: t.para, em: t.em } : null));
  const out = { desde: iso(v.desde), adiadoAte: iso(v.adiadoAte), travadoAte: iso(v.travadoAte), trocas };
  return out.desde || out.adiadoAte || out.travadoAte || trocas.length ? out : null;
};
function cleanPlan(p) {
  if (!isObj(p)) return null;
  const id = idStr(p.id);
  if (!id) return null;
  const vistos = new Set();
  const dias = arr(p.dias, 14, cleanDay).filter((d) => (vistos.has(d.id) ? false : vistos.add(d.id)));
  const agenda = {};
  if (isObj(p.agenda)) for (let i = 0; i < 7; i++) { const v = p.agenda[i]; if (typeof v === 'string' && vistos.has(v)) agenda[i] = v; }
  const variacao = cleanVariacao(p.variacao);
  return { id, nome: str(p.nome, 60, 'Meu treino'), origem: oneOf(p.origem, ['treinador', 'modelo', 'manual', 'fortalecimento'], 'manual'), criadoEm: iso(p.criadoEm), dias, agenda, info: str(p.info, 600), ...(variacao ? { variacao } : {}) };
}
const cleanBody = (b) => {
  if (!isObj(b)) return null;
  const data = dayKey(b.data);
  const peso = numOrNull(b.peso, 20, 400);
  if (!data || peso == null) return null;
  return { data, peso, cintura: numOrNull(b.cintura, 30, 250) };
};

// Reconstrói o estado campo a campo a partir de dados não confiáveis (arquivo de backup ou armazenamento).
// `doAparelho`: os dados vêm do armazenamento deste aparelho (e não de um arquivo de backup). Nesse caso não se corta
// o que está "no futuro": se o relógio do aparelho estiver atrasado, noites, cochilos e diário recentes pareceriam
// futuros e seriam apagados ao abrir. Em backup importado o corte continua valendo.
export function sanitize(raw, { doAparelho = false } = {}) {
  const semCorte = doAparelho ? { semCorteDeFuturo: true } : undefined;
  const d = defaults();
  if (!isObj(raw)) return d;
  const s = isObj(raw.settings) ? raw.settings : {};
  d.settings = {
    tema: oneOf(s.tema, ['auto', 'escuro', 'claro'], 'auto'),
    descanso: Math.round(num(s.descanso, 15, 600, 90)),
    som: bool(s.som, true), somAlerta: ['equilibrado', 'sino', 'alto', 'longo', 'discreto'].includes(s.somAlerta) ? s.somAlerta : 'equilibrado', vibrar: bool(s.vibrar, true), telaLigada: bool(s.telaLigada, true), animar: bool(s.animar, true), avisoFundo: bool(s.avisoFundo, false),
    letra: oneOf(s.letra, LETRAS, 'normal'), contraste: bool(s.contraste, false),
  };
  const g = isObj(raw.gym) ? raw.gym : {};
  d.gym.all = bool(g.all, true);
  if (isObj(g.has)) for (const k of Object.keys(EQUIPAMENTOS)) if (g.has[k] === true) d.gym.has[k] = true;
  const idsPlano = new Set();
  d.plans = arr(raw.plans, MAX_PLANOS, cleanPlan).filter((p) => (idsPlano.has(p.id) ? false : idsPlano.add(p.id)));
  d.activePlan = typeof raw.activePlan === 'string' && idsPlano.has(raw.activePlan) ? raw.activePlan : (d.plans[0] ? d.plans[0].id : '');
  const idsSessao = new Set();
  // lê um pouco além do limite, ordena e fica com os 5.000 treinos MAIS RECENTES (num arquivo fora de ordem, cortar antes
  // de ordenar jogaria fora os mais novos)
  d.sessions = arr(raw.sessions, 20000, (x) => cleanSession(x, false));
  d.sessions.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  if (d.sessions.length > 5000) d.sessions = d.sessions.slice(-5000);
  for (const x of d.sessions) x.id = unico(x.id, idsSessao, 's');
  d.current = raw.current ? cleanSession(raw.current, true) : null;
  const t = isObj(raw.trainer) ? raw.trainer : {};
  d.trainer = { answers: cleanAnswers(t.answers, P_TREINO), aceitoEm: iso(t.aceitoEm), revisaoEm: iso(t.revisaoEm), adiadoAte: iso(t.adiadoAte), versao: Math.round(num(t.versao, 0, 9999, 0)), combo: chaveValida(t.combo) ? t.combo : '' };
  const n = isObj(raw.nutri) ? raw.nutri : {};
  d.nutri = { answers: cleanAnswers(n.answers, P_NUTRI), calculadoEm: iso(n.calculadoEm), seed: Math.round(num(n.seed, 0, 1e6, 0)), emCasa: limparEmCasa(n.emCasa), soCasa: n.soCasa === true, ajustes: limparAjustes(n.ajustes) };
  const dias = new Set();
  d.body = arr(raw.body, 3000, cleanBody).filter((b) => (dias.has(b.data) ? false : dias.add(b.data))).sort((a, b) => (a.data < b.data ? -1 : 1));
  d.dores = limparDores(raw.dores);
  d.saudeFora = limparSaudeFora(raw.saudeFora);
  d.sono = limparSono(raw.sono, undefined, semCorte);
  d.combo = limparCombo(raw.combo);
  d.diario = limparDiario(raw.diario, undefined, semCorte);
  d.run = limparCorrida(raw.run);
  d.run.esteira = limparEsteira(isObj(raw.run) ? raw.run.esteira : null); // só datas válidas e recentes (logic/esteira.js)
  d.runs = limparRegistros(raw.runs); // até 3000 registros, sem id repetido
  d.perdidos = limparPerdidos(raw.perdidos);
  const u = isObj(raw.ui) ? raw.ui : {};
  d.ui = { onboarded: bool(u.onboarded, false), installDismissedAt: iso(u.installDismissedAt), backupEm: iso(u.backupEm), backupAdiadoEm: iso(u.backupAdiadoEm), objetivosOk: parValido(u.objetivosOk) ? u.objetivosOk : '' };
  return d;
}

// ---------- persistência ----------
let motivoBanco = 'ok'; // 'ok' | 'tempo' (não respondeu) | 'erro' (o navegador não oferece banco, ex.: janela anônima antiga)
function openDb() {
  return new Promise((resolve) => {
    let feito = false;
    const fim = (v, motivo) => { if (!feito) { feito = true; motivoBanco = motivo; resolve(v); } };
    setTimeout(() => fim(null, 'tempo'), 4000);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => fim(req.result, 'ok');
      req.onerror = () => fim(null, 'erro');
      req.onblocked = () => fim(null, 'tempo');
    } catch { fim(null, 'erro'); }
  });
}
// devolve { ok, value }: ok = falso quando houve ERRO de leitura (diferente de "não existe")
function idbGet(key) {
  return new Promise((resolve) => {
    if (!db) { resolve({ ok: false, value: undefined }); return; }
    try {
      const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      rq.onsuccess = () => resolve({ ok: true, value: rq.result });
      rq.onerror = () => resolve({ ok: false, value: undefined });
    } catch { resolve({ ok: false, value: undefined }); }
  });
}
function idbPut(key, value) {
  return new Promise((resolve) => {
    if (!db) { resolve(false); return; }
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch { resolve(false); }
  });
}
function idbDelete(key) {
  return new Promise((resolve) => {
    if (!db) { resolve(false); return; }
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch { resolve(false); }
  });
}
// grava só se ninguém gravou depois de nós; devolve 'ok' | 'conflito' | 'erro'
function idbPutSeAtual(registro, revBase) {
  return new Promise((resolve) => {
    if (!db) { resolve('erro'); return; }
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      let resultado = 'ok';
      const rq = st.get(KEY);
      rq.onsuccess = () => {
        const atual = rq.result;
        const revAtual = isObj(atual) && typeof atual.rev === 'number' ? atual.rev : 0;
        if (revAtual > revBase) { resultado = 'conflito'; return; }
        st.put(registro, KEY);
      };
      rq.onerror = () => { resultado = 'erro'; };
      tx.oncomplete = () => resolve(resultado);
      tx.onerror = () => resolve('erro');
      tx.onabort = () => resolve('erro');
    } catch { resolve('erro'); }
  });
}
const desembrulha = (r) => (isObj(r) && isObj(r.dados) && typeof r.rev === 'number' ? { rev: r.rev, dados: r.dados, semBanco: r.semBanco === true } : isObj(r) ? { rev: 0, dados: r } : null);
function lerReserva() {
  try { const t = localStorage.getItem(LS_KEY); return t ? desembrulha(JSON.parse(t)) : null; } catch { return null; }
}
const avisar = () => { for (const f of subs) f(state); };

async function recarregar() {
  const r = await idbGet(KEY);
  const reg = r.ok ? desembrulha(r.value) : null;
  if (!reg) return false;
  state = sanitize(reg.dados, { doAparelho: true });
  rev = reg.rev;
  dirty = false;
  clearTimeout(saveT);
  avisar();
  return true;
}

export async function load() {
  db = await openDb();
  if (!db && motivoBanco === 'tempo') db = await openDb(); // o banco demorou: tenta mais uma vez
  const r = await idbGet(KEY);
  dbOk = !!db && r.ok;
  const doBanco = r.ok ? desembrulha(r.value) : null;
  const daReserva = lerReserva();
  // O banco não respondeu e não há reserva: abrir "vazio" faria o usuário achar que perdeu tudo e, pior,
  // gravar por cima dos dados reais depois. Melhor avisar e deixar tentar de novo.
  // Vale também quando o banco deu erro neste aparelho que já tinha dados gravados nele (marca): não é aparelho novo.
  if (!dbOk && !daReserva && (motivoBanco === 'tempo' || temMarca())) throw new Error('banco indisponível');
  if (doBanco) porMarca();
  // Usa a cópia mais nova. A reserva só vence o banco se foi gravada com o banco funcionando
  // (última gravação falhou ou ficou pendente); uma reserva feita "sem banco" nunca apaga o que está no banco.
  const reservaVale = daReserva && !(daReserva.semBanco && doBanco);
  const reg = doBanco && reservaVale ? (daReserva.rev > doBanco.rev ? daReserva : doBanco) : doBanco || daReserva;
  if (daReserva && !reservaVale) { try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } }
  state = sanitize(reg ? reg.dados : undefined, { doAparelho: true });
  rev = reg ? reg.rev : 0;
  // Há base confiável quando o banco respondeu ou quando os dados vieram de uma reserva feita a partir de dados reais.
  // Só o caso "abriu vazio sem banco" (ou continuou uma reserva assim) fica marcado como sem base.
  comBase = dbOk || (!!reg && !(reg === daReserva && daReserva.semBanco));
  if (reg && reg === daReserva && dbOk) { dirty = true; flush(); } // devolve ao banco o que só estava na reserva
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch { /* ignore */ }
  window.addEventListener('pagehide', () => { guardarReserva(); flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { guardarReserva(); flush(); }
    else verificarOutraJanela();
  });
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      canal = new BroadcastChannel('fitcore');
      canal.onmessage = (e) => { if (e.data && typeof e.data.rev === 'number' && e.data.rev > rev) verificarOutraJanela(); };
    }
  } catch { canal = null; }
  return state;
}
// Outra aba ou janela do app gravou dados mais novos? Então esta recarrega (se não tiver nada pendente).
async function verificarOutraJanela() {
  if (!dbOk || dirty || gravando) return;
  const r = await idbGet(KEY);
  const reg = r.ok ? desembrulha(r.value) : null;
  if (reg && reg.rev > rev && !dirty && !gravando) { await recarregar(); if (aoMudarFora) aoMudarFora(); }
}

// Uma gravação por vez. Se duas se cruzassem, a segunda encontraria no banco a revisão da primeira,
// tomaria isso por "outra janela gravou" e recarregaria dados mais antigos, desfazendo a última alteração.
let gravando = null;
export async function flush() {
  while (gravando) { try { await gravando; } catch { /* a próxima tentativa decide */ } }
  if (!dirty) return;
  gravando = gravar();
  try { await gravando; } finally { gravando = null; }
}
// Ao sair da tela (app em segundo plano ou fechando), o que ainda não chegou ao banco fica também na reserva,
// de forma imediata: se o sistema encerrar o app antes de a gravação terminar, nada se perde.
function guardarReserva() {
  if (!dirty && !gravando) return;
  try { localStorage.setItem(LS_KEY, JSON.stringify({ rev: rev + 2, salvoEm: new Date().toISOString(), dados: state })); } catch { /* sem espaço: segue só com o banco */ }
}
async function gravar() {
  dirty = false;
  clearTimeout(saveT);
  const registro = { rev: rev + 1, salvoEm: new Date().toISOString(), dados: state };
  const r = dbOk ? await idbPutSeAtual(registro, rev) : 'erro';
  if (r === 'ok') {
    rev = registro.rev;
    porMarca();
    // a reserva só sai quando não há mais nada pendente (uma alteração feita durante a gravação ainda depende dela)
    if (!dirty) { try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } }
    try { if (canal) canal.postMessage({ rev }); } catch { /* ignore */ }
    return;
  }
  if (r === 'conflito') {
    // outra janela gravou antes: ficamos com os dados dela, para não apagar o que foi feito lá
    await recarregar();
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } // a reserva desta janela ficou velha
    if (aoMudarFora) aoMudarFora('conflito');
    return;
  }
  // sem banco: a reserva guarda a alteração. Se a sessão partiu de dados reais (comBase), ela vence o banco na próxima abertura
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...registro, semBanco: !dbOk && !comBase })); rev = registro.rev; } catch {
    dirty = true; // nada foi gravado: tenta de novo na próxima alteração e avisa
    if (aoFalhar) aoFalhar();
  }
}
export function save() {
  dirty = true;
  clearTimeout(saveT);
  saveT = setTimeout(flush, 200);
}
export function update(fn) {
  fn(state);
  save();
  avisar();
}
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function onExternalChange(fn) { aoMudarFora = fn; }
export function onSaveError(fn) { aoFalhar = fn; }

// ---------- backup ----------
export function exportData() {
  return JSON.stringify({ app: 'fitcore', v: VERSAO, exportadoEm: new Date().toISOString(), dados: state });
}
// Lê e valida um backup SEM aplicar. Devolve os dados limpos e um resumo para o usuário conferir.
export function readBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_IMPORT) throw new Error('Arquivo grande demais ou inválido.');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Este arquivo não é um backup válido.'); }
  if (!isObj(parsed) || parsed.app !== 'fitcore' || !isObj(parsed.dados)) throw new Error('Este arquivo não é um backup deste aplicativo.');
  const v = typeof parsed.v === 'number' ? parsed.v : typeof parsed.dados.v === 'number' ? parsed.dados.v : 1;
  if (v > VERSAO) throw new Error('Este backup foi feito por uma versão mais nova do aplicativo. Atualize o app antes de restaurar.');
  const dados = sanitize(parsed.dados);
  dados.current = null;
  const bruto = Array.isArray(parsed.dados.sessions) ? parsed.dados.sessions.length : 0;
  if (JSON.stringify(dados).length > MAX_ESTADO) throw new Error('Arquivo grande demais ou inválido.');
  return { dados, resumo: { treinos: dados.sessions.length, planos: dados.plans.length, pesos: dados.body.length, corridas: dados.runs.length, dores: dados.dores.length, noites: dados.sono.registros.length, diasDeDiario: Array.isArray(dados.diario.dias) ? dados.diario.dias.length : 0, exportadoEm: iso(parsed.exportadoEm), descartados: Math.max(0, bruto - dados.sessions.length) } };
}
export async function applyBackup(dados) {
  // guarda o estado atual para permitir "desfazer"
  const guardou = await idbPut(KEY_PREV, { salvoEm: new Date().toISOString(), dados: JSON.parse(JSON.stringify(state)) });
  state = dados;
  save();
  avisar();
  return guardou; // falso: não foi possível guardar os dados anteriores (não haverá "desfazer")
}
export function importData(text) {
  const { dados, resumo } = readBackup(text);
  state = dados;
  save();
  avisar();
  return resumo;
}
export async function previousInfo() {
  const r = await idbGet(KEY_PREV);
  if (!r.ok || !isObj(r.value) || !isObj(r.value.dados)) return null;
  const d = sanitize(r.value.dados, { doAparelho: true });
  return { salvoEm: iso(r.value.salvoEm), treinos: d.sessions.length, planos: d.plans.length };
}
export async function restorePrevious() {
  const r = await idbGet(KEY_PREV);
  if (!r.ok || !isObj(r.value) || !isObj(r.value.dados)) return false;
  state = sanitize(r.value.dados, { doAparelho: true }); // inclui o treino que estava em andamento na hora da restauração
  await idbDelete(KEY_PREV);
  save();
  avisar();
  return true;
}
export async function resetAll() {
  state = defaults();
  // o estado da tela do treino guiado (views/session.js) também sai
  try { localStorage.removeItem('fitcore-treino-guiado'); } catch { /* ignore */ }
  await idbDelete(KEY_PREV);
  dirty = true;
  await flush();
  // Confere se o estado vazio chegou mesmo ao banco. Se não chegou, fica uma reserva vazia que vence o banco na próxima
  // abertura (senão os dados "apagados" voltariam). Devolve falso se nem isso foi possível.
  let ok = false;
  if (dbOk) { const r = await idbGet(KEY); const reg = r.ok ? desembrulha(r.value) : null; ok = !!reg && reg.rev === rev; }
  if (ok) { try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } } else {
    try { rev += 1; localStorage.setItem(LS_KEY, JSON.stringify({ rev, salvoEm: new Date().toISOString(), dados: state, semBanco: false })); ok = true; } catch { ok = false; }
  }
  avisar();
  return ok;
}

// ---------- consultas comuns ----------
export const activePlan = () => state.plans.find((p) => p.id === state.activePlan) || null;
export const planById = (id) => state.plans.find((p) => p.id === id) || null;
export function hasEquip(ex) {
  if (state.gym.all) return true;
  return ex.equip.every((e) => state.gym.has[e]);
}

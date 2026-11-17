// Treino perdido: a pessoa marca "Não treinei" (musculação) ou "Não corri" (corrida) num dia desta semana (hoje ou um dia
// que já passou). Puro: sem DOM. O estado guarda as marcas em state.perdidos (validadas por limparPerdidos, aqui).
//
// O que as fontes sustentam (todas lidas em texto completo):
//  • Para ganhar músculo, o que mais conta é o volume da semana: com o volume ajustado, treinar o músculo mais vezes por
//    semana tem efeito "negligenciável" na massa e efeito positivo, com retorno decrescente, na força (ref pelland2026). O
//    ACSM de 2009 traz o mesmo: 3 dias por semana deram o mesmo ganho de força que 2 quando o volume era igual (ref
//    acsm2009). Por isso, se dá, o treino perdido MUDA DE DIA dentro da semana, para o volume da semana não cair.
//  • Entre duas sessões do mesmo grupo muscular, 48 horas ou mais (ref garber2011, recomendação de nível A; o texto fala em
//    48 a 72 horas). O ACSM de 2009 recomenda dias alternados para quem começa, e deixa dois treinos no mesmo dia só para
//    avançados e atletas de elite, com músculos diferentes em cada um (evidência C — ref acsm2009). Por isso o aplicativo
//    nunca junta dois treinos no mesmo dia nem põe o mesmo músculo pesado em dias seguidos. "Pesado" = 3 séries ou mais com
//    o grupo como músculo principal, o mesmo critério do Treinador (logic/trainer.js) para espalhar os treinos.
//  • Sem dia que respeite esse descanso, a semana segue e o treino volta no dia dele, na semana seguinte. Perder um treino
//    custa pouco: para quem já treina, 1 a 2 dias por semana mantêm a força (ref acsm2009), e poucas semanas sem treinar
//    tiram pouca força (ref caterisano2019). Com 2 semanas ou mais sem treinar, valem as regras da volta (logic/pausa.js):
//    aqui não há outra regra para dias perdidos seguidos.
//  • Corrida + musculação: as mesmas regras do encaixe do Treinador (logic/trainer.js, encaixarNaCorrida) — com prioridade
//    na corrida ou nos dois por igual, pernas a 24 horas ou mais da corrida forte e do longo, e 48 horas para quem é novo
//    na musculação (refs blagrove2018, doma2017). Pelo menos um dia sem treino na semana (ref meeusen2013); menores de 18,
//    dois (ref valovichmcleod2011). Menores de 18 e diabetes: força em dias não seguidos, como no Treinador (refs
//    colberg2016, valovichmcleod2011).
//  • Dias em que a pessoa não treina (resposta do Treinador — logic/dias-livres.js): nunca recebem treino. Um treino que
//    já estava num deles (plano editado à mão) pode ficar onde está, mas nenhum outro vai para lá.
//  • Corrida perdida não se repõe: a marca "Não corri" só fica registrada. O plano de corrida (logic/corrida.js) já não
//    repõe treino perdido e ajusta o volume pelo que foi feito nas últimas semanas. Juntar a corrida perdida a outra faria
//    uma corrida maior, e uma corrida mais de 10% maior do que a mais longa dos últimos 30 dias aumenta o risco de lesão por
//    sobrecarga (ref frandsen2025).
import { EX_POR_ID } from '../data/exercises.js';
import { MUSCULOS } from '../data/muscles.js';
import { planoDaSemanaEm } from './corrida.js';
import { comboAtual } from './combinado.js';
import { perfil } from './trainer.js';
import { respostasProtegidas } from './saude.js';
import { diasBloqueados } from './dias-livres.js';

export const MAX_PERDIDOS = 200;
export const TIPOS_PERDIDO = ['musculacao', 'corrida'];
export const REFS_MUSCULACAO = ['pelland2026', 'garber2011', 'acsm2009', 'caterisano2019'];
export const REFS_COMBINADO = ['blagrove2018'];
export const REFS_CORRIDA = ['frandsen2025'];
export const PESADO = 3; // séries do grupo como músculo principal a partir das quais o treino conta como pesado para ele
export const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const DIA_MS = 86400000;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const BAD = new Set(['__proto__', 'constructor', 'prototype']);
const idStr = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) && !BAD.has(v) ? v : '');
const iso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : '');
const pad = (n) => String(n).padStart(2, '0');
export const diaOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(Date.parse(v + 'T12:00:00Z')).toISOString().slice(0, 10) === v;
export const somaDias = (k, n) => new Date(Date.parse(k + 'T12:00:00Z') + n * DIA_MS).toISOString().slice(0, 10);
export const diaDaSemana = (k) => new Date(k + 'T12:00:00Z').getUTCDay();
export const segundaDe = (k) => somaDias(k, -((diaDaSemana(k) + 6) % 7));
// dia (no relógio do aparelho) em que um treino começou: o mesmo critério das telas
export const diaLocal = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// "segunda", "hoje", "amanhã"
export function nomeDoDia(k, hoje) {
  if (k === hoje) return 'hoje';
  if (diaOk(hoje) && k === somaDias(hoje, 1)) return 'amanhã';
  return DIAS[diaDaSemana(k)];
}
// "na próxima segunda" / "no próximo sábado"
export const naProxima = (k) => { const w = diaDaSemana(k); return (w === 0 || w === 6 ? 'no próximo ' : 'na próxima ') + DIAS[w]; };

// ---------- validação ----------
// musculação: { tipo, data, planId, diaId, movs: [{ diaId, de, para }], em } — movs vazio = "Seguir a semana"; o primeiro é o
// treino perdido (de = data); os outros são os treinos que andaram junto. Tudo dentro da semana (segunda a domingo) da
// data, sempre para um dia depois. corrida: { tipo, data, em }.
export function limparPerdido(x) {
  if (!isObj(x) || !TIPOS_PERDIDO.includes(x.tipo) || !diaOk(x.data)) return null;
  const em = iso(x.em);
  if (x.tipo === 'corrida') return { tipo: 'corrida', data: x.data, em };
  const planId = idStr(x.planId), diaId = idStr(x.diaId);
  if (!planId || !diaId) return null;
  const seg = segundaDe(x.data);
  let movs = Array.isArray(x.movs) ? x.movs.slice(0, 7).map((m) => (isObj(m) ? { diaId: idStr(m.diaId), de: diaOk(m.de) ? m.de : '', para: diaOk(m.para) ? m.para : '' } : null)) : [];
  const valido = movs.length > 0 && movs.every((m) => m && m.diaId && m.de && m.para && segundaDe(m.de) === seg && segundaDe(m.para) === seg && m.para > m.de)
    && movs[0].diaId === diaId && movs[0].de === x.data
    && new Set(movs.map((m) => m.de)).size === movs.length && new Set(movs.map((m) => m.para)).size === movs.length;
  if (!valido) movs = [];
  return { tipo: 'musculacao', data: x.data, planId, diaId, movs, em };
}
export function limparPerdidos(raw) {
  if (!Array.isArray(raw)) return [];
  const vistos = new Set(), out = [];
  for (const x of raw.slice(0, MAX_PERDIDOS * 5)) {
    const p = limparPerdido(x);
    if (!p) continue;
    const k = p.tipo + '|' + p.data + '|' + (p.planId || '');
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(p);
  }
  // em ordem de data (e, no mesmo dia, de marcação); ficam as mais recentes
  out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : (a.em || '') < (b.em || '') ? -1 : (a.em || '') > (b.em || '') ? 1 : 0));
  return out.length > MAX_PERDIDOS ? out.slice(-MAX_PERDIDOS) : out;
}

// ---------- semana com as marcas ----------
// Os 7 dias (segunda a domingo) da semana que começa em `segunda`, com o treino de musculação que vale em cada um depois
// das marcas: { data, wd, diaId, veioDe (data de onde o treino veio), foiPara (para onde foi o treino da agenda deste dia),
// perdido: { entrada, diaId, para } | null, corridaPerdida: entrada | null }. As marcas são aplicadas na ordem em que foram
// feitas; marca que não bate mais com o plano (o plano mudou depois) é ignorada; mudança que não bate vira "Seguir a semana".
export function semanaEfetiva(plan, perdidos, segunda) {
  const ok = plan && Array.isArray(plan.dias) && isObj(plan.agenda);
  const existe = (id) => ok && plan.dias.some((d) => d && d.id === id);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const data = somaDias(segunda, i), wd = diaDaSemana(data);
    const id = ok ? plan.agenda[wd] : '';
    return { data, wd, diaId: existe(id) ? id : '', veioDe: '', foiPara: '', perdido: null, corridaPerdida: null };
  });
  const idx = (k) => dias.findIndex((d) => d.data === k);
  const lista = (Array.isArray(perdidos) ? perdidos : []).filter((e) => isObj(e) && diaOk(e.data) && segundaDe(e.data) === segunda);
  for (const e of lista) {
    const i = idx(e.data);
    if (e.tipo === 'corrida') { dias[i].corridaPerdida = e; continue; }
    if (!ok || e.planId !== plan.id || dias[i].perdido || !dias[i].diaId || dias[i].diaId !== e.diaId) continue;
    const antes = dias.map((d) => d.diaId);
    const movs = Array.isArray(e.movs) ? e.movs : [];
    const movOk = movs.length > 0 && movs.every((m) => {
      const a = idx(m.de), b = idx(m.para);
      return a >= 0 && b >= 0 && antes[a] === m.diaId && existe(m.diaId) && !dias[b].perdido && (antes[b] === '' || movs.some((o) => o.de === m.para));
    });
    dias[i].perdido = { entrada: e, diaId: e.diaId, para: movOk ? movs[0].para : '' };
    dias[i].diaId = '';
    if (!movOk) continue;
    for (const m of movs) { const a = idx(m.de); dias[a].diaId = ''; if (m.de !== e.data) dias[a].foiPara = m.para; }
    for (const m of movs) { const b = idx(m.para); dias[b].diaId = m.diaId; dias[b].veioDe = m.de; }
  }
  return dias;
}
export const planoAtivo = (st) => (st && Array.isArray(st.plans) ? st.plans.find((p) => p && p.id === st.activePlan) || null : null);
// O treino de musculação que vale numa data (com as marcas da semana dela): { diaId, veioDe, foiPara, perdido }
export function treinoDoDia(st, data) {
  const plan = planoAtivo(st);
  if (!plan || !diaOk(data)) return null;
  const sem = semanaEfetiva(plan, st.perdidos, segundaDe(data));
  return sem[(diaDaSemana(data) + 6) % 7];
}

// ---------- carga de cada dia ----------
const ESTABILIZA = new Set(['abdomen', 'obliquos', 'lombar', 'antebraco', 'trapezio']);
const G_PERNA = new Set(['quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'adutores']);
// { grupos: { grupo: séries como músculo principal }, pernas: bool } de uma lista de itens (do plano ou de um treino feito)
function cargaDe(itens, series) {
  const grupos = {};
  let pernas = 0;
  for (const it of Array.isArray(itens) ? itens : []) {
    const ex = it && EX_POR_ID.get(it.ex);
    if (!ex || ex.padrao === 'cardio' || ex.registro === 'minutos') continue;
    const n = series(it);
    if (!(n > 0)) continue;
    if (G_PERNA.has(ex.grupo)) pernas++;
    const gs = new Set();
    for (const mu of ex.primarios || []) if (!ESTABILIZA.has(mu) && MUSCULOS[mu]) gs.add(MUSCULOS[mu].grupo);
    for (const g of gs) grupos[g] = (grupos[g] || 0) + n;
  }
  return { grupos, pernas: pernas >= 2 };
}
export const cargaDoTreino = (dia) => cargaDe(dia && dia.itens, (it) => Number(it.series) || 0);
const cargaDaSessao = (s) => cargaDe(s && s.itens, (it) => (Array.isArray(it.sets) ? it.sets.filter((x) => x && x.ok).length : 0));
function juntar(cs) {
  if (!cs.length) return null;
  const grupos = {};
  for (const c of cs) for (const [g, n] of Object.entries(c.grupos)) grupos[g] = (grupos[g] || 0) + n;
  return { grupos, pernas: cs.some((c) => c.pernas) };
}
// o mesmo grupo pesado nos dois dias
export const choca = (a, b) => !!a && !!b && Object.keys(a.grupos).some((g) => a.grupos[g] >= PESADO && (b.grupos[g] || 0) >= PESADO);

// ---------- contexto da semana ----------
function corridaDaSemana(st, hoje, seg) {
  const corre = new Array(9).fill(false), chave = new Array(9).fill(false);
  try {
    for (const [base, desloc] of [[seg, 0], [somaDias(seg, 7), 7]]) {
      const s = planoDaSemanaEm(st, hoje, base);
      if (!s || !Array.isArray(s.dias) || s.foraDoPlano || s.concluido) continue;
      for (let i = 0; i < 7 && desloc + i < 9; i++) {
        const d = s.dias[diaDaSemana(somaDias(base, i))];
        if (!d || d.tipo === 'descanso') continue;
        corre[desloc + i] = true;
        if ((d.tipo === 'longo' && !d.comoRodagem) || d.forte === true || d.intensidade === 'forte') chave[desloc + i] = true;
      }
    }
  } catch { /* sem plano de corrida legível: segue sem as corridas */ }
  const runs = Array.isArray(st.runs) ? st.runs : [];
  for (let i = 0; i < 7; i++) if (runs.some((r) => r && r.data === somaDias(seg, i))) corre[i] = true;
  return { corre, chave };
}
// perfil do Treinador com as condições mais protegidas entre as entrevistas; menor de 18 se QUALQUER entrevista disser
function perfilDe(st, hoje) {
  let pf;
  try { pf = perfil(respostasProtegidas('treinador', st, hoje).respostas); } catch { pf = perfil({}); }
  const idades = [st.trainer, st.run].map((o) => (o && isObj(o.answers) ? o.answers.idade : null)).filter((x) => typeof x === 'number' && Number.isFinite(x));
  return idades.some((x) => x < 18) ? { ...pf, jovem: true } : pf;
}

// ---------- o que fazer com o treino perdido ----------
// Pode marcar "Não treinei" em `data`? Devolve { pode, motivo, diaId, nome }.
export function podeMarcar(st, data, hoje) {
  const plan = planoAtivo(st);
  const nao = (motivo) => ({ pode: false, motivo, diaId: '', nome: '' });
  if (!plan || !diaOk(data) || !diaOk(hoje)) return nao('sem_plano');
  if (data > hoje) return nao('futuro');
  if (segundaDe(data) !== segundaDe(hoje)) return nao('outra_semana');
  const dia = treinoDoDia(st, data);
  if (!dia || dia.perdido) return nao(dia && dia.perdido ? 'marcado' : 'sem_treino');
  if (!dia.diaId) return nao('sem_treino');
  if ((Array.isArray(st.sessions) ? st.sessions : []).some((s) => s && diaLocal(s.inicio) === data)) return nao('treinou');
  if (st.current && data === hoje) return nao('em_andamento');
  if (plan.criadoEm && diaLocal(plan.criadoEm) > data) return nao('antes_do_plano');
  const d = plan.dias.find((x) => x.id === dia.diaId);
  return { pode: true, motivo: '', diaId: dia.diaId, nome: d ? d.nome : 'Treino' };
}

// A proposta para o treino de `data`: { pode, diaId, nome, movs: [{ diaId, de, para }] (vazio = seguir a semana), motivo:
// 'livre' | 'sem_dia' | 'sem_descanso' | 'corrida', titulo, texto }. `hoje` = 'AAAA-MM-DD'.
export function propor(st, data, hoje) {
  const base = podeMarcar(st, data, hoje);
  if (!base.pode) return { ...base, movs: [] };
  const plan = planoAtivo(st);
  const seg = segundaDe(hoje);
  const sem = semanaEfetiva(plan, st.perdidos, seg);
  const datas = sem.map((d) => d.data);
  const i = datas.indexOf(data), iHoje = datas.indexOf(hoje);
  const diaPorId = new Map(plan.dias.map((d) => [d.id, d]));
  const sessoes = (Array.isArray(st.sessions) ? st.sessions : []).filter((s) => s && typeof s.inicio === 'string');
  const feitasEm = (k) => sessoes.filter((s) => diaLocal(s.inicio) === k).map(cargaDaSessao);
  // carga de -1 (domingo anterior) a 7 (segunda seguinte); fixo = o dia não muda (passou, teve treino ou tem marca)
  const carga = new Array(9).fill(null), fixo = new Array(9).fill(true), conteudo = new Array(9).fill('');
  const at = (k) => k + 1;
  carga[at(-1)] = juntar(feitasEm(somaDias(seg, -1)));
  for (let k = 0; k < 7; k++) {
    const feitas = feitasEm(datas[k]);
    if (feitas.length) { carga[at(k)] = juntar(feitas); conteudo[at(k)] = '#feito'; continue; }
    if (k < iHoje || sem[k].perdido || k === i) continue;
    fixo[at(k)] = false;
    if (sem[k].diaId && diaPorId.has(sem[k].diaId)) { carga[at(k)] = cargaDoTreino(diaPorId.get(sem[k].diaId)); conteudo[at(k)] = sem[k].diaId; }
  }
  {
    const prox = somaDias(seg, 7), id = plan.agenda[diaDaSemana(prox)];
    const feitas = feitasEm(prox);
    carga[at(7)] = feitas.length ? juntar(feitas) : diaPorId.has(id) ? cargaDoTreino(diaPorId.get(id)) : null;
  }
  const X = diaPorId.get(base.diaId);
  const cargaX = cargaDoTreino(X);
  const { corre, chave } = corridaDaSemana(st, hoje, seg);
  const combo = (() => { try { return comboAtual(st); } catch { return { foco: '' }; } })();
  const ajusta = combo.foco === 'corrida' || combo.foco === 'equilibrio';
  const pf = perfilDe(st, hoje);
  const novato = pf.nivel === 1, alternado = !!(pf.jovem || pf.diabetes);
  const minDescanso = pf.jovem ? 2 : 1;
  const descansos = (cs) => { let n = 0; for (let k = 0; k < 7; k++) if (!cs[at(k)] && !corre[k]) n++; return n; };
  const antes = carga.slice(); antes[at(i)] = cargaX;
  const descansoAntes = descansos(antes);

  // os dias que podem receber: de hoje (ou de amanhã, se o perdido é o de hoje) até domingo, sem treino feito nem marca,
  // e fora dos dias em que a pessoa não treina (a não ser o treino que já estava lá, que pode ficar)
  const bloq = new Set(diasBloqueados(st));
  const bloqueado = (k) => bloq.has(sem[k].wd);
  const vagas = [];
  for (let k = Math.max(iHoje, i + 1); k < 7; k++) if (!fixo[at(k)] && (!bloqueado(k) || conteudo[at(k)])) vagas.push(k);
  // os treinos que podem andar junto: os que estão nessas vagas
  const elems = [{ diaId: base.diaId, de: i, carga: cargaX }];
  for (const k of vagas) if (conteudo[at(k)]) elems.push({ diaId: conteudo[at(k)], de: k, carga: carga[at(k)] });
  const livres = vagas.filter((k) => !conteudo[at(k)] && !bloqueado(k)).length;

  let melhor = null, melhorCusto = Infinity;
  const motivos = new Set();
  const atual = new Array(elems.length).fill(-1), usada = new Set();
  const avaliar = () => {
    const cs = carga.slice(), mud = new Array(9).fill(false);
    for (let j = 1; j < elems.length; j++) if (atual[j] !== elems[j].de) { cs[at(elems[j].de)] = null; mud[at(elems[j].de)] = true; }
    for (let j = 0; j < elems.length; j++) if (j === 0 || atual[j] !== elems[j].de) { cs[at(atual[j])] = elems[j].carga; mud[at(atual[j])] = true; }
    let erro = '';
    for (let k = -1; k < 7 && !erro; k++) {
      if (!mud[at(k)] && !mud[at(k + 1)]) continue;
      const a = cs[at(k)], b = cs[at(k + 1)];
      if (a && b && (choca(a, b) || alternado)) erro = 'sem_descanso';
    }
    let custo = 0;
    for (let j = 0; j < elems.length && !erro; j++) {
      const s = atual[j];
      if (j > 0 && s === elems[j].de) continue;
      const c = elems[j].carga;
      if (ajusta && c && c.pernas) {
        if (chave[s + 1] || (novato && chave[s + 2])) { erro = 'corrida'; break; }
        if (chave[s]) custo += 3;
      }
      if (corre[s]) custo += 0.5;
    }
    if (!erro && descansos(cs) < Math.min(minDescanso, descansoAntes)) erro = 'sem_descanso';
    if (erro) { motivos.add(erro); return; }
    let movidos = 0, desloc = 0;
    for (let j = 1; j < elems.length; j++) if (atual[j] !== elems[j].de) { movidos++; desloc += atual[j] - elems[j].de; }
    custo += movidos * 100 + atual[0] + desloc * 0.1;
    if (custo < melhorCusto - 1e-9) { melhorCusto = custo; melhor = atual.slice(); }
  };
  const tenta = (j) => {
    if (j === elems.length) { avaliar(); return; }
    for (const k of vagas) {
      if (usada.has(k) || (j > 0 && k < elems[j].de)) continue;
      if (bloqueado(k) && !(j > 0 && k === elems[j].de)) continue; // dia sem treino: só o treino que já era dele
      usada.add(k); atual[j] = k; tenta(j + 1); usada.delete(k);
    }
  };
  if (vagas.length) tenta(0);

  const nomeDe = (id) => (diaPorId.get(id) || {}).nome || 'Treino';
  const out = { pode: true, diaId: base.diaId, nome: base.nome, movs: [], motivo: '', titulo: '', texto: '' };
  if (melhor) {
    out.movs = elems.map((e, j) => ({ diaId: e.diaId, de: datas[e.de], para: datas[melhor[j]] })).filter((m, j) => j === 0 || m.para !== m.de);
    out.motivo = 'livre';
    const para = out.movs[0].para;
    out.titulo = `Passar o ${base.nome} para ${nomeDoDia(para, hoje)}?`;
    const outros = out.movs.slice(1).map((m) => `o ${nomeDe(m.diaId)} vai para ${nomeDoDia(m.para, hoje)}`);
    out.texto = outros.length ? `Para manter o descanso entre os treinos, ${outros.length > 1 ? outros.slice(0, -1).join(', ') + ' e ' + outros[outros.length - 1] : outros[0]}.` : 'Os outros continuam nos dias deles.';
  } else {
    out.motivo = !livres ? 'sem_dia' : motivos.has('sem_descanso') || !motivos.size ? 'sem_descanso' : 'corrida';
    out.titulo = 'Seguir a semana?';
    const por = out.motivo === 'sem_dia' ? 'Não há outro dia livre nesta semana.'
      : out.motivo === 'corrida' ? 'Nos dias livres, o treino de pernas ficaria perto da corrida forte ou do longo.'
        : 'Nenhum dia livre desta semana deixa 48 horas de descanso para os mesmos músculos.';
    out.texto = `${por} O ${base.nome} volta ${naProxima(data)}, no dia de sempre.`;
  }
  return out;
}

// A marca a gravar: 'mover' (a proposta, se houver) ou 'seguir'. `em` = ISO de agora. null se não dá para marcar.
export function novaMarca(st, data, hoje, escolha, em) {
  const p = propor(st, data, hoje);
  if (!p.pode) return null;
  const plan = planoAtivo(st);
  return limparPerdido({ tipo: 'musculacao', data, planId: plan.id, diaId: p.diaId, movs: escolha === 'mover' ? p.movs : [], em });
}

// ---------- corrida ----------
// Pode marcar "Não corri" em `data`? Há corrida prevista, não há corrida registrada nem marca, é hoje ou já passou, nesta semana.
export function podeMarcarCorrida(st, data, hoje) {
  if (!st || !diaOk(data) || !diaOk(hoje) || data > hoje || segundaDe(data) !== segundaDe(hoje)) return false;
  if ((Array.isArray(st.runs) ? st.runs : []).some((r) => r && r.data === data)) return false;
  if ((Array.isArray(st.perdidos) ? st.perdidos : []).some((e) => e && e.tipo === 'corrida' && e.data === data)) return false;
  try {
    const s = planoDaSemanaEm(st, hoje, segundaDe(data));
    const d = s && Array.isArray(s.dias) && !s.foraDoPlano ? s.dias[diaDaSemana(data)] : null;
    return !!d && d.tipo !== 'descanso';
  } catch { return false; }
}
export const marcaCorrida = (data, em) => limparPerdido({ tipo: 'corrida', data, em });
export const corridaPerdidaEm = (st, data) => (Array.isArray(st && st.perdidos) ? st.perdidos.find((e) => e && e.tipo === 'corrida' && e.data === data) || null : null);

// ---------- desfazer ----------
// Tira a marca e, na musculação, as marcas feitas DEPOIS dela na mesma semana e no mesmo plano (elas partiram da semana
// já mudada por esta). Devolve { lista, removidas }.
export function desfazer(perdidos, alvo) {
  const lista = Array.isArray(perdidos) ? perdidos.slice() : [];
  const i = lista.findIndex((e) => e && alvo && e.tipo === alvo.tipo && e.data === alvo.data && (e.planId || '') === (alvo.planId || ''));
  if (i < 0) return { lista, removidas: 0 };
  if (alvo.tipo === 'corrida') { lista.splice(i, 1); return { lista, removidas: 1 }; }
  const seg = segundaDe(alvo.data);
  const depois = (e) => e.tipo === 'musculacao' && e.planId === alvo.planId && segundaDe(e.data) === seg && ((e.em || '') > (alvo.em || '') || ((e.em || '') === (alvo.em || '') && e.data > alvo.data));
  const fica = lista.filter((e, j) => j !== i && !depois(e));
  return { lista: fica, removidas: lista.length - fica.length };
}
// quantas marcas sairiam junto (para avisar antes de desfazer)
export const quantasSaem = (perdidos, alvo) => desfazer(perdidos, alvo).removidas;

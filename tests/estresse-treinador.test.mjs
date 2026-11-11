// Teste de estresse do Treinador: dezenas de milhares de perfis (grade completa + amostragem com semente fixa).
// Cada perfil gera um plano que é conferido contra regras de segurança, dose, tempo, aparelhos e equilíbrio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCICIOS, EX_POR_ID } from '../www/js/data/exercises.js';
import { MUSCULOS } from '../www/js/data/muscles.js';
import { EQUIPAMENTOS } from '../www/js/data/equipment.js';
import { MODELOS } from '../www/js/data/templates.js';
import { REFS } from '../www/js/data/knowledge.js';
import { PERGUNTAS, gerarPlano, perfil, sugerirTrocas, alternativas, volumeSemanal } from '../www/js/logic/trainer.js';
import { seriesPorGrupo, analisar } from '../www/js/logic/insights.js';

// ---------- gerador pseudoaleatório com semente fixa (mulberry32) ----------
function semente(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const um = (r, l) => l[Math.floor(r() * l.length)];
const inteiro = (r, a, b) => a + Math.floor(r() * (b - a + 1));
function varios(r, opcoes, nenhum, max = opcoes.length) {
  const n = r() < 0.45 ? 0 : r() < 0.7 ? 1 : r() < 0.85 ? 2 : inteiro(r, 3, max);
  const pool = opcoes.slice();
  const out = [];
  for (let i = 0; i < Math.min(n, max) && pool.length; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out.length ? out : [nenhum];
}

const op = (k) => PERGUNTAS.find((q) => q.k === k).op.map((o) => o[0]);
const OBJ = op('objetivo'), EXP = op('experiencia'), DIAS = op('dias'), TEMPO = op('tempo'), LOCAL = op('local');
const LIM = op('limitacoes').filter((x) => x !== 'nenhuma');
const COND = op('condicoes').filter((x) => x !== 'nenhuma');
const TRI = op('triagem').filter((x) => x !== 'nenhum');
const FOCO = op('foco').filter((x) => x !== 'equilibrado');
const EQUIP = Object.keys(EQUIPAMENTOS);
const GYM_ALL = { all: true, has: {} };
const base = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };

// ---------- regras conferidas de forma independente da lógica ----------
const CASA = new Set(['halteres', 'banco_reto', 'banco_inclinado', 'colchonete', 'caixa', 'elastico', 'bola_suica']);
const SEM = new Set(['colchonete', 'caixa']);
function temAparelho(ex, local, gym) {
  if (local === 'completa') return true;
  if (local === 'minha') return gym.all || ex.equip.every((e) => gym.has[e]);
  if (local === 'halteres') return ex.equip.every((e) => CASA.has(e));
  return ex.equip.every((e) => SEM.has(e));
}
// duração estimada (mesma conta de views/common.js: 5 min de aquecimento + séries + 1 min de troca por exercício)
function duracaoMin(dia) {
  let seg = 300;
  for (const it of dia.itens) {
    const ex = EX_POR_ID.get(it.ex);
    if (ex && ex.registro === 'minutos') { seg += Number(it.reps) * 60; continue; }
    const trabalho = ex && ex.registro === 'segundos' ? Number(it.reps) || 30 : 40;
    seg += it.series * (trabalho + it.descanso) + 60;
  }
  return seg / 60;
}
// "cerca de 30 min" pode mostrar até 35; "mais de 1 hora" vai até 1h30
const ORCAMENTO = { 30: 35, 45: 50, 60: 65, 75: 90 };
const N_MAX = { 30: 4, 45: 6, 60: 7, 75: 9 };
// movimentos que o Treinador usa para montar treinos de força (os demais — punho, manguito, carregar, potência — só entram à mão)
const MOVIMENTOS = new Set(['agachar', 'afundo', 'dobradica_quadril', 'extensao_quadril', 'flexao_joelho', 'extensao_joelho', 'abducao', 'aducao', 'flexao_plantar',
  'empurrar_horizontal', 'empurrar_vertical', 'puxar_horizontal', 'puxar_vertical', 'aducao_horizontal', 'abducao_horizontal', 'elevacao_lateral', 'extensao_ombro', 'encolhimento',
  'flexao_cotovelo', 'extensao_cotovelo', 'anti_extensao', 'flexao_tronco', 'flexao_quadril', 'rotacao']);
// cardio que pode ser prescrito: nada de HIIT; corrida e corda só para quem já treina e não está em dose conservadora;
// nada de impacto (corrida, corda, polichinelo) para 60+, IMC de 30 ou mais, pressão alta, gestação ou triagem positiva
function cardioPermitido(ex, pf) {
  if (ex.padrao !== 'cardio' || /hiit/.test(ex.id)) return false;
  if (/corrida|pular-corda/.test(ex.id) && (pf.nivel === 1 || pf.conservador)) return false;
  if (/corrida|pular-corda|polichinelo/.test(ex.id) && ((pf.imc != null && pf.imc >= 30) || pf.idoso || pf.pressao || pf.gestante || pf.liberacao)) return false;
  return true;
}
// séries diretas por grupo (o grupo é músculo principal do exercício); trapézio e lombar contam à parte
const grupoDe = (m) => (m === 'trapezio' || m === 'lombar' ? m : m === 'manguito' ? null : MUSCULOS[m].grupo);
function seriesDiretas(dias) {
  const v = {};
  for (const d of dias) for (const it of d.itens) {
    const ex = EX_POR_ID.get(it.ex);
    if (!ex || ex.grupo === 'cardio' || ex.padrao === 'cardio') continue;
    for (const g of new Set(ex.primarios.map(grupoDe).filter(Boolean))) v[g] = (v[g] || 0) + it.series;
  }
  return v;
}
const TETO = { 1: 12, 2: 16, 3: 20 }; // séries diretas por grupo e por semana (Baz-Valle 2022: acima de 20 o ganho extra é pequeno)
const ehCardio = (ex) => ex.grupo === 'cardio' || ex.padrao === 'cardio';
const ehForca = (ex) => !ehCardio(ex) && (ex.registro === 'peso_reps' || ex.registro === 'reps');
const semLixo = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|\[object/.test(s);

class Falhas {
  constructor() { this.m = new Map(); this.n = 0; }
  add(cat, det) { this.n++; const x = this.m.get(cat) || { n: 0, ex: [] }; x.n++; if (x.ex.length < 3) x.ex.push(det); this.m.set(cat, x); }
  texto() { return [...this.m].map(([c, x]) => `${c}: ${x.n}\n    ${x.ex.join('\n    ')}`).join('\n'); }
  confere(titulo) { assert.equal(this.n, 0, `${titulo}: ${this.n} falhas\n${this.texto()}`); }
}

// Confere um plano. Devolve { p, pf } (p = null quando o perfil é bloqueado).
function validar(a, gym, versao, F, rot) {
  let p;
  try { p = gerarPlano(a, gym, versao); } catch (e) { F.add('lançou erro', `${rot}: ${e.message}`); return {}; }
  const pf = perfil(a);
  if (a.idade < 14) { if (p !== null) F.add('menor de 14 sem bloqueio', rot); return { p: null, pf }; }
  if (!p) { F.add('plano não gerado', rot); return {}; }

  const pool = EXERCICIOS.filter((ex) => temAparelho(ex, pf.local, gym) && !ex.cuidado.some((c) => pf.cuidados.includes(c)) && ex.nivel <= Math.max(1, pf.conservador ? Math.min(pf.nivel, 2) : pf.nivel));
  const poolForca = pool.filter((ex) => ex.grupo !== 'cardio' && ex.grupo !== 'funcional' && MOVIMENTOS.has(ex.padrao));
  const poolCardio = pool.filter((ex) => cardioPermitido(ex, pf));
  const textos = [...p.avisos.map((x) => x.texto), ...p.orientacoes.flat()];

  // número de treinos e agenda
  if (p.dias.length > pf.dias) F.add('treinos a mais', `${rot}: ${p.dias.length} > ${pf.dias}`);
  if (p.dias.length < pf.dias) {
    if (poolForca.length >= 1 && poolCardio.length >= 1) F.add('treinos a menos, havendo exercícios', `${rot}: ${p.dias.length} < ${pf.dias}`);
    if (!p.avisos.some((x) => x.tipo !== 'info' || /aeróbic|caminhada/i.test(x.texto))) F.add('treinos a menos sem aviso', rot);
  }
  if (poolForca.length >= 1 && p.dias.length === 0) F.add('plano sem nenhum treino, havendo exercícios', rot);
  if (p.dias.length === 0 && !p.avisos.some((x) => x.tipo === 'danger' || x.tipo === 'warn')) F.add('plano vazio sem aviso', rot);
  const idsDia = new Set(p.dias.map((d) => d.id));
  if (idsDia.size !== p.dias.length) F.add('id de treino repetido', rot);
  const ag = Object.entries(p.agenda);
  if (ag.length !== p.dias.length) F.add('agenda não cobre os treinos', `${rot}: ${ag.length} vs ${p.dias.length}`);
  for (const [wd, id] of ag) if (!(Number(wd) >= 0 && Number(wd) <= 6) || !idsDia.has(id)) F.add('agenda inválida', rot);
  if (new Set(ag.map((x) => x[1])).size !== ag.length) F.add('treino agendado duas vezes', rot);
  if (new Set(p.dias.map((d) => d.nome)).size !== p.dias.length) F.add('nome de treino repetido', `${rot}: ${p.dias.map((d) => d.nome).join(' | ')}`);

  const maxNivel = Math.max(1, pf.conservador ? Math.min(pf.nivel, 2) : pf.nivel);
  const cautela = pf.pressao || pf.gestante || pf.triagem.length > 0;
  for (const d of p.dias) {
    if (!semLixo(d.nome) || !semLixo(d.foco)) F.add('treino sem nome/foco', rot);
    if (d.itens.length === 0) { F.add('treino vazio', `${rot}: ${d.nome}`); continue; }
    const vistos = new Set();
    for (const it of d.itens) {
      const ex = EX_POR_ID.get(it.ex);
      if (!ex) { F.add('exercício inexistente', `${rot}: ${it.ex}`); continue; }
      if (vistos.has(it.ex)) F.add('exercício repetido no treino', `${rot}: ${d.nome} / ${it.ex}`);
      vistos.add(it.ex);
      if (ex.cuidado.some((c) => pf.cuidados.includes(c))) F.add('exercício contraindicado', `${rot}: ${it.ex} (${ex.cuidado.filter((c) => pf.cuidados.includes(c))})`);
      if (ex.nivel > maxNivel) F.add('nível acima da experiência', `${rot}: ${it.ex} n${ex.nivel} > ${maxNivel}`);
      if (!temAparelho(ex, pf.local, gym)) F.add('aparelho indisponível', `${rot}: ${it.ex} (${ex.equip})`);
      if (ex.padrao === 'cardio' && !cardioPermitido(ex, pf)) F.add('cardio não permitido para o perfil', `${rot}: ${it.ex}`);
      if (ex.grupo === 'funcional' && ex.padrao !== 'cardio') F.add('exercício de potência prescrito automaticamente', `${rot}: ${it.ex}`);
      // dose
      if (!Number.isInteger(it.series) || it.series < 1 || it.series > 4) F.add('séries fora de 1–4', `${rot}: ${it.ex} = ${it.series}`);
      if (typeof it.reps !== 'string' || !/^\d{1,3}(-\d{1,3})?$/.test(it.reps)) { F.add('repetições mal formadas', `${rot}: ${it.ex} = ${it.reps}`); continue; }
      const [lo, hi = lo] = it.reps.split('-').map(Number);
      if (lo > hi) F.add('faixa de repetições invertida', `${rot}: ${it.ex} = ${it.reps}`);
      if (!Number.isFinite(it.descanso) || it.descanso < 0 || it.descanso > 180) F.add('descanso fora de 0–180 s', `${rot}: ${it.ex} = ${it.descanso}`);
      if (ex.registro === 'minutos') {
        if (lo < 5 || hi > 45 || it.series !== 1) F.add('cardio fora de 5–45 min', `${rot}: ${it.ex} = ${it.series}×${it.reps}`);
        if ((pf.conservador || pf.nivel === 1) && hi > 30) F.add('cardio longo para iniciante/conservador', `${rot}: ${it.reps} min`);
      } else if (ex.registro === 'segundos') {
        if (lo < 10 || hi > 60) F.add('isometria fora de 10–60 s', `${rot}: ${it.ex} = ${it.reps}`);
        if (it.descanso < 30) F.add('descanso curto demais', `${rot}: ${it.ex} = ${it.descanso}`);
      } else {
        if (lo < 3 || hi > 30) F.add('repetições fora de 3–30', `${rot}: ${it.ex} = ${it.reps}`);
        if (it.descanso < 30) F.add('descanso curto demais', `${rot}: ${it.ex} = ${it.descanso}`);
        if (ehForca(ex)) {
          // doses conservadoras (AHA 2024; ACOG 804; Riebe 2015; NSCA 2019 e 2009; ACSM 2009)
          if (cautela && (lo < 10 || it.series > 3)) F.add('dose pesada com pressão alta/gestação/triagem positiva', `${rot}: ${it.ex} ${it.series}×${it.reps}`);
          if (pf.idoso && (lo < 8 || it.series > 3)) F.add('dose inadequada para 60+', `${rot}: ${it.ex} ${it.series}×${it.reps}`);
          if (pf.jovem && (lo < 10 || it.series > 3)) F.add('dose inadequada para menor de 18', `${rot}: ${it.ex} ${it.series}×${it.reps}`);
          if (pf.nunca && it.series > 3) F.add('séries demais para quem nunca treinou', `${rot}: ${it.ex} ${it.series}`);
          if (pf.nivel === 1 && lo < 8) F.add('carga alta (menos de 8 repetições) para iniciante', `${rot}: ${it.ex} ${it.reps}`);
          // exercício com o peso do corpo (fora barra fixa e paralelas) não tem "carga alta": pelo menos 8 repetições
          if (ex.registro === 'reps' && lo < 8 && !ex.equip.includes('barra_fixa') && !ex.equip.includes('paralelas')) F.add('peso do corpo com menos de 8 repetições', `${rot}: ${it.ex} ${it.reps}`);
        }
      }
    }
    // quantidade de exercícios e tempo
    if (d.itens.length > N_MAX[pf.tempo]) F.add('exercícios demais para o tempo', `${rot}: ${d.nome} = ${d.itens.length}`);
    const min = duracaoMin(d);
    if (min > ORCAMENTO[pf.tempo] + 0.01) F.add(`treino não cabe em ${pf.tempo} min`, `${rot}: ${d.nome} ≈ ${Math.round(min)} min`);
    if (ag.length && min < 8) F.add('treino curto demais (menos de 8 min)', `${rot}: ${d.nome} ≈ ${Math.round(min)} min`);
  }

  // volume semanal
  const vol = volumeSemanal(p.dias);
  try { assert.deepEqual(vol, p.volume); } catch { F.add('volume informado difere do calculado', rot); }
  const teto = TETO[pf.nivel];
  const dir = seriesDiretas(p.dias);
  for (const g of Object.keys(vol)) {
    if (!Number.isFinite(vol[g]) || vol[g] < 0) F.add('volume inválido', `${rot}: ${g} = ${vol[g]}`);
    if ((dir[g] || 0) > teto) F.add(`séries diretas acima do teto do nível ${pf.nivel}`, `${rot}: ${g} = ${dir[g]} > ${teto}`);
    if (vol[g] > teto * 1.5) F.add(`volume total (com meias séries) acima de 1,5× o teto do nível ${pf.nivel}`, `${rot}: ${g} = ${vol[g]} > ${teto * 1.5}`);
    if (vol[g] < (dir[g] || 0)) F.add('volume total menor que as séries diretas', `${rot}: ${g}`);
  }

  // avisos e textos
  for (const t of textos) if (!semLixo(t)) F.add('texto vazio ou com valor inválido', `${rot}: ${t}`);
  for (const av of p.avisos) if (!['danger', 'warn', 'info'].includes(av.tipo)) F.add('tipo de aviso desconhecido', `${rot}: ${av.tipo}`);
  const tem = (tipo, re) => p.avisos.some((x) => (!tipo || x.tipo === tipo) && re.test(x.texto));
  if (pf.liberacao && !tem('danger', /médico/i)) F.add('sem aviso de liberação médica', rot);
  if (!pf.liberacao && tem('danger', /liberação/i) && p.dias.length) F.add('aviso de liberação sem motivo', rot);
  if (pf.gestante && !tem('warn', /gesta/i)) F.add('sem aviso de gestação', rot);
  if (pf.pressao && !tem('warn', /pressão|coração/i)) F.add('sem aviso de pressão alta/coração', rot);
  if (pf.jovem && !tem('', /18 anos/)) F.add('sem aviso para menor de 18', rot);
  if (pf.idoso && !tem('', /60 anos/)) F.add('sem aviso para 60+', rot);
  if (pf.limitacoes.length && !tem('', /limitaç|cuidado para|não encontrei/i)) F.add('sem aviso sobre as limitações', rot);
  if (p.orientacoes.length < 5 || !p.orientacoes.some((o) => o[0] === 'Cardio')) F.add('orientações incompletas', rot);
  if (!(p.revisaoSemanas >= 4 && p.revisaoSemanas <= 12)) F.add('prazo de revisão estranho', `${rot}: ${p.revisaoSemanas}`);
  if (!Array.isArray(p.faltando)) F.add('lista "faltando" ausente', rot);
  return { p, pf, vol, dir, poolForca, poolCardio };
}

function perfilAleatorio(r) {
  const idade = r() < 0.06 ? inteiro(r, 10, 13) : r() < 0.25 ? um(r, [14, 15, 17, 18, 59, 60, 61, 99]) : inteiro(r, 14, 99);
  const peso = r() < 0.15 ? um(r, [30, 30.5, 249.5, 250]) : Math.round((30 + r() * 220) * 2) / 2;
  const altura = r() < 0.15 ? um(r, [120, 121, 219, 220]) : inteiro(r, 120, 220);
  const a = {
    objetivo: um(r, OBJ), idade, peso, altura, experiencia: um(r, EXP), dias: um(r, DIAS), tempo: um(r, TEMPO), local: um(r, LOCAL),
    limitacoes: varios(r, LIM, 'nenhuma'), condicoes: varios(r, COND, 'nenhuma'), triagem: varios(r, TRI, 'nenhum'), foco: varios(r, FOCO, 'equilibrado', 2),
  };
  let gym = GYM_ALL;
  if (a.local === 'minha') {
    const dens = um(r, [0, 0.05, 0.15, 0.3, 0.6, 0.9, 1]);
    gym = { all: r() < 0.05, has: {} };
    for (const e of EQUIP) if (r() < dens) gym.has[e] = true;
  }
  return { a, gym, versao: inteiro(r, 0, 6) };
}
const rotulo = (a, gym, v) => JSON.stringify({ ...a, gym: a.local === 'minha' ? (gym.all ? 'tudo' : Object.keys(gym.has).length + ' aparelhos') : undefined, v });

let TOTAL = 0;

test('estresse: todas as perguntas têm cada opção coberta pelos geradores', () => {
  assert.deepEqual([OBJ.length, EXP.length, DIAS.length, TEMPO.length, LOCAL.length, LIM.length, COND.length, TRI.length, FOCO.length], [5, 4, 5, 4, 4, 8, 5, 5, 7]);
});

test('estresse: grade completa objetivo × nível × dias × tempo × local × faixa de idade (4.800 perfis)', () => {
  const F = new Falhas();
  let n = 0;
  const poucos = { all: false, has: { halteres: true, banco_reto: true, puxador: true, leg_press_45: true, colchonete: true, esteira: true } };
  for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) for (const local of LOCAL) for (const idade of [16, 30, 70]) {
    const a = { ...base, objetivo, experiencia, dias, tempo, local, idade };
    const gym = local === 'minha' ? poucos : GYM_ALL;
    const { p, pf } = validar(a, gym, 0, F, rotulo(a, gym, 0));
    n++;
    if (!p) continue;
    // sem limitações, nenhum treino pode sair incompleto na academia completa
    if (local === 'completa') {
      if (p.dias.length !== pf.dias) F.add('academia completa com treinos a menos', rotulo(a, gym, 0));
      if (p.faltando.length) F.add('academia completa com treino incompleto', rotulo(a, gym, 0));
      for (const d of p.dias) if (d.itens.length < 3) F.add('academia completa com menos de 3 exercícios', `${rotulo(a, gym, 0)}: ${d.nome}`);
    }
  }
  TOTAL += n;
  assert.equal(n, 4800);
  F.confere('grade completa');
});

test('estresse: 10.000 perfis aleatórios (idades 10–99, pesos e alturas extremos, limitações, condições, triagem, foco, aparelhos sorteados)', () => {
  const F = new Falhas();
  const r = semente(20261111);
  const visto = { objetivo: new Set(), experiencia: new Set(), dias: new Set(), tempo: new Set(), local: new Set(), limitacoes: new Set(), condicoes: new Set(), triagem: new Set(), foco: new Set() };
  let bloqueados = 0, vazios = 0, gymVazia = 0;
  const N = 10000;
  for (let i = 0; i < N; i++) {
    const { a, gym, versao } = perfilAleatorio(r);
    for (const k of Object.keys(visto)) for (const v of [].concat(a[k])) visto[k].add(v);
    if (a.local === 'minha' && !gym.all && Object.keys(gym.has).length === 0) gymVazia++;
    const { p } = validar(a, gym, versao, F, rotulo(a, gym, versao));
    if (a.idade < 14) bloqueados++;
    else if (p && p.dias.length === 0) vazios++;
  }
  TOTAL += N;
  for (const k of Object.keys(visto)) assert.equal(visto[k].size, PERGUNTAS.find((q) => q.k === k).op.length, 'opção não sorteada em ' + k);
  assert.ok(bloqueados > 300, 'faltaram perfis de menores de 14');
  assert.ok(gymVazia > 50, 'faltaram academias vazias');
  assert.ok(vazios < N * 0.02, `planos sem nenhum treino demais: ${vazios}`);
  F.confere('perfis aleatórios');
});

test('estresse: todas as limitações isoladas e em pares, em todos os locais e níveis (sem exercício contraindicado e sem treino vazio na academia completa)', () => {
  const F = new Falhas();
  let n = 0;
  const combos = [];
  for (let i = 0; i < LIM.length; i++) { combos.push([LIM[i]]); for (let j = i + 1; j < LIM.length; j++) combos.push([LIM[i], LIM[j]]); }
  combos.push(LIM.slice());
  for (const limitacoes of combos) for (const experiencia of EXP) for (const dias of ['2', '3', '5', '6']) for (const local of LOCAL) for (const condicoes of [['nenhuma'], [combos.indexOf(limitacoes) % 2 ? 'hipertensao' : 'gestante']]) {
    const a = { ...base, experiencia, dias, local, limitacoes, condicoes, objetivo: OBJ[n % 5], tempo: TEMPO[n % 4] };
    const { p, pf } = validar(a, GYM_ALL, n % 3, F, rotulo(a, GYM_ALL, n % 3));
    n++;
    if (p && local === 'completa' && limitacoes.length <= 2) {
      if (p.dias.length !== pf.dias) F.add('limitação derrubou um treino na academia completa', rotulo(a, GYM_ALL, 0));
      for (const d of p.dias) if (d.itens.length < 2) F.add('limitação deixou treino com menos de 2 exercícios na academia completa', `${rotulo(a, GYM_ALL, 0)}: ${d.nome}`);
    }
  }
  TOTAL += n;
  assert.ok(n > 4500);
  F.confere('limitações');
});

// ---------- como o objetivo, o nível e o foco mudam o plano ----------
const medidas = (p) => {
  const itens = p.dias.flatMap((d) => d.itens.map((it) => ({ ...it, e: EX_POR_ID.get(it.ex) })));
  const forca = itens.filter((it) => ehForca(it.e) && it.e.grupo !== 'abdomen');
  const lo = (it) => Number(it.reps.split('-')[0]);
  const hi = (it) => Number(it.reps.split('-').pop());
  const cardio = itens.filter((it) => ehCardio(it.e));
  return {
    itens, forca, cardio,
    principais: p.dias.filter((d) => !ehCardio(EX_POR_ID.get(d.itens[0].ex))).map((d) => d.itens[0]),
    minLo: Math.min(...forca.map(lo)), maxHi: Math.max(...forca.map(hi)),
    maxDesc: Math.max(...forca.map((it) => it.descanso)), minDesc: Math.min(...forca.map((it) => it.descanso)),
    maxSeries: Math.max(...forca.map((it) => it.series)),
    series: forca.reduce((s, it) => s + it.series, 0),
    minCardio: cardio.filter((it) => it.e.registro === 'minutos').reduce((s, it) => s + Number(it.reps), 0),
    diasCardio: p.dias.filter((d) => ehCardio(EX_POR_ID.get(d.itens[0].ex))).length,
    assinatura: JSON.stringify(p.dias.map((d) => d.itens.map((it) => [it.ex, it.series, it.reps, it.descanso]))),
    lo, hi,
  };
};

test('objetivo: cada objetivo produz um plano diferente e coerente com a literatura (repetições, descanso, volume e cardio)', () => {
  const F = new Falhas();
  let n = 0;
  for (const experiencia of ['iniciante', 'intermediario', 'avancado']) for (const dias of DIAS) for (const tempo of TEMPO) {
    const m = {};
    const rot = `${experiencia}/${dias}d/${tempo}min`;
    for (const objetivo of OBJ) { m[objetivo] = medidas(gerarPlano({ ...base, objetivo, experiencia, dias, tempo }, GYM_ALL, 0)); n++; }
    const nivel = experiencia === 'iniciante' ? 1 : experiencia === 'intermediario' ? 2 : 3;
    // os cinco planos são diferentes entre si
    const ass = new Set(OBJ.map((o) => m[o].assinatura));
    if (ass.size !== 5) F.add('dois objetivos geraram o mesmo plano', `${rot}: ${ass.size} planos distintos`);

    // FORÇA: cargas altas (poucas repetições) e descanso longo nos principais (ACSM 2009; Schoenfeld 2021; Grgic 2018)
    for (const it of m.forca.principais) {
      if (nivel >= 2 && (m.forca.hi(it) > 6 || it.descanso < 120)) F.add('força: principal sem carga alta/descanso longo', `${rot}: ${it.ex} ${it.series}×${it.reps} desc ${it.descanso}`);
      if (nivel === 1 && (m.forca.lo(it) < 8 || m.forca.hi(it) > 12)) F.add('força iniciante: fora de 8–12 repetições', `${rot}: ${it.ex} ${it.reps}`);
    }
    // os auxiliares nunca pedem menos repetições que os principais
    if (m.forca.principais.length && m.forca.minLo < Math.min(...m.forca.principais.map(m.forca.lo))) F.add('força: auxiliar mais pesado que o principal', rot);
    // HIPERTROFIA: 6–15 repetições, descanso de 1 a 3 min, maior volume semanal (Schoenfeld 2017 e 2021; Singer 2024)
    if (m.hipertrofia.minLo < 6 || m.hipertrofia.maxHi > 15) F.add('hipertrofia: repetições fora de 6–15', `${rot}: ${m.hipertrofia.minLo}–${m.hipertrofia.maxHi}`);
    if (m.hipertrofia.minDesc < 45 || m.hipertrofia.maxDesc > 180) F.add('hipertrofia: descanso fora de 45–180 s', `${rot}: ${m.hipertrofia.minDesc}–${m.hipertrofia.maxDesc}`);
    for (const o of ['saude', 'emagrecimento', 'resistencia']) if (m.hipertrofia.series < m[o].series) F.add(`hipertrofia com menos séries que ${o}`, `${rot}: ${m.hipertrofia.series} < ${m[o].series}`);
    // RESISTÊNCIA: muitas repetições e descanso curto (ACSM 2009: 15 ou mais repetições, até 1 min)
    if (m.resistencia.minLo < 12 || m.resistencia.maxDesc > 75) F.add('resistência: poucas repetições ou descanso longo', `${rot}: lo ${m.resistencia.minLo}, desc ${m.resistencia.maxDesc}`);
    // SAÚDE: dose mínima eficaz, 1 a 3 séries de 8–15 (OMS 2020; ACSM 2009)
    if (m.saude.maxSeries > 3 || m.saude.minLo < 8 || m.saude.maxHi > 15) F.add('saúde: dose fora de 1–3 séries de 8–15', `${rot}: ${m.saude.maxSeries} séries, ${m.saude.minLo}–${m.saude.maxHi}`);
    // EMAGRECIMENTO: repetições moderadas a altas, descanso curto a moderado (Donnelly 2009)
    if (m.emagrecimento.minLo < 10 || m.emagrecimento.maxDesc > 90) F.add('emagrecimento: repetições baixas ou descanso longo', `${rot}: lo ${m.emagrecimento.minLo}, desc ${m.emagrecimento.maxDesc}`);
    // ordem das cargas: força < hipertrofia <= emagrecimento/saúde < resistência (repetições do exercício principal)
    const loP = (o) => m[o].lo(m[o].principais[0]);
    if (nivel >= 2 && !(loP('forca') < loP('hipertrofia') && loP('hipertrofia') <= loP('emagrecimento') && loP('emagrecimento') < loP('resistencia'))) F.add('ordem das repetições entre objetivos', `${rot}: ${OBJ.map((o) => o + '=' + m[o].principais[0].reps).join(' ')}`);
    // descanso: força > hipertrofia > resistência
    const dP = (o) => m[o].principais[0].descanso;
    if (nivel >= 2 && !((tempo === '30' ? dP('forca') >= dP('hipertrofia') : dP('forca') > dP('hipertrofia')) && dP('hipertrofia') > dP('resistencia'))) F.add('ordem dos descansos entre objetivos', `${rot}: ${OBJ.map((o) => o + '=' + dP(o)).join(' ')}`);

    // CARDIO dentro do plano: emagrecimento, saúde e resistência sempre que há tempo (45 min ou mais) ou 5+ dias
    for (const o of ['emagrecimento', 'saude', 'resistencia']) {
      if ((Number(tempo) >= 45 || Number(dias) >= 5) && m[o].minCardio < 10) F.add(`${o}: plano sem cardio`, `${rot}: ${m[o].minCardio} min`);
      if (Number(dias) >= 5 && m[o].diasCardio < 1) F.add(`${o}: 5+ dias sem um dia de cardio`, rot);
      if (m[o].minCardio < m.hipertrofia.minCardio || m[o].minCardio < m.forca.minCardio) F.add(`${o}: menos cardio que hipertrofia/força`, `${rot}: ${m[o].minCardio} vs ${m.hipertrofia.minCardio}/${m.forca.minCardio}`);
    }
    // hipertrofia e força: quem já treina não recebe cardio no lugar da musculação
    for (const o of ['hipertrofia', 'forca']) if (nivel >= 2 && m[o].cardio.length) F.add(`${o}: cardio dentro do plano de quem já treina`, `${rot}: ${m[o].cardio.map((it) => it.ex)}`);
    // iniciantes: no máximo 4 treinos de força por semana em qualquer objetivo (ACSM 2009)
    for (const o of OBJ) if (nivel === 1 && Number(dias) - m[o].diasCardio > 4) F.add('iniciante com mais de 4 treinos de força', `${rot}/${o}`);
    // quem já treina e busca massa ou força usa todos os dias para a musculação
    for (const o of ['hipertrofia', 'forca']) if (nivel >= 2 && m[o].diasCardio) F.add(`${o}: dia de cardio no lugar da musculação`, rot);
  }
  TOTAL += n;
  // o texto sobre cardio acompanha o objetivo
  for (const objetivo of OBJ) {
    const p = gerarPlano({ ...base, objetivo }, GYM_ALL, 0);
    const txt = p.orientacoes.find((o) => o[0] === 'Cardio')[1];
    if (['emagrecimento', 'saude'].includes(objetivo)) assert.match(txt, /150/, 'orientação de cardio sem a meta da OMS: ' + objetivo);
    assert.ok(new Set(OBJ.map((o) => gerarPlano({ ...base, objetivo: o }, GYM_ALL, 0).orientacoes.find((x) => x[0] === 'Cardio')[1])).size === 5, 'texto de cardio igual para objetivos diferentes');
  }
  F.confere('objetivo');
});

test('objetivo: hipertrofia chega a 10+ séries semanais nos grupos grandes quando há tempo; todos os objetivos garantem o mínimo eficaz', () => {
  const F = new Falhas();
  for (const experiencia of ['intermediario', 'avancado']) for (const dias of ['3', '4', '5', '6']) for (const tempo of ['60', '75']) {
    const p = gerarPlano({ ...base, experiencia, dias, tempo }, GYM_ALL, 0);
    TOTAL++;
    for (const g of ['peito', 'costas', 'quadriceps', 'posteriores']) if (p.volume[g] < 9) F.add('hipertrofia abaixo de ~10 séries semanais', `${experiencia}/${dias}d/${tempo}min: ${g} = ${p.volume[g]}`); // Schoenfeld 2017
  }
  for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of ['45', '60', '75']) {
    const p = gerarPlano({ ...base, objetivo, experiencia, dias, tempo }, GYM_ALL, 0);
    TOTAL++;
    for (const g of ['peito', 'costas', 'quadriceps', 'posteriores', 'ombros', 'gluteos']) if (p.volume[g] < 4) F.add('grupo principal abaixo de 4 séries semanais', `${objetivo}/${experiencia}/${dias}d/${tempo}min: ${g} = ${p.volume[g]}`); // Iversen 2021
  }
  F.confere('volume por objetivo');
});

test('nível: iniciante, intermediário e avançado mudam exercícios, divisão, séries e prazo de revisão', () => {
  const F = new Falhas();
  for (const objetivo of OBJ) for (const dias of DIAS) for (const tempo of TEMPO) {
    const rot = `${objetivo}/${dias}d/${tempo}min`;
    const pl = Object.fromEntries(EXP.map((experiencia) => [experiencia, gerarPlano({ ...base, objetivo, experiencia, dias, tempo }, GYM_ALL, 0)]));
    TOTAL += 4;
    const ex = (p) => p.dias.flatMap((d) => d.itens.map((it) => EX_POR_ID.get(it.ex)));
    // quem nunca treinou: 1–3 séries, só exercícios simples, máquinas e cabos primeiro
    for (const it of pl.nunca.dias.flatMap((d) => d.itens)) if (it.series > 3) F.add('nunca treinou: mais de 3 séries', rot);
    for (const e of [...ex(pl.nunca), ...ex(pl.iniciante)]) {
      if (e.nivel > 1) F.add('iniciante com exercício de nível 2+', `${rot}: ${e.id}`);
      if (e.modalidade === 'barra' && e.tipo === 'composto') F.add('iniciante com composto de barra livre', `${rot}: ${e.id}`);
    }
    if (ex(pl.intermediario).some((e) => e.nivel > 2)) F.add('intermediário com exercício avançado', rot);
    const s = (p) => p.dias.flatMap((d) => d.itens).filter((it) => ehForca(EX_POR_ID.get(it.ex))).reduce((t, it) => t + it.series, 0);
    if (s(pl.nunca) > s(pl.iniciante)) F.add('quem nunca treinou com mais séries que o iniciante', `${rot}: ${s(pl.nunca)} > ${s(pl.iniciante)}`);
    if (objetivo === 'hipertrofia' && s(pl.iniciante) > s(pl.avancado) && Number(dias) >= 4) F.add('iniciante com mais séries que o avançado', `${rot}: ${s(pl.iniciante)} > ${s(pl.avancado)}`);
    // principais de quem já treina: pesos livres compostos
    if (['hipertrofia', 'forca'].includes(objetivo)) {
      const p0 = EX_POR_ID.get(pl.avancado.dias[0].itens[0].ex);
      if (p0.tipo !== 'composto' || !['barra', 'halteres'].includes(p0.modalidade)) F.add('avançado sem composto livre como principal', `${rot}: ${p0.id}`);
    }
    assert.equal(pl.nunca.revisaoSemanas, 8); assert.equal(pl.iniciante.revisaoSemanas, 8);
    assert.equal(pl.intermediario.revisaoSemanas, 6); assert.equal(pl.avancado.revisaoSemanas, 6);
    // os planos de iniciante e de avançado não podem ser iguais
    const sig = (p) => JSON.stringify(p.dias.map((d) => d.itens.map((it) => [it.ex, it.series, it.reps])));
    if (sig(pl.iniciante) === sig(pl.avancado) || sig(pl.iniciante) === sig(pl.intermediario)) F.add('nível não mudou o plano', rot);
  }
  F.confere('nível');
});

test('foco: a parte do corpo escolhida ganha séries e o treino continua equilibrado e dentro do tempo', () => {
  const F = new Falhas();
  const GRUPOS_FOCO = { gluteos: ['gluteos'], pernas: ['quadriceps', 'posteriores'], peito: ['peito'], costas: ['costas'], ombros: ['ombros'], bracos: ['biceps', 'triceps'], abdomen: ['abdomen'] };
  const soma = (v, gs) => gs.reduce((t, g) => t + v[g], 0);
  for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) {
    const a0 = { ...base, objetivo, experiencia, dias, tempo };
    const sem = gerarPlano(a0, GYM_ALL, 0);
    for (const foco of FOCO) {
      const rot = `${foco}/${objetivo}/${experiencia}/${dias}d/${tempo}min`;
      const { p, pf, dir } = validar({ ...a0, foco: [foco] }, GYM_ALL, 0, F, rot);
      TOTAL++;
      const antes = soma(sem.volume, GRUPOS_FOCO[foco]), depois = soma(p.volume, GRUPOS_FOCO[foco]);
      // o foco só deixa de somar séries quando o grupo já está no teto do nível
      const noTeto = GRUPOS_FOCO[foco].some((g) => (dir[g] || 0) >= TETO[pf.nivel] - 1 || p.volume[g] >= TETO[pf.nivel] * 1.5 - 1);
      if (depois < antes && !noTeto) F.add('foco reduziu o volume do grupo', `${rot}: ${antes} → ${depois}`);
      if (Number(tempo) >= 45 && depois <= antes && !noTeto) F.add('foco não aumentou o volume (45 min ou mais)', `${rot}: ${antes} → ${depois}`);
      // "o treino continua equilibrado": nenhum grupo grande some por causa do foco
      for (const g of ['peito', 'costas', 'quadriceps', 'posteriores']) if (sem.volume[g] >= 4 && p.volume[g] < 3) F.add('foco zerou outro grupo grande', `${rot}: ${g} ${sem.volume[g]} → ${p.volume[g]}`);
    }
    // dois focos ao mesmo tempo
    const r = semente(Number(dias) * 100 + Number(tempo));
    const f2 = [um(r, FOCO)]; f2.push(um(r, FOCO.filter((x) => x !== f2[0])));
    validar({ ...a0, foco: f2 }, GYM_ALL, 0, F, `${f2.join('+')}/${objetivo}/${experiencia}/${dias}d/${tempo}min`);
    TOTAL++;
  }
  F.confere('foco');
});

test('equilíbrio: quem segue o plano à risca não recebe alerta de desequilíbrio do próprio aplicativo', () => {
  const F = new Falhas();
  const AGORA = Date.parse('2026-11-10T18:00:00.000Z');
  for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) {
    const rot = `${objetivo}/${experiencia}/${dias}d/${tempo}min`;
    const p = gerarPlano({ ...base, objetivo, experiencia, dias, tempo }, GYM_ALL, 0);
    TOTAL++;
    const st = { plans: [], activePlan: '', trainer: { answers: {} }, nutri: { answers: {} }, body: [], sessions: p.dias.map((d, i) => ({ id: 's' + i, inicio: new Date(AGORA - 3600000).toISOString(), fim: new Date(AGORA).toISOString(), itens: d.itens.map((it) => ({ ex: it.ex, sets: Array.from({ length: it.series }, () => ({ kg: 10, reps: 10, seg: 30, ok: true })) })) })) };
    const sg = seriesPorGrupo(st, AGORA, 7);
    const g = sg.porGrupo;
    // a tela Evolução faz a mesma conta do Treinador
    for (const k of Object.keys(g)) if (g[k] !== p.volume[k]) F.add('Evolução e Treinador contam séries de formas diferentes', `${rot}: ${k} ${g[k]} vs ${p.volume[k]}`);
    if (g.peito >= 6 && g.costas < g.peito * 0.67) F.add('empurra mais do que puxa (Kolber 2010)', `${rot}: peito ${g.peito}, costas ${g.costas}`);
    if (g.costas >= 6 && g.peito < g.costas * 0.5) F.add('peito abaixo da metade das costas', `${rot}: peito ${g.peito}, costas ${g.costas}`);
    if (g.quadriceps >= 6 && g.posteriores + g.gluteos * 0.5 < g.quadriceps * 0.5) F.add('frente da coxa muito acima da parte de trás', `${rot}: quadríceps ${g.quadriceps}, posteriores ${g.posteriores}, glúteos ${g.gluteos}`);
    if (g.posteriores < g.quadriceps * 0.4) F.add('posteriores abaixo de 40% do quadríceps', `${rot}: quadríceps ${g.quadriceps}, posteriores ${g.posteriores}`);
    for (const k of Object.keys(sg.diretas)) if (sg.diretas[k] > 22) F.add('grupo acima de 22 séries diretas por semana', `${rot}: ${k} = ${sg.diretas[k]}`);
    st.trainer.answers = { objetivo, experiencia, dias };
    const ruins = analisar(st, AGORA).dicas.map((x) => x.id).filter((x) => x === 'empurra-puxa' || x === 'frente-tras' || x.startsWith('muito-') || x === 'descanso');
    if (ruins.length) F.add('plano do Treinador dispara alerta da tela Evolução', `${rot}: ${ruins}`);
  }
  F.confere('equilíbrio');
});

test('populações especiais: 60+, 14–17, gestantes, pressão alta, coração e triagem positiva recebem dose conservadora e os avisos certos', () => {
  const F = new Falhas();
  const casos = [
    ['idoso', { idade: 60 }], ['idoso 99', { idade: 99 }], ['jovem 14', { idade: 14 }], ['jovem 17', { idade: 17 }],
    ['gestante', { condicoes: ['gestante'] }], ['hipertensão', { condicoes: ['hipertensao'] }], ['coração', { condicoes: ['cardiaco'] }],
    ...TRI.map((t) => ['triagem ' + t, { triagem: [t] }]),
    ['gestante + hipertensão 17 anos', { idade: 17, condicoes: ['gestante', 'hipertensao'] }], ['tudo 80 anos', { idade: 80, condicoes: COND.filter((c) => c !== 'gestante'), triagem: TRI }],
  ];
  for (const [nome, extra] of casos) for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const [tempo, local] of [['30', 'completa'], ['45', 'halteres'], ['60', 'completa'], ['75', 'halteres']]) {
    const a = { ...base, objetivo, experiencia, dias, tempo, local, ...extra };
    const rot = `${nome}/${objetivo}/${experiencia}/${dias}d/${tempo}min/${local}`;
    const { p, pf } = validar(a, GYM_ALL, 0, F, rot);
    TOTAL++;
    if (!p) continue;
    if (!pf.conservador) F.add('perfil deveria ser conservador', rot);
    const m = p.dias.length ? medidas(p) : null;
    if (m && m.forca.length) {
      // ninguém destes grupos treina com cargas máximas nem com 4 séries
      if (m.minLo < 8) F.add('população especial com menos de 8 repetições', `${rot}: ${m.minLo}`);
      if (m.maxSeries > 3) F.add('população especial com 4 séries', rot);
    }
    for (const it of (m ? m.itens : [])) {
      if (/corrida|pular-corda|hiit/.test(it.ex)) F.add('população especial com cardio de impacto/alta intensidade', `${rot}: ${it.ex}`);
      if (it.e.nivel > 2) F.add('população especial com exercício avançado', `${rot}: ${it.ex}`);
    }
    if ((extra.condicoes || []).includes('gestante')) {
      // ACOG 804: nada deitada de costas ou de bruços, sem impacto; intensidade moderada
      for (const it of m ? m.itens : []) if (it.e.cuidado.includes('gestante')) F.add('gestante com exercício contraindicado', `${rot}: ${it.ex}`);
      if (m && m.forca.length && m.maxHi < 12) F.add('gestante com faixa de repetições de carga alta', `${rot}: até ${m.maxHi}`);
    }
    // adolescentes: 2 a 4 treinos de força por semana (Faigenbaum 2009)
    if (pf.jovem && m && p.dias.length - m.diasCardio > 4) F.add('menor de 18 com mais de 4 treinos de força', rot);
    if (pf.liberacao !== p.avisos.some((x) => x.tipo === 'danger' && /liberação/.test(x.texto))) F.add('liberação médica inconsistente', rot);
  }
  // quem pede liberação: triagem positiva, coração, gestação, e sedentário com doença crônica (Riebe 2015)
  assert.ok(perfil({ ...base, experiencia: 'nunca', condicoes: ['diabetes'] }).liberacao);
  assert.ok(perfil({ ...base, experiencia: 'nunca', condicoes: ['cronica'] }).liberacao);
  assert.ok(perfil({ ...base, experiencia: 'nunca', condicoes: ['hipertensao'] }).liberacao);
  assert.ok(!perfil({ ...base, experiencia: 'avancado', condicoes: ['diabetes'] }).liberacao);
  assert.ok(!perfil({ ...base, experiencia: 'nunca' }).liberacao);
  // menores de 14: sempre bloqueado, em qualquer combinação
  for (let idade = 10; idade <= 13; idade++) for (const objetivo of OBJ) for (const local of LOCAL) { assert.equal(gerarPlano({ ...base, idade, objetivo, local }, GYM_ALL, 0), null); assert.ok(perfil({ ...base, idade }).bloqueado); TOTAL++; }
  assert.ok(gerarPlano({ ...base, idade: 14 }, GYM_ALL, 0));
  // IMC alto: aviso de baixo impacto e nada de corrida ou corda no plano
  for (const experiencia of EXP) for (const objetivo of OBJ) for (const dias of ['5', '6']) {
    const p = gerarPlano({ ...base, peso: 120, altura: 170, experiencia, objetivo, dias }, GYM_ALL, 0);
    TOTAL++;
    assert.ok(p.avisos.some((x) => /baixo impacto/.test(x.texto)));
    for (const d of p.dias) for (const it of d.itens) if (/corrida|pular-corda|polichinelo/.test(it.ex)) F.add('IMC 30+ com cardio de impacto', `${experiencia}/${objetivo}/${dias}: ${it.ex}`);
  }
  F.confere('populações especiais');
});

test('outra versão: versões 1, 2, 3… são válidas, diferentes entre si e mantêm os exercícios principais', () => {
  const F = new Falhas();
  for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) {
    const a = { ...base, objetivo, experiencia, dias, tempo };
    const rot = `${objetivo}/${experiencia}/${dias}d/${tempo}min`;
    const vs = [0, 1, 2, 3, 4, 5].map((v) => validar(a, GYM_ALL, v, F, rot + '/v' + v).p);
    TOTAL += 6;
    const ids = (p) => p.dias.map((d) => d.itens.map((i) => i.ex).join(','));
    const chave = (p) => ids(p).join('|');
    for (let v = 1; v < vs.length; v++) {
      if (chave(vs[v]) === chave(vs[v - 1])) F.add('versão igual à anterior', `${rot}: v${v - 1} = v${v}`);
      // "outra versão" mexe só nos exercícios: mesma estrutura de dias e mesmo exercício principal em cada treino de força
      if (vs[v].dias.length !== vs[0].dias.length) F.add('versão mudou o número de treinos', rot);
      vs[v].dias.forEach((d, i) => { const e0 = EX_POR_ID.get(vs[0].dias[i].itens[0].ex); if (!ehCardio(e0) && d.itens[0].ex !== e0.id) F.add('versão trocou o exercício principal', `${rot}: v${v} ${d.nome}`); });
      // uma parte dos exercícios muda, mas não tudo: de 10% a 80% dos exercícios diferem
      const conj = (p) => p.dias.map((d) => d.itens.map((i) => i.ex).sort().join(','));
      const c0 = conj(vs[v - 1]), c1 = conj(vs[v]);
      if (!c1.some((x, i) => x !== c0[i])) F.add('versão só mudou a ordem dos exercícios', `${rot}: v${v}`);
    }
    if (new Set(vs.slice(0, 3).map(chave)).size !== 3) F.add('as três primeiras versões não são todas diferentes', rot);
  }
  // versão com valores estranhos não quebra
  for (const v of [-1, 1.5, 1e9, NaN, undefined, null, '2']) assert.ok(gerarPlano(base, GYM_ALL, v).dias.length === 4, 'versão ' + v);
  F.confere('outra versão');
});

test('sugerir trocas: só equivalentes permitidos, disponíveis, do mesmo movimento, e nunca piora uma limitação (2.000 planos)', () => {
  const F = new Falhas();
  const r = semente(77);
  let nTrocas = 0, comTroca = 0;
  for (let i = 0; i < 2000; i++) {
    const { a, gym, versao } = perfilAleatorio(r);
    if (a.idade < 14) a.idade = 14 + (i % 60);
    const rot = rotulo(a, gym, versao);
    const p = gerarPlano(a, gym, versao);
    TOTAL++;
    // metade das vezes, a pessoa passou a ter uma limitação DEPOIS de montar o plano
    const a2 = i % 2 ? a : { ...a, limitacoes: [um(r, LIM), um(r, LIM)], condicoes: r() < 0.3 ? ['hipertensao'] : a.condicoes };
    const pf = perfil(a2);
    let trocas;
    try { trocas = sugerirTrocas({ dias: p.dias }, a2, gym); } catch (e) { F.add('sugerirTrocas lançou erro', `${rot}: ${e.message}`); continue; }
    if (trocas.length) comTroca++;
    const noPlano = new Set(p.dias.flatMap((d) => d.itens.map((x) => x.ex)));
    const porDia = {};
    const para = new Set();
    for (const t of trocas) {
      nTrocas++;
      const de = EX_POR_ID.get(t.de), pa = EX_POR_ID.get(t.para);
      const dia = p.dias.find((d) => d.id === t.diaId);
      if (!de || !pa || !dia || !dia.itens[t.idx] || dia.itens[t.idx].ex !== t.de) { F.add('troca aponta para item errado', rot); continue; }
      if (dia.nome !== t.dia) F.add('troca com nome de treino errado', rot);
      if (pa.padrao !== de.padrao) F.add('troca por movimento diferente', `${rot}: ${t.de} → ${t.para}`);
      const g = (e) => (MUSCULOS[e.primarios[0]] || {}).grupo;
      if (g(pa) !== g(de)) F.add('troca por outro grupo muscular', `${rot}: ${t.de} → ${t.para}`);
      if (noPlano.has(t.para) || para.has(t.para)) F.add('troca por exercício que já está no plano', `${rot}: ${t.para}`);
      para.add(t.para);
      if (pa.cuidado.some((c) => pf.cuidados.includes(c))) F.add('troca piora uma limitação', `${rot}: ${t.de} → ${t.para} (${pa.cuidado})`);
      if (pa.nivel > Math.max(1, pf.conservador ? Math.min(pf.nivel, 2) : pf.nivel)) F.add('troca acima do nível', `${rot}: ${t.para}`);
      if (!temAparelho(pa, pf.local, gym)) F.add('troca por aparelho indisponível', `${rot}: ${t.para}`);
      // a dose do item é mantida: o novo exercício precisa ser medido do mesmo jeito (repetições × segundos × minutos)
      const tipo = (e) => (e.registro === 'peso_reps' || e.registro === 'reps' ? 'reps' : e.registro);
      if (tipo(pa) !== tipo(de)) F.add('troca muda a unidade da dose (repetições × segundos)', `${rot}: ${t.de} (${de.registro}) → ${t.para} (${pa.registro})`);
      if (ehCardio(de) || ehCardio(pa)) F.add('troca envolvendo cardio', rot);
      if (t.idx === 0 && de.tipo === 'composto') F.add('troca do exercício principal', `${rot}: ${t.de}`);
      porDia[t.diaId] = (porDia[t.diaId] || 0) + 1;
      if (porDia[t.diaId] > 2) F.add('mais de 2 trocas no mesmo treino', rot);
    }
  }
  assert.ok(comTroca > 1000, 'poucos planos com trocas: ' + comTroca);
  assert.ok(nTrocas > 3500, 'poucas trocas avaliadas: ' + nTrocas);
  // alternativas de TODOS os exercícios do catálogo, com cada limitação
  for (const lim of [...LIM, 'hipertensao', 'gestante']) {
    const pf = perfil({ ...base, experiencia: 'avancado', limitacoes: LIM.includes(lim) ? [lim] : ['nenhuma'], condicoes: LIM.includes(lim) ? ['nenhuma'] : [lim] });
    for (const ex of EXERCICIOS) for (const alt of alternativas(ex, pf, GYM_ALL)) {
      if (alt.cuidado.includes(lim)) F.add('alternativa contraindicada', `${lim}: ${ex.id} → ${alt.id}`);
      if (alt.id === ex.id || alt.padrao !== ex.padrao) F.add('alternativa não equivalente', `${ex.id} → ${alt.id}`);
    }
  }
  // entradas estranhas não quebram
  assert.deepEqual(sugerirTrocas({ dias: [] }, base, GYM_ALL), []);
  assert.deepEqual(sugerirTrocas({ dias: [{ id: 'x', nome: 'X', itens: [{ ex: 'nao-existe', series: 3, reps: '10', descanso: 60 }] }] }, base, GYM_ALL), []);
  assert.deepEqual(sugerirTrocas(null, base, GYM_ALL), []);
  F.confere('trocas');
});

test('robustez: respostas incompletas ou estranhas e academia indefinida não quebram o Treinador', () => {
  const estranhas = [
    {}, { objetivo: 'voar' }, { ...base, dias: '7' }, { ...base, dias: '1' }, { ...base, dias: 0 }, { ...base, tempo: '10' }, { ...base, tempo: '500' }, { ...base, tempo: 'abc' },
    { ...base, local: 'lua' }, { ...base, limitacoes: null }, { ...base, limitacoes: 'ombro' }, { ...base, condicoes: [1, 2, null] }, { ...base, foco: ['equilibrado', 'peito', 'xyz', 'costas', 'ombros'] },
    { ...base, idade: NaN }, { ...base, idade: '30' }, { ...base, peso: 0, altura: 0 }, { ...base, peso: -5 }, { ...base, peso: Infinity }, { ...base, experiencia: 'mestre' }, { ...base, triagem: undefined },
    { ...base, foco: ['toString'] }, { ...base, foco: ['__proto__', 'constructor'] },
  ];
  for (const a of estranhas) for (const gym of [GYM_ALL, undefined, null, {}, { all: false }, { has: null }]) for (const local of [a.local, 'minha']) {
    const resp = { ...a, local };
    let p;
    assert.doesNotThrow(() => { p = gerarPlano(resp, gym, 0); }, JSON.stringify(resp));
    assert.doesNotThrow(() => perfil(resp));
    TOTAL++;
    if (!p) continue;
    assert.ok(p.dias.length >= 0 && p.dias.length <= 6);
    assert.equal(Object.keys(p.agenda).length, p.dias.length, JSON.stringify(resp));
    for (const d of p.dias) { assert.ok(d.itens.length >= 1); for (const it of d.itens) { assert.ok(EX_POR_ID.has(it.ex)); assert.ok(it.series >= 1 && it.series <= 4); assert.match(it.reps, /^\d{1,3}(-\d{1,3})?$/); } }
    for (const t of [...p.avisos.map((x) => x.texto), ...p.orientacoes.flat()]) assert.ok(semLixo(t), t);
  }
  assert.doesNotThrow(() => gerarPlano(null, GYM_ALL, 0));
  assert.doesNotThrow(() => gerarPlano(undefined, undefined, undefined));
  assert.doesNotThrow(() => volumeSemanal([]));
  assert.doesNotThrow(() => volumeSemanal([{ itens: [{ ex: 'nao-existe', series: 3 }] }]));
});

// ---------- modelos prontos ----------
test('modelos prontos: exercícios existentes, doses válidas, duração plausível e equilíbrio entre os grupos', () => {
  const F = new Falhas();
  const AGORA = Date.parse('2026-11-10T18:00:00.000Z');
  assert.equal(MODELOS.length, 9);
  for (const m of MODELOS) {
    assert.ok(m.agenda.length === m.diasSemana, `${m.id}: agenda (${m.agenda.length}) difere de diasSemana (${m.diasSemana})`);
    assert.ok(m.agenda.length >= 2 && m.agenda.length <= 6);
    assert.ok(m.desc && m.desc.length >= 20 && m.desc.length <= 160, m.id + ': descrição');
    for (let i = 0; i < m.dias.length; i++) if (!m.agenda.includes(i)) F.add('treino do modelo fora da agenda', `${m.id}: ${m.dias[i].nome}`);
    for (const d of m.dias) {
      const vistos = new Set();
      for (const it of d.itens) {
        const ex = EX_POR_ID.get(it.ex);
        if (!ex) { F.add('exercício inexistente no modelo', `${m.id}: ${it.ex}`); continue; }
        if (vistos.has(it.ex)) F.add('exercício repetido no modelo', `${m.id}: ${it.ex}`); vistos.add(it.ex);
        if (ex.nivel > Math.max(2, m.nivel)) F.add('exercício acima do nível do modelo', `${m.id}: ${it.ex} n${ex.nivel}`);
        // modelo de iniciante só usa exercício de nível 2 quando não existe equivalente de nível 1 (mesmo movimento e
        // mesmo grupo principal) com os aparelhos que o próprio modelo já usa
        if (m.nivel === 1 && ex.nivel > 1) {
          const aparelhos = new Set(m.dias.flatMap((x) => x.itens.flatMap((y) => (EX_POR_ID.get(y.ex) || { equip: [] }).equip)));
          const equivalente = EXERCICIOS.find((c) => c.nivel === 1 && c.padrao === ex.padrao && MUSCULOS[c.primarios[0]].grupo === MUSCULOS[ex.primarios[0]].grupo && c.registro !== 'segundos' && c.equip.every((q) => aparelhos.has(q)));
          if (equivalente) F.add('modelo de iniciante com exercício de nível 2 havendo equivalente de nível 1', `${m.id}: ${it.ex} → ${equivalente.id}`);
        }
        if (m.nivel === 1 && ex.modalidade === 'barra' && ex.tipo === 'composto') F.add('modelo iniciante com composto de barra livre', `${m.id}: ${it.ex}`);
        if (!Number.isInteger(it.series) || it.series < 1 || it.series > (m.nivel === 1 ? 3 : 4)) F.add('séries fora da faixa no modelo', `${m.id}: ${it.ex} = ${it.series}`);
        if (!/^\d{1,3}(-\d{1,3})?$/.test(it.reps)) { F.add('repetições mal formadas no modelo', `${m.id}: ${it.ex}`); continue; }
        const [lo, hi = lo] = it.reps.split('-').map(Number);
        if (ex.registro === 'segundos') { if (lo < 10 || hi > 60) F.add('isometria fora de 10–60 s no modelo', `${m.id}: ${it.ex} = ${it.reps}`); }
        else if (ex.registro === 'minutos') { if (lo < 5 || hi > 45) F.add('cardio fora de 5–45 min no modelo', `${m.id}: ${it.ex}`); }
        else {
          if (lo > hi || lo < 5 || hi > 30) F.add('repetições fora de 5–30 no modelo', `${m.id}: ${it.ex} = ${it.reps}`);
          if (m.nivel === 1 && lo < 8) F.add('modelo iniciante com menos de 8 repetições', `${m.id}: ${it.ex} = ${it.reps}`);
          // compostos descansam pelo menos tanto quanto os isolados (ACSM 2009)
          if (ex.tipo === 'composto' && ex.grupo !== 'abdomen' && ex.padrao !== 'cardio' && it.descanso < 60) F.add('composto com menos de 60 s de descanso no modelo', `${m.id}: ${it.ex} = ${it.descanso}`);
        }
        if (it.descanso < 30 || it.descanso > 180) F.add('descanso fora de 30–180 s no modelo', `${m.id}: ${it.ex} = ${it.descanso}`);
      }
      const min = duracaoMin(d);
      if (min < 15 || min > 80) F.add('duração do treino do modelo fora de 15–80 min', `${m.id} / ${d.nome}: ${Math.round(min)} min`);
      if (m.id === 'rapido-30' && min > 35) F.add('treino "de 30 minutos" não cabe em 30 min', `${Math.round(min)} min`);
    }
    // aparelhos: os modelos caseiros só usam o que prometem
    const usa = new Set(m.dias.flatMap((d) => d.itens.flatMap((it) => (EX_POR_ID.get(it.ex) || { equip: [] }).equip)));
    if (m.id === 'casa-halteres') for (const q of usa) if (!CASA.has(q)) F.add('modelo de casa usa aparelho de academia', q);
    if (m.id === 'peso-corporal') for (const q of usa) if (!SEM.has(q) && q !== 'banco_reto') F.add('modelo sem aparelhos usa aparelho', q);
    // equilíbrio: uma semana seguindo o modelo, medida pelas mesmas contas da tela Evolução
    const semana = m.agenda.map((i) => m.dias[i]);
    const st = { plans: [], activePlan: '', trainer: { answers: { objetivo: 'hipertrofia', experiencia: 'intermediario' } }, nutri: { answers: {} }, body: [], sessions: semana.map((d, i) => ({ id: 's' + i, inicio: new Date(AGORA - 3600000).toISOString(), fim: new Date(AGORA).toISOString(), itens: d.itens.map((it) => ({ ex: it.ex, sets: Array.from({ length: it.series }, () => ({ kg: 10, reps: 10, seg: 30, ok: true })) })) })) };
    const sg = seriesPorGrupo(st, AGORA, 7);
    const g = sg.porGrupo, d = sg.diretas;
    const rot = `${m.id}: ${Object.keys(g).map((k) => `${k}=${d[k]}/${g[k]}`).join(' ')}`;
    // Sem aparelhos não existe exercício de puxar no catálogo: o modelo "peso-corporal" avisa isso na descrição e é o
    // único dispensado da conferência entre peito e costas (o alerta da Evolução continua valendo para quem o segue).
    const semPuxada = m.id === 'peso-corporal';
    if (semPuxada) assert.match(m.desc, /remadas/);
    if (!semPuxada && g.peito >= 6 && g.costas < g.peito * 0.67) F.add('modelo empurra mais do que puxa', rot);
    if (g.quadriceps >= 6 && g.posteriores + g.gluteos * 0.5 < g.quadriceps * 0.5) F.add('modelo com frente de coxa muito acima da parte de trás', rot);
    // teto de séries diretas do nível (o mesmo do Treinador); o grupo em foco do modelo "glúteos e pernas" vai até 20
    for (const k of Object.keys(g)) {
      const teto = m.id === 'gluteos-pernas' && k === 'gluteos' ? 20 : TETO[m.nivel];
      if (d[k] > teto) F.add('modelo com séries diretas acima do teto do nível', `${k} > ${teto}: ${rot}`);
      if (g[k] > teto * 1.5) F.add('modelo com séries totais acima de 1,5× o teto', `${k}: ${rot}`);
    }
    for (const k of semPuxada ? ['peito', 'quadriceps', 'gluteos'] : ['peito', 'costas', 'quadriceps', 'ombros', 'gluteos']) if (g[k] < 4) F.add('modelo com grupo grande abaixo de 4 séries semanais', `${k}: ${rot}`);
    if (g.posteriores < 4) F.add('modelo com posteriores de coxa abaixo de 4 séries semanais', rot);
    const dicas = analisar(st, AGORA).dicas.map((x) => x.id);
    for (const ruim of semPuxada ? ['frente-tras'] : ['empurra-puxa', 'frente-tras']) if (dicas.includes(ruim)) F.add('modelo dispara alerta de desequilíbrio', `${m.id}: ${ruim}`);
    if (dicas.some((x) => x.startsWith('muito-'))) F.add('modelo dispara alerta de excesso de séries', m.id);
    if (/circuito/i.test(m.desc + m.dias.map((x) => x.nome).join(' '))) F.add('modelo chamado de circuito sem ser circuito', m.id);
  }
  assert.match(MODELOS.find((m) => m.id === 'casa-halteres').desc, /banco com encosto/);
  F.confere('modelos');
});

test('referências citadas existem e a contagem de perfis passa de 30 mil', () => {
  for (const k of ['acsm2009', 'acsm2026', 'oms2020', 'aha2024', 'schoenfeld2017vol', 'bazvalle2022', 'schoenfeld2021', 'grgic2018', 'singer2024', 'iversen2021', 'fragala2019', 'faigenbaum2009', 'donnelly2009', 'acog804', 'riebe2015', 'kolber2010', 'schumann2022']) assert.ok(REFS[k], k);
  assert.ok(TOTAL >= 30000, 'perfis testados: ' + TOTAL);
  console.log(`   Treinador: ${TOTAL} planos gerados e conferidos`);
});

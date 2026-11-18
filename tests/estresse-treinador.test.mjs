// Teste de estresse do Treinador: dezenas de milhares de perfis (grade completa + amostragem com semente fixa).
// Cada perfil gera um plano que é conferido contra regras de segurança, dose, tempo, aparelhos e equilíbrio.
import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { EXERCICIOS, EX_POR_ID } from '../www/js/data/exercises.js';
import { MUSCULOS } from '../www/js/data/muscles.js';
import { EQUIPAMENTOS } from '../www/js/data/equipment.js';
import { MODELOS } from '../www/js/data/templates.js';
import { REFS, FAQ_TREINO } from '../www/js/data/knowledge.js';
import { PERGUNTAS, gerarPlano, perfil, avisosBloqueio, sugerirTrocas, alternativas, volumeSemanal, soManual, limiteFoco, outraVersao, alertaDoExercicio, ajustesPorDor, aplicarTrocasDor, voltasPorDor, aplicarVoltasDor, orientacaoDaDor } from '../www/js/logic/trainer.js';
import { LOCAIS_DOR, TIPOS_DOR, QUANDO_DOR, dorDeAlerta } from '../www/js/logic/dor.js';
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
const REM = op('remedios').filter((x) => x !== 'nenhum');
const FOCO = op('foco').filter((x) => x !== 'equilibrado');
const EXTRAS = op('extras').filter((x) => x !== 'nenhum');
const EQUIP = Object.keys(EQUIPAMENTOS);
const GYM_ALL = { all: true, has: {} };
// (as respostas de base já trazem a liberação médica: sem motivo, ela não muda nada; o bloqueio sem liberação é conferido
// nos testes de saúde, abaixo)
const base = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'], liberado: 'sim' };

// ---------- regras conferidas de forma independente da lógica ----------
// Em casa, a pessoa só tem o que a opção que ela escolheu na entrevista diz. O critério aqui não repete a lista do
// aplicativo: confere se o nome de cada aparelho do exercício aparece no texto da opção ("halteres", "banco reto"...).
const textoDoLocal = (local) => { const o = PERGUNTAS.find((q) => q.k === 'local').op.find((x) => x[0] === local); return (o[1] + ' ' + o[2]).toLowerCase(); };
const ditoNaOpcao = (ex, local) => ex.equip.every((e) => textoDoLocal(local).includes(EQUIPAMENTOS[e].nome.toLowerCase().split(' / ')[0]));
// `extras`: itens que a pessoa marcou na pergunta "Tem mais algum destes em casa?"
function temAparelho(ex, local, gym, extras = []) {
  // academia completa = os aparelhos que quase toda academia tem; os raros só contam se marcados em "Minha academia"
  if (local === 'completa') return !ex.equip.some((e) => EQUIPAMENTOS[e] && EQUIPAMENTOS[e].raro);
  if (local === 'minha') return gym.all || ex.equip.every((e) => gym.has[e]);
  return ex.equip.every((e) => extras.includes(e) || textoDoLocal(local).includes(EQUIPAMENTOS[e].nome.toLowerCase().split(' / ')[0]));
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
  'flexao_cotovelo', 'extensao_cotovelo', 'anti_extensao', 'flexao_tronco', 'flexao_quadril', 'rotacao', 'extensao_lombar']);
// cardio de impacto (corrida, corda, polichinelo, saltos): no catálogo, é o que pede cuidado com joelho e com tornozelo.
// A regra vale para qualquer exercício novo, sem lista de nomes.
const deImpacto = (ex) => ex.padrao === 'cardio' && ex.cuidado.includes('joelho') && ex.cuidado.includes('tornozelo');
// cardio que pode ser prescrito: nada de HIIT; impacto de nível 2 ou mais (corrida, corda, saltos) só para quem já treina e
// não está em dose conservadora; nada de impacto para 60+, IMC de 30 ou mais, pressão alta, gestação ou triagem positiva
function cardioPermitido(ex, pf) {
  if (ex.padrao !== 'cardio' || /hiit/.test(ex.id)) return false;
  // o Treinador só prescreve cardio medido em minutos (três séries de 30 s de marcha não são um treino de cardio)
  if (ex.registro !== 'minutos') return false;
  // impacto: só para quem já treina, sem dose conservadora e com IMC abaixo de 30
  if (deImpacto(ex) && (pf.nivel === 1 || pf.conservador || (pf.imc != null && pf.imc >= 30))) return false;
  return true;
}
// ---------- segurança: as regras escritas de novo aqui, sem usar a lógica do aplicativo ----------
// exercícios que o Treinador nunca escolhe sozinho, para ninguém (ficam para a escolha manual)
const SO_MANUAL = new Set(['remada-invertida-sob-mesa', 'bom-dia-barra', 'hiit-bicicleta', 'agachamento-hack-invertido', 'agachamento-articulado-de-frente']);
const NAO_USADOS = new Set(['remada_alta', 'mergulho', 'total', 'carregar']);
const instavel = (ex) => ex.equip.includes('bola_suica') || ex.equip.includes('trx') || (ex.unilateral && ['afundo', 'agachar', 'dobradica_quadril', 'flexao_plantar'].includes(ex.padrao) && ex.modalidade !== 'maquina' && ex.modalidade !== 'smith');
// devolve o motivo pelo qual o exercício não pode ser prescrito automaticamente para o perfil ('' = pode)
function inseguro(ex, pf) {
  if (SO_MANUAL.has(ex.id)) return 'exercício da lista "só manual"';
  if (ex.grupo === 'funcional' && ex.padrao !== 'cardio') return 'potência, salto ou levantamento explosivo';
  if (NAO_USADOS.has(ex.padrao)) return 'movimento que o Treinador não usa (remada alta, mergulho, carregar, corpo inteiro)';
  if (deImpacto(ex) && (pf.nivel === 1 || pf.conservador || (pf.imc != null && pf.imc >= 30))) return 'impacto para iniciante, dose conservadora ou IMC 30+';
  if (pf.conservador && ex.modalidade === 'barra' && ex.tipo === 'composto') return 'barra livre em exercício composto para 60+, menor de 18, gestante, pressão alta ou triagem positiva';
  if ((pf.idoso || pf.gestante) && instavel(ex)) return 'exercício instável para 60+ ou gestante';
  if ((pf.pressao || pf.gestante || pf.liberacao) && ex.cuidado.includes('hipertensao')) return 'apneia, isometria pesada ou posição invertida com pressão alta, coração, gestação ou triagem positiva';
  if ((pf.pressao || pf.gestante || pf.liberacao || pf.idoso || (pf.imc != null && pf.imc >= 30)) && (ex.equip.includes('barra_fixa') || ex.equip.includes('paralelas'))) return 'pendurado na barra fixa ou nas paralelas para pressão alta, coração, gestação, triagem positiva, 60+ ou IMC 30+';
  if (pf.nivel === 1 && ex.nivel > 1) return 'exercício acima do nível 1 para iniciante';
  return '';
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

// ---------- dores: as regras escritas de novo, sem usar a lógica do aplicativo ----------
// região de cada local: [articulações (marcas de cuidado do catálogo), músculos]
const REGIAO = {
  pescoco: [['cervical'], ['trapezio']], ombro: [['ombro'], ['deltoide_ant', 'deltoide_lat', 'deltoide_post', 'manguito']], cotovelo: [['cotovelo'], []],
  punho: [['punho'], ['antebraco']], 'coluna-alta': [[], ['costas_superior', 'trapezio', 'dorsais']], lombar: [['lombar'], ['lombar']], quadril: [['quadril'], ['abdutores']],
  virilha: [['quadril'], ['adutores']], 'coxa-frente': [[], ['quadriceps']], 'coxa-tras': [[], ['posteriores']], joelho: [['joelho'], []], canela: [['tornozelo'], ['tibial']],
  panturrilha: [[], ['panturrilhas']], aquiles: [['tornozelo'], ['panturrilhas']], tornozelo: [['tornozelo'], []], pe: [['tornozelo'], []], peito: [[], ['peito']],
  abdomen: [[], ['abdomen', 'obliquos']], braco: [[], ['biceps', 'triceps']], gluteo: [[], ['gluteos']],
};
// alerta: forte ou repentina, 7 ou mais, em repouso; na gestação, abdômen e panturrilha (ACOG 804); peito que não é muscular
function classeDor(d, pf) {
  if (d.tipo === 'aguda' || d.nivel >= 7 || d.quando === 'repouso' || (pf.gestante && (d.onde === 'abdomen' || d.onde === 'panturrilha')) || (d.onde === 'peito' && d.tipo !== 'muscular')) return 'alerta';
  // dor muscular comum: nenhuma fonte dá um número; enquanto doer, treino mais leve nesse músculo (Cheung 2003)
  if (d.tipo === 'muscular') return 'media';
  // articulação ou tendão: dor aceitável até 5 só onde ensaios a aceitaram (ombro, Aquiles, quadril/glúteo) e para quem já
  // treina sem dose conservadora; no resto, até 3 (Breda 2021; Raulline Ullern 2025)
  const teto = pf.conservador || pf.nivel === 1 || !['ombro', 'aquiles', 'quadril', 'gluteo'].includes(d.onde) ? 3 : 5;
  return d.nivel > teto ? 'forte' : d.nivel >= 3 ? 'media' : 'leve';
}
// ---------- mecânica, escrita de novo aqui: o que carrega cada região do corpo ----------
// Não usa as marcas de `cuidado` do catálogo. Olha só o tipo de movimento, os músculos principais e a postura descrita
// no texto do exercício (em pé, mãos no chão). É o MÍNIMO que o aplicativo tem de reconhecer; ele pode ser mais cauteloso.
const posT = (ex) => (typeof ex.posicao === 'string' ? ex.posicao : '');
const emPeT = (ex) => /^em pé/i.test(posT(ex));
const maosNoApoio = (ex) => /mãos no chão|quatro apoios|prancha|mãos na borda|pendurad/i.test(posT(ex));
const cardioPernas = (ex) => ex.padrao === 'cardio' && [...ex.primarios, ...ex.secundarios].some((m) => ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas'].includes(m));
const mov = (ex, l) => l.includes(ex.padrao);
const principal = (ex, l) => ex.primarios.some((m) => l.includes(m));
const BRACO_MOV = ['empurrar_horizontal', 'empurrar_vertical', 'puxar_horizontal', 'puxar_vertical', 'flexao_cotovelo', 'extensao_cotovelo', 'mergulho', 'punho'];
const peTornozelo = (ex) => emPeT(ex) || mov(ex, ['agachar', 'afundo', 'dobradica_quadril', 'flexao_plantar', 'dorsiflexao']) || cardioPernas(ex);
const MEC = {
  joelho: (ex) => mov(ex, ['agachar', 'afundo', 'extensao_joelho', 'flexao_joelho']) || cardioPernas(ex),
  quadril: (ex) => mov(ex, ['agachar', 'afundo', 'dobradica_quadril', 'extensao_quadril', 'abducao', 'aducao']) || cardioPernas(ex),
  tornozelo: peTornozelo, pe: peTornozelo, aquiles: peTornozelo, canela: peTornozelo, panturrilha: peTornozelo,
  cotovelo: (ex) => mov(ex, BRACO_MOV) || maosNoApoio(ex), punho: (ex) => mov(ex, BRACO_MOV) || maosNoApoio(ex),
  ombro: (ex) => mov(ex, [...BRACO_MOV, 'aducao_horizontal', 'abducao_horizontal', 'elevacao_lateral', 'elevacao_frontal', 'extensao_ombro', 'remada_alta', 'encolhimento']) || maosNoApoio(ex) || principal(ex, ['deltoide_ant', 'deltoide_lat', 'deltoide_post', 'manguito']),
  braco: (ex) => mov(ex, BRACO_MOV) || principal(ex, ['biceps', 'triceps']),
  lombar: (ex) => mov(ex, ['dobradica_quadril', 'extensao_lombar', 'agachar', 'flexao_tronco', 'rotacao', 'anti_extensao']) || principal(ex, ['lombar']),
  pescoco: (ex) => mov(ex, ['encolhimento', 'remada_alta']) || principal(ex, ['trapezio']) || (ex.modalidade === 'barra' && ex.padrao === 'agachar'),
  'coluna-alta': (ex) => mov(ex, ['puxar_horizontal', 'puxar_vertical', 'encolhimento', 'remada_alta']) || principal(ex, ['costas_superior', 'dorsais', 'trapezio']),
  peito: (ex) => mov(ex, ['empurrar_horizontal', 'aducao_horizontal', 'mergulho']) || principal(ex, ['peito']),
  abdomen: (ex) => mov(ex, ['flexao_tronco', 'flexao_quadril', 'rotacao', 'anti_extensao']) || principal(ex, ['abdomen', 'obliquos']),
  'coxa-frente': (ex) => mov(ex, ['agachar', 'afundo', 'extensao_joelho']) || principal(ex, ['quadriceps']),
  'coxa-tras': (ex) => mov(ex, ['flexao_joelho', 'dobradica_quadril']) || principal(ex, ['posteriores']),
  gluteo: (ex) => mov(ex, ['extensao_quadril', 'agachar', 'afundo', 'dobradica_quadril']) || principal(ex, ['gluteos']),
  virilha: (ex) => mov(ex, ['aducao', 'agachar', 'afundo']) || principal(ex, ['adutores']),
};
const carregaPelaMecanica = (ex, onde) => MEC[onde](ex);
// 'evitar' | 'leve' | null — o MÍNIMO que uma dor tem de fazer com um exercício (o aplicativo pode ser mais cauteloso)
function efeitoDaDor(ex, d, pf) {
  const [art, mus] = REGIAO[d.onde];
  const c = ex.cuidado.some((x) => art.includes(x)), p = ex.primarios.some((x) => mus.includes(x)), sec = ex.secundarios.some((x) => mus.includes(x));
  const classe = classeDor(d, pf);
  if (classe !== 'alerta' && d.tipo === 'muscular') return p || sec || c ? 'leve' : null;
  const mec = carregaPelaMecanica(ex, d.onde);
  if (classe === 'alerta') return c || p || sec || mec ? 'evitar' : null;
  if (classe === 'forte') return c || p || mec ? 'evitar' : sec ? 'leve' : null;
  if (classe === 'media') return c || p || sec || mec ? 'leve' : null;
  return c || p || mec ? 'leve' : null;
}
const GRAU = { null: 0, leve: 1, evitar: 2 };
// protocolos publicados que fixam a dose de um exercício: [repetições mínimas, máximas, séries máximas]
const DOSE_DE_PROTOCOLO = { 'flexao-nordica': [5, 12, 3] }; // Petersen 2011: de 2×5 a 3 séries de 12, 10 e 8
const NOMES_GRANDES = { peito: 'peito', costas: 'costas', quadriceps: 'quadríceps', posteriores: 'posteriores', gluteos: 'glúteos', ombros: 'ombros' };
const NOMES_GRUPO = { ...NOMES_GRANDES, biceps: 'bíceps', triceps: 'tríceps', panturrilhas: 'panturrilhas', abdomen: 'abdômen', trapezio: 'trapézio', lombar: 'lombar' };
// dias da semana (da agenda do plano) em que há treino de força
function diasDeForca(p) {
  const out = [];
  for (const [wd, id] of Object.entries(p.agenda)) { const d = p.dias.find((x) => x.id === id); if (d && d.itens.some((it) => !ehCardio(EX_POR_ID.get(it.ex)) && EX_POR_ID.get(it.ex).grupo !== 'abdomen')) out.push(Number(wd)); }
  return out.sort((a, b) => a - b);
}
const emDiasSeguidos = (wds) => wds.some((w, i) => i > 0 && w - wds[i - 1] === 1) || (wds.includes(0) && wds.includes(6));
const LOCAIS = Object.keys(LOCAIS_DOR), TIPOS = Object.keys(TIPOS_DOR), QUANDO = Object.keys(QUANDO_DOR);
function doresAleatorias(r, max = 3) {
  const n = 1 + Math.floor(r() * max);
  const locais = LOCAIS.slice();
  const out = [];
  for (let i = 0; i < n; i++) {
    const onde = locais.splice(Math.floor(r() * locais.length), 1)[0];
    out.push({ id: 'd' + i, data: '2026-11-10', onde, lado: um(r, ['', 'e', 'd', 'dois']), tipo: um(r, TIPOS), quando: r() < 0.12 ? 'repouso' : um(r, ['durante', 'depois']), nivel: inteiro(r, 1, 10), nota: '', fim: '', dias: inteiro(r, 0, 20) });
  }
  return out;
}
const assinatura = (p) => p.dias.map((d) => d.itens.map((i) => i.ex).sort().join(',')).join('|');
const doseTotal = (p) => p.dias.reduce((t, d) => t + d.itens.reduce((x, i) => x + i.series, 0), 0);

class Falhas {
  constructor() { this.m = new Map(); this.n = 0; }
  add(cat, det) { this.n++; const x = this.m.get(cat) || { n: 0, ex: [] }; x.n++; if (x.ex.length < 3) x.ex.push(det); this.m.set(cat, x); }
  texto() { return [...this.m].map(([c, x]) => `${c}: ${x.n}\n    ${x.ex.join('\n    ')}`).join('\n'); }
  confere(titulo) { assert.equal(this.n, 0, `${titulo}: ${this.n} falhas\n${this.texto()}`); }
}

// Confere um plano. Devolve { p, pf } (p = null quando o perfil é bloqueado).
// `corr`: resumo da corrida da semana e da prioridade escolhida (quem corre não recebe cardio no plano de musculação).
function validar(a, gym, versao, F, rot, dores = null, corr = null) {
  let p;
  try { p = gerarPlano(a, gym, versao, dores, corr); } catch (e) { F.add('lançou erro', `${rot}: ${e.message}`); return {}; }
  const pf = perfil(a);
  if (a.idade < 14) { if (p !== null) F.add('menor de 14 sem bloqueio', rot); return { p: null, pf }; }
  // triagem que pede liberação médica sem ela, ou "só com supervisão": nenhum plano, sempre com a explicação
  const semLib = ((a.triagem || []).some((x) => x !== 'nenhum') || (a.condicoes || []).some((c) => ['cardiaco', 'gestante', 'posparto'].includes(c))) && a.liberado !== 'sim';
  if (semLib || (a.triagem || []).includes('medico')) {
    if (p !== null) F.add('plano sem a liberação médica que a triagem pede', rot);
    if (!pf.bloqueado || !avisosBloqueio(a).length) F.add('bloqueio sem explicação', rot);
    return { p: null, pf };
  }
  if (pf.bloqueado) { if (p !== null) F.add('bloqueado com plano', rot); if (!avisosBloqueio(a).length) F.add('bloqueio sem explicação', rot); return { p: null, pf }; }
  if (!p) { F.add('plano não gerado', rot); return {}; }

  const extras = Array.isArray(a.extras) ? a.extras : [];
  const pool = EXERCICIOS.filter((ex) => temAparelho(ex, pf.local, gym, extras) && !inseguro(ex, pf) && !ex.cuidado.some((c) => pf.cuidados.includes(c)) && ex.nivel <= Math.max(1, pf.conservador ? Math.min(pf.nivel, 2) : pf.nivel) && !(dores && (alertaDoExercicio(ex.id, dores, a) || {}).nivel === 'evitar'));
  // (fora do abdômen, o Treinador só prescreve exercícios contados em repetições; isometrias de perna e braço ficam para a escolha manual)
  const poolForca = pool.filter((ex) => ex.grupo !== 'cardio' && ex.grupo !== 'funcional' && MOVIMENTOS.has(ex.padrao) && (ehForca(ex) || ['anti_extensao', 'flexao_tronco', 'flexao_quadril', 'rotacao'].includes(ex.padrao)));
  const poolCardio = pool.filter((ex) => cardioPermitido(ex, pf));
  const textos = [...p.avisos.map((x) => x.texto), ...p.orientacoes.flat()];

  // número de treinos e agenda
  if (p.dias.length > pf.dias) F.add('treinos a mais', `${rot}: ${p.dias.length} > ${pf.dias}`);
  if (p.dias.length < pf.dias) {
    if (!corr && poolForca.length >= 1 && poolCardio.length >= 1) F.add('treinos a menos, havendo exercícios', `${rot}: ${p.dias.length} < ${pf.dias}`);
    if (!p.avisos.some((x) => x.tipo !== 'info' || /aeróbic|caminhada|cardio ficou fora/i.test(x.texto) || (corr && /Como você corre, este plano não tem cardio/.test(x.texto)))) F.add('treinos a menos sem aviso', rot);
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
      for (const d of dores || []) if (efeitoDaDor(ex, d, pf) === 'evitar') F.add(classeDor(d, pf) === 'alerta' ? 'plano treina região com dor de alerta' : 'plano com exercício que a dor manda evitar', `${rot}: ${it.ex} (${d.onde} ${d.tipo} ${d.nivel})`);
      if (ex.nivel > maxNivel) F.add('nível acima da experiência', `${rot}: ${it.ex} n${ex.nivel} > ${maxNivel}`);
      if (!temAparelho(ex, pf.local, gym, extras)) F.add('aparelho indisponível', `${rot}: ${it.ex} (${ex.equip})`);
      if (ex.padrao === 'cardio' && !cardioPermitido(ex, pf)) F.add('cardio não permitido para o perfil', `${rot}: ${it.ex}`);
      if (ex.grupo === 'funcional' && ex.padrao !== 'cardio') F.add('exercício de potência prescrito automaticamente', `${rot}: ${it.ex}`);
      // segurança: nada da lista "só manual", nada de impacto, barra livre composta, instabilidade ou apneia para quem não pode
      const risco = inseguro(ex, pf);
      if (risco) F.add('segurança: ' + risco, `${rot}: ${it.ex}`);
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
          if (ex.registro === 'reps' && lo < 8 && !ex.equip.includes('barra_fixa') && !ex.equip.includes('paralelas') && !DOSE_DE_PROTOCOLO[ex.id]) F.add('peso do corpo com menos de 8 repetições', `${rot}: ${it.ex} ${it.reps}`);
          // exercício com dose de protocolo publicado: fica dentro dela, qualquer que seja o objetivo
          if (DOSE_DE_PROTOCOLO[ex.id]) { const [min, max, sMax] = DOSE_DE_PROTOCOLO[ex.id]; if (lo < min || hi > max || it.series > sMax) F.add('dose fora do protocolo publicado do exercício', `${rot}: ${it.ex} ${it.series}×${it.reps}`); }
          // diabetes ou outra doença crônica: sem treino de força vigoroso (menos de 8 repetições) e até 3 séries (ADA 2016; ACSM 2015)
          if ((a.condicoes || []).some((c) => c === 'diabetes' || c === 'cronica') && !DOSE_DE_PROTOCOLO[ex.id] && (lo < 8 || it.series > 3)) F.add('dose vigorosa com diabetes ou doença crônica', `${rot}: ${it.ex} ${it.series}×${it.reps}`);
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
  if (pf.liberacao && !tem('danger', /médic/i)) F.add('sem aviso de liberação médica', rot);
  if (!pf.liberacao && tem('danger', /liberação/i) && p.dias.length) F.add('aviso de liberação sem motivo', rot);
  if (pf.gestante && !tem('warn', /gesta/i)) F.add('sem aviso de gestação', rot);
  if (pf.pressao && !tem('warn', /pressão|coração/i)) F.add('sem aviso de pressão alta/coração', rot);
  if (pf.jovem && !tem('', /18 anos/)) F.add('sem aviso para menor de 18', rot);
  if (pf.idoso && !tem('', /60 anos/)) F.add('sem aviso para 60+', rot);
  if (pf.limitacoes.length && !tem('', /limitaç|cuidado para|não encontrei/i)) F.add('sem aviso sobre as limitações', rot);
  if (p.orientacoes.length < 5 || !p.orientacoes.some((o) => o[0] === 'Cardio')) F.add('orientações incompletas', rot);
  if (!(p.revisaoSemanas >= 4 && p.revisaoSemanas <= 12)) F.add('prazo de revisão estranho', `${rot}: ${p.revisaoSemanas}`);
  if (!Array.isArray(p.faltando)) F.add('lista "faltando" ausente', rot);
  // cardio do plano: só em minutos; "dia de cardio" com pelo menos 20 min; o texto só diz que o cardio conta se houver cardio
  let minCardio = 0;
  for (const d of p.dias) {
    const cardio = d.itens.filter((it) => ehCardio(EX_POR_ID.get(it.ex)));
    for (const it of cardio) { if (EX_POR_ID.get(it.ex).registro !== 'minutos') F.add('cardio que não é medido em minutos', `${rot}: ${it.ex}`); else minCardio += Number(it.reps); }
    // (cardio de impacto — corrida, corda — é vigoroso: cada minuto vale por dois moderados, OMS 2020)
    if (/^Cardio/.test(d.nome) && cardio.reduce((t, it) => t + (EX_POR_ID.get(it.ex).registro === 'minutos' ? Number(it.reps) * (deImpacto(EX_POR_ID.get(it.ex)) ? 2 : 1) : 0), 0) < 20) F.add('dia de cardio com menos de 20 minutos', `${rot}: ${d.nome}`);
  }
  const txtCardio = (p.orientacoes.find((o) => o[0] === 'Cardio') || ['', ''])[1];
  if (!minCardio && /cardio do plano/i.test(txtCardio)) F.add('texto promete cardio do plano sem cardio no plano', `${rot}: ${txtCardio.slice(0, 80)}`);
  if (p.minCardio !== minCardio) F.add('minutos de cardio informados diferem dos do plano', `${rot}: ${p.minCardio} × ${minCardio}`);
  // grande grupo muscular zerado: o plano tem de dizer qual
  if (p.dias.length) for (const g of Object.keys(NOMES_GRANDES)) if (!vol[g] && !p.avisos.some((x) => x.tipo === 'warn' && /sem exercício para/.test(x.texto) && x.texto.includes(NOMES_GRANDES[g]))) F.add('grande grupo zerado sem aviso que diga qual', `${rot}: ${g}`);
  // menores de 18 e diabetes: no máximo 3 treinos de força, em dias não seguidos (NSCA 2009; Consenso 2014; ADA 2016)
  if (pf.jovem || (a.condicoes || []).includes('diabetes')) {
    const wds = diasDeForca(p);
    if (wds.length > 3) F.add('mais de 3 treinos de força para menor de 18 ou diabetes', `${rot}: ${wds}`);
    if (emDiasSeguidos(wds)) F.add('força em dias seguidos para menor de 18 ou diabetes', `${rot}: ${wds}`);
  }
  if ((a.condicoes || []).includes('diabetes') && !tem('warn', /Diabetes/)) F.add('sem aviso de diabetes', rot);
  if ((a.condicoes || []).includes('cronica') && !tem('', /Doença crônica/)) F.add('sem aviso de doença crônica', rot);
  return { p, pf, vol, dir, poolForca, poolCardio };
}

// testes que precisam de um plano para conferir: a liberação médica dada e sem "só com supervisão" (o bloqueio é conferido
// em validar e nos testes de saúde)
function liberar(a) {
  a.liberado = 'sim';
  const t = (a.triagem || []).filter((x) => x !== 'medico');
  a.triagem = t.length ? t : ['nenhum'];
}
function perfilAleatorio(r) {
  const idade = r() < 0.06 ? inteiro(r, 10, 13) : r() < 0.25 ? um(r, [14, 15, 17, 18, 59, 60, 61, 99]) : inteiro(r, 14, 99);
  const peso = r() < 0.15 ? um(r, [30, 30.5, 249.5, 250]) : Math.round((30 + r() * 220) * 2) / 2;
  const altura = r() < 0.15 ? um(r, [120, 121, 219, 220]) : inteiro(r, 120, 220);
  const a = {
    objetivo: um(r, OBJ), idade, peso, altura, experiencia: um(r, EXP), dias: um(r, DIAS), tempo: um(r, TEMPO), local: um(r, LOCAL),
    limitacoes: varios(r, LIM, 'nenhuma'), condicoes: varios(r, COND, 'nenhuma'), triagem: varios(r, TRI, 'nenhum'), foco: varios(r, FOCO, 'equilibrado', 2),
    remedios: r() < 0.7 ? varios(r, REM, 'nenhum') : undefined,
    // liberação médica: quase sempre dada (para sobrar plano para conferir); às vezes "não" ou sem resposta (bloqueia)
    liberado: r() < 0.8 ? 'sim' : r() < 0.5 ? 'nao' : undefined,
  };
  // em casa: às vezes sem a resposta (planos antigos), às vezes "nenhum", às vezes com itens extras
  if ((a.local === 'halteres' || a.local === 'corporal') && r() < 0.8) a.extras = varios(r, EXTRAS, 'nenhum');
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
  assert.deepEqual([OBJ.length, EXP.length, DIAS.length, TEMPO.length, LOCAL.length, LIM.length, COND.length, TRI.length, REM.length, FOCO.length], [5, 4, 5, 4, 4, 8, 8, 11, 3, 12]);
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
  const visto = { objetivo: new Set(), experiencia: new Set(), dias: new Set(), tempo: new Set(), local: new Set(), limitacoes: new Set(), condicoes: new Set(), triagem: new Set(), remedios: new Set(), foco: new Set() };
  let bloqueados = 0, vazios = 0, gymVazia = 0;
  const N = 10000;
  for (let i = 0; i < N; i++) {
    const { a, gym, versao } = perfilAleatorio(r);
    for (const k of Object.keys(visto)) for (const v of [].concat(a[k])) if (v !== undefined) visto[k].add(v);
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
  const forca = itens.filter((it) => ehForca(it.e) && it.e.grupo !== 'abdomen' && !DOSE_DE_PROTOCOLO[it.ex]);
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
    // posteriores: 8 ou mais. Desde que o agachamento e o leg press deixaram de somar meia série aos posteriores (eles não
    // crescem com esses exercícios — refs kubo2019, plotkin2023, kinoshita2026), o treino de pernas único da divisão de 3
    // dias (empurrar, puxar, pernas) fica com 2 exercícios diretos de posteriores, 8 séries: dentro da faixa de "alta
    // eficiência" de Pelland (5 a 10 — ref pelland2026). Uma 3ª vaga tiraria o abdômen da semana e a vaga da prioridade.
    for (const g of ['peito', 'costas', 'quadriceps', 'posteriores']) if (p.volume[g] < (g === 'posteriores' ? 8 : 9)) F.add('hipertrofia abaixo de ~10 séries semanais', `${experiencia}/${dias}d/${tempo}min: ${g} = ${p.volume[g]}`); // Schoenfeld 2017
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

test('prioridade de músculo: os escolhidos ganham séries (nunca perdem), até 6 a mais; os outros grupos mantêm a dose mínima; tudo dentro do teto e do tempo', () => {
  const F = new Falhas();
  const AREAS = { pernas: ['quadriceps', 'posteriores'], bracos: ['biceps', 'triceps'] };
  const musculos = (lista) => [...new Set(lista.flatMap((x) => AREAS[x] || [x]))];
  const GRANDES = ['peito', 'costas', 'quadriceps', 'posteriores', 'gluteos', 'ombros'];
  const confere = (a, sem, foco, rot) => {
    const { p, pf } = validar({ ...a, foco }, GYM_ALL, 0, F, rot);
    TOTAL++;
    const pedidos = musculos(foco);
    const max = limiteFoco(pf);
    if (p.foco.length !== Math.min(pedidos.length, max)) F.add('número de músculos em prioridade', `${rot}: ${p.foco.length} (limite ${max})`);
    if (p.foco.map((x) => x.id).join() !== pedidos.slice(0, max).join()) F.add('prioridade fora da ordem escolhida', rot);
    if (p.focoFora.length !== Math.max(0, pedidos.length - max)) F.add('lista dos que ficaram de fora', rot);
    for (const x of p.foco) {
      if (x.de !== sem.volume[x.id] || x.para !== p.volume[x.id]) F.add('linha da prioridade não bate com o volume', `${rot}: ${x.id}`);
      if (!semLixo(x.texto) || !x.texto.startsWith(x.nome)) F.add('texto da prioridade', `${rot}: ${x.texto}`);
      if (x.para < x.de) F.add('prioridade reduziu o músculo escolhido', `${rot}: ${x.id} ${x.de} → ${x.para}`);
      // até cerca de 6 séries a mais (Pelland 2026; Scarpelli 2022) — meia série de folga pelo arredondamento
      if (x.para - x.de > 6.5) F.add('prioridade somou mais de 6 séries', `${rot}: ${x.id} ${x.de} → ${x.para}`);
      if ((x.para > x.de) !== /→/.test(x.texto)) F.add('texto da prioridade não diz o que aconteceu', `${rot}: ${x.texto}`);
    }
    // os outros grandes grupos ficam com pelo menos a dose de manutenção: 4 séries (6 a partir dos 60 anos), ou o que já tinham
    const piso = pf.idoso ? 6 : 4;
    for (const g of GRANDES) if (!p.foco.some((x) => x.id === g) && p.volume[g] < Math.min(piso, sem.volume[g])) F.add('prioridade tirou outro grande grupo da dose de manutenção', `${rot}: ${g} ${sem.volume[g]} → ${p.volume[g]}`);
    return { p, pf };
  };
  let subiu = 0, semEspaco = 0;
  for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) for (const idade of [30, 70]) {
    if (idade === 70 && objetivo !== 'hipertrofia' && objetivo !== 'saude') continue;
    const a0 = { ...base, objetivo, experiencia, dias, tempo, idade };
    const sem = gerarPlano(a0, GYM_ALL, 0);
    for (const foco of FOCO) {
      const rot = `${foco}/${objetivo}/${experiencia}/${dias}d/${tempo}min/${idade}a`;
      const { p, pf } = confere(a0, sem, [foco], rot);
      for (const x of p.foco) {
        // "no teto": séries diretas no limite do nível, ou total (com as meias séries) já acima dele
        const noTeto = x.diretas >= TETO[pf.nivel] - 1 || x.de >= TETO[pf.nivel];
        if (x.para > x.de) subiu++; else semEspaco++;
        // com 1 hora ou mais e 3 ou mais dias, um músculo sozinho sempre ganha séries, a não ser que já esteja no teto
        if (foco === x.id && Number(tempo) >= 60 && Number(dias) >= 3 && x.para <= x.de && !noTeto) F.add('prioridade não aumentou o músculo (1 h ou mais, 3+ dias)', `${rot}: ${x.de} → ${x.para}`);
      }
    }
    // dois e três músculos ao mesmo tempo, sorteados
    const r = semente(Number(dias) * 100 + Number(tempo) + idade);
    const f2 = [um(r, FOCO)]; f2.push(um(r, FOCO.filter((x) => x !== f2[0])));
    confere(a0, sem, f2, `${f2.join('+')}/${objetivo}/${experiencia}/${dias}d/${tempo}min/${idade}a`);
    const f3 = [...f2, um(r, FOCO.filter((x) => !f2.includes(x)))];
    confere(a0, sem, f3, `${f3.join('+')}/${objetivo}/${experiencia}/${dias}d/${tempo}min/${idade}a`);
  }
  assert.ok(subiu > semEspaco * 2, `a prioridade quase nunca aumenta as séries: ${subiu} × ${semEspaco}`);
  // limite de escolhas: no máximo 2 (orientação publicada: um ou dois grupos por ciclo); 1 com treinos de 30 min;
  // e nunca mais do que cabe na conta de tempo: (dias × minutos ÷ 2 − 12 séries do resto do corpo, 18 para 60+) ÷ 10
  for (const dias of DIAS) for (const tempo of TEMPO) for (const idade of [30, 70]) {
    const pf = perfil({ ...base, dias, tempo, idade });
    const conta = Math.floor((pf.dias * pf.tempo / 2 - (idade >= 60 ? 18 : 12)) / 10);
    const n = limiteFoco(pf);
    assert.ok(n >= 1 && n <= 2 && n <= Math.max(1, conta), `limite ${n} em ${dias}d/${tempo}min/${idade}a (conta: ${conta})`);
    if (tempo === '30') assert.equal(n, 1);
  }
  assert.equal(limiteFoco(perfil({ ...base, tempo: '30' })), 1);
  assert.equal(limiteFoco(perfil({ ...base, dias: '4', tempo: '60' })), 2);
  assert.equal(limiteFoco(perfil({ ...base, dias: '6', tempo: '75', experiencia: 'avancado' })), 2);
  assert.equal(limiteFoco(perfil({ ...base, dias: '2', tempo: '45' })), 2);
  assert.equal(limiteFoco(perfil({ ...base, dias: '3', tempo: '60' })), 2);
  assert.equal(limiteFoco(perfil({ ...base, dias: '5', tempo: '45' })), 2);
  assert.equal(limiteFoco(perfil({ ...base, dias: '5', tempo: '75', experiencia: 'iniciante' })), 2);
  assert.equal(limiteFoco(perfil({ ...base, dias: '5', tempo: '75', idade: 65 })), 2);
  assert.equal(limiteFoco(perfil({ ...base, dias: '5', tempo: '75', condicoes: ['hipertensao'] })), 2);
  // respostas antigas (áreas) continuam valendo
  assert.deepEqual(perfil({ ...base, foco: ['pernas'] }).foco, ['quadriceps', 'posteriores']);
  assert.deepEqual(perfil({ ...base, foco: ['bracos', 'gluteos'] }).foco, ['biceps', 'triceps']);
  assert.deepEqual(perfil({ ...base, foco: ['bracos', 'gluteos'] }).focoPedido, ['biceps', 'triceps', 'gluteos']);
  assert.deepEqual(perfil({ ...base, foco: ['gluteos', 'peito'] }).foco, ['gluteos', 'peito']);
  assert.deepEqual(perfil({ ...base, foco: ['equilibrado'] }).foco, []);
  F.confere('prioridade de músculo');
});

// Três semanas seguindo o plano à risca, com cada treino no dia da semana da agenda (às 18 h). 18/10/2026 é um domingo.
function tresSemanas(p) {
  const sessions = [];
  for (let w = 0; w < 3; w++) for (const [wd, id] of Object.entries(p.agenda)) {
    const d = p.dias.find((x) => x.id === id);
    const ini = new Date(2026, 9, 18 + w * 7 + Number(wd), 18, 0).getTime();
    sessions.push({ id: 's' + w + wd, inicio: new Date(ini).toISOString(), fim: new Date(ini + 3600000).toISOString(), itens: d.itens.map((it) => ({ ex: it.ex, sets: Array.from({ length: it.series }, () => ({ kg: 10, reps: 10, seg: 30, ok: true })) })) });
  }
  sessions.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  return sessions;
}
const FIM_3_SEMANAS = new Date(2026, 10, 8, 12, 0).getTime(); // domingo depois da terceira semana

test('equilíbrio: quem segue o plano à risca por 3 semanas, nos dias da agenda, não recebe crítica da tela Evolução (1.600 planos, todos os locais)', () => {
  const F = new Falhas();
  const poucos = { all: false, has: { halteres: true, banco_reto: true, puxador: true, leg_press_45: true, colchonete: true, esteira: true } };
  const cont = { descanso: 0, 'empurra-puxa': 0 };
  let n = 0;
  for (const local of LOCAL) for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) {
    const rot = `${local}/${objetivo}/${experiencia}/${dias}d/${tempo}min`;
    const a = { ...base, objetivo, experiencia, dias, tempo, local };
    const p = gerarPlano(a, local === 'minha' ? poucos : GYM_ALL, 0);
    TOTAL++; n++;
    const st = { plans: [], activePlan: '', trainer: { answers: a }, nutri: { answers: {} }, body: [], sessions: tresSemanas(p) };
    const sg = seriesPorGrupo(st, FIM_3_SEMANAS, 7);
    const g = sg.porGrupo;
    // a tela Evolução faz a mesma conta do Treinador (última semana)
    for (const k of Object.keys(g)) if (g[k] !== p.volume[k]) F.add('Evolução e Treinador contam séries de formas diferentes', `${rot}: ${k} ${g[k]} vs ${p.volume[k]}`);
    // empurrar × puxar: vale em qualquer local, inclusive em casa, onde quase não há como puxar
    if (g.peito >= 6 && g.costas < g.peito * 0.67) F.add('empurra mais do que puxa (Kolber 2010)', `${rot}: peito ${g.peito}, costas ${g.costas}`);
    const dicas = analisar(st, FIM_3_SEMANAS).dicas;
    for (const d of dicas) if (d.id === 'descanso' || d.id === 'empurra-puxa') { cont[d.id]++; F.add('plano do Treinador recebe crítica da tela Evolução', `${rot}: ${d.titulo} — ${d.texto}`); }
    if (local !== 'completa') continue;
    // na academia completa, as demais relações também valem
    if (g.costas >= 6 && g.peito < g.costas * 0.5) F.add('peito abaixo da metade das costas', `${rot}: peito ${g.peito}, costas ${g.costas}`);
    if (g.quadriceps >= 6 && g.posteriores + g.gluteos * 0.5 < g.quadriceps * 0.5) F.add('frente da coxa muito acima da parte de trás', `${rot}: quadríceps ${g.quadriceps}, posteriores ${g.posteriores}, glúteos ${g.gluteos}`);
    if (g.posteriores < g.quadriceps * 0.4) F.add('posteriores abaixo de 40% do quadríceps', `${rot}: quadríceps ${g.quadriceps}, posteriores ${g.posteriores}`);
    for (const k of Object.keys(sg.diretas)) if (sg.diretas[k] > 22) F.add('grupo acima de 22 séries diretas por semana', `${rot}: ${k} = ${sg.diretas[k]}`);
    const ruins = dicas.map((x) => x.id).filter((x) => x === 'frente-tras' || x.startsWith('muito-'));
    if (ruins.length) F.add('plano do Treinador dispara alerta da tela Evolução', `${rot}: ${ruins}`);
  }
  assert.equal(n, 1600);
  console.log(`   Evolução sobre o plano do Treinador (1.600 planos × 3 semanas): "Descanse mais" ${cont.descanso}, "Equilibre peito e costas" ${cont['empurra-puxa']}`);
  // a agenda nunca põe o mesmo músculo, como principal, em dois dias seguidos (conferido direto no plano, sem a tela Evolução)
  for (const local of LOCAL) for (const experiencia of EXP) for (const dias of DIAS) for (const objetivo of ['hipertrofia', 'saude']) {
    const p = gerarPlano({ ...base, objetivo, experiencia, dias, local }, local === 'minha' ? poucos : GYM_ALL, 0);
    const porDia = {};
    for (const [wd, id] of Object.entries(p.agenda)) { porDia[wd] = {}; for (const it of p.dias.find((x) => x.id === id).itens) { const e = EX_POR_ID.get(it.ex); if (ehCardio(e)) continue; for (const m of new Set(e.primarios)) if (['peito', 'costas', 'ombros', 'quadriceps', 'posteriores', 'gluteos'].includes(grupoDe(m))) porDia[wd][m] = (porDia[wd][m] || 0) + it.series; } }
    for (let wd = 0; wd < 7; wd++) { const hoje = porDia[wd], amanha = porDia[(wd + 1) % 7]; if (!hoje || !amanha) continue; for (const m of Object.keys(hoje)) if (hoje[m] >= 3 && (amanha[m] || 0) >= 3) F.add('mesmo músculo como principal em dias seguidos', `${local}/${objetivo}/${experiencia}/${dias}d: ${m}`); }
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
      if ((deImpacto(it.e) && it.e.nivel >= 2) || /hiit/.test(it.ex)) F.add('população especial com cardio de impacto/alta intensidade', `${rot}: ${it.ex}`);
      if (it.e.nivel > 2) F.add('população especial com exercício avançado', `${rot}: ${it.ex}`);
    }
    if ((extra.condicoes || []).includes('gestante')) {
      // ACOG 804: nada deitada de costas ou de bruços, sem impacto; intensidade moderada
      for (const it of m ? m.itens : []) if (it.e.cuidado.includes('gestante')) F.add('gestante com exercício contraindicado', `${rot}: ${it.ex}`);
      if (m && m.forca.length && m.maxHi < 12) F.add('gestante com faixa de repetições de carga alta', `${rot}: até ${m.maxHi}`);
    }
    // adolescentes: 2 a 4 treinos de força por semana (Faigenbaum 2009)
    // (o limite de 3 treinos de força em dias não seguidos para menores de 18 é conferido em validar)
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
    for (const d of p.dias) for (const it of d.itens) if (deImpacto(EX_POR_ID.get(it.ex))) F.add('IMC 30+ com cardio de impacto', `${experiencia}/${objetivo}/${dias}: ${it.ex}`);
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
    liberar(a);
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
      if (inseguro(pa, pf)) F.add('troca periódica: ' + inseguro(pa, pf), `${rot}: ${t.para}`);
      if (pa.nivel > Math.max(1, pf.conservador ? Math.min(pf.nivel, 2) : pf.nivel)) F.add('troca acima do nível', `${rot}: ${t.para}`);
      if (!temAparelho(pa, pf.local, gym, a2.extras || [])) F.add('troca por aparelho indisponível', `${rot}: ${t.para}`);
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
        // as mesmas regras de segurança do Treinador: modelo de iniciante só com nível 1, sem impacto e sem barra livre composta;
        // nenhum modelo com exercício que o Treinador deixa só para a escolha manual
        if (m.nivel === 1 && ex.nivel > 1) F.add('modelo de iniciante com exercício acima do nível 1', `${m.id}: ${it.ex}`);
        if (m.nivel === 1 && deImpacto(ex)) F.add('modelo de iniciante com cardio de impacto', `${m.id}: ${it.ex}`);
        if (SO_MANUAL.has(ex.id) || (ex.grupo === 'funcional' && ex.padrao !== 'cardio') || NAO_USADOS.has(ex.padrao)) F.add('modelo com exercício que o Treinador deixa só para a escolha manual', `${m.id}: ${it.ex}`);
        // modelo de iniciante só usa exercício de nível 2 quando não existe equivalente de nível 1 (mesmo movimento,
        // mesmo grupo principal e mesma forma de medir: um exercício sem carga não substitui um com carga) com os
        // aparelhos que o próprio modelo já usa
        if (m.nivel === 1 && ex.nivel > 1) {
          const aparelhos = new Set(m.dias.flatMap((x) => x.itens.flatMap((y) => (EX_POR_ID.get(y.ex) || { equip: [] }).equip)));
          const equivalente = EXERCICIOS.find((c) => c.nivel === 1 && c.padrao === ex.padrao && MUSCULOS[c.primarios[0]].grupo === MUSCULOS[ex.primarios[0]].grupo && c.registro === ex.registro && c.equip.every((q) => aparelhos.has(q)));
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
    // (critério independente: o que a descrição do próprio modelo diz que a pessoa precisa ter)
    const prometido = { 'casa-halteres': ['halteres', 'banco_reto', 'banco_inclinado', 'colchonete'], 'peso-corporal': ['colchonete', 'banco_reto', 'caixa'] }[m.id];
    if (m.id === 'casa-halteres') assert.match(m.desc, /halteres.*banco.*colchonete/);
    if (m.id === 'peso-corporal') assert.match(m.desc, /cadeira ou degrau/);
    if (prometido) for (const q of usa) if (!prometido.includes(q)) F.add('modelo caseiro usa aparelho que a descrição não promete', `${m.id}: ${q}`);
    // equilíbrio: uma semana seguindo o modelo, medida pelas mesmas contas da tela Evolução
    const semana = m.agenda.map((i) => m.dias[i]);
    const st = { plans: [], activePlan: '', trainer: { answers: { objetivo: 'hipertrofia', experiencia: 'intermediario' } }, nutri: { answers: {} }, body: [], sessions: semana.map((d, i) => ({ id: 's' + i, inicio: new Date(AGORA - 3600000).toISOString(), fim: new Date(AGORA).toISOString(), itens: d.itens.map((it) => ({ ex: it.ex, sets: Array.from({ length: it.series }, () => ({ kg: 10, reps: 10, seg: 30, ok: true })) })) })) };
    const sg = seriesPorGrupo(st, AGORA, 7);
    const g = sg.porGrupo, d = sg.diretas;
    const rot = `${m.id}: ${Object.keys(g).map((k) => `${k}=${d[k]}/${g[k]}`).join(' ')}`;
    // Sem aparelhos não existe exercício de puxar no catálogo: o modelo "peso-corporal" avisa isso na descrição e é o
    // único dispensado da conferência entre peito e costas (o alerta da Evolução continua valendo para quem o segue).
    if (g.peito >= 6 && g.costas < g.peito * 0.67) F.add('modelo empurra mais do que puxa', rot);
    if (g.quadriceps >= 6 && g.posteriores + g.gluteos * 0.5 < g.quadriceps * 0.5) F.add('modelo com frente de coxa muito acima da parte de trás', rot);
    // teto de séries diretas do nível (o mesmo do Treinador); o grupo em foco do modelo "glúteos e pernas" vai até 20
    for (const k of Object.keys(g)) {
      const teto = TETO[m.nivel];
      if (d[k] > teto) F.add('modelo com séries diretas acima do teto do nível', `${k} > ${teto}: ${rot}`);
      if (g[k] > teto * 1.5) F.add('modelo com séries totais acima de 1,5× o teto', `${k}: ${rot}`);
    }
    for (const k of ['peito', 'costas', 'quadriceps', 'ombros', 'gluteos']) if (g[k] < 4) F.add('modelo com grupo grande abaixo de 4 séries semanais', `${k}: ${rot}`);
    if (g.posteriores < 4) F.add('modelo com posteriores de coxa abaixo de 4 séries semanais', rot);
    const dicas = analisar(st, AGORA).dicas.map((x) => x.id);
    for (const ruim of ['empurra-puxa', 'frente-tras']) if (dicas.includes(ruim)) F.add('modelo dispara alerta de desequilíbrio', `${m.id}: ${ruim}`);
    if (dicas.some((x) => x.startsWith('muito-'))) F.add('modelo dispara alerta de excesso de séries', m.id);
    if (/circuito/i.test(m.desc + m.dias.map((x) => x.nome).join(' '))) F.add('modelo chamado de circuito sem ser circuito', m.id);
  }
  assert.match(MODELOS.find((m) => m.id === 'casa-halteres').desc, /banco com encosto/);
  F.confere('modelos');
});

test('outra versão em TODOS os locais: cada toque muda os exercícios e mantém a dose; quando não há alternativa, a resposta é "não há" (1.600 perfis × 4 toques)', () => {
  const F = new Falhas();
  const poucos = { all: false, has: { halteres: true, banco_reto: true, puxador: true, leg_press_45: true, colchonete: true, esteira: true } };
  const porLocal = {};
  for (const local of LOCAL) for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) {
    const a = { ...base, objetivo, experiencia, dias, tempo, local };
    const gym = local === 'minha' ? poucos : GYM_ALL;
    const rot = `${local}/${objetivo}/${experiencia}/${dias}d/${tempo}min`;
    const st = (porLocal[local] ||= { toques: 0, semOutra: 0, trocados: 0 });
    let v = 0;
    let atual = gerarPlano(a, gym, 0);
    const vistos = new Set([assinatura(atual)]);
    for (let toque = 1; toque <= 4; toque++) {
      const o = outraVersao(a, gym, v);
      TOTAL++;
      st.toques++;
      if (!o) {
        // "não há outra versão" tem de ser verdade: as 12 versões seguintes são iguais à atual
        st.semOutra++;
        for (let k = 1; k <= 12; k++) if (assinatura(gerarPlano(a, gym, v + k)) !== assinatura(atual)) { F.add('disse que não há outra versão, mas há', `${rot}: v${v}+${k}`); break; }
        break;
      }
      const p = o.plano;
      if (assinatura(p) === assinatura(atual)) F.add('toque em "Outra versão" não mudou nenhum exercício', `${rot}: toque ${toque}`);
      if (o.versao <= v || o.versao > v + 12) F.add('número da versão', `${rot}: ${v} → ${o.versao}`);
      if (assinatura(gerarPlano(a, gym, o.versao)) !== assinatura(p)) F.add('o plano devolvido não é o da versão informada', rot);
      if (o.trocados < 1) F.add('contagem de exercícios novos', `${rot}: ${o.trocados}`);
      st.trocados += o.trocados;
      // mesma dose: mesmos treinos, quase o mesmo número de exercícios e de séries na semana
      if (p.dias.length !== atual.dias.length || p.dias.some((d, i) => d.nome !== atual.dias[i].nome)) F.add('outra versão mudou os treinos da semana', rot);
      else if (p.dias.some((d, i) => Math.abs(d.itens.length - atual.dias[i].itens.length) > 2)) F.add('outra versão mudou o número de exercícios de um treino em mais de 2', rot);
      if (Math.abs(doseTotal(p) - doseTotal(atual)) > Math.max(3, doseTotal(atual) * 0.15)) F.add('outra versão mudou o total de séries da semana em mais de 15%', `${rot}: ${doseTotal(atual)} → ${doseTotal(p)}`);
      // o exercício principal de cada treino de força continua (onde ele existe: academia completa e treino em casa)
      if (local !== 'minha') p.dias.forEach((d, i) => { const e0 = EX_POR_ID.get(atual.dias[i].itens[0].ex); if (!ehCardio(e0) && d.itens[0].ex !== e0.id) F.add('outra versão trocou o exercício principal', `${rot}: ${d.nome}`); });
      // e continua sendo um plano válido para o perfil
      if (toque === 1) validar(a, gym, o.versao, F, rot + '/v' + o.versao);
      vistos.add(assinatura(p));
      atual = p; v = o.versao;
    }
    // quem consegue trocar uma vez vê pelo menos 2 treinos diferentes; na academia completa, pelo menos 3 em 4 toques
    if (local === 'completa' && vistos.size < 3) F.add('academia completa com menos de 3 versões diferentes', `${rot}: ${vistos.size}`);
  }
  for (const local of LOCAL) {
    const st = porLocal[local];
    // em todos os locais, a troca funciona em mais de 95% dos toques
    assert.ok(st.semOutra < st.toques * 0.05, `${local}: muitas vezes sem outra versão (${st.semOutra} de ${st.toques})`);
  }
  console.log('   outra versão: ' + LOCAL.map((l) => `${l} ${porLocal[l].toques - porLocal[l].semOutra}/${porLocal[l].toques} toques com troca, média de ${(porLocal[l].trocados / Math.max(1, porLocal[l].toques - porLocal[l].semOutra)).toFixed(1)} exercícios novos`).join('; '));
  // caso sem alternativa de verdade: academia com um único aparelho
  const um1 = { all: false, has: { leg_press_45: true } };
  const aMin = { ...base, local: 'minha', dias: '2', tempo: '30' };
  const o = outraVersao(aMin, um1, 0);
  if (o) assert.notEqual(assinatura(o.plano), assinatura(gerarPlano(aMin, um1, 0)));
  // entradas estranhas não quebram
  for (const v of [-1, 1.5, NaN, undefined, null, '2', 1e9]) assert.doesNotThrow(() => outraVersao(base, GYM_ALL, v));
  assert.equal(outraVersao({ ...base, idade: 12 }, GYM_ALL, 0), null);
  assert.doesNotThrow(() => outraVersao(null, null, 0, null));
  assert.doesNotThrow(() => outraVersao(base, GYM_ALL, 0, { plano: { dias: [{ itens: null }, null] }, dores: 'x' }));
  F.confere('outra versão em todos os locais');
});

test('outra versão com limitações, dores e prioridade: 1.500 perfis aleatórios — muda de fato ou avisa que não há', () => {
  const F = new Falhas();
  const r = semente(4242);
  let nulos = 0, n = 0;
  for (let i = 0; i < 1500; i++) {
    const { a, gym, versao } = perfilAleatorio(r);
    if (a.idade < 14) a.idade = 14 + (i % 70);
    liberar(a);
    const dores = i % 3 === 0 ? doresAleatorias(r, 2) : null;
    const rot = rotulo(a, gym, versao) + (dores ? ' dores ' + dores.map((d) => d.onde + d.nivel).join('+') : '');
    const atual = gerarPlano(a, gym, versao, dores);
    TOTAL++;
    if (!atual.dias.length) continue;
    n++;
    let o;
    try { o = outraVersao(a, gym, versao, { dores }); } catch (e) { F.add('outraVersao lançou erro', `${rot}: ${e.message}`); continue; }
    if (!o) { nulos++; for (let k = 1; k <= 12; k++) if (assinatura(gerarPlano(a, gym, versao + k, dores)) !== assinatura(atual)) { F.add('disse que não há outra versão, mas há', rot); break; } continue; }
    if (assinatura(o.plano) === assinatura(atual)) F.add('outra versão igual à atual', rot);
    if (o.plano.dias.length !== atual.dias.length) F.add('outra versão mudou o número de treinos', rot);
    const pf = perfil(a);
    for (const d of o.plano.dias) for (const it of d.itens) {
      const ex = EX_POR_ID.get(it.ex);
      if (ex.cuidado.some((c) => pf.cuidados.includes(c))) F.add('outra versão trouxe exercício contraindicado', `${rot}: ${it.ex}`);
      for (const dd of dores || []) if (efeitoDaDor(ex, dd, pf) === 'evitar') F.add('outra versão trouxe exercício que a dor manda evitar', `${rot}: ${it.ex}`);
    }
  }
  assert.ok(n > 1300 && nulos < n * 0.2, `sem outra versão em ${nulos} de ${n}`);
  F.confere('outra versão (aleatório)');
});

test('dores: 6.000 combinações de perfil × dores × prioridade — plano adaptado nunca tem exercício a evitar, nunca treina região com dor de alerta, fica dentro do teto e é determinístico', () => {
  const F = new Falhas();
  const r = semente(20261113);
  const visto = { onde: new Set(), tipo: new Set(), classe: new Set() };
  let comAlerta = 0, mudou = 0, vazios = 0;
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const { a, gym, versao } = perfilAleatorio(r);
    if (a.idade < 14) a.idade = 14 + (i % 80);
    liberar(a);
    const dores = doresAleatorias(r);
    const pf = perfil(a);
    for (const d of dores) { visto.onde.add(d.onde); visto.tipo.add(d.tipo); visto.classe.add(classeDor(d, pf)); }
    const rot = rotulo(a, gym, versao) + ' dores ' + dores.map((d) => `${d.onde}/${d.tipo}/${d.nivel}/${d.quando}`).join('+');
    const { p } = validar(a, gym, versao, F, rot, dores);
    TOTAL++;
    if (!p) continue;
    if (!p.dias.length) vazios++;
    // determinístico: a mesma entrada dá o mesmo plano, com as mesmas doses
    const dose = (x) => JSON.stringify(x.dias.map((d) => d.itens.map((it) => [it.ex, it.series, it.reps, it.descanso])));
    if (dose(gerarPlano(a, gym, versao, dores)) !== dose(p)) F.add('plano com dores não é determinístico', rot);
    const sem = gerarPlano(a, gym, versao);
    if (assinatura(sem) !== assinatura(p)) mudou++;
    const alertas = dores.filter((d) => classeDor(d, pf) === 'alerta');
    if (alertas.length) {
      comAlerta++;
      // com dor de alerta: aviso de procurar avaliação, e nenhum exercício da região (conferido em validar)
      for (const d of alertas) if (!p.avisos.some((x) => x.tipo === 'warn' && /Dor de alerta/.test(x.texto) && /médico|fisioterapeuta/.test(x.texto) && x.dor === d.onde)) F.add('dor de alerta sem aviso de avaliação', rot);
    }
    // dor só muscular (sem alerta) não muda o plano: ela passa em poucos dias (Hody 2019; Cheung 2003)
    if (dores.every((d) => d.tipo === 'muscular' && classeDor(d, pf) !== 'alerta') && dose(sem) !== dose(p)) F.add('dor muscular comum mudou o plano', rot);
    // dor leve em articulação (até 2) também não
    if (dores.every((d) => classeDor(d, pf) === 'leve') && dose(sem) !== dose(p)) F.add('dor leve mudou o plano', rot);
    // o aviso de cada exercício do plano concorda com as regras escritas aqui
    for (const d of p.dias) for (const it of d.itens) {
      const al = alertaDoExercicio(it.ex, dores, a);
      if (al && al.nivel === 'evitar') F.add('exercício do plano adaptado com aviso de evitar', `${rot}: ${it.ex}`);
    }
    // orientação de cada dor: texto curto, sem lixo, com fontes que existem
    for (const d of dores) {
      const o = orientacaoDaDor(d, a);
      if (!o || !semLixo(o.texto) || o.texto.length > 260) F.add('orientação da dor', `${rot}: ${o && o.texto}`);
      else {
        if (o.classe !== classeDor(d, pf) || o.alerta !== (o.classe === 'alerta')) F.add('classe da dor', `${rot}: ${d.onde} ${o.classe} × ${classeDor(d, pf)}`);
        if (dorDeAlerta(d) && !o.alerta) F.add('dor de alerta (regra comum) tratada como comum', rot);
        if (!o.refs.length || o.refs.some((k) => !REFS[k])) F.add('orientação sem fonte válida', `${rot}: ${o.refs}`);
      }
    }
  }
  assert.equal(visto.onde.size, LOCAIS.length, 'local de dor não sorteado');
  assert.equal(visto.tipo.size, 3);
  assert.deepEqual([...visto.classe].sort(), ['alerta', 'forte', 'leve', 'media']);
  assert.ok(comAlerta > 1500 && mudou > 2000, `amostra fraca: ${comAlerta} com alerta, ${mudou} planos mudados`);
  assert.ok(vazios < N * 0.08, 'planos vazios demais com dores: ' + vazios);
  F.confere('dores no plano');
});

test('dores: o aviso de cada exercício (catálogo inteiro × 20 locais × 3 tipos × 10 níveis × 4 perfis) segue as regras por tipo, intensidade e perfil', () => {
  const F = new Falhas();
  const perfis = [base, { ...base, experiencia: 'iniciante' }, { ...base, idade: 68 }, { ...base, condicoes: ['gestante'] }];
  let n = 0, evitar = 0, leve = 0;
  for (const a of perfis) {
    const pf = perfil(a);
    for (const onde of LOCAIS) for (const tipo of TIPOS) for (let nivel = 1; nivel <= 10; nivel++) for (const quando of nivel % 5 === 0 ? QUANDO : ['durante']) {
      const d = { id: 'x', data: '2026-11-10', onde, lado: '', tipo, quando, nivel, nota: '', fim: '', dias: 1 };
      for (const ex of EXERCICIOS) {
        n++;
        const esperado = efeitoDaDor(ex, d, pf);
        const al = alertaDoExercicio(ex.id, [d], a);
        const obtido = al ? al.nivel : null;
        const exato = tipo === 'muscular' && classeDor(d, pf) !== 'alerta';
        if (exato ? obtido !== esperado : GRAU[obtido] < GRAU[esperado]) { F.add('aviso do exercício abaixo da regra', `${ex.id} × ${onde}/${tipo}/${nivel}/${quando} (${a.experiencia}, ${a.idade}a): ${obtido} × ${esperado}`); continue; }
        if (!al) continue;
        if (al.nivel === 'evitar') evitar++; else leve++;
        if (!semLixo(al.texto) || al.texto.length > 140 || al.onde !== onde || !al.refs.length || al.refs.some((k) => !REFS[k])) F.add('aviso mal formado', `${ex.id}: ${al.texto}`);
        if (classeDor(d, pf) === 'alerta' && !/médico|fisioterapeuta/.test(al.texto)) F.add('aviso de alerta sem orientar avaliação', al.texto);
      }
    }
  }
  TOTAL += Math.round(n / EXERCICIOS.length);
  assert.ok(evitar > 20000 && leve > 20000, `amostra fraca: ${evitar} evitar, ${leve} leve`);
  // exemplos que qualquer pessoa confere
  const d = (onde, tipo, nivel, quando = 'durante') => [{ onde, tipo, nivel, quando, dias: 1 }];
  // joelho: teto de 3 em 10 (tendão patelar — Breda 2021)
  assert.equal(alertaDoExercicio('agachamento-livre-barra', d('joelho', 'articular', 2), base).nivel, 'leve');
  assert.equal(alertaDoExercicio('agachamento-livre-barra', d('joelho', 'articular', 3), base).nivel, 'leve');
  assert.equal(alertaDoExercicio('agachamento-livre-barra', d('joelho', 'articular', 4), base).nivel, 'evitar');
  assert.equal(alertaDoExercicio('agachamento-livre-barra', d('lombar', 'articular', 4), base).nivel, 'evitar', 'lombar: o modelo não foi testado ali; teto de 3');
  assert.equal(alertaDoExercicio('rosca-direta-barra-w', d('cotovelo', 'articular', 4), base).nivel, 'evitar', 'cotovelo: teto de 3');
  // ombro, Aquiles e quadril: até 5 para quem já treina (Holmgren 2012; Silbernagel 2007; Ageberg 2010)
  assert.equal(alertaDoExercicio('desenvolvimento-maquina', d('ombro', 'articular', 5), base).nivel, 'leve');
  assert.equal(alertaDoExercicio('desenvolvimento-maquina', d('ombro', 'articular', 6), base).nivel, 'evitar');
  assert.equal(alertaDoExercicio('panturrilha-sentado-maquina', d('aquiles', 'articular', 5), base).nivel, 'leve');
  assert.equal(alertaDoExercicio('cadeira-abdutora', d('quadril', 'articular', 5), base).nivel, 'leve');
  // sem supervisão e com perfil conservador ou iniciante: teto de 3 em qualquer região
  assert.equal(alertaDoExercicio('desenvolvimento-maquina', d('ombro', 'articular', 4)).nivel, 'evitar', 'sem as respostas da entrevista vale o teto mais baixo');
  assert.equal(alertaDoExercicio('desenvolvimento-maquina', d('ombro', 'articular', 4), { ...base, idade: 70 }).nivel, 'evitar', '60+: teto de 3');
  assert.equal(alertaDoExercicio('desenvolvimento-maquina', d('ombro', 'articular', 4), { ...base, experiencia: 'nunca' }).nivel, 'evitar', 'iniciante: teto de 3');
  assert.equal(alertaDoExercicio('desenvolvimento-maquina', d('ombro', 'articular', 4), { ...base, condicoes: ['gestante'] }).nivel, 'evitar', 'gestante: teto de 3');
  assert.equal(alertaDoExercicio('desenvolvimento-maquina', d('ombro', 'articular', 3), { ...base, idade: 70 }).nivel, 'leve');
  assert.equal(alertaDoExercicio('agachamento-livre-barra', d('joelho', 'aguda', 3)).nivel, 'evitar');
  assert.equal(alertaDoExercicio('agachamento-livre-barra', d('joelho', 'articular', 3, 'repouso')).nivel, 'evitar');
  assert.equal(alertaDoExercicio('agachamento-livre-barra', d('coxa-frente', 'muscular', 6)).nivel, 'leve', 'dor muscular comum nunca manda evitar');
  assert.equal(alertaDoExercicio('agachamento-livre-barra', d('coxa-frente', 'muscular', 1)).nivel, 'leve', 'dor muscular: mais leve em qualquer intensidade');
  assert.equal(alertaDoExercicio('agachamento-livre-barra', d('coxa-frente', 'muscular', 7)).nivel, 'evitar');
  assert.equal(alertaDoExercicio('cadeira-extensora', d('ombro', 'articular', 9)), null, 'dor no ombro não mexe com a cadeira extensora');
  assert.equal(alertaDoExercicio('agachamento-livre-barra', d('ombro', 'articular', 9)).nivel, 'evitar', 'com dor de alerta no ombro, nada de barra segurada nas costas');
  assert.equal(alertaDoExercicio('supino-reto-barra', d('peito', 'articular', 2)).nivel, 'evitar', 'dor no peito que não é muscular é sempre alerta');
  assert.equal(alertaDoExercicio('supino-reto-barra', d('peito', 'muscular', 2)).nivel, 'leve');
  assert.equal(alertaDoExercicio('panturrilha-em-pe-maquina', d('panturrilha', 'muscular', 2), { ...base, condicoes: ['gestante'] }).nivel, 'evitar', 'gestante: dor na panturrilha é alerta (ACOG 804)');
  // entradas estranhas
  for (const ruim of [null, undefined, 'x', 3, {}, [null], [{}], [{ onde: 'lua', tipo: 'muscular', nivel: 5 }], [{ onde: 'joelho', tipo: 'x', nivel: 5 }], [{ onde: 'joelho', tipo: 'articular', nivel: NaN }], [{ onde: '__proto__', tipo: 'constructor', nivel: 5 }], [{ onde: 'joelho', tipo: 'articular', nivel: 9, fim: '2026-11-01' }]]) {
    assert.equal(alertaDoExercicio('agachamento-livre-barra', ruim), null, JSON.stringify(ruim));
    assert.deepEqual(ajustesPorDor({ dias: gerarPlano(base, GYM_ALL, 0).dias }, base, GYM_ALL, ruim), []);
    assert.doesNotThrow(() => gerarPlano(base, GYM_ALL, 0, ruim));
    assert.equal(assinatura(gerarPlano(base, GYM_ALL, 0, ruim)), assinatura(gerarPlano(base, GYM_ALL, 0)));
  }
  assert.equal(alertaDoExercicio('nao-existe', d('joelho', 'aguda', 9)), null);
  assert.equal(alertaDoExercicio(null, d('joelho', 'aguda', 9)), null);
  assert.equal(orientacaoDaDor(null, base), null);
  assert.equal(orientacaoDaDor({ onde: 'lua' }, base), null);
  F.confere('avisos por exercício');
});

test('dores no plano ATIVO: ajustes propostos (trocar, pular, aliviar), aplicar e desfazer ao melhorar (3.000 planos)', () => {
  const F = new Falhas();
  const r = semente(909);
  const cont = { trocar: 0, pular: 0, aliviar: 0, voltas: 0 };
  for (let i = 0; i < 3000; i++) {
    const { a, gym, versao } = perfilAleatorio(r);
    if (a.idade < 14) a.idade = 14 + (i % 80);
    liberar(a);
    const pf = perfil(a);
    const plano = gerarPlano(a, gym, versao); // plano aceito ANTES de a dor aparecer
    TOTAL++;
    // metade das vezes, só dores moderadas em articulação ou tendão (é onde aparecem as trocas e o "mais leve")
    const dores = doresAleatorias(r).map((d) => (i % 2 ? d : { ...d, tipo: 'articular', quando: 'durante', nivel: 3 + (d.nivel % 4) }));
    const rot = rotulo(a, gym, versao) + ' dores ' + dores.map((d) => `${d.onde}/${d.tipo}/${d.nivel}/${d.quando}`).join('+');
    const dias = plano.dias.map((d) => ({ ...d, itens: d.itens.map((it) => ({ ...it })) }));
    let aj;
    try { aj = ajustesPorDor({ dias }, a, gym, dores); } catch (e) { F.add('ajustesPorDor lançou erro', `${rot}: ${e.message}`); continue; }
    const chave = (x) => x.diaId + '#' + x.idx;
    const porItem = new Map(aj.map((x) => [chave(x), x]));
    if (porItem.size !== aj.length) F.add('dois ajustes para o mesmo exercício', rot);
    const noPlano = new Set(dias.flatMap((d) => d.itens.map((x) => x.ex)));
    const entram = new Set();
    for (const d of dias) d.itens.forEach((it, idx) => {
      const ex = EX_POR_ID.get(it.ex);
      const efeitos = dores.map((dd) => efeitoDaDor(ex, dd, pf));
      const x = porItem.get(d.id + '#' + idx);
      const deAlerta = dores.some((dd) => classeDor(dd, pf) === 'alerta' && efeitoDaDor(ex, dd, pf) === 'evitar');
      if (efeitos.includes('evitar')) {
        // exercício a evitar: sempre há um ajuste, e ele nunca é "aliviar"
        if (!x) { F.add('exercício a evitar sem ajuste proposto', `${rot}: ${it.ex}`); return; }
        if (x.tipo === 'aliviar') F.add('exercício a evitar com ajuste "mais leve"', `${rot}: ${it.ex}`);
        // com dor de alerta não se propõe treinar a região: nada de troca
        if (deAlerta && x.tipo !== 'pular') F.add('dor de alerta com proposta de troca', `${rot}: ${it.ex} → ${x.para}`);
      }
      // o ajuste proposto e o aviso mostrado no treino dizem a mesma coisa
      const al = alertaDoExercicio(it.ex, dores, a);
      if (x && x.tipo === 'pular' && (!al || al.nivel !== 'evitar')) F.add('mandou pular exercício que o aviso não manda evitar', `${rot}: ${it.ex}`);
      if (x && !al) F.add('ajuste em exercício sem aviso de dor', `${rot}: ${it.ex}`);
      if (al && al.nivel === 'evitar' && !x) F.add('aviso manda evitar e não há ajuste proposto', `${rot}: ${it.ex}`);
      if (!x) return;
      cont[x.tipo]++;
      if (x.de !== it.ex || x.dia !== d.nome || !LOCAIS.includes(x.onde) || !semLixo(x.motivo) || x.motivo.length > 110 || !x.refs.length || x.refs.some((k) => !REFS[k])) F.add('ajuste mal formado', `${rot}: ${JSON.stringify(x)}`);
      if (x.tipo !== 'trocar') { if (x.para) F.add('ajuste sem troca com exercício de destino', rot); return; }
      const pa = EX_POR_ID.get(x.para);
      if (!pa) { F.add('troca por exercício inexistente', rot); return; }
      const g = (e) => (MUSCULOS[e.primarios[0]] || {}).grupo;
      if (pa.padrao !== ex.padrao || g(pa) !== g(ex)) F.add('troca por dor muda o movimento ou o grupo', `${rot}: ${x.de} → ${x.para}`);
      if (noPlano.has(x.para) || entram.has(x.para)) F.add('troca por dor repete exercício do plano', `${rot}: ${x.para}`);
      entram.add(x.para);
      if (dores.some((dd) => efeitoDaDor(pa, dd, pf))) F.add('troca por dor traz exercício que também pega uma dor', `${rot}: ${x.de} → ${x.para}`);
      if (pa.cuidado.some((c) => pf.cuidados.includes(c))) F.add('troca por dor piora uma limitação', `${rot}: ${x.para}`);
      if (inseguro(pa, pf)) F.add('troca por dor: ' + inseguro(pa, pf), `${rot}: ${x.para}`);
      if (pa.nivel > Math.max(1, pf.conservador ? Math.min(pf.nivel, 2) : pf.nivel)) F.add('troca por dor acima do nível', `${rot}: ${x.para}`);
      if (!temAparelho(pa, pf.local, gym, a.extras || [])) F.add('troca por dor com aparelho indisponível', `${rot}: ${x.para}`);
      const tipo = (e) => (e.registro === 'peso_reps' || e.registro === 'reps' ? 'reps' : e.registro);
      if (tipo(pa) !== tipo(ex)) F.add('troca por dor muda a unidade da dose', `${rot}: ${x.de} → ${x.para}`);
    });
    // aplicar as trocas e, quando a pessoa marca "Melhorou", desfazer: o plano volta a ser exatamente o de antes
    const trocas = aj.filter((x) => x.tipo === 'trocar');
    const feitas = aplicarTrocasDor(dias, aj);
    if (feitas !== trocas.length) F.add('nem todas as trocas foram aplicadas', `${rot}: ${feitas} de ${trocas.length}`);
    for (const d of dias) for (const it of d.itens) { const ex = EX_POR_ID.get(it.ex); if (it.nota && dores.some((dd) => efeitoDaDor(ex, dd, pf))) F.add('exercício trocado ainda pega uma dor', rot); if (typeof it.nota !== 'string' || it.nota.length > 200) F.add('nota fora do formato do estado', rot); }
    if (new Set(dias.flatMap((d) => d.itens.map((x) => d.id + x.ex))).size !== dias.reduce((t, d) => t + d.itens.length, 0)) F.add('troca por dor repetiu exercício no treino', rot);
    // enquanto a dor continua, nada volta; aplicar de novo não muda mais nada
    if (voltasPorDor({ dias }, a, dores).length) F.add('desfez a troca com a dor ainda ativa', rot);
    if (aplicarTrocasDor(dias, aj) !== 0) F.add('aplicou a mesma troca duas vezes', rot);
    const voltas = voltasPorDor({ dias }, a, []);
    if (voltas.length !== feitas) F.add('trocas que não podem ser desfeitas', `${rot}: ${voltas.length} de ${feitas}`);
    cont.voltas += aplicarVoltasDor(dias, voltas);
    const igual = JSON.stringify(dias.map((d) => d.itens.map((it) => [it.ex, it.series, it.reps, it.descanso, it.nota]))) === JSON.stringify(plano.dias.map((d) => d.itens.map((it) => [it.ex, it.series, it.reps, it.descanso, it.nota])));
    if (!igual) F.add('depois de "Melhorou", o plano não voltou ao que era', rot);
    // as sugestões de troca periódica também respeitam a dor
    for (const t of sugerirTrocas({ dias: plano.dias }, a, gym, 2, dores)) if (dores.some((dd) => ['evitar'].includes(efeitoDaDor(EX_POR_ID.get(t.para), dd, pf)))) F.add('troca periódica trouxe exercício que a dor manda evitar', `${rot}: ${t.para}`);
  }
  assert.ok(cont.trocar > 150 && cont.pular > 3000 && cont.aliviar > 2000 && cont.voltas === cont.trocar, JSON.stringify(cont));
  console.log(`   dores no plano ativo: ${cont.trocar} trocas, ${cont.pular} exercícios para pular, ${cont.aliviar} para fazer mais leve; todas as trocas desfeitas`);
  // entradas estranhas
  assert.deepEqual(ajustesPorDor(null, base, GYM_ALL, doresAleatorias(semente(1))), []);
  assert.deepEqual(ajustesPorDor({ dias: [null, { id: 'x', nome: 'X', itens: [null, { ex: 'nao-existe' }] }] }, base, GYM_ALL, doresAleatorias(semente(1))), []);
  assert.deepEqual(voltasPorDor(null, base, []), []);
  assert.deepEqual(voltasPorDor({ dias: [{ id: 'x', nome: 'X', itens: [{ ex: 'supino-reto-barra', nota: 'dor:joelho:nao-existe' }, { ex: 'supino-reto-barra', nota: 'dor:lua:supino-maquina' }, { ex: 'supino-reto-barra', nota: 'qualquer coisa' }, { ex: 'supino-reto-barra', nota: 42 }] }] }, base, []), []);
  assert.equal(aplicarTrocasDor(null, null), 0);
  assert.equal(aplicarVoltasDor([{ id: 'x', itens: [] }], [{ diaId: 'x', idx: 3, de: 'a', para: 'b' }, null]), 0);
  F.confere('ajustes por dor');
});

test('segurança: a lista "só manual" e as regras por perfil valem para o catálogo inteiro, para as alternativas e para o desempate', () => {
  const F = new Falhas();
  // a lista independente daqui é a mesma do aplicativo, e os exercícios continuam no catálogo (ninguém foi apagado)
  for (const id of SO_MANUAL) { assert.ok(EX_POR_ID.has(id), 'exercício da lista não existe mais no catálogo: ' + id); assert.ok(soManual(id), id); }
  for (const ex of EXERCICIOS) if (soManual(ex.id) && !SO_MANUAL.has(ex.id)) F.add('exercício "só manual" no aplicativo e fora da lista conferida aqui', ex.id);
  // o catálogo marca de forma coerente o que é impacto: todo cardio com corrida, corda ou salto no nome pede cuidado com joelho e tornozelo
  for (const ex of EXERCICIOS) if (ex.padrao === 'cardio' && /corrida|pular|salto|polichinelo/.test(ex.id) && !/sem-salto/.test(ex.id) && !deImpacto(ex)) F.add('cardio de impacto sem as marcas de joelho e tornozelo', ex.id);
  // alternativas de TODOS os exercícios, em todos os locais, para 12 perfis: nenhuma é insegura para o perfil
  const perfis = [
    base, { ...base, experiencia: 'nunca' }, { ...base, experiencia: 'iniciante' }, { ...base, experiencia: 'avancado' }, { ...base, idade: 15 }, { ...base, idade: 67, experiencia: 'avancado' },
    { ...base, condicoes: ['gestante'], experiencia: 'avancado' }, { ...base, condicoes: ['hipertensao'], experiencia: 'avancado' }, { ...base, condicoes: ['cardiaco'] }, { ...base, triagem: ['tontura'], experiencia: 'avancado' },
    { ...base, peso: 130, altura: 165, experiencia: 'avancado' }, { ...base, idade: 80, condicoes: ['gestante', 'hipertensao'], triagem: ['medico'], peso: 120, altura: 160 },
  ];
  let n = 0;
  for (const a0 of perfis) for (const local of LOCAL) {
    const a = { ...a0, local };
    const pf = perfil(a);
    for (const ex of EXERCICIOS) for (const alt of alternativas(ex, pf, GYM_ALL)) { n++; const risco = inseguro(alt, pf); if (risco) F.add('alternativa: ' + risco, `${ex.id} → ${alt.id}`); }
    TOTAL++;
  }
  assert.ok(n > 20000, 'poucas alternativas conferidas: ' + n);
  // desempate: entre equivalentes com a mesma preferência, o mais estável vem antes (máquina, depois cabos, depois halteres)
  const ordem = { maquina: 0, cabo: 1, halteres: 2 };
  const pfBase = perfil(base);
  let pares = 0;
  for (const ex of EXERCICIOS) {
    const l = alternativas(ex, pfBase, GYM_ALL).filter((c) => !c.unilateral && c.modalidade in ordem && !instavel(c));
    for (let i = 1; i < l.length; i++) { pares++; if (ordem[l[i].modalidade] < ordem[l[i - 1].modalidade]) F.add('equivalente menos estável veio antes do mais estável', `${ex.id}: ${l[i - 1].id} antes de ${l[i].id}`); }
  }
  assert.ok(pares > 300, 'poucos pares conferidos: ' + pares);
  // quem está começando ou em dose conservadora treina, na academia completa, quase só em máquinas, cabos e guiado
  for (const extra of [{ experiencia: 'nunca' }, { experiencia: 'iniciante' }, { idade: 70 }, { condicoes: ['hipertensao'] }, { condicoes: ['gestante'] }, { idade: 16 }]) for (const dias of DIAS) {
    const p = gerarPlano({ ...base, ...extra, dias }, GYM_ALL, 0);
    TOTAL++;
    const forca = p.dias.flatMap((d) => d.itens.map((it) => EX_POR_ID.get(it.ex))).filter((e) => ehForca(e) && e.grupo !== 'abdomen');
    const estaveis = forca.filter((e) => ['maquina', 'cabo', 'smith'].includes(e.modalidade)).length;
    if (estaveis < forca.length * 0.7) F.add('perfil iniciante ou conservador com menos de 70% de exercícios em máquina, cabo ou guiado', `${JSON.stringify(extra)}/${dias}d: ${estaveis} de ${forca.length}`);
  }
  F.confere('segurança');
});

test('dor de alerta: nenhum exercício que carregue a região — critério pela mecânica, sem as etiquetas (20 regiões × catálogo inteiro e 20 × 1.200 planos)', () => {
  const F = new Falhas();
  const alerta = (onde) => [{ id: 'a', data: '2026-11-10', onde, lado: '', tipo: 'aguda', quando: 'durante', nivel: 8, nota: '', fim: '', dias: 1 }];
  assert.equal(Object.keys(MEC).length, LOCAIS.length, 'toda região de LOCAIS_DOR tem critério mecânico no teste');
  // 1) catálogo inteiro × região: o que carrega a região pela mecânica recebe "evitar" (alerta) e também quando a dor passa do teto
  let pares = 0, livres = {};
  for (const onde of LOCAIS) {
    livres[onde] = 0;
    for (const ex of EXERCICIOS) {
      pares++;
      const al = alertaDoExercicio(ex.id, alerta(onde), base);
      const carrega = carregaPelaMecanica(ex, onde);
      if (carrega && (!al || al.nivel !== 'evitar')) F.add('exercício que carrega a região sem aviso de evitar (alerta)', `${onde}: ${ex.id} (${ex.padrao})`);
      const forte = alertaDoExercicio(ex.id, [{ ...alerta(onde)[0], tipo: 'articular', nivel: 6 }], base);
      if (carrega && (!forte || forte.nivel !== 'evitar')) F.add('exercício que carrega a região sem aviso de evitar (dor acima do teto)', `${onde}: ${ex.id}`);
      if (!al && ehForca(ex) && ex.grupo !== 'funcional' && MOVIMENTOS.has(ex.padrao) && temAparelho(ex, 'completa', GYM_ALL)) livres[onde]++;
    }
    // o resto do corpo continua: sobram exercícios de força livres da dor
    if (livres[onde] < 12) F.add('quase nada sobra para treinar o resto do corpo', `${onde}: ${livres[onde]} exercícios`);
  }
  assert.equal(pares, LOCAIS.length * EXERCICIOS.length);
  // 2) varredura de planos: 1.200 perfis por região, com dor de alerta
  const cont = {};
  for (const onde of LOCAIS) {
    cont[onde] = { planos: 0, comCarga: 0, vazios: 0, dias: 0 };
    const dores = alerta(onde);
    for (const local of ['completa', 'halteres', 'corporal']) for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) {
      const a = { ...base, objetivo, experiencia, dias, tempo, local };
      const rot = `${onde}/${local}/${objetivo}/${experiencia}/${dias}d/${tempo}min`;
      const p = gerarPlano(a, GYM_ALL, 0, dores);
      TOTAL++; cont[onde].planos++; cont[onde].dias += p.dias.length;
      const pf = perfil(a);
      let carga = false;
      for (const d of p.dias) for (const it of d.itens) {
        const ex = EX_POR_ID.get(it.ex);
        if (carregaPelaMecanica(ex, onde)) { carga = true; F.add('plano com dor de alerta traz exercício que carrega a região (mecânica)', `${rot}: ${it.ex}`); }
        else if (efeitoDaDor(ex, dores[0], pf) === 'evitar') { carga = true; F.add('plano com dor de alerta traz exercício marcado para a região', `${rot}: ${it.ex}`); }
        if (alertaDoExercicio(it.ex, dores, a)) F.add('plano com dor de alerta traz exercício com aviso de dor', `${rot}: ${it.ex}`);
      }
      if (carga) cont[onde].comCarga++;
      if (!p.avisos.some((x) => x.tipo === 'warn' && /Dor de alerta/.test(x.texto) && /médico|fisioterapeuta/.test(x.texto))) F.add('dor de alerta sem aviso de avaliação', rot);
      // menos treinos do que o pedido, ou nenhum: o plano explica
      if (p.dias.length < pf.dias && !p.avisos.some((x) => /cardio ficou fora|viram? descanso|caminhada|não encontrei exercícios/.test(x.texto))) F.add('treinos a menos sem explicação', rot);
      if (!p.dias.length) { cont[onde].vazios++; if (!p.avisos.some((x) => x.tipo === 'warn' && /não encontrei exercícios seguros/.test(x.texto))) F.add('plano vazio sem explicação', rot); }
      for (const d of p.dias) if (!d.itens.length) F.add('treino vazio no plano', rot);
    }
    // na academia completa, com dor de alerta numa só região, sempre sobra treino para o resto do corpo
    for (const experiencia of EXP) for (const dias of DIAS) { const p = gerarPlano({ ...base, experiencia, dias }, GYM_ALL, 0, dores); if (!p.dias.length) F.add('academia completa sem nenhum treino com dor de alerta em uma região', `${onde}/${experiencia}/${dias}d`); }
  }
  console.log('   dor de alerta, planos com exercício que carrega a região (de 1.200 por região): ' + LOCAIS.map((o) => `${o} ${cont[o].comCarga}`).join(', '));
  console.log('   dor de alerta, planos sem nenhum treino (de 1.200): ' + LOCAIS.filter((o) => cont[o].vazios).map((o) => `${o} ${cont[o].vazios}`).join(', '));
  for (const onde of LOCAIS) { assert.equal(cont[onde].planos, 1200); assert.equal(cont[onde].comCarga, 0, onde); }
  F.confere('dor de alerta por região');
});

test('menores de 18 e diabetes: no máximo 3 treinos de força, em dias não seguidos; pedir mais dias nunca dá menos musculação', () => {
  const F = new Falhas();
  let n = 0;
  for (const extra of [{ idade: 16 }, { idade: 14 }, { condicoes: ['diabetes'] }, { condicoes: ['diabetes'], experiencia: 'avancado' }]) for (const objetivo of OBJ) for (const experiencia of EXP) for (const tempo of TEMPO) for (const local of ['completa', 'halteres', 'corporal']) {
    let antes = 0;
    for (const dias of DIAS) {
      const a = { ...base, objetivo, experiencia, tempo, local, dias, ...extra };
      const rot = `${JSON.stringify(extra)}/${objetivo}/${a.experiencia}/${dias}d/${tempo}min/${local}`;
      const { p } = validar(a, GYM_ALL, 0, F, rot);
      TOTAL++; n++;
      const wds = diasDeForca(p);
      if (wds.length > 3 || emDiasSeguidos(wds)) F.add('força em mais de 3 dias ou em dias seguidos', `${rot}: ${wds}`);
      if (wds.length < antes) F.add('pedir mais dias deu menos treinos de força', `${rot}: ${antes} → ${wds.length}`);
      if (Number(dias) >= 3 && wds.length < 3 && local === 'completa') F.add('menos de 3 treinos de força com 3 ou mais dias', `${rot}: ${wds}`);
      antes = wds.length;
    }
  }
  assert.equal(n, 4 * 5 * 4 * 4 * 3 * 5);
  // quem não é menor de 18 nem tem diabetes continua podendo treinar força em 4 ou mais dias
  assert.ok(diasDeForca(gerarPlano({ ...base, dias: '4' }, GYM_ALL, 0)).length === 4);
  assert.ok(diasDeForca(gerarPlano({ ...base, dias: '6', experiencia: 'avancado' }, GYM_ALL, 0)).length === 6);
  F.confere('menores de 18 e diabetes');
});

test('diabetes e outra doença crônica em quem já treina: dose moderada e avisos com os números das diretrizes', () => {
  const forte = { ...base, objetivo: 'forca', experiencia: 'avancado', idade: 45 };
  const semNada = gerarPlano(forte, GYM_ALL, 0);
  assert.ok(semNada.dias.some((d) => d.itens.some((it) => Number(it.reps.split('-')[0]) < 6)), 'sem doença, a força usa cargas altas');
  for (const condicoes of [['diabetes'], ['cronica'], ['diabetes', 'cronica']]) {
    const p = gerarPlano({ ...forte, condicoes }, GYM_ALL, 0);
    for (const d of p.dias) for (const it of d.itens) {
      const ex = EX_POR_ID.get(it.ex);
      if (!ehForca(ex)) continue;
      assert.ok(Number(it.reps.split('-')[0]) >= 8, `menos de 8 repetições com ${condicoes}: ${it.ex} ${it.reps}`);
      assert.ok(it.series <= 3, `mais de 3 séries com ${condicoes}: ${it.ex}`);
    }
    if (condicoes.includes('diabetes')) {
      const av = p.avisos.find((x) => /^Diabetes/.test(x.texto));
      assert.ok(av && av.tipo === 'warn');
      assert.match(av.texto, /90 mg\/dL/); assert.match(av.texto, /15 a 30 g/); assert.match(av.texto, /250/); assert.match(av.texto, /liberação médica/); assert.match(av.texto, /retinopatia/i);
      assert.ok(av.texto.length <= 480, 'aviso de diabetes longo demais: ' + av.texto.length);
    }
    if (condicoes.includes('cronica')) assert.ok(p.avisos.some((x) => /^Doença crônica/.test(x.texto) && /liberação médica/.test(x.texto)));
  }
  assert.ok(!semNada.avisos.some((x) => /Diabetes|Doença crônica/.test(x.texto)));
});

test('flexão nórdica: dose dos protocolos publicados, em qualquer objetivo', () => {
  let n = 0;
  for (const objetivo of OBJ) for (const dias of DIAS) for (const tempo of TEMPO) for (const local of ['completa', 'corporal']) for (let v = 0; v < 4; v++) {
    const p = gerarPlano({ ...base, experiencia: 'avancado', objetivo, dias, tempo, local }, GYM_ALL, v);
    for (const d of p.dias) for (const it of d.itens) if (it.ex === 'flexao-nordica') {
      n++;
      const [lo, hi] = it.reps.split('-').map(Number);
      assert.ok(it.series >= 1 && it.series <= 3 && lo >= 5 && hi <= 12, `nórdica fora do protocolo (${objetivo}/${dias}d/${tempo}/${local}): ${it.series}×${it.reps}`);
      assert.ok(it.descanso >= 60);
    }
  }
  assert.ok(n > 50, 'a flexão nórdica quase não apareceu: ' + n);
  // e só para quem já treina há mais tempo, sem dose conservadora
  for (const extra of [{ experiencia: 'iniciante' }, { experiencia: 'intermediario' }, { experiencia: 'avancado', idade: 65 }, { experiencia: 'avancado', condicoes: ['hipertensao'] }]) for (const local of ['completa', 'corporal']) {
    const p = gerarPlano({ ...base, ...extra, local, dias: '6', tempo: '75' }, GYM_ALL, 0);
    assert.ok(!p.dias.some((d) => d.itens.some((it) => it.ex === 'flexao-nordica')), JSON.stringify(extra));
  }
});

test('corrida + musculação: 5.000 perfis × semana de corrida × prioridade × fortalecimento × dores — todas as regras de segurança continuam valendo', () => {
  const F = new Falhas();
  const r = semente(20261116);
  const N = 5000;
  let comFort = 0, mudou = 0, semDescanso = 0;
  for (let i = 0; i < N; i++) {
    const { a, gym, versao } = perfilAleatorio(r);
    if (a.idade < 14) a.idade = 14 + (i % 80);
    liberar(a);
    // semana de corrida: 2 a 6 dias, até 2 treinos fortes e, quase sempre, um longo
    const dias = [0, 1, 2, 3, 4, 5, 6].sort(() => r() - 0.5).slice(0, inteiro(r, 2, 6));
    const longo = r() < 0.85 ? dias[0] : null;
    const fortes = dias.slice(1, 1 + inteiro(r, 0, 2));
    const corr = { foco: um(r, ['', 'corrida', 'musculacao', 'equilibrio']), fortalecimento: um(r, ['', 'nao', 'sim', 'sim', 'academia', 'casa']), fortes, longo, dias };
    const dores = r() < 0.3 ? doresAleatorias(r, 2) : null;
    const rot = rotulo(a, gym, versao) + ' corrida ' + JSON.stringify(corr) + (dores ? ' dores ' + dores.map((d) => `${d.onde}/${d.tipo}/${d.nivel}`).join('+') : '');
    const { p } = validar(a, gym, versao, F, rot, dores, corr);
    TOTAL++;
    if (!p) continue;
    if (!p.dias.length) continue;
    // quem corre não recebe cardio no plano de musculação
    if (p.minCardio !== 0 || p.dias.some((d) => d.itens.some((it) => ehCardio(EX_POR_ID.get(it.ex))))) F.add('cardio no plano de quem corre', rot);
    if (!p.combinado || p.combinado.foco !== corr.foco) F.add('resumo do combinado ausente', rot);
    // determinístico
    if (assinatura(gerarPlano(a, gym, versao, dores, corr)) !== assinatura(p) || JSON.stringify(gerarPlano(a, gym, versao, dores, corr).agenda).replace(/"d\w+"/g, '') !== JSON.stringify(p.agenda).replace(/"d\w+"/g, '')) F.add('plano combinado não é determinístico', rot);
    // véspera de corrida forte ou do longo: o que o plano diz confere com a agenda
    const chave = new Set([...fortes, ...(longo == null ? [] : [longo])]);
    const pernas = (d) => d.itens.filter((it) => ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'adutores'].includes(EX_POR_ID.get(it.ex).grupo)).length >= 2;
    const vesp = Object.entries(p.agenda).filter(([wd, id]) => chave.has((Number(wd) + 1) % 7) && pernas(p.dias.find((d) => d.id === id))).length;
    const ajusta = corr.foco === 'corrida' || corr.foco === 'equilibrio';
    if (ajusta && p.combinado.vespera !== vesp) F.add('véspera informada difere da agenda', `${rot}: ${p.combinado.vespera} × ${vesp}`);
    if (ajusta && vesp > 0 && !p.avisos.some((x) => x.tipo === 'warn' && /na véspera, treine as pernas mais leve/.test(x.texto))) F.add('pernas na véspera sem aviso', rot);
    const descanso = (x) => 7 - new Set([...dias, ...Object.keys(x.agenda).map(Number)]).size;
    // sem prioridade na corrida, os dias só mudam para a semana não ficar sem descanso
    if (!ajusta && p.combinado.agendaMudou && !p.avisos.some((x) => /Para a semana ter um dia de descanso/.test(x.texto))) F.add('agenda mudou sem prioridade na corrida', rot);
    if (p.combinado.descanso !== descanso(p)) F.add('dias de descanso informados diferem da agenda', rot);
    if (descanso(p) === 0) { semDescanso++; if (!p.avisos.some((x) => x.tipo === 'warn' && /sem nenhum dia de descanso/.test(x.texto))) F.add('semana sem descanso, sem aviso', rot); }
    if (p.combinado.agendaMudou) mudou++;
    // com prioridade na corrida, nunca pior do que sem ela
    if (ajusta) {
      const q = gerarPlano(a, gym, versao, dores, { ...corr, foco: 'musculacao' });
      const vq = Object.entries(q.agenda).filter(([wd, id]) => chave.has((Number(wd) + 1) % 7) && pernas(q.dias.find((d) => d.id === id))).length;
      // (só pode piorar a véspera para guardar um dia de descanso)
      if (vesp > vq && descanso(p) <= descanso(q)) F.add('o encaixe piorou a véspera', `${rot}: ${vesp} > ${vq}`);
      if (descanso(p) < descanso(q) && descanso(p) < 1) F.add('o encaixe tirou o último dia de descanso', rot);
      if (assinatura(q) !== assinatura(p)) F.add('a prioridade mudou os exercícios', rot);
    }
    // fortalecimento: o que o plano diz que tem, tem
    if (['sim', 'academia', 'casa'].includes(corr.fortalecimento)) {
      comFort++;
      const padroes = new Set(p.dias.flatMap((d) => d.itens).map((it) => EX_POR_ID.get(it.ex).padrao));
      const P = { panturrilha: ['flexao_plantar'], 'abdutores do quadril': ['abducao'], 'um pé só': ['afundo'], core: ['anti_extensao', 'flexao_tronco', 'rotacao', 'flexao_quadril'] };
      for (const g of p.combinado.garantidos) if (!P[g].some((x) => padroes.has(x))) F.add('fortalecimento: diz que tem e não tem', `${rot}: ${g}`);
      for (const g of p.combinado.faltam) if (P[g].some((x) => padroes.has(x))) F.add('fortalecimento: diz que falta e tem', `${rot}: ${g}`);
      if (!p.avisos.some((x) => /Fortalecimento para a corrida: o treino tem/.test(x.texto))) F.add('fortalecimento sem aviso', rot);
    } else if (p.avisos.some((x) => /Fortalecimento para a corrida/.test(x.texto))) F.add('aviso de fortalecimento sem o pedido', rot);
  }
  assert.ok(comFort > 1500 && mudou > 400, `amostra fraca: ${comFort} com fortalecimento, ${mudou} agendas mudadas`);
  console.log(`   corrida + musculação: ${mudou} agendas mudadas; ${semDescanso} planos em que corrida e musculação tomam os 7 dias (todos com aviso)`);
  F.confere('corrida + musculação');
});

test('o plano não depende do que foi montado antes: 2.500 perfis em uma ordem e na ordem inversa dão os mesmos planos', () => {
  // (as listas de candidatos ficam guardadas entre as chamadas; nada do que fica guardado pode mudar o resultado)
  const r = semente(20261117);
  const casos = [];
  for (let i = 0; i < 2500; i++) {
    const { a, gym, versao } = perfilAleatorio(r);
    if (a.idade < 14) a.idade = 14 + (i % 80);
    liberar(a);
    const dores = r() < 0.25 ? doresAleatorias(r, 2) : null;
    const corr = r() < 0.3 ? { foco: um(r, ['', 'corrida', 'musculacao', 'equilibrio']), fortalecimento: um(r, ['nao', 'sim']), fortes: [inteiro(r, 0, 6)], longo: inteiro(r, 0, 6), dias: [1, 3, 5, 0] } : null;
    casos.push({ a, gym, versao, dores, corr });
  }
  const ficha = (p) => JSON.stringify([p.dias.map((d) => [d.nome, d.itens.map((it) => [it.ex, it.series, it.reps, it.descanso])]), Object.keys(p.agenda), p.avisos.map((x) => x.texto)]);
  const ida = casos.map((c) => ficha(gerarPlano(c.a, c.gym, c.versao, c.dores, c.corr)));
  let dif = 0, exemplo = '';
  for (let i = casos.length - 1; i >= 0; i--) {
    const c = casos[i];
    if (ficha(gerarPlano(c.a, c.gym, c.versao, c.dores, c.corr)) !== ida[i]) { dif++; if (!exemplo) exemplo = rotulo(c.a, c.gym, c.versao); }
  }
  TOTAL += casos.length;
  assert.equal(dif, 0, `${dif} planos mudaram conforme a ordem das chamadas; exemplo: ${exemplo}`);
});

test('prioridade de músculo: quando não aumenta, o motivo dito é o verdadeiro (9.600 planos, com e sem limitação)', () => {
  const F = new Falhas();
  const cont = {};
  const primario = (ex, g) => ex.primarios.some((m) => grupoDe(m) === g);
  for (const local of ['completa', 'halteres', 'corporal']) for (const objetivo of ['hipertrofia', 'emagrecimento']) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) for (const limitacoes of [['nenhuma'], ['joelho']]) for (const foco of ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'peito', 'costas', 'ombros', 'biceps', 'triceps', 'abdomen']) {
    const a = { ...base, local, objetivo, experiencia, dias, tempo, limitacoes, foco: [foco] };
    const rot = `${foco}/${local}/${objetivo}/${experiencia}/${dias}d/${tempo}min/${limitacoes}`;
    const p = gerarPlano(a, GYM_ALL, 0);
    TOTAL++;
    const pf = perfil(a);
    const x = p.foco[0];
    cont[x.motivo] = (cont[x.motivo] || 0) + 1;
    if ((x.motivo === 'aumentou') !== (x.para > x.de)) F.add('motivo "aumentou" sem aumento (ou o contrário)', rot);
    if (x.para > x.de) continue;
    // exercícios diretos do músculo, com os aparelhos e o nível da pessoa: sem olhar as limitações, e olhando
    const nivelOk = (ex) => ex.nivel <= Math.max(1, pf.conservador ? Math.min(pf.nivel, 2) : pf.nivel);
    const direto = (ex) => primario(ex, foco) && !ehCardio(ex) && ex.grupo !== 'funcional' && (ehForca(ex) || foco === 'abdomen') && MOVIMENTOS.has(ex.padrao) && temAparelho(ex, local, GYM_ALL) && nivelOk(ex) && !inseguro(ex, pf);
    const haSemLimite = EXERCICIOS.some(direto);
    const haComLimite = EXERCICIOS.some((ex) => direto(ex) && !ex.cuidado.some((c) => pf.cuidados.includes(c)));
    const noPlano = p.dias.flatMap((d) => d.itens).filter((it) => primario(EX_POR_ID.get(it.ex), foco) && ehForca(EX_POR_ID.get(it.ex)));
    if (x.motivo === 'sem-direto' && haSemLimite) F.add('diz que não há exercício direto, havendo', `${rot}: ${EXERCICIOS.find(direto).id}`);
    if (x.motivo !== 'sem-direto' && !haSemLimite) F.add('não há exercício direto e o texto diz outra coisa', `${rot}: ${x.texto}`);
    if (x.motivo === 'limitacao' && (haComLimite || !haSemLimite)) F.add('culpa a limitação sem ser ela', rot);
    if (haSemLimite && !haComLimite && x.motivo !== 'limitacao') F.add('a limitação tirou os exercícios e o texto culpa outra coisa', `${rot}: ${x.texto}`);
    if (x.motivo === 'teto' && !(x.diretas >= TETO[pf.nivel] - 1 || x.para >= TETO[pf.nivel] * 1.5 - 1)) F.add('diz que está no máximo do nível sem estar', `${rot}: ${x.diretas} diretas, ${x.para} no total`);
    if (x.motivo === 'max-series' && noPlano.some((it) => it.series < 3)) F.add('diz que os exercícios estão no máximo de séries sem estar', `${rot}: ${noPlano.map((it) => it.series)}`);
    if (x.motivo === 'teto-outro') {
      const outro = Object.keys(NOMES_GRUPO).find((g) => x.texto.includes('máximo de ' + NOMES_GRUPO[g] + ' '));
      const dirs = seriesDiretas(p.dias);
      if (!outro || outro === foco) F.add('teto de outro grupo sem dizer qual', `${rot}: ${x.texto}`);
      else if (!((dirs[outro] || 0) >= TETO[pf.nivel] - 1 || p.volume[outro] >= TETO[pf.nivel] * 1.5 - 1)) F.add('culpa o teto de um grupo que não está no teto', `${rot}: ${outro} ${dirs[outro]}/${p.volume[outro]}`);
    }
    // prioridade no peito travada pelo equilíbrio com as costas: mais uma série de peito passaria de 1,5 vez as costas
    if (x.motivo === 'equilibrio' && !(foco === 'peito' && p.volume.costas < (p.volume.peito + 1) * 0.67)) F.add('culpa o equilíbrio com as costas sem ser ele', `${rot}: peito ${p.volume.peito}, costas ${p.volume.costas}`);
    if (x.motivo === 'tempo') {
      // "sem vaga neste tempo": mais uma série num exercício direto do plano não cabe no tempo do treino (ou não há exercício direto no plano)
      for (const d of p.dias) for (const it of d.itens) {
        if (!noPlano.includes(it) || it.series >= 3) continue;
        const maisUma = { ...d, itens: d.itens.map((y) => (y === it ? { ...y, series: y.series + 1 } : y)) };
        if (duracaoMin(maisUma) <= ORCAMENTO[pf.tempo] + 0.01) F.add('diz que falta tempo, mas cabe mais uma série', `${rot}: ${it.ex} em ${d.nome} (${Math.round(duracaoMin(d))} min)`);
      }
    }
    if (!/^[A-ZÀ-Ú]/.test(x.texto) || /→/.test(x.texto)) F.add('texto do motivo', `${rot}: ${x.texto}`);
  }
  console.log('   prioridade, motivos em 9.600 planos: ' + Object.entries(cont).map(([k, v]) => k + ' ' + v).join(', '));
  F.confere('motivos da prioridade');
});

test('em casa com itens extras: sem marcar, nada além do que a opção diz; marcando um item, só entram os exercícios dele e a segurança continua valendo (16.000 planos)', () => {
  const F = new Falhas();
  const q = PERGUNTAS.find((x) => x.k === 'extras');
  // a pergunta vem logo depois do local, só aparece para quem treina em casa, e as chaves são aparelhos do catálogo
  assert.equal(PERGUNTAS.indexOf(q), PERGUNTAS.findIndex((x) => x.k === 'local') + 1);
  assert.ok(q.se({ local: 'halteres' }) && q.se({ local: 'corporal' }) && !q.se({ local: 'completa' }) && !q.se({ local: 'minha' }));
  assert.equal(q.op[q.op.length - 1][0], 'nenhum'); assert.equal(q.nenhum, 'nenhum'); assert.ok(q.opcional);
  for (const k of EXTRAS) assert.ok(EQUIPAMENTOS[k], 'item extra que não é aparelho do catálogo: ' + k);
  // resposta ausente = "nenhum": respostas antigas continuam completas e dão o mesmo plano
  for (const local of ['halteres', 'corporal']) {
    const a = { ...base, local };
    assert.deepEqual(perfil(a).extras, []);
    assert.equal(assinatura(gerarPlano(a, GYM_ALL, 0)), assinatura(gerarPlano({ ...a, extras: ['nenhum'] }, GYM_ALL, 0)));
  }
  // fora de casa a resposta não muda nada; valores estranhos são ignorados
  assert.deepEqual(perfil({ ...base, local: 'completa', extras: ['elastico'] }).extras, []);
  assert.deepEqual(perfil({ ...base, local: 'corporal', extras: ['elastico', 'leg_press_45', 'xyz', '__proto__', 'nenhum', 7] }).extras, ['elastico']);
  assert.deepEqual(perfil({ ...base, local: 'corporal', extras: 'elastico' }).extras, []);

  const usoDoItem = {};
  let n = 0;
  for (const local of ['halteres', 'corporal']) for (const item of EXTRAS) {
    const chave = local + '+' + item;
    usoDoItem[chave] = new Set();
    // o item devia servir para alguma coisa neste local? (há exercício do catálogo que precisa dele e cabe no que a pessoa tem)
    for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) for (const idade of [30, 70]) {
      const a = { ...base, objetivo, experiencia, dias, tempo, local, idade, extras: [item] };
      const rot = `${chave}/${objetivo}/${experiencia}/${dias}d/${tempo}min/${idade}a`;
      const { p } = validar(a, GYM_ALL, n % 3, F, rot); // validar confere aparelhos (opção do local + item), nível, impacto, instabilidade, apneia, dose, tempo e teto
      TOTAL++; n++;
      for (const d of p.dias) for (const it of d.itens) { const ex = EX_POR_ID.get(it.ex); if (ex.equip.includes(item)) usoDoItem[chave].add(ex.id); for (const e of ex.equip) if (e !== item && !textoDoLocal(local).includes(EQUIPAMENTOS[e].nome.toLowerCase().split(' / ')[0])) F.add('exercício de aparelho que não foi marcado', `${rot}: ${it.ex} (${e})`); }
    }
  }
  assert.equal(n, 2 * EXTRAS.length * 800);
  // cada item marcado é de fato aproveitado onde o catálogo tem exercício para ele
  for (const local of ['halteres', 'corporal']) for (const item of EXTRAS) {
    const serve = EXERCICIOS.some((ex) => ex.equip.includes(item) && temAparelho(ex, local, GYM_ALL, [item]) && !SO_MANUAL.has(ex.id) && ex.grupo !== 'funcional' && ((ehCardio(ex) && ex.registro === 'minutos') || (MOVIMENTOS.has(ex.padrao) && (ehForca(ex) || ex.grupo === 'abdomen'))));
    if (serve && !usoDoItem[local + '+' + item].size) F.add('item extra marcado e nunca usado', local + '+' + item);
    if (!serve && usoDoItem[local + '+' + item].size) F.add('item extra usado sem exercício que o justifique', local + '+' + item);
  }
  console.log('   itens extras, exercícios que cada um destrava nos planos: ' + ['halteres', 'corporal'].map((l) => l + ' → ' + EXTRAS.map((i) => `${i} ${usoDoItem[l + '+' + i].size}`).join(', ')).join(' | '));
  // corda de pular: só como cardio de quem pode impacto; para os demais, o plano manda caminhar
  for (const extra of [{ experiencia: 'iniciante' }, { idade: 70 }, { peso: 120, altura: 165 }, { condicoes: ['hipertensao'] }, { idade: 16 }]) {
    const p = gerarPlano({ ...base, objetivo: 'emagrecimento', dias: '5', local: 'corporal', extras: ['corda_pular'], ...extra }, GYM_ALL, 0);
    assert.ok(!p.dias.some((d) => d.itens.some((it) => it.ex === 'pular-corda')), 'corda para quem não pode impacto: ' + JSON.stringify(extra));
    assert.equal(p.minCardio, 0);
    assert.ok(p.avisos.some((x) => /caminhada/.test(x.texto)));
  }
  const corda = gerarPlano({ ...base, objetivo: 'emagrecimento', dias: '5', local: 'corporal', extras: ['corda_pular'] }, GYM_ALL, 0);
  const itensCorda = corda.dias.flatMap((d) => d.itens).filter((it) => it.ex === 'pular-corda');
  assert.ok(itensCorda.length >= 1 && corda.minCardio > 0);
  for (const it of itensCorda) assert.ok(Number(it.reps) >= 5 && Number(it.reps) <= 20, 'corda fora de 5 a 20 min: ' + it.reps);
  assert.match(corda.orientacoes.find((o) => o[0] === 'Cardio')[1], /já conta/);
  // bicicleta em casa: o dia de cardio volta, com 20 minutos ou mais, para qualquer perfil
  for (const extra of [{}, { experiencia: 'nunca' }, { idade: 70 }, { condicoes: ['hipertensao'] }]) {
    const p = gerarPlano({ ...base, objetivo: 'saude', dias: '5', local: 'halteres', extras: ['bicicleta'], ...extra }, GYM_ALL, 0);
    assert.ok(p.dias.some((d) => /^Cardio/.test(d.nome) && d.itens.some((it) => it.ex === 'bicicleta-ergometrica' && Number(it.reps) >= 20)), 'sem dia de cardio com a bicicleta: ' + JSON.stringify(extra));
  }
  // variedade: exercícios diferentes ao longo de 12 versões, sem extras e com todos os itens marcados
  const variedade = (local, extras, experiencia) => { const u = new Set(); for (const dias of ['3', '5']) for (let v = 0; v < 12; v++) for (const d of gerarPlano({ ...base, local, experiencia, dias, extras }, GYM_ALL, v).dias) for (const it of d.itens) u.add(it.ex); return u.size; };
  const linhas = [];
  for (const local of ['halteres', 'corporal']) for (const experiencia of ['iniciante', 'intermediario', 'avancado']) {
    const sem = variedade(local, ['nenhum'], experiencia), com = variedade(local, EXTRAS, experiencia);
    linhas.push(`${local}/${experiencia} ${sem} → ${com}`);
    assert.ok(com > sem, `os itens extras não aumentaram a variedade (${local}/${experiencia}): ${sem} → ${com}`);
  }
  console.log('   variedade em casa (exercícios distintos em 12 versões, sem extras → com todos): ' + linhas.join('; '));
  F.confere('itens extras em casa');
});

test('referências citadas existem e a contagem de perfis passa de 30 mil', () => {
  for (const k of ['acsm2009', 'acsm2026', 'oms2020', 'aha2024', 'schoenfeld2017vol', 'bazvalle2022', 'schoenfeld2021', 'grgic2018', 'singer2024', 'iversen2021', 'fragala2019', 'faigenbaum2009', 'swift2014', 'acog804', 'whitfield2017', 'bonilla2022', 'schumann2022',
    'pelland2026', 'scarpelli2022', 'barsuhn2025', 'camargo2026', 'bickel2011', 'spiering2021', 'hody2019', 'afonso2021', 'boonstra2016', 'dupuy2018', 'silbernagel2007', 'silbernagel2020', 'smith2017', 'cook2009', 'dubois2020', 'verhagen2016', 'george2021', 'verhagen2016', 'diercks2014', 'jospt2014', 'lloyd2014', 'izquierdo2021', 'mottola2018', 'keogh2017', 'gray2015', 'schoenfeld2011upright',
    'davies2015', 'esc2020', 'sbc_has2020', 'sbc_reab2020', 'sbc_gestacao2021', 'oppert2021', 'wewege2018', 'faigenbaum2010', 'schellenberg2013', 'vigotsky2015', 'joshi2024', 'jasien2015',
    'ageberg2010', 'holmgren2012', 'larsson2019', 'breda2021', 'bateman2021', 'jorgensen2018', 'raulline2025', 'schoenfeld2019vol', 'hackett2013', 'nuckols2025',
    'colberg2016', 'kanaley2022', 'sbd2023', 'whitfield2017', 'gray2015', 'zein2022', 'soligard2008', 'cuthbert2020', 'compendio2024']) assert.ok(REFS[k], k);
  // toda referência citada nos comentários do gerador ("ref xxx" ou "refs xxx, yyy") existe na base
  const fonte = fs.readFileSync(new URL('../www/js/logic/trainer.js', import.meta.url), 'utf8');
  const citadas = new Set();
  for (const m of fonte.matchAll(/\brefs? ([a-z_]+\d[a-z0-9_]*(?:, [a-z_]+\d[a-z0-9_]*)*)/g)) for (const k of m[1].split(', ')) citadas.add(k);
  assert.ok(citadas.size > 40, 'poucas referências achadas no código: ' + citadas.size);
  for (const k of citadas) assert.ok(REFS[k], 'referência citada no código e ausente da base: ' + k);
  // toda fonte citada nas perguntas frequentes do treino existe
  for (const x of FAQ_TREINO) for (const k of x.f) assert.ok(REFS[k], `fonte ausente na pergunta "${x.q}": ${k}`);
  // nenhuma regra de segurança é apresentada só como "escolha do aplicativo"
  for (const x of FAQ_TREINO) assert.doesNotMatch(x.a.join(' '), /escolha do aplicativo|cautela do aplicativo|regra prática do aplicativo|critérios? de cautela do aplicativo/, x.q);
  assert.ok(TOTAL >= 30000, 'perfis testados: ' + TOTAL);
  console.log(`   Treinador: ${TOTAL} planos gerados e conferidos`);
});

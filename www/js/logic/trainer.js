// Treinador virtual: entrevista + regras baseadas em diretrizes publicadas (ACSM 2009/2026, OMS 2020,
// AHA 2024, NSCA 2019, Schoenfeld 2016–2021, Iversen 2021, Kassiano 2022, entre outras — ver data/knowledge.js).
// É um sistema de regras fixas: não inventa nada fora do que está descrito aqui.
import { EXERCICIOS, EX_POR_ID } from '../data/exercises.js';
import { EQUIPAMENTOS } from '../data/equipment.js';
import { FAIXA_DA_RESPOSTA } from './pausa.js';
import { MUSCULOS, GRUPOS, PADROES, CUIDADOS } from '../data/muscles.js';

// ---------- perguntas ----------
export const PERGUNTAS = [
  {
    k: 'objetivo', tipo: 'um', titulo: 'Qual é o seu principal objetivo?',
    ajuda: 'Escolha o que mais importa agora. Dá para mudar depois.',
    op: [
      ['hipertrofia', 'Ganhar massa muscular', 'Aumentar o tamanho dos músculos'],
      ['emagrecimento', 'Emagrecer', 'Perder gordura mantendo os músculos'],
      ['forca', 'Ficar mais forte', 'Aumentar a carga nos exercícios'],
      ['saude', 'Saúde e disposição', 'Movimentar o corpo e se sentir melhor'],
      ['resistencia', 'Resistência e condicionamento', 'Aguentar mais esforço, cansar menos'],
    ],
  },
  { k: 'idade', tipo: 'numero', titulo: 'Quantos anos você tem?', ajuda: 'A idade muda a dose e os cuidados do treino.', min: 10, max: 99, un: 'anos', padrao: 30 },
  { k: 'peso', tipo: 'numero', titulo: 'Qual é o seu peso?', ajuda: 'Uma estimativa já serve.', min: 30, max: 250, un: 'kg', padrao: 70, passo: 0.5, dec: 1 },
  { k: 'altura', tipo: 'numero', titulo: 'Qual é a sua altura?', ajuda: 'Em centímetros.', min: 120, max: 220, un: 'cm', padrao: 170 },
  {
    k: 'experiencia', tipo: 'um', titulo: 'Qual é a sua experiência com musculação?',
    ajuda: 'Conte o tempo em que você treinou, mesmo que esteja parado agora.',
    op: [
      ['nunca', 'Nunca treinei musculação', ''],
      ['iniciante', 'Menos de 6 meses de treino', ''],
      ['intermediario', 'De 6 meses a 2 anos, com regularidade', ''],
      ['avancado', 'Mais de 2 anos, com regularidade', ''],
    ],
  },
  {
    // tempo parado antes de voltar: muda a dose do plano e as orientações de carga (refs bosquet2013, caterisano2019).
    // Opcional para não invalidar entrevistas salvas antes desta pergunta existir; não aparece para quem nunca treinou.
    k: 'pausa', tipo: 'um', opcional: true, se: (a) => a.experiencia !== 'nunca', titulo: 'Há quanto tempo você está sem treinar?',
    ajuda: 'A volta depois de uma pausa pede menos carga e menos séries no começo.',
    op: [
      ['treinando', 'Estou treinando', 'Sem pausa de 2 semanas ou mais'],
      ['2a4s', 'De 2 a 4 semanas', ''],
      ['1a3m', 'De 1 a 3 meses', ''],
      ['3a6m', 'De 3 a 6 meses', ''],
      ['mais6m', 'Mais de 6 meses', ''],
    ],
  },
  {
    k: 'dias', tipo: 'um', titulo: 'Quantos dias por semana você consegue treinar?',
    ajuda: 'Seja realista: o melhor treino é o que você consegue manter.',
    op: [['2', '2 dias', ''], ['3', '3 dias', ''], ['4', '4 dias', ''], ['5', '5 dias', ''], ['6', '6 dias', '']],
  },
  {
    k: 'tempo', tipo: 'um', titulo: 'Quanto tempo você tem por treino?',
    op: [['30', 'Cerca de 30 minutos', ''], ['45', 'Cerca de 45 minutos', ''], ['60', 'Cerca de 1 hora', ''], ['75', 'Mais de 1 hora', '']],
  },
  {
    k: 'local', tipo: 'um', titulo: 'Onde você vai treinar?',
    op: [
      ['completa', 'Academia completa', 'Máquinas, cabos, barras e halteres'],
      ['minha', 'Só os aparelhos que eu marcar', 'Usa a lista “Minha academia”'],
      ['halteres', 'Em casa, com halteres e banco', ''],
      ['corporal', 'Sem aparelhos', 'Só o peso do corpo'],
    ],
  },
  {
    k: 'limitacoes', tipo: 'varios', titulo: 'Você tem dor ou lesão em alguma região?',
    ajuda: 'Vou evitar ou adaptar os exercícios que sobrecarregam essa região.', nenhum: 'nenhuma',
    op: [
      ['nenhuma', 'Nenhuma', ''], ['ombro', 'Ombro', ''], ['joelho', 'Joelho', ''], ['lombar', 'Lombar (parte baixa das costas)', ''],
      ['cervical', 'Pescoço', ''], ['cotovelo', 'Cotovelo', ''], ['punho', 'Punho', ''], ['quadril', 'Quadril', ''], ['tornozelo', 'Tornozelo', ''],
    ],
  },
  {
    k: 'condicoes', tipo: 'varios', titulo: 'Alguma destas condições se aplica a você?', nenhum: 'nenhuma',
    op: [
      ['nenhuma', 'Nenhuma', ''], ['hipertensao', 'Pressão alta', ''], ['cardiaco', 'Problema no coração', ''],
      ['diabetes', 'Diabetes', ''], ['gestante', 'Gestação', ''], ['cronica', 'Outra doença crônica', ''],
    ],
  },
  {
    k: 'triagem', tipo: 'varios', titulo: 'Antes de começar: você tem algum destes sinais?',
    ajuda: 'São perguntas de segurança usadas antes de iniciar exercícios.', nenhum: 'nenhum',
    op: [
      ['nenhum', 'Nenhum deles', ''],
      ['dor_peito', 'Dor ou pressão no peito, em repouso ou ao fazer esforço', ''],
      ['tontura', 'Tontura com perda de equilíbrio ou desmaio nos últimos 12 meses', ''],
      ['falta_ar', 'Falta de ar fora do normal ou palpitações', ''],
      ['osseo', 'Problema nos ossos ou articulações que pode piorar com exercício', ''],
      ['medico', 'Um médico já disse que só devo me exercitar com supervisão', ''],
    ],
  },
  {
    k: 'foco', tipo: 'varios', max: 2, titulo: 'Quer dar atenção extra a alguma parte do corpo?',
    ajuda: 'Escolha até duas. O treino continua equilibrado.', nenhum: 'equilibrado',
    op: [
      ['equilibrado', 'Não, quero um treino equilibrado', ''], ['gluteos', 'Glúteos', ''], ['pernas', 'Pernas', ''], ['peito', 'Peito', ''],
      ['costas', 'Costas', ''], ['ombros', 'Ombros', ''], ['bracos', 'Braços', ''], ['abdomen', 'Abdômen', ''],
    ],
  },
];

export const ROTULO = {
  objetivo: { hipertrofia: 'Ganhar massa muscular', emagrecimento: 'Emagrecer', forca: 'Ficar mais forte', saude: 'Saúde e disposição', resistencia: 'Resistência e condicionamento' },
  experiencia: { nunca: 'Começando agora', iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' },
  pausa: { treinando: 'Sem pausa', '2a4s': '2 a 4 semanas', '1a3m': '1 a 3 meses', '3a6m': '3 a 6 meses', mais6m: 'Mais de 6 meses' },
  local: { completa: 'Academia completa', minha: 'Aparelhos da minha academia', halteres: 'Casa com halteres', corporal: 'Sem aparelhos' },
};

export function respostasCompletas(a) {
  return PERGUNTAS.every((q) => {
    const v = a[q.k];
    if (v == null && (q.opcional || (q.se && !q.se(a)))) return true;
    if (q.tipo === 'numero') return typeof v === 'number' && v >= q.min && v <= q.max;
    if (q.tipo === 'um') return typeof v === 'string' && q.op.some((o) => o[0] === v);
    return Array.isArray(v) && v.length > 0;
  });
}

// ---------- perfil derivado ----------
const opcoes = (k) => new Set(PERGUNTAS.find((q) => q.k === k).op.map((o) => o[0]));
const OPC = { objetivo: opcoes('objetivo'), local: opcoes('local'), limitacoes: opcoes('limitacoes'), condicoes: opcoes('condicoes'), triagem: opcoes('triagem') };
const lista = (x, validas) => (Array.isArray(x) ? [...new Set(x.filter((y) => typeof y === 'string' && (!validas || validas.has(y))))] : []);
const numero = (v, padrao) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
const TEMPOS = [30, 45, 60, 75];
// objetivos em que o aeróbico faz parte do plano (OMS 2020; Donnelly 2009 — refs oms2020, donnelly2009)
const AEROBIO = new Set(['emagrecimento', 'saude', 'resistencia']);

export function perfil(respostas) {
  const a = respostas && typeof respostas === 'object' ? respostas : {};
  const idade = numero(a.idade, 30);
  const cond = lista(a.condicoes, OPC.condicoes);
  const tri = lista(a.triagem, OPC.triagem).filter((x) => x !== 'nenhum');
  const lim = lista(a.limitacoes, OPC.limitacoes).filter((x) => x !== 'nenhuma');
  const nivelBase = a.experiencia === 'avancado' ? 3 : a.experiencia === 'intermediario' ? 2 : 1;
  const nunca = a.experiencia === 'nunca';
  // tempo parado antes de voltar (faixas em logic/pausa.js; refs bosquet2013, caterisano2019): a partir de 3 meses
  // o plano desce um nível; depois de 6 meses, recomeça com a dose de iniciante
  const retorno = nunca ? 0 : FAIXA_DA_RESPOSTA[a.pausa] || 0;
  const nivel = retorno >= 4 ? 1 : retorno === 3 ? Math.max(1, nivelBase - 1) : nivelBase;
  // quem não treina com regularidade há 3 meses ou mais conta como sedentário na triagem (Riebe 2015)
  const inativo = nunca || retorno >= 3;
  const idoso = idade >= 60;
  const jovem = idade < 18;
  const pressao = cond.includes('hipertensao') || cond.includes('cardiaco');
  const gestante = cond.includes('gestante');
  // triagem pré-participação (Riebe 2015 — ref riebe2015): sintomas, doença do coração, gestação, ou sedentário com doença crônica
  const liberacao = tri.length > 0 || cond.includes('cardiaco') || gestante || (inativo && (cond.includes('diabetes') || cond.includes('cronica') || cond.includes('hipertensao')));
  // enquanto não há liberação médica, e sempre com pressão alta ou gestação: cargas leves a moderadas (AHA 2024; ACOG 804 — refs aha2024, acog804)
  const cautela = pressao || gestante || liberacao;
  const conservador = idoso || jovem || cautela;
  const peso = numero(a.peso, 0), altura = numero(a.altura, 0);
  const imc = peso > 0 && altura > 0 ? peso / ((altura / 100) ** 2) : null;
  const cuidados = [...lim];
  if (pressao) cuidados.push('hipertensao');
  if (gestante) cuidados.push('gestante');
  const objetivo = OPC.objetivo.has(a.objetivo) ? a.objetivo : 'saude';
  const d = Math.round(Number(a.dias));
  const t = Number(a.tempo);
  const foco = lista(a.foco).filter((x) => Object.prototype.hasOwnProperty.call(FOCO_SLOTS, x)).slice(0, 2);
  return {
    objetivo, idade, nivel, nivelBase, retorno, inativo, nunca, idoso, jovem, pressao, gestante, liberacao, cautela, conservador, imc,
    // na gestação a dose segue a de saúde, qualquer que seja o objetivo marcado (ACOG 804 — ref acog804)
    objetivoDose: gestante ? 'saude' : objetivo,
    obeso: imc != null && imc >= 30,
    baixoPeso: imc != null && (idoso ? imc < 22 : imc < 18.5),
    dias: Number.isFinite(d) ? Math.min(6, Math.max(2, d)) : 3,
    tempo: Number.isFinite(t) && t > 0 ? TEMPOS.reduce((m, x) => (Math.abs(x - t) < Math.abs(m - t) ? x : m), 60) : 60,
    local: OPC.local.has(a.local) ? a.local : 'completa', limitacoes: lim, cuidados, triagem: tri, foco, bloqueado: idade < 14,
  };
}
const academia = (gym) => (gym && typeof gym === 'object' ? { all: gym.all === true, has: gym.has && typeof gym.has === 'object' ? gym.has : {} } : { all: true, has: {} });

// ---------- divisão semanal ----------
const S = (p, extra) => ({ p: Array.isArray(p) ? p : [p], ...extra });
const CORE = S(['anti_extensao', 'flexao_tronco', 'flexao_quadril', 'rotacao'], { core: true });
const DIAS_MODELO = {
  fullA: { nome: 'Corpo inteiro A', foco: 'Pernas, peito, costas e abdômen', slots: [S('agachar', { main: 1 }), S('empurrar_horizontal', { main: 1 }), S('puxar_horizontal', { main: 1 }), S(['flexao_joelho', 'dobradica_quadril']), S('empurrar_vertical'), S('puxar_vertical'), CORE, S('flexao_plantar')] },
  fullB: { nome: 'Corpo inteiro B', foco: 'Posteriores, costas, ombros e braços', slots: [S(['dobradica_quadril', 'extensao_quadril'], { main: 1 }), S('puxar_vertical', { main: 1 }), S('empurrar_horizontal', { main: 1, alt: 1 }), S(['afundo', 'agachar'], { alt: 1 }), S('elevacao_lateral'), S('flexao_cotovelo'), S('extensao_cotovelo'), CORE] },
  fullC: { nome: 'Corpo inteiro C', foco: 'Pernas, ombros, costas e abdômen', slots: [S('agachar', { main: 1, alt: 1 }), S('empurrar_vertical', { main: 1 }), S('puxar_horizontal', { main: 1, alt: 1 }), S('flexao_joelho'), S('aducao_horizontal'), S('extensao_joelho'), CORE, S('flexao_plantar')] },
  supA: { nome: 'Superiores A', foco: 'Peito, costas, ombros e braços', slots: [S('empurrar_horizontal', { main: 1 }), S('puxar_horizontal', { main: 1 }), S('empurrar_vertical'), S('puxar_vertical'), S('elevacao_lateral'), S('flexao_cotovelo'), S('extensao_cotovelo'), S('abducao_horizontal')] },
  supB: { nome: 'Superiores B', foco: 'Costas, peito, ombros e braços', slots: [S('puxar_vertical', { main: 1 }), S('empurrar_horizontal', { main: 1, alt: 1 }), S('puxar_horizontal', { alt: 1 }), S('aducao_horizontal'), S('abducao_horizontal'), S('flexao_cotovelo', { alt: 1 }), S('extensao_cotovelo', { alt: 1 }), S('elevacao_lateral', { alt: 1 })] },
  infA: { nome: 'Inferiores A', foco: 'Quadríceps, posteriores, panturrilhas e abdômen', slots: [S('agachar', { main: 1 }), S('dobradica_quadril', { main: 1 }), S('extensao_joelho'), S('flexao_joelho'), S('flexao_plantar'), CORE, S('abducao')] },
  infB: { nome: 'Inferiores B', foco: 'Glúteos, posteriores, quadríceps e abdômen', slots: [S('extensao_quadril', { main: 1 }), S('agachar', { main: 1, alt: 1 }), S('afundo'), S('flexao_joelho', { alt: 1 }), S('abducao'), S('flexao_plantar', { alt: 1 }), CORE] },
  push: { nome: 'Empurrar', foco: 'Peito, ombros e tríceps', slots: [S('empurrar_horizontal', { main: 1 }), S('empurrar_vertical', { main: 1 }), S('empurrar_horizontal', { alt: 1 }), S('aducao_horizontal'), S('elevacao_lateral'), S('extensao_cotovelo'), S('extensao_cotovelo', { alt: 1 })] },
  pull: { nome: 'Puxar', foco: 'Costas, bíceps e ombro posterior', slots: [S('puxar_vertical', { main: 1 }), S('puxar_horizontal', { main: 1 }), S(['puxar_vertical', 'extensao_ombro'], { alt: 1 }), S('abducao_horizontal'), S('flexao_cotovelo'), S('flexao_cotovelo', { alt: 1 }), S('encolhimento')] },
  legs: { nome: 'Pernas', foco: 'Quadríceps, posteriores, glúteos e panturrilhas', slots: [S('agachar', { main: 1 }), S('dobradica_quadril', { main: 1 }), S('agachar', { alt: 1 }), S('flexao_joelho'), S('extensao_joelho'), S('flexao_plantar'), CORE] },
  cardio: { nome: 'Cardio e abdômen', foco: 'Coração, fôlego e abdômen', slots: [S('cardio', { cardio: 1 }), S('anti_extensao', { core: true, leve: 1 }), S(['flexao_tronco', 'flexao_quadril', 'rotacao'], { core: true, leve: 1 })] },
};
// cardio no fim do treino de força, para os objetivos em que o aeróbico faz parte do plano
const CARDIO_FIM = S('cardio', { cardio: 1, fim: 1 });

const AGENDA = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] };
// Divisões possíveis para cada número de dias, da preferida para a mais simples. A primeira que der para montar
// com os aparelhos e as limitações da pessoa é a usada.
const D_FULL3 = { dias: ['fullA', 'fullB', 'fullC'] };
const D_SUPINF = { dias: ['supA', 'infA', 'supB', 'infB'] };
const D_PPL = { dias: ['push', 'pull', 'legs'] };
// força em dias alternados e cardio nos outros dias
const D_BASE = {
  3: D_FULL3,
  4: { dias: ['fullA', 'cardio', 'fullB', 'fullC'], agenda: [1, 2, 3, 5] },
  5: { dias: ['fullA', 'cardio', 'fullB', 'cardio', 'fullC'] },
  6: { dias: ['fullA', 'cardio', 'fullB', 'cardio', 'fullC', 'cardio'] },
};
const D_SUPINF_CARDIO = { 5: { dias: ['supA', 'infA', 'cardio', 'supB', 'infB'] }, 6: { dias: ['supA', 'infA', 'cardio', 'supB', 'infB', 'cardio'] } };
function divisoes(pf) {
  const d = pf.dias;
  if (d <= 2) return [{ dias: ['fullA', 'fullB'] }];
  // Iniciantes (2 a 3 treinos de força por semana, até 4 em divisão — ACSM 2009, ref acsm2009) e menores de 18
  // (2 a 3 treinos em dias alternados — NSCA 2009, ref faigenbaum2009): os dias que sobram viram cardio.
  if (pf.nivel === 1 || pf.jovem) return d === 4 ? [D_SUPINF, D_BASE[4]] : [D_BASE[d]];
  if (d === 3) return pf.nivel === 3 ? [D_PPL, D_FULL3] : [D_FULL3];
  if (d === 4) return [D_SUPINF, D_BASE[4]];
  // Emagrecimento, saúde e resistência: 4 treinos de força + cardio (OMS 2020; Donnelly 2009 — refs oms2020, donnelly2009).
  if (AEROBIO.has(pf.objetivoDose)) return [D_SUPINF_CARDIO[d], D_BASE[d]];
  // Hipertrofia e força: cada grupo 2 vezes por semana (Schoenfeld 2016 — ref schoenfeld2016freq).
  return [d === 5 ? { dias: ['push', 'pull', 'legs', 'supB', 'infB'] } : { dias: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] }, D_SUPINF_CARDIO[d], D_BASE[d]];
}
const N_EXERCICIOS = { 30: 4, 45: 6, 60: 7, 75: 9 };
// Duração máxima de cada treino, em minutos: "cerca de 30 min" aceita até 35; "mais de 1 hora" vai até 1h30.
const ORCAMENTO = { 30: 35, 45: 50, 60: 65, 75: 90 };

// ---------- escolha dos exercícios ----------
const ORDEM = new Map(EXERCICIOS.map((e, i) => [e.id, i]));
const POR_PADRAO = {};
for (const e of EXERCICIOS) (POR_PADRAO[e.padrao] || (POR_PADRAO[e.padrao] = [])).push(e);
const CASA = new Set(['halteres', 'banco_reto', 'banco_inclinado', 'colchonete', 'caixa', 'elastico', 'bola_suica']);
const SEM = new Set(['colchonete', 'caixa']);
// cardio com impacto ou saltos: fica fora para 60+, com IMC de 30 ou mais e para quem está em dose conservadora
const IMPACTO = new Set(['corrida-esteira', 'pular-corda', 'polichinelo']);
function disponivel(ex, pf, gym) {
  // "Academia completa" = os aparelhos que quase toda academia tem. Os menos comuns (pêndulo, belt squat, GHD,
  // máquinas articuladas específicas...) só entram quando a pessoa marca o aparelho em "Minha academia".
  if (pf.local === 'completa') return !ex.equip.some((e) => EQUIPAMENTOS[e] && EQUIPAMENTOS[e].raro);
  if (pf.local === 'minha') return gym.all || ex.equip.every((e) => gym.has[e] === true);
  if (pf.local === 'halteres') return ex.equip.every((e) => CASA.has(e));
  return ex.equip.every((e) => SEM.has(e));
}
export function permitido(ex, pf) {
  if (ex.cuidado.some((c) => pf.cuidados.includes(c))) return false;
  const max = pf.conservador ? Math.min(pf.nivel, 2) : pf.nivel;
  // iniciantes: só exercícios simples; os demais podem ir um nível acima em exercícios auxiliares
  return ex.nivel <= Math.max(1, max);
}
function nota(ex, slot, pf) {
  let n = 0;
  const m = ex.modalidade;
  const simples = pf.nivel === 1 || pf.conservador;
  if (simples) n += { maquina: 5, cabo: 4, smith: 3, halteres: 2, peso_corporal: 2, barra: 0, kettlebell: 0 }[m] ?? 1;
  else if (slot.main) n += { barra: pf.nivel === 3 ? 5 : 4, halteres: 4, maquina: 2, smith: 2, cabo: 2, peso_corporal: 2 }[m] ?? 1;
  else n += { halteres: 4, cabo: 4, maquina: 4, barra: 3, smith: 2, peso_corporal: 2 }[m] ?? 1;
  if (slot.main && ex.tipo === 'composto') n += 3;
  if (ex.unilateral) n -= simples ? 3 : 1;
  if (ex.nivel === 1 && simples) n += 2;
  if (pf.local === 'corporal' || pf.local === 'halteres') n += ex.registro === 'reps' || ex.registro === 'peso_reps' ? 1 : 0;
  if (slot.core && ex.registro === 'segundos') n += pf.nivel === 1 ? 2 : 0;
  if (pf.idoso && m === 'maquina') n += 2;
  // barra fixa e paralelas não deixam ajustar a carga: nas faixas de 10 ou mais repetições (emagrecimento, saúde, resistência) os cabos e máquinas vêm antes
  if (AEROBIO.has(pf.objetivoDose) && ex.registro === 'reps' && (ex.equip.includes('barra_fixa') || ex.equip.includes('paralelas'))) n -= 3;
  if (slot.cardio && ex.registro === 'minutos') n += 4; // no cardio, os aparelhos (medidos em minutos) vêm antes dos exercícios de salto
  if (simples && ex.equip.includes('graviton')) n -= 4; // para iniciantes, puxadas e remadas sentadas vêm antes da barra assistida
  return n;
}
function candidatos(slot, pf, gym) {
  const out = [];
  for (const padrao of slot.p) {
    for (const ex of POR_PADRAO[padrao] || []) {
      if (!disponivel(ex, pf, gym) || !permitido(ex, pf)) continue;
      if (slot.cardio) {
        if (ex.id.includes('hiit')) continue;
        if ((ex.id === 'corrida-esteira' || ex.id === 'pular-corda') && (pf.nivel === 1 || pf.conservador)) continue;
        if (IMPACTO.has(ex.id) && (pf.obeso || pf.idoso || pf.cautela)) continue;
      } else if (ex.grupo === 'cardio' || ex.grupo === 'funcional') continue;
      else if (!slot.core && ex.registro !== 'peso_reps' && ex.registro !== 'reps') continue;
      out.push({ ex, n: nota(ex, slot, pf), p: slot.ordem ? slot.p.indexOf(padrao) : 0, o: ORDEM.get(ex.id) });
    }
  }
  // `ordem`: os movimentos da vaga são tentados na ordem em que foram listados (o segundo só entra se faltar o primeiro)
  out.sort((a, b) => a.p - b.p || b.n - a.n || a.o - b.o);
  return out.map((x) => x.ex);
}
// As listas de candidatos só dependem destes dados do perfil; ficam guardadas para as próximas chamadas (a tela do
// Treinador monta o plano a cada redesenho).
const CACHE = new Map();
function listasDoPerfil(pf, gym) {
  const chave = [pf.local, pf.local !== 'minha' ? '' : gym.all ? '*' : Object.keys(gym.has).filter((k) => gym.has[k] === true).sort().join(','), pf.cuidados.slice().sort().join(','), pf.nivel, +pf.conservador, +pf.idoso, +pf.obeso, +pf.cautela, +AEROBIO.has(pf.objetivoDose)].join('|');
  let m = CACHE.get(chave);
  if (!m) { if (CACHE.size >= 60) CACHE.clear(); CACHE.set(chave, (m = new Map())); }
  return m;
}

// ---------- séries, repetições e descanso ----------
// Faixas por objetivo (ACSM 2009; Schoenfeld 2021; Grgic 2018; Singer 2024 — refs acsm2009, schoenfeld2021, grgic2018, singer2024):
//   força: cargas altas (3 a 6 repetições) e 2 a 3 min de descanso nos principais; iniciantes ficam em 8 a 12;
//   hipertrofia: 8 a 15 repetições, 1 a 2 min; emagrecimento: 10 a 15, até 90 s; saúde: 2 séries de 10 a 15;
//   resistência: 15 a 20 repetições com até 1 min de descanso.
function dose(ex, slot, pf) {
  const obj = pf.objetivoDose;
  if (slot.cardio) {
    if (ex.registro !== 'minutos') return { series: slot.fim ? 2 : 3, reps: '30', descanso: 45, tipo: 'cardio' };
    let min;
    if (slot.fim) min = obj === 'saude' || pf.tempo <= 45 ? 10 : pf.tempo >= 75 ? 20 : 15;
    else {
      // dia de cardio: 20 min para quem busca força ou massa; até 30 min (conservador/iniciante) ou 40 min nos outros objetivos
      const max = !AEROBIO.has(obj) ? 20 : pf.nivel === 1 || pf.conservador ? 30 : 40;
      min = Math.min(max, Math.max(20, pf.tempo - 15));
    }
    return { series: 1, reps: String(min), descanso: 0, tipo: 'cardio' };
  }
  if (ex.registro === 'segundos') return { series: pf.nivel === 1 || slot.leve ? 2 : 3, reps: pf.nivel === 1 ? '20' : '30', descanso: 45, tipo: 'iso' };
  const iso = ex.tipo === 'isolado' || slot.core;
  const tipo = slot.main && !iso ? 'main' : iso ? 'iso' : 'aux';
  const T = {
    hipertrofia: { main: [3, '8-12', 120], aux: [3, '10-12', 90], iso: [3, '10-15', 60] },
    forca: pf.nivel === 1
      ? { main: [3, '8-10', 120], aux: [3, '8-12', 90], iso: [3, '10-12', 75] }
      : { main: pf.nivel === 2 ? [4, '4-6', 180] : [4, '3-5', 180], aux: [3, '6-10', 120], iso: [3, '8-12', 75] },
    emagrecimento: { main: [3, '10-12', 90], aux: [3, '12-15', 60], iso: [2, '12-15', 60] },
    saude: { main: [2, '10-12', 90], aux: [2, '10-12', 75], iso: [2, '12-15', 60] },
    resistencia: { main: [3, '15-20', 60], aux: [2, '15-20', 45], iso: [2, '15-20', 45] },
  }[obj] || {};
  let [series, reps, descanso] = T[tipo] || [3, '10-12', 90];
  // exercício com o peso do corpo (fora barra fixa e paralelas) não tem como ficar "pesado": a faixa mínima é 8 a 12
  if (ex.registro === 'reps' && Number(reps.split('-')[0]) < 8 && !ex.equip.includes('barra_fixa') && !ex.equip.includes('paralelas')) { reps = '8-12'; descanso = Math.min(descanso, 120); }
  if (pf.nunca && series > 2) series = 2;                  // primeiras semanas: 1 a 3 séries bastam (ACSM/AHA)
  if (pf.idoso) { series = Math.min(series, 2 + (pf.nivel > 1 ? 1 : 0)); reps = '10-12'; descanso = Math.max(descanso, 90); }
  if (pf.retorno >= 3) series = Math.min(series, 3);       // volta de 3 meses ou mais parado: até 3 séries (ref caterisano2019)
  if (pf.jovem) { reps = iso ? '12-15' : '10-15'; series = Math.min(series, 3); }
  // pressão alta, coração, gestação ou triagem positiva: nada de cargas altas (AHA 2024; ACOG 804; Riebe 2015)
  if (pf.cautela) { const lo = Number(reps.split('-')[0]); if (lo < 10) reps = '10-15'; descanso = Math.max(descanso, 90); series = Math.min(series, 3); }
  if (slot.core && ex.registro !== 'segundos') { reps = pf.nivel === 1 ? '10-12' : obj === 'resistencia' ? '15-20' : '12-15'; descanso = 45; }
  if (slot.leve) series = Math.min(series, 2);
  return { series, reps, descanso, tipo };
}

// duração estimada de um treino, em segundos: 5 min de aquecimento, 40 s por série mais o descanso e 1 min de troca
// por exercício (a mesma conta mostrada nas telas)
function segundos(itens) {
  let seg = 300;
  for (const it of itens) {
    const ex = EX_POR_ID.get(it.ex);
    if (ex && ex.registro === 'minutos') { seg += (Number(it.reps) || 0) * 60; continue; }
    const trabalho = ex && ex.registro === 'segundos' ? Number(it.reps) || 30 : 40;
    seg += it.series * (trabalho + it.descanso) + 60;
  }
  return seg;
}
export const duracaoEstimada = (dia) => Math.max(5, Math.round(segundos(dia && Array.isArray(dia.itens) ? dia.itens : []) / 300) * 5);

// Faz o treino caber no tempo informado. Ordem dos cortes (Iversen 2021 — ref iversen2021: com pouco tempo, encurtar
// descansos e manter os exercícios multiarticulares): descanso dos auxiliares, descanso dos principais, séries dos
// auxiliares, cardio do fim, último auxiliar. No objetivo força, o descanso longo dos principais é o último a cair
// (Grgic 2018 — ref grgic2018).
function caberNoTempo(itens, pf) {
  const limite = ORCAMENTO[pf.tempo] * 60;
  const obj = pf.objetivoDose;
  const suave = pf.cautela || pf.idoso;
  const piso = (it) => {
    if (suave) return it._tipo === 'main' ? 90 : it._tipo === 'aux' ? 75 : 60;
    if (obj === 'forca' && pf.nivel > 1) return it._tipo === 'main' ? 120 : it._tipo === 'aux' ? 90 : 60;
    if (obj === 'resistencia') return it._tipo === 'main' ? 45 : 30;
    return it._tipo === 'iso' ? 45 : 60;
  };
  const aux = (it) => !it._main && !it._cardio;
  const nForca = () => itens.filter((it) => !it._cardio).length;
  const ultimo = (f) => { for (let i = itens.length - 1; i >= 0; i--) if (f(itens[i])) return i; return -1; };
  const passos = {
    descansoAux: () => { let ok = false; for (const it of itens) if (aux(it) && it.descanso - 15 >= piso(it)) { it.descanso -= 15; ok = true; } return ok; },
    descansoMain: () => { let ok = false; for (const it of itens) if (it._main && it.descanso - 15 >= piso(it)) { it.descanso -= 15; ok = true; } return ok; },
    seriesAux: () => { const i = ultimo((it) => aux(it) && it.series > 2); if (i < 0) return false; itens[i].series--; return true; },
    cardioMenor: () => { const i = ultimo((it) => it._cardio && it._fim && Number(it.reps) > 10); if (i < 0) return false; itens[i].reps = String(Number(itens[i].reps) - 5); return true; },
    tiraAux: () => { const i = ultimo((it) => aux(it) && !it._foco); if (i < 0 || nForca() <= 3) return false; itens.splice(i, 1); return true; },
    tiraFoco: () => { const i = ultimo((it) => aux(it) && it._foco); if (i < 0 || nForca() <= 3) return false; itens.splice(i, 1); return true; },
    tiraCardio: () => { const i = ultimo((it) => it._cardio && it._fim); if (i < 0) return false; itens.splice(i, 1); return true; },
    seriesMain: () => { const i = ultimo((it) => it._main && it.series > (obj === 'forca' ? 3 : 2)); if (i < 0) return false; itens[i].series--; return true; },
    tiraQualquer: () => { if (itens.length <= 3) return false; itens.pop(); return true; },
    seriesMinimas: () => { const i = ultimo((it) => !it._cardio && it.series > 1); if (i < 0) return false; itens[i].series--; return true; },
  };
  const ordem = obj === 'forca' && pf.nivel > 1
    ? ['descansoAux', 'seriesAux', 'tiraAux', 'descansoMain', 'seriesMain', 'tiraFoco', 'tiraQualquer', 'seriesMinimas']
    : ['descansoAux', 'descansoMain', 'seriesAux', 'cardioMenor', 'tiraAux', 'tiraCardio', 'tiraFoco', 'seriesMain', 'tiraQualquer', 'seriesMinimas'];
  for (let k = 0; k < 400 && segundos(itens) > limite; k++) {
    if (!ordem.some((nome) => passos[nome]())) break;
  }
}

// slots extras para a parte do corpo que o usuário quer priorizar
const FOCO_SLOTS = {
  gluteos: [S('extensao_quadril'), S('abducao')], pernas: [S(['extensao_joelho', 'afundo'], { ordem: 1 }), S('flexao_joelho')],
  peito: [S('aducao_horizontal'), S('empurrar_horizontal', { alt: 1 })], costas: [S('puxar_horizontal', { alt: 1 }), S(['extensao_ombro', 'puxar_vertical'], { alt: 1 })],
  ombros: [S('elevacao_lateral'), S('abducao_horizontal')], bracos: [S('flexao_cotovelo', { alt: 1 }), S('extensao_cotovelo', { alt: 1 })],
  abdomen: [S(['flexao_tronco', 'flexao_quadril'], { core: true }), S(['anti_extensao', 'rotacao'], { core: true })],
};
const FOCO_ONDE = {
  gluteos: ['fullA', 'fullB', 'fullC', 'infA', 'infB', 'legs'], pernas: ['fullA', 'fullB', 'fullC', 'infA', 'infB', 'legs'],
  peito: ['fullA', 'fullC', 'supA', 'supB', 'push'], costas: ['fullA', 'fullB', 'supA', 'supB', 'pull'], ombros: ['fullB', 'fullC', 'supA', 'supB', 'push'],
  bracos: ['fullA', 'fullC', 'supA', 'supB', 'push', 'pull'], abdomen: ['fullA', 'fullB', 'fullC', 'infA', 'infB', 'legs', 'push', 'pull', 'supA', 'supB'],
};
// movimentos que já trabalham a parte do corpo em foco (a vaga extra não toma o lugar deles)
const FOCO_PADROES = {
  gluteos: ['extensao_quadril', 'abducao', 'agachar', 'afundo', 'dobradica_quadril'], pernas: ['extensao_joelho', 'afundo', 'flexao_joelho', 'agachar', 'dobradica_quadril'],
  peito: ['aducao_horizontal', 'empurrar_horizontal'], costas: ['puxar_horizontal', 'puxar_vertical', 'extensao_ombro'], ombros: ['elevacao_lateral', 'abducao_horizontal', 'empurrar_vertical'],
  bracos: ['flexao_cotovelo', 'extensao_cotovelo'], abdomen: ['flexao_tronco', 'flexao_quadril', 'anti_extensao', 'rotacao'],
};
const FOCO_GRUPOS = { gluteos: ['gluteos'], pernas: ['quadriceps', 'posteriores'], peito: ['peito'], costas: ['costas'], ombros: ['ombros'], bracos: ['biceps', 'triceps'], abdomen: ['abdomen'] };

// Se uma limitação elimina todos os exercícios de um tipo de movimento, o Treinador tenta um movimento
// vizinho que trabalha a mesma região sem sobrecarregar a articulação (sempre respeitando os cuidados).
const SUBSTITUTOS = {
  agachar: ['extensao_quadril', 'abducao', 'aducao'], afundo: ['extensao_quadril', 'abducao', 'aducao'],
  dobradica_quadril: ['extensao_quadril', 'abducao'], flexao_joelho: ['extensao_quadril', 'abducao'], extensao_joelho: ['abducao', 'aducao', 'flexao_plantar'],
  extensao_quadril: ['abducao'], empurrar_horizontal: ['aducao_horizontal'], empurrar_vertical: ['elevacao_lateral', 'elevacao_frontal'],
  puxar_vertical: ['puxar_horizontal', 'extensao_ombro'], puxar_horizontal: ['puxar_vertical', 'abducao_horizontal'],
};

// Movimentos de reserva de cada tipo de treino: completam o dia quando faltam aparelhos ou sobram limitações.
const R_SUP = ['empurrar_horizontal', 'puxar_horizontal', 'empurrar_vertical', 'puxar_vertical', 'elevacao_lateral', 'abducao_horizontal', 'flexao_cotovelo', 'extensao_cotovelo', 'aducao_horizontal', 'extensao_ombro', 'encolhimento'];
const R_INF = ['agachar', 'dobradica_quadril', 'extensao_quadril', 'afundo', 'flexao_joelho', 'extensao_joelho', 'abducao', 'flexao_plantar', 'aducao'];
const R_CORE = ['anti_extensao', 'flexao_tronco', 'flexao_quadril', 'rotacao'];
const R_FULL = ['agachar', 'empurrar_horizontal', 'puxar_horizontal', 'dobradica_quadril', 'empurrar_vertical', 'puxar_vertical', 'extensao_quadril', 'afundo', 'flexao_joelho', 'elevacao_lateral', 'extensao_joelho', 'flexao_cotovelo', 'extensao_cotovelo', 'abducao', 'abducao_horizontal', 'aducao_horizontal', 'flexao_plantar', 'extensao_ombro', 'aducao', 'encolhimento', ...R_CORE];
const RESERVA = {
  fullA: R_FULL, fullB: R_FULL, fullC: R_FULL, supA: [...R_SUP, ...R_CORE], supB: [...R_SUP, ...R_CORE], infA: [...R_INF, ...R_CORE], infB: [...R_INF, ...R_CORE],
  push: ['empurrar_horizontal', 'empurrar_vertical', 'aducao_horizontal', 'elevacao_lateral', 'extensao_cotovelo', ...R_CORE],
  pull: ['puxar_vertical', 'puxar_horizontal', 'extensao_ombro', 'abducao_horizontal', 'flexao_cotovelo', 'encolhimento', ...R_CORE],
  legs: [...R_INF, ...R_CORE], cardio: R_CORE,
};
const SLOT_RESERVA = Object.fromEntries(R_FULL.map((p) => [p, S(p, R_CORE.includes(p) ? { core: true } : {})]));

const idCurto = (i) => 'd' + (i + 1) + Math.random().toString(36).slice(2, 7);

// Monta o plano. `versao` muda os exercícios auxiliares (rotação); os principais ficam.
export function gerarPlano(respostas, gymBruta, versaoBruta = 0) {
  const pf = perfil(respostas);
  if (pf.bloqueado) return null;
  const gym = academia(gymBruta);
  const versao = Math.abs(Math.floor(Number(versaoBruta))) % 1000000 || 0;
  const limite = N_EXERCICIOS[pf.tempo] || 7;
  const memo = listasDoPerfil(pf, gym);
  const cands = (slot) => { let c = memo.get(slot); if (!c) { c = candidatos(slot, pf, gym); memo.set(slot, c); } return c; };
  const temCardio = cands(CARDIO_FIM).length > 0;
  // o mesmo perfil sem as limitações: serve para saber se uma vaga ficou vazia por causa delas
  const pfSemLimites = { ...pf, cuidados: [], cautela: false, idoso: false };
  const semLimites = listasDoPerfil(pfSemLimites, gym);

  // escolhe a divisão: a primeira em que todo treino de força tem pelo menos 3 movimentos possíveis, um deles principal
  const viavel = (chave) => {
    if (chave === 'cardio') return true;
    const ok = DIAS_MODELO[chave].slots.filter((s) => cands(s).length > 0);
    return ok.length >= 3 && ok.some((s) => s.main);
  };
  const opcoesDiv = divisoes(pf);
  const div = opcoesDiv.find((o) => o.dias.every(viavel)) || opcoesDiv[opcoesDiv.length - 1];
  const chaves = div.dias;
  const semana = div.agenda || AGENDA[pf.dias] || AGENDA[3];

  const usados = new Set();
  const omitidos = new Set();
  const visto = {};
  let semCardio = false;
  // 1) as vagas de cada treino
  const vezFoco = {};
  const montagem = chaves.map((chave, di) => {
    const modelo = DIAS_MODELO[chave];
    const repeticao = (visto[chave] = (visto[chave] || 0) + 1) - 1;
    let slots = modelo.slots.slice();
    const doFoco = new Set();
    if (chave !== 'cardio') {
      // emagrecimento, saúde e resistência: com 45 min ou mais, a última vaga do treino é do cardio
      const fim = AEROBIO.has(pf.objetivoDose) && pf.tempo >= 45 && temCardio;
      const vagas = fim ? limite - 1 : limite;
      // foco: uma vaga extra para a parte do corpo escolhida. Se o treino já está cheio, ela entra no lugar da última
      // vaga auxiliar de outra parte do corpo (com 30 min não há o que trocar: o foco entra só nas séries).
      let extra = 0;
      if (limite > 4) for (const f of pf.foco) {
        if (!FOCO_ONDE[f] || !FOCO_ONDE[f].includes(chave)) continue;
        const fs = FOCO_SLOTS[f][(vezFoco[f] = (vezFoco[f] || 0) + 1) % 2]; // alterna as duas vagas de cada foco ao longo da semana
        if (slots.length >= vagas) {
          slots = slots.slice(0, vagas);
          let i = slots.length - 1;
          while (i >= 0 && (slots[i].main || doFoco.has(slots[i]) || slots[i].p.some((p) => FOCO_PADROES[f].includes(p)))) i--;
          if (i < 0) continue;
          slots.splice(i, 1);
        }
        slots.splice(Math.min(slots.length, 3 + extra), 0, fs);
        doFoco.add(fs);
        extra++;
      }
      slots = slots.slice(0, vagas);
      if (fim) slots.push(CARDIO_FIM);
    }
    return { chave, di, modelo, repeticao, slots, doFoco, escolhas: new Array(slots.length).fill(null), noDia: new Set(), padroes: new Set(), itens: [] };
  });
  // 2) os exercícios: primeiro os principais de todos os treinos (assim eles não mudam de uma versão para outra), depois os auxiliares
  const reservar = (m, ex) => { m.noDia.add(ex.id); usados.add(ex.id); m.padroes.add(ex.padrao); };
  const escolher = (m, i) => {
    let slot = m.slots[i];
    let l = cands(slot).filter((e) => !m.noDia.has(e.id));
    if (!l.length && pf.cuidados.length && !slot.cardio) {
      const viz = [...new Set(slot.p.flatMap((p) => SUBSTITUTOS[p] || []))];
      if (viz.length) {
        const chaveTroca = 'troca:' + viz.join(',') + (slot.core ? ':core' : '');
        let troca = memo.get(chaveTroca);
        if (!troca) memo.set(chaveTroca, (troca = { ...slot, p: viz, main: false }));
        const l2 = cands(troca).filter((e) => !m.noDia.has(e.id) && !usados.has(e.id));
        if (l2.length) { l = l2; slot = troca; }
      }
    }
    if (!l.length) {
      // a vaga ficou vazia por causa de uma limitação informada? anota para avisar o usuário
      if (!slot.cardio && pf.cuidados.length) {
        let l0 = semLimites.get(slot);
        if (!l0) semLimites.set(slot, (l0 = candidatos(slot, pfSemLimites, gym)));
        if (l0.length) omitidos.add(PADROES[slot.p[0]]);
      }
      return;
    }
    if (slot.ordem) { const p0 = slot.p.find((p) => l.some((e) => e.padrao === p)); l = l.filter((e) => e.padrao === p0); }
    const livres = l.filter((e) => !usados.has(e.id));
    if (livres.length) l = livres;
    // principais: sempre o melhor colocado; auxiliares: giram entre os 3 primeiros a cada versão do plano
    const giro = slot.main ? (slot.alt ? 1 : 0) + m.repeticao : versao + (slot.alt ? 1 : 0) + m.repeticao + (slot.fim ? m.di : 0);
    const ex = l[giro % Math.min(l.length, slot.main ? 2 : 3)];
    reservar(m, ex);
    m.escolhas[i] = { ex, slot, foco: m.doFoco.has(m.slots[i]) };
  };
  for (const m of montagem) m.slots.forEach((s, i) => { if (s.main) escolher(m, i); });
  for (const m of montagem) m.slots.forEach((s, i) => { if (!s.main) escolher(m, i); });
  // 3) doses, complementos e ajuste ao tempo
  const dias = [];
  for (const m of montagem) {
    const { chave, itens } = m;
    const por = (ex, slot, foco) => {
      const d = dose(ex, slot, pf);
      itens.push({ ex: ex.id, series: d.series, reps: d.reps, descanso: d.descanso, nota: '', _main: d.tipo === 'main', _cardio: !!slot.cardio, _fim: !!slot.fim, _leve: !!slot.leve, _foco: !!foco, _tipo: d.tipo, _slot: slot });
    };
    for (const e of m.escolhas) if (e) por(e.ex, e.slot, e.foco);
    // Dia incompleto (faltam aparelhos ou há muitas limitações): completa com outros movimentos da mesma região.
    const nForca = () => itens.filter((it) => !it._cardio).length;
    const alvo = chave === 'cardio' ? 2 : Math.min(limite, 4);
    const completar = (padroes, repetirPadrao, ate) => {
      for (const p of padroes) {
        if (nForca() >= ate || itens.length >= limite) return;
        if (!repetirPadrao && m.padroes.has(p)) continue;
        const slot = SLOT_RESERVA[p];
        const l = cands(slot).filter((e) => !m.noDia.has(e.id));
        if (!l.length) continue;
        const ex = l.find((e) => !usados.has(e.id)) || l[0];
        reservar(m, ex);
        por(ex, slot);
      }
    };
    if (nForca() < alvo) completar(RESERVA[chave], false, alvo);
    if (nForca() < Math.min(alvo, 3)) completar(RESERVA[chave], true, Math.min(alvo, 3));
    if (chave !== 'cardio' && nForca() < 3) completar(R_FULL, false, 3);
    if (chave !== 'cardio' && nForca() < 1) completar(R_FULL, true, 1);
    const iFim = itens.findIndex((it) => it._cardio && it._fim);
    if (iFim >= 0 && iFim !== itens.length - 1) itens.push(itens.splice(iFim, 1)[0]); // o cardio fica sempre por último
    if (chave === 'cardio' && !itens.some((it) => it._cardio)) { semCardio = true; continue; } // sem aparelho de cardio: o dia sai do plano
    if (!itens.length) continue;
    caberNoTempo(itens, pf);
    // Treino só com exercícios principais (pouco tempo): para "outra versão" não repetir o mesmo plano, o último deles gira entre os 3 primeiros.
    const forca = itens.filter((it) => !it._cardio);
    if (versao && forca.length >= 2 && forca.every((it) => it._main)) {
      const it = forca[forca.length - 1];
      const atual = EX_POR_ID.get(it.ex);
      const top = cands(it._slot).filter((e) => e.tipo === 'composto' && e.registro === atual.registro && (e.id === it.ex || !m.noDia.has(e.id))).slice(0, 3);
      const i0 = top.findIndex((e) => e.id === it.ex);
      if (i0 >= 0 && top.length > 1) it.ex = top[(i0 + versao) % top.length].id;
    }
    dias.push({ id: idCurto(m.di), nome: m.modelo.nome, foco: m.modelo.foco, itens, _chave: chave, _wd: semana[m.di] });
  }
  // nomes A/B/C quando a divisão repete o mesmo dia
  const totais = {};
  for (const d of dias) totais[d._chave] = (totais[d._chave] || 0) + 1;
  const cont = {};
  for (const d of dias) {
    if (totais[d._chave] > 1) { cont[d._chave] = (cont[d._chave] || 0) + 1; d.nome = `${DIAS_MODELO[d._chave].nome} ${'ABC'[cont[d._chave] - 1] || cont[d._chave]}`; }
  }
  ajustarVolume(dias, pf);
  const agenda = {};
  for (const d of dias) if (d._wd != null) agenda[d._wd] = d.id;
  const limpos = dias.map((d) => ({ id: d.id, nome: d.nome, foco: d.foco, itens: d.itens.map(({ _main, _cardio, _fim, _leve, _foco, _tipo, _slot, ...r }) => r) }));
  const volume = volumeSemanal(limpos);
  const av = avisos(pf);
  if (omitidos.size) av.push({ tipo: 'warn', texto: 'Por segurança, deixei de fora alguns tipos de movimento por causa das limitações que você informou: ' + [...omitidos].map((x) => x.toLowerCase()).join('; ') + '. Um médico ou fisioterapeuta pode indicar se e como você pode voltar a fazê-los.' });
  if (!dias.length) av.push({ tipo: 'warn', texto: 'Com as limitações e os aparelhos informados, não encontrei exercícios seguros para montar um treino. Marque mais aparelhos em “Minha academia” ou procure um profissional de educação física ou um fisioterapeuta.' });
  else if (semCardio) av.push({ tipo: 'info', texto: 'Não encontrei um aparelho de cardio adequado para você. Nos dias sem musculação, faça de 20 a 40 minutos de caminhada ou outra atividade aeróbica leve a moderada.' });
  return {
    nome: 'Plano do Treinador', dias: limpos, agenda, volume, avisos: av, orientacoes: orientacoes(pf), revisaoSemanas: semanasRevisao(pf), perfil: pf,
    faltando: dias.filter((d) => d._chave !== 'cardio' && d.itens.filter((it) => !it._cardio).length < 3).map((d) => d.nome),
  };
}

// ---------- volume semanal por grupo (séries/semana) ----------
const GRUPOS_VOL = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'abdomen', 'trapezio', 'lombar'];
const grupoVol = (m) => (m === 'trapezio' ? 'trapezio' : m === 'lombar' ? 'lombar' : m === 'manguito' ? null : MUSCULOS[m] ? MUSCULOS[m].grupo : null);
const ESTABILIZA = new Set(['abdomen', 'obliquos', 'lombar', 'antebraco', 'trapezio']);
const PESOS = new Map();
// Quanto cada série de um exercício conta para cada grupo: 1 para os músculos principais e 0,5 para os auxiliares.
// Os músculos que só estabilizam o corpo não contam, nem os exercícios de cardio. É a mesma conta da tela Evolução.
export function pesosDoExercicio(ex) {
  if (!ex) return {};
  let w = PESOS.get(ex.id);
  if (w) return w;
  w = {};
  if (ex.grupo !== 'cardio' && ex.padrao !== 'cardio') {
    for (const m of ex.primarios) { const g = grupoVol(m); if (g) w[g] = 1; }
    for (const m of ex.secundarios) { const g = grupoVol(m); if (g && !ESTABILIZA.has(m) && !w[g]) w[g] = 0.5; }
  }
  PESOS.set(ex.id, w);
  return w;
}
export function volumeSemanal(dias) {
  const v = {};
  for (const d of Array.isArray(dias) ? dias : []) {
    for (const it of (d && Array.isArray(d.itens) ? d.itens : [])) {
      const w = pesosDoExercicio(EX_POR_ID.get(it.ex));
      const n = Number(it.series) || 0;
      for (const g in w) v[g] = (v[g] || 0) + n * w[g];
    }
  }
  const out = {};
  for (const g of GRUPOS_VOL) out[g] = Math.round((v[g] || 0) * 2) / 2;
  return out;
}
// Mínimo eficaz ≈ 4 séries/semana por grupo (Iversen 2021 — ref iversen2021); alvo de 10 ou mais para hipertrofia quando
// há tempo (Schoenfeld 2017; ACSM 2026 — refs schoenfeld2017vol, acsm2026). Teto de séries diretas por grupo: 12 para
// iniciantes, 16 para intermediários e 20 para avançados (Baz-Valle 2022 — ref bazvalle2022: acima de 20 o ganho extra
// é pequeno); contando as meias séries dos músculos auxiliares, o total não passa de 1,5 vez o teto.
export const tetoSeries = (nivel) => (nivel === 1 ? 12 : nivel === 2 ? 16 : 20);
function ajustarVolume(dias, pf) {
  const teto = tetoSeries(pf.nivel);
  const tetoTotal = teto * 1.5;
  const limite = ORCAMENTO[pf.tempo] * 60;
  const pisoDe = (g) => (pf.objetivoDose === 'hipertrofia' && !pf.nunca && !pf.conservador && pf.retorno < 3 ? Math.min(10, teto) : 4) + (pf.foco.some((f) => FOCO_GRUPOS[f].includes(g)) ? 2 : 0);
  // quem está começando ou voltando de 3 meses ou mais parado, 60+, menores de 18, dose conservadora e objetivo saúde
  // ficam em até 3 séries por exercício
  const maxS = pf.nunca || pf.retorno >= 3 || pf.idoso || pf.jovem || pf.cautela || pf.objetivoDose === 'saude' ? 3 : 4;
  const principais = ['peito', 'costas', 'quadriceps', 'posteriores', 'gluteos', 'ombros'];
  const linhas = [];
  for (const d of dias) for (const it of d.itens) if (!it._cardio) linhas.push({ it, d, w: pesosDoExercicio(EX_POR_ID.get(it.ex)), reps: (EX_POR_ID.get(it.ex) || {}).registro !== 'segundos' });
  const conta = () => {
    const dir = {}, tot = {};
    for (const x of linhas) for (const g in x.w) { tot[g] = (tot[g] || 0) + x.it.series * x.w[g]; if (x.w[g] === 1) dir[g] = (dir[g] || 0) + x.it.series; }
    return { dir, tot };
  };
  const excesso = (c) => Object.keys(c.tot).filter((g) => (c.dir[g] || 0) > teto || c.tot[g] > tetoTotal);
  const travados = new Set();
  for (let k = 0; k < 300; k++) {
    const c = conta();
    const g = excesso(c).find((x) => !travados.has(x));
    if (g) {
      // séries demais: tira primeiro dos auxiliares (do fim da semana para o começo), depois dos principais, e por último remove um auxiliar
      const direto = (c.dir[g] || 0) > teto;
      const do_grupo = linhas.filter((x) => (direto ? x.w[g] === 1 : x.w[g]));
      const minimo = (x) => (x.it._leve ? 1 : x.it._main && pf.objetivoDose === 'forca' && pf.nivel > 1 ? 3 : 2);
      const corta = do_grupo.filter((x) => x.it.series > minimo(x)).sort((a, b) => (a.it._main ? 1 : 0) - (b.it._main ? 1 : 0) || b.it.series - a.it.series || linhas.indexOf(b) - linhas.indexOf(a))[0];
      if (corta) { corta.it.series--; continue; }
      const sai = do_grupo.filter((x) => !x.it._main && x.d.itens.filter((y) => !y._cardio).length > 3).sort((a, b) => (a.it._foco ? 1 : 0) - (b.it._foco ? 1 : 0) || b.d.itens.length - a.d.itens.length || linhas.indexOf(b) - linhas.indexOf(a))[0];
      if (sai) { sai.d.itens.splice(sai.d.itens.indexOf(sai.it), 1); linhas.splice(linhas.indexOf(sai), 1); continue; }
      // último recurso (poucos aparelhos: quase todo exercício cai no mesmo grupo): uma série a menos, até 1 por exercício
      const ultimo = do_grupo.filter((x) => x.it.series > 1).sort((a, b) => (a.it._main ? 1 : 0) - (b.it._main ? 1 : 0) || b.it.series - a.it.series || linhas.indexOf(b) - linhas.indexOf(a))[0];
      if (ultimo) { ultimo.it.series--; continue; }
      travados.add(g);
      continue;
    }
    // séries de menos: acrescenta uma série por vez, se couber no tempo e não estourar o teto de outro grupo
    let mudou = false;
    for (const p of principais) {
      if ((c.tot[p] || 0) >= pisoDe(p)) continue;
      const sobe = linhas.filter((x) => x.w[p] === 1 && x.reps && x.it.series < maxS).sort((a, b) => a.it.series - b.it.series || (b.it._main ? 1 : 0) - (a.it._main ? 1 : 0));
      for (const x of sobe) {
        x.it.series++;
        const dep = conta();
        if (segundos(x.d.itens) <= limite && excesso(dep).every((e) => travados.has(e) && dep.tot[e] <= c.tot[e] && (dep.dir[e] || 0) <= (c.dir[e] || 0))) { mudou = true; break; }
        x.it.series--;
      }
      if (mudou) break;
    }
    if (!mudou) break;
  }
  // foco: uma série a mais em até 2 exercícios de cada parte do corpo escolhida, se couber no tempo e no teto
  for (const f of pf.foco) for (const g of FOCO_GRUPOS[f]) {
    let n = 0;
    for (const x of linhas.filter((y) => y.w[g] === 1 && y.reps && y.it.series < maxS).sort((a, b) => a.it.series - b.it.series)) {
      if (n >= 2) break;
      const c = conta();
      x.it.series++;
      const dep = conta();
      if (segundos(x.d.itens) <= limite && excesso(dep).every((e) => dep.tot[e] <= c.tot[e] && (dep.dir[e] || 0) <= (c.dir[e] || 0))) n++;
      else x.it.series--;
    }
  }
}

function semanasRevisao(pf) { return pf.nivel === 1 ? 8 : 6; }

// ---------- textos de orientação ----------
function avisos(pf) {
  const a = [];
  if (pf.liberacao) a.push({ tipo: 'danger', texto: 'Pelas suas respostas, procure um médico e peça liberação antes de começar ou aumentar a intensidade dos treinos. Até lá, o treino abaixo usa só cargas leves a moderadas. Se sentir dor ou pressão no peito, tontura, falta de ar fora do normal ou palpitações, pare o exercício e procure atendimento.' });
  if (pf.gestante) a.push({ tipo: 'warn', texto: 'Gestação: treine só com liberação do seu obstetra. Deixei de fora exercícios deitada de barriga para cima ou de bruços, com impacto e com muita pressão no abdômen. Mantenha intensidade leve a moderada (dá para conversar durante o esforço). Nesta fase o treino é para manter a saúde, não para emagrecer nem bater recordes de carga.' });
  if (pf.pressao) a.push({ tipo: 'warn', texto: 'Pressão alta ou problema no coração: use cargas leves a moderadas com mais repetições, nunca prenda a respiração (solte o ar na fase de esforço) e não treine se a pressão estiver descontrolada.' });
  if (pf.retorno) {
    // Regras da volta: consenso CSCCa/NSCA de 2019 (ref caterisano2019), resumidas em logic/pausa.js. O corte de carga é
    // uma escolha conservadora do aplicativo; o consenso limita o volume, a frequência e o descanso.
    const duas = 'Nas duas primeiras semanas o treino começa com menos séries por músculo, pelo menos 2 minutos de descanso entre as séries e metade do cardio na primeira semana.';
    const t = {
      1: `Volta depois de 2 a 4 semanas parado: a força cai pouco nesse tempo. ${duas} Comece com cerca de 10% menos carga do que usava.`,
      2: `Volta depois de 1 a 3 meses parado: ${duas} Comece com cerca de 20% menos carga do que usava e suba a cada treino.`,
      3: `Volta depois de 3 a 6 meses parado: ${pf.nivel < pf.nivelBase ? 'montei o plano um nível abaixo da sua experiência, com menos séries' : 'montei o plano com menos séries'}. Nas duas primeiras semanas o treino começa com ainda menos séries e mais descanso, e o cardio volta aos poucos, em quatro semanas. Comece com cerca de 30% menos carga do que usava. Quem já treinou recupera a força mais depressa do que ganhou da primeira vez. Depois de 4 a 6 semanas treinando, refaça a entrevista para receber o plano completo do seu nível.`,
      4: 'Volta depois de mais de 6 meses parado: montei um plano de recomeço, com a dose de quem está começando. Nas duas primeiras semanas o treino começa com ainda menos séries e mais descanso, e o cardio volta aos poucos, em quatro semanas. Comece com metade da carga que usava, ou menos. Quem já treinou recupera a força mais depressa do que ganhou da primeira vez. Depois de 6 a 8 semanas treinando, refaça a entrevista para receber o plano do seu nível.',
    }[pf.retorno];
    a.push({ tipo: 'info', texto: t + (pf.idade >= 65 ? ' Depois dos 65 anos a perda de força na pausa é maior: volte com ainda mais calma.' : '') });
  }
  if (pf.jovem) a.push({ tipo: 'info', texto: 'Menores de 18 anos devem treinar com supervisão de um profissional, priorizando aprender a técnica com cargas leves.' });
  if (pf.idoso) a.push({ tipo: 'info', texto: 'Aos 60 anos ou mais, a musculação é especialmente indicada. Priorizei máquinas e exercícios estáveis, com progressão gradual e sem levar as séries até a falha.' });
  if (pf.limitacoes.length) a.push({ tipo: 'info', texto: 'Evitei os exercícios marcados como de cuidado para: ' + pf.limitacoes.map((x) => CUIDADOS[x] || x).join(', ') + '. Se algum movimento causar dor (não o cansaço normal do músculo), pare e troque o exercício. Dor que persiste precisa de avaliação profissional.' });
  if (pf.obeso) a.push({ tipo: 'info', texto: 'Para proteger as articulações no começo, prefira máquinas e cardio de baixo impacto (bicicleta, elíptico, caminhada).' });
  if (pf.baixoPeso && pf.objetivo === 'emagrecimento') a.push({ tipo: 'warn', texto: 'Seu peso já está abaixo da faixa considerada saudável para a sua altura. Não busque perder mais peso: use o treino para ganhar força e converse com um médico ou nutricionista.' });
  return a;
}
function orientacoes(pf) {
  const o = [];
  const rir = pf.nivel === 1 || pf.conservador ? 'Termine cada série sentindo que ainda faria mais 2 a 4 repetições com boa técnica.' : 'Termine cada série sentindo que ainda faria 1 a 3 repetições. Ir até a falha não é necessário; se quiser, deixe para a última série de exercícios em máquina.';
  o.push(['Esforço', rir]);
  o.push(['Como aumentar a carga', 'Use a faixa de repetições do treino. Quando conseguir o número mais alto da faixa em todas as séries, em dois treinos seguidos, aumente a carga em 2 a 10% e volte ao número mais baixo.']);
  o.push(['Aquecimento', 'Faça 5 minutos de cardio leve e, antes dos dois primeiros exercícios, 1 ou 2 séries com metade da carga. Não é preciso alongar parado antes do treino de força.']);
  o.push(['Execução', 'Suba em 1 a 2 segundos e desça em 2 segundos, controlando o peso. Use a amplitude completa do movimento que você consegue fazer sem dor. Solte o ar no esforço e não prenda a respiração.']);
  const cardio = pf.gestante
    ? 'Na gestação, a referência é somar pelo menos 150 minutos por semana de atividade aeróbica moderada, como caminhada ou bicicleta, em ritmo que permita conversar. O cardio do plano já conta para essa meta.'
    : {
      emagrecimento: 'A meta é somar de 150 a 300 minutos de cardio moderado por semana. O cardio do plano já conta; complete com caminhada, bicicleta ou outra atividade, depois do treino ou em outro horário.',
      saude: 'A OMS recomenda 150 a 300 minutos de atividade aeróbica moderada por semana, mais fortalecimento muscular em 2 ou mais dias. O cardio do plano já conta para essa meta.',
      resistencia: pf.conservador
        ? 'Além do cardio do plano, inclua 2 a 3 sessões de cardio por semana, de 20 a 40 minutos, em ritmo moderado e contínuo.'
        : 'Além do cardio do plano, inclua 2 a 3 sessões de cardio por semana, de 20 a 40 minutos, alternando ritmo contínuo e trechos mais fortes conforme o condicionamento.',
      hipertrofia: 'Cardio leve a moderado, 2 a 3 vezes por semana por 20 a 30 minutos, ajuda a saúde e não atrapalha o ganho de massa.',
      forca: 'Cardio leve a moderado, 2 vezes por semana, de preferência longe do treino de pernas, faz bem à saúde e não atrapalha a força máxima.',
    }[pf.objetivo];
  o.push(['Cardio', cardio]);
  o.push(['Descanso', 'Durma bem e deixe pelo menos 48 horas antes de treinar forte o mesmo grupo muscular de novo.']);
  o.push(['Troca de exercícios', `Mantenha os exercícios principais por 8 a 12 semanas para evoluir neles. A cada ${semanasRevisao(pf)} semanas eu sugiro trocar 1 ou 2 exercícios auxiliares por treino, para variar o estímulo sem perder o progresso. Você decide se aceita.`]);
  return o;
}

// ---------- rotação: sugestões de troca ----------
// Regra: mantém os 2 primeiros exercícios compostos de cada treino; propõe trocar até 2 auxiliares por treino.
export function sugerirTrocas(plan, respostas, gymBruta, max = 2) {
  const pf = perfil(respostas);
  const gym = academia(gymBruta);
  const diasPlano = plan && Array.isArray(plan.dias) ? plan.dias.filter((d) => d && Array.isArray(d.itens)) : [];
  const noPlano = new Set(diasPlano.flatMap((d) => d.itens.map((i) => i.ex)));
  const trocas = [];
  for (const d of diasPlano) {
    let compostos = 0;
    let n = 0;
    for (let i = 0; i < d.itens.length && n < max; i++) {
      const it = d.itens[i];
      const ex = EX_POR_ID.get(it.ex);
      if (!ex || ex.grupo === 'cardio' || ex.padrao === 'cardio') continue;
      if (ex.tipo === 'composto' && compostos < 2) { compostos++; continue; }
      // não vale trocar um exercício pela versão unilateral dele mesmo (mesmo aparelho): seria a mesma coisa
      const alt = alternativas(ex, pf, gym, noPlano).find((c) => !(c.unilateral !== ex.unilateral && c.equip.join() === ex.equip.join()));
      if (!alt) continue;
      noPlano.add(alt.id);
      trocas.push({ diaId: d.id, dia: d.nome, idx: i, de: ex.id, para: alt.id });
      n++;
    }
  }
  return trocas;
}
// A troca mantém a dose do item; por isso o novo exercício precisa ser medido do mesmo jeito (repetições ou segundos).
const medida = (ex) => (ex.registro === 'peso_reps' || ex.registro === 'reps' ? 'reps' : ex.registro);
// exercícios equivalentes (mesmo padrão de movimento e mesmos músculos principais)
export function alternativas(ex, pf, gymBruta, excluir = new Set()) {
  const gym = academia(gymBruta);
  const slot = { p: [ex.padrao], main: false, core: ex.grupo === 'abdomen' };
  const g0 = MUSCULOS[ex.primarios[0]] ? MUSCULOS[ex.primarios[0]].grupo : ex.grupo;
  const out = [];
  for (const c of POR_PADRAO[ex.padrao] || []) {
    if (c.id === ex.id || excluir.has(c.id)) continue;
    if (c.grupo === 'cardio' || c.grupo === 'funcional') continue;
    if (!disponivel(c, pf, gym) || !permitido(c, pf)) continue;
    if (slot.core ? medida(c) !== medida(ex) : c.registro !== ex.registro) continue;
    const g1 = MUSCULOS[c.primarios[0]] ? MUSCULOS[c.primarios[0]].grupo : c.grupo;
    if (g1 !== g0) continue;
    out.push(c);
  }
  out.sort((a, b) => nota(b, slot, pf) - nota(a, slot, pf) || ORDEM.get(a.id) - ORDEM.get(b.id));
  return out;
}

export function imcTexto(imc, idade) {
  if (!imc) return '';
  if (idade >= 60) return imc < 22 ? 'abaixo do recomendado para a idade' : imc <= 27 ? 'dentro do recomendado para a idade' : 'acima do recomendado para a idade';
  if (imc < 18.5) return 'abaixo do peso';
  if (imc < 25) return 'peso adequado';
  if (imc < 30) return 'sobrepeso';
  return 'obesidade';
}
export const nomeGrupo = (g) => GRUPOS[g] || { trapezio: 'Trapézio', lombar: 'Lombar' }[g] || g;

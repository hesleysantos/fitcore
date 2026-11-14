// Treinador virtual: entrevista + regras baseadas em diretrizes publicadas (ACSM 2009/2026, OMS 2020,
// AHA 2024, NSCA 2019, Schoenfeld 2016–2021, Iversen 2021, Kassiano 2022, entre outras — ver data/knowledge.js).
// É um sistema de regras fixas: não inventa nada fora do que está descrito aqui.
import { EXERCICIOS, EX_POR_ID } from '../data/exercises.js';
import { EQUIPAMENTOS } from '../data/equipment.js';
import { FAIXA_DA_RESPOSTA } from './pausa.js';
import { MUSCULOS, GRUPOS, PADROES, CUIDADOS } from '../data/muscles.js';
import { LOCAIS_DOR, TIPOS_DOR, dorDeAlerta } from './dor.js';

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
      ['halteres', 'Em casa, com halteres e banco', 'Halteres, banco reto e colchonete'],
      ['corporal', 'Sem aparelhos', 'Só o peso do corpo e um colchonete'],
    ],
  },
  {
    // Itens extras de quem treina em casa. Sem marcar nada, o plano só usa o que a opção do local diz. Cada item marcado
    // libera só os exercícios do catálogo que precisam dele; as regras de segurança continuam valendo por cima.
    // Opcional: respostas antigas (sem esta pergunta) valem como "nenhum". As chaves são as de data/equipment.js.
    k: 'extras', tipo: 'varios', opcional: true, se: (a) => a.local === 'halteres' || a.local === 'corporal', titulo: 'Tem mais algum destes em casa?',
    ajuda: 'Só uso o que você marcar. Dá mais variedade ao treino.', nenhum: 'nenhum',
    op: [
      ['nenhum', 'Nenhum destes', ''], ['elastico', 'Elástico ou mini band', ''], ['bola_suica', 'Bola suíça', ''],
      ['caixa', 'Degrau ou caixa firme', 'Que não escorrega nem vira'], ['banco_inclinado', 'Banco regulável', 'Com encosto que inclina'],
      ['barra_fixa', 'Barra fixa', 'De porta ou de parede, bem presa'], ['kettlebell', 'Kettlebell', ''], ['trx', 'Fita de suspensão', 'Presa em ponto firme'],
      ['corda_pular', 'Corda de pular', ''], ['bicicleta', 'Bicicleta ergométrica', ''], ['esteira', 'Esteira', ''],
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
    // Prioridade por músculo. Não existe estudo controlado de "especialização"; as regras vêm dos estudos de dose
    // (refs pelland2026, scarpelli2022, bazvalle2022) e de manutenção (refs bickel2011, spiering2021, iversen2021).
    // Até dois músculos por vez — ver limiteFoco().
    k: 'foco', tipo: 'varios', max: 2, titulo: 'Quer dar prioridade a algum músculo?',
    ajuda: 'Os escolhidos ganham mais séries por semana; o resto do corpo continua sendo treinado.', nenhum: 'equilibrado',
    op: [
      ['equilibrado', 'Não, quero um treino equilibrado', ''],
      ['quadriceps', 'Quadríceps', 'Frente da coxa'], ['posteriores', 'Posteriores de coxa', 'Parte de trás da coxa'], ['gluteos', 'Glúteos', ''],
      ['panturrilhas', 'Panturrilhas', ''], ['peito', 'Peito', ''], ['costas', 'Costas', 'Dorsais e meio das costas'], ['ombros', 'Ombros', ''],
      ['biceps', 'Bíceps', ''], ['triceps', 'Tríceps', ''], ['abdomen', 'Abdômen', ''],
      // áreas da versão anterior: continuam válidas e valem pelos dois músculos
      ['pernas', 'Pernas inteiras', 'Vale por dois: quadríceps e posteriores'], ['bracos', 'Braços inteiros', 'Vale por dois: bíceps e tríceps'],
    ],
  },
];

export const ROTULO = {
  objetivo: { hipertrofia: 'Ganhar massa muscular', emagrecimento: 'Emagrecer', forca: 'Ficar mais forte', saude: 'Saúde e disposição', resistencia: 'Resistência e condicionamento' },
  experiencia: { nunca: 'Começando agora', iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' },
  pausa: { treinando: 'Sem pausa', '2a4s': '2 a 4 semanas', '1a3m': '1 a 3 meses', '3a6m': '3 a 6 meses', mais6m: 'Mais de 6 meses' },
  local: { completa: 'Academia completa', minha: 'Aparelhos da minha academia', halteres: 'Casa com halteres', corporal: 'Sem aparelhos' },
  extras: { elastico: 'elástico', bola_suica: 'bola suíça', caixa: 'degrau', banco_inclinado: 'banco regulável', barra_fixa: 'barra fixa', kettlebell: 'kettlebell', trx: 'fita de suspensão', corda_pular: 'corda de pular', bicicleta: 'bicicleta ergométrica', esteira: 'esteira' },
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
const OPC = { objetivo: opcoes('objetivo'), local: opcoes('local'), extras: opcoes('extras'), limitacoes: opcoes('limitacoes'), condicoes: opcoes('condicoes'), triagem: opcoes('triagem') };
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
  // Diabetes: 2 a 3 sessões de força por semana em dias não consecutivos, 1 a 3 séries de 10 a 15 repetições, progredindo
  // para 8 a 10 (refs colberg2016, kanaley2022). Doença cardiovascular, metabólica ou renal em quem já é ativo: segue em
  // intensidade moderada sem liberação, mas precisa dela antes do esforço vigoroso (ref riebe2015, lido em whitfield2017);
  // nas diretrizes de diabetes, treino de força "vigoroso" é o de 6 a 8 repetições. Por isso, com diabetes ou outra doença
  // crônica, o plano fica em 8 repetições ou mais e até 3 séries por exercício.
  const diabetes = cond.includes('diabetes');
  const cronica = cond.includes('cronica');
  const gestante = cond.includes('gestante');
  // triagem pré-participação (Riebe 2015 — ref riebe2015): sintomas, doença do coração, gestação, ou sedentário com doença crônica
  const liberacao = tri.length > 0 || cond.includes('cardiaco') || gestante || (inativo && (cond.includes('diabetes') || cond.includes('cronica') || cond.includes('hipertensao')));
  // enquanto não há liberação médica, e sempre com pressão alta ou gestação: cargas leves a moderadas (AHA 2024; ACOG 804 — refs aha2024, acog804)
  const cautela = pressao || gestante || liberacao;
  const conservador = idoso || jovem || cautela;
  const peso = numero(a.peso, 0), altura = numero(a.altura, 0);
  const imc = peso > 0 && altura > 0 ? peso / ((altura / 100) ** 2) : null;
  const cuidados = [...lim];
  // os exercícios marcados como de cuidado para pressão alta (apneia, isometria pesada, cabeça abaixo do coração) saem
  // também na gestação e enquanto a triagem pede liberação médica
  if (cautela) cuidados.push('hipertensao');
  if (gestante) cuidados.push('gestante');
  const objetivo = OPC.objetivo.has(a.objetivo) ? a.objetivo : 'saude';
  const d = Math.round(Number(a.dias));
  const t = Number(a.tempo);
  const dias = Number.isFinite(d) ? Math.min(6, Math.max(2, d)) : 3;
  const tempo = Number.isFinite(t) && t > 0 ? TEMPOS.reduce((m, x) => (Math.abs(x - t) < Math.abs(m - t) ? x : m), 60) : 60;
  // músculos em prioridade, na ordem em que foram escolhidos; as áreas antigas ("pernas", "braços") valem por dois
  const focoPedido = [];
  for (const x of lista(a.foco)) for (const m of (tem(FOCO_AREAS, x) ? FOCO_AREAS[x] : [x])) if (tem(FOCO_SLOTS, m) && !focoPedido.includes(m)) focoPedido.push(m);
  const focoMax = limiteFoco({ dias, tempo, nivel, conservador });
  const foco = focoPedido.slice(0, focoMax);
  return {
    objetivo, idade, nivel, nivelBase, retorno, inativo, nunca, idoso, jovem, pressao, gestante, liberacao, cautela, conservador, imc,
    diabetes, cronica, moderado: diabetes || cronica,
    // na gestação a dose segue a de saúde, qualquer que seja o objetivo marcado (ACOG 804 — ref acog804)
    objetivoDose: gestante ? 'saude' : objetivo,
    obeso: imc != null && imc >= 30,
    baixoPeso: imc != null && (idoso ? imc < 22 : imc < 18.5),
    dias, tempo,
    local: OPC.local.has(a.local) ? a.local : 'completa',
    // itens extras em casa: só valem para os locais de casa e só os que existem na pergunta
    extras: a.local === 'halteres' || a.local === 'corporal' ? lista(a.extras, OPC.extras).filter((x) => x !== 'nenhum' && Object.prototype.hasOwnProperty.call(EQUIPAMENTOS, x)) : [],
    limitacoes: lim, cuidados, triagem: tri, foco, focoPedido, focoMax, bloqueado: idade < 14,
  };
}
const tem = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
// Quantos músculos dá para priorizar ao mesmo tempo. Nenhum estudo controlado dá esse número (ref pelland2026: não se
// sabe se a resposta de um músculo depende da dose total do treino). O limite sai de duas coisas:
//  1) o TETO de dois: a única orientação publicada que achei, de autor da área, é escolher "um ou dois" grupos por
//     ciclo e deixar os demais no volume normal (ref nuckols2025 — artigo técnico, usado por falta de estudo); o
//     levantamento com fisiculturistas de elite mostra no máximo dois grupos por sessão (ref hackett2013);
//  2) uma CONTA de tempo, só com números que têm fonte:
//     • séries que cabem na semana = dias × minutos ÷ 2 (cerca de 2 min por série, com 90 s de descanso: 21 séries
//       em ~40 min e 35 em ~68 min — ref schoenfeld2019vol);
//     • reserva para o resto do corpo = 12 séries: o programa mínimo de três exercícios multiarticulares, com 4
//       séries semanais por grupo (ref iversen2021); com 60 anos ou mais, 18 (até 2 sessões de 2 a 3 séries — ref
//       spiering2021);
//     • cada prioridade custa 10 séries: as 4 de manutenção mais 6, o acréscimo que dá ganho perceptível para quem
//       faz de 5 a 10 séries (ref pelland2026).
//     Na prática a conta só limita em 2 treinos de 30 min (1 músculo). Com treinos de 30 min o plano tem 4
//     exercícios, todos ocupados pelos grandes grupos: fica 1 músculo também, e a prioridade entra só nas séries.
export function limiteFoco(pf) {
  if (!pf || pf.tempo <= 30) return 1;
  const cabem = (pf.dias * pf.tempo) / 2;
  return Math.max(1, Math.min(2, Math.floor((cabem - (pf.idoso ? 18 : 12)) / 10)));
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
  // Menores de 18: 2 a 3 treinos de força por semana em dias não seguidos (refs faigenbaum2009, lloyd2014). Diabetes: 2 a
  // 3 sessões de força em dias não consecutivos (refs colberg2016, kanaley2022). Os dias que sobram viram cardio.
  if (pf.jovem || pf.diabetes) return [D_BASE[d]];
  // Iniciantes: 2 a 3 treinos de força por semana, até 4 em divisão (ref acsm2009).
  if (pf.nivel === 1) return d === 4 ? [D_SUPINF, D_BASE[4]] : [D_BASE[d]];
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
// Em casa o plano usa só o que a opção escolhida na entrevista diz (o texto da opção lista os aparelhos): nada de
// elástico, bola, caixa ou banco regulável que a pessoa não disse ter.
const CASA = new Set(['halteres', 'banco_reto', 'colchonete']);
const SEM = new Set(['colchonete']);
// Cardio com impacto ou saltos: só para quem já treina, sem dose conservadora e com IMC abaixo de 30 (ver "segurança").
// Vale para qualquer exercício do catálogo (sem lista de nomes): é de impacto o cardio marcado como de cuidado para
// joelho e para tornozelo ao mesmo tempo (corrida, corda, polichinelo, saltos).
const deImpacto = (ex) => ex.cuidado.includes('joelho') && ex.cuidado.includes('tornozelo');
function disponivel(ex, pf, gym) {
  // "Academia completa" = os aparelhos que quase toda academia tem. Os menos comuns (pêndulo, belt squat, GHD,
  // máquinas articuladas específicas...) só entram quando a pessoa marca o aparelho em "Minha academia".
  if (pf.local === 'completa') return !ex.equip.some((e) => EQUIPAMENTOS[e] && EQUIPAMENTOS[e].raro);
  if (pf.local === 'minha') return gym.all || ex.equip.every((e) => gym.has[e] === true);
  const base = pf.local === 'halteres' ? CASA : SEM;
  return ex.equip.every((e) => base.has(e) || pf.extras.includes(e));
}
// ---------- segurança: o que o Treinador nunca escolhe sozinho ----------
// O aplicativo não tem supervisão presencial; por isso as regras abaixo ficam sempre no lado mais conservador que tem
// fonte. Nenhum exercício é apagado do catálogo: os que ficam de fora continuam disponíveis para a escolha manual.
//
// 1) SÓ MANUAL — nunca entram em plano automático, para ninguém:
//    • exercícios de potência, saltos e levantamentos explosivos (grupo "funcional": burpee, salto na caixa,
//      agachamento e afundo com salto, clean, thruster, kettlebell swing, levantamento turco...): pliometria só para
//      quem já tem força alta e domina os exercícios simples (itens 5 e 10 do posicionamento da NSCA — ref nsca1993);
//      em jovens, só com competência técnica e supervisão qualificada (refs lloyd2014, faigenbaum2009); na gestação,
//      levantamentos olímpicos devem ser evitados (ref mottola2018);
//    • movimentos que o gerador não usa: remada alta (elevar os cotovelos acima de 90° está associado a sinais de
//      impacto no ombro — ref kolber2014), mergulhos, carregar peso e exercícios de corpo inteiro;
//    • a lista SO_MANUAL, abaixo, com o motivo e a fonte de cada um.
// 2) POR PERFIL (função permitido):
//    • impacto (cardio com corrida ou salto): só para quem já treina, sem dose conservadora e com IMC abaixo de 30.
//      Saltos pedem base de força e exercícios simples dominados (ref nsca1993); com IMC acima de 30 é razoável
//      limitar o exercício de impacto e preferir bicicleta (ref esc2020); nos idosos, só "se as articulações
//      tolerarem" (ref izquierdo2021); nos jovens, competência técnica (ref lloyd2014);
//    • barra livre em exercício composto (agachamento, terra, supino, desenvolvimento, remada curvada), por perfil:
//      – gestantes: preferir elásticos ou máquinas com carga leve; peso livre é menos indicado pelo equilíbrio, e
//        cargas muito altas não são recomendadas (ref sbc_gestacao2021);
//      – menores de 18: as lesões graves acontecem com equipamento em casa e sem supervisão qualificada (refs
//        faigenbaum2010, faigenbaum2009); aqui não há supervisão;
//      – pressão alta e coração: mesmo com a pressão controlada, evitar levantamento pesado com grande componente
//        isométrico, e evitar a manobra de Valsalva (refs esc2020, sbc_reab2020) — é o caso dos grandes levantamentos
//        com barra; a dose segue a diretriz brasileira: 10 a 15 repetições, carga moderada (ref sbc_has2020);
//      – 60 anos ou mais: as máquinas são o ponto de partida e os pesos livres vêm depois, na progressão (ref
//        fragala2019); sem alguém para avaliar a função da pessoa, o plano fica no ponto de partida;
//      – triagem positiva: a regra do ACSM é liberação médica antes de qualquer exercício (ref riebe2015); o plano
//        só é aceito depois de a pessoa confirmar que vai procurá-la, e fica na dose mais leve;
//      – em todos: a maioria das lesões que chegam ao pronto-socorro envolve pesos livres, quase sempre um peso que
//        caiu sobre a pessoa (ref kerr2010). Iniciantes já não recebem esses exercícios pelo nível;
//    • instabilidade (bola suíça, fitas de suspensão e exercícios de perna em um pé só, sem máquina): fora para 60+
//      e gestantes — equilíbrio se treina com apoio e em ambiente seguro (refs fragala2019, izquierdo2021) e a gestante
//      deve evitar risco de queda (refs acog804, mottola2018, sbc_gestacao2021);
//    • apneia, isometria pesada e cabeça abaixo do coração (marcados no catálogo como cuidado para pressão alta):
//      fora para pressão alta, coração, gestação e triagem positiva. Evitar a manobra de Valsalva está nas
//      diretrizes (refs esc2020, sbc_reab2020, sbc_gestacao2021); isometria intensa não é recomendada na gestação
//      (ref sbc_gestacao2021) nem levantamento com grande componente isométrico na pressão alta (ref esc2020).
//      Isometria moderada, como a prancha, não é proibida por nenhuma diretriz (o aperto de mão isométrico até baixa
//      a pressão — ref sbc_has2020); ela fica de fora porque é um exercício em que é fácil prender a respiração.
//      Cabeça abaixo do coração: nenhuma diretriz trata disso; a inversão do corpo elevou a pressão em pessoas com
//      pressão normal, e os autores sugerem que hipertensos a evitem (ref haskvitz1986); posturas de cabeça baixa
//      elevam a pressão dentro do olho (ref jasien2015);
//    • nível: iniciantes só recebem exercícios de nível 1; perfis conservadores, até o nível 2.
// 3) Entre exercícios equivalentes (mesma nota), vence o mais estável e mais simples (função maisEstavel).
const SO_MANUAL = {
  'remada-invertida-sob-mesa': 'a pessoa se pendura na borda de uma mesa da casa. Não há estudo sobre exercícios apoiados em móveis; a única orientação publicada que achei é jornalística (a mesa precisa ser firme e pesada para não virar sobre a pessoa — Coach, 3/5/2019). O risco é do mesmo tipo que causa a maioria das lesões do treino de força: um objeto pesado caindo sobre a pessoa (ref kerr2010), mais grave em casa e sem supervisão (ref faigenbaum2010)',
  'bom-dia-barra': 'barra nas costas com o tronco inclinado à frente: com apenas 25% do peso do corpo na barra, o momento na coluna lombar (L4/L5) já é igual ao do levantamento terra, e os autores pedem muito cuidado com a estabilidade do tronco com cargas maiores (ref schellenberg2013); a lombar não fica neutra, flexiona cerca de 25° (ref vigotsky2015). Nenhuma fonte o proíbe: fica só para a escolha manual por ser carga sobre a coluna sem ninguém para corrigir a técnica',
  'hiit-bicicleta': 'treino intervalado de alta intensidade: com sobrepeso ou obesidade, só depois de avaliação do risco cardiovascular e com supervisão (ref oppert2021); em quem tem doença do coração, só em pacientes estáveis (ref esc2020); todos os estudos de segurança foram supervisionados, e o intervalado sem supervisão não foi avaliado (ref wewege2018); na gestação não há dados suficientes (ref sbc_gestacao2021). Adultos saudáveis e já ativos podem fazer esforço vigoroso (ref riebe2015), mas o aplicativo não tem como conferir isso',
};
export const soManual = (id) => Object.prototype.hasOwnProperty.call(SO_MANUAL, id);
const FORA_DO_GERADOR = new Set(['remada_alta', 'mergulho', 'total', 'carregar']);
const COM_APOIO = new Set(['maquina', 'smith']);
const PERNAS_EM_PE = new Set(['afundo', 'agachar', 'dobradica_quadril', 'flexao_plantar']);
const instavel = (ex) => ex.equip.includes('bola_suica') || ex.equip.includes('trx') || (ex.unilateral && PERNAS_EM_PE.has(ex.padrao) && !COM_APOIO.has(ex.modalidade));
const barraComposto = (ex) => ex.modalidade === 'barra' && ex.tipo === 'composto';
// estabilidade do exercício, para desempatar: máquina > guiado e cabos > halteres e peso do corpo > barra e kettlebell
const maisEstavel = (ex) => ({ maquina: 5, smith: 4, cabo: 4, halteres: 3, peso_corporal: 3, barra: 2, kettlebell: 2 }[ex.modalidade] ?? 2) - (ex.unilateral ? 1 : 0) - (instavel(ex) ? 2 : 0);
// Exercícios que dependem de um móvel da casa aguentar o peso do corpo: nunca entram sozinhos (SO_MANUAL); se a pessoa
// os puser no treino à mão, a tela mostra o aviso de testar o móvel antes.
const APOIO_EM_MOVEL = { 'remada-invertida-sob-mesa': 'Remada invertida sob a mesa: antes de cada treino, confira se a mesa é firme e pesada e não vira nem escorrega quando você se pendura. Na dúvida, troque o exercício.' };
// avisos que dependem dos exercícios que estão no plano (vale para o plano gerado e para o plano ativo)
export function avisosDoPlano(dias) {
  const out = [];
  const vistos = new Set();
  for (const d of Array.isArray(dias) ? dias : []) for (const it of d && Array.isArray(d.itens) ? d.itens : []) {
    if (it && typeof it.ex === 'string' && Object.prototype.hasOwnProperty.call(APOIO_EM_MOVEL, it.ex) && !vistos.has(it.ex)) { vistos.add(it.ex); out.push({ tipo: 'warn', texto: APOIO_EM_MOVEL[it.ex] }); }
  }
  return out;
}
export function permitido(ex, pf) {
  if (ex.cuidado.some((c) => pf.cuidados.includes(c))) return false;
  // segurança (ver o bloco acima)
  if (soManual(ex.id)) return false;
  if ((ex.grupo === 'funcional' && ex.padrao !== 'cardio') || FORA_DO_GERADOR.has(ex.padrao)) return false;
  if (ex.padrao === 'cardio' && deImpacto(ex) && (pf.nivel === 1 || pf.conservador || pf.obeso)) return false;
  if (pf.conservador && barraComposto(ex)) return false;
  if ((pf.idoso || pf.gestante) && instavel(ex)) return false;
  if (pf.dor && vetadoPorDor(ex, pf.dor)) return false;
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
  if (pf.local === 'corporal' || pf.local === 'halteres') {
    n += ex.registro === 'reps' || ex.registro === 'peso_reps' ? 1 : 0;
    // Sem carga para aumentar, a progressão vem de variações mais difíceis (ACSM 2009 — ref acsm2009): quem já treina
    // recebe primeiro as versões de nível mais alto que o perfil permite; iniciantes ficam com as mais simples (acima).
    if (!simples && ex.registro === 'reps') n += (ex.nivel - 1) * (pf.local === 'corporal' ? 2 : 1);
  }
  // dor moderada em articulação ou tendão: os exercícios que poupam a região vêm antes (ref fragala2019)
  if (pf.dor && poupadoPorDor(ex, pf.dor)) n -= 8;
  if (slot.core && ex.registro === 'segundos') n += pf.nivel === 1 ? 2 : 0;
  if (pf.idoso && m === 'maquina') n += 2;
  // barra fixa e paralelas não deixam ajustar a carga: nas faixas de 10 ou mais repetições (emagrecimento, saúde, resistência) os cabos e máquinas vêm antes
  if (AEROBIO.has(pf.objetivoDose) && ex.registro === 'reps' && (ex.equip.includes('barra_fixa') || ex.equip.includes('paralelas'))) n -= 3;
  if (slot.cardio && ex.registro === 'minutos') n += 4; // no cardio, os aparelhos (medidos em minutos) vêm antes dos exercícios de salto
  if (simples && ex.equip.includes('graviton')) n -= 4; // para iniciantes, puxadas e remadas sentadas vêm antes da barra assistida
  return n;
}
function candidatos(slot, pf, gym, todos = false) {
  const out = [];
  for (const padrao of slot.p) {
    for (const ex of POR_PADRAO[padrao] || []) {
      if (!disponivel(ex, pf, gym) || !permitido(ex, pf)) continue;
      if (slot.cardio) {
        // (alta intensidade e impacto já saíram em permitido)
        // Só entra cardio medido em minutos: três séries de 30 segundos de marcha não são um "dia de cardio". Sem aparelho
        // de cardio, o dia sai do plano e o aviso manda caminhar (OMS: 150 a 300 min por semana — ref oms2020).
        if (ex.registro !== 'minutos') continue;
      } else if (ex.grupo === 'cardio' || ex.grupo === 'funcional') continue;
      // a extensão de ombro (pullover) só serve às vagas de costas quando o principal dela é de costas, não o peito
      else if (padrao === 'extensao_ombro' && (MUSCULOS[ex.primarios[0]] || {}).grupo !== 'costas') continue;
      else if (!slot.core && ex.registro !== 'peso_reps' && ex.registro !== 'reps') continue;
      out.push({ ex, n: nota(ex, slot, pf), p: slot.ordem ? slot.p.indexOf(padrao) : 0, o: ORDEM.get(ex.id) });
    }
  }
  // `ordem`: os movimentos da vaga são tentados na ordem em que foram listados (o segundo só entra se faltar o primeiro)
  // empate na nota: vence o mais estável e, depois, o mais simples
  out.sort((a, b) => a.p - b.p || b.n - a.n || maisEstavel(b.ex) - maisEstavel(a.ex) || a.ex.nivel - b.ex.nivel || a.o - b.o);
  // Avançados: as variações mais simples sem peso (nível 1) dão pouco estímulo; só entram se não houver outra ou, com
  // `todos`, para variar quando as outras já foram usadas na semana
  if (!todos && pf.nivel === 3 && !pf.conservador && !slot.core && !slot.cardio) {
    const facil = (x) => x.ex.registro === 'reps' && x.ex.nivel === 1;
    const resto = out.filter((x) => !facil(x));
    if (resto.length) return resto.map((x) => x.ex);
  }
  return out.map((x) => x.ex);
}
// As listas de candidatos só dependem destes dados do perfil; ficam guardadas para as próximas chamadas (a tela do
// Treinador monta o plano a cada redesenho).
const CACHE = new Map();
function listasDoPerfil(pf, gym) {
  const chave = [pf.local, pf.extras.slice().sort().join(','), pf.local !== 'minha' ? '' : gym.all ? '*' : Object.keys(gym.has).filter((k) => gym.has[k] === true).sort().join(','), pf.cuidados.slice().sort().join(','), pf.nivel, +pf.conservador, +pf.idoso, +pf.obeso, +pf.cautela, +pf.gestante, +pf.jovem, +AEROBIO.has(pf.objetivoDose), pf.dor ? pf.dor.chave : ''].join('|');
  let m = CACHE.get(chave);
  if (!m) { if (CACHE.size >= 60) CACHE.clear(); CACHE.set(chave, (m = new Map())); }
  return m;
}

// ---------- séries, repetições e descanso ----------
// Faixas por objetivo (ACSM 2009; Schoenfeld 2021; Grgic 2018; Singer 2024 — refs acsm2009, schoenfeld2021, grgic2018, singer2024):
//   força: cargas altas (3 a 6 repetições) e 2 a 3 min de descanso nos principais; iniciantes ficam em 8 a 12;
//   hipertrofia: 8 a 15 repetições, 1 a 2 min; emagrecimento: 10 a 15, até 90 s; saúde: 2 séries de 10 a 15;
//   resistência: 15 a 20 repetições com até 1 min de descanso.
// Exercícios com dose própria, tirada dos protocolos publicados (não seguem a faixa do objetivo):
//  • flexão nórdica: o protocolo de 10 semanas começa com 2 séries de 5 e vai a 3 séries de 12, 10 e 8 (ref petersen2011,
//    tabela lida em zein2022); o FIFA 11+ usa de 3–5 a 12–15 repetições conforme o nível (ref soligard2008); volumes
//    baixos dão o mesmo ganho de força, e a dor muscular das primeiras semanas pede entrada gradual (ref cuthbert2020).
//    Aqui: 2 séries de 6 a 8, com 2 min de descanso, e no máximo 3 séries.
const DOSE_PROPRIA = { 'flexao-nordica': { series: 2, reps: '6-8', descanso: 120, max: 3 } };
function dose(ex, slot, pf) {
  const obj = pf.objetivoDose;
  if (!slot.cardio && Object.prototype.hasOwnProperty.call(DOSE_PROPRIA, ex.id)) { const p = DOSE_PROPRIA[ex.id]; return { series: p.series, reps: p.reps, descanso: p.descanso, tipo: 'iso', maxS: p.max }; }
  if (slot.cardio) {
    if (ex.registro !== 'minutos') return { series: slot.fim ? 2 : 3, reps: '30', descanso: 45, tipo: 'cardio' };
    let min;
    if (slot.fim) min = obj === 'saude' || pf.tempo <= 45 ? 10 : pf.tempo >= 75 ? 20 : 15;
    else {
      // dia de cardio: 20 min para quem busca força ou massa; até 30 min (conservador/iniciante) ou 40 min nos outros objetivos
      const max = !AEROBIO.has(obj) ? 20 : pf.nivel === 1 || pf.conservador ? 30 : 40;
      min = Math.min(max, Math.max(20, pf.tempo - 15));
    }
    // Corrida e corda são esforço vigoroso (pular corda: 11 METs — ref compendio2024; vigoroso é de 6 METs para cima), e
    // cada minuto vigoroso vale por dois moderados na meta semanal da OMS (75 a 150 min em vez de 150 a 300 — ref oms2020):
    // o cardio de impacto entra com a metade dos minutos.
    if (deImpacto(ex)) min = Math.max(5, Math.round(min / 10) * 5);
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
  // diabetes ou outra doença crônica: nada de treino de força "vigoroso" (menos de 8 repetições) sem liberação médica
  if (pf.moderado) { if (Number(reps.split('-')[0]) < 8) { reps = '8-10'; descanso = Math.max(descanso, 90); } series = Math.min(series, 3); }
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
// (cada chave é um músculo — o mesmo nome do grupo na contagem de séries)
const FOCO_SLOTS = {
  quadriceps: [S(['extensao_joelho', 'afundo'], { ordem: 1 }), S(['afundo', 'agachar'], { ordem: 1, alt: 1 })],
  posteriores: [S(['flexao_joelho', 'dobradica_quadril'], { ordem: 1 }), S(['dobradica_quadril', 'flexao_joelho'], { ordem: 1, alt: 1 })],
  gluteos: [S('extensao_quadril'), S('abducao')], panturrilhas: [S('flexao_plantar'), S('flexao_plantar', { alt: 1 })],
  peito: [S('aducao_horizontal'), S('empurrar_horizontal', { alt: 1 })], costas: [S('puxar_horizontal', { alt: 1 }), S(['extensao_ombro', 'puxar_vertical'], { alt: 1 })],
  ombros: [S('elevacao_lateral'), S('abducao_horizontal')], biceps: [S('flexao_cotovelo', { alt: 1 }), S('flexao_cotovelo')],
  triceps: [S('extensao_cotovelo', { alt: 1 }), S('extensao_cotovelo')],
  abdomen: [S(['flexao_tronco', 'flexao_quadril'], { core: true }), S(['anti_extensao', 'rotacao'], { core: true })],
};
// áreas aceitas em respostas antigas → músculos
const FOCO_AREAS = { pernas: ['quadriceps', 'posteriores'], bracos: ['biceps', 'triceps'] };
const D_PERNAS = ['fullA', 'fullB', 'fullC', 'infA', 'infB', 'legs'];
const FOCO_ONDE = {
  quadriceps: D_PERNAS, posteriores: D_PERNAS, gluteos: D_PERNAS, panturrilhas: D_PERNAS,
  peito: ['fullA', 'fullC', 'supA', 'supB', 'push'], costas: ['fullA', 'fullB', 'supA', 'supB', 'pull'], ombros: ['fullB', 'fullC', 'supA', 'supB', 'push'],
  biceps: ['fullA', 'fullB', 'fullC', 'supA', 'supB', 'pull'], triceps: ['fullA', 'fullB', 'fullC', 'supA', 'supB', 'push'],
  abdomen: ['fullA', 'fullB', 'fullC', 'infA', 'infB', 'legs', 'push', 'pull', 'supA', 'supB'],
};
// movimentos que já trabalham o músculo em foco (a vaga extra não toma o lugar deles)
const FOCO_PADROES = {
  quadriceps: ['extensao_joelho', 'afundo', 'agachar'], posteriores: ['flexao_joelho', 'dobradica_quadril'],
  gluteos: ['extensao_quadril', 'abducao', 'agachar', 'afundo', 'dobradica_quadril'], panturrilhas: ['flexao_plantar'],
  peito: ['aducao_horizontal', 'empurrar_horizontal'], costas: ['puxar_horizontal', 'puxar_vertical', 'extensao_ombro'], ombros: ['elevacao_lateral', 'abducao_horizontal', 'empurrar_vertical'],
  biceps: ['flexao_cotovelo'], triceps: ['extensao_cotovelo'], abdomen: ['flexao_tronco', 'flexao_quadril', 'anti_extensao', 'rotacao'],
};

// Se uma limitação — ou a falta de aparelhos, como no treino em casa — elimina todos os exercícios de um tipo de
// movimento, o Treinador tenta um movimento vizinho que trabalha a mesma região (sempre respeitando os cuidados).
// Sem nada para puxar, a extensão da lombar ("superman") entra como trabalho de costas; sem empurrar na vertical,
// entram as elevações de ombro e, por último, um empurrar na horizontal (que usa a parte da frente do ombro).
const SUBSTITUTOS = {
  agachar: ['afundo', 'extensao_quadril', 'abducao', 'aducao'], afundo: ['agachar', 'extensao_quadril', 'abducao', 'aducao'],
  dobradica_quadril: ['extensao_quadril', 'abducao'], flexao_joelho: ['extensao_quadril', 'abducao'], extensao_joelho: ['abducao', 'aducao', 'flexao_plantar'],
  extensao_quadril: ['abducao'], empurrar_horizontal: ['aducao_horizontal'], empurrar_vertical: ['elevacao_lateral', 'elevacao_frontal', 'empurrar_horizontal'],
  puxar_vertical: ['puxar_horizontal', 'extensao_ombro', 'extensao_lombar'], puxar_horizontal: ['puxar_vertical', 'abducao_horizontal', 'extensao_lombar'],
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
// movimentos que o gerador usa para montar treinos de força (os das vagas, das reservas e dos vizinhos)
const PADROES_USADOS = new Set([...R_FULL, 'elevacao_frontal', 'extensao_lombar']);
const SLOT_RESERVA = Object.fromEntries(R_FULL.map((p) => [p, S(p, R_CORE.includes(p) ? { core: true } : {})]));

const idCurto = (i) => 'd' + (i + 1) + Math.random().toString(36).slice(2, 7);

const numVersao = (v) => Math.abs(Math.floor(Number(v))) % 1000000 || 0;
// Monta o plano. `versao` muda os exercícios auxiliares (rotação); os principais ficam. `doresBrutas` (opcional) é a
// lista de dores ativas (logic/dor.js → doresAtivas): o plano já sai poupando as regiões doloridas (ver "dores", abaixo).
export function gerarPlano(respostas, gymBruta, versaoBruta = 0, doresBrutas = null) {
  const pf = perfil(respostas);
  if (pf.bloqueado) return null;
  if (!pf.foco.length) return montarPlano(respostas, gymBruta, versaoBruta, doresBrutas, null, null);
  // Prioridade de músculo: o plano equilibrado serve de base para medir e limitar o aumento. A vaga extra de um músculo
  // só fica se render séries a mais para ele e se nenhum grande grupo cair abaixo da dose de manutenção: 4 séries por
  // semana (refs iversen2021, pelland2026; em jovens, um terço do volume manteve a massa por 32 semanas — ref
  // bickel2011); 6 para quem tem 60 anos ou mais: neles um terço do volume não bastou (ref bickel2011) e a revisão
  // sobre dose mínima fala em até 2 sessões por semana com 2 a 3 séries por exercício (ref spiering2021).
  // Quando isso não acontece, a vaga passa a entrar em um treino sim, outro não; se ainda não der, a prioridade entra
  // só nas séries dos exercícios que já estão no plano.
  const base = montarPlano({ ...respostas, foco: ['equilibrado'] }, gymBruta, versaoBruta, doresBrutas, null, null);
  const piso = pf.idoso ? 6 : 4;
  const corte = new Map(); // músculo → 0 (vaga em todos os treinos possíveis), 1 (em metade), 2 (sem vaga)
  const nv = (g) => corte.get(g) || 0;
  let p = montarPlano(respostas, gymBruta, versaoBruta, doresBrutas, base, corte);
  for (let k = 0; k < pf.foco.length * 2; k++) {
    const fraco = p.foco.find((x) => x.para <= x.de && nv(x.id) < 2);
    const caiu = p.foco.some((x) => x.para < x.de) || GRANDES.some((g) => !pf.foco.includes(g) && p.volume[g] < Math.min(piso, base.volume[g]));
    const sai = fraco ? fraco.id : caiu ? pf.foco.slice().reverse().find((g) => nv(g) < 2) : null;
    if (!sai) break;
    corte.set(sai, nv(sai) + 1);
    p = montarPlano(respostas, gymBruta, versaoBruta, doresBrutas, base, corte);
  }
  return p;
}
const GRANDES = ['peito', 'costas', 'quadriceps', 'posteriores', 'gluteos', 'ombros'];
function montarPlano(respostas, gymBruta, versaoBruta, doresBrutas, baseFoco, corteFoco) {
  const pf = perfil(respostas);
  if (pf.bloqueado) return null;
  const dores = limparDoresTreino(doresBrutas);
  pf.dor = regrasDeDor(dores, pf);
  const gym = academia(gymBruta);
  const versao = numVersao(versaoBruta);
  // em casa as listas são curtas: a rotação usa os 4 primeiros de cada movimento (na academia, os 3 primeiros)
  const giroMax = pf.local === 'corporal' || pf.local === 'halteres' ? 4 : 3;
  const limite = N_EXERCICIOS[pf.tempo] || 7;
  const memo = listasDoPerfil(pf, gym);
  const cands = (slot) => { let c = memo.get(slot); if (!c) { c = candidatos(slot, pf, gym); memo.set(slot, c); } return c; };
  // todos os candidatos da vaga, incluindo as variações simples que os avançados só usam para variar
  let memoTodos = memo.get('todos');
  if (!memoTodos) memo.set('todos', (memoTodos = new Map()));
  const candsTodos = (slot) => { let c = memoTodos.get(slot); if (!c) { c = candidatos(slot, pf, gym, true); memoTodos.set(slot, c); } return c; };
  // vaga com os movimentos vizinhos de outra (mesma região do corpo), guardada para as próximas chamadas
  const vagaVizinha = (slot, viz) => {
    const k = 'troca:' + viz.join(',') + (slot.core ? ':core' : '');
    let v = memo.get(k);
    if (!v) memo.set(k, (v = { ...slot, p: viz, main: false, ordem: 0 }));
    return v;
  };
  // exercícios ainda não usados na semana; se acabaram, entram as variações simples que sobraram, para os treinos não se repetirem
  const naoUsados = (l, slot, m) => {
    const livres = l.filter((e) => !usados.has(e.id));
    if (livres.length || slot.main) return livres;
    return candsTodos(slot).filter((e) => !usados.has(e.id) && !m.noDia.has(e.id) && (!slot.ordem || l.some((x) => x.padrao === e.padrao)));
  };
  const temCardio = cands(CARDIO_FIM).length > 0;
  // o mesmo perfil sem as limitações: serve para saber se uma vaga ficou vazia por causa delas
  const pfSemLimites = { ...pf, cuidados: [], cautela: false, idoso: false, dor: null };
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
  const diasVazios = [];
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
      // No máximo duas vagas de prioridade por treino; com três músculos escolhidos, a vez gira de um treino para o outro.
      if (limite > 4) for (let k = 0; k < pf.foco.length && extra < 2; k++) {
        const f = pf.foco[(k + di) % pf.foco.length];
        const nivelCorte = corteFoco ? corteFoco.get(f) || 0 : 0;
        if (!FOCO_ONDE[f] || !FOCO_ONDE[f].includes(chave) || nivelCorte >= 2) continue;
        const vez = (vezFoco[f] = (vezFoco[f] || 0) + 1);
        if (nivelCorte === 1 && vez % 2 === 0) continue;
        const fs = FOCO_SLOTS[f][vez % 2]; // alterna as duas vagas de cada músculo ao longo da semana
        if (slots.length >= vagas) {
          slots = slots.slice(0, vagas);
          let i = slots.length - 1;
          // não sai vaga principal, nem vaga que já trabalha um dos músculos em prioridade
          while (i >= 0 && (slots[i].main || doFoco.has(slots[i]) || slots[i].p.some((p) => pf.foco.some((g) => FOCO_PADROES[g].includes(p))))) i--;
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
    if (!l.length && !slot.cardio) {
      const viz = [...new Set(slot.p.flatMap((p) => SUBSTITUTOS[p] || []))];
      if (viz.length) {
        const troca = vagaVizinha(slot, viz);
        const l2 = cands(troca).filter((e) => !m.noDia.has(e.id) && !usados.has(e.id));
        if (l2.length) { l = l2; slot = troca; }
      }
    }
    if (!l.length) {
      // a vaga ficou vazia por causa de uma limitação informada? anota para avisar o usuário
      if (!slot.cardio && (pf.cuidados.length || pf.dor)) {
        let l0 = semLimites.get(slot);
        if (!l0) semLimites.set(slot, (l0 = candidatos(slot, pfSemLimites, gym)));
        if (l0.length) omitidos.add(PADROES[slot.p[0]]);
      }
      return;
    }
    if (slot.ordem) { const p0 = slot.p.find((p) => l.some((e) => e.padrao === p)); l = l.filter((e) => e.padrao === p0); }
    const livres = naoUsados(l, slot, m);
    if (livres.length) l = livres;
    else if (m.repeticao > 0 && !slot.cardio) {
      // Treino que se repete na semana (A e B) e todos os candidatos da vaga já foram usados: entra um movimento vizinho
      // ainda não usado, para os dois treinos não saírem iguais (em casa, com poucos exercícios, isso acontecia).
      const viz = [...new Set(slot.p.flatMap((p) => SUBSTITUTOS[p] || []))];
      const l2 = viz.length ? cands(vagaVizinha(slot, viz)).filter((e) => !m.noDia.has(e.id) && !usados.has(e.id)) : [];
      if (l2.length) { l = l2; slot = vagaVizinha(slot, viz); }
    }
    // principais: sempre o melhor colocado; auxiliares: giram entre os 3 primeiros a cada versão do plano
    // (vale a vaga original: se ela era principal e caiu num movimento vizinho, continua sem girar com a versão)
    const principal = m.slots[i].main;
    const giro = principal ? (slot.alt ? 1 : 0) + m.repeticao : versao + (slot.alt ? 1 : 0) + m.repeticao + (slot.fim ? m.di : 0);
    const ex = l[giro % Math.min(l.length, principal ? 2 : giroMax)];
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
      itens.push({ ex: ex.id, series: d.series, reps: d.reps, descanso: d.descanso, nota: '', _main: d.tipo === 'main', _cardio: !!slot.cardio, _fim: !!slot.fim, _leve: !!slot.leve, _foco: !!foco, _tipo: d.tipo, _slot: slot, _maxS: d.maxS || 0 });
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
        // os complementos também giram a cada versão (em casa, boa parte do treino vem daqui)
        const livres = naoUsados(l, slot, m);
        const fonte = livres.length ? livres : l;
        const ex = fonte[(nForca() >= 2 ? versao + m.repeticao : 0) % Math.min(fonte.length, giroMax)];
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
    if (!itens.length) { diasVazios.push(m.modelo.nome); continue; } // nada seguro para este treino: vira descanso, com aviso
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
  // prioridade: até cerca de 6 séries a mais por semana do que no plano equilibrado (refs pelland2026, scarpelli2022)
  const tetoFoco = {};
  if (baseFoco) for (const g of pf.foco) tetoFoco[g] = (baseFoco.volume[g] || 0) + FOCO_MAIS;
  const motivosFoco = ajustarVolume(dias, pf, tetoFoco);
  const agenda = {};
  for (const d of dias) if (d._wd != null) agenda[d._wd] = d.id;
  const limpos = dias.map((d) => ({ id: d.id, nome: d.nome, foco: d.foco, itens: d.itens.map(({ _main, _cardio, _fim, _leve, _foco, _tipo, _slot, _maxS, ...r }) => r) }));
  const volume = volumeSemanal(limpos);
  const av = avisos(pf);
  for (const x of avisosDeDor(dores, pf)) av.push(x);
  // o que a prioridade mudou, músculo a músculo (séries por semana: antes → depois)
  const diretas = seriesDiretas(limpos);
  const foco = pf.foco.map((g) => {
    const x = { id: g, nome: nomeGrupo(g), de: baseFoco ? baseFoco.volume[g] || 0 : 0, para: volume[g] || 0, diretas: diretas[g] || 0, teto: tetoSeries(pf.nivel) };
    const n = (v) => String(v).replace('.', ',');
    // por que a prioridade não aumentou: cada motivo é conferido, para o texto não culpar a coisa errada
    const direto = (ex) => pesosDoExercicio(ex)[g] === 1 && ex.grupo !== 'cardio' && ex.grupo !== 'funcional' && PADROES_USADOS.has(ex.padrao) && (ex.registro === 'reps' || ex.registro === 'peso_reps' || g === 'abdomen') && disponivel(ex, pf, gym);
    const m = motivosFoco[g] || 'tempo';
    x.motivo = x.para > x.de ? 'aumentou'
      : !EXERCICIOS.some((ex) => direto(ex) && permitido(ex, pfSemLimites)) ? 'sem-direto'
        : !EXERCICIOS.some((ex) => direto(ex) && permitido(ex, pf)) ? 'limitacao'
          : m === 'equilibrio' ? 'equilibrio'
          : x.diretas >= x.teto - 1 || m === 'teto:' + g ? 'teto'
            : m.startsWith('teto:') ? 'teto-outro' : m === 'max-series' ? 'max-series' : 'tempo';
    x.texto = x.motivo === 'aumentou' ? `${x.nome}: ${n(x.de)} → ${n(x.para)} séries por semana`
      : x.motivo === 'sem-direto' ? `${x.nome}: não há exercício direto com os aparelhos disponíveis`
        : x.motivo === 'limitacao' ? `${x.nome}: os exercícios diretos ficaram de fora pela limitação ou dor informada`
          : x.motivo === 'teto' ? `${x.nome}: já está no máximo do seu nível (${n(x.para)} séries por semana)`
            : x.motivo === 'equilibrio' ? `${x.nome}: mais séries desequilibrariam o treino com as costas (${n(x.para)} por semana)`
            : x.motivo === 'teto-outro' ? `${x.nome}: mais séries passariam do máximo de ${nomeGrupo(m.slice(5)).toLowerCase()} (${n(x.para)} por semana)`
              : x.motivo === 'max-series' ? `${x.nome}: os exercícios dele já estão no máximo de séries (${n(x.para)} por semana)`
                : `${x.nome}: sem vaga para mais séries neste tempo de treino (${n(x.para)} por semana)`;
    return x;
  });
  const porLimite = pf.cuidados.length > 0 || !!pf.dor;
  // treino que ficou sem nenhum exercício seguro: vira dia de descanso, e o plano diz por quê
  if (diasVazios.length) av.push({ tipo: 'warn', texto: `${diasVazios.length === 1 ? 'O treino' : 'Os treinos'} ${diasVazios.map((x) => '“' + x + '”').join(', ')} ${diasVazios.length === 1 ? 'ficou' : 'ficaram'} sem exercício ${porLimite ? 'seguro para as dores e limitações informadas' : 'possível com os aparelhos disponíveis'}: ${diasVazios.length === 1 ? 'esse dia vira' : 'esses dias viram'} descanso.` });
  // grande grupo muscular que ficou sem nenhuma série: o plano diz qual
  const zerados = dias.length ? GRANDES.filter((g) => !volume[g]) : [];
  if (zerados.length) av.push({ tipo: 'warn', texto: `Este plano ficou sem exercício para ${zerados.map((g) => nomeGrupo(g).toLowerCase()).join(', ')}${porLimite ? ', por causa das dores ou limitações informadas' : pf.local === 'minha' ? ': faltam aparelhos em “Minha academia”' : ' com os aparelhos disponíveis'}.` });
  if (omitidos.size) av.push({ tipo: 'warn', texto: 'Por segurança, deixei de fora alguns tipos de movimento por causa das limitações ou dores que você informou: ' + [...omitidos].map((x) => x.toLowerCase()).join('; ') + '. Um médico ou fisioterapeuta pode indicar se e como você pode voltar a fazê-los.' });
  if (!dias.length) av.push({ tipo: 'warn', texto: 'Com as limitações e os aparelhos informados, não encontrei exercícios seguros para montar um treino. Marque mais aparelhos em “Minha academia” ou procure um profissional de educação física ou um fisioterapeuta.' });
  for (const x of avisosDoPlano(limpos)) av.push(x);
  // em casa: músculos para os quais o catálogo não tem exercício direto com o que a pessoa tem, no nível dela
  if (dias.length && (pf.local === 'corporal' || pf.local === 'halteres')) {
    const faltam = [...GRANDES, 'biceps', 'triceps'].filter((g) => !zerados.includes(g) && (!volume[g] || !diretas[g])).filter((g) => !EXERCICIOS.some((ex) => pesosDoExercicio(ex)[g] === 1 && ex.grupo !== 'funcional' && PADROES_USADOS.has(ex.padrao) && (ex.registro === 'reps' || ex.registro === 'peso_reps') && disponivel(ex, pf, gym) && permitido(ex, pfSemLimites)));
    if (faltam.length) av.push({ tipo: 'info', texto: `${pf.local === 'corporal' ? 'Sem aparelhos' : 'Com halteres e banco'}, não há exercício direto para ${faltam.map((g) => nomeGrupo(g).toLowerCase()).join(', ')} no seu nível. ${faltam.length === 1 ? 'Ele trabalha como auxiliar' : 'Eles trabalham como auxiliares'} em outros exercícios${pf.local === 'corporal' ? '; halteres ou elásticos resolvem isso' : ''}.` });
  }
  // cardio do plano, em minutos por semana; sem cardio, o texto não promete que "o cardio do plano já conta"
  const minCardio = limpos.reduce((t, d) => t + d.itens.reduce((x, it) => x + ((EX_POR_ID.get(it.ex) || {}).registro === 'minutos' ? Number(it.reps) || 0 : 0), 0), 0);
  const cardioPorDor = !minCardio && !!pf.dor && !temCardio && candidatos(CARDIO_FIM, { ...pf, dor: null }, gym).length > 0;
  const estadoCardio = minCardio > 0 ? 'ok' : cardioPorDor ? 'dor' : 'sem';
  if (dias.length && cardioPorDor && (semCardio || AEROBIO.has(pf.objetivoDose))) av.push({ tipo: 'info', texto: 'Por causa da dor, o cardio ficou fora do plano. Ele volta quando a dor passar ou depois da avaliação.' });
  else if (dias.length && semCardio) av.push({ tipo: 'info', texto: 'Sem aparelho de cardio, os dias que seriam de cardio saíram do plano. Nesses dias, faça de 20 a 40 minutos de caminhada ou outra atividade aeróbica leve a moderada.' });
  return {
    nome: 'Plano do Treinador', dias: limpos, agenda, volume, avisos: av, orientacoes: orientacoes(pf, estadoCardio), revisaoSemanas: semanasRevisao(pf), perfil: pf, minCardio,
    foco, focoFora: pf.focoPedido.slice(pf.foco.length).map(nomeGrupo), versao,
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
function seriesDiretas(dias) {
  const v = {};
  for (const d of dias) for (const it of d.itens) { const w = pesosDoExercicio(EX_POR_ID.get(it.ex)); for (const g in w) if (w[g] === 1) v[g] = (v[g] || 0) + (Number(it.series) || 0); }
  return v;
}
// Quanto a prioridade pode somar ao músculo, em séries por semana, sobre o plano equilibrado. O único aumento testado
// com vantagem foi de 20% sobre o volume habitual (ref scarpelli2022); aumentos de 30% a 120% não renderam mais em 8
// semanas (refs barsuhn2025, camargo2026); e a meta-regressão de Pelland estima em cerca de 6 séries (quem faz de 5 a
// 10) o acréscimo que dá ganho perceptível (ref pelland2026). Por isso: até 6 séries a mais, sempre dentro do teto.
const FOCO_MAIS = 6;
function ajustarVolume(dias, pf, tetoFoco = {}) {
  const teto = tetoSeries(pf.nivel);
  const tetoTotal = teto * 1.5;
  const limite = ORCAMENTO[pf.tempo] * 60;
  const pisoDe = (g) => (pf.objetivoDose === 'hipertrofia' && !pf.nunca && !pf.conservador && pf.retorno < 3 ? Math.min(10, teto) : 4) + (pf.foco.includes(g) ? 2 : 0);
  // quem está começando ou voltando de 3 meses ou mais parado, 60+, menores de 18, dose conservadora e objetivo saúde
  // ficam em até 3 séries por exercício
  const maxS = pf.nunca || pf.retorno >= 3 || pf.idoso || pf.jovem || pf.cautela || pf.moderado || pf.objetivoDose === 'saude' ? 3 : 4;
  const maxDe = (x) => x.it._maxS || maxS;
  const principais = GRANDES;
  const linhas = [];
  for (const d of dias) for (const it of d.itens) if (!it._cardio) linhas.push({ it, d, w: pesosDoExercicio(EX_POR_ID.get(it.ex)), reps: (EX_POR_ID.get(it.ex) || {}).registro !== 'segundos' });
  const conta = () => {
    const dir = {}, tot = {};
    for (const x of linhas) for (const g in x.w) { tot[g] = (tot[g] || 0) + x.it.series * x.w[g]; if (x.w[g] === 1) dir[g] = (dir[g] || 0) + x.it.series; }
    return { dir, tot };
  };
  const passouFoco = (c, g) => tetoFoco[g] != null && c.tot[g] > tetoFoco[g] && (c.dir[g] || 0) > 0;
  const excesso = (c) => Object.keys(c.tot).filter((g) => (c.dir[g] || 0) > teto || c.tot[g] > tetoTotal || passouFoco(c, g));
  const travados = new Set();
  for (let k = 0; k < 300; k++) {
    const c = conta();
    const g = excesso(c).find((x) => !travados.has(x));
    if (g) {
      // séries demais: tira primeiro dos auxiliares (do fim da semana para o começo), depois dos principais, e por último remove um auxiliar
      const direto = (c.dir[g] || 0) > teto || (c.tot[g] <= tetoTotal && passouFoco(c, g));
      const do_grupo = linhas.filter((x) => (direto ? x.w[g] === 1 : x.w[g]));
      const minimo = (x) => (x.it._leve ? 1 : x.it._main && pf.objetivoDose === 'forca' && pf.nivel > 1 ? 3 : 2);
      const corta = do_grupo.filter((x) => x.it.series > minimo(x)).sort((a, b) => (a.it._main ? 1 : 0) - (b.it._main ? 1 : 0) || b.it.series - a.it.series || linhas.indexOf(b) - linhas.indexOf(a))[0];
      if (corta) { corta.it.series--; continue; }
      // passou só do limite da prioridade (não do teto do nível): depois das séries, só sai um exercício extra da própria prioridade
      if ((c.dir[g] || 0) <= teto && c.tot[g] <= tetoTotal) {
        const extra = do_grupo.filter((x) => x.it._foco && !x.it._main && c.tot[g] - x.it.series >= tetoFoco[g] - FOCO_MAIS + 2 && x.d.itens.filter((y) => !y._cardio).length > 3).pop();
        if (extra) { extra.d.itens.splice(extra.d.itens.indexOf(extra.it), 1); linhas.splice(linhas.indexOf(extra), 1); } else travados.add(g);
        continue;
      }
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
      const sobe = linhas.filter((x) => x.w[p] === 1 && x.reps && x.it.series < maxDe(x)).sort((a, b) => a.it.series - b.it.series || (b.it._main ? 1 : 0) - (a.it._main ? 1 : 0));
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
  // prioridade: uma série a mais em até 2 exercícios de cada músculo escolhido, se couber no tempo e no teto. Quando não
  // cabe, fica anotado o que travou (para a proposta dizer o motivo certo).
  const motivos = {};
  for (const g of pf.foco) {
    let n = 0;
    const diretos = linhas.filter((y) => y.w[g] === 1 && y.reps);
    const cand = diretos.filter((y) => y.it.series < maxDe(y)).sort((a, b) => a.it.series - b.it.series);
    let travou = !diretos.length ? 'tempo' : !cand.length ? 'max-series' : '';
    for (const x of cand) {
      if (n >= 2) break;
      const c = conta();
      x.it.series++;
      const dep = conta();
      const cabe = segundos(x.d.itens) <= limite;
      const piora = excesso(dep).filter((e) => !(dep.tot[e] <= c.tot[e] && (dep.dir[e] || 0) <= (c.dir[e] || 0)));
      if (cabe && !piora.length) { n++; continue; }
      x.it.series--;
      if (cabe) travou = 'teto:' + (piora.includes(g) ? g : piora[0]); else if (!travou.startsWith('teto:')) travou = 'tempo';
    }
    if (!n && travou) motivos[g] = travou;
  }
  // Equilíbrio entre empurrar e puxar: muito mais séries de peito do que de costas está ligado a dor no ombro em quem faz
  // musculação (ref kolber2010); a tela Evolução avisa quando as costas ficam abaixo de dois terços do peito. O plano do
  // Treinador nunca sai assim: primeiro tenta somar séries de costas; se não der (em casa quase não há como puxar), tira
  // séries de peito, dos auxiliares primeiro.
  for (let k = 0; k < 60; k++) {
    const c = conta();
    const peito = c.tot.peito || 0, costas = c.tot.costas || 0;
    if (peito < 6 || costas >= peito * 0.67) break;
    const sobe = linhas.filter((x) => x.w.costas === 1 && x.reps && x.it.series < maxDe(x)).sort((a, b) => a.it.series - b.it.series)[0];
    if (sobe) {
      sobe.it.series++;
      const dep = conta();
      if (segundos(sobe.d.itens) <= limite && excesso(dep).every((e) => dep.tot[e] <= c.tot[e] && (dep.dir[e] || 0) <= (c.dir[e] || 0))) continue;
      sobe.it.series--;
    }
    const desce = linhas.filter((x) => x.w.peito === 1 && x.it.series > 1).sort((a, b) => (a.it._main ? 1 : 0) - (b.it._main ? 1 : 0) || b.it.series - a.it.series || linhas.indexOf(b) - linhas.indexOf(a))[0];
    if (!desce) break;
    desce.it.series--;
    if (pf.foco.includes('peito')) motivos.peito = 'equilibrio'; // a prioridade no peito esbarrou no equilíbrio com as costas
  }
  return motivos;
}
function semanasRevisao(pf) { return pf.nivel === 1 ? 8 : 6; }

// ---------- textos de orientação ----------
function avisos(pf) {
  const a = [];
  if (pf.liberacao) a.push({ tipo: 'danger', texto: 'Pelas suas respostas, procure um médico e peça liberação antes de começar ou aumentar a intensidade dos treinos. Até lá, o treino abaixo usa só cargas leves a moderadas. Se sentir dor ou pressão no peito, tontura, falta de ar fora do normal ou palpitações, pare o exercício e procure atendimento.' });
  if (pf.gestante) a.push({ tipo: 'warn', texto: 'Gestação: treine só com liberação do seu obstetra. Deixei de fora exercícios deitada de barriga para cima ou de bruços, com impacto e com muita pressão no abdômen. Mantenha intensidade leve a moderada (dá para conversar durante o esforço). Nesta fase o treino é para manter a saúde, não para emagrecer nem bater recordes de carga.' });
  if (pf.pressao) a.push({ tipo: 'warn', texto: 'Pressão alta ou problema no coração: use cargas leves a moderadas com mais repetições, nunca prenda a respiração (solte o ar na fase de esforço) e não treine se a pressão estiver acima de 160 por 105 mmHg.' });
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
  if (pf.diabetes) a.push({ tipo: 'warn', texto: 'Diabetes: a musculação ajuda a controlar a glicose. O plano fica em 8 repetições ou mais, com a força em dias alternados; antes de treinos mais pesados, peça liberação médica. Se usa insulina ou sulfonilureia, meça a glicemia antes: abaixo de 90 mg/dL, coma 15 a 30 g de carboidrato; acima de 250 com cetonas, não treine. Com retinopatia ou doença nos rins, evite carga máxima, prender a respiração e ficar de cabeça baixa.' });
  if (pf.cronica) a.push({ tipo: 'info', texto: 'Doença crônica: quem já treina pode seguir em intensidade moderada; antes de treinos pesados, peça liberação médica. O plano fica em 8 repetições ou mais e até 3 séries por exercício. Com sintoma novo (dor no peito, falta de ar, tontura, palpitações), pare e procure um médico.' });
  if (pf.obeso) a.push({ tipo: 'info', texto: 'Para proteger as articulações no começo, prefira máquinas e cardio de baixo impacto (bicicleta, elíptico, caminhada).' });
  if (pf.baixoPeso && pf.objetivo === 'emagrecimento') a.push({ tipo: 'warn', texto: 'Seu peso já está abaixo da faixa considerada saudável para a sua altura. Não busque perder mais peso: use o treino para ganhar força e converse com um médico ou nutricionista.' });
  return a;
}
function orientacoes(pf, estadoCardio = 'ok') {
  const o = [];
  const rir = pf.nivel === 1 || pf.conservador ? 'Termine cada série sentindo que ainda faria mais 2 a 4 repetições com boa técnica.' : 'Termine cada série sentindo que ainda faria 1 a 3 repetições. Ir até a falha não é necessário; se quiser, deixe para a última série de exercícios em máquina.';
  o.push(['Esforço', rir]);
  o.push(['Como aumentar a carga', 'Use a faixa de repetições do treino. Quando conseguir o número mais alto da faixa em todas as séries, em dois treinos seguidos, aumente a carga em 2 a 10% e volte ao número mais baixo.']);
  o.push(['Aquecimento', 'Faça 5 minutos de cardio leve e, antes dos dois primeiros exercícios, 1 ou 2 séries com metade da carga. Não é preciso alongar parado antes do treino de força.']);
  o.push(['Execução', 'Suba em 1 a 2 segundos e desça em 2 segundos, controlando o peso. Use a amplitude completa do movimento que você consegue fazer sem dor. Solte o ar no esforço e não prenda a respiração.']);
  // o texto só diz que "o cardio do plano já conta" quando o plano tem cardio
  const conta = estadoCardio === 'ok' ? 'O cardio do plano já conta para essa meta.' : estadoCardio === 'dor' ? 'Com a dor que você contou, o cardio fica para depois que ela passar ou for avaliada.' : 'Este plano não tem cardio: some esses minutos com caminhada, bicicleta ou outra atividade.';
  const alem = estadoCardio === 'ok' ? 'Além do cardio do plano, inclua' : estadoCardio === 'dor' ? 'Quando a dor passar, inclua' : 'Este plano não tem cardio: inclua';
  const cardio = pf.gestante
    ? `Na gestação, a referência é somar pelo menos 150 minutos por semana de atividade aeróbica moderada, como caminhada ou bicicleta, em ritmo que permita conversar. ${conta}`
    : {
      emagrecimento: `A meta é somar de 150 a 300 minutos de cardio moderado por semana, depois do treino ou em outro horário. ${conta}`,
      saude: `A OMS recomenda 150 a 300 minutos de atividade aeróbica moderada por semana, mais fortalecimento muscular em 2 ou mais dias. ${conta}`,
      resistencia: pf.conservador
        ? `${alem} 2 a 3 sessões de cardio por semana, de 20 a 40 minutos, em ritmo moderado e contínuo.`
        : `${alem} 2 a 3 sessões de cardio por semana, de 20 a 40 minutos, alternando ritmo contínuo e trechos mais fortes conforme o condicionamento.`,
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
export function sugerirTrocas(plan, respostas, gymBruta, max = 2, doresBrutas = null) {
  const pf = perfil(respostas);
  const dores = limparDoresTreino(doresBrutas);
  // com dor contada, a troca nunca traz um exercício que pede cuidado por causa dela
  const livreDeDor = (c) => { const a = dores.length ? avaliarDor(c, dores, pf) : null; return !a || a.grau < 2; };
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
      const alt = alternativas(ex, pf, gym, noPlano).find((c) => !(c.unilateral !== ex.unilateral && c.equip.join() === ex.equip.join()) && livreDeDor(c));
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
  out.sort((a, b) => nota(b, slot, pf) - nota(a, slot, pf) || maisEstavel(b) - maisEstavel(a) || a.nivel - b.nivel || ORDEM.get(a.id) - ORDEM.get(b.id));
  return out;
}

// ---------- outra versão ----------
// exercícios de cada treino, sem contar a ordem
const assinaturaPlano = (p) => (p && Array.isArray(p.dias) ? p.dias.map((d) => (d && Array.isArray(d.itens) ? d.itens.map((i) => i.ex).sort().join(',') : '')).join('|') : '');
// Procura a próxima versão que muda de fato os exercícios. Devolve { versao, plano, trocados } ou null quando, com os
// aparelhos e as respostas da pessoa, não existe outra combinação (a tela avisa em vez de repetir o mesmo treino).
// `opc.plano`: plano com que comparar (padrão: o da versão atual); `opc.dores`: dores ativas.
export function outraVersao(respostas, gymBruta, versaoAtual = 0, opc = {}) {
  const o = opc && typeof opc === 'object' ? opc : {};
  const v0 = numVersao(versaoAtual);
  const atual = o.plano && Array.isArray(o.plano.dias) ? o.plano : gerarPlano(respostas, gymBruta, v0, o.dores);
  if (!atual || !atual.dias.length) return null;
  const ass = assinaturaPlano(atual);
  const antes = atual.dias.map((d) => new Set((d && Array.isArray(d.itens) ? d.itens : []).map((i) => i.ex)));
  // a rotação usa listas de até 4 exercícios: depois de 12 versões, as combinações se repetem
  for (let k = 1; k <= 12; k++) {
    const p = gerarPlano(respostas, gymBruta, v0 + k, o.dores);
    if (!p || !p.dias.length) return null;
    if (assinaturaPlano(p) === ass) continue;
    let trocados = 0;
    p.dias.forEach((d, i) => { for (const it of d.itens) if (!antes[i] || !antes[i].has(it.ex)) trocados++; });
    return { versao: v0 + k, plano: p, trocados };
  }
  return null;
}

// ---------- dores contadas ao Treinador ----------
// A pessoa conta a dor (logic/dor.js): local, tipo (muscular / articulação ou tendão / forte ou repentina), intensidade
// de 1 a 10 e quando aparece. Aqui ficam as regras do que a musculação faz com ela. Resumo, com as fontes:
//  • Dor de alerta (definida em logic/dor.js: forte ou repentina, 7 ou mais, ou em repouso): a região não é treinada
//    e a orientação é procurar avaliação; o resto do corpo continua (refs dubois2020, verhagen2016, cheung2003). Na
//    gestação, dor no abdômen ou na panturrilha também é alerta (ref acog804). Dor no peito que não é muscular é
//    sempre alerta (ref riebe2015).
//  • Dor muscular depois do treino (começa em 12 a 24 h, pico entre 24 e 72 h, some em 5 a 7 dias — ref hody2019):
//    o plano não muda; enquanto o músculo estiver dolorido, menos intensidade e menos duração nele, ou treinar outras
//    partes do corpo (ref cheung2003). Nenhuma fonte dá um número de dor a partir do qual reduzir: por isso a regra
//    vale para qualquer intensidade abaixo do alerta. Esforço intenso no músculo dolorido aumenta o risco de lesão
//    (ref hody2019).
//  • Dor em articulação ou tendão: modelo de monitoramento da dor — até 2, zona segura; de 3 a 5, aceitável; acima
//    de 5, risco alto; e a dor tem de voltar ao normal até a manhã seguinte (refs silbernagel2007, silbernagel2020,
//    ageberg2010). O teto de dor aceitável durante o exercício depende de onde ele foi testado:
//      – até 5: ombro (refs holmgren2012, maenhout2013), tendão de Aquiles (ref silbernagel2007), quadril e glúteo
//        (ref ageberg2010, artrose de quadril);
//      – até 3: joelho (tendão patelar — ref breda2021), cotovelo (sem consenso; a proposta mais baixa é menos de 4 —
//        ref bateman2021), lombar (o modelo não foi testado ali — ref jorgensen2018) e todas as regiões sem ensaio;
//      – até 3 em qualquer região para iniciantes, 60+, menores de 18, gestantes e quem está em dose conservadora:
//        todos os ensaios que aceitaram dor até 5 tinham fisioterapeuta acompanhando, e os próprios limites vêm da
//        prática clínica, sem avaliação formal (ref raulline2025); sem supervisão, vale o limite mais baixo com fonte.
//    Até 2: treino normal. De 3 até o teto: dá preferência a exercícios que poupam a região e, nos demais, menos
//    carga e amplitude (refs fragala2019, powers2014, diercks2014, cook2009). Acima do teto: saem os exercícios que
//    sobrecarregam a região.
// Regiões: carrega uma região o exercício marcado em `cuidado` no catálogo, o que tem um músculo dela como principal
// (ou auxiliar, quando a dor é de alerta) e o que a carrega pela mecânica — movimento, postura e apoio (ver MECANICA).
const REGIAO_DOR = {
  pescoco: { c: ['cervical'], m: ['trapezio'] }, ombro: { c: ['ombro'], m: ['deltoide_ant', 'deltoide_lat', 'deltoide_post', 'manguito'] },
  cotovelo: { c: ['cotovelo'], m: [] }, punho: { c: ['punho'], m: ['antebraco'] }, 'coluna-alta': { c: [], m: ['costas_superior', 'trapezio', 'dorsais'] },
  lombar: { c: ['lombar'], m: ['lombar'] }, quadril: { c: ['quadril'], m: ['abdutores'] }, virilha: { c: ['quadril'], m: ['adutores'] },
  'coxa-frente': { c: [], m: ['quadriceps'] }, 'coxa-tras': { c: [], m: ['posteriores'] }, joelho: { c: ['joelho'], m: [] },
  canela: { c: ['tornozelo'], m: ['tibial'] }, panturrilha: { c: [], m: ['panturrilhas'] }, aquiles: { c: ['tornozelo'], m: ['panturrilhas'] },
  tornozelo: { c: ['tornozelo'], m: [] }, pe: { c: ['tornozelo'], m: [] }, peito: { c: [], m: ['peito'] }, abdomen: { c: [], m: ['abdomen', 'obliquos'] },
  braco: { c: [], m: ['biceps', 'triceps'] }, gluteo: { c: [], m: ['gluteos'] },
};
const LOCAL_TXT = {
  pescoco: 'no pescoço', ombro: 'no ombro', cotovelo: 'no cotovelo', punho: 'no punho ou na mão', 'coluna-alta': 'na parte de cima das costas',
  lombar: 'na lombar', quadril: 'no quadril', virilha: 'na virilha', 'coxa-frente': 'na frente da coxa', 'coxa-tras': 'atrás da coxa', joelho: 'no joelho',
  canela: 'na canela', panturrilha: 'na panturrilha', aquiles: 'no tendão de Aquiles', tornozelo: 'no tornozelo', pe: 'no pé', peito: 'no peito',
  abdomen: 'no abdômen', braco: 'no braço', gluteo: 'no glúteo',
};
// Só entram dores bem formadas (o estado já é validado em store.js; aqui a função aceita qualquer entrada).
function limparDoresTreino(raw) {
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const d of raw) {
    if (!d || typeof d !== 'object' || !tem(REGIAO_DOR, d.onde) || !tem(LOCAIS_DOR, d.onde) || !tem(TIPOS_DOR, d.tipo) || d.fim) continue;
    if (typeof d.nivel !== 'number' || !Number.isFinite(d.nivel)) continue;
    out.push({
      onde: d.onde, tipo: d.tipo, nivel: Math.min(10, Math.max(1, Math.round(d.nivel))), quando: d.quando === 'repouso' || d.quando === 'depois' ? d.quando : 'durante',
      dias: typeof d.dias === 'number' && d.dias > 0 && Number.isFinite(d.dias) ? Math.round(d.dias) : 0,
    });
    if (out.length >= 40) break;
  }
  return out;
}
const perfilDe = (respostas) => (respostas && typeof respostas === 'object' && Array.isArray(respostas.cuidados) && typeof respostas.nivel === 'number' ? respostas : perfil(respostas));
const alertaDaDor = (d, pf) => dorDeAlerta(d) || (pf.gestante && (d.onde === 'abdomen' || d.onde === 'panturrilha')) || (d.onde === 'peito' && d.tipo !== 'muscular');
// regiões em que ensaios clínicos aceitaram dor até 5 em 10 durante o exercício (ver as fontes acima)
const DOR_ATE_5 = new Set(['ombro', 'aquiles', 'quadril', 'gluteo']);
// teto de dor aceitável durante o exercício, em articulação ou tendão: acima dele, saem os exercícios da região
const tetoDeDor = (d, pf) => (pf.conservador || pf.nivel === 1 || !DOR_ATE_5.has(d.onde) ? 3 : 5);
// 'alerta' | 'forte' | 'media' | 'leve'
function classeDaDor(d, pf) {
  if (alertaDaDor(d, pf)) return 'alerta';
  if (d.tipo === 'muscular') return 'media';
  return d.nivel > tetoDeDor(d, pf) ? 'forte' : d.nivel >= 3 ? 'media' : 'leve';
}
// ---------- mecânica: o que cada exercício carrega ----------
// As marcas de `cuidado` do catálogo foram pensadas para limitações antigas e não cobrem tudo o que carrega uma
// articulação (ex.: agachar com dor no tornozelo, remar com dor no cotovelo). Para as dores que tiram exercícios do
// treino (alerta e acima do teto), a região também é reconhecida pela mecânica do exercício: o tipo de movimento, a
// postura (em pé, apoio das mãos) e onde a carga é segurada. Na dúvida, o exercício conta como carregando a região.
const SUPERIOR = new Set(['empurrar_horizontal', 'empurrar_vertical', 'puxar_horizontal', 'puxar_vertical', 'aducao_horizontal', 'abducao_horizontal', 'elevacao_lateral', 'elevacao_frontal', 'encolhimento', 'remada_alta', 'rotacao_ombro', 'extensao_ombro', 'flexao_cotovelo', 'extensao_cotovelo', 'mergulho', 'punho', 'carregar', 'total']);
// movimentos em que os pés empurram contra a carga ou o rolo do aparelho apoia perto do tornozelo
const PELOS_PES = new Set(['agachar', 'afundo', 'dobradica_quadril', 'flexao_plantar', 'dorsiflexao', 'extensao_quadril', 'flexao_joelho']);
const M_PERNA = ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas'];
const M_BRACO = ['dorsais', 'costas_superior', 'peito', 'deltoide_ant', 'deltoide_lat', 'deltoide_post', 'biceps', 'triceps', 'antebraco'];
const posicaoDe = (ex) => (typeof ex.posicao === 'string' ? ex.posicao : '');
const musculosDe = (ex) => [...ex.primarios, ...ex.secundarios];
const temPrimario = (ex, lista) => ex.primarios.some((m) => lista.includes(m));
// em pé: tudo o que o texto da posição não diz ser sentado, deitado, pendurado, ajoelhado ou apoiado
const emPe = (ex) => !/^(sentad|deitad|pendurad|ajoelhad|em quatro apoios|mãos n|joelhos? e m|joelhos ou|apoiado n|em prancha|posição de|de bruços|de barriga|prancha n|com os antebraços|costas (e|no|apoiadas)|no banco|na máquina|parte alta)/i.test(posicaoDe(ex));
// em pé com carga além do peso do corpo (pesos livres, cabos, guiado e máquinas em que a pessoa fica de pé)
const emPeComCarga = (ex) => emPe(ex) && ex.modalidade !== 'peso_corporal' && ex.padrao !== 'cardio';
const M_DE_PERNA = new Set(['agachar', 'afundo', 'dobradica_quadril', 'extensao_quadril', 'abducao', 'aducao', 'flexao_plantar', 'dorsiflexao', 'flexao_joelho', 'extensao_joelho']);
// em pé num exercício de perna, mesmo sem carga (o peso do corpo passa pelo joelho e pelo quadril de apoio)
const emPeDePerna = (ex) => emPe(ex) && M_DE_PERNA.has(ex.padrao);
const cardioDePerna = (ex) => ex.padrao === 'cardio' && musculosDe(ex).some((m) => M_PERNA.includes(m));
const apoioDeMaos = (ex) => /m[ãa]os? (no chão|na borda|na parede|nas paralelas|nas alças móveis|embaixo dos ombros|apoiadas?)|quatro apoios|prancha|pendurad|apoiado n|antebra[çc]os? n|segurando|posição de flexão/i.test(posicaoDe(ex));
// a carga passa pelas mãos: movimentos de braço e tronco superior, pesos livres, cabos (menos os de tornozeleira), apoio das mãos
const maoCarregada = (ex) => SUPERIOR.has(ex.padrao) || ['barra', 'halteres', 'kettlebell'].includes(ex.modalidade) || (ex.modalidade === 'cabo' && !['abducao', 'aducao'].includes(ex.padrao)) || apoioDeMaos(ex) || (ex.padrao === 'cardio' && musculosDe(ex).some((m) => M_BRACO.includes(m)));
const barraNasCostas = (ex) => ex.modalidade === 'barra' && ['agachar', 'afundo', 'dobradica_quadril', 'flexao_plantar'].includes(ex.padrao);
const emPadrao = (ex, lista) => lista.includes(ex.padrao);
const peEPerna = (ex) => emPe(ex) || PELOS_PES.has(ex.padrao) || cardioDePerna(ex);
const MECANICA = {
  joelho: (ex) => emPadrao(ex, ['agachar', 'afundo', 'extensao_joelho', 'flexao_joelho', 'dobradica_quadril']) || cardioDePerna(ex) || emPeDePerna(ex) || temPrimario(ex, ['quadriceps', 'posteriores']) || /ajoelhad|quatro apoios|joelhos? (e m|no chão|ou)/i.test(posicaoDe(ex)),
  quadril: (ex) => emPadrao(ex, ['agachar', 'afundo', 'dobradica_quadril', 'extensao_quadril', 'abducao', 'aducao', 'flexao_quadril', 'extensao_lombar']) || cardioDePerna(ex) || emPeDePerna(ex) || temPrimario(ex, ['gluteos', 'abdutores', 'adutores']),
  virilha: (ex) => emPadrao(ex, ['agachar', 'afundo', 'aducao', 'abducao']) || cardioDePerna(ex),
  'coxa-frente': (ex) => emPadrao(ex, ['agachar', 'afundo', 'extensao_joelho']) || cardioDePerna(ex),
  'coxa-tras': (ex) => emPadrao(ex, ['flexao_joelho', 'dobradica_quadril', 'extensao_quadril', 'extensao_lombar']) || cardioDePerna(ex),
  gluteo: (ex) => emPadrao(ex, ['extensao_quadril', 'agachar', 'afundo', 'dobradica_quadril', 'abducao']) || cardioDePerna(ex),
  tornozelo: peEPerna, pe: peEPerna, aquiles: peEPerna, canela: peEPerna, panturrilha: peEPerna,
  cotovelo: maoCarregada, punho: maoCarregada, ombro: maoCarregada, braco: maoCarregada,
  peito: (ex) => emPadrao(ex, ['empurrar_horizontal', 'aducao_horizontal', 'mergulho']),
  'coluna-alta': (ex) => emPadrao(ex, ['puxar_horizontal', 'puxar_vertical', 'abducao_horizontal', 'encolhimento', 'remada_alta', 'extensao_ombro', 'extensao_lombar', 'carregar']) || barraNasCostas(ex) || (ex.padrao === 'dobradica_quadril' && ['barra', 'halteres', 'kettlebell'].includes(ex.modalidade)),
  pescoco: (ex) => emPadrao(ex, ['encolhimento', 'remada_alta', 'empurrar_vertical', 'flexao_tronco', 'carregar']) || barraNasCostas(ex),
  lombar: (ex) => emPadrao(ex, ['agachar', 'afundo', 'dobradica_quadril', 'extensao_quadril', 'extensao_lombar', 'flexao_tronco', 'flexao_quadril', 'rotacao', 'anti_extensao', 'carregar', 'total']) || emPeComCarga(ex),
  abdomen: (ex) => emPadrao(ex, ['flexao_tronco', 'flexao_quadril', 'rotacao', 'anti_extensao', 'carregar', 'total']),
};
// Joelho e quadril, só na dor de ALERTA (forte, repentina ou em repouso), em que a pessoa mal apoia o peso: também sai o
// que é feito em pé com carga, mesmo sendo exercício de braço. Na dor acima do teto que não é de alerta, ficar em pé
// parado não é o que carrega o joelho ou o quadril: saem só os movimentos da própria articulação (trocar uma rosca em pé
// "para poupar o joelho" não faz sentido e tira a confiança no ajuste). Pé, tornozelo, canela, Aquiles e panturrilha
// sustentam o peso do corpo o tempo todo em pé: neles, em pé conta sempre (ver peEPerna).
const SO_NO_ALERTA = { joelho: emPeComCarga, quadril: emPeComCarga };
const MEC_CACHE = new Map();
// o exercício carrega a região, pela mecânica (sem olhar as marcas de cuidado)?
function carregaRegiao(ex, onde, alerta = false) {
  const k = onde + '|' + ex.id + (alerta ? '|a' : '');
  let v = MEC_CACHE.get(k);
  if (v === undefined) { v = !!((MECANICA[onde] && MECANICA[onde](ex)) || (alerta && SO_NO_ALERTA[onde] && SO_NO_ALERTA[onde](ex))); MEC_CACHE.set(k, v); }
  return v;
}
// quanto o exercício pega a região da dor: 2 = diretamente, 1 = de leve, 0 = nada
function toqueDaDor(ex, d, alerta) {
  const r = REGIAO_DOR[d.onde];
  const c = ex.cuidado.some((x) => r.c.includes(x));
  const p = ex.primarios.some((x) => r.m.includes(x));
  const s = ex.secundarios.some((x) => r.m.includes(x));
  // dor muscular comum: vale o músculo (principal = direto; auxiliar = de leve)
  if (d.tipo === 'muscular' && !alerta) return p ? 2 : s || c ? 1 : 0;
  const mec = carregaRegiao(ex, d.onde, alerta);
  if (alerta) return c || p || s || mec ? 2 : 0;
  return c || p || mec ? 2 : s ? 1 : 0;
}
// Pior efeito das dores sobre um exercício: grau 3 = evitar, 2 = aliviar (menos carga/amplitude), 1 = só acompanhar.
function avaliarDor(ex, dores, pf) {
  let pior = null;
  for (const d of dores) {
    const classe = classeDaDor(d, pf);
    const t = toqueDaDor(ex, d, classe === 'alerta');
    if (!t) continue;
    const grau = classe === 'alerta' || (classe === 'forte' && t === 2) ? 3 : classe === 'forte' ? 1 : classe === 'media' ? t : t === 2 ? 1 : 0;
    // em caso de empate, vale a dor de alerta (com ela não se propõe troca)
    if (grau && (!pior || grau > pior.grau || (grau === pior.grau && classe === 'alerta' && pior.classe !== 'alerta'))) pior = { grau, d, classe };
  }
  return pior;
}
// O que as dores proíbem (veta) ou desaconselham (poupa) na montagem do plano. null = nada a mudar.
function regrasDeDor(dores, pf) {
  const r = { vetaC: new Set(), vetaP: new Set(), vetaS: new Set(), vetaMec: new Set(), vetaMecA: new Set(), poupaC: new Set(), poupaP: new Set(), poupaMec: new Set() };
  for (const d of dores) {
    const classe = classeDaDor(d, pf);
    const reg = REGIAO_DOR[d.onde];
    if (classe === 'alerta') { r.vetaMecA.add(d.onde); for (const c of reg.c) r.vetaC.add(c); for (const m of reg.m) { r.vetaP.add(m); r.vetaS.add(m); } }
    else if (d.tipo === 'muscular') continue;
    else if (classe === 'forte') { r.vetaMec.add(d.onde); for (const c of reg.c) r.vetaC.add(c); for (const m of reg.m) r.vetaP.add(m); }
    else if (classe === 'media') { r.poupaMec.add(d.onde); for (const c of reg.c) r.poupaC.add(c); for (const m of reg.m) r.poupaP.add(m); }
  }
  r.chave = [r.vetaC, r.vetaP, r.vetaS, r.vetaMec, r.vetaMecA, r.poupaC, r.poupaP, r.poupaMec].map((s) => [...s].sort().join(',')).join(';');
  return r.chave === ';;;;;;;' ? null : r;
}
const algum = (conj, f) => { for (const x of conj) if (f(x)) return true; return false; };
const vetadoPorDor = (ex, r) => ex.cuidado.some((c) => r.vetaC.has(c)) || ex.primarios.some((m) => r.vetaP.has(m)) || ex.secundarios.some((m) => r.vetaS.has(m)) || algum(r.vetaMec, (onde) => carregaRegiao(ex, onde)) || algum(r.vetaMecA, (onde) => carregaRegiao(ex, onde, true));
const poupadoPorDor = (ex, r) => ex.cuidado.some((c) => r.poupaC.has(c)) || ex.primarios.some((m) => r.poupaP.has(m)) || algum(r.poupaMec, (onde) => carregaRegiao(ex, onde));
function avisosDeDor(dores, pf) {
  const out = [];
  for (const d of dores) {
    const classe = classeDaDor(d, pf);
    const onde = LOCAL_TXT[d.onde];
    if (classe === 'alerta') out.push({ tipo: 'warn', dor: d.onde, texto: `Dor de alerta ${onde}: este plano não treina essa região. Procure um médico ou fisioterapeuta antes de voltar a treiná-la.` });
    else if (d.tipo !== 'muscular' && classe === 'forte') out.push({ tipo: 'info', dor: d.onde, texto: `Dor ${onde}: deixei de fora os exercícios que sobrecarregam essa região.` });
    else if (d.tipo !== 'muscular' && classe === 'media') out.push({ tipo: 'info', dor: d.onde, texto: `Dor ${onde}: dei preferência a exercícios que poupam essa região. Nos demais, use menos carga e só a amplitude sem dor.` });
  }
  return out;
}
function refsDaDor(d, pf, classe) {
  if (classe === 'alerta') return [...new Set(['dubois2020', d.onde === 'lombar' ? 'verhagen2016' : '', pf.gestante ? 'acog804' : '', d.onde === 'peito' ? 'riebe2015' : ''].filter(Boolean))];
  if (d.tipo === 'muscular') return ['hody2019', 'cheung2003', 'herbert2011'];
  const regiao = { lombar: ['george2021', 'jorgensen2018'], ombro: ['holmgren2012', 'diercks2014'], joelho: ['breda2021', 'powers2014'], aquiles: ['cook2009'], cotovelo: ['bateman2021'], quadril: ['ageberg2010'], gluteo: ['ageberg2010'] }[d.onde] || [];
  return ['silbernagel2007', 'silbernagel2020', 'smith2017', ...regiao, ...(pf.conservador || pf.nivel === 1 ? ['raulline2025'] : []), ...(pf.idoso ? ['fragala2019'] : [])];
}
// Orientação curta sobre uma dor, para o cartão de dores: { classe, alerta, texto, refs }. null se a dor é inválida.
export function orientacaoDaDor(dor, respostas) {
  const d = limparDoresTreino([dor])[0];
  if (!d) return null;
  const pf = perfilDe(respostas);
  const classe = classeDaDor(d, pf);
  let texto;
  if (classe === 'alerta') {
    texto = pf.gestante && (d.onde === 'abdomen' || d.onde === 'panturrilha') ? 'Na gestação, dor no abdômen ou na panturrilha pede contato com o obstetra antes de treinar.'
      : d.onde === 'peito' && d.tipo !== 'muscular' ? 'Dor no peito que não é do músculo precisa de avaliação médica antes de qualquer treino.'
        : d.onde === 'lombar' ? 'Não treino essa região até a avaliação; o resto do corpo continua. Procure atendimento logo se houver formigamento ou fraqueza na perna, perda do controle da urina, febre ou queda.'
          : 'Não treino essa região até a avaliação; o resto do corpo continua.';
  } else if (d.tipo === 'muscular') {
    texto = d.dias > 7 ? 'A dor comum do treino some em até 7 dias. Se continua, procure avaliação; se passou, toque em “Melhorou”.'
      : 'É a dor comum do treino: pico entre 1 e 3 dias, some em até 7. Enquanto doer, treine esse músculo mais leve (menos carga e menos séries) ou treine outras partes. Alongar não ajuda.';
    if (d.dias <= 7 && (pf.nunca || pf.nivel === 1)) texto += ' É comum nas primeiras semanas e diminui quando o treino se repete.';
  } else {
    const teto = tetoDeDor(d, pf);
    texto = classe === 'forte' ? `Acima de ${teto} em 10 nessa região, os exercícios que a sobrecarregam ficam de fora até a dor baixar. Se não baixar em poucos dias, procure avaliação.`
      : classe === 'media' ? `Dá para treinar com menos carga e amplitude, sem passar de ${teto} em 10. A dor deve voltar ao normal até a manhã seguinte e não aumentar de uma semana para outra.`
        : `Dor leve: pode treinar normalmente. Se passar de ${teto} em 10 durante o treino ou não ceder até a manhã seguinte, reduza a carga.`;
    if (d.dias >= 14) texto += ' Como já dura 2 semanas, vale procurar um fisioterapeuta.';
  }
  return { classe, alerta: classe === 'alerta', texto, refs: refsDaDor(d, pf, classe) };
}
// Aviso para um exercício do treino em andamento: null (pode fazer) ou { nivel: 'evitar' | 'leve', texto, onde, refs }.
// `respostas` (opcional, recomendado): respostas da entrevista (state.trainer.answers) ou perfil pronto. Sem elas vale o
// teto mais baixo (o de iniciante: dor em articulação acima de 3 já manda evitar).
export function alertaDoExercicio(exId, doresBrutas, respostas = null) {
  const ex = typeof exId === 'string' ? EX_POR_ID.get(exId) : null;
  const dores = limparDoresTreino(doresBrutas);
  if (!ex || !dores.length) return null;
  const pf = perfilDe(respostas);
  const a = avaliarDor(ex, dores, pf);
  if (!a) return null;
  const onde = LOCAL_TXT[a.d.onde];
  const texto = a.classe === 'alerta' ? `Dor de alerta ${onde}: não faça este exercício até um médico ou fisioterapeuta avaliar.`
    : a.grau === 3 ? `Dor ${onde} acima do aceitável: pule este exercício por enquanto.`
      : a.d.tipo === 'muscular' ? (a.grau === 2 ? `Músculo dolorido (dor ${onde}): hoje vá mais leve, com menos carga e uma série a menos.` : `Dor muscular ${onde}: este exercício usa esse músculo de leve; pare se a dor aumentar.`)
        : a.grau === 2 ? `Dor ${onde}: use menos carga e só a amplitude sem dor. Pare se passar de ${tetoDeDor(a.d, pf)} em 10.`
          : `Dor ${onde}: pode fazer. Se passar de ${tetoDeDor(a.d, pf)} em 10, reduza a carga ou pare.`;
  return { nivel: a.grau === 3 ? 'evitar' : 'leve', texto, onde: a.d.onde, refs: refsDaDor(a.d, pf, a.classe) };
}
// Marca gravada na nota do item trocado por causa de uma dor (permite desfazer): "dor:<local>:<exercício original>".
export const marcaDor = (onde, exId) => `dor:${onde}:${exId}`;
function lerMarcaDor(nota) {
  const m = typeof nota === 'string' ? /^dor:([\w-]{1,20}):([\w-]{1,80})$/.exec(nota) : null;
  return m && tem(REGIAO_DOR, m[1]) && EX_POR_ID.has(m[2]) ? { onde: m[1], ex: m[2] } : null;
}
const diasDoPlano = (plan) => (plan && Array.isArray(plan.dias) ? plan.dias.filter((d) => d && Array.isArray(d.itens)) : []);
// Mudanças propostas para o plano ATIVO por causa das dores. Cada item: { tipo, diaId, dia, idx, de, para?, onde, motivo, refs }.
//   'trocar'  → há um exercício equivalente que poupa a região (é a única mudança gravada no plano, e pode ser desfeita);
//   'pular'   → não há equivalente: o exercício fica de fora até melhorar (a tela do treino avisa);
//   'aliviar' → pode fazer, com menos carga e amplitude (ou mais leve, na dor muscular).
// Com dor de alerta nunca há troca: a região não é treinada.
export function ajustesPorDor(plan, respostas, gymBruta, doresBrutas) {
  const dores = limparDoresTreino(doresBrutas);
  const out = [];
  if (!dores.length) return out;
  const pf = perfil(respostas);
  const gym = academia(gymBruta);
  const dias = diasDoPlano(plan);
  const noPlano = new Set(dias.flatMap((d) => d.itens.map((i) => i && i.ex)));
  for (const d of dias) {
    d.itens.forEach((it, idx) => {
      const ex = it ? EX_POR_ID.get(it.ex) : null;
      if (!ex) return;
      const a = avaliarDor(ex, dores, pf);
      if (!a || a.grau < 2) return;
      const onde = LOCAL_TXT[a.d.onde];
      const base = { diaId: d.id, dia: d.nome, idx, de: ex.id, onde: a.d.onde, refs: refsDaDor(a.d, pf, a.classe) };
      if (a.classe === 'alerta') { out.push({ ...base, tipo: 'pular', motivo: `Dor de alerta ${onde}: fica de fora até a avaliação.` }); return; }
      const alt = a.d.tipo === 'muscular' ? null : alternativas(ex, pf, gym, noPlano).find((c) => !avaliarDor(c, dores, pf));
      if (alt) { noPlano.add(alt.id); out.push({ ...base, tipo: 'trocar', para: alt.id, motivo: `Poupa a região da dor ${onde}.` }); return; }
      if (a.grau === 3) out.push({ ...base, tipo: 'pular', motivo: `Sem equivalente que poupe a região da dor ${onde}: fica de fora até melhorar.` });
      else out.push({ ...base, tipo: 'aliviar', motivo: a.d.tipo === 'muscular' ? 'Músculo dolorido: mais leve por 1 a 2 dias.' : `Dor ${onde}: menos carga e só a amplitude sem dor.` });
    });
  }
  return out;
}
// Aplica as trocas em `dias` (lista de treinos que pode ser alterada). Devolve quantas foram feitas.
export function aplicarTrocasDor(dias, ajustes) {
  let n = 0;
  for (const t of Array.isArray(ajustes) ? ajustes : []) {
    if (!t || t.tipo !== 'trocar' || !EX_POR_ID.has(t.para) || !tem(REGIAO_DOR, t.onde)) continue;
    const d = (Array.isArray(dias) ? dias : []).find((x) => x && x.id === t.diaId);
    const it = d && Array.isArray(d.itens) ? d.itens[t.idx] : null;
    if (!it || it.ex !== t.de || d.itens.some((x) => x && x.ex === t.para)) continue;
    // se o item já tinha sido trocado por outra dor, o original continua sendo o primeiro
    const antes = lerMarcaDor(it.nota);
    d.itens[t.idx] = { ...it, ex: t.para, nota: marcaDor(t.onde, antes ? antes.ex : t.de) };
    n++;
  }
  return n;
}
// Trocas por dor que já podem ser desfeitas: a dor melhorou, passou do prazo ou baixou. Cada item: { diaId, dia, idx, de, para, onde }.
export function voltasPorDor(plan, respostas, doresBrutas) {
  const dores = limparDoresTreino(doresBrutas);
  const pf = perfil(respostas);
  const out = [];
  for (const d of diasDoPlano(plan)) {
    d.itens.forEach((it, idx) => {
      const m = it ? lerMarcaDor(it.nota) : null;
      if (!m || m.ex === it.ex || d.itens.some((x) => x && x.ex === m.ex)) return;
      const a = avaliarDor(EX_POR_ID.get(m.ex), dores, pf);
      if (a && a.grau >= 2) return;
      out.push({ diaId: d.id, dia: d.nome, idx, de: it.ex, para: m.ex, onde: m.onde });
    });
  }
  return out;
}
export function aplicarVoltasDor(dias, voltas) {
  let n = 0;
  for (const t of Array.isArray(voltas) ? voltas : []) {
    const d = (Array.isArray(dias) ? dias : []).find((x) => x && t && x.id === t.diaId);
    const it = d && Array.isArray(d.itens) ? d.itens[t.idx] : null;
    if (!it || it.ex !== t.de || !EX_POR_ID.has(t.para) || d.itens.some((x) => x && x.ex === t.para)) continue;
    d.itens[t.idx] = { ...it, ex: t.para, nota: '' };
    n++;
  }
  return n;
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

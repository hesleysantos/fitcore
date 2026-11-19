// Assuntos do dia a dia que não são de um dia de treino: desânimo, falta de resultado, noite mal dormida e água no
// treino (Treinador, Treinador de corrida e Nutricionista). Puro: sem DOM. Formato em logic/chat/contrato.js.
//
// Fontes (todas lidas em texto completo; as frases usadas estão em data/knowledge.js, junto de cada referência):
//  • DESÂNIMO: hábito = repetir no mesmo horário e lugar, ligado a algo da rotina; metas pequenas; faltar uma vez não
//    desfaz; em média 66 dias para ficar automático, com muita variação (gardner2012). Planejar quando, onde e como ajuda
//    pouco, mais quando o plano é revisto (silva2018). Apoio de outras pessoas aumentou o efeito; anotar o progresso e
//    rever metas ajudam a manter (greaves2011). Treinar porque gosta sustenta mais do que treinar por culpa (teixeira2012).
//    Segurança: humor para baixo ou perda de interesse quase o dia todo, quase todo dia, por 2 semanas ou mais são
//    sinais de depressão (oms_depressao); tratamento no SUS, na Atenção Primária e nos CAPS (ms_depressao); 188 (cvv).
//  • SEM RESULTADO: só o treino de força, em 13 ± 8 semanas, deu em média 1,1 kg de massa magra; o treino é um estímulo
//    muito mais forte para a força do que a proteína extra (morton2018); progressão aos poucos (acsm2009); semana mais
//    leve a cada 4 a 6 semanas, por cerca de 7 dias (bell2023); exercício parado há 3 treinos: regra do aplicativo
//    (logic/progress.js, estagnados). Peso: sobe no fim de semana e cai nos dias úteis, cerca de 0,35% (turicchi2020);
//    com a perda de peso o corpo gasta menos e o déficit precisa ser revisto (trexler2014); o que se anota costuma ficar
//    abaixo do real (burrows2019); ritmo de 0,5% a 1% por semana (helms2014).
//  • DORMI MAL: a pergunta frequente do sono (data/sono.js, "Dormi mal. Treino hoje?") e cerca de 0,4% de queda por hora
//    acordado antes do exercício; se treinar, quanto antes no dia (craven2022). Mais leve e sem recorde: escolha do
//    aplicativo, coerente com a queda maior nas tarefas de habilidade.
//  • ÁGUA NO TREINO: até 1 hora, só água; perder mais de 2% do peso tira força e potência; depois, até 150% do que se
//    perdeu; conferir pela cor da urina de manhã, pela sede e pelo peso; não ganhar peso no treino (mcdermott2017);
//    antes, 5 a 10 mL por kg de 2 a 4 horas antes (thomas2016); excesso de água = hiponatremia (hewbutler2017).
// Quem o app protege (transtorno alimentar, menores de 18) não recebe número de peso, de calorias nem de gramas.
import { passoTempo, passoPerdido, treinoDeHoje, corridaDeHoje } from './treino.js';
import { passoMaisDevagar, passoNaoCorrer, comPlano as temPlanoCorrida } from './corrida.js';
import { perfilNutri } from './nutri.js';
import { faqDe } from './comum.js';
import * as P from '../perdido.js';
import { noiteDe, metaDeSono, fmtHoras, fmtFaixa } from '../sono.js';
import { estagnados } from '../progress.js';
import { EX_POR_ID } from '../../data/exercises.js';
import { FAQ_SONO } from '../../data/sono.js';

const lista = (v) => (Array.isArray(v) ? v : []);
const treinouHoje = (ctx) => lista(ctx.st && ctx.st.sessions).some((s) => s && P.diaLocal(s.inicio) === ctx.hoje);
const correuHoje = (ctx) => lista(ctx.st && ctx.st.runs).some((r) => r && r.data === ctx.hoje);
const temTreinoHoje = (ctx) => !!treinoDeHoje(ctx) && !treinouHoje(ctx);
const temCorridaHoje = (ctx) => !!corridaDeHoje(ctx) && !correuHoje(ctx);
const protegido = (ctx) => { try { return perfilNutri(ctx).protegido; } catch { return false; } };
const naoTreinarHoje = (c, motivo) => passoPerdido({ ...c, data: c.hoje, motivo });
const naoCorrerHoje = (c, motivo) => passoNaoCorrer({ ...c, data: c.hoje, motivo });

// ---------- desânimo ----------
const AVISO_HUMOR = { tipo: 'info', texto: 'Desânimo com quase tudo, quase todo dia, há 2 semanas ou mais? Procure a UBS ou um CAPS. Se pensar em morrer, ligue 188 (CVV).' };
function passoDesanimo(ctx, coach) {
  const corrida = coach === 'corrida';
  const hoje = corrida ? temCorridaHoje(ctx) : temTreinoHoje(ctx);
  const texto = ['Acontece com todo mundo. Não espere a vontade voltar: faça pouco, mas faça.'];
  if (hoje) texto.push(corrida ? 'Hoje, que tal uma corrida mais curta e leve?' : 'Hoje, que tal a versão curta do treino?');
  const opcoes = hoje
    ? (corrida
      ? [{ rotulo: 'Correr menos hoje', valor: 'leve' }, { rotulo: 'Não vou correr hoje', valor: 'passar' }]
      : [{ rotulo: 'Fazer a versão curta', valor: 'curta' }, { rotulo: 'Passar o treino', valor: 'passar' }])
    : [];
  opcoes.push({ rotulo: 'Como manter o hábito', valor: 'habito' });
  return {
    texto,
    aviso: AVISO_HUMOR,
    detalhes: ['Humor para baixo ou perda de interesse quase o dia todo, quase todo dia, por 2 semanas ou mais, são sinais de depressão descritos pela OMS. Tem tratamento no SUS, na Atenção Primária e nos CAPS.'],
    refs: ['oms_depressao', 'ms_depressao', 'cvv'],
    opcoes,
    proximo: (v, c) => (v === 'habito' ? passoHabito()
      : v === 'curta' ? passoTempo({ ...c, data: c.hoje })
        : v === 'leve' ? passoMaisDevagar({ ...c, data: c.hoje })
          : corrida ? naoCorrerHoje(c, 'outro') : naoTreinarHoje(c, 'outro')),
  };
}
function passoHabito() {
  return {
    texto: [
      'O que mais ajuda, segundo os estudos:',
      '• Mesmo horário e lugar, logo depois de algo que você já faz (por exemplo, ao sair do trabalho).',
      '• Metas pequenas, que dá para cumprir: falhar desanima.',
      '• Faltou um dia? Siga no próximo: isso não desfaz o hábito.',
      '• Anote o que fez e, se puder, treine com alguém.',
      '• Prefira o que você gosta de fazer: é o que dura.',
    ],
    detalhes: [
      'Num estudo, o hábito levou em média 66 dias para ficar automático, com muita variação entre as pessoas.',
      'Planejar quando, onde e como treinar ajudou um pouco, sobretudo quando o plano era revisto.',
      'Treinar porque gosta sustenta o exercício por mais tempo do que treinar por culpa ou pressão.',
    ],
    refs: ['gardner2012', 'silva2018', 'greaves2011', 'teixeira2012'],
  };
}

// ---------- sem resultado (musculação) ----------
function passoSemResultado(ctx) {
  const prot = protegido(ctx);
  let travados = [];
  try { const plan = P.planoAtivo(ctx.st); travados = plan ? estagnados(plan).map((id) => EX_POR_ID.get(id)).filter(Boolean) : []; } catch { travados = []; }
  const texto = [prot ? 'Músculo cresce devagar: leva meses, e varia muito de uma pessoa para outra.' : 'Músculo cresce devagar: nos estudos, uns 3 meses de treino deram em média cerca de 1 kg de massa magra, com muita diferença entre as pessoas.'];
  if (travados.length) {
    const nomes = travados.slice(0, 3).map((e) => e.nome).join(', ');
    texto.push(`Parados há 3 treinos: ${nomes}. Baixe a carga uns 10% e suba de novo, ou troque o exercício.`);
  }
  texto.push('O que mais conta:',
    '• Subir a carga ou as repetições aos poucos, quando ficar fácil.',
    '• Treinar com regularidade, sem faltar muito.',
    '• Dormir bem e comer proteína: ajudam, mas o treino pesa mais.',
    '• Cansaço acumulado há semanas? Uma semana mais leve ajuda a recuperar.');
  const detalhes = [
    'O treino de força foi um estímulo muito mais forte para ganhar força do que a proteína extra.',
    'A semana mais leve é uma pausa planejada para baixar o cansaço do corpo e da cabeça: costuma vir a cada 4 a 6 semanas e durar cerca de 7 dias.',
  ];
  if (travados.length) detalhes.push('A regra dos 3 treinos sem evolução é do aplicativo.');
  return {
    texto, detalhes, refs: ['morton2018', 'acsm2009', 'bell2023'],
    ir: P.planoAtivo(ctx.st) ? [{ rotulo: 'Sugerir trocas de exercícios', abrir: 'treinador-trocas' }] : undefined,
  };
}

// ---------- sem resultado (peso) ----------
function passoNaoEmagreco(ctx) {
  let N = null;
  try { N = perfilNutri(ctx); } catch { N = null; }
  const ir = [{ rotulo: 'Abrir a Nutrição', rota: 'nutricao' }];
  if (N && N.protegido) {
    return {
      texto: [N.transtorno ? 'Com histórico de transtorno alimentar, não acompanho o peso por aqui: isso pode fazer mal.' : 'Antes dos 18 anos, o corpo ainda está crescendo: não acompanho o peso por aqui.',
        N.transtorno ? 'Converse sobre isso com quem acompanha você (nutricionista e psicólogo).' : 'Converse sobre isso com um nutricionista ou pediatra.'],
      ir,
    };
  }
  if (N && N.gestante) return { texto: ['Na gestação e na amamentação, o peso é acompanhado no pré-natal.', 'Siga o que a sua equipe de saúde orientar.'], ir };
  return {
    texto: [
      'O peso varia de um dia para o outro: costuma subir no fim de semana e cair durante a semana.',
      'Compare a média de cada semana, por 2 a 3 semanas, e não um dia só.',
      'O que conferir:',
      '• Porções e bebidas: o que se anota costuma ficar abaixo do que se come.',
      '• Peso parado há semanas: a meta precisa de ajuste, porque o corpo passa a gastar um pouco menos.',
      '• Perder rápido demais também não é bom: de 0,5% a 1% do peso por semana é o ritmo indicado.',
    ],
    detalhes: [
      'Num estudo em 4 países europeus, o peso subiu cerca de 0,35% no fim de semana e caiu nos dias úteis. Depois do Natal, subiu 1,35% e não voltou de todo nos meses seguintes.',
      'Com a perda de peso, o corpo gasta menos, inclusive nos movimentos do dia a dia. Quando o peso trava, a meta precisa ser revista.',
      'Perda de peso sem explicação, ou cansaço que não passa, pede consulta médica.',
    ],
    refs: ['turicchi2020', 'trexler2014', 'burrows2019', 'helms2014'],
    ir: [{ rotulo: 'Ver a Evolução', rota: 'progresso' }, ...ir],
  };
}

// ---------- dormi mal ----------
function passoDormiMal(ctx, coach) {
  const corrida = coach === 'corrida';
  let noite = null, meta = null;
  try { noite = noiteDe(ctx.st, ctx.hoje); meta = metaDeSono(ctx.st, ctx.hoje); } catch { noite = null; }
  const texto = [];
  const refs = ['craven2022'];
  if (noite && meta && noite.horas < meta.min) { texto.push(`Você dormiu ${fmtHoras(noite.horas)} esta noite; o recomendado para você é ${fmtFaixa(meta.min, meta.max)}.`); refs.push(...(meta.motivos && meta.motivos[0] ? lista(meta.motivos[0].refs) : [])); }
  else if (noite) texto.push(`Você registrou ${fmtHoras(noite.horas)} de sono esta noite.`);
  texto.push(corrida ? 'Dá para correr: prefira mais leve, sem tiros fortes, e mais cedo, se der.' : 'Dá para treinar: prefira mais leve, sem buscar recorde, e mais cedo, se der.');
  const f = faqDe(FAQ_SONO, 'Dormi mal');
  const detalhes = [...(f ? f.a : []), 'Cada hora acordado antes do exercício piorou o desempenho em cerca de 0,4%.', 'Cansaço fora do comum nas atividades de sempre, que não passa, é um dos sinais da triagem antes do exercício: nesse caso, procure um médico.'];
  refs.push('whitfield2017');
  const hoje = corrida ? temCorridaHoje(ctx) : temTreinoHoje(ctx);
  const p = { texto, detalhes, refs, ir: noite ? undefined : [{ rotulo: 'Registrar o sono', rota: 'sono' }] };
  if (hoje) {
    p.opcoes = corrida ? [{ rotulo: 'Correr mais leve', valor: 'leve' }, { rotulo: 'Não vou correr hoje', valor: 'passar' }] : [{ rotulo: 'Fazer a versão curta', valor: 'curta' }, { rotulo: 'Passar o treino', valor: 'passar' }];
    p.proximo = (v, c) => (v === 'curta' ? passoTempo({ ...c, data: c.hoje }) : v === 'leve' ? passoMaisDevagar({ ...c, data: c.hoje }) : corrida ? naoCorrerHoje(c, 'cansaco') : naoTreinarHoje(c, 'cansaco'));
  }
  return p;
}

// ---------- água no treino ----------
function passoAgua(ctx, coach) {
  const prot = protegido(ctx);
  const texto = [
    coach === 'corrida' ? 'Corrida de até 1 hora: água basta. Isotônico só ajuda nas mais longas ou com tiros fortes.' : 'Treino de até 1 hora: água basta. Isotônico só ajuda em treinos mais longos ou com tiros fortes.',
    'Comece o treino bem hidratado e beba quando tiver sede.',
    'Para conferir:',
    prot ? '• Urina clara pela manhã e pouca sede: você está bem.' : '• Urina clara pela manhã, pouca sede e peso estável: você está bem.',
    '• Não force: beber demais também faz mal.',
  ];
  const detalhes = prot ? [] : [
    'Antes: de 5 a 10 mL por kg de peso, de 2 a 4 horas antes.',
    'Perder mais de 2% do peso no treino já tira força, potência e fôlego.',
    'Depois: pese-se antes e depois e reponha até 1,5 vez o que perdeu, nas horas seguintes.',
    'Ganhar peso durante o treino é sinal de água demais.',
  ];
  detalhes.push('Dor de cabeça, tontura, enjoo, cansaço e tremor nos músculos depois de beber muita água podem ser excesso de água (hiponatremia). Com confusão ou convulsão, ligue 192.');
  const p = { texto, detalhes, refs: ['mcdermott2017', ...(prot ? [] : ['thomas2016']), 'hewbutler2017'] };
  if (coach === 'corrida') p.sugestoes = [{ rotulo: 'Como correr no calor?', valor: 'f:Como correr no calor' }];
  return p;
}

// ---------- palavras ----------
const DESANIMO = ['cansei academia', 'cansei treinar', 'enjoei academia', 'perder vontade', 'nao perder vontade', 'manter vontade', 'vontade ir academia', 'vergonha', 'vergonha academia', 'rindo de mim', 'ficou rindo', 'me julgam', 'olhando pra mim', '!desanimo', 'sem animo', 'sem vontade', 'sem motivacao', 'falta motivacao', 'perdi pique', 'perdi animo', 'perdi vontade',
  'nao tenho vontade', 'nao tenho animo', 'nao tenho motivacao', 'preguica', 'preguica treinar', 'vontade desistir', 'pensando desistir', 'quero desistir', 'largar academia', 'largar tudo', 'nao consigo manter', 'manter rotina', 'manter habito',
  'criar habito', 'disciplina', 'constancia', 'sem foco', 'nao tenho disciplina', 'motivacao', 'motivar', 'animo'];
const SEM_RESULTADO = ['nao sai lugar', 'mesmo peso semanas', 'semanas mesmo peso', 'travei no', 'nao vejo mudanca', 'mudanca nenhuma', 'nao vejo diferenca', 'nao sobe', 'carga nao sobe', 'peso nao sobe', 'nao passa de', 'destravar', 'to evoluindo', 'estou evoluindo', 'evoluindo de verdade', 'saber se evoluo', '!estagnei', '!estagnado', '!estagnada', 'nao vejo resultado', 'sem resultado', 'nao tenho resultado', 'resultado nenhum', 'nao evoluo', 'nao estou evoluir', 'parei evoluir', 'nao saio lugar', 'nao ganho massa',
  'nao ganho musculo', 'nao ganho forca', 'nao cresco', 'nao cresce', 'corpo nao muda', 'nada muda', 'nao muda nada', 'nao melhoro', 'treino nao funciona', 'continuo igual', 'tudo igual', 'nao aparece resultado'];
const NAO_EMAGRECO = ['nao emagreco', 'nao estou emagrecendo', 'nao to emagrecendo', 'nao emagrecendo', 'nao ando emagrecendo', 'nao emagrecer', 'nao estou emagrecer', 'nao to emagrecer', 'nao consigo emagrecer', 'parei emagrecer', 'nao perco peso', 'nao perdi peso', 'nao perder peso', 'peso nao desce', 'peso nao baixa', 'peso nao cai',
  'peso nao muda', 'peso parado', 'peso travado', 'peso subiu', 'engordei', '!engordando', 'balanca nao mexe', 'balanca nao desce', 'balanca nao baixa', 'balanca', 'sem resultado', 'nao vejo resultado', '!estagnei', 'nao muda nada'];
const DORMI = ['dormi mal', 'dormi pouco', 'dormir mal', 'dormir pouco', 'mal dormir', 'nao dormi', 'quase nao dormi', 'dormi nada', 'noite mal dormida', 'noite ruim', 'noite pessima', 'virei noite', 'perdi noite',
  'sono ruim', 'pouco sono', 'muito sono', 'com sono', 'to com sono', 'estou com sono'];
const AGUA = ['bebi pouca agua', 'pouca agua', 'litro agua', 'bebo pouca agua', '!hidratacao', '!hidratar', '!hidratado', '!desidratado', '!desidratada', '!desidratar', '!desidratacao', '!isotonico', '!isotonicos', '!gatorade', 'bebida esportiva', 'beber agua treino', 'agua treino', 'beber durante',
  'beber treino', 'agua durante', 'agua antes', 'agua depois', 'garrafinha', 'quanto beber treino', 'repor liquido', 'suei muito', 'perco muito suor', 'muito suor', 'agua demais', 'beber muita agua', 'hiponatremia'];
const AGUA_CORRIDA = [...AGUA, 'agua corrida', 'beber correndo', 'beber corrida', 'agua correr', 'beber longao', 'agua longao'];

// "dormi 4 horas", "dormi só duas horas": a noite curta dita com número ("acordei 5h" não é noite mal dormida)
const NOITE_CURTA = /\bdormi (so |apenas |umas |tipo )?(\d|uma|duas|tres|quatro|cinco)\b( e meia)?( horas?| h\b|$)/;
const noiteCurta = (i) => (NOITE_CURTA.test(i.texto) ? 3 : 0);
// "não quero correr hoje, sem vontade": o pedido é faltar (Não vou treinar / Não vou correr), não o desânimo
const PEDE_FALTA = /\b(nao|nem) (vou|quero|vai dar|consigo|da|rola) (treinar|correr|ir|malhar)\b/;
const pedeFalta = (i) => PEDE_FALTA.test(i.texto);
// "dormi demais", "perdi a hora": o sono não foi curto (é um treino perdido ou atrasado)
const DORMI_DEMAIS = /\b(dormi demais|dormi muito|perdi a hora|perdi hora|passei da hora|nao ouvi o despertador)\b/;
const dormiDemais = (i) => DORMI_DEMAIS.test(i.texto);

// ---------- assuntos ----------
// (sem plano de treino, o chat do Treinador só fala do que falta: o plano, as dores e a saúde)
const temPlano = (ctx) => { try { return !!P.planoAtivo(ctx.st); } catch { return false; } };
export const INTENCOES = [
  { id: 'desanimo', coach: 'treinador', titulo: 'Estou sem vontade de treinar', resumo: 'a falta de vontade de treinar', palavras: DESANIMO, anula: pedeFalta, disponivel: temPlano, inicio: (ctx) => passoDesanimo(ctx, 'treinador') },
  { id: 'sem-resultado', coach: 'treinador', titulo: 'Não vejo resultado', resumo: 'não ver resultado no treino', palavras: SEM_RESULTADO, disponivel: temPlano, inicio: passoSemResultado },
  { id: 'dormi-mal', coach: 'treinador', titulo: 'Dormi mal. Treino hoje?', resumo: 'treinar depois de dormir mal', palavras: DORMI, bonus: noiteCurta, anula: dormiDemais, disponivel: temPlano, inicio: (ctx) => passoDormiMal(ctx, 'treinador') },
  { id: 'agua-treino', coach: 'treinador', titulo: 'Água no treino', resumo: 'beber água no treino', palavras: AGUA, disponivel: temPlano, inicio: (ctx) => passoAgua(ctx, 'treinador') },
  { id: 'desanimo-corrida', coach: 'corrida', titulo: 'Estou sem vontade de correr', resumo: 'a falta de vontade de correr', palavras: [...DESANIMO, 'sem vontade correr', 'preguica correr'], anula: pedeFalta, disponivel: temPlanoCorrida, inicio: (ctx) => passoDesanimo(ctx, 'corrida') },
  { id: 'dormi-mal-corrida', coach: 'corrida', titulo: 'Dormi mal. Corro hoje?', resumo: 'correr depois de dormir mal', palavras: DORMI, bonus: noiteCurta, anula: dormiDemais, disponivel: temPlanoCorrida, inicio: (ctx) => passoDormiMal(ctx, 'corrida') },
  { id: 'agua-corrida', coach: 'corrida', titulo: 'Água na corrida', resumo: 'beber água na corrida', palavras: AGUA_CORRIDA, disponivel: temPlanoCorrida, inicio: (ctx) => passoAgua(ctx, 'corrida') },
  { id: 'nutri-sem-resultado', coach: 'nutri', titulo: 'Não estou emagrecendo', resumo: 'o peso que não muda', palavras: NAO_EMAGRECO, inicio: passoNaoEmagreco },
  { id: 'nutri-agua-treino', coach: 'nutri', titulo: 'Água no treino', resumo: 'beber água no treino', palavras: AGUA, inicio: (ctx) => passoAgua(ctx, 'nutri') },
];

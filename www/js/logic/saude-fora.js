// Problemas de saúde que NÃO vêm do treino (febre, diarreia, pancada, corte, dor de cabeça...) e o que o treinador faz com
// eles: treino normal, treino poupando uma região, treino só leve, sem treino ou "procure atendimento". Vale para a
// musculação e para a corrida. Puro: sem DOM e sem importar o estado. Registro em state.saudeFora.
//
// Como se liga ao resto do app (estende o sistema de dores, sem um paralelo que conflite):
//  • região bloqueada / com cuidado / em volta → doresForaDoTreino() vira "dores" para o Treinador: logic/trainer.js
//    (doresDoTreino) as soma às dores contadas, e alertaDoExercicio, gerarPlano, ajustesPorDor, a carga sugerida e o aviso
//    por exercício do treino em andamento passam a poupar a região, com textos próprios ("Pancada no joelho: ...").
//  • corrida → doresForaDaCorrida() entra nas dores do plano (logic/corrida.js, opcoesDoEstado), já com o efeito pronto
//    (sem corrida, corridas pela metade ou só leves).
//  • musculação sem treino ou só leve → efeitoDeHoje() (Início, começo do treino e treino em andamento).
//
// FONTES (todas lidas em texto completo; chaves de REFS em data/knowledge.js ou de REFS_CORRIDA em data/corrida.js):
//  Febre e doença no corpo todo
//   • jaworski2019 (PMC7126929): febre, falta de ar e desidratação contraindicam treinar; voltar só "afebrile for at least
//     24 hours off any antipyretics"; "for every day missed of training ... 2 to 3 days of graded return" (regra prática);
//     a regra do pescoço é "long been used as a guideline". → sem treino com febre; volta só com 24 h sem febre e sem
//     remédio; depois, 3 dias de treino leve para cada dia parado (o lado cauteloso da regra prática), até 14.
//   • dick2014 (PMC4000470): repouso com febre de 38 °C ou mais; "training should be resumed gradually" depois que a febre
//     e a desidratação passam; na gastroenterite, voltar quando sintomas e desidratação passarem.
//   • schwellnus2022 (IOC, versão aceita do autor): leve = só nariz e garganta, sem sintomas no corpo; não treinar com febre,
//     calafrio, cansaço excessivo, dor muscular geral, falta de ar, dor no peito, palpitação, tosse forte, dor de cabeça
//     forte; teste de volta de 10 a 20 min a 60–70% do normal; a regra do pescoço é "expert opinion". → resfriado leve:
//     treino leve, apresentado como orientação prática.
//   • ruuskanen2024 (PMC11282332): a regra do pescoço "is nonscientific but may be partly useful"; dor no peito, desmaio,
//     falta de ar e palpitação são contraindicação absoluta. • gluckman2022 (ACC, PMC8926109): COVID com sintomas → treino
//     só depois que eles passam, com aumento gradual; miocardite → 3 a 6 meses sem exercício. • esc2020 (ESC 2020, Pelliccia): idem
//     na miocardite; quem libera é o cardiologista. • elliott2020: volta gradual depois da COVID, recuando se voltar sintoma.
//   • nhs_febre, nhs_gripe: febre é 38 °C ou mais; gripe que não melhora em 7 dias → atendimento. ms_meningite: febre,
//     dor de cabeça forte, nuca rígida, manchas → atendimento imediato. ms_dengue: febre alta de repente com dor no corpo,
//     atrás dos olhos ou nas juntas → serviço de saúde; os sinais de alarme aparecem quando a febre cai.
//  Diarreia e vômito
//   • ms_dda: água e soro; voltar ao serviço com piora, vômitos repetidos, muita sede, sangue nas fezes, pouca urina, ou sem
//     melhora em 2 dias. • nhs_diarreia: vômito com sangue, dor de barriga súbita e forte → emergência.
//  Pancada, batida, torção
//   • dubois2020 (PEACE & LOVE): "Unload or restrict movement for 1–3 days"; a dor guia o fim da proteção e cada aumento de
//     carga. → região fora do treino por até 3 dias (dor moderada) ou enquanto doer ao mexer / estiver forte; depois, carga
//     gradual pela dor. • mirto2025 (PMC12638512): treinar o resto do corpo (e o lado bom) não atrapalha e pode ajudar.
//   • nhs_entorse: estalo, região torta, dormência, pele azulada ou fria → emergência; inchaço ou roxo grande, não apoiar o
//     peso → atendimento no dia. • bachmann2003 (Ottawa tornozelo, PMC149439) e mohamed2020 (Ottawa joelho, PMC7381883):
//     não dar 4 passos, dor ao apertar o osso, joelho que não dobra até 90° → avaliação e raio-X.
//  Corte e furada
//   • ms_tetano e ms_dtp: lavar com água e sabão; reforço a cada 10 anos, ou 5 em ferimento grave. ms_guia_tetano (Guia de
//     Vigilância, quadro 4): furada, corte sujo, mordida e objeto enterrado são de alto risco. • nhs_cortes: sangramento
//     que não para, corte fundo ou grande, algo enterrado, perda de sensibilidade → emergência; inchado, vermelho, pus,
//     febre, mordida, mais de 5 cm → atendimento. • cdc_ferida: cobrir até sarar; sem piscina, hidromassagem nem
//     superfície compartilhada sem barreira. Não há fonte sobre "atrito que abre o ferimento": tirar a região do treino até
//     fechar é cautela do aplicativo (fica dito na tela).
//  Pancada na cabeça
//   • patricios2023 (Amsterdam 2022): sintomas podem aparecer em minutos ou horas; repouso relativo nas primeiras 24–48 h;
//     volta em etapas de 24 h (aeróbico leve, moderado, musculação leve); parar se piorar mais que um pouco.
//   • crt6 (CRT6): sinais vermelhos → ambulância (dor no pescoço, visão dupla, fraqueza ou formigamento, dor de cabeça
//     forte ou piorando, convulsão, perda de consciência, vômito, agitação). • nhs_cabeca: adulto por perto nas 24 h;
//     sintomas por mais de 2 semanas → consulta. Pancada sem nenhum sintoma: não há protocolo; o app deixa só treino leve
//     por 2 dias (cautela, porque os sintomas podem aparecer depois).
//  Dor de cabeça
//   • do2019 (SNNOOP10, PMC6340385) e nhs_cefaleia: súbita e muito forte, com febre e nuca rígida, depois de pancada,
//     com fraqueza, fala ou visão alterada, convulsão → emergência; dor que vem com tosse, espirro ou exercício → avaliação
//     no mesmo dia. • ms_avc: dor de cabeça súbita e intensa, fraqueza de um lado, fala alterada → SAMU 192.
//   • ichd3: cefaleia do exercício, na primeira vez, exige descartar hemorragia e dissecção; na enxaqueca, a atividade do
//     dia a dia piora a dor (crise → sem treino); a tensional não piora com atividade leve. • rio2025 e nhs_tensional:
//     exercício pode ajudar na cefaleia tensional. → dor leve ou moderada que não piora ao se mexer: treino leve.
//  Cólica e dor de dente
//   • armour2019 (Cochrane, PMC6753056) e nhs_colica: exercício regular reduz a cólica; exercício leve pode aliviar; dor
//     forte, pior que o normal e que não melhora com remédio → atendimento. nhs_pelvica: desmaio, tontura, sangramento
//     intenso → emergência. • nhs_dente: inchaço perto do olho ou no pescoço, dificuldade de respirar ou engolir →
//     emergência; febre, rosto inchado, mais de 2 dias → dentista. Nenhuma fonte liga a dor de dente ao treino: o app
//     só deixa o treino leve com dor forte (cautela).
import { LOCAIS_DOR } from './dor.js';

// Tipos, na ordem da tela. `regiao`: pede o local do corpo (LOCAIS_DOR).
export const TIPOS_SAUDE = {
  febre: { nome: 'Febre, gripe forte ou dor no corpo', sub: 'Também COVID com sintomas', curto: 'febre' },
  resfriado: { nome: 'Resfriado leve', sub: 'Só nariz escorrendo, espirro ou garganta', curto: 'resfriado' },
  estomago: { nome: 'Diarreia ou vômito', sub: '', curto: 'diarreia ou vômito' },
  pancada: { nome: 'Pancada, batida, queda ou torção', sub: 'Em alguma parte do corpo', curto: 'pancada', regiao: true },
  corte: { nome: 'Corte ou furada', sub: 'Prego, vidro, faca...', curto: 'corte', regiao: true },
  cabeca: { nome: 'Pancada na cabeça', sub: '', curto: 'pancada na cabeça' },
  'dor-cabeca': { nome: 'Dor de cabeça', sub: '', curto: 'dor de cabeça' },
  colica: { nome: 'Cólica menstrual', sub: '', curto: 'cólica' },
  dente: { nome: 'Dor de dente', sub: '', curto: 'dor de dente' },
};
export const GRAUS_SAUDE = { leve: ['Leve', 'Dá para fazer tudo'], moderada: ['Moderada', 'Atrapalha um pouco'], forte: ['Forte', 'Atrapalha muito'] };
export const MAX_SAUDE = 200;
// a região com artigo, para as frases ("Treino sem usar o joelho")
const DO_LOCAL = {
  pescoco: 'o pescoço', ombro: 'o ombro', cotovelo: 'o cotovelo', punho: 'o punho e a mão', 'coluna-alta': 'a parte de cima das costas',
  lombar: 'a lombar', quadril: 'o quadril', virilha: 'a virilha', 'coxa-frente': 'a frente da coxa', 'coxa-tras': 'a parte de trás da coxa',
  joelho: 'o joelho', canela: 'a canela', panturrilha: 'a panturrilha', aquiles: 'o tendão de Aquiles', tornozelo: 'o tornozelo', pe: 'o pé',
  peito: 'o peito', abdomen: 'o abdômen', braco: 'o braço', gluteo: 'o glúteo',
};
export const doLocal = (onde) => DO_LOCAL[onde] || '';
// regiões que a corrida carrega (as mesmas de LOCAIS_CORRIDA em logic/corrida.js)
const PERNAS = new Set(['lombar', 'quadril', 'virilha', 'coxa-frente', 'coxa-tras', 'joelho', 'canela', 'panturrilha', 'aquiles', 'tornozelo', 'pe', 'gluteo']);

// Perguntas de cada tipo, na ordem. 'onde' (local), 'urgente' (sinais de emergência), 'vira' (muda o tipo), 'atendimento'
// (sinais que pedem atendimento no dia), 'detalhe' (pergunta própria do tipo), 'grau', 'piora'.
export const PASSOS = {
  febre: ['urgente', 'atendimento'],
  resfriado: ['vira', 'grau'],
  estomago: ['urgente', 'atendimento'],
  pancada: ['onde', 'urgente', 'atendimento', 'grau', 'piora'],
  corte: ['onde', 'urgente', 'atendimento', 'grau', 'piora'],
  cabeca: ['urgente', 'detalhe'],
  'dor-cabeca': ['urgente', 'detalhe', 'grau', 'piora'],
  colica: ['urgente', 'atendimento', 'grau'],
  dente: ['urgente', 'atendimento', 'grau'],
};
// Os sinais, em linguagem simples. `refs`: de onde vem cada lista.
export const SINAIS = {
  febre: {
    urgente: ['Nuca dura (não consegue encostar o queixo no peito)', 'Manchas na pele que não somem ao apertar um copo', 'Confusão, muito sono ou convulsão', 'Falta de ar forte ou dor no peito'],
    atendimento: ['Febre alta de repente, com dor atrás dos olhos ou nas juntas (pode ser dengue)', 'Palpitação, tontura ou desmaio', 'Febre que não melhora ou está piorando'],
    refs: ['ms_meningite', 'nhs_febre', 'nhs_gripe', 'ms_dengue', 'gluckman2022', 'ruuskanen2024'],
  },
  resfriado: {
    vira: ['Febre (38 °C ou mais) ou calafrios', 'Dor no corpo ou cansaço fora do normal', 'Falta de ar, dor no peito ou palpitação'],
    refs: ['schwellnus2022', 'jaworski2019'],
  },
  estomago: {
    urgente: ['Vômito com sangue ou cor de borra de café', 'Dor de barriga de repente e muito forte', 'Confusão ou muita sonolência'],
    atendimento: ['Sangue nas fezes', 'Vômitos repetidos ou não consegue beber líquidos', 'Muita sede ou urina pouca e escura'],
    refs: ['ms_dda', 'nhs_diarreia'],
  },
  pancada: {
    urgente: ['Ouviu um estalo na hora', 'A região ficou torta ou com o osso aparecendo', 'Dormência ou formigamento', 'Pele azulada, acinzentada ou fria'],
    atendimento: ['Não consegue apoiar o peso ou dar 4 passos', 'Inchaço ou roxo grande, ou aumentando', 'Dói muito ao apertar o osso', 'Joelho que não dobra até a metade (90°)'],
    refs: ['nhs_entorse', 'bachmann2003', 'mohamed2020'],
  },
  corte: {
    urgente: ['Sangramento que não para', 'Corte fundo ou grande', 'Algo enterrado no corte (não tire sozinho)', 'Perdeu a sensibilidade perto do corte'],
    atendimento: ['Furada (prego) ou corte sujo e a vacina antitétano foi há mais de 5 anos, ou não sabe', 'Mordida de pessoa ou de animal', 'Corte maior que 5 cm', 'Inchado, vermelho, mais dolorido, com pus ou febre'],
    refs: ['nhs_cortes', 'ms_tetano', 'ms_dtp', 'ms_guia_tetano'],
  },
  cabeca: {
    urgente: ['Desmaiou ou apagou, mesmo por pouco tempo', 'Dor de cabeça forte ou piorando', 'Vômito, convulsão ou visão dupla', 'Fraqueza ou formigamento nos braços ou nas pernas', 'Dor no pescoço, confusão ou agitação'],
    detalhe: { pergunta: 'Depois da pancada, sente algum destes?', itens: ['Dor ou pressão na cabeça', 'Tontura, enjoo ou visão embaçada', 'Incômodo com luz ou barulho', 'Sono, cansaço ou dificuldade de se concentrar', '“Não me sinto bem”'], sim: 'sintomas', nao: 'sem-sintomas' },
    refs: ['crt6', 'patricios2023', 'nhs_cabeca'],
  },
  'dor-cabeca': {
    urgente: ['Começou de repente e muito forte (a pior da vida)', 'Febre com nuca dura ou manchas na pele', 'Depois de uma pancada na cabeça', 'Fraqueza ou formigamento de um lado, fala ou visão alterada', 'Confusão ou convulsão'],
    detalhe: { pergunta: 'Ela começou durante ou logo depois de um esforço forte?', itens: [], sim: 'esforco', nao: '' },
    refs: ['do2019', 'nhs_cefaleia', 'ms_avc', 'ichd3'],
  },
  colica: {
    urgente: ['Desmaio, tontura forte ou sangramento muito intenso'],
    atendimento: ['Dor forte, pior que o normal, que não melhora com remédio', 'Febre', 'Pode estar grávida'],
    refs: ['nhs_colica', 'nhs_pelvica'],
  },
  dente: {
    urgente: ['Inchaço perto do olho ou no pescoço', 'Dificuldade de respirar, engolir ou falar'],
    atendimento: ['Febre', 'Bochecha ou maxilar inchados', 'Dor há mais de 2 dias ou que não passa com remédio'],
    refs: ['nhs_dente'],
  },
};

const tem = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const dia = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const t = new Date(v + 'T12:00:00Z');
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v ? v : '';
};
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const somaDias = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const DETALHES = new Set(['', 'sintomas', 'sem-sintomas', 'esforco']);

// Registro validado ou null. Formato:
// { id, data, tipo, onde ('' sem região), grau ('' | leve | moderada | forte), piora (bool), sinais ('' | 'atendimento' |
//   'urgente'), detalhe ('' | 'sintomas' | 'sem-sintomas' | 'esforco'), avaliado ('' | data), visto ('' | data do último
//   "Ainda não"), fim ('' | data do "Melhorou") }
export function limparProblema(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = dia(raw.data);
  const id = typeof raw.id === 'string' && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : '';
  if (!data || !id || !tem(TIPOS_SAUDE, raw.tipo)) return null;
  const regiao = !!TIPOS_SAUDE[raw.tipo].regiao;
  if (regiao && !tem(LOCAIS_DOR, raw.onde)) return null;
  const depois = (v) => { const d = dia(v); return d && d >= data ? d : ''; };
  return {
    id, data, tipo: raw.tipo, onde: regiao ? raw.onde : '',
    grau: tem(GRAUS_SAUDE, raw.grau) ? raw.grau : '', piora: raw.piora === true,
    sinais: raw.sinais === 'urgente' || raw.sinais === 'atendimento' ? raw.sinais : '',
    detalhe: typeof raw.detalhe === 'string' && DETALHES.has(raw.detalhe) ? raw.detalhe : '',
    avaliado: depois(raw.avaliado), visto: depois(raw.visto), fim: depois(raw.fim),
  };
}
export function limparSaudeFora(raw) {
  const out = [];
  const vistos = new Set();
  if (!Array.isArray(raw)) return out;
  for (const x of raw.slice(-MAX_SAUDE * 2)) {
    const p = limparProblema(x);
    if (!p || vistos.has(p.id)) continue;
    vistos.add(p.id); out.push(p);
  }
  out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  // o mesmo problema (tipo e local) contado de novo enquanto ainda vale: fica só o mais recente. Versões antigas
  // guardavam uma cópia a cada vez que a pessoa contava, e o Início mostrava todas, repetidas.
  const unico = out.filter((p, i) => !out.slice(i + 1).some((q) => q.tipo === p.tipo && q.onde === p.onde && q.data === p.data));
  return unico.length > MAX_SAUDE ? unico.slice(-MAX_SAUDE) : unico;
}
// mesmo tipo e mesmo local, e o anterior ainda muda o treino no dia do relato novo (em curso ou na volta gradual)
const mesmoProblema = (antes, depois) => antes.tipo === depois.tipo && antes.onde === depois.onde && antes.data <= depois.data && !!efeitoDoProblema(antes, depois.data);
// Anota um problema contado (pelo formulário ou pelo chat) sem duplicar: o mesmo problema ainda em curso é substituído
// pelo relato novo, que traz o grau e a data de agora. Muda `lista` (um array do estado) no lugar.
export function anotarProblema(lista, p) {
  const novo = limparProblema(p);
  if (!Array.isArray(lista) || !novo) return false;
  for (let i = lista.length - 1; i >= 0; i--) { const q = limparProblema(lista[i]); if (q && mesmoProblema(q, novo)) lista.splice(i, 1); }
  lista.push(novo);
  if (lista.length > MAX_SAUDE) lista.splice(0, lista.length - MAX_SAUDE);
  return true;
}

// Quantos dias o registro vale sozinho (dor de cabeça e cólica são do dia; não seguram o treino por semanas sem resposta)
const DURA = { 'dor-cabeca': 1, colica: 2, dente: 3 };
// a partir de quantos dias o cartão pergunta "Melhorou?"
const PERGUNTA = { febre: 1, resfriado: 1, estomago: 1, pancada: 2, corte: 2, cabeca: 1, dente: 2 };
const VOLTA_REGIAO = 7; // dias de carga gradual na região depois do "Melhorou" (dubois2020: a dor guia a volta)
const VOLTA_CABECA = 3; // etapas de 24 h: aeróbico leve, moderado e musculação leve (patricios2023)

const REFS_TIPO = {
  febre: ['jaworski2019', 'dick2014', 'schwellnus2022', 'gluckman2022', 'esc2020', 'elliott2020'],
  resfriado: ['schwellnus2022', 'jaworski2019', 'ruuskanen2024'],
  estomago: ['dick2014', 'ms_dda', 'jaworski2019'],
  pancada: ['dubois2020', 'mirto2025', 'nhs_entorse'],
  corte: ['ms_tetano', 'nhs_cortes', 'cdc_ferida'],
  cabeca: ['patricios2023', 'crt6', 'nhs_cabeca'],
  'dor-cabeca': ['do2019', 'ichd3', 'nhs_cefaleia', 'rio2025'],
  colica: ['armour2019', 'nhs_colica'],
  dente: ['nhs_dente'],
};
// Por quê? de cada tipo (frases curtas)
const PORQUE = {
  febre: ['Com febre, o corpo controla pior a temperatura e perde mais líquido. Treinar com febre, falta de ar ou desidratação não é indicado.', 'A volta começa depois de 24 horas sem febre e sem remédio para febre, aos poucos: 3 dias de treino leve para cada dia parado (regra prática, no lado cauteloso), até 14 dias.', 'Primeiro treino: 10 a 20 minutos em 60 a 70% do normal. Só aumente se nada piorar durante, logo depois e no dia seguinte.', 'COVID com sintomas: mesma regra, só depois que os sintomas passam. Miocardite diagnosticada: sem treino até o cardiologista liberar (costuma levar de 3 a 6 meses).'],
  resfriado: ['Só nariz e garganta, sem febre: um treino leve pode ser tentado. É a chamada “regra do pescoço”, uma orientação prática de especialistas, não um resultado de estudo.', 'Faça 10 a 20 minutos em 60 a 70% do normal e veja como se sente. Se piorar, pare.', 'Com febre, dor no corpo, falta de ar ou dor no peito, não treine.'],
  estomago: ['Diarreia e vômito tiram água e sais do corpo. Treinar desidratado não é indicado.', 'Beba água e soro de reidratação depois de cada evacuação e mantenha a alimentação.', 'Volte só quando os sintomas e a sede passarem, aos poucos.'],
  pancada: ['Nos primeiros 1 a 3 dias depois de uma lesão, a orientação é poupar a região e evitar o que aumenta a dor. Depois, a carga volta aos poucos, com a dor como guia.', 'O resto do corpo pode treinar normalmente.', 'Dor forte ou que piora ao mexer: a região fica fora do treino até melhorar.'],
  corte: ['Lave o ferimento com água e sabão e mantenha coberto, limpo e seco.', 'Enquanto não fechar, a região fica fora do treino (cautela do aplicativo: apoio e atrito podem abrir o corte). Sem piscina, mar, hidromassagem ou sauna.', 'Vacina antitétano: reforço a cada 10 anos; em ferimento de risco (furada, corte sujo, mordida), se a última dose foi há mais de 5 anos.'],
  cabeca: ['Os sintomas de uma concussão podem aparecer minutos ou horas depois da pancada.', 'Com sintomas: sem treino até ser avaliado. Nas primeiras 24 a 48 horas, só atividades do dia a dia e caminhada leve.', 'A volta é em etapas de pelo menos 24 horas: aeróbico leve, depois moderado, depois musculação leve. Se os sintomas piorarem mais que um pouco, pare e tente no dia seguinte.'],
  'dor-cabeca': ['A dor de cabeça comum (tensional) não piora com atividade leve, e o exercício regular pode até ajudar.', 'Na crise de enxaqueca, mexer-se costuma piorar a dor: descanse num lugar escuro.', 'Dor que começa com o esforço, na primeira vez, precisa de avaliação médica antes de voltar a treinar pesado.'],
  colica: ['Exercício regular ao longo do mês diminui a cólica, e um exercício leve (caminhada, bicicleta, yoga) pode aliviar.', 'Com dor forte, prefira o treino leve.'],
  dente: ['Dor de dente não tem relação com o treino. Com dor forte, o aplicativo deixa o treino leve, por cautela.', 'Com febre ou rosto inchado, procure um dentista: com febre, não treine.'],
};

// Efeito de UM problema hoje. null = não muda nada (expirou, já passou a volta, data no futuro).
// { fase: 'ativo' | 'volta', nivel: 'urgente' | 'atendimento' | 'sem' | 'leve' | 'regiao' | 'cuidado' | 'normal',
//   musc: 'normal' | 'leve' | 'sem', corrida: 'normal' | 'leve' | 'metade' | 'sem',
//   regiao: null | { onde, modo: 'bloqueia' | 'cuidado' | 'volta' }, titulo, texto, porque: [], refs: [], ate: '' | data,
//   perguntar: bool, aviso: '' }
export function efeitoDoProblema(raw, hoje) {
  const p = limparProblema(raw);
  if (!p || !dia(hoje) || p.data > hoje) return null;
  const dias = diasEntre(p.data, hoje);
  const t = TIPOS_SAUDE[p.tipo];
  const refs = [...REFS_TIPO[p.tipo]];
  const porque = [...PORQUE[p.tipo]];
  const ef = (o) => ({ fase: 'ativo', regiao: null, porque, refs, ate: '', perguntar: false, aviso: '', ...o });
  const regiaoDe = (modo) => (p.onde ? { onde: p.onde, modo } : null);
  const corridaDa = (modo) => (!p.onde || !PERNAS.has(p.onde) ? 'normal' : modo === 'bloqueia' ? 'sem' : 'metade');
  const comAlarme = p.sinais && !p.avaliado;
  // à espera de avaliação: não expira sozinho
  const pendente = comAlarme || (!p.avaliado && ((p.tipo === 'dor-cabeca' && p.detalhe === 'esforco') || (p.tipo === 'cabeca' && p.detalhe === 'sintomas')));

  // ----- depois do "Melhorou": volta gradual -----
  if (p.fim) {
    if (p.fim > hoje) return null;
    const desde = diasEntre(p.fim, hoje);
    if (p.tipo === 'febre' || p.tipo === 'estomago') {
      const parado = Math.max(1, diasEntre(p.data, p.fim));
      const n = Math.min(14, Math.max(2, 3 * parado));
      if (desde >= n) return null;
      const ate = somaDias(p.fim, n - 1);
      return ef({ fase: 'volta', nivel: 'leve', musc: 'leve', corrida: 'leve', ate, titulo: 'Volta aos poucos', texto: 'Treinos leves por enquanto: comece com 10 a 20 minutos em 60 a 70% do normal. Se algo piorar, pare.' });
    }
    if (p.tipo === 'cabeca' && p.detalhe === 'sintomas') {
      if (desde >= VOLTA_CABECA) return null;
      return ef({ fase: 'volta', nivel: 'leve', musc: 'leve', corrida: 'leve', ate: somaDias(p.fim, VOLTA_CABECA - 1), titulo: 'Volta em etapas', texto: 'Um passo por dia: aeróbico leve, depois moderado, depois musculação leve. Se os sintomas voltarem, pare e tente no dia seguinte.' });
    }
    if (t.regiao) {
      const bloqueou = p.sinais || p.grau !== 'leve' || p.piora;
      if (!bloqueou || desde >= VOLTA_REGIAO) return null;
      return ef({ fase: 'volta', nivel: 'cuidado', musc: 'normal', corrida: corridaDa('volta'), regiao: regiaoDe('volta'), ate: somaDias(p.fim, VOLTA_REGIAO - 1), titulo: `Volta aos poucos: ${doLocal(p.onde)}`, texto: 'Nesta semana, menos carga e só a amplitude sem dor nessa região. Se a dor voltar, conte de novo.' });
    }
    return null;
  }

  // ----- ainda ativo -----
  const dura = p.tipo === 'cabeca' && p.detalhe === 'sem-sintomas' ? 2 : DURA[p.tipo] || 0;
  if (dura && dias >= dura && !pendente) return null; // registro do dia que já passou
  const perguntar = !!PERGUNTA[p.tipo] && dias >= PERGUNTA[p.tipo] && (!p.visto || diasEntre(p.visto, hoje) >= 2);
  const base = { perguntar };
  if (comAlarme && p.sinais === 'urgente') {
    return ef({ ...base, nivel: 'urgente', musc: 'sem', corrida: 'sem', regiao: regiaoDe('bloqueia'), titulo: 'Procure atendimento agora', texto: 'Ligue 192 (SAMU) ou vá a um pronto-socorro. Sem treino até ser avaliado.', refs: [...SINAIS[p.tipo].refs, ...refs] });
  }
  if (comAlarme) {
    const quem = p.tipo === 'dente' ? 'um dentista' : 'atendimento';
    return ef({ ...base, nivel: 'atendimento', musc: 'sem', corrida: 'sem', regiao: regiaoDe('bloqueia'), titulo: p.tipo === 'dente' ? 'Procure um dentista' : 'Procure atendimento', texto: `Procure ${quem} hoje. Sem treino até ser avaliado.`, refs: [...SINAIS[p.tipo].refs, ...refs] });
  }
  let o;
  switch (p.tipo) {
    case 'febre':
      o = { nivel: 'sem', musc: 'sem', corrida: 'sem', titulo: 'Hoje sem treino', texto: 'Sem musculação e sem corrida até ficar 24 horas sem febre, sem remédio para febre. Descanse e beba líquidos.' };
      if (dias >= 7) o.aviso = 'Já faz 7 dias ou mais: procure atendimento.';
      break;
    case 'resfriado':
      o = p.grau === 'forte'
        ? { nivel: 'sem', musc: 'sem', corrida: 'sem', titulo: 'Hoje sem treino', texto: 'Com o resfriado forte, descanse hoje. Volte com um treino leve quando melhorar.' }
        : { nivel: 'leve', musc: 'leve', corrida: 'leve', titulo: 'Hoje só treino leve', texto: 'Só nariz ou garganta: dá para treinar leve, 10 a 20 minutos em 60 a 70% do normal. Se piorar, pare.' };
      break;
    case 'estomago':
      o = { nivel: 'sem', musc: 'sem', corrida: 'sem', titulo: 'Hoje sem treino', texto: 'Espere a diarreia e o vômito passarem. Beba água e soro de reidratação.' };
      if (dias >= 2) o.aviso = 'Sem melhora em 2 dias: procure atendimento.';
      break;
    case 'pancada':
    case 'corte': {
      // corte: fora do treino até fechar, a não ser o leve que não incomoda ao mexer; pancada: proteção de 1 a 3 dias
      const bloqueia = p.piora || p.grau === 'forte' || !p.grau || (p.grau === 'moderada' && (p.tipo === 'corte' || dias < 3));
      const modo = bloqueia ? 'bloqueia' : 'cuidado';
      o = bloqueia
        ? { nivel: 'regiao', titulo: `Treino sem usar ${doLocal(p.onde)}`, texto: `Os exercícios que usam ${doLocal(p.onde)} ficam de fora${p.tipo === 'corte' ? ' até o corte fechar' : ' até a dor deixar'}. O resto do corpo treina normalmente.` }
        : { nivel: 'cuidado', titulo: `Cuidado com ${doLocal(p.onde)}`, texto: `Treino normal. Nos exercícios que usam ${doLocal(p.onde)}, menos carga e só o que não dói.` };
      o = { ...o, musc: 'normal', corrida: corridaDa(modo), regiao: regiaoDe(modo) };
      if (p.tipo === 'corte') o.texto += ' Sem piscina ou mar até fechar.';
      if (dias >= 14) o.aviso = 'Já faz 2 semanas: vale procurar avaliação.';
      break;
    }
    case 'cabeca':
      if (p.detalhe === 'sintomas' && !p.avaliado) {
        // suspeita de concussão: sem treino até a avaliação (crt6, patricios2023)
        o = { nivel: 'atendimento', musc: 'sem', corrida: 'sem', titulo: 'Procure atendimento', texto: 'Com sintomas depois da pancada, procure avaliação hoje. Sem treino até lá. Não fique sozinho nas primeiras horas e não dirija.' };
        if (dias >= 14) o.aviso = 'Sintomas há 2 semanas ou mais: procure avaliação.';
      } else if (p.detalhe === 'sintomas') {
        // avaliado: as primeiras 24–48 h são de repouso relativo; depois, etapas leves (patricios2023)
        o = dias < 2
          ? { nivel: 'sem', musc: 'sem', corrida: 'sem', titulo: 'Hoje sem treino', texto: 'Nas primeiras 24 a 48 horas, só atividades do dia a dia e caminhada leve.' }
          : { nivel: 'leve', musc: 'leve', corrida: 'leve', titulo: 'Só treino leve', texto: 'Aeróbico leve e musculação leve, sem piorar os sintomas. Se piorarem, pare e tente no dia seguinte.' };
        if (dias >= 14) o.aviso = 'Sintomas há 2 semanas ou mais: procure avaliação.';
      } else {
        o = { nivel: 'leve', musc: 'leve', corrida: 'leve', titulo: 'Hoje e amanhã, só treino leve', texto: 'Os sintomas podem aparecer depois. Se surgir dor de cabeça, tontura ou enjoo, pare e conte de novo.' };
      }
      break;
    case 'dor-cabeca':
      if (p.detalhe === 'esforco' && !p.avaliado) o = { nivel: 'atendimento', musc: 'sem', corrida: 'sem', titulo: 'Procure atendimento', texto: 'Dor de cabeça que começa com o esforço precisa de avaliação hoje. Sem treino até lá.' };
      else if (p.piora || p.grau === 'forte') o = { nivel: 'sem', musc: 'sem', corrida: 'sem', titulo: 'Hoje sem treino', texto: 'Dor forte ou que piora ao se mexer: descanse hoje, de preferência num lugar escuro e calmo.' };
      else o = { nivel: 'leve', musc: 'leve', corrida: 'leve', titulo: 'Hoje só treino leve', texto: 'Se a dor piorar com o esforço, pare.' };
      break;
    case 'colica':
      o = p.grau === 'leve' || !p.grau
        ? { nivel: 'normal', musc: 'normal', corrida: 'normal', titulo: 'Pode treinar', texto: 'Treino normal. Um exercício leve pode até aliviar a cólica.' }
        : { nivel: 'leve', musc: 'leve', corrida: 'leve', titulo: 'Hoje só treino leve', texto: 'Caminhada, bicicleta ou treino leve podem aliviar. Pare se a dor aumentar.' };
      break;
    case 'dente':
      o = p.grau === 'forte'
        ? { nivel: 'leve', musc: 'leve', corrida: 'leve', titulo: 'Hoje só treino leve', texto: 'Com dor forte, treine leve. Se não passar em 2 dias, procure um dentista.' }
        : { nivel: 'normal', musc: 'normal', corrida: 'normal', titulo: 'Pode treinar', texto: 'A dor de dente não muda o treino. Se durar mais de 2 dias, procure um dentista.' };
      break;
    default:
      return null;
  }
  return ef({ ...base, ...o });
}

const ORDEM = { urgente: 6, atendimento: 5, sem: 4, leve: 3, regiao: 2, cuidado: 1, normal: 0 };
const ORDEM_MUSC = { sem: 2, leve: 1, normal: 0 };
const ORDEM_CORRIDA = { sem: 3, metade: 2, leve: 1, normal: 0 };
// Problemas que aparecem hoje (ativos ou em volta), do mais grave para o mais leve: [{ p, ef }]
export function problemasDeHoje(st, hoje) {
  const lista = st && Array.isArray(st.saudeFora) ? st.saudeFora : [];
  const out = [];
  for (const raw of lista) {
    const p = limparProblema(raw);
    const ef = p ? efeitoDoProblema(p, hoje) : null;
    if (ef) out.push({ p, ef });
  }
  return out.sort((a, b) => ORDEM[b.ef.nivel] - ORDEM[a.ef.nivel] || (a.p.data < b.p.data ? 1 : -1));
}
// Resumo do dia: { musc, corrida, regioes: [{ onde, modo, tipo }], itens: [{ p, ef }], principal: { p, ef } | null }
export function efeitoDeHoje(st, hoje) {
  const itens = problemasDeHoje(st, hoje);
  let musc = 'normal', corrida = 'normal';
  const regioes = [];
  for (const { p, ef } of itens) {
    if (ORDEM_MUSC[ef.musc] > ORDEM_MUSC[musc]) musc = ef.musc;
    if (ORDEM_CORRIDA[ef.corrida] > ORDEM_CORRIDA[corrida]) corrida = ef.corrida;
    if (ef.regiao) regioes.push({ ...ef.regiao, tipo: p.tipo });
  }
  return { musc, corrida, regioes, itens, principal: itens[0] || null };
}
// Pode começar um treino de musculação hoje?
export const semTreinoHoje = (st, hoje) => efeitoDeHoje(st, hoje).musc === 'sem';

// Para o Treinador (logic/trainer.js, doresDoTreino): cada região bloqueada, com cuidado ou em volta vira uma "dor" no
// formato de logic/dor.js, marcada com `fora` (o nome do problema) e `foraRefs`. Bloqueia = dor de alerta (a região sai
// do treino); cuidado = dor moderada (menos carga e amplitude); volta = a volta gradual que o Treinador já conhece.
export function doresForaDoTreino(st, hoje) {
  const out = [];
  for (const { p, ef } of problemasDeHoje(st, hoje)) {
    if (!ef.regiao) continue;
    const comum = { id: 'saude-' + p.id, data: p.data, onde: ef.regiao.onde, lado: '', quando: 'durante', nota: '', fim: '', dias: Math.max(0, diasEntre(p.data, hoje)), fora: TIPOS_SAUDE[p.tipo].curto, foraRefs: ef.refs.slice(0, 6) };
    if (ef.regiao.modo === 'bloqueia') out.push({ ...comum, tipo: 'aguda', nivel: 8 });
    else if (ef.regiao.modo === 'cuidado') out.push({ ...comum, tipo: 'articular', nivel: 3 });
    else out.push({ ...comum, tipo: 'aguda', nivel: 8, volta: true });
  }
  return out;
}
// Para o plano de corrida (logic/corrida.js): uma "dor" por problema que muda a corrida, com o efeito pronto em `fora`
// ({ nivel, corte, texto, refs, resumo, detalhe, ajuste, motivo }, no formato de efeitoDaDor).
export function doresForaDaCorrida(st, hoje) {
  const out = [];
  for (const { p, ef } of problemasDeHoje(st, hoje)) {
    if (ef.corrida === 'normal') continue;
    const nome = TIPOS_SAUDE[p.tipo].curto;
    const onde = p.onde ? ` (${LOCAIS_DOR[p.onde].toLowerCase()})` : '';
    const fora = ef.corrida === 'sem'
      ? { nivel: 4, corte: 1, texto: `Sem corrida por causa de ${nome}${onde}: ${ef.texto}`, resumo: `Sem corrida hoje: ${nome}${onde}`, detalhe: ef.nivel === 'regiao' ? 'Se não doer, bicicleta ou natação (sem ferimento aberto) mantêm o condicionamento.' : ef.texto }
      : ef.corrida === 'metade'
        ? { nivel: 2, corte: 0.5, texto: `Corridas leves e pela metade por causa de ${nome}${onde}.`, ajuste: `Treino ajustado por causa de ${nome}: se doer, pare e caminhe.` }
        : { nivel: 1, corte: 0, texto: `Só corridas leves por causa de ${nome}${ef.fase === 'volta' ? ' (volta aos poucos)' : ''}.`, ajuste: 'Treino leve: se algo piorar, pare.' };
    fora.refs = ef.refs.slice(0, 6);
    fora.motivo = `Você contou ${nome}${onde}. O ajuste vale enquanto o problema estiver registrado: toque em “Melhorou” quando passar.`;
    out.push({ id: 'saude-' + p.id, data: p.data, onde: p.onde || '', nivel: 8, tipo: 'aguda', quando: 'durante', dias: Math.max(0, diasEntre(p.data, hoje)), fora });
  }
  return out;
}

// ---------- montar um registro a partir das respostas (telas e chat) ----------
// respostas = { tipo, onde, urgente: bool, vira: bool, atendimento: bool, detalhe: bool, grau, piora: bool }
export function novoProblema(id, hoje, r) {
  const x = r && typeof r === 'object' ? r : {};
  const tipo = x.tipo === 'resfriado' && x.vira === true ? 'febre' : x.tipo;
  const s = tem(SINAIS, tipo) ? SINAIS[tipo] : null;
  const det = s && s.detalhe ? (x.detalhe === true ? s.detalhe.sim : s.detalhe.nao) : '';
  return limparProblema({
    id, data: hoje, tipo, onde: x.onde, grau: x.grau, piora: x.piora === true, detalhe: det,
    sinais: x.urgente === true ? 'urgente' : x.atendimento === true ? 'atendimento' : '',
  });
}
// Próxima pergunta que falta, ou '' quando já dá para decidir. Sinal de emergência encerra as perguntas.
export function proximoPasso(r) {
  const x = r && typeof r === 'object' ? r : {};
  if (!tem(TIPOS_SAUDE, x.tipo)) return 'tipo';
  const tipo = x.tipo === 'resfriado' && x.vira === true ? 'febre' : x.tipo;
  if (x.urgente === true) return '';
  for (const k of PASSOS[tipo]) {
    if (k === 'onde' && !tem(LOCAIS_DOR, x.onde)) return k;
    if (k !== 'onde' && !(k in x)) return k;
    if (k === 'atendimento' && x.atendimento === true) return ''; // vai para o atendimento: o resto não muda a decisão
    if (k === 'detalhe' && tipo === 'dor-cabeca' && x.detalhe === true) return '';
  }
  return '';
}
// Marca o problema como melhorado / avaliado / "ainda não" (devolve false se não achou)
export function marcar(lista, id, acao, hoje) {
  const p = Array.isArray(lista) ? lista.find((x) => x && x.id === id) : null;
  if (!p || !dia(hoje) || hoje < p.data) return false;
  // "Melhorou" vale para o problema, não só para um registro: cópias do mesmo problema ainda em aberto também terminam
  if (acao === 'melhorou') { p.fim = hoje; for (const q of lista) if (q && q !== p && q.tipo === p.tipo && (q.onde || '') === (p.onde || '') && !q.fim && dia(q.data) && q.data <= hoje) q.fim = hoje; }
  else if (acao === 'avaliado') p.avaliado = hoje;
  else if (acao === 'ainda') p.visto = hoje;
  else return false;
  return true;
}

// ---------- sinais de emergência no texto livre (para o chat) ----------
// `texto` já normalizado (minúsculas, sem acento). Devolve null ou { tipo, texto, refs }. Só frases claras: a pancada na
// cabeça com sinal vermelho (CRT6), febre com nuca dura ou manchas (meningite), a pior dor de cabeça da vida / súbita
// (SNNOOP10, AVC), e sinais de AVC.
const TEM = (t, ...ps) => ps.some((p) => t.includes(p));
export function sinaisDeEmergencia(texto) {
  const t = ' ' + String(texto || '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const cabeca = TEM(t, 'cabeca');
  const pancada = TEM(t, 'bati a cabeca', 'bateu a cabeca', 'batida na cabeca', 'pancada na cabeca', 'bati com a cabeca', 'cai e bati', 'trauma na cabeca', 'concussao') || (cabeca && TEM(t, ' bati', ' bateu', 'pancada', 'batida', ' cai ', ' caiu', 'queda'));
  const alarmeCabeca = TEM(t, 'desmai', 'apaguei', 'apagou', 'perdi a consciencia', 'convuls', 'vomit', 'visao dupla', 'vendo dobrado', 'formigamento', 'formigando', 'fraqueza', 'confus', 'pescoco doendo', 'dor no pescoco', 'piorando');
  if (pancada && alarmeCabeca) return { tipo: 'cabeca', texto: 'Pancada na cabeça com esse sinal pede atendimento agora: ligue 192 (SAMU) ou vá a um pronto-socorro. Não fique sozinho e não dirija.', refs: ['crt6', 'nhs_cabeca'] };
  const febre = TEM(t, 'febre');
  if (febre && TEM(t, 'nuca dura', 'nuca rigida', 'rigidez na nuca', 'rigidez de nuca', 'pescoco duro', 'pescoco rigido', 'manchas', 'manchas roxas', 'manchas vermelhas')) return { tipo: 'febre', texto: 'Febre com nuca dura ou manchas na pele pede atendimento imediato: ligue 192 (SAMU) ou vá a um pronto-socorro.', refs: ['ms_meningite', 'nhs_cefaleia'] };
  const dorCabeca = TEM(t, 'dor de cabeca', 'dor na cabeca', 'cefaleia', 'enxaqueca', 'cabeca doendo', 'cabeca explodindo');
  if (dorCabeca && TEM(t, 'pior dor da minha vida', 'pior dor de cabeca', 'pior dor da vida', 'pior dor que ja senti', 'de repente', 'subita', 'derrepente', 'explodindo', 'trovao')) return { tipo: 'dor-cabeca', texto: 'Dor de cabeça que começa de repente e muito forte pede atendimento agora: ligue 192 (SAMU).', refs: ['do2019', 'ms_avc', 'nhs_cefaleia'] };
  if (TEM(t, 'boca torta', 'boca ficou torta', 'boca entortou', 'rosto torto', 'rosto ficou torto', 'fala enrolada', 'falando enrolado', 'enrolando a fala') || (TEM(t, 'dormen', 'formig', 'fraqueza', 'paralis', 'nao consigo mexer') && TEM(t, 'um lado', 'lado do corpo', 'metade do corpo', 'lado do rosto'))) return { tipo: 'avc', texto: 'Esses podem ser sinais de AVC: ligue 192 (SAMU) agora e anote a hora em que começou.', refs: ['ms_avc'] };
  return null;
}

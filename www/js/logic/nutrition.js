// Nutricionista virtual: entrevista + cálculos baseados em diretrizes publicadas (Mifflin-St Jeor 1990,
// ISSN 2017, Morton 2018, Helms 2014, Iraki 2019, AHA/ACC/TOS 2013, OMS, Guia Alimentar 2014 — ver data/knowledge.js).
// Orientação educativa: não é prescrição dietética e não substitui consulta com nutricionista.
import { ALIMENTOS } from '../data/foods.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));

export const PERGUNTAS = [
  {
    k: 'objetivo', tipo: 'um', titulo: 'Qual é o seu objetivo com a alimentação?',
    op: [['emagrecer', 'Emagrecer', 'Perder gordura preservando os músculos'], ['ganhar', 'Ganhar massa muscular', 'Comer para crescer com pouco ganho de gordura'], ['manter', 'Manter o peso e ter mais saúde', 'Comer melhor e ter energia para treinar']],
  },
  { k: 'sexo', tipo: 'um', titulo: 'Qual é o seu sexo biológico?', ajuda: 'Usado apenas na fórmula que estima o gasto de energia.', op: [['f', 'Feminino', ''], ['m', 'Masculino', '']] },
  { k: 'idade', tipo: 'numero', titulo: 'Quantos anos você tem?', min: 10, max: 99, un: 'anos', padrao: 30 },
  { k: 'peso', tipo: 'numero', titulo: 'Qual é o seu peso atual?', min: 30, max: 250, un: 'kg', padrao: 70, passo: 0.5, dec: 1 },
  { k: 'altura', tipo: 'numero', titulo: 'Qual é a sua altura?', ajuda: 'Em centímetros.', min: 120, max: 220, un: 'cm', padrao: 170 },
  {
    k: 'atividade', tipo: 'um', titulo: 'Como é o seu dia a dia, fora os treinos?',
    op: [['sedentario', 'Fico sentado a maior parte do dia', ''], ['leve', 'Fico em pé ou caminho parte do dia', ''], ['moderado', 'Trabalho em movimento na maior parte do dia', ''], ['intenso', 'Faço trabalho braçal pesado', '']],
  },
  { k: 'treinos', tipo: 'um', titulo: 'Quantos dias por semana você treina?', op: [['0', 'Ainda não treino', ''], ['2', '1 a 2 dias', ''], ['3', '3 dias', ''], ['4', '4 a 5 dias', ''], ['6', '6 a 7 dias', '']] },
  {
    k: 'horario', tipo: 'um', titulo: 'Em que horário você costuma treinar?',
    op: [['cedo', 'Bem cedo, logo ao acordar', ''], ['manha', 'De manhã', ''], ['tarde', 'À tarde', ''], ['noite', 'À noite', ''], ['varia', 'Varia / não treino', '']],
  },
  { k: 'refeicoes', tipo: 'um', titulo: 'Quantas refeições você prefere fazer por dia?', op: [['3', '3 refeições', ''], ['4', '4 refeições', ''], ['5', '5 refeições', ''], ['6', '6 refeições', '']] },
  {
    k: 'restricoes', tipo: 'varios', titulo: 'Você tem alguma restrição alimentar?', nenhum: 'nenhuma',
    op: [['nenhuma', 'Nenhuma', ''], ['vegetariano', 'Vegetariano', 'Não como carnes nem peixes'], ['vegano', 'Vegano', 'Nenhum alimento de origem animal'], ['sem_lactose', 'Intolerância à lactose', ''], ['sem_gluten', 'Doença celíaca / sem glúten', '']],
  },
  {
    k: 'condicoes', tipo: 'varios', titulo: 'Alguma destas situações se aplica a você?', ajuda: 'Algumas pedem acompanhamento profissional antes de mudar a alimentação.', nenhum: 'nenhuma',
    op: [['nenhuma', 'Nenhuma', ''], ['diabetes', 'Diabetes', ''], ['hipertensao', 'Pressão alta', ''], ['renal', 'Doença nos rins', ''], ['gestante', 'Gestação ou amamentação', ''], ['transtorno', 'Tenho ou já tive transtorno alimentar', ''], ['outra', 'Outra doença crônica', '']],
  },
];

export const ROTULO = { objetivo: { emagrecer: 'Emagrecer', ganhar: 'Ganhar massa muscular', manter: 'Manter o peso e ter mais saúde' } };

export function respostasCompletas(a) {
  return PERGUNTAS.every((q) => {
    const v = a[q.k];
    if (q.tipo === 'numero') return typeof v === 'number' && v >= q.min && v <= q.max;
    if (q.tipo === 'um') return typeof v === 'string' && q.op.some((o) => o[0] === v);
    return Array.isArray(v) && v.length > 0;
  });
}

const FATOR = [1.2, 1.375, 1.465, 1.55, 1.64, 1.725, 1.9];
const r5 = (n) => Math.round(n / 5) * 5;
const r10 = (n) => Math.round(n / 10) * 10;

// ---------- cálculo ----------
const PISO = { m: 1500, f: 1200 };   // abaixo disso, só com acompanhamento profissional (AHA/ACC/TOS 2013 — ref jensen2013)
const GASTO_MIN = 1000;              // estimativa abaixo disso: fora da faixa em que a fórmula é confiável (ref frankenfield2005)
const numero = (v, min, max, padrao) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);

export function calcular(respostas) {
  const a = respostas && typeof respostas === 'object' ? respostas : {};
  // fora da faixa das perguntas (ou vazio), vale o limite mais próximo (ou o valor padrão da pergunta)
  const peso = numero(a.peso, 30, 250, 70), alt = numero(a.altura, 120, 220, 170), idade = numero(a.idade, 10, 99, 30);
  const lista = (x) => (Array.isArray(x) ? x.filter((y) => typeof y === 'string') : []);
  const cond = lista(a.condicoes).filter((x) => x !== 'nenhuma');
  const rest = lista(a.restricoes).filter((x) => x !== 'nenhuma');
  const sexo = a.sexo === 'm' ? 'm' : 'f';
  const imc = peso / ((alt / 100) ** 2);
  const tmb = 10 * peso + 6.25 * alt - 5 * idade + (sexo === 'm' ? 5 : -161); // Mifflin-St Jeor (ref mifflin1990)
  const iAtiv = { sedentario: 0, leve: 1, moderado: 2, intenso: 3 }[a.atividade] ?? 0;
  const iTreino = { 0: 0, 2: 1, 3: 1, 4: 2, 6: 3 }[a.treinos] ?? 0;
  const fator = FATOR[Math.min(6, iAtiv + iTreino)];
  const gasto = tmb * fator;
  const treina = Number(a.treinos) >= 2;
  const avisos = [];
  const baixoPeso = idade >= 60 ? imc < 22 : imc < 18.5;
  const obeso = imc >= 30;
  // com obesidade, as contas por quilo usam o peso correspondente a IMC 25 (regra prática para não superestimar)
  const pesoRef = obeso ? 25 * ((alt / 100) ** 2) : peso;
  const piso = PISO[sexo];
  const objetivo = ['emagrecer', 'ganhar', 'manter'].includes(a.objetivo) ? a.objetivo : 'manter';

  // situações em que o app NÃO calcula metas e encaminha a um profissional
  let modo = 'completo';
  if (idade < 18) { modo = 'educativo'; avisos.push({ tipo: 'warn', texto: 'Para menores de 18 anos não calculo calorias nem metas de peso. O corpo ainda está em crescimento: a alimentação deve ser acompanhada por nutricionista ou pediatra.' }); }
  if (cond.includes('gestante')) { modo = 'educativo'; avisos.push({ tipo: 'warn', texto: 'Na gestação e na amamentação as necessidades mudam e não se deve fazer dieta para emagrecer. Siga o acompanhamento do pré-natal e de um nutricionista.' }); }
  if (cond.includes('transtorno')) { modo = 'educativo'; avisos.push({ tipo: 'warn', texto: 'Com histórico de transtorno alimentar, contar calorias pode fazer mal. Não mostro números: procure acompanhamento com nutricionista e psicólogo. Se precisar conversar agora, o CVV atende pelo telefone 188.' }); }
  if (cond.includes('renal')) { modo = 'educativo'; avisos.push({ tipo: 'danger', texto: 'Com doença nos rins, a quantidade de proteína, sódio, potássio e líquidos precisa ser definida pelo seu médico e nutricionista. Não siga metas de proteína de aplicativos.' }); }
  // estimativa de gasto muito baixa (pessoas muito leves, baixas ou de idade avançada): a fórmula erra demais para virar meta
  if (modo === 'completo' && gasto < GASTO_MIN) { modo = 'educativo'; avisos.push({ tipo: 'warn', texto: 'Para o seu peso, altura e idade, a fórmula de gasto de energia não é confiável. Não mostro metas de calorias: procure um nutricionista para uma avaliação individual.' }); }
  if (modo === 'completo' && cond.includes('diabetes')) { modo = 'manutencao'; avisos.push({ tipo: 'warn', texto: 'Com diabetes, reduzir calorias ou mudar horários de refeição pode causar hipoglicemia, principalmente com insulina ou remédios que baixam a glicose. Mostro só a estimativa de manutenção; qualquer dieta deve ser combinada com seu médico e nutricionista.' }); }
  if (modo === 'completo' && objetivo === 'emagrecer' && baixoPeso) { modo = 'manutencao'; avisos.push({ tipo: 'warn', texto: 'Seu peso já está abaixo da faixa considerada saudável para a sua altura. Não recomendo reduzir calorias; converse com um nutricionista.' }); }
  // com obesidade, comer acima do gasto não é indicado: dá para ganhar músculo treinando e comendo na manutenção
  // (Slater 2019; AHA/ACC/TOS 2013 — refs slater2019, jensen2013)
  if (modo === 'completo' && objetivo === 'ganhar' && obeso) { modo = 'manutencao'; avisos.push({ tipo: 'warn', texto: 'Com o seu IMC, comer acima do gasto tende a aumentar a gordura. Mostro a meta de manutenção com proteína alta: com treino de força, dá para ganhar músculo assim. Se o seu peso alto é de músculo, ajuste com um nutricionista.' }); }
  if (modo !== 'educativo' && imc >= 40) avisos.push({ tipo: 'info', texto: 'Com IMC de 40 ou mais, o tratamento do peso deve ser acompanhado por médico e nutricionista. Use estes números só como referência inicial.' });
  if (cond.includes('hipertensao')) avisos.push({ tipo: 'info', texto: 'Pressão alta: limite o sal a 5 g por dia (1 colher de chá, contando o sal dos alimentos prontos), evite ultraprocessados e embutidos, e coma frutas, verduras, legumes, feijões e laticínios magros todos os dias (padrão DASH). Não use cafeína como suplemento.' });
  if (cond.includes('outra')) avisos.push({ tipo: 'info', texto: 'Com doença crônica, confirme estas orientações com seu médico ou nutricionista antes de mudar a alimentação.' });
  if (rest.includes('vegano')) avisos.push({ tipo: 'info', texto: 'Alimentação vegana bem planejada é adequada para adultos, mas a vitamina B12 precisa ser suplementada. Combine feijões com cereais e varie as fontes de proteína (soja, tofu, lentilha, grão-de-bico). Atenção também a ferro, cálcio, zinco, iodo e ômega-3.' });
  if (rest.includes('sem_gluten')) avisos.push({ tipo: 'info', texto: 'Doença celíaca: a exclusão de trigo, centeio, cevada (e aveia não certificada) deve ser total. Cuidado com a contaminação cruzada em utensílios, óleo de fritura e alimentos a granel. Confira sempre o rótulo.' });
  if (rest.includes('sem_lactose')) avisos.push({ tipo: 'info', texto: 'Intolerância à lactose: o cardápio de exemplo não usa leite, iogurte nem queijo comuns. Se quiser, inclua as versões sem lactose desses alimentos.' });

  const out = { modo, imc, baixoPeso, tmb: r10(tmb), gasto: r10(gasto), fator, avisos, restricoes: rest, condicoes: cond, peso, treina, objetivo, refeicoes: [3, 4, 5, 6].includes(Number(a.refeicoes)) ? Number(a.refeicoes) : 4, horario: a.horario || 'varia', sexo, idade };
  // Água: 35 mL por quilo (regra prática), entre 1,5 e 4 litros; a referência da EFSA é 2,0 L (mulheres) e 2,5 L (homens) — ref efsa2010
  out.agua = Math.round(Math.min(4000, Math.max(1500, pesoRef * 35)) / 100) / 10;
  // antes do treino: 5 a 10 mL por quilo, 2 a 4 h antes (Thomas et al. 2016 — ref thomas2016)
  out.aguaPre = [Math.max(150, Math.round(pesoRef * 5 / 50) * 50), Math.max(300, Math.round(pesoRef * 10 / 50) * 50)];
  if (modo === 'educativo') return out;

  // meta de energia
  let kcal = gasto;
  const obj = modo === 'manutencao' ? 'manter' : objetivo;
  if (obj === 'emagrecer') {
    kcal = gasto - Math.min(750, gasto * 0.2);                       // déficit ≈ 20%, limitado a 750 kcal (AHA/ACC/TOS 2013 — ref jensen2013)
    if (gasto <= piso) { kcal = gasto; avisos.push({ tipo: 'warn', texto: 'Seu gasto estimado já é baixo. Não sugiro comer menos do que isso sem acompanhamento: para emagrecer com segurança, aumente a atividade física e procure um nutricionista.' }); }
    else if (kcal < piso) { kcal = piso; avisos.push({ tipo: 'warn', texto: `Ajustei a meta para ${piso} kcal, o mínimo que este aplicativo sugere sem acompanhamento profissional. Dietas mais restritas só com nutricionista ou médico.` }); }
    // 0,5–1% do peso por semana (Helms 2014 — ref helms2014), sem passar de 0,5 a 1 kg por semana (ref jensen2013)
    out.ritmo = [Math.min(0.5, Math.round(peso * 0.005 * 10) / 10), Math.min(1, Math.round(peso * 0.01 * 10) / 10)];
  } else if (obj === 'ganhar') {
    kcal = gasto + Math.min(500, gasto * 0.1);                       // superávit ≈ 10% (Iraki 2019; Slater 2019 — refs iraki2019, slater2019)
    out.ritmo = [Math.round(peso * 0.0025 * 10) / 10, Math.round(peso * 0.005 * 10) / 10];   // 0,25–0,5%/semana
  }
  if (obj !== 'emagrecer' && gasto < piso) avisos.push({ tipo: 'info', texto: `Sua estimativa de gasto ficou abaixo de ${piso} kcal. Em pessoas leves ou de mais idade a fórmula erra mais: confirme este número com um nutricionista.` });
  out.objetivoCalc = obj;
  out.kcal = r10(kcal);

  // proteína (g/kg/dia): ISSN 2017 (1,4–2,0), Morton 2018 (1,6), Helms 2014 (mais alta em déficit), PROT-AGE (idosos ≥1,0–1,2)
  // — refs jager2017, morton2018, helms2014, bauer2013
  let gkg = obj === 'emagrecer' ? 1.8 : obj === 'ganhar' ? 1.8 : treina ? 1.6 : 1.0;
  if (idade >= 65) gkg = Math.max(gkg, 1.2);
  if (rest.includes('vegano')) gkg = Math.min(2.0, gkg + 0.2);
  let prot = gkg * pesoRef;
  // faixa aceitável: 10 a 35% das calorias (IOM), sem passar de 2,2 g por quilo de peso (Morton 2018 — ref morton2018)
  prot = Math.min(Math.max(prot, (kcal * 0.1) / 4), 2.2 * peso, (kcal * 0.35) / 4);
  let gord = Math.max((kcal * 0.28) / 9, 0.6 * pesoRef);            // 20–35% das calorias; nunca abaixo de ~0,6 g/kg
  let carb = (kcal - prot * 4 - gord * 9) / 4;
  if (carb < 2 * pesoRef) { gord = Math.max((kcal * 0.22) / 9, 0.5 * pesoRef); carb = (kcal - prot * 4 - gord * 9) / 4; }
  // a gordura não passa de 35% das calorias (OMS — ref oms_dieta); o que sobra vai para o carboidrato
  if (gord * 9 > kcal * 0.35) { gord = (kcal * 0.35) / 9; carb = (kcal - prot * 4 - gord * 9) / 4; }
  out.prot = r5(prot); out.gord = r5(gord);
  // o carboidrato fecha a conta das calorias com os valores já arredondados
  out.carb = Math.max(0, r5((out.kcal - out.prot * 4 - out.gord * 9) / 4));
  out.gkg = Math.round((out.prot / peso) * 10) / 10;
  out.fibra = Math.min(50, Math.max(25, Math.round((kcal / 1000) * 14)));   // 14 g/1000 kcal (IOM); mínimo de 25 g (OMS — ref oms_dieta)
  out.protRefeicao = [Math.round(0.25 * pesoRef), Math.round(0.4 * pesoRef)]; // por refeição (Schoenfeld & Aragon 2018 — ref schoenfeld2018)
  return out;
}

// ---------- cardápio de exemplo ----------
const POOL = {
  cafe_carbo: ['pao-frances', 'tapioca-pronta', 'aveia-em-flocos', 'cuscuz-de-milho-cozido', 'pao-de-forma-integral', 'batata-doce-cozida'],
  cafe_prot: ['ovo-cozido', 'queijo-minas-frescal', 'iogurte-natural', 'queijo-cottage', 'ricota', 'tofu', 'pasta-de-amendoim', 'leite-de-soja'],
  fruta: ['banana-prata', 'mamao-papaia', 'maca-fuji', 'laranja-pera', 'abacaxi', 'melancia', 'manga-palmer', 'morango', 'goiaba-vermelha', 'pera-williams', 'tangerina-ponca', 'uva-italia', 'melao', 'kiwi'],
  carbo: ['arroz-branco-cozido', 'arroz-integral-cozido', 'batata-inglesa-cozida', 'macarrao-cozido', 'mandioca-cozida', 'batata-doce-cozida', 'quinoa-cozida', 'inhame-cozido'],
  legum: ['feijao-carioca-cozido', 'feijao-preto-cozido', 'lentilha-cozida', 'grao-de-bico-cozido'],
  prot: ['peito-de-frango-grelhado', 'patinho-grelhado', 'tilapia-grelhada', 'carne-moida-cozida', 'sobrecoxa-de-frango-assada-sem-pele', 'merluza-assada', 'lombo-suino-assado', 'sardinha-assada', 'coxao-mole-cozido', 'ovo-cozido', 'tofu', 'soja-cozida', 'proteina-de-soja-texturizada'],
  salada: ['alface-crespa', 'tomate', 'rucula', 'pepino', 'cenoura-crua', 'repolho-branco-cru'],
  legume: ['brocolis-cozido', 'abobrinha-cozida', 'cenoura-cozida', 'couve-refogada', 'chuchu-cozido', 'beterraba-cozida', 'couve-flor-cozida', 'vagem-cozida', 'abobora-cabotia-cozida', 'quiabo-cozido', 'berinjela-cozida'],
  lanche_prot: ['iogurte-natural', 'queijo-minas-frescal', 'ovo-cozido', 'queijo-cottage', 'leite-integral', 'tofu', 'leite-de-soja', 'amendoim-torrado-salgado', 'grao-de-bico-cozido'],
  lanche_extra: ['aveia-em-flocos', 'castanha-de-caju', 'pasta-de-amendoim', 'castanha-do-para', 'nozes', 'amendoa', 'chia'],
  ceia: ['iogurte-natural', 'leite-desnatado', 'queijo-cottage', 'ovo-cozido', 'tofu', 'leite-de-soja', 'amendoim-torrado-salgado', 'castanha-de-caju'],
};
// gramas mínimo e máximo por alimento numa refeição, e passo de arredondamento. Nenhum alimento passa de 3 porções caseiras.
const LIMITE = {
  'ovo-cozido': [50, 150, 50], 'queijo-minas-frescal': [30, 90, 30], 'queijo-cottage': [50, 150, 25], ricota: [50, 150, 50], 'iogurte-natural': [170, 340, 170],
  'leite-integral': [200, 400, 100], 'leite-desnatado': [200, 400, 100], 'leite-de-soja': [200, 400, 100], tofu: [80, 300, 10], 'pasta-de-amendoim': [15, 45, 15],
  'pao-frances': [50, 150, 25], 'pao-de-forma-integral': [25, 125, 25], 'tapioca-pronta': [40, 140, 10], 'aveia-em-flocos': [20, 80, 10], 'cuscuz-de-milho-cozido': [80, 300, 20],
  'mandioca-cozida': [50, 300, 10], 'batata-doce-cozida': [70, 330, 10], 'inhame-cozido': [50, 300, 10], 'quinoa-cozida': [50, 250, 10], 'macarrao-cozido': [80, 330, 10],
  'proteina-de-soja-texturizada': [25, 75, 5], 'soja-cozida': [80, 250, 10], 'castanha-do-para': [8, 16, 4], 'castanha-de-caju': [15, 40, 5], nozes: [10, 30, 5], amendoa: [10, 30, 5], chia: [12, 24, 12],
  'amendoim-torrado-salgado': [15, 45, 15], 'grao-de-bico-cozido': [50, 200, 10], 'lentilha-cozida': [50, 200, 10], 'feijao-carioca-cozido': [50, 200, 10], 'feijao-preto-cozido': [50, 200, 10],
  'batata-inglesa-cozida': [70, 350, 10], 'arroz-branco-cozido': [60, 300, 10], 'arroz-integral-cozido': [60, 300, 10],
};
const lim = (id, def) => LIMITE[id] || def;
const MAX_ITENS = { principal: 8, cafe: 7, lanche: 5, ceia: 4 };

// alimentos de soja que só entram quando a pessoa não come carne ou não pode com lactose (para o exemplo ficar com cara de dia a dia)
const SO_VEG = new Set(['tofu', 'soja-cozida', 'proteina-de-soja-texturizada', 'leite-de-soja']);
// etiquetas que o alimento precisa ter para respeitar as restrições (todas são obrigatórias, sem exceção)
function etiquetas(rest) {
  const need = [];
  if (rest.includes('vegano')) need.push('vegano');
  else if (rest.includes('vegetariano')) need.push('vegetariano');
  if (rest.includes('sem_gluten')) need.push('sem_gluten');
  if (rest.includes('sem_lactose')) need.push('sem_lactose');
  return need;
}
const permite = (id, rest) => { const f = FOOD.get(id); const need = etiquetas(rest); return !!f && need.every((t) => f.tags.includes(t)); };
function servem(pool, rest) {
  const comSoja = rest.includes('vegano') || rest.includes('vegetariano') || rest.includes('sem_lactose');
  const semCarne = rest.includes('vegano') || rest.includes('vegetariano');
  // grão-de-bico como lanche: só para quem não come carne (para os demais ele já aparece no prato)
  const ok = POOL[pool].filter((id) => permite(id, rest) && ((pool === 'prot' ? semCarne : comSoja) || !SO_VEG.has(id)) && (semCarne || !(pool === 'lanche_prot' && id === 'grao-de-bico-cozido')));
  return ok.length ? ok : POOL[pool].filter((id) => permite(id, rest));
}
// escolhe o alimento da vez, evitando repetir o que já apareceu em outra refeição do dia
function pick(list, i, usados, reserva = []) {
  if (!list.length) return null;
  const roda = (l) => { const n0 = ((i % l.length) + l.length) % l.length; return l.map((_, k) => l[(n0 + k) % l.length]); };
  if (!usados) return roda(list)[0];
  const marca = (id) => { usados.set(id, (usados.get(id) || 0) + 1); return id; };
  const livre = roda(list).find((id) => !usados.has(id)) || (reserva.length ? roda(reserva).find((id) => !usados.has(id)) : null);
  if (livre) return marca(livre);
  // todos já apareceram: o que apareceu menos vezes
  return marca(roda([...new Set([...list, ...reserva])]).sort((a, b) => usados.get(a) - usados.get(b))[0]);
}
function porcao(id, g) {
  const f = FOOD.get(id);
  return { id, nome: f.nome, g, kcal: (f.kcal * g) / 100, p: (f.p * g) / 100, c: (f.c * g) / 100, gd: (f.g * g) / 100, fibra: (f.fibra * g) / 100, medida: medida(f, g) };
}
// medida caseira aproximada: "200 g (4 unidades)", "150 g (3 colheres de sopa cheias)"
const PLURAL = { unidade: 'unidades', fatia: 'fatias', colher: 'colheres', pegador: 'pegadores', 'xícara': 'xícaras', escumadeira: 'escumadeiras', 'pedaço': 'pedaços', concha: 'conchas', 'filé': 'filés', bife: 'bifes', gomo: 'gomos', copo: 'copos', pote: 'potes', cacho: 'cachos', 'sachê': 'sachês', pires: 'pires', punhado: 'punhados', lata: 'latas', garrafa: 'garrafas', dosador: 'dosadores', barra: 'barras', folha: 'folhas', ramo: 'ramos', 'média': 'médias', 'médio': 'médios', grossa: 'grossas', pequena: 'pequenas', pequeno: 'pequenos', grande: 'grandes', cheia: 'cheias', cheio: 'cheios', rasa: 'rasas' };
const SINGULAR = Object.fromEntries(Object.entries(PLURAL).map(([s, p]) => [p, s]));
function medida(f, g) {
  const m = /^(\d+)\s+([^()]+?)\s*(\(.*\))?$/.exec(f.porcao.desc);
  if (!m) return g === f.porcao.g ? `${g} g (${f.porcao.desc})` : `${g} g`;
  const base = Number(m[1]);
  const q = (base * g) / f.porcao.g;
  const n2 = q >= 3 ? Math.round(q) : Math.round(q * 2) / 2;
  if (n2 < 0.5) return `${g} g`;
  let resto = m[2];
  // concorda com a quantidade: "1 colher de sopa cheia", "3 colheres de sopa cheias" (a palavra depois de "de" não muda)
  const concorda = (tabela) => resto.split(' ').map((w, i, arr) => (w === 'de' || arr[i - 1] === 'de' ? w : tabela[w] || w)).join(' ');
  if (n2 > 1 && base === 1) resto = concorda(PLURAL);
  else if (n2 <= 1 && base > 1) resto = concorda(SINGULAR);
  const par = m[3] && !/^\(\d/.test(m[3]) ? ' ' + m[3] : '';
  return `${g} g (${String(n2).replace('.', ',')} ${resto}${par})`;
}
function ajusta(id, alvoG, def) {
  const [mn, mx, st] = lim(id, def);
  return Math.min(mx, Math.max(mn, Math.round(alvoG / st) * st));
}
const soma = (itens, k) => itens.reduce((s, x) => s + x[k], 0);

// parte das calorias do alimento que vem da proteína
const densidade = (id) => { const f = FOOD.get(id); return (f.p * 4) / f.kcal; };
// só as fontes de proteína mais concentradas da lista (pelo menos duas opções)
function concentradas(lista) {
  const boas = lista.filter((id) => densidade(id) >= 0.3);
  return boas.length >= 2 ? boas : lista.slice().sort((a, b) => densidade(b) - densidade(a)).slice(0, 2);
}
function refeicao(tipo, nome, kcalAlvo, pAlvo, rest, seed, usados, rico) {
  const itens = [];
  const fontes = (pool) => (rico ? concentradas(servem(pool, rest)) : servem(pool, rest));
  const reserva = (pool) => (rico ? servem(pool, rest) : []);
  const add = (id, g) => { if (id && g > 0 && !itens.some((x) => x.id === id)) itens.push(porcao(id, g)); };
  const fruta = pick(servem('fruta', rest), seed * 3 + tipo.length, usados);
  if (tipo === 'principal') {
    const sal = pick(servem('salada', rest), seed, usados);
    add(sal, FOOD.get(sal).porcao.g);
    const lg = pick(servem('legume', rest), seed * 2 + 1, usados);
    add(lg, Math.round(FOOD.get(lg).porcao.g * 1.5 / 10) * 10);
    const fj = pick(servem('legum', rest), seed, usados);
    add(fj, rest.includes('vegano') || rest.includes('vegetariano') ? 150 : 100);
    add('azeite-de-oliva', 8);
    const faltaP = Math.max(8, pAlvo - soma(itens, 'p') - 4);
    const capaz = servem('prot', rest).filter((id) => (FOOD.get(id).p * lim(id, [60, 240, 10])[1]) / 100 >= faltaP * 0.8);
    const pr = pick(capaz.length ? capaz : servem('prot', rest), seed, usados);
    const fp = FOOD.get(pr);
    add(pr, ajusta(pr, (faltaP / fp.p) * 100, [60, 220, 10]));
    const cb = pick(servem('carbo', rest), seed + 1, usados);
    const fc = FOOD.get(cb);
    const faltaK = kcalAlvo - soma(itens, 'kcal');
    if (faltaK > 45) add(cb, ajusta(cb, (faltaK / fc.kcal) * 100, [50, 300, 10]));
  } else if (tipo === 'cafe') {
    add(fruta, FOOD.get(fruta).porcao.g);
    const pr = pick(fontes('cafe_prot'), seed, usados, reserva('cafe_prot'));
    const fp = FOOD.get(pr);
    add(pr, ajusta(pr, ((pAlvo - soma(itens, 'p') - 4) / fp.p) * 100, [30, 200, 10]));
    if (pAlvo - soma(itens, 'p') > 8) {
      const pr2 = pick(fontes('cafe_prot').filter((x) => x !== pr), seed + 1, usados, reserva('cafe_prot').filter((x) => x !== pr));
      if (pr2) add(pr2, ajusta(pr2, ((pAlvo - soma(itens, 'p') - 3) / FOOD.get(pr2).p) * 100, [30, 200, 10]));
    }
    const cb = pick(servem('cafe_carbo', rest), seed, usados);
    const faltaK = kcalAlvo - soma(itens, 'kcal');
    if (faltaK > 45) add(cb, ajusta(cb, (faltaK / FOOD.get(cb).kcal) * 100, [40, 200, 10]));
    if (kcalAlvo - soma(itens, 'kcal') > 90) { const ex = pick(servem('lanche_extra', rest).filter((x) => !itens.some((y) => y.id === x)), seed + 2, usados); if (ex) add(ex, ajusta(ex, ((kcalAlvo - soma(itens, 'kcal')) / FOOD.get(ex).kcal) * 100, [10, 40, 5])); }
  } else if (tipo === 'lanche') {
    add(fruta, FOOD.get(fruta).porcao.g);
    const pr = pick(fontes('lanche_prot'), seed + 1, usados, reserva('lanche_prot'));
    add(pr, ajusta(pr, ((pAlvo - soma(itens, 'p')) / FOOD.get(pr).p) * 100, [50, 300, 10]));
    const faltaK = kcalAlvo - soma(itens, 'kcal');
    if (faltaK > 60) { const ex = pick(servem('lanche_extra', rest).filter((x) => !itens.some((y) => y.id === x)), seed, usados); if (ex) add(ex, ajusta(ex, (faltaK / FOOD.get(ex).kcal) * 100, [10, 50, 5])); }
  } else {
    const pr = pick(fontes('ceia'), seed, usados, reserva('ceia'));
    add(pr, ajusta(pr, (pAlvo / FOOD.get(pr).p) * 100, [50, 300, 10]));
    if (kcalAlvo - soma(itens, 'kcal') > 25) add(fruta, Math.round(FOOD.get(fruta).porcao.g / 2 / 5) * 5);
  }
  return { nome, tipo, itens, kcal: soma(itens, 'kcal'), p: soma(itens, 'p'), c: soma(itens, 'c'), g: soma(itens, 'gd'), fibra: soma(itens, 'fibra') };
}

// Ajuste fino: aproxima o total do dia das metas de proteína e de calorias, sem sair das porções caseiras.
const PROT_SET = new Set(POOL.prot);
const CARB_SET = new Set(POOL.carbo);
const LEGUM_SET = new Set(POOL.legum);
function refaz(ref) { for (const k of ['kcal', 'p', 'c', 'fibra']) ref[k] = soma(ref.itens, k); ref.g = soma(ref.itens, 'gd'); }
function equilibrar(refs, res, usados) {
  const rest = res.restricoes;
  const principais = refs.filter((r) => r.tipo === 'principal');
  if (!principais.length) return;
  const vegano = rest.includes('vegano');
  const veg = vegano || rest.includes('vegetariano');
  const noDia = (id) => refs.reduce((n, r) => n + (r.itens.some((x) => x.id === id) ? 1 : 0), 0);
  const cheia = (r) => r.itens.length >= MAX_ITENS[r.tipo];
  // um alimento novo só entra se respeitar as restrições, não estiver na refeição e não aparecer mais de 2 vezes no dia
  const cabe = (r, id) => permite(id, rest) && !r.itens.some((x) => x.id === id) && noDia(id) < 2;
  const escolhe = (r, opcoes) => opcoes.filter((id) => cabe(r, id)).sort((a, b) => noDia(a) - noDia(b))[0];
  const reforcos = vegano ? ['proteina-de-soja-texturizada', 'soja-cozida', 'tofu', 'grao-de-bico-cozido', 'lentilha-cozida']
    : veg ? ['ovo-cozido', 'proteina-de-soja-texturizada', 'queijo-cottage', 'soja-cozida', 'tofu']
      : ['ovo-cozido', 'queijo-cottage', 'queijo-minas-frescal'];
  for (let rodada = 0; rodada < 3; rodada++) {
    const faltaP = res.prot - soma(refs, 'p');
    if (Math.abs(faltaP) > 5) {
      for (const r of principais) {
        const i = r.itens.findIndex((x) => PROT_SET.has(x.id));
        if (i < 0) continue;
        const f = FOOD.get(r.itens[i].id);
        const [mn, mx, st] = lim(f.id, [60, 240, 10]);
        const g = Math.min(mx, Math.max(mn, Math.round((r.itens[i].g + ((faltaP / principais.length) / f.p) * 100) / st) * st));
        r.itens[i] = porcao(f.id, g);
        refaz(r);
      }
      // se ainda faltar proteína com a porção principal no máximo, entra um reforço (ovos, queijo, soja...)
      const ainda = res.prot - soma(refs, 'p');
      if (ainda > 10) {
        for (const r of principais) {
          if (cheia(r)) continue;
          const extra = escolhe(r, reforcos);
          if (!extra) continue;
          const f = FOOD.get(extra);
          r.itens.push(porcao(extra, ajusta(extra, ((ainda / principais.length) / f.p) * 100, [25, 200, 5])));
          refaz(r);
        }
      }
      // proteína sobrando mesmo com a porção principal no mínimo: reduz a leguminosa do prato (até meia concha) e leva
      // as fontes de proteína das outras refeições para a porção mínima
      if (soma(refs, 'p') > res.prot * 1.15) {
        for (const r of principais) {
          const i = r.itens.findIndex((x) => LEGUM_SET.has(x.id));
          if (i < 0 || soma(refs, 'p') <= res.prot * 1.15) continue;
          r.itens[i] = porcao(r.itens[i].id, Math.max(50, r.itens[i].g - 50));
          refaz(r);
        }
        for (const r of refs) {
          if (r.tipo === 'principal') continue;
          for (let i = 0; i < r.itens.length && soma(refs, 'p') > res.prot * 1.15; i++) {
            const f = FOOD.get(r.itens[i].id);
            if ((f.p * 4) / f.kcal < 0.2) continue;
            const mn = lim(f.id, [f.porcao.g, f.porcao.g, 10])[0];
            if (r.itens[i].g > mn) { r.itens[i] = porcao(f.id, mn); refaz(r); }
          }
        }
        // ainda sobrando: os lanches ficam só com a fruta (as calorias voltam depois com castanhas ou aveia)
        for (const r of refs) {
          if (r.tipo !== 'lanche' || soma(refs, 'p') <= res.prot * 1.15) continue;
          const i = r.itens.findIndex((x) => densidade(x.id) >= 0.2);
          if (i < 0 || r.itens.length < 2) continue;
          const troca = r.kcal - r.itens[i].kcal >= 80 ? null : escolhe(r, servem('lanche_extra', rest));
          if (r.kcal - r.itens[i].kcal < 80 && !troca) continue;
          r.itens.splice(i, 1);
          if (troca) r.itens.push(porcao(troca, lim(troca, [15, 30, 5])[0]));
          refaz(r);
        }
      }
    }
    const faltaK = res.kcal - soma(refs, 'kcal');
    if (Math.abs(faltaK) > res.kcal * 0.04) {
      for (const r of principais) {
        const i = r.itens.findIndex((x) => CARB_SET.has(x.id));
        const cada = faltaK / principais.length;
        if (i < 0) {
          const cb = cada > 45 && !cheia(r) ? escolhe(r, servem('carbo', rest)) : null;
          if (cb) { r.itens.push(porcao(cb, ajusta(cb, (cada / FOOD.get(cb).kcal) * 100, [50, 300, 10]))); refaz(r); }
          continue;
        }
        const f = FOOD.get(r.itens[i].id);
        const [mn, mx] = lim(f.id, [50, 300, 10]);
        const g = Math.round((r.itens[i].g + (cada / f.kcal) * 100) / 10) * 10;
        if (g < mn) r.itens.splice(i, 1); else r.itens[i] = porcao(f.id, Math.min(mx, g));
        refaz(r);
      }
    }
  }
  // se o dia ainda passar da meta de calorias, reduz aos poucos os itens de carboidrato e gordura mais calóricos
  const cortar = (teto) => {
    for (let k = 0; k < 24 && soma(refs, 'kcal') > teto; k++) {
      let alvo = null;
      for (const r of refs) {
        for (let i = 0; i < r.itens.length; i++) {
          const f = FOOD.get(r.itens[i].id);
          // só carboidratos e gorduras; quem é fonte de proteína (20% ou mais das calorias) fica
          if (PROT_SET.has(f.id) || (f.papel !== 'carbo' && f.papel !== 'gordura') || (f.p * 4) / f.kcal >= 0.2) continue;
          const g = Math.round((r.itens[i].g * 0.75) / 5) * 5;
          const sai = g < f.porcao.g * 0.5;                   // menos de meia porção caseira não vale a pena: o item sairia
          if (sai && (r.itens.length <= 2 || r.kcal - r.itens[i].kcal < 80)) continue; // não esvazia a refeição
          if (!alvo || r.itens[i].kcal > alvo.r.itens[alvo.i].kcal) alvo = { r, i, g, sai };
        }
      }
      if (!alvo) break;
      if (alvo.sai) alvo.r.itens.splice(alvo.i, 1); else alvo.r.itens[alvo.i] = porcao(alvo.r.itens[alvo.i].id, alvo.g);
      refaz(alvo.r);
    }
  };
  cortar(res.kcal * 1.05);
  // Ainda acima de 8% da meta (acontece com metas baixas de calorias e altas de proteína, em dietas sem carne):
  // as frutas dos lanches vão para meia porção e as fontes de proteína cedem um pouco, sem cair abaixo de 88% da meta.
  if (soma(refs, 'kcal') > res.kcal * 1.08) {
    for (const r of refs) {
      if (r.tipo === 'cafe' || soma(refs, 'kcal') <= res.kcal * 1.08) continue;
      const i = r.itens.findIndex((x) => FOOD.get(x.id).papel === 'fruta');
      if (i < 0) continue;
      const fr = FOOD.get(r.itens[i].id);
      const g = Math.round(fr.porcao.g / 2 / 5) * 5;
      if (g < r.itens[i].g) { r.itens[i] = porcao(fr.id, g); refaz(r); }
    }
    for (let k = 0; k < 40 && soma(refs, 'kcal') > res.kcal * 1.08 && soma(refs, 'p') > res.prot * 0.9; k++) {
      let alvo = null;
      for (const r of refs) for (let i = 0; i < r.itens.length; i++) {
        const fp = FOOD.get(r.itens[i].id);
        if ((fp.p * 4) / fp.kcal < 0.2 || fp.papel === 'vegetal') continue;
        const [mn, , st] = lim(fp.id, [60, 240, 10]);
        if (r.itens[i].g - st < mn) continue;
        // cede primeiro quem tem menos proteína por caloria
        if (!alvo || fp.p / fp.kcal < alvo.dens) alvo = { r, i, g: r.itens[i].g - st, dens: fp.p / fp.kcal };
      }
      if (!alvo) break;
      alvo.r.itens[alvo.i] = porcao(alvo.r.itens[alvo.i].id, alvo.g);
      refaz(alvo.r);
    }
  }
  // se ainda faltar energia: primeiro 1 colher de azeite no prato; depois acompanhamentos comuns, sem passar do limite de itens
  if (soma(refs, 'kcal') < res.kcal * 0.95) {
    for (const r of principais) { const i = r.itens.findIndex((x) => x.id === 'azeite-de-oliva'); if (i >= 0) { r.itens[i] = porcao('azeite-de-oliva', 13); refaz(r); } }
  }
  const faltaE = () => res.kcal * 0.97 - soma(refs, 'kcal');
  for (const r of principais) {
    const i = r.itens.findIndex((x) => LEGUM_SET.has(x.id));
    if (i < 0 || faltaE() < res.kcal * 0.05) continue;
    const fl = FOOD.get(r.itens[i].id);
    const g = Math.min(lim(fl.id, [50, 200, 10])[1], r.itens[i].g + Math.round((faltaE() / principais.length / fl.kcal) * 10) * 10);
    if (g > r.itens[i].g) { r.itens[i] = porcao(fl.id, g); refaz(r); }
  }
  const SEGUNDO = ['arroz-branco-cozido', 'macarrao-cozido', 'mandioca-cozida', 'arroz-integral-cozido', 'batata-doce-cozida', 'quinoa-cozida'];
  for (const r of principais) {
    if (faltaE() < res.kcal * 0.05 || cheia(r)) continue;
    const cb = escolhe(r, SEGUNDO.filter((id) => !usados.has(id) || noDia(id) < 1)) || escolhe(r, SEGUNDO);
    if (!cb) continue;
    r.itens.push(porcao(cb, ajusta(cb, (faltaE() / FOOD.get(cb).kcal) * 100, [60, 300, 10])));
    refaz(r);
  }
  const EXTRAS_PRATO = [['banana-prata', 130], ['arroz-branco-cozido', 150], ['feijao-carioca-cozido', 100], ['suco-de-laranja-natural', 300], ['mamao-papaia', 150], ['batata-doce-cozida', 150], ['abacate', 90], ['mandioca-cozida', 150]];
  const EXTRAS_LANCHE = [['banana-prata', 130], ['castanha-de-caju', 25], ['pasta-de-amendoim', 30], ['aveia-em-flocos', 40], ['mamao-papaia', 150], ['amendoa', 20], ['nozes', 20], ['suco-de-laranja-natural', 300], ['abacate', 90]];
  let parado = 0;
  for (let k = 0; k < 40 && parado < refs.length && soma(refs, 'kcal') < res.kcal * 0.95; k++) {
    const r = refs[k % refs.length];
    const falta = res.kcal - soma(refs, 'kcal');
    const op = cheia(r) ? null : (r.tipo === 'principal' ? EXTRAS_PRATO : EXTRAS_LANCHE).filter(([id]) => cabe(r, id)).sort((a, b) => noDia(a[0]) - noDia(b[0]))[0];
    if (!op) { parado++; continue; }
    parado = 0;
    const f = FOOD.get(op[0]);
    const g = Math.max(Math.round(f.porcao.g / 2 / 5) * 5, Math.min(op[1], Math.round(((falta / f.kcal) * 100) / 5) * 5));
    r.itens.push(porcao(op[0], g));
    refaz(r);
  }
  // conferência final da proteína: se ficou abaixo de 90% da meta, as fontes de proteína sobem até o limite da porção e
  // entra mais um reforço no prato, com os carboidratos cedendo espaço. Cada passo só vale se as calorias do dia não
  // passarem de 8% acima da meta (no emagrecimento, o déficit vem primeiro).
  if (soma(refs, 'p') < res.prot * 0.9) {
    const teto = res.kcal * 1.08;
    const tenta = (passo) => {
      const copia = refs.map((r) => r.itens.slice());
      passo();
      cortar(res.kcal * 1.05);
      if (soma(refs, 'kcal') <= teto) return true;
      refs.forEach((r, i) => { r.itens = copia[i]; refaz(r); });
      return false;
    };
    const falta = () => res.prot * 0.95 - soma(refs, 'p');
    for (const r of refs) {
      for (let i = 0; i < r.itens.length; i++) {
        if (falta() <= 3) break;
        const f = FOOD.get(r.itens[i].id);
        if ((f.p * 4) / f.kcal < 0.2 || f.papel === 'vegetal') continue;
        const [, mx, st] = lim(f.id, PROT_SET.has(f.id) ? [60, 240, 10] : [50, Math.min(300, f.porcao.g * 2), 10]);
        const g = Math.min(mx, Math.round((r.itens[i].g + (falta() / f.p) * 100) / st) * st);
        if (g > r.itens[i].g) tenta(() => { r.itens[i] = porcao(f.id, g); refaz(r); });
      }
    }
    for (const r of principais) {
      if (falta() <= 5 || cheia(r)) continue;
      const extra = escolhe(r, reforcos);
      if (extra) tenta(() => { r.itens.push(porcao(extra, ajusta(extra, (falta() / FOOD.get(extra).p) * 100, [25, 200, 5]))); refaz(r); });
    }
  }
}

const PLANO_REF = {
  3: [['cafe', 'Café da manhã', 0.27, 0.3], ['principal', 'Almoço', 0.4, 0.37], ['principal', 'Jantar', 0.33, 0.33]],
  4: [['cafe', 'Café da manhã', 0.24, 0.24], ['principal', 'Almoço', 0.34, 0.32], ['lanche', 'Lanche da tarde', 0.14, 0.14], ['principal', 'Jantar', 0.28, 0.3]],
  5: [['cafe', 'Café da manhã', 0.21, 0.21], ['lanche', 'Lanche da manhã', 0.1, 0.1], ['principal', 'Almoço', 0.31, 0.3], ['lanche', 'Lanche da tarde', 0.13, 0.13], ['principal', 'Jantar', 0.25, 0.26]],
  6: [['cafe', 'Café da manhã', 0.2, 0.2], ['lanche', 'Lanche da manhã', 0.09, 0.1], ['principal', 'Almoço', 0.29, 0.27], ['lanche', 'Lanche da tarde', 0.12, 0.12], ['principal', 'Jantar', 0.23, 0.23], ['ceia', 'Ceia', 0.07, 0.08]],
};

// Gera um dia de exemplo. `semente` troca os alimentos (botão "Outra sugestão").
export function cardapio(res, semente = 0) {
  if (!res || res.modo === 'educativo' || !res.kcal) return null;
  const seed = Math.abs(Math.floor(Number(semente))) % 1000000 || 0;
  const ref = PLANO_REF[res.refeicoes] || PLANO_REF[4];
  const usados = new Map();
  const rico = (res.prot * 4) / res.kcal >= 0.26;
  const refs = ref.map(([tipo, nome, fk, fp], i) => refeicao(tipo, nome, res.kcal * fk, res.prot * fp, res.restricoes, seed + i * 2 + (tipo === 'principal' ? i : 0), usados, rico));
  equilibrar(refs, res, usados);
  return { refeicoes: refs, kcal: soma(refs, 'kcal'), p: soma(refs, 'p'), c: soma(refs, 'c'), g: soma(refs, 'g'), fibra: soma(refs, 'fibra') };
}

// ---------- alimentação em volta do treino ----------
// `semNumeros`: no modo educativo (menores de 18, gestação, doença renal, transtorno alimentar, estimativa não confiável)
// a tela não deve mostrar os gramas de carboidrato e de proteína.
export function emVoltaDoTreino(res, treinoForte = false) {
  const peso = Number.isFinite(res.peso) ? res.peso : 70;
  const carbPre = Math.round(Math.min(90, Math.max(30, peso * (treinoForte ? 1.0 : 0.7))) / 5) * 5;
  const protPos = Math.round(Math.min(40, Math.max(20, peso * 0.3)) / 5) * 5;
  const rest = Array.isArray(res.restricoes) ? res.restricoes : [];
  const cond = Array.isArray(res.condicoes) ? res.condicoes : [];
  const veg = rest.includes('vegano');
  const sg = rest.includes('sem_gluten');
  const sl = rest.includes('sem_lactose');
  const vgt = rest.includes('vegetariano');
  const grao = sg ? 'chia' : 'aveia';
  const iogurte = sl ? 'iogurte natural sem lactose' : 'iogurte natural';
  const pre = [];
  if (veg) {
    pre.push('2 bananas + 1 colher de sopa de pasta de amendoim + 1 colher de sopa de ' + grao);
    pre.push(sg ? '1 tapioca média com tofu mexido + 1 fruta' : '2 fatias de pão com pasta de amendoim + 1 fruta');
  } else {
    pre.push(`1 banana + 1 pote de ${iogurte} + ` + (sg ? '1 colher de sopa de chia' : '2 colheres de sopa de aveia'));
    pre.push((sg ? '1 tapioca média' : '1 pão francês') + (sl ? ' com 2 ovos mexidos + 1 fruta' : ' com 2 ovos mexidos ou queijo branco + 1 fruta'));
  }
  pre.push('Se a refeição principal (almoço ou jantar) for 2 a 3 horas antes, ela já serve como pré-treino.');
  const pos = [];
  pos.push('A próxima refeição principal do dia: arroz, feijão, uma porção de ' + (veg ? 'tofu, soja ou grão-de-bico' : vgt ? (sl ? 'ovos ou tofu' : 'ovos, queijo ou tofu') : 'frango, carne, peixe ou ovos') + ' e salada.');
  if (veg) pos.push('Vitamina de bebida de soja com banana e ' + grao + ', se a refeição for demorar.');
  else pos.push((sl ? 'Vitamina de leite sem lactose ou bebida de soja' : 'Vitamina de leite ou iogurte') + ' com banana e ' + grao + (vgt ? '' : sg ? ', ou tapioca com frango ou atum' : ', ou sanduíche de frango ou atum') + ', se a refeição for demorar.');
  const dicasHorario = {
    cedo: 'Treino ao acordar: em jejum só se você se sente bem e o treino é leve ou moderado. Se der fraqueza, coma algo leve 30 a 60 minutos antes e tome o café completo depois.',
    manha: 'Treino de manhã: tome o café da manhã 1 a 2 horas antes. O almoço serve como refeição pós-treino.',
    tarde: 'Treino à tarde: almoce 2 a 3 horas antes, ou faça um lanche 1 hora antes. O jantar serve como refeição pós-treino.',
    noite: 'Treino à noite: lanche 1 a 2 horas antes e jantar depois. Evite cafeína à noite.',
    varia: 'Regra geral: faça uma refeição com carboidrato e proteína de 1 a 3 horas antes e outra até cerca de 2 horas depois do treino.',
  };
  let horario = dicasHorario[res.horario] || dicasHorario.varia;
  // diabetes: nada de treino em jejum sem orientação (risco de hipoglicemia)
  if (cond.includes('diabetes')) {
    horario = res.horario === 'cedo'
      ? 'Treino ao acordar: com diabetes, não treine em jejum sem orientação médica. Coma algo leve 30 a 60 minutos antes e tome o café completo depois.'
      : horario + ' Com diabetes, não treine em jejum sem orientação médica.';
  }
  const aguaPre = Array.isArray(res.aguaPre) ? res.aguaPre : [350, 700];
  return {
    carbPre, protPos, pre, pos, horario, semNumeros: res.modo === 'educativo',
    agua: `Água: ${aguaPre[0]} a ${aguaPre[1]} mL nas 2 a 4 horas antes do treino, e mais durante e depois.`,
  };
}

export function imcFaixa(imc, idade) {
  if (idade >= 60) return imc < 22 ? 'abaixo do recomendado para a idade' : imc <= 27 ? 'dentro do recomendado para a idade' : 'acima do recomendado para a idade';
  if (imc < 18.5) return 'abaixo do peso';
  if (imc < 25) return 'peso adequado';
  if (imc < 30) return 'sobrepeso';
  if (imc < 35) return 'obesidade grau I';
  if (imc < 40) return 'obesidade grau II';
  return 'obesidade grau III';
}

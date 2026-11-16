// Nutricionista virtual: entrevista + cálculos baseados em diretrizes publicadas (Mifflin-St Jeor 1990,
// ISSN 2017, Morton 2018, Helms 2014, Iraki 2019, AHA/ACC/TOS 2013, OMS, Guia Alimentar 2014 — ver data/knowledge.js).
// Também: preferência por alimentos mais baratos (faixas de preço em data/foods.js), cardápio com o que há em casa e
// alimentação para corrida (resumo vindo de logic/corrida.js).
// Orientação educativa: não é prescrição dietética e não substitui consulta com nutricionista.
import { ALIMENTOS } from '../data/foods.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));

export const PERGUNTAS = [
  {
    k: 'objetivo', tipo: 'um', titulo: 'Qual é o seu objetivo com a alimentação?',
    op: [['emagrecer', 'Emagrecer', 'Perder gordura preservando os músculos'], ['ganhar', 'Ganhar massa muscular', 'Comer para crescer com pouco ganho de gordura'], ['manter', 'Manter o peso e ter mais saúde', 'Comer melhor e ter energia para treinar']],
  },
  // pergunta opcional (entrou depois): respostas salvas sem ela continuam valendo, como "tanto faz"
  {
    k: 'preco', tipo: 'um', opcional: true, titulo: 'Você prefere alimentos mais baratos?', ajuda: 'Vale para o cardápio de exemplo. Preço muda com a região e a época.',
    op: [['barato', 'Sim, priorize os mais baratos', 'Frango, ovos, feijão, frutas e legumes da época'], ['tanto_faz', 'Tanto faz', 'O exemplo usa todos os alimentos']],
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
    if (v == null && q.opcional) return true;
    if (q.tipo === 'numero') return typeof v === 'number' && v >= q.min && v <= q.max;
    if (q.tipo === 'um') return typeof v === 'string' && q.op.some((o) => o[0] === v);
    return Array.isArray(v) && v.length > 0;
  });
}

// Nível de atividade física (PAL = gasto do dia ÷ gasto em repouso), do relatório FAO/OMS/UNU "Human energy
// requirements" (2004), capítulo 5, lido inteiro (ref fao2004):
//   estilo de vida sedentário ou de atividade leve: PAL de 1,40 a 1,69; ativo ou moderadamente ativo: 1,70 a 1,99;
//   vigoroso: 2,00 a 2,40. Abaixo de 1,40 não é compatível com saúde a longo prazo; acima de 2,40 não se sustenta.
//   As tabelas do relatório usam os degraus 1,45, 1,60, 1,75, 1,90, 2,05 e 2,20.
// Correspondência com a pergunta "Como é o seu dia a dia, fora os treinos?":
//   "Fico sentado a maior parte do dia" → 1,45 e "Fico em pé ou caminho parte do dia" → 1,60 (os dois degraus do estilo
//   sedentário ou leve: trabalho de pouco esforço, uso de veículo, lazer sentado ou em pé);
//   "Trabalho em movimento na maior parte do dia" → 1,75 e "Faço trabalho braçal pesado" → 1,90 (os dois degraus do
//   estilo ativo: o relatório dá pedreiros e operários da construção como exemplo dessa categoria; o estilo vigoroso,
//   de 2,00 para cima, é o de quem faz trabalho extenuante por várias horas todos os dias, como a lavoura sem máquinas).
// Treino: 1 hora por dia de exercício moderado a vigoroso leva o PAL de 1,55 para 1,75 (+0,20). Com 1 hora por treino,
// somam-se 0,20 × dias de treino ÷ 7: 1 a 2 dias, +0,04; 3 dias, +0,09; 4 a 5 dias, +0,13; 6 a 7 dias, +0,19.
// O PAL nunca passa de 2,40 (o maior que o relatório considera sustentável), com ou sem plano de corrida.
export const PAL_DIA = [1.45, 1.6, 1.75, 1.9];
export const PAL_TREINO = { 0: 0, 2: 0.04, 3: 0.09, 4: 0.13, 6: 0.19 };
export const PAL_MAX = 2.4;
const r5 = (n) => Math.round(n / 5) * 5;
const r10 = (n) => Math.round(n / 10) * 10;

// ---------- cálculo ----------
const PISO = { m: 1500, f: 1200 };   // abaixo disso, só com acompanhamento profissional (AHA/ACC/TOS 2013 — ref jensen2013)
const GASTO_MIN = 1000;              // estimativa abaixo disso: fora do que a fórmula cobre (derivada de 498 adultos de 19 a 78 anos — ref ruiz2011)
const numero = (v, min, max, padrao) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);

// O que as OUTRAS entrevistas dizem e que muda a segurança da Nutricionista: a idade informada ao Treinador, ao
// Treinador de corrida e na tela do sono, e as condições que a Nutricionista também trata (gestação, pós-parto, doença
// nos rins, diabetes e pressão alta) marcadas ao Treinador ou ao Treinador de corrida. Pura: só lê o estado.
// Devolve { idades: [{ valor, origem }], condicoes: [{ id, origem }] }, com origem = 'treinador' | 'corrida' | 'sono'.
const ONDE = { treinador: 'ao Treinador', corrida: 'ao Treinador de corrida', sono: 'na tela do sono' };
const COND_DE_FORA = { gestante: 'gestação', posparto: 'pós-parto', renal: 'doença nos rins', diabetes: 'diabetes', hipertensao: 'pressão alta' };
const proprio = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const idadeValida = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 130;
export function contextoDasEntrevistas(st) {
  const s = st && typeof st === 'object' && !Array.isArray(st) ? st : {};
  const resp = (o) => (o && typeof o === 'object' && o.answers && typeof o.answers === 'object' && !Array.isArray(o.answers) ? o.answers : {});
  const out = { idades: [], condicoes: [] };
  for (const [origem, a] of [['treinador', resp(s.trainer)], ['corrida', resp(s.run)]]) {
    if (idadeValida(a.idade)) out.idades.push({ valor: Math.floor(a.idade), origem });
    for (const c of Array.isArray(a.condicoes) ? a.condicoes : []) if (proprio(COND_DE_FORA, c) && !out.condicoes.some((x) => x.id === c)) out.condicoes.push({ id: c, origem });
  }
  if (s.sono && typeof s.sono === 'object' && idadeValida(s.sono.idade)) out.idades.push({ valor: Math.floor(s.sono.idade), origem: 'sono' });
  return out;
}
// o contexto que chega a calcular() é validado de novo (pode vir de qualquer lugar)
function limparContexto(c) {
  const out = { idades: [], condicoes: [] };
  if (!c || typeof c !== 'object' || Array.isArray(c)) return out;
  for (const x of Array.isArray(c.idades) ? c.idades : []) if (x && typeof x === 'object' && idadeValida(x.valor) && proprio(ONDE, x.origem)) out.idades.push({ valor: Math.floor(x.valor), origem: x.origem });
  for (const x of Array.isArray(c.condicoes) ? c.condicoes : []) if (x && typeof x === 'object' && proprio(COND_DE_FORA, x.id) && proprio(ONDE, x.origem) && !out.condicoes.some((y) => y.id === x.id)) out.condicoes.push({ id: x.id, origem: x.origem });
  return out;
}

// `corrida` (opcional) é o resumo do plano de corrida — logic/corrida.js, resumoParaNutricao(). Sem ele, nada muda.
// `contexto` (opcional) é o que as outras entrevistas dizem — contextoDasEntrevistas(state). Sem ele, nada muda. Com
// ele, vale sempre a resposta MAIS PROTEGIDA: menor de 18 anos, gestação, pós-parto ou doença nos rins em qualquer
// entrevista levam ao modo educativo (sem metas nem déficit); diabetes, à manutenção; pressão alta, às orientações de
// sal e cafeína. Cada proteção vinda de fora ganha um aviso curto dizendo de onde veio e pedindo para conferir as
// entrevistas, e entra em `protecoes` ([{ k, origem }]).
export function calcular(respostas, corrida = null, contexto = null) {
  const a = respostas && typeof respostas === 'object' ? respostas : {};
  // fora da faixa das perguntas (ou vazio), vale o limite mais próximo (ou o valor padrão da pergunta)
  const peso = numero(a.peso, 30, 250, 70), alt = numero(a.altura, 120, 220, 170), idadeAqui = numero(a.idade, 10, 99, 30);
  const lista = (x) => (Array.isArray(x) ? x.filter((y) => typeof y === 'string') : []);
  const cond = lista(a.condicoes).filter((x) => x !== 'nenhuma');
  // outras entrevistas: a menor idade abaixo de 18 vale no lugar da informada aqui; as condições se somam
  const ctx = limparContexto(contexto);
  const protecoes = [], conferir = [];
  let idade = idadeAqui;
  const maisNovo = ctx.idades.filter((x) => x.valor < 18 && x.valor < idadeAqui).sort((x, y) => x.valor - y.valor)[0];
  if (maisNovo) {
    idade = Math.max(10, maisNovo.valor);
    protecoes.push({ k: 'idade', origem: maisNovo.origem });
    conferir.push(`Você informou ${maisNovo.valor} anos ${ONDE[maisNovo.origem]} e ${idadeAqui} aqui. Por segurança, vale a menor idade: confira as entrevistas.`);
  } else {
    // idades de adulto que não batem (2 anos ou mais de diferença): não muda a conta, mas pede conferência
    const outra = ctx.idades.find((x) => Math.abs(x.valor - idadeAqui) >= 2 && (x.valor >= 18 || idadeAqui < 18));
    if (outra) conferir.push(`As idades informadas não batem: ${idadeAqui} anos aqui e ${outra.valor} ${ONDE[outra.origem]}. Confira as entrevistas.`);
  }
  for (const c of ctx.condicoes) {
    if (cond.includes(c.id) || (c.id === 'posparto' && cond.includes('gestante'))) continue;   // aqui, "gestação ou amamentação" já cobre o pós-parto
    cond.push(c.id);
    protecoes.push({ k: c.id, origem: c.origem });
    conferir.push(`Você informou ${COND_DE_FORA[c.id]} ${ONDE[c.origem]}, mas não aqui. Por segurança, vale a resposta mais protegida: confira as entrevistas.`);
  }
  const rest = lista(a.restricoes).filter((x) => x !== 'nenhuma');
  const sexo = a.sexo === 'm' ? 'm' : 'f';
  const imc = peso / ((alt / 100) ** 2);
  // Mifflin-St Jeor, com os coeficientes como aparecem em ruiz2011 (texto completo, apud Mifflin 1990):
  // 9,99 × peso + 6,25 × altura − 4,92 × idade + 166 (homens) − 161. Nos estudos, acerta dentro de 10% do gasto medido
  // em 45% a 75% das pessoas, conforme o grupo, e erra para mais depois de uma dieta (refs ruiz2011, amaro2019).
  const tmb = 9.99 * peso + 6.25 * alt - 4.92 * idade + (sexo === 'm' ? 5 : -161);
  const iAtiv = { sedentario: 0, leve: 1, moderado: 2, intenso: 3 }[a.atividade] ?? 0;
  const fator = Math.min(PAL_MAX, PAL_DIA[iAtiv] + (Object.prototype.hasOwnProperty.call(PAL_TREINO, String(a.treinos)) ? PAL_TREINO[a.treinos] : 0));
  let gasto = tmb * fator;
  // Corrida: o gasto nunca fica abaixo do dia a dia (sem treino) mais o custo da corrida, cerca de 1 kcal por quilo por
  // quilômetro, qualquer que seja o ritmo (ref rapoport2010, texto completo, apud Margaria 1963: maratona de quem pesa
  // 70 kg ≈ 2.950 kcal). Quem já respondeu que treina muitos dias não é contado duas vezes.
  const cor = limparCorrida(corrida);
  const kcalCorrida = cor ? (cor.kmSemana * peso) / 7 : 0;
  if (cor) gasto = Math.min(tmb * PAL_MAX, Math.max(gasto, tmb * PAL_DIA[iAtiv] + kcalCorrida));
  const treina = Number(a.treinos) >= 2 || (!!cor && cor.sessoesSemana >= 2);
  const avisos = [];
  // piso da faixa saudável de IMC: 18,5 (OMS) e, a partir dos 60 anos, 22 (Lipschitz, a faixa usada pelo SUS — imcFaixa)
  const imcPiso = idade >= 60 ? 22 : 18.5;
  const baixoPeso = imc < imcPiso;
  const kgPiso = Math.ceil(imcPiso * ((alt / 100) ** 2));          // peso, em quilos inteiros, que não fica abaixo do piso
  const obeso = imc >= 30;
  // Acima do IMC 25, a proteína por quilo usa o peso de IMC 25: o quilo a mais é quase todo gordura e não aumenta a
  // necessidade. Na obesidade a literatura limita o peso da conta — na perda de peso, pelo menos 1,2 g/kg com o peso
  // limitado ao de IMC 30 (ref weijs2025, texto completo) —, e 1,8 g por kg de IMC 25 = 1,5 g por kg de IMC 30 fica
  // acima desse mínimo. O corte único no IMC 25 evita o degrau que havia no IMC 30.
  const pesoRef = Math.min(peso, 25 * ((alt / 100) ** 2));
  const piso = PISO[sexo];
  const objetivo = ['emagrecer', 'ganhar', 'manter'].includes(a.objetivo) ? a.objetivo : 'manter';

  // situações em que o app NÃO calcula metas e encaminha a um profissional
  let modo = 'completo';
  if (idade < 18) { modo = 'educativo'; avisos.push({ tipo: 'warn', texto: 'Para menores de 18 anos não calculo calorias nem metas de peso. O corpo ainda está em crescimento: a alimentação deve ser acompanhada por nutricionista ou pediatra.' }); }
  if (cond.includes('gestante')) { modo = 'educativo'; avisos.push({ tipo: 'warn', texto: 'Na gestação e na amamentação as necessidades mudam e não se deve fazer dieta para emagrecer. Siga o acompanhamento do pré-natal e de um nutricionista.' }); }
  // pós-parto (só chega por outra entrevista): mesma proteção da amamentação
  if (cond.includes('posparto') && !cond.includes('gestante')) { modo = 'educativo'; avisos.push({ tipo: 'warn', texto: 'No pós-parto e na amamentação as necessidades mudam e não se deve fazer dieta para emagrecer por conta própria. Procure um nutricionista.' }); }
  if (cond.includes('transtorno')) { modo = 'educativo'; avisos.push({ tipo: 'warn', texto: 'Com histórico de transtorno alimentar, contar calorias pode fazer mal. Não mostro números: procure acompanhamento com nutricionista e psicólogo. Se precisar conversar agora, o CVV atende pelo telefone 188.' }); }
  if (cond.includes('renal')) { modo = 'educativo'; avisos.push({ tipo: 'danger', texto: 'Com doença nos rins, a quantidade de proteína, sódio, potássio e líquidos precisa ser definida pelo seu médico e nutricionista. Não siga metas de proteína de aplicativos.' }); }
  // estimativa de gasto muito baixa (pessoas muito leves, baixas ou de idade avançada): a fórmula erra demais para virar meta
  if (modo === 'completo' && gasto < GASTO_MIN) { modo = 'educativo'; avisos.push({ tipo: 'warn', texto: 'Para o seu peso, altura e idade, a fórmula de gasto de energia não é confiável. Não mostro metas de calorias: procure um nutricionista para uma avaliação individual.' }); }
  if (modo === 'completo' && cond.includes('diabetes')) { modo = 'manutencao'; avisos.push({ tipo: 'warn', texto: 'Com diabetes, reduzir calorias ou mudar horários de refeição pode causar hipoglicemia, principalmente com insulina ou remédios que baixam a glicose. Mostro só a estimativa de manutenção; qualquer dieta deve ser combinada com seu médico e nutricionista.' }); }
  if (modo === 'completo' && objetivo === 'emagrecer' && baixoPeso) { modo = 'manutencao'; avisos.push({ tipo: 'warn', texto: 'Seu peso já está abaixo da faixa considerada saudável para a sua altura. Não recomendo reduzir calorias; converse com um nutricionista.' }); }
  // Emagrecer só entra como meta quando a perda de peso é indicada e não leva abaixo do piso:
  //   AHA/ACC/TOS 2013, algoritmo (quadros 6, 7 e 9): tratamento para perder peso com IMC de 30 ou mais, ou de 25 a 29,9
  //   com fator de risco; com IMC abaixo de 25 a orientação é não ganhar peso. Meta inicial: perder de 5 a 10% do peso
  //   (ref jensen2013, texto integral).
  //   ESPEN, recomendações 79 a 82, para 65 anos ou mais: com sobrepeso, evitar dieta para emagrecer (perde-se músculo
  //   e função); com obesidade e problema de saúde ligado ao peso, só depois de avaliação individual, com déficit
  //   moderado (cerca de 500 kcal, sem baixar de 1.000 a 1.200 kcal), 0,25 a 1 kg por semana, proteína de pelo menos
  //   1 g/kg e exercício (ref volkert2022, texto integral).
  // Daí: (a) se perder 5% do peso — a menor meta das diretrizes — já deixaria a pessoa abaixo do piso, não há déficit;
  // (b) com 65 anos ou mais e IMC abaixo de 30, não há déficit; (c) com 65 ou mais e IMC de 30 ou mais, o déficit é
  // moderado e vem com aviso; (d) dentro da faixa saudável, o déficit vem com aviso e com o peso mínimo.
  const pertoDoPiso = !baixoPeso && peso * 0.95 < imcPiso * ((alt / 100) ** 2);
  const idosoSemObesidade = idade >= 65 && !obeso;
  if (modo === 'completo' && objetivo === 'emagrecer' && (pertoDoPiso || idosoSemObesidade)) {
    modo = 'manutencao';
    avisos.push({ tipo: 'warn', texto: pertoDoPiso
      ? `Seu peso já está perto do mínimo saudável para a sua altura (${kgPiso} kg). Não recomendo comer menos: mostro a meta para manter o peso. Para mudar o corpo, o caminho é o treino de força.`
      : 'Depois dos 65 anos, sem obesidade, dieta para emagrecer não é indicada: perde-se músculo junto com a gordura. Mostro a meta para manter o peso; treino de força e proteína suficiente melhoram o corpo sem restrição.' });
  }
  // com obesidade, comer acima do gasto não é indicado: dá para ganhar músculo treinando e comendo na manutenção
  // (Slater 2019; AHA/ACC/TOS 2013 — refs slater2019, jensen2013)
  if (modo === 'completo' && objetivo === 'ganhar' && obeso) { modo = 'manutencao'; avisos.push({ tipo: 'warn', texto: 'Com o seu IMC, comer acima do gasto tende a aumentar a gordura. Mostro a meta de manutenção com proteína alta: com treino de força, dá para ganhar músculo assim. Se o seu peso alto é de músculo, ajuste com um nutricionista.' }); }
  // de onde veio cada proteção trazida de outra entrevista, com o pedido de conferência
  for (const texto of conferir) avisos.push({ tipo: 'info', texto });
  if (modo !== 'educativo' && imc >= 40) avisos.push({ tipo: 'info', texto: 'Com IMC de 40 ou mais, o tratamento do peso deve ser acompanhado por médico e nutricionista. Use estes números só como referência inicial.' });
  if (cond.includes('hipertensao')) avisos.push({ tipo: 'info', texto: 'Pressão alta: limite o sal a 5 g por dia (1 colher de chá, contando o sal dos alimentos prontos), evite ultraprocessados e embutidos, e coma frutas, verduras, legumes, feijões e laticínios magros todos os dias (padrão DASH). Não use cafeína como suplemento.' });
  if (cond.includes('outra')) avisos.push({ tipo: 'info', texto: 'Com doença crônica, confirme estas orientações com seu médico ou nutricionista antes de mudar a alimentação.' });
  if (rest.includes('vegano')) avisos.push({ tipo: 'info', texto: 'Alimentação vegana bem planejada atende a quem treina, mas a vitamina B12 precisa ser suplementada. Combine feijões com cereais e varie as fontes de proteína (soja, tofu, lentilha, grão-de-bico). Atenção também a ferro, cálcio, zinco, iodo, vitamina D e ômega-3.' });
  if (rest.includes('sem_gluten')) avisos.push({ tipo: 'info', texto: 'Doença celíaca: a exclusão de trigo, centeio, cevada (e aveia não certificada) deve ser total. Cuidado com a contaminação cruzada em utensílios, óleo de fritura e alimentos a granel. Confira sempre o rótulo.' });
  if (rest.includes('sem_lactose')) avisos.push({ tipo: 'info', texto: 'Intolerância à lactose: o cardápio de exemplo não usa leite, iogurte nem queijo comuns. Se quiser, inclua as versões sem lactose desses alimentos.' });

  const out = { modo, imc, baixoPeso, tmb: r10(tmb), gasto: r10(gasto), fator: Math.round((gasto / tmb) * 1000) / 1000, pesoRef, avisos, restricoes: rest, condicoes: cond, peso, treina, objetivo, refeicoes: [3, 4, 5, 6].includes(Number(a.refeicoes)) ? Number(a.refeicoes) : 4, horario: a.horario || 'varia', sexo, idade };
  out.preco = a.preco === 'barato' ? 'barato' : 'tanto_faz';
  if (protecoes.length) out.protecoes = protecoes;
  // Água TOTAL do dia (bebidas + a água dos alimentos), em litros: a ingestão adequada da EFSA — 2,0 L (mulheres) e
  // 2,5 L (homens), para clima ameno e atividade moderada (ref efsa2017, relatório oficial lido inteiro). Em bebidas:
  // 1,6 L e 2,0 L, os mesmos valores que a ESPEN usa (ref volkert2022). A antiga regra de "35 mL por quilo" saiu: não
  // há fonte lida inteira que a sustente. Calor e treino pedem mais, e não há fórmula única: a perda de suor varia de
  // 0,3 a 2,4 L por hora (ref rodriguez2009); o guia é a sede.
  // O valor é o de adultos, inclusive idosos. Gestantes (+0,3 L), lactantes (+0,7 L) e menores têm outros valores no
  // mesmo relatório, e na doença renal quem define os líquidos é o médico: como todos esses perfis ficam no modo
  // educativo, nele o aplicativo não dá número de água nenhum (nem a dose de antes do treino, que é de adultos).
  out.agua = modo === 'educativo' ? null : sexo === 'm' ? 2.5 : 2.0;
  out.aguaBebidas = modo === 'educativo' ? null : sexo === 'm' ? 2.0 : 1.6;
  // antes do treino: 5 a 10 mL por quilo, nas 2 a 4 h antes — conferido no texto integral da posição conjunta de 2016
  // (Thomas, Erdman e Burke — ref thomas2016); a de 2009 dizia 5 a 7 mL/kg, 4 h antes (ref rodriguez2009)
  out.aguaPre = modo === 'educativo' ? null : [Math.max(150, Math.round(pesoRef * 5 / 50) * 50), Math.max(300, Math.round(pesoRef * 10 / 50) * 50)];
  if (modo === 'educativo') { if (cor) out.corrida = { ...cor }; return out; }

  // meta de energia
  let kcal = gasto;
  const obj = modo === 'manutencao' ? 'manter' : objetivo;
  if (obj === 'emagrecer') {
    // déficit ≈ 20%, limitado a 750 kcal (AHA/ACC/TOS 2013: 500 a 750 kcal ou 30% — ref jensen2013), a 500 kcal a partir
    // dos 65 anos (ESPEN — ref volkert2022) e ao que dá 1% do peso por semana (Helms 2014 — ref helms2014; 11 kcal por
    // quilo por dia = 1% × 7.700 kcal ÷ 7)
    kcal = gasto - Math.min(idade >= 65 ? 500 : 750, gasto * 0.2, peso * 11);
    if (idade >= 65) avisos.push({ tipo: 'warn', texto: 'Depois dos 65 anos, emagrecer pede cuidado para não perder músculo: decida com seu médico ou nutricionista, perca devagar e faça treino de força. Por isso a redução de calorias aqui é moderada.' });
    else if (imc < (idade >= 60 ? 27.05 : 25)) avisos.push({ tipo: 'info', texto: `Seu peso está na faixa saudável: perder peso não é uma necessidade de saúde. Se for perder, vá devagar e não baixe de ${kgPiso} kg.` });
    if (r10(gasto) <= piso) { kcal = gasto; avisos.push({ tipo: 'warn', texto: 'Seu gasto estimado já é baixo. Não sugiro comer menos do que isso sem acompanhamento: para emagrecer com segurança, aumente a atividade física e procure um nutricionista.' }); }
    else if (kcal < piso) { kcal = piso; avisos.push({ tipo: 'warn', texto: `Ajustei a meta para ${piso} kcal, o mínimo que este aplicativo sugere sem acompanhamento profissional. Dietas mais restritas só com nutricionista ou médico.` }); }
  } else if (obj === 'ganhar') {
    kcal = gasto + Math.min(500, gasto * 0.1);                       // superávit ≈ 10% (Iraki 2019; Slater 2019 — refs iraki2019, slater2019)
    out.ritmo = [Math.round(peso * 0.0025 * 10) / 10, Math.round(peso * 0.005 * 10) / 10];   // 0,25–0,5%/semana
  }
  if (obj !== 'emagrecer' && gasto < piso) avisos.push({ tipo: 'info', texto: `Sua estimativa de gasto ficou abaixo de ${piso} kcal. Em pessoas leves ou de mais idade a fórmula erra mais: confirme este número com um nutricionista.` });
  out.objetivoCalc = obj;
  out.kcal = r10(kcal);
  out.piso = piso;
  // Perda esperada: sai do déficit que a meta realmente tem (gasto − meta, já arredondados), a 7.700 kcal por quilo de
  // gordura (3.500 kcal por libra: 500 kcal a menos por dia ≈ meio quilo por semana — ref helms2014, texto completo, que
  // avisa: a conta é estática, o corpo se adapta e a perda real tende a ser menor). Sem déficit, não há ritmo a mostrar.
  // O teto saudável é 1% do peso por semana, até 1 kg (refs helms2014, jensen2013).
  if (obj === 'emagrecer') {
    out.deficit = Math.max(0, out.gasto - out.kcal);
    if (out.deficit >= 50) { out.perdaSemana = Math.round(((out.deficit * 7) / 7700) * 100) / 100; out.perdaMax = Math.min(1, Math.round(peso * 0.01 * 10) / 10); }
  }

  // Proteína (g por kg de peso de referência, por dia), conferida nos textos em nov/2026:
  //   quem treina: ISSN 2017 — 1,4 a 2,0 para quem se exercita, mais em déficit (ref jager2017); Morton 2018 — o ganho
  //   de massa para de crescer em 1,62 (IC 95%: 1,03 a 2,20) (ref morton2018); Helms 2014 — parte alta em déficit.
  //   Daí 1,8 para emagrecer ou ganhar e 1,6 para manter.
  //   quem ainda não treina: 1,0 para manter (acima do mínimo de 0,8 da RDA — ref dri_canada); 1,5 para emagrecer — na
  //   perda de peso a necessidade sobe para pelo menos 1,2 g/kg, com o peso limitado ao de IMC 30 (ref weijs2025), e 1,5
  //   por quilo de peso de IMC 25 nunca fica abaixo disso; 1,6 para ganhar (acima disso não há ganho extra — morton2018).
  //   65 anos ou mais: pelo menos 1,2 (ESPEN: 1,0 a 1,2 para idosos saudáveis; 1,2 a 1,5 com doença — ref deutz2014).
  // Gestantes, menores de 18 e doença renal não chegam aqui (modo educativo): na doença renal o alvo é cerca de
  // 0,8 g/kg, sem passar de 1,3 (KDIGO 2024 — ref kdigo2024), e quem define é o médico.
  let gkg = treina ? (obj === 'manter' ? 1.6 : 1.8) : obj === 'emagrecer' ? 1.5 : obj === 'ganhar' ? 1.6 : 1.0;
  if (idade >= 65) gkg = Math.max(gkg, 1.2);
  if (rest.includes('vegano')) gkg = Math.min(2.0, gkg + 0.2);
  let prot = gkg * pesoRef;
  // faixa aceitável: 10 a 35% das calorias (AMDR das DRI; a RDA é 0,8 g/kg — ref dri_canada), sem passar de 2,2 g por quilo de
  // peso (Morton 2018 — ref morton2018). A posição conjunta de 2016 dá 1,2 a 2,0 g/kg para quem treina (ref thomas2016).
  prot = Math.min(Math.max(prot, (kcal * 0.1) / 4), 2.2 * peso, (kcal * 0.35) / 4);
  // gordura: 28% das calorias, dentro da faixa de 20 a 35% (refs dri_canada, efsa2017, iraki2019), e nunca abaixo de
  // 0,5 g por quilo — o piso da faixa de 0,5 a 1,5 g/kg que iraki2019 (texto completo) dá como equivalente a 20–35%
  let gord = Math.max((kcal * 0.28) / 9, 0.5 * pesoRef);
  let carb = (kcal - prot * 4 - gord * 9) / 4;
  if (carb < 2 * pesoRef) { gord = Math.max((kcal * 0.22) / 9, 0.5 * pesoRef); carb = (kcal - prot * 4 - gord * 9) / 4; }
  // a gordura não passa de 35% das calorias (faixa de 20 a 35% das DRI e da EFSA — refs dri_canada, efsa2017; a OMS
  // sugere até 30% para evitar ganho de peso — ref oms_dieta); o que sobra vai para o carboidrato
  if (gord * 9 > kcal * 0.35) { gord = (kcal * 0.35) / 9; carb = (kcal - prot * 4 - gord * 9) / 4; }
  out.prot = r5(prot); out.gord = r5(gord);
  // o carboidrato fecha a conta das calorias com os valores já arredondados
  out.carb = Math.max(0, r5((out.kcal - out.prot * 4 - out.gord * 9) / 4));
  out.gkg = Math.round((out.prot / peso) * 10) / 10;
  // Corrida: carboidrato do dia pela carga de treino — atividade leve, 3 a 5 g por quilo; cerca de 1 h por dia, 5 a 7;
  // de 1 a 3 h, 6 a 10; mais de 4 a 5 h, 8 a 12 (Tabela 2 da posição conjunta de 2016, lida na íntegra — ref thomas2016,
  // apud Burke 2011). Se a meta ficou abaixo
  // do início da faixa, a gordura cede espaço (sem cair de 20% das calorias); em déficit pode não chegar lá, e a tela avisa.
  if (cor) {
    const faixaCarb = faixaCarboidrato(cor.minSemana);
    const alvo = faixaCarb[0] * pesoRef;
    if (out.carb < alvo) {
      const gordMin = Math.max((out.kcal * 0.2) / 9, 0.5 * pesoRef);
      out.gord = Math.max(Math.ceil(gordMin / 5) * 5, r5((out.kcal - out.prot * 4 - alvo * 4) / 9));
      out.carb = Math.max(0, r5((out.kcal - out.prot * 4 - out.gord * 9) / 4));
    }
    out.corrida = { ...cor, kcalDia: r10(kcalCorrida), faixaCarb, carbKg: Math.round((out.carb / pesoRef) * 10) / 10 };
  }
  out.fibra = Math.min(50, Math.max(25, Math.round((kcal / 1000) * 14)));   // 14 g por 1.000 kcal (DRI — ref dri_canada); mínimo de 25 g (OMS — ref oms_dieta)
  // por refeição: 0,25 a 0,40 g/kg, a cada 3 a 4 h (refs jager2017, kerksick2017); 0,4 g/kg em 4 refeições dão 1,6 g/kg (ref schoenfeld2018)
  out.protRefeicao = [Math.round(0.25 * pesoRef), Math.round(0.4 * pesoRef)];
  return out;
}

// ---------- cardápio de exemplo ----------
const POOL = {
  cafe_carbo: ['pao-frances', 'tapioca-pronta', 'aveia-em-flocos', 'cuscuz-de-milho-cozido', 'pao-de-forma-integral', 'batata-doce-cozida'],
  cafe_prot: ['ovo-cozido', 'queijo-minas-frescal', 'iogurte-natural', 'queijo-cottage', 'ricota', 'leite-integral', 'queijo-mucarela', 'tofu', 'pasta-de-amendoim', 'leite-de-soja'],
  fruta: ['banana-prata', 'mamao-papaia', 'maca-fuji', 'laranja-pera', 'abacaxi', 'melancia', 'manga-palmer', 'morango', 'goiaba-vermelha', 'pera-williams', 'tangerina-ponca', 'uva-italia', 'melao', 'kiwi'],
  carbo: ['arroz-branco-cozido', 'arroz-integral-cozido', 'batata-inglesa-cozida', 'macarrao-cozido', 'mandioca-cozida', 'batata-doce-cozida', 'quinoa-cozida', 'inhame-cozido'],
  legum: ['feijao-carioca-cozido', 'feijao-preto-cozido', 'lentilha-cozida', 'grao-de-bico-cozido'],
  prot: ['peito-de-frango-grelhado', 'patinho-grelhado', 'tilapia-grelhada', 'carne-moida-cozida', 'sobrecoxa-de-frango-assada-sem-pele', 'merluza-assada', 'lombo-suino-assado', 'sardinha-assada', 'coxao-mole-cozido', 'ovo-cozido', 'tofu', 'soja-cozida', 'proteina-de-soja-texturizada'],
  salada: ['alface-crespa', 'tomate', 'rucula', 'pepino', 'cenoura-crua', 'repolho-branco-cru'],
  legume: ['brocolis-cozido', 'abobrinha-cozida', 'cenoura-cozida', 'couve-refogada', 'chuchu-cozido', 'beterraba-cozida', 'couve-flor-cozida', 'vagem-cozida', 'abobora-cabotia-cozida', 'quiabo-cozido', 'berinjela-cozida'],
  lanche_prot: ['iogurte-natural', 'queijo-minas-frescal', 'ovo-cozido', 'queijo-cottage', 'leite-integral', 'tofu', 'leite-de-soja', 'amendoim-torrado-salgado', 'grao-de-bico-cozido'],
  lanche_extra: ['aveia-em-flocos', 'castanha-de-caju', 'pasta-de-amendoim', 'castanha-do-para', 'nozes', 'amendoa', 'chia'],
  ceia: ['iogurte-natural', 'leite-desnatado', 'queijo-cottage', 'ovo-cozido', 'tofu', 'leite-de-soja', 'amendoim-torrado-salgado', 'castanha-de-caju'],
  gordura: ['azeite-de-oliva', 'oleo-de-soja'],
};
// "O que eu tenho em casa": os mesmos grupos, com mais alimentos (tudo o que pode ocupar aquele lugar na refeição).
const CRUS = ['alface-crespa', 'alface-americana', 'alface-lisa', 'rucula', 'agriao', 'almeirao', 'acelga', 'tomate', 'pepino', 'cenoura-crua', 'repolho-branco-cru', 'repolho-roxo-cru', 'couve-crua', 'pimentao-verde', 'rabanete', 'palmito-em-conserva'];
const FRIOS = ['presunto-cozido', 'peito-de-peru-defumado', 'mortadela', 'salame'];
const OVOS_E_SOJA = ['ovo-cozido', 'ovo-frito', 'omelete-de-queijo', 'clara-de-ovo-cozida', 'ovo-de-codorna', 'tofu', 'soja-cozida', 'proteina-de-soja-texturizada'];
const LEITES = ['leite-integral', 'leite-semidesnatado', 'leite-desnatado', 'leite-em-po-integral', 'leite-em-po-desnatado', 'iogurte-natural', 'iogurte-natural-desnatado', 'iogurte-de-morango', 'bebida-lactea', 'leite-fermentado', 'leite-achocolatado', 'leite-de-soja'];
const QUEIJOS = ['queijo-minas-frescal', 'queijo-minas-meia-cura', 'queijo-mucarela', 'queijo-prato', 'queijo-cottage', 'ricota', 'requeijao-cremoso'];
const doPapel = (papel, fora = []) => ALIMENTOS.filter((f) => f.papel === papel && !fora.includes(f.id)).map((f) => f.id);
const MAIS_CASA = {
  cafe_carbo: ['pao-de-forma', 'torrada', 'granola', 'biscoito-cream-cracker', 'cereal-matinal-de-milho', 'pao-de-queijo-assado', 'bolo-de-milho', 'canjica-com-leite', 'pamonha', 'polenta-cozida', 'milho-verde-espiga', 'mandioca-cozida', 'inhame-cozido', 'cara-cozido', 'banana-da-terra', 'biscoito-maisena', 'biscoito-de-polvilho', 'bolo-de-chocolate', 'biscoito-recheado'],
  cafe_prot: [...LEITES, ...QUEIJOS, ...FRIOS, 'ovo-frito', 'omelete-de-queijo', 'clara-de-ovo-cozida', 'ovo-de-codorna', 'whey-protein', 'amendoim-torrado-salgado', 'amendoim-cru'],
  fruta: doPapel('fruta', ['limao-tahiti']),
  carbo: ['batata-inglesa-assada', 'mandioquinha-cozida', 'cuscuz-de-milho-cozido', 'cara-cozido', 'polenta-cozida', 'milho-verde-espiga', 'milho-verde-enlatado', 'nhoque-de-batata-cozido', 'lasanha-massa-cozida', 'macarrao-a-bolonhesa', 'baiao-de-dois', 'batata-saute', 'pinhao-cozido', 'banana-da-terra', 'farinha-de-mandioca-torrada', 'pao-frances', 'batata-inglesa-frita', 'mandioca-frita', 'macarrao-instantaneo'],
  legum: ['ervilha-enlatada', 'ervilha-fresca', 'feijao-fradinho-cozido', 'feijao-roxo-cozido', 'feijao-jalo-cozido', 'feijao-tropeiro', 'feijoada'],
  prot: [...ALIMENTOS.filter((f) => (f.cat === 'carnes' || f.cat === 'peixes') && f.papel === 'proteina' && !FRIOS.includes(f.id)).map((f) => f.id), ...OVOS_E_SOJA],
  salada: CRUS,
  legume: doPapel('vegetal', [...CRUS, 'molho-de-tomate', 'cebola-crua']),
  lanche_prot: [...LEITES, ...QUEIJOS, ...FRIOS, 'ovo-de-codorna', 'whey-protein', 'amendoim-cru'],
  lanche_extra: ['granola', 'linhaca', 'gergelim', 'amendoim-cru', 'amendoim-torrado-salgado', 'coco-cru', 'pacoca', 'pe-de-moleque', 'chocolate-amargo-70'],
  ceia: [...LEITES, ...QUEIJOS, 'ovo-de-codorna', 'whey-protein', 'amendoim-cru'],
  gordura: ['oleo-de-girassol', 'oleo-de-milho', 'oleo-de-canola', 'manteiga-com-sal', 'margarina-com-sal'],
};
const POOL_CASA = Object.fromEntries(Object.keys(POOL).map((k) => [k, [...new Set([...POOL[k], ...(MAIS_CASA[k] || [])])].filter((id) => FOOD.has(id))]));
// os alimentos que o cardápio "em casa" sabe usar (os demais — açúcar, refrigerante, doces, molhos — podem ser marcados, mas não entram)
export const USADOS_EM_CASA = new Set(Object.values(POOL_CASA).flat());
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
// sem limite próprio, vale o padrão do grupo, sem passar de 3 porções caseiras nem ficar abaixo de meia porção
const lim = (id, def) => {
  if (LIMITE[id]) return LIMITE[id];
  const pg = FOOD.get(id).porcao.g, st = def[2];
  const mx = Math.max(st, Math.min(def[1], Math.floor((pg * 3) / st) * st));
  return [Math.min(mx, Math.max(def[0], Math.ceil((pg * 0.5) / st) * st)), mx, st];
};
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
// "Mais baratos": ficam os alimentos da menor faixa de preço que o grupo tem; se forem menos de `min`, entram também os
// da faixa seguinte — nunca mais que um degrau. Havendo um alimento barato, o caro não entra, mesmo que sobrem só uma
// ou duas opções (é o caso do cardápio vegano: soja e proteína de soja, sem tofu). As faixas vêm de data/foods.js.
const faixa = (id) => FOOD.get(id).preco.faixa;
function economicos(lista, min = 2) {
  if (!lista.length) return lista;
  const menor = Math.min(...lista.map(faixa));
  const daMenor = lista.filter((id) => faixa(id) === menor);
  return daMenor.length >= min ? daMenor : lista.filter((id) => faixa(id) <= menor + 1);
}
// Contexto de um cardápio: restrições (sempre obrigatórias), preferência de preço e, se houver, o que a pessoa tem em casa.
function contexto(res, emCasa) {
  const rest = Array.isArray(res.restricoes) ? res.restricoes : [];
  const casa = Array.isArray(emCasa) ? new Set(emCasa.filter((id) => FOOD.has(id))) : null;
  const barato = !casa && res.preco === 'barato';                // com a lista de casa, o preço não entra: a comida já está comprada
  const pode = (id) => permite(id, rest) && (!casa || casa.has(id));
  const filtra = (lista, min) => (barato ? economicos(lista, min) : lista);
  return { rest, casa, barato, pode, filtra, semCarne: rest.includes('vegano') || rest.includes('vegetariano') };
}
function servem(pool, ctx) {
  const { rest, semCarne } = ctx;
  if (ctx.casa) {
    // em casa: vale tudo o que a pessoa marcou; havendo opção, os ultraprocessados ficam de fora (Guia Alimentar — ref guia2014)
    const tem = POOL_CASA[pool].filter(ctx.pode);
    const menosProcessados = tem.filter((id) => FOOD.get(id).nova < 4);
    return menosProcessados.length ? menosProcessados : tem;
  }
  const comSoja = semCarne || rest.includes('sem_lactose');
  // grão-de-bico como lanche: só para quem não come carne (para os demais ele já aparece no prato)
  const ok = POOL[pool].filter((id) => ctx.pode(id) && ((pool === 'prot' ? semCarne : comSoja) || !SO_VEG.has(id)) && (semCarne || !(pool === 'lanche_prot' && id === 'grao-de-bico-cozido')));
  return ctx.filtra(ok.length ? ok : POOL[pool].filter(ctx.pode));
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
  return { id, nome: f.nome, g, faixa: f.preco.faixa, kcal: (f.kcal * g) / 100, p: (f.p * g) / 100, c: (f.c * g) / 100, gd: (f.g * g) / 100, fibra: (f.fibra * g) / 100, medida: medida(f, g) };
}
// medida caseira aproximada: "200 g (4 unidades)", "150 g (3 colheres de sopa cheias)"
const PLURAL = { pacote: 'pacotes', espiga: 'espigas', posta: 'postas', unidade: 'unidades', fatia: 'fatias', colher: 'colheres', pegador: 'pegadores', 'xícara': 'xícaras', escumadeira: 'escumadeiras', 'pedaço': 'pedaços', concha: 'conchas', 'filé': 'filés', bife: 'bifes', gomo: 'gomos', copo: 'copos', pote: 'potes', cacho: 'cachos', 'sachê': 'sachês', pires: 'pires', punhado: 'punhados', lata: 'latas', garrafa: 'garrafas', dosador: 'dosadores', barra: 'barras', folha: 'folhas', ramo: 'ramos', 'média': 'médias', 'médio': 'médios', grossa: 'grossas', pequena: 'pequenas', pequeno: 'pequenos', grande: 'grandes', cheia: 'cheias', cheio: 'cheios', rasa: 'rasas' };
const SINGULAR = Object.fromEntries(Object.entries(PLURAL).map(([s, p]) => [p, s]));
export function medida(f, g) {
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
// gordura de cozinha do prato (1 colher): azeite; com "mais baratos", óleo de soja; com a lista de casa, a que houver
function oleoDoPrato(ctx) {
  if (ctx.casa) return POOL_CASA.gordura.find(ctx.pode) || null;
  return ctx.barato ? 'oleo-de-soja' : 'azeite-de-oliva';
}
// Monta uma refeição. Cada parte só entra se houver alimento para ela (com a lista de casa, um grupo pode faltar).
function refeicao(tipo, nome, kcalAlvo, pAlvo, ctx, seed, usados, rico) {
  const itens = [];
  const fontes = (pool) => (rico ? concentradas(servem(pool, ctx)) : servem(pool, ctx));
  const reserva = (pool) => (rico ? servem(pool, ctx) : []);
  const add = (id, g) => { if (id && g > 0 && !itens.some((x) => x.id === id)) itens.push(porcao(id, g)); };
  const tem = (id) => itens.some((x) => x.id === id);
  const fruta = pick(servem('fruta', ctx), seed * 3 + tipo.length, usados);
  if (tipo === 'principal') {
    const sal = pick(servem('salada', ctx), seed, usados);
    if (sal) add(sal, FOOD.get(sal).porcao.g);
    const lg = pick(servem('legume', ctx).filter((x) => !tem(x)), seed * 2 + 1, usados);
    if (lg) add(lg, Math.round(FOOD.get(lg).porcao.g * 1.5 / 10) * 10);
    const fj = pick(servem('legum', ctx), seed, usados);
    add(fj, ctx.semCarne ? 150 : 100);
    add(oleoDoPrato(ctx), 8);
    const faltaP = Math.max(8, pAlvo - soma(itens, 'p') - 4);
    const todas = servem('prot', ctx).filter((x) => !tem(x));
    const capaz = todas.filter((id) => (FOOD.get(id).p * lim(id, [60, 240, 10])[1]) / 100 >= faltaP * 0.8);
    const pr = pick(capaz.length ? capaz : todas, seed, usados);
    if (pr) add(pr, ajusta(pr, (faltaP / FOOD.get(pr).p) * 100, [60, 220, 10]));
    const cb = pick(servem('carbo', ctx).filter((x) => !tem(x)), seed + 1, usados);
    const faltaK = kcalAlvo - soma(itens, 'kcal');
    if (cb && faltaK > 45) add(cb, ajusta(cb, (faltaK / FOOD.get(cb).kcal) * 100, [50, 300, 10]));
  } else if (tipo === 'cafe') {
    if (fruta) add(fruta, FOOD.get(fruta).porcao.g);
    const pr = pick(fontes('cafe_prot'), seed, usados, reserva('cafe_prot'));
    if (pr) add(pr, ajusta(pr, ((pAlvo - soma(itens, 'p') - 4) / FOOD.get(pr).p) * 100, [30, 200, 10]));
    if (pr && pAlvo - soma(itens, 'p') > 8) {
      const pr2 = pick(fontes('cafe_prot').filter((x) => x !== pr), seed + 1, usados, reserva('cafe_prot').filter((x) => x !== pr));
      if (pr2) add(pr2, ajusta(pr2, ((pAlvo - soma(itens, 'p') - 3) / FOOD.get(pr2).p) * 100, [30, 200, 10]));
    }
    const cb = pick(servem('cafe_carbo', ctx).filter((x) => !tem(x)), seed, usados);
    const faltaK = kcalAlvo - soma(itens, 'kcal');
    if (cb && faltaK > 45) add(cb, ajusta(cb, (faltaK / FOOD.get(cb).kcal) * 100, [40, 200, 10]));
    if (kcalAlvo - soma(itens, 'kcal') > 90) { const ex = pick(servem('lanche_extra', ctx).filter((x) => !tem(x)), seed + 2, usados); if (ex) add(ex, ajusta(ex, ((kcalAlvo - soma(itens, 'kcal')) / FOOD.get(ex).kcal) * 100, [10, 40, 5])); }
  } else if (tipo === 'lanche') {
    if (fruta) add(fruta, FOOD.get(fruta).porcao.g);
    const pr = pick(fontes('lanche_prot').filter((x) => !tem(x)), seed + 1, usados, reserva('lanche_prot').filter((x) => !tem(x)));
    if (pr) add(pr, ajusta(pr, ((pAlvo - soma(itens, 'p')) / FOOD.get(pr).p) * 100, [50, 300, 10]));
    const faltaK = kcalAlvo - soma(itens, 'kcal');
    if (faltaK > 60) { const ex = pick(servem('lanche_extra', ctx).filter((x) => !tem(x)), seed, usados); if (ex) add(ex, ajusta(ex, (faltaK / FOOD.get(ex).kcal) * 100, [10, 50, 5])); }
  } else {
    const pr = pick(fontes('ceia'), seed, usados, reserva('ceia'));
    if (pr) add(pr, ajusta(pr, (pAlvo / FOOD.get(pr).p) * 100, [50, 300, 10]));
    if (fruta && kcalAlvo - soma(itens, 'kcal') > 25) add(fruta, Math.round(FOOD.get(fruta).porcao.g / 2 / 5) * 5);
  }
  return { nome, tipo, itens, kcal: soma(itens, 'kcal'), p: soma(itens, 'p'), c: soma(itens, 'c'), g: soma(itens, 'gd'), fibra: soma(itens, 'fibra') };
}

// Ajuste fino: aproxima o total do dia das metas de proteína e de calorias, sem sair das porções caseiras.
const PROT_SET = new Set(POOL_CASA.prot);
const CARB_SET = new Set(POOL_CASA.carbo);
const LEGUM_SET = new Set(POOL_CASA.legum);
const GORD_SET = new Set(POOL_CASA.gordura);
function refaz(ref) { for (const k of ['kcal', 'p', 'c', 'fibra']) ref[k] = soma(ref.itens, k); ref.g = soma(ref.itens, 'gd'); }
function equilibrar(refs, res, usados, ctx) {
  const rest = ctx.rest;
  const principais = refs.filter((r) => r.tipo === 'principal');
  if (!principais.length) return;
  const vegano = rest.includes('vegano');
  const veg = vegano || rest.includes('vegetariano');
  const noDia = (id) => refs.reduce((n, r) => n + (r.itens.some((x) => x.id === id) ? 1 : 0), 0);
  // meta alta (mais de 900 kcal por refeição, em média): cada refeição aceita 2 itens a mais e os complementos crescem
  const alta = res.kcal / refs.length > 900;
  const cheia = (r) => r.itens.length >= MAX_ITENS[r.tipo] + (alta ? 2 : 0);
  // um alimento novo só entra se respeitar as restrições, não estiver na refeição e não aparecer mais de 2 vezes no dia
  const cabe = (r, id) => ctx.pode(id) && !r.itens.some((x) => x.id === id) && noDia(id) < 2;
  const escolhe = (r, opcoes) => opcoes.filter((id) => cabe(r, id)).sort((a, b) => noDia(a) - noDia(b))[0];
  // com a lista de casa, os reforços e os complementos saem dela (os mais ricos em proteína primeiro)
  const daCasa = (pools) => [...new Set(pools.flatMap((p) => servem(p, ctx)))];
  const reforcos = ctx.casa ? daCasa(['prot', 'cafe_prot', 'legum']).sort((a, b) => densidade(b) - densidade(a))
    : ctx.filtra(vegano ? ['proteina-de-soja-texturizada', 'soja-cozida', 'tofu', 'grao-de-bico-cozido', 'lentilha-cozida']
      : veg ? ['ovo-cozido', 'proteina-de-soja-texturizada', 'queijo-cottage', 'soja-cozida', 'tofu']
        : ['ovo-cozido', 'queijo-cottage', 'queijo-minas-frescal', 'ricota', 'queijo-mucarela'], 2);
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
          const troca = r.kcal - r.itens[i].kcal >= 80 ? null : escolhe(r, servem('lanche_extra', ctx));
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
          const cb = cada > 45 && !cheia(r) ? escolhe(r, servem('carbo', ctx)) : null;
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
    for (const r of principais) { const i = r.itens.findIndex((x) => GORD_SET.has(x.id)); if (i >= 0) { r.itens[i] = porcao(r.itens[i].id, 13); refaz(r); } }
  }
  const faltaE = () => res.kcal * 0.97 - soma(refs, 'kcal');
  for (const r of principais) {
    const i = r.itens.findIndex((x) => LEGUM_SET.has(x.id));
    if (i < 0 || faltaE() < res.kcal * 0.05) continue;
    const fl = FOOD.get(r.itens[i].id);
    const g = Math.min(lim(fl.id, [50, 200, 10])[1], r.itens[i].g + Math.round((faltaE() / principais.length / fl.kcal) * 10) * 10);
    if (g > r.itens[i].g) { r.itens[i] = porcao(fl.id, g); refaz(r); }
  }
  const SEGUNDO = ctx.casa ? servem('carbo', ctx) : ctx.filtra(['arroz-branco-cozido', 'macarrao-cozido', 'mandioca-cozida', 'arroz-integral-cozido', 'batata-doce-cozida', 'quinoa-cozida']);
  for (const r of principais) {
    if (faltaE() < res.kcal * 0.05 || cheia(r)) continue;
    const cb = escolhe(r, SEGUNDO.filter((id) => !usados.has(id) || noDia(id) < 1)) || escolhe(r, SEGUNDO);
    if (!cb) continue;
    r.itens.push(porcao(cb, ajusta(cb, (faltaE() / FOOD.get(cb).kcal) * 100, [60, 300, 10])));
    refaz(r);
  }
  // complementos de energia: [alimento, gramas no máximo]
  const pares = (lista) => { const ok = new Set(ctx.filtra(lista.map((x) => x[0]))); return lista.filter((x) => ok.has(x[0])); };
  const umaEMeia = (ids) => ids.map((id) => [id, Math.min(lim(id, [0, 300, 10])[1], Math.round((FOOD.get(id).porcao.g * 1.5) / 5) * 5)]);
  const EXTRAS_PRATO = ctx.casa ? umaEMeia(daCasa(['fruta', 'carbo', 'legum']))
    : pares([['banana-prata', 130], ['arroz-branco-cozido', 150], ['feijao-carioca-cozido', 100], ['suco-de-laranja-natural', 300], ['mamao-papaia', 150], ['batata-doce-cozida', 150], ['abacate', 90], ['mandioca-cozida', 150]]);
  const EXTRAS_LANCHE = ctx.casa ? umaEMeia(daCasa(['fruta', 'lanche_extra', 'cafe_carbo']))
    : pares([['banana-prata', 130], ['castanha-de-caju', 25], ['pasta-de-amendoim', 30], ['aveia-em-flocos', 40], ['mamao-papaia', 150], ['amendoa', 20], ['nozes', 20], ['suco-de-laranja-natural', 300], ['abacate', 90]]);
  let parado = 0;
  for (let k = 0; k < 60 && parado < refs.length && soma(refs, 'kcal') < res.kcal * 0.95; k++) {
    const r = refs[k % refs.length];
    const falta = res.kcal - soma(refs, 'kcal');
    const op = cheia(r) ? null : (r.tipo === 'principal' ? EXTRAS_PRATO : EXTRAS_LANCHE).filter(([id]) => cabe(r, id)).sort((a, b) => noDia(a[0]) - noDia(b[0]))[0];
    if (!op) { parado++; continue; }
    parado = 0;
    const f = FOOD.get(op[0]);
    const teto = alta ? Math.min(lim(op[0], [0, 300, 10])[1], Math.round((op[1] * 1.5) / 5) * 5) : op[1];
    const g = Math.max(Math.round(f.porcao.g / 2 / 5) * 5, Math.min(teto, Math.round(((falta / f.kcal) * 100) / 5) * 5));
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
  // Proteína acima da meta (acontece com metas baixas, de quem não treina: as porções mínimas de carne, ovos e
  // laticínios já somam mais que a meta). As fontes de proteína cedem — primeiro as do café, dos lanches e da ceia, que
  // podem sair; depois as do prato, até uma porção pequena (40% da porção caseira) — e a energia volta com alimentos de
  // pouca proteína: óleo do prato, frutas, arroz, mandioca, batata. Vale até 115% da meta de proteína.
  const tetoP = res.prot * 1.15;
  const rica = (id) => densidade(id) >= 0.2 && FOOD.get(id).papel !== 'vegetal';
  const passoDe = (f) => lim(f.id, PROT_SET.has(f.id) ? [60, 240, 10] : [50, 300, 10])[2];
  const pequena = (f) => { const st = passoDe(f); return Math.max(st, Math.ceil((f.porcao.g * 0.4) / st) * st); };
  const intocaveis = new Set();
  const enxugarProteina = () => {
    for (let k = 0; k < 80 && soma(refs, 'p') > tetoP; k++) {
      let alvo = null;
      for (const r of refs) for (let i = 0; i < r.itens.length; i++) {
        const it = r.itens[i], f = FOOD.get(it.id);
        if (!rica(f.id) || intocaveis.has(r.nome + '/' + f.id)) continue;
        const st = passoDe(f);
        const fora = r.tipo !== 'principal';
        let g;
        if (it.g - st >= pequena(f)) g = it.g - st;
        else if (fora && r.itens.length >= 2) g = 0;                    // no mínimo: sai (o prato fica sempre com a sua fonte de proteína)
        else continue;
        // cede primeiro quem está fora do prato; entre iguais, quem tem mais proteína
        const peso = (fora ? 1000 : 0) + it.p;
        if (!alvo || peso > alvo.peso) alvo = { r, i, g, peso };
      }
      if (!alvo) break;
      const { r, i, g } = alvo;
      const copia = r.itens.slice();
      if (g > 0) r.itens[i] = porcao(r.itens[i].id, g); else r.itens.splice(i, 1);
      refaz(r);
      if (r.kcal < 80) {
        // a refeição ficaria vazia demais: a fruta sobe para a porção inteira; se não bastar, o item fica e não é mais tentado
        const j = r.itens.findIndex((x) => FOOD.get(x.id).papel === 'fruta');
        if (j >= 0 && r.itens[j].g < FOOD.get(r.itens[j].id).porcao.g) { r.itens[j] = porcao(r.itens[j].id, FOOD.get(r.itens[j].id).porcao.g); refaz(r); }
        if (r.kcal < 80) { r.itens = copia; refaz(r); intocaveis.add(r.nome + '/' + copia[i].id); }
      }
    }
  };
  // energia com pouca proteína: a cada passo sobe o item que tem espaço e menos proteína por caloria
  const reporEnergia = () => {
    const espaco = (r, it) => {
      const f = FOOD.get(it.id);
      if (GORD_SET.has(f.id) && r.tipo === 'principal') return [13 - it.g, 5];
      if (f.papel === 'fruta') {
        const unidades = Number((/^(\d+)/.exec(f.porcao.desc) || [0, 1])[1]) || 1;
        return [Math.floor((f.porcao.g * Math.max(1, Math.min(1.5, 10 / unidades))) / 5) * 5 - it.g, Math.max(5, Math.round(f.porcao.g / 2 / 5) * 5)];
      }
      if (CARB_SET.has(f.id)) return [lim(f.id, [50, 300, 10])[1] - it.g, 20];
      if (CAFE_CARBO_SET.has(f.id)) return [lim(f.id, [40, 200, 10])[1] - it.g, 10];
      return [0, 0];
    };
    for (let k = 0; k < 60 && soma(refs, 'kcal') < res.kcal * 0.97; k++) {
      let alvo = null;
      for (const r of refs) for (let i = 0; i < r.itens.length; i++) {
        const [e, passo] = espaco(r, r.itens[i]);
        if (e <= 0) continue;
        const f = FOOD.get(r.itens[i].id), dens = f.p / f.kcal;
        if (!alvo || dens < alvo.dens || (dens === alvo.dens && e > alvo.e)) alvo = { r, i, e, passo, dens };
      }
      if (!alvo) break;
      const it = alvo.r.itens[alvo.i];
      alvo.r.itens[alvo.i] = porcao(it.id, it.g + Math.min(alvo.e, alvo.passo));
      refaz(alvo.r);
    }
    // ainda falta: uma fruta a mais (ou outro complemento de pouca proteína) onde couber
    const leves = (lista) => lista.filter(([id]) => { const f = FOOD.get(id); return f.p / f.kcal < 0.025; });
    for (let k = 0, parou = 0; k < 20 && parou < refs.length && soma(refs, 'kcal') < res.kcal * 0.95; k++) {
      const r = refs[k % refs.length];
      const op = cheia(r) ? null : leves(r.tipo === 'principal' ? EXTRAS_PRATO : EXTRAS_LANCHE).filter(([id]) => cabe(r, id)).sort((a, b) => noDia(a[0]) - noDia(b[0]))[0];
      if (!op) { parou++; continue; }
      parou = 0;
      const f = FOOD.get(op[0]);
      r.itens.push(porcao(op[0], Math.max(Math.round(f.porcao.g / 2 / 5) * 5, Math.min(op[1], Math.round((((res.kcal - soma(refs, 'kcal')) / f.kcal) * 100) / 5) * 5))));
      refaz(r);
    }
  };
  for (let rodada = 0; rodada < 3 && soma(refs, 'p') > tetoP; rodada++) { enxugarProteina(); reporEnergia(); }
  // por fim, o dia não passa de 8% acima das calorias da meta
  if (soma(refs, 'kcal') > res.kcal * 1.08) cortar(res.kcal * 1.05);
}

const PLANO_REF = {
  3: [['cafe', 'Café da manhã', 0.27, 0.3], ['principal', 'Almoço', 0.4, 0.37], ['principal', 'Jantar', 0.33, 0.33]],
  4: [['cafe', 'Café da manhã', 0.24, 0.24], ['principal', 'Almoço', 0.34, 0.32], ['lanche', 'Lanche da tarde', 0.14, 0.14], ['principal', 'Jantar', 0.28, 0.3]],
  5: [['cafe', 'Café da manhã', 0.21, 0.21], ['lanche', 'Lanche da manhã', 0.1, 0.1], ['principal', 'Almoço', 0.31, 0.3], ['lanche', 'Lanche da tarde', 0.13, 0.13], ['principal', 'Jantar', 0.25, 0.26]],
  6: [['cafe', 'Café da manhã', 0.2, 0.2], ['lanche', 'Lanche da manhã', 0.09, 0.1], ['principal', 'Almoço', 0.29, 0.27], ['lanche', 'Lanche da tarde', 0.12, 0.12], ['principal', 'Jantar', 0.23, 0.23], ['ceia', 'Ceia', 0.07, 0.08]],
};

// Gera um dia de exemplo. `semente` troca os alimentos (botão "Outra sugestão").
// Com `emCasa` (lista de ids), o dia é montado só com esses alimentos e `faltas` diz o que faltou (ver faltasDaCasa).
export function cardapio(res, semente = 0, { emCasa = null } = {}) {
  if (!res || res.modo === 'educativo' || !res.kcal) return null;
  const seed = Math.abs(Math.floor(Number(semente))) % 1000000 || 0;
  const ref = PLANO_REF[res.refeicoes] || PLANO_REF[4];
  const ctx = contexto(res, emCasa);
  const usados = new Map();
  const rico = (res.prot * 4) / res.kcal >= 0.26;
  const refs = ref.map(([tipo, nome, fk, fp], i) => refeicao(tipo, nome, res.kcal * fk, res.prot * fp, ctx, seed + i * 2 + (tipo === 'principal' ? i : 0), usados, rico))
    .filter((r) => r.itens.length);
  equilibrar(refs, res, usados, ctx);
  if (res.corrida && res.carb) aproximarCarboidrato(refs, res);
  const dia = { refeicoes: refs.filter((r) => r.itens.length), kcal: soma(refs, 'kcal'), p: soma(refs, 'p'), c: soma(refs, 'c'), g: soma(refs, 'g'), fibra: soma(refs, 'fibra') };
  if (ctx.casa) dia.faltas = faltasDaCasa(res, emCasa, dia);
  return dia;
}
// Quem corre: o dia de exemplo chega perto também da meta de carboidrato. Enquanto faltar carboidrato, sobe um passo o
// arroz, a massa, o pão ou a fruta que ainda tem espaço e, para as calorias não passarem da meta, tira o equivalente dos
// itens de gordura (óleo, castanhas, pasta de amendoim). A proteína não é tocada.
const CAFE_CARBO_SET = new Set(POOL_CASA.cafe_carbo);
function aproximarCarboidrato(refs, res) {
  const falta = () => res.carb * 0.95 - soma(refs, 'c');
  const espaco = (it) => {
    const f = FOOD.get(it.id);
    if (!(CARB_SET.has(f.id) || CAFE_CARBO_SET.has(f.id) || LEGUM_SET.has(f.id) || f.papel === 'fruta')) return 0;
    // com a proteína do dia já acima da meta, o feijão não sobe mais (ele traz proteína junto): o carboidrato vem do resto
    if (LEGUM_SET.has(f.id) && soma(refs, 'p') > res.prot * 1.1) return 0;
    // fruta: até uma porção e meia, sem passar de 10 unidades na medida caseira
    const unidades = Number((/^(\d+)/.exec(f.porcao.desc) || [0, 1])[1]) || 1;
    const mx = f.papel === 'fruta' ? Math.floor((f.porcao.g * Math.max(1, Math.min(1.5, 10 / unidades))) / 5) * 5 : lim(f.id, CARB_SET.has(f.id) ? [50, 300, 10] : LEGUM_SET.has(f.id) ? [50, 200, 10] : [40, 200, 10])[1];
    return mx - it.g;
  };
  for (let k = 0; k < 40 && falta() > 8; k++) {
    // quem tem mais espaço sobe um passo (meia porção de fruta ou 20 g de arroz, massa, pão)
    let alvo = null;
    for (const r of refs) for (let i = 0; i < r.itens.length; i++) { const e = espaco(r.itens[i]); if (e > 0 && (!alvo || e > alvo.e)) alvo = { r, i, e }; }
    if (!alvo) break;
    const it = alvo.r.itens[alvo.i], f = FOOD.get(it.id);
    const passo = Math.min(alvo.e, f.papel === 'fruta' ? Math.max(5, Math.round(f.porcao.g / 2 / 5) * 5) : 20);
    const copia = refs.map((r) => r.itens.slice());
    alvo.r.itens[alvo.i] = porcao(f.id, it.g + passo);
    refaz(alvo.r);
    // as calorias a mais saem dos itens de gordura, do mais calórico para o menos
    for (let j = 0; j < 6 && soma(refs, 'kcal') > res.kcal * 1.03; j++) {
      let gordo = null;
      for (const r of refs) for (let i = 0; i < r.itens.length; i++) { const g = FOOD.get(r.itens[i].id); if (g.papel === 'gordura' && r.kcal - r.itens[i].kcal >= 80 && (!gordo || r.itens[i].kcal > gordo.r.itens[gordo.i].kcal)) gordo = { r, i }; }
      if (!gordo) break;
      const x = gordo.r.itens[gordo.i], fg = FOOD.get(x.id);
      const menos = Math.round((x.g - Math.min(x.g, ((soma(refs, 'kcal') - res.kcal * 1.03) / fg.kcal) * 100 + 2)) / 5) * 5;
      if (menos < fg.porcao.g * 0.4) { if (gordo.r.itens.length <= 2 || gordo.r.kcal - x.kcal < 80) break; gordo.r.itens.splice(gordo.i, 1); } else gordo.r.itens[gordo.i] = porcao(fg.id, menos);
      refaz(gordo.r);
    }
    // se nem assim coube nas calorias, desfaz o passo e para
    if (soma(refs, 'kcal') > res.kcal * 1.05) { refs.forEach((r, i) => { r.itens = copia[i]; refaz(r); }); break; }
  }
}
// Se, mesmo assim, o dia de quem corre ficar mais de 10% abaixo da meta de carboidrato, a tela diz quanto falta e como
// completar com comida comum (respeitando as restrições).
export function faltaDeCarboidrato(res, dia) {
  if (!res || !res.corrida || !res.carb || !dia || !(dia.c < res.carb * 0.9)) return null;
  const falta = r5(res.carb - dia.c);
  const rest = Array.isArray(res.restricoes) ? res.restricoes : [];
  const opcoes = [['banana-prata', 1, 'banana-prata', 'bananas-prata'], ['arroz-branco-cozido', 4, 'colher de sopa de arroz', 'colheres de sopa de arroz'], ['pao-frances', 1, 'pão francês', 'pães franceses']]
    .filter(([id]) => permite(id, rest)).slice(0, 2).map(([id, partes, um, varios]) => {
      const f = FOOD.get(id);
      const n = Math.max(1, Math.round(falta / ((f.c * f.porcao.g) / 100 / partes)));
      return n + ' ' + (n === 1 ? um : varios);
    });
  return `Faltam cerca de ${falta} g de carboidrato para a meta de quem corre: acrescente ${opcoes.join(' ou ')}.`;
}
// O que falta em casa para o dia fechar: grupos sem nenhum alimento marcado e metas que ficaram longe. Para cada falta,
// sugere os dois alimentos mais baratos do grupo (menor custo por 100 g de proteína nas fontes de proteína; por porção nos demais).
const GRUPOS_CASA = [
  ['prot', 'Falta uma fonte de proteína para o almoço e o jantar (carne, frango, peixe, ovos ou soja).'], ['carbo', 'Falta arroz, massa, batata ou mandioca.'], ['legum', 'Falta feijão ou outra leguminosa.'],
  ['fruta', 'Faltam frutas.'], ['salada', 'Falta uma verdura para a salada.'], ['legume', 'Falta um legume.'], ['cafe_prot', 'Faltam ovos, leite, iogurte ou queijo para o café da manhã e os lanches.'], ['cafe_carbo', 'Falta pão, tapioca, aveia ou cuscuz para o café da manhã.'],
];
const DE_PROTEINA = new Set(['prot', 'cafe_prot']);
// até 2 sugestões, da mais barata para a mais cara, respeitando as restrições
function maisBaratos(pool, rest, tem = null) {
  const semCarne = rest.includes('vegano') || rest.includes('vegetariano');
  const custo = (id) => { const f = FOOD.get(id); return DE_PROTEINA.has(pool) ? (10 * f.preco.kg) / Math.max(1, f.p) : f.preco.porcao; };
  const falta = (id) => !tem || !tem.has(id);
  const ok = POOL[pool].filter((id) => permite(id, rest) && (semCarne || !SO_VEG.has(id)) && falta(id));
  return (ok.length ? ok : POOL_CASA[pool].filter((x) => permite(x, rest) && falta(x))).sort((a, b) => custo(a) - custo(b)).slice(0, 2).map((id) => ({ id, nome: FOOD.get(id).nome, faixa: faixa(id) }));
}
export function faltasDaCasa(res, emCasa, dia) {
  const ctx = contexto(res, emCasa);
  const faltas = [];
  for (const [pool, texto] of GRUPOS_CASA) {
    if (servem(pool, ctx).length) continue;
    // verdura e legume valem um pelo outro; sem carne, a leguminosa já é a fonte de proteína
    if ((pool === 'salada' && servem('legume', ctx).length) || (pool === 'legume' && servem('salada', ctx).length)) continue;
    faltas.push({ grupo: pool, texto, sugestoes: maisBaratos(pool, ctx.rest, ctx.casa) });
  }
  const tem = (g) => faltas.some((f) => f.grupo === g);
  if (dia && dia.p < res.prot * 0.85 && !tem('prot') && !tem('cafe_prot')) faltas.push({ grupo: 'proteina', texto: `O dia fecha com ${Math.round(dia.p)} g de proteína (meta ${res.prot} g): faltam fontes de proteína.`, sugestoes: maisBaratos('prot', ctx.rest, ctx.casa) });
  if (dia && dia.kcal < res.kcal * 0.9 && !tem('carbo') && !tem('cafe_carbo')) faltas.push({ grupo: 'energia', texto: `O dia fecha com ${Math.round(dia.kcal / 10) * 10} kcal (meta ${res.kcal}): faltam alimentos de energia.`, sugestoes: maisBaratos('carbo', ctx.rest, ctx.casa) });
  return faltas;
}
// Lista "O que eu tenho em casa" vinda do aparelho ou de um backup: só ids que existem, sem repetir, com limite.
export const MAX_EM_CASA = 400;
export function limparEmCasa(v) {
  const out = [];
  if (!Array.isArray(v)) return out;
  const vistos = new Set();
  for (const id of v) {
    if (typeof id !== 'string' || !FOOD.has(id) || vistos.has(id)) continue;
    vistos.add(id); out.push(id);
    if (out.length >= MAX_EM_CASA) break;
  }
  return out;
}
// assinatura do dia: os alimentos de cada refeição (as quantidades não contam)
export const assinatura = (dia) => (dia ? dia.refeicoes.map((r) => r.itens.map((x) => x.id).join(',')).join('|') : '');
// "Outra sugestão": a próxima semente que dá um dia com alimentos diferentes do atual; null quando não há alternativa
// (acontece com poucos alimentos em casa).
export function proximaSemente(res, semente = 0, opcoes = {}) {
  const atual = assinatura(cardapio(res, semente, opcoes));
  if (!atual) return null;
  const s0 = Math.abs(Math.floor(Number(semente))) % 1000 || 0;
  for (let k = 1; k <= 24; k++) { const s = (s0 + k) % 1000; if (assinatura(cardapio(res, s, opcoes)) !== atual) return s; }
  return null;
}

// ---------- corrida ----------
// Resumo do plano de corrida, validado campo a campo (vem de outro módulo; nada dele vira texto na tela sem passar por aqui).
const numOu = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0);
export function limparCorrida(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const out = { kmSemana: numOu(c.kmSemana, 0, 300), minSemana: numOu(c.minSemana, 0, 3000), sessoesSemana: Math.round(numOu(c.sessoesSemana, 0, 14)), longoMin: numOu(c.longoMin, 0, 600), longoKm: numOu(c.longoKm, 0, 100), prova: null, proxima: null };
  if (!out.kmSemana && !out.minSemana && !out.sessoesSemana) return null;
  const p = c.prova;
  if (p && typeof p === 'object' && numOu(p.distKm, 0, 250) > 0) {
    out.prova = { distKm: numOu(p.distKm, 0, 250), data: typeof p.data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.data) ? p.data.slice(0, 10) : '', semanasAte: numOu(p.semanasAte, 0, 520) };
  }
  const x = c.proximaCorrida;
  if (x && typeof x === 'object' && (numOu(x.durMin, 0, 600) > 0 || numOu(x.distKm, 0, 100) > 0)) out.proxima = { durMin: numOu(x.durMin, 0, 600), distKm: numOu(x.distKm, 0, 100) };
  return out;
}
// gramas de carboidrato por quilo por dia, pela carga de treino (minutos de corrida por semana)
export function faixaCarboidrato(minSemana) {
  const porDia = minSemana / 7;
  return porDia < 30 ? [3, 5] : porDia < 60 ? [5, 7] : porDia < 180 ? [6, 10] : [8, 12];
}
// Carboidrato durante a corrida, pela duração (refs jeukendrup2014 e thomas2016, textos completos): até 45 min,
// nada; de 45 a 75 min, pouco (ou só bochecho); de 75 min a 2 h 30, 30 a 60 g por hora; acima disso, até 90 g por hora,
// misturando glicose e frutose, para quem treinou isso. A recomendação é em gramas por hora, não por quilo.
export function carboidratoNaCorrida(min, semNumeros = false) {
  if (!(min > 45)) return { gHora: null, texto: 'Não precisa de carboidrato durante: água, se tiver sede.' };
  if (min <= 75) return { gHora: null, texto: 'Carboidrato é opcional: um gole de bebida esportiva (até só bochechar) já ajuda em ritmo forte.' };
  // modo educativo (menores, gestantes, doença renal, transtorno alimentar): sem gramas
  if (semNumeros) return { gHora: null, texto: 'Leve carboidrato de fácil digestão (banana, bananada ou gel) e coma um pouco a cada 30 a 40 minutos.' };
  if (min <= 150) return { gHora: [30, 60], texto: '30 a 60 g de carboidrato por hora, a partir dos 30 a 45 minutos.' };
  return { gHora: [60, 90], texto: '60 g de carboidrato por hora; até 90 g se você treinou o estômago e mistura fontes (glicose com frutose).' };
}
// o que dá 30 g de carboidrato, com comida comum (valores de data/foods.js) — alternativas baratas ao gel
const LANCHES_DE_CORRIDA = [['banana-prata', 'bananas-prata'], ['bananada', 'bananadas'], ['rapadura', 'pedaços pequenos de rapadura'], ['goiabada', 'fatias de goiabada'], ['mel', 'colheres de sopa de mel']];
function trintaGramas() {
  return LANCHES_DE_CORRIDA.filter(([id]) => FOOD.has(id)).map(([id, nome]) => {
    const f = FOOD.get(id);
    const n = Math.max(1, Math.round((30 / ((f.c * f.porcao.g) / 100)) * 2) / 2);
    return String(n).replace('.', ',') + ' ' + nome;
  });
}
// um gel tem de 20 a 30 g de carboidrato (Australian Institute of Sport, ficha "Sports gels" — ref ais_gel): a conta usa o meio
const GEL_G = 25;
const DISTANCIAS = [[5.5, '5 km'], [11, '10 km'], [22, 'meia maratona'], [43, 'maratona'], [Infinity, 'ultramaratona']];
// Orientação de alimentação para quem corre. `res` vem de calcular(respostas, corrida); devolve null sem plano de corrida.
// Fontes: posição conjunta DC/AND/ACSM 2016 (texto integral: Tabela 2, hidratação e sódio), Burke 2011, Jeukendrup 2014,
// ACSM/ADA/DC 2009, Hew-Butler 2017, ISSN (cafeína, 2021) — ver data/knowledge.js. Da posição de 2016: antes, 1 a 4 g/kg de
// carboidrato de 1 a 4 h antes; durante, nada até 45 min, pouco de 45 a 75 min, 30 a 60 g/h de 1 a 2 h 30 e até 90 g/h
// acima disso; carga de 10 a 12 g/kg por dia nas 36 a 48 h antes de provas de mais de 90 min; reposição rápida de 1 a
// 1,2 g/kg por hora nas 4 primeiras horas; líquido de 0,4 a 0,8 L por hora para a maioria, sódio acima de 2 h ou com muito
// suor, e 1,25 a 1,5 L para cada quilo perdido.
export function orientacaoCorrida(res, hoje = new Date()) {
  const cor = res && res.corrida;
  if (!cor) return null;
  const semNumeros = res.modo === 'educativo';
  const cond = Array.isArray(res.condicoes) ? res.condicoes : [];
  const peso = Number.isFinite(res.pesoRef) ? res.pesoRef : 70;
  const dec1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const ritmo = Math.min(12, Math.max(3, cor.longoKm > 0 && cor.longoMin > 0 ? cor.longoMin / cor.longoKm : cor.proxima && cor.proxima.distKm > 0 && cor.proxima.durMin > 0 ? cor.proxima.durMin / cor.proxima.distKm : 6.5));
  const longo = cor.longoMin || (cor.longoKm ? cor.longoKm * ritmo : 0);
  const lanches = trintaGramas();
  // Bebida caseira na concentração das esportivas (ficha "Sports drinks" do Australian Institute of Sport, lida inteira —
  // ref ais_bebida): 6 a 8% de carboidrato (60 g de açúcar por litro) e, nas bebidas comuns, de 0,46 a 0,92 g de sódio
  // por litro (20 a 40 mmol/L). 1,5 g de sal — um quarto de colher de chá — dão 0,6 g de sódio.
  const caseira = 'Bebida caseira: 1 litro de água, 4 colheres de sopa de açúcar (60 g), um quarto de colher de chá de sal (1,5 g) e suco de 1 limão.';
  const blocos = [];
  // dia a dia
  const diaADia = [`Você corre cerca de ${Math.round(cor.kmSemana)} km por semana${cor.sessoesSemana ? ' em ' + cor.sessoesSemana + (cor.sessoesSemana === 1 ? ' treino' : ' treinos') : ''}.`];
  if (!semNumeros && cor.faixaCarb) {
    diaADia.push(`Para esse volume, o carboidrato do dia fica entre ${cor.faixaCarb[0]} e ${cor.faixaCarb[1]} g por quilo. A sua meta dá ${dec1(cor.carbKg)} g por quilo${cor.carbKg >= cor.faixaCarb[0] ? '' : (res.objetivoCalc === 'emagrecer' ? ': fica abaixo por causa da redução de calorias' : ': fica abaixo porque, tirando a proteína e o mínimo de gordura, as calorias da meta não comportam mais') + '; nos dias de treino longo, concentre o carboidrato antes e depois da corrida'}.`);
    if (cor.kcalDia) diaADia.push(`A corrida gasta perto de ${cor.kcalDia} kcal por dia, na média da semana. Isso já está na sua meta de calorias.`);
  }
  blocos.push({ titulo: 'No dia a dia', linhas: diaADia });
  // antes, durante e depois do treino mais longo da semana
  const durante = carboidratoNaCorrida(longo, semNumeros);
  const antes = [semNumeros ? 'Refeição com carboidrato e pouca gordura e fibra, de 1 a 4 horas antes.' : `Refeição com carboidrato (${Math.round(peso)} a ${Math.round(peso * 2)} g) e pouca gordura e fibra, de 1 a 4 horas antes: quanto mais perto da corrida, menor.`,
    cond.includes('diabetes') ? 'Com diabetes, não corra em jejum, leve sempre um carboidrato de ação rápida e combine o plano de alimentação com o seu médico.' : 'Corrida leve de até 1 hora logo cedo pode ser em jejum, se você se sente bem.'];
  if (semNumeros) antes.pop();
  const linhasDurante = [longo ? `No treino mais longo da semana (cerca de ${Math.round(longo)} min): ${durante.texto.charAt(0).toLowerCase() + durante.texto.slice(1)}` : durante.texto];
  if (durante.gHora && lanches.length) linhasDurante.push(`Um gel tem de 20 a 30 g de carboidrato. Mais barato, 30 g são ${lanches.slice(0, 3).join(', ')}.`);
  linhasDurante.push('Água: beba conforme a sede, sem forçar. Beber além da sede dilui o sódio do sangue (hiponatremia); se você termina a corrida mais pesado do que começou, bebeu demais.');
  if (longo > 120 && !semNumeros) linhasDurante.push('Acima de 2 horas ou com muito calor, use também bebida com sódio (as esportivas têm de 0,5 a 0,9 g por litro). ' + caseira + (cond.includes('hipertensao') ? ' Com pressão alta, combine o uso de sal com o seu médico.' : ''));
  const depois = [semNumeros ? 'Coma uma refeição com carboidrato e proteína nas 2 horas seguintes.' : `Refeição com carboidrato e ${Math.round(Math.min(40, Math.max(20, peso * 0.3)) / 5) * 5} g de proteína nas 2 horas seguintes.`,
    'Se for treinar de novo em menos de 8 horas, reponha o carboidrato logo: de 1 a 1,2 g por quilo por hora nas primeiras 4 horas.',
    'Reponha o líquido aos poucos: para cada quilo perdido na corrida, cerca de 1 litro e meio.'];
  if (semNumeros) depois.splice(1, 1);
  blocos.push({ titulo: 'Antes de correr', linhas: antes }, { titulo: 'Durante a corrida', linhas: linhasDurante }, { titulo: 'Depois', linhas: depois });
  // cafeína, com as ressalvas de segurança (EFSA 2015; ISSN 2021)
  if (!semNumeros && !cond.includes('hipertensao')) blocos.push({ titulo: 'Cafeína', linhas: [`Ajuda em provas e treinos fortes: cerca de 3 mg por quilo, sem passar de 200 mg por vez, 1 hora antes. Teste antes em treino; evite à noite e não use se tiver arritmia ou ansiedade.`] });
  // prova marcada
  let prova = null;
  if (cor.prova) {
    const d = cor.prova.data ? new Date(cor.prova.data + 'T12:00:00') : null;
    const dias = d && !Number.isNaN(d.getTime()) && hoje instanceof Date && !Number.isNaN(hoje.getTime()) ? Math.round((d - hoje) / 86400000) : Math.round(cor.prova.semanasAte * 7);
    const nome = DISTANCIAS.find(([km]) => cor.prova.distKm <= km)[1];
    const minProva = cor.prova.distKm * ritmo;
    // com diabetes, o exercício pede ajuste da dose de insulina e do carboidrato para evitar hipoglicemia (ref scott2019,
    // texto completo); mexer por conta própria no carboidrato da véspera e da prova é arriscado:
    // o bloco da prova não traz gramas e manda combinar o plano com o médico ou nutricionista
    const diabetes = cond.includes('diabetes');
    const semGramas = semNumeros || diabetes;
    const naProva = carboidratoNaCorrida(minProva, semGramas);
    const linhas = [];
    linhas.push(dias < 0 ? 'A prova já passou. Marque a próxima no Treinador para atualizar este plano.' : dias === 0 ? 'A prova é hoje.' : dias === 1 ? 'A prova é amanhã.' : dias <= 13 ? `Faltam ${dias} dias para a prova.` : `Faltam cerca de ${Math.round(dias / 7)} semanas. Use os treinos longos para testar o café da manhã, o que comer e o que beber na prova.`);
    linhas.push(minProva > 90
      ? (diabetes ? 'Com diabetes, não faça carga de carboidrato por conta própria: ela muda a glicemia e a dose dos remédios. Combine a alimentação da véspera e da prova com seu médico ou nutricionista.'
        : semNumeros ? 'Nos 2 dias antes, aumente o carboidrato (arroz, massa, batata, pão, frutas) e treine menos.' : `Carga de carboidrato: nas 36 a 48 horas antes, de 10 a 12 g por quilo por dia (${r10(peso * 10)} a ${r10(peso * 12)} g), com menos treino. Arroz, massa, batata, pão e frutas; pouca gordura e fibra.`)
      : 'Prova de menos de 90 minutos não pede carga de carboidrato: na véspera, coma normalmente, com carboidrato em todas as refeições.');
    linhas.push('Na véspera e no dia: nada novo. Evite muita fibra, gordura, fritura, álcool e comida que você não conhece.');
    linhas.push(semGramas ? 'Café da manhã da prova: de 2 a 3 horas antes, com carboidrato de fácil digestão (pão, banana, tapioca) e pouca gordura.' : `Café da manhã da prova: de 2 a 3 horas antes, com ${Math.round(peso)} a ${Math.round(peso * 2)} g de carboidrato de fácil digestão (pão, banana, tapioca, mel) e pouca gordura e fibra.`);
    linhas.push(`Durante (${nome}, perto de ${fmtDuracao(minProva)} no seu ritmo): ${naProva.texto.charAt(0).toLowerCase() + naProva.texto.slice(1)}`);
    if (naProva.gHora) {
      const de = r5((naProva.gHora[0] * minProva) / 60), ate = r5((naProva.gHora[1] * minProva) / 60);
      const nDe = Math.max(1, Math.ceil(de / GEL_G)), nAte = Math.max(nDe, Math.floor(ate / GEL_G));
      linhas.push(`No total, de ${de} a ${ate} g: por exemplo, ${nAte === 1 ? '1 gel' : (nDe === nAte ? nDe : nDe + ' a ' + nAte) + ' géis'} de ${GEL_G} g, ou bananas e bananada. Leve o que você já testou.`);
    }
    linhas.push(minProva > 120
      ? 'Líquido: beba conforme a sede em cada posto, alternando água e bebida esportiva. Para a maioria isso dá de 400 a 800 mL por hora; mais de 1 litro por hora passa do que os rins eliminam.'
      : 'Líquido: água conforme a sede. Em prova curta, um ou dois goles por posto bastam.');
    prova = { titulo: `Sua prova: ${nome}`, dias, minutos: Math.round(minProva), linhas };
  }
  // "mais de 1 litro por hora": os rins eliminam no máximo de 0,7 a 1,0 L por hora (efsa2017; hewbutler2017)
  return { semNumeros, blocos, prova, refs: ['thomas2016', 'jeukendrup2014', 'ais_gel', 'ais_bebida', 'hewbutler2017', 'efsa2017', 'guest2021'] };
}
export const fmtDuracao = (min) => { const m = Math.round(min / 5) * 5; return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''); };

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
  // no modo educativo (menores, gestação e amamentação, doença renal...) não há dose de água: só a sede como guia
  const aguaPre = res.modo === 'educativo' ? null : Array.isArray(res.aguaPre) ? res.aguaPre : [350, 700];
  return {
    carbPre, protPos, pre, pos, horario, semNumeros: res.modo === 'educativo',
    agua: aguaPre ? `Água: ${aguaPre[0]} a ${aguaPre[1]} mL nas 2 a 4 horas antes do treino, e mais durante e depois.`
      : cond.includes('renal') ? 'Água: com doença nos rins, a quantidade de líquidos é a que o seu médico indicar.' : 'Água: beba conforme a sede antes, durante e depois do treino; no calor, você precisa de mais.',
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

// Suplementos: doses só para quem pode usá-las sem orientação. Menores de 18, gestantes e lactantes, doença renal e
// transtorno alimentar (modo educativo) não veem dose nenhuma; com pressão alta, a de cafeína não aparece.
// Creatina: segura em adultos saudáveis; com doença renal, só com o médico (ISSN 2017 — ref kreider2017). Cafeína: até
// 200 mg por vez e 400 mg por dia em adultos; gestantes, até 200 mg por dia de todas as fontes; para menores não há
// dose de suplemento (resumo oficial da EFSA, de 2015, lido inteiro — ref efsa2015; ISSN 2021 — ref guest2021).
export function suplementos(res) {
  const cond = res && Array.isArray(res.condicoes) ? res.condicoes : [];
  const aviso = 'Não use sem orientação médica se você está grávida ou amamentando, tem menos de 18 anos, doença nos rins ou no fígado, pressão alta ou arritmia, ou usa remédios de uso contínuo. Este aplicativo não prescreve suplementos.';
  if (!res || res.modo === 'educativo') {
    return { semDoses: true, intro: 'Suplemento não é obrigatório: comida de verdade resolve.', linhas: [],
      aviso: 'No seu caso não mostro doses. Antes dos 18 anos, na gestação e na amamentação, com doença nos rins ou com transtorno alimentar, creatina, cafeína e proteína em pó só com orientação do seu médico ou nutricionista.' };
  }
  const linhas = ['Creatina monoidratada: 3 a 5 g por dia, todos os dias. Melhora força e ganho de massa.'];
  linhas.push(cond.includes('hipertensao')
    ? 'Cafeína: com pressão alta, não use como suplemento.'
    : 'Cafeína: cerca de 3 mg por quilo de peso (até 200 mg por vez), 1 hora antes do treino, sem passar de 400 mg por dia. Evite à noite.');
  linhas.push('Whey protein: só uma forma prática de proteína; conta na meta do dia.');
  return { semDoses: false, intro: 'Suplemento não é obrigatório. Os que têm boa evidência para quem treina são:', linhas, aviso };
}

// Textos sobre o peso na tela de metas, montados num lugar só para não se contradizerem: a perda por semana sai do
// déficit real (sem déficit, não aparece); "reduza de 100 a 200 kcal" só aparece se a meta ainda puder baixar.
export function textosDoPeso(r) {
  const out = { ritmo: null, linhas: [] };
  if (!r || r.modo === 'educativo') return out;
  const dec = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const mil = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (r.objetivoCalc === 'emagrecer') {
    if (r.perdaSemana) {
      out.ritmo = `Com ${mil(r.deficit)} kcal a menos por dia, a perda esperada é de cerca de ${r.perdaSemana < 0.15 ? Math.round(r.perdaSemana * 100) * 10 + ' g' : dec(r.perdaSemana) + ' kg'} por semana.`;
      out.linhas.push(`A perda por semana é uma estimativa: cada 7.700 kcal a menos equivalem a cerca de 1 kg. Se perder mais de ${dec(r.perdaMax)} kg por semana (1% do peso), coma um pouco mais.`);
      out.linhas.push(r.kcal - 100 >= r.piso
        ? `Se o peso não mudar em 3 semanas, reduza de 100 a 200 kcal, sem ficar abaixo de ${mil(r.piso)} kcal.`
        : `Sua meta já está no mínimo de ${mil(r.piso)} kcal: se o peso não mudar em 3 semanas, aumente a atividade física em vez de comer menos.`);
    } else out.linhas.push('A meta está no nível do seu gasto: comendo isso, o peso tende a ficar estável.');
  } else if (r.objetivoCalc === 'ganhar' && r.ritmo) {
    out.ritmo = `Ritmo esperado: ganhar de ${dec(r.ritmo[0])} a ${dec(r.ritmo[1])} kg por semana.`;
    out.linhas.push('Ganhar mais rápido que o ritmo esperado costuma ser gordura. Se o peso não subir em 3 semanas, aumente de 100 a 200 kcal.');
  }
  return out;
}

// Nutricionista virtual: entrevista + cálculos baseados em diretrizes publicadas (Mifflin-St Jeor 1990,
// ISSN 2017, Morton 2018, Helms 2014, Iraki 2019, AHA/ACC/TOS 2013, OMS, Guia Alimentar 2014 — ver data/knowledge.js).
// Também: preferência por alimentos mais baratos (faixas de preço em data/foods.js), cardápio com o que há em casa e
// alimentação para corrida (resumo vindo de logic/corrida.js).
// Orientação educativa: não é prescrição dietética e não substitui consulta com nutricionista.
import { ALIMENTOS, CATEGORIAS_ALIMENTO, rendimentoDeCompra, temAlergeno, NOME_ALERGIA, MEDIDAS } from '../data/foods.js';
import { uniaoSaude } from './saude.js';

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
  // `informar`: o valor de partida não vale como resposta — a pessoa ajusta ou confirma (ver views/coach.js)
  { k: 'idade', tipo: 'numero', informar: true, titulo: 'Quantos anos você tem?', min: 10, max: 99, un: 'anos', padrao: 30 },
  { k: 'peso', tipo: 'numero', informar: true, titulo: 'Qual é o seu peso atual?', min: 30, max: 250, un: 'kg', padrao: 70, passo: 0.5, dec: 1 },
  { k: 'altura', tipo: 'numero', informar: true, titulo: 'Qual é a sua altura?', ajuda: 'Em centímetros.', min: 120, max: 220, un: 'cm', padrao: 170 },
  {
    k: 'atividade', tipo: 'um', titulo: 'Como é o seu dia a dia, fora os treinos?',
    op: [['sedentario', 'Fico sentado a maior parte do dia', ''], ['leve', 'Fico em pé ou caminho parte do dia', ''], ['moderado', 'Trabalho em movimento na maior parte do dia', ''], ['intenso', 'Faço trabalho braçal pesado', '']],
  },
  { k: 'treinos', tipo: 'um', titulo: 'Quantos dias por semana você treina?', op: [['0', 'Ainda não treino', ''], ['2', '1 a 2 dias', ''], ['3', '3 dias', ''], ['4', '4 a 5 dias', ''], ['6', '6 a 7 dias', '']] },
  // só para quem treina (quem ainda não treina recebe a regra geral, como em "Varia")
  {
    k: 'horario', tipo: 'um', se: (a) => a.treinos !== '0', titulo: 'Em que horário você costuma treinar?',
    op: [['cedo', 'Bem cedo, logo ao acordar', ''], ['manha', 'De manhã', ''], ['tarde', 'À tarde', ''], ['noite', 'À noite', ''], ['varia', 'Varia', '']],
  },
  { k: 'refeicoes', tipo: 'um', titulo: 'Quantas refeições você prefere fazer por dia?', op: [['3', '3 refeições', ''], ['4', '4 refeições', ''], ['5', '5 refeições', ''], ['6', '6 refeições', '']] },
  {
    k: 'restricoes', tipo: 'varios', titulo: 'Você tem alguma restrição alimentar?', nenhum: 'nenhuma',
    inclui: { vegano: ['vegetariano'] }, // quem é vegano já não come carne nem peixe: marcar os dois é a mesma coisa
    op: [['vegetariano', 'Vegetariano', 'Não como carnes nem peixes'], ['vegano', 'Vegano', 'Nenhum alimento de origem animal'], ['sem_lactose', 'Intolerância à lactose', ''], ['sem_gluten', 'Doença celíaca / sem glúten', ''], ['nenhuma', 'Nenhuma', '']],
  },
  // Alergia alimentar: cada uma tira do cardápio, das trocas e das sugestões os alimentos que costumam ter aquilo
  // (data/foods.js → ALERGENICOS). Opcional: respostas salvas antes desta pergunta valem como "nenhuma". Os grupos são os
  // da lista oficial de alergênicos da Anvisa (ref anvisa_alergenicos), em palavras do dia a dia.
  {
    k: 'alergias', tipo: 'varios', opcional: true, titulo: 'Você tem alergia a algum destes alimentos?', ajuda: 'Eu tiro do cardápio os alimentos que costumam ter isso. Mesmo assim, leia sempre o rótulo.', nenhum: 'nenhuma',
    op: [['amendoim', 'Amendoim', ''], ['castanhas', 'Castanhas e nozes', 'Castanha-de-caju, castanha-do-pará, amêndoa, nozes, avelã...'], ['peixe', 'Peixes e frutos do mar', 'Inclui camarão e outros crustáceos'], ['ovo', 'Ovo', ''], ['leite', 'Leite', 'Alergia à proteína do leite (não é a intolerância à lactose)'], ['soja', 'Soja', ''], ['nenhuma', 'Nenhuma', '']],
  },
  {
    k: 'condicoes', tipo: 'varios', titulo: 'Alguma destas situações se aplica a você?', ajuda: 'Algumas pedem acompanhamento profissional antes de mudar a alimentação.', nenhum: 'nenhuma',
    op: [['diabetes', 'Diabetes', ''], ['hipertensao', 'Pressão alta', ''], ['cardiaco', 'Coração, circulação ou AVC', 'Doença do coração, das artérias ou das veias, ou AVC'], ['renal', 'Doença nos rins', ''], ['gestante', 'Gestação ou amamentação', ''], ['transtorno', 'Tenho ou já tive transtorno alimentar', ''], ['outra', 'Outra doença crônica', ''], ['nenhuma', 'Nenhuma', '']],
  },
];

export const ROTULO = { objetivo: { emagrecer: 'Emagrecer', ganhar: 'Ganhar massa muscular', manter: 'Manter o peso e ter mais saúde' } };

export function respostasCompletas(a) {
  return PERGUNTAS.every((q) => {
    const v = a[q.k];
    if (v == null && (q.opcional || (q.se && !q.se(a)))) return true;
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
// (também: doença do coração, outra doença crônica e qualquer sinal da triagem de saúde — eles tiram a dose de cafeína:
// ver suplementos)
const COND_DE_FORA = { gestante: 'gestação', posparto: 'pós-parto', renal: 'doença nos rins', diabetes: 'diabetes', hipertensao: 'pressão alta', cardiaco: 'doença do coração, da circulação ou AVC', transtorno: 'transtorno alimentar', outra: 'outra doença crônica', sinal: 'um sinal de alerta de saúde (como dor no peito, falta de ar ou tontura)' };
const proprio = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const idadeValida = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 130;
// As condições, os sinais da triagem e os remédios vêm da união das entrevistas (logic/saude.js), com os nomes daqui:
// "outra doença crônica" do Treinador vira "outra"; qualquer sinal da triagem vira "sinal"; insulina ou remédio que baixa
// o açúcar vira "diabetes".
// transtorno alimentar informado a um treinador vale como o daqui: modo educativo, sem números
const PARA_NUTRI = { gestante: 'gestante', posparto: 'posparto', renal: 'renal', diabetes: 'diabetes', hipertensao: 'hipertensao', cardiaco: 'cardiaco', transtorno: 'transtorno', cronica: 'outra' };
export function contextoDasEntrevistas(st) {
  const s = st && typeof st === 'object' && !Array.isArray(st) ? st : {};
  const resp = (o) => (o && typeof o === 'object' && o.answers && typeof o.answers === 'object' && !Array.isArray(o.answers) ? o.answers : {});
  const out = { idades: [], condicoes: [] };
  for (const [origem, a] of [['treinador', resp(s.trainer)], ['corrida', resp(s.run)]]) if (idadeValida(a.idade)) out.idades.push({ valor: Math.floor(a.idade), origem });
  for (const x of uniaoSaude(s).itens) {
    if (x.origem !== 'treinador' && x.origem !== 'corrida') continue;
    const id = x.tipo === 'sinal' ? 'sinal' : x.tipo === 'condicao' ? PARA_NUTRI[x.id] : x.tipo === 'remedio' && x.id === 'glicose' ? 'diabetes' : '';
    if (proprio(COND_DE_FORA, id) && !out.condicoes.some((y) => y.id === id)) out.condicoes.push({ id, origem: x.origem });
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
  // alergia alimentar: o aviso de ler os rótulos (RDC 26/2015, mantida na RDC 727/2022 — ref anvisa_alergenicos: os
  // embalados trazem "ALÉRGICOS: CONTÉM" ou "PODE CONTER" logo depois dos ingredientes; a granel e em restaurante, não)
  const alergias = alergiasDe({ alergias: lista(a.alergias) });
  if (alergias.length) avisos.push({ tipo: 'warn', alergia: true, texto: `Alergia a ${alergias.map((x) => NOME_ALERGIA[x]).join(', ').replace(/, ([^,]*)$/, ' e $1')}: tirei do cardápio de exemplo, das trocas e das sugestões os alimentos que costumam ter isso, inclusive pratos prontos. Leia sempre o rótulo: nos alimentos embalados, procure o aviso “ALÉRGICOS: CONTÉM” ou “PODE CONTER”, logo depois dos ingredientes. Comida a granel ou de restaurante não traz esse aviso: pergunte como foi feita.${alergias.includes('leite') ? ' Leite e derivados “sem lactose” continuam tendo a proteína do leite: não servem para quem tem alergia.' : ''}` });
  // (com vegano o cardápio já não tem leite: o aviso da lactose seria repetido; com alergia ao leite, a dica das versões
  // sem lactose seria perigosa)
  if (rest.includes('sem_lactose') && !rest.includes('vegano') && !alergias.includes('leite')) avisos.push({ tipo: 'info', texto: 'Intolerância à lactose: o cardápio de exemplo não usa leite, iogurte nem queijo comuns. Se quiser, inclua as versões sem lactose desses alimentos.' });

  // quem ainda não treina não tem horário de treino (a pergunta nem aparece): vale a regra geral
  const out = { modo, imc, baixoPeso, tmb: r10(tmb), gasto: r10(gasto), fator: Math.round((gasto / tmb) * 1000) / 1000, pesoRef, avisos, restricoes: rest, alergias, condicoes: cond, peso, treina, objetivo, refeicoes: [3, 4, 5, 6].includes(Number(a.refeicoes)) ? Number(a.refeicoes) : 4, horario: String(a.treinos) === '0' ? 'varia' : a.horario || 'varia', sexo, idade };
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
  cafe_carbo: ['pao-frances', 'tapioca-pronta', 'aveia-em-flocos', 'cuscuz-de-milho-cozido', 'pao-de-forma-integral'],
  cafe_prot: ['ovo-cozido', 'queijo-minas-frescal', 'iogurte-natural', 'queijo-cottage', 'ricota', 'leite-integral', 'queijo-mucarela', 'tofu', 'pasta-de-amendoim', 'leite-de-soja'],
  fruta: ['banana-prata', 'mamao-papaia', 'maca-fuji', 'laranja-pera', 'abacaxi', 'melancia', 'manga-palmer', 'morango', 'goiaba-vermelha', 'pera-williams', 'tangerina-ponca', 'uva-italia', 'melao', 'kiwi'],
  carbo: ['arroz-branco-cozido', 'arroz-integral-cozido', 'batata-inglesa-cozida', 'macarrao-cozido', 'mandioca-cozida', 'batata-doce-cozida', 'quinoa-cozida', 'inhame-cozido'],
  legum: ['feijao-carioca-cozido', 'feijao-preto-cozido', 'lentilha-cozida', 'grao-de-bico-cozido'],
  prot: ['peito-de-frango-grelhado', 'patinho-grelhado', 'tilapia-grelhada', 'carne-moida-cozida', 'sobrecoxa-de-frango-assada-sem-pele', 'merluza-assada', 'lombo-suino-assado', 'sardinha-assada', 'coxao-mole-cozido', 'ovo-cozido', 'tofu', 'soja-cozida', 'proteina-de-soja-preparada', 'proteina-de-soja-texturizada'],
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
  cafe_carbo: ['pao-de-forma', 'torrada', 'granola', 'biscoito-cream-cracker', 'cereal-matinal-de-milho', 'pao-de-queijo-assado', 'bolo-de-milho', 'canjica-com-leite', 'pamonha', 'milho-verde-espiga', 'batata-doce-cozida', 'mandioca-cozida', 'inhame-cozido', 'cara-cozido', 'banana-da-terra', 'biscoito-maisena', 'biscoito-de-polvilho', 'bolo-de-chocolate', 'biscoito-recheado'],
  cafe_prot: [...LEITES, ...QUEIJOS, ...FRIOS, 'ovo-frito', 'omelete-de-queijo', 'clara-de-ovo-cozida', 'ovo-de-codorna', 'whey-protein', 'amendoim-torrado-salgado'],
  fruta: doPapel('fruta', ['limao-tahiti']),
  carbo: ['batata-inglesa-assada', 'mandioquinha-cozida', 'cuscuz-de-milho-cozido', 'cara-cozido', 'polenta-cozida', 'milho-verde-espiga', 'milho-verde-enlatado', 'nhoque-de-batata-cozido', 'lasanha-massa-cozida', 'macarrao-a-bolonhesa', 'baiao-de-dois', 'batata-saute', 'pinhao-cozido', 'banana-da-terra', 'farinha-de-mandioca-torrada', 'pao-frances', 'batata-inglesa-frita', 'mandioca-frita', 'macarrao-instantaneo'],
  legum: ['ervilha-enlatada', 'ervilha-fresca', 'feijao-fradinho-cozido', 'feijao-roxo-cozido', 'feijao-jalo-cozido', 'feijao-tropeiro', 'feijoada'],
  prot: [...ALIMENTOS.filter((f) => (f.cat === 'carnes' || f.cat === 'peixes') && f.papel === 'proteina' && !FRIOS.includes(f.id)).map((f) => f.id), ...OVOS_E_SOJA],
  salada: CRUS,
  legume: doPapel('vegetal', [...CRUS, 'molho-de-tomate', 'cebola-crua']),
  // (o amendoim cru não entra nas sugestões: ele vai torrado ou cozido antes de comer; fica só para o diário)
  lanche_prot: [...LEITES, ...QUEIJOS, ...FRIOS, 'ovo-de-codorna', 'whey-protein'],
  lanche_extra: ['granola', 'linhaca', 'gergelim', 'amendoim-torrado-salgado', 'coco-cru', 'pacoca', 'pe-de-moleque', 'chocolate-amargo-70'],
  ceia: [...LEITES, ...QUEIJOS, 'ovo-de-codorna', 'whey-protein'],
  gordura: ['oleo-de-girassol', 'oleo-de-milho', 'oleo-de-canola', 'manteiga-com-sal', 'margarina-com-sal'],
};
const POOL_CASA = Object.fromEntries(Object.keys(POOL).map((k) => [k, [...new Set([...POOL[k], ...(MAIS_CASA[k] || [])])].filter((id) => FOOD.has(id))]));
// itens por refeição, no máximo (com meta alta, de mais de 900 kcal por refeição, 2 a mais)
// (o prato aceita 9: arroz, feijão, carne, salada, legume, óleo e até três complementos — farofa, sobremesa, suco —, já
// que as porções não passam do máximo de referência)
const MAX_ITENS = { principal: 9, cafe: 7, lanche: 5, ceia: 4 };

// alimentos de soja que só entram quando a pessoa não come carne ou não pode com lactose (para o exemplo ficar com cara de dia a dia)
const SO_VEG = new Set(['tofu', 'soja-cozida', 'proteina-de-soja-texturizada', 'proteina-de-soja-preparada', 'leite-de-soja']);
// etiquetas que o alimento precisa ter para respeitar as restrições (todas são obrigatórias, sem exceção)
function etiquetas(rest) {
  const need = [];
  if (rest.includes('vegano')) need.push('vegano');
  else if (rest.includes('vegetariano')) need.push('vegetariano');
  if (rest.includes('sem_gluten')) need.push('sem_gluten');
  if (rest.includes('sem_lactose')) need.push('sem_lactose');
  return need;
}
// Alergias alimentares (res.alergias) andam junto com as restrições, como 'alergia:amendoim': nenhum alimento com o
// alergênico entra no cardápio, nas trocas nem nas sugestões (data/foods.js → temAlergeno).
const ALERGIAS_VALIDAS = new Set(['amendoim', 'castanhas', 'peixe', 'ovo', 'leite', 'soja']);
const alergiasDe = (res) => (res && Array.isArray(res.alergias) ? res.alergias.filter((x) => ALERGIAS_VALIDAS.has(x)) : []);
const restricoesDe = (res) => [...(res && Array.isArray(res.restricoes) ? res.restricoes : []), ...alergiasDe(res).map((x) => 'alergia:' + x)];
const alergiasDoRest = (rest) => rest.filter((x) => typeof x === 'string' && x.startsWith('alergia:')).map((x) => x.slice(8));
// (alimentos `soDiario` — refrigerantes, salgados, bebidas com açúcar — nunca entram no cardápio, nas trocas nem nas sugestões)
const permite = (id, rest) => { const f = FOOD.get(id); const need = etiquetas(rest); return !!f && !f.soDiario && need.every((t) => f.tags.includes(t)) && !temAlergeno(id, alergiasDoRest(rest)); };
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
  const rest = restricoesDe(res);
  const casa = Array.isArray(emCasa) ? new Set(emCasa.filter((id) => FOOD.has(id))) : null;
  const barato = !casa && res.preco === 'barato';                // com a lista de casa, o preço não entra: a comida já está comprada
  const pode = (id) => permite(id, rest) && (!casa || casa.has(id));
  const filtra = (lista, min) => (barato ? economicos(lista, min) : lista);
  const semCarne = rest.includes('vegano') || rest.includes('vegetariano');
  return { rest, casa, barato, pode, filtra, semCarne, sojaLeve: semCarne || rest.includes('sem_lactose') || rest.includes('alergia:leite') };
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
// (no cardápio, a medida caseira é a da tabela do IBGE, quando existe — data/foods.js, MEDIDAS; o peso sai em gramas inteiros)
function porcao(id, g0) {
  const f = FOOD.get(id), g = Math.round(g0), m = MEDIDAS[id];
  return { id, nome: f.nome, g, faixa: f.preco.faixa, kcal: (f.kcal * g) / 100, p: (f.p * g) / 100, c: (f.c * g) / 100, gd: (f.g * g) / 100, fibra: (f.fibra * g) / 100, medida: medida(m ? { porcao: { g: m[0], desc: m[1] } } : f, g) };
}
// medida caseira aproximada: "200 g (4 unidades)", "150 g (3 colheres de sopa cheias)"
const PLURAL = { ponta: 'pontas', americano: 'americanos', pacote: 'pacotes', espiga: 'espigas', posta: 'postas', unidade: 'unidades', fatia: 'fatias', colher: 'colheres', pegador: 'pegadores', 'xícara': 'xícaras', escumadeira: 'escumadeiras', 'pedaço': 'pedaços', concha: 'conchas', 'filé': 'filés', bife: 'bifes', gomo: 'gomos', copo: 'copos', pote: 'potes', cacho: 'cachos', 'sachê': 'sachês', pires: 'pires', punhado: 'punhados', lata: 'latas', garrafa: 'garrafas', dosador: 'dosadores', barra: 'barras', folha: 'folhas', ramo: 'ramos', 'média': 'médias', 'médio': 'médios', grossa: 'grossas', pequena: 'pequenas', pequeno: 'pequenos', grande: 'grandes', cheia: 'cheias', cheio: 'cheios', rasa: 'rasas' };
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
const soma = (itens, k) => itens.reduce((s, x) => s + x[k], 0);

// parte das calorias do alimento que vem da proteína
const densidade = (id) => { const f = FOOD.get(id); return (f.p * 4) / f.kcal; };
// só as fontes de proteína mais concentradas da lista (pelo menos duas opções)
function concentradas(lista) {
  const boas = lista.filter((id) => densidade(id) >= 0.3);
  return boas.length >= 2 ? boas : lista.slice().sort((a, b) => densidade(b) - densidade(a)).slice(0, 2);
}
// Gordura do prato: só o azeite, para temperar a salada (1 colher). Óleo de soja, girassol, milho e canola, manteiga e
// margarina não aparecem como alimento do almoço e do jantar: óleos são ingredientes culinários, usados em pequena
// quantidade para cozinhar e temperar, e não alimentos para comer à parte (ref guia2014). Sem azeite, o prato fica
// sem esse lugar e as calorias vêm dos outros alimentos.
function oleoDoPrato(ctx) {
  // (com a lista de casa, só se houver azeite; com "mais baratos", sem esse lugar: o azeite é caro, e a salada pode ir com limão ou vinagre)
  return !ctx.barato && ctx.pode('azeite-de-oliva') ? 'azeite-de-oliva' : null;
}
// ---------- modelos de refeição ----------
// Cada refeição sai de um MODELO: uma combinação que se come junto no Brasil — pão com ovo e café com leite, tapioca
// ou cuscuz com ovo, mingau de aveia; arroz, feijão, carne e salada; macarrão com frango; fruta com iogurte; leite com
// aveia na ceia. O modelo tem lugares (base, proteína, fruta, bebida, leguminosa, salada, legume, óleo) e complementos
// que só entram quando o dia precisa de mais energia ou proteína (manteiga no pão, farofa, batata e sobremesa no prato
// feito, um ovo no prato). Cada lugar aceita só alimentos daquele papel, e cada alimento tem um limite de porção naquela
// refeição (LIM_PEQUENA e LIM_PRATO): a meta fecha com porções de verdade, sem juntar alimentos que não combinam.
// Papéis: [alimentos do cardápio de sempre, alimentos a mais que valem quando estão marcados em casa].
const semRepetir = (a, b) => b.filter((id) => !a.includes(id));
const PAPEIS = {
  // café da manhã, lanches e ceia
  pao: [['pao-frances', 'pao-de-forma-integral'], ['pao-de-forma', 'torrada', 'biscoito-cream-cracker', 'biscoito-maisena', 'biscoito-de-polvilho']],
  tapioca: [['tapioca-pronta'], []],
  cuscuz: [['cuscuz-de-milho-cozido'], []],
  cereal: [['aveia-em-flocos'], ['granola', 'cereal-matinal-de-milho']],
  raiz_cafe: [['mandioca-cozida', 'batata-doce-cozida', 'inhame-cozido'], ['cara-cozido', 'banana-da-terra', 'milho-verde-espiga']],
  quitanda: [['pao-de-queijo-assado'], ['bolo-de-milho', 'pamonha', 'canjica-com-leite', 'bolo-de-chocolate', 'biscoito-recheado']],
  ovo: [['ovo-cozido'], ['ovo-frito', 'omelete-de-queijo', 'clara-de-ovo-cozida', 'ovo-de-codorna']],
  queijo: [['queijo-minas-frescal', 'queijo-mucarela', 'ricota', 'queijo-cottage'], ['queijo-prato', 'queijo-minas-meia-cura', 'requeijao-cremoso']],
  // queijo que vai na tapioca, no cuscuz e na macaxeira (ricota e cottage, não)
  queijo_quente: [['queijo-minas-frescal', 'queijo-mucarela'], ['queijo-prato', 'queijo-minas-meia-cura']],
  frios: [[], FRIOS],
  tofu: [['tofu'], []],
  pasta: [['pasta-de-amendoim'], []],
  leite: [['leite-integral', 'leite-desnatado', 'leite-de-soja'], ['leite-semidesnatado', 'leite-em-po-integral', 'leite-em-po-desnatado', 'leite-achocolatado']],
  iogurte: [['iogurte-natural'], ['iogurte-natural-desnatado', 'iogurte-de-morango', 'bebida-lactea', 'leite-fermentado']],
  whey: [[], ['whey-protein']],
  manteiga: [['manteiga-com-sal'], ['margarina-com-sal']],
  coco: [['coco-cru'], []],
  semente: [['chia'], ['linhaca', 'gergelim']],
  mel: [['mel'], []],
  castanha: [['castanha-de-caju', 'castanha-do-para', 'nozes', 'amendoa', 'amendoim-torrado-salgado'], ['pacoca', 'pe-de-moleque', 'chocolate-amargo-70']],
  fruta: [POOL.fruta, semRepetir(POOL.fruta, POOL_CASA.fruta)],
  // almoço e jantar
  arroz: [['arroz-branco-cozido', 'arroz-integral-cozido', 'quinoa-cozida'], []],
  massa: [['macarrao-cozido'], ['lasanha-massa-cozida', 'nhoque-de-batata-cozido', 'macarrao-instantaneo']],
  raiz: [['batata-inglesa-cozida', 'mandioca-cozida', 'batata-doce-cozida', 'inhame-cozido'], ['batata-inglesa-assada', 'mandioquinha-cozida', 'cara-cozido', 'polenta-cozida', 'pinhao-cozido', 'batata-saute', 'batata-inglesa-frita', 'mandioca-frita', 'milho-verde-espiga', 'banana-da-terra']],
  pronto: [[], ['baiao-de-dois', 'feijao-tropeiro', 'feijoada', 'macarrao-a-bolonhesa']],
  feijao: [POOL.legum, ['ervilha-enlatada', 'ervilha-fresca', 'feijao-fradinho-cozido', 'feijao-roxo-cozido', 'feijao-jalo-cozido']],
  carne: [POOL.prot, semRepetir(POOL.prot, POOL_CASA.prot)],
  // sem carne e sem soja (alergia), a proteína do prato é a leguminosa
  leg_prot: [['grao-de-bico-cozido', 'lentilha-cozida'], ['feijao-fradinho-cozido', 'ervilha-fresca']],
  reforco: [['ovo-cozido'], ['ovo-frito']],
  reforco_veg: [['soja-cozida', 'proteina-de-soja-preparada', 'grao-de-bico-cozido'], ['tofu', 'proteina-de-soja-texturizada']],
  salada: [POOL.salada, semRepetir(POOL.salada, CRUS)],
  legume: [POOL.legume, semRepetir(POOL.legume, POOL_CASA.legume)],
  farinha: [['farinha-de-mandioca-torrada'], []],
  // (em casa, o macarrão também acompanha o arroz e feijão, como no prato feito)
  guarnicao: [['batata-inglesa-cozida', 'mandioca-cozida'], ['batata-inglesa-frita', 'mandioca-frita', 'batata-saute', 'macarrao-cozido']],
  // sucos naturais sem açúcar (POF 2008-2009 e TACO — data/foods.js)
  suco: [['suco-de-laranja-natural', 'suco-de-abacaxi', 'suco-de-maracuja', 'suco-de-acerola', 'suco-de-caju', 'suco-de-goiaba', 'suco-de-manga', 'suco-de-tangerina', 'suco-de-melao', 'suco-de-mamao', 'suco-de-morango'], ['suco-de-uva-integral']],
  // a bebida do café da manhã: café com leite (ou leite, ou bebida de soja)
  bebida_cafe: [['cafe-com-leite', 'leite-integral', 'leite-desnatado', 'leite-de-soja'], ['leite-semidesnatado', 'leite-em-po-integral', 'leite-em-po-desnatado', 'leite-achocolatado']],
};
// sobremesa: fruta (ou abacate)
// (a banana-da-terra, em casa, é acompanhamento do prato, não sobremesa)
PAPEIS.sobremesa = [[...POOL.fruta, 'abacate'], PAPEIS.fruta[1].filter((id) => id !== 'banana-da-terra')];
// os alimentos que o cardápio "em casa" sabe usar (os demais — açúcar, refrigerante, doces, molhos — podem ser marcados, mas não entram)
export const USADOS_EM_CASA = new Set([...Object.values(PAPEIS).flat(2), 'azeite-de-oliva'].filter((id) => FOOD.has(id) && !FOOD.get(id).soDiario));
const SO_SEM_CARNE = new Set(['reforco_veg', 'leg_prot']);
const COM_PASTA = new Set([...PAPEIS.pao[0], ...PAPEIS.pao[1], 'tapioca-pronta', 'aveia-em-flocos', 'granola']);
// Uma bebida por refeição (café com leite, leite ou suco); com suco, uma fruta só — sem suco, até duas. Pasta de amendoim
// só com pão, biscoito, tapioca ou aveia. `s` é um complemento desligado da refeição `r`: pode entrar?
const eBebida = (id) => FOOD.get(id).cat === 'bebidas' || /^leite-|^cafe-com-leite/.test(id);
function complementoCabe(r, s) {
  const on = r.slots.filter((x) => x.on);
  const temBebida = on.some((x) => eBebida(x.id));
  const temSuco = on.some((x) => x.papel === 'suco');
  const frutas = on.filter((x) => FOOD.get(x.id).papel === 'fruta').length;
  // (com suco, uma fruta só, de uma unidade: "2 bananas e suco", não)
  const frutaGrande = on.some((x) => FOOD.get(x.id).papel === 'fruta' && MEDIDAS[x.id] && x.g > MEDIDAS[x.id][0] + 1);
  if ((s.papel === 'suco' || s.k === 'bebida') && (temBebida || (s.papel === 'suco' && (frutas >= 2 || (r.tipo === 'cafe' && frutaGrande))))) return false;
  if (s.papel === 'fruta' && s.k === 'extra' && (temSuco || frutas >= 2)) return false;
  if (s.papel === 'pasta' && !on.some((x) => x.k === 'base' && COM_PASTA.has(x.id))) return false;
  return true;
}
// proteínas que combinam com macarrão e com cuscuz no prato
const MASSA_PROT = new Set(['carne-moida-cozida', 'peito-de-frango-grelhado', 'peito-de-frango-cozido', 'sobrecoxa-de-frango-assada-sem-pele', 'sardinha-assada', 'atum-em-conserva', 'sardinha-em-conserva', 'almondegas-fritas', 'ovo-cozido', 'tofu', 'soja-cozida', 'proteina-de-soja-texturizada', 'proteina-de-soja-preparada', 'grao-de-bico-cozido', 'lentilha-cozida']);
const CUSCUZ_PROT = new Set(['ovo-cozido', 'ovo-frito', 'peito-de-frango-grelhado', 'peito-de-frango-cozido', 'carne-moida-cozida', 'sobrecoxa-de-frango-assada-sem-pele', 'carne-seca-cozida', 'charque-cozido', 'sardinha-assada', 'tofu', 'soja-cozida', 'proteina-de-soja-texturizada', 'proteina-de-soja-preparada', 'grao-de-bico-cozido', 'lentilha-cozida']);
// fruta: 'sim' (padrão, entra sempre), 'req' (o modelo não existe sem ela), 'opc' (só se faltar energia), 'nao'.
// reserva: só quando nenhum outro modelo cabe nas restrições (ou na lista de casa, com `casa`); protOpc: proteína opcional.
const MODELOS = {
  cafe: [
    { id: 'pao-ovo', base: ['pao'], prot: ['ovo'], prot2: ['queijo'], bebida: ['bebida_cafe'], extra: ['manteiga', 'suco', 'fruta'] },
    { id: 'tapioca', base: ['tapioca'], prot: ['ovo', 'queijo_quente', 'tofu', 'pasta'], prot2: ['queijo_quente', 'ovo'], bebida: ['bebida_cafe'], extra: ['manteiga', 'coco', 'fruta', 'suco'] },
    { id: 'pao-queijo', base: ['pao'], prot: ['queijo', 'frios'], prot2: ['ovo'], bebida: ['bebida_cafe'], extra: ['manteiga', 'suco', 'fruta'] },
    { id: 'cuscuz', base: ['cuscuz'], prot: ['ovo', 'queijo_quente', 'tofu'], prot2: ['queijo_quente', 'ovo'], bebida: ['bebida_cafe'], extra: ['manteiga', 'coco', 'suco', 'fruta'] },
    { id: 'mingau', base: ['cereal'], prot: ['iogurte', 'leite'], extra: ['pasta', 'semente', 'mel', 'fruta'] },
    { id: 'pao-pasta', base: ['pao'], prot: ['pasta'], bebida: ['bebida_cafe'], extra: ['suco', 'fruta'] },
    { id: 'raiz', base: ['raiz_cafe'], prot: ['ovo', 'queijo_quente'], prot2: ['queijo_quente', 'ovo'], bebida: ['bebida_cafe'], extra: ['manteiga', 'suco', 'fruta'] },
    { id: 'pao-tofu', base: ['pao'], prot: ['tofu'], bebida: ['bebida_cafe'], extra: ['suco', 'fruta'] },
    { id: 'quitanda', base: ['quitanda'], prot: ['leite', 'iogurte'], extra: ['suco', 'fruta'] },
    { id: 'casa', reserva: true, casa: true, base: ['pao', 'tapioca', 'cuscuz', 'cereal', 'raiz_cafe', 'quitanda'], prot: ['ovo', 'queijo', 'frios', 'tofu', 'iogurte', 'whey'], protOpc: true, bebida: ['bebida_cafe'], extra: ['manteiga', 'coco', 'semente', 'mel'] },
    { id: 'simples', reserva: true, base: ['tapioca', 'cuscuz', 'pao', 'raiz_cafe', 'cereal'], bebida: ['bebida_cafe'], extra: ['coco', 'manteiga', 'semente'] },
  ],
  lanche: [
    { id: 'fruta-iogurte', fruta: 'req', prot: ['iogurte'], extra: ['cereal', 'semente'] },
    { id: 'pao-queijo', base: ['pao'], prot: ['queijo', 'frios'], fruta: 'opc' },
    { id: 'fruta-castanha', fruta: 'req', prot: ['castanha'] },
    { id: 'vitamina', fruta: 'req', prot: ['leite'], extra: ['cereal'] },
    { id: 'tapioca', base: ['tapioca'], prot: ['ovo', 'queijo_quente', 'tofu'], fruta: 'opc' },
    { id: 'pao-pasta', base: ['pao'], prot: ['pasta'], fruta: 'opc' },
    { id: 'casa', reserva: true, casa: true, prot: ['iogurte', 'leite', 'queijo', 'frios', 'ovo', 'whey', 'castanha'], protOpc: true, extra: ['cereal', 'semente', 'castanha'] },
    { id: 'fruta', reserva: true, fruta: 'req', extra: ['semente', 'coco', 'cereal'] },
  ],
  ceia: [
    { id: 'iogurte', prot: ['iogurte'], fruta: 'opc' },
    { id: 'leite', prot: ['leite'], extra: ['cereal'], fruta: 'nao' },
    { id: 'castanha', fruta: 'req', prot: ['castanha'] },
    { id: 'casa', reserva: true, casa: true, prot: ['iogurte', 'leite', 'queijo', 'ovo', 'whey', 'castanha'], protOpc: true },
    { id: 'fruta', reserva: true, fruta: 'req', extra: ['semente', 'cereal'] },
  ],
  principal: [
    { id: 'arroz-feijao', base: ['arroz'], leg: ['feijao'], prot: ['carne'], prot2: ['reforco', 'reforco_veg'], extra: ['sobremesa', 'farinha', 'suco', 'guarnicao'] },
    { id: 'macarrao', base: ['massa'], prot: ['carne'], so: MASSA_PROT, extra: ['sobremesa', 'suco'] },
    { id: 'raiz', base: ['raiz'], prot: ['carne'], prot2: ['reforco', 'reforco_veg'], extra: ['feijao', 'sobremesa', 'suco'] },
    { id: 'cuscuz', base: ['cuscuz'], prot: ['carne'], so: CUSCUZ_PROT, prot2: ['reforco', 'reforco_veg'], extra: ['sobremesa', 'suco'] },
    // prato pronto (feijoada, baião de dois, feijão-tropeiro, macarrão à bolonhesa): já tem a carne ou o queijo
    { id: 'pronto', reserva: true, casa: true, base: ['pronto'], protOpc: true, extra: ['sobremesa'] },
    { id: 'casa', reserva: true, casa: true, base: ['arroz', 'massa', 'raiz', 'cuscuz'], leg: ['feijao'], prot: ['carne', 'leg_prot'], protOpc: true, extra: ['sobremesa'] },
  ],
};
// almoço: quase sempre arroz e feijão; jantar: varia mais (cuscuz, macarrão, batata com carne)
// (as duas listas usam a mesma semente e nunca repetem, na mesma posição, um prato que não seja arroz e feijão)
const ORDEM_PRATO = { Almoço: ['arroz-feijao', 'arroz-feijao', 'macarrao', 'arroz-feijao', 'raiz', 'arroz-feijao'], Jantar: ['cuscuz', 'raiz', 'arroz-feijao', 'macarrao', 'arroz-feijao', 'raiz'] };

// Gramas mínimo, máximo e passo de cada alimento na refeição. Nenhum passa de 3 porções caseiras.
// Café da manhã, lanches e ceia: no máximo 2 pães, 3 ovos, 2 fatias de queijo branco (3 de muçarela), 1 copo e meio de leite.
const LIM_PEQUENA = {
  'pao-frances': [50, 100, 25], 'pao-de-forma-integral': [50, 100, 25], 'pao-de-forma': [50, 100, 25], torrada: [30, 60, 15], 'biscoito-cream-cracker': [30, 60, 15], 'biscoito-maisena': [30, 60, 15], 'biscoito-de-polvilho': [30, 60, 15],
  'tapioca-pronta': [50, 100, 10], 'cuscuz-de-milho-cozido': [100, 250, 10], 'aveia-em-flocos': [20, 60, 10], granola: [20, 60, 10], 'cereal-matinal-de-milho': [20, 60, 10],
  'mandioca-cozida': [100, 200, 10], 'batata-doce-cozida': [100, 200, 10], 'inhame-cozido': [100, 200, 10], 'cara-cozido': [100, 200, 10], 'banana-da-terra': [100, 200, 50], 'milho-verde-espiga': [100, 200, 100],
  'pao-de-queijo-assado': [40, 120, 40], 'bolo-de-milho': [60, 120, 30], 'bolo-de-chocolate': [60, 120, 30], pamonha: [150, 150, 150], 'canjica-com-leite': [150, 300, 50], 'biscoito-recheado': [30, 60, 15],
  'ovo-cozido': [50, 150, 50], 'ovo-frito': [50, 100, 50], 'omelete-de-queijo': [65, 130, 65], 'clara-de-ovo-cozida': [35, 105, 35], 'ovo-de-codorna': [25, 100, 25],
  'queijo-minas-frescal': [30, 60, 30], 'queijo-mucarela': [15, 45, 15], 'queijo-prato': [15, 45, 15], 'queijo-minas-meia-cura': [30, 60, 30], ricota: [50, 100, 25], 'queijo-cottage': [50, 100, 25], 'requeijao-cremoso': [15, 30, 15],
  'presunto-cozido': [15, 45, 15], 'peito-de-peru-defumado': [15, 45, 15], mortadela: [15, 30, 15], salame: [15, 30, 15],
  tofu: [60, 150, 10], 'pasta-de-amendoim': [15, 30, 15],
  'cafe-com-leite': [150, 300, 50], 'leite-integral': [150, 300, 50], 'leite-semidesnatado': [150, 300, 50], 'leite-desnatado': [150, 300, 50], 'leite-de-soja': [150, 300, 50], 'leite-achocolatado': [200, 200, 200], 'leite-em-po-integral': [20, 40, 10], 'leite-em-po-desnatado': [20, 40, 10],
  'iogurte-natural': [170, 340, 170], 'iogurte-natural-desnatado': [170, 340, 170], 'iogurte-de-morango': [170, 170, 170], 'bebida-lactea': [200, 200, 200], 'leite-fermentado': [80, 80, 80],
  'whey-protein': [15, 30, 15], 'manteiga-com-sal': [5, 15, 5], 'margarina-com-sal': [5, 15, 5], 'suco-de-laranja-natural': [200, 300, 100], 'coco-cru': [15, 30, 15], chia: [12, 12, 12], linhaca: [10, 20, 10], gergelim: [10, 10, 10], mel: [10, 20, 5],
  'castanha-de-caju': [15, 40, 5], 'castanha-do-para': [8, 16, 4], nozes: [10, 30, 5], amendoa: [10, 30, 5], 'amendoim-torrado-salgado': [15, 45, 15], 'amendoim-cru': [15, 45, 15], pacoca: [20, 40, 20], 'pe-de-moleque': [20, 40, 20], 'chocolate-amargo-70': [10, 25, 5],
};
// Almoço e jantar: até 300 g de arroz, 2 conchas de feijão, 220 g de carne, 1 colher de sopa de óleo.
const LIM_PRATO = {
  'arroz-branco-cozido': [60, 300, 20], 'arroz-integral-cozido': [60, 300, 20], 'quinoa-cozida': [60, 250, 10], 'macarrao-cozido': [80, 330, 10],
  'batata-inglesa-cozida': [100, 350, 10], 'mandioca-cozida': [80, 250, 10], 'batata-doce-cozida': [100, 300, 10], 'inhame-cozido': [80, 250, 10], 'cuscuz-de-milho-cozido': [100, 300, 10],
  'feijao-carioca-cozido': [50, 200, 10], 'feijao-preto-cozido': [50, 200, 10], 'lentilha-cozida': [50, 200, 10], 'grao-de-bico-cozido': [50, 200, 10],
  'ovo-cozido': [50, 150, 50], 'ovo-frito': [50, 100, 50], tofu: [80, 250, 10], 'soja-cozida': [80, 250, 10], 'proteina-de-soja-texturizada': [25, 75, 5],
  'farinha-de-mandioca-torrada': [15, 60, 15], 'suco-de-laranja-natural': [200, 400, 100], 'suco-de-uva-integral': [200, 200, 200], abacate: [90, 180, 45],
};
const OLEO_PRATO = new Set(POOL_CASA.gordura);
// Porções do cardápio, em medidas caseiras (o peso de cada medida vem da tabela do IBGE — data/foods.js, MEDIDAS):
// [mínimo, máximo, passo], em número de medidas, por refeição. Carne, frango e peixe: de 1 a 2 bifes ou filés; feijão,
// 1 a 2 conchas; arroz, 2 a 6 colheres de servir; farinha, 1 a 2 colheres de sopa; iogurte, 1 pote; suco, 1 copo;
// fruta, 1 ou 2 unidades. As quantidades andam de meia em meia medida (ovo, fatia e unidade pequena, de uma em uma).
const PORCOES = {
  prato: {
    'arroz-branco-cozido': [2, 6, 1], 'arroz-integral-cozido': [2, 6, 1], 'macarrao-cozido': [1, 3, 0.5], 'batata-inglesa-cozida': [1, 2, 0.5], 'mandioca-cozida': [1, 2.5, 0.5],
    'batata-doce-cozida': [1, 3, 0.5], 'inhame-cozido': [2, 4, 1], 'cuscuz-de-milho-cozido': [1, 2, 0.5],
    'feijao-carioca-cozido': [1, 2, 0.5], 'feijao-preto-cozido': [1, 2, 0.5], 'lentilha-cozida': [1, 2, 0.5], 'grao-de-bico-cozido': [1, 2, 0.5], 'soja-cozida': [1, 3, 0.5], 'proteina-de-soja-preparada': [2, 4, 1],
    'peito-de-frango-grelhado': [1, 2, 0.5], 'peito-de-frango-cozido': [1, 2, 0.5], 'patinho-grelhado': [1, 2, 0.5], 'coxao-mole-cozido': [1, 2, 0.5], 'carne-moida-cozida': [1.5, 3, 0.5],
    'sobrecoxa-de-frango-assada-sem-pele': [2, 4, 1], 'lombo-suino-assado': [1, 2, 0.5], 'tilapia-grelhada': [1, 2, 0.5], 'merluza-assada': [1, 2, 0.5], 'sardinha-assada': [2, 4, 1], 'ovo-cozido': [2, 3, 1],
    'farinha-de-mandioca-torrada': [1, 2, 1], 'azeite-de-oliva': [0.5, 1.5, 0.5], 'oleo-de-soja': [0.5, 1.5, 0.5], abacate: [2, 4, 1],
    // salada e legume: uma quantidade só (não entram no ajuste das calorias)
    'alface-crespa': [3, 3, 1], tomate: [3, 3, 1], rucula: [1, 1, 1], pepino: [2, 2, 1], 'cenoura-crua': [2, 2, 1], 'repolho-branco-cru': [3, 3, 1],
    'brocolis-cozido': [1.5, 1.5, 1], 'abobrinha-cozida': [2, 2, 1], 'cenoura-cozida': [1.5, 1.5, 1], 'couve-refogada': [2, 2, 1], 'chuchu-cozido': [1.5, 1.5, 1], 'beterraba-cozida': [1.5, 1.5, 1],
    'couve-flor-cozida': [1.5, 1.5, 1], 'vagem-cozida': [2, 2, 1], 'abobora-cabotia-cozida': [2, 2, 1], 'quiabo-cozido': [2, 2, 1], 'berinjela-cozida': [3, 3, 1],
  },
  // a guarnição do prato feito e o reforço do prato (um ovo; sem carne, soja ou grão-de-bico)
  guarnicao: { 'batata-inglesa-cozida': [0.5, 1, 0.5], 'mandioca-cozida': [0.5, 1, 0.5] },
  reforco: { 'ovo-cozido': [1, 2, 1], 'soja-cozida': [1, 3, 0.5], 'proteina-de-soja-preparada': [1, 2, 1], 'grao-de-bico-cozido': [1, 1.5, 0.5] },
  pequena: {
    'pao-frances': [1, 2, 0.5], 'pao-de-forma-integral': [2, 4, 1], 'tapioca-pronta': [1, 2, 0.5], 'aveia-em-flocos': [2, 4, 1], 'cuscuz-de-milho-cozido': [1, 2, 0.5], 'mandioca-cozida': [1, 2, 0.5],
    'batata-doce-cozida': [1, 2, 0.5], 'inhame-cozido': [2, 3, 1], 'pao-de-queijo-assado': [2, 5, 1],
    'ovo-cozido': [1, 3, 1], 'queijo-minas-frescal': [1, 2, 1], 'queijo-mucarela': [1, 3, 1], ricota: [1, 2, 1], 'queijo-cottage': [1, 2, 1], tofu: [1, 2, 1], 'pasta-de-amendoim': [1, 2, 1],
    'leite-integral': [1, 1.5, 0.5], 'leite-desnatado': [1, 1.5, 0.5], 'leite-de-soja': [1, 1.5, 0.5], 'cafe-com-leite': [1, 2, 1], 'iogurte-natural': [1, 1, 1],
    'manteiga-com-sal': [1, 2, 1], 'coco-cru': [0.5, 1, 0.5], chia: [1, 1, 1], mel: [1, 1, 1],
    'castanha-de-caju': [0.5, 1, 0.5], 'castanha-do-para': [2, 4, 1], nozes: [2, 6, 1], amendoa: [10, 20, 5], 'amendoim-torrado-salgado': [1, 2, 1],
  },
};
// fruta: 1 ou 2 unidades (ou fatias); as grandes (laranja, mamão, melancia, goiaba), 1 a 1,5; morango, de 6 a 10; uva,
// meio cacho a 1
const PORCAO_FRUTA = { morango: [6, 10, 2], 'uva-italia': [0.5, 1, 0.5], abacate: [2, 4, 1] };
// o alimento tem medida e porção definidas para este tipo de refeição?
const temPorcao = (id, tipo) => !!MEDIDAS[id] && (FOOD.get(id).papel === 'fruta' || /^suco-/.test(id) || !!(tipo === 'principal' ? PORCOES.prato[id] || PORCOES.guarnicao[id] || PORCOES.reforco[id] : PORCOES.pequena[id]));
// em gramas: [mínimo, máximo, passo] das porções acima, ou null se o alimento não tem medida da tabela
export function porcaoMedida(id, tipo, papel) {
  const m = MEDIDAS[id];
  if (!m) return null;
  const f = FOOD.get(id);
  let n = null;
  if (f.cat === 'bebidas' && id.startsWith('suco-')) n = [1, 1, 1];
  else if (papel === 'guarnicao') n = PORCOES.guarnicao[id];
  else if (papel === 'reforco') n = PORCOES.reforco[id];
  else if (f.papel === 'fruta' || (id === 'abacate' && papel === 'sobremesa')) n = PORCAO_FRUTA[id] || (m[0] >= 170 ? [1, 1.5, 0.5] : [1, 2, 1]);
  if (!n) n = (tipo === 'principal' ? PORCOES.prato[id] || PORCOES.guarnicao[id] || PORCOES.reforco[id] : PORCOES.pequena[id]);
  return n ? [n[0] * m[0], n[1] * m[0], n[2] * m[0]] : null;
}
// limite de um alimento num lugar da refeição: [mínimo, máximo, passo]
function limite(id, tipo, papel) {
  const medido = porcaoMedida(id, tipo, papel);
  if (medido) return medido;
  const f = FOOD.get(id), pg = f.porcao.g;
  if (f.papel === 'fruta') {
    // fruta: de meia porção a uma porção e meia, sem passar de 10 unidades na medida caseira
    const unidades = Number((/^(\d+)/.exec(f.porcao.desc) || [0, 1])[1]) || 1;
    const meia = Math.max(5, Math.round(pg / 2 / 5) * 5);
    return [meia, Math.max(pg, Math.floor((pg * Math.max(1, Math.min(1.5, 10 / unidades))) / 5) * 5), Math.max(5, pg - meia)];
  }
  // suco natural: 1 copo; no almoço e no jantar, até 2
  if (f.cat === 'bebidas' && id.startsWith('suco-')) return tipo === 'principal' ? [200, 400, 100] : [200, 300, 100];
  if (tipo !== 'principal') { if (LIM_PEQUENA[id]) return LIM_PEQUENA[id]; }
  else {
    if (papel === 'salada') return [pg, pg, pg];
    if (papel === 'legume') return [pg, pg * 2, 10];
    if (OLEO_PRATO.has(id)) return [5, 13, 4];
    if (papel === 'guarnicao') return [60, Math.min(250, pg * 3), 10];
    if (LIM_PRATO[id]) return LIM_PRATO[id];
  }
  const st = pg <= 30 ? 5 : 10;
  const teto = f.papel === 'gordura' ? 60 : f.papel === 'proteina' ? (tipo === 'principal' ? 220 : 150) : /leite|iogurte|bebida/.test(id + f.cat) ? 400 : 350;
  // (carne, frango e peixe no prato: de 40% da porção — um bife pequeno, para metas baixas de proteína — a 220 g)
  const mn = Math.max(st, Math.ceil((pg * (f.papel === 'proteina' && tipo === 'principal' ? 0.4 : 0.5)) / st) * st);
  return [mn, Math.max(mn, Math.floor(Math.min(pg * 3, teto) / st) * st), st];
}
// grama mais perto de `g` na grade do limite
const encaixa = (g, [mn, mx, st]) => Math.min(mx, Math.max(mn, mn + Math.round((g - mn) / st) * st));

// alimentos de um lugar (papéis), respeitando restrições, alergias, a lista de casa e a preferência de preço
function opcoes(papeis, ctx, tipo) {
  // (guardado por cardápio: o ajuste do dia pergunta a mesma coisa muitas vezes)
  const chave = papeis.join() + '|' + tipo;
  const cache = ctx.opcoes || (ctx.opcoes = new Map());
  if (!cache.has(chave)) cache.set(chave, calcularOpcoes(papeis, ctx, tipo));
  return cache.get(chave);
}
function calcularOpcoes(papeis, ctx, tipo) {
  const prato = tipo === 'principal';
  let ids = [...new Set(papeis.filter((p) => !SO_SEM_CARNE.has(p) || ctx.semCarne).flatMap((p) => (ctx.casa ? [...PAPEIS[p][0], ...PAPEIS[p][1]] : PAPEIS[p][0])))].filter(ctx.pode);
  // soja (tofu, bebida de soja...) entra para quem não come carne; fora do prato, também sem lactose ou com alergia ao leite
  if (!ctx.casa) ids = ids.filter((id) => !SO_VEG.has(id) || (prato ? ctx.semCarne : ctx.sojaLeve));
  // no cardápio de sempre, só alimentos com medida caseira de referência (data/foods.js, MEDIDAS)
  if (!ctx.casa) ids = ids.filter((id) => temPorcao(id, tipo));
  // em casa: havendo opção, os ultraprocessados ficam de fora (Guia Alimentar — ref guia2014)
  if (ctx.casa) { const mp = ids.filter((id) => FOOD.get(id).nova < 4); if (mp.length) ids = mp; }
  // "mais baratos": nada da faixa cara; dos que sobram, os da menor faixa (ou da seguinte, se houver só um)
  if (ctx.barato) ids = economicos(ids.filter((id) => faixa(id) <= 2), 2);
  return ids;
}
function protDoModelo(m, ctx, tipo) {
  let c = opcoes(m.prot, ctx, tipo);
  if (m.so) c = c.filter((id) => m.so.has(id));
  if (!c.length && tipo === 'principal' && ctx.semCarne) c = opcoes(['leg_prot'], ctx, tipo);
  // proteína do prato: a que, na porção máxima, dá pelo menos 10 g (2 fatias de tofu, não)
  if (tipo === 'principal') c = c.filter((id) => (FOOD.get(id).p * limite(id, tipo)[1]) / 100 >= 10);
  return c;
}
function viavel(m, tipo, ctx) {
  if (m.casa && !ctx.casa) return false;
  const tem = (p) => opcoes(p, ctx, tipo).length > 0;
  if (m.base && !tem(m.base) && !m.protOpc) return false;
  if (m.prot && !m.protOpc && !protDoModelo(m, ctx, tipo).length) return false;
  if (m.leg && !ctx.casa && !tem(m.leg)) return false;
  if (m.fruta === 'req' && !tem(['fruta'])) return false;
  // modelos de reserva: pelo menos um lugar com alimento
  return !m.reserva || [m.base, m.prot, m.leg, m.fruta === 'nao' ? null : ['fruta']].some((p) => p && tem(p));
}
// os modelos possíveis, a partir do sorteado pela semente (e depois os de reserva)
function modelosEmOrdem(tipo, nome, ctx, escolha) {
  const todos = MODELOS[tipo];
  const ordem = tipo === 'principal' ? (ORDEM_PRATO[nome] || ORDEM_PRATO['Almoço']).map((id) => todos.find((m) => m.id === id)) : todos.filter((m) => !m.reserva);
  const n = ordem.length, out = [];
  for (let k = 0; k < n; k++) { const m = ordem[(((escolha + k) % n) + n) % n]; if (!out.includes(m) && viavel(m, tipo, ctx)) out.push(m); }
  return [...out, ...todos.filter((m) => m.reserva && viavel(m, tipo, ctx))];
}
// Energia que a refeição comporta com tudo no máximo (complementos incluídos): o modelo sorteado só fica se der conta
// da sua parte da meta; senão, vale o próximo (com meta alta, o prato feito de arroz e feijão, que aceita farofa e batata).
// (a proteína fica no tamanho calculado para a refeição: crescer a carne só para ganhar energia passaria da meta)
function capacidade(r, ctx) {
  let k = 0;
  for (const s of r.slots) {
    if (s.on) k += (FOOD.get(s.id).kcal * (s.k === 'prot' ? s.g : s.lim[1])) / 100;
    else if (s.opc && s.k !== 'prot2') k += Math.max(0, ...opcoes(s.papeis, ctx, r.tipo).slice(0, 4).map((id) => (FOOD.get(id).kcal * limite(id, r.tipo, s.papel)[1]) / 100));
  }
  return k;
}
// Monta uma refeição a partir do modelo sorteado pela semente. Os lugares fixos já entram com uma porção; a proteína e
// a base são calculadas para a parte da meta que cabe nesta refeição; os complementos ficam desligados (o ajuste do dia
// liga os que precisar). Cada lugar só entra se houver alimento para ele (com a lista de casa, um grupo pode faltar), e
// nenhum alimento aparece mais de 2 vezes no dia: se faltar alimento para um lugar obrigatório, vale o próximo modelo.
function refeicao(tipo, nome, kcalAlvo, pAlvo, ctx, seed, escolha, usados, rico) {
  let melhor = null;
  for (const m of modelosEmOrdem(tipo, nome, ctx, escolha)) {
    const us = new Map(usados);
    const r = montarModelo(m, tipo, nome, kcalAlvo, pAlvo, ctx, seed, us, rico);
    if (!r) continue;
    // proteína que a refeição comporta (fontes de proteína no máximo e o reforço do modelo)
    const capP = r.slots.reduce((t, s) => t + (s.on && LUGAR_PROT.has(s.k) ? (FOOD.get(s.id).p * s.lim[1]) / 100 : 0), 0)
      + (r.slots.some((s) => s.k === 'prot2') ? Math.max(0, ...opcoes(r.slots.find((s) => s.k === 'prot2').papeis, ctx, tipo).map((id) => (FOOD.get(id).p * limite(id, tipo)[1]) / 100)) : 0);
    const cap = Math.min(capacidade(r, ctx) / kcalAlvo, capP / Math.max(1, pAlvo));
    // alimentos que já estão em outra refeição do dia (o azeite do prato não conta)
    const rep = r.slots.filter((s) => s.on && s.k !== 'oleo' && usados.has(s.id)).length;
    // fica o primeiro que dá conta da meta sem repetir alimento; senão, o que dá conta com menos repetição; senão, o maior
    // (o café e os lanches podem ficar um pouco abaixo: almoço e jantar completam)
    const basta = tipo === 'principal' ? 1.15 : 0.85;
    // refeição pequena (lanche de 150 kcal): o modelo que, no mínimo, já passa muito da parte da meta fica para depois
    // (os complementos, como a bebida do café, podem sair: não contam no mínimo)
    const minimo = r.slots.reduce((t, s) => t + (s.on && !s.opc ? (FOOD.get(s.id).kcal * s.lim[0]) / 100 : 0), 0);
    // (no prato, dar conta da meta pesa mais; no café e nos lanches, não repetir alimento)
    const nota = tipo === 'principal' ? (cap >= basta ? 100 : cap * 50) - rep * 5 : (cap >= basta ? 30 : cap * 30) - rep * 10 - (minimo > kcalAlvo * 1.25 ? 50 : 0);
    if (!melhor || nota > melhor.nota) melhor = { r, us, nota };
    if (cap >= basta && !rep && minimo <= kcalAlvo * 1.25) break;
  }
  if (!melhor) return { nome, tipo, slots: [], alvo: kcalAlvo, seed };
  usados.clear();
  for (const [k, v] of melhor.us) usados.set(k, v);
  return melhor.r;
}
function montarModelo(m, tipo, nome, kcalAlvo, pAlvo, ctx, seed, usados, rico) {
  const r = { nome, tipo, slots: [], alvo: kcalAlvo, seed };
  const dentro = (id) => r.slots.some((s) => s.id === id);
  const lugar = (k, papeis, id, g, extra = {}) => {
    const s = { k, papeis, id: id || null, g: 0, lim: null, on: !!id, opc: false, ...extra };
    if (id) {
      s.lim = limite(id, tipo, extra.papel);
      s.g = encaixa(g, s.lim);
    }
    r.slots.push(s);
    return s;
  };
  const livre = (id) => !dentro(id) && (usados.get(id) || 0) < 2;
  const escolhe = (lista, sd) => pick(lista.filter(livre), sd, usados);
  const kOf = () => r.slots.reduce((t, s) => t + (s.on ? (FOOD.get(s.id).kcal * s.g) / 100 : 0), 0);
  const pOf = () => r.slots.reduce((t, s) => t + (s.on ? (FOOD.get(s.id).p * s.g) / 100 : 0), 0);
  const porcaoDe = (id) => FOOD.get(id).porcao.g;
  // proteína: só as mais concentradas quando a meta de proteína é alta
  const fontes = (lista) => (rico && lista.length > 2 ? concentradas(lista) : lista);
  let base = null, prot = null;
  if (tipo === 'principal') {
    // prato grande (mais de 900 kcal): a base que comporta mais energia (arroz, e não quinoa)
    const bases = m.base ? opcoes(m.base, ctx, tipo) : [];
    const cabeMais = (id) => (FOOD.get(id).kcal * limite(id, tipo)[1]) / 100;
    const topo = kcalAlvo > 900 && bases.length ? bases.filter(livre).filter((id, _, l) => cabeMais(id) >= Math.max(...l.map(cabeMais)) * 0.9) : [];
    const bid = m.base ? escolhe(topo.length ? topo : bases, seed + 1) : null;
    base = lugar('base', m.base, bid, bid ? porcaoDe(bid) : 0);
    const lid = m.leg ? escolhe(opcoes(m.leg, ctx, tipo), seed) : null;
    if (m.leg) lugar('leg', m.leg, lid, ctx.semCarne ? 150 : 100);
    const todas = m.prot ? protDoModelo(m, ctx, tipo).filter(livre) : [];
    const falta = Math.max(8, pAlvo - pOf() - 4);
    // dá conta da proteína desta refeição na porção máxima e não passa muito dela na mínima (meta baixa de proteína: o ovo
    // ou o frango, e não o lombo, que já começa em 34 g)
    const pMin = (id) => (FOOD.get(id).p * limite(id, tipo)[0]) / 100;
    const capaz0 = todas.filter((id) => (FOOD.get(id).p * limite(id, tipo)[1]) / 100 >= falta * 0.8);
    const justos = ctx.protBaixa ? capaz0.filter((id) => pMin(id) <= Math.max(falta * 1.3, 12)) : [];
    const capaz = justos.length ? justos : capaz0;
    // sem carne e com meta alta de proteína, a fonte mais concentrada (proteína de soja) pode vir no almoço e no jantar
    const lista = fontes(capaz.length ? capaz : todas);
    const pid = !m.prot ? null : rico && ctx.semCarne && lista.length ? pick([lista.slice().sort((a, b) => densidade(b) - densidade(a))[0]], 0, usados) : pick(lista, seed, usados);
    prot = lugar('prot', m.prot, pid, pid ? (falta / FOOD.get(pid).p) * 100 : 0);
    if (m.prot2) lugar('prot2', m.prot2, null, 0, { opc: true, papel: 'reforco' });
    for (const e of m.extra || []) if (e === 'guarnicao' || e === 'farinha') lugar('extra', [e], null, 0, { opc: true, papel: e });
    const sal = escolhe(opcoes(['salada'], ctx, tipo), seed);
    lugar('salada', ['salada'], sal, sal ? porcaoDe(sal) : 0, { papel: 'salada' });
    // (o legume não repete a verdura da salada: cenoura crua e cenoura cozida no mesmo prato, não)
    const lg = escolhe(opcoes(['legume'], ctx, tipo).filter((id) => !sal || nomeDeCompra(FOOD.get(id).nome) !== nomeDeCompra(FOOD.get(sal).nome)), seed * 2 + 1);
    lugar('legume', ['legume'], lg, lg ? porcaoDe(lg) * 1.5 : 0, { papel: 'legume' });
    const ol = oleoDoPrato(ctx);
    lugar('oleo', ['oleo'], ol, 8, { papel: 'oleo' });
    for (const e of m.extra || []) if (e !== 'guarnicao' && e !== 'farinha') lugar('extra', [e], null, 0, { opc: true, papel: e });
  } else {
    // (a base gira num ritmo diferente do modelo, para o mesmo modelo não vir sempre com o mesmo pão)
    const bid = m.base ? escolhe(opcoes(m.base, ctx, tipo), seed + Math.floor(seed / 5)) : null;
    base = lugar('base', m.base, bid, bid ? porcaoDe(bid) : 0);
    const pid = m.prot ? pick(fontes(protDoModelo(m, ctx, tipo).filter(livre)), seed, usados) : null;
    prot = lugar('prot', m.prot, pid, pid ? FOOD.get(pid).porcao.g : 0);
    if (m.prot2) lugar('prot2', m.prot2, null, 0, { opc: true });
    for (const e of m.extra || []) lugar('extra', [e], null, 0, { opc: true, papel: e });
    const bb = m.bebida ? escolhe(opcoes(m.bebida, ctx, tipo), seed + 2) : null;
    // (uma bebida só: com leite ou iogurte líquido no lugar da proteína, a bebida do modelo fica de fora)
    if (m.bebida) lugar('bebida', m.bebida, prot.on && eBebida(prot.id) ? null : bb, 200, { opc: true });
    // fruta opcional: já entra quando a refeição é grande (lanche de mais de 300 kcal)
    const comFruta = m.fruta !== 'nao' && (m.fruta !== 'opc' || kcalAlvo > 300);
    const fr = comFruta ? escolhe(opcoes(['fruta'], ctx, tipo), seed * 3 + tipo.length) : null;
    if (m.fruta !== 'nao') lugar('fruta', ['fruta'], fr, fr ? porcaoDe(fr) : 0, { papel: 'fruta', opc: m.fruta === 'opc' });
    // proteína do tamanho da parte da meta desta refeição
    if (prot.on) { const outros = pOf() - (FOOD.get(prot.id).p * prot.g) / 100; prot.g = encaixa(((pAlvo - outros) / Math.max(1, FOOD.get(prot.id).p)) * 100, prot.lim); }
  }
  // lugar obrigatório sem alimento (todos já apareceram 2 vezes no dia): este modelo não serve
  if ((m.base && !base.on && !m.protOpc) || (m.prot && !prot.on && !m.protOpc) || (m.fruta === 'req' && !r.slots.some((s) => s.k === 'fruta' && s.on))) return null;
  if (m.leg && !ctx.casa && !r.slots.some((s) => s.k === 'leg' && s.on)) return null;
  if (!r.slots.some((s) => s.on)) return null;
  // a base completa as calorias da refeição
  if (base.on) { const outros = kOf() - (FOOD.get(base.id).kcal * base.g) / 100; base.g = encaixa(((kcalAlvo - outros) / FOOD.get(base.id).kcal) * 100, base.lim); }
  // ainda longe da parte da meta (refeição sem base, como fruta com castanhas): a fruta e os complementos crescem
  const cresce = (x) => encaixa(x.g + x.lim[2], x.lim) > x.g;
  for (let k = 0; k < 30 && kOf() < kcalAlvo * 0.85; k++) {
    const s = r.slots.find((x) => x.on && (x.k === 'fruta' || x.k === 'extra' || x.k === 'bebida') && cresce(x));
    if (s) { s.g = encaixa(s.g + s.lim[2], s.lim); continue; }
    const novo = r.slots.filter((x) => x.on).length < MAX_ITENS[tipo] && r.slots.find((x) => !x.on && x.opc && x.k !== 'prot2' && x.papel !== 'feijao' && complementoCabe(r, x) && opcoes(x.papeis, ctx, tipo).some(livre));
    if (novo) { novo.id = escolhe(opcoes(novo.papeis, ctx, tipo), seed); novo.lim = limite(novo.id, tipo, novo.papel); novo.g = novo.lim[0]; novo.on = true; continue; }
    // por último (refeição só com o iogurte ou o leite), a proteína cresce até umas 100 kcal
    const pr = kOf() < Math.max(100, kcalAlvo * 0.5) && r.slots.find((x) => x.on && x.k === 'prot' && cresce(x));
    if (!pr) break;
    pr.g = encaixa(pr.g + pr.lim[2], pr.lim);
  }
  return r;
}

// ---------- ajuste do dia ----------
// Montadas as refeições, o dia é levado às metas de proteína e de calorias mexendo só nas quantidades, dentro dos
// limites de porção de cada alimento, e ligando complementos do próprio modelo quando as porções já estão no máximo (ou
// desligando-os quando sobra). A energia vai primeiro para a refeição mais abaixo da sua parte da meta; a proteína, para
// as fontes mais concentradas. Quem corre: o carboidrato sobe e a gordura cede, sem passar das calorias.
const kDe = (s, k = 'kcal') => (FOOD.get(s.id)[k] * s.g) / 100;
const somaSlots = (r, k = 'kcal') => r.slots.reduce((t, s) => t + (s.on ? kDe(s, k) : 0), 0);
const LUGAR_PROT = new Set(['prot', 'prot2', 'leg', 'bebida']);
const LUGAR_ENERGIA = new Set(['base', 'oleo', 'fruta', 'extra', 'leg', 'bebida']);
const CARBO_EXTRA = new Set(['sobremesa', 'suco', 'farinha', 'guarnicao', 'fruta', 'cereal', 'mel']);
function balancear(refs, res, ctx) {
  const K = res.kcal, P = res.prot;
  const alta = K / refs.length > 900;
  const total = (k = 'kcal') => refs.reduce((t, r) => t + somaSlots(r, k), 0);
  const noDia = (id) => refs.reduce((n, r) => n + (r.slots.some((s) => s.on && s.id === id) ? 1 : 0), 0);
  const cheia = (r) => r.slots.reduce((n, s) => n + (s.on ? 1 : 0), 0) >= Math.min(10, MAX_ITENS[r.tipo] + (alta ? 2 : 0));
  const dens = (s) => { const f = FOOD.get(s.id); return f.kcal ? f.p / f.kcal : 1; };
  const fracao = (s, n) => { const f = FOOD.get(s.id); return f.kcal ? (f[n] * (n === 'g' ? 9 : 4)) / f.kcal : 0; };
  // (no café com suco, a fruta não passa de uma unidade)
  const comSuco = (s) => FOOD.get(s.id).papel === 'fruta' && MEDIDAS[s.id] && refs.some((r) => r.tipo === 'cafe' && r.slots.includes(s) && r.slots.some((x) => x.on && x !== s && (x.papel === 'suco' || /^suco-/.test(x.id))));
  const passo = (s, d) => {
    let g = encaixa(s.g + d * s.lim[2], s.lim);
    if (d > 0 && g > s.g && comSuco(s) && g > MEDIDAS[s.id][0] + 1) g = s.g;
    return (d > 0 ? g > s.g : g < s.g) ? g : 0;
  };
  const muda = (s, d) => { const g = passo(s, d); if (g) s.g = g; return !!g; };
  // liga um complemento do modelo: o alimento que ainda não está na refeição nem aparece 2 vezes no dia (os que ainda
  // não apareceram primeiro), começando pela porção mínima. O segundo alimento de proteína não é da mesma família
  // do primeiro (ovo com queijo, sim; dois queijos ou tofu com soja, não).
  const candidatos = (r, s) => {
    if (s.on || cheia(r)) return [];
    // lanche e ceia: um complemento só (iogurte com aveia, e não aveia e chia)
    // (lanche grande, de mais de 400 kcal: dois)
    if (s.k === 'extra' && (r.tipo === 'lanche' || r.tipo === 'ceia') && r.slots.filter((x) => x.on && x.k === 'extra').length >= (r.alvo > 400 ? 2 : 1)) return [];
    // uma bebida só; com suco, uma fruta; pasta de amendoim só com pão, biscoito, tapioca ou aveia
    if (!complementoCabe(r, s)) return [];
    const p1 = s.k === 'prot2' ? r.slots.find((x) => x.k === 'prot' && x.on) : null;
    const papeis = p1 && r.tipo !== 'principal' ? s.papeis.filter((p) => !PAPEIS[p][0].includes(p1.id) && !PAPEIS[p][1].includes(p1.id)) : s.papeis;
    const c = opcoes(papeis, ctx, r.tipo).filter((id) => !r.slots.some((x) => x.on && x.id === id) && noDia(id) < 2);
    const n0 = c.length ? ((r.seed % c.length) + c.length) % c.length : 0;
    return c.map((_, i) => c[(n0 + i) % c.length]);
  };
  // `prot`: para fechar a proteína, o mais concentrado primeiro
  const ligar = (r, s, prot = false) => {
    const c = candidatos(r, s).sort((a, b) => (prot ? densidade(b) - densidade(a) : 0) || noDia(a) - noDia(b));
    if (!c.length) return false;
    s.id = c[0]; s.lim = limite(s.id, r.tipo, s.papel); s.g = s.lim[0]; s.on = true;
    return true;
  };
  // entre os complementos de uma refeição, liga o que traz um alimento ainda não usado no dia
  // (entre os empatados, gira pela semente: nem todo dia tem farofa)
  const ligarNaRefeicao = (r, quer, semRepetir = false) => {
    const lugares = r.slots.filter((s) => !s.on && quer(s));
    const n0 = lugares.length ? ((r.seed % lugares.length) + lugares.length) % lugares.length : 0;
    // (com muita energia faltando, entre os que não repetem, o que comporta mais: sobremesa e suco antes da batata)
    const falta = K - total();
    const cabeMais = (s, c) => Math.max(...c.map((id) => (FOOD.get(id).kcal * limite(id, r.tipo, s.papel)[1]) / 100));
    let melhor = null, nota = Infinity;
    for (const s of lugares.map((_, i) => lugares[(n0 + i) % lugares.length])) {
      const c = candidatos(r, s);
      if (!c.length) continue;
      const n = Math.min(...c.map(noDia)) - (falta > K * 0.08 ? cabeMais(s, c) / 1000 : 0);
      if (n < nota) { nota = n; melhor = s; }
    }
    nota = Math.ceil(nota);
    return !!melhor && !(semRepetir && nota > 0) && ligar(r, melhor);
  };
  const desligar = (s) => { s.on = false; s.id = null; };
  // a refeição continua com pelo menos 90 kcal se o lugar `s` passar a ter `g` gramas (0: sair)
  // (lanche e ceia: 65 kcal, uma fruta)
  const fica = (r, s, g) => somaSlots(r) - kDe(s) + (g ? (FOOD.get(s.id).kcal * g) / 100 : 0) >= (r.tipo === 'lanche' || r.tipo === 'ceia' ? 65 : 90);
  const ligarUm = (tipos, quer, prot = false) => { for (const t of tipos) for (const r of refs) if (r.tipo === t) for (const s of r.slots) if (!s.on && quer(s) && ligar(r, s, prot)) return true; return false; };
  const TIPOS = ['principal', 'cafe', 'lanche', 'ceia'];
  const proteina = () => {
    for (let k = 0; k < 300; k++) {
      const p = total('p');
      if (p < P * 0.96) {
        let melhor = null;
        for (const r of refs) for (const s of r.slots) if (s.on && LUGAR_PROT.has(s.k) && dens(s) >= 0.04 && passo(s, 1) && (!melhor || dens(s) > dens(melhor))) melhor = s;
        if (melhor) { muda(melhor, 1); continue; }
        // tudo no máximo: um reforço — no prato (ovo, ou soja e grão-de-bico sem carne), depois no café e nos lanches
        if (ligarUm(TIPOS, (s) => s.k === 'prot2' || s.k === 'bebida' || (s.k === 'extra' && s.papel === 'feijao'), true)) continue;
        break;
      } else if (p > P * 1.1) {
        // sobra proteína: cedem primeiro as fontes fora do prato, as mais concentradas antes
        let melhor = null, chave = Infinity;
        for (const r of refs) for (const s of r.slots) if (s.on && LUGAR_PROT.has(s.k) && passo(s, -1) && fica(r, s, passo(s, -1))) { const c = (r.tipo === 'principal' ? 10 : 0) - dens(s); if (c < chave) { chave = c; melhor = s; } }
        if (melhor) { muda(melhor, -1); continue; }
        const op = refs.flatMap((r) => r.slots.map((s) => [r, s])).find(([r, s]) => s.on && s.opc && (s.k === 'prot2' || s.k === 'bebida') && fica(r, s, 0));
        if (op) { desligar(op[1]); continue; }
        // tudo na porção mínima e a proteína ainda passa de 25% da meta (metas baixas): o lanche fica só com a fruta, e o
        // prato de quem come carne pode ficar sem a leguminosa
        if (p > P * 1.25) {
          // (a fruta vai à porção máxima, para o lanche não ficar com menos de 60 kcal)
          const frutaMax = (r) => { const fr = r.slots.find((x) => x.on && x.k === 'fruta'); return fr ? (FOOD.get(fr.id).kcal * fr.lim[1]) / 100 : 0; };
          const lanche = refs.filter((r) => r.tipo === 'lanche' || r.tipo === 'ceia').flatMap((r) => r.slots.filter((s) => s.on && s.k === 'prot' && r.slots.some((x) => x.on && x.k === 'fruta') && (somaSlots(r) - kDe(s) >= 60 || (r.slots.filter((x) => x.on).length === 2 && frutaMax(r) >= 60))).map((s) => [r, s]))[0];
          if (lanche) { desligar(lanche[1]); const fr = lanche[0].slots.find((x) => x.on && x.k === 'fruta'); if (somaSlots(lanche[0]) < 60) fr.g = fr.lim[1]; continue; }
          // o lanche de pão ou tapioca com queijo ou ovo troca a proteína pela fruta do modelo (tapioca com banana)
          const semFruta = refs.filter((r) => r.tipo === 'lanche' || r.tipo === 'ceia').map((r) => [r, r.slots.find((s) => s.on && s.k === 'prot'), r.slots.find((s) => !s.on && s.k === 'fruta' && s.opc)]).find(([, pr, fr]) => pr && fr);
          if (semFruta && ligar(semFruta[0], semFruta[2])) { desligar(semFruta[1]); while (somaSlots(semFruta[0]) < 65 && muda(semFruta[2], 1)); continue; }
          // (sem deixar o dia com menos de 20 g de fibras)
          const leg = !ctx.semCarne && refs.filter((r) => r.tipo === 'principal').flatMap((r) => r.slots.filter((s) => s.on && s.k === 'leg' && r.slots.some((x) => x.on && x.k === 'prot')))[0];
          if (leg && total('fibra') - kDe(leg, 'fibra') >= 20) { desligar(leg); continue; }
        }
        break;
      } else break;
    }
  };
  const energia = (lo, hi) => {
    for (let k = 0; k < 400; k++) {
      const e = total();
      if (e < K * lo) {
        let feito = false;
        // com a proteína já acima da meta, a energia vem de alimentos com pouca proteína (óleo, fruta, arroz, suco)
        const leve = total('p') > P * 1.06;
        const ordem = refs.slice().sort((a, b) => (b.alvo - somaSlots(b)) - (a.alvo - somaSlots(a))).filter((r) => somaSlots(r) <= K * 0.48);
        // Em cada refeição, nesta ordem: a base e a leguminosa crescem juntas (a que está mais longe do máximo primeiro);
        // depois entra um complemento do modelo (fruta de sobremesa, suco, farofa, manteiga no pão...), primeiro os que
        // trazem um alimento ainda não usado no dia; depois os complementos crescem; o óleo, por último.
        const enche = (s) => (s.g - s.lim[0]) / Math.max(1, s.lim[1] - s.lim[0]);
        for (const so of leve ? [true, false] : [false]) {
          const quer = (s) => s.opc && s.k !== 'prot2' && (!so || s.k !== 'bebida');
          for (const r of ordem) {
            // (na segunda volta, com a proteína até 20% acima da meta, o ovo e o queijo do café e do lanche também crescem)
            const pOk = !so && total('p') < P * 1.2;
            const sobe = r.slots.filter((s) => s.on && (LUGAR_ENERGIA.has(s.k) || (s.k === 'prot' && (dens(s) < 0.05 || (pOk && r.tipo !== 'principal')))) && (!so || dens(s) < 0.04) && passo(s, 1));
            const base = sobe.filter((s) => s.k === 'base' || s.k === 'leg').sort((a, b) => enche(a) - enche(b))[0];
            if (base) { muda(base, 1); feito = true; break; }
            if (ligarNaRefeicao(r, quer, true)) { feito = true; break; }
            const outro = sobe.filter((s) => s.k !== 'base' && s.k !== 'leg' && s.k !== 'oleo').sort((a, b) => dens(a) - dens(b))[0] || sobe.find((s) => s.k === 'oleo');
            if (outro) { muda(outro, 1); feito = true; break; }
            if (ligarNaRefeicao(r, quer, false)) { feito = true; break; }
          }
          if (feito) break;
        }
        if (feito) continue;
        // tudo no máximo: a proteína do prato cresce (até 20% acima da meta, ou 15% das calorias com meta de proteína
        // baixa) ou entra o reforço do modelo
        if (total('p') < P * 1.12) {
          let melhor = null;
          for (const r of refs) if (r.tipo === 'principal') for (const s of r.slots) if (s.on && (s.k === 'prot' || s.k === 'prot2') && passo(s, 1) && (!melhor || dens(s) < dens(melhor))) melhor = s;
          if (melhor) { muda(melhor, 1); continue; }
          if (ligarUm(['principal'], (s) => s.k === 'prot2')) continue;
        }
        break;
      } else if (e > K * hi) {
        let feito = false;
        // nenhuma refeição fica com menos de 90 kcal
        const cabe = fica;
        for (const r of refs.slice().sort((a, b) => (somaSlots(b) - b.alvo) - (somaSlots(a) - a.alvo))) {
          let melhor = null;
          // (castanhas, amendoim e pasta de amendoim, mesmo no lugar da proteína, são mais energia que proteína; com a
          // proteína abaixo da meta, feijão e leite só cedem se as calorias passarem de 6% acima)
          const segura = total('p') < P * 0.96 && e <= K * 1.075;
          for (const s of r.slots) if (s.on && (LUGAR_ENERGIA.has(s.k) || (s.k === 'prot' && dens(s) < 0.05)) && !(segura && dens(s) >= 0.045) && passo(s, -1) && cabe(r, s, passo(s, -1)) && (!melhor || dens(s) < dens(melhor))) melhor = s;
          if (melhor) { muda(melhor, -1); feito = true; break; }
          // (com a proteína abaixo da meta, o leite do café e outros complementos com proteína ficam)
          // (passando de 8% acima nas calorias, a meta de calorias vem primeiro)
          const pBaixa = total('p') < P && e <= K * 1.08;
          const op = r.slots.filter((s) => s.on && s.opc && s.k !== 'prot2' && cabe(r, s, 0) && !(pBaixa && dens(s) >= 0.04)).sort((a, b) => dens(a) - dens(b))[0];
          if (op) { desligar(op); feito = true; break; }
        }
        if (feito) continue;
        // Tudo na porção mínima e ainda acima de 5%: o lanche ou a ceia ficam só com a fruta, e o prato de quem come carne
        // pode ficar sem a leguminosa (arroz, carne e salada) — as porções não descem abaixo do mínimo de referência.
        if (e > K * 1.05) {
          // (a fruta do lanche vai à porção máxima, para a refeição não ficar com menos de 60 kcal)
          const soFruta = (r) => { const fr = r.slots.find((x) => x.on && x.k === 'fruta'); return fr ? (FOOD.get(fr.id).kcal * fr.lim[1]) / 100 : 0; };
          const fora = refs.filter((r) => r.tipo === 'lanche' || r.tipo === 'ceia').flatMap((r) => r.slots.filter((s) => s.on && s.k === 'prot' && soFruta(r) >= 60 && r.slots.filter((x) => x.on).length === 2).map((s) => [r, s]))[0];
          if (fora && ((!ctx.semCarne && total('p') - kDe(fora[1], 'p') >= P * 0.9) || (e > K * 1.08 && total('p') - kDe(fora[1], 'p') >= P * 0.86))) { desligar(fora[1]); const fr = fora[0].slots.find((x) => x.on && x.k === 'fruta'); fr.g = fr.lim[1]; continue; }
          // o lanche de tapioca ou pão com ovo ou queijo troca a proteína pela fruta do modelo (tapioca com banana)
          const troca = refs.filter((r) => r.tipo === 'lanche' || r.tipo === 'ceia').map((r) => [r, r.slots.find((s) => s.on && s.k === 'prot'), r.slots.find((s) => !s.on && s.k === 'fruta' && s.opc)]).find(([, pr, fr]) => pr && fr && total('p') - kDe(pr, 'p') >= P * 0.9);
          if (troca && !ctx.semCarne && ligar(troca[0], troca[2])) { desligar(troca[1]); const fr = troca[2]; while (somaSlots(troca[0]) < 65 && muda(fr, 1)); continue; }
          const leg = !ctx.semCarne && refs.filter((r) => r.tipo === 'principal').flatMap((r) => r.slots.filter((s) => s.on && s.k === 'leg' && r.slots.some((x) => x.on && x.k === 'prot')))[0];
          if (leg && total('p') - kDe(leg, 'p') >= P * 0.9 && total('fibra') - kDe(leg, 'fibra') >= 20) { desligar(leg); continue; }
        }
        // tudo no mínimo: as fontes de proteína cedem (as menos concentradas primeiro), sem a proteína do dia cair abaixo
        // de 87% da meta (e só quando as calorias passam de 6% acima da meta: até lá, vale mais a proteína)
        if (total('p') <= P * 0.87 || e <= K * 1.075) break;
        let melhor = null;
        for (const r of refs) for (const s of r.slots) if (s.on && (s.k === 'prot' || s.k === 'prot2' || s.k === 'leg') && passo(s, -1) && fica(r, s, passo(s, -1)) && (!melhor || dens(s) < dens(melhor))) melhor = s;
        if (melhor) { muda(melhor, -1); continue; }
        const op = refs.flatMap((r) => r.slots).find((s) => s.on && s.k === 'prot2');
        if (op) { desligar(op); continue; }
        break;
      } else break;
    }
  };
  // quem corre: sobe o carboidrato (arroz, massa, pão, fruta, suco) e a gordura (óleo, manteiga, castanhas) cede
  const carboidrato = () => {
    for (let k = 0; k < 80 && total('c') < res.carb * 0.95; k++) {
      const copia = refs.map((r) => r.slots.map((s) => ({ ...s })));
      let melhor = null;
      for (const r of refs) for (const s of r.slots) if (s.on && LUGAR_ENERGIA.has(s.k) && fracao(s, 'c') >= 0.5 && passo(s, 1) && (!melhor || s.lim[1] - s.g > melhor.lim[1] - melhor.g)) melhor = s;
      if (melhor) muda(melhor, 1);
      else if (!ligarUm(TIPOS, (s) => s.opc && s.k !== 'prot2' && CARBO_EXTRA.has(s.papel))) break;
      for (let j = 0; j < 30 && total() > K * 1.03; j++) {
        let g = null;
        // (as fontes de proteína não cedem: ovo e soja também são gordos)
        for (const r of refs) for (const s of r.slots) if (s.on && !LUGAR_PROT.has(s.k) && fracao(s, 'g') >= 0.5 && passo(s, -1) && fica(r, s, passo(s, -1)) && (!g || kDe(s) > kDe(g))) g = s;
        if (g) { muda(g, -1); continue; }
        const op = refs.flatMap((r) => r.slots.map((s) => [r, s])).find(([r, s]) => s.on && s.opc && !LUGAR_PROT.has(s.k) && fracao(s, 'g') >= 0.5 && fica(r, s, 0));
        if (op) { desligar(op[1]); continue; }
        break;
      }
      if (total() > K * 1.05) { refs.forEach((r, i) => { r.slots = copia[i]; }); break; }
    }
  };
  for (let rodada = 0; rodada < 4; rodada++) {
    proteina();
    energia(0.97, 1.03);
    const p = total('p'), e = total();
    if (p >= P * 0.96 && p <= P * 1.1 && e >= K * 0.97 && e <= K * 1.03) break;
  }
  // a proteína ainda abaixo da meta: as fontes mais concentradas sobem enquanto as calorias não passam de 7% acima
  for (let k = 0; k < 40 && total('p') < P * 0.95; k++) {
    let melhor = null;
    for (const r of refs) for (const s of r.slots) if (s.on && LUGAR_PROT.has(s.k) && dens(s) >= 0.08 && passo(s, 1) && total() + (FOOD.get(s.id).kcal * (passo(s, 1) - s.g)) / 100 <= K * 1.07 && (!melhor || dens(s) > dens(melhor))) melhor = s;
    if (!melhor) {
      // (só se o que falta é espaço nas calorias, e não porção: alguma fonte concentrada ainda pode crescer)
      if (!refs.some((r) => r.slots.some((s) => s.on && LUGAR_PROT.has(s.k) && dens(s) >= 0.08 && passo(s, 1)))) break;
      // sem espaço nas calorias: sai um complemento que é quase só energia (manteiga, coco, castanhas do lanche com fruta)
      const solta = refs.flatMap((r) => r.slots.map((s) => [r, s])).find(([r, s]) => s.on && dens(s) < 0.05 && ((s.opc && s.k === 'extra') || (s.k === 'prot' && (r.tipo === 'lanche' || r.tipo === 'ceia') && r.slots.some((x) => x.on && x.k === 'fruta'))) && somaSlots(r) - kDe(s) >= 60);
      if (!solta) break;
      desligar(solta[1]);
      continue;
    }
    muda(melhor, 1);
  }
  // Proteína ainda acima da meta com as fontes no mínimo (metas baixas: arroz, massa e pão já trazem bastante): a energia
  // de alimentos com proteína dá lugar à de alimentos quase sem ela (óleo, fruta, suco, coco).
  const LEVES = new Set(['sobremesa', 'suco', 'fruta', 'mel', 'coco']);
  // a energia volta pela refeição mais abaixo da sua parte da meta, com o que tem pouca proteína
  const repor = () => {
    for (let j = 0; j < 12 && total() < K * 0.97; j++) {
      let feito = false;
      for (const r of refs.slice().sort((a, b) => (b.alvo - somaSlots(b)) - (a.alvo - somaSlots(a)))) {
        let sobe = null;
        for (const s of r.slots) if (s.on && LUGAR_ENERGIA.has(s.k) && dens(s) < 0.025 && passo(s, 1) && somaSlots(r) - kDe(s) + (FOOD.get(s.id).kcal * passo(s, 1)) / 100 <= K * 0.5 && (!sobe || dens(s) < dens(sobe))) sobe = s;
        if (sobe) { muda(sobe, 1); feito = true; break; }
        if (somaSlots(r) < K * 0.45 && ligarNaRefeicao(r, (s) => s.opc && ((s.k === 'extra' && LEVES.has(s.papel)) || s.k === 'fruta'))) { feito = true; break; }
      }
      if (!feito) break;
    }
  };
  for (let k = 0; k < 80 && total('p') > P * 1.1; k++) {
    let desce = null;
    for (const r of refs) for (const s of r.slots) if (s.on && (LUGAR_ENERGIA.has(s.k) || (r.tipo !== 'principal' && LUGAR_PROT.has(s.k) && dens(s) >= 0.05)) && dens(s) >= 0.025 && passo(s, -1) && fica(r, s, passo(s, -1)) && (!desce || dens(s) > dens(desce))) desce = s;
    const antes = refs.map((r) => r.slots.map((s) => ({ ...s })));
    if (desce) muda(desce, -1);
    else {
      // no mínimo: sai um complemento com proteína (a aveia do lanche, o leite do café)
      const op = refs.flatMap((r) => r.slots.map((s) => [r, s])).find(([r, s]) => s.on && s.opc && s.k !== 'fruta' && dens(s) >= 0.03 && somaSlots(r) - kDe(s) >= 70);
      if (!op) break;
      desligar(op[1]);
    }
    repor();
    if (total() < K * 0.95) { refs.forEach((r, i) => { r.slots = antes[i]; }); break; }
  }
  if (res.corrida && res.carb) { carboidrato(); energia(0.95, 1.05); }
  if (total() > K * 1.06) energia(0.9, 1.04);
}

const PLANO_REF = {
  3: [['cafe', 'Café da manhã', 0.27, 0.3], ['principal', 'Almoço', 0.4, 0.37], ['principal', 'Jantar', 0.33, 0.33]],
  4: [['cafe', 'Café da manhã', 0.24, 0.24], ['principal', 'Almoço', 0.34, 0.32], ['lanche', 'Lanche da tarde', 0.14, 0.14], ['principal', 'Jantar', 0.28, 0.3]],
  5: [['cafe', 'Café da manhã', 0.21, 0.21], ['lanche', 'Lanche da manhã', 0.1, 0.1], ['principal', 'Almoço', 0.31, 0.3], ['lanche', 'Lanche da tarde', 0.13, 0.13], ['principal', 'Jantar', 0.25, 0.26]],
  6: [['cafe', 'Café da manhã', 0.2, 0.2], ['lanche', 'Lanche da manhã', 0.09, 0.1], ['principal', 'Almoço', 0.29, 0.27], ['lanche', 'Lanche da tarde', 0.12, 0.12], ['principal', 'Jantar', 0.23, 0.23], ['ceia', 'Ceia', 0.07, 0.08]],
};

// Gera um dia de exemplo. `semente` troca os alimentos (botão "Outra sugestão").
// Com `emCasa` (lista de ids), o dia é montado só com esses alimentos e `faltas` diz o que faltou (ver faltasDaCasa).
// `trocas` (opcional): [k0, k1, ...], uma por refeição na ordem do dia. k > 0 troca aquela refeição por outra montada
// com os mesmos grupos de alimentos (o "Trocar" do cardápio): as outras refeições são montadas como antes, e o dia
// passa de novo pelo ajuste fino para fechar a mesma meta (que pode mexer em quantidades e complementos das outras).
// Cada refeição devolvida traz `ordem` (posição no dia).
export function cardapio(res, semente = 0, { emCasa = null, trocas = null } = {}) {
  if (!res || res.modo === 'educativo' || !res.kcal) return null;
  const seed = Math.abs(Math.floor(Number(semente))) % 1000000 || 0;
  const ref = PLANO_REF[res.refeicoes] || PLANO_REF[4];
  const ctx = contexto(res, emCasa);
  const usados = new Map();
  const rico = (res.prot * 4) / res.kcal >= 0.26;
  // meta de proteína baixa (menos de 20% das calorias): o prato prefere a proteína que, na porção mínima, não passa da conta
  ctx.protBaixa = (res.prot * 4) / res.kcal < 0.2;
  const seedDe = (tipo, i) => seed + i * 2 + (tipo === 'principal' ? i : 0);
  // o modelo de cada refeição gira com a semente (e com a troca): dias seguidos têm combinações diferentes
  const monta = (i, tr, us) => { const [tipo, nome, fk, fp] = ref[i]; return Object.assign(refeicao(tipo, nome, res.kcal * fk, res.prot * fp, ctx, seedDe(tipo, i) + tr * 7, seed + (tipo === 'principal' ? 0 : i) + tr, us, rico), { ordem: i }); };
  let refs = ref.map((_, i) => monta(i, 0, usados));
  const tr = Array.isArray(trocas) ? trocas.map((k) => Math.max(0, Math.floor(Number(k)) || 0)) : [];
  for (let i = 0; i < ref.length; i++) {
    if (!tr[i]) continue;
    // a refeição trocada evita os alimentos que já estão nas outras (como no dia original)
    const outros = new Map();
    refs.forEach((r, j) => { if (j !== i) for (const s of r.slots) if (s.on) outros.set(s.id, (outros.get(s.id) || 0) + 1); });
    refs[i] = monta(i, tr[i], outros);
  }
  refs = refs.filter((r) => r.slots.some((s) => s.on));
  if (refs.length) balancear(refs, res, ctx);
  const refeicoes = refs.map((r) => {
    // (o azeite do prato é o tempero da salada: a medida diz isso)
    const itens = r.slots.filter((s) => s.on).map((s) => { const x = porcao(s.id, s.g); if (s.k === 'oleo') x.medida = x.medida.replace(/^(\d+ g)(?: \((.*)\))?$/,(t, g, m) => `${g} (${m ? m + ', ' : ''}na salada)`); return x; });
    return { nome: r.nome, tipo: r.tipo, itens, kcal: soma(itens, 'kcal'), p: soma(itens, 'p'), c: soma(itens, 'c'), g: soma(itens, 'gd'), fibra: soma(itens, 'fibra'), ordem: r.ordem };
  }).filter((r) => r.itens.length);
  const dia = { refeicoes, kcal: soma(refeicoes, 'kcal'), p: soma(refeicoes, 'p'), c: soma(refeicoes, 'c'), g: soma(refeicoes, 'g'), fibra: soma(refeicoes, 'fibra') };
  if (ctx.casa) dia.faltas = faltasDaCasa(res, emCasa, dia);
  return dia;
}
// Se, mesmo assim, o dia de quem corre ficar mais de 10% abaixo da meta de carboidrato, a tela diz quanto falta e como
// completar com comida comum (respeitando as restrições).
export function faltaDeCarboidrato(res, dia) {
  if (!res || !res.corrida || !res.carb || !dia || !(dia.c < res.carb * 0.9)) return null;
  const falta = r5(res.carb - dia.c);
  const rest = restricoesDe(res);
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
  const caseira = BEBIDA_CASEIRA;
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
  if (!semNumeros && !cond.includes('hipertensao')) blocos.push({ titulo: 'Cafeína', linhas: [CAFEINA_CORRIDA] });
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
  // alergias (res.alergias): os exemplos não citam amendoim, ovo, leite, soja nem peixe para quem tem alergia a eles
  const alg = alergiasDe(res);
  const am = alg.includes('amendoim'), ov = alg.includes('ovo'), lt = alg.includes('leite'), sj = alg.includes('soja'), px = alg.includes('peixe');
  const ou = (l) => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' ou ' + l[l.length - 1]);
  const pre = [];
  if (veg) {
    pre.push(am ? '2 bananas + 2 colheres de sopa de ' + grao : '2 bananas + 1 colher de sopa de pasta de amendoim + 1 colher de sopa de ' + grao);
    pre.push(sg ? (sj ? '1 tapioca média com banana + 1 fruta' : '1 tapioca média com tofu mexido + 1 fruta') : am ? '1 pão francês com banana amassada + 1 fruta' : '2 fatias de pão com pasta de amendoim + 1 fruta');
  } else {
    pre.push(lt ? '2 bananas + ' + (sg ? '1 colher de sopa de chia' : '2 colheres de sopa de aveia') : `1 banana + 1 pote de ${iogurte} + ` + (sg ? '1 colher de sopa de chia' : '2 colheres de sopa de aveia'));
    const recheio = [ov ? '' : '2 ovos mexidos', sl || lt ? '' : 'queijo branco', ov && (sl || lt) ? 'frango desfiado' : ''].filter(Boolean);
    pre.push((sg ? '1 tapioca média' : '1 pão francês') + ` com ${ou(recheio)} + 1 fruta`);
  }
  pre.push('Se a refeição principal (almoço ou jantar) for 2 a 3 horas antes, ela já serve como pré-treino.');
  const pos = [];
  const prato = veg ? (sj ? ['grão-de-bico', 'lentilha'] : ['tofu', 'soja', 'grão-de-bico'])
    : vgt ? [ov ? '' : 'ovos', sl || lt ? '' : 'queijo', sj ? '' : 'tofu', ov && sj ? 'grão-de-bico' : ''].filter(Boolean)
      : ['frango', 'carne', px ? '' : 'peixe', ov ? '' : 'ovos'].filter(Boolean);
  pos.push('A próxima refeição principal do dia: arroz, feijão, uma porção de ' + ou(prato) + ' e salada.');
  const lanche = vgt || veg ? '' : sg ? `, ou tapioca com ${px ? 'frango' : 'frango ou atum'}` : `, ou sanduíche de ${px ? 'frango' : 'frango ou atum'}`;
  if (veg) pos.push((sj ? 'Banana com ' : 'Vitamina de bebida de soja com banana e ') + grao + ', se a refeição for demorar.');
  else if (lt) pos.push((sj ? 'Banana com ' + grao : 'Vitamina de bebida de soja com banana e ' + grao) + lanche + ', se a refeição for demorar.');
  else pos.push((sl ? (sj ? 'Vitamina de leite sem lactose' : 'Vitamina de leite sem lactose ou bebida de soja') : 'Vitamina de leite ou iogurte') + ' com banana e ' + grao + lanche + ', se a refeição for demorar.');
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

// ---------- suplementos e pré-treino ----------
// Doses só para quem pode usá-las sem orientação. Menores de 18, gestantes e lactantes, doença renal e transtorno
// alimentar (modo educativo) não veem dose nenhuma; com pressão alta, doença do coração, outra doença crônica ou um
// sinal de alerta (de qualquer entrevista: a união está em logic/saude.js), a cafeína e tudo o que é estimulante ou
// pede liberação ficam sem dose, e o pré-treino pronto sai.
// Fontes, todas lidas em texto completo (o que cada uma diz está anotado em data/knowledge.js, perto das REFS):
//  • creatina: 3 a 5 g por dia; até 1 a 2 kg de água no começo; sem efeito ruim em até 4 anos (refs kreider2017,
//    maughan2018); no Brasil, o rótulo pode indicar de 3 a 5 g por dia (ref anvisa_in28);
//  • cafeína: 3 a 6 mg/kg, 60 min antes; 9 mg/kg ou mais não rende mais e dá enjoo, ansiedade e insônia (refs guest2021,
//    maughan2018); seguro para adultos: até 200 mg por vez (cerca de 3 mg/kg) e 400 mg no dia (cerca de 5,7 mg/kg), de
//    todas as fontes (ref efsa2015); no Brasil, suplemento com até 200 mg na recomendação diária, 400 mg só para atletas
//    com doses de até 200 mg, e não permitido de 9 a 18 anos, na gestação e na amamentação (ref anvisa_in28);
//  • beta-alanina: 4 a 6 g/dia por 2 a 4 semanas, efeito maior em esforços de 1 a 4 min; único efeito colateral, o
//    formigamento (ref trexler2015); no Brasil, rótulo com até 2 g/dia em doses de até 300 mg (ref anvisa_in28);
//  • nitrato: 5 a 9 mmol (310 a 560 mg), 2 a 3 h antes; efeito em esforços de 12 a 40 min, incerto abaixo de 12;
//    bicarbonato: 0,2 a 0,4 g/kg, 60 a 150 min antes, para esforços de cerca de 60 s, perdendo o efeito acima de 10 min,
//    com desconforto intestinal bem conhecido (ref maughan2018, tabela 3; grupo A da ref ais_abcd);
//  • vitamina D e ferro: suplementar sem avaliação não é recomendado; ferro em dose alta só com falta de ferro (ref
//    maughan2018, tabela 1);
//  • pré-treino pronto: cafeína de 250 a 400 mg por dose e não passar de uma (ref jagim2019); doses abaixo do eficaz e
//    misturas sem a quantidade no rótulo; DMAA retirado do mercado depois de 6 mortes (ref harty2018); sinefrina com
//    cafeína: pulso e pressão (refs bfr2012, bella2025); ioimbina (ref porrill2024); DMAA proibido no Brasil (ref
//    anvisa2013); em suplemento só entram os constituintes da IN 28, que não tem sinefrina, ioimbina nem DMAA (refs
//    anvisa_rdc243, anvisa_in28); sono: a mesma regra de data/sono.js (ref gardiner2023);
//  • sem evidência: "queimadores" (ref maughan2018), BCAA, glutamina e tribulus (refs kerksick2018, ais_abcd),
//    anabolizantes e SARMs (refs cfm2333, maughan2018).
const CAFE_XICARA_MG = 100;   // uma xícara de café: cerca de 100 mg (ref gardiner2023 — a mesma conta da tela do sono)
// O que tira as doses e o pré-treino (a mesma trava da cafeína de antes, agora para todo estimulante)
function travasDeSuplemento(res) {
  const cond = res && Array.isArray(res.condicoes) ? res.condicoes : [];
  const educ = !res || res.modo === 'educativo';
  // Sem dose de cafeína com pressão alta, doença do coração (inclui arritmia), outra doença crônica ou um sinal de alerta
  // marcado na triagem de qualquer entrevista: o aviso de sempre já diz "pressão alta ou arritmia" e "remédios de uso
  // contínuo" (refs guest2021, efsa2015); com sinal de alerta, a primeira coisa é a avaliação médica (ref whitfield2017).
  const estimulo = cond.includes('hipertensao') || cond.includes('cardiaco') || cond.includes('outra') || cond.includes('sinal');
  return { cond, educ, estimulo, semCafeina: educ || estimulo };
}
// Cafeína que ainda cabe no pré-treino, somando o café do dia. Por vez, até 200 mg; no dia, até 400 mg (ref efsa2015).
// A EFSA dá os mesmos limites por quilo (3 e 5,7 mg/kg, os de um adulto de 70 kg): abaixo de 70 kg o aplicativo usa o
// valor proporcional, mais baixo (escolha conservadora). Arredonda para baixo, de 10 em 10 mg. Sem dose (modo educativo
// ou trava de estimulante), devolve null.
export function limiteDeCafeina(res, xicaras = 0) {
  if (travasDeSuplemento(res).semCafeina) return null;
  const peso = typeof res.peso === 'number' && Number.isFinite(res.peso) ? Math.min(250, Math.max(30, res.peso)) : 70;
  const dez = (n) => Math.floor(n / 10 + 1e-9) * 10;
  const porVez = Math.min(200, dez((200 * peso) / 70));
  const noDia = Math.min(400, dez((400 * peso) / 70));
  const x = Math.min(10, Math.max(0, Math.floor(Number(xicaras)) || 0));
  const doCafe = x * CAFE_XICARA_MG;
  const sobra = Math.max(0, Math.min(porVez, noDia - doCafe));
  const qx = x === 1 ? '1 xícara de café' : `${x} xícaras de café`;
  const texto = !x ? `Sem café no dia, cabem até ${sobra} mg de cafeína no pré-treino.`
    : sobra > 0 ? `Com ${qx} (cerca de ${doCafe} mg), cabem até ${sobra} mg de cafeína no pré-treino.`
      : `Com ${qx} (cerca de ${doCafe} mg), você já ${doCafe > noDia ? 'passa do' : 'chega ao'} limite do dia: pré-treino com cafeína, não.`;
  return { porVez, noDia, xicaras: x, doCafe, sobra, texto };
}
// DMAA, sinefrina e ioimbina: a mesma linha para quem pode e para quem não pode usar pré-treino
const PRE_PROIBIDOS = { titulo: 'Fuja destes', texto: 'DMAA, ioimbina e sinefrina (laranja-amarga). Nenhum é permitido em suplemento no Brasil, e o DMAA é proibido.',
  porque: 'Eles sobem o pulso e a pressão, ainda mais com cafeína, e já foram ligados a arritmia, AVC, convulsão e morte: o DMAA saiu do mercado americano depois de 6 mortes e mais de 100 casos de doença. A Anvisa também pede para não usar produto importado sem rótulo em português.',
  refs: ['anvisa_rdc243', 'anvisa_in28', 'anvisa2013', 'harty2018', 'bfr2012', 'bella2025', 'porrill2024'] };
const SEM_EVIDENCIA = [
  { nome: 'Termogênicos e “queimadores”', texto: 'quase nenhum tem prova de que emagrece; muitos são cafeína com outros estimulantes.', refs: ['maughan2018', 'anvisa2013'] },
  { nome: 'BCAA', texto: 'quem já come a proteína do dia não ganha nada: a comida e o whey já trazem BCAA.', refs: ['kerksick2018', 'ais_abcd'] },
  { nome: 'Glutamina', texto: 'não aumentou massa muscular nem força nos estudos.', refs: ['kerksick2018'] },
  { nome: 'Tribulus e “testosterona natural”', texto: 'não mudam força nem massa, e atletas não devem usar: há risco de contaminação.', refs: ['kerksick2018', 'ais_abcd'] },
  { nome: 'Anabolizantes e SARMs', texto: 'nunca. Fazem mal ao fígado e ao comportamento; no Brasil, o médico não pode receitá-los para estética ou desempenho.', refs: ['cfm2333', 'maughan2018'] },
];
// Por que o pré-treino pronto sai, em uma linha (o caso mais protegido primeiro)
function motivoSemPreTreino(res, t) {
  const c = t.cond;
  if (res && res.idade < 18) return { texto: 'Antes dos 18 anos, pré-treino e energético não. A Anvisa não permite suplemento de cafeína para menores, e a Academia Americana de Pediatria diz que energético não é para crianças e adolescentes.', refs: ['anvisa_in28', 'temple2017'] };
  if (c.includes('gestante') || c.includes('posparto')) return { texto: 'Na gestação e na amamentação, pré-treino não: a Anvisa não permite suplemento de cafeína nessa fase. O café do dia, combine com o seu médico.', refs: ['anvisa_in28', 'efsa2015'] };
  if (c.includes('renal')) return { texto: 'Com doença nos rins, pré-treino e outros suplementos só com o seu médico.', refs: ['anvisa2013'] };
  if (c.includes('transtorno')) return { texto: 'Com histórico de transtorno alimentar, pré-treino e produtos para emagrecer não. Converse com quem acompanha você.', refs: ['anvisa2013'] };
  if (t.estimulo) return { texto: 'Com pressão alta, doença do coração, outra doença crônica ou um sinal de alerta, pré-treino não: os estimulantes sobem o pulso e a pressão. Converse com o seu médico.', refs: ['bfr2012', 'bella2025', 'anvisa2013'] };
  return { texto: 'No seu caso, pré-treino só com orientação do seu médico ou nutricionista.', refs: ['anvisa2013', 'harty2018'] };
}
// Devolve { semDoses, semCafeina, semPreTreino, intro, linhas (as boas, em texto: "Nome: texto"), boas: [{ id, nome,
// texto, porque, refs }], preTreino: { bloqueado, intro, introRefs, itens: [{ titulo, texto, porque?, refs, cafeina? }] },
// semEvidencia: [{ nome, texto, refs }], aviso, refs }. Puro.
export function suplementos(res) {
  const t = travasDeSuplemento(res);
  const { cond, educ, estimulo } = t;
  const aviso = 'Não use sem orientação médica se você está grávida ou amamentando, tem menos de 18 anos, doença nos rins ou no fígado, pressão alta ou arritmia, ou usa remédios de uso contínuo. Este aplicativo não prescreve suplementos.';
  const semEvidencia = SEM_EVIDENCIA.map((x) => ({ ...x, refs: [...x.refs] }));
  const proibidos = { ...PRE_PROIBIDOS, refs: [...PRE_PROIBIDOS.refs] };
  const junta = (o) => [...new Set([...o.boas.flatMap((b) => b.refs), ...(o.preTreino.introRefs || []), ...o.preTreino.itens.flatMap((x) => x.refs), ...o.semEvidencia.flatMap((x) => x.refs)])];
  if (educ) {
    const m = motivoSemPreTreino(res, t);
    const out = { semDoses: true, semCafeina: true, semPreTreino: true, intro: 'Suplemento não é obrigatório: comida de verdade resolve.', linhas: [], boas: [],
      preTreino: { bloqueado: true, intro: m.texto, introRefs: m.refs, itens: [proibidos] }, semEvidencia,
      aviso: 'No seu caso não mostro doses. Antes dos 18 anos, na gestação e na amamentação, com doença nos rins ou com transtorno alimentar, creatina, cafeína e proteína em pó só com orientação do seu médico ou nutricionista.' };
    out.refs = junta(out);
    return out;
  }
  const corre = !!res.corrida;
  const hipert = cond.includes('hipertensao');
  const alergias = Array.isArray(res.alergias) ? res.alergias : [];
  const rest = Array.isArray(res.restricoes) ? res.restricoes : [];
  const comMedico = 'Com o que você informou, use só se o seu médico liberar.';
  const boas = [];
  boas.push({ id: 'creatina', nome: 'Creatina monoidratada', texto: '3 a 5 g por dia, todos os dias. Melhora força e ganho de massa.',
    porque: 'É o suplemento com mais evidência para força e massa. Nos primeiros dias o peso pode subir de 1 a 2 kg, de água. Nos estudos, não houve efeito ruim em até 4 anos de uso. No Brasil, o rótulo pode indicar de 3 a 5 g por dia. Com doença nos rins, só com o médico.',
    refs: ['kreider2017', 'maughan2018', 'anvisa_in28'] });
  boas.push({ id: 'cafeina', nome: 'Cafeína', texto: hipert ? 'com pressão alta, não use como suplemento.'
    : estimulo ? 'com doença do coração, outra doença crônica ou um sinal de alerta de saúde, não use como suplemento sem falar com o seu médico.'
      : `cerca de 3 mg por quilo de peso (até ${limiteDeCafeina(res).porVez} mg por vez), 1 hora antes do treino, sem passar de ${limiteDeCafeina(res).noDia} mg por dia. Evite à noite.`,
  porque: estimulo ? 'A cafeína acelera o coração e pode subir a pressão; com essas condições, quem decide é o médico.'
    : 'Os estudos mostram efeito com 3 a 6 mg por quilo, 1 hora antes; o aplicativo fica na parte baixa, a que a EFSA considera segura de uma vez. Com 9 mg por quilo ou mais, não rende mais e dá enjoo, ansiedade e insônia. No Brasil, suplemento de cafeína tem até 200 mg por dose.',
  refs: estimulo ? ['guest2021', 'maughan2018', 'whitfield2017'] : ['guest2021', 'efsa2015', 'maughan2018', 'anvisa_in28'] });
  // whey é feito de leite: com alergia ao leite, não entra (data/foods.js); veganos: proteína de planta
  const vegano = rest.includes('vegano');
  boas.push(alergias.includes('leite')
    ? { id: 'proteina', nome: 'Whey protein', texto: 'é feito de leite; com alergia ao leite, não use.', porque: 'Whey e caseína são a própria proteína do leite, a que causa a alergia, mesmo nas versões sem lactose. Proteína em pó não é obrigatória: a meta do dia sai da comida.', refs: ['maughan2018', 'anvisa_alergenicos'] }
    : vegano
      ? { id: 'proteina', nome: 'Proteína em pó', texto: `whey vem do leite; para veganos, há as de ${alergias.includes('soja') ? 'outras plantas (confira os alérgenos no rótulo)' : 'soja e de outras plantas'}. Conta na meta do dia.`, porque: 'É só uma forma prática de proteína: quem chega à meta do dia com comida não precisa.', refs: ['maughan2018', 'rogerson2017', 'jager2017'] }
      : { id: 'proteina', nome: 'Whey protein', texto: 'só uma forma prática de proteína; conta na meta do dia.', porque: 'Quem chega à meta do dia com comida não precisa. Uma porção de proteína em pó costuma ter de 20 a 50 g de proteína.', refs: ['jager2017', 'maughan2018'] });
  // beta-alanina: dose (a do rótulo brasileiro) só para quem corre — o plano tem tiros e intervalados de 1 a 5 minutos
  boas.push({ id: 'betaalanina', nome: 'Beta-alanina', texto: !corre ? 'só ajuda em esforços fortes de 1 a 4 minutos, como tiros de corrida; para a força, ainda não se sabe.'
    : estimulo ? `ajuda em esforços fortes de 1 a 4 minutos, como os tiros. ${comMedico}`
      : 'ajuda em esforços fortes de 1 a 4 minutos, como os tiros e o intervalado. Se usar, siga o rótulo: no Brasil, até 2 g por dia, em doses de até 300 mg. Pode dar formigamento.',
  porque: corre && !estimulo ? 'Nos estudos, 4 a 6 g por dia, por 2 a 4 semanas, melhoraram o desempenho, mais em esforços de 1 a 4 minutos. O formigamento é o único efeito colateral relatado e diminui com doses menores e divididas. A Anvisa limita o rótulo a 2 g por dia.'
    : 'O efeito aparece em esforços fortes de 1 a 4 minutos. O formigamento é o único efeito colateral relatado.',
  refs: ['trexler2015', 'maughan2018', 'anvisa_in28'] });
  if (corre) {
    boas.push({ id: 'nitrato', nome: 'Nitrato (suco de beterraba)', texto: estimulo ? `ajuda em corridas de 12 a 40 minutos. ${comMedico}`
      : 'ajuda em corridas de 12 a 40 minutos, como uma prova de 5 km: 310 a 560 mg de nitrato (veja no rótulo do suco concentrado), 2 a 3 horas antes. Teste em treino: pode mexer com a barriga.',
    porque: 'Em esforços de menos de 12 minutos, o efeito é incerto. Beterraba, espinafre, rúcula e aipo também têm nitrato.', refs: ['maughan2018', 'ais_abcd'] });
    boas.push({ id: 'bicarbonato', nome: 'Bicarbonato de sódio', texto: `só ajuda em esforços máximos de cerca de 1 a 10 minutos e costuma dar enjoo e diarreia. ${hipert || cond.includes('cardiaco') ? 'Tem muito sódio: com o que você informou, não use.' : estimulo ? `Tem muito sódio. ${comMedico}` : 'Tem muito sódio: só com nutricionista, testado em treino.'}`,
      porque: estimulo ? 'Acima de 10 minutos de esforço, perde o efeito.' : 'Acima de 10 minutos de esforço, perde o efeito. Nos estudos, 0,2 a 0,4 g por quilo, de 1 a 2 horas e meia antes: para 70 kg, de 14 a 28 g, com cerca de 4 a 8 g de sódio.',
      refs: ['maughan2018', 'ais_abcd'] });
  }
  boas.push({ id: 'vitaminas', nome: 'Vitamina D e ferro', texto: 'só com exame de sangue e orientação do médico. Sem falta confirmada, não tome por conta própria.',
    porque: 'O consenso do Comitê Olímpico Internacional não recomenda suplementar sem avaliação, e ferro em dose alta só deve ser usado com falta de ferro. O Instituto Australiano do Esporte os classifica como suplementos médicos.', refs: ['maughan2018', 'ais_abcd'] });
  const linhas = boas.map((b) => `${b.nome}: ${b.texto}`);

  // pré-treino pronto
  let preTreino;
  if (estimulo) {
    const m = motivoSemPreTreino(res, t);
    preTreino = { bloqueado: true, intro: m.texto, introRefs: m.refs, itens: [proibidos] };
  } else {
    const lim = limiteDeCafeina(res, 0);
    preTreino = { bloqueado: false, intro: 'Não é obrigatório: o efeito comprovado vem da cafeína, que também está no café.', introRefs: ['guest2021', 'harty2018'], itens: [
      { titulo: 'O que tem dentro', texto: 'Quase sempre cafeína, muitas vezes de 250 a 400 mg por dose, com beta-alanina, citrulina e creatina. Se o rótulo não disser quanto de cafeína tem, não use.',
        porque: 'Muitos misturam os ingredientes numa fórmula fechada, sem a quantidade de cada um, e alguns vêm em dose baixa demais para fazer efeito.', refs: ['jagim2019', 'harty2018'] },
      { titulo: 'Quanto de cafeína', texto: `Até ${lim.porVez} mg por dose e ${lim.noDia} mg no dia, somando café, chá, refrigerante e energético. Rótulo com mais de ${lim.porVez} mg por dose: não use. Nunca tome duas doses.`,
        porque: `Para adultos saudáveis, a EFSA considera seguros até 200 mg de uma vez (cerca de 3 mg por quilo) e 400 mg no dia (cerca de 5,7 mg por quilo), de todas as fontes.${lim.porVez < 200 ? ' Abaixo de 70 kg, o aplicativo usa o valor por quilo, que é menor.' : ''} No Brasil, suplemento de cafeína tem até 200 mg por dose. Uma xícara de café tem cerca de 100 mg.`,
        refs: ['efsa2015', 'anvisa_in28', 'jagim2019', 'gardiner2023'], cafeina: true },
      { titulo: 'Horário', texto: `Uma dose de pré-treino (cerca de 220 mg) ainda tira sono se tomada a menos de 13 horas da hora de dormir; uma xícara de café, a menos de 9.${res.horario === 'noite' ? ' Você treina à noite: prefira sem cafeína.' : ''}`,
        porque: 'É a mesma regra da tela do sono. A sensibilidade varia de pessoa para pessoa: se o sono piorou, antecipe ou tire a cafeína.', refs: ['gardiner2023'] },
      { titulo: 'Quando parar', texto: 'Pare se sentir palpitação, tontura, ansiedade ou insônia. Dor no peito, falta de ar ou desmaio: procure atendimento na hora.',
        porque: 'Numa pesquisa com 872 usuários, 54% contaram algum efeito, como reação na pele, coração acelerado, enjoo e tontura. Dor no peito, falta de ar e desmaio são sinais de alerta que pedem avaliação médica.', refs: ['jagim2019', 'maughan2018', 'whitfield2017'] },
      proibidos,
      { titulo: 'Exame antidoping', texto: 'Suplemento pode vir contaminado com substância proibida. Prefira produto com certificação de terceira parte; mesmo assim, não há garantia total.',
        porque: 'Num estudo com mais de 600 produtos do mundo todo, cerca de 15% tinham hormônios que não estavam no rótulo.', refs: ['maughan2018', 'harty2018', 'ais_abcd'] },
    ] };
  }
  const out = { semDoses: false, semCafeina: estimulo, semPreTreino: estimulo, intro: 'Suplemento não é obrigatório. Os que têm boa evidência para quem treina são:', linhas, boas, preTreino, semEvidencia,
    aviso: estimulo && !hipert ? `${aviso} Com o que você informou, a cafeína fica sem dose: converse com o seu médico.` : aviso };
  out.refs = junta(out);
  return out;
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

// Textos da corrida usados em mais de um lugar (orientacaoCorrida e orientacaoDoDia).
// Bebida caseira na concentração das esportivas (ref ais_bebida — ver orientacaoCorrida).
const BEBIDA_CASEIRA = 'Bebida caseira: 1 litro de água, 4 colheres de sopa de açúcar (60 g), um quarto de colher de chá de sal (1,5 g) e suco de 1 limão.';
// cafeína em provas e treinos fortes (EFSA 2015; ISSN 2021 — refs efsa2015, guest2021)
const CAFEINA_CORRIDA = 'Ajuda em provas e treinos fortes: cerca de 3 mg por quilo, sem passar de 200 mg por vez, 1 hora antes. Teste antes em treino; evite à noite e não use se tiver arritmia ou ansiedade.';

// ---------- cardápio de cada dia (semente pela data) e ajustes da pessoa ----------
// Cada dia tem o seu cardápio, sempre o mesmo para a mesma data: a semente é o número do dia no calendário (dias desde
// 1/1/2020), de 0 a 999. Dias seguidos têm sementes seguidas, e cada refeição gira os alimentos dos seus grupos: a semana
// não repete o mesmo dia. O que a pessoa muda ("Outra sugestão" e "Trocar" de uma refeição) fica em state.nutri.ajustes:
// { 'AAAA-MM-DD': { s: deslocamento da semente do dia (0 a 999), m: [troca de cada refeição, 0 a 99] } }.
const DIA_MS = 86400000;
const dataReal = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
export function sementeDoDia(data) {
  if (!dataReal(data)) return 0;
  const n = Math.round((Date.parse(data + 'T12:00:00Z') - Date.UTC(2020, 0, 1, 12)) / DIA_MS);
  return ((n % 1000) + 1000) % 1000;
}
export const MAX_AJUSTES = 40;
const inteiro = (v, min, max) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : 0);
// um ajuste válido, ou null quando não muda nada
export function limparAjuste(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const s = inteiro(a.s, 0, 999);
  const m = (Array.isArray(a.m) ? a.m.slice(0, 6) : []).map((k) => inteiro(k, 0, 99));
  while (m.length && !m[m.length - 1]) m.pop();
  return s || m.length ? { s, m } : null;
}
// state.nutri.ajustes vindo do aparelho ou de um backup: só datas reais, no máximo MAX_AJUSTES (as mais recentes)
export function limparAjustes(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  const datas = Object.keys(v).filter(dataReal).sort().slice(-MAX_AJUSTES);
  for (const d of datas) { const a = limparAjuste(v[d]); if (a) out[d] = a; }
  return out;
}
const sementeComAjuste = (data, ajuste) => { const a = limparAjuste(ajuste); return (sementeDoDia(data) + (a ? a.s : 0)) % 1000; };
// O cardápio de uma data, com o ajuste da pessoa (ou null). `opcoes` = { emCasa } como em cardapio().
export function cardapioDoDia(res, data, ajuste = null, opcoes = {}) {
  const a = limparAjuste(ajuste);
  return cardapio(res, sementeComAjuste(data, a), { emCasa: opcoes && opcoes.emCasa ? opcoes.emCasa : null, trocas: a ? a.m : null });
}
// "Outra sugestão": o ajuste que dá um dia com alimentos diferentes do atual (sem trocas de refeição), ou null
export function outraSugestaoDoDia(res, data, ajuste = null, opcoes = {}) {
  const atual = assinatura(cardapioDoDia(res, data, ajuste, opcoes));
  if (!atual) return null;
  const base = sementeDoDia(data), s0 = sementeComAjuste(data, ajuste);
  const op = { emCasa: opcoes && opcoes.emCasa ? opcoes.emCasa : null };
  for (let k = 1; k <= 24; k++) { const s = (s0 + k) % 1000; if (assinatura(cardapio(res, s, op)) !== atual) return { s: (s - base + 1000) % 1000, m: [] }; }
  return null;
}
// "Trocar" uma refeição (pela `ordem` dela no dia): o ajuste que muda os alimentos dessa refeição, ou null se não houver
// outra combinação (acontece com poucos alimentos em casa ou com restrições que deixam poucos alimentos no grupo)
export function trocarRefeicaoDoDia(res, data, ajuste, ordem, opcoes = {}) {
  const a = limparAjuste(ajuste) || { s: 0, m: [] };
  const ids = (dia) => { const r = dia && dia.refeicoes.find((x) => x.ordem === ordem); return r ? r.itens.map((x) => x.id).sort().join(',') : ''; };
  const atual = ids(cardapioDoDia(res, data, a, opcoes));
  if (!atual || !Number.isInteger(ordem) || ordem < 0 || ordem > 5) return null;
  for (let k = (a.m[ordem] || 0) + 1, n = 0; n < 30; k = (k % 99) + 1, n++) {
    const m = a.m.slice(); while (m.length <= ordem) m.push(0); m[ordem] = k;
    const novo = { s: a.s, m };
    const outro = ids(cardapioDoDia(res, data, novo, opcoes));
    if (outro && outro !== atual) return limparAjuste(novo);
  }
  return null;
}

// ---------- o dia de hoje: o que comer e beber em volta dos treinos ----------
// `treinos` = { musculacao: { nome, forte } | null, corrida: { tipo, nome, durMin, distKm, intensidade } | null,
//   conhecido: true quando há treino ou plano de corrida no aplicativo (sabemos quais dias são de treino) }.
// Junta, num bloco só, o que já existe: emVoltaDoTreino (musculação e regra geral) e as orientações de corrida de
// orientacaoCorrida — agora com a duração do treino DO DIA (carboidratoNaCorrida). Nenhuma regra nova. Em dia sem
// treino não há "antes do treino": só a água do dia.
const dec1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
export function rotuloDoTreino(treinos) {
  const t = treinos || {};
  const partes = [];
  if (t.musculacao) partes.push(`musculação (${t.musculacao.nome})`);
  if (t.corrida) partes.push(t.corrida.tipo === 'prova' ? 'dia da prova' : `${String(t.corrida.nome).toLowerCase()} de ${fmtDuracao(t.corrida.durMin)}`);
  return partes.join(' + ');
}
export function orientacaoDoDia(res, treinos) {
  const t = treinos || {};
  const m = t.musculacao || null, c = t.corrida || null;
  const semNumeros = res.modo === 'educativo';
  const cond = Array.isArray(res.condicoes) ? res.condicoes : [];
  const peso = Number.isFinite(res.pesoRef) ? res.pesoRef : 70;
  const rotulo = rotuloDoTreino(t);
  const treina = !!rotulo;
  // sem treino nem plano de corrida no aplicativo: não sabemos o dia; quem treina recebe a regra geral
  const semAgenda = !treina && !t.conhecido;
  const out = { treina, semAgenda, titulo: treina ? 'Hoje: ' + rotulo : semAgenda ? (res.treina ? 'Nos dias de treino' : 'Hoje') : 'Hoje: descanso', resumo: '', antes: null, durante: null, depois: null, agua: '', refs: [] };
  const aguaDoDia = res.agua ? `Água do dia: ${dec1(res.agua)} L somando bebidas e comida (cerca de ${dec1(res.aguaBebidas)} L em água e outras bebidas). Beba conforme a sede; a urina deve ficar clara.`
    : cond.includes('renal') ? 'Água: com doença nos rins, a quantidade de líquidos é a que o seu médico indicar.' : 'Água: beba ao longo do dia, conforme a sede; a urina deve ficar clara.';
  if (!treina && !(semAgenda && res.treina)) {
    out.resumo = semAgenda ? 'Coma as refeições do cardápio com calma, sem pular refeições.' : 'Mantenha a proteína e as refeições normais. Descanso não é dia de comer menos.';
    out.agua = aguaDoDia;
    return out;
  }
  const e = emVoltaDoTreino(res, !!(m && m.forte));
  out.resumo = e.horario;
  const longa = !!c && c.durMin > 60;
  // antes: na corrida de mais de 1 hora vale a faixa da corrida (1 a 2 g por quilo, de 1 a 4 h antes — thomas2016);
  // nos outros treinos, a de emVoltaDoTreino
  const antesIntro = semNumeros ? (longa ? 'Refeição com carboidrato e pouca gordura e fibra, de 1 a 4 horas antes.' : 'Carboidrato de fácil digestão e um pouco de proteína, de 1 a 2 horas antes.')
    : longa ? `Refeição com carboidrato (${Math.round(peso)} a ${Math.round(peso * 2)} g) e pouca gordura e fibra, de 1 a 4 horas antes: quanto mais perto da corrida, menor.`
      : `Carboidrato de fácil digestão (cerca de ${e.carbPre} g) e um pouco de proteína, de 1 a 2 horas antes.`;
  const antesExtra = [];
  if (m && m.forte) antesExtra.push('Treino pesado de pernas: capriche no carboidrato antes.');
  if (c && cond.includes('diabetes')) antesExtra.push('Com diabetes, não corra em jejum, leve sempre um carboidrato de ação rápida e combine o plano de alimentação com o seu médico.');
  else if (c && !m && !longa && !semNumeros && res.horario === 'cedo') antesExtra.push('Corrida leve de até 1 hora logo cedo pode ser em jejum, se você se sente bem.');
  out.antes = { intro: antesIntro, itens: e.pre, extras: antesExtra };
  if (c) {
    const d = carboidratoNaCorrida(c.durMin, semNumeros);
    const linhas = [d.texto];
    const lanches = trintaGramas();
    if (d.gHora && lanches.length) linhas.push(`Um gel tem de 20 a 30 g de carboidrato. Mais barato, 30 g são ${lanches.slice(0, 3).join(', ')}.`);
    linhas.push('Água: beba conforme a sede, sem forçar. Beber além da sede dilui o sódio do sangue; se você termina a corrida mais pesado do que começou, bebeu demais.');
    if (c.durMin > 120 && !semNumeros) linhas.push('Acima de 2 horas ou com muito calor, use também bebida com sódio (as esportivas têm de 0,5 a 0,9 g por litro). ' + BEBIDA_CASEIRA + (cond.includes('hipertensao') ? ' Com pressão alta, combine o uso de sal com o seu médico.' : ''));
    if (c.intensidade === 'forte' && !semNumeros && !cond.includes('hipertensao')) linhas.push('Cafeína: ' + CAFEINA_CORRIDA.charAt(0).toLowerCase() + CAFEINA_CORRIDA.slice(1));
    out.durante = { linhas };
    out.refs = ['thomas2016', 'jeukendrup2014', 'ais_gel', 'ais_bebida', 'hewbutler2017', 'efsa2017', ...(c.intensidade === 'forte' ? ['guest2021'] : [])];
  }
  const depoisExtra = [];
  if (c) {
    if (!semNumeros) depoisExtra.push('Se for treinar de novo em menos de 8 horas, reponha o carboidrato logo: de 1 a 1,2 g por quilo por hora nas primeiras 4 horas.');
    depoisExtra.push('Reponha o líquido aos poucos: para cada quilo perdido na corrida, cerca de 1 litro e meio.');
  }
  out.depois = { intro: semNumeros ? 'Uma refeição com proteína e carboidrato, até 2 horas depois.' : `Uma refeição com cerca de ${e.protPos} g de proteína e carboidrato, até 2 horas depois.`, itens: e.pos, extras: depoisExtra };
  out.agua = e.agua;
  return out;
}

// ---------- lista de compras da semana ----------
// Soma os alimentos dos cardápios (dias) e diz quanto comprar: em unidades (ovo, banana, pão, pote de iogurte), em litros
// (leite, bebidas), em colheres (óleo e azeite) ou em peso de compra — o peso pronto dividido pelo rendimento da tabela
// de preços (data/foods.js: arroz e feijão crescem ao cozinhar, carnes encolhem, frutas perdem casca). Agrupada pelas
// categorias do catálogo. Alimentos com o mesmo nome de compra (cenoura crua e cozida) somam numa linha só.
const PREPARO = /\s+(cozid[oa]s?|grelhad[oa]s?|assad[oa]s?|refogad[oa]s?|frit[oa]s?|cru|crua|crus|cruas)(?=[\s,)]|$)/gi;
export const nomeDeCompra = (nome) => String(nome).replace(PREPARO, '').replace(/\s{2,}/g, ' ').trim();
const fmtPeso = (g) => (g >= 1000 ? dec1(Math.ceil(g / 100) / 10) + ' kg' : Math.max(50, Math.ceil(g / 50) * 50) + ' g');
const POR_UNIDADE = /^(\d+)\s+(unidade|unidades|pote|potes|espiga|espigas|lata|latas)\b/i;
const NOME_UNIDADE = { unidade: ['unidade', 'unidades'], pote: ['pote', 'potes'], espiga: ['espiga', 'espigas'], lata: ['lata', 'latas'] };
function compra(f, g) {
  const u = POR_UNIDADE.exec(f.porcao.desc);
  if (u && f.cat !== 'gorduras') {
    const tam = f.porcao.g / Number(u[1]);
    const n = Math.max(1, Math.ceil(g / tam - 0.05));
    const palavra = NOME_UNIDADE[u[2].toLowerCase().replace(/s$/, '')] || NOME_UNIDADE.unidade;
    return { modo: 'u', n, pal: palavra, qtd: `${n} ${palavra[n === 1 ? 0 : 1]}` };
  }
  if (/\bmL\b/.test(f.porcao.desc) && f.papel !== 'gordura') {
    const l = g / 1000;
    return { modo: 'l', n: l, qtd: l >= 0.5 ? dec1(Math.ceil(l * 2) / 2) + ' L' : Math.ceil(l * 10) * 100 + ' mL' };
  }
  // óleo e azeite: em colheres de sopa, como no cardápio
  if (f.g >= 99) { const n = Math.max(1, Math.round(g / f.porcao.g)); return { modo: 'c', n, pal: ['colher de sopa', 'colheres de sopa'], qtd: `${n} ${n === 1 ? 'colher' : 'colheres'} de sopa` }; }
  const rend = rendimentoDeCompra(f.id);
  // "rende X pronto" só para o que vai ao fogo (arroz, feijão, carnes); fruta e verdura com casca não precisam
  return { modo: 'p', n: g / rend, qtd: fmtPeso(g / rend), pronto: rend !== 1 && /\s(cozid|grelhad|assad|refogad|frit)/i.test(f.nome) ? g : 0 };
}
// `dias` = lista de cardápios (o que cardapio() devolve; null é ignorado). `emCasa` (opcional): ids marcados em casa.
export function listaDeCompras(dias, { emCasa = null } = {}) {
  const gramas = new Map();
  for (const d of Array.isArray(dias) ? dias : []) {
    if (!d || !Array.isArray(d.refeicoes)) continue;
    for (const r of d.refeicoes) for (const x of r.itens) if (FOOD.has(x.id) && x.g > 0) gramas.set(x.id, (gramas.get(x.id) || 0) + x.g);
  }
  const casa = new Set(Array.isArray(emCasa) ? emCasa : []);
  const linhas = new Map();
  for (const [id, g] of gramas) {
    const f = FOOD.get(id);
    const nome = nomeDeCompra(f.nome);
    const c = compra(f, g);
    const chave = nome + '|' + c.modo;
    const l = linhas.get(chave);
    if (l) {
      l.n += c.n; l.pronto += c.pronto || 0; l.ids.push(id); l.emCasa = l.emCasa || casa.has(id);
      l.qtd = c.modo === 'p' ? fmtPeso(l.n) : c.modo === 'l' ? (l.n >= 0.5 ? dec1(Math.ceil(l.n * 2) / 2) + ' L' : Math.ceil(l.n * 10) * 100 + ' mL') : `${l.n} ${l.pal[l.n === 1 ? 0 : 1]}`;
    } else linhas.set(chave, { nome, cat: f.cat, modo: c.modo, pal: c.pal, n: c.n, qtd: c.qtd, pronto: c.pronto || 0, ids: [id], emCasa: casa.has(id) });
  }
  const grupos = [];
  for (const [cat, nomeCat] of Object.entries(CATEGORIAS_ALIMENTO)) {
    const itens = [...linhas.values()].filter((l) => l.cat === cat).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((l) => ({ nome: l.nome, qtd: l.qtd, ids: l.ids, emCasa: l.emCasa, detalhe: l.modo === 'p' && l.pronto ? `rende cerca de ${fmtPeso(l.pronto)} pronto` : '' }));
    if (itens.length) grupos.push({ cat, nome: nomeCat, itens });
  }
  return { grupos, itens: grupos.reduce((n, gr) => n + gr.itens.length, 0) };
}
// a lista como texto simples, para copiar (nada sai do aparelho sem a pessoa colar em algum lugar)
export function textoDaListaDeCompras(lista, titulo) {
  const l = [titulo, 'Cardápio de exemplo do FitCore. Quantidades aproximadas: arroz, feijão, carnes e peixes em peso cru.', ''];
  for (const g of lista.grupos) {
    l.push(g.nome);
    for (const x of g.itens) l.push(`- ${x.nome}: ${x.qtd}${x.emCasa ? ' (já marcado em casa)' : ''}`);
    l.push('');
  }
  return l.join('\n').trim() + '\n';
}

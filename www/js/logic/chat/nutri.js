// Assuntos da Nutricionista no chat (contrato: logic/chat/contrato.js). Puro: sem DOM e sem importar views/.
// Tudo o que é dito aqui sai das regras que o app já tem: logic/nutrition.js (metas, cardápio, trocas, em volta do treino,
// suplementos), logic/diario.js (perfil do diário e comparação com a meta), logic/saude.js (união das entrevistas),
// data/foods.js (medidas caseiras do IBGE, NOVA, alergênicos) e data/knowledge.js (REFS e FAQ_NUTRI).
//
// PROTEÇÕES (as mesmas da tela da Nutrição):
//   • transtorno alimentar (marcado em QUALQUER entrevista) e menores de 18 (a menor idade informada em qualquer
//     entrevista ou na tela do sono): nenhum número de calorias, peso, gramas de comida ou de macronutrientes, nem
//     contagem. Quem tem transtorno também não recebe porções nem frases sobre "engordar". Menores veem a medida caseira
//     sem gramas.
//   • gestação, pós-parto, doença nos rins e estimativa não confiável (modo educativo de calcular()): sem metas em
//     número; o texto encaminha ao pré-natal, ao médico ou ao nutricionista, como a tela.
//   • diabetes: só a manutenção (calcular) e "não pule refeições / não treine em jejum sem orientação".
//   • alergias e restrições: os exemplos não citam o que a pessoa não pode comer, e as trocas usam a lógica do cardápio.
//
// SINAIS DE RISCO NO TEXTO (o motor chama ANTES de reconhecer a intenção):
//   sinaisDeRisco(textoNormalizado) → [] ou ids entre
//     'vomito'     vomitar depois de comer, provocar o vômito, dedo na garganta (não conta virose, comida estragada...)
//     'purgativo'  laxante ou diurético para emagrecer, "secar" ou compensar (não conta o diurético da pressão)
//     'remedio'    remédio, comprimido ou cápsula para emagrecer; inibidor ou moderador de apetite
//     'jejum'      jejum de vários dias, dias sem comer, jejum prolongado (jejum de 16 horas não conta)
//     'restricao'  comer quase nada, não estou comendo nada, parei de comer (sem objeto: "parei de comer doce" não conta)
//     'vida'       falas de morrer ou de se matar (o CVV e o SAMU vêm primeiro)
//   passoDeRisco(sinais, ctx) → Passo de acolhimento curto, sem julgamento e sem números, que recomenda procurar um
//     profissional de saúde (Unidade Básica de Saúde do SUS; CAPS), o CVV (188, gratuito, 24 h) e, em emergência, o SAMU
//     (192). Com um sinal, o motor deve mostrar esse passo no lugar do assunto reconhecido. O mesmo passo é o assunto
//     'nutri-apoio' ("Preocupação com a comida").
//   Fontes novas, lidas em texto completo (ainda sem chave em REFS: o texto vai no "Por quê?"; ver REFS_NOVAS):
//     • Ministério da Saúde, Biblioteca Virtual em Saúde, "Quebre o preconceito e apoie as famílias: Dia Mundial de Ação
//       contra os Transtornos Alimentares 2025" (05/06/2025): bulimia — vômito autoinduzido para "compensar", longos
//       períodos de jejum, atividade física extenuante, supostas medicações para emagrecer, laxantes e diuréticos sem
//       prescrição; anorexia — restrição que se intensifica e jejum recorrente; compulsão — consumo descontrolado com
//       sofrimento, culpa e vergonha. "Transtornos alimentares não são escolhas"; "a recuperação completa é possível";
//       detecção e intervenção precoces importam; "as famílias não têm culpa"; prevenção: alimentação "livre da cultura
//       da dieta e da culpa".
//     • Ministério da Saúde, "Dados da Rede de Atenção Psicossocial (RAPS) no SUS", set. 2022: os CAPS funcionam de
//       "porta aberta" e atendem demandas referenciadas pela atenção básica e demanda espontânea, prioritariamente
//       transtornos mentais mais graves e persistentes.
//     • Centro de Valorização da Vida (cvv.org.br, nov. 2026): telefone 188, "24 horas por dia e sem custo de ligação",
//       também chat e e-mail; conversa sigilosa, "sem julgamentos, críticas ou comparações".
//   Também do Guia Alimentar (ref guia2014, lido de novo em texto completo, cap. 5 e "Dez passos"): comer em horários
//   semelhantes, devagar e com atenção ajuda a controlar naturalmente o quanto se come; fora de casa, preferir comida
//   feita na hora (restaurante a quilo), evitar fast-food, deixar bufê livre para ocasiões especiais e servir-se uma
//   vez; sem tempo: cozinhar o feijão em maior quantidade e congelar, pratos rápidos (sopas, omeletes, arroz com
//   legumes), verduras lavadas e secas com antecedência, planejar as compras e o cardápio da semana.
//
// ctx.texto (opcional): se o motor passar o texto digitado (normalizado), "Dúvida sobre um alimento" já abre o alimento
// citado (alimentoNoTexto). Sem ele, a pessoa escolhe pelos botões.
import { REFS, FAQ_NUTRI } from '../../data/knowledge.js';
import { ALIMENTOS, MEDIDAS, temAlergeno, NOME_ALERGIA } from '../../data/foods.js';
import {
  PERGUNTAS, ROTULO, respostasCompletas, cardapioDoDia, trocarRefeicaoDoDia, limparAjustes, limparEmCasa, orientacaoDoDia,
  emVoltaDoTreino, carboidratoNaCorrida, suplementos, limiteDeCafeina, porcaoMedida, medida, textosDoPeso,
} from '../nutrition.js';
import { metaDoDia, perfilDoDiario, modoDoDiario, somarDias, hojeLocal, buscarAlimentos, compararComMeta, totaisDoDia, resumoDaSemana } from '../diario.js';
import { uniaoSaude } from '../saude.js';
import { treinosDoDia } from '../semana-nutricao.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const diaOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z'));
const dec = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const mil = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const refsOk = (l) => [...new Set(l)].filter((k) => typeof k === 'string' && REFS[k]);
const juntaOu = (l) => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' ou ' + l[l.length - 1]);
const juntaE = (l) => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]);
const minusc = (t) => t.charAt(0).toLowerCase() + t.slice(1);
// texto sem acento, minúsculo, só letras, números e espaços (o motor já manda assim; aqui é só por garantia)
export const normalizar = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Fontes lidas em texto completo, copiadas para REFS (data/knowledge.js) com as mesmas chaves; ficam aqui também para
// os testes conferirem que nada se perdeu.
export const REFS_NOVAS = {
  ms_transtornos2025: 'Brasil. Ministério da Saúde. Biblioteca Virtual em Saúde. “Quebre o preconceito e apoie as famílias”: 02/6 – Dia Mundial de Ação contra os Transtornos Alimentares 2025. Brasília, 5 de junho de 2025.',
  ms_raps2022: 'Brasil. Ministério da Saúde. Dados da Rede de Atenção Psicossocial (RAPS) no Sistema Único de Saúde (SUS). Brasília: CGMAD/Saps, setembro de 2022.',
  cvv: 'Centro de Valorização da Vida (CVV). Apoio emocional e prevenção do suicídio: telefone 188, chat e e-mail. cvv.org.br, consulta em novembro de 2026.',
};
const REFS_APOIO = ['ms_transtornos2025', 'ms_raps2022', 'cvv'];

// ---------- quem está falando ----------
// Tudo o que os assuntos precisam saber, lido do estado (nunca alterado). `res` é a meta do dia (calcular com o plano de
// corrida e as outras entrevistas — logic/diario.js, metaDoDia), ou null sem a entrevista da Nutricionista.
export function perfilNutri(ctx) {
  const st = isObj(ctx) && isObj(ctx.st) ? ctx.st : {};
  const hoje = isObj(ctx) && diaOk(ctx.hoje) ? ctx.hoje : hojeLocal();
  let res = null;
  try { res = metaDoDia(st, hoje); } catch { res = null; }
  const p = perfilDoDiario(st, res);
  const u = uniaoSaude(st);
  const cond = new Set([...p.condicoes, ...(res ? lista(res.condicoes) : []), ...u.itens.filter((x) => x.tipo === 'condicao').map((x) => x.id)]);
  if (u.gestacaoOuAmamentacao) cond.add('gestante');
  if (u.itens.some((x) => x.tipo === 'remedio' && x.id === 'glicose')) cond.add('diabetes');
  const transtorno = cond.has('transtorno');
  const menor = p.idade != null && p.idade < 18;
  const a = isObj(st.nutri) && isObj(st.nutri.answers) ? st.nutri.answers : {};
  const restricoes = res ? lista(res.restricoes) : lista(a.restricoes).filter((x) => x !== 'nenhuma');
  const alergias = res ? lista(res.alergias) : u.alergias;
  let modoDiario = 'soma';
  try { modoDiario = modoDoDiario(res, st); } catch { modoDiario = transtorno ? 'sem' : 'soma'; }
  return {
    st, hoje, res, a, idade: p.idade, cond, transtorno, menor, protegido: transtorno || menor,
    // sem metas em número: protegidos, modo educativo, ou sem entrevista (não há meta calculada)
    semNumeros: transtorno || menor || !res || res.modo === 'educativo',
    restricoes, alergias, modoDiario,
    diabetes: cond.has('diabetes'), renal: cond.has('renal'), gestante: cond.has('gestante') || cond.has('posparto'), hipertensao: cond.has('hipertensao'),
    vegano: restricoes.includes('vegano'), semCarne: restricoes.includes('vegano') || restricoes.includes('vegetariano'),
  };
}
// para o motor: a pessoa é das que nunca recebem números de calorias/peso
export const protegido = (ctx) => perfilNutri(ctx).protegido;

// Por que não há números, em uma frase (o caso mais protegido primeiro)
function motivoSemNumeros(P) {
  if (P.transtorno) return 'Com histórico de transtorno alimentar, não uso números de calorias nem de peso: contar pode fazer mal.';
  if (P.menor) return 'Antes dos 18 anos, não calculo calorias nem metas: o corpo ainda está crescendo.';
  if (P.gestante) return 'Na gestação e na amamentação, as quantidades são as do pré-natal e do seu nutricionista.';
  if (P.renal) return 'Com doença nos rins, proteína, sódio, potássio e líquidos são definidos pelo seu médico e nutricionista.';
  if (P.res && P.res.modo === 'educativo') return 'Para o seu peso, altura e idade, a fórmula de gasto não é confiável: procure um nutricionista.';
  return '';
}
const quemAcompanha = (P) => (P.transtorno ? 'Combine as quantidades com quem acompanha você (nutricionista e psicólogo).'
  : P.menor ? 'A alimentação nessa idade deve ser acompanhada por nutricionista ou pediatra.'
    : P.gestante ? 'Siga o acompanhamento do pré-natal e de um nutricionista.'
      : P.renal ? 'Não siga metas de proteína de aplicativos.' : 'Procure um nutricionista para uma avaliação individual.');
const IR_NUTRI = { rotulo: 'Abrir a Nutrição', rota: 'nutricao' };
const REFAZER = 'Toque em “Refazer a entrevista”, abaixo.';
// abre a entrevista da Nutrição direto (views/chat.js → views/nutrition.js, abrirEntrevistaNutri)
const IR_REFAZER = { rotulo: 'Refazer a entrevista', abrir: 'nutri-entrevista' };
function convite(texto) {
  return {
    texto: [texto, 'São perguntas rápidas, e as respostas ficam só neste aparelho.'],
    ir: [{ rotulo: 'Responder à entrevista', rota: 'nutricao' }],
  };
}

// exemplos que respeitam restrições e alergias: [texto, alergias que o tiram, restrições que o tiram]
function exemplos(P, l, n = 2) {
  const fora = (al, re) => al.some((x) => P.alergias.includes(x)) || re.some((x) => P.restricoes.includes(x));
  return l.filter(([, al, re]) => !fora(al, re)).slice(0, n).map((x) => x[0]);
}
const PROTEINAS = [['feijão', [], []], ['ovos', ['ovo'], ['vegano']], ['frango', [], ['vegano', 'vegetariano']], ['carne', [], ['vegano', 'vegetariano']], ['peixe', ['peixe'], ['vegano', 'vegetariano']],
  ['leite ou iogurte', ['leite'], ['vegano']], ['tofu', ['soja'], []], ['lentilha', [], []], ['grão-de-bico', [], []]];
const LANCHES = [['fruta com iogurte', ['leite'], ['vegano', 'sem_lactose']], ['pão com queijo', ['leite'], ['vegano', 'sem_lactose', 'sem_gluten']], ['fruta com castanhas', ['castanhas'], []],
  ['tapioca com ovo', ['ovo'], ['vegano']], ['banana com pasta de amendoim', ['amendoim'], []], ['uma fruta', [], []]];

// ---------- cardápio de hoje e a troca de uma refeição ----------
function opcoesDoCardapio(st) {
  const n = isObj(st) && isObj(st.nutri) ? st.nutri : {};
  const emCasa = limparEmCasa(n.emCasa);
  return { emCasa: n.soCasa === true && emCasa.length ? emCasa : null };
}
function cardapioDeHoje(P) {
  if (!P.res || P.res.modo === 'educativo') return null;
  try { return cardapioDoDia(P.res, P.hoje, limparAjustes(isObj(P.st.nutri) ? P.st.nutri.ajustes : null)[P.hoje] || null, opcoesDoCardapio(P.st)); } catch { return null; }
}
const artigo = (nome) => (nome === 'Ceia' ? 'a' : 'o');
const nomesDosItens = (ref) => juntaE(ref.itens.map((x) => minusc(x.nome.split(' (')[0].split(',')[0])));
// o ajuste que troca a refeição `ordem` de hoje (o mesmo do botão "Trocar" da tela), ou null
function novaTroca(st, hoje, ordem) {
  let res = null;
  try { res = metaDoDia(st, hoje); } catch { res = null; }
  if (!res || res.modo === 'educativo') return null;
  const aj = limparAjustes(isObj(st.nutri) ? st.nutri.ajustes : null);
  try { return trocarRefeicaoDoDia(res, hoje, aj[hoje] || null, ordem, opcoesDoCardapio(st)); } catch { return null; }
}
// Acao "Trocar o almoço": grava o ajuste do dia como a tela (views/nutrition.js, gravarAjuste: só a última semana fica)
function acaoTrocar(ref) {
  const a = artigo(ref.nome), nome = ref.nome.toLowerCase();
  return {
    rotulo: `Trocar ${a} ${nome}`,
    confirmar: `Troco ${a} ${nome} de hoje por outra opção, com a mesma meta do dia.`,
    aplicar: (s, ctx) => {
      const hoje = isObj(ctx) && diaOk(ctx.hoje) ? ctx.hoje : hojeLocal();
      if (!isObj(s) || !isObj(s.nutri)) return false;
      const novo = novaTroca(s, hoje, ref.ordem);
      if (!novo) return false;
      const aj = limparAjustes(s.nutri.ajustes);
      for (const d of Object.keys(aj)) if (d < somarDias(hoje, -7)) delete aj[d];
      aj[hoje] = novo;
      s.nutri.ajustes = limparAjustes(aj);
      return undefined;
    },
    depois: `Pronto: ${a} ${nome} de hoje tem uma nova sugestão.`,
  };
}
// Acao "Usar só o que tenho em casa" (o mesmo da tela: liga a lista e volta o dia ao cardápio sem trocas)
const acaoSoCasa = {
  rotulo: 'Usar só o que tenho em casa',
  confirmar: 'O cardápio de hoje passa a usar só os alimentos que você marcou em casa.',
  aplicar: (s, ctx) => {
    const hoje = isObj(ctx) && diaOk(ctx.hoje) ? ctx.hoje : hojeLocal();
    if (!isObj(s) || !isObj(s.nutri) || !limparEmCasa(s.nutri.emCasa).length) return false;
    s.nutri.soCasa = true;
    const aj = limparAjustes(s.nutri.ajustes);
    delete aj[hoje];
    s.nutri.ajustes = limparAjustes(aj);
    return undefined;
  },
  depois: 'Pronto: o cardápio de hoje usa só o que você tem em casa.',
};

function passoTroca(P, ref, motivo) {
  const temTroca = !!novaTroca(P.st, P.hoje, ref.ordem);
  const semOutra = 'Com as suas restrições, não há outra opção para esta refeição hoje.';
  const out = { texto: [], detalhes: ['A troca monta a refeição com os mesmos grupos de alimentos. O dia passa de novo pelo ajuste para fechar a mesma meta: as quantidades das outras refeições podem mudar um pouco.'], acoes: temTroca ? [acaoTrocar(ref)] : [], ir: [IR_NUTRI], refs: ['guia2014', 'taco', 'pof2008medidas'] };
  const casa = limparEmCasa(isObj(P.st.nutri) ? P.st.nutri.emCasa : null);
  const soCasa = isObj(P.st.nutri) && P.st.nutri.soCasa === true && casa.length > 0;
  if (motivo === 'nao_tenho') {
    if (soCasa) out.texto.push('O cardápio já usa só o que você marcou em casa. Se algo acabou, tire da lista na tela da Nutrição.');
    else if (casa.length) { out.texto.push('Você tem uma lista do que há em casa. Posso montar o cardápio de hoje só com ela.'); out.acoes.unshift(acaoSoCasa); }
    else out.texto.push('Na tela da Nutrição, marque o que você tem em casa: o cardápio passa a usar só esses alimentos e avisa o que faltar.');
    out.texto.push(temTroca ? `Ou troco só ${artigo(ref.nome)} ${ref.nome.toLowerCase()}.` : semOutra);
    out.detalhes.push('Com a lista de casa, havendo escolha, os ultraprocessados ficam de fora.');
  } else if (motivo === 'alergia') {
    out.texto.push(P.alergias.length
      ? `Já tiro do cardápio o que costuma ter ${juntaE(P.alergias.map((x) => NOME_ALERGIA[x] || x))}.`
      : 'Marque a alergia na entrevista da Nutricionista: eu tiro do cardápio, das trocas e das sugestões os alimentos que costumam ter isso.');
    out.texto.push(REFAZER);
    out.ir.unshift(IR_REFAZER);
    out.texto.push(temTroca ? `Até lá, troco ${artigo(ref.nome)} ${ref.nome.toLowerCase()} de hoje.` : semOutra);
    out.aviso = { tipo: 'warn', texto: 'Leia sempre o rótulo: procure “ALÉRGICOS: CONTÉM” ou “PODE CONTER”. Comida a granel ou de restaurante não traz esse aviso: pergunte como foi feita.' };
    out.detalhes.push('Intolerância à lactose, doença celíaca, vegetariano e vegano também se marcam na entrevista. Leite “sem lactose” continua tendo a proteína do leite: não serve para quem tem alergia ao leite.');
    out.refs.push('anvisa_alergenicos');
  } else {
    out.texto.push(temTroca ? `Troco ${artigo(ref.nome)} ${ref.nome.toLowerCase()} por outra opção, com a mesma meta do dia.` : semOutra);
    out.detalhes.push('Pode trocar quantas vezes quiser. O aplicativo ainda não guarda os alimentos de que você não gosta.');
  }
  out.texto.splice(0, 0, `Hoje ${artigo(ref.nome)} ${ref.nome.toLowerCase()} tem ${nomesDosItens(ref)}.`);
  out.refs = refsOk(out.refs);
  return out;
}
function perguntaMotivo(P, ref) {
  return {
    texto: ['Por que você quer trocar?'],
    opcoes: [{ rotulo: 'Não gosto', valor: 'nao_gosto' }, { rotulo: 'Não tenho em casa', valor: 'nao_tenho' }, { rotulo: 'Alergia ou não posso comer', valor: 'alergia' }],
    proximo: (v) => passoTroca(P, ref, v),
  };
}
const TROCAR = {
  id: 'nutri-trocar', coach: 'nutri', titulo: 'Trocar uma refeição do cardápio', resumo: 'trocar uma refeição do cardápio',
  palavras: ['nao gosto de', 'tem como mudar', 'trocar alimento', 'trocar refeicao', 'trocar cardapio', 'troca cardapio', 'trocar almoco', 'trocar jantar', 'trocar lanche', 'trocar+lanche', 'trocar+almoco', 'trocar+jantar', 'trocar+cafe', 'trocar+refeicao', 'trocar cafe da manha', 'trocar ceia', 'mudar almoco', 'mudar jantar',
    'substituir', 'substituto', 'substituicao', 'outra opcao', 'nao gosto', 'nao gostei', 'odeio', 'nao tenho em casa', 'acabou', 'faltou', 'alergia', 'alergico', 'alergica', 'nao posso comer', 'intolerancia',
    'acabou+casa', 'nao tem+casa', 'trocar janta', 'mudar janta', 'outra coisa almoco', 'outra coisa jantar', 'nao curto', 'detesto', 'enjoei', 'nao tem em casa', 'trocar refeicao hoje'],
  // quem não tem cardápio (modo educativo) não troca refeição; sem entrevista, o assunto convida a responder
  disponivel: (ctx) => { const P = perfilNutri(ctx); return !P.res || P.res.modo !== 'educativo'; },
  inicio: (ctx) => {
    const P = perfilNutri(ctx);
    if (!P.res) return convite('Para eu montar e trocar o cardápio, responda primeiro à entrevista da Nutricionista.');
    const dia = cardapioDeHoje(P);
    if (!dia) return { texto: ['No seu caso, não monto cardápio com quantidades.', motivoSemNumeros(P), 'Monte o prato assim: metade salada e legumes, um quarto arroz ou batata, um quarto de uma fonte de proteína, e feijão.'].filter(Boolean), ir: [IR_NUTRI], refs: refsOk(['guia2014']) };
    if (!dia.refeicoes.length) return { texto: ['Com o que está marcado em casa, não dá para montar uma refeição hoje.', 'Marque mais alimentos na tela da Nutrição.'], ir: [IR_NUTRI] };
    if (dia.refeicoes.length === 1) return perguntaMotivo(P, dia.refeicoes[0]);
    return {
      texto: ['Qual refeição de hoje você quer trocar?'],
      opcoes: dia.refeicoes.slice(0, 6).map((r) => ({ rotulo: r.nome, valor: String(r.ordem) })),
      proximo: (v) => { const ref = dia.refeicoes.find((r) => String(r.ordem) === String(v)) || dia.refeicoes[0]; return perguntaMotivo(P, ref); },
    };
  },
};

// ---------- comi fora do plano ----------
const EXAGEREI = {
  id: 'nutri-exagerei', coach: 'nutri', titulo: 'Comi fora do plano', resumo: 'ter comido fora do plano',
  palavras: ['bebi muito', 'bebi demais', 'muita cerveja', 'tomei muito', 'litros de refrigerante', 'refrigerante ontem', '!exagerei', '!exagero', 'exagerar', 'comi demais', 'comi muito', 'comi besteira', 'sai da dieta', 'fugi da dieta', 'furei a dieta', 'chutei o balde', 'pe na jaca', 'fora do plano',
    'passei da meta', 'estourei', 'comi doce', 'comi pizza', 'comi lanche', 'rodizio', 'festa', 'churrasco', 'aniversario', 'compensar', 'culpa', 'culpado', 'culpada', 'arrependido', 'arrependida',
    '!jaquei', 'enfiei o pe na jaca', 'comi hamburguer', 'comi chocolate', 'comi bolo', 'comi besteira ontem', 'fim de semana comi', 'final de semana comi', 'sai dieta', 'comilanca', 'larica', 'atacar geladeira'],
  inicio: (ctx) => {
    const P = perfilNutri(ctx);
    return {
      texto: ['Acontece, e está tudo bem.', 'Um dia não muda o seu resultado: o que conta é o que você faz na maior parte dos dias.'],
      opcoes: [{ rotulo: 'E na próxima refeição?', valor: 'proxima' }, { rotulo: 'E amanhã?', valor: 'amanha' }, { rotulo: 'Fiquei mal com isso', valor: 'culpa' }],
      proximo: (v) => (v === 'culpa' ? passoCulpa() : v === 'amanha' ? passoAmanha(P) : passoProxima(P)),
    };
  },
};
function passoProxima(P) {
  const temCardapio = !!(P.res && P.res.modo !== 'educativo');
  const texto = [temCardapio ? 'Na próxima refeição, volte ao normal: coma o que está no cardápio.' : 'Na próxima refeição, volte ao normal, como de costume.', 'Não pule a refeição nem coma bem menos para compensar.'];
  if (P.diabetes) texto.push('Com diabetes, pular refeição pode dar hipoglicemia: siga os horários que o seu médico orientou.');
  const detalhes = ['Comer em horários parecidos, devagar e com atenção, ajuda o corpo a regular naturalmente o quanto você come (Guia Alimentar).'];
  if (!P.semNumeros) detalhes.push('Dietas muito restritas só devem ser feitas com acompanhamento profissional: a sua meta já respeita esse limite.');
  if (P.transtorno) detalhes.push('Se vier a vontade de compensar, converse com quem acompanha você.');
  return { texto, detalhes, refs: refsOk(['guia2014', ...(P.semNumeros ? [] : ['jensen2013'])]), ir: [IR_NUTRI] };
}
function passoAmanha(P) {
  const texto = ['Amanhã, siga o cardápio e os treinos como estão.', 'Não precisa compensar com jejum nem com treino exagerado.'];
  const detalhes = ['Jejum longo e exercício extenuante para “compensar” o que se comeu são comportamentos de risco descritos pelo Ministério da Saúde.'];
  const refs = ['guia2014'];
  if (!P.transtorno) detalhes.push('O peso oscila de um dia para o outro: olhe a tendência das semanas, não a balança de amanhã.');
  // números só para quem tem meta e não é protegido (o diário em modo "meta")
  if (P.modoDiario === 'meta' && !P.protegido && P.res) {
    try {
      const c = compararComMeta(totaisDoDia(P.st.diario, P.hoje), P.res, P.st);
      if (c.estado === 'passou') detalhes.push(c.frase + (c.equivale ? ' ' + c.equivale : ''));
      const sem = resumoDaSemana(P.st.diario, P.hoje, P.res, P.st);
      if (sem.registrados >= 2 && sem.frase) detalhes.push(sem.frase);
    } catch { /* sem diário */ }
    detalhes.push('O diário é um guia, não uma conta exata: use-o para ver o padrão da semana.');
    refs.push('helms2014', 'burrows2019');
  }
  refs.push(...REFS_APOIO);
  return { texto, detalhes, refs: refsOk(refs), ir: [IR_NUTRI] };
}
function passoCulpa() {
  return {
    texto: ['Comer mais em um dia não é falha nem motivo de culpa.', 'Se isso acontece muitas vezes, com sensação de perder o controle, culpa ou vergonha, converse com um profissional de saúde: tem tratamento.', 'Se precisar conversar agora, o CVV atende pelo 188, de graça, 24 horas.'],
    detalhes: ['Comer sem controle com frequência, com sofrimento, culpa e vergonha, é o que o Ministério da Saúde descreve na compulsão alimentar. A recuperação completa é possível.',
      'Para o Ministério da Saúde, a alimentação saudável é livre da cultura da dieta e da culpa. Por isso o diário do aplicativo não usa cor de erro nem palavras de culpa.'],
    refs: refsOk(['eikey2021', ...REFS_APOIO]),
  };
}

// ---------- metas: proteína, água, refeições e calorias ----------
const NOMES_REFEICOES = { 3: ['café da manhã', 'almoço', 'jantar'], 4: ['café da manhã', 'almoço', 'lanche da tarde', 'jantar'], 5: ['café da manhã', 'lanche da manhã', 'almoço', 'lanche da tarde', 'jantar'], 6: ['café da manhã', 'lanche da manhã', 'almoço', 'lanche da tarde', 'jantar', 'ceia'] };
function passoMeta(P, qual) {
  const r = P.res;
  if (!r) return convite('Para eu calcular as suas metas, responda primeiro à entrevista da Nutricionista.');
  const motivo = motivoSemNumeros(P);
  if (qual === 'refeicoes') {
    const n = r.refeicoes;
    const detalhes = ['Prefere refeições menores ou maiores? Mude o número de refeições na entrevista: o cardápio se ajusta.'];
    if (!P.semNumeros && r.protRefeicao) detalhes.unshift(`A meta do dia é dividida entre elas. De proteína, de ${r.protRefeicao[0]} a ${r.protRefeicao[1]} g por refeição, a cada 3 a 4 horas.`);
    return { texto: [`Você escolheu ${n} refeições por dia: ${juntaE(NOMES_REFEICOES[n] || NOMES_REFEICOES[4])}.`, 'Coma em horários parecidos todos os dias, devagar e com atenção.'], detalhes, refs: refsOk(['guia2014', ...(P.semNumeros ? [] : ['jager2017', 'schoenfeld2018'])]), ir: [IR_NUTRI] };
  }
  if (qual === 'agua') {
    if (P.semNumeros || !r.agua) {
      return { texto: [P.renal ? 'Com doença nos rins, a quantidade de líquidos é a que o seu médico indicar.' : 'Beba água ao longo do dia, conforme a sede. A urina deve ficar clara.', 'No calor e nos dias de treino, você precisa de mais.'],
        detalhes: [motivo, 'Beber muito além da sede também faz mal.'].filter(Boolean), refs: refsOk(['efsa2017', 'hewbutler2017']), ir: [IR_NUTRI] };
    }
    const detalhes = ['É a ingestão adequada da autoridade europeia de segurança dos alimentos (EFSA), para clima ameno e atividade moderada.'];
    if (r.aguaPre) detalhes.push(`Antes do treino: de ${r.aguaPre[0]} a ${r.aguaPre[1]} mL nas 2 a 4 horas antes, e mais durante e depois.`);
    detalhes.push('A urina clara é um bom guia. Beber muito além da sede também faz mal.');
    return { texto: [`Cerca de ${dec(r.agua)} L de água por dia, somando bebidas e comida.`, `Em água e outras bebidas, cerca de ${dec(r.aguaBebidas)} L.`, 'No calor e nos dias de treino, beba mais, conforme a sede.'], detalhes, refs: refsOk(['efsa2017', 'thomas2016', 'rodriguez2009', 'hewbutler2017']), ir: [IR_NUTRI] };
  }
  if (qual === 'calorias' && !P.semNumeros && r.kcal) {
    const peso = textosDoPeso(r);
    const detalhes = [`Seu gasto estimado é de cerca de ${mil(r.gasto)} kcal por dia.`, 'A fórmula é uma estimativa e pode errar 10% ou mais: acompanhe o peso por 2 a 3 semanas e ajuste.', ...(peso.ritmo ? [peso.ritmo] : []), ...peso.linhas];
    if (r.modo === 'manutencao' && P.diabetes) detalhes.push('Com diabetes, mostro só a manutenção: qualquer dieta, combine com o seu médico e nutricionista.');
    return { texto: [`Sua meta: ${mil(r.kcal)} kcal por dia.`, `Objetivo: ${ROTULO.objetivo[r.objetivoCalc] || ROTULO.objetivo.manter}.`], detalhes,
      refs: refsOk(['ruiz2011', 'amaro2019', 'fao2004', ...(r.objetivoCalc === 'emagrecer' ? ['jensen2013', 'helms2014'] : r.objetivoCalc === 'ganhar' ? ['iraki2019', 'slater2019'] : [])]), ir: [IR_NUTRI] };
  }
  // proteína
  if (P.semNumeros || !r.prot) {
    const ex = juntaOu(exemplos(P, PROTEINAS, 4));
    return { texto: ['Para você, não mostro metas em números.', `Inclua uma fonte de proteína no almoço e no jantar: ${ex}.`], detalhes: [motivo, quemAcompanha(P)].filter(Boolean), refs: refsOk(['guia2014', ...(P.renal ? ['kdigo2024'] : [])]), ir: [IR_NUTRI] };
  }
  const detalhes = [`Isso dá ${dec(r.gkg)} g por quilo do seu peso.`,
    r.treina ? 'Para quem treina, as diretrizes indicam de 1,4 a 2,0 g por quilo por dia; o ganho de massa para de crescer perto de 1,6 g por quilo.' : 'Quem ainda não treina precisa de menos: o mínimo para adultos é 0,8 g por quilo; para emagrecer, um pouco mais, para proteger os músculos.'];
  const refs = ['jager2017', 'morton2018', 'schoenfeld2018', 'dri_canada'];
  if (r.objetivoCalc === 'emagrecer') { detalhes.push('Na redução de calorias, a meta fica na parte alta, para proteger os músculos.'); refs.push('helms2014'); }
  if (r.imc > 25) { detalhes.push('A conta usa o peso que você teria com IMC 25: o peso acima disso é quase todo gordura e não aumenta a necessidade.'); refs.push('weijs2025'); }
  if (r.idade >= 65) { detalhes.push('A partir dos 65 anos, nunca fica abaixo de 1,2 g por quilo.'); refs.push('deutz2014'); }
  if (P.vegano) { detalhes.push('Para veganos, a meta sobe um pouco: combine feijões com cereais e varie as fontes (soja, tofu, lentilha, grão-de-bico).'); refs.push('rogerson2017'); }
  detalhes.push('Divida ao longo do dia, a cada 3 a 4 horas.');
  return { texto: [`Sua meta: ${r.prot} g de proteína por dia.`, `Em cada refeição, de ${r.protRefeicao[0]} a ${r.protRefeicao[1]} g.`], detalhes, refs: refsOk(refs), ir: [IR_NUTRI] };
}
const METAS = {
  id: 'nutri-metas', coach: 'nutri', titulo: 'Quanto comer de proteína e água', resumo: 'as suas metas de proteína, água e refeições',
  // "quantas calorias tem um pastel?" é sobre o alimento, não sobre as metas da pessoa (nutri-alimento)
  anula: (i) => /\b(tem|tem um|tem uma|no|na|de um|de uma)\b/.test(i.texto) && !/\b(preciso|devo|minha|meu|minhas|meus|por dia|meta|beber)\b/.test(i.texto) && !!alimentoNoTexto(i.texto),
  palavras: ['quanto de proteina', 'quanta proteina', 'proteina por dia', 'gramas de proteina', 'meta de proteina', 'quanto de agua', 'quanta agua', 'litros de agua', 'agua por dia', 'beber agua', 'hidratacao',
    'quantas refeicoes', 'numero de refeicoes', 'refeicoes por dia', 'quanto devo comer', 'quanto comer', 'minhas metas', 'minha meta', 'calorias por dia', 'quantas calorias', 'meta de calorias', 'macros', 'macronutrientes',
    'quanto beber', 'quantos litros', 'quanta agua beber', 'beber quanto', 'meta agua', 'meta proteina', 'proteina preciso', 'quanto proteina', 'quantas gramas proteina', 'kcal'],
  inicio: (ctx) => {
    const P = perfilNutri(ctx);
    if (!P.res) return convite('Para eu calcular as suas metas, responda primeiro à entrevista da Nutricionista.');
    const opcoes = [{ rotulo: 'Proteína', valor: 'proteina' }, { rotulo: 'Água', valor: 'agua' }, { rotulo: 'Refeições por dia', valor: 'refeicoes' }];
    if (!P.semNumeros && P.res.kcal) opcoes.push({ rotulo: 'Calorias', valor: 'calorias' });
    return { texto: ['Sobre qual meta você quer saber?'], opcoes, proximo: (v) => passoMeta(P, v) };
  },
};

// ---------- dúvida sobre um alimento ----------
const GRUPOS = [
  ['base', 'Arroz, pão, massa e raízes', ['arroz-branco-cozido', 'arroz-integral-cozido', 'macarrao-cozido', 'pao-frances', 'batata-inglesa-cozida', 'mandioca-cozida']],
  ['proteina', 'Feijão, carnes e ovos', ['feijao-carioca-cozido', 'lentilha-cozida', 'peito-de-frango-grelhado', 'patinho-grelhado', 'tilapia-grelhada', 'ovo-cozido']],
  ['leite', 'Leite e queijos', ['leite-integral', 'iogurte-natural', 'queijo-minas-frescal', 'queijo-mucarela', 'requeijao-cremoso']],
  ['frutas', 'Frutas', ['banana-prata', 'maca-fuji', 'mamao-papaia', 'laranja-pera', 'manga-palmer', 'abacate']],
  ['lanches', 'Doces, lanches e bebidas', ['refrigerante-de-cola', 'biscoito-recheado', 'chocolate-ao-leite', 'pizza-de-mucarela', 'coxinha-de-frango', 'acai-na-tigela']],
].map(([id, nome, ids]) => [id, nome, ids.filter((x) => FOOD.has(x))]);
const nomeCurto = (f) => f.nome.split(' (')[0];
const NOME_RESTRICAO = { vegano: 'alimentação vegana', vegetariano: 'alimentação vegetariana', sem_gluten: 'doença celíaca', sem_lactose: 'intolerância à lactose' };
// por que o alimento não serve para a pessoa (restrições e alergias, como o cardápio), ou ''
function conflito(f, P) {
  const al = P.alergias.filter((x) => temAlergeno(f.id, [x]));
  if (al.length) return { tipo: 'alergia', texto: `Com alergia a ${juntaE(al.map((x) => NOME_ALERGIA[x] || x))}, este alimento não serve para você.` };
  const need = [];
  if (P.restricoes.includes('vegano')) need.push('vegano'); else if (P.restricoes.includes('vegetariano')) need.push('vegetariano');
  if (P.restricoes.includes('sem_gluten')) need.push('sem_gluten');
  if (P.restricoes.includes('sem_lactose')) need.push('sem_lactose');
  const falta = need.filter((t) => !f.tags.includes(t));
  if (!falta.length) return null;
  if (falta.length === 1 && falta[0] === 'sem_lactose') return { tipo: 'lactose', texto: 'Com intolerância à lactose, prefira a versão sem lactose.' };
  return { tipo: 'restricao', texto: `Com ${juntaE(falta.map((t) => NOME_RESTRICAO[t]))}, este alimento não serve para você.` };
}
const EMBUTIDOS = /presunto|peito-de-peru|mortadela|salame|salsicha|linguica|bacon|calabresa/;
export function passoAlimento(f, P, pergunta = '') {
  const texto = [], detalhes = [], refs = ['guia2014'];
  const c = conflito(f, P);
  let aviso;
  // "quantas calorias tem um pastel?": os números do alimento primeiro, da tabela de onde ele veio (data/foods.js). Fora
  // de quem tem transtorno alimentar e dos menores de 18, que não veem calorias (o mesmo critério do diário)
  const liq = /\bmL\b/.test(f.porcao.desc) || f.cat === 'bebidas';
  if (/\b(calorias?|kcal|proteinas?|carboidratos?|gorduras?|energia)\b/.test(String(pergunta)) && !P.transtorno && !P.menor) {
    const m = MEDIDAS[f.id], g = m ? m[0] : f.porcao.g, d = m ? m[1] : f.porcao.desc;
    const n1 = (x) => String(Math.round((Number(x) || 0) * 10) / 10).replace('.', ',');
    texto.push(`${f.nome}: ${Math.round(f.kcal)} kcal em 100 ${liq ? "mL" : "g"} (${n1(f.p)} g de proteína, ${n1(f.c)} g de carboidrato e ${n1(f.g)} g de gordura). Na porção de referência, ${d.replace(/\s*\([^)]*\)/g, "")}, cerca de ${Math.round((f.kcal * g) / 100)} kcal.`);
    detalhes.push('Fonte dos números: ' + ({ TACO: 'TACO (Unicamp)', TBCA: 'TBCA (USP)', USDA: 'USDA FoodData Central', IBGE: 'IBGE, POF 2008-2009' }[f.fonte] || f.fonte) + '.');
    refs.push(f.fonte === 'IBGE' ? 'pof2008' : 'taco');
  }
  if (c && c.tipo !== 'lactose') {
    texto.push(c.texto);
    if (c.tipo === 'alergia') { aviso = { tipo: 'warn', texto: 'Leia sempre o rótulo: procure “ALÉRGICOS: CONTÉM” ou “PODE CONTER”.' }; refs.push('anvisa_alergenicos'); }
  } else {
    if (P.transtorno) texto.push(f.nova === 4 ? 'Pode fazer parte da sua vida, sem culpa. No dia a dia, o Guia Alimentar sugere preferir comida feita na hora.' : 'Pode fazer parte da sua alimentação, sem culpa.');
    else if (f.nova === 1 && (f.soDiario || /frit|empanad|milanesa/.test(f.id))) texto.push('Pode, de vez em quando: é uma preparação caseira, mas com bastante óleo ou açúcar. O Guia Alimentar pede óleo, açúcar e sal em pequenas quantidades ao cozinhar.');
    else if (f.nova === 1) texto.push('Pode, sim: é um alimento in natura ou minimamente processado, a base de uma alimentação saudável.');
    else if (f.nova === 2) texto.push('Pode, em pequenas quantidades, para temperar e cozinhar.');
    else if (f.nova === 3) texto.push('Pode: o Guia Alimentar sugere os processados em pequena quantidade, como parte de uma refeição.');
    else texto.push('É um ultraprocessado: o Guia Alimentar recomenda evitar no dia a dia. De vez em quando, sem culpa.');
    if (c) texto.push(c.texto);
  }
  // porção de referência: medida caseira do IBGE (POF) ou a porção da tabela; quem tem transtorno não recebe quantidades
  if (!P.transtorno) {
    const m = MEDIDAS[f.id];
    const desc = m ? m[1] : f.porcao.desc, g = m ? m[0] : f.porcao.g;
    const liquido = /\bmL\b/.test(f.porcao.desc) || f.cat === 'bebidas';
    texto.push(P.menor ? `Porção de referência: ${desc.replace(/\s*\([^)]*\)/g, '')}.` : `Porção de referência: ${desc}${/\(\d/.test(desc) ? '' : ` (${mil(g)} ${liquido ? 'mL' : 'g'})`}.`);
    refs.push(m ? 'pof2008medidas' : 'taco');
    // no cardápio da pessoa (adultos com meta): de quanto a quanto, por refeição
    if (!P.semNumeros && !f.soDiario && m) {
      const lim = porcaoMedida(f.id, 'principal') || porcaoMedida(f.id, 'cafe');
      if (lim) { const mm = { porcao: { g: m[0], desc: m[1] } }; detalhes.push(`No cardápio do aplicativo, de ${medida(mm, lim[0])} a ${medida(mm, lim[1])} por refeição.`); }
    }
  }
  if (!P.transtorno && (!c || c.tipo === 'lactose')) {
    detalhes.push('Nenhum alimento sozinho engorda ou emagrece: o que muda o peso é o total da semana, comparado ao que você gasta.');
    refs.push('helms2014', 'gardner2018');
  }
  if (P.hipertensao && (f.nova === 4 || EMBUTIDOS.test(f.id))) detalhes.push('Com pressão alta, evite ultraprocessados e embutidos.');
  if (P.renal) detalhes.push('Com doença nos rins, as quantidades são as que o seu médico e nutricionista indicarem.');
  if (P.gestante) detalhes.push('Na gestação e na amamentação, siga também o que o pré-natal orientar.');
  if (P.transtorno) detalhes.push('O que comer e quanto, combine com quem acompanha você.');
  detalhes.push('O Guia Alimentar pede comida de verdade como base, óleo, sal e açúcar com moderação, processados em pequena quantidade e ultraprocessados evitados.');
  return { texto, detalhes, refs: refsOk(refs), ...(aviso ? { aviso } : {}), ir: [IR_NUTRI] };
}
// O alimento citado num texto ("posso comer pão francês?", "tapioca engorda?"), ou null
// (as palavras de grupo — fruta, verdura, carne, doce — não apontam um alimento: "qual a melhor fruta para emagrecer")
const PALAVRAS_DE_DUVIDA = new Set(['tem', 'calorias', 'caloria', 'kcal', 'energia', 'proteina', 'proteinas', 'carboidrato', 'carboidratos', 'gordura', 'gorduras', 'quantas', 'quantos', 'fruta', 'frutas', 'verdura', 'verduras', 'legume', 'legumes', 'carne', 'carnes', 'doce', 'doces', 'comida', 'comidas', 'alimento', 'alimentos', 'lanche', 'lanches', 'prato', 'refeicao', 'melhor', 'melhores', 'posso', 'pode', 'comer', 'come', 'como', 'comi', 'engorda', 'engordam', 'emagrece', 'faz', 'mal', 'bem', 'qual', 'quanto', 'quanta', 'porcao', 'porcoes', 'tamanho', 'medida', 'saudavel',
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'e', 'um', 'uma', 'no', 'na', 'noite', 'dia', 'todo', 'eu', 'ok', 'tudo', 'isso', 'ruim', 'bom', 'boa', 'devo', 'quantos', 'quantas', 'gramas', 'colheres', 'por', 'pra', 'para', 'com', 'sem', 'muito', 'pouco', 'dieta', 'ultraprocessado', 'alimento', 'vez', 'quando']);
export function alimentoNoTexto(texto) {
  const pal = normalizar(texto).split(' ').filter((w) => w.length >= 3 && !PALAVRAS_DE_DUVIDA.has(w));
  if (!pal.length) return null;
  const prefere = (l) => l.find((f) => MEDIDAS[f.id]) || l.find((f) => !f.soDiario) || l[0] || null;
  for (let n = pal.length; n >= 1; n--) {
    for (let i = 0; i + n <= pal.length; i++) {
      const achou = buscarAlimentos(pal.slice(i, i + n).join(' '), 40);
      if (achou.length) return prefere(achou);
    }
  }
  return null;
}
const ALIMENTO = {
  id: 'nutri-alimento', coach: 'nutri', titulo: 'Dúvida sobre um alimento', resumo: 'uma dúvida sobre um alimento',
  // um alimento conhecido com uma dúvida sobre ele ("tapioca engorda?", "cuscuz é saudável?")
  bonus: (i) => (/\b(engorda\w*|emagrece\w*|saudavel|faz mal|faz bem|posso comer|pode comer|e bom|e ruim|liberado|pode tomar|posso tomar)\b/.test(i.texto) && !/\b(creatina|whey|cafeina|suplement\w*|pre treino|termogenic\w*|bcaa|glutamina|albumina)\b/.test(i.texto) && alimentoNoTexto(i.texto) ? 2 : 0)
    // "quantas calorias tem um pastel?": as calorias de um alimento citado (não as metas da pessoa)
    + (/\b(calorias?|caloria|kcal|proteinas?|carboidratos?|gorduras?|energia)\b/.test(i.texto) && /\b(tem|tem um|tem uma|de um|de uma|no|na)\b/.test(i.texto) && !/\b(preciso|devo|minha|meu|minhas|meus|por dia|meta)\b/.test(i.texto) && alimentoNoTexto(i.texto) ? 6.5 : 0),
  palavras: ['posso comer', 'pode comer', 'engorda', 'emagrece', 'faz mal', 'faz bem', 'porcao', 'tamanho da porcao', 'quanto de arroz', 'quanto de feijao', 'quanto de carne', 'quanto de pao', 'medida caseira',
    'saudavel', 'ultraprocessado', 'industrializado', 'pao', 'arroz', 'feijao', 'ovo', 'banana', 'refrigerante', 'chocolate', 'doces', 'tapioca', 'cuscuz', 'pizza', 'acai',
    'faz mal comer', 'e ruim', 'tem problema comer', 'liberado', 'pode tomar', 'leite', 'queijo', 'macarrao', 'batata', 'frango', 'carne', 'fruta', 'iogurte', 'granola', 'aveia', 'mel', 'suco', 'cerveja', 'pao integral'],
  inicio: (ctx) => {
    const P = perfilNutri(ctx);
    const f = isObj(ctx) && typeof ctx.texto === 'string' ? alimentoNoTexto(ctx.texto) : null;
    if (f) return passoAlimento(f, P, ctx.texto);
    return {
      texto: ['De que tipo de alimento é a sua dúvida?'],
      opcoes: [...GRUPOS.map(([id, nome]) => ({ rotulo: nome, valor: id })), { rotulo: 'Outro alimento', valor: 'outro' }],
      proximo: (v) => {
        const g = GRUPOS.find((x) => x[0] === v);
        if (!g) {
          const faq = FAQ_NUTRI.filter((x) => /Guia Alimentar/.test(x.q) || (!P.protegido && /sal, açúcar/.test(x.q))).map((x) => ({ q: x.q, a: [...x.a], refs: refsOk(x.f || []) }));
          return { texto: ['Para outro alimento, digite o nome dele no campo de texto.', 'Se eu não tiver a resposta, mostro as perguntas frequentes.'], faq, ir: [IR_NUTRI] };
        }
        return { texto: ['Qual deles?'], opcoes: g[2].map((id) => ({ rotulo: nomeCurto(FOOD.get(id)), valor: id })), proximo: (id) => passoAlimento(FOOD.get(id) || FOOD.get(g[2][0]), P) };
      },
    };
  },
};

// ---------- antes e depois do treino ----------
// (quem tem transtorno não recebe as linhas que falam de peso ou de quilo perdido)
const semPeso = (P, l) => (P.transtorno ? l.filter((t) => !/quilo|peso|pesado/.test(t)) : l);
function treinosDeHoje(P) {
  try { return treinosDoDia(P.st, P.hoje, P.hoje); } catch { return { musculacao: null, corrida: null, conhecido: false }; }
}
function passoAntesDepois(P, qual) {
  const r = P.res;
  if (!r) {
    const texto = qual === 'antes'
      ? ['Uma refeição com carboidrato e um pouco de proteína, de 1 a 4 horas antes: quanto mais perto do treino, menor e mais leve.', 'Exemplos: banana com iogurte e aveia, pão com ovos, ou o próprio almoço, 2 a 3 horas antes.']
      : ['Faça uma refeição com proteína e carboidrato nas 2 horas seguintes.', 'Se você comeu bem antes do treino, não há pressa.'];
    if (P.diabetes) texto.push('Com diabetes, não treine em jejum sem orientação médica.');
    return { texto, detalhes: ['Responda à entrevista da Nutricionista para eu ajustar os exemplos às suas restrições e ao seu horário de treino.'], refs: refsOk(qual === 'antes' ? ['thomas2016', 'kerksick2017'] : ['kerksick2017', 'aragon2013']), ir: [{ rotulo: 'Responder à entrevista', rota: 'nutricao' }] };
  }
  // protegidos sempre sem números (mesmo que a conta tenha outro modo)
  const rr = P.protegido ? { ...r, modo: 'educativo', agua: null, aguaBebidas: null, aguaPre: null } : r;
  const tr = treinosDeHoje(P);
  const o = orientacaoDoDia(rr, tr);
  const e = emVoltaDoTreino(rr, !!(tr.musculacao && tr.musculacao.forte));
  const semN = rr.modo === 'educativo';
  const detalhes = [];
  if (!o.treina && !o.semAgenda) detalhes.push('Hoje é dia de descanso no seu plano: isto vale para o próximo treino.');
  let texto;
  if (qual === 'antes') {
    const intro = o.antes ? o.antes.intro : semN ? 'Carboidrato de fácil digestão e um pouco de proteína, de 1 a 2 horas antes.' : `Carboidrato de fácil digestão (cerca de ${e.carbPre} g) e um pouco de proteína, de 1 a 2 horas antes.`;
    const itens = o.antes ? o.antes.itens : e.pre;
    texto = [intro, `Exemplos: ${itens.slice(0, 2).map(minusc).join('; ')}.`];
    detalhes.push(o.antes ? o.resumo : e.horario, ...(o.antes ? o.antes.extras : []), ...itens.slice(2), o.antes ? o.agua : e.agua);
  } else {
    const intro = o.depois ? o.depois.intro : semN ? 'Uma refeição com proteína e carboidrato, até 2 horas depois.' : `Uma refeição com cerca de ${e.protPos} g de proteína e carboidrato, até 2 horas depois.`;
    const itens = o.depois ? o.depois.itens : e.pos;
    texto = [intro, ...itens.slice(0, 1)];
    detalhes.push(...itens.slice(1), ...(o.depois ? o.depois.extras : []), 'A “janela” depois do treino é larga: se você comeu bem antes, não há pressa.');
  }
  return { texto: semPeso(P, texto), detalhes: semPeso(P, detalhes.filter(Boolean)), refs: refsOk(['thomas2016', 'kerksick2017', 'aragon2013', ...(o.refs || [])]), ir: [IR_NUTRI] };
}
const DURACOES = [['ate45', 'Até 45 minutos', 40], ['ate75', 'De 45 a 75 minutos', 60], ['ate150', 'De 75 min a 2 h 30', 120], ['mais', 'Mais de 2 h 30', 180]];
function passoCorrida(P, v) {
  const min = (DURACOES.find((x) => x[0] === v) || DURACOES[0])[2];
  const semN = P.protegido || (P.res && P.res.modo === 'educativo');
  const d = carboidratoNaCorrida(min, semN);
  const texto = [d.texto, 'Água: beba conforme a sede, sem forçar.'];
  if (P.diabetes) texto.push('Com diabetes, não corra em jejum e leve sempre um carboidrato de ação rápida.');
  const detalhes = [];
  if (d.gHora) detalhes.push('Um gel tem de 20 a 30 g de carboidrato; 30 g são também 2 bananas-prata ou 1 bananada e meia.');
  detalhes.push('Beber além da sede dilui o sódio do sangue (hiponatremia), o que é perigoso.');
  if (!P.transtorno) detalhes.push('Se você termina a corrida mais pesado do que começou, bebeu demais.');
  detalhes.push('Teste tudo nos treinos longos, nunca no dia da prova.');
  if (P.res && P.res.corrida && P.res.corrida.prova) detalhes.push('Você tem uma prova marcada: o plano da prova está na tela da Nutrição.');
  return { texto, detalhes, refs: refsOk(['thomas2016', 'jeukendrup2014', 'ais_gel', 'hewbutler2017']), ir: [IR_NUTRI] };
}
function passoJejum(P) {
  if (P.diabetes) return { texto: ['Com diabetes, não treine em jejum sem orientação médica: pode dar hipoglicemia.', 'Coma algo leve de 30 a 60 minutos antes.'], refs: refsOk(['colberg2016', 'aragon2013']), ir: [IR_NUTRI] };
  if (P.protegido) return { texto: [P.menor ? 'Antes dos 18 anos, jejum sem acompanhamento não é indicado.' : 'Com histórico de transtorno alimentar, jejum sem acompanhamento não é indicado.', 'Coma algo leve antes do treino.'], detalhes: [quemAcompanha(P)], refs: refsOk(['cioffi2018']), ir: [IR_NUTRI] };
  return {
    texto: ['Pode, se você se sente bem e o treino é leve ou moderado.', 'Se der fraqueza ou tontura, coma algo leve antes. Depois, faça logo uma refeição com proteína.'],
    detalhes: ['Treinar em jejum não ajuda a perder mais gordura quando as calorias do dia são as mesmas.', P.gestante ? 'Na gestação e na amamentação, combine com o seu médico.' : ''].filter(Boolean),
    refs: refsOk(['schoenfeld2014', 'aragon2013']), ir: [IR_NUTRI],
  };
}
const TREINO = {
  id: 'nutri-treino', coach: 'nutri', titulo: 'O que comer antes e depois do treino', resumo: 'o que comer antes e depois do treino',
  palavras: ['estomago vazio', 'lanche pre treino', 'melhor lanche', 'antes do treino', 'depois do treino', 'pos treino', 'comer antes de treinar', 'comer depois de treinar', 'o que comer antes', 'o que comer depois', 'antes de correr', 'depois de correr',
    'durante a corrida', 'gel de carboidrato', 'gel', 'janela anabolica', 'treinar em jejum', 'treino em jejum', 'correr em jejum', 'refeicao pre treino', 'refeicao pos treino',
    'antes de malhar', 'depois de malhar', 'antes da academia', 'depois da academia', 'comer antes', 'comer depois', 'treinar sem comer', 'correr sem comer', 'antes da corrida', 'depois da corrida'],
  inicio: (ctx) => {
    const P = perfilNutri(ctx);
    return {
      texto: ['O que você quer saber?'],
      opcoes: [{ rotulo: 'Antes do treino', valor: 'antes' }, { rotulo: 'Depois do treino', valor: 'depois' }, { rotulo: 'Durante a corrida', valor: 'corrida' }, { rotulo: 'Treinar em jejum', valor: 'jejum' }],
      proximo: (v) => {
        if (v === 'jejum') return passoJejum(P);
        if (v === 'corrida') return { texto: ['Quanto tempo dura a corrida?'], opcoes: DURACOES.map(([valor, rotulo]) => ({ rotulo, valor })), proximo: (d) => passoCorrida(P, d) };
        return passoAntesDepois(P, v === 'depois' ? 'depois' : 'antes');
      },
    };
  },
};

// ---------- suplementos ----------
function motivoSuplemento(P) {
  if (P.menor) return 'Antes dos 18 anos, a Anvisa não permite suplemento de cafeína, e creatina e proteína em pó só com orientação do médico ou nutricionista.';
  if (P.gestante) return 'Na gestação e na amamentação, a Anvisa não permite suplemento de cafeína, e os outros só com o seu médico.';
  if (P.renal) return 'Com doença nos rins, suplementos só com o seu médico.';
  if (P.transtorno) return 'Com histórico de transtorno alimentar, pré-treino e produtos para emagrecer não. Os outros, converse com quem acompanha você.';
  return '';
}
function passoSuplemento(P, qual) {
  // protegidos sempre caem no caminho sem doses, mesmo que a conta tenha outro modo
  const res = P.res && !P.protegido ? P.res : P.res ? { ...P.res, modo: 'educativo' } : null;
  const s = suplementos(res);
  const ir = [IR_NUTRI];
  if (s.semDoses && qual !== 'outros') {
    const mot = motivoSuplemento(P);
    const texto = [P.res ? 'No seu caso, não mostro doses de suplementos.' : 'Responda à entrevista da Nutricionista para eu ver o que serve para você.', mot || 'Suplemento não é obrigatório: comida de verdade resolve.'];
    const extra = qual === 'pre' ? [s.preTreino.itens[0].texto] : qual === 'creatina' ? ['É o suplemento com mais evidência para força e massa em adultos.'] : qual === 'proteina' ? ['Proteína em pó é só uma forma prática de proteína: a comida resolve.'] : [];
    return { texto, detalhes: [...extra, s.aviso], refs: refsOk([...(s.preTreino.introRefs || []), 'anvisa_in28', 'kreider2017']), ir: P.res ? ir : [{ rotulo: 'Responder à entrevista', rota: 'nutricao' }] };
  }
  if (qual === 'outros') {
    return { texto: ['Sem boa evidência: ' + juntaE(s.semEvidencia.slice(0, 4).map((x) => x.nome.toLowerCase())) + '.', s.preTreino.itens.find((x) => x.titulo === 'Fuja destes').texto],
      detalhes: s.semEvidencia.map((x) => `${x.nome}: ${x.texto}`), refs: refsOk(s.semEvidencia.flatMap((x) => x.refs).concat(['anvisa2013'])), ir };
  }
  if (qual === 'pre') {
    const p = s.preTreino;
    if (p.bloqueado) return { texto: [p.intro], aviso: { tipo: 'warn', texto: p.itens[0].texto }, detalhes: [p.itens[0].porque], refs: refsOk([...(p.introRefs || []), ...p.itens.flatMap((x) => x.refs)]), ir };
    const quanto = p.itens.find((x) => x.cafeina);
    return { texto: [p.intro, quanto ? quanto.texto : ''].filter(Boolean), detalhes: p.itens.filter((x) => x !== quanto).map((x) => `${x.titulo}: ${x.texto}`), refs: refsOk([...(p.introRefs || []), ...p.itens.flatMap((x) => x.refs)]), ir };
  }
  const b = s.boas.find((x) => x.id === qual) || s.boas[0];
  const passo = { texto: [`${b.nome}: ${b.texto}`], detalhes: [b.porque, s.aviso], refs: refsOk(b.refs), ir };
  if (qual === 'cafeina' && !s.semCafeina) {
    passo.texto.push('Quantas xícaras de café você toma por dia?');
    passo.opcoes = [0, 1, 2, 3, 4].map((n) => ({ rotulo: n === 4 ? '4 ou mais' : String(n), valor: String(n) }));
    passo.proximo = (v) => {
      const lim = limiteDeCafeina(res, Number(v) || 0);
      return { texto: [lim ? lim.texto : b.texto, 'Evite cafeína perto da hora de dormir.'], detalhes: [b.porque], refs: refsOk([...b.refs, 'gardiner2023']), ir };
    };
  }
  return passo;
}
const SUPLEMENTOS = {
  id: 'nutri-suplementos', coach: 'nutri', titulo: 'Suplementos: creatina, whey, cafeína', resumo: 'suplementos',
  palavras: ['!suplemento', '!suplementos', '!creatina', '!whey', 'creatina+mal', 'whey+mal', 'cafeina+mal', 'suplemento+mal', 'proteina em po', '!cafeina', 'pre treino', '!termogenico', 'queimador', 'bcaa', 'glutamina', 'beta alanina', 'multivitaminico', 'vitamina d',
    'ferro', 'bicarbonato', 'nitrato', 'albumina', 'hipercalorico', 'energetico', 'tribulus', 'anabolizante'],
  inicio: (ctx) => {
    const P = perfilNutri(ctx);
    return {
      texto: ['Sobre qual suplemento?'],
      opcoes: [{ rotulo: 'Creatina', valor: 'creatina' }, { rotulo: 'Whey e proteína em pó', valor: 'proteina' }, { rotulo: 'Cafeína', valor: 'cafeina' }, { rotulo: 'Pré-treino pronto', valor: 'pre' }, { rotulo: 'BCAA, termogênico e outros', valor: 'outros' }],
      proximo: (v) => passoSuplemento(P, v),
    };
  },
};

// ---------- sem fome, sem tempo, comendo fora ----------
function passoPratico(P, qual) {
  const temCardapio = !!(P.res && P.res.modo !== 'educativo');
  if (qual === 'fome') {
    const lan = exemplos(P, LANCHES, 2);
    const texto = ['Tudo bem: não precisa comer muito de uma vez.', `Prefira refeições menores e um lanche simples, como ${juntaOu(lan)}.`];
    if (P.diabetes) texto.push('Com diabetes, não pule refeições sem orientação: pode dar hipoglicemia.');
    const detalhes = ['Comer em horários parecidos, devagar e com atenção, ajuda o corpo a regular o apetite (Guia Alimentar).'];
    if (temCardapio) detalhes.push('Prefere refeições menores? Aumente o número de refeições na entrevista: a meta do dia é dividida entre elas.');
    detalhes.push(P.transtorno ? 'Se a falta de fome vem com medo de comer ou de engordar, fale com quem acompanha você.' : 'Se a falta de fome continuar, converse com um médico ou nutricionista.');
    return { texto, detalhes, refs: refsOk(['guia2014']), ir: [IR_NUTRI] };
  }
  if (qual === 'tempo') {
    const rapidos = exemplos(P, [['omelete', ['ovo'], ['vegano']], ['sopa', [], []], ['arroz com legumes', [], []]], 3);
    const detalhes = ['Lave e seque as verduras com antecedência, para a semana.', `Lanches que não vão ao fogo: ${juntaOu(exemplos(P, LANCHES, 3))}.`, 'Planeje as compras e o cardápio da semana.'];
    if (temCardapio) detalhes.push('Na tela da Nutrição, “Semana e compras” monta o cardápio dos 7 dias e a lista de compras.');
    return { texto: ['Dá para comer bem com pouco tempo.', 'Cozinhe o feijão em maior quantidade num dia e congele em porções para a semana.', `Em dias corridos, prefira pratos rápidos: ${juntaE(rapidos)}.`], detalhes, refs: refsOk(['guia2014']), ir: [IR_NUTRI] };
  }
  const prot = P.semCarne ? juntaOu(exemplos(P, PROTEINAS.filter(([t]) => !/frango|carne|peixe/.test(t)), 3)) : 'carne, frango, peixe ou ovos';
  const detalhes = ['Bufê livre e rodízio: deixe para ocasiões especiais e sirva-se uma vez só.'];
  const refs = ['guia2014'];
  if (P.alergias.length) { detalhes.push('Comida de restaurante não traz o aviso de alergênicos: pergunte como foi feita.'); refs.push('anvisa_alergenicos'); }
  if (P.restricoes.includes('sem_gluten')) detalhes.push('Doença celíaca: cuidado com a contaminação em utensílios e no óleo de fritura.');
  return { texto: ['Prefira lugares com comida feita na hora, como restaurante a quilo.', `Monte o prato: metade salada e legumes, um quarto arroz ou batata, um quarto ${prot}, e feijão.`, 'Evite fast-food no dia a dia.'], detalhes, refs: refsOk(refs) };
}
const PRATICO = {
  id: 'nutri-pratico', coach: 'nutri', titulo: 'Sem fome, sem tempo ou comendo fora', resumo: 'falta de fome, de tempo ou comer fora de casa',
  palavras: ['!churrasco', 'como me organizo', 'trabalho o dia todo', 'fora o dia todo', 'comer direito', 'dia todo fora', 'sem fome', 'nao tenho fome', 'sem apetite', 'falta de apetite', 'sem tempo', 'nao tenho tempo', 'correria', 'sem tempo para cozinhar', 'nao sei cozinhar', 'cozinhar', 'marmita',
    'comer fora', 'vou comer fora', 'restaurante', 'lanchonete', 'almoco fora', 'comida a quilo', 'self service', 'fast food', 'delivery', 'pedir comida', 'viagem', 'viajar', '!restaurante', '!lanchonete', 'almocar fora', 'jantar fora', 'almocar restaurante', 'comer restaurante',
    'fome nenhuma', 'nao consigo comer muito', 'trabalho fora', 'marmita trabalho', 'ifood', 'lanche rua', 'sem tempo comer'],
  inicio: (ctx) => {
    const P = perfilNutri(ctx);
    return {
      texto: ['O que está acontecendo?'],
      opcoes: [{ rotulo: 'Estou sem fome', valor: 'fome' }, { rotulo: 'Sem tempo para cozinhar', valor: 'tempo' }, { rotulo: 'Vou comer fora', valor: 'fora' }],
      proximo: (v) => passoPratico(P, v),
    };
  },
};

// ---------- mudar o plano alimentar ----------
const rotuloDe = (k, v) => { const q = PERGUNTAS.find((x) => x.k === k); const o = q && q.op ? q.op.find((x) => x[0] === v) : null; return o ? o[1] : ''; };
function passoPlano(P, qual) {
  const a = P.a;
  const texto = [], detalhes = [];
  const ir = [IR_NUTRI];
  if (qual === 'objetivo') {
    if (ROTULO.objetivo[a.objetivo]) texto.push(`Hoje o seu objetivo é: ${ROTULO.objetivo[a.objetivo].toLowerCase()}.`);
    texto.push(P.semNumeros ? 'Ao mudar, eu atualizo as orientações.' : 'Ao mudar, eu recalculo as metas e o cardápio.');
    detalhes.push('Mantenha a mesma meta por pelo menos 2 a 3 semanas antes de mudar de novo.');
  } else if (qual === 'peso') {
    if (P.transtorno) texto.push('Para você, não uso números de peso. Se algo mudou na sua saúde, refaça a entrevista.');
    else if (P.menor) texto.push('Antes dos 18 anos, não calculo metas de peso. Se algo mudou, refaça a entrevista.');
    else {
      if (typeof a.peso === 'number') texto.push(`O peso da entrevista é ${dec(a.peso)} kg.`);
      texto.push(P.semNumeros ? 'Com o peso novo, eu atualizo as orientações.' : 'Com o peso novo, eu recalculo as metas.');
      detalhes.push('O peso oscila de um dia para o outro: pese-se uma vez por semana, ao acordar, e olhe a tendência.', 'Registre o peso na tela Evolução para ver a tendência.');
      ir.push({ rotulo: 'Abrir a Evolução', rota: 'progresso' });
    }
  } else if (qual === 'rotina') {
    const t = rotuloDe('treinos', a.treinos), h = rotuloDe('horario', a.horario);
    if (t) texto.push(`Hoje está: ${t.toLowerCase()}${h && a.treinos !== '0' ? ', ' + h.toLowerCase() : ''}.`);
    texto.push('Dias de treino, horário e o seu dia a dia mudam o gasto estimado e as dicas de antes e depois do treino.');
  } else {
    texto.push('Restrições, alergias e condições de saúde mudam o cardápio, as trocas e os cuidados que eu mostro.');
    detalhes.push('Gestação, diabetes, doença nos rins e transtorno alimentar pedem acompanhamento profissional: nesses casos eu mostro menos números e mais orientações.');
  }
  texto.push(REFAZER);
  ir.unshift(IR_REFAZER);
  if (typeof P.st.nutri?.calculadoEm === 'string' && diaOk(P.st.nutri.calculadoEm.slice(0, 10))) { const [y, m, d] = P.st.nutri.calculadoEm.slice(0, 10).split('-'); detalhes.push(`Entrevista feita em ${d}/${m}/${y}.`); }
  return { texto, ...(detalhes.length ? { detalhes } : {}), refs: refsOk(['guia2014']), ir };
}
const PLANO = {
  id: 'nutri-plano', coach: 'nutri', titulo: 'Mudar o meu plano alimentar', resumo: 'mudar o seu plano alimentar',
  palavras: ['ganhei peso', 'perdi peso', 'refazer o plano', 'refazer a entrevista', 'mudar o plano', 'mudar a dieta', 'ajustar a dieta', 'ajustar o plano', 'mudei de objetivo', 'mudar objetivo', 'novo objetivo', 'meu peso mudou', 'peso mudou',
    'emagreci', 'engordei', 'atualizar peso', 'mudei a rotina', 'mudar horario', 'novo horario', 'plano alimentar', 'recalcular', 'atualizar plano'],
  inicio: (ctx) => {
    const P = perfilNutri(ctx);
    if (!Object.keys(P.a).length || !respostasCompletas(P.a)) return convite('Você ainda não tem plano alimentar: responda à entrevista da Nutricionista.');
    return {
      texto: ['O que mudou?'],
      opcoes: [{ rotulo: 'Meu objetivo', valor: 'objetivo' }, { rotulo: 'Meu peso', valor: 'peso' }, { rotulo: 'Minha rotina de treinos', valor: 'rotina' }, { rotulo: 'Saúde ou restrições', valor: 'saude' }],
      proximo: (v) => passoPlano(P, v),
    };
  },
};

// ---------- sinais de risco no texto ----------
const R = {
  vomitoForte: /\b(dedo na garganta|(provoc|forc|induz)\w* (o |a )?vomit\w*|vomit\w* de proposito|vomit\w* (\w+ ){0,2}(para|pra) (nao engordar|emagrecer|compensar|perder peso))\b/,
  vomito: /\b(vomit\w*|vomitar)\b/,
  contextoComida: /\b(comer|comi|comida|comendo|como|refeicao|refeicoes|almoco|jantar|lanche|engordar|engorde|emagrecer|peso|culpa|compensar|caloria\w*|barriga|dieta)\b/,
  doente: /\b(estragad\w*|virose|intoxica\w*|gravidez|gravida|enjoo|ressaca|bebi|febre|gripe|doente|infeccao|labirintite|enxaqueca|quimio\w*)\b/,
  purgativo: /\b(laxant\w*|laxativ\w*|diuretic\w*|furosemida|lasix)\b/,
  paraEmagrecer: /\b(emagrec\w*|perder (peso|barriga|medida\w*|quilo\w*)|secar|compensar|nao engordar|engordar|eliminar|desinchar|enxugar|depois de comer|o que comi)\b/,
  remedio: /\b((remedio|remedios|comprimido\w*|capsula\w*|pilula\w*) (\w+ ){0,2}(para|pra) emagrecer|inibidor\w* de apetite|moderador\w* de apetite|sibutramina)\b/,
  jejum: /\b(jejum (de|por) (\d+|dois|duas|tres|quatro|cinco|seis|sete|varios|alguns|uns) dias|jejum prolongado|(\d+|dois|duas|tres|quatro|cinco|varios|alguns|uns) dias (sem comer|de jejum|so (com|de|tomando|bebendo) agua)|(fiquei|ficar|fico|vou ficar|passar|passei|passo|ficando) (\w+ ){0,2}dias sem comer|sem comer (ha|faz|por) (\d+ |dois |tres |varios |alguns |uns )?dias|nao como (ha|faz) (\d+ |dois |tres |varios |alguns |uns )?dias)\b/,
  restricao: /\b((como|comendo|comer|comi|comia) quase nada|nao (estou|to|tou|ando) comendo (nada|quase nada)|nao como nada|medo de comer|parei de comer( (de vez|por completo|direito|(para|pra) emagrecer)\b|$))/,
  // (vontade de se punir ou de se machucar também é risco à vida: o mesmo acolhimento, com o CVV e o CAPS)
  vida: /\b(quero morrer|vontade de morrer|me matar|suicid\w*|tirar (a )?minha (propria )?vida|nao quero mais viver|acabar com a minha vida|(queria|quero|vontade de|preciso|tenho que|devia|deveria) me (punir|castigar|machucar|ferir|cortar)|me punir|me castigar|punir (o )?meu corpo|autolesao|automutila\w*)\b/,
  vidaNao: /\bmorrer de (rir|fome|vergonha|calor|frio|saudade|sono|cansaco|tedio)\b/,
};
// Sinais de comportamento de risco alimentar (ou de risco à vida) num texto. Recebe o texto (o motor já manda
// normalizado, sem acento e em minúsculas; normalizar de novo não muda nada). Devolve a lista de ids (vazia = nenhum).
export function sinaisDeRisco(textoNormalizado) {
  const t = normalizar(textoNormalizado);
  if (!t) return [];
  const out = [];
  if (R.vomitoForte.test(t) || (R.vomito.test(t) && R.contextoComida.test(t) && !R.doente.test(t))) out.push('vomito');
  if (R.purgativo.test(t) && R.paraEmagrecer.test(t)) out.push('purgativo');
  if (R.remedio.test(t)) out.push('remedio');
  if (R.jejum.test(t)) out.push('jejum');
  if (R.restricao.test(t)) out.push('restricao');
  if (R.vida.test(t) && !(R.vidaNao.test(t) && !/\b(me matar|suicid\w*|nao quero mais viver)\b/.test(t))) out.push('vida');
  return out;
}
// Acolhimento curto, sem julgamento e sem números (ver o topo do arquivo). `sinais` = resultado de sinaisDeRisco.
export function passoDeRisco(sinais = [], _ctx = null) {
  const l = Array.isArray(sinais) ? sinais : [];
  if (l.includes('vida')) {
    return {
      texto: ['Obrigado por me contar. Você merece cuidado agora.', 'Se você corre perigo, ligue 192 (SAMU) ou vá a um pronto-socorro.', 'Para conversar agora, ligue 188 (CVV): é gratuito, sigiloso e funciona 24 horas.'],
      aviso: { tipo: 'danger', texto: 'Em perigo agora: 192 (SAMU). Para conversar: 188 (CVV), 24 horas.' },
      detalhes: ['O CVV também atende por chat e e-mail em cvv.org.br, com voluntários, sem julgamentos.', 'No SUS, a Unidade Básica de Saúde e os CAPS (Centros de Atenção Psicossocial) cuidam da saúde mental; o CAPS recebe quem chega por conta própria.'],
      refs: refsOk(REFS_APOIO),
    };
  }
  return {
    texto: ['Obrigado por me contar. Você merece cuidado.', 'O que você descreveu pode ser sinal de sofrimento com a comida. Não é culpa sua, e tem tratamento.', 'Procure um profissional de saúde. No SUS, a Unidade Básica de Saúde pode atender e encaminhar você.', 'Se precisar conversar agora, ligue 188 (CVV): é gratuito e funciona 24 horas.'],
    aviso: { tipo: 'warn', texto: 'Em uma emergência, ligue 192 (SAMU).' },
    detalhes: [
      'Vomitar depois de comer, passar longos períodos em jejum, comer cada vez menos e usar laxantes, diuréticos ou remédios para emagrecer sem receita são comportamentos que o Ministério da Saúde descreve nos transtornos alimentares.',
      'Transtorno alimentar não é escolha nem falta de força de vontade. A recuperação completa é possível, e quanto antes vier a ajuda, melhor.',
      'Os CAPS (Centros de Atenção Psicossocial) do SUS cuidam dos casos mais graves e recebem quem chega por conta própria ou encaminhado pela Unidade Básica.',
      'O CVV também atende por chat e e-mail em cvv.org.br, com sigilo e sem julgamentos.',
    ],
    refs: refsOk(REFS_APOIO),
  };
}
const APOIO = {
  id: 'nutri-apoio', coach: 'nutri', titulo: 'Preocupação com a comida', resumo: 'a sua relação com a comida',
  palavras: ['pensar em comida', 'penso em comida', 'pensando em comida', 'pensando comida', 'parar de pensar comida', '!culpa', '!culpado', '!culpada', 'como escondido', 'comer escondido', 'escondido', 'nervoso+comer', 'como nervoso', 'ansioso+comer', 'sinto culpa', 'fico mal', 'me sinto mal', 'ansiedade comida', 'ansiedade+comida', 'vomitar', 'vomito', 'provocar vomito', 'laxante', 'diuretico', 'remedio para emagrecer', 'jejum de dias', 'ficar sem comer', 'comer quase nada', 'parei de comer', 'medo de comer', 'medo de engordar',
    'transtorno alimentar', 'anorexia', 'bulimia', 'compulsao', 'compulsao alimentar', 'relacao com a comida', 'perdi o controle'],
  inicio: (ctx) => passoDeRisco(['geral'], ctx),
};

// ---------- o cardápio de um dia ("o que eu como hoje?", "e amanhã?") ----------
// O mesmo cardápio da tela da Nutrição, para o dia da conversa (ctx.data). Sem quantidades no balão (os nomes dos
// alimentos só); quem não tem cardápio (modo educativo, sem entrevista) recebe o prato do Guia Alimentar.
const diaDoCtx = (ctx) => (isObj(ctx) && diaOk(ctx.data) ? ctx.data : isObj(ctx) && diaOk(ctx.hoje) ? ctx.hoje : hojeLocal());
const quandoTxt = (data, hoje) => (data === hoje ? 'hoje' : data === somarDias(hoje, 1) ? 'amanhã' : data === somarDias(hoje, -1) ? 'ontem' : ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][new Date(data + 'T12:00:00Z').getUTCDay()]);
const CARDAPIO = {
  id: 'nutri-cardapio', coach: 'nutri', titulo: 'O que eu como hoje', resumo: 'o seu cardápio de hoje', resumoNoDia: 'o seu cardápio', data: true,
  // "o que eu como hoje?", "o que almoçar?": "como" sozinho é ambíguo ("como fica"); com "o que" na frente é o cardápio
  bonus: (i) => (/\b(o que|que|oq|q) (eu )?(vou )?(como|comer|almoco|almocar|janto|jantar|lancho|lanchar|tomo de cafe)\b/.test(i.texto) && !/\b(antes|depois|durante|pre|pos|treino|treinar|correr|corrida)\b/.test(i.texto) ? 2.5 : 0),
  palavras: ['lanche da tarde', 'tem pro lanche', 'o que tem pro', '!cardapio', 'o que vou comer', 'menu', 'refeicoes hoje', 'comer amanha', 'o que almocar', 'o que jantar', 'almoco hoje', 'jantar hoje', 'cafe da manha hoje', 'sugestao almoco', 'sugestao jantar', 'qual almoco', 'qual jantar', 'cardapio amanha', 'minhas refeicoes', 'tem pra comer', 'lanche agora', 'o que lanchar'],
  inicio: (ctx) => {
    const hoje = isObj(ctx) && diaOk(ctx.hoje) ? ctx.hoje : hojeLocal();
    const data = diaDoCtx(ctx);
    const P = perfilNutri({ ...(isObj(ctx) ? ctx : {}), hoje: data });
    const q = quandoTxt(data, hoje);
    const Q = q.charAt(0).toUpperCase() + q.slice(1);
    if (!P.res) return convite('Para eu montar o seu cardápio, responda primeiro à entrevista da Nutricionista.');
    const dia = cardapioDeHoje(P);
    if (!dia) return { texto: ['No seu caso, não monto cardápio com quantidades.', motivoSemNumeros(P), 'Monte o prato assim: metade salada e legumes, um quarto arroz ou batata, um quarto de uma fonte de proteína, e feijão.'].filter(Boolean), ir: [IR_NUTRI], refs: refsOk(['guia2014']) };
    if (!dia.refeicoes.length) return { texto: ['Com o que está marcado em casa, não dá para montar uma refeição.', 'Marque mais alimentos na tela da Nutrição.'], ir: [IR_NUTRI] };
    const linhas = dia.refeicoes.slice(0, 6).map((r) => `• ${r.nome}: ${nomesDosItens(r)}`);
    const out = {
      texto: [`${Q}, o seu cardápio:`, ...linhas],
      detalhes: ['As quantidades de cada alimento estão na tela da Nutrição, em medidas caseiras.', 'O cardápio segue o Guia Alimentar: comida de verdade como base.'],
      refs: refsOk(['guia2014', 'pof2008medidas']), ir: [IR_NUTRI], data,
    };
    // trocar uma refeição: só a de hoje (a troca da tela vale para o dia)
    if (data === hoje && dia.refeicoes.length > 1) {
      out.texto.push('Quer trocar alguma refeição?');
      out.opcoes = [{ rotulo: 'Sim, trocar uma', valor: 's' }, { rotulo: 'Não, está bom', valor: 'n' }];
      out.proximo = (v, c) => (v === 's' ? TROCAR.inicio(c) : { texto: ['Bom apetite!'], ir: [IR_NUTRI] });
    }
    return out;
  },
};

export const INTENCOES = [CARDAPIO, TROCAR, EXAGEREI, METAS, ALIMENTO, TREINO, SUPLEMENTOS, PRATICO, PLANO, APOIO];

// Saúde nas entrevistas: as perguntas de segurança que o Treinador (musculação) e o Treinador de corrida compartilham, e a
// UNIÃO do que as três entrevistas (Treinador, Treinador de corrida e Nutricionista) dizem sobre a saúde. Puro: sem DOM.
//
// Fontes, lidas em texto completo:
//  • PAR-Q+ 2023 (ref parq2023): as 7 perguntas gerais — doença do coração ou pressão alta; dor no peito em repouso, no dia
//    a dia ou no esforço; perda de equilíbrio por tontura ou desmaio nos últimos 12 meses ("responda NÃO se a tontura veio
//    de respirar demais, inclusive em exercício vigoroso"); outra doença crônica; remédio receitado para doença crônica;
//    problema nos ossos, articulações ou tecidos moles que pode piorar com mais atividade (NÃO, se é antigo e não limita
//    hoje); e "um médico já disse que você só deve fazer atividade física com supervisão médica". Gestação: conversar com o
//    profissional de saúde antes de ficar mais ativa. A liberação "vale por no máximo 12 meses a partir da data em que foi
//    preenchida e perde a validade se a condição mudar". As perguntas de acompanhamento (asma e outras doenças
//    respiratórias, osteoporose, câncer, epilepsia...) não dão um efeito próprio para o treino: quem responde SIM a uma
//    delas deve buscar mais orientação (ePARmed-X+ ou profissional). Por isso essas doenças entram como "outra doença
//    crônica", que já tem efeito definido nos treinadores.
//  • Algoritmo de triagem do ACSM de 2015, lido inteiro em Whitfield 2017 (ref whitfield2017), nota da Fig. 1 — sinais e
//    sintomas: "dor ou desconforto no peito, pescoço, mandíbula, braços ou outras áreas que pode vir de isquemia; falta de
//    ar em repouso ou com esforço leve; tontura ou desmaio; falta de ar deitado ou que acorda à noite (ortopneia, dispneia
//    paroxística noturna); inchaço nos tornozelos; palpitações ou taquicardia; dor na perna ao caminhar (claudicação
//    intermitente); sopro no coração conhecido; cansaço fora do comum ou falta de ar nas atividades de sempre". Quem tem
//    sintoma, com ou sem doença, deve procurar liberação médica antes de começar ou de continuar exercício de QUALQUER
//    intensidade. Doença cardiovascular = do coração, vascular periférica ou cerebrovascular (daí "Coração, circulação ou
//    AVC"); metabólica = diabetes tipo 1 e 2; e renal.
//  • Remédios: quem usa betabloqueador deve se guiar pelo esforço, não pela frequência cardíaca (refs sbc2020,
//    pescatello2004 — o mesmo aviso que o Treinador de corrida já dava para a pressão alta); quem usa insulina ou
//    sulfonilureia tem risco de hipoglicemia no exercício (ref colberg2016).
//
// Ids canônicos (os mesmos nas entrevistas do Treinador e da corrida): condições hipertensao, cardiaco, diabetes, renal,
// gestante, posparto, transtorno, cronica; sinais da lista SINAIS; remédios pulso, glicose, outro. Na Nutricionista,
// "outra" vale como "cronica" e "transtorno" (transtorno alimentar, uma das condições de saúde mental do PAR-Q+) como
// "transtorno" — que nos treinadores tem o efeito de "cronica" (ver condicoesDe); "gestante" lá é "gestação ou
// amamentação" e não dá para saber qual das duas.

// ---------- datas ----------
export const diaValido = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
// a liberação vale por até 12 meses (parq2023)
export const VALIDADE_LIBERACAO = 365;

// ---------- opções das perguntas (a opção "nenhum" sempre por último) ----------
export const CONDICOES = [
  ['hipertensao', 'Pressão alta', ''],
  ['cardiaco', 'Coração, circulação ou AVC', 'Doença do coração, das artérias ou das veias, ou AVC'],
  ['diabetes', 'Diabetes', ''],
  ['renal', 'Doença nos rins', ''],
  ['gestante', 'Gestação', ''],
  ['posparto', 'Parto nos últimos 6 meses', ''],
  ['transtorno', 'Transtorno alimentar', 'Atual ou no passado'],
  ['cronica', 'Outra doença crônica', 'Por exemplo: asma, osteoporose, câncer, epilepsia ou depressão'],
  ['nenhuma', 'Nenhuma', ''],
];
export const SINAIS = [
  ['dor_peito', 'Dor, pressão ou aperto no peito, no pescoço, na mandíbula ou no braço', 'Em repouso, no dia a dia ou ao fazer esforço'],
  ['falta_ar', 'Falta de ar em repouso ou com pouco esforço, como um lance de escada', ''],
  ['falta_ar_deitado', 'Falta de ar quando você se deita, ou que acorda você à noite', ''],
  ['palpitacao', 'Palpitações: o coração dispara ou bate fora do ritmo sem motivo', ''],
  ['tontura', 'Tontura com perda de equilíbrio, ou desmaio, nos últimos 12 meses', 'Não conta a tontura de respirar rápido demais num esforço forte'],
  ['tornozelos', 'Inchaço nos tornozelos', ''],
  ['perna', 'Dor na perna ao caminhar, que passa quando você para', ''],
  ['sopro', 'Sopro no coração', 'Que um médico já disse que você tem'],
  ['cansaco', 'Cansaço fora do comum nas atividades de sempre', ''],
  ['osseo', 'Problema nos ossos, articulações, músculos ou tendões que pode piorar com exercício', 'Atual ou dos últimos 12 meses. Não conta o que é antigo e não limita você hoje'],
  ['medico', 'Um médico já disse que só devo me exercitar com supervisão', ''],
  ['nenhum', 'Nenhum deles', ''],
];
export const REMEDIOS = [
  ['pulso', 'Remédio para pressão ou coração que deixa o pulso mais baixo', 'Por exemplo, betabloqueador: atenolol, propranolol, metoprolol, carvedilol'],
  ['glicose', 'Insulina ou remédio que pode baixar demais o açúcar no sangue', 'Por exemplo: glibenclamida, gliclazida, glimepirida'],
  ['outro', 'Outro remédio de uso contínuo, receitado por médico', ''],
  ['nenhum', 'Nenhum', ''],
];
const ids = (l, fora) => new Set(l.map((o) => o[0]).filter((x) => x !== fora));
const COND_IDS = ids(CONDICOES, 'nenhuma'), SINAL_IDS = ids(SINAIS, 'nenhum'), REMEDIO_IDS = ids(REMEDIOS, 'nenhum');
const nomeDe = (l, id) => { const o = l.find((x) => x[0] === id); return o ? o[1] : id; };
// nomes curtos, em minúsculas, para as frases "Você informou ... ao Treinador de corrida"
const CURTO = {
  condicao: { hipertensao: 'pressão alta', cardiaco: 'doença do coração, da circulação ou AVC', diabetes: 'diabetes', renal: 'doença nos rins', gestante: 'gestação', posparto: 'parto nos últimos 6 meses', transtorno: 'transtorno alimentar', cronica: 'outra doença crônica' },
  sinal: { dor_peito: 'dor ou pressão no peito', falta_ar: 'falta de ar com pouco esforço', falta_ar_deitado: 'falta de ar deitado ou à noite', palpitacao: 'palpitações', tontura: 'tontura ou desmaio', tornozelos: 'inchaço nos tornozelos', perna: 'dor na perna ao caminhar', sopro: 'sopro no coração', cansaco: 'cansaço fora do comum', osseo: 'problema nos ossos ou articulações', medico: 'restrição médica (exercício só com supervisão)' },
  remedio: { pulso: 'remédio que deixa o pulso mais baixo', glicose: 'remédio que pode baixar o açúcar no sangue', outro: 'remédio de uso contínuo' },
};
export const nomeCurto = (tipo, id) => (CURTO[tipo] && CURTO[tipo][id]) || id;

// ---------- as perguntas (o Treinador e o Treinador de corrida usam as mesmas) ----------
// `limpa`: ao mudar a resposta, a liberação médica dada antes deixa de valer (parq2023: perde a validade se a condição muda).
export const perguntaCondicoes = () => ({ k: 'condicoes', tipo: 'varios', titulo: 'Alguma destas condições se aplica a você?', ajuda: 'Marque o que um médico já disse que você tem.', nenhum: 'nenhuma', limpa: ['liberado'], op: CONDICOES });
export const perguntaTriagem = () => ({ k: 'triagem', tipo: 'varios', titulo: 'Antes de começar: você tem algum destes sinais?', ajuda: 'São as perguntas de segurança usadas antes de começar exercícios.', nenhum: 'nenhum', limpa: ['liberado'], op: SINAIS });
// opcional: entrevistas salvas antes desta pergunta continuam valendo (sem remédio informado)
export const perguntaRemedios = () => ({ k: 'remedios', tipo: 'varios', opcional: true, titulo: 'Você toma algum remédio de uso contínuo?', ajuda: 'Alguns mudam a forma de medir o esforço ou pedem cuidado com o açúcar no sangue.', nenhum: 'nenhum', limpa: ['liberado'], op: REMEDIOS });
// `dataEm`: a resposta "sim" guarda a data (AAAA-MM-DD) em que foi dada; ela vale por 12 meses
export const perguntaLiberado = (se, titulo, sim = 'Sim, estou liberado') => ({
  k: 'liberado', tipo: 'um', se, dataEm: 'liberadoEm', titulo,
  ajuda: 'Com essas respostas, a recomendação é ter liberação médica antes. Vale a liberação dos últimos 12 meses, dada sabendo dessas condições e sinais.',
  op: [['sim', sim, 'Um médico me liberou nos últimos 12 meses'], ['nao', 'Ainda não', '']],
});

// ---------- leitura das respostas ----------
const lista = (x) => (Array.isArray(x) ? [...new Set(x.filter((y) => typeof y === 'string'))] : []);
const resp = (o) => (o && typeof o === 'object' && o.answers && typeof o.answers === 'object' && !Array.isArray(o.answers) ? o.answers : {});
export const sinaisDe = (a) => lista(a && a.triagem).filter((x) => SINAL_IDS.has(x));
export const remediosDe = (a) => lista(a && a.remedios).filter((x) => REMEDIO_IDS.has(x));
// Condições, já com o que os remédios dizem: insulina ou remédio que baixa o açúcar é tratamento de diabetes (colberg2016);
// remédio de uso contínuo para doença crônica sem nenhuma condição marcada vale como "outra doença crônica" (parq2023,
// perguntas 4 e 5). Transtorno alimentar tem opção própria (protege o diário alimentar: logic/diario.js, modoDoDiario),
// mas nos treinadores tem o mesmo efeito de "outra doença crônica": o PAR-Q+ não dá a ele um efeito próprio no treino.
export function condicoesDe(a) {
  const c = lista(a && a.condicoes).filter((x) => COND_IDS.has(x));
  const r = remediosDe(a);
  if (r.includes('glicose') && !c.includes('diabetes')) c.push('diabetes');
  if (r.includes('outro') && !c.length) c.push('cronica');
  if (c.includes('transtorno') && !c.includes('cronica')) c.push('cronica');
  return c;
}
// "outra doença crônica" que só existe por causa do transtorno alimentar (com transtorno marcado, o remédio contínuo não
// acrescenta "crônica": ver acima)
const cronicaDoTranstorno = (a, c) => c.includes('transtorno') && !lista(a && a.condicoes).includes('cronica');
export const soComSupervisao = (a) => sinaisDe(a).includes('medico');

// Liberação médica guardada: 'valida' | 'vencida' (mais de 12 meses) | 'sem_data' (resposta antiga, sem data, ou data
// impossível) | 'nao' | 'falta' (sem resposta). `hoje` = 'AAAA-MM-DD'. Dois dias de folga para o relógio do aparelho.
export function estadoLiberacao(a, hoje) {
  if (!a || a.liberado !== 'sim') return a && a.liberado === 'nao' ? 'nao' : 'falta';
  if (!diaValido(a.liberadoEm) || !diaValido(hoje)) return 'sem_data';
  const d = diasEntre(a.liberadoEm, hoje);
  if (d < -2) return 'sem_data';
  return d > VALIDADE_LIBERACAO ? 'vencida' : 'valida';
}

// ---------- união das três entrevistas ----------
export const ORIGEM = { treinador: 'ao Treinador', corrida: 'ao Treinador de corrida', nutri: 'à Nutricionista' };
const DA_NUTRI = { diabetes: 'diabetes', hipertensao: 'hipertensao', renal: 'renal', cardiaco: 'cardiaco', outra: 'cronica', transtorno: 'transtorno' };
const NOME_NUTRI = { outra: 'outra doença crônica', transtorno: 'transtorno alimentar' };
// Tudo o que as entrevistas dizem sobre a saúde: itens [{ tipo: 'condicao'|'sinal'|'remedio', id, origem, nome,
// derivada? }], gestação ou amamentação na Nutricionista, alergias alimentares e as idades. `derivada`: a "outra doença
// crônica" que vem só do transtorno alimentar — vale para quem lê o efeito (Nutricionista), mas não é copiada como
// resposta para as outras entrevistas (lá, o próprio transtorno já dá o mesmo efeito).
export function uniaoSaude(st) {
  const s = st && typeof st === 'object' ? st : {};
  const itens = [];
  const add = (tipo, id, origem, nome, derivada = false) => { if (!itens.some((x) => x.tipo === tipo && x.id === id && x.origem === origem)) itens.push({ tipo, id, origem, nome: nome || nomeCurto(tipo, id), ...(derivada ? { derivada: true } : {}) }); };
  const idades = [];
  for (const [origem, a] of [['treinador', resp(s.trainer)], ['corrida', resp(s.run)]]) {
    const cs = condicoesDe(a);
    for (const c of cs) { if (c === 'cronica' && cronicaDoTranstorno(a, cs)) add('condicao', c, origem, nomeCurto('condicao', 'transtorno'), true); else add('condicao', c, origem); }
    for (const x of sinaisDe(a)) add('sinal', x, origem);
    for (const x of remediosDe(a)) add('remedio', x, origem);
    if (typeof a.idade === 'number' && Number.isFinite(a.idade)) idades.push({ valor: a.idade, origem });
  }
  const n = resp(s.nutri);
  const cn = lista(n.condicoes);
  for (const c of cn) if (Object.prototype.hasOwnProperty.call(DA_NUTRI, c)) add('condicao', DA_NUTRI[c], 'nutri', NOME_NUTRI[c]);
  if (typeof n.idade === 'number' && Number.isFinite(n.idade)) idades.push({ valor: n.idade, origem: 'nutri' });
  return { itens, gestacaoOuAmamentacao: cn.includes('gestante'), alergias: lista(n.alergias).filter((x) => x !== 'nenhuma'), idades };
}

const juntaNomes = (l) => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]);
const semNenhum = (l, nenhum) => { const x = l.filter((y) => y !== nenhum); return x.length ? x : l; };

// Respostas de uma entrevista ('treinador' ou 'corrida') com a proteção das outras: o que outra entrevista marcou e esta
// não (condição, sinal da triagem ou remédio) passa a valer aqui também, e a liberação médica só vale se estiver dentro
// dos 12 meses e tiver sido dada sabendo de tudo isso (as próprias respostas cobrem a união). Devolve
//   { respostas, deFora: itens vindos de fora, liberacao: estadoLiberacao ou 'nao_cobre', renovar: bool, avisos }.
// `avisos` diz de onde veio cada proteção ("você informou X ao Treinador de corrida").
export function respostasProtegidas(alvo, st, hoje) {
  const s = st && typeof st === 'object' ? st : {};
  const proprio = alvo === 'corrida' ? 'corrida' : 'treinador';
  const own = resp(proprio === 'corrida' ? s.run : s.trainer);
  const u = uniaoSaude(s);
  const tem = { condicao: new Set(condicoesDe(own)), sinal: new Set(sinaisDe(own)), remedio: new Set(remediosDe(own)) };
  const deFora = u.itens.filter((x) => x.origem !== proprio && !tem[x.tipo].has(x.id));
  const out = { ...own };
  const soma = (k, tipo, nenhum) => {
    const novos = [...new Set(deFora.filter((x) => x.tipo === tipo && !x.derivada).map((x) => x.id))];
    if (novos.length) out[k] = semNenhum([...new Set([...lista(own[k]), ...novos])], nenhum);
  };
  soma('condicoes', 'condicao', 'nenhuma'); soma('triagem', 'sinal', 'nenhum'); soma('remedios', 'remedio', 'nenhum');
  const avisos = [];
  for (const origem of Object.keys(ORIGEM)) {
    const l = deFora.filter((x) => x.origem === origem);
    if (l.length) avisos.push({ tipo: 'warn', saude: 'fora', texto: `Você informou ${juntaNomes([...new Set(l.map((x) => x.nome))])} ${ORIGEM[origem]}, mas não aqui. Por segurança, vale a resposta mais protegida também aqui. Confira as entrevistas.` });
  }
  if (u.gestacaoOuAmamentacao && !tem.condicao.has('gestante') && !tem.condicao.has('posparto')) avisos.push({ tipo: 'warn', saude: 'gestacao', texto: 'Você informou gestação ou amamentação à Nutricionista. Se está grávida, marque “Gestação” nesta entrevista: na gestação, o plano só sai com a liberação do seu médico.' });
  // a liberação dada aqui não cobre o que veio de fora (exceto remédios que não mudam a triagem)
  const cobre = !deFora.some((x) => x.tipo !== 'remedio' || x.id === 'glicose');
  let liberacao = estadoLiberacao(own, hoje);
  if (liberacao === 'valida' && !cobre) liberacao = 'nao_cobre';
  if (own.liberado === 'sim' && liberacao !== 'valida') out.liberado = 'nao';
  // o que veio de fora pede uma liberação que esta entrevista nunca perguntou: conta como "ainda não"
  if (out.liberado == null && !cobre) out.liberado = 'nao';
  return { respostas: out, deFora, liberacao, renovar: liberacao === 'vencida' || liberacao === 'sem_data', avisos };
}
// Texto da tela quando a liberação guardada não vale mais (para a tela pedir de novo).
export function textoDaLiberacao(estado) {
  if (estado === 'vencida') return 'A liberação médica que você informou tem mais de 12 meses. Ela vale por no máximo 12 meses: confirme com o seu médico antes de seguir.';
  if (estado === 'sem_data') return 'A liberação médica que você informou não tem data. Ela vale por no máximo 12 meses e deixa de valer se a sua saúde mudar: confirme antes de seguir.';
  if (estado === 'nao_cobre') return 'A liberação médica que você informou foi dada antes do que você contou em outra entrevista. Ela deixa de valer quando a saúde muda: refaça a entrevista e peça uma nova liberação.';
  return '';
}

// Respostas para começar uma entrevista: as guardadas mais o que as outras entrevistas marcaram (a pessoa confere e
// desmarca o que não vale). Gestação ou amamentação na Nutricionista entra como "Gestação" para ser conferida.
export function respostasParaEntrevista(alvo, st) {
  const s = st && typeof st === 'object' ? st : {};
  const proprio = alvo === 'corrida' ? 'corrida' : 'treinador';
  const own = resp(proprio === 'corrida' ? s.run : s.trainer);
  const u = uniaoSaude(s);
  const out = { ...own };
  const junta = (k, tipo, nenhum, extra = []) => {
    const novos = [...new Set([...u.itens.filter((x) => x.tipo === tipo && x.origem !== proprio && !x.derivada).map((x) => x.id), ...extra])];
    // só os ids que a pergunta tem (condições derivadas de remédio entram pelo remédio)
    const validos = tipo === 'condicao' ? COND_IDS : tipo === 'sinal' ? SINAL_IDS : REMEDIO_IDS;
    const cur = lista(own[k]);
    const add = novos.filter((x) => validos.has(x) && !cur.includes(x));
    if (add.length) out[k] = semNenhum([...cur, ...add], nenhum);
  };
  junta('condicoes', 'condicao', 'nenhuma', u.gestacaoOuAmamentacao && !lista(own.condicoes).includes('posparto') ? ['gestante'] : []);
  junta('triagem', 'sinal', 'nenhum');
  junta('remedios', 'remedio', 'nenhum');
  return out;
}

export const NOMES = { condicao: (id) => nomeDe(CONDICOES, id), sinal: (id) => nomeDe(SINAIS, id), remedio: (id) => nomeDe(REMEDIOS, id) };

// Teste de estresse da Nutricionista: dezenas de milhares de perfis (grade completa + amostragem com semente fixa).
// Confere as metas (calorias, macros, água, fibras), as travas de segurança, o cardápio de exemplo e os textos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTOS, alergenosDe, temAlergeno, MEDIDAS } from '../www/js/data/foods.js';
import { REFS, FAQ_NUTRI } from '../www/js/data/knowledge.js';
import { PERGUNTAS, calcular, cardapio, proximaSemente, assinatura, orientacaoCorrida, emVoltaDoTreino, imcFaixa, textosDoPeso, suplementos, fmtDuracao, PAL_DIA, PAL_TREINO, PAL_MAX } from '../www/js/logic/nutrition.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));
function semente(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const um = (r, l) => l[Math.floor(r() * l.length)];
const inteiro = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const op = (k) => PERGUNTAS.find((q) => q.k === k).op.map((o) => o[0]);
const OBJ = op('objetivo'), SEXO = op('sexo'), ATIV = op('atividade'), TREINOS = op('treinos'), HORARIO = op('horario'), REF = op('refeicoes');
const REST = op('restricoes').filter((x) => x !== 'nenhuma');
const COND = op('condicoes').filter((x) => x !== 'nenhuma');
const subconjuntos = (l) => { const out = []; for (let m = 0; m < 1 << l.length; m++) out.push(l.filter((_, i) => m & (1 << i))); return out; };
const TODAS_REST = subconjuntos(REST).map((x) => (x.length ? x : ['nenhuma']));   // 16 combinações
const TODAS_COND = subconjuntos(COND).map((x) => (x.length ? x : ['nenhuma']));   // 128 combinações
const base = { objetivo: 'emagrecer', sexo: 'm', idade: 30, peso: 80, altura: 178, atividade: 'sedentario', treinos: '3', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };
const PRECO = op('preco');
// custo do dia nos preços de referência da pesquisa (R$): só para comparar cardápios entre si
const custoDia = (c) => c.refeicoes.reduce((s, ref) => s + ref.itens.reduce((t, it) => t + (FOOD.get(it.id).preco.kg * it.g) / 1000, 0), 0);
const semLixo = (s) => typeof s === 'string' && s.length > 0 && !/undefined|NaN|null|Infinity|\[object/.test(s);
const PISO = { m: 1500, f: 1200 };

class Falhas {
  constructor() { this.m = new Map(); this.n = 0; }
  add(cat, det) { this.n++; const x = this.m.get(cat) || { n: 0, ex: [] }; x.n++; if (x.ex.length < 3) x.ex.push(det); this.m.set(cat, x); }
  texto() { return [...this.m].map(([c, x]) => `${c}: ${x.n}\n    ${x.ex.join('\n    ')}`).join('\n'); }
  confere(titulo) { assert.equal(this.n, 0, `${titulo}: ${this.n} falhas\n${this.texto()}`); }
}
const rotulo = (a) => JSON.stringify(a);
let TOTAL = 0, CARDAPIOS = 0;

// ---------- metas ----------
function validarMetas(a, F) {
  const rot = rotulo(a);
  let r;
  try { r = calcular(a); } catch (e) { F.add('calcular lançou erro', `${rot}: ${e.message}`); return null; }
  const cond = a.condicoes.filter((x) => x !== 'nenhuma'), rest = a.restricoes.filter((x) => x !== 'nenhuma');
  const h = a.altura / 100;
  const imc = a.peso / (h * h);
  const pesoRef = Math.min(a.peso, 25 * h * h);   // acima do IMC 25, as contas por quilo usam o peso de IMC 25
  // campos sempre presentes
  for (const k of ['imc', 'tmb', 'gasto', 'fator', 'peso', 'idade']) if (!(Number.isFinite(r[k]) && r[k] > 0)) F.add(`campo ${k} inválido`, `${rot}: ${r[k]}`);
  if (Math.abs(r.imc - imc) > 1e-9) F.add('IMC errado', rot);
  const tmb = 9.99 * a.peso + 6.25 * a.altura - 4.92 * a.idade + (a.sexo === 'm' ? 5 : -161);   // coeficientes como em ruiz2011
  if (Math.abs(r.tmb - tmb) > 5.01) F.add('Mifflin-St Jeor não confere', `${rot}: ${r.tmb} vs ${tmb}`);
  // nível de atividade (PAL) do relatório FAO/OMS/UNU: dia a dia de 1,45 a 1,90, mais 0,20 por hora diária de treino, até 2,40
  const pal = Math.min(PAL_MAX, PAL_DIA[ATIV.indexOf(a.atividade)] + PAL_TREINO[a.treinos]);
  if (Math.abs(r.fator - pal) > 0.0015 || r.fator < 1.4 || r.fator > 2.4) F.add('fator de atividade diferente do PAL da FAO (1,40 a 2,40)', `${rot}: ${r.fator} vs ${pal}`);
  // água total: a ingestão adequada da EFSA (2,0 L mulheres; 2,5 L homens), com 1,6 e 2,0 L em bebidas; antes do treino, 150 mL a 1,5 L
  // no modo educativo (menores, gestação e amamentação, doença renal...) não há número de água nenhum: os valores são de adultos
  if (r.modo === 'educativo') { if (r.agua !== null || r.aguaBebidas !== null || r.aguaPre !== null) F.add('modo educativo com número de água', rot); if (/[0-9]/.test(emVoltaDoTreino(r).agua)) F.add('modo educativo com dose de água no treino', rot); }
  else {
    if (r.agua !== (a.sexo === 'm' ? 2.5 : 2.0)) F.add('água total diferente da ingestão adequada da EFSA', `${rot}: ${r.agua}`);
    if (r.aguaBebidas !== (a.sexo === 'm' ? 2.0 : 1.6)) F.add('água em bebidas diferente de 1,6 L / 2,0 L', `${rot}: ${r.aguaBebidas}`);
    if (!(Array.isArray(r.aguaPre) && r.aguaPre[0] >= 150 && r.aguaPre[0] < r.aguaPre[1] && r.aguaPre[1] <= 1500)) F.add('água pré-treino implausível', `${rot}: ${r.aguaPre}`);
  }
  for (const av of r.avisos) { if (!['danger', 'warn', 'info'].includes(av.tipo)) F.add('tipo de aviso desconhecido', rot); if (!semLixo(av.texto)) F.add('aviso com valor inválido', `${rot}: ${av.texto}`); if (av.texto.length > 330) F.add('aviso longo demais', av.texto); }
  const aviso = (re) => r.avisos.some((x) => re.test(x.texto));
  if (cond.includes('hipertensao') && !aviso(/sal a 5 g/)) F.add('pressão alta sem orientação de sal', rot);
  if (cond.includes('outra') && !aviso(/médico ou nutricionista/)) F.add('doença crônica sem aviso', rot);
  if (rest.includes('vegano') && !aviso(/B12/)) F.add('vegano sem aviso de B12', rot);
  if (rest.includes('sem_gluten') && !aviso(/celíaca/)) F.add('sem glúten sem aviso', rot);
  // (com vegano o aviso da lactose seria repetido: o cardápio já não tem leite)
  if (rest.includes('sem_lactose') && !rest.includes('vegano') && !aviso(/lactose/)) F.add('sem lactose sem aviso', rot);
  if (rest.includes('sem_lactose') && rest.includes('vegano') && aviso(/Intolerância à lactose/)) F.add('aviso de lactose repetido para vegano', rot);

  // modos
  const deveEducar = a.idade < 18 || cond.some((c) => ['gestante', 'transtorno', 'renal'].includes(c));
  if (deveEducar && r.modo !== 'educativo') F.add('deveria ser modo educativo', rot);
  if (a.idade < 18 && !aviso(/18 anos/)) F.add('menor sem aviso', rot);
  if (cond.includes('gestante') && !aviso(/gestação/i)) F.add('gestante sem aviso', rot);
  if (cond.includes('transtorno') && !aviso(/188/)) F.add('transtorno alimentar sem aviso/CVV', rot);
  if (cond.includes('renal') && !r.avisos.some((x) => x.tipo === 'danger' && /rins/.test(x.texto))) F.add('doença renal sem aviso de perigo', rot);
  if (r.modo === 'educativo') {
    for (const k of ['kcal', 'prot', 'carb', 'gord', 'ritmo', 'gkg', 'fibra', 'protRefeicao', 'objetivoCalc']) if (r[k] !== undefined) F.add('modo educativo mostrando número', `${rot}: ${k}`);
    if (!r.avisos.some((x) => x.tipo !== 'info')) F.add('modo educativo sem explicação', rot);
    if (cardapio(r, 0) !== null) F.add('modo educativo com cardápio', rot);
    return r;
  }
  if (r.gasto < 1000) F.add('meta calculada com estimativa de gasto abaixo de 1000 kcal', `${rot}: ${r.gasto}`);
  // números das metas
  for (const k of ['kcal', 'prot', 'carb', 'gord', 'gkg', 'fibra']) if (!(Number.isFinite(r[k]) && r[k] > 0)) F.add(`meta ${k} inválida`, `${rot}: ${r[k]}`);
  const piso = PISO[a.sexo];
  // emagrecer só quando a perda é indicada (AHA/ACC/TOS 2013; ESPEN 2022): nunca abaixo do piso de IMC (18,5; 60+: 22),
  // nem quando perder 5% do peso já cruzaria o piso, nem com 65 anos ou mais sem obesidade
  const imcPiso = a.idade >= 60 ? 22 : 18.5;
  const baixoPeso = imc < imcPiso;
  const semIndicacao = baixoPeso || a.peso * 0.95 < imcPiso * h * h || (a.idade >= 65 && imc < 30);
  const esperado = cond.includes('diabetes') ? 'manter' : a.objetivo === 'emagrecer' && semIndicacao ? 'manter' : a.objetivo === 'ganhar' && imc >= 30 ? 'manter' : a.objetivo;
  if (a.objetivo === 'emagrecer' && semIndicacao && !cond.includes('diabetes') && !aviso(/abaixo da faixa|mínimo saudável|65 anos/)) F.add('emagrecer sem indicação e sem explicação', rot);
  if (r.objetivoCalc !== esperado) F.add('objetivo efetivo errado', `${rot}: ${r.objetivoCalc} (esperado ${esperado})`);
  if ((r.modo === 'manutencao') !== (cond.includes('diabetes') || esperado !== a.objetivo)) F.add('modo manutenção inconsistente', rot);
  if (r.modo === 'manutencao' && !r.avisos.some((x) => x.tipo === 'warn')) F.add('manutenção forçada sem explicação', rot);
  // calorias: pisos de segurança, déficit e superávit (AHA/ACC/TOS 2013; Helms 2014; Iraki 2019; Slater 2019)
  if (r.kcal < Math.min(piso, r.gasto)) F.add('calorias abaixo do piso de segurança', `${rot}: ${r.kcal}`);
  if (r.kcal < 1000) F.add('meta abaixo de 1000 kcal', `${rot}: ${r.kcal}`);
  if (r.objetivoCalc === 'emagrecer') {
    const def = r.gasto - r.kcal;
    // teto do déficit: 750 kcal; 500 kcal com 65 anos ou mais (ESPEN); e o que dá 1% do peso por semana (11 kcal por quilo)
    const teto = Math.min(a.idade >= 65 ? 500 : 750, a.peso * 11);
    if (def < 0 || def > teto + 10 || def > r.gasto * 0.2 + 10) F.add('déficit fora de 0–20% (máx. 750 kcal; 500 kcal aos 65+; 1% do peso por semana)', `${rot}: ${def}`);
    if (r.gasto > piso * 1.3 && def < Math.min(r.gasto * 0.1, teto - 10)) F.add('emagrecer sem déficit de verdade', `${rot}: ${def}`);
    if (r.gasto <= piso && !aviso(/gasto estimado já é baixo/)) F.add('gasto baixo sem aviso', rot);
    if (a.idade >= 65 && !aviso(/Depois dos 65 anos, emagrecer pede cuidado/)) F.add('65+ emagrecendo sem aviso', rot);
    if (a.idade < 65 && imc < (a.idade >= 60 ? 27.05 : 25) && !aviso(/faixa saudável.*não baixe de \d+ kg/)) F.add('emagrecer na faixa saudável sem aviso e sem peso mínimo', rot);
    // a perda por semana sai do déficit real (7.700 kcal por quilo) e não passa de 1% do peso; sem déficit, não aparece
    if (r.ritmo !== undefined) F.add('emagrecer com ritmo fixo (deve sair do déficit real)', rot);
    if (r.deficit !== def) F.add('déficit informado diferente de gasto − meta', `${rot}: ${r.deficit} vs ${def}`);
    const t = textosDoPeso(r), txt = [t.ritmo || '', ...t.linhas].join(' ');
    if (def >= 50) {
      if (!(Math.abs(r.perdaSemana - (def * 7) / 7700) <= 0.006)) F.add('perda por semana diferente do déficit real', `${rot}: ${r.perdaSemana} (déficit ${def})`);
      if (r.perdaSemana > Math.min(1, a.peso * 0.01) + 0.02) F.add('perda acima de 1% do peso por semana', `${rot}: ${r.perdaSemana}`);
      if (!/perda esperada é de cerca de (\d+ g|\d+(,\d)? kg) por semana/.test(t.ritmo || '')) F.add('texto da perda mal formado', `${rot}: ${t.ritmo}`);
      if (/reduza de 100 a 200/.test(txt) && r.kcal - 100 < piso) F.add('manda reduzir calorias com a meta já no piso', rot);
    } else {
      if (r.perdaSemana !== undefined || t.ritmo) F.add('perda por semana mostrada sem déficit', rot);
      if (/reduza|perda esperada/.test(txt)) F.add('texto de redução sem déficit', rot);
    }
    if (aviso(/Não sugiro comer menos/) && /reduza|perda esperada/.test(txt)) F.add('"não sugiro comer menos" junto com ritmo ou redução', rot);
    for (const s of [t.ritmo || 'x', ...t.linhas]) if (!semLixo(s) || s.length > 200) F.add('texto do peso inválido', s);
  } else if (r.objetivoCalc === 'ganhar') {
    const sup = r.kcal - r.gasto;
    if (sup <= 0 || sup > 510 || sup > r.gasto * 0.1 + 10) F.add('superávit fora de 0–10% (máx. 500 kcal)', `${rot}: ${sup}`);
    if (!(r.ritmo && r.ritmo[0] > 0 && r.ritmo[0] <= r.ritmo[1] && r.ritmo[1] <= a.peso * 0.005 + 0.06)) F.add('ritmo de ganho acima de 0,5% do peso', `${rot}: ${r.ritmo}`);
  } else {
    if (r.kcal !== r.gasto) F.add('manutenção diferente do gasto', `${rot}: ${r.kcal} vs ${r.gasto}`);
    if (r.ritmo !== undefined || r.perdaSemana !== undefined || textosDoPeso(r).ritmo || textosDoPeso(r).linhas.length) F.add('manutenção com ritmo de peso', rot);
    if (r.gasto < piso && !aviso(/abaixo de \d+ kcal/)) F.add('estimativa abaixo do piso sem aviso', rot);
  }
  // proteína por kg de peso de referência. Quem treina: ISSN 2017 (1,4–2,0), Morton 2018 (1,6, até 2,2), Helms 2014 (parte
  // alta em déficit). Quem não treina: RDA 0,8 no mínimo; 1,2–1,6 em déficit (Leidy 2015). 65+: pelo menos 1,2 (PROT-AGE).
  const gkg = r.prot / pesoRef;
  const treina = Number(a.treinos) >= 2;
  const manter = r.objetivoCalc === 'manter';
  const [lo, hi] = treina ? (manter ? [1.4, 2.0] : [1.6, 2.2]) : manter ? [0.8, 1.4] : r.objetivoCalc === 'emagrecer' ? [1.2, 1.8] : [1.4, 1.8];
  // em déficit, nunca abaixo de 1,2 g por kg com o peso limitado ao de IMC 30 (Weijs 2025)
  if (r.objetivoCalc === 'emagrecer' && r.prot < 1.2 * Math.min(a.peso, 30 * h * h) - 3 && r.prot * 4 < r.kcal * 0.33) F.add('déficit com menos de 1,2 g/kg (peso até IMC 30)', `${rot}: ${r.prot}`);
  const noTeto = r.prot * 4 >= r.kcal * 0.33 || r.prot >= 2.2 * a.peso - 3; // limitada a 35% das calorias ou a 2,2 g por kg de peso real
  const noPiso = r.prot <= (r.kcal * 0.1) / 4 + 2.6;                              // erguida ao piso de 10% das calorias (IOM)
  if (gkg > Math.max(hi, rest.includes('vegano') ? 2.2 : 0) + 0.08 && !noPiso) F.add('proteína acima da faixa de evidência', `${rot}: ${gkg.toFixed(2)} g/kg`);
  if (gkg < lo - 0.08 && !noTeto) F.add('proteína abaixo da faixa de evidência', `${rot}: ${gkg.toFixed(2)} g/kg`);
  if (a.idade >= 65 && gkg < 1.1 && !noTeto) F.add('65+ com menos de 1,2 g/kg', `${rot}: ${gkg.toFixed(2)}`);
  if (r.prot > 2.2 * a.peso + 3) F.add('proteína acima de 2,2 g por kg de peso', `${rot}: ${r.prot}`);
  if (r.prot * 4 > r.kcal * 0.36 + 10) F.add('proteína acima de 35% das calorias', `${rot}: ${r.prot}`);
  if (r.prot * 4 < r.kcal * 0.09 && !noTeto) F.add('proteína abaixo de 10% das calorias', `${rot}: ${r.prot}`);
  if (Math.abs(r.gkg - r.prot / a.peso) > 0.051) F.add('g/kg mostrado não confere', rot);
  // macros somam as calorias; gordura 20–35%; carboidrato nunca residual
  const soma = r.prot * 4 + r.carb * 4 + r.gord * 9;
  if (Math.abs(soma - r.kcal) > 25) F.add('macros não somam as calorias (±25 kcal)', `${rot}: ${soma} vs ${r.kcal}`);
  const pg = (r.gord * 9) / r.kcal;
  if (pg < 0.19 || pg > 0.37) F.add('gordura fora de 20–35% das calorias', `${rot}: ${Math.round(pg * 100)}%`);
  if ((r.carb * 4) / r.kcal < 0.25) F.add('carboidrato abaixo de 25% das calorias', `${rot}: ${r.carb} g`);
  if (r.carb < 75) F.add('carboidrato abaixo de 75 g', `${rot}: ${r.carb}`);
  if (r.fibra < 25 || r.fibra > 50) F.add('fibras fora de 25–50 g', `${rot}: ${r.fibra}`);
  if (!(r.protRefeicao[0] >= 5 && r.protRefeicao[0] < r.protRefeicao[1] && r.protRefeicao[1] <= 60)) F.add('proteína por refeição implausível', `${rot}: ${r.protRefeicao}`);
  if (r.refeicoes !== Number(a.refeicoes)) F.add('número de refeições perdido', rot);
  return r;
}

// ---------- cardápio ----------
// piso da proteína do dia de exemplo: 85% da meta; sem carne, com meta de proteína alta para as calorias, 80% (acima de
// 18% das calorias) ou 78% (acima de 25%), porque a soja e as leguminosas, nas porções de referência, não chegam a mais
const semCarneDe = (a) => (Array.isArray(a.restricoes) ? a.restricoes : []).some((x) => x === 'vegano' || x === 'vegetariano');
const pisoDaProteina = (a, r) => { const q = (r.prot * 4) / r.kcal; return semCarneDe(a) && q >= 0.25 ? 0.78 : semCarneDe(a) && q >= 0.18 ? 0.8 : 0.85; };
// quantidade máxima realista por alimento numa refeição, pelo papel dele no prato
function validarCardapio(a, r, seed, F, { metas = true } = {}) {
  const rot = `${rotulo(a)} seed=${seed}`;
  // Com as porções de referência (IBGE: no máximo 6 colheres de arroz, 2 conchas de feijão, 2 bifes por prato), uma
  // refeição comporta perto de 1.000 kcal: metas de mais de 850 kcal por refeição (ex.: 3.000 kcal em 3 refeições,
  // 3.500 kcal em 4) são conferidas como extremas — o dia fica perto, mas pode ficar mais de 10%
  // abaixo; com 5 ou 6 refeições, a régua é 700 kcal (os lanches, nas porções de referência, comportam de 200 a 400 kcal).
  // E dietas sem carne com proteína acima de 25% das calorias (metas baixas de calorias com proteína alta)
  // ficam com pelo menos 78% da proteína (80% acima de 18% das calorias): soja, feijões e grão-de-bico nas porções de
  // referência não chegam a mais (pisoDaProteina).
  if (metas && r.kcal / Number(a.refeicoes) > (Number(a.refeicoes) >= 5 ? 700 : 850)) metas = false;
  const pisoP = pisoDaProteina(a, r);
  let c;
  try { c = cardapio(r, seed); } catch (e) { F.add('cardápio lançou erro', `${rot}: ${e.message}`); return; }
  CARDAPIOS++;
  if (!c) { F.add('cardápio ausente', rot); return; }
  const rest = a.restricoes.filter((x) => x !== 'nenhuma');
  if (c.refeicoes.length !== Number(a.refeicoes)) F.add('número de refeições diferente do pedido', `${rot}: ${c.refeicoes.length}`);
  const nomes = c.refeicoes.map((x) => x.nome);
  if (new Set(nomes).size !== nomes.length) F.add('refeição com nome repetido', rot);
  if (!/Café da manhã/.test(nomes[0]) || !nomes.includes('Almoço') || !nomes.includes('Jantar')) F.add('faltam as refeições principais', `${rot}: ${nomes}`);
  const noDia = new Map();
  let k = 0, p = 0;
  for (const ref of c.refeicoes) {
    if (ref.itens.length < (ref.tipo === 'principal' ? 4 : 1)) F.add('refeição pobre (principal com menos de 4 itens ou outra vazia)', `${rot}: ${ref.nome} = ${ref.itens.map((x) => x.id)}`);
    // até 8 itens por refeição; com meta alta (mais de 900 kcal por refeição, em média), até 10
    // (o prato aceita 9 itens — com as porções de referência, a energia a mais vem de um complemento do modelo, e não de
    // porções maiores —; com meta alta, de mais de 900 kcal por refeição, 10)
    if (ref.itens.length > (r.kcal / c.refeicoes.length > 900 ? 10 : ref.tipo === 'principal' ? 9 : 8)) F.add('refeição com itens demais', `${rot}: ${ref.nome} = ${ref.itens.length}`);
    const vistos = new Set();
    let kr = 0;
    for (const it of ref.itens) {
      const f = FOOD.get(it.id);
      if (!f) { F.add('alimento inexistente', `${rot}: ${it.id}`); continue; }
      if (vistos.has(it.id)) F.add('alimento repetido na mesma refeição', `${rot}: ${ref.nome} / ${it.id}`);
      vistos.add(it.id);
      noDia.set(it.id, (noDia.get(it.id) || 0) + 1);
      // restrições: 100%
      if (rest.includes('vegano') && !f.tags.includes('vegano')) F.add('alimento de origem animal em cardápio vegano', `${rot}: ${it.id}`);
      if (rest.includes('vegetariano') && !f.tags.includes('vegetariano')) F.add('carne ou peixe em cardápio vegetariano', `${rot}: ${it.id}`);
      if ((rest.includes('vegano') || rest.includes('vegetariano')) && ['carnes', 'peixes'].includes(f.cat)) F.add('carne ou peixe para quem não come', `${rot}: ${it.id}`);
      if (rest.includes('vegano') && f.cat === 'ovos_laticinios') F.add('ovo ou laticínio em cardápio vegano', `${rot}: ${it.id}`);
      if (rest.includes('sem_lactose') && !f.tags.includes('sem_lactose')) F.add('lactose em cardápio sem lactose', `${rot}: ${it.id}`);
      if (rest.includes('sem_gluten') && !f.tags.includes('sem_gluten')) F.add('glúten em cardápio sem glúten', `${rot}: ${it.id}`);
      if (f.nova === 4 && !['leite-de-soja', 'proteina-de-soja-texturizada', 'proteina-de-soja-preparada', 'pao-de-forma-integral'].includes(f.id)) F.add('ultraprocessado no cardápio', `${rot}: ${it.id}`);
      // porções realistas
      const max = f.papel === 'gordura' && f.cat !== 'frutas' ? 60 : f.papel === 'proteina' ? 300 : f.cat === 'bebidas' || /leite|iogurte/.test(f.id) ? 400 : 350;
      if (!(Number.isFinite(it.g) && it.g > 0)) F.add('quantidade inválida', `${rot}: ${it.id} = ${it.g}`);
      else {
        if (it.g > max) F.add('porção grande demais', `${rot}: ${it.id} = ${it.g} g`);
        // (a porção caseira é a da tabela de alimentos ou a medida do IBGE que o cardápio usa — MEDIDAS: uma concha de
        // lentilha tem 160 g; uma fatia de tofu, 20 g)
        const med = MEDIDAS[it.id] ? MEDIDAS[it.id][0] : f.porcao.g;
        if (it.g > Math.max(f.porcao.g, med) * 3.01) F.add('mais de 3 porções do mesmo alimento na refeição', `${rot}: ${it.id} = ${it.g} g (porção ${f.porcao.g} g)`);
        if (it.g < Math.min(f.porcao.g, med) * 0.3) F.add('porção minúscula (menos de 1/3 da porção caseira)', `${rot}: ${it.id} = ${it.g} g (porção ${f.porcao.g} g)`);
        if (it.g !== Math.round(it.g)) F.add('gramas quebradas', `${rot}: ${it.id} = ${it.g}`);
      }
      // medida caseira legível: "150 g (3 colheres de sopa cheias)"
      if (!semLixo(it.medida) || !it.medida.startsWith(`${it.g} g`)) F.add('medida caseira mal formada', `${rot}: ${it.id} = ${it.medida}`);
      const m = /\((\d+(?:,\d+)?) /.exec(it.medida || '');
      if (m) {
        const q = Number(m[1].replace(',', '.'));
        if (q < 0.5 || Math.round(q * 2) !== q * 2) F.add('medida caseira com fração estranha', `${rot}: ${it.medida}`);
        if (q > (f.cat === 'gorduras' ? 20 : 10)) F.add('medida caseira exagerada (mais de 10 unidades; castanhas, mais de 20)', `${rot}: ${it.medida}`);
        if (q > 1 && / (unidade|fatia|colher|pegador|concha|filé|bife|copo|pote|pedaço|gomo) /.test(it.medida + ' ')) F.add('medida no singular com quantidade maior que 1', `${rot}: ${it.medida}`);
        if (q <= 1 && / (unidades|fatias|colheres|pegadores|conchas|filés|bifes|copos|potes|pedaços|cheias|cheios|médias|médios|grossas|pequenas|pequenos|grandes)[ )]/.test(it.medida)) F.add('medida no plural com quantidade até 1', `${rot}: ${it.medida}`);
        if (q > 1 && / (cheia|cheio|média|médio|grossa|pequena|pequeno|grande)[ )]/.test(it.medida)) F.add('adjetivo no singular com quantidade maior que 1', `${rot}: ${it.medida}`);
      }
      for (const campo of ['kcal', 'p', 'c', 'gd', 'fibra']) if (!(Number.isFinite(it[campo]) && it[campo] >= 0)) F.add('nutriente inválido no item', `${rot}: ${it.id}.${campo}`);
      if (Math.abs(it.kcal - (f.kcal * it.g) / 100) > 0.01) F.add('calorias do item não conferem com a tabela', `${rot}: ${it.id}`);
      kr += it.kcal;
    }
    if (Math.abs(kr - ref.kcal) > 0.5) F.add('total da refeição não confere', `${rot}: ${ref.nome}`);
    if (ref.kcal > r.kcal * 0.55) F.add('uma refeição com mais de 55% das calorias do dia', `${rot}: ${ref.nome} = ${Math.round(ref.kcal)}`);
    if (ref.kcal < 60) F.add('refeição com menos de 60 kcal', `${rot}: ${ref.nome} = ${Math.round(ref.kcal)}`);
    k += ref.kcal; p += ref.p;
  }
  if (Math.abs(k - c.kcal) > 0.5 || Math.abs(p - c.p) > 0.5) F.add('total do dia não confere', rot);
  // repetição: um alimento aparece no máximo 2 vezes no dia, e poucos alimentos se repetem
  for (const [id, n] of noDia) if (n > 2) F.add('alimento 3 ou mais vezes no mesmo dia', `${rot}: ${id} × ${n}`);
  // (o azeite do almoço e do jantar é tempero: não conta como repetição)
  const repetidos = [...noDia].filter((x) => x[1] > 1 && x[0] !== 'azeite-de-oliva' && x[0] !== 'oleo-de-soja').map((x) => x[0]);
  // "mais baratos": nenhum alimento caro, em nenhuma restrição (no vegano, soja e proteína de soja no lugar do tofu)
  if (a.preco === 'barato') for (const id of noDia.keys()) if (FOOD.get(id).preco.faixa === 3) F.add('alimento caro com "mais baratos"', `${rot}: ${id}`);
  // quem não come carne tem poucas fontes de proteína na tabela: soja, tofu e leguminosas podem aparecer duas vezes
  // (em metas extremas de calorias, os acompanhamentos se repetem por necessidade: aí vale só o limite de 2 vezes por alimento)
  // (acima de 3.600 kcal também: frutas e acompanhamentos entram duas vezes para fechar a energia)
  // (vale o mesmo quando a meta passa de 900 kcal por refeição, a mesma régua que o montador usa para "meta alta")
  // (com 6 refeições, uma repetição a mais: três lanches pequenos, nas porções de referência, voltam a pão, fruta e leite)
  // (com "mais baratos" e mais de 3.000 kcal, uma a mais: o óleo de cozinha não entra como alimento, e a energia vem de porções
  // a mais dos poucos alimentos baratos)
  if (metas && r.kcal <= 3600 && !(r.kcal / c.refeicoes.length > 900) && repetidos.length > (rest.includes('vegano') ? 5 : rest.includes('vegetariano') ? 4 : 3) + (c.refeicoes.length >= 6 ? 1 : 0) + (a.preco === 'barato' && r.kcal > 3000 ? 1 : 0)) F.add('muitos alimentos repetidos no dia', `${rot}: ${repetidos}`);
  if (noDia.size < 8) F.add('pouca variedade (menos de 8 alimentos no dia)', `${rot}: ${noDia.size}`);
  if (![...noDia.keys()].some((id) => FOOD.get(id).papel === 'fruta')) F.add('dia sem fruta', rot);
  if ([...noDia.keys()].filter((id) => FOOD.get(id).papel === 'vegetal').length < 2) F.add('dia com menos de 2 verduras/legumes', rot);
  // perto das metas
  if (metas) {
    if (Math.abs(c.kcal - r.kcal) > r.kcal * 0.1) F.add('calorias do cardápio a mais de 10% da meta', `${rot}: ${Math.round(c.kcal)} vs ${r.kcal}`);
    if (c.p < r.prot * pisoP) F.add('proteína do cardápio abaixo de 85% da meta', `${rot}: ${Math.round(c.p)} vs ${r.prot}`);
    // TOLERÂNCIA DECLARADA do dia de exemplo: calorias a até 10% da meta; proteína de 85% a 125% da meta. Quando a meta
    // de proteína é baixa, vale o maior entre 125%, 25 g a mais e 20% das calorias do dia: com a meta no piso de 10% das
    // calorias (quem não treina e gasta muito, ou tem peso de referência baixo), as porções MÍNIMAS de referência da
    // comida comum (IBGE: 1 filé de frango, 2 ovos, 1 concha de feijão, 1 fatia de queijo) já passam disso. Continua longe
    // do teto de 35% (DRI).
    if (c.p > Math.max(r.prot * 1.25, r.prot + 25, (r.kcal * 0.205) / 4)) F.add('proteína do cardápio acima da tolerância (125% da meta, 25 g a mais ou 20% das calorias)', `${rot}: ${Math.round(c.p)} vs ${r.prot}`);
    // (meta extrema de poucas calorias: as porções mínimas de referência, em 5 ou 6 refeições, já somam perto de 1.350 kcal)
  } else if (c.kcal < Math.min(r.kcal * 0.9, 2400) || c.kcal > Math.max(r.kcal * 1.1, 1350)) F.add('cardápio fora de faixa para meta extrema', `${rot}: ${Math.round(c.kcal)} vs ${r.kcal}`);
  if (c.fibra < 15) F.add('cardápio com menos de 15 g de fibras', `${rot}: ${Math.round(c.fibra)}`);
  return c;
}

test('estresse: grade completa de metas — objetivo × sexo × atividade × treinos × idades × corpos extremos × refeições (24.192 perfis)', () => {
  const F = new Falhas();
  const corpos = [[30, 120], [30, 220], [250, 120], [250, 220], [70, 170], [45, 150], [50, 185], [120, 170], [150, 200]];
  const idades = [18, 19, 30, 59, 60, 64, 65, 99];
  let n = 0;
  const modos = {};
  for (const objetivo of OBJ) for (const sexo of SEXO) for (const atividade of ATIV) for (const treinos of TREINOS) for (const idade of idades) for (const [peso, altura] of corpos) {
    const a = { ...base, objetivo, sexo, atividade, treinos, idade, peso, altura, refeicoes: REF[n % 4], horario: HORARIO[n % 5] };
    const r = validarMetas(a, F);
    n++;
    if (r) modos[r.modo] = (modos[r.modo] || 0) + 1;
  }
  TOTAL += n;
  assert.equal(n, 3 * 2 * 4 * 5 * 8 * 9);
  assert.ok(modos.completo > 5000 && modos.manutencao > 1000 && modos.educativo > 100, JSON.stringify(modos));
  F.confere('grade de metas');
});

test('estresse: todas as 16 combinações de restrições × 128 de condições × objetivo × sexo (12.288 perfis)', () => {
  const F = new Falhas();
  let n = 0;
  for (const restricoes of TODAS_REST) for (const condicoes of TODAS_COND) for (const objetivo of OBJ) for (const sexo of SEXO) {
    const a = { ...base, objetivo, sexo, restricoes, condicoes, idade: [25, 45, 70][n % 3], peso: [55, 80, 110][n % 3], altura: [160, 175, 182][n % 3], refeicoes: REF[n % 4] };
    const r = validarMetas(a, F);
    n++;
    if (r && r.modo !== 'educativo' && n % 3 === 0) validarCardapio(a, r, n % 11, F);
  }
  TOTAL += n;
  assert.equal(n, 16 * 128 * 3 * 2);
  F.confere('restrições × condições');
});

test('estresse: 20.000 perfis aleatórios (idade 10–99, peso 30–250, altura 120–220, todas as opções)', () => {
  const F = new Falhas();
  const r = semente(20261111);
  const visto = { objetivo: new Set(), sexo: new Set(), atividade: new Set(), treinos: new Set(), horario: new Set(), refeicoes: new Set(), restricoes: new Set(), condicoes: new Set() };
  let menores = 0, educativos = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const idade = r() < 0.08 ? inteiro(r, 10, 17) : r() < 0.25 ? um(r, [18, 59, 60, 64, 65, 99]) : inteiro(r, 18, 99);
    const a = {
      objetivo: um(r, OBJ), sexo: um(r, SEXO), idade,
      peso: r() < 0.1 ? um(r, [30, 30.5, 249.5, 250]) : Math.round((30 + r() * 220) * 2) / 2,
      altura: r() < 0.1 ? um(r, [120, 121, 219, 220]) : inteiro(r, 120, 220),
      atividade: um(r, ATIV), treinos: um(r, TREINOS), horario: um(r, HORARIO), refeicoes: um(r, REF),
      restricoes: r() < 0.5 ? ['nenhuma'] : um(r, TODAS_REST), condicoes: r() < 0.6 ? ['nenhuma'] : um(r, TODAS_COND),
    };
    for (const k of Object.keys(visto)) for (const v of [].concat(a[k])) visto[k].add(v);
    const res = validarMetas(a, F);
    if (idade < 18) menores++;
    if (res && res.modo === 'educativo') educativos++;
  }
  TOTAL += N;
  for (const k of Object.keys(visto)) assert.equal(visto[k].size, PERGUNTAS.find((q) => q.k === k).op.length, 'opção não sorteada em ' + k);
  assert.ok(menores > 1000 && educativos > 3000);
  F.confere('perfis aleatórios');
});

test('travas de segurança: menores, gestantes, doença renal, transtorno alimentar, diabetes, baixo peso, obesidade e estimativas muito baixas', () => {
  // menores de 18: nunca há número, em nenhuma combinação
  for (let idade = 10; idade <= 17; idade++) for (const objetivo of OBJ) for (const sexo of SEXO) {
    const r = calcular({ ...base, idade, objetivo, sexo, peso: 30 + idade * 3, altura: 130 + idade * 2 });
    TOTAL++;
    assert.equal(r.modo, 'educativo'); assert.equal(r.kcal, undefined); assert.equal(cardapio(r, 3), null);
    assert.ok(emVoltaDoTreino(r).semNumeros, 'menor de 18: a tela não deve mostrar gramas');
  }
  assert.equal(calcular({ ...base, idade: 18 }).modo, 'completo');
  // condições que pedem profissional: o modo educativo vence qualquer outra regra
  for (const c of ['gestante', 'transtorno', 'renal']) for (const outras of TODAS_COND.filter((x) => !x.includes(c))) for (const objetivo of OBJ) {
    const r = calcular({ ...base, objetivo, condicoes: [c, ...outras.filter((x) => x !== 'nenhuma')] });
    TOTAL++;
    assert.equal(r.modo, 'educativo', c + ' + ' + outras);
    assert.equal(r.kcal, undefined);
    assert.ok(emVoltaDoTreino(r).semNumeros);
  }
  assert.equal(emVoltaDoTreino(calcular(base)).semNumeros, false);
  // diabetes: só manutenção, com aviso de hipoglicemia
  for (const objetivo of OBJ) { const r = calcular({ ...base, objetivo, condicoes: ['diabetes'] }); assert.equal(r.kcal, r.gasto); assert.ok(r.avisos.some((x) => /hipoglicemia/.test(x.texto))); assert.equal(r.ritmo, undefined); }
  // baixo peso: nunca déficit (IMC < 18,5; 60+: IMC < 22). Perto do piso (perder 5% já cruzaria): também não.
  // Com 65 anos ou mais, só com obesidade — e com déficit de no máximo 500 kcal.
  for (const [idade, peso, altura, baixo, esperado] of [[30, 56, 175, true, 'manter'], [30, 57, 175, false, 'manter'], [30, 60, 175, false, 'emagrecer'], [59, 60, 172, false, 'emagrecer'],
    [60, 60, 172, true, 'manter'], [60, 66, 172, false, 'manter'], [60, 70, 172, false, 'emagrecer'], [64, 85, 172, false, 'emagrecer'], [65, 85, 172, false, 'manter'], [66, 95, 172, false, 'emagrecer'], [99, 40, 150, true, 'manter']]) {
    const r = calcular({ ...base, idade, peso, altura, objetivo: 'emagrecer', atividade: 'moderado' });
    assert.equal(r.baixoPeso, baixo, `${idade}/${peso}/${altura}`);
    if (r.modo === 'educativo') continue;
    assert.equal(r.objetivoCalc, esperado, `${idade}/${peso}/${altura}`);
    if (esperado === 'manter') { assert.equal(r.kcal, r.gasto); assert.equal(r.perdaSemana, undefined); assert.ok(r.avisos.some((x) => x.tipo === 'warn')); }
    if (idade >= 65 && esperado === 'emagrecer') { assert.ok(r.gasto - r.kcal <= 510); assert.ok(r.avisos.some((x) => /65 anos/.test(x.texto))); }
  }
  // o caso da auditoria: mulher de 25 anos, 51 kg e 1,65 m (IMC 18,7) pedindo para emagrecer não recebe déficit
  { const r = calcular({ ...base, objetivo: 'emagrecer', sexo: 'f', idade: 25, peso: 51, altura: 165, atividade: 'leve' });
    assert.equal(r.kcal, r.gasto); assert.ok(r.avisos.some((x) => /mínimo saudável para a sua altura \(51 kg\)/.test(x.texto))); assert.equal(textosDoPeso(r).ritmo, null); }
  // e a de 75 anos, 55 kg e 1,50 m: sem déficit, sem "ritmo de perda" e sem "reduza de 100 a 200 kcal"
  { const r = calcular({ ...base, objetivo: 'emagrecer', sexo: 'f', idade: 75, peso: 55, altura: 150, treinos: '0' });
    const t = textosDoPeso(r);
    assert.equal(r.kcal, r.gasto); assert.equal(t.ritmo, null); assert.ok(!/reduza|perda/.test(t.linhas.join(' '))); }
  // obesidade: quem pede para "ganhar massa" recebe manutenção com proteína alta (Slater 2019), não superávit
  for (const [peso, altura] of [[92, 175], [120, 170], [250, 220], [160, 150]]) {
    const r = calcular({ ...base, objetivo: 'ganhar', peso, altura });
    assert.ok(r.imc >= 30); assert.equal(r.objetivoCalc, 'manter'); assert.equal(r.kcal, r.gasto);
    assert.ok(r.avisos.some((x) => /acima do gasto/.test(x.texto)));
    assert.ok(r.prot / (25 * (altura / 100) ** 2) >= 1.5, 'proteína alta por kg de peso de referência');
  }
  assert.equal(calcular({ ...base, objetivo: 'ganhar', peso: 90, altura: 175 }).objetivoCalc, 'ganhar'); // IMC 29,4
  assert.ok(calcular({ ...base, peso: 130, altura: 170 }).avisos.some((x) => /IMC de 40/.test(x.texto)));
  // estimativa de gasto abaixo de 1000 kcal: a fórmula não vale; sem números
  const mini = calcular({ ...base, objetivo: 'manter', sexo: 'f', idade: 99, peso: 30, altura: 120, treinos: '0' });
  assert.equal(mini.modo, 'educativo'); assert.equal(mini.kcal, undefined);
  assert.ok(mini.avisos.some((x) => /não é confiável/.test(x.texto)));
  // pisos: 1200 (mulheres) e 1500 (homens) quando a meta de déficit cairia abaixo
  // (perfis leves e sedentários: com o nível de atividade da FAO, de 1,45, o gasto fica em 1.390 e 1.760 kcal)
  const f = calcular({ ...base, sexo: 'f', idade: 55, peso: 45, altura: 150, treinos: '0' });
  assert.equal(f.objetivoCalc, 'emagrecer'); assert.equal(f.kcal, 1200); assert.ok(f.gasto > 1200 && f.avisos.some((x) => /1200 kcal/.test(x.texto)));
  const m = calcular({ ...base, sexo: 'm', idade: 59, peso: 50, altura: 160, treinos: '0' });
  assert.equal(m.objetivoCalc, 'emagrecer'); assert.equal(m.kcal, 1500); assert.ok(m.gasto > 1500);
  // meta presa no piso: a perda mostrada é a do déficit que sobrou, e o texto não manda reduzir mais
  assert.ok(Math.abs(m.perdaSemana - ((m.gasto - 1500) * 7) / 7700) < 0.006);
  assert.ok(/já está no mínimo de 1\.500 kcal/.test(textosDoPeso(m).linhas.join(' ')) && !/reduza/.test(textosDoPeso(m).linhas.join(' ')));
  // o mesmo homem aos 70 anos (IMC 22,8): depois dos 65, sem obesidade, não há déficit
  const m70 = calcular({ ...base, sexo: 'm', idade: 70, peso: 62, altura: 165, treinos: '0' });
  // nível de atividade: os valores do relatório FAO/OMS/UNU para cada resposta, somados ao treino, sem passar de 2,40
  assert.deepEqual(['sedentario', 'leve', 'moderado', 'intenso'].map((atividade) => calcular({ ...base, atividade, treinos: '0', objetivo: 'manter' }).fator), [1.45, 1.6, 1.75, 1.9]);
  assert.deepEqual(['0', '2', '3', '4', '6'].map((treinos) => calcular({ ...base, atividade: 'sedentario', treinos, objetivo: 'manter' }).fator), [1.45, 1.49, 1.54, 1.58, 1.64]);
  assert.equal(calcular({ ...base, atividade: 'intenso', treinos: '6', objetivo: 'manter' }).fator, 2.09);
  assert.equal(calcular({ ...base, atividade: 'lixo', treinos: 'lixo', objetivo: 'manter' }).fator, 1.45, 'resposta inválida vale o menor nível');
  assert.equal(m70.objetivoCalc, 'manter'); assert.equal(m70.kcal, m70.gasto); assert.ok(m70.avisos.some((x) => x.tipo === 'warn' && /mínimo saudável|Depois dos 65 anos, sem obesidade/.test(x.texto)));
  // água e fibras nos extremos
  // a água é a ingestão adequada da EFSA, igual para qualquer peso: 2,5 L (homens) e 2,0 L (mulheres); em bebidas, 2,0 e 1,6 L
  for (const [peso, altura] of [[250, 220], [30, 150], [80, 180]]) {
    assert.equal(calcular({ ...base, peso, altura, objetivo: 'manter' }).agua, 2.5); assert.equal(calcular({ ...base, peso, altura, objetivo: 'manter' }).aguaBebidas, 2.0);
    assert.equal(calcular({ ...base, sexo: 'f', peso, altura, objetivo: 'manter' }).agua, 2.0); assert.equal(calcular({ ...base, sexo: 'f', peso, altura, objetivo: 'manter' }).aguaBebidas, 1.6);
  }
  // sem degrau no IMC 30: 1 kg a mais não muda a meta de proteína nem a de água (antes caía 25 g)
  // ("ganhar" fica de fora: no IMC 30 ele vira manutenção de propósito)
  for (const objetivo of ['emagrecer', 'manter']) { const x = calcular({ ...base, objetivo, peso: 86, altura: 170 }), y = calcular({ ...base, objetivo, peso: 87, altura: 170 }); assert.ok(Math.abs(x.prot - y.prot) <= 5, `degrau na proteína (${objetivo}): ${x.prot} → ${y.prot}`); assert.equal(x.agua, y.agua); }
  assert.ok(calcular({ ...base, objetivo: 'manter', peso: 249, altura: 220, atividade: 'intenso', treinos: '6' }).fibra <= 50);
});

test('robustez: respostas fora da faixa, vazias ou de tipo errado não geram NaN nem erro', () => {
  const estranhas = [{}, null, undefined, { ...base, peso: NaN }, { ...base, peso: '80' }, { ...base, altura: 0 }, { ...base, idade: -5 }, { ...base, idade: 1e9 }, { ...base, peso: Infinity }, { ...base, sexo: 'x' }, { ...base, objetivo: 'voar' },
    { ...base, atividade: 'lua' }, { ...base, treinos: 99 }, { ...base, refeicoes: '12' }, { ...base, refeicoes: 0 }, { ...base, restricoes: 'vegano' }, { ...base, condicoes: [null, 1, {}] }, { ...base, horario: 'madrugada' }, { ...base, restricoes: ['xyz', 'vegano'] }];
  for (const a of estranhas) {
    let r;
    assert.doesNotThrow(() => { r = calcular(a); }, JSON.stringify(a));
    TOTAL++;
    for (const k of ['imc', 'tmb', 'gasto']) assert.ok(Number.isFinite(r[k]) && r[k] > 0, `${k} em ${JSON.stringify(a)}`);
    assert.ok(r.modo === 'educativo' ? r.agua === null : r.agua > 0, `agua em ${JSON.stringify(a)}`);
    if (r.modo !== 'educativo') for (const k of ['kcal', 'prot', 'carb', 'gord']) assert.ok(Number.isFinite(r[k]) && r[k] > 0, `${k} em ${JSON.stringify(a)}`);
    for (const seed of [0, -1, 2.7, 1e12, NaN, undefined, null, '3', Infinity]) {
      let c;
      assert.doesNotThrow(() => { c = cardapio(r, seed); }, `seed ${seed}`);
      if (c) { assert.ok(Number.isFinite(c.kcal) && c.kcal > 0); assert.ok(c.refeicoes.length >= 3 && c.refeicoes.length <= 6); }
    }
    let t;
    assert.doesNotThrow(() => { t = emVoltaDoTreino(r, true); });
    for (const s of [...t.pre, ...t.pos, t.horario, t.agua]) assert.ok(semLixo(s), s);
  }
  assert.equal(cardapio(null, 0), null);
  assert.doesNotThrow(() => emVoltaDoTreino({ peso: 70, restricoes: [], aguaPre: [350, 700] }));
});

test('cardápio: 100% das restrições, perto das metas, porções realistas e sem repetição estranha (16 restrições × objetivos × refeições × corpos × 12 sementes)', () => {
  const F = new Falhas();
  const corpos = [['f', 52, 158, 28], ['f', 68, 165, 45], ['m', 70, 172, 22], ['m', 85, 180, 35], ['m', 105, 188, 50], ['f', 80, 160, 67]];
  const sementes = [0, 1, 2, 3, 4, 5, 6, 7, 13, 99, 500, 999];
  let n = 0;
  for (const preco of PRECO) for (const restricoes of TODAS_REST) for (const objetivo of OBJ) for (const refeicoes of REF) for (const [sexo, peso, altura, idade] of corpos) {
    const a = { ...base, preco, restricoes, objetivo, refeicoes, sexo, peso, altura, idade, atividade: ATIV[n % 4], treinos: TREINOS[n % 5] };
    const r = calcular(a);
    TOTAL++;
    n++;
    if (r.modo === 'educativo') continue;
    // todas as metas da grade são conferidas, inclusive as altas com 3 refeições (cada refeição aceita mais itens)
    for (const seed of sementes) validarCardapio(a, r, seed, F, { metas: true });
    // "outra sugestão" muda o cardápio de verdade
    const dias = sementes.slice(0, 6).map((s) => cardapio(r, s).refeicoes.map((x) => x.itens.map((i) => i.id).join(',')).join('|'));
    for (let i = 1; i < dias.length; i++) if (dias[i] === dias[i - 1]) F.add('"outra sugestão" devolveu o mesmo cardápio', `${rotulo(a)} seeds ${sementes[i - 1]} e ${sementes[i]}`);
    if (new Set(dias).size < 4) F.add('pouca variação entre sugestões', `${rotulo(a)}: ${new Set(dias).size} de 6`);
  }
  assert.equal(n, 2 * 16 * 3 * 4 * 6);
  F.confere('cardápio');
});

test('preço: com "mais baratos" o custo médio do cardápio cai em todas as combinações de restrição × objetivo', () => {
  const corpos = [['f', 52, 158, 28], ['f', 68, 165, 45], ['m', 70, 172, 22], ['m', 85, 180, 35], ['m', 105, 188, 50], ['f', 80, 160, 67]];
  let n = 0;
  for (const restricoes of TODAS_REST) for (const objetivo of OBJ) {
    let normal = 0, barato = 0, k = 0;
    for (const refeicoes of REF) for (const [sexo, peso, altura, idade] of corpos) {
      const a = { ...base, restricoes, objetivo, refeicoes, sexo, peso, altura, idade };
      const rn = calcular({ ...a, preco: 'tanto_faz' }), rb = calcular({ ...a, preco: 'barato' });
      TOTAL += 2;
      // a preferência não mexe nas metas
      for (const campo of ['kcal', 'prot', 'carb', 'gord', 'agua']) assert.equal(rb[campo], rn[campo], campo);
      assert.equal(calcular(a).preco, 'tanto_faz', 'sem resposta vale "tanto faz"');
      if (rn.modo === 'educativo') continue;
      for (let seed = 0; seed < 8; seed++) { normal += custoDia(cardapio(rn, seed)); barato += custoDia(cardapio(rb, seed)); k++; CARDAPIOS += 2; }
    }
    n++;
    assert.ok(k > 0 && barato <= normal, `"mais baratos" saiu mais caro em ${restricoes}/${objetivo}: ${(barato / k).toFixed(2)} vs ${(normal / k).toFixed(2)}`);
    // quem come de tudo economiza pelo menos 18% (o óleo de soja, a energia mais barata, não entra mais como alimento); no
    // vegano, com poucas fontes de proteína, a diferença é menor
    if (!restricoes.includes('vegano')) assert.ok(barato <= normal * 0.82, `economia pequena em ${restricoes}/${objetivo}: ${Math.round((barato / normal) * 100)}%`);
  }
  assert.equal(n, 16 * 3);
});

test('"outra sugestão": cada clique muda os alimentos e mantém as metas, em todas as restrições × objetivos × preferências', () => {
  const F = new Falhas();
  let cliques = 0;
  for (const preco of PRECO) for (const restricoes of TODAS_REST) for (const objetivo of OBJ) for (const refeicoes of REF) for (const [sexo, peso, altura] of [['f', 60, 165], ['m', 85, 180]]) {
    const a = { ...base, preco, restricoes, objetivo, refeicoes, sexo, peso, altura };
    const r = calcular(a);
    TOTAL++;
    if (r.modo === 'educativo') continue;
    let seed = 0;
    const vistos = new Set([assinatura(cardapio(r, seed))]);
    for (let clique = 1; clique <= 8; clique++) {
      const prox = proximaSemente(r, seed);
      if (prox == null) { F.add('"outra sugestão" sem alternativa', rotulo(a)); break; }
      const antes = cardapio(r, seed), depois = cardapio(r, prox);
      cliques++; CARDAPIOS++;
      if (assinatura(antes) === assinatura(depois)) F.add('clique devolveu os mesmos alimentos', `${rotulo(a)} ${seed}→${prox}`);
      // muda de verdade: pelo menos 3 alimentos diferentes de um dia para o outro
      const ids = (c) => new Set(c.refeicoes.flatMap((x) => x.itens.map((i) => i.id)));
      const novos = [...ids(depois)].filter((id) => !ids(antes).has(id)).length;
      if (novos < 3) F.add('clique trocou menos de 3 alimentos', `${rotulo(a)} ${seed}→${prox}: ${novos}`);
      // as metas não mudam: o dia continua perto das mesmas calorias e proteína
      // (dieta sem carne com proteína acima de 27% das calorias: as porções de referência deixam a energia até 15% acima)
      const extremo = semCarneDe(a) && (r.prot * 4) / r.kcal > 0.27;
      if (Math.abs(depois.kcal - r.kcal) > r.kcal * (extremo ? 0.15 : 0.1) || depois.p < r.prot * pisoDaProteina(a, r)) F.add('clique tirou o dia das metas', `${rotulo(a)} seed ${prox}: ${Math.round(depois.kcal)} kcal, ${Math.round(depois.p)} g`);
      vistos.add(assinatura(depois));
      seed = prox;
    }
    if (vistos.size < 7) F.add('poucos dias diferentes em 8 cliques', `${rotulo(a)}: ${vistos.size}`);
  }
  assert.ok(cliques > 5000, 'cliques: ' + cliques);
  // a semente dá a volta em 1000 sem repetir o dia atual
  const r = calcular(base);
  assert.notEqual(assinatura(cardapio(r, proximaSemente(r, 999))), assinatura(cardapio(r, 999)));
  assert.equal(proximaSemente(calcular({ ...base, idade: 15 }), 0), null, 'sem cardápio, não há outra sugestão');
  F.confere('outra sugestão');
});

test('cardápio: 4.000 perfis aleatórios com sementes de 0 a 999 (metas de 1.200 a 4.000 kcal conferidas, com qualquer número de refeições; extremos só validados)', () => {
  const F = new Falhas();
  const r = semente(42);
  let n = 0, comMeta = 0;
  while (n < 4000) {
    const a = {
      objetivo: um(r, OBJ), sexo: um(r, SEXO), idade: inteiro(r, 18, 99), peso: Math.round((35 + r() * 215) * 2) / 2, altura: inteiro(r, 130, 220),
      atividade: um(r, ATIV), treinos: um(r, TREINOS), horario: um(r, HORARIO), refeicoes: um(r, REF), restricoes: um(r, TODAS_REST), condicoes: r() < 0.8 ? ['nenhuma'] : [um(r, ['diabetes', 'hipertensao', 'outra'])],
    };
    const res = calcular(a);
    TOTAL++;
    if (res.modo === 'educativo') continue;
    n++;
    // (acima de 4.000 kcal, as porções de referência não fecham a meta em qualquer número de refeições: extremo)
    const normal = res.kcal >= 1200 && res.kcal <= 4000 && res.prot <= 200;
    if (normal) comMeta++;
    validarCardapio(a, res, inteiro(r, 0, 999), F, { metas: normal });
  }
  assert.ok(comMeta > 2000, 'poucos perfis na faixa normal: ' + comMeta);
  F.confere('cardápio aleatório');
});

test('em volta do treino: exemplos coerentes com cada restrição, horário e condição', () => {
  const F = new Falhas();
  for (const restricoes of TODAS_REST) for (const horario of HORARIO) for (const condicoes of [['nenhuma'], ['diabetes'], ['hipertensao'], ['renal'], ['diabetes', 'hipertensao']]) for (const forte of [false, true]) for (const peso of [30, 60, 95, 250]) {
    const a = { ...base, restricoes, horario, condicoes, peso, altura: 170 };
    const res = calcular(a);
    TOTAL++;
    const t = emVoltaDoTreino(res, forte);
    const rot = `${restricoes}/${horario}/${condicoes}/${peso}kg`;
    const rest = restricoes.filter((x) => x !== 'nenhuma');
    if (!(t.carbPre >= 30 && t.carbPre <= 90 && t.carbPre % 5 === 0)) F.add('carboidrato pré-treino fora de 30–90 g', `${rot}: ${t.carbPre}`);
    if (!(t.protPos >= 20 && t.protPos <= 40 && t.protPos % 5 === 0)) F.add('proteína pós-treino fora de 20–40 g', `${rot}: ${t.protPos}`);
    if (emVoltaDoTreino(res, true).carbPre < emVoltaDoTreino(res, false).carbPre) F.add('treino forte com menos carboidrato', rot);
    if (t.pre.length < 3 || t.pos.length < 2) F.add('poucos exemplos', rot);
    if (t.semNumeros !== (res.modo === 'educativo')) F.add('semNumeros incoerente com o modo', rot);
    const textos = [...t.pre, ...t.pos];
    for (const s of [...textos, t.horario, t.agua]) if (!semLixo(s) || s.length > 220) F.add('texto inválido ou longo', `${rot}: ${s}`);
    for (const s of textos) {
      const semSoja = s.replace(/bebida de soja|leite de soja/gi, '');
      if (rest.includes('vegano') && /iogurte|ovo|frango|queijo|leite|atum|carne|peixe|mel\b/i.test(semSoja)) F.add('exemplo não vegano', `${rot}: ${s}`);
      if (rest.includes('vegetariano') && /frango|atum|carne|peixe|presunto|peru/i.test(s)) F.add('exemplo com carne para vegetariano', `${rot}: ${s}`);
      if (rest.includes('sem_gluten') && /pão|aveia|sanduíche|macarrão|torrada|biscoito/i.test(s)) F.add('exemplo com glúten', `${rot}: ${s}`);
      if (rest.includes('sem_lactose') && /iogurte|queijo|leite|requeijão|whey/i.test(semSoja.replace(/(iogurte|leite|queijo)( natural)? sem lactose/gi, ''))) F.add('exemplo com lactose', `${rot}: ${s}`);
    }
    const esperado = { cedo: /acordar/, manha: /manhã/, tarde: /tarde/, noite: /noite/, varia: /Regra geral/ }[horario];
    if (!esperado.test(t.horario)) F.add('dica de horário não corresponde ao horário escolhido', `${rot}: ${t.horario}`);
    if (condicoes.includes('diabetes')) {
      if (!/diabetes/.test(t.horario) || !/jejum/.test(t.horario)) F.add('diabetes sem alerta sobre jejum', `${rot}: ${t.horario}`);
      if (/em jejum só se você se sente bem/.test(t.horario)) F.add('diabetes com sugestão de treino em jejum', `${rot}: ${t.horario}`);
    }
    if (horario === 'noite' && !/cafeína/.test(t.horario)) F.add('treino à noite sem lembrar da cafeína', rot);
    // adultos com meta: a dose de antes do treino; no modo educativo (gestação, doença renal, menores), nenhum número
    if (res.modo === 'educativo' ? /[0-9]/.test(t.agua) || !/^Água: /.test(t.agua) : !/\d+ a \d+ mL/.test(t.agua)) F.add('texto da água mal formado', `${rot}: ${t.agua}`);
    if (condicoes.includes('renal') && !/médico/.test(t.agua)) F.add('doença renal sem remeter os líquidos ao médico', `${rot}: ${t.agua}`);
  }
  // faixas de IMC
  for (let imc = 10; imc <= 80; imc += 0.5) for (const idade of [18, 59, 60, 99]) assert.ok(semLixo(imcFaixa(imc, idade)));
  F.confere('em volta do treino');
});

test('alergia alimentar: as 64 combinações × restrições × objetivos × refeições — nenhum alimento com o alergênico no cardápio, nas trocas, em casa, nas sugestões nem nos exemplos', () => {
  const F = new Falhas();
  const ALG = op('alergias').filter((x) => x !== 'nenhuma');
  const TODAS_ALG = subconjuntos(ALG);
  // palavras dos exemplos de "em volta do treino" que indicam cada alergênico
  const PALAVRA = { amendoim: /amendoim/i, castanhas: /castanha|nozes|amêndoa/i, peixe: /atum|peixe|sardinha|camarão/i, ovo: /ovo/i, leite: /iogurte|queijo|leite(?! de soja)|whey/i, soja: /soja|tofu/i };
  const todos = ALIMENTOS.map((f) => f.id);
  const r = semente(4321);
  let n = 0, itens = 0;
  for (const alergias of TODAS_ALG) for (const restricoes of [['nenhuma'], ['vegetariano'], ['vegano'], ['sem_lactose'], ['sem_gluten', 'vegano']]) for (const objetivo of OBJ) for (const refeicoes of ['3', '5']) {
    const a = { ...base, objetivo, refeicoes, restricoes, alergias: alergias.length ? alergias : ['nenhuma'], preco: n % 2 ? 'barato' : 'tanto_faz' };
    const res = calcular(a);
    const rot = JSON.stringify({ alergias, restricoes, objetivo, refeicoes });
    n++; TOTAL++;
    if (JSON.stringify(res.alergias) !== JSON.stringify(alergias)) F.add('alergias não chegaram ao resultado', rot);
    if (alergias.length && !res.avisos.some((x) => x.alergia && /rótulo/.test(x.texto) && /CONTÉM/.test(x.texto))) F.add('alergia sem o aviso de ler o rótulo', rot);
    if (!alergias.length && res.avisos.some((x) => x.alergia)) F.add('aviso de alergia sem alergia', rot);
    if (alergias.includes('leite') && res.avisos.some((x) => /versões sem lactose/.test(x.texto))) F.add('alergia ao leite com dica de produto sem lactose', rot);
    const ferem = (id) => alergias.filter((al) => alergenosDe(id).includes(al));
    const confere = (dia, onde) => { if (!dia) return; for (const ref of dia.refeicoes) for (const it of ref.itens) { itens++; const f = ferem(it.id); if (f.length) F.add(`alergênico no ${onde}`, `${rot}: ${it.id} (${f})`); } };
    if (res.modo === 'educativo') continue;
    const seed = inteiro(r, 0, 999);
    const c = cardapio(res, seed);
    confere(c, 'cardápio');
    if (c && c.refeicoes.length && !c.refeicoes.every((ref) => ref.itens.length)) F.add('refeição vazia com alergia', rot);
    // trocar uma refeição e "outra sugestão"
    confere(cardapio(res, seed, { trocas: [2, 0, 1, 0, 0, 0].slice(0, Number(refeicoes)) }), 'cardápio trocado');
    const prox = proximaSemente(res, seed);
    if (prox != null) confere(cardapio(res, prox), 'outra sugestão');
    // em casa, com a despensa sorteada (inclui alimentos com o alergênico): nada deles entra, nem nas sugestões de compra
    const emCasa = [...new Set(Array.from({ length: inteiro(r, 5, 80) }, () => um(r, todos)))];
    const cc = cardapio(res, seed, { emCasa });
    confere(cc, 'cardápio de casa');
    for (const f of cc.faltas) for (const s of f.sugestoes) if (ferem(s.id).length) F.add('sugestão de compra com alergênico', `${rot}: ${s.id}`);
    // exemplos de antes e depois do treino
    const t = emVoltaDoTreino(res, n % 2 === 0);
    for (const s of [...t.pre, ...t.pos]) for (const al of alergias) if (PALAVRA[al].test(al === 'soja' ? s : s.replace(/bebida de soja|leite de soja/gi, ''))) F.add('exemplo com alergênico', `${rot}: ${al} em “${s}”`);
    // suplementos: whey é leite
    if (alergias.includes('leite') && suplementos(res).linhas.some((l) => /Whey protein: só uma forma prática/.test(l))) F.add('whey para alergia ao leite', rot);
  }
  assert.equal(n, 64 * 5 * 3 * 2);
  assert.ok(itens > 10000, 'poucos alimentos conferidos: ' + itens);
  F.confere('alergia alimentar');
});

test('alergia alimentar: a tabela de alergênicos cobre os alimentos e os pratos prontos', () => {
  // exemplos conferidos à mão (composição usual) e os pratos prontos que herdam dos ingredientes (RECEITAS)
  const tem = (id, al) => alergenosDe(id).includes(al);
  for (const [id, al] of [['pasta-de-amendoim', 'amendoim'], ['pacoca', 'amendoim'], ['castanha-de-caju', 'castanhas'], ['nozes', 'castanhas'], ['camarao-cozido', 'peixe'], ['atum-em-conserva', 'peixe'], ['ovo-cozido', 'ovo'], ['maionese', 'ovo'], ['iogurte-natural', 'leite'], ['whey-protein', 'leite'], ['manteiga-com-sal', 'leite'], ['tofu', 'soja'], ['leite-de-soja', 'soja'],
    ['feijao-tropeiro', 'ovo'], ['baiao-de-dois', 'leite'], ['estrogonofe-de-frango', 'leite'], ['estrogonofe-de-carne', 'leite'], ['omelete-de-queijo', 'ovo'], ['omelete-de-queijo', 'leite'], ['canjica-com-leite', 'leite']]) assert.ok(tem(id, al), `${id} deveria ter ${al}`);
  for (const id of ['arroz-branco-cozido', 'feijao-carioca-cozido', 'banana-prata', 'peito-de-frango-grelhado', 'azeite-de-oliva', 'batata-doce-cozida']) assert.deepEqual(alergenosDe(id), [], id);
  // o óleo do preparo não conta: a feijoada não vira "soja"
  assert.ok(!tem('feijoada', 'soja'));
  assert.ok(!temAlergeno('id-que-nao-existe', ['leite']) && !temAlergeno('ovo-cozido', null));
  // vegano não tem leite nem ovo (a etiqueta e a tabela concordam)
  for (const f of ALIMENTOS) if (f.tags.includes('vegano')) assert.ok(!tem(f.id, 'leite') && !tem(f.id, 'ovo'), f.id);
});

test('em casa: 3.000 despensas sorteadas — só o que foi marcado, restrições 100%, sem erro, faltas coerentes', () => {
  const F = new Falhas();
  const r = semente(7);
  const todos = ALIMENTOS.map((f) => f.id);
  let completas = 0, comFalta = 0;
  for (let i = 0; i < 3000; i++) {
    const a = { ...base, objetivo: um(r, OBJ), sexo: um(r, SEXO), peso: inteiro(r, 50, 110), altura: inteiro(r, 150, 190), refeicoes: um(r, REF), restricoes: r() < 0.6 ? ['nenhuma'] : um(r, TODAS_REST), treinos: um(r, TREINOS) };
    const res = calcular(a);
    TOTAL++;
    if (res.modo === 'educativo') continue;
    // despensas de 0 a 120 alimentos, com mais chance para as pequenas
    const n = r() < 0.05 ? 0 : Math.floor(r() * r() * 120) + 1;
    const emCasa = [...new Set(Array.from({ length: n }, () => um(r, todos)))];
    const rot = `${rotulo(a)} casa=[${emCasa.slice(0, 12)}…] (${emCasa.length})`;
    const seed = inteiro(r, 0, 999);
    let c;
    try { c = cardapio(res, seed, { emCasa }); } catch (e) { F.add('cardápio de casa lançou erro', `${rot}: ${e.message}`); continue; }
    CARDAPIOS++;
    const rest = a.restricoes.filter((x) => x !== 'nenhuma');
    const tem = new Set(emCasa);
    if (!Array.isArray(c.faltas)) { F.add('sem a lista de faltas', rot); continue; }
    for (const ref of c.refeicoes) {
      if (!ref.itens.length) F.add('refeição vazia', rot);
      const vistos = new Set();
      for (const it of ref.itens) {
        const f = FOOD.get(it.id);
        if (!tem.has(it.id)) F.add('alimento que a pessoa não tem', `${rot}: ${it.id}`);
        if (vistos.has(it.id)) F.add('alimento repetido na refeição', `${rot}: ${it.id}`);
        vistos.add(it.id);
        for (const t of rest) if (!f.tags.includes(t)) F.add('restrição ignorada em casa', `${rot}: ${it.id} fere ${t}`);
        if (!(Number.isFinite(it.g) && it.g > 0 && it.g === Math.round(it.g))) F.add('quantidade inválida', `${rot}: ${it.id} = ${it.g}`);
        else if (it.g > Math.max(f.porcao.g * 3.01, 60) || it.g > 420) F.add('mais de 3 porções em casa', `${rot}: ${it.id} = ${it.g} g (porção ${f.porcao.g} g)`);
        if (!semLixo(it.medida)) F.add('medida mal formada', `${rot}: ${it.medida}`);
      }
    }
    if (!Number.isFinite(c.kcal) || !Number.isFinite(c.p) || c.kcal > res.kcal * 1.15) F.add('total inválido ou acima de 115% da meta', `${rot}: ${Math.round(c.kcal)} vs ${res.kcal}`);
    for (const f of c.faltas) {
      if (!semLixo(f.texto) || f.texto.length > 140) F.add('texto de falta inválido', f.texto);
      if (!f.sugestoes.length) F.add('falta sem sugestão', `${rot}: ${f.grupo}`);
      for (const s of f.sugestoes) { if (tem.has(s.id)) F.add('sugere o que a pessoa já tem', `${rot}: ${s.id}`); for (const t of rest) if (!FOOD.get(s.id).tags.includes(t)) F.add('sugestão fere a restrição', `${rot}: ${s.id}`); }
    }
    // sem nenhuma falta, o dia fecha as metas
    if (!c.faltas.length) { completas++; if (Math.abs(c.kcal - res.kcal) > res.kcal * 0.12 || c.p < res.prot * 0.85) F.add('sem faltas, mas fora das metas', `${rot}: ${Math.round(c.kcal)} kcal, ${Math.round(c.p)} g (metas ${res.kcal} e ${res.prot})`); } else comFalta++;
    // "outra sugestão" em casa: ou muda os alimentos, ou avisa que não há alternativa
    const prox = proximaSemente(res, seed, { emCasa });
    if (prox != null && assinatura(cardapio(res, prox, { emCasa })) === assinatura(c)) F.add('outra sugestão em casa não mudou', rot);
  }
  assert.ok(completas > 100 && comFalta > 500, `despensas completas: ${completas}; com falta: ${comFalta}`);
  F.confere('em casa');
});

test('corrida: 4.000 perfis com plano de corrida sorteado — metas coerentes, cardápio válido e textos sem lixo', () => {
  const F = new Falhas();
  const r = semente(2026);
  const hoje = new Date('2026-11-13T12:00:00');
  for (let i = 0; i < 4000; i++) {
    const a = { ...base, objetivo: um(r, OBJ), sexo: um(r, SEXO), idade: inteiro(r, 14, 80), peso: inteiro(r, 45, 130), altura: inteiro(r, 150, 195), atividade: um(r, ATIV), treinos: um(r, TREINOS), refeicoes: um(r, REF), restricoes: r() < 0.7 ? ['nenhuma'] : um(r, TODAS_REST), condicoes: r() < 0.7 ? ['nenhuma'] : um(r, TODAS_COND) };
    const km = Math.round(r() * r() * 120);
    const ritmo = 4 + r() * 5;
    const cor = { kmSemana: km, minSemana: Math.round(km * ritmo), sessoesSemana: inteiro(r, 1, 7), longoKm: Math.round(km * 0.35), longoMin: Math.round(km * 0.35 * ritmo), fase: 'base', nivel: 'iniciante',
      prova: r() < 0.6 ? { distKm: um(r, [5, 10, 21.1, 42.195, 3, 60]), data: `2026-${um(r, ['11', '12'])}-${String(inteiro(r, 1, 28)).padStart(2, '0')}`, semanasAte: inteiro(r, 0, 20) } : null,
      proximaCorrida: r() < 0.5 ? { data: '2026-11-14', durMin: inteiro(r, 20, 150), distKm: inteiro(r, 3, 25), tipo: 'longo' } : null };
    const rot = `${rotulo(a)} corrida=${JSON.stringify(cor)}`;
    let sem, com, o;
    try { sem = calcular(a); com = calcular(a, cor); o = orientacaoCorrida(com, hoje); } catch (e) { F.add('corrida lançou erro', `${rot}: ${e.message}`); continue; }
    TOTAL++;
    if (km === 0 && cor.minSemana === 0) continue;
    if (!o) { F.add('plano de corrida sem orientação', rot); continue; }
    if (com.modo !== sem.modo) F.add('a corrida mudou o modo de segurança', rot);
    const textos = [...o.blocos.flatMap((b) => [b.titulo, ...b.linhas]), ...(o.prova ? [o.prova.titulo, ...o.prova.linhas] : [])];
    for (const s of textos) if (!semLixo(s) || s.length > 330) F.add('texto de corrida inválido ou longo', `${rot}: ${s}`);
    if (o.semNumeros !== (com.modo === 'educativo')) F.add('semNumeros incoerente na corrida', rot);
    // achados da auditoria: concordância ("1 semanas"), duração ("1 h 60"), géis fora do total, motivo do carboidrato
    // baixo e, com diabetes, gramas no bloco da prova
    const tudo = textos.join(' ');
    if (/ 1 semanas|\d h 60\b|30 g de carboidrato são 1 gel/.test(tudo)) F.add('texto de corrida com erro de concordância, duração ou gel', `${rot}: ${tudo.slice(0, 200)}`);
    const gel = /No total, de (\d+) a (\d+) g: por exemplo, (?:(\d+) a )?(\d+) g[eé](?:l|is) de 25 g/.exec(tudo);
    if (/No total, de/.test(tudo) && !gel) F.add('linha dos géis mal formada', rot);
    if (gel && (Number(gel[4]) * 25 > Number(gel[2]) || (Number(gel[3] || gel[4]) * 25 < Number(gel[1]) && Number(gel[3] || gel[4]) > 1))) F.add('géis de exemplo fora do total indicado', `${rot}: ${gel[0]}`);
    if (/por causa da redução de calorias/.test(tudo) && com.objetivoCalc !== 'emagrecer') F.add('"redução de calorias" para quem não está em déficit', rot);
    if (a.condicoes.includes('diabetes') && o.prova && /10 a 12 g|\d+ g\)|\d+ a \d+ g de carboidrato|No total, de/.test(o.prova.linhas.join(' '))) F.add('diabetes com gramas no bloco da prova', rot);
    if (a.condicoes.includes('diabetes') && o.prova && o.prova.minutos > 90 && o.prova.dias >= 0 && !/médico ou nutricionista/.test(o.prova.linhas.join(' '))) F.add('diabetes sem orientação de combinar a prova com o médico', rot);
    if (suplementos(com).semDoses !== (com.modo === 'educativo')) F.add('doses de suplemento no modo educativo', rot);
    if (com.modo === 'educativo') { if (com.kcal !== undefined || textos.some((s) => /\d+ (a \d+ )?g\b|kcal/.test(s))) F.add('modo educativo com números na corrida', rot); continue; }
    // energia: nunca menor que sem a corrida, nem acima de 2,4 × o gasto de repouso
    if (com.gasto < sem.gasto) F.add('a corrida reduziu o gasto', `${rot}: ${com.gasto} < ${sem.gasto}`);
    if (com.fator > 2.401) F.add('gasto acima de 2,4 × o repouso', `${rot}: ${com.fator}`);
    const soma = com.prot * 4 + com.carb * 4 + com.gord * 9;
    if (Math.abs(soma - com.kcal) > 25) F.add('macros da corrida não somam as calorias', `${rot}: ${soma} vs ${com.kcal}`);
    const pg = (com.gord * 9) / com.kcal;
    if (pg < 0.19 || pg > 0.37) F.add('gordura fora de 20–35% com corrida', `${rot}: ${Math.round(pg * 100)}%`);
    // (15 g de folga: 10 kcal a mais podem mudar o arredondamento da gordura)
    if (com.carb < sem.carb - 15 && com.kcal >= sem.kcal && com.prot <= sem.prot) F.add('a corrida reduziu o carboidrato', `${rot}: ${com.carb} < ${sem.carb}`);
    if (com.prot * 4 > com.kcal * 0.36 + 10 || com.prot > 2.2 * a.peso + 3) F.add('proteína fora dos limites com corrida', `${rot}: ${com.prot}`);
    if (i % 4 === 0) validarCardapio(a, com, i % 13, F, { metas: com.kcal >= 1200 && com.kcal <= 4600 && com.prot <= 200 });
  }
  F.confere('corrida');
});

test('referências citadas existem e a contagem de perfis passa de 40 mil', () => {
  for (const k of ['weijs2025', 'deutz2014', 'volkert2022', 'rodriguez2009', 'jeukendrup2014', 'hewbutler2017', 'scott2019', 'rapoport2010', 'efsa2017', 'ais_gel', 'ais_bebida', 'dri_canada', 'fao2004', 'precos2026']) assert.ok(REFS[k], k);
  for (const k of ['ruiz2011', 'amaro2019', 'jensen2013', 'helms2014', 'iraki2019', 'slater2019', 'jager2017', 'morton2018', 'schoenfeld2018', 'thomas2016', 'oms_dieta', 'kdigo2024', 'rogerson2017', 'moody2025']) assert.ok(REFS[k], k);
  // fontes que só abriam no resumo saíram: nada na Nutricionista nem no diário cita uma delas
  for (const k of ['mifflin1990', 'frankenfield2005', 'bauer2013', 'leidy2015', 'iom2005', 'dri2005', 'efsa2010', 'burke2011', 'margaria1963', 'hall2008', 'golden2016', 'raj2025']) {
    assert.equal(REFS[k], undefined, 'referência sem texto completo ainda na lista: ' + k);
    for (const x of FAQ_NUTRI) assert.ok(!x.f.includes(k), `"${x.q}" ainda cita ${k}`);
  }
  for (const x of FAQ_NUTRI) assert.ok(!x.f.includes('garthe2011'), 'Garthe 2011 não foi lido inteiro');
  assert.ok(TOTAL >= 40000, 'perfis: ' + TOTAL);
  assert.ok(CARDAPIOS >= 15000, 'cardápios: ' + CARDAPIOS);
  console.log(`   Nutricionista: ${TOTAL} perfis calculados e ${CARDAPIOS} cardápios conferidos`);
});

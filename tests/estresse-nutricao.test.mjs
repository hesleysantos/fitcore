// Teste de estresse da Nutricionista: dezenas de milhares de perfis (grade completa + amostragem com semente fixa).
// Confere as metas (calorias, macros, água, fibras), as travas de segurança, o cardápio de exemplo e os textos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTOS } from '../www/js/data/foods.js';
import { REFS } from '../www/js/data/knowledge.js';
import { PERGUNTAS, calcular, cardapio, emVoltaDoTreino, imcFaixa } from '../www/js/logic/nutrition.js';

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
const TODAS_COND = subconjuntos(COND).map((x) => (x.length ? x : ['nenhuma']));   // 64 combinações
const base = { objetivo: 'emagrecer', sexo: 'm', idade: 30, peso: 80, altura: 178, atividade: 'sedentario', treinos: '3', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };
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
  const pesoRef = imc >= 30 ? 25 * h * h : a.peso;
  // campos sempre presentes
  for (const k of ['imc', 'tmb', 'gasto', 'fator', 'agua', 'peso', 'idade']) if (!(Number.isFinite(r[k]) && r[k] > 0)) F.add(`campo ${k} inválido`, `${rot}: ${r[k]}`);
  if (Math.abs(r.imc - imc) > 1e-9) F.add('IMC errado', rot);
  const tmb = 10 * a.peso + 6.25 * a.altura - 5 * a.idade + (a.sexo === 'm' ? 5 : -161);
  if (Math.abs(r.tmb - tmb) > 5.01) F.add('Mifflin-St Jeor não confere', `${rot}: ${r.tmb} vs ${tmb}`);
  if (r.fator < 1.2 || r.fator > 1.9) F.add('fator de atividade fora de 1,2–1,9', `${rot}: ${r.fator}`);
  // água: 1,5 a 4 L por dia; antes do treino, 150 mL a 1,5 L (5–10 mL/kg)
  if (r.agua < 1.5 || r.agua > 4) F.add('água fora de 1,5–4 L', `${rot}: ${r.agua}`);
  if (!(Array.isArray(r.aguaPre) && r.aguaPre[0] >= 150 && r.aguaPre[0] < r.aguaPre[1] && r.aguaPre[1] <= 1500)) F.add('água pré-treino implausível', `${rot}: ${r.aguaPre}`);
  for (const av of r.avisos) { if (!['danger', 'warn', 'info'].includes(av.tipo)) F.add('tipo de aviso desconhecido', rot); if (!semLixo(av.texto)) F.add('aviso com valor inválido', `${rot}: ${av.texto}`); if (av.texto.length > 330) F.add('aviso longo demais', av.texto); }
  const aviso = (re) => r.avisos.some((x) => re.test(x.texto));
  if (cond.includes('hipertensao') && !aviso(/sal a 5 g/)) F.add('pressão alta sem orientação de sal', rot);
  if (cond.includes('outra') && !aviso(/médico ou nutricionista/)) F.add('doença crônica sem aviso', rot);
  if (rest.includes('vegano') && !aviso(/B12/)) F.add('vegano sem aviso de B12', rot);
  if (rest.includes('sem_gluten') && !aviso(/celíaca/)) F.add('sem glúten sem aviso', rot);
  if (rest.includes('sem_lactose') && !aviso(/lactose/)) F.add('sem lactose sem aviso', rot);

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
  const baixoPeso = a.idade >= 60 ? imc < 22 : imc < 18.5;
  const esperado = cond.includes('diabetes') ? 'manter' : a.objetivo === 'emagrecer' && baixoPeso ? 'manter' : a.objetivo === 'ganhar' && imc >= 30 ? 'manter' : a.objetivo;
  if (r.objetivoCalc !== esperado) F.add('objetivo efetivo errado', `${rot}: ${r.objetivoCalc} (esperado ${esperado})`);
  if ((r.modo === 'manutencao') !== (cond.includes('diabetes') || esperado !== a.objetivo)) F.add('modo manutenção inconsistente', rot);
  if (r.modo === 'manutencao' && !r.avisos.some((x) => x.tipo === 'warn')) F.add('manutenção forçada sem explicação', rot);
  // calorias: pisos de segurança, déficit e superávit (AHA/ACC/TOS 2013; Helms 2014; Iraki 2019; Slater 2019)
  if (r.kcal < Math.min(piso, r.gasto)) F.add('calorias abaixo do piso de segurança', `${rot}: ${r.kcal}`);
  if (r.kcal < 1000) F.add('meta abaixo de 1000 kcal', `${rot}: ${r.kcal}`);
  if (r.objetivoCalc === 'emagrecer') {
    const def = r.gasto - r.kcal;
    if (def < 0 || def > 760 || def > r.gasto * 0.2 + 10) F.add('déficit fora de 0–20% (máx. 750 kcal)', `${rot}: ${def}`);
    if (r.gasto > piso * 1.3 && def < r.gasto * 0.1) F.add('emagrecer sem déficit de verdade', `${rot}: ${def}`);
    if (r.gasto <= piso && !aviso(/gasto estimado já é baixo/)) F.add('gasto baixo sem aviso', rot);
    if (!(r.ritmo && r.ritmo[0] > 0 && r.ritmo[0] <= r.ritmo[1] && r.ritmo[1] <= 1)) F.add('ritmo de perda fora de 0–1 kg/semana', `${rot}: ${r.ritmo}`);
  } else if (r.objetivoCalc === 'ganhar') {
    const sup = r.kcal - r.gasto;
    if (sup <= 0 || sup > 510 || sup > r.gasto * 0.1 + 10) F.add('superávit fora de 0–10% (máx. 500 kcal)', `${rot}: ${sup}`);
    if (!(r.ritmo && r.ritmo[0] > 0 && r.ritmo[0] <= r.ritmo[1] && r.ritmo[1] <= a.peso * 0.005 + 0.06)) F.add('ritmo de ganho acima de 0,5% do peso', `${rot}: ${r.ritmo}`);
  } else {
    if (r.kcal !== r.gasto) F.add('manutenção diferente do gasto', `${rot}: ${r.kcal} vs ${r.gasto}`);
    if (r.ritmo !== undefined) F.add('manutenção com ritmo de peso', rot);
    if (r.gasto < piso && !aviso(/abaixo de \d+ kcal/)) F.add('estimativa abaixo do piso sem aviso', rot);
  }
  // proteína por kg (ISSN 2017: 1,4–2,0; Morton 2018: 1,6, até 2,2; Helms 2014: parte alta em déficit; PROT-AGE: 65+ ≥ 1,0–1,2)
  const gkg = r.prot / pesoRef;
  const treina = Number(a.treinos) >= 2;
  const [lo, hi] = r.objetivoCalc === 'manter' ? (treina ? [1.4, 2.0] : [0.8, 1.4]) : [1.6, 2.2];
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
// quantidade máxima realista por alimento numa refeição, pelo papel dele no prato
function validarCardapio(a, r, seed, F, { metas = true } = {}) {
  const rot = `${rotulo(a)} seed=${seed}`;
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
    if (ref.itens.length > 8) F.add('refeição com itens demais', `${rot}: ${ref.nome} = ${ref.itens.length}`);
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
      if (f.nova === 4 && !['leite-de-soja', 'proteina-de-soja-texturizada', 'pao-de-forma-integral'].includes(f.id)) F.add('ultraprocessado no cardápio', `${rot}: ${it.id}`);
      // porções realistas
      const max = f.papel === 'gordura' && f.cat !== 'frutas' ? 60 : f.papel === 'proteina' ? 300 : f.cat === 'bebidas' || /leite|iogurte/.test(f.id) ? 400 : 350;
      if (!(Number.isFinite(it.g) && it.g > 0)) F.add('quantidade inválida', `${rot}: ${it.id} = ${it.g}`);
      else {
        if (it.g > max) F.add('porção grande demais', `${rot}: ${it.id} = ${it.g} g`);
        if (it.g > f.porcao.g * 3.01) F.add('mais de 3 porções do mesmo alimento na refeição', `${rot}: ${it.id} = ${it.g} g (porção ${f.porcao.g} g)`);
        if (it.g < f.porcao.g * 0.3) F.add('porção minúscula (menos de 1/3 da porção caseira)', `${rot}: ${it.id} = ${it.g} g (porção ${f.porcao.g} g)`);
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
  const repetidos = [...noDia].filter((x) => x[1] > 1 && x[0] !== 'azeite-de-oliva').map((x) => x[0]);
  // quem não come carne tem poucas fontes de proteína na tabela: soja, tofu e leguminosas podem aparecer duas vezes
  // (em metas extremas de calorias, os acompanhamentos se repetem por necessidade: aí vale só o limite de 2 vezes por alimento)
  if (metas && repetidos.length > (rest.includes('vegano') ? 5 : rest.includes('vegetariano') ? 4 : 3)) F.add('muitos alimentos repetidos no dia', `${rot}: ${repetidos}`);
  if (noDia.size < 8) F.add('pouca variedade (menos de 8 alimentos no dia)', `${rot}: ${noDia.size}`);
  if (![...noDia.keys()].some((id) => FOOD.get(id).papel === 'fruta')) F.add('dia sem fruta', rot);
  if ([...noDia.keys()].filter((id) => FOOD.get(id).papel === 'vegetal').length < 2) F.add('dia com menos de 2 verduras/legumes', rot);
  // perto das metas
  if (metas) {
    if (Math.abs(c.kcal - r.kcal) > r.kcal * 0.1) F.add('calorias do cardápio a mais de 10% da meta', `${rot}: ${Math.round(c.kcal)} vs ${r.kcal}`);
    if (c.p < r.prot * 0.85) F.add('proteína do cardápio abaixo de 85% da meta', `${rot}: ${Math.round(c.p)} vs ${r.prot}`);
    // a meta de proteína é um mínimo; quando ela é baixa para as calorias, um dia de comida comum passa um pouco dela
    // sem sair da faixa aceitável (até 23% das calorias aqui, o comum num dia com carne, ovos e laticínios; o limite da IOM é 35%)
    if (c.p > Math.max(r.prot * 1.3, (r.kcal * 0.23) / 4)) F.add('proteína do cardápio acima de 130% da meta (e de 23% das calorias)', `${rot}: ${Math.round(c.p)} vs ${r.prot}`);
  } else if (c.kcal < Math.min(r.kcal * 0.9, 2400) || c.kcal > r.kcal * 1.1) F.add('cardápio fora de faixa para meta extrema', `${rot}: ${Math.round(c.kcal)} vs ${r.kcal}`);
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

test('estresse: todas as 16 combinações de restrições × 64 de condições × objetivo × sexo (6.144 perfis)', () => {
  const F = new Falhas();
  let n = 0;
  for (const restricoes of TODAS_REST) for (const condicoes of TODAS_COND) for (const objetivo of OBJ) for (const sexo of SEXO) {
    const a = { ...base, objetivo, sexo, restricoes, condicoes, idade: [25, 45, 70][n % 3], peso: [55, 80, 110][n % 3], altura: [160, 175, 182][n % 3], refeicoes: REF[n % 4] };
    const r = validarMetas(a, F);
    n++;
    if (r && r.modo !== 'educativo' && n % 3 === 0) validarCardapio(a, r, n % 11, F);
  }
  TOTAL += n;
  assert.equal(n, 16 * 64 * 3 * 2);
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
  // baixo peso: nunca déficit (IMC < 18,5; 60+: IMC < 22)
  for (const [idade, peso, altura, baixo] of [[30, 56, 175, true], [30, 57, 175, false], [59, 60, 172, false], [60, 60, 172, true], [60, 66, 172, false], [99, 40, 150, true]]) {
    const r = calcular({ ...base, idade, peso, altura, objetivo: 'emagrecer', atividade: 'moderado' });
    assert.equal(r.baixoPeso, baixo, `${idade}/${peso}/${altura}`);
    if (r.modo !== 'educativo') assert.equal(r.objetivoCalc, baixo ? 'manter' : 'emagrecer', `${idade}/${peso}/${altura}`);
  }
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
  const f = calcular({ ...base, sexo: 'f', idade: 45, peso: 62, altura: 158, treinos: '0' });
  assert.equal(f.objetivoCalc, 'emagrecer'); assert.equal(f.kcal, 1200); assert.ok(f.avisos.some((x) => /1200 kcal/.test(x.texto)));
  const m = calcular({ ...base, sexo: 'm', idade: 70, peso: 62, altura: 165, treinos: '0' });
  assert.equal(m.objetivoCalc, 'emagrecer'); assert.equal(m.kcal, 1500);
  // água e fibras nos extremos
  assert.equal(calcular({ ...base, peso: 250, altura: 220 }).agua, 4);
  assert.equal(calcular({ ...base, peso: 30, altura: 150, objetivo: 'manter' }).agua, 1.5);
  assert.ok(calcular({ ...base, objetivo: 'manter', peso: 249, altura: 220, atividade: 'intenso', treinos: '6' }).fibra <= 50);
});

test('robustez: respostas fora da faixa, vazias ou de tipo errado não geram NaN nem erro', () => {
  const estranhas = [{}, null, undefined, { ...base, peso: NaN }, { ...base, peso: '80' }, { ...base, altura: 0 }, { ...base, idade: -5 }, { ...base, idade: 1e9 }, { ...base, peso: Infinity }, { ...base, sexo: 'x' }, { ...base, objetivo: 'voar' },
    { ...base, atividade: 'lua' }, { ...base, treinos: 99 }, { ...base, refeicoes: '12' }, { ...base, refeicoes: 0 }, { ...base, restricoes: 'vegano' }, { ...base, condicoes: [null, 1, {}] }, { ...base, horario: 'madrugada' }, { ...base, restricoes: ['xyz', 'vegano'] }];
  for (const a of estranhas) {
    let r;
    assert.doesNotThrow(() => { r = calcular(a); }, JSON.stringify(a));
    TOTAL++;
    for (const k of ['imc', 'tmb', 'gasto', 'agua']) assert.ok(Number.isFinite(r[k]) && r[k] > 0, `${k} em ${JSON.stringify(a)}`);
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
  for (const restricoes of TODAS_REST) for (const objetivo of OBJ) for (const refeicoes of REF) for (const [sexo, peso, altura, idade] of corpos) {
    const a = { ...base, restricoes, objetivo, refeicoes, sexo, peso, altura, idade, atividade: ATIV[n % 4], treinos: TREINOS[n % 5] };
    const r = calcular(a);
    TOTAL++;
    n++;
    if (r.modo === 'educativo') continue;
    // com só 3 refeições, porções caseiras não chegam a mais de 3.000 kcal: acima disso o cardápio é só validado
    for (const seed of sementes) validarCardapio(a, r, seed, F, { metas: !(refeicoes === '3' && r.kcal > 3000) });
    // "outra sugestão" muda o cardápio de verdade
    const dias = sementes.slice(0, 6).map((s) => cardapio(r, s).refeicoes.map((x) => x.itens.map((i) => i.id).join(',')).join('|'));
    for (let i = 1; i < dias.length; i++) if (dias[i] === dias[i - 1]) F.add('"outra sugestão" devolveu o mesmo cardápio', `${rotulo(a)} seeds ${sementes[i - 1]} e ${sementes[i]}`);
    if (new Set(dias).size < 4) F.add('pouca variação entre sugestões', `${rotulo(a)}: ${new Set(dias).size} de 6`);
  }
  assert.equal(n, 16 * 3 * 4 * 6);
  F.confere('cardápio');
});

test('cardápio: 4.000 perfis aleatórios com sementes de 0 a 999 (metas de 1.200 a 3.600 kcal conferidas — até 3.000 com 3 refeições; extremos só validados)', () => {
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
    const normal = res.kcal >= 1200 && res.kcal <= (a.refeicoes === '3' ? 3000 : 3600) && res.prot <= 200;
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
    if (!/\d+ a \d+ mL/.test(t.agua)) F.add('texto da água mal formado', `${rot}: ${t.agua}`);
  }
  // faixas de IMC
  for (let imc = 10; imc <= 80; imc += 0.5) for (const idade of [18, 59, 60, 99]) assert.ok(semLixo(imcFaixa(imc, idade)));
  F.confere('em volta do treino');
});

test('referências citadas existem e a contagem de perfis passa de 40 mil', () => {
  for (const k of ['mifflin1990', 'frankenfield2005', 'jensen2013', 'helms2014', 'iraki2019', 'slater2019', 'jager2017', 'morton2018', 'bauer2013', 'schoenfeld2018', 'thomas2016', 'efsa2010', 'oms_dieta', 'kdigo2024', 'raj2025']) assert.ok(REFS[k], k);
  assert.ok(TOTAL >= 40000, 'perfis: ' + TOTAL);
  assert.ok(CARDAPIOS >= 15000, 'cardápios: ' + CARDAPIOS);
  console.log(`   Nutricionista: ${TOTAL} perfis calculados e ${CARDAPIOS} cardápios conferidos`);
});

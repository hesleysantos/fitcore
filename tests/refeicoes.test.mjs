// Combinações das refeições do cardápio de exemplo: milhares de perfis sorteados (metas, restrições, alergias, "mais
// baratos", trocas, "O que tenho em casa"). Cada refeição sai de um modelo que se come junto no Brasil:
//   café da manhã: base (pão, tapioca, cuscuz, aveia, macaxeira...) + proteína de café ou fruta; nada de almoço;
//   almoço e jantar: base e proteína de prato, sem alimento de café, sem dois carboidratos que não combinam;
//   lanches e ceia: nada de prato;
//   porções dentro de limites reais; nada que a restrição, a alergia ou o "só diário" proíba.
// E os alimentos acrescentados na pesquisa de novembro de 2026 (POF/IBGE e TACO).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTOS, alergenosDe, MISTURAS, MEDIDAS } from '../www/js/data/foods.js';
import { PERGUNTAS, calcular, cardapio, porcaoMedida } from '../www/js/logic/nutrition.js';
import { buscarAlimentos } from '../www/js/logic/diario.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));
function semente(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const um = (r, l) => l[Math.floor(r() * l.length)];
const inteiro = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const op = (k) => PERGUNTAS.find((q) => q.k === k).op.map((o) => o[0]).filter((x) => x !== 'nenhuma');
const subconjuntos = (l) => { const out = []; for (let m = 0; m < 1 << l.length; m++) out.push(l.filter((_, i) => m & (1 << i))); return out; };
const TODAS_REST = subconjuntos(op('restricoes'));
const ALERGIAS = op('alergias');

// ---- o que é de cada refeição ----
const conj = (...l) => new Set(l.flat());
// bases do café da manhã (e dos lanches)
const BASE_CAFE = conj('pao-frances', 'pao-de-forma-integral', 'pao-de-forma', 'torrada', 'biscoito-cream-cracker', 'biscoito-maisena', 'biscoito-de-polvilho', 'tapioca-pronta', 'cuscuz-de-milho-cozido',
  'aveia-em-flocos', 'granola', 'cereal-matinal-de-milho', 'mandioca-cozida', 'batata-doce-cozida', 'inhame-cozido', 'cara-cozido', 'banana-da-terra', 'milho-verde-espiga',
  'pao-de-queijo-assado', 'bolo-de-milho', 'pamonha', 'canjica-com-leite', 'bolo-de-chocolate', 'biscoito-recheado');
// proteínas de café
const PROT_CAFE = conj('ovo-cozido', 'ovo-frito', 'omelete-de-queijo', 'clara-de-ovo-cozida', 'ovo-de-codorna', 'queijo-minas-frescal', 'queijo-mucarela', 'ricota', 'queijo-cottage', 'queijo-prato',
  'queijo-minas-meia-cura', 'requeijao-cremoso', 'presunto-cozido', 'peito-de-peru-defumado', 'mortadela', 'salame', 'tofu', 'pasta-de-amendoim', 'leite-integral', 'leite-desnatado',
  'leite-semidesnatado', 'leite-de-soja', 'leite-em-po-integral', 'leite-em-po-desnatado', 'leite-achocolatado', 'cafe-com-leite', 'iogurte-natural', 'iogurte-natural-desnatado', 'iogurte-de-morango',
  'bebida-lactea', 'leite-fermentado', 'whey-protein');
// alimentos de almoço e jantar (arroz, feijões, carnes de panela, peixes, legumes de prato, óleo, farinha, massas, pratos prontos)
const DE_PRATO = (f) => ['arroz-branco-cozido', 'arroz-integral-cozido', 'quinoa-cozida', 'macarrao-cozido', 'batata-inglesa-cozida', 'farinha-de-mandioca-torrada', 'lasanha-massa-cozida', 'nhoque-de-batata-cozido',
  'baiao-de-dois', 'feijao-tropeiro', 'feijoada', 'macarrao-a-bolonhesa', 'soja-cozida', 'proteina-de-soja-texturizada', 'polenta-cozida'].includes(f.id)
  || (f.cat === 'leguminosas' && f.papel !== 'proteina' && f.id !== 'tofu') || (f.cat === 'carnes' && !['presunto-cozido', 'peito-de-peru-defumado', 'mortadela', 'salame'].includes(f.id))
  || f.cat === 'peixes' || f.papel === 'vegetal' || ['azeite-de-oliva', 'oleo-de-soja', 'oleo-de-girassol', 'oleo-de-milho', 'oleo-de-canola'].includes(f.id);
// alimentos de café no prato (pão, iogurte, granola, aveia, leite, queijos, frios, pasta, manteiga, tapioca, cereal, quitandas)
const DE_CAFE = (id) => (BASE_CAFE.has(id) && !['mandioca-cozida', 'batata-doce-cozida', 'inhame-cozido', 'cara-cozido', 'banana-da-terra', 'milho-verde-espiga', 'cuscuz-de-milho-cozido'].includes(id))
  || (PROT_CAFE.has(id) && !['ovo-cozido', 'ovo-frito', 'omelete-de-queijo', 'clara-de-ovo-cozida', 'ovo-de-codorna', 'tofu'].includes(id)) || ['mel', 'chia', 'linhaca', 'castanha-de-caju', 'castanha-do-para', 'nozes', 'amendoa', 'amendoim-torrado-salgado'].includes(id);
// bases do prato e as guarnições que acompanham o arroz e feijão
const BASE_PRATO = conj('arroz-branco-cozido', 'arroz-integral-cozido', 'quinoa-cozida', 'macarrao-cozido', 'lasanha-massa-cozida', 'nhoque-de-batata-cozido', 'macarrao-instantaneo', 'batata-inglesa-cozida', 'mandioca-cozida',
  'batata-doce-cozida', 'inhame-cozido', 'batata-inglesa-assada', 'mandioquinha-cozida', 'cara-cozido', 'polenta-cozida', 'pinhao-cozido', 'batata-saute', 'batata-inglesa-frita', 'mandioca-frita', 'milho-verde-espiga',
  'banana-da-terra', 'cuscuz-de-milho-cozido', 'baiao-de-dois', 'feijao-tropeiro', 'feijoada', 'macarrao-a-bolonhesa');
const ARROZ = conj('arroz-branco-cozido', 'arroz-integral-cozido', 'quinoa-cozida');
const GUARNICAO = conj('batata-inglesa-cozida', 'mandioca-cozida', 'batata-inglesa-frita', 'mandioca-frita', 'batata-saute', 'macarrao-cozido');
// proteínas de prato (carnes, peixes, ovos, soja; sem carne, também as leguminosas)
const PROT_PRATO = (f, semCarne) => (f.papel === 'proteina' && f.cat !== 'outros') || f.id === 'ovo-cozido' || (semCarne && f.cat === 'leguminosas');
// Porções de referência (medida caseira do IBGE — data/foods.js, MEDIDAS — e mínimo e máximo por refeição —
// logic/nutrition.js, porcaoMedida). Um alimento pode estar em mais de um lugar (a mandioca é base ou guarnição; o ovo,
// proteína ou reforço): vale qualquer um dos lugares do tipo de refeição.
const PAPEIS_TESTE = [undefined, 'guarnicao', 'reforco', 'sobremesa'];
function dentroDaReferencia(id, tipo, g) {
  const m = MEDIDAS[id];
  if (!m) return { medido: false };
  const faixas = PAPEIS_TESTE.map((p) => porcaoMedida(id, tipo, p)).filter(Boolean);
  if (!faixas.length) return { medido: false };
  const n = g / m[0];
  return { medido: true, ok: faixas.some(([mn, mx]) => g >= Math.round(mn) - 1 && g <= Math.round(mx) + 1), meia: Math.abs(n * 2 - Math.round(n * 2)) < 0.1, faixas };
}
// bebidas: café com leite, leites, sucos e o que é da categoria de bebidas
const BEBIDA = (f) => f.cat === 'bebidas' || /^leite-|^cafe-com-leite/.test(f.id);
// proteína mínima de prato: 1 bife ou filé (ou o mínimo de referência do alimento)

class Falhas {
  constructor() { this.m = new Map(); this.n = 0; }
  add(cat, det) { this.n++; const x = this.m.get(cat) || { n: 0, ex: [] }; x.n++; if (x.ex.length < 3) x.ex.push(det); this.m.set(cat, x); }
  confere(t) { assert.equal(this.n, 0, `${t}: ${this.n} falhas\n${[...this.m].map(([c, x]) => `${c}: ${x.n}\n    ${x.ex.join('\n    ')}`).join('\n')}`); }
}
const desc = (ref) => `${ref.nome}: ${ref.itens.map((x) => `${x.id} ${x.g}`).join(' + ')}`;

function conferirDia(dia, res, a, rot, F, { casa = null } = {}) {
  const rest = a.restricoes, alg = a.alergias;
  const semCarne = rest.includes('vegano') || rest.includes('vegetariano');
  for (const ref of dia.refeicoes) {
    const ids = ref.itens.map((x) => x.id);
    const fs = ids.map((id) => FOOD.get(id));
    for (const it of ref.itens) {
      const f = FOOD.get(it.id);
      // nada proibido
      for (const t of rest) if (!f.tags.includes(t)) F.add('alimento que fere a restrição', `${rot}: ${it.id} (${t})`);
      for (const al of alg) if (alergenosDe(it.id).includes(al)) F.add('alimento com o alergênico', `${rot}: ${it.id} (${al})`);
      if (f.soDiario) F.add('alimento "só diário" no cardápio', `${rot}: ${it.id}`);
      if (casa && !casa.has(it.id)) F.add('alimento que a pessoa não tem em casa', `${rot}: ${it.id}`);
      // porções dentro do mínimo e do máximo de referência, em medida caseira inteira ou meia (no cardápio de sempre
      // todo alimento tem medida; em casa, os que não têm ficam com a porção da tabela)
      const ref0 = dentroDaReferencia(it.id, ref.tipo, it.g);
      if (!ref0.medido && !casa) F.add('alimento sem medida caseira de referência', `${rot}: ${ref.nome} ${it.id}`);
      if (ref0.medido && !ref0.ok) F.add('porção fora do mínimo e do máximo de referência', `${rot}: ${ref.nome} ${it.id} ${it.g} g (${ref0.faixas.map((x) => x.slice(0, 2).map(Math.round).join('–')).join(' ou ')})`);
      if (ref0.medido && !ref0.meia) F.add('medida caseira quebrada (nem inteira nem meia)', `${rot}: ${ref.nome} ${it.medida}`);
      if (it.g > Math.max(f.porcao.g, MEDIDAS[it.id] ? MEDIDAS[it.id][0] : 0) * 3.01) F.add('mais de 3 porções caseiras', `${rot}: ${it.id} ${it.g} g`);
    }
    // no máximo uma bebida por refeição; com suco, uma fruta só
    const bebidas = fs.filter(BEBIDA);
    if (bebidas.length > 1) F.add('mais de uma bebida na refeição', `${rot}: ${desc(ref)}`);
    if (ref.tipo === 'cafe' && fs.some((f) => f.id.startsWith('suco-')) && fs.filter((f) => f.papel === 'fruta').length > 1) F.add('café com suco e duas frutas', `${rot}: ${desc(ref)}`);
    if (ref.tipo === 'cafe' && fs.some((f) => f.id.startsWith('suco-')) && ref.itens.some((it) => FOOD.get(it.id).papel === 'fruta' && MEDIDAS[it.id] && it.g > MEDIDAS[it.id][0] + 1)) F.add('café com suco e mais de uma unidade de fruta', `${rot}: ${desc(ref)}`);
    if (fs.filter((f) => f.papel === 'fruta').length > 2) F.add('mais de duas frutas na refeição', `${rot}: ${desc(ref)}`);
    if (ref.tipo === 'cafe' || ref.tipo === 'lanche' || ref.tipo === 'ceia') {
      for (const f of fs) if (DE_PRATO(f)) F.add(`alimento de almoço/jantar no ${ref.tipo}`, `${rot}: ${desc(ref)}`);
    }
    if (ref.tipo === 'cafe') {
      const base = ids.some((id) => BASE_CAFE.has(id));
      const prot = ids.some((id) => PROT_CAFE.has(id));
      const fruta = fs.some((f) => f.papel === 'fruta');
      // a base só pode faltar em casa (quando nenhuma marcada serve)
      if (!base && !casa) F.add('café sem base', `${rot}: ${desc(ref)}`);
      if (!prot && !fruta && !casa) F.add('café sem proteína de café e sem fruta', `${rot}: ${desc(ref)}`);
      // pasta de amendoim só com pão, tapioca ou aveia
      // (em casa, o biscoito de água e sal ou de polvilho faz as vezes do pão)
      if (ids.includes('pasta-de-amendoim') && !ids.some((id) => ['pao-frances', 'pao-de-forma-integral', 'pao-de-forma', 'torrada', 'biscoito-cream-cracker', 'biscoito-maisena', 'biscoito-de-polvilho', 'tapioca-pronta', 'aveia-em-flocos', 'granola'].includes(id))) F.add('pasta de amendoim sem pão, tapioca ou aveia', `${rot}: ${desc(ref)}`);
    }
    if (ref.tipo === 'principal') {
      const bases = ids.filter((id) => BASE_PRATO.has(id));
      const prot = fs.filter((f) => PROT_PRATO(f, semCarne));
      if (!bases.length && !casa) F.add('prato sem base', `${rot}: ${desc(ref)}`);
      if (!prot.length && !casa) F.add('prato sem proteína', `${rot}: ${desc(ref)}`);
      // a proteína do prato nunca fica abaixo do mínimo de referência (1 bife, 1 filé, 2 ovos...)
      for (const it of ref.itens) {
        const f = FOOD.get(it.id);
        if (!(f.papel === 'proteina' && f.cat !== 'leguminosas' && f.cat !== 'outros') || !MEDIDAS[it.id]) continue;
        const faixas = ['reforco', undefined].map((p) => porcaoMedida(it.id, 'principal', p)).filter(Boolean);
        if (faixas.length && it.g < Math.min(...faixas.map((x) => x[0])) - 1) F.add('proteína do prato abaixo do mínimo', `${rot}: ${desc(ref)}`);
      }
      for (const id of ids) if (DE_CAFE(id)) F.add('alimento de café no prato', `${rot}: ${desc(ref)}`);
      // uma base só; com arroz, uma guarnição (batata, mandioca) pode acompanhar, como no prato feito
      const extra = bases.filter((id) => !ARROZ.has(id));
      if (bases.length > 2 || (bases.length === 2 && !(bases.some((id) => ARROZ.has(id)) && extra.length === 1 && GUARNICAO.has(extra[0])))) F.add('dois carboidratos de base que não combinam', `${rot}: ${desc(ref)}`);
      // proteínas de prato: até 2 (a segunda é o reforço do modelo: ovo no prato feito; sem carne, soja ou grão-de-bico)
      const fortes = prot.filter((f) => f.cat !== 'leguminosas' || f.papel === 'proteina');
      if (fortes.length > 2) F.add('três proteínas de prato', `${rot}: ${desc(ref)}`);
      if (!semCarne && fortes.filter((f) => f.id !== 'ovo-cozido' && f.id !== 'ovo-frito').length > 1) F.add('duas carnes no mesmo prato', `${rot}: ${desc(ref)}`);
    }
  }
}

test('refeições que combinam: 6.000 perfis sorteados (metas, restrições, alergias, "mais baratos", trocas)', () => {
  const F = new Falhas();
  const r = semente(20261116);
  let n = 0, refs = 0;
  const modelos = new Map();
  while (n < 6000) {
    const a = {
      objetivo: um(r, op('objetivo')), sexo: um(r, op('sexo')), idade: inteiro(r, 18, 85), peso: inteiro(r, 45, 160), altura: inteiro(r, 150, 200), atividade: um(r, op('atividade')),
      treinos: um(r, op('treinos')), horario: 'noite', refeicoes: um(r, op('refeicoes')), restricoes: r() < 0.5 ? [] : um(r, TODAS_REST), alergias: r() < 0.7 ? [] : [um(r, ALERGIAS)],
      condicoes: ['nenhuma'], preco: r() < 0.5 ? 'barato' : 'tanto_faz',
    };
    const res = calcular({ ...a, restricoes: a.restricoes.length ? a.restricoes : ['nenhuma'], alergias: a.alergias.length ? a.alergias : ['nenhuma'] });
    if (res.modo === 'educativo') continue;
    n++;
    const seed = inteiro(r, 0, 999);
    const trocas = r() < 0.3 ? Array.from({ length: Number(a.refeicoes) }, () => (r() < 0.4 ? inteiro(r, 1, 9) : 0)) : null;
    const dia = cardapio(res, seed, { trocas });
    refs += dia.refeicoes.length;
    for (const ref of dia.refeicoes) if (ref.tipo === 'cafe') { const k = ref.itens.map((x) => x.id).filter((id) => BASE_CAFE.has(id))[0] || '-'; modelos.set(k, (modelos.get(k) || 0) + 1); }
    conferirDia(dia, res, a, `${JSON.stringify(a)} seed=${seed}${trocas ? ' trocas=' + trocas : ''}`, F);
  }
  assert.ok(refs > 20000, 'refeições conferidas: ' + refs);
  // o café varia: pão, tapioca, cuscuz, aveia e macaxeira aparecem
  for (const b of ['pao-frances', 'tapioca-pronta', 'cuscuz-de-milho-cozido', 'mandioca-cozida']) assert.ok((modelos.get(b) || 0) > 100, `café com ${b}: ${modelos.get(b) || 0}`);
  assert.ok((modelos.get('aveia-em-flocos') || 0) > 10, 'café com aveia: ' + (modelos.get('aveia-em-flocos') || 0));
  F.confere('refeições');
});

test('refeições que combinam em casa: 1.500 despensas sorteadas (com tudo marcado de vez em quando, inclusive o "só diário")', () => {
  const F = new Falhas();
  const r = semente(77);
  const todos = ALIMENTOS.map((f) => f.id);
  let n = 0;
  while (n < 1500) {
    const a = { objetivo: um(r, op('objetivo')), sexo: um(r, op('sexo')), idade: inteiro(r, 20, 70), peso: inteiro(r, 50, 110), altura: inteiro(r, 155, 190), atividade: 'leve', treinos: um(r, op('treinos')),
      horario: 'noite', refeicoes: um(r, op('refeicoes')), restricoes: r() < 0.6 ? [] : um(r, TODAS_REST), alergias: r() < 0.8 ? [] : [um(r, ALERGIAS)], condicoes: ['nenhuma'] };
    const res = calcular({ ...a, restricoes: a.restricoes.length ? a.restricoes : ['nenhuma'], alergias: a.alergias.length ? a.alergias : ['nenhuma'] });
    if (res.modo === 'educativo') continue;
    n++;
    const emCasa = r() < 0.1 ? todos : [...new Set(Array.from({ length: inteiro(r, 10, 120) }, () => um(r, todos)))];
    const dia = cardapio(res, inteiro(r, 0, 999), { emCasa });
    conferirDia(dia, res, a, `${JSON.stringify(a)} casa=${emCasa.length}`, F, { casa: new Set(emCasa) });
  }
  F.confere('refeições em casa');
});

test('alimentos novos (POF/IBGE e TACO, nov/2026): composição completa, porção, categoria, fontes; busca do diário', () => {
  const NOVOS = ['cafe-com-leite', 'cafe-com-leite-com-acucar', 'cafe-com-acucar', 'suco-de-abacaxi', 'suco-de-acerola', 'suco-de-goiaba', 'suco-de-mamao', 'suco-de-manga', 'suco-de-maracuja', 'suco-de-melao',
    'suco-de-morango', 'suco-de-tangerina', 'suco-de-caju', 'suco-de-laranja-com-acucar', 'suco-de-abacaxi-com-acucar', 'suco-de-acerola-com-acucar', 'suco-de-goiaba-com-acucar', 'suco-de-manga-com-acucar',
    'suco-de-maracuja-com-acucar', 'suco-de-morango-com-acucar', 'suco-de-tangerina-com-acucar', 'suco-de-caju-com-acucar', 'refrigerante-de-cola-zero', 'refrigerante-de-guarana-zero', 'refrigerante-de-laranja',
    'refrigerante-de-limao', 'vitamina-de-banana', 'pao-com-ovo', 'pao-com-manteiga', 'misto-quente', 'pizza-de-mucarela', 'pizza-de-calabresa', 'acai-na-tigela', 'picole'];
  for (const id of NOVOS) {
    const f = FOOD.get(id);
    assert.ok(f, 'alimento novo ausente: ' + id);
    for (const k of ['kcal', 'p', 'c', 'g', 'fibra']) assert.ok(Number.isFinite(f[k]) && f[k] >= 0, `${id}.${k}`);
    assert.ok(f.porcao && f.porcao.g > 0 && /^\d+ \S/.test(f.porcao.desc), 'porção: ' + id);
    assert.ok(['bebidas', 'outros', 'frutas'].includes(f.cat), 'categoria: ' + id);
    assert.ok(['IBGE', 'TACO'].includes(f.fonte), 'fonte da composição: ' + id);
    assert.ok(f.preco && f.preco.fonte && [1, 2, 3].includes(f.preco.faixa), 'preço: ' + id);
    // calorias coerentes com os macronutrientes (4-4-9), como nos outros
    assert.ok(Math.abs(4 * f.p + 4 * f.c + 9 * f.g - f.kcal) <= Math.max(5, f.kcal * 0.12), `calorias de ${id}`);
  }
  // as versões com açúcar: a bebida + 10% de açúcar (POF 2017-2018), por 100 g; e mais calorias que a sem açúcar
  const acucar = FOOD.get('acucar-refinado');
  for (const f of ALIMENTOS.filter((x) => x.base)) {
    const b = FOOD.get(f.base);
    assert.ok(Math.abs(f.kcal - (b.kcal + 0.1 * acucar.kcal) / 1.1) < 0.01 && f.kcal > b.kcal && f.soDiario, f.id);
  }
  // as misturas (MX) só usam alimentos com preço pesquisado, e as proporções somam até 1 kg
  for (const [id, ing] of Object.entries(MISTURAS)) {
    assert.equal(FOOD.get(id).preco.fonte, 'MX', id);
    assert.ok(ing.reduce((s, [, kg]) => s + kg, 0) <= 1.001, id);
    for (const [k] of ing) assert.ok(FOOD.get(k) && FOOD.get(k).preco.fonte, `${id}: ${k}`);
  }
  // refrigerantes, salgados, doces e bebidas com açúcar são só do diário; os básicos (café com leite, sucos sem açúcar) não
  for (const id of ['refrigerante-de-cola', 'refrigerante-de-cola-zero', 'pizza-de-mucarela', 'picole', 'suco-de-maracuja-com-acucar', 'cafe-com-acucar', 'misto-quente']) assert.ok(FOOD.get(id).soDiario, id);
  for (const id of ['cafe-com-leite', 'suco-de-maracuja', 'suco-de-caju', 'suco-de-acerola']) assert.ok(!FOOD.get(id).soDiario, id);
  // "só diário" nunca entra no cardápio, nem com tudo marcado em casa
  const todos = ALIMENTOS.map((f) => f.id);
  for (const refeicoes of ['3', '4', '5', '6']) for (let s = 0; s < 40; s++) {
    const res = calcular({ objetivo: 'manter', sexo: 'm', idade: 30, peso: 80, altura: 178, atividade: 'leve', treinos: '3', horario: 'noite', refeicoes, restricoes: ['nenhuma'], condicoes: ['nenhuma'] });
    for (const dia of [cardapio(res, s), cardapio(res, s, { emCasa: todos })]) for (const ref of dia.refeicoes) for (const it of ref.itens) assert.ok(!FOOD.get(it.id).soDiario, `${it.id} no cardápio`);
  }
  // o café com leite e os sucos naturais entram nos modelos
  const usados = new Set();
  for (let s = 0; s < 200; s++) for (const ref of cardapio(calcular({ objetivo: 'ganhar', sexo: 'm', idade: 25, peso: 85, altura: 182, atividade: 'moderado', treinos: '6', horario: 'noite', refeicoes: '3', restricoes: ['nenhuma'], condicoes: ['nenhuma'] }), s).refeicoes) for (const it of ref.itens) usados.add(it.id);
  for (const id of ['cafe-com-leite', 'suco-de-maracuja', 'suco-de-acerola']) assert.ok(usados.has(id), 'o cardápio deveria usar ' + id);
  // busca do diário: nomes do dia a dia e apelidos
  const acha = (t, id) => assert.ok(buscarAlimentos(t, 10).some((f) => f.id === id), `"${t}" deveria achar ${id}`);
  acha('cafe com leite', 'cafe-com-leite'); acha('cafe com leite com acucar', 'cafe-com-leite-com-acucar'); acha('pingado', 'cafe-com-leite');
  acha('suco de maracuja', 'suco-de-maracuja'); acha('suco de caju sem acucar', 'suco-de-caju'); acha('suco de laranja sem acucar', 'suco-de-laranja-natural');
  acha('refri', 'refrigerante-de-cola'); acha('refri zero', 'refrigerante-de-cola-zero'); acha('coca', 'refrigerante-de-cola'); acha('leite com achocolatado', 'leite-achocolatado');
  acha('misto', 'misto-quente'); acha('pao com ovo', 'pao-com-ovo'); acha('acai', 'acai-na-tigela');
  assert.ok(!buscarAlimentos('suco de caju sem acucar', 10).some((f) => f.id === 'suco-de-caju-com-acucar'), '"sem açúcar" não acha a versão com açúcar');
});

// Testes da Nutricionista: cálculos, travas de segurança e cardápio para muitos perfis.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTOS, LIMITES_PRECO, NOME_FAIXA, calcularPreco, fonteDeProteina, SO_REGISTRO } from '../www/js/data/foods.js';
// os alimentos só para registrar (frituras, salgados, lanches: data/foods.js, SO_REGISTRO) não têm preço: não entram em compra
const COM_PRECO = ALIMENTOS.filter((f) => !SO_REGISTRO.includes(f.id));
import { REFS } from '../www/js/data/knowledge.js';
import { PERGUNTAS, respostasCompletas, calcular, cardapio, proximaSemente, assinatura, faltasDaCasa, USADOS_EM_CASA, emVoltaDoTreino, imcFaixa } from '../www/js/logic/nutrition.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));
const base = { objetivo: 'emagrecer', sexo: 'm', idade: 30, peso: 80, altura: 178, atividade: 'sedentario', treinos: '3', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };

test('perguntas completas e validação', () => {
  assert.ok(respostasCompletas(base));
  assert.ok(!respostasCompletas({ ...base, sexo: 'x' }));
  for (const q of PERGUNTAS) assert.ok(q.titulo.endsWith('?'));
});

test('equação de Mifflin-St Jeor confere com o cálculo manual', () => {
  const r = calcular({ ...base, objetivo: 'manter' });
  const tmb = 9.99 * 80 + 6.25 * 178 - 4.92 * 30 + 5; // 1769,1 (coeficientes como em ruiz2011)
  assert.equal(r.tmb, Math.round(tmb / 10) * 10);
  assert.equal(r.gasto, Math.round((tmb * 1.54) / 10) * 10); // sentado a maior parte do dia (PAL 1,45 da FAO) + 3 treinos (+0,09)
  assert.equal(r.fator, 1.54);
  assert.equal(r.kcal, r.gasto);
  const f = calcular({ ...base, sexo: 'f', peso: 60, altura: 165, idade: 40, objetivo: 'manter' });
  assert.equal(f.tmb, Math.round((9.99 * 60 + 6.25 * 165 - 4.92 * 40 - 161) / 10) * 10);
});

test('metas dentro das faixas das diretrizes para centenas de perfis', () => {
  let n = 0;
  for (const objetivo of ['emagrecer', 'ganhar', 'manter']) for (const sexo of ['m', 'f']) for (const idade of [18, 25, 40, 55, 70]) for (const [peso, altura] of [[50, 160], [65, 170], [80, 178], [100, 175], [130, 180]]) for (const atividade of ['sedentario', 'moderado', 'intenso']) for (const treinos of ['0', '3', '6']) {
    const a = { ...base, objetivo, sexo, idade, peso, altura, atividade, treinos };
    const r = calcular(a);
    const rot = JSON.stringify({ objetivo, sexo, idade, peso, altura, atividade, treinos });
    assert.equal(typeof r.imc, 'number');
    if (r.modo === 'educativo') continue;
    n++;
    const piso = sexo === 'm' ? 1500 : 1200;
    if (r.objetivoCalc === 'emagrecer') {
      assert.ok(r.kcal >= Math.min(piso, r.gasto), 'abaixo do piso de segurança: ' + rot);
      assert.ok(r.kcal <= r.gasto, 'emagrecer acima do gasto: ' + rot);
      assert.ok(r.gasto - r.kcal <= 760, 'déficit maior que 750 kcal: ' + rot);
    }
    if (r.objetivoCalc === 'ganhar') { assert.ok(r.kcal > r.gasto && r.kcal - r.gasto <= 510, 'superávit fora da faixa: ' + rot); }
    if (r.objetivoCalc === 'manter') assert.equal(r.kcal, r.gasto);
    assert.ok(r.prot / peso <= 2.25, `proteína acima de 2,2 g/kg: ${rot} = ${r.prot}`);
    const pesoRef = Math.min(peso, 25 * (altura / 100) ** 2); // acima do IMC 25, a referência é o peso de IMC 25
    assert.ok(r.prot / pesoRef >= 0.95, `proteína muito baixa: ${rot} = ${r.prot}`);
    if (idade >= 65) assert.ok(r.prot / pesoRef >= 1.15 || r.prot * 4 >= r.kcal * 0.33, 'idoso com menos de 1,2 g/kg: ' + rot);
    const kcalMacros = r.prot * 4 + r.carb * 4 + r.gord * 9;
    assert.ok(Math.abs(kcalMacros - r.kcal) <= r.kcal * 0.06 + 40, `macros não fecham com as calorias: ${rot} (${kcalMacros} vs ${r.kcal})`);
    const pctGord = (r.gord * 9) / r.kcal;
    assert.ok(pctGord >= 0.17 && pctGord <= 0.42, `gordura fora de faixa: ${rot} = ${Math.round(pctGord * 100)}%`);
    assert.ok(r.carb >= 50, 'carboidrato baixo demais: ' + rot);
    assert.ok(r.fibra >= 25);
    assert.ok(r.agua >= (sexo === 'm' ? 2.5 : 2.0) && r.agua <= 4, 'água fora do piso da EFSA–4 L: ' + rot);
  }
  assert.ok(n > 700);
});

test('travas de segurança: situações em que o app não calcula dieta', () => {
  for (const cond of ['gestante', 'transtorno', 'renal']) {
    const r = calcular({ ...base, condicoes: [cond] });
    assert.equal(r.modo, 'educativo', cond);
    assert.equal(r.kcal, undefined, 'não deve mostrar calorias: ' + cond);
    assert.equal(r.prot, undefined);
    assert.ok(r.avisos.length >= 1);
    assert.equal(cardapio(r, 0), null);
  }
  const menor = calcular({ ...base, idade: 16 });
  assert.equal(menor.modo, 'educativo');
  assert.equal(menor.kcal, undefined);
  const diab = calcular({ ...base, condicoes: ['diabetes'] });
  assert.equal(diab.modo, 'manutencao');
  assert.equal(diab.kcal, diab.gasto, 'diabetes: sem déficit');
  const magro = calcular({ ...base, peso: 52, altura: 178 });
  assert.equal(magro.modo, 'manutencao', 'IMC baixo: sem déficit');
  assert.equal(magro.kcal, magro.gasto);
  const idosoMagro = calcular({ ...base, idade: 70, peso: 60, altura: 172 }); // IMC 20,3 < 22
  assert.equal(idosoMagro.modo, 'manutencao');
  const pequena = calcular({ ...base, sexo: 'f', peso: 48, altura: 150, idade: 60, treinos: '0' });
  if (pequena.modo === 'completo') assert.ok(pequena.kcal >= 1200);
  assert.ok(calcular({ ...base, condicoes: ['hipertensao'] }).avisos.some((a) => a.texto.includes('sal')));
  assert.ok(calcular({ ...base, restricoes: ['vegano'] }).avisos.some((a) => a.texto.includes('B12')));
});

test('cardápio de exemplo: respeita restrições e chega perto das metas', () => {
  const restr = [['nenhuma'], ['vegetariano'], ['vegano'], ['sem_gluten'], ['sem_lactose'], ['vegano', 'sem_gluten'], ['vegetariano', 'sem_lactose']];
  let n = 0;
  for (const restricoes of restr) for (const objetivo of ['emagrecer', 'ganhar', 'manter']) for (const refeicoes of ['3', '4', '5', '6']) for (const [sexo, peso, altura] of [['m', 80, 178], ['f', 60, 165], ['m', 100, 185], ['f', 75, 160]]) for (const seed of [0, 1, 2, 7]) {
    const r = calcular({ ...base, objetivo, refeicoes, restricoes, sexo, peso, altura });
    if (r.modo === 'educativo') continue;
    const c = cardapio(r, seed);
    const rot = `${restricoes.join('+')}/${objetivo}/${refeicoes}ref/${sexo}${peso}/seed${seed}`;
    assert.equal(c.refeicoes.length, Number(refeicoes));
    for (const ref of c.refeicoes) {
      assert.ok(ref.itens.length >= 1, 'refeição vazia: ' + rot);
      const vistos = new Set();
      for (const it of ref.itens) {
        const f = FOOD.get(it.id);
        assert.ok(f, 'alimento inexistente: ' + it.id);
        assert.ok(!vistos.has(it.id), `alimento repetido na refeição (${rot}): ${it.id}`); vistos.add(it.id);
        assert.ok(it.g > 0 && it.g <= 420, `quantidade estranha (${rot}): ${it.id} = ${it.g} g`);
        if (restricoes.includes('vegano')) assert.ok(f.tags.includes('vegano'), `não vegano no cardápio vegano: ${it.id}`);
        if (restricoes.includes('vegetariano')) assert.ok(f.tags.includes('vegetariano'), `carne no cardápio vegetariano: ${it.id}`);
        if (restricoes.includes('sem_gluten')) assert.ok(f.tags.includes('sem_gluten'), `glúten no cardápio sem glúten: ${it.id}`);
        assert.ok(f.nova <= 3 || ['leite-de-soja', 'proteina-de-soja-texturizada', 'proteina-de-soja-preparada', 'pao-de-forma-integral'].includes(f.id), `ultraprocessado no cardápio: ${it.id}`);
      }
    }
    assert.ok(Math.abs(c.kcal - r.kcal) <= r.kcal * 0.15, `calorias do cardápio longe da meta (${rot}): ${Math.round(c.kcal)} vs ${r.kcal}`);
    assert.ok(c.p >= r.prot * 0.8, `proteína do cardápio abaixo de 80% da meta (${rot}): ${Math.round(c.p)} vs ${r.prot}`);
    assert.ok(c.p <= r.prot * 1.35, `proteína do cardápio muito acima da meta (${rot}): ${Math.round(c.p)} vs ${r.prot}`);
    n++;
  }
  assert.ok(n > 1000);
});

test('orientações em volta do treino e IMC', () => {
  const r = calcular(base);
  const t = emVoltaDoTreino(r, true);
  assert.ok(t.carbPre >= 30 && t.carbPre <= 90);
  assert.ok(t.protPos >= 20 && t.protPos <= 40);
  assert.ok(t.pre.length >= 2 && t.pos.length >= 2);
  const vg = emVoltaDoTreino(calcular({ ...base, restricoes: ['vegano', 'sem_gluten'] }), false);
  for (const s of [...vg.pre, ...vg.pos]) assert.ok(!/iogurte|ovo|frango|queijo|leite ou|atum|pão/i.test(s), 'sugestão incompatível com vegano sem glúten: ' + s);
  assert.equal(imcFaixa(22, 30), 'peso adequado');
  assert.equal(imcFaixa(17, 30), 'abaixo do peso');
  assert.equal(imcFaixa(27, 30), 'sobrepeso');
  assert.equal(imcFaixa(32, 30), 'obesidade grau I');
  assert.equal(imcFaixa(21, 70), 'abaixo do recomendado para a idade');
  assert.equal(imcFaixa(26, 70), 'dentro do recomendado para a idade');
});

test('pergunta de preço: fica no começo, é opcional e não invalida respostas antigas', () => {
  const i = PERGUNTAS.findIndex((q) => q.k === 'preco');
  assert.equal(i, 1, 'logo depois do objetivo');
  const q = PERGUNTAS[i];
  assert.ok(q.opcional && q.tipo === 'um');
  assert.deepEqual(q.op.map((o) => o[0]), ['barato', 'tanto_faz']);
  assert.ok(respostasCompletas(base), 'respostas salvas antes da pergunta continuam completas');
  assert.ok(respostasCompletas({ ...base, preco: 'barato' }));
  assert.ok(!respostasCompletas({ ...base, preco: 'de graça' }));
  assert.equal(calcular(base).preco, 'tanto_faz');
  assert.equal(calcular({ ...base, preco: 'barato' }).preco, 'barato');
  assert.equal(calcular({ ...base, preco: 123 }).preco, 'tanto_faz');
});

test('faixas de preço: nenhum alimento sem faixa e o critério se reproduz', () => {
  assert.deepEqual(LIMITES_PRECO, { kg: [10, 30], porcao: [0.7, 1.6], p100: [15, 25] });
  const nota = (v, [a, b]) => (v <= a ? 1 : v <= b ? 2 : 3);
  const cont = { 1: 0, 2: 0, 3: 0 };
  // toda faixa vem de preço pesquisado, com fonte e data: não existe mais preço estimado "pelo parecido"
  const FONTES = ['PS', 'DP', 'MM', 'MS', 'GO', 'UF', 'AN', 'RN', 'SD', 'MF', 'CG', 'NT', 'RC', 'MX'];
  const porFonte = {};
  for (const f of ALIMENTOS) if (SO_REGISTRO.includes(f.id)) assert.ok(f.preco === null && f.soDiario === true, 'só para registrar, sem preço e fora do cardápio: ' + f.id);
  for (const f of COM_PRECO) {
    const p = f.preco;
    assert.ok(p && [1, 2, 3].includes(p.faixa), 'sem faixa de preço: ' + f.id);
    assert.ok(NOME_FAIXA[p.faixa]);
    assert.ok(p.kg > 0 && p.porcao > 0 && Number.isFinite(p.kg) && Number.isFinite(p.porcao), 'preço inválido: ' + f.id);
    assert.ok(Math.abs(p.porcao - (p.kg * f.porcao.g) / 1000) < 1e-9, 'custo por porção: ' + f.id);
    assert.ok(FONTES.includes(p.fonte), 'alimento sem fonte de preço pesquisada: ' + f.id);
    assert.ok(!('est' in p), 'preço estimado: ' + f.id);
    porFonte[p.fonte] = (porFonte[p.fonte] || 0) + 1;
    // fontes de proteína: vale o custo por 100 g de proteína; os demais: porção, corrigida pelo quilo
    if (fonteDeProteina(f)) { assert.ok(Math.abs(p.p100 - (10 * p.kg) / f.p) < 1e-9, 'p100: ' + f.id); assert.equal(p.faixa, nota(p.p100, LIMITES_PRECO.p100), f.id); }
    else {
      assert.equal(p.p100, null, f.id);
      const nk = nota(p.kg, LIMITES_PRECO.kg), np = nota(p.porcao, LIMITES_PRECO.porcao);
      assert.equal(p.faixa, nk - np >= 2 ? np + 1 : np - nk >= 2 ? np - 1 : np, f.id);
    }
    assert.deepEqual(calcularPreco(f), { ...p }, 'calcularPreco não reproduz: ' + f.id);
    cont[p.faixa]++;
  }
  for (const k of [1, 2, 3]) assert.ok(cont[k] >= COM_PRECO.length * 0.15, `faixa ${k} com poucos alimentos: ${cont[k]}`);
  // notícia (NT), atacado (CG) e conta de receita (RC) são último recurso: têm de ser minoria
  assert.ok((porFonte.NT || 0) + (porFonte.CG || 0) + (porFonte.RC || 0) <= COM_PRECO.length * 0.08, 'fontes de último recurso demais');
  const fx = (id) => FOOD.get(id).preco.faixa;
  for (const id of ['arroz-branco-cozido', 'feijao-carioca-cozido', 'ovo-cozido', 'peito-de-frango-grelhado', 'banana-prata', 'repolho-branco-cru', 'oleo-de-soja']) assert.equal(fx(id), 1, id);
  for (const id of ['patinho-grelhado', 'tilapia-grelhada', 'leite-integral', 'maca-fuji', 'azeite-de-oliva']) assert.equal(fx(id), 2, id);
  for (const id of ['file-mignon-grelhado', 'salmao-grelhado', 'camarao-cozido', 'castanha-de-caju', 'morango', 'iogurte-natural']) assert.equal(fx(id), 3, id);
});

test('cardápio com "mais baratos": respeita restrições, fecha as metas e mostra a faixa de cada item', () => {
  for (const restricoes of [['nenhuma'], ['vegetariano'], ['vegano'], ['sem_gluten'], ['sem_lactose'], ['vegano', 'sem_gluten'], ['vegetariano', 'sem_lactose']]) for (const objetivo of ['emagrecer', 'ganhar', 'manter']) for (const seed of [0, 3, 8]) {
    const r = calcular({ ...base, restricoes, objetivo, preco: 'barato' });
    const c = cardapio(r, seed);
    const rot = `${restricoes.join('+')}/${objetivo}/seed${seed}`;
    assert.ok(Math.abs(c.kcal - r.kcal) <= r.kcal * 0.1, `calorias longe da meta (${rot}): ${Math.round(c.kcal)} vs ${r.kcal}`);
    assert.ok(c.p >= r.prot * 0.85, `proteína abaixo de 85% (${rot}): ${Math.round(c.p)} vs ${r.prot}`);
    for (const ref of c.refeicoes) for (const it of ref.itens) {
      const f = FOOD.get(it.id);
      assert.equal(it.faixa, f.preco.faixa, 'item sem faixa de preço: ' + it.id);
      for (const t of restricoes) if (t !== 'nenhuma') assert.ok(f.tags.includes(t), `${it.id} fere ${t}`);
      if (!restricoes.includes('vegano')) assert.ok(f.preco.faixa <= 2, `alimento caro com "mais baratos" (${rot}): ${it.id}`);
    }
    // óleo de cozinha não aparece como alimento; com "mais baratos", nem o azeite (que é caro)
    assert.ok(!c.refeicoes.some((ref) => ref.itens.some((it) => /^oleo-|azeite|manteiga|margarina/.test(it.id) && ref.tipo === 'principal')), rot);
  }
});

test('lista de alimentos: grande variedade, de todos os grupos e faixas de preço', () => {
  assert.ok(ALIMENTOS.length >= 250, 'alimentos: ' + ALIMENTOS.length);
  const porCat = {};
  for (const f of COM_PRECO) { porCat[f.cat] = porCat[f.cat] || { n: 0, faixas: new Set() }; porCat[f.cat].n++; porCat[f.cat].faixas.add(f.preco.faixa); }
  for (const [cat, x] of Object.entries(porCat)) { assert.ok(x.n >= 10, `poucos alimentos em ${cat}: ${x.n}`); assert.ok(x.faixas.size >= 2, 'grupo com uma só faixa de preço: ' + cat); }
  // (os alimentos "só diário" — refrigerantes, salgados, doces — não contam: o cardápio nunca os usa)
  assert.ok(USADOS_EM_CASA.size >= ALIMENTOS.filter((f) => !f.soDiario).length * 0.8, 'o cardápio de casa sabe usar poucos alimentos: ' + USADOS_EM_CASA.size);
  for (const id of USADOS_EM_CASA) assert.ok(!FOOD.get(id).soDiario, 'alimento "só diário" entre os usados em casa: ' + id);
  for (const id of USADOS_EM_CASA) assert.ok(FOOD.has(id), 'grupo de casa com alimento inexistente: ' + id);
});

test('em casa: o cardápio usa só o que foi marcado, fecha as metas e diz o que falta', () => {
  const simples = ['arroz-branco-cozido', 'feijao-carioca-cozido', 'ovo-cozido', 'peito-de-frango-grelhado', 'banana-prata', 'alface-crespa', 'tomate', 'pao-frances', 'leite-integral', 'oleo-de-soja', 'macarrao-cozido', 'cenoura-cozida', 'cafe-sem-acucar', 'acucar-refinado'];
  for (const objetivo of ['emagrecer', 'ganhar', 'manter']) for (const refeicoes of ['3', '4', '5', '6']) for (const seed of [0, 1, 5]) {
    const r = calcular({ ...base, objetivo, refeicoes });
    const c = cardapio(r, seed, { emCasa: simples });
    const rot = `${objetivo}/${refeicoes}/seed${seed}`;
    for (const ref of c.refeicoes) for (const it of ref.itens) assert.ok(simples.includes(it.id), `alimento fora da lista de casa (${rot}): ${it.id}`);
    assert.ok(Math.abs(c.kcal - r.kcal) <= r.kcal * 0.12, `calorias longe da meta (${rot}): ${Math.round(c.kcal)} vs ${r.kcal}`);
    assert.ok(c.p >= r.prot * 0.85, `proteína abaixo de 85% (${rot}): ${Math.round(c.p)} vs ${r.prot}`);
    assert.deepEqual(c.faltas, [], 'despensa completa não deve acusar falta: ' + rot);
    // café e açúcar podem ser marcados, mas não entram no cardápio
    assert.ok(!c.refeicoes.some((ref) => ref.itens.some((it) => it.id === 'acucar-refinado' || it.id === 'cafe-sem-acucar')));
  }
  // sem fonte de proteína: avisa e sugere as mais baratas que respeitam as restrições
  const semProt = ['arroz-branco-cozido', 'feijao-carioca-cozido', 'banana-prata', 'alface-crespa', 'pao-frances'];
  const r = calcular(base);
  const c = cardapio(r, 0, { emCasa: semProt });
  const falta = c.faltas.find((f) => f.grupo === 'prot');
  assert.ok(falta && /proteína/.test(falta.texto) && falta.sugestoes.length === 2);
  assert.deepEqual(falta.sugestoes.map((s) => s.faixa), [1, 1], 'sugestões devem ser da faixa barata');
  assert.ok(c.faltas.some((f) => f.grupo === 'cafe_prot'));
  assert.ok(!c.faltas.some((f) => f.grupo === 'carbo' || f.grupo === 'fruta' || f.grupo === 'salada'));
  const vegano = cardapio(calcular({ ...base, restricoes: ['vegano'] }), 0, { emCasa: [...semProt, 'ovo-cozido', 'leite-integral', 'peito-de-frango-grelhado'] });
  for (const ref of vegano.refeicoes) for (const it of ref.itens) assert.ok(FOOD.get(it.id).tags.includes('vegano'), 'restrição ignorada em casa: ' + it.id);
  for (const f of vegano.faltas) for (const s of f.sugestoes) assert.ok(FOOD.get(s.id).tags.includes('vegano'), 'sugestão fere a restrição: ' + s.id);
  assert.ok(vegano.faltas.some((f) => f.grupo === 'prot'), 'ovo, leite e frango não contam para o vegano');
  // lista vazia ou inválida: sem refeições, com todas as faltas, sem erro
  for (const emCasa of [[], ['não-existe', 42, null]]) {
    const v = cardapio(r, 0, { emCasa });
    assert.equal(v.refeicoes.length, 0); assert.equal(v.kcal, 0);
    assert.ok(v.faltas.length >= 6);
    assert.equal(proximaSemente(r, 0, { emCasa }), null);
  }
  assert.equal(faltasDaCasa(r, simples, cardapio(r, 0, { emCasa: simples })).length, 0);
  // sem a lista (null), nada muda
  assert.equal(assinatura(cardapio(r, 2, { emCasa: null })), assinatura(cardapio(r, 2)));
  assert.equal(cardapio(r, 2).faltas, undefined);
  // poucos alimentos: "outra sugestão" avisa que não há alternativa
  assert.equal(proximaSemente(r, 0, { emCasa: ['arroz-branco-cozido', 'ovo-cozido'] }), null);
});

test('em casa: a lista salva é validada (só ids existentes, sem repetir, com limite)', async () => {
  const { limparEmCasa, MAX_EM_CASA } = await import('../www/js/logic/nutrition.js');
  assert.deepEqual(limparEmCasa(['ovo-cozido', 'ovo-cozido', 'nao-existe', 7, null, { id: 'x' }, '<img src=x onerror=alert(1)>', 'arroz-branco-cozido']), ['ovo-cozido', 'arroz-branco-cozido']);
  for (const lixo of [null, undefined, 'ovo-cozido', 42, {}, { length: 3 }]) assert.deepEqual(limparEmCasa(lixo), []);
  const todos = ALIMENTOS.map((f) => f.id);
  assert.equal(limparEmCasa([...todos, ...todos]).length, Math.min(todos.length, MAX_EM_CASA));
  const store = await import('../www/js/store.js');
  const s = store.sanitize({ nutri: { answers: base, emCasa: ['tofu', 'tofu', 'veneno', '__proto__'], soCasa: 'sim' } });
  assert.deepEqual(s.nutri.emCasa, ['tofu']);
  assert.equal(s.nutri.soCasa, false, 'só o booleano true liga o modo');
  assert.equal(store.sanitize({ nutri: { emCasa: ['tofu'], soCasa: true } }).nutri.soCasa, true);
  assert.deepEqual(store.sanitize({}).nutri.emCasa, []);
  assert.equal(store.sanitize({ nutri: { answers: { ...base, preco: 'barato' } } }).nutri.answers.preco, 'barato');
  assert.equal(store.sanitize({ nutri: { answers: { ...base, preco: 'grátis' } } }).nutri.answers.preco, undefined);
});

test('corrida: sem o resumo nada muda; com ele, energia e carboidrato acompanham o volume', async () => {
  const { limparCorrida, faixaCarboidrato, carboidratoNaCorrida, orientacaoCorrida } = await import('../www/js/logic/nutrition.js');
  const a = { ...base, objetivo: 'manter', peso: 70, altura: 175 };
  const sem = calcular(a);
  for (const nada of [null, undefined, {}, 'x', [], { kmSemana: 'muito' }, { kmSemana: 0, minSemana: 0, sessoesSemana: 0 }]) {
    assert.deepEqual(calcular(a, nada), sem, 'resumo vazio ou inválido não pode mudar as metas');
    assert.equal(orientacaoCorrida(calcular(a, nada)), null);
  }
  assert.equal(limparCorrida({ kmSemana: 1e9, minSemana: -5, sessoesSemana: 3.4, longoMin: NaN, prova: { distKm: '<script>', data: 'amanhã' }, proximaCorrida: { tipo: '<b>x</b>' } }).kmSemana, 300);
  assert.equal(limparCorrida({ kmSemana: 20, prova: { distKm: 'x' } }).prova, null);
  assert.deepEqual(limparCorrida({ kmSemana: 20, prova: { distKm: 10, data: '2026-12-01T08:00', semanasAte: 3 } }).prova, { distKm: 10, data: '2026-12-01', semanasAte: 3 });
  // pouco volume: o fator de atividade já cobre; muito volume: o gasto sobe (dia a dia + cerca de 1 kcal por kg por km)
  const pouco = calcular(a, { kmSemana: 15, minSemana: 100, sessoesSemana: 3, longoMin: 40, longoKm: 6 });
  assert.equal(pouco.kcal, sem.kcal);
  assert.equal(pouco.corrida.kcalDia, 150);
  const muito = calcular(a, { kmSemana: 70, minSemana: 420, sessoesSemana: 6, longoMin: 180, longoKm: 30 });
  const tmb = 9.99 * 70 + 6.25 * 175 - 4.92 * 30 + 5;
  assert.equal(muito.gasto, Math.round((tmb * 1.45 + 700) / 10) * 10);   // dia a dia sem treino (PAL 1,45) + 1 kcal por kg por km
  assert.ok(muito.kcal > sem.kcal && muito.fator <= 2.4);
  assert.ok(calcular(a, { kmSemana: 300, minSemana: 3000, sessoesSemana: 14 }).fator <= 2.4, 'teto do gasto');
  // carboidrato: faixas por minutos de corrida por dia (Burke 2011) e meta dentro da faixa quando as calorias permitem
  assert.deepEqual([100, 300, 600, 1500].map(faixaCarboidrato), [[3, 5], [5, 7], [6, 10], [8, 12]]);
  assert.ok(muito.corrida.carbKg >= muito.corrida.faixaCarb[0] - 0.1, 'carboidrato abaixo da faixa: ' + muito.corrida.carbKg);
  assert.ok((muito.gord * 9) / muito.kcal >= 0.19 && muito.prot === sem.prot, 'a gordura cede, mas não cai de 20%; a proteína não muda');
  assert.ok(Math.abs(muito.prot * 4 + muito.carb * 4 + muito.gord * 9 - muito.kcal) <= 25, 'macros fecham as calorias');
  // quem ainda não faz musculação mas corre conta como quem treina
  assert.ok(calcular({ ...a, treinos: '0' }, { kmSemana: 20, minSemana: 130, sessoesSemana: 3 }).prot > calcular({ ...a, treinos: '0' }).prot);
  // carboidrato durante, por duração (Jeukendrup 2014)
  assert.equal(carboidratoNaCorrida(30).gHora, null);
  assert.equal(carboidratoNaCorrida(60).gHora, null);
  assert.deepEqual(carboidratoNaCorrida(120).gHora, [30, 60]);
  assert.deepEqual(carboidratoNaCorrida(240).gHora, [60, 90]);
});

test('corrida: orientação por distância de prova, com travas de segurança', async () => {
  const { orientacaoCorrida } = await import('../www/js/logic/nutrition.js');
  const hoje = new Date('2026-11-13T10:00:00');
  const a = { ...base, objetivo: 'manter', peso: 70, altura: 175 };
  const resumo = (distKm, data, extra = {}) => ({ kmSemana: 40, minSemana: 260, sessoesSemana: 4, longoMin: 120, longoKm: 20, prova: { distKm, data, semanasAte: 2 }, ...extra });
  const texto = (o) => [...o.blocos.flatMap((b) => [b.titulo, ...b.linhas]), ...(o.prova ? [o.prova.titulo, ...o.prova.linhas] : [])];
  const semLixo = (s) => typeof s === 'string' && s.length > 0 && s.length <= 330 && !/undefined|NaN|null|Infinity|\[object|<|>/.test(s);
  const casos = { 5: ['5 km', false, false], 10: ['10 km', false, false], 21.1: ['meia maratona', true, true], 42.195: ['maratona', true, true] };
  for (const [km, [nome, carga, carbo]] of Object.entries(casos)) {
    const o = orientacaoCorrida(calcular(a, resumo(Number(km), '2026-11-27')), hoje);
    assert.equal(o.prova.titulo, 'Sua prova: ' + nome);
    assert.equal(o.prova.dias, 14);
    const t = o.prova.linhas.join(' ');
    assert.equal(/Carga de carboidrato/.test(t), carga, 'carga de carboidrato em ' + nome);
    assert.equal(/g de carboidrato por hora/.test(t), carbo, 'carboidrato durante em ' + nome);
    assert.ok(/conforme a sede/.test(t) && /Café da manhã da prova/.test(t) && /nada novo/.test(t), nome);
    for (const s of texto(o)) assert.ok(semLixo(s), s);
    for (const k of o.refs) assert.ok(REFS[k], 'referência inexistente: ' + k);
  }
  // maratona de 4 horas: 60 a 90 g por hora e aviso sobre beber demais
  const mar = orientacaoCorrida(calcular(a, resumo(42.195, '2026-11-14')), hoje);
  assert.ok(/A prova é amanhã/.test(mar.prova.linhas[0]) && /1 litro por hora/.test(mar.prova.linhas.join(' ')));
  assert.ok(/hiponatremia/.test(texto(mar).join(' ')) && /bananas-prata/.test(texto(mar).join(' ')), 'alternativas caseiras e alerta de hiponatremia');
  // bebida caseira: 0,5 a 0,9 g de sódio por litro nas esportivas; 1,5 g de sal dão 0,6 g (um quarto de colher de chá), não meia colher
  assert.ok(!/meia colher de chá de sal/.test(texto(mar).join(' ')));
  for (const s of texto(mar)) if (/Bebida caseira/.test(s)) assert.ok(s.includes('açúcar (60 g), um quarto de colher de chá de sal (1,5 g)'), s);
  assert.ok(/já passou/.test(orientacaoCorrida(calcular(a, resumo(10, '2026-11-01')), hoje).prova.linhas[0]));
  assert.equal(orientacaoCorrida(calcular(a, resumo(10, 'data inválida')), hoje).prova.dias, 14, 'sem data válida, usa as semanas informadas');
  assert.equal(orientacaoCorrida(calcular(a, { kmSemana: 20, minSemana: 120, sessoesSemana: 3 }), hoje).prova, null);
  // travas: menor de 18, gestante, doença renal — sem gramas; pressão alta — sem cafeína; diabetes — sem jejum
  for (const extra of [{ idade: 16 }, { condicoes: ['gestante'] }, { condicoes: ['renal'] }, { condicoes: ['transtorno'] }]) {
    const o = orientacaoCorrida(calcular({ ...a, ...extra }, resumo(42.195, '2026-11-27')), hoje);
    assert.ok(o.semNumeros);
    for (const s of texto(o)) assert.ok(!/\d+ (a \d+ )?g\b|mg por quilo|jejum/.test(s), 'modo educativo com número ou jejum: ' + s);
    assert.ok(!o.blocos.some((b) => b.titulo === 'Cafeína'));
  }
  assert.ok(!orientacaoCorrida(calcular({ ...a, condicoes: ['hipertensao'] }, resumo(21.1, '2026-11-27')), hoje).blocos.some((b) => b.titulo === 'Cafeína'));
  const diab = texto(orientacaoCorrida(calcular({ ...a, condicoes: ['diabetes'] }, resumo(21.1, '2026-11-27')), hoje)).join(' ');
  assert.ok(/Com diabetes, não corra em jejum/.test(diab) && !/pode ser em jejum/.test(diab));
});

test('corrida: o dia de exemplo chega perto também da meta de carboidrato, sem sair das calorias nem da proteína', async () => {
  const { faltaDeCarboidrato } = await import('../www/js/logic/nutrition.js');
  let n = 0, soma = 0, avisos = 0;
  for (const objetivo of ['manter', 'ganhar', 'emagrecer']) for (const restricoes of [['nenhuma'], ['vegetariano'], ['vegano'], ['sem_gluten'], ['sem_lactose']]) for (const refeicoes of ['3', '4', '5', '6']) for (const [sexo, peso, altura] of [['m', 70, 175], ['f', 58, 163], ['m', 85, 182]]) for (const km of [20, 40, 70]) for (const seed of [0, 1, 2, 3]) {
    const a = { ...base, objetivo, restricoes, refeicoes, sexo, peso, altura };
    const r = calcular(a, { kmSemana: km, minSemana: km * 6.5, sessoesSemana: 4, longoMin: 100, longoKm: 16 });
    const c = cardapio(r, seed);
    const rot = `${objetivo}/${restricoes}/${refeicoes}ref/${sexo}${peso}/${km}km/seed${seed}`;
    // (meta de mais de 850 kcal por refeição — ex.: 3.900 kcal em 3 refeições —: as porções de referência do IBGE não
    // fecham as calorias; o dia fica até 15% abaixo)
    const alta = r.kcal / Number(refeicoes) > 850;
    assert.ok(c.c >= r.carb * (alta ? 0.6 : 0.65), `carboidrato do cardápio abaixo de 65% da meta (${rot}): ${Math.round(c.c)} vs ${r.carb}`);
    assert.ok(alta ? c.kcal >= r.kcal * 0.85 && c.kcal <= r.kcal * 1.1 : Math.abs(c.kcal - r.kcal) <= r.kcal * 0.1, `calorias fora (${rot}): ${Math.round(c.kcal)} vs ${r.kcal}`);
    // (sem carne, com meta de proteína acima de 18% das calorias: 80% — soja e leguminosas nas porções de referência)
    const semCarne = restricoes.includes('vegano') || restricoes.includes('vegetariano');
    assert.ok(c.p >= r.prot * (semCarne && (r.prot * 4) / r.kcal >= 0.18 ? 0.8 : 0.85), `proteína fora (${rot}): ${Math.round(c.p)} vs ${r.prot}`);
    for (const ref of c.refeicoes) for (const it of ref.itens) { const f = FOOD.get(it.id); assert.ok(it.g <= Math.max(f.porcao.g * 3.01, 60) && it.g <= 420, `porção grande demais (${rot}): ${it.id} ${it.g} g`); for (const t of restricoes) if (t !== 'nenhuma') assert.ok(f.tags.includes(t), `${it.id} fere ${t}`); }
    // quando ainda falta mais de 10%, a tela ganha uma frase curta dizendo quanto falta e como completar
    const aviso = faltaDeCarboidrato(r, c);
    assert.equal(aviso != null, c.c < r.carb * 0.9, rot);
    if (aviso) { avisos++; assert.ok(/^Faltam cerca de \d+ g de carboidrato/.test(aviso) && aviso.length <= 160 && !/undefined|NaN/.test(aviso), aviso); if (restricoes.includes('sem_gluten')) assert.ok(!/pão/.test(aviso), aviso); }
    n++; soma += c.c / r.carb;
  }
  assert.ok(soma / n >= 0.93, 'média do carboidrato do cardápio: ' + Math.round((soma / n) * 100) + '% da meta');
  assert.ok(avisos < n * 0.08, 'avisos demais: ' + avisos + ' de ' + n);
  // sem corrida: nada muda e não há aviso
  const r0 = calcular(base);
  assert.equal(faltaDeCarboidrato(r0, cardapio(r0, 0)), null);
});

// ---------- achados da auditoria independente (quarta rodada) ----------
test('emagrecer só com indicação: perto do piso de IMC e depois dos 65 anos sem obesidade não há déficit', async () => {
  const { textosDoPeso } = await import('../www/js/logic/nutrition.js');
  const b = { ...base, objetivo: 'emagrecer', atividade: 'leve', treinos: '3' };
  // mulher de 25 anos, 51 kg, 1,65 m (IMC 18,7): perder 5% já cruzaria o IMC 18,5
  const perto = calcular({ ...b, sexo: 'f', idade: 25, peso: 51, altura: 165 });
  assert.equal(perto.modo, 'manutencao'); assert.equal(perto.kcal, perto.gasto); assert.equal(perto.perdaSemana, undefined);
  assert.ok(perto.avisos.some((x) => x.tipo === 'warn' && /perto do mínimo saudável/.test(x.texto)));
  // IMC 22: o déficit vem com o aviso de que não é necessidade de saúde e com o peso mínimo em quilos
  const saudavel = calcular({ ...b, sexo: 'f', idade: 25, peso: 60, altura: 165 });
  assert.equal(saudavel.objetivoCalc, 'emagrecer'); assert.ok(saudavel.kcal < saudavel.gasto);
  assert.ok(saudavel.avisos.some((x) => /faixa saudável/.test(x.texto) && /não baixe de 51 kg/.test(x.texto)));
  // IMC 30 ou mais, adulto: déficit sem aviso extra
  const obeso = calcular({ ...b, sexo: 'm', idade: 40, peso: 100, altura: 175 });
  assert.ok(obeso.kcal < obeso.gasto && !obeso.avisos.some((x) => /faixa saudável|65 anos/.test(x.texto)));
  // 65 anos ou mais: sem obesidade, manutenção; com obesidade, déficit de no máximo 500 kcal e aviso (ESPEN, recs. 79 a 82)
  const idoso = calcular({ ...b, sexo: 'm', idade: 70, peso: 82, altura: 172 });       // IMC 27,7
  assert.equal(idoso.objetivoCalc, 'manter'); assert.ok(idoso.avisos.some((x) => /Depois dos 65 anos, sem obesidade/.test(x.texto)));
  const idosoObeso = calcular({ ...b, sexo: 'm', idade: 70, peso: 100, altura: 170 });  // IMC 34,6
  assert.equal(idosoObeso.objetivoCalc, 'emagrecer'); assert.ok(idosoObeso.gasto - idosoObeso.kcal <= 500);
  assert.ok(idosoObeso.avisos.some((x) => x.tipo === 'warn' && /Depois dos 65 anos, emagrecer pede cuidado/.test(x.texto)));
  // 60 a 64 anos: vale o piso de IMC 22 (perto dele, sem déficit); acima, déficit com aviso até o IMC 27
  assert.equal(calcular({ ...b, sexo: 'f', idade: 62, peso: 58, altura: 160 }).objetivoCalc, 'manter');   // IMC 22,7
  assert.ok(calcular({ ...b, sexo: 'f', idade: 62, peso: 64, altura: 160 }).avisos.some((x) => /não baixe de 57 kg/.test(x.texto))); // IMC 25
  // a perda mostrada é a do déficit real: 7.700 kcal por quilo, e nunca mais de 1% do peso por semana
  for (const r of [saudavel, obeso, idosoObeso]) {
    const def = r.gasto - r.kcal;
    assert.equal(r.deficit, def); assert.ok(Math.abs(r.perdaSemana - (def * 7) / 7700) < 0.006); assert.ok(r.perdaSemana <= r.perdaMax + 0.02);
    assert.ok(new RegExp('^Com ' + String(def).replace(/\B(?=(\d{3})+(?!\d))/g, '\\.') + ' kcal a menos por dia').test(textosDoPeso(r).ritmo));
    assert.equal(r.ritmo, undefined);
  }
  // mulher de 75 anos, 55 kg, 1,50 m, sedentária: nada de "ritmo de perda" nem "reduza de 100 a 200 kcal"
  const s = calcular({ ...b, sexo: 'f', idade: 75, peso: 55, altura: 150, atividade: 'sedentario', treinos: '0' });
  const t = textosDoPeso(s);
  assert.equal(s.kcal, s.gasto); assert.equal(t.ritmo, null); assert.ok(!/reduza|perda esperada/.test(t.linhas.join(' ')));
  // gasto abaixo do piso com objetivo de emagrecer (adulta baixa e leve, sedentária): aviso único, sem ritmo
  const baixo = calcular({ ...b, sexo: 'f', idade: 45, peso: 60, altura: 145, atividade: 'sedentario', treinos: '0' });
  if (baixo.objetivoCalc === 'emagrecer' && baixo.gasto <= 1200) { assert.equal(textosDoPeso(baixo).ritmo, null); assert.ok(!/reduza/.test(textosDoPeso(baixo).linhas.join(' '))); }
  // ganhar massa continua com o ritmo esperado
  assert.ok(/Ritmo esperado: ganhar de/.test(textosDoPeso(calcular({ ...b, objetivo: 'ganhar' })).ritmo));
  assert.deepEqual(textosDoPeso(calcular({ ...b, idade: 15 })), { ritmo: null, linhas: [] });
  for (const k of ['jensen2013', 'volkert2022', 'helms2014']) assert.ok(REFS[k], k);
});

test('"mais baratos": nenhum alimento caro quando há um mais barato no mesmo grupo, inclusive no vegano', () => {
  let n = 0;
  for (const restricoes of [['nenhuma'], ['vegetariano'], ['vegano'], ['vegano', 'sem_gluten'], ['sem_lactose'], ['sem_gluten'], ['vegetariano', 'sem_lactose', 'sem_gluten']]) for (const objetivo of ['emagrecer', 'manter', 'ganhar']) for (const refeicoes of ['3', '4', '5', '6']) for (let seed = 0; seed < 12; seed++) {
    const r = calcular({ ...base, restricoes, objetivo, refeicoes, preco: 'barato' });
    const c = cardapio(r, seed); n++;
    for (const ref of c.refeicoes) for (const it of ref.itens) assert.ok(FOOD.get(it.id).preco.faixa <= 2, `alimento caro com "mais baratos" (${restricoes}/${objetivo}/${refeicoes}/seed${seed}): ${it.id}`);
    assert.ok(Math.abs(c.kcal - r.kcal) <= r.kcal * 0.1 && c.p >= r.prot * 0.85, `fora das metas (${restricoes}/${objetivo}/${refeicoes}/seed${seed})`);
  }
  assert.equal(n, 7 * 3 * 4 * 12);
});

test('corrida: textos sem "1 semanas", sem "h 60", géis que cabem no total e motivo certo do carboidrato baixo', async () => {
  const { orientacaoCorrida, fmtDuracao } = await import('../www/js/logic/nutrition.js');
  const hoje = new Date('2026-11-13T12:00:00');
  const dia = (n) => new Date(hoje.getTime() + n * 86400000).toISOString().slice(0, 10);
  const resumo = (km, ritmo, dist, dias) => ({ kmSemana: km, minSemana: Math.round(km * ritmo), sessoesSemana: 4, longoKm: Math.round(km * 0.35), longoMin: Math.round(km * 0.35 * ritmo), prova: dist ? { distKm: dist, data: dia(dias), semanasAte: dias / 7 } : null });
  const a = { ...base, objetivo: 'manter', peso: 70, altura: 175, treinos: '0' };
  const linhas = (o) => [...o.blocos.flatMap((b) => b.linhas), ...(o.prova ? o.prova.linhas : [])];
  // (a) de 8 a 13 dias a contagem é em dias; a partir de 14, em semanas (2 ou mais)
  for (const [dias, esperado] of [[2, /Faltam 2 dias/], [8, /Faltam 8 dias/], [10, /Faltam 10 dias/], [13, /Faltam 13 dias/], [14, /Faltam cerca de 2 semanas/], [45, /Faltam cerca de 6 semanas/]]) {
    const l = orientacaoCorrida(calcular(a, resumo(40, 6, 21.1, dias)), hoje).prova.linhas[0];
    assert.ok(esperado.test(l) && !/ 1 semanas/.test(l), `${dias} dias: ${l}`);
  }
  // (b) duração arredondada antes de separar horas e minutos
  assert.deepEqual([44, 58, 59, 60, 65, 118, 119, 122, 299].map(fmtDuracao), ['45 min', '1 h', '1 h', '1 h', '1 h 05', '2 h', '2 h', '2 h', '5 h']);
  for (let m = 1; m <= 900; m++) assert.ok(!/ 60$|h 0$/.test(fmtDuracao(m)), fmtDuracao(m));
  // (c) um gel tem de 20 a 30 g (AIS): a conta de exemplo usa 25 g e cabe no total indicado
  let comGel = 0;
  for (const km of [30, 50, 80]) for (const ritmo of [4.5, 5.5, 6.5, 7.5]) for (const dist of [10, 21.1, 42.2]) {
    const txt = linhas(orientacaoCorrida(calcular(a, resumo(km, ritmo, dist, 5)), hoje)).join(' ');
    assert.ok(!/30 g de carboidrato são 1 gel/.test(txt));
    const m = /No total, de (\d+) a (\d+) g: por exemplo, (?:(\d+) a )?(\d+) g[eé](?:l|is) de 25 g/.exec(txt);
    if (!m) continue;
    comGel++;
    const de = Number(m[1]), ate = Number(m[2]), nDe = Number(m[3] || m[4]), nAte = Number(m[4]);
    assert.ok(nAte * 25 <= ate && (nDe * 25 >= de || nDe === 1) && nDe <= nAte, m[0]);
  }
  assert.ok(comGel >= 12, 'casos com géis: ' + comGel);
  // treino longo de mais de 75 minutos: a linha do gel dá a faixa da fonte e as alternativas de comida comum
  assert.ok(/Um gel tem de 20 a 30 g de carboidrato. Mais barato, 30 g são [^.]*bananas-prata/.test(linhas(orientacaoCorrida(calcular(a, resumo(80, 6.5, 0, 0)), hoje)).join(' ')));
  assert.ok(REFS.ais_gel);
  // (d) carboidrato abaixo da faixa: "redução de calorias" só para quem está em déficit
  const leve = { ...base, sexo: 'f', peso: 55, altura: 163, atividade: 'sedentario', treinos: '0' };
  for (const objetivo of ['manter', 'ganhar', 'emagrecer']) {
    const r = calcular({ ...leve, objetivo }, resumo(40, 6, 0, 0));
    const txt = linhas(orientacaoCorrida(r, hoje)).join(' ');
    if (r.corrida.carbKg < r.corrida.faixaCarb[0]) assert.equal(/por causa da redução de calorias/.test(txt), r.objetivoCalc === 'emagrecer', objetivo + ': ' + txt.slice(0, 260));
    if (r.objetivoCalc !== 'emagrecer') assert.ok(!/redução de calorias/.test(txt), objetivo);
  }
  // diabetes: no bloco da prova não há gramas de carga, de café da manhã nem total; há a orientação de combinar com o médico
  for (const dist of [21.1, 42.2]) {
    const o = orientacaoCorrida(calcular({ ...a, condicoes: ['diabetes'] }, resumo(60, 6.5, dist, 5)), hoje);
    const p = o.prova.linhas.join(' ');
    assert.ok(/Com diabetes, não faça carga de carboidrato por conta própria/.test(p) && /médico ou nutricionista/.test(p), p);
    assert.ok(!/10 a 12 g|\d+ g\)|\d+ a \d+ g de carboidrato|No total, de/.test(p), 'gramas no bloco da prova com diabetes: ' + p);
  }
  // sem diabetes, a carga continua com os números
  assert.ok(/10 a 12 g por quilo/.test(orientacaoCorrida(calcular(a, resumo(60, 6.5, 42.2, 5)), hoje).prova.linhas.join(' ')));
});

test('suplementos: sem doses no modo educativo e sem dose de cafeína com pressão alta', async () => {
  const { suplementos } = await import('../www/js/logic/nutrition.js');
  const dose = /\d+ ?(a \d+ ?)?(g|mg)\b/;
  for (const a of [{ idade: 16 }, { condicoes: ['gestante'] }, { condicoes: ['renal'] }, { condicoes: ['transtorno'] }, { condicoes: ['renal', 'hipertensao'] }]) {
    const r = calcular({ ...base, ...a });
    assert.equal(r.modo, 'educativo');
    const s = suplementos(r);
    assert.equal(s.semDoses, true); assert.equal(s.linhas.length, 0);
    assert.ok(!dose.test(s.intro + ' ' + s.aviso), 'dose no modo educativo: ' + s.aviso);
    assert.ok(/médico ou nutricionista/.test(s.aviso) && s.aviso.length <= 260);
  }
  const normal = suplementos(calcular(base));
  assert.equal(normal.semDoses, false);
  assert.ok(/3 a 5 g/.test(normal.linhas[0]) && /200 mg/.test(normal.linhas[1]) && /Não use sem orientação médica/.test(normal.aviso));
  const hipertenso = suplementos(calcular({ ...base, condicoes: ['hipertensao'] }));
  assert.ok(/3 a 5 g/.test(hipertenso.linhas[0]) && /pressão alta, não use/.test(hipertenso.linhas[1]) && !dose.test(hipertenso.linhas[1]));
  assert.equal(suplementos(null).semDoses, true);
  for (const k of ['kreider2017', 'guest2021', 'efsa2015']) assert.ok(REFS[k], k);
});

test('pratos prontos: o custo sai da receita da TACO, com preços pesquisados, e se reproduz', async () => {
  const { RECEITAS, INSUMOS, custoDaReceita, precoDeCompra } = await import('../www/js/data/foods.js');
  // custo por quilo de prato pronto conferido à mão com os preços de novembro de 2026
  const custo2026 = { 'canjica-com-leite': 4.54, 'macarrao-a-bolonhesa': 6.62, 'baiao-de-dois': 5.12, 'feijao-tropeiro': 26.64, feijoada: 10.25, 'estrogonofe-de-carne': 72.11, 'estrogonofe-de-frango': 39.22, 'omelete-de-queijo': 23.56 };
  const esperada = { 'canjica-com-leite': 1, 'macarrao-a-bolonhesa': 2, 'baiao-de-dois': 2, 'feijao-tropeiro': 3, feijoada: 1, 'estrogonofe-de-carne': 3, 'estrogonofe-de-frango': 2, 'omelete-de-queijo': 2 };
  assert.deepEqual(Object.keys(RECEITAS).sort(), Object.keys(esperada).sort());
  assert.deepEqual(COM_PRECO.filter((f) => f.preco.fonte === 'RC').map((f) => f.id).sort(), Object.keys(esperada).sort());
  for (const [id, r] of Object.entries(RECEITAS)) {
    const f = FOOD.get(id);
    assert.ok(f && r.rende > 0 && r.ing.length >= 3, id);
    let custo = 0, quilos = 0;
    for (const [k, kg] of r.ing) {
      assert.ok(kg > 0, id + ': ' + k);
      const ing = FOOD.get(k);
      // cada ingrediente tem preço pesquisado: um insumo com fonte, ou um alimento da tabela que não é outra receita
      assert.ok(typeof INSUMOS[k] === 'number' ? INSUMOS[k] > 0 : ing && ing.preco.fonte !== 'RC', `ingrediente sem preço pesquisado em ${id}: ${k}`);
      custo += kg * (INSUMOS[k] ?? precoDeCompra(k));
      quilos += kg;
    }
    assert.ok(Math.abs(custo / r.rende - custoDaReceita(id)) < 0.011, `${id}: ${custo / r.rende} vs ${custoDaReceita(id)}`);
    assert.equal(f.preco.kg, custoDaReceita(id), id);
    assert.ok(Math.abs(custoDaReceita(id) - custo2026[id]) <= 0.02, `custo de ${id}: ${custoDaReceita(id)}`);
    // o rendimento é plausível: de 0,6 a 3,5 vezes o peso dos ingredientes (frituras perdem água; grãos e massas absorvem)
    assert.ok(r.rende >= quilos * 0.6 && r.rende <= quilos * 3.5, `rendimento estranho em ${id}: ${r.rende} kg de ${quilos.toFixed(2)} kg`);
    assert.equal(f.preco.faixa, esperada[id], 'faixa de ' + id);
  }
  // feijão-tropeiro e feijoada: energia como a TACO publica (linhas 539 e 540)
  assert.equal(FOOD.get('feijao-tropeiro').kcal, 152); assert.equal(FOOD.get('feijoada').kcal, 117);
});

test('em casa: a sugestão do que comprar nunca é um alimento já marcado', () => {
  const r = calcular({ ...base, restricoes: ['vegano'], objetivo: 'ganhar', peso: 95, altura: 185, treinos: '6' });
  // despensa com as duas fontes de proteína mais baratas, mas pouca coisa para fechar a proteína do dia
  const emCasa = ['soja-cozida', 'proteina-de-soja-texturizada', 'pasta-de-amendoim', 'arroz-branco-cozido', 'banana-prata', 'alface-crespa'];
  for (let seed = 0; seed < 6; seed++) {
    const c = cardapio(r, seed, { emCasa });
    for (const f of c.faltas) for (const s of f.sugestoes) assert.ok(!emCasa.includes(s.id), `sugere o que já está marcado (${f.grupo}): ${s.id}`);
  }
  const tudo = faltasDaCasa(r, emCasa, { p: 10, kcal: 500 });
  assert.ok(tudo.some((f) => f.grupo === 'proteina') && tudo.every((f) => f.sugestoes.every((s) => !emCasa.includes(s.id))));
});

// ---------- sétima rodada: o que as outras entrevistas dizem vale também na Nutricionista ----------
test('contexto das entrevistas: menor de 18, gestação, pós-parto e doença renal em QUALQUER entrevista tiram metas e déficit', async () => {
  const { contextoDasEntrevistas, suplementos, textosDoPeso } = await import('../www/js/logic/nutrition.js');
  const { modoDoDiario, metaDoDia, resumoDeHoje } = await import('../www/js/logic/diario.js');
  const ESCONDIDOS = ['kcal', 'prot', 'carb', 'gord', 'gkg', 'fibra', 'protRefeicao', 'objetivoCalc', 'ritmo', 'deficit', 'perdaSemana', 'perdaMax', 'piso'];
  const ONDE = { treinador: 'ao Treinador', corrida: 'ao Treinador de corrida', sono: 'na tela do sono' };
  const estados = [];
  // cada condição protegida × cada entrevista de origem
  for (const [chave, origem] of [['trainer', 'treinador'], ['run', 'corrida']]) {
    for (const [id, nome] of [['gestante', 'gestação'], ['posparto', 'pós-parto'], ['renal', 'doença nos rins']]) estados.push({ k: id, origem, st: { [chave]: { answers: { idade: 30, condicoes: [id] } } }, aviso: `Você informou ${nome} ${ONDE[origem]}, mas não aqui.` });
    for (const idade of [8, 12, 15, 17]) estados.push({ k: 'idade', origem, st: { [chave]: { answers: { idade, condicoes: ['nenhuma'] } } }, aviso: `Você informou ${idade} anos ${ONDE[origem]} e 30 aqui. Por segurança, vale a menor idade` });
  }
  for (const idade of [6, 14, 17]) estados.push({ k: 'idade', origem: 'sono', st: { sono: { idade } }, aviso: `Você informou ${idade} anos na tela do sono e 30 aqui.` });
  let n = 0;
  for (const { k, origem, st, aviso } of estados) for (const objetivo of ['emagrecer', 'manter', 'ganhar']) for (const [sexo, peso, altura] of [['f', 60, 165], ['f', 95, 160], ['m', 80, 178], ['m', 120, 175]]) {
    const a = { ...base, objetivo, sexo, peso, altura, idade: 30 };
    const livre = calcular(a);
    assert.notEqual(livre.modo, 'educativo');
    const r = calcular(a, null, contextoDasEntrevistas(st));
    const rot = `${k} ${origem} ${objetivo} ${sexo}${peso}`;
    n++;
    assert.equal(r.modo, 'educativo', rot);
    for (const campo of ESCONDIDOS) assert.equal(r[campo], undefined, `${rot}: o modo educativo não mostra ${campo}`);
    assert.deepEqual(r.protecoes, [{ k, origem }], rot);
    assert.ok(r.avisos.some((x) => x.tipo === 'info' && x.texto.startsWith(aviso) && /confira as entrevistas\.$/.test(x.texto) && x.texto.length <= 200), `${rot}: aviso de onde veio — ${r.avisos.map((x) => x.texto.slice(0, 50)).join(' | ')}`);
    assert.ok(r.avisos.some((x) => x.tipo !== 'info'), rot + ': o modo educativo explica o motivo');
    // nada adiante mostra número ou déficit
    assert.equal(cardapio(r, 0), null, rot); assert.equal(emVoltaDoTreino(r).semNumeros, true, rot); assert.equal(suplementos(r).semDoses, true, rot);
    assert.deepEqual(textosDoPeso(r), { ritmo: null, linhas: [] }, rot);
    assert.equal(modoDoDiario(r), k === 'idade' ? 'alimentos' : 'soma', rot);
    if (k === 'idade') assert.ok(r.idade < 18, rot);
    // o diário e o Início enxergam a mesma proteção
    const estado = { ...st, nutri: { answers: a }, diario: { dias: [] } };
    const meta = metaDoDia(estado, '2026-11-16');
    assert.equal(meta.modo, 'educativo', rot); assert.equal(meta.kcal, undefined, rot);
    const ini = resumoDeHoje(estado, '2026-11-16');
    assert.equal(ini.metaKcal, null, rot); assert.equal(ini.difKcal, null, rot); assert.equal(ini.modo, k === 'idade' ? 'alimentos' : 'soma', rot);
  }
  assert.equal(n, estados.length * 3 * 4);
  // diabetes e pressão alta vindos de outra entrevista: manutenção (sem déficit) e as orientações de sal e cafeína
  for (const [chave, origem] of [['trainer', 'treinador'], ['run', 'corrida']]) {
    const d = calcular({ ...base, objetivo: 'emagrecer' }, null, contextoDasEntrevistas({ [chave]: { answers: { condicoes: ['diabetes'] } } }));
    assert.equal(d.modo, 'manutencao'); assert.equal(d.kcal, d.gasto); assert.equal(d.perdaSemana, undefined); assert.deepEqual(d.protecoes, [{ k: 'diabetes', origem }]);
    assert.ok(d.avisos.some((x) => /hipoglicemia/.test(x.texto)) && d.avisos.some((x) => x.texto.startsWith(`Você informou diabetes ${ONDE[origem]}, mas não aqui.`)));
    const h = calcular(base, null, contextoDasEntrevistas({ [chave]: { answers: { condicoes: ['hipertensao'] } } }));
    assert.ok(h.avisos.some((x) => /sal a 5 g/.test(x.texto)) && /pressão alta, não use/.test(suplementos(h).linhas[1]) && h.condicoes.includes('hipertensao'));
  }
});

test('contexto das entrevistas: sem contexto (ou concordando com a Nutricionista) o resultado é idêntico; contradição pede conferência', async () => {
  const { contextoDasEntrevistas, PERGUNTAS: P } = await import('../www/js/logic/nutrition.js');
  const op = (k) => P.find((q) => q.k === k).op.map((o) => o[0]);
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const um = (l) => l[Math.floor(rnd() * l.length)];
  const vazios = [undefined, null, {}, [], 'x', 5, { idades: 'x', condicoes: 7 }, { idades: [null, 5, { valor: 'a', origem: 'treinador' }, { valor: 15, origem: 'padaria' }, { valor: 999, origem: 'sono' }], condicoes: [{ id: 'asma', origem: 'corrida' }, { id: 'gestante', origem: 'vizinha' }, { id: '__proto__', origem: 'corrida' }, null] },
    contextoDasEntrevistas(null), contextoDasEntrevistas({}), contextoDasEntrevistas({ trainer: 'x', run: [], sono: 7 }), contextoDasEntrevistas({ trainer: { answers: { idade: 'quinze', condicoes: 'gestante' } }, run: { answers: { idade: NaN, condicoes: [7, null, 'xpto', '__proto__'] } }, sono: { idade: -2 } })];
  for (let i = 0; i < 3000; i++) {
    const a = { objetivo: um(op('objetivo')), sexo: um(op('sexo')), idade: 10 + Math.floor(rnd() * 90), peso: 35 + Math.round(rnd() * 150), altura: 130 + Math.round(rnd() * 80), atividade: um(op('atividade')), treinos: um(op('treinos')), horario: um(op('horario')), refeicoes: um(op('refeicoes')), restricoes: [um(op('restricoes'))], condicoes: [um(op('condicoes'))] };
    const cor = rnd() < 0.3 ? { kmSemana: Math.round(rnd() * 80), minSemana: Math.round(rnd() * 500), sessoesSemana: 4, longoKm: 15, longoMin: 100 } : null;
    const antes = calcular(a, cor);
    assert.deepEqual(calcular(a, cor, um(vazios)), antes, 'sem contexto válido, nada muda: ' + JSON.stringify(a));
    // outras entrevistas dizendo o mesmo (mesma idade, ou 1 ano de diferença; mesmas condições): nada muda
    const cond = a.condicoes.filter((c) => ['gestante', 'renal', 'diabetes', 'hipertensao'].includes(c));
    const igual = contextoDasEntrevistas({ trainer: { answers: { idade: a.idade, condicoes: cond } }, run: { answers: { idade: Math.min(99, a.idade + 1), condicoes: cond.length ? cond : ['nenhuma'] } }, sono: { idade: a.idade } });
    assert.deepEqual(calcular(a, cor, igual), antes, 'contexto que concorda não muda nada: ' + JSON.stringify(a));
  }
  // o levantamento: a idade de cada entrevista e só as condições que a Nutricionista trata
  assert.deepEqual(contextoDasEntrevistas({ trainer: { answers: { idade: 31.9, condicoes: ['hipertensao', 'cronica'] } }, run: { answers: { idade: 16, condicoes: ['gestante', 'hipertensao', 'cardiaco'] } }, sono: { idade: 16 }, nutri: { answers: { idade: 99, condicoes: ['renal'] } } }),
    // (outra doença crônica e coração também chegam: tiram a dose de cafeína — ver o teste da união das entrevistas)
    { idades: [{ valor: 31, origem: 'treinador' }, { valor: 16, origem: 'corrida' }, { valor: 16, origem: 'sono' }], condicoes: [{ id: 'hipertensao', origem: 'treinador' }, { id: 'outra', origem: 'treinador' }, { id: 'gestante', origem: 'corrida' }, { id: 'cardiaco', origem: 'corrida' }] });
  // contradições: vale o mais protegido e a tela pede para conferir
  const r = calcular({ ...base, idade: 30 }, null, contextoDasEntrevistas({ trainer: { answers: { idade: 15 } }, run: { answers: { idade: 12 } } }));
  assert.equal(r.modo, 'educativo'); assert.equal(r.idade, 12, 'vale a menor idade informada');
  assert.ok(r.avisos.some((x) => x.texto === 'Você informou 12 anos ao Treinador de corrida e 30 aqui. Por segurança, vale a menor idade: confira as entrevistas.'));
  // menor na Nutricionista e adulto em outra: continua menor (o mais protegido), com o pedido de conferência
  const m = calcular({ ...base, idade: 16, peso: 60, altura: 170 }, null, contextoDasEntrevistas({ trainer: { answers: { idade: 30 } } }));
  assert.equal(m.modo, 'educativo'); assert.equal(m.idade, 16); assert.equal(m.protecoes, undefined);
  assert.ok(m.avisos.some((x) => x.texto === 'As idades informadas não batem: 16 anos aqui e 30 ao Treinador. Confira as entrevistas.'));
  // adultos com idades diferentes: a conta não muda, mas pede conferência; 1 ano de diferença não é contradição
  const dif = calcular(base, null, contextoDasEntrevistas({ run: { answers: { idade: 52 } } }));
  assert.deepEqual({ ...dif, avisos: [] }, { ...calcular(base), avisos: [] }); assert.ok(dif.avisos.some((x) => /^As idades informadas não batem: 30 anos aqui e 52 ao Treinador de corrida\./.test(x.texto)));
  assert.deepEqual(calcular(base, null, contextoDasEntrevistas({ trainer: { answers: { idade: 31 } } })), calcular(base));
  // gestação marcada aqui e também na corrida: nenhuma linha a mais; pós-parto na corrida com gestação aqui: idem
  const g = { ...base, condicoes: ['gestante'] };
  assert.deepEqual(calcular(g, null, contextoDasEntrevistas({ run: { answers: { idade: 30, condicoes: ['gestante', 'posparto'] } } })), calcular(g));
  // todo aviso novo é curto e sem lixo
  for (const st of [{ trainer: { answers: { idade: 9, condicoes: ['gestante', 'diabetes', 'hipertensao'] } }, run: { answers: { idade: 130, condicoes: ['renal', 'posparto'] } }, sono: { idade: 6 } }]) {
    const x = calcular(base, null, contextoDasEntrevistas(st));
    assert.equal(x.modo, 'educativo'); assert.deepEqual(x.protecoes.map((p) => p.k), ['idade', 'gestante', 'diabetes', 'hipertensao', 'renal'], 'pós-parto não repete a gestação');
    for (const av of x.avisos) assert.ok(av.texto.length <= 330 && !/undefined|NaN|null|\[object/.test(av.texto), av.texto);
  }
});

// ---------- perguntas novas ou mudadas: cada opção tem efeito ----------
test('alergia alimentar: cada opção tira os alimentos que têm aquilo e mostra o aviso do rótulo; "nenhuma" e a falta da resposta não mudam nada', async () => {
  const { alergenosDe } = await import('../www/js/data/foods.js');
  const q = PERGUNTAS.find((x) => x.k === 'alergias');
  assert.ok(q && q.opcional && q.nenhum === 'nenhuma');
  assert.deepEqual(q.op.map((o) => o[0]), ['amendoim', 'castanhas', 'peixe', 'ovo', 'leite', 'soja', 'nenhuma']);
  assert.ok(respostasCompletas(base), 'entrevistas salvas sem a pergunta continuam completas');
  const sem = calcular({ ...base, objetivo: 'ganhar' });
  assert.deepEqual(calcular({ ...base, objetivo: 'ganhar', alergias: ['nenhuma'] }), sem);
  const ids = (c) => c.refeicoes.flatMap((r) => r.itens.map((i) => i.id));
  for (const [al] of q.op.filter((o) => o[0] !== 'nenhuma')) {
    const r = calcular({ ...base, objetivo: 'ganhar', alergias: [al] });
    assert.deepEqual(r.alergias, [al]);
    assert.ok(r.avisos.some((x) => x.alergia && /rótulo/.test(x.texto)), al);
    // em várias sementes, o cardápio de quem não tem alergia usa o alergênico, e o de quem tem, nunca
    let antes = 0;
    for (let s = 0; s < 30; s++) {
      antes += ids(cardapio(sem, s)).filter((id) => alergenosDe(id).includes(al)).length;
      assert.ok(ids(cardapio(r, s)).every((id) => !alergenosDe(id).includes(al)), `${al}: semente ${s}`);
    }
    if (al !== 'castanhas' && al !== 'amendoim') assert.ok(antes > 0, 'o cardápio comum deveria usar ' + al);
  }
});

test('vegano: o aviso da intolerância à lactose não se repete (o cardápio já não tem leite)', () => {
  const tem = (r) => r.avisos.some((x) => /Intolerância à lactose/.test(x.texto));
  assert.ok(tem(calcular({ ...base, restricoes: ['sem_lactose'] })));
  assert.ok(!tem(calcular({ ...base, restricoes: ['vegano', 'sem_lactose'] })));
  // com alergia ao leite, a dica das versões sem lactose seria perigosa
  assert.ok(!tem(calcular({ ...base, restricoes: ['sem_lactose'], alergias: ['leite'] })));
});

test('horário do treino: só para quem treina; quem não treina recebe a regra geral', () => {
  const q = PERGUNTAS.find((x) => x.k === 'horario');
  assert.ok(!q.se({ treinos: '0' }));
  const naoTreina = { ...base, treinos: '0' };
  delete naoTreina.horario;
  assert.ok(respostasCompletas(naoTreina), 'sem a pergunta, as respostas estão completas');
  assert.equal(calcular(naoTreina).horario, 'varia');
  // resposta antiga de quem não treina, com "à noite": vale a regra geral
  assert.equal(calcular({ ...base, treinos: '0', horario: 'noite' }).horario, 'varia');
  assert.match(emVoltaDoTreino(calcular({ ...base, treinos: '0', horario: 'noite' })).horario, /Regra geral/);
  assert.equal(calcular(base).horario, 'noite');
});

test('condição "Coração, circulação ou AVC" na Nutricionista: tira a dose de cafeína', async () => {
  const { suplementos } = await import('../www/js/logic/nutrition.js');
  const q = PERGUNTAS.find((x) => x.k === 'condicoes');
  assert.equal(q.op.find((o) => o[0] === 'cardiaco')[1], 'Coração, circulação ou AVC');
  assert.match(suplementos(calcular(base)).linhas[1], /3 mg/);
  assert.ok(!/3 mg/.test(suplementos(calcular({ ...base, condicoes: ['cardiaco'] })).linhas[1]));
});

test('nada inviável no cardápio: óleo de cozinha, manteiga e margarina não vêm no prato; o azeite vem "na salada"; amendoim cru e polpa sem preparo, não', () => {
  const todaCasa = [...USADOS_EM_CASA, 'oleo-de-soja', 'oleo-de-girassol', 'oleo-de-milho', 'oleo-de-canola', 'margarina-com-sal', 'manteiga-com-sal', 'amendoim-cru'];
  const casas = [null, todaCasa, todaCasa.filter((id) => id !== 'azeite-de-oliva')];
  let azeite = 0;
  for (const preco of ['barato', 'tanto_faz']) for (const restricoes of [['nenhuma'], ['vegano'], ['sem_lactose']]) for (const refeicoes of ['3', '6']) {
    const r = calcular({ ...base, preco, restricoes, refeicoes });
    for (const emCasa of casas) for (let s = 0; s < 10; s++) for (const ref of cardapio(r, s, { emCasa }).refeicoes) for (const it of ref.itens) {
      assert.ok(!/^oleo-de-|^amendoim-cru$/.test(it.id), `${it.id} no cardápio (${preco}, ${restricoes}, ${ref.tipo})`);
      if (ref.tipo === 'principal') assert.ok(!/manteiga|margarina/.test(it.id), `${it.id} no prato`);
      if (it.id === 'azeite-de-oliva') { azeite++; assert.match(it.medida, /na salada\)$/); assert.ok(preco !== 'barato' || emCasa, 'azeite com "mais baratos"'); }
      if (/^polpa-de|acai-polpa/.test(it.id)) assert.match(it.medida, /batida/);
      if (/^leite-em-po/.test(it.id)) assert.match(it.medida, /dissolvido em água/);
    }
  }
  assert.ok(azeite > 0, 'o azeite da salada sumiu');
  // sem azeite em casa, o prato não tem gordura de cozinha à parte
  const r = calcular({ ...base, preco: 'tanto_faz' });
  for (let s = 0; s < 10; s++) assert.ok(!cardapio(r, s, { emCasa: casas[2] }).refeicoes.some((ref) => ref.itens.some((it) => it.id === 'azeite-de-oliva')));
});

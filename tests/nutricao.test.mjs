// Testes da Nutricionista: cálculos, travas de segurança e cardápio para muitos perfis.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTOS } from '../www/js/data/foods.js';
import { PERGUNTAS, respostasCompletas, calcular, cardapio, emVoltaDoTreino, imcFaixa } from '../www/js/logic/nutrition.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));
const base = { objetivo: 'emagrecer', sexo: 'm', idade: 30, peso: 80, altura: 178, atividade: 'sedentario', treinos: '3', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };

test('perguntas completas e validação', () => {
  assert.ok(respostasCompletas(base));
  assert.ok(!respostasCompletas({ ...base, sexo: 'x' }));
  for (const q of PERGUNTAS) assert.ok(q.titulo.endsWith('?'));
});

test('equação de Mifflin-St Jeor confere com o cálculo manual', () => {
  const r = calcular({ ...base, objetivo: 'manter' });
  const tmb = 10 * 80 + 6.25 * 178 - 5 * 30 + 5; // 1767,5
  assert.equal(r.tmb, Math.round(tmb / 10) * 10);
  assert.equal(r.gasto, Math.round((tmb * 1.375) / 10) * 10); // sedentário + 3 treinos
  assert.equal(r.kcal, r.gasto);
  const f = calcular({ ...base, sexo: 'f', peso: 60, altura: 165, idade: 40, objetivo: 'manter' });
  assert.equal(f.tmb, Math.round((10 * 60 + 6.25 * 165 - 5 * 40 - 161) / 10) * 10);
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
    const pesoRef = r.imc > 30 ? 25 * (altura / 100) ** 2 : peso; // com obesidade, a referência é o peso de IMC 25
    assert.ok(r.prot / pesoRef >= 0.95, `proteína muito baixa: ${rot} = ${r.prot}`);
    if (idade >= 65 && r.imc <= 30) assert.ok(r.prot / peso >= 1.15, 'idoso com menos de 1,2 g/kg: ' + rot);
    const kcalMacros = r.prot * 4 + r.carb * 4 + r.gord * 9;
    assert.ok(Math.abs(kcalMacros - r.kcal) <= r.kcal * 0.06 + 40, `macros não fecham com as calorias: ${rot} (${kcalMacros} vs ${r.kcal})`);
    const pctGord = (r.gord * 9) / r.kcal;
    assert.ok(pctGord >= 0.17 && pctGord <= 0.42, `gordura fora de faixa: ${rot} = ${Math.round(pctGord * 100)}%`);
    assert.ok(r.carb >= 50, 'carboidrato baixo demais: ' + rot);
    assert.ok(r.fibra >= 25);
    assert.ok(r.agua >= 1.5 && r.agua <= 5);
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
        assert.ok(f.nova <= 3 || ['leite-de-soja', 'proteina-de-soja-texturizada', 'pao-de-forma-integral'].includes(f.id), `ultraprocessado no cardápio: ${it.id}`);
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

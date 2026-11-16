// Testes do cardápio de cada dia (semente pela data), das trocas de refeição, da lista de compras da semana e do
// bloco "Hoje" da Nutricionista (o que comer em volta dos treinos do dia).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTOS } from '../www/js/data/foods.js';
import * as store from '../www/js/store.js';
import { PERGUNTAS as P_CORRIDA, respostasCompletas as corridaOk } from '../www/js/logic/corrida.js';
import {
  calcular, cardapio, assinatura, sementeDoDia, cardapioDoDia, outraSugestaoDoDia, trocarRefeicaoDoDia, limparAjuste, limparAjustes,
  listaDeCompras, textoDaListaDeCompras, nomeDeCompra, orientacaoDoDia, rotuloDoTreino,
} from '../www/js/logic/nutrition.js';
import { treinosDoDia, semanaDoCardapio } from '../www/js/logic/semana-nutricao.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));
const base = { objetivo: 'manter', sexo: 'm', idade: 31, peso: 78, altura: 176, atividade: 'leve', treinos: '4', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };
const SEMANA = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
const ids = (dia) => dia.refeicoes.flatMap((r) => r.itens.map((x) => x.id));

test('cada data tem sempre o mesmo cardápio, e os 7 dias da semana não são cópias', () => {
  for (const refeicoes of ['3', '4', '5', '6']) for (const preco of ['barato', 'tanto_faz']) {
    const r = calcular({ ...base, refeicoes, preco });
    const dias = SEMANA.map((d) => cardapioDoDia(r, d));
    assert.deepEqual(SEMANA.map((d) => assinatura(cardapioDoDia(r, d))), dias.map(assinatura), 'mesma data, mesmo cardápio');
    assert.ok(new Set(dias.map(assinatura)).size >= 6, `${refeicoes} refeições, ${preco}: a semana varia`);
    for (const d of dias) {
      assert.ok(d.kcal > r.kcal * 0.9 && d.kcal < r.kcal * 1.08, `calorias do dia perto da meta: ${Math.round(d.kcal)} de ${r.kcal}`);
      assert.ok(d.p >= r.prot * 0.9, 'proteína do dia perto da meta');
    }
  }
  assert.equal(sementeDoDia('2026-11-17'), (sementeDoDia('2026-11-16') + 1) % 1000);
  assert.equal(sementeDoDia('2026-02-31'), 0, 'data que não existe');
  // sem ajuste, o cardápio do dia é o gerador de sempre com a semente da data
  const r = calcular(base);
  assert.equal(assinatura(cardapioDoDia(r, SEMANA[0])), assinatura(cardapio(r, sementeDoDia(SEMANA[0]))));
});

test('"Trocar" muda só a refeição escolhida e o dia continua na meta', () => {
  for (const restricoes of [['nenhuma'], ['vegano'], ['vegetariano', 'sem_lactose'], ['sem_gluten']]) {
    const r = calcular({ ...base, restricoes });
    const antes = cardapioDoDia(r, SEMANA[0]);
    for (const ref of antes.refeicoes) {
      const aj = trocarRefeicaoDoDia(r, SEMANA[0], null, ref.ordem);
      assert.ok(aj, `${restricoes}: há outra opção para ${ref.nome}`);
      const depois = cardapioDoDia(r, SEMANA[0], aj);
      const nova = depois.refeicoes.find((x) => x.ordem === ref.ordem);
      assert.notEqual(nova.itens.map((x) => x.id).sort().join(), ref.itens.map((x) => x.id).sort().join(), 'a refeição mudou');
      assert.ok(depois.kcal > r.kcal * 0.9 && depois.kcal < r.kcal * 1.08, 'o dia continua perto da meta de calorias');
      // as outras refeições mantêm a base (o ajuste fino do dia pode mexer em quantidades e complementos)
      for (const o of antes.refeicoes.filter((x) => x.ordem !== ref.ordem)) {
        const d2 = depois.refeicoes.find((x) => x.ordem === o.ordem);
        const fica = o.itens.filter((x) => d2 && d2.itens.some((y) => y.id === x.id)).length;
        assert.ok(fica >= o.itens.length * 0.5, `${restricoes}: trocar ${ref.nome} mantém a base de ${o.nome} (${fica} de ${o.itens.length})`);
      }
      for (const id of ids(depois)) for (const t of restricoes.filter((x) => x !== 'nenhuma')) assert.ok(FOOD.get(id).tags.includes(t), `${id} respeita ${t}`);
    }
  }
  // "Outra sugestão" muda o dia e zera as trocas
  const r = calcular(base);
  const aj = trocarRefeicaoDoDia(r, SEMANA[0], null, 1);
  const outra = outraSugestaoDoDia(r, SEMANA[0], aj);
  assert.ok(outra && outra.m.length === 0 && outra.s > 0);
  assert.notEqual(assinatura(cardapioDoDia(r, SEMANA[0], outra)), assinatura(cardapioDoDia(r, SEMANA[0], aj)));
});

test('ajustes guardados: só datas reais e valores inteiros; o resto é descartado', () => {
  assert.deepEqual(limparAjustes({ '2026-11-16': { s: 3, m: [0, 2, 0] }, x: { s: 1 }, '2026-02-31': { s: 1 }, '2026-11-17': { s: 0, m: [0] }, '2026-11-18': { s: 1.5, m: ['2', -1, 100] } }), { '2026-11-16': { s: 3, m: [0, 2] } });
  assert.deepEqual(limparAjustes(JSON.parse('{"__proto__": {"s": 1}, "constructor": {"s": 2}}')), {});
  assert.deepEqual(limparAjustes([1, 2]), {}); assert.deepEqual(limparAjustes(null), {});
  assert.equal(limparAjuste({ s: 0, m: [] }), null);
  const muitos = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`2026-10-${String((i % 31) + 1).padStart(2, '0')}`, { s: 1 }]).concat(Array.from({ length: 30 }, (_, i) => [`2026-11-${String(i + 1).padStart(2, '0')}`, { s: 2 }])));
  const l = limparAjustes(muitos);
  assert.equal(Object.keys(l).length, 40); assert.ok(l['2026-11-30'] && !l['2026-10-01'], 'ficam as datas mais recentes');
  // o armazenamento valida o campo
  assert.deepEqual(store.sanitize({ nutri: { ajustes: { '2026-11-16': { s: 5 }, lixo: 1 } } }).nutri.ajustes, { '2026-11-16': { s: 5, m: [] } });
  assert.deepEqual(store.sanitize({}).nutri.ajustes, {});
});

test('lista de compras: soma a semana em quantidades de compra, agrupada por tipo', () => {
  const r = calcular({ ...base, preco: 'barato' });
  const dias = SEMANA.map((d) => cardapioDoDia(r, d));
  const l = listaDeCompras(dias, { emCasa: ['ovo-cozido'] });
  const linhas = l.grupos.flatMap((g) => g.itens);
  assert.equal(l.itens, linhas.length);
  // cada alimento do cardápio está em alguma linha da lista
  for (const id of new Set(dias.flatMap(ids))) assert.ok(linhas.some((x) => x.ids.includes(id)), id);
  // arroz: peso cru = cozido ÷ 2,8 (rendimento da tabela), arredondado para cima de 50 em 50 g
  const arroz = dias.flatMap((d) => d.refeicoes.flatMap((x) => x.itens)).filter((x) => x.id === 'arroz-branco-cozido').reduce((s, x) => s + x.g, 0);
  if (arroz) { const la = linhas.find((x) => x.ids.includes('arroz-branco-cozido')); const cru = arroz / 2.8; assert.ok(la.nome === 'Arroz branco' && /^(\d+) g$|kg$/.test(la.qtd), la.qtd); if (cru < 1000) assert.equal(la.qtd, `${Math.max(50, Math.ceil(cru / 50) * 50)} g`); }
  const ovo = linhas.find((x) => x.ids.includes('ovo-cozido'));
  if (ovo) { assert.match(ovo.qtd, /^\d+ unidades?$/); assert.equal(ovo.emCasa, true); }
  for (const x of linhas) assert.match(x.qtd, /^\d+(,\d)? (g|kg|L|mL|unidades?|potes?|espigas?|latas?|colheres? de sopa)$/, `${x.nome}: ${x.qtd}`);
  // grupos na ordem do catálogo, sem grupo vazio
  assert.ok(l.grupos.every((g) => g.itens.length > 0));
  const txt = textoDaListaDeCompras(l, 'Lista de compras · 16/11 a 22/11');
  assert.ok(txt.startsWith('Lista de compras · 16/11 a 22/11\n') && txt.includes('\n- ') && txt.includes('(já marcado em casa)'));
  // nome de compra sem o modo de preparo; crua e cozida somam numa linha só
  assert.equal(nomeDeCompra('Peito de frango grelhado (sem pele)'), 'Peito de frango (sem pele)');
  assert.equal(nomeDeCompra('Feijão carioca cozido'), 'Feijão carioca');
  const cen = listaDeCompras([{ refeicoes: [{ itens: [{ id: 'cenoura-crua', g: 100 }, { id: 'cenoura-cozida', g: 100 }] }] }]);
  assert.equal(cen.grupos.flatMap((g) => g.itens).filter((x) => x.nome === 'Cenoura').length, 1);
  assert.equal(listaDeCompras([null, undefined]).itens, 0);
});

test('a semana respeita as travas: sem cardápio (nem calorias) para quem não recebe números', () => {
  for (const extra of [{ idade: 16 }, { condicoes: ['transtorno'] }, { condicoes: ['renal'] }, { condicoes: ['gestante'] }]) {
    const r = calcular({ ...base, ...extra });
    assert.equal(r.modo, 'educativo');
    assert.equal(cardapioDoDia(r, SEMANA[0]), null);
    const o = orientacaoDoDia(r, { musculacao: { nome: 'Pernas', forte: true }, corrida: { tipo: 'longo', nome: 'Longão', durMin: 130, intensidade: 'leve' }, conhecido: true });
    const tudo = JSON.stringify(o);
    assert.ok(!/\d+ g\b|\d+ mL|kcal|g por quilo/.test(tudo), 'sem gramas, mililitros nem calorias: ' + tudo.slice(0, 200));
  }
  // vegano e "mais baratos" valem para todos os dias
  const r = calcular({ ...base, restricoes: ['vegano'], preco: 'barato' });
  for (const d of SEMANA) for (const id of ids(cardapioDoDia(r, d))) assert.ok(FOOD.get(id).tags.includes('vegano'), id);
});

test('bloco "Hoje": treino, corrida, as duas coisas ou descanso, sem misturar', () => {
  const r = calcular(base);
  const musc = { musculacao: { nome: 'Pernas', forte: true }, corrida: null, conhecido: true };
  const corrida = { musculacao: null, corrida: { tipo: 'leve', nome: 'Rodagem leve', durMin: 40, intensidade: 'leve' }, conhecido: true };
  const as2 = { musculacao: { nome: 'Pernas', forte: false }, corrida: corrida.corrida, conhecido: true };
  const desc = { musculacao: null, corrida: null, conhecido: true };
  assert.equal(orientacaoDoDia(r, as2).titulo, 'Hoje: musculação (Pernas) + rodagem leve de 40 min');
  assert.equal(rotuloDoTreino(desc), '');
  const d = orientacaoDoDia(r, desc);
  assert.equal(d.titulo, 'Hoje: descanso');
  assert.ok(!d.antes && !d.depois && !d.durante && !/antes do treino/i.test(JSON.stringify(d)), 'descanso: nada de "antes do treino"');
  assert.ok(d.agua.startsWith('Água do dia: 2,5 L'), d.agua);
  const m = orientacaoDoDia(r, musc);
  assert.ok(m.antes && !m.durante && /antes do treino/.test(m.agua) && m.antes.extras.some((x) => x.includes('pernas')));
  const c = orientacaoDoDia(r, corrida);
  assert.ok(c.durante && c.durante.linhas[0].startsWith('Não precisa de carboidrato') && c.refs.includes('thomas2016'));
  const longo = orientacaoDoDia(r, { ...corrida, corrida: { tipo: 'longo', nome: 'Longão', durMin: 130, intensidade: 'leve' } });
  assert.ok(longo.durante.linhas[0].startsWith('30 a 60 g') && longo.durante.linhas.some((x) => x.includes('sódio')) && longo.antes.intro.startsWith('Refeição com carboidrato ('));
  // horário "Varia / não treino": regra geral, sem horário inventado
  const v = orientacaoDoDia(calcular({ ...base, horario: 'varia' }), musc);
  assert.ok(v.resumo.startsWith('Regra geral') && !/manhã|tarde|noite|acordar/i.test(v.resumo), v.resumo);
  // sem treino nem plano no aplicativo: regra geral para quem treina; nada de treino para quem não treina
  assert.equal(orientacaoDoDia(r, { conhecido: false }).titulo, 'Nos dias de treino');
  const naoTreina = orientacaoDoDia(calcular({ ...base, treinos: '0' }), { conhecido: false });
  assert.ok(naoTreina.titulo === 'Hoje' && !naoTreina.antes);
});

// estado com treino de pernas na segunda, superiores na quinta e plano de corrida (segunda e quinta)
function estado() {
  const item = (ex, series) => ({ ex, series, reps: '8-12', descanso: 90 });
  const plano = { id: 'p1', nome: 'Meu treino', origem: 'manual', criadoEm: '2026-11-10T10:00:00.000Z', info: '',
    dias: [{ id: 'd1', nome: 'Pernas', foco: '', itens: [item('agachamento-livre-barra', 4), item('leg-press-45', 4), item('cadeira-extensora', 3)] },
      { id: 'd2', nome: 'Superiores', foco: '', itens: [item('supino-reto-halteres', 3)] }], agenda: { 1: 'd1', 4: 'd2' } };
  const corrida = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'saude', dias: ['1', '4'], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  for (const q of P_CORRIDA) if (!(q.k in corrida) && !(q.se && !q.se(corrida)) && !q.opcional) corrida[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[0][0]];
  assert.ok(corridaOk(corrida));
  return store.sanitize({ plans: [plano], activePlan: 'p1', nutri: { answers: base, ajustes: { '2026-11-18': { s: 0, m: [0, 3] } } }, run: { answers: corrida, aceitoEm: '2026-11-16T08:00:00.000Z', inicio: '2026-11-16', pausadoEm: '' } });
}

test('treinos de cada dia e a semana de cardápios a partir do estado', () => {
  const st = estado();
  const seg = treinosDoDia(st, '2026-11-16', '2026-11-16');
  assert.equal(seg.musculacao.nome, 'Pernas'); assert.equal(seg.musculacao.forte, true);
  assert.ok(seg.corrida && seg.corrida.durMin > 0, 'segunda tem corrida');
  const ter = treinosDoDia(st, '2026-11-16', '2026-11-17');
  assert.ok(!ter.musculacao && !ter.corrida && ter.conhecido, 'terça: descanso');
  assert.equal(treinosDoDia(st, '2026-11-16', '2026-11-19').musculacao.forte, false);
  assert.equal(treinosDoDia({}, '2026-11-16', '2026-11-16').conhecido, false);
  const sem = semanaDoCardapio(st, '2026-11-16');
  assert.deepEqual(sem.map((d) => d.data), SEMANA);
  for (const d of sem) { assert.ok(d.meta && d.meta.kcal > 0 && d.cardapio && d.cardapio.refeicoes.length === 4); }
  // o ajuste guardado vale na semana (mesmo caminho da tela do dia)
  assert.equal(assinatura(sem[2].cardapio), assinatura(cardapioDoDia(sem[2].meta, '2026-11-18', { s: 0, m: [0, 3] })));
  assert.ok(new Set(sem.map((d) => assinatura(d.cardapio))).size >= 6);
  // a meta de cada dia leva em conta a corrida (média da semana do plano)
  assert.ok(sem[0].meta.corrida && sem[0].meta.corrida.kcalDia > 0);
});

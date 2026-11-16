// Diário alimentar: validação na fronteira, gravação, totais, comparação com a meta, modos de segurança e estresse.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALIMENTOS } from '../www/js/data/foods.js';
import { REFS, FAQ_NUTRI } from '../www/js/data/knowledge.js';
import { PERGUNTAS, calcular, cardapio } from '../www/js/logic/nutrition.js';
import {
  REFEICOES, MAX_DIAS, MAX_ITENS_DIA, G_MAX, KCAL_MAX, PROT_MAX, NOME_MAX, AVISO_DO_REGISTRO, REFS_DO_DIARIO,
  diarioPadrao, limparDiario, limparItem, itensDoDia, gravarItem, apagarItem, copiarRefeicao, idDaRefeicao, refeicaoRegistrada, diasRegistrados,
  nutrientesDoItem, totaisDoDia, modoDoDiario, compararComMeta, resumoDaSemana, metaDoDia, resumoDeHoje, somarDias, hojeLocal,
  perfilDoDiario, primeiroDiaDoDiario, refeicaoCopiada, lerCalorias, lerProteina, buscarAlimentos,
} from '../www/js/logic/diario.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));
const J = (x) => JSON.parse(JSON.stringify(x));
const HOJE = '2026-11-16';
const base = { objetivo: 'manter', sexo: 'm', idade: 30, peso: 80, altura: 178, atividade: 'leve', treinos: '3', horario: 'noite', refeicoes: '6', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };
const semLixo = (s) => typeof s === 'string' && !/undefined|NaN|null|Infinity|\[object/.test(s);
const finito = (o) => { for (const [k, v] of Object.entries(o)) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} = ${v}`); };
function semente(s) { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('formato: diário vazio, refeições do cardápio e data local', () => {
  assert.deepEqual(diarioPadrao(), { dias: [] });
  assert.deepEqual(Object.values(REFEICOES), ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia', 'Outro horário']);
  assert.match(hojeLocal(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(hojeLocal(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(somarDias('2026-03-01', -1), '2026-02-28'); assert.equal(somarDias('2024-02-28', 1), '2024-02-29'); assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
  // todas as refeições que o cardápio de exemplo gera têm lugar no diário
  for (const refeicoes of ['3', '4', '5', '6']) for (const ref of cardapio(calcular({ ...base, refeicoes }), 0).refeicoes) assert.notEqual(idDaRefeicao(ref.nome), 'outro', ref.nome);
  assert.equal(idDaRefeicao('Brunch'), 'outro'); assert.equal(idDaRefeicao(undefined), 'outro');
});

test('validação na fronteira: lixo, chaves herdadas, datas, ids e limites', () => {
  for (const lixo of [null, undefined, 0, 'x', [], [1, 2], { dias: 'x' }, { dias: null }, { dias: {} }, { dias: [null, 1, 'a', [], {}] }, JSON.parse('{"__proto__":{"dias":[{"data":"2026-11-10","itens":[{"id":"a","al":"ovo-cozido","g":50}]}]}}')]) {
    assert.deepEqual(limparDiario(lixo, HOJE), { dias: [] });
  }
  const bom = { id: 'a1', ref: 'almoco', al: 'arroz-branco-cozido', g: 150 };
  // itens: só passa o que tem o formato
  assert.deepEqual(limparItem(bom), { ...bom, m: false });
  assert.deepEqual(limparItem({ ...bom, m: true, extra: 1, kcal: 9999 }), { ...bom, m: true }, 'campos a mais são descartados');
  assert.deepEqual(limparItem({ ...bom, ref: 'churrasco' }), { ...bom, ref: 'outro', m: false }, 'refeição desconhecida vira "outro horário"');
  assert.deepEqual(limparItem({ ...bom, ref: 'constructor' }), { ...bom, ref: 'outro', m: false }, 'chave herdada não é refeição');
  assert.deepEqual(limparItem({ ...bom, g: 150.4 }).g, 150);
  for (const ruim of [{ ...bom, id: '' }, { ...bom, id: 'a b' }, { ...bom, id: 'x'.repeat(25) }, { ...bom, id: 7 }, { ...bom, al: 'nao-existe' }, { ...bom, al: 'constructor' }, { ...bom, al: '__proto__' }, { ...bom, al: 12 },
    { ...bom, g: 0 }, { ...bom, g: -5 }, { ...bom, g: G_MAX + 1 }, { ...bom, g: NaN }, { ...bom, g: Infinity }, { ...bom, g: '150' }, { ...bom, g: null }, { id: 'a1' }, null, 'x', [bom]]) {
    assert.equal(limparItem(ruim), null, JSON.stringify(ruim));
  }
  // alimento fora da lista: nome cortado e sem caracteres de controle; calorias e proteína dentro dos limites
  const livre = limparItem({ id: 'b', ref: 'ceia', nome: '  Bolo\n de\tcenoura <b>da vó</b> ' + 'x'.repeat(80), kcal: 310.6, p: 4.26 });
  assert.equal(livre.nome.length, NOME_MAX); assert.ok(livre.nome.startsWith('Bolo de cenoura <b>da vó</b>')); assert.equal(livre.kcal, 311); assert.equal(livre.p, 4.3);
  assert.equal(limparItem({ id: 'b', nome: 'Café', kcal: 0 }).kcal, 0, 'zero caloria vale (café sem açúcar)');
  assert.equal(limparItem({ id: 'b', nome: 'X', kcal: 100, p: -1 }).p, null); assert.equal(limparItem({ id: 'b', nome: 'X', kcal: 100, p: PROT_MAX + 1 }).p, null); assert.equal(limparItem({ id: 'b', nome: 'X', kcal: 100, p: 'muita' }).p, null);
  for (const ruim of [{ id: 'b', nome: '', kcal: 100 }, { id: 'b', nome: '   ', kcal: 100 }, { id: 'b', nome: 7, kcal: 100 }, { id: 'b', nome: 'X' }, { id: 'b', nome: 'X', kcal: -1 }, { id: 'b', nome: 'X', kcal: KCAL_MAX + 1 }, { id: 'b', nome: 'X', kcal: NaN }, { id: 'b', nome: 'X', kcal: '300' }]) assert.equal(limparItem(ruim), null, JSON.stringify(ruim));
  // dias: data real, de 2020 até amanhã; repetidos e vazios saem; ordem de data
  const d = limparDiario({ dias: [
    { data: '2026-11-15', itens: [bom, bom, { ...bom, id: 'a2', g: 100 }, { id: 'x', al: 'nao-existe', g: 10 }] },
    { data: '2026-11-15', itens: [{ ...bom, id: 'zz' }] },
    { data: '2026-02-31', itens: [bom] }, { data: '2026-13-01', itens: [bom] }, { data: '16/11/2026', itens: [bom] }, { data: 20261116, itens: [bom] },
    { data: '2019-12-31', itens: [bom] }, { data: '2026-11-18', itens: [bom] }, { data: '2031-01-01', itens: [bom] },
    { data: '2026-11-17', itens: [bom] }, { data: '2026-11-10', itens: [] }, { data: '2026-11-09', itens: 'x' }, { data: '2026-11-01', itens: [{ id: 'q', nome: 'Pastel de feira', kcal: 400 }] },
  ] }, HOJE);
  assert.deepEqual(d.dias.map((x) => x.data), ['2026-11-01', '2026-11-15', '2026-11-17']);
  assert.deepEqual(d.dias[1].itens.map((x) => x.id), ['a1', 'a2'], 'id repetido e alimento inexistente saem');
  assert.deepEqual(limparDiario(J(d), HOJE), d, 'validar duas vezes não muda nada');
  // limite de dias: ficam os mais recentes; limite de itens por dia
  const muitos = { dias: [] };
  for (let i = MAX_DIAS + 49; i >= 0; i--) muitos.dias.push({ data: somarDias(HOJE, -i), itens: [bom] });
  muitos.dias.reverse();                                        // fora de ordem: a validação ordena antes de cortar
  const cortado = limparDiario(muitos, HOJE);
  assert.equal(cortado.dias.length, MAX_DIAS); assert.equal(cortado.dias[MAX_DIAS - 1].data, HOJE); assert.equal(cortado.dias[0].data, somarDias(HOJE, -(MAX_DIAS - 1)));
  const cheio = limparDiario({ dias: [{ data: HOJE, itens: Array.from({ length: MAX_ITENS_DIA + 30 }, (_, i) => ({ ...bom, id: 'k' + i })) }] }, HOJE);
  assert.equal(cheio.dias[0].itens.length, MAX_ITENS_DIA);
});

test('gravar, corrigir e apagar; datas aceitas; dia cheio', () => {
  const d = diarioPadrao();
  const a = gravarItem(d, HOJE, { ref: 'cafe', al: 'pao-frances', g: 50, m: true }, HOJE);
  const b = gravarItem(d, HOJE, { ref: 'cafe', al: 'ovo-cozido', g: 100 }, HOJE);
  assert.deepEqual(a, { id: 'i1', ref: 'cafe', al: 'pao-frances', g: 50, m: true }); assert.equal(b.id, 'i2');
  assert.deepEqual(d.dias.map((x) => x.data), [HOJE]);
  // corrigir troca no lugar, sem duplicar
  const a2 = gravarItem(d, HOJE, { id: 'i1', ref: 'lanche-manha', al: 'pao-frances', g: 100 }, HOJE);
  assert.deepEqual(a2, { id: 'i1', ref: 'lanche-manha', al: 'pao-frances', g: 100, m: false });
  assert.deepEqual(itensDoDia(d, HOJE).map((x) => x.id), ['i1', 'i2']);
  // inválidos não mudam nada
  const antes = J(d);
  for (const [data, raw] of [[HOJE, { ref: 'cafe', al: 'nao-existe', g: 50 }], [HOJE, { ref: 'cafe', al: 'ovo-cozido', g: 0 }], [HOJE, { id: 'i9', ref: 'cafe', al: 'ovo-cozido', g: 50 }], [HOJE, null], [HOJE, 'x'],
    [somarDias(HOJE, 1), { ref: 'cafe', al: 'ovo-cozido', g: 50 }], ['2026-02-30', { ref: 'cafe', al: 'ovo-cozido', g: 50 }], ['2019-01-01', { ref: 'cafe', al: 'ovo-cozido', g: 50 }], ['', { ref: 'cafe', al: 'ovo-cozido', g: 50 }]]) {
    assert.equal(gravarItem(d, data, raw, HOJE), null, data + ' ' + JSON.stringify(raw));
  }
  assert.equal(gravarItem(null, HOJE, { al: 'ovo-cozido', g: 50 }, HOJE), null);
  assert.deepEqual(d, antes);
  // dia anterior: grava, e os dias ficam em ordem
  const ontem = somarDias(HOJE, -1);
  assert.ok(gravarItem(d, ontem, { ref: 'jantar', nome: 'Pizza de mussarela', kcal: 560, p: 24 }, HOJE));
  assert.deepEqual(d.dias.map((x) => x.data), [ontem, HOJE]); assert.deepEqual(diasRegistrados(d), [ontem, HOJE]);
  // apagar: some o item; apagando o último, some o dia
  assert.equal(apagarItem(d, HOJE, 'nao-tem'), false); assert.equal(apagarItem(d, '2026-01-01', 'i1'), false);
  assert.equal(apagarItem(d, HOJE, 'i1'), true); assert.deepEqual(itensDoDia(d, HOJE).map((x) => x.id), ['i2']);
  assert.equal(apagarItem(d, HOJE, 'i2'), true); assert.deepEqual(d.dias.map((x) => x.data), [ontem]);
  // o id novo não repete um que ainda existe
  gravarItem(d, HOJE, { al: 'banana-prata', g: 70 }, HOJE); gravarItem(d, HOJE, { al: 'banana-prata', g: 70 }, HOJE); apagarItem(d, HOJE, 'i1');
  assert.equal(gravarItem(d, HOJE, { al: 'banana-prata', g: 70 }, HOJE).id, 'i3');
  // dia cheio: o item a mais é recusado, mas corrigir continua valendo
  const cheio = diarioPadrao();
  for (let i = 0; i < MAX_ITENS_DIA; i++) assert.ok(gravarItem(cheio, HOJE, { al: 'ovo-cozido', g: 50 }, HOJE));
  assert.equal(gravarItem(cheio, HOJE, { al: 'ovo-cozido', g: 50 }, HOJE), null);
  assert.equal(gravarItem(cheio, HOJE, { id: 'i5', al: 'ovo-cozido', g: 100 }, HOJE).g, 100);
  assert.equal(itensDoDia(cheio, HOJE).length, MAX_ITENS_DIA);
});

test('totais: a soma dos itens é o total; medida caseira; alimento fora da lista', () => {
  const d = diarioPadrao();
  gravarItem(d, HOJE, { ref: 'almoco', al: 'arroz-branco-cozido', g: 250, m: true }, HOJE);
  gravarItem(d, HOJE, { ref: 'almoco', al: 'feijao-carioca-cozido', g: 100 }, HOJE);
  gravarItem(d, HOJE, { ref: 'cafe', al: 'ovo-cozido', g: 100, m: true }, HOJE);
  gravarItem(d, HOJE, { ref: 'outro', nome: 'Brigadeiro', kcal: 95 }, HOJE);
  gravarItem(d, HOJE, { ref: 'outro', nome: 'Barra de proteína', kcal: 190, p: 15 }, HOJE);
  const t = totaisDoDia(d, HOJE);
  const arroz = FOOD.get('arroz-branco-cozido'), feijao = FOOD.get('feijao-carioca-cozido'), ovo = FOOD.get('ovo-cozido');
  const kcal = arroz.kcal * 2.5 + feijao.kcal + ovo.kcal + 95 + 190;
  assert.ok(Math.abs(t.kcal - kcal) < 1e-9); assert.ok(Math.abs(t.p - (arroz.p * 2.5 + feijao.p + ovo.p + 15)) < 1e-9);
  assert.ok(Math.abs(t.c - (arroz.c * 2.5 + feijao.c + ovo.c)) < 1e-9, 'carboidrato: só dos alimentos da lista');
  assert.equal(t.n, 5); assert.equal(t.livres, 2); assert.equal(t.semProteina, 1);
  // por refeição, na ordem do dia, e cada alimento com as suas calorias
  assert.deepEqual(t.refeicoes.map((r) => r.ref), ['cafe', 'almoco', 'outro']);
  assert.deepEqual(t.refeicoes.map((r) => r.nome), ['Café da manhã', 'Almoço', 'Outro horário']);
  const soma = t.refeicoes.reduce((s, r) => s + r.itens.reduce((x, it) => x + it.kcal, 0), 0);
  assert.ok(Math.abs(soma - t.kcal) < 1e-9, 'soma dos itens = total do dia');
  for (const r of t.refeicoes) assert.ok(Math.abs(r.itens.reduce((x, it) => x + it.kcal, 0) - r.kcal) < 1e-9, 'soma dos itens = total da refeição');
  // medida caseira: 250 g de arroz = 2 porções de 125 g; 100 g de ovo = 2 unidades
  const almoco = t.refeicoes[1].itens;
  assert.equal(almoco[0].nome, arroz.nome); assert.ok(almoco[0].medida.startsWith('250 g (') && almoco[0].medida.length > 8, almoco[0].medida);
  assert.equal(t.refeicoes[0].itens[0].medida, '100 g (2 unidades)');
  const brig = nutrientesDoItem(itensDoDia(d, HOJE)[3]);
  assert.deepEqual([brig.livre, brig.kcal, brig.p, brig.c, brig.gd, brig.fibra, brig.medida], [true, 95, null, null, null, null, '']);
  assert.equal(nutrientesDoItem({ id: 'z', al: 'nao-existe', g: 10 }), null);
  // dia sem registro e diário inválido: zeros, nunca erro
  for (const x of [totaisDoDia(d, '2026-11-01'), totaisDoDia(null, HOJE), totaisDoDia({ dias: 'x' }, HOJE), totaisDoDia(d, 'lixo')]) { assert.equal(x.kcal, 0); assert.equal(x.n, 0); assert.deepEqual(x.refeicoes, []); finito(x); }
});

test('"Comi isso": copia a refeição sugerida do cardápio para o diário', () => {
  const r = calcular(base);
  const c = cardapio(r, 3);
  const d = diarioPadrao();
  let itens = 0;
  for (const ref of c.refeicoes) {
    assert.equal(refeicaoRegistrada(d, HOJE, idDaRefeicao(ref.nome)), false);
    assert.equal(copiarRefeicao(d, HOJE, ref, HOJE), ref.itens.length, ref.nome);
    assert.equal(refeicaoRegistrada(d, HOJE, idDaRefeicao(ref.nome)), true);
    itens += ref.itens.length;
  }
  const t = totaisDoDia(d, HOJE);
  assert.equal(t.n, itens);
  assert.ok(Math.abs(t.kcal - c.kcal) < 0.01 && Math.abs(t.p - c.p) < 0.01 && Math.abs(t.c - c.c) < 0.01 && Math.abs(t.gd - c.g) < 0.01, 'o dia copiado soma o mesmo que o cardápio');
  assert.deepEqual(t.refeicoes.map((x) => x.nome), c.refeicoes.map((x) => x.nome));
  for (let i = 0; i < c.refeicoes.length; i++) assert.deepEqual(t.refeicoes[i].itens.map((x) => [x.al, x.g]), c.refeicoes[i].itens.map((x) => [x.id, x.g]));
  // comer tudo o que o cardápio sugere deixa o dia perto da meta (a tolerância do cardápio é de 10%)
  const cmp = compararComMeta(t, r);
  assert.ok(Math.abs(cmp.difKcal) <= r.kcal * 0.1, cmp.frase);
  // lixo não entra
  assert.equal(copiarRefeicao(d, HOJE, null, HOJE), 0); assert.equal(copiarRefeicao(d, HOJE, { nome: 'Almoço', itens: [{ id: 'nao-existe', g: 100 }, null, 5] }, HOJE), 0);
  assert.equal(copiarRefeicao(d, somarDias(HOJE, 3), c.refeicoes[0], HOJE), 0, 'dia futuro não recebe registro');
});

test('comparação com a meta: faltam, chegou e passou, nos limites', () => {
  const r = calcular(base);
  assert.equal(modoDoDiario(r), 'meta');
  const com = (kcal, p) => compararComMeta({ kcal, p, n: 3 }, r);
  let c = com(0, 0);
  assert.equal(c.estado, 'falta'); assert.equal(c.difKcal, r.kcal); assert.equal(c.pct, 0); assert.equal(c.frase, `Faltam ${String(r.kcal).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} kcal para a meta do dia.`);
  assert.equal(c.fraseProt, `Proteína: faltam ${r.prot} g.`);
  c = com(r.kcal - 305, r.prot - 10.4);
  assert.equal(c.difKcal, 310, 'arredonda a 10 kcal'); assert.equal(c.frase, 'Faltam 310 kcal para a meta do dia.'); assert.equal(c.difProt, 10);
  // a menos de 5 kcal da meta: chegou
  for (const k of [-4, 0, 4]) { c = com(r.kcal + k, r.prot); assert.equal(c.estado, 'chegou', String(k)); assert.equal(c.difKcal, 0); assert.equal(c.frase, 'Você chegou à meta de calorias do dia.'); assert.equal(c.fraseProt, 'Proteína: meta do dia atingida.'); assert.equal(c.equivale, ''); }
  c = com(r.kcal - 6, r.prot); assert.equal(c.estado, 'falta'); assert.equal(c.difKcal, 10);
  c = com(r.kcal + 6, r.prot + 30); assert.equal(c.estado, 'passou'); assert.equal(c.difKcal, -10); assert.equal(c.frase, 'Você passou 10 kcal da meta do dia.'); assert.equal(c.equivale, '', 'diferença pequena não ganha explicação');
  assert.equal(c.fraseProt, 'Proteína: meta do dia atingida.');
  // passou 250 kcal: a frase não julga e diz o tamanho real (7.700 kcal por quilo)
  c = com(r.kcal + 250, r.prot);
  assert.equal(c.frase, 'Você passou 250 kcal da meta do dia.'); assert.equal(c.equivale, 'Na conta teórica, isso equivale a cerca de 30 g de gordura.');
  assert.equal(c.pct, Math.round(((r.kcal + 250) / r.kcal) * 100));
  c = com(r.kcal + 1540, r.prot); assert.ok(/cerca de 200 g de gordura/.test(c.equivale));
  for (const k of [0, 500, r.kcal, r.kcal * 3]) { const x = com(k, 50); finito(x); for (const s of [x.frase, x.fraseProt, x.equivale]) { assert.ok(semLixo(s) && s.length <= 120); assert.ok(!/exager|estour|culpa|falh|errad|ruim|cuidado|atenção|perigo/i.test(s), 'frase com julgamento: ' + s); } }
  // totais ausentes ou estranhos: zeros, sem erro
  for (const t of [null, undefined, {}, 'x']) { const x = compararComMeta(t, r); assert.equal(x.kcal, 0); assert.equal(x.estado, 'falta'); finito(x); }
});

test('segurança: quem não recebe meta nem contagem', () => {
  const tot = { kcal: 1800, p: 90, n: 6 };
  // histórico de transtorno alimentar: o diário não é oferecido (nenhum número, nenhuma frase)
  for (const condicoes of [['transtorno'], ['transtorno', 'diabetes'], ['gestante', 'transtorno']]) {
    const r = calcular({ ...base, condicoes });
    assert.equal(modoDoDiario(r), 'sem');
    const c = compararComMeta(tot, r);
    assert.deepEqual([c.kcal, c.prot, c.metaKcal, c.metaProt, c.difKcal, c.estado, c.frase, c.fraseProt, c.equivale], [null, null, null, null, null, '', '', '', '']);
    const s = resumoDaSemana({ dias: [{ data: HOJE, itens: [{ id: 'a', al: 'ovo-cozido', g: 100 }] }] }, HOJE, r);
    assert.equal(s.mediaKcal, null); assert.equal(s.frase, ''); assert.ok(s.dias.every((d) => d.kcal === null));
  }
  // menores de 18 anos: só os alimentos, sem calorias
  for (const idade of [10, 14, 17]) {
    const r = calcular({ ...base, idade, peso: 55, altura: 160 });
    assert.equal(modoDoDiario(r), 'alimentos');
    const c = compararComMeta(tot, r);
    assert.deepEqual([c.kcal, c.metaKcal, c.frase, c.fraseProt], [null, null, '', '']); assert.equal(c.n, 6);
  }
  assert.equal(modoDoDiario(calcular({ ...base, idade: 18 })), 'meta');
  // gestação, doença renal e gasto não confiável: soma, sem meta, sem "faltam" nem "passou"
  for (const a of [{ condicoes: ['gestante'] }, { condicoes: ['renal'] }, { sexo: 'f', idade: 90, peso: 35, altura: 130, atividade: 'sedentario', treinos: '0' }]) {
    const r = calcular({ ...base, ...a });
    assert.equal(r.modo, 'educativo'); assert.equal(modoDoDiario(r), 'soma');
    const c = compararComMeta(tot, r);
    assert.equal(c.metaKcal, null); assert.equal(c.difKcal, null); assert.equal(c.frase, 'Total do dia: 1.800 kcal e 90 g de proteína.'); assert.ok(!/falta|passou|meta/i.test(c.frase + c.fraseProt + c.equivale));
  }
  // sem entrevista: soma, sem meta
  for (const r of [null, undefined, {}, 'x']) { const c = compararComMeta(tot, r); assert.equal(c.modo, 'soma'); assert.equal(c.metaKcal, null); assert.equal(c.kcal, 1800); }
  assert.equal(compararComMeta({ kcal: 0, p: 0, n: 0 }, null).frase, '', 'dia vazio sem meta: sem frase');
  // diabetes e baixo peso (manutenção): há meta, e o diário compara
  assert.equal(modoDoDiario(calcular({ ...base, condicoes: ['diabetes'] })), 'meta');
  // o aviso do registro e as fontes
  assert.ok(/11% a 41%/.test(AVISO_DO_REGISTRO) && /médias de tabela/.test(AVISO_DO_REGISTRO) && AVISO_DO_REGISTRO.length <= 200);
  for (const k of REFS_DO_DIARIO) assert.ok(REFS[k], k);
  for (const k of ['burrows2019', 'eikey2021', 'moody2025', 'helms2014']) assert.ok(REFS_DO_DIARIO.includes(k));
  const faq = FAQ_NUTRI.find((x) => /diário de alimentação/.test(x.q));
  assert.ok(faq && faq.f.every((k) => REFS[k]) && /11% a 41%/.test(faq.a.join(' ')));
});

test('semana e dias anteriores; números para o Início', () => {
  const r = calcular(base);
  const d = diarioPadrao();
  const ovo = FOOD.get('ovo-cozido');
  // três dias dentro da janela de 7 e um fora
  gravarItem(d, HOJE, { al: 'ovo-cozido', g: 100 }, HOJE);
  gravarItem(d, somarDias(HOJE, -2), { al: 'ovo-cozido', g: 200 }, HOJE);
  gravarItem(d, somarDias(HOJE, -6), { nome: 'Feijoada do sábado', kcal: 900, p: 40 }, HOJE);
  gravarItem(d, somarDias(HOJE, -7), { nome: 'Fora da janela', kcal: 5000 }, HOJE);
  const s = resumoDaSemana(d, HOJE, r);
  assert.equal(s.dias.length, 7); assert.equal(s.dias[6].data, HOJE); assert.equal(s.dias[0].data, somarDias(HOJE, -6));
  assert.equal(s.registrados, 3);
  const media = Math.round((Math.round(ovo.kcal) + Math.round(ovo.kcal * 2) + 900) / 3);
  assert.equal(s.mediaKcal, media); assert.equal(s.metaKcal, r.kcal); assert.equal(s.difMedia, Math.round((r.kcal - media) / 10) * 10);
  assert.ok(/em 3 dias registrados nos últimos 7/.test(s.frase) && semLixo(s.frase), s.frase);
  assert.deepEqual(s.dias.map((x) => x.n), [1, 0, 0, 0, 1, 0, 1]);
  // semana vazia e um dia só
  const vazia = resumoDaSemana(diarioPadrao(), HOJE, r);
  assert.equal(vazia.registrados, 0); assert.equal(vazia.mediaKcal, null); assert.equal(vazia.frase, '');
  const um = diarioPadrao(); gravarItem(um, HOJE, { al: 'ovo-cozido', g: 100 }, HOJE);
  assert.ok(/em 1 dia registrado nos últimos 7/.test(resumoDaSemana(um, HOJE, null).frase));
  // corrigir um dia anterior muda só aquele dia
  const antes = totaisDoDia(d, HOJE).kcal;
  const id = itensDoDia(d, somarDias(HOJE, -2))[0].id;
  assert.ok(gravarItem(d, somarDias(HOJE, -2), { id, al: 'ovo-cozido', g: 50 }, HOJE));
  assert.ok(Math.abs(totaisDoDia(d, somarDias(HOJE, -2)).kcal - ovo.kcal * 0.5) < 1e-9); assert.equal(totaisDoDia(d, HOJE).kcal, antes);
  // Início: com as respostas da entrevista no estado, "consumido / meta"; sem elas, só o total
  const st = { nutri: { answers: base }, diario: d };
  const meta = metaDoDia(st, HOJE);
  assert.equal(meta.kcal, r.kcal);
  const h = resumoDeHoje(st, HOJE);
  assert.deepEqual([h.modo, h.kcal, h.metaKcal, h.prot, h.metaProt, h.n], ['meta', Math.round(ovo.kcal), r.kcal, Math.round(ovo.p), r.prot, 1]);
  assert.equal(resumoDeHoje({ nutri: { answers: {} }, diario: d }, HOJE).modo, 'soma'); assert.equal(metaDoDia({}, HOJE), null); assert.equal(metaDoDia(null, HOJE), null);
  for (const lixo of [null, {}, { diario: 'x' }, { nutri: 'x', diario: { dias: [{}] } }]) { const x = resumoDeHoje(lixo, HOJE); assert.equal(x.kcal, 0); finito(x); }
});

test('estresse: 300 diários aleatórios com lixo no meio — nunca NaN, soma dos itens = total, ida e volta estável', () => {
  const rnd = semente(2026);
  const um = (l) => l[Math.floor(rnd() * l.length)];
  const ids = ALIMENTOS.map((f) => f.id);
  const refs = [...Object.keys(REFEICOES), 'x', '', null, 'constructor'];
  const op = (k) => PERGUNTAS.find((q) => q.k === k).op.map((o) => o[0]);
  let gravados = 0, recusados = 0;
  for (let n = 0; n < 300; n++) {
    const d = diarioPadrao();
    for (let k = 0; k < 40; k++) {
      const data = somarDias(HOJE, -Math.floor(rnd() * rnd() * 30) + (rnd() < 0.05 ? 3 : 0));
      const x = rnd();
      const raw = x < 0.55 ? { ref: um(refs), al: um(ids), g: Math.round(rnd() * 600) + (rnd() < 0.05 ? -50 : 1), m: rnd() < 0.5 }
        : x < 0.8 ? { ref: um(refs), nome: um(['Bolo', 'Açaí na tigela', '  ', 'x'.repeat(90), 'Sopa <script>']), kcal: Math.round(rnd() * 1200), p: rnd() < 0.5 ? Math.round(rnd() * 60) : undefined }
          : um([null, 5, 'x', {}, { al: 'nao-existe', g: 100 }, { al: um(ids), g: NaN }, { al: um(ids), g: Infinity }, { nome: 'X', kcal: -3 }, { nome: 'X', kcal: 1e9 }, { al: um(ids), g: '100' }, JSON.parse('{"__proto__":{"al":"ovo-cozido","g":50}}')]);
      if (gravarItem(d, data, raw, HOJE)) gravados++; else recusados++;
      if (rnd() < 0.1) { const dias = diasRegistrados(d); if (dias.length) { const dia = um(dias); const it = um(itensDoDia(d, dia)); apagarItem(d, dia, it.id); } }
    }
    // o estado gravado é sempre válido: validar de novo (como ao carregar ou restaurar o backup) não muda nada
    assert.deepEqual(limparDiario(J(d), HOJE), d);
    assert.ok(d.dias.length <= MAX_DIAS && d.dias.every((x) => x.itens.length >= 1 && x.itens.length <= MAX_ITENS_DIA && x.data <= HOJE));
    assert.deepEqual(d.dias.map((x) => x.data), d.dias.map((x) => x.data).slice().sort());
    const res = rnd() < 0.2 ? null : calcular({ ...base, objetivo: um(op('objetivo')), sexo: um(op('sexo')), idade: 12 + Math.floor(rnd() * 70), peso: 45 + Math.round(rnd() * 80), condicoes: [um(op('condicoes'))] });
    for (const dia of d.dias) {
      const t = totaisDoDia(d, dia.data);
      finito(t);
      assert.equal(t.n, dia.itens.length);
      let soma = 0, prot = 0;
      for (const ref of t.refeicoes) for (const it of ref.itens) { finito(it); assert.ok(it.kcal >= 0 && it.nome.length > 0 && it.nome.length <= 80); soma += it.kcal; prot += it.p || 0; }
      assert.ok(Math.abs(soma - t.kcal) < 1e-6 && Math.abs(prot - t.p) < 1e-6, 'soma dos itens = total');
      const c = compararComMeta(t, res);
      finito(c);
      for (const s of [c.frase, c.fraseProt, c.equivale]) assert.ok(semLixo(s), s);
      if (c.modo === 'meta') { assert.equal(c.difKcal, Math.round((res.kcal - t.kcal) / 10) * 10 || 0); assert.equal(c.estado, c.difKcal > 0 ? 'falta' : c.difKcal < 0 ? 'passou' : 'chegou'); }
      else { assert.equal(c.metaKcal, null); assert.equal(c.difKcal, null); assert.ok(!/Faltam|passou/.test(c.frase)); }
      if (c.modo === 'sem' || c.modo === 'alimentos') assert.equal(c.kcal, null);
    }
    const s = resumoDaSemana(d, HOJE, res);
    finito(s); assert.ok(semLixo(s.frase)); assert.equal(s.registrados, s.dias.filter((x) => x.n > 0).length);
  }
  assert.ok(gravados > 5000 && recusados > 1500, `gravados ${gravados}, recusados ${recusados}`);
});

// ---------- achados da auditoria do diário (sexta rodada) ----------
const CORRIDA = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'prova', distancia: '21', semanasProva: 12, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 34, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };

test('A1: menor de 18 e gestante são reconhecidos em qualquer entrevista; vale o modo mais protegido', () => {
  const tot = { kcal: 160, p: 3, n: 1 };
  const adulto = { ...base };
  // sem entrevista de nutrição: a idade vem do Treinador, da corrida ou da tela do sono
  for (const [rotulo, st] of [
    ['15 no Treinador', { trainer: { answers: { idade: 15 } } }], ['15 na corrida', { run: { answers: { idade: 15 } } }], ['12 no sono', { sono: { idade: 12 } }],
    ['17 na Nutricionista, entrevista incompleta', { nutri: { answers: { idade: 17 } } }], ['30 no Treinador e 16 na corrida', { trainer: { answers: { idade: 30 } }, run: { answers: { idade: 16 } } }],
  ]) {
    assert.equal(modoDoDiario(null, st), 'alimentos', rotulo);
    const c = compararComMeta(tot, null, st);
    assert.deepEqual([c.modo, c.kcal, c.prot, c.frase, c.fraseProt], ['alimentos', null, null, '', ''], rotulo);
    const h = resumoDeHoje({ ...st, diario: { dias: [{ data: HOJE, itens: [{ id: 'a', al: 'arroz-branco-cozido', g: 125 }] }] } }, HOJE);
    assert.deepEqual([h.modo, h.kcal, h.frase, h.n], ['alimentos', null, '', 1], rotulo + ' (Início)');
    assert.ok(resumoDaSemana({ dias: [{ data: HOJE, itens: [{ id: 'a', al: 'arroz-branco-cozido', g: 125 }] }] }, HOJE, null, st).dias.every((d) => d.kcal === null), rotulo + ' (semana)');
  }
  // entrevista de nutrição completa como adulto, mas outra entrevista diz menor: vale o mais protegido
  const r = calcular(adulto);
  assert.equal(modoDoDiario(r), 'meta'); assert.equal(modoDoDiario(r, { nutri: { answers: adulto }, trainer: { answers: { idade: 16 } } }), 'alimentos');
  assert.equal(modoDoDiario(r, { nutri: { answers: adulto }, sono: { idade: 14 } }), 'alimentos');
  // gestação, pós-parto e doença renal marcados só em outra entrevista: soma, sem meta
  for (const [rotulo, st] of [['gestante na corrida', { run: { answers: { idade: 30, condicoes: ['gestante'] } } }], ['gestante no Treinador', { trainer: { answers: { idade: 30, condicoes: ['gestante'] } } }],
    ['pós-parto na corrida', { run: { answers: { condicoes: ['posparto'] } } }], ['doença renal na corrida', { run: { answers: { condicoes: ['renal', 'hipertensao'] } } }]]) {
    assert.equal(modoDoDiario(null, st), 'soma', rotulo + ' sem nutrição');
    assert.equal(modoDoDiario(r, { ...st, nutri: { answers: adulto } }), 'soma', rotulo + ' com nutrição de adulto');
    const c = compararComMeta({ kcal: 1800, p: 90, n: 4 }, r, { ...st, nutri: { answers: adulto } });
    assert.equal(c.metaKcal, null); assert.equal(c.difKcal, null); assert.ok(!/Faltam|passou|meta/.test(c.frase + c.fraseProt), rotulo);
  }
  // adulto sem nutrição: soma (transtorno alimentar só é perguntado pela Nutricionista)
  for (const st of [{ trainer: { answers: { idade: 30 } } }, { run: { answers: { idade: 45, condicoes: ['hipertensao'] } } }, { sono: { idade: 25 } }, {}, null]) assert.equal(modoDoDiario(null, st), 'soma');
  assert.equal(modoDoDiario(null, { nutri: { answers: { condicoes: ['transtorno'] } } }), 'sem', 'transtorno marcado numa entrevista incompleta já tira o diário');
  assert.equal(modoDoDiario(null, { nutri: { answers: { condicoes: ['transtorno'] } }, trainer: { answers: { idade: 15 } } }), 'sem', 'transtorno vence a idade');
  // lixo no estado não quebra nem desprotege
  for (const st of [{ trainer: 'x', run: [], sono: 5, nutri: null }, { trainer: { answers: { idade: 'quinze', condicoes: 'gestante' } } }, { trainer: { answers: { idade: -3 } } }, { sono: { idade: 999 } }]) assert.equal(modoDoDiario(null, st), 'soma');
  assert.deepEqual(perfilDoDiario({ trainer: { answers: { idade: 40.9 } }, run: { answers: { idade: 16.5, condicoes: ['gestante', 'nenhuma', 7] } } }), { idade: 16, condicoes: new Set(['gestante']) });
});

test('A3: calorias só em número inteiro; ponto ou espaço de milhar valem; o ambíguo é recusado', () => {
  assert.deepEqual(['1200', '1.200', '1 200', ' 350 ', '0', '12.500', '4.999'].map(lerCalorias), [1200, 1200, 1200, 350, 0, 12500, 4999]);
  for (const ruim of ['', '  ', '1,5', '12.5', '1.20', '1.2000', '1,200', '1200 kcal', 'abc', '-50', '1e3', '0x10', '1..200', '1 20', '123456', null, undefined, 12.5, NaN, {}]) assert.equal(lerCalorias(ruim), null, JSON.stringify(ruim));
  assert.equal(lerCalorias(310), 310);
  assert.deepEqual(['4', '4,5', '12.5', '0', '120'].map(lerProteina), [4, 4.5, 12.5, 0, 120]);
  for (const ruim of ['', '1.200', '4,55', '1 2', 'x', '-1', '1e2', '4,', null, undefined, NaN]) assert.equal(lerProteina(ruim), null, JSON.stringify(ruim));
});

test('A4: o diário só grava dentro dos últimos 400 dias, e nunca devolve sucesso para um item que não ficou guardado', () => {
  const primeiro = primeiroDiaDoDiario(HOJE);
  assert.equal(primeiro, somarDias(HOJE, -(MAX_DIAS - 1)));
  assert.equal(primeiroDiaDoDiario('2020-02-01'), '2020-01-01', 'nunca antes de 2020');
  // diário cheio: 400 dias seguidos até hoje
  const cheio = diarioPadrao();
  for (let i = MAX_DIAS - 1; i >= 0; i--) assert.ok(gravarItem(cheio, somarDias(HOJE, -i), { al: 'ovo-cozido', g: 50 }, HOJE));
  assert.equal(cheio.dias.length, MAX_DIAS); assert.equal(cheio.dias[0].data, primeiro);
  const antes = J(cheio);
  for (const atras of [MAX_DIAS, MAX_DIAS + 20, 800]) assert.equal(gravarItem(cheio, somarDias(HOJE, -atras), { al: 'ovo-cozido', g: 50 }, HOJE), null, `hoje − ${atras} é recusado`);
  assert.deepEqual(cheio, antes, 'nada mudou');
  // dentro da janela, grava e fica guardado, mesmo com o diário cheio
  for (const atras of [0, 1, 200, MAX_DIAS - 1]) { const it = gravarItem(cheio, somarDias(HOJE, -atras), { nome: 'Suco', kcal: 90 }, HOJE); assert.ok(it && itensDoDia(cheio, somarDias(HOJE, -atras)).some((x) => x.id === it.id), `hoje − ${atras}`); }
  assert.equal(cheio.dias.length, MAX_DIAS);
  // dias antigos vindos de um backup (fora da janela) não fazem um registro novo sumir
  const comAntigos = limparDiario({ dias: Array.from({ length: MAX_DIAS }, (_, i) => ({ data: somarDias(HOJE, -(500 + i)), itens: [{ id: 'a', al: 'ovo-cozido', g: 50 }] })) }, HOJE);
  assert.equal(comAntigos.dias.length, MAX_DIAS);
  const novo = gravarItem(comAntigos, somarDias(HOJE, -3), { al: 'banana-prata', g: 70 }, HOJE);
  assert.ok(novo && itensDoDia(comAntigos, somarDias(HOJE, -3)).length === 1 && comAntigos.dias.length === MAX_DIAS, 'o dia novo fica; sai o mais antigo');
  // a validação aceita um "hoje" distante e a opção de não cortar o futuro (relógio do aparelho atrasado)
  const futuro = { dias: [{ data: somarDias(HOJE, 20), itens: [{ id: 'a', al: 'ovo-cozido', g: 50 }] }, { data: HOJE, itens: [{ id: 'a', al: 'ovo-cozido', g: 50 }] }] };
  assert.equal(limparDiario(futuro, HOJE).dias.length, 1);
  assert.equal(limparDiario(futuro, '9999-12-31').dias.length, 2); assert.equal(limparDiario(futuro, HOJE, { semCorteDeFuturo: true }).dias.length, 2);
  assert.equal(limparDiario(futuro, 'lixo', { semCorteDeFuturo: true }).dias.length, 2);
  assert.deepEqual(limparDiario({ dias: [{ data: '9999-12-31', itens: [{ id: 'a', al: 'ovo-cozido', g: 50 }] }] }, '9999-12-31').dias.map((d) => d.data), ['9999-12-31']);
});

test('A5: proteína — os números mostrados e a frase concordam; singular em 1 g', () => {
  const r = calcular(base);
  const com = (p) => compararComMeta({ kcal: 1000, p, n: 2 }, r);
  let c = com(r.prot - 0.5);
  assert.equal(c.prot, r.prot, 'mostra meta / meta'); assert.equal(c.difProt, 0); assert.equal(c.fraseProt, 'Proteína: meta do dia atingida.');
  c = com(r.prot - 0.6); assert.equal(c.prot, r.prot - 1); assert.equal(c.fraseProt, 'Proteína: falta 1 g.');
  c = com(r.prot - 1.4); assert.equal(c.prot, r.prot - 1); assert.equal(c.fraseProt, 'Proteína: falta 1 g.');
  c = com(r.prot - 1.6); assert.equal(c.prot, r.prot - 2); assert.equal(c.fraseProt, 'Proteína: faltam 2 g.');
  c = com(r.prot + 40); assert.equal(c.fraseProt, 'Proteína: meta do dia atingida.');
  // em toda a faixa, "comido / meta" e a frase dizem a mesma coisa
  for (let p = 0; p <= r.prot + 5; p += 0.1) { c = com(p); assert.equal(c.difProt, r.prot - c.prot); assert.equal(/atingida/.test(c.fraseProt), c.prot >= r.prot, String(p)); if (c.prot < r.prot) assert.ok(c.fraseProt.includes(` ${r.prot - c.prot} g.`), c.fraseProt); }
});

test('A8: cada dia é comparado com a meta daquele dia (a meta muda com a semana do plano de corrida)', () => {
  const st = { nutri: { answers: { ...base, idade: 34, peso: 72, altura: 175, treinos: '0', refeicoes: '4' } }, run: { answers: CORRIDA, aceitoEm: '2026-09-07T12:00:00.000Z', inicio: '2026-09-07', pausadoEm: '' }, runs: [], dores: [], diario: diarioPadrao() };
  const antes = metaDoDia(st, '2026-09-01'), s1 = metaDoDia(st, '2026-09-09'), s9 = metaDoDia(st, '2026-11-04'), s11 = metaDoDia(st, HOJE);
  assert.ok(antes.kcal < s1.kcal && s1.kcal < s9.kcal, `a meta acompanha a semana do plano: ${antes.kcal}, ${s1.kcal}, ${s9.kcal}`);
  assert.equal(metaDoDia(st, somarDias(HOJE, 2)).kcal, s11.kcal, 'na mesma semana do plano, a mesma meta');
  assert.notEqual(metaDoDia(st, somarDias(HOJE, -1)).kcal, s11.kcal, 'o domingo anterior é de outra semana do plano');
  // os últimos 7 dias cruzam a virada de semana do plano: sexta passada é da semana anterior; hoje (segunda), da atual
  const seg = HOJE;
  const mDom = metaDoDia(st, somarDias(HOJE, -3)), mSeg = metaDoDia(st, seg);
  gravarItem(st.diario, somarDias(HOJE, -3), { nome: 'Dia inteiro', kcal: 2000, p: 100 }, HOJE);
  gravarItem(st.diario, seg, { nome: 'Dia inteiro', kcal: 2000, p: 100 }, HOJE);
  const s = resumoDaSemana(st.diario, HOJE, mSeg, st);
  const dias = s.dias.filter((d) => d.n > 0);
  assert.deepEqual(dias.map((d) => d.metaKcal), [mDom.kcal, mSeg.kcal], 'cada dia registrado traz a meta daquele dia');
  if (mDom.kcal !== mSeg.kcal) {
    assert.equal(s.metasIguais, false); assert.equal(s.metaKcal, Math.round((mDom.kcal + mSeg.kcal) / 20) * 10); assert.ok(/média das metas desses dias/.test(s.frase), s.frase);
  } else { assert.equal(s.metasIguais, true); assert.ok(/\(meta: /.test(s.frase)); }
  assert.equal(s.difMedia, Math.round((s.metaKcal - 2000) / 10) * 10 || 0);
  // sem plano de corrida, todos os dias têm a mesma meta e a frase diz só "meta"
  const semCorrida = { nutri: { answers: base }, diario: st.diario };
  const s2 = resumoDaSemana(st.diario, HOJE, metaDoDia(semCorrida, HOJE), semCorrida);
  assert.equal(s2.metasIguais, true); assert.ok(/\(meta: /.test(s2.frase)); assert.equal(s2.metaKcal, calcular(base).kcal);
  // dia passado comparado com a meta dele
  const c = compararComMeta(totaisDoDia(st.diario, somarDias(HOJE, -3)), mDom, st);
  assert.equal(c.metaKcal, mDom.kcal); assert.equal(c.difKcal, Math.round((mDom.kcal - 2000) / 10) * 10);
});

test('A10: "Comi isso" só some quando a refeição sugerida já foi copiada; copiar não duplica', () => {
  const r = calcular({ ...base, refeicoes: '4' });
  const almoco = cardapio(r, 0).refeicoes.find((x) => x.nome === 'Almoço');
  const d = diarioPadrao();
  assert.equal(refeicaoCopiada(d, HOJE, almoco), false);
  // um lanche avulso lançado no horário do almoço não conta como a refeição sugerida
  gravarItem(d, HOJE, { ref: 'almoco', nome: 'Pão de queijo', kcal: 150 }, HOJE);
  gravarItem(d, HOJE, { ref: 'almoco', al: 'banana-prata', g: 70 }, HOJE);
  assert.equal(refeicaoRegistrada(d, HOJE, 'almoco'), true); assert.equal(refeicaoCopiada(d, HOJE, almoco), false, 'o botão "Comi isso" continua');
  // um alimento da sugestão lançado à mão: a cópia completa o resto, sem repetir
  const primeiro = almoco.itens[0];
  gravarItem(d, HOJE, { ref: 'almoco', al: primeiro.id, g: 999 }, HOJE);
  assert.equal(refeicaoCopiada(d, HOJE, almoco), false);
  assert.equal(copiarRefeicao(d, HOJE, almoco, HOJE), almoco.itens.length - 1);
  assert.equal(refeicaoCopiada(d, HOJE, almoco), true);
  assert.equal(itensDoDia(d, HOJE).find((x) => x.al === primeiro.id).g, 999, 'a quantidade que a pessoa lançou fica');
  // tocar de novo não duplica nada
  const n = itensDoDia(d, HOJE).length;
  assert.equal(copiarRefeicao(d, HOJE, almoco, HOJE), 0); assert.equal(itensDoDia(d, HOJE).length, n);
  for (const x of almoco.itens) assert.equal(itensDoDia(d, HOJE).filter((y) => y.ref === 'almoco' && y.al === x.id).length, 1, x.id);
  // o mesmo alimento em OUTRA refeição não conta; corrigir a quantidade mantém "copiada"; apagar um item devolve o botão
  const jantar = cardapio(r, 0).refeicoes.find((x) => x.nome === 'Jantar');
  assert.equal(refeicaoCopiada(d, HOJE, jantar), false);
  const it = itensDoDia(d, HOJE).find((x) => x.al === almoco.itens[1].id);
  gravarItem(d, HOJE, { ...it, g: it.g + 50 }, HOJE); assert.equal(refeicaoCopiada(d, HOJE, almoco), true);
  apagarItem(d, HOJE, it.id); assert.equal(refeicaoCopiada(d, HOJE, almoco), false);
  for (const lixo of [null, {}, { nome: 'Almoço' }, { nome: 'Almoço', itens: [] }, { nome: 'Almoço', itens: [{ id: 'nao-existe', g: 1 }] }]) assert.equal(refeicaoCopiada(d, HOJE, lixo), false);
});

test('A11: busca sem acento nem pontuação, pelo começo das palavras', () => {
  const ids = (t) => buscarAlimentos(t).map((f) => f.id);
  assert.ok(ids('arroz, cozido').includes('arroz-branco-cozido') && ids('arroz, cozido').includes('arroz-integral-cozido'));
  assert.ok(ids('leite (integral)').includes('leite-integral'));
  assert.deepEqual(ids('banana pra'), ['banana-prata']); assert.ok(ids('pao fr').includes('pao-frances')); assert.ok(ids('PÃO   FRANCÊS!!').includes('pao-frances'));
  assert.ok(!ids('coca').includes('pacoca'), '"coca" não acha "Paçoca"'); assert.ok(ids('paco').includes('pacoca'));
  assert.ok(!ids('rroz').length, 'meio de palavra não vale');
  // quem começa pelo termo vem primeiro
  assert.ok(ids('fei')[0].startsWith('feij')); assert.equal(FOOD.get(ids('ovo')[0]).nome.toLowerCase().startsWith('ovo'), true);
  const queijo = buscarAlimentos('queijo'); const fora = queijo.findIndex((f) => !/^queijo/i.test(f.nome));
  assert.ok(queijo.length >= 5 && (fora < 0 || queijo.slice(fora).every((f) => !/^queijo/i.test(f.nome))), 'nomes que começam por "queijo" antes de "Pão de queijo" e "Omelete de queijo"');
  // menos de 2 letras, lixo e limite
  for (const t of ['', ' ', 'a', '!', '()', null, undefined, 5, {}]) assert.deepEqual(buscarAlimentos(t), []);
  assert.equal(buscarAlimentos('co', 5).length, 5); assert.ok(buscarAlimentos('co').length <= 40);
  assert.deepEqual(buscarAlimentos('zzqx'), []);
  // todo alimento é achado pelo próprio nome
  for (const f of ALIMENTOS) assert.ok(buscarAlimentos(f.nome, 200).some((x) => x.id === f.id), f.nome);
});

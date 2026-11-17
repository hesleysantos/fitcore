// Suplementos e pré-treino da Nutricionista (logic/nutrition.js — suplementos, limiteDeCafeina): travas por perfil,
// nenhuma dose no modo educativo, cafeína somada ao café nunca acima do limite da EFSA e fontes que existem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REFS, FAQ_NUTRI } from '../www/js/data/knowledge.js';
import { PERGUNTAS, calcular, contextoDasEntrevistas, suplementos, limiteDeCafeina } from '../www/js/logic/nutrition.js';

const base = { objetivo: 'manter', sexo: 'm', idade: 30, peso: 80, altura: 178, atividade: 'leve', treinos: '4', horario: 'tarde', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };
const corre = { kmSemana: 30, minSemana: 180, sessoesSemana: 3, longoKm: 10, longoMin: 60 };
// qualquer número com unidade de dose (g, mg, mmol) ou dose por quilo
const DOSE = /\d[\d.,]*\s*(a\s*\d[\d.,]*\s*)?(mg|g|mmol)\b|por quilo/;
const MG = /\d[\d.,]*\s*(a\s*\d[\d.,]*\s*)?mg\b/;
// todo o texto que a tela pode mostrar
const textos = (s) => [s.intro, s.aviso, ...s.linhas, ...s.boas.flatMap((b) => [b.nome, b.texto, b.porque]), s.preTreino.intro,
  ...s.preTreino.itens.flatMap((x) => [x.titulo, x.texto, x.porque || '']), ...s.semEvidencia.flatMap((x) => [x.nome, x.texto])];
const tudo = (s) => textos(s).join(' ');
const preTexto = (s) => [s.preTreino.intro, ...s.preTreino.itens.flatMap((x) => [x.texto, x.porque || ''])].join(' ');

test('modo educativo (menor, gestação, pós-parto, rins, transtorno): nenhuma dose, sem pré-treino e com o encaminhamento', () => {
  const casos = [
    ['menor aqui', calcular({ ...base, idade: 16, peso: 60, altura: 170 }), /Antes dos 18 anos/],
    ['menor no Treinador', calcular(base, null, contextoDasEntrevistas({ trainer: { answers: { idade: 15, condicoes: ['nenhuma'] } } })), /Antes dos 18 anos/],
    ['menor na tela do sono', calcular(base, corre, contextoDasEntrevistas({ sono: { idade: 14 } })), /Antes dos 18 anos/],
    ['gestante', calcular({ ...base, sexo: 'f', peso: 62, altura: 163, condicoes: ['gestante'] }), /gestação e na amamentação/],
    ['pós-parto na corrida', calcular({ ...base, sexo: 'f' }, corre, contextoDasEntrevistas({ run: { answers: { idade: 30, condicoes: ['posparto'] } } })), /gestação e na amamentação/],
    ['rins', calcular({ ...base, condicoes: ['renal'] }), /doença nos rins/],
    ['transtorno', calcular({ ...base, condicoes: ['transtorno'] }), /transtorno alimentar/],
    ['transtorno contado ao Treinador', calcular(base, corre, contextoDasEntrevistas({ trainer: { answers: { idade: 30, condicoes: ['transtorno'] } } })), /transtorno alimentar/],
    ['rins e pressão alta', calcular({ ...base, condicoes: ['renal', 'hipertensao'] }), /doença nos rins/],
  ];
  for (const [rot, r, motivo] of casos) {
    assert.equal(r.modo, 'educativo', rot);
    const s = suplementos(r);
    assert.equal(s.semDoses, true, rot); assert.equal(s.semCafeina, true, rot); assert.equal(s.semPreTreino, true, rot);
    assert.equal(s.linhas.length, 0, rot); assert.equal(s.boas.length, 0, rot);
    assert.equal(s.preTreino.bloqueado, true, rot);
    assert.match(s.preTreino.intro, motivo, rot);
    assert.ok(!DOSE.test(tudo(s)), `${rot}: dose no modo educativo — ${textos(s).find((t) => DOSE.test(t))}`);
    assert.ok(/médico ou nutricionista/.test(s.aviso), rot);
    assert.equal(limiteDeCafeina(r, 0), null, rot);
    // o que não se deve usar continua aparecendo (sem número): DMAA, sinefrina, ioimbina e a lista sem evidência
    assert.ok(/DMAA/.test(preTexto(s)) && /ioimbina/.test(preTexto(s)) && /sinefrina/.test(preTexto(s)), rot);
    assert.ok(s.semEvidencia.length >= 5 && s.semEvidencia.some((x) => x.nome === 'BCAA'), rot);
  }
  assert.equal(suplementos(null).semDoses, true);
  assert.equal(suplementos(null).preTreino.bloqueado, true);
  assert.equal(limiteDeCafeina(null), null);
});

test('pressão alta, coração, outra doença crônica e sinal de alerta: sem cafeína, sem pré-treino e sem dose de estimulante', () => {
  const casos = [
    ['pressão alta', calcular({ ...base, condicoes: ['hipertensao'] }, corre)],
    ['coração', calcular({ ...base, condicoes: ['cardiaco'] }, corre)],
    ['outra doença crônica', calcular({ ...base, condicoes: ['outra'] }, corre)],
    ['pressão alta no Treinador', calcular(base, corre, contextoDasEntrevistas({ trainer: { answers: { idade: 30, condicoes: ['hipertensao'] } } }))],
    ['dor no peito na corrida', calcular(base, corre, contextoDasEntrevistas({ run: { answers: { idade: 30, condicoes: ['nenhuma'], triagem: ['dor_peito'] } } }))],
    ['palpitação no Treinador', calcular(base, corre, contextoDasEntrevistas({ trainer: { answers: { idade: 30, condicoes: ['nenhuma'], triagem: ['palpitacao'] } } }))],
  ];
  for (const [rot, r] of casos) {
    assert.notEqual(r.modo, 'educativo', rot);
    const s = suplementos(r);
    assert.equal(s.semDoses, false, rot); assert.equal(s.semCafeina, true, rot); assert.equal(s.semPreTreino, true, rot);
    assert.equal(s.preTreino.bloqueado, true, rot);
    assert.match(s.preTreino.intro, /pré-treino não/, rot);
    assert.ok(!MG.test(preTexto(s)), rot + ': mg no pré-treino');
    assert.equal(limiteDeCafeina(r, 0), null, rot);
    const b = Object.fromEntries(s.boas.map((x) => [x.id, x]));
    assert.match(b.creatina.texto, /3 a 5 g/, rot);   // creatina não é estimulante: continua
    for (const id of ['cafeina', 'betaalanina', 'nitrato', 'bicarbonato']) assert.ok(b[id] && !DOSE.test(b[id].texto + ' ' + b[id].porque), `${rot}: dose de ${id}`);
    assert.ok(/médic/.test(b.cafeina.texto + ' ' + s.aviso) && /médico/.test(s.preTreino.intro), rot);
  }
  // com pressão alta (ou coração), o bicarbonato — muito sódio — sai de vez
  for (const c of ['hipertensao', 'cardiaco']) assert.match(suplementos(calcular({ ...base, condicoes: [c] }, corre)).boas.find((x) => x.id === 'bicarbonato').texto, /não use/);
});

test('adulto sem restrição: as três partes, com doses só onde cabem; corredor vê nitrato e bicarbonato', () => {
  const r = calcular(base, corre);
  const s = suplementos(r);
  assert.equal(s.semDoses, false); assert.equal(s.semPreTreino, false); assert.equal(s.preTreino.bloqueado, false);
  assert.deepEqual(s.boas.map((x) => x.id), ['creatina', 'cafeina', 'proteina', 'betaalanina', 'nitrato', 'bicarbonato', 'vitaminas']);
  assert.deepEqual(s.linhas, s.boas.map((x) => `${x.nome}: ${x.texto}`));
  const b = Object.fromEntries(s.boas.map((x) => [x.id, x]));
  assert.match(b.betaalanina.texto, /até 2 g por dia, em doses de até 300 mg/);
  assert.match(b.nitrato.texto, /310 a 560 mg/);
  assert.ok(!DOSE.test(b.bicarbonato.texto), 'bicarbonato: a dose fica no porquê, com o sódio');
  assert.ok(!DOSE.test(b.vitaminas.texto) && /exame/.test(b.vitaminas.texto), 'vitamina D e ferro: só com exame');
  const titulos = s.preTreino.itens.map((x) => x.titulo);
  assert.deepEqual(titulos, ['O que tem dentro', 'Quanto de cafeína', 'Horário', 'Quando parar', 'Fuja destes', 'Exame antidoping']);
  assert.match(preTexto(s), /palpitação, tontura, ansiedade ou insônia/);
  assert.match(preTexto(s), /13 horas/);
  assert.match(preTexto(s), /terceira parte/);
  // sem corrida: nada de nitrato nem bicarbonato, e beta-alanina sem dose
  const m = suplementos(calcular(base));
  assert.deepEqual(m.boas.map((x) => x.id), ['creatina', 'cafeina', 'proteina', 'betaalanina', 'vitaminas']);
  assert.ok(!DOSE.test(m.boas.find((x) => x.id === 'betaalanina').texto));
  // à noite, o pré-treino com cafeína não combina com o horário
  assert.match(suplementos(calcular({ ...base, horario: 'noite' })).preTreino.itens.find((x) => x.titulo === 'Horário').texto, /prefira sem cafeína/);
  assert.ok(!/prefira sem cafeína/.test(preTexto(s)));
});

test('proteína em pó: alergia ao leite tira o whey; vegano recebe a de planta', () => {
  const leite = suplementos(calcular({ ...base, alergias: ['leite'] }));
  assert.ok(!leite.linhas.some((l) => /Whey protein: só uma forma prática/.test(l)));
  assert.match(leite.boas.find((x) => x.id === 'proteina').texto, /com alergia ao leite, não use/);
  const veg = suplementos(calcular({ ...base, restricoes: ['vegano'] }));
  assert.match(veg.boas.find((x) => x.id === 'proteina').texto, /para veganos, há as de soja/);
  const vegSoja = suplementos(calcular({ ...base, restricoes: ['vegano'], alergias: ['soja'] }));
  assert.ok(!/de soja/.test(vegSoja.boas.find((x) => x.id === 'proteina').texto));
});

test('cafeína do pré-treino somada ao café: nunca passa de 200 mg por vez nem de 400 mg no dia (EFSA), em nenhum peso', () => {
  let n = 0;
  for (let peso = 30; peso <= 250; peso += 0.5) {
    const r = calcular({ ...base, peso, altura: 175 });
    if (r.modo === 'educativo') continue;
    const s = suplementos(r);
    for (const x of [-3, 0, 0.7, 1, 2, 3, 4, 5, 9, 12, NaN, '2', undefined]) {
      const l = limiteDeCafeina(r, x);
      n++;
      assert.ok(l.porVez <= 200 && l.noDia <= 400, `peso ${peso}`);
      // o limite por quilo da EFSA (3 e 5,7 mg/kg, os de um adulto de 70 kg) nunca é passado
      assert.ok(l.porVez <= (200 * r.peso) / 70 + 1e-9 && l.noDia <= (400 * r.peso) / 70 + 1e-9, `peso ${peso}`);
      // o pré-treino nunca leva a soma acima do limite do dia: se o café já chega lá, não sobra nada
      assert.ok(l.sobra >= 0 && l.sobra <= l.porVez && (l.sobra === 0 || l.doCafe + l.sobra <= l.noDia), `peso ${peso}, ${x} xícaras`);
      if (l.doCafe >= l.noDia) assert.equal(l.sobra, 0);
      assert.ok(Number.isInteger(l.xicaras) && l.xicaras >= 0 && l.xicaras <= 10);
      assert.ok(!/NaN|undefined/.test(l.texto) && l.texto.length <= 140, l.texto);
      if (l.sobra === 0) assert.match(l.texto, /pré-treino com cafeína, não/);
    }
    // o texto da tela usa o mesmo limite por dose e por dia, no pré-treino e na linha da cafeína
    assert.match(s.preTreino.itens.find((x) => x.cafeina).texto, new RegExp(`^Até ${limiteDeCafeina(r).porVez} mg por dose e ${limiteDeCafeina(r).noDia} mg no dia`));
    assert.match(s.boas.find((x) => x.id === 'cafeina').texto, new RegExp(`até ${limiteDeCafeina(r).porVez} mg por vez\\), 1 hora antes do treino, sem passar de ${limiteDeCafeina(r).noDia} mg por dia`));
  }
  assert.ok(n > 3000);
  const r70 = calcular({ ...base, peso: 70, altura: 175 });
  assert.deepEqual([limiteDeCafeina(r70, 0).porVez, limiteDeCafeina(r70, 0).noDia], [200, 400]);
  assert.equal(limiteDeCafeina(r70, 2).sobra, 200);
  assert.equal(limiteDeCafeina(r70, 3).sobra, 100);
  assert.equal(limiteDeCafeina(r70, 4).sobra, 0);
  assert.deepEqual([limiteDeCafeina(calcular({ ...base, peso: 50, altura: 160 }), 0).porVez, limiteDeCafeina(calcular({ ...base, peso: 50, altura: 160 }), 0).noDia], [140, 280]);
});

test('muitos perfis: travas coerentes, linhas curtas, sem lixo e com fontes que existem', () => {
  const op = (k) => PERGUNTAS.find((q) => q.k === k).op.map((o) => o[0]);
  let semente = 777;
  const rnd = () => { semente = (semente * 1103515245 + 12345) & 0x7fffffff; return semente / 0x7fffffff; };
  const um = (l) => l[Math.floor(rnd() * l.length)];
  const SINAIS = ['dor_peito', 'falta_ar', 'tontura', 'palpitacao', 'nenhum'];
  for (let i = 0; i < 3000; i++) {
    const a = { objetivo: um(op('objetivo')), sexo: um(op('sexo')), idade: 12 + Math.floor(rnd() * 80), peso: 35 + Math.round(rnd() * 150), altura: 140 + Math.round(rnd() * 65), atividade: um(op('atividade')), treinos: um(op('treinos')), horario: um(op('horario')), refeicoes: um(op('refeicoes')), restricoes: [um(op('restricoes'))], condicoes: [um(op('condicoes'))], alergias: [um(op('alergias'))] };
    const ctx = rnd() < 0.4 ? contextoDasEntrevistas({ trainer: { answers: { idade: rnd() < 0.1 ? 16 : a.idade, condicoes: [um(['nenhuma', 'hipertensao', 'cardiaco', 'cronica', 'transtorno'])], triagem: [um(SINAIS)] } } }) : null;
    const r = calcular(a, rnd() < 0.4 ? corre : null, ctx);
    const s = suplementos(r);
    const rot = JSON.stringify(a);
    const c = r.condicoes;
    const deveTravar = r.modo === 'educativo' || ['hipertensao', 'cardiaco', 'outra', 'sinal'].some((x) => c.includes(x));
    assert.equal(s.semPreTreino, deveTravar, rot);
    assert.equal(s.preTreino.bloqueado, deveTravar, rot);
    assert.equal(s.semDoses, r.modo === 'educativo', rot);
    if (r.idade < 18 || c.includes('gestante') || c.includes('posparto') || c.includes('renal') || c.includes('transtorno')) assert.equal(s.semDoses, true, rot);
    if (s.semDoses) assert.ok(!DOSE.test(tudo(s)), rot);
    if (s.semCafeina) { assert.ok(!MG.test(preTexto(s)), rot); assert.equal(limiteDeCafeina(r, 1), null, rot); }
    if ((r.alergias || []).includes('leite')) assert.ok(!s.linhas.some((l) => /Whey protein: só uma forma prática/.test(l)), rot);
    for (const t of textos(s)) assert.ok(typeof t === 'string' && !/undefined|NaN|null|\[object/.test(t), rot + ' — ' + t);
    for (const b of s.boas) assert.ok(b.texto.length <= 230 && b.porque.length <= 330, `${b.id}: ${b.texto.length}/${b.porque.length}`);
    for (const x of s.preTreino.itens) assert.ok(x.texto.length <= 200 && (!x.porque || x.porque.length <= 330), x.titulo);
    assert.ok(s.preTreino.intro.length <= 230, s.preTreino.intro);
    for (const x of s.semEvidencia) assert.ok(x.texto.length <= 140, x.nome);
    for (const k of s.refs) assert.ok(REFS[k], 'fonte inexistente: ' + k);
    for (const x of [...s.boas, ...s.preTreino.itens, ...s.semEvidencia]) assert.ok(x.refs.length >= 1 && x.refs.every((k) => REFS[k]), rot);
  }
});

test('perguntas frequentes de suplementos: existem, são curtas e citam fontes lidas', () => {
  const q = (t) => FAQ_NUTRI.find((x) => x.q === t);
  for (const t of ['Devo tomar pré-treino?', 'Pré-treino faz mal?', 'Posso tomar pré-treino e café no mesmo dia?', 'BCAA funciona?', 'Termogênico emagrece?', 'Suplemento pode dar doping?', 'Preciso tomar vitamina D ou ferro?', 'Beta-alanina dá formigamento. É perigoso?', 'E anabolizante, SARM ou “testosterona natural”?']) {
    const x = q(t);
    assert.ok(x, t);
    const palavras = x.a.join(' ').split(/\s+/).length;
    assert.ok(palavras <= 85, `${t}: ${palavras} palavras`);
    assert.ok(x.f.length && x.f.every((k) => REFS[k]), t);
  }
  for (const k of ['maughan2018', 'trexler2015', 'harty2018', 'jagim2019', 'kerksick2018', 'bella2025', 'porrill2024', 'bfr2012', 'ais_abcd', 'anvisa_rdc243', 'anvisa_in28', 'anvisa2013', 'cfm2333']) assert.ok(REFS[k], k);
});

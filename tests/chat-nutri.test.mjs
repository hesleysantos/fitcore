// Testes dos assuntos da Nutricionista no chat (www/js/logic/chat/nutri.js): cada assunto percorrido até o fim em vários
// perfis, as proteções (nenhum número de calorias, peso ou gramas para transtorno alimentar e menores de 18), a detecção
// de sinais de risco no texto e as ações aplicadas no estado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitize } from '../www/js/store.js';
import { REFS } from '../www/js/data/knowledge.js';
import { calcular, contextoDasEntrevistas, cardapioDoDia, trocarRefeicaoDoDia, limparAjustes, assinatura } from '../www/js/logic/nutrition.js';
import { ABRIR } from '../www/js/logic/chat/contrato.js';
import { INTENCOES, sinaisDeRisco, passoDeRisco, perfilNutri, protegido, alimentoNoTexto, normalizar, REFS_NOVAS } from '../www/js/logic/chat/nutri.js';

const HOJE = '2026-11-17';
const AGORA = Date.parse(HOJE + 'T15:00:00');
const NUTRI = { objetivo: 'emagrecer', sexo: 'f', idade: 32, peso: 72, altura: 165, atividade: 'leve', treinos: '3', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], alergias: ['nenhuma'], condicoes: ['nenhuma'] };
const TREINO = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, condicoes: ['nenhuma'], triagem: ['nenhum'], experiencia: 'intermediario', pausa: 'treinando', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'] };
const estado = ({ n = NUTRI, t = null, extra = {} } = {}) => sanitize({ nutri: { answers: n || {}, calculadoEm: '2026-11-01T10:00:00.000Z', ...(extra.nutri || {}) }, ...(t ? { trainer: { answers: t } } : {}), ...(extra.raiz || {}) });
const ctxDe = (st, texto) => ({ st, hoje: HOJE, agora: AGORA, ...(texto ? { texto } : {}) });

const PERFIS = {
  adulto: () => estado(),
  semEntrevista: () => estado({ n: null }),
  transtorno: () => estado({ n: { ...NUTRI, condicoes: ['transtorno'] } }),
  transtornoNoTreinador: () => estado({ t: { ...TREINO, condicoes: ['transtorno'] } }),
  transtornoSemNutri: () => estado({ n: null, t: { ...TREINO, condicoes: ['transtorno'] } }),
  menor: () => estado({ n: { ...NUTRI, idade: 16 } }),
  menorNoTreinador: () => estado({ t: { ...TREINO, idade: 15 } }),
  gestante: () => estado({ n: { ...NUTRI, condicoes: ['gestante'] } }),
  renal: () => estado({ n: { ...NUTRI, condicoes: ['renal'] } }),
  diabetes: () => estado({ n: { ...NUTRI, condicoes: ['diabetes'] } }),
  hipertensao: () => estado({ n: { ...NUTRI, condicoes: ['hipertensao'] } }),
  vegano: () => estado({ n: { ...NUTRI, objetivo: 'ganhar', restricoes: ['vegano'] } }),
  vegetarianoSemLactose: () => estado({ n: { ...NUTRI, objetivo: 'manter', restricoes: ['vegetariano', 'sem_lactose'] } }),
  alergias: () => estado({ n: { ...NUTRI, alergias: ['leite', 'ovo', 'amendoim'] } }),
  celiaco: () => estado({ n: { ...NUTRI, restricoes: ['sem_gluten'], alergias: ['peixe'] } }),
  homemTreinaMuito: () => estado({ n: { ...NUTRI, sexo: 'm', idade: 41, peso: 95, altura: 180, treinos: '6', horario: 'cedo', objetivo: 'manter', refeicoes: '6' } }),
  idoso: () => estado({ n: { ...NUTRI, idade: 70, objetivo: 'manter', refeicoes: '3' } }),
  comCasa: () => estado({ extra: { nutri: { emCasa: ['arroz-branco-cozido', 'feijao-carioca-cozido', 'ovo-cozido', 'banana-prata', 'pao-frances', 'leite-integral', 'tomate', 'alface-crespa', 'azeite-de-oliva', 'peito-de-frango-grelhado'] } } }),
  soCasa: () => estado({ extra: { nutri: { emCasa: ['arroz-branco-cozido', 'feijao-carioca-cozido', 'ovo-cozido', 'banana-prata', 'pao-frances', 'leite-integral', 'tomate', 'alface-crespa', 'azeite-de-oliva', 'peito-de-frango-grelhado'], soCasa: true } } }),
};
const ESTRITOS = ['transtorno', 'transtornoNoTreinador', 'transtornoSemNutri', 'menor', 'menorNoTreinador'];

// Percorre todos os caminhos de um passo (cada opção, até o fim), visitando cada passo.
function percorrer(passo, ctx, visita, caminho = [], prof = 0) {
  assert.ok(prof < 8, 'caminho longo demais: ' + caminho.join(' > '));
  visita(passo, caminho);
  if (!passo.opcoes) return 1;
  let folhas = 0;
  for (const o of passo.opcoes) folhas += percorrer(passo.proximo(o.valor, ctx), ctx, visita, [...caminho, o.rotulo], prof + 1);
  return folhas;
}
// todos os textos que a tela pode mostrar a partir de um passo
const textosDo = (p) => [
  ...(p.texto || []), ...(p.detalhes || []), p.aviso ? p.aviso.texto : '', ...(p.opcoes || []).map((o) => o.rotulo),
  ...(p.acoes || []).flatMap((a) => [a.rotulo, a.confirmar, a.depois || '']), ...(p.ir || []).map((i) => i.rotulo),
  ...(p.faq || []).flatMap((f) => [f.q, ...f.a]),
].filter(Boolean);
// número de calorias, peso corporal ou gramas/miligramas/litros (o que não pode aparecer para os protegidos)
const NUMERO_PROIBIDO = /\d[\d.,]*\s*(kcal|calorias?|kg|quilos?|g|gramas?|mg|ml|l|litros?)\b/i;
const ROTAS = new Set(['nutricao', 'progresso', 'treinador', 'corrida', 'treinos', 'sono']);
function conferePasso(p, onde) {
  assert.ok(Array.isArray(p.texto) && p.texto.length > 0, 'passo sem texto: ' + onde);
  for (const t of textosDo(p)) { assert.equal(typeof t, 'string', onde); assert.ok(!/undefined|null|NaN|\[object/.test(t), `texto quebrado em ${onde}: ${t}`); }
  for (const t of p.texto) assert.ok(t.length <= 260, `frase longa demais em ${onde}: ${t}`);
  if (p.detalhes) assert.ok(p.detalhes.length > 0 && p.detalhes.every((t) => t.trim()), 'detalhes vazios: ' + onde);
  if (p.opcoes) {
    assert.ok(p.opcoes.length >= 2 && p.opcoes.length <= 6, `${onde}: de 2 a 6 opções (${p.opcoes.length})`);
    assert.equal(typeof p.proximo, 'function', onde);
    assert.equal(new Set(p.opcoes.map((o) => o.valor)).size, p.opcoes.length, 'valores repetidos: ' + onde);
  }
  for (const k of p.refs || []) assert.ok(REFS[k], `ref inexistente ${k} em ${onde}`);
  for (const i of p.ir || []) assert.ok(i.rota ? ROTAS.has(i.rota) : ABRIR.includes(i.abrir), `atalho inválido em ${onde}`);
  if (p.aviso) assert.ok(['info', 'warn', 'danger'].includes(p.aviso.tipo), onde);
  for (const a of p.acoes || []) { assert.ok(a.rotulo && a.confirmar, onde); assert.ok(typeof a.aplicar === 'function' || a.iniciar, onde); }
}

test('intenções: ids únicos, coach, títulos curtos e palavras em minúsculas, sem acento e sem repetir', () => {
  assert.equal(new Set(INTENCOES.map((i) => i.id)).size, INTENCOES.length);
  const todas = new Map();
  for (const i of INTENCOES) {
    assert.ok(i.id.startsWith('nutri-'));
    assert.equal(i.coach, 'nutri');
    assert.ok(i.titulo.length <= 40, i.titulo);
    assert.ok(i.resumo && i.resumo === i.resumo.toLowerCase().replace(/^./, (c) => c), i.id);
    assert.equal(typeof i.inicio, 'function');
    assert.ok(i.palavras.length >= 8, i.id);
    for (const w of i.palavras) {
      // '!palavra' (marca forte) e 'a+b' (partes em qualquer lugar) são formatos do contrato
      for (const parte of w.replace(/^!/, '').split('+')) assert.equal(parte, normalizar(parte), `palavra fora do padrão em ${i.id}: ${w}`);
      assert.ok(!todas.has(w), `palavra repetida: "${w}" em ${i.id} e ${todas.get(w)}`);
      todas.set(w, i.id);
    }
  }
});

test('cada assunto percorrido até o fim em todos os perfis', () => {
  for (const [nome, fazer] of Object.entries(PERFIS)) {
    const st = fazer();
    const ctx = ctxDe(st);
    for (const i of INTENCOES) {
      if (i.disponivel && !i.disponivel(ctx)) continue;
      const folhas = percorrer(i.inicio(ctx), ctx, (p, c) => conferePasso(p, `${nome} / ${i.id} / ${c.join(' > ')}`));
      assert.ok(folhas >= 1);
    }
  }
});

test('transtorno alimentar e menores de 18: nenhum número de calorias, peso ou gramas em nenhum passo', () => {
  for (const nome of ESTRITOS) {
    const st = PERFIS[nome]();
    const ctx = ctxDe(st);
    assert.ok(protegido(ctx), nome + ' deveria ser protegido');
    for (const i of INTENCOES) {
      if (i.disponivel && !i.disponivel(ctx)) continue;
      percorrer(i.inicio(ctx), ctx, (p, c) => {
        for (const t of textosDo(p)) assert.ok(!NUMERO_PROIBIDO.test(t), `${nome} / ${i.id} / ${c.join(' > ')}: "${t}"`);
      });
    }
    // também com a dúvida de alimento vinda do texto
    for (const frase of ['posso comer pao frances?', 'quanto de arroz', 'refrigerante faz mal?', 'acai engorda']) {
      const ctxT = ctxDe(st, frase);
      percorrer(INTENCOES.find((x) => x.id === 'nutri-alimento').inicio(ctxT), ctxT, (p) => { for (const t of textosDo(p)) assert.ok(!NUMERO_PROIBIDO.test(t), `${nome} / ${frase}: "${t}"`); });
    }
  }
  // quem tem transtorno também não recebe porções nem frases sobre engordar
  const ctx = ctxDe(PERFIS.transtorno(), 'pao engorda?');
  const p = INTENCOES.find((x) => x.id === 'nutri-alimento').inicio(ctx);
  assert.ok(!textosDo(p).some((t) => /porção|engorda/i.test(t)), textosDo(p).join(' | '));
});

test('adulto com meta: as metas são as da própria conta (calcular), com fontes', () => {
  const st = PERFIS.adulto();
  const ctx = ctxDe(st);
  const r = calcular(st.nutri.answers, null, contextoDasEntrevistas(st));
  const metas = INTENCOES.find((x) => x.id === 'nutri-metas').inicio(ctx);
  assert.deepEqual(metas.opcoes.map((o) => o.valor), ['proteina', 'agua', 'refeicoes', 'calorias']);
  const prot = metas.proximo('proteina', ctx);
  assert.ok(prot.texto[0].includes(`${r.prot} g`), prot.texto[0]);
  assert.ok(prot.refs.includes('jager2017') && prot.refs.includes('morton2018'));
  const agua = metas.proximo('agua', ctx);
  assert.ok(agua.texto[0].includes(String(r.agua).replace('.', ',')), agua.texto[0]);
  assert.ok(agua.refs.includes('efsa2017'));
  const kcal = metas.proximo('calorias', ctx);
  assert.ok(kcal.texto[0].replace('.', '').includes(String(r.kcal)), kcal.texto[0]);
  assert.ok(metas.proximo('refeicoes', ctx).texto[0].includes('4 refeições'));
  // protegidos não têm a opção de calorias
  for (const nome of ['transtorno', 'menor', 'gestante', 'renal']) {
    const m = INTENCOES.find((x) => x.id === 'nutri-metas').inicio(ctxDe(PERFIS[nome]()));
    assert.ok(!m.opcoes.some((o) => o.valor === 'calorias'), nome);
  }
  // renal: água pelo médico
  const mr = INTENCOES.find((x) => x.id === 'nutri-metas').inicio(ctxDe(PERFIS.renal()));
  assert.ok(mr.proximo('agua').texto[0].includes('médico'));
  // sem entrevista: convida a responder
  const sem = INTENCOES.find((x) => x.id === 'nutri-metas').inicio(ctxDe(PERFIS.semEntrevista()));
  assert.ok(!sem.opcoes && sem.ir.some((i) => i.rota === 'nutricao'));
});

test('trocar uma refeição: a ação grava o mesmo ajuste do botão "Trocar" da tela e muda só aquela refeição', () => {
  const st = PERFIS.adulto();
  const ctx = ctxDe(st);
  const i = INTENCOES.find((x) => x.id === 'nutri-trocar');
  assert.ok(i.disponivel(ctx));
  const p1 = i.inicio(ctx);
  const r = calcular(st.nutri.answers, null, contextoDasEntrevistas(st));
  const antes = cardapioDoDia(r, HOJE, null);
  assert.deepEqual(p1.opcoes.map((o) => o.rotulo), antes.refeicoes.map((x) => x.nome));
  const almoco = antes.refeicoes.find((x) => x.nome === 'Almoço');
  const p2 = p1.proximo(String(almoco.ordem), ctx);
  const p3 = p2.proximo('nao_gosto', ctx);
  assert.equal(p3.acoes.length, 1);
  const s = structuredClone(st);
  assert.notEqual(p3.acoes[0].aplicar(s, ctx), false);
  const esperado = trocarRefeicaoDoDia(r, HOJE, null, almoco.ordem, { emCasa: null });
  assert.deepEqual(s.nutri.ajustes[HOJE], esperado);
  const depois = cardapioDoDia(r, HOJE, s.nutri.ajustes[HOJE]);
  const ids = (d, o) => d.refeicoes.find((x) => x.ordem === o).itens.map((x) => x.id).sort().join();
  assert.notEqual(ids(depois, almoco.ordem), ids(antes, almoco.ordem), 'o almoço mudou');
  assert.ok(assinatura(depois) !== assinatura(antes));
  // trocar de novo no estado novo dá outra troca, e os ajustes antigos (mais de 7 dias) saem
  s.nutri.ajustes['2026-10-01'] = { s: 3, m: [] };
  assert.notEqual(p3.acoes[0].aplicar(s, ctx), false);
  assert.ok(!s.nutri.ajustes['2026-10-01']);
  assert.notDeepEqual(s.nutri.ajustes[HOJE], esperado);
  // nada fora de s.nutri mudou
  const s2 = structuredClone(st); p3.acoes[0].aplicar(s2, ctx);
  assert.deepEqual({ ...s2, nutri: null }, { ...st, nutri: null });
  // sem entrevista no estado da hora: não dá (a tela avisa)
  const vazio = structuredClone(PERFIS.semEntrevista());
  assert.equal(p3.acoes[0].aplicar(vazio, ctx), false);
  assert.deepEqual(vazio.nutri.ajustes, {});
});

test('trocar: "não tenho em casa" liga a lista de casa; alergia aponta a entrevista e o rótulo', () => {
  const st = PERFIS.comCasa();
  const ctx = ctxDe(st);
  const i = INTENCOES.find((x) => x.id === 'nutri-trocar');
  const p = i.inicio(ctx).proximo('0', ctx).proximo('nao_tenho', ctx);
  const casa = p.acoes.find((a) => /casa/.test(a.rotulo));
  assert.ok(casa, 'oferece usar só o que tem em casa');
  const s = structuredClone(st);
  s.nutri.ajustes[HOJE] = { s: 2, m: [] };
  assert.notEqual(casa.aplicar(s, ctx), false);
  assert.equal(s.nutri.soCasa, true);
  assert.ok(!s.nutri.ajustes[HOJE], 'o dia volta ao cardápio sem trocas, como na tela');
  // já usando a lista: não oferece de novo
  const st2 = PERFIS.soCasa();
  const p2 = i.inicio(ctxDe(st2)).proximo('0', ctxDe(st2)).proximo('nao_tenho', ctxDe(st2));
  assert.ok(!p2.acoes.some((a) => /casa/.test(a.rotulo)));
  // alergia
  const pa = i.inicio(ctxDe(PERFIS.adulto())).proximo('0').proximo('alergia');
  assert.equal(pa.aviso.tipo, 'warn');
  assert.ok(pa.refs.includes('anvisa_alergenicos'));
  assert.ok(pa.texto.some((t) => /entrevista/.test(t)));
  const pb = i.inicio(ctxDe(PERFIS.alergias())).proximo('0').proximo('alergia');
  assert.ok(pb.texto[1].includes('leite') && pb.texto[1].includes('ovo'), pb.texto[1]);
  // quem não tem cardápio (modo educativo) não vê o assunto
  for (const nome of ['transtorno', 'menor', 'gestante', 'renal']) assert.equal(i.disponivel(ctxDe(PERFIS[nome]())), false, nome);
  assert.equal(i.disponivel(ctxDe(PERFIS.semEntrevista())), true);
});

test('dúvida de alimento: restrições, alergias e o texto digitado', () => {
  const i = INTENCOES.find((x) => x.id === 'nutri-alimento');
  assert.equal(alimentoNoTexto('posso comer pao frances a noite?').id, 'pao-frances');
  assert.equal(alimentoNoTexto('tapioca engorda?').id, 'tapioca-pronta');
  assert.equal(alimentoNoTexto('qual a porcao de arroz').id.startsWith('arroz'), true);
  assert.equal(alimentoNoTexto('posso comer?'), null);
  // vegano: ovo não serve
  const v = i.inicio(ctxDe(PERFIS.vegano(), 'posso comer ovo cozido?'));
  assert.ok(v.texto[0].includes('vegana'), v.texto[0]);
  // alergia ao leite: iogurte não serve e há aviso do rótulo
  const a = i.inicio(ctxDe(PERFIS.alergias())).proximo('leite').proximo('iogurte-natural');
  assert.ok(a.texto[0].includes('alergia'), a.texto[0]);
  assert.equal(a.aviso.tipo, 'warn');
  // adulto: medida caseira do IBGE com gramas e o que vai no cardápio
  const arroz = i.inicio(ctxDe(PERFIS.adulto())).proximo('base').proximo('arroz-branco-cozido');
  assert.ok(arroz.texto.some((t) => t.includes('colher de servir') && t.includes('45 g')), arroz.texto.join(' | '));
  assert.ok(arroz.refs.includes('pof2008medidas'));
  assert.ok(arroz.detalhes.some((t) => /No cardápio/.test(t)));
  // menor: a medida sem gramas
  const m = i.inicio(ctxDe(PERFIS.menor())).proximo('base').proximo('arroz-branco-cozido');
  assert.ok(m.texto.some((t) => t === 'Porção de referência: 1 colher de servir.'), m.texto.join(' | '));
  // ultraprocessado: Guia Alimentar
  const refri = i.inicio(ctxDe(PERFIS.adulto())).proximo('lanches').proximo('refrigerante-de-cola');
  assert.ok(refri.texto[0].includes('ultraprocessado'));
  // outro alimento: cai nas perguntas frequentes
  const outro = i.inicio(ctxDe(PERFIS.adulto())).proximo('outro');
  assert.ok(outro.faq.length >= 1 && outro.faq.every((f) => f.refs.every((k) => REFS[k])));
});

test('suplementos: doses só para quem pode; protegidos sem dose', () => {
  const i = INTENCOES.find((x) => x.id === 'nutri-suplementos');
  const ad = i.inicio(ctxDe(PERFIS.adulto()));
  assert.ok(ad.proximo('creatina').texto[0].includes('3 a 5 g'));
  const caf = ad.proximo('cafeina');
  assert.ok(caf.opcoes && caf.proximo('2').texto[0].includes('2 xícaras'));
  for (const nome of ['menor', 'transtorno', 'gestante', 'renal', 'semEntrevista']) {
    const p = i.inicio(ctxDe(PERFIS[nome]()));
    for (const v of ['creatina', 'proteina', 'cafeina', 'pre']) {
      const t = textosDo(p.proximo(v)).join(' ');
      assert.ok(!/\d\s*(g|mg)\b/.test(t), `${nome}/${v}: ${t}`);
    }
  }
  assert.ok(i.inicio(ctxDe(PERFIS.menor())).proximo('pre').texto.some((t) => /18 anos/.test(t)));
  // pressão alta: cafeína sem dose e pré-treino bloqueado
  const h = i.inicio(ctxDe(PERFIS.hipertensao()));
  assert.ok(!h.proximo('cafeina').opcoes);
  assert.ok(h.proximo('pre').aviso);
});

test('antes, durante e depois do treino; jejum com diabetes e protegidos', () => {
  const i = INTENCOES.find((x) => x.id === 'nutri-treino');
  const ad = i.inicio(ctxDe(PERFIS.adulto()));
  assert.ok(/\d+ g/.test(ad.proximo('antes').texto[0]), ad.proximo('antes').texto[0]);
  assert.ok(/proteína/.test(ad.proximo('depois').texto[0]));
  const cor = ad.proximo('corrida');
  assert.equal(cor.opcoes.length, 4);
  assert.ok(cor.proximo('ate150').texto[0].includes('30 a 60 g'));
  assert.ok(cor.proximo('ate45').texto[0].includes('Não precisa'));
  assert.ok(i.inicio(ctxDe(PERFIS.diabetes())).proximo('jejum').texto[0].includes('diabetes'));
  assert.ok(i.inicio(ctxDe(PERFIS.menor())).proximo('jejum').texto[0].includes('18 anos'));
  // alergias: os exemplos não citam ovo, leite nem amendoim
  const al = textosDo(i.inicio(ctxDe(PERFIS.alergias())).proximo('antes')).join(' ');
  assert.ok(!/ovo|iogurte|amendoim|queijo/.test(al), al);
});

test('comi fora do plano: acolhimento sem números para protegidos, e com a conta do diário para quem tem meta', () => {
  const i = INTENCOES.find((x) => x.id === 'nutri-exagerei');
  const st = sanitize({ nutri: { answers: NUTRI }, diario: { dias: [{ data: HOJE, itens: [{ id: 'a1', ref: 'jantar', nome: 'Pizza', kcal: 2600, p: 90 }] }] } });
  const p = i.inicio(ctxDe(st)).proximo('amanha', ctxDe(st));
  assert.ok(p.detalhes.some((t) => /passou/.test(t)), p.detalhes.join(' | '));
  assert.ok(p.texto.some((t) => /jejum/.test(t)));
  const culpa = i.inicio(ctxDe(st)).proximo('culpa');
  assert.ok(culpa.texto.some((t) => /188/.test(t)));
  const stT = sanitize({ nutri: { answers: { ...NUTRI, condicoes: ['transtorno'] } }, diario: st.diario });
  for (const v of ['proxima', 'amanha', 'culpa']) for (const t of textosDo(i.inicio(ctxDe(stT)).proximo(v))) assert.ok(!NUMERO_PROIBIDO.test(t) && !/kcal/.test(t), t);
  assert.ok(i.inicio(ctxDe(PERFIS.diabetes())).proximo('proxima').texto.some((t) => /hipoglicemia/.test(t)));
});

test('mudar o plano: leva à entrevista e não mostra o peso a quem é protegido', () => {
  const i = INTENCOES.find((x) => x.id === 'nutri-plano');
  const ad = i.inicio(ctxDe(PERFIS.adulto()));
  const peso = ad.proximo('peso');
  assert.ok(peso.texto[0].includes('72 kg'));
  assert.ok(peso.ir.some((x) => x.rota === 'progresso'));
  assert.ok(ad.proximo('objetivo').texto.some((t) => /Refazer a entrevista/.test(t)));
  assert.ok(!/kg/.test(i.inicio(ctxDe(PERFIS.transtorno())).proximo('peso').texto.join(' ')));
  assert.ok(!i.inicio(ctxDe(PERFIS.semEntrevista())).opcoes);
});

test('sinais de risco: reconhece as frases de risco', () => {
  const casos = [
    ['vomito depois de comer pra nao engordar', 'vomito'], ['eu vomitei tudo o que comi', 'vomito'], ['enfio o dedo na garganta depois do almoco', 'vomito'], ['provoco o vomito', 'vomito'],
    ['tomo laxante para emagrecer', 'purgativo'], ['uso diuretico pra secar', 'purgativo'], ['laxante depois de comer', 'purgativo'],
    ['quero comprar remedio para emagrecer', 'remedio'], ['inibidor de apetite funciona', 'remedio'],
    ['vou fazer jejum de 3 dias', 'jejum'], ['fiquei dois dias sem comer', 'jejum'], ['estou sem comer ha 4 dias', 'jejum'], ['jejum prolongado', 'jejum'],
    ['estou comendo quase nada', 'restricao'], ['nao estou comendo nada', 'restricao'], ['parei de comer', 'restricao'], ['parei de comer pra emagrecer', 'restricao'], ['tenho medo de comer', 'restricao'],
    ['quero morrer', 'vida'], ['penso em me matar', 'vida'],
  ];
  for (const [frase, id] of casos) assert.ok(sinaisDeRisco(normalizar(frase)).includes(id), `${frase} → ${id}: ${sinaisDeRisco(frase)}`);
  // acentos e maiúsculas também (o motor já normaliza, mas a função aguenta)
  assert.ok(sinaisDeRisco('Vomitei DEPOIS de comer').includes('vomito'));
  assert.ok(sinaisDeRisco('Estou comendo quase nada há dias').length);
});

test('sinais de risco: não dispara em frases comuns', () => {
  const comuns = ['posso comer pao a noite?', 'jejum de 16 horas funciona?', 'jejum intermitente emagrece?', 'tomo diuretico para pressao alta', 'parei de comer doce', 'parei de comer carne vermelha',
    'estou com virose e vomitei', 'comi algo estragado e vomitei', 'exagerei no churrasco', 'comi demais ontem', 'quanto de proteina por dia', 'quero emagrecer', 'creatina faz mal?',
    'laxante para intestino preso', 'vou morrer de fome', 'quero morrer de rir', 'nao tenho tempo de cozinhar', 'estou sem fome hoje', 'cha verde emagrece?', 'nao estou comendo carne'];
  for (const frase of comuns) assert.deepEqual(sinaisDeRisco(normalizar(frase)), [], frase);
  assert.deepEqual(sinaisDeRisco(''), []);
  assert.deepEqual(sinaisDeRisco(null), []);
});

test('passo de risco: acolhimento sem números, com CVV 188, SAMU 192 e procura de profissional', () => {
  for (const sinais of [['vomito'], ['purgativo', 'jejum'], ['restricao'], ['vida']]) {
    const p = passoDeRisco(sinais);
    conferePasso(p, sinais.join());
    const t = textosDo(p).join(' ');
    assert.ok(t.includes('188') && t.includes('192'), t);
    assert.ok(!NUMERO_PROIBIDO.test(t));
    assert.ok(!p.opcoes && !p.acoes);
    assert.ok(/profissional|SAMU/.test(p.texto.join(' ')));
    assert.ok(!/você deveria|errad|fracass/i.test(t), 'sem julgamento');
  }
  assert.equal(passoDeRisco(['vida']).aviso.tipo, 'danger');
  // o assunto "Preocupação com a comida" é o mesmo passo
  assert.deepEqual(INTENCOES.find((x) => x.id === 'nutri-apoio').inicio(ctxDe(PERFIS.adulto())).texto, passoDeRisco(['vomito']).texto);
  for (const v of Object.values(REFS_NOVAS)) assert.ok(v.length > 40);
});

test('perfil: as proteções vêm de qualquer entrevista', () => {
  assert.equal(perfilNutri(ctxDe(PERFIS.transtornoNoTreinador())).transtorno, true);
  assert.equal(perfilNutri(ctxDe(PERFIS.menorNoTreinador())).menor, true);
  assert.equal(perfilNutri(ctxDe(PERFIS.adulto())).protegido, false);
  assert.equal(perfilNutri(ctxDe(estado({ extra: { raiz: { sono: { idade: 14 } } } }))).menor, true, 'idade da tela do sono');
  const P = perfilNutri(ctxDe(PERFIS.alergias()));
  assert.deepEqual([...P.alergias].sort(), ['amendoim', 'leite', 'ovo']);
  assert.ok(limparAjustes(PERFIS.adulto().nutri.ajustes));
});

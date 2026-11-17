// Treino guiado (logic/guiado.js): aquecimento e séries de aproximação, troca rápida com o aparelho ocupado e teste da
// 1ª série (ajuste da carga das séries seguintes).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../www/js/store.js';
import {
  aquecimentoGeral, aquecimentoRecomendado, primeiroDoMusculo, grupoPrincipal, seriesDeAproximacao, REPS_APROX, aparelhoOcupado, ocupados,
  podeSubir, cargaAjustada, testeDaPrimeira, limparGuia, REFS_AQUECIMENTO, REFS_TESTE,
} from '../www/js/logic/guiado.js';
import { perfil, permitido, alertaDoExercicio, alternativas } from '../www/js/logic/trainer.js';
import { assistido } from '../www/js/logic/progress.js';
import { EXERCICIOS, EX_POR_ID } from '../www/js/data/exercises.js';
import { EQUIPAMENTOS } from '../www/js/data/equipment.js';
import { BARRA_KG } from '../www/js/data/cargas.js';
import { REFS } from '../www/js/data/knowledge.js';
import { gastoDoTreino } from '../www/js/logic/gasto.js';
import { recorde, historico } from '../www/js/logic/progress.js';

const base = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', pausa: 'treinando', dias: '3', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], remedios: ['nenhum'], foco: ['equilibrado'] };
const COM_CARGA = EXERCICIOS.filter((e) => e.registro === 'peso_reps');
const TODAS = Object.keys(EQUIPAMENTOS);
const doresDe = (onde, nivel, tipo = 'articular') => [{ id: 'x', data: '2026-11-10', onde, lado: '', tipo, quando: 'durante', nivel, nota: '', fim: '', dias: 1 }];

// gerador determinístico
let semente = 777;
const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const um = (l) => l[Math.floor(rnd() * l.length)];

// o kg existe na grade do equipamento? (barra: 20 + 2 em 2; halteres: 1 em 1 até 10, 2 em 2 acima; aparelho: o passo da tela)
function naGrade(ex, kg, baseKg) {
  if (kg === 0) return true;
  if (ex.modalidade === 'barra' && baseKg >= BARRA_KG) return kg >= BARRA_KG && Math.abs(((kg - BARRA_KG) / 2) - Math.round((kg - BARRA_KG) / 2)) < 1e-9;
  if (ex.modalidade === 'halteres' || ex.modalidade === 'kettlebell') return kg >= 1 && Number.isInteger(kg) && (kg <= 10 || kg % 2 === 0);
  const p = kg < 20 ? 1 : 2.5;
  return Math.abs(kg / p - Math.round(kg / p)) < 1e-6 || Math.abs(kg - Math.round(kg)) < 1e-9;
}

test('aquecimento: cardio leve opcional para a maioria e recomendado nos perfis de risco, sempre com fontes', () => {
  const a = aquecimentoGeral(base);
  assert.equal(a.recomendado, false);
  assert.match(a.linha, /opcional/);
  assert.match(a.linha, /1º exercício de cada músculo/);
  assert.ok(a.linha.length <= 90, 'linha curta: ' + a.linha);
  for (const k of a.refs) assert.ok(REFS[k], 'fonte ausente: ' + k);
  for (const k of [...REFS_AQUECIMENTO, ...REFS_TESTE]) assert.ok(REFS[k], 'fonte ausente: ' + k);
  assert.ok(a.porque.some((t) => /40%/.test(t) && /80%/.test(t) && /1 minuto/.test(t)));
  assert.ok(a.porque.some((t) => /não contam no histórico/.test(t)));
  for (const extra of [{ idade: 65 }, { condicoes: ['hipertensao'] }, { condicoes: ['cardiaco'], liberado: 'sim' }, { condicoes: ['diabetes'] }, { triagem: ['dor_peito'] }]) {
    const r = aquecimentoGeral({ ...base, ...extra });
    assert.equal(r.recomendado, true, JSON.stringify(extra));
    assert.doesNotMatch(r.linha, /opcional/);
    assert.ok(r.porque.some((t) => /para o seu perfil/i.test(t)));
  }
  // sem exercício com carga, nada de séries de aproximação no texto
  const s = aquecimentoGeral(base, false);
  assert.doesNotMatch(s.linha, /séries/);
  assert.ok(!s.refs.includes('ribeiro2020'));
  // sem entrevista: opcional (não há o que indique risco), sem quebrar
  assert.equal(aquecimentoGeral(null).recomendado, false);
  assert.equal(aquecimentoRecomendado(null), false);
});

test('aquecimento: aproximação só no 1º exercício com carga de cada músculo', () => {
  const itens = [{ ex: 'caminhada-esteira' }, { ex: 'supino-reto-barra' }, { ex: 'crucifixo-reto-halteres' }, { ex: 'flexao-de-bracos' }, { ex: 'leg-press-45' }, { ex: 'cadeira-extensora' }, { ex: 'rosca-direta-barra-reta' }];
  const r = itens.map((_, i) => primeiroDoMusculo(itens, i));
  assert.deepEqual(r, [false, true, false, false, true, false, true]);
  assert.equal(grupoPrincipal(EX_POR_ID.get('supino-reto-barra')), 'peito');
  assert.equal(primeiroDoMusculo(null, 0), false);
  assert.equal(primeiroDoMusculo([{ ex: 'nao-existe' }], 0), false);
  // trocar a ordem muda quem recebe
  const troca = [itens[2], itens[1]];
  assert.deepEqual([primeiroDoMusculo(troca, 0), primeiroDoMusculo(troca, 1)], [true, false]);
});

test('aquecimento: séries de aproximação com 40% e 80% da carga do dia, sempre mais leves e na grade', () => {
  const sup = seriesDeAproximacao('supino-reto-barra', 60);
  assert.deepEqual(sup.series.map((s) => [s.reps, s.kg]), [[6, 24], [6, 48]]);
  assert.equal(sup.series[1].txt, '6 × 48 kg');
  // abaixo da barra: "só a barra"; com a carga do dia igual à barra, não há o que aliviar
  assert.deepEqual(seriesDeAproximacao('supino-reto-barra', 30).series.map((s) => s.txt), ['6 só com a barra', '6 × 24 kg']);
  assert.deepEqual(seriesDeAproximacao('supino-reto-barra', 24).series.map((s) => s.txt), ['6 só com a barra']);
  assert.equal(seriesDeAproximacao('supino-reto-barra', 20), null);
  // halteres leves: 40% de 2 kg não existe → sem peso
  assert.deepEqual(seriesDeAproximacao('rosca-alternada-halteres', 2).series.map((s) => s.txt), ['6 sem peso', '6 × 1 kg']);
  // sem número: as séries saem sem kg; máquina com ajuda: o sentido inverte (mais ajuda), sem conta em %
  assert.ok(seriesDeAproximacao('leg-press-45', null).series.every((s) => s.kg == null && /% da carga/.test(s.txt)));
  const aj = seriesDeAproximacao('barra-fixa-assistida-graviton', 30);
  assert.ok(aj.series.every((s) => s.kg == null && /mais (de )?ajuda/.test(s.txt)));
  // sem peso, exercício por repetições ou por tempo, ou dor que manda evitar: nada
  assert.equal(seriesDeAproximacao('leg-press-45', 0), null);
  assert.equal(seriesDeAproximacao('flexao-de-bracos', 10), null);
  assert.equal(seriesDeAproximacao('prancha', 10), null);
  assert.equal(seriesDeAproximacao('leg-press-45', 100, { nivel: 'evitar', texto: '' }), null);
  assert.match(seriesDeAproximacao('leg-press-45', 100, { nivel: 'leve', texto: '' }).nota, /sem dor/);
  // todos os exercícios com carga, cargas variadas
  for (const ex of COM_CARGA) {
    for (let k = 0; k < 12; k++) {
      const kg = um([0.5, 1, 2, 3, 5, 7.5, 10, 12, 15, 19, 20, 21, 22, 25, 30, 40, 47.5, 60, 85, 100, 140, 200]);
      const r = seriesDeAproximacao(ex.id, kg);
      if (!r) continue;
      assert.ok(r.series.length >= 1 && r.series.length <= 2, ex.id);
      for (const s of r.series) {
        assert.equal(s.reps, REPS_APROX);
        assert.ok(typeof s.txt === 'string' && s.txt.length <= 26, s.txt);
        if (assistido(ex.id)) { assert.equal(s.kg, null); continue; }
        if (s.kg == null) continue;
        assert.ok(s.kg < kg || (s.kg === BARRA_KG && kg > BARRA_KG), `${ex.id} ${kg}: ${s.kg} não é mais leve`);
        assert.ok(naGrade(ex, s.kg, kg), `${ex.id} ${kg}: ${s.kg} fora da grade`);
        assert.ok(s.kg <= kg * 0.8 + 1e-9 || s.kg === BARRA_KG, `${ex.id} ${kg}: ${s.kg} acima de 80%`);
      }
      assert.equal(new Set(r.series.map((s) => s.txt)).size, r.series.length, 'séries repetidas: ' + ex.id);
    }
  }
});

test('aparelho ocupado: mesmo movimento e músculo, sem o aparelho ocupado, o que já está no treino nem o que a dor manda evitar', () => {
  const gym = { all: true, has: {} };
  const sup = aparelhoOcupado('supino-reto-barra', { respostas: base, gym });
  assert.ok(sup.length >= 2 && sup.length <= 3, JSON.stringify(sup));
  assert.ok(sup.includes('supino-maquina'));
  assert.ok(!aparelhoOcupado('supino-reto-barra', { respostas: base, gym, noTreino: ['supino-maquina'] }).includes('supino-maquina'));
  // esteira ocupada: outro cardio de aparelho, sem trocar caminhada por corda ou corrida
  const est = aparelhoOcupado('caminhada-esteira', { respostas: base, gym });
  assert.ok(est.length >= 2 && est.every((id) => !EX_POR_ID.get(id).cuidado.includes('tornozelo') || !EX_POR_ID.get(id).cuidado.includes('joelho')), JSON.stringify(est));
  // em massa: perfis, academias e dores variados
  const perfis = [base, { ...base, experiencia: 'iniciante' }, { ...base, idade: 67 }, { ...base, condicoes: ['hipertensao'] }, { ...base, limitacoes: ['ombro'] }, { ...base, limitacoes: ['joelho', 'lombar'] }, { ...base, condicoes: ['gestante'] }, null];
  let total = 0, vazios = 0;
  for (const ex of EXERCICIOS) {
    if (ex.grupo === 'funcional') continue;
    for (let k = 0; k < 4; k++) {
      const respostas = um(perfis);
      const tudo = rnd() < 0.4;
      const has = {}; for (const e of TODAS) if (rnd() < 0.6) has[e] = true;
      const g = tudo ? { all: true, has: {} } : { all: false, has };
      const dores = rnd() < 0.4 ? doresDe(um(['ombro', 'joelho', 'lombar', 'cotovelo', 'punho', 'quadril']), um([2, 4, 6])) : [];
      const noTreino = EXERCICIOS.filter(() => rnd() < 0.03).map((e) => e.id);
      const ids = aparelhoOcupado(ex.id, { respostas, gym: g, dores, noTreino });
      const occ = ocupados(ex);
      const pf = perfil({ ...(respostas || {}), local: tudo ? 'completa' : 'minha' });
      assert.ok(ids.length <= 3);
      assert.equal(new Set(ids).size, ids.length);
      if (!ids.length) vazios++;
      total++;
      for (const id of ids) {
        const c = EX_POR_ID.get(id);
        assert.ok(c && id !== ex.id && !noTreino.includes(id), `${ex.id} → ${id}`);
        assert.ok(!c.equip.some((e) => occ.includes(e)), `${ex.id} → ${id} usa o aparelho ocupado`);
        assert.notEqual([...c.equip].sort().join(), [...ex.equip].sort().join(), `${ex.id} → ${id}: mesmos aparelhos`);
        assert.equal(c.registro === 'peso_reps' || c.registro === 'reps' ? 'reps' : c.registro, ex.registro === 'peso_reps' || ex.registro === 'reps' ? 'reps' : ex.registro, `${ex.id} → ${id}: outra forma de medir`);
        if (ex.grupo !== 'abdomen' && ex.padrao !== 'cardio') assert.equal(c.registro, ex.registro, `${ex.id} → ${id}`);
        assert.equal(c.padrao, ex.padrao, `${ex.id} → ${id}: outro movimento`);
        // aparelhos da academia: com "tudo", só os comuns (os raros só quando marcados)
        if (tudo) assert.ok(!c.equip.some((e) => EQUIPAMENTOS[e].raro), `${ex.id} → ${id}: aparelho raro`);
        else assert.ok(c.equip.every((e) => has[e]), `${ex.id} → ${id}: aparelho que a academia não tem`);
        // regras do Treinador (cuidados das limitações e da saúde, nível) e a dor de hoje
        assert.ok(permitido(c, pf), `${ex.id} → ${id}: o Treinador não permite`);
        if (dores.length) assert.notEqual((alertaDoExercicio(id, dores, respostas) || {}).nivel, 'evitar', `${ex.id} → ${id}: a dor manda evitar`);
      }
    }
  }
  assert.ok(vazios < total, 'nunca há alternativa?');
  // entrada ruim
  assert.deepEqual(aparelhoOcupado('nao-existe', {}), []);
  assert.ok(Array.isArray(aparelhoOcupado('supino-reto-barra', { respostas: 5, gym: 'x', dores: 'y', noTreino: 3 })));
});

test('aparelho ocupado: reaproveita as alternativas do Treinador (mesma ordem, primeiro os que a dor não pega)', () => {
  const pf = perfil({ ...base, local: 'completa' });
  const alts = alternativas(EX_POR_ID.get('leg-press-45'), pf, { all: true, has: {} }, new Set(['leg-press-45'])).map((c) => c.id);
  const ids = aparelhoOcupado('leg-press-45', { respostas: base, gym: { all: true, has: {} } });
  for (const id of ids) assert.ok(alts.includes(id), id);
  for (let k = 1; k < ids.length; k++) assert.ok(alts.indexOf(ids[k - 1]) < alts.indexOf(ids[k]), 'fora da ordem do Treinador');
  // com dor moderada no joelho, os que pegam o joelho vão para o fim
  const dores = doresDe('joelho', 2);
  const comDor = aparelhoOcupado('leg-press-45', { respostas: base, gym: { all: true, has: {} }, dores, max: 6 });
  const leves = comDor.map((id) => !!alertaDoExercicio(id, dores, base));
  for (let k = 1; k < leves.length; k++) assert.ok(!(leves[k - 1] && !leves[k]), 'um que a dor pega veio antes de um que ela não pega');
});

test('teste da 1ª série: passo pequeno, na grade do equipamento, e no sentido certo na máquina com ajuda', () => {
  assert.equal(cargaAjustada('supino-reto-barra', 40, +1), 44);
  assert.equal(cargaAjustada('supino-reto-barra', 40, -1), 36);
  assert.equal(cargaAjustada('supino-reto-barra', 20, -1), null); // barra vazia: não baixa
  assert.equal(cargaAjustada('rosca-alternada-halteres', 12, +1), 14); // isolado: 5%, mas pelo menos um halter acima
  assert.equal(cargaAjustada('rosca-alternada-halteres', 1, -1), null);
  assert.equal(cargaAjustada('cadeira-extensora', 30, +1), 32.5);
  assert.equal(cargaAjustada('cadeira-extensora', 30, -1), 27.5);
  // ajuda: mais difícil = menos ajuda; mais fácil = mais ajuda
  assert.ok(cargaAjustada('barra-fixa-assistida-graviton', 30, +1) < 30);
  assert.ok(cargaAjustada('barra-fixa-assistida-graviton', 30, -1) > 30);
  assert.equal(cargaAjustada('barra-fixa-assistida-graviton', 0, +1), null); // sem ajuda: não dá para tirar mais
  for (const x of [NaN, -1, null, undefined, '20']) assert.equal(cargaAjustada('supino-reto-barra', x, +1), null);
  for (const ex of COM_CARGA) {
    if (assistido(ex.id)) continue;
    for (const kg of [1, 2, 5, 8, 10, 12, 16, 20, 22, 25, 36, 50, 80, 120]) {
      const s = cargaAjustada(ex.id, kg, +1);
      const d = cargaAjustada(ex.id, kg, -1);
      assert.ok(s > kg, `${ex.id} ${kg}: não subiu`);
      // até 10% (ou 5% nos isolados) acima, arredondado para o valor mais perto da grade: nunca mais que isso e um degrau
      const degrau = ex.modalidade === 'barra' && kg >= BARRA_KG ? 2 : ex.modalidade === 'halteres' || ex.modalidade === 'kettlebell' ? (kg < 10 ? 1 : 2) : kg < 20 ? 1 : 2.5;
      assert.ok(s <= kg * (ex.tipo === 'composto' ? 1.1 : 1.05) + degrau + 1e-9, `${ex.id} ${kg} → ${s}: passo grande demais`);
      assert.ok(naGrade(ex, s, kg), `${ex.id} ${kg} → ${s}: fora da grade`);
      if (d != null) { assert.ok(d < kg && d >= kg * 0.9 - degrau - 1e-9, `${ex.id} ${kg} → ${d}`); assert.ok(naGrade(ex, d, kg) || d < BARRA_KG, `${ex.id} ${kg} → ${d}: fora da grade`); }
    }
  }
});

test('teste da 1ª série: abaixo do alvo propõe baixar, acima propõe subir, dentro pergunta "Como foi?"', () => {
  const ctx = { respostas: base };
  const p = testeDaPrimeira('supino-reto-barra', '8-12', { kg: 40, reps: 10 }, ctx);
  assert.equal(p.tipo, 'pergunta');
  assert.deepEqual(p.opcoes.map((o) => [o.id, o.kg]), [['leve', 44], ['medida', null], ['pesada', 36]]);
  assert.ok(p.opcoes.every((o) => o.rotulo.length <= 12 && o.sub.length <= 22));
  const ab = testeDaPrimeira('supino-reto-barra', '8-12', { kg: 40, reps: 6 }, ctx);
  assert.equal(ab.tipo, 'abaixo'); assert.equal(ab.opcoes[0].kg, 36); assert.match(ab.opcoes[0].rotulo, /Baixar para 36 kg/);
  const ac = testeDaPrimeira('supino-reto-barra', '8-12', { kg: 40, reps: 13 }, ctx);
  assert.equal(ac.tipo, 'acima'); assert.equal(ac.opcoes[0].kg, 44);
  // na carga mínima: não há como baixar, e o app diz o que fazer
  const min = testeDaPrimeira('supino-reto-barra', '8-12', { kg: 20, reps: 5 }, ctx);
  assert.equal(min.opcoes.length, 1); assert.equal(min.opcoes[0].kg, null); assert.match(min.opcoes[0].texto, /variação mais leve/);
  // ajuda: "leve demais" tira ajuda; "pesada" põe ajuda
  const aj = testeDaPrimeira('barra-fixa-assistida-graviton', '8-12', { kg: 30, reps: 10 }, ctx);
  assert.ok(aj.opcoes[0].kg < 30 && aj.opcoes[2].kg > 30 && /ajuda/.test(aj.opcoes[2].texto));
  // entradas que não valem: nada
  for (const st of [null, {}, { kg: null, reps: 10 }, { kg: 40, reps: 0 }, { kg: NaN, reps: 10 }]) assert.equal(testeDaPrimeira('supino-reto-barra', '8-12', st, ctx), null);
  assert.equal(testeDaPrimeira('flexao-de-bracos', '8-12', { kg: 0, reps: 10 }, ctx), null);
  assert.equal(testeDaPrimeira('nao-existe', '8-12', { kg: 10, reps: 10 }, ctx), null);
});

test('teste da 1ª série: a carga nunca sobe para quem o app já começa mais leve por segurança', () => {
  const travados = [
    [{ ...base, condicoes: ['gestante'], liberado: 'sim' }, {}],
    [{ ...base, condicoes: ['posparto'], liberado: 'sim' }, {}],
    [{ ...base, condicoes: ['cardiaco'], liberado: 'sim' }, {}],
    [{ ...base, condicoes: ['hipertensao'] }, {}],
    [{ ...base, condicoes: ['diabetes'] }, {}],
    [{ ...base, triagem: ['dor_peito'] }, {}],
    [{ ...base, idade: 64 }, {}],
    [{ ...base, idade: 16 }, {}],
    [{ ...base, pausa: '3a6m' }, {}],
    [base, { volta: 30 }],
    [base, { dor: { nivel: 'leve', texto: 'x' } }],
    [{ ...base, limitacoes: ['ombro'] }, {}, ['supino-reto-barra']],
  ];
  for (const [respostas, extra, so] of travados) {
    const ctx = { respostas, ...extra };
    assert.equal(podeSubir('supino-reto-barra', ctx).pode, false, JSON.stringify(respostas) + JSON.stringify(extra));
    assert.ok(podeSubir('supino-reto-barra', ctx).motivo.length > 10);
    for (const reps of [8, 10, 12, 13, 15, 20]) {
      for (const id of so || ['supino-reto-barra', 'barra-fixa-assistida-graviton', 'cadeira-extensora']) {
        const t = testeDaPrimeira(id, '8-12', { kg: 30, reps }, ctx);
        for (const o of t.opcoes) {
          if (o.kg == null) continue;
          // mais difícil = mais kg (ou menos ajuda): nunca
          assert.ok(assistido(id) ? o.kg > 30 : o.kg < 30, `${id} ${reps}: subiu para ${o.kg} com ${JSON.stringify(respostas)}`);
        }
        assert.equal(t.podeSubir, false);
      }
    }
  }
  // quem pode: adulto sem restrição (e quem não respondeu a entrevista: a carga é a que ele mesmo escolheu)
  assert.equal(podeSubir('supino-reto-barra', { respostas: base }).pode, true);
  assert.equal(podeSubir('supino-reto-barra', { respostas: { ...base, experiencia: 'iniciante' } }).pode, true);
  assert.equal(podeSubir('supino-reto-barra', {}).pode, true);
  // limitação do joelho não trava o supino (não pega a região)
  assert.equal(podeSubir('supino-reto-barra', { respostas: { ...base, limitacoes: ['joelho'] } }).pode, true);
  assert.equal(podeSubir('leg-press-45', { respostas: { ...base, limitacoes: ['joelho'] } }).pode, false);
});

test('estado da tela: limpo, preso ao treino e sem campos estranhos', () => {
  assert.deepEqual(limparGuia(null, 's1'), { sid: 's1', geral: '', aprox: {}, teste: {} });
  assert.deepEqual(limparGuia({ sid: 's0', geral: 'feito' }, 's1').geral, '', 'outro treino começa do zero');
  const g = limparGuia({ sid: 's1', geral: 'pulado', aprox: { 'supino-reto-barra': [true, 'x', false, true, true, true], 'leg-press-45': 'pulado', 'nao-existe': [true], __proto__: [true] }, teste: { 'supino-reto-barra': 'leve', 'leg-press-45': '<b>', 'cadeira-extensora': 5 }, lixo: 1 }, 's1');
  assert.deepEqual(g, { sid: 's1', geral: 'pulado', aprox: { 'supino-reto-barra': [true, false, false, true], 'leg-press-45': 'pulado' }, teste: { 'supino-reto-barra': 'leve' } });
  assert.deepEqual(limparGuia({ sid: '' }, ''), { sid: '', geral: '', aprox: {}, teste: {} });
});

test('séries de aproximação não entram no treino gravado: histórico, recordes e calorias só veem as séries válidas', () => {
  // o treino em andamento só tem as séries válidas em it.sets; a aproximação mora fora do state (views/session.js)
  const antes = JSON.stringify(store.state.sessions);
  const cur = { id: 'sx', inicio: new Date(Date.now() - 3600000).toISOString(), itens: [{ ex: 'supino-reto-barra', alvo: '8-12', descanso: 90, sets: [{ kg: 40, reps: 10, seg: null, ok: true }, { kg: 40, reps: 9, seg: null, ok: true }] }] };
  const ap = seriesDeAproximacao('supino-reto-barra', 40);
  assert.ok(ap.series.length === 2);
  const sessao = store.sanitize({ sessions: [{ ...cur, nome: 'T', fim: new Date().toISOString() }] }).sessions[0];
  assert.equal(sessao.itens[0].sets.length, 2);
  store.state.sessions = [sessao];
  try {
    assert.equal(historico('supino-reto-barra', 5)[0].sets.length, 2);
    assert.equal(recorde('supino-reto-barra').kg, 40);
    const g = gastoDoTreino(sessao, { ...store.state, body: [{ data: '2026-11-01', peso: 80 }] });
    assert.ok(g && typeof g === 'object');
  } finally { store.state.sessions = JSON.parse(antes); }
});

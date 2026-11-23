// Sensibilidade do questionário do Treinador de corrida: cada pergunta e cada opção da entrevista, mudada sozinha, tem de
// mudar o plano do jeito declarado aqui — ou estar declarada como neutra, com o motivo. O mesmo para cada dor contada
// (local, tipo, quando e intensidade). Se uma resposta for perguntada e não usada, este teste falha.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERGUNTAS, perfil, gerarPlano, efeitoDaDor } from '../www/js/logic/corrida.js';
import { orientacaoDaDor } from '../www/js/logic/trainer.js';
import { REFS_CORRIDA } from '../www/js/data/corrida.js';
import { LOCAIS_DOR } from '../www/js/logic/dor.js';

const corredor = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 12, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
const maratona = { ...corredor, experiencia: 'avancado', kmSemana: 55, longoAtual: 22, provas: 'meia', distancia: '42', semanasProva: 18, dias: ['1', '2', '3', '4', '6', '0'], tempo: '90', tempoLongo: '150', resultado: '21', resultadoMin: 105 };
const cinco = { ...corredor, distancia: '5', semanasProva: 14, aparelho: 'tempo' };
const comAlvo = { ...corredor, temAlvo: 'sim', alvoMin: 56 };
const hipertenso = { ...corredor, condicoes: ['hipertensao'], liberado: 'nao' };

// tudo o que a pessoa vê do plano
const sig = (p) => (p === null ? 'SEM PLANO' : JSON.stringify([p.totalSemanas, p.modo, p.ritmos, p.semanas, p.avisos, p.orientacoes]));
const semForte = (p) => p.semanas.every((s) => s.dias.every((d) => d.intensidade !== 'forte'));
const aviso = (p, re) => p.avisos.some((x) => re.test(x.texto));

// Tabela: pergunta → base usada, valores testados (para números), o que cada resposta muda, a fonte da regra, os valores
// declarados neutros (com o motivo) e uma conferência do efeito declarado.
// `extra(v)` acrescenta as respostas que a entrevista pediria junto com aquela opção.
const T = [
  { k: 'experiencia', base: corredor, muda: 'nível do plano: do zero (corrida e caminhada), irregular (3 corridas, só esforço), iniciante, intermediário ou avançado', fonte: 'buist2008, nhs_c25k, vanpoppel2021, knopp2024', confere: (p0, p1) => p1.perfil.nivel !== p0.perfil.nivel || p1.perfil.irregular },
  { k: 'kmSemana', base: corredor, valores: [10, 40], muda: 'volume de partida e nível', fonte: 'soligard2016, knopp2024', confere: (p0, p1) => p1.semanas[0].volumeKm !== p0.semanas[0].volumeKm },
  { k: 'longoAtual', base: corredor, valores: [5, 16], muda: 'tamanho do primeiro treino longo', fonte: 'frandsen2025', confere: (p0, p1) => p1.semanas[0].dias.find((d) => d.tipo === 'longo').distKm !== p0.semanas[0].dias.find((d) => d.tipo === 'longo').distKm },
  { k: 'provas', base: maratona, muda: 'só quem já completou uma maratona deixa de receber o aviso de primeira maratona', fonte: 'smyth2021muro', neutros: { nenhuma: 'o aviso só distingue quem já fez maratona', '5a10': 'o aviso só distingue quem já fez maratona' }, confere: (p0, p1) => aviso(p0, /Primeira maratona/) && !aviso(p1, /Primeira maratona/) },
  { k: 'pausa', base: corredor, muda: 'volta gradual: fração do volume, semanas sem treino forte, ritmos mais lentos e, de 3 meses em diante, um nível abaixo', fonte: 'caterisano2019, vdoto2_definicoes, vdoto2_pausa', confere: (p0, p1) => p1.semanas[0].volumeKm < p0.semanas[0].volumeKm && p1.semanas.slice(0, 2).every((s) => s.dias.every((d) => d.intensidade !== 'forte')) },
  { k: 'objetivo', base: corredor, muda: 'formato do plano: manutenção, distância sem data, teste de ritmo ou prova com data (“começar a correr”, para quem já corre, vale como saúde)', fonte: 'oms2020, filipas2022, wang2023' },
  { k: 'distancia', base: corredor, muda: 'volume de pico, treino longo, tipos de treino forte e polimento', fonte: 'knopp2024, fokkema2020, wang2023' },
  { k: 'semanasProva', base: corredor, valores: [8, 16], muda: 'número de semanas e fases do plano', fonte: 'knopp2024, filipas2022', confere: (p0, p1) => p1.totalSemanas !== p0.totalSemanas },
  { k: 'temAlvo', base: corredor, extra: () => ({ alvoMin: 50 }), muda: 'compara a meta com a previsão e avisa quando está fora do alcance', fonte: 'vickers2016, vdoto2_ajuste', confere: (p0, p1) => aviso(p1, /Meta ambiciosa/) },
  { k: 'alvoMin', base: comAlvo, valores: [50, 62], muda: 'ritmo da prova (meta ao alcance) ou aviso de meta ambiciosa', fonte: 'vickers2016, vdoto2_ajuste' },
  { k: 'resultado', base: corredor, extra: (v) => ({ resultadoMin: { 3: 16, 10: 57, 21: 125, 42: 265 }[v] }), muda: 'ritmos de todos os treinos (VDOT); sem resultado, os treinos vão pelo esforço', fonte: 'smyth2022, vdoto2_definicoes', confere: (p0, p1, v) => (v === 'nao' ? p1.ritmos === null : p1.ritmos.vdot !== p0.ritmos.vdot) },
  { k: 'resultadoMin', base: corredor, valores: [24, 33], muda: 'ritmos de todos os treinos', fonte: 'smyth2022, vdoto2_definicoes', confere: (p0, p1) => p1.ritmos.leve.de !== p0.ritmos.leve.de },
  { k: 'dias', base: corredor, valores: [['1', '3', '5'], ['1', '2', '3', '4', '5', '6'], ['6']], muda: 'dias e número de corridas, e com isso a distribuição do volume e os treinos fortes', fonte: 'meeusen2013, filipas2022' },
  { k: 'soTempo', base: { ...corredor, objetivo: 'saude', aparelho: 'gps' }, valores: ['sim', 'nao'], muda: 'correr pelo prazer: só por tempo, sem distância, sem ritmo e sem lembrete de GPS', fonte: 'oms2020, lee2014', neutros: { nao: 'o mesmo que não responder: o treinador escolhe pela forma como a pessoa mede' }, confere: (p0, p1, v) => (v === 'sim' ? p1.modo === 'tempo' : true) },
  { k: 'continuo', base: { ...corredor, experiencia: 'caminha', objetivo: 'comecar' }, valores: [['0'], ['1'], ['5'], ['10'], ['15'], ['20']].map((x) => x[0]), muda: 'quanto a pessoa corre sem parar: o programa de corrida e caminhada começa da etapa que ela já consegue (5 min: trechos de 5; 10 min: de 10; 20 min: 20 seguidos)', fonte: 'nhs_c25k', neutros: { 0: 'menos de 1 minuto: o começo de sempre', 1: 'de 1 a 4 minutos: o começo de sempre já tem trechos de 3 minutos' }, confere: (p0, p1) => p1.totalSemanas < p0.totalSemanas },
  { k: 'semTreino', base: corredor, valores: [['2'], ['0'], ['1'], ['nenhum']], muda: 'dias sem treino (a mesma resposta do Treinador): a corrida sai desses dias e vai para os dias livres', fonte: 'escolha da pessoa', neutros: { 1: 'segunda não está entre os dias de corrida marcados', nenhum: 'treina em qualquer dia' } },
  { k: 'soCorrida', base: { ...corredor, semTreino: ['0'] }, valores: [['0'], ['nenhum']], muda: 'o dia sem treino em que a pessoa ainda quer correr volta para a corrida (a musculação continua fora dele)', fonte: 'escolha da pessoa', neutros: { nenhum: 'é o mesmo que não responder: o dia fica sem treino nenhum' } },
  { k: 'diaLongo', base: corredor, muda: 'dia do treino longo e da prova', fonte: 'escolha da pessoa', neutros: { 0: 'domingo é o dia que o plano já escolhe quando está entre os marcados', 1: 'dia fora dos marcados: o plano escolhe (dito na pergunta)', 3: 'dia fora dos marcados: o plano escolhe (dito na pergunta)', 5: 'dia fora dos marcados: o plano escolhe (dito na pergunta)' }, confere: (p0, p1, v) => p1.semanas[0].dias.find((d) => d.tipo === 'longo').wd === Number(v) },
  { k: 'tempo', base: corredor, muda: 'duração máxima de cada treino e, com ela, o volume que cabe na semana', fonte: 'conta de tempo disponível' },
  { k: 'tempoLongo', base: maratona, muda: 'duração máxima do treino longo', fonte: 'vdoto2_definicoes' }, // 3 horas dá os mesmos treinos de 2h30 (teto de Daniels, dito na opção); muda só o aviso de quanto tempo a prova leva
  { k: 'aparelho', base: corredor, muda: 'forma da prescrição: distância e ritmo, velocidade da esteira, ou tempo e esforço; e a orientação de como medir', fonte: 'buist2008, smyth2022', confere: (p0, p1, v) => p1.modo === (v === 'esteira' ? 'esteira' : 'tempo') },
  { k: 'local', base: cinco, muda: 'esteira: velocidade em km/h; pista: tiros em metros', fonte: 'forma de medir', neutros: { varia: 'só esteira e pista mudam a forma de medir o treino' } },
  { k: 'idade', base: corredor, valores: [13, 15, 17, 45, 65, 30], muda: 'distância máxima, treino forte, corridas por semana, progressão e cuidados', fonte: 'cbat_norma12, fitmodel2025, paz2021, borges2016, oms2020', neutros: { 30: 'entre 20 e 39 anos as regras são as mesmas (só a frequência cardíaca estimada muda)' } },
  { k: 'peso', base: corredor, valores: [95, 80], muda: 'IMC de 30 ou mais: progressão mais lenta (e começo mais lento para quem parte do zero)', fonte: 'bertelsen2018, bertelsen2018', neutros: { 80: 'IMC abaixo de 30 não muda o plano' }, confere: (p0, p1) => p1.perfil.passo === 0.1 && aviso(p1, /IMC de 30/) },
  { k: 'altura', base: corredor, valores: [150, 185], muda: 'entra na conta do IMC', fonte: 'bertelsen2018', neutros: { 185: 'IMC abaixo de 30 não muda o plano' }, confere: (p0, p1) => p1.perfil.passo === 0.1 },
  { k: 'lesao12m', base: corredor, muda: 'progressão de 10% por semana em vez de 14%, com aviso', fonte: 'vangent2007, vangent2007', confere: (p0, p1) => p1.perfil.passo === 0.1 && aviso(p1, /Lesão nos últimos 12 meses/) && p1.semanas[5].volumeKm < p0.semanas[5].volumeKm },
  { k: 'limitacoes', base: corredor, muda: 'cada região marcada: 2 primeiras semanas sem treino forte nem acelerações, progressão de 10% e a orientação do local (o ajuste fino vem de “Contar uma dor”)', fonte: 'nhs_dor, esculier2016, silbernagel2020', confere: (p0, p1) => p1.perfil.passo === 0.1 && aviso(p1, /Você disse que sente dor/) && p1.semanas[5].volumeKm < p0.semanas[5].volumeKm && p1.semanas.slice(0, 2).every((s) => s.dias.every((d) => d.intensidade !== 'forte')) },
  { k: 'condicoes', base: corredor, comLiberado: true, muda: 'pressão alta ou outra doença crônica: sem liberação, só treinos leves (com liberação, só os cuidados no aviso); coração, rins e diabetes: sem liberação, sem plano; com liberação, só no leve; gestação: manutenção leve; pós-parto: recomeço por corrida e caminhada', fonte: 'whitfield2017, sbc2020, oms2020, csep2019, selman2022, colberg2016' },
  { k: 'triagem', base: corredor, comLiberado: true, muda: 'qualquer sinal: sem liberação, sem plano; com liberação, só treinos leves, com aviso; "só com supervisão": nunca há plano', fonte: 'whitfield2017, parq2023', confere: (p0, p1) => p1 === null || semForte(p1) },
  { k: 'remedios', base: corredor, comLiberado: true, valores: [['pulso'], ['glicose'], ['outro'], ['nenhum']], muda: 'remédio que segura o pulso: zonas sem batimentos, pelo esforço e pela fala; insulina ou remédio que baixa o açúcar: vale como diabetes; outro remédio contínuo sem condição marcada: vale como outra doença crônica', fonte: 'sbc2020, pescatello2004, colberg2016, parq2023', neutros: { nenhum: 'é a resposta de quem não toma remédio (igual a não responder)' },
    confere: (p0, p1, v) => (v === 'pulso' ? p1.zonas.fcMax === null && p1.zonas.lista.every((z) => z.fc === null) && aviso(p1, /pulso mais baixo/) : v === 'glicose' ? p1 === null || (p1.perfil.diabetes && semForte(p1)) : p1.perfil.cronica) },
  { k: 'liberado', base: hipertenso, muda: 'com a liberação, pressão alta volta a ter treinos fortes; sem ela, só leves e com confirmação na proposta', fonte: 'sbc2020, pescatello2004', confere: (p0, p1) => semForte(p0) && !semForte(p1) },
];

test('sensibilidade: toda pergunta e toda opção da entrevista muda o plano como declarado, ou está declarada como neutra', () => {
  const tabela = [];
  for (const q of PERGUNTAS) {
    const linha = T.find((x) => x.k === q.k);
    assert.ok(linha, `pergunta sem linha na tabela de sensibilidade: ${q.k}`);
    assert.ok(linha.muda.length > 20 && linha.fonte, q.k);
    // a fonte é uma lista de referências, ou uma das regras que não vêm de estudo (declaradas aqui)
    if (!['escolha da pessoa', 'conta de tempo disponível', 'forma de medir'].includes(linha.fonte)) for (const k of linha.fonte.split(', ')) assert.ok(REFS_CORRIDA[k], `fonte desconhecida em ${q.k}: ${k}`);
    assert.ok(!q.se || q.se(linha.base), `a base de ${q.k} não passa pela condição da pergunta`);
    const p0 = gerarPlano(linha.base);
    const s0 = sig(p0);
    const valores = q.tipo === 'numero' ? linha.valores : q.tipo === 'um' ? q.op.map((o) => o[0]) : (linha.valores || q.op.map((o) => [o[0]]));
    assert.ok(Array.isArray(valores) && valores.length, `sem valores para testar em ${q.k}`);
    let mudaram = 0;
    for (const v of valores) {
      if (JSON.stringify(v) === JSON.stringify(linha.base[q.k])) continue;
      const nome = Array.isArray(v) ? v.join('+') : String(v);
      const variantes = linha.comLiberado && !['nenhuma', 'nenhum'].includes(nome) ? [{ liberado: 'nao' }, { liberado: 'sim' }] : [{}];
      for (const extra of variantes) {
        const a1 = { ...linha.base, [q.k]: v, ...(linha.extra ? linha.extra(v) : {}), ...extra };
        assert.equal(q.tipo === 'numero' ? typeof v : true, q.tipo === 'numero' ? 'number' : true);
        const p1 = gerarPlano(a1);
        const igual = sig(p1) === s0;
        const neutro = linha.neutros && Object.prototype.hasOwnProperty.call(linha.neutros, nome);
        if (neutro) assert.ok(igual, `${q.k} = ${nome} está declarada como neutra (${linha.neutros[nome]}), mas mudou o plano`);
        else {
          assert.ok(!igual, `${q.k} = ${nome}${extra.liberado ? ' (liberado: ' + extra.liberado + ')' : ''} não muda nada no plano e não está declarada como neutra`);
          mudaram++;
          if (linha.confere && p0) assert.ok(linha.confere(p0, p1, nome), `${q.k} = ${nome}: o efeito declarado não apareceu (${linha.muda})`);
        }
      }
    }
    assert.ok(mudaram > 0, `nenhuma resposta de ${q.k} muda o plano`);
    tabela.push(q.k);
  }
  assert.equal(tabela.length, PERGUNTAS.length);
  // opções de todas as perguntas de escolha: cada uma foi testada, é a base ou está declarada neutra (nada fica de fora)
  for (const q of PERGUNTAS) if (q.tipo !== 'numero') assert.ok(q.op.length >= 2);
});

test('sensibilidade: condições e sinais de alerta, um por um', () => {
  const com = (extra) => gerarPlano({ ...corredor, ...extra });
  // sem liberação: sem plano
  for (const c of ['cardiaco', 'renal', 'diabetes', 'gestante', 'posparto']) assert.equal(com({ condicoes: [c], liberado: 'nao' }), null, c);
  const SINAIS = ['dor_peito', 'falta_ar', 'falta_ar_deitado', 'palpitacao', 'tontura', 'tornozelos', 'perna', 'sopro', 'cansaco', 'osseo'];
  for (const t of [...SINAIS, 'medico']) assert.equal(com({ triagem: [t], liberado: 'nao' }), null, t);
  // "um médico disse que só com supervisão": nem com liberação (parq2023, pergunta 7)
  assert.equal(com({ triagem: ['medico'], liberado: 'sim' }), null);
  assert.equal(perfil({ ...corredor, triagem: ['medico'], liberado: 'sim' }).bloqueio, 'supervisao');
  // sem liberação: plano só com treinos leves, aviso e confirmação
  for (const c of ['hipertensao', 'cronica']) { const p = com({ condicoes: [c], liberado: 'nao' }); assert.ok(semForte(p) && p.perfil.confirmar && p.avisos.some((x) => x.tipo === 'warn' && /liberação/.test(x.texto)), c); }
  // com liberação: cada uma com o seu cuidado
  assert.ok(semForte(com({ condicoes: ['cardiaco'], liberado: 'sim' })) && semForte(com({ condicoes: ['renal'], liberado: 'sim' })));
  assert.ok(!semForte(com({ condicoes: ['hipertensao'], liberado: 'sim' })) && aviso(com({ condicoes: ['hipertensao'], liberado: 'sim' }), /betabloqueador/));
  assert.ok(semForte(com({ condicoes: ['diabetes'], liberado: 'sim' })) && aviso(com({ condicoes: ['diabetes'], liberado: 'sim' }), /glicemia/) && aviso(com({ condicoes: ['diabetes'], liberado: 'sim' }), /sem treinos fortes/));
  assert.ok(!semForte(com({ condicoes: ['cronica'], liberado: 'sim' })) && aviso(com({ condicoes: ['cronica'], liberado: 'sim' }), /Doença crônica/));
  const g = com({ condicoes: ['gestante'], liberado: 'sim' });
  assert.ok(semForte(g) && g.perfil.objetivo === 'saude' && g.semanas.every((s) => s.dias.every((d) => d.durMin <= 50)) && aviso(g, /Gestação/));
  const pp = com({ condicoes: ['posparto'], liberado: 'sim' });
  assert.ok(pp.tipo === 'adaptacao' && pp.semanas[0].dias.some((d) => /30 s correndo/.test(d.resumo)) && aviso(pp, /Pós-parto/));
  for (const t of SINAIS) { const p = com({ triagem: [t], liberado: 'sim' }); assert.ok(semForte(p) && p.avisos[0].tipo === 'danger' && p.perfil.confirmar, t); }
  // idades: cada limiar muda o que a regra diz
  const id = (idade, extra = {}) => perfil({ ...corredor, idade, ...extra });
  assert.equal(gerarPlano({ ...corredor, idade: 11 }), null);
  assert.deepEqual([12, 13, 14, 15, 16, 17, 18, 19, 20].map((i) => id(i, { distancia: '42' }).dist), [5, 5, 5, 5, 10, 10, 21, 21, 42]);
  assert.deepEqual([13, 14].map((i) => id(i).objetivo), ['distancia', 'prova']);
  // treino forte: aos 16 no plano de 5 km e só aos 18 no de 10 km (fitmodel2025: treino específico aos 15–16 para 5 km, 17–18 para 10 km)
  assert.deepEqual([15, 16, 17, 18, 59, 60].map((i) => id(i, { distancia: '5', dias: ['1', '2', '3', '4', '5', '6'] }).qMax), [0, 1, 1, 2, 2, 1]);
  assert.deepEqual([16, 17, 18].map((i) => id(i, { distancia: '10', dias: ['1', '2', '3', '4', '5', '6'] }).qMax), [0, 0, 2]);
  assert.deepEqual([17, 18, 59, 60].map((i) => id(i).passo), [0.1, 0.14, 0.14, 0.1]);
});

test('sensibilidade: cada dor contada (local, tipo, quando e intensidade) muda o plano como o próprio aplicativo declara', () => {
  const inicio = '2026-11-02'; // segunda-feira: a janela de 7 dias cobre a semana 1 inteira
  const op = (dores) => ({ inicio, hoje: inicio, registros: [], dores, desde: inicio });
  const p0 = gerarPlano(corredor, op([]));
  const s0 = JSON.stringify(p0.semanas[0]);
  const corr = (d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso';
  const min0 = p0.semanas[0].dias.filter(corr).reduce((x, d) => x + d.durMin, 0);
  assert.ok(p0.semanas[0].dias.some((d) => d.intensidade === 'forte'), 'a semana de referência tem treino forte');
  const vistos = { 0: 0, 1: 0, 2: 0, 4: 0 };
  const porLocal = {};
  for (const onde of Object.keys(LOCAIS_DOR)) for (const tipo of ['muscular', 'articular', 'aguda']) for (const quando of ['durante', 'depois', 'repouso']) for (let nivel = 1; nivel <= 10; nivel++) for (const dias of [0, 5, 10]) {
    const d = { onde, tipo, quando, nivel, dias };
    const ef = efeitoDaDor(d);
    const rot = JSON.stringify(d);
    assert.ok([0, 1, 2, 4].includes(ef.nivel) && ef.texto.length > 15 && ef.refs.every((k) => REFS_CORRIDA[k]), rot);
    vistos[ef.nivel]++;
    (porLocal[onde] = porLocal[onde] || new Set()).add(ef.nivel);
    const p = gerarPlano(corredor, op([d]));
    const s = p.semanas[0], runs = s.dias.filter(corr);
    if (ef.nivel === 0) {
      // o texto não promete mudança, e o plano não muda
      assert.equal(JSON.stringify(s), s0, 'dor sem efeito declarado mudou o plano: ' + rot);
      assert.ok(!/Corrida suspensa|pela metade|só treinos leves/i.test(ef.texto), rot);
      assert.ok(!p.ajustes.length, rot);
    } else {
      assert.ok(p.ajustes.some((x) => x.texto.startsWith(LOCAIS_DOR[onde] + ':') && x.motivo && x.refs.length), 'efeito sem explicação em “O que ajustei”: ' + rot);
      assert.ok(s.dias.every((x) => x.intensidade !== 'forte'), 'treino forte mantido: ' + rot);
      const min = runs.reduce((x, y) => x + y.durMin, 0);
      if (ef.nivel === 1) assert.ok(min >= min0 * 0.85 && /só treinos leves/.test(ef.texto), 'nível 1 só tira os fortes: ' + rot);
      if (ef.nivel === 2) assert.ok(min <= min0 * 0.65 && min > 0 && runs.every((x) => x.ajustado) && /pela metade/.test(ef.texto), `nível 2 corta pela metade (${min} de ${min0} min): ${rot}`);
      if (ef.nivel === 4) assert.ok(runs.length === 0 && s.dias.some((x) => x.tipo === 'descanso') && /Corrida suspensa/.test(ef.texto), 'nível 4 suspende a corrida: ' + rot);
    }
    // dor de alerta nas pernas, no tronco e no peito sempre suspende
    const alerta = tipo === 'aguda' || nivel >= 7 || quando === 'repouso';
    if (alerta && !['ombro', 'cotovelo', 'punho', 'braco'].includes(onde)) assert.equal(ef.nivel, 4, 'dor de alerta sem suspensão: ' + rot);
    if (alerta && ['ombro', 'cotovelo', 'punho', 'braco'].includes(onde)) assert.ok(/avaliação/.test(ef.texto) && !/Não muda/.test(ef.texto), rot);
  }
  // todos os locais passaram, cada efeito apareceu, e todo local das pernas e do tronco tem pelo menos dois efeitos diferentes
  assert.equal(Object.keys(porLocal).length, Object.keys(LOCAIS_DOR).length);
  for (const n of [0, 1, 2, 4]) assert.ok(vistos[n] > 0, 'efeito nunca usado: ' + n);
  for (const onde of Object.keys(LOCAIS_DOR)) if (!['ombro', 'cotovelo', 'punho', 'braco'].includes(onde)) assert.ok(porLocal[onde].size >= 2, 'local cuja dor nunca muda o plano: ' + onde);
});

test('lesões: a corrida nunca é menos cautelosa que a musculação quando a musculação dá alerta', () => {
  const perfis = [corredor, { ...corredor, condicoes: ['gestante'], liberado: 'sim' }, { ...corredor, idade: 66 }, { ...corredor, idade: 16 }, { ...corredor, condicoes: ['hipertensao'], liberado: 'sim' }];
  const bracos = ['ombro', 'cotovelo', 'punho', 'braco'];
  let alertas = 0;
  for (const a of perfis) {
    const pf = perfil(a);
    // as mesmas respostas, no formato que a musculação lê (idade e condições)
    const respostasTreino = { idade: a.idade, condicoes: a.condicoes };
    for (const onde of Object.keys(LOCAIS_DOR)) for (const tipo of ['muscular', 'articular', 'aguda']) for (const quando of ['durante', 'depois', 'repouso']) for (let nivel = 1; nivel <= 10; nivel++) {
      const d = { id: 'x', data: '2026-11-02', onde, lado: '', tipo, quando, nivel, nota: '', fim: '', dias: 0 };
      const m = orientacaoDaDor(d, respostasTreino);
      if (!m || !m.alerta) continue;
      alertas++;
      const ef = efeitoDaDor(d, pf);
      const cauteloso = ef.nivel === 4 || (bracos.includes(onde) && /avaliação/.test(ef.texto) && !/Não muda/.test(ef.texto));
      assert.ok(cauteloso, 'musculação em alerta e corrida sem cautela: ' + JSON.stringify({ onde, tipo, quando, nivel, gestante: pf.gestante, idade: pf.idade, corrida: ef }));
    }
  }
  assert.ok(alertas > 2000, String(alertas));
});

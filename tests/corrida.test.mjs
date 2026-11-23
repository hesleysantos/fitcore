// Regras do Treinador de corrida: perfil, plano, segurança e ajuste pelos registros.
import test from 'node:test';
import assert from 'node:assert/strict';
import { minutosEquivalentes, PERGUNTAS, respostasCompletas, perfil, gerarPlano, motivoBloqueio, avisosBloqueio, ritmosDe, vdotDe, riegel, zonasDe, expandirBlocos, textoBloco, efeitoDaDor, orientacaoDor, planoDaSemana, treinoDoDia, resumoParaNutricao, inicioPara, diasDeForca, evolucao, alertas, dicas, limparRegistro, limparRegistros, MAX_REGISTROS, limparCorrida, retomarPlano, recordeSeg, resultadoValido, planoAtual, planoDaSemanaEm, efeitoDoFoco, planejadoDe, analiseDoRegistro, analiseRecente, guardarDoDia, diaLocal, fmtRitmo, fmtFaixa, fmtDuracao, somaDias, diaDaSemana, ETAPAS_CC, etapasDe } from '../www/js/logic/corrida.js';
import { REFS_CORRIDA, FAQ_CORRIDA, TIPOS_TREINO } from '../www/js/data/corrida.js';
import * as store from '../www/js/store.js';

const base = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 12, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
const novato = { experiencia: 'nunca', objetivo: 'comecar', dias: ['1', '3', '5'], diaLongo: 'auto', tempo: '45', aparelho: 'nada', local: 'rua', idade: 30, peso: 70, altura: 170, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
const tipos = (s) => s.dias.map((d) => d.tipo);
const reg = (id, data, tipo, distKm, durMin, pse, dor = null) => ({ id, data, tipo, distKm, durMin, pse, dor, nota: '', planejado: '' });

test('entrevista: perguntas condicionais e respostas completas', () => {
  assert.ok(respostasCompletas(base));
  assert.ok(respostasCompletas(novato), 'quem nunca correu não responde quilometragem, resultado nem prova');
  assert.equal(respostasCompletas({ ...base, semanasProva: undefined }), false);
  assert.equal(respostasCompletas({ ...base, semCorrida: [] }), false);
  assert.equal(respostasCompletas({ ...base, condicoes: ['hipertensao'] }), false, 'com condição de saúde, precisa responder sobre a liberação médica');
  assert.ok(respostasCompletas({ ...base, condicoes: ['hipertensao'], liberado: 'nao' }));
  for (const q of PERGUNTAS) { assert.ok(q.k && q.titulo && ['um', 'varios', 'numero'].includes(q.tipo)); if (q.tipo !== 'numero') assert.ok(q.op.length >= 2); else assert.ok(q.min < q.max && q.padrao >= q.min && q.padrao <= q.max && q.un); }
  // a entrevista pergunta como a pessoa mede a corrida e quais dias da semana tem
  assert.deepEqual(PERGUNTAS.find((q) => q.k === 'aparelho').op.map((o) => o[0]), ['gps', 'esteira', 'tempo', 'nada']);
  assert.deepEqual(PERGUNTAS.find((q) => q.k === 'semCorrida').op.map((o) => o[0]).sort(), ['0', '1', '2', '3', '4', '5', '6', 'nenhum']);
  assert.equal(PERGUNTAS.find((q) => q.k === 'semanasProva').tipo, 'numero');
});

test('perfil: nível, volta de pausa e modo de prescrição', () => {
  assert.equal(perfil(novato).nivel, 0);
  assert.equal(perfil({ ...base, experiencia: 'iniciante', kmSemana: 8 }).nivel, 1);
  assert.equal(perfil(base).nivel, 2);
  assert.equal(perfil({ ...base, experiencia: 'avancado', kmSemana: 60 }).nivel, 3);
  assert.equal(perfil({ ...base, kmSemana: 6 }).nivel, 1, 'quem corre menos de 10 km por semana começa como iniciante');
  assert.equal(perfil({ ...base, pausa: '3a6m' }).nivel, 1, 'de 3 a 6 meses parado: um nível abaixo');
  assert.equal(perfil({ ...base, pausa: 'mais6m' }).nivel, 1);
  assert.equal(perfil({ ...base, experiencia: 'iniciante', kmSemana: 8, pausa: 'mais6m' }).nivel, 0, 'iniciante parado há mais de 6 meses recomeça por corrida e caminhada');
  // como medir: iniciante sempre por tempo e esforço; quem já corre, pelo aparelho
  assert.equal(perfil({ ...novato, aparelho: 'gps' }).modo, 'tempo');
  assert.equal(perfil({ ...base, experiencia: 'iniciante', kmSemana: 8 }).modo, 'tempo');
  assert.equal(perfil(base).modo, 'gps');
  assert.equal(perfil({ ...base, aparelho: 'esteira' }).modo, 'esteira');
  assert.equal(perfil({ ...base, aparelho: 'nada' }).modo, 'tempo');
  // dias: 7 marcados viram 6, com descanso depois do longo
  const sete = perfil({ ...base, dias: ['0', '1', '2', '3', '4', '5', '6'] });
  assert.equal(sete.dias.length, 6); assert.equal(sete.diaLongo, 0); assert.equal(sete.descansoForcado, 1);
  assert.equal(perfil({ ...base, diaLongo: '4' }).diaLongo, 4);
  assert.equal(perfil({ ...base, diaLongo: '1' }).diaLongo, 0, 'dia do longo fora dos dias marcados: o Treinador escolhe');
});

test('ritmos: VDOT de Daniels e Gilbert, ordem das zonas e previsão de Riegel', () => {
  // valores de referência das tabelas de Daniels: 5 km em 25:00 ≈ VDOT 38,3; 10 km em 40:00 ≈ 51,9
  assert.ok(Math.abs(vdotDe(5, 1500) - 38.3) < 0.3, String(vdotDe(5, 1500)));
  assert.ok(Math.abs(vdotDe(10, 2400) - 51.9) < 0.3, String(vdotDe(10, 2400)));
  const R = ritmosDe(5, 1500);
  assert.ok(R.leve.de > R.limiar.ate && R.limiar.de > R.intervalado.ate && R.intervalado.de > R.tiros.ate);
  assert.ok(R.leve.de > 350 && R.leve.ate < 450, 'ritmo leve de quem faz 5 km em 25 min fica entre 5:50 e 7:30 por km: ' + JSON.stringify(R.leve));
  assert.ok(Math.abs(R.limiar.de - 319) < 8, 'limiar perto de 5:19 por km (tabela de Daniels, VDOT 38): ' + R.limiar.de);
  assert.ok(Math.abs(R.intervalado.ate - 300) < 3, 'intervalado: ritmo de 5 km');
  assert.equal(Math.round(riegel(1500, 5, 10)), Math.round(1500 * 2 ** 1.06));
  assert.equal(R.previsoes[10], Math.round(1500 * 2 ** 1.06));
  assert.ok(R.previsoes.maratonaAte > R.previsoes[42], 'a previsão de maratona é uma faixa, com o lado mais lento');
  assert.equal(ritmosDe(5, 300), null, 'resultado impossível (1:00 por km) é recusado');
  assert.equal(fmtRitmo(330), '5:30'); assert.equal(fmtFaixa({ de: 300, ate: 330 }, 'gps'), '5:00 a 5:30 por km'); assert.equal(fmtFaixa({ de: 300, ate: 360 }, 'esteira'), '10 a 12 km/h');
  const z = zonasDe(perfil(base), R);
  assert.equal(z.fcMax, Math.round(208 - 0.7 * 35));
  assert.deepEqual(z.lista.map((x) => x.id), ['leve', 'moderado', 'forte', 'tiros']);
  // sem resultado: sem ritmos; os treinos vão pelo esforço
  const p = gerarPlano({ ...base, resultado: 'nao' });
  assert.equal(p.ritmos, null);
  assert.ok(p.semanas.every((s) => s.dias.every((d) => d.ritmo === null && d.pse.length === 2 && d.fala)));
  assert.ok(p.avisos.some((a) => /Sem um resultado recente/.test(a.texto)));
});

test('iniciante: corrida e caminhada por tempo, 3 vezes por semana, em dias alternados', () => {
  const p = gerarPlano(novato);
  assert.equal(p.tipo, 'adaptacao'); assert.equal(p.modo, 'tempo'); assert.equal(p.totalSemanas, ETAPAS_CC - 3);
  assert.ok(p.semanas.every((s) => s.fase === 'adaptacao' && tipos(s).every((t) => t === 'corrida_caminhada')));
  const s1 = p.semanas[0].dias[0];
  // + a caminhada que completa os 150 minutos da OMS na semana (no fim, depois da caminhada de desacelerar)
  const cam = s1.caminhadaMin || 0;
  assert.ok(cam >= 10 && p.semanas[0].dias.reduce((t, d) => t + minutosEquivalentes(d), 0) >= 140, 'a semana chega perto dos 150 minutos da OMS');
  assert.deepEqual(s1.blocos.map((b) => [b.tipo, b.seg, b.repeticoes || 1]), [['aquecer', 300, 1], ['correr', 60, 10], ['desaquecer', 300 + cam * 60, 1]], '1ª semana: 10 × (1 min correndo + 1 min caminhando), com 5 min de caminhada antes e depois');
  // (a terceira sessão da semana é a primeira da etapa seguinte: a mais longa da semana, como no Couch to 5K)
  assert.ok(p.semanas[0].corridaMin > 30 && p.semanas[0].dias[2].maisLonga, 'semana 1: 2 sessões de 10 × 1 min e a terceira mais longa');
  const ultimo = p.semanas[p.totalSemanas - 1].dias[2];
  assert.ok(ultimo.blocos.some((b) => b.tipo === 'correr' && b.seg === 1800), 'o programa termina em 30 minutos seguidos');
  for (let i = 1; i < p.semanas.length; i++) assert.ok(p.semanas[i].corridaMin - p.semanas[i - 1].corridaMin <= 10, 'no máximo 10 min de corrida a mais por semana');
  // dias extras viram caminhada; nunca corrida em dias seguidos
  const cinco = gerarPlano({ ...novato, dias: ['1', '2', '3', '4', '5'] });
  assert.deepEqual(tipos(cinco.semanas[0]), ['corrida_caminhada', 'caminhada', 'corrida_caminhada', 'caminhada', 'corrida_caminhada']);
  const juntos = gerarPlano({ ...novato, dias: ['5', '6', '0'] });
  assert.equal(tipos(juntos.semanas[0]).filter((t) => t === 'corrida_caminhada').length, 2);
  // cronômetro guiado: a lista de passos alterna corrida e caminhada
  const passos = expandirBlocos(s1.blocos);
  assert.equal(passos.length, 22); assert.equal(passos[1].tipo, 'correr'); assert.equal(passos[2].tipo, 'caminhar'); assert.equal(passos.reduce((x, y) => x + y.seg, 0), 300 + 20 * 60 + 300 + cam * 60);
  assert.match(textoBloco(s1.blocos[1], 'tempo'), /10 × 1 min, com 1 min de caminhada/);
  // quem já alterna corrida e caminhada entra mais adiante
  assert.ok(gerarPlano({ ...novato, experiencia: 'caminha' }).totalSemanas < p.totalSemanas);
});

test('IMC de 30 ou mais, 60+ e pós-parto: começo mais lento, com menos de 3 km de corrida na 1ª semana', () => {
  for (const a of [{ ...novato, peso: 95 }, { ...novato, idade: 66 }]) {
    const p = gerarPlano(a);
    assert.equal(p.totalSemanas, ETAPAS_CC - 1);
    assert.ok(p.semanas[0].dias.slice(0, 2).every((d) => d.corridaMin === 6), '1ª semana: 6 min de corrida por sessão (a terceira, um pouco mais longa)');
    assert.ok((p.semanas[0].corridaMin * 60) / 480 < 3, 'menos de 3 km de corrida na primeira semana');
  }
  assert.ok(gerarPlano({ ...novato, peso: 95 }).avisos.some((a) => /menos de 3 km/.test(a.texto) && a.refs.includes('bertelsen2018')));
  // pós-parto (com liberação): começa ainda mais curto, com 30 segundos de corrida por vez
  const pp = gerarPlano({ ...novato, condicoes: ['posparto'], liberado: 'sim' });
  assert.equal(pp.totalSemanas, ETAPAS_CC);
  assert.deepEqual(pp.semanas[0].dias[0].blocos[1].seg, 30);
  assert.ok(pp.semanas[0].dias.slice(0, 2).every((d) => d.corridaMin === 4), 'pós-parto: 4 min de corrida nas duas primeiras sessões (a terceira, um pouco mais longa)');
  assert.ok(pp.avisos.some((a) => /Pós-parto/.test(a.texto) && a.refs.includes('selman2022')));
});

test('quem já corre: maioria leve, fortes separados, descarga a cada 4 semanas e polimento', () => {
  const p = gerarPlano(base);
  assert.equal(p.totalSemanas, 12); assert.equal(p.tipo, 'geral');
  for (const s of p.semanas) {
    const fortes = s.dias.filter((d) => d.intensidade === 'forte');
    assert.ok(fortes.length <= 2);
    assert.ok(s.dias.filter((d) => d.intensidade === 'leve').length >= s.dias.length / 2, 'pelo menos metade das sessões é leve');
    assert.equal(s.dias.length, 4, 'um treino em cada dia disponível');
  }
  assert.deepEqual(p.semanas.filter((s) => s.descarga).map((s) => s.n), [4, 8]);
  assert.ok(p.semanas[3].volumeKm < p.semanas[2].volumeKm * 0.9, 'a semana de descarga tem menos volume');
  assert.equal(p.semanas[11].fase, 'polimento');
  const ult = p.semanas[11];
  assert.deepEqual(ult.dias.filter((d) => d.tipo === 'prova').map((d) => [d.wd, d.distKm]), [[0, 10]], 'a prova fica no dia do longo, na última semana');
  // modo GPS: rodagens por distância, com faixa de ritmo
  const leve = p.semanas[0].dias.find((d) => d.tipo === 'leve');
  assert.ok(leve.blocos[0].m > 0 && leve.blocos[0].ritmo && leve.ritmo.de < leve.ritmo.ate);
  // sem aparelho: os mesmos treinos por tempo
  const semGps = gerarPlano({ ...base, aparelho: 'tempo' });
  assert.ok(semGps.semanas[0].dias.find((d) => d.tipo === 'leve').blocos[0].seg > 0);
  // 5 dias no nível intermediário: até 2 fortes, nunca vizinhos
  const p5 = gerarPlano({ ...base, dias: ['1', '2', '3', '5', '0'], kmSemana: 40, longoAtual: 14 });
  assert.ok(p5.semanas.some((s) => s.dias.filter((d) => d.intensidade === 'forte').length === 2));
  // treino longo: no máximo 10% acima do maior das últimas 4 semanas
  const longos = p.semanas.map((s) => (s.dias.find((d) => d.tipo === 'longo') || {}).distKm || 0);
  assert.ok(longos[0] <= 10.5, 'o primeiro longo parte da corrida mais longa informada');
  for (let i = 1; i < 11; i++) if (longos[i]) assert.ok(longos[i] <= Math.max(...longos.slice(Math.max(0, i - 4), i)) * 1.1 + 0.6, `semana ${i + 1}: ${longos}`);
});

test('iniciante que já corre: 8 semanas de base antes do primeiro treino forte e nunca intervalado', () => {
  const p = gerarPlano({ ...base, experiencia: 'iniciante', kmSemana: 10, longoAtual: 4, objetivo: 'distancia', distancia: '10' });
  assert.equal(p.perfil.nivel, 1);
  assert.ok(p.semanas.slice(0, 8).every((s) => s.dias.every((d) => d.intensidade !== 'forte' && d.intensidade !== 'moderada')));
  assert.ok(p.semanas.every((s) => s.dias.every((d) => d.tipo !== 'intervalado' && d.tipo !== 'tiros')));
  assert.ok(p.semanas.some((s) => tipos(s).includes('fartlek') || tipos(s).includes('progressivo')));
});

test('maratona: longo de até 2h30, polimento de 3 semanas e aviso de primeira maratona', () => {
  const a = { ...base, experiencia: 'avancado', kmSemana: 55, longoAtual: 22, provas: 'meia', distancia: '42', semanasProva: 18, dias: ['1', '2', '3', '4', '6', '0'], tempo: '90', tempoLongo: '180', resultado: '21', resultadoMin: 105 };
  const p = gerarPlano(a);
  const longos = p.semanas.flatMap((s) => s.dias.filter((d) => d.tipo === 'longo').map((d) => d.distKm));
  assert.ok(Math.max(...longos) >= 22 && Math.max(...longos) <= 32, String(Math.max(...longos)));
  // na meia e na maratona, o longo vai até o tempo que a pessoa deu, no máximo 3 horas (o teto de 2h30 de Daniels é opinião)
  assert.ok(p.semanas.every((s) => s.dias.every((d) => d.tipo !== 'longo' || d.durMin <= Math.min(182, p.perfil.tempoLongo + 2))), 'nenhum treino longo passa do tempo dado (no máximo 3 horas)');
  assert.equal(p.perfil.tempoLongo, Math.min(180, p.perfil.tempoLongoDito)); // maratona: até o tempo dado, no máximo 3 horas
  assert.equal(p.semanas.filter((s) => s.fase === 'polimento').length, 3);
  const pico = Math.max(...p.semanas.map((s) => s.volumeKm));
  const [a1, a2] = [p.semanas[15].volumeKm, p.semanas[16].volumeKm];
  assert.ok(a1 < pico * 0.85 && a2 < a1, 'o volume cai de forma progressiva no polimento');
  assert.ok(p.semanas.some((s) => s.dias.some((d) => d.tipo === 'longo' && d.blocos.length === 2)), 'há longos com o final em ritmo de maratona');
  assert.ok(p.avisos.some((x) => /Primeira maratona/.test(x.texto)));
  assert.ok(p.ritmos.prova[42].ate > p.ritmos.prova[42].de, 'ritmo de maratona como faixa (a previsão é otimista para amadores)');
  // prazo curto demais: o plano não acelera além do seguro e avisa
  const curto = gerarPlano({ ...base, distancia: '42', semanasProva: 5, tempoLongo: '180' });
  assert.ok(curto.avisos.some((x) => x.tipo === 'danger' && x.destaque && /Não marquei a prova de maratona em 5 semanas|Em 5 semanas não dá para preparar maratona/.test(x.texto)), 'prazo que não comporta a distância: a prova não é marcada');
  assert.ok(curto.perfil.objetivo === 'distancia' && !curto.semanas.some((s) => s.dias.some((d) => d.nome.startsWith('Prova'))));
  // com até 3 horas no dia mais longo, o longo chega aos 25 km que protegem a prova (fokkema2020): sem o aviso de "pouco"
  assert.ok(Math.max(...longos) >= 25 && !p.avisos.some((x) => /pouco para maratona/.test(x.texto)));
  // com até 2 horas no dia mais longo, o longo fica abaixo de 25 km: aviso ("pouco" ou a prova não marcada)
  const duasHoras = gerarPlano({ ...a, tempoLongo: '120' });
  assert.ok(duasHoras.avisos.some((x) => /pouco para maratona|Não marquei a prova de maratona/.test(x.texto)));
  // meta fora do alcance do condicionamento atual: aviso, e o ritmo da prova segue a previsão
  const meta = gerarPlano({ ...base, temAlvo: 'sim', alvoMin: 45 });
  assert.ok(meta.avisos.some((x) => /Meta ambiciosa/.test(x.texto)));
});

test('segurança: triagem, bloqueios e cautela por população', () => {
  assert.equal(gerarPlano({ ...base, idade: 11 }), null);
  assert.equal(motivoBloqueio({ ...base, idade: 11 }), 'idade');
  for (const extra of [{ triagem: ['dor_peito'] }, { triagem: ['tontura'], liberado: 'nao' }, { condicoes: ['gestante'] }, { condicoes: ['posparto'], liberado: 'nao' }, { experiencia: 'nunca', condicoes: ['cardiaco'] }, { experiencia: 'nunca', condicoes: ['diabetes'] },
    // quem já corre e tem doença do coração, dos rins ou diabetes também precisa da liberação: correr é exercício vigoroso
    { condicoes: ['cardiaco'], liberado: 'nao' }, { condicoes: ['renal'], liberado: 'nao' }, { condicoes: ['diabetes'], liberado: 'nao' }, { experiencia: 'avancado', kmSemana: 60, condicoes: ['cardiaco'], liberado: 'nao', distancia: '42', semanasProva: 20, idade: 55 }]) {
    const a = { ...base, ...extra };
    assert.equal(gerarPlano(a), null, JSON.stringify(extra));
    assert.equal(motivoBloqueio(a), 'liberacao');
    assert.ok(avisosBloqueio(a).length && avisosBloqueio(a).every((x) => x.tipo === 'danger'));
  }
  // com liberação: plano só com treinos leves e aviso de saúde
  for (const extra of [{ triagem: ['falta_ar'], liberado: 'sim' }, { condicoes: ['cardiaco'], liberado: 'sim' }, { condicoes: ['hipertensao'], liberado: 'nao' }, { condicoes: ['cronica'], liberado: 'nao' }, { condicoes: ['renal'], liberado: 'sim' }]) {
    const p = gerarPlano({ ...base, ...extra });
    assert.ok(p, JSON.stringify(extra));
    assert.ok(p.semanas.every((s) => s.dias.every((d) => d.intensidade !== 'forte')), 'sem treino forte: ' + JSON.stringify(extra));
    assert.ok(p.avisos.some((x) => x.tipo === 'danger' || x.tipo === 'warn'));
    assert.equal(p.perfil.confirmar, true, 'a proposta pede confirmação: ' + JSON.stringify(extra));
  }
  // outra doença crônica: sem liberação, só leve e com aviso; com liberação, plano normal
  assert.ok(gerarPlano({ ...base, condicoes: ['cronica'], liberado: 'nao' }).avisos.some((x) => x.tipo === 'warn' && /doença crônica/.test(x.texto)));
  assert.ok(gerarPlano({ ...base, condicoes: ['cronica'], liberado: 'sim' }).semanas.some((s) => s.dias.some((d) => d.intensidade === 'forte')));
  assert.equal(perfil(base).confirmar, false);
  // pressão alta e diabetes com liberação: treinos fortes voltam, com aviso
  assert.ok(gerarPlano({ ...base, condicoes: ['hipertensao'], liberado: 'sim' }).semanas.some((s) => s.dias.some((d) => d.intensidade === 'forte')));
  // gestante que já corria: só leve, sem aumentar, até 45 min; a que não corria: caminhada
  const g = gerarPlano({ ...base, condicoes: ['gestante'], liberado: 'sim' });
  assert.ok(g.semanas.every((s) => s.dias.every((d) => ['leve', 'regenerativo', 'longo', 'caminhada'].includes(d.tipo) && d.durMin <= 50)));
  assert.ok(g.semanas[11].volumeKm <= g.semanas[0].volumeKm * 1.05 + 1);
  assert.ok(!g.semanas.some((s) => s.dias.some((d) => d.tipo === 'prova')), 'gestante não recebe plano de prova');
  const g0 = gerarPlano({ ...novato, condicoes: ['gestante'], liberado: 'sim' });
  assert.ok(g0.semanas.every((s) => tipos(s).every((t) => t === 'caminhada')));
  assert.ok(g0.semanas[11].volumeMin <= 150 && g0.semanas[11].volumeMin >= 90);
  // menores de 18
  const j13 = gerarPlano({ ...base, idade: 13, distancia: '42', dias: ['1', '2', '4', '5', '6'] });
  assert.equal(j13.perfil.dist, 5, 'antes dos 14, a distância-alvo é limitada a 5 km');
  assert.ok(j13.semanas.every((s) => s.dias.every((d) => d.intensidade !== 'forte') && s.dias.filter((d) => d.tipo !== 'caminhada').length <= 3));
  assert.ok(j13.avisos.some((x) => /limitei a distância/.test(x.texto)) && j13.avisos.some((x) => /Menores de 18/.test(x.texto)));
  // idades mínimas (CBAt Norma 12 e FIT Model): até 15, só 5 km; 16 e 17, até 10 km; 18 e 19, até a meia; maratona aos 20
  assert.deepEqual([15, 16, 17, 18, 19, 20].map((idade) => perfil({ ...base, idade, distancia: '42', semanasProva: 20 }).dist), [5, 10, 10, 21, 21, 42]);
  assert.equal(gerarPlano({ ...base, idade: 13 }).perfil.objetivo, 'distancia', 'antes dos 14, sem prova oficial de rua');
  assert.ok(gerarPlano({ ...base, idade: 15, dias: ['1', '2', '3', '5', '0'] }).semanas.every((s) => s.dias.every((d) => d.intensidade !== 'forte' || d.tipo === 'prova')), 'antes dos 16, sem treino forte (só a prova de 5 km)');
  assert.ok(gerarPlano({ ...base, idade: 16, dias: ['1', '2', '3', '5', '0'] }).semanas.every((s) => s.dias.filter((d) => d.intensidade === 'forte' && d.tipo !== 'prova').length <= 1));
  assert.ok(gerarPlano({ ...base, idade: 17, distancia: '21' }).avisos.some((x) => /Confederação Brasileira de Atletismo/.test(x.texto) && x.refs.includes('cbat_norma12')));
  // 60+: no máximo 1 forte e progressão mais lenta
  const i = gerarPlano({ ...base, idade: 64, dias: ['1', '2', '3', '5', '0'], kmSemana: 40, longoAtual: 12 });
  assert.equal(i.perfil.passo, 0.10);
  assert.ok(i.semanas.every((s) => s.dias.filter((d) => d.intensidade === 'forte' && d.tipo !== 'prova').length <= 1));
  // lesão recente: progressão mais lenta, com fonte
  const l = gerarPlano({ ...base, lesao12m: 'sim' });
  assert.equal(l.perfil.passo, 0.10); assert.ok(l.avisos.some((x) => x.refs.includes('vangent2007')));
});

test('volta de pausa informada na entrevista: menos volume e sem treinos fortes no começo', () => {
  const normal = gerarPlano(base), volta = gerarPlano({ ...base, pausa: '1a3m' });
  assert.ok(volta.semanas[0].volumeKm <= normal.semanas[0].volumeKm * 0.6);
  assert.ok(gerarPlano({ ...base, pausa: '2a4s' }).semanas[0].volumeKm <= normal.semanas[0].volumeKm * 0.6, 'qualquer pausa de 2 semanas ou mais: metade do volume');
  // ritmos mais lentos pela tabela de Daniels para o tempo parado
  assert.ok(volta.ritmos.vdot < normal.ritmos.vdot * 0.87 && volta.ritmos.vdot > normal.ritmos.vdot * 0.8 && volta.ritmos.leve.de > normal.ritmos.leve.de);
  assert.ok(volta.ajustes.some((x) => /mais lentos por causa do tempo parado/.test(x.texto) && x.refs.includes('vdoto2_pausa')));
  assert.ok(volta.semanas.slice(0, 2).every((s) => s.dias.every((d) => d.intensidade !== 'forte')));
  assert.ok(volta.avisos.some((x) => /Volta depois de 1 a 3 meses/.test(x.texto) && x.refs.includes('caterisano2019')));
});

test('musculação: treino forte longe do treino pesado de pernas', () => {
  const a = { ...base, dias: ['1', '2', '3', '4', '5', '0'], kmSemana: 45, longoAtual: 14 };
  const livre = gerarPlano(a, { diasPernas: [] }), comPernas = gerarPlano(a, { diasForca: [1, 3], diasPernas: [1, 3] });
  const fortes = (p) => [...new Set(p.semanas.flatMap((s) => s.dias.filter((d) => d.intensidade === 'forte' && d.tipo !== 'prova').map((d) => d.wd)))];
  assert.ok(fortes(comPernas).every((wd) => wd !== 2 && wd !== 4), 'nenhum treino forte no dia seguinte ao de pernas: ' + fortes(comPernas));
  assert.ok(fortes(livre).length >= 2);
  assert.ok(comPernas.orientacoes.some((o) => o[0] === 'Corrida e musculação' && /24 horas/.test(o[1]) && /Você também faz musculação/.test(o[1])));
  // dias de musculação e de pernas saem do plano ativo
  const st = { plans: [{ id: 'p', dias: [{ id: 'a', itens: [{ ex: 'agachamento-livre-barra' }, { ex: 'leg-press-45' }, { ex: 'supino-reto-barra' }] }, { id: 'b', itens: [{ ex: 'supino-reto-barra' }] }], agenda: { 1: 'a', 4: 'b' } }], activePlan: 'p' };
  assert.deepEqual(diasDeForca(st), { forca: [1, 4], pernas: [1] });
  assert.deepEqual(diasDeForca({}), { forca: [], pernas: [] });
});

// ---------- ajuste pelo que a pessoa registra ----------
const inicio = '2026-10-05'; // segunda-feira
const noPlano = (a, hoje, registros, dores = []) => gerarPlano(a, { inicio, hoje, registros, dores, desde: inicio });

test('ajuste: treinos perdidos não são repostos; o volume retoma de onde a pessoa está', () => {
  const p0 = noPlano(base, '2026-10-26', []);
  assert.deepEqual(p0.ajustes, [], 'sem registros, o plano não presume faltas');
  // fez tudo nas 3 primeiras semanas: nenhum ajuste de volume
  const tudo = [];
  for (let w = 0; w < 3; w++) for (const d of p0.semanas[w].dias) tudo.push(reg(`t${w}${d.wd}`, somaDias(inicio, w * 7 + ((d.wd + 6) % 7)), d.tipo, d.distKm, d.durMin, d.tipo === 'leve' || d.tipo === 'longo' ? 4 : 7));
  const ok = noPlano(base, '2026-10-26', tudo);
  assert.ok(!ok.ajustes.some((x) => /Volume/.test(x.texto)), JSON.stringify(ok.ajustes));
  assert.equal(ok.semanas[3].volumeKm, p0.semanas[3].volumeKm);
  // fez menos da metade: a semana atual fica perto do que foi feito e explica por quê
  const pouco = tudo.filter((r) => r.tipo === 'leve').filter((_, i) => i % 2 === 0); // uma rodagem por semana
  const aj = noPlano({ ...base, semanasProva: 16 }, '2026-10-27', pouco);
  const original = gerarPlano({ ...base, semanasProva: 16 }, { inicio, hoje: '2026-10-27' });
  assert.ok(aj.semanas[3].volumeKm < original.semanas[3].volumeKm * 0.7);
  const x = aj.ajustes.find((y) => /Volume desta semana ajustado/.test(y.texto));
  assert.ok(x && /não se repõe/.test(x.motivo) && x.refs.every((k) => REFS_CORRIDA[k]));
  for (let i = 4; i < 8; i++) assert.ok(aj.semanas[i].volumeKm <= Math.max(aj.semanas[i - 1].volumeKm, aj.semanas[i - 2].volumeKm) * 1.1 + 3.5, 'depois do ajuste, o volume volta a subir aos poucos');
  assert.deepEqual(aj.semanas.slice(0, 3).map((s) => s.volumeKm), original.semanas.slice(0, 3).map((s) => s.volumeKm), 'as semanas que já passaram ficam como estavam');
});

test('ajuste: esforço alto nos treinos leves segura o volume; exaustão pede semana leve', () => {
  const p0 = noPlano(base, '2026-10-19', []);
  const regs = (pse) => p0.semanas.slice(0, 2).flatMap((s, w) => s.dias.map((d) => reg(`e${w}${d.wd}`, somaDias(inicio, w * 7 + ((d.wd + 6) % 7)), d.tipo, d.distKm, d.durMin, pse)));
  const pesado = noPlano(base, '2026-10-19', regs(5));
  assert.ok(pesado.ajustes.some((x) => /Volume mantido/.test(x.texto) && /treinos leves/.test(x.motivo)));
  assert.ok(pesado.semanas[2].volumeKm <= p0.semanas[1].volumeKm + 0.6);
  const exausto = noPlano(base, '2026-10-19', regs(9));
  assert.ok(exausto.ajustes.some((x) => /Semana leve antecipada/.test(x.texto) && x.refs.includes('meeusen2013')));
  assert.ok(exausto.semanas[2].volumeKm <= p0.semanas[2].volumeKm * 0.75);
  assert.ok(exausto.semanas[2].dias.every((d) => d.intensidade !== 'forte'));
  // treino em dia por 6 semanas, sem prova nova: ritmos 1 ponto de VDOT mais rápidos (orientação de Daniels), e não antes disso
  const emDia = (semanas) => { const l = []; const pl = gerarPlano(base, { inicio }); for (let w = 0; w < semanas; w++) for (const d of pl.semanas[w].dias) l.push(reg(`v${w}${d.wd}`, somaDias(inicio, w * 7 + ((d.wd + 6) % 7)), d.tipo, d.distKm, d.durMin, d.intensidade === 'forte' ? 7 : 3)); return l; };
  const s5 = noPlano(base, somaDias(inicio, 35), emDia(5)), s6 = noPlano(base, somaDias(inicio, 42), emDia(6));
  assert.equal(s5.ritmos.vdot, p0.ritmos.vdot, 'antes de 6 semanas, os ritmos não mudam');
  assert.equal(s6.ritmos.vdot, Math.round((p0.ritmos.vdot + 1) * 10) / 10);
  assert.ok(s6.ritmos.limiar.de < p0.ritmos.limiar.de && s6.ritmos.leve.de < p0.ritmos.leve.de);
  assert.ok(s6.ajustes.some((x) => /um degrau mais rápidos/.test(x.texto) && x.refs.includes('vdoto2_ajuste')));
  // com os treinos leves pesados, os ritmos não sobem
  assert.equal(noPlano(base, somaDias(inicio, 42), emDia(6).map((r) => ({ ...r, pse: 6 }))).ritmos.vdot, p0.ritmos.vdot);
});

test('ajuste: pausa de 2 semanas ou mais reduz o volume e tira os treinos fortes na volta', () => {
  const p0 = noPlano(base, '2026-10-12', []);
  const regs = p0.semanas[0].dias.map((d) => reg('p' + d.wd, somaDias(inicio, (d.wd + 6) % 7), d.tipo, d.distKm, d.durMin, 4));
  const ultimo = regs[regs.length - 1].data; // domingo 11/10
  const hoje = somaDias(ultimo, 16);
  const v = noPlano(base, hoje, regs);
  const aj = v.ajustes.find((x) => /Volta de pausa/.test(x.texto));
  assert.ok(aj && /16 dias sem correr/.test(aj.motivo) && aj.refs.includes('caterisano2019'));
  const s = v.semanas[v.semanaAtual - 1];
  assert.ok(s.volumeKm <= p0.semanas[0].volumeKm * 0.5 + 1.5, `metade do volume de antes da pausa: ${s.volumeKm}`);
  assert.ok(s.dias.every((d) => d.intensidade !== 'forte'));
});

test('ajuste: resultado novo recalcula os ritmos', () => {
  const p0 = noPlano(base, '2026-10-20', []);
  const p1 = noPlano(base, '2026-10-20', [reg('t', '2026-10-18', 'teste', 5, 25, 9)]);
  assert.ok(p1.ritmos.vdot > p0.ritmos.vdot && p1.ritmos.limiar.de < p0.ritmos.limiar.de);
  assert.ok(p1.ajustes.some((x) => /Ritmos recalculados/.test(x.texto)));
  assert.equal(p1.ritmos.base.origem, 'registro');
  // sem resultado na entrevista, o teste registrado passa a dar os ritmos
  const p2 = noPlano({ ...base, resultado: 'nao' }, '2026-10-20', [reg('t', '2026-10-18', 'prova', 10, 55, 9)]);
  assert.ok(p2.ritmos && p2.semanas[3].dias.some((d) => d.ritmo));
});

test('dor: muscular, articular e de alerta mudam o plano de formas diferentes', () => {
  const hoje = '2026-10-21'; // quarta-feira da semana 3
  const p0 = noPlano(base, hoje, []);
  const dor = (onde, nivel, tipo, extra = {}) => ({ id: 'd', onde, nivel, tipo, quando: 'durante', dias: 0, ...extra });
  const semana = (p) => p.semanas[2].dias;
  // dor muscular leve: nada muda
  assert.deepEqual(semana(noPlano(base, hoje, [], [dor('panturrilha', 3, 'muscular')])).map((d) => d.tipo), semana(p0).map((d) => d.tipo));
  assert.equal(efeitoDaDor(dor('coxa-tras', 2, 'muscular')).nivel, 0);
  // dor muscular moderada: 1 a 2 dias só com treinos leves e pela metade
  const m = noPlano(base, hoje, [], [dor('coxa-frente', 5, 'muscular')]);
  assert.ok(semana(m).filter((d) => d.wd === 4 || d.wd === 6 || d.wd === 0).every((d) => d.intensidade === 'leve'));
  assert.ok(m.ajustes.some((x) => /Dor muscular depois do treino/.test(x.texto) && x.refs.includes('zondi2015')));
  assert.equal(efeitoDaDor(dor('coxa-frente', 5, 'muscular', { dias: 4 })).corte, 0, 'depois de 2 dias, só os treinos fortes ficam de fora');
  // joelho: até 2 segue; de 3 a 6, sem fortes e pela metade
  assert.equal(efeitoDaDor(dor('joelho', 2, 'articular')).nivel, 0);
  const j = noPlano(base, hoje, [], [dor('joelho', 4, 'articular')]);
  const antes = semana(p0).find((d) => d.wd === 0), depois = semana(j).find((d) => d.wd === 0);
  assert.ok(depois.distKm <= antes.distKm * 0.55 && depois.tipo === 'longo');
  // dentro da janela da dor, o longo continua sendo o treino mais longo
  assert.ok(semana(j).filter((d) => d.ajustado && d.tipo !== 'longo').every((d) => d.durMin <= depois.durMin));
  assert.ok(semana(j).filter((d) => [4, 6, 0].includes(d.wd)).every((d) => d.intensidade === 'leve'));
  assert.equal(semana(j).find((d) => d.wd === 2).tipo, semana(p0).find((d) => d.wd === 2).tipo, 'o dia que já passou (terça) não muda');
  assert.equal(efeitoDaDor(dor('joelho', 6, 'articular')).corte, 0.5);
  // escala em semáforo nas demais regiões: até 3 segue, de 4 a 6 adapta
  assert.equal(efeitoDaDor(dor('tornozelo', 3, 'articular')).nivel, 0);
  assert.equal(efeitoDaDor(dor('tornozelo', 4, 'articular')).nivel, 2);
  assert.ok(efeitoDaDor(dor('lombar', 5, 'articular')).refs.includes('nhs_dor'));
  // tendão de Aquiles tolera até 5; canela com 4 ou mais para a corrida (pode ser osso), e abaixo disso já reduz
  assert.equal(efeitoDaDor(dor('aquiles', 2, 'articular')).nivel, 0);
  assert.equal(efeitoDaDor(dor('aquiles', 5, 'articular')).nivel, 2);
  assert.equal(efeitoDaDor(dor('canela', 1, 'articular')).nivel, 2);
  assert.match(efeitoDaDor(dor('coxa-tras', 5, 'muscular', { dias: 9 })).texto, /passa de 7 dias/);
  assert.equal(efeitoDaDor(dor('canela', 3, 'articular')).nivel, 2);
  assert.equal(efeitoDaDor(dor('canela', 4, 'articular')).nivel, 4);
  assert.equal(efeitoDaDor(dor('pe', 5, 'articular')).nivel, 4);
  // dor de alerta: sem corrida e orientação para procurar avaliação
  for (const d of [dor('joelho', 8, 'articular'), dor('panturrilha', 3, 'aguda'), dor('aquiles', 3, 'articular', { quando: 'repouso' })]) {
    const p = noPlano(base, hoje, [], [d]);
    assert.ok(semana(p).filter((x) => [3, 4, 6, 0].includes(x.wd)).every((x) => x.tipo === 'descanso' && x.distKm === 0), JSON.stringify(d));
    assert.ok(p.ajustes.some((x) => /Corrida suspensa/.test(x.texto)));
    assert.ok(/médico|fisioterapeuta/.test(efeitoDaDor(d).texto));
  }
  // dor fora das pernas não muda a corrida
  assert.equal(efeitoDaDor(dor('ombro', 6, 'articular')).nivel, 0);
  assert.deepEqual(noPlano(base, hoje, [], [dor('ombro', 9, 'aguda')]).semanas[2].dias.map((d) => d.tipo), semana(p0).map((d) => d.tipo));
  // dor anotada em um registro de corrida também conta
  const r = noPlano(base, hoje, [reg('x', '2026-10-20', 'leve', 6, 40, 5, { onde: 'canela', nivel: 6 })]);
  assert.ok(semana(r).filter((x) => [4, 6, 0].includes(x.wd)).every((x) => x.tipo === 'descanso'));
  // orientação completa por local, com fontes
  for (const onde of ['joelho', 'canela', 'aquiles', 'pe', 'quadril', 'panturrilha']) { const o = orientacaoDor(onde); assert.ok(o.itens.length === 5 && o.refs.every((k) => REFS_CORRIDA[k])); }
  assert.equal(orientacaoDor('ombro'), null);
});

test('calendário: semana atual, treino do dia, início do plano e resumo para a nutrição', () => {
  const st = store.sanitize({ run: { answers: base, aceitoEm: '2026-10-07T12:00:00.000Z', inicio }, runs: [reg('a', '2026-10-06', 'leve', 5.5, 40, 4)] });
  assert.deepEqual(st.run.answers.dias, base.dias);
  const s = planoDaSemana(st, '2026-10-08');
  assert.equal(s.semana, 1); assert.equal(s.totalSemanas, 12); assert.equal(s.fase, 'Base');
  assert.deepEqual(s.dias.map((d) => (d ? d.tipo : null)), ['longo', null, 'leve', null, s.dias[4].tipo, null, 'leve']);
  assert.equal(s.dias[2].data, '2026-10-06'); assert.equal(s.dias[2].feito.id, 'a'); assert.equal(s.dias[4].feito, null); assert.equal(s.dias[0].data, '2026-10-11');
  assert.equal(treinoDoDia(st, '2026-10-08', '2026-10-11').tipo, 'longo');
  assert.equal(treinoDoDia(st, '2026-10-08', '2026-10-12'), null, 'segunda-feira não tem corrida neste plano');
  assert.equal(planoDaSemana(store.sanitize({}), '2026-10-08'), null);
  assert.equal(planoDaSemana({ ...st, run: { ...st.run, pausadoEm: '2026-10-08T10:00:00.000Z' } }, '2026-10-08'), null);
  assert.equal(planoDaSemana(st, '2027-03-01').concluido, true);
  // início: nesta semana se ainda há treino de hoje em diante; senão, na próxima segunda
  assert.equal(inicioPara(base, '2026-10-07'), '2026-10-05');
  assert.equal(inicioPara({ ...base, dias: ['1', '2'] }, '2026-10-08'), '2026-10-12');
  const n = resumoParaNutricao(st, '2026-10-08');
  assert.deepEqual(Object.keys(n).sort(), ['fase', 'inicioDaSemana', 'kmSemana', 'longoKm', 'longoMin', 'minSemana', 'nivel', 'prova', 'proximaCorrida', 'semana', 'sessoesSemana', 'totalSemanas']);
  assert.equal(n.sessoesSemana, 4); assert.equal(n.nivel, 2); assert.equal(n.semana, 1);
  assert.deepEqual(n.prova, { distKm: 10, data: '2026-12-27', semanasAte: 12 });
  assert.equal(n.proximaCorrida.data, '2026-10-08'); assert.ok(n.longoMin >= 60 && n.kmSemana > 20);
  assert.equal(resumoParaNutricao(store.sanitize({}), '2026-10-08'), null);
  assert.equal(resumoParaNutricao(store.sanitize({ run: { answers: novato, aceitoEm: '2026-10-07T12:00:00.000Z', inicio } }), '2026-10-08').prova, null);
});

test('análises: evolução, alertas e dicas, sempre com fontes', () => {
  const regs = [];
  for (let w = 0; w < 6; w++) { regs.push(reg('l' + w, somaDias('2026-10-06', w * 7), 'leve', 6, 42 - w, 4)); regs.push(reg('g' + w, somaDias('2026-10-11', w * 7), 'longo', 10 + w, (10 + w) * 7, 5)); }
  const e = evolucao(regs, '2026-11-15');
  assert.equal(e.semanas.length, 8); assert.equal(e.constancia.semanasComTreino, 6); assert.equal(e.constancia.sequencia, 6);
  assert.equal(e.semanas[7].km, 21); assert.equal(e.semanas[7].carga, 4 * 37 + 5 * 105);
  assert.ok(e.tendenciaRitmo > 0, 'os treinos leves ficaram mais rápidos'); assert.equal(e.maisLonga, 15); assert.ok(e.refs.every((k) => REFS_CORRIDA[k]));
  assert.deepEqual(alertas(regs, '2026-11-15'), []);
  // corrida muito maior que a mais longa do mês e semana com salto de volume
  const salto = [...regs, reg('x', '2026-11-17', 'longo', 21, 150, 9)];
  const al = alertas(salto, '2026-11-18');
  assert.ok(al.some((x) => /maior do que a mais longa/.test(x.texto) && x.refs.includes('frandsen2025')));
  const al2 = alertas([reg('a', '2026-11-03', 'leve', 10, 70, 8), reg('b', '2026-11-10', 'leve', 10, 70, 9), reg('c', '2026-11-12', 'leve', 10, 70, 9, { onde: 'joelho', nivel: 4 }), reg('d', '2026-11-14', 'leve', 8, 60, 8, { onde: 'joelho', nivel: 5 })], '2026-11-16');
  assert.ok(al2.some((x) => /mais do que na anterior/.test(x.texto)) && al2.some((x) => /esforço de 8 ou mais/.test(x.texto)) && al2.some((x) => /dor em joelho/.test(x.texto)));
  for (const a of [base, novato, { ...base, idade: 50, limitacoes: ['joelho'], distancia: '42' }]) for (const d of dicas(a)) assert.ok(d.titulo && d.texto && d.refs.length && d.refs.every((k) => REFS_CORRIDA[k]));
  assert.ok(dicas({ ...base, limitacoes: ['joelho'] }).some((d) => /cadência/.test(d.texto)));
});

test('registros e estado: validação na fronteira', () => {
  assert.equal(limparRegistro({ id: 'a', data: '2026-11-01', tipo: 'leve', distKm: 5, durMin: 4 }), null, 'ritmo impossível');
  assert.equal(limparRegistro({ id: 'a b', data: '2026-11-01', tipo: 'leve', distKm: 5, durMin: 30 }), null);
  assert.equal(limparRegistro({ id: 'a', data: '2026-11-01', tipo: 'descanso', distKm: 5, durMin: 30 }).tipo, 'livre');
  assert.deepEqual(limparRegistro({ id: 'a', data: '2026-11-01', tipo: 'longo', distKm: 12.345, durMin: 80.2501, pse: 5, dor: { onde: 'pe', nivel: 3 }, nota: 'ok', planejado: 'x' }), { id: 'a', data: '2026-11-01', tipo: 'longo', distKm: 12.35, durMin: 80.25, pse: 5, dores: [{ onde: 'pe', nivel: 3, tipo: 'articular' }], nota: 'ok', planejado: 'x' });
  assert.deepEqual(limparCorrida({ answers: { ...base, extra: 1, idade: 500 }, aceitoEm: '2026-10-07T12:00:00.000Z', inicio: '2026-10-08' }).inicio, '2026-10-05');
  // cronômetro guardado: só números dentro dos limites, e só com plano aceito
  const cron = { data: '2026-10-08', i: 3, fim: 1791460000000, pausadoEm: 0, inicio: 1791459000000, parado: 0, inicioPasso: 1791459900000, terminado: 0, chave: 12345 };
  const comPlano = { answers: base, aceitoEm: '2026-10-07T12:00:00.000Z', inicio: '2026-10-05' };
  assert.deepEqual(limparCorrida({ ...comPlano, cron: { ...cron, lixo: 1 } }).cron, cron);
  for (const ruim of [{ ...cron, i: -1 }, { ...cron, i: 9999 }, { ...cron, fim: 'x' }, { ...cron, data: '2026-02-31' }, { ...cron, inicio: 5 }, { ...cron, parado: 1e12 }, { ...cron, terminado: NaN }, { ...cron, chave: -1 }, { ...cron, chave: undefined },
    // instantes incoerentes: etapa que começa antes do treino, fim antes do começo da etapa, pausa ou término antes do início
    { ...cron, inicioPasso: cron.inicio - 1 }, { ...cron, fim: cron.inicioPasso - 1 }, { ...cron, pausadoEm: cron.inicio - 5 }, { ...cron, terminado: cron.inicio - 5 }, 'x', 7, [], null]) assert.equal(limparCorrida({ ...comPlano, cron: ruim }).cron, null);
  // tempo guardado com precisão de 1 segundo; pausas do plano validadas
  assert.equal(Math.round(limparRegistro({ id: 'a', data: '2026-11-01', tipo: 'leve', distKm: 5, durMin: 32 + 20 / 60 }).durMin * 60), 1940, '32:20 continua 32:20');
  assert.deepEqual(limparCorrida({ ...comPlano, pausas: [{ de: '2026-10-20', ate: '2026-11-12', semanas: 9, x: 1 }, { de: '2026-11-30', ate: '2026-11-20', semanas: 1 }, { de: 'x', ate: '2026-11-20' }, 5, null] }).pausas, [{ de: '2026-10-20', ate: '2026-11-12', semanas: 3 }]);
  assert.deepEqual(limparCorrida({ answers: base, pausas: [{ de: '2026-10-20', ate: '2026-11-12', semanas: 3 }] }).pausas, []);
  // mais registros que o limite: ficam os mais recentes
  const muitos = Array.from({ length: MAX_REGISTROS + 50 }, (_, i) => reg('m' + i, somaDias('2015-01-01', i), 'leve', 5, 30, 4));
  const limpos = limparRegistros(muitos.slice().reverse());
  assert.equal(limpos.length, MAX_REGISTROS);
  assert.equal(limpos[limpos.length - 1].data, somaDias('2015-01-01', MAX_REGISTROS + 49));
  assert.equal(limpos[0].data, somaDias('2015-01-01', 50));
  assert.equal(limparCorrida({ answers: base, cron }).cron, null, 'sem plano aceito não há cronômetro');
  assert.equal(limparCorrida({ answers: { ...base, idade: 500 } }).answers.idade, undefined);
  assert.equal(fmtDuracao(90), '1 min 30 s'); assert.equal(fmtDuracao(1800), '30 min'); assert.equal(fmtDuracao(5400), '1h30');
});

test('o longão é sempre o treino mais longo da semana', () => {
  const a = { experiencia: 'iniciante', kmSemana: 15, longoAtual: 5, provas: 'nenhuma', pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 12, temAlvo: 'nao', resultado: 'nao', dias: ['2', '4', '6'], diaLongo: 'auto', tempo: '45', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 30, peso: 70, altura: 170, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  const casos = [gerarPlano(a, { inicio: '2026-11-02', hoje: '2026-11-13', registros: [], dores: [], desde: '2026-11-04' }), gerarPlano(base), gerarPlano({ ...base, aparelho: 'tempo' }), gerarPlano({ ...base, dias: ['1', '2', '3', '4', '5', '6'], kmSemana: 60, longoAtual: 8 }),
    gerarPlano(a, { inicio: '2026-11-02', hoje: '2026-11-13', registros: [], dores: [{ onde: 'joelho', nivel: 4, tipo: 'articular', quando: 'durante', dias: 0 }], desde: '2026-11-04' })];
  for (const p of casos) for (const s of p.semanas) {
    const longo = s.dias.find((d) => d.tipo === 'longo');
    if (!longo) continue;
    for (const d of s.dias) if ((d.tipo === 'leve' || d.tipo === 'regenerativo') && !!d.ajustado === !!longo.ajustado) assert.ok(d.durMin <= longo.durMin, `semana ${s.n}: ${d.tipo} de ${d.durMin} min maior que o longo de ${longo.durMin} min`);
  }
  // o longo parte da corrida mais longa que a pessoa já faz e fica perto de metade do volume com 3 corridas
  const p = casos[0];
  assert.ok(p.semanas[0].dias.find((d) => d.tipo === 'longo').distKm <= 5.5);
  assert.ok(p.semanas.every((s) => { const l = s.dias.find((d) => d.tipo === 'longo'); return !l || l.distKm <= s.volumeKm * 0.6; }));
});

test('textos: perguntas frequentes e tipos de treino com fontes válidas', () => {
  assert.ok(FAQ_CORRIDA.length >= 20);
  for (const q of FAQ_CORRIDA) assert.ok(q.f.length && q.f.every((k) => REFS_CORRIDA[k]) && q.a.every((t) => t.length > 30), q.q);
  for (const t of ['leve', 'longo', 'intervalado', 'tempo', 'fartlek', 'progressivo', 'regenerativo']) assert.ok(TIPOS_TREINO[t].paraQue.length > 30 && TIPOS_TREINO[t].sentir && TIPOS_TREINO[t].f.length);
  for (const k of Object.keys(REFS_CORRIDA)) assert.ok(/\d{4}/.test(REFS_CORRIDA[k]) || k === 'vdoto2_definicoes' || k === 'nhs_c25k', 'referência sem ano: ' + k);
});

// ---------- terceira rodada: achados da auditoria ----------
const temProva = (p) => p.semanas.some((s) => s.dias.some((d) => d.tipo === 'prova' || d.tipo === 'teste'));
const corr = (d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso';
// registra todas as corridas planejadas das semanas [de, ate] de um plano que começa em `inicio`
const feitas = (p, inicio, de, ate, pse = 4) => p.semanas.slice(de - 1, ate).flatMap((s) => s.dias.filter(corr).map((d) => reg(`s${s.n}d${d.wd}`, somaDias(inicio, (s.n - 1) * 7 + ((d.wd + 6) % 7)), d.tipo, d.distKm, d.durMin, pse)));
const estado = (answers, aceite, inicio, extra = {}) => ({ run: limparCorrida({ answers, aceitoEm: aceite + 'T12:00:00.000Z', inicio, ...extra }), runs: [], dores: [], plans: [], activePlan: '' });

test('A1: a prova só é marcada quando o prazo comporta a distância', () => {
  for (const a of [{ ...novato, objetivo: 'prova', distancia: '42', semanasProva: 4, tempoLongo: '150', temAlvo: 'nao', dias: ['2', '4', '6'] }, { ...novato, objetivo: 'prova', distancia: '21', semanasProva: 1, tempoLongo: '150', temAlvo: 'nao' },
    { ...novato, objetivo: 'prova', distancia: '10', semanasProva: 8, tempoLongo: '90', temAlvo: 'nao' }, { ...novato, objetivo: 'prova', distancia: '5', semanasProva: 6, tempoLongo: '60', temAlvo: 'nao' },
    { ...base, experiencia: 'iniciante', kmSemana: 8, longoAtual: 3, resultado: 'nao', distancia: '10', semanasProva: 2 }, { ...base, experiencia: 'iniciante', kmSemana: 8, longoAtual: 3, resultado: 'nao', distancia: '21', semanasProva: 6 }]) {
    const p = gerarPlano(a);
    assert.notEqual(p.perfil.objetivo, 'prova', JSON.stringify(a));
    assert.ok(!p.semanas.some((s) => s.dias.some((d) => d.nome.startsWith('Prova'))), 'nenhum dia de prova');
    assert.ok(p.avisos[0].tipo === 'danger' && p.avisos[0].destaque && /não dá para preparar|Não marquei a prova/.test(p.avisos[0].texto) && p.avisos[0].refs.includes('frandsen2025'));
    // o que foi montado no lugar só tem desafio no fim se o maior treino das 4 semanas anteriores chega à metade dele
    const T = p.semanas.length, ev = p.semanas[T - 1].dias.find((d) => d.tipo === 'prova' || d.tipo === 'teste');
    if (ev) assert.ok(Math.max(...p.semanas.slice(Math.max(0, T - 5), T - 1).flatMap((s) => s.dias.filter(corr).map((d) => (d.tipo === 'corrida_caminhada' ? d.corridaKm : d.distKm)))) * 2 >= ev.distKm - 0.15);
  }
  // quem nunca correu: 5 km a partir de 9 semanas (NHS); antes disso, o aviso diz o prazo mínimo
  assert.match(gerarPlano({ ...novato, objetivo: 'prova', distancia: '5', semanasProva: 6, tempoLongo: '60', temAlvo: 'nao' }).avisos[0].texto, /prazo mínimo é de 9 semanas/);
  const ok = gerarPlano({ ...novato, objetivo: 'prova', distancia: '5', semanasProva: 12, tempoLongo: '60', temAlvo: 'nao' });
  assert.ok(ok.perfil.objetivo === 'prova' && ok.semanas[11].dias.some((d) => d.tipo === 'prova') && !ok.perfil.meta);
  // quem já corre e tem prazo: a prova fica
  assert.ok(temProva(gerarPlano(base)) && !gerarPlano(base).perfil.meta);
});

test('A2 e A3: doença do coração, dos rins ou diabetes só com liberação; outra doença crônica sem liberação fica só no leve', () => {
  const a = { ...base, kmSemana: 30, condicoes: ['cardiaco'], liberado: 'nao', distancia: '42', semanasProva: 20, idade: 55 };
  assert.equal(gerarPlano(a), null);
  assert.ok(avisosBloqueio(a).some((x) => x.tipo === 'danger' && /vigoroso/.test(x.texto) && x.refs.includes('whitfield2017')));
  const c = gerarPlano({ ...base, condicoes: ['cronica'], liberado: 'nao', semanasProva: 8 });
  assert.ok(c.semanas.every((s) => s.dias.every((d) => d.intensidade !== 'forte')) && c.perfil.cautela && c.perfil.confirmar);
  assert.ok(c.avisos.some((x) => x.tipo === 'warn' && /doença crônica/.test(x.texto) && x.refs.includes('oms2020')));
});

test('A4, B1 e B9: volta de pausa por uma regra só, sobre o volume de antes; prova dentro da volta sai do plano', () => {
  const inicio = '2026-06-01';
  // meia maratona em 16 semanas: 6 semanas à risca, 8 sem correr, volta na 15ª
  const a = { ...base, distancia: '21', semanasProva: 16, tempoLongo: '150' };
  const p0 = gerarPlano(a, { inicio });
  const registros = feitas(p0, inicio, 1, 6);
  const p = gerarPlano(a, { inicio, hoje: somaDias(inicio, 14 * 7), registros, dores: [], desde: inicio });
  assert.ok(!temProva(p) && p.prova === null && p.provaRetirada, 'a prova sai do plano');
  assert.ok(p.avisos[0].tipo === 'danger' && /Tirei a prova de meia maratona/.test(p.avisos[0].texto));
  const s15 = p.semanas[14];
  assert.ok(s15.dias.every((d) => d.intensidade !== 'forte') && s15.dias.filter(corr).every((d) => d.durMin >= 19), 'semana da volta: sem forte e sem treino de 15 minutos');
  // saúde, 30 km por semana: 6 semanas à risca, 3 paradas → metade do que fazia, não quase zero
  const b = { ...base, objetivo: 'saude', kmSemana: 30, longoAtual: 10 };
  const q0 = gerarPlano(b, { inicio });
  const regs = feitas(q0, inicio, 1, 6);
  const antes = q0.semanas[5].volumeKm;
  const q = gerarPlano(b, { inicio, hoje: somaDias(inicio, 9 * 7), registros: regs, dores: [], desde: inicio });
  const v = q.semanas[9].volumeKm;
  assert.ok(v >= antes * 0.4 && v <= antes * 0.56 + 1.5, `volta com metade do volume: ${v} de ${antes}`);
  assert.ok(q.ajustes.some((x) => /Volta de pausa \(semana 1\): cerca de \d+ km nesta semana, (4\d|5\d)% do que você fazia/.test(x.texto)), JSON.stringify(q.ajustes.map((x) => x.texto)));
  assert.ok(q.semanas[9].dias.every((d) => d.intensidade !== 'forte' && !d.blocos.some((k) => k.rotulo === 'Acelerações')) && q.semanas[10].dias.every((d) => d.intensidade !== 'forte'));
  // a mesma pausa informada na entrevista dá a mesma fração
  assert.ok(Math.abs(gerarPlano({ ...b, pausa: '2a4s' }).semanas[0].volumeKm - 15) <= 2);
  // 3 semanas feitas e mais de 8 semanas parado: um terço do volume de antes
  const longa = gerarPlano(b, { inicio, hoje: somaDias(inicio, 11 * 7), registros: feitas(q0, inicio, 1, 3), dores: [], desde: inicio });
  assert.ok(longa.semanas[11].volumeKm <= q0.semanas[2].volumeKm * 0.33 + 3 && longa.semanas[11].volumeKm >= 5, String(longa.semanas[11].volumeKm));
  // B9: corrida suspensa por dor na canela por 10 dias; ao sair, a volta é gradual
  const st = estado(b, inicio, inicio);
  st.runs = regs;
  st.dores = [{ id: 'd1', data: somaDias(inicio, 42), onde: 'canela', lado: '', tipo: 'articular', quando: 'durante', nivel: 5, nota: '', fim: somaDias(inicio, 52) }];
  const durante = planoAtual({ ...st, dores: [{ ...st.dores[0], fim: '' }] }, somaDias(inicio, 45));
  assert.ok(durante.semanas[6].dias.filter((d) => d.wd !== 1 && d.wd !== 2 && d.tipo !== 'caminhada').every((d) => d.tipo === 'descanso'), 'suspenso enquanto a dor está registrada');
  const depois = planoAtual(st, somaDias(inicio, 56));
  assert.ok(depois.ajustes.some((x) => /Volta depois da dor/.test(x.texto)), JSON.stringify(depois.ajustes.map((x) => x.texto)));
  assert.ok(depois.semanas[8].volumeKm <= antes * 0.56 + 1.5 && depois.semanas[8].dias.every((d) => d.intensidade !== 'forte'));
});

test('A5: volta de 3 meses ou mais é um recomeço, com teto de 15 km na primeira semana', () => {
  const p = gerarPlano({ ...base, experiencia: 'avancado', kmSemana: 80, longoAtual: 30, provas: 'maratona', pausa: 'mais6m', objetivo: 'saude', dias: ['1', '2', '3', '4', '5', '6'], tempo: '90', resultado: 'nao' });
  assert.ok(p.semanas[0].volumeKm <= 17, String(p.semanas[0].volumeKm));
  assert.ok(p.semanas[0].dias.every((d) => d.durMin < 90 && d.intensidade !== 'forte'));
  assert.ok(p.semanas.slice(0, 9).every((s) => s.dias.every((d) => d.intensidade !== 'forte')), '9 semanas só de corrida leve');
  assert.ok(p.avisos.some((x) => /recomeço/.test(x.texto) && x.refs.includes('caterisano2019') && x.refs.includes('liem2013')));
  const tres = gerarPlano({ ...base, kmSemana: 60, longoAtual: 20, pausa: '3a6m', objetivo: 'saude' });
  assert.ok(tres.semanas[0].volumeKm <= 17 && tres.perfil.nivel === 1);
  const um = gerarPlano({ ...base, kmSemana: 60, longoAtual: 20, pausa: '1a3m', objetivo: 'saude' });
  assert.ok(um.semanas[0].volumeKm <= 60 * 0.33 + 3 && um.semanas[0].volumeKm > 15);
});

test('A6 e B8: dor de alerta no peito, no abdômen, nas costas e no pescoço suspende a corrida; osso com 4 ou mais também', () => {
  const peito = efeitoDaDor({ onde: 'peito', tipo: 'aguda', quando: 'repouso', nivel: 9 });
  assert.ok(peito.nivel === 4 && /192/.test(peito.texto) && peito.refs.every((k) => REFS_CORRIDA[k]));
  let suspensas = 0, avisadas = 0, total = 0;
  for (const onde of ['peito', 'abdomen', 'coluna-alta', 'pescoco', 'ombro', 'cotovelo', 'punho', 'braco']) for (const tipo of ['muscular', 'articular', 'aguda']) for (const quando of ['durante', 'depois', 'repouso']) for (let nivel = 1; nivel <= 10; nivel++) {
    const d = { onde, tipo, quando, nivel, dias: 0 };
    if (!(tipo === 'aguda' || nivel >= 7 || quando === 'repouso')) continue;
    total++;
    const ef = efeitoDaDor(d);
    if (['peito', 'abdomen', 'coluna-alta', 'pescoco'].includes(onde)) { assert.equal(ef.nivel, 4, JSON.stringify(d)); suspensas++; }
    else { assert.ok(/avaliação/.test(ef.texto) && !/Não muda/.test(ef.texto) && ef.refs.every((k) => REFS_CORRIDA[k]), JSON.stringify(d)); avisadas++; }
  }
  assert.ok(total === suspensas + avisadas && suspensas === avisadas && total > 500);
  // o plano obedece: com dor de alerta no peito, nenhuma corrida nos próximos 7 dias
  const p = gerarPlano(base, { inicio: '2026-11-02', hoje: '2026-11-03', registros: [], dores: [{ onde: 'peito', tipo: 'aguda', quando: 'repouso', nivel: 9, dias: 0 }], desde: '2026-11-02' });
  assert.ok(p.semanas[0].dias.every((d) => d.wd === 1 || d.tipo === 'descanso' || d.tipo === 'caminhada'));
  // canela, pé, quadril e virilha: 4 ou mais suspende, mesmo marcada como dor muscular
  for (const onde of ['canela', 'pe', 'quadril', 'virilha']) for (const tipo of ['muscular', 'articular']) for (let nivel = 4; nivel <= 6; nivel++) assert.equal(efeitoDaDor({ onde, tipo, quando: 'durante', nivel, dias: 1 }).nivel, 4, `${onde} ${tipo} ${nivel}`);
  assert.equal(efeitoDaDor({ onde: 'canela', tipo: 'muscular', quando: 'depois', nivel: 3, dias: 1 }).nivel, 0);
});

test('A7, B11, C1 e C2: 2 fortes só com 5 corridas na semana; regenerativo de até 40 min; nenhum forte mais longo que o longão', () => {
  for (const a of [{ ...base, kmSemana: 23, pausa: '1a3m', dias: ['1', '2', '3', '4', '5'] }, { ...base, dias: ['1', '2', '3', '4', '5', '6'], kmSemana: 70, longoAtual: 20, experiencia: 'avancado', tempo: '90' }, { ...base, aparelho: 'tempo', dias: ['1', '2', '3', '4', '5'] }, { ...base, dias: ['2', '4'], kmSemana: 14 }]) {
    for (const s of gerarPlano(a).semanas) {
      const fortes = s.dias.filter((d) => d.intensidade === 'forte' && d.tipo !== 'prova' && d.tipo !== 'teste');
      assert.ok(fortes.length <= (s.dias.filter(corr).length >= 5 ? 2 : 1), `semana ${s.n}: ${tipos(s)}`);
      const lg = s.dias.find((d) => d.tipo === 'longo');
      for (const d of s.dias) {
        if (d.tipo === 'regenerativo') assert.ok(d.durMin <= 41, `regenerativo de ${d.durMin} min`);
        if (lg && d !== lg && corr(d) && d.tipo !== 'prova') assert.ok(d.durMin <= lg.durMin, `semana ${s.n}: ${d.tipo} ${d.durMin} > longo ${lg.durMin}`);
        const m = /cerca de (\d+) min/.exec(d.resumo);
        if (m) assert.equal(Number(m[1]), d.durMin, 'a duração do resumo é a do treino');
      }
    }
  }
});

test('B2 e B3: uma semana fraca no começo não derruba o plano; “Melhorou” devolve o plano', () => {
  const inicio = '2026-11-02';
  const a = { ...base, objetivo: 'saude', kmSemana: 30, longoAtual: 10 };
  const p0 = gerarPlano(a, { inicio });
  const p = gerarPlano(a, { inicio, hoje: somaDias(inicio, 7), registros: [reg('r1', somaDias(inicio, 1), 'leve', 7.8, 48, 4)], dores: [], desde: inicio });
  assert.ok(p.semanas[1].volumeKm >= p0.semanas[1].volumeKm - 1, `semana 2 com ${p.semanas[1].volumeKm} km`);
  // semanas fracas seguidas, já fora das primeiras semanas: aí o plano recua
  const fracas = [...feitas(p0, inicio, 1, 3), reg('f4', somaDias(inicio, 22), 'leve', 5, 30, 4), reg('f5', somaDias(inicio, 29), 'leve', 5, 30, 4), reg('f6', somaDias(inicio, 36), 'leve', 5, 30, 4)];
  assert.ok(gerarPlano(a, { inicio, hoje: somaDias(inicio, 42), registros: fracas, dores: [], desde: inicio }).semanas[6].volumeKm < p0.semanas[6].volumeKm * 0.6);
  // corrida com dor no joelho (6): ajusta; com o relato marcado como melhorado no dia seguinte, não ajusta mais
  const corrida = reg('d1', somaDias(inicio, 1), 'leve', 6, 38, 4, { onde: 'joelho', nivel: 6 });
  const com = gerarPlano(a, { inicio, hoje: somaDias(inicio, 3), registros: [corrida], dores: [], desde: inicio });
  assert.ok(com.ajustes.some((x) => /Joelho/.test(x.texto)) && com.semanas[0].dias.some((d) => d.ajustado));
  const sem = gerarPlano(a, { inicio, hoje: somaDias(inicio, 3), registros: [corrida], dores: [], encerradas: [{ onde: 'joelho', fim: somaDias(inicio, 2) }], desde: inicio });
  assert.ok(!sem.ajustes.some((x) => /Joelho/.test(x.texto)) && !sem.semanas[0].dias.some((d) => d.ajustado));
  // pelo estado: o relato criado pela corrida, com “Melhorou”
  const st = estado(a, inicio, inicio);
  st.runs = [corrida];
  st.dores = [{ id: 'x', data: corrida.data, onde: 'joelho', lado: '', tipo: 'articular', quando: 'durante', nivel: 6, nota: '', fim: somaDias(inicio, 2) }];
  assert.ok(!planoAtual(st, somaDias(inicio, 3)).semanas[0].dias.some((d) => d.ajustado));
});

test('B4 e C12: corte por dor corta mesmo a corrida do iniciante; sessões cabem no tempo informado', () => {
  const inicio = '2026-11-02';
  const p0 = gerarPlano({ ...novato, tempo: '30' }, { inicio });
  assert.ok(p0.semanas.every((s) => s.dias.every((d) => d.durMin <= 32)), 'com cerca de 30 minutos, nenhuma sessão passa de 32');
  assert.ok(p0.avisos.some((x) => /26 minutos seguidos/.test(x.texto)));
  assert.ok(gerarPlano(novato).semanas.every((s) => s.dias.every((d) => d.durMin <= 45)));
  const q0 = gerarPlano(novato, { inicio });
  for (let w = 1; w <= q0.totalSemanas; w++) {
    const q = gerarPlano(novato, { inicio, hoje: somaDias(inicio, (w - 1) * 7), registros: [], dores: [{ onde: 'joelho', tipo: 'articular', quando: 'durante', nivel: 4, dias: 0 }], desde: inicio });
    q.semanas[w - 1].dias.forEach((d, i) => {
      if (d.tipo !== 'corrida_caminhada') return;
      const o = q0.semanas[w - 1].dias[i];
      assert.ok(d.ajustado && d.corridaMin >= o.corridaMin * 0.4 && d.corridaMin <= o.corridaMin * 0.6, `semana ${w}: ${o.corridaMin} → ${d.corridaMin} min`);
      assert.equal(d.corridaMin, Math.round(d.blocos.filter((x) => x.tipo === 'correr').reduce((s, x) => s + x.seg * (x.repeticoes || 1), 0) / 60));
      assert.ok(d.distKm < o.distKm && d.durMin < o.durMin);
    });
  }
});

test('B5, B6, C5, C6 e C14: calendário', () => {
  // prova em 12 semanas, aceito no domingo com treinos na terça, quinta e sábado: o plano começa na segunda e a prova
  // continua na 12ª semana contada a partir da semana da entrevista
  const a = { ...base, dias: ['2', '4', '6'], semanasProva: 12 };
  const aceite = '2026-11-15';
  const inicio = inicioPara(a, aceite);
  assert.equal(inicio, '2026-11-16');
  const st = estado(a, aceite, inicio);
  const p = planoAtual(st, '2026-11-16');
  assert.ok(p.prova.data >= '2027-01-25' && p.prova.data <= '2027-01-31', p.prova.data);
  assert.equal(p.totalSemanas, 11);
  // aceito na segunda anterior: 12 semanas inteiras, mesma data
  assert.equal(planoAtual(estado(a, '2026-11-09', inicioPara(a, '2026-11-09')), '2026-11-10').prova.data, p.prova.data);
  // nutrição: nada antes do início nem depois do fim
  assert.equal(resumoParaNutricao(st, '2026-11-15'), null);
  assert.ok(resumoParaNutricao(st, '2026-11-16'));
  assert.equal(resumoParaNutricao(st, somaDias(p.prova.data, 2)), null);
  assert.equal(resumoParaNutricao(st, somaDias(p.prova.data, 400)), null, 'um ano depois, a corrida não entra mais na conta');
  // iniciante: aceito no sábado, com corridas na segunda, quarta e sexta → começa na segunda seguinte, na etapa inicial
  assert.equal(inicioPara(novato, '2026-11-14'), '2026-11-16');
  assert.equal(inicioPara(novato, '2026-11-11'), '2026-11-16', 'já passou uma das corridas da semana');
  assert.equal(inicioPara(novato, '2026-11-09'), '2026-11-09');
  // dia do aceite: o do calendário do aparelho, não o de UTC
  assert.equal(diaLocal(new Date(2026, 10, 13, 22, 30).toISOString()), '2026-11-13');
  assert.equal(diaLocal(new Date(2026, 10, 13, 0, 30).toISOString()), '2026-11-13');
  assert.equal(diaLocal('x'), '');
  // respostas incompletas: sem plano (o Treinador pede a entrevista)
  const inc = estado({ ...base, idade: undefined }, '2026-11-09', '2026-11-09');
  assert.equal(planoAtual(inc, '2026-11-10'), null);
  assert.equal(planoDaSemana(inc, '2026-11-10'), null);
});

test('B10 e meta: ritmos só quando fazem sentido; resultado e meta dentro do possível', () => {
  const lento = gerarPlano({ ...base, resultado: '5', resultadoMin: 45 });
  assert.ok(lento.ritmos === null && lento.perfil.lento && lento.modo === 'tempo');
  assert.ok(lento.avisos.some((x) => /caminhada rápida/.test(x.texto) && x.refs.includes('hreljac2005')));
  assert.ok(lento.semanas.every((s) => s.dias.every((d) => d.ritmo === null && d.blocos.every((b) => !b.ritmo))));
  assert.equal(gerarPlano({ ...base, resultado: '3', resultadoMin: 28 }).ritmos, null);
  assert.ok(gerarPlano({ ...base, resultado: '5', resultadoMin: 32 }).ritmos.leve.de <= 500);
  // recordes mundiais como teto
  assert.equal(resultadoValido(42.195, 105 * 60), false);
  assert.equal(resultadoValido(42.195, 2 * 3600 + 5 * 60), true);
  assert.equal(resultadoValido(5, 12 * 60 + 30), false);
  assert.ok(Math.abs(recordeSeg(10) - 1571) < 1 && Math.abs(recordeSeg(21.0975) - 3411) < 1);
  const rapido = gerarPlano({ ...base, experiencia: 'avancado', kmSemana: 60, resultado: '42', resultadoMin: 105 });
  assert.ok(rapido.ritmos === null && rapido.perfil.resultadoInvalido && rapido.avisos.some((x) => /recorde mundial/.test(x.texto)));
  assert.ok(gerarPlano({ ...base, temAlvo: 'sim', alvoMin: 20 }).perfil.alvoInvalido, '10 km em 20 minutos não é meta');
  // sem resultado recente, a meta não vira ritmo de prova
  const semRes = gerarPlano({ ...base, resultado: 'nao', temAlvo: 'sim', alvoMin: 40 });
  const prova = semRes.semanas[11].dias.find((d) => d.tipo === 'prova');
  assert.ok(prova && prova.ritmo === null && semRes.avisos.some((x) => /não dá para saber se a meta/.test(x.texto)));
  // maratona: o aviso de meta ambiciosa e o ritmo da prova usam a mesma previsão
  const mar = { ...base, experiencia: 'avancado', kmSemana: 60, longoAtual: 24, provas: 'meia', distancia: '42', semanasProva: 18, dias: ['1', '2', '3', '4', '6', '0'], tempo: '90', tempoLongo: '150', resultado: '21', resultadoMin: 100, temAlvo: 'sim' };
  const R = gerarPlano({ ...mar, alvoMin: 300 }).ritmos;
  const limite = R.previsoes[42] * 1.025 * 0.95;
  for (const alvoMin of [Math.floor(limite / 60) - 1, Math.ceil(limite / 60) + 1]) {
    const p = gerarPlano({ ...mar, alvoMin });
    const ev = p.semanas[17].dias.find((d) => d.tipo === 'prova');
    assert.equal(ev.ritmo.de === ev.ritmo.ate, !p.avisos.some((x) => /Meta ambiciosa/.test(x.texto)), `alvo ${alvoMin}`);
  }
});

test('B12 e C7: pausar e retomar não reinicia nem conta como falta; duas corridas no mesmo dia valem um dia', () => {
  const inicio = '2026-09-07';
  const st = estado(novato, inicio, inicio);
  const p0 = gerarPlano(novato, { inicio });
  st.runs = feitas(p0, inicio, 1, 8);
  // 8 semanas feitas, pausa de 3 semanas a partir da 9ª
  st.run = { ...st.run, pausadoEm: new Date(2026, 10, 2, 10).toISOString() };
  assert.equal(planoAtual(st, '2026-11-10'), null, 'pausado: sem plano na semana');
  st.run = retomarPlano(st.run, '2026-11-23');
  assert.deepEqual(st.run.pausas, [{ de: '2026-11-02', ate: '2026-11-23', semanas: 3 }]);
  assert.equal(st.run.inicio, somaDias(inicio, 21));
  assert.equal(st.run.pausadoEm, '');
  const p = planoAtual(st, '2026-11-23');
  assert.equal(p.semanaAtual, 9, 'continua na semana em que parou');
  assert.ok(!p.ajustes.some((x) => /Repeti/.test(x.texto)), 'as semanas da pausa não contam como falta');
  assert.ok(p.ajustes.some((x) => /Volta de pausa: o programa recuou/.test(x.texto)));
  const etapaAntes = p0.semanas[8].etapa, etapaAgora = p.semanas[8].etapa;
  assert.ok(etapaAgora < etapaAntes && p.semanas[8].corridaMin <= p0.semanas[8].corridaMin * 0.6 && p.semanas[8].corridaMin >= 25, `etapa ${etapaAntes} → ${etapaAgora}`);
  assert.deepEqual(p.semanas.slice(0, 8).map((s) => s.etapa), p0.semanas.slice(0, 8).map((s) => s.etapa), 'as semanas feitas continuam como foram');
  assert.equal(treinoDoDia(st, '2026-11-23', '2026-09-07').semana, 1, 'as datas de antes da pausa continuam nas suas semanas');
  // pausa curta (menos de 2 semanas): retoma na mesma etapa
  const st2 = estado(novato, inicio, inicio);
  st2.runs = feitas(p0, inicio, 1, 3);
  st2.run = retomarPlano({ ...st2.run, pausadoEm: new Date(2026, 8, 28, 10).toISOString() }, '2026-10-06');
  assert.equal(planoAtual(st2, '2026-10-06').semanas[3].etapa, p0.semanas[3].etapa);
  // com prova marcada, a pausa não muda o calendário
  const a = { ...base, semanasProva: 16 };
  const st3 = estado(a, inicio, inicio);
  const dataProva = planoAtual(st3, inicio).prova.data;
  st3.run = retomarPlano({ ...st3.run, pausadoEm: new Date(2026, 8, 21, 10).toISOString() }, '2026-10-12');
  assert.equal(st3.run.inicio, inicio);
  assert.equal(st3.run.pausas[0].semanas, 0);
  assert.equal(planoAtual(st3, '2026-10-12').prova.data, dataProva);
  // C7: 3 registros, mas em um dia só → a semana do iniciante se repete
  const st4 = estado(novato, inicio, inicio);
  st4.runs = [reg('a', inicio, 'corrida_caminhada', 2, 25, 4), reg('b', inicio, 'corrida_caminhada', 2, 25, 4), reg('c', inicio, 'corrida_caminhada', 2, 25, 4)];
  assert.equal(planoAtual(st4, somaDias(inicio, 7)).semanas[1].etapa, p0.semanas[0].etapa);
  st4.runs = [reg('a', inicio, 'corrida_caminhada', 2, 25, 4), reg('b', somaDias(inicio, 2), 'corrida_caminhada', 2, 25, 4)];
  assert.equal(planoAtual(st4, somaDias(inicio, 7)).semanas[1].etapa, p0.semanas[1].etapa);
});

test('C3 e C4: longão e volume sem degraus no que a pessoa vê', () => {
  for (const a of [base, { ...base, aparelho: 'tempo' }, { ...base, experiencia: 'avancado', kmSemana: 55, longoAtual: 22, provas: 'meia', distancia: '42', semanasProva: 18, dias: ['1', '2', '3', '4', '6', '0'], tempo: '90', tempoLongo: '150', resultado: '21', resultadoMin: 105 }, { ...base, experiencia: 'avancado', kmSemana: 45, longoAtual: 16, distancia: '21', semanasProva: 20, dias: ['1', '2', '4', '6', '0'], aparelho: 'tempo', tempoLongo: '150' }]) {
    const p = gerarPlano(a);
    const longos = [];
    p.semanas.forEach((s, i) => {
      const lg = s.dias.find((d) => d.tipo === 'longo');
      const m = Math.max(0, ...longos.slice(-4));
      // por tempo, a regra vale em minutos; por distância, em quilômetros
      const medida = lg ? (p.modo === 'tempo' ? lg.durMin : lg.distKm) : 0;
      if (lg && m > 0 && s.fase !== 'polimento') assert.ok(medida <= Math.max(m * 1.1, m + (p.modo === 'tempo' ? (0.75 * lg.durMin) / lg.distKm : 0.75)) + (p.modo === 'tempo' ? 1 : 0.5), `semana ${s.n}: longo de ${medida} depois de ${m}`);
      longos.push(medida);
      if (i > 0 && !s.dias.some((d) => d.tipo === 'prova')) { const ant = Math.max(...p.semanas.slice(Math.max(0, i - 3), i).map((x) => x.volumeKm)); assert.ok(s.volumeKm <= Math.max(ant * 1.1, ant + 1.5) + 1.2, `semana ${s.n}: ${s.volumeKm} km depois de ${ant} km`); }
    });
  }
});

// ---------- quarta rodada: foco, corredor irregular, análise do treino feito, semana navegável ----------
const comMusculacao = (st, foco) => ({ ...st, plans: [{ id: 'p1', nome: 'Meu treino', origem: 'modelo', dias: [{ id: 'd1', nome: 'A', itens: [{ ex: 'x1' }] }], agenda: { 1: 'd1', 3: 'd1', 5: 'd1' } }], activePlan: 'p1', combo: { foco, fortalecimento: 'nao', em: '' } });

test('foco: a prioridade entre corrida e musculação muda a corrida conforme as fontes', () => {
  const a = { ...base, dias: ['1', '2', '3', '4', '5', '6'], kmSemana: 45, longoAtual: 14, experiencia: 'avancado', objetivo: 'saude' };
  const p0 = gerarPlano(a);
  const pm = gerarPlano(a, { foco: 'musculacao' });
  const pe = gerarPlano(a, { foco: 'equilibrio' });
  const pc = gerarPlano(a, { foco: 'corrida' });
  const corridas = (p) => Math.max(...p.semanas.map((s) => s.dias.filter(corr).length));
  const fortes = (p) => Math.max(...p.semanas.map((s) => s.dias.filter((d) => d.intensidade === 'forte').length));
  assert.ok(corridas(p0) >= 5 && fortes(p0) === 2);
  // musculação primeiro: até 3 corridas, de até 40 minutos, e no máximo 1 forte
  assert.ok(corridas(pm) <= 3 && fortes(pm) <= 1 && pm.semanas.every((s) => s.dias.every((d) => d.durMin <= 42)), 'corrida como complemento');
  assert.ok(pm.ajustes.some((x) => /complemento da musculação/.test(x.texto) && x.refs.includes('methenitis2018') && x.motivo.length > 80));
  // os dois por igual: até 4 corridas e 1 forte
  assert.ok(corridas(pe) <= 4 && fortes(pe) <= 1 && corridas(pe) > corridas(pm) && pe.ajustes.some((x) => /por igual/.test(x.texto) && x.refs.includes('baar2014')));
  // corrida primeiro: o plano de corrida não muda
  assert.deepEqual(pc.semanas, p0.semanas);
  assert.equal(gerarPlano(a, { foco: 'x' }).ajustes.length, 0, 'foco inválido não muda nada');
  // com foco na musculação, a maratona não cabe: vira distância menor, com aviso
  const mar = gerarPlano({ ...a, objetivo: 'prova', distancia: '42', semanasProva: 20, tempoLongo: '150' }, { foco: 'musculacao' });
  assert.ok(mar.perfil.dist < 42 && mar.avisos.some((x) => x.tipo === 'danger' && /musculação em primeiro lugar/.test(x.texto)));
  // pelo estado: só vale com os dois treinos e com a escolha feita
  const st = estado(a, '2026-11-02', '2026-11-02');
  assert.deepEqual(planoAtual(comMusculacao(st, ''), '2026-11-03').semanas, planoAtual(st, '2026-11-03').semanas, 'sem resposta, o plano fica como está');
  assert.ok(corridas(planoAtual(comMusculacao(st, 'musculacao'), '2026-11-03')) <= 3);
  assert.deepEqual(planoAtual({ ...st, combo: { foco: 'musculacao', fortalecimento: 'nao', em: '' } }, '2026-11-03').semanas, planoAtual(st, '2026-11-03').semanas, 'sem musculação na agenda, o foco não se aplica');
  // texto do cartão
  for (const f of ['corrida', 'musculacao', 'equilibrio']) { const e = efeitoDoFoco(f, st); assert.ok(e.linhas.length >= 1 && e.linhas.length <= 3 && e.linhas.every((l) => l.length > 30 && l.length < 200) && e.refs.length && e.refs.every((k) => REFS_CORRIDA[k]), f); }
  assert.deepEqual(efeitoDoFoco('', st), { linhas: [], refs: [] });
  assert.deepEqual(efeitoDoFoco('corrida', { run: { aceitoEm: '' } }), { linhas: [], refs: [] });
  // a semana expõe o que a musculação precisa para se encaixar
  const sem = planoDaSemana(st, '2026-11-03');
  assert.ok(sem.dias.filter(Boolean).every((d) => typeof d.forte === 'boolean' && typeof d.chave === 'boolean' && typeof d.tipo === 'string'));
  assert.equal(sem.diaLongo, sem.dias.find((d) => d && d.tipo === 'longo').wd);
});

test('corredor irregular e lento: 3 corridas curtas, só por esforço, base de 8 semanas', () => {
  const a = { experiencia: 'irregular', longoAtual: 4, objetivo: 'saude', dias: ['1', '2', '3', '4', '5', '6'], diaLongo: 'auto', tempo: '60', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  assert.ok(respostasCompletas(a), 'responde só a corrida mais longa; não responde quilometragem, pausa nem resultado');
  assert.equal(respostasCompletas({ ...a, longoAtual: undefined }), false);
  assert.ok(respostasCompletas(base) && respostasCompletas(novato), 'respostas antigas continuam válidas');
  const p = gerarPlano(a);
  assert.ok(p.perfil.irregular && p.perfil.nivel === 1 && p.modo === 'tempo' && p.ritmos === null && p.perfil.passo === 0.10);
  assert.ok(p.semanas.every((s) => s.dias.filter(corr).length === 3), '3 corridas por semana, desde a primeira');
  assert.ok(p.semanas[0].dias.filter(corr).every((d) => d.durMin <= 35) && p.semanas[0].volumeKm <= 11, 'começa com corridas curtas');
  assert.ok(p.semanas.slice(0, 8).every((s) => s.dias.every((d) => d.intensidade !== 'forte')), '8 semanas de base');
  assert.ok(p.semanas.every((s) => s.dias.every((d) => d.ritmo === null)), 'sem ritmo: só esforço');
  assert.ok(p.avisos.some((x) => /sem regularidade/.test(x.texto) && x.refs.includes('vanpoppel2021') && x.refs.includes('pollock1998')));
  // difere de quem corre com regularidade o mesmo tanto
  const reg = gerarPlano({ ...a, experiencia: 'iniciante', kmSemana: 9, pausa: 'treinando', resultado: 'nao' });
  assert.ok(Math.max(...reg.semanas.map((s) => s.dias.filter(corr).length)) === 4 && reg.perfil.passo === 0.14);
  // resultado que tenha sobrado de uma entrevista antiga não vira ritmo
  assert.equal(gerarPlano({ ...a, resultado: '5', resultadoMin: 27 }).ritmos, null);
  assert.ok(limparCorrida({ answers: a }).answers.experiencia === 'irregular', 'a opção passa pela validação do estado');
});

test('análise do treino feito: mais longo, mais rápido, esforço alto, forte trocado e corrida fora do plano', () => {
  const inicio = '2026-11-02';
  const st = estado(base, inicio, inicio);
  const p = planoAtual(st, inicio);
  const dia = (pred) => { for (const s of p.semanas.slice(0, 3)) for (const d of s.dias) if (pred(d)) return { d, data: somaDias(inicio, (s.n - 1) * 7 + ((d.wd + 6) % 7)) }; throw new Error('dia não encontrado'); };
  const leve = dia((d) => d.tipo === 'leve' && d.ritmo && d.blocos.length === 1); // rodagem sem acelerações: a média da sessão é o pace da rodagem
  const plan = planejadoDe(leve.d);
  // kmCorrendo só existe quando o treino tem caminhada no meio (acelerações)
  assert.deepEqual(Object.keys(plan).filter((k) => k !== 'kmCorrendo' && k !== 'trecho').sort(), ['distKm', 'durMin', 'pse', 'ritmo', 'tipo', 'un']);
  const feito = (extra) => ({ ...reg('a1', leve.data, 'leve', leve.d.distKm, leve.d.durMin, 3), plan, ...extra });
  const an = (r, runs = []) => analiseDoRegistro({ ...st, runs: [...runs, r] }, leve.data, r);
  // dentro do plano
  const ok = an(feito({}));
  assert.ok(ok.selo === 'dentro' && ok.itens.every((x) => x.tom === 'ok') && ok.plano === 'Nada muda no plano.', JSON.stringify(ok));
  // 30 minutos planejados × 40 feitos (sem salto sobre a corrida mais longa do mês): acima, sem alarme
  const plano30 = { ...plan, durMin: 30, distKm: 0, un: 't' }; // treino prescrito por tempo
  const mais = an({ ...reg('a2', leve.data, 'leve', 6.6, 40, 3), plan: plano30 }, [reg('z', somaDias(leve.data, -6), 'longo', 10, 62, 3)]);
  assert.ok(mais.selo === 'acima' && mais.itens.some((x) => /10 min a mais que o planejado \(30 min\): \+33%/.test(x.texto)) && !mais.itens.some((x) => x.tom === 'warn'), JSON.stringify(mais.itens));
  // o mesmo excesso como salto sobre a corrida mais longa dos últimos 30 dias: risco
  const salto = an({ ...reg('a3', leve.data, 'leve', 19.2, 120, 3), plan: plano30 }, [reg('z', somaDias(leve.data, -6), 'leve', 12, 75, 3)]);
  assert.ok(salto.itens.some((x) => x.tom === 'warn' && /60% a mais que a sua corrida mais longa/.test(x.texto)) && salto.refs.includes('frandsen2025') && /treinos leves/.test(salto.plano));
  // ritmo 6:00 planejado × 5:00 feito
  const plano6 = { ...plan, durMin: 30, distKm: 0, ritmo: [350, 370], un: 't' };
  const rapidoFacil = an({ ...reg('a4', leve.data, 'leve', 6, 30, 3), plan: plano6 });
  assert.ok(rapidoFacil.itens.some((x) => x.tom === 'info' && /5:00 por km, mais rápido que a faixa \(5:50 a 6:10\), com esforço baixo/.test(x.texto)) && /Teste de ritmo/.test(rapidoFacil.plano) && rapidoFacil.refs.includes('vdoto2_ajuste'));
  const rapidoPesado = an({ ...reg('a5', leve.data, 'leve', 6, 30, 6), plan: plano6 });
  assert.ok(rapidoPesado.selo === 'acima' && rapidoPesado.itens.some((x) => x.tom === 'warn' && /virou moderado/.test(x.texto)) && rapidoPesado.refs.includes('seiler2009') && /segura o volume/.test(rapidoPesado.plano));
  // esforço alto em treino leve, no ritmo certo
  const pesado = an(feito({ pse: 7 }));
  assert.ok(pesado.selo === 'acima' && pesado.itens.some((x) => x.tom === 'warn' && /Esforço 7 em treino leve/.test(x.texto)) && pesado.refs.includes('seiler2009') && pesado.refs.includes('inoue2022'));
  // mais lento, com esforço baixo: sem problema
  assert.ok(an({ ...reg('a6', leve.data, 'leve', 4.4, 30, 3), plan: plano6 }).itens.some((x) => x.tom === 'ok' && /devagar não é erro/.test(x.texto)));
  // mais curto: abaixo, sem repor
  const menos = an({ ...reg('a7', leve.data, 'leve', 2.2, 15, 3), plan: plano30 });
  assert.ok(menos.selo === 'abaixo' && /não repõe/.test(menos.plano) && menos.refs.includes('feely2023'));
  // treino forte que virou corrida leve, e treino forte em dia leve
  const forte = dia((d) => d.intensidade === 'forte');
  const trocado = analiseDoRegistro(st, forte.data, { ...reg('b1', forte.data, 'leve', 5, 32, 3), plan: planejadoDe(forte.d) });
  assert.ok(trocado.selo === 'abaixo' && trocado.itens.some((x) => /virou corrida leve/.test(x.texto)));
  const emDiaLeve = an(feito({ tipo: 'intervalado', pse: 8 }));
  assert.ok(emDiaLeve.selo === 'acima' && emDiaLeve.itens.some((x) => x.tom === 'warn' && /48 horas/.test(x.texto)) && emDiaLeve.refs.includes('buchheit2014'));
  // registro sem treino planejado
  const livre = analiseDoRegistro({ ...st, run: limparCorrida({}) }, '2026-11-03', reg('c1', '2026-11-03', 'livre', 5, 30, 4));
  assert.ok(livre.selo === 'livre' && livre.itens.length >= 1 && livre.refs.every((k) => REFS_CORRIDA[k]));
  // sem `plan` guardado, a análise usa o treino do plano naquele dia
  const semPlan = analiseDoRegistro({ ...st, runs: [] }, leve.data, reg('d1', leve.data, 'leve', leve.d.distKm, leve.d.durMin, 3));
  assert.equal(semPlan.selo, 'dentro');
  assert.equal(analiseDoRegistro(st, inicio, { id: 'x' }), null);
  for (const x of [ok, mais, salto, rapidoFacil, rapidoPesado, pesado, menos, trocado, emDiaLeve, livre]) assert.ok(x.titulo && x.plano.length > 10 && x.refs.every((k) => REFS_CORRIDA[k]) && x.itens.every((y) => y.texto.length > 15 && ['ok', 'info', 'warn'].includes(y.tom)));
  // o registro guarda o que estava planejado, validado
  const limpo = limparRegistro({ ...reg('e1', leve.data, 'leve', 5, 30, 3), plan: { ...plan, lixo: '<x>' } });
  assert.deepEqual(limpo.plan, plan);
  assert.equal('plan' in limparRegistro({ ...reg('e2', leve.data, 'leve', 5, 30, 3), plan: { tipo: '<script>', durMin: 'x' } }), false);
  assert.equal(limparRegistro({ ...reg('e3', leve.data, 'leve', 5, 30, 3), plan: { tipo: 'leve', durMin: 1e9, distKm: -4, ritmo: [1, 2], pse: [9, 3] } }).plan.ritmo, null);
});

test('análise recente e padrões: o plano muda quando o desvio se repete', () => {
  const inicio = '2026-09-07';
  const st = estado(base, inicio, inicio);
  const p0 = planoAtual(st, inicio);
  // 5 semanas à risca, com os leves sempre mais rápidos que a faixa e esforço baixo
  const runs = p0.semanas.slice(0, 5).flatMap((s) => s.dias.filter(corr).map((d) => {
    const data = somaDias(inicio, (s.n - 1) * 7 + ((d.wd + 6) % 7));
    const rapido = (d.tipo === 'leve' || d.tipo === 'longo' || d.tipo === 'regenerativo') && d.ritmo;
    return { ...reg(`s${s.n}d${d.wd}`, data, d.tipo, d.distKm, rapido ? (d.distKm * (d.ritmo.de - 25)) / 60 : d.durMin, rapido ? 3 : Math.round((d.pse[0] + d.pse[1]) / 2)), plan: planejadoDe(d) };
  }));
  const hoje = somaDias(inicio, 35);
  const com = { ...st, runs };
  const rec = analiseRecente(com, hoje);
  assert.ok(rec.itens.length === 5 && rec.itens.every((x) => x.analise && x.registro.id) && rec.padroes.some((x) => x.id === 'rapido_facil' && x.refs.every((k) => REFS_CORRIDA[k])));
  assert.equal(rec.contagem.dentro + rec.contagem.acima + rec.contagem.abaixo + rec.contagem.livre + rec.contagem.sem, 5);
  // o degrau de ritmo vem em 4 semanas (e não em 6) quando o padrão existe
  const adiantado = planoAtual(com, hoje);
  assert.ok(adiantado.ajustes.some((x) => /um degrau mais rápidos/.test(x.texto) && /mais rápidos que a faixa, com esforço baixo/.test(x.motivo)), JSON.stringify(adiantado.ajustes.map((x) => x.texto)));
  const semPadrao = planoAtual({ ...st, runs: runs.map((r) => ({ ...r, durMin: r.plan.durMin, pse: 3 })) }, hoje);
  assert.ok(!semPadrao.ajustes.some((x) => /degrau/.test(x.texto)), 'sem o padrão, o degrau só vem em 6 semanas');
  // treino forte feito na véspera de um treino forte do plano: o de hoje vira rodagem leve
  const s6 = p0.semanas[5];
  const forte = s6.dias.find((d) => d.intensidade === 'forte');
  const dataForte = somaDias(inicio, 35 + ((forte.wd + 6) % 7));
  const vespera = somaDias(dataForte, -1);
  const extra = { ...st, runs: [...runs.map((r) => ({ ...r, durMin: r.plan.durMin, pse: 3 })), reg('x1', vespera, 'tempo', 8, 44, 8)] };
  const trocado = planoAtual(extra, dataForte);
  assert.ok(trocado.semanas[5].dias.find((d) => d.wd === forte.wd).intensidade === 'leve' && trocado.ajustes.some((x) => /trocado por rodagem leve/.test(x.texto) && x.refs.includes('buchheit2014')));
  assert.equal(planoAtual({ ...st, runs: extra.runs.slice(0, -1) }, dataForte).semanas[5].dias.find((d) => d.wd === forte.wd).intensidade, 'forte');
  // treinos do plano sem registro: aparecem como faltas (só para quem registra)
  assert.deepEqual(analiseRecente(st, hoje).faltas, [], 'sem nenhum registro, não dá para saber o que foi feito');
  assert.deepEqual(analiseRecente(null, hoje), { itens: [], faltas: [], padroes: [], contagem: { dentro: 0, acima: 0, abaixo: 0, livre: 0, sem: 0 } });
  // leves com esforço alto: padrão e plano que segura o volume
  const pesados = analiseRecente({ ...st, runs: runs.map((r) => (r.tipo === 'leve' || r.tipo === 'regenerativo' ? { ...r, durMin: r.plan.durMin, pse: 6 } : r)) }, hoje);
  assert.ok(pesados.padroes.some((x) => x.id === 'leve_pesado'));
});

test('semana navegável: passada, atual, futura, antes do início e depois do fim', () => {
  // aceito no domingo: o plano começa na segunda, e a semana do início já aparece com os treinos
  const a = { ...base, dias: ['2', '4', '6'], semanasProva: 12 };
  const st = estado(a, '2026-11-15', inicioPara(a, '2026-11-15'));
  assert.equal(st.run.inicio, '2026-11-16');
  const antes = planoDaSemanaEm(st, '2026-11-15', '2026-11-09');
  assert.ok(antes.antesDoInicio && antes.comecaEm === '2026-11-16' && antes.dias.every((d) => d === null));
  const primeira = planoDaSemanaEm(st, '2026-11-15', '2026-11-16');
  assert.ok(primeira.antesDoInicio && primeira.semana === 1 && primeira.comecaEm === '2026-11-16' && primeira.dias.filter(Boolean).length === 3, 'a 1ª semana fica visível antes de começar');
  assert.ok(primeira.dias.filter(Boolean).every((d) => d.data >= '2026-11-16' && d.data <= '2026-11-22' && d.feito === null && typeof d.forte === 'boolean'));
  assert.ok(planoDaSemana(st, '2026-11-15').antesDoInicio && planoDaSemana(st, '2026-11-15').comecaEm === '2026-11-16');
  // atual: igual a planoDaSemana; qualquer dia da semana serve como referência
  const hoje = '2026-12-02';
  assert.deepEqual(planoDaSemanaEm(st, hoje, '2026-11-30'), planoDaSemana(st, hoje));
  assert.deepEqual(planoDaSemanaEm(st, hoje, '2026-12-03'), planoDaSemana(st, hoje));
  // passada, com o que foi feito
  const com = { ...st, runs: [reg('r1', '2026-11-17', 'leve', 5, 31, 3)] };
  const passada = planoDaSemanaEm(com, hoje, '2026-11-16');
  assert.ok(passada.semana === 1 && !passada.antesDoInicio && passada.dias[2].feito.id === 'r1' && passada.dias[4].feito === null);
  // futura e fim do plano
  const futura = planoDaSemanaEm(st, hoje, '2026-12-28');
  assert.ok(futura.semana === 7 && futura.dias.filter(Boolean).length === 3 && futura.inicioDaSemana === '2026-12-28');
  const ultima = planoDaSemanaEm(st, hoje, '2027-01-25');
  assert.ok(ultima.semana === 11 && ultima.dias.some((d) => d && d.tipo === 'prova'));
  const depois = planoDaSemanaEm(st, hoje, '2027-02-01');
  assert.ok(depois.concluido && depois.dias.every((d) => d === null));
  // semana pulada por uma pausa do plano
  const semData = estado({ ...base, objetivo: 'saude' }, '2026-09-07', '2026-09-07');
  semData.run = retomarPlano({ ...semData.run, pausadoEm: new Date(2026, 8, 21, 10).toISOString() }, '2026-10-12');
  assert.ok(planoDaSemanaEm(semData, '2026-10-12', '2026-09-28').foraDoPlano);
  assert.equal(planoDaSemanaEm(semData, '2026-10-12', '2026-10-12').semana, 3);
  assert.equal(planoDaSemanaEm(semData, '2026-10-12', '2026-09-07').semana, 1);
  // sem plano, datas inválidas
  assert.equal(planoDaSemanaEm({ run: limparCorrida({}) }, hoje, '2026-11-30'), null);
  assert.equal(planoDaSemanaEm(st, hoje, 'x'), null);
});

// ---------- quinta rodada: análise coerente, treino mostrado, lesões e questionário ----------
// vive o plano dia a dia, de `de` até a véspera de `ate`: guarda o que a tela mostra e registra as corridas
// (fator(hoje, treino) = quanto do treino mostrado é feito; 0 = não corre)
function viver(st, de, ate, fator = () => 1) {
  let s = st;
  for (let k = 0; somaDias(de, k) < ate; k++) {
    const hoje = somaDias(de, k);
    const g = guardarDoDia(s, hoje);
    if (g) s = { ...s, run: { ...s.run, ...g } };
    const t = treinoDoDia(s, hoje, hoje), f = t ? fator(hoje, t) : 0;
    if (t && corr(t) && f > 0) s = { ...s, runs: [...s.runs, { ...reg('v' + hoje, hoje, t.tipo, Math.round(t.distKm * f * 10) / 10, Math.round(t.durMin * f), 3), plan: planejadoDe(t) }] };
  }
  const g = guardarDoDia(s, ate);
  return g ? { ...s, run: { ...s.run, ...g } } : s;
}
const semanal = (st, inicio, n) => Array.from({ length: n }, (_, i) => planoAtual(st, somaDias(inicio, i * 7)).semanas[i].volumeKm);

test('C1: excesso grande nunca é tranquilizado sem comparação válida', () => {
  const inicio = '2026-11-02';
  // novato, 30 min planejados × 90 feitos, só com o tempo
  const stN = estado(novato, inicio, inicio);
  const tN = treinoDoDia(stN, inicio, inicio);
  const aN = analiseDoRegistro(stN, inicio, { ...reg('n1', inicio, 'corrida_caminhada', 0, tN.durMin * 3, null), plan: planejadoDe(tN) });
  assert.ok(aN.selo === 'acima' && aN.itens.some((x) => x.tom === 'warn' && /mais que dobra o risco/.test(x.texto) && /começando/.test(x.texto)), JSON.stringify(aN.itens));
  // regular, 6,3 km planejados × 12,6 feitos, sem histórico: compara com o longo informado na entrevista (10 km)
  const st = estado(base, inicio, inicio);
  const d = planoAtual(st, inicio).semanas[0].dias.find((x) => x.tipo === 'leve');
  const data = somaDias(inicio, (d.wd + 6) % 7);
  const aR = analiseDoRegistro(st, data, { ...reg('r1', data, 'leve', d.distKm * 2, d.durMin * 2, 3), plan: planejadoDe(d) });
  assert.ok(aR.itens.some((x) => x.tom === 'warn' && /informou na entrevista/.test(x.texto)), JSON.stringify(aR.itens));
  for (const a of [aN, aR]) assert.ok(!a.itens.some((x) => /acréscimo é pequeno|sem salto|não é um salto/.test(x.texto)) && a.plano !== 'Nada muda no plano.');
  // sem nada com que comparar (plano por tempo, registro só com distância, sem histórico): não afirma nem nega
  const semRef = analiseDoRegistro({ ...stN, run: { ...stN.run, inicio: '2026-01-05' } }, inicio, { ...reg('n2', inicio, 'corrida_caminhada', 9, 0, 3), plan: planejadoDe(tN) });
  assert.ok(!semRef.itens.some((x) => x.tom === 'ok' && /salto|acréscimo/.test(x.texto)) && !semRef.itens.some((x) => /a mais que o planejado/.test(x.texto)), 'C8: plano por tempo e registro só com distância não vira excesso por estimativa');
  assert.ok(semRef.itens.some((x) => /não tem o tempo/.test(x.texto)));
});

test('C2: semanas passadas e registro atrasado usam o treino que a tela mostrou', () => {
  const inicio = '2026-09-07';
  const st0 = estado(base, inicio, inicio);
  const p0 = planoAtual(st0, inicio);
  // semana 1 normal; na semana 2, dor 8 no joelho na terça: os dias seguintes viram "Sem corrida"
  let st = viver(st0, inicio, somaDias(inicio, 8));
  st = { ...st, dores: [{ id: 'd1', data: somaDias(inicio, 8), onde: 'joelho', lado: '', tipo: 'articular', quando: 'durante', nivel: 8, nota: '', fim: '' }] };
  st = viver(st, somaDias(inicio, 8), somaDias(inicio, 11), (hoje, t) => (t.tipo === 'descanso' ? 0 : 1));
  st = { ...st, dores: [{ ...st.dores[0], fim: somaDias(inicio, 11) }] }; // “Melhorou” 3 dias depois
  st = viver(st, somaDias(inicio, 11), somaDias(inicio, 21), (hoje, t) => (t.tipo === 'descanso' ? 0 : 1));
  const hoje = somaDias(inicio, 21);
  const quinta = somaDias(inicio, 10);
  const visto = treinoDoDia(st, hoje, quinta);
  assert.ok(visto && visto.tipo === 'descanso' && visto.guardado, 'visto depois, o dia continua como “Sem corrida”');
  assert.equal(planoDaSemanaEm(st, hoje, somaDias(inicio, 7)).dias[4].tipo, 'descanso');
  // sem o treino guardado, o dia vem como estimado e o registro atrasado não é comparado
  const semGuardar = { ...st, run: { ...st.run, mostrados: [] } };
  assert.ok(treinoDoDia(semGuardar, hoje, quinta).estimado && !treinoDoDia(semGuardar, hoje, quinta).guardado);
  const atrasado = analiseDoRegistro({ ...semGuardar, runs: [] }, hoje, reg('x', quinta, 'leve', 5, 31, 3));
  assert.ok(atrasado.selo === 'sem' && /não há como comparar/.test(atrasado.itens[0].texto));
  // com o treino guardado, o registro atrasado é comparado com o que a tela mostrou
  const terca1 = somaDias(inicio, 1), mostrado = st.run.mostrados.find((m) => m.data === terca1);
  const aGuardado = analiseDoRegistro({ ...st, runs: [] }, hoje, reg('y', terca1, mostrado.tipo, mostrado.distKm, mostrado.durMin, 3));
  assert.equal(aGuardado.selo, 'dentro');
  // faltas: só o que a tela mostrou como corrida e ficou sem registro
  const faltas = analiseRecente(st, hoje).faltas;
  assert.ok(faltas.every((f) => st.run.mostrados.some((m) => m.data === f.data && m.tipo === f.tipo) && f.tipo !== 'descanso' && f.tipo !== 'caminhada'));
  assert.deepEqual(analiseRecente({ ...semGuardar }, hoje).faltas, [], 'sem o treino guardado, não há falta');
  const pulou = viver(st0, inicio, somaDias(inicio, 14), (h2) => (h2 >= somaDias(inicio, 7) && h2 <= somaDias(inicio, 9) ? 0 : 1));
  assert.ok(analiseRecente(pulou, somaDias(inicio, 14)).faltas.length >= 1);
  // semana vista traz `semanaAtual`, e corridas em dia sem treino do plano vêm em `extras`
  const comExtra = { ...st, runs: [...st.runs, reg('e1', somaDias(inicio, 0), 'livre', 3, 20, 3)] };
  const s1 = planoDaSemanaEm(comExtra, hoje, inicio);
  assert.ok(s1.semana === 1 && s1.semanaAtual === 4 && s1.dias[1] === null && s1.extras[1].length === 1 && s1.extras[1][0].id === 'e1' && s1.extras[2].length === 0);
  assert.equal(planoDaSemanaEm(st, hoje, somaDias(inicio, 28)).semanaAtual, 4);
  // validação do estado: só o formato válido, um por data, os mais recentes
  const limpo = limparCorrida({ ...st.run, mostrados: [...st.run.mostrados, { data: 'x' }, { data: '2026-09-08', tipo: '<b>', nome: 5 }, 7, null], degrau: { pontos: 99, base: 'x' } });
  assert.ok(limpo.mostrados.length === st.run.mostrados.length && limpo.mostrados.find((m) => m.data === '2026-09-08').tipo === '' && limpo.degrau === null);
  assert.deepEqual(limparCorrida({ answers: base, mostrados: st.run.mostrados, degrau: { pontos: 1, base: 'entrevista' } }).mostrados, []);
  assert.equal(limparCorrida({ ...st.run, mostrados: Array.from({ length: 900 }, (_, i) => ({ data: somaDias('2020-01-01', i), tipo: 'leve', durMin: 30 })) }).mostrados.length, 400);
  assert.equal(guardarDoDia(st, hoje), null, 'sem mudança, nada a gravar');
  assert.ok(p0.semanas.length > 0);
});

test('C3: correr mais do que o plano mostrava nunca aumenta as semanas seguintes', () => {
  const inicio = '2026-09-07';
  for (const a of [{ ...base, objetivo: 'saude', kmSemana: 30, longoAtual: 10 }, base, { ...base, aparelho: 'tempo', dias: ['1', '3', '5', '6'] }]) {
    const st0 = estado(a, inicio, inicio);
    // 3 semanas fazendo metade: o plano corta; depois, uma semana fazendo exatamente o mostrado ou 2,2 vezes o mostrado
    const fraco = viver(st0, inicio, somaDias(inicio, 21), () => 0.5);
    const exato = viver(fraco, somaDias(inicio, 21), somaDias(inicio, 28), () => 1);
    const excesso = viver(fraco, somaDias(inicio, 21), somaDias(inicio, 28), () => 2.2);
    for (const k of [4, 5, 6]) {
      const hoje = somaDias(inicio, k * 7);
      const pe = planoAtual(k === 4 ? exato : viver(exato, somaDias(inicio, 28), hoje, () => 1), hoje), px = planoAtual(k === 4 ? excesso : viver(excesso, somaDias(inicio, 28), hoje, () => 1), hoje);
      assert.ok(px.semanas[k].volumeKm <= pe.semanas[k].volumeKm + 0.2, `semana ${k + 1}: ${px.semanas[k].volumeKm} km com excesso × ${pe.semanas[k].volumeKm} km seguindo o plano`);
      const lg = (p) => Math.max(0, ...p.semanas[k].dias.filter((d) => d.tipo === 'longo').map((d) => d.distKm));
      assert.ok(lg(px) <= lg(pe) + 0.1, `semana ${k + 1}: longo ${lg(px)} × ${lg(pe)}`);
    }
    assert.ok(analiseRecente(excesso, somaDias(inicio, 28)).padroes.some((x) => x.id === 'acima_do_volume' && /o plano mostrava/.test(x.texto)));
  }
});

test('C4, C5, C7, C9 e C10: selo, textos e padrões coerentes', () => {
  const inicio = '2026-11-02';
  const st = estado(base, inicio, inicio);
  const plano = (extra) => ({ tipo: 'leve', durMin: 40, distKm: 6.5, ritmo: [350, 400], pse: [2, 4], un: 't', ...extra });
  const an = (r, plan, runs = []) => analiseDoRegistro({ ...st, runs: [...runs] }, inicio, { ...r, plan });
  // varredura: tipo × quantidade × ritmo × esforço — o selo sai dos itens por uma regra só
  let n = 0;
  for (const tipo of ['leve', 'longo', 'regenerativo', 'fartlek', 'tempo', 'intervalado', 'progressivo', 'corrida_caminhada', 'prova']) for (const un of ['t', 'd']) for (const fq of [0, 0.4, 0.9, 1, 1.12, 1.6, 2.5]) for (const ritmo of [0, 300, 370, 430]) for (const pse of [null, 1, 3, 5, 7, 10]) for (const feitoTipo of [tipo, 'leve', 'livre', 'intervalado']) {
    const forte = ['fartlek', 'tempo', 'intervalado'].includes(tipo);
    const plan = plano({ tipo, un, pse: tipo === 'corrida_caminhada' ? [3, 5] : forte ? [7, 9] : tipo === 'progressivo' ? [3, 6] : tipo === 'prova' ? [7, 10] : [2, 4], ritmo: ['leve', 'longo', 'regenerativo'].includes(tipo) ? [350, 400] : null, distKm: tipo === 'prova' ? 10 : 6.5 });
    const dur = un === 't' ? plan.durMin * fq : ritmo ? (plan.distKm * fq * ritmo) / 60 : 0;
    const dist = un === 'd' ? plan.distKm * fq : ritmo && dur ? (dur * 60) / ritmo : 0;
    if (!dur && !dist) continue;
    const a = an(reg('q', inicio, feitoTipo, dist, dur, pse), plan);
    n++;
    const rot = JSON.stringify({ tipo, un, fq, ritmo, pse, feitoTipo, a });
    assert.ok(['dentro', 'acima', 'abaixo', 'sem'].includes(a.selo) && a.itens.length && a.plano && a.refs.every((k) => REFS_CORRIDA[k]), rot);
    if (a.selo === 'dentro') assert.ok(a.itens.every((x) => x.tom !== 'warn') && a.plano === 'Nada muda no plano.' && !a.itens.some((x) => /mais rápido que a faixa|a mais que|a menos que|bem acima|ficou menor/.test(x.texto)), 'dentro com alerta ou mudança: ' + rot);
    if (a.itens.some((x) => x.tom === 'warn')) assert.equal(a.selo, 'acima', 'alerta sem selo de acima: ' + rot);
    if (a.plano !== 'Nada muda no plano.' && a.plano !== 'Nada muda no plano por este treino.') assert.notEqual(a.selo, 'dentro', rot);
    // esforço 3 ou mais pontos fora da faixa sempre tem uma linha sobre o esforço
    if (pse != null && tipo !== 'prova' && (pse >= plan.pse[1] + 3 || pse <= plan.pse[0] - 3)) assert.ok(a.itens.some((x) => /[Ee]sforço/.test(x.texto) && x.tom !== 'ok'), 'esforço fora da faixa sem linha: ' + rot);
    // dentro da faixa de esforço que o plano mostrou, nenhum alerta de esforço (C5)
    if (pse != null && pse >= plan.pse[0] && pse <= plan.pse[1]) assert.ok(!a.itens.some((x) => x.tom === 'warn' && /^Esforço/.test(x.texto)), rot);
    // textos na unidade certa e ícone coerente (C10)
    if (un === 'd') assert.ok(!a.itens.some((x) => /Duração dentro/.test(x.texto)), rot);
    assert.ok(!a.itens.some((x) => x.tom === 'ok' && /soma mais cansaço/.test(x.texto)), rot);
    if (feitoTipo === 'livre' && pse >= 7 && forte) assert.ok(!a.itens.some((x) => /virou corrida leve/.test(x.texto)), rot);
    // dia de prova com menos distância que a prova não é "dentro"
    if (tipo === 'prova' && dist > 0 && dist < 9) assert.notEqual(a.selo, 'dentro', rot);
  }
  assert.ok(n > 5000, String(n));
  // corrida e caminhada com esforço 5 (o plano mostra 3 a 5) e bem menos tempo: abaixo, sem alerta de esforço
  const cc = an(reg('c', inicio, 'corrida_caminhada', 0, 10, 5), plano({ tipo: 'corrida_caminhada', durMin: 30, pse: [3, 5], ritmo: null }));
  assert.ok(cc.selo === 'abaixo' && !cc.itens.some((x) => x.tom === 'warn'));
  // duas corridas no mesmo dia, metade cada: somadas, dão o treino do dia
  const meia = reg('m1', inicio, 'leve', 3.3, 20, 3), outra = reg('m2', inicio, 'leve', 3.2, 20, 3);
  const soma = an(meia, plano({}), [{ ...outra, plan: plano({}) }]);
  assert.ok(soma.selo === 'dentro' && soma.itens.some((x) => /Somei as 2 corridas/.test(x.texto)), JSON.stringify(soma));
  assert.equal(analiseRecente({ ...st, runs: [{ ...meia, plan: plano({}) }, { ...outra, plan: plano({}) }] }, inicio).itens.length, 1, 'um item por dia');
  // padrão "leves pesados": mesma janela do gerador, e o texto só afirma o que o plano fez
  const inicio2 = '2026-09-07', st2 = estado(base, inicio2, inicio2);
  const pesado = viver(st2, inicio2, somaDias(inicio2, 14));
  const comPse = { ...pesado, runs: pesado.runs.map((r) => (r.tipo === 'leve' || r.tipo === 'regenerativo' || r.tipo === 'longo' ? { ...r, pse: 6 } : r)) };
  const h14 = somaDias(inicio2, 14), pl = planoAtual(comPse, h14), pad = analiseRecente(comPse, h14).padroes.find((x) => x.id === 'leve_pesado');
  assert.ok(pad && pl.sinais.pesado);
  assert.equal(/segurou o volume/.test(pad.texto), pl.ajustes.some((x) => /Volume mantido nesta semana|Semana leve antecipada/.test(x.texto)));
  // só na semana atual (ainda não entrou na conta do plano): o padrão não aparece
  const soAgora = { ...pesado, runs: [...pesado.runs, reg('p1', h14, 'leve', 5, 30, 7), reg('p2', somaDias(h14, 1), 'leve', 5, 30, 7)] };
  assert.equal(analiseRecente(soAgora, somaDias(h14, 2)).padroes.some((x) => x.id === 'leve_pesado'), planoAtual(soAgora, somaDias(h14, 2)).sinais.pesado);
});

test('C6: degrau de ritmo concedido não volta atrás', () => {
  const inicio = '2026-09-07';
  const st = estado(base, inicio, inicio);
  const hoje = somaDias(inicio, 30);
  const semDegrau = planoAtual(st, hoje);
  assert.equal(semDegrau.degrau.pontos, 0);
  const com = planoAtual({ ...st, run: { ...st.run, degrau: { pontos: 1, base: 'entrevista' } } }, hoje);
  assert.ok(com.degrau.pontos === 1 && com.ritmos.vdot > semDegrau.ritmos.vdot && com.ajustes.some((x) => /um degrau mais rápidos/.test(x.texto)));
  // degrau de outro resultado não vale
  assert.equal(planoAtual({ ...st, run: { ...st.run, degrau: { pontos: 2, base: '2026-08-01' } } }, hoje).degrau.pontos, 0);
  // guardarDoDia grava o degrau concedido e o mantém
  const g = guardarDoDia({ ...st, run: { ...st.run, degrau: { pontos: 1, base: 'entrevista' } } }, hoje);
  assert.deepEqual(g.degrau, { pontos: 1, base: 'entrevista' });
});

test('A1, B3 e B4: uma corrida por semana, dor informada na entrevista e plano sem data', () => {
  // 1 dia por semana: a corrida única segue o teto do treino longo, a partir da corrida mais longa informada
  for (const [a, teto] of [[{ ...base, experiencia: 'iniciante', kmSemana: 20, longoAtual: 4, dias: ['3'], tempo: '90', objetivo: 'saude', resultado: 'nao' }, 4.4], [{ ...base, dias: ['3'], tempo: '90', objetivo: 'saude', longoAtual: 6 }, 6.6], [{ ...base, experiencia: 'avancado', kmSemana: 60, longoAtual: 15, dias: ['6'], tempo: '90', objetivo: 'saude' }, 16.5]]) {
    const p = gerarPlano(a);
    const unica = (s) => s.dias.filter(corr)[0].distKm;
    assert.ok(unica(p.semanas[0]) <= teto + 0.3, `semana 1 com ${unica(p.semanas[0])} km para mais longa de ${a.longoAtual} km`);
    for (let i = 1; i < p.semanas.length; i++) { const ant = Math.max(...p.semanas.slice(Math.max(0, i - 4), i).map(unica)); assert.ok(unica(p.semanas[i]) <= Math.max(ant * 1.1, ant + 0.75) + 0.6, `semana ${i + 1}: ${unica(p.semanas[i])} depois de ${ant}`); }
  }
  // irregular: volume proporcional aos dias; quem ainda não corre 3 km seguidos parte de corrida e caminhada
  const irr = (extra) => gerarPlano({ experiencia: 'irregular', longoAtual: 4, objetivo: 'saude', dias: ['1', '3', '5'], diaLongo: 'auto', tempo: '60', aparelho: 'tempo', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], ...extra });
  assert.ok(irr({ dias: ['3'], tempo: '90' }).semanas[0].volumeKm <= 4.5 && irr({ dias: ['2', '5'] }).semanas[0].volumeKm <= 7);
  const curto = irr({ longoAtual: 1, dias: ['3'], tempo: '90' });
  assert.ok(curto.tipo === 'adaptacao' && curto.semanas[0].dias.some((d) => d.tipo === 'corrida_caminhada') && curto.semanas[0].dias.every((d) => d.tipo !== 'leve'));
  // dor informada na entrevista: sem treino forte nem acelerações nas 2 primeiras semanas, e orientação do local
  const a = { ...base, dias: ['1', '2', '3', '4', '5', '6'], kmSemana: 45, longoAtual: 14, experiencia: 'avancado' };
  const p0 = gerarPlano(a);
  assert.ok(p0.semanas[0].dias.some((d) => d.intensidade === 'forte'));
  const textos = new Set();
  for (const regiao of ['joelho', 'canela', 'aquiles', 'pe', 'quadril', 'coxa', 'lombar']) {
    const p = gerarPlano({ ...a, limitacoes: [regiao] });
    assert.ok(p.semanas.slice(0, 2).every((s) => s.dias.every((d) => d.intensidade !== 'forte' && !d.blocos.some((b) => b.rotulo === 'Acelerações'))), regiao);
    assert.ok(p.semanas[2].dias.some((d) => d.intensidade === 'forte') && p.perfil.passo === 0.10);
    assert.notDeepEqual(p.semanas[0], p0.semanas[0]);
    const av = p.avisos.find((x) => /Você disse que sente dor/.test(x.texto));
    assert.ok(av && av.tipo === 'warn' && av.refs.length && av.refs.every((k) => REFS_CORRIDA[k]), regiao);
    textos.add(av.texto);
  }
  assert.equal(textos.size, 7, 'cada região tem a sua orientação');
  // plano sem data não encolhe: tem pelo menos a duração mínima da distância
  const semData = gerarPlano({ ...base, experiencia: 'avancado', kmSemana: 30, longoAtual: 15, dias: ['3'], tempo: '30', objetivo: 'distancia', distancia: '21', tempoLongo: '60' });
  assert.ok(semData.totalSemanas >= 8 && !(semData.totalSemanas <= 4 && semData.semanas.some((s) => s.dias.some((d) => d.tipo === 'prova'))), String(semData.totalSemanas));
  for (const dist of ['5', '10', '21', '42']) for (const exp of ['iniciante', 'regular', 'avancado']) {
    const p = gerarPlano({ ...base, experiencia: exp, objetivo: 'distancia', distancia: dist, tempoLongo: '150' });
    const ev = p.semanas[p.totalSemanas - 1].dias.find((d) => d.tipo === 'prova');
    if (ev) assert.ok(p.totalSemanas >= 8, `${exp} ${dist}: ${p.totalSemanas} semanas`);
    // desafio que passa do tempo que a pessoa disse ter: aviso forte
    if (ev && ev.durMin > p.perfil.tempoLongoDito + 15) assert.ok(p.avisos.some((x) => x.tipo === 'danger' && x.destaque && /mais do que o tempo que você disse ter/.test(x.texto)), `${exp} ${dist}`);
  }
});

test('A2, A3, A4 e volta depois de dor: saúde e lesões', () => {
  // diabetes com liberação: o aviso diz "sem treinos fortes" e o plano cumpre
  const dia = gerarPlano({ ...base, condicoes: ['diabetes'], liberado: 'sim' });
  assert.ok(dia.semanas.every((s) => s.dias.every((d) => d.intensidade !== 'forte')) && dia.avisos.some((x) => /sem treinos fortes/.test(x.texto)));
  for (const p of [dia, gerarPlano({ ...base, condicoes: ['cardiaco'], liberado: 'sim' }), gerarPlano({ ...base, triagem: ['falta_ar'], liberado: 'sim' })]) assert.ok(/só em intensidade leve/.test(p.avisos.find((x) => x.tipo === 'danger').texto) && p.semanas.every((s) => s.dias.every((d) => d.intensidade !== 'forte')));
  // dor no peito que não é do músculo suspende em qualquer intensidade; gestante: abdômen e panturrilha
  const peito = efeitoDaDor({ onde: 'peito', tipo: 'articular', quando: 'durante', nivel: 5, dias: 0 });
  assert.ok(peito.nivel === 4 && /avaliação médica/.test(peito.texto) && /192/.test(peito.texto));
  assert.equal(efeitoDaDor({ onde: 'peito', tipo: 'muscular', quando: 'depois', nivel: 3, dias: 1 }).nivel, 0);
  const gest = perfil({ ...base, condicoes: ['gestante'], liberado: 'sim' });
  assert.equal(efeitoDaDor({ onde: 'abdomen', tipo: 'articular', quando: 'durante', nivel: 6, dias: 0 }, gest).nivel, 4);
  assert.equal(efeitoDaDor({ onde: 'panturrilha', tipo: 'muscular', quando: 'depois', nivel: 3, dias: 1 }, gest).nivel, 4);
  assert.equal(efeitoDaDor({ onde: 'panturrilha', tipo: 'muscular', quando: 'depois', nivel: 3, dias: 1 }, perfil(base)).nivel, 0);
  // chaves herdadas não passam
  for (const onde of ['__proto__', 'constructor', 'toString']) assert.deepEqual(efeitoDaDor({ onde, tipo: 'aguda', quando: 'repouso', nivel: 9 }), { nivel: 0, corte: 0, texto: '', refs: [] });
  assert.deepEqual(alertas([{ id: 'a', data: '2026-11-01', tipo: 'leve', distKm: 5, durMin: 30, pse: 3, dor: { onde: '__proto__', nivel: 4 } }], '2026-11-02'), []);
  // dor forte anotada na corrida não é anulada por um relato leve do mesmo local e do mesmo dia: vale o pior
  const inicio = '2026-11-02', ontem = somaDias(inicio, 1), hoje = somaDias(inicio, 2);
  const corrida = reg('d1', ontem, 'leve', 6, 38, 4, { onde: 'joelho', nivel: 8 });
  const relato = { onde: 'joelho', nivel: 2, tipo: 'articular', quando: 'durante', dias: 1, data: ontem };
  const p = gerarPlano(base, { inicio, hoje, registros: [corrida], dores: [relato], desde: inicio });
  assert.ok(p.semanas[0].dias.filter((d) => d.wd !== 1 && d.wd !== 2 && d.tipo !== 'caminhada').every((d) => d.tipo === 'descanso'), JSON.stringify(tipos(p.semanas[0])));
  // relato posterior à corrida (a pessoa atualizou a dor): vale o relato
  const depois = gerarPlano(base, { inicio, hoje, registros: [corrida], dores: [{ ...relato, data: hoje, dias: 0 }], desde: inicio });
  assert.ok(depois.semanas[0].dias.some((d) => d.tipo !== 'descanso' && d.tipo !== 'caminhada' && d.wd !== 1 && d.wd !== 2));
  // canela aguda 8 e “Melhorou” 2 dias depois: a volta é gradual (sem treino forte, volume reduzido)
  const ini2 = '2026-09-07', st0 = estado({ ...base, objetivo: 'saude', kmSemana: 30 }, ini2, ini2);
  const st = viver(st0, ini2, somaDias(ini2, 21));
  const comDor = { ...st, dores: [{ id: 'c1', data: somaDias(ini2, 21), onde: 'canela', lado: '', tipo: 'aguda', quando: 'durante', nivel: 8, nota: '', fim: somaDias(ini2, 23) }] };
  const volta = planoAtual(comDor, somaDias(ini2, 24));
  assert.ok(volta.ajustes.some((x) => /Volta depois da dor/.test(x.texto)) && volta.semanas[3].dias.every((d) => d.intensidade !== 'forte'), JSON.stringify(volta.ajustes.map((x) => x.texto)));
  // B5: a folha da escolha avisa, antes, o que a prioridade faz com a meta de corrida
  const meia = estado({ ...base, experiencia: 'avancado', kmSemana: 45, longoAtual: 16, distancia: '21', semanasProva: 16, tempoLongo: '150', dias: ['1', '2', '4', '6', '0'] }, '2026-11-02', '2026-11-02');
  assert.match(efeitoDoFoco('musculacao', meia).linhas[0], /Com essa prioridade, a sua meta de meia maratona passa a/);
  assert.ok(!efeitoDoFoco('corrida', meia).linhas.some((l) => /Com essa prioridade/.test(l)));
});

test('triagem da corrida: "só com supervisão" não tem saída pela liberação; a pergunta da liberação só aparece com motivo', () => {
  const q = PERGUNTAS.find((x) => x.k === 'liberado');
  assert.equal(q.dataEm, 'liberadoEm');
  assert.ok(!q.se(base));
  assert.ok(q.se({ ...base, triagem: ['sopro'] }) && q.se({ ...base, condicoes: ['hipertensao'] }) && q.se({ ...base, remedios: ['glicose'] }));
  assert.ok(!q.se({ ...base, triagem: ['medico'] }) && !q.se({ ...base, triagem: ['medico', 'tontura'] }));
  assert.equal(motivoBloqueio({ ...base, triagem: ['medico'] }), 'supervisao');
  assert.match(avisosBloqueio({ ...base, triagem: ['medico'] })[0].texto, /supervisão/);
  // respostas salvas com "só com supervisão" e "liberado: sim" (versão anterior) continuam válidas, mas sem plano
  assert.ok(respostasCompletas({ ...base, triagem: ['medico'], liberado: 'sim' }));
  assert.equal(gerarPlano({ ...base, triagem: ['medico'], liberado: 'sim' }), null);
});

test('zonas: com remédio que segura o pulso, nada de frequência cardíaca (só esforço e fala)', () => {
  const z = zonasDe(perfil({ ...base, remedios: ['pulso'] }), null);
  assert.equal(z.fcMax, null);
  assert.ok(z.lista.every((x) => x.fc === null && x.pse && x.fala));
  assert.ok(zonasDe(perfil(base), null).lista[0].fc[0] > 0);
  const p = gerarPlano({ ...base, remedios: ['pulso'] });
  assert.ok(p.orientacoes.find((o) => o[0] === 'Como sentir o esforço')[1].includes('não use os batimentos'));
});

// ---------- 1.14.0: acelerações, km só correndo, etapas e tempo do plano ----------
test('rodagem com acelerações: o resumo diz 15 s, a distância soma tudo e o texto explica o que entra nela', () => {
  const inicio = '2026-11-02';
  const base = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'saude', dias: ['1', '2', '4', '6'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], resultado: '5', resultadoMin: 25 };
  const st = estado(base, inicio, inicio);
  const p = planoAtual(st, inicio);
  let achado = null;
  for (const s of p.semanas) for (const d of s.dias) if (!achado && d.tipo === 'leve' && /acelera/.test(d.resumo || '')) achado = { d, data: somaDias(inicio, (s.n - 1) * 7 + ((d.wd + 6) % 7)) };
  assert.ok(achado, 'plano com uma rodagem com acelerações');
  const { d, data } = achado;
  assert.match(d.resumo, /6 acelerações de 15 s/);
  assert.ok(d.kmCorrendo && d.kmCorrendo < d.distKm, `km correndo ${d.kmCorrendo} < total ${d.distKm}`);
  const plan = planejadoDe(d);
  assert.equal(plan.kmCorrendo, d.kmCorrendo);
  // o detalhe diz quanto as acelerações e a caminhada somam e o total
  assert.match(d.detalhe, /As acelerações e a caminhada entre elas somam cerca de [\d,]+ km: o treino inteiro dá/);
  // só a rodagem (sem as acelerações): fica abaixo do total, e o texto diz o que o total inclui
  const correu = d.blocos[0].m / 1000;
  const r = { ...reg('ac1', data, 'leve', correu, d.durMin - 1, 3), plan };
  const txt = analiseDoRegistro({ ...st, runs: [r] }, data, r).itens.map((x) => x.texto).join(' | ');
  if (d.distKm - correu >= 0.6 && (d.distKm - correu) / d.distKm >= 0.15) assert.match(txt, /a menos que o planejado \([\d,]+ km, contando as acelerações e a caminhada entre elas\)/);
  // o treino inteiro: dentro do planejado
  const r2 = { ...reg('ac2', data, 'leve', d.distKm, d.durMin, 3), plan };
  assert.match(analiseDoRegistro({ ...st, runs: [r2] }, data, r2).itens.map((x) => x.texto).join(' | '), /Distância dentro do planejado/);
});
test('corrida e caminhada: as etapas de corrida contam; registro sem tempo usa o do plano, marcado como estimado', () => {
  const t = { tipo: 'corrida_caminhada', blocos: [{ tipo: 'aquecer', seg: 300 }, { tipo: 'correr', seg: 180, repeticoes: 4, pausa: { tipo: 'caminhar', seg: 120 }, pausaFinal: true }, { tipo: 'desaquecer', seg: 300 }] };
  assert.equal(etapasDe(t), 4);
  const r = limparRegistro({ id: 'cc1', data: '2026-11-10', tipo: 'corrida_caminhada', durMin: 25, durEst: true, etapas: { feitas: 3, de: 4 } });
  assert.deepEqual(r.etapas, { feitas: 3, de: 4 });
  assert.equal(r.durEst, true);
  // etapas impossíveis saem; tempo estimado com distância não vale
  assert.equal(limparRegistro({ id: 'cc2', data: '2026-11-10', durMin: 25, etapas: { feitas: 5, de: 4 } }).etapas, undefined);
  assert.equal(limparRegistro({ id: 'cc3', data: '2026-11-10', durMin: 25, distKm: 3, durEst: true }).durEst, undefined);
});
test('3 km numa rodagem de 3 km + acelerações (3,8 km no total): "a menos", dizendo que o total conta as acelerações', () => {
  const plan = { tipo: 'leve', durMin: 26, distKm: 3.8, kmCorrendo: 3.3, ritmo: null, pse: [2, 4], un: 'd' };
  const st = { run: null, runs: [], dores: [], plans: [], activePlan: '' };
  const r = { ...reg('ac3', '2026-11-18', 'leve', 3.04, 25, 3), plan };
  const txt = analiseDoRegistro({ ...st, runs: [r] }, '2026-11-18', r).itens.map((x) => x.texto).join(' | ');
  assert.match(txt, /Você fez 0,8 km a menos que o planejado \(3,8 km, contando as acelerações e a caminhada entre elas\): -20%/);
});
test('cada treino diz o que fazer: acelerações com duração e caminhada; sem GPS, sem ritmo por km; teste sem GPS na pista', () => {
  const b = { rotulo: 'Corrida leve', tipo: 'correr', seg: 2700, ritmo: { de: 363, ate: 434 } };
  assert.match(textoBloco(b, 'gps'), /por km/);
  assert.doesNotMatch(textoBloco(b, 'tempo'), /por km/);
  const base = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'saude', dias: ['1', '2', '4', '6'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], resultado: '5', resultadoMin: 25 };
  for (const aparelho of ['gps', 'tempo']) {
    const p = planoAtual(estado({ ...base, aparelho }, '2026-11-02', '2026-11-02'), '2026-11-02');
    const dias = p.semanas.flatMap((s) => s.dias).filter((d) => d && d.tipo);
    const acel = dias.find((d) => /acelera/.test(d.resumo || ''));
    if (acel) assert.match(acel.resumo, /6 acelerações de 15 s \(1 min caminhando entre elas\)/);
    for (const d of dias.filter((x) => Array.isArray(x.blocos) && x.blocos.length)) {
      for (const bl of d.blocos) if (/Aquecimento: trote leve/.test(bl.rotulo || '')) assert.match(bl.rotulo, /\(5 a 15 s\)/);
      if (aparelho === 'tempo') for (const bl of d.blocos) assert.doesNotMatch(textoBloco(bl, d.modo), /por km/, d.nome);
    }
  }
});

test('pace do trecho: o plano guarda o trecho principal; o registro guarda o pace; a análise compara com a faixa do trecho', () => {
  // intervalado: o trecho é o tiro
  const t = { tipo: 'intervalado', blocos: [{ rotulo: 'Aquecimento em corrida leve', tipo: 'aquecer', seg: 600 }, { rotulo: 'Tiro forte', tipo: 'forte', seg: 180, repeticoes: 3, pausa: { tipo: 'trote', seg: 120 }, ritmo: { de: 291, ate: 300 } }, { rotulo: 'Volta à calma em trote leve', tipo: 'desaquecer', seg: 300 }], durMin: 28, distKm: 4.6, pse: [7, 9] };
  const plan = planejadoDe(t);
  assert.deepEqual(plan.trecho, { rotulo: 'Tiro forte', ritmo: [291, 300] });
  const st = { run: null, runs: [], dores: [], plans: [], activePlan: '' };
  const texto = (extra) => { const r = { ...limparRegistro({ id: 'pt1', data: '2026-11-18', tipo: 'intervalado', distKm: 4.6, durMin: 28, pse: 8, ...extra }), plan }; return analiseDoRegistro({ ...st, runs: [r] }, '2026-11-18', r).itens.map((x) => x.texto).join(' | '); };
  assert.match(texto({ paceTrecho: 295 }), /Pace de 4:55 por km em “tiro forte”: dentro da faixa \(4:51 a 5:00\)/);
  assert.match(texto({ paceTrecho: 270 }), /mais rápido que a faixa/);
  assert.match(texto({ paceTrecho: 330 }), /mais lento que a faixa/);
  // pace impossível sai do registro
  assert.equal(limparRegistro({ id: 'pt2', data: '2026-11-18', durMin: 28, paceTrecho: 60 }).paceTrecho, undefined);
  // rodagem contínua de um bloco só: sem trecho (a média da sessão já é o pace)
  assert.equal(planejadoDe({ tipo: 'leve', blocos: [{ rotulo: 'Corrida leve', tipo: 'correr', m: 6000, ritmo: { de: 363, ate: 434 } }], durMin: 43, distKm: 6 }).trecho, undefined);
  // rodagem com acelerações: o trecho é a rodagem; sem o pace dela, a média da sessão não é comparada com a faixa
  const lv = { tipo: 'leve', blocos: [{ rotulo: 'Corrida leve', tipo: 'correr', m: 6500, ritmo: { de: 363, ate: 434 } }, { rotulo: 'Acelerações', tipo: 'forte', seg: 15, repeticoes: 6, pausa: { tipo: 'caminhar', seg: 60 } }], durMin: 50, distKm: 7.3, pse: [2, 4], ritmo: { de: 363, ate: 434 }, kmCorrendo: 6.8 };
  const pl = planejadoDe(lv);
  assert.equal(pl.trecho.rotulo, 'Corrida leve');
  const r0 = { ...limparRegistro({ id: 'pt3', data: '2026-11-18', tipo: 'leve', distKm: 7.3, durMin: 56, pse: 3 }), plan: pl };
  const t0 = analiseDoRegistro({ ...st, runs: [r0] }, '2026-11-18', r0).itens.map((x) => x.texto).join(' | ');
  assert.ok(!/Mais lento que a faixa/.test(t0) && /anote o pace da rodagem/.test(t0), t0);
  const r1 = { ...limparRegistro({ id: 'pt4', data: '2026-11-18', tipo: 'leve', distKm: 7.3, durMin: 56, pse: 3, paceTrecho: 400 }), plan: pl };
  assert.match(analiseDoRegistro({ ...st, runs: [r1] }, '2026-11-18', r1).itens.map((x) => x.texto).join(' | '), /Ritmo dentro da faixa/);
});
test('teste de ritmo marcado pelo plano: só sem resultado e com como medir a distância; some depois de registrado', () => {
  const base = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'saude', dias: ['1', '2', '4', '6'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
  const testes = (a, runs = [], hoje = '2026-09-01') => { const st = estado(a, '2026-09-01', '2026-09-01'); st.runs = limparRegistros(runs); return planoAtual(st, hoje).semanas.flatMap((s) => s.dias.filter((d) => d.tipo === 'teste').map((d) => ({ n: s.n, d }))); };
  const t = testes({ ...base, resultado: 'nao' });
  assert.equal(t.length, 1);
  assert.equal(t[0].n, 2);
  assert.ok(t[0].d.automatico && /5 km/.test(t[0].d.nome) && /marque o tipo “Teste de ritmo”/.test(t[0].d.detalhe));
  // quem ainda não corre 5 km com folga (corrida mais longa de 4 km): teste de 3 km, dentro dos 10% sobre a mais longa
  const curto = testes({ ...base, resultado: 'nao', longoAtual: 4 });
  assert.equal(curto.length, 1);
  assert.ok(/Teste de 3 km/.test(curto[0].d.nome) && curto[0].d.distKm === 3, curto[0].d.nome);
  assert.ok(/5 km/.test(testes({ ...base, resultado: 'nao', longoAtual: 5 })[0].d.nome));
  // com resultado, sem GPS, com cautela ou menor de 16: nenhum teste automático
  assert.equal(testes({ ...base, resultado: '5', resultadoMin: 25 }).length, 0);
  assert.equal(testes({ ...base, resultado: 'nao', aparelho: 'tempo' }).length, 0);
  // registrado o teste, ele sai do plano e os ritmos aparecem
  const feito = [{ id: 't1', data: '2026-09-09', tipo: 'teste', distKm: 5, durMin: 27, pse: 8, dores: [], nota: '', planejado: '' }];
  assert.equal(testes({ ...base, resultado: 'nao' }, feito, '2026-09-10').length, 0);
});

test('correr todo dia: cada perfil tem a sua regra (saúde e prazer com base, distância só com muito volume; quem começa, não)', async () => {
  const { alertas: al } = await import('../www/js/logic/corrida.js');
  const sete = ['0', '1', '2', '3', '4', '5', '6'];
  const a = { ...base, dias: sete, objetivo: 'saude', resultado: 'nao', kmSemana: 25, longoAtual: 10 };
  const corridasMax = (p) => Math.max(...p.semanas.map((s) => s.dias.filter(corr).length));
  const casos = [
    // [respostas, pode correr todo dia]
    [{ ...a }, true],
    [{ ...a, soTempo: 'sim', aparelho: 'tempo' }, true], // pelo prazer
    [{ ...a, experiencia: 'avancado', kmSemana: 50, longoAtual: 20, objetivo: 'prova', distancia: '42', semanasProva: 16, tempoLongo: '180' }, true],
    [{ ...a, objetivo: 'distancia', distancia: '21' }, false], // correr mais longe sem muito volume
    [{ ...a, experiencia: 'nunca', objetivo: 'comecar' }, false],
    [{ ...a, experiencia: 'iniciante', kmSemana: 8, longoAtual: 4 }, false],
    [{ ...a, experiencia: 'irregular' }, false],
    [{ ...a, pausa: '1a3m' }, false],
    [{ ...a, lesao12m: 'sim' }, false],
    [{ ...a, idade: 16 }, false],
    [{ ...a, idade: 65 }, false],
    [{ ...a, condicoes: ['hipertensao'], liberado: 'sim' }, false],
  ];
  for (const [r, pode] of casos) {
    const pf = perfil(r), p = gerarPlano(r);
    assert.equal(pf.podeTodoDia, pode, JSON.stringify(r));
    assert.equal(pf.descansoForcado == null, pode);
    if (pode) {
      assert.equal(corridasMax(p), 7);
      assert.ok(p.avisos.some((x) => /Você pode correr todo dia/.test(x.texto)));
      // nunca 2 treinos fortes em dias seguidos, nem forte colado no longo
      for (const s of p.semanas) for (let i = 1; i < s.dias.length; i++) assert.ok(!(s.dias[i].intensidade === 'forte' && s.dias[i - 1].intensidade === 'forte'));
    } else {
      assert.ok(corridasMax(p) <= 6);
      const av = p.avisos.find((x) => /Você pediu para correr todo dia/.test(x.texto));
      if (!pf.bloqueado) assert.ok(av && av.refs.length, JSON.stringify(r));
    }
  }
  // quem começa: o motivo é o risco de quem começa; quem corre: a regra da distância
  assert.match(gerarPlano({ ...a, experiencia: 'iniciante', kmSemana: 8, longoAtual: 4 }).avisos.find((x) => /correr todo dia\. Deixei/.test(x.texto)).texto, /começando/);
  assert.match(gerarPlano({ ...a, objetivo: 'distancia', distancia: '21' }).avisos.find((x) => /correr todo dia\. Deixei/.test(x.texto)).texto, /mais longe ou mais rápido/);
  // com 6 dias, quem pode correr todo dia corre os 6; com 4, nada muda
  assert.equal(corridasMax(gerarPlano({ ...a, dias: ['1', '2', '3', '4', '5', '6'] })), 6);
  // 7 dias seguidos: o lembrete muda conforme o perfil
  const hoje = '2026-11-23';
  const rs = Array.from({ length: 7 }, (_, k) => ({ id: 'r' + k, data: `2026-11-${String(23 - k).padStart(2, '0')}`, tipo: 'leve', durMin: 30, distKm: 5, pse: 3 }));
  assert.match(al(rs, hoje, false, true).find((x) => /dias seguidos/.test(x.texto)).texto, /pule o dia/);
  assert.match(al(rs, hoje, false, false).find((x) => /dias seguidos/.test(x.texto)).texto, /1 dia sem corrida/);
});

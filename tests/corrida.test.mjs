// Regras do Treinador de corrida: perfil, plano, segurança e ajuste pelos registros.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERGUNTAS, respostasCompletas, perfil, gerarPlano, motivoBloqueio, avisosBloqueio, ritmosDe, vdotDe, riegel, zonasDe, expandirBlocos, textoBloco, efeitoDaDor, orientacaoDor, planoDaSemana, treinoDoDia, resumoParaNutricao, inicioPara, diasDeForca, evolucao, alertas, dicas, limparRegistro, limparRegistros, MAX_REGISTROS, limparCorrida, retomarPlano, recordeSeg, resultadoValido, planoAtual, diaLocal, fmtRitmo, fmtFaixa, fmtDuracao, somaDias, diaDaSemana, ETAPAS_CC } from '../www/js/logic/corrida.js';
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
  assert.equal(respostasCompletas({ ...base, dias: [] }), false);
  assert.equal(respostasCompletas({ ...base, condicoes: ['hipertensao'] }), false, 'com condição de saúde, precisa responder sobre a liberação médica');
  assert.ok(respostasCompletas({ ...base, condicoes: ['hipertensao'], liberado: 'nao' }));
  for (const q of PERGUNTAS) { assert.ok(q.k && q.titulo && ['um', 'varios', 'numero'].includes(q.tipo)); if (q.tipo !== 'numero') assert.ok(q.op.length >= 2); else assert.ok(q.min < q.max && q.padrao >= q.min && q.padrao <= q.max && q.un); }
  // a entrevista pergunta como a pessoa mede a corrida e quais dias da semana tem
  assert.deepEqual(PERGUNTAS.find((q) => q.k === 'aparelho').op.map((o) => o[0]), ['gps', 'esteira', 'tempo', 'nada']);
  assert.deepEqual(PERGUNTAS.find((q) => q.k === 'dias').op.map((o) => o[0]).sort(), ['0', '1', '2', '3', '4', '5', '6']);
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
  assert.deepEqual(s1.blocos.map((b) => [b.tipo, b.seg, b.repeticoes || 1]), [['aquecer', 300, 1], ['correr', 60, 10], ['desaquecer', 300, 1]], '1ª semana: 10 × (1 min correndo + 1 min caminhando), com 5 min de caminhada antes e depois');
  assert.equal(p.semanas[0].corridaMin, 30);
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
  assert.equal(passos.length, 22); assert.equal(passos[1].tipo, 'correr'); assert.equal(passos[2].tipo, 'caminhar'); assert.equal(passos.reduce((x, y) => x + y.seg, 0), 300 + 20 * 60 + 300);
  assert.match(textoBloco(s1.blocos[1], 'tempo'), /10 × 1 min, com 1 min de caminhada/);
  // quem já alterna corrida e caminhada entra mais adiante
  assert.ok(gerarPlano({ ...novato, experiencia: 'caminha' }).totalSemanas < p.totalSemanas);
});

test('IMC de 30 ou mais, 60+ e pós-parto: começo mais lento, com menos de 3 km de corrida na 1ª semana', () => {
  for (const a of [{ ...novato, peso: 95 }, { ...novato, idade: 66 }]) {
    const p = gerarPlano(a);
    assert.equal(p.totalSemanas, ETAPAS_CC - 1);
    assert.equal(p.semanas[0].corridaMin, 18, '1ª semana: 6 min de corrida por sessão');
    assert.ok((p.semanas[0].corridaMin * 60) / 480 < 3, 'menos de 3 km de corrida na primeira semana');
  }
  assert.ok(gerarPlano({ ...novato, peso: 95 }).avisos.some((a) => /menos de 3 km/.test(a.texto) && a.refs.includes('nielsen2014imc')));
  // pós-parto (com liberação): começa ainda mais curto, com 30 segundos de corrida por vez
  const pp = gerarPlano({ ...novato, condicoes: ['posparto'], liberado: 'sim' });
  assert.equal(pp.totalSemanas, ETAPAS_CC);
  assert.deepEqual(pp.semanas[0].dias[0].blocos[1].seg, 30);
  assert.equal(pp.semanas[0].corridaMin, 12);
  assert.ok(pp.avisos.some((a) => /Pós-parto/.test(a.texto) && a.refs.includes('deering2024')));
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
  assert.ok(p.semanas.every((s) => s.dias.every((d) => d.tipo !== 'longo' || d.durMin <= 152)), 'nenhum treino longo passa de 2h30 (Daniels)');
  assert.equal(p.perfil.tempoLongo, 150);
  assert.equal(p.semanas.filter((s) => s.fase === 'polimento').length, 3);
  const pico = Math.max(...p.semanas.map((s) => s.volumeKm));
  const [a1, a2] = [p.semanas[15].volumeKm, p.semanas[16].volumeKm];
  assert.ok(a1 < pico * 0.85 && a2 < a1, 'o volume cai de forma progressiva no polimento');
  assert.ok(p.semanas.some((s) => s.dias.some((d) => d.tipo === 'longo' && d.blocos.length === 2)), 'há longos com o final em ritmo de maratona');
  assert.ok(p.avisos.some((x) => /Primeira maratona/.test(x.texto)));
  assert.ok(p.ritmos.prova[42].ate > p.ritmos.prova[42].de, 'ritmo de maratona como faixa (a previsão é otimista para amadores)');
  // prazo curto demais: o plano não acelera além do seguro e avisa
  const curto = gerarPlano({ ...base, distancia: '42', semanasProva: 5, tempoLongo: '180' });
  assert.ok(curto.avisos.some((x) => x.tipo === 'danger' && x.destaque && /Não marquei a prova de maratona em 5 semanas/.test(x.texto)), 'prazo que não comporta a distância: a prova não é marcada');
  assert.ok(curto.perfil.objetivo === 'distancia' && !curto.semanas.some((s) => s.dias.some((d) => d.nome.startsWith('Prova'))));
  // maior treino entre a metade da prova e 25 km: a prova fica, com aviso
  assert.ok(p.avisos.some((x) => x.tipo === 'warn' && /pouco para maratona/.test(x.texto)));
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
  assert.equal(i.perfil.passo, 0.07);
  assert.ok(i.semanas.every((s) => s.dias.filter((d) => d.intensidade === 'forte' && d.tipo !== 'prova').length <= 1));
  // lesão recente: progressão mais lenta, com fonte
  const l = gerarPlano({ ...base, lesao12m: 'sim' });
  assert.equal(l.perfil.passo, 0.07); assert.ok(l.avisos.some((x) => x.refs.includes('saragiotto2014')));
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
  assert.ok(m.ajustes.some((x) => /Dor muscular depois do treino/.test(x.texto) && x.refs.includes('cheung2003')));
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
  assert.deepEqual(limparRegistro({ id: 'a', data: '2026-11-01', tipo: 'longo', distKm: 12.345, durMin: 80.2501, pse: 5, dor: { onde: 'pe', nivel: 3 }, nota: 'ok', planejado: 'x' }), { id: 'a', data: '2026-11-01', tipo: 'longo', distKm: 12.35, durMin: 80.25, pse: 5, dor: { onde: 'pe', nivel: 3 }, nota: 'ok', planejado: 'x' });
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
  for (const k of Object.keys(REFS_CORRIDA)) assert.ok(/\d{4}/.test(REFS_CORRIDA[k]) || k === 'daniels' || k === 'nhs_c25k', 'referência sem ano: ' + k);
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
  assert.ok(avisosBloqueio(a).some((x) => x.tipo === 'danger' && /vigoroso/.test(x.texto) && x.refs.includes('riebe2015')));
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
  assert.ok(p.avisos.some((x) => /recomeço/.test(x.texto) && x.refs.includes('daniels')));
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

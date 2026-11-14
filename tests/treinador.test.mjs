// Testes do Treinador: gera planos para centenas de perfis e confere as regras de segurança e de dose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCICIOS, EX_POR_ID } from '../www/js/data/exercises.js';
import { EQUIPAMENTOS } from '../www/js/data/equipment.js';
import { MODELOS } from '../www/js/data/templates.js';
import { PERGUNTAS, respostasCompletas, gerarPlano, perfil, sugerirTrocas, alternativas, volumeSemanal, limiteFoco, outraVersao, alertaDoExercicio, ajustesPorDor, aplicarTrocasDor, voltasPorDor, aplicarVoltasDor, orientacaoDaDor } from '../www/js/logic/trainer.js';

const GYM_ALL = { all: true, has: {} };
const base = { objetivo: 'hipertrofia', idade: 30, peso: 75, altura: 175, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };
const OBJ = ['hipertrofia', 'emagrecimento', 'forca', 'saude', 'resistencia'];
const EXP = ['nunca', 'iniciante', 'intermediario', 'avancado'];
const DIAS = ['2', '3', '4', '5', '6'];
const TEMPO = ['30', '45', '60', '75'];

function confere(a, gym, rotulo) {
  const p = gerarPlano(a, gym, 0);
  assert.ok(p, 'plano não gerado: ' + rotulo);
  const pf = perfil(a);
  assert.equal(p.dias.length, pf.dias, 'número de treinos: ' + rotulo);
  const maxNivel = pf.conservador ? Math.min(pf.nivel, 2) : pf.nivel;
  for (const d of p.dias) {
    const vistos = new Set();
    for (const it of d.itens) {
      const ex = EX_POR_ID.get(it.ex);
      assert.ok(ex, 'exercício inexistente: ' + it.ex);
      assert.ok(!vistos.has(it.ex), `repetido no treino (${rotulo}): ${it.ex}`); vistos.add(it.ex);
      assert.ok(ex.nivel <= Math.max(1, maxNivel), `nível acima do permitido (${rotulo}): ${it.ex}`);
      for (const c of ex.cuidado) assert.ok(!pf.cuidados.includes(c), `exercício contraindicado para ${c} (${rotulo}): ${it.ex}`);
      assert.ok(it.series >= 1 && it.series <= 4, `séries fora da faixa (${rotulo}): ${it.ex} = ${it.series}`);
      assert.match(it.reps, /^\d{1,3}(-\d{1,3})?$/);
      assert.ok(it.descanso >= 0 && it.descanso <= 240);
      const lo = Number(it.reps.split('-')[0]);
      if (ex.registro === 'peso_reps' || ex.registro === 'reps') {
        if (pf.pressao || pf.gestante) assert.ok(lo >= 10, `repetições baixas com pressão alta/gestação (${rotulo}): ${it.ex} ${it.reps}`);
        if (pf.idoso) assert.ok(it.series <= 3 && lo >= 8, `dose inadequada para 60+ (${rotulo}): ${it.ex}`);
        if (pf.jovem) assert.ok(lo >= 10 && it.series <= 3, `dose inadequada para menor de 18 (${rotulo}): ${it.ex}`);
        if (pf.nunca) assert.ok(it.series <= 3, `séries demais para quem está começando (${rotulo}): ${it.ex}`);
      }
    }
    const limite = { 30: 4, 45: 6, 60: 7, 75: 9 }[pf.tempo];
    assert.ok(d.itens.length <= Math.max(limite, 4), `exercícios demais para o tempo (${rotulo}): ${d.nome} = ${d.itens.length}`);
  }
  return { p, pf };
}

test('perguntas da entrevista são consistentes', () => {
  const chaves = new Set();
  for (const q of PERGUNTAS) {
    assert.ok(!chaves.has(q.k)); chaves.add(q.k);
    assert.ok(q.titulo.endsWith('?'), 'pergunta sem interrogação: ' + q.titulo);
    if (q.tipo !== 'numero') { assert.ok(q.op.length >= 2); for (const o of q.op) assert.equal(o.length, 3); }
  }
  assert.ok(respostasCompletas(base));
  assert.ok(!respostasCompletas({ ...base, idade: undefined }));
  assert.ok(!respostasCompletas({ ...base, objetivo: 'voar' }));
});

test('academia completa: todas as combinações de objetivo × nível × dias × tempo geram treino completo e seguro', () => {
  let n = 0;
  for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) {
    const a = { ...base, objetivo, experiencia, dias, tempo };
    const { p } = confere(a, GYM_ALL, `${objetivo}/${experiencia}/${dias}d/${tempo}min`);
    for (const d of p.dias) assert.ok(d.itens.length >= 3, `treino com menos de 3 exercícios: ${objetivo}/${experiencia}/${dias}d/${tempo}min → ${d.nome}`);
    assert.equal(p.faltando.length, 0);
    assert.equal(Object.keys(p.agenda).length, Number(dias));
    n++;
  }
  assert.equal(n, 400);
});

test('limitações: nenhum exercício contraindicado entra no plano', () => {
  for (const lim of ['ombro', 'joelho', 'lombar', 'cervical', 'cotovelo', 'punho', 'quadril', 'tornozelo']) {
    for (const experiencia of EXP) for (const dias of ['3', '5']) {
      confere({ ...base, experiencia, dias, limitacoes: [lim] }, GYM_ALL, `limitação ${lim}/${experiencia}/${dias}`);
    }
  }
  confere({ ...base, limitacoes: ['ombro', 'joelho', 'lombar'] }, GYM_ALL, 'três limitações');
});

test('condições de saúde: modo conservador, avisos e liberação médica', () => {
  for (const cond of ['hipertensao', 'cardiaco', 'gestante', 'diabetes', 'cronica']) {
    for (const objetivo of OBJ) {
      const { p, pf } = confere({ ...base, objetivo, condicoes: [cond], experiencia: 'avancado' }, GYM_ALL, `condição ${cond}/${objetivo}`);
      if (['hipertensao', 'cardiaco', 'gestante'].includes(cond)) { assert.ok(pf.conservador); assert.ok(p.avisos.length >= 1, 'sem aviso: ' + cond); }
      if (['cardiaco', 'gestante'].includes(cond)) assert.ok(pf.liberacao, 'deveria pedir liberação médica: ' + cond);
    }
  }
  for (const sinal of ['dor_peito', 'tontura', 'falta_ar', 'osseo', 'medico']) {
    const { p, pf } = confere({ ...base, triagem: [sinal] }, GYM_ALL, 'triagem ' + sinal);
    assert.ok(pf.liberacao, 'triagem positiva deve pedir liberação: ' + sinal);
    assert.ok(p.avisos.some((x) => x.tipo === 'danger'));
  }
  assert.ok(!perfil(base).liberacao);
});

test('idades: menor de 14 é bloqueado; 14–17 e 60+ recebem dose conservadora', () => {
  assert.equal(gerarPlano({ ...base, idade: 12 }, GYM_ALL, 0), null);
  for (const idade of [14, 16, 17, 60, 72, 88]) for (const objetivo of OBJ) for (const experiencia of EXP) {
    const { p, pf } = confere({ ...base, idade, objetivo, experiencia }, GYM_ALL, `idade ${idade}/${objetivo}/${experiencia}`);
    assert.ok(pf.conservador);
    assert.ok(p.avisos.length >= 1);
  }
});

// Em casa a pessoa só tem o que a opção escolhida diz. O critério não repete a lista do aplicativo: o nome de cada
// aparelho usado tem de aparecer no texto da opção da entrevista ("halteres", "banco reto", "colchonete").
const textoDoLocal = (local) => { const o = PERGUNTAS.find((q) => q.k === 'local').op.find((x) => x[0] === local); return (o[1] + ' ' + o[2]).toLowerCase(); };
const ditoNaOpcao = (ex, local) => ex.equip.every((e) => textoDoLocal(local).includes(EQUIPAMENTOS[e].nome.toLowerCase().split(' / ')[0]));
test('locais de treino: em casa o plano só usa o que a opção escolhida diz; sem aparelho de cardio, o dia vira caminhada', () => {
  assert.match(textoDoLocal('halteres'), /halteres.*banco reto.*colchonete/);
  assert.doesNotMatch(textoDoLocal('halteres') + textoDoLocal('corporal'), /elástico|bola|caixa|step|regulável/);
  const usados = { halteres: new Set(), corporal: new Set() };
  for (const local of ['halteres', 'corporal']) for (const objetivo of OBJ) for (const experiencia of EXP) for (const dias of DIAS) for (const tempo of TEMPO) {
    const a = { ...base, objetivo, experiencia, dias, tempo, local };
    const p = gerarPlano(a, GYM_ALL, 0);
    const pf = perfil(a);
    assert.ok(p.dias.length >= 2 && p.dias.length <= pf.dias, `${local}/${objetivo}/${experiencia}/${dias}d/${tempo}`);
    for (const d of p.dias) {
      assert.ok(d.itens.length >= 3, `treino em casa curto (${local}/${experiencia}/${dias}d/${tempo}): ${d.nome}`);
      for (const it of d.itens) { const ex = EX_POR_ID.get(it.ex); for (const q of ex.equip) usados[local].add(q); assert.ok(ditoNaOpcao(ex, local), `aparelho que a opção não diz (${local}): ${it.ex} (${ex.equip})`); }
      // em casa não há aparelho de cardio: nenhum exercício de cardio no plano, e nada de "dia de cardio" de um minuto e meio
      for (const it of d.itens) assert.notEqual(EX_POR_ID.get(it.ex).padrao, 'cardio', `cardio sem aparelho no plano (${local}): ${it.ex}`);
    }
    assert.equal(p.minCardio, 0);
    const cardio = p.orientacoes.find((o) => o[0] === 'Cardio')[1];
    assert.doesNotMatch(cardio, /cardio do plano já conta|Além do cardio do plano/, 'promete cardio que o plano não tem');
    // os dias que seriam de cardio saem, e o plano manda caminhar
    if (p.dias.length < pf.dias) assert.ok(p.avisos.some((x) => /caminhada/.test(x.texto)), `dias a menos sem aviso (${local}/${experiencia}/${dias}d)`);
  }
  assert.deepEqual([...usados.halteres].sort(), ['banco_reto', 'colchonete', 'halteres']);
  assert.deepEqual([...usados.corporal].sort(), ['colchonete']);
});

test('minha academia: respeita os aparelhos marcados e avisa quando falta', () => {
  const poucos = { all: false, has: { halteres: true, banco_reto: true, puxador: true, leg_press_45: true, colchonete: true } };
  const { p } = confere({ ...base, local: 'minha' }, poucos, 'academia pequena');
  for (const d of p.dias) for (const it of d.itens) for (const q of EX_POR_ID.get(it.ex).equip) assert.ok(poucos.has[q], `usou aparelho não marcado: ${it.ex} (${q})`);
  const nada = { all: false, has: {} };
  const p2 = gerarPlano({ ...base, local: 'minha' }, nada, 0);
  assert.ok(p2);
  for (const d of p2.dias) for (const it of d.itens) assert.equal(EX_POR_ID.get(it.ex).equip.length, 0);
  const tudo = { all: false, has: Object.fromEntries(Object.keys(EQUIPAMENTOS).map((k) => [k, true])) };
  assert.equal(gerarPlano({ ...base, local: 'minha' }, tudo, 0).faltando.length, 0);
});

test('volume semanal: grupos principais recebem pelo menos o mínimo eficaz', () => {
  for (const experiencia of EXP) for (const dias of ['3', '4', '5', '6']) {
    const p = gerarPlano({ ...base, experiencia, dias, tempo: '60' }, GYM_ALL, 0);
    for (const g of ['peito', 'costas', 'quadriceps', 'posteriores', 'ombros']) assert.ok(p.volume[g] >= 4, `volume baixo em ${g}: ${experiencia}/${dias}d = ${p.volume[g]}`);
    for (const g of Object.keys(p.volume)) assert.ok(p.volume[g] <= 30, `volume exagerado em ${g}: ${p.volume[g]}`);
    assert.deepEqual(volumeSemanal(p.dias), p.volume);
  }
});

test('prioridade de músculo: cada músculo da lista ganha de 2 a 6 séries por semana e a proposta diz o que mudou', () => {
  const q = PERGUNTAS.find((x) => x.k === 'foco');
  assert.equal(q.max, 2);
  const sem = gerarPlano({ ...base, foco: ['equilibrado'] }, GYM_ALL, 0);
  assert.deepEqual(sem.foco, []);
  for (const m of ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'peito', 'costas', 'ombros', 'biceps', 'triceps', 'abdomen']) {
    assert.ok(q.op.some((o) => o[0] === m), 'músculo fora da pergunta: ' + m);
    const p = gerarPlano({ ...base, foco: [m] }, GYM_ALL, 0);
    assert.equal(p.foco.length, 1);
    const x = p.foco[0];
    assert.equal(x.id, m);
    assert.equal(x.de, sem.volume[m]);
    assert.equal(x.para, p.volume[m]);
    assert.ok(x.para >= x.de + 2 && x.para <= x.de + 6.5, `${m}: ${x.de} → ${x.para}`);
    assert.match(x.texto, /^[A-ZÀ-Ú].*: [\d,]+ → [\d,]+ séries por semana$/);
    // os outros grandes grupos continuam com pelo menos 4 séries por semana
    for (const g of ['peito', 'costas', 'quadriceps', 'posteriores', 'gluteos', 'ombros']) assert.ok(p.volume[g] >= 4, `${m} tirou ${g} da dose mínima: ${p.volume[g]}`);
  }
  // respostas antigas: "pernas" e "braços" continuam válidas e valem pelos dois músculos
  assert.ok(respostasCompletas({ ...base, foco: ['pernas'] }) && respostasCompletas({ ...base, foco: ['bracos', 'gluteos'] }));
  assert.deepEqual(gerarPlano({ ...base, foco: ['pernas'] }, GYM_ALL, 0).foco.map((x) => x.id), ['quadriceps', 'posteriores']);
  // limite: até 2 músculos por vez; com 30 minutos entra só o primeiro; a proposta diz quem ficou de fora
  const tres = gerarPlano({ ...base, foco: ['triceps', 'quadriceps', 'gluteos'] }, GYM_ALL, 0);
  assert.deepEqual(tres.foco.map((x) => x.id), ['triceps', 'quadriceps']);
  assert.deepEqual(tres.focoFora, ['Glúteos']);
  const curto = gerarPlano({ ...base, tempo: '30', foco: ['triceps', 'quadriceps', 'gluteos'] }, GYM_ALL, 0);
  assert.deepEqual(curto.foco.map((x) => x.id), ['triceps']);
  assert.deepEqual(curto.focoFora, ['Quadríceps', 'Glúteos']);
  assert.equal(limiteFoco(perfil({ ...base, tempo: '30' })), 1);
  // quando não há como aumentar, o texto diz por quê (sem seta)
  for (const local of ['corporal', 'halteres']) for (const m of ['biceps', 'triceps', 'panturrilhas', 'posteriores']) {
    const x = gerarPlano({ ...base, local, experiencia: 'nunca', dias: '2', tempo: '45', foco: [m] }, GYM_ALL, 0).foco[0];
    assert.ok(x.para >= x.de);
    assert.equal(/→/.test(x.texto), x.para > x.de);
    if (x.para === x.de) assert.match(x.texto, /não há exercício direto|já está no máximo|sem vaga|máximo de|ficaram de fora|desequilibrariam/);
    assert.ok(['aumentou', 'sem-direto', 'limitacao', 'teto', 'teto-outro', 'max-series', 'equilibrio', 'tempo'].includes(x.motivo));
  }
});

test('rotação: novas versões mantêm os principais e trocam auxiliares; sugestões são equivalentes', () => {
  const v0 = gerarPlano(base, GYM_ALL, 0);
  const v1 = gerarPlano(base, GYM_ALL, 1);
  const ids = (p) => p.dias.map((d) => d.itens.map((i) => i.ex));
  assert.deepEqual(ids(v0).map((d) => d[0]), ids(v1).map((d) => d[0]), 'o exercício principal de cada treino deveria ser mantido');
  assert.notDeepEqual(ids(v0), ids(v1), 'a nova versão deveria trocar algum exercício auxiliar');
  const plan = { dias: v0.dias };
  const trocas = sugerirTrocas(plan, base, GYM_ALL);
  assert.ok(trocas.length >= 2, 'deveria sugerir trocas');
  const noPlano = new Set(v0.dias.flatMap((d) => d.itens.map((i) => i.ex)));
  const porDia = {};
  for (const t of trocas) {
    const de = EX_POR_ID.get(t.de), para = EX_POR_ID.get(t.para);
    assert.equal(de.padrao, para.padrao, 'troca por movimento diferente');
    assert.ok(!noPlano.has(t.para), 'sugeriu exercício que já está no plano');
    assert.equal(v0.dias.find((d) => d.id === t.diaId).itens[t.idx].ex, t.de);
    porDia[t.diaId] = (porDia[t.diaId] || 0) + 1;
    assert.ok(porDia[t.diaId] <= 2, 'mais de 2 trocas no mesmo treino');
  }
  // com limitação, as alternativas também respeitam a restrição
  const pf = perfil({ ...base, limitacoes: ['ombro'] });
  for (const ex of [EX_POR_ID.get('supino-maquina'), EX_POR_ID.get('puxada-frente-aberta')]) {
    for (const alt of alternativas(ex, pf, GYM_ALL)) assert.ok(!alt.cuidado.includes('ombro'), 'alternativa contraindicada: ' + alt.id);
  }
});

test('outra versão: o toque muda de fato os exercícios, mantém os principais e a dose, e diz quantos entraram', () => {
  const ids = (p) => p.dias.map((d) => d.itens.map((i) => i.ex));
  for (const local of ['completa', 'halteres', 'corporal']) {
    const a = { ...base, local };
    const v0 = gerarPlano(a, GYM_ALL, 0);
    const o = outraVersao(a, GYM_ALL, 0);
    assert.ok(o, 'sem outra versão: ' + local);
    assert.ok(o.versao >= 1 && o.trocados >= 1);
    assert.notDeepEqual(ids(o.plano).map((d) => d.slice().sort()), ids(v0).map((d) => d.slice().sort()), 'outra versão igual: ' + local);
    assert.deepEqual(o.plano.dias.map((d) => d.nome), v0.dias.map((d) => d.nome));
    assert.deepEqual(ids(o.plano).map((d) => d[0]), ids(v0).map((d) => d[0]), 'o exercício principal de cada treino deveria ser mantido: ' + local);
    const series = (p) => p.dias.reduce((t, d) => t + d.itens.reduce((x, i) => x + i.series, 0), 0);
    assert.ok(Math.abs(series(o.plano) - series(v0)) <= series(v0) * 0.15, 'a dose mudou: ' + local);
    // comparar com um plano dado (o plano ativo, no painel): a versão devolvida é diferente dele
    const o2 = outraVersao(a, GYM_ALL, 0, { plano: { dias: o.plano.dias } });
    assert.ok(o2 && JSON.stringify(ids(o2.plano)) !== JSON.stringify(ids(o.plano)));
  }
  assert.equal(outraVersao({ ...base, idade: 12 }, GYM_ALL, 0), null);
});

test('treino em casa: treinos diferentes entre si, progressão por nível, e os exercícios novos do catálogo entram sozinhos', async () => {
  const CORE = new Set(['anti_extensao', 'flexao_tronco', 'flexao_quadril', 'rotacao']);
  const forca = (p) => p.dias.map((d) => d.itens.map((i) => EX_POR_ID.get(i.ex)).filter((e) => e.padrao !== 'cardio')).filter((l) => l.length >= 3);
  const nivelMedio = (p) => { const l = forca(p).flat().filter((e) => !CORE.has(e.padrao)); return l.reduce((t, e) => t + e.nivel, 0) / l.length; };
  const confere = (T, rot) => {
    for (const local of ['corporal', 'halteres']) for (const experiencia of EXP) for (const dias of ['2', '3', '4', '5', '6']) {
      const a = { ...base, local, experiencia, dias, tempo: '45' };
      const p = T.gerarPlano(a, GYM_ALL, 0);
      const pode = { has: (x) => textoDoLocal(local).includes(EQUIPAMENTOS[x].nome.toLowerCase().split(' / ')[0]) };
      const treinos = forca(p);
      // nenhum treino de força da semana repete a lista de exercícios de outro
      const listas = treinos.map((l) => l.map((e) => e.id).sort().join(','));
      assert.equal(new Set(listas).size, listas.length, `${rot}: dois treinos iguais na semana (${local}/${experiencia}/${dias}d)`);
      for (const e of treinos.flat()) {
        assert.ok(e.equip.every((x) => pode.has(x)), `${rot}: aparelho que a pessoa não tem: ${e.id}`);
        // avançado: variação simples e sem peso (nível 1) só entra quando o catálogo não tem outra do mesmo movimento, ou
        // quando as outras já estão todas na semana (aí ela entra para os treinos não se repetirem)
        if (experiencia === 'avancado' && e.registro === 'reps' && e.nivel === 1 && !CORE.has(e.padrao)) {
          const naSemana = new Set(p.dias.flatMap((d) => d.itens.map((i) => i.ex)));
          const sobrou = EXERCICIOS.find((c) => c.padrao === e.padrao && c.grupo !== 'cardio' && c.grupo !== 'funcional' && (c.registro === 'peso_reps' || (c.registro === 'reps' && c.nivel >= 2)) && c.equip.every((x) => pode.has(x)) && !naSemana.has(c.id) && !T.soManual(c.id));
          assert.equal(sobrou, undefined, `${rot}: avançado recebeu ${e.id} havendo ${sobrou && sobrou.id} sem usar (${local}/${dias}d)`);
        }
      }
    }
    // progressão por nível, sem aparelhos: quem já treina recebe variações mais difíceis do que quem está começando
    for (const dias of ['3', '4', '5']) {
      const ini = T.gerarPlano({ ...base, local: 'corporal', experiencia: 'iniciante', dias }, GYM_ALL, 0);
      const ava = T.gerarPlano({ ...base, local: 'corporal', experiencia: 'avancado', dias }, GYM_ALL, 0);
      assert.ok(forca(ini).flat().every((e) => e.nivel === 1), rot + ': iniciante com variação difícil');
      assert.ok(nivelMedio(ava) > nivelMedio(ini) + 0.3, `${rot}: avançado sem progressão (${nivelMedio(ini).toFixed(2)} → ${nivelMedio(ava).toFixed(2)})`);
    }
  };
  const T0 = await import('../www/js/logic/trainer.js');
  confere(T0, 'catálogo atual');
  const medidas = (T, a) => {
    const usados = new Set(), versoes = new Set();
    for (let v = 0; v < 12; v++) { const p = T.gerarPlano(a, GYM_ALL, v); versoes.add(p.dias.map((d) => d.itens.map((i) => i.ex).sort().join(',')).join('|')); for (const d of p.dias) for (const it of d.itens) usados.add(it.ex); }
    return { usados, versoes: versoes.size, semana: new Set(T.gerarPlano(a, GYM_ALL, 0).dias.flatMap((d) => d.itens.map((i) => i.ex))).size };
  };
  const perfis = [];
  for (const experiencia of EXP) for (const dias of ['3', '5']) for (const objetivo of ['hipertrofia', 'saude']) perfis.push({ ...base, local: 'corporal', experiencia, dias, objetivo, tempo: '60' });
  const antes = perfis.map((a) => medidas(T0, a));

  // Exercícios fictícios de peso corporal, com nomes que o gerador não conhece: têm de ser aproveitados só pelo que
  // dizem de si (movimento, músculos, nível, aparelhos), sem nenhuma lista de ids no gerador.
  const fx = (id, grupo, primarios, secundarios, padrao, nivel, tipo, cuidado) => ({ id, nome: id, grupo, primarios, secundarios, modalidade: 'peso_corporal', equip: [], tipo, padrao, nivel, registro: 'reps', unilateral: false, cuidado, posicao: '', execucao: [], respiracao: '', dicas: [], erros: [], aliases: [], fontes: [] });
  const FICTICIOS = [
    fx('fx-flexao-arqueiro', 'peito', ['peito'], ['triceps', 'deltoide_ant'], 'empurrar_horizontal', 3, 'composto', ['ombro', 'punho']),
    fx('fx-flexao-pes-elevados', 'peito', ['peito'], ['triceps'], 'empurrar_horizontal', 2, 'composto', ['ombro', 'punho']),
    fx('fx-remada-toalha', 'costas', ['dorsais', 'costas_superior'], ['biceps'], 'puxar_horizontal', 1, 'composto', []),
    fx('fx-remada-toalha-um-braco', 'costas', ['dorsais'], ['biceps'], 'puxar_horizontal', 3, 'composto', []),
    fx('fx-agachamento-pistola', 'quadriceps', ['quadriceps', 'gluteos'], ['posteriores'], 'agachar', 3, 'composto', ['joelho']),
    fx('fx-agachamento-pausado', 'quadriceps', ['quadriceps', 'gluteos'], [], 'agachar', 2, 'composto', ['joelho']),
    fx('fx-afundo-bulgaro-cadeira', 'quadriceps', ['quadriceps', 'gluteos'], [], 'afundo', 2, 'composto', ['joelho']),
    fx('fx-rosca-toalha', 'biceps', ['biceps'], ['antebraco'], 'flexao_cotovelo', 1, 'isolado', ['cotovelo']),
    fx('fx-rosca-toalha-um-braco', 'biceps', ['biceps'], [], 'flexao_cotovelo', 2, 'isolado', ['cotovelo']),
    fx('fx-triceps-no-chao', 'triceps', ['triceps'], [], 'extensao_cotovelo', 1, 'isolado', ['cotovelo']),
    fx('fx-triceps-pes-elevados', 'triceps', ['triceps'], [], 'extensao_cotovelo', 2, 'isolado', ['cotovelo']),
    fx('fx-elevacao-lateral-parede', 'ombros', ['deltoide_lat'], [], 'elevacao_lateral', 1, 'isolado', ['ombro']),
    fx('fx-flexora-deslizante', 'posteriores', ['posteriores'], ['gluteos'], 'flexao_joelho', 2, 'isolado', []),
    fx('fx-flexora-toalha', 'posteriores', ['posteriores'], [], 'flexao_joelho', 1, 'isolado', []),
  ];
  for (const e of FICTICIOS) { assert.ok(!EX_POR_ID.has(e.id)); EXERCICIOS.push(e); EX_POR_ID.set(e.id, e); }
  try {
    // uma cópia nova do gerador, carregada depois de o catálogo crescer
    const T1 = await import('../www/js/logic/trainer.js?catalogo-maior');
    confere(T1, 'catálogo com exercícios novos');
    const depois = perfis.map((a) => medidas(T1, a));
    const novosUsados = new Set();
    perfis.forEach((a, i) => {
      const fxUsados = [...depois[i].usados].filter((id) => id.startsWith('fx-'));
      for (const id of fxUsados) novosUsados.add(id);
      const max = a.experiencia === 'avancado' ? 3 : a.experiencia === 'intermediario' ? 2 : 1;
      for (const id of fxUsados) assert.ok(EX_POR_ID.get(id).nivel <= max, `exercício novo acima do nível (${a.experiencia}): ${id}`);
      assert.ok(fxUsados.length >= 3, `poucos exercícios novos aproveitados (${a.experiencia}/${a.dias}d/${a.objetivo}): ${fxUsados}`);
      // mais exercícios no catálogo → pelo menos a mesma variedade na semana e entre as versões
      assert.ok(depois[i].semana >= antes[i].semana, `menos variedade na semana com mais exercícios (${a.experiencia}/${a.dias}d): ${antes[i].semana} → ${depois[i].semana}`);
      assert.ok(depois[i].versoes >= 3, `poucas versões diferentes em casa: ${depois[i].versoes}`);
    });
    assert.ok(novosUsados.size >= 12, 'exercícios novos nunca usados: ' + FICTICIOS.map((e) => e.id).filter((id) => !novosUsados.has(id)));
    // e a prioridade passa a funcionar para um músculo que antes não tinha exercício direto em casa
    const x = T1.gerarPlano({ ...base, local: 'corporal', foco: ['biceps'] }, GYM_ALL, 0).foco[0];
    assert.ok(x.para > x.de, x.texto);
    assert.ok(T1.outraVersao({ ...base, local: 'corporal' }, GYM_ALL, 0));
  } finally {
    for (const e of FICTICIOS) { EX_POR_ID.delete(e.id); const i = EXERCICIOS.indexOf(e); if (i >= 0) EXERCICIOS.splice(i, 1); }
  }
  assert.ok(!EXERCICIOS.some((e) => e.id.startsWith('fx-')));
});

test('dores: exemplos — muscular não muda o plano; articular moderada troca o que dá e alivia o resto; forte tira; alerta não treina a região', () => {
  const dor = (onde, tipo, nivel, quando = 'durante', dias = 1) => ({ id: 'x', data: '2026-11-12', onde, lado: '', tipo, quando, nivel, nota: '', fim: '', dias });
  const ids = (p) => p.dias.map((d) => d.itens.map((i) => i.ex));
  const normal = gerarPlano(base, GYM_ALL, 0);
  assert.deepEqual(ids(gerarPlano(base, GYM_ALL, 0, [])), ids(normal));
  assert.deepEqual(ids(gerarPlano(base, GYM_ALL, 0, null)), ids(normal));

  // dor muscular comum (5 em 10): mesmo plano; o aviso no exercício pede para ir mais leve; nada a trocar
  const muscular = [dor('peito', 'muscular', 5, 'depois')];
  assert.deepEqual(ids(gerarPlano(base, GYM_ALL, 0, muscular)), ids(normal));
  assert.equal(alertaDoExercicio('supino-reto-barra', muscular, base).nivel, 'leve');
  assert.match(alertaDoExercicio('supino-reto-barra', muscular, base).texto, /mais leve/);
  assert.ok(ajustesPorDor(normal, base, GYM_ALL, muscular).every((x) => x.tipo === 'aliviar'));
  assert.match(orientacaoDaDor(muscular[0], base).texto, /some em até 7/);
  assert.match(orientacaoDaDor(dor('peito', 'muscular', 5, 'depois', 9), base).texto, /procure avaliação/);
  assert.match(orientacaoDaDor(muscular[0], { ...base, experiencia: 'nunca' }).texto, /primeiras semanas/);

  // dor moderada na lombar (3 em 10, o teto dessa região): o plano novo prefere exercícios que poupam a região; no plano ativo, há trocas
  const lombar4 = [dor('lombar', 'articular', 3)];
  const conta = (p, c) => p.dias.flatMap((d) => d.itens).filter((it) => EX_POR_ID.get(it.ex).cuidado.includes(c)).length;
  const adaptado = gerarPlano(base, GYM_ALL, 0, lombar4);
  assert.equal(adaptado.dias.length, normal.dias.length);
  assert.ok(conta(adaptado, 'lombar') < conta(normal, 'lombar'), `${conta(normal, 'lombar')} → ${conta(adaptado, 'lombar')}`);
  assert.ok(adaptado.avisos.some((x) => x.dor === 'lombar' && /menos carga/.test(x.texto)));
  const aj = ajustesPorDor(normal, base, GYM_ALL, lombar4);
  const trocas = aj.filter((x) => x.tipo === 'trocar');
  assert.ok(trocas.length >= 1 && aj.some((x) => x.tipo === 'aliviar') && !aj.some((x) => x.tipo === 'pular'), JSON.stringify(aj.map((x) => x.tipo)));
  for (const t of trocas) { assert.equal(alertaDoExercicio(t.para, lombar4, base), null, 'a troca tem de poupar a lombar: ' + t.para); assert.ok(alertaDoExercicio(t.de, lombar4, base), 'só se troca o que carrega a lombar: ' + t.de); }
  // aplicar e, quando melhora, desfazer
  const dias = normal.dias.map((d) => ({ ...d, itens: d.itens.map((it) => ({ ...it })) }));
  assert.equal(aplicarTrocasDor(dias, aj), trocas.length);
  assert.notDeepEqual(ids({ dias }), ids(normal));
  assert.deepEqual(voltasPorDor({ dias }, base, lombar4), []);
  const voltas = voltasPorDor({ dias }, base, []);
  assert.equal(aplicarVoltasDor(dias, voltas), trocas.length);
  assert.deepEqual(dias.map((d) => d.itens), normal.dias.map((d) => d.itens));

  // dor acima do teto no joelho (4 em 10; o teto ali é 3): saem os exercícios que sobrecarregam o joelho; os treinos continuam
  const joelho6 = [dor('joelho', 'articular', 4)];
  const semJoelho = gerarPlano(base, GYM_ALL, 0, joelho6);
  assert.equal(conta(semJoelho, 'joelho'), 0);
  // o cardio de pernas também sai (o dia de cardio, se houver, vira descanso com aviso); a musculação do resto do corpo continua
  assert.ok(semJoelho.dias.length >= 3);
  for (const d of semJoelho.dias) assert.ok(d.itens.length >= 3, 'treino curto com dor no joelho: ' + d.nome);
  for (const d of semJoelho.dias) for (const it of d.itens) assert.ok(!['agachar', 'afundo', 'extensao_joelho', 'flexao_joelho', 'cardio'].includes(EX_POR_ID.get(it.ex).padrao), 'movimento que carrega o joelho: ' + it.ex);
  assert.equal(alertaDoExercicio('agachamento-livre-barra', joelho6, base).nivel, 'evitar');

  // dor de alerta (fisgada atrás da coxa): nenhum exercício que use os posteriores, nem como auxiliar; aviso de avaliação; sem troca
  const fisgada = [dor('coxa-tras', 'aguda', 6)];
  const p = gerarPlano(base, GYM_ALL, 0, fisgada);
  for (const d of p.dias) for (const it of d.itens) { const e = EX_POR_ID.get(it.ex); assert.ok(!e.primarios.includes('posteriores') && !e.secundarios.includes('posteriores'), 'treinou a região em alerta: ' + e.id); }
  assert.ok(p.avisos.some((x) => x.tipo === 'warn' && /médico ou fisioterapeuta/.test(x.texto)));
  assert.ok(p.dias.length >= 3, 'o resto do corpo continua sendo treinado');
  const ajAlerta = ajustesPorDor(normal, base, GYM_ALL, fisgada);
  assert.ok(ajAlerta.length > 0 && ajAlerta.every((x) => x.tipo === 'pular'));
  assert.ok(orientacaoDaDor(fisgada[0], base).alerta);
  // dor em repouso e dor de 7 ou mais também são de alerta, qualquer que seja o tipo
  assert.ok(orientacaoDaDor(dor('ombro', 'articular', 2, 'repouso'), base).alerta);
  assert.ok(orientacaoDaDor(dor('ombro', 'muscular', 7), base).alerta);
  assert.ok(!orientacaoDaDor(dor('ombro', 'muscular', 6), base).alerta);
});

test('itens extras em casa: a pergunta passa na validação do estado, some para quem treina fora de casa e aparece no plano', async () => {
  const { sanitize } = await import('../www/js/store.js');
  const casa = { ...base, local: 'corporal', extras: ['elastico', 'caixa', 'xyz', 'leg_press_45', 7] };
  const limpo = sanitize({ trainer: { answers: casa } }).trainer.answers;
  assert.deepEqual(limpo.extras, ['elastico', 'caixa'], 'a validação do estado deixa só os itens da pergunta');
  assert.ok(respostasCompletas(limpo));
  // respostas antigas, sem a pergunta, continuam completas (e valem como "nenhum")
  const antiga = sanitize({ trainer: { answers: { ...base, local: 'halteres' } } }).trainer.answers;
  assert.equal(antiga.extras, undefined);
  assert.ok(respostasCompletas(antiga));
  assert.deepEqual(perfil(antiga).extras, []);
  // com elástico e degrau marcados, entram exercícios deles; sem marcar, nenhum
  const usa = (p, e) => p.dias.some((d) => d.itens.some((it) => EX_POR_ID.get(it.ex).equip.includes(e)));
  let comElastico = false, comDegrau = false;
  for (let v = 0; v < 12; v++) {
    const p = gerarPlano(limpo, GYM_ALL, v);
    comElastico = comElastico || usa(p, 'elastico'); comDegrau = comDegrau || usa(p, 'caixa');
    const semNada = gerarPlano({ ...base, local: 'corporal' }, GYM_ALL, v);
    assert.ok(!usa(semNada, 'elastico') && !usa(semNada, 'caixa'));
    for (const d of p.dias) for (const it of d.itens) for (const e of EX_POR_ID.get(it.ex).equip) assert.ok(['colchonete', 'elastico', 'caixa'].includes(e), 'aparelho não marcado: ' + it.ex);
  }
  assert.ok(comElastico && comDegrau, 'os itens marcados não foram aproveitados');
  // cada opção tem rótulo para o resumo do perfil
  const { ROTULO } = await import('../www/js/logic/trainer.js');
  for (const o of PERGUNTAS.find((x) => x.k === 'extras').op) if (o[0] !== 'nenhum') assert.ok(ROTULO.extras[o[0]], 'sem rótulo: ' + o[0]);
});

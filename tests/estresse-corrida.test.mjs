// Teste de estresse do Treinador de corrida: milhares de perfis (grade + amostragem com semente fixa).
// Cada plano é conferido contra as regras de segurança, de progressão e de estrutura, de forma independente da lógica.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERGUNTAS, respostasCompletas, perfil, gerarPlano, avisosBloqueio, limparRegistro, limparRegistros, limparCorrida, planoDaSemana, resumoParaNutricao, treinoDoDia, expandirBlocos, evolucao, alertas, dicas, efeitoDaDor, somaDias, segundaDe, diaDaSemana, ritmosDe, inicioPara, recordeSeg, diasEntre, planejadoDe, analiseDoRegistro, analiseRecente, planoDaSemanaEm, efeitoDoFoco, guardarDoDia, planoAtual } from '../www/js/logic/corrida.js';
import { TIPOS_TREINO, REFS_CORRIDA, FAQ_CORRIDA, DOR_CORRIDA, FONTES_TELA } from '../www/js/data/corrida.js';
import { LOCAIS_DOR, TIPOS_DOR } from '../www/js/logic/dor.js';

// ---------- gerador pseudoaleatório com semente fixa (mulberry32) ----------
function semente(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const um = (r, l) => l[Math.floor(r() * l.length)];
const inteiro = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const op = (k) => PERGUNTAS.find((q) => q.k === k).op.map((o) => o[0]);
const EXP = op('experiencia'), OBJ = op('objetivo'), DISTS = op('distancia'), TEMPO = op('tempo'), TLONGO = op('tempoLongo'), APAR = op('aparelho'), LOCAL = op('local');
const COND = op('condicoes').filter((x) => x !== 'nenhuma'), TRI = op('triagem').filter((x) => x !== 'nenhum'), LIM = op('limitacoes').filter((x) => x !== 'nenhuma');
const PAUSA = op('pausa'), RES = op('resultado');
const DIAS_CONJ = [['3'], ['2', '4'], ['6', '0'], ['1', '3', '5'], ['5', '6', '0'], ['2', '4', '6', '0'], ['1', '2', '3', '4', '5'], ['1', '2', '4', '5', '6', '0'], ['1', '2', '3', '4', '5', '6', '0']];
const IDADES = [12, 13, 15, 17, 24, 38, 47, 63, 78];
const KM = { 5: 5, 10: 10, 21: 21.0975, 42: 42.195 };

const base = { experiencia: 'regular', kmSemana: 25, longoAtual: 10, provas: '5a10', pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 12, temAlvo: 'nao', resultado: '5', resultadoMin: 27.5, dias: ['2', '4', '6', '0'], diaLongo: 'auto', tempo: '60', tempoLongo: '120', aparelho: 'gps', local: 'rua', idade: 35, peso: 72, altura: 175, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };

// respostas coerentes com a entrevista (perguntas condicionais só quando valem)
function respostas(r, fixo = {}) {
  const a = {};
  a.experiencia = fixo.experiencia || um(r, EXP);
  const corre = ['iniciante', 'regular', 'avancado'].includes(a.experiencia);
  // quem corre de vez em quando, sem regularidade, só informa a corrida mais longa
  if (a.experiencia === 'irregular') a.longoAtual = inteiro(r, 1, 8);
  if (corre) {
    a.kmSemana = a.experiencia === 'iniciante' ? inteiro(r, 0, 15) : a.experiencia === 'regular' ? inteiro(r, 5, 45) : inteiro(r, 15, 110);
    a.longoAtual = Math.max(1, Math.min(40, Math.round(a.kmSemana * (0.25 + r() * 0.3))));
    // (a pergunta das provas só aparece para a maratona: ver abaixo; às vezes fica a resposta antiga, de antes dessa regra)
    if (a.experiencia !== 'iniciante' && r() < 0.3) a.provas = um(r, op('provas'));
    if (r() < 0.75) a.pausa = r() < 0.6 ? 'treinando' : um(r, PAUSA);
    a.resultado = r() < 0.4 ? 'nao' : um(r, RES);
    if (a.resultado !== 'nao') { const d = a.resultado === '3' ? 3 : KM[a.resultado]; a.resultadoMin = Math.max(8, Math.min(420, Math.round(d * (3.2 + r() * 6.5) * 2) / 2)); }
  }
  a.objetivo = fixo.objetivo || um(r, OBJ);
  if (['distancia', 'ritmo', 'prova'].includes(a.objetivo)) {
    a.distancia = fixo.distancia || um(r, DISTS);
    a.tempoLongo = um(r, TLONGO);
    if (corre && a.distancia === '42') a.provas = um(r, op('provas'));
  }
  if (a.objetivo === 'prova') a.semanasProva = um(r, [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 30, 40, 52]);
  if (a.objetivo === 'prova' || a.objetivo === 'ritmo') { a.temAlvo = r() < 0.5 ? 'sim' : 'nao'; if (a.temAlvo === 'sim') a.alvoMin = Math.max(12, Math.min(420, Math.round(KM[a.distancia] * (3 + r() * 5)))); }
  a.dias = fixo.dias || um(r, DIAS_CONJ);
  if (a.dias.length >= 2) a.diaLongo = r() < 0.5 ? 'auto' : um(r, ['0', '1', '2', '3', '4', '5', '6']);
  a.tempo = um(r, TEMPO);
  a.aparelho = um(r, APAR); a.local = um(r, LOCAL);
  a.idade = fixo.idade || um(r, IDADES);
  a.peso = um(r, [48, 60, 72, 85, 98, 120]); a.altura = um(r, [150, 162, 170, 178, 190]);
  a.lesao12m = r() < 0.25 ? 'sim' : 'nao';
  a.limitacoes = r() < 0.75 ? ['nenhuma'] : [um(r, LIM)];
  a.condicoes = fixo.condicoes || (r() < 0.7 ? ['nenhuma'] : [um(r, COND)]);
  a.triagem = fixo.triagem || (r() < 0.9 ? ['nenhum'] : [um(r, TRI)]);
  // remédios (pergunta opcional): às vezes sem resposta, como nas entrevistas antigas
  // (quem fixa as condições quer um perfil sem doença: aí não sorteia remédio)
  if (fixo.remedios || (!fixo.condicoes && r() < 0.2)) a.remedios = fixo.remedios || [um(r, op('remedios'))];
  if (a.condicoes[0] !== 'nenhuma' || a.triagem[0] !== 'nenhum' || (a.remedios || []).some((x) => x === 'glicose' || x === 'outro')) a.liberado = fixo.liberado || (r() < 0.7 ? 'sim' : 'nao');
  return a;
}

// ---------- coletor de falhas ----------
function coletor() {
  const m = new Map();
  return { add: (regra, caso) => { const x = m.get(regra) || { n: 0, ex: [] }; x.n++; if (x.ex.length < 3) x.ex.push(caso); m.set(regra, x); }, m };
}
const relatorio = (F) => [...F.m].map(([k, v]) => `${k} — ${v.n} caso(s). Ex.: ${v.ex.join(' || ')}`).join('\n');

const pos = (wd) => (wd + 6) % 7;
const viz = (a, b) => { const d = Math.abs(pos(a) - pos(b)); return d === 1 || d === 6; };
const TIPOS_BLOCO = new Set(['aquecer', 'correr', 'caminhar', 'trote', 'forte', 'desaquecer']);
const numOk = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ritmoOk = (f) => f && numOk(f.de) && numOk(f.ate) && f.de >= 137 && f.ate <= 600 && f.de <= f.ate;

// Confere um plano contra todas as regras. `adaptado` = plano recalculado com registros (algumas regras da curva original não valem).
function conferir(p, a, rot, F, adaptado = false) {
  const pf = p.perfil; // o perfil efetivo: a meta pode ter sido trocada quando não cabe no prazo
  const ehCorr = (d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso';
  const ehEv = (d) => d.tipo === 'prova' || d.tipo === 'teste';
  const longosMin = [];
  if (!Array.isArray(p.semanas) || p.semanas.length !== p.totalSemanas || p.totalSemanas < 1 || p.totalSemanas > 70) { F.add('número de semanas inválido', rot + ' ' + p.totalSemanas); return; }
  const nDias = pf.foco ? pf.dias.length : Math.min(new Set(a.dias).size, 6); // com prioridade para a musculação ou para os dois, sobram menos dias de corrida
  let picoKm = 0;
  const longos = [];
  p.semanas.forEach((s, i) => {
    const w = i + 1;
    if (s.n !== w) F.add('semana fora de ordem', rot);
    for (const k of ['volumeKm', 'volumeMin', 'corridaMin']) if (!numOk(s[k])) F.add('total da semana inválido (' + k + ')', rot + ' sem ' + w + ': ' + s[k]);
    if (typeof s.fase !== 'string' || typeof s.foco !== 'string' || !s.foco || typeof s.descarga !== 'boolean') F.add('semana sem fase, foco ou descarga', rot);
    if (s.dias.length !== nDias) F.add('total de dias diferente dos dias disponíveis', `${rot} sem ${w}: ${s.dias.length} de ${nDias}`);
    if (new Set(s.dias.map((d) => d.wd)).size !== s.dias.length) F.add('dia repetido na semana', rot);
    for (const d of s.dias) {
      const onde = `${rot} sem ${w} ${d.tipo}`;
      if (!pf.dias.includes(d.wd)) F.add('treino em dia não disponível', onde + ' wd ' + d.wd);
      if (!TIPOS_TREINO[d.tipo]) F.add('tipo de treino desconhecido', onde);
      if (!numOk(d.distKm) || !numOk(d.durMin)) F.add('distância ou duração inválida', `${onde}: ${d.distKm} km, ${d.durMin} min`);
      if (d.tipo !== 'descanso' && !(d.durMin > 0)) F.add('treino sem duração', onde);
      if (!d.nome || typeof d.resumo !== 'string' || !d.resumo || typeof d.detalhe !== 'string' || !d.detalhe) F.add('treino sem nome, resumo ou detalhe', onde);
      if (!['leve', 'moderada', 'forte'].includes(d.intensidade)) F.add('intensidade inválida', onde);
      if (d.ritmo !== null && !ritmoOk(d.ritmo)) F.add('faixa de ritmo inválida no treino', onde + ' ' + JSON.stringify(d.ritmo));
      if (!Array.isArray(d.blocos) || (d.tipo !== 'descanso' && !d.blocos.length)) F.add('treino sem blocos', onde);
      for (const b of d.blocos) {
        if (!TIPOS_BLOCO.has(b.tipo) || !b.rotulo) F.add('bloco inválido', onde);
        if (!((b.seg > 0) !== (b.m > 0))) F.add('bloco deve ter tempo OU distância', onde + ' ' + JSON.stringify(b));
        if (b.repeticoes != null && !(Number.isInteger(b.repeticoes) && b.repeticoes >= 1 && b.repeticoes <= 30)) F.add('repetições inválidas', onde + ' ' + b.repeticoes);
        if (b.ritmo && !ritmoOk(b.ritmo)) F.add('faixa de ritmo inválida no bloco', onde);
        if (b.pausa && !(b.pausa.seg > 0 && TIPOS_BLOCO.has(b.pausa.tipo))) F.add('pausa inválida', onde);
      }
      const passos = expandirBlocos(d.blocos, 400);
      if (passos.some((x) => !numOk(x.seg))) F.add('cronômetro com passo inválido', onde);
      // tempo disponível (com a margem do "cerca de")
      const limite = d.tipo === 'prova' || d.tipo === 'teste' ? Infinity : d.tipo === 'longo' ? pf.tempoLongo + 12 : d.tipo === 'corrida_caminhada' ? pf.tempo + 2 : pf.tempo + 12;
      if (d.durMin > limite) F.add('treino maior que o tempo disponível', `${onde}: ${d.durMin} min, limite ${limite}`);
      if (d.tipo === 'longo') longos.push({ w, km: d.distKm, margem: p.modo === 'tempo' ? 330 / ((d.durMin * 60) / d.distKm) + 0.15 : 0.6 });
    }
    // treinos fortes nunca em dias seguidos (dentro da semana e na virada para a seguinte)
    const fortes = s.dias.filter((d) => d.intensidade === 'forte').map((d) => d.wd);
    for (let x = 0; x < fortes.length; x++) for (let y = x + 1; y < fortes.length; y++) if (Math.abs(pos(fortes[x]) - pos(fortes[y])) === 1) F.add('treinos fortes em dias seguidos', `${rot} sem ${w}: ${fortes}`);
    const prox = p.semanas[i + 1];
    if (prox && fortes.includes(0) && prox.dias.some((d) => d.wd === 1 && d.intensidade === 'forte')) F.add('treinos fortes em dias seguidos (virada da semana)', `${rot} sem ${w}`);
    if (fortes.length > 2 + (s.dias.some((d) => d.tipo === 'prova' || d.tipo === 'teste') ? 1 : 0)) F.add('mais de 2 treinos fortes na semana', `${rot} sem ${w}`);
    // iniciantes: nada de intervalado nem tiros; nível 0 sem treino forte no programa de corrida e caminhada; nível 1 sem forte nas 4 primeiras semanas
    for (const d of s.dias) {
      if (pf.nivel <= 1 && (d.tipo === 'intervalado' || d.tipo === 'tiros')) F.add('iniciante com intervalado ou tiros', `${rot} sem ${w}`);
      if (d.intensidade === 'forte' && d.tipo !== 'prova' && d.tipo !== 'teste') {
        if (pf.nivel === 0 && s.fase === 'adaptacao') F.add('treino forte no programa de corrida e caminhada', rot);
        if (pf.nivel === 1 && w <= 4) F.add('iniciante com treino forte nas 4 primeiras semanas', `${rot} sem ${w} ${d.tipo}`);
        if (pf.retorno >= 1 && w <= 2) F.add('volta de pausa com treino forte nas 2 primeiras semanas', rot);
      }
      // populações com cautela: nenhum treino forte, nunca
      if (d.intensidade === 'forte' && (pf.cautela || pf.idade < 14 || (pf.idade < 16 && d.tipo !== 'prova'))) F.add('treino forte para quem tem cautela ou menos de 16 anos', `${rot} sem ${w} ${d.tipo}`);
      if (pf.gestante && !['caminhada', 'leve', 'regenerativo', 'longo', 'descanso'].includes(d.tipo)) F.add('gestante com treino que não é leve', `${rot} ${d.tipo}`);
      if (pf.gestante && d.durMin > 50) F.add('gestante com treino de mais de 50 min', `${rot} ${d.durMin}`);
      if ((d.tipo === 'prova' || d.tipo === 'teste') && d.distKm > KM[pf.distMax] + 2) F.add('menor de idade com distância acima do limite', `${rot}: ${d.distKm}`);
    }
    if (pf.idade < 14 && s.dias.filter((d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso').length > 3) F.add('menor de 14 com mais de 3 corridas na semana', rot);
    // quem corre sem regularidade: até 3 corridas por semana, sem ritmo e sem treino forte nas 8 primeiras semanas
    if (pf.irregular) {
      if (s.dias.filter(ehCorr).length > 3) F.add('corredor irregular com mais de 3 corridas na semana', `${rot} sem ${w}`);
      if (s.dias.some((d) => d.ritmo)) F.add('corredor irregular com ritmo prescrito', rot);
      if (w <= 8 && s.dias.some((d) => d.intensidade === 'forte' && !ehEv(d))) F.add('corredor irregular com treino forte nas 8 primeiras semanas', `${rot} sem ${w}`);
    }
    // prioridade escolhida entre corrida e musculação
    if (pf.foco === 'musculacao' || pf.foco === 'equilibrio') {
      if (s.dias.filter(ehCorr).length > (pf.foco === 'musculacao' ? 3 : 4)) F.add('foco: corridas demais na semana', `${rot} sem ${w}`);
      if (s.dias.filter((d) => d.intensidade === 'forte' && !ehEv(d)).length > 1) F.add('foco: mais de 1 treino forte', `${rot} sem ${w}`);
      if (pf.foco === 'musculacao' && s.dias.some((d) => !ehEv(d) && d.durMin > 42)) F.add('foco na musculação: corrida de mais de 40 min', `${rot} sem ${w}`);
    }
    if ((pf.jovem || pf.idoso) && fortes.length > 1 && !s.dias.some((d) => d.tipo === 'prova' || d.tipo === 'teste')) F.add('menor de 18 ou 60+ com mais de 1 treino forte', `${rot} sem ${w}`);
    if (pf.nivel === 0 && s.fase === 'adaptacao') {
      const corr = s.dias.filter((d) => d.tipo === 'corrida_caminhada').map((d) => d.wd);
      for (let x = 0; x < corr.length; x++) for (let y = x + 1; y < corr.length; y++) if (viz(corr[x], corr[y])) F.add('iniciante correndo em dias seguidos', `${rot}: ${corr}`);
      if (corr.length > 3) F.add('iniciante com mais de 3 corridas por semana', rot);
    }
    // o longão é o treino mais longo da semana (dentro e fora da janela de ajuste por dor, cada grupo por si)
    const lg = s.dias.find((d) => d.tipo === 'longo');
    if (lg) for (const d of s.dias) if ((d.tipo === 'leve' || d.tipo === 'regenerativo') && !!d.ajustado === !!lg.ajustado && d.durMin > lg.durMin) F.add('rodagem mais longa que o longão', `${rot} sem ${w}: ${d.tipo} ${d.durMin} min > longo ${lg.durMin} min`);
    if (lg && lg.durMin > 152) F.add('treino longo acima de 2h30', `${rot} sem ${w}: ${lg.durMin} min`);
    // nenhum treino forte dura mais que o longão da mesma semana; regenerativo de até 40 min
    if (lg) for (const d of s.dias) if (d.intensidade !== 'leve' && !ehEv(d) && d.tipo !== 'longo' && !!d.ajustado === !!lg.ajustado && d.durMin > lg.durMin) F.add('treino forte mais longo que o longão', `${rot} sem ${w}: ${d.tipo} ${d.durMin} min > longo ${lg.durMin} min`);
    for (const d of s.dias) if (d.tipo === 'regenerativo' && d.durMin > 41) F.add('regenerativo acima de 40 min', `${rot} sem ${w}: ${d.durMin} min`);
    // 2 treinos fortes só em semana com 5 ou mais corridas
    if (s.dias.filter((d) => d.intensidade === 'forte' && !ehEv(d)).length > 1 && s.dias.filter(ehCorr).length < 5) F.add('2 treinos fortes em semana com menos de 5 corridas', `${rot} sem ${w}`);
    // volta de pausa informada: sem acelerações e sem treino forte enquanto durar a volta
    if (pf.retorno >= 1 && p.tipo === 'geral') {
      const longa = pf.pausaDias >= 56;
      if (w <= (longa ? 6 : 2) && s.dias.some((d) => d.blocos.some((b) => b.rotulo === 'Acelerações'))) F.add('acelerações na volta de pausa', `${rot} sem ${w}`);
      if (w <= (longa ? 9 : 2) && s.dias.some((d) => d.intensidade === 'forte' && !ehEv(d))) F.add('treino forte na volta de pausa', `${rot} sem ${w}`);
    }
    // por tempo, o longão não cresce mais de 10% (ou o equivalente a 0,75 km) em duração sobre o maior das 4 semanas anteriores
    // (por distância, a regra vale em quilômetros: está mais abaixo)
    if (!adaptado && lg && s.fase !== 'polimento' && p.modo === 'tempo') {
      const m = Math.max(0, ...longosMin.slice(-4));
      if (m > 0 && lg.durMin > Math.max(m * 1.1, m + (0.75 * lg.durMin) / Math.max(1, lg.distKm)) + 1) F.add('duração do longão cresceu mais de 10%', `${rot} sem ${w}: ${lg.durMin} min > ${m} min`);
    }
    longosMin.push(lg ? lg.durMin : 0);
    const semEvento = !s.dias.some((d) => d.tipo === 'prova' || d.tipo === 'teste');
    if (semEvento && s.fase !== 'polimento') picoKm = Math.max(picoKm, s.volumeKm);
  });
  if (!adaptado) {
    // volume: cada semana no máximo 10% (+2 km de margem de arredondamento) acima da maior das 3 anteriores
    for (let i = 1; i < p.semanas.length; i++) {
      const s = p.semanas[i];
      if (s.dias.some((d) => d.tipo === 'prova' || d.tipo === 'teste')) continue;
      const ant = p.semanas.slice(Math.max(0, i - 3), i);
      if (s.fase === 'adaptacao') {
        const teto = Math.max(...ant.map((x) => x.corridaMin)) + 10;
        if (s.corridaMin > teto) F.add('corrida e caminhada: mais de 10 min de corrida a mais na semana', `${rot} sem ${i + 1}: ${s.corridaMin} > ${teto}`);
      } else {
        // regra: até 10% a mais, ou 1,5 km em volumes pequenos. Margem de arredondamento por treino: meio quilômetro
        // (treinos por distância) ou um passo de 5 minutos (treinos por tempo)
        const m = Math.max(...ant.map((x) => x.volumeKm));
        const corr = s.dias.filter((d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso');
        // margem: um passo de arredondamento (5 minutos ou meio quilômetro) na semana inteira
        const passo = p.modo === 'tempo' ? 300 / ((s.corridaMin * 60) / Math.max(1, s.volumeKm)) : 0.5;
        const teto = Math.max(m * 1.1, m + 1.5) + passo + 0.4;
        void corr;
        // (com todas as rodagens já no piso de 20 minutos, não há o que encurtar: o que passa é o piso, não um salto)
        if (s.volumeKm > teto && corr.some((d) => (d.tipo === 'leve' || d.tipo === 'regenerativo') && d.durMin > 24)) F.add('volume semanal cresceu acima do limite', `${rot} sem ${i + 1}: ${s.volumeKm} > ${teto.toFixed(1)} (${ant.map((x) => x.volumeKm)})`);
      }
    }
    // treino longo: no máximo 10% (+1 km) acima do maior das 4 semanas anteriores
    for (let i = 0; i < longos.length; i++) {
      const ant = longos.filter((l) => l.w < longos[i].w && l.w >= longos[i].w - 4).map((l) => l.km);
      const ref = ant.length ? Math.max(...ant) : Math.max(pf.longoAtual, 4);
      // regra: até 10% a mais, ou 0,75 km abaixo de 8 km; margem para o arredondamento (5 min ou meio quilômetro)
      if (longos[i].km > Math.max(ref * 1.1, ref + 0.75) + longos[i].margem) F.add('treino longo cresceu mais de 10% sobre o maior do último mês', `${rot} sem ${longos[i].w}: ${longos[i].km} > ${ref}`);
    }
    // semana leve: planos com 8 semanas ou mais fora do programa de iniciantes têm descarga
    const gerais = p.semanas.filter((s) => s.fase !== 'adaptacao' && s.fase !== 'caminhada' && s.fase !== 'polimento');
    if (gerais.length >= 8 && !gerais.some((s) => s.descarga)) F.add('plano longo sem semana de descarga', rot);
    // prova: última semana com o dia da prova no dia do longo; polimento quando o plano tem 8 semanas ou mais
    if (pf.dist) {
      const ult = p.semanas[p.semanas.length - 1];
      const ev = ult.dias.filter((d) => d.tipo === 'prova' || d.tipo === 'teste');
      if (ev.length !== 1) { if (!p.provaRetirada) F.add('plano com distância sem dia de prova na última semana', rot); }
      else {
        if (ev[0].wd !== pf.diaLongo) F.add('prova fora do dia do longo', rot);
        if (Math.abs(ev[0].distKm - KM[pf.dist]) > 2.5) F.add('distância da prova errada', `${rot}: ${ev[0].distKm}`);
      }
      if (p.semanas.slice(0, -1).some((s) => s.dias.some((d) => d.tipo === 'prova' || d.tipo === 'teste'))) F.add('prova antes da última semana', rot);
      if (p.tipo === 'geral' && p.totalSemanas >= 8) {
        if (!p.semanas.some((s) => s.fase === 'polimento')) F.add('plano de prova sem polimento', rot);
        const fora = ult.dias.filter((d) => d.tipo !== 'prova' && d.tipo !== 'teste' && d.tipo !== 'caminhada').reduce((x, d) => x + d.distKm, 0);
        if (picoKm > 12 && fora > picoKm * 0.75) F.add('semana da prova sem redução de volume', `${rot}: ${fora.toFixed(1)} de ${picoKm}`);
      }
    } else if (p.semanas.some((s) => s.dias.some((d) => d.tipo === 'prova' || d.tipo === 'teste'))) F.add('prova em plano sem distância', rot);
  }
  // ritmos coerentes: leve mais lento que limiar, que é mais lento que intervalado, que é mais lento que tiros
  if (p.ritmos) {
    const R = p.ritmos;
    for (const k of ['leve', 'regenerativo', 'longo', 'limiar', 'intervalado', 'tiros']) if (!ritmoOk(R[k])) F.add('ritmo inválido: ' + k, rot + ' ' + JSON.stringify(R[k]));
    if (!(R.leve.de > R.limiar.ate && R.limiar.de > R.intervalado.ate && R.intervalado.de > R.tiros.ate)) F.add('ritmos fora de ordem', rot + ' ' + JSON.stringify([R.leve, R.limiar, R.intervalado, R.tiros]));
    if (!(R.vdot > 5 && R.vdot <= 86)) F.add('VDOT fora do possível', rot + ' ' + R.vdot);
    for (const d of [5, 10, 21, 42]) if (!ritmoOk(R.prova[d]) || !(R.previsoes[d] > 0)) F.add('previsão de prova inválida', rot);
    if (!(R.previsoes[5] < R.previsoes[10] && R.previsoes[10] < R.previsoes[21] && R.previsoes[21] < R.previsoes[42])) F.add('previsões fora de ordem', rot);
    if (R.leve.de > 500) F.add('ritmo leve mais lento que a transição entre caminhar e correr', rot + ' ' + R.leve.de);
  } else if (pf.resultado && !pf.lento) F.add('resultado informado sem ritmos', rot);
  // a prova (ou o desafio) só existe se o maior treino das 4 semanas anteriores chega à metade da distância
  {
    const T = p.semanas.length, ev = p.semanas[T - 1].dias.find(ehEv);
    if (ev && !adaptado) {
      let maior = Math.max(0, ...p.semanas.slice(Math.max(0, T - 5), T - 1).flatMap((x) => x.dias.filter(ehCorr).map((d) => (d.tipo === 'corrida_caminhada' ? d.corridaKm : d.distKm))));
      if (pf.nivel >= 1 && T <= 4 && pf.retorno === 0) maior = Math.max(maior, Math.min(pf.longoAtual, 0.6 * pf.kmSemana));
      if (maior * 2 < ev.distKm - 0.15) F.add('prova com maior treino abaixo da metade da distância', `${rot}: ${maior} km para ${ev.distKm} km em ${T} semanas`);
      if (pf.nivel === 0 && T < ({ 5: 9, 10: 13, 21: 14, 42: 17 })[pf.dist]) F.add('prova para quem começa do zero antes do prazo mínimo', `${rot}: ${T} semanas`);
    }
    if (pf.meta && (pf.meta.semanas || pf.meta.nova !== pf.meta.dist) && !p.avisos.some((x) => x.tipo === 'danger' && x.destaque)) F.add('meta trocada sem aviso forte', rot);
    if (a.objetivo === 'prova' && pf.objetivo !== 'prova' && !pf.gestante && pf.idade >= 14 && !(pf.meta && p.avisos.some((x) => x.tipo === 'danger' && x.destaque))) F.add('prova desmarcada sem explicação', rot);
  }
  // volta de pausa de 8 semanas ou mais: um terço do volume; de 3 meses ou mais: no máximo 15 km e longo curto na primeira semana
  if (!adaptado && p.tipo === 'geral' && pf.pausaDias >= 56) {
    // margem: o arredondamento de cada corrida (5 minutos ou meio quilômetro)
    const s1 = p.semanas[0], teto = Math.max(0.33 * pf.kmSemana, 8) + 0.6 * s1.dias.filter(ehCorr).length;
    if (!s1.dias.some(ehEv) && s1.volumeKm > (pf.pausaDias >= 90 ? Math.min(teto, 15 + 0.6 * s1.dias.filter(ehCorr).length) : teto)) F.add('volta de pausa longa começa com volume alto', `${rot}: ${s1.volumeKm} km`);
    if (pf.pausaDias >= 90 && s1.dias.some((d) => d.tipo === 'longo' && d.durMin >= 90)) F.add('volta de 3 meses ou mais com longão de 90 min na semana 1', rot);
  }
  // doença sem liberação: nenhum treino forte e aviso
  if ((pf.cronica || pf.hipertensao) && !pf.liberado) {
    if (p.semanas.some((x) => x.dias.some((d) => d.intensidade === 'forte'))) F.add('doença sem liberação com treino forte', rot);
    if (!p.avisos.some((x) => x.tipo === 'warn' && /liberação/.test(x.texto)) || !pf.confirmar) F.add('doença sem liberação sem aviso ou sem confirmação', rot);
  }
  if ((pf.cardiaco || pf.renal || pf.diabetes) && !pf.liberado) F.add('doença do coração, dos rins ou diabetes com plano sem liberação', rot);
  for (const x of [...p.avisos, ...p.ajustes]) if (/\b[01] semanas\b|\b1 etapas\b|\b1 dias\b/.test(x.texto + ' ' + (x.motivo || ''))) F.add('texto com plural errado', x.texto);
  // avisos de triagem e de população
  const temAviso = (re, tipo) => p.avisos.some((x) => (!tipo || x.tipo === tipo) && re.test(x.texto));
  if (pf.precisaLiberacao && !temAviso(/liberação médica/, 'danger')) F.add('sem aviso de liberação médica', rot);
  if (pf.gestante && !temAviso(/Gestação/)) F.add('gestante sem aviso', rot);
  if (pf.posparto && !temAviso(/Pós-parto/)) F.add('pós-parto sem aviso', rot);
  if (pf.hipertensao && !temAviso(/Pressão alta/)) F.add('pressão alta sem aviso', rot);
  if (pf.diabetes && !temAviso(/Diabetes/)) F.add('diabetes sem aviso', rot);
  if (pf.jovem && !temAviso(/Menores de 18/)) F.add('menor de 18 sem aviso', rot);
  if (pf.idoso && !temAviso(/60 anos/)) F.add('60+ sem aviso', rot);
  if (pf.obeso && !temAviso(/IMC|3 km de corrida/)) F.add('IMC 30+ sem aviso', rot);
  for (const x of [...p.avisos, ...p.ajustes]) for (const k of x.refs || []) if (!REFS_CORRIDA[k]) F.add('referência inexistente', k);
  for (const o of p.orientacoes) { if (!o[0] || !o[1]) F.add('orientação vazia', rot); for (const k of o[2] || []) if (!REFS_CORRIDA[k]) F.add('referência inexistente', k); }
  if (!['gps', 'esteira', 'tempo'].includes(p.modo)) F.add('modo inválido', rot);
  if (pf.nivel <= 1 && p.modo !== 'tempo') F.add('iniciante fora do modo por tempo e esforço', rot);
  // sem NaN em lugar nenhum
  if (/NaN|undefined|Infinity/.test(JSON.stringify(p.semanas).replace(/"detalhe":"[^"]*"/g, ''))) F.add('NaN, undefined ou Infinity no plano', rot);
}

test('estresse: grade de nível × objetivo × distância × dias × idade × condição', () => {
  const F = coletor();
  const r = semente(20261113);
  let n = 0, bloqueados = 0;
  const objetivos = [['comecar'], ['saude'], ...['distancia', 'ritmo', 'prova'].flatMap((o) => DISTS.map((d) => [o, d]))];
  const condicoes = [[['nenhuma'], ['nenhum'], undefined], [['hipertensao'], ['nenhum'], 'nao'], [['hipertensao'], ['nenhum'], 'sim'], [['cardiaco'], ['nenhum'], 'sim'], [['diabetes'], ['nenhum'], 'sim'], [['gestante'], ['nenhum'], 'sim'], [['posparto'], ['nenhum'], 'sim'], [['nenhuma'], ['falta_ar'], 'sim'], [['nenhuma'], ['dor_peito'], 'nao'], [['gestante'], ['nenhum'], 'nao']];
  for (const experiencia of EXP) for (const [objetivo, distancia] of objetivos) for (const dias of DIAS_CONJ) for (const idade of IDADES) for (const [cond, tri, liberado] of condicoes) {
    const a = respostas(r, { experiencia, objetivo, distancia, dias, idade, condicoes: cond, triagem: tri, liberado });
    const rot = `${experiencia}/${objetivo}${distancia || ''}/${dias.join('')}/${idade}a/${cond[0]}${tri[0] !== 'nenhum' ? '+' + tri[0] : ''}${liberado ? '/' + liberado : ''}`;
    if (!respostasCompletas(a)) F.add('respostas geradas incompletas', rot);
    let p;
    try { p = gerarPlano(a); } catch (e) { F.add('erro ao gerar o plano', rot + ': ' + e.message); continue; }
    n++;
    if (!p) { bloqueados++; if (!avisosBloqueio(a).length) F.add('bloqueio sem explicação', rot); continue; }
    conferir(p, a, rot, F);
  }
  assert.ok(n > 30000, 'grade pequena demais: ' + n);
  assert.ok(bloqueados > 0 && bloqueados < n / 2, 'bloqueios fora do esperado: ' + bloqueados);
  assert.equal(F.m.size, 0, `${n} planos, ${bloqueados} bloqueados\n` + relatorio(F));
});

test('estresse: prioridade entre corrida e musculação em perfis sorteados', () => {
  const F = coletor();
  const r = semente(2024);
  let n = 0;
  for (let i = 0; i < 4000; i++) {
    const a = respostas(r, { condicoes: ['nenhuma'], triagem: ['nenhum'] });
    const foco = um(r, ['musculacao', 'equilibrio', 'corrida']);
    const pernas = um(r, [[], [1], [2, 5], [1, 3, 5]]);
    let p;
    try { p = gerarPlano(a, { foco, diasPernas: pernas, diasForca: pernas }); } catch (e) { F.add('erro com foco', e.message); continue; }
    if (!p) continue;
    n++;
    if (p.perfil.foco !== foco) F.add('foco não aplicado', foco);
    conferir(p, a, `foco ${foco} ${a.experiencia}/${a.objetivo}${a.distancia || ''}/${a.dias.join('')}`, F);
    if (foco === 'corrida' && JSON.stringify(p.semanas) !== JSON.stringify(gerarPlano(a, { diasPernas: pernas, diasForca: pernas }).semanas)) F.add('foco na corrida mudou a corrida', a.experiencia);
    if (foco !== 'corrida' && p.perfil.nivel >= 1 && !p.ajustes.some((x) => x.refs.length && x.motivo.length > 60)) F.add('foco sem explicação em “O que ajustei”', foco);
  }
  assert.ok(n > 2500);
  assert.equal(F.m.size, 0, relatorio(F));
});

test('estresse: bloqueios de segurança (idade, sinais de alerta, gestação, pós-parto e doença sem liberação)', () => {
  const r = semente(77);
  for (let i = 0; i < 3000; i++) {
    const a = respostas(r);
    const pf = perfil(a);
    const p = gerarPlano(a);
    const semLib = a.liberado !== 'sim';
    // "só com supervisão" bloqueia sempre, mesmo com liberação (parq2023)
    // (insulina ou remédio que baixa o açúcar vale como diabetes)
    const cond = [...a.condicoes, ...((a.remedios || []).includes('glicose') ? ['diabetes'] : [])];
    const deve = a.idade < 12 || a.triagem.includes('medico') || (semLib && (a.triagem[0] !== 'nenhum' || ['gestante', 'posparto', 'cardiaco', 'renal', 'diabetes'].some((k) => cond.includes(k))));
    void pf;
    assert.equal(p === null, deve, JSON.stringify(a));
    if (p === null) assert.ok(avisosBloqueio(a).every((x) => x.tipo === 'danger' && x.texto.length > 40 && x.refs.every((k) => REFS_CORRIDA[k])));
  }
  for (const idade of [8, 9, 10, 11]) assert.equal(gerarPlano({ ...base, idade }), null, 'menor de 12 não recebe plano');
  assert.ok(gerarPlano({ ...base, idade: 12 }));
});

test('estresse: plano determinístico e independente de chamadas anteriores', () => {
  const r = semente(5);
  for (let i = 0; i < 400; i++) {
    const a = respostas(r);
    const o = { inicio: '2026-11-02', hoje: '2026-11-18', registros: [{ id: 'a', data: '2026-11-03', tipo: 'leve', distKm: 5, durMin: 31, pse: 4 }], dores: [] };
    const x = JSON.stringify(gerarPlano(a, o));
    gerarPlano(respostas(r));
    assert.equal(JSON.stringify(gerarPlano(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(o)))), x);
  }
});

test('estresse: respostas, opções e registros estranhos não quebram nada', () => {
  const F = coletor();
  const r = semente(99);
  const lixo = [null, undefined, 0, -1, 1e99, NaN, Infinity, '', 'x', '<script>', [], {}, [[]], { a: 1 }, true, '__proto__', () => 1, 'nao', '9', ['9'], [1, 2], ['1', '1', '1']];
  for (let i = 0; i < 3000; i++) {
    const a = respostas(r);
    for (let k = 0; k < 3; k++) a[um(r, PERGUNTAS).k] = um(r, lixo);
    const registros = Array.from({ length: inteiro(r, 0, 12) }, (_, j) => (r() < 0.3 ? um(r, lixo) : { id: r() < 0.9 ? 'r' + j : um(r, lixo), data: r() < 0.85 ? somaDias('2026-10-20', inteiro(r, -30, 40)) : um(r, lixo), tipo: r() < 0.8 ? um(r, Object.keys(TIPOS_TREINO)) : um(r, lixo), distKm: r() < 0.8 ? r() * 30 : um(r, lixo), durMin: r() < 0.8 ? r() * 200 : um(r, lixo), pse: r() < 0.7 ? inteiro(r, 1, 10) : um(r, lixo), dor: r() < 0.3 ? { onde: um(r, [...Object.keys(LOCAIS_DOR), 'x', '__proto__']), nivel: um(r, [1, 5, 9, 99, 'x']) } : um(r, lixo), nota: um(r, lixo) }));
    const dores = Array.from({ length: inteiro(r, 0, 3) }, () => (r() < 0.3 ? um(r, lixo) : { onde: um(r, [...Object.keys(LOCAIS_DOR), 'x']), nivel: um(r, [1, 3, 5, 8, NaN, 'x']), tipo: um(r, [...Object.keys(TIPOS_DOR), 'x']), quando: um(r, ['durante', 'repouso', 7]), dias: um(r, [0, 1, 5, 12, NaN, 'x']) }));
    const o = um(r, [undefined, null, 5, {}, { inicio: um(r, ['2026-10-19', 'ontem', 5, null, '2026-02-31']), hoje: um(r, ['2026-11-12', '2025-01-01', '2030-05-05', 'x', null]), registros: r() < 0.9 ? registros : um(r, lixo), diasForca: um(r, [[1, 3], 'x', [9, -1, 'a'], null]), diasPernas: um(r, [[3], [0, 1, 2, 3, 4, 5, 6], 5]), dores: r() < 0.9 ? dores : um(r, lixo), desde: um(r, ['2026-10-21', 'x', undefined]) }]);
    let p;
    try { perfil(a); respostasCompletas(a); p = gerarPlano(a, o); avisosBloqueio(a); dicas(a); } catch (e) { F.add('erro com entrada estranha', e.message + ' ' + JSON.stringify(a).slice(0, 300)); continue; }
    if (p) {
      const txt = JSON.stringify(p.semanas);
      if (/NaN|Infinity/.test(txt)) F.add('NaN com entrada estranha', JSON.stringify(a).slice(0, 200));
      for (const s of p.semanas) for (const d of s.dias) if (!numOk(d.distKm) || !numOk(d.durMin)) F.add('número inválido com entrada estranha', d.tipo);
    }
    try { evolucao(registros, '2026-11-12'); alertas(registros, '2026-11-12'); evolucao(um(r, lixo), um(r, lixo)); alertas(um(r, lixo), um(r, lixo)); efeitoDaDor(um(r, lixo)); expandirBlocos(um(r, lixo)); planejadoDe(um(r, lixo)); efeitoDoFoco(um(r, lixo), um(r, lixo)); } catch (e) { F.add('erro nas análises com entrada estranha', e.message); }
    try {
      const st = { run: limparCorrida({ answers: a, aceitoEm: '2026-10-20T10:00:00.000Z', inicio: '2026-10-19' }), runs: limparRegistros(registros), dores: [], plans: um(r, lixo), activePlan: um(r, lixo) };
      planoDaSemana(st, um(r, ['2026-11-12', 'x', null])); planoDaSemanaEm(st, um(r, ['2026-11-12', 'x', null]), um(r, ['2026-11-09', '2026-10-05', '2031-01-06', 'x', null, 7]));
      st.combo = um(r, [{ foco: 'musculacao', fortalecimento: 'nao', em: '' }, ...lixo]);
      analiseRecente(st, um(r, ['2026-11-12', 'x', null])); analiseRecente(um(r, lixo), '2026-11-12');
      for (const x of [...registros.slice(0, 3), um(r, lixo)]) { const an = analiseDoRegistro(st, '2026-11-12', isObj(x) ? { ...x, plan: um(r, [{ tipo: 'leve', durMin: 30, distKm: 5, ritmo: [350, 380], pse: [2, 4] }, { tipo: 'x' }, ...lixo]) } : x); if (an && (!an.titulo || !Array.isArray(an.itens) || !an.itens.length || typeof an.plano !== 'string' || an.refs.some((k) => !REFS_CORRIDA[k]))) F.add('análise malformada', JSON.stringify(an).slice(0, 200)); }
      resumoParaNutricao(st, '2026-11-12'); treinoDoDia(st, '2026-11-12', um(r, ['2026-11-13', 'x', null, '1999-01-01']));
      planoDaSemana(um(r, lixo), '2026-11-12'); resumoParaNutricao(um(r, lixo), '2026-11-12');
    } catch (e) { F.add('erro no calendário com entrada estranha', e.message); }
  }
  assert.equal(F.m.size, 0, relatorio(F));
});

test('estresse: sanitização rejeita lixo e mantém os limites', () => {
  const r = semente(123);
  const lixo = [null, undefined, 0, -1, 1e99, NaN, Infinity, '', 'x', '<img onerror=x>', [], {}, { a: { b: 1 } }, true, '__proto__', 'constructor', 2026, '2026-13-40', '2026-11-12'];
  for (let i = 0; i < 20000; i++) {
    const raw = r() < 0.1 ? um(r, lixo) : { id: um(r, ['a1', 'x-y_z', ...lixo]), data: um(r, ['2026-11-12', '2026-02-30', '1800-01-01', '2999-01-01', ...lixo]), tipo: um(r, ['leve', 'longo', 'prova', 'descanso', ...lixo]), distKm: um(r, [5, 0.01, 119.999, 500, -3, ...lixo]), durMin: um(r, [30, 0.04, 899.96, 5000, -3, ...lixo]), pse: um(r, [1, 10, 5.5, 0, 11, ...lixo]), dor: um(r, [{ onde: 'joelho', nivel: 4 }, { onde: 'x', nivel: 4 }, { onde: 'joelho', nivel: 40 }, { onde: 'constructor', nivel: 2 }, ...lixo]), nota: um(r, ['ok', 'n'.repeat(999), ...lixo]), planejado: um(r, ['p'.repeat(999), ...lixo]), plan: um(r, [{ tipo: 'leve', durMin: 30.04, distKm: 5, ritmo: [350, 380], pse: [2, 4], x: '<b>' }, { tipo: 'longo', durMin: 1e9, distKm: -1, ritmo: ['a', 2], pse: [5, 2] }, { tipo: '__proto__' }, ...lixo]), extra: { x: 1 } };
    const x = limparRegistro(raw);
    if (x === null) continue;
    // `plan` (o treino que estava no plano) só existe quando é válido
    assert.deepEqual(Object.keys(x).filter((k) => k !== 'plan').sort(), ['data', 'distKm', 'dores', 'durMin', 'id', 'nota', 'planejado', 'pse', 'tipo']);
    if ('plan' in x) assert.ok(TIPOS_TREINO[x.plan.tipo] && Object.keys(x.plan).length === 6 && ['t', 'd'].includes(x.plan.un) && x.plan.durMin >= 0 && x.plan.durMin <= 900 && x.plan.distKm >= 0 && x.plan.distKm <= 120 && (x.plan.ritmo === null || (x.plan.ritmo.length === 2 && x.plan.ritmo.every(Number.isInteger))) && (x.plan.pse === null || x.plan.pse.every((n) => Number.isInteger(n) && n >= 0 && n <= 10)));
    assert.match(x.id, /^[A-Za-z0-9_-]{1,40}$/); assert.notEqual(x.id, '__proto__'); assert.notEqual(x.id, 'constructor');
    assert.match(x.data, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(x.distKm >= 0 && x.distKm <= 120 && x.durMin >= 0 && x.durMin <= 900 && (x.distKm > 0 || x.durMin > 0));
    if (x.distKm && x.durMin) assert.ok((x.durMin * 60) / x.distKm >= 110, 'ritmo impossível aceito');
    assert.ok(x.pse === null || (Number.isInteger(x.pse) && x.pse >= 1 && x.pse <= 10));
    assert.ok(Array.isArray(x.dores) && x.dores.length <= 6 && new Set(x.dores.map((d) => d.onde)).size === x.dores.length && x.dores.every((d) => Object.keys(d).length === 3 && LOCAIS_DOR[d.onde] && Number.isInteger(d.nivel) && d.nivel >= 1 && d.nivel <= 10 && ['muscular', 'articular', 'aguda'].includes(d.tipo)));
    assert.ok(TIPOS_TREINO[x.tipo] && x.tipo !== 'descanso');
    assert.ok(typeof x.nota === 'string' && x.nota.length <= 200 && typeof x.planejado === 'string' && x.planejado.length <= 160);
  }
  for (let i = 0; i < 2000; i++) {
    const c = limparCorrida(r() < 0.2 ? um(r, lixo) : { answers: r() < 0.5 ? respostas(r) : um(r, lixo), aceitoEm: um(r, ['2026-11-02T10:00:00.000Z', ...lixo]), inicio: um(r, ['2026-11-05', ...lixo]), pausas: um(r, [[{ de: '2026-11-06', ate: '2026-11-30', semanas: 3 }, { de: 'x', ate: 5 }, 7], ...lixo]), pausadoEm: um(r, ['2026-11-09T10:00:00.000Z', ...lixo]), mostrados: um(r, [[{ data: '2026-11-06', tipo: 'leve', nome: 'n'.repeat(99), resumo: 5, durMin: 1e9 }, { data: '2026-11-06', tipo: '__proto__' }, { data: 'x' }, 7], ...lixo]), degrau: um(r, [{ pontos: 2, base: 'entrevista' }, { pontos: 2.5, base: 'x' }, { pontos: 99, base: '2026-11-01' }, ...lixo]), cron: um(r, [{ data: '2026-11-10', i: 2, fim: 1794000000000, pausadoEm: 0, inicio: 1793999000000, parado: 0, inicioPasso: 1793999500000, terminado: 0, chave: 77 }, { data: '2026-11-10', i: -3, fim: 'x' }, { data: 'x', i: 1e99 }, ...lixo]), x: 1 });
    assert.deepEqual(Object.keys(c).sort(), ['aceitoEm', 'answers', 'cron', 'degrau', 'inicio', 'mostrados', 'pausadoEm', 'pausas']);
    assert.ok(Array.isArray(c.mostrados) && c.mostrados.length <= 400 && c.mostrados.every((m) => Object.keys(m).length === 9 && /^\d{4}-\d{2}-\d{2}$/.test(m.data) && (m.tipo === '' || TIPOS_TREINO[m.tipo]) && m.nome.length <= 60 && m.resumo.length <= 160) && (c.inicio !== '' || !c.mostrados.length));
    assert.ok(c.degrau === null || (c.inicio !== '' && Number.isInteger(c.degrau.pontos) && c.degrau.pontos >= 1 && c.degrau.pontos <= 10));
    assert.ok(Array.isArray(c.pausas) && c.pausas.length <= 20 && c.pausas.every((p) => Object.keys(p).length === 3 && p.de <= p.ate && Number.isInteger(p.semanas) && p.semanas >= 0 && p.semanas * 7 <= diasEntre(p.de, p.ate)) && (c.inicio !== '' || !c.pausas.length));
    assert.ok(c.cron === null || (Object.keys(c.cron).length === 9 && c.inicio !== '' && Object.values(c.cron).every((v) => typeof v === 'string' || (Number.isInteger(v) && v >= 0))));
    assert.ok(c.inicio === '' || (diaDaSemana(c.inicio) === 1 && c.aceitoEm !== ''));
    if (!c.aceitoEm) assert.equal(c.inicio + c.pausadoEm, '');
    for (const k of Object.keys(c.answers)) assert.ok(PERGUNTAS.some((q) => q.k === k));
  }
});

// ---------- acompanhamento simulado: a pessoa registra parte dos treinos e o plano se ajusta sem sair das regras ----------
test('estresse: acompanhamento simulado por 10 semanas, com faltas, esforço variado, dores e pausas', () => {
  const F = coletor();
  const r = semente(4242);
  const inicio = '2026-08-03';
  let ajustados = 0, simulados = 0;
  for (let i = 0; i < 260; i++) {
    const a = respostas(r, { idade: um(r, [17, 28, 41, 55, 66]), condicoes: ['nenhuma'], triagem: ['nenhum'] });
    if (!gerarPlano(a)) continue;
    simulados++;
    const aderencia = um(r, [1, 0.9, 0.7, 0.45, 0.2]);
    const esforco = um(r, [0, 0, 2, 4, -2]);
    const pausaEm = r() < 0.3 ? inteiro(r, 2, 6) : 0;
    const registros = [];
    const rot = `sim ${i} ${a.experiencia}/${a.objetivo}${a.distancia || ''}/${a.dias.join('')} ader ${aderencia}`;
    for (let w = 1; w <= 10; w++) {
      const hoje = somaDias(inicio, (w - 1) * 7);
      const dores = r() < 0.15 ? [{ id: 'd', onde: um(r, ['joelho', 'canela', 'aquiles', 'pe', 'ombro']), nivel: inteiro(r, 1, 9), tipo: um(r, Object.keys(TIPOS_DOR)), quando: um(r, ['durante', 'depois', 'repouso']), dias: inteiro(r, 0, 9) }] : [];
      let p;
      try { p = gerarPlano(a, { inicio, hoje, registros, dores, desde: inicio }); } catch (e) { F.add('erro no acompanhamento', rot + ': ' + e.message); break; }
      if (!p) { F.add('plano sumiu no acompanhamento', rot); break; }
      if (p.ajustes.length) ajustados++;
      for (const x of p.ajustes) if (!x.texto || !x.motivo || !Array.isArray(x.refs) || !x.refs.length || x.refs.some((k) => !REFS_CORRIDA[k])) F.add('ajuste sem texto, motivo ou fonte', rot + ' ' + JSON.stringify(x));
      conferir(p, a, rot + ' sem ' + w, F, true);
      if (w > p.totalSemanas) continue;
      const s = p.semanas[w - 1];
      // com dor de alerta em região da corrida, nada de corrida nos próximos 7 dias
      const alerta = dores.some((d) => ['joelho', 'canela', 'aquiles', 'pe'].includes(d.onde) && (d.tipo === 'aguda' || d.nivel >= 7 || d.quando === 'repouso'));
      if (alerta && s.dias.some((d) => d.tipo !== 'descanso' && d.tipo !== 'caminhada')) F.add('corrida prescrita com dor de alerta', rot + ' ' + JSON.stringify(dores));
      if (dores.length && efeitoDaDor(dores[0]).nivel >= 1 && s.dias.some((d) => d.intensidade === 'forte' && d.tipo !== 'prova' && d.tipo !== 'teste')) F.add('treino forte mantido com dor que pede redução', rot + ' ' + JSON.stringify(dores));
      // o treino longo da semana não passa de 10% (+1 km) acima da corrida mais longa dos 30 dias anteriores, quando há registros
      const ult30 = registros.filter((x) => x.data < hoje && x.data >= somaDias(hoje, -30) && x.tipo !== 'caminhada').map((x) => x.distKm);
      const pfx = perfil(a);
      if (ult30.length && p.tipo === 'geral') {
        const ref = Math.max(...ult30, w <= 4 ? pfx.longoAtual : 0);
        for (const d of s.dias) if (d.tipo === 'longo' && d.distKm > Math.max(ref * 1.1, ref + 0.75) + (p.modo === 'tempo' ? 330 / ((d.durMin * 60) / d.distKm) + 0.15 : 0.6)) F.add('longo acima de 10% da corrida mais longa registrada no mês', `${rot} sem ${w}: ${d.distKm} > ${ref}`);
      }
      if (pausaEm && w >= pausaEm && w < pausaEm + 3) continue; // semanas paradas
      for (const d of s.dias) {
        if (d.tipo === 'descanso' || r() > aderencia) continue;
        registros.push({ id: `s${i}w${w}d${d.wd}`, data: somaDias(hoje, pos(d.wd)), tipo: d.tipo, distKm: d.distKm, durMin: d.durMin, pse: Math.max(1, Math.min(10, Math.round((d.pse[0] + d.pse[1]) / 2) + esforco)), plan: planejadoDe(d), dor: r() < 0.05 ? { onde: 'joelho', nivel: inteiro(r, 1, 6) } : null, nota: '', planejado: d.resumo });
      }
    }
  }
  assert.ok(simulados > 150 && ajustados > 100, `poucos planos ajustados: ${ajustados} em ${simulados}`);
  assert.equal(F.m.size, 0, relatorio(F));
});

test('estresse: calendário da semana e resumo para a nutrição em todos os dias do plano', () => {
  const F = coletor();
  const r = semente(31);
  for (let i = 0; i < 150; i++) {
    const a = respostas(r, { condicoes: ['nenhuma'], triagem: ['nenhum'], idade: 33 });
    const aceite = somaDias('2026-09-01', inteiro(r, 0, 13));
    const inicio = inicioPara(a, aceite);
    if (diaDaSemana(inicio) !== 1 || inicio < segundaDe(aceite)) F.add('início do plano inválido', inicio);
    const st = { run: limparCorrida({ answers: a, aceitoEm: aceite + 'T12:00:00.000Z', inicio }), runs: [], dores: [], plans: [], activePlan: '' };
    const pl = gerarPlano(a, { inicio, adiado: segundaDe(aceite) < inicio });
    const total = pl.totalSemanas;
    for (const k of [-3, 0, 1, 6, 7, 20, total * 7 - 1, total * 7 + 3]) {
      const hoje = somaDias(inicio, k);
      const s = planoDaSemana(st, hoje), n = resumoParaNutricao(st, hoje);
      const fora = k < 0 || k >= total * 7;
      // fora do plano (antes da semana 1 ou depois da última), a nutrição não recebe corrida nenhuma
      if (fora && n !== null) F.add('resumo para a nutrição fora do plano', `${i} dia ${k}`);
      if (!s || (!fora && !n)) { F.add('plano aceito sem semana ou sem resumo', `${i} dia ${k}`); continue; }
      if (fora) { if (k < 0 && (!s.antesDoInicio || s.dias.some(Boolean))) F.add('antes do início deveria estar vazio', String(k)); if (k >= total * 7 && !s.concluido) F.add('depois do fim deveria estar concluído', String(k)); continue; }
      if (s.dias.length !== 7 || s.totalSemanas !== total || !(s.semana >= 1 && s.semana <= total) || typeof s.fase !== 'string') F.add('semana do calendário inválida', JSON.stringify({ k, semana: s.semana, total }));
      for (let wd = 0; wd < 7; wd++) {
        const d = s.dias[wd];
        if (!d) continue;
        if (d.wd !== wd || diaDaSemana(d.data) !== wd || segundaDe(d.data) !== segundaDe(hoje) || d.feito !== null) F.add('dia do calendário inválido', `${wd} ${d.data}`);
        const t = treinoDoDia(st, hoje, d.data);
        if (!t || t.tipo !== d.tipo) F.add('treino do dia diferente do calendário', d.data);
      }
      if (k < 0 && (!s.antesDoInicio || s.dias.some(Boolean))) F.add('antes do início deveria estar vazio', String(k));
      if (k >= total * 7 && !s.concluido) F.add('depois do fim deveria estar concluído', String(k));
      for (const c of ['kmSemana', 'minSemana', 'sessoesSemana', 'longoMin', 'longoKm', 'semana', 'totalSemanas', 'nivel']) if (!numOk(n[c])) F.add('resumo da nutrição com número inválido', c + ' ' + n[c]);
      if (n.prova && !(n.prova.distKm > 0 && /^\d{4}-\d{2}-\d{2}$/.test(n.prova.data) && n.prova.semanasAte >= 0 && n.prova.data >= hoje)) F.add('prova inválida no resumo', JSON.stringify(n.prova));
      const pf = perfil(a);
      if (!!n.prova !== !!(pl.prova && hoje <= pl.prova.data)) F.add('prova no resumo não bate com o objetivo', `${pf.objetivo} ${pf.dist} dia ${k}`);
      if (n.proximaCorrida && !(n.proximaCorrida.data >= hoje && n.proximaCorrida.durMin > 0)) F.add('próxima corrida inválida', JSON.stringify(n.proximaCorrida));
    }
    if (planoDaSemana({ ...st, run: { ...st.run, pausadoEm: '2026-09-20T10:00:00.000Z' } }, inicio) !== null) F.add('plano pausado deveria sumir do calendário', '');
    if (planoDaSemana({ ...st, run: { ...st.run, aceitoEm: '' } }, inicio) !== null || resumoParaNutricao({ run: { answers: a, aceitoEm: '', inicio: '' } }, inicio) !== null) F.add('sem plano aceito deveria ser null', '');
  }
  assert.equal(F.m.size, 0, relatorio(F));
});

test('estresse: ritmos coerentes para qualquer resultado válido', () => {
  let n = 0;
  for (const d of [3, 5, 10, 21.0975, 42.195]) for (let ritmo = 150; ritmo <= 570; ritmo += 7) {
    const R = ritmosDe(d, d * ritmo);
    // mais rápido que o recorde mundial da distância: recusado
    if (d * ritmo < recordeSeg(d)) { assert.equal(R, null, `${d} km a ${ritmo} s/km é mais rápido que o recorde`); continue; }
    assert.ok(R, `${d} km a ${ritmo} s/km`);
    assert.equal(R.lento, R.leve.de > 500);
    assert.ok(R.leve.ate >= R.leve.de && R.leve.de > R.limiar.ate && R.limiar.ate >= R.limiar.de && R.limiar.de > R.intervalado.ate && R.intervalado.ate >= R.intervalado.de && R.intervalado.de > R.tiros.ate && R.tiros.ate >= R.tiros.de && R.tiros.de > 90, `${d} km a ${ritmo}: ${JSON.stringify(R)}`);
    assert.ok(R.regenerativo.de >= R.leve.de && R.longo.de >= R.leve.de);
    assert.ok(R.prova[42].de > R.prova[21].de && R.prova[21].de > R.prova[10].de && R.prova[10].de > R.prova[5].de);
    n++;
  }
  assert.ok(n > 250);
  for (const [d, s] of [[5, 100], [5, 99999], [0, 600], [-5, 600], [5, NaN], ['5', 1500], [1, 300], [100, 30000]]) assert.equal(ritmosDe(d, s), null);
});

test('base de conhecimento: toda fonte citada existe e toda fonte é usada', () => {
  const usadas = new Set();
  const marca = (l) => { for (const k of l) { assert.ok(REFS_CORRIDA[k], 'referência inexistente: ' + k); usadas.add(k); } };
  for (const t of Object.values(TIPOS_TREINO)) marca(t.f);
  for (const d of Object.values(DOR_CORRIDA)) { marca(d.f); for (const k of ['reduzir', 'tolera', 'fortalecer', 'volta', 'medico']) assert.ok(d[k].length > 15); }
  for (const q of FAQ_CORRIDA) { assert.ok(q.q && q.tags && q.a.length && q.f.length); marca(q.f); }
  for (const l of Object.values(FONTES_TELA)) marca(l);
  for (const k of Object.keys(DOR_CORRIDA)) assert.ok(LOCAIS_DOR[k], 'local de dor desconhecido: ' + k);
  // as citadas só no código (logic/corrida.js) também contam
  const r = semente(8);
  for (let i = 0; i < 1500; i++) {
    const a = respostas(r);
    const p = gerarPlano(a, { inicio: '2026-10-05', hoje: '2026-11-12', registros: [{ id: 'x', data: '2026-10-06', tipo: 'leve', distKm: 4, durMin: 30, pse: 7 }, { id: 'y', data: '2026-10-08', tipo: 'teste', distKm: 5, durMin: 28, pse: 9 }], dores: [{ onde: um(r, Object.keys(LOCAIS_DOR)), nivel: inteiro(r, 1, 10), tipo: um(r, Object.keys(TIPOS_DOR)), quando: 'durante', dias: inteiro(r, 0, 10) }] });
    for (const x of avisosBloqueio(a)) marca(x.refs);
    for (const d of dicas(a)) marca(d.refs);
    if (!p) continue;
    for (const x of [...p.avisos, ...p.ajustes]) marca(x.refs || []);
    for (const o of p.orientacoes) marca(o[2] || []);
  }
  for (const x of alertas([{ id: 'a', data: '2026-11-01', tipo: 'leve', distKm: 5, durMin: 30, pse: 9, dor: { onde: 'joelho', nivel: 4 } }, { id: 'b', data: '2026-11-03', tipo: 'leve', distKm: 5, durMin: 30, pse: 9, dor: { onde: 'joelho', nivel: 4 } }, { id: 'c', data: '2026-11-10', tipo: 'longo', distKm: 12, durMin: 80, pse: 9 }], '2026-11-12')) marca(x.refs);
  marca(evolucao([], '2026-11-12').refs);
  const sobrando = Object.keys(REFS_CORRIDA).filter((k) => !usadas.has(k));
  // toda fonte da lista tem de ser citada em algum texto que a pessoa vê
  assert.deepEqual(sobrando, [], 'referências sem uso');
});

// ---------- análise do treino feito: propriedades em pares sorteados e em cenários vividos dia a dia ----------
test('estresse: análise do treino feito — selo coerente, excesso nunca tranquilizado, correr a mais nunca aumenta o plano', () => {
  const F = coletor();
  const r = semente(909);
  const inicio = '2026-09-07';
  const reg = (id, data, tipo, distKm, durMin, pse) => ({ id, data, tipo, distKm, durMin, pse, dores: [], nota: '', planejado: '' });
  const corr = (d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso';
  const estado = (a) => ({ run: limparCorrida({ answers: a, aceitoEm: inicio + 'T12:00:00.000Z', inicio }), runs: [], dores: [], plans: [], activePlan: '' });
  // 1) pares planejado × feito sorteados
  const tipos = ['leve', 'longo', 'regenerativo', 'fartlek', 'tempo', 'intervalado', 'tiros', 'progressivo', 'ritmo', 'corrida_caminhada', 'prova', 'teste', 'caminhada', 'descanso'];
  const st = estado(base);
  for (let i = 0; i < 30000; i++) {
    const tipo = um(r, tipos), un = um(r, ['t', 'd']);
    const pse0 = inteiro(r, 1, 8);
    const plan = { tipo, durMin: um(r, [0, 20, 30, 45, 60, 90, 150]), distKm: um(r, [0, 3, 5, 8, 12, 21.1]), un, ritmo: r() < 0.5 ? [330 + inteiro(r, 0, 60), 400 + inteiro(r, 0, 80)] : null, pse: r() < 0.9 ? [pse0, Math.min(10, pse0 + inteiro(r, 0, 2))] : null };
    const fq = um(r, [0.3, 0.7, 0.95, 1, 1.1, 1.3, 1.7, 2, 3.2]);
    const feito = reg('q', somaDias(inicio, 40), um(r, [tipo === 'descanso' ? 'leve' : tipo, 'leve', 'livre', 'intervalado', 'caminhada']), r() < 0.8 ? Math.round(plan.distKm * fq * 10) / 10 : 0, r() < 0.8 ? Math.round(plan.durMin * fq) : 0, r() < 0.8 ? inteiro(r, 1, 10) : null);
    if (!feito.distKm && !feito.durMin) continue;
    const hist = r() < 0.5 ? [reg('h', somaDias(inicio, 30), 'leve', um(r, [3, 6, 10, 18]), um(r, [20, 40, 65, 110]), 3)] : [];
    let a;
    try { a = analiseDoRegistro({ ...st, runs: hist }, somaDias(inicio, 40), { ...feito, plan }); } catch (e) { F.add('erro na análise', e.message); continue; }
    if (!a) continue;
    const rot = JSON.stringify({ plan, feito, hist: hist.length, selo: a.selo, itens: a.itens.map((x) => x.tom + ':' + x.texto.slice(0, 50)) }).slice(0, 600);
    if (!['dentro', 'acima', 'abaixo', 'livre', 'sem'].includes(a.selo) || !a.titulo || !a.itens.length || !a.plano || a.refs.some((k) => !REFS_CORRIDA[k])) F.add('análise malformada', rot);
    if (a.selo === 'dentro' && (a.itens.some((x) => x.tom === 'warn') || a.plano !== 'Nada muda no plano.')) F.add('“Dentro do plano” com alerta ou com mudança no plano', rot);
    if (a.selo !== 'livre' && a.itens.some((x) => x.tom === 'warn') && a.selo !== 'acima') F.add('alerta sem selo “Acima do plano”', rot);
    if (a.selo === 'dentro' && a.itens.some((x) => /mais rápido que a faixa|a mais que|a menos que|bem acima|ficou menor|não foi completada/.test(x.texto))) F.add('“Dentro do plano” com desvio no texto', rot);
    // excesso de 60% ou mais sobre o planejado e sobre o histórico nunca recebe "não é um salto"
    const f = plan.un === 't' ? feito.durMin : feito.distKm, p = plan.un === 't' ? plan.durMin : plan.distKm, h = hist.length ? (plan.un === 't' ? hist[0].durMin : hist[0].distKm) : 0;
    if (p > 0 && f >= p * 1.6 && f > h * 1.15 && feito.tipo !== 'caminhada' && tipo !== 'prova' && tipo !== 'teste' && tipo !== 'descanso' && a.itens.some((x) => x.tom === 'ok' && /salto|acréscimo/.test(x.texto))) F.add('excesso grande tranquilizado', rot);
    // plano por tempo e registro sem tempo (ou por distância sem distância): nada de excesso por estimativa
    if (!f && /a mais que o planejado|a menos que o planejado/.test(a.itens.map((x) => x.texto).join(' '))) F.add('comparação por estimativa, fora da unidade do plano', rot);
    if (plan.un === 'd' && a.itens.some((x) => /Duração dentro/.test(x.texto))) F.add('texto de duração em treino por distância', rot);
  }
  // 2) cenários vividos: plano cortado por semanas fracas, depois uma semana com o mostrado ou com excesso
  const viver = (s0, de, ate, fator) => {
    let s = s0;
    for (let k = 0; somaDias(de, k) < ate; k++) {
      const hoje = somaDias(de, k);
      const g = guardarDoDia(s, hoje);
      if (g) s = { ...s, run: { ...s.run, ...g } };
      const t = treinoDoDia(s, hoje, hoje);
      if (t && corr(t)) s = { ...s, runs: [...s.runs, { ...reg('v' + hoje, hoje, t.tipo, Math.round(t.distKm * fator * 10) / 10, Math.round(t.durMin * fator), 3), plan: planejadoDe(t) }] };
    }
    const g = guardarDoDia(s, ate);
    return g ? { ...s, run: { ...s.run, ...g } } : s;
  };
  let cenarios = 0;
  for (let i = 0; i < 300 && cenarios < 25; i++) {
    const a = respostas(r, { condicoes: ['nenhuma'], triagem: ['nenhum'], idade: um(r, [24, 38, 47]), experiencia: um(r, ['iniciante', 'regular', 'avancado']) });
    if (a.objetivo === 'prova') a.semanasProva = 16;
    const p = gerarPlano(a);
    if (!p || p.tipo !== 'geral' || p.totalSemanas < 8) continue;
    cenarios++;
    const corte = um(r, [0.5, 0.7, 1]), exc = um(r, [1.5, 2.2, 3]);
    const fraco = viver(estado(a), inicio, somaDias(inicio, 21), corte);
    const exato = viver(fraco, somaDias(inicio, 21), somaDias(inicio, 28), 1), excesso = viver(fraco, somaDias(inicio, 21), somaDias(inicio, 28), exc);
    for (const k of [4, 5]) {
      const hoje = somaDias(inicio, k * 7);
      const pe = planoAtual(k === 4 ? exato : viver(exato, somaDias(inicio, 28), hoje, 1), hoje), px = planoAtual(k === 4 ? excesso : viver(excesso, somaDias(inicio, 28), hoje, 1), hoje);
      const lg = (q) => Math.max(0, ...q.semanas[k].dias.filter((d) => d.tipo === 'longo').map((d) => d.distKm));
      if (px.semanas[k].volumeKm > pe.semanas[k].volumeKm + 0.2 || lg(px) > lg(pe) + 0.1) F.add('correr a mais aumentou uma semana seguinte', `${a.experiencia}/${a.objetivo} corte ${corte} excesso ${exc} semana ${k + 1}: ${px.semanas[k].volumeKm} > ${pe.semanas[k].volumeKm}`);
    }
    // semana passada: o que a tela mostrou em cada dia é o que aparece depois
    const depois = somaDias(inicio, 35);
    for (const m of exato.run.mostrados.filter((x) => x.data < somaDias(inicio, 28))) {
      const t = treinoDoDia(exato, depois, m.data);
      if ((m.tipo === '') !== (t === null) || (t && (t.tipo !== m.tipo || t.distKm !== m.distKm || !t.guardado))) F.add('dia passado diferente do que a tela mostrou', m.data);
    }
  }
  assert.ok(cenarios >= 20, String(cenarios));
  assert.equal(F.m.size, 0, relatorio(F));
});

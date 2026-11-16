// Avaliação de um treino montado à mão pelo usuário (ou vindo de um modelo): o que ele treina, para que serve, o que
// falta e sobra, e se serve para o perfil da pessoa. Usa as mesmas contas e regras do Treinador (logic/trainer.js), com
// as mesmas fontes (data/knowledge.js). É um sistema de regras fixas, sem internet e sem IA. Puro: sem DOM e sem estado.
//
// Fontes das regras usadas aqui:
//  • séries por semana em cada grupo: cerca de 4 já dão resultado (ref iversen2021); 10 ou mais para ganhar massa (ref
//    schoenfeld2017vol); teto de 12, 16 ou 20 séries diretas conforme o nível (ref bazvalle2022); o músculo principal de
//    um exercício conta 1 série e o auxiliar, meia (ref pelland2026);
//  • para que o treino serve, pela faixa de repetições: até 6, força (1 a 6 repetições máximas — ref acsm2009); 15 ou
//    mais, resistência muscular; entre as duas, a faixa média, a mais prática para ganhar massa. A massa cresce numa faixa
//    ampla de cargas, a partir de cerca de 30% da carga máxima, e não há "zona ideal" de hipertrofia (ref schoenfeld2021). "Definição" não é um tipo de treino: vem de comer menos do que se gasta,
//    mantendo a musculação para preservar os músculos (déficit: ref helms2014; treino de força para limitar a perda de
//    massa magra no emagrecimento: ref oppert2021);
//  • equilíbrio: o desequilíbrio entre os músculos do ombro é um dos fatores das lesões de ombro na musculação (ref
//    bonilla2022); um programa equilibrado
//    treina os grandes grupos do corpo todo (ref oms2020); os cortes numéricos de equilíbrio são critério deste aplicativo;
//  • perfil: as regras de segurança do Treinador (trainer.js, função motivosContra) e as doses por condição — sem cargas
//    altas com pressão alta, coração, gestação ou triagem positiva (refs aha2024, acog804, whitfield2017); 8 repetições ou
//    mais com diabetes ou outra doença crônica (ref colberg2016); 10 a 15 repetições para menores de 18 (ref
//    faigenbaum2009); até 3 treinos de força por semana em dias não seguidos para menores de 18 e para quem tem diabetes
//    (refs lloyd2014, colberg2016); 1 a 3 séries por exercício para quem está começando (ref acsm2009);
//  • quem corre: treino de pernas a 24 horas ou mais da corrida forte (ref blagrove2018).
import { EX_POR_ID } from '../data/exercises.js';
import { MUSCULOS, PADROES } from '../data/muscles.js';
import { perfil, respostasCompletas, pesosDoExercicio, tetoSeries, duracaoEstimada, motivosContra, alternativas, nomeGrupo, soManual, alertaDoExercicio } from './trainer.js';
// (os motivos de motivosContra incluem as limitações da entrevista reconhecidas pela mecânica do exercício — "usa a
// região da sua limitação" — além das marcas do catálogo: o mesmo critério do plano do Treinador)

const GRANDES = ['peito', 'costas', 'ombros', 'quadriceps', 'posteriores', 'gluteos'];
const GRUPOS_AV = [...GRANDES, 'biceps', 'triceps', 'panturrilhas', 'abdomen'];
const G_PERNA = ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas', 'adutores'];
const MINIMO = 4, BOM = 10;
const DIAS_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const num = (v) => String(Math.round(v * 2) / 2).replace('.', ',');
const lista = (x) => (Array.isArray(x) ? x : []);
const e = (l) => (l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]);
const min = (s) => s.toLowerCase();
const ehCardio = (ex) => ex.grupo === 'cardio' || ex.padrao === 'cardio';
const comCarga = (it) => !ehCardio(it.ex) && (it.ex.registro === 'peso_reps' || it.ex.registro === 'reps');
const nomePadrao = (p) => min((PADROES[p] || p).replace(/\s*\(.*\)$/, ''));

// itens bem formados de um dia: [{ ex (objeto do catálogo), series, lo, hi, descanso }]. O que não é do catálogo ou
// vem com números fora do possível é ignorado.
function itensDe(dia) {
  const out = [];
  for (const it of lista(dia && dia.itens).slice(0, 60)) {
    const ex = it && typeof it.ex === 'string' ? EX_POR_ID.get(it.ex) : null;
    const series = it ? Math.round(Number(it.series)) : NaN;
    if (!ex || !(series >= 1 && series <= 30)) continue;
    const m = typeof it.reps === 'string' ? /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(it.reps) : null;
    const lo = m ? Number(m[1]) : 10, hi = m && m[2] ? Number(m[2]) : lo;
    const descanso = Number.isFinite(Number(it.descanso)) ? Math.min(900, Math.max(0, Number(it.descanso))) : 60;
    out.push({ ex, series, lo, hi: Math.max(lo, hi), descanso, bruto: { ex: ex.id, series, reps: m ? it.reps : '10', descanso } });
  }
  return out;
}
// séries por grupo: total (principal = 1, auxiliar = 0,5) e diretas (só como principal)
function contar(listas) {
  const vol = {}, dir = {};
  for (const itens of listas) for (const it of itens) {
    if (ehCardio(it.ex)) continue;
    const w = pesosDoExercicio(it.ex);
    for (const g in w) { vol[g] = (vol[g] || 0) + it.series * w[g]; if (w[g] === 1) dir[g] = (dir[g] || 0) + it.series; }
  }
  for (const g in vol) vol[g] = Math.round(vol[g] * 2) / 2;
  return { vol, dir };
}
// para que o treino serve, pela faixa de repetições (pesada pelas séries)
function tipoDoTreino(itens) {
  const cont = { forca: 0, hipertrofia: 0, resistencia: 0 };
  let total = 0, descansoForca = 0;
  for (const it of itens) {
    if (!comCarga(it)) continue;
    const c = it.hi <= 6 ? 'forca' : it.lo >= 15 ? 'resistencia' : 'hipertrofia';
    cont[c] += it.series; total += it.series;
    if (c === 'forca') descansoForca += it.series * it.descanso;
  }
  if (!total) return { id: '', texto: '', series: cont };
  const id = ['forca', 'hipertrofia', 'resistencia'].find((k) => cont[k] >= total * 0.6) || 'misto';
  const curto = id === 'forca' && descansoForca / cont.forca < 120;
  const texto = {
    forca: 'Força: poucas repetições com carga alta.' + (curto ? ' Para isso, descanse de 2 a 3 minutos entre as séries.' : ''),
    hipertrofia: 'Ganho de massa: faixa média de repetições, perto do limite. Outras faixas também dão massa; esta é a mais prática.',
    resistencia: 'Resistência muscular: muitas repetições com carga leve.',
    misto: 'Misto: junta séries pesadas, médias e leves.',
  }[id];
  return { id, texto, series: cont };
}
const NOME_TIPO = { forca: 'força', hipertrofia: 'ganho de massa', resistencia: 'resistência muscular', misto: 'cargas variadas' };
const DEFINICAO = 'Definição não é um tipo de treino: vem de comer menos do que se gasta, mantendo a musculação para preservar os músculos.';

// contexto → perfil e o que mais a avaliação usa. Sem respostas completas do Treinador, perfil = null.
function contextoDe(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  let pf = null;
  try { pf = c.respostas && typeof c.respostas === 'object' && respostasCompletas(c.respostas) ? perfil(c.respostas) : null; } catch { pf = null; }
  return { pf: pf && !pf.bloqueado ? pf : null, bloqueado: !!(pf && pf.bloqueado), gym: c.gym, dores: lista(c.dores), corrida: c.corrida && typeof c.corrida === 'object' ? c.corrida : null };
}
// motivos contra um exercício: com perfil, as regras do Treinador; sem perfil, só o que vale para qualquer pessoa
// (exercícios que pedem supervisão e as dores contadas)
function motivosDe(ex, c) {
  if (c.pf) return motivosContra(ex, c.pf, c.gym, c.dores);
  const out = [];
  if (soManual(ex.id)) out.push({ id: 'manual', texto: 'o Treinador não indica este exercício sem supervisão', grave: true });
  else if (ex.grupo === 'funcional' && !ehCardio(ex)) out.push({ id: 'potencia', texto: 'exercício de potência ou de técnica avançada: pede domínio do movimento e supervisão', grave: false });
  let al = null;
  try { al = c.dores.length ? alertaDoExercicio(ex.id, c.dores, null) : null; } catch { al = null; }
  if (al) out.push(al.nivel === 'evitar' ? { id: 'dor', texto: 'carrega a região da dor que você contou: deixe de fora até melhorar', grave: true } : { id: 'dor-leve', texto: 'pega a região da dor que você contou: faça mais leve', grave: false });
  return out;
}
// dose do treino × perfil: o que as diretrizes pedem para a condição da pessoa
// (`grave` = dose que a diretriz da condição não permite: o veredito passa a "não recomendado")
function dosePorPerfil(itens, pf) {
  const out = [];
  if (!pf) return out;
  const carga = itens.filter((it) => it.ex.registro === 'peso_reps' && !ehCardio(it.ex));
  const menorQue = (n) => carga.some((it) => it.lo < n);
  if (pf.liberacao) out.push({ grave: false, texto: 'Pelas suas respostas de saúde, peça liberação médica antes de começar ou de aumentar a carga.' });
  if (pf.cautela && menorQue(10)) out.push({ grave: true, texto: `${pf.gestante ? 'Na gestação' : pf.pressao ? 'Com pressão alta ou problema no coração' : 'Até ter liberação médica'}, evite cargas altas: use 10 repetições ou mais, sem prender a respiração.` });
  else if (pf.moderado && menorQue(8)) out.push({ grave: true, texto: 'Com diabetes ou outra doença crônica, fique em 8 repetições ou mais, a não ser com liberação médica.' });
  else if (pf.jovem && menorQue(10)) out.push({ grave: true, texto: 'Antes dos 18 anos, o indicado são cargas moderadas, de 10 a 15 repetições, com a técnica em primeiro lugar.' });
  if (pf.nunca && itens.some((it) => comCarga(it) && it.series > 3)) out.push({ grave: false, texto: 'Para quem está começando, 1 a 3 séries por exercício bastam nas primeiras semanas.' });
  return out;
}
// o treino serve para o perfil? problemas de cada exercício, com o que trocar
// `estrutura` = o treino tem excesso, grande grupo sem treino ou desequilíbrio: o veredito é, no máximo, "serve com ajustes"
function conferirPerfil(itens, c, extras = [], estrutura = false) {
  const vistos = new Set(), problemas = [];
  for (const it of itens) {
    if (vistos.has(it.ex.id)) continue;
    vistos.add(it.ex.id);
    const motivos = motivosDe(it.ex, c);
    if (!motivos.length) continue;
    let troca = null;
    // a troca sugerida é um exercício do mesmo movimento contra o qual não há nenhum motivo; se o problema é uma regra
    // de segurança e não há alternativa limpa, vale uma que não esbarre em regra de segurança
    if (c.pf && !ehCardio(it.ex) && motivos.some((m) => m.id !== 'dor-leve')) {
      try {
        const alts = alternativas(it.ex, c.pf, c.gym).filter((x) => !itens.some((y) => y.ex.id === x.id)).map((x) => [x, motivosContra(x, c.pf, c.gym, c.dores)]);
        const limpa = alts.find((y) => !y[1].length) || (motivos.some((m) => m.grave) ? alts.find((y) => !y[1].some((m) => m.grave)) : null);
        troca = limpa ? limpa[0] : null;
      } catch { troca = null; }
    }
    problemas.push({ ex: it.ex.id, nome: it.ex.nome, motivos: motivos.map((m) => m.texto), grave: motivos.some((m) => m.grave), troca: troca ? { ex: troca.id, nome: troca.nome } : null });
  }
  const doses = [...dosePorPerfil(itens, c.pf), ...extras.map((texto) => ({ grave: false, texto }))];
  const graves = problemas.filter((p) => p.grave).length;
  // 'nao' = mais de um terço dos exercícios esbarra numa regra de segurança, ou a dose é proibida para a condição da
  // pessoa; 'ajustes' = há o que trocar, aliviar ou equilibrar; 'sim' = nada a apontar
  const veredito = !c.pf ? '' : graves * 3 > vistos.size || doses.some((d) => d.grave) ? 'nao' : problemas.length || doses.length || estrutura ? 'ajustes' : 'sim';
  return { veredito, problemas, dose: doses.map((d) => d.texto) };
}
// três ou mais exercícios do mesmo movimento para o mesmo músculo, no mesmo treino
function repetidos(itens) {
  const m = new Map();
  for (const it of itens) {
    if (ehCardio(it.ex)) continue;
    const g = (MUSCULOS[it.ex.primarios[0]] || {}).grupo || it.ex.grupo;
    const k = it.ex.padrao + '|' + g;
    if (!m.has(k)) m.set(k, { padrao: nomePadrao(it.ex.padrao), grupo: g, nomes: [] });
    if (!m.get(k).nomes.includes(it.ex.nome)) m.get(k).nomes.push(it.ex.nome);
  }
  return [...m.values()].filter((x) => x.nomes.length >= 3);
}
const ordenados = (vol) => GRUPOS_AV.filter((g) => vol[g] > 0).sort((a, b) => vol[b] - vol[a] || GRUPOS_AV.indexOf(a) - GRUPOS_AV.indexOf(b));
const vazio = (texto) => ({ vazio: true, conclusao: texto, refs: [] });
const fraseDoPerfil = (p, c, bom) => (p.veredito === 'nao' ? 'Para o seu perfil, não é recomendado como está: veja o que trocar.'
  : p.veredito === 'ajustes' ? 'Serve para você com os ajustes indicados.'
    : p.veredito === 'sim' ? bom
      : c.bloqueado ? 'Antes dos 14 anos, a musculação precisa de orientação presencial.' : 'Responda ao Treinador para saber se serve para o seu perfil.');

// Avalia um treino (um dia). `contexto`: { respostas (do Treinador), gym, dores (ativas), corrida (resumoCombinado) }.
// Devolve { vazio, foco: { grupos, texto, padroes }, mais, menos, volume, diretas, tipo: { id, texto }, definicao,
// duracaoMin, exercicios, series, sobra, repetidos, perfil: { veredito, problemas, dose }, semPerfil, conclusao, refs }.
export function avaliarDia(dia, contexto) {
  const itens = itensDe(dia);
  if (!itens.length) return vazio('Este treino ainda não tem exercícios.');
  const c = contextoDe(contexto);
  const { vol, dir } = contar([itens]);
  const ordem = ordenados(vol);
  const forca = itens.filter((it) => !ehCardio(it.ex));
  const topo = ordem.length ? vol[ordem[0]] : 0;
  const focoGrupos = ordem.filter((g) => vol[g] >= topo * 0.6).slice(0, 3);
  const padroes = [...new Set(forca.map((it) => nomePadrao(it.ex.padrao)))];
  const tipo = tipoDoTreino(itens);
  const duracao = duracaoEstimada({ itens: itens.map((it) => it.bruto) });
  const item = (g) => ({ g, nome: nomeGrupo(g), series: vol[g] });
  const mais = ordem.length ? item(ordem[0]) : null;
  const menos = ordem.length > 1 ? item(ordem[ordem.length - 1]) : null;
  const teto = c.pf ? tetoSeries(c.pf.nivel) : 20;
  // muito de um músculo num treino só: mais séries diretas do que o teto de uma semana inteira
  const sobra = GRUPOS_AV.filter((g) => (dir[g] || 0) > teto).map((g) => ({ g, nome: nomeGrupo(g), series: dir[g], teto }));
  const rep = repetidos(itens);
  const p = conferirPerfil(itens, c, [], sobra.length > 0 || rep.length > 0);
  const soCardio = !forca.length;
  const focoTexto = soCardio ? 'Cardio' : focoGrupos.length ? e(focoGrupos.map(nomeGrupo)) : 'Sem grupo muscular principal';
  const partes = [soCardio ? `Treino de cardio, com cerca de ${duracao} min.` : `Treino de ${min(focoTexto)}${tipo.id ? ', de ' + NOME_TIPO[tipo.id] : ''}, com cerca de ${duracao} min.`];
  if (sobra.length) partes.push(`Tem séries demais de ${min(e(sobra.map((x) => x.nome)))} para um treino só.`);
  if (!sobra.length || p.veredito === 'nao') partes.push(fraseDoPerfil(p, c, 'Serve para o seu perfil.'));
  return {
    vazio: false, foco: { grupos: focoGrupos, texto: focoTexto, padroes }, mais, menos, volume: vol, diretas: dir, tipo, definicao: DEFINICAO,
    duracaoMin: duracao, exercicios: itens.length, series: itens.reduce((t, it) => t + it.series, 0), sobra, repetidos: rep, perfil: p, semPerfil: !c.pf,
    conclusao: partes.join(' '), refs: ['iversen2021', 'bazvalle2022', 'pelland2026', 'acsm2009', 'schoenfeld2021', 'helms2014', 'oppert2021'],
  };
}

// Avalia o plano inteiro, pela semana da agenda (um treino que aparece em dois dias conta duas vezes).
// Devolve { vazio, treinos, grupos: [{ g, nome, series, diretas, faixa: 'nada'|'pouco'|'ok'|'bom'|'muito' }], mais, menos,
// volume, diretas, teto, tipo, definicao, equilibrio: [{ id, texto }], falta, sobra, duracaoMin: { menor, maior },
// corrida: [{ wd, texto }], perfil: { veredito, problemas, dose }, semPerfil, conclusao, refs }.
export function avaliarPlano(plano, contexto) {
  const dias = lista(plano && plano.dias).filter((d) => d && typeof d === 'object').slice(0, 14);
  const porId = new Map(dias.map((d) => [d.id, d]));
  const agenda = plano && plano.agenda && typeof plano.agenda === 'object' ? plano.agenda : {};
  let semana = [];
  for (let wd = 0; wd < 7; wd++) { const d = porId.get(agenda[wd]); if (d) semana.push({ wd, itens: itensDe(d) }); }
  // sem agenda: cada treino conta uma vez por semana
  if (!semana.length) semana = dias.map((d) => ({ wd: null, itens: itensDe(d) }));
  semana = semana.filter((x) => x.itens.length);
  if (!semana.length) return vazio('Este plano ainda não tem exercícios.');
  const c = contextoDe(contexto);
  const { vol, dir } = contar(semana.map((x) => x.itens));
  const todos = semana.flatMap((x) => x.itens);
  const teto = c.pf ? tetoSeries(c.pf.nivel) : 20;
  const v = (g) => vol[g] || 0;
  const grupos = GRUPOS_AV.map((g) => ({ g, nome: nomeGrupo(g), series: v(g), diretas: dir[g] || 0, faixa: (dir[g] || 0) > teto ? 'muito' : !v(g) ? 'nada' : v(g) < MINIMO ? 'pouco' : v(g) < BOM ? 'ok' : 'bom' }));
  const ordem = ordenados(vol);
  const mais = ordem.length ? { g: ordem[0], nome: nomeGrupo(ordem[0]), series: v(ordem[0]) } : null;
  const fraco = grupos.filter((x) => GRANDES.includes(x.g)).sort((a, b) => a.series - b.series)[0];
  const menos = { g: fraco.g, nome: fraco.nome, series: fraco.series };
  const soCardio = todos.every((it) => ehCardio(it.ex));
  const falta = soCardio ? [] : grupos.filter((x) => GRANDES.includes(x.g) && x.series < MINIMO).map((x) => ({ g: x.g, nome: x.nome, series: x.series }));
  const sobra = grupos.filter((x) => x.faixa === 'muito').map((x) => ({ g: x.g, nome: x.nome, series: x.diretas, teto }));
  // equilíbrio entre os lados do corpo
  const equilibrio = [];
  if (v('peito') >= 6 && v('costas') < v('peito') * 0.67) equilibrio.push({ id: 'empurra-puxa', texto: `Empurra mais do que puxa: ${num(v('peito'))} séries de peito e ${num(v('costas'))} de costas. Inclua remadas ou puxadas.` });
  if (v('costas') >= 6 && v('peito') < v('costas') * 0.5) equilibrio.push({ id: 'puxa-empurra', texto: `Puxa bem mais do que empurra: ${num(v('costas'))} séries de costas e ${num(v('peito'))} de peito.` });
  if (v('quadriceps') >= 6 && v('posteriores') + v('gluteos') * 0.5 < v('quadriceps') * 0.5) equilibrio.push({ id: 'frente-tras', texto: `Muita frente de coxa e pouca parte de trás: ${num(v('quadriceps'))} séries de quadríceps e ${num(v('posteriores'))} de posteriores.` });
  const sup = v('peito') + v('costas') + v('ombros'), inf = v('quadriceps') + v('posteriores') + v('gluteos');
  if (sup >= 12 && inf < sup * 0.25) equilibrio.push({ id: 'sem-pernas', texto: `Quase só a parte de cima: ${num(sup)} séries de peito, costas e ombros e ${num(inf)} de pernas e glúteos.` });
  if (inf >= 12 && sup < inf * 0.25) equilibrio.push({ id: 'sem-superiores', texto: `Quase só pernas: ${num(inf)} séries de pernas e glúteos e ${num(sup)} de peito, costas e ombros.` });
  const tipo = tipoDoTreino(todos);
  const duracoes = semana.map((x) => duracaoEstimada({ itens: x.itens.map((it) => it.bruto) }));
  // perfil × semana: dias de força para menores de 18 e diabetes
  const extras = [];
  if (c.pf && (c.pf.jovem || c.pf.diabetes)) {
    // dia de força = tem exercício que não é cardio nem só abdômen (um dia de cardio com abdominais não conta)
    const forca = semana.filter((x) => x.itens.some((it) => !ehCardio(it.ex) && it.ex.grupo !== 'abdomen'));
    const wds = forca.map((x) => x.wd).filter((w) => w != null);
    const seguidos = wds.some((w) => wds.includes((w + 1) % 7));
    if (forca.length > 3 || seguidos) extras.push(`${c.pf.jovem ? 'Antes dos 18 anos' : 'Com diabetes'}, o indicado são até 3 treinos de força por semana, em dias não seguidos.`);
  }
  // quem corre: treino de pernas na véspera de corrida forte ou do longo (de qualquer semana do plano de corrida)
  const corrida = [];
  if (c.corrida) {
    const chave = new Set([...lista(c.corrida.fortes), ...lista(c.corrida.longos)].filter(Number.isInteger));
    if (Number.isInteger(c.corrida.longo)) chave.add(c.corrida.longo);
    for (const x of semana) {
      if (x.wd == null || !chave.has((x.wd + 1) % 7)) continue;
      if (x.itens.filter((it) => G_PERNA.includes(it.ex.grupo)).length >= 2) corrida.push({ wd: x.wd, texto: `Treino de pernas na ${DIAS_NOME[x.wd]}, véspera de corrida forte ou do longo: troque de dia ou faça mais leve.` });
    }
    // corrida e musculação tomando os 7 dias da semana
    const ocupados = new Set([...lista(c.corrida.dias).filter(Number.isInteger), ...semana.map((x) => x.wd).filter((w) => w != null)]);
    if (ocupados.size >= 7) corrida.push({ wd: null, texto: 'Somando a corrida, a semana fica sem nenhum dia de descanso: junte a musculação a uma corrida leve ou tire um treino.' });
  }
  const p = conferirPerfil(todos, c, extras, sobra.length > 0 || falta.length > 0 || equilibrio.length > 0 || corrida.length > 0);
  const partes = [`Plano de ${soCardio ? 'cardio' : NOME_TIPO[tipo.id] || 'exercícios variados'}, com ${semana.length} ${semana.length === 1 ? 'treino' : 'treinos'} por semana${mais ? `; o que mais trabalha é ${min(mais.nome)}` : ''}.`];
  const zerados = falta.filter((x) => !x.series), poucos = falta.filter((x) => x.series);
  if (zerados.length) partes.push(`Fica sem treino de ${min(e(zerados.map((x) => x.nome)))}.`);
  else if (poucos.length) partes.push(`Tem pouco de ${min(e(poucos.map((x) => x.nome)))}.`);
  else if (sobra.length) partes.push(`Tem séries demais de ${min(e(sobra.map((x) => x.nome)))}.`);
  else if (equilibrio.length) partes.push('Está desequilibrado: veja o equilíbrio.');
  else if (corrida.length) partes.push('Há treino em conflito com a corrida: veja o equilíbrio.');
  else partes.push(fraseDoPerfil(p, c, 'É equilibrado e serve para o seu perfil.'));
  if (partes.length === 2 && p.veredito === 'nao' && !partes[1].startsWith('Para o seu perfil')) partes.push(fraseDoPerfil(p, c, ''));
  return {
    vazio: false, treinos: semana.length, grupos, mais, menos, volume: vol, diretas: dir, teto, tipo, definicao: DEFINICAO, equilibrio, falta, sobra,
    duracaoMin: { menor: Math.min(...duracoes), maior: Math.max(...duracoes) }, corrida, perfil: p, semPerfil: !c.pf,
    conclusao: partes.join(' '), refs: ['iversen2021', 'schoenfeld2017vol', 'bazvalle2022', 'pelland2026', 'acsm2009', 'schoenfeld2021', 'bonilla2022', 'helms2014', 'oppert2021', ...(c.corrida ? ['blagrove2018'] : [])],
  };
}

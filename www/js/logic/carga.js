// Carga recomendada de cada exercício do treino. Puro: sem DOM.
//
// 1) Com histórico do exercício vale a sugestão de logic/progress.js (dupla progressão e volta de pausa), sem mudança.
// 2) Sem histórico, a carga inicial vem do perfil, só onde há estudo (data/cargas.js); nos outros casos, pelo esforço.
//
// Fontes (texto completo):
//  • acsm2009, p. 690: para novatos, "moderate loading (50-60% of 1 RM or less) be used initially as learning proper
//    form"; de novato a intermediário, 60-70% de 1RM para 8 a 12 repetições → 50% (nível 1) e 60% (nível 2 ou mais).
//  • acsm2026: esforço suficiente é "near-failure" ou "a target of 2-3 repetitions in reserve (RIR)" → o ajuste mira 2 a
//    3 repetições sobrando. helms2016: novatos não devem guiar a carga SÓ pela reserva estimada → a 1ª série é teste e
//    o ajuste é pelas repetições feitas (faigenbaum2009: "first establish the repetition range and then by trial and
//    error determine the maximum load").
//  • fragala2019 (NSCA, idosos): começar com "lower relative resistance for beginners", de 40% (muito leve) para 50, 60
//    e 70%; Valsalva pode elevar a pressão de forma perigosa. izquierdo2021 (ICFSR): "Start at 30–40% of 1RM".
//  • ahtiainen2016 (leg press, 287 destreinados): por kg de peso, a força cai cerca de 8% (45 a 60 anos) e 18% (mais de
//    60) frente a quem tem menos de 45 → fatores 0,9 e 0,8, usados por precaução em todos os exercícios.
//  • aha2024: "an initial intensity should correspond to 40% to 60% of 1-RM"; pressão alta controlada: intensidade
//    baixa a moderada → 40%. chen2023 (consenso de reabilitação depois do infarto, Tabela 5): começar com 30-40% de 1RM
//    nos membros superiores → 30% com doença do coração (todos os exercícios com número são de tronco e braços).
//  • lloyd2014 e faigenbaum2009 (jovens): 1 ou 2 séries de 10 a 15 repetições com carga leve, achada por tentativa →
//    menores de 18 anos ficam sem número. mottola2018 (gestação): treino de força, sem número de carga → sem número.
//  • glass2004: na máquina, iniciantes escolheram sozinhos menos de 60% de 1RM, e o kg das placas não se compara entre
//    aparelhos → máquinas, cabos e Smith ficam sem número.
import { EX_POR_ID } from '../data/exercises.js';
import { FORCA_INICIANTE, BARRA_KG } from '../data/cargas.js';
import { historico, sugestao, retomada, parseReps, assistido } from './progress.js';
import { perfil, carregaRegiao, respostasParaAvisos, alertaDoExercicio, doresDoTreino } from './trainer.js';

const pos = (n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
const kgTxt = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const pct = (x) => Math.round(x * 100);
// %1RM de uma série de `reps` com 3 sobrando (Epley, como em progress.js): teto para alvos de muitas repetições
const pctComReserva = (reps) => 1 / (1 + (Math.max(1, reps) + 3) / 30);
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// arredonda PARA BAIXO até o que existe na academia: barra olímpica + anilhas de 1 kg de cada lado (passo de 2 kg no
// total); halteres de 1 em 1 kg até 10 kg e de 2 em 2 kg acima. Abaixo do mínimo: null.
export function arredondar(kg, equip) {
  if (!(pos(kg) > 0)) return null;
  if (equip === 'barra') return kg < BARRA_KG ? null : BARRA_KG + Math.floor((kg - BARRA_KG) / 2 + 1e-9) * 2;
  if (kg < 1) return null;
  return kg <= 10 ? Math.floor(kg + 1e-9) : Math.floor(kg / 2 + 1e-9) * 2;
}

// Fração da força máxima estimada para começar, pelo perfil (o menor valor entre os que se aplicam).
export function fracaoDoPerfil(pf) {
  const motivos = [];
  let f = pf.nivel >= 2 ? 0.6 : 0.5;
  const baixa = (v, txt, refs) => { if (v < f) f = v; motivos.push({ txt, refs }); };
  if (pf.retorno >= 1 && pf.nivel >= 2) baixa(0.5, 'Volta de pausa: começo de iniciante.', ['caterisano2019', 'acsm2009']);
  if (pf.moderado) baixa(0.5, 'Com doença crônica, a carga fica moderada.', ['whitfield2017', 'acsm2009']);
  if (pf.pressao || pf.liberacao) baixa(0.4, 'Pressão alta, ou triagem que pede cuidado: começo em 40% da força máxima.', ['aha2024']);
  if (pf.idoso) baixa(pf.inativo ? 0.3 : 0.4, `Com 60 anos ou mais, começo em ${pf.inativo ? 30 : 40}% da força máxima, sem ir até a falha.`, ['fragala2019', 'izquierdo2021']);
  if (pf.condicoes.includes('cardiaco')) baixa(0.3, 'Doença do coração: começo em 30% da força máxima nos exercícios de tronco e braços.', ['chen2023']);
  return { f, motivos };
}
export const fatorIdade = (idade) => (idade >= 60 ? 0.8 : idade >= 45 ? 0.9 : 1);

const AJUSTE = (lo, hi) => `Faça a 1ª série e conte quantas repetições ainda sobrariam. Sobraram mais de 3: aumente na próxima. Não chegou a ${lo}: diminua. O ponto certo é fazer ${lo === hi ? lo : `de ${lo} a ${hi}`} com 2 a 3 sobrando. Ao marcar a 1ª série, o app pergunta como foi e ajusta as próximas.`;
const RESPIRAR = 'Solte o ar ao fazer força e não prenda a respiração: prender (Valsalva) sobe muito a pressão.';
// fontes do ajuste pela 1ª série (vão depois das fontes da estimativa e dos cuidados)
// steele2017: quem está começando acha que sobram menos repetições do que sobram (o teste guiado da 1ª série: logic/guiado.js)
const REFS_AJUSTE = ['acsm2026', 'helms2016', 'steele2017'];

// Limitação da entrevista que pega o exercício: marcada no catálogo (cuidado) ou pela mecânica (região que ele carrega).
export const limitacaoNoExercicio = (ex, pf) => !!ex && !!pf && (pf.limitacoes.some((l) => ex.cuidado.includes(l)) || pf.regioesLim.some((r) => carregaRegiao(ex, r)));

// Carga inicial pelo perfil, para quem não tem histórico do exercício.
// ctx: { respostas (do Treinador, já com a proteção das outras entrevistas), sexo ('m' | 'f' | outro), dor (aviso de
// alertaDoExercicio ou null) }. Devolve { origem, kg, linha, porque: [textos], refs: [chaves de REFS], estimativa }.
//   origem: 'perfil' (kg estimado) | 'esforco' (sem número) | 'reps' | 'tempo'
export function cargaInicial(exId, alvoReps, ctx = {}) {
  const ex = EX_POR_ID.get(exId);
  const [lo, hi] = parseReps(alvoReps);
  const faixa = lo === hi ? String(lo) : `${lo} a ${hi}`;
  const out = (o) => ({ origem: 'esforco', kg: null, estimativa: null, porque: [], refs: [], ...o });
  if (!ex) return out({ linha: '' });
  if (ex.registro === 'segundos' || ex.registro === 'minutos') {
    const un = ex.registro === 'minutos' ? 'min' : 's';
    return out({ origem: 'tempo', linha: `Primeira vez: ${lo} ${un} em ritmo leve`, porque: ['Comece no tempo do plano, num ritmo que dê para conversar. Se foi tranquilo, aumente um pouco na próxima vez.'] });
  }
  if (ex.registro === 'reps') {
    return out({ origem: 'reps', linha: `Primeira vez: ${faixa} repetições`, porque: [`Exercício com o peso do corpo (ou elástico): não há carga em kg. Faça ${faixa} repetições com boa técnica. Ficou fácil, faça mais repetições ou passe para uma variação mais difícil; ficou difícil, use uma variação mais fácil.`], refs: ['acsm2009'] });
  }
  const respostas = ctx.respostas && typeof ctx.respostas === 'object' ? ctx.respostas : null;
  const pf = respostas ? perfil(respostas) : null;
  const porque = [];
  const refs = [];
  const cuidados = [];
  const respiracao = pf && (pf.pressao || pf.gestante || pf.liberacao);
  const fechar = (o) => {
    if (respiracao) { cuidados.push(RESPIRAR); refs.push('fragala2019'); }
    return out({ ...o, porque: [...porque, ...cuidados], refs: [...new Set([...refs, ...REFS_AJUSTE])] });
  };
  if (assistido(exId)) {
    porque.push(`Na máquina com ajuda, o número é a ajuda: mais kg deixa o exercício mais fácil. Escolha a ajuda em que você faz ${faixa} repetições e ainda sobrariam 2 a 3.`);
    return fechar({ linha: 'Primeira vez: ajuda com 2 a 3 de sobra' });
  }
  // linhas curtas: cabem numa linha da tela de 360 px ao lado do "Por quê?"
  const linhaEsforco = 'Primeira vez: carga com 2 a 3 de sobra';
  porque.push(AJUSTE(lo, hi));
  // dor contada ao Treinador ou limitação da entrevista que pega o exercício: segue o Treinador (menos carga, só a
  // amplitude sem dor), sem número
  const lim = !!pf && limitacaoNoExercicio(ex, pf);
  if (ctx.dor || lim) {
    porque.unshift('Este exercício usa uma região com dor ou limitação: comece mais leve que o normal e use só a amplitude sem dor. Siga o aviso do Treinador.');
    refs.push('silbernagel2007', 'smith2017');
    return fechar({ linha: 'Primeira vez: leve e sem dor' });
  }
  const dado = tem(FORCA_INICIANTE, exId) ? FORCA_INICIANTE[exId] : null;
  if (!dado) {
    const maquina = ex.modalidade === 'maquina' || ex.modalidade === 'cabo' || ex.modalidade === 'smith';
    porque.unshift(maquina
      ? 'Não há estudo que dê um peso de partida confiável para este aparelho: o número das placas não se compara entre aparelhos e marcas. Comece leve e ajuste pelo esforço.'
      : 'Não há estudo com iniciantes que dê um peso de partida confiável para este exercício. Comece leve, cuidando da técnica, e ajuste pelo esforço.');
    refs.push(maquina ? 'glass2004' : 'acsm2009');
    return fechar({ linha: linhaEsforco });
  }
  // sem perfil, ou perfil em que as diretrizes não dão número
  const semNumero = (txt, r) => { porque.unshift(txt); refs.push(...r); return fechar({ linha: linhaEsforco }); };
  if (!pf) return semNumero('Responda à entrevista do Treinador para o app estimar uma carga de partida pelo seu perfil.', []);
  if (pf.jovem) return semNumero('Menos de 18 anos: carga leve, de 10 a 15 repetições, achada por tentativa. Os estudos não dão um peso de partida para essa idade.', ['faigenbaum2009', 'lloyd2014']);
  if (pf.bloqueado) return semNumero('Sem a liberação para treinar, o app não estima carga.', ['parq2023']);
  if (pf.gestante) return semNumero('Na gestação, as diretrizes não dão um número de carga: vá pelo esforço.', ['mottola2018']);
  if (pf.posparto) return semNumero('Depois do parto, as diretrizes não dão um número de carga: vá pelo esforço, com a liberação do profissional de saúde.', ['parq2023']);
  const peso = pos(respostas.peso);
  if (!peso) return semNumero('Informe o seu peso na entrevista do Treinador para o app estimar uma carga de partida.', []);
  const sexo = ctx.sexo === 'm' ? 'm' : ctx.sexo === 'f' ? 'f' : '';
  const grupo = sexo === 'm' ? dado.h : dado.m;   // sexo não informado: o grupo das mulheres, que é o mais leve
  if (!grupo) return semNumero(`O estudo deste exercício só mediu homens${sexo ? '' : ' e o seu sexo não foi informado (na Nutrição)'}: sem um peso de partida confiável, vá pelo esforço.`, [dado.fonte]);
  // força máxima estimada, do lado conservador: média menos um desvio-padrão, por kg do grupo estudado; o peso usado vai até
  // o maior peso típico do estudo (média + 2 desvios), para não extrapolar
  const pesoConta = Math.min(peso, grupo.peso + 2 * grupo.dpPeso);
  const fi = fatorIdade(pf.idade);
  const rm = ((grupo.rm - grupo.dp) / grupo.peso) * pesoConta * fi;
  const { f, motivos } = fracaoDoPerfil(pf);
  const fr = Math.min(f, pctComReserva(hi));
  const bruto = rm * fr;
  const kg = arredondar(bruto, dado.equip);
  refs.push(dado.fonte, 'acsm2009');
  if (fi < 1) refs.push('ahtiainen2016');
  for (const m of motivos) { cuidados.push(m.txt); refs.push(...m.refs); }
  const quem = `${sexo === 'm' ? 'homens' : 'mulheres'} que estão começando${sexo ? '' : ' (sem o sexo informado na Nutrição, o app usa as mulheres, mais leves)'}`;
  const conta = `Estimativa: cerca de ${pct(fr)}% da força máxima de ${quem}, com o seu peso${fi < 1 ? ' e a sua idade' : ''}. A força varia muito de uma pessoa para outra, por isso a conta fica do lado leve.`;
  if (kg == null) {
    porque.unshift(dado.equip === 'barra'
      ? `${conta} Deu cerca de ${kgTxt(bruto)} kg, menos que a barra olímpica (${BARRA_KG} kg): use a barra só se fizer as repetições com folga; senão, prefira uma barra mais leve, halteres ou máquina.`
      : `${conta} Deu menos que o halter mais leve (1 kg): comece com ele só se fizer as repetições com folga.`);
    return fechar({ linha: linhaEsforco, estimativa: Math.round(bruto * 10) / 10 });
  }
  porque.unshift(`${conta} ${dado.equip === 'barra' ? `Carga total, contando a barra (${BARRA_KG} kg).` : 'Peso de cada halter.'}`);
  return fechar({ origem: 'perfil', kg, estimativa: Math.round(bruto * 10) / 10, linha: 'Estimativa pelo perfil · 1ª série é teste' });
}

// o exercício já tem registro que a sugestão por histórico usa? (as mesmas condições de sugestao())
export function temRegistro(exId) {
  const ex = EX_POR_ID.get(exId);
  const last = ex ? historico(exId, 1)[0] : null;
  if (!last) return false;
  const campo = ex.registro === 'segundos' || ex.registro === 'minutos' ? 'seg' : 'reps';
  return last.sets.some((s) => pos(s[campo]) > 0);
}

// linha curta da sugestão por histórico
function linhaDoHistorico(ex, sug) {
  const last = historico(ex.id, 1)[0];
  if (sug.pausaDias) return 'Volta da pausa: hoje mais leve';
  if (typeof sug.texto === 'string' && sug.texto.startsWith('Retomada')) return 'Retomada: subindo à carga de antes';
  if (!last) return '';
  if (ex.registro === 'segundos' || ex.registro === 'minutos') return `Última vez: ${Math.max(0, ...last.sets.map((s) => pos(s.seg)))} ${ex.registro === 'minutos' ? 'min' : 's'}`;
  if (ex.registro === 'reps') { const r = Math.max(0, ...last.sets.map((s) => pos(s.reps))); return `Última vez: ${r} ${r === 1 ? 'repetição' : 'repetições'}`; }
  // a série mais pesada (na máquina com ajuda, a de menos ajuda); no empate, a de mais repetições
  const feitas = last.sets.filter((s) => pos(s.reps) > 0);
  const ajuda = assistido(ex.id);
  const ref = feitas.reduce((a, s) => (!a || (ajuda ? pos(s.kg) < pos(a.kg) : pos(s.kg) > pos(a.kg)) || (pos(s.kg) === pos(a.kg) && pos(s.reps) > pos(a.reps)) ? s : a), null);
  if (!ref) return '';
  const base = `Última vez: ${kgTxt(pos(ref.kg))} kg × ${pos(ref.reps)}`;
  return sug.kg != null && Math.abs(pos(sug.kg) - pos(ref.kg)) > 1e-9 ? `${base} → hoje ${kgTxt(pos(sug.kg))} kg` : base;
}

// Recomendação completa para o exercício do treino: { kg, reps, seg, origem, linha, porque, refs, texto }.
// origem 'historico' quando há registro (sugestão de progress.js); senão a de cargaInicial().
export function recomendacao(exId, alvoReps, nSeries, ctx = {}, agora = Date.now()) {
  const ex = EX_POR_ID.get(exId);
  const sug = retomada(exId, sugestao(exId, alvoReps, nSeries), alvoReps, agora);
  if (!ex) return { ...sug, origem: '', linha: '', porque: [], refs: [] };
  if (temRegistro(exId)) {
    const refs = ['acsm2009'];
    if (sug.pausaDias || (typeof sug.texto === 'string' && /pausa|sem treinar|não faz este/.test(sug.texto))) refs.push('caterisano2019');
    return { ...sug, origem: 'historico', linha: linhaDoHistorico(ex, sug), porque: sug.texto ? [sug.texto] : [], refs };
  }
  const ci = cargaInicial(exId, alvoReps, ctx);
  return { ...sug, kg: ex.registro === 'peso_reps' ? ci.kg : null, origem: ci.origem, linha: ci.linha, porque: ci.porque, refs: ci.refs, estimativa: ci.estimativa };
}

// Contexto da carga inicial a partir do estado: as respostas do Treinador (com a proteção das outras entrevistas), o
// sexo informado na Nutrição e a dor que o exercício pega. É o mesmo que o treino usa (views/session.js) e o chat do
// Treinador (logic/chat/treino.js), para os dois darem sempre a mesma carga.
export function contextoDoEstado(st, exId, hoje) {
  let respostas = null, dor = null;
  try { respostas = respostasParaAvisos(st); } catch { respostas = null; }
  try { dor = alertaDoExercicio(exId, doresDoTreino(st, hoje, respostas), respostas); } catch { dor = null; }
  const n = st && st.nutri && st.nutri.answers;
  return { respostas, dor, sexo: n && typeof n.sexo === 'string' ? n.sexo : '' };
}

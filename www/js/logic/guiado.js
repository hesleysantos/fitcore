// Treino guiado: o aquecimento dentro do treino, a troca rápida quando o aparelho está ocupado e o teste da 1ª série
// (ajuste da carga das séries seguintes). Puro: sem DOM e sem o estado do app (quem chama passa o que precisa).
//
// Fontes (texto completo, lidas em novembro de 2026):
//  • iversen2021 (PMC8449772, seção do aquecimento): o aquecimento geral ("5–15 min of low-impact exercise such as
//    stationary biking") tem pouco apoio em musculação; o específico (séries leves do próprio exercício) é recomendado e,
//    para poupar tempo, pode ficar no "first exercise for each muscle group"; é mais importante com cargas altas. No estudo
//    de Ribeiro (2014) que a revisão cita, 10 min de bicicleta ou 10 repetições a 50% não mudaram as repetições de séries
//    submáximas a 80% → cardio opcional; aproximação só no 1º exercício de cada músculo.
//  • ribeiro2020 (PMC7558980, 40 homens treinados, supino e agachamento, 3 × 6 a 80% de 1RM): aquecimento com 6
//    repetições a 40% e 6 a 80% da carga de treino (1 min entre elas), só 6 a 80%, ou só 6 a 40%. A série única a 40%
//    rendeu menos ("warming-up with few repetitions and low loads is not enough"); a progressiva foi a melhor no supino e a
//    de 80% no agachamento, "less fatigue" → duas séries de 6, a 40% e a 80% da carga do dia, 1 min entre elas.
//  • izquierdo2021 (ICFSR, PMC12369211): para idosos, "the best warm-up ... is simply to do what is about to be done but
//    at a lower intensity", por exemplo uma série com carga mais leve. garber2011 (PDF): aquecimento, volta à calma e
//    progressão gradual "may reduce the risk of CVD events" (nível C) → com 60 anos ou mais, pressão alta, coração,
//    doença crônica ou triagem que pede liberação, os 5 min de cardio leve passam a recomendados.
//  • chaabene2019: alongamento parado longo antes do treino tira força (o FAQ já explica).
//  • acsm2009 (PDF da revista, p. 690 e Tabela): "a 2–10% increase in load (lower percent for small muscle mass
//    exercises, higher percent ... for large muscle mass exercises) ... when the individual can perform the current
//    workload for one to two repetitions over the desired number" → subir 5% nos isolados e 10% nos compostos.
//  • steele2017 (PMC5712461, 141 pessoas, séries até a falha em máquinas): todos subestimaram as repetições que ainda
//    fariam; os menos experientes por cerca de 4 a 5, os mais experientes por 1 a 2. helms2016 (PMC4961270): novatos
//    "likely not base training intensity or progression solely on the RIR-based scale" → as 3 respostas são simples
//    (leve demais, na medida, pesada), as repetições feitas mandam primeiro, e a resposta "pesada" de quem está começando
//    pode ser exagero, o que só deixa o ajuste do lado seguro (baixar um pouco).
import { EX_POR_ID, EXERCICIOS } from '../data/exercises.js';
import { MUSCULOS } from '../data/muscles.js';
import { EQUIPAMENTOS } from '../data/equipment.js';
import { BARRA_KG } from '../data/cargas.js';
import { perfil, alternativas, motivosContra, alertaDoExercicio } from './trainer.js';
import { arredondar, limitacaoNoExercicio } from './carga.js';
import { parseReps, assistido } from './progress.js';

const pos = (n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
const kgTxt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const perfilDe = (respostas) => (isObj(respostas) ? perfil(respostas) : null);

// ---------- grade de cargas (o que existe na academia) ----------
// barra olímpica: anilhas de 1 kg de cada lado (2 kg no total), a partir dos 20 kg da barra; halteres e kettlebell: de 1
// em 1 kg até 10 kg e de 2 em 2 kg acima (como logic/carga.js); aparelhos, cabos e o resto: o passo do − e + da tela.
const passoAparelho = (kg) => (kg < 20 ? 1 : 2.5);
function grade(ex, kg) {
  if (ex.modalidade === 'barra' && kg >= BARRA_KG) return 'barra';
  if (ex.modalidade === 'halteres' || ex.modalidade === 'kettlebell') return 'halter';
  return 'aparelho';
}
const r2 = (n) => Math.round(n * 100) / 100;
// para baixo (null = abaixo do mínimo: barra vazia, halter de 1 kg ou zero no aparelho)
function paraBaixo(ex, kg, g = grade(ex, kg)) {
  if (!(kg > 0)) return null;
  if (g === 'barra') return arredondar(kg, 'barra');
  if (g === 'halter') return arredondar(kg, 'halter');
  const p = passoAparelho(kg);
  const v = r2(Math.floor(kg / p + 1e-9) * p);
  return v > 0 ? v : null;
}
function paraCima(ex, kg, g = grade(ex, kg)) {
  if (g === 'barra') return BARRA_KG + Math.ceil((kg - BARRA_KG) / 2 - 1e-9) * 2;
  if (g === 'halter') return kg <= 10 ? Math.ceil(kg - 1e-9) : Math.ceil(kg / 2 - 1e-9) * 2;
  const p = passoAparelho(kg);
  return r2(Math.ceil(kg / p - 1e-9) * p);
}
// um degrau acima ou abaixo de `kg` na grade
function degrau(ex, kg, dir) {
  const g = grade(ex, kg);
  if (dir > 0) {
    if (g === 'barra') return paraBaixo(ex, kg, g) + 2;
    if (g === 'halter') return kg < 10 ? Math.floor(kg + 1e-9) + 1 : (Math.floor(kg / 2 + 1e-9) + 1) * 2;
    const p = passoAparelho(kg);
    return r2((Math.floor(kg / p + 1e-9) + 1) * p);
  }
  if (g === 'barra') { const v = paraCima(ex, kg, g) - 2; return v >= BARRA_KG ? v : null; }
  if (g === 'halter') { const v = kg <= 10 ? Math.ceil(kg - 1e-9) - 1 : (Math.ceil(kg / 2 - 1e-9) - 1) * 2; return v >= 1 ? v : null; }
  const p = passoAparelho(Math.max(0, kg - 1e-6));
  const v = r2((Math.ceil(kg / p - 1e-9) - 1) * p);
  return v > 0 ? v : null;
}

// ---------- 1) aquecimento ----------
// Perfis em que o aquecimento geral fica recomendado (garber2011, izquierdo2021).
export function aquecimentoRecomendado(pf) {
  return !!pf && (pf.idoso || pf.pressao || pf.liberacao || pf.moderado || pf.condicoes.includes('cardiaco'));
}
export const REFS_AQUECIMENTO = ['iversen2021', 'ribeiro2020', 'izquierdo2021', 'garber2011', 'chaabene2019'];

// O passo de aquecimento do começo do treino: { recomendado, linha, porque: [textos], refs }.
// `temCarga`: o treino tem exercício com carga (as séries de aproximação aparecem nele).
export function aquecimentoGeral(respostas, temCarga = true) {
  const pf = perfilDe(respostas);
  const rec = aquecimentoRecomendado(pf);
  const cardio = rec ? '5 min de cardio leve' : '5 min de cardio leve (opcional)';
  const linha = temCarga ? `${cardio} e séries leves no 1º exercício de cada músculo.` : `${cardio}, num ritmo que dê para conversar.`;
  const porque = [];
  if (temCarga) {
    porque.push('O que mais conta é o aquecimento específico: séries leves do próprio exercício, que preparam o músculo e ensaiam o movimento. Basta no 1º exercício de cada músculo.');
    porque.push('Nele, o app mostra 2 séries de aproximação: 6 repetições com cerca de 40% da carga do dia e 6 com cerca de 80%, com 1 minuto entre elas e bem longe da falha. Num estudo com quem já treinava, só a série leve não bastou para render nas séries seguintes.');
  }
  porque.push(rec
    ? 'Para o seu perfil (60 anos ou mais, pressão alta, coração, doença crônica ou triagem que pede liberação), faça os 5 minutos de cardio leve antes: aquecer e progredir aos poucos pode diminuir o risco de problemas do coração no exercício.'
    : 'Cardio leve antes da musculação mostrou pouca vantagem nos estudos: é opcional.');
  porque.push('Não precisa alongar parado antes: alongar cada músculo por mais de 60 segundos tira força. As séries de aproximação não contam no histórico, nos recordes, no volume nem nas calorias.');
  const refs = temCarga ? REFS_AQUECIMENTO : REFS_AQUECIMENTO.filter((k) => k !== 'ribeiro2020');
  return { recomendado: rec, linha, porque, refs };
}

// grupo muscular principal do exercício (o do 1º músculo principal)
export const grupoPrincipal = (ex) => (ex && MUSCULOS[ex.primarios[0]] ? MUSCULOS[ex.primarios[0]].grupo : ex ? ex.grupo : '');
// O item i é o 1º exercício com carga (peso_reps) do seu músculo principal neste treino? (iversen2021)
export function primeiroDoMusculo(itens, i) {
  const lista = Array.isArray(itens) ? itens : [];
  const ex = lista[i] ? EX_POR_ID.get(lista[i].ex) : null;
  if (!ex || ex.registro !== 'peso_reps') return false;
  const g = grupoPrincipal(ex);
  for (let k = 0; k < i; k++) {
    const e = lista[k] ? EX_POR_ID.get(lista[k].ex) : null;
    if (e && e.registro === 'peso_reps' && grupoPrincipal(e) === g) return false;
  }
  return true;
}

const PCT_APROX = [0.4, 0.8];
export const REPS_APROX = 6;
// Séries de aproximação de um exercício com carga: null (não há) ou { series: [{ reps, kg, txt }], nota }.
//  kgDoDia: a carga da 1ª série de hoje (a recomendada ou a que a pessoa pôs); null = sem número (as séries saem sem kg).
//  dor: aviso de alertaDoExercicio (com 'evitar', o exercício não deve ser feito: sem aproximação).
export function seriesDeAproximacao(exId, kgDoDia, dor = null) {
  const ex = EX_POR_ID.get(exId);
  if (!ex || ex.registro !== 'peso_reps') return null;
  if (dor && dor.nivel === 'evitar') return null;
  const nota = dor ? 'Só a amplitude sem dor.' : '';
  // máquina com ajuda: o número é a ajuda (mais kg = mais fácil); a conta em % não vale para ela
  if (assistido(exId)) return { series: [{ reps: REPS_APROX, kg: null, txt: `${REPS_APROX} com bem mais ajuda` }, { reps: REPS_APROX, kg: null, txt: `${REPS_APROX} com mais ajuda` }], nota };
  if (kgDoDia == null || !Number.isFinite(kgDoDia)) return { series: PCT_APROX.map((p) => ({ reps: REPS_APROX, kg: null, txt: `${REPS_APROX} com ${Math.round(p * 100)}% da carga` })), nota };
  const base = pos(kgDoDia);
  if (!base) return null; // sem peso: não há o que aliviar
  const g = grade(ex, base);
  const series = [];
  for (const p of PCT_APROX) {
    const kg = paraBaixo(ex, base * p, g);
    let s;
    if (kg == null) {
      // abaixo do mínimo: a barra vazia, sem peso (halteres) ou a menor carga do aparelho
      if (g === 'barra') s = base > BARRA_KG ? { kg: BARRA_KG, txt: `${REPS_APROX} só com a barra` } : null;
      else if (g === 'halter') s = { kg: 0, txt: `${REPS_APROX} sem peso` };
      else s = { kg: null, txt: `${REPS_APROX} com a carga mínima` };
    } else s = kg < base ? { kg, txt: `${REPS_APROX} × ${kgTxt(kg)} kg` } : null;
    if (s && !series.some((x) => x.txt === s.txt)) series.push({ reps: REPS_APROX, ...s });
  }
  return series.length ? { series, nota } : null;
}

// ---------- 2) aparelho ocupado ----------
// Aparelhos que "ficam ocupados": as máquinas, os cabos, as barras e apoios de peso do corpo, o cardio e os suportes
// (rack, Smith, Scott, romano...). Halteres, barras soltas, anilhas, bancos comuns e acessórios existem em mais de um.
const BANCOS_COMUNS = new Set(['banco_reto', 'banco_inclinado', 'banco_declinado']);
const CAT_ESTACAO = new Set(['maquinas_sup', 'maquinas_inf', 'cabos', 'corporal', 'cardio']);
const ehEstacao = (k) => !!EQUIPAMENTOS[k] && (CAT_ESTACAO.has(EQUIPAMENTOS[k].cat) || (EQUIPAMENTOS[k].cat === 'bancos' && !BANCOS_COMUNS.has(k)) || k === 'landmine');
// O que está ocupado: as estações do exercício; sem estação (peso livre), o banco; sem banco, só o próprio conjunto de
// aparelhos (a troca precisa usar outra coisa).
export function ocupados(ex) {
  const est = ex.equip.filter(ehEstacao);
  if (est.length) return est;
  return ex.equip.filter((k) => BANCOS_COMUNS.has(k));
}
const mesmoConjunto = (a, b) => [...a.equip].sort().join() === [...b.equip].sort().join();

// Até `max` exercícios do mesmo movimento e do mesmo músculo, com os aparelhos da academia (state.gym), fora os que já
// estão no treino e sem o que o aparelho ocupado usa. Segue as regras do Treinador: alternativas() (mesmo padrão de
// movimento, mesmo músculo principal, mesma forma de medir, aparelhos, limitações e saúde) e, para o cardio,
// motivosContra(); tira o que a dor de hoje manda evitar e põe por último o que pede carga mais leve.
// opc: { respostas, gym, dores, noTreino: Set|array de ids, max }. Devolve [ids].
export function aparelhoOcupado(exId, opc = {}) {
  const ex = EX_POR_ID.get(exId);
  if (!ex) return [];
  const gym = isObj(opc.gym) ? opc.gym : { all: true, has: {} };
  // "Minha academia" sem nada marcado (tem de tudo): os aparelhos que quase toda academia tem, como no Treinador
  const respostas = { ...(isObj(opc.respostas) ? opc.respostas : {}), local: gym.all === false ? 'minha' : 'completa' };
  const pf = perfil(respostas);
  const dores = Array.isArray(opc.dores) ? opc.dores : [];
  const noTreino = new Set(opc.noTreino instanceof Set ? opc.noTreino : Array.isArray(opc.noTreino) ? opc.noTreino : []);
  noTreino.add(ex.id);
  const max = Math.max(1, Math.min(6, Math.round(Number(opc.max)) || 3));
  const occ = new Set(ocupados(ex));
  const livre = (c) => !c.equip.some((k) => occ.has(k)) && !mesmoConjunto(c, ex);
  let cands;
  if (ex.padrao === 'cardio') {
    // alternativas() não troca cardio; aqui vale o mesmo filtro do Treinador para exercícios escolhidos à mão. Cardio de
    // impacto (corrida, corda, saltos: marcado para joelho e tornozelo) só entra no lugar de outro de impacto: trocar a
    // caminhada pela corda mudaria muito o esforço
    const impacto = (e) => e.cuidado.includes('joelho') && e.cuidado.includes('tornozelo');
    cands = EXERCICIOS.filter((c) => c.padrao === 'cardio' && c.registro === ex.registro && !noTreino.has(c.id) && (impacto(ex) || !impacto(c))
      && !motivosContra(c, pf, gym, dores).some((m) => m.grave || m.id === 'aparelho'));
  } else cands = alternativas(ex, pf, gym, noTreino);
  const out = [];
  for (const c of cands) {
    if (!livre(c)) continue;
    let al = null;
    try { al = dores.length ? alertaDoExercicio(c.id, dores, isObj(opc.respostas) ? opc.respostas : null) : null; } catch { al = null; }
    if (al && al.nivel === 'evitar') continue;
    out.push({ id: c.id, leve: !!al });
  }
  // os que a dor não pega vêm antes (a ordem de alternativas() é mantida dentro de cada grupo); entre os primeiros, um
  // de cada tipo de equipamento (máquina, cabo, halteres...): se um aparelho está ocupado, outro do mesmo tipo também
  // pode estar
  const ordem = [...out.filter((x) => !x.leve), ...out.filter((x) => x.leve)].map((x) => EX_POR_ID.get(x.id));
  const escolha = [];
  const tipos = new Set();
  for (const c of ordem) if (escolha.length < max && !tipos.has(c.modalidade)) { escolha.push(c); tipos.add(c.modalidade); }
  for (const c of ordem) if (escolha.length < max && !escolha.includes(c)) escolha.push(c);
  return escolha.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)).map((c) => c.id);
}

// ---------- 3) teste da 1ª série ----------
// A carga pode subir no meio do treino? Não para quem o app já começa mais leve por segurança (logic/carga.js e
// logic/trainer.js): dor ou limitação que pega o exercício, gestação e pós-parto, pressão alta e coração, triagem que
// pede liberação, doença crônica, 60 anos ou mais, menores de 18 e volta de pausa. Nesses casos a carga sobe entre um
// treino e outro, pela regra das repetições. ctx: { respostas, dor, volta (dias parado antes deste treino) }.
export function podeSubir(exId, ctx = {}) {
  const ex = EX_POR_ID.get(exId);
  if (!ex) return { pode: false, motivo: '' };
  const pf = perfilDe(ctx.respostas);
  const nao = (motivo) => ({ pode: false, motivo });
  if (ctx.dor || (pf && limitacaoNoExercicio(ex, pf))) return nao('Este exercício pega uma região com dor ou limitação: a carga não sobe hoje.');
  if (Number(ctx.volta) >= 14 || (pf && pf.retorno >= 1)) return nao('Na volta de uma pausa, a carga sobe aos poucos, de um treino para o outro.');
  if (!pf) return { pode: true, motivo: '' };
  if (pf.gestante || pf.posparto) return nao('Na gestação e depois do parto, a carga não sobe no meio do treino.');
  if (pf.pressao) return nao('Com pressão alta ou doença do coração, a carga não sobe no meio do treino.');
  if (pf.liberacao || pf.bloqueado) return nao('Enquanto a triagem pede liberação médica, a carga não sobe no meio do treino.');
  if (pf.moderado) return nao('Com doença crônica, a carga fica moderada: não sobe no meio do treino.');
  if (pf.idoso) return nao('Com 60 anos ou mais, a carga sobe aos poucos, de um treino para o outro.');
  if (pf.jovem) return nao('Com menos de 18 anos, a carga sobe aos poucos, de um treino para o outro.');
  return { pode: true, motivo: '' };
}

// Nova carga, um passo mais difícil (dir +1) ou mais fácil (dir −1). null = não dá (já está no mínimo).
// Mais difícil: +10% nos compostos e +5% nos isolados (acsm2009: de 2 a 10%, menos nos músculos pequenos); mais fácil:
// −10% (o limite de cima da faixa, para o lado seguro). Sempre pelo menos um degrau da grade. Máquina com ajuda: o
// sentido inverte (mais difícil = menos ajuda) e anda um degrau.
export function cargaAjustada(exId, kg, dir) {
  const ex = EX_POR_ID.get(exId);
  if (!ex || !(typeof kg === 'number' && Number.isFinite(kg) && kg >= 0)) return null;
  const ajuda = assistido(exId);
  const sobe = ajuda ? dir < 0 : dir > 0; // o número em kg sobe?
  if (ajuda) {
    if (sobe) return degrau(ex, kg, +1);
    const v = degrau(ex, kg, -1);
    return v == null ? (kg > 0 ? 0 : null) : v;
  }
  if (!(kg > 0)) return null;
  const g = grade(ex, kg);
  // o valor da grade mais perto do alvo (no empate, o menor)
  const perto = (alvo) => { const a = paraBaixo(ex, alvo, g), b = paraCima(ex, alvo, g); return a == null ? b : Math.abs(a - alvo) <= Math.abs(b - alvo) + 1e-9 ? a : b; };
  if (sobe) return Math.max(perto(kg * (1 + (ex.tipo === 'composto' ? 0.1 : 0.05))), degrau(ex, kg, +1));
  const um = degrau(ex, kg, -1);
  if (um == null) return null;
  const v = perto(kg * 0.9);
  return v == null ? um : Math.min(v, um);
}

export const REFS_TESTE = ['acsm2009', 'steele2017', 'helms2016'];
// O que mostrar depois da 1ª série válida de um exercício com carga feito pela 1ª vez no app. null = nada.
//   set: { kg, reps } da série feita; alvo: '8-12'; ctx: { respostas, dor, volta }.
// tipo 'abaixo' (fez menos que o mínimo: propõe baixar), 'acima' (passou do alvo: propõe subir, se pode) ou 'pergunta'
// (dentro da faixa: "Como foi?"). Cada opção: { id, rotulo, sub, kg (nova carga ou null = manter), texto }.
export function testeDaPrimeira(exId, alvo, set, ctx = {}) {
  const ex = EX_POR_ID.get(exId);
  if (!ex || ex.registro !== 'peso_reps' || !set || !(typeof set.kg === 'number' && Number.isFinite(set.kg) && set.kg >= 0) || !pos(set.reps)) return null;
  const [lo, hi] = parseReps(alvo);
  const kg = set.kg, reps = set.reps;
  const sobe = podeSubir(exId, ctx);
  const ajuda = assistido(exId);
  const un = (v) => (ajuda ? `ajuda de ${kgTxt(v)} kg` : `${kgTxt(v)} kg`);
  const mais = cargaAjustada(exId, kg, +1);
  const menos = cargaAjustada(exId, kg, -1);
  const manter = { id: 'manter', rotulo: 'Manter', sub: '', kg: null, texto: `Próximas séries: ${un(kg)}.` };
  const baixar = menos == null
    ? { id: 'pesada', rotulo: 'Pesada', sub: '1 ou nenhuma sobrando', kg: null, texto: ajuda ? 'Já está no mínimo de ajuda que o app conhece: faça menos repetições ou peça orientação.' : 'Já está na carga mínima: faça menos repetições ou troque por uma variação mais leve.' }
    : { id: 'pesada', rotulo: 'Pesada', sub: '1 ou nenhuma sobrando', kg: menos, texto: `Próximas séries: ${un(menos)}.` };
  const subir = !sobe.pode || mais == null
    ? { id: 'leve', rotulo: 'Leve demais', sub: '4 ou mais sobrando', kg: null, texto: `${sobe.motivo || 'A carga fica como está hoje.'} Próximas séries: ${un(kg)}.` }
    : { id: 'leve', rotulo: 'Leve demais', sub: '4 ou mais sobrando', kg: mais, texto: `Próximas séries: ${un(mais)}.` };
  if (reps < lo) {
    return { tipo: 'abaixo', titulo: `Ficou abaixo de ${lo} repetições`, opcoes: [{ ...baixar, id: 'baixar', rotulo: menos == null ? 'OK' : `Baixar para ${kgTxt(menos)} kg`, sub: '' }, ...(menos == null ? [] : [manter])], podeSubir: sobe.pode };
  }
  if (reps > hi) {
    if (!sobe.pode || mais == null) return { tipo: 'acima', titulo: `Passou de ${hi} repetições`, aviso: sobe.motivo || '', opcoes: [{ ...manter, rotulo: 'OK' }], podeSubir: false };
    return { tipo: 'acima', titulo: `Passou de ${hi} repetições`, opcoes: [{ ...subir, id: 'subir', rotulo: `Subir para ${kgTxt(mais)} kg`, sub: '' }, manter], podeSubir: true };
  }
  return { tipo: 'pergunta', titulo: 'Como foi a 1ª série?', opcoes: [subir, { ...manter, id: 'medida', rotulo: 'Na medida', sub: '2 ou 3 sobrando' }, baixar], podeSubir: sobe.pode };
}

// ---------- estado da tela (fora do state: store.js não guarda campos novos do treino em andamento) ----------
// { sid, geral: '' | 'feito' | 'pulado', aprox: { exId: [true, false] | 'pulado' }, teste: { exId: resposta } }
const ID = /^[\w-]{1,80}$/;
export function limparGuia(raw, sid) {
  const out = { sid: typeof sid === 'string' ? sid : '', geral: '', aprox: {}, teste: {} };
  if (!isObj(raw) || raw.sid !== out.sid || !out.sid) return out;
  if (raw.geral === 'feito' || raw.geral === 'pulado') out.geral = raw.geral;
  if (isObj(raw.aprox)) for (const [k, v] of Object.entries(raw.aprox).slice(0, 80)) {
    if (!ID.test(k) || !EX_POR_ID.has(k)) continue;
    if (v === 'pulado') out.aprox[k] = 'pulado';
    else if (Array.isArray(v)) out.aprox[k] = v.slice(0, 4).map((x) => x === true);
  }
  if (isObj(raw.teste)) for (const [k, v] of Object.entries(raw.teste).slice(0, 80)) if (ID.test(k) && EX_POR_ID.has(k) && typeof v === 'string' && ID.test(v)) out.teste[k] = v;
  return out;
}

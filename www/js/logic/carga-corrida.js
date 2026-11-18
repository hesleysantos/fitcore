// Carga da semana na corrida: olha o que foi feito e o que está previsto nesta semana (corrida, treino de pernas, volta à
// academia ou à corrida, dores, saúde, sono e cansaço registrados) e diz se os próximos treinos de corrida — em especial o
// longão e o treino forte do fim de semana — seguem como estão, ficam mais leves ou mudam de dia. Puro: sem DOM e sem
// importar o estado.
//
// PARA O CHAT (e para as telas):
//   cargaDaSemana(st, hoje) → { nivel, titulo, resumo, texto, fatores, ajustes, refs, semana, anterior, aplicado, temAplicado }
//     nivel: 'sem_plano' (sem plano de corrida em andamento) | 'normal' (segue como está) | 'atencao' (só informa) |
//            'puxada' (há ajuste proposto);
//     resumo: a frase principal ("Semana puxada: 1º treino de pernas depois de 3 semanas na sexta.");
//     texto: o resumo com os ajustes, pronto para o chat ("... Longão de sábado: mais curto, em ritmo de conversa.");
//     principal: o id do fator da frase principal;
//     fatores: [{ id, texto, refs }] — o que pesa na semana (ids: pernas, salto, volume, sono, cansaco, dor, saude,
//            volta_corrida, academia);
//     ajustes: [{ data, wd, nome, tipo, acao: 'leve' | 'curto' | 'mover', corte?, para?, motivo, texto, porque, refs, aplicado }];
//     semana / anterior: { km, min, corridas, pernas } (e, na semana atual, previstoKm, previstoMin, fortes, longo);
//     aplicado: todos os ajustes propostos já estão no plano; temAplicado: há ajuste desta semana para desfazer.
//   aplicarCarga(st, hoje) → { carga, perdidos } | null — o que gravar em state.run.carga e state.perdidos (a tela confirma antes);
//   desfazerCarga(st, hoje) → { carga, perdidos } — tira os ajustes desta semana (de hoje em diante);
//   cargaDoDia(st, hoje, data) → { texto, aplicado, nivel } | null — o ajuste de um dia (para o Início e o chat).
//   treinosDePernas(st, hoje) → os treinos pesados de pernas feitos e previstos, com o número de cada um na volta.
// Os ajustes aplicados ficam em state.run.carga (validado por limparCarga, logic/corrida.js) e o plano os aplica em
// gerarPlano, só de hoje em diante; a corrida que muda de dia usa a marca de state.perdidos (logic/perdido.js).
//
// REGRAS (fontes em texto completo; chaves de REFS_CORRIDA em data/corrida.js):
//  1. Treino de pernas na volta. Nos 2 primeiros treinos pesados de pernas de quem começa, ou volta depois de 2 semanas ou
//     mais sem treino de pernas, a corrida rende menos por pelo menos 48 horas, inclusive abaixo do limiar; do 3º em diante,
//     o corpo se protege (doma2017: "running sessions at sub-maximal and maximal intensity effort should be avoided for at
//     least 48 hours following the first two bouts"; damas2016: o dano muscular é maior no 1º treino e cai nas semanas
//     seguintes; assumpcao2013: a economia de corrida piora por 24 a 120 h depois do dano muscular). Com dor muscular
//     tardia, menos intensidade e duração por 1 a 2 dias (zondi2015). → Nos 2 dias seguintes a esses treinos, o treino forte
//     e o longão mudam de dia, se houver um dia que respeite as regras do plano (avaliarMoverCorrida, logic/perdido.js) e
//     fique fora dessa janela; se não houver, o treino forte vira rodagem leve e o longão fica pela metade, em ritmo de
//     conversa (o mesmo corte da dor muscular no plano). "Pesado" = 3 séries ou mais de exercícios com perna como músculo
//     principal (os pesos de músculo do Treinador, pesosDoExercicio); 2 semanas = o prazo de pausa do aplicativo
//     (caterisano2019; a proteção dura semanas a meses, assumpcao2013, então o prazo fica do lado cauteloso).
//  2. Salto de distância. O risco de lesão sobe quando UMA corrida passa 10% da mais longa dos 30 dias anteriores, e vários
//     aumentos de 10% na mesma semana podem ser demais (frandsen2025). → Se uma corrida desta semana já passou desse limite,
//     as próximas da semana não passam de 10% acima da mais longa dos 30 dias antes da semana. O plano já faz isso com o
//     longão (logic/corrida.js): aqui a regra pega o que sobrar (outra corrida acima do limite) e avisa.
//  3. Volume da semana: só informa. O aumento semanal tem evidência fraca e inconsistente (fredette2022, damsted2018), a
//     razão carga aguda ÷ crônica gera artefatos e não serve como indicador de risco (impellizzeri2020), e em frandsen2025
//     os saltos semanais não se ligaram a lesão: o que pesa é o tamanho de cada corrida (regra 2).
//  4. Sono e cansaço: só informam. Com 6 horas ou menos de sono, o desempenho cai cerca de 6 a 8%, menos de manhã
//     (craven2022); cansaço que a pessoa sente é o melhor sinal de excesso (saw2016, meeusen2013).
//  5. Dor, problema de saúde e volta à corrida: o plano já ajusta (logic/corrida.js); aqui só aparecem na lista. Um dia já
//     mudado pela dor não recebe outro ajuste.
import { planoAtual, planoDaSemana, somaDias, segundaDe, diaDaSemana, diasEntre, diaValido, diaLocal, fmtKm, efeitoDaDor, limparCarga, perfil } from './corrida.js';
import { pesosDoExercicio } from './trainer.js';
import { EX_POR_ID } from '../data/exercises.js';
import { MOTIVOS_CARGA } from '../data/corrida.js';
import { voltaEm, FAIXAS_PAUSA, FAIXA_DA_RESPOSTA, PAUSA_MINIMA, duracaoTxt } from './pausa.js';
import { doresAtivas, LOCAIS_DOR } from './dor.js';
import { doresForaDaCorrida } from './saude-fora.js';
import { semanaEfetiva, avaliarMoverCorrida, limparPerdido, limparPerdidos, nomeDoDia } from './perdido.js';

export const SERIES_PERNA = 3;      // séries de perna (músculo principal) para o treino contar como pesado: o mesmo de logic/perdido.js
export const JANELA_PERNAS = 2;     // dias depois do treino de pernas da volta em que a corrida fica mais leve (48 h: doma2017)
export const BOUTS_VOLTA = 2;       // quantos treinos de pernas contam como "da volta" (doma2017: o 3º já protege)
export const CORTE_LONGO = 0.5;     // longão na janela: pela metade (o corte da dor muscular do plano, zondi2015)
export const SALTO = 0.1;           // uma corrida até 10% acima da mais longa dos 30 dias (frandsen2025)
export const SONO_CURTO = 6;        // horas: 6 ou menos é "perda de sono" em craven2022
// todas as fontes que esta análise pode citar (além das de MOTIVOS_CARGA e das que vêm prontas do efeito da dor)
export const REFS_CARGA = ['frandsen2025', 'fredette2022', 'damsted2018', 'impellizzeri2020', 'craven2022', 'saw2016', 'meeusen2013', 'caterisano2019', 'doma2017'];
const GRUPOS_PERNA = ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas'];
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const lista = (v) => (Array.isArray(v) ? v.filter(isObj) : []);
const r1 = (x) => Math.round(x * 10) / 10;
const capi = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const ehEvento = (d) => d.tipo === 'prova' || d.tipo === 'teste';
const ehCorrida = (d) => !!d && d.tipo !== 'descanso' && d.tipo !== 'caminhada';
const qualidade = (d) => ehCorrida(d) && !ehEvento(d) && d.intensidade && d.intensidade !== 'leve';
const longao = (d) => ehCorrida(d) && d.tipo === 'longo' && !d.comoRodagem;
const unicos = (l) => [...new Set(l)];

// ---------- treino de pernas ----------
// séries de exercícios com perna como músculo principal (peso 1 em pesosDoExercicio); cardio não conta
function seriesDePerna(itens, contar) {
  let n = 0;
  for (const it of Array.isArray(itens) ? itens : []) {
    const ex = it && EX_POR_ID.get(it.ex);
    if (!ex || ex.registro === 'minutos' || ex.padrao === 'cardio') continue;
    const w = pesosDoExercicio(ex);
    if (GRUPOS_PERNA.some((g) => w[g] === 1)) n += contar(it);
  }
  return n;
}
const feitas = (it) => (Array.isArray(it.sets) ? it.sets.filter((x) => x && x.ok).length : 0);
const previstas = (it) => Math.max(0, Math.round(Number(it.series) || 0));
// Treinos pesados de pernas, feitos (state.sessions) e previstos de hoje até domingo (agenda do plano ativo com as marcas da
// semana), em ordem, com o número de cada um na volta: [{ data, series, feito, n (1, 2... desde a última pausa de 2 semanas
// ou mais), pausa (dias sem treino de pernas antes dele; null = nenhum antes) }].
export function treinosDePernas(st, hoje) {
  const seg = segundaDe(hoje), dom = somaDias(seg, 6);
  const porDia = new Map();
  const sessoes = lista(st && st.sessions);
  for (const s of sessoes) {
    const data = diaLocal(s.inicio);
    if (!data || data > hoje) continue;
    const n = seriesDePerna(s.itens, feitas);
    if (n > 0) porDia.set(data, { data, series: (porDia.has(data) ? porDia.get(data).series : 0) + n, feito: true });
  }
  const plan = st && Array.isArray(st.plans) ? st.plans.find((p) => p && p.id === st.activePlan) : null;
  if (plan && Array.isArray(plan.dias)) {
    let sem = [];
    try { sem = semanaEfetiva(plan, st.perdidos, seg); } catch { sem = []; }
    for (const d of sem) {
      if (d.data < hoje || d.data > dom || !d.diaId || porDia.has(d.data) || sessoes.some((s) => diaLocal(s.inicio) === d.data)) continue;
      const dia = plan.dias.find((x) => x && x.id === d.diaId);
      const n = dia ? seriesDePerna(dia.itens, previstas) : 0;
      if (n > 0) porDia.set(d.data, { data: d.data, series: n, feito: false });
    }
  }
  // quem nunca registrou treino de pernas e disse ao Treinador que treina sem pausa: os primeiros não são "da volta"
  const a = st && isObj(st.trainer) && isObj(st.trainer.answers) ? st.trainer.answers : null;
  const treinaSemPausa = !!a && a.experiencia && a.experiencia !== 'nunca' && (a.pausa === 'treinando' || !a.pausa) && !(FAIXA_DA_RESPOSTA[a.pausa] > 0);
  const out = [];
  let ant = null;
  for (const t of [...porDia.values()].filter((x) => x.series >= SERIES_PERNA).sort((x, y) => (x.data < y.data ? -1 : 1))) {
    const pausa = ant ? diasEntre(ant.data, t.data) : null;
    const n = !ant ? (treinaSemPausa ? BOUTS_VOLTA + 1 : 1) : pausa >= PAUSA_MINIMA ? 1 : ant.n + 1;
    out.push({ ...t, n, pausa });
    ant = { data: t.data, n };
  }
  return out;
}

// ---------- o estado sem os ajustes desta semana (a proposta parte do plano como ele era) ----------
function semAjustes(st, hoje) {
  const seg = segundaDe(hoje), dom = somaDias(seg, 6);
  const run = isObj(st.run) ? st.run : {};
  const carga = limparCarga(run.carga);
  const daSemana = carga.filter((x) => x.data >= seg && x.data <= dom);
  const moveu = daSemana.filter((x) => x.acao === 'mover');
  const perdidos = lista(st.perdidos).filter((e) => !(e.tipo === 'corrida' && moveu.some((m) => m.data === e.data && m.para === e.para)));
  return { st: { ...st, run: { ...run, carga: carga.filter((x) => !daSemana.includes(x)) }, perdidos }, daSemana };
}

const kmDoRegistro = (r) => (typeof r.distKm === 'number' && r.distKm > 0 ? r.distKm : 0);
const minDoRegistro = (r) => (typeof r.durMin === 'number' && r.durMin > 0 ? r.durMin : 0);
const corridasDe = (st) => lista(st && st.runs).filter((r) => diaValido(r.data) && r.tipo !== 'caminhada');
function somaSemana(runs, a, b, pernas) {
  const l = runs.filter((r) => r.data >= a && r.data <= b);
  return { km: r1(l.reduce((s, r) => s + kmDoRegistro(r), 0)), min: Math.round(l.reduce((s, r) => s + minDoRegistro(r), 0)), corridas: new Set(l.map((r) => r.data)).size, pernas: pernas.filter((t) => t.data >= a && t.data <= b).length };
}

const vazio = (extra = {}) => ({ nivel: 'sem_plano', titulo: '', resumo: '', texto: '', principal: '', fatores: [], ajustes: [], refs: [], semana: null, anterior: null, aplicado: false, temAplicado: false, ...extra });

// ---------- a análise ----------
export function cargaDaSemana(st, hoje) {
  if (!isObj(st) || !diaValido(hoje)) return vazio();
  const { st: st0, daSemana } = semAjustes(st, hoje);
  let p = null, sem = null;
  try { p = planoAtual(st0, hoje); sem = p ? planoDaSemana(st0, hoje) : null; } catch { p = null; sem = null; }
  if (!p || !sem || sem.antesDoInicio || sem.concluido || !Array.isArray(sem.dias)) return vazio({ temAplicado: daSemana.length > 0 });
  const seg = segundaDe(hoje), dom = somaDias(seg, 6);
  const runs = corridasDe(st);
  const pernas = treinosDePernas(st, hoje);
  const dias = sem.dias.filter(Boolean).sort((a, b) => (a.data < b.data ? -1 : 1));
  const perdida = (data) => lista(st.perdidos).some((e) => e.tipo === 'corrida' && e.data === data && !e.para);
  const futuros = dias.filter((d) => ehCorrida(d) && d.data >= hoje && !d.feito && !perdida(d.data));
  const fatores = [];
  const propostas = new Map(); // data → ajuste
  const fator = (id, texto, refs) => fatores.push({ id, texto, refs: refs.slice() });

  // ----- 1. treino de pernas da volta: as corridas dos 2 dias seguintes -----
  const daVolta = pernas.filter((t) => t.n <= BOUTS_VOLTA && t.data >= somaDias(seg, -JANELA_PERNAS) && t.data <= dom);
  const naJanela = (data) => daVolta.some((t) => data > t.data && diasEntre(t.data, data) <= JANELA_PERNAS);
  const ehDiaDePernas = (data) => daVolta.some((t) => t.data === data);
  for (const d of futuros) {
    if (!naJanela(d.data) || d.ajustado || !(qualidade(d) || longao(d))) continue;
    // muda de dia, se houver um dia livre que respeite as regras do plano e fique longe do treino de pernas
    const cands = [];
    for (let k = 0; k < 7; k++) {
      const x = somaDias(seg, k);
      if (x < hoje || x === d.data || naJanela(x) || ehDiaDePernas(x)) continue;
      cands.push(x);
    }
    cands.sort((a, b) => { const fa = a > d.data ? 0 : 1, fb = b > d.data ? 0 : 1; return fa - fb || Math.abs(diasEntre(d.data, a)) - Math.abs(diasEntre(d.data, b)); });
    let para = '';
    for (const x of cands) { let ok = false; try { ok = avaliarMoverCorrida(st0, d.data, x, hoje).pode; } catch { ok = false; } if (ok) { para = x; break; } }
    if (para) propostas.set(d.data, { d, acao: 'mover', para, motivo: 'pernas' });
    else if (longao(d)) propostas.set(d.data, { d, acao: 'curto', corte: CORTE_LONGO, motivo: 'pernas' });
    else propostas.set(d.data, { d, acao: 'leve', motivo: 'pernas' });
  }
  if (daVolta.length) {
    const t = daVolta[daVolta.length - 1];
    const wd = diaDaSemana(t.data);
    const quando = t.data === hoje ? 'hoje' : t.data === somaDias(hoje, -1) ? 'ontem' : t.data === somaDias(hoje, 1) ? 'amanhã' : (wd === 0 || wd === 6 ? 'no ' : 'na ') + nomeDoDia(t.data, hoje);
    const base = `${t.n}º treino de pernas${t.n === 1 && t.pausa ? ' depois de ' + duracaoTxt(t.pausa) : t.n === 2 ? ' da volta' : ''} ${quando}`;
    const leves = futuros.some((d) => naJanela(d.data) && !propostas.has(d.data));
    if (propostas.size || leves) fator('pernas', capi(base) + '.', MOTIVOS_CARGA.pernas.refs);
  }

  // ----- 2. salto de distância nesta semana (frandsen2025) -----
  const antes = runs.filter((r) => r.data < seg && diasEntre(r.data, seg) <= 30);
  const ant = Math.max(0, ...antes.map(kmDoRegistro));
  if (ant >= 3) {
    const teto = ant * (1 + SALTO);
    const salto = runs.filter((r) => r.data >= seg && r.data <= hoje && kmDoRegistro(r) > teto + 0.3).sort((a, b) => kmDoRegistro(b) - kmDoRegistro(a))[0];
    if (salto) {
      for (const d of futuros) {
        if (d.ajustado || !(d.distKm > teto + 0.3)) continue;
        const corte = Math.min(0.5, Math.ceil((1 - teto / d.distKm) * 100) / 100);
        if (corte < 0.05) continue;
        const ja = propostas.get(d.data);
        if (ja && ja.acao === 'mover') continue; // o dia novo é avaliado pelas regras do plano; o tamanho fica para a próxima análise
        if (ja) { ja.acao = 'curto'; ja.corte = Math.max(ja.corte || 0, corte); continue; }
        propostas.set(d.data, { d, acao: 'curto', corte, motivo: 'salto' });
      }
      // o plano já limita o longão a 10% acima da mais longa dos 30 dias antes da semana (logic/corrida.js): em geral, aqui só se informa
      fator('salto', `Sua corrida de ${fmtKm(kmDoRegistro(salto))} passou 10% da maior do mês anterior (${fmtKm(ant)}): até domingo, nenhuma passa de ${fmtKm(Math.floor(teto * 2) / 2)}.`, MOTIVOS_CARGA.salto.refs);
    }
  }

  // ----- a semana em números -----
  const atual = somaSemana(runs, seg, hoje, pernas);
  const anterior = somaSemana(runs, somaDias(seg, -7), somaDias(seg, -1), pernas);
  const corridasPlano = dias.filter(ehCorrida);
  const lg = corridasPlano.find(longao) || null;
  const semana = {
    inicio: seg, ...atual,
    previstoKm: r1(atual.km + futuros.reduce((s, d) => s + (d.distKm || 0), 0)), previstoMin: Math.round(atual.min + futuros.reduce((s, d) => s + (d.durMin || 0), 0)),
    fortes: corridasPlano.filter(qualidade).length, pernas: pernas.filter((t) => t.data >= seg && t.data <= dom).length,
    longo: lg ? { data: lg.data, nome: lg.nome, distKm: lg.distKm, durMin: lg.durMin, feito: !!lg.feito } : null,
  };

  // ----- 3. volume da semana: só informa (fredette2022, damsted2018, impellizzeri2020, frandsen2025) -----
  if (anterior.km >= 8 && semana.previstoKm > anterior.km * 1.3 + 2) fator('volume', `Semana com ${Math.round((semana.previstoKm / anterior.km - 1) * 100)}% mais km que a passada. O que mais pesa é o tamanho de cada corrida: nenhuma passa 10% da maior do mês.`, ['frandsen2025', 'fredette2022', 'damsted2018', 'impellizzeri2020']);

  // ----- 4. sono e cansaço: só informam (craven2022, saw2016, meeusen2013) -----
  const corridaHoje = futuros.find((d) => d.data === hoje);
  const noite = lista(st.sono && st.sono.registros).find((r) => r.data === hoje && typeof r.horas === 'number');
  if (corridaHoje && noite && (noite.horas <= SONO_CURTO || noite.qualidade <= 2)) {
    const curta = noite.horas <= SONO_CURTO;
    fator('sono', `${curta ? `Noite curta (${String(Math.floor(noite.horas))} h${Math.round((noite.horas % 1) * 60) ? ' ' + Math.round((noite.horas % 1) * 60) : ''})` : 'Você acordou cansado'}: ${qualidade(corridaHoje) ? 'o treino forte rende menos, mais à tarde e à noite do que de manhã. Se pesar, faça rodagem leve.' : 'vá pelo esforço, sem forçar o ritmo.'}`, curta ? ['craven2022'] : ['saw2016']);
  }
  if (lista(st.perdidos).some((e) => e.motivo === 'cansaco' && e.data >= seg && e.data <= dom)) fator('cansaco', 'Você marcou cansaço nesta semana. Se ele não passa em uma semana, reduza os treinos.', ['saw2016', 'meeusen2013']);

  // ----- 5. dor, saúde e volta: o plano já ajusta -----
  let pf = null;
  try { pf = perfil(st.run.answers); } catch { pf = null; }
  const dores = doresAtivas(st, hoje).filter((d) => efeitoDaDor(d, pf).nivel > 0);
  if (dores.length) fator('dor', `Dor (${unicos(dores.map((d) => LOCAIS_DOR[d.onde].toLowerCase())).join(', ')}): o plano já ajustou os próximos dias.`, efeitoDaDor(dores[0], pf).refs.slice(0, 3));
  let fora = [];
  try { fora = doresForaDaCorrida(st, hoje); } catch { fora = []; }
  if (fora.length) fator('saude', 'O problema de saúde que você contou já mudou a corrida dos próximos dias.', fora[0].fora.refs.slice(0, 3));
  if (p.ajustes.some((x) => x.volta)) fator('volta_corrida', 'Volta à corrida: o plano já está mais leve.', ['caterisano2019']);
  if (!fatores.some((f) => f.id === 'pernas')) {
    const sessoes = lista(st.sessions).map((s) => Date.parse(s.inicio)).filter(Number.isFinite).sort((a, b) => a - b);
    const t = isObj(st.trainer) ? st.trainer : {};
    const ta = isObj(t.answers) ? t.answers : {};
    const faixa = ta.experiencia === 'nunca' ? 0 : FAIXA_DA_RESPOSTA[ta.pausa] || 0;
    const desde = Date.parse(t.aceitoEm);
    let v = null;
    try { v = voltaEm(sessoes, Date.parse(hoje + 'T23:59:00'), faixa && Number.isFinite(desde) ? { dias: FAIXAS_PAUSA[faixa].meio, desde } : null); } catch { v = null; }
    if (v && v.semana <= 2) fator('academia', `${v.semana}ª semana de volta à academia: nos 2 dias depois de treinar pernas, corra leve.`, ['doma2017', 'caterisano2019']);
  }

  // ----- os ajustes, com o texto -----
  const aplicadoEm = (a) => daSemana.some((x) => x.data === a.data && x.acao === a.acao && (a.acao !== 'mover' || x.para === a.para) && (a.acao !== 'curto' || Math.abs(x.corte - a.corte) < 0.011));
  const ajustes = [...propostas.values()].sort((a, b) => (a.d.data < b.d.data ? -1 : 1)).map(({ d, acao, corte, para, motivo }) => {
    const m = MOTIVOS_CARGA[motivo];
    const nome = String(d.nome || 'Corrida');
    const de = 'de ' + nomeDoDia(d.data, hoje);
    const texto = acao === 'mover' ? `${nome} ${de}: passa para ${nomeDoDia(para, hoje)}.`
      : acao === 'leve' ? `${nome} ${de}: vira rodagem leve.`
        : longao(d) ? `${nome} ${de}: mais curto, em ritmo de conversa.` : `${nome} ${de}: mais curto e leve.`;
    const a = { data: d.data, wd: diaDaSemana(d.data), nome, tipo: d.tipo, acao, motivo, texto, porque: m.motivo, refs: m.refs.slice() };
    if (acao === 'curto') a.corte = corte;
    if (acao === 'mover') a.para = para;
    a.aplicado = aplicadoEm(a);
    return a;
  });
  const refs = unicos([...fatores.flatMap((f) => f.refs), ...ajustes.flatMap((a) => a.refs)]);
  const principal = fatores.find((f) => f.id === 'pernas' || f.id === 'salto') || fatores[0] || null;
  const nivel = ajustes.length ? 'puxada' : fatores.length ? 'atencao' : 'normal';
  const titulo = nivel === 'puxada' ? 'Semana puxada' : nivel === 'atencao' ? 'Atenção nesta semana' : 'Semana normal';
  const resumo = nivel === 'puxada' ? `Semana puxada: ${principal.texto.charAt(0).toLowerCase() + principal.texto.slice(1)}`
    : nivel === 'atencao' ? principal.texto : 'Semana normal: os treinos seguem como estão.';
  const texto = nivel === 'puxada' ? `${resumo} ${ajustes.map((a) => a.texto).join(' ')}` : nivel === 'atencao' ? `${resumo} Os treinos seguem como estão.` : resumo;
  return {
    nivel, titulo, resumo, texto, principal: principal ? principal.id : '', fatores, ajustes, refs, semana, anterior,
    aplicado: ajustes.length > 0 && ajustes.every((a) => a.aplicado), temAplicado: daSemana.some((x) => x.data >= hoje),
  };
}

// ---------- aplicar e desfazer ----------
// O que gravar ao aplicar: state.run.carga com os ajustes desta semana trocados pelos propostos, e state.perdidos com as
// corridas que mudam de dia (a mesma marca do chat: logic/perdido.js). null se não há o que aplicar.
export function aplicarCarga(st, hoje) {
  const r = cargaDaSemana(st, hoje);
  if (!r.ajustes.length) return null;
  const { st: st0, daSemana } = semAjustes(st, hoje);
  const em = new Date().toISOString();
  const novos = r.ajustes.map((a) => ({ data: a.data, acao: a.acao, motivo: a.motivo, em, ...(a.acao === 'curto' ? { corte: a.corte } : {}), ...(a.acao === 'mover' ? { para: a.para } : {}) }));
  const carga = limparCarga([...limparCarga(st0.run.carga), ...daSemana.filter((x) => x.data < hoje), ...novos]);
  const marcas = r.ajustes.filter((a) => a.acao === 'mover').map((a) => limparPerdido({ tipo: 'corrida', data: a.data, para: a.para, em }));
  return { carga, perdidos: limparPerdidos([...lista(st0.perdidos), ...marcas]) };
}
// Tira os ajustes desta semana, de hoje em diante (os dias que já passaram ficam como foram).
export function desfazerCarga(st, hoje) {
  const run = isObj(st && st.run) ? st.run : {};
  const carga = limparCarga(run.carga);
  if (!diaValido(hoje)) return { carga, perdidos: lista(st && st.perdidos) };
  const seg = segundaDe(hoje), dom = somaDias(seg, 6);
  const sai = carga.filter((x) => x.data >= hoje && x.data <= dom);
  const perdidos = lista(st.perdidos).filter((e) => !(e.tipo === 'corrida' && sai.some((m) => m.acao === 'mover' && m.data === e.data && m.para === e.para)));
  return { carga: carga.filter((x) => !sai.includes(x)), perdidos };
}
// O ajuste de um dia (proposto ou já aplicado), para avisar no Início: { texto, aplicado, nivel } ou null
// `pronta` (opcional): a análise já feita, para não refazer as contas
export function cargaDoDia(st, hoje, data, pronta = null) {
  let r = pronta;
  if (!r) { try { r = cargaDaSemana(st, hoje); } catch { return null; } }
  const a = r.ajustes.find((x) => x.data === data || (x.acao === 'mover' && x.para === data && x.aplicado));
  if (a) return { texto: a.texto, aplicado: a.aplicado, nivel: r.nivel };
  // ajuste aplicado que a análise de hoje já não propõe (o treino de pernas passou sem registro): continua no plano
  const g = limparCarga(isObj(st && st.run) ? st.run.carga : null).find((x) => x.data === data || (x.acao === 'mover' && x.para === data));
  if (!g || !diaValido(hoje) || data < hoje) return null;
  const m = MOTIVOS_CARGA[g.motivo];
  return { texto: `${g.acao === 'mover' ? 'Corrida mudou de dia' : g.acao === 'leve' ? 'Corrida mais leve' : 'Corrida mais curta'}: ${m.curto}.`, aplicado: true, nivel: r.nivel };
}

// Aeróbico da semana: o que a pessoa fez (o cardio da musculação e as corridas e caminhadas registradas) contra a meta do
// seu perfil (idade, gestação, objetivo de emagrecer). É a mesma conta do plano de corrida (logic/corrida.js, "aeróbico da
// semana"), para a análise nunca dizer que o plano que o próprio app montou está fraco.
// Fontes lidas em texto completo:
//  • OMS 2020 (ref oms2020, Bull 2020, tabela 4): adultos "at least 150–300 min of moderate-intensity aerobic physical
//    activity; or at least 75–150 min of vigorous-intensity [...] or an equivalent combination" (1 min vigoroso = 2
//    moderados); crianças e adolescentes "at least an average of 60 min/day of moderate-to-vigorous intensity, mostly
//    aerobic, physical activity"; idosos, a mesma meta dos adultos e "varied multicomponent physical activity that
//    emphasises functional balance and strength training [...] on 3 or more days a week"; gestação e pós-parto, "at least
//    150 min of moderate-intensity aerobic physical activity throughout the week". Abaixo da meta: "doing some physical
//    activity will bring benefits to health" e "Start with small amounts [...] and gradually increase".
//    Intensidade: moderada é "between 3 and <6 times the intensity of rest (METs)"; vigorosa, "6.0 or more METs".
//  • Compendium 2024 (ref compendio2024; METS_CARDIO em logic/gasto.js): o MET de cada aparelho de cardio.
//  • Emagrecer: Swift 2014 (ref swift2014), "exercise programs need to exceed 225 min/per week in order to possibly induce
//    clinically significant weight loss"; Oppert 2021 (ref oppert2021), perda de peso com "150 to 200 min of aerobic
//    exercise at least at moderate intensity" e, para manter, "200 to 300 min/week".
//  • Musculação e cardio juntos: o cardio não atrapalha o ganho de massa muscular (ref schumann2022, a mesma da pergunta
//    frequente "Fazer cardio atrapalha o ganho de músculo?").
import { EX_POR_ID } from '../data/exercises.js';
import { METS_CARDIO } from './gasto.js';
import { condicoesDe } from './saude.js';
import { minutosDoRegistro, minutosEquivalentes, querEmagrecer, planoDaSemana, META_OMS_MIN, META_EMAGRECER_MIN } from './corrida.js';
import { ESPORTE_POR_ID } from '../data/esportes.js';

const DIA = 86400000, SEMANA = 7 * DIA;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const lista = (v) => (Array.isArray(v) ? v : []);
const respostas = (st, k) => (st && isObj(st[k]) && isObj(st[k].answers) ? st[k].answers : {});
const pad = (n) => String(n).padStart(2, '0');
const diaDe = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// Meta da semana, em minutos de atividade moderada (o vigoroso conta em dobro). `relogio` = meta extra em minutos de
// relógio (emagrecer: os estudos contam minutos de exercício, moderado ou mais).
export function metaAerobica(st) {
  const idade = [respostas(st, 'trainer').idade, respostas(st, 'run').idade, respostas(st, 'nutri').idade].map(Number).find((x) => Number.isFinite(x) && x > 0) || 0;
  let cond = [];
  try { cond = [...condicoesDe(respostas(st, 'trainer')), ...condicoesDe(respostas(st, 'run'))]; } catch { cond = []; }
  if (idade && idade < 18) return { perfil: 'jovem', min: 420, texto: 'Até os 17 anos, a OMS recomenda 60 minutos por dia, em média, de atividade moderada a vigorosa.', refs: ['oms2020'] };
  if (cond.includes('gestante') || cond.includes('posparto')) return { perfil: 'gestante', min: META_OMS_MIN, texto: 'Na gestação e no pós-parto, a OMS recomenda pelo menos 150 minutos por semana de atividade moderada.', refs: ['oms2020'] };
  if (querEmagrecer(st)) return { perfil: 'emagrecer', min: META_OMS_MIN, relogio: META_EMAGRECER_MIN, texto: 'Para emagrecer, 150 a 200 minutos por semana ajudam; acima de 225, a perda tende a ser maior.', refs: ['swift2014', 'oppert2021', 'oms2020'] };
  if (idade >= 65) return { perfil: 'idoso', min: META_OMS_MIN, texto: 'Depois dos 65, a meta é a mesma, com exercícios de equilíbrio e força em 3 dias ou mais.', refs: ['oms2020'] };
  return { perfil: 'adulto', min: META_OMS_MIN, texto: 'A OMS recomenda de 150 a 300 minutos de atividade moderada por semana.', refs: ['oms2020'] };
}

// Minutos por semana (média da janela; quem começou há poucos dias não tem a média diluída): { equivalente, relogio, registros }
export function aerobicoFeito(st, agora = Date.now(), dias = 14) {
  const desde = agora - dias * DIA;
  let eq = 0, rel = 0, n = 0, primeiro = Infinity;
  for (const s of lista(st && st.sessions)) {
    const t = s ? Date.parse(s.inicio) : NaN;
    if (!Number.isFinite(t) || t < desde || t > agora) continue;
    primeiro = Math.min(primeiro, t);
    for (const it of lista(s.itens)) {
      const ex = EX_POR_ID.get(it && it.ex);
      if (!ex || ex.registro !== 'minutos') continue;
      const min = lista(it.sets).filter((x) => x && x.ok && Number.isFinite(x.seg) && x.seg > 0).reduce((a, x) => a + x.seg, 0); // nos exercícios por minutos, o campo seg guarda minutos (como em logic/insights.js)
      if (!min) continue;
      const met = METS_CARDIO[ex.id] ? METS_CARDIO[ex.id][0] : 0;
      rel += min; eq += met >= 6 ? 2 * min : min; n++;
    }
  }
  for (const r of lista(st && st.runs)) {
    const t = r && typeof r.data === 'string' ? Date.parse(r.data + 'T12:00:00') : NaN;
    if (!Number.isFinite(t) || t < desde - DIA / 2 || t > agora + DIA / 2) continue;
    const m = minutosDoRegistro(r);
    if (!m.relogio) continue;
    primeiro = Math.min(primeiro, t);
    rel += m.relogio; eq += m.equivalente; n++;
  }
  // outros esportes do dia (logic/esportes.js): de 3 METs para cima é moderado; de 6 para cima, vigoroso (vale 2)
  for (const a of lista(st && st.atividades)) {
    const t = a && typeof a.data === 'string' ? Date.parse(a.data + 'T12:00:00') : NaN;
    const e = a ? ESPORTE_POR_ID.get(a.esporte) : null;
    if (!e || !Number.isFinite(t) || t < desde - DIA / 2 || t > agora + DIA / 2 || !(a.min > 0) || e.met < 3) continue;
    primeiro = Math.min(primeiro, t);
    rel += a.min; eq += e.met >= 6 ? 2 * a.min : a.min; n++;
  }
  const semanas = Number.isFinite(primeiro) ? Math.min(dias / 7, Math.max(1, (agora - Math.max(desde, primeiro)) / SEMANA)) : dias / 7;
  return { equivalente: Math.round(eq / semanas), relogio: Math.round(rel / semanas), registros: n };
}

// minutos (moderado equivalente) que o plano de corrida pede nesta semana; null sem plano
function doPlanoDaSemana(st, agora) {
  try {
    const sem = planoDaSemana(st, diaDe(agora));
    if (!sem || sem.antesDoInicio || sem.concluido || !Array.isArray(sem.dias)) return null;
    return sem.dias.reduce((t, d) => t + minutosEquivalentes(d), 0);
  } catch { return null; }
}

// A dica da análise (logic/insights.js), ou null quando não há nada registrado para medir.
export function dicaCardio(st, agora = Date.now()) {
  const meta = metaAerobica(st);
  const f = aerobicoFeito(st, agora);
  const objetivo = respostas(st, 'trainer').objetivo || '';
  const plano = doPlanoDaSemana(st, agora);
  const conta = 'Corrida, caminhada, cardio e esportes contam; correr vale 2.';
  const refs = [...new Set([...meta.refs, 'compendio2024'])];
  if (f.equivalente < meta.min) {
    if (!f.registros && plano == null) return null; // nada registrado e sem plano de corrida: ainda não há o que medir
    const comPlano = plano == null ? '' : plano >= meta.min ? ' Seguindo o plano de corrida, você chega lá.' : ` O plano de corrida desta semana soma ${plano}: complete com caminhada nos outros dias.`;
    const foco = ['hipertrofia', 'forca'].includes(objetivo) ? ' Não atrapalha o ganho de músculo.' : '';
    return { id: 'cardio', tom: 'ideia', icone: 'heart', p: ['hipertrofia', 'forca'].includes(objetivo) ? 8 : 6, titulo: 'Pouco aeróbico na semana',
      texto: `${f.equivalente} de ${meta.min} minutos por semana.${comPlano}`, porque: `${meta.texto}${foco} ${conta}`, refs: foco ? [...refs, 'schumann2022'] : refs,
      ...(plano == null ? { acao: { rotulo: 'Ver a corrida', rota: 'corrida' } } : {}) };
  }
  if (meta.relogio && f.relogio < meta.relogio) {
    return { id: 'cardio', tom: 'ideia', icone: 'heart', p: 6, titulo: 'Para emagrecer, um pouco mais de aeróbico',
      texto: `${f.relogio} minutos por semana. Acima de ${meta.relogio}, a perda de peso tende a ser maior.`, porque: `${meta.texto} Caminhada em passo firme conta e não soma impacto. A alimentação continua sendo o principal.`, refs };
  }
  if (!f.registros) return null;
  return { id: 'cardio', tom: 'bom', icone: 'heart', p: 9, titulo: 'Aeróbico da semana em dia', texto: `${meta.relogio ? f.relogio : f.equivalente} minutos por semana (meta: ${meta.relogio || meta.min}).`, porque: meta.texto, refs };
}

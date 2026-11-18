// Assuntos do Treinador de corrida no chat. Puro: sem DOM. Formato em logic/chat/contrato.js.
// As regras são as do plano de corrida (logic/corrida.js) e do treino perdido (logic/perdido.js): corrida perdida não se
// repõe (ref frandsen2025), dias sem treino ficam livres (logic/dias-livres.js: o plano já não marca corrida neles).
// Cada assunto fala do dia da conversa (ctx.data: "amanhã", "na sexta"; sem ele, hoje).
//  • ritmo (pace) do dia: a faixa que o plano já calcula (VDOT de Daniels, refs smyth2022 e vdoto2_*); sem resultado
//    recente, o esforço (escala de 0 a 10 e o teste da fala, ref foster2020);
//  • ir mais rápido ou correr mais: o que o plano e a análise dos registros já dizem — leve é leve (ref seiler2009), o
//    volume sobe até 10% por semana com semana leve a cada quatro (refs soligard2016, knopp2024, filipas2022), os ritmos
//    sobem um degrau a cada 4 a 6 semanas ou com um teste (ref vdoto2_ajuste), corrida mais de 10% maior que a mais longa
//    do mês aumenta o risco de lesão (ref frandsen2025); os alertas dos registros (logic/corrida.js alertas) vêm antes;
//  • ir mais devagar ou correr menos: devagar não é erro no leve (seiler2009); encurtar não precisa repor (refs feely2023,
//    pollock1998); cansaço que não passa pede reduzir (refs meeusen2013, saw2016);
//  • mudar a corrida de dia e como fica a semana: logic/perdido.js avaliarMoverCorrida (as regras do plano);
//  • esteira: logic/esteira.js (outro módulo; usado se existir), com a versão do treino em km/h e a inclinação. Sem ele, a
//    orientação de Miller 2019 (ref miller2019): 0 a 1% nos leves, 1% nos fortes, guiar-se pelo esforço.
import * as P from '../perdido.js';
import { temCorrida } from '../combinado.js';
import { doresAtivas } from '../dor.js';
import { planoAtual, treinoDoDia as corridaDoDia, alertas, analiseRecente, fmtFaixa, textoBloco } from '../corrida.js';
import { corridaDeHoje, corridaChave, treinoDeHoje, passoJuntar, passoDor, acaoNaoCorrer, passoSemana, diaDe, cap } from './treino.js';
import { faqDe, nomeDia, noDia, diaValido, segundaDa, somaDia } from './comum.js';
import { FAQ_CORRIDA, TIPOS_TREINO } from '../../data/corrida.js';

// a versão na esteira (logic/esteira.js) é de outro módulo: sem ele, o chat segue com a orientação geral
let EST = null;
try { EST = await import('../esteira.js'); } catch { EST = null; }
const temEsteira = () => !!(EST && typeof EST.versaoNaEsteira === 'function' && typeof EST.podeNaEsteira === 'function' && typeof EST.marcarEsteira === 'function');

const emIso = (ctx) => new Date(Number.isFinite(ctx && ctx.agora) ? ctx.agora : Date.now()).toISOString();
const temPlano = (ctx) => { try { return !!planoAtual(ctx.st, ctx.hoje); } catch { return false; } };
const correuEm = (ctx, data) => (Array.isArray(ctx.st.runs) ? ctx.st.runs : []).some((r) => r && r.data === data);
const correuHoje = (ctx) => correuEm(ctx, ctx.hoje);
const abrirDia = (data) => ({ rotulo: 'Abrir a corrida do dia', rota: 'corrida/dia/' + data });
const abrirHoje = (ctx) => ({ rotulo: 'Abrir a corrida de hoje', rota: 'corrida/dia/' + ctx.hoje });
const nomeMin = (d) => String(d.nome || 'corrida').toLowerCase();
// "a corrida de hoje (regenerativo)": o nome do treino pode ser masculino ou feminino
const doDia = (data, hoje) => (data === hoje ? 'de hoje' : `de ${nomeDia(data, hoje)}`);
// A corrida do plano num dia (sem descanso), ou null
export function corridaNoDia(ctx, data) {
  try { const d = corridaDoDia(ctx.st, ctx.hoje, data); return d && d.tipo && d.tipo !== 'descanso' ? d : null; } catch { return null; }
}
// a próxima corrida do plano a partir de `data` (até 7 dias), ou null
function proximaCorrida(ctx, data) {
  for (let k = 0; k < 8; k++) { const x = somaDia(data, k); if (x < ctx.hoje) continue; const d = corridaNoDia(ctx, x); if (d && !correuEm(ctx, x) && !P.corridaPerdidaEm(ctx.st, x)) return d; }
  return null;
}

// Nesse dia não há o que decidir: sem corrida no plano, ou ela já foi registrada / marcada
function semCorridaNoDia(ctx, data = diaDe(ctx)) {
  const quando = noDia(data, ctx.hoje);
  if (correuEm(ctx, data)) return { texto: [data === ctx.hoje ? 'Você já registrou uma corrida hoje. Bom trabalho!' : `Você já registrou uma corrida ${quando}.`], ir: [abrirDia(data)] };
  const m = P.corridaPerdidaEm(ctx.st, data);
  if (m && m.para) return { texto: [`A corrida ${doDia(data, ctx.hoje)} passou para ${nomeDia(m.para, ctx.hoje)}.`], ir: [abrirDia(m.para)] };
  if (m) return { texto: [`A corrida ${doDia(data, ctx.hoje)} já está marcada como não feita. Siga o plano.`], ir: [{ rotulo: 'Ver a semana', rota: 'corrida' }] };
  const prox = proximaCorrida(ctx, somaDia(data, 1));
  return { texto: [data === ctx.hoje ? 'Hoje o plano não tem corrida: aproveite o descanso.' : `${cap(quando)} o plano não tem corrida.`, ...(prox ? [`A próxima é ${noDia(prox.data, ctx.hoje)}: ${nomeMin(prox)}.`] : [])], ir: [{ rotulo: 'Ver a semana', rota: 'corrida' }] };
}

// ---------- a corrida do dia, o ritmo, mais rápido e mais devagar ----------
const linhaEsforco = (d) => (d.pse ? `Esforço de ${d.pse[0]} a ${d.pse[1]} em 10${d.fala ? `: ${String(d.fala).toLowerCase()}` : ''}.` : '');
function linhasDeRitmo(d) {
  if (d.ritmo) return [`Ritmo: ${fmtFaixa(d.ritmo, d.modo)}.`];
  const comRitmo = (Array.isArray(d.blocos) ? d.blocos : []).filter((b) => b && b.ritmo);
  return comRitmo.length ? comRitmo.slice(0, 3).map((b) => '• ' + textoBloco(b, d.modo)) : [];
}
export function passoCorridaDoDia(ctx) {
  const data = diaDe(ctx), hoje = ctx.hoje;
  const d = corridaNoDia(ctx, data);
  if (!d || correuEm(ctx, data) || P.corridaPerdidaEm(ctx.st, data)) return semCorridaNoDia(ctx, data);
  const tipo = TIPOS_TREINO[d.tipo] || null;
  const texto = [`${cap(noDia(data, hoje))} é dia de ${nomeMin(d)}: ${d.resumo}.`, ...linhasDeRitmo(d)];
  if (!d.ritmo) texto.push(linhaEsforco(d));
  if (d.movidaDe) texto.push(`Ela veio de ${nomeDia(d.movidaDe, hoje)}.`);
  const out = {
    texto: texto.filter(Boolean), data,
    detalhes: [d.detalhe, tipo ? tipo.paraQue : ''].filter(Boolean),
    refs: tipo ? tipo.f : [],
    ir: [abrirDia(data)],
  };
  if (data >= hoje && segundaDa(data) === segundaDa(hoje)) {
    out.opcoes = [{ rotulo: 'Qual o meu ritmo?', valor: 'ritmo' }, { rotulo: 'Posso mudar de dia?', valor: 'mover' }, { rotulo: 'Como fica a semana', valor: 'semana' }];
    out.proximo = (v, c) => (v === 'ritmo' ? passoRitmo({ ...c, data }) : v === 'mover' ? passoMover({ ...c, data, de: data }) : passoSemana({ ...c, data }, 'corrida'));
  }
  return out;
}
export function passoRitmo(ctx) {
  const data = diaDe(ctx), hoje = ctx.hoje;
  const d = corridaNoDia(ctx, data);
  if (!d) return semCorridaNoDia(ctx, data);
  let pl = null;
  try { pl = planoAtual(ctx.st, hoje); } catch { pl = null; }
  const ritmo = linhasDeRitmo(d);
  const texto = [`${cap(noDia(data, hoje))}, ${nomeMin(d)}.`];
  if (ritmo.length) texto.push(...ritmo, linhaEsforco(d));
  else {
    if (d.pse) texto.push(`Vai pelo esforço: ${d.pse[0]} a ${d.pse[1]} em 10${d.fala ? ` (${String(d.fala).toLowerCase()})` : ''}.`);
    const z = pl && pl.zonas && Array.isArray(pl.zonas.lista) ? pl.zonas.lista.find((x) => x.id === (d.intensidade === 'forte' ? 'forte' : d.intensidade === 'moderado' ? 'moderado' : 'leve')) : null;
    if (z && z.fc && d.modo === 'fc') texto.push(`Pela frequência cardíaca: de ${z.fc[0]} a ${z.fc[1]} batimentos por minuto.`);
    if (pl && !pl.ritmos) texto.push('Para ter o ritmo calculado, registre um “Teste de ritmo” de 3 ou 5 km.');
  }
  const f = faqDe(FAQ_CORRIDA, 'Como os ritmos dos treinos são calculados');
  const g = faqDe(FAQ_CORRIDA, 'Devo treinar por ritmo');
  return {
    texto: texto.filter(Boolean), data,
    detalhes: [...(f ? f.a.slice(0, 1) : []), ...(g ? g.a.slice(0, 1) : [])],
    refs: [...(f ? f.refs : []), ...(g ? g.refs : [])].slice(0, 8),
    opcoes: [{ rotulo: 'Posso ir mais rápido?', valor: 'rapido' }, { rotulo: 'E se eu for mais devagar?', valor: 'devagar' }],
    proximo: (v, c) => (v === 'rapido' ? passoMaisRapido({ ...c, data }) : passoMaisDevagar({ ...c, data })),
  };
}
function perfilDoPlano(ctx) { try { const p = planoAtual(ctx.st, ctx.hoje); return p ? p.perfil : null; } catch { return null; } }
export function passoMaisRapido(ctx) {
  const data = diaDe(ctx), hoje = ctx.hoje;
  const d = corridaNoDia(ctx, data);
  const pf = perfilDoPlano(ctx);
  let al = [];
  try { al = alertas(ctx.st.runs, hoje).filter((x) => x.tipo === 'warn'); } catch { al = []; }
  const dores = (() => { try { return doresAtivas(ctx.st, hoje); } catch { return []; } })();
  const texto = [], detalhes = [], refs = [];
  let aviso;
  if (dores.length) { texto.push('Com a dor que você contou, não aumente agora: siga os ajustes que o plano já fez.'); refs.push('esculier2016'); }
  else if (al.length) { texto.push('Agora não aumente.'); aviso = { tipo: 'warn', texto: al[0].texto }; refs.push(...(al[0].refs || [])); }
  else if (pf && pf.gestante) { texto.push('Na gestação, fique numa intensidade em que dá para conversar durante a corrida.'); refs.push('csep2019', 'sbc_gestacao2021'); }
  else if (d && d.intensidade === 'leve') { texto.push('Hoje é dia leve: não acelere.'.replace('Hoje', cap(noDia(data, hoje)))); texto.push('Os dias leves fazem a base. Correr rápido neles cansa para os dias fortes.'); refs.push('seiler2009'); }
  else if (d) { texto.push('No treino forte, fique na faixa do plano: mais rápido que isso soma cansaço, não ganho.'); refs.push('vdoto2_definicoes', 'saw2016', 'buchheit2014'); }
  else texto.push('O plano já aumenta sozinho, no ritmo certo para você.');
  texto.push('O plano sobe o volume até 10% por semana, com uma semana mais leve a cada quatro.');
  refs.push('soligard2016', 'knopp2024', 'filipas2022');
  detalhes.push('Os ritmos sobem um degrau a cada 4 a 6 semanas de treino em dia. Um “Teste de ritmo” de 3 ou 5 km recalcula tudo na hora.');
  detalhes.push('Não corra mais do que o planejado: uma corrida mais de 10% maior que a mais longa dos últimos 30 dias aumenta o risco de lesão.');
  refs.push('vdoto2_ajuste', 'frandsen2025');
  try { const pad = analiseRecente(ctx.st, hoje).padroes.find((x) => x.id === 'rapido_facil'); if (pad) { detalhes.unshift(pad.texto); refs.push(...pad.refs); } } catch { /* sem registros */ }
  return { texto, aviso, detalhes, refs, data, ir: [{ rotulo: 'Abrir a corrida', rota: 'corrida' }] };
}
export function passoMaisDevagar(ctx) {
  const data = diaDe(ctx), hoje = ctx.hoje;
  const d = corridaNoDia(ctx, data);
  const texto = ['Pode. No treino leve, devagar não é erro.', 'Se está pesado, diminua até conseguir falar frases inteiras.', 'Encurtar um treino de vez em quando não precisa ser reposto.'];
  if (d && d.intensidade === 'forte') texto.splice(0, 3, 'Pode. Se o treino forte não está saindo, faça uma corrida leve no lugar.', 'Perder uma sessão forte de vez em quando não derruba o condicionamento: o plano segue no próximo.');
  if (d && d.tipo === 'regenerativo') texto.push('Se estiver muito cansado, troque por uma caminhada.');
  const detalhes = ['Cansaço que não passa em uma semana é sinal para reduzir os treinos. Se durar mais de 4 semanas, procure um médico.', 'O plano ajusta o volume pelo que você registra: registre o esforço de cada corrida.'];
  const refs = ['seiler2009', 'feely2023', 'pollock1998', 'meeusen2013', 'saw2016'];
  try { const pad = analiseRecente(ctx.st, hoje).padroes.find((x) => x.id === 'leve_pesado'); if (pad) { detalhes.unshift(pad.texto); refs.push(...pad.refs); } } catch { /* sem registros */ }
  return { texto, detalhes, refs, data, ir: [{ rotulo: 'Abrir a corrida', rota: 'corrida' }] };
}

// ---------- mudar a corrida de dia (logic/perdido.js avaliarMoverCorrida) ----------
const PORQUE_MOVER = {
  ocupado: (para) => `${cap(noDia(para.d, para.h))} já tem corrida. O app não junta duas: uma corrida bem maior que a mais longa do mês aumenta o risco de lesão.`,
  dor: (para) => `${cap(noDia(para.d, para.h))} está sem corrida por causa da dor que você contou.`,
  bloqueado: (para) => `${cap(noDia(para.d, para.h))} é um dos dias em que você não treina.`,
  saude: (para) => `${cap(noDia(para.d, para.h))}, o problema de saúde que você contou ainda muda a corrida.`,
  forte_seguido: (para, a) => `Essa corrida (${a.nome.toLowerCase()}) é um treino forte ou o longão: ${noDia(para.d, para.h)} ela ficaria colada em outro treino forte, e eles nunca ficam em dias seguidos.`,
  pernas: (para, a) => `${cap(noDia(para.d, para.h))}, essa corrida (${a.nome.toLowerCase()}) ficaria perto do treino pesado de pernas: os dois ficam a 24 horas ou mais um do outro.`,
  sem_descanso: () => 'A semana ficaria sem nenhum dia de descanso.',
  feita: () => 'Essa corrida já foi feita ou marcada.',
  outra_semana: () => 'Só dá para mudar corridas dentro desta semana.',
  passou: () => 'Esse dia já passou.',
  sem_plano: () => 'O plano de corrida desta semana não está disponível.',
};
const REFS_MOVER = ['seiler2009', 'casado2022', 'frandsen2025', 'meeusen2013'];
// as datas da frase (o motor passa em ctx.datas), sem as de semana inteira
const datasDaFrase = (ctx) => (Array.isArray(ctx.datas) ? ctx.datas.filter((x) => x && !x.semana && diaValido(x.data)).map((x) => x.data) : []);
function deEPara(ctx) {
  const hoje = ctx.hoje, ds = datasDaFrase(ctx), t = typeof ctx.texto === 'string' ? ctx.texto : '';
  const temCorrida = (x) => !!corridaNoDia(ctx, x) && !correuEm(ctx, x) && !P.corridaPerdidaEm(ctx.st, x);
  let de = diaValido(ctx.de) ? ctx.de : '', para = '';
  if (ds.length >= 2) { if (/\b(em vez|no lugar|ao inves|inves)\b/.test(t)) { para = ds[0]; de = ds[1]; } else { de = ds[0]; para = ds[1]; } }
  else if (ds.length === 1) {
    const x = ds[0];
    if (de && de !== x) para = x;
    else if (/\b(para|pra|pro)\b/.test(t) || !temCorrida(x)) para = x; else de = x;
  } else if (!de && diaValido(ctx.data) && ctx.data !== hoje && diaValido(ctx.antes) && temCorrida(ctx.antes)) { de = ctx.antes; para = ctx.data; }
  if (!de) { const p = temCorrida(hoje) ? hoje : (proximaCorrida(ctx, hoje) || {}).data || ''; de = p; }
  if (para === de) para = '';
  return { de, para };
}
// a semana como fica com a corrida no dia novo: a marca aplicada numa cópia do estado
function semanaSimulada(ctx, de, para) {
  const s = JSON.parse(JSON.stringify(ctx.st));
  const m = P.marcaMoverCorrida(s, de, para, ctx.hoje, emIso(ctx));
  if (!m) return [];
  s.perdidos = P.limparPerdidos([...(Array.isArray(s.perdidos) ? s.perdidos : []), m]);
  const p = passoSemana({ ...ctx, st: s, data: de }, 'corrida');
  return p.texto.slice(1);
}
function diasPossiveis(ctx, de) {
  const out = [];
  for (let k = 0; k < 7; k++) {
    const x = somaDia(segundaDa(ctx.hoje), k);
    if (x < ctx.hoje || x === de) continue;
    let a;
    try { a = P.avaliarMoverCorrida(ctx.st, de, x, ctx.hoje); } catch { a = { pode: false }; }
    if (a.pode) out.push(x);
  }
  return out;
}
export function passoMover(ctx) {
  const hoje = ctx.hoje;
  const { de, para } = deEPara(ctx);
  if (!de) return { texto: ['Não há corrida nesta semana para mudar de dia.'], ir: [{ rotulo: 'Ver a semana', rota: 'corrida' }] };
  const d = corridaNoDia(ctx, de);
  if (!d || correuEm(ctx, de) || P.corridaPerdidaEm(ctx.st, de)) return semCorridaNoDia(ctx, de);
  const nome = `corrida ${doDia(de, hoje)} (${nomeMin(d)})`;
  const outros = diasPossiveis(ctx, de);
  const opcoesDe = (lista) => {
    const op = lista.slice(0, 5).map((x) => ({ rotulo: cap(nomeDia(x, hoje)), valor: x }));
    if (de <= hoje && P.podeMarcarCorrida(ctx.st, de, hoje)) op.push({ rotulo: 'Não vou correr', valor: '#nao' });
    return op;
  };
  // o motivo (P.MOTIVOS) segue a conversa e vai para a marca
  const motivo = P.MOTIVOS[ctx.motivo] ? ctx.motivo : '';
  const seguir = (v, c) => (v === '#nao' ? passoNaoCorrer({ ...c, data: de, motivo }) : passoMover({ ...c, de, data: v, datas: [{ data: de }, { data: v }], texto: '', motivo }));
  if (!para) {
    if (!outros.length) {
      return {
        texto: [`Nesta semana, nenhum outro dia recebe a ${nome} sem quebrar as regras do plano.`, 'Corrida perdida não se repõe: o plano segue.'],
        detalhes: ['Treino forte e longão nunca ficam em dias seguidos; uma corrida por dia; e pelo menos um dia de descanso na semana.'], refs: REFS_MOVER,
        ...(de <= hoje && P.podeMarcarCorrida(ctx.st, de, hoje) ? { acoes: [acaoNaoCorrer('Marcar como não feita', de)] } : {}), data: de,
      };
    }
    const op = opcoesDe(outros);
    return { texto: [`Para qual dia vai a ${nome}?`], opcoes: op.length >= 1 ? op : undefined, proximo: seguir, data: de, ...(op.length ? {} : { ir: [{ rotulo: 'Ver a semana', rota: 'corrida' }] }) };
  }
  let a;
  try { a = P.avaliarMoverCorrida(ctx.st, de, para, hoje); } catch { a = { pode: false, motivo: 'sem_plano', nome: d.nome }; }
  if (a.pode) {
    const semana = semanaSimulada(ctx, de, para);
    let naEst = false;
    try { naEst = temEsteira() && typeof EST.naEsteira === 'function' && EST.naEsteira(ctx.st, de); } catch { naEst = false; }
    return {
      texto: [`Pode: a ${nome} vai para ${nomeDia(para, hoje)}.`, ...(naEst ? ['Ela estava marcada na esteira: a esteira vai junto, se der no dia novo.'] : []), 'Assim fica a semana:', ...(semana.some((l) => /passou para|veio de/.test(l)) ? semana.filter((l) => /passou para|veio de/.test(l)) : semana)],
      detalhes: ['Conferi as regras do plano: uma corrida por dia, treino forte e longão nunca em dias seguidos, os dias em que você não treina, o treino de pernas e pelo menos um dia de descanso.'],
      refs: [...REFS_MOVER, ...(a.chave ? ['blagrove2018'] : [])],
      acoes: [{
        rotulo: `Passar para ${nomeDia(para, hoje)}`,
        confirmar: `A ${nome} vai para ${nomeDia(para, hoje)}. O resto da semana não muda.`,
        aplicar: (s, c) => {
          const m = P.marcaMoverCorrida(s, de, para, c.hoje, emIso(c), motivo);
          if (!m) return false;
          // a marca de esteira (logic/esteira.js) é do dia: se o dia antigo era na esteira, ela vai junto para o dia novo
          const naEst = temEsteira() && typeof EST.naEsteira === 'function' && EST.naEsteira(s, de);
          s.perdidos = P.limparPerdidos([...(Array.isArray(s.perdidos) ? s.perdidos : []), m]);
          if (naEst) {
            try { EST.marcarEsteira(s, de, false, c.hoje); } catch { /* segue */ }
            try { if (EST.podeNaEsteira(s, para, c.hoje).pode) EST.marcarEsteira(s, para, true, c.hoje); } catch { /* fica na rua */ }
          }
          return true;
        },
        depois: `Pronto: a ${nome} ficou para ${nomeDia(para, hoje)}.`, data: para, semana: true,
      }],
      data: de,
    };
  }
  const porque = (PORQUE_MOVER[a.motivo] || PORQUE_MOVER.sem_plano)({ d: para, h: hoje }, { nome: a.nome || d.nome });
  const resto = outros.filter((x) => x !== para);
  const op = opcoesDe(resto);
  return {
    texto: [porque, resto.length ? 'Dá para mudar para:' : 'Nesta semana não há outro dia que respeite as regras do plano. Corrida perdida não se repõe: o plano segue.'],
    refs: [...REFS_MOVER, ...(a.motivo === 'pernas' ? ['blagrove2018', 'doma2017'] : [])],
    ...(op.length ? { opcoes: op, proximo: seguir } : { ir: [{ rotulo: 'Ver a semana', rota: 'corrida' }] }),
    data: de,
  };
}

// ---------- chuva e esteira ----------
export function passoEsteira(ctx) {
  const data = diaDe(ctx), hoje = ctx.hoje;
  const d = corridaNoDia(ctx, data);
  if (temEsteira()) {
    let v = null, pode = { pode: false, motivo: '' }, ja = false;
    try { v = EST.versaoNaEsteira(ctx.st, data, hoje); } catch { v = null; }
    try { pode = EST.podeNaEsteira(ctx.st, data, hoje) || pode; } catch { /* segue sem a ação */ }
    try { ja = typeof EST.naEsteira === 'function' && !!EST.naEsteira(ctx.st, data); } catch { ja = false; }
    if (v && typeof v === 'object') {
      const linhas = (Array.isArray(v.linhas) ? v.linhas : []).filter((t) => typeof t === 'string').slice(0, 5);
      const avisos = (Array.isArray(v.avisos) ? v.avisos : []).filter((t) => typeof t === 'string');
      const out = {
        texto: [typeof v.titulo === 'string' && v.titulo ? v.titulo : `${cap(noDia(data, hoje))} na esteira:`, ...linhas],
        aviso: avisos.length ? { tipo: 'info', texto: avisos[0] } : { tipo: 'info', texto: 'Prenda a chave de segurança da esteira na roupa.' },
        detalhes: [...avisos.slice(1), ...(Array.isArray(v.detalhes) ? v.detalhes : [])].filter((t) => typeof t === 'string'),
        refs: Array.isArray(v.refs) ? v.refs : ['miller2019'], data, ir: [abrirDia(data)], acoes: [],
      };
      if (ja) {
        out.texto.splice(1, 0, `A corrida ${doDia(data, hoje)} já está marcada na esteira.`);
        out.acoes.push({ rotulo: 'Voltar para a rua', confirmar: `A corrida ${doDia(data, hoje)} volta a ser na rua, com o ritmo do plano.`, aplicar: (s, c) => EST.marcarEsteira(s, data, false, c.hoje) !== false, depois: 'Pronto: a corrida volta a ser na rua.', data });
      } else if (pode && pode.pode) {
        out.acoes.push({ rotulo: 'Fazer na esteira', confirmar: `A corrida ${doDia(data, hoje)} passa a ser na esteira, com a velocidade e a inclinação acima. Dá para voltar para a rua depois.`, aplicar: (s, c) => EST.marcarEsteira(s, data, true, c.hoje) === true, depois: 'Pronto: a corrida do dia está na esteira.', data });
      } else if (pode && typeof pode.motivo === 'string' && pode.motivo) out.texto.push(pode.motivo);
      return out;
    }
    if (d && pode && typeof pode.motivo === 'string' && pode.motivo && !pode.pode) return { texto: [pode.motivo], refs: ['miller2019'], ir: [abrirDia(data)], data };
  }
  const forte = corridaChave(d) && d.tipo !== 'longo';
  const f = faqDe(FAQ_CORRIDA, 'Correr na esteira');
  return {
    texto: [
      d ? `Pode fazer a corrida ${doDia(data, hoje)} (${nomeMin(d)}) na esteira.` : 'Pode correr na esteira.',
      forte ? 'No treino forte, use 1% de inclinação.' : 'Na corrida leve, a inclinação pode ficar entre 0 e 1%.',
      'Guie-se pelo esforço: na esteira, o mesmo esforço sai um pouco mais devagar.',
    ],
    aviso: { tipo: 'info', texto: 'Prenda a chave de segurança da esteira na roupa.' },
    detalhes: f ? f.a : [],
    refs: ['miller2019'],
    ir: d ? [abrirDia(data)] : [],
    data,
  };
}
export function passoNaoCorrer(ctx, antes = []) {
  const data = diaDe(ctx), hoje = ctx.hoje;
  const motivo = P.MOTIVOS[ctx.motivo] ? ctx.motivo : '';
  if (data > hoje) {
    const d = corridaNoDia(ctx, data);
    if (!d) return semCorridaNoDia(ctx, data);
    return {
      texto: [...antes, `Tudo bem. A corrida ${doDia(data, hoje)} (${nomeMin(d)}) não precisa ser reposta.`, 'Quer passar para outro dia da semana?'],
      detalhes: ['Juntar a corrida perdida a outra faz uma corrida maior. Uma corrida mais de 10% maior do que a mais longa dos últimos 30 dias aumenta o risco de lesão.'],
      refs: P.REFS_CORRIDA, data,
      opcoes: [{ rotulo: 'Mudar de dia', valor: 'mover' }, { rotulo: 'Só pular essa', valor: 'pular' }],
      proximo: (v, c) => (v === 'mover' ? passoMover({ ...c, de: data, data }) : { texto: [`Combinado. ${cap(noDia(data, c.hoje))}, marque “Não corri” na tela da corrida (ou me avise): o plano segue.`], ir: [{ rotulo: 'Ver a semana', rota: 'corrida' }] }),
    };
  }
  if (!P.podeMarcarCorrida(ctx.st, data, hoje)) return semCorridaNoDia(ctx, data);
  return {
    texto: [...antes, 'Tudo bem. Corrida perdida não se repõe: siga o plano.'],
    detalhes: ['Juntar a corrida perdida a outra faz uma corrida maior. Uma corrida mais de 10% maior do que a mais longa dos últimos 30 dias aumenta o risco de lesão.', 'O volume das próximas semanas acompanha o que você de fato correu.'],
    refs: P.REFS_CORRIDA,
    acoes: [acaoNaoCorrer('Marcar como não feita', data === hoje ? '' : data, motivo)],
    data,
  };
}
function passoMaisTarde(ctx) {
  if (treinoDeHoje(ctx)) return passoJuntar(ctx);
  return { texto: ['Pode correr mais tarde, no mesmo dia: o treino continua o mesmo.'], ir: [abrirHoje(ctx)] };
}
// Choveu ou não dá para correr na rua
function passoChuva(ctx) {
  const data = diaDe(ctx), hoje = ctx.hoje;
  const d = corridaNoDia(ctx, data);
  if (!d || correuEm(ctx, data) || P.corridaPerdidaEm(ctx.st, data)) {
    // sem corrida nesse dia: a esteira ainda serve para outro dia
    const s = semCorridaNoDia(ctx, data);
    return { ...s, texto: [...s.texto, 'Se chover no dia de correr, a esteira serve.'], refs: ['miller2019'] };
  }
  const opcoes = [{ rotulo: 'Correr na esteira', valor: 'esteira' }];
  if (data === hoje) opcoes.push({ rotulo: 'Correr mais tarde hoje', valor: 'tarde' });
  opcoes.push({ rotulo: 'Correr em outro dia', valor: 'mover' }, { rotulo: data === hoje ? 'Não vou correr hoje' : `Não vou correr ${noDia(data, hoje)}`, valor: 'nao' });
  return {
    texto: [`${cap(noDia(data, hoje))} é dia de ${nomeMin(d)}. O que prefere?`],
    opcoes,
    proximo: (v, c) => (v === 'esteira' ? passoEsteira({ ...c, data }) : v === 'tarde' ? passoMaisTarde(c) : v === 'mover' ? passoMover({ ...c, de: data, data }) : passoNaoCorrer({ ...c, data })),
    data,
  };
}
function passoCorridaPerdida(ctx) {
  const data = diaDe(ctx), hoje = ctx.hoje;
  if (data > hoje) return passoNaoCorrer(ctx);
  if (!corridaNoDia(ctx, data) || !P.podeMarcarCorrida(ctx.st, data, hoje)) return semCorridaNoDia(ctx, data);
  if (data < hoje) return passoNaoCorrer(ctx);
  // o dia que a pessoa pediu na frase ("não vou correr hoje, dá para correr amanhã?")
  const quer = (Array.isArray(ctx.datas) ? ctx.datas : []).filter((x) => x && !x.semana && diaValido(x.data) && x.data > data).map((x) => x.data).sort()[0] || '';
  const mover = (c, motivo) => passoMover({ ...c, de: data, motivo, ...(quer ? { data: quer, datas: [{ data }, { data: quer }], texto: '' } : { data }) });
  return {
    texto: ['O que aconteceu?'],
    opcoes: [{ rotulo: 'Estou sem tempo', valor: 'tempo' }, { rotulo: 'Chuva ou sem lugar', valor: 'chuva' }, { rotulo: 'Estou com dor', valor: 'dor' }, { rotulo: 'Estou doente', valor: 'doente' }, { rotulo: quer ? `Quero correr ${nomeDia(quer, hoje)}` : 'Quero correr outro dia', valor: 'mover' }, { rotulo: 'Outro motivo', valor: 'outro' }],
    proximo: (v, c) => {
      if (v === 'chuva') return passoChuva(c);
      if (v === 'dor') return passoDor(c, 'corrida');
      if (v === 'tempo') return mover(c, 'tempo');
      if (v === 'mover') return mover(c, 'outro');
      if (v === 'doente') {
        const f = faqDe(FAQ_CORRIDA, 'Posso correr gripado');
        const p = passoNaoCorrer({ ...c, data, motivo: 'doente' }, ['Com febre, dor no corpo ou cansaço fora do normal, não corra hoje.']);
        return f ? { ...p, detalhes: [...f.a.slice(0, 2), ...(p.detalhes || [])], refs: [...f.refs, ...(p.refs || [])] } : p;
      }
      return passoNaoCorrer({ ...c, data, motivo: 'outro' });
    },
    data,
  };
}

const comPlano = (ctx) => temCorrida(ctx.st) && temPlano(ctx);
// bônus do motor: uma data na frase ("para amanhã", "sexta") puxa para mudar de dia
const comDuasDatas = (i) => i.datas.filter((d) => !d.semana).length >= 2;
const comDataFutura = (i) => i.datas.some((d) => !d.semana && d.data !== i.hoje) && /\b(mudar|mudo|passar|passo|trocar|troco|adiar|adio|deixar|deixo|remarcar|mover|antecipar|adiantar|fizer|jogar|empurrar|em vez|no lugar)\b/.test(i.texto);
export const INTENCOES = [
  {
    id: 'chuva', coach: 'corrida', titulo: 'Choveu ou não dá para correr na rua', resumo: 'chuva ou não poder correr na rua', data: true,
    palavras: ['caindo mundo', 'caindo agua', 'tempo fechado', 'nao da pra sair', 'nao da sair', 'nao consigo sair', '!alagado', '!alagada', 'rua alagada', '!chuva', 'correr+chuva', 'chuva nao correr', 'esta chuva', 'ta chuva', 'chuva forte', 'correr rua', 'nao da correr rua', 'sem lugar correr', 'escuro', 'tempo ruim', 'tempo ruim correr', 'clima', 'frio demais', 'muito frio', 'frio correr', 'frio rua', 'alagado', 'rua molhada', 'calor demais', 'muito calor', 'perigoso rua', 'raio', 'trovao'],
    disponivel: comPlano,
    inicio: passoChuva,
  },
  {
    id: 'esteira', coach: 'corrida', titulo: 'Correr na esteira', resumo: 'correr na esteira', resumoNoDia: 'correr na esteira', data: true,
    palavras: ['!esteira', 'correr esteira', 'inclinacao', 'inclinacao esteira', 'esteira inclinacao', 'esteira igual rua', 'esteira vale', 'velocidade esteira', 'esteira+velocidade', 'adaptar+esteira', 'adapto+esteira', 'esteira casa', 'tenho esteira', '!correr parado', 'correr no lugar', 'correr dentro casa', 'na academia correr', 'correr academia', 'treadmill'],
    disponivel: comPlano,
    inicio: passoEsteira,
  },
  {
    id: 'corrida-dia', coach: 'corrida', titulo: 'Qual é a minha corrida', resumo: 'a corrida de hoje', resumoNoDia: 'a corrida', data: true,
    palavras: ['qual correr', 'correr dia', 'tenho correr', 'tem correr', 'quanto correr', 'quantos km', 'quantos quilometro', '!distancia', 'quanto tempo correr', 'tempo correr', 'duracao correr', 'quanto tempo dura', 'quanto dura', 'treino correr', 'qual treino', 'treino amanha', 'treino dia', 'programado', 'quanto tempo', 'vou correr quanto', 'qual e treino'],
    disponivel: comPlano,
    inicio: passoCorridaDoDia,
  },
  {
    id: 'ritmo', coach: 'corrida', titulo: 'Qual o meu ritmo (pace)', resumo: 'o ritmo da corrida de hoje', resumoNoDia: 'o ritmo da corrida', data: true,
    palavras: ['!pace', '!ritmo', '!velocidade', '!km hora', 'km por hora', 'qual ritmo', 'que ritmo', 'velocidade', 'minuto por km', 'min km', 'por km', 'quao rapido', 'que velocidade', 'kmh', 'ritmo certo', 'frequencia cardiaca', 'batimento', 'zona', 'em que ritmo', 'quanto por km', 'qual pace', 'meu pace'],
    disponivel: comPlano,
    inicio: passoRitmo,
  },
  {
    id: 'mais-rapido', coach: 'corrida', titulo: 'Posso correr mais rápido?', resumo: 'correr mais rápido ou mais longe', data: true,
    palavras: ['mais rapido', 'correr rapido', 'correr mais rapido', '!aumentar ritmo', '!acelerar', 'aumentar', '!subir ritmo', '!apertar ritmo', 'subir ritmo', '!aumentar distancia', 'correr mais', 'aumentar km', '!puxar mais', 'aumentar volume', 'ta facil', 'muito facil', 'esta facil', 'muito leve', 'quero mais', 'fazer mais', 'correr mais longe', 'apertar ritmo', 'baixar pace', 'melhorar pace', 'melhorar tempo', 'ficar mais rapido', 'evoluir', 'ir mais rapido', 'puxar mais', 'forcar'],
    disponivel: comPlano,
    inicio: passoMaisRapido,
  },
  {
    id: 'mais-devagar', coach: 'corrida', titulo: 'Posso ir mais devagar?', resumo: 'correr mais devagar ou menos', data: true,
    palavras: ['caminhar meio', 'andar pouco', 'parar caminhar', 'caminhar pouco', 'mais devagar', '!devagar', 'diminuir', 'mais leve', 'fazer mais leve', 'pegar leve', 'mais tranquilo', 'mais calmo', 'sem gas', 'sem energia', '!diminuir ritmo', '!baixar ritmo', 'correr menos', '!reduzir', 'encurtar', 'encurtar correr', 'ta pesado', 'muito pesado', 'muito dificil', 'nao aguento', 'nao aguentei', 'muito forte', 'pesado', 'diminuir distancia', 'menos km', 'cansado', '!cansado ritmo', 'ritmo pesado', 'pesado ritmo', 'ritmo forte demais', 'parar meio', 'caminhar', 'cansativo', '!puxado', 'sem folego', 'ofegante', 'baixar ritmo', 'ir mais devagar'],
    disponivel: comPlano,
    inicio: passoMaisDevagar,
  },
  {
    id: 'mover-corrida', coach: 'corrida', titulo: 'Mudar a corrida de dia', resumo: 'mudar a corrida de dia', data: true,
    palavras: ['trocar dia', 'dia longao', 'trocar dia longao', 'mudar dia longao', 'mudar longao', 'mudar correr amanha', 'passar correr amanha', 'correr outro dia', 'adiar correr', 'deixar correr amanha', 'remarcar correr', 'mudar para amanha', 'passar para amanha', 'adiar', 'antecipar', 'adiantar', 'correr lugar', 'em vez de', 'no lugar de', 'outro dia', 'passar para', 'jogar correr', 'jogar para', 'empurrar correr', 'mudar correr', 'passar correr', 'mudar correr dia', 'mudar correr outro dia', 'correr de dia', 'fizer', 'fazer correr'],
    bonus: (i) => (comDuasDatas(i) ? 3 : comDataFutura(i) ? 1.5 : 0),
    disponivel: comPlano,
    inicio: passoMover,
  },
  {
    id: 'semana-corrida', coach: 'corrida', titulo: 'Como fica a minha semana', resumo: 'a sua semana de treinos', data: true,
    palavras: ['!quilometragem', 'km semanal', '!semanal', 'semana toda', 'km semana', 'quantos km semana', 'total semana', 'como fica semana', 'minha semana', 'semana', '!agenda', 'agenda semana', 'programacao', 'treinos semana', '!calendario', '!cronograma', 'tenho semana', 'tem semana', 'ver semana', 'semana treino', 'semana treinos', 'semana correr', 'como ta', 'como esta', 'resto semana', 'proximos dia', 'proximos treinos', 'como ficou semana', 'quais dia correr', 'que dia correr', 'dias correr', 'como fica', 'como ficou'],
    disponivel: (ctx) => temCorrida(ctx.st),
    inicio: (ctx) => passoSemana(ctx, 'corrida'),
  },
  {
    id: 'juntar-corrida', coach: 'corrida', titulo: 'Corrida e musculação no mesmo dia', resumo: 'fazer corrida e musculação no mesmo dia',
    palavras: ['!leg day', 'perna+longao', 'treino perna+longao', 'esteira+depois treino', 'esteira+logo depois', 'correr+musculacao', 'correr+exercicio', 'correr+treino', 'correr+academia', '!em que ordem', 'correr+treino+juntar', 'correr+academia+mesmo dia', '!intervalo entre', 'correr+intervalo', 'correr+horas entre', 'correr+seguida', 'correr+colado', 'correr+logo depois', 'mesmo dia', 'juntar', 'juntar outro', 'correr depois', 'correr antes', 'depois musculacao', 'antes musculacao', 'qual primeiro', 'ordem', 'prioridade'],
    disponivel: (ctx) => { try { return temCorrida(ctx.st) && !!P.planoAtivo(ctx.st); } catch { return false; } },
    inicio: (ctx) => passoJuntar(ctx),
  },
  {
    id: 'corrida-perdida', coach: 'corrida', titulo: 'Não vou correr hoje', resumo: 'faltar à corrida de hoje', resumoNoDia: 'faltar à corrida', data: true, prioridade: 1,
    bonus: (i) => (i.datas.some((d) => d.data === i.hoje) && i.datas.some((d) => !d.semana && d.data > i.hoje) && /\b(nao|nem)\b/.test(i.texto) ? 1.5 : 0),
    palavras: ['nao rola correr', 'nao rola', 'sem correr', 'nao vou correr', 'nao quero correr', 'sem vontade correr', 'nao consigo correr', 'nao posso correr', 'nao vou poder correr', 'nao corri', 'nao deu correr', 'perder correr', 'perdi correr', 'faltar correr', 'pular correr', 'faltar', 'sem tempo correr', 'nao vai dar correr', 'nao vou conseguir correr', 'doente', 'gripado', 'gripe'],
    disponivel: comPlano,
    inicio: passoCorridaPerdida,
  },
  {
    id: 'dor-corrida', coach: 'corrida', titulo: 'Estou com dor', resumo: 'uma dor', prioridade: 3,
    palavras: ['latejando', 'lateja', 'estalou', 'sola pe', 'dor', 'dor depois correr', 'dor muscular', 'machucar', 'lesao', 'canela', 'dor canela', 'dor joelho', 'dor pe', 'dor tornozelo', 'dor quadril', 'dor panturrilha', 'aquiles', 'fascite', 'canelite', 'tendinite', 'estou dor', 'to dor', 'tou dor', 'sinto dor', 'senti dor', '!fisgada', 'pontada', 'torci', 'estou dolorido', 'todo dolorido', 'joelho dor', 'dor joelho', 'ombro dor', 'dor ombro', 'costas dor', 'dor costas', 'lombar dor', 'dor lombar', 'punho dor', 'dor punho', 'cotovelo dor', 'dor cotovelo', 'tornozelo dor', 'dor tornozelo', 'quadril dor', 'dor quadril', 'panturrilha dor', 'dor panturrilha', 'canela dor', 'dor canela', 'pe dor', 'dor pe', 'coxa dor', 'dor coxa', 'perna dor', 'dor perna', 'pescoco dor', 'dor pescoco', 'braco dor', 'dor braco', 'gluteo dor', 'dor gluteo', 'virilha dor', 'dor virilha'],
    inicio: (ctx) => passoDor(ctx, 'corrida'),
  },
  {
    id: 'mudar-corrida', coach: 'corrida', titulo: 'Mudar o plano de corrida', resumo: 'mudar o plano de corrida',
    // "mudar os dias da corrida" (os dias do plano) não é "mudar o dia da corrida" (uma corrida para outro dia)
    bonus: (i) => (/\bdias\b/.test(i.texto) && /\b(mud\w*|troc\w*|alter\w*|quantidade|quantos|outros)\b/.test(i.texto) ? 5 : 0),
    palavras: ['reiniciar plano', 'recomecar plano', 'plano do comeco', 'meu alvo', '!planilha', 'refazer planilha', 'quantidade dias', 'quantidade de dias', 'quantos dias correr', 'treinar pra prova', '10k', '21k', '!maratona', 'meia maratona', 'vezes semana', 'correr vezes', 'mais dias', 'menos dias', 'mudar plano', 'mudar dias', 'refazer plano', 'refazer entrevista', 'outro plano', 'plano novo', 'nova prova', 'mudar prova', 'mudar objetivo', 'mudar', 'pausar plano', 'parar plano', 'mudar dias semana', 'dias da semana'],
    disponivel: (ctx) => temCorrida(ctx.st),
    inicio: () => ({
      texto: ['Os dias, a prova e o tempo mudam nas respostas da entrevista.', 'Ao terminar, o plano novo começa da semana 1. As corridas registradas continuam.'],
      detalhes: ['Para uma semana de folga (férias, doença), use “Pausar o plano” na tela da corrida: ao voltar, ele retoma aos poucos.', 'Para mudar só uma corrida desta semana de dia, diga para qual dia: por exemplo, “posso passar a corrida para amanhã?”.'],
      ir: [{ rotulo: 'Mudar as respostas', abrir: 'corrida-entrevista' }, { rotulo: 'Abrir a corrida', rota: 'corrida' }],
    }),
  },
];

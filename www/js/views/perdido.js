// "Não treinei" e "Não corri": a folha pergunta o motivo, mostra a proposta do treinador (passar para amanhã ou para outro
// dia desta semana, ou seguir a semana), a semana como fica e grava a marca; a linha do dia marcado e o "Desfazer".
// As regras (e as fontes) ficam em logic/perdido.js; a dor e os problemas de saúde usam as folhas que o app já tem
// (views/dor.js e views/saude-fora.js); o treino curto é o do chat (logic/chat/treino.js, versaoCurta).
import { h, btn, badge, toast, confirmSheet, dateKey, clear, note } from '../ui.js';
import { state, update } from '../store.js';
import { folha } from './common.js';
import { REFS } from '../data/knowledge.js';
import { REFS_CORRIDA as REFS_DA_CORRIDA } from '../data/corrida.js';
import { REFS_SONO } from '../data/sono.js';
import { comboAtual } from '../logic/combinado.js';
import { noiteDe, metaDeSono, fmtHoras, fmtFaixa } from '../logic/sono.js';
import { doresAtivas } from '../logic/dor.js';
import { problemasDeHoje, semTreinoHoje } from '../logic/saude-fora.js';
import { naEsteira, podeNaEsteira, marcarEsteira } from '../logic/esteira.js';
import { perfil, saudeDoTreinador, duracaoEstimada } from '../logic/trainer.js';
import { versaoCurta } from '../logic/chat/treino.js';
import { contarDor } from './dor.js';
import { contarProblema } from './saude-fora.js';
import { startSession } from './session.js';
import * as P from '../logic/perdido.js';

const hojeK = () => dateKey(new Date());
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const fontes = (ks) => {
  const box = h('div', { class: 'col gap-s mt' }, h('div', { class: 'tiny bold muted', text: 'FONTES' }));
  for (const k of [...new Set(ks)]) { const t = REFS[k] || REFS_DA_CORRIDA[k] || REFS_SONO[k]; if (t) box.appendChild(h('p', { class: 'ref', text: '• ' + t })); }
  return box;
};
const porQue = (linhas, refs) => h('details', { class: 'pq perdido-pq' }, h('summary', { text: 'Por quê?' }),
  ...linhas.map((t) => h('p', { class: 'small', text: t })), fontes(refs));

// os botões do motivo (o mesmo conjunto nos dois; "Chuva" só na corrida)
const MOTIVOS_MUSC = ['tempo', 'cansaco', 'dor', 'doente', 'viagem', 'feriado', 'outro'];
const MOTIVOS_CORRIDA = ['tempo', 'chuva', 'cansaco', 'dor', 'doente', 'viagem', 'feriado', 'outro'];
// feriado escolhido no "Não treinei" / "Não corri": o dia fica marcado como feriado (nenhum treino vai para ele)
const comFeriado = (st, motivo, data) => { if (motivo === 'feriado' && !(st.feriados || []).includes(data)) st.feriados = [...(st.feriados || []), data]; };
function perguntaMotivo(corpo, lista, escolher) {
  corpo.appendChild(h('p', { class: 'bold', text: 'O que aconteceu?' }));
  corpo.appendChild(h('div', { class: 'stats two', role: 'list' },
    ...lista.map((k) => h('button', { class: 'btn block', type: 'button', 'data-motivo': k, onClick: () => escolher(k) }, P.MOTIVOS[k]))));
  corpo.appendChild(h('p', { class: 'tiny muted', text: 'O treinador usa o motivo para ajustar a semana.' }));
}
// linha do motivo escolhido, com "Trocar" (volta à pergunta)
const linhaMotivo = (m, trocar) => h('div', { class: 'row between' }, h('div', { class: 'small muted' }, 'Motivo: ', h('b', { text: P.MOTIVOS[m] })), btn('Trocar', trocar, 'sm plain'));
// os dias possíveis, em botões; `on` = o dia escolhido
const chipsDeDia = (dias, on, hoje, escolher) => h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': 'Para qual dia' },
  ...dias.map((d) => h('button', { class: 'chip alvo' + (d.data === on ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': d.data === on ? 'true' : 'false', 'data-dia': d.data, onClick: () => escolher(d.data) }, cap(P.nomeDoDia(d.data, hoje)))));
// o sono da última noite, quando ficou abaixo da meta (logic/sono.js): { texto, refs } ou null
function sonoCurto(hoje) {
  try {
    const noite = noiteDe(state, hoje), meta = metaDeSono(state, hoje);
    if (noite && meta && noite.horas < meta.min) return { texto: `Você dormiu ${fmtHoras(noite.horas)}; o recomendado para você é ${fmtFaixa(meta.min, meta.max)}.`, refs: meta.motivos && meta.motivos[0] ? meta.motivos[0].refs || [] : [] };
  } catch { /* sem registro de sono */ }
  return null;
}
// cansaço repetido nas marcas (logic/perdido.js, cansacoRecente): um aviso, ou null. `+1` = a marca que vai ser gravada.
function avisoCansaco(hoje) {
  const c = P.cansacoRecente(state, hoje);
  if (c.maisDeUmaSemana) return note('warn', 'O cansaço já passa de uma semana. Isso pede treinos mais leves ou descanso. Se passar de 4 semanas, procure um médico.');
  if (c.semana >= 1) return h('p', { class: 'small', text: `É a ${c.semana + 1}ª vez nesta semana que o cansaço tira um treino.` });
  return null;
}
const temSaude = (hoje) => { try { return problemasDeHoje(state, hoje).length > 0; } catch { return false; } };
const temDor = (hoje) => { try { return doresAtivas(state, hoje).length > 0; } catch { return false; } };
// motivo que pede não repor (o treino perdido custa pouco); os outros propõem trocar o dia
const naoRepor = (m) => m === 'cansaco' || m === 'doente';

function porQueMusculacao(extra = []) {
  let ajusta = false;
  try { const f = comboAtual(state).foco; ajusta = f === 'corrida' || f === 'equilibrio'; } catch { ajusta = false; }
  const l = [
    ...extra,
    'Para o músculo, o que mais conta é o total de séries da semana. Com o mesmo total, treinar em mais ou menos dias muda pouco. Por isso, se der, o treino muda de dia.',
    'Entre dois treinos do mesmo músculo, 48 horas ou mais. Por isso o app não junta dois treinos no mesmo dia nem põe o mesmo músculo em dias seguidos.',
    'Sem um dia assim, siga a semana: perder um treino tira pouca força.',
  ];
  if (ajusta) l.push('Com a corrida, as pernas ficam a 24 horas ou mais da corrida forte e do longo.');
  l.push('Ficou 2 semanas ou mais sem treinar? O app aplica sozinho as regras da volta.');
  return [l, [...P.REFS_MUSCULACAO, ...(ajusta ? P.REFS_COMBINADO : [])]];
}

// O que cada motivo acrescenta à proposta (os dois treinadores): { linhas: [nós], porque: [textos], refs: [] }
function doMotivo(m, hoje, corpo, redesenhar, corrida) {
  const linhas = [], porque = [], refs = [];
  if (m === 'cansaco') {
    const s = sonoCurto(hoje);
    if (s) { linhas.push(h('p', { class: 'small', text: s.texto })); refs.push(...s.refs); }
    linhas.push(h('p', { class: 'small', text: corrida ? 'Cansado, não precisa repor: corrida perdida não se repõe.' : 'Cansado, não precisa repor: perder um treino tira pouca força.' }));
    const av = avisoCansaco(hoje);
    if (av) linhas.push(av);
    porque.push('Cansaço alto por mais de uma semana pede treinos mais leves ou descanso; com queda de rendimento por mais de 4 semanas, um médico.');
    refs.push(...P.REFS_CANSACO);
  } else if (m === 'dor') {
    linhas.push(temDor(hoje) ? h('p', { class: 'small', text: 'O treino vai levar a dor em conta.' })
      : h('div', { class: 'row between' }, h('p', { class: 'small grow', text: 'Conte a dor: o treino se ajusta a ela.' }), btn('Contar a dor', () => contarDor({ aoSalvar: redesenhar }), 'sm')));
  } else if (m === 'doente') {
    if (temSaude(hoje)) linhas.push(h('p', { class: 'small', text: 'Enquanto o problema de saúde muda o treino de um dia, nada é reposto nele.' }));
    else linhas.push(h('div', { class: 'col gap-s' }, h('p', { class: 'small', text: 'Conte o que você tem: o treinador vê quando dá para voltar.' }), btn('Contar o problema de saúde', () => contarProblema({ aoSalvar: redesenhar }), 'block', 'heart')));
    porque.push('Com febre, dor no corpo ou cansaço fora do normal, não treine. A volta é aos poucos, depois que os sintomas passam.');
    refs.push('schwellnus2022', 'jaworski2019');
  }
  return { linhas, porque, refs };
}

// Folha "Não treinei" do treino de musculação de `data`. `aoMudar` redesenha a tela.
export function folhaNaoTreinei(data, aoMudar, opc = {}) {
  const hoje = hojeK();
  // `opc.futuro`: um dia desta semana que ainda não chegou (feriado marcado antes)
  const fut = { futuro: !!opc.futuro };
  if (!P.podeMarcar(state, data, hoje, fut).pode) { toast('Este treino não pode ser marcado agora.'); return; }
  const r = { motivo: P.MOTIVOS[opc.motivo] ? opc.motivo : '', alvo: '', escolheu: false };
  const corpo = h('div', { class: 'col gap-s', id: 'folha-nao-treinei' });
  const titulo = r.motivo === 'feriado' ? `Feriado ${data === hoje ? 'hoje' : P.DIAS[P.diaDaSemana(data)]}: a academia não abre` : data === hoje ? 'Não vai treinar hoje?' : data > hoje ? `Não vai treinar ${P.DIAS[P.diaDaSemana(data)]}?` : `Não treinou ${P.DIAS[P.diaDaSemana(data)]}?`;
  const s = folha({ title: titulo, body: corpo });
  const gravar = (escolha) => {
    const m = P.novaMarca(state, data, hoje, escolha, new Date().toISOString(), { ...fut, para: escolha === 'mover' ? r.alvo : '', motivo: r.motivo });
    s.close();
    if (!m || (escolha === 'mover' && !m.movs.length)) { toast('Não foi possível marcar este treino.'); return; }
    update((st) => { st.perdidos = P.limparPerdidos([...(st.perdidos || []), m]); comFeriado(st, r.motivo, data); });
    const nome = P.planoAtivo(state).dias.find((x) => x.id === m.diaId);
    toast(m.movs.length ? `${nome ? nome.nome : 'O treino'} passou para ${P.nomeDoDia(m.movs[0].para, hoje)}.` : `Marcado. O treino volta ${P.naProxima(data)}.`);
    if (aoMudar) aoMudar();
  };
  const escolherMotivo = (k) => {
    r.motivo = k; r.alvo = ''; r.escolheu = false;
    desenhar();
    if (k === 'dor' && !temDor(hoje)) contarDor({ aoSalvar: desenhar });
    if (k === 'doente') contarProblema({ aoSalvar: desenhar });
  };
  function desenhar() {
    if (!corpo.isConnected) return;
    clear(corpo);
    if (!r.motivo) { perguntaMotivo(corpo, MOTIVOS_MUSC, escolherMotivo); return; }
    const o = P.opcoesDeDia(state, data, hoje, fut);
    if (!o.pode) { s.close(); toast('Este treino não pode ser marcado agora.'); return; }
    // doente sem o problema contado: não propõe repor (o app não sabe quando ele passa)
    const possiveis = r.motivo === 'doente' && !temSaude(hoje) ? [] : o.dias.filter((d) => d.pode);
    if (!r.escolheu) r.alvo = naoRepor(r.motivo) ? '' : (possiveis.find((d) => d.data === o.melhor) || possiveis[0] || {}).data || '';
    if (r.alvo && !possiveis.some((d) => d.data === r.alvo)) r.alvo = '';
    const sel = possiveis.find((d) => d.data === r.alvo) || null;
    const extra = doMotivo(r.motivo, hoje, corpo, desenhar, false);
    corpo.appendChild(linhaMotivo(r.motivo, () => { r.motivo = ''; desenhar(); }));
    corpo.appendChild(h('p', { class: 'bold', id: 'perdido-titulo', text: sel ? `Passar o ${o.nome} para ${P.nomeDoDia(sel.data, hoje)}?` : possiveis.length ? `Não precisa repor o ${o.nome}.` : 'Seguir a semana?' }));
    for (const x of extra.linhas) corpo.appendChild(x);
    if (possiveis.length) {
      corpo.appendChild(h('div', { class: 'small bold mt', text: naoRepor(r.motivo) ? 'Se quiser repor, escolha o dia:' : 'Para qual dia?' }));
      corpo.appendChild(chipsDeDia(possiveis, r.alvo, hoje, (d) => { r.alvo = r.alvo === d && naoRepor(r.motivo) ? '' : d; r.escolheu = true; desenhar(); }));
    } else if (!(r.motivo === 'doente' && !temSaude(hoje))) corpo.appendChild(h('p', { class: 'small muted', text: o.texto }));
    // amanhã não dá: diz por quê (é o que a pessoa mais pergunta)
    const amanha = o.dias.find((d) => d.data === P.somaDias(hoje, 1));
    if (amanha && !amanha.pode && possiveis.length) corpo.appendChild(h('p', { class: 'small muted', id: 'perdido-amanha', text: P.porQueNaoDia(amanha, hoje, o.alternado) }));
    if (sel) {
      if (sel.movs.length > 1) corpo.appendChild(h('p', { class: 'small muted', text: sel.texto }));
      const m = P.novaMarca(state, data, hoje, 'mover', new Date().toISOString(), { ...fut, para: sel.data, motivo: r.motivo });
      const linha = P.linhaDaSemana(P.comMarca(state, m), hoje, 'musc');
      corpo.appendChild(h('p', { class: 'small', id: 'perdido-semana' }, h('b', { text: 'Como fica: ' }), linha || 'sem mais musculação nesta semana.'));
    }
    const botoes = h('div', { class: 'col gap-s mt' });
    if (sel) botoes.appendChild(btn(`Passar para ${P.nomeDoDia(sel.data, hoje)}`, () => gravar('mover'), 'primary block', 'calendar'));
    // treino curto hoje (a versão do chat), para sem tempo e cansaço
    const curto = data === hoje && (r.motivo === 'tempo' || r.motivo === 'cansaco') ? treinoCurto(hoje) : null;
    if (curto) botoes.appendChild(btn(`Treino curto hoje (${curto.minutos} min)`, () => { s.close(); startSession(curto.planId, curto.diaId, { itens: curto.itens }); }, 'block', 'timer'));
    botoes.appendChild(btn(possiveis.length ? 'Não repor: seguir a semana' : 'Seguir a semana', () => gravar('seguir'), (sel ? '' : 'primary ') + 'block'));
    corpo.appendChild(botoes);
    const naoDa = o.dias.filter((d) => !d.pode && d !== amanha).map((d) => P.porQueNaoDia(d, hoje, o.alternado));
    const [l, refs] = porQueMusculacao([...extra.porque, ...naoDa]);
    if (curto) { l.push('No treino curto ficam os exercícios de várias articulações; o descanso entre as séries continua o do plano. Para o músculo, o que conta é a semana.'); refs.push('iversen2021'); }
    corpo.appendChild(porQue(l, [...extra.refs, ...refs]));
  }
  desenhar();
}
// o treino de hoje numa versão de cerca de 30 minutos (logic/chat/treino.js, versaoCurta): { planId, diaId, itens, minutos } ou null
function treinoCurto(hoje) {
  try {
    if (state.current || semTreinoHoje(state, hoje)) return null;
    const pf = perfil(saudeDoTreinador(state, hoje).respostas);
    if (pf.bloqueado) return null;
    const t = P.treinoDoDia(state, hoje);
    const plan = P.planoAtivo(state);
    const dia = t && t.diaId && plan ? plan.dias.find((d) => d.id === t.diaId) : null;
    if (!dia || duracaoEstimada(dia) <= 30) return null;
    const v = versaoCurta(dia.itens, 30, pf);
    return v.itens.length && v.minutos < duracaoEstimada(dia) ? { planId: plan.id, diaId: dia.id, itens: v.itens, minutos: v.minutos } : null;
  } catch { return null; }
}

// Grava a corrida de `de` em `para` (marca com `para`) e, se ela estava na esteira, a esteira vai junto (logic/esteira.js)
function moverCorrida(s, de, para, hoje, motivo) {
  const m = P.marcaMoverCorrida(s, de, para, hoje, new Date().toISOString(), motivo);
  if (!m) return false;
  const naEst = naEsteira(s, de);
  s.perdidos = P.limparPerdidos([...(Array.isArray(s.perdidos) ? s.perdidos : []), m]);
  if (naEst) {
    try { marcarEsteira(s, de, false, hoje); } catch { /* segue */ }
    try { if (podeNaEsteira(s, para, hoje).pode) marcarEsteira(s, para, true, hoje); } catch { /* fica na rua */ }
  }
  return true;
}

// Folha "Não corri" da corrida de `data`.
export function folhaNaoCorri(data, aoMudar, opc = {}) {
  const hoje = hojeK();
  if (!P.podeMarcarCorrida(state, data, hoje)) { toast('Esta corrida não pode ser marcada agora.'); return; }
  const r = { motivo: P.MOTIVOS[opc.motivo] ? opc.motivo : '', alvo: '', escolheu: false };
  const corpo = h('div', { class: 'col gap-s', id: 'folha-nao-corri' });
  const s = folha({ title: data === hoje ? 'Não vai correr hoje?' : `Não correu ${P.DIAS[P.diaDaSemana(data)]}?`, body: corpo });
  const fim = (msg) => { s.close(); toast(msg); if (aoMudar) aoMudar(); };
  const naoFeita = () => {
    const m = P.marcaCorrida(data, new Date().toISOString(), r.motivo);
    if (!m) { s.close(); return; }
    update((st) => { st.perdidos = P.limparPerdidos([...(st.perdidos || []), m]); comFeriado(st, r.motivo, data); });
    fim('Marcado. Siga o plano.');
  };
  const mover = () => {
    let ok = false;
    update((st) => { ok = moverCorrida(st, data, r.alvo, hoje, r.motivo); if (ok) comFeriado(st, r.motivo, data); });
    if (!ok) { s.close(); toast('Não foi possível mudar a corrida de dia.'); return; }
    fim(`A corrida passou para ${P.nomeDoDia(r.alvo, hoje)}.`);
  };
  const escolherMotivo = (k) => {
    r.motivo = k; r.alvo = ''; r.escolheu = false;
    desenhar();
    if (k === 'dor' && !temDor(hoje)) contarDor({ aoSalvar: desenhar });
    if (k === 'doente') contarProblema({ aoSalvar: desenhar });
  };
  function desenhar() {
    if (!corpo.isConnected) return;
    clear(corpo);
    if (!r.motivo) { perguntaMotivo(corpo, MOTIVOS_CORRIDA, escolherMotivo); return; }
    if (!P.podeMarcarCorrida(state, data, hoje)) { s.close(); return; }
    const ops = P.opcoesCorrida(state, data, hoje);
    const possiveis = r.motivo === 'doente' && !temSaude(hoje) ? [] : ops.filter((d) => d.pode);
    const esteira = r.motivo === 'chuva' && data >= hoje ? (() => { try { return podeNaEsteira(state, data, hoje).pode; } catch { return false; } })() : false;
    if (!r.escolheu) r.alvo = naoRepor(r.motivo) || esteira ? '' : (possiveis[0] || {}).data || '';
    if (r.alvo && !possiveis.some((d) => d.data === r.alvo)) r.alvo = '';
    const sel = possiveis.find((d) => d.data === r.alvo) || null;
    const extra = doMotivo(r.motivo, hoje, corpo, desenhar, true);
    corpo.appendChild(linhaMotivo(r.motivo, () => { r.motivo = ''; desenhar(); }));
    corpo.appendChild(h('p', { class: 'bold', id: 'perdido-titulo', text: sel ? `Passar a corrida para ${P.nomeDoDia(sel.data, hoje)}?` : esteira ? 'Correr na esteira?' : 'Corrida perdida não se repõe.' }));
    for (const x of extra.linhas) corpo.appendChild(x);
    if (esteira) corpo.appendChild(h('p', { class: 'small', text: 'Com chuva, a esteira serve: o mesmo treino, com a velocidade e a inclinação certas.' }));
    if (possiveis.length) {
      corpo.appendChild(h('div', { class: 'small bold mt', text: naoRepor(r.motivo) || esteira ? 'Ou passar para outro dia:' : 'Para qual dia?' }));
      corpo.appendChild(chipsDeDia(possiveis, r.alvo, hoje, (d) => { r.alvo = r.alvo === d && (naoRepor(r.motivo) || esteira) ? '' : d; r.escolheu = true; desenhar(); }));
    } else if (!(r.motivo === 'doente' && !temSaude(hoje))) corpo.appendChild(h('p', { class: 'small muted', text: 'Nesta semana, nenhum outro dia recebe esta corrida sem quebrar as regras do plano. Siga o plano.' }));
    const amanha = ops.find((d) => d.data === P.somaDias(hoje, 1));
    if (amanha && !amanha.pode && possiveis.length) corpo.appendChild(h('p', { class: 'small muted', id: 'perdido-amanha', text: P.porQueNaoCorrida(amanha, hoje) }));
    if (sel) {
      const sim = JSON.parse(JSON.stringify(state));
      moverCorrida(sim, data, sel.data, hoje, r.motivo);
      const linha = P.linhaDaSemana(sim, hoje, 'corrida');
      corpo.appendChild(h('p', { class: 'small', id: 'perdido-semana' }, h('b', { text: 'Como fica: ' }), linha || 'sem mais corridas nesta semana.'));
      if (naEsteira(state, data)) corpo.appendChild(h('p', { class: 'small muted', text: 'Ela estava na esteira: a esteira vai junto, se der no dia novo.' }));
    }
    const botoes = h('div', { class: 'col gap-s mt' });
    if (sel) botoes.appendChild(btn(`Passar para ${P.nomeDoDia(sel.data, hoje)}`, mover, 'primary block', 'calendar'));
    else if (esteira) botoes.appendChild(btn('Correr na esteira', () => { let ok = false; update((st) => { ok = marcarEsteira(st, data, true, hoje); }); if (ok) fim('A corrida fica na esteira.'); else { s.close(); toast('Não foi possível marcar a esteira.'); } }, 'primary block', 'run'));
    botoes.appendChild(btn('Marcar como não feita', naoFeita, (sel || esteira ? '' : 'primary ') + 'block'));
    corpo.appendChild(botoes);
    const naoDa = ops.filter((d) => !d.pode && d !== amanha && d.motivo !== 'sem_plano').map((d) => P.porQueNaoCorrida(d, hoje));
    corpo.appendChild(porQue([...extra.porque, ...naoDa,
      'Uma corrida por dia: juntar a corrida perdida a outra faz uma corrida maior. Uma corrida mais de 10% maior do que a mais longa dos últimos 30 dias aumenta o risco de lesão.',
      'Treino forte e longão nunca ficam em dias seguidos, e a semana guarda o dia de descanso, quando o plano tem um.',
      'Se faltarem corridas, o plano retoma de onde você está e sobe aos poucos.'], [...extra.refs, ...P.REFS_CORRIDA, 'seiler2009', 'casado2022', 'meeusen2013', ...(esteira ? ['miller2019'] : [])]));
  }
  desenhar();
}

// Botão discreto que abre a folha
export const botaoNaoTreinei = (data, aoMudar, rotulo = 'Não treinei') => btn(rotulo, () => folhaNaoTreinei(data, aoMudar), 'sm plain nao-treinei');
export const botaoNaoCorri = (data, aoMudar) => btn('Não corri', () => folhaNaoCorri(data, aoMudar), 'sm plain nao-treinei');

async function desfazerMarca(entrada, aoMudar) {
  const n = P.quantasSaem(state.perdidos, entrada);
  if (n > 1) {
    const ok = await confirmSheet({ title: 'Desfazer esta marca?', text: 'As marcas feitas depois desta, nesta semana, também saem, e os treinos voltam aos dias da agenda.', okLabel: 'Desfazer' });
    if (!ok) return;
  }
  update((st) => {
    st.perdidos = P.desfazer(st.perdidos, entrada).lista;
    // corrida que mudou de dia e foi para a esteira: a esteira volta para o dia de origem, se der
    if (entrada.tipo === 'corrida' && entrada.para && naEsteira(st, entrada.para)) {
      try { marcarEsteira(st, entrada.para, false, hojeK()); if (podeNaEsteira(st, entrada.data, hojeK()).pode) marcarEsteira(st, entrada.data, true, hojeK()); } catch { /* fica na rua */ }
    }
  });
  toast('Desfeito.');
  if (aoMudar) aoMudar();
}
const comMotivo = (e, t) => (e && P.MOTIVO_CURTO[e.motivo] ? `${cap(P.MOTIVO_CURTO[e.motivo])} · ${t}` : t);

// Linha do dia marcado como não treinado: nome do treino, o motivo, para onde foi e "Desfazer".
// `dia` = um dia de P.semanaEfetiva; `nome` = nome do treino perdido.
export function linhaNaoTreinado(dia, nome, aoMudar, podeDesfazer = true) {
  const hoje = hojeK();
  const para = dia.perdido.para;
  const e = dia.perdido.entrada;
  // feito em outro dia (logic/perdido.js, reajustarDepoisDoTreino): não é falta
  if (e.feitoEm) {
    return h('div', { class: 'treino row perdido', 'data-perdido': dia.data, 'data-feito-em': e.feitoEm },
      h('div', { class: 'grow' }, h('div', { class: 'row gap-s' }, h('span', { class: 'bold', text: nome }), badge('Feito', 'ok')), h('div', { class: 'small muted', text: `Feito ${P.nomeDoDia(e.feitoEm, hoje)}.` })),
      podeDesfazer ? btn('Desfazer', () => desfazerMarca(e, aoMudar), 'sm ghost nao-treinei') : null);
  }
  // mudou de dia sem ser falta: 48 horas para os mesmos músculos de um treino feito ou planejado, longe de um esporte
  // planejado ou a pedido da pessoa (logic/treino-extra.js)
  if (e.ajuste && para) {
    const por = { descanso: '48 horas de descanso para os mesmos músculos.', esporte: 'fica longe do esporte que você planejou.', pedido: 'como você pediu.' }[e.ajuste] || '';
    return h('div', { class: 'treino row perdido', 'data-perdido': dia.data, 'data-ajuste': e.ajuste },
      h('div', { class: 'grow' }, h('div', { class: 'row gap-s' }, h('span', { class: 'bold', text: nome }), badge('Mudou de dia', 'acc')), h('div', { class: 'small muted', text: `Passou para ${P.nomeDoDia(para, hoje)}${por ? ': ' + por : '.'}` })),
      podeDesfazer ? btn('Desfazer', () => desfazerMarca(e, aoMudar), 'sm ghost nao-treinei') : null);
  }
  const plan = (state.plans || []).find((p) => p.id === e.planId);
  const outro = e.trocadoPor === 'livre' ? 'um treino livre' : e.trocadoPor && plan ? 'o ' + ((plan.dias.find((d) => d.id === e.trocadoPor) || {}).nome || 'outro treino') : '';
  return h('div', { class: 'treino row perdido', 'data-perdido': dia.data, ...(dia.perdido.entrada.motivo ? { 'data-motivo': dia.perdido.entrada.motivo } : {}) },
    h('div', { class: 'grow' },
      h('div', { class: 'row gap-s' }, h('span', { class: 'bold', text: nome }), outro ? badge('Trocado', 'acc') : badge('Não treinado', 'warn')),
      h('div', { class: 'small muted', text: (outro ? `Você fez ${outro} no lugar. ` : '') + comMotivo(dia.perdido.entrada, para ? `Passou para ${P.nomeDoDia(para, hoje)}.` : `Volta ${P.naProxima(dia.data)}.`) })),
    podeDesfazer ? btn('Desfazer', () => desfazerMarca(dia.perdido.entrada, aoMudar), 'sm ghost nao-treinei') : null);
}
// Linha da corrida marcada como não feita (ou que mudou de dia)
export function linhaNaoCorrida(entrada, nome, aoMudar, podeDesfazer = true) {
  // feita depois, em outro dia (logic/perdido.js, reajustarDepoisDaCorrida)
  if (entrada.feitoEm) {
    return h('div', { class: 'treino row perdido', 'data-corrida-perdida': entrada.data, 'data-feito-em': entrada.feitoEm },
      h('div', { class: 'grow' }, h('div', { class: 'row gap-s' }, h('span', { class: 'bold', text: nome || 'Corrida' }), badge('Feita', 'ok')), h('div', { class: 'small muted', text: `Feita ${P.nomeDoDia(entrada.feitoEm, hojeK())}.` })),
      podeDesfazer ? btn('Desfazer', () => desfazerMarca(entrada, aoMudar), 'sm ghost nao-treinei') : null);
  }
  return h('div', { class: 'treino row perdido', 'data-corrida-perdida': entrada.data, ...(entrada.motivo ? { 'data-motivo': entrada.motivo } : {}) },
    h('div', { class: 'grow' },
      h('div', { class: 'row gap-s' }, h('span', { class: 'bold', text: nome || 'Corrida' }), badge(entrada.para ? 'Mudou de dia' : 'Não feita', entrada.para ? 'acc' : 'warn')),
      h('div', { class: 'small muted', text: comMotivo(entrada, entrada.para ? `Passou para ${P.nomeDoDia(entrada.para, hojeK())}.` : 'Não se repõe: o plano segue.') })),
    podeDesfazer ? btn('Desfazer', () => desfazerMarca(entrada, aoMudar), 'sm ghost nao-treinei') : null);
}

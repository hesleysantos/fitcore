// Chat com os treinadores (#/chat/treinador, #/chat/corrida, #/chat/nutri): balões curtos, assuntos em botões e o campo
// "Escreva sua dúvida" no fim. Sem internet e sem IA: as respostas saem de logic/chat/ (motor e assuntos).
// A conversa fica só na memória deste módulo enquanto o app está aberto (não vai para o estado nem para o aparelho): o
// app redesenha a tela quando o estado muda, e ela volta igual. "Começar de novo" apaga.
import { h, btn, icon, note, toast, confirmSheet, dateKey } from '../ui.js';
import { state, update } from '../store.js';
import { go, refresh } from '../router.js';
import { COACHES } from '../logic/chat/contrato.js';
import * as M from '../logic/chat/motor.js';
import { textoDaRef } from '../logic/chat/comum.js';
import { startSession } from './session.js';
import { contarDor } from './dor.js';
import { perguntarCombinado } from './combinado.js';
import { abrirNoTreinador } from './trainer.js';
import { abrirEntrevistaCorrida } from './corrida.js';
import { abrirEntrevistaNutri } from './nutrition.js';

const VOLTA = { treinador: 'treinador', corrida: 'corrida', nutri: 'nutricao' };
const ICONE = { treinador: 'coach', corrida: 'run', nutri: 'apple' };
const MAX_MSGS = 80;
const MAX_TEXTO = 300;
// coach → { msgs: [{ de: 'coach', passo, feitas: Set } | { de: 'eu', texto }], rascunho, mem }
// mem = a memória da conversa (logic/chat/motor.js: assunto, dia, assunto pendente), para "e amanhã?" e "sim"
const conversas = new Map();
const ctx = (coach) => ({ st: state, hoje: dateKey(new Date()), agora: Date.now(), coach, memoria: (conversas.get(coach) || {}).mem || null });

function conversa(coach) {
  let c = conversas.get(coach);
  if (!c) { c = { msgs: [], rascunho: '', mem: null }; conversas.set(coach, c); }
  if (!c.msgs.length) c.msgs.push({ de: 'coach', passo: M.limparPasso(M.saudacao(coach, ctx(coach))) || { texto: ['Oi!'] }, feitas: new Set() });
  return c;
}
function falar(coach, passo) {
  const c = conversa(coach);
  if (passo && passo.memoria) c.mem = passo.memoria;
  c.msgs.push({ de: 'coach', passo: passo || { texto: ['Não consegui responder agora. Escolha um assunto ou escreva de outro jeito.'] }, feitas: new Set() });
  if (c.msgs.length > MAX_MSGS) c.msgs.splice(1, c.msgs.length - MAX_MSGS);
}
const euDisse = (coach, texto) => conversa(coach).msgs.push({ de: 'eu', texto });

// ---------- peças ----------
function porQue(detalhes, refs) {
  const ks = (refs || []).filter((k) => textoDaRef(k));
  if (!detalhes.length && !ks.length) return null;
  return h('details', { class: 'pq' }, h('summary', { text: 'Por quê?' }),
    ...detalhes.map((t) => h('p', { class: 'small muted', text: t })),
    ks.length ? h('div', { class: 'col gap-s mt' }, h('div', { class: 'tiny bold muted', text: 'FONTES' }), ...ks.map((k) => h('p', { class: 'ref', text: '• ' + textoDaRef(k) }))) : null);
}
function faqs(lista) {
  return h('div', { class: 'col gap-s' }, ...lista.map((f) => h('details', { class: 'acc chat-faq' }, h('summary', { text: f.q }),
    h('div', null, ...f.a.map((t) => h('p', { class: 'small', text: t })),
      f.refs.length ? h('div', { class: 'col gap-s mt' }, h('div', { class: 'tiny bold muted', text: 'FONTES' }), ...f.refs.map((k) => h('p', { class: 'ref', text: '• ' + textoDaRef(k) }))) : null))));
}

// ---------- o que os botões fazem ----------
function escolher(coach, m, o) {
  euDisse(coach, o.rotulo);
  m.respondida = true;
  falar(coach, M.seguir(m.passo, o.valor, ctx(coach)));
  redesenhar(coach, true);
}
async function executar(coach, m, i) {
  const a = m.passo.acoes[i];
  if (!a || m.feitas.has(i)) return;
  const ok = await confirmSheet({ title: a.rotulo, text: a.confirmar, okLabel: a.iniciar ? 'Começar' : 'Confirmar' });
  if (!ok) return;
  // a ação vale para o dia de que a conversa falava (amanhã, sexta...), não só para hoje
  const c = { ...ctx(coach), data: a.data || m.passo.data || dateKey(new Date()) };
  if (typeof a.aplicar === 'function') {
    let res = false;
    try { update((s) => { res = a.aplicar(s, c); }); } catch { res = false; }
    if (res === false) { toast('Não deu: a situação mudou. Veja de novo.'); return; }
  }
  m.feitas.add(i);
  m.respondida = true;
  if (a.iniciar) { startSession(a.iniciar.planId, a.iniciar.diaId, { itens: a.iniciar.itens }); return; }
  falar(coach, M.depoisDaAcao(a, coach, ctx(coach)));
  redesenhar(coach, true);
}
function irPara(coach, x) {
  if (x.rota) { go(x.rota); return; }
  if (x.abrir === 'contar-dor') {
    contarDor({ aoSalvar: () => falar(coach, { texto: ['Anotado. O treino passa a levar essa dor em conta.'], opcoes: [{ rotulo: 'Ver os assuntos', valor: 'a' }], proximo: (v, cc) => M.saudacao(coach, cc) }) });
  } else if (x.abrir === 'combinado') perguntarCombinado({ aoMudar: () => falar(coach, { texto: ['Prioridade guardada. Os treinos passam a segui-la.'] }) });
  else if (x.abrir === 'corrida-entrevista') abrirEntrevistaCorrida();
  else if (x.abrir === 'nutri-entrevista') abrirEntrevistaNutri();
  else if (typeof x.abrir === 'string' && x.abrir.startsWith('treinador-')) abrirNoTreinador(x.abrir.slice(10));
}

// ---------- desenho ----------
function balaoCoach(coach, m, ativo) {
  const p = m.passo;
  const box = h('div', { class: 'chat-msg de-coach' + (ativo ? ' ativo' : '') });
  const bolha = h('div', { class: 'bubble chat-bolha' });
  if (p.aviso) bolha.appendChild(note(p.aviso.tipo, p.aviso.texto));
  for (const t of p.texto) bolha.appendChild(h('p', { text: t }));
  const pq = porQue(p.detalhes || [], p.refs || []);
  if (pq) bolha.appendChild(pq);
  box.appendChild(bolha);
  if (p.faq) box.appendChild(faqs(p.faq));
  // botões só na última fala ainda sem resposta (as anteriores ficam como histórico)
  if (ativo && !m.respondida) {
    const bt = h('div', { class: 'chat-opcoes' });
    (p.acoes || []).forEach((a, i) => bt.appendChild(btn(a.rotulo, () => executar(coach, m, i), 'primary block', a.iniciar ? 'play' : 'check')));
    for (const o of p.opcoes || []) bt.appendChild(btn(o.rotulo, () => escolher(coach, m, o), 'block chat-op'));
    for (const x of p.ir || []) bt.appendChild(btn(x.rotulo, () => irPara(coach, x), 'ghost block', 'right'));
    if (bt.firstChild) box.appendChild(bt);
  } else if (ativo && p.ir) {
    const bt = h('div', { class: 'chat-opcoes' });
    for (const x of p.ir) bt.appendChild(btn(x.rotulo, () => irPara(coach, x), 'ghost block', 'right'));
    box.appendChild(bt);
  }
  return box;
}
const balaoEu = (texto) => h('div', { class: 'chat-msg de-eu' }, h('div', { class: 'chat-eu', text: texto }));

const telas = new Map(); // coach → lista (div) da tela aberta
function desenharLista(coach, lista) {
  while (lista.firstChild) lista.removeChild(lista.firstChild);
  const { msgs } = conversa(coach);
  const ultimo = msgs.length - 1 - [...msgs].reverse().findIndex((x) => x.de === 'coach');
  msgs.forEach((m, i) => lista.appendChild(m.de === 'eu' ? balaoEu(m.texto) : balaoCoach(coach, m, i === ultimo)));
}
function redesenhar(coach, rolar) {
  const lista = telas.get(coach);
  if (!lista || !lista.isConnected) return;
  desenharLista(coach, lista);
  if (rolar) {
    // a resposta nova aparece a partir do começo (a pessoa lê de cima para baixo)
    const novas = lista.querySelectorAll('.chat-msg.de-coach');
    const alvo = novas[novas.length - 1];
    if (alvo) requestAnimationFrame(() => { try { alvo.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch { alvo.scrollIntoView(); } });
  }
}

export function chatView(coach) {
  if (!Object.prototype.hasOwnProperty.call(COACHES, coach)) return { redirect: 'treinador' };
  const c = conversa(coach);
  const lista = h('div', { class: 'chat-lista', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversa com ' + COACHES[coach] });
  telas.set(coach, lista);
  desenharLista(coach, lista);
  const campo = h('input', { class: 'input', type: 'text', maxlength: String(MAX_TEXTO), placeholder: 'Escreva sua dúvida', 'aria-label': 'Escreva sua dúvida', autocomplete: 'off', enterkeyhint: 'send', value: c.rascunho, id: 'chat-campo' });
  const enviar = () => {
    const t = campo.value.trim().slice(0, MAX_TEXTO);
    if (!t) { campo.focus(); return; }
    campo.value = ''; c.rascunho = '';
    // a pergunta em aberto: o que for escrito pode responder a ela ("sim", "pode", "não", o texto de um botão)
    const ult = [...c.msgs].reverse().find((x) => x.de === 'coach');
    const aberto = ult && !ult.respondida && ((ult.passo.opcoes && ult.passo.opcoes.length) || (ult.passo.acoes && ult.passo.acoes.length)) ? ult.passo : null;
    const res = M.responder(t, coach, { ...ctx(coach), aberto });
    euDisse(coach, t);
    // "sim" para uma ação em aberto: abre a mesma confirmação do botão (nada muda sem ela)
    if (res && Number.isInteger(res.executar) && ult && aberto && aberto.acoes && aberto.acoes[res.executar]) {
      redesenhar(coach, true);
      executar(coach, ult, res.executar);
      return;
    }
    // a fala anterior perde os botões: a conversa segue pelo que foi escrito
    if (ult) ult.respondida = true;
    falar(coach, M.limparPasso(res));
    redesenhar(coach, true);
  };
  campo.addEventListener('input', () => { c.rascunho = campo.value; });
  campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
  // teclado do celular: o campo fica no fim da conversa e sobe para a parte visível quando o teclado abre
  const mostrarCampo = () => { if (document.activeElement === campo) { try { campo.scrollIntoView({ block: 'end', behavior: 'smooth' }); } catch { campo.scrollIntoView(); } } };
  campo.addEventListener('focus', () => setTimeout(mostrarCampo, 300));
  const vv = window.visualViewport;
  if (vv) vv.addEventListener('resize', mostrarCampo);
  const barra = h('div', { class: 'chat-campo' }, campo, h('button', { class: 'btn primary', type: 'button', 'aria-label': 'Enviar', onClick: enviar }, icon('right'), h('span', { class: 'chat-enviar', text: 'Enviar' })));
  const recomecar = btn('Começar de novo', () => { conversas.delete(coach); refresh(); window.scrollTo(0, 0); }, 'ghost sm chat-fim', 'refresh');
  return {
    title: COACHES[coach],
    back: VOLTA[coach],
    noNav: true,
    body: [h('div', { class: 'chat', id: 'chat', dataset: { coach } },
      h('div', { class: 'row gap-s chat-topo' }, h('div', { class: 'avatar' }, icon(ICONE[coach], 's')), h('p', { class: 'tiny muted grow', text: 'Respostas com base nas pesquisas do app. Não substitui um profissional.' })),
      lista, barra, recomecar)],
    cleanup: () => { if (vv) vv.removeEventListener('resize', mostrarCampo); if (telas.get(coach) === lista) telas.delete(coach); },
  };
}

// Entrada discreta para as telas (Treinador, Corrida, Nutrição, Início)
export const botaoChat = (coach, rotulo, cls = 'ghost block') => btn(rotulo, () => go('chat/' + coach), cls + ' chat-entrada', ICONE[coach]);

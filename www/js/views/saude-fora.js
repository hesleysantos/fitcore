// Contar um problema de saúde que não vem do treino (febre, pancada, corte, dor de cabeça...) e ver o que o treinador
// decidiu. As regras e as fontes estão em logic/saude-fora.js; aqui só as perguntas (uma por vez, com botões) e os cartões.
import { h, btn, icon, note, toast, uid, dateKey } from '../ui.js';
import { state, update } from '../store.js';
import { refresh } from '../router.js';
import { folha } from './common.js';
import { REFS } from '../data/knowledge.js';
import { REFS_CORRIDA } from '../data/corrida.js';
import { LOCAIS_DOR } from '../logic/dor.js';
import { TIPOS_SAUDE, GRAUS_SAUDE, SINAIS, MAX_SAUDE, proximoPasso, novoProblema, efeitoDoProblema, efeitoDeHoje, problemasDeHoje, marcar } from '../logic/saude-fora.js';

const hojeK = () => dateKey(new Date());
const fontes = (ks) => {
  const box = h('div', { class: 'col gap-s mt' }, h('div', { class: 'tiny bold muted', text: 'FONTES' }));
  for (const k of [...new Set(ks || [])]) { const t = REFS[k] || REFS_CORRIDA[k]; if (t) box.appendChild(h('p', { class: 'ref', text: '• ' + t })); }
  return box;
};
const porQue = (linhas, refs) => h('details', { class: 'pq' }, h('summary', { text: 'Por quê?' }), ...linhas.map((t) => h('p', { class: 'small', text: t })), fontes(refs));
const tipoNota = (nivel) => (nivel === 'urgente' ? 'danger' : nivel === 'atendimento' || nivel === 'sem' || nivel === 'regiao' ? 'warn' : 'info');
const ligar = () => h('a', { class: 'btn primary block', href: 'tel:192' }, icon('phone'), 'Ligar 192 (SAMU)');

// Folha "Contar um problema de saúde". `tipo` (opcional) já escolhe o tipo; `aoSalvar(problema)` depois de gravar.
export function contarProblema({ tipo = '', aoSalvar = null } = {}) {
  const r = tipo && TIPOS_SAUDE[tipo] ? { tipo } : {};
  const pilha = []; // respostas anteriores, para "Voltar"
  const corpo = h('div', { class: 'col gap-l', id: 'saude-folha' });
  const rodape = h('div', { class: 'row grow' });
  const f = folha({ title: 'Problema de saúde', full: true, body: corpo, footer: [rodape] });
  const responder = (k, v) => { pilha.push({ ...r }); r[k] = v; desenhar(); };
  const voltar = () => { if (pilha.length) { const a = pilha.pop(); for (const k of Object.keys(r)) delete r[k]; Object.assign(r, a); desenhar(); } };
  const simNao = (k, sim = 'Sim', nao = 'Não') => h('div', { class: 'row' }, btn(nao, () => responder(k, false), 'grow lg'), btn(sim, () => responder(k, true), 'grow lg'));
  const lista = (itens) => h('ul', { class: 'small col gap-s' }, ...itens.map((t) => h('li', { text: t })));
  const titulo = (t) => h('h3', { text: t });
  function desenhar() {
    while (corpo.firstChild) corpo.removeChild(corpo.firstChild);
    while (rodape.firstChild) rodape.removeChild(rodape.firstChild);
    rodape.appendChild(pilha.length ? btn('Voltar', voltar, 'ghost grow', 'back') : btn('Cancelar', () => f.close(), 'ghost grow'));
    const passo = proximoPasso(r);
    const tp = r.tipo === 'resfriado' && r.vira === true ? 'febre' : r.tipo;
    const s = SINAIS[tp] || {};
    if (passo === 'tipo') {
      corpo.appendChild(h('p', { class: 'small muted', text: 'Para algo que não veio do treino. Dor por causa do treino? Use “Contar uma dor”.' }));
      corpo.appendChild(titulo('O que aconteceu?'));
      const opts = h('div', { class: 'opts', role: 'list' });
      for (const [id, t] of Object.entries(TIPOS_SAUDE)) opts.appendChild(h('button', { type: 'button', class: 'opt', 'data-tipo': id, onClick: () => responder('tipo', id) }, h('div', { class: 'grow' }, h('div', { class: 'o-t', text: t.nome }), t.sub ? h('div', { class: 'o-s', text: t.sub }) : null), icon('right', 's muted')));
      corpo.appendChild(opts);
    } else if (passo === 'onde') {
      corpo.appendChild(titulo('Onde foi?'));
      const box = h('div', { class: 'chips wrap', role: 'list' });
      for (const [id, nome] of Object.entries(LOCAIS_DOR)) box.appendChild(h('button', { type: 'button', class: 'chip', 'data-onde': id, onClick: () => responder('onde', id) }, nome));
      corpo.appendChild(box);
      corpo.appendChild(h('p', { class: 'small muted', text: 'Na cabeça? Volte e escolha “Pancada na cabeça”.' }));
    } else if (passo === 'urgente') {
      corpo.appendChild(titulo('Tem algum destes sinais?'));
      corpo.appendChild(lista(s.urgente));
      corpo.appendChild(simNao('urgente', 'Sim, tenho'));
    } else if (passo === 'vira') {
      corpo.appendChild(titulo('Junto com isso, tem algum destes?'));
      corpo.appendChild(lista(s.vira));
      corpo.appendChild(simNao('vira'));
    } else if (passo === 'atendimento') {
      corpo.appendChild(titulo('E algum destes?'));
      corpo.appendChild(lista(s.atendimento));
      corpo.appendChild(simNao('atendimento'));
    } else if (passo === 'detalhe') {
      corpo.appendChild(titulo(s.detalhe.pergunta));
      if (s.detalhe.itens.length) corpo.appendChild(lista(s.detalhe.itens));
      corpo.appendChild(simNao('detalhe'));
    } else if (passo === 'grau') {
      corpo.appendChild(titulo('Quanto incomoda?'));
      const opts = h('div', { class: 'opts', role: 'list' });
      for (const [id, [nome, sub]] of Object.entries(GRAUS_SAUDE)) opts.appendChild(h('button', { type: 'button', class: 'opt', 'data-grau': id, onClick: () => responder('grau', id) }, h('div', { class: 'grow' }, h('div', { class: 'o-t', text: nome }), h('div', { class: 'o-s', text: sub }))));
      corpo.appendChild(opts);
    } else if (passo === 'piora') {
      corpo.appendChild(titulo(tp === 'dor-cabeca' ? 'Piora ao se mexer, andar ou subir escada?' : 'Dói mais quando você mexe essa região?'));
      corpo.appendChild(simNao('piora'));
    } else {
      resultado();
    }
  }
  function resultado() {
    const hoje = hojeK();
    const p = novoProblema('sf' + uid(), hoje, r);
    const ef = p ? efeitoDoProblema(p, hoje) : null;
    if (!p) { corpo.appendChild(note('warn', 'Faltou uma resposta. Volte e confira.')); return; }
    const card = h('div', { class: 'col gap-s', id: 'saude-resultado', 'data-nivel': ef ? ef.nivel : 'normal' });
    card.appendChild(titulo(ef ? ef.titulo : 'Pode treinar'));
    if (ef && ef.nivel === 'urgente') card.appendChild(ligar());
    card.appendChild(note(tipoNota(ef ? ef.nivel : 'normal'), ef ? ef.texto : 'Treino normal.'));
    if (ef) card.appendChild(porQue(ef.porque, ef.refs));
    corpo.appendChild(card);
    rodape.appendChild(btn('Anotar', () => {
      update((s) => { if (!Array.isArray(s.saudeFora)) s.saudeFora = []; s.saudeFora.push(p); if (s.saudeFora.length > MAX_SAUDE) s.saudeFora.splice(0, s.saudeFora.length - MAX_SAUDE); });
      f.close();
      toast('Anotado. O treino de hoje já leva isso em conta.');
      if (aoSalvar) aoSalvar(p);
      refresh();
    }, 'primary grow', 'check'));
  }
  desenhar();
  return f;
}

export const botaoContarProblema = (cls = 'block ghost sm', aoSalvar = null) => {
  const b = btn('Contar um problema de saúde', () => contarProblema({ aoSalvar }), cls, 'heart');
  b.setAttribute('data-acao', 'contar-saude');
  return b;
};

const quando = (dias) => (dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`);
const diasDesde = (d, hoje) => Math.round((Date.parse(hoje + 'T12:00:00Z') - Date.parse(d + 'T12:00:00Z')) / 86400000);
const fmtDia = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
function agir(id, acao, aoMudar, msg) {
  let ok = false;
  update((s) => { ok = marcar(s.saudeFora, id, acao, hojeK()); });
  if (!ok) { toast('Não foi possível atualizar. Tente de novo.'); return; }
  toast(msg);
  if (aoMudar) aoMudar();
  refresh();
}
// Cartão com os problemas que mudam o treino hoje (ativos e em volta). null quando não há nenhum.
export function cartaoSaude({ aoMudar = null, contar = true } = {}) {
  const hoje = hojeK();
  const itens = problemasDeHoje(state, hoje);
  if (!itens.length) return null;
  const card = h('div', { class: 'card col gap-s', id: 'saude-fora' });
  for (const { p, ef } of itens) {
    const t = TIPOS_SAUDE[p.tipo];
    const sub = [t.nome + (p.onde ? ' · ' + LOCAIS_DOR[p.onde] : ''), quando(diasDesde(p.data, hoje))].join(' · ');
    const linha = h('div', { class: 'col gap-s', 'data-problema': p.id, 'data-nivel': ef.nivel });
    linha.appendChild(h('div', null, h('div', { class: 'bold', text: ef.titulo }), h('div', { class: 'small muted', text: sub })));
    if (ef.nivel === 'urgente') linha.appendChild(ligar());
    linha.appendChild(note(tipoNota(ef.nivel), ef.texto + (ef.ate ? ` Até ${fmtDia(ef.ate)}.` : '')));
    if (ef.aviso) linha.appendChild(note('warn', ef.aviso));
    linha.appendChild(porQue(ef.porque, ef.refs));
    if (ef.fase === 'ativo') {
      const acoes = h('div', { class: 'row wrap gap-s' });
      if (ef.perguntar) acoes.appendChild(h('span', { class: 'small bold grow', text: 'Melhorou?' }));
      acoes.appendChild(btn('Melhorou', () => agir(p.id, 'melhorou', aoMudar, 'Que bom! O treino volta aos poucos.'), 'sm ghost', 'check'));
      if (ef.perguntar) acoes.appendChild(btn('Ainda não', () => agir(p.id, 'ainda', aoMudar, 'Certo. O treino segue ajustado.'), 'sm ghost'));
      if (!p.avaliado && (p.sinais || (p.tipo === 'dor-cabeca' && p.detalhe === 'esforco') || (p.tipo === 'cabeca' && p.detalhe === 'sintomas'))) acoes.appendChild(btn('Já fui avaliado', () => agir(p.id, 'avaliado', aoMudar, 'Anotado. Siga o que o profissional orientou.'), 'sm ghost'));
      linha.appendChild(acoes);
    }
    card.appendChild(linha);
  }
  if (contar) card.appendChild(botaoContarProblema('block ghost sm', aoMudar));
  return card;
}

// Aviso para o treino de musculação de hoje: null quando nada muda.
export function avisoDoTreino() {
  let e;
  try { e = efeitoDeHoje(state, hojeK()); } catch { return null; }
  if (!e.principal) return null;
  if (e.musc === 'sem') return note(e.principal.ef.nivel === 'urgente' ? 'danger' : 'warn', `${e.principal.ef.titulo}: ${e.principal.ef.texto}`);
  if (e.musc === 'leve') return note('info', 'Hoje, treino leve: uma série a menos, menos carga e pare se algo piorar.');
  const bloqueadas = e.regioes.filter((x) => x.modo === 'bloqueia');
  if (bloqueadas.length) return note('info', `Exercícios que usam ${bloqueadas.map((x) => LOCAIS_DOR[x.onde].toLowerCase()).join(', ')} ficam de fora hoje. O aviso aparece em cada um.`);
  if (e.regioes.length) return note('info', `Cuidado com ${e.regioes.map((x) => LOCAIS_DOR[x.onde].toLowerCase()).join(', ')}: menos carga nos exercícios dessa região.`);
  return null;
}

// Antes de começar a musculação num dia "sem treino": folha que explica e oferece "Melhorou". Devolve true se bloqueou.
export function barrarSemTreino() {
  let e;
  try { e = efeitoDeHoje(state, hojeK()); } catch { return false; }
  if (e.musc !== 'sem' || !e.principal) return false;
  const { p, ef } = e.principal;
  const corpo = [note(ef.nivel === 'urgente' ? 'danger' : 'warn', ef.texto), ef.nivel === 'urgente' ? ligar() : null, porQue(ef.porque, ef.refs)];
  const f = folha({
    title: ef.titulo,
    body: corpo,
    footer: [btn('Fechar', () => f.close(), 'ghost grow'), ef.fase === 'ativo' ? btn('Já melhorei', () => { f.close(); agir(p.id, 'melhorou', null, 'Que bom! Comece com um treino leve.'); }, 'primary grow', 'check') : null],
  });
  f.el.id = 'folha-sem-treino';
  return true;
}

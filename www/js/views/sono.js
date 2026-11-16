// Meta de sono: a tela (#/sono) e o cartão da tela inicial.
// As regras e as contas ficam em logic/sono.js; os textos e as referências, em data/sono.js.
import { h, btn, icon, badge, note, stepper, toast, confirmSheet, dateKey, DIAS_CURTO, SVG_NS } from '../ui.js';
import { state, update } from '../store.js';
import { refresh } from '../router.js';
import { folha } from './common.js';
import { buscarFaq } from '../data/knowledge.js';
import { REFS_SONO, FAQ_SONO, SINAIS_SONO } from '../data/sono.js';
import {
  painelDeSono, metaDeSono, noiteDe, gravarNoite, apagarNoite, cochilosDe, minutosDeCochilo, gravarCochilo, apagarCochilo, horaDeDormir, horaValida, fmtHoras, fmtFaixa,
  HORAS_MAX, PASSO, IDADE_MIN, IDADE_MAX, NOITES_PARA_REGULARIDADE, COCHILO_PASSO, COCHILO_MAX, COCHILOS_POR_DIA,
} from '../logic/sono.js';

const hojeKey = () => dateKey(new Date());
const p2 = (n) => String(n).padStart(2, '0');
// "7h30", para caber embaixo de cada dia
const curto = (horas) => { const m = Math.round(horas * 60); return `${Math.floor(m / 60)}h${m % 60 ? p2(m % 60) : ''}`; };
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const wd = (k) => new Date(k + 'T12:00:00').getDay();
// A noite de um registro, pelo dia em que a pessoa acordou: "quinta para sexta" e "Noite de quinta para sexta, 13/11".
// A data deixa claro de que noite se fala, inclusive de madrugada, quando "esta noite" seria ambíguo.
const entreDias = (k) => `${DIAS[(wd(k) + 6) % 7]} para ${DIAS[wd(k)]}`;
const noiteTxt = (k) => `Noite de ${entreDias(k)}, ${Number(k.slice(8, 10))}/${k.slice(5, 7)}`;
const diaTxt = (k) => `${DIAS[wd(k)]}, ${Number(k.slice(8, 10))}/${k.slice(5, 7)}`;
// "25 min", "1 h 10"
const fmtMin = (min) => (min < 60 ? `${min} min` : fmtHoras(min / 60));
const cochiloTxt = (c) => (c.inicio ? `${c.inicio} · ` : '') + fmtMin(c.min);
// a noite que vem, para quem está no dia `k`
const proximaNoite = (k) => `${DIAS[wd(k)]} para ${DIAS[(wd(k) + 1) % 7]}`;
const ESTADO = { abaixo: ['Abaixo da faixa', 'warn'], dentro: ['Dentro da faixa', 'ok'], acima: ['Acima da faixa', ''] };
const ORIGEM = { treinador: 'informada ao Treinador', nutricao: 'informada à Nutricionista', corrida: 'informada ao Treinador de corrida', sono: 'informada aqui' };

// A tela pode ficar aberta de um dia para o outro. Antes de gravar "a noite de hoje", confere se o dia ainda é o do
// desenho; se virou, redesenha (a noite mostrada passa a ser a certa) e a pessoa confirma na tela nova.
function mesmoDia(desenhadoEm) {
  if (hojeKey() === desenhadoEm) return true;
  toast('O dia mudou. Confira a noite antes de registrar.');
  refresh();
  return false;
}

// ---------- peças ----------
function fontes(chaves) {
  const box = h('div', { class: 'col gap-s' });
  for (const k of [...new Set(chaves || [])]) if (REFS_SONO[k]) box.appendChild(h('p', { class: 'ref', text: '• ' + REFS_SONO[k] }));
  return box;
}
const porQue = (refs, rotulo = 'Fontes') => (refs && refs.length ? h('details', { class: 'pq' }, h('summary', { text: rotulo }), fontes(refs)) : null);
const acc = (titulo, ...filhos) => h('details', { class: 'acc' }, h('summary', { text: titulo }), h('div', null, ...filhos));
const aviso = (a) => h('div', { class: 'note ' + (a.tipo === 'warn' ? 'warn' : 'info') }, icon(a.tipo === 'warn' ? 'warn' : 'info'), h('div', { class: 'grow' }, h('div', { text: a.texto }), porQue(a.refs)));

// horas dormidas com − e + (de 15 em 15 minutos)
function passoHoras(valor, onChange, cls = '') {
  let v = valor;
  const saida = h('output', { 'aria-live': 'polite', text: fmtHoras(v) });
  const set = (n) => { v = Math.min(HORAS_MAX, Math.max(0, Math.round(n / PASSO) * PASSO)); saida.textContent = fmtHoras(v); onChange(v); };
  return h('div', { class: 'stepper sono-passo ' + cls, role: 'group', 'aria-label': 'Horas dormidas' },
    h('button', { type: 'button', 'aria-label': 'Menos 15 minutos de sono', onClick: () => set(v - PASSO) }, '−'),
    saida,
    h('button', { type: 'button', 'aria-label': 'Mais 15 minutos de sono', onClick: () => set(v + PASSO) }, '+'));
}
// "Como você acordou?", de 1 a 5 (opcional: tocar de novo desmarca). Os botões não são recriados ao tocar, para o
// foco do teclado e do leitor de tela ficar onde estava.
function notaDeAcordar(r) {
  const botoes = [];
  const marcar = () => { botoes.forEach((b, i) => { const on = r.qualidade === i + 1; b.className = 'chip' + (on ? ' on' : ''); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); };
  for (let i = 1; i <= 5; i++) botoes.push(h('button', { type: 'button', class: 'chip', 'aria-label': `Acordei ${i} de 5`, onClick: () => { r.qualidade = r.qualidade === i ? 0 : i; marcar(); } }, String(i)));
  marcar();
  return h('div', { class: 'col gap-s' }, h('div', { class: 'small muted', text: 'Como você acordou? 1 = muito cansado · 5 = bem descansado (opcional)' }),
    h('div', { class: 'chips wrap', role: 'group', 'aria-label': 'Como você acordou, de 1 a 5' }, ...botoes));
}
// horas que aparecem primeiro no registro: as da noite mais recente em que a pessoa dormiu (0 h não serve de sugestão)
// ou, sem nenhuma, o alvo
function horasIniciais(meta) {
  const l = state.sono.registros;
  for (let i = l.length - 1; i >= 0; i--) if (l[i].horas > 0) return l[i].horas;
  return meta ? meta.alvo : 8;
}
function salvarNoite(data, r) {
  let ok = null;
  update((s) => { ok = gravarNoite(s.sono, { data, horas: r.horas, ...(r.qualidade ? { qualidade: r.qualidade } : {}) }, hojeKey()); });
  toast(ok ? 'Noite registrada.' : 'Não consegui registrar essa noite.');
  return !!ok;
}

// Folha para registrar, corrigir ou apagar um cochilo. `indice` = posição do cochilo no dia (para corrigir) ou -1 (novo).
function folhaCochilo(data, indice = -1) {
  const atual = indice >= 0 ? cochilosDe(state, data)[indice] || null : null;
  const r = { min: atual ? atual.min : 20, inicio: atual && atual.inicio ? atual.inicio : '' };
  let v = r.min;
  const saida = h('output', { 'aria-live': 'polite', text: fmtMin(v) });
  const set = (n) => { v = Math.min(COCHILO_MAX, Math.max(COCHILO_PASSO, Math.round(n / COCHILO_PASSO) * COCHILO_PASSO)); saida.textContent = fmtMin(v); r.min = v; };
  const passo = h('div', { class: 'stepper sono-passo', role: 'group', 'aria-label': 'Duração do cochilo' },
    h('button', { type: 'button', 'aria-label': 'Menos 5 minutos de cochilo', onClick: () => set(v - COCHILO_PASSO) }, '−'), saida,
    h('button', { type: 'button', 'aria-label': 'Mais 5 minutos de cochilo', onClick: () => set(v + COCHILO_PASSO) }, '+'));
  const hora = h('input', { type: 'time', class: 'input sono-hora', value: r.inicio, 'aria-label': 'Hora em que o cochilo começou', onChange: (e) => { r.inicio = e.target.value; } });
  const corpo = h('div', { class: 'col gap-l' },
    h('p', { class: 'bold', id: 'sono-folha-cochilo', text: `Cochilo de ${diaTxt(data)}` }),
    h('div', { class: 'col gap-s center' }, h('div', { class: 'small bold', text: 'Quanto tempo você cochilou?' }), h('div', null, passo)),
    h('div', { class: 'row between' }, h('span', { class: 'small', text: 'Começou às (opcional)' }), hora));
  const salvar = () => {
    let ok = null;
    update((s) => { ok = gravarCochilo(s.sono, { data, min: r.min, ...(horaValida(r.inicio) ? { inicio: r.inicio } : {}) }, hojeKey(), atual ? indice : -1); });
    toast(ok ? 'Cochilo registrado.' : 'Não consegui registrar esse cochilo.');
    if (ok) { f.close(); refresh(); }
  };
  const apagar = async () => {
    const sim = await confirmSheet({ title: 'Apagar este cochilo?', text: `Cochilo de ${diaTxt(data)}: ${cochiloTxt(atual)}. Não dá para desfazer.`, okLabel: 'Apagar', danger: true });
    if (!sim) return;
    update((s) => { apagarCochilo(s.sono, data, indice); });
    f.close(); toast('Cochilo apagado.'); refresh();
  };
  const f = folha({
    title: atual ? 'Corrigir o cochilo' : 'Registrar um cochilo', body: corpo,
    footer: [atual ? btn('Apagar', apagar, 'ghost danger') : btn('Cancelar', () => f.close(), 'ghost'), btn('Salvar', salvar, 'primary grow')],
  });
}
// Lista dos cochilos de um dia (cada um abre a folha para corrigir) e o botão de acrescentar. `antes` é chamado antes de
// abrir a folha do cochilo (para fechar a folha de onde se veio).
function listaDeCochilos(data, antes = null) {
  const l = cochilosDe(state, data);
  const abrir = (i) => { if (antes && antes() === false) return; folhaCochilo(data, i); };
  const box = h('div', { class: 'col gap-s sono-cochilos' });
  l.forEach((c, i) => box.appendChild(h('button', { type: 'button', class: 'sono-cochilo', 'aria-label': `Cochilo: ${cochiloTxt(c)}. Tocar para corrigir`, onClick: () => abrir(i) }, icon('moon', 's'), h('span', { class: 'grow', text: cochiloTxt(c) }), icon('edit', 's muted'))));
  if (l.length < COCHILOS_POR_DIA) box.appendChild(btn(l.length ? 'Outro cochilo' : 'Registrar cochilo', () => abrir(-1), 'sm ghost block', 'plus'));
  return box;
}

// Folha para registrar, corrigir ou apagar a noite de um dia (o dia em que a pessoa acordou). A data vai escrita na folha.
// Embaixo ficam os cochilos do mesmo dia.
function folhaNoite(data, meta) {
  const atual = noiteDe(state, data);
  const r = { horas: atual ? atual.horas : horasIniciais(meta), qualidade: atual && atual.qualidade ? atual.qualidade : 0 };
  const corpo = h('div', { class: 'col gap-l' },
    h('p', { class: 'bold', id: 'sono-folha-noite', text: noiteTxt(data) }),
    h('div', { class: 'col gap-s center' }, h('div', { class: 'small bold', text: 'Quanto você dormiu?' }), h('div', null, passoHoras(r.horas, (v) => { r.horas = v; }))),
    notaDeAcordar(r),
    h('div', { class: 'col gap-s' }, h('div', { class: 'small bold', text: `Cochilos de ${DIAS[wd(data)]}` }), listaDeCochilos(data, () => f.close())));
  const apagar = async () => {
    const sim = await confirmSheet({ title: 'Apagar esta noite?', text: `${noiteTxt(data)}: ${fmtHoras(atual.horas)}. Não dá para desfazer.`, okLabel: 'Apagar', danger: true });
    if (!sim) return;
    update((s) => { apagarNoite(s.sono, data); });
    f.close(); toast('Noite apagada.'); refresh();
  };
  const f = folha({
    title: atual ? 'Corrigir a noite' : 'Registrar a noite', body: corpo,
    footer: [
      atual ? btn('Apagar', apagar, 'ghost danger') : btn('Cancelar', () => f.close(), 'ghost'),
      btn('Salvar', () => { if (salvarNoite(data, r)) { f.close(); refresh(); } }, 'primary grow'),
    ],
  });
}

// Folha da idade (só para quem não a informou em nenhuma entrevista).
function folhaIdade(atual) {
  let v = atual || 30;
  const f = folha({
    title: 'Sua idade',
    body: h('div', { class: 'col gap-l center' }, h('p', { class: 'small muted', text: 'A faixa de horas de sono recomendada muda com a idade.' }), h('div', null, stepper({ value: v, min: IDADE_MIN, max: IDADE_MAX, step: 1, label: 'Idade em anos', onChange: (n) => { v = n; } }))),
    footer: [btn('Cancelar', () => f.close(), 'ghost'), btn('Salvar', () => { update((s) => { s.sono.idade = Math.round(v); }); f.close(); refresh(); }, 'primary grow')],
  });
}

// ---------- cartões da tela ----------
function cartaoMeta(pn) {
  const { meta, perfil } = pn;
  const card = h('div', { class: 'card hl col', id: 'sono-meta' },
    h('div', { class: 'row between' },
      h('div', null, h('div', { class: 'tiny bold muted', text: `META DESTA NOITE · ${proximaNoite(pn.hoje)}` }), h('div', { class: 'sono-alvo', text: fmtHoras(meta.alvo) })),
      badge('faixa: ' + fmtFaixa(meta.min, meta.max), 'ok')),
    h('ul', { class: 'sono-motivos' }, ...meta.motivos.map((m) => h('li', { text: m.texto }))),
    porQue(meta.motivos.flatMap((m) => m.refs)));
  for (const a of meta.avisos) card.appendChild(aviso(a));
  card.appendChild(h('div', { class: 'row between' },
    h('span', { class: 'tiny muted', text: `Idade: ${perfil.idade} anos, ${ORIGEM[perfil.origemIdade] || 'informada'}.` }),
    perfil.origemIdade === 'sono' ? btn('Alterar', () => folhaIdade(perfil.idade), 'sm ghost') : null));
  return card;
}

// `aoMudar` é chamado depois que a hora de acordar muda (as dicas usam a hora de deitar).
function cartaoHorario(pn, aoMudar) {
  const { meta } = pn;
  const saida = h('p', { id: 'sono-deitar' });
  const mostrar = () => {
    while (saida.firstChild) saida.removeChild(saida.firstChild);
    const d = horaDeDormir(state.sono.acordar, meta.alvo);
    if (d) { saida.className = ''; saida.append(`Para dormir ${fmtHoras(meta.alvo)}, apague a luz às `, h('b', { text: d }), '.'); }
    else { saida.className = 'small muted'; saida.textContent = 'Informe a hora em que você costuma acordar para ver a hora de deitar.'; }
  };
  mostrar();
  // a tela inteira não é redesenhada a cada mudança da hora (o campo perderia o foco no meio da digitação):
  // só a hora de deitar e as dicas
  const campo = h('input', { type: 'time', class: 'input sono-hora', value: state.sono.acordar, 'aria-label': 'Hora de acordar', onChange: (e) => {
    const v = e.target.value;
    if (v !== '' && !horaValida(v)) return;
    update((s) => { s.sono.acordar = v; });
    mostrar();
    aoMudar();
  } });
  return h('div', { class: 'card col gap-s' },
    h('div', { class: 'row between' }, h('h3', { text: 'Acordo às' }), campo),
    saida);
}

function cartaoNoite(pn) {
  const { meta, semana, hoje } = pn;
  const u = semana.ultima;
  if (u) {
    const est = ESTADO[semana.dias[semana.dias.length - 1].estado];
    return h('div', { class: 'card col gap-s', id: 'sono-noite' },
      h('div', { class: 'row between wrap' }, h('h3', { text: noiteTxt(hoje) }), est ? badge(est[0], est[1]) : null),
      h('div', { class: 'row between' },
        h('div', null, h('div', { class: 'sono-alvo m', text: fmtHoras(u.horas) }), u.qualidade ? h('div', { class: 'small muted', text: `Acordou: ${u.qualidade} de 5` }) : null),
        btn('Corrigir', () => { if (mesmoDia(hoje)) folhaNoite(hoje, meta); }, 'sm ghost', 'edit')));
  }
  const r = { horas: horasIniciais(meta), qualidade: 0 };
  return h('div', { class: 'card col', id: 'sono-noite' },
    h('div', null, h('h3', { text: noiteTxt(hoje) }), h('p', { class: 'small muted', text: 'Quanto você dormiu?' })),
    h('div', { class: 'row between' }, passoHoras(r.horas, (v) => { r.horas = v; }), btn('Registrar', () => { if (mesmoDia(hoje) && salvarNoite(hoje, r)) refresh(); }, 'primary', 'check')),
    notaDeAcordar(r));
}

// Cochilos de hoje: lista, botão de registrar e como eles contam para a meta (soma até os 18 anos; à parte nos adultos).
function cartaoCochilos(pn) {
  const { meta, semana, hoje } = pn;
  const d = semana.dias[semana.dias.length - 1];
  const min = d ? d.cochiloMin : 0;
  let texto = meta.soma24h ? 'Na sua idade, a faixa vale para o sono em 24 horas: o cochilo soma à noite.' : 'Para adultos, a meta é a da noite. O cochilo aparece à parte: ajuda em noite curta, sem substituí-la.';
  if (min && meta.soma24h && d.total != null) texto = `Noite + cochilos: ${fmtHoras(d.total)} (${ESTADO[d.estado][0].toLowerCase()}).`;
  else if (min) texto = `Cochilos de hoje: ${fmtMin(min)}. ${meta.soma24h ? 'Registre a noite de hoje para eles somarem na comparação com a faixa.' : 'Não entram na meta, que é a da noite.'}`;
  return h('div', { class: 'card col gap-s', id: 'sono-cochilo' },
    h('h3', { text: `Cochilos de hoje, ${DIAS[wd(hoje)]}` }),
    listaDeCochilos(hoje, () => mesmoDia(hoje)),
    h('p', { class: 'small muted', text: texto }),
    porQue(meta.soma24h ? ['paruthi2016'] : ['watson2015', 'sletten2023', 'walsh2021']));
}

const svg = (tag, attrs, text) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k of Object.keys(attrs)) e.setAttribute(k, String(attrs[k]));
  if (text != null) e.textContent = text;
  return e;
};
// barras dos 7 dias, com a faixa recomendada ao fundo e a linha do alvo
function grafico(semana) {
  const { meta, dias } = semana;
  const W = 320, H = 132, PL = 20, PT = 6, PB = 4;
  const topo = Math.max(meta.max + 2, ...dias.map((d) => (d.horas || 0) + d.cochiloMin / 60 + 1));
  const y = (v) => PT + ((H - PT - PB) * (topo - v)) / topo;
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart sono-graf', role: 'img', 'aria-label': `Horas dormidas nos últimos 7 dias. Faixa recomendada: ${fmtFaixa(meta.min, meta.max)}. Alvo: ${fmtHoras(meta.alvo)}.` });
  g.appendChild(svg('rect', { x: PL, y: y(meta.max), width: W - PL, height: y(meta.min) - y(meta.max), rx: 3, class: 'zona' }));
  g.appendChild(svg('text', { x: PL - 4, y: y(meta.max) + 3, 'text-anchor': 'end' }, String(meta.max)));
  g.appendChild(svg('text', { x: PL - 4, y: y(meta.min) + 3, 'text-anchor': 'end' }, String(meta.min)));
  g.appendChild(svg('line', { x1: PL, y1: H - PB, x2: W, y2: H - PB, class: 'ax' }));
  const bw = (W - PL) / 7;
  dias.forEach((d, i) => {
    // a noite embaixo e, por cima dela, o cochilo do dia em outra cor
    const noite = d.horas == null ? 0 : Math.max(2, y(0) - y(d.horas));
    if (d.horas != null) g.appendChild(svg('rect', { x: PL + i * bw + bw * 0.2, y: H - PB - noite, width: bw * 0.6, height: noite, rx: 3, class: 'bar ' + (d.estado || 'dentro') }));
    if (d.cochiloMin > 0) {
      const alt = Math.max(2, y(0) - y(d.cochiloMin / 60));
      g.appendChild(svg('rect', { x: PL + i * bw + bw * 0.2, y: H - PB - noite - alt - (noite ? 1 : 0), width: bw * 0.6, height: alt, rx: 2, class: 'bar cochilo' }));
    }
  });
  g.appendChild(svg('line', { x1: PL, y1: y(meta.alvo), x2: W, y2: y(meta.alvo), class: 'alvo' }));
  return g;
}
// A variação é um desvio-padrão: o quanto, em geral, cada noite se afasta da média (não a diferença entre duas noites).
const REGULARIDADE = {
  regular: 'Suas noites foram parecidas: em geral, ficaram a menos de 1 hora da sua média.',
  variavel: 'Suas noites variaram: em geral, ficaram a mais de 1 hora da sua média.',
  irregular: 'Suas noites variaram muito: em geral, ficaram a mais de 2 horas da sua média.',
};
function cartaoSemana(pn) {
  const { meta, semana, hoje } = pn;
  const dias = h('div', { class: 'sono-dias' });
  for (const d of semana.dias) {
    dias.appendChild(h('button', {
      type: 'button', class: 'sono-dia' + (d.data === hoje ? ' hoje' : '') + (d.horas == null ? ' vazio' : ''), 'data-dia': d.data,
      'aria-label': `${noiteTxt(d.data)}: ${d.horas == null ? 'sem registro' : fmtHoras(d.horas)}${d.cochiloMin ? `; cochilos: ${fmtMin(d.cochiloMin)}` : ''}. Tocar para registrar ou corrigir a noite e os cochilos`,
      onClick: () => { if (mesmoDia(hoje)) folhaNoite(d.data, meta); },
    }, h('span', { text: DIAS_CURTO[d.wd] }), h('b', { text: d.horas == null ? '+' : curto(d.horas) }), d.cochiloMin ? h('i', { class: 'sono-mais', text: `+${d.cochiloMin < 60 ? d.cochiloMin + 'm' : curto(d.cochiloMin / 60)}` }) : null));
  }
  const ck = semana.cochilo;
  const card = h('div', { class: 'card col', id: 'sono-semana' },
    h('div', { class: 'row between' }, h('h3', { text: 'Últimos 7 dias' }), h('span', { class: 'small muted', text: `${semana.n} de 7 noites` })),
    grafico(semana), dias,
    ck.dias ? h('div', { class: 'sono-legenda tiny muted' }, h('span', null, h('i', { class: 'cochilo' }), 'cochilo, por cima da barra da noite')) : null,
    h('p', { class: 'tiny muted', text: 'Cada dia é a noite que terminou nele. Faixa verde: o recomendado para você. Linha tracejada: o alvo. Toque em um dia para registrar ou corrigir a noite e os cochilos.' }));
  if (semana.n) {
    card.appendChild(h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', { text: fmtHoras(semana.mediaDaMeta) }), h('span', { text: semana.soma24h ? 'média 24 h' : 'média' })),
      h('div', { class: 'stat' }, h('b', { text: `${semana.abaixo} de ${semana.n}` }), h('span', { text: semana.soma24h ? 'dias curtos' : 'noites curtas' })),
      h('div', { class: 'stat' }, h('b', { text: semana.desvioMin == null ? '–' : `± ${semana.desvioMin} min` }), h('span', { text: 'variação' }))));
    card.appendChild(h('div', null,
      h('p', { class: 'small', text: semana.regularidade ? REGULARIDADE[semana.regularidade] : `Com ${NOITES_PARA_REGULARIDADE} noites registradas na semana, eu mostro o quanto o seu sono varia.` }),
      h('details', { class: 'pq' }, h('summary', { text: 'Como ler' }),
        h('p', { class: 'small', text: 'A média de 7 dias mostra melhor o seu sono do que uma noite só. A variação é o quanto, em geral, cada noite se afasta dessa média: dormir em horários parecidos é importante para a saúde. Não existe saldo de horas a pagar: o sono perdido só se recupera em parte.' }),
        h('div', { class: 'mt' }, fontes(['sletten2023', 'huang2020', 'kitamura2016'])))));
  }
  if (ck.dias) {
    // até os 18 anos o cochilo soma à noite do mesmo dia; sem a noite registrada, não há o que somar, e a tela avisa
    const comoContam = !semana.soma24h ? ' Não entram na média da noite.'
      : ck.semNoite === 0 ? ' Já estão somados na média acima.'
        : ck.semNoite === ck.dias ? ' Ainda não entram na média em 24 horas: falta registrar a noite desses dias.'
          : ` Entram na média em 24 horas só nos dias com a noite registrada: ${ck.semNoite === 1 ? '1 dia de cochilo ficou de fora' : `${ck.semNoite} dias de cochilo ficaram de fora`}.`;
    card.appendChild(h('p', { class: 'small', id: 'sono-semana-cochilos', text: `Cochilos: ${ck.dias === 1 ? 'em 1 dia' : `em ${ck.dias} dias`}, ${fmtMin(ck.mediaMin)} em média por dia.${comoContam}` }));
  }
  for (const a of semana.avisos) card.appendChild(aviso(a));
  return card;
}

function desenharDicas(box, dicas) {
  while (box.firstChild) box.removeChild(box.firstChild);
  if (!dicas.length) return;
  box.appendChild(h('h2', { text: 'Dicas para você' }));
  for (const d of dicas) box.appendChild(h('div', { class: 'dica' + (d.tom === 'atencao' ? ' atencao' : ''), 'data-dica': d.id }, h('div', { class: 'dica-ic' }, icon(d.tom === 'atencao' ? 'bolt' : 'moon')), h('div', { class: 'grow' }, h('div', { class: 'bold', text: d.titulo }), h('div', { class: 'small', text: d.texto }), porQue(d.refs))));
}

function sinais() {
  return h('div', { class: 'note warn sono-sinais' }, icon('warn'), h('div', { class: 'grow' },
    h('div', { class: 'bold', text: 'Quando procurar um médico' }),
    h('ul', null, ...SINAIS_SONO.itens.map((t) => h('li', { text: t }))),
    h('p', { class: 'small', text: SINAIS_SONO.nota }),
    porQue(SINAIS_SONO.refs)));
}

function faq() {
  const wrap = h('div', { class: 'col' });
  const results = h('div', { class: 'col gap-s' });
  let todas = false;
  const draw = (termo) => {
    while (results.firstChild) results.removeChild(results.firstChild);
    const itens = buscarFaq(FAQ_SONO, termo).slice(0, termo ? 8 : todas ? FAQ_SONO.length : 4);
    if (!itens.length) { results.appendChild(note('info', 'Não encontrei isso na minha base. Só respondo o que tem apoio em estudos; para o seu caso, procure um médico.')); return; }
    for (const it of itens) results.appendChild(acc(it.q, ...it.a.map((p) => h('p', { text: p })), h('div', { class: 'tiny bold muted', text: 'FONTES' }), fontes(it.f)));
    if (!termo && !todas) results.appendChild(btn(`Ver todas as ${FAQ_SONO.length} perguntas`, () => { todas = true; draw(''); }, 'block ghost sm'));
  };
  wrap.appendChild(h('h2', { text: 'Perguntas sobre o sono' }));
  wrap.appendChild(h('div', { class: 'search' }, icon('search'), h('input', { class: 'input', type: 'search', placeholder: 'Ex.: café, cochilo, treino à noite, ronco', 'aria-label': 'Buscar nas perguntas sobre o sono', autocomplete: 'off', onInput: (e) => draw(e.target.value) })));
  wrap.appendChild(results);
  draw('');
  return wrap;
}

// ---------- tela ----------
export function sonoView() {
  const hoje = hojeKey();
  const pn = { ...painelDeSono(state, hoje), hoje };
  const body = [];
  if (!pn.meta) {
    // idade desconhecida: sem ela não há faixa
    let v = 30;
    body.push(h('div', { class: 'card hl col', id: 'sono-idade' },
      h('div', { class: 'row' }, h('div', { class: 'avatar' }, icon('moon', 'l')), h('div', { class: 'grow' }, h('h2', { text: 'Sua meta de sono' }), h('p', { class: 'small muted', text: 'Quantas horas dormir, pela sua idade e pelos seus treinos.' }))),
      h('p', { text: 'Para começar, quantos anos você tem?' }),
      h('div', { class: 'row between' }, stepper({ value: v, min: IDADE_MIN, max: IDADE_MAX, step: 1, label: 'Idade em anos', onChange: (n) => { v = n; } }), btn('Ver minha meta', () => { update((s) => { s.sono.idade = Math.round(v); }); refresh(); }, 'primary')),
      h('p', { class: 'tiny muted', text: 'Se você responder ao Treinador ou à Nutricionista, a idade informada lá passa a valer.' })));
  } else {
    const dicas = h('div', { class: 'col', id: 'sono-dicas' });
    desenharDicas(dicas, pn.dicas);
    body.push(cartaoMeta(pn), cartaoHorario(pn, () => desenharDicas(dicas, painelDeSono(state, hojeKey()).dicas)), cartaoNoite(pn), cartaoCochilos(pn), cartaoSemana(pn), dicas);
  }
  body.push(sinais(), faq());
  body.push(h('p', { class: 'tiny muted center', text: 'Informação educativa baseada em consensos e estudos publicados. Não substitui avaliação médica.' }));
  return { title: 'Sono', back: '', body };
}

// ---------- cartão da tela inicial ----------
export function cartaoSono() {
  const hoje = hojeKey();
  const meta = metaDeSono(state, hoje);
  if (!meta) {
    return h('a', { class: 'card click row sono-convite', href: '#/sono', id: 'cartao-sono' },
      h('div', { class: 'avatar' }, icon('moon')), h('div', { class: 'grow' }, h('h3', { text: 'Quantas horas você precisa dormir?' }), h('p', { class: 'small muted', text: 'Defina a sua meta de sono em um toque.' })), icon('right', 's muted'));
  }
  const u = noiteDe(state, hoje);
  const deitar = horaDeDormir(state.sono.acordar, meta.alvo);
  // o título fica fora do link, e o link não tem rótulo próprio: o leitor de tela lê a meta que está escrita nele
  const card = h('div', { class: 'card col gap-s', id: 'cartao-sono' },
    h('div', { class: 'row between' }, h('h2', { text: 'Sono' }),
      h('a', { class: 'sono-abrir', href: '#/sono', title: 'Abrir a meta de sono' }, h('span', { text: `Meta: ${fmtHoras(meta.alvo)} (${fmtFaixa(meta.min, meta.max)})` }), icon('right', 's'))));
  const cochilo = minutosDeCochilo(state, hoje);
  if (u) {
    const valor = u.horas + (meta.soma24h ? cochilo / 60 : 0); // até os 18 anos o cochilo soma à noite
    const est = ESTADO[valor < meta.min ? 'abaixo' : valor > meta.max ? 'acima' : 'dentro'];
    card.appendChild(h('div', { class: 'row between wrap' }, h('span', null, `Noite de ${entreDias(hoje)}: `, h('b', { text: fmtHoras(u.horas) })), badge(est[0], est[1])));
  } else {
    const r = { horas: horasIniciais(meta) };
    card.appendChild(h('div', { class: 'small muted', text: `Noite de ${entreDias(hoje)}: quanto você dormiu?` }));
    card.appendChild(h('div', { class: 'row between' },
      passoHoras(r.horas, (v) => { r.horas = v; }, 'sm'),
      btn('Registrar', () => { if (mesmoDia(hoje) && salvarNoite(hoje, r)) refresh(); }, 'sm primary', 'check')));
  }
  if (cochilo) card.appendChild(h('div', { class: 'small', id: 'cartao-sono-cochilo' }, 'Cochilo de hoje: ', h('b', { text: fmtMin(cochilo) }), meta.soma24h && u ? ` · noite + cochilo: ${fmtHoras(u.horas + cochilo / 60)}` : ''));
  if (deitar) card.appendChild(h('p', { class: 'small muted', text: `Para acordar às ${state.sono.acordar}, deite até as ${deitar}.` }));
  return card;
}

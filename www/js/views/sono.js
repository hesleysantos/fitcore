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
  minutosEntre, horaMais,
  HORAS_MAX, PASSO_MIN, IDADE_MIN, IDADE_MAX, NOITES_PARA_REGULARIDADE, COCHILO_PASSO, COCHILO_MIN, COCHILO_MAX, COCHILOS_POR_DIA,
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

// Tempo ao minuto: os números são campos que se digitam (horas e minutos, ou só minutos no cochilo); − e + andam de
// 5 em 5 minutos, parando nos múltiplos de 5. `onChange` recebe o total em minutos. O elemento devolvido tem
// `definir(minutos)`, para mudar o valor por fora (quando a pessoa informa os horários e a tela faz a conta).
function campoDeTempo(minutos, onChange, { cls = '', min = 0, max = HORAS_MAX * 60, passo = PASSO_MIN, soMinutos = false, rotulo = 'Tempo dormido', de = 'de sono' } = {}) {
  const limitar = (n) => Math.min(max, Math.max(min, Math.round(n)));
  let v = limitar(minutos);
  const campo = (label, tam) => h('input', { type: 'text', inputmode: 'numeric', maxlength: String(tam), autocomplete: 'off', 'aria-label': label });
  const cH = soMinutos ? null : campo(`${rotulo}: horas`, 2);
  const cM = campo(soMinutos ? `${rotulo}, em minutos` : `${rotulo}: minutos`, soMinutos ? 3 : 2);
  const num = (c) => { const n = parseInt(c.value.replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : 0; };
  const lido = () => (cH ? num(cH) * 60 : 0) + num(cM); // "75" nos minutos vale 1 h 15
  const mostrar = () => { if (cH) { cH.value = String(Math.floor(v / 60)); cM.value = p2(v % 60); } else cM.value = String(v); };
  const set = (n, calado = false) => { v = limitar(n); mostrar(); if (!calado) onChange(v); };
  for (const c of [cH, cM]) {
    if (!c) continue;
    c.addEventListener('focus', () => c.select());
    // enquanto digita, o valor já vale (para o botão de registrar), mas o campo só é reescrito ao sair dele
    c.addEventListener('input', () => { v = limitar(lido()); onChange(v); });
    c.addEventListener('change', () => set(lido()));
  }
  mostrar();
  const el = h('div', { class: 'stepper sono-passo ' + (soMinutos ? 'so-min ' : '') + cls, role: 'group', 'aria-label': rotulo },
    h('button', { type: 'button', 'aria-label': `Menos ${passo} minutos ${de}`, onClick: () => set(Math.ceil(v / passo) * passo - passo) }, '−'),
    h('div', { class: 'sono-tempo' }, cH, cH ? h('span', { 'aria-hidden': 'true', text: 'h' }) : null, cM, h('span', { 'aria-hidden': 'true', text: 'min' })),
    h('button', { type: 'button', 'aria-label': `Mais ${passo} minutos ${de}`, onClick: () => set(Math.floor(v / passo) * passo + passo) }, '+'));
  el.definir = (n) => set(n);
  return el;
}
// horas dormidas em uma noite (o valor guardado é em horas, com precisão de 1 minuto)
const passoHoras = (horas, onChange, cls = '') => campoDeTempo(Math.round(horas * 60), (m) => onChange(m / 60), { cls });
const DICA_DIGITAR = 'Toque nos números para digitar o tempo exato.';
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
  const horarios = horaValida(r.dormiu) && horaValida(r.acordou) ? { dormiu: r.dormiu, acordou: r.acordou } : {};
  update((s) => { ok = gravarNoite(s.sono, { data, horas: r.horas, ...(r.qualidade ? { qualidade: r.qualidade } : {}), ...horarios }, hojeKey()); });
  toast(ok ? 'Noite registrada.' : 'Não consegui registrar essa noite.');
  return !!ok;
}

// Folha para registrar, corrigir ou apagar um cochilo. `indice` = posição do cochilo no dia (para corrigir) ou -1 (novo).
function folhaCochilo(data, indice = -1) {
  const atual = indice >= 0 ? cochilosDe(state, data)[indice] || null : null;
  const r = { min: atual ? atual.min : 20, inicio: atual && atual.inicio ? atual.inicio : '' };
  const aviso2 = h('p', { class: 'small muted', id: 'sono-cochilo-intervalo', 'aria-live': 'polite' });
  // com a hora de início, o fim acompanha a duração; mudando o fim (ou o início, com o fim preenchido), a duração é a conta
  const fim = h('input', { type: 'time', class: 'input sono-hora', value: r.inicio ? horaMais(r.inicio, r.min) : '', 'aria-label': 'Hora em que o cochilo terminou', onChange: () => pelosHorarios() });
  const passo = campoDeTempo(r.min, (m) => { r.min = m; if (horaValida(r.inicio)) fim.value = horaMais(r.inicio, m); aviso2.textContent = ''; },
    { min: COCHILO_MIN, max: COCHILO_MAX, passo: COCHILO_PASSO, soMinutos: true, rotulo: 'Duração do cochilo', de: 'de cochilo' });
  const hora = h('input', { type: 'time', class: 'input sono-hora', value: r.inicio, 'aria-label': 'Hora em que o cochilo começou', onChange: (e) => { r.inicio = e.target.value; pelosHorarios(); } });
  function pelosHorarios() {
    const m = minutosEntre(r.inicio, fim.value);
    if (m == null) { aviso2.textContent = ''; return; }
    if (m > COCHILO_MAX) { aviso2.textContent = `Das ${r.inicio} às ${fim.value} são ${fmtMin(m)}: confira os horários (um cochilo vai até ${fmtMin(COCHILO_MAX)}).`; return; }
    passo.definir(m);
    aviso2.textContent = `Das ${r.inicio} às ${fim.value}: ${fmtMin(m)}.`;
  }
  const corpo = h('div', { class: 'col gap-l' },
    h('p', { class: 'bold', id: 'sono-folha-cochilo', text: `Cochilo de ${diaTxt(data)}` }),
    h('div', { class: 'col gap-s center' }, h('div', { class: 'small bold', text: 'Quanto tempo você cochilou?' }), h('div', null, passo), h('p', { class: 'tiny muted', text: DICA_DIGITAR })),
    h('div', { class: 'col gap-s' },
      h('div', { class: 'row between' }, h('span', { class: 'small', text: 'Começou às (opcional)' }), hora),
      h('div', { class: 'row between' }, h('span', { class: 'small', text: 'Terminou às (opcional)' }), fim),
      aviso2));
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
  const r = { horas: atual ? atual.horas : horasIniciais(meta), qualidade: atual && atual.qualidade ? atual.qualidade : 0, dormiu: atual && atual.dormiu ? atual.dormiu : '', acordou: atual && atual.acordou ? atual.acordou : '' };
  const tempo = passoHoras(r.horas, (v) => { r.horas = v; });
  // Horários da noite (opcionais): com os dois, a tela faz a conta do tempo, ao minuto. O tempo continua editável, porque
  // quem demorou a dormir ou acordou no meio da noite dormiu menos que o intervalo.
  const intervalo = h('p', { class: 'small muted', id: 'sono-intervalo', 'aria-live': 'polite' });
  const contar = (aplicar) => {
    const m = minutosEntre(r.dormiu, r.acordou);
    if (m == null) { intervalo.textContent = 'Opcional: informe os dois horários e eu faço a conta do tempo.'; return; }
    if (m > HORAS_MAX * 60) { intervalo.textContent = `Das ${r.dormiu} às ${r.acordou} são ${fmtHoras(m / 60)}: confira os horários.`; return; }
    if (aplicar) tempo.definir(m);
    intervalo.textContent = `Das ${r.dormiu} às ${r.acordou} são ${fmtHoras(m / 60)}. Se você demorou a dormir ou acordou no meio da noite, ajuste o tempo abaixo.`;
  };
  const campoHora = (k, rotulo) => h('input', { type: 'time', class: 'input sono-hora', value: r[k], 'aria-label': rotulo, onChange: (e) => { r[k] = e.target.value; contar(true); } });
  contar(false);
  const corpo = h('div', { class: 'col gap-l' },
    h('p', { class: 'bold', id: 'sono-folha-noite', text: noiteTxt(data) }),
    h('div', { class: 'col gap-s' },
      h('div', { class: 'row between' }, h('span', { class: 'small', text: 'Dormi às' }), campoHora('dormiu', 'Hora em que você dormiu')),
      h('div', { class: 'row between' }, h('span', { class: 'small', text: 'Acordei às' }), campoHora('acordou', 'Hora em que você acordou')),
      intervalo),
    h('div', { class: 'col gap-s center' }, h('div', { class: 'small bold', text: 'Quanto você dormiu?' }), h('div', null, tempo), h('p', { class: 'tiny muted', text: DICA_DIGITAR })),
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
      h('div', null, h('div', { class: 'tiny bold muted', text: `Meta desta noite · ${proximaNoite(pn.hoje)}` }), h('div', { class: 'sono-alvo', text: fmtHoras(meta.alvo) })),
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
    if (d) { saida.className = ''; saida.append('Deite até as ', h('b', { text: d }), ` para dormir ${fmtHoras(meta.alvo)}.`); }
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
        h('div', null, h('div', { class: 'sono-alvo m', text: fmtHoras(u.horas) }),
          u.dormiu && u.acordou ? h('div', { class: 'small muted', text: `Das ${u.dormiu} às ${u.acordou}` }) : null,
          u.qualidade ? h('div', { class: 'small muted', text: `Acordou: ${u.qualidade} de 5` }) : null),
        btn('Corrigir', () => { if (mesmoDia(hoje)) folhaNoite(hoje, meta); }, 'sm ghost', 'edit')));
  }
  const r = { horas: horasIniciais(meta), qualidade: 0 };
  return h('div', { class: 'card col', id: 'sono-noite' },
    h('div', null, h('h3', { text: noiteTxt(hoje) }), h('p', { class: 'small muted', text: 'Quanto você dormiu? ' + DICA_DIGITAR })),
    h('div', { class: 'row between wrap gap-s' }, passoHoras(r.horas, (v) => { r.horas = v; }), btn('Registrar', () => { if (mesmoDia(hoje) && salvarNoite(hoje, r)) refresh(); }, 'primary', 'check')),
    notaDeAcordar(r),
    btn('Informar os horários de dormir e acordar', () => { if (mesmoDia(hoje)) folhaNoite(hoje, meta); }, 'sm ghost block', 'edit'));
}

// Cochilos de hoje: lista, botão de registrar e como eles contam para a meta (soma até os 18 anos; à parte nos adultos).
function cartaoCochilos(pn) {
  const { meta, semana, hoje } = pn;
  const d = semana.dias[semana.dias.length - 1];
  const min = d ? d.cochiloMin : 0;
  let texto = meta.soma24h ? 'Na sua idade, a faixa vale para o sono em 24 horas: o cochilo soma à noite.' : 'Em adultos, o cochilo não conta na meta da noite.';
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
    h('p', { class: 'tiny muted', text: 'Verde: sua faixa. Tracejado: o alvo. Toque num dia para corrigir.' }));
  if (semana.n) {
    card.appendChild(h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', { text: fmtHoras(semana.mediaDaMeta) }), h('span', { text: semana.soma24h ? 'média 24 h' : 'média' })),
      h('div', { class: 'stat' }, h('b', { text: `${semana.abaixo} de ${semana.n}` }), h('span', { text: semana.soma24h ? 'dias curtos' : 'noites curtas' })),
      h('div', { class: 'stat' }, h('b', { class: 'nowrap', text: semana.desvioMin == null ? '–' : `± ${semana.desvioMin} min` }), h('span', { text: 'variação' }))));
    card.appendChild(h('div', null,
      h('p', { class: 'small', text: semana.regularidade ? REGULARIDADE[semana.regularidade] : `Com ${NOITES_PARA_REGULARIDADE} noites registradas na semana, eu mostro o quanto o seu sono varia.` }),
      h('details', { class: 'pq' }, h('summary', { text: 'Como ler' }),
        h('p', { class: 'small', text: 'A média de 7 dias mostra melhor o seu sono do que uma noite só. A variação é o quanto, em geral, cada noite se afasta dessa média: dormir em horários parecidos é importante para a saúde. Não existe saldo de horas a pagar: o sono perdido só se recupera em parte.' }),
        h('div', { class: 'mt' }, fontes(['sletten2023', 'huang2020', 'kitamura2016'])))));
  }
  if (ck.dias) {
    // até os 18 anos o cochilo soma à noite do mesmo dia; sem a noite registrada, não há o que somar, e a tela avisa
    // (nos adultos, que o cochilo não entra na meta já está dito no cartão dos cochilos)
    const comoContam = !semana.soma24h ? ''
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
  const cartaoDica = (d) => h('div', { class: 'dica' + (d.tom === 'atencao' ? ' atencao' : ''), 'data-dica': d.id }, h('div', { class: 'dica-ic' }, icon(d.tom === 'atencao' ? 'bolt' : 'moon')), h('div', { class: 'grow' }, h('div', { class: 'bold', text: d.titulo }), h('div', { class: 'small', text: d.texto }), porQue(d.refs)));
  // as 2 primeiras à vista; as outras, recolhidas (a tela não fica cheia demais)
  for (const d of dicas.slice(0, 2)) box.appendChild(cartaoDica(d));
  if (dicas.length > 2) {
    const resto = dicas.slice(2);
    box.appendChild(h('details', { class: 'pq mais-dicas' }, h('summary', { text: `Ver mais ${resto.length === 1 ? '1 dica' : resto.length + ' dicas'}` }), h('div', { class: 'col gap-s' }, ...resto.map(cartaoDica))));
  }
}

function sinais() {
  // fechada: o título diz o que tem dentro, e a tela não fica cheia
  return h('details', { class: 'acc sono-sinais' },
    h('summary', null, h('span', { class: 'row gap-s grow' }, icon('warn', 's warn'), h('span', { text: 'Quando procurar um médico' }))),
    h('div', null,
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
    card.appendChild(h('div', { class: 'row between wrap gap-s' },
      passoHoras(r.horas, (v) => { r.horas = v; }, 'sm'),
      btn('Registrar', () => { if (mesmoDia(hoje) && salvarNoite(hoje, r)) refresh(); }, 'sm primary', 'check')));
  }
  if (cochilo) card.appendChild(h('div', { class: 'small', id: 'cartao-sono-cochilo' }, 'Cochilo de hoje: ', h('b', { text: fmtMin(cochilo) }), meta.soma24h && u ? ` · noite + cochilo: ${fmtHoras(u.horas + cochilo / 60)}` : ''));
  if (deitar) card.appendChild(h('p', { class: 'small muted', text: `Deite até as ${deitar} para acordar às ${state.sono.acordar}.` }));
  return card;
}

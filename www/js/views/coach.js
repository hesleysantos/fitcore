// Entrevista em formato de conversa, usada pelo Treinador e pela Nutricionista.
import { h, btn, icon, stepper, note, sheet, toast, dateKey } from '../ui.js';
import { estadoLiberacao, textoDaLiberacao } from '../logic/saude.js';
import { state, update } from '../store.js';
import { go, refresh } from '../router.js';
import { situacao, alinhar, manterDiferentes, nutriPara, treinoPara } from '../logic/objetivos.js';
import { ROTULO as ROT_T } from '../logic/trainer.js';
import { ROTULO as ROT_N } from '../logic/nutrition.js';
import { marcar, limiteDe, somaDe, dicaVarios } from '../logic/escolhas.js';
const FAQ_INICIAL = 4;
import { REFS, buscarFaq } from '../data/knowledge.js';
// `nota(respostas)` (opcional): frase que depende das respostas anteriores (ex.: quantos dias livres sobram)
const notaDe = (q, a) => { let t = ''; try { t = typeof q.nota === 'function' ? q.nota(a) : ''; } catch { t = ''; } return t ? h('p', { class: 'small', 'data-nota': q.k, text: t }) : null; };

// `base` (opcional): as respostas guardadas desta entrevista, quando `respostas` traz também o que veio de outras
// entrevistas. Serve para saber se as condições ou a triagem mudaram (aí a liberação médica dada antes deixa de valer).
// Regras de saúde das perguntas (logic/saude.js):
//  • `informar` (pergunta de número): o valor de partida não vale como resposta; a pessoa ajusta ou toca em “Está certo”.
//    Respostas já guardadas, ou trazidas de outra entrevista, contam como informadas;
//  • `limpa: [chaves]`: se a resposta ficar diferente da guardada, as chaves listadas (a liberação) são apagadas;
//  • `dataEm`: a resposta "sim" guarda a data do dia; liberação de mais de 12 meses (ou sem data) é pedida de novo.
export function interview({ perguntas, respostas, onDone, onCancel, avatar = 'coach', nutri = false, notas = null, base = null }) {
  const a = { ...respostas };
  const guardadas = base && typeof base === 'object' ? base : respostas || {};
  const hoje = dateKey(new Date());
  // números que a pessoa já informou (guardados ou trazidos de outra entrevista)
  const informados = new Set(perguntas.filter((q) => q.tipo === 'numero' && typeof a[q.k] === 'number').map((q) => q.k));
  // liberação: vencida ou sem data, a resposta é pedida de novo; com condições ou triagem diferentes das guardadas, também
  const mesmo = (x, y) => { const l = (v) => (Array.isArray(v) ? [...new Set(v)].sort().join('|') : ''); return l(x) === l(y); };
  const conferirLiberacao = () => {
    for (const q of perguntas) {
      if (!Array.isArray(q.limpa)) continue;
      const igual = mesmo(a[q.k], guardadas[q.k]);
      for (const k of q.limpa) {
        const ql = perguntas.find((x) => x.k === k);
        if (!igual) { delete a[k]; if (ql && ql.dataEm) delete a[ql.dataEm]; }
      }
    }
    // tudo igual ao guardado: volta a liberação guardada (se ainda vale)
    if (perguntas.filter((q) => Array.isArray(q.limpa)).every((q) => mesmo(a[q.k], guardadas[q.k]))) {
      for (const q of perguntas) if (q.dataEm && guardadas[q.k] != null && a[q.k] == null) { a[q.k] = guardadas[q.k]; if (guardadas[q.dataEm]) a[q.dataEm] = guardadas[q.dataEm]; }
    }
    for (const q of perguntas) if (q.dataEm && a[q.k] === 'sim' && estadoLiberacao({ liberado: a[q.k], liberadoEm: a[q.dataEm] }, hoje) !== 'valida') { delete a[q.k]; delete a[q.dataEm]; }
  };
  conferirLiberacao();
  const valida = (q) => {
    const v = a[q.k];
    if (q.tipo === 'numero' && q.informar && !informados.has(q.k)) return false;
    if (q.tipo === 'numero') return typeof v === 'number' && v >= q.min && v <= q.max;
    if (q.tipo === 'um') return typeof v === 'string' && q.op.some((o) => o[0] === v && (typeof o[3] !== 'function' || o[3](a)));
    if (!Array.isArray(v) || !v.length) return false;
    // respostas antigas (ou de antes de mudar o tempo de treino) que passam do limite: a pessoa ajusta antes de seguir
    const max = limiteDe(q, a);
    return !max || somaDe(q, v) <= max;
  };
  const root = h('div', { class: 'col gap-l' });
  // começa sempre na primeira pergunta: a pessoa revê tudo (as respostas guardadas já vêm marcadas)
  let i = 0;

  // opção com condição que deixou de valer (ex.: dia de corrida que a pessoa marcou depois como "sem treino"): sai da resposta
  function podar() {
    for (const x of perguntas) {
      if (x.tipo !== 'varios' || !Array.isArray(a[x.k])) continue;
      const l = a[x.k].filter((v) => { const o = x.op.find((op) => op[0] === v); return o && (typeof o[3] !== 'function' || o[3](a)); });
      if (l.length !== a[x.k].length) { if (l.length) a[x.k] = l; else delete a[x.k]; }
    }
  }
  function draw() {
    while (root.firstChild) root.removeChild(root.firstChild);
    // perguntas com condição (campo `se`) só aparecem quando ela vale; a resposta de uma pergunta escondida é descartada
    const visiveis = () => perguntas.filter((x) => !x.se || x.se(a));
    for (const x of perguntas) if (x.se && !x.se(a)) { delete a[x.k]; if (x.dataEm) delete a[x.dataEm]; }
    podar();
    const vis = visiveis();
    if (i >= vis.length) i = vis.length - 1;
    const q = vis[i];
    root.appendChild(h('div', { class: 'col gap-s' }, h('div', { class: 'row between tiny muted' }, h('span', { text: `Pergunta ${i + 1} de ${vis.length}` })), h('div', { class: 'steps', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': vis.length, 'aria-valuenow': i + 1 }, bar((i + 1) / vis.length))));
    root.appendChild(h('div', { class: 'row top' }, h('div', { class: 'avatar' + (nutri ? ' nutri' : '') }, icon(avatar)), h('div', { class: 'bubble grow' }, h('h2', { text: q.titulo }), q.ajuda ? h('p', { class: 'small muted', text: q.ajuda }) : null, notas && notas[q.k] ? h('p', { class: 'small', text: notas[q.k] }) : null, notaDe(q, a))));
    const next = btn(i === vis.length - 1 ? 'Concluir' : 'Continuar', () => {
      if (!valida(q)) return;
      // a resposta dada agora pode mostrar ou esconder a pergunta seguinte
      const v2 = visiveis();
      const p = v2.indexOf(q);
      if (p === v2.length - 1) {
        for (const x of perguntas) if (x.se && !x.se(a)) { delete a[x.k]; if (x.dataEm) delete a[x.dataEm]; }
        // a data da liberação só existe com a resposta "sim"
        for (const x of perguntas) if (x.dataEm) { if (a[x.k] !== 'sim') delete a[x.dataEm]; else if (!a[x.dataEm]) a[x.dataEm] = hoje; }
        podar();
        onDone(a);
      } else { i = p + 1; draw(); window.scrollTo(0, 0); }
    }, 'primary lg grow');
    const sync = () => { next.disabled = !valida(q); };
    if (q.tipo === 'numero' && q.formato === 'tempo') {
      if (typeof a[q.k] !== 'number') a[q.k] = q.padrao;
      root.appendChild(h('div', { class: 'card center col' }, tempoHMS({ minutos: a[q.k], min: q.min, max: q.max, rotulo: q.titulo, onChange: (v) => { a[q.k] = v; sync(); } })));
    } else if (q.tipo === 'numero') {
      if (typeof a[q.k] !== 'number') a[q.k] = q.padrao;
      // número que ainda não foi informado: ajustar o valor ou tocar em "Está certo" libera o Continuar
      const confirma = q.informar && !informados.has(q.k)
        ? h('div', { class: 'col gap-s center', 'data-informar': q.k }, h('p', { class: 'small muted', text: 'Ajuste o valor ou toque em “Está certo” para continuar.' }),
          btn('Está certo', () => { informados.add(q.k); confirma.remove(); sync(); }, 'ghost sm', 'check'))
        : null;
      root.appendChild(h('div', { class: 'card center col' }, stepper({ value: a[q.k], min: q.min, max: q.max, step: q.passo || 1, decimals: q.dec || 0, label: q.titulo, onChange: (v) => { a[q.k] = v; informados.add(q.k); if (confirma) confirma.remove(); sync(); } }), h('div', { class: 'muted', text: q.un }), confirma));
    } else {
      const opts = h('div', { class: 'opts', role: q.tipo === 'um' ? 'radiogroup' : 'group', 'aria-label': q.titulo });
      const drawOpts = () => {
        while (opts.firstChild) opts.removeChild(opts.firstChild);
        for (const [val, titulo, sub, mostrar] of q.op) {
          // opção com condição (4º item): só aparece quando ela vale
          if (typeof mostrar === 'function' && !mostrar(a)) continue;
          const on = q.tipo === 'um' ? a[q.k] === val : Array.isArray(a[q.k]) && a[q.k].includes(val);
          opts.appendChild(h('button', {
            class: 'opt' + (on ? ' on' : ''), type: 'button', role: q.tipo === 'um' ? 'radio' : 'checkbox', 'aria-checked': on ? 'true' : 'false',
            onClick: () => {
              if (q.tipo === 'um') {
                a[q.k] = val;
                // liberação médica dada agora: vale a partir de hoje
                if (q.dataEm) { if (val === 'sim') a[q.dataEm] = hoje; else delete a[q.dataEm]; }
              } else {
                const r = marcar(q, a, val);
                a[q.k] = r.valor;
                if (r.aviso) toast(r.aviso);
                // condições, sinais ou remédios diferentes dos guardados: a liberação dada antes deixa de valer
                if (Array.isArray(q.limpa)) conferirLiberacao();
              }
              drawOpts(); sync();
            },
          }, h('span', { class: 'tick' }, icon('check')), h('div', { class: 'grow' }, h('div', { class: 'o-t', text: titulo }), sub ? h('div', { class: 'o-s', text: sub }) : null)));
        }
      };
      drawOpts();
      root.appendChild(opts);
      if (q.tipo === 'varios') root.appendChild(h('p', { class: 'tiny muted', id: 'dica-varios', text: dicaVarios(q, a) }));
    }
    root.appendChild(h('div', { class: 'row' },
      btn(i === 0 ? 'Cancelar' : 'Voltar', () => { if (i === 0) onCancel(); else { i--; draw(); window.scrollTo(0, 0); } }, 'ghost lg'),
      next));
    sync();
  }
  function bar(f) { const el = h('i'); el.style.width = Math.round(f * 100) + '%'; return el; }
  draw();
  return root;
}

// Liberação médica guardada que não vale mais (logic/saude.js → respostasProtegidas): a tela pede de novo. Vencida ou sem
// data: a pessoa confirma que renovou (vale de hoje em diante) ou diz que não tem; dada antes do que outra entrevista
// contou: refaz a entrevista. Devolve null quando não há o que pedir.
export function cartaoLiberacao({ estado, aoRenovar, aoNegar, aoRefazer }) {
  const texto = textoDaLiberacao(estado);
  if (!texto) return null;
  const botoes = estado === 'nao_cobre'
    ? [btn('Responder de novo', aoRefazer, 'primary block', 'edit')]
    : [btn('Um médico me liberou nos últimos 12 meses', aoRenovar, 'primary block', 'check'), btn('Ainda não tenho a liberação', aoNegar, 'block ghost')];
  return h('div', { class: 'card hl col gap-s', 'data-liberacao': estado }, h('h3', { text: 'Confirme a liberação médica' }), h('p', { class: 'small', text: texto }), ...botoes);
}

// Tempo em horas, minutos e segundos, como no relógio (nada de "27,5 minutos"). O valor da resposta continua em minutos
// (27 min 30 s = 27,5), que é o que a lógica usa. Fora da faixa da pergunta, a tela diz a faixa e não deixa continuar.
const p2 = (n) => String(n).padStart(2, '0');
const hms = (min) => { const s = Math.round(min * 60); const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return [hh ? `${hh} h` : '', mm || (hh && ss) ? `${mm} min` : '', ss ? `${ss} s` : ''].filter(Boolean).join(' ') || '0 min'; };
function tempoHMS({ minutos, min, max, rotulo, onChange }) {
  let seg = Math.max(0, Math.round(minutos * 60));
  const campo = (nome, tam) => h('input', { type: 'text', inputmode: 'numeric', maxlength: String(tam), autocomplete: 'off', 'aria-label': `${rotulo} ${nome}` });
  const cH = campo('Horas', 1), cM = campo('Minutos', 3), cS = campo('Segundos', 2);
  const num = (c) => { const n = parseInt(c.value.replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : 0; };
  const faixa = h('p', { class: 'small', role: 'status' });
  const avisar = () => { const fora = seg < min * 60 || seg > max * 60; faixa.className = 'small ' + (fora ? 'danger' : 'muted'); faixa.textContent = fora ? `Informe um tempo entre ${hms(min)} e ${hms(max)}.` : `Tempo: ${hms(seg / 60)}.`; };
  // "90" nos segundos vale 1 min 30 s; "75" nos minutos vale 1 h 15 min
  const mostrar = () => { cH.value = String(Math.floor(seg / 3600)); cM.value = p2(Math.floor((seg % 3600) / 60)); cS.value = p2(seg % 60); };
  const ler = () => { seg = num(cH) * 3600 + num(cM) * 60 + num(cS); avisar(); onChange(seg / 60); };
  for (const c of [cH, cM, cS]) {
    c.addEventListener('focus', () => c.select());
    c.addEventListener('input', ler); // enquanto digita, o valor já vale; o campo só é reescrito ao sair dele
    c.addEventListener('change', () => { ler(); mostrar(); });
  }
  mostrar(); avisar();
  return h('div', { class: 'col gap-s center' },
    h('div', { class: 'tempo-hms', role: 'group', 'aria-label': rotulo },
      h('label', null, cH, h('span', { text: 'h' })), h('label', null, cM, h('span', { text: 'min' })), h('label', null, cS, h('span', { text: 's' }))),
    faixa);
}

// Abas do Treinador: musculação e corrida. Cada uma tem a sua tela (rotas "treinador" e "corrida").
export function abasTreinador(ativa) {
  const b = (id, rota, texto) => h('button', { type: 'button', class: ativa === id ? 'on' : '', 'aria-pressed': ativa === id ? 'true' : 'false', onClick: () => { if (ativa !== id) go(rota); } }, texto);
  return h('div', { class: 'seg', role: 'group', 'aria-label': 'Tipo de treino' }, b('forca', 'treinador', 'Musculação'), b('corrida', 'corrida', 'Corrida'));
}

// ---------- objetivo do treino e da alimentação andam juntos (logic/objetivos.js) ----------
const rt = (k) => ROT_T.objetivo[k].toLowerCase();
const rn = (k) => ROT_N.objetivo[k].toLowerCase();
const MESMO = 'Treino e alimentação rendem mais com o mesmo objetivo.';
// frase mostrada na pergunta de objetivo de uma entrevista, com o objetivo já escolhido do outro lado
export function notaObjetivo(lado) {
  if (lado === 'treino') { const o = state.nutri.answers.objetivo; return ROT_N.objetivo[o] ? `Na alimentação, o seu objetivo é ${rn(o)}. ${MESMO}` : ''; }
  const o = state.trainer.answers.objetivo;
  return ROT_T.objetivo[o] ? `No treino, o seu objetivo é ${rt(o)}. ${MESMO}` : '';
}
function aplicarObjetivo(lado) {
  let ok = false;
  update((st) => { ok = lado ? alinhar(st, lado) : manterDiferentes(st); });
  if (ok) toast(lado === 'treino' ? 'Alimentação atualizada para o mesmo objetivo.' : lado === 'nutri' ? 'Objetivo do treino atualizado. Veja o plano novo no Treinador.' : 'Objetivos diferentes mantidos.');
  refresh();
}
// Ao terminar uma entrevista (lado = quem acabou de ser respondido): se os objetivos ficaram diferentes, pergunta se
// iguala o outro lado ou se mantém diferentes. Fechar a pergunta sem escolher deixa o aviso nas telas.
export function conferirObjetivos(lado) {
  const s = situacao(state);
  if (!s || s.combinam || s.aceito) return;
  const texto = lado === 'treino'
    ? `O treino agora é para ${rt(s.treino)}, mas a alimentação está calculada para ${rn(s.nutri)}. ${MESMO} Posso mudar a alimentação para ${rn(nutriPara(s.treino, s.nutri))}.`
    : `A alimentação agora é para ${rn(s.nutri)}, mas o treino está montado para ${rt(s.treino)}. ${MESMO} Posso montar um treino novo para ${rt(treinoPara(s.nutri, s.treino))}.`;
  let escolha;
  const sh = sheet({
    title: 'Deixar os objetivos iguais?',
    body: h('p', { text: texto }),
    footer: [btn('Manter diferentes', () => { escolha = null; sh.close(); }, 'ghost'), btn('Igualar', () => { escolha = lado; sh.close(); }, 'primary')],
    onClose: () => { if (escolha !== undefined) aplicarObjetivo(escolha); },
  });
}
// Aviso nas telas do Treinador e da Nutricionista enquanto os objetivos estão diferentes.
export function cartaoObjetivos() {
  const s = situacao(state);
  if (!s || s.combinam) return null;
  if (s.aceito) {
    return h('div', { class: 'row between' }, h('span', { class: 'small muted grow', text: `Treino para ${rt(s.treino)}; alimentação para ${rn(s.nutri)}.` }),
      btn('Igualar', () => { update((st) => { st.ui.objetivosOk = ''; }); refresh(); }, 'ghost sm'));
  }
  const opt = (titulo, sub, fn) => h('button', { class: 'opt', type: 'button', onClick: fn }, h('div', { class: 'grow' }, h('div', { class: 'o-t', text: titulo }), h('div', { class: 'o-s', text: sub })));
  return h('div', { class: 'card hl col gap-s' }, h('h3', { text: 'Objetivos diferentes' }),
    h('p', { class: 'small muted', text: `O treino é para ${rt(s.treino)} e a alimentação é para ${rn(s.nutri)}. ${MESMO}` }),
    h('div', { class: 'opts' },
      opt('Seguir o treino', `A alimentação passa a ser para ${rn(nutriPara(s.treino, s.nutri))}.`, () => aplicarObjetivo('treino')),
      opt('Seguir a alimentação', `O treino passa a ser para ${rt(treinoPara(s.nutri, s.treino))}.`, () => aplicarObjetivo('nutri')),
      opt('Manter diferentes', 'Você pode igualar quando quiser.', () => aplicarObjetivo(null))));
}

// Perguntas frequentes com busca e fontes.
export function faqBlock(lista, titulo, placeholder) {
  const wrap = h('div', { class: 'col' });
  const results = h('div', { class: 'col gap-s' });
  let todas = false;
  const draw = (termo) => {
    while (results.firstChild) results.removeChild(results.firstChild);
    const itens = buscarFaq(lista, termo).slice(0, termo ? 8 : todas ? lista.length : FAQ_INICIAL);
    if (!itens.length) { results.appendChild(note('info', 'Não encontrei isso na minha base. Só respondo o que tem apoio em estudos; para o seu caso, procure um profissional.')); return; }
    for (const it of itens) {
      const d = h('details', { class: 'acc' }, h('summary', { text: it.q }));
      const inner = h('div');
      for (const p of it.a) inner.appendChild(h('p', { text: p }));
      // resposta longa: o principal à vista e o resto em "Saiba mais", fechado
      if (Array.isArray(it.mais) && it.mais.length) inner.appendChild(h('details', { class: 'pq' }, h('summary', { text: 'Saiba mais' }), ...it.mais.map((p) => h('p', { text: p }))));
      const refs = h('div', { class: 'col gap-s' });
      for (const k of it.f) if (REFS[k]) refs.appendChild(h('p', { class: 'ref', text: '• ' + REFS[k] }));
      inner.appendChild(h('div', { class: 'tiny bold muted', text: 'FONTES' }));
      inner.appendChild(refs);
      d.appendChild(inner);
      results.appendChild(d);
    }
    if (!termo && !todas && lista.length > FAQ_INICIAL) results.appendChild(btn(`Ver todas as ${lista.length} perguntas`, () => { todas = true; draw(''); }, 'block ghost sm'));
  };
  const input = h('input', { class: 'input', type: 'search', placeholder, 'aria-label': titulo, autocomplete: 'off', onInput: (e) => draw(e.target.value) });
  wrap.appendChild(h('h2', { text: titulo }));
  wrap.appendChild(h('div', { class: 'search' }, icon('search'), input));
  wrap.appendChild(results);
  draw('');
  return wrap;
}

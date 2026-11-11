// Entrevista em formato de conversa, usada pelo Treinador e pela Nutricionista.
import { h, btn, icon, stepper, note, sheet, toast } from '../ui.js';
import { state, update } from '../store.js';
import { refresh } from '../router.js';
import { situacao, alinhar, manterDiferentes, nutriPara, treinoPara } from '../logic/objetivos.js';
import { ROTULO as ROT_T } from '../logic/trainer.js';
import { ROTULO as ROT_N } from '../logic/nutrition.js';
const FAQ_INICIAL = 4;
import { REFS, buscarFaq } from '../data/knowledge.js';

export function interview({ perguntas, respostas, onDone, onCancel, avatar = 'coach', nutri = false, notas = null }) {
  const a = { ...respostas };
  let i = 0;
  // começa na primeira pergunta ainda não respondida
  const valida = (q) => {
    const v = a[q.k];
    if (q.tipo === 'numero') return typeof v === 'number' && v >= q.min && v <= q.max;
    if (q.tipo === 'um') return typeof v === 'string' && q.op.some((o) => o[0] === v);
    return Array.isArray(v) && v.length > 0;
  };
  const root = h('div', { class: 'col gap-l' });

  function draw() {
    while (root.firstChild) root.removeChild(root.firstChild);
    // perguntas com condição (campo `se`) só aparecem quando ela vale; a resposta de uma pergunta escondida é descartada
    const visiveis = () => perguntas.filter((x) => !x.se || x.se(a));
    for (const x of perguntas) if (x.se && !x.se(a)) delete a[x.k];
    const vis = visiveis();
    if (i >= vis.length) i = vis.length - 1;
    const q = vis[i];
    root.appendChild(h('div', { class: 'col gap-s' }, h('div', { class: 'row between tiny muted' }, h('span', { text: `Pergunta ${i + 1} de ${vis.length}` })), h('div', { class: 'steps', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': vis.length, 'aria-valuenow': i + 1 }, bar((i + 1) / vis.length))));
    root.appendChild(h('div', { class: 'row top' }, h('div', { class: 'avatar' + (nutri ? ' nutri' : '') }, icon(avatar)), h('div', { class: 'bubble grow' }, h('h2', { text: q.titulo }), q.ajuda ? h('p', { class: 'small muted', text: q.ajuda }) : null, notas && notas[q.k] ? h('p', { class: 'small', text: notas[q.k] }) : null)));
    const next = btn(i === vis.length - 1 ? 'Concluir' : 'Continuar', () => {
      if (!valida(q)) return;
      // a resposta dada agora pode mostrar ou esconder a pergunta seguinte
      const v2 = visiveis();
      const p = v2.indexOf(q);
      if (p === v2.length - 1) { for (const x of perguntas) if (x.se && !x.se(a)) delete a[x.k]; onDone(a); } else { i = p + 1; draw(); window.scrollTo(0, 0); }
    }, 'primary lg grow');
    const sync = () => { next.disabled = !valida(q); };
    if (q.tipo === 'numero') {
      if (typeof a[q.k] !== 'number') a[q.k] = q.padrao;
      root.appendChild(h('div', { class: 'card center col' }, stepper({ value: a[q.k], min: q.min, max: q.max, step: q.passo || 1, decimals: q.dec || 0, label: q.titulo, onChange: (v) => { a[q.k] = v; sync(); } }), h('div', { class: 'muted', text: q.un })));
    } else {
      const opts = h('div', { class: 'opts', role: q.tipo === 'um' ? 'radiogroup' : 'group', 'aria-label': q.titulo });
      const drawOpts = () => {
        while (opts.firstChild) opts.removeChild(opts.firstChild);
        for (const [val, titulo, sub] of q.op) {
          const on = q.tipo === 'um' ? a[q.k] === val : Array.isArray(a[q.k]) && a[q.k].includes(val);
          opts.appendChild(h('button', {
            class: 'opt' + (on ? ' on' : ''), type: 'button', role: q.tipo === 'um' ? 'radio' : 'checkbox', 'aria-checked': on ? 'true' : 'false',
            onClick: () => {
              if (q.tipo === 'um') a[q.k] = val;
              else {
                let cur = Array.isArray(a[q.k]) ? a[q.k].slice() : [];
                if (val === q.nenhum) cur = [val];
                else {
                  cur = cur.filter((x) => x !== q.nenhum);
                  if (cur.includes(val)) cur = cur.filter((x) => x !== val);
                  else { cur.push(val); if (q.max && cur.length > q.max) cur.shift(); }
                }
                a[q.k] = cur;
              }
              drawOpts(); sync();
            },
          }, h('span', { class: 'tick' }, icon('check')), h('div', { class: 'grow' }, h('div', { class: 'o-t', text: titulo }), sub ? h('div', { class: 'o-s', text: sub }) : null)));
        }
      };
      drawOpts();
      root.appendChild(opts);
      if (q.tipo === 'varios') root.appendChild(h('p', { class: 'tiny muted', text: q.max ? `Você pode marcar até ${q.max}.` : 'Você pode marcar mais de uma opção.' }));
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

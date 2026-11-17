// Contar uma dor ao Treinador: folha para registrar e cartão com as dores ativas.
// É a mesma para musculação e corrida; cada treinador lê state.dores (logic/dor.js) e ajusta o treino.
import { h, btn, icon, badge, stepper, toast, uid, dateKey } from '../ui.js';
import { state, update } from '../store.js';
import { refresh } from '../router.js';
import { folha } from './common.js';
import { LOCAIS_DOR, TIPOS_DOR, QUANDO_DOR, doresAtivas, dorDeAlerta, limparDor, MAX_DORES } from '../logic/dor.js';
import { botaoContarProblema, cartaoSaude } from './saude-fora.js';

const LADOS = [['', 'Não se aplica'], ['e', 'Esquerdo'], ['d', 'Direito'], ['dois', 'Os dois']];

// Abre a folha "Contar uma dor". `aoSalvar(dor)` é chamado depois de gravar.
export function contarDor({ aoSalvar = null } = {}) {
  const r = { onde: '', lado: '', tipo: '', quando: 'durante', nivel: 4, nota: '' };
  const corpo = h('div', { class: 'col gap-l' });
  const salvar = btn('Salvar', () => {
    const d = limparDor({ ...r, id: 'dor' + uid(), data: dateKey(new Date()), fim: '' });
    if (!d) { toast('Escolha o local e o tipo da dor.'); return; }
    update((s) => { s.dores.push(d); if (s.dores.length > MAX_DORES) s.dores.splice(0, s.dores.length - MAX_DORES); });
    f.close();
    toast('Anotado. O treino vai levar essa dor em conta.');
    if (aoSalvar) aoSalvar(d);
    refresh();
  }, 'primary grow');
  const pode = () => { salvar.disabled = !(r.onde && r.tipo); };
  const grupoChips = (rotulo, opcoes, campo) => {
    const box = h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': rotulo });
    const draw = () => {
      while (box.firstChild) box.removeChild(box.firstChild);
      for (const [id, nome] of opcoes) box.appendChild(h('button', { type: 'button', class: 'chip' + (r[campo] === id ? ' on' : ''), role: 'radio', 'aria-checked': r[campo] === id ? 'true' : 'false', onClick: () => { r[campo] = id; draw(); pode(); } }, nome));
    };
    draw();
    return h('div', { class: 'col gap-s' }, h('div', { class: 'small bold', text: rotulo }), box);
  };
  const tipos = h('div', { class: 'opts', role: 'radiogroup', 'aria-label': 'Como é a dor' });
  const drawTipos = () => {
    while (tipos.firstChild) tipos.removeChild(tipos.firstChild);
    for (const [id, [nome, sub]] of Object.entries(TIPOS_DOR)) {
      tipos.appendChild(h('button', { type: 'button', class: 'opt' + (r.tipo === id ? ' on' : ''), role: 'radio', 'aria-checked': r.tipo === id ? 'true' : 'false', onClick: () => { r.tipo = id; drawTipos(); pode(); } },
        h('span', { class: 'tick' }, icon('check')), h('div', { class: 'grow' }, h('div', { class: 'o-t', text: nome }), h('div', { class: 'o-s', text: sub }))));
    }
  };
  drawTipos();
  const nota = h('input', { type: 'text', class: 'input', maxlength: '200', placeholder: 'Opcional: quando começou, o que piora', 'aria-label': 'Observação', onInput: (e) => { r.nota = e.target.value.slice(0, 200); } });
  corpo.appendChild(grupoChips('Onde dói?', Object.entries(LOCAIS_DOR), 'onde'));
  corpo.appendChild(grupoChips('De que lado?', LADOS, 'lado'));
  corpo.appendChild(h('div', { class: 'col gap-s' }, h('div', { class: 'small bold', text: 'Como é a dor?' }), tipos));
  corpo.appendChild(grupoChips('Quando aparece?', Object.entries(QUANDO_DOR), 'quando'));
  corpo.appendChild(h('div', { class: 'col gap-s center' }, h('div', { class: 'small bold', text: 'Intensidade, de 1 (leve) a 10 (insuportável)' }), stepper({ value: r.nivel, min: 1, max: 10, step: 1, label: 'Intensidade da dor', onChange: (v) => { r.nivel = v; } })));
  corpo.appendChild(nota);
  const f = folha({ title: 'Contar uma dor', full: true, body: corpo, footer: [btn('Cancelar', () => f.close(), 'ghost'), salvar] });
  pode();
}

const nomeDor = (d) => LOCAIS_DOR[d.onde] + (d.lado === 'e' ? ', lado esquerdo' : d.lado === 'd' ? ', lado direito' : d.lado === 'dois' ? ', os dois lados' : '');
// Cartão com as dores ativas e o botão de contar uma dor. `extra(dor)` devolve o texto do que o treinador mudou por causa
// dela (opcional). Sem dor ativa, mostra só o botão.
// Junto vem o caminho para contar um problema de saúde que não é do treino (febre, pancada...: views/saude-fora.js) e,
// se houver algum que mude o treino hoje, o cartão dele.
export function cartaoDores(opc = {}) {
  const saude = cartaoSaude({ aoMudar: opc.aoMudar ? () => opc.aoMudar(null) : null, contar: false });
  const dores = cartaoDoresSo(opc);
  const contar = botaoContarProblema('block plain sm', opc.aoMudar ? () => opc.aoMudar(null) : null);
  return h('div', { class: 'col gap-s' }, saude, dores, contar);
}
function cartaoDoresSo({ extra = null, aoMudar = null } = {}) {
  const ativas = doresAtivas(state, dateKey(new Date()));
  const abrir = () => contarDor({ aoSalvar: aoMudar });
  if (!ativas.length) return btn('Contar uma dor ao Treinador', abrir, 'block ghost', 'plus');
  const card = h('div', { class: 'card col gap-s' }, h('h3', { text: ativas.length === 1 ? 'Dor que você contou' : 'Dores que você contou' }));
  for (const d of ativas) {
    const alerta = dorDeAlerta(d);
    const txt = extra ? extra(d) : '';
    card.appendChild(h('div', { class: 'col gap-s dor', 'data-dor': d.id },
      h('div', { class: 'row between' },
        h('div', { class: 'grow' }, h('div', { class: 'bold', text: nomeDor(d) }), h('div', { class: 'small muted', text: `${TIPOS_DOR[d.tipo][0]} · intensidade ${d.nivel} · ${d.dias === 0 ? 'hoje' : d.dias === 1 ? 'ontem' : 'há ' + d.dias + ' dias'}` })),
        alerta ? badge('Atenção', 'warn') : null),
      alerta ? h('div', { class: 'note warn' }, icon('warn'), h('div', { text: 'Dor forte, repentina, com inchaço ou que aparece em repouso precisa de avaliação de um médico ou fisioterapeuta antes de treinar essa região.' })) : null,
      txt ? h('p', { class: 'small', text: txt }) : null,
      btn('Melhorou', () => { update((s) => { const x = s.dores.find((y) => y.id === d.id); if (x) x.fim = dateKey(new Date()); }); toast('Que bom! Os treinos deixam de ser ajustados por essa dor.'); if (aoMudar) aoMudar(null); refresh(); }, 'sm ghost', 'check')));
  }
  card.appendChild(btn('Contar outra dor', abrir, 'block ghost sm', 'plus'));
  return card;
}

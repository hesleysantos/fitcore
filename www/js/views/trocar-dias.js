// "Trocar os dias dos treinos": a pessoa marca os dias em que quer treinar e o treinador mostra como fica a semana
// (logic/trocar-dias.js); "Usar esses dias" muda a agenda do plano (vale para todas as semanas).
import { h, btn, toast, dateKey } from '../ui.js';
import { state, update } from '../store.js';
import { refresh } from '../router.js';
import { folha } from './common.js';
import { sugerirDias } from '../logic/trocar-dias.js';
import { planoAtivo } from '../logic/perdido.js';
import { diasBloqueados } from '../logic/dias-livres.js';

const ORDEM = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];

export function folhaTrocarDias(aoMudar = refresh) {
  const plan = planoAtivo(state);
  if (!plan || !plan.dias.length) { toast('Monte um plano de musculação primeiro.'); return; }
  const bloq = new Set(diasBloqueados(state));
  let escolhidos = Object.keys(plan.agenda).map(Number).filter((w) => plan.agenda[w] && !bloq.has(w));
  const corpo = h('div', { class: 'col gap-s', id: 'folha-trocar-dias' });
  const desenhar = () => {
    corpo.replaceChildren();
    corpo.appendChild(h('p', { class: 'small', text: 'Em que dias você quer treinar? Eu distribuo os treinos com 48 horas de descanso para os mesmos músculos.' }));
    corpo.appendChild(h('div', { class: 'chips wrap', role: 'group', 'aria-label': 'Dias de treino' }, ...ORDEM.map(([w, t]) => {
      const on = escolhidos.includes(w), fora = bloq.has(w);
      const b = h('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': String(on), 'data-wd': String(w), onClick: () => { escolhidos = on ? escolhidos.filter((x) => x !== w) : [...escolhidos, w]; desenhar(); } }, t);
      if (fora) { b.disabled = true; b.title = 'Dia sem treino (Treinador)'; }
      return b;
    })));
    if (bloq.size) corpo.appendChild(h('p', { class: 'tiny muted', text: 'Os dias apagados são os que você marcou como sem treino.' }));
    const r = sugerirDias(state, escolhidos, dateKey(new Date()));
    if (!r) { corpo.appendChild(h('p', { class: 'small muted', text: 'Escolha pelo menos um dia.' })); return; }
    corpo.appendChild(h('div', { class: 'card col gap-s', id: 'trocar-dias-previa' }, h('div', { class: 'tiny muted bold', text: 'COMO FICA' }), ...r.linhas.map((l) => h('div', { class: 'bold', text: l }))));
    for (const a of r.avisos) corpo.appendChild(h('p', { class: 'small muted', text: a }));
    corpo.appendChild(btn('Usar esses dias', () => {
      update((s) => { const p = s.plans.find((x) => x.id === plan.id); if (p) p.agenda = { ...r.agenda }; });
      f.close(); toast('Dias trocados. A nova semana já vale.'); if (aoMudar) aoMudar();
    }, 'primary block', 'calendar'));
  };
  const f = folha({ title: 'Trocar os dias dos treinos', body: corpo });
  desenhar();
}

// "Só nesta semana" ou "Sempre": a pergunta curta antes de mudar os exercícios de um treino do plano, a gravação da
// mudança no lugar certo e o "Desfazer". A regra (onde fica a versão da semana) está em logic/ajuste-semana.js.
import { h, btn, dateKey, toast } from '../ui.js';
import { state, update } from '../store.js';
import { folha } from './common.js';
import { ajustarSemana, itensDoDia, temAjusteNaSemana, desfazerAjusteSemana, semanaDe } from '../logic/ajuste-semana.js';

const copia = (x) => JSON.parse(JSON.stringify(x));
const planoDia = (st, planId, diaId) => {
  const p = st.plans.find((x) => x.id === planId);
  return { p, d: p ? p.dias.find((x) => x.id === diaId) : null };
};
// a escolha vale para a tela aberta: na próxima tela, pergunta de novo
const escolhas = new Map();
let telaDaEscolha = '';
const daTela = () => { if (telaDaEscolha !== location.hash) { escolhas.clear(); telaDaEscolha = location.hash; } return escolhas; };
const diaMes = (k) => { const [, m, d] = k.split('-'); return `${Number(d)}/${m}`; };
export const rotuloSemana = (data) => (semanaDe(data) === semanaDe(dateKey(new Date())) ? 'Só nesta semana' : `Só na semana de ${diaMes(semanaDe(data))}`);

// Para onde vai a mudança: 'semana' | 'sempre' | null (a pessoa fechou a pergunta). Treino que já foi mudado nesta semana
// continua mudando a versão da semana; treino sem dia na agenda só tem "sempre"; a resposta vale para o resto da tela.
export function alcance(planId, diaId, data) {
  if (temAjusteNaSemana(state, planId, diaId, data)) return Promise.resolve('semana');
  const { p, d } = planoDia(state, planId, diaId);
  // treino vazio (montando agora) ou sem dia na agenda: não há "semana" a separar
  if (!p || !d || !d.itens.length || !Object.values(p.agenda || {}).includes(diaId)) return Promise.resolve('sempre');
  const k = planId + '|' + diaId + '|' + semanaDe(data);
  const mem = daTela();
  if (mem.has(k)) return Promise.resolve(mem.get(k));
  return new Promise((resolve) => {
    let r = null;
    const s = folha({
      title: 'Esta mudança vale para',
      body: h('p', { class: 'small muted', text: 'Só nesta semana: na semana que vem, o treino volta a ser o de sempre.' }),
      footer: [btn(rotuloSemana(data), () => { r = 'semana'; s.close(); }, 'ghost'), btn('Sempre', () => { r = 'sempre'; s.close(); }, 'primary')],
      onClose: () => { if (r) mem.set(k, r); resolve(r); },
    });
  });
}

// Muda os itens do treino: `fn(itens, plano)` mexe na lista (a do plano, ou a cópia da semana). Devolve a foto de antes,
// para o desfazer, ou null se não mudou.
export function mudarItens(planId, diaId, data, modo, fn) {
  let foto = null;
  update((s) => {
    const { p, d } = planoDia(s, planId, diaId);
    if (!p || !d) return;
    const i = Array.isArray(s.ajustesSemana) ? s.ajustesSemana.findIndex((a) => a.planId === planId && a.diaId === diaId && a.semana === semanaDe(data)) : -1;
    foto = { planId, diaId, data, modo, plano: copia(d.itens), ajuste: i >= 0 ? copia(s.ajustesSemana[i]) : null };
    if (modo === 'semana') {
      const itens = itensDoDia(s, planId, diaId, data);
      fn(itens, p);
      ajustarSemana(s, { planId, diaId, data, itens });
    } else fn(d.itens, p);
  });
  return foto;
}
// volta ao que era antes da mudança
export function desfazerFoto(foto) {
  if (!foto) return;
  update((s) => {
    const { d } = planoDia(s, foto.planId, foto.diaId);
    if (!d) return;
    if (foto.modo === 'sempre') { d.itens = copia(foto.plano); return; }
    desfazerAjusteSemana(s, foto.planId, foto.diaId, foto.data);
    if (foto.ajuste) { if (!Array.isArray(s.ajustesSemana)) s.ajustesSemana = []; s.ajustesSemana.push(copia(foto.ajuste)); }
  });
}
// selo do treino mudado só numa semana, com "Desfazer" (aba Treinos e editor do treino)
export function seloSemana(planId, diaId, data, aoMudar) {
  if (!temAjusteNaSemana(state, planId, diaId, data)) return null;
  return h('div', { class: 'selo-semana row', 'data-selo-semana': diaId },
    h('span', { class: 'badge acc', text: rotuloSemana(data) }),
    h('span', { class: 'grow' }),
    btn('Desfazer', () => { update((s) => { desfazerAjusteSemana(s, planId, diaId, data); }); toast('Voltou o treino de sempre.'); if (aoMudar) aoMudar(); }, 'sm ghost'));
}

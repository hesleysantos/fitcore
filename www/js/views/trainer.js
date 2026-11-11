// Tela do Treinador virtual.
import { h, btn, icon, note, badge, sectionTitle, toggle, toast, confirmSheet, plural, fmtDate } from '../ui.js';
import { state, update, activePlan } from '../store.js';
import { go, refresh } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { FAQ_TREINO } from '../data/knowledge.js';
import { PERGUNTAS, ROTULO, respostasCompletas, gerarPlano, sugerirTrocas, perfil, volumeSemanal, imcTexto, nomeGrupo } from '../logic/trainer.js';
import { estagnados } from '../logic/progress.js';
import { thumb } from '../figure.js';
import { interview, faqBlock, notaObjetivo, conferirObjetivos, cartaoObjetivos } from './coach.js';
import { treinoPara } from '../logic/objetivos.js';
import { alvoTexto, duracaoEstimada } from './common.js';
import { criarPlano } from './plans.js';

let modo = 'auto'; // 'auto' | 'entrevista' | 'proposta' | 'trocas'
const SEMANA = 7 * 86400000;

export function revisaoPendente() {
  const t = state.trainer;
  if (!t.aceitoEm || !t.revisaoEm || !activePlan()) return '';
  const now = Date.now();
  if (now < Date.parse(t.revisaoEm)) return '';
  if (t.adiadoAte && now < Date.parse(t.adiadoAte)) return '';
  const semanas = Math.max(1, Math.round((now - Date.parse(t.aceitoEm)) / SEMANA));
  return `Você segue o mesmo treino há ${plural(semanas, 'semana', 'semanas')}. Sugiro trocar alguns exercícios auxiliares para variar o estímulo.`;
}

function cabecalho() {
  return h('div', { class: 'coach-hd' }, h('div', { class: 'avatar' }, icon('coach', 'l')), h('div', null, h('h2', { text: 'Treinador virtual' }), h('p', { class: 'tiny muted', text: 'Baseado em diretrizes de educação física. Não substitui um profissional.' })));
}

function diaCard(d) {
  const l = h('div', { class: 'col gap-s' });
  d.itens.forEach((it) => {
    const ex = EX_POR_ID.get(it.ex);
    if (!ex) return;
    l.appendChild(h('button', { class: 'row menu-item', type: 'button', onClick: () => go('exercicio/' + ex.id) },
      h('div', { class: 'thumb mini' }, thumb(ex)),
      h('span', { class: 'grow small', text: ex.nome }),
      h('span', { class: 'small muted nowrap', text: alvoTexto(it) })));
  });
  return h('div', { class: 'card col gap-s' }, h('h3', { text: d.nome }), h('div', { class: 'tiny muted', text: `${d.foco} · cerca de ${duracaoEstimada(d)} min` }), l);
}
function volumeCard(vol, nivel) {
  const inner = h('div');
  for (const g of Object.keys(vol)) {
    if (!vol[g]) continue;
    inner.appendChild(h('div', { class: 'kv' }, h('span', { text: nomeGrupo(g) }), h('span', { text: String(vol[g]).replace('.', ',') })));
  }
  inner.appendChild(h('p', { class: 'tiny muted', text: `Referência: 4 séries por semana já dão resultado; para hipertrofia, 10 ou mais${nivel === 1 ? ' (iniciantes evoluem com menos)' : ''}. Músculo auxiliar conta meia série.` }));
  return h('details', { class: 'acc' }, h('summary', { text: 'Séries por semana em cada grupo' }), inner);
}
function orientacoesCard(lista) {
  const wrap = h('div', { class: 'col gap-s' });
  for (const [t, txt] of lista) wrap.appendChild(h('details', { class: 'acc' }, h('summary', { text: t }), h('div', null, h('p', { text: txt }))));
  return wrap;
}

function proposta() {
  const a = state.trainer.answers;
  const versao = state.trainer.versao || 0;
  const p = gerarPlano(a, state.gym, versao);
  const body = [cabecalho(), cartaoObjetivos()].filter(Boolean);
  if (!p) {
    body.push(note('danger', 'Para menores de 14 anos, a musculação deve ser orientada presencialmente por um profissional de educação física, com liberação do pediatra. Não monto treinos pelo aplicativo nessa faixa de idade.'));
    body.push(btn('Mudar respostas', () => { modo = 'entrevista'; refresh(); }, 'block'));
    return body;
  }
  const pf = p.perfil;
  if (!p.dias.length) {
    for (const av of p.avisos) body.push(note(av.tipo, av.texto));
    body.push(note('warn', 'Com essas respostas e os aparelhos disponíveis não consegui montar um treino seguro. Marque mais aparelhos em “Minha academia” ou procure um profissional de educação física.'));
    body.push(btn('Mudar respostas', () => { modo = 'entrevista'; refresh(); }, 'block'));
    return body;
  }
  body.push(h('div', { class: 'bubble' }, h('p', { text: `Montei um plano de ${plural(p.dias.length, 'treino', 'treinos')} por semana para ${ROTULO.objetivo[pf.objetivo].toLowerCase()}, no nível ${ROTULO.experiencia[a.experiencia].toLowerCase()}.` }), h('p', { class: 'small muted', text: 'Toque num exercício para ver a animação. Você pode editar tudo depois.' })));
  for (const av of p.avisos) body.push(note(av.tipo, av.texto));
  if (p.faltando.length) body.push(note('warn', `Com os aparelhos disponíveis, não encontrei exercícios suficientes para: ${p.faltando.join(', ')}. Marque mais aparelhos em “Minha academia” ou complete esses treinos manualmente.`));
  if (pf.imc) body.push(h('p', { class: 'small muted', text: `IMC: ${String(Math.round(pf.imc * 10) / 10).replace('.', ',')} (${imcTexto(pf.imc, pf.idade)}) — só uma referência.` }));
  for (const d of p.dias) body.push(diaCard(d));
  body.push(volumeCard(p.volume, pf.nivel));
  body.push(sectionTitle('Como seguir este treino'));
  body.push(orientacoesCard(p.orientacoes));
  let ciente = !pf.liberacao;
  const aceitar = btn('Aceitar e usar este treino', () => {
    if (!ciente) return;
    const dias = p.dias.map((d) => ({ ...d, itens: d.itens.map((i) => ({ ...i })) }));
    if (!criarPlano({ nome: 'Plano do Treinador', origem: 'treinador', dias, agenda: p.agenda, info: `Feito para: ${ROTULO.objetivo[pf.objetivo].toLowerCase()} · ${plural(pf.dias, 'dia', 'dias')} por semana.` })) return;
    update((s) => { const now = Date.now(); s.trainer.aceitoEm = new Date(now).toISOString(); s.trainer.revisaoEm = new Date(now + p.revisaoSemanas * SEMANA).toISOString(); s.trainer.adiadoAte = ''; });
    modo = 'auto';
    toast('Treino ativado! Ele já está na aba Treinos.');
    go('treinos');
  }, 'primary lg block', 'check');
  aceitar.disabled = !ciente;
  if (pf.liberacao) {
    body.push(h('div', { class: 'card row' }, h('div', { class: 'grow small', text: 'Li o aviso de saúde acima e vou procurar liberação médica antes de começar.' }), toggle(false, (v) => { ciente = v; aceitar.disabled = !v; }, 'Li o aviso de saúde')));
  }
  body.push(aceitar);
  body.push(h('div', { class: 'row' },
    btn('Outra versão', () => { update((s) => { s.trainer.versao = (s.trainer.versao || 0) + 1; }); refresh(); }, 'grow', 'refresh'),
    btn('Mudar respostas', () => { modo = 'entrevista'; refresh(); }, 'grow ghost', 'edit')));
  return body;
}

function painel() {
  const a = state.trainer.answers;
  const pf = perfil(a);
  const plan = activePlan();
  const body = [cabecalho(), cartaoObjetivos()].filter(Boolean);

  // sugestão de troca (rotação)
  const pend = revisaoPendente();
  if ((pend || modo === 'trocas') && plan) {
    const trocas = sugerirTrocas(plan, a, state.gym);
    const card = h('div', { class: 'card hl col' }, h('h2', { text: 'Hora de variar o treino' }), h('p', { class: 'small muted', text: pend || 'Trocas sugeridas agora. Os exercícios principais continuam.' }));
    if (!trocas.length) {
      card.appendChild(note('info', 'Não encontrei alternativas com os seus aparelhos. O treino pode continuar como está.'));
    } else {
      const sel = new Set(trocas.map((_, i) => i));
      trocas.forEach((t, i) => {
        const de = EX_POR_ID.get(t.de), para = EX_POR_ID.get(t.para);
        card.appendChild(h('div', { class: 'row top' },
          h('div', { class: 'grow col gap-s' },
            h('div', { class: 'tiny muted bold', text: t.dia.toUpperCase() }),
            h('div', { class: 'small' }, h('span', { class: 'muted', text: 'Sai: ' }), de.nome),
            h('button', { class: 'row gap-s plainlink', type: 'button', onClick: () => go('exercicio/' + para.id) }, h('div', { class: 'thumb mini' }, thumb(para)), h('span', { class: 'small bold grow', text: 'Entra: ' + para.nome }))),
          toggle(true, (v) => { if (v) sel.add(i); else sel.delete(i); }, 'Aceitar esta troca')));
      });
      card.appendChild(btn('Aplicar as trocas marcadas', () => {
        const aplicar = trocas.filter((_, i) => sel.has(i));
        update((s) => {
          const p = s.plans.find((x) => x.id === plan.id);
          if (p) for (const t of aplicar) { const d = p.dias.find((x) => x.id === t.diaId); if (d && d.itens[t.idx] && d.itens[t.idx].ex === t.de) d.itens[t.idx] = { ...d.itens[t.idx], ex: t.para }; }
          const now = Date.now();
          s.trainer.revisaoEm = new Date(now + (pf.nivel === 1 ? 8 : 6) * SEMANA).toISOString();
          s.trainer.adiadoAte = '';
          s.trainer.versao = (s.trainer.versao || 0) + 1;
        });
        modo = 'auto';
        toast(aplicar.length ? `${plural(aplicar.length, 'exercício trocado', 'exercícios trocados')}` : 'Nenhuma troca aplicada');
        refresh();
      }, 'primary block', 'check'));
    }
    card.appendChild(h('div', { class: 'row' },
      btn('Agora não', () => { update((s) => { s.trainer.adiadoAte = new Date(Date.now() + 2 * SEMANA).toISOString(); }); modo = 'auto'; toast('Combinado. Lembro você daqui a 2 semanas.'); refresh(); }, 'grow ghost'),
      btn('Manter meu treino', () => { update((s) => { s.trainer.revisaoEm = new Date(Date.now() + (pf.nivel === 1 ? 8 : 6) * SEMANA).toISOString(); s.trainer.adiadoAte = ''; }); modo = 'auto'; toast('Treino mantido.'); refresh(); }, 'grow ghost')));
    body.push(card);
  }

  // exercícios sem evolução
  const est = estagnados(plan).map((id) => EX_POR_ID.get(id)).filter(Boolean);
  if (est.length) {
    const card = h('div', { class: 'card col' }, h('h3', { text: 'Exercícios sem evolução' }), h('p', { class: 'small muted', text: 'Marca parada há 3 treinos. Baixe a carga uns 10% e suba de novo, ou troque o exercício.' }));
    for (const ex of est.slice(0, 4)) card.appendChild(h('button', { class: 'menu-item', type: 'button', onClick: () => go('exercicio/' + ex.id) }, icon('swap'), h('span', { class: 'grow', text: ex.nome }), icon('right', 's muted')));
    body.push(card);
  }

  // perfil
  const resumo = h('div', { class: 'card col gap-s' }, h('h3', { text: 'Seu perfil' }),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Objetivo' }), h('span', { text: ROTULO.objetivo[a.objetivo] })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Nível' }), h('span', { text: ROTULO.experiencia[a.experiencia] })),
    pf.retorno ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Parado antes de voltar' }), h('span', { text: ROTULO.pausa[a.pausa] })) : null,
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Frequência' }), h('span', { text: `${plural(pf.dias, 'dia', 'dias')} por semana · ${pf.tempo >= 75 ? 'mais de 1 h' : pf.tempo + ' min'}` })),
    h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Local' }), h('span', { text: ROTULO.local[a.local] })),
    pf.limitacoes.length ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Cuidados' }), h('span', { text: pf.limitacoes.join(', ') })) : null,
    state.trainer.revisaoEm ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Próxima revisão' }), h('span', { text: fmtDate(state.trainer.revisaoEm, true) })) : null);
  body.push(resumo);
  const p0 = gerarPlano(a, state.gym, state.trainer.versao || 0);
  if (p0) for (const av of p0.avisos) body.push(note(av.tipo, av.texto));

  body.push(h('div', { class: 'col' },
    plan ? btn('Sugerir trocas de exercícios agora', () => { modo = 'trocas'; refresh(); window.scrollTo(0, 0); }, 'block', 'swap') : null,
    btn('Montar um novo treino', async () => {
      const ok = !plan || await confirmSheet({ title: 'Montar um novo treino?', text: 'Crio um novo plano com as suas respostas. O atual fica guardado em “Outros planos”.', okLabel: 'Montar' });
      if (!ok) return;
      update((s) => { s.trainer.versao = (s.trainer.versao || 0) + 1; });
      modo = 'proposta'; refresh(); window.scrollTo(0, 0);
    }, 'block', 'refresh'),
    btn('Refazer a entrevista', () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); }, 'block ghost', 'edit')));

  if (plan) body.push(volumeCard(volumeSemanal(plan.dias), pf.nivel));
  if (p0) { body.push(sectionTitle('Como treinar')); body.push(orientacoesCard(p0.orientacoes)); }
  body.push(faqBlock(FAQ_TREINO, 'Pergunte ao Treinador', 'Ex.: descanso, falha, joelho, cardio'));
  return body;
}

export function trainerView() {
  const a = state.trainer.answers;
  const completo = respostasCompletas(a);
  if (modo === 'entrevista' || !completo) {
    if (modo !== 'entrevista' && !Object.keys(a).length) {
      // boas-vindas
      return {
        title: 'Treinador',
        body: [cabecalho(),
          h('div', { class: 'bubble' }, h('p', { text: 'Olá! Eu monto uma sugestão de treino a partir das suas respostas.' }), h('p', { class: 'small muted', text: `São até ${PERGUNTAS.length} perguntas rápidas, uns 2 minutos. As respostas ficam só neste aparelho.` })),
          btn('Começar', () => { modo = 'entrevista'; refresh(); }, 'primary lg block', 'play'),
          h('div', { class: 'mt' }), faqBlock(FAQ_TREINO, 'Pergunte ao Treinador', 'Ex.: descanso, falha, joelho, cardio')],
      };
    }
    const pre = { ...a };
    const n = state.nutri.answers;
    for (const k of ['idade', 'peso', 'altura']) if (pre[k] == null && typeof n[k] === 'number') pre[k] = n[k];
    // o objetivo começa igual ao da alimentação (o usuário pode trocar)
    if (pre.objetivo == null && treinoPara(n.objetivo)) pre.objetivo = treinoPara(n.objetivo);
    return {
      title: 'Treinador', body: [interview({
        perguntas: PERGUNTAS, respostas: pre, notas: { objetivo: notaObjetivo('treino') },
        onDone: (r) => { update((s) => { s.trainer.answers = r; s.trainer.aceitoEm = ''; s.trainer.revisaoEm = ''; s.trainer.adiadoAte = ''; }); modo = 'proposta'; refresh(); window.scrollTo(0, 0); conferirObjetivos('treino'); },
        onCancel: () => { modo = 'auto'; refresh(); },
      })],
    };
  }
  if (modo === 'proposta' || !state.trainer.aceitoEm) return { title: 'Treinador', body: proposta() };
  return { title: 'Treinador', body: painel() };
}

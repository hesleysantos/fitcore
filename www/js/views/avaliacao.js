// Cartões com a avaliação de um treino montado à mão: o que ele treina, para que serve, o que falta e sobra, e se serve
// para o perfil da pessoa. As regras ficam em logic/avaliacao.js. Tudo vira nó de texto (nada de HTML).
import { h, btn, badge, dateKey } from '../ui.js';
import { state } from '../store.js';
import { go } from '../router.js';
import { avaliarDia, avaliarPlano } from '../logic/avaliacao.js';
import { resumoCombinado, doresDoTreino } from '../logic/trainer.js';

const num = (v) => String(v).replace('.', ',');
const series = (n) => `${num(n)} ${n === 1 ? 'série' : 'séries'}`;
// o que a avaliação precisa saber da pessoa: respostas do Treinador, aparelhos, dores ativas e a corrida da semana
function contexto() {
  const hoje = dateKey(new Date());
  let dores = [], corrida = null;
  try { dores = doresDoTreino(state, hoje, state.trainer.answers); } catch { dores = []; }
  try { corrida = resumoCombinado(state, hoje); } catch { corrida = null; }
  return { respostas: state.trainer.answers, gym: state.gym, dores, corrida };
}
const kv = (k, v) => h('div', { class: 'kv' }, h('span', { class: 'muted', text: k }), h('span', { text: v }));
const linha = (texto, cls = 'small') => h('p', { class: cls, text: texto });
const titulo = (texto) => h('div', { class: 'tiny muted bold', text: texto.toUpperCase() });
// "Força: poucas repetições com carga alta." → linha curta com o nome e, embaixo, a explicação
const serve = (tipo) => { const i = tipo.texto.indexOf(': '); const resto = tipo.texto.slice(i + 2); return [kv('Serve para', tipo.texto.slice(0, i)), linha(resto.charAt(0).toUpperCase() + resto.slice(1), 'tiny muted')]; };
const SELO = { sim: ['Serve para você', 'ok'], ajustes: ['Serve com ajustes', 'warn'], nao: ['Não recomendado', 'danger'] };

// parte "serve para o seu perfil?": problemas por exercício (com a troca sugerida) e doses que a condição pede
function blocoPerfil(a) {
  const out = [];
  const p = a.perfil;
  if (p.problemas.length || p.dose.length) {
    out.push(titulo(a.semPerfil ? 'Atenção' : 'Para o seu perfil'));
    for (const t of p.dose) out.push(linha(t));
    for (const x of p.problemas.slice(0, 5)) {
      out.push(h('div', { class: 'col gap-s' },
        h('div', { class: 'small' }, h('span', { class: 'bold', text: x.nome + ': ' }), x.motivos.join('; ') + '.'),
        x.troca ? h('button', { class: 'plainlink small', type: 'button', onClick: () => go('exercicio/' + x.troca.ex) }, h('span', { class: 'muted', text: 'Troque por: ' }), h('span', { class: 'bold', text: x.troca.nome })) : null));
    }
    if (p.problemas.length > 5) out.push(linha(`E mais ${p.problemas.length - 5}.`, 'tiny muted'));
  }
  // sem as respostas, a avaliação olha só o treino (a conclusão já convida a responder)
  if (a.semPerfil) out.push(btn('Responder ao Treinador', () => go('treinador'), 'block sm', 'coach'));
  return out;
}
function cartao(rotulo, a, corpo) {
  const selo = !a.semPerfil && SELO[a.perfil.veredito] ? badge(SELO[a.perfil.veredito][0], SELO[a.perfil.veredito][1]) : null;
  return h('details', { class: 'acc avaliacao' },
    h('summary', null, h('span', { class: 'grow', text: rotulo }), selo),
    h('div', null, linha(a.conclusao), ...corpo.filter(Boolean), ...blocoPerfil(a),
      a.tipo.id ? linha(a.definicao, 'tiny muted') : null));
}

// Avaliação de um treino (um dia do plano). Devolve o cartão, ou null se o treino não tem exercícios.
export function cartaoAvaliacaoDoDia(plano, dia) {
  let a = null;
  try { a = avaliarDia(dia, contexto()); } catch { a = null; }
  if (!a || a.vazio) return null;
  const corpo = [
    kv('Foco', a.foco.texto),
    a.mais ? kv('Mais trabalha', `${a.mais.nome} (${series(a.mais.series)})`) : null,
    a.menos ? kv('Menos trabalha', `${a.menos.nome} (${series(a.menos.series)})`) : null,
    ...(a.tipo.id ? serve(a.tipo) : []),
    kv('Tamanho', `${a.exercicios} ${a.exercicios === 1 ? 'exercício' : 'exercícios'} · ${series(a.series)} · cerca de ${a.duracaoMin} min`),
  ];
  for (const x of a.sobra) corpo.push(linha(`Séries demais de ${x.nome.toLowerCase()}: ${x.series} diretas num treino só; o máximo indicado para a semana inteira é ${x.teto}.`));
  for (const x of a.repetidos.slice(0, 2)) corpo.push(linha(`Exercícios parecidos: ${x.nomes.slice(0, 3).join(', ')} fazem o mesmo movimento. Dois já bastam.`));
  return cartao('Avaliação deste treino', a, corpo);
}

// Avaliação do plano inteiro (a semana). Devolve o cartão, ou null se o plano não tem exercícios.
export function cartaoAvaliacaoDoPlano(plano) {
  let a = null;
  try { a = avaliarPlano(plano, contexto()); } catch { a = null; }
  if (!a || a.vazio) return null;
  const FAIXA = { nada: ['sem treino', 'danger'], pouco: ['pouco', 'warn'], ok: ['mantém', ''], bom: ['bom', 'ok'], muito: ['demais', 'danger'] };
  const corpo = [
    ...(a.tipo.id ? serve(a.tipo) : []),
    kv('Duração', a.duracaoMin.menor === a.duracaoMin.maior ? `cerca de ${a.duracaoMin.menor} min` : `de ${a.duracaoMin.menor} a ${a.duracaoMin.maior} min por treino`),
    titulo('Séries por semana'),
    ...a.grupos.map((x) => h('div', { class: 'kv' }, h('span', { text: x.nome }), h('span', { class: 'row gap-s' }, h('span', { text: num(x.series) }), badge(FAIXA[x.faixa][0], FAIXA[x.faixa][1])))),
    linha(`Referência: 4 séries por semana mantêm e já dão resultado; 10 ou mais são o indicado para ganhar massa; acima de ${a.teto} séries diretas é demais${a.semPerfil ? '' : ' para o seu nível'}. Músculo auxiliar conta meia série.`, 'tiny muted'),
  ];
  if (a.equilibrio.length || a.corrida.length) {
    corpo.push(titulo('Equilíbrio'));
    for (const x of a.equilibrio) corpo.push(linha(x.texto));
    for (const x of a.corrida.slice(0, 3)) corpo.push(linha(x.texto));
  }
  return cartao('Avaliação do plano', a, corpo);
}

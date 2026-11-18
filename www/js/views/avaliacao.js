// Cartões com a avaliação de um treino montado à mão: o que ele treina, para que serve, o que falta e sobra, e se serve
// para o perfil da pessoa. As regras ficam em logic/avaliacao.js. Tudo vira nó de texto (nada de HTML).
// Cada músculo é uma linha que abre: os exercícios que contam para ele (principal = série inteira; ajuda = meia), a conta
// explicada e, quando passa do máximo ou fica com pouco, o que mudar ali mesmo — tirar uma série, trocar, remover ou
// adicionar —, com "Desfazer". A mudança pergunta se vale só nesta semana ou sempre (views/ajuste-semana.js).
import { h, btn, badge, dateKey, toast } from '../ui.js';
import { state } from '../store.js';
import { go, refresh } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { avaliarDia, avaliarPlano, sugestoesPara, trocasPara } from '../logic/avaliacao.js';
import { resumoCombinado, doresDoTreino, saudeDoTreinador, nomeGrupo } from '../logic/trainer.js';
import { itensDoDia } from '../logic/ajuste-semana.js';
import { novoItem, folha } from './common.js';
import { alcance, mudarItens, desfazerFoto } from './ajuste-semana.js';

const num = (v) => String(v).replace('.', ',');
const series = (n) => `${num(n)} ${n === 1 ? 'série' : 'séries'}`;
const GRANDES = ['peito', 'costas', 'ombros', 'quadriceps', 'posteriores', 'gluteos'];
// o que a avaliação precisa saber da pessoa: respostas do Treinador, aparelhos, dores ativas e a corrida da semana
function contexto() {
  const hoje = dateKey(new Date());
  let dores = [], corrida = null;
  try { dores = doresDoTreino(state, hoje, state.trainer.answers); } catch { dores = []; }
  try { corrida = resumoCombinado(state, hoje); } catch { corrida = null; }
  // condições, sinais e remédios de todas as entrevistas, pelo lado mais protegido (logic/saude.js)
  let respostas = state.trainer.answers;
  try { respostas = saudeDoTreinador(state, hoje).respostas; } catch { respostas = state.trainer.answers; }
  return { respostas, gym: state.gym, dores, corrida };
}
const kv = (k, v) => h('div', { class: 'kv' }, h('span', { class: 'muted', text: k }), h('span', { text: v }));
const linha = (texto, cls = 'small') => h('p', { class: cls, text: texto });
const titulo = (texto) => h('div', { class: 'tiny muted bold', text: texto.toUpperCase() });
// "Força: poucas repetições com carga alta." → linha curta com o nome e, embaixo, a explicação
const serve = (tipo) => { const i = tipo.texto.indexOf(': '); const resto = tipo.texto.slice(i + 2); return [kv('Serve para', tipo.texto.slice(0, i)), linha(resto.charAt(0).toUpperCase() + resto.slice(1), 'tiny muted')]; };
const SELO = { sim: ['Serve para você', 'ok'], ajustes: ['Serve com ajustes', 'warn'], nao: ['Não recomendado', 'danger'] };

// ---------- o que fica aberto e a última mudança (valem enquanto a tela está aberta) ----------
const abertos = new Set();
let ultima = null; // { chave, texto, foto, tela }
let telaAberta = '';
const daTela = () => { if (telaAberta !== location.hash) { abertos.clear(); ultima = null; telaAberta = location.hash; } };
const lembrar = (el, chave) => { if (abertos.has(chave)) el.open = true; el.addEventListener('toggle', () => { if (el.open) abertos.add(chave); else abertos.delete(chave); }); return el; };
// redesenha sem a linha do músculo mudar de lugar na tela
function redesenhar(chave) {
  const sel = `[data-musc="${chave}"]`;
  const antes = document.querySelector(sel);
  const y0 = antes ? antes.getBoundingClientRect().top : null;
  refresh();
  const depois = document.querySelector(sel);
  if (y0 != null && depois) window.scrollBy(0, depois.getBoundingClientRect().top - y0);
}

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
// "Definição" só aparece para quem quer emagrecer (no Treinador ou na Nutricionista)
const querEmagrecer = () => state.trainer.answers.objetivo === 'emagrecimento' || state.nutri.answers.objetivo === 'emagrecer';
function cartao(rotulo, a, corpo, chave) {
  const selo = !a.semPerfil && SELO[a.perfil.veredito] ? badge(SELO[a.perfil.veredito][0], SELO[a.perfil.veredito][1]) : null;
  return lembrar(h('details', { class: 'acc avaliacao', 'data-avaliacao': chave },
    h('summary', null, h('span', { class: 'grow', text: rotulo }), selo),
    h('div', null, linha(a.conclusao), ...corpo.filter(Boolean), ...blocoPerfil(a),
      a.tipo.id && querEmagrecer() ? linha(a.definicao, 'tiny muted') : null)), chave);
}
// A avaliação é para treino montado à mão ou vindo de modelo. O plano do próprio Treinador (e o fortalecimento que ele
// monta para quem corre) já sai com as regras de dor e de perfil: no lugar da avaliação, no máximo uma linha.
const doTreinador = (plano) => !!plano && (plano.origem === 'treinador' || plano.origem === 'fortalecimento');
function linhaDoTreinador() {
  let dores = [];
  try { dores = contexto().dores; } catch { dores = []; }
  if (!dores.length) return null;
  return h('button', { class: 'plainlink small avaliacao-link', type: 'button', onClick: () => go('treinador') },
    h('span', { class: 'muted', text: 'O Treinador já ajusta este plano às suas dores ' }), h('span', { class: 'bold', text: '→ Ver' }));
}

// ---------- mudar o treino de dentro da avaliação ----------
// `alvo` = { plan, data, dias: [{ id, nome, itens }] (os treinos como estão nesta semana), diaFixo (no editor do treino) }
const usadosNoPlano = (alvo) => [...new Set(alvo.dias.flatMap((d) => d.itens.map((it) => it.ex)))];
async function aplicar(alvo, diaId, chave, texto, fn) {
  const modo = await alcance(alvo.plan.id, diaId, alvo.data);
  if (!modo) return;
  const foto = mudarItens(alvo.plan.id, diaId, alvo.data, modo, fn);
  if (!foto) return;
  ultima = { chave, texto: texto + (modo === 'semana' ? ' (só nesta semana)' : ''), foto };
  redesenhar(chave);
}
const indice = (itens, exId) => itens.findIndex((it) => it.ex === exId);
function tirarSerie(alvo, x, chave) {
  aplicar(alvo, x.diaId, chave, `Tirou 1 série de ${x.nome}.`, (itens) => { const i = indice(itens, x.ex); if (i >= 0 && itens[i].series > 1) itens[i].series--; });
}
function remover(alvo, x, chave) {
  aplicar(alvo, x.diaId, chave, `Tirou ${x.nome} do treino.`, (itens) => { const i = indice(itens, x.ex); if (i >= 0) itens.splice(i, 1); });
}
function trocar(alvo, x, g, faltam, chave) {
  const opcoes = trocasPara(x.ex, g, contexto(), usadosNoPlano(alvo), faltam);
  const lista = h('div', { class: 'list' });
  for (const o of opcoes) {
    lista.appendChild(h('button', { class: 'item', type: 'button', onClick: () => {
      s.close();
      const novo = EX_POR_ID.get(o.ex), velho = EX_POR_ID.get(x.ex);
      aplicar(alvo, x.diaId, chave, `Trocou ${x.nome} por ${o.nome}.`, (itens) => { const i = indice(itens, x.ex); if (i >= 0) itens[i] = novo.registro === velho.registro ? { ...itens[i], ex: o.ex } : novoItem(novo); });
    } }, h('div', { class: 'grow' }, h('div', { class: 't', text: o.nome }), h('div', { class: 's', text: `Trabalha ${nomeGrupo(o.para).toLowerCase()}` }))));
  }
  const s = folha({ title: 'Trocar ' + x.nome, body: [h('p', { class: 'small muted', text: `Por um que não pesa em ${nomeGrupo(g).toLowerCase()}:` }), lista] });
}
async function adicionar(alvo, ex, chave) {
  const nx = EX_POR_ID.get(ex.ex);
  if (!nx) return;
  // em qual treino: o do editor; no plano, pergunta quando há mais de um
  const comItens = alvo.dias.filter((d) => d.itens.length);
  let diaId = alvo.diaFixo || (alvo.dias.length === 1 ? alvo.dias[0].id : '');
  if (!diaId) {
    diaId = await new Promise((resolve) => {
      let r = '';
      const lista = h('div', { class: 'list' });
      for (const d of (comItens.length ? comItens : alvo.dias)) lista.appendChild(h('button', { class: 'item', type: 'button', onClick: () => { r = d.id; s.close(); } }, h('div', { class: 'grow' }, h('div', { class: 't', text: d.nome }), h('div', { class: 's', text: `${d.itens.length} ${d.itens.length === 1 ? 'exercício' : 'exercícios'}` }))));
      const s = folha({ title: 'Em qual treino?', body: [h('p', { class: 'small muted', text: `Onde entra ${nx.nome}:` }), lista], onClose: () => resolve(r) });
    });
  }
  if (!diaId) return;
  const dia = alvo.dias.find((d) => d.id === diaId);
  if (dia && dia.itens.length >= 40) { toast('Este treino já tem 40 exercícios, que é o limite.'); return; }
  aplicar(alvo, diaId, chave, `Pôs ${nx.nome}${alvo.dias.length > 1 && dia ? ' no ' + dia.nome : ''}.`, (itens) => { if (indice(itens, nx.id) < 0 && itens.length < 40) itens.push(novoItem(nx)); });
}

// ---------- a lista de músculos ----------
const FAIXA = { nada: ['sem treino', 'danger'], pouco: ['pouco', 'warn'], ok: ['mantém', ''], bom: ['bom', 'ok'], muito: ['demais', 'danger'] };
// "20 séries diretas + 16 de ajuda × ½ = 28"
function contaTexto(x) {
  const d = x.diretas, a = x.ajuda;
  if (d && a) return `${series(d)} ${d === 1 ? 'direta' : 'diretas'} + ${num(a)} de ajuda × ½ = ${num(x.series)}`;
  if (a) return `${num(a)} ${a === 1 ? 'série' : 'séries'} de ajuda × ½ = ${num(x.series)}`;
  return `${series(d)} ${d === 1 ? 'direta' : 'diretas'}`;
}
function linhaExercicio(x, mostrarDia, acoes) {
  const valor = x.peso === 1 ? series(x.series * x.vezes) : `${num(x.series * x.vezes)} × ½ = ${num(x.conta)}`;
  const onde = [mostrarDia && x.diaNome ? x.diaNome : '', x.vezes > 1 ? `${x.vezes}× na semana` : ''].filter(Boolean).join(' · ');
  return h('div', { class: 'musc-ex', 'data-ex': x.ex },
    h('div', { class: 'row between top' },
      h('div', { class: 'grow' }, h('div', { class: 'small', text: x.nome }), onde ? h('div', { class: 'tiny muted', text: onde }) : null),
      h('span', { class: 'small nowrap bold', text: valor })),
    acoes && acoes.length ? h('div', { class: 'musc-acoes' }, ...acoes) : null);
}
// Uma linha por músculo, que abre ao toque. `semana` = avaliação do plano (com as faixas da semana).
function linhaMusculo(x, a, alvo, ctx) {
  const chave = ctx.chave + ':' + x.g;
  const mostrarDia = alvo.dias.length > 1;
  const corpo = x.series > 0 ? [linha(contaTexto(x), 'small muted musc-conta')] : [];
  if (ultima && ultima.chave === chave) {
    const u = ultima;
    corpo.unshift(h('div', { class: 'musc-feito row' }, h('span', { class: 'grow small', text: u.texto }), btn('Desfazer', () => { desfazerFoto(u.foto); ultima = null; redesenhar(chave); }, 'sm ghost')));
  }
  const excesso = x.faixa === 'muito';
  const qual = ctx.semana ? `Passa do máximo${a.semPerfil ? '' : ' do seu nível'}` : 'Só neste treino, passa do máximo da semana';
  if (excesso) corpo.push(linha(x.excesso === 'diretas'
    ? `${qual}: ${x.diretas} séries diretas (o máximo é ${a.teto}). Tire séries ou troque um destes:`
    : `${qual}: ${num(x.series)} no total (o máximo é ${num(a.teto * 1.5)}). Tire séries ou troque um destes:`, 'small'));
  const inteiras = x.itens.filter((y) => y.peso === 1), ajuda = x.itens.filter((y) => y.peso < 1);
  // no excesso, cada exercício que causa o excesso ganha os botões; com a avaliação de um dia só, também
  const acoesDe = (y) => {
    if (!excesso || !alvo.plan || (x.excesso === 'diretas' && y.peso < 1)) return null;
    const l = [];
    if (y.series > 1) l.push(btn('Tirar 1 série', () => tirarSerie(alvo, y, chave), 'sm'));
    if (trocasPara(y.ex, x.g, ctx.contexto, usadosNoPlano(alvo), ctx.faltam).length) l.push(btn('Trocar', () => trocar(alvo, y, x.g, ctx.faltam, chave), 'sm'));
    l.push(btn('Remover', () => remover(alvo, y, chave), 'sm ghost danger'));
    return l;
  };
  if (inteiras.length) { corpo.push(titulo('Conta inteira')); for (const y of inteiras) corpo.push(linhaExercicio(y, mostrarDia, acoesDe(y))); }
  if (ajuda.length) { corpo.push(titulo('Ajuda (conta ½)')); for (const y of ajuda) corpo.push(linhaExercicio(y, mostrarDia, acoesDe(y))); }
  // pouco ou nada: até 3 exercícios seguros para pôr no treino
  if (ctx.semana && (x.faixa === 'nada' || x.faixa === 'pouco') && alvo.plan) {
    const sug = sugestoesPara(x.g, ctx.contexto, usadosNoPlano(alvo), ctx.demais);
    corpo.push(linha(x.faixa === 'nada' ? `Nenhum exercício conta para ${x.nome.toLowerCase()}. O mínimo é 4 séries por semana.` : `Abaixo de 4 séries por semana, o mínimo que já dá resultado.`, 'small'));
    if (sug.length) {
      corpo.push(titulo(`Adicionar um exercício para ${x.nome.toLowerCase()}`));
      corpo.push(h('div', { class: 'musc-acoes' }, ...sug.map((o) => btn('+ ' + o.nome, () => adicionar(alvo, o, chave), 'sm'))));
    } else if (!a.semPerfil || ctx.bloqueado) corpo.push(linha('Não achei um exercício seguro para você com os aparelhos marcados.', 'tiny muted'));
  }
  const valor = h('span', { class: 'row gap-s nowrap' }, h('span', { class: 'bold', text: num(x.series) }), x.faixa && FAIXA[x.faixa] && (ctx.semana || x.faixa === 'muito') ? badge(FAIXA[x.faixa][0], FAIXA[x.faixa][1]) : null);
  return lembrar(h('details', { class: 'musc', 'data-musc': chave, 'data-g': x.g },
    h('summary', null, h('span', { class: 'grow', text: x.nome }), valor),
    h('div', { class: 'musc-corpo' }, ...corpo)), chave);
}
function listaMusculos(a, alvo, chave, semana) {
  let ctxPessoa = {};
  try { ctxPessoa = contexto(); } catch { ctxPessoa = {}; }
  const grupos = semana ? a.grupos : a.grupos.filter((x) => x.series > 0);
  const ctx = {
    chave, semana, contexto: ctxPessoa, bloqueado: false,
    faltam: a.grupos.filter((x) => GRANDES.includes(x.g) && (x.faixa === 'nada' || x.faixa === 'pouco')).map((x) => x.g),
    demais: a.grupos.filter((x) => x.faixa === 'muito').map((x) => x.g),
  };
  return [
    titulo(semana ? 'Séries por semana · toque para ver' : 'Séries neste treino · toque para ver'),
    h('div', { class: 'musc-lista' }, ...grupos.map((x) => linhaMusculo(x, a, alvo, ctx))),
    h('details', { class: 'pq' }, h('summary', { text: 'Como é a conta?' }),
      linha('Conta inteira: o músculo é o principal do exercício. Ajuda: ele só ajuda, e conta meia série, a conta que melhor explicou o ganho de massa nos estudos (Pelland 2026). Corrida e cardio não contam: não são séries de musculação.', 'small'),
      semana ? linha(`4 séries por semana já dão resultado; 10 ou mais é o indicado para ganhar massa. “Demais”: mais de ${a.teto} séries diretas${a.semPerfil ? '' : ' no seu nível'} ou mais de ${num(a.teto * 1.5)} no total.`, 'small') : null,
      linha('Glúteo conta inteiro no agachamento, no afundo e no leg press: eles fazem o glúteo crescer (Kubo 2019; Plotkin 2023; Kinoshita 2026). Posteriores não contam no agachamento, no leg press nem na elevação pélvica: ali eles quase não cresceram.', 'small'),
      linha('Fontes: Pelland JC et al., Sports Med 2026; Baz-Valle E et al., J Hum Kinet 2022; Schoenfeld BJ et al., J Sports Sci 2017; Iversen VM et al., Sports Med 2021; Kubo K et al., Eur J Appl Physiol 2019; Plotkin DL et al., Front Physiol 2023; Kinoshita M et al., Med Sci Sports Exerc 2026.', 'tiny muted')),
  ];
}

// Avaliação de um treino (um dia do plano). Devolve o cartão, ou null se o treino não tem exercícios.
// `opc.data`: o dia (AAAA-MM-DD) cuja semana está na tela; `dia` já vem com os exercícios dessa semana.
export function cartaoAvaliacaoDoDia(plano, dia, opc = {}) {
  daTela();
  if (doTreinador(plano)) return linhaDoTreinador();
  let a = null;
  try { a = avaliarDia(dia, contexto()); } catch { a = null; }
  if (!a || a.vazio) return null;
  const alvo = { plan: plano, data: opc.data || dateKey(new Date()), dias: [{ id: dia.id, nome: dia.nome, itens: dia.itens }], diaFixo: dia.id };
  const corpo = [
    kv('Foco', a.foco.texto),
    a.mais ? kv('Mais trabalha', `${a.mais.nome} (${a.mais.diretas === false ? 'só como auxiliar' : series(a.mais.series) + (a.mais.series === 1 ? ' direta' : ' diretas')})`) : null,
    a.menos ? kv('Menos trabalha', `${a.menos.nome} (${a.menos.diretas === false ? 'só como auxiliar' : series(a.menos.series) + (a.menos.series === 1 ? ' direta' : ' diretas')})`) : null,
    ...(a.tipo.id ? serve(a.tipo) : []),
    kv('Tamanho', `${a.exercicios} ${a.exercicios === 1 ? 'exercício' : 'exercícios'} · ${series(a.series)} · cerca de ${a.duracaoMin} min`),
  ];
  for (const x of a.sobra) corpo.push(linha(`Séries demais de ${x.nome.toLowerCase()} num treino só: ${x.motivo === 'total' ? num(x.total) + ' no total' : x.series + ' diretas'}, mais do que o indicado para a semana inteira. Toque em ${x.nome.toLowerCase()} abaixo para ver o que mudar.`));
  for (const x of a.repetidos.slice(0, 2)) corpo.push(linha(`Exercícios parecidos: ${x.nomes.slice(0, 3).join(', ')} fazem o mesmo movimento. Dois já bastam.`));
  if (a.grupos.length) corpo.push(...listaMusculos(a, alvo, 'dia:' + dia.id, false));
  return cartao('Avaliação deste treino', a, corpo, 'dia:' + dia.id);
}

// Avaliação do plano inteiro (a semana). Devolve o cartão, ou null se o plano não tem exercícios.
// `opc.data`: um dia da semana que está na tela; os treinos mudados só nessa semana entram como estão nela.
export function cartaoAvaliacaoDoPlano(plano, opc = {}) {
  daTela();
  if (doTreinador(plano)) return linhaDoTreinador();
  const data = opc.data || dateKey(new Date());
  let semana = plano;
  try { semana = { ...plano, dias: plano.dias.map((d) => ({ ...d, itens: itensDoDia(state, plano.id, d.id, data) })) }; } catch { semana = plano; }
  let a = null;
  try { a = avaliarPlano(semana, contexto()); } catch { a = null; }
  if (!a || a.vazio) return null;
  const alvo = { plan: plano, data, dias: semana.dias.map((d) => ({ id: d.id, nome: d.nome, itens: d.itens })) };
  const corpo = [
    ...(a.tipo.id ? serve(a.tipo) : []),
    kv('Duração', a.duracaoMin.menor === a.duracaoMin.maior ? `cerca de ${a.duracaoMin.menor} min` : `de ${a.duracaoMin.menor} a ${a.duracaoMin.maior} min por treino`),
    ...listaMusculos(a, alvo, 'plano:' + plano.id, true),
  ];
  if (a.equilibrio.length || a.corrida.length) {
    corpo.push(titulo('Equilíbrio'));
    for (const x of a.equilibrio) corpo.push(linha(x.texto));
    for (const x of a.corrida.slice(0, 3)) corpo.push(linha(x.texto));
  }
  return cartao('Avaliação do plano', a, corpo, 'plano:' + plano.id);
}

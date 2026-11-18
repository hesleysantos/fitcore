// Tela da Nutricionista virtual.
// Ordem da tela (opção A escolhida pelo dono): o dia de hoje (comido x meta, água, o que comer em volta do treino) →
// [Semana e compras] [Tenho em casa] → um card por refeição, com a "Sugestão" em cima ("Comi" em cada alimento e
// "Comi tudo isso") e o "Você comeu" embaixo (com o próprio "+ Adicionar outro alimento"); cada card recolhe ao toque
// no título → fora das refeições (só se houver) → dias anteriores → suas metas e o total do cardápio → "Saiba mais"
// (tudo o que é só leitura) → refazer a entrevista → o aviso educativo, uma linha.
import { h, btn, chip, seg, sheet, icon, note, toast, norm, fmtInt, dateKey, DIAS_LONGO } from '../ui.js';
import { state, update } from '../store.js';
import { refresh, go } from '../router.js';
import { FAQ_NUTRI, REFS } from '../data/knowledge.js';
import { resumoParaNutricao } from '../logic/corrida.js';
import { ALIMENTOS, CATEGORIAS_ALIMENTO, NOME_FAIXA } from '../data/foods.js';
import {
  PERGUNTAS, ROTULO, respostasCompletas, calcular, limparEmCasa, USADOS_EM_CASA, orientacaoCorrida, faltaDeCarboidrato, imcFaixa, suplementos, limiteDeCafeina, textosDoPeso, contextoDasEntrevistas,
  cardapioDoDia, outraSugestaoDoDia, trocarRefeicaoDoDia, limparAjustes, limparAjuste, orientacaoDoDia, rotuloDoTreino, carboidratoNaCorrida, listaDeCompras, textoDaListaDeCompras,
} from '../logic/nutrition.js';
import { treinosDoDia, semanaDoCardapio } from '../logic/semana-nutricao.js';
import { somarDias, idDaRefeicao, estadoDaSugestao, modoDoDiario } from '../logic/diario.js';
import { interview, faqBlock, notaObjetivo, conferirObjetivos, cartaoObjetivos } from './coach.js';
import { nutriPara } from '../logic/objetivos.js';
import { blocoDiario, botaoComiDoItem, botaoDaSugestao, resumoDoDiario, resumoDaRefeicao, voceComeu, foraDasRefeicoes, macrosDeHoje, historicoDoDiario, fontesDoDiario, refeicaoDaHora, redesenharNoLugar } from './diario.js';
import { botaoChat } from './chat.js';

let modo = 'auto';
const dec = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');

function cabecalho() {
  return h('div', { class: 'coach-hd' }, h('div', { class: 'avatar nutri' }, icon('apple', 'l')), h('div', null, h('h2', { text: 'Nutricionista virtual' }), h('p', { class: 'tiny muted', text: 'Orientação educativa. Não é prescrição de dieta nem substitui nutricionista.' })));
}
function macroBar(r) {
  const tot = r.prot * 4 + r.carb * 4 + r.gord * 9;
  const seg = (cls, v) => { const el = h('i', { class: cls }); el.style.width = (v / tot) * 100 + '%'; return el; };
  return h('div', { class: 'macro', role: 'img', 'aria-label': 'Divisão das calorias entre proteína, carboidrato e gordura' }, seg('p', r.prot * 4), seg('c', r.carb * 4), seg('g', r.gord * 9));
}
function acc(titulo, linhas) {
  const d = h('details', { class: 'acc' }, h('summary', { text: titulo }));
  const inner = h('div');
  for (const l of linhas) inner.appendChild(typeof l === 'string' ? h('p', { text: l }) : l);
  d.appendChild(inner);
  return d;
}
const lista = (itens) => { const ul = h('ul'); for (const t of itens) ul.appendChild(h('li', { text: t })); return ul; };
// faixa de preço de um alimento, bem discreta: $ barato, $$ médio, $$$ caro
const cifroes = (faixa) => h('span', { class: 'tiny muted nowrap', role: 'img', 'aria-label': 'preço ' + NOME_FAIXA[faixa], title: 'Preço ' + NOME_FAIXA[faixa], text: ' ' + '$'.repeat(faixa) });
const chipPequeno = (texto, ligado, fn) => { const c = chip(texto, ligado, fn); c.classList.add('sm'); return c; };

// "O que eu tenho em casa": a pessoa marca os alimentos por grupo (com busca); a lista fica salva no aparelho.
function escolherEmCasa() {
  const marcados = new Set(limparEmCasa(state.nutri.emCasa));
  const grupos = h('div', { class: 'col gap-s' });
  const contagem = h('span', { class: 'small muted grow' });
  const conta = () => { contagem.textContent = marcados.size === 1 ? '1 alimento marcado' : marcados.size + ' alimentos marcados'; };
  const desenha = (termo) => {
    while (grupos.firstChild) grupos.removeChild(grupos.firstChild);
    const t = norm(termo).trim();
    for (const [cat, nomeCat] of Object.entries(CATEGORIAS_ALIMENTO)) {
      const itens = ALIMENTOS.filter((f) => f.cat === cat && (!t || norm(f.nome).includes(t)));
      if (!itens.length) continue;
      const resumo = h('summary');
      const titulo = () => { resumo.textContent = nomeCat + ' · ' + itens.filter((f) => marcados.has(f.id)).length + ' de ' + itens.length; };
      const caixa = h('div', { class: 'chips wrap' });
      for (const f of itens) {
        const c = chipPequeno(f.nome, marcados.has(f.id), () => {
          if (marcados.has(f.id)) marcados.delete(f.id); else marcados.add(f.id);
          const on = marcados.has(f.id);
          c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false');
          titulo(); conta();
        });
        c.title = f.nome + ' — preço ' + NOME_FAIXA[f.preco.faixa] + (USADOS_EM_CASA.has(f.id) ? '' : ' (não entra no cardápio)');
        caixa.appendChild(c);
      }
      titulo();
      // com busca, os grupos encontrados já vêm abertos
      grupos.appendChild(h('details', { class: 'acc', open: !!t }, resumo, h('div', null, caixa)));
    }
    if (!grupos.firstChild) grupos.appendChild(h('p', { class: 'small muted', text: 'Nenhum alimento com esse nome.' }));
  };
  const busca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar alimento', 'aria-label': 'Buscar alimento', autocomplete: 'off', maxlength: 40, onInput: (e) => desenha(e.target.value) });
  const sh = sheet({
    title: 'O que eu tenho em casa', full: true,
    body: h('div', { class: 'col' },
      h('p', { class: 'small muted', text: 'Marque o que você tem. O cardápio passa a usar só esses alimentos e avisa o que faltar. Temperos, doces e bebidas podem ser marcados, mas não entram na conta.' }),
      h('div', { class: 'search' }, icon('search'), busca), grupos),
    footer: [contagem,
      btn('Limpar', () => { marcados.clear(); desenha(busca.value); conta(); }, 'ghost'),
      btn('Salvar', () => { update((s) => { s.nutri.emCasa = limparEmCasa([...marcados]); s.nutri.soCasa = marcados.size > 0; s.nutri.seed = 0; }); sh.close(); refresh(); }, 'primary')],
  });
  desenha(''); conta();
}

// Único ponto de ligação com o plano de corrida: sem plano (ou se algo falhar), a Nutricionista funciona como antes.
function resumoDaCorrida() {
  try { return resumoParaNutricao(state, dateKey()); } catch { return null; }
}
const fontesEm = (chaves) => { const box = h('div', { class: 'col gap-s' }); for (const k of chaves) if (REFS[k]) box.appendChild(h('p', { class: 'ref', text: '• ' + REFS[k] })); return box; };
const secao = (titulo, intro, itens, extras) => [h('h3', { text: titulo }), intro ? h('p', { class: 'small', text: intro }) : null, itens && itens.length ? lista(itens) : null, ...(extras || []).map((t) => h('p', { class: 'small', text: t }))];

// ---------- 1. o dia de hoje: treinos, comido x meta e o que comer em volta do treino ----------
// Poucas linhas: o título do dia, "896 de 1.690 kcal · Proteína 52 de 105 g", a barra, quanto falta e a água. Quem não
// recebe números (transtorno alimentar, menores de 18) não vê calorias aqui (views/diario.js, resumoDoDiario).
function cartaoDeHoje(r, treinos) {
  const o = orientacaoDoDia(r, treinos);
  const card = h('div', { class: 'card col', id: 'hoje-nutri', dataset: { treino: o.treina ? 'sim' : o.semAgenda ? 'sem-agenda' : 'descanso' } }, h('h2', { text: o.titulo }));
  const resumo = r.modo !== 'educativo' ? resumoDoDiario(r) : null;
  if (resumo) card.appendChild(resumo);
  if (r.agua) card.appendChild(h('p', { class: 'small muted', id: 'hoje-agua' }, icon('water', 's'), ` Água: ${dec(r.agua)} L no dia (${dec(r.aguaBebidas)} L em bebidas).`));
  if (o.antes) {
    // o que comer e beber em volta do treino: fecha ao toque, para o cardápio aparecer logo
    const corpo = [h('p', { class: 'small', text: o.resumo }),
      ...secao('Antes', o.antes.intro, o.antes.itens, o.antes.extras),
      ...(o.durante ? secao('Durante a corrida', '', null, o.durante.linhas) : []),
      ...secao('Depois', o.depois.intro, o.depois.itens, o.depois.extras),
      h('div', { class: 'note info' }, icon('water'), h('div', { text: o.agua }))];
    if (o.refs.length) corpo.push(acc('Fontes', [fontesEm(o.refs)]));
    const d = acc(o.durante ? 'O que comer antes, durante e depois' : 'O que comer antes e depois do treino', corpo.filter(Boolean));
    d.id = 'hoje-treino';
    card.appendChild(d);
  } else {
    // dia de descanso: a frase que muda o que comer; sem treinos conhecidos, nada (a frase genérica saiu)
    if (!o.semAgenda) card.appendChild(h('p', { class: 'small', id: 'hoje-descanso', text: o.resumo }));
    if (!r.agua) card.appendChild(h('p', { class: 'small muted', text: o.agua }));
  }
  // prova marcada: a semana e o dia da prova (fica aberta na última semana)
  const corr = orientacaoCorrida(r, new Date());
  if (corr && corr.prova) {
    const d = acc(corr.prova.titulo + (corr.prova.dias >= 0 ? ` · ${corr.prova.dias === 0 ? 'hoje' : corr.prova.dias === 1 ? 'amanhã' : 'faltam ' + corr.prova.dias + ' dias'}` : ''), [lista(corr.prova.linhas), acc('Fontes', [fontesEm(corr.refs)])]);
    d.open = corr.prova.dias >= 0 && corr.prova.dias <= 7;
    d.id = 'hoje-prova';
    card.appendChild(d);
  }
  return card;
}

// ---------- 2. as refeições de hoje: "Sugestão" em cima, "Você comeu" embaixo, no mesmo card ----------
// cada alimento: nome e medida caseira à esquerda, gramas à direita ("300 g (10 colheres de sopa cheias)" vira duas partes).
// Com `marcar` (só no cardápio de hoje), cada alimento ganha o botão "Comi": um toque marca só aquele alimento.
function itensDaRefeicao(ref, marcar = null) {
  const box = h('div', { class: 'itens' });
  for (const it of ref.itens) {
    const m = /^(\d+ g)(?: \((.*)\))?$/.exec(it.medida);
    const gramas = h('span', { text: m ? m[1] : it.medida });
    box.appendChild(h('div', { class: 'kv', dataset: { al: it.id } },
      h('div', { class: 'grow' }, h('div', null, it.nome, cifroes(it.faixa)), m && m[2] ? h('div', { class: 'tiny muted', text: m[2] }) : null),
      marcar ? h('div', { class: 'sug-dir' }, gramas, marcar(it)) : gramas));
  }
  return box;
}
const nomesCurtos = (ref) => ref.itens.map((it) => it.nome.split(' (')[0].split(',')[0]).join(', ');
// guarda o ajuste do dia (só a semana que importa: os dias de mais de 7 dias atrás saem)
function gravarAjuste(data, ajuste) {
  const hoje = dateKey();
  update((s) => {
    const aj = limparAjustes(s.nutri.ajustes);
    for (const d of Object.keys(aj)) if (d < somarDias(hoje, -7)) delete aj[d];
    if (ajuste) aj[data] = ajuste; else delete aj[data];
    s.nutri.ajustes = limparAjustes(aj);
  });
}
function trocarRefeicao(r, data, ref, opcoes, depois) {
  const novo = trocarRefeicaoDoDia(r, data, limparAjustes(state.nutri.ajustes)[data] || null, ref.ordem, opcoes);
  if (!novo) { toast(opcoes.emCasa ? 'Com estes alimentos não há outra opção para esta refeição.' : 'Não há outra opção para esta refeição com as suas restrições.'); return; }
  // o que a pessoa já marcou como comido continua no diário (a troca muda só a sugestão)
  const jaComeu = data === dateKey() && estadoDaSugestao(state.diario, data, ref).algum;
  gravarAjuste(data, novo);
  toast(`${ref.nome}: nova sugestão, com a mesma meta do dia.${jaComeu ? ' O que você já marcou continua em “Você comeu”.' : ''}`);
  // na tela do dia, o card trocado fica onde estava
  if (data === dateKey()) redesenharNoLugar(`#conteudo .refeicao[data-ref="${idDaRefeicao(ref.nome)}"]`); else refresh();
  if (depois) depois();
}

// Recolher e abrir cada refeição (toque no título). Padrão: a refeição do horário e as próximas abertas (tarde da noite,
// a última do cardápio); as que já passaram e as já comidas inteiras, recolhidas. A escolha da pessoa vale para o dia, guardada só neste aparelho
// (localStorage, fora do backup); uma refeição em que a pessoa acabou de mexer não se recolhe sozinha.
const ORDEM_REF = ['cafe', 'lanche-manha', 'almoco', 'lanche-tarde', 'jantar', 'ceia', 'outro'];
const CHAVE_CARDS = 'fitcore-nutri-cards';
let escolhas = { data: '', refs: {} };
const mexidas = new Set();   // 'dia|refeição' tocadas nesta abertura do app
function escolhasDoDia(data) {
  if (escolhas.data === data) return escolhas;
  let v = null;
  try { v = JSON.parse(localStorage.getItem(CHAVE_CARDS) || 'null'); } catch { v = null; }
  const refs = {};
  if (v && typeof v === 'object' && v.data === data && v.refs && typeof v.refs === 'object') for (const k of ORDEM_REF) if (typeof v.refs[k] === 'boolean') refs[k] = v.refs[k];
  escolhas = { data, refs };
  return escolhas;
}
function guardarEscolha(data, ref, aberta) {
  const e = escolhasDoDia(data);
  e.refs[ref] = aberta;
  try { localStorage.setItem(CHAVE_CARDS, JSON.stringify(e)); } catch { /* sem armazenamento: vale só nesta abertura */ }
}
function cardAberto(data, id, est, desde) {
  const e = escolhasDoDia(data);
  if (typeof e.refs[id] === 'boolean') return e.refs[id];
  if (mexidas.has(data + '|' + id)) return true;
  if (est.toda) return false;
  return ORDEM_REF.indexOf(id) >= ORDEM_REF.indexOf(desde);
}
function cartaoDaRefeicao(r, ref, data, opcoes, desde) {
  const id = idDaRefeicao(ref.nome);
  const est = estadoDaSugestao(state.diario, data, ref);
  const comKcal = r.modo !== 'educativo';
  const aberto = cardAberto(data, id, est, desde);
  const res = resumoDaRefeicao(ref, r);
  // "Comi" em cada alimento da sugestão: marca ou desmarca só aquele alimento (views/diario.js)
  const marcar = (it) => botaoComiDoItem(ref, it, (est.itens.find((x) => x.al === it.id) || {}).marcado === true);
  const corpoId = 'ref-corpo-' + id;
  const corpo = h('div', { class: 'col ref-corpo', id: corpoId, hidden: !aberto },
    h('div', { class: 'row between ref-sug-hd' },
      h('div', { class: 'comido-rot sug-rot', text: comKcal ? `Sugestão · ${fmtInt(ref.kcal)} kcal` : 'Sugestão' }),
      h('button', { type: 'button', class: 'btn sm ghost trocar', 'aria-label': `Trocar ${ref.nome.toLowerCase()}`, title: 'Outra sugestão para esta refeição', onClick: () => trocarRefeicao(r, data, ref, opcoes) }, icon('swap'), 'Trocar')),
    itensDaRefeicao(ref, marcar),
    botaoDaSugestao(ref),
    voceComeu(ref, r));
  let seta = icon(aberto ? 'up' : 'down', 's');
  const titulo = h('button', { type: 'button', class: 'ref-hd', 'aria-expanded': aberto ? 'true' : 'false', 'aria-controls': corpoId },
    h('div', { class: 'grow' }, h('h3', { text: ref.nome }), h('div', { class: 'ref-resumo' + (res.feita ? ' feita' : ''), text: res.texto })), seta);
  titulo.addEventListener('click', () => {
    // só esconde ou mostra o corpo: nada acima do título muda, então o título fica onde está
    const abrir = corpo.hidden;
    corpo.hidden = !abrir;
    titulo.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    const nova = icon(abrir ? 'up' : 'down', 's'); seta.replaceWith(nova); seta = nova;
    // o card recolhido tem menos margem: a rolagem compensa, e o título fica exatamente onde a pessoa tocou
    const y0 = titulo.getBoundingClientRect().top;
    const c = titulo.closest('.card'); if (c) c.classList.toggle('recolhida', !abrir);
    const dy = titulo.getBoundingClientRect().top - y0; if (dy) window.scrollBy(0, dy);
    guardarEscolha(data, id, abrir);
  });
  const card = h('div', { class: 'card refeicao' + (aberto ? '' : ' recolhida'), dataset: { ref: id } }, titulo, corpo);
  // a pessoa mexeu nesta refeição (marcou, adicionou, trocou): ela não se recolhe sozinha depois do redesenho
  corpo.addEventListener('click', () => mexidas.add(data + '|' + id), true);
  return card;
}
// "Tenho em casa": o que o cardápio usa (comida comum ou só o que há em casa), preferir os mais baratos e trocar o dia
// todo. Junta numa folha os controles que ficavam soltos antes das refeições.
function opcoesDoCardapio(r, c) {
  const hoje = dateKey();
  const emCasa = limparEmCasa(state.nutri.emCasa);
  const soCasa = state.nutri.soCasa === true && emCasa.length > 0;
  const opcoes = { emCasa: soCasa ? emCasa : null };
  const ajuste = limparAjustes(state.nutri.ajustes)[hoje] || null;
  const fecharE = (fn) => () => { sh.close(); fn(); };
  const modoCasa = seg([['comum', 'Comida comum'], ['casa', 'Só o que tenho em casa']], soCasa ? 'casa' : 'comum', (v) => {
    if (v === 'casa' && !emCasa.length) { sh.close(); escolherEmCasa(); return; }
    update((s) => { s.nutri.soCasa = v === 'casa'; }); gravarAjuste(hoje, null); sh.close(); refresh();
  });
  modoCasa.classList.add('alvo');
  const barato = r.preco === 'barato';
  const chipBarato = chipPequeno('Preferir os mais baratos', barato, () => { update((s) => { s.nutri.answers.preco = barato ? 'tanto_faz' : 'barato'; }); sh.close(); refresh(); });
  chipBarato.classList.add('alvo');
  // "Outra sugestão" só muda o dia quando há alimentos diferentes; se não houver, avisa
  const outra = () => {
    const novo = outraSugestaoDoDia(r, hoje, ajuste, opcoes);
    if (!novo) { toast(soCasa ? 'Com estes alimentos não há outra combinação. Marque mais itens em casa.' : 'Não há outra combinação com as suas restrições.'); return; }
    gravarAjuste(hoje, limparAjuste(novo)); refresh();
  };
  const sh = sheet({
    title: 'Tenho em casa',
    body: h('div', { class: 'col', id: 'opcoes-cardapio' },
      h('p', { class: 'small muted', text: 'Escolha com o que o cardápio de hoje é montado.' }),
      modoCasa,
      btn(emCasa.length ? `Editar o que tenho em casa (${emCasa.length})` : 'Marcar o que tenho em casa', fecharE(escolherEmCasa), 'block ghost alvo', 'edit'),
      soCasa ? null : h('div', { class: 'col gap-s' }, chipBarato, h('p', { class: 'tiny muted', text: '$ barato · $$ médio · $$$ caro. O preço varia com a região e a época.' })),
      btn('Outra sugestão para o dia todo', fecharE(outra), 'block ghost alvo', 'refresh'),
      h('p', { class: 'tiny muted', text: 'Para trocar uma refeição só, use “Trocar” dentro dela.' })),
    footer: [btn('Fechar', () => sh.close(), 'ghost grow')],
  });
  return sh;
}
function blocoCardapio(r) {
  const out = [];
  const hoje = dateKey();
  const emCasa = limparEmCasa(state.nutri.emCasa);
  const soCasa = state.nutri.soCasa === true && emCasa.length > 0;
  const opcoes = { emCasa: soCasa ? emCasa : null };
  const ajuste = limparAjustes(state.nutri.ajustes)[hoje] || null;
  const c = cardapioDoDia(r, hoje, ajuste, opcoes);
  if (!c) return { out, c };
  out.push(h('div', { class: 'row par-de-botoes', id: 'ferramentas-cardapio' }, btn('Semana e compras', () => abrirSemana(r), 'sm alvo grow', 'calendar'), btn('Tenho em casa', () => opcoesDoCardapio(r, c), 'sm alvo grow', 'building')));
  if (soCasa) {
    out.push(h('div', { class: 'row between' },
      h('span', { class: 'small muted grow', text: `Só com os ${emCasa.length} alimentos que você tem em casa.` }),
      btn('Mudar', () => opcoesDoCardapio(r, c), 'ghost sm alvo', 'edit')));
    // o que falta para o dia fechar, com a opção mais barata para completar
    if (c.faltas.length) {
      out.push(h('div', { class: 'note warn' }, icon('warn'), h('div', { class: 'col gap-s' },
        h('div', { class: 'bold', text: c.faltas.length === 1 ? 'Falta um item para fechar o dia' : 'O que falta para fechar o dia' }),
        lista(c.faltas.map((f) => f.texto + (f.sugestoes.length ? ' Mais barato: ' + f.sugestoes.map((s) => s.nome.split(' (')[0].toLowerCase()).join(' ou ') + '.' : ''))))));
    }
  }
  if (!c.refeicoes.length) out.push(h('p', { class: 'small muted', text: 'Com o que está marcado não dá para montar uma refeição. Marque mais alimentos.' }));
  // a refeição do horário (ou a próxima); tarde da noite, depois da última do cardápio, a última fica aberta
  const ids = c.refeicoes.map((x) => idDaRefeicao(x.nome));
  const agora = ORDEM_REF.indexOf(refeicaoDaHora());
  const desde = ids.find((x) => ORDEM_REF.indexOf(x) >= agora) || ids[ids.length - 1];
  for (const ref of c.refeicoes) out.push(cartaoDaRefeicao(r, ref, hoje, opcoes, desde));
  // o que foi comido em horário fora do cardápio (só se existir)
  const fora = foraDasRefeicoes(r, c.refeicoes.map((x) => idDaRefeicao(x.nome)));
  if (fora) out.push(fora);
  return { out, c };
}
// o total do cardápio sugerido (vai para dentro de "Suas metas": é a soma da sugestão, não do que foi comido)
function totalDoCardapio(r, c) {
  if (!c || !c.refeicoes.length) return [];
  const falta = faltaDeCarboidrato(r, c);
  return [h('h3', { class: 'orient-t', text: 'Total do cardápio sugerido' }),
    h('div', { id: 'cardapio-total' },
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Calorias' }), h('span', { text: `${fmtInt(c.kcal)} kcal (meta ${fmtInt(r.kcal)})` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Proteína' }), h('span', { text: `${Math.round(c.p)} g (meta ${r.prot})` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Carboidrato' }), h('span', { text: r.corrida ? `${Math.round(c.c)} g (meta ${r.carb})` : `${Math.round(c.c)} g` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Gordura' }), h('span', { text: `${Math.round(c.g)} g` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Fibras' }), h('span', { text: `${Math.round(c.fibra)} g` }))),
    falta ? h('p', { class: 'small', text: falta }) : null].filter(Boolean);
}

// ---------- 3. a semana: cardápio de cada dia e lista de compras ----------
// De hoje até daqui a 6 dias: é o que dá para comprar e preparar agora (os dias que já passaram não ajudam).
let abaSemana = 'dias';
const nomeDia = (data, hoje) => { const d = new Date(data + 'T12:00:00'); return (data === hoje ? 'Hoje, ' : DIAS_LONGO[d.getDay()].replace('-feira', '') + ', ') + `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
function copiarTexto(titulo, texto) {
  const ta = h('textarea', { class: 'input', readonly: true, rows: 10, 'aria-label': titulo });
  ta.value = texto;
  const sh = sheet({
    title: titulo,
    body: [h('p', { class: 'small muted', text: 'Toque em “Copiar” e cole onde quiser (bloco de notas, mensagem para você mesmo). Nada sai do aparelho sem você colar.' }), ta],
    footer: [btn('Fechar', () => sh.close(), 'ghost'), btn('Copiar', async () => {
      try { await navigator.clipboard.writeText(texto); toast('Lista copiada'); } catch { ta.focus(); ta.select(); toast('Selecione e copie o texto manualmente'); }
    }, 'primary', 'copy')],
  });
}
function abrirSemana(r) {
  const hoje = dateKey();
  const corpo = h('div', { class: 'col', id: 'semana-conteudo' });
  let semana = [];
  abaSemana = 'dias';
  const desenha = () => {
    semana = semanaDoCardapio(state, hoje, { res: r });
    while (corpo.firstChild) corpo.removeChild(corpo.firstChild);
    const ate = semana[semana.length - 1].data;
    corpo.appendChild(h('p', { class: 'small muted', text: `De hoje até ${nomeDia(ate, hoje).toLowerCase()}. Cada dia segue a meta e os treinos daquele dia. Exemplo, não dieta prescrita.` }));
    if (state.nutri.soCasa === true) corpo.appendChild(h('p', { class: 'tiny muted', text: 'A semana usa comida comum, para montar a lista de compras. O que você marcou em casa aparece indicado na lista.' }));
    const abas = seg([['dias', 'Cardápio'], ['compras', 'Lista de compras']], abaSemana, (v) => { abaSemana = v; desenha(); });
    abas.classList.add('alvo');
    corpo.appendChild(abas);
    if (abaSemana === 'compras') desenhaCompras(); else desenhaDias();
  };
  const desenhaDias = () => {
    for (const d of semana) {
      const rot = rotuloDoTreino(d.treinos);
      const treino = rot ? rot.charAt(0).toUpperCase() + rot.slice(1) : d.treinos.conhecido ? 'Descanso' : 'Treinos: monte o seu plano para ver aqui';
      const card = h('div', { class: 'card semana-dia', dataset: { data: d.data } },
        h('div', { class: 'row between' }, h('h3', { text: nomeDia(d.data, hoje) }), d.meta && d.meta.kcal ? h('span', { class: 'tiny muted nowrap', text: `${fmtInt(d.meta.kcal)} kcal · ${d.meta.prot} g` }) : null),
        h('div', { class: 'treino-dia' }, icon(rot ? (d.treinos.corrida ? 'run' : 'dumbbell') : 'moon', 's accent'), ' ' + treino));
      if (d.treinos.corrida && d.treinos.corrida.durMin > 45) card.appendChild(h('p', { class: 'tiny muted', text: 'Na corrida: ' + carboidratoNaCorrida(d.treinos.corrida.durMin, r.modo === 'educativo').texto.toLowerCase() }));
      if (!d.cardapio) { card.appendChild(h('p', { class: 'small muted', text: 'Sem cardápio para este dia.' })); corpo.appendChild(card); continue; }
      for (const ref of d.cardapio.refeicoes) {
        const det = h('details', { class: 'acc', dataset: { ref: idDaRefeicao(ref.nome) } },
          h('summary', null, h('div', { class: 'grow' }, h('div', { text: ref.nome }), h('div', { class: 'tiny muted resumo', text: nomesCurtos(ref) }))),
          h('div', null, itensDaRefeicao(ref),
            h('div', { class: 'row between' }, h('span', { class: 'tiny muted grow', text: `${fmtInt(ref.kcal)} kcal · ${Math.round(ref.p)} g de proteína` }),
              btn('Trocar', () => trocarRefeicao(d.meta, d.data, ref, {}, desenha), 'sm alvo', 'swap'))));
        card.appendChild(det);
      }
      corpo.appendChild(card);
    }
  };
  const lista7 = () => listaDeCompras(semana.map((d) => d.cardapio), { emCasa: limparEmCasa(state.nutri.emCasa) });
  const tituloLista = () => `Lista de compras · ${nomeDia(semana[0].data, '').split(', ')[1]} a ${nomeDia(semana[semana.length - 1].data, '').split(', ')[1]}`;
  const desenhaCompras = () => {
    const l = lista7();
    const box = h('div', { class: 'col compras', id: 'lista-compras' });
    box.appendChild(h('p', { class: 'tiny muted', text: 'Soma dos 7 cardápios. Arroz, feijão, carnes e peixes em peso cru; frutas com casca. Quantidades aproximadas.' }));
    if (l.itens) box.appendChild(btn('Copiar a lista como texto', () => copiarTexto('Copiar a lista', textoDaListaDeCompras(l, tituloLista())), 'block alvo', 'copy'));
    if (!l.itens) box.appendChild(h('p', { class: 'small muted', text: 'Nada para comprar: não há cardápio nesta semana.' }));
    for (const g of l.grupos) {
      box.appendChild(h('h3', { text: g.nome }));
      const card = h('div', { class: 'card tight' });
      for (const x of g.itens) card.appendChild(h('div', { class: 'kv' }, h('div', null, h('div', { text: x.nome }), x.detalhe || x.emCasa ? h('div', { class: 'tiny muted', text: [x.detalhe, x.emCasa ? 'marcado em casa: confira a quantidade' : ''].filter(Boolean).join(' · ') }) : null), h('span', { class: 'nowrap', text: x.qtd })));
      box.appendChild(card);
    }
    corpo.appendChild(box);
  };
  desenha();
  const sh = sheet({ title: 'Cardápio da semana', full: true, body: corpo, footer: [btn('Fechar', () => sh.close(), 'ghost grow')] });
}

// ---------- suplementos e pré-treino (logic/nutrition.js, suplementos) ----------
// Uma seção fechada, em três partes: "Com boa evidência" (com dose, quando cabe), "Pré-treino pronto: cuidados" e "Sem
// evidência ou arriscados". Cada linha é curta; o porquê e as fontes ficam fechados. No modo educativo, sem doses: só a
// orientação de procurar o médico ou o nutricionista.
let xicarasDeCafe = 0;   // só nesta tela (não é salvo)
const fontesSup = (refs) => h('div', { class: 'col gap-s mt' }, h('div', { class: 'tiny bold muted', text: 'FONTES' }), ...refs.filter((k) => REFS[k]).map((k) => h('p', { class: 'ref', text: '• ' + REFS[k] })));
const porQueSup = (texto, refs, rotulo = 'Por quê?') => h('details', { class: 'pq' }, h('summary', { text: rotulo }), texto ? h('p', { class: 'small', text: texto }) : null, refs && refs.length ? fontesSup(refs) : null);
const linhaSup = (nome, texto, porque, refs) => h('div', { class: 'sup-linha' }, h('p', { class: 'small' }, h('b', { text: nome + ': ' }), texto), porQueSup(porque, refs));
// quanto de cafeína ainda cabe no pré-treino, pelas xícaras de café do dia
function cafeinaQueCabe(r) {
  const caixa = h('div', { class: 'col gap-s' });
  const desenha = () => {
    while (caixa.firstChild) caixa.removeChild(caixa.firstChild);
    const lim = limiteDeCafeina(r, xicarasDeCafe);
    caixa.append(h('div', { class: 'tiny muted', text: 'Xícaras de café por dia' }),
      seg([[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4 ou mais']], xicarasDeCafe, (v) => { xicarasDeCafe = v; desenha(); }),
      h('p', { class: 'small bold', 'aria-live': 'polite', text: lim ? lim.texto : '' }));
  };
  desenha();
  return caixa;
}
function blocoSuplementos(r) {
  const s = suplementos(r);
  const p = s.preTreino;
  const out = [h('p', { text: s.intro })];
  if (s.boas.length) {
    out.push(h('h3', { class: 'orient-t', text: 'Com boa evidência' }));
    for (const b of s.boas) out.push(linhaSup(b.nome, b.texto, b.porque, b.refs));
  } else out.push(note('warn', s.aviso));
  out.push(h('h3', { class: 'orient-t', text: 'Pré-treino pronto: cuidados' }));
  out.push(p.bloqueado ? note('warn', p.intro) : h('p', { class: 'small', text: p.intro }));
  if (p.introRefs && p.introRefs.length) out.push(porQueSup('', p.introRefs, 'Fontes'));
  for (const x of p.itens) {
    const linha = linhaSup(x.titulo, x.texto, x.porque, x.refs);
    if (x.cafeina) linha.insertBefore(cafeinaQueCabe(r), linha.lastChild);
    out.push(linha);
  }
  out.push(h('h3', { class: 'orient-t', text: 'Sem evidência ou arriscados' }));
  const ul = h('ul');
  for (const x of s.semEvidencia) ul.appendChild(h('li', { class: 'small' }, h('b', { text: x.nome + ': ' }), x.texto));
  out.push(ul, porQueSup('', [...new Set(s.semEvidencia.flatMap((x) => x.refs))], 'Fontes'));
  if (s.boas.length) out.push(note('warn', s.aviso));
  const d = acc('Suplementos e pré-treino', out);
  d.id = 'suplementos';
  return d;
}

// ---------- tela ----------
function resultado() {
  const a = state.nutri.answers;
  // as outras entrevistas entram na conta: vale sempre a resposta mais protegida (menor de 18, gestação, doença renal...)
  const r = calcular(a, resumoDaCorrida(), contextoDasEntrevistas(state));
  const hoje = dateKey();
  let treinos = { musculacao: null, corrida: null, conhecido: false };
  try { treinos = treinosDoDia(state, hoje, hoje); } catch { /* sem treinos conhecidos */ }
  const body = [cartaoObjetivos()].filter(Boolean);
  // avisos que mudam o que a pessoa deve fazer ficam no alto; os demais cuidados vão para "Saiba mais"
  for (const av of r.avisos) if (av.tipo !== 'info') body.push(note(av.tipo, av.texto));

  // 1. hoje  2. [Semana e compras] [Tenho em casa]  3. as refeições (sugestão + o que comeu)  4. fora das refeições
  body.push(cartaoDeHoje(r, treinos));
  const { out: cardapioDeHoje, c } = blocoCardapio(r);
  body.push(...cardapioDeHoje);
  // sem cardápio (perfis sem números): o diário completo, como antes
  if (!c) body.push(...blocoDiario(r));

  // 5. dias anteriores e a semana (fechado)
  if (c) body.push(...historicoDoDiario(r));

  // 6. metas em detalhe, como foram calculadas e o total do cardápio sugerido (fechado)
  if (r.modo !== 'educativo') {
    const obj = r.objetivoCalc;
    const peso = textosDoPeso(r);   // perda ou ganho por semana e o que fazer se o peso não mudar
    const linhas = [h('div', { class: 'row between' }, h('span', { class: 'small muted', text: 'Objetivo' }), h('span', { class: 'badge acc', text: ROTULO.objetivo[obj] })),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', { text: fmtInt(r.kcal) }), h('span', { text: 'kcal por dia' })),
        h('div', { class: 'stat' }, h('b', { text: r.prot + ' g' }), h('span', { text: 'proteína' })),
        h('div', { class: 'stat' }, h('b', { text: dec(r.agua) + ' L' }), h('span', { text: 'água' }))),
      macroBar(r),
      h('div', { class: 'col gap-s small' },
        h('div', { class: 'row between' }, h('span', null, h('i', { class: 'dotc p' }), 'Proteína'), h('span', { class: 'bold', text: `${r.prot} g (${dec(r.gkg)} g por kg)` })),
        h('div', { class: 'row between' }, h('span', null, h('i', { class: 'dotc c' }), 'Carboidrato'), h('span', { class: 'bold', text: `${r.carb} g` })),
        h('div', { class: 'row between' }, h('span', null, h('i', { class: 'dotc g' }), 'Gordura'), h('span', { class: 'bold', text: `${r.gord} g` })),
        h('div', { class: 'row between' }, h('span', { text: 'Fibras' }), h('span', { class: 'bold', text: `pelo menos ${r.fibra} g` })),
        h('div', { class: 'row between' }, h('span', { text: 'Proteína por refeição' }), h('span', { class: 'bold', text: `${r.protRefeicao[0]} a ${r.protRefeicao[1]} g` })))];
    const macros = macrosDeHoje(r);
    if (macros) linhas.push(macros);
    if (peso.ritmo) linhas.push(h('p', { class: 'small', text: peso.ritmo }));
    linhas.push(`Você gasta cerca de ${fmtInt(r.gasto)} kcal por dia (${fmtInt(r.tmb)} em repouso). A fórmula é uma estimativa e pode errar 10% ou mais: acompanhe o peso por 2 a 3 semanas e ajuste.`);
    // a corrida nas metas: de onde vêm as calorias e o carboidrato a mais (logic/nutrition.js, orientacaoCorrida)
    const corr = orientacaoCorrida(r, new Date());
    if (corr) linhas.push(...corr.blocos[0].linhas);
    linhas.push(...peso.linhas);
    linhas.push(`Água: os ${dec(r.agua)} L somam o que você bebe e a água da comida; cerca de ${dec(r.aguaBebidas)} L vêm de água e outras bebidas. No calor e nos dias de treino você precisa de mais: beba conforme a sede e observe a urina, que deve ficar clara.`);
    linhas.push(r.imc > 25
      ? 'A proteína é calculada pelo peso que você teria com IMC 25: o peso acima disso é quase todo gordura e não aumenta essa necessidade.'
      : 'Proteína: a meta por quilo depende do objetivo e de você treinar ou não. A partir dos 65 anos, nunca fica abaixo de 1,2 g por quilo.');
    linhas.push(`IMC: ${dec(r.imc)} (${imcFaixa(r.imc, r.idade)}). É só uma referência: não distingue músculo de gordura.`);
    linhas.push(...totalDoCardapio(r, c));
    const metas = acc(c ? 'Suas metas e o total do cardápio' : 'Suas metas e como foram calculadas', linhas);
    metas.id = 'metas';
    body.push(metas);
  } else {
    body.push(h('p', { class: 'small muted', text: `IMC: ${dec(r.imc)} (${imcFaixa(r.imc, r.idade)}) — só uma referência.` }));
  }

  // 7. "Saiba mais": tudo o que é só leitura, numa seção fechada
  const mais = [];
  const info = r.avisos.filter((av) => av.tipo === 'info');
  if (info.length) mais.push(acc('Cuidados para você', info.map((av) => note(av.tipo, av.texto))));
  mais.push(acc('Como comer bem', [
    h('h3', { class: 'orient-t', text: 'A base: comida de verdade' }),
    lista([
      'Faça de alimentos in natura ou minimamente processados a base da alimentação: arroz, feijão, carnes, ovos, leite, frutas, verduras e legumes.',
      'Use óleos, sal e açúcar em pequenas quantidades ao cozinhar.',
      'Limite alimentos processados (queijos, pães, conservas) e evite ultraprocessados (refrigerantes, biscoitos recheados, salgadinhos, embutidos, macarrão instantâneo).',
      'Coma com regularidade e atenção, de preferência sentado à mesa e sem telas.',
    ]),
    h('h3', { class: 'orient-t', text: 'O prato do almoço e do jantar' }),
    lista([
      'Metade do prato: salada e legumes variados.',
      'Um quarto: arroz, macarrão, batata ou mandioca.',
      'Um quarto: carne, frango, peixe ou ovos (ou tofu, soja e grão-de-bico).',
      'Feijão, lentilha ou outra leguminosa todos os dias.',
      'Uma fruta de sobremesa no lugar de doce.',
    ]),
    ...(r.modo !== 'educativo' ? [h('h3', { class: 'orient-t', text: 'Como acompanhar o resultado' }), lista([
      'Pese-se pelo menos uma vez por semana, de preferência ao acordar, e olhe a tendência: o peso oscila de um dia para o outro.',
      'Mantenha a mesma meta por pelo menos 2 a 3 semanas antes de mudar (o peso fica na tela Evolução).',
    ])] : []),
  ]));
  if (c) mais.push(acc('Preços dos alimentos', ['$ barato · $$ médio · $$$ caro, ao lado de cada alimento do cardápio. O preço varia com a região e a época. Para o cardápio preferir os mais baratos, toque em “Tenho em casa”.']));
  mais.push(blocoSuplementos(r));
  // perguntas frequentes (sem o título próprio: o resumo da seção já diz o que é)
  const faq = faqBlock(FAQ_NUTRI, 'Perguntas frequentes', 'Ex.: proteína, jejum, pré-treino, creatina');
  if (faq.firstChild && faq.firstChild.tagName === 'H2') faq.removeChild(faq.firstChild);
  const perguntas = acc('Perguntas frequentes', [faq]);
  perguntas.id = 'perguntas-frequentes';
  mais.push(perguntas);
  const fontes = [h('p', { class: 'small', text: 'Valores dos alimentos: tabelas TACO, TBCA e USDA. Medidas caseiras aproximadas.' }), h('p', { class: 'ref', text: '• Guia Alimentar para a População Brasileira (Ministério da Saúde, 2014).' })];
  if (c && modoDoDiario(r, state) !== 'alimentos') fontes.push(fontesDoDiario());
  mais.push(acc('Fontes', fontes));
  const saiba = h('details', { class: 'acc', id: 'saiba-mais' }, h('summary', { text: 'Saiba mais (como comer bem, preços, perguntas, fontes)' }), h('div', { class: 'col gap-s' }, ...mais));
  body.push(saiba);
  body.push(btn('Refazer a entrevista', () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); }, 'block ghost', 'edit'));
  // o aviso educativo, uma vez só, no rodapé
  body.push(h('p', { class: 'tiny muted center', id: 'aviso-educativo', text: 'Nutricionista virtual: orientação educativa. O cardápio é um exemplo, não dieta prescrita, e não substitui o nutricionista.' }));
  return body;
}

// Abre a entrevista da Nutrição vindo do chat (views/chat.js, "Refazer a entrevista")
export function abrirEntrevistaNutri() { modo = 'entrevista'; go('nutricao'); window.scrollTo(0, 0); }
export function nutritionView() {
  const a = state.nutri.answers;
  if (modo === 'entrevista' || !respostasCompletas(a)) {
    if (modo !== 'entrevista' && !Object.keys(a).length) {
      return {
        title: 'Nutrição',
        body: [cabecalho(),
          h('div', { class: 'bubble' }, h('p', { text: 'Olá! Eu ajudo você a comer de acordo com o seu objetivo.' }), h('p', { class: 'small muted', text: `São até ${PERGUNTAS.length} perguntas rápidas. Você recebe metas, o que comer em volta do treino e um cardápio de exemplo. As respostas ficam só neste aparelho.` })),
          btn('Começar', () => { modo = 'entrevista'; refresh(); }, 'primary lg block', 'play'),
          ...blocoDiario(null, { aoResponder: () => { modo = 'entrevista'; refresh(); } }),
          h('div', { class: 'mt' }), faqBlock(FAQ_NUTRI, 'Pergunte à Nutricionista', 'Ex.: proteína, jejum, pré-treino, creatina')],
      };
    }
    // aproveita o que já foi respondido ao Treinador
    const pre = { ...a };
    const t = state.trainer.answers;
    for (const k of ['idade', 'peso', 'altura']) if (pre[k] == null && typeof t[k] === 'number') pre[k] = t[k];
    if (pre.treinos == null && t.dias) pre.treinos = { 2: '2', 3: '3', 4: '4', 5: '4', 6: '6' }[t.dias] || '3';
    // o objetivo começa igual ao do treino (o usuário pode trocar)
    if (pre.objetivo == null && nutriPara(t.objetivo)) pre.objetivo = nutriPara(t.objetivo);
    return {
      title: 'Nutrição', body: [interview({
        perguntas: PERGUNTAS, respostas: pre, avatar: 'apple', nutri: true, notas: { objetivo: notaObjetivo('nutri') },
        onDone: (r) => { update((s) => { s.nutri.answers = r; s.nutri.calculadoEm = new Date().toISOString(); }); modo = 'auto'; refresh(); window.scrollTo(0, 0); conferirObjetivos('nutri'); },
        onCancel: () => { modo = 'auto'; refresh(); },
      })],
    };
  }
  // dúvida do dia a dia: o chat da Nutricionista (views/chat.js) na barra do topo, para o cardápio continuar na 1ª tela
  return { title: 'Nutrição', actions: [botaoChat('nutri', 'Perguntar', 'sm plain')], body: resultado() };
}

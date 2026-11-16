// Tela da Nutricionista virtual.
import { h, btn, chip, seg, sheet, icon, note, sectionTitle, toast, norm, fmtInt, dateKey, DIAS_LONGO } from '../ui.js';
import { state, update, activePlan } from '../store.js';
import { refresh } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { FAQ_NUTRI, REFS } from '../data/knowledge.js';
import { resumoParaNutricao } from '../logic/corrida.js';
import { ALIMENTOS, CATEGORIAS_ALIMENTO, NOME_FAIXA } from '../data/foods.js';
import { PERGUNTAS, ROTULO, respostasCompletas, calcular, cardapio, proximaSemente, limparEmCasa, USADOS_EM_CASA, orientacaoCorrida, faltaDeCarboidrato, emVoltaDoTreino, imcFaixa, suplementos, textosDoPeso, contextoDasEntrevistas } from '../logic/nutrition.js';
import { interview, faqBlock, notaObjetivo, conferirObjetivos, cartaoObjetivos } from './coach.js';
import { nutriPara } from '../logic/objetivos.js';
import { blocoDiario, acoesDaRefeicao } from './diario.js';

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
// Alimentação para quem corre: o dia a dia, o treino longo e, com prova marcada, a semana e o dia da prova.
function cartaoCorrida(r) {
  const o = orientacaoCorrida(r, new Date());
  if (!o) return [];
  const out = [sectionTitle('Alimentação para a corrida')];
  const card = h('div', { class: 'card col gap-s' });
  for (const l of o.blocos[0].linhas) card.appendChild(h('p', { class: 'small', text: l }));
  out.push(card);
  if (o.prova) { const d = acc(o.prova.titulo, [lista(o.prova.linhas)]); d.open = o.prova.dias >= 0 && o.prova.dias <= 7; out.push(d); }
  for (const b of o.blocos.slice(1)) out.push(acc(b.titulo, [lista(b.linhas)]));
  const fontes = h('div', { class: 'col gap-s' });
  for (const k of o.refs) if (REFS[k]) fontes.appendChild(h('p', { class: 'ref', text: '• ' + REFS[k] }));
  out.push(acc('Fontes da orientação de corrida', [fontes]));
  return out;
}

function treinoDeHoje() {
  const plan = activePlan();
  if (!plan) return null;
  const dia = plan.dias.find((d) => d.id === plan.agenda[new Date().getDay()]);
  if (!dia) return { descanso: true };
  const series = dia.itens.reduce((n, it) => { const ex = EX_POR_ID.get(it.ex); return n + (ex && ['agachar', 'dobradica_quadril', 'afundo', 'total'].includes(ex.padrao) ? it.series : 0); }, 0);
  return { dia, forte: series >= 6 || dia.itens.length >= 8 };
}

function resultado() {
  const a = state.nutri.answers;
  // as outras entrevistas entram na conta: vale sempre a resposta mais protegida (menor de 18, gestação, doença renal...)
  const r = calcular(a, resumoDaCorrida(), contextoDasEntrevistas(state));
  const body = [cabecalho(), cartaoObjetivos()].filter(Boolean);
  for (const av of r.avisos) body.push(note(av.tipo, av.texto));

  if (r.modo !== 'educativo') {
    const obj = r.objetivoCalc;
    const peso = textosDoPeso(r);   // perda ou ganho por semana e o que fazer se o peso não mudar
    body.push(h('div', { class: 'card col' },
      h('div', { class: 'row between' }, h('h2', { text: 'Suas metas diárias' }), h('span', { class: 'badge acc', text: ROTULO.objetivo[obj] })),
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
        h('div', { class: 'row between' }, h('span', { text: 'Água (bebidas + alimentos)' }), h('span', { class: 'bold', text: `${dec(r.agua)} L · ${dec(r.aguaBebidas)} L em bebidas` })),
        h('div', { class: 'row between' }, h('span', { text: 'Proteína por refeição' }), h('span', { class: 'bold', text: `${r.protRefeicao[0]} a ${r.protRefeicao[1]} g` }))),
      peso.ritmo ? h('p', { class: 'small', text: peso.ritmo }) : null));
    const linhas = [`Você gasta cerca de ${fmtInt(r.gasto)} kcal por dia (${fmtInt(r.tmb)} em repouso). A fórmula tem margem de erro de uns 10%: acompanhe o peso por 2 a 3 semanas e ajuste.`];
    linhas.push(...peso.linhas);
    linhas.push(`Água: os ${dec(r.agua)} L somam o que você bebe e a água da comida; cerca de ${dec(r.aguaBebidas)} L vêm de água e outras bebidas. No calor e nos dias de treino você precisa de mais: beba conforme a sede e observe a urina, que deve ficar clara.`);
    linhas.push(r.imc > 25
      ? 'Proteína e água são calculadas pelo peso que você teria com IMC 25: o peso acima disso é quase todo gordura e não aumenta essas necessidades.'
      : 'Proteína: a meta por quilo depende do objetivo e de você treinar ou não. A partir dos 65 anos, nunca fica abaixo de 1,2 g por quilo.');
    linhas.push(`IMC: ${dec(r.imc)} (${imcFaixa(r.imc, r.idade)}). É só uma referência: não distingue músculo de gordura.`);
    body.push(acc('Entenda os números', linhas));
  } else {
    body.push(h('p', { class: 'small muted', text: `IMC: ${dec(r.imc)} (${imcFaixa(r.imc, r.idade)}) — só uma referência.` }));
  }

  // diário: o que a pessoa comeu de fato, comparado com a meta do dia (views/diario.js)
  body.push(...blocoDiario(r));

  // hoje
  const hoje = treinoDeHoje();
  const t = emVoltaDoTreino(r, hoje && hoje.forte);
  const tituloHoje = !hoje ? 'Em volta do treino' : hoje.descanso ? `Hoje (${DIAS_LONGO[new Date().getDay()].toLowerCase()}): descanso` : `Hoje: ${hoje.dia.nome}`;
  const cardHoje = h('div', { class: 'card col' }, h('h2', { text: tituloHoje }));
  if (hoje && hoje.descanso) {
    cardHoje.appendChild(h('p', { class: 'small', text: 'Mantenha a proteína e as refeições normais. Descanso não é dia de comer menos.' }));
  } else {
    if (hoje && hoje.dia) cardHoje.appendChild(h('p', { class: 'small muted', text: (hoje.dia.foco ? hoje.dia.foco + '. ' : '') + (hoje.forte ? 'Treino pesado de pernas ou longo: capriche no carboidrato antes.' : '') }));
    cardHoje.appendChild(h('p', { class: 'small', text: t.horario }));
    cardHoje.appendChild(h('h3', { text: 'Antes do treino (1 a 2 horas antes)' }));
    cardHoje.appendChild(h('p', { class: 'small muted', text: r.modo === 'educativo' ? 'Carboidrato de fácil digestão e um pouco de proteína. Exemplos:' : `Carboidrato de fácil digestão (cerca de ${t.carbPre} g) e um pouco de proteína. Exemplos:` }));
    cardHoje.appendChild(lista(t.pre));
    cardHoje.appendChild(h('h3', { text: 'Depois do treino (até 2 horas)' }));
    cardHoje.appendChild(h('p', { class: 'small muted', text: r.modo === 'educativo' ? 'Uma refeição com proteína e carboidrato. Exemplos:' : `Uma refeição com cerca de ${t.protPos} g de proteína e carboidrato. Exemplos:` }));
    cardHoje.appendChild(lista(t.pos));
  }
  cardHoje.appendChild(h('div', { class: 'note info' }, icon('water'), h('div', { text: t.agua })));
  body.push(cardHoje);
  body.push(...cartaoCorrida(r));

  // cardápio
  const semente = state.nutri.seed || 0;
  const emCasa = limparEmCasa(state.nutri.emCasa);
  const soCasa = state.nutri.soCasa === true && emCasa.length > 0;
  const opcoes = { emCasa: soCasa ? emCasa : null };
  const c = cardapio(r, semente, opcoes);
  if (c) {
    // "Outra sugestão" só troca a semente quando o dia seguinte tem alimentos diferentes; se não houver, avisa
    const outra = () => {
      const prox = proximaSemente(r, semente, opcoes);
      if (prox == null) { toast(soCasa ? 'Com estes alimentos não há outra combinação. Marque mais itens em casa.' : 'Não há outra combinação com as suas restrições.'); return; }
      update((s) => { s.nutri.seed = prox; }); refresh();
    };
    body.push(sectionTitle('Um dia de exemplo', btn('Outra sugestão', outra, 'sm', 'refresh')));
    body.push(seg([['comum', 'Comida comum'], ['casa', 'O que tenho em casa']], soCasa ? 'casa' : 'comum', (v) => {
      if (v === 'casa' && !emCasa.length) { escolherEmCasa(); return; }
      update((s) => { s.nutri.soCasa = v === 'casa'; s.nutri.seed = 0; }); refresh();
    }));
    if (soCasa) {
      body.push(h('div', { class: 'row between' },
        h('span', { class: 'small muted grow', text: `Montado só com os ${emCasa.length} alimentos que você marcou.` }),
        btn('Editar lista', escolherEmCasa, 'ghost sm', 'edit')));
      // o que falta para o dia fechar, com a opção mais barata para completar
      if (c.faltas.length) {
        body.push(h('div', { class: 'note warn' }, icon('warn'), h('div', { class: 'col gap-s' },
          h('div', { class: 'bold', text: c.faltas.length === 1 ? 'Falta um item para fechar o dia' : 'O que falta para fechar o dia' }),
          lista(c.faltas.map((f) => f.texto + (f.sugestoes.length ? ' Mais barato: ' + f.sugestoes.map((s) => s.nome.split(' (')[0].toLowerCase()).join(' ou ') + '.' : ''))))));
      }
    } else {
      const barato = r.preco === 'barato';
      body.push(h('div', { class: 'row between' },
        h('span', { class: 'tiny muted grow', text: 'Exemplo, não dieta prescrita. $ barato · $$ médio · $$$ caro: o preço varia com a região e a época.' }),
        chipPequeno('Mais baratos', barato, () => { update((s) => { s.nutri.answers.preco = barato ? 'tanto_faz' : 'barato'; }); refresh(); })));
    }
    if (!c.refeicoes.length) body.push(h('p', { class: 'small muted', text: 'Com o que está marcado não dá para montar uma refeição. Marque mais alimentos.' }));
    for (const ref of c.refeicoes) {
      const inner = h('div');
      for (const it of ref.itens) inner.appendChild(h('div', { class: 'kv' }, h('span', null, it.nome, cifroes(it.faixa)), h('span', { class: 'small muted', text: it.medida })));
      body.push(h('details', { class: 'acc refeicao' },
        h('summary', null, h('div', { class: 'grow' }, h('div', { text: ref.nome }), h('div', { class: 'tiny muted resumo', text: ref.itens.map((it) => it.nome.split(' (')[0].split(',')[0]).join(', ') })), h('span', { class: 'small muted nowrap', text: `${fmtInt(ref.kcal)} kcal · ${Math.round(ref.p)} g` })),
        inner));
      // "Comi isso" copia a refeição para o diário de hoje; "Comi outra coisa" abre a escolha de alimentos
      body.push(acoesDaRefeicao(ref));
    }
    if (c.refeicoes.length) body.push(h('div', { class: 'card col gap-s' }, h('h3', { text: 'Total do dia de exemplo' }),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Calorias' }), h('span', { text: `${fmtInt(c.kcal)} kcal (meta ${fmtInt(r.kcal)})` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Proteína' }), h('span', { text: `${Math.round(c.p)} g (meta ${r.prot})` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Carboidrato' }), h('span', { text: r.corrida ? `${Math.round(c.c)} g (meta ${r.carb})` : `${Math.round(c.c)} g` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Gordura' }), h('span', { text: `${Math.round(c.g)} g` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Fibras' }), h('span', { text: `${Math.round(c.fibra)} g` })),
      faltaDeCarboidrato(r, c) ? h('p', { class: 'small', text: faltaDeCarboidrato(r, c) }) : null,
      h('p', { class: 'tiny muted', text: 'Valores das tabelas TACO, TBCA e USDA. Medidas caseiras aproximadas.' })));
  }

  // orientações gerais
  body.push(sectionTitle('Como comer bem'));
  body.push(acc('A base: comida de verdade', [lista([
    'Faça de alimentos in natura ou minimamente processados a base da alimentação: arroz, feijão, carnes, ovos, leite, frutas, verduras e legumes.',
    'Use óleos, sal e açúcar em pequenas quantidades ao cozinhar.',
    'Limite alimentos processados (queijos, pães, conservas) e evite ultraprocessados (refrigerantes, biscoitos recheados, salgadinhos, embutidos, macarrão instantâneo).',
    'Coma com regularidade e atenção, de preferência sentado à mesa e sem telas.',
  ]), h('p', { class: 'ref', text: 'Fonte: Guia Alimentar para a População Brasileira (Ministério da Saúde, 2014).' })]));
  body.push(acc('Monte o prato do almoço e do jantar', [lista([
    'Metade do prato: salada e legumes variados.',
    'Um quarto: arroz, macarrão, batata ou mandioca.',
    'Um quarto: carne, frango, peixe ou ovos (ou tofu, soja e grão-de-bico).',
    'Feijão, lentilha ou outra leguminosa todos os dias.',
    'Uma fruta de sobremesa no lugar de doce.',
  ])]));
  if (r.modo !== 'educativo') {
    body.push(acc('Como acompanhar o resultado', [lista([
      'Pese-se 1 a 3 vezes por semana, ao acordar, e olhe a média — o peso oscila de um dia para o outro.',
      'Mantenha a mesma meta por pelo menos 2 a 3 semanas antes de mudar.',
      'Registre o peso na tela Evolução para ver a tendência.',
    ])]));
  }
  const sup = suplementos(r);
  body.push(acc('Suplementos: o que a ciência diz', [
    h('p', { text: sup.intro }),
    ...(sup.linhas.length ? [lista(sup.linhas)] : []),
    h('div', { class: 'note warn' }, icon('warn'), h('div', { text: sup.aviso })),
    h('p', { class: 'ref', text: 'Fontes: posicionamentos da International Society of Sports Nutrition sobre creatina (2017), cafeína (2021) e proteína (2017); EFSA (2015).' }),
  ]));
  body.push(faqBlock(FAQ_NUTRI, 'Pergunte à Nutricionista', 'Ex.: proteína, jejum, pré-treino, creatina'));
  body.push(btn('Refazer a entrevista', () => { modo = 'entrevista'; refresh(); window.scrollTo(0, 0); }, 'block ghost', 'edit'));
  return body;
}

export function nutritionView() {
  const a = state.nutri.answers;
  if (modo === 'entrevista' || !respostasCompletas(a)) {
    if (modo !== 'entrevista' && !Object.keys(a).length) {
      return {
        title: 'Nutrição',
        body: [cabecalho(),
          h('div', { class: 'bubble' }, h('p', { text: 'Olá! Eu ajudo você a comer de acordo com o seu objetivo.' }), h('p', { class: 'small muted', text: `São ${PERGUNTAS.length} perguntas rápidas. Você recebe metas, o que comer em volta do treino e um cardápio de exemplo. As respostas ficam só neste aparelho.` })),
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
  return { title: 'Nutrição', body: resultado() };
}

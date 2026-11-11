// Tela da Nutricionista virtual.
import { h, btn, icon, note, sectionTitle, fmtInt, DIAS_LONGO } from '../ui.js';
import { state, update, activePlan } from '../store.js';
import { refresh } from '../router.js';
import { EX_POR_ID } from '../data/exercises.js';
import { FAQ_NUTRI } from '../data/knowledge.js';
import { PERGUNTAS, ROTULO, respostasCompletas, calcular, cardapio, emVoltaDoTreino, imcFaixa } from '../logic/nutrition.js';
import { interview, faqBlock, notaObjetivo, conferirObjetivos, cartaoObjetivos } from './coach.js';
import { nutriPara } from '../logic/objetivos.js';

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
  const r = calcular(a);
  const body = [cabecalho(), cartaoObjetivos()].filter(Boolean);
  for (const av of r.avisos) body.push(note(av.tipo, av.texto));

  if (r.modo !== 'educativo') {
    const obj = r.objetivoCalc;
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
        h('div', { class: 'row between' }, h('span', { text: 'Proteína por refeição' }), h('span', { class: 'bold', text: `${r.protRefeicao[0]} a ${r.protRefeicao[1]} g` }))),
      r.ritmo ? h('p', { class: 'small', text: `Ritmo ${obj === 'emagrecer' ? 'saudável: perder' : 'esperado: ganhar'} de ${dec(r.ritmo[0])} a ${dec(r.ritmo[1])} kg por semana.` }) : null));
    const linhas = [`Você gasta cerca de ${fmtInt(r.gasto)} kcal por dia (${fmtInt(r.tmb)} em repouso). A fórmula tem margem de erro de uns 10%: acompanhe o peso por 2 a 3 semanas e ajuste.`];
    if (r.ritmo) linhas.push(obj === 'emagrecer'
      ? 'Se estiver perdendo peso mais rápido que o ritmo saudável, coma um pouco mais. Se o peso não mudar em 3 semanas, reduza de 100 a 200 kcal, sem ficar abaixo de 1.200 kcal (mulheres) ou 1.500 kcal (homens).'
      : 'Ganhar mais rápido que o ritmo esperado costuma ser gordura. Se o peso não subir em 3 semanas, aumente de 100 a 200 kcal.');
    linhas.push(`IMC: ${dec(r.imc)} (${imcFaixa(r.imc, r.idade)}). É só uma referência: não distingue músculo de gordura.`);
    body.push(acc('Entenda os números', linhas));
  } else {
    body.push(h('p', { class: 'small muted', text: `IMC: ${dec(r.imc)} (${imcFaixa(r.imc, r.idade)}) — só uma referência.` }));
  }

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

  // cardápio
  const c = cardapio(r, state.nutri.seed || 0);
  if (c) {
    body.push(sectionTitle('Um dia de exemplo', btn('Outra sugestão', () => { update((s) => { s.nutri.seed = ((s.nutri.seed || 0) + 1) % 1000; }); refresh(); }, 'sm', 'refresh')));
    body.push(h('p', { class: 'small muted', text: 'Exemplo com comida comum, não uma dieta prescrita. Toque numa refeição para ver as quantidades.' }));
    for (const ref of c.refeicoes) {
      const inner = h('div');
      for (const it of ref.itens) inner.appendChild(h('div', { class: 'kv' }, h('span', { text: it.nome }), h('span', { class: 'small muted', text: it.medida })));
      body.push(h('details', { class: 'acc refeicao' },
        h('summary', null, h('div', { class: 'grow' }, h('div', { text: ref.nome }), h('div', { class: 'tiny muted resumo', text: ref.itens.map((it) => it.nome.split(' (')[0].split(',')[0]).join(', ') })), h('span', { class: 'small muted nowrap', text: `${fmtInt(ref.kcal)} kcal · ${Math.round(ref.p)} g` })),
        inner));
    }
    body.push(h('div', { class: 'card col gap-s' }, h('h3', { text: 'Total do dia de exemplo' }),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Calorias' }), h('span', { text: `${fmtInt(c.kcal)} kcal (meta ${fmtInt(r.kcal)})` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Proteína' }), h('span', { text: `${Math.round(c.p)} g (meta ${r.prot})` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Carboidrato' }), h('span', { text: `${Math.round(c.c)} g` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Gordura' }), h('span', { text: `${Math.round(c.g)} g` })),
      h('div', { class: 'kv' }, h('span', { class: 'muted', text: 'Fibras' }), h('span', { text: `${Math.round(c.fibra)} g` })),
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
  body.push(acc('Suplementos: o que a ciência diz', [
    h('p', { text: 'Suplemento não é obrigatório. Os que têm boa evidência para quem treina são:' }),
    lista([
      'Creatina monoidratada: 3 a 5 g por dia, todos os dias. Melhora força e ganho de massa.',
      'Cafeína: cerca de 3 mg por quilo de peso (até 200 mg por vez), 1 hora antes do treino, sem passar de 400 mg por dia. Evite à noite.',
      'Whey protein: só uma forma prática de proteína; conta na meta do dia.',
    ]),
    h('div', { class: 'note warn' }, icon('warn'), h('div', { text: 'Não use sem orientação médica se você está grávida ou amamentando, tem menos de 18 anos, doença nos rins ou no fígado, pressão alta ou arritmia, ou usa remédios de uso contínuo. Este aplicativo não prescreve suplementos.' })),
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

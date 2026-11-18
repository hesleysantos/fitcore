// Diário alimentar na tela: "O que comi hoje" (bloco da Nutrição) e "Comi isso" / "Comi outra coisa" no cardápio de
// exemplo. As contas e a validação ficam em logic/diario.js (o Início usa resumoDeHoje(), de lá).
// Nenhum texto digitado vira HTML: tudo passa por h() (textContent), e o que é gravado passa por gravarItem().
import { h, btn, iconBtn, icon, seg, sheet, confirmSheet, stepper, toast, note, fmtInt, fmtDate, dateKey } from '../ui.js';
import { state, update } from '../store.js';
import { refresh } from '../router.js';
import { ALIMENTOS, alergenosDe, NOME_ALERGIA } from '../data/foods.js';
import { REFS } from '../data/knowledge.js';
import { medida } from '../logic/nutrition.js';
import {
  REFEICOES, G_MIN, G_MAX, KCAL_MAX, PROT_MAX, NOME_MAX, MAX_ITENS_DIA, AVISO_DO_REGISTRO, REFS_DO_DIARIO,
  itensDoDia, gravarItem, apagarItem, copiarRefeicao, marcarDaSugestao, desmarcarRefeicao, estadoDaSugestao, idDaRefeicao, nutrientesDoItem, totaisDoDia,
  modoDoDiario, compararComMeta, resumoDaSemana, metaDoDia, somarDias, primeiroDiaDoDiario, lerCalorias, lerProteina, buscarAlimentos, gravarVarios,
  SUPLEMENTOS, MAX_SUP_DIA, SUP_NOME_MAX, SUP_P_MAX, SUP_KCAL_MAX, supDoDia, gravarSup, apagarSup, ultimoSup, textoDoSup,
} from '../logic/diario.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));
const dec = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const diaMes = (data) => `${Number(data.slice(8, 10))}/${data.slice(5, 7)}`;
const nomeDoDia = (data, hoje) => (data === hoje ? 'Hoje' : data === somarDias(hoje, -1) ? 'Ontem' : fmtDate(data + 'T12:00:00'));
// refeição mais provável pela hora do relógio (só para já vir marcada; a pessoa troca)
export const refeicaoDaHora = () => { const hr = new Date().getHours(); return hr < 10 ? 'cafe' : hr < 12 ? 'lanche-manha' : hr < 15 ? 'almoco' : hr < 18 ? 'lanche-tarde' : hr < 22 ? 'jantar' : 'ceia'; };

// dia mostrado no bloco: '' = hoje (acompanha a virada do dia)
let diaAberto = '';
const dataAberta = () => { const hoje = dateKey(); return diaAberto && diaAberto < hoje ? (diaAberto < primeiroDiaDoDiario(hoje) ? primeiroDiaDoDiario(hoje) : diaAberto) : hoje; };

// A tela pode ficar aberta de um dia para o outro. Todo toque do diário confere, na hora, se o dia ainda é o do
// desenho; se virou, avisa, redesenha (o "hoje" passa a ser o dia certo) e não abre nem grava nada.
function mesmoDia(desenhadoEm) {
  if (dateKey() === desenhadoEm) return true;
  toast('O dia mudou. Confira o dia antes de registrar.');
  refresh();
  return false;
}
function salvar(data, raw) {
  let it = null;
  update((s) => { it = gravarItem(s.diario, data, raw, dateKey()); });
  if (!it) toast(itensDoDia(state.diario, data).length >= MAX_ITENS_DIA && !raw.id ? 'Este dia já tem o máximo de alimentos.' : data < primeiroDiaDoDiario(dateKey()) ? 'Este dia é antigo demais para o diário.' : 'Confira os valores e tente de novo.');
  return it;
}

// ---------- folha: adicionar (um ou vários) ou corrigir um alimento ----------
// { data, ref, item }: `item` (do diário) abre em modo de correção, com Apagar.
// Para adicionar, a folha monta a lista "Para adicionar": busca → quantidade → "+ Acrescentar" (no rodapé) → busca o
// próximo… → "Adicionar todos (N)" grava todos de uma vez (logic/diario.js, gravarVarios: entram todos ou nenhum). Para
// um só, nada muda: escolhe, ajusta e toca em "Adicionar". Cada alimento da lista pode ser mudado (toque) ou tirado (×).
export function folhaAlimento({ data, ref, item = null }) {
  const desenhadoEm = dateKey();
  const st = {
    ref: (item && item.ref) || ref || refeicaoDaHora(),
    al: item && item.al ? item.al : '',
    porMedida: item ? item.m === true || !item.al : true,
    g: item && item.al ? item.g : 0,
    livre: !!item && !item.al,
    nome: item && !item.al ? item.nome : '', kcalTxt: item && !item.al ? String(item.kcal) : '', pTxt: item && !item.al && item.p != null ? String(item.p).replace('.', ',') : '',
  };
  const fila = [];   // "Para adicionar": { al, g, m } ou { nome, kcal, p } (a refeição é a da folha, na hora de gravar)
  const corpo = h('div', { class: 'col' });
  const selRef = h('select', { class: 'input', 'aria-label': 'Refeição', onChange: (e) => { st.ref = e.target.value; } },
    ...Object.entries(REFEICOES).map(([k, nome]) => h('option', { value: k, selected: k === st.ref, text: nome })));
  // menores de 18 anos (em qualquer entrevista): a folha não mostra nem pede calorias
  const mostraKcal = modoDoDiario(metaDoDia(state, desenhadoEm), state) !== 'alimentos';

  // busca no catálogo (logic/diario.js, buscarAlimentos): sem acento nem pontuação, pelo começo das palavras, 2 letras ou mais
  const resultados = h('div', { class: 'list', id: 'diario-resultados' });
  const buscar = (termo) => {
    while (resultados.firstChild) resultados.removeChild(resultados.firstChild);
    if (String(termo).replace(/[^0-9A-Za-zÀ-ÿ]/g, '').length < 2) { resultados.appendChild(h('p', { class: 'small muted', text: fila.length ? 'Busque o próximo alimento.' : 'Digite pelo menos 2 letras do nome do alimento.' })); return; }
    const achados = buscarAlimentos(termo);
    if (!achados.length) { resultados.appendChild(h('p', { class: 'small muted', text: mostraKcal ? 'Não achei esse alimento. Toque em “Não achei na lista” para informar as calorias.' : 'Não achei esse alimento. Toque em “Não achei na lista” para escrever o nome.' })); return; }
    // alergia informada à Nutricionista: o alimento continua na busca (a pessoa pode ter comido), mas com aviso
    const minhas = Array.isArray(state.nutri.answers.alergias) ? state.nutri.answers.alergias : [];
    for (const f of achados) {
      const tem = alergenosDe(f.id).filter((x) => minhas.includes(x));
      resultados.appendChild(h('button', { type: 'button', class: 'item diario-achado', dataset: { al: f.id }, onClick: () => { st.al = f.id; st.livre = false; st.g = f.porcao.g; st.porMedida = true; desenha(); } },
        h('div', { class: 'grow' }, h('div', { class: 't', text: f.nome }), h('div', { class: 's', text: `${f.porcao.desc} · ${f.porcao.g} g` }),
          tem.length ? h('div', { class: 's danger', text: `Costuma ter ${tem.map((x) => NOME_ALERGIA[x]).join(' e ')}: você informou alergia` }) : null),
        mostraKcal ? h('span', { class: 'small bold nowrap', text: `${fmtInt((f.kcal * f.porcao.g) / 100)} kcal` }) : null));
    }
  };
  const campoBusca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar alimento (ex.: arroz, coxinha)', 'aria-label': 'Buscar alimento', autocomplete: 'off', maxlength: 40, onInput: (e) => buscar(e.target.value) });

  // o alimento em andamento (escolhido na busca ou escrito à mão): { raw } pronto para gravar, { erro } ou {} (nenhum)
  function atual() {
    if (st.livre) {
      if (!st.nome.trim()) return { erro: 'Escreva o nome do alimento.' };
      if (!mostraKcal) return { raw: { nome: st.nome, kcal: item && !item.al ? item.kcal : 0, p: item && !item.al ? item.p : null } };
      // calorias: só número inteiro ("1.200" e "1 200" valem 1200); o que for ambíguo é recusado, com aviso
      const kcal = lerCalorias(st.kcalTxt);
      if (kcal == null) return { erro: st.kcalTxt.trim() ? 'Digite as calorias em número inteiro, sem vírgula (ex.: 1200).' : 'Informe as calorias.' };
      if (kcal > KCAL_MAX) return { erro: `As calorias de um alimento vão de 0 a ${fmtInt(KCAL_MAX)}.` };
      const p = st.pTxt.trim() ? lerProteina(st.pTxt) : null;
      if (st.pTxt.trim() && (p == null || p > PROT_MAX)) return { erro: `Digite a proteína em gramas, de 0 a ${PROT_MAX} (ex.: 12 ou 4,5).` };
      return { raw: { nome: st.nome, kcal, p } };
    }
    return st.al && FOOD.has(st.al) ? { raw: { al: st.al, g: st.g, m: st.porMedida } } : {};
  }
  const limparAtual = () => { st.al = ''; st.livre = false; st.nome = ''; st.kcalTxt = ''; st.pTxt = ''; st.g = 0; st.porMedida = true; };
  const carregar = (x) => {
    limparAtual();
    if (x.al) { st.al = x.al; st.g = x.g; st.porMedida = x.m === true; } else { st.livre = true; st.nome = x.nome; st.kcalTxt = String(x.kcal); st.pTxt = x.p != null ? String(x.p).replace('.', ',') : ''; }
  };
  const acrescentar = () => {
    const a = atual();
    if (a.erro) { toast(a.erro); return; }
    if (!a.raw) { toast('Escolha um alimento na busca.'); return; }
    if (itensDoDia(state.diario, data).length + fila.length + 1 > MAX_ITENS_DIA) { toast('Este dia já tem o máximo de alimentos.'); return; }
    fila.push(a.raw);
    limparAtual(); campoBusca.value = '';
    desenha();
    try { campoBusca.focus({ preventScroll: true }); } catch { /* sem foco */ }
  };

  // "Para adicionar": nome, medida e calorias de cada um, o total; tocar muda, × tira
  function blocoFila() {
    if (!fila.length) return null;
    const linhas = fila.map((x) => nutrientesDoItem({ ...x, id: 'i1', ref: st.ref }));
    const total = linhas.reduce((s, x) => s + x.kcal, 0);
    const lista = h('div', { class: 'list' });
    linhas.forEach((x, i) => {
      lista.appendChild(h('div', { class: 'item fila-item', dataset: { al: fila[i].al || '' } },
        h('button', { type: 'button', class: 'grow fila-mudar', 'aria-label': `Mudar ${x.nome}`, title: 'Mudar a quantidade', onClick: () => {
          // o que estava escolhido (válido) vai para a lista antes, para não se perder
          const a = atual(); const [y] = fila.splice(i, 1);
          if (a.raw) fila.push(a.raw);
          carregar(y); desenha();
        } },
          h('div', { class: 't', text: x.nome }), h('div', { class: 's', text: x.livre ? 'fora da lista' : x.medida })),
        mostraKcal ? h('span', { class: 'small bold nowrap', text: `${fmtInt(x.kcal)} kcal` }) : null,
        iconBtn('close', `Tirar ${x.nome}`, () => { fila.splice(i, 1); desenha(); })));
    });
    return h('div', { class: 'col gap-s fila', id: 'diario-fila' },
      h('div', { class: 'row between' }, h('span', { class: 'fila-rot', text: `Para adicionar (${fila.length})` }),
        mostraKcal ? h('span', { class: 'small bold nowrap', id: 'diario-fila-total', text: `Total ${fmtInt(total)} kcal` }) : null),
      lista);
  }

  function quantidade(f) {
    const saida = h('p', { class: 'bold', id: 'diario-conta' });
    const conta = () => { saida.textContent = mostraKcal ? `${medida(f, st.g)} · ${fmtInt((f.kcal * st.g) / 100)} kcal · ${dec((f.p * st.g) / 100)} g de proteína` : medida(f, st.g); };
    const passo = st.porMedida
      ? stepper({ value: Math.max(0.5, Math.round((st.g / f.porcao.g) * 2) / 2), min: 0.5, max: Math.max(0.5, Math.floor((G_MAX / f.porcao.g) * 2) / 2), step: 0.5, decimals: 1, label: 'Quantidade em porções', onChange: (q) => { st.g = Math.min(G_MAX, Math.max(G_MIN, Math.round(q * f.porcao.g))); conta(); } })
      : stepper({ value: st.g, min: G_MIN, max: G_MAX, step: 10, label: 'Quantidade em gramas', onChange: (g) => { st.g = Math.round(g); conta(); } });
    if (st.porMedida) st.g = Math.min(G_MAX, Math.max(G_MIN, Math.round(Math.max(0.5, Math.round((st.g / f.porcao.g) * 2) / 2) * f.porcao.g)));
    conta();
    return h('div', { class: 'col', id: 'diario-quantidade' },
      h('div', { class: 'row between' }, h('h3', { text: f.nome }), btn('Trocar', () => { st.al = ''; desenha(); }, 'sm ghost')),
      seg([['m', 'Medida caseira'], ['g', 'Gramas']], st.porMedida ? 'm' : 'g', (v) => { st.porMedida = v === 'm'; desenha(); }),
      h('p', { class: 'small muted', text: st.porMedida ? `1 porção = ${f.porcao.desc} (${f.porcao.g} g). Passo de meia porção.` : 'Passo de 10 g. Você também pode digitar o número.' }),
      h('div', { class: 'center' }, passo), saida);
  }
  function foraDaLista() {
    const campo = (rotulo, props) => h('label', { class: 'field' }, h('span', { text: rotulo }), h('input', { class: 'input', autocomplete: 'off', ...props }));
    return h('div', { class: 'col', id: 'diario-livre' },
      h('div', { class: 'row between' }, h('h3', { text: 'Alimento que não está na lista' }), btn('Buscar na lista', () => { st.livre = false; desenha(); }, 'sm ghost')),
      h('p', { class: 'small muted', text: mostraKcal ? 'Escreva o nome e as calorias do rótulo ou da receita, em número inteiro. A proteína é opcional.' : 'Escreva o nome do alimento.' }),
      campo('Nome', { type: 'text', maxlength: NOME_MAX, value: st.nome, placeholder: 'Ex.: bolo de cenoura', 'aria-label': 'Nome do alimento', onInput: (e) => { st.nome = e.target.value; } }),
      // menores de 18 anos: só o nome (o registro fica sem calorias)
      mostraKcal ? campo('Calorias (kcal)', { type: 'text', inputmode: 'numeric', maxlength: 7, value: st.kcalTxt, placeholder: 'Ex.: 1200', 'aria-label': 'Calorias', onInput: (e) => { st.kcalTxt = e.target.value; } }) : null,
      mostraKcal ? campo('Proteína em gramas (opcional)', { type: 'text', inputmode: 'decimal', maxlength: 5, value: st.pTxt, 'aria-label': 'Proteína em gramas', onInput: (e) => { st.pTxt = e.target.value; } }) : null);
  }
  function rodape() {
    if (!f || !f.footer) return;
    while (f.footer.firstChild) f.footer.removeChild(f.footer.firstChild);
    if (item) { f.footer.append(btn('Apagar', apagar, 'ghost danger'), btn('Salvar', gravar, 'primary grow')); return; }
    // com um alimento escolhido: "+ Acrescentar" (vai para a lista e volta à busca) e "Adicionar" (grava já, com a lista)
    const escolhido = !!(st.al || st.livre);
    const n = fila.length + (escolhido ? 1 : 0);
    f.footer.append(escolhido ? btn('Acrescentar', acrescentar, 'ghost acrescentar', 'plus') : btn('Cancelar', () => f.close(), 'ghost'),
      btn(n > 1 ? `Adicionar todos (${n})` : 'Adicionar', gravar, 'primary adicionar-todos'));
  }
  function desenha() {
    while (corpo.firstChild) corpo.removeChild(corpo.firstChild);
    corpo.appendChild(h('label', { class: 'field' }, h('span', { text: 'Refeição' }), selRef));
    const fl = item ? null : blocoFila();
    if (fl) corpo.appendChild(fl);
    if (st.livre) corpo.appendChild(foraDaLista());
    else if (st.al && FOOD.has(st.al)) corpo.appendChild(quantidade(FOOD.get(st.al)));
    else {
      corpo.appendChild(h('div', { class: 'search' }, icon('search'), campoBusca));
      corpo.appendChild(resultados);
      corpo.appendChild(btn('Não achei na lista', () => { st.livre = true; st.al = ''; if (!st.nome) st.nome = campoBusca.value.trim().slice(0, NOME_MAX); desenha(); }, 'block ghost', 'plus'));
      buscar(campoBusca.value);
    }
    rodape();
  }
  function gravar() {
    // o dia virou com a folha aberta ("hoje" e "ontem" já são outros): avisa, redesenha e não grava
    if (!mesmoDia(desenhadoEm)) { f.close(); return; }
    const a = atual();
    if (a.erro) { toast(a.erro); return; }
    const lista = [...fila, ...(a.raw ? [a.raw] : [])].map((x) => ({ ...x, ref: st.ref }));
    if (!lista.length) { toast('Escolha um alimento na busca.'); return; }
    if (item || lista.length === 1) {
      const raw = lista[0];
      if (item) raw.id = item.id;
      // corrigir a quantidade de um alimento marcado na sugestão não muda de onde ele veio
      if (item && item.s && raw.al === item.al) raw.s = true;
      if (salvar(data, raw)) { f.close(); redesenharNoLugar(seletorDoCartao(st.ref)); }
      return;
    }
    let n = 0;
    update((s) => { n = gravarVarios(s.diario, data, lista, dateKey()); });
    if (!n) { toast(itensDoDia(state.diario, data).length + lista.length > MAX_ITENS_DIA ? 'Não cabem todos: o dia tem no máximo ' + MAX_ITENS_DIA + ' alimentos.' : 'Confira os valores e tente de novo.'); return; }
    toast(`${n} alimentos adicionados em ${REFEICOES[st.ref]}.`);
    f.close(); redesenharNoLugar(seletorDoCartao(st.ref));
  }
  async function apagar() {
    const x = nutrientesDoItem(item);
    const sim = await confirmSheet({ title: 'Apagar este alimento?', text: `${x.nome}${x.medida ? ', ' + x.medida : ''}. Não dá para desfazer.`, okLabel: 'Apagar', danger: true });
    if (!sim) return;
    update((s) => { apagarItem(s.diario, data, item.id); });
    f.close(); redesenharNoLugar(seletorDoCartao(item.ref));
  }
  let f = null;
  f = sheet({ title: item ? 'Corrigir alimento' : `Adicionar alimento · ${nomeDoDia(data, desenhadoEm).toLowerCase()}`, full: true, body: corpo, footer: [] });
  desenha();
  return f;
}

// ---------- cardápio de exemplo: "Comi" em cada alimento, "Comi tudo isso" e "Comi outra coisa" ----------
// `refeicao` é uma refeição do cardápio ({ nome, itens: [{ id, g }] }). Os botões valem para o dia de hoje.
// O que conta é o que a pessoa comeu: os alimentos da sugestão que ela marcou + os que adicionou à mão (logic/diario.js).
// O botão que marca a sugestão inteira fica sempre junto da sugestão visível — nunca embaixo do que a pessoa já comeu,
// onde o antigo "Comi isso" parecia confirmar o alimento digitado e somava a refeição sugerida inteira.
// Redesenha a tela sem tirar do lugar o que a pessoa tocou: o elemento `sel` fica na mesma altura da tela depois do
// redesenho (o "Você comeu" que cresce acima dele não o empurra para baixo). Sem o elemento, só redesenha.
export function redesenharNoLugar(sel) {
  const antes = document.querySelector(sel);
  const y0 = antes ? antes.getBoundingClientRect().top : null;
  refresh();
  const depois = y0 == null ? null : document.querySelector(sel);
  if (depois) window.scrollBy(0, depois.getBoundingClientRect().top - y0);
}
const seletorDoCartao = (ref) => `#conteudo .refeicao[data-ref="${ref}"]`;
function comiTudo(refeicao, hoje) {
  if (!mesmoDia(hoje)) return;
  let n = 0;
  update((s) => { n = copiarRefeicao(s.diario, hoje, refeicao, hoje); });
  toast(n ? `Registrado no diário de hoje: ${refeicao.nome}${n < refeicao.itens.length ? ' (sem repetir o que já estava lá)' : ''}.` : 'Não consegui registrar esta refeição.');
  redesenharNoLugar(seletorDoCartao(idDaRefeicao(refeicao.nome)));
}
// "Comi" de um alimento da sugestão (`it` = { id, nome } do cardápio): marca ou desmarca só ele
export function botaoComiDoItem(refeicao, it, marcado) {
  const hoje = dateKey();
  const nome = String(it.nome || '').split(' (')[0];
  return h('button', {
    type: 'button', class: 'sug-marca' + (marcado ? ' on' : ''), 'aria-pressed': marcado ? 'true' : 'false',
    'aria-label': marcado ? `Comi ${nome} (toque para desmarcar)` : `Comi ${nome}`, title: marcado ? 'Marcado como comido. Toque para desmarcar.' : 'Marcar como comido',
    onClick: () => {
      if (!mesmoDia(hoje)) return;
      let r = '';
      update((s) => { r = marcarDaSugestao(s.diario, hoje, refeicao, it.id, !marcado, hoje); });
      toast(!r ? 'Não consegui registrar este alimento.' : r === 'desmarcou' ? `${nome}: desmarcado.` : r === 'ja-estava' ? `${nome} já estava em “Você comeu”.` : `${nome}: marcado como comido.`);
      redesenharNoLugar(`${seletorDoCartao(idDaRefeicao(refeicao.nome))} .itens .kv[data-al="${it.id}"] .sug-marca`);
    },
  }, icon('check', 's'), 'Comi');
}
// Embaixo da sugestão: "Comi tudo isso" ou, com a sugestão toda marcada, "Desmarcar tudo"
export function botaoDaSugestao(refeicao) {
  const hoje = dateKey();
  const ref = idDaRefeicao(refeicao.nome);
  if (estadoDaSugestao(state.diario, hoje, refeicao).toda) {
    const desfazer = () => {
      if (!mesmoDia(hoje)) return;
      let n = 0;
      update((s) => { n = desmarcarRefeicao(s.diario, hoje, refeicao); });
      toast(n ? `${refeicao.nome}: sugestão desmarcada.` : 'Nada para desmarcar.');
      redesenharNoLugar(seletorDoCartao(ref));
    };
    return h('div', { class: 'row diario-acoes-sug', dataset: { ref } }, btn('Desmarcar tudo', desfazer, 'sm ghost grow', 'close'));
  }
  return h('div', { class: 'row diario-acoes-sug', dataset: { ref } }, btn('Comi tudo isso', () => comiTudo(refeicao, hoje), 'sm grow', 'check'));
}

// ---------- diário dentro do cardápio (tela com metas e cardápio) ----------
// Cada refeição do cardápio de hoje tem, embaixo da sugestão, o "Você comeu" dela e o próprio "+ Adicionar outro
// alimento". O que foi comido num horário que não está no cardápio aparece em "Fora das refeições" (só se existir).

// botão de um alimento registrado: tocar abre a correção (e o apagar). `daSugestao`: marcado na sugestão.
function botaoDoItem(x, data, hoje, comKcal, daSugestao = false) {
  const rotulo = `Corrigir ${x.nome}`;
  const sub = x.livre ? 'fora da lista' + (comKcal && x.p != null ? ` · ${dec(x.p)} g de proteína` : '') : x.medida;
  return h('button', { type: 'button', class: 'item diario-item', dataset: { id: x.id }, 'aria-label': rotulo, title: rotulo, onClick: () => { if (mesmoDia(hoje)) folhaAlimento({ data, item: x }); } },
    h('div', { class: 'grow' }, h('div', { class: 't', text: x.nome }), h('div', { class: 's', text: sub })),
    comKcal ? h('span', { class: 'small bold nowrap', text: `${fmtInt(x.kcal)} kcal` }) : null, icon('edit', 's'));
}
// Números de hoje para o alto da tela, em poucas linhas: "896 de 1.690 kcal", proteína, barra e quanto falta.
// `r` = calcular(). Sem meta (modo 'soma'): só o total do dia. Devolve null para quem não recebe números
// (transtorno alimentar, menores de 18) e para o modo educativo sem diário.
export function resumoDoDiario(r) {
  const hoje = dateKey();
  const modo = modoDoDiario(r, state);
  if (modo === 'sem' || modo === 'alimentos') return null;
  const cmp = compararComMeta(totaisDoDia(state.diario, hoje), r, state);
  if (modo === 'soma') return h('div', { class: 'col gap-s hoje-num', id: 'diario', dataset: { dia: hoje, modo } }, h('p', { class: 'small bold', id: 'diario-frase', text: cmp.frase || 'Nada registrado hoje.' }));
  const barra = h('i', { class: 'c' });
  barra.style.width = Math.min(100, Math.max(0, cmp.pct)) + '%';
  return h('div', { class: 'col gap-s hoje-num', id: 'diario', dataset: { dia: hoje, modo } },
    h('div', { class: 'hoje-linha' },
      h('div', { class: 'hoje-kcal', id: 'diario-kcal' }, h('b', { text: fmtInt(cmp.kcal) }), ` de ${fmtInt(cmp.metaKcal)} kcal`),
      h('div', { class: 'hoje-prot', id: 'diario-prot', text: `Proteína ${cmp.prot} de ${cmp.metaProt} g` })),
    h('div', { class: 'macro', role: 'img', 'aria-label': `${cmp.pct}% da meta de calorias do dia` }, barra),
    h('p', { class: 'small' }, h('span', { class: 'bold', id: 'diario-frase', text: cmp.frase }), ' ', h('span', { id: 'diario-proteina', text: cmp.fraseProt })),
    cmp.equivale ? h('p', { class: 'tiny muted', id: 'diario-equivale', text: cmp.equivale }) : null);
}
// Uma linha para o cabeçalho do card da refeição (aberto ou recolhido): "✓ comeu 289 kcal", "comeu 274 kcal · 1 de 3
// da sugestão" ou "ainda não". Sem números para quem não recebe calorias.
export function resumoDaRefeicao(refeicao, r) {
  const hoje = dateKey();
  const comKcal = modoDoDiario(r, state) !== 'alimentos';
  const est = estadoDaSugestao(state.diario, hoje, refeicao);
  if (!est.algum) return { texto: 'ainda não', feita: false };
  const tot = totaisDoDia(state.diario, hoje).refeicoes.find((x) => x.ref === est.ref);
  const comeu = comKcal && tot ? `comeu ${fmtInt(tot.kcal)} kcal` : 'comeu';
  if (est.toda) return { texto: '✓ ' + comeu, feita: true };
  return { texto: est.marcados ? `${comeu} · ${est.marcados} de ${est.itens.length} da sugestão` : comeu, feita: false };
}
// "Você comeu" de uma refeição do cardápio de hoje: os alimentos marcados na sugestão (identificados como "da sugestão";
// a sugestão inteira vira uma linha só) e os adicionados à mão, com o subtotal e "+ Adicionar outro alimento".
// Nada aparece como se fosse contado duas vezes: o mesmo alimento só tem uma linha aqui, e é ela que soma.
export function voceComeu(refeicao, r) {
  const hoje = dateKey();
  const comKcal = modoDoDiario(r, state) !== 'alimentos';
  const est = estadoDaSugestao(state.diario, hoje, refeicao);
  const tot = totaisDoDia(state.diario, hoje).refeicoes.find((x) => x.ref === est.ref);
  const itens = tot ? tot.itens : [];
  const sugeridos = new Set(est.itens.map((x) => x.al));
  const daSug = itens.filter((x) => !x.livre && sugeridos.has(x.al));
  const aMao = itens.filter((x) => !daSug.includes(x));
  // "Você comeu" é o bloco de destaque do card (fundo próprio, título e calorias em negrito); a sugestão, acima, fica
  // mais leve. Dentro dele, "Da sugestão" e "Fora da sugestão" (o que a pessoa adicionou à mão) têm cada um o seu rótulo.
  const box = h('div', { class: 'col comido', dataset: { ref: est.ref } },
    h('div', { class: 'row between comido-hd' }, h('span', { class: 'comido-tit', text: 'Você comeu' }),
      comKcal && itens.length ? h('span', { class: 'comido-kcal nowrap', text: `${fmtInt(tot.kcal)} kcal` }) : null));
  if (!itens.length) box.appendChild(h('p', { class: 'small muted', text: 'Nada marcado ainda.' }));
  else {
    const secoes = h('div', { class: 'col diario-comido', dataset: { ref: est.ref } });
    const secao = (cls, rotulo, kcal, ...filhos) => h('div', { class: 'col gap-s comido-sec ' + cls },
      h('div', { class: 'row between comido-sub' }, h('span', { text: rotulo }), comKcal ? h('span', { class: 'nowrap', text: `${fmtInt(kcal)} kcal` }) : null), ...filhos);
    const soma = (l) => l.reduce((s, x) => s + x.kcal, 0);
    if (daSug.length) {
      const lista = h('div', { class: 'list' });
      if (est.toda && daSug.length > 1) {
        // a sugestão inteira numa linha; tocar mostra os alimentos (para corrigir a quantidade de um deles)
        lista.appendChild(h('details', { class: 'comido-grupo' },
          h('summary', null, h('span', { class: 'grow', text: `${refeicao.nome} da sugestão (${daSug.length} alimentos)` }), icon('down', 's')),
          h('div', { class: 'list' }, ...daSug.map((x) => botaoDoItem(x, hoje, hoje, comKcal, true)))));
      } else for (const x of daSug) lista.appendChild(botaoDoItem(x, hoje, hoje, comKcal, true));
      secoes.appendChild(secao('da-sug', 'Da sugestão', soma(daSug), lista));
    }
    if (aMao.length) secoes.appendChild(secao('fora-sug', 'Fora da sugestão', soma(aMao), h('div', { class: 'list' }, ...aMao.map((x) => botaoDoItem(x, hoje, hoje, comKcal)))));
    box.appendChild(secoes);
  }
  box.appendChild(btn('Adicionar outro alimento', () => { if (mesmoDia(hoje)) folhaAlimento({ data: hoje, ref: est.ref }); }, 'ghost block add-alimento', 'plus'));
  return box;
}
// Depois das refeições: o que foi comido em horários que não estão no cardápio (`refsDoCardapio` = ids das refeições
// mostradas). Só aparece se houver algo.
export function foraDasRefeicoes(r, refsDoCardapio) {
  const hoje = dateKey();
  const comKcal = modoDoDiario(r, state) !== 'alimentos';
  const fora = totaisDoDia(state.diario, hoje).refeicoes.filter((x) => !refsDoCardapio.includes(x.ref));
  if (!fora.length) return null;
  const card = h('div', { class: 'card col', id: 'diario-hoje' }, h('h3', { text: 'Fora das refeições' }));
  for (const ref of fora) {
    card.appendChild(h('div', { class: 'row between comido-rot', dataset: { ref: ref.ref } }, h('span', { text: ref.nome }), comKcal ? h('span', { class: 'nowrap', text: `${fmtInt(ref.kcal)} kcal` }) : null));
    const lista = h('div', { class: 'list' });
    for (const x of ref.itens) lista.appendChild(botaoDoItem(x, hoje, hoje, comKcal));
    card.appendChild(lista);
  }
  card.appendChild(btn('Adicionar outro alimento', () => { if (mesmoDia(hoje)) folhaAlimento({ data: hoje, ref: 'outro' }); }, 'ghost block add-alimento', 'plus'));
  return card;
}
// Carboidrato, gordura e fibras de hoje (vai para "Suas metas"), ou null sem registro / sem calorias.
export function macrosDeHoje(r) {
  const tot = totaisDoDia(state.diario, dateKey());
  if (modoDoDiario(r, state) === 'alimentos' || !tot.n) return null;
  return h('p', { class: 'small', id: 'diario-macros', text: `Hoje: carboidrato ${Math.round(tot.c)} g · gordura ${Math.round(tot.gd)} g · fibras ${Math.round(tot.fibra)} g` + (tot.livres ? ` (sem contar ${tot.livres === 1 ? '1 alimento' : tot.livres + ' alimentos'} fora da lista${tot.semProteina ? '; a proteína de ' + (tot.semProteina === 1 ? 'um deles' : tot.semProteina + ' deles') + ' não foi informada' : ''})` : '') + '.' });
}
// Fim da tela: dias anteriores (de ontem para trás), a semana e o cuidado com os números, em seções fechadas.
let diaHistorico = ''; // '' = ontem
export function historicoDoDiario(r) {
  const hoje = dateKey();
  const ontem = somarDias(hoje, -1);
  const primeiro = primeiroDiaDoDiario(hoje);
  const data = diaHistorico && diaHistorico < ontem ? (diaHistorico < primeiro ? primeiro : diaHistorico) : ontem;
  const modo = modoDoDiario(r, state);
  const comKcal = modo !== 'alimentos';
  const tot = totaisDoDia(state.diario, data);
  const cmp = compararComMeta(tot, metaDoDia(state, data) || r, state);
  const ir = (n) => { if (!mesmoDia(hoje)) return; const alvo = somarDias(data, n); diaHistorico = alvo >= ontem ? '' : alvo < primeiro ? primeiro : alvo; aberto = true; refresh(); };
  const seguinte = iconBtn('right', 'Dia seguinte', () => ir(1));
  if (data >= ontem) seguinte.disabled = true;
  const anterior = iconBtn('back', 'Dia anterior', () => ir(-1));
  if (data <= primeiro) anterior.disabled = true;
  const corpo = h('div', { class: 'col', id: 'diario-passado', dataset: { dia: data } },
    h('div', { class: 'row between' }, anterior, h('div', { class: 'bold center grow', id: 'diario-dia', text: `${nomeDoDia(data, hoje)}${data === ontem ? ', ' + diaMes(data) : ''}` }), seguinte));
  if (tot.n && cmp.frase) corpo.appendChild(h('p', { class: 'small', text: modo === 'meta' ? `${fmtInt(cmp.kcal)} de ${fmtInt(cmp.metaKcal)} kcal e ${cmp.prot} de ${cmp.metaProt} g de proteína.` : cmp.frase }));
  if (!tot.n) corpo.appendChild(h('p', { class: 'small muted', text: 'Nada registrado neste dia.' }));
  for (const ref of tot.refeicoes) {
    corpo.appendChild(h('div', { class: 'row between', dataset: { ref: ref.ref } }, h('h3', { text: ref.nome }), comKcal ? h('span', { class: 'small muted nowrap', text: `${fmtInt(ref.kcal)} kcal` }) : null));
    const lista = h('div', { class: 'list' });
    for (const x of ref.itens) lista.appendChild(botaoDoItem(x, data, hoje, comKcal));
    corpo.appendChild(lista);
  }
  corpo.appendChild(btn(`Adicionar alimento em ${diaMes(data)}`, () => { if (mesmoDia(hoje)) folhaAlimento({ data }); }, 'block alvo', 'plus'));
  const supPassado = linhaDeSuplementos(r, data);
  if (supPassado) corpo.appendChild(supPassado);
  // a semana fica dentro de "Dias anteriores" (uma seção fechada a menos no fim da tela)
  const sem = resumoDaSemana(state.diario, hoje, r, state);
  const linhas = h('div');
  for (const d of sem.dias) linhas.appendChild(h('div', { class: 'kv' }, h('span', { class: 'muted', text: nomeDoDia(d.data, hoje) }), h('span', { text: !d.n ? 'sem registro' : comKcal ? `${fmtInt(d.kcal)} kcal · ${d.p} g` : (d.n === 1 ? '1 alimento' : d.n + ' alimentos') })));
  const semana = h('details', { class: 'acc', id: 'diario-semana' }, h('summary', { text: `Últimos 7 dias · ${sem.registrados === 1 ? '1 dia registrado' : sem.registrados + ' dias registrados'}` }),
    h('div', null, sem.frase ? h('p', { class: 'small', text: sem.frase }) : null, linhas,
      comKcal ? h('p', { class: 'tiny muted', id: 'diario-aviso', text: AVISO_DO_REGISTRO }) : null));
  const dias = h('details', { class: 'acc', id: 'diario-dias', open: aberto }, h('summary', { text: 'Dias anteriores' }), h('div', { class: 'col' }, corpo, semana));
  dias.addEventListener('toggle', () => { aberto = dias.open; });
  return [dias];
}
let aberto = false;

// ---------- bloco "O que comi hoje" ----------
// fontes do diário: soltas (para a seção "Fontes" de "Saiba mais") ou numa seção própria (tela sem cardápio)
export function fontesDoDiario() {
  const box = h('div', { class: 'col gap-s' });
  for (const k of REFS_DO_DIARIO) if (REFS[k]) box.appendChild(h('p', { class: 'ref', text: '• ' + REFS[k] }));
  return box;
}
const fontes = () => h('details', { class: 'acc' }, h('summary', { text: 'Fontes do diário' }), fontesDoDiario());
// `r` = resultado de calcular() (ou null sem entrevista). `aoResponder` abre a entrevista (só aparece sem entrevista).
export function blocoDiario(r, { aoResponder = null } = {}) {
  const hoje = dateKey();
  const data = dataAberta();
  const modo = modoDoDiario(r, state);
  const titulo = h('div', { class: 'section-title' }, h('h2', { text: data === hoje ? 'O que comi hoje' : `O que comi em ${diaMes(data)}` }));
  if (modo === 'sem') {
    return [titulo, h('div', { class: 'note info', id: 'diario' }, icon('info'), h('div', { text: 'Com histórico de transtorno alimentar, contar calorias pode piorar os sintomas. Por isso este aplicativo não oferece o diário de alimentação: combine com quem acompanha você a melhor forma de registrar.' }))];
  }
  const tot = totaisDoDia(state.diario, data);
  // um dia passado é comparado com a meta DAQUELE dia (a meta muda com a semana do plano de corrida)
  const rDoDia = data === hoje || !r ? r : metaDoDia(state, data) || r;
  const cmp = compararComMeta(tot, rDoDia, state);
  const comKcal = modo !== 'alimentos';
  const card = h('div', { class: 'card col', id: 'diario', dataset: { dia: data, modo } });
  // navegação por dia
  // navegação: de hoje para trás, até o primeiro dia que o diário guarda (os botões ficam desabilitados nas pontas)
  const primeiro = primeiroDiaDoDiario(hoje);
  const ir = (n) => { if (!mesmoDia(hoje)) return; const alvo = somarDias(data, n); diaAberto = alvo >= hoje ? '' : alvo < primeiro ? primeiro : alvo; refresh(); };
  const seguinte = iconBtn('right', 'Dia seguinte', () => ir(1));
  if (data >= hoje) seguinte.disabled = true;
  const anterior = iconBtn('back', 'Dia anterior', () => ir(-1));
  if (data <= primeiro) anterior.disabled = true;
  card.appendChild(h('div', { class: 'row between' }, anterior,
    h('div', { class: 'bold center grow', id: 'diario-dia', text: `${nomeDoDia(data, hoje)}${data === hoje || data === somarDias(hoje, -1) ? ', ' + diaMes(data) : ''}` }), seguinte));
  // números do dia
  if (modo === 'meta') {
    const barra = h('i', { class: 'c' });
    barra.style.width = Math.min(100, Math.max(0, cmp.pct)) + '%';
    card.appendChild(h('div', { class: 'stats two' },
      h('div', { class: 'stat' }, h('b', { text: `${fmtInt(cmp.kcal)} / ${fmtInt(cmp.metaKcal)}` }), h('span', { text: 'kcal: comido / meta' })),
      h('div', { class: 'stat' }, h('b', { text: `${cmp.prot} / ${cmp.metaProt} g` }), h('span', { text: 'proteína: comido / meta' }))));
    card.appendChild(h('div', { class: 'macro', role: 'img', 'aria-label': `${cmp.pct}% da meta de calorias do dia` }, barra));
    card.appendChild(h('p', { class: 'bold', id: 'diario-frase', text: cmp.frase }));
    card.appendChild(h('p', { class: 'small', id: 'diario-proteina', text: cmp.fraseProt }));
    if (cmp.equivale) card.appendChild(h('p', { class: 'small muted', id: 'diario-equivale', text: cmp.equivale }));
  } else if (modo === 'soma') {
    if (cmp.frase) card.appendChild(h('p', { class: 'bold', id: 'diario-frase', text: cmp.frase }));
    card.appendChild(r
      ? h('p', { class: 'small muted', text: 'No seu caso o diário mostra só o total do dia, sem comparar com meta de calorias.' })
      : h('div', { class: 'row between' }, h('span', { class: 'small muted grow', text: 'Responda à entrevista para comparar com a sua meta do dia.' }), aoResponder ? btn('Responder', aoResponder, 'sm') : null));
  } else {
    card.appendChild(h('p', { class: 'small muted', text: 'Antes dos 18 anos o diário mostra só os alimentos, sem calorias: o que conta é o hábito, não a soma.' }));
  }
  // lista por refeição, com as calorias de cada alimento; tocar no alimento abre a correção (e o apagar)
  if (!tot.n) card.appendChild(h('p', { class: 'small muted', id: 'diario-vazio', text: data === hoje ? 'Nada registrado hoje. Adicione o que você for comendo.' : 'Nada registrado neste dia.' }));
  for (const ref of tot.refeicoes) {
    card.appendChild(h('div', { class: 'row between mt', dataset: { ref: ref.ref } }, h('h3', { text: ref.nome }), comKcal ? h('span', { class: 'small muted nowrap', text: `${fmtInt(ref.kcal)} kcal` }) : null));
    const lista = h('div', { class: 'list' });
    for (const x of ref.itens) {
      const rotulo = `Corrigir ${x.nome}`;
      lista.appendChild(h('button', { type: 'button', class: 'item diario-item', dataset: { id: x.id }, 'aria-label': rotulo, title: rotulo, onClick: () => { if (mesmoDia(hoje)) folhaAlimento({ data, item: x }); } },
        h('div', { class: 'grow' }, h('div', { class: 't', text: x.nome }), h('div', { class: 's', text: x.livre ? 'fora da lista' + (comKcal && x.p != null ? ` · ${dec(x.p)} g de proteína` : '') : x.medida })),
        comKcal ? h('span', { class: 'small bold nowrap', text: `${fmtInt(x.kcal)} kcal` }) : null, icon('edit', 's')));
    }
    card.appendChild(lista);
  }
  card.appendChild(btn('Adicionar alimento', () => { if (mesmoDia(hoje)) folhaAlimento({ data }); }, 'primary block', 'plus'));
  const supDoBloco = linhaDeSuplementos(r, data);
  if (supDoBloco) card.appendChild(supDoBloco);
  if (comKcal && tot.n) {
    card.appendChild(h('p', { class: 'small muted', id: 'diario-macros', text: `Carboidrato ${Math.round(tot.c)} g · gordura ${Math.round(tot.gd)} g · fibras ${Math.round(tot.fibra)} g` + (tot.livres ? ` (sem contar ${tot.livres === 1 ? '1 alimento' : tot.livres + ' alimentos'} fora da lista${tot.semProteina ? '; a proteína de ' + (tot.semProteina === 1 ? 'um deles' : tot.semProteina + ' deles') + ' não foi informada' : ''})` : '') + '.' }));
  }
  if (comKcal) card.appendChild(h('p', { class: 'tiny muted', id: 'diario-aviso', text: AVISO_DO_REGISTRO }));
  // semana
  const sem = resumoDaSemana(state.diario, hoje, r, state);
  const linhas = h('div');
  for (const d of sem.dias) linhas.appendChild(h('div', { class: 'kv' }, h('span', { class: 'muted', text: nomeDoDia(d.data, hoje) }), h('span', { text: !d.n ? 'sem registro' : comKcal ? `${fmtInt(d.kcal)} kcal · ${d.p} g` : (d.n === 1 ? '1 alimento' : d.n + ' alimentos') })));
  const semana = h('details', { class: 'acc', id: 'diario-semana' }, h('summary', { text: `Últimos 7 dias · ${sem.registrados === 1 ? '1 dia registrado' : sem.registrados + ' dias registrados'}` }),
    h('div', null, sem.frase ? h('p', { class: 'small', text: sem.frase }) : null, linhas));
  return [titulo, card, semana, comKcal ? fontes() : null].filter(Boolean);
}

// ---------- suplementos e vitaminas do dia (só registro: logic/diario.js, SUPLEMENTOS) ----------
// Uma linha discreta: "Suplementos e vitaminas · Creatina, Whey" (ou "nenhum hoje"); o toque abre a folha de marcar.
// Quem marcou transtorno alimentar não recebe o diário, e esta linha também não aparece.
const nomeCurtoSup = (s) => textoDoSup(s).nome.split(' (')[0];
export function linhaDeSuplementos(r, data = dateKey()) {
  if (modoDoDiario(r, state) === 'sem') return null;
  const hoje = dateKey();
  const sup = supDoDia(state.diario, data);
  const resumo = sup.length ? sup.map(nomeCurtoSup).join(', ') : data === hoje ? 'nenhum hoje' : 'nenhum';
  return h('button', { type: 'button', class: 'sup-dia', dataset: { dia: data, n: String(sup.length) }, 'aria-label': `Suplementos e vitaminas: ${resumo}. Toque para marcar.`,
    onClick: () => { if (mesmoDia(hoje)) folhaSuplementos({ data, r }); } },
  h('span', { class: 'grow sup-dia-txt' }, h('span', { class: 'sup-dia-t', text: 'Suplementos e vitaminas' }), h('span', { class: 'sup-dia-r', text: resumo })), icon('right', 's'));
}
const UN_CONTAGEM = ['dose', 'cápsula', 'comprimido'];
// quantidade digitada: número com até 2 casas, com vírgula ou ponto ("5", "2,5", "0.25"); o resto é recusado (null)
const lerQtd = (t) => (/^\d{1,6}([.,]\d{1,2})?$/.test(String(t).trim()) ? Number(String(t).trim().replace(',', '.')) : null);
export function folhaSuplementos({ data, r = null }) {
  const desenhadoEm = dateKey();
  const modo = modoDoDiario(r, state);
  const comNumeros = modo !== 'alimentos';
  const menor = modo === 'alimentos';
  const corpo = h('div', { class: 'col', id: 'sup-folha' });
  let form = null;   // null: a lista do dia; { id, tipo, qtdTxt, un, nome, pTxt, kTxt, repetiu }
  const abrir = (tipo, s = null) => {
    const S = SUPLEMENTOS[tipo];
    // um tipo novo vem com a dose que a PESSOA marcou da última vez (o app não sugere dose)
    const base = s || ultimoSup(state.diario, tipo, data);
    form = { id: s ? s.id : '', tipo, un: base && S.un.includes(base.un) ? base.un : S.un[0], nome: base && base.nome ? base.nome : '',
      qtdTxt: base ? String(base.qtd).replace('.', ',') : UN_CONTAGEM.includes(S.un[0]) ? '1' : '',
      pTxt: base && base.pDose != null ? String(base.pDose).replace('.', ',') : '', kTxt: base && base.kcalDose != null ? String(base.kcalDose) : '', repetiu: !s && !!base };
    desenha();
  };
  const campo = (rotulo, props) => h('label', { class: 'field' }, h('span', { text: rotulo }), h('input', { class: 'input', autocomplete: 'off', ...props }));
  function lista() {
    const sup = supDoDia(state.diario, data);
    if (!sup.length) corpo.appendChild(h('p', { class: 'small muted', id: 'sup-vazio', text: data === desenhadoEm ? 'Nada marcado hoje.' : 'Nada marcado neste dia.' }));
    else {
      const l = h('div', { class: 'list', id: 'sup-lista' });
      for (const s of sup) {
        const t = textoDoSup(s, comNumeros);
        l.appendChild(h('div', { class: 'item sup-item', dataset: { id: s.id, tipo: s.tipo } },
          h('button', { type: 'button', class: 'grow fila-mudar', 'aria-label': `Corrigir ${t.nome}`, onClick: () => abrir(s.tipo, s) }, h('div', { class: 't', text: t.nome }), h('div', { class: 's', text: t.dose })),
          iconBtn('close', `Tirar ${t.nome}`, () => {
            if (!mesmoDia(desenhadoEm)) { sh.close(); return; }
            update((st) => { apagarSup(st.diario, data, s.id); });
            toast(`${t.nome}: tirado.`); desenha();
          })));
      }
      corpo.appendChild(l);
    }
    corpo.appendChild(h('div', { class: 'comido-sub', text: 'Marcar' }));
    const chips = h('div', { class: 'chips wrap', id: 'sup-tipos' });
    // o tipo já marcado no dia abre o registro dele (para mudar a dose), em vez de criar outro; "Outro" sempre cria
    for (const [k, S] of Object.entries(SUPLEMENTOS)) {
      const ja = k === 'outro' ? null : sup.find((x) => x.tipo === k);
      chips.appendChild(h('button', { type: 'button', class: 'chip sm alvo' + (ja ? ' on' : ''), 'aria-pressed': ja ? 'true' : 'false', dataset: { tipo: k }, onClick: () => abrir(k, ja || null) }, S.nome.split(' (')[0]));
    }
    corpo.appendChild(chips);
    corpo.appendChild(h('p', { class: 'tiny muted', text: comNumeros ? 'Só registro: o app não indica dose. A proteína do whey entra no dia pelo valor do rótulo.' : 'Só registro: o app não indica dose.' }));
  }
  function formulario() {
    const S = SUPLEMENTOS[form.tipo];
    corpo.appendChild(h('h3', { text: form.tipo === 'outro' ? 'Outro suplemento' : S.nome }));
    // antes dos 18 anos: o mesmo cuidado da seção de suplementos (logic/nutrition.js), em uma linha
    if (menor && form.tipo === 'cafeina') corpo.appendChild(note('warn', 'A Anvisa não permite suplemento de cafeína para menores de 18 anos.'));
    else if (menor && ['creatina', 'whey'].includes(form.tipo)) corpo.appendChild(note('warn', 'Antes dos 18 anos, só com orientação do médico ou nutricionista.'));
    if (form.tipo === 'outro') corpo.appendChild(campo('Nome', { type: 'text', maxlength: SUP_NOME_MAX, value: form.nome, placeholder: 'Ex.: magnésio', 'aria-label': 'Nome do suplemento', onInput: (e) => { form.nome = e.target.value; } }));
    corpo.appendChild(campo(S.rotulo ? 'Quantas doses' : 'Quantidade', { type: 'text', inputmode: 'decimal', maxlength: 9, value: form.qtdTxt, 'aria-label': 'Quantidade', onInput: (e) => { form.qtdTxt = e.target.value; } }));
    if (S.un.length > 1) corpo.appendChild(seg(S.un.map((u) => [u, u]), form.un, (v) => { form.un = v; desenha(); }));
    else corpo.appendChild(h('p', { class: 'small muted', text: S.un[0] === 'dose' ? 'Em doses (o medidor do pote).' : `Em ${S.un[0]}.` }));
    if (S.rotulo && comNumeros) {
      corpo.appendChild(h('div', { class: 'row gap-s sup-rotulo' },
        campo('Proteína por dose (g)', { type: 'text', inputmode: 'decimal', maxlength: 5, value: form.pTxt, placeholder: 'do rótulo', 'aria-label': 'Proteína por dose', onInput: (e) => { form.pTxt = e.target.value; } }),
        campo('kcal por dose', { type: 'text', inputmode: 'numeric', maxlength: 5, value: form.kTxt, placeholder: 'opcional', 'aria-label': 'Calorias por dose', onInput: (e) => { form.kTxt = e.target.value; } })));
      corpo.appendChild(h('p', { class: 'tiny muted', text: 'Veja na tabela do rótulo. Sem a proteína, o whey fica só registrado.' }));
    }
    if (form.repetiu) corpo.appendChild(h('p', { class: 'tiny muted', text: 'Preenchido como da última vez que você marcou.' }));
  }
  function salvarSup() {
    if (!mesmoDia(desenhadoEm)) { sh.close(); return; }
    const S = SUPLEMENTOS[form.tipo];
    const qtd = lerQtd(form.qtdTxt);
    if (qtd == null || qtd <= 0) { toast('Digite a quantidade em número (ex.: 1 ou 2,5).'); return; }
    if (form.tipo === 'outro' && !form.nome.trim()) { toast('Escreva o nome do suplemento.'); return; }
    const raw = { tipo: form.tipo, qtd, un: form.un };
    if (form.id) raw.id = form.id;
    if (form.tipo === 'outro') raw.nome = form.nome;
    if (S.rotulo) {
      const p = form.pTxt.trim() ? lerProteina(form.pTxt) : null;
      if (form.pTxt.trim() && (p == null || p > SUP_P_MAX)) { toast(`Digite a proteína por dose em gramas, de 0 a ${SUP_P_MAX} (ex.: 24).`); return; }
      const k = form.kTxt.trim() ? lerCalorias(form.kTxt) : null;
      if (form.kTxt.trim() && (k == null || k > SUP_KCAL_MAX)) { toast('Digite as calorias por dose em número inteiro (ex.: 120).'); return; }
      // sem números (menores de 18): o que já estava guardado continua
      const antes = form.id ? supDoDia(state.diario, data).find((x) => x.id === form.id) : null;
      raw.pDose = comNumeros ? p : antes ? antes.pDose : null;
      raw.kcalDose = comNumeros ? k : antes ? antes.kcalDose : null;
    }
    let it = null;
    update((st) => { it = gravarSup(st.diario, data, raw, dateKey()); });
    if (!it) { toast(supDoDia(state.diario, data).length >= MAX_SUP_DIA && !raw.id ? 'Este dia já tem o máximo de suplementos.' : 'Confira a quantidade e tente de novo.'); return; }
    toast(`${textoDoSup(it).nome}: marcado.`);
    form = null; desenha();
  }
  function rodape() {
    if (!sh || !sh.footer) return;
    while (sh.footer.firstChild) sh.footer.removeChild(sh.footer.firstChild);
    if (form) sh.footer.append(btn('Voltar', () => { form = null; desenha(); }, 'ghost'), btn('Salvar', salvarSup, 'primary grow'));
    else sh.footer.append(btn('Fechar', () => sh.close(), 'ghost grow'));
  }
  function desenha() {
    while (corpo.firstChild) corpo.removeChild(corpo.firstChild);
    if (form) formulario(); else lista();
    rodape();
  }
  let sh = null;
  sh = sheet({ title: `Suplementos e vitaminas · ${nomeDoDia(data, desenhadoEm).toLowerCase()}`, body: corpo, footer: [],
    onClose: () => redesenharNoLugar(`#conteudo .sup-dia[data-dia="${data}"]`) });
  desenha();
  return sh;
}

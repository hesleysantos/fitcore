// Diário alimentar na tela: "O que comi hoje" (bloco da Nutrição) e "Comi isso" / "Comi outra coisa" no cardápio de
// exemplo. As contas e a validação ficam em logic/diario.js (o Início usa resumoDeHoje(), de lá).
// Nenhum texto digitado vira HTML: tudo passa por h() (textContent), e o que é gravado passa por gravarItem().
import { h, btn, iconBtn, icon, seg, sheet, confirmSheet, stepper, toast, fmtInt, fmtDate, dateKey } from '../ui.js';
import { state, update } from '../store.js';
import { refresh } from '../router.js';
import { ALIMENTOS, alergenosDe, NOME_ALERGIA } from '../data/foods.js';
import { REFS } from '../data/knowledge.js';
import { medida } from '../logic/nutrition.js';
import {
  REFEICOES, G_MIN, G_MAX, KCAL_MAX, PROT_MAX, NOME_MAX, MAX_ITENS_DIA, AVISO_DO_REGISTRO, REFS_DO_DIARIO,
  itensDoDia, gravarItem, apagarItem, copiarRefeicao, idDaRefeicao, refeicaoCopiada, nutrientesDoItem, totaisDoDia,
  modoDoDiario, compararComMeta, resumoDaSemana, metaDoDia, somarDias, primeiroDiaDoDiario, lerCalorias, lerProteina, buscarAlimentos,
} from '../logic/diario.js';

const FOOD = new Map(ALIMENTOS.map((f) => [f.id, f]));
const dec = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const diaMes = (data) => `${Number(data.slice(8, 10))}/${data.slice(5, 7)}`;
const nomeDoDia = (data, hoje) => (data === hoje ? 'Hoje' : data === somarDias(hoje, -1) ? 'Ontem' : fmtDate(data + 'T12:00:00'));
// refeição mais provável pela hora do relógio (só para já vir marcada; a pessoa troca)
const refeicaoDaHora = () => { const hr = new Date().getHours(); return hr < 10 ? 'cafe' : hr < 12 ? 'lanche-manha' : hr < 15 ? 'almoco' : hr < 18 ? 'lanche-tarde' : hr < 22 ? 'jantar' : 'ceia'; };

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

// ---------- folha: adicionar ou editar um alimento ----------
// { data, ref, item }: `item` (do diário) abre em modo de edição, com Apagar.
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
  const corpo = h('div', { class: 'col' });
  const selRef = h('select', { class: 'input', 'aria-label': 'Refeição', onChange: (e) => { st.ref = e.target.value; } },
    ...Object.entries(REFEICOES).map(([k, nome]) => h('option', { value: k, selected: k === st.ref, text: nome })));

  // busca no catálogo (logic/diario.js, buscarAlimentos): sem acento nem pontuação, pelo começo das palavras, 2 letras ou mais
  const resultados = h('div', { class: 'list', id: 'diario-resultados' });
  const buscar = (termo) => {
    while (resultados.firstChild) resultados.removeChild(resultados.firstChild);
    if (String(termo).replace(/[^0-9A-Za-zÀ-ÿ]/g, '').length < 2) { resultados.appendChild(h('p', { class: 'small muted', text: 'Digite pelo menos 2 letras do nome do alimento.' })); return; }
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
  const campoBusca = h('input', { class: 'input', type: 'search', placeholder: 'Buscar alimento (ex.: arroz, banana)', 'aria-label': 'Buscar alimento', autocomplete: 'off', maxlength: 40, onInput: (e) => buscar(e.target.value) });
  // menores de 18 anos (em qualquer entrevista): a folha não mostra nem pede calorias
  const mostraKcal = modoDoDiario(metaDoDia(state, desenhadoEm), state) !== 'alimentos';

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
  function desenha() {
    while (corpo.firstChild) corpo.removeChild(corpo.firstChild);
    corpo.appendChild(h('label', { class: 'field' }, h('span', { text: 'Refeição' }), selRef));
    if (st.livre) corpo.appendChild(foraDaLista());
    else if (st.al && FOOD.has(st.al)) corpo.appendChild(quantidade(FOOD.get(st.al)));
    else {
      corpo.appendChild(h('div', { class: 'search' }, icon('search'), campoBusca));
      corpo.appendChild(resultados);
      corpo.appendChild(btn('Não achei na lista', () => { st.livre = true; st.al = ''; if (!st.nome) st.nome = campoBusca.value.trim().slice(0, NOME_MAX); desenha(); }, 'block ghost', 'plus'));
      buscar(campoBusca.value);
    }
  }
  const gravar = () => {
    // o dia virou com a folha aberta ("hoje" e "ontem" já são outros): avisa, redesenha e não grava
    if (!mesmoDia(desenhadoEm)) { f.close(); return; }
    let raw;
    if (st.livre) {
      if (!st.nome.trim()) { toast('Escreva o nome do alimento.'); return; }
      if (!mostraKcal) raw = { ref: st.ref, nome: st.nome, kcal: item && !item.al ? item.kcal : 0, p: item && !item.al ? item.p : null };
      else {
        // calorias: só número inteiro ("1.200" e "1 200" valem 1200); o que for ambíguo é recusado, com aviso
        const kcal = lerCalorias(st.kcalTxt);
        if (kcal == null) { toast(st.kcalTxt.trim() ? 'Digite as calorias em número inteiro, sem vírgula (ex.: 1200).' : 'Informe as calorias.'); return; }
        if (kcal > KCAL_MAX) { toast(`As calorias de um alimento vão de 0 a ${fmtInt(KCAL_MAX)}.`); return; }
        const p = st.pTxt.trim() ? lerProteina(st.pTxt) : null;
        if (st.pTxt.trim() && (p == null || p > PROT_MAX)) { toast(`Digite a proteína em gramas, de 0 a ${PROT_MAX} (ex.: 12 ou 4,5).`); return; }
        raw = { ref: st.ref, nome: st.nome, kcal, p };
      }
    } else {
      if (!st.al) { toast('Escolha um alimento na busca.'); return; }
      raw = { ref: st.ref, al: st.al, g: st.g, m: st.porMedida };
    }
    if (item) raw.id = item.id;
    if (salvar(data, raw)) { f.close(); refresh(); }
  };
  const apagar = async () => {
    const x = nutrientesDoItem(item);
    const sim = await confirmSheet({ title: 'Apagar este alimento?', text: `${x.nome}${x.medida ? ', ' + x.medida : ''}. Não dá para desfazer.`, okLabel: 'Apagar', danger: true });
    if (!sim) return;
    update((s) => { apagarItem(s.diario, data, item.id); });
    f.close(); refresh();
  };
  const f = sheet({
    title: item ? 'Corrigir alimento' : `Adicionar alimento · ${nomeDoDia(data, desenhadoEm).toLowerCase()}`, full: true, body: corpo,
    footer: [item ? btn('Apagar', apagar, 'ghost danger') : btn('Cancelar', () => f.close(), 'ghost'), btn(item ? 'Salvar' : 'Adicionar', gravar, 'primary grow')],
  });
  desenha();
  return f;
}

// ---------- cardápio de exemplo: "Comi isso" e "Comi outra coisa" ----------
// `refeicao` é uma refeição do cardápio ({ nome, itens: [{ id, g }] }). Os botões valem para o dia de hoje.
export function acoesDaRefeicao(refeicao) {
  const hoje = dateKey();
  const ref = idDaRefeicao(refeicao.nome);
  const outra = () => { if (mesmoDia(hoje)) folhaAlimento({ data: hoje, ref }); };
  // some só quando a refeição SUGERIDA já está no diário; um alimento avulso no mesmo horário não tira o botão
  if (refeicaoCopiada(state.diario, hoje, refeicao)) {
    return h('div', { class: 'row between diario-acoes', dataset: { ref } },
      h('span', { class: 'small muted grow', text: `${refeicao.nome}: registrado no diário de hoje.` }),
      btn('Adicionar mais', outra, 'sm ghost', 'plus'));
  }
  const comi = () => {
    if (!mesmoDia(hoje)) return;
    let n = 0;
    update((s) => { n = copiarRefeicao(s.diario, hoje, refeicao, hoje); });
    toast(n ? `${refeicao.nome} registrado no diário de hoje${n < refeicao.itens.length ? ' (sem repetir o que já estava lá)' : ''}.` : 'Não consegui registrar esta refeição.');
    refresh();
  };
  return h('div', { class: 'row par-de-botoes diario-acoes', dataset: { ref } },
    btn('Comi isso', comi, 'sm grow', 'check'), btn('Comi outra coisa', outra, 'sm ghost grow', 'edit'));
}

// ---------- diário dentro do cardápio (tela com metas e cardápio) ----------
// O que foi comido aparece na refeição em que foi comido, junto da sugestão; o que não cabe em nenhuma refeição do
// cardápio fica em "Outros alimentos de hoje", logo depois das refeições. Dias anteriores e a semana ficam no fim,
// em seções que abrem ao toque.

// botão de um alimento registrado: tocar abre a correção (e o apagar)
function botaoDoItem(x, data, hoje, comKcal) {
  const rotulo = `Corrigir ${x.nome}`;
  return h('button', { type: 'button', class: 'item diario-item', dataset: { id: x.id }, 'aria-label': rotulo, title: rotulo, onClick: () => { if (mesmoDia(hoje)) folhaAlimento({ data, item: x }); } },
    h('div', { class: 'grow' }, h('div', { class: 't', text: x.nome }), h('div', { class: 's', text: x.livre ? 'fora da lista' + (comKcal && x.p != null ? ` · ${dec(x.p)} g de proteína` : '') : x.medida })),
    comKcal ? h('span', { class: 'small bold nowrap', text: `${fmtInt(x.kcal)} kcal` }) : null, icon('edit', 's'));
}
// Números de hoje para o alto da tela: comido / meta de calorias e de proteína e quanto falta. `r` = calcular().
// Devolve null quando o perfil não recebe a comparação com meta (a tela usa o blocoDiario completo).
export function resumoDoDiario(r) {
  const hoje = dateKey();
  const modo = modoDoDiario(r, state);
  if (modo !== 'meta') return null;
  const cmp = compararComMeta(totaisDoDia(state.diario, hoje), r, state);
  const barra = h('i', { class: 'c' });
  barra.style.width = Math.min(100, Math.max(0, cmp.pct)) + '%';
  return h('div', { class: 'col gap-s', id: 'diario', dataset: { dia: hoje, modo } },
    h('div', { class: 'stats two' },
      h('div', { class: 'stat' }, h('b', { text: `${fmtInt(cmp.kcal)} / ${fmtInt(cmp.metaKcal)}` }), h('span', { text: 'kcal: comido / meta' })),
      h('div', { class: 'stat' }, h('b', { text: `${cmp.prot} / ${cmp.metaProt} g` }), h('span', { text: 'proteína: comido / meta' }))),
    h('div', { class: 'macro', role: 'img', 'aria-label': `${cmp.pct}% da meta de calorias do dia` }, barra),
    h('p', { class: 'small' }, h('span', { class: 'bold', id: 'diario-frase', text: cmp.frase }), ' ', h('span', { id: 'diario-proteina', text: cmp.fraseProt })),
    cmp.equivale ? h('p', { class: 'tiny muted', id: 'diario-equivale', text: cmp.equivale }) : null);
}
// Alimentos registrados hoje numa refeição do diário (`ref`, ex.: 'almoco'): lista de botões, ou null se não há nenhum.
export function comidoNaRefeicao(ref, r) {
  const hoje = dateKey();
  const comKcal = modoDoDiario(r, state) !== 'alimentos';
  const tot = totaisDoDia(state.diario, hoje).refeicoes.find((x) => x.ref === ref);
  if (!tot || !tot.itens.length) return null;
  const lista = h('div', { class: 'list diario-comido', dataset: { ref } });
  for (const x of tot.itens) lista.appendChild(botaoDoItem(x, hoje, hoje, comKcal));
  return h('div', { class: 'col gap-s' }, h('div', { class: 'comido-rot', text: comKcal ? `Você comeu · ${fmtInt(tot.kcal)} kcal` : 'Você comeu' }), lista);
}
// Depois das refeições: o que foi comido fora delas (`refsDoCardapio` = ids das refeições mostradas) e "Adicionar alimento".
export function diarioDeHoje(r, refsDoCardapio) {
  const hoje = dateKey();
  const comKcal = modoDoDiario(r, state) !== 'alimentos';
  const tot = totaisDoDia(state.diario, hoje);
  const card = h('div', { class: 'card col', id: 'diario-hoje' });
  const fora = tot.refeicoes.filter((x) => !refsDoCardapio.includes(x.ref));
  for (const ref of fora) {
    card.appendChild(h('div', { class: 'row between', dataset: { ref: ref.ref } }, h('h3', { text: ref.nome }), comKcal ? h('span', { class: 'small muted nowrap', text: `${fmtInt(ref.kcal)} kcal` }) : null));
    const lista = h('div', { class: 'list' });
    for (const x of ref.itens) lista.appendChild(botaoDoItem(x, hoje, hoje, comKcal));
    card.appendChild(lista);
  }
  if (!fora.length) card.appendChild(h('p', { class: 'small muted', text: tot.n ? 'Comeu algo fora destas refeições? Adicione aqui.' : 'Comeu algo fora do cardápio? Adicione aqui ou use “Comi outra coisa” na refeição.' }));
  card.appendChild(btn('Adicionar alimento', () => { if (mesmoDia(hoje)) folhaAlimento({ data: hoje }); }, 'primary block', 'plus'));
  if (comKcal && tot.n) {
    card.appendChild(h('p', { class: 'tiny muted', id: 'diario-macros', text: `Hoje: carboidrato ${Math.round(tot.c)} g · gordura ${Math.round(tot.gd)} g · fibras ${Math.round(tot.fibra)} g` + (tot.livres ? ` (sem contar ${tot.livres === 1 ? '1 alimento' : tot.livres + ' alimentos'} fora da lista${tot.semProteina ? '; a proteína de ' + (tot.semProteina === 1 ? 'um deles' : tot.semProteina + ' deles') + ' não foi informada' : ''})` : '') + '.' }));
  }
  return card;
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
  const dias = h('details', { class: 'acc', id: 'diario-dias', open: aberto }, h('summary', { text: 'Diário dos dias anteriores' }), corpo);
  dias.addEventListener('toggle', () => { aberto = dias.open; });
  const sem = resumoDaSemana(state.diario, hoje, r, state);
  const linhas = h('div');
  for (const d of sem.dias) linhas.appendChild(h('div', { class: 'kv' }, h('span', { class: 'muted', text: nomeDoDia(d.data, hoje) }), h('span', { text: !d.n ? 'sem registro' : comKcal ? `${fmtInt(d.kcal)} kcal · ${d.p} g` : (d.n === 1 ? '1 alimento' : d.n + ' alimentos') })));
  const semana = h('details', { class: 'acc', id: 'diario-semana' }, h('summary', { text: `Últimos 7 dias · ${sem.registrados === 1 ? '1 dia registrado' : sem.registrados + ' dias registrados'}` }),
    h('div', null, sem.frase ? h('p', { class: 'small', text: sem.frase }) : null, linhas,
      comKcal ? h('p', { class: 'tiny muted', id: 'diario-aviso', text: AVISO_DO_REGISTRO }) : null));
  return [dias, semana, comKcal ? fontes() : null].filter(Boolean);
}
let aberto = false;

// ---------- bloco "O que comi hoje" ----------
function fontes() {
  const box = h('div', { class: 'col gap-s' });
  for (const k of REFS_DO_DIARIO) if (REFS[k]) box.appendChild(h('p', { class: 'ref', text: '• ' + REFS[k] }));
  return h('details', { class: 'acc' }, h('summary', { text: 'Fontes do diário' }), box);
}
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

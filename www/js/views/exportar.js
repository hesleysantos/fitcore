// Exportar o histórico (Ajustes → Seus dados): planilhas CSV por tipo e o resumo do período para imprimir ou salvar
// em PDF, para mostrar a um personal, nutricionista ou médico. As contas ficam em logic/exportar.js.
import { h, btn, icon, sheet, toast, seg, fmtKg, dateKey, plural } from '../ui.js';
import { state } from '../store.js';
import { go, replace } from '../router.js';
import { planilhasDisponiveis, planilha, montarResumo, PERIODOS, dataBR, hms } from '../logic/exportar.js';
import { entregarArquivo } from './arquivo.js';

// ---------- folha "Exportar para planilha ou PDF" ----------
export function abrirExportar() {
  const lista = h('div', { class: 'card tight', id: 'exportar-planilhas' });
  for (const p of planilhasDisponiveis(state)) {
    lista.appendChild(h('button', { type: 'button', class: 'menu-item', 'data-planilha': p.id, disabled: !p.linhas, onClick: () => baixar(p.id) },
      icon('download'), h('span', { class: 'grow' }, h('span', { class: 'bold', text: p.nome }), h('span', { class: 'small muted', text: ' · ' + (p.linhas ? plural(p.linhas, 'linha', 'linhas') : 'sem registros') }))));
  }
  const s = sheet({
    title: 'Exportar',
    body: [
      h('p', { class: 'small muted', text: 'Planilha (CSV) para abrir no Excel ou no Google Planilhas, um arquivo por tipo. Os arquivos têm dados de saúde e não têm senha.' }),
      lista,
      btn('Resumo para imprimir ou salvar em PDF', () => { s.close(); go('resumo'); }, 'block', 'book'),
    ],
  });
  return s;
}
async function baixar(id) {
  const p = planilha(state, id, dateKey());
  if (!p) return;
  try {
    const r = await entregarArquivo(p.texto, p.nome, ['text/csv', 'text/plain'], 'Planilha do FitCore');
    if (r === 'baixado') toast('Planilha gerada. Confira a pasta de downloads.');
  } catch { toast('Não foi possível gerar o arquivo neste navegador.'); }
}

// ---------- resumo para imprimir ----------
const kv = (k, v) => h('div', { class: 'kv' }, h('span', { text: k }), h('span', { text: v }));
const secao = (titulo, ...kids) => h('section', { class: 'card col gap-s resumo-sec' }, h('h3', { text: titulo }), ...kids);
// item de lista (exercício, dor): título e uma linha de detalhe; cabe em 360 px com qualquer tamanho de letra
const item = (titulo, detalhe) => h('div', { class: 'resumo-item' }, h('div', { class: 'bold', text: titulo }), h('div', { class: 'small', text: detalhe }));
const minTxt = (min) => (min == null ? '–' : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`);
const kmTxt = (km) => fmtKg(km) + ' km';
const serieTxt = (x) => `${fmtKg(x.kg)} kg × ${x.reps}`;
const sinal = (n, un) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtKg(Math.abs(n)) + ' ' + un;

export function resumoView(diasTxt) {
  const dias = PERIODOS.some(([d]) => String(d) === diasTxt) ? Number(diasTxt) : 90;
  const r = montarResumo(state, { dias, hoje: dateKey() });
  const body = [];
  // controles (não saem na impressão)
  body.push(h('div', { class: 'col gap-s no-print' },
    seg(PERIODOS.map(([d, nome]) => [String(d), nome]), String(dias), (v) => replace('resumo/' + v)),
    btn('Imprimir ou salvar em PDF', () => window.print(), 'primary block', 'download'),
    h('p', { class: 'tiny muted center', text: 'Na janela de impressão, escolha “Salvar como PDF” para guardar o arquivo.' })));

  const folha = h('div', { class: 'col resumo-folha', id: 'resumo' });
  folha.appendChild(h('header', { class: 'col gap-s' }, h('h2', { text: 'Resumo de treino e saúde' }),
    h('p', { class: 'small', text: `Período: ${dataBR(r.de)} a ${dataBR(r.ate)} (${plural(r.dias, 'dia', 'dias')})` })));
  let algum = false;
  const m = r.musc;
  if (m.treinos) {
    algum = true;
    const kids = [kv('Treinos de musculação', String(m.treinos)), kv('Média por semana', fmtKg(m.porSemana)), kv('Séries feitas', String(m.series))];
    if (m.principais.length) {
      kids.push(h('p', { class: 'small muted', text: 'Melhor série no primeiro e no último treino do período:' }));
      // no aparelho assistido o peso é de ajuda: menos kg é mais difícil
      kids.push(...m.principais.map((x) => item(x.nome, `${serieTxt(x.inicio)} → ${serieTxt(x.fim)} (${x.difKg ? sinal(x.difKg, 'kg') + (x.assistido ? ' de ajuda' : '') : 'mesma carga'})`)));
    }
    folha.appendChild(secao('Musculação', ...kids));
  }
  const c = r.corrida;
  if (c.n) {
    algum = true;
    folha.appendChild(secao('Corrida', kv('Corridas', String(c.n)), kv('Média por semana', fmtKg(c.porSemana)), kv('Distância total', kmTxt(c.km)), kv('Tempo total', hms(c.seg)),
      kv('Maior distância', kmTxt(c.maiorKm)), c.ritmoSeg ? kv('Ritmo médio', hms(c.ritmoSeg).replace(/^0:/, '') + ' por km') : null,
      c.pse != null ? kv('Esforço médio (1 a 10)', fmtKg(c.pse)) : null, c.comDor ? kv('Corridas com dor anotada', String(c.comDor)) : null));
  }
  const p = r.peso;
  if (p.n) {
    algum = true;
    folha.appendChild(secao('Peso', kv(`Primeiro registro (${dataBR(p.inicio.data)})`, fmtKg(p.inicio.peso) + ' kg'),
      p.n > 1 ? kv(`Último registro (${dataBR(p.fim.data)})`, fmtKg(p.fim.peso) + ' kg') : null, p.dif != null ? kv('Variação', sinal(p.dif, 'kg')) : null,
      p.cinturaInicio != null ? kv('Cintura', p.cinturaFim !== p.cinturaInicio ? `${fmtKg(p.cinturaInicio)} → ${fmtKg(p.cinturaFim)} cm` : `${fmtKg(p.cinturaFim)} cm`) : null, kv('Registros', String(p.n))));
  }
  const s = r.sono;
  if (s.noites || s.cochilos) {
    algum = true;
    folha.appendChild(secao('Sono', s.noites ? kv('Noites registradas', String(s.noites)) : null, s.noites ? kv('Média por noite', minTxt(s.mediaMin)) : null,
      s.noites ? kv('Noites com menos de 7 h', String(s.menos7)) : null, s.qualidade != null ? kv('Como acordou (1 a 5)', fmtKg(s.qualidade)) : null,
      s.cochilos ? kv('Cochilos', `${s.cochilos} (média de ${s.cochiloMedioMin} min)`) : null));
  }
  const d = r.diario;
  if (d && d.dias) {
    algum = true;
    folha.appendChild(secao('Alimentação', kv('Dias com diário alimentar', String(d.dias)),
      d.kcal != null ? kv('Média por dia registrado', `${d.kcal.toLocaleString('pt-BR')} kcal, ${d.prot} g de proteína`) : null,
      d.kcal != null ? h('p', { class: 'tiny muted', text: 'Anotações da própria pessoa: costumam ficar abaixo do consumo real.' }) : null));
  }
  if (r.dores.length) {
    algum = true;
    folha.appendChild(secao('Dores registradas', ...r.dores.map((x) => item(`${dataBR(x.data)} · ${x.local}`, `${x.tipo}, nível ${x.nivel} de 10, ${x.quando.toLowerCase()}${x.fim ? `; melhorou em ${dataBR(x.fim)}` : ''}`))));
  }
  if (r.saude && r.saude.length) {
    algum = true;
    folha.appendChild(secao('Problemas de saúde fora do treino', ...r.saude.map((x) => item(`${dataBR(x.data)} · ${x.nome}${x.local ? ` (${x.local})` : ''}`, `${x.grau ? `intensidade ${x.grau}` : 'registrado'}${x.fim ? `; melhorou em ${dataBR(x.fim)}` : ''}`))));
  }
  if (!algum) folha.appendChild(h('p', { class: 'muted', text: 'Sem registros neste período.' }));
  folha.appendChild(h('p', { class: 'tiny muted', text: 'Dados anotados pela própria pessoa no aplicativo FitCore. Não é laudo nem avaliação profissional.' }));
  body.push(folha);
  return { title: 'Resumo do período', back: 'ajustes', body };
}

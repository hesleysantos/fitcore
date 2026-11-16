// Meta de sono: quantas horas dormir, pela idade e pelo perfil, e o acompanhamento das noites registradas.
// Puro: sem DOM e sem importar o estado. As citações completas estão em data/sono.js (REFS_SONO).
//
// O que as fontes dão e o que é conta do aplicativo:
// - FAIXA de horas por idade: National Sleep Foundation (hirshkowitz2015) e Academia Americana de Medicina do Sono
//   (watson2015 para adultos de 18 a 60 anos: 7 horas ou mais; paruthi2016 para 6 a 18 anos). Onde os dois consensos
//   dão faixas diferentes, o aplicativo usa a parte em que eles concordam (ver FAIXAS).
// - ALVO dentro da faixa: as fontes não dão um número único. O aplicativo usa o MEIO da faixa (conta do aplicativo).
// - Quem treina: não existe faixa própria. O consenso sobre sono do atleta (walsh2021) diz que a necessidade pode subir
//   com a carga de treino e sugere dormir mais antes de uma competição; os estudos apontam para mais de 8 horas
//   (roberts2019; sargent2021: 8,3 h; mah2011: cerca de 8,5 h). Por isso, com carga alta de treino ou na semana de uma
//   prova, o alvo sobe MEIA HORA, sem sair da faixa da idade. O corte de "carga alta" (treinar em 5 ou mais dias da
//   semana) e a meia hora são escolhas do aplicativo. "Prova" é só a do plano de corrida com objetivo de prova: teste
//   de ritmo e desafio de distância não são competição, e a fonte fala em competição importante.
// - Gestação: não há faixa própria nas fontes; vale a da idade, sem ajuste para cima.
// - Cochilos: para quem tem até 18 anos, a recomendação é de horas de sono em 24 HORAS (paruthi2016): o cochilo soma à
//   noite na comparação com a faixa. Para adultos, a recomendação é de horas POR NOITE (watson2015): a meta continua
//   sendo a da noite e o cochilo aparece à parte, como complemento de uma noite curta (sletten2023, walsh2021).
//   Cochilo e saúde: em adultos, cochilar 60 minutos ou mais por dia esteve associado a mais doença cardiovascular,
//   morte e diabetes; menos de 60 minutos, não (yamada2015, yamada2016, pan2020). É associação: o cochilo longo pode ser
//   consequência de noite ruim, apneia ou doença (yamada2016). Quantos dias na semana disparam cada dica é escolha do
//   aplicativo. Essas dicas não aparecem para menores (os estudos são com adultos) nem para gestantes (não há estudo).
// - Não há "saldo" de sono a pagar: 1 hora em falta levou 4 dias para ser recuperada (kitamura2016) e o consenso de
//   regularidade diz que a recuperação na folga é só parcial (sletten2023). O acompanhamento é pela média de 7 dias,
//   pelas noites abaixo da faixa e pela variação da duração.
import { planoAtual, planoDaSemana, diasDeForca } from './corrida.js';
import { doresAtivas } from './dor.js';
import { DICAS_SONO } from '../data/sono.js';

export const MAX_NOITES = 1500;  // cerca de 4 anos de registros
export const HORAS_MAX = 16;     // teto do que se pode registrar em uma noite
export const PASSO = 0.25;       // os registros andam de 15 em 15 minutos
export const IDADE_MIN = 6;      // mínimo único (tela, lógica e perguntas): é onde começam as faixas das fontes
export const IDADE_MAX = 99;
export const CARGA_ALTA = 5;     // dias de treino na semana (musculação ou corrida) a partir dos quais o alvo sobe: escolha do aplicativo
export const FALTA_MINIMA = 15;  // minutos que a média precisa ficar abaixo do mínimo para valer como "faltou sono": escolha do aplicativo
export const ANO_MIN = 2000;     // noites com data anterior a este ano são recusadas
// cochilos
export const MAX_COCHILOS = 3000;     // registros guardados
export const COCHILO_PASSO = 5;       // os cochilos andam de 5 em 5 minutos
export const COCHILO_MAX = 240;       // minutos: acima disso não é cochilo
export const COCHILOS_POR_DIA = 4;    // registros por dia
export const SOMA_24H_ATE = 18;       // até esta idade a recomendação é de sono em 24 horas (paruthi2016): o cochilo soma
export const COCHILO_LONGO = 60;      // minutos por dia a partir dos quais os estudos viram mais risco (yamada2015, yamada2016, pan2020)
export const COCHILO_TARDE = '16:00'; // fim da janela indicada para cochilar, das 13 h às 16 h (walsh2021, lastella2021)
export const MADRUGADA_ATE = '05:00'; // cochilo que começa da meia-noite até esta hora conta como tarde (continuação do dia anterior): escolha do aplicativo
export const DIAS_COCHILO_LONGO = 3;     // dias com cochilo longo, em 7, para a dica aparecer: escolha do aplicativo
export const DIAS_COCHILO_FREQUENTE = 5; // dias com cochilo, em 7, para valer como "quase todo dia": escolha do aplicativo
export const COCHILOS_TARDIOS = 2;       // cochilos depois das 16 h, em 7 dias, para a dica aparecer: escolha do aplicativo
export const AJUSTE = 0.5;       // quanto o alvo sobe com carga alta ou na semana da prova (horas): escolha do aplicativo
export const NOITES_PARA_REGULARIDADE = 5; // noites registradas, em 7, para medir a variação: escolha do aplicativo

// Faixas por idade. min–max = recomendado; pouco/muito = limites do "não recomendado" da National Sleep Foundation
// (menos que `pouco` ou mais que `muito`). Onde NSF e AASM diferem, vale a interseção: de 6 a 12 anos (9–11 em vez de
// 9–12), aos 13 (9–10), aos 18 (8–9) e nos adultos (7–9: a AASM diz "7 ou mais", sem teto). O consenso de adultos da
// AASM vale de 18 a 60 anos: acima disso a única fonte é a NSF (ver refsDaFaixa).
const FAIXAS = [
  { id: 'crianca', de: 6, ate: 12, min: 9, max: 11, pouco: 7, muito: 12, refs: ['hirshkowitz2015', 'paruthi2016'] },     // NSF 9–11; AASM 9–12
  { id: 'treze', de: 13, ate: 13, min: 9, max: 10, pouco: 7, muito: 12, refs: ['hirshkowitz2015', 'paruthi2016'] },      // NSF (6–13) 9–11; AASM (13–18) 8–10
  { id: 'adolescente', de: 14, ate: 17, min: 8, max: 10, pouco: 7, muito: 11, refs: ['hirshkowitz2015', 'paruthi2016'] }, // os dois: 8–10
  { id: 'dezoito', de: 18, ate: 18, min: 8, max: 9, pouco: 6, muito: 11, refs: ['hirshkowitz2015', 'paruthi2016'] },     // NSF (18–25) 7–9; AASM (13–18) 8–10
  { id: 'jovem-adulto', de: 19, ate: 25, min: 7, max: 9, pouco: 6, muito: 11, refs: ['hirshkowitz2015', 'watson2015'] }, // NSF 7–9; AASM 7 ou mais
  { id: 'adulto', de: 26, ate: 64, min: 7, max: 9, pouco: 6, muito: 10, refs: ['hirshkowitz2015', 'watson2015'] },
  { id: 'idoso', de: 65, ate: 130, min: 7, max: 8, pouco: 5, muito: 9, refs: ['hirshkowitz2015'] },                      // NSF 7–8 (o consenso da AASM vai até 60 anos)
];
const ADULTO_AASM = 60; // watson2015 vale para adultos de 18 a 60 anos
const refsDaFaixa = (f, idade) => (idade > ADULTO_AASM ? f.refs.filter((k) => k !== 'watson2015') : f.refs);
// Variação da duração do sono na semana (desvio-padrão, em minutos): faixas do estudo MESA (huang2020). O risco só foi
// claramente maior acima de 120 min; o consenso de regularidade diz que ainda não há um limite seguro (sletten2023).
const VARIACAO_REGULAR = 60;
const VARIACAO_ALTA = 120;

// ---------- utilitários ----------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const p2 = (n) => String(n).padStart(2, '0');
// dia do calendário que existe de verdade (31 de fevereiro não passa)
const dia = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const t = new Date(v + 'T12:00:00Z');
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v ? v : '';
};
const DIA_MS = 86400000;
const ms = (k) => Date.parse(k + 'T12:00:00Z');
const somaDias = (k, n) => new Date(ms(k) + n * DIA_MS).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((ms(b) - ms(a)) / DIA_MS);
// Última data aceita em um registro: amanhã (`hoje` + 1 dia, pela diferença de fuso entre aparelhos). Sem `hoje`, vale o
// dia do aparelho. Com { semCorteDeFuturo: true } nada é recusado por ser futuro (para carregar os dados guardados quando
// o relógio do aparelho está atrasado); o mesmo vale se `hoje` for tão distante que "amanhã" não cabe em 4 dígitos de ano.
const SEM_TETO = '9999-12-31';
function tetoDe(hoje, opcoes) {
  if (isObj(hoje)) { opcoes = hoje; hoje = undefined; } // aceita limparSono(raw, { semCorteDeFuturo: true })
  if (isObj(opcoes) && opcoes.semCorteDeFuturo === true) return SEM_TETO;
  const t = somaDias(dia(hoje) || hojeLocal(), 1);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : SEM_TETO;
}
// dia local de agora, para recusar noites no futuro quando quem chama não informa o dia
const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
export const horaValida = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

// "7 h", "7 h 30", "0 h 45"
export function fmtHoras(horas) {
  const h = numero(horas);
  if (h == null || h < 0) return '–';
  const m = Math.round(h * 60);
  return m % 60 ? `${Math.floor(m / 60)} h ${p2(m % 60)}` : `${m / 60} h`;
}
export const fmtFaixa = (min, max) => (Number.isInteger(min) && Number.isInteger(max) ? `${min} a ${max} h` : `${fmtHoras(min)} a ${fmtHoras(max)}`);

// ---------- estado e validação ----------
// state.sono = { acordar: 'HH:MM' | '', idade: número | null, registros: [{ data, horas, qualidade? }], cochilos: [{ data, min, inicio? }] }
// - acordar: hora em que a pessoa costuma acordar (para sugerir a hora de dormir);
// - idade: só é usada quando nenhuma entrevista (Treinador, Nutricionista, corrida) informou a idade;
// - registros: uma noite por dia; `data` é o dia em que a pessoa ACORDOU; `horas` de 0 a 16, de 15 em 15 minutos;
//   `qualidade` (opcional) de 1 (acordei muito cansado) a 5 (acordei bem descansado);
// - cochilos: até 4 por dia; `data` é o dia do cochilo; `min` de 5 a 240, de 5 em 5 minutos; `inicio` (opcional) 'HH:MM'.
export const sonoPadrao = () => ({ acordar: '', idade: null, registros: [], cochilos: [] });

// Uma noite validada ou null. Datas antes de ANO_MIN ou depois de amanhã (`hoje` + 1 dia, pela diferença de fuso entre
// aparelhos) são recusadas. `hoje` = 'AAAA-MM-DD'; sem ele, vale o dia do aparelho. `opcoes`: { semCorteDeFuturo }.
export const limparNoite = (raw, hoje, opcoes) => noiteValida(raw, tetoDe(hoje, opcoes));
function noiteValida(raw, teto) {
  if (!isObj(raw) || !tem(raw, 'data') || !tem(raw, 'horas')) return null;
  const data = dia(raw.data);
  const h = numero(raw.horas);
  if (!data || h == null || h < 0 || h > HORAS_MAX) return null;
  if (data < ANO_MIN + '-01-01' || data > teto) return null;
  const out = { data, horas: Math.round(h / PASSO) * PASSO };
  const q = tem(raw, 'qualidade') ? numero(raw.qualidade) : null;
  if (q != null && Math.round(q) >= 1 && Math.round(q) <= 5) out.qualidade = Math.round(q);
  return out;
}
const porData = (a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
// A lista inteira é lida (o tamanho do arquivo de backup já é limitado na importação) e só então cortada: ficam as
// MAX_NOITES mais recentes, onde quer que estejam na lista. Como só passam datas de ANO_MIN até amanhã, uma por dia,
// o que fica na memória é sempre pouco.
function limparNoites(raw, teto) {
  if (!Array.isArray(raw)) return [];
  const mapa = new Map();
  for (let i = 0; i < raw.length; i++) {
    const r = noiteValida(raw[i], teto);
    if (r) mapa.set(r.data, r); // uma noite por dia: vale a última informada
  }
  return [...mapa.values()].sort(porData).slice(-MAX_NOITES);
}
// Um cochilo validado ou null. Mesmas regras de data das noites.
export const limparCochilo = (raw, hoje, opcoes) => cochiloValido(raw, tetoDe(hoje, opcoes));
function cochiloValido(raw, teto) {
  if (!isObj(raw) || !tem(raw, 'data') || !tem(raw, 'min')) return null;
  const data = dia(raw.data);
  const m = numero(raw.min);
  if (!data || m == null) return null;
  const min = Math.round(m / COCHILO_PASSO) * COCHILO_PASSO;
  if (min < COCHILO_PASSO || min > COCHILO_MAX) return null;
  if (data < ANO_MIN + '-01-01' || data > teto) return null;
  const out = { data, min };
  if (tem(raw, 'inicio') && horaValida(raw.inicio)) out.inicio = raw.inicio;
  return out;
}
// ordem: por dia; dentro do dia, pela hora de início (os sem hora ficam no fim, na ordem em que entraram)
const horaDe = (c) => (typeof c.inicio === 'string' && c.inicio ? c.inicio : '~');
const porCochilo = (a, b) => porData(a, b) || (horaDe(a) < horaDe(b) ? -1 : horaDe(a) > horaDe(b) ? 1 : 0);
// A lista inteira é lida e ordenada antes de cortar: até COCHILOS_POR_DIA por dia e os MAX_COCHILOS mais recentes.
function limparCochilos(raw, teto) {
  if (!Array.isArray(raw)) return [];
  const l = [];
  for (let i = 0; i < raw.length; i++) { const c = cochiloValido(raw[i], teto); if (c) l.push(c); }
  l.sort(porCochilo);
  const out = [];
  let d = '', n = 0;
  for (const c of l) { if (c.data !== d) { d = c.data; n = 0; } if (++n <= COCHILOS_POR_DIA) out.push(c); }
  return out.slice(-MAX_COCHILOS);
}
// Validação na fronteira (armazenamento e backup importado): só passa o que tem o formato acima.
// `opcoes` (ou o próprio segundo argumento): { semCorteDeFuturo: true } para não recusar datas depois de amanhã.
export function limparSono(raw, hoje, opcoes) {
  const d = sonoPadrao();
  if (!isObj(raw)) return d;
  const teto = tetoDe(hoje, opcoes);
  if (tem(raw, 'acordar') && horaValida(raw.acordar)) d.acordar = raw.acordar;
  const idade = tem(raw, 'idade') ? numero(raw.idade) : null;
  if (idade != null && Math.round(idade) >= IDADE_MIN && Math.round(idade) <= IDADE_MAX) d.idade = Math.round(idade);
  if (tem(raw, 'registros')) d.registros = limparNoites(raw.registros, teto);
  if (tem(raw, 'cochilos')) d.cochilos = limparCochilos(raw.cochilos, teto);
  return d;
}
const registrosDe = (st) => (isObj(st) && isObj(st.sono) && Array.isArray(st.sono.registros) ? st.sono.registros.filter((r) => isObj(r) && dia(r.data) && numero(r.horas) != null && r.horas >= 0 && r.horas <= HORAS_MAX) : []);
// Noite registrada para um dia (o dia em que acordou), ou null.
export function noiteDe(st, data) {
  const l = registrosDe(st);
  for (let i = l.length - 1; i >= 0; i--) if (l[i].data === data) return l[i];
  return null;
}
// Grava (ou troca) uma noite em `sono` (o objeto state.sono). Devolve o registro gravado ou null se for inválido.
export function gravarNoite(sono, raw, hoje) {
  const r = limparNoite(raw, hoje);
  if (!r || !isObj(sono)) return null;
  const l = (Array.isArray(sono.registros) ? sono.registros : []).filter((x) => isObj(x) && x.data !== r.data);
  l.push(r);
  sono.registros = l.sort(porData).slice(-MAX_NOITES);
  return r;
}
export function apagarNoite(sono, data) {
  if (!isObj(sono) || !Array.isArray(sono.registros)) return false;
  const antes = sono.registros.length;
  sono.registros = sono.registros.filter((x) => isObj(x) && x.data !== data);
  return sono.registros.length < antes;
}

const minutosDe = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
// Cochilo fora da janela indicada (13 h às 16 h) pelo lado de tarde: TERMINA depois das 16 h (início + duração) ou começa
// de madrugada. Um cochilo das 15:40 às 16:00 está dentro; das 15:30 às 17:00, das 16:00 em diante, às 23:30 ou à 00:30,
// não. Sem hora de início não há como saber: não conta. Cochilo de manhã não é "tarde".
export function cochiloTardio(c) {
  if (!isObj(c) || !horaValida(c.inicio) || numero(c.min) == null) return false;
  const ini = minutosDe(c.inicio);
  return ini < minutosDe(MADRUGADA_ATE) || ini + c.min > minutosDe(COCHILO_TARDE);
}
const cochilosValidos = (st) => (isObj(st) && isObj(st.sono) && Array.isArray(st.sono.cochilos) ? st.sono.cochilos.filter((c) => isObj(c) && dia(c.data) && numero(c.min) != null && c.min >= COCHILO_PASSO && c.min <= COCHILO_MAX) : []);
// Cochilos de um dia, na ordem em que a tela mostra (o índice nessa lista é o que gravarCochilo e apagarCochilo usam).
export const cochilosDe = (st, data) => cochilosValidos(st).filter((c) => c.data === data).sort(porCochilo);
// Soma dos cochilos de um dia, em minutos.
export const minutosDeCochilo = (st, data) => cochilosDe(st, data).reduce((t, c) => t + c.min, 0);
// Grava um cochilo em `sono` (state.sono). Com `indice` (posição em cochilosDe do mesmo dia), troca aquele cochilo;
// sem ele, acrescenta (até COCHILOS_POR_DIA por dia). Devolve o registro gravado ou null.
export function gravarCochilo(sono, raw, hoje, indice = -1) {
  const c = limparCochilo(raw, hoje);
  if (!c || !isObj(sono)) return null;
  const todos = (Array.isArray(sono.cochilos) ? sono.cochilos : []).filter(isObj);
  const doDia = todos.filter((x) => x.data === c.data).sort(porCochilo);
  if (Number.isInteger(indice) && indice >= 0) {
    if (indice >= doDia.length) return null;
    todos.splice(todos.indexOf(doDia[indice]), 1);
  } else if (doDia.length >= COCHILOS_POR_DIA) return null;
  todos.push(c);
  sono.cochilos = todos.sort(porCochilo).slice(-MAX_COCHILOS);
  return c;
}
export function apagarCochilo(sono, data, indice) {
  if (!isObj(sono) || !Array.isArray(sono.cochilos) || !Number.isInteger(indice) || indice < 0) return false;
  const todos = sono.cochilos.filter(isObj);
  const doDia = todos.filter((x) => x.data === data).sort(porCochilo);
  if (indice >= doDia.length) return false;
  todos.splice(todos.indexOf(doDia[indice]), 1);
  sono.cochilos = todos;
  return true;
}

// ---------- perfil ----------
export function faixaDaIdade(idade) {
  const i = numero(idade);
  if (i == null) return null;
  const n = Math.floor(i);
  return FAIXAS.find((f) => n >= f.de && n <= f.ate) || null;
}
const respostas = (o) => (isObj(o) && isObj(o.answers) ? o.answers : {});
const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

// O que o aplicativo já sabe da pessoa e que importa para o sono. `hoje` = 'AAAA-MM-DD' (dia local).
export function perfilDeSono(st, hoje) {
  const s = isObj(st) ? st : {};
  const t = respostas(s.trainer), n = respostas(s.nutri), c = respostas(s.run);
  // idade: a primeira entrevista que a informou; sem nenhuma, a que a pessoa deu na tela do sono
  let idade = null, origem = '';
  for (const [nome, a] of [['treinador', t], ['nutricao', n], ['corrida', c]]) {
    const v = numero(a.idade);
    if (v != null && v >= 1 && v <= 130) { idade = Math.floor(v); origem = nome; break; }
  }
  if (idade == null && isObj(s.sono)) {
    const v = numero(s.sono.idade);
    if (v != null && v >= IDADE_MIN && v <= IDADE_MAX) { idade = Math.floor(v); origem = 'sono'; }
  }
  const cond = new Set([...lista(t.condicoes), ...lista(n.condicoes), ...lista(c.condicoes)]);
  cond.delete('nenhuma');
  // Dias de treino da semana (0 = domingo). Musculação e corrida no mesmo dia valem um dia só.
  // musculação: dias da agenda do plano ativo que têm exercício (dia vazio não conta)
  const diasTreino = new Set();
  let musculacao = 0;
  try { for (const wd of diasDeForca(s).forca) if (Number.isInteger(wd) && wd >= 0 && wd <= 6 && !diasTreino.has(wd)) { diasTreino.add(wd); musculacao++; } } catch { /* plano ilegível: sem musculação a contar */ }
  // corrida: só a semana ATUAL do plano aceito. Antes do início, depois de concluído, pausado ou se o plano não puder
  // ser lido, não há corrida a contar nem prova a citar (corrida = null, prova = null): a tela não afirma nada.
  let corrida = null, prova = null;
  const hojeOk = !!dia(hoje);
  if (hojeOk) {
    try {
      const sem = planoDaSemana(s, hoje);
      if (isObj(sem) && !sem.antesDoInicio && !sem.concluido && Array.isArray(sem.dias)) {
        let n = 0;
        for (let wd = 0; wd < 7; wd++) {
          const d = sem.dias[wd];
          if (!isObj(d) || d.tipo === 'descanso' || d.tipo === 'caminhada') continue;
          n++; diasTreino.add(wd);
        }
        corrida = { dias: n };
      }
      // prova: só a do plano com objetivo de prova (teste de ritmo e desafio de distância não são competição)
      const pl = isObj(sem) && !sem.concluido ? planoAtual(s, hoje) : null;
      if (isObj(pl) && isObj(pl.perfil) && pl.perfil.objetivo === 'prova' && isObj(pl.prova) && pl.prova.tipo !== 'teste' && dia(pl.prova.data) && pl.prova.data >= hoje) {
        prova = { data: pl.prova.data, dias: diasEntre(hoje, pl.prova.data), distKm: numero(pl.prova.distKm) || 0 };
      }
    } catch { corrida = null; prova = null; }
  }
  const diasDeTreino = diasTreino.size;
  let dores = 0;
  if (hojeOk) { try { dores = doresAtivas(s, hoje).length; } catch { dores = 0; } }
  return {
    idade, origemIdade: origem, jovem: idade != null && idade < 18, idoso: idade != null && idade >= 65,
    gestante: cond.has('gestante'), condicoes: [...cond],
    adulto: idade != null && idade >= 18, adultoAasm: idade != null && idade >= 18 && idade <= ADULTO_AASM,
    musculacao, corrida, diasDeTreino, treina: diasDeTreino > 0, cargaAlta: diasDeTreino >= CARGA_ALTA,
    // a meta é a da noite que vem: na semana da prova conta até a véspera; no dia da prova, a noite já é depois dela
    prova, semanaDeProva: !!prova && prova.dias >= 1 && prova.dias <= 7, vesperaDeProva: !!prova && prova.dias === 1,
    emagrecer: t.objetivo === 'emagrecimento' || n.objetivo === 'emagrecer',
    musculo: t.objetivo === 'hipertrofia' || t.objetivo === 'forca' || n.objetivo === 'ganhar',
    treinaANoite: n.horario === 'noite',
    saude: ['hipertensao', 'diabetes', 'cardiaco'].some((x) => cond.has(x)),
    dores,
    acordar: isObj(s.sono) && horaValida(s.sono.acordar) ? s.sono.acordar : '',
  };
}

// ---------- meta ----------
// Meta da noite: faixa (min–max), alvo e os motivos, com as fontes. null quando a idade não é conhecida.
// `soma24h`: verdadeiro até os 18 anos, quando a faixa vale para o sono em 24 horas e o cochilo soma à noite.
// Devolve { idade, faixa, min, max, base, ajuste, alvo, pouco, muito, soma24h, motivos: [{ texto, refs }], avisos: [{ tipo, texto, refs }] }.
export const metaDeSono = (st, hoje) => metaCom(perfilDeSono(st, hoje));
function metaCom(p) {
  const f = faixaDaIdade(p.idade);
  if (!f) return null;
  const base = (f.min + f.max) / 2; // meio da faixa: conta do aplicativo
  // na gestação o alvo fica no meio da faixa: as fontes não sustentam pedir mais sono
  const sobe = !p.gestante && (p.cargaAlta || p.semanaDeProva);
  const alvo = Math.min(f.max, base + (sobe ? AJUSTE : 0));
  const motivos = [];
  const soma24h = p.idade <= SOMA_24H_ATE; // até os 18 anos a recomendação é de sono em 24 horas (paruthi2016)
  const concordam = f.id === 'treze' || f.id === 'dezoito' ? ' É a parte em que os dois consensos concordam.' : '';
  motivos.push({
    texto: f.id === 'idoso' ? `A partir dos 65 anos, a recomendação é de ${fmtFaixa(f.min, f.max)} por noite.`
      : soma24h ? `Aos ${p.idade} anos, os consensos de sono recomendam de ${fmtFaixa(f.min, f.max)} por dia: os cochilos contam.${concordam}`
        : `Aos ${p.idade} anos, os consensos de sono recomendam de ${fmtFaixa(f.min, f.max)} por noite.${concordam}`,
    refs: refsDaFaixa(f, p.idade),
  });
  if (p.gestante) motivos.push({ texto: 'Na gestação vale a faixa da idade. Dormir pouco foi associado a mais diabetes gestacional.', refs: ['reutrakul2018', 'lu2021'] });
  if (sobe && p.cargaAlta) motivos.push({ texto: `Você treina em ${p.diasDeTreino} dias nesta semana: o alvo sobe meia hora. Quem treina muito tende a precisar de mais sono para se recuperar.`, refs: ['walsh2021', 'sargent2021', 'roberts2019'] });
  if (sobe && p.semanaDeProva) motivos.push({ texto: `${p.prova.dias === 1 ? 'Sua prova é amanhã' : `Sua prova é em ${p.prova.dias} dias`}: ${p.cargaAlta ? 'dormir' : 'o alvo sobe meia hora, porque dormir'} mais nos dias anteriores ajuda, mesmo que a véspera seja ruim.`, refs: ['walsh2021'] });
  // objetivo, dores e condições de saúde não mudam a meta: viram dicas (dicasDeSono)
  const avisos = [];
  if (p.gestante) avisos.push({ tipo: 'warn', texto: 'Ronco frequente ou pausas na respiração durante a gestação: conte ao seu obstetra.', refs: ['pamidi2014'] });
  return { idade: p.idade, faixa: f.id, min: f.min, max: f.max, base, ajuste: alvo - base, alvo, pouco: f.pouco, muito: f.muito, soma24h, motivos, avisos };
}

// Hora de dormir para acordar em `acordar` ('HH:MM') tendo dormido `alvoHoras`. '' se algo for inválido.
export function horaDeDormir(acordar, alvoHoras) {
  const h = numero(alvoHoras);
  if (!horaValida(acordar) || h == null || h <= 0 || h > 24) return '';
  const m = Number(acordar.slice(0, 2)) * 60 + Number(acordar.slice(3, 5));
  const d = (((m - Math.round(h * 60)) % 1440) + 1440) % 1440;
  return `${p2(Math.floor(d / 60))}:${p2(d % 60)}`;
}

// ---------- acompanhamento ----------
// Os 7 dias que terminam em `hoje`. Devolve:
// { dias: [{ data, wd, horas | null, qualidade | null, cochiloMin, cochilos (quantos), total | null (noite + cochilos, em horas,
//   quando a noite foi registrada), estado: '' | 'abaixo' | 'dentro' | 'acima' }], n (noites registradas),
//   media | null (em horas, arredondada ao minuto), abaixo, dentro, acima (noites em cada situação), desvioMin | null (variação da duração, em minutos),
//   regularidade: null | 'regular' | 'variavel' | 'irregular', faltaMin (minutos que a média ficou abaixo do mínimo),
//   faltou (a média ficou abaixo do mínimo, com noites suficientes para afirmar isso), cansado (noites com qualidade 1 ou 2),
//   ultima (a noite de hoje, ou null), meta, avisos: [{ tipo, texto, refs }],
//   soma24h (o cochilo soma à noite na comparação com a faixa), media24 | null (média de noite + cochilos),
//   mediaDaMeta | null (a média que se compara com a faixa: media24 até os 18 anos, media nos adultos),
//   cochilo: { dias (dias com cochilo), n (cochilos), totalMin, mediaMin (por dia com cochilo), longos (dias com 60 min ou mais),
//   tardios (cochilos que terminaram depois das 16 h ou começaram de madrugada: ver cochiloTardio),
//   semNoite (dias com cochilo e sem noite registrada: ficam fora de media24) } }
// O estado de cada dia e as contagens abaixo/dentro/acima seguem a mesma regra: noite + cochilos até os 18 anos; só a noite nos adultos.
export const resumoDaSemana = (st, hoje) => semanaCom(st, hoje, metaDeSono(st, hoje));
function semanaCom(st, hoje, meta) {
  const vazio = { dias: [], n: 0, media: null, abaixo: 0, dentro: 0, acima: 0, desvioMin: null, regularidade: null, faltaMin: 0, faltou: false, cansado: 0, ultima: null, meta, avisos: [], soma24h: !!meta && meta.soma24h, media24: null, mediaDaMeta: null, cochilo: { dias: 0, n: 0, totalMin: 0, mediaMin: 0, longos: 0, tardios: 0, semNoite: 0 } };
  if (!dia(hoje)) return vazio;
  const mapa = new Map(registrosDe(st).map((r) => [r.data, r]));
  const soma24h = !!meta && meta.soma24h;
  const inicioDaSemana = somaDias(hoje, -6);
  const naSemana = cochilosValidos(st).filter((c) => c.data >= inicioDaSemana && c.data <= hoje);
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const data = somaDias(hoje, -i);
    const r = mapa.get(data) || null;
    const horas = r ? r.horas : null;
    const doDia = naSemana.filter((c) => c.data === data);
    const cochiloMin = doDia.reduce((t, c) => t + c.min, 0);
    const total = r ? horas + cochiloMin / 60 : null;
    const valor = soma24h ? total : horas; // o que se compara com a faixa
    const estado = !r || !meta ? '' : valor < meta.min ? 'abaixo' : valor > meta.max ? 'acima' : 'dentro';
    dias.push({ data, wd: new Date(ms(data)).getUTCDay(), horas, qualidade: r && numero(r.qualidade) != null ? r.qualidade : null, cochiloMin, cochilos: doDia.length, total, estado });
  }
  const com = dias.filter((d) => d.horas != null);
  const n = com.length;
  const aoMinuto = (v) => Math.round(v * 60) / 60;
  const media = n ? aoMinuto(com.reduce((s, d) => s + d.horas, 0) / n) : null; // arredondada ao minuto
  const media24 = n ? aoMinuto(com.reduce((s, d) => s + d.total, 0) / n) : null;
  const mediaDaMeta = soma24h ? media24 : media;
  const comCochilo = dias.filter((d) => d.cochilos > 0);
  const totalMin = comCochilo.reduce((t, d) => t + d.cochiloMin, 0);
  const cochilo = {
    dias: comCochilo.length, n: naSemana.length, totalMin, mediaMin: comCochilo.length ? Math.round(totalMin / comCochilo.length) : 0,
    longos: comCochilo.filter((d) => d.cochiloMin >= COCHILO_LONGO).length, tardios: naSemana.filter(cochiloTardio).length,
    // dias com cochilo e sem a noite registrada: esses cochilos não entram na média em 24 horas (falta a noite para somar)
    semNoite: comCochilo.filter((d) => d.horas == null).length,
  };
  let desvioMin = null, regularidade = null;
  if (n >= NOITES_PARA_REGULARIDADE) {
    const m = com.reduce((s, d) => s + d.horas, 0) / n;
    desvioMin = Math.round(Math.sqrt(com.reduce((s, d) => s + (d.horas - m) ** 2, 0) / (n - 1)) * 60); // desvio-padrão da amostra
    regularidade = desvioMin <= VARIACAO_REGULAR ? 'regular' : desvioMin <= VARIACAO_ALTA ? 'variavel' : 'irregular';
  }
  const cansado = com.filter((d) => d.qualidade != null && d.qualidade <= 2).length;
  const out = {
    dias, n, media, abaixo: com.filter((d) => d.estado === 'abaixo').length, dentro: com.filter((d) => d.estado === 'dentro').length, acima: com.filter((d) => d.estado === 'acima').length,
    desvioMin, regularidade, faltaMin: meta && mediaDaMeta != null && mediaDaMeta < meta.min ? Math.round((meta.min - mediaDaMeta) * 60) : 0, cansado, ultima: mapa.get(hoje) || null, meta, avisos: [],
    soma24h, media24, mediaDaMeta, cochilo,
  };
  // "faltou sono" pede o mesmo mínimo de noites dos avisos e a média pelo menos FALTA_MINIMA abaixo do mínimo da faixa
  out.faltou = !!meta && n >= NOITES_PARA_REGULARIDADE && out.faltaMin >= FALTA_MINIMA;
  // avisos só com pelo menos 5 noites registradas na semana: uma ou duas noites não dizem como a pessoa dorme
  if (meta && n >= NOITES_PARA_REGULARIDADE) {
    const refsIdade = meta.idade < 18 ? ['hirshkowitz2015', 'paruthi2016'] : meta.idade <= ADULTO_AASM ? ['hirshkowitz2015', 'watson2015'] : ['hirshkowitz2015'];
    if (mediaDaMeta < meta.pouco) out.avisos.push({ tipo: 'warn', texto: `Sua média ficou abaixo de ${meta.pouco} horas, o que não é recomendado para a sua idade. Se você tem tempo para dormir e mesmo assim não consegue, procure avaliação médica.`, refs: [...refsIdade, 'schutte2008'] });
    else if (mediaDaMeta > meta.muito) out.avisos.push({ tipo: 'info', texto: `Sua média passou de ${meta.muito} horas. Se isso é frequente e você ainda acorda cansado, vale conversar com um médico.`, refs: refsIdade });
  }
  if (cansado >= 3) out.avisos.push({ tipo: 'warn', texto: `Você acordou cansado em ${cansado} noites desta semana. Se isso dura um mês ou mais, ou se há ronco com pausas na respiração, procure avaliação médica.`, refs: ['schutte2008', 'kapur2017'] });
  return out;
}

// ---------- dicas ----------
const GERAIS = ['cafeina', 'telas', 'quarto', 'horario', 'alcool'];
export const CAFE_HORAS = 8.8; // horas antes de deitar para uma xícara de café não tirar sono (gardiner2023)
const CAFE_MIN = Math.round(CAFE_HORAS * 60);
// De 3 a 4 dicas: primeiro as que os registros e o perfil pedem (até 3), depois as gerais, que se revezam a cada dia.
// O que muda a meta (idade, gestação, carga de treino, prova) está nos motivos da meta; aqui fica o resto do perfil.
// Cada dica só aparece para quem as fontes dela estudaram:
// - menores de 18: sem álcool; a dica de cafeína é a da Academia Americana de Pediatria (aap2011), sem horário de corte;
//   sem as dicas de treino à noite, emagrecimento e músculo (estudos com adultos);
// - gestantes: sem álcool e sem a dica de emagrecimento;
// - dor e pressão/diabetes/coração: só de 18 a 60 anos, a faixa do consenso de adultos (watson2015);
// - TODAS as dicas de cochilo (sugestão de cochilo curto, cochilo longo, quase todo dia, depois das 16 h, "não repõe a
//   noite" e "evite o cochilo"): só adultos a partir de 19 anos (a meta deles é a da noite) e não gestantes. As fontes
//   são estudos e consensos com adultos; para menores (em quem o cochilo soma à meta) e gestantes não achei fonte.
// Dicas que se contradizem nunca aparecem juntas: "evite o cochilo" exclui todas as outras de cochilo.
// Devolve [{ id, titulo, texto, refs, tom }].
export function dicasDeSono(st, hoje) {
  const p = perfilDeSono(st, hoje);
  return dicasCom(p, semanaCom(st, hoje, metaCom(p)), hoje);
}
function dicasCom(p, sem, hoje) {
  const meta = sem.meta;
  const ids = [];
  const add = (id) => { if (!ids.includes(id)) ids.push(id); };
  if (p.vesperaDeProva) add('vespera'); else if (p.semanaDeProva) add('prova');
  // Dormiu as horas da faixa e mesmo assim acordou cansado em 3 noites ou mais: mais tempo na cama não é a saída.
  // Nunca aparece junto com "faltou sono", que diz para deitar mais cedo.
  const dentro = !!meta && sem.n >= NOITES_PARA_REGULARIDADE && sem.mediaDaMeta >= meta.min && sem.mediaDaMeta <= meta.max;
  const ck = sem.cochilo;
  const estudado = !!meta && !meta.soma24h && !p.gestante; // quem os estudos de cochilo e saúde acompanharam
  let evitar = false; // entrou "evite o cochilo": nenhuma outra dica de cochilo entra (seriam contraditórias)
  if (sem.faltou) {
    add('faltou');
    // já cochila em 3 dias ou mais e a noite segue curta: o cochilo não repõe a noite
    if (estudado && ck.dias >= DIAS_COCHILO_LONGO) add('cochiloNoite');
  } else if (dentro && sem.cansado >= 3) {
    add('acordado');
    if (estudado && ck.dias > 0) { add('semCochilo'); evitar = true; }
  }
  if (estudado && !evitar) {
    if (ck.longos >= DIAS_COCHILO_LONGO) add('cochiloLongo');
    // cochila quase todo dia mesmo com a noite dentro da faixa (ou acima): pode ser sinal de muito sono de dia
    else if (ck.dias >= DIAS_COCHILO_FREQUENTE && sem.n >= NOITES_PARA_REGULARIDADE && sem.media >= meta.min) add('cochiloFrequente');
    if (ck.tardios >= COCHILOS_TARDIOS) add('cochiloTarde');
  }
  if (sem.regularidade === 'irregular') add('irregular');
  if (p.jovem && p.treina) add('jovem');
  if (p.adultoAasm && p.dores > 0) add('dor');
  if (p.adultoAasm && p.saude) add('saude');
  if (p.adulto && p.treinaANoite) add('treinoNoite');
  if (p.adulto && !p.gestante && p.emagrecer) add('emagrecer');
  if (p.adulto && p.musculo) add('musculo');
  if (estudado && !evitar && (p.cargaAlta || sem.faltou) && ck.dias < DIAS_COCHILO_LONGO) add('cochilo'); // quem já cochila não precisa da sugestão
  ids.splice(3);
  const total = Math.min(4, Math.max(3, ids.length + 1));
  const inicio = dia(hoje) ? Math.floor(ms(hoje) / DIA_MS) % GERAIS.length : 0;
  for (let i = 0; i < GERAIS.length && ids.length < total; i++) {
    let id = GERAIS[(inicio + i) % GERAIS.length];
    if (id === 'horario' && ids.includes('irregular')) continue; // as duas dizem a mesma coisa
    if (id === 'alcool' && (!p.adulto || p.gestante)) continue;
    if (id === 'cafeina' && !p.adulto) id = 'cafeinaJovem';
    add(id);
  }
  const deitar = meta && p.acordar ? horaDeDormir(p.acordar, meta.alvo) : '';
  return ids.map((id) => {
    const d = DICAS_SONO[id];
    let texto = d.texto;
    if (id === 'faltou' && meta) texto = `${meta.soma24h ? 'Sua média, com os cochilos,' : 'Sua média'} foi de ${fmtHoras(sem.mediaDaMeta)} em ${sem.n} noites, abaixo do mínimo de ${fmtHoras(meta.min)}. ${texto}`;
    if (id === 'cafeina' && deitar) {
      // conta do aplicativo: as mesmas 8,8 horas do texto (CAFE_HORAS) antes da hora de deitar (gardiner2023), arredondadas
      // para baixo de 10 em 10 minutos
      const m = Number(deitar.slice(0, 2)) * 60 + Number(deitar.slice(3, 5));
      const c = Math.floor(((((m - CAFE_MIN) % 1440) + 1440) % 1440) / 10) * 10;
      texto += ` Para deitar às ${deitar}, o último café fica para até as ${p2(Math.floor(c / 60))}:${p2(c % 60)}.`;
    }
    return { id, titulo: d.titulo, texto, refs: d.refs.slice(), tom: d.tom || '' };
  });
}

// Tudo o que a tela precisa, calculando o perfil uma vez só: { perfil, meta, semana, dicas }.
export function painelDeSono(st, hoje) {
  const perfil = perfilDeSono(st, hoje);
  const meta = metaCom(perfil);
  const semana = semanaCom(st, hoje, meta);
  return { perfil, meta, semana, dicas: dicasCom(perfil, semana, hoje) };
}

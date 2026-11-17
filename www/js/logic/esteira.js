// Corrida do plano na esteira: a pessoa troca a corrida de hoje (ou de um dos próximos 7 dias) pela esteira, e o Treinador
// de corrida ajusta o treino: ritmo em velocidade (km/h), inclinação, troca de velocidade nos tiros, longão e segurança.
// Puro: sem DOM e sem importar o estado. A marcação fica em state.run.esteira = ['AAAA-MM-DD', ...] (validada por
// limparEsteira, aqui, chamada no sanitize do store.js — o mesmo caminho do backup importado).
//
// INTERFACE (usada pela tela do dia de corrida, views/corrida.js, e pelo chat do Treinador de corrida):
//   podeNaEsteira(st, data, hoje?) → { pode: boolean, motivo: string }
//       data 'AAAA-MM-DD'. Não pode: data inválida, dia que já passou, mais de 6 dias à frente, sem plano ativo (sem aceite,
//       pausado, ou suspenso pela triagem de saúde / liberação médica), plano que já é na esteira, sem corrida do plano nesse
//       dia (ou dia tirado por dor), dia da prova, corrida já registrada, dia marcado como "Não corri", cronômetro rodando
//       nesse dia, menos de 16 anos. `motivo` é um texto curto para a pessoa ('' quando pode).
//   versaoNaEsteira(st, data, hoje?) → null (sem treino do plano nesse dia, dia sem corrida por dor, ou plano já na esteira) ou
//       { titulo, linhas: [textos curtos], inclinacao: '1%' | '0 a 1%', velocidades: [{ trecho, kmh, de, ate, texto }],
//         avisos: [textos de segurança], detalhes: [textos do "Por quê?"], refs: [chaves de REFS_CORRIDA],
//         blocos: [blocos do treino para o cronômetro, sem as acelerações curtas, com `vel` e `velPausa` (textos)],
//         resumoBlocos: [textos de cada bloco], tipo }
//       kmh = velocidade do meio da faixa (número, 1 casa); de/ate = ponta lenta e rápida (km/h); texto = '10,6 a 11,2 km/h';
//       seg = ritmo do lado rápido (s/km). Extras: textoNaEsteira(bloco) e etapasNaEsteira(blocos, ritmoPadrao) (cronômetro).
//       Sem ritmos calculados (plano por tempo e esforço), `velocidades` vem vazio e as linhas dizem como escolher pelo esforço.
//   naEsteira(st, data) → boolean
//   marcarEsteira(s, data, sim = true, hoje?) → boolean
//       Muta `s` (use dentro de update()). sim = true marca (false se podeNaEsteira não deixa); sim = false desmarca (false só
//       com data inválida ou com o cronômetro rodando nesse dia). Sempre limpa as datas velhas.
//   hoje (opcional, 'AAAA-MM-DD'): o dia de hoje no fuso do aparelho; os testes passam a data fixa.
//
// O que as fontes sustentam (todas lidas em texto completo):
//  • miller2019 (revisão com metanálise de 34 estudos cruzados, PDF do repositório da Universidade de Maastricht): em
//    velocidade submáxima, o consumo de oxigênio na esteira foi igual ao da rua com 0% ou 1% de inclinação; acima de cerca de
//    80% do VO2máx (13 a 16 km/h nos estudos), "a 1% treadmill grade should be used" (o 1% de Jones e Doust 1996 compensa a
//    falta do vento contra). Frequência cardíaca e esforço percebido na esteira ficaram mais altos nas velocidades rápidas e
//    mais baixos nas lentas (iguais à rua perto de 11 km/h com 1%); para um mesmo esforço, as pessoas escolheram velocidades
//    mais lentas na esteira; o desempenho nos testes de 5 km a 1 hora foi pior nela (cerca de 40 s em 5 km com 0%). Os
//    autores atribuem parte disso ao menor movimento de ar (o suor evapora menos e o corpo esquenta mais) e ao desconforto
//    em velocidade alta; e dizem que a aceleração dos tiros de velocidade é difícil de reproduzir na esteira.
//    → velocidade = a do ritmo do plano (conta exata: km/h = 3600 ÷ segundos por km); 1% nos treinos com trechos rápidos,
//      0 ou 1% nos leves; o esforço manda (se passar do previsto, baixar a velocidade); no longão, água e lugar ventilado; o
//      volume conta igual na semana (o gasto é o mesmo da rua nas velocidades de treino).
//  • proform_manual (manual do usuário de uma esteira doméstica, PDF do fabricante, 2020): usar sempre a chave de segurança
//    presa na roupa e testar dando uns passos para trás; ficar sobre as laterais ao ligar e ao parar a lona; segurar no
//    apoio; mudar a velocidade aos poucos, "to avoid sudden jumps in speed"; a lona "may take a moment" para chegar à
//    velocidade escolhida e muda "gradually"; manter menores de 16 anos longe da esteira.
//    → a troca de velocidade dos tiros vem uns segundos antes do apito; as acelerações curtas (15 s) ficam de fora; na
//      pausa, trote ou caminhada sobre a lona (sem pular para as laterais com a lona rápida); menores de 16 não usam.
//  • ace_maquinas (ACE, texto da Consumer Reports): ficar sobre as laterais ao ligar a esteira e esperar a lona parar de
//    todo antes de descer. São os mesmos cuidados dos exercícios de esteira do catálogo (data/ex/cardio.js).
//  • Hidratação no longão: a mesma regra do Treinador de corrida (kenefick2018; ver o FAQ do calor em data/corrida.js).
// O que NÃO entrou por falta de estudo: dividir o longão em blocos, tempo máximo na esteira, calibração do painel.
import { planoAtual, treinoDoDia, diaValido, somaDias, diasEntre, fmtRitmo, fmtDuracao, fmtKm, expandirBlocos } from './corrida.js';
import { corridaPerdidaEm } from './perdido.js';

export const MAX_DIAS_A_FRENTE = 6; // hoje e os 6 dias seguintes
export const IDADE_MIN = 16; // proform_manual
export const REFS_ESTEIRA = ['miller2019', 'proform_manual', 'ace_maquinas'];
const MAX_MARCAS = 16;
const GUARDA_DIAS = 14; // a marca de um dia que passou fica 2 semanas (o registro desse dia ainda pode ser feito ou editado)

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const pad = (n) => String(n).padStart(2, '0');
export const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const virg = (n) => String(n).replace('.', ',');
// velocidade de um ritmo (segundos por km), com 1 casa, como no painel da esteira
export const kmhDe = (seg) => Math.round(36000 / seg) / 10;
const kmhTxt = (n) => virg(n);
// faixa de ritmo { de (mais rápido), ate (mais lento) } → velocidades: de = ponta lenta, ate = ponta rápida
function faixaKmh(r) {
  const de = kmhDe(r.ate), ate = kmhDe(r.de);
  return { kmh: kmhDe((r.de + r.ate) / 2), de, ate, texto: de === ate ? `${kmhTxt(de)} km/h` : `${kmhTxt(de)} a ${kmhTxt(ate)} km/h`, seg: Math.round(r.de) };
}

// Datas marcadas, validadas: só 'AAAA-MM-DD' de verdade, sem repetição, de 2 semanas atrás até a semana que vem, até 16.
export function limparEsteira(v, hoje = hojeLocal()) {
  if (!Array.isArray(v)) return [];
  const ok = diaValido(hoje);
  const out = new Set();
  for (let i = 0; i < v.length && i < 200; i++) {
    const d = v[i];
    if (!diaValido(d)) continue;
    if (ok && (diasEntre(d, hoje) > GUARDA_DIAS || diasEntre(hoje, d) > MAX_DIAS_A_FRENTE + 1)) continue;
    out.add(d);
  }
  return [...out].sort().slice(-MAX_MARCAS);
}

export const naEsteira = (st, data) => !!(st && isObj(st.run) && Array.isArray(st.run.esteira) && diaValido(data) && st.run.esteira.includes(data));

const cronRodando = (st, data) => { const c = st && isObj(st.run) ? st.run.cron : null; return !!(isObj(c) && c.data === data && !c.terminado); };
const planoJaNaEsteira = (p) => !!p && (p.modo === 'esteira' || (p.perfil && p.perfil.local === 'esteira'));

export function podeNaEsteira(st, data, hoje = hojeLocal()) {
  const nao = (motivo) => ({ pode: false, motivo });
  if (!diaValido(data) || !diaValido(hoje)) return nao('Data inválida.');
  if (data < hoje) return nao('Esse dia já passou.');
  if (diasEntre(hoje, data) > MAX_DIAS_A_FRENTE) return nao('Dá para trocar só os treinos dos próximos 7 dias.');
  const run = st && isObj(st.run) ? st.run : null;
  if (!run || !run.aceitoEm) return nao('Sem plano de corrida ativo.');
  if (run.pausadoEm) return nao('O plano de corrida está pausado.');
  let p = null;
  try { p = planoAtual(st, hoje); } catch { p = null; }
  if (!p) return nao('O plano de corrida está suspenso. Veja o que falta na tela do Treinador de corrida.');
  if (p.perfil && p.perfil.idade < IDADE_MIN) return nao(`Os fabricantes pedem que menores de ${IDADE_MIN} anos não usem a esteira.`);
  if (planoJaNaEsteira(p)) return nao('Seu plano já é feito na esteira.');
  let t = null;
  try { t = treinoDoDia(st, hoje, data); } catch { t = null; }
  if (!t) return nao('Não há corrida do plano nesse dia.');
  if (t.tipo === 'descanso') return nao('Esse dia está sem corrida por causa de uma dor.');
  if (t.tipo === 'prova' && p.perfil && p.perfil.objetivo === 'prova') return nao('No dia da prova, a corrida é no local da prova.');
  if (Array.isArray(st.runs) && st.runs.some((r) => isObj(r) && r.data === data)) return nao('Essa corrida já foi registrada.');
  const perdida = corridaPerdidaEm(st, data);
  if (perdida) return nao(perdida.para ? 'Essa corrida mudou para outro dia.' : 'Você marcou que não correu nesse dia.');
  if (cronRodando(st, data)) return nao('Com o cronômetro rodando, termine ou encerre antes de trocar.');
  return { pode: true, motivo: '' };
}

export function marcarEsteira(s, data, sim = true, hoje = hojeLocal()) {
  if (!s || !isObj(s.run) || !diaValido(data)) return false;
  const lista = limparEsteira(s.run.esteira, hoje).filter((d) => d !== data);
  if (sim) {
    if (!podeNaEsteira(s, data, hoje).pode) return false;
    lista.push(data);
  } else if (cronRodando(s, data)) return false;
  s.run.esteira = limparEsteira(lista, hoje);
  return true;
}

// ---------- a versão do treino na esteira ----------
const ROT_RAPIDO = /ritmo de prova|ritmo de maratona|moderado|teste|prova|limiar/i;
// trecho rápido: bloco forte, ou contínuo em ritmo de prova, moderado ou de teste
const rapido = (b) => b.tipo === 'forte' || (b.tipo === 'correr' && ROT_RAPIDO.test(b.rotulo || ''));
// acelerações curtas (até 20 s): a lona não acelera a tempo e trocas bruscas pedem cuidado (proform_manual, miller2019)
const curtinho = (b) => b.tipo === 'forte' && b.seg > 0 && b.seg <= 20;
const medida = (b) => (b.seg ? fmtDuracao(b.seg) : b.m >= 1000 ? fmtKm(b.m / 1000) : `${b.m} m`);

export function versaoNaEsteira(st, data, hoje = hojeLocal()) {
  if (!diaValido(data) || !diaValido(hoje)) return null;
  let t = null;
  try { t = treinoDoDia(st, hoje, data); } catch { t = null; }
  if (!t || t.tipo === 'descanso' || planoJaNaEsteira(t.plano)) return null;
  const P = t.plano && t.plano.ritmos ? t.plano.ritmos : null;
  const blocos0 = Array.isArray(t.blocos) ? t.blocos : [];
  const semAcel = blocos0.filter((b) => !curtinho(b));
  const tirouAcel = semAcel.length < blocos0.length;
  const comTroca = semAcel.some((b) => b.repeticoes > 1 && b.pausa);
  const forte = t.intensidade === 'forte' || t.intensidade === 'moderada' || semAcel.some(rapido) || t.tipo === 'teste' || t.tipo === 'prova';
  const longo = t.tipo === 'longo';
  const cc = t.tipo === 'corrida_caminhada' || t.tipo === 'caminhada';
  const leveF = P ? faixaKmh(P.leve) : null;
  const trote = leveF ? `até ${kmhTxt(leveF.de)} km/h` : '';
  // velocidade de cada trecho: a do ritmo do bloco; aquecimento na faixa leve; volta à calma e pausas em trote leve
  const blocos = semAcel.map((b) => {
    const vel = b.ritmo ? faixaKmh(b.ritmo).texto : leveF && (b.tipo === 'aquecer' && !cc) ? leveF.texto : leveF && (b.tipo === 'desaquecer' || b.tipo === 'trote') && !cc ? trote : '';
    const velPausa = b.pausa ? (b.pausa.tipo === 'caminhar' ? 'caminhada' : trote ? `trote, ${trote}` : 'trote leve') : '';
    return { ...b, ...(b.pausa ? { pausa: { ...b.pausa } } : {}), vel, velPausa };
  });
  const velocidades = [];
  const vistos = new Set();
  for (const b of semAcel) {
    if (!b.ritmo) continue;
    const f = faixaKmh(b.ritmo);
    const k = (b.rotulo || '') + f.texto;
    if (vistos.has(k)) continue;
    vistos.add(k);
    velocidades.push({ trecho: b.rotulo || t.nome, ...f });
  }
  if (!velocidades.length && t.ritmo) velocidades.push({ trecho: t.nome, ...faixaKmh(t.ritmo) });
  // aquecimento (faixa leve) e trote das pausas e da volta à calma (até a ponta lenta da faixa leve), quando o treino tem
  if (velocidades.length && leveF && !cc) {
    if (semAcel.some((b) => b.tipo === 'aquecer') && !velocidades.some((v) => v.texto === leveF.texto)) velocidades.unshift({ trecho: 'Aquecimento', ...leveF });
    if (semAcel.some((b) => b.tipo === 'desaquecer' || (b.pausa && b.pausa.tipo === 'trote'))) velocidades.push({ trecho: 'Trote (pausas e volta à calma)', kmh: leveF.de, de: leveF.de, ate: leveF.de, texto: trote, seg: P.leve.ate });
  }
  const inclinacao = forte ? '1%' : '0 a 1%';
  const linhas = [];
  linhas.push(forte ? 'Inclinação de 1% o treino todo: compensa o vento que falta nos trechos rápidos.' : 'Inclinação de 0 ou 1%: nas corridas leves, as duas valem como a rua.');
  if (velocidades.length) linhas.push('Velocidades: as do seu ritmo, convertidas para km/h. Se o esforço passar do previsto, baixe a velocidade.');
  else if (t.tipo === 'caminhada') linhas.push('Passo firme: a velocidade em que você anda rápido e ainda conversa.');
  else if (cc) linhas.push('Corrida: a velocidade em que ainda dá para conversar. Caminhada: baixe para um passo firme, sem descer da lona.');
  else linhas.push(`Escolha a velocidade pelo esforço (${t.pse[0]} a ${t.pse[1]} em 10; ${String(t.fala || '').toLowerCase()}). Na esteira, o mesmo esforço sai um pouco mais devagar.`);
  linhas.push(t.tipo === 'caminhada' ? 'Comece devagar e suba a velocidade aos poucos; no fim, baixe antes de parar.' : 'Comece andando e suba a velocidade aos poucos; no fim, baixe para caminhada antes de parar.');
  if (comTroca) linhas.push('Nos tiros, troque a velocidade uns segundos antes do apito: a esteira leva um momento para acelerar e frear. Na pausa, trote ou caminhe sobre a lona.');
  if (tirouAcel) linhas.push('Sem as acelerações curtas: a esteira não acelera a tempo e trocas bruscas de velocidade pedem cuidado.');
  if (longo) linhas.push('Longão: deixe água ao alcance e corra num lugar ventilado. Pode parecer mais pesado que na rua: vale o esforço de conversa.');
  if (t.tipo === 'teste' || t.tipo === 'prova') linhas.push('Na esteira, o teste costuma sair um pouco mais lento que na rua: os ritmos recalculados podem ficar um pouco mais lentos.');
  const avisos = [
    'Prenda a chave de segurança na roupa e teste: dê uns passos para trás e veja se ela solta.',
    'Suba e desça pelas laterais, com a lona parada ou bem lenta, segurando no apoio. Nunca pule da lona em movimento.',
  ];
  const ex = velocidades.find((v) => v.trecho !== 'Aquecimento' && !v.trecho.startsWith('Trote'));
  const detalhes = [
    'Nas velocidades de treino leve, o gasto de energia na esteira é igual ao da rua, com 0% ou 1% de inclinação. Nos trechos rápidos (acima de cerca de 80% do fôlego máximo, 13 a 16 km/h nos estudos), falta o vento contra: 1% de inclinação compensa.',
    'Na esteira, o batimento e o esforço sobem mais nas velocidades rápidas, e as pessoas escolhem velocidades mais lentas para o mesmo esforço. Por isso o esforço do treino é o guia.',
    ex ? `A conta: km/h = 60 ÷ ritmo em minutos por km. Ex.: ${fmtRitmo(ex.seg)} por km = ${kmhTxt(kmhDe(ex.seg))} km/h.` : 'Sem ritmos calculados, o treino vai pelo esforço e pela fala, na rua e na esteira.',
    'A lona leva um momento para chegar à velocidade escolhida e muda aos poucos; mudar de uma vez pode desequilibrar.',
    'A corrida na esteira conta igual na sua semana: a distância e o tempo do painel entram no volume.',
  ];
  if (longo) detalhes.push('Na esteira há menos vento para evaporar o suor e o corpo esquenta mais; os testes longos rendem menos nela. Acima de 1h30, leve também algo para comer.');
  const refs = ['miller2019', 'proform_manual', 'ace_maquinas', ...(longo ? ['kenefick2018'] : [])];
  return { titulo: `${t.nome} na esteira`, linhas, inclinacao, velocidades, avisos, detalhes, refs, blocos, tipo: t.tipo, resumoBlocos: blocos.map((b) => textoNaEsteira(b)) };
}

// texto de um bloco na esteira: "6 × 3 min · 14,2 a 14,8 km/h, com 2 min de trote"
export function textoNaEsteira(b) {
  const base = b.repeticoes > 1 ? `${b.repeticoes} × ${medida(b)}` : medida(b);
  const pausa = b.pausa ? `, com ${fmtDuracao(b.pausa.seg)} de ${b.velPausa || (b.pausa.tipo === 'caminhar' ? 'caminhada' : 'trote')}` : '';
  return `${b.rotulo}: ${base}${b.vel ? ' · ' + b.vel : ''}${pausa}`;
}

// Etapas do cronômetro guiado na esteira (mesma forma de expandirBlocos, em logic/corrida.js), com `vel` em cada etapa.
export function etapasNaEsteira(blocos, ritmoPadrao = 0) {
  const out = [];
  for (const b of Array.isArray(blocos) ? blocos : []) {
    for (const p of expandirBlocos([b], ritmoPadrao)) out.push({ ...p, vel: p.rotulo.startsWith(b.rotulo) ? b.vel || '' : b.velPausa || '' });
  }
  return out;
}

// para os testes e a documentação: dias de hoje em diante com treino que pode ir para a esteira
export function diasPossiveis(st, hoje = hojeLocal()) {
  const out = [];
  for (let k = 0; k <= MAX_DIAS_A_FRENTE; k++) { const d = somaDias(hoje, k); if (podeNaEsteira(st, d, hoje).pode) out.push(d); }
  return out;
}

// Treinador de corrida: entrevista + regras fixas baseadas em estudos publicados (as referências estão em
// data/corrida.js; cada regra aponta a sua). Puro: sem DOM e sem importar o estado. Tudo é determinístico: as mesmas
// respostas, datas e registros geram sempre o mesmo plano.
//
// Resumo do método (detalhes junto de cada regra):
// - Iniciantes: corrida e caminhada por tempo, 3 vezes por semana em dias alternados, em "ritmo de conversa"
//   (buist2008, buist2007, nhs_c25k, kluitenberg2015). IMC de 30 ou mais: menos de 3 km de corrida na 1ª semana (bertelsen2018).
// - Quem já corre: maioria das sessões leve e 1 a 2 fortes por semana, nunca em dias seguidos (seiler2009,
//   boullosa2020, filipas2022, casado2022); parte forte de cada treino pelos limites da página oficial do método de Daniels (vdoto2_definicoes) (10, 8 e 5% do volume); 2 fortes só em
//   semana com 5 ou mais corridas.
// - Ritmos: VDOT de Daniels e Gilbert a partir de um resultado recente (smyth2022, vdoto2_definicoes); previsões por Riegel (vickers2016).
// - Volume: até 10% por semana (soligard2016, knopp2024), semana 30% mais leve a cada quatro (filipas2022, nuuttila2022);
//   treino longo até 10% acima da corrida mais longa dos últimos 30 dias (frandsen2025), até 2h30 (vdoto2_definicoes), e sempre o
//   mais longo da semana.
// - Polimento: corte progressivo de 41 a 60% do volume, mantendo intensidade e frequência (wang2023, smyth2021taper).
// - Ajuste pelo que a pessoa registra: volume feito, esforço percebido (haddad2017, saw2016, meeusen2013), pausa
//   (caterisano2019, zheng2022) e dor (esculier2016, silbernagel2020, moen2012, hoenig2022, zondi2015).
// - Volta de pausa: uma regra só, pelo tempo parado (caterisano2019, vdoto2_definicoes), para a pausa informada na entrevista, a pausa do
//   plano, a percebida pelos registros e a suspensão por dor.
// - Segurança: a prova só é marcada se o maior treino das 4 semanas anteriores chega à metade dela (frandsen2025); com doença
//   do coração, dos rins ou diabetes, plano só com liberação médica (whitfield2017, cdc_intensidade); ritmos só entre a velocidade em
//   que se corre (hreljac2005) e o recorde mundial (wa_recordes).
import { FAIXA_DA_RESPOSTA, FAIXAS_PAUSA } from './pausa.js';
import { LOCAIS_DOR, DIAS_ATIVA, dorDeAlerta, doresAtivas } from './dor.js';
import { comboAtual } from './combinado.js';
import { EX_POR_ID } from '../data/exercises.js';
import { TIPOS_TREINO, DOR_CORRIDA } from '../data/corrida.js';
import { perguntaCondicoes, perguntaTriagem, perguntaRemedios, perguntaLiberado, condicoesDe, sinaisDe, remediosDe, soComSupervisao, respostasProtegidas } from './saude.js';

// ---------- datas (dia = 'AAAA-MM-DD'; contas feitas ao meio-dia UTC para não depender de fuso nem de horário de verão) ----------
const DIA_MS = 86400000;
export const diaValido = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
const ms = (k) => Date.parse(k + 'T12:00:00Z');
export const somaDias = (k, n) => new Date(ms(k) + n * DIA_MS).toISOString().slice(0, 10);
export const diaDaSemana = (k) => new Date(ms(k)).getUTCDay(); // 0 = domingo ... 6 = sábado
export const segundaDe = (k) => somaDias(k, -((diaDaSemana(k) + 6) % 7));
export const diasEntre = (a, b) => Math.round((ms(b) - ms(a)) / DIA_MS);
const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const pos = (wd) => (wd + 6) % 7; // posição na semana que começa na segunda
const distCiclica = (a, b) => { const d = Math.abs(pos(a) - pos(b)); return Math.min(d, 7 - d); };
const vizinhos = (a, b) => distCiclica(a, b) === 1;

// ---------- perguntas ----------
const corre = (a) => ['iniciante', 'regular', 'avancado'].includes(a.experiencia);
const comDistancia = (a) => ['distancia', 'ritmo', 'prova'].includes(a.objetivo);
// condição ou sinal que pede a pergunta da liberação (os remédios entram pelas condições que indicam: logic/saude.js).
// "Um médico disse que só com supervisão" não tem saída pela liberação: o plano não é montado (ver perfil).
const temCondicao = (a) => (condicoesDe(a).length > 0 || sinaisDe(a).length > 0) && !soComSupervisao(a);
const DIAS_OP = [['1', 'Segunda-feira', ''], ['2', 'Terça-feira', ''], ['3', 'Quarta-feira', ''], ['4', 'Quinta-feira', ''], ['5', 'Sexta-feira', ''], ['6', 'Sábado', ''], ['0', 'Domingo', '']];

export const PERGUNTAS = [
  // A idade e as perguntas de segurança vêm primeiro, na ordem do PAR-Q+ (ref parq2023): condições, sinais, remédios e a
  // liberação médica. As opções e a regra estão em logic/saude.js (as mesmas do Treinador).
  // `informar`: o valor de partida não vale como resposta (ver views/coach.js)
  { k: 'idade', tipo: 'numero', informar: true, titulo: 'Quantos anos você tem?', ajuda: 'A idade muda a progressão e os cuidados.', min: 8, max: 99, un: 'anos', padrao: 30 },
  perguntaCondicoes(),
  perguntaTriagem(),
  perguntaRemedios(),
  perguntaLiberado(temCondicao, 'Um médico já liberou você para correr?'),
  {
    k: 'experiencia', tipo: 'um', titulo: 'Como é a sua corrida hoje?',
    ajuda: 'Escolha o que mais parece com você, mesmo que esteja parado agora.',
    op: [
      ['nunca', 'Nunca corri', 'Ou não corro há anos'],
      ['caminha', 'Caminho ou alterno corrida e caminhada', 'Ainda não corro 10 minutos seguidos'],
      // quem corre, mas pouco e sem regularidade: plano por esforço, com 3 corridas curtas por semana (vanpoppel2021, pollock1998)
      ['irregular', 'Corro de vez em quando, devagar', 'Sem regularidade: umas semanas sim, outras não'],
      ['iniciante', 'Corro até uns 30 minutos seguidos', 'Cerca de 3 a 5 km sem parar'],
      ['regular', 'Corro com regularidade', 'De 5 a 10 km sem parar; já penso em ritmo'],
      ['avancado', 'Treino há anos, com bom volume', 'Corro 15 km ou mais; já fiz meia maratona ou maratona'],
    ],
  },
  { k: 'kmSemana', tipo: 'numero', se: corre, titulo: 'Quantos quilômetros você corre por semana?', ajuda: 'A média das últimas semanas em que treinou. Uma estimativa serve.', min: 0, max: 200, un: 'km por semana', padrao: 15 },
  { k: 'longoAtual', tipo: 'numero', se: (a) => corre(a) || a.experiencia === 'irregular', titulo: 'Qual foi a sua corrida mais longa nas últimas 4 semanas?', ajuda: 'O treino longo cresce a partir dela, sem saltos. Se ficou parado, informe a de antes da pausa.', min: 1, max: 60, un: 'km', padrao: 5 },
  {
    // tempo parado: muda o nível e o volume de partida (caterisano2019, zheng2022)
    k: 'pausa', tipo: 'um', opcional: true, se: corre, titulo: 'Há quanto tempo você está sem correr?',
    ajuda: 'A volta depois de uma pausa começa com menos volume e sem treinos fortes.',
    op: [['treinando', 'Estou correndo', 'Sem pausa de 2 semanas ou mais'], ['2a4s', 'De 2 a 4 semanas', ''], ['1a3m', 'De 1 a 3 meses', ''], ['3a6m', 'De 3 a 6 meses', ''], ['mais6m', 'Mais de 6 meses', '']],
  },
  {
    k: 'objetivo', tipo: 'um', titulo: 'Qual é o seu objetivo na corrida?',
    op: [
      // só para quem ainda está na corrida e caminhada (nível 0): para quem já corre, valeria como "Saúde e disposição"
      ['comecar', 'Começar a correr', 'Chegar a 30 minutos de corrida sem parar', (a) => { try { return perfil({ ...a, objetivo: 'saude' }).nivel === 0; } catch { return true; } }],
      ['saude', 'Saúde e disposição', 'Manter uma rotina, sem prova em vista'],
      ['distancia', 'Correr mais longe', 'Completar uma distância sem parar'],
      ['ritmo', 'Correr mais rápido', 'Melhorar o tempo em uma distância'],
      ['prova', 'Preparar uma prova com data', '5 km, 10 km, meia maratona ou maratona'],
    ],
  },
  { k: 'distancia', tipo: 'um', se: comDistancia, titulo: 'Qual distância?', op: [['5', '5 km', ''], ['10', '10 km', ''], ['21', 'Meia maratona', '21,1 km'], ['42', 'Maratona', '42,2 km']] },
  // só muda algo na maratona: o aviso de quem vai fazer a primeira (smyth2021muro, smyth2020vc)
  {
    k: 'provas', tipo: 'um', se: (a) => corre(a) && comDistancia(a) && a.distancia === '42', titulo: 'Você já completou uma maratona?', ajuda: 'Para a primeira maratona, eu explico os cuidados de quem vai completar a distância pela primeira vez. Não muda os treinos.',
    op: [['nenhuma', 'Nunca fiz prova', ''], ['5a10', 'Já fiz 5 km ou 10 km', ''], ['meia', 'Já fiz meia maratona', ''], ['maratona', 'Sim, já completei uma maratona', '']],
  },
  { k: 'semanasProva', tipo: 'numero', se: (a) => a.objetivo === 'prova', titulo: 'Em quantas semanas é a prova?', ajuda: 'Esta semana conta como a primeira. Na proposta eu mostro o dia em que a prova cai, para você conferir.', min: 1, max: 52, un: 'semanas', padrao: 12 },
  { k: 'temAlvo', tipo: 'um', se: (a) => a.objetivo === 'ritmo' || a.objetivo === 'prova', titulo: 'Você tem um tempo em mente?', op: [['nao', 'Não', 'Quero completar bem ou só melhorar'], ['sim', 'Sim', 'Tenho um tempo-alvo']] },
  { k: 'alvoMin', tipo: 'numero', se: (a) => (a.objetivo === 'ritmo' || a.objetivo === 'prova') && a.temAlvo === 'sim', titulo: 'Qual é o tempo-alvo?', ajuda: 'O tempo total da prova, em horas, minutos e segundos. Exemplo: meia maratona em 1 h 58 min 30 s.', min: 12, max: 420, un: 'minutos', padrao: 60, formato: 'tempo' },
  {
    k: 'resultado', tipo: 'um', se: corre, titulo: 'Você tem um resultado recente, de prova ou de treino forte?',
    ajuda: 'Dos últimos 3 meses. Com ele eu calculo os ritmos dos seus treinos. Sem ele, os treinos vão pelo esforço.',
    op: [['3', '3 km', ''], ['5', '5 km', ''], ['10', '10 km', ''], ['21', 'Meia maratona', ''], ['42', 'Maratona', ''], ['nao', 'Não tenho', '']],
  },
  { k: 'resultadoMin', tipo: 'numero', se: (a) => corre(a) && !!a.resultado && a.resultado !== 'nao', titulo: 'Em quanto tempo?', ajuda: 'Em horas, minutos e segundos, como no relógio. Exemplo: 27 min 30 s.', min: 8, max: 420, un: 'minutos', padrao: 30, formato: 'tempo' },
  { k: 'dias', tipo: 'varios', titulo: 'Em quais dias da semana você pode correr?', ajuda: 'Marque os dias possíveis. Eu deixo pelo menos um dia de descanso por semana e evito treinos fortes em dias seguidos.', op: DIAS_OP },
  { k: 'diaLongo', tipo: 'um', se: (a) => Array.isArray(a.dias) && a.dias.length >= 2, titulo: 'Qual é o melhor dia para o treino mais longo?', ajuda: 'Se o dia não estiver entre os que você marcou, eu escolho.', op: [['auto', 'Tanto faz', 'Eu escolho o melhor dia'], ...DIAS_OP] },
  { k: 'tempo', tipo: 'um', titulo: 'Quanto tempo você tem por treino, em um dia comum?', ajuda: 'Conte com aquecimento e volta à calma.', op: [['30', 'Cerca de 30 minutos', ''], ['45', 'Cerca de 45 minutos', ''], ['60', 'Cerca de 1 hora', ''], ['90', 'Até 1h30', '']] },
  { k: 'tempoLongo', tipo: 'um', se: comDistancia, titulo: 'E no dia do treino mais longo?', op: [['60', 'Até 1 hora', ''], ['90', 'Até 1h30', ''], ['120', 'Até 2 horas', ''], ['150', 'Até 2h30', ''], ['180', 'Até 3 horas', 'O treino mais longo do plano vai até 2h30']] },
  {
    // como medir o treino: define se a prescrição sai em distância e ritmo, em velocidade de esteira ou em tempo e esforço
    k: 'aparelho', tipo: 'um', titulo: 'Como você mede as suas corridas?',
    ajuda: 'Para quem está começando, o mais indicado é treinar por tempo e esforço; o relógio serve para registrar.',
    op: [
      ['gps', 'Relógio ou aplicativo com GPS', 'Mostra distância e ritmo (Strava, Garmin e parecidos)'],
      ['esteira', 'Esteira', 'O painel mostra velocidade e distância'],
      ['tempo', 'Só o tempo', 'Cronômetro do celular ou relógio comum'],
      ['nada', 'Não meço', 'Vou pelo que sinto'],
    ],
  },
  { k: 'local', tipo: 'um', titulo: 'Onde você corre na maior parte das vezes?', ajuda: 'Na esteira, os treinos saem em km/h; na pista, os tiros saem em metros. Nos outros lugares, nada muda.', op: [['rua', 'Rua, parque ou calçadão', ''], ['pista', 'Pista de atletismo', ''], ['esteira', 'Esteira', ''], ['varia', 'Varia', '']] },
  { k: 'peso', tipo: 'numero', informar: true, titulo: 'Qual é o seu peso?', ajuda: 'Uma estimativa já serve.', min: 30, max: 250, un: 'kg', padrao: 70, passo: 0.5, dec: 1 },
  { k: 'altura', tipo: 'numero', informar: true, titulo: 'Qual é a sua altura?', ajuda: 'Em centímetros.', min: 120, max: 220, un: 'cm', padrao: 170 },
  { k: 'lesao12m', tipo: 'um', titulo: 'Você teve alguma lesão nos últimos 12 meses?', ajuda: 'Lesão recente é o principal fator de risco para uma nova: o plano sobe mais devagar.', op: [['nao', 'Não', ''], ['sim', 'Sim', 'Precisei parar ou reduzir os treinos']] },
  {
    k: 'limitacoes', tipo: 'varios', titulo: 'Você sente dor em alguma destas regiões hoje?', ajuda: 'O plano começa mais cuidadoso. Depois, use “Contar uma dor” para ele se ajustar ao que você sente.', nenhum: 'nenhuma',
    op: [['joelho', 'Joelho', ''], ['canela', 'Canela', ''], ['aquiles', 'Tendão de Aquiles ou panturrilha', ''], ['pe', 'Pé ou calcanhar', ''], ['quadril', 'Quadril ou virilha', ''], ['coxa', 'Coxa', ''], ['lombar', 'Lombar', ''], ['nenhuma', 'Nenhuma', '']],
  },
];

export const ROTULO = {
  objetivo: { comecar: 'Começar a correr', saude: 'Saúde e disposição', distancia: 'Correr mais longe', ritmo: 'Correr mais rápido', prova: 'Preparar uma prova' },
  nivel: ['Começando', 'Iniciante', 'Intermediário', 'Avançado'],
  distancia: { 5: '5 km', 10: '10 km', 21: 'meia maratona', 42: 'maratona' },
  fase: { adaptacao: 'Corrida e caminhada', base: 'Base', construcao: 'Construção', especifico: 'Específico', polimento: 'Polimento', manutencao: 'Manutenção', caminhada: 'Caminhada' },
  modo: { gps: 'Distância e ritmo', esteira: 'Velocidade da esteira', tempo: 'Tempo e esforço' },
};

export function respostasCompletas(a) {
  if (!a || typeof a !== 'object') return false;
  return PERGUNTAS.every((q) => {
    const v = a[q.k];
    if (v == null && (q.opcional || (q.se && !q.se(a)))) return true;
    if (q.tipo === 'numero') return typeof v === 'number' && v >= q.min && v <= q.max;
    if (q.tipo === 'um') return typeof v === 'string' && q.op.some((o) => o[0] === v);
    return Array.isArray(v) && v.length > 0;
  });
}

// ---------- utilitários ----------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const opcoesDe = (k) => new Set(PERGUNTAS.find((q) => q.k === k).op.map((o) => o[0]));
const OPC = { experiencia: opcoesDe('experiencia'), objetivo: opcoesDe('objetivo'), limitacoes: opcoesDe('limitacoes'), condicoes: opcoesDe('condicoes'), triagem: opcoesDe('triagem') };
const lista = (x, validas) => (Array.isArray(x) ? [...new Set(x.filter((y) => typeof y === 'string' && validas.has(y)))] : []);
const numero = (v, padrao) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
const entre = (v, a, b) => Math.min(b, Math.max(a, v));
const r05 = (x) => Math.round(x * 2) / 2;
const r1 = (x) => Math.round(x * 10) / 10;
const virg = (n) => String(n).replace('.', ',');
const media = (f) => (f.de + f.ate) / 2;
const DIST = { 5: 5, 10: 10, 21: 21.0975, 42: 42.195 };

// ---------- ritmos ----------
// Equações de Daniels e Gilbert, como publicadas em smyth2022: custo de oxigênio da velocidade (m/min) e fração do
// VO2máx que se sustenta por t minutos. VDOT = custo ÷ fração.
const custoO2 = (v) => -4.60 + 0.182258 * v + 0.000104 * v * v;
const fracaoVo2 = (t) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
export function vdotDe(distKm, seg) {
  const t = seg / 60;
  if (!(distKm > 0) || !(t > 0)) return null;
  const v = custoO2((distKm * 1000) / t) / fracaoVo2(t);
  return Number.isFinite(v) && v > 0 ? v : null;
}
// ritmo (s/km) a uma fração do VDOT: raiz positiva da equação do custo de oxigênio
function ritmoNaFracao(vdot, f) {
  const a = 0.000104, b = 0.182258, c = -(4.60 + f * vdot);
  return 60000 / ((-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a));
}
// Fórmula de Riegel (vickers2016): T2 = T1 × (D2 ÷ D1)^k. Com k = 1,06 (o das calculadoras) acerta bem até a meia maratona;
// para a maratona de amadores é otimista (10 min ou mais para metade dos corredores), por isso a previsão de maratona usa
// k = 1,08 (o expoente dos recordes, citado em vickers2016) e uma faixa até 5% mais lenta.
export const riegel = (seg, d1, d2, k = 1.06) => seg * (d2 / d1) ** k;
// Recordes mundiais masculinos ratificados (wa_recordes, consulta em novembro de 2026): [km, segundos]. Nenhum resultado ou
// meta mais rápido que o recorde da distância (ou da distância oficial logo abaixo dela) é aceito.
const RECORDES = [[1.5, 206], [3, 437.55], [5, 755.36], [10, 1571], [21.0975, 3411], [42.195, 7170]];
export function recordeSeg(distKm) {
  let ritmo = RECORDES[0][1] / RECORDES[0][0];
  for (const [d, s] of RECORDES) if (distKm >= d - 0.001) ritmo = s / d;
  return distKm * ritmo;
}
const RITMO_MAX = 570; // ritmo mais lento aceito em um resultado: 9:30 por km
// Velocidade em que as pessoas trocam a caminhada pela corrida: cerca de 7,2 km/h, ou 8:20 por km (6,8 a 7,8 km/h nos
// estudos: hreljac2005; 7,2 km/h em quem não corre: abe2019). Ritmo leve mais lento que isso não é prescrito.
const RITMO_TRANSICAO = 500;
export function resultadoValido(distKm, seg) {
  if (typeof distKm !== 'number' || typeof seg !== 'number' || !(distKm >= 1.5 && distKm <= 60) || !(seg > 0)) return false;
  return seg >= recordeSeg(distKm) && seg / distKm <= RITMO_MAX;
}
// Intensidades (vdoto2_leve, vdoto2_limiar): leve 59 a 74% do VDOT; limiar 83 a 88%. Intervalado: ritmo de prova de 3 a 5 km; tiros: de
// 1,5 a 3 km (haugen2022). A ordem leve > limiar > intervalado > tiros (em s/km) é sempre garantida.
// tempo (s) na distância que corresponde a um VDOT (busca binária: o VDOT cai quando o tempo sobe)
function tempoParaVdot(distKm, alvo) {
  let a = distKm * 100, b = distKm * 1500;
  for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (vdotDe(distKm, m) > alvo) a = m; else b = m; }
  return (a + b) / 2;
}
// Queda do VDOT com o tempo parado, sem treino cruzado (tabela de Daniels: vdoto2_pausa): 14 dias 0,973; 28 dias 0,931;
// 56 dias 0,847; 72 dias ou mais 0,800.
const PAUSA_VDOT = [[5, 1], [14, 0.973], [28, 0.931], [56, 0.847], [72, 0.8]];
export function fatorPausa(dias) {
  const d = Number(dias);
  if (!(d > 5)) return 1;
  for (let i = 1; i < PAUSA_VDOT.length; i++) { const [d0, f0] = PAUSA_VDOT[i - 1], [d1, f1] = PAUSA_VDOT[i]; if (d <= d1) return f0 + ((f1 - f0) * (d - d0)) / (d1 - d0); }
  return 0.8;
}
// ajuste = { pontos: pontos de VDOT a somar, fator: multiplicador do VDOT (pausa) }
export function ritmosDe(distKm, seg0, ajuste = null) {
  if (!resultadoValido(distKm, seg0)) return null;
  const vdot0 = vdotDe(distKm, seg0);
  if (!vdot0) return null;
  const pontos = ajuste && Number.isFinite(ajuste.pontos) ? entre(ajuste.pontos, 0, 10) : 0;
  const fatorV = ajuste && Number.isFinite(ajuste.fator) ? entre(ajuste.fator, 0.8, 1) : 1;
  const vdot = vdot0 * fatorV + pontos;
  const seg = vdot === vdot0 ? seg0 : tempoParaVdot(distKm, vdot);
  const fator = 1;
  const R = (d, k) => riegel(seg, distKm, d, k) / d;
  const leve = { de: ritmoNaFracao(vdot, 0.74), ate: ritmoNaFracao(vdot, 0.59) };
  const limiar = { de: ritmoNaFracao(vdot, 0.88) * fator, ate: ritmoNaFracao(vdot, 0.83) * fator };
  limiar.ate = Math.min(limiar.ate, leve.de - 8); limiar.de = Math.min(limiar.de, limiar.ate - 4);
  const intAte = Math.min(R(5) * fator, limiar.de - 4);
  const intervalado = { de: Math.min(R(3) * fator, intAte - 4), ate: intAte };
  const tirAte = Math.min(R(3) * fator, intervalado.de - 2);
  const tiros = { de: Math.min(R(1.5) * fator, tirAte - 6), ate: tirAte };
  const p10 = Math.min(R(10), leve.de - 6), p21 = Math.min(R(DIST[21]), leve.de - 4), p42 = Math.min(R(DIST[42], 1.08), leve.de - 2);
  const out = {
    vdot: r1(vdot), base: { distKm, seg: Math.round(seg0) },

    leve, regenerativo: { de: ritmoNaFracao(vdot, 0.65), ate: ritmoNaFracao(vdot, 0.59) }, longo: { de: ritmoNaFracao(vdot, 0.72), ate: ritmoNaFracao(vdot, 0.60) },
    limiar, intervalado, tiros,
    prova: { 5: { de: R(5) * 0.99, ate: R(5) * 1.01 }, 10: { de: p10 * 0.99, ate: p10 * 1.01 }, 21: { de: p21, ate: p21 * 1.02 }, 42: { de: p42, ate: p42 * 1.05 } },
    previsoes: { 5: Math.round(R(5) * 5), 10: Math.round(R(10) * 10), 21: Math.round(R(DIST[21]) * DIST[21]), 42: Math.round(R(DIST[42], 1.08) * DIST[42]), maratonaAte: Math.round(R(DIST[42], 1.08) * DIST[42] * 1.05) },
  };
  for (const k of ['leve', 'regenerativo', 'longo', 'limiar', 'intervalado', 'tiros']) out[k] = { de: Math.round(out[k].de), ate: Math.round(out[k].ate) };
  for (const d of [5, 10, 21, 42]) out.prova[d] = { de: Math.round(out.prova[d].de), ate: Math.round(out.prova[d].ate) };
  out.lento = out.leve.de > RITMO_TRANSICAO; // até o leve mais rápido fica abaixo da velocidade em que se corre
  return out;
}

// ---------- formatação (usada pela tela e pelos textos do plano) ----------
const p2 = (n) => String(n).padStart(2, '0');
export const fmtRitmo = (seg) => { const s = Math.round(seg); return `${Math.floor(s / 60)}:${p2(s % 60)}`; };
export const fmtKmh = (seg) => String(Math.round(36000 / seg) / 10).replace('.', ',');
export const fmtKm = (km) => String(Math.round(km * 10) / 10).replace('.', ',') + ' km';
export function fmtTempo(seg) {
  const s = Math.round(seg), hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}h${p2(m)}${ss ? 'min' + p2(ss) + 's' : ''}` : `${m}:${p2(ss)}`;
}
export function fmtDuracao(seg) {
  const s = Math.round(seg);
  if (s < 60) return `${s} s`;
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`;
  const m = Math.round(s / 60);
  return m % 60 ? `${Math.floor(m / 60)}h${p2(m % 60)}` : `${m / 60} h`;
}
// faixa de ritmo no jeito do aparelho da pessoa: min/km, ou km/h na esteira
export function fmtFaixa(f, modo) {
  if (!f) return '';
  if (modo === 'esteira') { const a = fmtKmh(f.ate), b = fmtKmh(f.de); return a === b ? `${a} km/h` : `${a} a ${b} km/h`; }
  return f.de === f.ate ? `${fmtRitmo(f.de)} por km` : `${fmtRitmo(f.de)} a ${fmtRitmo(f.ate)} por km`;
}
const DIAS_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const fmtDia = (k) => `${DIAS_NOME[diaDaSemana(k)]}, ${Number(k.slice(8, 10))}/${k.slice(5, 7)}`;

// ---------- perfil ----------
const TEMPOS = [30, 45, 60, 90];
const TEMPOS_LONGO = [60, 90, 120, 150, 180];
const RITMO_PADRAO = [480, 450, 390, 345]; // ritmo leve estimado (s/km) por nível, só para converter tempo em distância aproximada
const RITMO_CAMINHADA = 630;
const maisPerto = (v, l, padrao) => (Number.isFinite(v) && v > 0 ? l.reduce((m, x) => (Math.abs(x - v) < Math.abs(m - v) ? x : m), l[0]) : padrao);

export function perfil(respostas) {
  const a = isObj(respostas) ? respostas : {};
  const idade = entre(numero(a.idade, 30), 1, 120);
  const exp = OPC.experiencia.has(a.experiencia) ? a.experiencia : 'nunca';
  // condições já com o que os remédios dizem (insulina → diabetes; remédio contínuo sem condição → doença crônica): saude.js
  const cond = condicoesDe(a);
  const tri = sinaisDe(a);
  const remedios = remediosDe(a);
  // remédio que deixa o pulso mais baixo (betabloqueador): as zonas vão pelo esforço e pela fala (sbc2020, pescatello2004)
  const pulsoBaixo = remedios.includes('pulso');
  const lim = lista(a.limitacoes, OPC.limitacoes).filter((x) => x !== 'nenhuma');
  // Quem corre de vez em quando, devagar e sem regularidade: já corre, mas sem base. Parte de 3 corridas curtas por semana
  // (cerca de 9 km: 3 × 22 minutos), o mínimo para o fôlego melhorar sem passar do que protege quem começa (pollock1998).
  const irregular = exp === 'irregular';
  const jaCorre = exp === 'iniciante' || exp === 'regular' || exp === 'avancado' || irregular;
  const km = irregular ? 9 : jaCorre ? entre(numero(a.kmSemana, exp === 'iniciante' ? 8 : exp === 'regular' ? 20 : 40), 0, 200) : 0;
  let nivelBase = exp === 'iniciante' || irregular ? 1 : exp === 'regular' ? (km < 10 ? 1 : 2) : exp === 'avancado' ? (km < 25 ? 2 : 3) : 0;
  // volta de pausa: de 3 a 6 meses, um nível abaixo; mais de 6 meses, recomeço (zheng2022, coyle1994, caterisano2019)
  const retorno = jaCorre ? FAIXA_DA_RESPOSTA[a.pausa] || 0 : 0;
  let nivel = retorno >= 4 ? (nivelBase >= 2 ? 1 : 0) : retorno === 3 ? Math.max(0, nivelBase - 1) : nivelBase;
  // quem está correndo e não passou de 3 km seguidos (cerca de 20 minutos) nas últimas 4 semanas parte do que faz: corrida e
  // caminhada. Na volta de pausa a pergunta vale para antes da pausa, e a regra é a da volta.
  if (jaCorre && retorno === 0 && numero(a.longoAtual, 3) < 3) nivel = 0;
  // "já se exercita com regularidade" na triagem do ACSM (whitfield2017)
  const ativo = jaCorre && !irregular && retorno < 3;
  const pausaDias = FAIXAS_PAUSA[retorno] ? FAIXAS_PAUSA[retorno].meio : 0; // tempo parado representativo da resposta
  const jovem = idade < 18, idoso = idade >= 60, master = idade >= 40;
  const gestante = cond.includes('gestante'), posparto = cond.includes('posparto');
  const cardiaco = cond.includes('cardiaco'), renal = cond.includes('renal'), diabetes = cond.includes('diabetes'), hipertensao = cond.includes('hipertensao'), cronica = cond.includes('cronica');
  const liberado = a.liberado === 'sim';
  // Triagem (whitfield2017): com sintomas, liberação médica antes de qualquer exercício. Com doença do coração, dos
  // rins ou diabetes: quem não se exercita precisa de liberação para começar, e quem já se exercita, para exercício vigoroso
  // (6 METs ou mais) — e correr é vigoroso (cdc_intensidade). Por isso o plano de corrida pede a liberação nos dois casos.
  // Gestação e pós-parto, só com liberação (csep2019, goom2019).
  const precisaLiberacao = tri.length > 0 || gestante || posparto || cardiaco || renal || diabetes;
  // "um médico disse que só com supervisão" (parq2023, pergunta 7): nenhum plano para correr sozinho, mesmo com liberação
  const supervisao = tri.includes('medico');
  const bloqueio = idade < 12 ? 'idade' : supervisao ? 'supervisao' : precisaLiberacao && !liberado ? 'liberacao' : '';
  // Sem treino forte: sintomas, coração, rins, gestação e pós-parto sempre; pressão alta e outra doença crônica enquanto não
  // houver liberação (pescatello2004: intensidade moderada; oms2020 e bredin2013: com doença crônica, intensidade leve a
  // moderada e orientação de um profissional antes de ir além).
  const cautela = tri.length > 0 || cardiaco || renal || diabetes || gestante || posparto || ((hipertensao || cronica) && !liberado);
  // a proposta só é aceita com uma confirmação: quem declarou liberação médica e quem tem doença sem liberação
  const confirmar = precisaLiberacao || ((hipertensao || cronica) && !liberado);
  if (posparto) nivel = 0; // volta sempre por corrida e caminhada (selman2022, goom2019)
  const peso = numero(a.peso, 0), altura = numero(a.altura, 0);
  const imc = peso > 0 && altura > 0 ? peso / ((altura / 100) ** 2) : null;
  const obeso = imc != null && imc >= 30;
  const lesaoPrevia = a.lesao12m === 'sim';
  // dias disponíveis (0 = domingo), na ordem da semana; no máximo 6 sessões: 1 dia de descanso total (meeusen2013, warden2021)
  let dias = Array.isArray(a.dias) ? [...new Set(a.dias.map((x) => (typeof x === 'string' && /^[0-6]$/.test(x) ? Number(x) : -1)).filter((x) => x >= 0))] : [];
  if (!dias.length) dias = [2, 4, 6];
  dias.sort((x, y) => pos(x) - pos(y));
  const pedido = typeof a.diaLongo === 'string' && /^[0-6]$/.test(a.diaLongo) && dias.includes(Number(a.diaLongo)) ? Number(a.diaLongo) : null;
  const diaLongo = pedido != null ? pedido : dias.includes(0) ? 0 : dias.includes(6) ? 6 : dias[dias.length - 1];
  let descansoForcado = null;
  if (dias.length === 7) { descansoForcado = (diaLongo + 1) % 7; dias = dias.filter((d) => d !== descansoForcado); }
  // na gestação, sessões de até 30 minutos (sbc_gestacao2021: 20 a 30 minutos por sessão; csep2019: sem evidência de segurança muito acima da meta)
  const tempo = Math.min(maisPerto(Number(a.tempo), TEMPOS, 45), cond.includes('gestante') ? 30 : 999);
  // objetivo e distância. Idades mínimas: até 5 km aos 12 (fitmodel2025, paz2021) e, em prova oficial, aos 14 (cbat_norma12);
  // 10 km aos 16, meia maratona aos 18 e maratona aos 20 (cbat_norma12, redação de 2025; 10 km aos 16 também em fitmodel2025)
  let objetivo = OPC.objetivo.has(a.objetivo) ? a.objetivo : 'saude';
  let dist = comDistancia({ objetivo }) && DIST[a.distancia] ? Number(a.distancia) : null;
  if (!dist && comDistancia({ objetivo })) dist = 5;
  const distMax = idade < 16 ? 5 : idade < 18 ? 10 : idade < 20 ? 21 : 42;
  const distPedida = dist;
  if (dist && dist > distMax) dist = distMax;
  if (gestante) { objetivo = 'saude'; dist = null; } // na gestação o plano é de manutenção (csep2019, sbc_gestacao2021)
  if (objetivo === 'comecar' && nivel >= 1) objetivo = 'saude';
  if ((cautela || idade < 16) && objetivo === 'ritmo') objetivo = 'distancia'; // sem treino forte, a meta passa a ser completar a distância
  if (idade < 14 && objetivo === 'prova') objetivo = 'distancia'; // prova oficial de rua só a partir dos 14 (cbat_norma12)
  // o treino contínuo mais longo não passa de 150 minutos (vdoto2_definicoes)
  const tempoLongoDito = dist ? Math.max(tempo, maisPerto(Number(a.tempoLongo), TEMPOS_LONGO, 90)) : tempo; // o que a pessoa disse ter no dia mais longo
  const tempoLongo = Math.min(150, tempoLongoDito);
  const semanasProva = objetivo === 'prova' ? Math.round(entre(numero(a.semanasProva, 12), 1, 52)) : null;
  // tempo-alvo: entre o recorde mundial da distância e 12 minutos por km
  const temAlvo = !cautela && idade >= 16 && dist === distPedida && (objetivo === 'ritmo' || objetivo === 'prova') && a.temAlvo === 'sim' && Number.isFinite(a.alvoMin);
  const alvoOk = temAlvo && a.alvoMin >= 12 && a.alvoMin <= 420 && a.alvoMin * 60 >= recordeSeg(DIST[dist]) && (a.alvoMin * 60) / DIST[dist] <= 720;
  const alvoSeg = alvoOk ? a.alvoMin * 60 : null;
  // resultado recente → ritmos
  const rd = jaCorre && !irregular && a.resultado !== 'nao' && ({ 3: 3, ...DIST })[a.resultado];
  const rs = typeof a.resultadoMin === 'number' ? a.resultadoMin * 60 : 0;
  const resultado = rd && resultadoValido(rd, rs) ? { distKm: rd, seg: rs } : null;
  // como medir: iniciantes sempre por tempo e esforço (buist2008, nhs_c25k); com resultado e GPS ou esteira, distância e ritmo
  const aparelho = ['gps', 'esteira', 'tempo', 'nada'].includes(a.aparelho) ? a.aparelho : 'tempo';
  const local = ['rua', 'pista', 'esteira', 'varia'].includes(a.local) ? a.local : 'rua';
  const modo = nivel <= 1 ? 'tempo' : aparelho === 'gps' ? 'gps' : aparelho === 'esteira' || local === 'esteira' ? 'esteira' : 'tempo';
  // Treinos fortes por semana: amadores, 1 a 2 (boullosa2020); 2 só nas semanas com 5 ou mais corridas, como no ensaio com
  // amadores (filipas2022: a conta é feita em cada semana, na curva), e nunca 3 (seiler2009). Fica no piso da faixa (1) quem é
  // iniciante, tem de 16 a 17 anos ou 60 ou mais (a força muscular dos mais velhos leva 48 a 72 h para voltar: borges2016).
  // Nenhum: iniciantes do zero, cautela de saúde (sbc2020, pescatello2004, whitfield2017) e menores de 16 (treino específico só
  // a partir dos 15–16: fitmodel2025).
  let qMax = nivel === 0 || cautela || idade < 16 || (idade < 18 && dist === 10) ? 0 : nivel === 1 || jovem || idoso ? 1 : 2;
  if (dias.length <= 1) qMax = 0;
  const longoAtual = jaCorre ? entre(numero(a.longoAtual, Math.max(3, km * 0.4)), 1, 60) : 0;
  return {
    idade, exp, nivel, nivelBase, retorno, pausaDias, ativo, jaCorre, jovem, idoso, master, gestante, posparto, cardiaco, renal, diabetes, hipertensao, cronica, liberado,
    precisaLiberacao, confirmar, bloqueio, bloqueado: !!bloqueio, cautela, imc, obeso, lesaoPrevia, limitacoes: lim, condicoes: cond, triagem: tri, remedios, pulsoBaixo, supervisao,
    resultadoInvalido: !!rd && typeof a.resultadoMin === 'number' && !resultado, alvoInvalido: temAlvo && !alvoOk,
    dias, diaLongo, descansoForcado, tempo, tempoLongo, objetivo, dist, distPedida, distMax, semanasProva, alvoSeg, resultado, aparelho, local, modo, qMax,
    // irregular: cerca de 3 km (20 a 25 minutos) por dia de corrida, até 3 dias
    kmSemana: irregular ? 3 * Math.min(3, dias.length) : km, longoAtual, tempoLongoDito, provas: ['nenhuma', '5a10', 'meia', 'maratona'].includes(a.provas) ? a.provas : 'nenhuma',
    // passo semanal de volume: até 10% (soligard2016, selman2022); nos planos publicados, 5 a 9% (knopp2024). Quem tem mais
    // risco de lesão fica com 7%, o meio dessa faixa (lesão prévia: vangent2007; idade e IMC: kluitenberg2015)
    // quem corre pouco e sem regularidade também: baixo volume semanal e pouca experiência são fatores de risco (vanpoppel2021)
    passo: lesaoPrevia || idoso || jovem || obeso || lim.length || irregular ? 0.07 : 0.10,
    // corridas por semana: no máximo 3 para quem corre sem regularidade (iniciantes se lesionam mais acima de 3 dias: pollock1998)
    irregular, maxCorridas: irregular ? 3 : 9,
    // começo mais lento no programa de corrida e caminhada (bertelsen2018, chodzko2009, goom2019)
    inicioLento: nivel === 0 && (obeso || idoso || posparto),
  };
}

// Por que o plano não pode ser montado (para a tela explicar). '' = pode.
export const motivoBloqueio = (respostas) => perfil(respostas).bloqueio;
export function avisosBloqueio(respostas) {
  const pf = perfil(respostas);
  if (pf.bloqueio === 'idade') return [{ tipo: 'danger', texto: 'Para menores de 12 anos, não monto plano de corrida. Nessa idade a recomendação é somar 60 minutos por dia de atividades variadas, como brincadeiras e esportes, com orientação de um adulto. Não existem limites de distância por idade comprovados em estudos; por cautela, o treino estruturado fica para depois.', refs: ['oms2020', 'paz2021'] }];
  if (pf.bloqueio === 'supervisao') return [{ tipo: 'danger', texto: 'Um médico já disse que você só deve se exercitar com supervisão. Então a corrida tem de ser feita com um profissional acompanhando, seguindo o que o médico indicou. Não monto plano para correr sozinho, mesmo com liberação.', refs: ['parq2023'] }];
  if (pf.bloqueio === 'liberacao') {
    const out = [];
    if (pf.triagem.length) out.push({ tipo: 'danger', texto: 'Você marcou um sinal de alerta. Com dor ou pressão no peito, falta de ar com pouco esforço, tontura ou desmaio, palpitações, inchaço nos tornozelos, dor na perna ao caminhar ou cansaço fora do comum, a recomendação é procurar um médico antes de qualquer exercício. Não monto plano de corrida até você ter essa liberação.', refs: ['whitfield2017', 'parq2023'] });
    if (pf.gestante) out.push({ tipo: 'danger', texto: 'Na gestação, o exercício é recomendado, mas depende de avaliação: algumas situações contraindicam o esforço. Converse com o seu obstetra e, com a liberação, refaça a entrevista.', refs: ['csep2019', 'sbc_gestacao2021'] });
    if (pf.posparto) out.push({ tipo: 'danger', texto: 'Depois do parto, a volta à corrida deve ser avaliada por um profissional (médico ou fisioterapeuta pélvica). O prazo é individual: nunca antes de 3 semanas, com as lesões do parto cicatrizadas, e as diretrizes de fisioterapeutas de 2019 sugerem esperar 12 semanas. Antes de correr, é preciso caminhar 30 minutos sem escape de urina, sensação de peso na vagina ou dor pélvica. Com a liberação, refaça a entrevista.', refs: ['christopher2024', 'selman2022', 'goom2019'] });
    if (pf.cardiaco || pf.renal || pf.diabetes) out.push({ tipo: 'danger', texto: pf.ativo
      ? 'Com doença do coração, dos rins ou diabetes, a recomendação é ter liberação médica (dos últimos 12 meses) antes de exercício vigoroso, e correr conta como vigoroso. Enquanto isso, você pode manter atividade moderada, como caminhada rápida. Com a liberação, refaça a entrevista.'
      : 'Quem tem doença do coração, dos rins ou diabetes e não se exercita com regularidade precisa de liberação médica antes de começar. Com a liberação, refaça a entrevista.', refs: ['whitfield2017', 'cdc_intensidade'] });
    return out;
  }
  return [];
}

// ---------- zonas ----------
// Âncoras: teste da fala em três níveis (foster2020), esforço de 1 a 10 com cortes ≤4, 5–6 e ≥7
// (haddad2017, ieno2020) e % da frequência máxima (haugen2022).
// Frequência máxima estimada: 208 − 0,7 × idade (tanaka2001), com erro de cerca de 11 batimentos (shookster2020).
// Com remédio que deixa o pulso mais baixo (betabloqueador), os batimentos não medem o esforço: as zonas ficam só com o
// esforço e a fala, sem frequência cardíaca (sbc2020, pescatello2004). `fcMax` = null.
export function zonasDe(pf, ritmos) {
  const fcMax = pf.pulsoBaixo ? null : Math.round(208 - 0.7 * pf.idade);
  const bpm = (a, b) => (fcMax ? [Math.round(fcMax * a), Math.round(fcMax * b)] : null);
  return {
    fcMax,
    lista: [
      { id: 'leve', nome: 'Leve', pse: [2, 4], fala: 'Frases inteiras, com conforto', fc: bpm(0.6, 0.82), ritmo: ritmos ? ritmos.leve : null, paraQue: 'Rodagens, longão e regenerativo: a maior parte do treino.' },
      { id: 'moderado', nome: 'Moderado (limiar)', pse: [5, 6], fala: 'Falar já exige esforço: só frases curtas', fc: bpm(0.83, 0.9), ritmo: ritmos ? ritmos.limiar : null, paraQue: 'Tempo run e finais de progressivo.' },
      { id: 'forte', nome: 'Forte', pse: [7, 9], fala: 'Não dá para falar com conforto', fc: bpm(0.9, 0.97), ritmo: ritmos ? ritmos.intervalado : null, paraQue: 'Intervalado e trechos fortes do fartlek.' },
      { id: 'tiros', nome: 'Muito rápido e curto', pse: [8, 9], fala: 'Não dá para conversar', fc: null, ritmo: ritmos ? ritmos.tiros : null, paraQue: 'Tiros curtos, com pausa longa.' },
    ],
  };
}

// ---------- blocos de um treino ----------
// bloco: { rotulo, tipo, seg | m, repeticoes?, pausa?: { tipo, seg }, ritmo? }. `ritmo` em s/km: { de (mais rápido), ate (mais lento) }.
const bl = (rotulo, tipo, extra) => ({ rotulo, tipo, ...extra });
// Lista plana para o cronômetro guiado: cada passo com tipo, rótulo e duração em segundos (blocos por distância usam o
// ritmo médio; sem ritmo, ficam com seg = 0 e a pessoa avança à mão).
export function expandirBlocos(blocos, ritmoPadrao = 0) {
  const out = [];
  const dur = (b) => (b.seg ? b.seg : b.m && (b.ritmo || ritmoPadrao) ? Math.round((b.m / 1000) * (b.ritmo ? media(b.ritmo) : ritmoPadrao)) : 0);
  for (const b of Array.isArray(blocos) ? blocos : []) {
    const n = Math.max(1, Math.round(b.repeticoes || 1));
    for (let i = 0; i < n; i++) {
      out.push({ tipo: b.tipo, rotulo: n > 1 ? `${b.rotulo} ${i + 1} de ${n}` : b.rotulo, seg: dur(b), m: b.m || 0, estimado: !b.seg });
      if (b.pausa && (i < n - 1 || b.pausaFinal)) out.push({ tipo: b.pausa.tipo, rotulo: b.pausa.tipo === 'caminhar' ? 'Caminhada' : 'Trote leve', seg: b.pausa.seg, m: 0, estimado: false });
    }
  }
  return out;
}
const VERBO = { aquecer: 'aquecimento', correr: 'corrida', caminhar: 'caminhada', trote: 'trote', forte: 'forte', desaquecer: 'volta à calma' };
const medida = (b) => (b.seg ? fmtDuracao(b.seg) : b.m >= 1000 ? fmtKm(b.m / 1000) : `${b.m} m`);
// texto de um bloco: "6 × 3 min forte, com 2 min de trote leve"
export function textoBloco(b, modo) {
  const base = b.repeticoes > 1 ? `${b.repeticoes} × ${medida(b)}` : medida(b);
  const pausa = b.pausa ? `, com ${fmtDuracao(b.pausa.seg)} de ${b.pausa.tipo === 'caminhar' ? 'caminhada' : 'trote leve'}` : '';
  const r = b.ritmo ? ` (${fmtFaixa(b.ritmo, modo)})` : '';
  return `${b.rotulo}: ${base}${pausa}${r}`;
}

// ---------- montagem de cada treino ----------
// Contexto de montagem: c = { pf, P (ritmos ou null), est (ritmos estimados em s/km), porDist (bool), modo }
function contexto(pf, P, estFixo = 0) {
  const leve = P ? media(P.leve) : estFixo || RITMO_PADRAO[pf.nivel];
  return {
    pf, P, modo: pf.modo, porDist: pf.modo !== 'tempo' && pf.nivel >= 2,
    est: { leve, reg: P ? media(P.regenerativo) : leve * 1.06, longo: P ? media(P.longo) : leve * 1.02, limiar: P ? media(P.limiar) : leve * 0.86, forte: P ? media(P.intervalado) : leve * 0.79, tiros: P ? media(P.tiros) : leve * 0.73, trote: leve * 1.1 },
  };
}
const PSE = { caminhada: [2, 3], corrida_caminhada: [3, 5], leve: [2, 4], regenerativo: [2, 3], longo: [3, 4], progressivo: [3, 6], fartlek: [6, 7], tempo: [5, 6], intervalado: [7, 9], tiros: [8, 9], ritmo: [5, 6], teste: [8, 9], prova: [7, 10], descanso: [0, 0] };
const FALA = { caminhada: 'Conversa normal', corrida_caminhada: 'Dá para conversar enquanto corre', leve: 'Frases inteiras, com conforto', regenerativo: 'Conversa fácil', longo: 'Frases inteiras, com conforto', progressivo: 'Frases inteiras no começo, curtas no fim', fartlek: 'Frases curtas nos trechos fortes', tempo: 'Só frases curtas', intervalado: 'Poucas palavras nos tiros', tiros: 'Sem conversa nos tiros; fôlego recuperado antes do próximo', ritmo: 'Frases curtas', teste: 'Sem conversa', prova: 'Sem conversa', descanso: '' };
const INTENS = { caminhada: 'leve', corrida_caminhada: 'leve', leve: 'leve', regenerativo: 'leve', longo: 'leve', progressivo: 'moderada', ritmo: 'moderada', fartlek: 'forte', tempo: 'forte', intervalado: 'forte', tiros: 'forte', teste: 'forte', prova: 'forte', descanso: 'leve' };
const FORTES = new Set(['fartlek', 'tempo', 'intervalado', 'tiros', 'progressivo', 'ritmo', 'teste', 'prova']);

// soma os blocos: duração (min) e distância (km) aproximadas
function totais(blocos, c) {
  let seg = 0, km = 0;
  const ritmoDe = (tipo, r) => (r ? media(r) : tipo === 'caminhar' ? RITMO_CAMINHADA : tipo === 'forte' ? c.est.forte : tipo === 'trote' ? c.est.trote : c.est.leve);
  for (const b of blocos) {
    const n = Math.max(1, b.repeticoes || 1), p = ritmoDe(b.tipo, b.ritmo);
    const s = b.seg ? b.seg : (b.m / 1000) * p, k = b.seg ? b.seg / p : b.m / 1000;
    seg += n * s; km += n * k;
    if (b.pausa) { const np = b.pausaFinal ? n : n - 1; seg += np * b.pausa.seg; km += (np * b.pausa.seg) / ritmoDe(b.pausa.tipo); }
  }
  return { durMin: Math.max(1, Math.round(seg / 60)), distKm: r1(km) };
}
function treino(tipo, blocos, c, extra = {}) {
  const t = totais(blocos, c);
  const corrida = tipo !== 'caminhada' && tipo !== 'descanso';
  return {
    tipo, nome: TIPOS_TREINO[tipo].nome, resumo: '', detalhe: '', distKm: corrida || tipo === 'caminhada' ? t.distKm : 0, durMin: t.durMin, intensidade: INTENS[tipo],
    ritmo: null, blocos, pse: PSE[tipo], fala: FALA[tipo], modo: c.modo, ...extra,
  };
}
const aprox = (d) => `cerca de ${d.durMin} min`;
// corrida contínua: por distância (GPS/esteira, nível 2 ou mais) ou por tempo
function continuo(rotulo, km, ritmo, c, tipoBloco = 'correr', paraBaixo = false) {
  if (c.porDist) return bl(rotulo, tipoBloco, { m: Math.max(500, Math.round(km * 2) * 500), ...(ritmo ? { ritmo } : {}) });
  // por tempo: múltiplos de 5 min (o treino longo arredonda para baixo, para nunca passar do limite de progressão)
  const cinco = (km * (ritmo ? media(ritmo) : c.est.leve)) / 300;
  const min = Math.max(10, (paraBaixo ? Math.floor(cinco + 0.02) : Math.round(cinco)) * 5);
  return bl(rotulo, tipoBloco, { seg: min * 60, ...(ritmo ? { ritmo } : {}) });
}
function tLeve(km, c, { strides = false, curto = false } = {}) {
  const P = c.P;
  const blocos = [continuo('Corrida leve', km, P ? P.leve : null, c)];
  // acelerações: 5 a 15 segundos rápidos e soltos, com recuperação completa, depois da rodagem (haugen2022)
  if (strides) blocos.push(bl('Acelerações', 'forte', { seg: 15, repeticoes: 6, pausa: { tipo: 'caminhar', seg: 60 } }));
  const d = treino('leve', blocos, c, { ritmo: P ? P.leve : null });
  d.resumo = `${c.porDist ? fmtKm(blocos[0].m / 1000) : fmtDuracao(blocos[0].seg)} em ritmo leve${strides ? ' + 6 acelerações' : ''}${c.porDist ? ' · ' + aprox(d) : ''}`;
  d.detalhe = curto ? 'Bem leve, só para soltar as pernas antes do dia importante.' : 'Ritmo confortável do começo ao fim. Se não der para falar frases inteiras, diminua.' + (strides ? ' No final, 6 acelerações de 15 segundos, rápidas e soltas, caminhando 1 minuto entre elas.' : '');
  return d;
}
function tRegenerativo(km, c) {
  const P = c.P;
  const blocos = [continuo('Corrida bem leve', km, P ? P.regenerativo : null, c)];
  const d = treino('regenerativo', blocos, c, { ritmo: P ? P.regenerativo : null });
  d.resumo = `${c.porDist ? fmtKm(blocos[0].m / 1000) : fmtDuracao(blocos[0].seg)} bem leve`;
  d.detalhe = 'Curto e lento, para recuperar do treino anterior. Se estiver muito cansado, troque por uma caminhada.';
  return d;
}
function tLongo(km, c, finalKm = 0) {
  const P = c.P, pf = c.pf;
  const blocos = [];
  const rp = P && pf.dist ? P.prova[pf.dist] : null;
  const nomeFinal = pf.dist === 42 ? 'Ritmo de maratona' : 'Ritmo de prova';
  // por tempo, o longo com final em ritmo de prova dura o mesmo que o longo simples: o final sai do tempo total
  const totalMin = Math.max(10, Math.floor((km * (P ? media(P.longo) : c.est.leve)) / 300 + 0.02) * 5);
  const finalMin = Math.max(10, Math.round((finalKm * (rp ? media(rp) : c.est.leve)) / 300) * 5);
  if (finalKm > 0 && km - finalKm >= 3 && c.porDist) {
    blocos.push(continuo('Corrida leve', km - finalKm, P ? P.longo : null, c, 'correr', true));
    blocos.push(continuo(nomeFinal, finalKm, rp, c, 'correr', true));
  } else if (finalKm > 0 && km - finalKm >= 3 && totalMin - finalMin >= 15) {
    blocos.push(bl('Corrida leve', 'correr', { seg: (totalMin - finalMin) * 60, ...(P ? { ritmo: P.longo } : {}) }));
    blocos.push(bl(nomeFinal, 'correr', { seg: finalMin * 60, ...(rp ? { ritmo: rp } : {}) }));
  } else blocos.push(continuo('Corrida leve e longa', km, P ? P.longo : null, c, 'correr', true));
  const d = treino('longo', blocos, c, { ritmo: P ? P.longo : null });
  const total = c.porDist ? fmtKm(blocos.reduce((s, b) => s + b.m, 0) / 1000) : fmtDuracao(blocos.reduce((s, b) => s + b.seg, 0));
  d.resumo = blocos.length > 1 ? `${total}: leve, com o final em ritmo de prova · ${aprox(d)}` : `${total} em ritmo leve${c.porDist ? ' · ' + aprox(d) : ''}`;
  d.detalhe = (blocos.length > 1 ? 'Comece leve e entre no ritmo de prova só no trecho final. ' : 'Ritmo de conversa do começo ao fim: o que conta aqui é o tempo correndo. ') + (pf.nivel <= 1 ? 'Pode caminhar 1 minuto de vez em quando.' : d.durMin > 90 ? 'Leve água e, acima de 1h30, algo para comer.' : '');
  if (blocos.length > 1) d.intensidade = 'moderada';
  return d;
}
const aquecer = (c, min) => bl('Aquecimento em corrida leve', 'aquecer', { seg: min * 60 });
const desaquecer = (c, min) => bl('Volta à calma em trote leve', 'desaquecer', { seg: min * 60 });
// encurta o treino para caber no tempo: primeiro repetições, depois aquecimento e volta à calma
function caber(blocos, c, maxMin, iPrincipal, minReps) {
  for (let k = 0; k < 40 && totais(blocos, c).durMin > maxMin; k++) {
    const b = blocos[iPrincipal];
    if (b.repeticoes > minReps) b.repeticoes--;
    else if (!b.repeticoes && b.seg > 480) b.seg -= 120;
    else if (blocos[0].seg > 480) blocos[0].seg -= 120;
    else if (blocos[blocos.length - 1].seg > 300) blocos[blocos.length - 1].seg -= 120;
    else break;
  }
  return blocos;
}
// k = quantas vezes este tipo já apareceu no plano (a dose cresce aos poucos); f = fator de dose (descarga e polimento)
function tQualidade(tipo, k, c, vol, f, maxMin) {
  const { pf, P } = c;
  const n1 = pf.nivel <= 1;
  const aq = 10, des = 5; // 10 min de aquecimento e alguns de volta à calma, como nos ensaios de intervalado (haugen2022)
  // Parte forte de cada treino, em minutos, pelos limites da página oficial do método de Daniels (vdoto2_definicoes) sobre o volume da semana: limiar até 10%, intervalado até
  // 8% (ou 10 km), tiros até 5% (ou 8 km) (vdoto2_definicoes). Com isso a semana fica com pelo menos 75 a 80% de volume leve
  // (boullosa2020, haugen2022).
  const tetoMin = (pct, ritmo) => (pct * vol * ritmo) / 60;
  let blocos, d;
  if (tipo === 'progressivo') {
    // começa leve e termina perto do ritmo de meia maratona (haugen2022)
    const total = entre(Math.round((n1 ? 30 : 40) + 2 * Math.min(k, 5)), 25, maxMin);
    const fim = Math.round(entre(Math.min(total * 0.2 * f, tetoMin(0.10, c.est.limiar)), 4, 12)), meio = Math.round(total * 0.3);
    blocos = [
      bl('Corrida leve', 'correr', { seg: (total - meio - fim) * 60, ...(P ? { ritmo: P.leve } : {}) }),
      bl('Ritmo moderado', 'correr', { seg: meio * 60, ...(P ? { ritmo: { de: P.limiar.ate + 5, ate: P.leve.de } } : {}) }),
      bl('Final forte', 'forte', { seg: fim * 60, ...(P ? { ritmo: P.limiar } : {}) }),
    ];
    d = treino(tipo, blocos, c, { ritmo: P ? P.limiar : null });
    d.resumo = `${total} min: começa leve e termina forte (${fim} min finais)`;
    d.detalhe = 'Aumente o ritmo aos poucos, em três partes. O final é forte, mas controlado: não é tiro.';
    return d;
  }
  if (tipo === 'fartlek') {
    const longos = k % 2 === 1;
    const n = Math.max(3, Math.min(Math.round((longos ? Math.min(4 + (k - 1) / 2, 6) : Math.min((n1 ? 5 : 6) + k / 2, n1 ? 8 : 10)) * f), Math.floor(tetoMin(0.08, c.est.forte) / (longos ? 2 : 1))));
    blocos = [aquecer(c, aq), bl('Trecho forte', 'forte', { seg: longos ? 120 : 60, repeticoes: n, pausa: { tipo: 'trote', seg: 120 } }), desaquecer(c, des)];
    caber(blocos, c, maxMin, 1, 3);
    d = treino(tipo, blocos, c);
    d.resumo = `Aquecimento + ${blocos[1].repeticoes} × ${longos ? '2 min' : '1 min'} forte (2 min de trote) + volta à calma · ${aprox(d)}`;
    d.detalhe = 'Nos trechos fortes, acelere até um esforço de 6 a 7 em 10, sem dar tudo. Entre eles, trote bem devagar até o fôlego voltar.';
    return d;
  }
  if (tipo === 'tempo') {
    // limiar: cerca de 20 min contínuos ou até 30 min em blocos com pausa curta; no máximo 10% do volume semanal (vdoto2_definicoes)
    const teto = Math.max(8, tetoMin(0.10, c.est.limiar));
    const alvo = Math.max(8, Math.min(n1 ? 12 + 2 * k : pf.nivel === 2 ? 15 + 2 * k : 20 + 2 * k, n1 ? 24 : pf.nivel === 2 ? 25 : 30, teto) * f);
    const cont = !n1 && k % 2 === 1;
    const ritmo = P ? P.limiar : null;
    if (cont) blocos = [aquecer(c, aq), bl('Ritmo de limiar', 'forte', { seg: Math.round(Math.min(alvo, pf.nivel === 3 ? 25 : 20)) * 60, ...(ritmo ? { ritmo } : {}) }), desaquecer(c, des)];
    else { const rep = alvo >= 24 ? 8 : 6; blocos = [aquecer(c, aq), bl('Ritmo de limiar', 'forte', { seg: rep * 60, repeticoes: Math.max(2, Math.round(alvo / rep)), pausa: { tipo: 'trote', seg: 90 }, ...(ritmo ? { ritmo } : {}) }), desaquecer(c, des)]; }
    caber(blocos, c, maxMin, 1, 2);
    d = treino(tipo, blocos, c, { ritmo });
    const b = blocos[1];
    d.resumo = `Aquecimento + ${b.repeticoes ? `${b.repeticoes} × ${b.seg / 60} min` : `${b.seg / 60} min`} em ritmo de limiar${b.repeticoes ? ' (1min30 de trote)' : ''} + volta à calma · ${aprox(d)}`;
    d.detalhe = 'Ritmo “confortavelmente difícil”: você conseguiria manter por quase uma hora em prova. Constante do começo ao fim.';
    return d;
  }
  if (tipo === 'intervalado') {
    // tiros de 2 a 4 min em ritmo de 3 a 5 km, com 15 a 20 min fortes no total (haugen2022); 4 × 4 min com 3 min de trote (haugen2022)
    const alvo = Math.min(pf.nivel === 2 ? 12 + k : 15 + k, pf.nivel === 2 ? 16 : 20, Math.max(8, tetoMin(0.08, c.est.forte))) * f;
    const [rep, pausa] = [[180, 120], [240, 180], [120, 90]][k % 3];
    const ritmo = P ? P.intervalado : null;
    blocos = [aquecer(c, aq), bl('Tiro forte', 'forte', { seg: rep, repeticoes: Math.max(3, Math.round((alvo * 60) / rep)), pausa: { tipo: 'trote', seg: pausa }, ...(ritmo ? { ritmo } : {}) }), desaquecer(c, des)];
    caber(blocos, c, maxMin, 1, 3);
    d = treino(tipo, blocos, c, { ritmo });
    d.resumo = `Aquecimento + ${blocos[1].repeticoes} × ${rep / 60} min forte (${fmtDuracao(pausa)} de trote) + volta à calma · ${aprox(d)}`;
    d.detalhe = 'Tiros em esforço de 7 a 9 em 10, todos no mesmo ritmo: se o último sair mais lento, o primeiro foi rápido demais. Trote leve nas pausas.';
    return d;
  }
  if (tipo === 'tiros') {
    // repetições de até 2 min, com pausa longa; no máximo 5% do volume semanal (vdoto2_definicoes)
    const n = entre(Math.round(((0.05 * vol) / 0.4) * f), 4, pf.nivel === 3 ? 12 : 8);
    const ritmo = P ? P.tiros : null;
    const porM = c.modo === 'gps' || pf.local === 'pista';
    blocos = [aquecer(c, aq), bl('Tiro rápido', 'forte', { ...(porM ? { m: 400 } : { seg: 80 }), repeticoes: n, pausa: { tipo: 'trote', seg: 150 }, ...(ritmo ? { ritmo } : {}) }), desaquecer(c, des)];
    caber(blocos, c, maxMin, 1, 4);
    d = treino(tipo, blocos, c, { ritmo });
    d.resumo = `Aquecimento + ${blocos[1].repeticoes} × ${porM ? '400 m' : '1min20'} rápido (2min30 de trote) + volta à calma · ${aprox(d)}`;
    d.detalhe = 'Rápido e solto, sem dar tudo. A pausa é longa de propósito: comece o próximo com o fôlego recuperado.';
    return d;
  }
  // ritmo de prova (meia e maratona): bloco contínuo no ritmo planejado; maratona: a página oficial dá no máximo 20% do volume da semana ou 29 km (vdoto2_definicoes); aqui, até 16 km
  const km = pf.dist === 42 ? entre(6 + 2 * k, 6, pf.nivel === 3 ? 16 : 12) * f : entre(4 + k, 4, 10) * f;
  const ritmo = P && pf.dist ? P.prova[pf.dist] : null;
  blocos = [aquecer(c, 10), continuo(pf.dist === 42 ? 'Ritmo de maratona' : 'Ritmo de prova', Math.max(3, km), ritmo, c), desaquecer(c, 5)];
  for (let i = 0; i < 30 && totais(blocos, c).durMin > maxMin; i++) { if (blocos[1].m > 2000) blocos[1].m -= 500; else if (blocos[1].seg > 600) blocos[1].seg -= 300; else if (blocos[0].seg > 300) blocos[0].seg -= 120; else break; }
  d = treino('ritmo', blocos, c, { ritmo });
  d.resumo = `Aquecimento + ${medida(blocos[1])} em ritmo de prova + volta à calma · ${aprox(d)}`;
  d.detalhe = 'Aprenda a sensação do ritmo da prova: controlado, constante, sem acelerar no final.';
  return d;
}
function tCaminhada(min, c, nome) {
  const d = treino('caminhada', [bl('Caminhada em passo firme', 'caminhar', { seg: min * 60 })], c);
  if (nome) d.nome = nome;
  d.resumo = `${min} min de caminhada em passo firme`;
  d.detalhe = nome ? 'Outro esporte, bicicleta ou brincadeira ativa também valem: nessa idade, variar é o que se recomenda.' : 'Passo acelerado, mas ainda dá para conversar. Conta para a saúde e não soma impacto.';
  return d;
}

// ---------- programa de corrida e caminhada (nível 0) ----------
// Cada etapa tem 3 sessões; cada sessão é uma lista de [corrida s, caminhada s, repetições]. Minutos de corrida por semana:
// (12 no pós-parto,) 18, 24, 30, 36, 36, 40, 45, 48, 54, 60, 66, 75, 70, 80: perto do programa gradual do GRONORUN (30 a 90 min em 12 semanas,
// buist2008/buist2007) e do NHS (nhs_c25k), sempre com no máximo 10 min a mais de uma semana para a outra. As duas
// primeiras etapas (18 e 24 min) são o começo lento: menos de 3 km de corrida na 1ª semana (bertelsen2018).
const tres = (s) => [s, s, s];
const ETAPAS = [
  tres([[30, 90, 8]]), // só no pós-parto: 30 segundos de corrida com caminhada (selman2022)
  tres([[60, 120, 6]]), tres([[60, 90, 8]]),
  tres([[60, 60, 10]]), tres([[120, 120, 6]]), tres([[180, 120, 4]]), [[[240, 120, 3]], [[240, 120, 3]], [[240, 120, 4]]],
  tres([[300, 120, 3]]), [[[300, 120, 3]], [[300, 120, 3]], [[360, 120, 3]]], tres([[360, 120, 3]]), tres([[600, 120, 2]]),
  tres([[720, 120, 1], [600, 0, 1]]), tres([[900, 120, 1], [600, 0, 1]]),
  [[[1200, 0, 1]], [[900, 120, 1], [600, 0, 1]], [[1500, 0, 1]]], [[[1500, 0, 1]], [[1500, 0, 1]], [[1800, 0, 1]]],
];
export const ETAPAS_CC = ETAPAS.length;
function tCC(etapa, i, c) {
  const partes = ETAPAS[entre(etapa, 0, ETAPAS.length - 1)][i].map((p) => p.slice());
  // Cada sessão tem 5 minutos de caminhada antes e depois (nhs_c25k). Quem tem cerca de 30 minutos por treino fica com 3 minutos
  // de cada lado e, nas últimas etapas, com um pouco menos de corrida: o treino não passa do tempo informado.
  const limite = c.pf.tempo * 60 + 120;
  const total = (cam) => 2 * cam + partes.reduce((s, [a, b, n]) => s + n * (a + b), 0);
  let cam = 300;
  if (total(cam) > limite) cam = 180;
  for (let k = 0; k < 80 && total(cam) > limite; k++) {
    const p = partes[partes.length - 1];
    if (p[2] > 2) p[2]--; else if (p[0] > 300) p[0] -= 60; else if (partes[0][0] > 300) partes[0][0] -= 60; else break;
  }
  const blocos = [bl('Caminhada para aquecer', 'aquecer', { seg: cam })];
  for (const [corr, camin, n] of partes) {
    const b = bl('Corrida leve', 'correr', { seg: corr });
    if (n > 1) b.repeticoes = n;
    if (camin > 0) { b.pausa = { tipo: 'caminhar', seg: camin }; b.pausaFinal = true; }
    blocos.push(b);
  }
  blocos.push(bl('Caminhada para desacelerar', 'desaquecer', { seg: cam }));
  const d = treino('corrida_caminhada', blocos, c);
  const corrida = partes.reduce((s, [a, , n]) => s + a * n, 0);
  d.corridaMin = Math.round(corrida / 60);
  d.corridaKm = r1(corrida / c.est.leve); // só a parte corrida
  const txt = partes.map(([a, b, n]) => (n > 1 ? `${n} × (${fmtDuracao(a)} correndo + ${fmtDuracao(b)} caminhando)` : b ? `${fmtDuracao(a)} correndo + ${fmtDuracao(b)} caminhando` : `${fmtDuracao(a)} correndo sem parar`)).join(', depois ');
  d.resumo = `${txt} · ${d.durMin} min com aquecimento`;
  d.detalhe = `Comece e termine com ${cam / 60} minutos de caminhada. Corra devagar, em ritmo que dê para conversar; se faltar fôlego, diminua o passo. Pode repetir esta semana se achar pesado.`;
  // distância da sessão inteira, corrida e caminhada (para a regra de volume)
  d.distKm = r1(corrida / c.est.leve + (d.durMin * 60 - corrida) / RITMO_CAMINHADA);
  return d;
}

// ---------- escolha dos dias ----------
// escolhe n dias de corrida entre os disponíveis, o mais espalhados possível (o dia fixo entra primeiro)
function escolherDias(dias, n, fixo, semVizinhos) {
  const out = fixo != null && dias.includes(fixo) ? [fixo] : [];
  const resto = dias.filter((d) => !out.includes(d));
  while (out.length < n && resto.length) {
    let melhor = 0, nota = -1;
    for (let i = 0; i < resto.length; i++) {
      const g = out.length ? Math.min(...out.map((x) => distCiclica(x, resto[i]))) : 7;
      if (g > nota) { nota = g; melhor = i; }
    }
    if (semVizinhos && out.length && nota < 2) break;
    out.push(resto.splice(melhor, 1)[0]);
  }
  return out.sort((a, b) => pos(a) - pos(b));
}
// Dias dos treinos fortes: nunca vizinhos entre si nem do longo; longe do treino pesado de pernas (pelo menos 24 h depois:
// blagrove2018, doma2017). Devolve até q dias.
function diasFortes(corrida, longo, q, pernas) {
  const cand = corrida.filter((d) => d !== longo && (longo == null || !vizinhos(d, longo)));
  const nota = (l) => {
    let n = 0;
    for (const d of l) {
      if (pernas.includes((d + 6) % 7)) n -= 4; // dia seguinte ao treino de pernas
      if (pernas.includes(d)) n -= 2;           // mesmo dia
      const outros = l.filter((x) => x !== d).concat(longo == null ? [] : [longo]);
      n += outros.length ? Math.min(...outros.map((x) => distCiclica(x, d))) : 3;
    }
    return n;
  };
  for (let n = Math.min(q, 2); n >= 1; n--) {
    let melhor = null, mn = -Infinity;
    if (n === 1) { for (const d of cand) { const v = nota([d]); if (v > mn) { mn = v; melhor = [d]; } } }
    else for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) {
      if (vizinhos(cand[i], cand[j])) continue;
      const v = nota([cand[i], cand[j]]);
      if (v > mn) { mn = v; melhor = [cand[i], cand[j]]; }
    }
    if (melhor) return melhor;
  }
  return [];
}

// ---------- alvos por distância e nível ----------
// Volume semanal de pico (km). Maratona e meia: o que amadores fazem e o que se associa a melhor resultado (fokkema2020,
// gordon2017, knopp2024, smyth2021taper, zrenner2021). 5 km e 10 km: amadores de até 21 km correm em média 27,5 km por semana
// em 3 treinos (knechtle2021); a mediana de quem compete em 5 e 10 km é de 40 a 45 km, com o quarto superior em 64 km
// (vickers2016); o programa de amadores do Run Clever vai de 15 a 24,5 km por semana (ramskov2016).
const PICO = { 5: [0, 20, 32, 50], 10: [0, 26, 40, 60], 21: [0, 32, 48, 68], 42: [0, 42, 58, 80] };
// sem prova em vista (saúde): minutos por semana da recomendação da OMS, de 150 a 300 (oms2020)
const PICO_SAUDE_MIN = [0, 150, 225, 300];
// Maior treino longo (km): maratona 28 a 32 km (fokkema2020: abaixo de 25 km, pior; acima de 35, sem ganho; knopp2024: 30 a 32);
// meia 17 a 22 km (fokkema2020). Nas outras distâncias o limite é a proporção do longo no volume e os 150 minutos (vdoto2_definicoes).
const LONGO = { 21: [0, 17, 19, 22], 42: [0, 28, 30, 32] };
// Proporção do longo no volume da semana: com 2 corridas, mais da metade por definição; com 3, 47% (ramskov2016: 11,5 km em
// 24,5 km); com 4 ou mais, 30% (vdoto2_definicoes: 25 a 30%). Nos planos de meia e maratona:
// 46% até 65 km por semana, 39% de 65 a 90 km e 25% acima disso (longo médio ÷ volume médio dos planos de maratona de knopp2024).
function fatiaLongo(n, vol, dist) {
  if (n <= 2) return 0.6;
  if (n === 3) return 0.47;
  if (dist === 21 || dist === 42) return vol < 65 ? 0.46 : vol <= 90 ? 0.39 : 0.25;
  return 0.3;
}
// o longo da semana não passa dessa proporção; quem já faz um longo maior não o perde (sem passar dos 46% dos planos de
// menor volume: knopp2024): o longo espera o volume crescer
const limiteLongo = (n, vol, dist, longo0) => Math.max(fatiaLongo(n, vol, dist) * vol, Math.min(longo0, 0.46 * vol));
// duração (semanas) quando não há data: maratona 12 a 30 nos planos publicados (knopp2024); meia, 14 semanas (damsted2018);
// 5 e 10 km: 9 semanas no programa do NHS (nhs_c25k), 10 no ensaio de 10 km (filipas2022), 1 a 4 meses em 80% dos amadores (knechtle2021)
const DURACAO = { 5: [8, 12], 10: [8, 16], 21: [10, 20], 42: [14, 26] };
const POLIMENTO = { 5: 1, 10: 1, 21: 2, 42: 3 };
// corte de volume em cada semana do polimento (a última é a da prova): progressivo, chegando a 41–60% (wang2023)
const CORTE_POLIMENTO = { 1: [0.5], 2: [0.3, 0.55], 3: [0.22, 0.4, 0.58] };
// corridas por semana: 3 para quem começa (buist2008, nhs_c25k); nos planos publicados, 4,1 nos de menor volume, 4,9 nos médios e
// 6,8 nos maiores (knopp2024); sempre com 1 dia de descanso (meeusen2013)
const MAX_CORRIDAS = [3, 4, 5, 6];

function semanasNecessarias(pf, dist, nivel, longo0) {
  const alvo = LONGO[dist] ? LONGO[dist][nivel] : 0.3 * PICO[dist][nivel];
  const sobe = longo0 >= alvo ? 0 : Math.ceil(Math.log(alvo / Math.max(2, longo0)) / Math.log(1.1));
  return entre(Math.ceil((sobe * 4) / 3) + POLIMENTO[dist] + 2, DURACAO[dist][0], DURACAO[dist][1]);
}

// Curva original do plano geral (nível 1 ou mais): por semana, fase, volume, longo e quantos treinos fortes.
function curva(pf, cfg) {
  const { T, nivel, dist, evento, v0, longo0, semQ, estLeve } = cfg;
  const qMax = cfg.qMax != null ? cfg.qMax : pf.qMax;
  const nMax = Math.min(pf.dias.length, MAX_CORRIDAS[nivel], pf.idade < 14 ? 3 : 9, pf.maxCorridas || 9); // antes dos 14, até 3 corridas por semana (paz2021)
  const capDe = (k) => (((k - 1) * pf.tempo + pf.tempoLongo) * 60 / estLeve) * 0.95; // km que cabem em k corridas, pelo tempo disponível
  const capKm = capDe(nMax);
  const capLeveKm = (pf.tempo * 60) / estLeve;
  // só entra mais um dia de corrida quando cada rodagem tem, em média, 30 minutos ou mais (vdoto2_definicoes: mínimo da rodagem leve;
  // para quem corre sem regularidade, 20 minutos: a frequência de 3 vezes por semana vem antes da duração — pollock1998);
  // a rodagem mais curta tem 20 minutos (o primeiro trecho contínuo dos programas de iniciantes: nhs_c25k, kluitenberg2015)
  const minPorCorrida = ((pf.irregular ? 20 : 30) * 60) / estLeve, minLeveKm = Math.min(capLeveKm, (20 * 60) / estLeve);
  cfg.minPorCorrida = minPorCorrida;
  const kmForte = Math.min(capLeveKm, ((nivel <= 1 ? 30 : 40) * 60) / (estLeve * 0.93)); // tamanho típico de um treino forte
  // quantas rodagens da semana viram regenerativo (o dia seguinte a um treino forte ou ao longo), que tem teto de duração
  const regKm = (REG_MAX_MIN * 60) / (estLeve * 1.06);
  const regsDe = (k, qq) => {
    if (nivel < 2) return 0;
    const cor = escolherDias(pf.dias, k, pf.diaLongo, false), lgD = cor.length >= 2 ? pf.diaLongo : null;
    const ft = qq > 0 ? diasFortes(cor, lgD, qq, cfg.pernas || []) : [];
    const lev = cor.filter((d) => d !== lgD && !ft.includes(d));
    return lev.length < 2 ? 0 : lev.filter((d) => { const a = (d + 6) % 7; return a === lgD || ft.includes(a); }).length;
  };
  const alvoKm = dist ? PICO[dist][nivel] : (PICO_SAUDE_MIN[nivel] * 60) / estLeve;
  const ini = Math.max(2 * minLeveKm, Math.min(v0, capKm));
  const pico = pf.gestante ? ini : Math.max(ini, Math.min(alvoKm, capKm));
  cfg.limitado = !pf.gestante && capKm < alvoKm * 0.8 ? Math.round(pico) : 0;
  const tp = evento ? Math.min(POLIMENTO[dist], Math.floor(T / 4)) : 0;
  const R = T - tp;
  const fr = nivel === 1 ? [0.5, 0.8] : [0.35, 0.7];
  const longoMaxKm = Math.min(LONGO[dist] ? LONGO[dist][nivel] : Infinity, (Math.min(pf.tempoLongo, 150) * 60) / (estLeve * 1.02));
  const sem = [];
  let ref = ini, maxLongo = 0;
  for (let w = 1; w <= T; w++) {
    const emPol = w > R;
    const descarga = !emPol && R >= 5 && w % 4 === 0 && w < R;
    const fase = !evento ? (w <= 4 || nivel === 1 ? 'base' : 'construcao') : emPol ? 'polimento' : w <= Math.max(1, Math.round(R * fr[0])) ? 'base' : w <= Math.round(R * fr[1]) ? 'construcao' : 'especifico';
    let vol;
    if (emPol) vol = ref * (1 - CORTE_POLIMENTO[tp][w - R - 1]);
    else if (w === 1) vol = ini;
    else if (descarga) vol = ref * 0.7; // semana leve: 30% menos (filipas2022; 25% em nuuttila2022)
    else { vol = ref >= pico ? ref : Math.min(pico, Math.max(ref * (1 + pf.passo), ref + (ref < 15 ? 1.5 : 0))); ref = vol; }
    // corridas da semana: tantas quantos os dias, desde que cada uma tenha em média 30 minutos ou mais
    let n = nMax;
    const tetoLongoDe = (k) => limiteLongo(k, vol, dist, longo0);
    while (n > 2 && vol / n < minPorCorrida) n--;
    while (n < nMax && vol > capDe(n)) n++; // se o tempo por treino não comporta o volume, entra mais um dia de corrida
    // treino longo: até 10% acima do maior das últimas 4 semanas (frandsen2025); abaixo de 8 km, +0,75 km (em bases
    // pequenas os percentuais enganam: damsted2018)
    const ult = Math.max(0, ...sem.slice(-4).map((s) => s.longo));
    let longo;
    if (n < 2) longo = Math.min(vol, capLeveKm, emPol ? Infinity : w === 1 ? Math.max(longo0, minLeveKm) : ult >= 8 ? ult * 1.1 : ult + 0.75);
    else if (emPol) longo = w === T ? 0 : Math.min(ult, maxLongo * (tp === 3 ? [0.75, 0.6][w - R - 1] : 0.7));
    else if (w === 1) longo = Math.min(Math.max(longo0, minLeveKm), longoMaxKm, tetoLongoDe(n)); // nenhum treino tem menos de 20 minutos
    else if (descarga) longo = ult * 0.8;
    // longos de 2 horas ou mais não se repetem toda semana: depois de chegar ao maior, alterna com um de cerca de 3/4
    else if (sem.length && sem[sem.length - 1].longo >= longoMaxKm * 0.95 && (longoMaxKm * estLeve) / 60 >= 120) longo = Math.min(longoMaxKm * 0.78, tetoLongoDe(n));
    else longo = Math.max(Math.min(ult, tetoLongoDe(n)), Math.min(ult >= 8 ? ult * 1.1 : ult + 0.75, longoMaxKm, tetoLongoDe(n)));
    if (pf.gestante) longo = Math.min(longo, (45 * 60) / estLeve);
    // o longo já sai na medida em que será mostrado (5 min ou meio quilômetro), para a progressão valer sobre o que a pessoa vê:
    // na 1ª semana, o valor mais próximo do que ela já faz; depois, sempre para baixo
    if (cfg.grade && longo > 0) longo = cfg.grade(longo, w === 1);
    // treinos fortes: nenhum nas semanas de volta de pausa nem nas 8 primeiras do iniciante; 1 em descarga e polimento
    const fortesDe = (k) => {
      let x = qMax;
      if (w <= semQ || vol / k < minPorCorrida) x = 0;
      else if (descarga || emPol || k < 5) x = Math.min(x, 1); // 2 treinos fortes só em semana com 5 ou mais corridas (filipas2022)
      if (k === 2 && (pf.dias.length > 2 || vol - longo < minPorCorrida)) x = 0; // com 2 corridas, o treino forte só entra quando sobra volume para ele
      if (k < 2) x = 0; // a única corrida da semana é sempre leve
      return x;
    };
    let q = fortesDe(n);
    // o alvo não cabe em n corridas (cada rodagem tem o limite de tempo; o longo, o limite de progressão): mais um dia de corrida
    // (nenhuma rodagem passa do longo: é ele o treino mais longo da semana)
    const cabeEm = (k, qq, lg) => { const r = regsDe(k, qq); return (k - 1 - qq - r) * Math.min(capLeveKm, lg) + r * Math.min(capLeveKm, lg, regKm) + qq * Math.min(kmForte, lg) + lg; };
    while (n >= 2 && n < nMax && !emPol && vol > cabeEm(n, q, longo) && (vol - longo) / n >= minLeveKm) {
      n++;
      // o longo continua na medida em que é mostrado, mesmo quando a proporção dele na semana diminui
      if (longo > tetoLongoDe(n)) { longo = tetoLongoDe(n); if (cfg.grade && longo > 0) longo = cfg.grade(longo, false); }
      q = fortesDe(n);
    }
    maxLongo = Math.max(maxLongo, longo);
    // semana de uma corrida só: o volume é essa corrida
    if (n < 2 && longo < vol) { vol = longo; if (!emPol && !descarga) ref = Math.min(ref, vol); }
    // sem mais dias para abrir: o volume da semana é o que cabe nos treinos (e a progressão segue a partir dele)
    if (n >= 2 && !emPol && !descarga) { const cabe = cabeEm(n, q, longo); if (vol > cabe) { vol = cabe; ref = Math.min(ref, vol); } }
    sem.push({ n: w, fase, descarga, polimento: emPol, vol, longo, q, corridas: n, semAcel: w <= (cfg.semAcel || 0), dose: descarga ? 0.65 : emPol ? (w === T ? 0.4 : 0.6) : 1 });
  }
  return sem;
}

// tipo do treino forte de cada vaga, por fase, nível e distância
function menu(fase, nivel, dist, vaga, k, w) {
  if (nivel === 1) return fase === 'base' ? (k % 2 ? 'fartlek' : 'progressivo') : w >= 9 ? (k % 2 ? 'fartlek' : 'tempo') : (k % 2 ? 'progressivo' : 'fartlek');
  if (fase === 'base') return vaga === 0 ? (k % 2 ? 'progressivo' : 'fartlek') : 'progressivo';
  if (fase === 'construcao') return vaga === 0 ? (k % 2 ? 'intervalado' : 'tempo') : (k % 2 ? 'tempo' : 'intervalado');
  if (fase === 'polimento') return k % 2 ? 'tempo' : 'intervalado';
  // específico: a primeira vaga gira entre os treinos que mais pesam na distância; a segunda completa a semana
  const A = { 5: ['intervalado', 'tiros', 'intervalado', 'tempo'], 10: ['intervalado', 'tempo'], 21: ['tempo', 'intervalado', 'tempo', 'ritmo'], 42: ['tempo', 'ritmo', 'tempo', 'intervalado'] }[dist] || ['tempo', 'intervalado'];
  const B = { 5: ['tempo', 'tiros'], 10: ['tempo', 'intervalado'], 21: ['intervalado', 'ritmo'], 42: ['intervalado', 'tempo'] }[dist] || ['progressivo'];
  if (vaga === 0) return A[k % A.length];
  const b = B[k % B.length];
  return b === A[k % A.length] ? B[(k + 1) % B.length] : b;
}

// Regenerativo: fica no piso da faixa das rodagens leves de corredores de elite, 40 a 70 minutos (haugen2022).
const REG_MAX_MIN = 40;
// Monta os dias de uma semana do plano geral. s = semana da curva (com vol e longo já ajustados).
function diasDaSemana(s, pf, c, cfg, cont, pernas) {
  const { nivel, dist, evento, T } = cfg;
  const corrida = escolherDias(pf.dias, s.corridas, pf.diaLongo, false);
  const longoDia = corrida.length >= 2 ? pf.diaLongo : null;
  const ehEvento = evento && s.n === T;
  // forte no domingo da semana anterior: a segunda-feira fica de fora (nunca dois fortes em dias seguidos)
  let fortes = s.q > 0 ? diasFortes(cont.forteDomingo ? corrida.filter((d) => d !== 1) : corrida, longoDia, s.q, pernas) : [];
  if (ehEvento) fortes = fortes.filter((d) => pos(d) < pos(pf.diaLongo) && pos(pf.diaLongo) - pos(d) >= 3).slice(0, 1);
  const maxMin = pf.tempo;
  const capLeve = (maxMin * 60) / c.est.leve;
  const minLeve = Math.min((20 * 60) / c.est.leve, capLeve); // rodagem mínima: 20 minutos (nhs_c25k, kluitenberg2015)
  const arr = (x) => (c.porDist ? r05(x) : x); // por distância: de meio em meio quilômetro; por tempo, o arredondamento é nos minutos
  const out = new Map();
  // 1) longo: vem primeiro, porque nenhum outro treino da semana dura mais do que ele
  let longoKm = longoDia != null && !ehEvento ? s.longo : 0;
  let lg = null;
  if (longoKm > 0) {
    // final em ritmo de prova, em semanas alternadas da fase específica (meia e maratona, nível 2 ou mais)
    const final = s.fase === 'especifico' && !s.descarga && nivel >= 2 && !pf.cautela && (dist === 21 || dist === 42) && (cont.longo = (cont.longo || 0) + 1) % 2 === 0
      ? r05(Math.min(longoKm * 0.4, dist === 42 ? 6 + 2 * Math.floor(cont.longo / 2) : 3 + Math.floor(cont.longo / 2), dist === 42 ? 16 : 8)) : 0;
    // O longo mostrado não sobe mais de 10% (ou 0,75 km) sobre o maior das 4 semanas anteriores, na medida em que é prescrito:
    // em quilômetros (treino por distância) ou em minutos (treino por tempo). A conta vale sobre o que a pessoa vê.
    const antKm = Math.max(0, ...(cont.longosKm || []).slice(-4));
    if (antKm > 0 && !s.polimento) { const lim = antKm >= 8 ? antKm * 1.1 : antKm + 0.75; if (longoKm > lim) longoKm = Math.max(2, cfg.grade ? cfg.grade(lim, false) : lim); }
    const ritmoL = c.P ? media(c.P.longo) : c.est.leve;
    const passoKm = c.porDist ? 0.5 : 300 / ritmoL;
    const ant = Math.max(0, ...(cont.longos || []).slice(-4));
    const limMin = ant > 0 && !s.polimento && !c.porDist ? Math.max(ant * 1.1, ant + (0.75 * ritmoL) / 60) : Infinity;
    lg = tLongo(Math.max(2, arr(longoKm)), c, final);
    for (let k = 0; k < 12 && lg.durMin > limMin + 0.5 && longoKm - passoKm >= 2; k++) { longoKm -= passoKm; lg = tLongo(Math.max(2, arr(longoKm)), c, final > 0 && longoKm - final >= 3 ? final : 0); }
    out.set(longoDia, lg);
  }
  cont.longos = [...(cont.longos || []), lg ? lg.durMin : 0];
  cont.longosKm = [...(cont.longosKm || []), lg ? longoKm : 0];
  const lgMin = lg ? lg.durMin : Infinity;
  // 2) treinos fortes
  let somaForte = 0, vaga = 0;
  for (const d of fortes.slice()) {
    const tipo = menu(s.fase, nivel, dist, vaga, cont.q, s.n);
    // o treino forte fica com o que sobra do volume da semana depois do longo e das rodagens mínimas (conta de soma, não regra
    // de treino), sem durar mais que o longo; a parte forte em si segue os limites de vdoto2_definicoes dentro de tQualidade
    const nLeves = corrida.length - fortes.length - (longoDia != null && !ehEvento ? 1 : 0);
    const sobraKm = (s.vol - longoKm - nLeves * minLeve) / fortes.length;
    const sobra = ehEvento ? 999 : Math.max(20, Math.round((sobraKm * c.est.leve * 0.93) / 60));
    const teto = Math.min(maxMin, sobra, lgMin);
    const t = tQualidade(tipo, cont[tipo] || 0, c, s.vol, s.dose, teto);
    // semana só com treino forte e longo: o aquecimento e a volta à calma crescem (até 20 e 10 min) para o treino ocupar o que sobra do volume
    if (!nLeves && !ehEvento && t.blocos[0].tipo === 'aquecer') {
      const falta = teto - t.durMin;
      if (falta >= 3) {
        const a = Math.min(600, Math.round(falta * 0.65) * 60), b = Math.min(300, Math.max(0, falta * 60 - a));
        t.blocos[0].seg += a; t.blocos[t.blocos.length - 1].seg += Math.round(b / 60) * 60;
        const tt = totais(t.blocos, c);
        t.durMin = tt.durMin; t.distKm = tt.distKm; t.resumo = t.resumo.replace(/cerca de \d+ min$/, 'cerca de ' + t.durMin + ' min');
      }
    }
    // não coube abaixo da duração do longo: o dia vira rodagem leve
    if (t.durMin > lgMin) { fortes = fortes.filter((x) => x !== d); continue; }
    cont[tipo] = (cont[tipo] || 0) + 1; vaga++;
    out.set(d, t); somaForte += t.distKm;
  }
  if (fortes.length) cont.q++;
  cont.forteDomingo = fortes.includes(0) || (ehEvento && pf.diaLongo === 0);
  // 3) rodagens leves e regenerativos
  const papel = new Map(corrida.map((d) => [d, d === longoDia ? 'longo' : fortes.includes(d) ? 'forte' : 'leve']));
  const leves = corrida.filter((d) => papel.get(d) === 'leve');
  const depoisDeForte = (d) => { const ant = (d + 6) % 7; return papel.get(ant) === 'forte' || papel.get(ant) === 'longo'; };
  const reg = (d) => nivel >= 2 && leves.length >= 2 && depoisDeForte(d); // regenerativo só quando há outra rodagem na semana
  const peso = (d) => (reg(d) ? 0.7 : 1);
  const regMax = c.porDist ? Math.floor(((REG_MAX_MIN * 60) / c.est.reg) * 2) / 2 : (REG_MAX_MIN * 60) / c.est.reg;
  const tetoKm = (d) => Math.min(capLeve, lg ? (lgMin * 60) / (reg(d) ? c.est.reg : c.est.leve) : Infinity, reg(d) ? regMax : Infinity);
  // reparte o que sobra do volume pelos pesos, respeitando o teto de cada rodagem
  let resto = corrida.length === 1 ? s.vol : s.vol - somaForte - longoKm;
  const alvo = new Map();
  let livres = leves.slice();
  while (livres.length) {
    const u = Math.max(0, resto) / livres.reduce((x, d) => x + peso(d), 0);
    const presos = livres.filter((d) => Math.max(minLeve, u * peso(d)) >= tetoKm(d));
    for (const d of presos.length ? presos : livres) { const km = presos.length ? tetoKm(d) : Math.max(minLeve, u * peso(d)); alvo.set(d, km); resto -= km; }
    livres = presos.length ? livres.filter((d) => !presos.includes(d)) : [];
  }
  // uma rodagem por semana com acelerações (nível 2 ou mais; fora de descarga e de volta de pausa)
  let strides = nivel >= 2 && !s.descarga && !s.semAcel && !pf.cautela && !ehEvento && corrida.length >= 2; // a única corrida da semana é só leve
  for (const d of leves) {
    const km = Math.max(Math.min(2, minLeve), arr(alvo.get(d)));
    if (ehEvento) { const depois = pos(d) > pos(pf.diaLongo); out.set(d, depois ? tRegenerativo(Math.min(km, 3), c) : tLeve(Math.min(km, vizinhos(d, pf.diaLongo) ? 3 : 5), c, { curto: true })); continue; }
    if (reg(d)) out.set(d, tRegenerativo(km, c));
    else { const st = strides && !vizinhos(d, longoDia == null ? -9 : longoDia) && !fortes.some((f) => vizinhos(f, d)); out.set(d, tLeve(st ? Math.max(2, Math.min(km, r05(capLeve - 1))) : km, c, { strides: st })); if (st) strides = false; }
  }
  // o longo é o treino mais longo da semana: nenhuma rodagem dura mais do que ele
  if (lg) for (const d of leves) out.set(d, limitarAo(out.get(d), lgMin, c));
  // 4) dia da prova ou do teste
  if (ehEvento) out.set(pf.diaLongo, tEvento(pf, c, cfg));
  // 5) dias disponíveis que sobraram: caminhada (iniciantes) ou atividade livre (menores de 14)
  for (const d of pf.dias) if (!out.has(d)) out.set(d, tCaminhada(Math.min(30, pf.tempo), c, pf.idade < 14 ? 'Atividade livre' : ''));
  return ORDEM.filter((d) => out.has(d)).map((d) => ({ wd: d, ...out.get(d) }));
}
// tempo previsto para a prova: na maratona, o meio da faixa (a fórmula é otimista para amadores: vickers2016)
const previstoDe = (P, dist) => (dist === 42 ? P.previsoes[42] * 1.025 : P.previsoes[dist]);
// prova em ritmo de conversa: cautela de saúde, menos de 14 anos ou volta recente de uma pausa
function provaSuave(d, dist, detalhe) {
  return { ...d, intensidade: 'moderada', pse: [3, 5], fala: 'Frases inteiras', ritmo: null, blocos: d.blocos.map((b) => { const { ritmo: _r, ...r } = b; return r; }), resumo: ROTULO.distancia[dist] + ' em ritmo de conversa', detalhe };
}
function tEvento(pf, c, cfg) {
  const { dist, evento } = cfg;
  const km = DIST[dist];
  const P = c.P;
  const previsto = P ? previstoDe(P, dist) : km * c.est.leve * 0.93;
  // Ritmo da meta só com resultado recente e meta ao alcance (até 5% mais rápida que a previsão): os ritmos seguem o
  // condicionamento de hoje, não o desejado (vdoto2_ajuste). Sem resultado, a prova vai pelo esforço.
  const usarAlvo = !!(pf.alvoSeg && P && pf.alvoSeg >= previsto * 0.95);
  const ritmo = usarAlvo ? { de: Math.round(pf.alvoSeg / km), ate: Math.round(pf.alvoSeg / km) } : P ? P.prova[dist] : null;
  const blocos = [];
  if (dist <= 10) blocos.push(bl('Aquecimento: trote leve e 3 acelerações curtas', 'aquecer', { seg: 600 }));
  blocos.push(bl(evento === 'teste' ? 'Teste' : 'Prova', 'correr', { m: Math.round(km * 1000), ...(ritmo ? { ritmo } : {}) }));
  const d = treino(evento, blocos, c, { ritmo });
  d.distKm = r1(km);
  d.durMin = Math.round((usarAlvo ? pf.alvoSeg : previsto) / 60 + (dist <= 10 ? 10 : 0));
  d.nome = evento === 'teste' ? `Teste de ${ROTULO.distancia[dist]}` : pf.objetivo === 'distancia' ? `Desafio: ${ROTULO.distancia[dist]}` : `Prova: ${ROTULO.distancia[dist]}`;
  d.resumo = `${ROTULO.distancia[dist]}${ritmo ? ' · ritmo de ' + fmtFaixa(ritmo, c.modo) : ''}`;
  if (pf.cautela || pf.idade < 14) return provaSuave(d, dist, 'Complete a distância em ritmo leve, sem disputar tempo. Pode caminhar quando precisar.');
  d.detalhe = dist >= 21
    ? 'Comece um pouco mais devagar do que o ritmo planejado e segure até a metade. A maioria das quebras no fim vem de sair rápido demais. Beba água e coma como treinou nos longos.'
    : 'Aqueça bem. Largue controlado no primeiro quilômetro e aumente na segunda metade.';
  return d;
}

// ---------- registros e sinais para ajustar o plano ----------
const TIPOS_REGISTRO = new Set([...Object.keys(TIPOS_TREINO)].filter((t) => t !== 'descanso'));
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v);
const LOCAIS_CORRIDA = new Set(['lombar', 'quadril', 'virilha', 'coxa-frente', 'coxa-tras', 'joelho', 'canela', 'panturrilha', 'aquiles', 'tornozelo', 'pe', 'gluteo']);

// Registro de corrida validado, ou null. Fronteira de segurança: é por aqui que passa o que vem de um backup importado.
// { id, data, tipo, distKm (0 = não informada), durMin (0 = não informado), pse (1–10 ou null), dor: { onde, nivel } | null, nota, planejado,
//   plan: o treino que estava no plano naquele dia (para a análise do que foi feito), ou null }
// Dores anotadas em uma corrida: [{ onde, nivel: 1–10, tipo }], uma por local, até MAX_DORES_REGISTRO.
// tipo: 'muscular' (dor muscular comum depois do treino: só nos locais com músculo, MUSCULO_CORRIDA), 'articular'
// (articulação, osso ou tendão; também quando a pessoa não sabe dizer, por cautela) ou 'aguda' (fisgada, estalo,
// inchaço, não consegue apoiar). Registros antigos tinham uma dor só, em `dor: { onde, nivel }`: vira articular.
export const MAX_DORES_REGISTRO = 6;
export const MUSCULO_CORRIDA = new Set(['lombar', 'quadril', 'virilha', 'coxa-frente', 'coxa-tras', 'panturrilha', 'gluteo', 'canela']);
const TIPOS_DOR_REGISTRO = new Set(['muscular', 'articular', 'aguda']);
function limparDoresDoRegistro(raw) {
  const brutas = Array.isArray(raw.dores) ? raw.dores : isObj(raw.dor) ? [{ ...raw.dor, tipo: 'articular' }] : [];
  const out = [];
  for (const d of brutas) {
    if (!isObj(d) || typeof d.onde !== 'string' || !Object.prototype.hasOwnProperty.call(LOCAIS_DOR, d.onde) || out.some((x) => x.onde === d.onde)) continue;
    const n = typeof d.nivel === 'number' && Number.isFinite(d.nivel) ? Math.round(d.nivel) : 0;
    if (n < 1 || n > 10) continue;
    let tipo = typeof d.tipo === 'string' && TIPOS_DOR_REGISTRO.has(d.tipo) ? d.tipo : 'articular';
    if (tipo === 'muscular' && !MUSCULO_CORRIDA.has(d.onde)) tipo = 'articular';
    out.push({ onde: d.onde, nivel: n, tipo });
    if (out.length >= MAX_DORES_REGISTRO) break;
  }
  return out;
}
// Dor muscular comum depois do treino: só dores musculares, todas leves (até 3 de 10). A tela tranquiliza e diz o
// que é esperado (começa em horas, piora em 1 a 3 dias e melhora em até uma semana — zondi2015, mizumura2024).
export const soDorMuscularLeve = (dores) => Array.isArray(dores) && dores.length > 0 && dores.every((d) => d.tipo === 'muscular' && d.nivel <= 3);
export function limparRegistro(raw) {
  if (!isObj(raw) || !idOk(raw.id) || !diaValido(raw.data)) return null;
  const ano = Number(raw.data.slice(0, 4));
  if (ano < 2000 || ano > 2100) return null;
  const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, v) : 0);
  const distKm = Math.round(num(raw.distKm, 120) * 100) / 100;
  const durMin = Math.round(num(raw.durMin, 900) * 60) / 60; // guardado com precisão de 1 segundo
  if (!distKm && !durMin) return null;
  // ritmo impossível (mais rápido que 1:50 por km): o registro é recusado
  if (distKm && durMin && (durMin * 60) / distKm < 110) return null;
  const pse = typeof raw.pse === 'number' && Number.isFinite(raw.pse) && Math.round(raw.pse) >= 1 && Math.round(raw.pse) <= 10 ? Math.round(raw.pse) : null;
  return {
    id: raw.id, data: raw.data, tipo: typeof raw.tipo === 'string' && TIPOS_REGISTRO.has(raw.tipo) ? raw.tipo : 'livre', distKm, durMin, pse, dores: limparDoresDoRegistro(raw),
    nota: typeof raw.nota === 'string' ? raw.nota.slice(0, 200) : '', planejado: typeof raw.planejado === 'string' ? raw.planejado.slice(0, 160) : '',
    // o treino que estava no plano naquele dia; a chave só existe quando há o que guardar
    ...(limparPlanejado(raw.plan) ? { plan: limparPlanejado(raw.plan) } : {}),
  };
}
export const MAX_REGISTROS = 3000;
export function limparRegistros(raw) {
  const out = [];
  const vistos = new Set();
  if (!Array.isArray(raw)) return out;
  // lê no máximo 20 vezes o limite (um backup adulterado não trava o aplicativo) e guarda os registros mais recentes
  for (let i = 0; i < raw.length && i < MAX_REGISTROS * 20; i++) {
    const r = limparRegistro(raw[i]);
    if (!r || vistos.has(r.id)) continue;
    vistos.add(r.id); out.push(r);
  }
  out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  return out.length > MAX_REGISTROS ? out.slice(out.length - MAX_REGISTROS) : out;
}
// respostas da entrevista: só as perguntas que existem, com valores que existem nelas
function limparRespostas(v) {
  const out = {};
  if (!isObj(v)) return out;
  for (const q of PERGUNTAS) {
    if (!Object.prototype.hasOwnProperty.call(v, q.k)) continue;
    const x = v[q.k];
    if (q.tipo === 'numero') { if (typeof x === 'number' && Number.isFinite(x) && x >= q.min && x <= q.max) out[q.k] = x; }
    else if (q.tipo === 'um') { if (typeof x === 'string' && q.op.some((o) => o[0] === x)) out[q.k] = x; }
    else if (Array.isArray(x)) { const ok = [...new Set(x.filter((y) => typeof y === 'string' && q.op.some((o) => o[0] === y)))].slice(0, q.op.length); if (ok.length) out[q.k] = ok; }
    // data da liberação médica (AAAA-MM-DD): só com a resposta "sim"
    if (q.dataEm && out[q.k] === 'sim' && diaValido(v[q.dataEm])) out[q.dataEm] = v[q.dataEm];
  }
  return out;
}
const isoOk = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : '');
// Cronômetro guiado em andamento (para sobreviver a recarregar ou fechar a página): dia do treino, etapa atual e os
// instantes (ms) de início, fim da etapa, pausa e término. As etapas em si são refeitas a partir do plano.
function limparCron(c) {
  if (!isObj(c) || !diaValido(c.data)) return null;
  const n = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : -1);
  // chave = assinatura das etapas do treino em que o cronômetro foi iniciado (se o treino do dia mudar, ele é descartado)
  const o = { data: c.data, i: n(c.i, 500), fim: n(c.fim, 4e12), pausadoEm: n(c.pausadoEm, 4e12), inicio: n(c.inicio, 4e12), parado: n(c.parado, 864e5), inicioPasso: n(c.inicioPasso, 4e12), terminado: n(c.terminado, 4e12), chave: n(c.chave, 2e9) };
  if (Object.values(o).some((x) => x === -1) || o.inicio < 1e12) return null;
  // instantes coerentes entre si: nada antes do início; o fim da etapa não vem antes do começo dela
  if (o.inicioPasso < o.inicio || (o.fim && o.fim < o.inicioPasso) || (o.pausadoEm && o.pausadoEm < o.inicio) || (o.terminado && o.terminado < o.inicio)) return null;
  return o;
}
// pausas do plano já encerradas: { de, ate, semanas (quantas semanas o plano pulou; 0 quando há prova com data) }
export const MAX_PAUSAS = 20;
function limparPausas(v) {
  const out = [];
  for (const p of Array.isArray(v) ? v : []) {
    if (!isObj(p) || !diaValido(p.de) || !diaValido(p.ate) || p.de > p.ate) continue;
    const max = Math.floor(diasEntre(p.de, p.ate) / 7);
    out.push({ de: p.de, ate: p.ate, semanas: Number.isInteger(p.semanas) && p.semanas > 0 ? Math.min(p.semanas, max) : 0 });
  }
  return out.sort((a, b) => (a.de < b.de ? -1 : a.de > b.de ? 1 : 0)).slice(-MAX_PAUSAS);
}
// Estado do Treinador de corrida: { answers, aceitoEm (ISO ou ''), inicio (segunda-feira da semana 1 ou ''), pausadoEm (ISO ou ''),
// cron (ou null), pausas }
export function limparCorrida(raw) {
  const r = isObj(raw) ? raw : {};
  const aceitoEm = isoOk(r.aceitoEm);
  const inicio = aceitoEm && diaValido(r.inicio) ? segundaDe(r.inicio) : '';
  return { answers: limparRespostas(r.answers), aceitoEm: inicio ? aceitoEm : '', inicio, pausadoEm: inicio ? isoOk(r.pausadoEm) : '', cron: inicio ? limparCron(r.cron) : null, pausas: inicio ? limparPausas(r.pausas) : [],
    // o treino mostrado em cada dia e o degrau de ritmo já concedido (ver guardarDoDia)
    mostrados: inicio ? limparMostrados(r.mostrados) : [], degrau: inicio ? limparDegrau(r.degrau) : null };
}

const ehCorrida = (r) => r.tipo !== 'caminhada';
const kmDe = (r, est) => (r.distKm ? r.distKm : (r.durMin * 60) / est * (r.tipo === 'corrida_caminhada' ? 0.6 : 1));
const LEVES = new Set(['leve', 'longo', 'regenerativo', 'corrida_caminhada', 'livre']);

// ---------- efeito de uma dor no plano ----------
// Nível do efeito: 0 nada · 1 sem treinos fortes · 2 sem fortes e corridas pela metade · 4 sem corrida.
// Faixas gerais: a escala de dor em "semáforo" usada na fisioterapia (nhs_dor): 0 a 3 segue; 4 a 6 adapta ou regride; 7 a 10 para.
// Exceções por tecido: joelho, no máximo 2/10 ao correr (esculier2016); tendão de Aquiles, até 5/10 (silbernagel2020,
// silbernagel2020); canela, abaixo de 4/10 (moen2012); dor localizada no osso, nenhuma dor é aceitável (warden2021, hoenig2022).
// Tamanho do corte: nenhuma fonte dá um percentual por faixa de dor; "metade" é o que as orientações de volta usam (um terço
// a metade da distância: liem2013; 50% do volume na primeira semana: caterisano2019).
// Dor muscular tardia: reduzir intensidade e duração por 1 a 2 dias (zondi2015); some em até 7 dias (mizumura2024).
const temLocal = (k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(LOCAIS_DOR, k);
const METADE = 0.5;
const TRONCO = new Set(['abdomen', 'coluna-alta', 'pescoco']);
// pf (opcional) = perfil de quem corre: na gestação, dor no abdômen ou na panturrilha suspende a corrida (csep2019, sbc_gestacao2021)
export function efeitoDaDor(d, pf = null) {
  const nada = { nivel: 0, corte: 0, texto: '', refs: [] };
  if (!isObj(d) || !temLocal(d.onde)) return nada;
  if (isObj(pf) && pf.gestante && (d.onde === 'abdomen' || d.onde === 'panturrilha')) return { nivel: 4, corte: 1, texto: 'Corrida suspensa: na gestação, dor no abdômen ou na panturrilha é sinal para parar e falar com o seu obstetra antes de voltar a treinar (regra de cautela do aplicativo).', refs: ['sbc_gestacao2021', 'nhs_tvp'] };
  const nome = LOCAIS_DOR[d.onde].toLowerCase();
  const alerta = dorDeAlerta(d);
  if (!LOCAIS_CORRIDA.has(d.onde)) {
    // Fora das pernas: dor de alerta no peito pode ser do coração (ms_infarto, whitfield2017); no abdômen, nas costas e no pescoço,
    // dor forte e repentina pede atendimento (nhs_urgencia). Nesses casos a corrida para.
    if (d.onde === 'peito') {
      // dor no peito que não é do músculo suspende a corrida em qualquer intensidade
      if (!alerta && d.tipo !== 'muscular') return { nivel: 4, corte: 1, texto: 'Corrida suspensa. Dor no peito que não é do músculo precisa de avaliação médica antes de qualquer treino. Com falta de ar, suor frio, enjoo ou dor que vai para o braço, as costas ou o queixo, ligue 192 (SAMU).', refs: ['whitfield2017', 'ms_infarto'] };
      return alerta
        ? { nivel: 4, corte: 1, texto: 'Corrida suspensa. Dor forte, repentina ou em repouso no peito pode ser do coração: procure atendimento agora. Com falta de ar, suor frio, enjoo ou dor que vai para o braço, as costas ou o queixo, ligue 192 (SAMU).', refs: ['ms_infarto', 'whitfield2017'] }
        : { ...nada, texto: 'Dor muscular no peito depois do treino de força não muda a corrida. Dor ou pressão no peito durante o esforço é sinal de alerta: pare e procure atendimento.', refs: ['whitfield2017', 'ms_infarto'] };
    }
    if (TRONCO.has(d.onde)) {
      return alerta
        ? { nivel: 4, corte: 1, texto: `Corrida suspensa até você ser avaliado: dor de 7 ou mais, repentina ou em repouso (${nome}) pede atendimento médico sem esperar.`, refs: ['nhs_urgencia', 'whitfield2017'] }
        : { ...nada, texto: 'Não muda o plano de corrida.' };
    }
    return alerta
      ? { ...nada, texto: 'Essa dor pede avaliação de um médico ou fisioterapeuta. Se a corrida provocar ou aumentar a dor, pare. Dor no braço ou no ombro junto com aperto no peito ou falta de ar: procure atendimento na hora.', refs: ['nhs_urgencia', 'ms_infarto'] }
      : { ...nada, texto: 'Não muda o plano de corrida.' };
  }
  const info = Object.prototype.hasOwnProperty.call(DOR_CORRIDA, d.onde) ? DOR_CORRIDA[d.onde] : { osso: false, f: [] };
  const reduz = (texto, refs) => ({ nivel: 2, corte: METADE, texto, refs });
  if (alerta) return { nivel: 4, corte: 1, texto: `Corrida suspensa até você ser avaliado: dor de 7 ou mais, repentina ou em repouso (${nome}) não é para treinar por cima. Procure um médico ou fisioterapeuta.`, refs: ['nhs_dor', 'hoenig2022'] };
  // em região de osso, dor de 4 ou mais suspende a corrida, seja qual for o tipo informado (moen2012, warden2021)
  if (info.osso && d.nivel >= 4) return { nivel: 4, corte: 1, texto: `Corrida suspensa: dor de ${d.nivel} em ${nome} pode ser sobrecarga do osso. Se dói em um ponto do osso ou ao pular em um pé só, procure um médico antes de voltar.`, refs: ['moen2012', 'hoenig2022', 'liem2013'] };
  const dias = Number.isFinite(d.dias) ? d.dias : 0;
  if (d.tipo === 'muscular') {
    if (d.nivel <= 3) return { ...nada, texto: 'Dor muscular leve: o plano segue igual. Ela costuma melhorar depois de aquecer.', refs: ['zondi2015', 'nhs_dor'] };
    if (dias <= 2) return reduz('Dor muscular depois do treino: por 1 a 2 dias, só treinos leves; por cautela, o aplicativo também encurta os treinos pela metade.', ['zondi2015']);
    if (dias <= 7) return { nivel: 1, corte: 0, texto: 'A dor muscular some em até 7 dias: mantive só treinos leves até você marcar “Melhorou”.', refs: ['mizumura2024', 'zondi2015'] };
    return reduz('Dor muscular que passa de 7 dias não é o esperado: só treinos leves, pela metade, e vale procurar avaliação. Dor muito forte, fraqueza fora do normal ou urina escura pedem médico logo.', ['mizumura2024', 'cdc_rabdo']);
  }
  // articulação ou tendão
  if (info.osso) return reduz('Só corridas leves, pela metade, em dias alternados. Se a dor for em um ponto do osso ou aparecer ao pular em um pé só, pare e procure um médico: no osso, nenhuma dor ao correr é aceitável.', ['moen2012', 'hoenig2022', 'liem2013']);
  if (d.onde === 'aquiles' || d.onde === 'panturrilha') {
    if (d.nivel <= 2) return { ...nada, texto: 'Dor de 1 a 2: o plano segue. No tendão de Aquiles, até 5 de 10 é aceitável se ceder até a manhã seguinte e não piorar de uma semana para a outra.', refs: ['silbernagel2020', 'munteanu2009'] };
    if (d.nivel <= 5) return reduz('Sem treinos rápidos nem subidas, e corridas pela metade, em terreno plano. Dê 2 dias entre as corridas com dor de 2 a 3, e 3 dias com dor de 4 a 5.', ['silbernagel2020']);
    return reduz('Dor acima de 5 é zona de risco para o tendão: só corridas leves pela metade. Se passar de 5 durante a corrida, pare e caminhe.', ['silbernagel2020', 'devos2021']);
  }
  if (d.onde === 'joelho' || d.onde === 'coxa-frente') {
    if (d.nivel <= 2) return { ...nada, texto: 'Dor de até 2 em 10 que some em 1 hora: o plano segue. Evite descidas e não force o ritmo.', refs: ['esculier2016'] };
    return reduz('Sem treinos rápidos e corridas pela metade, para a dor ficar em até 2 de 10. Evite descidas; vale correr mais vezes, por menos tempo e mais devagar.', ['esculier2016', 'liem2013']);
  }
  if (d.nivel <= 3) return { ...nada, texto: 'Dor de até 3: o plano segue. Ela deve ceder em até 1 hora e não estar pior na manhã seguinte.', refs: ['nhs_dor'] };
  return reduz('Dor de 4 a 6 pede adaptar: sem treinos fortes e corridas pela metade até a dor voltar para 3 ou menos.', ['nhs_dor', 'liem2013']);
}
// orientação completa por local, para a tela ("saiba mais")
export function orientacaoDor(onde) {
  const i = DOR_CORRIDA[onde];
  return i ? { nome: i.nome, itens: [['O que reduzir primeiro', i.reduzir], ['O que dá para manter', i.tolera], ['Fortalecimento', i.fortalecer], ['Volta', i.volta], ['Procure um médico se', i.medico]], refs: i.f } : null;
}

// refaz duração, distância e resumo de uma rodagem, regenerativo ou longo depois de mexer nos blocos
function refazer(t, c) {
  const tot = totais(t.blocos, c);
  t.durMin = tot.durMin; t.distKm = tot.distKm;
  const b = t.blocos[0], st = t.blocos.some((x) => x.rotulo === 'Acelerações');
  const med = b.m ? fmtKm(b.m / 1000) : fmtDuracao(b.seg);
  if (t.tipo === 'leve') t.resumo = `${med} em ritmo leve${st ? ' + 6 acelerações' : ''}${b.m ? ' · ' + aprox(t) : ''}`;
  else if (t.tipo === 'regenerativo') t.resumo = `${med} bem leve`;
  else if (t.tipo === 'longo' && t.blocos.length === 1) t.resumo = `${med} em ritmo leve${b.m ? ' · ' + aprox(t) : ''}`;
  return t;
}
// encurta uma rodagem até ela não durar mais que maxMin (o longo da semana)
function limitarAo(t, maxMin, c) {
  if (!t || (t.tipo !== 'leve' && t.tipo !== 'regenerativo') || t.durMin <= maxMin) return t;
  const n = { ...t, blocos: t.blocos.map((b) => ({ ...b })) };
  for (let i = 0; i < 80 && totais(n.blocos, c).durMin > maxMin; i++) {
    const b = n.blocos[0];
    if (b.seg > 600) b.seg -= 300; else if (b.m > 1000) b.m -= 500;
    else if (n.blocos.length > 1) { n.blocos.pop(); n.detalhe = 'Ritmo confortável do começo ao fim. Se não der para falar frases inteiras, diminua.'; }
    else break;
  }
  return refazer(n, c);
}
// dentro da janela da dor, as rodagens continuam mais curtas que o longo
function ordenarLongo(dias, c, naJanela) {
  const lg = dias.find((d) => d.tipo === 'longo' && naJanela(d));
  return lg ? dias.map((d) => (naJanela(d) && d !== lg ? { ...limitarAo(d, lg.durMin, c), wd: d.wd } : d)) : dias;
}
function aplicarDor(dia, ef, c) {
  if (dia.tipo === 'caminhada' || dia.tipo === 'descanso' || ef.nivel === 0) return dia;
  if (ef.nivel >= 4) {
    return { ...treino('descanso', [], c), wd: dia.wd, durMin: 0, distKm: 0, resumo: 'Sem corrida hoje, por causa da dor', detalhe: 'Se não doer, caminhada, bicicleta ou natação mantêm o condicionamento. Procure avaliação antes de voltar a correr.', original: dia.tipo };
  }
  if (dia.tipo === 'prova' || dia.tipo === 'teste') return { ...dia, detalhe: 'Atenção: você contou uma dor. Só faça a prova se a dor estiver leve e não mudar o seu jeito de correr; não vale a pena piorar uma lesão. ' + dia.detalhe };
  if (dia.tipo === 'corrida_caminhada') {
    if (!ef.corte) return dia;
    // corta o tempo de corrida: metade das repetições quando há 4 ou mais; senão, trechos mais curtos
    const f = 1 - ef.corte;
    const blocos = dia.blocos.map((b) => {
      if (b.tipo !== 'correr') return b;
      const n = b.repeticoes || 1, reps = n >= 4 ? Math.max(2, Math.round(n * f)) : n;
      const novo = { ...b, seg: Math.max(30, Math.round((b.seg * n * f) / reps / 30) * 30) };
      if (reps > 1) novo.repeticoes = reps; else delete novo.repeticoes;
      return novo;
    });
    const t = totais(blocos, c);
    const corr = blocos.filter((b) => b.tipo === 'correr').reduce((s, b) => s + b.seg * (b.repeticoes || 1), 0);
    const corridaMin = Math.round(corr / 60);
    return {
      ...dia, blocos, durMin: t.durMin, corridaMin, corridaKm: r1(corr / c.est.leve), distKm: r1(corr / c.est.leve + (t.durMin * 60 - corr) / RITMO_CAMINHADA),
      resumo: `Versão reduzida por causa da dor: ${corridaMin} min de corrida no total · ${t.durMin} min com aquecimento`, wd: dia.wd, ajustado: true,
    };
  }
  // treino forte vira rodagem leve do mesmo tamanho; longo com final em ritmo de prova vira longo simples
  let base = dia;
  if (FORTES.has(dia.tipo)) base = tLeve(Math.max(1, Math.min(dia.distKm, (c.pf.tempo * 60) / c.est.leve)), c);
  else if (dia.tipo === 'longo' && dia.blocos.length > 1) base = tLongo(dia.distKm, c);
  const n = { ...base, wd: dia.wd, ajustado: true, blocos: base.blocos.filter((b) => b.rotulo !== 'Acelerações').map((b) => ({ ...b })) };
  // o corte é feito na duração de cada treino, sempre para baixo: a ordem entre eles se mantém
  if (ef.corte) { const b = n.blocos[0]; if (b.seg) b.seg = Math.max(600, Math.floor((b.seg * (1 - ef.corte)) / 300) * 300); else b.m = Math.max(1000, Math.floor((b.m * (1 - ef.corte)) / 500) * 500); }
  n.detalhe = (n.tipo === 'longo' ? 'Ritmo de conversa. ' : 'Ritmo confortável. ') + 'Treino ajustado por causa da dor: se ela aumentar durante a corrida, pare e caminhe.';
  return refazer(n, c);
}

// ---------- corrida + musculação: o que a prioridade muda na corrida ----------
// A escolha vem de state.combo (logic/combinado.js). Interferência entre os dois treinos (baar2014, petre2021, methenitis2018,
// baar2014, methenitis2018):
// - a perda de força e massa aparece quando o aeróbico passa de 4 dias por semana ou de 80% do VO2máx (baar2014) e é menor
//   com bicicleta do que com corrida (methenitis2018); a revisão mais recente não confirmou a relação com frequência e
//   duração da sessão (schumann2022);
// - para ganhar força e massa: de 2 a 3 treinos de força para cada treino aeróbico (methenitis2018);
// - no mesmo dia: 3 horas no mínimo, de preferência 6 a 24 (methenitis2018); quem prioriza a força faz a força
//   primeiro, e quem prioriza a corrida corre primeiro (methenitis2018); em treinados, a perda só apareceu com os dois treinos
//   colados, com menos de 20 minutos entre eles (petre2021);
// - depois do treino pesado de pernas, o rendimento na corrida cai por 24 a 48 horas (doma2017, doma2019).
// 'musculacao': corrida como complemento (até 3 corridas de até 40 minutos, no máximo 1 forte). 'equilibrio': até 4 corridas
// e 1 forte. 'corrida': o plano de corrida fica inteiro; quem se ajusta é a musculação (logic/trainer.js).
const FOCOS_CORRIDA = ['corrida', 'musculacao', 'equilibrio'];
const REFS_FOCO = { corrida: ['methenitis2018', 'doma2017', 'beattie2017'], musculacao: ['baar2014', 'methenitis2018'], equilibrio: ['baar2014', 'methenitis2018', 'petre2021', 'doma2017'] };
export function efeitoDoFoco(foco, st) {
  const corre = !!(st && isObj(st.run) && st.run.aceitoEm);
  if (!FOCOS_CORRIDA.includes(foco) || !corre) return { linhas: [], refs: [] };
  const linhas = foco === 'musculacao'
    ? ['Corrida como complemento: até 3 corridas por semana, de até 40 minutos, e no máximo 1 treino forte.', 'No dia dos dois treinos, a musculação vem primeiro e a corrida fica para 6 horas depois (3, no mínimo).']
    : foco === 'equilibrio'
      ? ['Corrida com até 4 treinos por semana e 1 treino forte, para sobrar recuperação para a musculação.', 'Treino forte e longão ficam a 24 horas ou mais do treino pesado de pernas; no mesmo dia, 6 horas entre os dois (3, no mínimo).']
      : ['A corrida segue o plano inteiro; treino forte e longão ficam a 24 horas ou mais do treino pesado de pernas.', 'No dia dos dois treinos, corra primeiro e faça a musculação 6 horas depois (3, no mínimo).'];
  // com a prioridade na musculação (ou nos dois), a meta de corrida pode não caber mais: avisa antes de a pessoa escolher
  if (foco !== 'corrida') {
    try {
      const antes = gerarPlano(st.run.answers, {}), depois = gerarPlano(st.run.answers, { foco });
      if (antes && depois && antes.perfil.dist && (depois.perfil.dist !== antes.perfil.dist || depois.perfil.objetivo !== antes.perfil.objetivo)) {
        linhas.unshift(`Com essa prioridade, a sua meta de ${ROTULO.distancia[antes.perfil.dist]} ${depois.perfil.dist ? (depois.perfil.dist !== antes.perfil.dist ? 'passa a ' + ROTULO.distancia[depois.perfil.dist] : 'fica sem data marcada') : 'dá lugar a um plano de saúde'}.`);
      }
    } catch { /* sem entrevista completa: fica só a regra geral */ }
  }
  return { linhas, refs: REFS_FOCO[foco] };
}
// perfil com os limites do foco (antes de montar a curva)
function aplicarFoco(pf, foco, pernas) {
  if (foco !== 'musculacao' && foco !== 'equilibrio') return FOCOS_CORRIDA.includes(foco) ? { ...pf, foco } : pf;
  const max = foco === 'musculacao' ? 3 : 4;
  let dias = pf.dias, diaLongo = pf.diaLongo;
  if (dias.length > max) {
    // ficam os dias mais espalhados, de preferência fora dos dias de treino de pernas
    const livres = dias.filter((d) => !pernas.includes(d));
    const base = livres.length >= max ? livres : dias;
    dias = escolherDias(base, max, base.includes(diaLongo) ? diaLongo : null, false);
    if (!dias.includes(diaLongo)) diaLongo = dias.includes(0) ? 0 : dias.includes(6) ? 6 : dias[dias.length - 1];
  }
  const curto = foco === 'musculacao';
  return { ...pf, foco, dias, diaLongo, maxCorridas: Math.min(pf.maxCorridas || 9, max), qMax: Math.min(pf.qMax, 1), tempo: curto ? Math.min(pf.tempo, 40) : pf.tempo, tempoLongo: curto ? Math.min(pf.tempoLongo, 40) : pf.tempoLongo };
}

// ---------- análise do treino feito contra o planejado ----------
const TIPOS_FORTES_REG = new Set(['fartlek', 'tempo', 'intervalado', 'tiros', 'progressivo', 'ritmo', 'teste', 'prova']);
const CONTINUOS = new Set(['leve', 'regenerativo', 'longo']);
const parDe = (v, min, max) => (Array.isArray(v) && v.length === 2 && v.every((x) => Number.isInteger(x) && x >= min && x <= max) && v[0] <= v[1] ? [v[0], v[1]] : null);
const num1 = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, Math.round(v * 10) / 10) : 0);
// O que estava planejado no dia, guardado junto com o registro:
// { tipo, durMin, distKm, ritmo: [de, ate] | null, pse: [de, ate] | null, un: 't' (treino prescrito por tempo) | 'd' (por distância) }
function limparPlanejado(p) {
  if (!isObj(p) || typeof p.tipo !== 'string' || !Object.prototype.hasOwnProperty.call(TIPOS_TREINO, p.tipo)) return null;
  return { tipo: p.tipo, durMin: num1(p.durMin, 900), distKm: num1(p.distKm, 120), ritmo: parDe(p.ritmo, 100, 1300), pse: parDe(p.pse, 0, 10), un: p.un === 'd' ? 'd' : 't' };
}
const unidadeDe = (t) => (t.un === 'd' || (Array.isArray(t.blocos) && t.blocos.some((b) => b.m > 0 && !b.seg)) ? 'd' : 't');
const parRitmo = (r) => (Array.isArray(r) ? r : r ? [Math.round(r.de), Math.round(r.ate)] : null);
export const planejadoDe = (t) => (t && typeof t.tipo === 'string' && t.tipo ? limparPlanejado({ tipo: t.tipo, durMin: t.durMin, distKm: t.distKm, ritmo: parRitmo(t.ritmo), pse: Array.isArray(t.pse) ? t.pse.map((x) => Math.round(x)) : null, un: unidadeDe(t) }) : null);

// O treino que o plano MOSTROU em cada dia (state.run.mostrados): os ajustes do plano só valem de hoje em diante, então o
// que foi mostrado em um dia que já passou tem de ficar guardado para a análise, as faltas e a semana passada baterem com
// o que a pessoa viu. tipo '' = o plano não tinha treino naquele dia.
export const MAX_MOSTRADOS = 400;
function limparMostrado(m) {
  if (!isObj(m) || !diaValido(m.data)) return null;
  const tipo = typeof m.tipo === 'string' && Object.prototype.hasOwnProperty.call(TIPOS_TREINO, m.tipo) ? m.tipo : '';
  const txt = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  if (!tipo) return { data: m.data, tipo: '', nome: '', resumo: '', durMin: 0, distKm: 0, ritmo: null, pse: null, un: 't' };
  return { data: m.data, tipo, nome: txt(m.nome, 60), resumo: txt(m.resumo, 160), durMin: num1(m.durMin, 900), distKm: num1(m.distKm, 120), ritmo: parDe(m.ritmo, 100, 1300), pse: parDe(m.pse, 0, 10), un: m.un === 'd' ? 'd' : 't' };
}
function limparMostrados(v) {
  const mapa = new Map();
  if (Array.isArray(v)) for (let i = 0; i < v.length && i < MAX_MOSTRADOS * 20; i++) { const m = limparMostrado(v[i]); if (m) mapa.set(m.data, m); }
  const out = [...mapa.values()].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  return out.length > MAX_MOSTRADOS ? out.slice(out.length - MAX_MOSTRADOS) : out;
}
const mostradoDe = (d, data) => limparMostrado(d ? { data, tipo: d.tipo, nome: d.nome, resumo: d.resumo, durMin: d.durMin, distKm: d.distKm, ritmo: parRitmo(d.ritmo), pse: Array.isArray(d.pse) ? d.pse.map((x) => Math.round(x)) : null, un: unidadeDe(d) } : { data, tipo: '' });
// degrau de ritmo já concedido: { pontos (1 a 10), base ('entrevista' ou a data do resultado que serve de base) }
function limparDegrau(d) {
  if (!isObj(d) || !Number.isInteger(d.pontos) || d.pontos < 1 || d.pontos > 10 || !(d.base === 'entrevista' || diaValido(d.base))) return null;
  return { pontos: d.pontos, base: d.base };
}
const mostradoEm = (st, data) => { const l = st && isObj(st.run) && Array.isArray(st.run.mostrados) ? st.run.mostrados : []; const m = l.find((x) => isObj(x) && x.data === data); return m ? limparMostrado(m) : null; };

// treino leve mais rápido que a faixa e com esforço baixo
const rapidoEFacil = (r) => !!(r.plan && r.plan.ritmo && CONTINUOS.has(r.plan.tipo) && r.distKm && r.durMin && (r.durMin * 60) / r.distKm < r.plan.ritmo[0] - 5 && r.pse != null && r.pse <= 4);
// padrão: 3 dos 5 últimos treinos leves (em 28 dias) mais rápidos que a faixa, com esforço baixo
function padraoRapidoFacil(registros, hoje) {
  const l = registros.filter((r) => r.data <= hoje && diasEntre(r.data, hoje) <= 28 && r.plan && CONTINUOS.has(r.plan.tipo) && r.plan.ritmo && r.distKm && r.durMin && r.pse != null).slice(-5);
  return l.length >= 3 && l.filter(rapidoEFacil).length >= 3;
}
const SELO = { dentro: 'Dentro do plano', acima: 'Acima do plano', abaixo: 'Abaixo do plano', livre: 'Fora do plano', sem: 'Sem comparação' };
// Compara o que foi feito no dia com o que estava planejado.
// ctx = { longa30, longaMin30: maior corrida (km e min) dos 30 dias anteriores; informado: corrida mais longa informada na
// entrevista (só nas 4 primeiras semanas do plano); nivel; desconhecido: o plano existia, mas o que ele mostrava não ficou guardado }.
// Devolve { selo, titulo, itens: [{ tom: 'ok' | 'info' | 'warn', texto }], plano (o que o plano faz com isso), refs }.
// O selo sai dos itens por uma regra só: algo a mais (volume, ritmo ou esforço) → acima; senão, algo a menos → abaixo;
// senão, se houve o que comparar → dentro; sem nada para comparar → sem comparação. "Dentro do plano" nunca traz alerta.
// Regras: a carga de uma corrida se mede contra a mais longa dos últimos 30 dias (frandsen2025: até 10% a mais não muda o
// risco; de 10 a 30%, 64% maior; de 30 a 100%, 52% maior; mais que o dobro, 128% maior); treino leve tem de ser leve
// (seiler2009, ieno2020); atletas tendem a fazer o dia leve mais forte e o forte mais leve do que o planejado
// (inoue2022); depois de treino intenso, 24 a 48 horas de recuperação (buchheit2014); treino perdido ou
// encurtado não se repõe (pollock1998, feely2023); ritmo mais rápido com o mesmo esforço acompanha a melhora, mas só um
// resultado novo muda os ritmos (vesterinen2016, vdoto2_ajuste).
function analisar(plan, r, ctx) {
  const itens = [], refs = new Set(), planos = [];
  // lado: 'mais' | 'menos' | 'ok' (comparou e bateu) | '' (informação, sem comparação)
  const it = (tom, lado, texto, ...f) => { itens.push({ tom, lado, texto }); for (const k of f) refs.add(k); };
  const fim = (seloFixo) => {
    if (!itens.length) it('info', '', 'Sem distância, tempo ou esforço para comparar com o planejado.');
    const selo = seloFixo || (itens.some((x) => x.lado === 'mais') ? 'acima' : itens.some((x) => x.lado === 'menos') ? 'abaixo' : itens.some((x) => x.lado === 'ok') ? 'dentro' : 'sem');
    return { selo, titulo: SELO[selo], itens: itens.map(({ tom, texto }) => ({ tom, texto })), plano: [...new Set(planos)].join(' ') || (selo === 'dentro' ? 'Nada muda no plano.' : selo === 'livre' ? 'O plano considera esta corrida no volume da semana.' : 'Nada muda no plano por este treino.'), refs: [...refs] };
  };
  const ritmo = r.distKm && r.durMin ? (r.durMin * 60) / r.distKm : 0;
  const forteFeito = TIPOS_FORTES_REG.has(r.tipo) || (r.tipo === 'livre' && r.pse != null && r.pse >= 7);
  if (ctx.soma > 1) it('info', '', `Somei as ${ctx.soma} corridas registradas neste dia.`);
  // Salto de carga em uma corrida. Referência: a corrida mais longa dos 30 dias anteriores; sem histórico, o longo informado na
  // entrevista ou o próprio treino planejado (na unidade em que foi prescrito). Sem distância, a conta é feita em tempo.
  // Devolve null (sem como comparar), 0 (até 10% a mais) ou o percentual do salto (e já escreve o alerta).
  const salto = () => {
    const refKm = Math.max(ctx.longa30, ctx.informado, plan && plan.un === 'd' ? plan.distKm : 0);
    const refMin = Math.max(ctx.longaMin30, plan && plan.un === 't' ? plan.durMin : 0);
    // com distância e tempo, vale a pior das duas contas
    const temKm = r.distKm > 0 && refKm > 0, temMin = r.durMin > 0 && refMin > 0;
    if (!temKm && !temMin) return null;
    const pKm = temKm ? r.distKm / refKm : 0, pMin = temMin ? r.durMin / refMin : 0;
    const porKm = temKm && pKm >= pMin;
    const pct = Math.round((Math.max(pKm, pMin) - 1) * 100);
    if (pct <= 10 || (porKm ? r.distKm < 2 : r.durMin < 15)) return 0;
    const risco = pct > 100 ? 'mais que dobra o risco de lesão por sobrecarga' : pct > 30 ? 'aumenta o risco de lesão por sobrecarga em cerca de 50%' : 'aumenta o risco de lesão por sobrecarga em cerca de 60%';
    const contra = porKm ? (ctx.longa30 >= refKm ? 'a sua corrida mais longa dos últimos 30 dias' : ctx.informado >= refKm ? 'a corrida mais longa que você informou na entrevista' : 'o treino planejado') : (ctx.longaMin30 >= refMin ? 'a sua corrida mais longa dos últimos 30 dias' : 'o treino planejado');
    const novato = ctx.nivel <= 1 && pct > 30;
    it('warn', 'mais', `Foram ${porKm ? fmtKm(r.distKm) : Math.round(r.durMin) + ' min'}, ${pct}% a mais que ${contra} (${porKm ? fmtKm(refKm) : Math.round(refMin) + ' min'}). Um salto desse tamanho em uma única corrida ${risco}.${novato ? ' Para quem está começando, o risco de lesão já é maior nas primeiras semanas.' : ''}`, 'frandsen2025', ...(novato ? ['videbaek2015'] : []));
    planos.push('Nos próximos dias, fique nos treinos leves. O plano não cresce a partir deste excesso: a próxima semana parte do que estava previsto.');
    return pct;
  };
  if (r.tipo === 'caminhada') { it('ok', '', 'Caminhada: soma movimento sem somar impacto. Não entra no volume de corrida.', 'oms2020'); return fim('livre'); }
  if (!plan) {
    if (ctx.desconhecido) { it('info', '', 'Não ficou guardado o que o plano mostrava neste dia: não há como comparar. A corrida conta no volume da semana.'); return fim('sem'); }
    it('info', '', 'Corrida fora do plano: entra no volume da semana e na conta do treino longo.', 'frandsen2025');
    const s = salto();
    if (s === 0) it('ok', '', 'Ficou dentro de 10% da sua corrida mais longa do mês: sem salto de carga.', 'frandsen2025');
    if (forteFeito || (r.pse != null && r.pse >= 7)) { it('warn', 'mais', 'Foi um treino forte a mais na semana. Depois de um treino intenso, o corpo leva de 24 a 48 horas para se recuperar.', 'buchheit2014', 'seiler2009'); planos.push('Se o próximo treino forte cair no dia seguinte, o plano troca por rodagem leve.'); }
    return fim('livre');
  }
  const leve = INTENS[plan.tipo] === 'leve';
  const ehProva = plan.tipo === 'prova' || plan.tipo === 'teste';
  if (plan.tipo === 'descanso') {
    it('warn', 'mais', 'O plano tinha tirado a corrida deste dia por causa de uma dor. Correr por cima de dor que pede pausa pode piorar a lesão.', 'hoenig2022', 'liem2013');
    planos.push('Se a dor voltar ou aumentar, anote-a: o plano se ajusta. Se melhorou, marque “Melhorou” na dor.');
    return fim();
  }
  // 1) tipo do treino
  if (forteFeito && leve && r.tipo !== 'teste' && r.tipo !== 'prova') {
    it('warn', 'mais', `Era dia de ${TIPOS_TREINO[plan.tipo].nome.toLowerCase()} e saiu um treino forte. Depois de um treino intenso, o corpo leva de 24 a 48 horas para se recuperar; forte demais nos dias leves tira qualidade dos dias fortes.`, 'buchheit2014', 'seiler2009');
    planos.push('Se o próximo treino forte cair no dia seguinte, o plano troca por rodagem leve.');
  } else if (!leve && !ehProva && !forteFeito && LEVES.has(r.tipo) && r.tipo !== 'longo' && !(r.pse != null && r.pse >= 6)) {
    it('info', 'menos', `O ${TIPOS_TREINO[plan.tipo].nome.toLowerCase()} do dia virou corrida leve. Perder uma sessão de vez em quando não derruba o condicionamento.`, 'pollock1998', 'feely2023');
    planos.push('O plano não repõe o treino forte: segue no próximo.');
  }
  // 2) quantidade, na unidade em que o treino foi prescrito (sem ela, nada de comparar por estimativa)
  const porTempo = plan.un !== 'd';
  const feito = porTempo ? r.durMin : r.distKm, previsto = porTempo ? plan.durMin : plan.distKm;
  const txtPrevisto = porTempo ? Math.round(previsto) + ' min' : fmtKm(previsto);
  if (ehProva) {
    if (r.distKm && plan.distKm) {
      if (r.distKm < plan.distKm * 0.9) it('info', 'menos', `O dia era de ${TIPOS_TREINO[plan.tipo].nome.toLowerCase()} de ${fmtKm(plan.distKm)}, e o registro tem ${fmtKm(r.distKm)}: a distância não foi completada.`);
      else it('ok', 'ok', 'Distância completada.');
    } else it('info', '', 'Sem a distância no registro, não dá para conferir se a distância foi completada.');
  } else if (!previsto) { /* sem quantidade planejada: nada a comparar */ }
  else if (!feito) it('info', '', porTempo ? `O treino era por tempo (${txtPrevisto}) e o registro não tem o tempo: sem como comparar a duração.` : `O treino era por distância (${txtPrevisto}) e o registro não tem a distância: sem como comparar.`);
  else {
    const dif = feito - previsto, pct = Math.round((dif / previsto) * 100), un = porTempo ? `${Math.round(Math.abs(dif))} min` : fmtKm(Math.abs(dif));
    const grande = Math.abs(dif) >= (porTempo ? 5 : 0.6) && Math.abs(pct) >= 15;
    if (grande && dif > 0) {
      it('info', 'mais', `Você fez ${un} a mais que o planejado (${txtPrevisto}): +${pct}%.`);
      const s = salto();
      if (s === null) it('info', '', 'Sem uma corrida anterior para comparar, não dá para dizer se foi um salto de carga. A regra: não passar de 10% sobre a sua corrida mais longa do último mês.', 'frandsen2025');
      else if (s === 0) it('ok', '', 'Ficou dentro de 10% da sua corrida mais longa do mês: não é um salto de carga.', 'frandsen2025');
      if (!leve) it('info', '', 'Treino forte esticado soma mais cansaço do que ganho: o tamanho da parte forte tem limite.', 'vdoto2_definicoes');
      planos.push('O plano não acompanha o excesso: a próxima semana parte do que estava previsto.');
    } else if (grande && dif < 0) {
      it('info', 'menos', `Você fez ${un} a menos que o planejado (${txtPrevisto}): ${pct}%. Treino encurtado não precisa ser reposto.`, 'feely2023', 'pollock1998');
      planos.push('O plano não repõe. Se a semana inteira ficar bem abaixo, a próxima parte do que você fez.');
    } else it('ok', 'ok', porTempo ? 'Duração dentro do planejado.' : 'Distância dentro do planejado.');
  }
  // 3) ritmo, nos treinos contínuos com faixa
  let disseEsforco = false;
  if (plan.ritmo && ritmo && CONTINUOS.has(plan.tipo) && !forteFeito) {
    const faixa = `${fmtRitmo(plan.ritmo[0])} a ${fmtRitmo(plan.ritmo[1])}`;
    const limite = plan.pse ? plan.pse[1] : 4;
    if (ritmo < plan.ritmo[0] - 5) {
      if (r.pse != null && r.pse > limite) {
        it('warn', 'mais', `Ritmo de ${fmtRitmo(ritmo)} por km, mais rápido que a faixa (${faixa}), e com esforço ${r.pse}: o treino leve virou moderado. Com o mesmo treino forte, quem passa mais tempo no moderado melhora menos.`, 'seiler2009');
        planos.push('Se dois dos três últimos treinos leves ficarem com esforço de 5 ou mais, o plano segura o volume da semana seguinte.');
        disseEsforco = true;
      } else if (r.pse != null) {
        it('info', 'mais', `Ritmo de ${fmtRitmo(ritmo)} por km, mais rápido que a faixa (${faixa}), com esforço baixo. Pode ser sinal de evolução, mas não acelere os dias leves: só um teste confirma.`, 'vesterinen2016', 'vdoto2_ajuste');
        planos.push('Os ritmos não mudam por um treino. Registre um “Teste de ritmo” de 3 ou 5 km para eu recalcular; se o padrão se repetir, eles sobem um degrau em 4 semanas em vez de 6.');
      } else it('info', 'mais', `Ritmo de ${fmtRitmo(ritmo)} por km, mais rápido que a faixa (${faixa}). Sem o esforço anotado, não dá para dizer se foi fácil ou forçado: nos dias leves, fique na faixa.`, 'seiler2009');
    } else if (ritmo > plan.ritmo[1] + 10) {
      if (r.pse != null && r.pse >= 6) { it('warn', 'mais', `Mais lento que a faixa (${fmtRitmo(ritmo)} por km contra ${faixa}) e, ainda assim, com esforço ${r.pse}: pode ser cansaço acumulado, calor ou noite ruim.`, 'saw2016', 'meeusen2013'); planos.push('Se o esforço alto se repetir, o plano segura o volume ou antecipa uma semana leve.'); disseEsforco = true; }
      else it('ok', 'ok', `Mais lento que a faixa (${fmtRitmo(ritmo)} por km contra ${faixa})${r.pse != null ? ', com esforço baixo' : ''}: sem problema. No treino leve, devagar não é erro.`, 'seiler2009');
    } else it('ok', 'ok', `Ritmo dentro da faixa (${faixa} por km).`);
  }
  // 4) esforço, contra a faixa que o próprio plano mostrou para o treino
  if (r.pse == null) { if (plan.pse) it('info', '', 'Esforço não informado: sem ele, a análise fica só no tempo e na distância.'); }
  else if (plan.pse && !disseEsforco && !ehProva) {
    const [min, max] = plan.pse;
    if (leve && r.pse > max) {
      it('warn', 'mais', `Esforço ${r.pse} em treino leve (o esperado é até ${max}). É o desvio mais comum: o dia leve sai mais forte do que o planejado e tira recuperação.`, 'seiler2009', 'inoue2022');
      planos.push('Se dois dos três últimos treinos leves ficarem com esforço de 5 ou mais, o plano segura o volume da semana seguinte.');
    } else if (!leve && r.pse > max + 1) {
      it('warn', 'mais', `Esforço ${r.pse} em treino previsto para ${min} a ${max}: bem acima do esperado. Treino forte é forte, mas controlado; no limite, a recuperação demora mais.`, 'saw2016', 'buchheit2014');
      planos.push('Se os três últimos treinos ficarem com esforço de 7 ou mais, o plano antecipa uma semana leve.');
    } else if (!leve && r.pse < min - 1) it('info', 'menos', `Esforço ${r.pse} em treino previsto para ${min} a ${max}: o estímulo ficou menor que o planejado. É comum fazer o dia forte mais leve do que o previsto.`, 'seiler2009');
    else it('ok', 'ok', `Esforço ${r.pse}: dentro do esperado para este treino.`);
  }
  return fim();
}
// análise de um registro do estado (as corridas do mesmo dia são somadas)
export function analiseDoRegistro(st, hoje, registro) {
  const r0 = limparRegistro(registro);
  if (!r0) return null;
  const runs = limparRegistros(st && Array.isArray(st.runs) ? st.runs : []).filter((x) => x.id !== r0.id && x.tipo !== 'caminhada');
  const run = st && isObj(st.run) ? st.run : {};
  // o que estava planejado: o que o registro guardou; senão, o que o plano mostrou no dia; senão (hoje ou adiante), o plano de agora
  let plan = r0.plan || null, desconhecido = false;
  if (!plan) {
    const m = mostradoEm(st, r0.data);
    if (m) plan = m.tipo ? limparPlanejado(m) : null;
    else if (diaValido(hoje) && r0.data >= hoje) { try { plan = planejadoDe(treinoDoDia(st, hoje, r0.data)); } catch { plan = null; } }
    else desconhecido = !!(run.aceitoEm && diaLocal(run.aceitoEm) && r0.data >= diaLocal(run.aceitoEm));
  }
  // corridas do mesmo dia entram somadas
  const doDia = r0.tipo === 'caminhada' ? [] : runs.filter((x) => x.data === r0.data);
  const todos = [r0, ...doDia];
  const pses = todos.map((x) => x.pse).filter((x) => x != null);
  const r = doDia.length ? { ...r0, distKm: todos.every((x) => x.distKm) ? todos.reduce((s, x) => s + x.distKm, 0) : 0, durMin: todos.every((x) => x.durMin) ? todos.reduce((s, x) => s + x.durMin, 0) : 0, pse: pses.length ? Math.max(...pses) : null, tipo: todos.some((x) => TIPOS_FORTES_REG.has(x.tipo)) ? todos.find((x) => TIPOS_FORTES_REG.has(x.tipo)).tipo : r0.tipo } : r0;
  const antes = runs.filter((x) => x.data < r0.data && diasEntre(x.data, r0.data) <= 30);
  let informado = 0, nivel = 2;
  try { const pf = perfil(run.answers); nivel = pf.nivel; if (pf.retorno === 0 && diaValido(run.inicio) && diasEntre(run.inicio, r0.data) < 28) informado = pf.longoAtual; } catch { /* sem entrevista */ }
  return analisar(plan, r, { longa30: Math.max(0, ...antes.map((x) => x.distKm || 0)), longaMin30: Math.max(0, ...antes.map((x) => x.durMin || 0)), informado, nivel, desconhecido, soma: todos.length });
}
// Últimas corridas com a análise de cada uma, os treinos que o plano mostrou e ficaram sem registro, e os padrões que se repetem.
export function analiseRecente(st, hoje, n = 5) {
  const out = { itens: [], faltas: [], padroes: [], contagem: { dentro: 0, acima: 0, abaixo: 0, livre: 0, sem: 0 } };
  if (!st || !diaValido(hoje)) return out;
  const runs = limparRegistros(st.runs).filter((r) => r.data <= hoje);
  // um item por dia (as corridas do mesmo dia são analisadas juntas)
  const dias = new Set();
  for (const r of runs.filter((x) => diasEntre(x.data, hoje) <= 28).reverse()) {
    if (dias.has(r.data) || dias.size >= n) continue;
    dias.add(r.data);
    const a = analiseDoRegistro(st, hoje, r);
    if (a) { out.itens.push({ registro: r, analise: a }); out.contagem[a.selo]++; }
  }
  let p = null;
  try { p = planoAtual(st, hoje); } catch { p = null; }
  const mostrados = limparMostrados(st.run && st.run.mostrados);
  const recentes = runs.filter((r) => diasEntre(r.data, hoje) <= 28);
  const corridaMostrada = (m) => m.tipo && m.tipo !== 'caminhada' && m.tipo !== 'descanso';
  // faltas: corridas que o plano MOSTROU nos últimos 14 dias e ficaram sem registro (só para quem registra)
  if (recentes.length) for (const m of mostrados) {
    if (m.data >= hoje || diasEntre(m.data, hoje) > 14 || m.data < recentes[0].data || !corridaMostrada(m) || runs.some((r) => r.data === m.data)) continue;
    out.faltas.push({ data: m.data, tipo: m.tipo, nome: m.nome || TIPOS_TREINO[m.tipo].nome, forte: INTENS[m.tipo] === 'forte' });
  }
  // padrões: o texto só afirma o que o plano de fato está fazendo
  const ajuste = (re) => !!(p && p.ajustes.some((x) => re.test(x.texto)));
  if (p && p.sinais && p.sinais.pesado) out.padroes.push({ id: 'leve_pesado', texto: 'Seus treinos leves têm ficado com esforço de 5 ou mais. Leve é até 4: diminua o ritmo.' + (ajuste(/Volume mantido nesta semana|Semana leve antecipada/) ? ' Por isso o plano segurou o volume desta semana.' : ''), refs: ['seiler2009', 'ieno2020'] });
  if (padraoRapidoFacil(runs, hoje)) out.padroes.push({ id: 'rapido_facil', texto: 'Seus treinos leves têm saído mais rápidos que a faixa, com esforço baixo: sinal de que o condicionamento subiu. Um “Teste de ritmo” de 3 ou 5 km recalcula tudo; sem teste, os ritmos sobem um degrau a cada 4 semanas de treino em dia.', refs: ['vesterinen2016', 'vdoto2_ajuste'] });
  if (p && p.semanaAtual >= 2 && p.semanaAtual <= p.totalSemanas + 1) {
    const ini = p.inicios[p.semanaAtual - 2], fim = somaDias(ini, 6);
    const daSemana = mostrados.filter((m) => m.data >= ini && m.data <= fim);
    // só com a semana inteira guardada dá para dizer quanto o plano previa
    if (daSemana.length === 7) {
      const previsto = daSemana.filter(corridaMostrada).reduce((s, m) => s + m.distKm, 0);
      const feito = runs.filter((r) => r.tipo !== 'caminhada' && r.data >= ini && r.data <= fim).reduce((s, r) => s + (r.distKm || 0), 0);
      if (previsto >= 5 && feito > previsto * 1.15 && feito - previsto >= 3) out.padroes.push({ id: 'acima_do_volume', texto: `Na semana passada você correu ${fmtKm(feito)}, e o plano mostrava ${fmtKm(previsto)}. O plano não acompanha o excesso: esta semana parte do que estava previsto. O limite seguro é subir até 10% por semana; saltos grandes aumentam o risco de lesão.`, refs: ['soligard2016', 'frandsen2025'] });
    }
  }
  const fortesPerdidos = out.faltas.filter((f) => f.forte).length;
  if (fortesPerdidos >= 2) out.padroes.push({ id: 'fortes_perdidos', texto: `${fortesPerdidos} treinos fortes ficaram sem registro nas últimas 2 semanas. Não tente repor: siga o plano. A forma se mantém por semanas com menos treino, desde que a intensidade volte.`, refs: ['feely2023', 'pollock1998'] });
  return out;
}

// ---------- plano ----------
function opcoesLimpas(o) {
  const op = isObj(o) ? o : {};
  const dias = (l) => (Array.isArray(l) ? [...new Set(l.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))] : []);
  const hoje = diaValido(op.hoje) ? op.hoje : '';
  const inicio = diaValido(op.inicio) ? segundaDe(op.inicio) : '';
  // períodos sem correr conhecidos: pausas do plano (com as semanas que o plano pulou) e suspensões por dor
  const paradas = (Array.isArray(op.paradas) ? op.paradas : []).filter((p) => isObj(p) && diaValido(p.de) && diaValido(p.ate) && p.de <= p.ate).slice(0, 60)
    .map((p) => ({ de: p.de, ate: p.ate, semanas: Number.isInteger(p.semanas) && p.semanas > 0 ? Math.min(p.semanas, Math.floor(diasEntre(p.de, p.ate) / 7)) : 0, motivo: p.motivo === 'dor' ? 'dor' : 'pausa' }))
    .sort((a, b) => (a.de < b.de ? -1 : a.de > b.de ? 1 : 0));
  return {
    hoje, inicio, desde: diaValido(op.desde) ? op.desde : '', registros: limparRegistros(op.registros), adiado: op.adiado === true, paradas,
    mostrados: limparMostrados(op.mostrados), degrau: limparDegrau(op.degrau),
    foco: FOCOS_CORRIDA.includes(op.foco) ? op.foco : '', // prioridade entre corrida e musculação ('' = sem escolha: o plano não muda)
    diasForca: dias(op.diasForca), diasPernas: dias(op.diasPernas),
    dores: (Array.isArray(op.dores) ? op.dores : []).filter((d) => isObj(d) && typeof d.onde === 'string' && Object.prototype.hasOwnProperty.call(LOCAIS_DOR, d.onde) && Number.isFinite(d.nivel)).slice(0, 30),
    // dores que a pessoa marcou como melhoradas: { onde, fim }
    encerradas: (Array.isArray(op.encerradas) ? op.encerradas : []).filter((d) => isObj(d) && typeof d.onde === 'string' && diaValido(d.fim)).slice(0, 100).map((d) => ({ onde: d.onde, fim: d.fim })),
  };
}

// Volta depois de um tempo sem correr: fração do volume de antes em cada semana, semanas sem treino forte e sem acelerações.
// 2 a 4 semanas parado: 50% e 70% (caterisano2019: regra 50/30 para quem ficou 2 semanas ou mais parado). Nas pausas maiores
// a regra é escolha do aplicativo, mais conservadora que esses 50%: 4 a 8 semanas, 33%, 50% e 75%, com acelerações só no terço
// final; 8 semanas ou mais, 33% (o piso da faixa de um terço a metade de liem2013), só corrida leve por 6 semanas, acelerações
// a partir da 7ª e treino forte a partir da 10ª (uma semana a mais que as 8 de ramskov2018); o volume sobe 10% por semana a
// partir dos 33%. Depois de 3 meses o volume antigo não serve mais de base (barbieri2024, coyle1994): a primeira semana não
// passa de 15 km, o volume inicial de um programa de amadores (ramskov2016).
const VOLTA = [
  { min: 56, fatores: [0.33], semForte: 9, semAcel: 6 },
  { min: 28, fatores: [0.33, 0.5, 0.75], semForte: 3, semAcel: 2 },
  { min: 14, fatores: [0.5, 0.7], semForte: 2, semAcel: 2 },
];
const tierDaVolta = (dias) => VOLTA.find((t) => dias >= t.min) || null;
const tetoDaVolta = (t, dias, semana, antes) => (t.min >= 56 ? Math.min(antes * 0.33, dias >= 90 ? 15 : Infinity) * 1.1 ** (semana - 1) : antes * (t.fatores[semana - 1] || 1));
// Volta em andamento, ou null: { dias, de (último dia antes de parar), retorno (dia da volta), motivo, tier, semana }.
// Conta o intervalo de 14 dias ou mais entre corridas registradas, as pausas do plano (14 dias ou mais) e as suspensões por dor
// de 7 dias ou mais (liem2013, warden2021: a volta depois de lesão também é gradual).
function voltaDe(datas, paradas, hoje) {
  const cand = [];
  if (datas.length) {
    const ult = datas[datas.length - 1];
    if (diasEntre(ult, hoje) >= 14) cand.push({ dias: diasEntre(ult, hoje), de: ult, retorno: hoje, motivo: 'pausa' });
    for (let i = datas.length - 1; i >= 1; i--) if (diasEntre(datas[i - 1], datas[i]) >= 14) { cand.push({ dias: diasEntre(datas[i - 1], datas[i]), de: datas[i - 1], retorno: datas[i], motivo: 'pausa' }); break; }
  }
  for (const p of paradas) {
    const d = diasEntre(p.de, p.ate);
    if (p.ate > hoje || d < (p.motivo === 'dor' ? 1 : 14) || datas.some((x) => x > p.de && x < p.ate)) continue;
    cand.push({ dias: p.motivo === 'dor' ? Math.max(d, 14) : d, de: p.de, retorno: p.ate, motivo: p.motivo });
  }
  // o intervalo sem corrida que cobre uma suspensão por dor é uma volta depois da dor
  for (const x of cand) if (paradas.some((p) => p.motivo === 'dor' && p.de <= x.retorno && p.ate >= x.de)) x.motivo = 'dor';
  cand.sort((a, b) => (a.retorno < b.retorno ? 1 : a.retorno > b.retorno ? -1 : b.dias - a.dias));
  const v = cand[0];
  if (!v) return null;
  const tier = tierDaVolta(v.dias);
  const semana = Math.floor(diasEntre(segundaDe(v.retorno), hoje) / 7) + 1;
  return tier && semana >= 1 && semana <= tier.semForte ? { ...v, tier, semana } : null;
}

const eventoDe = (pf) => (pf.dist ? (pf.objetivo === 'ritmo' && pf.dist <= 10 ? 'teste' : 'prova') : null);
const ehEventoDia = (d) => d.tipo === 'prova' || d.tipo === 'teste';
const ehCorridaDia = (d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso';
// medida em que o longo é mostrado: meio quilômetro (por distância) ou 5 minutos (por tempo)
function gradeDe(c) {
  const rl = c.P ? media(c.P.longo) : c.est.leve;
  return (km, perto) => (c.porDist ? Math.max(2, (perto ? Math.round(km * 2) : Math.floor(km * 2 + 0.02)) / 2) : (Math.max(2, perto ? Math.round((km * rl) / 300) : Math.floor((km * rl) / 300 + 0.02)) * 300) / rl);
}
// minutos de corrida por semana em cada etapa do programa de corrida e caminhada
const MIN_ETAPA = ETAPAS.map((e) => e.reduce((s, sess) => s + sess.reduce((x, [a, , n]) => x + a * n, 0), 0) / 60);
// Formato do plano de quem começa do zero: o programa de corrida e caminhada e, se há distância, a continuação.
// semAlvo = total de semanas do plano quando ele é fixo (prova com data), ou null.
function estruturaNivel0(pf, est, grade, semAlvo) {
  const corridaDias = escolherDias(pf.dias, 3, pf.dias.includes(pf.diaLongo) ? pf.diaLongo : null, true);
  const nC = corridaDias.length;
  const comeco = pf.posparto ? 0 : pf.inicioLento ? 1 : pf.exp === 'nunca' ? 3 : 5;
  const passoEtapa = nC === 1 ? 2 : 1; // com 1 corrida por semana, cada etapa dura 2 semanas
  const nCC = (ETAPAS.length - comeco) * passoEtapa;
  let geral = null, T0 = nCC;
  if (pf.dist) {
    const Tg = semAlvo ? semAlvo - nCC : semanasNecessarias(pf, pf.dist, 1, 4);
    // o programa de iniciantes já vale como as 8 semanas de base
    if (Tg >= 2) geral = { T: Tg, nivel: 1, dist: pf.dist, evento: eventoDe(pf), v0: Math.min(11, (nC * 27 * 60) / est), longo0: 4, semQ: 0, estLeve: est, grade, qMax: pf.cautela || pf.idade < 16 || nC < 2 ? 0 : 1 };
    else if (semAlvo) T0 = semAlvo;
  }
  return { corridaDias, nC, comeco, passoEtapa, nCC, geral, T0 };
}
// Ponto de partida do plano geral. Na volta de pausa informada na entrevista vale a mesma regra da volta detectada pelos
// registros (VOLTA).
function cfgGeral(pf, est, grade, semAlvo) {
  const t = tierDaVolta(pf.pausaDias);
  const v0 = t ? tetoDaVolta(t, pf.pausaDias, 1, pf.kmSemana) : pf.kmSemana;
  const longo0 = Math.max(2, t ? tetoDaVolta(t, pf.pausaDias, 1, pf.longoAtual) : pf.longoAtual);
  const T = semAlvo || (pf.dist ? semanasNecessarias(pf, pf.dist, pf.nivel, longo0) : 12);
  // iniciante: 8 semanas de base antes do primeiro treino forte (ramskov2018, filipas2022)
  return { T, nivel: pf.nivel, dist: pf.dist, evento: eventoDe(pf), v0, longo0, semQ: Math.max(t ? t.semForte : 0, pf.nivel === 1 ? 8 : 0, pf.limitacoes.length ? 2 : 0), semAcel: Math.max(t ? t.semAcel : 0, pf.limitacoes.length ? 2 : 0), estLeve: est, grade };
}
// maior trecho de corrida (km) das sessões de uma etapa do programa de corrida e caminhada (guardado: a conta se repete muito)
const MEMO_ETAPA = new Map();
function maiorDaEtapa(et, c) {
  const k = et + '|' + c.pf.tempo + '|' + c.est.leve;
  if (!MEMO_ETAPA.has(k)) { if (MEMO_ETAPA.size > 400) MEMO_ETAPA.clear(); MEMO_ETAPA.set(k, Math.max(...[0, 1, 2].map((i) => tCC(et, i, c).corridaKm))); }
  return MEMO_ETAPA.get(k);
}
// maior corrida de uma sessão (km) nas 4 semanas antes da última semana do plano, e o total de semanas
function maiorAntes(pf, c, grade, semAlvo, comData = false) {
  const est = c.est.leve, capLeve = (pf.tempo * 60) / est;
  const maiores = [];
  let total;
  if (pf.nivel === 0 && !pf.gestante) {
    const e = estruturaNivel0(pf, est, grade, semAlvo);
    for (let w = 1; w <= e.T0; w++) { const et = entre(e.comeco + Math.floor((w - 1) / e.passoEtapa), e.comeco, ETAPAS.length - 1); maiores.push(maiorDaEtapa(et, c)); }
    if (e.geral) for (const s of curva(pf, e.geral)) maiores.push(s.longo || Math.min(s.vol, capLeve));
    total = e.T0 + (e.geral ? e.geral.T : 0);
  } else {
    const cfg = cfgGeral(pf, est, grade, semAlvo);
    for (const s of curva(pf, cfg)) maiores.push(s.longo || Math.min(s.vol, capLeve));
    total = cfg.T;
  }
  let maior = Math.max(0, ...maiores.slice(Math.max(0, total - 5), total - 1));
  // plano curto: vale também a corrida mais longa das últimas 4 semanas informada na entrevista (se a pessoa não está parada)
  if (comData && pf.nivel >= 1 && total <= 4 && pf.retorno === 0) maior = Math.max(maior, Math.min(pf.longoAtual, 0.6 * pf.kmSemana));
  return { maior, total };
}
// Prazos mínimos dos programas estudados. Do zero: 5 km em 9 semanas (nhs_c25k); 10 km em 13 semanas (ryan2003); meia maratona
// em 14 semanas (damsted2017) e primeira maratona em 17 semanas (dsilva2020), as duas também para quem já corre um pouco.
const PRAZO_MIN = [{ 5: 9, 10: 13, 21: 14, 42: 17 }, { 21: 14, 42: 17 }];
// A meta cabe no prazo? A prova (ou o desafio do fim do plano) só é marcada se o maior treino das 4 semanas anteriores chega
// à metade da distância: uma corrida com mais que o dobro da mais longa dos últimos 30 dias mais que dobra o risco de lesão
// (frandsen2025). Se não cabe: a mesma distância com mais semanas e sem data; se nem assim, uma distância menor.
function ajustarMeta(pf, c, grade) {
  if (!pf.dist) return pf;
  const pedida = pf.semanasProva;
  const cabe = (dist, sem) => { const r = maiorAntes({ ...pf, dist }, c, grade, sem, !!pedida && sem === pedida && dist === pf.dist); return r1(r.maior) * 2 >= r1(DIST[dist]) - 0.15 && r.total >= ((PRAZO_MIN[pf.nivel] || {})[dist] || 0); };
  if (cabe(pf.dist, pedida)) return pf;
  const objetivo = pf.objetivo === 'prova' ? 'distancia' : pf.objetivo;
  for (const dist of [42, 21, 10, 5]) {
    if (dist > pf.dist) continue;
    let min = 0;
    // sem data, o plano tem pelo menos a duração mínima da distância (DURACAO)
    for (let t = dist === pf.dist && pedida ? Math.max(pedida + 1, 2) : DURACAO[dist][0]; t <= 60 && !min; t++) if (cabe(dist, t)) min = t;
    if (!min) continue;
    return { ...pf, objetivo, dist, semanasProva: null, semanasPlano: cabe(dist, null) ? null : min, alvoSeg: dist === pf.dist ? pf.alvoSeg : null, meta: { dist: pf.dist, semanas: pedida, min, nova: dist } };
  }
  return { ...pf, objetivo: 'saude', dist: null, semanasProva: null, alvoSeg: null, meta: { dist: pf.dist, semanas: pedida, min: 0, nova: null } };
}
// O volume que a pessoa vê não sobe mais de 10% (ou 1,5 km) sobre a maior das 3 semanas anteriores: o arredondamento de cada
// treino (5 minutos ou meio quilômetro) e a entrada de mais um dia de corrida não podem criar degraus.
function aparar(semanas, c) {
  const km = (s) => s.dias.filter(ehCorridaDia).reduce((x, d) => x + d.distKm, 0);
  const vols = [];
  for (const s of semanas) {
    const geral = s.fase !== 'adaptacao' && s.fase !== 'caminhada';
    const ant = vols.slice(-3).filter((v) => v != null);
    if (geral && ant.length && !s.dias.some(ehEventoDia)) {
      const m = Math.max(...ant), lim = Math.max(m * 1.1, m + 1.5) + 0.3;
      for (let k = 0; k < 40 && km(s) > lim; k++) {
        // encurta a rodagem mais longa; nenhuma fica com menos de 20 minutos (por isso, em volumes muito pequenos, a semana pode
        // passar um pouco do limite: é o piso das rodagens, não um salto)
        const cand = s.dias.filter((d) => (d.tipo === 'leve' || d.tipo === 'regenerativo') && d.durMin > 24).sort((a, b) => b.durMin - a.durMin)[0];
        if (!cand) break;
        const menor = limitarAo(cand, cand.durMin - 1, c);
        if (menor.durMin >= cand.durMin) break;
        s.dias[s.dias.indexOf(cand)] = { ...menor, wd: cand.wd };
      }
    }
    vols.push(geral ? km(s) : null);
  }
}
const nSemanas = (n) => (n === 1 ? '1 semana' : `${n} semanas`);

export function gerarPlano(respostas, opcoes) {
  let pf = perfil(respostas);
  if (pf.bloqueio) return null;
  const op = opcoesLimpas(opcoes);
  const ajustes = [], extras = [];
  const acompanha = !!(op.inicio && op.hoje);
  // "Em quantas semanas é a prova?" conta a semana da entrevista; se o plano só começa na segunda seguinte, sobra uma a menos
  if (pf.semanasProva && op.adiado) pf = { ...pf, semanasProva: Math.max(1, pf.semanasProva - 1) };
  // corrida e musculação: a prioridade escolhida muda quantas corridas, quanto tempo e quantos treinos fortes (aplicarFoco)
  if (op.foco) {
    pf = aplicarFoco(pf, op.foco, op.diasPernas);
    if (op.foco === 'musculacao') ajustes.push({ texto: 'Corrida como complemento da musculação: até 3 corridas por semana, de até 40 minutos, e no máximo 1 treino forte.', motivo: 'Você escolheu a musculação como prioridade. A corrida atrapalha o ganho de força e de massa das pernas quando é frequente e longa (acima de 3 dias por semana e de 20 a 30 minutos por sessão); com 2 a 3 corridas curtas, não. O fôlego se mantém por semanas com menos corrida, desde que um treino forte continue. No dia dos dois treinos, faça a musculação primeiro e corra 6 horas depois (3, no mínimo).', refs: REFS_FOCO.musculacao });
    else if (op.foco === 'equilibrio') ajustes.push({ texto: 'Corrida e musculação por igual: até 4 corridas por semana e 1 treino forte.', motivo: 'Você escolheu evoluir nos dois. Passar de 4 dias de corrida por semana trava o ganho de força e de massa; um treino forte por semana deixa recuperação para o treino de pernas. Treino forte e longão ficam a 24 horas ou mais do treino pesado de pernas; no mesmo dia, 6 horas entre os dois (3, no mínimo).', refs: REFS_FOCO.equilibrio });
  }

  // ----- calendário: as semanas que o plano pulou em uma pausa não existem na numeração -----
  const saltos = op.paradas.filter((p) => p.semanas > 0);
  const base0 = op.inicio ? somaDias(op.inicio, -7 * saltos.reduce((s, p) => s + p.semanas, 0)) : '';
  const iniSemana = (w) => { let ini = somaDias(base0, (w - 1) * 7); for (const p of saltos) if (p.de <= somaDias(ini, 6)) ini = somaDias(ini, 7 * p.semanas); return ini; };
  const semAtual = acompanha ? Math.floor(diasEntre(op.inicio, op.hoje) / 7) + 1 : 1;
  const semanaDe = (data) => { for (let w = 1; w < semAtual; w++) if (data <= somaDias(iniSemana(w), 6)) return w; return Math.max(1, semAtual); };
  const desde = op.desde || base0;
  const desdeInicio = acompanha ? op.registros.filter((r) => r.data >= desde && r.data <= op.hoje) : [];
  const temRegistros = desdeInicio.length > 0;
  // O que o plano MOSTROU em cada semana que passou (state.run.mostrados): só vale com a semana inteira guardada.
  const corridaMostrada = (m) => m.tipo && m.tipo !== 'caminhada' && m.tipo !== 'descanso';
  const mostradosDa = (w) => { const a = iniSemana(w), b = somaDias(a, 6); const l = op.mostrados.filter((m) => m.data >= a && m.data <= b); return l.length === 7 ? l.filter(corridaMostrada) : null; };
  const mostradoKm = (w) => { const l = mostradosDa(w); return l ? l.reduce((x, m) => x + m.distKm, 0) : null; };
  const maiorMostrado = (w) => { const l = mostradosDa(w); return l ? Math.max(0, ...l.map((m) => m.distKm)) : null; };

  // ----- a meta cabe no prazo? Decidido só pelas respostas, para o plano não mudar de formato no meio do caminho -----
  {
    const P0 = pf.resultado ? ritmosDe(pf.resultado.distKm, pf.resultado.seg, { fator: fatorPausa(pf.pausaDias) }) : null;
    const l0 = !!(P0 && P0.lento);
    const c0 = contexto(l0 ? { ...pf, modo: 'tempo' } : pf, l0 ? null : P0, l0 ? RITMO_TRANSICAO : 0);
    pf = ajustarMeta(pf, c0, gradeDe(c0));
  }

  // ----- ritmos: o resultado mais recente entre a entrevista e os registros de prova ou teste (últimas 12 semanas) -----
  let base = pf.resultado ? { ...pf.resultado, origem: 'entrevista', data: '' } : null;
  const txtRitmos = [];
  if (acompanha) {
    const rec = op.registros.filter((r) => (r.tipo === 'prova' || r.tipo === 'teste') && r.data <= op.hoje && diasEntre(r.data, op.hoje) <= 84 && r.distKm >= 1.5 && r.durMin > 0 && resultadoValido(r.distKm, r.durMin * 60)).pop();
    if (rec) {
      base = { distKm: rec.distKm, seg: rec.durMin * 60, origem: 'registro', data: rec.data };
      txtRitmos.push({ texto: `Ritmos recalculados pelo seu resultado de ${fmtDia(rec.data)}: ${fmtKm(rec.distKm)} em ${fmtTempo(rec.durMin * 60)}.`, motivo: 'Os ritmos de treino acompanham o seu condicionamento atual, medido pelo resultado mais recente.', refs: ['smyth2022', 'vdoto2_definicoes'] });
    }
  }
  // ----- sinais dos registros -----
  const corridas = op.registros.filter((r) => ehCorrida(r) && (!op.hoje || r.data <= op.hoje));
  const datas = [...new Set(corridas.map((r) => r.data))].sort();
  const naSemana = (w) => { const a = iniSemana(w), b = somaDias(a, 6); return corridas.filter((r) => r.data >= a && r.data <= b); };
  // duas corridas no mesmo dia contam como um dia de corrida
  const diasCorridos = (w) => new Set(naSemana(w).map((r) => r.data)).size;
  const emParada = (w) => { const a = iniSemana(w), b = somaDias(a, 6); return op.paradas.some((p) => p.de <= b && p.ate >= a); };
  const volta = acompanha ? voltaDe(datas, op.paradas, op.hoje) : null;
  // semanas completas que contam para a aderência: depois do aceite do plano, a partir da semana do primeiro registro (antes
  // disso não dá para saber se a pessoa treinou e não anotou) e fora das pausas do plano e das suspensões por dor
  const semPrimeiro = temRegistros ? semanaDe(desdeInicio[0].data) : Infinity;
  const conta = (w) => w >= semPrimeiro && iniSemana(w) >= segundaDe(desde) && (w > 1 || desde <= iniSemana(1)) && !emParada(w);
  const contaveis = [];
  if (acompanha && temRegistros) for (let w = Math.max(1, semAtual - 3); w < semAtual; w++) if (conta(w)) contaveis.push(w);
  const antes = acompanha ? op.registros.filter((r) => r.data < iniSemana(Math.max(1, semAtual)) && diasEntre(r.data, op.hoje) <= 14) : [];
  const levesAntes = antes.filter((r) => LEVES.has(r.tipo) && r.pse != null).slice(-3);
  // esforço por zona na escala de 10 pontos: até 4 leve, 5 a 6 moderado, 7 ou mais forte (ieno2020, haddad2017)
  const pesado = temRegistros && levesAntes.length >= 2 && levesAntes.filter((r) => r.pse >= 5).length >= 2;
  const ultimos3 = antes.filter((r) => r.pse != null).slice(-3);
  const exausto = temRegistros && ultimos3.length === 3 && ultimos3.every((r) => r.pse >= 7);

  // ----- dores -----
  const efeitos = op.dores.map((d) => ({ d, ef: efeitoDaDor(d, pf) })).filter((x) => x.ef.nivel > 0);
  // dor de 4 ou mais anotada em uma corrida dos últimos 7 dias também conta, a não ser que haja um relato do mesmo local
  // (ativo, ou marcado como melhorado depois dessa corrida)
  if (acompanha) for (const r of op.registros) for (const rd of (Array.isArray(r.dores) ? r.dores : [])) {
    if (rd.nivel < 4 || r.data > op.hoje || diasEntre(r.data, op.hoje) > 7 || op.dores.some((d) => d.onde === rd.onde && diaValido(d.data) && d.data > r.data) || op.encerradas.some((d) => d.onde === rd.onde && d.fim >= r.data)) continue;
    const d = { onde: rd.onde, nivel: rd.nivel, tipo: rd.tipo || 'articular', quando: rd.tipo === 'muscular' ? 'depois' : 'durante', dias: diasEntre(r.data, op.hoje) };
    const ef = efeitoDaDor(d, pf);
    if (ef.nivel > 0) efeitos.push({ d, ef });
  }
  const pior = efeitos.reduce((m, x) => (x.ef.nivel > m.nivel || (x.ef.nivel === m.nivel && x.ef.corte > m.corte) ? x.ef : m), { nivel: 0, corte: 0 });
  for (const { d, ef } of efeitos) ajustes.push({ texto: `${LOCAIS_DOR[d.onde]}: ${ef.texto}`, motivo: `Você contou dor de intensidade ${d.nivel} nessa região. O ajuste vale por 7 dias a partir de hoje e se renova enquanto a dor estiver registrada: marque “Melhorou” na dor quando ela passar.`, refs: ef.refs });

  // ----- ritmos, com os ajustes de VDOT -----
  // Na volta de pausa, o VDOT cai conforme o tempo parado (vdoto2_pausa). Sem prova nova e com o treino em dia, sobe 1 ponto
  // a cada 6 semanas, o lado conservador da orientação de Daniels ("a cada 4 a 6 semanas, não mais": vdoto2_ajuste).
  let P = null, lento = false, chaveBase = '', pontosDados = 0;
  if (base) {
    const pausaDias = base.origem === 'entrevista' ? pf.pausaDias : 0;
    const naVolta = volta && (base.origem === 'entrevista' || base.data <= volta.de) ? volta.dias : 0;
    const fatorV = Math.min(fatorPausa(pausaDias), fatorPausa(naVolta));
    const semanasDesde = base.origem === 'registro' ? Math.floor(diasEntre(base.data, op.hoje) / 7) : acompanha ? semAtual - 1 : 0;
    const emDia = temRegistros && contaveis.length >= 3 && contaveis.every((w) => diasCorridos(w) > 0) && !pesado && !exausto && !volta && pior.nivel === 0 && fatorV === 1;
    const rapido = acompanha && padraoRapidoFacil(op.registros, op.hoje);
    // degrau já concedido para este mesmo resultado não é retirado (state.run.degrau)
    chaveBase = base.origem === 'registro' ? base.data : 'entrevista';
    const concedido = op.degrau && op.degrau.base === chaveBase ? op.degrau.pontos : 0;
    const pontos = Math.max(concedido, emDia ? Math.floor(semanasDesde / (rapido ? 4 : 6)) : 0);
    pontosDados = pontos;
    P = ritmosDe(base.distKm, base.seg, { pontos, fator: fatorV });
    // Ritmo leve mais lento que a velocidade em que as pessoas trocam a caminhada pela corrida (cerca de 7,2 km/h: hreljac2005,
    // abe2019): faixas de ritmo não fazem sentido. O plano vai por tempo e esforço, com corrida e caminhada.
    if (P && P.lento) { P = null; lento = true; }
    if (P) {
      P.base = { ...P.base, origem: base.origem, data: base.data };
      ajustes.push(...txtRitmos);
      if (pontos > 0) ajustes.push({ texto: `Ritmos de treino ${pontos === 1 ? 'um degrau' : pontos + ' degraus'} mais rápidos (VDOT ${virg(r1(P.vdot - pontos))} → ${virg(P.vdot)}).`, motivo: (rapido ? 'Seus treinos leves têm saído mais rápidos que a faixa, com esforço baixo, e você treina em dia há 4 semanas ou mais desde o último resultado. ' : 'Você treina em dia há 6 semanas ou mais desde o último resultado. ') + 'Sem prova nova, a orientação de Daniels é subir 1 ponto de VDOT a cada 4 a 6 semanas, não mais que isso. Um teste de 3 km ou 5 km acerta os ritmos de vez.', refs: ['vdoto2_ajuste', 'smyth2022'] });
      if (fatorV < 1) ajustes.push({ texto: `Ritmos ${Math.round((1 - fatorV) * 100)}% mais lentos por causa do tempo parado.`, motivo: 'O condicionamento cai com a pausa: cerca de 3% em 2 semanas, 7% em 4 semanas e 15% em 8 semanas. Os ritmos voltam ao normal com as semanas de treino ou com um novo teste.', refs: ['vdoto2_pausa', 'zheng2022'] });
    }
  }
  if (lento) pf = { ...pf, modo: 'tempo', lento: true };
  const c = contexto(pf, P, lento ? RITMO_TRANSICAO : 0);
  const est = c.est.leve;
  const grade = gradeDe(c);
  const feitoKm = (w) => naSemana(w).reduce((s, r) => s + kmDe(r, est), 0);
  const semAlvo = pf.semanasProva || pf.semanasPlano || null;

  let semanas, totalSemanas, tipoPlano, limitado = 0, textoVolta = null;
  const cont = { q: 0 };

  if (pf.gestante && pf.nivel === 0) {
    // ----- gestante que não corria: caminhada até 150 min por semana (csep2019, oms2020) -----
    tipoPlano = 'caminhada'; totalSemanas = 12;
    const alvo = Math.min(pf.tempo, 45, Math.ceil(150 / pf.dias.length / 5) * 5);
    semanas = [];
    for (let w = 1; w <= 12; w++) {
      const min = Math.max(10, Math.round((alvo * Math.min(1, 0.5 + 0.1 * (w - 1))) / 5) * 5);
      semanas.push({ n: w, fase: 'caminhada', foco: 'Caminhada em passo firme, somando até 150 minutos por semana', descarga: false, dias: pf.dias.map((wd) => ({ wd, ...tCaminhada(min, c) })) });
    }
  } else if (pf.nivel === 0) {
    // ----- corrida e caminhada -----
    tipoPlano = 'adaptacao';
    const { corridaDias, nC, comeco, passoEtapa, nCC, geral, T0: T0fixo } = estruturaNivel0(pf, est, grade, semAlvo);
    const ULT = ETAPAS.length - 1;
    const etapaDe = (pg) => entre(comeco + Math.floor(pg / passoEtapa), comeco, ULT);
    // Andamento: cada semana feita avança o programa. Semana sem corrida, com menos de 2 corridas (ou 1, se o plano só tem 1)
    // ou com esforço alto se repete (nhs_c25k: pode repetir semanas). Depois de 2 semanas ou mais sem correr, o programa recua
    // para a etapa com cerca de metade dos minutos de corrida (caterisano2019); depois de 3 meses, recomeça (vdoto2_definicoes).
    let prog = 0, vazias = 0, repetidas = 0, recuo = 0;
    const progs = [];
    const recuar = () => {
      const at = etapaDe(prog);
      let alvo = comeco;
      if (vazias < 13) for (let k = comeco; k <= at; k++) if (MIN_ETAPA[k] <= MIN_ETAPA[at] * 0.5) alvo = k;
      if (alvo < at) { recuo += at - alvo; prog = (alvo - comeco) * passoEtapa; }
      vazias = 0;
    };
    if (acompanha) {
      for (let w = 1; w < semAtual; w++) {
        progs.push(prog);
        const n = diasCorridos(w);
        // plano aceito depois de uma das corridas da semana 1: a semana só avança o programa se foi cumprida
        const truncada = w === 1 && corridaDias.some((wd) => somaDias(iniSemana(1), pos(wd)) < desde);
        if (n === 0) {
          if (emParada(w)) vazias++;
          else if (conta(w)) { vazias++; repetidas++; }
          else if (!truncada) prog++; // sem registros ainda: não dá para saber; o programa segue
        } else {
          if (vazias >= 2) recuar();
          vazias = 0;
          const porDia = new Map();
          for (const r of naSemana(w)) porDia.set(r.data, Math.max(porDia.get(r.data) || 0, r.pse || 0));
          if (n >= Math.min(2, nC) && [...porDia.values()].filter((x) => x >= 7).length < 2) prog++; else repetidas++;
        }
        vazias += Math.max(0, Math.round(diasEntre(iniSemana(w), iniSemana(w + 1)) / 7) - 1); // semanas puladas por uma pausa do plano
      }
      if (vazias >= 2) recuar();
      if (recuo) ajustes.push({ texto: `Volta de pausa: o programa recuou ${recuo === 1 ? '1 etapa' : recuo + ' etapas'}.`, motivo: 'Depois de 2 semanas ou mais sem correr, a volta começa com cerca de metade da corrida que você fazia e avança de novo, uma etapa por semana. Depois de 3 meses parado, o programa recomeça.', refs: ['caterisano2019', 'liem2013', 'nhs_c25k'] });
      if (repetidas) ajustes.push({ texto: `Repeti ${repetidas === 1 ? '1 semana' : repetidas + ' semanas'} do programa em vez de avançar.`, motivo: 'Houve semanas sem corrida, com menos de 2 corridas registradas ou com esforço de 7 ou mais. No começo, repetir uma semana é melhor do que pular etapas: o corpo precisa de tempo para se acostumar ao impacto.', refs: ['nhs_c25k', 'buist2008', 'kluitenberg2015'] });
    }
    // sem data marcada, o programa se estende pelas semanas repetidas
    const T0 = !semAlvo && acompanha && semAtual >= 1 ? Math.min(nCC + 26, Math.max(nCC, semAtual - 1 + nCC - prog)) : T0fixo;
    totalSemanas = T0 + (geral ? geral.T : 0);
    semanas = [];
    for (let w = 1; w <= T0; w++) {
      const etapa = !acompanha ? etapaDe(w - 1) : w < semAtual ? etapaDe(progs[w - 1]) : etapaDe(prog + w - Math.max(1, semAtual));
      const dias = [];
      let i = 0;
      for (const wd of ORDEM) {
        if (!pf.dias.includes(wd)) continue;
        if (corridaDias.includes(wd)) { const idx = nC === 3 ? i : nC === 2 ? [0, 2][i] : 2; i++; dias.push({ wd, ...tCC(etapa, idx, c) }); }
        else dias.push({ wd, ...tCaminhada(Math.min(30, pf.tempo), c, pf.idade < 14 ? 'Atividade livre' : '') });
      }
      if (semAlvo && !geral && w === T0 && pf.dist) {
        const j = dias.findIndex((d) => d.wd === pf.diaLongo);
        const ev = tEvento(pf, c, { dist: pf.dist, evento: eventoDe(pf) });
        ev.detalhe = 'Você ainda está no programa de corrida e caminhada: faça a prova alternando corrida e caminhada, como nos treinos, sem se preocupar com o tempo.';
        ev.ritmo = null; ev.blocos = ev.blocos.map((b) => { const { ritmo: _r, ...r } = b; return r; });
        if (j >= 0) dias[j] = { wd: pf.diaLongo, ...ev };
      }
      semanas.push({ n: w, fase: 'adaptacao', foco: etapa >= ETAPAS.length - 2 ? 'Corrida contínua, até 30 minutos' : 'Alternar corrida e caminhada, com a corrida crescendo aos poucos', descarga: false, etapa, dias });
    }
    if (geral) {
      const cv = curva(pf, geral);
      for (const s of cv) semanas.push({ n: T0 + s.n, fase: s.fase, foco: focoDe(s, geral), descarga: s.descarga, dias: diasDaSemana(s, pf, c, geral, cont, op.diasPernas) });
    }
  } else {
    // ----- plano geral -----
    tipoPlano = 'geral';
    const cfg = cfgGeral(pf, est, grade, semAlvo);
    cfg.pernas = op.diasPernas;
    const T = cfg.T;
    totalSemanas = T;
    const cv = curva(pf, cfg);
    // ----- ajuste da curva pelas semanas feitas (a partir da semana atual) -----
    if (acompanha && semAtual >= 1 && semAtual <= T) {
      const i0 = semAtual - 1;
      const minKm = Math.min((20 * 60) / est, (pf.tempo * 60) / est);
      let teto = Infinity, tetoLongo = Infinity, semForte = false, semForteN = 0, semAcelN = 0;
      if (!volta) {
        // A semana atual não passa de 10% acima da melhor das 3 semanas anteriores (soligard2016), ou 1,5 km em volumes pequenos
        // (os planos publicados sobem 2 a 3 km por semana: knopp2024). Nas primeiras semanas do plano, as semanas de antes dele
        // valem pelo volume da semana 1, que é o que a pessoa informou: uma única semana fraca não derruba o plano.
        // O corte só vale com duas referências (duas semanas contadas, ou uma e o volume de antes do plano): as semanas de
        // pausa ou de suspensão por dor não contam, e nesse caso a janela recua até 6 semanas.
        const feitos = [], previstos = [];
        let contadas = 0;
        for (let w = semAtual - 1; w >= semAtual - 6 && feitos.length < 3; w--) {
          if (w < 1) feitos.push(cv[0].vol);
          // conta o que foi feito até o limite do que o plano mostrava: correr a mais não aumenta a semana seguinte
          else if (conta(w)) { const prev = mostradoKm(w) ?? cv[w - 1].vol; feitos.push(Math.min(feitoKm(w), prev)); previstos.push(prev); contadas++; }
        }
        if (contadas && feitos.length >= 2) {
          const feito = Math.max(...feitos);
          teto = Math.max(feito * 1.1, feito + 1.5);
          if (teto < cv[i0].vol * 0.97) ajustes.push({ texto: `Volume desta semana ajustado para cerca de ${Math.round(teto)} km.`, motivo: `Nas últimas 3 semanas você correu até ${Math.round(feito)} km por semana, e o plano previa ${Math.round(Math.max(...previstos))} km. Treino perdido não se repõe: o plano retoma de onde você está e sobe no máximo 10% por semana.`, refs: ['soligard2016', 'frandsen2025', 'damsted2018', 'feely2023'] });
        }
      }
      if (temRegistros) {
        // treino longo: até 10% acima da corrida mais longa dos últimos 30 dias (frandsen2025)
        const m30 = Math.max(0, ...corridas.filter((r) => r.data < iniSemana(semAtual) && diasEntre(r.data, iniSemana(semAtual)) <= 30).map((r) => { const w = r.data >= base0 ? semanaDe(r.data) : 0; const lim = w >= 1 && w <= T ? (maiorMostrado(w) ?? (cv[w - 1].longo || cv[w - 1].vol)) : Infinity; return Math.min(kmDe(r, est), lim); }));
        const piso = !volta && semAtual <= 4 ? cfg.longo0 : 0; // nas 4 primeiras semanas vale também o longo informado na entrevista
        const ref = Math.max(m30, piso);
        if (ref > 0) {
          tetoLongo = ref >= 8 ? ref * 1.1 : ref + 0.75;
          if (tetoLongo < cv[i0].longo * 0.95 && !volta) ajustes.push({ texto: `Treino longo desta semana limitado a cerca de ${fmtKm(r05(tetoLongo))}.`, motivo: `Sua corrida mais longa dos últimos 30 dias teve ${fmtKm(ref)}. Uma corrida mais de 10% maior do que a mais longa do último mês aumenta o risco de lesão.`, refs: ['frandsen2025'] });
        }
      }
      if (volta) {
        // Volta de pausa: a mesma regra da pausa informada na entrevista (VOLTA), sobre o que a pessoa fazia antes de parar: o
        // maior volume semanal e a corrida mais longa das 4 semanas anteriores (ou o que o plano previa, sem registros).
        const antesDe = (k) => { const b = somaDias(volta.de, -7 * (k - 1)), a = somaDias(b, -6); return corridas.filter((r) => r.data >= a && r.data <= b); };
        const wDe = entre(semanaDe(volta.de), 1, T);
        const volAntes = Math.max(...[1, 2, 3, 4].map((k) => antesDe(k).reduce((s, r) => s + kmDe(r, est), 0))) || cv[wDe - 1].vol;
        const longoAntes = Math.max(0, ...[1, 2, 3, 4].flatMap((k) => antesDe(k).map((r) => kmDe(r, est)))) || cv[wDe - 1].longo || cfg.longo0;
        teto = Math.max(2 * minKm, tetoDaVolta(volta.tier, volta.dias, volta.semana, volAntes));
        tetoLongo = Math.min(tetoLongo, Math.max(minKm, tetoDaVolta(volta.tier, volta.dias, volta.semana, longoAntes)));
        semForteN = volta.tier.semForte - volta.semana + 1; semAcelN = volta.tier.semAcel - volta.semana + 1;
        // o texto é fechado no fim, com o volume que a semana de fato ficou
        textoVolta = (km) => { const pct = Math.round((km / volAntes) * 100); return `Volta ${volta.motivo === 'dor' ? 'depois da dor' : 'de pausa'} (semana ${volta.semana}): cerca de ${Math.max(1, Math.round(km))} km nesta semana${pct < 100 ? `, ${pct}% do que você fazia antes de parar` : ''}, e sem treinos fortes.`; };
        ajustes.push({
          texto: textoVolta(Math.min(teto, cv[i0].vol)), volta: true,
          motivo: `Você ficou ${volta.dias} dias sem correr. ${volta.tier.min >= 56 ? 'Depois de 8 semanas ou mais, a volta começa com um terço do volume de antes (no máximo 15 km depois de 3 meses) e sobe até 10% por semana, só com corrida leve nas 9 primeiras semanas.' : volta.tier.min >= 28 ? 'Depois de 4 a 8 semanas, a volta passa por um terço, metade e três quartos do volume de antes, sem treinos fortes.' : 'Depois de 2 a 4 semanas, a volta é com metade do volume na primeira semana e 70% na segunda, sem treinos fortes.'} Primeiro volta o volume; depois, a intensidade.`,
          refs: ['caterisano2019', 'liem2013', 'warden2021', 'barbieri2024'],
        });
      }
      if (exausto) {
        teto = Math.min(teto, cv[i0].vol * 0.7); semForte = true;
        ajustes.push({ texto: 'Semana leve antecipada: 30% menos volume e sem treinos fortes.', motivo: 'Seus três últimos treinos ficaram com esforço de 7 ou mais, a zona forte, mesmo nos dias leves. Cansaço que se acumula pede redução antes que o rendimento caia.', refs: ['meeusen2013', 'saw2016', 'filipas2022'] });
      } else if (pesado && i0 > 0) {
        teto = Math.min(teto, cv[i0 - 1].descarga ? cv[i0].vol : Math.max(...cv.slice(Math.max(0, i0 - 3), i0).map((s) => s.vol)));
        if (teto < cv[i0].vol * 0.99) ajustes.push({ texto: 'Volume mantido nesta semana, sem aumento.', motivo: 'Seus treinos leves ficaram com esforço de 5 ou mais. Treino leve é para ser leve (até 4 em 10): diminua o ritmo; o volume volta a subir quando o esforço baixar.', refs: ['seiler2009', 'ieno2020', 'saw2016'] });
      }
      // aplica os tetos e deixa as semanas seguintes subirem de novo, dentro do passo
      let ref = null;
      for (let i = i0; i < T; i++) {
        const s = cv[i], k = i - i0, vol0 = s.vol, n0 = s.corridas;
        if (k === 0) { if (teto < s.vol) { s.vol = teto; ref = teto; } if (semForte) s.q = 0; if (tetoLongo < s.longo) s.longo = tetoLongo; }
        else {
          if (ref != null) { const lim = Math.max(ref * (1 + pf.passo), ref + 1.5); if (!s.descarga && !s.polimento) { if (lim < s.vol) { s.vol = lim; ref = lim; } else ref = null; } else s.vol = Math.min(s.vol, ref); }
          const ult = Math.max(...cv.slice(Math.max(i0, i - 4), i).map((x) => x.longo));
          if (!s.polimento && !s.descarga && s.longo > (ult >= 8 ? ult * 1.1 : ult + 0.75) && ult > 0) s.longo = ult >= 8 ? ult * 1.1 : ult + 0.75;
        }
        if (k < semForteN) s.q = 0;
        if (k < semAcelN) s.semAcel = true;
        while (s.corridas > 2 && s.vol / s.corridas < cfg.minPorCorrida) s.corridas--;
        // a proporção do longo só é refeita quando o ajuste mexeu no volume ou no número de corridas da semana
        if (s.vol < vol0 - 1e-9 || s.corridas !== n0) s.longo = Math.min(s.longo, limiteLongo(s.corridas, s.vol, cfg.dist, cfg.longo0));
        if (s.corridas < 5) s.q = Math.min(s.q, 1); // 2 treinos fortes só em semana com 5 ou mais corridas (filipas2022)
        if (s.vol / s.corridas < cfg.minPorCorrida || (s.corridas === 2 && (pf.dias.length > 2 || s.vol - s.longo < cfg.minPorCorrida))) s.q = 0;
      }
    }
    limitado = cfg.limitado;
    semanas = cv.map((s) => ({ n: s.n, fase: s.fase, foco: focoDe(s, cfg), descarga: s.descarga, dias: diasDaSemana(s, pf, c, cfg, cont, op.diasPernas) }));
  }
  aparar(semanas, c);

  // ----- treino forte feito na véspera (fora do plano): o forte de hoje ou de amanhã vira rodagem leve. Depois de um treino
  // intenso, a recuperação leva de 24 a 48 horas (buchheit2014); dois fortes em dias seguidos só somam cansaço (seiler2009) -----
  if (acompanha && semAtual >= 1) {
    for (const k of [0, 1]) {
      const dia = somaDias(op.hoje, k), vespera = somaDias(dia, -1);
      if (!corridas.some((r) => r.data === vespera && (TIPOS_FORTES_REG.has(r.tipo) || (r.pse != null && r.pse >= 7))) || corridas.some((r) => r.data === dia)) continue;
      const sem = semanas[Math.floor(diasEntre(op.inicio, dia) / 7)];
      const j = sem ? sem.dias.findIndex((d) => d.wd === diaDaSemana(dia)) : -1;
      if (j < 0 || sem.dias[j].intensidade !== 'forte' || ehEventoDia(sem.dias[j])) continue;
      const d = sem.dias[j];
      sem.dias[j] = { wd: d.wd, ...tLeve(Math.max(1, Math.min(d.distKm, (pf.tempo * 60) / est)), c), trocado: true };
      ajustes.push({ texto: `${d.nome} de ${fmtDia(dia)} trocado por rodagem leve.`, motivo: 'Você fez um treino forte (ou com esforço de 7 ou mais) na véspera. Depois de um treino intenso, o corpo leva de 24 a 48 horas para se recuperar: dois fortes em dias seguidos somam cansaço, não condicionamento.', refs: ['buchheit2014', 'seiler2009'] });
    }
  }

  // ----- dor: muda os dias de hoje em diante (janela de 7 dias, refeita a cada dia enquanto a dor estiver registrada) -----
  if (acompanha && pior.nivel > 0) {
    for (const s of semanas) {
      const ini = iniSemana(s.n);
      const naJanela = (d) => { const k = diasEntre(op.hoje, somaDias(ini, pos(d.wd))); return k >= 0 && k < 7; };
      if (s.dias.some(naJanela)) s.dias = ordenarLongo(s.dias.map((d) => (naJanela(d) ? aplicarDor(d, pior, c) : d)), c, naJanela);
    }
  } else if (!acompanha && pior.nivel > 0) for (const s of semanas.slice(0, 1)) s.dias = ordenarLongo(s.dias.map((d) => aplicarDor(d, pior, c)), c, () => true);

  // ----- a prova (ou o desafio) só fica no plano se o maior treino dos 30 dias anteriores chega à metade da distância
  // (frandsen2025) e se ela não cai dentro da volta de uma pausa (feely2023, warden2021) -----
  const ultima = semanas[semanas.length - 1];
  const iEv = ultima.dias.findIndex(ehEventoDia);
  let provaRetirada = false;
  if (iEv >= 0 && pf.dist && (!acompanha || semAtual <= totalSemanas)) {
    const T = totalSemanas, ev = ultima.dias[iEv], nome = ROTULO.distancia[pf.dist];
    // semanas passadas em que se sabe que não houve corrida não contam como treino feito
    const parada = (w) => acompanha && w < semAtual && (emParada(w) || (conta(w) && diasCorridos(w) === 0) || (volta && iniSemana(w) > volta.de && somaDias(iniSemana(w), 6) < volta.retorno));
    let maior = 0;
    for (const s of semanas.slice(Math.max(0, T - 5), T - 1)) if (!parada(s.n)) for (const d of s.dias) if (ehCorridaDia(d)) maior = Math.max(maior, d.tipo === 'corrida_caminhada' ? d.corridaKm || 0 : d.distKm);
    if (acompanha) { const dataEv = somaDias(iniSemana(T), pos(ev.wd)); for (const r of corridas) if (r.data < dataEv && diasEntre(r.data, dataEv) <= 30) maior = Math.max(maior, kmDe(r, est)); }
    if (pf.semanasProva && pf.nivel >= 1 && T <= 4 && pf.retorno === 0) maior = Math.max(maior, Math.min(pf.longoAtual, 0.6 * pf.kmSemana));
    const naVolta = volta ? T - semAtual + volta.semana : 0; // semana da volta em que a prova cai
    const curto = maior * 2 < r1(DIST[pf.dist]) - 0.15; // as distâncias dos treinos têm uma casa decimal
    if (curto || (volta && naVolta <= volta.tier.semAcel)) {
      provaRetirada = true;
      const troca = pf.nivel === 0 ? tCaminhada(Math.min(30, pf.tempo), c) : tLeve(Math.max(2, (20 * 60) / est), c);
      ultima.dias[iEv] = { wd: ev.wd, ...troca, detalhe: 'A prova saiu do plano. Corrida curta e leve, em ritmo de conversa.' };
      // sem a prova, a semana fica só com rodagens curtas (na volta de pausa, o volume ainda está reduzido)
      if (acompanha) ultima.dias = ultima.dias.map((d) => (d.tipo === 'leve' || d.tipo === 'regenerativo' ? { ...limitarAo(d, 24, c), wd: d.wd } : d));
      const texto = curto
        ? `Tirei ${ev.tipo === 'teste' ? 'o teste' : 'a prova'} de ${nome} do plano: a sua corrida mais longa dos 30 dias anteriores ficaria em ${fmtKm(maior)}, menos da metade da distância. Correr de uma vez mais que o dobro disso mais que dobra o risco de lesão. Refaça a entrevista com uma data mais adiante ou uma distância menor.`
        : `Tirei a prova de ${nome} do plano: ela cai dentro da volta de ${volta.dias} dias sem correr, quando o volume ainda está reduzido e não há treino forte. Refaça a entrevista para remarcar a meta.`;
      extras.push({ tipo: 'danger', texto, refs: ['frandsen2025', 'feely2023'] });
      ajustes.unshift({ texto: `A prova de ${nome} saiu do plano.`, motivo: texto, refs: ['frandsen2025', 'feely2023'] });
    } else if (volta && naVolta <= volta.tier.semForte + 1 && ev.intensidade === 'forte') {
      ultima.dias[iEv] = { wd: ev.wd, ...provaSuave(ev, pf.dist, 'Você acabou de voltar de uma pausa: complete a distância em ritmo de conversa, sem meta de tempo, e caminhe quando precisar.') };
      const texto = `A prova de ${nome} cai logo depois da sua volta de ${volta.dias} dias sem correr. Deixei a prova em ritmo de conversa, sem meta de tempo: reveja a meta. Parar de 7 a 13 dias na preparação de uma maratona custa cerca de 4% no tempo final; pausas maiores, de 5 a 8%.`;
      extras.push({ tipo: 'danger', texto, refs: ['feely2023', 'warden2021'] });
      ajustes.unshift({ texto: `Prova de ${nome} em ritmo de conversa, sem meta de tempo.`, motivo: texto, refs: ['feely2023', 'warden2021'] });
    }
  }

  // ----- totais de cada semana -----
  for (const s of semanas) {
    s.volumeKm = r1(s.dias.filter(ehCorridaDia).reduce((x, d) => x + d.distKm, 0));
    s.volumeMin = s.dias.reduce((x, d) => x + d.durMin, 0);
    s.corridaMin = s.dias.reduce((x, d) => x + (d.tipo === 'corrida_caminhada' ? d.corridaMin || 0 : ehCorridaDia(d) ? d.durMin : 0), 0);
  }
  if (textoVolta && semanas[semAtual - 1]) { const aj = ajustes.find((x) => x.volta); if (aj) aj.texto = textoVolta(semanas[semAtual - 1].volumeKm); }
  const zonas = zonasDe(pf, P);
  const evFinal = ultima.dias.find(ehEventoDia);
  return {
    semanas, totalSemanas, tipo: tipoPlano, semanaAtual: acompanha ? semAtual : 1, ritmos: P, zonas, modo: pf.modo,
    avisos: [...extras.map((x) => ({ ...x, destaque: true })), ...avisos(pf, P, { semanas, limitado })], orientacoes: orientacoes(pf, P, op), ajustes, perfil: pf, provaRetirada,
    degrau: P && chaveBase ? { pontos: pontosDados, base: chaveBase } : null, sinais: { pesado, exausto },
    inicios: op.inicio ? semanas.map((s) => iniSemana(s.n)) : [],
    prova: evFinal && pf.dist && op.inicio ? { distKm: DIST[pf.dist], data: somaDias(iniSemana(totalSemanas), pos(evFinal.wd)), tipo: evFinal.tipo } : null,
  };
}
function focoDe(s, cfg) {
  if (s.polimento) return s.n === cfg.T ? 'Semana da prova: pouco volume, pernas descansadas' : 'Polimento: menos volume, mesma intensidade';
  if (s.descarga) return 'Semana mais leve, para o corpo assimilar o treino';
  if (s.fase === 'base') return 'Construir a base: volume leve crescendo aos poucos';
  if (s.fase === 'construcao') return 'Somar ritmo: tempo run e intervalado sobre a base';
  if (s.fase === 'especifico') return cfg.dist >= 21 ? 'Treinos no ritmo da prova e os longos maiores' : 'Treinos no ritmo da prova';
  return 'Manter a rotina';
}

// ---------- avisos e orientações ----------
function avisos(pf, P, { semanas, limitado }) {
  const a = [];
  const av = (tipo, texto, refs) => a.push({ tipo, texto, refs });
  // a meta não coube no prazo ou no nível: o que foi montado no lugar
  if (pf.meta && (pf.meta.semanas || pf.meta.nova !== pf.meta.dist)) {
    const m = pf.meta, pedida = ROTULO.distancia[m.dist];
    const porque = 'o maior treino do plano não chegaria à metade da distância, e correr de uma vez mais que o dobro da sua corrida mais longa do último mês mais que dobra o risco de lesão';
    if (m.nova === m.dist) av('danger', `Em ${nSemanas(m.semanas)} não dá para preparar ${pedida} com segurança: ${porque}. No seu nível, o prazo mínimo é de ${m.min} semanas. Não marquei a prova: montei a preparação sem data. Escolha uma prova mais adiante ou uma distância menor.`, ['frandsen2025', 'nhs_c25k', 'ryan2003', 'damsted2017', 'dsilva2020']);
    else if (m.nova) av('danger', `${m.semanas ? `Não marquei a prova de ${pedida} em ${nSemanas(m.semanas)}. ` : ''}${pf.foco === 'musculacao' ? 'Com a musculação em primeiro lugar (até 3 corridas de até 40 minutos)' : 'Com o seu nível e o tempo que você tem por treino'}, ${pedida} não cabe em um único plano: ${porque}. Montei a preparação para ${ROTULO.distancia[m.nova]}; ao terminar, refaça a entrevista para o passo seguinte.`, ['frandsen2025', 'vdoto2_definicoes', 'fokkema2020', 'dsilva2020']);
    else av('danger', `Não consegui montar uma preparação segura para ${pedida} com os dias e o tempo que você tem. Montei um plano de saúde; quando ele estiver confortável, refaça a entrevista.`, ['frandsen2025']);
    a[a.length - 1].destaque = true;
  }
  if (pf.precisaLiberacao) av('danger', 'Você informou que tem liberação médica. Mesmo assim, o plano fica só em intensidade leve, sem treinos fortes. Se sentir dor ou pressão no peito, tontura, falta de ar fora do normal ou palpitações, pare e procure atendimento.', ['whitfield2017']);
  if (pf.gestante) av('warn', pf.nivel === 0 ? 'Gestação: como você não corria antes, o plano é de caminhada em intensidade moderada, subindo aos poucos em direção aos 150 minutos por semana que a diretriz recomenda.' : 'Gestação: mantive só corridas leves, de até 30 minutos, sem aumentar o volume. Pare e procure o médico se houver falta de ar que não passa com o repouso, dor de cabeça forte, contrações dolorosas, sangramento, perda de líquido, tontura que não passa, dor no peito ou palpitações.', ['csep2019', 'sbc_gestacao2021', 'oms2020']);
  if (pf.posparto) av('warn', 'Pós-parto: o plano recomeça por trechos de 30 segundos de corrida entre caminhadas, com um dia de descanso entre as corridas. Se houver escape de urina, peso ou pressão na vagina ou dor pélvica durante a corrida, pare e caminhe, e procure uma fisioterapeuta pélvica. Amamente ou tire o leite antes de correr.', ['selman2022', 'christopher2024', 'goom2019']);
  if (pf.hipertensao) av('warn', pf.liberado ? 'Pressão alta: corra só com a pressão controlada, e não treine no dia em que a pressão de repouso estiver acima de 160 por 105. Se usa betabloqueador, guie-se pelo esforço, não pela frequência cardíaca, e tenha cuidado extra no calor.' : 'Pressão alta sem liberação médica: deixei só treinos em intensidade leve a moderada. Para treinos fortes, peça avaliação médica. Não treine no dia em que a pressão de repouso estiver acima de 160 por 105.', ['sbc2020', 'pescatello2004']);
  if (pf.pulsoBaixo) av('warn', 'Remédio que deixa o pulso mais baixo (como betabloqueador): os batimentos não servem para medir o esforço. As zonas do plano vão só pelo esforço e pela fala, sem frequência cardíaca. Tenha cuidado extra no calor.', ['sbc2020', 'pescatello2004']);
  if (pf.diabetes) av('warn', 'Diabetes: meça a glicemia antes de correr (o ideal é entre 90 e 250 mg/dL; abaixo de 90, coma 15 a 30 g de carboidrato). A hipoglicemia costuma aparecer de 6 a 15 horas depois, e o risco vai até 48 horas. Olhe os pés todos os dias. O plano fica sem treinos fortes: intensidade alta, só com orientação do seu médico.', ['colberg2016', 'whitfield2017']);
  if (pf.cardiaco || pf.renal) av('warn', 'Com doença do coração ou dos rins, o plano fica em intensidade leve. Treino forte só com orientação do seu médico.', ['whitfield2017', 'pescatello2004']);
  if (pf.cronica) av(pf.liberado ? 'info' : 'warn', pf.liberado ? 'Doença crônica: siga o que o seu médico orientou sobre o tipo e a quantidade de exercício, e pare se surgirem sintomas novos.' : 'Você marcou outra doença crônica e ainda não tem liberação médica: deixei só treinos leves, sem treinos fortes. Para quem tem doença crônica, a recomendação é conversar com um profissional de saúde sobre o tipo e a quantidade de exercício. Com a liberação, refaça a entrevista.', ['oms2020', 'bredin2013', 'whitfield2017']);
  if (pf.retorno) av('info', ['', 'Volta depois de 2 a 4 semanas parado: comecei com metade do volume, sem treinos fortes nas duas primeiras semanas e com ritmos um pouco mais lentos.', 'Volta depois de 1 a 3 meses parado: comecei com um terço do volume de antes, só corrida leve nas 9 primeiras semanas e ritmos mais lentos.', 'Volta depois de 3 a 6 meses parado: o volume de antes não serve mais de base. Montei o plano um nível abaixo, começando com um terço do volume antigo (no máximo 15 km por semana), só corrida leve nas 9 primeiras semanas e ritmos mais lentos.', 'Volta depois de mais de 6 meses parado: é um recomeço, com no máximo 15 km na primeira semana e só corrida leve nas 9 primeiras. Quem já correu recupera mais depressa, mas tendões e ossos precisam de tempo.'][pf.retorno], ['caterisano2019', 'liem2013', 'vdoto2_pausa', 'barbieri2024', 'coyle1994', 'ramskov2016']);
  if (pf.irregular) av('info', 'Você corre de vez em quando, sem regularidade. Quem corre menos de 2 horas por semana se lesiona mais, e com menos de 2 treinos por semana o fôlego quase não melhora. Por isso o plano começa com 3 corridas curtas por semana, por tempo e esforço (sem ritmo), sobe 7% por semana e só traz treino forte depois de 8 semanas. Alternar corrida e caminhada é permitido.', ['vanpoppel2021', 'pollock1998', 'nhs_c25k', 'foster2020']);
  if (pf.jovem) av('info', `Menores de 18 anos: treine com acompanhamento de um adulto ou profissional e tenha 1 a 2 dias de descanso por semana.${pf.idade < 14 ? ' Antes dos 14, no máximo 3 corridas por semana, sem treino forte e sem prova oficial de rua.' : pf.idade < 16 ? ' Até os 15, sem treino forte: a federação australiana deixa o treino específico de 5 km para os 15 a 16 anos.' : ' Aos 16 e 17, no máximo 1 treino forte por semana, e nenhum no plano de 10 km (treino específico de 10 km só aos 17 a 18).'}`, ['paz2021', 'valovichmcleod2011', 'fitmodel2025', 'cbat_norma12']);
  if (pf.distPedida && pf.distPedida > pf.distMax) av('warn', `Pela idade, limitei a distância do plano a ${ROTULO.distancia[pf.distMax]}. Pela norma da Confederação Brasileira de Atletismo, quem faz 14 ou 15 anos no ano da prova corre até 5 km; 16 ou 17, até 10 km; 18 ou 19, até a meia maratona; a maratona, só a partir dos 20.`, ['cbat_norma12', 'fitmodel2025', 'paz2021']);
  if (pf.idoso) av('info', 'Aos 60 anos ou mais: um treino forte por semana (o piso da faixa de 1 a 2 indicada para amadores) e progressão de 7% por semana, por cautela: depois de esforços que machucam o músculo, a força de corredores veteranos demora mais a voltar. Mantenha exercícios de força em 2 ou mais dias por semana e, a partir dos 65, atividades de equilíbrio em 3 dias da semana.', ['boullosa2020', 'borges2016', 'tanaka2008', 'oms2020', 'chodzko2009']);
  else if (pf.master) av('info', 'Depois dos 40, vale manter exercícios de força em 2 ou mais dias por semana, como a OMS recomenda para todos os adultos.', ['oms2020']);
  if (pf.obeso && pf.nivel === 0) av('info', 'Para proteger as articulações, o plano começa com trechos bem curtos de corrida: menos de 3 km de corrida na primeira semana.', ['bertelsen2018']);
  else if (pf.obeso) av('info', 'Com IMC de 30 ou mais, a progressão do volume é mais lenta.', ['kluitenberg2015']);
  if (pf.lesaoPrevia) av('info', 'Lesão nos últimos 12 meses é o fator de risco mais consistente para uma nova: o volume sobe mais devagar (7% por semana, dentro da faixa de 5 a 9% dos planos publicados).', ['vangent2007', 'vanderworp2015', 'knopp2024']);
  // dor informada na entrevista: é uma dor leve a moderada daquele local (nhs_dor: de 4 a 6, adaptar) — sem treinos fortes
  // nas 2 primeiras semanas, progressão de 7% e a orientação do local
  for (const k of pf.limitacoes) {
    const local = { coxa: 'coxa-tras' }[k] || k, o = Object.prototype.hasOwnProperty.call(DOR_CORRIDA, local) ? DOR_CORRIDA[local] : null;
    if (o) av('warn', `Você disse que sente dor: ${o.nome.toLowerCase()}. Por isso as 2 primeiras semanas ficam sem treinos fortes e o plano sobe mais devagar (7% por semana). ${o.reduzir} Conte a dor com a intensidade em “Contar uma dor”: o plano se ajusta ao que você sente.`, [...new Set(['nhs_dor', ...o.f])].slice(0, 5));
  }
  if (pf.descansoForcado != null) av('info', `Você marcou os 7 dias. Deixei ${DIAS_NOME[pf.descansoForcado]} como descanso: pelo menos um dia sem treino por semana.`, ['meeusen2013', 'warden2021']);
  if (pf.nivel === 0 && !pf.gestante && pf.tempo <= 30) av('info', 'Com cerca de 30 minutos por treino, o programa chega a 26 minutos seguidos de corrida. Para chegar aos 30, as últimas semanas pedem treinos de 35 a 40 minutos, contando a caminhada do começo e do fim.', ['nhs_c25k']);
  if (limitado) av('info', `Com os dias e o tempo que você tem, o plano chega a cerca de ${limitado} km por semana. Para evoluir mais, abra mais um dia ou mais tempo por treino.`, ['fokkema2020', 'knopp2024']);
  // resultado e meta
  if (pf.resultadoInvalido) av('warn', 'O resultado que você informou não parece possível (mais rápido que o recorde mundial da distância, ou lento demais para uma corrida contínua): desconsiderei. Os treinos vão pelo esforço; confira o tempo em “Mudar respostas”.', ['wa_recordes', 'smyth2022']);
  if (pf.alvoInvalido) av('warn', 'O tempo-alvo que você informou não parece possível para a distância: desconsiderei. Confira em “Mudar respostas”.', ['wa_recordes']);
  if (pf.lento) av('info', 'Pelo seu resultado, o ritmo leve calculado ficaria mais lento que uma caminhada rápida. Por isso os treinos vão por tempo e esforço: corra em ritmo de conversa e caminhe quando precisar.', ['hreljac2005', 'abe2019', 'foster2020']);
  else if (pf.nivel >= 2 && !P) av('info', 'Sem um resultado recente, os treinos vão pelo esforço. Para ter ritmos calculados, registre uma corrida forte de 3 km ou 5 km como “Teste de ritmo”.', ['smyth2022', 'foster2020']);
  if (pf.alvoSeg && !P && pf.dist) av('info', `Sem um resultado recente, não dá para saber se a meta de ${fmtTempo(pf.alvoSeg)} está ao alcance: os treinos e a prova vão pelo esforço. Os ritmos seguem o condicionamento de hoje, não o desejado; registre um “Teste de ritmo” para calcular.`, ['vdoto2_ajuste', 'smyth2022']);
  // prazo e alcance
  if (pf.dist) {
    const maior = Math.max(0, ...semanas.flatMap((s) => s.dias.filter((d) => ehCorridaDia(d) && !ehEventoDia(d)).map((d) => d.distKm)));
    const km = DIST[pf.dist];
    // maratona: maior treino abaixo de 25 km, resultado pior; meia: 15 a 21 km (fokkema2020). O longo não passa de 2h30 (vdoto2_definicoes)
    const minimo = pf.dist === 42 ? 25 : pf.dist === 21 ? 15 : 0;
    if (maior < minimo) av('warn', `O maior treino do plano chega a ${fmtKm(maior)}, pouco para ${ROTULO.distancia[pf.dist]} (${fmtKm(km)}). O plano não acelera além do seguro, e nenhum treino passa de 2h30. ${pf.dist === 42 ? 'Na maratona, quem fica abaixo de 25 km no maior treino termina, em média, 13 minutos mais lento. ' : ''}Considere mais semanas de preparação ou completar a prova alternando corrida e caminhada.`, ['frandsen2025', 'fokkema2020', 'vdoto2_definicoes']);
    // 5 e 10 km: prazo menor que o dos programas estudados (9 a 10 semanas: nhs_c25k, filipas2022)
    if (pf.dist <= 10 && pf.semanasProva && pf.semanasProva < DURACAO[pf.dist][0]) av('warn', `${pf.semanasProva === 1 ? 'Falta 1 semana' : `Faltam ${pf.semanasProva} semanas`}, menos do que os programas estudados para essa distância (9 a 13 semanas). O plano não acelera além do seguro: vá para completar, sem meta de tempo.`, ['nhs_c25k', 'ryan2003', 'frandsen2025']);
    {
      const ev = semanas[semanas.length - 1].dias.find(ehEventoDia);
      if (ev && ev.durMin > pf.tempoLongoDito + 15) av(pf.objetivo === 'prova' ? 'warn' : 'danger', `${pf.objetivo === 'prova' ? 'A prova' : 'O desafio do fim do plano'} deve levar cerca de ${fmtTempo(ev.durMin * 60)}, mais do que o tempo que você disse ter no dia mais longo (${fmtTempo(pf.tempoLongoDito * 60)}). Reserve esse tempo para o dia${pf.objetivo === 'prova' ? '' : ', ou escolha uma distância menor'}.`, ['vdoto2_definicoes', 'frandsen2025']);
      if (ev && ev.durMin > pf.tempoLongoDito + 15 && pf.objetivo !== 'prova') a[a.length - 1].destaque = true;
    }
    if (pf.dist === 42 && pf.provas !== 'maratona') av('info', 'Primeira maratona: a meta é completar bem. Cerca de 28% dos homens e 17% das mulheres “quebram” na maratona, em média perto do km 30; sair rápido demais aumenta o risco.', ['smyth2021muro', 'smyth2020vc']);
  }
  if (pf.alvoSeg && P && pf.dist) {
    const prev = previstoDe(P, pf.dist);
    if (pf.alvoSeg < prev * 0.95) av('warn', `Meta ambiciosa: seu resultado recente aponta para cerca de ${fmtTempo(prev)} em ${ROTULO.distancia[pf.dist]}, e a meta é ${fmtTempo(pf.alvoSeg)}. Em um ensaio de 16 semanas, corredores bem treinados ganharam de 0,6 a 1,7%. Os treinos e o ritmo da prova seguem o seu condicionamento atual; refaça a conta depois de um teste.`, ['filipas2022', 'vickers2016', 'vdoto2_ajuste']);
  }
  return a;
}
function orientacoes(pf, P, op) {
  const o = [];
  const medir = pf.nivel <= 1
    ? 'Seus treinos são por tempo e esforço: é a forma usada nos programas para iniciantes que foram estudados. ' + (pf.aparelho === 'gps' ? 'Use o relógio ou o aplicativo só para registrar a distância; não persiga um ritmo.' : pf.aparelho === 'esteira' || pf.local === 'esteira' ? 'Na esteira, escolha a velocidade em que ainda dá para conversar.' : pf.aparelho === 'nada' ? 'Você não mede as corridas: use o cronômetro guiado de cada treino, que avisa as trocas.' : 'Basta um cronômetro.')
    : pf.modo === 'gps' ? (P ? 'Seus treinos saem em distância e faixa de ritmo, calculada pelo seu resultado recente. A faixa é um guia: em dia quente, cansado ou em subida, vale o esforço.' : 'Seus treinos saem em distância; o ritmo é guiado pelo esforço, até você registrar um teste.')
      : pf.modo === 'esteira' ? 'Seus treinos saem em distância e velocidade (km/h). Deixe 1% de inclinação se quiser aproximar do esforço da rua.'
        : 'Seus treinos saem em tempo e esforço. Sem aparelho, o teste da fala é o melhor guia.';
  o.push(['Como medir o treino', medir, pf.nivel <= 1 ? ['buist2008', 'nhs_c25k', 'foster2020'] : ['smyth2022', 'foster2020']]);
  const fala = 'Leve: você fala com conforto (2 a 4 em 10). Moderado: falar já exige esforço (5 a 6). Forte: não dá para falar com conforto (7 a 9). Se no treino leve a fala começar a pesar, diminua.';
  o.push(['Como sentir o esforço', pf.pulsoBaixo
    ? `${fala} Com o remédio que deixa o pulso mais baixo, não use os batimentos: guie-se só pelo esforço e pela fala.`
    : `${fala} A frequência cardíaca estimada pela idade erra cerca de 10 batimentos para mais ou para menos: use como apoio, não como regra.`, pf.pulsoBaixo ? ['foster2020', 'ieno2020', 'sbc2020', 'pescatello2004'] : ['foster2020', 'ieno2020', 'tanaka2001', 'shookster2020']]);
  o.push(['Como o plano cresce', `O volume sobe em passos de até cerca de ${Math.round(pf.passo * 100)}% por semana, com uma semana mais leve a cada quatro, e o treino longo não passa de cerca de 10% acima da sua corrida mais longa do último mês. O limite de 10% é uma convenção prudente; o que os estudos mostram é que saltos grandes aumentam o risco.`, ['frandsen2025', 'damsted2018', 'buist2008', 'knopp2024']]);
  o.push(['Treinos perdidos', 'Não tente repor. Perdeu um treino: siga o plano. Perdeu vários: registre o que fez e o plano retoma de onde você está.', ['feely2023', 'frandsen2025']]);
  if (pf.nivel >= 1 && !pf.cautela) o.push(['Aquecimento', 'Antes de treinos fortes, pelo menos 10 minutos de corrida leve (nos treinos descritos em atletas, de 15 a 20). Alongar antes de correr não previne lesões.', ['seiler2009', 'yeung2011']]);
  // ordem e distância entre os dois treinos, conforme a prioridade escolhida (methenitis2018, doma2017, methenitis2018)
  const ordem = op.foco === 'musculacao' ? 'No mesmo dia, faça a musculação primeiro e corra pelo menos 6 horas depois (3, no mínimo).'
    : op.foco === 'corrida' ? 'No mesmo dia, corra primeiro e faça a força pelo menos 6 horas depois (3, no mínimo).'
      : 'No mesmo dia, comece pelo treino que é a sua prioridade e deixe 6 horas entre os dois (3, no mínimo).';
  const forca = op.diasForca.length
    ? `Você também faz musculação. Deixe pelo menos 24 horas entre o treino pesado de pernas e o treino forte ou longo de corrida (48 horas se a musculação é novidade). ${ordem}`
    : 'Dois treinos de força por semana melhoram a economia de corrida e o tempo de prova; depois, um por semana mantém a força. Deixe 24 horas entre pernas pesado e o treino forte ou longo.';
  o.push(['Corrida e musculação', forca, ['blagrove2018', 'llanos2024', 'beattie2017', 'doma2017', 'methenitis2018']]);
  o.push(['Calor e água', 'No calor, corra mais cedo ou à noite e aceite um ritmo mais lento. Até 60 a 90 minutos em clima ameno, beba conforme a sede; em treinos mais longos, leve água. Nunca beba a ponto de ganhar peso.', ['armstrong2007', 'kenefick2018', 'hewbutler2017']]);
  o.push(['Sinais para parar', 'Dor no peito, tontura ou falta de ar fora do normal: pare e procure atendimento. Dor que muda o seu jeito de correr, dor em um ponto do osso ou dor que aumenta a cada corrida: pare e procure avaliação.', ['whitfield2017', 'hoenig2022']]);
  if (pf.dist) o.push(['Dia da prova', 'Não estreie tênis, roupa nem comida. Largue um pouco abaixo do ritmo planejado. Na semana da prova o treino diminui de propósito: é o polimento, ligado a tempos cerca de 2,6% melhores em maratonistas amadores.', ['wang2023', 'smyth2021taper', 'smyth2021muro']]);
  return o;
}

// ---------- o plano no calendário ----------
const GRUPOS_PERNA = new Set(['quadriceps', 'posteriores', 'gluteos', 'panturrilhas']);
// dias da semana com musculação e, entre eles, os de treino de pernas (2 ou mais exercícios de pernas)
export function diasDeForca(st) {
  const forca = [], pernas = [];
  const plano = st && Array.isArray(st.plans) ? st.plans.find((p) => p && p.id === st.activePlan) : null;
  if (!plano || !isObj(plano.agenda) || !Array.isArray(plano.dias)) return { forca, pernas };
  for (let wd = 0; wd < 7; wd++) {
    const d = plano.dias.find((x) => x && x.id === plano.agenda[wd]);
    if (!d || !Array.isArray(d.itens) || !d.itens.length) continue;
    forca.push(wd);
    let n = 0;
    for (const it of d.itens) { const ex = EX_POR_ID.get(it && it.ex); if (ex && GRUPOS_PERNA.has(ex.grupo)) n++; }
    if (n >= 2) pernas.push(wd);
  }
  return { forca, pernas };
}
// dia do calendário do aparelho de um instante ISO (o plano conta os dias como a pessoa os vive, não em UTC)
export function diaLocal(iso) {
  const d = new Date(iso);
  return typeof iso === 'string' && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : '';
}
// Períodos em que a corrida ficou suspensa por dor (relatos com efeito "sem corrida"), já encerrados: cada um vai do relato até
// o "Melhorou", até um relato novo do mesmo local ou até o relato deixar de valer.
function suspensoes(dores, hoje, pf) {
  const l = (Array.isArray(dores) ? dores : []).filter((d) => isObj(d) && typeof d.onde === 'string' && LOCAIS_DOR[d.onde] && diaValido(d.data) && d.data <= hoje).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const out = [];
  l.forEach((d, i) => {
    if (efeitoDaDor({ ...d, dias: 0 }, pf).nivel < 4) return;
    const prox = l.slice(i + 1).find((x) => x.onde === d.onde && (x.lado || '') === (d.lado || ''));
    const fim = [d.fim, prox ? prox.data : '', somaDias(d.data, DIAS_ATIVA + 1)].filter((x) => diaValido(x) && x >= d.data).sort()[0];
    if (fim > hoje) return;
    const ult = out[out.length - 1];
    if (ult && d.data <= ult.ate) ult.ate = fim > ult.ate ? fim : ult.ate;
    else out.push({ de: d.data, ate: fim, semanas: 0, motivo: 'dor' });
  });
  return out;
}
// opções do plano a partir do estado
function opcoesDoEstado(st, hoje) {
  const run = st.run;
  const { forca, pernas } = diasDeForca(st);
  const pausas = Array.isArray(run.pausas) ? run.pausas : [];
  const desde = diaLocal(run.aceitoEm);
  const dores = Array.isArray(st.dores) ? st.dores : [];
  return {
    inicio: run.inicio, hoje, registros: Array.isArray(st.runs) ? st.runs : [], diasForca: forca, diasPernas: pernas, dores: doresAtivas(st, hoje), desde,
    foco: comboAtual(st).foco, mostrados: run.mostrados, degrau: run.degrau,
    // o plano começou na segunda-feira seguinte ao aceite? (as pausas adiam o início guardado: desconta)
    adiado: !!desde && segundaDe(desde) < somaDias(run.inicio, -7 * pausas.reduce((s, p) => s + (p && Number.isInteger(p.semanas) ? p.semanas : 0), 0)),
    encerradas: dores.filter((d) => isObj(d) && d.fim), paradas: [...pausas.map((p) => ({ ...p, motivo: 'pausa' })), ...suspensoes(dores, hoje, (() => { try { return perfil(run.answers); } catch { return null; } })())],
  };
}
// plano do estado atual, já ajustado (ou null sem plano aceito, pausado, bloqueado ou com a entrevista incompleta)
export function planoAtual(st, hoje) {
  const run = st && isObj(st.run) ? st.run : null;
  if (!run || !run.aceitoEm || !diaValido(run.inicio) || run.pausadoEm || !diaValido(hoje) || !respostasCompletas(run.answers)) return null;
  // com a proteção das outras entrevistas e a liberação médica só dentro dos 12 meses (saude.js): sem ela, não há plano
  return gerarPlano(saudeDaCorrida(st, hoje).respostas, opcoesDoEstado(st, hoje));
}
// Respostas da corrida com a proteção das outras entrevistas: { respostas, avisos, liberacao, renovar, deFora }
// (ver respostasProtegidas em logic/saude.js).
export const saudeDaCorrida = (st, hoje) => respostasProtegidas('corrida', st, hoje);
// Retoma um plano pausado: devolve o novo `run`. Sem prova com data, o plano continua de onde parou (o início anda as semanas
// inteiras da pausa); com data, o calendário não muda. A pausa fica guardada: não conta como falta, e a volta é gradual.
export function retomarPlano(run, hoje) {
  const r = limparCorrida(run);
  if (!r.inicio || !r.pausadoEm || !diaValido(hoje)) return r;
  const dia = diaLocal(r.pausadoEm);
  const de = dia && dia <= hoje ? dia : hoje;
  const p = respostasCompletas(r.answers) ? gerarPlano(r.answers, { adiado: opcoesDoEstado({ run: r }, hoje).adiado }) : null;
  const semanas = p && p.perfil.objetivo === 'prova' ? 0 : Math.floor(diasEntre(de, hoje) / 7);
  return { ...r, inicio: somaDias(r.inicio, semanas * 7), pausadoEm: '', pausas: [...r.pausas, { de, ate: hoje, semanas }].slice(-MAX_PAUSAS) };
}
const melhorRegistro = (l) => (l.length ? l.slice().sort((a, b) => (b.distKm || 0) - (a.distKm || 0) || b.durMin - a.durMin)[0] : null);
// treino de um dia que já passou, como o plano o mostrou naquele dia (sem os blocos: só o que a tela resumia)
const diaGuardado = (m, p) => ({
  tipo: m.tipo, nome: m.nome || TIPOS_TREINO[m.tipo].nome, resumo: m.resumo, detalhe: '', distKm: m.distKm, durMin: m.durMin, intensidade: INTENS[m.tipo],
  ritmo: m.ritmo ? { de: m.ritmo[0], ate: m.ritmo[1] } : null, blocos: [], pse: m.pse || PSE[m.tipo], fala: FALA[m.tipo], modo: p.modo, un: m.un, guardado: true,
});
// Uma semana do plano, por dia da semana: dias[wd] = null ou { ...treino, data, forte, chave, feito: registro | null }.
// forte = intensidade alta (ou a prova); chave = forte ou o longão (os dois pedem distância do treino pesado de pernas);
// diaLongo = dia da semana do longão (ou null). Nos dias que já passaram vale o treino que o plano MOSTROU no dia
// (`guardado: true`); sem ele, o treino previsto pelo plano de hoje, marcado `estimado: true`.
// extras[wd] = corridas registradas em dia sem treino do plano: [{ id, data, tipo, distKm, durMin }].
function semanaDoPlano(p, st, n, ini, hoje) {
  const s = p.semanas[n - 1];
  const dias = new Array(7).fill(null), extras = Array.from({ length: 7 }, () => []);
  const runs = Array.isArray(st.runs) ? st.runs.filter((r) => isObj(r)) : [];
  let diaLongo = null;
  for (let k = 0; k < 7; k++) {
    const data = somaDias(ini, k), wd = diaDaSemana(data);
    const doPlano = s.dias.find((x) => x.wd === wd) || null;
    const m = data < hoje ? mostradoEm(st, data) : null;
    const d = m ? (m.tipo ? diaGuardado(m, p) : null) : doPlano ? (data < hoje ? { ...doPlano, estimado: true } : doPlano) : null;
    const doDia = runs.filter((r) => r.data === data);
    if (!d) { extras[wd] = doDia.map((r) => ({ id: r.id, data: r.data, tipo: r.tipo, distKm: r.distKm || 0, durMin: r.durMin || 0 })); continue; }
    const forte = d.intensidade === 'forte';
    if (d.tipo === 'longo') diaLongo = wd;
    dias[wd] = { ...d, wd, data, forte, chave: forte || d.tipo === 'longo', feito: melhorRegistro(doDia) };
  }
  return { semana: n, totalSemanas: p.totalSemanas, semanaAtual: p.semanaAtual, fase: ROTULO.fase[s.fase] + (s.descarga ? ' · semana leve' : ''), foco: s.foco, descarga: s.descarga, dias, extras, diaLongo, inicioDaSemana: ini };
}
const semTreinos = () => ({ dias: new Array(7).fill(null), extras: Array.from({ length: 7 }, () => []), diaLongo: null });
// Semana atual do plano
export function planoDaSemana(st, hoje) {
  const p = planoAtual(st, hoje);
  if (!p) return null;
  const run = st.run;
  if (hoje < run.inicio) return { semana: 1, totalSemanas: p.totalSemanas, semanaAtual: p.semanaAtual, fase: `Começa na ${fmtDia(run.inicio)}`, ...semTreinos(), antesDoInicio: true, comecaEm: run.inicio };
  const n = p.semanaAtual;
  if (n > p.totalSemanas) return { semana: p.totalSemanas, totalSemanas: p.totalSemanas, semanaAtual: n, fase: 'Plano concluído', ...semTreinos(), concluido: true };
  return semanaDoPlano(p, st, n, somaDias(run.inicio, (n - 1) * 7), hoje);
}
// A semana que começa em `segunda` ('AAAA-MM-DD'), na mesma forma de planoDaSemana: passada (como o plano a mostrou em cada
// dia, com `feito`), atual ou futura (como está prevista hoje). `semana` e `totalSemanas` são os da semana VISTA; `semanaAtual`
// é a semana em que a pessoa está hoje. Marca `antesDoInicio` (com `comecaEm`; a 1ª semana do plano já vem com os treinos),
// `concluido` (depois da última semana) ou `foraDoPlano` (semana pulada por uma pausa).
export function planoDaSemanaEm(st, hoje, segunda) {
  const p = planoAtual(st, hoje);
  if (!p || !diaValido(segunda) || !p.inicios.length) return null;
  const seg = segundaDe(segunda), primeira = p.inicios[0];
  const runs = Array.isArray(st.runs) ? st.runs.filter((r) => isObj(r)) : [];
  // fora das semanas do plano, toda corrida registrada é um extra
  const vazio = (extra) => { const v = semTreinos(); for (let k = 0; k < 7; k++) { const data = somaDias(seg, k); v.extras[diaDaSemana(data)] = runs.filter((r) => r.data === data).map((r) => ({ id: r.id, data: r.data, tipo: r.tipo, distKm: r.distKm || 0, durMin: r.durMin || 0 })); } return { totalSemanas: p.totalSemanas, semanaAtual: p.semanaAtual, ...v, inicioDaSemana: seg, ...extra }; };
  const n = p.inicios.indexOf(seg) + 1;
  if (n) { const w = semanaDoPlano(p, st, n, seg, hoje); return hoje < primeira ? { ...w, antesDoInicio: true, comecaEm: primeira } : w; }
  if (seg < primeira) return vazio({ semana: 1, fase: `Começa na ${fmtDia(primeira)}`, antesDoInicio: true, comecaEm: primeira });
  if (seg > p.inicios[p.inicios.length - 1]) return vazio({ semana: p.totalSemanas, fase: 'Plano concluído', concluido: true });
  return vazio({ semana: 0, fase: 'Plano pausado nesta semana', foraDoPlano: true });
}
// Treino planejado para uma data (ou null). Em data que já passou, é o treino que o plano MOSTROU naquele dia (`guardado: true`);
// se ele não ficou guardado, vem o previsto pelo plano de hoje, marcado `estimado: true` (serve para mostrar, não para comparar).
export function treinoDoDia(st, hoje, data) {
  const p = planoAtual(st, hoje);
  if (!p || !diaValido(data)) return null;
  const n = p.inicios.findIndex((ini) => data >= ini && data <= somaDias(ini, 6)) + 1;
  const s = n ? p.semanas[n - 1] : null;
  if (!s) return null;
  if (data < hoje) {
    const m = mostradoEm(st, data);
    if (m) return m.tipo ? { ...diaGuardado(m, p), wd: diaDaSemana(data), data, semana: n, fase: s.fase, plano: p } : null;
  }
  const d = s.dias.find((x) => x.wd === diaDaSemana(data));
  return d ? { ...d, ...(data < hoje ? { estimado: true } : {}), data, semana: n, fase: s.fase, plano: p } : null;
}
// O que guardar no estado ao desenhar o dia de hoje (ou ao registrar): o treino mostrado em cada dia, de hoje até o fim da
// semana (os dias que já passaram não são tocados), e o degrau de ritmo já concedido. Devolve { mostrados, degrau } para
// gravar em state.run, ou null quando nada mudou.
export function guardarDoDia(st, hoje) {
  const run = st && isObj(st.run) ? st.run : null;
  if (!run || !diaValido(hoje)) return null;
  let p = null;
  try { p = planoAtual(st, hoje); } catch { p = null; }
  if (!p) return null;
  const atuais = limparMostrados(run.mostrados), antigo = limparDegrau(run.degrau);
  const mapa = new Map(atuais.map((m) => [m.data, m]));
  const n = p.semanaAtual;
  if (n >= 1 && n <= p.totalSemanas) {
    const ini = p.inicios[n - 1];
    for (let k = 0; k < 7; k++) { const data = somaDias(ini, k); if (data >= hoje) mapa.set(data, mostradoDe(p.semanas[n - 1].dias.find((x) => x.wd === diaDaSemana(data)), data)); }
  }
  const mostrados = limparMostrados([...mapa.values()]);
  const degrau = p.degrau && p.degrau.pontos > 0 ? limparDegrau(p.degrau) : antigo && p.degrau && antigo.base === p.degrau.base ? antigo : null;
  return JSON.stringify(mostrados) !== JSON.stringify(atuais) || JSON.stringify(degrau) !== JSON.stringify(antigo) ? { mostrados, degrau } : null;
}
// segunda-feira da semana 1 para um plano aceito hoje: esta semana, se ainda há treino de hoje em diante; senão, a próxima
// (a prova continua na semana pedida: ver `adiado` em gerarPlano)
export function inicioPara(respostas, hoje) {
  const pf = perfil(respostas);
  const seg = segundaDe(hoje), p = pos(diaDaSemana(hoje));
  // no programa de corrida e caminhada a semana só vale inteira: cada etapa são as 3 sessões da semana
  if (pf.nivel === 0 && !pf.gestante) return estruturaNivel0(pf, RITMO_PADRAO[0], null, null).corridaDias.every((wd) => pos(wd) >= p) ? seg : somaDias(seg, 7);
  return pf.dias.some((wd) => pos(wd) >= p) ? seg : somaDias(seg, 7);
}

// Resumo para a Nutricionista ajustar a alimentação aos treinos e à prova. Fora do plano (antes da semana 1 ou depois da
// última), null: não há treino de corrida para somar.
export function resumoParaNutricao(st, hoje) {
  const p = planoAtual(st, hoje);
  if (!p || hoje < st.run.inicio || p.semanaAtual < 1 || p.semanaAtual > p.totalSemanas) return null;
  const n = p.semanaAtual;
  const s = p.semanas[n - 1];
  const corridas = s.dias.filter((d) => d.tipo !== 'caminhada' && d.tipo !== 'descanso');
  const longo = corridas.reduce((m, d) => (d.durMin > (m ? m.durMin : 0) ? d : m), null);
  const ini = somaDias(st.run.inicio, (n - 1) * 7);
  let proxima = null;
  for (let w = n; w <= Math.min(p.totalSemanas, n + 1) && !proxima; w++) {
    const base = somaDias(st.run.inicio, (w - 1) * 7);
    for (const d of p.semanas[w - 1].dias) {
      const data = somaDias(base, pos(d.wd));
      if (data >= hoje && d.tipo !== 'caminhada' && d.tipo !== 'descanso') { proxima = { data, durMin: d.durMin, distKm: d.distKm, tipo: d.tipo }; break; }
    }
  }
  const prova = p.prova && p.prova.data >= hoje ? { distKm: p.prova.distKm, data: p.prova.data, semanasAte: Math.max(0, Math.ceil(diasEntre(hoje, p.prova.data) / 7)) } : null;
  return {
    kmSemana: s.volumeKm, minSemana: s.volumeMin, sessoesSemana: corridas.length, longoMin: longo ? longo.durMin : 0, longoKm: longo ? longo.distKm : 0,
    fase: s.fase, semana: n, totalSemanas: p.totalSemanas, prova, proximaCorrida: proxima, nivel: p.perfil.nivel, inicioDaSemana: ini,
  };
}

// ---------- análise para a tela ----------
// Evolução: volume e carga por semana (carga = esforço × minutos: haddad2017), ritmo dos treinos leves e constância.
export function evolucao(registros, hoje, nSemanas = 8) {
  const rs = limparRegistros(registros).filter((r) => diaValido(hoje) && r.data <= hoje);
  const seg0 = diaValido(hoje) ? segundaDe(hoje) : '';
  const semanas = [];
  for (let i = nSemanas - 1; i >= 0 && seg0; i--) {
    const a = somaDias(seg0, -7 * i), b = somaDias(a, 6);
    const l = rs.filter((r) => r.data >= a && r.data <= b && ehCorrida(r));
    semanas.push({ inicio: a, km: r1(l.reduce((s, r) => s + r.distKm, 0)), min: Math.round(l.reduce((s, r) => s + r.durMin, 0)), sessoes: l.length, carga: Math.round(l.reduce((s, r) => s + (r.pse || 0) * r.durMin, 0)) });
  }
  const leves = rs.filter((r) => (r.tipo === 'leve' || r.tipo === 'longo' || r.tipo === 'livre') && r.distKm >= 2 && r.durMin > 0 && (r.pse == null || r.pse <= 5)).slice(-12).map((r) => ({ data: r.data, ritmo: Math.round((r.durMin * 60) / r.distKm), pse: r.pse }));
  const comTreino = semanas.filter((s) => s.sessoes > 0).length;
  let seq = 0;
  for (let i = semanas.length - 1; i >= 0; i--) { if (semanas[i].sessoes > 0) seq++; else if (i < semanas.length - 1) break; }
  const corr = rs.filter(ehCorrida);
  const tendencia = leves.length >= 4 ? Math.round(leves.slice(0, Math.floor(leves.length / 2)).reduce((s, x) => s + x.ritmo, 0) / Math.floor(leves.length / 2) - leves.slice(-Math.floor(leves.length / 2)).reduce((s, x) => s + x.ritmo, 0) / Math.floor(leves.length / 2)) : null;
  return {
    semanas, ritmoLeve: leves, tendenciaRitmo: tendencia, // segundos por km ganhos (positivo = mais rápido) entre a primeira e a segunda metade dos treinos leves
    constancia: { semanasComTreino: comTreino, de: semanas.length, sequencia: seq }, totalKm: r1(corr.reduce((s, r) => s + r.distKm, 0)), totalCorridas: corr.length,
    maisLonga: corr.reduce((m, r) => Math.max(m, r.distKm), 0), refs: ['haddad2017', 'saw2016'],
  };
}
// Alertas de lesão e excesso a partir dos registros.
export function alertas(registros, hoje) {
  const out = [];
  if (!diaValido(hoje)) return out;
  const rs = limparRegistros(registros).filter((r) => r.data <= hoje && ehCorrida(r));
  if (!rs.length) return out;
  const ult = rs[rs.length - 1];
  // corrida mais de 10% maior do que a mais longa dos 30 dias anteriores (frandsen2025)
  if (ult.distKm >= 3 && diasEntre(ult.data, hoje) <= 7) {
    const ant = Math.max(0, ...rs.filter((r) => r !== ult && r.data < ult.data && diasEntre(r.data, ult.data) <= 30).map((r) => r.distKm));
    if (ant >= 3 && ult.distKm > ant * 1.1 + 0.3) out.push({ tipo: 'warn', texto: `Sua última corrida (${fmtKm(ult.distKm)}) foi ${Math.round((ult.distKm / ant - 1) * 100)}% maior do que a mais longa dos 30 dias anteriores (${fmtKm(ant)}). Saltos acima de 10% em uma única corrida aumentam o risco de lesão por sobrecarga: nos próximos dias, fique nos treinos leves.`, refs: ['frandsen2025'] });
  }
  // semana passada mais de 30% acima da anterior (damsted2018)
  const seg = segundaDe(hoje);
  const kmSem = (k) => { const a = somaDias(seg, -7 * k), b = somaDias(a, 6); return rs.filter((r) => r.data >= a && r.data <= b).reduce((s, r) => s + r.distKm, 0); };
  if (kmSem(2) >= 8 && kmSem(1) > kmSem(2) * 1.3 + 2) out.push({ tipo: 'warn', texto: `Na semana passada você correu ${fmtKm(kmSem(1))}, ${Math.round((kmSem(1) / kmSem(2) - 1) * 100)}% a mais do que na anterior. Em um estudo, aumentos acima de 30% de uma semana para a outra apareceram ligados a mais lesões (evidência ainda limitada).`, refs: ['damsted2018'] });
  // esforço alto repetido (meeusen2013, saw2016)
  const u4 = rs.filter((r) => r.pse != null && diasEntre(r.data, hoje) <= 14).slice(-4);
  if (u4.length >= 3 && u4.filter((r) => r.pse >= 8).length >= 3) out.push({ tipo: 'warn', texto: 'Três dos seus últimos treinos ficaram com esforço de 8 ou mais. Se o cansaço não passa em uma semana ou o rendimento cai, reduza os treinos; se durar mais de 4 semanas, procure um médico.', refs: ['meeusen2013', 'saw2016'] });
  // dor repetida no mesmo local
  const dores = {};
  // dor muscular leve repetida é o esperado de quem treina: só conta a de 4 ou mais
  for (const r of rs) for (const rd of (Array.isArray(r.dores) ? r.dores : [])) if (temLocal(rd.onde) && diasEntre(r.data, hoje) <= 14 && (rd.tipo !== 'muscular' || rd.nivel >= 4)) dores[rd.onde] = (dores[rd.onde] || 0) + 1;
  for (const k of Object.keys(dores)) if (dores[k] >= 2 && temLocal(k)) out.push({ tipo: 'warn', texto: `Você anotou dor em ${LOCAIS_DOR[k].toLowerCase()} em ${dores[k]} corridas nas últimas 2 semanas. Dor que se repete pede avaliação de um médico ou fisioterapeuta.`, refs: ['vangent2007', 'esculier2016'] });
  // 7 dias seguidos correndo (meeusen2013, warden2021)
  const dias = new Set(rs.map((r) => r.data));
  let seguidos = 0;
  for (let k = 0; k < 10; k++) { if (dias.has(somaDias(hoje, -k))) seguidos++; else if (k > 0) break; }
  if (seguidos >= 7) out.push({ tipo: 'info', texto: 'Você correu 7 dias seguidos. Tenha pelo menos um dia de descanso total por semana.', refs: ['meeusen2013', 'warden2021'] });
  return out;
}
// Dicas curtas conforme o perfil, com fontes.
export function dicas(respostas) {
  const pf = perfil(respostas);
  const d = [];
  const t = (titulo, texto, refs) => d.push({ titulo, texto, refs });
  if (pf.nivel <= 1) t('Devagar é o certo', 'Se você consegue conversar enquanto corre, está no ritmo certo. Ganhar fôlego vem do tempo correndo, não da velocidade.', ['foster2020', 'seiler2009']);
  else t('Leve de verdade nos dias leves', 'Amadores costumam correr o leve rápido demais e acabam cansados para os treinos fortes. Guarde a força para os dias que pedem.', ['seiler2009']);
  t('Força ajuda a correr', 'Dois treinos de força por semana, com carga alta, por 6 a 14 semanas, melhoram a economia de corrida em 2 a 8%, sem ganho de peso. Depois, uma sessão por semana mantém a força.', ['blagrove2018', 'llanos2024', 'beattie2017']);
  t('Tênis: nenhum tipo previne lesão', 'Não há evidência de que o tênis “certo para a sua pisada” previna lesões.', ['relph2022']);
  if (pf.limitacoes.includes('joelho')) t('Passos mais curtos aliviam o joelho', 'Aumentar a cadência em 5 a 10% (passos mais curtos e rápidos, no mesmo ritmo) reduz a energia absorvida pelo joelho em cerca de 20% (com 5% a mais de passos) a 34% (com 10%).', ['heiderscheit2011', 'esculier2016']);
  if (pf.master) t('Força também depois dos 40', 'Mantenha exercícios de força em 2 ou mais dias por semana, como a OMS recomenda para todos os adultos.', ['oms2020']);
  t('Sono e descanso fazem parte do treino', 'Tenha pelo menos um dia de descanso total por semana. Cansaço que não passa em uma semana é sinal para reduzir.', ['meeusen2013', 'saw2016']);
  if (pf.dist && pf.dist >= 21) t('Treine a alimentação nos longos', 'Em corridas acima de 1h30, leve água e algo para comer, e use nos treinos o que pretende usar na prova.', ['kenefick2018', 'smyth2021muro']);
  return d;
}

// Assuntos do Treinador de corrida no chat. Puro: sem DOM. Formato em logic/chat/contrato.js.
// As regras são as do plano de corrida (logic/corrida.js) e do treino perdido (logic/perdido.js): corrida perdida não se
// repõe (ref frandsen2025), dias sem treino ficam livres (logic/dias-livres.js: o plano já não marca corrida neles).
// Fonte nova, só para a esteira: Miller 2019 (ref miller2019, texto completo — ver o comentário em data/corrida.js):
// nas corridas leves (abaixo de ~80% do VO2máx) o gasto na esteira é igual ao da rua com 0% ou 1% de inclinação; nos
// treinos fortes, 1% de inclinação; na esteira as pessoas escolhem ritmos mais lentos e rendem menos nos testes longos
// → guiar-se pelo esforço do treino, não pelo ritmo da rua.
import * as P from '../perdido.js';
import { temCorrida } from '../combinado.js';
import { planoAtual } from '../corrida.js';
import { corridaDeHoje, corridaChave, treinoDeHoje, passoJuntar, passoDor, acaoNaoCorrer } from './treino.js';
import { faqDe } from './comum.js';
import { FAQ_CORRIDA } from '../../data/corrida.js';

const temPlano = (ctx) => { try { return !!planoAtual(ctx.st, ctx.hoje); } catch { return false; } };
const correuHoje = (ctx) => (Array.isArray(ctx.st.runs) ? ctx.st.runs : []).some((r) => r && r.data === ctx.hoje);
const abrirHoje = (ctx) => ({ rotulo: 'Abrir a corrida de hoje', rota: 'corrida/dia/' + ctx.hoje });
const nomeMin = (d) => String(d.nome || 'corrida').toLowerCase();

// Hoje não há o que decidir: sem corrida no plano, ou ela já foi registrada / marcada
function semCorridaHoje(ctx) {
  if (correuHoje(ctx)) return { texto: ['Você já registrou uma corrida hoje. Bom trabalho!'], ir: [abrirHoje(ctx)] };
  if (P.corridaPerdidaEm(ctx.st, ctx.hoje)) return { texto: ['A corrida de hoje já está marcada como não feita. Siga o plano.'], ir: [{ rotulo: 'Ver a semana', rota: 'corrida' }] };
  return { texto: ['Hoje o plano não tem corrida: aproveite o descanso.'], ir: [{ rotulo: 'Ver a semana', rota: 'corrida' }] };
}
export function passoEsteira(ctx) {
  const d = corridaDeHoje(ctx);
  const forte = corridaChave(d) && d.tipo !== 'longo';
  const f = faqDe(FAQ_CORRIDA, 'Correr na esteira');
  return {
    texto: [
      d ? `Pode fazer o treino de hoje (${nomeMin(d)}) na esteira.` : 'Pode correr na esteira.',
      forte ? 'No treino forte, use 1% de inclinação.' : 'Na corrida leve, a inclinação pode ficar entre 0 e 1%.',
      'Guie-se pelo esforço: na esteira, o mesmo esforço sai um pouco mais devagar.',
    ],
    aviso: { tipo: 'info', texto: 'Prenda a chave de segurança da esteira na roupa.' },
    detalhes: f ? f.a : [],
    refs: ['miller2019'],
    ir: d ? [abrirHoje(ctx)] : [],
  };
}
export function passoNaoCorrer(ctx, antes = []) {
  if (!P.podeMarcarCorrida(ctx.st, ctx.hoje, ctx.hoje)) return semCorridaHoje(ctx);
  return {
    texto: [...antes, 'Tudo bem. Corrida perdida não se repõe: siga o plano.'],
    detalhes: ['Juntar a corrida perdida a outra faz uma corrida maior. Uma corrida mais de 10% maior do que a mais longa dos últimos 30 dias aumenta o risco de lesão.', 'O volume das próximas semanas acompanha o que você de fato correu.'],
    refs: P.REFS_CORRIDA,
    acoes: [acaoNaoCorrer('Marcar como não feita')],
  };
}
function passoMaisTarde(ctx) {
  if (treinoDeHoje(ctx)) return passoJuntar(ctx);
  return { texto: ['Pode correr mais tarde, no mesmo dia: o treino continua o mesmo.'], ir: [abrirHoje(ctx)] };
}
// Choveu ou não dá para correr na rua
function passoChuva(ctx) {
  const d = corridaDeHoje(ctx);
  if (!d || correuHoje(ctx) || P.corridaPerdidaEm(ctx.st, ctx.hoje)) {
    // sem corrida hoje: a esteira ainda serve para outro dia
    const s = semCorridaHoje(ctx);
    return { ...s, texto: [...s.texto, 'Se chover no dia de correr, a esteira serve.'], refs: ['miller2019'] };
  }
  return {
    texto: [`Hoje é dia de ${nomeMin(d)}. O que prefere?`],
    opcoes: [{ rotulo: 'Correr na esteira', valor: 'esteira' }, { rotulo: 'Correr mais tarde hoje', valor: 'tarde' }, { rotulo: 'Não vou correr hoje', valor: 'nao' }],
    proximo: (v, c) => (v === 'esteira' ? passoEsteira(c) : v === 'tarde' ? passoMaisTarde(c) : passoNaoCorrer(c)),
  };
}
function passoCorridaPerdida(ctx) {
  if (!corridaDeHoje(ctx) || !P.podeMarcarCorrida(ctx.st, ctx.hoje, ctx.hoje)) return semCorridaHoje(ctx);
  return {
    texto: ['O que aconteceu?'],
    opcoes: [{ rotulo: 'Chuva ou sem lugar', valor: 'chuva' }, { rotulo: 'Estou com dor', valor: 'dor' }, { rotulo: 'Estou doente', valor: 'doente' }, { rotulo: 'Outro motivo', valor: 'outro' }],
    proximo: (v, c) => {
      if (v === 'chuva') return passoChuva(c);
      if (v === 'dor') return passoDor(c, 'corrida');
      if (v === 'doente') {
        const f = faqDe(FAQ_CORRIDA, 'Posso correr gripado');
        const p = passoNaoCorrer(c, ['Com febre, dor no corpo ou cansaço fora do normal, não corra hoje.']);
        return f ? { ...p, detalhes: [...f.a.slice(0, 2), ...(p.detalhes || [])], refs: [...f.refs, ...(p.refs || [])] } : p;
      }
      return passoNaoCorrer(c);
    },
  };
}

export const INTENCOES = [
  {
    id: 'chuva', coach: 'corrida', titulo: 'Choveu ou não dá para correr na rua', resumo: 'chuva ou não poder correr na rua',
    palavras: ['chuva', 'correr+chuva', 'chuva nao correr', 'esta chuva', 'ta chuva', 'chuva forte', 'esteira', 'correr esteira', 'correr rua', 'nao da correr rua', 'sem lugar correr', 'escuro', 'tempo ruim', 'clima', 'frio demais', 'muito frio', 'alagado', 'rua molhada', 'inclinacao', 'inclinacao esteira', 'esteira inclinacao', 'esteira igual rua', 'esteira vale'],
    disponivel: (ctx) => temCorrida(ctx.st) && temPlano(ctx),
    inicio: passoChuva,
  },
  {
    id: 'juntar-corrida', coach: 'corrida', titulo: 'Corrida e musculação no mesmo dia', resumo: 'fazer corrida e musculação no mesmo dia',
    palavras: ['correr+musculacao', 'correr+treino+juntar', 'correr+academia', 'mesmo dia', 'juntar', 'juntar outro', 'correr depois', 'correr antes', 'depois musculacao', 'antes musculacao', 'qual primeiro', 'ordem', 'prioridade'],
    disponivel: (ctx) => { try { return temCorrida(ctx.st) && !!P.planoAtivo(ctx.st); } catch { return false; } },
    inicio: (ctx) => passoJuntar(ctx),
  },
  {
    id: 'corrida-perdida', coach: 'corrida', titulo: 'Não vou correr hoje', resumo: 'faltar à corrida de hoje',
    palavras: ['nao vou correr', 'nao quero correr', 'sem vontade correr', 'nao consigo correr', 'nao posso correr', 'nao vou poder correr', 'nao corri', 'nao deu correr', 'perder correr', 'perdi correr', 'faltar correr', 'pular correr', 'faltar', 'sem tempo correr', 'remarcar correr', 'correr amanha', 'outro dia'],
    disponivel: (ctx) => temCorrida(ctx.st) && temPlano(ctx),
    inicio: passoCorridaPerdida,
  },
  {
    id: 'dor-corrida', coach: 'corrida', titulo: 'Estou com dor', resumo: 'uma dor',
    palavras: ['dor', 'dor depois correr', 'dor muscular', 'machucar', 'lesao', 'canela', 'dor canela', 'dor joelho', 'dor pe', 'dor tornozelo', 'dor quadril', 'dor panturrilha', 'aquiles', 'fascite', 'canelite', 'tendinite', 'estou dor'],
    inicio: (ctx) => passoDor(ctx, 'corrida'),
  },
  {
    id: 'mudar-corrida', coach: 'corrida', titulo: 'Mudar o plano de corrida', resumo: 'mudar o plano de corrida',
    palavras: ['mudar plano', 'mudar dia', 'mudar dias', 'mudar dia correr', 'trocar dia', 'refazer plano', 'refazer entrevista', 'outro plano', 'plano novo', 'nova prova', 'mudar prova', 'mudar objetivo', 'mudar', 'pausar plano', 'parar plano'],
    disponivel: (ctx) => temCorrida(ctx.st),
    inicio: () => ({
      texto: ['Os dias, a prova e o tempo mudam nas respostas da entrevista.', 'Ao terminar, o plano novo começa da semana 1. As corridas registradas continuam.'],
      detalhes: ['Para uma semana de folga (férias, doença), use “Pausar o plano” na tela da corrida: ao voltar, ele retoma aos poucos.'],
      ir: [{ rotulo: 'Mudar as respostas', abrir: 'corrida-entrevista' }, { rotulo: 'Abrir a corrida', rota: 'corrida' }],
    }),
  },
];

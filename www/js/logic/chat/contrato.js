// Contrato do chat com os treinadores (sem internet e sem IA). Puro: sem DOM.
//
// O chat é uma conversa GUIADA. Cada assunto ("intenção") faz perguntas curtas com botões e responde só com as regras e
// as fontes que o app já tem. O campo de texto é um atalho: reconhece a intenção por palavras (sem acento, com sinônimos e
// tolerando erro de digitação) e sempre confirma antes ("Entendi que você quer… É isso?"). O que não reconhece não é
// inventado: o chat mostra os assuntos mais próximos e as perguntas frequentes (knowledge.js, buscarFaq).
// Antes de tudo, o motor (logic/chat/motor.js) procura SINAIS DE ALERTA no texto digitado (dor ou aperto no peito, falta
// de ar, desmaio, tontura, palpitação...): com um deles, a conversa para e mostra a orientação de segurança do app.
//
// Módulos de assuntos (logic/chat/treino.js, logic/chat/corrida.js, logic/chat/nutri.js…) exportam
//   export const INTENCOES = [ Intencao, ... ]
//
// Intencao = {
//   id: 'treino-perdido',                 // único em todo o chat
//   coach: 'treinador' | 'corrida' | 'nutri',
//   titulo: 'Não vou conseguir treinar hoje', // texto do botão (curto, até ~40 caracteres)
//   resumo: 'faltar ao treino de hoje',   // usado na confirmação: "Entendi que você quer falar sobre <resumo>. É isso?"
//   palavras: ['faltar', 'perder treino', 'nao vou treinar', ...], // termos e expressões, minúsculas e SEM acento
//            // expressão: as palavras na ordem (pode sobrar uma palavra entre elas). 'corrida+musculacao': as partes em
//            // qualquer lugar da frase. '!creatina': marca forte, que sozinha já indica o assunto. Palavras de ligação ("de", "o", "pra"...) são ignoradas dos dois lados.
//   disponivel?: (ctx) => true | false,   // só aparece quando faz sentido (ex.: tem plano ativo)
//   inicio: (ctx) => Passo,
// }
//
// Passo = {
//   texto: ['parágrafo curto', ...],      // o que o treinador diz (frases curtas, sem jargão)
//   detalhes?: ['...'],                   // vai num "Por quê?" fechado
//   refs?: ['chave', ...],                // chaves de REFS (data/knowledge.js ou REFS_CORRIDA de data/corrida.js),
//                                         // mostradas em "Fontes" dentro do "Por quê?"
//   aviso?: { tipo: 'info' | 'warn' | 'danger', texto: '...' },
//   opcoes?: [{ rotulo: 'Choveu', valor: 'chuva' }, ...], // botões de resposta (2 a 6)
//   proximo?: (valor, ctx) => Passo,      // obrigatório quando há opcoes
//   acoes?: [Acao, ...],                  // o que o treinador pode fazer por você
//   ir?: [{ rotulo: 'Abrir o treino', rota: 'treinos' }, ...], // atalhos para telas do app (hash sem '#/')
//        // ou { rotulo, abrir: 'contar-dor' | 'combinado' | 'treinador-entrevista' | 'treinador-novo' |
//        //      'treinador-trocas' | 'corrida-entrevista' | 'nutri-entrevista' }: folhas e modos de tela que não têm endereço próprio
//   faq?: [{ q, a: ['...'], refs: ['...'] }], // perguntas frequentes mostradas fechadas (resposta e fontes ao tocar)
// }
//
// Acao = {
//   rotulo: 'Mover a corrida para amanhã',
//   confirmar: 'texto curto do que vai mudar',   // a tela sempre pede confirmação antes
//   aplicar?: (s, ctx) => void | false,  // recebe o estado mutável dentro de update(); NÃO mexe em nada fora de `s`.
//                                        // false = não deu (a situação mudou): a tela avisa e nada é gravado de errado
//   iniciar?: { planId, diaId, itens },  // em vez de (ou depois de) aplicar: começa o treino de hoje com estes itens
//                                        // (versão curta), sem mudar o plano (views/session.js startSession)
//   depois?: 'texto curto do que foi feito',
// }
//
// ctx = { st: state (somente leitura), hoje: 'AAAA-MM-DD', agora: Date.now() }
// Regras: nunca dar número de calorias/peso a quem o app protege (transtorno alimentar, menores de 18 — ver logic/saude.js
// e logic/nutrition.js); respeitar dores, limitações e a triagem (logic/saude.js, logic/trainer.js); não sugerir nada que
// a lógica do plano não sugeriria; não citar fonte que não esteja em REFS (lida em texto completo).
export const COACHES = {
  treinador: 'Treinador',
  corrida: 'Treinador de corrida',
  nutri: 'Nutricionista',
};
// Destinos de `ir.abrir` que a tela (views/chat.js) sabe abrir
export const ABRIR = ['contar-dor', 'combinado', 'treinador-entrevista', 'treinador-novo', 'treinador-trocas', 'corrida-entrevista', 'nutri-entrevista'];

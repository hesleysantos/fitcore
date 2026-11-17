// Contrato do chat com os treinadores (sem internet e sem IA). Puro: sem DOM.
//
// O chat é uma conversa com botões E com texto livre, o mais perto possível de uma conversa normal, sem IA. Cada assunto
// ("intenção") faz perguntas curtas com botões e responde só com as regras e as fontes que o app já tem. O texto livre é
// lido por palavras (sem acento, com sinônimos e tolerando erro de digitação; logic/chat/motor.js): com o assunto bem
// claro, o treinador responde direto; com folga pequena, confirma antes ("Entendi que você quer… É isso?"). O motor
// entende DATAS ("amanhã", "sexta", "semana que vem": ctx.data), lembra o assunto e o dia da conversa ("e amanhã?", "e a
// corrida?"), aceita "sim", "pode", "não" e o texto de um botão como resposta à pergunta em aberto, e trata primeiro o
// assunto mais importante de uma frase com dois. O que não reconhece não é inventado: uma pergunta frequente que casa bem
// vira a resposta (com "Por quê?" e fontes); senão, os assuntos mais próximos e as perguntas frequentes (buscarFaq).
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
//   data?: true,                          // o assunto fala de um dia (ganha um pouco com uma data na frase)
//   resumoNoDia?: 'faltar ao treino',     // resumo com a data: "faltar ao treino na sexta" ('{dia}' = "sexta")
//   bonus?: ({ datas, hoje, texto, ctx }) => número, // pontos que as palavras não pegam (ex.: dois dias na frase)
//   prioridade?: 0..3,                    // numa frase com dois assuntos, o maior vem primeiro (dor = 3)
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
//   data?: 'AAAA-MM-DD',                  // o dia de que o passo fala (vai para a memória da conversa)
//   (o motor acrescenta: assunto (id), memoria { assunto, data, de, pendente } e, quando o texto aceita uma ação em
//    aberto, executar (índice da ação: a tela abre a mesma confirmação do botão))
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
//   data?: 'AAAA-MM-DD',                 // o dia em que a ação vale (a tela passa em ctx.data para aplicar)
//   semana?: true,                       // depois de feita, oferece "Como fica a semana"
// }
//
// ctx = { st: state (somente leitura), hoje: 'AAAA-MM-DD', agora: Date.now(), data?: 'AAAA-MM-DD' (o dia da conversa),
//         datas?: [{ data, semana? }] (as datas da frase), texto?: frase normalizada, de?/antes?: o dia anterior da conversa }
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

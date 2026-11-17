// Força de quem está começando, por exercício: a base da carga inicial sugerida pelo perfil (logic/carga.js).
// Só entram exercícios de peso livre com 1RM de pessoas destreinadas medido em estudo lido em TEXTO COMPLETO, com a
// média, o desvio-padrão e o peso corporal do grupo. Nenhum estudo propõe "1RM ÷ peso do corpo" como método: a conta é
// do aplicativo, feita do lado conservador (média menos um desvio-padrão).
//
//  • dias2005 (Dias RMR, Cyrino ES et al., Rev Bras Med Esporte 2005;11(4):224-8, PDF da SciELO, Tabelas 1 e 2):
//    23 homens (66,4 ± 8,2 kg) e 15 mulheres (58,3 ± 6,3 kg), cerca de 20 anos, sem treino nos 6 meses anteriores,
//    1RM medido depois de 5 sessões de familiarização. Supino: 61,1 ± 13,0 kg (H) e 29,6 ± 5,2 kg (M). Rosca direta:
//    39,2 ± 6,6 kg (H) e 22,1 ± 4,1 kg (M). O agachamento (125,4 ± 26,6 e 73,6 ± 14,4 kg) NÃO entra: o equipamento não
//    é informado, é o único estudo e o próprio artigo diz que o agachamento não fazia parte do treino e teve a
//    familiarização mais difícil.
//  • ferrari2017 (Ferrari R et al., Open Sports Sci J 2017;10:81, texto completo no site da revista, Tabela 1):
//    15 homens ativos que nunca fizeram musculação, 25,5 ± 3,8 anos, 76,1 ± 7,5 kg. Remada unilateral com halter:
//    35,4 ± 3,9 kg; rosca unilateral com halter: 14,8 ± 1,7 kg (supino: 72,1 ± 5,9 kg, acima do de dias2005, que vale
//    por ser o menor). A "extensão de tríceps com barra" não entra: o texto não deixa claro qual exercício é.
//    Só homens: para mulheres (ou sexo não informado) estes dois exercícios ficam sem número.
//  • ribeiro2014 (Ribeiro AS et al., J Hum Kinet 2014;42:165-174, PMC4234756, Tabela 1) só confirma a ordem de grandeza
//    (supino 68,7 e 29,2 kg; rosca 40,0 e 21,7 kg), com gente que já tinha treinado, por isso não entra na conta.
//
// Máquinas, cabos e Smith ficam sem número: o kg da pilha de placas não se compara entre aparelhos (glass2004, em
// máquinas Badger: o desenvolvimento deu mais kg que o supino) e não achamos estudo que meça a carga real de cada marca.
//
// equip: 'barra' (carga total, contando a barra olímpica de 20 kg) ou 'halter' (peso de cada halter).
// h / m: { rm, dp } = 1RM médio e desvio-padrão (kg); { peso, dpPeso } = peso corporal médio do grupo e desvio-padrão.
export const BARRA_KG = 20;

const DIAS_H = { peso: 66.4, dpPeso: 8.2 };
const DIAS_M = { peso: 58.3, dpPeso: 6.3 };
const FERRARI_H = { peso: 76.14, dpPeso: 7.51 };

export const FORCA_INICIANTE = {
  'supino-reto-barra': { equip: 'barra', fonte: 'dias2005', h: { rm: 61.1, dp: 13.0, ...DIAS_H }, m: { rm: 29.6, dp: 5.2, ...DIAS_M } },
  'rosca-direta-barra-reta': { equip: 'barra', fonte: 'dias2005', h: { rm: 39.2, dp: 6.6, ...DIAS_H }, m: { rm: 22.1, dp: 4.1, ...DIAS_M } },
  'remada-unilateral-halter-serrote': { equip: 'halter', fonte: 'ferrari2017', h: { rm: 35.4, dp: 3.85, ...FERRARI_H } },
  'rosca-alternada-halteres': { equip: 'halter', fonte: 'ferrari2017', h: { rm: 14.8, dp: 1.66, ...FERRARI_H } },
};

// Modelos de treino prontos. O usuário pode copiar um modelo e personalizar à vontade.
// Formato de cada exercício: [id, séries, repetições (ou segundos), descanso em segundos].
// Critérios (os mesmos do Treinador, conferidos em tests/estresse-treinador.test.mjs):
//   - modelos de iniciante só usam exercícios de nível 1, sem impacto (saltos) e sem barra livre em exercício composto;
//   - nenhum modelo usa exercício que o Treinador deixa só para a escolha manual;
//   - séries diretas por grupo e por semana dentro do teto do nível (12 iniciante, 16 intermediário, 20 avançado),
//     inclusive no grupo em foco — Baz-Valle 2022 (ref bazvalle2022);
//   - todo grande grupo com pelo menos 4 séries por semana — Iversen 2021 (ref iversen2021);
//   - nenhum modelo dispara os alertas de desequilíbrio ou de excesso da tela Evolução.

const dia = (nome, foco, itens) => ({ nome, foco, itens: itens.map(([ex, series, reps, descanso]) => ({ ex, series, reps, descanso })) });

export const MODELOS = [
  {
    id: 'iniciante-corpo-inteiro', nome: 'Iniciante: corpo inteiro', nivel: 1, diasSemana: 3,
    desc: 'Dois treinos (A e B) alternados em 3 dias da semana. Máquinas e movimentos simples para aprender a técnica.',
    agenda: [0, 1, 0], dias: [
      dia('Treino A', 'Pernas, peito, costas e abdômen', [
        ['leg-press-45', 3, '10-12', 90], ['supino-maquina', 3, '10-12', 90], ['puxada-frente-aberta', 3, '10-12', 90],
        ['cadeira-flexora', 2, '12-15', 60], ['desenvolvimento-maquina', 2, '10-12', 75], ['prancha-frontal', 2, '20', 45],
      ]),
      dia('Treino B', 'Pernas, costas, peito e braços', [
        ['agachamento-goblet', 3, '10-12', 90], ['remada-baixa-triangulo', 3, '10-12', 90], ['supino-inclinado-maquina', 3, '10-12', 90],
        ['elevacao-pelvica-maquina', 3, '10-12', 75], ['rosca-simultanea-halteres', 2, '12-15', 60], ['triceps-pulley-corda', 2, '12-15', 60], ['abdominal-supra-solo', 2, '12-15', 45],
      ]),
    ],
  },
  {
    id: 'rapido-30', nome: 'Treino rápido de 30 minutos', nivel: 1, diasSemana: 2,
    desc: 'Corpo inteiro em máquinas, com descansos curtos. Bom para quem tem pouco tempo ou está voltando a treinar.',
    agenda: [0, 0], dias: [
      dia('Corpo inteiro em máquinas', 'Corpo inteiro', [
        ['leg-press-45', 2, '10-12', 60], ['supino-maquina', 2, '10-12', 60], ['remada-maquina', 2, '10-12', 60],
        ['cadeira-flexora', 2, '12-15', 45], ['desenvolvimento-maquina', 2, '10-12', 60], ['puxada-frente-aberta', 2, '10-12', 60], ['abdominal-maquina', 2, '12-15', 45],
      ]),
    ],
  },
  {
    id: 'abc', nome: 'ABC: empurrar, puxar e pernas', nivel: 2, diasSemana: 3,
    desc: 'Três treinos: peito, ombros e tríceps; costas e bíceps; pernas. Pode ser feito 3 ou 6 vezes por semana.',
    agenda: [0, 1, 2], dias: [
      dia('A: Empurrar', 'Peito, ombros e tríceps', [
        ['supino-reto-barra', 4, '8-10', 120], ['supino-inclinado-halteres', 3, '8-12', 90], ['desenvolvimento-halteres-sentado', 3, '8-12', 90],
        ['crossover-polia-alta', 3, '12-15', 60], ['elevacao-lateral-halteres', 3, '12-15', 60], ['triceps-pulley-corda', 3, '10-12', 60], ['triceps-testa-barra-w', 3, '10-12', 60],
      ]),
      dia('B: Puxar', 'Costas, bíceps e ombro posterior', [
        ['puxada-frente-aberta', 4, '8-12', 120], ['remada-curvada-barra-pronada', 3, '8-10', 120], ['remada-baixa-triangulo', 3, '10-12', 90],
        ['crucifixo-inverso-peck-deck', 3, '12-15', 60], ['rosca-direta-barra-w', 3, '8-12', 60], ['rosca-martelo-halteres', 3, '10-12', 60], ['encolhimento-halteres', 3, '12-15', 60],
      ]),
      dia('C: Pernas', 'Quadríceps, posteriores, glúteos e panturrilhas', [
        ['agachamento-livre-barra', 4, '6-10', 150], ['leg-press-45', 3, '10-12', 120], ['stiff-barra', 3, '8-10', 120],
        ['cadeira-extensora', 3, '12-15', 60], ['mesa-flexora', 3, '10-12', 60], ['panturrilha-em-pe-maquina', 4, '10-15', 60], ['prancha-frontal', 3, '30', 45],
      ]),
    ],
  },
  {
    id: 'superior-inferior', nome: 'Superiores e inferiores (4 dias)', nivel: 2, diasSemana: 4,
    desc: 'Cada grupo muscular é treinado duas vezes por semana, com bom equilíbrio entre volume e descanso.',
    agenda: [0, 1, 2, 3], dias: [
      dia('Superiores A', 'Peito, costas, ombros e braços', [
        ['supino-reto-halteres', 3, '8-12', 120], ['remada-baixa-triangulo', 3, '8-12', 120], ['desenvolvimento-halteres-sentado', 3, '8-12', 90],
        ['puxada-frente-aberta', 3, '10-12', 90], ['elevacao-lateral-halteres', 3, '12-15', 60], ['rosca-direta-barra-w', 3, '10-12', 60], ['triceps-pulley-corda', 3, '10-12', 60],
      ]),
      dia('Inferiores A', 'Quadríceps, posteriores e panturrilhas', [
        ['agachamento-livre-barra', 3, '8-10', 150], ['levantamento-terra-romeno', 3, '8-10', 120], ['cadeira-extensora', 3, '12-15', 60],
        ['mesa-flexora', 3, '10-12', 60], ['panturrilha-em-pe-maquina', 3, '10-15', 60], ['abdominal-supra-solo', 3, '12-15', 45],
      ]),
      dia('Superiores B', 'Costas, peito, ombros e braços', [
        ['puxada-triangulo', 3, '8-12', 120], ['supino-inclinado-halteres', 3, '8-12', 120], ['remada-unilateral-halter-serrote', 3, '10-12', 90],
        ['peck-deck', 3, '12-15', 60], ['crucifixo-inverso-halteres', 3, '12-15', 60], ['rosca-martelo-halteres', 3, '10-12', 60], ['triceps-frances-halter', 3, '10-12', 60],
      ]),
      dia('Inferiores B', 'Glúteos, quadríceps e posteriores', [
        ['elevacao-pelvica-barra', 3, '8-12', 120], ['leg-press-45', 3, '10-12', 120], ['afundo-parado-halteres', 3, '10-12', 90],
        ['cadeira-flexora', 3, '10-12', 60], ['cadeira-abdutora', 3, '12-15', 60], ['panturrilha-sentado-maquina', 3, '12-15', 60], ['prancha-frontal', 3, '30', 45],
      ]),
    ],
  },
  {
    id: 'abcd', nome: 'ABCD: por grupo muscular', nivel: 2, diasSemana: 4,
    desc: 'Quatro treinos: peito e tríceps; costas e bíceps; pernas; ombros e abdômen.',
    agenda: [0, 1, 2, 3], dias: [
      dia('A: Peito e tríceps', 'Peito e tríceps', [
        ['supino-reto-barra', 4, '8-10', 120], ['supino-inclinado-halteres', 3, '8-12', 90], ['peck-deck', 3, '12-15', 60], ['crossover-polia-baixa', 3, '12-15', 60],
        ['triceps-pulley-barra-reta', 3, '10-12', 60], ['triceps-frances-halter', 3, '10-12', 60],
      ]),
      dia('B: Costas e bíceps', 'Costas e bíceps', [
        ['puxada-frente-aberta', 4, '8-12', 120], ['remada-curvada-barra-pronada', 3, '8-10', 120], ['remada-baixa-triangulo', 3, '10-12', 90], ['pulldown-bracos-estendidos', 3, '12-15', 60],
        ['rosca-direta-barra-w', 3, '8-12', 60], ['rosca-inclinada-halteres', 3, '10-12', 60],
      ]),
      dia('C: Pernas', 'Quadríceps, posteriores, glúteos e panturrilhas', [
        ['agachamento-livre-barra', 4, '6-10', 150], ['leg-press-45', 3, '10-12', 120], ['stiff-barra', 3, '8-10', 120], ['cadeira-extensora', 3, '12-15', 60],
        ['mesa-flexora', 3, '10-12', 60], ['panturrilha-em-pe-maquina', 4, '10-15', 60],
      ]),
      dia('D: Ombros e abdômen', 'Ombros, trapézio e abdômen', [
        ['desenvolvimento-halteres-sentado', 4, '8-12', 120], ['elevacao-lateral-halteres', 4, '12-15', 60], ['crucifixo-inverso-peck-deck', 3, '12-15', 60], ['encolhimento-halteres', 3, '12-15', 60],
        ['abdominal-polia-ajoelhado', 3, '12-15', 45], ['elevacao-pernas-deitado', 3, '10-15', 45], ['prancha-frontal', 3, '30', 45],
      ]),
    ],
  },
  {
    id: 'abcde', nome: 'ABCDE: um grupo por dia', nivel: 3, diasSemana: 5,
    desc: 'Cinco treinos, cada grupo uma vez por semana com volume alto. Indicado para quem já treina há mais de 2 anos.',
    agenda: [0, 1, 2, 3, 4], dias: [
      dia('A: Peito', 'Peito', [
        ['supino-reto-barra', 4, '6-10', 150], ['supino-inclinado-halteres', 4, '8-12', 120], ['supino-declinado-barra', 3, '8-12', 120], ['crucifixo-reto-halteres', 3, '10-12', 75], ['crossover-polia-alta', 3, '12-15', 60],
      ]),
      dia('B: Costas', 'Costas', [
        ['barra-fixa-pronada', 4, '6-10', 150], ['remada-curvada-barra-pronada', 4, '8-10', 120], ['puxada-triangulo', 3, '10-12', 90], ['remada-unilateral-halter-serrote', 3, '10-12', 90],
        ['pulldown-bracos-estendidos', 3, '12-15', 60], ['hiperextensao-lombar-banco-romano', 3, '12-15', 60],
      ]),
      dia('C: Pernas', 'Pernas completas', [
        ['agachamento-livre-barra', 4, '6-10', 180], ['leg-press-45', 4, '10-12', 120], ['levantamento-terra-romeno', 4, '8-10', 120], ['cadeira-extensora', 3, '12-15', 60],
        ['mesa-flexora', 3, '10-12', 60], ['elevacao-pelvica-barra', 3, '8-12', 90], ['panturrilha-em-pe-maquina', 4, '10-15', 60],
      ]),
      dia('D: Ombros', 'Ombros e trapézio', [
        ['desenvolvimento-militar-barra-em-pe', 4, '6-10', 150], ['elevacao-lateral-halteres', 4, '12-15', 60], ['elevacao-lateral-polia', 3, '12-15', 60],
        ['crucifixo-inverso-halteres', 3, '12-15', 60], ['encolhimento-barra', 4, '10-12', 75],
      ]),
      dia('E: Braços e abdômen', 'Bíceps, tríceps e abdômen', [
        ['rosca-direta-barra-reta', 4, '8-10', 75], ['supino-fechado-barra', 4, '8-10', 90], ['rosca-scott-barra-w', 3, '10-12', 60], ['triceps-testa-barra-w', 3, '10-12', 60],
        ['rosca-martelo-halteres', 3, '10-12', 60], ['triceps-pulley-corda', 3, '12-15', 60], ['abdominal-polia-ajoelhado', 3, '12-15', 45], ['elevacao-pernas-barra-fixa', 3, '8-12', 60],
      ]),
    ],
  },
  {
    id: 'gluteos-pernas', nome: 'Glúteos e pernas em foco', nivel: 2, diasSemana: 3,
    desc: 'Dois treinos de inferiores (um com ênfase em glúteos, outro em quadríceps) e um de superiores.',
    agenda: [0, 2, 1], dias: [
      dia('A: Glúteos e posteriores', 'Glúteos e posteriores de coxa', [
        ['elevacao-pelvica-barra', 3, '8-12', 120], ['levantamento-terra-romeno', 3, '8-10', 120], ['agachamento-bulgaro-halteres', 2, '10-12', 90],
        ['mesa-flexora', 3, '10-12', 60], ['cadeira-abdutora', 3, '12-15', 60], ['coice-polia', 2, '12-15', 45],
      ]),
      dia('B: Quadríceps e glúteos', 'Quadríceps, glúteos e panturrilhas', [
        ['agachamento-livre-barra', 4, '8-10', 150], ['leg-press-45', 2, '10-12', 120],
        ['cadeira-extensora', 3, '12-15', 60], ['cadeira-adutora', 3, '12-15', 60], ['panturrilha-em-pe-maquina', 3, '10-15', 60], ['prancha-frontal', 3, '30', 45],
      ]),
      dia('C: Superiores', 'Costas, peito, ombros e braços', [
        ['puxada-frente-aberta', 3, '10-12', 90], ['supino-maquina', 4, '10-12', 90], ['remada-baixa-triangulo', 3, '10-12', 90], ['desenvolvimento-halteres-sentado', 3, '10-12', 90],
        ['elevacao-lateral-halteres', 3, '12-15', 60], ['triceps-pulley-corda', 2, '12-15', 60], ['rosca-simultanea-halteres', 2, '12-15', 60],
      ]),
    ],
  },
  {
    id: 'casa-halteres', nome: 'Em casa com halteres', nivel: 1, diasSemana: 3,
    desc: 'Dois treinos de corpo inteiro que usam só halteres, um banco com encosto regulável e um colchonete.',
    agenda: [0, 1, 0], dias: [
      // só exercícios de nível 1: o bom-dia sem carga ensina o movimento do stiff, e a elevação frontal faz o papel do desenvolvimento
      dia('Treino A', 'Pernas, peito, costas e abdômen', [
        ['agachamento-goblet', 3, '10-12', 90], ['flexao-inclinada-maos-no-banco', 3, '8-15', 75], ['remada-unilateral-halter-serrote', 3, '10-12', 75],
        ['bom-dia-peso-corporal', 2, '10-12', 60], ['elevacao-frontal-halteres', 2, '10-12', 60], ['prancha-frontal', 2, '30', 45],
      ]),
      dia('Treino B', 'Pernas, costas, peito, ombros e braços', [
        ['agachamento-sumo-halter', 2, '12-15', 90], ['remada-halteres-banco-inclinado', 3, '10-12', 90], ['flexao-de-bracos', 3, '8-15', 75],
        ['elevacao-lateral-halteres', 2, '12-15', 60], ['rosca-simultanea-halteres', 2, '10-12', 60], ['triceps-coice-halter', 2, '10-12', 60], ['abdominal-supra-solo', 2, '12-15', 45],
      ]),
    ],
  },
  {
    id: 'peso-corporal', nome: 'Só com o peso do corpo', nivel: 1, diasSemana: 3,
    desc: 'Sem aparelhos: para casa, parque ou viagem. Use uma cadeira ou degrau firme. As costas entram com a puxada de bruços; se tiver uma barra, acrescente remadas.',
    agenda: [0, 1, 0], dias: [
      dia('Treino A', 'Pernas, peito, costas e abdômen', [
        ['agachamento-peso-corporal', 3, '12-20', 60], ['flexao-de-bracos-joelhos', 3, '8-15', 60], ['ponte-gluteos-solo', 2, '12-20', 60],
        ['puxada-de-brucos', 3, '10-15', 60], ['prancha-frontal', 2, '30', 45], ['abdominal-supra-solo', 2, '12-20', 45],
      ]),
      dia('Treino B', 'Pernas, peito, lombar e condicionamento', [
        ['subida-caixote', 2, '10-12', 60], ['flexao-inclinada-maos-no-banco', 2, '10-15', 60], ['abducao-quadril-deitado-lado', 2, '12-15', 45],
        ['perdigueiro', 2, '10-12', 45], ['abdominal-obliquo-cruzado', 2, '10-12', 45], ['polichinelo-sem-salto', 3, '30', 45],
      ]),
    ],
  },
];

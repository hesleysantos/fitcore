// Aparelhos e acessórios de academia. O usuário marca o que a academia dele tem
// ("Minha academia") e o app filtra os exercícios possíveis.

export const CATEGORIAS_EQUIP = {
  livres: 'Pesos livres',
  bancos: 'Bancos e suportes',
  maquinas_sup: 'Máquinas de tronco e membros superiores',
  maquinas_inf: 'Máquinas de membros inferiores',
  cabos: 'Cabos e polias',
  corporal: 'Barras e apoios de peso corporal',
  cardio: 'Cardio',
  acessorios: 'Acessórios',
};

export const EQUIPAMENTOS = {
  // Pesos livres
  barra: { nome: 'Barra reta e anilhas', cat: 'livres' },
  barra_w: { nome: 'Barra W (EZ)', cat: 'livres' },
  halteres: { nome: 'Halteres', cat: 'livres' },
  kettlebell: { nome: 'Kettlebell', cat: 'livres' },
  anilha: { nome: 'Anilha avulsa', cat: 'livres' },
  barra_hexagonal: { nome: 'Barra hexagonal (trap bar)', cat: 'livres' },
  landmine: { nome: 'Landmine (barra com apoio no chão)', cat: 'livres' },

  // Bancos e suportes
  banco_reto: { nome: 'Banco reto', cat: 'bancos' },
  banco_inclinado: { nome: 'Banco inclinado / regulável', cat: 'bancos' },
  banco_declinado: { nome: 'Banco declinado', cat: 'bancos' },
  rack: { nome: 'Rack / gaiola de agachamento', cat: 'bancos' },
  smith: { nome: 'Smith (barra guiada)', cat: 'bancos' },
  banco_scott: { nome: 'Banco Scott', cat: 'bancos' },
  banco_romano: { nome: 'Banco romano (hiperextensão 45°)', cat: 'bancos' },
  banco_abdominal: { nome: 'Banco abdominal declinado', cat: 'bancos' },
  banco_ghd: { nome: 'Banco GHD (glute-ham)', cat: 'bancos', raro: true },
  banco_sissy: { nome: 'Banco de sissy squat', cat: 'bancos', raro: true },

  // Máquinas — superiores
  supino_maquina: { nome: 'Supino máquina (chest press)', cat: 'maquinas_sup' },
  peck_deck: { nome: 'Peck deck / voador', cat: 'maquinas_sup' },
  desenvolvimento_maquina: { nome: 'Desenvolvimento máquina', cat: 'maquinas_sup' },
  elevacao_lateral_maquina: { nome: 'Elevação lateral máquina', cat: 'maquinas_sup' },
  remada_maquina: { nome: 'Remada máquina', cat: 'maquinas_sup' },
  remada_cavalinho: { nome: 'Remada cavalinho (barra T)', cat: 'maquinas_sup' },
  puxada_articulada_frente: { nome: 'Puxada alta articulada (de frente para o aparelho)', cat: 'maquinas_sup' },
  pulldown_maquina: { nome: 'Puxada articulada de costas para o aparelho (tipo Hammer)', cat: 'maquinas_sup', raro: true },
  pullover_maquina: { nome: 'Pullover máquina', cat: 'maquinas_sup' },
  rosca_maquina: { nome: 'Rosca bíceps máquina', cat: 'maquinas_sup' },
  triceps_maquina: { nome: 'Tríceps máquina', cat: 'maquinas_sup' },
  graviton: { nome: 'Graviton (barra e paralela assistidas)', cat: 'maquinas_sup' },
  abdominal_maquina: { nome: 'Abdominal máquina', cat: 'maquinas_sup' },
  lombar_maquina: { nome: 'Extensão lombar máquina', cat: 'maquinas_sup' },
  supino_declinado_maquina: { nome: 'Supino declinado máquina (articulado)', cat: 'maquinas_sup', raro: true },
  puxada_alta_articulada: { nome: 'Remada alta articulada (high row, com apoio de peito)', cat: 'maquinas_sup' },
  remada_baixa_articulada: { nome: 'Remada baixa articulada (low row)', cat: 'maquinas_sup' },
  mergulho_maquina: { nome: 'Mergulho sentado máquina (seated dip)', cat: 'maquinas_sup', raro: true },
  encolhimento_maquina: { nome: 'Encolhimento máquina (shrug)', cat: 'maquinas_sup', raro: true },
  rotacao_tronco_maquina: { nome: 'Rotação de tronco máquina (rotary torso)', cat: 'maquinas_sup', raro: true },
  remada_t_apoio: { nome: 'Remada cavalinho com apoio de peito (incline lever row)', cat: 'maquinas_sup' },

  // Máquinas — inferiores
  leg_press_45: { nome: 'Leg press 45°', cat: 'maquinas_inf' },
  leg_press_horizontal: { nome: 'Leg press horizontal', cat: 'maquinas_inf' },
  hack: { nome: 'Hack machine', cat: 'maquinas_inf' },
  cadeira_extensora: { nome: 'Cadeira extensora', cat: 'maquinas_inf' },
  mesa_flexora: { nome: 'Mesa flexora', cat: 'maquinas_inf' },
  cadeira_flexora: { nome: 'Cadeira flexora', cat: 'maquinas_inf' },
  flexora_em_pe: { nome: 'Flexora em pé (unilateral)', cat: 'maquinas_inf' },
  cadeira_adutora: { nome: 'Cadeira adutora', cat: 'maquinas_inf' },
  cadeira_abdutora: { nome: 'Cadeira abdutora', cat: 'maquinas_inf' },
  gluteo_maquina: { nome: 'Glúteo máquina (coice)', cat: 'maquinas_inf' },
  elevacao_pelvica_maquina: { nome: 'Elevação pélvica máquina', cat: 'maquinas_inf' },
  panturrilha_sentado: { nome: 'Panturrilha sentado (máquina)', cat: 'maquinas_inf' },
  panturrilha_em_pe: { nome: 'Panturrilha em pé (máquina)', cat: 'maquinas_inf' },
  panturrilha_burrinho: { nome: 'Panturrilha burrinho (máquina)', cat: 'maquinas_inf', raro: true },
  agachamento_pendulo: { nome: 'Agachamento pêndulo', cat: 'maquinas_inf', raro: true },
  belt_squat: { nome: 'Agachamento com cinto (belt squat)', cat: 'maquinas_inf', raro: true },
  leg_press_vertical: { nome: 'Leg press vertical', cat: 'maquinas_inf', raro: true },
  multi_hip: { nome: 'Multi-hip (quadril em pé, com rolo)', cat: 'maquinas_inf', raro: true },
  agachamento_articulado: { nome: 'Agachamento articulado (V-squat)', cat: 'maquinas_inf' },
  abdutora_em_pe: { nome: 'Abdutora em pé (standing abductor)', cat: 'maquinas_inf', raro: true },
  hiperextensao_reversa: { nome: 'Hiperextensão reversa (reverse hyper)', cat: 'maquinas_inf', raro: true },

  // Cabos
  crossover: { nome: 'Polia ajustável / crossover (polia alta e baixa)', cat: 'cabos' },
  puxador: { nome: 'Puxador alto (pulley)', cat: 'cabos' },
  remada_baixa: { nome: 'Remada baixa (polia sentada)', cat: 'cabos' },

  // Peso corporal
  barra_fixa: { nome: 'Barra fixa', cat: 'corporal' },
  paralelas: { nome: 'Barras paralelas', cat: 'corporal' },
  paralela_abdominal: { nome: 'Paralela abdominal (cadeira do capitão)', cat: 'corporal' },
  trx: { nome: 'Fita de suspensão (TRX)', cat: 'corporal' },

  // Cardio
  esteira: { nome: 'Esteira', cat: 'cardio' },
  bicicleta: { nome: 'Bicicleta ergométrica', cat: 'cardio' },
  eliptico: { nome: 'Elíptico (transport)', cat: 'cardio' },
  remo_ergometro: { nome: 'Remo ergômetro', cat: 'cardio' },
  escada: { nome: 'Simulador de escada', cat: 'cardio' },
  air_bike: { nome: 'Air bike', cat: 'cardio' },
  bicicleta_reclinada: { nome: 'Bicicleta reclinada (horizontal)', cat: 'cardio' },
  esteira_curva: { nome: 'Esteira curva (sem motor)', cat: 'cardio', raro: true },
  simulador_esqui: { nome: 'Simulador de esqui (SkiErg)', cat: 'cardio', raro: true },
  ergometro_braco: { nome: 'Ergômetro de braço (bicicleta de braço)', cat: 'cardio', raro: true },

  // Acessórios
  colchonete: { nome: 'Colchonete', cat: 'acessorios' },
  caixa: { nome: 'Caixa / step', cat: 'acessorios' },
  bola_suica: { nome: 'Bola suíça', cat: 'acessorios' },
  medicine_ball: { nome: 'Medicine ball', cat: 'acessorios' },
  roda_abdominal: { nome: 'Roda abdominal', cat: 'acessorios' },
  elastico: { nome: 'Elástico / mini band', cat: 'acessorios' },
  corda_pular: { nome: 'Corda de pular', cat: 'acessorios' },
  corda_naval: { nome: 'Corda naval', cat: 'acessorios' },
  treno: { nome: 'Trenó (sled)', cat: 'acessorios' },
  rolo_punho: { nome: 'Rolo de punho (wrist roller)', cat: 'acessorios', raro: true },
};

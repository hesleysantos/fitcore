// Tabela de alimentos do app (uso offline).
// Valores por 100 g (ou 100 mL para líquidos), no estado descrito no nome. Os valores da TACO foram conferidos, linha a
// linha, na Tabela 1 da 4ª edição (PDF do NEPA/UNICAMP) em novembro de 2026.
// Fontes:
//   TACO — Tabela Brasileira de Composição de Alimentos, 4ª ed. rev. e ampl., NEPA/UNICAMP, 2011 (fonte principal).
//   TBCA — Tabela Brasileira de Composição de Alimentos, USP/FoRC (tbca.net.br) — itens ausentes na TACO.
//   USDA — FoodData Central, SR Legacy (fdc.nal.usda.gov) — itens ausentes na TACO.
//   IBGE — POF 2008-2009, "Tabelas de composição nutricional dos alimentos consumidos no Brasil", Tabela 1 (PDF lido em
//          nov/2026; o código do IBGE vai no comentário da linha) — preparações prontas: café com leite, sucos, sanduíches.
// Alimentos com `soDiario` (refrigerantes, salgados, doces, bebidas com açúcar) servem só para registrar no diário: o
// cardápio de exemplo nunca os usa (logic/nutrition.js).
// "c" é o carboidrato total (inclui a fibra), como na TACO. Traços (Tr) e "não aplicável" (NA) foram gravados como 0.
// Itens da USDA conferidos na FoodData Central em nov/2026: pão de forma = "Bread, white, commercially prepared" (FDC 174924);
// salsicha = "Frankfurter, pork" (FDC 172964).
// Porções caseiras são aproximações usuais. NOVA: 1 in natura/minimamente processado, 2 ingrediente culinário,
// 3 processado, 4 ultraprocessado.

export const CATEGORIAS_ALIMENTO = {
  cereais: 'Cereais, pães e massas',
  tuberculos: 'Raízes e tubérculos',
  leguminosas: 'Feijões e leguminosas',
  carnes: 'Carnes e aves',
  peixes: 'Peixes e frutos do mar',
  ovos_laticinios: 'Ovos e laticínios',
  frutas: 'Frutas',
  hortalicas: 'Verduras e legumes',
  gorduras: 'Castanhas, sementes e gorduras',
  bebidas: 'Bebidas',
  outros: 'Outros',
};

export const ALIMENTOS = [
  // ---- Cereais, pães e massas ----
  { id: 'arroz-branco-cozido', nome: 'Arroz branco cozido', cat: 'cereais', kcal: 128, p: 2.5, c: 28.1, g: 0.2, fibra: 1.6, porcao: { g: 125, desc: '4 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'arroz-integral-cozido', nome: 'Arroz integral cozido', cat: 'cereais', kcal: 124, p: 2.6, c: 25.8, g: 1, fibra: 2.7, porcao: { g: 125, desc: '4 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'macarrao-cozido', nome: 'Macarrão cozido', cat: 'cereais', kcal: 101, p: 3.7, c: 21, g: 0.5, fibra: 1.2, porcao: { g: 110, desc: '1 pegador' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose'], papel: 'carbo', fonte: 'TBCA' },
  { id: 'pao-frances', nome: 'Pão francês', cat: 'cereais', kcal: 300, p: 8, c: 58.6, g: 3.1, fibra: 2.3, porcao: { g: 50, desc: '1 unidade' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose'], papel: 'carbo', fonte: 'TACO' },
  { id: 'pao-de-forma-integral', nome: 'Pão de forma integral', cat: 'cereais', kcal: 253, p: 9.4, c: 49.9, g: 3.7, fibra: 6.9, porcao: { g: 50, desc: '2 fatias' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'aveia-em-flocos', nome: 'Aveia em flocos', cat: 'cereais', kcal: 394, p: 13.9, c: 66.6, g: 8.5, fibra: 9.1, porcao: { g: 30, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose'], papel: 'carbo', fonte: 'TACO' },
  { id: 'tapioca-pronta', nome: 'Tapioca pronta (sem recheio)', cat: 'cereais', kcal: 288, p: 0.4, c: 71.9, g: 0, fibra: 0.2, porcao: { g: 50, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TBCA' },
  { id: 'cuscuz-de-milho-cozido', nome: 'Cuscuz de milho cozido', cat: 'cereais', kcal: 113, p: 2.2, c: 25.3, g: 0.7, fibra: 2.1, porcao: { g: 100, desc: '1 fatia média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'granola', nome: 'Granola com mel', cat: 'cereais', kcal: 410, p: 10.7, c: 61.8, g: 15.1, fibra: 7.8, porcao: { g: 40, desc: '1/2 xícara de chá' }, nova: 3, tags: ['vegetariano', 'sem_lactose'], papel: 'carbo', fonte: 'TBCA' },
  { id: 'pipoca-com-oleo', nome: 'Pipoca estourada com óleo, sem sal', cat: 'cereais', kcal: 448, p: 9.9, c: 70.3, g: 15.9, fibra: 14.3, porcao: { g: 25, desc: '2 xícaras de chá' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'milho-verde-enlatado', nome: 'Milho verde em conserva (drenado)', cat: 'cereais', kcal: 98, p: 3.2, c: 17.1, g: 2.4, fibra: 4.6, porcao: { g: 60, desc: '3 colheres de sopa' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'farinha-de-mandioca-torrada', nome: 'Farinha de mandioca torrada', cat: 'cereais', kcal: 365, p: 1.2, c: 89.2, g: 0.3, fibra: 6.5, porcao: { g: 30, desc: '2 colheres de sopa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'biscoito-cream-cracker', nome: 'Biscoito cream cracker', cat: 'cereais', kcal: 432, p: 10.1, c: 68.7, g: 14.4, fibra: 2.5, porcao: { g: 30, desc: '5 unidades' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'cereal-matinal-de-milho', nome: 'Cereal matinal de milho', cat: 'cereais', kcal: 365, p: 7.2, c: 83.8, g: 1, fibra: 4.1, porcao: { g: 30, desc: '3/4 de xícara de chá' }, nova: 4, tags: ['vegetariano', 'sem_lactose'], papel: 'carbo', fonte: 'TACO' },
  { id: 'quinoa-cozida', nome: 'Quinoa cozida', cat: 'cereais', kcal: 120, p: 4.4, c: 21.3, g: 1.9, fibra: 2.8, porcao: { g: 100, desc: '4 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'USDA' },
  { id: 'pao-de-queijo-assado', nome: 'Pão de queijo assado', cat: 'cereais', kcal: 363, p: 5.1, c: 34.2, g: 24.6, fibra: 0.6, porcao: { g: 40, desc: '1 unidade média' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'pao-de-forma', nome: 'Pão de forma tradicional', cat: 'cereais', kcal: 266, p: 8.9, c: 49.4, g: 3.3, fibra: 2.7, porcao: { g: 50, desc: '2 fatias' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'USDA' },
  { id: 'torrada', nome: 'Torrada de pão francês', cat: 'cereais', kcal: 377, p: 10.5, c: 74.6, g: 3.3, fibra: 3.4, porcao: { g: 30, desc: '3 unidades' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose'], papel: 'carbo', fonte: 'TACO' },
  { id: 'macarrao-instantaneo', nome: 'Macarrão instantâneo (seco)', cat: 'cereais', kcal: 436, p: 8.8, c: 62.4, g: 17.2, fibra: 5.6, porcao: { g: 85, desc: '1 pacote' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'biscoito-maisena', nome: 'Biscoito maisena', cat: 'cereais', kcal: 443, p: 8.1, c: 75.2, g: 12, fibra: 2.1, porcao: { g: 30, desc: '6 unidades' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'biscoito-recheado', nome: 'Biscoito recheado de chocolate', cat: 'cereais', kcal: 472, p: 6.4, c: 70.5, g: 19.6, fibra: 3, porcao: { g: 30, desc: '3 unidades' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'biscoito-de-polvilho', nome: 'Biscoito de polvilho', cat: 'cereais', kcal: 438, p: 1.3, c: 80.5, g: 12.2, fibra: 1.2, porcao: { g: 30, desc: '1 xícara de chá' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'bolo-de-milho', nome: 'Bolo de milho (simples)', cat: 'cereais', kcal: 311, p: 4.8, c: 45.1, g: 12.4, fibra: 0.7, porcao: { g: 60, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'bolo-de-chocolate', nome: 'Bolo de chocolate', cat: 'cereais', kcal: 410, p: 6.2, c: 54.7, g: 18.5, fibra: 1.4, porcao: { g: 60, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'polenta-cozida', nome: 'Polenta cozida (angu)', cat: 'cereais', kcal: 103, p: 2.3, c: 23.3, g: 0.3, fibra: 2.4, porcao: { g: 150, desc: '3 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'canjica-com-leite', nome: 'Canjica com leite (mungunzá)', cat: 'cereais', kcal: 112, p: 2.4, c: 23.6, g: 1.2, fibra: 1.2, porcao: { g: 150, desc: '1 xícara de chá' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'lasanha-massa-cozida', nome: 'Massa de lasanha cozida', cat: 'cereais', kcal: 164, p: 5.8, c: 32.5, g: 1.2, fibra: 1.6, porcao: { g: 100, desc: '1 pedaço médio' }, nova: 3, tags: ['vegetariano', 'sem_lactose'], papel: 'carbo', fonte: 'TACO' },
  { id: 'nhoque-de-batata-cozido', nome: 'Nhoque de batata cozido', cat: 'cereais', kcal: 181, p: 5.9, c: 36.8, g: 1.9, fibra: 1.8, porcao: { g: 150, desc: '1 escumadeira média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'macarrao-a-bolonhesa', nome: 'Macarrão à bolonhesa', cat: 'cereais', kcal: 120, p: 4.9, c: 22.5, g: 0.9, fibra: 0.8, porcao: { g: 220, desc: '2 pegadores' }, nova: 3, tags: ['sem_lactose'], papel: 'carbo', fonte: 'TACO' },
  { id: 'baiao-de-dois', nome: 'Baião de dois', cat: 'cereais', kcal: 136, p: 6.2, c: 20.4, g: 3.2, fibra: 5.1, porcao: { g: 150, desc: '5 colheres de sopa cheias' }, nova: 3, tags: ['sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'milho-verde-espiga', nome: 'Milho verde (espiga)', cat: 'cereais', kcal: 138, p: 6.6, c: 28.6, g: 0.6, fibra: 3.9, porcao: { g: 100, desc: '1 espiga média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'pamonha', nome: 'Pamonha', cat: 'cereais', kcal: 171, p: 2.6, c: 30.7, g: 4.8, fibra: 2.4, porcao: { g: 150, desc: '1 unidade' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },

  // ---- Raízes e tubérculos ----
  { id: 'batata-inglesa-cozida', nome: 'Batata inglesa cozida', cat: 'tuberculos', kcal: 52, p: 1.2, c: 11.9, g: 0, fibra: 1.3, porcao: { g: 140, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'batata-inglesa-assada', nome: 'Batata inglesa assada', cat: 'tuberculos', kcal: 89, p: 2.5, c: 20.3, g: 0.1, fibra: 1.6, porcao: { g: 140, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TBCA' },
  { id: 'batata-inglesa-frita', nome: 'Batata inglesa frita', cat: 'tuberculos', kcal: 267, p: 5, c: 35.6, g: 13.1, fibra: 8.1, porcao: { g: 65, desc: '1 escumadeira média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'batata-doce-cozida', nome: 'Batata-doce cozida', cat: 'tuberculos', kcal: 77, p: 0.6, c: 18.4, g: 0.1, fibra: 2.2, porcao: { g: 130, desc: '1 unidade pequena' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'mandioca-cozida', nome: 'Mandioca (aipim/macaxeira) cozida', cat: 'tuberculos', kcal: 125, p: 0.6, c: 30.1, g: 0.3, fibra: 1.6, porcao: { g: 100, desc: '2 pedaços médios' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'inhame-cozido', nome: 'Inhame cozido', cat: 'tuberculos', kcal: 89, p: 2.3, c: 20.5, g: 0.1, fibra: 1.6, porcao: { g: 100, desc: '2 pedaços médios' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TBCA' },
  { id: 'mandioquinha-cozida', nome: 'Mandioquinha (batata-baroa) cozida', cat: 'tuberculos', kcal: 80, p: 0.9, c: 18.9, g: 0.2, fibra: 1.8, porcao: { g: 100, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'cara-cozido', nome: 'Cará cozido', cat: 'tuberculos', kcal: 78, p: 1.5, c: 18.9, g: 0.1, fibra: 2.6, porcao: { g: 100, desc: '2 pedaços médios' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'mandioca-frita', nome: 'Mandioca (aipim/macaxeira) frita', cat: 'tuberculos', kcal: 300, p: 1.4, c: 50.3, g: 11.2, fibra: 1.9, porcao: { g: 100, desc: '5 pedaços médios' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'batata-saute', nome: 'Batata sauté', cat: 'tuberculos', kcal: 68, p: 1.3, c: 14.1, g: 0.9, fibra: 1.4, porcao: { g: 140, desc: '4 colheres de sopa cheias' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'batata-chips', nome: 'Batata frita tipo chips (pacote)', cat: 'tuberculos', kcal: 543, p: 5.6, c: 51.2, g: 36.6, fibra: 2.5, porcao: { g: 25, desc: '1 xícara de chá' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'pinhao-cozido', nome: 'Pinhão cozido', cat: 'tuberculos', kcal: 174, p: 3, c: 43.9, g: 0.7, fibra: 15.6, porcao: { g: 60, desc: '10 unidades' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },

  // ---- Feijões e leguminosas ----
  { id: 'feijao-carioca-cozido', nome: 'Feijão carioca cozido', cat: 'leguminosas', kcal: 76, p: 4.8, c: 13.6, g: 0.5, fibra: 8.5, porcao: { g: 100, desc: '1 concha média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'feijao-preto-cozido', nome: 'Feijão preto cozido', cat: 'leguminosas', kcal: 77, p: 4.5, c: 14, g: 0.5, fibra: 8.4, porcao: { g: 100, desc: '1 concha média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'lentilha-cozida', nome: 'Lentilha cozida', cat: 'leguminosas', kcal: 93, p: 6.3, c: 16.3, g: 0.5, fibra: 7.9, porcao: { g: 160, desc: '1 concha média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'grao-de-bico-cozido', nome: 'Grão-de-bico cozido', cat: 'leguminosas', kcal: 114, p: 7.5, c: 20.7, g: 1.8, fibra: 7.4, porcao: { g: 100, desc: '4 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TBCA' },
  { id: 'ervilha-enlatada', nome: 'Ervilha em conserva (drenada)', cat: 'leguminosas', kcal: 74, p: 4.6, c: 13.4, g: 0.4, fibra: 5.1, porcao: { g: 50, desc: '2 colheres de sopa' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'soja-cozida', nome: 'Soja em grão cozida', cat: 'leguminosas', kcal: 168, p: 16.2, c: 9.5, g: 9.3, fibra: 8.9, porcao: { g: 100, desc: '4 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TBCA' },
  { id: 'tofu', nome: 'Tofu', cat: 'leguminosas', kcal: 64, p: 6.6, c: 2.1, g: 4, fibra: 0.8, porcao: { g: 100, desc: '1 fatia grossa' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  // a proteína de soja como se come (hidratada e refogada): composição da POF 2008-2009, código 6505601 ("proteína de soja")
  { id: 'proteina-de-soja-preparada', nome: 'Proteína de soja (carne de soja) refogada', cat: 'leguminosas', kcal: 142.37, p: 18.51, c: 5.8, g: 5.32, fibra: 0.44, porcao: { g: 96, desc: '2 colheres de servir' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'IBGE' },
  { id: 'proteina-de-soja-texturizada', nome: 'Proteína de soja texturizada(seca)', cat: 'leguminosas', kcal: 336, p: 45.9, c: 41, g: 0.6, fibra: 8.5, porcao: { g: 25, desc: '1/2 xícara de chá' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TBCA' },
  { id: 'feijao-fradinho-cozido', nome: 'Feijão-fradinho (de corda) cozido', cat: 'leguminosas', kcal: 78, p: 5.1, c: 13.5, g: 0.6, fibra: 7.5, porcao: { g: 100, desc: '1 concha média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'feijao-roxo-cozido', nome: 'Feijão roxo cozido', cat: 'leguminosas', kcal: 77, p: 5.7, c: 12.9, g: 0.5, fibra: 11.5, porcao: { g: 100, desc: '1 concha média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'feijao-jalo-cozido', nome: 'Feijão jalo cozido', cat: 'leguminosas', kcal: 93, p: 6.1, c: 16.5, g: 0.5, fibra: 13.9, porcao: { g: 100, desc: '1 concha média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'feijoada', nome: 'Feijoada', cat: 'leguminosas', kcal: 117, p: 8.7, c: 11.6, g: 6.5, fibra: 5.1, porcao: { g: 200, desc: '2 conchas médias' }, nova: 3, tags: ['sem_lactose'], papel: 'proteina', fonte: 'TACO' },
  // feijão-tropeiro e feijoada: energia como a TACO publica (linhas 539 e 540: 152 e 117 kcal). A soma 4-4-9 dos
  // macronutrientes daria 180 e 140: a TACO usa fatores de Atwater específicos e carboidrato por diferença, com a fibra.
  { id: 'feijao-tropeiro', nome: 'Feijão-tropeiro', cat: 'leguminosas', kcal: 152, p: 10.2, c: 19.6, g: 6.8, fibra: 3.6, porcao: { g: 150, desc: '5 colheres de sopa cheias' }, nova: 3, tags: ['sem_lactose'], papel: 'carbo', fonte: 'TACO' },
  { id: 'ervilha-fresca', nome: 'Ervilha fresca (em vagem)', cat: 'leguminosas', kcal: 88, p: 7.5, c: 14.2, g: 0.5, fibra: 9.7, porcao: { g: 60, desc: '3 colheres de sopa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },

  // ---- Carnes e aves ----
  { id: 'peito-de-frango-grelhado', nome: 'Peito de frango grelhado (sem pele)', cat: 'carnes', kcal: 159, p: 32, c: 0, g: 2.5, fibra: 0, porcao: { g: 100, desc: '1 filé médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'peito-de-frango-cozido', nome: 'Peito de frango cozido (sem pele)', cat: 'carnes', kcal: 163, p: 31.5, c: 0, g: 3.2, fibra: 0, porcao: { g: 100, desc: '4 colheres de sopa cheias (desfiado)' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'sobrecoxa-de-frango-assada-sem-pele', nome: 'Sobrecoxa de frango assada (sem pele)', cat: 'carnes', kcal: 233, p: 29.2, c: 0, g: 12, fibra: 0, porcao: { g: 100, desc: '1 unidade grande' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'patinho-grelhado', nome: 'Patinho grelhado (sem gordura)', cat: 'carnes', kcal: 219, p: 35.9, c: 0, g: 7.3, fibra: 0, porcao: { g: 100, desc: '1 bife médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'carne-moida-cozida', nome: 'Carne moída (acém) cozida', cat: 'carnes', kcal: 212, p: 26.7, c: 0, g: 10.9, fibra: 0, porcao: { g: 100, desc: '4 colheres de sopa cheias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'alcatra-grelhada', nome: 'Alcatra grelhada (sem gordura)', cat: 'carnes', kcal: 241, p: 31.9, c: 0, g: 11.6, fibra: 0, porcao: { g: 100, desc: '1 bife médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'contrafile-grelhado', nome: 'Contrafilé grelhado (sem gordura)', cat: 'carnes', kcal: 194, p: 35.9, c: 0, g: 4.5, fibra: 0, porcao: { g: 100, desc: '1 bife médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'coxao-mole-cozido', nome: 'Coxão mole cozido (sem gordura)', cat: 'carnes', kcal: 219, p: 32.4, c: 0, g: 8.9, fibra: 0, porcao: { g: 100, desc: '1 bife médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'file-mignon-grelhado', nome: 'Filé-mignon grelhado (sem gordura)', cat: 'carnes', kcal: 220, p: 32.8, c: 0, g: 8.8, fibra: 0, porcao: { g: 100, desc: '1 bife médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'picanha-grelhada', nome: 'Picanha grelhada (com gordura)', cat: 'carnes', kcal: 289, p: 26.4, c: 0, g: 19.5, fibra: 0, porcao: { g: 100, desc: '2 fatias médias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'figado-bovino-grelhado', nome: 'Fígado bovino grelhado', cat: 'carnes', kcal: 225, p: 29.9, c: 4.2, g: 9, fibra: 0, porcao: { g: 100, desc: '1 bife médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'lombo-suino-assado', nome: 'Lombo suíno assado', cat: 'carnes', kcal: 210, p: 35.7, c: 0, g: 6.4, fibra: 0, porcao: { g: 100, desc: '2 fatias médias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'pernil-suino-assado', nome: 'Pernil suíno assado', cat: 'carnes', kcal: 262, p: 32.1, c: 0, g: 13.9, fibra: 0, porcao: { g: 100, desc: '2 fatias médias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'peito-de-peru-defumado', nome: 'Peito de peru defumado (fatiado)', cat: 'carnes', kcal: 124, p: 19.6, c: 2.9, g: 3.8, fibra: 0, porcao: { g: 30, desc: '2 fatias' }, nova: 4, tags: [], papel: 'proteina', fonte: 'TBCA' },
  { id: 'presunto-cozido', nome: 'Presunto cozido (sem capa de gordura)', cat: 'carnes', kcal: 94, p: 14.3, c: 2.1, g: 2.7, fibra: 0, porcao: { g: 30, desc: '2 fatias' }, nova: 4, tags: [], papel: 'proteina', fonte: 'TACO' },
  { id: 'carne-seca-cozida', nome: 'Carne-seca cozida', cat: 'carnes', kcal: 313, p: 26.9, c: 0, g: 21.9, fibra: 0, porcao: { g: 50, desc: '2 colheres de sopa cheias (desfiada)' }, nova: 3, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'linguica-de-porco-grelhada', nome: 'Linguiça de porco grelhada', cat: 'carnes', kcal: 296, p: 23.2, c: 0, g: 21.9, fibra: 0, porcao: { g: 60, desc: '1 gomo' }, nova: 4, tags: [], papel: 'proteina', fonte: 'TACO' },
  { id: 'coxa-de-frango-cozida', nome: 'Coxa de frango cozida (sem pele)', cat: 'carnes', kcal: 167, p: 26.9, c: 0, g: 5.8, fibra: 0, porcao: { g: 90, desc: '2 unidades médias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'coxa-de-frango-assada-com-pele', nome: 'Coxa de frango assada (com pele)', cat: 'carnes', kcal: 215, p: 28.5, c: 0.1, g: 10.4, fibra: 0, porcao: { g: 100, desc: '2 unidades médias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'sobrecoxa-de-frango-assada-com-pele', nome: 'Sobrecoxa de frango assada (com pele)', cat: 'carnes', kcal: 260, p: 28.7, c: 0, g: 15.2, fibra: 0, porcao: { g: 100, desc: '1 unidade grande' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'frango-assado-sem-pele', nome: 'Frango assado (sem pele)', cat: 'carnes', kcal: 187, p: 28, c: 0, g: 7.5, fibra: 0, porcao: { g: 100, desc: '1 pedaço médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'file-de-frango-a-milanesa', nome: 'Filé de frango à milanesa', cat: 'carnes', kcal: 221, p: 28.5, c: 7.5, g: 7.8, fibra: 1.1, porcao: { g: 100, desc: '1 filé médio' }, nova: 3, tags: ['sem_lactose'], papel: 'proteina', fonte: 'TACO' },
  { id: 'coracao-de-frango-grelhado', nome: 'Coração de frango grelhado', cat: 'carnes', kcal: 207, p: 22.4, c: 0.6, g: 12.1, fibra: 0, porcao: { g: 60, desc: '10 unidades' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'musculo-bovino-cozido', nome: 'Músculo bovino cozido (sem gordura)', cat: 'carnes', kcal: 194, p: 31.2, c: 0, g: 6.7, fibra: 0, porcao: { g: 100, desc: '4 colheres de sopa cheias (picado)' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'acem-cozido', nome: 'Acém cozido (sem gordura)', cat: 'carnes', kcal: 215, p: 27.3, c: 0, g: 10.9, fibra: 0, porcao: { g: 100, desc: '1 pedaço médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'lagarto-cozido', nome: 'Lagarto cozido', cat: 'carnes', kcal: 222, p: 32.9, c: 0, g: 9.1, fibra: 0, porcao: { g: 100, desc: '2 fatias médias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'coxao-duro-cozido', nome: 'Coxão duro cozido (sem gordura)', cat: 'carnes', kcal: 217, p: 31.9, c: 0, g: 8.9, fibra: 0, porcao: { g: 100, desc: '1 bife médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'maminha-grelhada', nome: 'Maminha grelhada', cat: 'carnes', kcal: 153, p: 30.7, c: 0, g: 2.4, fibra: 0, porcao: { g: 100, desc: '1 bife médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'costela-bovina-assada', nome: 'Costela bovina assada', cat: 'carnes', kcal: 373, p: 28.8, c: 0, g: 27.7, fibra: 0, porcao: { g: 100, desc: '1 pedaço médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'fraldinha-cozida', nome: 'Fraldinha cozida (com gordura)', cat: 'carnes', kcal: 338, p: 24.2, c: 0, g: 26, fibra: 0, porcao: { g: 100, desc: '1 pedaço médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'cupim-assado', nome: 'Cupim assado', cat: 'carnes', kcal: 330, p: 28.6, c: 0, g: 23, fibra: 0, porcao: { g: 100, desc: '2 fatias médias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'charque-cozido', nome: 'Charque cozido', cat: 'carnes', kcal: 263, p: 36.4, c: 0, g: 11.9, fibra: 0, porcao: { g: 50, desc: '2 colheres de sopa cheias (desfiado)' }, nova: 3, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'almondegas-fritas', nome: 'Almôndegas de carne fritas', cat: 'carnes', kcal: 272, p: 18.2, c: 14.3, g: 15.8, fibra: 0, porcao: { g: 90, desc: '3 unidades' }, nova: 3, tags: [], papel: 'proteina', fonte: 'TACO' },
  { id: 'hamburguer-bovino-grelhado', nome: 'Hambúrguer bovino grelhado', cat: 'carnes', kcal: 210, p: 13.2, c: 11.3, g: 12.4, fibra: 0, porcao: { g: 80, desc: '1 unidade' }, nova: 4, tags: [], papel: 'proteina', fonte: 'TACO' },
  { id: 'bisteca-suina-grelhada', nome: 'Bisteca suína grelhada', cat: 'carnes', kcal: 280, p: 28.9, c: 0, g: 17.4, fibra: 0, porcao: { g: 100, desc: '1 unidade média' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'costela-suina-assada', nome: 'Costela suína assada', cat: 'carnes', kcal: 402, p: 30.2, c: 0, g: 30.3, fibra: 0, porcao: { g: 100, desc: '2 pedaços médios' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'linguica-de-frango-grelhada', nome: 'Linguiça de frango grelhada', cat: 'carnes', kcal: 244, p: 18.2, c: 0, g: 18.4, fibra: 0, porcao: { g: 60, desc: '1 gomo' }, nova: 4, tags: [], papel: 'proteina', fonte: 'TACO' },
  { id: 'mortadela', nome: 'Mortadela', cat: 'carnes', kcal: 269, p: 12, c: 5.8, g: 21.6, fibra: 0, porcao: { g: 30, desc: '2 fatias' }, nova: 4, tags: [], papel: 'proteina', fonte: 'TACO' },
  { id: 'salame', nome: 'Salame', cat: 'carnes', kcal: 398, p: 25.8, c: 2.9, g: 30.6, fibra: 0, porcao: { g: 30, desc: '6 fatias' }, nova: 4, tags: [], papel: 'proteina', fonte: 'TACO' },
  { id: 'salsicha', nome: 'Salsicha', cat: 'carnes', kcal: 269, p: 12.8, c: 0.3, g: 23.7, fibra: 0.1, porcao: { g: 50, desc: '1 unidade' }, nova: 4, tags: [], papel: 'proteina', fonte: 'USDA' },
  { id: 'peru-assado', nome: 'Peru assado', cat: 'carnes', kcal: 163, p: 26.2, c: 0, g: 5.7, fibra: 0, porcao: { g: 100, desc: '2 fatias médias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'bacon-frito', nome: 'Toucinho (bacon) frito', cat: 'carnes', kcal: 697, p: 27.3, c: 0, g: 64.3, fibra: 0, porcao: { g: 15, desc: '2 fatias' }, nova: 3, tags: ['sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'quibe-assado', nome: 'Quibe assado', cat: 'carnes', kcal: 136, p: 14.6, c: 12.9, g: 2.7, fibra: 1.9, porcao: { g: 80, desc: '1 unidade média' }, nova: 3, tags: ['sem_lactose'], papel: 'proteina', fonte: 'TACO' },
  { id: 'quibe-frito', nome: 'Quibe frito', cat: 'carnes', kcal: 254, p: 14.9, c: 12.3, g: 15.8, fibra: 3, porcao: { g: 80, desc: '1 unidade média' }, nova: 3, tags: ['sem_lactose'], papel: 'proteina', fonte: 'TACO' },
  { id: 'estrogonofe-de-frango', nome: 'Estrogonofe de frango', cat: 'carnes', kcal: 157, p: 17.6, c: 2.6, g: 8, fibra: 1, porcao: { g: 150, desc: '5 colheres de sopa cheias' }, nova: 3, tags: ['sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'estrogonofe-de-carne', nome: 'Estrogonofe de carne', cat: 'carnes', kcal: 173, p: 15, c: 3, g: 10.8, fibra: 1.1, porcao: { g: 150, desc: '5 colheres de sopa cheias' }, nova: 3, tags: ['sem_gluten'], papel: 'proteina', fonte: 'TACO' },

  // ---- Peixes e frutos do mar ----
  { id: 'tilapia-grelhada', nome: 'Tilápia grelhada (filé)', cat: 'peixes', kcal: 128, p: 26.2, c: 0, g: 2.7, fibra: 0, porcao: { g: 100, desc: '1 filé médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'USDA' },
  { id: 'sardinha-assada', nome: 'Sardinha fresca assada', cat: 'peixes', kcal: 164, p: 32.2, c: 0, g: 3, fibra: 0, porcao: { g: 80, desc: '2 unidades médias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'sardinha-em-conserva', nome: 'Sardinha em conserva (óleo)', cat: 'peixes', kcal: 285, p: 15.9, c: 0, g: 24, fibra: 0, porcao: { g: 60, desc: '2 unidades' }, nova: 3, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'atum-em-conserva', nome: 'Atum em conserva (óleo)', cat: 'peixes', kcal: 166, p: 26.2, c: 0, g: 6, fibra: 0, porcao: { g: 60, desc: '1/2 lata (drenado)' }, nova: 3, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'salmao-grelhado', nome: 'Salmão grelhado (sem pele)', cat: 'peixes', kcal: 243, p: 26.1, c: 0, g: 14.5, fibra: 0, porcao: { g: 100, desc: '1 filé pequeno' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'merluza-assada', nome: 'Merluza assada (filé)', cat: 'peixes', kcal: 122, p: 26.6, c: 0, g: 0.9, fibra: 0, porcao: { g: 100, desc: '1 filé médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'camarao-cozido', nome: 'Camarão cozido', cat: 'peixes', kcal: 90, p: 19, c: 0, g: 1, fibra: 0, porcao: { g: 100, desc: '10 unidades grandes' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'pescada-frita', nome: 'Pescada (filé) frita', cat: 'peixes', kcal: 154, p: 28.6, c: 0, g: 3.6, fibra: 0, porcao: { g: 100, desc: '1 filé médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'cacao-cozido', nome: 'Cação (posta) cozido', cat: 'peixes', kcal: 116, p: 25.6, c: 0, g: 0.7, fibra: 0, porcao: { g: 100, desc: '1 posta média' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'corvina-assada', nome: 'Corvina assada', cat: 'peixes', kcal: 147, p: 26.8, c: 0, g: 3.6, fibra: 0, porcao: { g: 100, desc: '1 posta média' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'pintado-grelhado', nome: 'Pintado grelhado', cat: 'peixes', kcal: 152, p: 30.8, c: 0, g: 2.3, fibra: 0, porcao: { g: 100, desc: '1 posta média' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'bacalhau-refogado', nome: 'Bacalhau refogado', cat: 'peixes', kcal: 140, p: 24, c: 1.2, g: 3.6, fibra: 0, porcao: { g: 100, desc: '4 colheres de sopa cheias' }, nova: 3, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'sardinha-frita', nome: 'Sardinha frita', cat: 'peixes', kcal: 257, p: 33.4, c: 0, g: 12.7, fibra: 0, porcao: { g: 80, desc: '2 unidades médias' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'abadejo-grelhado', nome: 'Abadejo (filé) grelhado', cat: 'peixes', kcal: 130, p: 27.6, c: 0, g: 1.3, fibra: 0, porcao: { g: 100, desc: '1 filé médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'merluza-frita', nome: 'Merluza (filé) frita', cat: 'peixes', kcal: 192, p: 26.9, c: 0, g: 8.5, fibra: 0, porcao: { g: 100, desc: '1 filé médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },

  // ---- Ovos e laticínios ----
  { id: 'ovo-cozido', nome: 'Ovo de galinha cozido', cat: 'ovos_laticinios', kcal: 146, p: 13.3, c: 0.6, g: 9.5, fibra: 0, porcao: { g: 50, desc: '1 unidade' }, nova: 1, tags: ['vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'clara-de-ovo-cozida', nome: 'Clara de ovo cozida', cat: 'ovos_laticinios', kcal: 59, p: 13.4, c: 0, g: 0.1, fibra: 0, porcao: { g: 35, desc: '1 unidade' }, nova: 1, tags: ['vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'ovo-frito', nome: 'Ovo de galinha frito', cat: 'ovos_laticinios', kcal: 240, p: 15.6, c: 1.2, g: 18.6, fibra: 0, porcao: { g: 50, desc: '1 unidade' }, nova: 1, tags: ['vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'omelete-de-queijo', nome: 'Omelete de queijo', cat: 'ovos_laticinios', kcal: 268, p: 15.6, c: 0.4, g: 22, fibra: 0, porcao: { g: 65, desc: '1 unidade pequena (1 ovo)' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'leite-integral', nome: 'Leite de vaca integral', cat: 'ovos_laticinios', kcal: 62, p: 3.2, c: 4.8, g: 3.4, fibra: 0, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TBCA' },
  { id: 'leite-semidesnatado', nome: 'Leite de vaca semidesnatado', cat: 'ovos_laticinios', kcal: 55, p: 3.2, c: 6.5, g: 1.8, fibra: 0, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TBCA' },
  { id: 'leite-desnatado', nome: 'Leite de vaca desnatado', cat: 'ovos_laticinios', kcal: 37, p: 3.1, c: 5.1, g: 0.4, fibra: 0, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TBCA' },
  { id: 'iogurte-natural', nome: 'Iogurte natural integral', cat: 'ovos_laticinios', kcal: 51, p: 4.1, c: 1.9, g: 3, fibra: 0, porcao: { g: 170, desc: '1 pote' }, nova: 1, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'iogurte-natural-desnatado', nome: 'Iogurte natural desnatado', cat: 'ovos_laticinios', kcal: 41, p: 3.8, c: 5.8, g: 0.3, fibra: 0, porcao: { g: 170, desc: '1 pote' }, nova: 1, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'queijo-minas-frescal', nome: 'Queijo minas frescal', cat: 'ovos_laticinios', kcal: 264, p: 17.4, c: 3.2, g: 20.2, fibra: 0, porcao: { g: 30, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'queijo-mucarela', nome: 'Queijo muçarela', cat: 'ovos_laticinios', kcal: 330, p: 22.6, c: 3, g: 25.2, fibra: 0, porcao: { g: 30, desc: '2 fatias' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'queijo-prato', nome: 'Queijo prato', cat: 'ovos_laticinios', kcal: 360, p: 22.7, c: 1.9, g: 29.1, fibra: 0, porcao: { g: 30, desc: '2 fatias' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'queijo-parmesao', nome: 'Queijo parmesão', cat: 'ovos_laticinios', kcal: 453, p: 35.6, c: 1.7, g: 33.5, fibra: 0, porcao: { g: 10, desc: '1 colher de sopa (ralado)' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'queijo-cottage', nome: 'Queijo cottage', cat: 'ovos_laticinios', kcal: 98, p: 11.1, c: 3.4, g: 4.3, fibra: 0, porcao: { g: 50, desc: '2 colheres de sopa' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'USDA' },
  { id: 'ricota', nome: 'Ricota', cat: 'ovos_laticinios', kcal: 140, p: 12.6, c: 3.8, g: 8.1, fibra: 0, porcao: { g: 50, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'requeijao-cremoso', nome: 'Requeijão cremoso', cat: 'ovos_laticinios', kcal: 257, p: 9.6, c: 2.4, g: 23.4, fibra: 0, porcao: { g: 30, desc: '1 colher de sopa' }, nova: 4, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'ovo-de-codorna', nome: 'Ovo de codorna', cat: 'ovos_laticinios', kcal: 177, p: 13.7, c: 0.8, g: 12.7, fibra: 0, porcao: { g: 50, desc: '5 unidades' }, nova: 1, tags: ['vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO' },
  { id: 'leite-em-po-integral', nome: 'Leite em pó integral', cat: 'ovos_laticinios', kcal: 497, p: 25.4, c: 39.2, g: 26.9, fibra: 0, porcao: { g: 26, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'leite-em-po-desnatado', nome: 'Leite em pó desnatado', cat: 'ovos_laticinios', kcal: 362, p: 34.7, c: 53, g: 0.9, fibra: 0, porcao: { g: 20, desc: '2 colheres de sopa' }, nova: 1, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'iogurte-de-morango', nome: 'Iogurte sabor morango', cat: 'ovos_laticinios', kcal: 70, p: 2.7, c: 9.7, g: 2.3, fibra: 0.2, porcao: { g: 170, desc: '1 pote' }, nova: 4, tags: ['vegetariano'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'bebida-lactea', nome: 'Bebida láctea de fruta', cat: 'ovos_laticinios', kcal: 55, p: 2.1, c: 7.6, g: 1.9, fibra: 0.3, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 4, tags: ['vegetariano'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'leite-fermentado', nome: 'Leite fermentado', cat: 'ovos_laticinios', kcal: 70, p: 1.9, c: 15.7, g: 0.1, fibra: 0, porcao: { g: 80, desc: '1 unidade (80 mL)' }, nova: 4, tags: ['vegetariano'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'leite-achocolatado', nome: 'Leite achocolatado pronto', cat: 'ovos_laticinios', kcal: 83, p: 2.1, c: 14.2, g: 2.2, fibra: 0.6, porcao: { g: 200, desc: '1 unidade (caixinha de 200 mL)' }, nova: 4, tags: ['vegetariano'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'queijo-minas-meia-cura', nome: 'Queijo minas meia cura', cat: 'ovos_laticinios', kcal: 321, p: 21.2, c: 3.6, g: 24.6, fibra: 0, porcao: { g: 30, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'laticinio', fonte: 'TACO' },
  { id: 'creme-de-leite', nome: 'Creme de leite', cat: 'ovos_laticinios', kcal: 221, p: 1.5, c: 4.5, g: 22.5, fibra: 0, porcao: { g: 30, desc: '2 colheres de sopa' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },

  // ---- Frutas ----
  { id: 'banana-prata', nome: 'Banana-prata', cat: 'frutas', kcal: 98, p: 1.3, c: 26, g: 0.1, fibra: 2, porcao: { g: 65, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'banana-nanica', nome: 'Banana-nanica', cat: 'frutas', kcal: 92, p: 1.4, c: 23.8, g: 0.1, fibra: 1.9, porcao: { g: 90, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'maca-fuji', nome: 'Maçã Fuji com casca', cat: 'frutas', kcal: 56, p: 0.3, c: 15.2, g: 0, fibra: 1.3, porcao: { g: 130, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'laranja-pera', nome: 'Laranja-pera', cat: 'frutas', kcal: 37, p: 1, c: 8.9, g: 0.1, fibra: 0.8, porcao: { g: 140, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'mamao-papaia', nome: 'Mamão papaia', cat: 'frutas', kcal: 40, p: 0.5, c: 10.4, g: 0.1, fibra: 1, porcao: { g: 150, desc: '1/2 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'abacaxi', nome: 'Abacaxi', cat: 'frutas', kcal: 48, p: 0.9, c: 12.3, g: 0.1, fibra: 1, porcao: { g: 75, desc: '1 fatia média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'melancia', nome: 'Melancia', cat: 'frutas', kcal: 33, p: 0.9, c: 8.1, g: 0, fibra: 0.1, porcao: { g: 200, desc: '1 fatia média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'manga-palmer', nome: 'Manga Palmer', cat: 'frutas', kcal: 72, p: 0.4, c: 19.4, g: 0.2, fibra: 1.6, porcao: { g: 140, desc: '1 xícara de chá (picada)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'uva-italia', nome: 'Uva Itália', cat: 'frutas', kcal: 53, p: 0.7, c: 13.6, g: 0.2, fibra: 0.9, porcao: { g: 100, desc: '1 cacho pequeno' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'morango', nome: 'Morango', cat: 'frutas', kcal: 30, p: 0.9, c: 6.8, g: 0.3, fibra: 1.7, porcao: { g: 120, desc: '10 unidades médias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'abacate', nome: 'Abacate', cat: 'frutas', kcal: 96, p: 1.2, c: 6, g: 8.4, fibra: 6.3, porcao: { g: 90, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'goiaba-vermelha', nome: 'Goiaba vermelha com casca', cat: 'frutas', kcal: 54, p: 1.1, c: 13, g: 0.4, fibra: 6.2, porcao: { g: 170, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'acai-polpa-congelada', nome: 'Açaí (polpa congelada, sem açúcar)', cat: 'frutas', kcal: 58, p: 0.8, c: 6.2, g: 3.9, fibra: 2.6, porcao: { g: 100, desc: '1 sachê de polpa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'pera-williams', nome: 'Pera Williams', cat: 'frutas', kcal: 53, p: 0.6, c: 14, g: 0.1, fibra: 3, porcao: { g: 130, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'melao', nome: 'Melão', cat: 'frutas', kcal: 29, p: 0.7, c: 7.5, g: 0, fibra: 0.3, porcao: { g: 90, desc: '1 fatia média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'tangerina-ponca', nome: 'Tangerina poncã', cat: 'frutas', kcal: 38, p: 0.8, c: 9.6, g: 0.1, fibra: 0.9, porcao: { g: 135, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'kiwi', nome: 'Kiwi', cat: 'frutas', kcal: 51, p: 1.3, c: 11.5, g: 0.6, fibra: 2.7, porcao: { g: 75, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'limao-tahiti', nome: 'Limão taiti', cat: 'frutas', kcal: 32, p: 0.9, c: 11.1, g: 0.1, fibra: 1.2, porcao: { g: 50, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'coco-cru', nome: 'Coco (polpa crua)', cat: 'frutas', kcal: 406, p: 3.7, c: 10.4, g: 42, fibra: 5.4, porcao: { g: 30, desc: '1 pedaço médio' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'banana-da-terra', nome: 'Banana-da-terra', cat: 'frutas', kcal: 128, p: 1.4, c: 33.7, g: 0.2, fibra: 1.5, porcao: { g: 100, desc: '1 unidade pequena' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'banana-maca', nome: 'Banana-maçã', cat: 'frutas', kcal: 87, p: 1.8, c: 22.3, g: 0.1, fibra: 2.6, porcao: { g: 65, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'acerola', nome: 'Acerola', cat: 'frutas', kcal: 33, p: 0.9, c: 8, g: 0.2, fibra: 1.5, porcao: { g: 100, desc: '12 unidades' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'ameixa', nome: 'Ameixa', cat: 'frutas', kcal: 53, p: 0.8, c: 13.9, g: 0, fibra: 2.4, porcao: { g: 80, desc: '2 unidades médias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'caqui', nome: 'Caqui', cat: 'frutas', kcal: 71, p: 0.4, c: 19.3, g: 0.1, fibra: 6.5, porcao: { g: 110, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'caju', nome: 'Caju', cat: 'frutas', kcal: 43, p: 1, c: 10.3, g: 0.3, fibra: 1.7, porcao: { g: 100, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'jabuticaba', nome: 'Jabuticaba', cat: 'frutas', kcal: 58, p: 0.6, c: 15.3, g: 0.1, fibra: 2.3, porcao: { g: 100, desc: '20 unidades' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'jaca', nome: 'Jaca', cat: 'frutas', kcal: 88, p: 1.4, c: 22.5, g: 0.3, fibra: 2.4, porcao: { g: 100, desc: '6 unidades (bagos)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'maracuja', nome: 'Maracujá', cat: 'frutas', kcal: 68, p: 2, c: 12.3, g: 2.1, fibra: 1.1, porcao: { g: 50, desc: '1 unidade média (polpa)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'pessego', nome: 'Pêssego', cat: 'frutas', kcal: 36, p: 0.8, c: 9.3, g: 0, fibra: 1.4, porcao: { g: 110, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'figo', nome: 'Figo', cat: 'frutas', kcal: 41, p: 1, c: 10.2, g: 0.2, fibra: 1.8, porcao: { g: 100, desc: '2 unidades médias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'laranja-lima', nome: 'Laranja-lima', cat: 'frutas', kcal: 46, p: 1.1, c: 11.5, g: 0.1, fibra: 1.8, porcao: { g: 140, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'laranja-baia', nome: 'Laranja-baía', cat: 'frutas', kcal: 45, p: 1, c: 11.5, g: 0.1, fibra: 1.1, porcao: { g: 180, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'maca-argentina', nome: 'Maçã vermelha (argentina) com casca', cat: 'frutas', kcal: 63, p: 0.2, c: 16.6, g: 0.2, fibra: 2, porcao: { g: 130, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'mamao-formosa', nome: 'Mamão formosa', cat: 'frutas', kcal: 45, p: 0.8, c: 11.6, g: 0.1, fibra: 1.8, porcao: { g: 170, desc: '1 fatia média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'manga-tommy', nome: 'Manga Tommy', cat: 'frutas', kcal: 51, p: 0.9, c: 12.8, g: 0.2, fibra: 2.1, porcao: { g: 140, desc: '1 xícara de chá (picada)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'uva-rubi', nome: 'Uva Rubi', cat: 'frutas', kcal: 49, p: 0.6, c: 12.7, g: 0.2, fibra: 0.9, porcao: { g: 100, desc: '1 cacho pequeno' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'pinha', nome: 'Pinha (fruta-do-conde)', cat: 'frutas', kcal: 88, p: 1.5, c: 22.4, g: 0.3, fibra: 3.4, porcao: { g: 100, desc: '1 unidade pequena' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'goiaba-branca', nome: 'Goiaba branca com casca', cat: 'frutas', kcal: 52, p: 0.9, c: 12.4, g: 0.5, fibra: 6.3, porcao: { g: 170, desc: '1 unidade média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'polpa-de-acerola', nome: 'Acerola (polpa congelada)', cat: 'frutas', kcal: 22, p: 0.6, c: 5.5, g: 0, fibra: 0.7, porcao: { g: 100, desc: '1 sachê de polpa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'polpa-de-maracuja', nome: 'Maracujá (polpa congelada)', cat: 'frutas', kcal: 39, p: 0.8, c: 9.6, g: 0.2, fibra: 0.5, porcao: { g: 100, desc: '1 sachê de polpa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },
  { id: 'pessego-em-calda', nome: 'Pêssego em calda', cat: 'frutas', kcal: 63, p: 0.7, c: 16.9, g: 0, fibra: 1, porcao: { g: 60, desc: '2 unidades (metades)' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'fruta', fonte: 'TACO' },

  // ---- Verduras e legumes ----
  { id: 'alface-crespa', nome: 'Alface crespa', cat: 'hortalicas', kcal: 11, p: 1.3, c: 1.7, g: 0.2, fibra: 1.8, porcao: { g: 40, desc: '4 folhas médias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'rucula', nome: 'Rúcula', cat: 'hortalicas', kcal: 13, p: 1.8, c: 2.2, g: 0.1, fibra: 1.7, porcao: { g: 20, desc: '1 pires cheio' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'tomate', nome: 'Tomate', cat: 'hortalicas', kcal: 15, p: 1.1, c: 3.1, g: 0.2, fibra: 1.2, porcao: { g: 60, desc: '4 fatias médias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'cenoura-crua', nome: 'Cenoura crua', cat: 'hortalicas', kcal: 34, p: 1.3, c: 7.7, g: 0.2, fibra: 3.2, porcao: { g: 40, desc: '3 colheres de sopa (ralada)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'cenoura-cozida', nome: 'Cenoura cozida', cat: 'hortalicas', kcal: 30, p: 0.8, c: 6.7, g: 0.2, fibra: 2.6, porcao: { g: 75, desc: '3 colheres de sopa (picada)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'brocolis-cozido', nome: 'Brócolis cozido', cat: 'hortalicas', kcal: 25, p: 2.1, c: 4.4, g: 0.5, fibra: 3.4, porcao: { g: 60, desc: '2 ramos médios' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'couve-refogada', nome: 'Couve-manteiga refogada', cat: 'hortalicas', kcal: 90, p: 1.7, c: 8.7, g: 6.6, fibra: 5.7, porcao: { g: 40, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'espinafre-refogado', nome: 'Espinafre refogado', cat: 'hortalicas', kcal: 67, p: 2.7, c: 4.2, g: 5.4, fibra: 2.5, porcao: { g: 50, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'abobrinha-cozida', nome: 'Abobrinha italiana cozida', cat: 'hortalicas', kcal: 15, p: 1.1, c: 3, g: 0.2, fibra: 1.6, porcao: { g: 60, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'abobora-cabotia-cozida', nome: 'Abóbora cabotiá cozida', cat: 'hortalicas', kcal: 48, p: 1.4, c: 10.8, g: 0.7, fibra: 2.5, porcao: { g: 70, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'chuchu-cozido', nome: 'Chuchu cozido', cat: 'hortalicas', kcal: 19, p: 0.4, c: 4.8, g: 0, fibra: 1, porcao: { g: 60, desc: '3 colheres de sopa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'beterraba-cozida', nome: 'Beterraba cozida', cat: 'hortalicas', kcal: 32, p: 1.3, c: 7.2, g: 0.1, fibra: 1.9, porcao: { g: 60, desc: '3 colheres de sopa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'pepino', nome: 'Pepino', cat: 'hortalicas', kcal: 10, p: 0.9, c: 2, g: 0, fibra: 1.1, porcao: { g: 50, desc: '8 fatias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'repolho-branco-cru', nome: 'Repolho branco cru', cat: 'hortalicas', kcal: 17, p: 0.9, c: 3.9, g: 0.1, fibra: 1.9, porcao: { g: 30, desc: '3 colheres de sopa (picado)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'couve-flor-cozida', nome: 'Couve-flor cozida', cat: 'hortalicas', kcal: 19, p: 1.2, c: 3.9, g: 0.3, fibra: 2.1, porcao: { g: 60, desc: '2 ramos médios' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'vagem-cozida', nome: 'Vagem cozida', cat: 'hortalicas', kcal: 23, p: 1.6, c: 5, g: 0.2, fibra: 2.3, porcao: { g: 50, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TBCA' },
  { id: 'quiabo-cozido', nome: 'Quiabo cozido', cat: 'hortalicas', kcal: 20, p: 1.3, c: 5.1, g: 0.1, fibra: 3.1, porcao: { g: 50, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TBCA' },
  { id: 'cebola-crua', nome: 'Cebola crua', cat: 'hortalicas', kcal: 39, p: 1.7, c: 8.9, g: 0.1, fibra: 2.2, porcao: { g: 20, desc: '2 colheres de sopa (picada)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'berinjela-cozida', nome: 'Berinjela cozida', cat: 'hortalicas', kcal: 19, p: 0.7, c: 4.5, g: 0.1, fibra: 2.5, porcao: { g: 50, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'alface-americana', nome: 'Alface americana', cat: 'hortalicas', kcal: 9, p: 0.6, c: 1.7, g: 0.1, fibra: 1, porcao: { g: 40, desc: '4 folhas médias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'alface-lisa', nome: 'Alface lisa', cat: 'hortalicas', kcal: 14, p: 1.7, c: 2.4, g: 0.1, fibra: 2.3, porcao: { g: 40, desc: '4 folhas médias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'acelga', nome: 'Acelga', cat: 'hortalicas', kcal: 21, p: 1.4, c: 4.6, g: 0.1, fibra: 1.1, porcao: { g: 40, desc: '3 colheres de sopa (picada)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'agriao', nome: 'Agrião', cat: 'hortalicas', kcal: 17, p: 2.7, c: 2.3, g: 0.2, fibra: 2.1, porcao: { g: 20, desc: '1 pires cheio' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'almeirao', nome: 'Almeirão', cat: 'hortalicas', kcal: 18, p: 1.8, c: 3.3, g: 0.2, fibra: 2.6, porcao: { g: 20, desc: '1 pires cheio' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'repolho-roxo-cru', nome: 'Repolho roxo cru', cat: 'hortalicas', kcal: 31, p: 1.9, c: 7.2, g: 0.1, fibra: 2, porcao: { g: 30, desc: '3 colheres de sopa (picado)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'pimentao-verde', nome: 'Pimentão verde', cat: 'hortalicas', kcal: 21, p: 1.1, c: 4.9, g: 0.2, fibra: 2.6, porcao: { g: 30, desc: '3 colheres de sopa (picado)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'rabanete', nome: 'Rabanete', cat: 'hortalicas', kcal: 14, p: 1.4, c: 2.7, g: 0.1, fibra: 2.2, porcao: { g: 30, desc: '3 unidades' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'couve-crua', nome: 'Couve-manteiga crua', cat: 'hortalicas', kcal: 27, p: 2.9, c: 4.3, g: 0.5, fibra: 3.1, porcao: { g: 20, desc: '1 folha média' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'palmito-em-conserva', nome: 'Palmito em conserva', cat: 'hortalicas', kcal: 29, p: 2.5, c: 5.5, g: 0.5, fibra: 2.6, porcao: { g: 50, desc: '2 unidades (toletes)' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'jilo', nome: 'Jiló', cat: 'hortalicas', kcal: 27, p: 1.4, c: 6.2, g: 0.2, fibra: 4.8, porcao: { g: 60, desc: '2 unidades médias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'maxixe', nome: 'Maxixe', cat: 'hortalicas', kcal: 14, p: 1.4, c: 2.7, g: 0.1, fibra: 2.2, porcao: { g: 60, desc: '3 unidades' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'abobora-moranga-refogada', nome: 'Abóbora moranga refogada', cat: 'hortalicas', kcal: 29, p: 0.4, c: 6, g: 0.8, fibra: 1.5, porcao: { g: 70, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'abobrinha-refogada', nome: 'Abobrinha italiana refogada', cat: 'hortalicas', kcal: 24, p: 1.1, c: 4.2, g: 0.8, fibra: 1.4, porcao: { g: 60, desc: '2 colheres de sopa cheias' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'seleta-de-legumes', nome: 'Seleta de legumes em conserva', cat: 'hortalicas', kcal: 57, p: 3.4, c: 12.7, g: 0.4, fibra: 3.1, porcao: { g: 60, desc: '3 colheres de sopa' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },
  { id: 'molho-de-tomate', nome: 'Molho de tomate pronto', cat: 'hortalicas', kcal: 38, p: 1.4, c: 7.7, g: 0.9, fibra: 3.1, porcao: { g: 60, desc: '3 colheres de sopa' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'vegetal', fonte: 'TACO' },

  // ---- Castanhas, sementes e gorduras ----
  { id: 'azeite-de-oliva', nome: 'Azeite de oliva extravirgem', cat: 'gorduras', kcal: 884, p: 0, c: 0, g: 100, fibra: 0, porcao: { g: 12, desc: '1 colher de sopa (13 mL)' }, nova: 2, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'oleo-de-soja', nome: 'Óleo de soja', cat: 'gorduras', kcal: 884, p: 0, c: 0, g: 100, fibra: 0, porcao: { g: 12, desc: '1 colher de sopa (13 mL)' }, nova: 2, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'manteiga-com-sal', nome: 'Manteiga com sal', cat: 'gorduras', kcal: 726, p: 0.4, c: 0.1, g: 82.4, fibra: 0, porcao: { g: 10, desc: '1 colher de sopa rasa' }, nova: 2, tags: ['vegetariano', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'margarina-com-sal', nome: 'Margarina com sal (65% de lipídios)', cat: 'gorduras', kcal: 596, p: 0, c: 0, g: 67.4, fibra: 0, porcao: { g: 10, desc: '1 colher de sopa rasa' }, nova: 4, tags: ['vegetariano', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'pasta-de-amendoim', nome: 'Pasta de amendoim integral', cat: 'gorduras', kcal: 615, p: 26.5, c: 21.6, g: 48.4, fibra: 6.5, porcao: { g: 15, desc: '1 colher de sopa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TBCA' },
  { id: 'amendoim-torrado-salgado', nome: 'Amendoim torrado e salgado', cat: 'gorduras', kcal: 606, p: 22.5, c: 18.7, g: 54, fibra: 7.8, porcao: { g: 30, desc: '2 colheres de sopa' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'castanha-do-para', nome: 'Castanha-do-pará (castanha-do-brasil)', cat: 'gorduras', kcal: 643, p: 14.5, c: 15.1, g: 63.5, fibra: 7.9, porcao: { g: 8, desc: '2 unidades' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'castanha-de-caju', nome: 'Castanha de caju torrada e salgada', cat: 'gorduras', kcal: 570, p: 18.5, c: 29.1, g: 46.3, fibra: 3.7, porcao: { g: 25, desc: '10 unidades' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'amendoa', nome: 'Amêndoa torrada e salgada', cat: 'gorduras', kcal: 581, p: 18.6, c: 29.5, g: 47.3, fibra: 11.6, porcao: { g: 20, desc: '1 punhado pequeno' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'nozes', nome: 'Nozes', cat: 'gorduras', kcal: 620, p: 14, c: 18.4, g: 59.4, fibra: 7.2, porcao: { g: 20, desc: '4 unidades' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'chia', nome: 'Chia (semente)', cat: 'gorduras', kcal: 486, p: 16.5, c: 42.1, g: 30.7, fibra: 34.4, porcao: { g: 12, desc: '1 colher de sopa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'USDA' },
  { id: 'linhaca', nome: 'Linhaça (semente)', cat: 'gorduras', kcal: 495, p: 14.1, c: 43.3, g: 32.3, fibra: 33.5, porcao: { g: 10, desc: '1 colher de sopa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'azeitona-verde', nome: 'Azeitona verde em conserva', cat: 'gorduras', kcal: 137, p: 0.9, c: 4.1, g: 14.2, fibra: 3.8, porcao: { g: 20, desc: '5 unidades' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'oleo-de-girassol', nome: 'Óleo de girassol', cat: 'gorduras', kcal: 884, p: 0, c: 0, g: 100, fibra: 0, porcao: { g: 12, desc: '1 colher de sopa (13 mL)' }, nova: 2, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'oleo-de-milho', nome: 'Óleo de milho', cat: 'gorduras', kcal: 884, p: 0, c: 0, g: 100, fibra: 0, porcao: { g: 12, desc: '1 colher de sopa (13 mL)' }, nova: 2, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'oleo-de-canola', nome: 'Óleo de canola', cat: 'gorduras', kcal: 884, p: 0, c: 0, g: 100, fibra: 0, porcao: { g: 12, desc: '1 colher de sopa (13 mL)' }, nova: 2, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'maionese', nome: 'Maionese', cat: 'gorduras', kcal: 302, p: 0.6, c: 7.9, g: 30.5, fibra: 0, porcao: { g: 12, desc: '1 colher de sopa' }, nova: 4, tags: ['vegetariano', 'sem_lactose'], papel: 'gordura', fonte: 'TACO' },
  { id: 'leite-de-coco', nome: 'Leite de coco', cat: 'gorduras', kcal: 166, p: 1, c: 2.2, g: 18.4, fibra: 0.7, porcao: { g: 30, desc: '2 colheres de sopa' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'gergelim', nome: 'Gergelim (semente)', cat: 'gorduras', kcal: 584, p: 21.2, c: 21.6, g: 50.4, fibra: 11.9, porcao: { g: 10, desc: '1 colher de sopa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },
  { id: 'amendoim-cru', nome: 'Amendoim cru (sem casca)', cat: 'gorduras', kcal: 544, p: 27.2, c: 20.3, g: 43.9, fibra: 8, porcao: { g: 30, desc: '2 colheres de sopa' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'gordura', fonte: 'TACO' },

  // ---- Bebidas ----
  { id: 'cafe-sem-acucar', nome: 'Café coado sem açúcar', cat: 'bebidas', kcal: 9, p: 0.7, c: 1.5, g: 0.1, fibra: 0, porcao: { g: 50, desc: '1 xícara de café (50 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' },
  { id: 'suco-de-laranja-natural', nome: 'Suco de laranja natural', cat: 'bebidas', kcal: 33, p: 0.7, c: 7.6, g: 0.1, fibra: 0, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' },
  { id: 'agua-de-coco', nome: 'Água de coco', cat: 'bebidas', kcal: 22, p: 0, c: 5.3, g: 0, fibra: 0.1, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' },
  { id: 'leite-de-soja', nome: 'Bebida de soja natural (leite de soja)', cat: 'bebidas', kcal: 39, p: 2.4, c: 4.3, g: 1.6, fibra: 0.4, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' },
  { id: 'refrigerante-de-cola', nome: 'Refrigerante de cola', cat: 'bebidas', kcal: 34, p: 0, c: 8.7, g: 0, fibra: 0, porcao: { g: 350, desc: '1 lata (350 mL)' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' },
  { id: 'bebida-isotonica', nome: 'Bebida isotônica', cat: 'bebidas', kcal: 26, p: 0, c: 6.4, g: 0, fibra: 0, porcao: { g: 500, desc: '1 garrafa (500 mL)' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' },
  { id: 'refrigerante-de-guarana', nome: 'Refrigerante de guaraná', cat: 'bebidas', kcal: 39, p: 0, c: 10, g: 0, fibra: 0, porcao: { g: 350, desc: '1 lata (350 mL)' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' },
  { id: 'suco-de-uva-integral', nome: 'Suco de uva integral', cat: 'bebidas', kcal: 58, p: 0, c: 14.7, g: 0, fibra: 0.2, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' },
  { id: 'caldo-de-cana', nome: 'Caldo de cana', cat: 'bebidas', kcal: 65, p: 0, c: 18.2, g: 0, fibra: 0.1, porcao: { g: 300, desc: '1 copo grande (300 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' },
  { id: 'cha-mate', nome: 'Chá-mate sem açúcar', cat: 'bebidas', kcal: 3, p: 0, c: 0.6, g: 0.1, fibra: 0, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' },
  // Bebidas do dia a dia que faltavam (POF 2017-2018, Tabela 2: café, sucos e refrigerantes estão entre os itens de
  // maior consumo — ref pof2017). Composição por 100 g, da Tabela 1 das "Tabelas de composição nutricional dos alimentos
  // consumidos no Brasil" (POF 2008-2009 — ref pof2008), com o código do IBGE no comentário, ou da TACO (número da linha).
  // Os sucos da POF 2008-2009 são SEM açúcar (notas da publicação); as versões com açúcar estão em COM_ACUCAR, abaixo.
  { id: 'cafe-com-leite', nome: 'Café com leite sem açúcar', cat: 'bebidas', kcal: 31.44, p: 1.72, c: 2.57, g: 1.69, fibra: 0.24, porcao: { g: 200, desc: '1 xícara de chá (200 mL)' }, nova: 1, tags: ['vegetariano', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE' }, // 8501303 (metade café, metade leite)
  { id: 'suco-de-abacaxi', nome: 'Suco de abacaxi natural sem açúcar', cat: 'bebidas', kcal: 53.21, p: 0.36, c: 12.92, g: 0.12, fibra: 0.2, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE' }, // 8500402
  { id: 'suco-de-acerola', nome: 'Suco de acerola natural sem açúcar', cat: 'bebidas', kcal: 23.06, p: 0.4, c: 4.81, g: 0.3, fibra: 0.3, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE' }, // 8500403
  { id: 'suco-de-goiaba', nome: 'Suco de goiaba natural sem açúcar', cat: 'bebidas', kcal: 62.28, p: 0.37, c: 15.62, g: 0.14, fibra: 0.79, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE' }, // 8500406
  { id: 'suco-de-mamao', nome: 'Suco de mamão natural sem açúcar', cat: 'bebidas', kcal: 57.13, p: 0.17, c: 14.54, g: 0.15, fibra: 0.6, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE' }, // 8500412
  { id: 'suco-de-manga', nome: 'Suco de manga natural sem açúcar', cat: 'bebidas', kcal: 50.86, p: 0.11, c: 13.08, g: 0.06, fibra: 0.3, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE' }, // 8500413
  { id: 'suco-de-maracuja', nome: 'Suco de maracujá natural sem açúcar', cat: 'bebidas', kcal: 60.14, p: 0.67, c: 14.48, g: 0.18, fibra: 0.2, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE' }, // 8500414
  { id: 'suco-de-melao', nome: 'Suco de melão natural sem açúcar', cat: 'bebidas', kcal: 31.79, p: 0.65, c: 8, g: 0.16, fibra: 0.42, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE' }, // 8500415
  { id: 'suco-de-morango', nome: 'Suco de morango natural sem açúcar', cat: 'bebidas', kcal: 59.21, p: 0.57, c: 14.51, g: 0.1, fibra: 0.23, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE' }, // 8500416
  { id: 'suco-de-tangerina', nome: 'Suco de tangerina natural sem açúcar', cat: 'bebidas', kcal: 36, p: 0.5, c: 8.8, g: 0, fibra: 0, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' }, // TACO 252, "Tangerina, Poncã, suco"
  { id: 'suco-de-caju', nome: 'Suco de caju sem açúcar', cat: 'bebidas', kcal: 45, p: 0.4, c: 10.7, g: 0.2, fibra: 0.6, porcao: { g: 200, desc: '1 copo (200 mL)' }, nova: 1, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO' }, // TACO 188, "Caju, suco concentrado, envasado"
  { id: 'refrigerante-de-cola-zero', nome: 'Refrigerante de cola zero açúcar', cat: 'bebidas', kcal: 2, p: 0.11, c: 0.29, g: 0.03, fibra: 0, porcao: { g: 350, desc: '1 lata (350 mL)' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE', soDiario: true }, // 8200801 (cola diet)
  { id: 'refrigerante-de-guarana-zero', nome: 'Refrigerante de guaraná zero açúcar', cat: 'bebidas', kcal: 0, p: 0, c: 0, g: 0, fibra: 0, porcao: { g: 350, desc: '1 lata (350 mL)' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE', soDiario: true }, // 8207401 (guaraná diet: "-" em todos os campos)
  { id: 'refrigerante-de-laranja', nome: 'Refrigerante de laranja', cat: 'bebidas', kcal: 46, p: 0, c: 11.8, g: 0, fibra: 0, porcao: { g: 350, desc: '1 lata (350 mL)' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO', soDiario: true }, // TACO 482
  { id: 'refrigerante-de-limao', nome: 'Refrigerante de limão', cat: 'bebidas', kcal: 40, p: 0, c: 10.3, g: 0, fibra: 0, porcao: { g: 350, desc: '1 lata (350 mL)' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'bebida', fonte: 'TACO', soDiario: true }, // TACO 483
  { id: 'vitamina-de-banana', nome: 'Vitamina de banana com leite', cat: 'bebidas', kcal: 92.78, p: 2.47, c: 16.39, g: 2.31, fibra: 0.62, porcao: { g: 300, desc: '1 copo grande (300 mL)' }, nova: 1, tags: ['vegetariano', 'sem_gluten'], papel: 'bebida', fonte: 'IBGE', soDiario: true }, // 8500503 (com açúcar, segundo a publicação)

  // ---- Outros ----
  { id: 'whey-protein', nome: 'Whey protein (pó)', cat: 'outros', kcal: 352, p: 78.1, c: 6.3, g: 1.6, fibra: 3.1, porcao: { g: 30, desc: '1 dosador (scoop)' }, nova: 4, tags: ['vegetariano'], papel: 'proteina', fonte: 'USDA' },
  { id: 'mel', nome: 'Mel de abelha', cat: 'outros', kcal: 309, p: 0, c: 84, g: 0, fibra: 0, porcao: { g: 15, desc: '1 colher de sopa' }, nova: 2, tags: ['vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'acucar-refinado', nome: 'Açúcar refinado', cat: 'outros', kcal: 387, p: 0.3, c: 99.5, g: 0, fibra: 0, porcao: { g: 5, desc: '1 colher de chá' }, nova: 2, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'chocolate-meio-amargo', nome: 'Chocolate meio amargo', cat: 'outros', kcal: 475, p: 4.9, c: 62.4, g: 29.9, fibra: 4.9, porcao: { g: 25, desc: '1 barra pequena' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'chocolate-amargo-70', nome: 'Chocolate amargo (70–85% cacau)', cat: 'outros', kcal: 598, p: 7.8, c: 45.9, g: 42.6, fibra: 10.9, porcao: { g: 25, desc: '1 barra pequena' }, nova: 4, tags: ['vegetariano'], papel: 'gordura', fonte: 'USDA' },
  { id: 'doce-de-leite', nome: 'Doce de leite cremoso', cat: 'outros', kcal: 306, p: 5.5, c: 59.5, g: 6, fibra: 0, porcao: { g: 20, desc: '1 colher de sopa' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'achocolatado-em-po', nome: 'Achocolatado em pó', cat: 'outros', kcal: 401, p: 4.2, c: 91.2, g: 2.2, fibra: 3.9, porcao: { g: 20, desc: '2 colheres de sopa' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'pacoca', nome: 'Paçoca de amendoim', cat: 'outros', kcal: 487, p: 16, c: 52.4, g: 26.1, fibra: 7.3, porcao: { g: 20, desc: '1 unidade' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'acucar-cristal', nome: 'Açúcar cristal', cat: 'outros', kcal: 387, p: 0.3, c: 99.6, g: 0, fibra: 0, porcao: { g: 5, desc: '1 colher de chá' }, nova: 2, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'acucar-mascavo', nome: 'Açúcar mascavo', cat: 'outros', kcal: 369, p: 0.8, c: 94.5, g: 0.1, fibra: 0, porcao: { g: 5, desc: '1 colher de chá' }, nova: 2, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'rapadura', nome: 'Rapadura', cat: 'outros', kcal: 352, p: 1, c: 90.8, g: 0.1, fibra: 0, porcao: { g: 25, desc: '1 pedaço pequeno' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'melado', nome: 'Melado de cana', cat: 'outros', kcal: 297, p: 0, c: 76.6, g: 0, fibra: 0, porcao: { g: 20, desc: '1 colher de sopa' }, nova: 2, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'goiabada', nome: 'Goiabada', cat: 'outros', kcal: 269, p: 0.6, c: 74.1, g: 0, fibra: 3.7, porcao: { g: 30, desc: '1 fatia média' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'bananada', nome: 'Bananada (doce de banana em barra)', cat: 'outros', kcal: 280, p: 2.2, c: 75.7, g: 0.1, fibra: 3.8, porcao: { g: 25, desc: '1 unidade' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'pe-de-moleque', nome: 'Pé de moleque', cat: 'outros', kcal: 503, p: 13.2, c: 54.7, g: 28, fibra: 3.4, porcao: { g: 20, desc: '1 unidade' }, nova: 3, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'chocolate-ao-leite', nome: 'Chocolate ao leite', cat: 'outros', kcal: 540, p: 7.2, c: 59.6, g: 30.3, fibra: 2.2, porcao: { g: 25, desc: '1 barra pequena' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO' },
  { id: 'leite-condensado', nome: 'Leite condensado', cat: 'outros', kcal: 313, p: 7.7, c: 57, g: 6.7, fibra: 0, porcao: { g: 20, desc: '1 colher de sopa' }, nova: 4, tags: ['vegetariano', 'sem_gluten'], papel: 'carbo', fonte: 'TACO' },
  { id: 'coxinha-de-frango', nome: 'Coxinha de frango frita', cat: 'outros', kcal: 283, p: 9.6, c: 34.5, g: 11.8, fibra: 5, porcao: { g: 60, desc: '1 unidade média' }, nova: 3, tags: [], papel: 'carbo', fonte: 'TACO' },
  { id: 'pastel-de-carne-frito', nome: 'Pastel de carne frito', cat: 'outros', kcal: 388, p: 10.1, c: 43.8, g: 20.1, fibra: 1, porcao: { g: 60, desc: '1 unidade média' }, nova: 3, tags: [], papel: 'carbo', fonte: 'TACO' },
  // Lanches e sanduíches comuns (POF 2017-2018, Tabela 2: sanduíches, pizzas, sorvete/picolé — ref pof2017), com a
  // composição da POF 2008-2009 (código do IBGE) ou da TACO. Só para registrar no diário (`soDiario`): o cardápio de
  // exemplo monta o pão com ovo e o café com leite com os alimentos separados.
  { id: 'pao-com-ovo', nome: 'Pão com ovo', cat: 'outros', kcal: 261.3, p: 10.84, c: 29.91, g: 10.38, fibra: 1.15, porcao: { g: 100, desc: '1 unidade' }, nova: 3, tags: ['vegetariano', 'sem_lactose'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8570330 (pão francês e ovo, metade cada)
  { id: 'pao-com-manteiga', nome: 'Pão com manteiga', cat: 'outros', kcal: 369.5, p: 6.81, c: 48.84, g: 16.1, fibra: 1.92, porcao: { g: 60, desc: '1 unidade' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8570328
  { id: 'misto-quente', nome: 'Misto-quente', cat: 'outros', kcal: 265.42, p: 16.29, c: 18.3, g: 13.78, fibra: 0.85, porcao: { g: 120, desc: '1 unidade' }, nova: 4, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500313 (misto-quente ou frio)
  { id: 'pizza-de-mucarela', nome: 'Pizza de muçarela', cat: 'outros', kcal: 281.2, p: 14.6, c: 29.82, g: 11.35, fibra: 1.74, porcao: { g: 100, desc: '1 fatia' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500915
  { id: 'pizza-de-calabresa', nome: 'Pizza de calabresa', cat: 'outros', kcal: 284.72, p: 13.74, c: 29.51, g: 12.21, fibra: 1.75, porcao: { g: 100, desc: '1 fatia' }, nova: 4, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500914
  { id: 'acai-na-tigela', nome: 'Açaí na tigela (com xarope de guaraná)', cat: 'frutas', kcal: 110, p: 0.7, c: 21.5, g: 3.7, fibra: 1.7, porcao: { g: 300, desc: '1 copo (300 mL)' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose', 'sem_gluten'], papel: 'carbo', fonte: 'TACO', soDiario: true }, // TACO 167, "Açaí, polpa, com xarope de guaraná e glucose"
  { id: 'picole', nome: 'Picolé industrializado', cat: 'outros', kcal: 79, p: 0, c: 19.23, g: 0.24, fibra: 0, porcao: { g: 60, desc: '1 unidade' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 6900502 (picolé de qualquer sabor industrializado)

  // ---- Só para registrar: frituras, salgados, lanches, doces e bebidas (nov/2026) ----
  // Não são recomendados: servem para a pessoa saber as calorias do que comeu fora da sugestão. `soDiario` em todos (o
  // cardápio, as trocas e a lista "O que eu tenho em casa" nunca os usam) e sem faixa de preço (não entram em compra).
  // Composição por 100 g: TACO 4ª ed. (Tabela 1, número da linha) ou POF 2008-2009, "Tabelas de composição nutricional
  // dos alimentos consumidos no Brasil", Tabela 1 (código do alimento e, quando há, da preparação). Porção caseira: POF
  // 2008-2009, "Tabela de medidas referidas para os alimentos consumidos no Brasil" (código do IBGE no comentário).
  // Ambos os PDFs lidos em texto completo em 18/11/2026. "-" (não há) e Tr gravados como 0. Ficaram de fora por não haver
  // valor oficial: bolo recheado ou confeitado, lasanha comum (a POF só tem a "pronta light"), suco de caixinha (néctar).
  { id: 'frango-frito', nome: 'Frango frito (pedaços, com pele)', cat: 'carnes', kcal: 261.66, p: 27.3, c: 0, g: 16.16, fibra: 0, porcao: { g: 55, desc: '1 pedaço' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'IBGE', soDiario: true }, // 7800302, prep. 5 frito; medida 7800302 frito, pedaço
  { id: 'frango-frito-empanado', nome: 'Frango frito empanado (pedaços)', cat: 'carnes', kcal: 277.84, p: 27.76, c: 3.39, g: 16.21, fibra: 0.14, porcao: { g: 55, desc: '1 pedaço' }, nova: 3, tags: ['sem_lactose'], papel: 'proteina', fonte: 'IBGE', soDiario: true }, // 7800302, prep. 6 empanado; medida 7800302 empanado, pedaço
  { id: 'asa-de-frango-frita', nome: 'Asa de frango frita', cat: 'carnes', kcal: 312.66, p: 26.86, c: 0, g: 22.02, fibra: 0, porcao: { g: 40, desc: '1 unidade' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'IBGE', soDiario: true }, // 7800701, prep. 5 frito; medida 7800701, unidade (asa média)
  { id: 'peito-de-frango-assado-com-pele', nome: 'Peito de frango assado (com pele)', cat: 'carnes', kcal: 212, p: 33.4, c: 0, g: 7.6, fibra: 0, porcao: { g: 180, desc: '1 peito médio' }, nova: 1, tags: ['sem_lactose', 'sem_gluten'], papel: 'proteina', fonte: 'TACO', soDiario: true }, // TACO 406; medida 7800401, peito médio
  { id: 'nuggets-de-frango', nome: 'Nuggets de frango', cat: 'carnes', kcal: 273.02, p: 16.24, c: 15.91, g: 15.63, fibra: 0.64, porcao: { g: 23, desc: '1 unidade' }, nova: 4, tags: [], papel: 'proteina', fonte: 'IBGE', soDiario: true }, // 7802901, prep. 5 frito; medida 7802901, unidade
  { id: 'empada-de-frango', nome: 'Empada de frango', cat: 'outros', kcal: 358, p: 6.9, c: 47.5, g: 15.6, fibra: 2.2, porcao: { g: 55, desc: '1 unidade' }, nova: 3, tags: [], papel: 'carbo', fonte: 'TACO', soDiario: true }, // TACO 389 (pré-cozida, assada); medida 8500206, unidade
  { id: 'pastel-de-queijo-frito', nome: 'Pastel de queijo frito', cat: 'outros', kcal: 422, p: 8.7, c: 48.1, g: 22.7, fibra: 0.9, porcao: { g: 32, desc: '1 unidade média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO', soDiario: true }, // TACO 58; medida 8500202, unidade média
  { id: 'croquete-de-carne-frito', nome: 'Croquete de carne frito', cat: 'outros', kcal: 347, p: 16.9, c: 18.1, g: 22.7, fibra: 0, porcao: { g: 55, desc: '1 unidade grande' }, nova: 3, tags: [], papel: 'proteina', fonte: 'TACO', soDiario: true }, // TACO 388 (fibra em branco: não analisada); medida 8500203, unidade grande
  { id: 'esfiha-de-carne', nome: 'Esfiha de carne', cat: 'outros', kcal: 346.45, p: 11.9, c: 26.2, g: 21.38, fibra: 1.08, porcao: { g: 80, desc: '1 unidade média' }, nova: 3, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500223; medida 8500223, unidade
  { id: 'esfiha-de-queijo', nome: 'Esfiha de queijo', cat: 'outros', kcal: 359.42, p: 9.76, c: 37.51, g: 18.88, fibra: 1.46, porcao: { g: 80, desc: '1 unidade média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500224; medida 8500224, unidade
  { id: 'esfiha-de-frango', nome: 'Esfiha de frango', cat: 'outros', kcal: 222.39, p: 9.47, c: 17.32, g: 12.71, fibra: 0.78, porcao: { g: 80, desc: '1 unidade média' }, nova: 3, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500226; medida 8500226, unidade
  { id: 'enroladinho', nome: 'Enroladinho (salgado)', cat: 'outros', kcal: 274.6, p: 13.41, c: 16.54, g: 16.88, fibra: 0.88, porcao: { g: 27, desc: '1 unidade média' }, nova: 4, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500227; medida 8500227, unidade
  { id: 'risoles', nome: 'Risoles (carne, queijo, camarão)', cat: 'outros', kcal: 274.6, p: 13.41, c: 16.54, g: 16.88, fibra: 0.88, porcao: { g: 35, desc: '1 unidade média' }, nova: 3, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500207; medida 8500207, unidade
  { id: 'salgadinho-de-festa', nome: 'Salgadinho de festa (sortido, frito)', cat: 'outros', kcal: 274.6, p: 13.41, c: 16.54, g: 16.88, fibra: 0.88, porcao: { g: 10, desc: '1 unidade pequena' }, nova: 3, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500201; medida 8500201, unidade pequena
  { id: 'bolo-simples', nome: 'Bolo simples (sem recheio)', cat: 'cereais', kcal: 286.6, p: 6.91, c: 55.27, g: 4.24, fibra: 0.65, porcao: { g: 60, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8004601 "bolo de trigo"; medida 8004601, fatia (bolo branco simples)
  { id: 'bolo-de-cenoura', nome: 'Bolo de cenoura', cat: 'cereais', kcal: 344.86, p: 4.17, c: 44.27, g: 17.26, fibra: 1.61, porcao: { g: 60, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8004201; medida 8004201, fatia
  { id: 'bolo-de-laranja', nome: 'Bolo de laranja', cat: 'cereais', kcal: 360.83, p: 4.8, c: 58.32, g: 13.15, fibra: 2.36, porcao: { g: 60, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8004001; medida 8004001, fatia
  { id: 'bolo-de-coco', nome: 'Bolo de coco', cat: 'cereais', kcal: 333, p: 5.7, c: 52.3, g: 11.3, fibra: 1.1, porcao: { g: 60, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO', soDiario: true }, // TACO 17; medida 8004101, fatia
  { id: 'bolo-de-banana', nome: 'Bolo de banana', cat: 'cereais', kcal: 300.05, p: 3.93, c: 52.14, g: 9.07, fibra: 1.66, porcao: { g: 70, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8010601; medida 8010601, fatia
  { id: 'bolo-de-mandioca', nome: 'Bolo de mandioca (aipim)', cat: 'cereais', kcal: 324, p: 4.4, c: 47.9, g: 12.7, fibra: 0.7, porcao: { g: 80, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'carbo', fonte: 'TACO', soDiario: true }, // TACO 15; medida 8002701, fatia
  { id: 'torta-salgada', nome: 'Torta salgada', cat: 'outros', kcal: 249.55, p: 3.87, c: 38.4, g: 9.86, fibra: 1.49, porcao: { g: 110, desc: '1 pedaço' }, nova: 3, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8003601; medida 8003601, pedaço
  { id: 'empadao', nome: 'Empadão (frango, palmito, queijo)', cat: 'outros', kcal: 153.96, p: 7.89, c: 12.47, g: 7.91, fibra: 1.03, porcao: { g: 110, desc: '1 fatia média' }, nova: 3, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8505901; medida 8505901, fatia
  { id: 'quiche', nome: 'Quiche', cat: 'outros', kcal: 282.73, p: 10.34, c: 13.85, g: 20.44, fibra: 0.56, porcao: { g: 113, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8506801; medida 8506801, fatia
  { id: 'torta-doce', nome: 'Torta doce', cat: 'outros', kcal: 119.67, p: 2.28, c: 15.56, g: 5.38, fibra: 0.48, porcao: { g: 85, desc: '1 fatia média' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8003501; medida 8003501, fatia
  { id: 'pizza-portuguesa', nome: 'Pizza portuguesa', cat: 'outros', kcal: 247.49, p: 11.75, c: 22.4, g: 12.23, fibra: 1.56, porcao: { g: 125, desc: '1 fatia média' }, nova: 4, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500917; medida 8500917, fatia
  { id: 'hamburguer-sanduiche', nome: 'Hambúrguer (sanduíche)', cat: 'outros', kcal: 267.16, p: 13.08, c: 32.36, g: 9.22, fibra: 1.68, porcao: { g: 125, desc: '1 unidade média' }, nova: 4, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500303; medida 8500303, unidade
  { id: 'cachorro-quente', nome: 'Cachorro-quente', cat: 'outros', kcal: 272.47, p: 8.73, c: 24.8, g: 15.22, fibra: 1.09, porcao: { g: 125, desc: '1 unidade' }, nova: 4, tags: [], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8500302; medida 8500302, unidade
  { id: 'salgadinho-de-pacote', nome: 'Salgadinho de pacote (milho, trigo)', cat: 'outros', kcal: 558.86, p: 5.08, c: 55.41, g: 35.25, fibra: 2.76, porcao: { g: 84, desc: '1 pacote médio' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8002227 "chips (salgadinhos)"; medida 8002227, pacote médio
  { id: 'biscoito-recheado-morango', nome: 'Biscoito recheado de morango', cat: 'cereais', kcal: 471, p: 5.7, c: 71, g: 19.6, fibra: 1.5, porcao: { g: 13, desc: '1 unidade' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO', soDiario: true }, // TACO 10; medida 8004801, unidade
  { id: 'biscoito-wafer', nome: 'Biscoito wafer de chocolate', cat: 'cereais', kcal: 502, p: 5.6, c: 67.5, g: 24.7, fibra: 1.8, porcao: { g: 7.5, desc: '1 unidade' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'TACO', soDiario: true }, // TACO 11; medida 8004807, unidade
  { id: 'sorvete', nome: 'Sorvete de massa (industrializado)', cat: 'outros', kcal: 206, p: 3.6, c: 25.13, g: 11, fibra: 0.87, porcao: { g: 80, desc: '1 bola média' }, nova: 4, tags: ['vegetariano'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 6900501; medida 6900501, bola
  { id: 'brigadeiro', nome: 'Brigadeiro', cat: 'outros', kcal: 334.48, p: 7.52, c: 54.86, g: 10.14, fibra: 0.23, porcao: { g: 15, desc: '1 unidade média' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 6903601; medida 6903601, unidade média
  { id: 'pudim', nome: 'Pudim de leite', cat: 'outros', kcal: 131.15, p: 5.58, c: 15.44, g: 5.07, fibra: 0, porcao: { g: 130, desc: '1 fatia média' }, nova: 3, tags: ['vegetariano', 'sem_gluten'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 6902601 (pudim de qualquer sabor); medida 6902601, fatia
  { id: 'acai-com-granola', nome: 'Açaí com granola', cat: 'frutas', kcal: 110, p: 0.7, c: 21.5, g: 3.7, fibra: 1.7, porcao: { g: 273, desc: '1 copo médio' }, nova: 4, tags: ['vegetariano', 'sem_lactose'], papel: 'carbo', fonte: 'IBGE', soDiario: true }, // 8507801; medida 8507801, copo médio
  { id: 'milk-shake', nome: 'Milk-shake', cat: 'bebidas', kcal: 161.09, p: 3.11, c: 23.49, g: 6.43, fibra: 0.76, porcao: { g: 240, desc: '1 copo médio (240 mL)' }, nova: 4, tags: ['vegetariano'], papel: 'bebida', fonte: 'IBGE', soDiario: true }, // 6907501; medida 6907501, copo médio
  // cerveja: a energia da TACO inclui o álcool (3,6 g por 100 g, nota da tabela), que não está nos macronutrientes
  { id: 'cerveja', nome: 'Cerveja (pilsen)', cat: 'bebidas', kcal: 41, p: 0.6, c: 3.3, g: 0, fibra: 0, porcao: { g: 350, desc: '1 lata (350 mL)' }, nova: 4, tags: ['vegano', 'vegetariano', 'sem_lactose'], papel: 'bebida', fonte: 'TACO', soDiario: true }, // TACO 474; medida 8300101, lata de 350 mL
];
// ids da lista acima (só para registrar; sem preço): o teste confere que nenhum entra no cardápio
export const SO_REGISTRO = Object.freeze(['frango-frito', 'frango-frito-empanado', 'asa-de-frango-frita', 'peito-de-frango-assado-com-pele', 'nuggets-de-frango', 'empada-de-frango',
  'pastel-de-queijo-frito', 'croquete-de-carne-frito', 'esfiha-de-carne', 'esfiha-de-queijo', 'esfiha-de-frango', 'enroladinho', 'risoles', 'salgadinho-de-festa', 'bolo-simples', 'bolo-de-cenoura',
  'bolo-de-laranja', 'bolo-de-coco', 'bolo-de-banana', 'bolo-de-mandioca', 'torta-salgada', 'empadao', 'quiche', 'torta-doce', 'pizza-portuguesa', 'hamburguer-sanduiche', 'cachorro-quente',
  'salgadinho-de-pacote', 'biscoito-recheado-morango', 'biscoito-wafer', 'sorvete', 'brigadeiro', 'pudim', 'acai-com-granola', 'milk-shake', 'cerveja']);

// ---- Medidas caseiras do cardápio de exemplo ----
// Peso de cada medida caseira, da "Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil" (IBGE, POF
// 2008-2009 — ref pof2008medidas; PDF lido em nov/2026), com o código do alimento no IBGE. O cardápio mostra e ajusta as
// quantidades nessas medidas, inteiras ou em meio (logic/nutrition.js, PORCOES). [gramas, medida, fonte]
// Onde a tabela do IBGE não tem a medida (sardinha fresca, nozes, chia), vale a porção desta tabela de alimentos.
const IB = (c) => 'IBGE ' + c;
export const MEDIDAS = {
  'arroz-branco-cozido': [45, '1 colher de servir', IB(6300101)], 'arroz-integral-cozido': [45, '1 colher de servir', IB(6300101)],
  'macarrao-cozido': [110, '1 pegador', IB(6503401)], 'batata-inglesa-cozida': [140, '1 unidade média', IB(6400101)], 'mandioca-cozida': [100, '1 pedaço médio', IB(6400609)],
  'batata-doce-cozida': [100, '1 colher de servir', IB(6400401)], 'inhame-cozido': [60, '1 pedaço médio', IB(6400501)], 'cuscuz-de-milho-cozido': [135, '1 pedaço médio', IB(6902901)],
  'feijao-carioca-cozido': [140, '1 concha média', IB(6303102)], 'feijao-preto-cozido': [140, '1 concha média', IB(6303102)], 'lentilha-cozida': [160, '1 concha média', IB(6302901)],
  'grao-de-bico-cozido': [120, '1 concha média', IB(6302801)], 'soja-cozida': [57, '1 concha', IB(6303001)], 'proteina-de-soja-preparada': [48, '1 colher de servir', IB(6505601)],
  'peito-de-frango-grelhado': [100, '1 filé médio', IB(7800402)], 'peito-de-frango-cozido': [100, '1 filé médio', IB(7800402)], 'patinho-grelhado': [100, '1 bife médio', IB(7100501)],
  'coxao-mole-cozido': [100, '1 bife médio', IB(7109101)], 'carne-moida-cozida': [60, '1 colher de servir', IB(7104301)], 'sobrecoxa-de-frango-assada-sem-pele': [55, '1 pedaço', IB(7800302)],
  'lombo-suino-assado': [95, '1 pedaço médio', IB(7103701)], 'tilapia-grelhada': [120, '1 filé médio', IB(7400101)], 'merluza-assada': [120, '1 filé médio', IB(7200101)],
  'sardinha-assada': [40, '1 unidade média', 'porção da tabela'], 'ovo-cozido': [45, '1 unidade', IB(7803301)], tofu: [20, '1 fatia', IB(7903402)],
  'pao-frances': [50, '1 unidade', IB(8000105)], 'pao-de-forma-integral': [25, '1 fatia', IB(8000501)], 'tapioca-pronta': [50, '1 unidade', IB(6501516)],
  'aveia-em-flocos': [15, '1 colher de sopa cheia', IB(6500401)], 'pao-de-queijo-assado': [20, '1 unidade média', IB(8000801)],
  'queijo-minas-frescal': [30, '1 fatia média', IB(7907301)], 'queijo-mucarela': [20, '1 fatia média', IB(7901801)], ricota: [35, '1 fatia média', IB(7902201)],
  'queijo-cottage': [44, '1 colher de sopa cheia', IB(7902201)], 'pasta-de-amendoim': [12.5, '1 ponta de faca', IB(6901203)],
  'leite-integral': [200, '1 xícara de chá (200 mL)', IB(7900101)], 'leite-desnatado': [200, '1 xícara de chá (200 mL)', IB(7903601)], 'leite-de-soja': [200, '1 xícara de chá (200 mL)', IB(7902301)],
  'cafe-com-leite': [150, '1 copo americano (150 mL)', IB(8501303)], 'iogurte-natural': [200, '1 pote', IB(7901204)], 'manteiga-com-sal': [8, '1 colher de chá', IB(7901501)],
  'coco-cru': [40, '1 pedaço médio', IB(6600101)], chia: [12, '1 colher de sopa', 'porção da tabela'], mel: [15, '1 colher de sopa', IB(6901602)],
  'castanha-de-caju': [40, '1 punhado', IB(6600801)], 'castanha-do-para': [4, '1 unidade', IB(6600701)], nozes: [5, '1 unidade', 'porção da tabela'], amendoa: [1, '1 unidade', IB(6600501)],
  'amendoim-torrado-salgado': [17, '1 colher de sopa', IB(6301001)],
  'banana-prata': [75, '1 unidade', IB(6801101)], 'maca-fuji': [150, '1 unidade média', IB(6803001)], 'laranja-pera': [180, '1 unidade média', IB(6801801)], 'mamao-papaia': [170, '1 fatia média', IB(6803101)],
  abacaxi: [75, '1 fatia média', IB(6802601)], melancia: [200, '1 fatia média', IB(6803401)], 'manga-palmer': [140, '1 unidade', IB(6803201)], morango: [12, '1 unidade média', IB(6805201)],
  'goiaba-vermelha': [170, '1 unidade média', IB(6804201)], 'pera-williams': [130, '1 unidade média', IB(6803601)], 'tangerina-ponca': [135, '1 unidade média', IB(6802201)],
  'uva-italia': [170, '1 cacho pequeno', IB(6803901)], melao: [90, '1 fatia média', IB(6803501)], kiwi: [94, '1 unidade média', IB(6807801)], abacate: [45, '1 colher de sopa cheia', IB(6802701)],
  'alface-crespa': [10, '1 folha média', IB(6700101)], tomate: [15, '1 fatia média', IB(6705101)], rucula: [20, '1 pires', IB(6702001)], pepino: [18, '1 colher de sopa cheia', IB(6704001)],
  'cenoura-crua': [12, '1 colher de sopa cheia', IB(6401201)], 'repolho-branco-cru': [10, '1 colher de sopa cheia', IB(6700901)],
  'brocolis-cozido': [60, '1 ramo médio', IB(6701704)], 'abobrinha-cozida': [30, '1 colher de sopa cheia', IB(6703701)], 'cenoura-cozida': [40, '1 colher de servir', IB(6401201)],
  'couve-refogada': [20, '1 colher de sopa cheia', IB(6700501)], 'chuchu-cozido': [45, '1 colher de servir', IB(6704101)], 'beterraba-cozida': [38, '1 colher de servir', IB(6401101)],
  'couve-flor-cozida': [60, '1 ramo médio', IB(6700601)], 'vagem-cozida': [20, '1 colher de sopa cheia', IB(6705201)], 'abobora-cabotia-cozida': [36, '1 colher de sopa cheia', IB(6703901)],
  'quiabo-cozido': [40, '1 colher de sopa cheia', IB(6705001)], 'berinjela-cozida': [25, '1 colher de sopa cheia', IB(6705401)],
  'azeite-de-oliva': [8, '1 colher de sopa', IB(8400101)], 'oleo-de-soja': [8, '1 colher de sopa', IB(8400101)], 'farinha-de-mandioca-torrada': [16, '1 colher de sopa cheia', IB(6501401)],
};
// sucos: o copo médio de suco do IBGE (240 mL; códigos 8500402 a 8500418)
for (const id of ['suco-de-laranja-natural', 'suco-de-abacaxi', 'suco-de-maracuja', 'suco-de-acerola', 'suco-de-caju', 'suco-de-goiaba', 'suco-de-manga', 'suco-de-tangerina', 'suco-de-melao', 'suco-de-mamao', 'suco-de-morango', 'suco-de-uva-integral']) MEDIDAS[id] = [240, '1 copo médio (240 mL)', IB(8500402)];

// ---- Bebidas com açúcar ----
// A POF 2008-2009 dá o café e os sucos naturais sem açúcar: o açúcar entrava à parte na análise (ref pof2008, notas da
// publicação). A POF 2017-2018 conta cada açúcar adicionado como no máximo 10% do peso do alimento (Notas técnicas, itens
// de adição — ref pof2017). A versão com açúcar é a bebida da tabela com 10% do peso em açúcar refinado (TACO): 100 g da
// bebida + 10 g de açúcar, por 100 g do que se toma. Só para registrar no diário: o cardápio de exemplo não adoça.
const COM_ACUCAR = [
  ['cafe-com-leite', 'cafe-com-leite-com-acucar', 'Café com leite com açúcar'],
  ['cafe-sem-acucar', 'cafe-com-acucar', 'Café coado com açúcar'],
  ['suco-de-laranja-natural', 'suco-de-laranja-com-acucar', 'Suco de laranja natural com açúcar'],
  ['suco-de-abacaxi', 'suco-de-abacaxi-com-acucar', 'Suco de abacaxi natural com açúcar'],
  ['suco-de-acerola', 'suco-de-acerola-com-acucar', 'Suco de acerola natural com açúcar'],
  ['suco-de-goiaba', 'suco-de-goiaba-com-acucar', 'Suco de goiaba natural com açúcar'],
  ['suco-de-manga', 'suco-de-manga-com-acucar', 'Suco de manga natural com açúcar'],
  ['suco-de-maracuja', 'suco-de-maracuja-com-acucar', 'Suco de maracujá natural com açúcar'],
  ['suco-de-morango', 'suco-de-morango-com-acucar', 'Suco de morango natural com açúcar'],
  ['suco-de-tangerina', 'suco-de-tangerina-com-acucar', 'Suco de tangerina natural com açúcar'],
  ['suco-de-caju', 'suco-de-caju-com-acucar', 'Suco de caju com açúcar'],
];
export const ACUCAR_ADICIONADO = 0.1;
{
  const acucar = ALIMENTOS.find((f) => f.id === 'acucar-refinado');
  const r2 = (v) => Math.round(v * 100) / 100;
  for (const [de, id, nome] of COM_ACUCAR) {
    const b = ALIMENTOS.find((f) => f.id === de);
    const mistura = (k) => r2((b[k] + ACUCAR_ADICIONADO * acucar[k]) / (1 + ACUCAR_ADICIONADO));
    ALIMENTOS.push({ id, nome, cat: b.cat, kcal: mistura('kcal'), p: mistura('p'), c: mistura('c'), g: mistura('g'), fibra: mistura('fibra'), porcao: { ...b.porcao }, nova: b.nova, tags: b.tags.filter((t) => acucar.tags.includes(t)), papel: 'bebida', fonte: b.fonte, soDiario: true, base: de });
  }
}
// Outros nomes que as pessoas usam para buscar no diário (cada palavra vale como uma palavra do nome)
const APELIDOS = {
  'cafe-sem-acucar': 'cafezinho preto puro', 'cafe-com-acucar': 'cafezinho adocado', 'cafe-com-leite': 'pingado media', 'cafe-com-leite-com-acucar': 'pingado media adocado',
  'leite-achocolatado': 'leite com achocolatado chocolate', 'suco-de-laranja-natural': 'sem acucar', 'refrigerante-de-cola': 'refri coca', 'refrigerante-de-guarana': 'refri',
  'refrigerante-de-cola-zero': 'refri coca diet light', 'refrigerante-de-guarana-zero': 'refri diet light', 'refrigerante-de-laranja': 'refri', 'refrigerante-de-limao': 'refri soda',
  'bebida-isotonica': 'isotonico', 'vitamina-de-banana': 'batida', 'pao-com-manteiga': 'pao na chapa', 'misto-quente': 'misto frio sanduiche de queijo e presunto',
  'acai-na-tigela': 'acai', 'picole': 'sorvete de palito', 'suco-de-uva-integral': 'sem acucar', 'suco-de-caju-com-acucar': 'cajuada refresco',
  // frituras, salgados e lanches: "salgado", "fritura", "lanche" e os nomes do dia a dia ("x-salada", "à passarinho")
  'frango-frito': 'fritura passarinho a passarinho torrado galinha', 'frango-frito-empanado': 'fritura crocante milanesa galinha', 'asa-de-frango-frita': 'fritura asinha galinha',
  'peito-de-frango-assado-com-pele': 'galinha', 'nuggets-de-frango': 'fritura empanado', 'coxinha-de-frango': 'salgado fritura', 'pastel-de-carne-frito': 'salgado fritura feira',
  'pastel-de-queijo-frito': 'salgado fritura feira', 'quibe-frito': 'kibe salgado fritura', 'quibe-assado': 'kibe salgado', 'croquete-de-carne-frito': 'salgado fritura',
  'empada-de-frango': 'salgado', 'esfiha-de-carne': 'esfirra salgado', 'esfiha-de-queijo': 'esfirra salgado', 'esfiha-de-frango': 'esfirra salgado',
  enroladinho: 'salgado salsicha fritura', risoles: 'rissole salgado fritura', 'salgadinho-de-festa': 'salgado fritura coquetel', 'batata-inglesa-frita': 'fritas palito fritura',
  'mandioca-frita': 'fritura', 'batata-chips': 'salgadinho', 'salgadinho-de-pacote': 'chips', 'hamburguer-sanduiche': 'hamburger lanche x-burguer x-salada xis sanduiche',
  'cachorro-quente': 'hot dog lanche sanduiche', 'misto-quente': 'lanche', 'pizza-portuguesa': 'lanche', 'pizza-de-mucarela': 'mussarela lanche', 'pizza-de-calabresa': 'lanche',
  'biscoito-recheado': 'bolacha', 'biscoito-recheado-morango': 'bolacha', 'biscoito-wafer': 'bolacha', 'bolo-simples': 'trigo caseiro branco', 'empadao': 'torta salgada',
  'torta-doce': 'sobremesa', 'pudim': 'sobremesa', 'sorvete': 'sobremesa', 'brigadeiro': 'doce docinho', 'acai-com-granola': 'tigela', 'cerveja': 'chope chopp',
};
for (const f of ALIMENTOS) if (APELIDOS[f.id]) f.apelidos = APELIDOS[f.id];
// Industrializados e doces que já estavam na tabela: também só para o diário
const SO_DIARIO = ['refrigerante-de-cola', 'refrigerante-de-guarana', 'bebida-isotonica', 'biscoito-recheado', 'bolo-de-chocolate', 'batata-chips', 'coxinha-de-frango', 'pastel-de-carne-frito',
  'chocolate-ao-leite', 'chocolate-meio-amargo', 'leite-condensado', 'macarrao-instantaneo', 'salsicha', 'pacoca', 'pe-de-moleque', 'goiabada', 'bananada', 'rapadura', 'doce-de-leite', 'melado',
  'achocolatado-em-po', 'acucar-refinado', 'acucar-cristal', 'acucar-mascavo'];
for (const f of ALIMENTOS) if (SO_DIARIO.includes(f.id)) f.soDiario = true;

// ---------- Faixa de preço de cada alimento ----------
// Preço muda com o tempo, a cidade e a loja. Por isso o aplicativo NÃO mostra reais: guarda só uma faixa relativa
// (1 barato, 2 médio, 3 caro), calculada aqui a partir de preços de referência pesquisados em novembro de 2026.
//
// Fontes (código usado na tabela → pesquisa, lugar e data da coleta):
//   PS  Procon-SP/Dieese, cesta básica, supermercados da cidade de São Paulo, preços médios de 30/09/2026
//       (relatório de 15/10/2026). Padarias da capital: coleta de 22 e 23/09/2026.
//   DP  DERAL/SEAB-PR, Portaria nº 32 de 27/07/2026 (DOE-PR 29/07/2026): preços médios em feiras do produtor do Paraná
//       (média das pesquisas de set/2025, mar/2026 e jun/2026). Base das frutas, verduras e legumes.
//   MM  Mercado Mineiro/comOferta, açougues e supermercados de Belo Horizonte e região, 5 a 7/10/2026 (carnes);
//       Mercado Central de BH, 8 a 10/07/2026 (queijos e doce de leite).
//   MS  Procon-MS, Campo Grande: peixarias (mar/2026), itens de festa junina (25 e 26/05/2026), cesta básica (5 e 6/10/2026).
//   GO  Procon Goiás, pescados, 21 lojas de Goiânia, 16 a 23/03/2026.
//   UF  IEPE/UFRGS, pesquisa da ceia de Natal, supermercados de Porto Alegre, nov–dez/2025 (castanhas, azeite, lentilha).
//   AN  Procon Anápolis (GO), carnes em 6 supermercados, 26 a 28/01/2026 (costela, fraldinha, linguiça de frango).
//   RN  EMATER-RN, Portaria SEI nº 206 de 06/05/2026 (DOE-RN 08/05/2026): preços médios da agricultura familiar em 42
//       municípios do Rio Grande do Norte, de ago/2024 a jul/2025 (frutas regionais, castanha, doces, laticínios).
//   SD  Sonda Supermercados, loja on-line de São Paulo, preços de prateleira em 13/11/2026 (refrigerantes, pizzas, açaí e
//       picolé: 16/11/2026): mediana dos produtos comuns de cada busca, um alimento por consulta. É uma rede só, num dia
//       só: vale para a faixa, não como preço médio.
//   MF  Super Muffato, loja on-line (Paraná), preços de prateleira em 13/11/2026, um alimento por consulta. Usado quando o
//       produto não aparecia no Sonda. Mesma ressalva: uma rede, um dia.
//   CG  Ceasa-GO (Goiânia), cotação diária de 10/11/2026: preço mais comum no ATACADO. No varejo custa mais; só entra onde
//       a faixa não muda com isso (jiló continua barato mesmo pelo dobro; jaca e figo já saem caros no atacado).
//   NT  último recurso, quando nenhuma pesquisa de preço nem loja tinha o alimento: preço citado em notícia de jornal, em
//       pesquisa de Procon divulgada pela imprensa, em comparador de preços ou em indicador de mercado. A origem e a data
//       ficam no comentário da linha.
//   RC  receita: custo de 1 kg do prato pronto, somado em código (RECEITAS, abaixo da tabela) com os ingredientes e as
//       quantidades da receita que a própria TACO analisou e os preços pesquisados desta tabela. É uma conta, não uma
//       coleta de preço.
//   MX  mistura: custo de 1 kg de bebida ou sanduíche montado com alimentos desta tabela (MISTURAS, abaixo), pelos preços
//       pesquisados deles. Também é uma conta: café com leite, bebidas com açúcar, pão com ovo, misto-quente.
// Não sobrou alimento com preço estimado "pelo parecido": todos têm fonte e data.
// Conferência cruzada (não entram na conta): Conab/Prohort, boletim hortigranjeiro de set/2026 (atacado das Ceasas,
// ago/2026); Dieese/Conab, cesta básica nas 27 capitais, set/2026; Procon Anápolis (cesta básica, mar/2026).
// Faixas perto do limite (mudariam com 30% a mais ou a menos no preço): ricota, whey, ovo de codorna, abadejo, lagarto,
// cupim, quibe, cação, corvina, leite em pó desnatado, creme de leite, os óleos de girassol e canola e, entre as
// receitas, canjica, baião de dois, feijão-tropeiro e omelete.
//
// Tabela: id → [R$ por quilo (ou litro) do produto como é vendido, rendimento, fonte].
// Rendimento = quilos de alimento pronto para comer (no estado do nome, só a parte comestível) que saem de 1 kg comprado:
// arroz e feijão crescem ao cozinhar (2,8 e 3), carnes encolhem (0,7), frutas perdem casca e caroço. São aproximações.
const PRECO_REF = {
  // cereais, pães e massas
  'arroz-branco-cozido': [4.25, 2.8, 'PS'],                    // pacote de 5 kg a R$ 21,27
  'arroz-integral-cozido': [10.5, 2.6, 'SD'],
  'macarrao-cozido': [6.62, 2.4, 'PS'],                        // 500 g a R$ 3,31
  'pao-frances': [18.02, 1, 'PS'],
  'pao-de-forma-integral': [25.2, 1, 'SD'],
  'aveia-em-flocos': [28.8, 1, 'SD'],
  'tapioca-pronta': [14.94, 0.83, 'SD'], // goma hidratada, 500 g a R$ 7,47
  'cuscuz-de-milho-cozido': [8.27, 3, 'MS'],                   // flocão de milho, 500 g a R$ 4,14
  granola: [64.2, 1, 'SD'],
  'pipoca-com-oleo': [11, 1, 'MS'],                            // milho de pipoca, 400 g a R$ 4,40
  'milho-verde-enlatado': [21.6, 1, 'MS'],                     // sachê de 170 g a R$ 3,67
  'farinha-de-mandioca-torrada': [14.8, 1, 'PS'],
  'biscoito-cream-cracker': [20.6, 1, 'MS'],
  'cereal-matinal-de-milho': [41.1, 1, 'SD'],
  'quinoa-cozida': [93.7, 2.9, 'SD'], // 200 g a cerca de R$ 18,70
  'pao-de-queijo-assado': [73.44, 1, 'PS'],                    // padarias da capital, por quilo
  // raízes e tubérculos
  'batata-inglesa-cozida': [4.54, 0.95, 'DP'],
  'batata-inglesa-assada': [4.54, 0.85, 'DP'],
  'batata-inglesa-frita': [4.54, 0.5, 'DP'],
  'batata-doce-cozida': [4.28, 0.9, 'DP'],
  'mandioca-cozida': [8.48, 1, 'DP'],                          // já descascada
  'inhame-cozido': [8.43, 0.85, 'DP'],
  'mandioquinha-cozida': [9.68, 0.85, 'DP'],
  // feijões e leguminosas
  'feijao-carioca-cozido': [8.38, 3, 'PS'],
  'feijao-preto-cozido': [8.67, 3, 'DP'],
  'lentilha-cozida': [17.74, 2.8, 'UF'],                       // 500 g a R$ 8,87
  'grao-de-bico-cozido': [24.8, 2.3, 'MS'], // 400 g a R$ 9,90 (ceia de Natal, dez/2025)
  'ervilha-enlatada': [25.2, 1, 'SD'], // lata de 170 g a R$ 4,28
  'soja-cozida': [2.55, 2.3, 'NT'], // indicador Cepea/Esalq, interior do PR, 10/11/2026: R$ 152,70 a saca de 60 kg (atacado; no pacote custa mais)
  tofu: [68.3, 1, 'MF'], // um só produto: 300 g a R$ 20,50
  'proteina-de-soja-texturizada': [22.4, 1, 'SD'], // 400 g a R$ 8,97
  // a mesma proteína seca, hidratada: 1 kg seco rende 2,48 kg prontos (a conta da proteína: 45,9 g seca ÷ 18,51 g pronta)
  'proteina-de-soja-preparada': [22.4, 2.48, 'SD'],
  // carnes e aves
  'peito-de-frango-grelhado': [25.76, 0.72, 'MM'],             // filé de peito
  'peito-de-frango-cozido': [25.76, 0.75, 'MM'],
  'sobrecoxa-de-frango-assada-sem-pele': [14.93, 0.45, 'DP'],  // comprada com osso e pele
  'patinho-grelhado': [50.71, 0.7, 'PS'],                      // "carne de primeira"
  'carne-moida-cozida': [33.86, 0.72, 'PS'],                   // "carne de segunda sem osso"
  'alcatra-grelhada': [57.7, 0.7, 'MM'],
  'contrafile-grelhado': [59.92, 0.7, 'MM'],
  'coxao-mole-cozido': [54.2, 0.68, 'MM'],
  'file-mignon-grelhado': [83.59, 0.72, 'MM'],
  'picanha-grelhada': [78.57, 0.72, 'MM'],
  'figado-bovino-grelhado': [22.89, 0.7, 'MM'],
  'lombo-suino-assado': [25.03, 0.7, 'MM'],
  'pernil-suino-assado': [22.87, 0.5, 'MM'],                   // comprado com osso
  'peito-de-peru-defumado': [69.9, 1, 'SD'],
  'presunto-cozido': [32.51, 1, 'PS'],
  'carne-seca-cozida': [72.5, 0.8, 'SD'], // jerked beef
  'linguica-de-porco-grelhada': [23.37, 0.75, 'PS'],
  // peixes e frutos do mar
  'tilapia-grelhada': [47.1, 0.8, 'MS'],                       // filé: média de MS (51,10), GO (42,47) e DP (47,73)
  'sardinha-assada': [24.9, 0.55, 'MS'],                       // limpa; inteira em GO: R$ 19,65 a 23,39
  'sardinha-em-conserva': [64.8, 1, 'MS'],                     // lata de 125 g a R$ 8,10
  'atum-em-conserva': [133.8, 1, 'SD'], // lata de 120 g
  'salmao-grelhado': [110.8, 0.8, 'MS'],
  'merluza-assada': [45, 0.8, 'MS'],                           // filé congelado: R$ 42 a 50 o quilo
  'camarao-cozido': [95.45, 0.7, 'MS'],
  // ovos e laticínios
  'ovo-cozido': [17, 1, 'PS'],                                 // dúzia a R$ 10,20; 50 g comestíveis por ovo
  'clara-de-ovo-cozida': [24.3, 1, 'PS'],                      // paga-se o ovo inteiro (R$ 0,85) por 35 g de clara
  'ovo-frito': [17, 0.9, 'PS'],
  'leite-integral': [5.76, 1, 'PS'],
  'leite-semidesnatado': [6.92, 1, 'SD'],
  'leite-desnatado': [6.59, 1, 'SD'],
  'iogurte-natural': [21, 1, 'SD'], // pote de 170 g a R$ 3,57
  'iogurte-natural-desnatado': [21, 1, 'SD'],
  'queijo-minas-frescal': [51.3, 1, 'SD'],
  'queijo-mucarela': [56.29, 1, 'PS'],
  'queijo-prato': [65.9, 1, 'SD'],
  'queijo-parmesao': [59.9, 1, 'MM'],
  'queijo-cottage': [49.95, 1, 'SD'], // um só produto comum: 400 g a R$ 19,98
  ricota: [43.9, 1, 'MF'],
  'requeijao-cremoso': [51.6, 1, 'SD'], // copos de 190–200 g a R$ 7,69 e R$ 12,31
  // frutas
  'banana-prata': [6.37, 0.65, 'DP'],
  'banana-nanica': [4.7, 0.65, 'DP'],
  'maca-fuji': [10.53, 0.9, 'DP'],
  'laranja-pera': [3.95, 0.7, 'DP'],
  'mamao-papaia': [6.57, 0.65, 'DP'],
  abacaxi: [7.02, 0.55, 'DP'],
  melancia: [3.3, 0.55, 'DP'],
  'manga-palmer': [7.67, 0.65, 'DP'],
  'uva-italia': [13.14, 0.95, 'DP'],
  morango: [28.32, 0.95, 'DP'],
  abacate: [5.05, 0.65, 'DP'],
  'goiaba-vermelha': [8.52, 0.95, 'DP'],
  'acai-polpa-congelada': [65.75, 1, 'MF'], // um só produto: 400 g a R$ 26,30
  'pera-williams': [14.66, 0.9, 'DP'],
  melao: [7.41, 0.55, 'DP'],
  'tangerina-ponca': [4.72, 0.7, 'DP'],
  kiwi: [32.7, 0.85, 'SD'],
  'limao-tahiti': [4.43, 0.6, 'DP'],
  'coco-cru': [6.06, 0.35, 'RN'], // coco seco inteiro: a polpa é cerca de um terço do peso
  // verduras e legumes
  'alface-crespa': [9.49, 0.8, 'DP'],
  rucula: [12.9, 0.8, 'DP'],
  tomate: [6.78, 0.95, 'DP'],
  'cenoura-crua': [5.59, 0.85, 'DP'],
  'cenoura-cozida': [5.59, 0.8, 'DP'],
  'brocolis-cozido': [9.54, 0.6, 'DP'],
  'couve-refogada': [11.85, 0.7, 'DP'],
  'espinafre-refogado': [9.93, 0.5, 'DP'],
  'abobrinha-cozida': [5.58, 0.9, 'DP'],
  'abobora-cabotia-cozida': [7.26, 0.95, 'DP'],                // já descascada e picada
  'chuchu-cozido': [5.17, 0.8, 'DP'],
  'beterraba-cozida': [5.89, 0.85, 'DP'],
  pepino: [5.99, 0.95, 'DP'],
  'repolho-branco-cru': [4.17, 0.85, 'DP'],
  'couve-flor-cozida': [8.79, 0.55, 'DP'],
  'vagem-cozida': [16.08, 0.9, 'DP'],
  'quiabo-cozido': [12.38, 0.9, 'DP'],
  'cebola-crua': [4.64, 0.9, 'DP'],
  'berinjela-cozida': [6.29, 0.85, 'DP'],
  // castanhas, sementes e gorduras
  'azeite-de-oliva': [96.5, 1, 'UF'],                          // 500 mL a R$ 44,13
  'oleo-de-soja': [9.31, 1, 'PS'],                             // 900 mL a R$ 7,71
  'manteiga-com-sal': [46.11, 1, 'DP'],
  'margarina-com-sal': [15.8, 1, 'PS'],                        // 250 g a R$ 3,95
  'pasta-de-amendoim': [48.9, 1, 'SD'], // um só produto: 450 g a R$ 21,99
  'amendoim-torrado-salgado': [48.85, 1, 'SD'],
  'castanha-do-para': [162.37, 1, 'UF'],
  'castanha-de-caju': [205, 1, 'SD'], // 150 g a R$ 30,79; no produtor, no RN, R$ 64,68 o quilo
  amendoa: [111.47, 1, 'UF'],
  nozes: [138.95, 1, 'UF'],
  chia: [117, 1, 'SD'], // média de três preços (72, 109 e 171 por quilo)
  linhaca: [60, 1, 'SD'],
  // bebidas
  'cafe-sem-acucar': [47.76, 10, 'PS'],                        // pó: 500 g a R$ 23,88; 1 kg de pó rende cerca de 10 litros
  'suco-de-laranja-natural': [3.95, 0.45, 'DP'],               // laranja-pera: 1 kg rende cerca de 450 mL
  'agua-de-coco': [12.95, 1, 'SD'],
  'leite-de-soja': [8.49, 1, 'SD'],
  'refrigerante-de-cola': [4.57, 1, 'UF'],                     // garrafa de 2 L a R$ 9,13
  'bebida-isotonica': [10.98, 1, 'SD'], // 500 mL a R$ 5,49
  // outros
  'whey-protein': [207, 1, 'NT'], // mediana de 5 potes de 900 g no Buscapé (11/05/2026); no supermercado (SD), R$ 324 a 406 o quilo
  mel: [37.39, 1, 'DP'],
  'acucar-refinado': [3.53, 1, 'PS'],                          // 5 kg a R$ 17,67
  'chocolate-meio-amargo': [155, 1, 'SD'], // um só produto: 80 g a R$ 12,42
  'chocolate-amargo-70': [156.6, 1, 'SD'], // um só produto: 80 g a R$ 12,53
  'doce-de-leite': [36.77, 1, 'MM'],
  'achocolatado-em-po': [35.6, 1, 'SD'],
  pacoca: [41, 1, 'MS'],
  // ---- alimentos da lista "O que eu tenho em casa" (mesmas fontes) ----
  // cereais, pães e massas
  'pao-de-forma': [13.68, 1, 'PS'],                            // 500 g a R$ 6,84
  torrada: [38.4, 1, 'SD'],
  'macarrao-instantaneo': [45.2, 1, 'SD'], // pacote de 85 g a R$ 3,84
  'biscoito-maisena': [18.05, 1, 'PS'],                        // 200 g a R$ 3,61
  'biscoito-recheado': [20.4, 1, 'PS'],                        // 140 g a R$ 2,86
  'biscoito-de-polvilho': [27.09, 1, 'RN'], // "biscoito sequilhos"
  'bolo-de-milho': [19.23, 1, 'DP'],                           // "cuca/bolo simples"
  'bolo-de-chocolate': [21, 1, 'RN'], // média de 9 bolos caseiros
  'polenta-cozida': [6.78, 3.5, 'MS'],                         // fubá
  'lasanha-massa-cozida': [24.7, 2.4, 'SD'], // massa seca
  'nhoque-de-batata-cozido': [25.84, 1.1, 'SD'],
  'milho-verde-espiga': [7, 0.45, 'DP'],                       // sem palha; os grãos são menos da metade do peso
  pamonha: [49.6, 1, 'MF'], // R$ 12,40 a unidade (cerca de 250 g)
  // raízes e tubérculos
  'cara-cozido': [7.29, 0.85, 'DP'],
  'mandioca-frita': [8.48, 0.8, 'DP'],
  'batata-saute': [4.54, 0.9, 'DP'],
  'batata-chips': [88.1, 1, 'SD'], // pacote de 68 g a R$ 5,99; batata palha no Procon-MS: R$ 61 o quilo
  'pinhao-cozido': [13.53, 0.75, 'DP'],
  // feijões e leguminosas
  'feijao-fradinho-cozido': [12.05, 3, 'RN'], // "feijão macaçar"
  'feijao-roxo-cozido': [11.15, 3, 'DP'],                      // "feijão cores"
  'feijao-jalo-cozido': [11.15, 3, 'DP'],
  'ervilha-fresca': [27.05, 0.95, 'DP'], // "ervilha torta"; na Ceasa-GO, R$ 6,50 no atacado
  // carnes e aves
  'coxa-de-frango-cozida': [13.59, 0.45, 'MM'],                // comprada com osso e pele
  'coxa-de-frango-assada-com-pele': [13.59, 0.55, 'MM'],
  'sobrecoxa-de-frango-assada-com-pele': [14.93, 0.55, 'DP'],
  'frango-assado-sem-pele': [11.21, 0.4, 'PS'],                // frango inteiro resfriado
  'file-de-frango-a-milanesa': [25.76, 0.85, 'MM'],
  'coracao-de-frango-grelhado': [42.32, 0.7, 'MM'],
  'musculo-bovino-cozido': [40.01, 0.65, 'MM'],
  'acem-cozido': [33.86, 0.65, 'PS'],                          // "carne de segunda sem osso"
  'lagarto-cozido': [64.9, 0.65, 'SD'],
  'coxao-duro-cozido': [49.48, 0.65, 'MM'],                    // "chã de fora"
  'maminha-grelhada': [53.37, 0.7, 'MM'],
  'costela-bovina-assada': [22.66, 0.45, 'AN'],                // comprada com osso
  'fraldinha-cozida': [44.96, 0.65, 'AN'],
  'cupim-assado': [54.9, 0.65, 'SD'], // um só produto: 1,5 kg a R$ 82,34
  'charque-cozido': [72.5, 0.8, 'SD'], // jerked beef
  'almondegas-fritas': [52.1, 0.8, 'SD'],
  'hamburguer-bovino-grelhado': [47.3, 0.8, 'SD'],
  'bisteca-suina-grelhada': [25.63, 0.6, 'DP'],
  'costela-suina-assada': [29.28, 0.5, 'MM'],
  'linguica-de-frango-grelhada': [28.46, 0.75, 'AN'],
  mortadela: [26.95, 1, 'SD'], // um só produto comum: 200 g a R$ 5,39
  salame: [142, 1, 'MS'], // 100 g a R$ 14,20
  salsicha: [13.15, 1, 'PS'],
  'peru-assado': [38.02, 0.5, 'UF'],                           // comprado inteiro
  'bacon-frito': [78.4, 0.4, 'SD'],
  'quibe-assado': [50.6, 1, 'MF'], // um só produto: 500 g a R$ 25,30
  'quibe-frito': [50.6, 1, 'MF'],
  // peixes
  'pescada-frita': [52.75, 0.8, 'DP'],                         // filé congelado
  'cacao-cozido': [47.6, 0.8, 'MF'], // um só produto: postas, 800 g a R$ 38,10
  'corvina-assada': [31.9, 0.75, 'NT'], // posta: R$ 15,90 a 45,78 no Recife (Procon-PE) e R$ 28,29 a 37,48 em João Pessoa (Procon-PB), Semana Santa de 2026
  'pintado-grelhado': [59.75, 0.75, 'MS'],                     // em postas
  'bacalhau-refogado': [121.21, 1, 'UF'],
  'sardinha-frita': [24.9, 0.55, 'MS'],
  'abadejo-grelhado': [57, 0.8, 'SD'], // filé de polaca, vendido como abadejo
  'merluza-frita': [45, 0.8, 'MS'],
  // ovos e laticínios
  'ovo-de-codorna': [36.6, 1, 'NT'], // bandeja de 30: R$ 9,96 em Belém (O Liberal, mar/2026) e R$ 11,99 no Pão de Açúcar; na Ceasa-GO, R$ 17,50 o quilo no atacado
  'leite-em-po-integral': [44.75, 1, 'PS'],                    // 400 g a R$ 17,90
  'leite-em-po-desnatado': [79.1, 1, 'SD'],
  'iogurte-de-morango': [18.4, 1, 'SD'], // um só produto: 800 g a R$ 14,73
  'bebida-lactea': [4.87, 1, 'RN'],
  'leite-fermentado': [25.1, 1, 'SD'],
  'leite-achocolatado': [13.95, 1, 'SD'], // caixinha de 200 mL a R$ 2,79
  'queijo-minas-meia-cura': [39.9, 1, 'MM'],
  'creme-de-leite': [27.1, 1, 'SD'],
  // frutas
  'banana-da-terra': [10.79, 0.65, 'MS'],
  'banana-maca': [6.37, 0.65, 'DP'],
  acerola: [6.38, 0.85, 'RN'],
  ameixa: [30.4, 0.9, 'SD'], // importada; na Ceasa-GO, a nacional sai a R$ 9,38 no atacado
  caqui: [8.18, 0.9, 'DP'],
  caju: [5.68, 0.9, 'RN'],
  jabuticaba: [39, 0.7, 'NT'], // R$ 39 a 74 o quilo (Diario de Pernambuco, mai/2026)
  jaca: [5, 0.3, 'CG'], // atacado: fruta inteira de 7 kg a R$ 35
  maracuja: [10.24, 0.4, 'DP'],
  pessego: [11.59, 0.9, 'MS'],
  figo: [100, 0.95, 'CG'], // atacado: figo maduro roxo, caixa a R$ 100, registrada com 1 kg
  'laranja-lima': [7.49, 0.7, 'DP'],
  'laranja-baia': [7.49, 0.7, 'DP'],
  'maca-argentina': [10.53, 0.9, 'DP'],
  'mamao-formosa': [6.57, 0.7, 'DP'],
  'manga-tommy': [7.67, 0.65, 'DP'],
  'uva-rubi': [13.14, 0.95, 'DP'],
  pinha: [10.3, 0.5, 'RN'],
  'goiaba-branca': [8.52, 0.95, 'DP'],
  'polpa-de-acerola': [19.69, 1, 'DP'],
  'polpa-de-maracuja': [19.69, 1, 'DP'],
  'pessego-em-calda': [30.7, 1, 'UF'],                         // lata (450 g drenados) a R$ 13,83
  // verduras e legumes
  'alface-americana': [9.49, 0.8, 'DP'],
  'alface-lisa': [9.49, 0.8, 'DP'],
  acelga: [6.2, 0.85, 'DP'],
  agriao: [11.9, 0.7, 'DP'],
  almeirao: [8.04, 0.8, 'DP'],
  'repolho-roxo-cru': [4.17, 0.85, 'DP'],
  'pimentao-verde': [9.52, 0.85, 'DP'],
  rabanete: [8.89, 0.8, 'DP'],
  'couve-crua': [11.85, 0.8, 'DP'],
  'palmito-em-conserva': [79.7, 1, 'SD'], // vidro de 300 g a R$ 23,90
  jilo: [3.53, 0.9, 'CG'], // atacado: caixa de 17 kg a R$ 60
  maxixe: [7.28, 0.9, 'DP'],
  'abobora-moranga-refogada': [7.26, 0.9, 'DP'],
  'abobrinha-refogada': [5.58, 0.85, 'DP'],
  'seleta-de-legumes': [21.1, 1, 'SD'], // um só produto: 170 g a R$ 3,59
  'molho-de-tomate': [9.7, 1, 'MS'],                           // sachê de 300 g a R$ 2,91
  // gorduras
  'azeitona-verde': [43.31, 1, 'UF'],
  'oleo-de-girassol': [26.7, 1, 'SD'], // um só produto: 900 mL a R$ 21,99
  'oleo-de-milho': [23, 1, 'SD'],
  'oleo-de-canola': [29.3, 1, 'SD'], // um só produto: 900 mL a R$ 24,19
  maionese: [21.1, 1, 'MS'],                                   // pote de 500 g a R$ 10,55
  'leite-de-coco': [35.2, 1, 'SD'], // 200 mL a R$ 7,03
  gergelim: [135.6, 1, 'SD'],
  'amendoim-cru': [30.8, 1, 'MS'],                             // 400 g a R$ 12,30
  // bebidas
  'refrigerante-de-guarana': [4.57, 1, 'UF'],
  'suco-de-uva-integral': [16.95, 1, 'DP'],
  'caldo-de-cana': [16, 1, 'NT'], // R$ 8 o copo de 500 mL (Campo Grande News, 03/02/2025)
  'cha-mate': [26.3, 66, 'MS'], // erva: 250 g a R$ 6,57; 1 kg rende cerca de 66 litros
  // Sucos naturais: preço da fruta (a mesma linha da fruta, acima) e rendimento em suco. O rendimento é a conta do
  // carboidrato, como nos pratos prontos: parte comestível × carboidrato da fruta (TACO) ÷ carboidrato do suco (tabela
  // da composição) — ex.: maracujá, 0,4 × 12,3 ÷ 14,48 = 0,34 kg de suco por quilo comprado.
  'suco-de-abacaxi': [7.02, 0.52, 'DP'], 'suco-de-acerola': [6.38, 1.41, 'RN'], 'suco-de-goiaba': [8.52, 0.79, 'DP'], 'suco-de-mamao': [6.57, 0.46, 'DP'],
  'suco-de-manga': [7.67, 0.96, 'DP'], 'suco-de-maracuja': [10.24, 0.34, 'DP'], 'suco-de-melao': [7.41, 0.52, 'DP'], 'suco-de-morango': [28.32, 0.45, 'DP'],
  'suco-de-tangerina': [4.72, 0.76, 'DP'], 'suco-de-caju': [5.68, 0.87, 'RN'],
  // Sonda, 16/11/2026, garrafas de 2 L: cola zero de duas marcas, R$ 14,73 e R$ 7,99; guaraná zero, R$ 9,79; laranja,
  // R$ 11,32 e R$ 7,69. Limão, sem garrafa de 2 L à venda: mediana por litro das de 200 mL a 600 mL (R$ 1,69 a 5,93).
  'refrigerante-de-cola-zero': [5.68, 1, 'SD'], 'refrigerante-de-guarana-zero': [4.9, 1, 'SD'], 'refrigerante-de-laranja': [4.76, 1, 'SD'], 'refrigerante-de-limao': [9.5, 1, 'SD'],
  // Sonda, 16/11/2026: pizzas congeladas com preço (250 g a R$ 14,29; 460 g a R$ 22,32), mediana por quilo; açaí com
  // guaraná, um só produto vendido por peso (1,1 kg a R$ 52,35); picolés comuns (40 g a 62 g, R$ 6,11 a 11,76), mediana
  'pizza-de-mucarela': [52.84, 1, 'SD'], 'pizza-de-calabresa': [52.84, 1, 'SD'], 'acai-na-tigela': [47.59, 1, 'SD'], picole: [177.6, 1, 'SD'],
  // outros
  'acucar-cristal': [3.1, 1, 'MS'],                            // 2 kg a R$ 6,20
  'acucar-mascavo': [17.83, 1, 'DP'],
  rapadura: [31.75, 1, 'DP'],
  melado: [25.7, 1, 'DP'],
  goiabada: [20.82, 1, 'RN'], // "doce de goiaba"
  bananada: [41.25, 1, 'RN'], // "doce de banana"
  'pe-de-moleque': [35, 1, 'DP'],
  'chocolate-ao-leite': [140.7, 1, 'SD'], // barra de 80 g
  'leite-condensado': [20.4, 1, 'MS'],                         // 395 g a R$ 8,06
  'coxinha-de-frango': [55.57, 1, 'SD'], // um só produto: mini coxinha pré-frita congelada, 300 g a R$ 16,67
  'pastel-de-carne-frito': [64.8, 1, 'MF'], // pastel de carne congelado, 250 g a R$ 16,20; o sem glúten custa R$ 30,90 por 240 g
};

// Pratos prontos (fonte RC): o custo sai da receita que a TACO preparou para analisar o prato (4ª edição, anexo
// "Procedimentos de preparo das amostras"), com cada ingrediente pelo preço de compra pesquisado.
//   ing    [ingrediente, quilos comprados]: o id de um alimento da tabela acima (vale o preço de compra dele, que é o do
//          produto cru: 2 kg de 'macarrao-cozido' são 2 kg de macarrão seco) ou um insumo de INSUMOS. Cebola e tomate
//          entram com a perda da limpeza; óleo, em quilos (1 mL = 0,92 g); leite, em litros.
//   rende  quilos de prato pronto. A TACO não informa o rendimento: é o peso em que o carboidrato e a proteína dos
//          ingredientes (valores da própria TACO) dão o teor do prato analisado — a média das duas contas, ou só a da
//          proteína nos pratos de carne, que quase não têm carboidrato.
// Alho, sal, coentro, cravo, canela e mostarda ficam de fora: não têm preço pesquisado e somam menos de 1% do custo.
export const INSUMOS = {
  canjica: 12.03,          // MS, festa junina (25 e 26/05/2026): canjica branca, mediana de 5 marcas (R$ 11,08 a 22,18 o quilo)
  'queijo-coalho': 35.75,  // RN
  cogumelo: 51.5,          // MF, 13/11/2026: cogumelo paris fresco, 200 g a R$ 10,30
  ketchup: 28.75,          // SD, 13/11/2026: mediana de 10 produtos (R$ 15 a 45 o quilo)
};
export const RECEITAS = {
  // 1 kg de canjica branca, 2 L de leite integral e 410 g de açúcar
  'canjica-com-leite': { rende: 5.5, ing: [['canjica', 1], ['leite-integral', 2], ['acucar-refinado', 0.41]] },
  // 2 kg de espaguete; molho com 1 kg de tomate, 500 g de patinho moído, 220 g de cebola e 16 mL de óleo
  'macarrao-a-bolonhesa': { rende: 7.1, ing: [['macarrao-cozido', 2], ['tomate', 1.05], ['patinho-grelhado', 0.5], ['cebola-crua', 0.244], ['oleo-de-soja', 0.015]] },
  // 2 kg de feijão-de-corda, 2 kg de arroz, 250 g de toucinho (preço do bacon), 400 g de cebola e 300 g de queijo coalho
  'baiao-de-dois': { rende: 12.7, ing: [['feijao-fradinho-cozido', 2], ['arroz-branco-cozido', 2], ['bacon-frito', 0.25], ['cebola-crua', 0.444], ['queijo-coalho', 0.3]] },
  // 1 kg de feijão roxo cozido (333 g cru), 500 g de farinha de mandioca, 8 ovos, 110 g de cebola, 500 g de bacon,
  // 1 kg de linguiça de porco e 179 mL de óleo
  'feijao-tropeiro': { rende: 3.1, ing: [['feijao-roxo-cozido', 0.333], ['farinha-de-mandioca-torrada', 0.5], ['ovo-cozido', 0.4], ['cebola-crua', 0.122], ['bacon-frito', 0.5], ['linguica-de-porco-grelhada', 1], ['oleo-de-soja', 0.165]] },
  // 3 kg de feijão preto; 900 g de orelha, rabo e pé de porco (sem preço pesquisado: vale o do pernil, o corte suíno mais
  // barato da tabela); 300 g de costelinha, 150 g de lombo, 750 g de paio e linguiça (preço da linguiça de porco),
  // 100 g de carne-seca, 660 g de cebola, 750 g de bacon e 167 mL de óleo
  feijoada: { rende: 14.4, ing: [['feijao-preto-cozido', 3], ['pernil-suino-assado', 0.9], ['costela-suina-assada', 0.3], ['lombo-suino-assado', 0.15], ['linguica-de-porco-grelhada', 0.75], ['carne-seca-cozida', 0.1], ['cebola-crua', 0.733], ['bacon-frito', 0.75], ['oleo-de-soja', 0.154]] },
  // 2,5 kg de filé-mignon (ou de peito de frango), 330 g de cebola, 600 g de cogumelo, 960 g de creme de leite,
  // 48 mL de óleo e 209 g de ketchup
  'estrogonofe-de-carne': { rende: 3.8, ing: [['file-mignon-grelhado', 2.5], ['cebola-crua', 0.367], ['cogumelo', 0.6], ['creme-de-leite', 0.96], ['oleo-de-soja', 0.044], ['ketchup', 0.209]] },
  'estrogonofe-de-frango': { rende: 3.3, ing: [['peito-de-frango-grelhado', 2.5], ['cebola-crua', 0.367], ['cogumelo', 0.6], ['creme-de-leite', 0.96], ['oleo-de-soja', 0.044], ['ketchup', 0.209]] },
  // 20 ovos (1 kg), 180 g de parmesão ralado e 167 mL de óleo (parte fica na frigideira, mas é comprado)
  'omelete-de-queijo': { rende: 1.24, ing: [['ovo-cozido', 1], ['queijo-parmesao', 0.18], ['oleo-de-soja', 0.154]] },
};
// preço de compra pesquisado de um alimento da tabela (R$ por quilo ou litro, como é vendido)
export const precoDeCompra = (id) => PRECO_REF[id][0];
// rendimento da tabela acima: quilos de alimento pronto que saem de 1 kg comprado (1 quando não há registro). A lista de
// compras do cardápio da semana usa para converter o arroz cozido em arroz cru, a carne grelhada em carne crua etc.
export const rendimentoDeCompra = (id) => (Object.prototype.hasOwnProperty.call(PRECO_REF, id) && PRECO_REF[id][1] > 0 ? PRECO_REF[id][1] : 1);
export const custoDaReceita = (id) => {
  const r = RECEITAS[id];
  return Math.round((r.ing.reduce((soma, [k, kg]) => soma + kg * (INSUMOS[k] ?? precoDeCompra(k)), 0) / r.rende) * 100) / 100;
};
for (const id of Object.keys(RECEITAS)) PRECO_REF[id] = [custoDaReceita(id), 1, 'RC'];

// Misturas (fonte MX): bebidas e sanduíches que a própria tabela de composição monta somando alimentos (o IBGE fez
// assim o café com leite e o pão com ovo — "50% de cada alimento"; ref pof2008). O preço sai dos ingredientes desta
// tabela, já prontos para comer (preço de compra ÷ rendimento), na proporção em peso: [ingrediente, kg por kg pronto].
//   vitamina de banana: a proporção que reproduz a composição do IBGE (gordura: leite; proteína: leite e banana;
//   carboidrato: o resto em açúcar) — 680 g de leite, 226 g de banana e 73 g de açúcar por quilo;
//   misto-quente: idem com pão de forma, queijo prato e presunto (carboidrato, gordura e proteína do IBGE);
//   pão com manteiga: 50 g de pão e 10 g de manteiga; com açúcar: 1 kg da bebida e 100 g de açúcar (COM_ACUCAR).
export const MISTURAS = {
  'cafe-com-leite': [['cafe-sem-acucar', 0.5], ['leite-integral', 0.5]],
  'vitamina-de-banana': [['leite-integral', 0.68], ['banana-prata', 0.226], ['acucar-refinado', 0.073]],
  'pao-com-ovo': [['pao-frances', 0.5], ['ovo-frito', 0.5]],
  'pao-com-manteiga': [['pao-frances', 0.833], ['manteiga-com-sal', 0.167]],
  'misto-quente': [['pao-de-forma', 0.344], ['queijo-prato', 0.412], ['presunto-cozido', 0.244]],
};
for (const [de, id] of COM_ACUCAR) MISTURAS[id] = [[de, 1 / (1 + ACUCAR_ADICIONADO)], ['acucar-refinado', ACUCAR_ADICIONADO / (1 + ACUCAR_ADICIONADO)]];
export const custoDaMistura = (id) => Math.round(MISTURAS[id].reduce((s, [k, kg]) => s + kg * (PRECO_REF[k][0] / PRECO_REF[k][1]), 0) * 100) / 100;
for (const id of Object.keys(MISTURAS)) PRECO_REF[id] = [custoDaMistura(id), 1, 'MX'];

// ---------- alergia alimentar ----------
// Os grupos de alergênicos da lista oficial da Anvisa (RDC 26/2015, mantida no Anexo III da RDC 727/2022 — ref
// anvisa_alergenicos): amendoim; castanhas (amêndoa, avelã, castanha-de-caju, castanha-do-pará, macadâmia, nozes, pecã,
// pistache, pinoli e castanhas); peixes; crustáceos (aqui junto com os peixes, como "frutos do mar"); ovos; leite de todos
// os mamíferos; e soja. (Trigo, centeio, cevada e aveia já são tratados pela restrição "sem glúten".)
// Quais alimentos da tabela têm cada um, pela composição usual (conservador: o que costuma ter, ou que a indústria
// costuma avisar que "pode conter", entra). O rótulo de cada produto é o que vale — por isso a tela sempre pede para ler.
//  • leite: tudo o que não tem a etiqueta 'sem_lactose' (laticínios, embutidos, bolos, pães e biscoitos industriais,
//    chocolates, margarina, whey, pratos com queijo ou creme de leite); a intolerância à lactose não é alergia, mas
//    nenhum alimento sem a etiqueta é livre de leite;
//  • peixe e frutos do mar: a categoria 'peixes' (inclui o camarão);
//  • os outros, na lista abaixo;
//  • pratos prontos (RECEITAS): herdam os alergênicos dos ingredientes — o feijão-tropeiro leva ovos, o baião de dois e o
//    estrogonofe levam queijo ou creme de leite. O óleo do preparo não conta: pode ser outro óleo.
export const ALERGIAS = ['amendoim', 'castanhas', 'peixe', 'ovo', 'leite', 'soja'];
export const NOME_ALERGIA = { amendoim: 'amendoim', castanhas: 'castanhas e nozes', peixe: 'peixes e frutos do mar', ovo: 'ovo', leite: 'leite', soja: 'soja' };
const LISTA_ALERGENICOS = {
  // granola: costuma levar castanhas e pode conter amendoim
  amendoim: ['pasta-de-amendoim', 'amendoim-torrado-salgado', 'amendoim-cru', 'pacoca', 'pe-de-moleque', 'granola', 'acai-com-granola'],
  castanhas: ['castanha-do-para', 'castanha-de-caju', 'amendoa', 'nozes', 'granola', 'acai-com-granola'],
  // massas e pães com ovo na receita usual; empanados e salgados (a massa ou o empanado levam ovo)
  ovo: ['ovo-cozido', 'clara-de-ovo-cozida', 'ovo-frito', 'omelete-de-queijo', 'ovo-de-codorna', 'maionese', 'pao-de-queijo-assado', 'bolo-de-milho', 'bolo-de-chocolate',
    'lasanha-massa-cozida', 'nhoque-de-batata-cozido', 'file-de-frango-a-milanesa', 'almondegas-fritas', 'coxinha-de-frango', 'pastel-de-carne-frito', 'pao-de-forma', 'pao-de-forma-integral',
    'biscoito-maisena', 'biscoito-recheado', 'macarrao-instantaneo', 'pao-com-ovo', 'misto-quente',
    // os só para registrar: massas de salgado, bolos, tortas, pudim, empanados e o pão dos lanches
    'frango-frito-empanado', 'nuggets-de-frango', 'empada-de-frango', 'pastel-de-queijo-frito', 'croquete-de-carne-frito', 'esfiha-de-carne', 'esfiha-de-queijo', 'esfiha-de-frango', 'enroladinho',
    'risoles', 'salgadinho-de-festa', 'bolo-simples', 'bolo-de-cenoura', 'bolo-de-laranja', 'bolo-de-coco', 'bolo-de-banana', 'bolo-de-mandioca', 'torta-salgada', 'empadao', 'quiche', 'torta-doce',
    'pizza-portuguesa', 'hamburguer-sanduiche', 'cachorro-quente', 'biscoito-recheado-morango', 'biscoito-wafer', 'pudim', 'sorvete'],
  // grão, bebida, tofu e proteína de soja; óleo de soja; e os industriais em que soja (proteína ou lecitina) é comum
  soja: ['soja-cozida', 'tofu', 'proteina-de-soja-texturizada', 'leite-de-soja', 'oleo-de-soja', 'margarina-com-sal', 'chocolate-ao-leite', 'chocolate-meio-amargo', 'chocolate-amargo-70',
    'achocolatado-em-po', 'biscoito-recheado', 'biscoito-maisena', 'biscoito-cream-cracker', 'pao-de-forma', 'pao-de-forma-integral', 'salsicha', 'mortadela', 'hamburguer-bovino-grelhado',
    'macarrao-instantaneo', 'whey-protein', 'proteina-de-soja-preparada', 'misto-quente', 'pizza-de-mucarela', 'pizza-de-calabresa',
    'nuggets-de-frango', 'pizza-portuguesa', 'hamburguer-sanduiche', 'cachorro-quente', 'enroladinho', 'salgadinho-de-pacote', 'biscoito-recheado-morango', 'biscoito-wafer', 'sorvete', 'brigadeiro', 'milk-shake'],
};
const OLEOS = new Set(['oleo-de-soja', 'oleo-de-girassol', 'oleo-de-milho', 'oleo-de-canola', 'azeite-de-oliva']);
const ALERG = new Map(ALIMENTOS.map((f) => [f.id, new Set()]));
for (const f of ALIMENTOS) {
  if (!f.tags.includes('sem_lactose')) ALERG.get(f.id).add('leite');
  if (f.cat === 'peixes') ALERG.get(f.id).add('peixe');
}
for (const [al, idsAl] of Object.entries(LISTA_ALERGENICOS)) for (const id of idsAl) if (ALERG.has(id)) ALERG.get(id).add(al);
// pratos prontos: os alergênicos dos ingredientes (sem o óleo do preparo); insumos sem tabela: o queijo coalho é leite
const INSUMO_ALERG = { 'queijo-coalho': ['leite'] };
for (const [id, r] of Object.entries(RECEITAS)) {
  if (!ALERG.has(id)) continue;
  for (const [ing] of r.ing) {
    if (OLEOS.has(ing)) continue;
    for (const al of ALERG.has(ing) ? ALERG.get(ing) : INSUMO_ALERG[ing] || []) ALERG.get(id).add(al);
  }
}
// alergênicos de um alimento da tabela (lista vazia se não tem nenhum dos grupos ou se o id não existe)
export const alergenosDe = (id) => (ALERG.has(id) ? ALERGIAS.filter((a) => ALERG.get(id).has(a)) : []);
// o alimento tem algum dos alergênicos da lista `alergias`?
export const temAlergeno = (id, alergias) => Array.isArray(alergias) && alergias.some((a) => ALERG.has(id) && ALERG.get(id).has(a));

// Critério da faixa (o mesmo para todos os alimentos, com limites fixos):
//   1. três medidas, sempre do alimento pronto para comer:
//        kg     = R$ por quilo (preço de compra ÷ rendimento);
//        porcao = R$ por porção caseira (kg × gramas da porção ÷ 1000);
//        p100   = R$ por 100 g de proteína (10 × kg ÷ gramas de proteína em 100 g) — só para as fontes de proteína
//                 (carnes, peixes, ovos, laticínios, leguminosas e whey).
//   2. cada medida recebe nota 1 (barato), 2 (médio) ou 3 (caro) pelos limites abaixo. São fixos, para a faixa de um
//      alimento não mudar quando a lista cresce: os terços dos 135 alimentos pesquisados primeiro, arredondados (terços
//      exatos: kg 10,11 e 32,51; porção 0,68 e 1,60; p100 16,03 e 24,91). Com os 269 alimentos de hoje, os terços são
//      kg 12,80 e 36,71; porção 0,81 e 2,20; p100 17,26 e 26,57;
//   3. fontes de proteína: a faixa é a nota do p100, porque a quantidade no prato é a que fecha a proteína da refeição
//      (frango e ovo saem baratos; filé-mignon, salmão e iogurte, caros);
//      demais alimentos: a faixa é a nota da porção, corrigida em um degrau quando a nota do quilo fica dois degraus
//      distante (ex.: manteiga e pasta de amendoim: porção barata, quilo caro → médio).
export const LIMITES_PRECO = { kg: [10, 30], porcao: [0.7, 1.6], p100: [15, 25] };
export const NOME_FAIXA = { 1: 'barato', 2: 'médio', 3: 'caro' };
const nota = (v, [a, b]) => (v <= a ? 1 : v <= b ? 2 : 3);
export const fonteDeProteina = (f) => f.papel === 'proteina' || f.papel === 'laticinio' || f.cat === 'leguminosas';
export function calcularPreco(f, ref = PRECO_REF[f.id]) {
  if (!ref) return null;
  const [compra, rendimento, fonte] = ref;
  const kg = compra / rendimento;
  const porcao = (kg * f.porcao.g) / 1000;
  const p100 = fonteDeProteina(f) && f.p > 0 ? (10 * kg) / f.p : null;
  let faixa;
  if (p100 != null) faixa = nota(p100, LIMITES_PRECO.p100);
  else {
    const nKg = nota(kg, LIMITES_PRECO.kg), nPorcao = nota(porcao, LIMITES_PRECO.porcao);
    faixa = nKg - nPorcao >= 2 ? nPorcao + 1 : nPorcao - nKg >= 2 ? nPorcao - 1 : nPorcao;
  }
  return { faixa, kg, porcao, p100, fonte };
}
// cada alimento ganha o campo `preco`: { faixa: 1 | 2 | 3, kg, porcao, p100, fonte }
for (const f of ALIMENTOS) f.preco = Object.freeze(calcularPreco(f));

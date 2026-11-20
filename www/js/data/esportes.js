// Outros esportes para registrar no dia, com o MET de cada um. Fonte, lida nas tabelas oficiais de pacompendium.com e
// conferida no PDF do 2024 Adult Compendium of Physical Activities (Herrmann 2024, ref compendio2024): código e descrição
// em inglês no comentário. met60 = valor do Older Adult Compendium (Willis 2024, ref compendio60_2024) só quando a
// atividade é a mesma; nas outras, a partir dos 60 anos vale o MET de adultos (logic/esportes.js).
// Sem entrada própria no Compendium: beach tennis, padel e frescobol usam "Paddleball, casual, general" (15500, 6,0, o
// jogo de raquete mais parecido); futevôlei usa o vôlei de praia (15725, 8,0). O nome diz que é aproximação.
// id, nome, grupo, met (adultos), met60, busca (outros nomes)
export const GRUPOS_ESPORTE = [
  ['bola', 'Esportes com bola'], ['raquete', 'Raquete'], ['agua', 'Na água'], ['rodas', 'Bicicleta, patins e skate'],
  ['aula', 'Aulas e academia'], ['luta', 'Lutas'], ['livre', 'Ao ar livre e outros'],
];
export const ESPORTES = [
  { id: 'futebol', nome: 'Futebol (pelada)', grupo: 'bola', met: 7.0, busca: 'bola society campo racha' }, // 15610 Soccer, casual, general
  { id: 'futebol-competitivo', nome: 'Futebol (jogo competitivo)', grupo: 'bola', met: 9.5, busca: 'campeonato' }, // 15605 Soccer, competitive
  { id: 'futsal', nome: 'Futsal', grupo: 'bola', met: 7.8, busca: 'futebol de salao quadra' }, // 15195 Futsal
  { id: 'basquete', nome: 'Basquete', grupo: 'bola', met: 7.5, busca: 'basketball cesta' }, // 15055 Basketball, general
  { id: 'basquete-jogo', nome: 'Basquete (partida)', grupo: 'bola', met: 8.0 }, // 15040 Basketball, game
  { id: 'volei', nome: 'Vôlei (recreativo)', grupo: 'bola', met: 3.0, busca: 'volei voleibol' }, // 15720 Volleyball, non-competitive, general
  { id: 'volei-competitivo', nome: 'Vôlei (competitivo, quadra)', grupo: 'bola', met: 6.0, busca: 'volei voleibol' }, // 15711 Volleyball, competitive, in gymnasium
  { id: 'volei-de-praia', nome: 'Vôlei de praia', grupo: 'bola', met: 8.0, busca: 'volei areia' }, // 15725 Volleyball, beach, in sand
  { id: 'futevolei', nome: 'Futevôlei (como vôlei de praia)', grupo: 'bola', met: 8.0, busca: 'futevolei areia' }, // aproximação: 15725
  { id: 'handebol', nome: 'Handebol', grupo: 'bola', met: 8.0, busca: 'handball' }, // 15330 Handball, team
  { id: 'tenis', nome: 'Tênis', grupo: 'raquete', met: 6.8 }, // 15675 Tennis, general, moderate effort
  { id: 'beach-tennis', nome: 'Beach tennis (aproximado)', grupo: 'raquete', met: 6.0, busca: 'praia raquete' }, // aproximação: 15500 Paddleball
  { id: 'padel', nome: 'Padel (aproximado)', grupo: 'raquete', met: 6.0 }, // aproximação: 15500 Paddleball, casual
  { id: 'frescobol', nome: 'Frescobol (aproximado)', grupo: 'raquete', met: 6.0, busca: 'praia raquete' }, // aproximação: 15500
  { id: 'tenis-de-mesa', nome: 'Tênis de mesa (pingue-pongue)', grupo: 'raquete', met: 4.0, busca: 'ping pong' }, // 15660 Table tennis
  { id: 'natacao', nome: 'Natação (lazer)', grupo: 'agua', met: 6.0, busca: 'nadar piscina' }, // 18310 Swimming, leisurely, general
  { id: 'natacao-crawl', nome: 'Natação (crawl, ritmo moderado)', grupo: 'agua', met: 5.8, busca: 'nadar piscina treino' }, // 18292 Swimming, crawl, slow speed, moderate effort
  { id: 'hidroginastica', nome: 'Hidroginástica', grupo: 'agua', met: 5.5, busca: 'hidro agua' }, // 18355 Water aerobics, general
  { id: 'surfe', nome: 'Surfe', grupo: 'agua', met: 3.0, busca: 'surf bodyboard' }, // 18220 Surfing, body or board, general
  { id: 'stand-up-paddle', nome: 'Stand up paddle', grupo: 'agua', met: 6.5, busca: 'sup prancha remo' }, // 18224 Stand up paddle boarding
  { id: 'canoagem', nome: 'Canoagem ou remo (lazer)', grupo: 'agua', met: 3.5, busca: 'caiaque remar' }, // 18070 Canoeing, rowing, for pleasure
  { id: 'ciclismo', nome: 'Ciclismo', grupo: 'rodas', met: 7.0, busca: 'bicicleta bike pedal pedalar' }, // 01014 Bicycling, general
  { id: 'ciclismo-lazer', nome: 'Bicicleta (passeio, até 16 km/h)', grupo: 'rodas', met: 4.0, busca: 'bike pedal pedalar' }, // 01010 Bicycling, <10 mph, leisure
  { id: 'patins', nome: 'Patins', grupo: 'rodas', met: 7.0, busca: 'patinar patinacao' }, // 15590 Skating, roller
  { id: 'patins-inline', nome: 'Patins inline (rollerblade)', grupo: 'rodas', met: 7.5, busca: 'patinar roller' }, // 15591 Roller blading, recreational pace
  { id: 'skate', nome: 'Skate', grupo: 'rodas', met: 5.0 }, // 15580 Skateboarding, general, moderate effort
  { id: 'ginastica-aerobica', nome: 'Ginástica aeróbica', grupo: 'aula', met: 7.3, busca: 'aerobica aula' }, // 02000 Aerobic, general
  { id: 'step', nome: 'Step', grupo: 'aula', met: 7.3, busca: 'aula' }, // 02002 Aerobic, step
  { id: 'zumba', nome: 'Zumba', grupo: 'aula', met: 6.5, busca: 'danca aula' }, // 02310 Zumba, group class
  { id: 'danca', nome: 'Dança (aeróbica, ritmo moderado)', grupo: 'aula', met: 4.8, busca: 'dancar forro samba salsa' }, // 02005 Aerobic dance, low impact, moderate effort
  { id: 'danca-de-salao', nome: 'Dança de salão', grupo: 'aula', met: 6.0, busca: 'dancar forro samba bolero' }, // 03042 Ballroom Dance, Recreational
  { id: 'ginastica-artistica', nome: 'Ginástica artística', grupo: 'aula', met: 3.8, busca: 'ginastica' }, // 15300 Gymnastics, general
  { id: 'calistenia', nome: 'Ginástica localizada / calistenia', grupo: 'aula', met: 3.8, met60: 3.5, busca: 'ginastica flexao abdominal barra' }, // 02022; 60+: 0202260
  { id: 'circuito', nome: 'Circuito vigoroso / crossfit', grupo: 'aula', met: 7.5, busca: 'crossfit funcional kettlebell' }, // 02040 Circuit training, vigorous
  { id: 'hiit', nome: 'HIIT / treino intervalado intenso', grupo: 'aula', met: 11.0, busca: 'funcional tabata burpee' }, // 02214 High intensity interval exercise, vigorous
  { id: 'pilates', nome: 'Pilates', grupo: 'aula', met: 2.8 }, // 02105 Pilates, general
  { id: 'ioga', nome: 'Ioga', grupo: 'aula', met: 2.3, met60: 2.5, busca: 'yoga' }, // 02175 Yoga, General; 60+: 0219060
  { id: 'alongamento', nome: 'Alongamento', grupo: 'aula', met: 2.3 }, // 02101 Stretching, mild
  { id: 'lutas', nome: 'Lutas (jiu-jitsu, karatê, muay thai...)', grupo: 'luta', met: 10.3, busca: 'jiu jitsu karate muay thai taekwondo kickboxing arte marcial' }, // 15430 Martial Arts, moderate pace
  { id: 'judo', nome: 'Judô', grupo: 'luta', met: 11.3 }, // 15433 Judo
  { id: 'boxe-saco', nome: 'Boxe (saco de pancada)', grupo: 'luta', met: 5.8, busca: 'boxe' }, // 15110 Boxing, punching bag
  { id: 'boxe-sparring', nome: 'Boxe (luta, sparring)', grupo: 'luta', met: 7.8, busca: 'boxe' }, // 15120 Boxing, sparring
  { id: 'kickboxing', nome: 'Kickboxing', grupo: 'luta', met: 7.3 }, // 15457 Kickboxing
  { id: 'trilha', nome: 'Trilha (caminhada no mato)', grupo: 'livre', met: 6.0, busca: 'hiking trekking montanha' }, // 17080 Hiking, cross country
  { id: 'caminhada', nome: 'Caminhada (passo moderado)', grupo: 'livre', met: 3.8, met60: 5.3, busca: 'andar caminhar' }, // 17190; 60+: 1719060
  { id: 'escalada', nome: 'Escalada', grupo: 'livre', met: 8.0 }, // 15533 Rock or mountain climbing
  { id: 'golfe', nome: 'Golfe', grupo: 'livre', met: 4.5 }, // 15255 Golf, general
  { id: 'brincar-com-criancas', nome: 'Brincar com crianças (ativo)', grupo: 'livre', met: 3.5, busca: 'filhos correr brincadeira' }, // 05175 playing with child(ren), moderate
];
export const ESPORTE_POR_ID = new Map(ESPORTES.map((e) => [e.id, e]));

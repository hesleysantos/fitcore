// Mede a quantidade de texto de cada tela, com um usuário de exemplo.
import { B, semear, medirTexto, fotoInteira } from './exemplo.mjs';

export default async (page) => {
  const fotos = (process.env.FOTOS || '').split(',').filter(Boolean);
  const medir = async (nome, rota, antes) => {
    if (rota != null) await page.goto(B + '#' + rota, 900);
    if (antes) await antes();
    const m = await page.eval(medirTexto);
    console.log(`${nome.padEnd(26)} palavras=${String(m.palavras).padStart(4)} alturas-de-tela=${String(m.telas).padStart(4)} blocos>140c=${m.blocosLongos}`);
    for (const e of m.exemplos) console.log('      · ' + e);
    if (fotos.includes(nome) || fotos.includes('tudo')) await fotoInteira(page, 'txt-' + nome);
  };
  // usuário novo
  await page.goto(B, 2000);
  await page.click('Agora não');
  await medir('inicio-novo', '');
  await medir('treinador-novo', 'treinador');
  await page.click('Começar'); await page.sleep(400);
  await medir('entrevista-p1', null);
  await medir('nutricao-novo', 'nutricao');
  await medir('treinos-novo', 'treinos');
  // usuário com histórico
  const s = await semear(page);
  console.log('semeado:', JSON.stringify(s));
  await medir('inicio', '');
  await medir('treinos', 'treinos');
  await medir('dia-do-treino', `treino/${s.plano}/${s.dia}`);
  await medir('exercicios', 'exercicios');
  await medir('exercicio', 'exercicio/supino-reto-barra');
  await medir('evolucao-dicas', 'progresso');
  await medir('evolucao-forca', null, async () => { await page.click('Força'); await page.sleep(400); });
  await medir('evolucao-volume', null, async () => { await page.click('Volume'); await page.sleep(400); });
  await medir('evolucao-peso', null, async () => { await page.click('Peso'); await page.sleep(400); });
  await medir('historico', 'historico');
  await medir('treinador', 'treinador');
  await medir('nutricao', 'nutricao');
  await medir('academia', 'academia');
  await medir('ajustes', 'ajustes');
  await medir('sobre', 'sobre');
  await page.goto(B + '#treinos', 800);
  await page.click('Iniciar treino'); await page.sleep(900);
  await medir('sessao', null);
  console.log('erros de console:', JSON.stringify(page.erros));
};

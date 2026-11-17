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
  await medir('corrida-novo', 'corrida');
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
  // a proposta do Treinador (antes de aceitar)
  const aceito = await page.eval(`const st = await import('/js/store.js'); const a = st.state.trainer.aceitoEm; st.update((s) => { s.trainer.aceitoEm = ''; }); return a;`);
  await medir('treinador-proposta', 'treinos', async () => { await page.goto(B + '#treinador', 900); });
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.trainer.aceitoEm = ${JSON.stringify(aceito)}; }); return 1;`);
  await medir('nutricao', 'nutricao');
  await medir('academia', 'academia');
  await medir('ajustes', 'ajustes');
  await medir('sobre', 'sobre');
  await page.goto(B + '#treinos', 800);
  await page.click('Iniciar treino'); await page.sleep(900);
  await medir('sessao', null);
  // Treinador de corrida: proposta e plano aceito, com 3 corridas registradas
  // (fica por último: com um plano de corrida, as outras telas mudam)
  await page.eval(`const st = await import('/js/store.js'); st.update((s) => { s.current = null; }); return 1;`);
  await page.eval(`const st = await import('/js/store.js'); const c = await import('/js/logic/corrida.js'); const ui = await import('/js/ui.js');
    const wd = new Date().getDay(); const somar = (n) => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return ui.dateKey(d); };
    const a = { experiencia: 'regular', kmSemana: 20, longoAtual: 8, pausa: 'treinando', objetivo: 'prova', distancia: '10', semanasProva: 10, temAlvo: 'nao', resultado: 'nao', dias: [String(wd), String((wd + 2) % 7), String((wd + 5) % 7)], diaLongo: 'auto', tempo: '60', tempoLongo: '90', aparelho: 'gps', local: 'rua', idade: 31, peso: 78, altura: 176, lesao12m: 'nao', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'] };
    for (const q of c.PERGUNTAS) if (!(q.k in a) && !(q.se && !q.se(a)) && !q.opcional) a[q.k] = q.tipo === 'numero' ? (q.padrao ?? q.min) : q.tipo === 'um' ? q.op[0][0] : [q.op[q.op.length - 1][0]];
    st.update((s) => { s.run = { answers: a, aceitoEm: '', inicio: '', pausadoEm: '', cron: null, pausas: [], mostrados: [], degrau: null }; s.combo = { foco: 'equilibrio', fortalecimento: 'nao', em: new Date().toISOString() }; });
    return 1;`);
  await medir('corrida-proposta', 'corrida');
  await page.eval(`const st = await import('/js/store.js'); const ui = await import('/js/ui.js'); const somar = (n) => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return ui.dateKey(d); };
    const seg = somar(-((new Date().getDay() + 6) % 7) - 7);
    st.update((s) => { s.run.aceitoEm = new Date(Date.now() - 8 * 86400000).toISOString(); s.run.inicio = seg;
      s.runs = [[0, 'leve', 5, 31], [2, 'leve', 6, 37], [5, 'longo', 9, 58]].map(([n, tipo, km, min], i) => { const d = new Date(seg + 'T12:00:00'); d.setDate(d.getDate() + n); return { id: 'cx' + i, data: ui.dateKey(d), tipo, distKm: km, durMin: min, pse: 5, dores: [], nota: '', planejado: '', plan: null }; }); });
    return 1;`);
  await medir('corrida', 'treinos', async () => { await page.goto(B + '#corrida', 900); });
  console.log('erros de console:', JSON.stringify(page.erros));
};

// Preenche o app com um usuário de exemplo (respostas, plano aceito, treinos e pesos), usando o próprio código do app.
export const B = 'http://localhost:5173/';

export async function semear(page, { semanas = 5, objetivo = 'hipertrofia' } = {}) {
  await page.goto(B, 2000);
  await page.eval(`
    const store = await import('/js/store.js');
    store.update((s) => {
      s.ui.onboarded = true; s.ui.installDismissedAt = new Date().toISOString();
      s.trainer.answers = { objetivo: ${JSON.stringify(objetivo)}, idade: 31, peso: 78, altura: 176, experiencia: 'intermediario', dias: '4', tempo: '60', local: 'completa', limitacoes: ['nenhuma'], condicoes: ['nenhuma'], triagem: ['nenhum'], foco: ['equilibrado'] };
      s.nutri.answers = { objetivo: ${JSON.stringify(objetivo === 'emagrecimento' ? 'emagrecer' : 'ganhar')}, sexo: 'm', idade: 31, peso: 78, altura: 176, atividade: 'leve', treinos: '4', horario: 'noite', refeicoes: '4', restricoes: ['nenhuma'], condicoes: ['nenhuma'] };
      s.nutri.calculadoEm = new Date().toISOString();
    });
    await new Promise((r) => setTimeout(r, 400));`);
  await page.goto(B + '#treinador', 1200);
  const ok = await page.click('Aceitar e usar este treino');
  if (!ok) { await page.click('Montar um novo treino'); await page.sleep(500); await page.click('Montar'); await page.sleep(600); await page.click('Aceitar e usar este treino'); }
  await page.sleep(600);
  // treinos passados: segue a agenda do plano; a maioria dos exercícios sobe a carga, um fica parado e um dia é pulado
  return page.eval(`
    const store = await import('/js/store.js');
    const { EX_POR_ID } = await import('/js/data/exercises.js');
    const plan = store.activePlan();
    if (!plan) return { erro: 'sem plano' };
    const DIA = 86400000; const agora = Date.now();
    const sess = []; let n = 0;
    for (let d = ${semanas} * 7; d >= 1; d--) {
      const t = new Date(agora - d * DIA); t.setHours(18, 30, 0, 0);
      const diaId = plan.agenda[t.getDay()];
      if (!diaId) continue;
      n++;
      if (n % 7 === 0) continue; // faltou
      const dia = plan.dias.find((x) => x.id === diaId);
      const sem = Math.floor((${semanas} * 7 - d) / 7);
      const itens = dia.itens.map((it, k) => {
        const ex = EX_POR_ID.get(it.ex);
        const lo = Number(String(it.reps).split('-')[0]); const hi = Number(String(it.reps).split('-').pop());
        const base = ex.tipo === 'composto' ? 40 : 14;
        const parado = k === 1;
        const sets = Array.from({ length: it.series }, (_, j) => ex.registro === 'peso_reps'
          ? { kg: base + (parado ? 0 : sem * (ex.tipo === 'composto' ? 2.5 : 1)), reps: parado ? lo : Math.min(hi, lo + (sem % 3)), seg: null, ok: !(k === dia.itens.length - 1 && j === it.series - 1 && sem % 2) }
          : ex.registro === 'reps' ? { kg: null, reps: lo + sem, seg: null, ok: true } : { kg: null, reps: null, seg: lo, ok: true });
        return { ex: it.ex, sets, alvo: it.reps, descanso: it.descanso };
      });
      sess.push({ id: 'seed' + d, planId: plan.id, diaId, nome: dia.nome, inicio: t.toISOString(), fim: new Date(t.getTime() + 62 * 60000).toISOString(), nota: '', itens });
    }
    const body = [];
    for (let w = ${semanas}; w >= 0; w--) { const t = new Date(agora - w * 7 * DIA); body.push({ data: t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'), peso: Math.round((78 + (${semanas} - w) * ${objetivo === 'emagrecimento' ? -0.5 : 0.25}) * 10) / 10, cintura: null }); }
    store.update((s) => { s.sessions = sess; s.body = body; });
    await new Promise((r) => setTimeout(r, 500));
    return { plano: plan.id, dia: plan.dias[0].id, treinos: sess.length, pesos: body.length };`);
}

// tamanho do texto visível de uma tela
export const medirTexto = `
  const main = document.querySelector('main') || document.body;
  const txt = main.innerText.replace(/\\s+/g, ' ').trim();
  const longos = [...main.querySelectorAll('p, li, .small, .tiny, .note, .bubble')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim()).filter((t, i, a) => t.length > 140 && a.indexOf(t) === i && !/^https?:/.test(t));
  return { palavras: txt.split(' ').length, telas: Math.round((document.documentElement.scrollHeight / innerHeight) * 10) / 10, blocosLongos: longos.length, exemplos: longos.sort((a, b) => b.length - a.length).slice(0, 4).map((t) => t.length + ': ' + t.slice(0, 150)) };`;

export async function fotoInteira(page, nome) {
  const m = await page.send('Page.getLayoutMetrics');
  const h = Math.min(4200, Math.ceil(m.cssContentSize.height));
  const r = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: m.cssContentSize.width, height: h, scale: 1 } });
  const fs = await import('node:fs');
  const dir = new URL('../../.tools/shots/', import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(new URL(nome + '.png', dir), Buffer.from(r.data, 'base64'));
}

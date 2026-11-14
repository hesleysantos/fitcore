// Captura páginas da galeria de animações (ou de qualquer endereço local) para conferência visual.
// Uso, com "npm start" rodando:
//   FOTOS="nome|consulta;nome2|consulta2" node tools/e2e/navegador.mjs tools/e2e/fotos.mjs
// - cada item é "nome|consulta da galeria" (ex.: "peito|g=peito&cols=4&frames=0,1") ou "nome|url:#/treinos" para uma tela do app;
// - as imagens vão para .tools/shots/<PASTA>/nome.png (PASTA é opcional; a pasta .tools não vai para o repositório);
// - TAM=largura,altura muda o tamanho da janela (padrão do navegador.mjs) e ALT limita a altura capturada (padrão 1500).
import fs from 'node:fs';
export default async (page) => {
  const pasta = (process.env.PASTA || '').replace(/[^\w-]/g, '');
  const dir = new URL('../../.tools/shots/' + (pasta ? pasta + '/' : ''), import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  for (const item of (process.env.FOTOS || '').split(';').filter(Boolean)) {
    const i = item.indexOf('|');
    const nome = item.slice(0, i).replace(/[^\w-]/g, ''), q = item.slice(i + 1);
    const url = q.startsWith('url:') ? 'http://localhost:5173/' + q.slice(4) : 'http://localhost:5173/tools/gallery.html?' + q;
    await page.goto(url, 900);
    const m = await page.send('Page.getLayoutMetrics');
    const h = Math.min(Number(process.env.ALT || 1500), Math.ceil(m.cssContentSize.height));
    const r = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: m.cssContentSize.width, height: h, scale: 1 } });
    fs.writeFileSync(new URL(nome + '.png', dir), Buffer.from(r.data, 'base64'));
    const erros = page.erros.filter((e) => !/favicon/.test(e));
    console.log(nome, 'ok', erros.length ? erros.join(' | ').slice(0, 300) : '');
  }
};

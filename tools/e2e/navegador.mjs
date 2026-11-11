// Motor de teste local: abre o Edge sem janela e controla a página pelo protocolo de depuração.
// Uso (com "npm start" rodando em outro terminal): node tools/e2e/navegador.mjs tools/e2e/uso.mjs
// O roteiro exporta default async (page) => {...}. Precisa do Microsoft Edge ou do Google Chrome instalado;
// se estiver em outro lugar, informe o caminho na variável de ambiente NAVEGADOR.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EDGE = [process.env.NAVEGADOR, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && fs.existsSync(p));
if (!EDGE) { console.log('Navegador não encontrado. Informe o caminho em NAVEGADOR.'); process.exit(2); }
fs.mkdirSync(path.join(ROOT, '.tools'), { recursive: true });
const PORT = 9333 + Math.floor(Math.random() * 500);
const perfil = path.join(ROOT, '.tools', 'edge-cdp-' + PORT);
fs.rmSync(perfil, { recursive: true, force: true });

const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion', '--remote-debugging-port=' + PORT, '--user-data-dir=' + perfil, '--window-size=' + (process.env.TAM || '430,900'), 'about:blank'];
const edge = spawn(EDGE, args, { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function alvo() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const l = await r.json();
      const p = l.find((x) => x.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch { /* ainda subindo */ }
    await sleep(250);
  }
  throw new Error('Edge não respondeu');
}

const ws = new WebSocket(await alvo());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const pend = new Map();
const erros = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); if (m.error) rej(new Error(m.error.message)); else res(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') erros.push('EXCEÇÃO: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) erros.push(m.params.type.toUpperCase() + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  else if (m.method === 'ServiceWorker.workerErrorReported') erros.push('SW: ' + JSON.stringify(m.params.errorMessage));
  else if (m.method === 'ServiceWorker.workerVersionUpdated') { for (const v of m.params.versions) erros.push('SWv: ' + v.runningStatus + '/' + v.status); }
  else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') erros.push('LOG: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
};
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; const t = setTimeout(() => { pend.delete(id); rej(new Error('sem resposta em 25 s: ' + method + ' ' + JSON.stringify(params).slice(0, 160))); }, 25000); pend.set(id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } }); ws.send(JSON.stringify({ id, method, params })); });
await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable'); await send('Network.enable');
// a página de teste fica sempre em primeiro plano: página oculta tem animações pausadas pelo próprio navegador
await send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
await send('Page.bringToFront').catch(() => {});

const page = {
  erros,
  sleep,
  send,
  async goto(url, espera = 1500) { await send('Page.navigate', { url }); await sleep(espera); await page.pronto(); },
  async reload(espera = 1500) { await send('Page.reload', { ignoreCache: false }); await sleep(espera); await page.pronto(); },
  // espera o app terminar de abrir (a tela de carregamento sair)
  async pronto() {
    for (let i = 0; i < 60; i++) {
      const ok = await page.eval('return !!document.querySelector("main, .view, nav") && !/^Carregando/.test(document.body.innerText.trim());').catch(() => false);
      if (ok) return;
      await sleep(250);
    }
  },
  async eval(expr) {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  },
  async shot(nome) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const f = path.join(ROOT, '.tools', 'shots', nome + '.png');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
    return f;
  },
  async offline(on) { await send('Network.emulateNetworkConditions', { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); },
  // clica no primeiro elemento clicável cujo texto (ou aria-label) contém o trecho
  async click(txt, sel = 'button, a, [role=button], .chip, .item, label, summary') {
    return page.eval(`const t = ${JSON.stringify(txt)}; const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.offsetParent !== null || e.getClientRects().length);
      const e = els.find((x) => (x.getAttribute('aria-label') || '') === t) || els.find((x) => x.textContent.trim() === t) || els.find((x) => (x.textContent + ' ' + (x.getAttribute('aria-label') || '')).includes(t));
      if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); await new Promise((r) => setTimeout(r, 250)); return true;`);
  },
  async text() { return page.eval(`return document.body.innerText;`); },
};

let code = 0;
try {
  const mod = await import(pathToFileURL(path.resolve(process.argv[2])).href);
  await mod.default(page);
} catch (e) {
  console.log('FALHOU: ' + (e && e.stack || e));
  code = 1;
}
try { await send('Browser.close'); } catch { /* já fechou */ }
await sleep(400);
edge.kill();
await sleep(300);
try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* o Edge ainda está fechando; a pasta é apagada na próxima limpeza */ }
process.exit(code);

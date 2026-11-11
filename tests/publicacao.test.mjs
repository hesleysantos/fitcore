// Confere se o que será publicado está coerente: service worker em dia e política de segurança presente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const WWW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../www');
function walk(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const rel = base ? base + '/' + name : name;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, rel));
    else if (rel !== 'sw.js' && rel !== '_headers' && !name.startsWith('.')) out.push(rel);
  }
  return out;
}

test('service worker está em dia com os arquivos de www/ (rode "npm run build" depois de qualquer mudança)', () => {
  const files = walk(WWW);
  const hash = crypto.createHash('sha256');
  for (const f of files) { hash.update(f); hash.update(fs.readFileSync(path.join(WWW, f))); }
  const version = hash.digest('hex').slice(0, 12);
  const sw = fs.readFileSync(path.join(WWW, 'sw.js'), 'utf8');
  assert.ok(sw.includes(`const VERSION = '${version}'`), 'sw.js desatualizado: rode npm run build');
  for (const f of files) assert.ok(sw.includes(JSON.stringify(f)), 'arquivo fora da lista offline: ' + f);
});

test('política de segurança (CSP) estrita e sem recursos externos', () => {
  const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html);
  assert.ok(csp, 'CSP ausente');
  for (const d of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "require-trusted-types-for 'script'"]) assert.ok(csp[1].includes(d), 'falta na CSP: ' + d);
  assert.ok(!/unsafe-inline|unsafe-eval|\*|https?:/.test(csp[1]), 'CSP permissiva');
  assert.ok(!/<script(?![^>]*src=)[^>]*>/.test(html), 'script embutido no HTML');
  assert.ok(!/ style=|onclick=|onload=/.test(html), 'estilo ou evento embutido no HTML');
  // a página não pode abrir nenhuma conexão (nem para o próprio site)...
  assert.ok(csp[1].includes("connect-src 'none'"), 'a página não deve poder abrir conexões');
  const headers = fs.readFileSync(path.join(WWW, '_headers'), 'utf8');
  assert.ok(headers.includes("frame-ancestors 'none'") && headers.includes('Strict-Transport-Security'));
  // ...mas o cabeçalho do servidor também vale para o service worker, que precisa baixar os arquivos
  // do próprio site para o uso offline. Por isso ali é 'self' (e nunca um endereço externo).
  for (const f of [path.join(WWW, '_headers'), path.join(WWW, '..', 'tools', 'serve.mjs')]) {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(t.includes("connect-src 'self'"), 'o service worker precisa de connect-src self em ' + path.basename(f));
    for (const linha of t.split('\n').filter((l) => l.includes('Content-Security-Policy') || l.includes('const CSP'))) assert.ok(!/connect-src[^;]*(https?:|\*)/.test(linha), 'conexão externa liberada em ' + path.basename(f));
  }
});

test('código do app não usa recursos perigosos nem faz chamadas de rede', () => {
  const proibidos = [/\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/, /\beval\(/, /new Function\(/, /XMLHttpRequest/, /WebSocket\(/, /sendBeacon/, /\bfetch\(/, /https?:\/\/(?!www\.w3\.org\/2000\/svg)/, /console\.(log|debug|info)/];
  for (const f of walk(WWW).filter((x) => x.startsWith('js/') && x.endsWith('.js'))) {
    let src = fs.readFileSync(path.join(WWW, f), 'utf8');
    // única exceção: o endereço das fontes da técnica no catálogo, que é só texto exibido (nunca aberto pelo app)
    if (f.startsWith('js/data/ex/')) src = src.replace(/\burl: 'https:\/\/[^'\s]+'/g, "url: ''");
    for (const re of proibidos) assert.ok(!re.test(src), `${f} contém ${re}`);
  }
});

// Gera os ícones do aplicativo (PNG) sem dependências externas.
// Uso: node tools/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- PNG ----------
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- desenho (campos de distância, com suavização de borda) ----------
const sdRound = (px, py, hw, hh, r) => { const qx = Math.abs(px) - hw + r, qy = Math.abs(py) - hh + r; return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r; };
const cover = (d, aa) => Math.min(1, Math.max(0, 0.5 - d / aa));

// u, v em [-1, 1]. Devolve [r, g, b, a].
function pixel(u, v, { bg = 'round', scale = 1 }, aa) {
  const BG = [14, 17, 22], AC = [255, 107, 44], HI = [255, 150, 92];
  let col = [0, 0, 0], a = 0;
  if (bg === 'round') a = cover(sdRound(u, v, 1, 1, 0.44), aa);
  else if (bg === 'full') a = 1;
  else if (bg === 'circle') a = cover(Math.hypot(u, v) - 1, aa);
  if (a > 0) col = BG;
  // halter em diagonal
  const s = scale;
  const ang = -Math.PI / 5;
  const x = (u * Math.cos(ang) - v * Math.sin(ang)) / s;
  const y = (u * Math.sin(ang) + v * Math.cos(ang)) / s;
  const bar = sdRound(x, y, 0.56, 0.065, 0.06);
  const pIn = Math.min(sdRound(x - 0.4, y, 0.075, 0.36, 0.07), sdRound(x + 0.4, y, 0.075, 0.36, 0.07));
  const pOut = Math.min(sdRound(x - 0.565, y, 0.06, 0.25, 0.055), sdRound(x + 0.565, y, 0.06, 0.25, 0.055));
  const cGlyph = cover(Math.min(bar, pIn, pOut), aa / s);
  if (cGlyph > 0) {
    const mix = Math.min(1, Math.max(0, 0.5 - y * 1.2));
    const g = [AC[0] + (HI[0] - AC[0]) * mix, AC[1] + (HI[1] - AC[1]) * mix, AC[2] + (HI[2] - AC[2]) * mix];
    if (bg === 'none') { col = g; a = cGlyph; }
    else col = [col[0] + (g[0] - col[0]) * cGlyph, col[1] + (g[1] - col[1]) * cGlyph, col[2] + (g[2] - col[2]) * cGlyph];
  }
  return [col[0], col[1], col[2], a];
}
function render(size, opts) {
  const buf = Buffer.alloc(size * size * 4);
  const aa = 2.2 / size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const [r, g, b, a] = pixel(((i + 0.5) / size) * 2 - 1, ((j + 0.5) / size) * 2 - 1, opts, aa);
      const o = (j * size + i) * 4;
      buf[o] = Math.round(r); buf[o + 1] = Math.round(g); buf[o + 2] = Math.round(b); buf[o + 3] = Math.round(a * 255);
    }
  }
  return png(size, buf);
}
function out(file, size, opts) {
  const p = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, render(size, opts));
  console.log(file, size);
}

// Web / PWA
out('www/icons/icon-192.png', 192, { bg: 'round', scale: 0.86 });
out('www/icons/icon-512.png', 512, { bg: 'round', scale: 0.86 });
out('www/icons/icon-maskable-512.png', 512, { bg: 'full', scale: 0.64 });
out('www/icons/apple-touch-icon.png', 180, { bg: 'full', scale: 0.8 });
fs.writeFileSync(path.join(ROOT, 'www/icons/icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#0e1116"/><g transform="rotate(-36 50 50)" fill="#ff6b2c"><rect x="26" y="47" width="48" height="6" rx="3"/><rect x="29" y="34" width="6.500" height="32" rx="3"/><rect x="64.500" y="34" width="6.500" height="32" rx="3"/><rect x="21.500" y="39" width="5.500" height="22" rx="2.700"/><rect x="73" y="39" width="5.500" height="22" rx="2.700"/></g></svg>\n`);


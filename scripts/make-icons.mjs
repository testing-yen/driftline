#!/usr/bin/env node
/**
 * Generates Driftline's PWA icons with zero dependencies.
 * Minimal PNG writer: draws a dark rounded square, a white downhill slope
 * band, and a yellow rider dot with motion streaks. All original art.
 *
 * Run: npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// --- CRC32 ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter byte: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// --- tiny raster helpers ---
function makeCanvas(size) {
  return { size, px: Buffer.alloc(size * size * 4) };
}

function setPx(c, x, y, r, g, b, a = 255) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  c.px[i] = r; c.px[i + 1] = g; c.px[i + 2] = b; c.px[i + 3] = a;
}

function fillCircle(c, cx, cy, rad, r, g, b) {
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y += 1) {
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) setPx(c, x, y, r, g, b);
    }
  }
}

function drawIcon(size, { rounded = true } = {}) {
  const c = makeCanvas(size);
  const s = size / 512; // design in 512-space
  // Background.
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let inside = true;
      if (rounded) {
        const rad = 112 * s;
        const cx = Math.min(Math.max(x, rad), size - rad);
        const cy = Math.min(Math.max(y, rad), size - rad);
        inside = (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad || (x >= rad && x <= size - rad) || (y >= rad && y <= size - rad);
      }
      if (inside) setPx(c, x, y, 14, 26, 43);
    }
  }
  // White downhill slope band (top-left to bottom-right).
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const band = y - (x * 0.55 + 90 * s);
      if (band > 0 && band < 130 * s) {
        // keep rounded corners intact
        const i = (y * size + x) * 4;
        if (c.px[i + 3] !== 0) setPx(c, x, y, 240, 245, 252);
      }
    }
  }
  // Rider dot on the slope.
  fillCircle(c, 300 * s, 300 * s, 52 * s, 255, 211, 77);
  // Motion streaks.
  for (let i = 0; i < 3; i += 1) {
    const yy = (210 + i * 34) * s;
    for (let x = Math.floor(150 * s); x < 250 * s; x += 1) setPx(c, x, yy, 255, 211, 77, 255);
  }
  return encodePng(size, size, c.px);
}

mkdirSync(root, { recursive: true });
writeFileSync(join(root, 'icon-192.png'), drawIcon(192));
writeFileSync(join(root, 'icon-512.png'), drawIcon(512));
writeFileSync(join(root, 'icon-maskable-512.png'), drawIcon(512, { rounded: false }));
console.log('icons written to', root);

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'icons');
const SLUG = path.basename(ROOT);

const crc32 = (buf) => {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const encodePNG = (w, h, rgba) => {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const canvas = (size) => ({ size, d: new Uint8Array(size * size * 4) });

const px = (c, x, y, r, g, b, a = 255) => {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  const ra = a / 255;
  c.d[i] = Math.round(r * ra + c.d[i] * (1 - ra));
  c.d[i + 1] = Math.round(g * ra + c.d[i + 1] * (1 - ra));
  c.d[i + 2] = Math.round(b * ra + c.d[i + 2] * (1 - ra));
  c.d[i + 3] = Math.max(c.d[i + 3], a);
};

const fillRect = (c, x0, y0, x1, y1, r, g, b, a = 255) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(c, x, y, r, g, b, a);
};

const fillRounded = (c, x0, y0, x1, y1, rad, r, g, b, a = 255) => {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const inCorners =
        (x < x0 + rad && y < y0 + rad && (x - x0 - rad) ** 2 + (y - y0 - rad) ** 2 > rad * rad) ||
        (x > x1 - rad && y < y0 + rad && (x - x1 + rad) ** 2 + (y - y0 - rad) ** 2 > rad * rad) ||
        (x < x0 + rad && y > y1 - rad && (x - x0 - rad) ** 2 + (y - y1 + rad) ** 2 > rad * rad) ||
        (x > x1 - rad && y > y1 - rad && (x - x1 + rad) ** 2 + (y - y1 + rad) ** 2 > rad * rad);
      if (!inCorners) px(c, x, y, r, g, b, a);
    }
  }
};

const fillCircle = (c, cx, cy, rad, r, g, b, a = 255) => {
  for (let y = cy - rad; y <= cy + rad; y++) {
    for (let x = cx - rad; x <= cx + rad; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) px(c, x, y, r, g, b, a);
    }
  }
};

// ---- designs (each extension draws its own motif) ----
const designs = {
  darkveil: (sz, c) => {
    // night sky: deep violet square, cream moon, few stars
    const night = [22, 10, 34];
    const violet = [62, 32, 94];
    const moon = [245, 230, 255];
    fillRounded(c, 0, 0, sz - 1, sz - 1, sz * 0.16, ...night);
    fillRect(c, Math.max(1, sz * 0.07), 0, sz - 1 - Math.max(1, sz * 0.07), Math.max(1, sz * 0.14), ...violet);
    const cx = sz * 0.62;
    const cy = sz * 0.5;
    const rad = sz * 0.27;
    fillCircle(c, cx, cy, rad, ...moon);
    fillCircle(c, cx - rad * 0.42, cy - rad * 0.25, rad * 0.78, ...night);
    const stars = [[0.22, 0.3], [0.3, 0.66], [0.16, 0.5], [0.42, 0.88], [0.52, 0.2]];
    for (const [fx, fy] of stars) {
      const sx = Math.round(fx * sz);
      const sy = Math.round(fy * sz);
      px(c, sx, sy, ...moon);
      px(c, sx - 1, sy, ...moon);
      px(c, sx + 1, sy, ...moon);
      px(c, sx, sy - 1, ...moon);
      px(c, sx, sy + 1, ...moon);
    }
  },
};

const draw = designs[SLUG];
if (!draw) throw new Error('no icon design for slug ' + SLUG);

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 48, 128]) {
  const c = canvas(size);
  draw(size, c);
  fs.writeFileSync(path.join(OUT_DIR, 'icon' + size + '.png'), encodePNG(size, size, Buffer.from(c.d)));
  console.log('icon' + size + '.png written');
}
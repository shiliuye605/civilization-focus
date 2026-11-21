/* V0.6 组图器：读取 tools/char-frames.mjs 的分层定稿母版，排进 48x64 / 192x256 图集格位。
   旧模板生成器已隔离至 tools/legacy/make-characters-v05.mjs，不再写出正式素材。
   用法：node tools/make-characters.mjs candidates|stands|final */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { TANG_PAL, STONE_PAL, STEAM_PAL, painter, tangStand, stoneStand, steamStand } from './char-frames.mjs';

const CELL_W = 48;
const CELL_H = 64;

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

class Sheet {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.w = cols * CELL_W;
    this.h = rows * CELL_H;
    this.px = Buffer.alloc(this.w * this.h * 4);
  }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const i = (y * this.w + x) * 4;
    this.px[i] = r; this.px[i + 1] = g; this.px[i + 2] = b; this.px[i + 3] = 255;
  }
  clear(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.px[i + 3] = 0;
  }
  opaque(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.px[(y * this.w + x) * 4 + 3] > 0;
  }
  outline(ox, oy, color) {
    const edges = [];
    for (let y = oy; y < oy + CELL_H; y += 1) {
      for (let x = ox; x < ox + CELL_W; x += 1) {
        if (this.opaque(x, y)) continue;
        if (this.opaque(x - 1, y) || this.opaque(x + 1, y) || this.opaque(x, y - 1) || this.opaque(x, y + 1)) edges.push([x, y]);
      }
    }
    for (const [x, y] of edges) this.set(x, y, color);
  }
  cellPainter(col, row, pal) {
    const ox = col * CELL_W;
    const oy = row * CELL_H;
    return painter((x, y, c) => this.set(ox + x, oy + y, c), (x, y) => this.clear(ox + x, oy + y));
  }
  save(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encodePNG(this.w, this.h, this.px));
    console.log('wrote', file, `${this.w}x${this.h}`);
  }
  saveCell(file, col, row) {
    const out = Buffer.alloc(CELL_W * CELL_H * 4);
    for (let y = 0; y < CELL_H; y += 1) {
      this.px.copy(out, y * CELL_W * 4, ((row * CELL_H + y) * this.w + col * CELL_W) * 4, ((row * CELL_H + y) * this.w + (col + 1) * CELL_W) * 4);
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encodePNG(CELL_W, CELL_H, out));
  }
  saveZoom(file, f, col = null, row = null) {
    const sw = col === null ? this.w : CELL_W;
    const sh = row === null ? this.h : CELL_H;
    const sx = col === null ? 0 : col * CELL_W;
    const sy = row === null ? 0 : row * CELL_H;
    const w = sw * f;
    const h = sh * f;
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const si = ((sy + Math.floor(y / f)) * this.w + sx + Math.floor(x / f)) * 4;
        const di = (y * w + x) * 4;
        out[di] = this.px[si]; out[di + 1] = this.px[si + 1]; out[di + 2] = this.px[si + 2]; out[di + 3] = this.px[si + 3];
      }
    }
    fs.writeFileSync(file, encodePNG(w, h, out));
  }
}

const mode = process.argv[2] || 'stands';

function standSheet(draw, pal) {
  const sheet = new Sheet(4, 4);
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      draw(sheet.cellPainter(c, r, pal), pal);
      sheet.outline(c * CELL_W, r * CELL_H, pal.o);
    }
  }
  return sheet;
}

if (mode === 'candidates') {
  for (const v of ['A', 'B', 'C']) {
    const sheet = standSheet((P, pal) => tangStand(P, pal, v), TANG_PAL);
    sheet.save(`tools/candidates/tang-${v.toLowerCase()}.png`);
    sheet.saveCell(`tools/candidates/tang-${v.toLowerCase()}-idle.png`, 0, 0);
    sheet.saveZoom(`tools/candidates/tang-${v.toLowerCase()}-zoom.png`, 3, 0, 0);
  }
} else if (mode === 'stands') {
  const specs = [
    ['tang', (P, pal) => tangStand(P, pal, 'A'), TANG_PAL],
    ['stone', stoneStand, STONE_PAL],
    ['steam', steamStand, STEAM_PAL]
  ];
  for (const [name, draw, pal] of specs) {
    const sheet = standSheet(draw, pal);
    sheet.save(`tools/candidates/${name}-stand-sheet.png`);
    sheet.saveCell(`tools/candidates/${name}-stand.png`, 0, 0);
    sheet.saveZoom(`tools/candidates/${name}-stand-zoom.png`, 3, 0, 0);
  }
} else if (mode === 'final') {
  const { buildFinal } = await import('./char-actions.mjs');
  buildFinal({ Sheet, CELL_W, CELL_H, TANG_PAL, STONE_PAL, STEAM_PAL });
} else {
  console.error('unknown mode', mode);
  process.exit(1);
}
console.log('done', mode);
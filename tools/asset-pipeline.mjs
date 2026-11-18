import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const GRID_W = 640;
const GRID_H = 360;
const OUT_W = 1280;
const OUT_H = 720;

const PALETTES = {
  stone: [
    '#33566e', '#4a6a80', '#6a8496', '#b08a68', '#d8a878', '#f4c078', '#ffd9a0',
    '#1d3a26', '#2a4c2e', '#3a6238', '#548043', '#3d2c1e', '#54763d', '#6f9450', '#87a85e',
    '#b08d5e', '#8f6f47', '#c9a878', '#8b8b83', '#66665f', '#a8a89e', '#5d8a4c',
    '#3f7fa6', '#2c5f7d', '#7fb6d0', '#d8eef5', '#a8823f', '#7d5f2c', '#c9a55c',
    '#c9b18a', '#a08a63', '#6b4a2c', '#8a6a44', '#e8e0cc', '#c98d5e', '#a06b42',
    '#3a2a1e', '#8a6a44', '#6b4f30', '#c8503a', '#e8d06a', '#d88a9a', '#a8503a',
    '#241a12', '#4a3420', '#141a10'
  ],
  tang: [
    '#3a5a70', '#5a7a8c', '#8aa0ac', '#c09a70', '#e0b888', '#f6cc88', '#ffe0a8',
    '#2c4a30', '#3c6238', '#4c7a42', '#69964e', '#3d2c1e', '#6e8c50', '#8ba86a', '#a6bd7f',
    '#b49a6a', '#947a4e', '#c9b18a', '#8b877a', '#6d6a5e', '#a8a494',
    '#3d7ea3', '#2b5f7d', '#a3d1e4', '#d8eef5', '#7d9c4f', '#c9a854', '#a8b463', '#d9c27a',
    '#a44f37', '#6a2d21', '#c9a877', '#79552f', '#e2c99a', '#ffdca0', '#4a3420',
    '#d9a06b', '#a06b42', '#3a2a1e', '#7f8fae', '#5f6f8e', '#b08a9a', '#c98f7a', '#dda890',
    '#e8d06a', '#d88a9a', '#241a12', '#141a10'
  ],
  steam: [
    '#2b3440', '#3d4a58', '#5a6a7a', '#7a8a9a', '#9aa8b4', '#c8b49a', '#e0c8a8',
    '#4a3a34', '#6a4a3c', '#8a5a44', '#a4644a', '#b4745a', '#5a4a42', '#7a6a5e',
    '#3a3a3e', '#54545a', '#6e6e76', '#8a8a92', '#2a2a2e', '#c9a86a', '#e0c088', '#8a6a3a',
    '#3d5a6a', '#2b4250', '#7fa0b0', '#b4ccd4', '#6a7a5a', '#4a5a4a', '#8a9a7a',
    '#d8d0c0', '#a89880', '#5a4a3a', '#3a2e26', '#e8e0d0', '#b45a3a', '#8a3a2a',
    '#241a12', '#141a10', '#f4e0b8'
  ]
};

function crcTable() {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
const CRC = crcTable();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('only 8-bit png supported');
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced png unsupported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (colorType !== 2 && colorType !== 6) throw new Error(`color type ${colorType} unsupported`);
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rp];
    rp += 1;
    for (let x = 0; x < stride; x += 1) {
      const v = raw[rp + x];
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let recon;
      if (filter === 0) recon = v;
      else if (filter === 1) recon = v + a;
      else if (filter === 2) recon = v + b;
      else if (filter === 3) recon = v + ((a + b) >> 1);
      else if (filter === 4) recon = v + paeth(a, b, c);
      else throw new Error(`filter ${filter} unsupported`);
      out[y * stride + x] = recon & 0xff;
    }
    rp += stride;
  }
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = out[i * channels];
    rgba[i * 4 + 1] = out[i * channels + 1];
    rgba[i * 4 + 2] = out[i * channels + 2];
    rgba[i * 4 + 3] = channels === 4 ? out[i * channels + 3] : 255;
  }
  return { width, height, data: rgba };
}

export function encodePng(width, height, rgba, opaque = false) {
  const channels = opaque ? 3 : 4;
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < stride; x += 1) {
      const si = y * width * 4 + (x / channels | 0) * 4 + x % channels;
      raw[y * (stride + 1) + 1 + x] = rgba[si];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function boxDownscale(img, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = img.width / w;
  const sy = img.height / h;
  for (let y = 0; y < h; y += 1) {
    const y0 = y * sy;
    const y1 = Math.min(img.height, y0 + sy);
    for (let x = 0; x < w; x += 1) {
      const x0 = x * sx;
      const x1 = Math.min(img.width, x0 + sx);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy += 1) {
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx += 1) {
          const i = (yy * img.width + xx) * 4;
          r += img.data[i];
          g += img.data[i + 1];
          b += img.data[i + 2];
          a += img.data[i + 3];
          n += 1;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = a / n;
    }
  }
  return { width: w, height: h, data: out };
}

function chromaKey(img) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const dist = Math.sqrt((r - 255) ** 2 + g ** 2 + (b - 255) ** 2);
    if (dist < 70) {
      d[i + 3] = 0;
      continue;
    }
    if (dist < 210) {
      const a = Math.min(1, (dist - 70) / 140);
      d[i] = Math.max(0, Math.min(255, (r - (1 - a) * 255) / a));
      d[i + 1] = Math.max(0, Math.min(255, g / a));
      d[i + 2] = Math.max(0, Math.min(255, (b - (1 - a) * 255) / a));
      d[i + 3] = Math.min(d[i + 3], a * 255);
    }
  }
  return img;
}

function removeWatermark(img, opaque) {
  const x0 = Math.floor(img.width * 0.88);
  const y0 = Math.floor(img.height * 0.94);
  for (let y = y0; y < img.height; y += 1) {
    for (let x = x0; x < img.width; x += 1) {
      const di = (y * img.width + x) * 4;
      const sx = Math.max(0, 2 * x0 - x - 1);
      const si = (y * img.width + sx) * 4;
      img.data[di] = img.data[si];
      img.data[di + 1] = img.data[si + 1];
      img.data[di + 2] = img.data[si + 2];
      img.data[di + 3] = opaque ? 255 : img.data[si + 3];
    }
  }
  return img;
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function buildPalette(era) {
  const base = PALETTES[era].map(hexToRgb);
  const shades = [];
  for (const [r, g, b] of base) {
    shades.push([r, g, b]);
    shades.push([Math.min(255, r * 1.18 + 8), Math.min(255, g * 1.18 + 8), Math.min(255, b * 1.18 + 8)]);
    shades.push([r * 0.78, g * 0.78, b * 0.78]);
  }
  return shades;
}

function quantize(img, palette) {
  const d = img.data;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const i = (y * img.width + x) * 4;
      if (d[i + 3] === 0) continue;
      const dither = (BAYER[y % 4][x % 4] / 16 - 0.5) * 26;
      const r = d[i] + dither;
      const g = d[i + 1] + dither;
      const b = d[i + 2] + dither;
      let best = 0;
      let bestDist = Infinity;
      for (let k = 0; k < palette.length; k += 1) {
        const p = palette[k];
        const dist = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = k;
        }
      }
      d[i] = palette[best][0];
      d[i + 1] = palette[best][1];
      d[i + 2] = palette[best][2];
    }
  }
  return img;
}

function upscale2(img) {
  const out = new Uint8ClampedArray(img.width * 2 * img.height * 2 * 4);
  const w = img.width * 2;
  for (let y = 0; y < img.height * 2; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = ((y >> 1) * img.width + (x >> 1)) * 4;
      const di = (y * w + x) * 4;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
      out[di + 3] = img.data[si + 3];
    }
  }
  return { width: w, height: img.height * 2, data: out };
}

function over(dst, src) {
  for (let i = 0; i < dst.data.length; i += 4) {
    const a = src.data[i + 3] / 255;
    if (a === 0) continue;
    dst.data[i] = src.data[i] * a + dst.data[i] * (1 - a);
    dst.data[i + 1] = src.data[i + 1] * a + dst.data[i + 1] * (1 - a);
    dst.data[i + 2] = src.data[i + 2] * a + dst.data[i + 2] * (1 - a);
    dst.data[i + 3] = 255;
  }
  return dst;
}

const [mode, ...args] = process.argv.slice(2);

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
if (mode === 'layer') {
  const [src, out, era, layer] = args;
  const img = decodePng(readFileSync(src));
  let small = boxDownscale(img, GRID_W, GRID_H);
  small = removeWatermark(small, layer === 'far');
  if (layer !== 'far') small = chromaKey(small);
  small = quantize(small, buildPalette(era));
  const big = upscale2(small);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, encodePng(big.width, big.height, big.data, layer === 'far'));
  console.log(`layer ${era}/${layer} -> ${out} (${(readFileSync(out).length / 1024).toFixed(0)}KB)`);
} else if (mode === 'composite') {
  const [era, out, dir] = args;
  const base = dir || `src/assets/scenes/${era}`;
  const far = decodePng(readFileSync(`${base}/far.png`));
  const mid = decodePng(readFileSync(`${base}/mid.png`));
  const near = decodePng(readFileSync(`${base}/near.png`));
  const canvas = { width: far.width, height: far.height, data: new Uint8ClampedArray(far.data) };
  over(canvas, mid);
  over(canvas, near);
  writeFileSync(out, encodePng(canvas.width, canvas.height, canvas.data, true));
  console.log(`composite ${era} -> ${out}`);
} else {
  console.error('usage: asset-pipeline.mjs layer <src> <out> <era> <far|mid|near> | composite <era> <out> [dir]');
  process.exit(1);
}
}
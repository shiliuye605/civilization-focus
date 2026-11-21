/* V0.6+ 环境音替换：用户提供的三条实录 → 选稳定 60s 循环窗 → 等功率交叉淡化无缝循环 → 统一 -20 LUFS / TP≤-1.5 → 双容器编码 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SR, lufs, truePeak, normalize, encodeWav } from './audio-forge.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FF = resolve(ROOT, 'node_modules/ffmpeg-static/ffmpeg.exe');
const WIP = resolve(ROOT, 'tools/audio-wip');
const LOOP = 40;
const FADE = 0.6;
const MAX_BYTES = 500 * 1024;

const SOURCES = {
  forest: 'E:/番茄钟/output/参考音频/森林鸟鸣-Felix-Blume-414098.mp3',
  field: 'E:/番茄钟/output/参考音频/田园流水.m4a',
  steam: 'E:/番茄钟/output/参考音频/蒸汽火车.m4a',
  space: 'E:/番茄钟/output/参考音频/太空首页1.m4a',
};

function run(args) {
  const r = spawnSync(FF, ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}\n${r.stderr}`);
  return r.stderr || '';
}

function readWav(path) {
  const b = readFileSync(path);
  let off = 12;
  let sr = 0;
  let data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const len = b.readUInt32LE(off + 4);
    if (id === 'fmt ') sr = b.readUInt32LE(off + 12);
    if (id === 'data') data = b.subarray(off + 8, off + 8 + len);
    off += 8 + len + (len & 1);
  }
  const n = Math.floor(data.length / 2);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i += 1) x[i] = data.readInt16LE(i * 2) / 32768;
  return { x, sr };
}

function pickWindow(x, sr) {
  const block = 2 * sr;
  const nb = Math.floor(x.length / block);
  const rms = [];
  const crest = [];
  for (let b = 0; b < nb; b += 1) {
    let s = 0;
    let pk = 0;
    for (let i = b * block; i < (b + 1) * block; i += 1) {
      s += x[i] * x[i];
      const a = Math.abs(x[i]);
      if (a > pk) pk = a;
    }
    const r = Math.sqrt(s / block);
    rms.push(r);
    crest.push(r > 1e-5 ? pk / r : 0);
  }
  const need = Math.ceil((LOOP + FADE) / 2);
  let best = null;
  for (let s = 2; s + need <= nb - 2; s += 1) {
    const w = rms.slice(s, s + need);
    const c = crest.slice(s, s + need).sort((a, b) => a - b);
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    if (mean < 1e-4) continue;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length);
    const quiet = w.filter((v) => v < 0.3 * mean).length / w.length;
    const score = sd / mean + quiet * 2 + 0.02 * c[Math.floor(c.length * 0.9)] + 0.02 * crest[s] + 0.02 * crest[s + need - 1];
    if (!best || score < best.score) best = { score, start: s * 2, cv: sd / mean, quiet };
  }
  if (!best) throw new Error('no usable window');
  return best;
}

function loopifyFade(x, fadeSec) {
  const fade = Math.round(fadeSec * SR);
  const n = x.length - fade;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = x[i];
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade;
    out[i] = x[i] * Math.sqrt(t) + x[n + i] * Math.sqrt(1 - t);
  }
  return out;
}

function measure(file) {
  const err = run(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const i = [...err.matchAll(/I:\s*(-?[\d.]+)\s*LUFS/g)].pop();
  const p = [...err.matchAll(/Peak:\s*(-?[\d.]+)\s*dBFS/g)].pop();
  return { lufs: i ? +i[1] : null, tp: p ? +p[1] : null };
}

function seam(file, procWav) {
  const wav = resolve(WIP, 'seam.wav');
  run(['-i', file, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', '-y', wav]);
  const { x } = readWav(wav);
  const p = readWav(procWav).x;
  let end = Math.min(x.length, p.length);
  const dev = (a, b) => {
    let m = 0;
    for (let i = a; i < b; i += 1) { const d = Math.abs(x[i] - p[i - start]); if (d > m) m = d; }
    return m;
  };
  let start = 0;
  let best = Infinity;
  const m0 = Math.floor(Math.min(x.length, p.length) / 2);
  for (let k = 0; k <= 2000; k += 4) {
    let s = 0;
    for (let i = m0; i < m0 + 200; i += 1) { const d = x[i] - p[i + k]; s += d * d; }
    if (s < best) { best = s; start = k; }
  }
  end = Math.min(x.length, p.length + start);
  while (end > start + 2000 && dev(end - 64, end) > 0.06) end -= 100;
  if (end - start < 1000) { start = 0; end = Math.min(x.length, p.length); }
  const d = Math.abs(x[end - 1] - x[start]);
  const diffs = [];
  for (let i = start; i + 1 < end; i += 1) diffs.push(Math.abs(x[i + 1] - x[i]));
  diffs.sort((a, b) => a - b);
  const p999 = diffs[Math.floor(diffs.length * 0.999)];
  const pre = Math.abs(p[p.length - 1] - p[0]);
  const nd = [];
  for (let i = m0; i < m0 + 10000; i += 1) nd.push(Math.abs(x[i] - p[i - start]));
  nd.sort((a, b) => a - b);
  const noise = nd[Math.floor(nd.length / 2)];
  return { boundary: +d.toFixed(5), p999: +p999.toFixed(5), preBoundary: +pre.toFixed(5), codecPadTrim: x.length - end + start, ok: d <= p999 + 2 * noise && pre <= p999, noise: +noise.toFixed(4) };
}

function scaled(x, db) {
  const g = Math.pow(10, db / 20);
  const y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i += 1) y[i] = x[i] * g;
  return y;
}

const ENC = {
  ogg: ['-c:a', 'libopus', '-b:a', '80k', '-vbr', 'constrained', '-ar', '48000', '-ac', '1'],
  m4a: ['-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-ac', '1'],
};

mkdirSync(WIP, { recursive: true });
const report = {};
const finals = [];
for (const [id, src] of Object.entries(SOURCES)) {
  const ana = resolve(WIP, `${id}-ana.wav`);
  run(['-i', src, '-ac', '1', '-ar', '8000', '-c:a', 'pcm_s16le', '-y', ana]);
  const a = readWav(ana);
  const win = pickWindow(a.x, a.sr);
  const winWav = resolve(WIP, `${id}-win.wav`);
  run(['-ss', String(win.start), '-t', String(LOOP + FADE), '-i', src, '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_s16le', '-y', winWav]);
  const w = readWav(winWav);
  const proc = normalize(loopifyFade(w.x, FADE), Math.pow(10, -4 / 20));
  report[id] = { source: src, windowStartSec: win.start, windowCv: +win.cv.toFixed(3), loopSec: +(proc.length / SR).toFixed(2), preLufs: +lufs(proc).toFixed(2), preTp: +(20 * Math.log10(truePeak(proc))).toFixed(2) };
  for (const [ext, args] of Object.entries(ENC)) {
    const out = resolve(WIP, `${id}.${ext}`);
    const procWav = resolve(WIP, `${id}-${ext}-proc.wav`);
    writeFileSync(procWav, encodeWav(proc));
    let cur = proc;
    run(['-i', procWav, ...args, '-y', out]);
    let m = measure(out);
    const trim = Math.min(-20 - m.lufs, -1.8 - m.tp);
    if (Math.abs(trim) > 0.1) {
      cur = scaled(proc, trim);
      writeFileSync(procWav, encodeWav(cur));
      run(['-i', procWav, ...args, '-y', out]);
      m = measure(out);
    }
    finals.push({ id, ext, out, procWav, cur, lufs: m.lufs });
    report[id][ext] = { bytes: statSync(out).size, ...m };
  }
}
const common = Math.min(...finals.map((f) => f.lufs));
for (const f of finals) {
  const extra = common - f.lufs;
  if (extra < -0.05) {
    f.cur = scaled(f.cur, extra);
    writeFileSync(f.procWav, encodeWav(f.cur));
    run(['-i', f.procWav, ...ENC[f.ext], '-y', f.out]);
    const m = measure(f.out);
    report[f.id][f.ext] = { bytes: statSync(f.out).size, ...m };
    f.lufs = m.lufs;
  }
}
for (const f of finals) {
  const r = report[f.id][f.ext];
  if (r.tp > -1.5) throw new Error(`${f.id}.${f.ext} true peak ${r.tp} > -1.5`);
  if (r.bytes > MAX_BYTES) throw new Error(`${f.id}.${f.ext} over budget ${r.bytes}`);
  if (f.ext === 'ogg') r.seam = seam(f.out, f.procWav);
}
const spread = Math.max(...finals.map((f) => f.lufs)) - Math.min(...finals.map((f) => f.lufs));
if (spread > 0.3) throw new Error(`loudness spread ${spread}`);
for (const [id] of Object.entries(SOURCES)) {
  for (const ext of ['ogg', 'm4a']) {
    writeFileSync(resolve(ROOT, `src/assets/audio/${id}.${ext}`), readFileSync(resolve(WIP, `${id}.${ext}`)));
  }
}
mkdirSync(resolve(ROOT, 'tools/shots/v06'), { recursive: true });
writeFileSync(resolve(ROOT, 'tools/shots/v06/ambience-import.json'), JSON.stringify({ commonLufs: +common.toFixed(2), spread: +spread.toFixed(2), report }, null, 2));
console.log(JSON.stringify({ commonLufs: +common.toFixed(2), spread: +spread.toFixed(2), report }, null, 2));
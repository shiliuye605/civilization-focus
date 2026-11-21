/* 环境音合成：Node DSP → K 加权响度统一 → 过零循环 + 交叉淡化 → WAV（ffmpeg 编码双容器） */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SR = 44100;
const SECONDS = 32;
const FADE = 0.4;
const TARGET_LUFS = -20;
const PEAK_LIMIT = Math.pow(10, -1.5 / 20);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

function shelfHigh(x, f0, gainDb, q) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / SR;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const alpha = sw / (2 * q);
  const b0 = A * ((A + 1) + (A - 1) * cw + 2 * Math.sqrt(A) * alpha);
  const b1 = -2 * A * ((A - 1) + (A + 1) * cw);
  const b2 = A * ((A + 1) + (A - 1) * cw - 2 * Math.sqrt(A) * alpha);
  const a0 = (A + 1) - (A - 1) * cw + 2 * Math.sqrt(A) * alpha;
  const a1 = 2 * ((A - 1) - (A + 1) * cw);
  const a2 = (A + 1) - (A - 1) * cw - 2 * Math.sqrt(A) * alpha;
  return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

function highpass(x, f0, q) {
  const w0 = (2 * Math.PI * f0) / SR;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const alpha = sw / (2 * q);
  const b0 = (1 + cw) / 2, b1 = -(1 + cw), b2 = (1 + cw) / 2;
  const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

function bandpass(x, f0, q) {
  const w0 = (2 * Math.PI * f0) / SR;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const alpha = sw / (2 * q);
  const b0 = alpha, b1 = 0, b2 = -alpha;
  const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

function lowpass(x, f0, q = 0.707) {
  const w0 = (2 * Math.PI * f0) / SR;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const alpha = sw / (2 * q);
  const b0 = (1 - cw) / 2, b1 = 1 - cw, b2 = (1 - cw) / 2;
  const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

function kWeight(x) {
  return highpass(shelfHigh(x, 1681.974450955533, 3.99984385397334, 0.7071752369554196), 38.13547087602444, 0.5003270373238773);
}

function lufs(x) {
  const w = kWeight(x);
  const block = Math.round(0.4 * SR);
  const step = Math.round(0.1 * SR);
  const powers = [];
  for (let s = 0; s + block <= w.length; s += step) {
    let sum = 0;
    for (let i = s; i < s + block; i += 1) sum += w[i] * w[i];
    powers.push(sum / block);
  }
  const loud = (p) => -0.691 + 10 * Math.log10(p + 1e-12);
  const abs = powers.filter((p) => loud(p) > -70);
  if (!abs.length) return -70;
  const mean = abs.reduce((a, b) => a + b, 0) / abs.length;
  const rel = abs.filter((p) => loud(p) > loud(mean) - 10);
  const gated = rel.reduce((a, b) => a + b, 0) / rel.length;
  return loud(gated);
}

function truePeak(x) {
  let peak = 0;
  for (let i = 0; i < x.length - 1; i += 1) {
    for (let k = 0; k < 4; k += 1) {
      const v = Math.abs(x[i] + ((x[i + 1] - x[i]) * k) / 4);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

function normalize(x, peakLimit = PEAK_LIMIT) {
  let y = x;
  const knee = peakLimit * 0.6;
  for (let pass = 0; pass < 3; pass += 1) {
    const gain = Math.pow(10, (TARGET_LUFS - lufs(y)) / 20);
    y = y.map((v) => {
      const s = v * gain;
      const a = Math.abs(s);
      if (a <= knee) return s;
      return Math.sign(s) * (knee + (peakLimit - knee) * Math.tanh((a - knee) / (peakLimit - knee)));
    });
    if (truePeak(y) <= peakLimit && Math.abs(lufs(y) - TARGET_LUFS) < 0.25) break;
  }
  return y;
}

function loopify(x) {
  const fade = Math.round(FADE * SR);
  const n = x.length - fade;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = x[i];
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade;
    const g = Math.sqrt(t);
    out[i] = x[i] * g + x[n + i] * Math.sqrt(1 - t);
  }
  let start = 0;
  for (let i = 1; i < Math.min(441, n); i += 1) {
    if (out[i - 1] <= 0 && out[i] > 0) { start = i; break; }
  }
  const rot = new Float64Array(n);
  for (let i = 0; i < n; i += 1) rot[i] = out[(i + start) % n];
  return rot;
}

function noise(rng, n) {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i += 1) x[i] = rng() * 2 - 1;
  return x;
}

function addAt(dst, src, at) {
  for (let i = 0; i < src.length; i += 1) {
    const j = at + i;
    if (j >= 0 && j < dst.length) dst[j] += src[i];
  }
}

function chirp(rng, f0, f1, dur, amp) {
  const n = Math.round(dur * SR);
  const x = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    const f = f0 + (f1 - f0) * t + Math.sin(t * 40) * 60;
    ph += (2 * Math.PI * f) / SR;
    const env = Math.sin(Math.PI * t) ** 2;
    x[i] = Math.sin(ph) * env * amp;
  }
  return x;
}

function bird(rng, at, dst) {
  const base = 1900 + rng() * 1600;
  const notes = 2 + Math.floor(rng() * 4);
  let t = at;
  for (let k = 0; k < notes; k += 1) {
    const dur = 0.05 + rng() * 0.09;
    const up = rng() > 0.4;
    addAt(dst, chirp(rng, base * (up ? 1 : 1.25), base * (up ? 1.3 : 0.95), dur, 0.16 + rng() * 0.1), Math.round(t * SR));
    t += dur + 0.03 + rng() * 0.06;
  }
}

function synthForest() {
  const rng = mulberry32(11);
  const n = SR * SECONDS;
  const bed = lowpass(noise(rng, n), 900, 0.5);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const gust = 0.55 + 0.45 * Math.sin((2 * Math.PI * i) / (SR * 7.3) + 1.2) * Math.sin((2 * Math.PI * i) / (SR * 3.1));
    out[i] = bed[i] * 0.16 * gust;
  }
  const rustle = bandpass(noise(rng, n), 3200, 0.8);
  for (let i = 0; i < n; i += 1) out[i] += rustle[i] * 0.05 * (0.5 + 0.5 * Math.sin((2 * Math.PI * i) / (SR * 5.7)));
  for (let k = 0; k < 14; k += 1) bird(rng, 0.6 + rng() * (SECONDS - 2), out);
  return out;
}

function synthField() {
  const rng = mulberry32(23);
  const n = SR * SECONDS;
  const water = bandpass(noise(rng, n), 1400, 0.6);
  const bubble = bandpass(noise(rng, n), 2600, 1.4);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const flow = 0.7 + 0.3 * Math.sin((2 * Math.PI * t) / 6.1);
    out[i] = water[i] * 0.2 * flow + bubble[i] * 0.07 * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 2.3 + 1));
  }
  for (let k = 0; k < 26; k += 1) {
    const at = Math.round(rng() * (n - 4000));
    const dur = Math.round((0.03 + rng() * 0.05) * SR);
    for (let i = 0; i < dur; i += 1) {
      const env = Math.sin((Math.PI * i) / dur) ** 2;
      out[at + i] += Math.sin((2 * Math.PI * (700 + rng() * 900) * i) / SR) * env * 0.05;
    }
  }
  const wheelPeriod = 1.15;
  for (let t = 0.4; t < SECONDS - 0.4; t += wheelPeriod) {
    const at = Math.round(t * SR);
    const dur = Math.round(0.09 * SR);
    for (let i = 0; i < dur; i += 1) {
      const env = Math.exp(-i / (SR * 0.02));
      out[at + i] += (Math.sin((2 * Math.PI * 180 * i) / SR) * 0.6 + (rng() * 2 - 1) * 0.25) * env * 0.09;
    }
  }
  for (let k = 0; k < 6; k += 1) bird(rng, 1 + rng() * (SECONDS - 3), out);
  return out;
}

function synthSteam() {
  const rng = mulberry32(37);
  const n = SR * SECONDS;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const am = 0.75 + 0.25 * Math.sin((2 * Math.PI * t) / 4.7);
    out[i] =
      (Math.sin((2 * Math.PI * 52 * t) / 1) * 0.1 +
        Math.sin((2 * Math.PI * 104 * t) / 1) * 0.05 +
        Math.sin((2 * Math.PI * 156 * t + 0.7) / 1) * 0.025) * am;
  }
  const hum = lowpass(noise(rng, n), 240, 0.7);
  for (let i = 0; i < n; i += 1) out[i] += hum[i] * 0.12;
  for (let k = 0; k < 5; k += 1) {
    const at = Math.round((2 + k * 6.2 + rng() * 1.5) * SR);
    const dur = Math.round((0.9 + rng() * 0.7) * SR);
    const hiss = highpass(noise(rng, dur), 2400, 0.7);
    for (let i = 0; i < dur; i += 1) {
      const t = i / dur;
      const env = Math.sin(Math.PI * t) ** 1.5;
      out[at + i] += hiss[i] * env * 0.08;
    }
  }
  for (let k = 0; k < 4; k += 1) {
    const start = 3.5 + k * 7.4;
    for (let w = 0; w < 8; w += 1) {
      const at = Math.round((start + w * 0.42) * SR);
      const dur = Math.round(0.05 * SR);
      const clack = bandpass(noise(rng, dur), 900, 1.2);
      for (let i = 0; i < dur; i += 1) {
        const env = Math.exp(-i / (SR * 0.012));
        out[at + i] += clack[i] * env * 0.05;
      }
    }
  }
  return out;
}

function encodeWav(x) {
  const n = x.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i += 1) {
    const v = Math.max(-1, Math.min(1, x[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

export { SR, FADE, TARGET_LUFS, PEAK_LIMIT, kWeight, lufs, truePeak, normalize, loopify, encodeWav };

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const RECIPES = { forest: synthForest, field: synthField, steam: synthSteam };
  const ids = process.argv.slice(2);
  if (!ids.length || ids.some((id) => !RECIPES[id])) {
    console.error('usage: node tools/audio-forge.mjs <forest|field|steam> [...]');
    process.exit(1);
  }
  mkdirSync(resolve(ROOT, 'tools/audio-wip'), { recursive: true });
  for (const id of ids) {
    const raw = loopify(RECIPES[id]());
    const done = normalize(raw);
    const path = resolve(ROOT, `tools/audio-wip/${id}.wav`);
    writeFileSync(path, encodeWav(done));
    console.log(`${id}: ${done.length / SR}s  ${lufs(done).toFixed(2)} LUFS  peak ${(20 * Math.log10(truePeak(done))).toFixed(2)} dBTP  -> ${path}`);
  }
}
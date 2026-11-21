import { backgroundForEra } from './rewards.js';

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

function paintGalaxy(g, w, h) {
  const rng = mulberry32(41);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#04070d');
  sky.addColorStop(0.55, '#081120');
  sky.addColorStop(1, '#0c1a2c');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  g.save();
  g.translate(w * 0.5, h * 0.42);
  g.rotate(-0.32);
  const band = g.createLinearGradient(0, -h * 0.3, 0, h * 0.3);
  band.addColorStop(0, 'rgba(120,150,190,0)');
  band.addColorStop(0.42, 'rgba(140,170,205,0.05)');
  band.addColorStop(0.5, 'rgba(190,210,235,0.09)');
  band.addColorStop(0.58, 'rgba(140,170,205,0.05)');
  band.addColorStop(1, 'rgba(120,150,190,0)');
  g.fillStyle = band;
  g.fillRect(-w, -h * 0.3, w * 2, h * 0.6);
  for (let i = 0; i < 260; i += 1) {
    const x = Math.round((rng() * 2 - 1) * w);
    const y = Math.round((rng() + rng() + rng() - 1.5) * h * 0.16);
    const a = 0.05 + rng() * 0.16;
    g.fillStyle = `rgba(205,220,240,${a.toFixed(3)})`;
    g.fillRect(x, y, rng() > 0.85 ? 2 : 1, 1);
  }
  g.restore();

  const cx = w * 0.5;
  const cy = h * 0.46;
  const quiet = Math.min(w, h) * 0.3;
  for (let i = 0; i < 150; i += 1) {
    const x = Math.round(rng() * w);
    const y = Math.round(rng() * h);
    const d = Math.hypot(x - cx, y - cy);
    if (d < quiet && rng() > 0.25) continue;
    const a = (d < quiet ? 0.1 : 0.2) + rng() * 0.4;
    g.fillStyle = `rgba(226,236,248,${a.toFixed(3)})`;
    const s = rng() > 0.92 ? 2 : 1;
    g.fillRect(x, y, s, s);
  }
  for (let i = 0; i < Math.round((w * h) / 2600); i += 1) {
    g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.05)';
    g.fillRect(Math.round(rng() * w), Math.round(rng() * h), 1, 1);
  }
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

function dither(g, w, h, rng, alpha) {
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const t = BAYER4[(y >> 1) & 3][(x >> 1) & 3] / 16;
      if (rng() < t * 0.5) {
        g.fillStyle = `rgba(255,255,255,${alpha})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
}

function paintAurora(g, w, h) {
  const rng = mulberry32(77);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#02080b');
  sky.addColorStop(0.6, '#05141b');
  sky.addColorStop(0.88, '#0d1a20');
  sky.addColorStop(1, '#2b1c12');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  const horizon = g.createRadialGradient(w * 0.5, h * 1.15, 0, w * 0.5, h * 1.15, h * 0.7);
  horizon.addColorStop(0, 'rgba(214,146,84,0.14)');
  horizon.addColorStop(1, 'rgba(214,146,84,0)');
  g.fillStyle = horizon;
  g.fillRect(0, 0, w, h);

  const bands = [
    { y: 0.2, thick: 0.3, hue: '86,224,168', a: 0.2, drift: 0.05 },
    { y: 0.34, thick: 0.24, hue: '64,208,196', a: 0.15, drift: -0.04 },
    { y: 0.12, thick: 0.18, hue: '122,236,150', a: 0.11, drift: 0.07 }
  ];
  for (const b of bands) {
    const top = h * b.y;
    const bottom = top + h * b.thick;
    const grad = g.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, `rgba(${b.hue},0)`);
    grad.addColorStop(0.35, `rgba(${b.hue},${b.a})`);
    grad.addColorStop(0.75, `rgba(${b.hue},${(b.a * 0.45).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${b.hue},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-w * 0.1, top + h * b.drift);
    g.bezierCurveTo(w * 0.25, top - h * 0.08, w * 0.55, top + h * 0.1, w * 1.1, top - h * 0.04);
    g.lineTo(w * 1.1, bottom - h * 0.02);
    g.bezierCurveTo(w * 0.6, bottom + h * 0.08, w * 0.3, bottom - h * 0.06, -w * 0.1, bottom + h * 0.04);
    g.closePath();
    g.fill();
    for (let i = 0; i < 46; i += 1) {
      const x = Math.round(rng() * w);
      const y = Math.round(top + rng() * (bottom - top));
      g.fillStyle = `rgba(${b.hue},${(0.05 + rng() * 0.08).toFixed(3)})`;
      g.fillRect(x, y, 1, Math.round(4 + rng() * 14));
    }
  }

  const cx = w * 0.5;
  const cy = h * 0.46;
  const quiet = Math.min(w, h) * 0.3;
  for (let i = 0; i < 90; i += 1) {
    const x = Math.round(rng() * w);
    const y = Math.round(rng() * h * 0.8);
    const d = Math.hypot(x - cx, y - cy);
    if (d < quiet && rng() > 0.2) continue;
    g.fillStyle = `rgba(224,240,244,${((d < quiet ? 0.08 : 0.16) + rng() * 0.3).toFixed(3)})`;
    g.fillRect(x, y, rng() > 0.93 ? 2 : 1, 1);
  }
  dither(g, w, h, rng, '0.012');
}

function paintNebula(g, w, h) {
  const rng = mulberry32(93);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#060509');
  sky.addColorStop(0.55, '#0c0a12');
  sky.addColorStop(1, '#141019');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.46;
  const quiet = Math.min(w, h) * 0.32;
  const clouds = [
    { x: 0.2, y: 0.26, r: 0.42, hue: '126,92,164', a: 0.12 },
    { x: 0.78, y: 0.2, r: 0.36, hue: '188,120,74', a: 0.1 },
    { x: 0.68, y: 0.72, r: 0.44, hue: '104,80,148', a: 0.09 },
    { x: 0.26, y: 0.78, r: 0.34, hue: '164,102,66', a: 0.07 },
    { x: 0.5, y: 0.12, r: 0.3, hue: '140,100,170', a: 0.06 }
  ];
  for (const c of clouds) {
    const px = c.x * w;
    const py = c.y * h;
    const pr = c.r * Math.max(w, h);
    const calm = Math.hypot(px - cx, py - cy) < quiet ? 0.45 : 1;
    const grad = g.createRadialGradient(px, py, 0, px, py, pr);
    grad.addColorStop(0, `rgba(${c.hue},${(c.a * calm).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(${c.hue},${(c.a * 0.45 * calm).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${c.hue},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 130; i += 1) {
      const ang = rng() * Math.PI * 2;
      const rad = (rng() + rng()) * 0.5 * pr;
      const x = Math.round(px + Math.cos(ang) * rad);
      const y = Math.round(py + Math.sin(ang) * rad * 0.7);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      g.fillStyle = `rgba(${c.hue},${(0.02 + rng() * 0.05).toFixed(3)})`;
      g.fillRect(x, y, rng() > 0.8 ? 2 : 1, rng() > 0.8 ? 2 : 1);
    }
  }

  const haze = g.createLinearGradient(0, h * 0.7, 0, h);
  haze.addColorStop(0, 'rgba(96,106,118,0)');
  haze.addColorStop(1, 'rgba(96,106,118,0.07)');
  g.fillStyle = haze;
  g.fillRect(0, 0, w, h);

  for (let i = 0; i < 70; i += 1) {
    const x = Math.round(rng() * w);
    const y = Math.round(rng() * h);
    const d = Math.hypot(x - cx, y - cy);
    if (d < quiet && rng() > 0.2) continue;
    g.fillStyle = `rgba(232,228,240,${((d < quiet ? 0.08 : 0.18) + rng() * 0.32).toFixed(3)})`;
    g.fillRect(x, y, rng() > 0.94 ? 2 : 1, 1);
  }
  dither(g, w, h, rng, '0.012');
}

const PAINTERS = { galaxy: paintGalaxy, aurora: paintAurora, nebula: paintNebula };

export function createBackground(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  let reduced = reducedMotion;
  let currentId = null;
  let current = null;
  let raf = 0;
  let resizeTimer = 0;
  const cache = new Map();

  function layout() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function render(id) {
    const key = `${id}:${canvas.width}x${canvas.height}`;
    if (!cache.has(key)) {
      const off = document.createElement('canvas');
      off.width = canvas.width;
      off.height = canvas.height;
      const painter = PAINTERS[id] || paintGalaxy;
      painter(off.getContext('2d'), off.width, off.height);
      if (cache.size > 6) cache.clear();
      cache.set(key, off);
    }
    return cache.get(key);
  }

  function show(id, fadeMs) {
    const next = render(id);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (!current || reduced || fadeMs <= 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(next, 0, 0);
      current = next;
      currentId = id;
      return;
    }
    const prev = current;
    const start = performance.now();
    currentId = id;
    const step = (now) => {
      const t = Math.min(1, (now - start) / fadeMs);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(prev, 0, 0);
      ctx.globalAlpha = t;
      ctx.drawImage(next, 0, 0);
      ctx.globalAlpha = 1;
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        raf = 0;
        current = next;
      }
    };
    raf = requestAnimationFrame(step);
  }

  layout();
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      layout();
      if (currentId) show(currentId, 0);
    }, 160);
  });

  return {
    setEra(eraId, progress, demo = false) {
      const bg = backgroundForEra(eraId, progress, demo);
      const id = bg ? bg.id : 'galaxy';
      if (id === currentId) return;
      show(id, 420);
    },
    setReduced(next) {
      reduced = next;
    },
    get currentId() {
      return currentId;
    }
  };
}
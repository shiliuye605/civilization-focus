import { ERAS } from './eras.js';

const TEX_W = 384;
const TEX_H = 192;
const TAU = Math.PI * 2;

const RIVER = [
  [300, -4],
  [292, 20],
  [301, 40],
  [288, 60],
  [297, 80],
  [285, 100],
  [293, 120],
  [282, 140],
  [290, 160],
  [280, 196]
];

const FIELD_TILES = ['field1', 'field2', 'field3', 'field4'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blockLine(g, points, color, width, grid = 4) {
  g.fillStyle = color;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / grid));
    for (let s = 0; s <= steps; s += 1) {
      const x = x1 + ((x2 - x1) * s) / steps;
      const y = y1 + ((y2 - y1) * s) / steps;
      const px = Math.round(x / grid) * grid;
      const py = Math.round(y / grid) * grid;
      g.fillRect(px - width / 2, py - width / 2, width, width);
    }
  }
}

function buildTexture(eraId) {
  const pal = ERAS[eraId].palette;
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;

  g.fillStyle = pal.land;
  g.fillRect(0, 0, TEX_W, TEX_H);

  const rnd = mulberry32(eraId === 'tang' ? 23 : 9);

  for (let i = 0; i < 720; i += 1) {
    const x = Math.round((rnd() * TEX_W) / 4) * 4;
    const y = Math.round((rnd() * TEX_H) / 4) * 4;
    const roll = rnd();
    g.globalAlpha = 0.24 + rnd() * 0.3;
    g.fillStyle = roll < 0.45 ? pal.landDark : roll < 0.78 ? pal.landLight : pal.earth;
    g.fillRect(x, y, 4, 4);
  }
  g.globalAlpha = 1;

  // 共同山脉：左上角阶梯状岩体
  for (let row = 0; row < 9; row += 1) {
    const width = 60 - row * 5;
    g.fillStyle = row > 5 ? pal.rockDark : pal.rock;
    g.fillRect(18 + row * 3, 22 + row * 4, width, 4);
  }
  g.fillStyle = pal.rockDark;
  g.fillRect(20, 58, 48, 4);

  // 共同的河流：三套地表使用同一路径
  blockLine(g, RIVER, pal.waterDeep, 9, 3);
  blockLine(g, RIVER, pal.water, 6, 3);
  blockLine(
    g,
    RIVER.map(([x, y]) => [x - 2, y]),
    'rgba(255,255,255,0.16)',
    1,
    3
  );

  if (eraId === 'stone') {
    const clusters = [
      [26, 76],
      [52, 92],
      [76, 70],
      [44, 132],
      [88, 150],
      [120, 88],
      [148, 62],
      [170, 96],
      [110, 40],
      [26, 168],
      [60, 178],
      [190, 168],
      [250, 40],
      [280, 86],
      [298, 150]
    ];
    clusters.forEach(([cx, cy]) => {
      const count = 4 + Math.floor(rnd() * 4);
      for (let i = 0; i < count; i += 1) {
        const x = Math.round(cx + (rnd() - 0.5) * 26);
        const y = Math.round(cy + (rnd() - 0.5) * 18);
        g.fillStyle = pal.forest;
        g.fillRect(x, y, 5, 5);
        g.fillStyle = pal.forestLight;
        g.fillRect(x + 1, y - 1, 3, 2);
        g.fillStyle = pal.earthDark;
        g.fillRect(x + 2, y + 5, 1, 2);
      }
    });

    // 营地空地
    for (let y = -3; y <= 3; y += 1) {
      for (let x = -6; x <= 6; x += 1) {
        if (x * x + (y * 2.2) ** 2 < 32) {
          g.fillStyle = pal.earth;
          g.fillRect(204 + x * 4, 112 + y * 4, 4, 4);
        }
      }
    }

    // 火堆与暖光
    const glow = g.createRadialGradient(208, 116, 1, 208, 116, 20);
    glow.addColorStop(0, 'rgba(255,190,110,0.5)');
    glow.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = glow;
    g.fillRect(188, 96, 40, 40);
    g.fillStyle = pal.glow;
    g.fillRect(206, 114, 3, 3);
    g.fillRect(210, 112, 2, 2);
    g.fillStyle = '#ffdca6';
    g.fillRect(208, 113, 2, 2);
  } else {
    // 盛唐：成片棋盘田地
    for (let row = 0; row < 11; row += 1) {
      for (let col = 0; col < 13; col += 1) {
        const x = 88 + col * 12;
        const y = 48 + row * 8;
        const colorKey = FIELD_TILES[(Math.floor(col / 2) + Math.floor(row / 2)) % FIELD_TILES.length];
        g.fillStyle = pal[colorKey];
        g.fillRect(x, y, 12, 8);
        g.strokeStyle = 'rgba(52,60,34,0.35)';
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, 11, 7);
      }
    }

    // 水渠，自河流横向引水
    [70, 92, 114, 136].forEach((y) => {
      blockLine(g, [[286, y], [240, y - 2], [150, y], [92, y - 1]], pal.waterDeep, 3, 3);
      blockLine(g, [[286, y], [240, y - 2], [150, y], [92, y - 1]], pal.water, 1, 3);
    });

    // 村落色块
    const villages = [
      [252, 58],
      [258, 100],
      [238, 148],
      [160, 30],
      [74, 140]
    ];
    villages.forEach(([x, y]) => {
      g.fillStyle = pal.wall;
      g.fillRect(x, y, 8, 6);
      g.fillStyle = pal.roof;
      g.fillRect(x - 1, y - 2, 10, 2);
      g.fillRect(x + 1, y + 6, 1, 2);
    });

    // 少量保留的树
    [
      [56, 60],
      [80, 168],
      [286, 176],
      [140, 168]
    ].forEach(([x, y]) => {
      g.fillStyle = pal.forest;
      g.fillRect(x, y, 4, 4);
      g.fillStyle = pal.forestLight;
      g.fillRect(x + 1, y - 1, 2, 2);
    });
  }

  const imageData = g.getImageData(0, 0, TEX_W, TEX_H);
  return { data: imageData.data, width: TEX_W, height: TEX_H };
}

function buildGeometry(size) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.455;
  const count = size * size;
  const inside = new Uint8Array(count);
  const baseLon = new Float32Array(count);
  const latitude = new Float32Array(count);
  const shade = new Float32Array(count);
  const rim = new Float32Array(count);
  const lx = -0.42;
  const ly = -0.48;
  const lz = 0.77;

  for (let y = 0; y < size; y += 1) {
    const ny = (y + 0.5 - cy) / radius;
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const nx = (x + 0.5 - cx) / radius;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      const light = 0.34 + 0.8 * diffuse;
      const edge = 0.62 + 0.38 * nz;
      inside[index] = 1;
      baseLon[index] = Math.atan2(nx, nz);
      latitude[index] = 0.5 - Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI;
      shade[index] = Math.min(1.22, light * edge);
      rim[index] = Math.max(0, 1 - nz - 0.52) * 0.85;
    }
  }

  return { size, cx, cy, radius, inside, baseLon, latitude, shade, rim };
}

export function createPlanetView(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const geometry = buildGeometry(size);
  const output = ctx.createImageData(size, size);
  const textures = new Map();

  let eraId = 'stone';
  let lon = 1;
  let visible = false;
  let dragging = false;
  let lastPointerX = 0;
  let raf = 0;
  let lastFrame = 0;
  let reduced = Boolean(options.reduced);

  function textureFor(id) {
    if (!textures.has(id)) textures.set(id, buildTexture(id));
    return textures.get(id);
  }

  function draw() {
    const texture = textureFor(eraId);
    const source = texture.data;
    const target = output.data;
    const { inside, baseLon, latitude, shade, rim, cx, cy, radius } = geometry;

    for (let i = 0; i < inside.length; i += 1) {
      const offset = i * 4;
      if (!inside[i]) {
        target[offset + 3] = 0;
        continue;
      }
      let u = ((baseLon[i] + lon) / TAU + 0.5) % 1;
      if (u < 0) u += 1;
      let v = latitude[i];
      if (v < 0) v = 0;
      else if (v > 0.999) v = 0.999;
      const tx = Math.min(TEX_W - 1, (u * TEX_W) | 0);
      const ty = Math.min(TEX_H - 1, (v * TEX_H) | 0);
      const sourceOffset = (ty * TEX_W + tx) * 4;
      const light = shade[i];
      const glow = rim[i];
      target[offset] = source[sourceOffset] * light + 22 * glow;
      target[offset + 1] = source[sourceOffset + 1] * light + 38 * glow;
      target[offset + 2] = source[sourceOffset + 2] * light + 58 * glow;
      target[offset + 3] = 255;
    }

    ctx.clearRect(0, 0, size, size);
    ctx.putImageData(output, 0, 0);

    const atmosphere = ctx.createRadialGradient(
      cx,
      cy,
      radius * 0.93,
      cx,
      cy,
      radius * 1.16
    );
    atmosphere.addColorStop(0, 'rgba(120,180,230,0)');
    atmosphere.addColorStop(0.55, 'rgba(120,180,230,0.16)');
    atmosphere.addColorStop(1, 'rgba(120,180,230,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = atmosphere;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.16, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    if (now - lastFrame < 33) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.12, (now - lastFrame) / 1000 || 0.033);
    lastFrame = now;
    if (!reduced && !dragging) lon += dt * 0.055;
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!visible || raf) return;
    if (reduced) {
      draw();
      return;
    }
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function setEra(id) {
    if (!ERAS[id] || id === eraId) return;
    eraId = id;
    lon = id === 'tang' ? 0.45 : 0.9;
    canvas.setAttribute(
      'aria-label',
      id === 'tang'
        ? '盛唐田园星球：沿河田块、水渠与村落'
        : '石器聚落星球：森林、河流与营地火光'
    );
    if (reduced || visible) draw();
  }

  function setVisible(next) {
    visible = next;
    if (next) start();
    else stop();
  }

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastPointerX = event.clientX;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add('is-dragging');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    lon -= (event.clientX - lastPointerX) * 0.009;
    lastPointerX = event.clientX;
    if (reduced) draw();
  });

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('is-dragging');
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  return {
    setEra,
    setVisible,
    setReduced(next) {
      reduced = next;
      if (next) stop();
      else if (visible) start();
      draw();
    }
  };
}

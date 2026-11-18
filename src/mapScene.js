import { ERAS } from './eras.js';

const W = 480;
const H = 300;
const TAU = Math.PI * 2;

const RIVER = [
  [412, -10],
  [402, 24],
  [414, 56],
  [398, 90],
  [410, 122],
  [394, 156],
  [406, 190],
  [390, 224],
  [400, 258],
  [384, 310]
];

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

function blockLine(g, points, color, width, grid = 3) {
  g.fillStyle = color;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / grid));
    for (let s = 0; s <= steps; s += 1) {
      const x = x1 + ((x2 - x1) * s) / steps;
      const y = y1 + ((y2 - y1) * s) / steps;
      g.fillRect(
        Math.round(x / grid) * grid - width / 2,
        Math.round(y / grid) * grid - width / 2,
        width,
        width
      );
    }
  }
}

function pixelEllipse(g, cx, cy, rx, ry, color, step = 10) {
  g.fillStyle = color;
  for (let y = -ry; y <= ry; y += step) {
    const half = rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2));
    for (let x = -half; x <= half; x += step) {
      g.fillRect(Math.round(cx + x), Math.round(cy + y), step, step);
    }
  }
}

function tree(g, x, y, pal, scale = 1) {
  const w = Math.round(10 * scale);
  const h = Math.round(14 * scale);
  g.fillStyle = pal.forest;
  g.fillRect(x - w / 2, y - h, w, h * 0.72);
  g.fillStyle = pal.forestLight;
  g.fillRect(x - w / 2 + 2, y - h + 2, w * 0.45, h * 0.3);
  g.fillStyle = pal.earthDark;
  g.fillRect(x - 1, y - h * 0.3, 3, h * 0.3);
}

function house(g, x, y, pal, w = 34, h = 22) {
  g.fillStyle = pal.wall;
  g.fillRect(x, y, w, h);
  g.fillStyle = pal.roof;
  g.fillRect(x - 4, y - 8, w + 8, 9);
  g.fillRect(x + 2, y - 12, w - 4, 5);
  g.fillStyle = 'rgba(60,40,24,0.55)';
  g.fillRect(x + w * 0.42, y + h * 0.4, 7, h * 0.6);
  g.fillStyle = 'rgba(255,235,190,0.55)';
  g.fillRect(x + 5, y + 6, 6, 6);
}

function drawPerson(g, x, y, pal, frame, facing = 1) {
  const bob = frame ? 1 : 0;
  const top = Math.round(y - 13 - bob);
  g.fillStyle = pal.earthDark;
  g.fillRect(x - 3, top + 9, 3, 4 + (frame ? 1 : 0));
  g.fillRect(x + 1, top + 9, 3, 3);
  g.fillStyle = pal.cloth;
  g.fillRect(x - 4, top + 4, 8, 6);
  g.fillStyle = pal.skin;
  g.fillRect(x - 2, top, 5, 5);
  g.fillStyle = pal.earthDark;
  g.fillRect(x - 2, top - 1, 5, 2);
  g.fillStyle = pal.skin;
  g.fillRect(facing > 0 ? x + 4 : x - 6, top + 5, 2, 4);
}

function flameShape(g, x, y, width, height, color, t, phase) {
  g.fillStyle = color;
  const rows = Math.max(3, Math.round(height / 3));
  for (let i = 0; i < rows; i += 1) {
    const k = i / rows;
    const rowWidth = Math.max(
      2,
      Math.round(width * (1 - k) * (0.82 + 0.18 * Math.sin(t * 7 + phase + k * 6)))
    );
    const jitter = Math.round(Math.sin(t * 9 + phase + i * 0.9) * 1.5);
    g.fillRect(Math.round(x - rowWidth / 2 + jitter), Math.round(y - height + i * 3), rowWidth, 3);
  }
}

function drawFire(g, x, y, t, pal) {
  const glow = g.createRadialGradient(x, y - 10, 2, x, y - 10, 58);
  glow.addColorStop(0, 'rgba(255,196,120,0.4)');
  glow.addColorStop(0.5, 'rgba(255,160,80,0.14)');
  glow.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(x, y - 10, 58, 0, TAU);
  g.fill();

  g.fillStyle = '#4a3325';
  g.fillRect(x - 13, y - 2, 28, 5);
  g.fillRect(x - 4, y - 7, 5, 14);

  flameShape(g, x, y - 2, 23, 33, pal.accent, t, 0.4);
  flameShape(g, x, y - 2, 14, 23, '#ffd27a', t, 1.9);
  flameShape(g, x, y - 2, 7, 13, '#fff1c0', t, 3.1);

  for (let i = 0; i < 4; i += 1) {
    const life = (t * 0.8 + i * 0.31) % 1;
    const alpha = 1 - life;
    g.globalAlpha = alpha * 0.8;
    g.fillStyle = i % 2 ? '#ffd27a' : pal.accent;
    g.fillRect(
      Math.round(x + Math.sin(t * 3 + i * 2) * 6),
      Math.round(y - 18 - life * 32),
      2,
      2
    );
  }
  g.globalAlpha = 1;
}

function drawCave(g, x, y, pal) {
  for (let row = 0; row < 6; row += 1) {
    g.fillStyle = row < 3 ? pal.rock : pal.rockDark;
    g.fillRect(x - 26 + row * 2, y + row * 5, 54 - row * 4, 5);
  }
  g.fillStyle = '#141a18';
  g.fillRect(x - 14, y + 18, 28, 24);
  pixelEllipse(g, x, y + 24, 15, 13, '#0d1210', 6);
  g.fillStyle = pal.rockDark;
  g.fillRect(x - 20, y + 40, 42, 4);
}

function drawToolRack(g, x, y, pal) {
  g.fillStyle = pal.wood || pal.earthDark;
  g.fillRect(x - 10, y - 12, 3, 24);
  g.fillRect(x + 8, y - 8, 3, 18);
  g.fillRect(x - 10, y - 10, 20, 3);
  g.fillStyle = pal.rockDark;
  g.fillRect(x - 4, y - 4, 7, 4);
  g.fillRect(x - 3, y - 2, 4, 6);
  g.fillStyle = pal.rock;
  g.fillRect(x - 3, y - 4, 4, 2);
  g.fillStyle = pal.earth;
  g.fillRect(x + 13, y + 8, 5, 4);
}

function buildStoneBase() {
  const pal = ERAS.stone.palette;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  g.fillStyle = pal.land;
  g.fillRect(0, 0, W, H);

  const rnd = mulberry32(11);
  for (let i = 0; i < 360; i += 1) {
    const x = Math.round((rnd() * W) / 8) * 8;
    const y = Math.round((rnd() * H) / 8) * 8;
    g.globalAlpha = 0.28 + rnd() * 0.25;
    g.fillStyle = rnd() < 0.5 ? pal.landDark : pal.landLight;
    g.fillRect(x, y, 8, 8);
  }
  g.globalAlpha = 1;

  blockLine(g, RIVER, pal.earthDark, 42);
  blockLine(g, RIVER, pal.waterDeep, 34);
  blockLine(g, RIVER, pal.water, 26);
  blockLine(
    g,
    RIVER.map(([x, y]) => [x - 4, y]),
    'rgba(220,245,255,0.18)',
    4
  );

  blockLine(
    g,
    [
      [36, 214],
      [120, 208],
      [210, 214],
      [296, 206],
      [330, 208]
    ],
    pal.path,
    13
  );

  const clusters = [
    [58, 62, 4],
    [96, 44, 3],
    [36, 108, 3],
    [86, 250, 3],
    [130, 262, 4],
    [160, 54, 2],
    [206, 46, 3],
    [350, 70, 2],
    [430, 210, 2],
    [20, 200, 2]
  ];
  clusters.forEach(([cx, cy, count]) => {
    for (let i = 0; i < count; i += 1) {
      tree(g, cx + Math.round((rnd() - 0.5) * 34), cy + Math.round((rnd() - 0.5) * 22), pal);
    }
  });

  for (let i = 0; i < 5; i += 1) {
    g.fillStyle = i % 2 ? pal.rockDark : pal.rock;
    g.fillRect(318 + i * 8, 42 + i * 4, 22, 8);
  }
  g.fillStyle = pal.rock;
  g.fillRect(336, 66, 14, 10);

  drawCave(g, 44, 148, pal);

  pixelEllipse(g, 266, 190, 92, 54, pal.earth, 10);
  pixelEllipse(g, 266, 194, 72, 40, pal.earthLight || '#b89a68', 10);

  drawToolRack(g, 248, 142, pal);

  // 篝火石圈
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * TAU;
    g.fillStyle = i % 2 ? pal.rockDark : pal.rock;
    g.fillRect(
      Math.round(300 + Math.cos(angle) * 17) - 2,
      Math.round(192 + Math.sin(angle) * 8) - 2,
      6,
      5
    );
  }

  g.fillStyle = 'rgba(30,40,24,0.5)';
  g.fillRect(64, 178, 3, 8);
  g.fillRect(70, 182, 3, 6);
  g.fillRect(52, 230, 3, 7);

  return canvas;
}

function buildTangBase() {
  const pal = ERAS.tang.palette;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  g.fillStyle = pal.land;
  g.fillRect(0, 0, W, H);

  const rnd = mulberry32(29);
  for (let i = 0; i < 300; i += 1) {
    const x = Math.round((rnd() * W) / 8) * 8;
    const y = Math.round((rnd() * H) / 8) * 8;
    g.globalAlpha = 0.22 + rnd() * 0.22;
    g.fillStyle = rnd() < 0.5 ? pal.landDark : pal.landLight;
    g.fillRect(x, y, 8, 8);
  }
  g.globalAlpha = 1;

  // 棋盘田块
  const tileW = 18;
  const tileH = 13;
  for (let row = 0; row < 13; row += 1) {
    for (let col = 0; col < 14; col += 1) {
      const x = 48 + col * tileW;
      const y = 88 + row * tileH;
      if (x > 336) continue;
      const keys = [pal.field1, pal.field2, pal.field3, pal.field4];
      const color = keys[(Math.floor(col / 2) + Math.floor(row / 3)) % keys.length];
      g.fillStyle = color;
      g.fillRect(x, y, tileW - 2, tileH - 2);
      g.fillStyle = 'rgba(60,68,38,0.35)';
      g.fillRect(x, y + tileH - 3, tileW - 2, 1);
      g.fillRect(x + tileW - 3, y, 1, tileH - 2);
      if ((col + row) % 4 === 0) {
        g.fillStyle = 'rgba(255,240,190,0.18)';
        g.fillRect(x + 3, y + 3, 5, 2);
      }
    }
  }

  blockLine(g, RIVER, pal.earthDark, 42);
  blockLine(g, RIVER, pal.waterDeep, 34);
  blockLine(g, RIVER, pal.water, 26);
  blockLine(
    g,
    RIVER.map(([x, y]) => [x - 4, y]),
    'rgba(220,245,255,0.2)',
    4
  );

  [112, 158, 204].forEach((y) => {
    blockLine(
      g,
      [
        [398, y - 4],
        [330, y],
        [250, y + 2],
        [160, y],
        [96, y + 2]
      ],
      pal.waterDeep,
      7
    );
    blockLine(
      g,
      [
        [398, y - 4],
        [330, y],
        [250, y + 2],
        [160, y],
        [96, y + 2]
      ],
      pal.water,
      4
    );
  });

  house(g, 64, 240, pal, 40, 24);
  house(g, 138, 52, pal, 34, 20);
  house(g, 236, 246, pal, 44, 26);
  house(g, 30, 96, pal, 30, 18);

  [
    [134, 244],
    [200, 78],
    [316, 240],
    [58, 208],
    [282, 62]
  ].forEach(([x, y]) => tree(g, x, y, pal, 0.9));

  // 水车支架
  g.fillStyle = pal.wood;
  g.fillRect(346, 176, 20, 7);
  g.fillRect(350, 140, 4, 38);
  g.fillRect(360, 146, 4, 32);

  // 水面碎石
  g.fillStyle = 'rgba(230,240,230,0.25)';
  g.fillRect(374, 196, 6, 2);
  g.fillRect(380, 208, 5, 2);

  return canvas;
}

function drawWaterwheel(g, x, y, radius, angle, pal) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.strokeStyle = pal.wood;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, radius, 0, TAU);
  g.stroke();
  g.lineWidth = 3;
  for (let i = 0; i < 8; i += 1) {
    g.rotate(Math.PI / 4);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -radius);
    g.stroke();
    g.fillStyle = pal.earthDark;
    g.fillRect(-3, -radius - 5, 6, 6);
  }
  g.restore();
  g.fillStyle = pal.earthDark;
  g.fillRect(x - 5, y - 5, 10, 10);
  g.fillStyle = '#d8c39a';
  g.fillRect(x - 2, y - 2, 4, 4);

  g.globalAlpha = 0.55;
  g.fillStyle = '#dff3ff';
  for (let i = 0; i < 4; i += 1) {
    const phase = (angle * 2 + i) % 4;
    g.fillRect(x + radius + 2 + i * 2, y + 8 + phase * 3, 2, 2);
  }
  g.globalAlpha = 1;
}

function drawFarmer(g, x, y, pal, t, phase) {
  const frame = Math.floor(t * 2 + phase) % 2;
  drawPerson(g, x, y, pal, frame, 1);
  const swing = Math.sin(t * 2.4 + phase);
  g.strokeStyle = pal.wood;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x + 5, y - 6);
  g.lineTo(x + 16 + swing * 3, y + 2 + swing * 8);
  g.stroke();
  g.fillStyle = pal.rockDark;
  g.fillRect(x + 14 + swing * 3, y + 1 + swing * 8, 5, 3);
}

export function createMapView(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const bases = new Map();

  let eraId = 'stone';
  let visible = false;
  let raf = 0;
  let lastFrame = 0;
  let startTime = performance.now();
  let reduced = Boolean(options.reduced);

  function baseFor(id) {
    if (!bases.has(id)) bases.set(id, id === 'tang' ? buildTangBase() : buildStoneBase());
    return bases.get(id);
  }

  function draw(t) {
    const base = baseFor(eraId);
    const pal = ERAS[eraId].palette;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0);

    if (eraId === 'tang') {
      drawWaterwheel(ctx, 356, 148, 22, reduced ? 0.7 : t * 0.55, pal);
      drawFarmer(ctx, 146, 196, pal, reduced ? 0.6 : t, 0);
      drawFarmer(ctx, 206, 212, pal, reduced ? 0.6 : t, 2.1);
      ctx.fillStyle = 'rgba(230,245,255,0.35)';
      ctx.fillRect(150, 160, 6, 2);
      ctx.fillRect(260, 160, 5, 2);
    } else {
      drawFire(ctx, 300, 190, reduced ? 0.8 : t, pal);
      const walk = reduced ? 0.35 : (t * 0.12) % 1;
      const x1 = 156 + walk * 138;
      const frame1 = reduced ? 0 : Math.floor(t * 6) % 2;
      drawPerson(ctx, x1, 219, pal, frame1, 1);

      const x2 = 92 + Math.sin(t * 0.6) * 12;
      const y2 = 152 + Math.cos(t * 0.9) * 6;
      drawPerson(ctx, x2, y2, pal, reduced ? 0 : Math.floor(t * 5 + 1) % 2, -1);

      ctx.fillStyle = 'rgba(255,220,170,0.5)';
      ctx.fillRect(292, 160, 2, 2);
      ctx.fillRect(309, 166, 2, 2);
    }
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    if (now - lastFrame < 33) {
      raf = requestAnimationFrame(frame);
      return;
    }
    lastFrame = now;
    draw((now - startTime) / 1000);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!visible || raf) return;
    if (reduced) {
      draw(0.8);
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
    canvas.setAttribute(
      'aria-label',
      id === 'tang'
        ? '盛唐田园像素地图：田垄、水渠、村落与转动的水车'
        : '石器聚落像素地图：森林、河流、洞穴与篝火'
    );
    if (visible) start();
    if (reduced) draw(0.8);
  }

  function setVisible(next) {
    visible = next;
    if (next) start();
    else stop();
  }

  return {
    setEra,
    setVisible,
    setReduced(next) {
      reduced = next;
      if (next) stop();
      else if (visible) start();
      if (reduced) draw(0.8);
    }
  };
}

import { ERAS } from './eras.js';
import { CHAR_CELL, CHAR_ANCHOR, CHAR_ACTIONS, POSE_ACTION, CHAR_MIRROR, CHAR_IMAGES, charReady } from './characters.js';
import stoneFar from './assets/scenes/stone/far.png';
import stoneMid from './assets/scenes/stone/mid.png';
import stoneNear from './assets/scenes/stone/near.png';
import tangFar from './assets/scenes/tang/far.png';
import tangMid from './assets/scenes/tang/mid.png';
import tangNear from './assets/scenes/tang/near.png';
import steamFar from './assets/scenes/steam/far.png';
import steamMid from './assets/scenes/steam/mid.png';
import steamNear from './assets/scenes/steam/near.png';

const LAYERS = {
  stone: [stoneFar, stoneMid, stoneNear],
  tang: [tangFar, tangMid, tangNear],
  steam: [steamFar, steamMid, steamNear]
};

export const SCENE_W = 1280;
export const SCENE_H = 720;

const PAL = {
  stone: {
    skyTop: '#33566e',
    skyMid: '#b08a68',
    skyWarm: '#f4c078',
    sun: '#ffd9a0',
    canopyFar: '#1d3a26',
    canopyMid: '#2a4c2e',
    canopyNear: '#3a6238',
    canopyLight: '#548043',
    trunk: '#3d2c1e',
    grass: '#6f9450',
    grassDark: '#54763d',
    grassLight: '#87a85e',
    dirt: '#b08d5e',
    dirtDark: '#8f6f47',
    rock: '#8b8b83',
    rockDark: '#66665f',
    rockLight: '#a8a89e',
    moss: '#5d8a4c',
    water: '#3f7fa6',
    waterDeep: '#2c5f7d',
    waterLight: '#7fb6d0',
    foam: '#d8eef5',
    thatch: '#a8823f',
    thatchDark: '#7d5f2c',
    thatchLight: '#c9a55c',
    hide: '#c9b18a',
    hideDark: '#a08a63',
    wood: '#6b4a2c',
    woodLight: '#8a6a44',
    bone: '#e8e0cc',
    fire: '#ff9f47',
    fireCore: '#ffe08a',
    smoke: '#c9c9c4',
    skin: '#c98d5e',
    skinDark: '#a06b42',
    hair: '#3a2a1e',
    cloth: '#8a6a44',
    clothDark: '#6b4f30',
    fur: '#c9b18a',
    berry: '#c8503a',
    flower: '#e8d06a',
    flowerPink: '#d88a9a',
    paint: '#a8503a'
  },
  tang: {
    skyTop: '#3a5a70',
    skyMid: '#c09a70',
    skyWarm: '#f6cc88',
    sun: '#ffe0a8',
    canopyFar: '#2c4a30',
    canopyMid: '#3c6238',
    canopyNear: '#4c7a42',
    canopyLight: '#69964e',
    trunk: '#4a3420',
    grass: '#8fae62',
    grassDark: '#6f8c48',
    grassLight: '#a8c478',
    dirt: '#c0a06a',
    dirtDark: '#9a7c4c',
    rock: '#9a968a',
    rockDark: '#757166',
    rockLight: '#b5b1a4',
    moss: '#6f9a54',
    water: '#4a8ab0',
    waterDeep: '#33688a',
    waterLight: '#8fc4dc',
    foam: '#e0f2f8',
    thatch: '#b08a44',
    thatchDark: '#8a6830',
    thatchLight: '#d0ac60',
    hide: '#d0b890',
    hideDark: '#a89068',
    wood: '#7a5432',
    woodLight: '#9a7448',
    bone: '#efe6d0',
    fire: '#ffab57',
    fireCore: '#ffe6a0',
    smoke: '#d0d0ca',
    skin: '#d09a68',
    skinDark: '#a87448',
    hair: '#2e2018',
    cloth: '#7a8ab0',
    clothDark: '#5a6a90',
    fur: '#d0b890',
    berry: '#d06048',
    flower: '#f0d878',
    flowerPink: '#e0a0b0',
    paint: '#b05840',
    paddy: '#6fa89a',
    paddyDeep: '#4f8478',
    paddyLight: '#9fc4b4',
    rice: '#7fb45a',
    riceGold: '#d0b850',
    roof: '#9b4534',
    roofDark: '#6a2d21',
    plaster: '#e2c99a',
    blossom: '#d898a0',
    blossomLight: '#e8b8bc'
  },
  steam: {
    skyTop: '#3a4a5c',
    skyMid: '#6a7480',
    skyWarm: '#8a97a4',
    glow: '#b0764a',
    skyline: '#55606c',
    mist: '#6a7480',
    brick: '#7a4a3a',
    brickDark: '#5a362c',
    brickLight: '#8a5a46',
    slate: '#4a545e',
    slateDark: '#363e46',
    slateLight: '#5a646e',
    iron: '#2e3238',
    ironDark: '#22262b',
    ironLight: '#4a5058',
    brass: '#b08a4a',
    brassLight: '#d0aa62',
    coal: '#2e2a26',
    coalDark: '#221e1a',
    cobble: '#7a7268',
    cobbleDark: '#6a6258',
    cobbleLight: '#8a8278',
    water: '#3f5a6e',
    waterDeep: '#2e4454',
    waterLight: '#8a97a4',
    foam: '#c4ccd2',
    wood: '#6a4a30',
    woodLight: '#8a6a44',
    smoke: '#8a8a86',
    steam: '#d8dcde',
    skin: '#d09a68',
    skinDark: '#a87448',
    hair: '#2e2018',
    cloth: '#5a6a7a',
    clothDark: '#46545f',
    lamp: '#e8c078',
    lampGlow: '#ffcf8f',
    rail: '#9aa4ac',
    ballast: '#4a4640'
  }
};

function rngFactory(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScene(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  ctx.imageSmoothingEnabled = false;

  let era = 'stone';
  let reduced = Boolean(options.reducedMotion);
  let active = false;
  let raf = 0;
  let last = 0;
  let t0 = performance.now();
  let now = 0;
  let base = null;
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let fit = 'immersive';
  const layerBase = new Map();
  const layerState = new Map();
  const procBase = new Map();

  const R = (g, x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const shadow = (g, x, y, rx, ry, a = 0.2) => {
    g.save();
    g.globalAlpha = a;
    g.fillStyle = '#141a10';
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  /* ---------------- people ---------------- */

  function person(g, x, y, o = {}) {
    const p = PAL[era];
    const s = o.scale || 3;
    const f = o.frame || 0;
    const skin = o.skin || p.skin;
    const cloth = o.cloth || p.cloth;
    const clothD = o.clothDark || p.clothDark;
    const hair = o.hair || p.hair;
    const flip = o.flip ? -1 : 1;
    shadow(g, x, y + 3 * s, 5 * s, 1.6 * s, 0.18);
    g.save();
    g.translate(Math.round(x), Math.round(y));
    g.scale(flip, 1);
    const px = (dx, dy, w, h, c) => R(g, dx * s, dy * s, w * s, h * s, c);
    const pose = o.pose || 'stand';

    const head = (hy) => {
      px(-3, hy, 6, 4, hair);
      px(-1, hy - 2, 3, 2, hair); // topknot
      px(-2, hy + 3, 5, 3, skin);
      px(1, hy + 4, 1, 1, '#241a12');
      px(-3, hy + 3, 1, 2, skin);
    };

    if (pose === 'sit' || pose === 'kneel') {
      head(-11);
      px(-3, -5, 7, 4, cloth);
      px(-3, -5, 7, 1, p.fur);
      px(-4, -1, 9, 2, clothD);
      px(-4, 1, 4, 2, skin);
      px(1, 1, 4, 2, skin);
      if (o.arm === 'up') {
        px(3, -7 + f, 2, 4, skin);
        px(4, -9 + f, 2, 2, o.tool || p.rock);
      } else if (o.arm === 'work') {
        px(3, -4 + f, 3, 2, skin);
        px(5, -3 + f, 2, 2, o.tool || p.rock);
      } else {
        px(3, -4, 2, 3, skin);
      }
      px(-4, -4, 2, 3, skin);
    } else if (pose === 'fish') {
      head(-12);
      px(-3, -6, 7, 5, cloth);
      px(-3, -6, 7, 1, p.fur);
      px(-4, -1, 4, 2, clothD);
      px(1, -1, 4, 2, clothD);
      px(3, -5, 3, 2, skin);
      g.strokeStyle = p.wood;
      g.lineWidth = s * 0.7;
      g.beginPath();
      g.moveTo(5 * s, -5 * s);
      g.lineTo(13 * s, -10 * s + f * s);
      g.stroke();
      g.strokeStyle = p.foam;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(13 * s, -10 * s + f * s);
      g.lineTo(13 * s, 2 * s);
      g.stroke();
    } else if (pose === 'pick') {
      head(-9);
      px(-3, -3, 7, 4, cloth);
      px(-3, -3, 7, 1, p.fur);
      px(-4, 1, 4, 2, clothD);
      px(1, 1, 4, 2, clothD);
      px(3, -2 + f, 3, 2, skin);
      px(-4, -1, 2, 3, skin);
    } else if (pose === 'hoe') {
      head(-13);
      px(-3, -7, 7, 6, cloth);
      px(-3, -7, 7, 1, p.fur);
      px(-3, -1, 3, 3, clothD);
      px(1, -1, 3, 3, clothD);
      const ay = f ? -3 : -6;
      px(3, ay, 3, 2, skin);
      g.strokeStyle = p.wood;
      g.lineWidth = s * 0.8;
      g.beginPath();
      g.moveTo(5 * s, ay * s);
      g.lineTo(9 * s, (ay + 6) * s);
      g.stroke();
      R(g, 8 * s, (ay + 6) * s, 3 * s, 1.5 * s, p.rockDark);
    } else if (pose === 'weave') {
      head(-11);
      px(-3, -5, 7, 5, cloth);
      px(-4, 0, 9, 2, clothD);
      px(3, -4 + f, 3, 2, skin);
      px(-4, -4 + (1 - f), 3, 2, skin);
    } else {
      const legA = f ? 1 : 0;
      head(-14);
      px(-3, -8, 7, 6, cloth);
      px(-3, -8, 7, 1, p.fur);
      px(-3, -3, 7, 1, clothD);
      px(-3, -2, 3, 3 + legA, clothD);
      px(1, -2, 3, 3 + (1 - legA), clothD);
      px(-3, 1 + legA, 3, 1, p.skinDark);
      px(1, 1 + (1 - legA), 3, 1, p.skinDark);
      if (o.carry === 'wood') {
        R(g, -9 * s, -13 * s, 5 * s, 9 * s, p.wood);
        R(g, -9 * s, -13 * s, 5 * s, 2 * s, p.woodLight);
        R(g, -8 * s, -10 * s, 3 * s, 1 * s, p.woodLight);
        R(g, -8 * s, -7 * s, 3 * s, 1 * s, p.woodLight);
        px(-4, -7, 2, 4, skin);
      } else if (o.carry === 'basket') {
        px(3, -6, 2, 4, skin);
        R(g, 4 * s, -3 * s, 5 * s, 4 * s, p.thatch);
        R(g, 4 * s, -3 * s, 5 * s, 1 * s, p.thatchDark);
        R(g, 5 * s, -4 * s, 3 * s, 1 * s, p.berry);
      } else {
        px(-4, -7 + legA, 2, 4, skin);
        px(3, -7 + (1 - legA), 2, 4, skin);
      }
      if (o.carry === 'bundle') {
        R(g, -8 * s, -11 * s, 4 * s, 7 * s, p.thatchDark);
        R(g, -8 * s, -11 * s, 4 * s, 1 * s, p.thatch);
      }
    }
    g.restore();
  }

  function drawChar(g, x, y, o = {}) {
    if (!charReady(era)) return person(g, x, y, o);
    const p = PAL[era];
    const s = o.scale || 3;
    const ds = s / 3;
    const pose = o.pose || 'stand';
    const act = CHAR_ACTIONS[POSE_ACTION[pose] || 'idle'];
    const phase = (o.frame || 0) * (act.frames > 2 ? 2 : 1);
    const fi = act.frames === 1 ? 0 : (Math.floor(now * act.fps) + phase) % act.frames;
    const f = o.frame || 0;
    const bob = pose === 'pick' ? f : 0;
    shadow(g, x, y + 2 * ds, 7 * ds, 2 * ds, 0.18);
    g.save();
    g.translate(Math.round(x), Math.round(y + bob));
    g.scale(o.flip && CHAR_MIRROR[era] ? -1 : 1, 1);
    g.imageSmoothingEnabled = false;
    g.drawImage(
      CHAR_IMAGES[era],
      fi * CHAR_CELL.w, act.row * CHAR_CELL.h, CHAR_CELL.w, CHAR_CELL.h,
      -Math.round(CHAR_ANCHOR.x * ds), -Math.round(CHAR_ANCHOR.y * ds),
      Math.round(CHAR_CELL.w * ds), Math.round(CHAR_CELL.h * ds)
    );
    if (o.carry === 'wood') {
      R(g, -19 * ds, -28 * ds, 8 * ds, 11 * ds, p.wood);
      R(g, -19 * ds, -28 * ds, 8 * ds, 2 * ds, p.woodLight);
      R(g, -18 * ds, -24 * ds, 5 * ds, 1 * ds, p.woodLight);
      R(g, -18 * ds, -21 * ds, 5 * ds, 1 * ds, p.woodLight);
    } else if (o.carry === 'basket') {
      R(g, 7 * ds, -17 * ds, 7 * ds, 6 * ds, p.thatch);
      R(g, 7 * ds, -17 * ds, 7 * ds, 1 * ds, p.thatchDark);
      R(g, 9 * ds, -18 * ds, 3 * ds, 1 * ds, p.berry);
    }
    if (o.carry === 'bundle') {
      R(g, -20 * ds, -34 * ds, 6 * ds, 10 * ds, p.thatchDark);
      R(g, -20 * ds, -34 * ds, 6 * ds, 1 * ds, p.thatch);
      R(g, -14 * ds, -32 * ds, 4 * ds, 1 * ds, p.thatchDark);
    }
    if (pose === 'pick') {
      R(g, 7 * ds, -17 * ds, 7 * ds, 6 * ds, p.thatch);
      R(g, 7 * ds, -17 * ds, 7 * ds, 1 * ds, p.thatchDark);
      R(g, 9 * ds, -18 * ds, 3 * ds, 1 * ds, p.berry);
    }
    if (pose === 'fish') {
      g.strokeStyle = p.wood;
      g.lineWidth = s * 0.7;
      g.beginPath();
      g.moveTo(10 * ds, -18 * ds);
      g.lineTo(22 * ds, -30 * ds + f * ds);
      g.stroke();
      g.strokeStyle = p.foam;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(22 * ds, -30 * ds + f * ds);
      g.lineTo(22 * ds, 2 * ds);
      g.stroke();
    }
    g.restore();
  }

  function deer(g, x, y, f) {
    const p = PAL[era];
    const s = 3;
    shadow(g, x, y + 2, 20, 5, 0.16);
    g.save();
    g.translate(x, y);
    const px = (dx, dy, w, h, c) => R(g, dx * s, dy * s, w * s, h * s, c);
    px(-6, -8, 12, 5, '#a87848');
    px(-6, -3, 2, 4, '#8a5f36');
    px(-2, -3, 2, 4, '#8a5f36');
    px(2, -3, 2, 4, '#8a5f36');
    px(5, -3, 2, 4, '#8a5f36');
    px(6, -12 + f, 3, 5, '#a87848');
    px(7, -14 + f, 4, 3, '#b5855a');
    px(10, -13 + f, 1, 1, '#3a2a1e');
    g.strokeStyle = '#8a5f36';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(8 * s, (-14 + f) * s);
    g.lineTo(7 * s, (-18 + f) * s);
    g.moveTo(7 * s, (-16 + f) * s);
    g.lineTo(5 * s, (-18 + f) * s);
    g.moveTo(9 * s, (-14 + f) * s);
    g.lineTo(10 * s, (-18 + f) * s);
    g.stroke();
    px(-3, -7, 2, 2, '#e8d8c0');
    px(1, -6, 2, 2, '#e8d8c0');
    g.restore();
  }

  function bird(g, x, y, f, color = '#5a8ac0') {
    const s = 2;
    R(g, x, y, 4 * s, 2 * s, color);
    R(g, x + 3 * s, y - s, 2 * s, 2 * s, color);
    R(g, x + 5 * s, y - s, s, s, '#e8a04a');
    if (f) R(g, x + s, y - 2 * s, 2 * s, s, color);
    else R(g, x + s, y + 2 * s, 2 * s, s, color);
    R(g, x - s, y + s, s, s, color);
  }

  /* ---------------- scenery ---------------- */

  function blob(g, cx, cy, rx, ry, color) {
    g.fillStyle = color;
    for (let dy = -ry; dy <= ry; dy += 4) {
      const hw = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2));
      g.fillRect(Math.round(cx - hw), Math.round(cy + dy), Math.round(hw * 2), 4);
    }
  }

  function canopy(g, p) {
    const sky = g.createLinearGradient(0, 0, SCENE_W, 260);
    sky.addColorStop(0, p.skyTop);
    sky.addColorStop(0.62, p.skyMid);
    sky.addColorStop(1, p.skyWarm);
    g.fillStyle = sky;
    g.fillRect(0, 0, SCENE_W, 330);
    const sun = g.createRadialGradient(1170, 70, 8, 1170, 70, 280);
    sun.addColorStop(0, 'rgba(255,228,168,0.95)');
    sun.addColorStop(0.5, 'rgba(255,200,130,0.4)');
    sun.addColorStop(1, 'rgba(255,228,168,0)');
    g.fillStyle = sun;
    g.fillRect(860, 0, 420, 340);

    // dark understory mass with a diagonal sky wedge at the right
    g.fillStyle = p.canopyFar;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(940, 0);
    g.lineTo(1280, 190);
    g.lineTo(1280, 330);
    g.lineTo(0, 330);
    g.closePath();
    g.fill();

    const layer = (top, depth, color, color2, count, seed) => {
      const r = rngFactory(seed);
      for (let i = 0; i < count; i += 1) {
        const x = (i / (count - 1)) * (SCENE_W + 120) - 60;
        const cut = Math.max(0, x - 940) * 0.55;
        const yTop = top + cut;
        const h = depth * (0.7 + r() * 0.55);
        const w = 100 + r() * 70;
        const cx = x + w / 2;
        R(g, cx - 5, yTop + h * 0.4, 10, h * 0.8, p.trunk);
        blob(g, cx, yTop + h * 0.42, w / 2, h * 0.42, color);
        blob(g, cx - w * 0.16, yTop + h * 0.2, w * 0.3, h * 0.26, color2);
        blob(g, cx + w * 0.2, yTop + h * 0.3, w * 0.24, h * 0.2, color2);
        g.save();
        g.globalAlpha = 0.5;
        blob(g, cx - w * 0.18, yTop + h * 0.16, w * 0.16, h * 0.12, p.canopyLight);
        g.restore();
      }
    };
    layer(-30, 190, p.canopyFar, p.canopyMid, 16, 11);
    layer(30, 210, p.canopyMid, p.canopyNear, 14, 23);
    layer(90, 230, p.canopyNear, p.canopyLight, 12, 37);

    // understory blend + fringe
    const r2 = rngFactory(51);
    for (let i = 0; i < 40; i += 1) {
      const x = i * 34 - 10;
      const cut = Math.max(0, x - 940) * 0.55;
      R(g, x, 244 + cut * 0.4, 40, 60, p.canopyFar);
      blob(g, x + 20, 240 + cut * 0.4, 22, 16, p.canopyMid);
    }
    for (let i = 0; i < 60; i += 1) {
      const x = i * 22 + r2() * 10;
      const cut = Math.max(0, x - 940) * 0.55;
      R(g, x, 292 + cut * 0.4, 12, 10 + r2() * 16, p.canopyNear);
    }
    g.save();
    g.globalAlpha = 0.12;
    g.fillStyle = p.sun;
    for (let i = 0; i < 5; i += 1) {
      g.beginPath();
      g.moveTo(1080 + i * 36, 0);
      g.lineTo(1140 + i * 36, 0);
      g.lineTo(760 + i * 60, 430);
      g.lineTo(700 + i * 60, 430);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function ground(g, p, rnd) {
    const gg = g.createLinearGradient(0, 260, 0, SCENE_H);
    gg.addColorStop(0, p.grassLight);
    gg.addColorStop(0.45, p.grass);
    gg.addColorStop(1, p.grassDark);
    g.fillStyle = gg;
    g.fillRect(0, 260, SCENE_W, SCENE_H - 260);
    for (let i = 0; i < 340; i += 1) {
      const x = rnd() * SCENE_W;
      const y = 280 + rnd() * (SCENE_H - 300);
      const c = rnd() < 0.4 ? p.grassDark : rnd() < 0.7 ? p.grassLight : p.grass;
      R(g, x, y, 12 + rnd() * 26, 5 + rnd() * 8, c);
    }
    g.fillStyle = p.dirt;
    g.beginPath();
    g.moveTo(180, 330);
    g.bezierCurveTo(420, 360, 520, 430, 640, 470);
    g.bezierCurveTo(780, 510, 900, 470, 1060, 430);
    g.lineTo(1080, 470);
    g.bezierCurveTo(900, 520, 780, 560, 620, 520);
    g.bezierCurveTo(480, 480, 380, 400, 160, 370);
    g.closePath();
    g.fill();
    g.save();
    g.globalAlpha = 0.5;
    for (let i = 0; i < 70; i += 1) {
      const t = rnd();
      const x = 200 + t * 840;
      const y = 350 + Math.sin(t * 5) * 60 + rnd() * 60;
      R(g, x, y, 8 + rnd() * 14, 4, p.dirtDark);
    }
    g.restore();
  }

  function rock(g, p, x, y, w, h, moss = true, tone = null) {
    const base = tone ? tone.base : p.rock;
    const light = tone ? tone.light : p.rockLight;
    const dark = tone ? tone.dark : p.rockDark;
    shadow(g, x + w / 2, y + h, w * 0.55, h * 0.2, 0.16);
    R(g, x, y + h * 0.3, w, h * 0.7, base);
    R(g, x + w * 0.12, y, w * 0.76, h * 0.5, light);
    R(g, x + w * 0.2, y + h * 0.55, w * 0.6, h * 0.4, dark);
    R(g, x + w * 0.05, y + h * 0.4, w * 0.2, h * 0.3, dark);
    if (moss) {
      R(g, x + w * 0.1, y + h * 0.16, w * 0.34, h * 0.16, p.moss);
      R(g, x + w * 0.55, y + h * 0.36, w * 0.28, h * 0.14, p.moss);
      R(g, x + w * 0.3, y + h * 0.7, w * 0.2, h * 0.12, p.moss);
    }
  }

  function cave(g, p) {
    const tone = { base: '#7a766c', light: '#948f83', dark: '#5b574e' };
    shadow(g, 180, 340, 150, 26, 0.2);
    rock(g, p, 40, 150, 280, 190, true, tone);
    rock(g, p, 20, 220, 120, 120, true, tone);
    rock(g, p, 240, 200, 110, 140, true, tone);
    R(g, 130, 210, 120, 120, '#241a14');
    R(g, 140, 200, 100, 20, '#241a14');
    R(g, 150, 320, 80, 12, '#3a2a1e');
    g.strokeStyle = p.paint;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(160, 250);
    g.lineTo(175, 240);
    g.lineTo(190, 250);
    g.lineTo(185, 265);
    g.lineTo(165, 265);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(170, 240);
    g.lineTo(166, 228);
    g.moveTo(182, 240);
    g.lineTo(188, 228);
    g.stroke();
    g.beginPath();
    g.moveTo(210, 240);
    g.lineTo(210, 262);
    g.moveTo(210, 246);
    g.lineTo(222, 252);
    g.moveTo(210, 262);
    g.lineTo(202, 274);
    g.moveTo(210, 262);
    g.lineTo(218, 274);
    g.stroke();
    R(g, 120, 330, 140, 10, p.dirtDark);
  }

  function bigHut(g, p) {
    const x = 700;
    const y = 250;
    shadow(g, x + 110, y + 168, 120, 24, 0.22);
    R(g, x + 30, y + 80, 160, 82, p.hideDark);
    R(g, x + 30, y + 80, 160, 10, p.hide);
    for (let i = 0; i < 9; i += 1) {
      const t = i / 8;
      const w = 204 * (1 - t * 0.82);
      const by = y + 84 - i * 11;
      R(g, x + 110 - w / 2, by - 11, w, 14, i % 2 ? p.thatch : p.thatchDark);
    }
    R(g, x + 92, y - 16, 36, 12, p.thatchLight);
    g.strokeStyle = p.thatchLight;
    g.lineWidth = 2;
    for (let i = 0; i < 16; i += 1) {
      const sx = x + 26 + i * 11;
      g.beginPath();
      g.moveTo(sx, y + 30 + (i % 3) * 12);
      g.lineTo(sx + 5, y + 52 + (i % 3) * 12);
      g.stroke();
    }
    R(g, x + 88, y + 100, 44, 62, '#241a14');
    R(g, x + 84, y + 96, 52, 8, p.thatchDark);
    g.strokeStyle = p.bone;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(x + 78, y + 162);
    g.quadraticCurveTo(x + 62, y + 112, x + 82, y + 86);
    g.moveTo(x + 142, y + 162);
    g.quadraticCurveTo(x + 158, y + 112, x + 138, y + 86);
    g.stroke();
    R(g, x + 20, y + 160, 180, 10, p.dirtDark);
  }

  function tent(g, p, x, y, w = 110, h = 90) {
    shadow(g, x + w / 2, y + h, w * 0.55, 12, 0.18);
    g.fillStyle = p.hide;
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x + w / 2, y);
    g.lineTo(x + w, y + h);
    g.closePath();
    g.fill();
    g.fillStyle = p.hideDark;
    g.beginPath();
    g.moveTo(x + w / 2, y);
    g.lineTo(x + w, y + h);
    g.lineTo(x + w * 0.62, y + h);
    g.closePath();
    g.fill();
    R(g, x + w * 0.4, y + h * 0.5, w * 0.2, h * 0.5, '#3a2a1e');
    g.strokeStyle = p.wood;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x + w / 2 - 14, y - 12);
    g.lineTo(x + w / 2 + 10, y + 8);
    g.moveTo(x + w / 2 + 14, y - 12);
    g.lineTo(x + w / 2 - 10, y + 8);
    g.stroke();
    for (let i = 0; i < 5; i += 1) R(g, x + 12 + i * 18, y + h - 14, 8, 6, p.hideDark);
  }

  function rackShelter(g, p, x, y) {
    shadow(g, x + 70, y + 82, 80, 12, 0.16);
    g.strokeStyle = p.wood;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x, y + 80);
    g.lineTo(x + 30, y);
    g.lineTo(x + 110, y);
    g.lineTo(x + 140, y + 80);
    g.stroke();
    g.fillStyle = p.hide;
    g.beginPath();
    g.moveTo(x + 20, y + 6);
    g.lineTo(x + 120, y + 6);
    g.lineTo(x + 132, y + 40);
    g.lineTo(x + 8, y + 40);
    g.closePath();
    g.fill();
    R(g, x + 30, y + 44, 80, 8, p.woodLight);
    R(g, x + 36, y + 52, 12, 26, p.hideDark);
    R(g, x + 60, y + 52, 12, 26, p.hide);
    R(g, x + 84, y + 52, 12, 26, p.hideDark);
  }

  function dryingRack(g, p, x, y) {
    shadow(g, x + 50, y + 72, 60, 10, 0.16);
    g.strokeStyle = p.wood;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, y + 70);
    g.lineTo(x + 16, y);
    g.moveTo(x + 100, y + 70);
    g.lineTo(x + 84, y);
    g.moveTo(x + 10, y + 8);
    g.lineTo(x + 90, y + 8);
    g.stroke();
    g.fillStyle = p.hide;
    g.beginPath();
    g.moveTo(x + 24, y + 10);
    g.lineTo(x + 76, y + 10);
    g.lineTo(x + 70, y + 56);
    g.lineTo(x + 30, y + 56);
    g.closePath();
    g.fill();
    R(g, x + 34, y + 20, 30, 6, p.hideDark);
    R(g, x + 38, y + 34, 24, 6, p.hideDark);
  }

  function toolRack(g, p, x, y) {
    shadow(g, x + 45, y + 62, 55, 10, 0.16);
    g.strokeStyle = p.wood;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, y + 60);
    g.lineTo(x + 12, y);
    g.moveTo(x + 90, y + 60);
    g.lineTo(x + 78, y);
    g.moveTo(x + 8, y + 6);
    g.lineTo(x + 82, y + 6);
    g.stroke();
    for (let i = 0; i < 5; i += 1) {
      const bx = x + 16 + i * 14;
      g.strokeStyle = p.hideDark;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(bx, y + 8);
      g.lineTo(bx, y + 20);
      g.stroke();
      g.fillStyle = i % 2 ? p.rock : p.rockLight;
      g.beginPath();
      g.moveTo(bx - 5, y + 20);
      g.lineTo(bx + 5, y + 20);
      g.lineTo(bx, y + 36);
      g.closePath();
      g.fill();
    }
    rock(g, p, x - 10, y + 52, 40, 22, false);
    rock(g, p, x + 60, y + 54, 44, 20, false);
  }

  function bankX(y) {
    return 1120 - Math.sin(y * 0.012) * 26 - (y - 270) * 0.1;
  }

  function river(g, p, rnd) {
    g.fillStyle = p.waterDeep;
    g.beginPath();
    g.moveTo(bankX(270), 270);
    g.bezierCurveTo(1080, 400, 1120, 520, 1060, 720);
    g.lineTo(1280, 720);
    g.lineTo(1280, 270);
    g.closePath();
    g.fill();
    g.fillStyle = p.water;
    g.beginPath();
    g.moveTo(bankX(270) + 16, 270);
    g.bezierCurveTo(1100, 400, 1140, 520, 1085, 720);
    g.lineTo(1280, 720);
    g.lineTo(1280, 270);
    g.closePath();
    g.fill();
    // rocky bank
    for (let i = 0; i < 26; i += 1) {
      const y = 268 + i * 18;
      const x = bankX(y);
      R(g, x - 26, y, 34, 16, i % 2 ? p.rock : p.rockDark);
      R(g, x - 22, y - 4, 24, 6, p.rockLight);
      if (i % 3 === 0) R(g, x - 18, y - 6, 14, 4, p.moss);
    }
    // foam edge
    g.save();
    g.globalAlpha = 0.55;
    g.strokeStyle = p.foam;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(bankX(270) + 8, 272);
    g.bezierCurveTo(1092, 400, 1132, 520, 1076, 718);
    g.stroke();
    g.restore();
    // stepping stones
    for (let i = 0; i < 6; i += 1) {
      const x = 1140 + i * 22;
      const y = 470 + i * 34;
      shadow(g, x + 16, y + 12, 20, 6, 0.2);
      R(g, x, y, 34, 14, p.rockLight);
      R(g, x + 3, y + 10, 28, 6, p.rockDark);
      R(g, x + 4, y - 3, 16, 4, p.moss);
      g.save();
      g.globalAlpha = 0.5;
      g.strokeStyle = p.foam;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x + 17, y + 14, 22, 6, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    // reeds
    for (let i = 0; i < 18; i += 1) {
      const y = 340 + rnd() * 360;
      const x = bankX(y) - 10 - rnd() * 26;
      g.strokeStyle = p.grassDark;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 4, y - 26);
      g.moveTo(x + 6, y);
      g.lineTo(x + 9, y - 20);
      g.stroke();
      R(g, x + 1, y - 32, 6, 10, p.thatch);
    }
    // waterfall head
    rock(g, p, 1120, 240, 90, 34, true);
    R(g, 1146, 268, 44, 56, p.waterLight);
    for (let i = 0; i < 5; i += 1) R(g, 1149 + i * 8, 268, 4, 56, p.foam);
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = p.foam;
    g.beginPath();
    g.ellipse(1168, 328, 30, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function bushes(g, p, rnd) {
    for (let b = 0; b < 3; b += 1) {
      const x = 110 + b * 70;
      const y = 580 + (b % 2) * 30;
      shadow(g, x + 34, y + 44, 44, 10, 0.16);
      for (let i = 0; i < 9; i += 1) {
        R(g, x + rnd() * 60, y + rnd() * 40, 16, 12, i % 2 ? p.canopyNear : p.canopyMid);
      }
      for (let i = 0; i < 12; i += 1) R(g, x + 6 + rnd() * 54, y + 4 + rnd() * 34, 5, 5, p.berry);
    }
  }

  function flowers(g, p, rnd) {
    for (let i = 0; i < 90; i += 1) {
      const x = rnd() * SCENE_W;
      const y = 300 + rnd() * 380;
      if (x > 1040) continue;
      g.strokeStyle = p.grassDark;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - 8);
      g.stroke();
      R(g, x - 2, y - 12, 5, 5, rnd() < 0.5 ? p.flower : p.flowerPink);
    }
    for (let i = 0; i < 130; i += 1) {
      const x = rnd() * SCENE_W;
      const y = 640 + rnd() * 70;
      g.strokeStyle = i % 2 ? p.grassDark : p.canopyNear;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y + 14);
      g.lineTo(x + 3, y);
      g.moveTo(x + 6, y + 14);
      g.lineTo(x + 8, y + 2);
      g.moveTo(x + 11, y + 14);
      g.lineTo(x + 13, y + 4);
      g.stroke();
    }
  }

  function firePit(g, p, x, y) {
    shadow(g, x, y + 6, 40, 10, 0.2);
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      R(g, x + Math.cos(a) * 30 - 6, y + Math.sin(a) * 14 - 4, 13, 9, i % 2 ? p.rock : p.rockDark);
    }
    R(g, x - 18, y - 4, 36, 7, p.wood);
    R(g, x - 12, y - 8, 24, 6, p.woodLight);
  }

  function spit(g, p, x, y) {
    shadow(g, x, y + 32, 34, 8, 0.18);
    g.strokeStyle = p.wood;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x - 26, y + 30);
    g.lineTo(x - 16, y - 16);
    g.moveTo(x + 26, y + 30);
    g.lineTo(x + 16, y - 16);
    g.moveTo(x - 20, y - 12);
    g.lineTo(x + 20, y - 12);
    g.stroke();
    firePit(g, p, x, y + 26);
  }

  function sunset(g, p) {
    const glow = g.createRadialGradient(1160, 90, 20, 1160, 90, 620);
    glow.addColorStop(0, 'rgba(255,206,130,0.22)');
    glow.addColorStop(0.5, 'rgba(255,190,120,0.08)');
    glow.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, SCENE_W, SCENE_H);
  }

  function buildStoneBase() {
    const p = PAL.stone;
    const c = document.createElement('canvas');
    c.width = SCENE_W;
    c.height = SCENE_H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rnd = rngFactory(7);
    canopy(g, p);
    ground(g, p, rnd);
    river(g, p, rnd);
    cave(g, p);
    bigHut(g, p);
    tent(g, p, 220, 350);
    rackShelter(g, p, 990, 300);
    dryingRack(g, p, 330, 420);
    toolRack(g, p, 430, 510);
    firePit(g, p, 620, 480);
    spit(g, p, 810, 460);
    bushes(g, p, rnd);
    rock(g, p, 560, 600, 150, 90);
    rock(g, p, 700, 640, 110, 70);
    rock(g, p, 940, 560, 90, 60);
    flowers(g, p, rnd);
    R(g, 560, 470, 40, 12, p.wood);
    R(g, 660, 476, 40, 12, p.wood);
    R(g, 450, 560, 34, 12, p.rockDark);
    R(g, 500, 566, 34, 12, p.rockDark);
    sunset(g, p);
    return c;
  }

  /* ---------------- tang scenery ---------------- */

  function paddy(g, p, x, y, w, h, gold = false) {
    shadow(g, x + w / 2, y + h, w * 0.5, 8, 0.12);
    R(g, x - 5, y - 5, w + 10, h + 10, p.dirt);
    R(g, x, y, w, h, p.paddyDeep);
    R(g, x + 3, y + 3, w - 6, h - 6, p.paddy);
    g.save();
    g.globalAlpha = 0.4;
    R(g, x + 6, y + 5, w - 12, 5, p.paddyLight);
    g.restore();
    for (let ry = y + 12; ry < y + h - 6; ry += 16) {
      for (let rx = x + 9; rx < x + w - 8; rx += 19) {
        const c = gold ? p.riceGold : p.rice;
        g.strokeStyle = c;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(rx, ry + 6);
        g.lineTo(rx - 3, ry);
        g.moveTo(rx + 3, ry + 6);
        g.lineTo(rx + 3, ry - 2);
        g.moveTo(rx + 6, ry + 6);
        g.lineTo(rx + 9, ry + 1);
        g.stroke();
      }
    }
  }

  function tangHouse(g, p, x, y, w = 150) {
    shadow(g, x + w / 2, y + 92, w * 0.6, 12, 0.2);
    R(g, x, y + 40, w, 50, p.plaster);
    R(g, x, y + 86, w, 8, p.rockDark);
    for (let i = 0; i < 4; i += 1) R(g, x + 8 + i * (w / 4), y + 44, 6, 44, p.wood);
    R(g, x + w / 2 - 14, y + 56, 28, 34, '#4a3420');
    R(g, x + 16, y + 56, 20, 18, '#ffdca0');
    R(g, x + w - 36, y + 56, 20, 18, '#ffdca0');
    g.fillStyle = p.roof;
    g.beginPath();
    g.moveTo(x - 16, y + 46);
    g.quadraticCurveTo(x + w / 2, y - 16, x + w + 16, y + 46);
    g.closePath();
    g.fill();
    g.fillStyle = p.roofDark;
    R(g, x - 16, y + 42, w + 32, 5, p.roofDark);
    R(g, x + w / 2 - 18, y + 10, 36, 6, p.roofDark);
    g.strokeStyle = p.roofDark;
    g.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const sx = x + 8 + i * (w / 8);
      g.beginPath();
      g.moveTo(sx, y + 40);
      g.lineTo(sx + 4, y + 24);
      g.stroke();
    }
    // upturned eaves
    g.fillStyle = p.roofDark;
    g.beginPath();
    g.moveTo(x - 16, y + 46);
    g.quadraticCurveTo(x - 22, y + 36, x - 12, y + 30);
    g.lineTo(x - 8, y + 38);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(x + w + 16, y + 46);
    g.quadraticCurveTo(x + w + 22, y + 36, x + w + 12, y + 30);
    g.lineTo(x + w + 8, y + 38);
    g.closePath();
    g.fill();
  }

  function pagodaBg(g, p, x, y) {
    shadow(g, x, y + 4, 46, 8, 0.16);
    let ty = y;
    for (let t = 0; t < 3; t += 1) {
      const w = 74 - t * 18;
      R(g, x - w / 2 + 8, ty - 22, w - 16, 22, p.plaster);
      R(g, x - 4, ty - 16, 8, 12, '#4a3420');
      g.fillStyle = p.roof;
      g.beginPath();
      g.moveTo(x - w / 2 - 8, ty - 20);
      g.quadraticCurveTo(x, ty - 44, x + w / 2 + 8, ty - 20);
      g.closePath();
      g.fill();
      R(g, x - w / 2 - 8, ty - 22, w + 16, 4, p.roofDark);
      ty -= 30;
    }
    R(g, x - 2, ty - 14, 4, 16, p.roofDark);
  }

  function willow(g, p, x, y) {
    shadow(g, x + 10, y + 122, 40, 10, 0.16);
    g.strokeStyle = p.trunk;
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(x, y + 120);
    g.quadraticCurveTo(x + 10, y + 50, x + 26, y);
    g.stroke();
    R(g, x - 14, y - 16, 76, 26, p.canopyNear);
    R(g, x - 6, y - 24, 56, 16, p.canopyLight);
    for (let i = 0; i < 16; i += 1) {
      const sx = x + 26 + (i - 8) * 8;
      const len = 70 + (i % 4) * 24;
      g.strokeStyle = i % 2 ? p.canopyNear : p.canopyLight;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(sx, y + 6);
      g.quadraticCurveTo(sx + 6, y + len * 0.6, sx + 2, y + len);
      g.stroke();
      for (let l = 0; l < 5; l += 1) {
        R(g, sx + 2 + (l % 2) * 3, y + 14 + l * (len / 5), 4, 6, i % 2 ? p.canopyLight : p.canopyNear);
      }
    }
  }

  function blossomTree(g, p, x, y) {
    shadow(g, x + 6, y + 72, 30, 8, 0.16);
    g.strokeStyle = p.trunk;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(x, y + 70);
    g.lineTo(x + 6, y + 20);
    g.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      R(g, x + 6 + Math.cos(a) * 26 - 13, y + 12 + Math.sin(a) * 16 - 11, 27, 21, i % 2 ? p.blossom : p.blossomLight);
    }
    R(g, x - 4, y - 6, 22, 14, p.blossomLight);
  }

  function loomShed(g, p, x, y) {
    shadow(g, x + 60, y + 82, 70, 10, 0.16);
    g.strokeStyle = p.wood;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x, y + 80);
    g.lineTo(x + 14, y);
    g.moveTo(x + 120, y + 80);
    g.lineTo(x + 106, y);
    g.stroke();
    g.fillStyle = p.thatch;
    g.beginPath();
    g.moveTo(x - 8, y + 6);
    g.lineTo(x + 128, y + 6);
    g.lineTo(x + 116, y - 14);
    g.lineTo(x + 4, y - 14);
    g.closePath();
    g.fill();
    R(g, x + 24, y + 30, 70, 6, p.wood);
    R(g, x + 28, y + 36, 62, 26, p.hide);
    for (let i = 0; i < 8; i += 1) R(g, x + 30 + i * 8, y + 36, 3, 26, p.cloth);
    R(g, x + 24, y + 62, 70, 6, p.wood);
  }

  function buildTangBase() {
    const p = PAL.tang;
    const c = document.createElement('canvas');
    c.width = SCENE_W;
    c.height = SCENE_H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rnd = rngFactory(19);
    canopy(g, p);
    pagodaBg(g, p, 1080, 230);
    ground(g, p, rnd);
    paddy(g, p, 90, 330, 240, 80);
    paddy(g, p, 120, 420, 260, 84, true);
    paddy(g, p, 160, 514, 280, 88);
    paddy(g, p, 400, 360, 240, 78, true);
    paddy(g, p, 430, 448, 260, 84);
    paddy(g, p, 470, 542, 280, 86, true);
    g.fillStyle = p.waterDeep;
    g.beginPath();
    g.moveTo(1080, 400);
    g.bezierCurveTo(900, 420, 800, 430, 700, 450);
    g.lineTo(700, 470);
    g.bezierCurveTo(820, 452, 920, 442, 1080, 424);
    g.closePath();
    g.fill();
    g.fillStyle = p.water;
    g.beginPath();
    g.moveTo(1080, 404);
    g.bezierCurveTo(900, 424, 800, 434, 704, 452);
    g.lineTo(704, 466);
    g.bezierCurveTo(820, 448, 920, 438, 1080, 420);
    g.closePath();
    g.fill();
    river(g, p, rnd);
    tangHouse(g, p, 720, 250, 160);
    tangHouse(g, p, 900, 300, 130);
    loomShed(g, p, 240, 420);
    willow(g, p, 150, 200);
    blossomTree(g, p, 620, 240);
    blossomTree(g, p, 980, 260);
    g.fillStyle = p.dirt;
    g.beginPath();
    g.moveTo(360, 720);
    g.bezierCurveTo(520, 620, 700, 600, 900, 560);
    g.lineTo(920, 590);
    g.bezierCurveTo(720, 630, 560, 650, 420, 720);
    g.closePath();
    g.fill();
    rock(g, p, 60, 620, 120, 80);
    rock(g, p, 1000, 600, 100, 70);
    flowers(g, p, rnd);
    sunset(g, p);
    return c;
  }

  /* ---------------- dynamics ---------------- */

  function flame(g, p, x, y, t, size = 1) {
    const glow = g.createRadialGradient(x, y - 16, 4, x, y - 16, 80 * size);
    glow.addColorStop(0, 'rgba(255,180,90,0.38)');
    glow.addColorStop(1, 'rgba(255,180,90,0)');
    g.fillStyle = glow;
    g.fillRect(x - 90 * size, y - 100 * size, 180 * size, 180 * size);
    const layers = [
      [p.fire, 30, 46],
      ['#ffc25e', 20, 32],
      [p.fireCore, 11, 18]
    ];
    layers.forEach(([c, w, h], li) => {
      const flick = Math.sin(t * 9 + li * 2) * 3 + Math.sin(t * 13 + li) * 2;
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.quadraticCurveTo(x - w / 2 - 2, y - h * 0.5, x + flick * 0.4, y - h - flick);
      g.quadraticCurveTo(x + w / 2 + 2, y - h * 0.5, x + w / 2, y);
      g.closePath();
      g.fill();
    });
    for (let i = 0; i < 5; i += 1) {
      const k = (t * 0.7 + i * 0.2) % 1;
      g.globalAlpha = 1 - k;
      R(g, x + Math.sin(t * 3 + i * 2) * 12, y - 22 - k * 56, 3, 3, i % 2 ? p.fireCore : p.fire);
    }
    g.globalAlpha = 1;
  }

  function smoke(g, p, x, y, t, count = 4, spread = 10) {
    for (let i = 0; i < count; i += 1) {
      const k = (t * 0.12 + i / count) % 1;
      g.globalAlpha = 0.22 * (1 - k);
      const r = 6 + k * 22;
      g.fillStyle = p.smoke;
      g.beginPath();
      g.arc(x + Math.sin(t * 0.8 + i) * spread * k, y - k * 90, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function ripples(g, p, x, y, t) {
    for (let i = 0; i < 3; i += 1) {
      const k = (t * 0.4 + i / 3) % 1;
      g.globalAlpha = 0.5 * (1 - k);
      g.strokeStyle = p.foam;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x, y, 8 + k * 26, 3 + k * 9, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function waterShimmer(g, p, t, region) {
    g.save();
    g.globalAlpha = 0.3;
    for (let i = 0; i < 14; i += 1) {
      const x = region.x + ((i * 97 + t * 30) % region.w);
      const y = region.y + ((i * 53) % region.h);
      R(g, x, y, 16, 3, p.waterLight);
    }
    g.restore();
  }

  function wheel(g, p, x, y, t) {
    shadow(g, x, y + 62, 44, 10, 0.18);
    g.strokeStyle = p.wood;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x - 34, y + 60);
    g.lineTo(x - 20, y);
    g.moveTo(x + 34, y + 60);
    g.lineTo(x + 20, y);
    g.stroke();
    g.save();
    g.translate(x, y);
    g.rotate(t * 0.8);
    g.strokeStyle = p.wood;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(0, 0, 44, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 4;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 44, Math.sin(a) * 44);
      g.stroke();
      R(g, Math.cos(a) * 44 - 6, Math.sin(a) * 44 - 8, 12, 16, p.woodLight);
    }
    g.restore();
    R(g, x - 6, y - 6, 12, 12, p.woodLight);
    g.globalAlpha = 0.5;
    for (let i = 0; i < 4; i += 1) {
      const k = (t * 1.2 + i * 0.25) % 1;
      R(g, x + 40 + i * 4, y + 30 + k * 26, 3, 3, p.foam);
    }
    g.globalAlpha = 1;
  }

  function drawStoneDynamic(g, t) {
    const p = PAL.stone;
    waterShimmer(g, p, t, { x: 1020, y: 330, w: 250, h: 380 });
    ripples(g, p, 1180, 470, t);
    ripples(g, p, 1240, 560, t + 1);
    g.save();
    g.globalAlpha = 0.8;
    for (let i = 0; i < 5; i += 1) {
      const off = (t * 60 + i * 8) % 56;
      R(g, 1140 + i * 18, 350 + off - 8, 4, 12, p.foam);
    }
    g.restore();
    smoke(g, p, 435, 455, t, 4, 12);
    smoke(g, p, 700, 505, t + 3, 2, 8);
    flame(g, p, 435, 516, t, 1);
    flame(g, p, 700, 556, t + 2, 0.6);
    g.save();
    g.translate(700, 470);
    g.rotate(Math.sin(t * 1.5) * 0.2);
    R(g, -16, -6, 32, 12, '#8a4a2c');
    R(g, -16, -6, 32, 4, '#a86038');
    g.restore();

    const wf = Math.floor(t * 2) % 2;
    const cx = 380 + ((t * 26) % 260);
    drawChar(g, cx, 430 + Math.sin(cx * 0.02) * 10, { pose: 'walk', frame: wf, carry: 'wood' });
    const cx2 = 640 - ((t * 22) % 240);
    drawChar(g, cx2, 470 + Math.sin(cx2 * 0.02) * 8, { pose: 'walk', frame: 1 - wf, carry: 'basket', flip: true });
    drawChar(g, 370, 570, { pose: 'sit', arm: 'up', frame: wf, tool: p.rockLight });
    drawChar(g, 420, 575, { pose: 'sit', arm: 'work', frame: 1 - wf, tool: p.rock });
    drawChar(g, 560, 545, { pose: 'sit', arm: 'up', frame: Math.floor(t * 0.6) % 2, cloth: '#7a5a3a', hair: '#d8d0c0' });
    drawChar(g, 600, 560, { pose: 'sit', frame: 0, scale: 2 });
    drawChar(g, 760, 555, { pose: 'sit', arm: 'work', frame: wf, flip: true });
    drawChar(g, 390, 310, { pose: 'stand', frame: wf });
    R(g, 398, 280 + wf * 3, 10, 16, p.hide);
    drawChar(g, 880, 570, { pose: 'pick', frame: wf });
    drawChar(g, 950, 580, { pose: 'pick', frame: 1 - wf, flip: true });
    drawChar(g, 1060, 470, { pose: 'fish', frame: wf });
    drawChar(g, 1120, 590, { pose: 'fish', frame: 1 - wf, flip: true });
    const kx = 880 + Math.sin(t * 0.9) * 60;
    drawChar(g, kx, 620, { pose: 'walk', frame: wf, scale: 2, flip: Math.cos(t * 0.9) < 0 });
    deer(g, 980, 200, Math.floor(t * 0.4) % 2);
    bird(g, 1180, 120, Math.floor(t * 3) % 2);
    bird(g, 1210, 112, 1 - (Math.floor(t * 3) % 2), '#c8503a');
    const bx = (t * 40) % (SCENE_W + 200) - 100;
    bird(g, bx, 90 + Math.sin(t * 2) * 12, Math.floor(t * 6) % 2, '#3a2a1e');
  }

  function drawTangDynamic(g, t) {
    const p = PAL.tang;
    waterShimmer(g, p, t, { x: 725, y: 362, w: 115, h: 36 });
    waterShimmer(g, p, t, { x: 1040, y: 345, w: 240, h: 70 });
    waterShimmer(g, p, t, { x: 1185, y: 440, w: 95, h: 120 });
    waterShimmer(g, p, t, { x: 300, y: 545, w: 250, h: 62 });
    wheel(g, p, 800, 378, t);
    smoke(g, p, 1115, 88, t, 3, 8);
    smoke(g, p, 1112, 418, t + 3, 2, 6);
    const wf = Math.floor(t * 1.6) % 2;
    drawChar(g, 350, 495, { pose: 'hoe', frame: wf, cloth: p.cloth });
    drawChar(g, 500, 515, { pose: 'hoe', frame: 1 - wf, cloth: '#8a9ab8' });
    drawChar(g, 560, 470, { pose: 'hoe', frame: wf, flip: true, cloth: p.cloth });
    drawChar(g, 210, 465, { pose: 'weave', frame: wf, cloth: '#b08a9a' });
    const wx = 620 + ((t * 20) % 160);
    drawChar(g, wx, 520 + (wx - 620) * 0.2, { pose: 'walk', frame: wf, carry: 'basket' });
    drawChar(g, 820, 455, { pose: 'stand', frame: wf, cloth: '#7a8ab0' });
    const kx = 640 + Math.sin(t * 1.1) * 80;
    drawChar(g, kx, 660, { pose: 'walk', frame: wf, scale: 2, flip: Math.cos(t * 1.1) < 0 });
    drawChar(g, 1000, 430, { pose: 'fish', frame: wf });
    const bx = 1215 + Math.sin(t * 0.4) * 14;
    g.save();
    g.translate(bx, 495 + Math.sin(t * 1.2) * 2);
    shadow(g, 0, 12, 34, 6, 0.2);
    R(g, -30, 0, 60, 10, p.wood);
    R(g, -34, -4, 8, 8, p.woodLight);
    R(g, 26, -4, 8, 8, p.woodLight);
    R(g, -12, -14, 26, 12, p.roofDark);
    g.restore();
    ripples(g, p, bx, 511, t);
    bird(g, 520, 88, Math.floor(t * 3) % 2);
    bird(g, 552, 76, 1 - (Math.floor(t * 3) % 2), '#c8503a');
    const fx = (t * 34) % (SCENE_W + 200) - 100;
    bird(g, fx, 60 + Math.sin(t * 2) * 10, Math.floor(t * 6) % 2, '#3a2a1e');
    for (let i = 0; i < 3; i += 1) {
      const x = 440 + i * 160 + Math.sin(t * 1.4 + i) * 30;
      const y = 360 + Math.cos(t * 1.1 + i * 2) * 24;
      R(g, x, y, 4, 3, i % 2 ? p.flower : p.blossomLight);
      R(g, x + 4, y + (Math.floor(t * 8) % 2 ? -2 : 2), 4, 3, i % 2 ? p.flower : p.blossomLight);
    }
  }

  /* ---------------- steam town ---------------- */

  function buildSteamBase() {
    const p = PAL.steam;
    const c = document.createElement('canvas');
    c.width = SCENE_W;
    c.height = SCENE_H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    R(g, 0, 0, SCENE_W, 120, p.skyTop);
    R(g, 0, 120, SCENE_W, 80, p.skyMid);
    R(g, 0, 200, SCENE_W, 60, p.skyWarm);
    R(g, 0, 236, SCENE_W, 24, p.glow);
    const rnd = rngFactory(77);
    for (let i = 0; i < 26; i += 1) {
      const x = Math.floor(rnd() * SCENE_W);
      const h = 30 + Math.floor(rnd() * 70);
      R(g, x, 260 - h, 14 + Math.floor(rnd() * 30), h, p.skyline);
      if (rnd() > 0.6) R(g, x + 4, 260 - h - 40, 6, 40, p.skyline);
    }
    R(g, 0, 250, SCENE_W, 14, p.mist);
    R(g, 794, 274, 486, 130, p.water);
    R(g, 794, 274, 486, 8, p.waterLight);
    R(g, 512, 240, 450, 100, p.ironDark);
    R(g, 640, 214, 60, 30, p.iron);
    R(g, 0, 260, 794, 144, p.cobble);
    R(g, 0, 404, SCENE_W, 316, p.cobble);
    for (let i = 0; i < 90; i += 1) {
      R(g, Math.floor(rnd() * SCENE_W), 404 + Math.floor(rnd() * 180), 10, 4, rnd() > 0.5 ? p.cobbleDark : p.cobbleLight);
    }
    R(g, 0, 590, SCENE_W, 100, p.ballast);
    for (let x = 0; x < SCENE_W; x += 24) R(g, x, 606, 14, 44, p.wood);
    R(g, 0, 616, SCENE_W, 5, p.rail);
    R(g, 0, 666, SCENE_W, 5, p.rail);
    R(g, 77, 302, 345, 274, p.brick);
    R(g, 77, 302, 345, 20, p.slate);
    R(g, 128, 72, 34, 230, p.brickLight);
    R(g, 128, 72, 34, 10, p.brickDark);
    for (let i = 0; i < 4; i += 1) R(g, 102 + i * 52, 403, 26, 44, p.lamp);
    for (let i = 0; i < 3; i += 1) R(g, 192 + i * 62, 490, 34, 86, p.brickDark);
    R(g, 422, 331, 346, 245, p.brick);
    R(g, 422, 331, 346, 22, p.slate);
    R(g, 630, 22, 34, 310, p.brickLight);
    for (let i = 0; i < 6; i += 1) R(g, 448 + i * 52, 403, 26, 44, p.lamp);
    for (let i = 0; i < 6; i += 1) R(g, 448 + i * 52, 490, 30, 86, p.brickDark);
    R(g, 768, 187, 128, 389, p.brick);
    R(g, 768, 187, 128, 26, p.slateDark);
    R(g, 794, 302, 34, 34, p.foam);
    R(g, 845, 302, 34, 34, p.foam);
    R(g, 806, 316, 10, 4, p.iron);
    R(g, 857, 316, 10, 4, p.iron);
    R(g, 870, 403, 307, 173, p.brick);
    R(g, 870, 403, 307, 24, p.slate);
    R(g, 896, 360, 20, 44, p.brickLight);
    for (let i = 0; i < 5; i += 1) R(g, 900 + i * 56, 490, 26, 40, p.lamp);
    R(g, 640, 547, 640, 16, p.slateDark);
    for (let i = 0; i < 8; i += 1) R(g, 660 + i * 80, 563, 6, 30, p.iron);
    R(g, 0, 432, 330, 288, p.coal);
    for (let i = 0; i < 24; i += 1) R(g, Math.floor(rnd() * 300), 440 + Math.floor(rnd() * 260), 16, 12, p.coalDark);
    R(g, 384, 490, 154, 100, p.woodLight);
    R(g, 384, 490, 154, 8, p.wood);
    R(g, 440, 440, 60, 50, p.woodLight);
    R(g, 666, 410, 12, 144, p.iron);
    R(g, 660, 400, 24, 26, p.lamp);
    R(g, 1197, 420, 12, 134, p.iron);
    R(g, 1191, 410, 24, 26, p.lamp);
    return c;
  }

  function steamPuff(g, p, x, y, t, n, spread) {
    g.save();
    for (let i = 0; i < n; i += 1) {
      const k = (t * 0.5 + i / n) % 1;
      g.globalAlpha = 0.5 * (1 - k);
      g.fillStyle = p.steam;
      g.beginPath();
      g.arc(x + Math.sin(t * 1.1 + i * 2) * spread * k, y - k * 60, 4 + k * 12, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function flywheel(g, p, x, y, t) {
    shadow(g, x, y + 46, 40, 8, 0.22);
    R(g, x - 30, y + 30, 10, 18, p.ironDark);
    R(g, x + 20, y + 30, 10, 18, p.ironDark);
    g.save();
    g.translate(x, y);
    g.rotate(t * 1.2);
    g.strokeStyle = p.iron;
    g.lineWidth = 8;
    g.beginPath();
    g.arc(0, 0, 36, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 4;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 36, Math.sin(a) * 36);
      g.stroke();
    }
    g.restore();
    R(g, x - 6, y - 6, 12, 12, p.brass);
    const rod = Math.cos(t * 1.2) * 36;
    g.strokeStyle = p.brassLight;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x + rod, y + Math.sin(t * 1.2) * 36);
    g.lineTo(x - 62, y + 20);
    g.stroke();
  }

  function train(g, p, x, t, moving) {
    g.save();
    shadow(g, x + 60, 630, 150, 8, 0.25);
    for (let w = 0; w < 2; w += 1) {
      const wx = x - 78 - w * 74;
      R(g, wx, 574, 64, 34, p.wood);
      R(g, wx, 574, 64, 6, p.woodLight);
      R(g, wx + 6, 566, 52, 10, p.coal);
      R(g, wx + 8, 608, 12, 12, p.ironDark);
      R(g, wx + 44, 608, 12, 12, p.ironDark);
    }
    R(g, x, 560, 92, 44, p.ironDark);
    R(g, x, 560, 92, 8, p.ironLight);
    R(g, x + 18, 568, 6, 28, p.brass);
    R(g, x + 52, 568, 6, 28, p.brass);
    R(g, x + 92, 542, 42, 62, p.iron);
    R(g, x + 98, 550, 20, 18, p.lamp);
    R(g, x + 92, 536, 42, 8, p.ironDark);
    R(g, x + 12, 532, 14, 28, p.ironDark);
    R(g, x + 8, 528, 22, 8, p.iron);
    R(g, x + 134, 596, 10, 18, p.ironLight);
    R(g, x + 138, 606, 10, 12, p.ironLight);
    const wf = Math.floor(t * 6) % 2;
    for (const [wx, wr] of [[x + 20, 13], [x + 54, 13], [x + 106, 11]]) {
      g.save();
      g.translate(wx, 618);
      g.rotate(moving ? t * 4 : 0);
      g.fillStyle = p.ironDark;
      g.beginPath();
      g.arc(0, 0, wr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = p.brass;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-wr + 3, 0);
      g.lineTo(wr - 3, 0);
      g.moveTo(0, -wr + 3);
      g.lineTo(0, wr - 3);
      g.stroke();
      g.restore();
      if (wf) R(g, wx - 2, 616, 4, 4, p.brassLight);
    }
    g.restore();
    if (moving) {
      smoke(g, p, x + 19, 528, t, 3, 8);
      steamPuff(g, p, x + 130, 606, t, 3, 10);
    } else {
      steamPuff(g, p, x + 130, 606, t, 2, 6);
    }
  }

  function drawSteamDynamic(g, t) {
    const p = PAL.steam;
    waterShimmer(g, p, t, { x: 200, y: 245, w: 300, h: 55 });
    waterShimmer(g, p, t, { x: 960, y: 300, w: 70, h: 60 });
    waterShimmer(g, p, t, { x: 1160, y: 280, w: 120, h: 110 });
    smoke(g, p, 160, 72, t, 3, 10);
    smoke(g, p, 659, 22, t + 2, 4, 12);
    smoke(g, p, 909, 360, t + 5, 2, 6);
    flywheel(g, p, 320, 470, t);
    steamPuff(g, p, 255, 465, t + 1, 2, 6);
    g.save();
    g.translate(600, 475);
    g.rotate(t * 2);
    g.strokeStyle = p.iron;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, 10, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(-10, 0);
    g.lineTo(10, 0);
    g.stroke();
    g.restore();
    g.save();
    g.translate(680, 475);
    g.rotate(t * 2);
    g.strokeStyle = p.iron;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, 10, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(0, -10);
    g.lineTo(0, 10);
    g.stroke();
    g.restore();
    g.strokeStyle = p.ironDark;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(600, 465);
    g.lineTo(680, 465);
    g.moveTo(600, 485);
    g.lineTo(680, 485);
    g.stroke();
    const dash = Math.floor(t * 40) % 16;
    g.fillStyle = p.brass;
    for (let x = 600 - dash; x < 680; x += 16) R(g, x, 464, 6, 3, p.brass);
    const breathe = 0.22 + 0.08 * Math.sin(t * 1.5);
    g.save();
    g.globalAlpha = breathe;
    g.fillStyle = p.lampGlow;
    g.beginPath();
    g.arc(672, 425, 16, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(1203, 432, 16, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const ph = t % 48;
    let tx = 1630;
    let moving = false;
    if (reduced) tx = 400;
    else if (ph < 14) {
      tx = -350 + (ph / 14) * 750;
      moving = true;
    } else if (ph < 26) tx = 400;
    else if (ph < 40) {
      tx = 400 + ((ph - 26) / 14) * 1230;
      moving = true;
    }
    const wf = Math.floor(t * 1.2) % 2;
    const wx = 560 + ((t * 18) % 200);
    drawChar(g, wx, 585, { pose: 'walk', frame: wf, carry: 'basket', cloth: p.cloth });
    drawChar(g, 342, 508, { pose: 'operate', flip: true, cloth: p.clothDark });
    drawChar(g, 860, 585, { pose: 'stand', arm: 'up', frame: 1 - wf, cloth: '#7a5a3a' });
    drawChar(g, 900, 585, { pose: 'stand', frame: 0, cloth: p.cloth });
    drawChar(g, 930, 585, { pose: 'stand', frame: 0, scale: 2, cloth: '#8a6a4a' });
    // 人物脚点均在轨道平面之后：火车驶过时必须遮住站台与 yard 上的人
    if (tx > -360 && tx < 1640) train(g, p, Math.round(tx), t, moving);
  }

  /* ---------------- layered bitmap base ---------------- */

  function applyDecals(g, eraId) {
    if (eraId === 'stone') {
      const d = document.createElement('canvas');
      d.width = 360;
      d.height = 210;
      cave(d.getContext('2d'), PAL.stone);
      g.drawImage(d, 0, 0, 360, 210, -5, 30, 144, 84);
      toolRack(g, PAL.stone, 660, 580);
    }
    if (eraId === 'steam') {
      const p = PAL.steam;
      R(g, 230, 470, 52, 46, p.ironDark);
      R(g, 230, 482, 52, 4, p.brass);
      R(g, 230, 500, 52, 4, p.brass);
      R(g, 244, 456, 10, 14, p.iron);
      R(g, 282, 486, 8, 8, p.brassLight);
    }
  }

  function compositeLayers(eraId, imgs) {
    const c = document.createElement('canvas');
    c.width = SCENE_W;
    c.height = SCENE_H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    imgs.forEach((im) => g.drawImage(im, 0, 0, SCENE_W, SCENE_H));
    applyDecals(g, eraId);
    return c;
  }

  function preload(eraId) {
    const urls = LAYERS[eraId];
    if (!urls || layerState.has(eraId)) return;
    layerState.set(eraId, 'loading');
    Promise.all(
      urls.map(
        (u) =>
          new Promise((res, rej) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () => rej(new Error(u));
            im.src = u;
          })
      )
    )
      .then((imgs) => {
        layerBase.set(eraId, compositeLayers(eraId, imgs));
        layerState.set(eraId, 'ready');
        if (eraId === era) {
          base = null;
          if (active) draw(reduced ? 1.4 : (performance.now() - t0) / 1000);
        }
      })
      .catch(() => {
        layerState.set(eraId, 'failed');
        console.warn(`文明专注：${eraId} 分层底图加载失败，使用程序化兜底画面。`);
      });
  }

  function baseFor(eraId) {
    if (layerBase.has(eraId)) return layerBase.get(eraId);
    if (!procBase.has(eraId)) {
      procBase.set(
        eraId,
        eraId === 'tang' ? buildTangBase() : eraId === 'steam' ? buildSteamBase() : buildStoneBase()
      );
    }
    return procBase.get(eraId);
  }

  function sliceAt(eraId, cx, cy) {
    const w = 240;
    const h = 160;
    const x = Math.max(0, Math.min(SCENE_W - w, Math.round(cx - w / 2)));
    const y = Math.max(0, Math.min(SCENE_H - h, Math.round(cy - h / 2)));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(baseFor(eraId), x, y, w, h, 0, 0, w, h);
    return c.toDataURL('image/png');
  }

  /* ---------------- lifecycle ---------------- */

  function buildBase() {
    base = baseFor(era);
  }

  function draw(t) {
    now = t;
    if (!base) buildBase();
    ctx.clearRect(0, 0, SCENE_W, SCENE_H);
    ctx.drawImage(base, 0, 0);
    if (era === 'tang') drawTangDynamic(ctx, t);
    else if (era === 'steam') drawSteamDynamic(ctx, t);
    else drawStoneDynamic(ctx, t);
  }

  function frame(now) {
    raf = 0;
    if (!active) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return;
    last = now;
    draw(reduced ? 1.4 : (now - t0) / 1000);
  }

  function layout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (fit === 'panorama') {
      const plaqueEl = document.getElementById('plaque');
      const bottomEl = document.querySelector('.scene-bottom');
      const top = plaqueEl ? plaqueEl.getBoundingClientRect().bottom + 10 : 160;
      const bottom = bottomEl ? vh - bottomEl.getBoundingClientRect().top + 10 : 130;
      const availW = Math.max(120, vw - 16);
      const availH = Math.max(90, vh - top - bottom);
      scale = Math.min(availW / SCENE_W, availH / SCENE_H);
      const w = SCENE_W * scale;
      const h = SCENE_H * scale;
      offX = (vw - w) / 2;
      offY = top + (availH - h) / 2;
    } else {
      scale = Math.max(vw / SCENE_W, vh / SCENE_H);
      const w = SCENE_W * scale;
      const h = SCENE_H * scale;
      offX = (vw - w) / 2;
      offY = (vh - h) / 2;
    }
    const w = SCENE_W * scale;
    const h = SCENE_H * scale;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.left = `${offX}px`;
    canvas.style.top = `${offY}px`;
  }

  function start() {
    active = true;
    layout();
    preload(era);
    if (reduced) {
      draw(1.4);
      return;
    }
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function stop() {
    active = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function setEra(next) {
    if (next === era) return;
    era = next;
    base = null;
    canvas.setAttribute('aria-label', ERAS[era].mapLabel);
    preload(era);
    if (active) {
      layout();
      if (reduced) draw(1.4);
    }
  }

  window.addEventListener('resize', () => {
    if (active) {
      layout();
      if (reduced) draw(1.4);
    }
  });

  return {
    start,
    stop,
    setEra,
    getEra: () => era,
    setReduced(next) {
      reduced = next;
      if (active) {
        if (reduced) {
          stop();
          active = true;
          draw(1.4);
        } else start();
      }
    },
    toScreen(x, y) {
      return { x: offX + x * scale, y: offY + y * scale };
    },
    hotspots() {
      if (era === 'tang') {
        return [
          { id: 'wheel', x: 800, y: 370 },
          { id: 'field', x: 400, y: 530 },
          { id: 'pagoda', x: 665, y: 180 }
        ];
      }
      if (era === 'steam') {
        return [
          { id: 'engine', x: 320, y: 460 },
          { id: 'loom', x: 640, y: 400 },
          { id: 'rail', x: 980, y: 620 }
        ];
      }
      return [
        { id: 'tools', x: 660, y: 560 },
        { id: 'campfire', x: 435, y: 505 },
        { id: 'tent', x: 166, y: 225 }
      ];
    },
    preload,
    sliceAt,
    setFit(mode) {
      fit = mode === 'panorama' ? 'panorama' : 'immersive';
      if (active) {
        layout();
        if (reduced) draw(1.4);
      }
    },
    getFit: () => fit,
    resize: layout
  };
}
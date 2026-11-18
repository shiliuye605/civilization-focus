import * as THREE from 'three';
import { GLOBE_LAYOUT } from './themes.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const OCEAN_R = 0.996;
const LAND_BASE = 1.0;
const LAND_H = 0.14;
const STEPS = 6;

let glowTexture = null;
let shadowTexture = null;
let fallTexture = null;
let flameTexture = null;

/* ---------------- noise & field ---------------- */

function hash2(x, y) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return v - Math.floor(v);
}

function smoothNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x, y, oct = 4) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < oct; i += 1) {
    value += smoothNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / norm;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function blobScore(lon, lat) {
  let best = -1;
  for (const b of GLOBE_LAYOUT.blobs) {
    let dx = Math.abs(lon - b.lon);
    if (dx > 0.5) dx = 1 - dx;
    const d = Math.hypot(dx / b.ru, (lat - b.lat) / b.rl);
    best = Math.max(best, 1 - d);
  }
  return best;
}

function elevationAt(lon, lat) {
  const wl = (fbm(lon * 7.5 + 11.3, lat * 0.09 + 3.7, 3) - 0.5) * 0.016;
  const wa = (fbm(lon * 5.5 + 2.1, lat * 0.07 + 8.9, 3) - 0.5) * 3.2;
  const base = blobScore(lon + wl, lat + wa);
  const detail = (fbm(lon * 24 + 4.2, lat * 0.28 + 1.8, 3) - 0.5) * 0.12;
  return base + detail;
}

function moistureAt(lon, lat) {
  return fbm(lon * 16 + 7.3, lat * 0.22 + 3.2, 4);
}

function riverDist(lon, lat) {
  let best = 1;
  const pts = GLOBE_LAYOUT.river;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1e-6;
    let t = ((lon - x1) * dx + (lat - y1) * dy) / len2;
    t = clamp(t, 0, 1);
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    let dlon = Math.abs(lon - px);
    if (dlon > 0.5) dlon = 1 - dlon;
    const d = Math.hypot(dlon / 0.012, (lat - py) / 3.2);
    best = Math.min(best, d);
  }
  return best;
}

function isRiver(lon, lat) {
  return riverDist(lon, lat) < 1 && elevationAt(lon, lat) > -0.02;
}

function lonLatToVector3(lon, lat, r) {
  const theta = (90 - lat) * DEG;
  const phi = lon * TAU;
  return new THREE.Vector3(
    -r * Math.cos(phi) * Math.sin(theta),
    r * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function orientOnSphere(obj, lon, lat, r = 1.002, yaw = 0) {
  const n = lonLatToVector3(lon, lat, 1);
  obj.position.copy(n.clone().multiplyScalar(r));
  const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
  if (yaw) q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
  obj.quaternion.copy(q);
  return n;
}

/* ---------------- textures ---------------- */

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function getGlow() {
  if (!glowTexture) {
    glowTexture = radialTexture([
      [0, 'rgba(255,255,255,0.95)'],
      [0.42, 'rgba(255,255,255,0.28)'],
      [1, 'rgba(255,255,255,0)']
    ]);
  }
  return glowTexture;
}

function getShadow() {
  if (!shadowTexture) {
    shadowTexture = radialTexture([
      [0, 'rgba(0,0,0,0.6)'],
      [0.55, 'rgba(0,0,0,0.28)'],
      [1, 'rgba(0,0,0,0)']
    ]);
    shadowTexture.colorSpace = THREE.NoColorSpace;
  }
  return shadowTexture;
}

function getFlame() {
  if (!flameTexture) {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 48;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 48, 0, 0);
    grad.addColorStop(0, '#ff8a3a');
    grad.addColorStop(0.5, '#ffb45e');
    grad.addColorStop(1, '#ffe08a');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(16, 2);
    g.quadraticCurveTo(28, 20, 26, 34);
    g.quadraticCurveTo(24, 46, 16, 46);
    g.quadraticCurveTo(8, 46, 6, 34);
    g.quadraticCurveTo(4, 20, 16, 2);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffe9b0';
    g.beginPath();
    g.moveTo(16, 18);
    g.quadraticCurveTo(22, 30, 20, 38);
    g.quadraticCurveTo(18, 44, 16, 44);
    g.quadraticCurveTo(14, 44, 12, 38);
    g.quadraticCurveTo(10, 30, 16, 18);
    g.closePath();
    g.fill();
    flameTexture = new THREE.CanvasTexture(c);
    flameTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return flameTexture;
}

function getFall() {
  if (!fallTexture) {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#bfe6f2';
    g.fillRect(0, 0, 32, 64);
    for (let y = 0; y < 64; y += 8) {
      g.fillStyle = y % 16 === 0 ? '#eaf8ff' : '#8fcbe0';
      g.fillRect(0, y, 32, 4);
    }
    for (let i = 0; i < 26; i += 1) {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillRect(Math.floor(hash2(i, 3) * 30), Math.floor(hash2(i, 9) * 62), 2, 3);
    }
    fallTexture = new THREE.CanvasTexture(c);
    fallTexture.wrapS = THREE.RepeatWrapping;
    fallTexture.wrapT = THREE.RepeatWrapping;
    fallTexture.magFilter = THREE.NearestFilter;
    fallTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return fallTexture;
}

function coastFoamTexture() {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y += 1) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    for (let x = 0; x < W; x += 1) {
      const lon = (x + 0.5) / W;
      const e = elevationAt(lon, lat);
      let a = 0;
      if (e <= 0 && e > -0.07) {
        const near =
          elevationAt(lon + 1 / W, lat) > 0 ||
          elevationAt(lon - 1 / W, lat) > 0 ||
          elevationAt(lon, lat + 180 / H) > 0 ||
          elevationAt(lon, lat - 180 / H) > 0;
        if (near) a = 150;
        else if (e > -0.03) a = 80;
        else if (e > -0.055) a = 34;
      }
      const i = (y * W + x) * 4;
      img.data[i] = 235;
      img.data[i + 1] = 250;
      img.data[i + 2] = 252;
      img.data[i + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------- terrain mesh ---------------- */

function colorFor(pal, e, m, lon, lat, river) {
  const c = new THREE.Color();
  if (river) return c.set(pal.river);
  if (e < 0.05) return c.set(pal.sand);
  if (e > 0.8) return c.set('#e8eef2');
  if (e > 0.62) return c.set(pal.rockLight);
  if (e > 0.48) return c.set(pal.rock);
  const forest = m > (pal.forestWet ?? 0.46) && fbm(lon * 30 + 2.4, lat * 0.5 + 7.1, 3) > 0.3;
  if (forest) {
    const t = clamp((m - 0.35) * 2, 0, 1);
    return c.set(pal.forest1).lerp(new THREE.Color(pal.forest3), t * 0.7);
  }
  const t = clamp((m - 0.15) * 2.2, 0, 1);
  return c.set(pal.grass1).lerp(new THREE.Color(pal.grass3), t);
}

function buildTerrain(pal) {
  const geo = new THREE.SphereGeometry(1, 168, 120);
  const pos = geo.attributes.position;
  const count = pos.count;
  const elev = new Float32Array(count);
  const moist = new Float32Array(count);
  const river = new Uint8Array(count);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i += 1) {
    v.fromBufferAttribute(pos, i).normalize();
    const lat = 90 - Math.acos(clamp(v.y, -1, 1)) / DEG;
    let lon = Math.atan2(v.z, -v.x) / TAU;
    if (lon < 0) lon += 1;
    const e = elevationAt(lon, lat);
    elev[i] = e;
    moist[i] = moistureAt(lon, lat);
    river[i] = isRiver(lon, lat) ? 1 : 0;
    let r;
    if (e <= 0) r = OCEAN_R - 0.012;
    else if (river[i]) r = LAND_BASE + 0.004;
    else {
      const step = Math.min(STEPS - 1, Math.floor(clamp(e, 0, 0.999) * STEPS));
      r = LAND_BASE + (step / STEPS) * LAND_H;
    }
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(count * 3);
  const col = new THREE.Color();
  const radial = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < count; i += 1) {
    const e = elev[i];
    if (e <= 0) {
      col.set(pal.oceanDeep);
    } else if (river[i]) {
      col.set(pal.river);
    } else {
      radial.fromBufferAttribute(pos, i).normalize();
      n.fromBufferAttribute(nrm, i);
      const facing = n.dot(radial);
      const step = Math.min(STEPS - 1, Math.floor(clamp(e, 0, 0.999) * STEPS));
      if (facing < 0.86 && step > 0) {
        // cliff side: earth / rock strata
        col.set(step > 3 ? pal.rockDark : pal.dirtCliff || '#8a6a44');
        if (step > 4) col.lerp(new THREE.Color(pal.rock), 0.5);
        col.offsetHSL(0, 0, (hash2(i * 0.7, i * 1.3) - 0.5) * 0.08);
      } else {
        const lon0 = Math.atan2(radial.z, -radial.x) / TAU;
        const lat0 = 90 - Math.acos(clamp(radial.y, -1, 1)) / DEG;
        col.copy(colorFor(pal, e, moist[i], lon0 < 0 ? lon0 + 1 : lon0, lat0, false));
        col.offsetHSL(0, 0, (hash2(i * 0.37, i * 0.91) - 0.5) * 0.06);
      }
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    flatShading: true
  });
  return new THREE.Mesh(geo, mat);
}

/* ---------------- instanced vegetation ---------------- */

function treeSpots(pal, count, seed) {
  const rng = mulberry32(seed);
  const spots = [];
  let guard = 0;
  while (spots.length < count && guard < count * 40) {
    guard += 1;
    const lon = rng();
    const lat = (rng() - 0.5) * 150;
    const e = elevationAt(lon, lat);
    const m = moistureAt(lon, lat);
    if (e < 0.08 || e > 0.6) continue;
    if (isRiver(lon, lat)) continue;
    if (m < (pal.forestWet ?? 0.46) - 0.1) continue;
    if (fbm(lon * 30 + 2.4, lat * 0.5 + 7.1, 3) < 0.28) continue;
    spots.push({ lon, lat, s: 0.7 + rng() * 0.7, r: rng() * TAU, tone: rng() });
  }
  return spots;
}

function buildTrees(pal, spots) {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.006, 0.009, 0.03, 5);
  const coneGeo = new THREE.ConeGeometry(1, 1, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: pal.wood, roughness: 1, flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const lower = new THREE.InstancedMesh(coneGeo, leafMat, spots.length);
  const upper = new THREE.InstancedMesh(coneGeo, leafMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const cA = new THREE.Color(pal.forest1);
  const cB = new THREE.Color(pal.forest3);
  const tmp = new THREE.Color();
  spots.forEach((sp, i) => {
    n.copy(lonLatToVector3(sp.lon, sp.lat, 1));
    const e = elevationAt(sp.lon, sp.lat);
    const step = Math.min(STEPS - 1, Math.floor(clamp(e, 0, 0.999) * STEPS));
    const base = LAND_BASE + (step / STEPS) * LAND_H;
    q.setFromUnitVectors(UP, n);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, sp.r);
    q.multiply(yaw);
    const h = 0.075 * sp.s;
    p.copy(n).multiplyScalar(base + 0.014 * sp.s);
    s.set(sp.s, sp.s, sp.s);
    m4.compose(p, q, s);
    trunks.setMatrixAt(i, m4);
    p.copy(n).multiplyScalar(base + h * 0.55);
    s.set(0.03 * sp.s, h * 0.75, 0.03 * sp.s);
    m4.compose(p, q, s);
    lower.setMatrixAt(i, m4);
    p.copy(n).multiplyScalar(base + h * 1.02);
    s.set(0.021 * sp.s, h * 0.6, 0.021 * sp.s);
    m4.compose(p, q, s);
    upper.setMatrixAt(i, m4);
    tmp.copy(cA).lerp(cB, sp.tone * 0.8);
    lower.setColorAt(i, tmp);
    upper.setColorAt(i, tmp.clone().offsetHSL(0, 0, 0.05));
  });
  trunks.instanceMatrix.needsUpdate = true;
  lower.instanceMatrix.needsUpdate = true;
  upper.instanceMatrix.needsUpdate = true;
  if (lower.instanceColor) lower.instanceColor.needsUpdate = true;
  if (upper.instanceColor) upper.instanceColor.needsUpdate = true;
  group.add(trunks, lower, upper);
  return group;
}

/* ---------------- structures ---------------- */

function std(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true });
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function addShadowDisc(parent, lon, lat, r, opacity = 0.3) {
  const g = new THREE.CircleGeometry(r, 18);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ map: getShadow(), color: 0x000000, transparent: true, opacity, depthWrite: false })
  );
  m.renderOrder = 2;
  orientOnSphere(m, lon, lat, 1.004, 0);
  parent.add(m);
}

function cabin(pal, opts = {}) {
  const g = new THREE.Group();
  const wall = std(opts.wall || pal.woodLight || '#8a6a44');
  const roof = std(opts.roof || '#6d4a2c');
  const dark = std('#3a2a1c');
  g.add(box(0.062, 0.036, 0.05, wall, 0, 0.018, 0));
  const roofGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.066, 3, 1);
  const roofMesh = new THREE.Mesh(roofGeo, roof);
  roofMesh.rotation.z = Math.PI / 2;
  roofMesh.rotation.y = Math.PI / 2;
  roofMesh.scale.set(1, 1, 0.72);
  roofMesh.position.y = 0.05;
  g.add(roofMesh);
  g.add(box(0.014, 0.022, 0.004, dark, 0, 0.012, 0.026));
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.01, 0.003),
    new THREE.MeshBasicMaterial({ color: '#ffca7a' })
  );
  win.position.set(0.018, 0.02, 0.026);
  g.add(win);
  g.add(box(0.009, 0.026, 0.009, std('#7d7a72'), -0.02, 0.055, -0.012));
  return g;
}

function watchtower(pal) {
  const g = new THREE.Group();
  const wood = std(pal.wood);
  [-0.016, 0.016].forEach((x) => {
    [-0.016, 0.016].forEach((z) => {
      g.add(box(0.006, 0.085, 0.006, wood, x, 0.042, z));
    });
  });
  g.add(box(0.046, 0.008, 0.046, std(pal.woodLight || '#8a6a44'), 0, 0.086, 0));
  g.add(box(0.034, 0.024, 0.034, std(pal.woodLight || '#8a6a44'), 0, 0.102, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.024, 4), std('#8a3f2c'));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.126;
  g.add(roof);
  const pole = box(0.002, 0.03, 0.002, wood, 0, 0.15, 0);
  g.add(pole);
  const flag = box(0.02, 0.011, 0.001, std('#c8503a'), 0.011, 0.158, 0);
  g.add(flag);
  return g;
}

function tent(pal, color) {
  const g = new THREE.Group();
  const hide = std(color || '#c9b18a');
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.042, 4), hide);
  cone.rotation.y = Math.PI / 4;
  cone.position.y = 0.021;
  g.add(cone);
  g.add(box(0.01, 0.016, 0.003, std('#4a3826'), 0, 0.008, 0.021));
  return g;
}

function campfire(pal, animations) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * TAU;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.006, 0), std(i % 2 ? pal.rockDark : pal.rockDark));
    st.position.set(Math.cos(a) * 0.022, 0.004, Math.sin(a) * 0.022);
    g.add(st);
  }
  const logMat = std(pal.wood);
  for (let i = 0; i < 3; i += 1) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.034, 5), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.006;
    g.add(log);
  }
  const flame = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: getFlame(), transparent: true, depthWrite: false })
  );
  flame.scale.set(0.036, 0.054, 1);
  flame.position.y = 0.032;
  const core = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: getFlame(), transparent: true, depthWrite: false, opacity: 0.85 })
  );
  core.scale.set(0.02, 0.03, 1);
  core.position.y = 0.026;
  g.add(flame, core);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getGlow(),
      color: 0xff9a4a,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  glow.scale.set(0.06, 0.06, 1);
  glow.position.y = 0.03;
  g.add(glow);
  const light = new THREE.PointLight(pal.fire || '#ff9f57', 0.06, 0.1, 2);
  light.position.y = 0.05;
  g.add(light);
  animations.push({ type: 'fire', flame, core, light });
  addSmoke(g, animations, 0.05, 3, 0.035);
  return g;
}

function addSmoke(parent, animations, y, count, scale) {
  for (let i = 0; i < count; i += 1) {
    const mat = new THREE.SpriteMaterial({
      map: getGlow(),
      color: 0xcdd6d8,
      transparent: true,
      opacity: 0.12,
      depthWrite: false
    });
    const sp = new THREE.Sprite(mat);
    sp.position.set(0, y + i * 0.014, 0);
    sp.scale.setScalar(scale + i * 0.012);
    parent.add(sp);
    animations.push({
      type: 'smoke',
      sprite: sp,
      baseY: y + i * 0.014,
      rise: 0.09,
      phase: i / count,
      speed: 0.1,
      baseOpacity: 0.12,
      baseScale: scale + i * 0.012
    });
  }
}

function waterfall(lon, lat, animations, width = 0.02, height = 0.05) {
  const g = new THREE.Group();
  const tex = getFall().clone();
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  plane.position.y = height / 2;
  g.add(plane);
  const mist = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getGlow(),
      color: 0xdff2fa,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mist.scale.set(width * 2.4, width * 1.2, 1);
  mist.position.y = 0.004;
  g.add(mist);
  orientOnSphere(g, lon, lat, 1.006, 0);
  g.rotateX(-0.35);
  animations.push({ type: 'fall', tex });
  return g;
}

function tangHouse(pal) {
  const g = new THREE.Group();
  g.add(box(0.07, 0.008, 0.054, std(pal.stoneWall || '#a9a394'), 0, 0.004, 0));
  g.add(box(0.06, 0.034, 0.046, std(pal.plaster || '#e2c99a'), 0, 0.025, 0));
  [-0.026, 0.026].forEach((x) => {
    [-0.02, 0.02].forEach((z) => g.add(box(0.005, 0.036, 0.005, std(pal.wood), x, 0.026, z)));
  });
  g.add(box(0.012, 0.02, 0.003, std('#4a3420'), 0, 0.018, 0.024));
  const eave = box(0.078, 0.006, 0.06, std(pal.roofDark || '#6a2d21'), 0, 0.045, 0);
  g.add(eave);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.026, 4), std(pal.roof || '#9b4534'));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.06;
  roof.scale.set(1.15, 1, 0.9);
  g.add(roof);
  const ridge = box(0.05, 0.005, 0.006, std(pal.roofDark || '#6a2d21'), 0, 0.074, 0);
  g.add(ridge);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.009, 0.003), new THREE.MeshBasicMaterial({ color: '#ffdca0' }));
  win.position.set(0.017, 0.028, 0.024);
  g.add(win);
  return g;
}

function pagoda(pal) {
  const g = new THREE.Group();
  g.add(box(0.05, 0.01, 0.05, std(pal.stoneWall || '#a9a394'), 0, 0.005, 0));
  let y = 0.01;
  for (let t = 0; t < 3; t += 1) {
    const w = 0.036 - t * 0.007;
    g.add(box(w, 0.02, w, std(pal.pagodaWall || '#e6cfa4'), 0, y + 0.01, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 1.05, 0.012, 4), std(pal.pagodaRoof || '#8e3d2d'));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = y + 0.026;
    g.add(roof);
    y += 0.03;
  }
  g.add(box(0.003, 0.02, 0.003, std('#d9b25e'), 0, y + 0.008, 0));
  return g;
}

function waterwheel(pal, animations) {
  const g = new THREE.Group();
  const wood = std(pal.wood);
  [-0.03, 0.03].forEach((x) => g.add(box(0.005, 0.06, 0.005, wood, x, 0.03, 0)));
  g.add(box(0.07, 0.005, 0.005, wood, 0, 0.058, 0));
  const tilt = new THREE.Group();
  tilt.position.set(0, 0.06, 0);
  tilt.rotation.x = -Math.PI / 3.2;
  const wheel = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0045, 5, 16), wood);
  wheel.add(ring);
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * TAU;
    const spoke = box(0.0035, 0.078, 0.0035, wood, 0, 0, 0);
    spoke.rotation.z = a;
    wheel.add(spoke);
    const pad = box(0.013, 0.016, 0.006, std(pal.woodLight || '#8b6a42'), Math.sin(a) * 0.04, Math.cos(a) * 0.04, 0);
    pad.rotation.z = a;
    wheel.add(pad);
  }
  tilt.add(wheel);
  g.add(tilt);
  animations.push({ type: 'wheel', mesh: wheel, speed: 0.8 });
  return g;
}

function boat(pal) {
  const g = new THREE.Group();
  g.add(box(0.04, 0.008, 0.014, std(pal.wood), 0, 0.005, 0));
  [-0.02, 0.02].forEach((x) => {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.014, 4), std(pal.woodLight || '#8b6a42'));
    tip.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    tip.position.set(x, 0.005, 0);
    g.add(tip);
  });
  g.add(box(0.018, 0.009, 0.012, std(pal.roofDark || '#6a2d21'), 0, 0.014, 0));
  return g;
}

function buildStructures(theme, parent, animations) {
  const pal = theme.palette;
  const rng = mulberry32(theme.id === 'tang' ? 91 : 57);
  const place = (obj, lon, lat, yaw = 0, r = 1.002) => {
    const e = elevationAt(lon, lat);
    const step = Math.min(STEPS - 1, Math.floor(clamp(e, 0, 0.999) * STEPS));
    const base = LAND_BASE + (step / STEPS) * LAND_H;
    orientOnSphere(obj, lon, lat, base + 0.002, yaw);
    parent.add(obj);
    addShadowDisc(parent, lon, lat, 0.045, 0.26);
  };

  if (theme.id === 'tang') {
    GLOBE_LAYOUT.tang.villages.forEach((v, i) => {
      const h = tangHouse(pal);
      place(h, v.lon, v.lat, v.angle);
      if (i === 0) addSmoke(h, animations, 0.08, 2, 0.03);
    });
    place(pagoda(pal), GLOBE_LAYOUT.tang.pagoda.lon, GLOBE_LAYOUT.tang.pagoda.lat, 0.3);
    place(waterwheel(pal, animations), GLOBE_LAYOUT.tang.waterwheel.lon, GLOBE_LAYOUT.tang.waterwheel.lat, 0);
    const b = boat(pal);
    orientOnSphere(b, GLOBE_LAYOUT.tang.boat.lon, GLOBE_LAYOUT.tang.boat.lat, OCEAN_R + 0.006, Math.PI / 2);
    parent.add(b);
    animations.push({ type: 'boat', mesh: b, phase: 0.8 });
    GLOBE_LAYOUT.tang.trees3d.slice(0, 6).forEach(([lon, lat, s, type]) => {
      const t = type === 'blossom' ? blossomTree(pal) : broadTree(pal);
      t.scale.setScalar(s);
      place(t, lon, lat, rng() * TAU);
    });
    return;
  }

  const cabinSpots = [
    [0.262, 21, 0.4],
    [0.283, 16.5, 1.6],
    [0.243, 8, 2.4],
    [0.315, 26, 0.9]
  ];
  cabinSpots.forEach(([lon, lat, yaw], i) => {
    const c = cabin(pal);
    c.scale.setScalar(1.3);
    place(c, lon, lat, yaw);
    if (i < 2) addSmoke(c, animations, 0.095, 2, 0.03);
  });
  const tower = watchtower(pal);
  tower.scale.setScalar(1.15);
  place(tower, 0.3, 33, 0.5);
  const fire = campfire(pal, animations);
  place(fire, GLOBE_LAYOUT.stone.campfire.lon, GLOBE_LAYOUT.stone.campfire.lat, 0);
  place(tent(pal, '#c9b18a'), 0.196, 17.5, 0.6);
  place(tent(pal, '#b39a76'), 0.215, 12.5, 2.1);
  GLOBE_LAYOUT.stone.rocks.forEach(([lon, lat, s]) => {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.016 * s, 0), std(pal.rock));
    r.scale.set(1.3, 0.8, 1);
    place(r, lon, lat, rng() * TAU);
  });
}

function broadTree(pal) {
  const g = new THREE.Group();
  g.add(box(0.008, 0.035, 0.008, std(pal.wood), 0, 0.017, 0));
  const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.024, 0), std(pal.forest2 || '#395e3f'));
  a.position.y = 0.05;
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.017, 0), std(pal.forest3 || '#487045'));
  b.position.set(0.014, 0.062, -0.008);
  g.add(a, b);
  return g;
}

function blossomTree(pal) {
  const g = new THREE.Group();
  g.add(box(0.007, 0.032, 0.007, std(pal.wood), 0, 0.016, 0));
  const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), std(pal.blossom || '#c98f7a'));
  a.position.y = 0.048;
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.015, 0), std(pal.blossomLight || '#dda890'));
  b.position.set(-0.013, 0.058, 0.008);
  g.add(a, b);
  return g;
}

/* ---------------- globe ---------------- */

export function createGlobe(canvas, options = {}) {
  const { onActivate, fallback, reducedMotion = false } = options;
  let renderer = null;
  let scene = null;
  let camera = null;
  let root = null;
  let features = null;
  let ocean = null;
  let foam = null;
  let atmosphere = null;
  let halo = null;
  let animations = [];
  let theme = null;
  let reduced = Boolean(reducedMotion);
  let active = false;
  let dragging = false;
  let pointer = null;
  let raf = 0;
  let lastFrame = 0;
  let yaw = 0.12;
  let pitch = 0.06;
  let supported = true;
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let baseDist = 4;
  let zoom = 0;
  let zoomTween = null;
  const zoomTarget = lonLatToVector3(0.26, 16, 1);

  function defaultDistance() {
    const vHalf = (camera.fov * DEG) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const fill = vw < 700 ? 0.8 : 0.66;
    return 1 / Math.sin(Math.min(vHalf, hHalf) * fill);
  }

  function applyCamera() {
    const eased = zoom * zoom * (3 - 2 * zoom);
    const dist = baseDist + (1.42 - baseDist) * eased;
    const look = zoomTarget.clone().multiplyScalar(eased * 0.86);
    camera.position.set(0, 0, dist);
    camera.lookAt(look);
    camera.updateProjectionMatrix();
  }

  function isPointOnGlobe(x, y) {
    if (!camera || zoom > 0.05) return false;
    const vHalf = (camera.fov * DEG) / 2;
    const angular = Math.asin(Math.min(0.99, 1 / camera.position.z));
    const radius = (Math.tan(angular) / Math.tan(vHalf)) * (vh / 2);
    return Math.hypot(x - vw / 2, y - vh / 2) <= radius * 1.02;
  }

  function showFallback() {
    supported = false;
    canvas.hidden = true;
    document.body.classList.add('no-webgl');
    if (fallback) {
      fallback.hidden = false;
      fallback.addEventListener('click', () => onActivate?.());
    }
  }

  function buildRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);

    scene.add(new THREE.HemisphereLight(0xa8c8e8, 0x4a3f2e, 0.55));
    scene.add(new THREE.AmbientLight(0x93a8c0, 0.34));
    const key = new THREE.DirectionalLight(0xffd9a0, 2.3);
    key.position.set(-4.2, 2.6, 2.6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x86b4dc, 0.55);
    fill.position.set(2.6, 0.8, 3.6);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x5d94c8, 0.6);
    rim.position.set(2.4, -1.6, -3.2);
    scene.add(rim);

    root = new THREE.Group();
    root.rotation.order = 'YXZ';
    scene.add(root);

    ocean = new THREE.Mesh(
      new THREE.SphereGeometry(OCEAN_R, 96, 72),
      new THREE.MeshStandardMaterial({ color: 0x1e6f9e, roughness: 0.52, metalness: 0.02 })
    );
    root.add(ocean);
    foam = new THREE.Mesh(
      new THREE.SphereGeometry(OCEAN_R + 0.0035, 96, 72),
      new THREE.MeshBasicMaterial({ map: coastFoamTexture(), transparent: true, depthWrite: false, opacity: 0.5 })
    );
    foam.renderOrder = 1;
    root.add(foam);

    features = new THREE.Group();
    root.add(features);

    const atmMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main(){
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vN; varying vec3 vV;
        void main(){
          float rim = pow(1.0 - max(dot(vN, vV), 0.0), 2.6);
          gl_FragColor = vec4(vec3(0.42,0.68,0.95), rim * 0.5);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide
    });
    atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.13, 64, 48), atmMat);
    atmosphere.renderOrder = 3;
    scene.add(atmosphere);

    halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getGlow(),
        color: 0x3f7fb4,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    halo.scale.set(3.1, 3.1, 1);
    scene.add(halo);

    resize();
  }

  function clearFeatures() {
    const geos = new Set();
    const mats = new Set();
    features.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
    });
    features.clear();
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => {
      if (m.map && m.map !== getGlow() && m.map !== getShadow() && m.map !== fallTexture) m.map.dispose();
      m.dispose();
    });
    animations = [];
  }

  function applyTheme(next) {
    theme = next;
    if (!supported || !renderer || !next?.palette) return;
    clearFeatures();
    const pal = next.palette;
    const terrain = buildTerrain(pal);
    features.add(terrain);
    const spots = treeSpots(pal, next.id === 'tang' ? 210 : 430, next.id === 'tang' ? 41 : 17);
    features.add(buildTrees(pal, spots));
    buildStructures(next, features, animations);
    const falls = [
      [0.232, 30],
      [0.243, 12],
      [0.252, -4]
    ];
    falls.forEach(([lon, lat]) => features.add(waterfall(lon, lat, animations)));
    canvas.setAttribute('aria-label', next.aria);
    if (reduced) renderOnce();
  }

  function animate(now) {
    animations.forEach((a) => {
      if (a.type === 'wheel') {
        a.mesh.rotation.z = reduced ? 0.55 : ((now * 0.001) * a.speed) % TAU;
      } else if (a.type === 'fire') {
        if (reduced) {
          a.flame.scale.set(0.036, 0.054, 1);
          a.core.scale.set(0.02, 0.03, 1);
          a.light.intensity = 0.06;
        } else {
          const t = now * 0.004;
          a.flame.scale.set(0.036, 0.054 * (0.88 + Math.sin(t * 2.2) * 0.14), 1);
          a.core.scale.set(0.02, 0.03 * (0.9 + Math.sin(t * 2.9) * 0.12), 1);
          a.light.intensity = 0.05 + Math.sin(t * 3.1) * 0.02;
        }
      } else if (a.type === 'smoke') {
        const k = reduced ? 0.38 : (((now * 0.001 * a.speed + a.phase) % 1) + 1) % 1;
        a.sprite.position.y = a.baseY + k * a.rise;
        a.sprite.material.opacity = a.baseOpacity * (1 - k) * (0.5 + k);
        a.sprite.scale.setScalar(a.baseScale * (1 + k * 1.6));
      } else if (a.type === 'fall') {
        if (!reduced) a.tex.offset.y = (now * 0.0006) % 1;
      } else if (a.type === 'boat') {
        a.mesh.rotation.z = reduced ? 0 : Math.sin(now * 0.0008 + a.phase) * 0.035;
      }
    });
  }

  function renderOnce() {
    if (!renderer) return;
    root.rotation.y = yaw;
    root.rotation.x = pitch;
    animate(reduced ? 0 : performance.now());
    renderer.render(scene, camera);
  }

  function frame(now) {
    raf = 0;
    if (!active || !renderer) return;
    raf = requestAnimationFrame(frame);
    if (now - lastFrame < 16) return;
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (zoomTween) {
      const t = clamp((now - zoomTween.start) / zoomTween.duration, 0, 1);
      const e = zoomTween.ease(t);
      zoom = zoomTween.from + (zoomTween.to - zoomTween.from) * e;
      applyCamera();
      if (t >= 1) {
        const cb = zoomTween.onDone;
        zoomTween = null;
        cb?.();
      }
    } else if (!reduced && !dragging && zoom === 0) {
      yaw += dt * 0.03;
    }
    root.rotation.y = yaw;
    root.rotation.x = pitch;
    animate(now);
    renderer.render(scene, camera);
  }

  function startLoop() {
    if (!supported || !active || raf) return;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function start() {
    active = true;
    if (!supported) return;
    if (reduced) renderOnce();
    else startLoop();
  }

  function stop() {
    active = false;
    stopLoop();
  }

  function resize() {
    if (!renderer) return;
    vw = window.innerWidth;
    vh = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    baseDist = defaultDistance();
    applyCamera();
    if (reduced && active) renderOnce();
  }

  function flyTo(to, duration, onDone) {
    if (!supported) {
      onDone?.();
      return;
    }
    const ease = to > zoom ? (t) => t * t * t : (t) => 1 - Math.pow(1 - t, 3);
    zoomTween = { from: zoom, to, start: performance.now(), duration: reduced ? 120 : duration, ease, onDone };
    if (reduced) {
      zoom = to;
      applyCamera();
      renderOnce();
      const cb = zoomTween.onDone;
      zoomTween = null;
      cb?.();
      return;
    }
    startLoop();
  }

  function endPointer(event) {
    if (!pointer) return;
    const tap =
      pointer.moved < 6 &&
      performance.now() - pointer.startedAt < 600 &&
      isPointOnGlobe(pointer.startX, pointer.startY) &&
      !document.hidden;
    pointer = null;
    dragging = false;
    canvas.classList.remove('is-dragging');
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (tap) onActivate?.();
  }

  try {
    buildRenderer();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', (e) => {
      if (zoom > 0.05) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointer = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: 0, startedAt: performance.now() };
      dragging = true;
      canvas.classList.add('is-dragging');
      canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const dx = e.clientX - pointer.lastX;
      const dy = e.clientY - pointer.lastY;
      pointer.lastX = e.clientX;
      pointer.lastY = e.clientY;
      pointer.moved += Math.abs(dx) + Math.abs(dy);
      yaw += dx * 0.005;
      pitch = clamp(pitch + dy * 0.0032, -0.7, 0.7);
      if (reduced) renderOnce();
    });
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate?.();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopLoop();
      else if (active) start();
    });
  } catch (error) {
    console.warn('文明专注：WebGL 地球初始化失败', error);
    showFallback();
  }

  return {
    setTheme: applyTheme,
    setActive(next) {
      if (next) start();
      else stop();
    },
    setReduced(next) {
      reduced = next;
      if (!active) return;
      if (reduced) {
        stopLoop();
        renderOnce();
      } else startLoop();
    },
    resize,
    isSupported: () => supported,
    zoomIn: (duration, cb) => flyTo(1, duration, cb),
    zoomOut: (duration, cb) => flyTo(0, duration, cb),
    setZoom(v) {
      zoom = v;
      applyCamera();
      if (reduced) renderOnce();
    }
  };
}
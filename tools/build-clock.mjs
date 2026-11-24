// Rebuild with node tools/build-clock.mjs. The dial is horizontal, with +Y up.
import fs from 'node:fs/promises';
import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const tau = 2 * Math.PI;
const group = (name) => Object.assign(new T.Group(), { name });
const metal = (name, color, metalness, roughness) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness });
const brass = metal('Satin champagne', '#b98749', 0.76, 0.38);
const gold = metal('Polished edges', '#f3d39c', 0.75, 0.24);
const dial = metal('Deep petrol enamel', '#12474b', 0.48, 0.29);
const dark = metal('Recessed gunmetal', '#152631', 0.5, 0.45);
const blue = metal('Blued steel', '#103a55', 0.62, 0.28);
const copper = metal('Red bronze', '#ab6749', 0.68, 0.36);
const ivory = metal('Ivory lacquer', '#eee0ba', 0.22, 0.4);
const ruby = metal('Ruby bearing', '#a12842', 0.3, 0.22);

function mesh(parent, geometry, material, x, y, z, angle = 0) {
  const part = new T.Mesh(geometry, material);
  part.position.set(x, y, z);
  part.rotation.y = angle;
  parent.add(part);
  return part;
}
function disc(parent, x, z, radius, top, height, material, segments = 48) {
  mesh(
    parent,
    new T.CylinderGeometry(radius, radius, height, segments),
    material,
    x,
    top - height / 2,
    z,
  );
}
function ring(parent, x, z, inner, outer, y, material, segments = 96) {
  mesh(parent, new T.RingGeometry(inner, outer, segments).rotateX(-Math.PI / 2), material, x, y, z);
}
function slab(parent, x, z, length, width, y, height, material, angle = 0) {
  mesh(parent, new T.BoxGeometry(length, height, width), material, x, y, z, angle);
}
function engravedBand(parent, radius, y, amplitude, phase, material) {
  const positions = [],
    indices = [],
    segments = 384;
  for (let i = 0; i <= segments; i++) {
    const a = (tau * i) / segments;
    const r = radius + amplitude * Math.cos(24 * a + phase);
    for (const edge of [-0.006, 0.006])
      positions.push((r + edge) * Math.cos(a), 0, -(r + edge) * Math.sin(a));
    if (i > 0) {
      const n = 2 * i;
      indices.push(n - 2, n - 1, n, n, n - 1, n + 1);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  mesh(parent, geo, material, 0, y, 0);
}
function profile(points, depth) {
  const outline = new T.Shape();
  points.forEach(([x, z], i) => (i ? outline.lineTo(x, -z) : outline.moveTo(x, -z)));
  outline.closePath();
  return new T.ExtrudeGeometry(outline, { depth, bevelEnabled: false }).rotateX(-Math.PI / 2);
}
// Merge only rigid pieces in the same pivot's coordinates. Separate pivots survive export.
function batch(parent) {
  const sets = new Map();
  for (const part of [...parent.children]) {
    if (!part.isMesh) continue;
    part.updateMatrix();
    const geom = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    geom.deleteAttribute('uv');
    geom.applyMatrix4(part.matrix);
    if (!sets.has(part.material)) sets.set(part.material, []);
    sets.get(part.material).push(geom);
    parent.remove(part);
  }
  for (const [material, pieces] of sets) {
    parent.add(new T.Mesh(mergeVertices(mergeGeometries(pieces)), material));
  }
}

const root = group('TerraTockClock');
const body = group('Dial');
root.add(body);
disc(body, 0, 0, 3.32, -0.095, 0.069, dark, 128);
const caseProfile = [
  [3.18, -0.164],
  [3.3, -0.16],
  [3.41, -0.085],
  [3.42, -0.049],
  [3.42, 0.035],
  [3.38, 0.076],
  [3.32, 0.102],
  [3.25, 0.108],
  [3.21, 0.083],
];
mesh(
  body,
  new T.LatheGeometry(
    caseProfile.map(([r, y]) => new T.Vector2(r, y)),
    128,
  ),
  brass,
  0,
  0,
  0,
);
disc(body, 0, 0, 3.25, -0.058, 0.045, dial, 128);
ring(body, 0, 0, 2.35, 3.235, 0.022, dial);
ring(body, 0, 0, 2.36, 2.39, 0.024, gold);
engravedBand(body, 2.515, 0.026, 0.069, 0, brass);
engravedBand(body, 2.515, 0.027, 0.069, Math.PI, copper);
ring(body, 0, 0, 2.675, 2.692, 0.024, copper);
ring(body, 0, 0, 3.12, 3.145, 0.038, gold);
ring(body, 0, 0, 3.24, 3.3, 0.11, dark);
ring(body, 0, 0, 3.265, 3.285, 0.111, gold);
for (let i = 0; i < 120; i++) {
  const a = (tau * i) / 120;
  const major = i % 10 === 0;
  const length = major ? 0.205 : i % 2 === 0 ? 0.116 : 0.053;
  const r = 3.1 - length / 2;
  slab(
    body,
    r * Math.cos(a),
    -r * Math.sin(a),
    length,
    major ? 0.042 : 0.014,
    0.042,
    0.01,
    major ? ivory : brass,
    a,
  );
}
// Engraved upright Roman hour indices, drawn in brass strokes on the outer chapter ring.
const roman = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const letters = {
  I: [[0, -0.5, 0, 0.5]],
  V: [
    [-0.36, -0.5, 0, 0.5],
    [0, 0.5, 0.36, -0.5],
  ],
  X: [
    [-0.36, -0.5, 0.36, 0.5],
    [0.36, -0.5, -0.36, 0.5],
  ],
};
for (let i = 0; i < 12; i++) {
  const a = (tau * i) / 12;
  const label = roman[i],
    radius = 2.825,
    height = 0.176,
    pitch = 0.14;
  for (let k = 0; k < label.length; k++)
    for (const [x0, z0, x1, z1] of letters[label[k]]) {
      const dx = (x1 - x0) * height,
        dz = (z1 - z0) * height;
      const x = radius * Math.sin(a) + (k - (label.length - 1) / 2) * pitch + ((x0 + x1) * height) / 2;
      const z = -radius * Math.cos(a) + ((z0 + z1) * height) / 2;
      slab(body, x, z, Math.hypot(dx, dz), 0.025, 0.031, 0.012, ivory, -Math.atan2(dz, dx));
    }
}
for (let i = 0; i < 72; i++) {
  const a = (tau * i) / 72;
  slab(
    body,
    3.37 * Math.cos(a),
    -3.37 * Math.sin(a),
    0.063,
    0.017,
    0.08,
    0.009,
    i % 6 === 0 ? gold : copper,
    a,
  );
}

const tracks = [];
function rotationTrack(name, angles, duration) {
  const times = [],
    values = [];
  angles.forEach((a, i) => {
    times.push((i * duration) / (angles.length - 1));
    values.push(0, Math.sin(a / 2), 0, Math.cos(a / 2));
  });
  return new T.QuaternionKeyframeTrack(name + '.quaternion', times, values);
}
const period = 36;
// All wheels use the same tooth pitch. Their angular speeds are inversely proportional to tooth count.
function wheel(name, x, z, teeth, turns, phase, material) {
  const g = group(name),
    radius = teeth * 0.025,
    toothDepth = 0.032;
  root.add(g);
  g.position.set(x, 0, z);
  const outline = new T.Shape();
  for (let i = 0; i < teeth; i++)
    for (const [offset, dr] of [
      [0, -1],
      [0.17, -1],
      [0.32, 1],
      [0.65, 1],
      [0.82, -1],
    ]) {
      const a = (tau * (i + offset)) / teeth;
      const px = (radius + dr * toothDepth) * Math.cos(a),
        py = (radius + dr * toothDepth) * Math.sin(a);
      if (i === 0 && offset === 0) outline.moveTo(px, py);
      else outline.lineTo(px, py);
    }
  outline.closePath();
  const hole = new T.Path();
  hole.absarc(0, 0, radius * 0.74, 0, tau, true);
  outline.holes.push(hole);
  const geo = new T.ExtrudeGeometry(outline, {
    depth: 0.043,
    bevelEnabled: false,
    curveSegments: 24,
  }).rotateX(-Math.PI / 2);
  mesh(g, geo, material, 0, -0.043, 0);
  ring(g, 0, 0, radius * 0.77, radius * 0.8, 0.002, gold, 56);
  ring(g, 0, 0, radius * 0.9, radius * 0.913, 0.002, gold, 64);
  for (let i = 0; i < 5; i++) {
    const a = (tau * i) / 5;
    slab(
      g,
      radius * 0.45 * Math.cos(a),
      -radius * 0.45 * Math.sin(a),
      radius * 0.73,
      radius * 0.1,
      -0.023,
      0.035,
      material,
      a,
    );
  }
  disc(g, 0, 0, radius * 0.22, 0.011, 0.047, material, 32);
  ring(g, 0, 0, radius * 0.161, radius * 0.186, 0.012, gold, 32);
  disc(g, 0, 0, radius * 0.11, 0.023, 0.015, ruby, 24);
  disc(g, radius * 0.8, 0, 0.035, 0.009, 0.012, ivory, 12);
  batch(g);
  const steps = Math.abs(turns) * 6;
  tracks.push(
    rotationTrack(
      name,
      Array.from({ length: steps + 1 }, (_, i) => phase + (turns * tau * i) / steps),
      period,
    ),
  );
}
// Adjacent pitch circles are tangent. Choose each initial phase so a tooth faces a gap.
const train = [
  { name: 'BarrelWheel', teeth: 36, turns: 2, x: -1.33, z: -0.4, material: brass },
  { name: 'TransferWheel', teeth: 24, turns: -3, bearing: 1.12, material: copper },
  { name: 'ThirdWheel', teeth: 36, turns: 2, bearing: 0.12, material: brass },
  { name: 'EscapeWheel', teeth: 18, turns: -4, bearing: -1.25, material: ivory },
];
for (const [i, w] of train.entries()) {
  w.phase = 0;
  if (i) {
    const p = train[i - 1],
      d = 0.025 * (p.teeth + w.teeth),
      a = w.bearing;
    w.x = p.x + Math.cos(a) * d;
    w.z = p.z + Math.sin(a) * d;
    const contact = ((-a - p.phase) * p.teeth) / tau;
    w.phase = Math.PI - a - ((0.5 - contact) * tau) / w.teeth;
  }
  disc(body, w.x, w.z, w.teeth * 0.025 + 0.065, -0.052, 0.018, dark, 64);
  wheel(w.name, w.x, w.z, w.teeth, w.turns, w.phase, w.material);
}

// The bridge spans the first pair of bearings, just above the moving wheels.
function bearingBridge(wheel, anchorX, anchorZ) {
  const dx = anchorX - wheel.x,
    dz = anchorZ - wheel.z;
  const angle = -Math.atan2(dz, dx),
    length = Math.hypot(dx, dz);
  slab(body, (anchorX + wheel.x) / 2, (anchorZ + wheel.z) / 2, length, 0.086, 0.031, 0.022, blue, angle);
  slab(
    body,
    (anchorX + wheel.x) / 2,
    (anchorZ + wheel.z) / 2,
    length,
    0.019,
    0.044,
    0.004,
    brass,
    angle,
  );
  for (const [x, z] of [
    [anchorX, anchorZ],
    [wheel.x, wheel.z],
  ]) {
    disc(body, x, z, 0.092, 0.049, 0.02, brass, 32);
    disc(body, x, z, 0.054, 0.054, 0.011, dark, 24);
    slab(body, x, z, 0.071, 0.012, 0.062, 0.01, gold, angle - 0.36);
  }
}
bearingBridge(train[0], -1.74, -1.3);
bearingBridge(train[1], -1.23, 1.68);

const balance = group('BalanceWheel');
root.add(balance);
balance.position.set(-0.38, 0, -1.56);
disc(body, -0.38, -1.56, 0.55, -0.045, 0.018, dark);
ring(balance, 0, 0, 0.395, 0.47, 0.014, gold, 48);
for (let i = 0; i < 3; i++) {
  const a = (tau * i) / 3;
  slab(balance, 0.23 * Math.cos(a), -0.23 * Math.sin(a), 0.43, 0.053, 0.013, 0.024, copper, a);
  disc(balance, 0.43 * Math.cos(a), -0.43 * Math.sin(a), 0.048, 0.031, 0.019, ivory, 16);
}
disc(balance, 0, 0, 0.1, 0.043, 0.033, brass, 24);
disc(balance, 0, 0, 0.052, 0.052, 0.015, ruby, 20);
batch(balance);
tracks.push(
  rotationTrack(
    'BalanceWheel',
    Array.from({ length: 36 * 24 + 1 }, (_, i) => 0.58 * Math.sin((tau * i) / 24)),
    period,
  ),
);

// Off-centre hour register leaves the main minute hand free to carry the landscape.
const hx = 1.02,
  hz = -1.22;
disc(body, hx, hz, 0.7, 0.004, 0.052, brass, 72);
disc(body, hx, hz, 0.647, 0.013, 0.014, ivory, 72);
ring(body, hx, hz, 0.47, 0.478, 0.016, copper, 64);
for (let i = 0; i < 12; i++) {
  const a = (tau * i) / 12;
  slab(
    body,
    hx + 0.563 * Math.cos(a),
    hz - 0.563 * Math.sin(a),
    i % 3 === 0 ? 0.121 : 0.063,
    0.029,
    0.019,
    0.01,
    blue,
    a,
  );
}
const hour = group('HourHandPivot');
root.add(hour);
hour.position.set(hx, 0, hz);
mesh(
  hour,
  profile(
    [
      [-0.13, -0.025],
      [0.16, -0.072],
      [0.52, 0],
      [0.16, 0.072],
      [-0.13, 0.025],
    ],
    0.015,
  ),
  blue,
  0,
  0.026,
  0,
);
disc(body, hx, hz, 0.056, 0.05, 0.025, gold, 24);

const focus = group('FocusHandPivot'),
  seconds = group('SecondsHandPivot');
root.add(focus, seconds);
const deck = [
  [-0.3, -0.075],
  [0.32, -0.17],
  [0.54, -0.413],
  [1.09, -0.418],
  [2.58, -0.28],
  [2.96, -0.127],
  [3.22, 0],
  [2.96, 0.127],
  [2.58, 0.28],
  [1.09, 0.418],
  [0.54, 0.413],
  [0.32, 0.17],
  [-0.3, 0.075],
];
for (const [s, y, h, mat] of [
  [1, 0.12, 0.084, brass],
  [0.98, 0.204, 0.027, gold],
  [0.94, 0.231, 0.057, blue],
  [0.91, 0.288, 0.016, dark],
]) {
  mesh(
    focus,
    profile(
      deck.map(([x, z]) => [x * s, z * s * 1.43]),
      h,
    ),
    mat,
    0,
    y,
    0,
  );
}
for (const side of [-1, 1]) {
  const rail = [
    [0.53, 0.35],
    [0.67, 0.378],
    [1.04, 0.374],
    [2.49, 0.239],
    [2.87, 0.112],
    [2.58, 0.244],
    [1.04, 0.39],
    [0.66, 0.394],
  ];
  mesh(
    focus,
    profile(
      rail.map(([x, z]) => [x, side * z * 1.43]),
      0.004,
    ),
    gold,
    0,
    0.301,
    0,
  );
}
mesh(
  focus,
  profile(
    [
      [2.73, -0.051],
      [3.11, 0],
      [2.73, 0.051],
    ],
    0.012,
  ),
  ivory,
  0,
  0.263,
  0,
);
for (const sign of [-1, 1])
  for (let i = 0; i < 5; i++) {
    const x = 0.65 + i * 0.41,
      z = sign * (0.374 - i * 0.021) * 1.43;
    disc(focus, x, z, 0.021, 0.258, 0.013, gold, 16);
  }
const anchor = group('CivilizationMount');
focus.add(anchor);
anchor.position.set(1.82, 0.3045, 0);
mesh(
  seconds,
  profile(
    [
      [-0.57, -0.025],
      [-0.2, -0.054],
      [0.28, -0.042],
      [2.98, -0.018],
      [3.095, 0],
      [2.98, 0.018],
      [0.28, 0.042],
      [-0.2, 0.054],
      [-0.57, 0.025],
    ],
    0.015,
  ),
  copper,
  0,
  0.079,
  0,
);
slab(seconds, 1.92, 0, 1.94, 0.018, 0.096, 0.006, ivory);
ring(seconds, -0.46, 0, 0.078, 0.12, 0.096, gold, 36);
disc(body, 0, 0, 0.23, 0.244, 0.12, brass);
disc(body, 0, 0, 0.166, 0.261, 0.026, blue);
disc(body, 0, 0, 0.079, 0.277, 0.021, gold);
disc(body, 0, 0, 0.048, 0.283, 0.014, ruby, 24);
for (const part of [body, focus, seconds, hour]) batch(part);

// Set an open display pose for static viewers. TerraTock overrides all hands on the first frame.
focus.rotation.y = Math.PI / 6;
seconds.rotation.y = 2.14;
hour.rotation.y = -0.65;
class BlobReader {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
}
globalThis.FileReader = BlobReader;
const glb = await new GLTFExporter().parseAsync(root, {
  binary: true,
  animations: [new T.AnimationClip('Clockwork', period, tracks)],
});
await fs.writeFile(
  new URL('../src/assets/models/terratock-clock.glb', import.meta.url),
  Buffer.from(glb),
);

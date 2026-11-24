import * as T from 'three';
import { SCENES } from './scene-catalog.mjs';

// Each strip is read from the broad heel of the hand towards its tip.
// The old village occupies the centre. These plots extend its two banks.
const PLACES = {
  stone: ['pine camp copse rack camp', 'pool jetty knap hides reeds', '#78855b', '#bd9565'],
  zhoukoudian: ['crag pine knap copse crag', 'knap pool hides jetty reeds', '#718361', '#a8a185'],
  olduvai: ['acacia crag scrub knap acacia', 'hides pool reeds knap scrub', '#ab965f', '#ae7954'],
  vezere: ['pine copse camp crag pine', 'jetty hides pool knap rack', '#72896b', '#baab8b'],
  patagonia: ['crag scrub hides crag camp', 'knap reeds pool jetty hides', '#a28e75', '#ba8768'],
  tang: ['farm orchard barn farm orchard', 'paddy bridge greens market paddy', '#8f995f', '#525e60'],
  nile: ['palm mudhouse palm silo mudhouse', 'canal jetty greens market reeds', '#ac995e', '#ba9468'],
  andes: ['terrace barn terrace farm copse', 'terrace steps greens market terrace', '#839064', '#8c775e'],
  valencia: ['orchard villa orchard barn villa', 'canal bridge orchard market greens', '#909858', '#ba704d'],
  steam: ['mill terracehouse tank shed mill', 'rail freight platform rail freight', '#788078', '#965d4f'],
  manchester: [
    'terracehouse mill shed mill terracehouse',
    'canal jetty freight bridge canal',
    '#7a8377',
    '#985c47',
  ],
  ruhr: ['tank gantry shed mill tank', 'rail slag freight rail platform', '#777c67', '#785d50'],
  yokohama: ['shed gantry mill shed tank', 'harbor jetty freight harbor jetty', '#788782', '#a35f4f'],
  lowell: ['mill tank terracehouse mill shed', 'canal bridge freight canal platform', '#808a78', '#aa6956'],
  kimberley: ['scrub gantry shed gantry tank', 'slag rail freight slag platform', '#ab906f', '#8d6b52'],
  information: ['office lab tower lab office', 'plaza tram solar park stop', '#788d81', '#547f88'],
  helsinki: ['office copse wharf lab wharf', 'harbor jetty cycle park harbor', '#7b918a', '#7c9ca9'],
  nairobi: ['maker acacia lab maker acacia', 'market solar plaza stop park', '#958e70', '#bb8163'],
  silicon: ['lab park office lab copse', 'cycle solar park stop plaza', '#8c9c76', '#77969c'],
  shenzhen: ['tower maker office tower maker', 'market tram plaza stop market', '#7d9081', '#4b8792'],
};

const stone = '#878274',
  wood = '#79614a',
  timber = '#ac895a',
  linen = '#e1c89b';
const iron = '#465761',
  copper = '#aa7252',
  glass = '#80adba',
  light = '#e7c587';
const leaves = ['#496956', '#648257', '#8c9b63'];
const wet = '#658f94',
  loam = '#89724d',
  brick = '#a46d53';
const forms = {
  box: new T.BoxGeometry(),
  pole: new T.CylinderGeometry(0.5, 0.5, 1, 8),
  peak: new T.ConeGeometry(0.5, 1, 8),
  rock: new T.IcosahedronGeometry(0.5, 0),
};
const colorCache = new Map();

// Bake repeated small parts into one opaque mesh per district to keep draw calls low.
class Batch {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.indices = [];
    this.transform = new T.Object3D();
    this.normal = new T.Matrix3();
    this.v = new T.Vector3();
  }
  add(form, x, y, z, w, h, d, tint, rx = 0, ry = 0, rz = 0) {
    const g = forms[form],
      t = this.transform;
    t.position.set(x, y, z);
    t.rotation.set(rx, ry, rz);
    t.scale.set(w, h, d);
    t.updateMatrix();
    this.normal.getNormalMatrix(t.matrix);
    if (!colorCache.has(tint)) colorCache.set(tint, new T.Color(tint));
    const c = colorCache.get(tint),
      offset = this.positions.length / 3;
    for (let i = 0; i < g.attributes.position.count; i++) {
      this.v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(t.matrix);
      this.positions.push(this.v.x, this.v.y, this.v.z);
      this.v.fromBufferAttribute(g.attributes.normal, i).applyNormalMatrix(this.normal);
      this.normals.push(this.v.x, this.v.y, this.v.z);
      this.colors.push(Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255));
    }
    for (let i = 0; i < (g.index?.count ?? g.attributes.position.count); i++)
      this.indices.push(offset + (g.index ? g.index.getX(i) : i));
  }
  box(x, y, z, w, h, d, c, rx = 0, ry = 0, rz = 0) {
    this.add('box', x, y, z, w, h, d, c, rx, ry, rz);
  }
  pole(x, y, z, w, h, d, c) {
    this.add('pole', x, y, z, w, h, d, c);
  }
  rock(x, y, z, w, h, d, c, angle = 0) {
    this.add('rock', x, y, z, w, h, d, c, 0, angle);
  }
  beam(a, b, width, tint) {
    const [x, y, z] = a,
      dx = b[0] - x,
      dy = b[1] - y,
      dz = b[2] - z,
      n = Math.hypot(dx, dy, dz);
    this.add(
      'box',
      x + dx / 2,
      y + dy / 2,
      z + dz / 2,
      width,
      n,
      width,
      tint,
      Math.atan2(dz, dy),
      0,
      -Math.asin(dx / n),
    );
  }
  mesh(name, material) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new T.Uint8BufferAttribute(this.colors, 3, true));
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    const mesh = new T.Mesh(g, material);
    mesh.name = name;
    return mesh;
  }
}

function seeded(id) {
  let state = [...id].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) | 0, 7);
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Upper surface of the enlarged hand is narrower toward its tip.
const halfDepth = (x) => 0.55 - (x + 1.18) * 0.125;
function embankment(parent, material, turf) {
  const outline = [
    [-1.27, -0.34],
    [-1.18, -0.54],
    [-0.88, -0.55],
    [-0.41, -0.47],
    [0.28, -0.37],
    [0.74, -0.3],
    [0.9, -0.22],
    [0.97, -0.1],
    [0.96, 0.12],
    [0.84, 0.24],
    [0.53, 0.31],
    [-0.1, 0.4],
    [-0.58, 0.5],
    [-1.02, 0.54],
    [-1.23, 0.46],
    [-1.28, 0.28],
  ];
  const polygon = new T.Shape(outline.map(([x, z]) => new T.Vector2(x, -z)));
  const g = new T.ExtrudeGeometry(polygon, {
    depth: 0.011,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.004,
    bevelThickness: 0.003,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.004, 0);
  const colors = [],
    top = new T.Color(turf),
    edge = new T.Color('#676858');
  for (let i = 0; i < g.attributes.position.count; i++) {
    const col = g.attributes.normal.getY(i) > 0.65 ? top : edge;
    colors.push(col.r, col.g, col.b);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  const mesh = new T.Mesh(g, material);
  mesh.name = 'SettlementEmbankment';
  parent.add(mesh);
}

function tree(b, x, z, s, kind, rng) {
  b.pole(x, 0.013 + s * 0.4, z, s * 0.1, s * 0.8, s * 0.1, wood);
  const crown = 0.014 + s * 0.8;
  if (kind === 'pine') {
    for (let j = 0; j < 3; j++)
      b.add(
        'peak',
        x,
        crown + s * (j * 0.18 - 0.19),
        z,
        s * (0.77 - 0.14 * j),
        s * 0.66,
        s * (0.79 - 0.15 * j),
        leaves[j],
      );
  } else if (kind === 'palm') {
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      b.rock(
        x + Math.sin(a) * s * 0.23,
        crown,
        z + Math.cos(a) * s * 0.23,
        s * 0.18,
        s * 0.13,
        s * 0.72,
        leaves[j % 3],
        a,
      );
    }
  } else {
    for (let j = 0; j < 4; j++) {
      const a = j * 2 + rng() * 0.4,
        flat = kind === 'acacia';
      b.rock(
        x + Math.cos(a) * s * 0.22,
        crown + s * (j % 2) * 0.12,
        z + Math.sin(a) * s * 0.17,
        s * (flat ? 1 : 0.76),
        s * (flat ? 0.35 : 0.67),
        s * (flat ? 0.8 : 0.67),
        leaves[j % 3],
        a,
      );
    }
  }
}

function roof(b, x, eave, z, w, d, rise, tint) {
  const length = Math.hypot(d / 2, rise),
    angle = Math.atan2(rise, d / 2);
  for (const side of [-1, 1])
    b.box(x, eave + rise / 2, z + (side * d) / 4, w, 0.009, length, tint, side * angle);
  b.box(x, eave + rise, z, w + 0.008, 0.009, 0.013, tint);
}
function house(b, x, z, w, h, d, wall, cover, flat = false) {
  b.box(x, 0.013 + h / 2, z, w, h, d, wall);
  if (flat) {
    b.box(x, 0.015 + h, z, w + 0.012, 0.012, d + 0.012, cover);
    for (const side of [-1, 1]) b.box(x, 0.03 + h, z + (side * d) / 2, w, 0.023, 0.008, wall);
  } else roof(b, x, h + 0.012, z, w + 0.021, d + 0.023, 0.038, cover);
  b.box(x - w * 0.18, 0.039, z + d / 2, 0.026, 0.054, 0.005, wood);
  b.box(x + w * 0.24, h * 0.65, z + d / 2, 0.023, 0.026, 0.006, '#526567');
  b.box(x + w * 0.24, h * 0.65 - 0.015, z + d / 2 + 0.002, 0.03, 0.005, 0.009, timber);
  b.box(x - w * 0.18, 0.02, z + d / 2 + 0.011, 0.036, 0.013, 0.02, stone);
  if (!flat && w > 0.095) {
    for (const dx of [-0.4, 0.4]) b.box(x + dx * w, 0.012 + h / 2, z + d / 2 + 0.002, 0.006, h, 0.006, wood);
    for (const side of [-1, 1]) {
      for (let j = 1; j <= 3; j++)
        b.box(
          x - w / 2 + (w * j) / 4,
          h + 0.012 + 0.019,
          z + (side * (d + 0.023)) / 4,
          0.004,
          0.005,
          Math.hypot((d + 0.023) / 2, 0.038),
          cover,
          side * Math.atan2(0.038, (d + 0.023) / 2),
        );
    }
  }
}
function rack(b, x, z, tint) {
  for (const dx of [-0.085, 0.085]) {
    for (const dz of [-0.031, 0.031]) b.beam([x + dx, 0.012, z + dz], [x + dx, 0.111, z], 0.009, wood);
  }
  b.box(x, 0.109, z, 0.19, 0.009, 0.009, timber);
  for (let i = 0; i < 6; i++)
    b.rock(x - 0.064 + i * 0.025, 0.08 + (i % 2) * 0.006, z, 0.022, 0.047, 0.011, tint, i * 0.2);
}
function crates(b, x, z) {
  for (const [dx, dz, level] of [
    [-0.043, 0.01, 0],
    [0.005, 0.013, 0],
    [-0.02, -0.03, 0],
    [-0.024, 0.012, 1],
    [0.061, 0, 0],
  ]) {
    const y = 0.033 + level * 0.038;
    b.box(x + dx, y, z + dz, 0.045, 0.037, 0.034, timber);
    for (const k of [-1, 1]) b.box(x + dx + k * 0.014, y, z + dz + 0.018, 0.004, 0.036, 0.003, wood);
  }
}
function stall(b, x, z, shade) {
  for (const dx of [-0.056, 0.056])
    for (const dz of [-0.025, 0.025]) b.pole(x + dx, 0.051, z + dz, 0.006, 0.084, 0.006, wood);
  for (let i = 0; i < 6; i++)
    b.box(x - 0.06 + i * 0.024, 0.092, z, 0.024, 0.008, 0.076, i % 2 ? linen : shade, -0.09);
  b.box(x, 0.042, z + 0.012, 0.125, 0.011, 0.034, timber);
  for (let i = 0; i < 5; i++)
    b.rock(x - 0.048 + i * 0.023, 0.054, z + 0.012, 0.02, 0.017, 0.021, i % 2 ? '#9ca462' : '#be7951');
}
function stonePlot(b, kind, x, z, tint, rng) {
  switch (kind) {
    case 'camp':
      for (const [dx, dz, s] of [
        [-0.063, 0.012, 1],
        [0.067, -0.012, 0.73],
      ]) {
        b.add('peak', x + dx, 0.014 + 0.075 * s, z + dz, 0.143 * s, 0.15 * s, 0.125 * s, tint, 0, 0.3);
        b.box(x + dx, 0.047, z + dz + 0.04 * s, 0.03, 0.055, 0.01, wood, -0.34);
        b.beam(
          [x + dx - 0.055 * s, 0.014, z + dz + 0.04 * s],
          [x + dx + 0.008, 0.18 * s, z + dz],
          0.006,
          timber,
        );
      }
      break;
    case 'crag':
      for (let i = 0; i < 7; i++) {
        const h = 0.09 + rng() * 0.13;
        b.rock(
          x - 0.115 + i * 0.039,
          0.012 + h * 0.36,
          z + rng() * 0.028,
          0.09 + rng() * 0.09,
          h,
          0.105,
          i % 2 ? tint : stone,
          i,
        );
      }
      break;
    case 'knap':
      b.rock(x, 0.032, z, 0.115, 0.049, 0.075, stone);
      for (let i = 0; i < 10; i++)
        b.rock(
          x + (rng() - 0.5) * 0.18,
          0.021,
          z + (rng() - 0.5) * 0.075,
          0.014 + rng() * 0.018,
          0.017,
          0.022,
          i % 3 ? stone : '#b5aaa0',
          i,
        );
      b.box(x + 0.072, 0.03, z, 0.052, 0.026, 0.029, wood);
      break;
    case 'rack':
    case 'hides':
      rack(b, x, z, tint);
      break;
  }
}
function farmPlot(b, kind, x, z, tint, rng) {
  switch (kind) {
    case 'farm':
    case 'barn':
    case 'villa':
    case 'mudhouse':
      house(
        b,
        x - 0.034,
        z,
        0.128,
        kind === 'barn' ? 0.11 : 0.085,
        0.079,
        kind === 'mudhouse' ? '#bb9d74' : linen,
        tint,
        kind === 'mudhouse',
      );
      if (kind === 'barn') crates(b, x + 0.09, z + 0.022);
      else
        house(
          b,
          x + 0.085,
          z - 0.015,
          0.071,
          0.055,
          0.06,
          kind === 'mudhouse' ? '#c4a77d' : '#ccb58a',
          tint,
          kind === 'mudhouse',
        );
      break;
    case 'silo':
      for (let i = 0; i < 3; i++) {
        const dx = (i - 1) * 0.073;
        b.pole(x + dx, 0.078, z, 0.072, 0.13, 0.072, '#b69a70');
        b.add('peak', x + dx, 0.164, z, 0.086, 0.045, 0.086, linen);
        b.box(x + dx, 0.034, z + 0.034, 0.021, 0.038, 0.006, wood);
      }
      break;
    case 'orchard':
      for (let i = 0; i < 4; i++) {
        const tx = x - 0.094 + i * 0.061,
          tz = z + ((i % 2) - 0.5) * 0.042;
        tree(b, tx, tz, 0.092 + rng() * 0.023, 'round', rng);
        for (let j = 0; j < 3; j++)
          b.rock(tx - 0.02 + j * 0.017, 0.113, tz + 0.026, 0.013, 0.014, 0.013, '#cf9655');
      }
      break;
    case 'paddy':
    case 'greens':
    case 'terrace':
      for (let i = 0; i < 3; i++) {
        const tz = z + (i - 1) * 0.036,
          h = 0.016 + (kind === 'terrace' ? (2 - i) * 0.023 : 0);
        b.box(x, h / 2 + 0.009, tz, 0.235 - i * 0.012, h, 0.038, kind === 'terrace' ? stone : loam);
        b.box(x, h + 0.01, tz, 0.222 - i * 0.012, 0.007, 0.031, kind === 'paddy' ? wet : leaves[1]);
        for (let j = 0; j < 9; j++)
          b.rock(
            x - 0.093 + j * 0.023,
            h + 0.023,
            tz,
            0.016,
            0.027,
            0.017,
            kind === 'paddy' ? '#b3a957' : leaves[(i + j) % 3],
            j,
          );
      }
      break;
    case 'steps':
      for (let i = 0; i < 8; i++)
        b.box(x - 0.083 + i * 0.022, 0.013 + i * 0.004, z, 0.024, 0.011 + i * 0.008, 0.08, stone);
      break;
  }
}
function works(b, kind, x, z, tint) {
  switch (kind) {
    case 'mill':
    case 'terracehouse':
    case 'shed': {
      const count = kind === 'terracehouse' ? 3 : 2,
        h = kind === 'mill' ? 0.147 : kind === 'shed' ? 0.071 : 0.087;
      for (let i = 0; i < count; i++) {
        const w = 0.25 / count - 0.006,
          tx = x - 0.125 + w / 2 + i * (w + 0.006);
        house(b, tx, z, w, h, 0.096, tint, iron);
        for (let row = 0; row < (kind === 'mill' ? 3 : 1); row++)
          for (let j = 0; j < 3; j++)
            b.box(
              tx - w * 0.33 + j * w * 0.33,
              h - 0.012 - row * 0.033,
              z + 0.051,
              0.014,
              0.019,
              0.005,
              row % 2 ? glass : light,
            );
      }
      b.pole(x + 0.093, h + 0.049, z - 0.022, 0.03, 0.107, 0.03, brick);
      b.pole(x + 0.093, h + 0.104, z - 0.022, 0.038, 0.012, 0.038, iron);
      break;
    }
    case 'tank':
      for (const dx of [-0.054, 0.033]) {
        b.pole(x + dx, 0.077, z, 0.073, 0.135, 0.073, '#87948d');
        for (let j = 0; j < 4; j++) b.pole(x + dx, 0.024 + j * 0.035, z, 0.078, 0.006, 0.078, iron);
      }
      b.box(x, 0.129, z - 0.027, 0.185, 0.012, 0.011, copper);
      break;
    case 'gantry':
      for (const dx of [-0.08, 0.08])
        for (const dz of [-0.039, 0.039]) {
          b.beam([x + dx, 0.012, z + dz], [x + dx * 0.73, 0.188, z + dz * 0.75], 0.012, iron);
          b.beam([x + dx, 0.028, z + dz], [x - dx * 0.73, 0.153, z + dz * 0.75], 0.006, timber);
        }
      b.box(x, 0.187, z, 0.19, 0.018, 0.084, iron);
      b.box(x + 0.045, 0.183, z + 0.041, 0.011, 0.066, 0.008, wood);
      crates(b, x, z);
      break;
    case 'freight':
      crates(b, x - 0.041, z);
      b.pole(x + 0.064, 0.041, z, 0.042, 0.056, 0.042, copper);
      break;
    case 'slag':
      for (let i = 0; i < 8; i++)
        b.rock(
          x - 0.1 + i * 0.029,
          0.031,
          z + (i % 2) * 0.021,
          0.056,
          0.04 + (i % 3) * 0.016,
          0.061,
          '#59625e',
          i,
        );
      break;
    case 'rail':
    case 'platform':
    case 'tram':
      for (let j = 0; j < 9; j++)
        b.box(x - 0.121 + j * 0.03, 0.018, z, 0.013, 0.009, 0.068, kind === 'tram' ? stone : wood);
      for (const side of [-1, 1]) b.box(x, 0.025, z + side * 0.022, 0.266, 0.008, 0.006, iron);
      if (kind === 'platform') {
        b.box(x, 0.03, z - 0.056, 0.23, 0.041, 0.035, stone);
        stall(b, x, z - 0.056, iron);
      }
      break;
  }
}
function city(b, kind, x, z, tint) {
  switch (kind) {
    case 'office':
    case 'lab':
    case 'tower':
    case 'maker':
    case 'wharf': {
      const floors = { office: 4, lab: 2, tower: 7, maker: 2, wharf: 3 }[kind],
        w = kind === 'tower' ? 0.092 : 0.153;
      b.box(x, 0.018, z, 0.222, 0.012, 0.115, '#a5a699');
      for (let i = 0; i < floors; i++) {
        const set = kind === 'tower' && i > 3 ? 0.017 : 0;
        b.box(x, 0.038 + i * 0.035, z, w - set, 0.031, 0.089 - set, i % 3 ? tint : '#7497a3');
        b.box(x, 0.056 + i * 0.035, z, w - set + 0.011, 0.007, 0.099 - set, '#d0c6ae');
        for (const dx of [-0.3, 0, 0.3])
          b.box(x + dx * (w - set), 0.038 + i * 0.035, z + (0.089 - set) / 2, 0.004, 0.03, 0.004, iron);
      }
      b.box(x + 0.014, 0.044 + floors * 0.035, z - 0.007, 0.033, 0.021, 0.031, iron);
      house(b, x + (kind === 'tower' ? 0.084 : -0.104), z + 0.014, 0.059, 0.047, 0.064, '#b0aca0', iron, true);
      break;
    }
    case 'solar':
    case 'stop':
      for (const dx of [-0.075, 0.075]) b.pole(x + dx, 0.075, z, 0.009, 0.124, 0.009, iron);
      b.box(x, 0.138, z, 0.2, 0.009, 0.078, iron, -0.14);
      for (let i = 0; i < 8; i++)
        b.box(x - 0.084 + i * 0.024, 0.144, z, 0.021, 0.008, 0.074, kind === 'solar' ? '#577b91' : tint, -0.14);
      b.box(x, 0.044, z, 0.107, 0.01, 0.026, timber);
      for (const dx of [-0.04, 0.04]) b.box(x + dx, 0.028, z, 0.007, 0.028, 0.015, iron);
      break;
    case 'park':
    case 'plaza':
    case 'cycle':
      b.box(x, 0.014, z, 0.246, 0.009, 0.107, kind === 'cycle' ? '#96836e' : '#adae99');
      for (let i = 0; i < 3; i++) {
        b.box(x - 0.083 + i * 0.078, 0.025, z - 0.02, 0.057, 0.022, 0.039, stone);
        b.rock(x - 0.083 + i * 0.078, 0.053, z - 0.02, 0.063, 0.05, 0.045, leaves[(i + 1) % 3]);
      }
      b.pole(x + 0.095, 0.07, z + 0.013, 0.005, 0.111, 0.005, iron);
      b.pole(x + 0.095, 0.126, z + 0.013, 0.019, 0.01, 0.019, light);
      break;
  }
}

function waterfront(b, kind, x, z) {
  if (kind === 'reeds') {
    for (let i = 0; i < 15; i++) {
      const dx = ((i % 5) - 2) * 0.024,
        dz = (Math.floor(i / 5) - 1) * 0.021,
        h = 0.045 + (i % 4) * 0.009;
      b.beam([x + dx, 0.013, z + dz], [x + dx + 0.012, h, z + dz], 0.006, leaves[i % 3]);
      if (i % 3 === 0) b.rock(x + dx + 0.012, h, z + dz, 0.009, 0.021, 0.009, wood);
    }
    return;
  }
  if (kind === 'pool') {
    b.pole(x, 0.016, z, 0.22, 0.007, 0.082, wet);
    for (let i = 0; i < 5; i++) b.rock(x - 0.085 + i * 0.042, 0.021, z - 0.035, 0.046, 0.026, 0.026, stone, i);
  } else {
    b.box(x, 0.015, z, 0.258, 0.009, 0.089, wet);
  }
  if (kind === 'jetty' || kind === 'bridge') {
    const deckZ = kind === 'jetty' ? z - 0.023 : z;
    for (let j = 0; j < 8; j++) b.box(x, 0.041, deckZ - 0.066 + j * 0.018, 0.065, 0.012, 0.016, timber);
    for (const dx of [-0.033, 0.033])
      for (const dz of [-0.048, 0.055]) {
        b.pole(x + dx, 0.042, deckZ + dz, 0.009, 0.066, 0.009, wood);
      }
  }
  for (let i = 0; i < 3; i++)
    b.box(x - 0.083 + i * 0.073, 0.021, z + 0.013 * (i % 2), 0.024, 0.002, 0.005, '#a4c0b5');
}

function plot(b, kind, x, z, tint, rng) {
  if (['pine', 'copse', 'acacia', 'palm', 'scrub'].includes(kind)) {
    for (const [dx, dz, s] of [
      [-0.076, -0.008, 0.19],
      [0.023, -0.028, 0.24],
      [0.086, 0.025, 0.135],
    ]) {
      if (kind === 'scrub') b.rock(x + dx, 0.037, z + dz, 0.084, 0.071, 0.074, leaves[1], rng() * 3);
      else tree(b, x + dx, z + dz, s * (0.88 + rng() * 0.18), kind, rng);
    }
  } else if (['pool', 'jetty', 'reeds', 'bridge', 'harbor', 'canal'].includes(kind)) {
    waterfront(b, kind, x, z);
  } else if (kind === 'market') {
    stall(b, x - 0.052, z, tint);
    crates(b, x + 0.075, z);
  } else if (['camp', 'crag', 'knap', 'rack', 'hides'].includes(kind)) {
    stonePlot(b, kind, x, z, tint, rng);
  } else if (
    ['farm', 'barn', 'villa', 'mudhouse', 'silo', 'orchard', 'paddy', 'greens', 'terrace', 'steps'].includes(
      kind,
    )
  ) {
    farmPlot(b, kind, x, z, tint, rng);
  } else if (
    ['mill', 'terracehouse', 'shed', 'tank', 'gantry', 'freight', 'slag', 'rail', 'platform', 'tram'].includes(
      kind,
    )
  ) {
    works(b, kind, x, z, tint);
  } else city(b, kind, x, z, tint);
}

function strip(b, x1, z1, x2, z2, width, y, color) {
  b.box(
    (x1 + x2) / 2,
    y,
    (z1 + z2) / 2,
    Math.hypot(x2 - x1, z2 - z1) + 0.003,
    0.004,
    width,
    color,
    0,
    -Math.atan2(z2 - z1, x2 - x1),
  );
}
function roadZ(x) {
  return 0.285 - 0.108 * (x + 1);
}

// Join the individual plots with a continuous working shoreline or transit line.
function grazer(b, x, z, coat, horns) {
  b.rock(x, 0.055, z, 0.075, 0.042, 0.036, coat);
  for (const dx of [-0.023, 0.023])
    for (const dz of [-0.01, 0.01])
      b.beam([x + dx, 0.049, z + dz], [x + dx + 0.004, 0.014, z + dz], 0.005, wood);
  b.beam([x + 0.025, 0.056, z], [x + 0.041, 0.078, z], 0.015, coat);
  b.rock(x + 0.045, 0.078, z, 0.03, 0.021, 0.018, coat);
  for (const side of [-1, 1]) {
    b.rock(x + 0.036, 0.087, z + side * 0.01, 0.015, 0.008, 0.013, coat);
    if (horns) b.beam([x + 0.04, 0.087, z + side * 0.006], [x + 0.029, 0.108, z + side * 0.014], 0.004, wood);
  }
}

function frontage(b, id, era, tint, rng) {
  const natural = era === 'stone' || era === 'tang';
  const water = natural || ['manchester', 'lowell', 'yokohama', 'helsinki'].includes(id);
  const rail = !water && (era === 'steam' || ['information', 'shenzhen'].includes(id));
  const spine = Array.from({ length: 27 }, (_, i) => {
    const x = -1.17 + i * 0.076;
    return [x, halfDepth(x) * 0.885 + (natural ? 0.018 * Math.sin(i * 0.43) : 0)];
  });
  for (let i = 1; i < spine.length; i++) {
    const [x, z] = spine[i - 1],
      [nx, nz] = spine[i];
    if (water) {
      strip(b, x, z, nx, nz, natural ? 0.073 : 0.09, 0.015, natural ? '#8f9073' : stone);
      strip(b, x, z, nx, nz, natural ? 0.056 : 0.068, 0.019, wet);
      if (i % 3 === 0) strip(b, x + 0.011, z + 0.007, x + 0.044, z + 0.006, 0.004, 0.022, '#aeccc4');
      if (natural && i % 3 === 1) {
        for (let j = 0; j < 4; j++) {
          const xx = x + j * 0.011,
            zz = z + 0.038 + (rng() - 0.5) * 0.014;
          b.beam([xx, 0.012, zz], [xx + 0.007, 0.038 + rng() * 0.021, zz], 0.004, leaves[j % 3]);
        }
      }
    } else if (rail) {
      strip(b, x, z, nx, nz, 0.057, 0.017, '#818078');
      for (const side of [-1, 1]) strip(b, x, z + 0.016 * side, nx, nz + 0.016 * side, 0.004, 0.025, iron);
      for (let j = 0; j < 3; j++)
        b.box(x + j * 0.025, 0.02, z + ((nz - z) * j) / 3, 0.007, 0.005, 0.046, wood, 0, 0.11);
    } else {
      strip(b, x, z, nx, nz, 0.039, 0.015, '#ae977a');
      if (i % 2) strip(b, x + 0.01, z, nx - 0.023, nz, 0.003, 0.019, linen);
    }
  }
  if (water) {
    const [x, z] = spine[natural ? 4 : 18];
    const hull = natural ? wood : '#596f75';
    b.rock(x, 0.034, z, 0.121, 0.03, 0.036, hull);
    b.box(x, 0.04, z, 0.082, 0.012, 0.021, timber);
    if (natural) b.beam([x - 0.044, 0.046, z - 0.017], [x + 0.041, 0.052, z + 0.019], 0.004, linen);
    else {
      b.box(x - 0.022, 0.062, z, 0.035, 0.031, 0.028, linen);
      b.box(x - 0.023, 0.082, z, 0.041, 0.009, 0.034, iron);
    }
  } else if (rail) {
    const [x, z] = spine[id === 'shenzhen' ? 17 : 9];
    for (const dx of [-0.048, 0.048])
      for (const dz of [-0.014, 0.014]) b.rock(x + dx, 0.036, z + dz, 0.022, 0.022, 0.009, iron);
    b.box(x, 0.054, z, 0.137, 0.03, 0.044, era === 'steam' ? wood : tint, 0, 0.11);
    if (era === 'steam') {
      for (let j = 0; j < 7; j++) b.rock(x - 0.046 + j * 0.015, 0.076, z, 0.032, 0.022, 0.031, '#515a5a', j);
    } else {
      for (let j = 0; j < 6; j++)
        b.box(x - 0.047 + j * 0.019, 0.086, z - 0.002 * j, 0.016, 0.026, 0.044, glass);
      b.box(x, 0.104, z, 0.137, 0.009, 0.049, linen, 0, 0.11);
    }
  }
  if (era === 'stone') {
    for (let i = 0; i < 12; i++) {
      const x = -1.207 + rng() * 0.067,
        z = -0.3 + i * 0.05;
      const height = i % 4 === 0 ? 0.15 : 0.042 + rng() * 0.047;
      if (i % 4 === 0) tree(b, x, z, height, 'round', rng);
      else b.rock(x, 0.012 + height * 0.28, z, 0.067, height, 0.075, leaves[i % 3], i);
    }
    grazer(b, -1.1, 0.028, id === 'patagonia' ? '#a99073' : '#a3825d', id !== 'patagonia');
    grazer(b, -1.15, 0.094, '#ba9b77', false);
  } else if (era === 'tang') {
    for (let j = 0; j < 2; j++) {
      const z = -0.19 + j * 0.09;
      b.box(-1.17, 0.023, z, 0.113, 0.021, 0.07, loam);
      for (let i = 0; i < 5; i++)
        b.rock(-1.216 + i * 0.022, 0.052, z, 0.019, 0.064, 0.039, j % 2 ? leaves[1] : '#ad9c55', i);
    }
    for (const x of [-1.24, -1.095]) {
      for (const z of [-0.02, 0.12]) b.pole(x, 0.039, z, 0.008, 0.054, 0.008, timber);
      b.box(x, 0.054, 0.05, 0.007, 0.007, 0.15, timber);
    }
    b.box(-1.168, 0.053, -0.02, 0.146, 0.007, 0.007, timber);
    grazer(b, -1.19, 0.016, linen, true);
    grazer(b, -1.16, 0.081, '#b49d83', false);
  } else if (era === 'steam') {
    works(b, 'tank', -1.13, -0.024, tint);
    crates(b, -1.14, 0.143);
  } else {
    city(b, 'stop', -1.12, -0.037, tint);
    for (const z of [-0.25, 0.141]) tree(b, -1.14, z, 0.137, 'round', rng);
  }
}

// Two porters exchange supplies along the front lane, with an unloading dwell at
// both ends. Separate limb tracks stop the gait while each porter is at work.
function delivery(parent, material, mixer, x1, x2, name, coat, period, era) {
  const root = new T.Group();
  root.name = name;
  parent.add(root);
  const body = new Batch();
  body.box(0, 0.064, 0, 0.023, 0.035, 0.018, coat);
  body.rock(0, 0.093, 0, 0.024, 0.026, 0.022, '#ab8062');
  body.rock(-0.002, 0.102, 0, 0.024, 0.013, 0.023, wood);
  if (era === 'stone') {
    if (x1 < 0) {
      for (let i = 0; i < 3; i++)
        body.box(0.015, 0.063 + i * 0.005, (i % 2) * 0.005, 0.01, 0.005, 0.038, wood, 0, 0.14 * i);
    } else body.rock(0.014, 0.064, 0.001, 0.024, 0.021, 0.027, timber);
  } else if (era === 'tang') {
    body.add('peak', 0, 0.107, 0, 0.036, 0.015, 0.034, linen);
    body.pole(0.014, 0.066, 0, 0.022, 0.019, 0.022, '#b98c60');
    body.pole(0.014, 0.077, 0, 0.014, 0.007, 0.014, '#976f52');
  } else {
    body.box(0.013, 0.067, 0.003, 0.022, 0.015, 0.027, timber);
    body.box(0.025, 0.067, 0.003, 0.002, 0.016, 0.005, linen);
    body.box(0.003, 0.102, 0, 0.027, 0.006, 0.023, era === 'steam' ? iron : coat);
  }
  for (const side of [-1, 1]) body.beam([0, 0.074, side * 0.011], [0.012, 0.061, side * 0.01], 0.006, coat);
  root.add(body.mesh(name + 'Body', material));
  const tracks = [],
    times = [0, period * 0.13, period * 0.46, period * 0.54, period * 0.64, period * 0.95, period];
  const route = [x1, x1, x2, x2, x2, x1, x1].flatMap((x) => [x, 0.007, roadZ(x)]);
  tracks.push(new T.VectorKeyframeTrack('.position', times, route));
  const forward = Math.atan(0.108) + (x2 < x1 ? Math.PI : 0);
  tracks.push(
    new T.NumberKeyframeTrack('.rotation[y]', times, [
      forward,
      forward,
      forward,
      forward + Math.PI,
      forward + Math.PI,
      forward + Math.PI,
      forward,
    ]),
  );
  for (const side of [-1, 1]) {
    const leg = new Batch();
    leg.box(0, -0.013, 0, 0.009, 0.027, 0.008, iron);
    const node = leg.mesh(name + (side < 0 ? 'Left' : 'Right'), material);
    node.position.set(0, 0.047, side * 0.006);
    root.add(node);
    const phases = [],
      swing = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      phases.push(t * period);
      const progress =
        t >= 0.13 && t <= 0.46 ? (t - 0.13) / 0.33 : t >= 0.64 && t <= 0.95 ? (t - 0.64) / 0.31 : 0;
      swing.push(side * 0.48 * Math.sin(progress * Math.PI * 14));
    }
    tracks.push(new T.NumberKeyframeTrack(node.name + '.rotation[z]', phases, swing));
  }
  mixer.clipAction(new T.AnimationClip(name + 'Route', period, tracks), root).play();
}

export function addSettlementDistricts(parent, id, mixer) {
  const [rear, front, turf, tint] = PLACES[id],
    era = SCENES[id].era,
    rng = seeded(id);
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const districts = new T.Group();
  districts.name = 'SettlementDistricts';
  parent.add(districts);
  embankment(districts, material, turf);
  const isUrban = era === 'steam' || era === 'information';
  const promenade = new Batch(),
    start = -1.16,
    end = 0.84;
  frontage(promenade, id, era, tint, rng);
  strip(
    promenade,
    start,
    roadZ(start),
    end,
    roadZ(end),
    isUrban ? 0.045 : 0.036,
    0.018,
    isUrban ? '#a19c8b' : '#b29c70',
  );
  for (let i = 0; i < 10; i++) {
    const x = start + i * 0.214,
      back = -halfDepth(x) * 0.62;
    if (i % 2 === 0) {
      const side = i % 4 === 0 ? 1 : -1;
      strip(
        promenade,
        x,
        side === 1 ? roadZ(x) : back,
        x + 0.047,
        side * halfDepth(x) * 0.83,
        0.024,
        0.018,
        '#ab9d81',
      );
    }
    if (isUrban) {
      promenade.box(x, 0.025, roadZ(x) + 0.023, 0.116, 0.009, 0.009, '#d2c8ac', 0, 0.108);
    } else {
      for (let j = 0; j < 3; j++)
        promenade.rock(x + j * 0.028, 0.019, roadZ(x) - 0.029, 0.017, 0.015, 0.013, stone, j);
    }
  }
  districts.add(promenade.mesh('ServiceLane', material));
  for (const [side, sequence] of [
    [-1, rear],
    [1, front],
  ]) {
    const bank = new Batch();
    sequence.split(' ').forEach((kind, i) => {
      const x = -0.985 + i * 0.415 + (rng() - 0.5) * 0.048;
      const z = side * (halfDepth(x) * 0.757 + (rng() - 0.5) * 0.014);
      plot(bank, kind, x, z, tint, rng);
      if (i < 4) {
        const gap = x + 0.196,
          gz = side * halfDepth(gap) * 0.78;
        if (isUrban && side < 0) {
          bank.box(gap, 0.02, gz, 0.076, 0.017, 0.056, '#a69f8f');
          if (i % 2) crates(bank, gap, gz);
          else tree(bank, gap, gz, 0.116, 'round', rng);
        } else if (era === 'tang' && side > 0) {
          for (let j = 0; j < 3; j++) bank.pole(gap + j * 0.012, 0.034, gz, 0.015, 0.039, 0.015, linen);
        } else {
          bank.rock(gap, 0.026, gz, 0.065, 0.038, 0.045, side > 0 ? stone : leaves[0], rng() * 2);
          bank.rock(gap + 0.042, 0.022, gz + 0.016, 0.04, 0.029, 0.032, leaves[2], rng() * 2);
        }
      }
    });
    districts.add(bank.mesh(side === 1 ? 'Forebank' : 'BackQuarter', material));
  }
  delivery(
    districts,
    material,
    mixer,
    -0.96,
    -0.53,
    'WestCourier',
    era === 'stone' ? '#ae8258' : '#b36e49',
    19,
    era,
  );
  delivery(districts, material, mixer, 0.57, 0.11, 'EastCourier', isUrban ? '#528189' : '#86935e', 26, era);
}

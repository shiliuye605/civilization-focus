import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { remainingOf } from './timer.js';
import { createCivilizations } from './civilizations.js';
import modelUrl from './assets/models/terratock-clock.glb?url';

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
const HAND_REST_ANGLE = Math.PI / 6;
const SECONDS_REST_ANGLE = 2.14;
const MINUTE_STEP = Math.PI / 30;

const FOV = 40;
const RIM_RADIUS = 3.42;
const MOVE_MS = 880;
const HOME_TARGET = new THREE.Vector3(0, 0.06, 0);
const HOME_DIR = new THREE.Vector3(0, 11.75, 6.15);
// 近景的观察目标与镜头偏移都在 FocusHandPivot 的局部系里，局部 +X 通向针尖。
const NEAR_ANCHOR = new THREE.Vector3(1.57, 0.25, 0);
const NEAR_OFFSET = new THREE.Vector3(1.23, 1.32, 4.17);

const RIM_POINTS = [];
for (let i = 0; i < 48; i += 1) {
  const a = (i / 48) * TAU;
  for (const y of [-0.165, 0.12]) {
    RIM_POINTS.push(new THREE.Vector3(Math.cos(a) * RIM_RADIUS, y, Math.sin(a) * RIM_RADIUS));
  }
}
const HAND_POINTS = [
  [-0.283, 0.26, 0], [0, 0.27, 0.283], [0, 0.27, -0.283], [-0.26, 0.1, 0.09],
  [0.52, 0.1, 0.435], [0.52, 0.3, -0.435], [1.12, 0.1, 0.415], [1.12, 0.3, -0.415],
  [3.24, 0.1, 0], [3.24, 0.24, 0]
].map((p) => new THREE.Vector3(...p));
for (const x of [0.69, 2.66]) {
  for (const z of [-0.28, 0.28]) HAND_POINTS.push(new THREE.Vector3(x, 0.84, z));
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;

export function handPose(run, now) {
  const elapsedMs = Math.min(run.durationMs, Math.max(0, run.durationMs - remainingOf(run, now)));
  const sweep = (MINUTE_STEP * elapsedMs) / 60000;
  return {
    sweep,
    focusAngle: HAND_REST_ANGLE - sweep,
    secondsAngle: SECONDS_REST_ANGLE - (TAU * elapsedMs) / 60000
  };
}

function makeProgressArc() {
  const maxSegments = 128;
  const position = new THREE.BufferAttribute(new Float32Array((maxSegments + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', position);
  const indices = [];
  for (let i = 0; i < maxSegments; i += 1) {
    const a = 2 * i;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  geometry.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({ color: '#ca9459', side: THREE.DoubleSide, transparent: true, opacity: 0.83 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    update(sweep, mode) {
      const span = Math.min(TAU, sweep);
      const steps = Math.max(1, Math.ceil((span * maxSegments) / TAU));
      for (let i = 0; i <= steps; i += 1) {
        const theta = HAND_REST_ANGLE - span * (i / steps);
        position.setXYZ(i * 2, Math.cos(theta) * 2.661, 0.026, -Math.sin(theta) * 2.661);
        position.setXYZ(i * 2 + 1, Math.cos(theta) * 2.705, 0.026, -Math.sin(theta) * 2.705);
      }
      material.color.set(mode === 'break' ? '#75a79f' : '#ca9459');
      position.needsUpdate = true;
      geometry.setDrawRange(0, span > 0.001 ? steps * 6 : 0);
    }
  };
}

export function createDial(canvas, options = {}) {
  const { getRun, onActivate, onFallback, onReady, onFailure, onCivilizationState, fallback, reducedMotion = false } = options;
  let renderer = null;
  let scene = null;
  let camera = null;
  let clock = null;
  let focusHand = null;
  let secondsHand = null;
  let civilizationMount = null;
  let civilizations = null;
  let desiredScene = 'stone';
  let environment = null;
  let arc = null;
  let supported = true;
  let reduced = Boolean(reducedMotion);
  let active = false;
  let raf = 0;
  let lastFrame = 0;
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let insets = { top: 0, nearTop: 0, bottom: 0 };
  let far = null;
  let nearFit = null;
  let layoutVersion = 0;
  let near = false;
  let hold = false;
  let progress = 0;
  let settle = null;
  let pointer = null;
  let drawn = {};

  const probe = new THREE.PerspectiveCamera(FOV, 1, 0.05, 75);
  const farPos = new THREE.Vector3();
  const nearPos = new THREE.Vector3();
  const nearTarget = new THREE.Vector3();
  const target = new THREE.Vector3();
  const scratch = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const facePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);

  function measure(points) {
    probe.updateMatrixWorld(true);
    probe.matrixWorldInverse.copy(probe.matrixWorld).invert();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      scratch.copy(p).applyMatrix4(probe.matrixWorldInverse);
      if (scratch.z > -0.1) return null;
      scratch.applyMatrix4(probe.projectionMatrix);
      minX = Math.min(minX, scratch.x);
      maxX = Math.max(maxX, scratch.x);
      minY = Math.min(minY, scratch.y);
      maxY = Math.max(maxY, scratch.y);
    }
    return { l: ((minX + 1) / 2) * vw, r: ((maxX + 1) / 2) * vw, t: ((1 - maxY) / 2) * vh, b: ((1 - minY) / 2) * vh };
  }

  // 沿固定视线方向找到能让轮廓完整落进可用区域的最近距离，再用视图偏移把轮廓居中。
  function fit(place, points, area, min, max) {
    const fits = (s) => {
      place(s);
      const box = measure(points);
      return box && box.r - box.l <= area.w && box.b - box.t <= area.h ? box : null;
    };
    let s = min;
    let box = fits(min);
    if (!box) {
      let lo = min;
      let hi = max;
      for (let i = 0; i < 22; i += 1) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) hi = mid;
        else lo = mid;
      }
      s = hi;
      place(s);
      box = measure(points);
    }
    const offX = (box.l + box.r) / 2 - area.cx;
    const offY = (box.t + box.b) / 2 - area.cy;
    return { s, offX, offY, l: box.l - offX, r: box.r - offX, t: box.t - offY, b: box.b - offY };
  }

  function areaOf(l, t, r, b) {
    const w = Math.max(60, r - l);
    const h = Math.max(60, b - t);
    return { w, h, cx: (l + r) / 2, cy: t + h / 2 };
  }

  function computeLayout() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    probe.aspect = vw / vh;
    probe.updateProjectionMatrix();
    const bottom = vh - insets.bottom;
    const padX = Math.max(16, vw * 0.04);
    far = fit(
      (s) => {
        probe.position.copy(HOME_DIR).multiplyScalar(s).add(HOME_TARGET);
        probe.lookAt(HOME_TARGET);
      },
      RIM_POINTS,
      areaOf(padX, insets.top, vw - padX, bottom),
      0.4,
      8
    );
    const nearPad = Math.max(18, vw * 0.05);
    nearFit = fit(
      (s) => {
        probe.position.copy(NEAR_OFFSET).multiplyScalar(s).add(NEAR_ANCHOR);
        probe.lookAt(NEAR_ANCHOR);
      },
      HAND_POINTS,
      areaOf(nearPad, insets.nearTop, vw - nearPad, bottom),
      1,
      8
    );
    farPos.copy(HOME_DIR).multiplyScalar(far.s).add(HOME_TARGET);
    canvas.dataset.cx = String(Math.round((far.l + far.r) / 2));
    canvas.dataset.cy = String(Math.round((far.t + far.b) / 2));
    canvas.dataset.rx = String(Math.ceil((far.r - far.l) / 2));
    canvas.dataset.ry = String(Math.ceil((far.b - far.t) / 2));
    canvas.dataset.nearBox = [nearFit.l, nearFit.t, nearFit.r, nearFit.b].map(Math.round).join(',');
    layoutVersion += 1;
    placeFallback();
  }

  function placeFallback() {
    if (!fallback || fallback.hidden) return;
    const available = Math.max(40, vh - insets.bottom - insets.top);
    const height = Math.min(available, vw * 0.7, 340);
    const compact = height < 140;
    fallback.style.width = `${Math.round(compact ? Math.min(vw * 0.84, 340) : height)}px`;
    fallback.style.height = `${Math.round(height)}px`;
    fallback.style.borderRadius = compact ? '12px' : '50%';
    fallback.style.padding = compact ? '4px 12px' : '24px';
    fallback.style.gap = compact ? '0' : '8px';
    fallback.style.left = `${Math.round(vw / 2)}px`;
    fallback.style.top = `${Math.round((insets.top + vh - insets.bottom) / 2)}px`;
  }

  function showFallback() {
    supported = false;
    stopLoop();
    canvas.hidden = true;
    civilizations?.dispose();
    civilizations = null;
    renderer?.dispose();
    environment?.dispose();
    scene?.traverse((node) => {
      node.geometry?.dispose();
      if (node.material) {
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
      }
    });
    renderer = null;
    clock = null;
    civilizationMount = null;
    canvas.dataset.ready = 'false';
    onFailure?.();
    if (fallback) {
      fallback.hidden = false;
      placeFallback();
    }
    if (settle) {
      const cb = settle;
      settle = null;
      cb();
    }
  }

  function buildRenderer() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.13;

    scene = new THREE.Scene();
    const envScene = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(envScene, 0.045);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.65;
    envScene.dispose();
    pmrem.dispose();

    const key = new THREE.DirectionalLight('#ffdbac', 2.65);
    const fill = new THREE.DirectionalLight('#8ebcff', 1.8);
    const bounce = new THREE.DirectionalLight('#ffd5a0', 0.76);
    key.position.set(-4, 9, 3);
    fill.position.set(4, 3, -5);
    bounce.position.set(2, 1.5, 7);
    scene.add(key, fill, bounce, new THREE.HemisphereLight('#c4daf8', '#51412e', 0.55));

    camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 75);
    applySize();
  }

  function applySize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
  }

  function mount(asset) {
    if (!supported) {
      asset.scene.traverse((node) => {
        node.geometry?.dispose();
        node.material?.dispose();
      });
      return;
    }
    const root = asset.scene.getObjectByName('TerraTockClock');
    const hand = root?.getObjectByName('FocusHandPivot');
    const seconds = root?.getObjectByName('SecondsHandPivot');
    if (!hand || !seconds || !root.getObjectByName('CivilizationMount')) throw new Error('Incomplete clock model');
    arc = makeProgressArc();
    root.add(arc.mesh);
    scene.add(root);
    clock = root;
    focusHand = hand;
    secondsHand = seconds;
    civilizationMount = root.getObjectByName('CivilizationMount');
    civilizations = createCivilizations(civilizationMount, {
      reducedMotion: reduced,
      onState: (state) => {
        canvas.dataset.civilization = state.era || '';
        canvas.dataset.scene = state.sceneId || '';
        canvas.dataset.civilizationStatus = state.status;
        canvas.dataset.flipping = String(state.flipping);
        drawn = {};
        onCivilizationState?.(state);
        draw();
      }
    });
    civilizations.setActive(active && !document.hidden);
    civilizations.setScene(desiredScene, { animate: false });
    draw();
    canvas.dataset.ready = 'true';
    onReady?.();
  }

  function draw() {
    if (!clock) return;
    const run = getRun();
    const now = Date.now();
    const pose = handPose(run, now);
    if (
      drawn.focus === pose.focusAngle &&
      drawn.seconds === pose.secondsAngle &&
      drawn.mode === run.mode &&
      drawn.progress === progress &&
      drawn.layout === layoutVersion
    ) return;
    drawn = { focus: pose.focusAngle, seconds: pose.secondsAngle, mode: run.mode, progress, layout: layoutVersion };

    focusHand.rotation.y = pose.focusAngle;
    secondsHand.rotation.y = pose.secondsAngle;
    arc.update(pose.sweep, run.mode);
    clock.updateMatrixWorld(true);

    // 两个向量在转动的指针局部系里成对变换，世界 +Y 固定为上方，指针转动时镜头不会翻滚。
    focusHand.localToWorld(nearTarget.copy(NEAR_ANCHOR));
    focusHand.localToWorld(nearPos.copy(NEAR_OFFSET).multiplyScalar(nearFit.s).add(NEAR_ANCHOR));
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.copy(farPos).lerp(nearPos, eased);
    target.copy(HOME_TARGET).lerp(nearTarget, eased);
    camera.lookAt(target);
    camera.setViewOffset(vw, vh, mix(far.offX, nearFit.offX, eased), mix(far.offY, nearFit.offY, eased), vw, vh);
    renderer.render(scene, camera);

    const sweep = (pose.sweep * DEG).toFixed(2);
    if (canvas.dataset.sweep !== sweep) canvas.dataset.sweep = sweep;
    const zoom = progress.toFixed(2);
    if (canvas.dataset.zoom !== zoom) canvas.dataset.zoom = zoom;
  }

  function step(dt) {
    if (civilizations?.update(dt / 1000)) drawn = {};
    const goal = hold || near ? 1 : 0;
    if (progress !== goal) {
      progress = reduced ? goal : clamp(progress + (dt / MOVE_MS) * (goal > progress ? 1 : -1), 0, 1);
    }
    draw();
    if (progress === goal && settle) {
      const cb = settle;
      settle = null;
      cb();
    }
  }

  function frame(now) {
    raf = 0;
    if (!active || !renderer) return;
    raf = requestAnimationFrame(frame);
    const dt = clamp(now - lastFrame, 0, 90);
    lastFrame = now;
    step(dt);
  }

  function startLoop() {
    if (!supported || !active || raf || document.hidden) return;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function resize() {
    computeLayout();
    if (!renderer) return;
    applySize();
    draw();
  }

  function setInsets(next) {
    const top = Math.max(0, Math.round(next.top));
    const nearTop = Math.max(0, Math.round(next.nearTop));
    const bottom = Math.max(0, Math.round(next.bottom));
    if (top === insets.top && nearTop === insets.nearTop && bottom === insets.bottom) return;
    insets = { top, nearTop, bottom };
    computeLayout();
    draw();
  }

  function hitDial(x, y) {
    if (!clock || progress > 0.05) return false;
    ndc.set((x / vw) * 2 - 1, 1 - (y / vh) * 2);
    raycaster.setFromCamera(ndc, camera);
    const point = raycaster.ray.intersectPlane(facePlane, scratch);
    return Boolean(point) && Math.hypot(point.x, point.z) <= RIM_RADIUS;
  }

  computeLayout();

  try {
    buildRenderer();
  } catch (error) {
    console.warn('时拓：WebGL 时钟初始化失败', error);
    showFallback();
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    civilizations?.setActive(active && !document.hidden);
    if (document.hidden) stopLoop();
    else { draw(); startLoop(); }
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showFallback();
  });

  if (supported) {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, at: performance.now() };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (pointer && e.pointerId === pointer.id) {
        pointer.moved = Math.max(pointer.moved, Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y));
      }
      if (e.pointerType === 'mouse') canvas.style.cursor = hitDial(e.clientX, e.clientY) ? 'pointer' : '';
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const tap = pointer.moved < 6 && performance.now() - pointer.at < 600 && hitDial(pointer.x, pointer.y);
      pointer = null;
      if (tap) onActivate?.();
    });
    canvas.addEventListener('pointercancel', () => {
      pointer = null;
    });
    canvas.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (clock) onActivate?.();
    });
    new GLTFLoader().loadAsync(modelUrl).then(mount).catch((error) => {
      console.warn('时拓：时钟模型加载失败', error);
      showFallback();
    });
  }
  fallback?.addEventListener('click', () => onFallback?.());

  return {
    setActive(next) {
      active = Boolean(next);
      civilizations?.setActive(active && !document.hidden);
      if (active) startLoop();
      else stopLoop();
    },
    setReduced(next) {
      reduced = Boolean(next);
      civilizations?.setReduced(reduced);
      drawn = {};
      draw();
    },
    setScene(id, options) {
      desiredScene = id;
      civilizations?.setScene(id, options);
    },
    nextLifePhase() {
      civilizations?.nextPhase();
    },
    setInsets,
    resize,
    isSupported: () => supported,
    isReady: () => Boolean(clock),
    getCivilizationMount: () => civilizationMount,
    setNear(next) {
      near = Boolean(next);
    },
    // 进入文明场景前把镜头推到指针近景并保持，离开场景后由 surface 交还给用户选定的视角。
    dive(cb) {
      hold = true;
      if (!clock || !active || reduced || progress === 1) {
        progress = 1;
        draw();
        cb?.();
        return;
      }
      settle = cb || null;
    },
    surface(cb) {
      hold = false;
      progress = 1;
      if (!clock || !active || reduced || near) {
        progress = near ? 1 : 0;
        draw();
        cb?.();
        return;
      }
      settle = cb || null;
    }
  };
}

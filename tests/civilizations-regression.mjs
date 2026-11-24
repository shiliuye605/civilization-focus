import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { defaultState } from '../src/store.js';
import { canEnterEra } from '../src/eras.js';
import { ERAS as HOME_ERAS, SCENES_BY_ERA } from '../src/scene-catalog.mjs';

const URL = process.env.CIV_VERIFY_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = fileURLToPath(new globalThis.URL('../docs/screenshots/', import.meta.url));
const KEY = 'wmf:v1:formal';
const NOW = 1900000000000;
const TIMEOUT = 30000;
const ERAS = ['stone', 'tang', 'steam'];
const NODES = {
  stone: ['StoneGatherer', 'CampfireFlame'],
  tang: ['TangVillager', 'WaterWheelPivot'],
  steam: ['SteamTraveler', 'SteamTrainMotion', 'Chimney00']
};
let passed = 0;
function check(label, condition, details) {
  assert.ok(condition, `${label}${details === undefined ? '' : `\n${JSON.stringify(details)}`}`);
  console.log(`PASS ${++passed} ${label}`);
}
const equal = (a, b, epsilon = 0.00001) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < epsilon;
const same = (a, b, epsilon) => Boolean(a && b && a.length === b.length && a.every((n, i) => equal(n, b[i], epsilon)));
const state = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
const progressStamp = (s) => JSON.stringify([s.progress.focusMinutes, s.progress.completedRounds, s.progress.lastSettledRoundId, s.run.roundId, s.run.completion]);

function seed(minutes = 100, era = 'stone', runningMinutes = 0) {
  const s = defaultState();
  s.progress.focusMinutes = minutes;
  s.progress.viewEra = era;
  // Keep legacyEraFloor=stone and completedRounds=0: eligibility must come from minutes.
  if (runningMinutes) {
    s.settings.focusMinutes = runningMinutes;
    s.run = {
      ...s.run, status: 'running', durationMs: runningMinutes * 60000,
      deadline: NOW + runningMinutes * 60000, roundId: `civ-${minutes}-${runningMinutes}`
    };
  }
  return s;
}

// Only patch the dev response. No production source, module-private state or persistent profile is modified.
const RENDER_PATCH = `
  window.__civTest = { camera, clock, focusHand, secondsHand, civilizationMount, civilizations, renderer, target: target.clone() };
  if (!window.__civMixerPatched) {
    window.__civMixerPatched = true;
    const originalUpdate = THREE.AnimationMixer.prototype.update;
    THREE.AnimationMixer.prototype.update = function (delta) {
      if (window.__civMixerAudit) {
        const steps = window.__civMixerAudit.get(this) || [];
        steps.push(delta);
        window.__civMixerAudit.set(this, steps);
      }
      return originalUpdate.call(this, delta);
    };
  }
  if (!window.__civLoaderPatched) {
    window.__civLoaderPatched = true;
    window.__civParsedEras = [];
    const originalParse = GLTFLoader.prototype.parse;
    GLTFLoader.prototype.parse = function (data, resourcePath, onLoad, onError) {
      return originalParse.call(this, data, resourcePath, (asset) => {
        // GLTFLoader may suffix duplicate names; keep the original node identity for probes.
        for (const [node, association] of asset.parser.associations) {
          if (association.nodes !== undefined) window.__civNodeNames.set(node, asset.parser.json.nodes[association.nodes].name);
        }
        onLoad(asset);
        window.__civParsedEras.push(window.__mountedEra(asset.scene));
      }, onError);
    };
  }
  renderer.render(scene, camera);
  window.__recordCiv?.();
`;

function initialize({ initial, key, epoch }) {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
  localStorage.setItem('wmf:v1:audio', JSON.stringify({ version: 1, enabled: false, muted: false, volume: 0.6, ambienceId: null }));
  let offset = Number(sessionStorage.getItem('civ-test-offset')) || 0;
  Date.now = () => epoch + offset;
  window.__advance = (ms) => {
    offset += ms;
    sessionStorage.setItem('civ-test-offset', String(offset));
  };
  // Date.now alone is frozen. performance.now, timers and requestAnimationFrame stay real.
  window.__civFrames = [];
  window.__civFlipEvents = [];
  window.__civPageResources = new Map();
  window.__civNodeNames = new WeakMap();
  window.__resetCivTrace = () => {
    window.__civFrames = [];
    window.__civFlipEvents = [];
    window.__civPageResources.clear();
    window.__recordCiv();
  };
  window.__mountedEra = (root) => {
    let era = root?.userData?.era || null;
    if (!era) root?.traverse((node) => { if (!era && node.userData?.era) era = node.userData.era; });
    return era;
  };
  window.__mountedScene = (root) => {
    let id = root?.userData?.sceneId || null;
    if (!id) root?.traverse((node) => { if (!id) id = node.userData?.sceneId || node.userData?.location || null; });
    return id;
  };
  window.__civRoot = () => {
    const children = window.__civTest?.civilizationMount.children || [];
    // The transient page holder can precede the GLTF root after the midpoint swap.
    return children.find((node) => node.userData?.sceneId || node.userData?.era)
      || children.find((node) => window.__mountedEra(node));
  };
  window.__nodePoses = (names) => {
    const root = window.__civRoot();
    return Object.fromEntries(names.map((name) => {
      const values = [];
      // Sample every matching subtree, not only the first same-name Steam node.
      // At rest a scheduled actor breathes through child poses without moving its root.
      root?.traverse((node) => {
        if (node.name === name || window.__civNodeNames.get(node) === name) {
          node.traverse((child) => values.push(...child.position.toArray(), ...child.quaternion.toArray(), ...child.scale.toArray()));
        }
      });
      return [name, values.length ? values : null];
    }));
  };
  window.__recordCiv = () => {
    const d = window.__civTest;
    const canvas = document.querySelector('#dial-canvas');
    if (!d?.civilizationMount || !canvas) return;
    d.clock.updateMatrixWorld(true);
    const root = window.__civRoot();
    const holder = d.civilizationMount.getObjectByName('CivilizationPageTurn');
    const leaves = holder?.children.filter((node) => node.isMesh) || [];
    const edges = holder?.children.filter((node) => node.isLine) || [];
    holder?.traverse((node) => {
      for (const resource of [node.geometry, node.material]) {
        if (!resource || window.__civPageResources.has(resource.uuid)) continue;
        const record = { holder: holder.uuid, uuid: resource.uuid, disposals: 0 };
        window.__civPageResources.set(resource.uuid, record);
        resource.addEventListener('dispose', () => { record.disposals += 1; });
      }
    });
    window.__civFrames.push({
      at: performance.now(), era: canvas.dataset.civilization, sceneId: canvas.dataset.scene,
      mounted: window.__mountedEra(root), mountedScene: window.__mountedScene(root),
      flip: canvas.dataset.flipping, status: canvas.dataset.civilizationStatus,
      zoom: canvas.dataset.zoom, dial: document.body.dataset.dial, view: document.body.dataset.view,
      roots: d.civilizationMount.children.length, leaves: leaves.length, edges: edges.length, rootId: root?.uuid,
      holderId: holder?.uuid, siblings: holder?.parent === d.civilizationMount && root?.parent === d.civilizationMount,
      // createEraTurn deforms vertex buffers; the holder's matrix itself is stationary.
      page: holder ? leaves.flatMap((leaf) => Array.from(leaf.geometry.getAttribute('position').array)) : null,
      camera: d.focusHand.worldToLocal(d.camera.position.clone()).toArray(),
      target: d.focusHand.worldToLocal(d.target.clone()).toArray()
    });
  };
  new MutationObserver((records) => {
    const changes = records.filter((r) => r.target.id === 'dial-canvas');
    for (let i = 0; i < changes.length; i += 1) {
      const r = changes[i];
      // Reconstruct intermediate values even when several writes share a microtask.
      const next = changes.slice(i + 1).find((n) => n.target === r.target && n.attributeName === r.attributeName);
      const value = next ? next.oldValue : r.target.getAttribute(r.attributeName);
      if (value !== r.oldValue) window.__civFlipEvents.push({ from: r.oldValue, to: value, at: performance.now() });
    }
  }).observe(document, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-flipping'] });
}

async function fxIdle(page) {
  await page.waitForFunction(() => !document.querySelector('#fx-canvas')?.classList.contains('is-active') && !document.body.classList.contains('is-zooming'));
}
async function ready(page, era, status = 'ready') {
  await page.waitForSelector('body[data-app-ready="true"]');
  await page.waitForSelector('#dial-canvas[data-ready="true"]');
  await page.waitForFunction(({ era, status }) => {
    const c = document.querySelector('#dial-canvas');
    const d = window.__civTest;
    return c.dataset.civilizationStatus === status && c.dataset.civilization === era && c.dataset.scene === era && c.dataset.flipping === 'false' && d && (status !== 'ready' || (window.__mountedEra(window.__civRoot()) === era && window.__mountedScene(window.__civRoot()) === era));
  }, { era, status });
  await fxIdle(page);
  await page.waitForFunction(() => document.querySelector('#home-dock').getAnimations().every((a) => a.playState === 'finished'));
  await frames(page);
}
async function frames(page, count = 2) {
  await bounded(page.evaluate((count) => new Promise((resolve) => {
    const step = () => { if (--count <= 0) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), count), 'animation frames');
}
async function near(page) {
  await fxIdle(page);
  if (await page.getAttribute('body', 'data-dial') !== 'near') await page.click('#dial-view-btn');
  await page.waitForSelector('#dial-canvas[data-zoom="1.00"]');
  await frames(page);
}
async function advance(page, ms) {
  await page.evaluate((ms) => window.__advance(ms), ms);
  // Observe the normal 250ms reconciliation loop, not a test-only timer API.
  await page.waitForFunction((key) => {
    const s = JSON.parse(localStorage.getItem(key));
    const r = s.run;
    if (r.status === 'running' && r.deadline <= Date.now()) return false;
    if (r.status === 'idle') return true;
    const remaining = r.status === 'running' ? r.deadline - Date.now() : r.status === 'paused' ? r.remainingMs : 0;
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    return document.querySelector('#dial-count').textContent === `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }, KEY);
  await frames(page);
}
async function select(page, era) {
  await fxIdle(page);
  await page.click(`[data-home-era="${era}"]`);
  await ready(page, era);
  await checkSelection(page, era);
}
async function checkSelection(page, era) {
  const s = await state(page);
  const nav = await page.locator('[data-home-era]').evaluateAll((buttons) => buttons.map((b) => ({ era: b.dataset.homeEra, name: b.textContent, pressed: b.getAttribute('aria-pressed') === 'true', disabled: b.disabled })));
  const places = await page.locator('#scene-select').evaluate((select) => ({ value: select.value, ids: [...select.options].map((option) => option.value) }));
  check(`${era} 四时代导航、同代地点与正式 viewEra、canEnterEra 一致`, s.kind === 'formal' && s.progress.viewEra === era && nav.map((b) => b.era).join(',') === Object.keys(HOME_ERAS).join(',') && nav.filter((b) => b.pressed).length === 1 && nav.find((b) => b.pressed)?.era === era && nav.every((b) => b.name === HOME_ERAS[b.era].name && b.disabled === !canEnterEra(b.era, s.progress)) && places.value === HOME_ERAS[era].defaultId && places.ids.join(',') === SCENES_BY_ERA[era].join(',') && await page.locator('#civilization-entry').isDisabled() === (era === 'information'), { progress: s.progress, nav, places });
}

async function withPage(browser, options, body) {
  const { width = 1440, height = 900, initial = seed(), reduced = false, setup, status = 'ready', loadedEra = initial.progress.viewEra } = options;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 640, hasTouch: width <= 640, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  context.setDefaultTimeout(TIMEOUT);
  context.setDefaultNavigationTimeout(TIMEOUT);
  const page = await context.newPage();
  page.errors = [];
  page.cleanups = [];
  // Network console errors are expected in abort cases; uncaught JS errors never are.
  page.on('pageerror', (error) => page.errors.push(String(error)));
  try {
    await page.addInitScript(initialize, { initial, key: KEY, epoch: NOW });
    await page.route('**/src/dial.js*', async (route) => {
      try {
        const response = await route.fetch({ timeout: TIMEOUT });
        const source = await response.text();
        assert.equal(source.split('renderer.render(scene, camera);').length, 2, 'dev renderer instrumentation must match exactly once');
        await route.fulfill({ response, body: source.replace('renderer.render(scene, camera);', RENDER_PATCH) });
      } catch (error) {
        page.errors.push(`dial instrumentation: ${error}`);
        await route.abort();
      }
    });
    await setup?.(page);
    await page.goto(URL);
    await ready(page, loadedEra, status);
    await body(page);
    check(`${width}×${height} ${initial.progress.viewEra} 场景无 pageerror`, page.errors.length === 0, page.errors);
  } finally {
    for (const cleanup of page.cleanups) cleanup();
    await context.close();
  }
}

function probeInPage(names) {
  const d = window.__civTest;
  d.clock.updateMatrixWorld(true);
  d.camera.updateMatrixWorld(true);
  const root = window.__civRoot();
  const content = root?.children.find((node) => node.userData?.location === window.__mountedScene(root));
  const point = d.camera.position.clone();
  function project(p) {
    const v = p.clone().project(d.camera);
    return [(v.x + 1) * innerWidth / 2, (1 - v.y) * innerHeight / 2, v.z];
  }
  function bounds(object) {
    const out = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity, near: Infinity, far: -Infinity, vertices: 0 };
    object?.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.geometry?.getAttribute('position')) return;
      for (let node = mesh; node; node = node.parent) if (!node.visible) return;
      const owner = mesh.isSkinnedMesh || mesh.isInstancedMesh ? mesh : mesh.geometry;
      if (!owner.boundingBox || mesh.isSkinnedMesh) owner.computeBoundingBox();
      const box = owner.boundingBox;
      if (!box || box.isEmpty()) return;
      // Eight corners per mesh, with incremental extrema: no vertex-sized arrays/spread.
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const p = project(point.clone().set(x, y, z).applyMatrix4(mesh.matrixWorld));
        out.l = Math.min(out.l, p[0]); out.r = Math.max(out.r, p[0]);
        out.t = Math.min(out.t, p[1]); out.b = Math.max(out.b, p[1]);
        out.near = Math.min(out.near, p[2]); out.far = Math.max(out.far, p[2]);
        out.vertices += 1;
      }
    });
    return out;
  }
  const rect = (selector) => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom };
  };
  const run = JSON.parse(localStorage.getItem('wmf:v1:formal')).run;
  const remaining = run.status === 'running' ? Math.max(0, run.deadline - Date.now()) : run.status === 'paused' ? run.remainingMs : run.status === 'done' ? 0 : run.durationMs;
  return {
    width: innerWidth, height: innerHeight, era: window.__mountedEra(root),
    model: bounds(root), topPanel: rect('#home-top'), rootId: root?.uuid,
    sceneId: window.__mountedScene(root), contentScale: content?.scale.toArray(),
    rootPosition: root?.position.toArray(), rootQuaternion: root?.quaternion.toArray(), rootScale: root?.scale.toArray(),
    rootWorld: root?.matrixWorld.toArray(), rootInFocus: root ? d.focusHand.matrixWorld.clone().invert().multiply(root.matrixWorld).toArray() : null,
    roots: d.civilizationMount.children.length, parentOK: root?.parent === d.civilizationMount && d.civilizationMount.parent === d.focusHand,
    leaf: Boolean(d.civilizationMount.getObjectByName('CivilizationPageTurn')),
    camera: d.focusHand.worldToLocal(d.camera.position.clone()).toArray(), target: d.focusHand.worldToLocal(d.target.clone()).toArray(), up: d.camera.up.toArray(),
    pivot: project(d.focusHand.localToWorld(point.clone().set(0, 0.25, 0))),
    tip: project(d.focusHand.localToWorld(point.clone().set(3.22, 0.25, 0))),
    angle: d.focusHand.rotation.y, seconds: d.secondsHand.rotation.y, run, remaining,
    count: document.querySelector('#dial-count').textContent,
    nodes: window.__nodePoses(names),
    logo: rect('#home-logo'), nav: rect('#home-eras'), bar: rect('#dial-bar'), dock: rect('#home-dock'), controls: rect('#home-control'),
    logoLoaded: document.querySelector('#home-logo').naturalWidth > 0,
    noScroll: document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight
  };
}
const probe = (page, era) => page.evaluate(probeInPage, NODES[era] || []);
function fits(box, width, height) {
  return box.vertices > 0 && [box.l, box.r, box.t, box.b, box.near, box.far].every(Number.isFinite) && box.l >= -1 && box.r <= width + 1 && box.t >= -1 && box.b <= height + 1 && box.near >= -1 && box.far <= 1;
}
const disjoint = (a, b) => a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b;
function poseMatches(s) {
  const elapsed = Math.min(s.run.durationMs, Math.max(0, s.run.durationMs - s.remaining));
  return equal(s.angle, Math.PI / 2 - Math.PI / 30 * elapsed / 60000) && equal(s.seconds, Math.PI / 2 - Math.PI * 2 * elapsed / 60000);
}
function checkGeometry(label, s) {
  check(`${label} GLTF 单根单位变换、内部缩放及翻页清理正确`, s.roots === 1 && s.parentOK && !s.leaf && s.sceneId === s.era && same(s.rootPosition, [0, 0, 0]) && same(s.rootQuaternion, [0, 0, 0, 1]) && same(s.rootScale, [1, 1, 1]) && same(s.contentScale, [0.89, 0.89, 0.89]), s);
  const minLandscapeWidth = Math.min(s.width * .66, (s.dock.t - s.topPanel.b) * 2);
  check(`${label} 聚落占足可用画面且不挡顶部面板及底部操作`, fits(s.model, s.width, s.height) && s.model.r-s.model.l > minLandscapeWidth && s.pivot[0] < s.tip[0] && disjoint(s.model, s.topPanel) && disjoint(s.model, s.dock) && s.logoLoaded && s.noScroll && s.controls.l >= 0 && s.controls.r <= s.width && s.controls.b <= s.height, { model: s.model, top: s.topPanel, dock: s.dock });
  check(`${label} 真实低位近景、镜头目标位于专注针局部坐标系`, same(s.target, [1.67, 0.43, 0]) && same(s.up, [0, 1, 0]) && s.camera[1] > 0.43 && s.camera[2] > 0 && (s.camera[1] - 0.43) / s.camera[2] < 0.4);
}
async function samples(page, era) {
  const result = [await page.evaluate((names) => window.__nodePoses(names), NODES[era])];
  for (const delay of [310, 430, 370]) {
    await page.waitForTimeout(delay);
    result.push(await page.evaluate((names) => window.__nodePoses(names), NODES[era]));
  }
  return result;
}
function animated(label, era, snapshots, expected) {
  for (const name of NODES[era]) {
    const present = snapshots.every((s) => s[name]?.length > 0);
    const changed = present && snapshots.some((s) => !same(s[name], snapshots[0][name]));
    check(`${label} ${name} ${expected ? '持续动画' : '保持静止'}`, present && changed === expected);
  }
}
const resetTrace = (page) => page.evaluate(() => window.__resetCivTrace());
const trace = (page) => page.evaluate(() => ({ frames: window.__civFrames, events: window.__civFlipEvents, resources: [...window.__civPageResources.values()] }));
async function noFlip(page, label) {
  await page.waitForTimeout(750);
  const t = await trace(page);
  check(label, !t.events.some((e) => e.to === 'true') && !t.frames.some((f) => f.flip === 'true'), t.events);
}

function binaryPattern(era) {
  // ?import / ?url are JS asset modules, not the GLB binary; never abort/delay them.
  return (url) => url.pathname.endsWith(`/${era}.glb`) && !['import', 'url', 'raw'].some((key) => url.searchParams.has(key));
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: timeout ${TIMEOUT}ms`)), TIMEOUT); })]);
  } finally { clearTimeout(timer); }
}
async function delayModel(page, era) {
  const requested = deferred(), release = deferred(), delivered = deferred();
  const urls = [];
  page.cleanups.push(() => release.resolve());
  await page.route(binaryPattern(era), async (route) => {
    urls.push(route.request().url());
    requested.resolve();
    try {
      const response = await route.fetch({ timeout: TIMEOUT });
      await release.promise;
      await route.fulfill({ response });
    } catch (error) {
      if (!page.isClosed()) page.errors.push(`delayed ${era}: ${error}`);
    } finally { delivered.resolve(); }
  });
  return { urls, requested: () => bounded(requested.promise, `${era} binary request`), release: () => release.resolve(), delivered: () => bounded(delivered.promise, `${era} binary delivery`) };
}
async function failModel(page, era) {
  const pattern = binaryPattern(era);
  const urls = [];
  const handler = async (route) => { urls.push(route.request().url()); await route.abort('failed'); };
  await page.route(pattern, handler);
  return { urls, restore: () => page.unroute(pattern, handler) };
}
async function waitLoading(page) {
  await page.waitForSelector('#dial-canvas[data-civilization-status="loading"]');
}

async function visibilityCheck(page, era) {
  const names = NODES[era];
  const result = await bounded(page.evaluate(async (names) => {
    const snapshot = () => window.__nodePoses(names);
    const tick = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const distance = (a, b) => {
      let max = 0;
      for (const name of names) for (let i = 0; i < a[name].length; i += 1) max = Math.max(max, Math.abs(a[name][i] - b[name][i]));
      return max;
    };
    let before = snapshot(), normalStep = 0;
    for (let i = 0; i < 12; i += 1) {
      await tick();
      const next = snapshot();
      normalStep = Math.max(normalStep, distance(before, next));
      before = next;
    }
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    window.__civMixerAudit = new Map();
    let hiddenStep, resumeStep = 0;
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      const asleep = snapshot();
      window.__advance(120000);
      await new Promise((resolve) => setTimeout(resolve, 1400));
      hiddenStep = distance(asleep, snapshot());
      if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor); else delete document.hidden;
      if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor); else delete document.visibilityState;
      before = snapshot();
      document.dispatchEvent(new Event('visibilitychange'));
      const began = performance.now();
      for (let i = 0; i < 10; i += 1) {
        await tick();
        const next = snapshot();
        resumeStep = Math.max(resumeStep, distance(before, next));
        before = next;
      }
      const elapsed = (performance.now() - began) / 1000;
      const mixers = [...window.__civMixerAudit.values()].map((steps) => ({ max: steps.reduce((m, n) => Math.max(m, Math.abs(n)), 0), total: steps.reduce((sum, n) => sum + Math.abs(n), 0) }));
      return { normalStep, hiddenStep, resumeStep, elapsed, mixers };
    } finally {
      if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor); else delete document.hidden;
      if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor); else delete document.visibilityState;
      window.__civMixerAudit = null;
      document.dispatchEvent(new Event('visibilitychange'));
    }
  }, names), 'visibility animation sampling');
  check('后台停止文明动画，唤醒不补跑两分钟或大 dt', result.normalStep > 0 && result.hiddenStep < 0.00001 && result.resumeStep > 0 && result.resumeStep <= Math.max(0.03, result.normalStep * 6) && result.mixers.every((m) => m.max <= 0.1 && m.total <= result.elapsed + 0.15), result);
}

function checkFlip(label, t, oldEra, newEra) {
  const starts = t.events.filter((e) => e.to === 'true');
  const ends = t.events.filter((e) => e.from === 'true' && e.to === 'false');
  const active = t.frames.filter((f) => f.flip === 'true');
  const duration = ((ends[0]?.at ?? 0) - (starts[0]?.at ?? 0)) / 1000;
  check(`${label} flipping 仅 true→false 一次，持续约 1.56 秒`, starts.length === 1 && ends.length === 1 && Math.abs(duration - 1.56) <= 0.3 && active.length >= 3, { events: t.events, duration });
  const switched = active.find((f) => f.mounted === newEra);
  const fraction = switched ? (switched.at - starts[0].at) / (ends[0].at - starts[0].at) : -1;
  const sequence = [];
  for (const f of t.frames) if (f.mounted && sequence.at(-1) !== f.mounted) sequence.push(f.mounted);
  check(`${label} 旧模型保留到 52% 中点再切换最终时代与 sceneId`, JSON.stringify(sequence) === JSON.stringify([oldEra, newEra]) && active.some((f) => f.mounted === oldEra) && Math.abs(fraction - 0.52) <= 0.15 && t.frames.every((f) => f.era === f.mounted && f.sceneId === f.mountedScene), { sequence, fraction });
  const deformed = (era) => {
    const half = active.filter((f) => f.mounted === era && f.page?.length && f.page.every(Number.isFinite));
    return half.length >= 2 && half.some((f) => !same(f.page, half[0].page));
  };
  const final = t.frames.at(-1);
  check(`${label} 单 holder 三网格三边线、两半变形、同级挂载且结束释放`, active.every((f) => f.roots === 2 && f.leaves === 3 && f.edges === 3 && f.siblings) && new Set(active.map((f) => f.holderId)).size === 1 && deformed(oldEra) && deformed(newEra) && final.roots === 1 && !final.holderId && t.resources.length === 12 && t.resources.every((r) => r.holder === active[0].holderId && r.disposals === 1), t.resources);
  check(`${label} 转场全程保持近景及镜头局部目标`, active.every((f) => f.view === 'home' && f.dial === 'near' && f.zoom === '1.00' && same(f.camera, active[0].camera, 0.001) && same(f.target, active[0].target, 0.001)));
}

async function unlockCase(browser, minutes, runningMinutes, oldEra, newEra, unlocked, reduced = false) {
  let gate;
  const initial = seed(minutes, oldEra, runningMinutes);
  const label = `${minutes}+${runningMinutes}分钟${reduced ? ' 减少动态' : ''}`;
  await withPage(browser, { initial, reduced, setup: async (page) => { gate = await delayModel(page, newEra); } }, async (page) => {
    await near(page);
    await checkSelection(page, oldEra);
    const old = await probe(page, oldEra);
    await resetTrace(page);
    await advance(page, runningMinutes * 60000);
    await gate.requested();
    await waitLoading(page);
    const loading = await probe(page, oldEra);
    check(`${label} 完成后加载期间保留旧模型与近景`, loading.rootId === old.rootId && loading.era === oldEra && await page.getAttribute('#dial-canvas', 'data-civilization') === oldEra && await page.getAttribute('#dial-canvas', 'data-zoom') === '1.00');
    gate.release();
    await gate.delivered();
    await ready(page, newEra);
    await page.waitForTimeout(750);
    const t = await trace(page);
    if (reduced) await noFlip(page, `${label} 跨门槛直接替换、不翻页`);
    else checkFlip(label, t, oldEra, newEra);
    const settled = await state(page);
    check(`${label} 正式结算仅一次且一次跨两门槛只落最终时代`, settled.run.status === 'done' && settled.progress.focusMinutes === minutes + runningMinutes && settled.progress.completedRounds === initial.progress.completedRounds + 1 && settled.progress.lastSettledRoundId === initial.run.roundId && settled.progress.viewEra === newEra && settled.run.completion.unlockedEra === newEra && JSON.stringify(settled.run.completion.unlockedEras) === JSON.stringify(unlocked), settled);
    await checkSelection(page, newEra);
    checkGeometry(`${label} 完成近景`, await probe(page, newEra));
    const stamp = progressStamp(settled);
    await page.reload();
    await ready(page, newEra);
    await near(page);
    await noFlip(page, `${label} 刷新已结算轮次不再翻页`);
    check(`${label} 刷新不重复累计`, progressStamp(await state(page)) === stamp);
    await resetTrace(page);
    await select(page, oldEra);
    if (reduced) await noFlip(page, `${label} 回看旧时代直接切换`);
    else checkFlip(`${label} 回看旧时代`, await trace(page), newEra, oldEra);
    await resetTrace(page);
    await page.click('#civilization-entry');
    await page.waitForSelector('body[data-view="scene"]');
    await fxIdle(page);
    if (await page.locator('#unlock-dialog').isVisible()) await page.click('[data-action="close-unlock"]');
    check(`${label} 旧文明 scene 使用同一 viewEra`, (await state(page)).progress.viewEra === oldEra);
    await page.click('[data-action="back-home"]');
    await page.waitForSelector('body[data-view="home"]');
    await fxIdle(page);
    await ready(page, oldEra);
    await near(page);
    await noFlip(page, `${label} 从旧文明 scene 返回不重播翻页`);
    await resetTrace(page);
    await select(page, newEra);
    if (reduced) await noFlip(page, `${label} 再选已解锁时代直接切换`);
    else checkFlip(`${label} 再选已解锁时代`, await trace(page), oldEra, newEra);
    check(`${label} 刷新、回看、scene 往返均不重复进度`, progressStamp(await state(page)) === stamp);
  });
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, timeout: TIMEOUT });
try {
  for (const minutes of [0, 25, 49, 50, 75, 99, 100]) {
    const p = seed(minutes).progress;
    check(`${minutes}分钟正式门槛为 stone/50 tang/100 steam`, canEnterEra('stone', p) && canEnterEra('tang', p) === (minutes >= 50) && canEnterEra('steam', p) === (minutes >= 100));
  }
  for (const [width, height, device] of [[1440, 900, 'desktop'], [390, 844, 'phone'], [320, 568, 'small-phone']]) {
    for (const era of ERAS) {
      await withPage(browser, { width, height }, async (page) => {
        await select(page, era);
        await near(page);
        const label = `${era} ${device}`;
        checkGeometry(label, await probe(page, era));
        if (device !== 'small-phone') await page.screenshot({ path: `${SHOTS}civilization-${era}-${device}.png` });
        animated(`${label} 空闲`, era, await samples(page, era), true);
        await page.click('#home-start');
        const started = await probe(page, era);
        check(`${label} home-start 只开始正式25分钟、不离开近景`, started.run.status === 'running' && started.run.durationMs === 1500000 && await page.getAttribute('body', 'data-view') === 'home' && await page.getAttribute('body', 'data-dial') === 'near');
        for (const ms of [60000, 1000, 360000, 360000]) {
          await advance(page, ms);
          const next = await probe(page, era);
          check(`${label} 快进${ms}ms计时双针准确、镜头局部不变且模型 world 跟针`, poseMatches(next) && next.run.roundId === started.run.roundId && next.rootId === started.rootId && same(next.camera, started.camera) && same(next.target, started.target) && same(next.rootInFocus, started.rootInFocus) && !same(next.rootWorld, started.rootWorld) && next.pivot[0] < next.tip[0] && fits(next.model, width, height), { count: next.count, angle: next.angle });
        }
        await page.click('#home-pause');
        const paused = await probe(page, era);
        await advance(page, 12750);
        animated(`${label} 暂停timer`, era, await samples(page, era), true);
        const later = await probe(page, era);
        check(`${label} 暂停仅停止timer双针及读数`, later.run.status === 'paused' && equal(paused.angle, later.angle) && equal(paused.seconds, later.seconds) && paused.count === later.count && poseMatches(later));
        if (device === 'desktop') {
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await frames(page, 3);
          animated(`${label} 减少动态`, era, await samples(page, era), false);
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await frames(page, 3);
          animated(`${label} 解除减少动态`, era, await samples(page, era), true);
          if (era === 'steam') {
            await visibilityCheck(page, era);
            const awake = await probe(page, era);
            check('后台唤醒仍保持暂停timer的两针与读数', equal(paused.angle, awake.angle) && equal(paused.seconds, awake.seconds) && paused.count === awake.count);
          }
        }
        await page.click('#home-pause');
        await advance(page, 1000);
        const resumed = await probe(page, era);
        check(`${label} 继续计时一秒精确转针、不增加正式进度`, resumed.run.status === 'running' && poseMatches(resumed) && equal(paused.seconds - resumed.seconds, Math.PI / 30) && (await state(page)).progress.focusMinutes === 100);
      });
    }
  }

  await unlockCase(browser, 25, 25, 'stone', 'tang', ['tang']);
  await unlockCase(browser, 75, 25, 'tang', 'steam', ['steam']);
  await unlockCase(browser, 0, 100, 'stone', 'steam', ['tang', 'steam']);
  await unlockCase(browser, 0, 100, 'stone', 'steam', ['tang', 'steam'], true);

  {
    let failure;
    await withPage(browser, { setup: async (page) => { failure = await failModel(page, 'tang'); } }, async (page) => {
      await near(page);
      const old = await probe(page, 'stone');
      await resetTrace(page);
      await page.click('[data-home-era="tang"]');
      await ready(page, 'stone', 'error');
      await page.waitForSelector('#civilization-retry:visible');
      check('仅 tang GLB 二进制失败，旧 stone 保留且选择仍为 tang', failure.urls.length > 0 && failure.urls.every((url) => !new globalThis.URL(url).searchParams.has('import')) && (await probe(page, 'stone')).rootId === old.rootId && (await state(page)).progress.viewEra === 'tang');
      await checkSelection(page, 'tang');
      await noFlip(page, '目标模型加载失败时不翻页');
      await resetTrace(page);
      await failure.restore();
      const gate = await delayModel(page, 'tang');
      await page.click('#civilization-retry');
      await gate.requested();
      await waitLoading(page);
      check('重试请求未成功前仍保留同一个旧模型', (await probe(page, 'stone')).rootId === old.rootId && await page.getAttribute('#dial-canvas', 'data-civilization') === 'stone');
      gate.release();
      await gate.delivered();
      await ready(page, 'tang');
      const loaded = await probe(page, 'tang');
      check('重试成功才替换模型并隐藏重试入口', loaded.era === 'tang' && loaded.rootId !== old.rootId && loaded.roots === 1 && !await page.locator('#civilization-retry').isVisible());
      checkFlip('重试成功后切换', await trace(page), 'stone', 'tang');
    });
  }
  {
    let gate;
    await withPage(browser, { setup: async (page) => { gate = await delayModel(page, 'tang'); } }, async (page) => {
      await near(page);
      await resetTrace(page);
      await page.click('[data-home-era="tang"]');
      await gate.requested();
      await waitLoading(page);
      await page.click('[data-home-era="steam"]');
      await ready(page, 'steam');
      const latest = await probe(page, 'steam');
      checkFlip('快速切换只转场到最后选择', await trace(page), 'stone', 'steam');
      await resetTrace(page);
      gate.release();
      await gate.delivered();
      // Delivery alone does not mean GLTF parsing / the stale promise callback has finished.
      await page.waitForFunction(() => window.__civParsedEras.includes('tang'));
      await frames(page);
      await page.waitForTimeout(750);
      const after = await probe(page, 'steam');
      const t = await trace(page);
      check('快速 tang→steam 后迟到 tang 响应不能覆盖最新模型', after.era === 'steam' && after.rootId === latest.rootId && after.roots === 1 && await page.getAttribute('#dial-canvas', 'data-civilization-status') === 'ready' && await page.getAttribute('#dial-canvas', 'data-civilization') === 'steam' && t.frames.every((f) => f.mounted === 'steam' && f.era === 'steam'), gate.urls);
      await checkSelection(page, 'steam');
      await noFlip(page, '旧请求迟到不再次翻页');
    });
  }
  {
    let failure;
    await withPage(browser, { initial: seed(0), loadedEra: '', status: 'error', setup: async (page) => { failure = await failModel(page, 'stone'); } }, async (page) => {
      await near(page);
      check('首次 stone 失败只留空挂点、不降级整个时钟', failure.urls.length > 0 && (await probe(page, 'stone')).roots === 0 && !await page.locator('#dial-fallback').isVisible() && await page.locator('#civilization-retry').isVisible());
      await page.click('#home-start');
      await advance(page, 2000);
      let s = await probe(page, 'stone');
      check('文明空挂点仍可开始计时并精确走针', s.run.status === 'running' && s.count === '24:58' && poseMatches(s));
      await page.click('#home-pause');
      const paused = await probe(page, 'stone');
      await advance(page, 2000);
      s = await probe(page, 'stone');
      check('文明加载失败仍可暂停计时', s.run.status === 'paused' && s.count === '24:58' && equal(paused.angle, s.angle) && equal(paused.seconds, s.seconds));
      await page.click('#home-pause');
      await advance(page, 1000);
      s = await probe(page, 'stone');
      check('文明加载失败仍可继续同一轮', s.run.status === 'running' && s.run.roundId === paused.run.roundId && s.count === '24:57' && poseMatches(s));
      await failure.restore();
      await page.click('#civilization-retry');
      await ready(page, 'stone');
      checkGeometry('首次失败后重试', await probe(page, 'stone'));
      check('首次失败后恢复模型不重置timer或进度', (await state(page)).run.roundId === paused.run.roundId && (await state(page)).progress.focusMinutes === 0);
    });
  }
} finally {
  await browser.close();
}
console.log(`\n${passed} civilization checks passed`);

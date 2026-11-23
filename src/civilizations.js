import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SCENES } from './scene-catalog.mjs';
import { createCivilizationLife, nextLifePhase } from './civilization-life.mjs';
import { createEraTurn } from './era-turn.mjs';

const MODEL_URLS = import.meta.glob('./assets/models/*.glb', { query: '?url', import: 'default', eager: true });

function disposeRoots(roots) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  for (const root of new Set(roots)) {
    root?.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      node.skeleton?.dispose();
      if (node.isInstancedMesh) node.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (material) materials.add(material);
      }
    });
  }
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  }
  for (const texture of textures) {
    texture.source?.data?.close?.();
    texture.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function disposeAsset(asset) {
  if (!asset) return;
  asset.mixer?.stopAllAction();
  asset.mixer?.uncacheRoot(asset.root);
  asset.root.removeFromParent();
  disposeRoots([asset.root, ...asset.scenes]);
  asset.life = null;
}

export function createCivilizations(mount, { reducedMotion = false, onState = () => {} } = {}) {
  let active = false;
  let reduced = Boolean(reducedMotion);
  let disposed = false;
  let sequence = 0;
  let current = null;
  let request = null;
  let pending = null;
  let turn = null;
  let target = null;
  let status = null;
  let lastState = null;
  let dirty = false;

  function notify() {
    if (disposed || !status) return;
    const state = {
      status, era: current ? SCENES[current.id].era : null,
      sceneId: current?.id ?? null, target, flipping: Boolean(turn?.active)
    };
    if (lastState && Object.keys(state).every((key) => state[key] === lastState[key])) return;
    lastState = { ...state };
    onState(state);
  }

  function cancelTurn() {
    turn?.dispose();
    turn = null;
    disposeAsset(pending);
    pending = null;
    dirty = true;
  }

  function installPending() {
    if (!pending) return;
    const old = current;
    mount.add(pending.root);
    current = pending;
    pending = null;
    disposeAsset(old);
    dirty = true;
    notify();
  }

  function finishTurn() {
    if (request) request.animate = false;
    turn?.complete();
  }

  async function loadTarget(job) {
    let asset = null;
    try {
      const gltf = await new GLTFLoader(new THREE.LoadingManager()).loadAsync(MODEL_URLS[`./assets/models/${SCENES[job.id].file}`]);
      asset = { id: job.id, root: gltf.scene, scenes: gltf.scenes || [], mixer: null, life: null, seconds: 0 };
      if (disposed || job.sequence !== sequence) {
        disposeAsset(asset);
        return;
      }
      asset.root.position.set(0, 0, 0);
      asset.root.rotation.set(0, 0, 0);
      asset.root.scale.set(1, 1, 1);
      asset.root.userData.era = SCENES[job.id].era;
      asset.root.userData.sceneId = job.id;
      asset.mixer = new THREE.AnimationMixer(asset.root);
      for (const clip of gltf.animations) asset.mixer.clipAction(clip).play();
      asset.mixer.setTime(0);
      asset.life = createCivilizationLife(asset.root, job.id);
      asset.life.seek(0);
    } catch (error) {
      disposeAsset(asset);
      if (disposed || job.sequence !== sequence) return;
      request = null;
      status = 'error';
      console.warn(`时拓：${job.id} 地点模型加载失败`, error);
      notify();
      return;
    }
    request = null;
    pending = asset;
    status = 'ready';
    if (job.animate && current && active && !document.hidden && !reduced) {
      turn = createEraTurn(mount);
      turn.start({
        from: SCENES[current.id].era,
        to: SCENES[job.id].era,
        onSwap: installPending,
        onDone: () => {
          turn.dispose();
          turn = null;
          dirty = true;
          notify();
        }
      });
    } else installPending();
    notify();
  }

  function setScene(id, { animate = true } = {}) {
    if (disposed) return;
    if (!Object.hasOwn(SCENES, id)) throw new RangeError(`Unknown scene: ${id}`);
    if (target === id && status !== 'error') return;
    sequence += 1;
    request = null;
    cancelTurn();
    target = id;
    if (current?.id === id) {
      status = 'ready';
      notify();
      return;
    }
    const job = { id, sequence, animate: Boolean(animate && current && active && !document.hidden && !reduced) };
    request = job;
    status = 'loading';
    notify();
    void loadTarget(job);
  }

  function update(deltaSeconds) {
    if (disposed || !active || document.hidden) return false;
    if (!reduced) {
      if (current) {
        current.seconds += deltaSeconds;
        current.mixer.update(deltaSeconds);
        // 地点日程拥有角色姿态；环境剪辑先求值，避免旧人物剪辑覆盖日程。
        current.life.seek(current.seconds);
        dirty = true;
      }
      if (turn?.update(deltaSeconds)) dirty = true;
    }
    const changed = dirty;
    dirty = false;
    notify();
    return changed;
  }

  function setActive(next) {
    if (disposed) return;
    active = Boolean(next);
    if (!active) finishTurn();
    notify();
  }

  function setReduced(next) {
    if (disposed || reduced === Boolean(next)) return;
    reduced = Boolean(next);
    if (reduced) {
      for (const asset of [current, pending]) {
        if (!asset) continue;
        asset.seconds = 0;
        asset.mixer.setTime(0);
        asset.life.seek(0);
      }
      finishTurn();
      dirty = true;
    }
    notify();
  }

  function nextPhase() {
    if (!current || reduced || !active || document.hidden || turn?.active) return;
    current.seconds = nextLifePhase(current.seconds);
    current.mixer.setTime(current.seconds);
    current.life.seek(current.seconds);
    dirty = true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    sequence += 1;
    request = null;
    cancelTurn();
    disposeAsset(current);
    current = null;
  }

  return { setScene, update, setActive, setReduced, nextPhase, dispose };
}

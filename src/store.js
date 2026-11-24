import { createIdleRun } from './timer.js';
import { ERA_ORDER, canEnterEra, highestUnlockedEra, legacyUnlockedEra } from './eras.js';

export const STORAGE_KEY = 'wmf:v1:formal';
export const VERSION = 1;
export const DEFAULT_SETTINGS = Object.freeze({
  focusMinutes: 25,
  breakMinutes: 5
});

const STATUSES = new Set(['idle', 'running', 'paused', 'done']);
const MODES = new Set(['focus', 'break']);
const VIEW_ERAS = new Set(ERA_ORDER);

function defaultProgress() {
  return {
    completedRounds: 0,
    focusMinutes: 0,
    legacyEraFloor: 'stone',
    viewEra: 'stone',
    lastSettledRoundId: null
  };
}

export function defaultState() {
  const settings = { ...DEFAULT_SETTINGS };
  return {
    version: VERSION,
    kind: 'formal',
    updatedAt: 0,
    settings,
    progress: defaultProgress(),
    run: createIdleRun(settings.focusMinutes * 60000)
  };
}

function positiveInt(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const focusMinutes = positiveInt(raw.focusMinutes);
  const breakMinutes = positiveInt(raw.breakMinutes);
  if (focusMinutes == null || breakMinutes == null) return { ...DEFAULT_SETTINGS };
  return { focusMinutes, breakMinutes };
}

function normalizeCompletion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidates = new Set([
    raw.unlockedEra,
    ...(Array.isArray(raw.unlockedEras) ? raw.unlockedEras : [])
  ]);
  const unlockedEras = ERA_ORDER.filter((id) => candidates.has(id));
  return {
    unlockedEra: unlockedEras.at(-1) || null,
    unlockedEras,
    futureEra: VIEW_ERAS.has(raw.futureEra) ? raw.futureEra : null,
    at: typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : 0
  };
}

function normalizeRun(raw, settings) {
  const focusMs = settings.focusMinutes * 60000;
  const breakMs = settings.breakMinutes * 60000;
  if (!raw || typeof raw !== 'object') return createIdleRun(focusMs);

  let mode = MODES.has(raw.mode) ? raw.mode : 'focus';
  let status = STATUSES.has(raw.status) ? raw.status : 'idle';
  if (status === 'idle' || (status === 'done' && mode === 'break')) {
    return createIdleRun(focusMs);
  }

  const fallbackMs = mode === 'break' ? breakMs : focusMs;
  const durationMs =
    typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) && raw.durationMs > 0
      ? raw.durationMs
      : fallbackMs;

  let deadline =
    status === 'running' && typeof raw.deadline === 'number' && Number.isFinite(raw.deadline)
      ? raw.deadline
      : null;
  if (status === 'running' && deadline == null) status = 'paused';

  const remainingMs =
    status === 'paused' && typeof raw.remainingMs === 'number' && Number.isFinite(raw.remainingMs)
      ? Math.max(0, raw.remainingMs)
      : status === 'paused'
        ? durationMs
        : null;

  return {
    mode,
    status,
    durationMs,
    deadline,
    remainingMs,
    roundId: typeof raw.roundId === 'string' && raw.roundId ? raw.roundId : null,
    ...(typeof raw.dialOriginSeconds === 'number' && Number.isFinite(raw.dialOriginSeconds) && raw.dialOriginSeconds >= 0
      ? { dialOriginSeconds: raw.dialOriginSeconds }
      : {}),
    completion: status === 'done' ? normalizeCompletion(raw.completion) : null
  };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid-state');
  if (raw.version !== VERSION) throw new Error('version-mismatch');
  if (raw.kind && raw.kind !== 'formal') throw new Error('kind-mismatch');

  const settings = normalizeSettings(raw.settings);
  const rawProgress = raw.progress && typeof raw.progress === 'object' ? raw.progress : {};
  const completedRounds =
    Number.isInteger(rawProgress.completedRounds) && rawProgress.completedRounds >= 0
      ? rawProgress.completedRounds
      : 0;
  const focusMinutes =
    typeof rawProgress.focusMinutes === 'number' &&
    Number.isFinite(rawProgress.focusMinutes) &&
    rawProgress.focusMinutes >= 0
      ? rawProgress.focusMinutes
      : 0;
  // 只为缺少字段的旧正式档补发资格；非法现有字段不能再次触发迁移。
  const legacyEraFloor = Object.hasOwn(rawProgress, 'legacyEraFloor')
    ? (VIEW_ERAS.has(rawProgress.legacyEraFloor) ? rawProgress.legacyEraFloor : 'stone')
    : legacyUnlockedEra(completedRounds);

  const progress = {
    completedRounds,
    focusMinutes,
    legacyEraFloor,
    viewEra: rawProgress.viewEra,
    lastSettledRoundId:
      typeof rawProgress.lastSettledRoundId === 'string' && rawProgress.lastSettledRoundId
        ? rawProgress.lastSettledRoundId
        : null
  };
  if (!canEnterEra(progress.viewEra, progress)) {
    progress.viewEra = highestUnlockedEra(progress);
  }

  return {
    version: VERSION,
    kind: 'formal',
    updatedAt:
      typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
    settings,
    progress,
    run: normalizeRun(raw.run, settings)
  };
}

export function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: defaultState(), storageFailed: true, recovered: false };
  }
  if (!raw) return { state: defaultState(), storageFailed: false, recovered: false };
  try {
    return { state: normalizeState(JSON.parse(raw)), storageFailed: false, recovered: false };
  } catch {
    return { state: defaultState(), storageFailed: false, recovered: true };
  }
}

export function saveState(state) {
  state.updatedAt = Date.now();
  try {
    state.progress.legacyEraFloor = VIEW_ERAS.has(state.progress.legacyEraFloor)
      ? state.progress.legacyEraFloor
      : 'stone';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function storageAvailable() {
  try {
    const probe = 'wmf:v1:probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

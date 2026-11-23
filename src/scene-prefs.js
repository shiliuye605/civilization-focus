import { ERAS, SCENES } from './scene-catalog.mjs';

export const SCENE_PREFS_KEY = 'wmf:v1:places';

export function defaultScenePrefs() {
  return Object.fromEntries(Object.entries(ERAS).map(([id, era]) => [id, era.defaultId]));
}

export function loadScenePrefs() {
  const prefs = defaultScenePrefs();
  try {
    const raw = JSON.parse(localStorage.getItem(SCENE_PREFS_KEY));
    if (!raw || raw.version !== 1 || !raw.lastByEra || typeof raw.lastByEra !== 'object') return prefs;
    for (const era of Object.keys(prefs)) {
      const id = raw.lastByEra[era];
      if (typeof id === 'string' && Object.hasOwn(SCENES, id) && SCENES[id].era === era) prefs[era] = id;
    }
  } catch {
    return prefs;
  }
  return prefs;
}

export function saveScenePrefs(lastByEra) {
  try {
    localStorage.setItem(SCENE_PREFS_KEY, JSON.stringify({ version: 1, lastByEra }));
    return true;
  } catch {
    return false;
  }
}
